// Watching what the gate set in motion: bring the stored entries up to date from Alpaca, check that every open
// entry still has a live exit resting at Alpaca, and stop the day if the daily loss limit is reached.
import { AlpacaError, type Order } from "./alpaca-trading.ts";
import type { Broker } from "./broker.ts";
import { etInstant } from "./time.ts";
import { CONTROL_STOP, type DayRecord, type OrderRecord, type StopFlag, type Store } from "./store.ts";
import { OPEN_STATUSES, flattenLegs, openOrderIds, openSellQty, type Liquidator, type Say } from "./sells.ts";
import { SAFETY_RESERVE } from "./governor.ts";

export interface RiskDeps {
  broker: Broker;
  store: Store;
  now: () => Date;
  say: Say;
  liquidator: Liquidator;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // Optional: the worker passes its own, so the loss stop remembers that it fired even when the stop flag cannot be read.
  lossMemory?: LossStopMemory;
  // Optional: the order-rate governor. When given, the loss stop's retry never spends Alpaca's last SAFETY_RESERVE requests,
  // and the first sale's requests (as Alpaca counted them) are charged to the loss stop's budget.
  governor?: { budget(): number; stats?(): { requestsLastMinute: number } };
  // Optional: the worker passes its own, so the order sync remembers between runs (release A, fixes 1 and 4).
  syncMemory?: SyncMemory;
  // The speed release (Michael's decision 3): told about each sale of shares left without a stop, so the worker can measure it
  // against waiting 5 more seconds.
  onBareSale?: (sale: { symbol: string; shares: number; takeProfit: number | null; atMs: number }) => void;
  // The speed release, item 5 (shadow only): told about each account read of the loss stop, so the worker can log its own estimate
  // of equity beside Alpaca's. It never changes what the loss stop does.
  onAccountRead?: (account: { equity: number; cash: number }) => void;
}

// Release A, fix 1. On 2026-11-04 Alpaca paper cancelled a bracket's stop 2 ms after its take-profit's first partial fill (655
// times that day; Alpaca's documentation says the stop is "adjusted to the remaining quantity" instead). Until the take-profit
// finishes, the rest of the position has no stop. If it is still like that this long after the stop was cancelled, the rest is
// sold. 604 of the 655 finished within 10 seconds, 90 took longer than 5.
// The speed release (Michael's decision 3, 2026-11-05): 3 seconds, counted from Alpaca's cancel. The live update of the stop's cancel
// brings the next sync forward to that moment (worker.ts); the 10 second sync stays the backstop. On 2026-11-05, of 1,100 such
// cancels the take-profit finished on its own within 3 seconds in 827.
export const BARE_GRACE_MS = 3_000;
// Release A, fix 4: at most this many entries missing from Alpaca's listing are looked up by id in one sync, and an id Alpaca
// does not know is not asked again for this long.
export const MISSING_LOOKUPS_PER_SYNC = 10;
const MISSING_RETRY_MS = 60_000;
const MISSING_INTENT_AGE_MS = 10_000;
// The speed release, item 3: while Alpaca's live order updates are connected (they free symbols and report a stop's cancel at once),
// the 10 second sync is the backstop and reads only the orders of the last 10 minutes (at most 3 pages). An open entry older than
// that is looked up by its id instead: at most OLD_LOOKUPS_PER_SYNC in one sync, each at most every OLD_LOOKUP_EVERY_MS (as often as
// the normal-day sync used to read it). While the updates are NOT connected the sync reads everything since the oldest open entry,
// as before. On 2026-11-05 one entry held from 9:33 made every sync read about 2,600 entries (6 pages) by 2:00 PM.
export const RECENT_WINDOW_MS = 10 * 60_000;
export const RECENT_MAX_PAGES = 3;
export const OLD_LOOKUPS_PER_SYNC = 4;
// Group 1 review, round 1: at least this many, and enough that every older entry is looked up at least every OLD_LOOKUP_EVERY_MS
// (no slower than the normal-day sync of v9). An entry whose exit Alpaca just reported cancelled, expired or rejected (live updates,
// `mustLook`) is looked up on the very next sync, outside this budget, so the 3 second stop-gap sale also reaches an older entry.
export const OLD_LOOKUP_EVERY_MS = 30_000;

export class SyncMemory {
  // When this worker first saw an entry with its stop gone and shares left (used when Alpaca gives no cancel time).
  readonly bareSeen = new Map<string, number>();
  // Client ids Alpaca answered "not found" for, and until when not to ask again.
  readonly notFoundUntil = new Map<string, number>();
  // Release B: the latest copy of each open entry (with its exit legs) as Alpaca showed it to the last sync, and when that sync
  // finished. The live order updates read these instead of asking Alpaca again.
  readonly lastSeen = new Map<string, Order>();
  lastSyncAt = 0;
  // The speed release, item 3: when each open entry older than the recent window was last looked up by its id.
  readonly oldLookedAt = new Map<string, number>();
  // Entries (client ids) whose exit leg the live updates just reported cancelled, expired or rejected: looked up on the next sync.
  readonly mustLook = new Set<string>();
}
const fallbackSync = new SyncMemory();

// An entry whose stop is no longer live (cancelled or expired, not filled) while some of its shares are not sold yet: those shares
// have no stop, even if the take-profit is still open. Null when the stop is live, filled, absent, or nothing is left.
export function bareRemainder(o: Order): { shares: number; stop: Order } | null {
  const stop = stopLeg(o);
  if (!stop || OPEN_STATUSES.has(stop.status) || stop.filledQty > 0) return null;
  const left = o.filledQty - exitFilledQty(o);
  return left > 1e-9 ? { shares: left, stop } : null;
}

// A live exit leg of an entry: a sell leg that can still execute.
export const hasLiveExit = (o: Order): boolean => flattenLegs(o).some((l) => l.side === "sell" && OPEN_STATUSES.has(l.status));
const exitFilledQty = (o: Order): number => flattenLegs(o).filter((l) => l.side === "sell").reduce((n, l) => n + l.filledQty, 0);

// Kept for older callers and tests: the protective stop leg, if Alpaca shows one.
export function stopLeg(o: Order): Order | undefined {
  return o.legs.find((l) => l.side === "sell" && (l.type === "stop" || l.stopPrice !== null));
}

export interface SyncOptions {
  // False while a close-out is running or after the close-out time: the missing-exit check is skipped and NO sell is
  // placed. The close-out alone flattens the account. (On 2026-11-02 this check sold five positions the close-out had
  // just un-protected on purpose, and raised five false alarms.)
  // A function is asked again just before each sale, so a close-out that starts while the sync is running switches it off.
  protect: boolean | (() => boolean);
  // The speed release, item 3: true while Alpaca's live order updates are connected; then only the last 10 minutes are read.
  streamLive?: boolean;
}

// Updates stored entries from Alpaca by looking only at orders newer than the oldest entry still being watched
// (paged, so a day with thousands of orders is read in full). An entry is judged by its OWN order and its OWN exit
// legs, never by symbol, because a symbol can be entered again after the first position closed.
// An open entry with no live exit while its position is still held is sold at once and reported.
// Release A: `recheckAt` is the earliest moment a bare remainder (fix 1) reaches its grace time; the worker runs the next sync then.
export async function syncOrders(d: RiskDeps, day: DayRecord, opts: SyncOptions = { protect: true }): Promise<{ unprotected: string[]; incomplete: boolean; recheckAt?: number }> {
  const mem = d.syncMemory ?? fallbackSync;
  const active = (await d.store.listOrders(day.tradeDate)).filter((o) => !o.closedAt && (o.status === "intent" || o.status === "submitted" || o.status === "filled"));
  if (active.length === 0) {
    mem.bareSeen.clear();
    mem.lastSeen.clear();
    mem.lastSyncAt = d.now().getTime();
    return { unprotected: [], incomplete: false };
  }
  const activeIds = new Set(active.map((o) => o.clientOrderId));
  for (const id of [...mem.lastSeen.keys()]) if (!activeIds.has(id)) mem.lastSeen.delete(id);
  for (const id of [...mem.oldLookedAt.keys()]) if (!activeIds.has(id)) mem.oldLookedAt.delete(id);
  for (const id of [...mem.mustLook]) if (!activeIds.has(id)) mem.mustLook.delete(id);
  const midnight = etInstant(day.tradeDate, "00:00").getTime();
  const nowMs = d.now().getTime();
  const createdMs = (o: OrderRecord) => (o.createdAt ? new Date(o.createdAt).getTime() : midnight);
  const oldest = Math.min(...active.map(createdMs));
  const fromMs = Math.max(midnight, oldest - 60_000, opts.streamLive ? nowMs - RECENT_WINDOW_MS : midnight);
  const since = new Date(fromMs).toISOString();
  const [listed, positions] = await Promise.all([d.broker.listOrdersPaged("all", since, opts.streamLive ? RECENT_MAX_PAGES : 20), d.broker.listPositions()]);
  const byClientId = new Map(listed.orders.map((o) => [o.clientOrderId, o]));
  // Item 3: open entries made before the window read above are looked up by id, a few per sync, oldest look first.
  if (opts.streamLive) {
    const older = active.filter((s) => createdMs(s) < fromMs && !byClientId.has(s.clientOrderId));
    const must = older.filter((s) => mem.mustLook.has(s.clientOrderId));
    const due = older.filter((s) => !mem.mustLook.has(s.clientOrderId) && nowMs - (mem.oldLookedAt.get(s.clientOrderId) ?? 0) >= OLD_LOOKUP_EVERY_MS);
    due.sort((a, b) => (mem.oldLookedAt.get(a.clientOrderId) ?? 0) - (mem.oldLookedAt.get(b.clientOrderId) ?? 0) || createdMs(a) - createdMs(b));
    const budget = Math.max(OLD_LOOKUPS_PER_SYNC, Math.ceil(older.length / 3));
    for (const s of [...must, ...due.slice(0, budget)]) {
      mem.oldLookedAt.set(s.clientOrderId, nowMs);
      mem.mustLook.delete(s.clientOrderId);
      try {
        const found = await d.broker.findOrderByClientId(s.clientOrderId);
        if (found) byClientId.set(s.clientOrderId, found);
      } catch (err) {
        d.log?.("order_lookup_failed", { clientOrderId: s.clientOrderId, error: (err as Error).message.slice(0, 120) });
      }
    }
  }
  // Release A, fix 4: on 2026-11-04 Alpaca's listing left out 2 of the day's entries. An entry that should be at Alpaca but is
  // missing from the listing is fetched by its client id, so it still gets its record update and its missing-exit check. (An entry
  // older than the window read above is not "missing": item 3's lookups above take care of it.)
  let lookups = 0;
  for (const s of active) {
    if (byClientId.has(s.clientOrderId) || lookups >= MISSING_LOOKUPS_PER_SYNC) continue;
    if (createdMs(s) < fromMs) continue;
    const age = s.createdAt ? nowMs - new Date(s.createdAt).getTime() : Infinity;
    if (!(s.status === "submitted" || s.status === "filled" || (s.status === "intent" && age > MISSING_INTENT_AGE_MS))) continue;
    if ((mem.notFoundUntil.get(s.clientOrderId) ?? 0) > nowMs) continue;
    lookups++;
    try {
      const found = await d.broker.findOrderByClientId(s.clientOrderId);
      if (found) byClientId.set(s.clientOrderId, found);
      else mem.notFoundUntil.set(s.clientOrderId, nowMs + MISSING_RETRY_MS);
      d.log?.("order_missing_from_listing", { clientOrderId: s.clientOrderId, found: found !== null });
    } catch (err) {
      d.log?.("order_lookup_failed", { clientOrderId: s.clientOrderId, error: (err as Error).message.slice(0, 120) });
    }
  }
  const held = new Set(positions.map((p) => p.symbol));
  let recheckAt: number | undefined;
  const latestPerSymbol = new Map<string, OrderRecord>();
  for (const s of active) {
    const prev = latestPerSymbol.get(s.symbol);
    if (!prev || (s.createdAt ?? "") > (prev.createdAt ?? "") || ((s.createdAt ?? "") === (prev.createdAt ?? "") && s.clientOrderId > prev.clientOrderId)) latestPerSymbol.set(s.symbol, s);
  }
  // A sell already working on a symbol (a liquidation in progress) explains a missing exit: no false alarm.
  const sellingSymbols = new Set(listed.orders.filter((x) => x.side === "sell" && OPEN_STATUSES.has(x.status)).map((x) => x.symbol));
  const unprotected: string[] = [];
  for (const s of active) {
    const o = byClientId.get(s.clientOrderId);
    if (!o) continue;
    mem.lastSeen.set(s.clientOrderId, o);
    if (s.status === "intent" && o.status !== "filled" && o.status !== "canceled" && o.status !== "expired" && o.status !== "rejected") {
      await d.store.updateOrder(s.clientOrderId, { status: "submitted", alpacaOrderId: o.id, note: null });
    }
    if (o.status === "filled" && s.status !== "filled") {
      await d.store.updateOrder(s.clientOrderId, { status: "filled", filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id });
    } else if ((o.status === "canceled" || o.status === "expired") && o.filledQty === 0 && s.status !== "canceled") {
      await d.store.updateOrder(s.clientOrderId, { status: "canceled", alpacaOrderId: o.id });
    } else if ((o.status === "canceled" || o.status === "expired") && o.filledQty > 0 && s.status !== "filled") {
      // cancelled after a partial fill: what filled is a real position
      await d.store.updateOrder(s.clientOrderId, { status: "filled", filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id, note: "cancelled after a partial fill" });
    } else if (o.status === "partially_filled" && (s.filledQty ?? 0) !== o.filledQty) {
      await d.store.updateOrder(s.clientOrderId, { filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id });
    } else if (o.status === "rejected" && s.status !== "rejected") {
      await d.store.updateOrder(s.clientOrderId, { status: "rejected", alpacaOrderId: o.id, note: "rejected by Alpaca" });
      await d.say("commands", `Alpaca rejected the entry for ${s.symbol}.`);
    }
    if (!(o.filledQty > 0)) continue;
    // Closed: its exit leg has filled for the whole quantity, or the position is no longer held at all.
    // Closed: its exit leg has filled for the whole quantity, or the position is gone. "Gone" counts only when the entry order is
    // final (not still working at Alpaca) and its fill is clearly old: the orders and positions are read at nearly the same
    // moment, and an entry that fills between the two reads would otherwise look closed. An unknown fill time is treated as
    // recent unless the entry itself is more than a minute old.
    const orderFinal = o.status === "filled" || o.status === "canceled" || o.status === "expired";
    const ageMs = (iso: string | null) => (iso ? d.now().getTime() - new Date(iso).getTime() : null);
    const fillAge = ageMs(o.filledAt) ?? ageMs(s.createdAt ?? null);
    const goneForGood = !held.has(s.symbol) && orderFinal && fillAge !== null && fillAge > (o.filledAt ? 10_000 : 60_000);
    if (exitFilledQty(o) >= o.filledQty - 1e-9 || goneForGood) {
      await d.store.updateOrder(s.clientOrderId, { closedAt: d.now().toISOString() });
      mem.bareSeen.delete(s.clientOrderId);
      mem.lastSeen.delete(s.clientOrderId);
      continue;
    }
    const protectNow = typeof opts.protect === "function" ? opts.protect() : opts.protect;
    if (!protectNow || latestPerSymbol.get(s.symbol)?.clientOrderId !== s.clientOrderId || sellingSymbols.has(s.symbol)) continue;
    if (!hasLiveExit(o)) {
      unprotected.push(s.symbol);
      d.log?.("unprotected_position", { symbol: s.symbol });
      const r = await d.liquidator.flatten({ reason: "no live protective stop", tradeDate: day.tradeDate, only: [s.symbol], maxRounds: 3, yieldToPriority: true });
      if (r.yielded) d.log?.("unprotected_position_yielded", { symbol: s.symbol });
      else if (r.flat && r.sold.length > 0) await d.say("alerts", `**${s.symbol} had no live protective stop, so I sold it.**`);
      else if (r.flat) d.log?.("unprotected_position_already_gone", { symbol: s.symbol });
      else await d.say("alerts", `**Michael: ${s.symbol} HAS NO PROTECTIVE STOP AND I COULD NOT SELL IT** (${(r.errors.at(-1) ?? "still held").slice(0, 120)}). Please check Alpaca now.`, { mentionOwner: true });
      continue;
    }
    // Release A, fix 1: the take-profit is still open (so the check above passes) but the stop is gone and shares are left.
    const bare = held.has(s.symbol) ? bareRemainder(o) : null;
    if (!bare) {
      mem.bareSeen.delete(s.clientOrderId);
      continue;
    }
    const firstSeen = mem.bareSeen.get(s.clientOrderId) ?? nowMs;
    mem.bareSeen.set(s.clientOrderId, firstSeen);
    const cancelTime = bare.stop.canceledAt ?? bare.stop.updatedAt ?? null;
    const parsed = cancelTime ? Date.parse(cancelTime) : NaN;
    // Alpaca's own cancel time, never later than this worker's first sight of it (a clock that runs behind cannot add wait).
    const since = Number.isFinite(parsed) ? Math.min(parsed, firstSeen) : firstSeen;
    if (nowMs - since < BARE_GRACE_MS) {
      const due = since + BARE_GRACE_MS;
      recheckAt = recheckAt === undefined ? due : Math.min(recheckAt, due);
      // Group 1 review, round 2: the sync at the grace time must look this entry up again, even if it is older than the 10 minute read.
      mem.mustLook.add(s.clientOrderId);
      continue;
    }
    unprotected.push(s.symbol);
    d.log?.("bare_remainder", { symbol: s.symbol, shares: bare.shares, stopCancelledAt: cancelTime });
    const cancelIds = flattenLegs(o).filter((l) => l.side === "sell" && OPEN_STATUSES.has(l.status)).map((l) => l.id);
    const r = await d.liquidator.flatten({ reason: "stop cancelled after a partial take-profit", tradeDate: day.tradeDate, only: [s.symbol], maxRounds: 3, cancelIds, yieldToPriority: true });
    const soldQty = r.sold.filter((x) => x.symbol === s.symbol).reduce((n, x) => n + x.qty, 0);
    if (soldQty > 0) {
      const tp = flattenLegs(o).find((l) => l.side === "sell" && l.type === "limit");
      try {
        const sentAt = r.steps?.sells.find((x) => x.symbol === s.symbol)?.at;
        const atMs = sentAt ? Date.parse(sentAt) : NaN;
        d.onBareSale?.({ symbol: s.symbol, shares: soldQty, takeProfit: tp?.limitPrice ?? null, atMs: Number.isFinite(atMs) ? atMs : d.now().getTime() });
      } catch {
        /* a measurement must never break the sync */
      }
    }
    if (r.yielded && soldQty === 0) d.log?.("bare_remainder_yielded", { symbol: s.symbol });
    else if (r.flat && soldQty > 0) await d.say("alerts", `**${s.symbol}: Alpaca cancelled its stop when the take-profit partly filled, so I sold the remaining ${soldQty} shares.**`);
    else if (r.flat) d.log?.("bare_remainder_already_gone", { symbol: s.symbol });
    else if (soldQty > 0 && r.remaining.every((sym) => sym !== s.symbol || r.sold.some((x) => x.symbol === sym))) {
      // The sell went out and Alpaca has not filled it yet (paper has held sells 16 seconds before submitting them): not a failure.
      await d.say("alerts", `**${s.symbol}: Alpaca cancelled its stop when the take-profit partly filled.** I sent a sell for the remaining ${soldQty} shares; Alpaca has not filled it yet.`);
    } else await d.say("alerts", `**Michael: ${s.symbol} HAS NO PROTECTIVE STOP AND I COULD NOT SELL IT** (Alpaca cancelled the stop when the take-profit partly filled; ${(r.errors.at(-1) ?? "still held").slice(0, 120)}). Please check Alpaca now.`, { mentionOwner: true });
    mem.bareSeen.delete(s.clientOrderId);
  }
  if (!listed.complete) d.log?.("order_list_incomplete", { since, pages: listed.pages });
  mem.lastSyncAt = d.now().getTime();
  return { unprotected, incomplete: !listed.complete, ...(recheckAt !== undefined ? { recheckAt } : {}) };
}

// What the loss stop remembers in this process (the worker keeps one). It lets the loss stop keep selling when the stop flag
// cannot be read: without it, a database that keeps failing would make every pass fire the stop again from scratch.
export class LossStopMemory {
  firedDate: string | null = null;
  lastSaveAlert = 0;
  // The retry of a failed loss stop sale (Michael's ruling, 2026-11-03): its request budget, and the pause after a rate-limit answer.
  readonly budget = new LossStopBudget();
  backoffMs = 0;
  backoffUntil = 0;
  turn = 0; // where the next retry starts in the list of unsold symbols, so with a tight budget every symbol gets its turn
  lastRetryAlert = 0;
  awaitingFlat = false; // the first sale ended with shares still held: say so once the account is flat
}

// THE LOSS STOP'S REQUEST BUDGET: at most 60 of Alpaca's 200 requests in any minute for the loss stop's own work after a start
// (its equity check every 5 seconds, 12 a minute) and the retries of a failed sale (reads, sells, cancels), on top of which the
// retry never spends below the governor's safety reserve. Why 60: after the stop fires nothing enters, and the worker's other
// standing work (the account view every 5 seconds, settings, the order sync and the sweep) is about 35 a minute, so 60 leaves
// about 105 a minute for the close-out, Michael's flatten and stop, cancels and protective sells, more than a 40 position
// close-out asks for in its first minute (about 1 bulk cancel, 10 to 15 reads and 40 sells). The first sale when the stop fires
// is not held back (it is the stop's whole job): it is ONE round of the liquidator (cancel the exits, wait, sell each symbol),
// a bounded burst, and what Alpaca counted for it is charged to this budget afterwards, so the retries wait until it has room.
export const LOSS_STOP_REQUESTS_PER_MINUTE = 60;
export class LossStopBudget {
  private times: number[] = [];
  private readonly perMinute: number;
  constructor(perMinute = LOSS_STOP_REQUESTS_PER_MINUTE) {
    this.perMinute = perMinute;
  }
  used(nowMs: number): number {
    this.times = this.times.filter((t) => nowMs - t < 60_000);
    return this.times.length;
  }
  room(nowMs: number): number {
    return this.perMinute - this.used(nowMs);
  }
  spend(nowMs: number, n = 1): void {
    for (let i = 0; i < n; i++) this.times.push(nowMs);
  }
}
// At most this many requests in one retry check, so the minute's budget is spread over the checks instead of spent in one burst.
export const LOSS_STOP_RETRY_PER_CHECK = 15;
// From this long before the close the retry is quiet: the close-out (5 minutes before the close) sells everything still held, and
// the minute before it is left to it, so the close-out never starts on a request bucket the retry has just used.
const RETRY_QUIET_BEFORE_CLOSE_MS = 6 * 60_000;
const RETRY_BACKOFF_FIRST_MS = 10_000;
const RETRY_BACKOFF_MAX_MS = 60_000;
const is429 = (err: unknown) => err instanceof AlpacaError && err.status === 429;

export interface LossStopOptions {
  // First check after a start: also look at today's equity history at Alpaca, so a loss stop that fired (or should have) before
  // a restart is found again even if equity has since recovered and the stop flag never reached the database (round 5).
  rederive?: boolean;
}

// The lowest equity Alpaca shows for today's session after a moment (the open, or the last saved change to the stop flag,
// whichever is later, so Michael's own `resume` is respected). Null when there is no point after that moment.
export async function worstEquitySince(d: Pick<RiskDeps, "broker">, sinceMs: number): Promise<number | null> {
  const points = (await d.broker.getEquityHistoryToday()).filter((p) => p.atMs > sinceMs);
  return points.length ? Math.min(...points.map((p) => p.equity)) : null;
}

// When equity has fallen by the approved daily loss limit, stop the day: set the stop flag, sell everything.
// Runs again and again without harm (once the flag is set it does nothing new).
//
// Review round 5: the sale waits on nothing but the broker. The stop-flag write, the run-log event and every Discord post are
// started and left to finish on their own (each with its own error handling), so a database or Discord that hangs cannot hold
// the sale back, and cannot leave this task stuck so that it never runs again. The order gate still refuses entries from the
// moment the stop is decided: the caching store (caching-store.ts) believes a stop as soon as `setControl` is called, before
// its first wait, and keeps believing it until a later write succeeds. If the stop flag cannot be READ, equity is checked
// anyway and the stop fires if the line is crossed (the direction of selling).
export async function enforceDailyLoss(d: RiskDeps, day: DayRecord, opts: LossStopOptions = {}): Promise<boolean> {
  // Not before arming: until then the starting equity may be an earlier day's number.
  // (A day that is re-arming after a lowered cap counts as armed: its start equity was read at the first arming, and the loss stop
  // must not go dark while a re-arm is failing.)
  if (day.status !== "approved" || !(day.phases.armed || day.phases.rearm) || day.dayStartEquity === null) return false;
  const mem = d.lossMemory;
  let flag: StopFlag | null = null;
  let flagUnreadable = false;
  try {
    flag = await d.store.getControl<StopFlag>(CONTROL_STOP);
  } catch (err) {
    flagUnreadable = true;
    d.log?.("loss_stop_flag_unreadable", { error: (err as Error).message.slice(0, 120) });
  }
  const firedHere = mem?.firedDate === day.tradeDate;
  if (flag?.on || (flagUnreadable && firedHere)) {
    // The loss stop already fired. If its sale did not finish, try again on every pass. An owner's plain `stop` is
    // left alone: it keeps positions.
    if ((flag?.on && flag.reason.startsWith("daily loss stop")) || (flagUnreadable && firedHere)) await retryLossStopSale(d, day);
    return false;
  }
  mem?.budget.spend(d.now().getTime(), 1); // the equity check is never held back; it is counted
  const account = await d.broker.getAccount();
  try {
    d.onAccountRead?.(account);
  } catch {
    /* shadow logging must never break the loss stop */
  }
  const start = day.dayStartEquity;
  const limit = day.limits.dailyLossStopUsd;
  let loss = start - account.equity;
  let earlier: number | null = null;
  if (loss < limit && opts.rederive && day.openAt) {
    const savedAt = flag?.at ? Date.parse(flag.at) : NaN;
    const since = Math.max(day.openAt.getTime(), Number.isFinite(savedAt) ? savedAt : 0);
    const worst = await worstEquitySince(d, since);
    if (worst !== null && start - worst >= limit) {
      earlier = worst;
      loss = start - worst;
    }
  }
  if (loss < limit) return false;
  if (mem) mem.firedDate = day.tradeDate;
  const why = earlier !== null ? `daily loss stop reached earlier today (equity fell to ${earlier.toFixed(2)}, found after a restart)` : `daily loss stop reached (${loss.toFixed(2)} dollars)`;
  const flagNow: StopFlag = { on: true, at: d.now().toISOString(), reason: why };
  // Not waited on (see above). The caching store already believes the stop when this call returns.
  void d.store.setControl(CONTROL_STOP, flagNow).catch((err) => {
    const t = d.now().getTime();
    if (mem && t - mem.lastSaveAlert < 5 * 60_000) return;
    if (mem) mem.lastSaveAlert = t;
    void d.say("alerts", `**Michael: the daily loss stop was reached but the stop flag could not be saved** (${(err as Error).message.slice(0, 80)}). I sold anyway, I keep the stop in force in memory, and I keep trying to save it.`, { mentionOwner: true }).catch(() => undefined);
  });
  void d.store.addEvent("warn", "daily_loss_stop", { loss, earlier }).catch(() => undefined);
  // One round (round 8): with sells refused, the liquidator's later rounds would send every refused sell again, with fresh reads
  // each time (about 500 requests for 40 positions, more than Alpaca allows in a minute). What is still unsold after this round
  // is retried by retryLossStopSale on the next checks, every 5 seconds, inside the budget.
  const before = d.governor?.stats?.().requestsLastMinute;
  const r = await d.liquidator.flatten({ reason: "daily loss stop", tradeDate: day.tradeDate, maxRounds: 1, priority: true });
  if (mem && before !== undefined) mem.budget.spend(d.now().getTime(), Math.max(0, (d.governor!.stats!().requestsLastMinute ?? 0) - before));
  // Sells that went out but have not filled yet are not failures; only symbols with no sell sent are.
  const unsold = r.remaining.filter((sym) => !r.sold.some((x) => x.symbol === sym));
  if (mem && !r.flat) mem.awaitingFlat = true;
  const outcome = r.flat ? "sold everything" : unsold.length === 0 ? "sent a sell for every position (I will say when the account is flat)" : `sent sells, but could not sell ${unsold.join(", ")} yet (I retry only those, every 5 seconds)`;
  void d.say("commands", `**Daily loss stop reached** (down ${loss.toFixed(2)} of the ${limit} dollar limit${earlier !== null ? ", seen in today's equity history after a restart" : ""}). Stopped for the day and ${outcome}.`).catch(() => undefined);
  if (unsold.length > 0) void d.say("alerts", `**Michael: daily loss stop reached but I could not sell ${unsold.join(", ")} yet.** Check Alpaca now. I retry every 5 seconds.`, { mentionOwner: true }).catch(() => undefined);
  return true;
}

// Sells what the loss stop failed to sell (Michael's ruling, 2026-11-03): on every loss stop check (every 5 seconds), only the
// symbols still held, each with one sell through the sell gate, never another whole-account liquidation. Inside the loss stop's
// request budget and never below the governor's safety reserve, so it cannot crowd out the close-out, a flatten, a stop or a
// protective sell; it stands aside completely while any liquidation (close-out, flatten, carried position, the first sale) runs.
// It pauses only after a rate-limit answer from Alpaca (10 seconds, doubling to 60); any other refusal is simply tried again on
// the next check. Shares still held by an exit resting at Alpaca (an entry that filled late) have that exit cancelled first; the
// sale follows on the next check. A sell of ours that is still working is left alone.
async function retryLossStopSale(d: RiskDeps, day: DayRecord): Promise<void> {
  const mem = d.lossMemory ?? fallbackMemory;
  const nowMs = d.now().getTime();
  if (d.liquidator.isLiquidating()) return;
  if (nowMs < mem.backoffUntil) return;
  if (day.closeAt && nowMs >= day.closeAt.getTime() - RETRY_QUIET_BEFORE_CLOSE_MS) return;
  let spentHere = 0;
  const canSpend = (n: number) => spentHere + n <= LOSS_STOP_RETRY_PER_CHECK && mem.budget.room(nowMs) >= n && (!d.governor || d.governor.budget() - n >= SAFETY_RESERVE);
  const spend = (n: number) => {
    spentHere += n;
    mem.budget.spend(nowMs, n);
  };
  const rateLimited = () => {
    mem.backoffMs = Math.min(RETRY_BACKOFF_MAX_MS, mem.backoffMs > 0 ? mem.backoffMs * 2 : RETRY_BACKOFF_FIRST_MS);
    mem.backoffUntil = d.now().getTime() + mem.backoffMs;
    d.log?.("loss_stop_retry_backoff", { ms: mem.backoffMs });
  };
  // The cheap look first (1 request): flat means nothing to do, which is every check of a normal afternoon after the stop.
  if (!canSpend(1)) return;
  spend(1);
  let held;
  try {
    held = await d.broker.listPositions();
  } catch (err) {
    if (is429(err)) return rateLimited();
    throw err;
  }
  if (held.length === 0) {
    mem.backoffMs = 0;
    if (mem.awaitingFlat) {
      mem.awaitingFlat = false;
      void d.say("commands", "Daily loss stop: everything is sold, the account is flat.").catch(() => undefined);
    }
    return;
  }
  const gate = d.liquidator.sellGate;
  if (!canSpend(2)) return;
  spend(2);
  let view;
  try {
    gate.invalidate();
    view = await gate.look(); // open orders, then positions, as the gate checks sells against them
  } catch (err) {
    if (is429(err)) return rateLimited();
    throw err;
  }
  // A sale already working: any open market sell (ours, or one placed by hand at Alpaca) is left alone, never cancelled; only the
  // shares no sell covers are sold again.
  const ours = (o: Order) => o.side === "sell" && (o.type === "market" || o.clientOrderId.startsWith("cyrus-x-"));
  const others = view.open.filter((o) => !ours(o));
  const mine = view.open.filter(ours);
  const n = view.positions.length;
  const first = n > 0 ? mem.turn % n : 0;
  const ordered = [...view.positions.slice(first), ...view.positions.slice(0, first)];
  let sent = 0;
  let hit429 = false;
  let looked = 0;
  const failed: string[] = [];
  for (const p of ordered) {
    looked++;
    const openMine = openSellQty(mine, p.symbol);
    const openOthers = openSellQty(others, p.symbol);
    const free = Math.min(p.qty - openMine - openOthers, p.qtyAvailable ?? Infinity);
    if (free > 1e-6) {
      const cost = gate.needsRead() ? 3 : 1; // the gate reads again (2 requests) after a refused sell
      if (!canSpend(cost)) {
        looked--;
        break;
      }
      spend(cost);
      const id = `cyrus-x-${day.tradeDate.replaceAll("-", "")}-${p.symbol}-${d.now().getTime().toString(36)}-r`;
      const r = await gate.sell({ symbol: p.symbol, qty: free, clientOrderId: id, reason: "daily loss stop (retry)" });
      if (r.status === "sent") sent++;
      else {
        failed.push(p.symbol);
        if (r.status === "error" && r.httpStatus === 429) {
          hit429 = true;
          break;
        }
      }
    } else if (openOthers > 1e-6 && openMine <= 1e-6) {
      for (const id of openOrderIds(others, new Set([p.symbol]))) {
        if (!canSpend(1)) break;
        spend(1);
        try {
          await d.broker.cancelOrder(id);
        } catch (err) {
          if (is429(err)) hit429 = true;
          break;
        }
      }
      if (hit429) break;
    }
  }
  mem.turn = n > 0 ? (first + looked) % n : 0; // the next check starts where this one stopped
  if (hit429) rateLimited();
  else mem.backoffMs = 0;
  d.log?.("loss_stop_sale_retried", { held: n, sent, failed: failed.length, backoffMs: mem.backoffMs });
  // At most one nudge every 5 minutes, not one on every check.
  if (failed.length > 0 && d.now().getTime() - mem.lastRetryAlert >= 5 * 60_000) {
    mem.lastRetryAlert = d.now().getTime();
    void d.say("alerts", `**Michael: daily loss stop: selling is still failing (${failed.slice(0, 10).join(", ")}${failed.length > 10 ? ", ..." : ""}).** I retry only those every 5 seconds, inside a fixed request budget. Check Alpaca now.`, { mentionOwner: true }).catch(() => undefined);
  }
}
const fallbackMemory = new LossStopMemory();

// While the stop flag is on, cancel any entry that has not filled. This catches an entry that passed the gate's
// last look at the flag just before a stop command and reached Alpaca after the command's own cancel pass.
// Exits resting at Alpaca (sell orders) and entries that have started to fill are left alone.
export async function sweepEntriesWhileStopped(d: RiskDeps): Promise<number> {
  const flag = await d.store.getControl<StopFlag>(CONTROL_STOP);
  if (!flag?.on) return 0;
  const open = await d.broker.listOrders("open");
  let n = 0;
  for (const o of open) {
    if (o.side === "buy" && o.filledQty === 0) {
      await d.broker.cancelOrder(o.id);
      n++;
    }
  }
  if (n > 0) {
    d.log?.("entries_swept_while_stopped", { cancelled: n });
    await d.say("commands", `The stop flag is on and ${n} unfilled entr${n === 1 ? "y" : "ies"} reached Alpaca late, so I cancelled ${n === 1 ? "it" : "them"}.`);
  }
  return n;
}
