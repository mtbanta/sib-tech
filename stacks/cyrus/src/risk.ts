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

// When equity has fallen by the approved daily loss limit, stop the day: set the stop flag, sell everything.
// Runs again and again without harm (once the flag is set it does nothing new).
export async function enforceDailyLoss(d: RiskDeps, day: DayRecord): Promise<boolean> {
  // Not before arming: until then the starting equity may be an earlier day's number.
  // (A day that is re-arming after a lowered cap counts as armed: its start equity was read at the first arming, and the loss stop
  // must not go dark while a re-arm is failing.)
  if (day.status !== "approved" || !(day.phases.armed || day.phases.rearm) || day.dayStartEquity === null) return false;
  const flag = await d.store.getControl<StopFlag>(CONTROL_STOP);
  if (flag?.on) {
    // The loss stop already fired. If its sale did not finish, try again on every pass. An owner's plain `stop` is
    // left alone: it keeps positions.
    if (flag.reason.startsWith("daily loss stop")) await retryLossStopSale(d, day);
    return false;
  }
  const account = await d.broker.getAccount();
  const loss = day.dayStartEquity - account.equity;
  if (loss < day.limits.dailyLossStopUsd) return false;
  const flagNow: StopFlag = { on: true, at: d.now().toISOString(), reason: `daily loss stop reached (${loss.toFixed(2)} dollars)` };
  // Selling does not wait on the database: if the stop flag cannot be saved the stack still sells (the caching store already
  // believes the flag), and says so.
  try {
    await d.store.setControl(CONTROL_STOP, flagNow);
  } catch (err) {
    await d.say("alerts", `**Michael: the daily loss stop was reached but the stop flag could not be saved** (${(err as Error).message.slice(0, 80)}). Selling anyway.`, { mentionOwner: true });
  }
  await d.store.addEvent("warn", "daily_loss_stop", { loss }).catch(() => undefined);
  const r = await d.liquidator.flatten({ reason: "daily loss stop", tradeDate: day.tradeDate });
  await d.say("commands", `**Daily loss stop reached** (down ${loss.toFixed(2)} of the ${day.limits.dailyLossStopUsd} dollar limit). Stopped for the day and ${r.flat ? "sold everything" : `sent sells, but still held: ${r.remaining.join(", ")}`}.`);
  if (!r.flat) await d.say("alerts", `**Michael: daily loss stop reached but still holding ${r.remaining.join(", ")}.** Check Alpaca now. I will keep trying.`, { mentionOwner: true });
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
