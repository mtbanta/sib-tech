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
  if (day.status !== "approved" || day.dayStartEquity === null) return false;
  const flag = await d.store.getControl<StopFlag>(CONTROL_STOP);
  if (flag?.on) return false;
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
