// Watching what the gate set in motion: bring the stored orders up to date from Alpaca, check that every
// filled entry still has its protective stop, and stop the day if the daily loss limit is reached.
import type { Order } from "./alpaca-trading.ts";
import type { Broker } from "./broker.ts";
import { etInstant } from "./time.ts";
import { CONTROL_STOP, type DayRecord, type StopFlag, type Store } from "./store.ts";
import { NOT_ADVICE } from "./discord.ts";

export interface RiskDeps {
  broker: Broker;
  store: Store;
  now: () => Date;
  say: (channel: "commands" | "trading" | "alerts", text: string) => Promise<boolean>;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

const DEAD_STOP = new Set(["canceled", "expired", "rejected", "replaced", "done_for_day"]);

// The protective stop leg of an entry order, if Alpaca shows one.
export function stopLeg(o: Order): Order | undefined {
  return o.legs.find((l) => l.side === "sell" && (l.type === "stop" || l.stopPrice !== null));
}

// Updates stored entries from Alpaca. A filled entry with no live stop, while the position is still held, is
// closed at once and reported: an unprotected position is not allowed to stay open.
export async function syncOrders(d: RiskDeps, day: DayRecord): Promise<{ unprotected: string[] }> {
  const stored = (await d.store.listOrders(day.tradeDate)).filter((o) => o.status === "intent" || o.status === "submitted" || o.status === "filled");
  if (stored.length === 0) return { unprotected: [] };
  const [orders, positions] = await Promise.all([d.broker.listOrders("all", etInstant(day.tradeDate, "00:00").toISOString()), d.broker.listPositions()]);
  const byClientId = new Map(orders.map((o) => [o.clientOrderId, o]));
  const held = new Set(positions.map((p) => p.symbol));
  const unprotected: string[] = [];
  for (const s of stored) {
    const o = byClientId.get(s.clientOrderId);
    if (!o) continue;
    if (s.status === "intent" && o.status !== "filled" && o.status !== "canceled" && o.status !== "expired" && o.status !== "rejected") {
      await d.store.updateOrder(s.clientOrderId, { status: "submitted", alpacaOrderId: o.id, note: null });
    }
    if (o.status === "filled" && s.status !== "filled") {
      await d.store.updateOrder(s.clientOrderId, { status: "filled", filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id });
    } else if ((o.status === "canceled" || o.status === "expired") && s.status !== "canceled" && o.filledQty === 0) {
      await d.store.updateOrder(s.clientOrderId, { status: "canceled", alpacaOrderId: o.id });
    } else if (o.status === "rejected" && s.status !== "rejected") {
      await d.store.updateOrder(s.clientOrderId, { status: "rejected", alpacaOrderId: o.id, note: "rejected by Alpaca" });
      await d.say("commands", `Alpaca rejected the entry for ${s.symbol}.`);
    }
    // A sell that is already working (flatten, loss stop, close-out) explains a missing stop: no false alarm.
    const selling = orders.some((x) => x.side === "sell" && x.symbol === s.symbol && ["new", "accepted", "pending_new", "partially_filled"].includes(x.status));
    if (o.filledQty > 0 && held.has(s.symbol) && !selling) {
      const leg = stopLeg(o);
      if (!leg || DEAD_STOP.has(leg.status)) {
        unprotected.push(s.symbol);
        d.log?.("unprotected_position", { symbol: s.symbol });
        try {
          await d.broker.closePosition(s.symbol);
          await d.say("alerts", `**${s.symbol} had no live protective stop, so I sold it.** ${NOT_ADVICE}`);
        } catch (err) {
          await d.say("alerts", `**${s.symbol} HAS NO PROTECTIVE STOP AND I COULD NOT SELL IT** (${(err as Error).message.slice(0, 120)}). Please check Alpaca now.`);
        }
      }
    }
  }
  return { unprotected };
}

// When equity has fallen by the approved daily loss limit, stop the day: set the stop flag, sell everything.
// Runs again and again without harm (once the flag is set it does nothing).
export async function enforceDailyLoss(d: RiskDeps, day: DayRecord): Promise<boolean> {
  // Not before arming: until then the starting equity may be an earlier day's number.
  if (day.status !== "approved" || !day.phases.armed || day.dayStartEquity === null) return false;
  const flag = await d.store.getControl<StopFlag>(CONTROL_STOP);
  if (flag?.on) {
    // The loss stop already fired. If its sale did not go through, try again on every pass (a sell that is
    // already working counts as going through). An owner's plain `stop` is left alone: it keeps positions.
    if (flag.reason.startsWith("daily loss stop")) await retryLossStopSale(d);
    return false;
  }
  const account = await d.broker.getAccount();
  const loss = day.dayStartEquity - account.equity;
  if (loss < day.limits.dailyLossStopUsd) return false;
  const flagNow: StopFlag = { on: true, at: d.now().toISOString(), reason: `daily loss stop reached (${loss.toFixed(2)} dollars)` };
  await d.store.setControl(CONTROL_STOP, flagNow);
  await d.store.addEvent("warn", "daily_loss_stop", { loss });
  try {
    await d.broker.closeAllPositions();
  } catch (err) {
    await d.say("alerts", `Daily loss stop reached but selling failed: ${(err as Error).message.slice(0, 120)}. Check Alpaca now.`);
  }
  await d.say("commands", `**Daily loss stop reached** (down ${loss.toFixed(2)} of the ${day.limits.dailyLossStopUsd} dollar limit). Stopped for the day and sent orders to sell everything. ${NOT_ADVICE}`);
  return true;
}

const WORKING = ["new", "accepted", "pending_new", "partially_filled"];

// Sells what the loss stop failed to sell. Does nothing when the account is flat or a sell is already working.
async function retryLossStopSale(d: RiskDeps): Promise<void> {
  const [positions, open] = await Promise.all([d.broker.listPositions(), d.broker.listOrders("open")]);
  if (positions.length === 0) return;
  const selling = open.some((o) => o.side === "sell" && WORKING.includes(o.status) && o.type !== "stop");
  if (selling) return;
  try {
    await d.broker.closeAllPositions();
    d.log?.("loss_stop_sale_retried", { positions: positions.length });
  } catch (err) {
    await d.say("alerts", `Daily loss stop: selling is still failing (${(err as Error).message.slice(0, 120)}). Check Alpaca now.`);
  }
}

// While the stop flag is on, cancel any entry that has not filled. This catches an entry that passed the gate's
// last look at the flag just before a stop command and reached Alpaca after the command's own cancel pass.
// Protective stops (sell orders) and entries that have started to fill are left alone.
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
