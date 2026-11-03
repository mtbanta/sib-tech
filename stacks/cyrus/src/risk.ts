// Watching what the gate set in motion: bring the stored entries up to date from Alpaca, check that every open
// entry still has a live exit resting at Alpaca, and stop the day if the daily loss limit is reached.
import type { Order } from "./alpaca-trading.ts";
import type { Broker } from "./broker.ts";
import { etInstant } from "./time.ts";
import { CONTROL_STOP, type DayRecord, type OrderRecord, type StopFlag, type Store } from "./store.ts";
import { OPEN_STATUSES, flattenLegs, type Liquidator, type Say } from "./sells.ts";

export interface RiskDeps {
  broker: Broker;
  store: Store;
  now: () => Date;
  say: Say;
  liquidator: Liquidator;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // Optional: the worker passes its own, so the loss stop remembers that it fired even when the stop flag cannot be read.
  lossMemory?: LossStopMemory;
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
}

// Updates stored entries from Alpaca by looking only at orders newer than the oldest entry still being watched
// (paged, so a day with thousands of orders is read in full). An entry is judged by its OWN order and its OWN exit
// legs, never by symbol, because a symbol can be entered again after the first position closed.
// An open entry with no live exit while its position is still held is sold at once and reported.
export async function syncOrders(d: RiskDeps, day: DayRecord, opts: SyncOptions = { protect: true }): Promise<{ unprotected: string[]; incomplete: boolean }> {
  const active = (await d.store.listOrders(day.tradeDate)).filter((o) => !o.closedAt && (o.status === "intent" || o.status === "submitted" || o.status === "filled"));
  if (active.length === 0) return { unprotected: [], incomplete: false };
  const midnight = etInstant(day.tradeDate, "00:00").getTime();
  const oldest = Math.min(...active.map((o) => (o.createdAt ? new Date(o.createdAt).getTime() : midnight)));
  const since = new Date(Math.max(midnight, oldest - 60_000)).toISOString();
  const [listed, positions] = await Promise.all([d.broker.listOrdersPaged("all", since), d.broker.listPositions()]);
  const byClientId = new Map(listed.orders.map((o) => [o.clientOrderId, o]));
  const held = new Set(positions.map((p) => p.symbol));
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
      continue;
    }
    const protectNow = typeof opts.protect === "function" ? opts.protect() : opts.protect;
    if (!protectNow || latestPerSymbol.get(s.symbol)?.clientOrderId !== s.clientOrderId || sellingSymbols.has(s.symbol)) continue;
    if (!hasLiveExit(o)) {
      unprotected.push(s.symbol);
      d.log?.("unprotected_position", { symbol: s.symbol });
      const r = await d.liquidator.flatten({ reason: "no live protective stop", tradeDate: day.tradeDate, only: [s.symbol], maxRounds: 3 });
      if (r.flat && r.sold.length > 0) await d.say("alerts", `**${s.symbol} had no live protective stop, so I sold it.**`);
      else if (r.flat) d.log?.("unprotected_position_already_gone", { symbol: s.symbol });
      else await d.say("alerts", `**Michael: ${s.symbol} HAS NO PROTECTIVE STOP AND I COULD NOT SELL IT** (${(r.errors.at(-1) ?? "still held").slice(0, 120)}). Please check Alpaca now.`, { mentionOwner: true });
    }
  }
  if (!listed.complete) d.log?.("order_list_incomplete", { since, pages: listed.pages });
  return { unprotected, incomplete: !listed.complete };
}

// What the loss stop remembers in this process (the worker keeps one). It lets the loss stop keep selling when the stop flag
// cannot be read: without it, a database that keeps failing would make every pass fire the stop again from scratch.
export class LossStopMemory {
  firedDate: string | null = null;
  lastSaveAlert = 0;
}

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
  const account = await d.broker.getAccount();
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
  const r = await d.liquidator.flatten({ reason: "daily loss stop", tradeDate: day.tradeDate });
  void d.say("commands", `**Daily loss stop reached** (down ${loss.toFixed(2)} of the ${limit} dollar limit${earlier !== null ? ", seen in today's equity history after a restart" : ""}). Stopped for the day and ${r.flat ? "sold everything" : `sent sells, but still held: ${r.remaining.join(", ")}`}.`).catch(() => undefined);
  if (!r.flat) void d.say("alerts", `**Michael: daily loss stop reached but still holding ${r.remaining.join(", ")}.** Check Alpaca now. I will keep trying.`, { mentionOwner: true }).catch(() => undefined);
  return true;
}

// Sells what the loss stop failed to sell. Does nothing when the account is flat or a market sell is already working.
async function retryLossStopSale(d: RiskDeps, day: DayRecord): Promise<void> {
  const [positions, open] = await Promise.all([d.broker.listPositions(), d.broker.listOrders("open")]);
  if (positions.length === 0) return;
  const selling = open.some((o) => o.side === "sell" && OPEN_STATUSES.has(o.status) && o.type === "market");
  if (selling) return;
  const r = await d.liquidator.flatten({ reason: "daily loss stop (retry)", tradeDate: day.tradeDate });
  d.log?.("loss_stop_sale_retried", { positions: positions.length, flat: r.flat });
  // At most one nudge every 5 minutes, not one on every pass.
  if (!r.flat && d.now().getTime() - lastLossRetryAlert >= 5 * 60_000) {
    lastLossRetryAlert = d.now().getTime();
    await d.say("alerts", `**Michael: daily loss stop: selling is still failing (${r.remaining.join(", ")}).** Check Alpaca now.`, { mentionOwner: true });
  }
}
let lastLossRetryAlert = 0;

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
