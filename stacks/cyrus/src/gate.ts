// THE ORDER GATE. The only code in the worker that may send an entry order. Every entry passes, in order:
//   1. the stop flag (kept in memory and written through to the database, so a stop command is seen at once)
//   2. the approval (no approved limits today means no entry), the arming (the borrowing cap and long only are
//      set at Alpaca at 5 minutes before the open; an unarmed day does not trade), and no carried position
//   3. a broker snapshot no older than a few seconds (account, positions, settings, clock): too old means refused
//   4. the fixed limit checks in limits.ts, including the trades-a-minute cap
//   5. the governor: a slot under the per-minute cap and under Alpaca's request headroom
//   6. the broker's own switches (long only, borrowing cap no higher than approved)
//   7. a record of the intent in the database, with a unique id (date, symbol and a running number, because a name
//      can be entered again after its first position closed), written BEFORE the order is sent
//   8. the stop flag again, immediately before sending
// and then the order is sent with its exits (a take-profit and a protective stop) resting at Alpaca. If the database
// or the broker cannot be read, the entry is refused: the stack fails closed. Calls are handled one at a time.
//
// Speed: nothing in here waits on Discord. Trade news goes to a digest that the worker posts in batches.
import { AlpacaError } from "./alpaca-trading.ts";
import type { BrokerView } from "./broker-view.ts";
import type { GateBroker } from "./broker.ts";
import type { Governor } from "./governor.ts";
import { MAX_TRADES_PER_MINUTE_LOAD_DAY, checkEntry, tradesCeiling, type EntryContext } from "./limits.ts";
import { LOAD_MAX_POSITION_USD, LOAD_WINDOW_SHARES, beforeLoadWindow, hasLoadEntries, inAfternoonLoad, loadCeilingOn, loadRulesApply, loadWindow } from "./load-mode.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP, type NotFlatState, type OrderRecord, type StopFlag, type Store } from "./store.ts";
import { readPause, type MiddayPause } from "./midday.ts";
import type { Signal } from "./strategy.ts";
import { centralTime, etDate, minutesBetween } from "./time.ts";

// The refusal while the mid-day cycle has entries paused.
export const MIDDAY_PAUSED = "paused for the mid-day cycle";

export type GateResult =
  | { status: "sent"; clientOrderId: string; qty: number; acceptMs: number }
  | { status: "refused"; reason: string }
  | { status: "error"; reason: string };

export interface GateDeps {
  broker: GateBroker;
  store: Store;
  view: BrokerView;
  governor: Governor;
  now: () => Date;
  say: (channel: "commands" | "trading" | "alerts", text: string) => Promise<boolean>;
  // Adds a line to the trade digest. Instant; never waits.
  note: (line: string, kind?: "entry" | "refused") => void;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // A signal that waited longer than this in the queue is dropped (default 5 seconds).
  maxQueueMs?: number;
  clockMs?: () => number;
  // Why entries are blocked although nothing else forbids them (the worker: Michael's commands are not being read), or null.
  entryBlock?: () => string | null;
  // The speed release (decision 4): told about each 1-share limit entry Alpaca accepted, so the worker can cancel it if it has not
  // filled within the load day's wait (entry-expiry.ts). Never waits.
  onLimitEntrySent?: (e: { clientOrderId: string; alpacaOrderId: string; symbol: string; qty: number }) => void;
}

// The speed release (Michael's decision 5, 2026-11-05), on a load day: after Alpaca refuses an entry, that symbol waits a few seconds before the next
// try, not a minute: REFUSAL_BACKOFF_BASE_MS after the first refusal, doubling for each further refusal of the same symbol within the
// last REFUSAL_WINDOW_MS, never more than REFUSAL_BACKOFF_CAP_MS (3, 6, 12, 24, then 30 seconds). Chosen from 2026-11-05's data (the
// C2 log, "Speed release"): IEX changed a symbol's price about every 1.5 seconds, and an order 2 to 5 seconds after a "price above
// the print" order was no likelier to meet it again than any other order. It is read from the stored refusals, so a restart keeps it.
// Every refused order still took its slot under the trades-a-minute ceiling (the governor counts it when it is sent).
export const REFUSAL_BACKOFF_BASE_MS = 3_000;
export const REFUSAL_BACKOFF_CAP_MS = 30_000;
export const REFUSAL_WINDOW_MS = 60_000;

// How long this symbol must still wait after Alpaca's refusals (0: no wait).
export function refusalWaitMs(rows: OrderRecord[], symbol: string, nowMs: number): number {
  const times = rows
    .filter((o) => o.symbol === symbol && o.status === "failed" && o.createdAt)
    .map((o) => Math.min(nowMs, new Date(o.createdAt!).getTime()))
    .filter((t) => nowMs - t < REFUSAL_WINDOW_MS);
  if (times.length === 0) return 0;
  const wait = Math.min(REFUSAL_BACKOFF_CAP_MS, REFUSAL_BACKOFF_BASE_MS * 2 ** (times.length - 1));
  return Math.max(0, Math.max(...times) + wait - nowMs);
}

export const peakKey = (date: string) => `peak_exposure:${date}`;

export function clientOrderIdFor(date: string, symbol: string, n: number): string {
  return `cyrus-${date.replaceAll("-", "")}-${symbol}-${n}`;
}

// Refusals that are normal flow control at volume (a full minute, a held name). They are counted and written down
// as one line per reason per minute, not one row each.
const FLOW_REASONS = [/^load day: entries start/, /^my commands /, /^trades-per-minute/, /^holding back for safety/, /^already holding/, /^an entry for this symbol is still working/, /^the signal waited/, /^Alpaca refused this symbol a moment ago/, /^too close to the close for a new entry/];

const isActive = (o: OrderRecord) => !o.closedAt && (o.status === "intent" || o.status === "submitted" || o.status === "filled");

export class OrderGate {
  private readonly d: GateDeps;
  private chain: Promise<unknown> = Promise.resolve();
  private readonly writes = new Set<Promise<unknown>>();
  private readonly flow = new Map<string, { date: string; reason: string; count: number }>();
  private peak: { date: string; exposureUsd: number; equity: number } | null = null;
  private readonly clockMs: () => number;
  private primed = false;
  private lastSnapshotFailure = 0;

  constructor(deps: GateDeps) {
    this.d = deps;
    this.clockMs = deps.clockMs ?? (() => performance.now());
  }

  // One entry at a time, so two signals cannot both pass the same check.
  enter(signal: Signal): Promise<GateResult> {
    const queuedAt = this.d.now().getTime();
    const t0 = this.clockMs(); // the time to accept runs from the moment the signal reaches the gate, queue included
    const run = this.chain.then(() => {
      const started = this.clockMs();
      return this.run(signal, queuedAt, t0).finally(() => this.noteTime(started - t0, this.clockMs() - started));
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  // Self-monitoring (Michael's approval of 2026-11-11), measurement only: each decision's own time (from its start to its answer) and
  // its wait in the queue, and the day's stored orders the last decision read. Taken once a minute by the worker.
  private times: Array<{ runMs: number; queueMs: number }> = [];
  private timesDropped = 0;
  private storedOrders: number | null = null;
  private noteTime(queueMs: number, runMs: number): void {
    if (this.times.length < 20_000) this.times.push({ runMs, queueMs });
    else this.timesDropped++; // full (no sample for a long time): counted, not kept
  }
  takeDecisionTimes(): { times: Array<{ runMs: number; queueMs: number }>; storedOrders: number | null; dropped: number } {
    const t = this.times;
    const dropped = this.timesDropped;
    this.times = [];
    this.timesDropped = 0;
    return { times: t, storedOrders: this.storedOrders, dropped };
  }

  // Resolves when every background write the gate started (the record update after a send) has finished.
  async settled(): Promise<void> {
    while (this.writes.size > 0) await Promise.allSettled([...this.writes]);
  }

  private background(p: Promise<unknown>): void {
    const tracked = p.catch(() => undefined).finally(() => this.writes.delete(tracked));
    this.writes.add(tracked);
  }

  private fire(channel: "commands" | "trading" | "alerts", text: string): void {
    void this.d.say(channel, text).catch(() => undefined);
  }

  private async refuse(date: string, symbol: string, reason: string, detail?: Record<string, unknown>, record = true): Promise<GateResult> {
    this.d.log?.("entry_refused", { symbol, reason, ...detail });
    if (FLOW_REASONS.some((re) => re.test(reason))) {
      const key = `${date}|${reason}`;
      const cur = this.flow.get(key);
      if (cur) cur.count++;
      else this.flow.set(key, { date, reason, count: 1 });
    } else if (record) {
      try {
        await this.d.store.addRefusal({ tradeDate: date, symbol, reason, detail });
      } catch {
        /* the refusal still stands even if it cannot be written down */
      }
    }
    return { status: "refused", reason };
  }

  // Writes the counted flow-control refusals as single rows ("reason, count"), and the day's peak exposure.
  async flush(): Promise<void> {
    const rows = [...this.flow.values()];
    this.flow.clear();
    for (const r of rows) await this.d.store.addRefusal({ tradeDate: r.date, symbol: "(many)", reason: r.reason, detail: { count: r.count } }).catch(() => undefined);
    if (this.peak) {
      const p = this.peak;
      const prev = await this.d.store.getControl<{ exposureUsd: number }>(peakKey(p.date)).catch(() => null);
      if (!prev || p.exposureUsd > prev.exposureUsd) await this.d.store.setControl(peakKey(p.date), { exposureUsd: p.exposureUsd, equity: p.equity, ratio: p.exposureUsd / p.equity }).catch(() => undefined);
    }
  }

  // Records that Alpaca has the order. Never moves a row backwards: if the order sync already recorded a fill or a close, only
  // the Alpaca id and the time to accept are added.
  private async markSubmitted(clientOrderId: string, alpacaOrderId: string, acceptMs: number): Promise<void> {
    const row = await this.d.store.getOrder(clientOrderId);
    if (row && row.status !== "intent") await this.d.store.updateOrder(clientOrderId, { alpacaOrderId: row.alpacaOrderId ?? alpacaOrderId, acceptMs });
    else await this.d.store.updateOrder(clientOrderId, { status: "submitted", alpacaOrderId, acceptMs });
  }

  private async run(signal: Signal, queuedAt: number, t0: number): Promise<GateResult> {
    const now = this.d.now();
    const date = etDate(now);
    const symbol = signal.symbol;
    const maxQueue = this.d.maxQueueMs ?? 5_000;
    if (now.getTime() - queuedAt > maxQueue) return this.refuse(date, symbol, `the signal waited more than ${maxQueue / 1000} seconds in the queue, so it is stale`);

    let stop: StopFlag | null;
    let notFlat: NotFlatState | null;
    let pause: MiddayPause | null;
    let day;
    try {
      stop = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
      notFlat = await this.d.store.getControl<NotFlatState>(CONTROL_NOT_FLAT);
      pause = await readPause(this.d.store, date);
      day = await this.d.store.getDay(date);
    } catch {
      return this.refuse(date, symbol, "database unavailable, so no entry", undefined, false);
    }
    const limits = day && day.status === "approved" ? day.limits : null;
    if (!day || !day.openAt || !day.closeAt) {
      return this.refuse(date, symbol, limits ? "no session times for today" : "no limits approved for today");
    }
    // Approved but not armed (the cap and long only were not confirmed at Alpaca): fail closed. The stop flag
    // and the approval are still reported first, because checkEntry below puts them first.
    const unarmed = limits !== null && !stop?.on && !day.phases.armed;
    if (unarmed) return this.refuse(date, symbol, "the day is not armed yet (borrowing cap and long only not confirmed at Alpaca)");
    if (notFlat?.on && !stop?.on && limits) return this.refuse(date, symbol, "the account was not flat after the last close-out");
    if (stop?.on) return this.refuse(date, symbol, "stop flag is set");
    if (!limits) return this.refuse(date, symbol, "no limits approved for today");
    // The mid-day cycle (Michael, 2026-11-09): from 10:30 AM Central until a deploy or `go` ends it, no new entry. Before any request.
    if (pause?.on) return this.refuse(date, symbol, MIDDAY_PAUSED);
    const blocked = this.d.entryBlock?.();
    if (blocked) return this.refuse(date, symbol, blocked);
    // Load day (load-mode.ts): no entries before the load window, and at most 75 dollars an entry until the mid-day pause; from the
    // pause on, a normal day (Michael's decision of 2026-11-10).
    if (beforeLoadWindow(day, now)) return this.refuse(date, symbol, `load day: entries start at ${centralTime(loadWindow(day)!.start)} Central`);
    const loadRules = loadRulesApply(day, now, Boolean(pause?.since));
    // The afternoon load window (Michael's ruling of 2026-11-11): up to 150 orders a minute even above the day's approved limit, only
    // while that window is on. The ceiling below is 150 then too, so this never goes past MAX_TRADES_PER_MINUTE_LOAD_DAY.
    const tradesPerMinute = inAfternoonLoad(day, now) ? MAX_TRADES_PER_MINUTE_LOAD_DAY : limits.maxTradesPerMinute;
    const dayLimits = { ...limits, maxTradesPerMinute: tradesPerMinute, ...(loadRules ? { maxPositionUsd: Math.min(limits.maxPositionUsd, LOAD_MAX_POSITION_USD) } : {}) };
    // Michael's ruling of 2026-11-06: the ceiling is 150 orders a minute only while a load day's window is switched on, else 100; since
    // his decision of 2026-11-10, only until the mid-day pause.
    const ceiling = tradesCeiling(loadCeilingOn(day, now));

    // Strategy work never spends Alpaca's last request headroom: if the snapshot would have to ask Alpaca for something
    // and the budget is down to the safety reserve, refuse before any request is made. After a failed refresh, wait a
    // few seconds before trying again, so a queue of signals cannot hammer a struggling broker.
    const VIEW = { fastMs: 15_000, configMs: 120_000, clockMs: 20_000 };
    if (this.d.view.stale(VIEW)) {
      if (!this.d.governor.canSpend()) return this.refuse(date, symbol, `holding back for safety: Alpaca's request budget is down to ${Math.floor(this.d.governor.budget())} and my view of the account is too old to trade on`);
      if (now.getTime() - this.lastSnapshotFailure < 3_000) return this.refuse(date, symbol, "broker or database unavailable, so no entry", undefined, false);
    }
    let snap, rows;
    try {
      snap = await this.d.view.snapshot(VIEW);
      rows = await this.d.store.listOrders(date);
    } catch {
      this.lastSnapshotFailure = now.getTime();
      return this.refuse(date, symbol, "broker or database unavailable, so no entry", undefined, false);
    }
    this.storedOrders = rows.length;
    // After a restart, tell the governor about the entries sent in the last minute (once).
    if (!this.primed) {
      this.d.governor.prime(rows.filter((o) => o.status !== "failed" && o.createdAt && now.getTime() - new Date(o.createdAt).getTime() < 60_000).map((o) => Math.min(now.getTime(), new Date(o.createdAt!).getTime())));
      this.primed = true;
    }
    const { account, positions, config, clock } = snap;

    // Fail closed on its own, whatever the worker's carried-position scan has or has not done yet: a held symbol
    // with no stored order from today is a position this worker did not enter today (every entry is written down
    // before it is sent), so no entry goes out beside it.
    const todaysSymbols = new Set(rows.map((o) => o.symbol));
    const carried = positions.map((p) => p.symbol).filter((sym) => !todaysSymbols.has(sym));
    if (carried.length > 0 && limits) {
      return this.refuse(date, symbol, `a held position has no order from today (${carried.join(", ")}), so it is carried over: no entry`);
    }
    const held = new Set(positions.map((p) => p.symbol));
    if (rows.some((o) => o.symbol === symbol && isActive(o) && !held.has(symbol))) return this.refuse(date, symbol, "an entry for this symbol is still working");
    // Decision 5's short backoff on a load day; a normal day keeps the minute (the proposal's item 7: normal days unchanged).
    if (loadRules) {
      if (refusalWaitMs(rows, symbol, now.getTime()) > 0) return this.refuse(date, symbol, "Alpaca refused this symbol a moment ago, so I wait a few seconds before trying again");
    } else if (rows.some((o) => o.symbol === symbol && o.status === "failed" && o.createdAt && now.getTime() - new Date(o.createdAt).getTime() < 60_000)) return this.refuse(date, symbol, "Alpaca refused this symbol a moment ago, so I wait a minute before trying again");
    // Entries not yet in the (up to 15 seconds old) account view: sent but not filled, filled but not shown yet, or partly
    // filled. A symbol the view already shows is counted from its market value, plus any unfilled remainder.
    const pendingExposure = rows
      .filter((o) => isActive(o))
      .reduce((s, o) => {
        const filled = o.filledQty ?? 0;
        if (held.has(o.symbol)) return s + Math.max(0, o.qty - filled) * o.referencePrice;
        return s + (filled > 0 ? filled * (o.filledAvgPrice ?? o.referencePrice) + Math.max(0, o.qty - filled) * o.referencePrice : o.qty * o.referencePrice);
      }, 0);
    const ctx: EntryContext = {
      symbol,
      price: signal.price,
      limits: dayLimits,
      stopFlag: false,
      marketOpen: clock.isOpen,
      minutesSinceOpen: minutesBetween(day.openAt, now),
      minutesToClose: minutesBetween(now, day.closeAt),
      tradesLastMinute: this.d.governor.tradesInLastMinute(),
      tradesCeiling: ceiling,
      heldSymbols: held,
      dayStartEquity: day.dayStartEquity ?? account.lastEquity,
      equity: account.equity,
      grossExposure: positions.reduce((s, p) => s + Math.abs(p.marketValue), 0) + pendingExposure,
      priceAgeSeconds: (now.getTime() - signal.tradeTime.getTime()) / 1000,
    };
    const checked = checkEntry(ctx);
    if (!checked.ok) return this.refuse(date, symbol, checked.reason, { price: signal.price });
    // Release B: a signal made in the load window is 1 share (never more than the checks above allow). A 1-share order cannot
    // partly fill, so it never leaves a remainder without its stop.
    const qty = signal.load && hasLoadEntries(day) ? Math.min(checked.qty, LOAD_WINDOW_SHARES) : checked.qty;
    const decision = { ok: true as const, qty, notional: qty * signal.price };

    // The broker's own switches must match what Michael approved: long only, cap no higher than approved.
    if (account.status !== "ACTIVE" || account.tradingBlocked || account.accountBlocked || config.suspendTrade) {
      return this.refuse(date, symbol, "the Alpaca account is not active for trading");
    }
    if (!config.noShorting || config.maxMarginMultiplier > limits!.borrowingCap) {
      if (!this.d.governor.canSpend()) return this.refuse(date, symbol, "holding back for safety: the broker settings need repair and Alpaca's request budget is at the safety reserve");
      try {
        await this.d.broker.setAccountConfig({ noShorting: true, maxMarginMultiplier: limits!.borrowingCap });
        this.d.view.invalidate();
      } catch {
        return this.refuse(date, symbol, "could not set long only and the approved borrowing cap at Alpaca");
      }
    }
    // A limit entry (the load window) is checked against its own limit price, at or below the price seen: Alpaca checks its exits
    // against that limit price too.
    const limitPrice = signal.limitPrice !== undefined && signal.load && hasLoadEntries(day) && decision.qty === 1 ? signal.limitPrice : undefined;
    if (signal.limitPrice !== undefined && limitPrice === undefined) return this.refuse(date, symbol, "a limit entry is only sent in the load window, 1 share");
    const base = limitPrice ?? signal.price;
    if (limitPrice !== undefined && !(limitPrice > 0 && limitPrice <= signal.price)) return this.refuse(date, symbol, "the limit price is not at or below the price seen");
    if (!(signal.stopPrice > 0 && signal.stopPrice < base && signal.takeProfitPrice > base && signal.stopPrice < signal.price && signal.takeProfitPrice > signal.price)) return this.refuse(date, symbol, "the exits are not on the right sides of the price");

    // Decision 7: the governor's reserve scales with the symbols open (held, or with an entry working), counting this entry.
    this.d.governor.setOpenSymbols(new Set([...held, ...rows.filter((o) => isActive(o)).map((o) => o.symbol), symbol]).size);
    // The governor: a slot under the per-minute cap (never above the ceiling in force) and headroom under Alpaca's limit.
    const slot = this.d.governor.admitTrade(tradesPerMinute, ceiling);
    if (!slot.ok) return this.refuse(date, symbol, slot.reason);

    const n = rows.filter((o) => o.symbol === symbol).length + 1;
    const clientOrderId = clientOrderIdFor(date, symbol, n);
    const record: OrderRecord = { clientOrderId, tradeDate: date, symbol, qty: decision.qty, referencePrice: signal.price, stopPrice: signal.stopPrice, takeProfitPrice: signal.takeProfitPrice, status: "intent", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: now.toISOString() };
    let inserted: boolean;
    try {
      inserted = await this.d.store.insertOrder(record);
    } catch {
      return this.refuse(date, symbol, "database unavailable, so no entry", undefined, false);
    }
    if (!inserted) return this.refuse(date, symbol, "already decided this entry", undefined, false);

    // Last look at the stop flag before the order leaves (in memory: a stop command sets it before it does anything else).
    try {
      const again = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
      if (again?.on) {
        await this.d.store.updateOrder(clientOrderId, { status: "canceled", note: "stop flag set before sending" });
        return this.refuse(date, symbol, "stop flag is set");
      }
      // The mid-day pause, looked at again just before the order leaves (the mid-day close-out sets it before it sells anything).
      if ((await readPause(this.d.store, date))?.on) {
        await this.d.store.updateOrder(clientOrderId, { status: "canceled", note: "mid-day pause set before sending" });
        return this.refuse(date, symbol, MIDDAY_PAUSED);
      }
      const blockedNow = this.d.entryBlock?.();
      if (blockedNow) {
        await this.d.store.updateOrder(clientOrderId, { status: "canceled", note: "commands unreadable before sending" });
        return this.refuse(date, symbol, blockedNow);
      }
    } catch {
      await this.d.store.updateOrder(clientOrderId, { status: "canceled", note: "database unavailable before sending" }).catch(() => undefined);
      return this.refuse(date, symbol, "database unavailable, so no entry", undefined, false);
    }

    let sent;
    try {
      sent = await this.d.broker.submitEntry({ symbol, qty: decision.qty, stopPrice: signal.stopPrice, takeProfitPrice: signal.takeProfitPrice, referencePrice: signal.price, clientOrderId, ...(limitPrice !== undefined ? { limitPrice } : {}) });
    } catch (err) {
      const reason = (err as Error).message.slice(0, 200);
      // Only a definite "no" from Alpaca (a local refusal, or a 4xx other than 429) means nothing was sent.
      // Anything else (a timeout, a 5xx, a failed lookup) may have landed: the row stays "intent", still counts
      // as a trade, and the order sync reconciles it by its id.
      // A "duplicate client_order_id" answer (422) means the order already exists at Alpaca, so it is unclear, not refused.
      const duplicate = err instanceof AlpacaError && err.status === 422 && /client_order_id/i.test(err.message);
      const definite = err instanceof AlpacaError && !duplicate && (err.status === 0 || (err.status >= 400 && err.status < 500 && err.status !== 429));
      if (definite) {
        await this.d.store.updateOrder(clientOrderId, { status: "failed", note: reason }).catch(() => undefined);
        this.d.note(`${centralTime(now)} ${symbol}: Alpaca refused the entry and it was not retried: ${reason.slice(0, 100)}`, "refused");
        return { status: "error", reason };
      }
      await this.d.store.updateOrder(clientOrderId, { note: `outcome unclear: ${reason}` }).catch(() => undefined);
      this.fire("commands", `Entry for ${symbol}: the outcome at Alpaca is unclear (${reason}). It is counted as sent and will be checked against Alpaca; check the dashboard if it matters.`);
      return { status: "error", reason: `outcome unclear: ${reason}` };
    }
    const acceptMs = Math.max(0, Math.round(this.clockMs() - t0));
    // The order is at Alpaca. From here on, a problem writing it down must not make it look like it failed, and
    // the write must not hold up the next entry: it runs in the background.
    this.background(
      this.markSubmitted(clientOrderId, sent.id, acceptMs).catch(() => {
        // The row stays "intent", which still counts, and the order sync fills it in by its id. Say so.
        this.d.log?.("order_record_update_failed", { symbol });
        this.fire("alerts", `The entry for ${symbol} was sent to Alpaca but its record could not be updated. It is still counted, and will be reconciled from Alpaca by its id.`);
      }),
    );
    if (limitPrice !== undefined) {
      try {
        this.d.onLimitEntrySent?.({ clientOrderId, alpacaOrderId: sent.id, symbol, qty: decision.qty });
      } catch {
        /* the cancel timer must never break the gate; the order sync and the close-out still see the entry */
      }
    }
    const exposure = ctx.grossExposure + decision.notional;
    if (!this.peak || this.peak.date !== date || exposure > this.peak.exposureUsd) this.peak = { date, exposureUsd: exposure, equity: account.equity };
    this.d.log?.("entry_sent", { symbol, qty: decision.qty, stop: signal.stopPrice, target: signal.takeProfitPrice, acceptMs });
    this.d.note(`${centralTime(now)} BUY ${decision.qty} ${symbol} ${limitPrice !== undefined ? `limit ${limitPrice.toFixed(2)}` : `at about ${signal.price.toFixed(2)}`}, target ${signal.takeProfitPrice.toFixed(2)}, stop ${signal.stopPrice.toFixed(2)} (both held at Alpaca), accepted in ${acceptMs} ms`, "entry");
    return { status: "sent", clientOrderId, qty: decision.qty, acceptMs };
  }
}
