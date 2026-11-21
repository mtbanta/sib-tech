// THE EXIT PAIR (Michael's approval of 2026-11-21, with his answers; proposal builds/c2-proposal-2026-11-21-exit-pair.md).
//
// After a partial take-profit Alpaca cancels the bracket's stop; since A4 of 2026-11-12 the stack cancels the take-profit's rest and places a
// fresh stop alone (cyrus-p-) on the shares left. With the day's switch on (`pair on`), it places an exit pair there instead: one OCO order
// ("one cancels other") of two sells on the same shares, a limit at the bracket's ORIGINAL take-profit price (answer 1, which updates
// Michael's ruling of 2026-11-12 for remainders) and a stop at the bracket's stop price; when one fills Alpaca cancels the other. A
// close-out can then move the pair's limit to the bid less 1 cent, as it moves a bracket's take-profit, and the shares keep their stop until
// they sell.
//
//   - Answer 2: the pair refused (a definite refusal) -> today's plain fresh stop at once (one more request, its own client id); that refused
//     too -> the market sale, as today. An unclear answer at any step stops the chain (no second order on top of one that may exist): an
//     unclear pair is looked up by its client id under ruling B's 15 second limit, as an unclear fresh stop is.
//   - Answer 3: the pair's take-profit fills only part (or Alpaca shows its stop leg ended while shares are left) -> the rest of the pair is
//     cancelled and the shares are sold at market, by the missing-exit sale. No second pair.
//   - Answer 4: `pair on` / `pair off` in `commands`, stored in that day's record (day phase EXIT_PAIR_PHASE), so it is off on every new
//     trading day and survives a restart the same day. It affects only remainders protected after it is switched on; pairs already placed
//     stay protected and are still moved at a close-out after `pair off`.
//
// What Alpaca does with a pair is not measured on paper yet (Monday 2026-11-23's trials, tools/pair-trials.mjs, check it before Michael
// switches it on). The code recognises a pair by its order class ("oco") or, should Alpaca's list leave the class out, by our own client id
// prefix (cyrus-p-) on a limit sell (a plain fresh stop is a stop order).
//
// Research input for a human decision, never an instruction to act. Paper trading only.
import type { DayRecord } from "./store.ts";
import type { Order } from "./alpaca-trading.ts";

export const EXIT_PAIR_PHASE = "exitPair";

// The day's switch: on only when that day's record says so (the record of another day never carries it over).
export function exitPairOn(day: Pick<DayRecord, "phases"> | null | undefined): boolean {
  return day?.phases?.[EXIT_PAIR_PHASE] === "on";
}

// Statuses in which an order can still execute (the same set as sells.ts OPEN_STATUSES, repeated here so this module imports nothing at
// run time and can be used by every module without a cycle).
const OPEN = new Set(["new", "accepted", "pending_new", "partially_filled", "held", "pending_replace", "pending_cancel", "accepted_for_bidding", "calculated"]);

// An exit pair's parent (the take-profit limit; Alpaca lists the stop as its child). Only the limit: the stop leg carries the class "oco" too.
export function isExitPair(o: Pick<Order, "side" | "orderClass" | "clientOrderId" | "type">): boolean {
  return o.side === "sell" && o.type === "limit" && (o.orderClass === "oco" || o.clientOrderId.startsWith("cyrus-p-"));
}

// The pair's stop leg, when Alpaca's answer or list shows it.
export function pairStopLeg(o: Pick<Order, "legs">): Order | undefined {
  return o.legs.find((l) => l.side === "sell" && (l.type === "stop" || l.type === "stop_limit" || (l.stopPrice !== null && l.stopPrice > 0)));
}

// Answer 3: a pair that no longer protects all its shares: its take-profit has filled part, or the stop leg it shows has ended (cancelled,
// expired, rejected) while the pair is still open. A filled or ended pair is not "broken": its shares are gone or the pair is simply gone.
export function pairBroken(o: Order): boolean {
  if (!isExitPair(o) || !OPEN.has(o.status)) return false;
  if (o.filledQty > 1e-9) return true;
  const leg = pairStopLeg(o);
  return leg !== undefined && !OPEN.has(leg.status) && leg.status !== "filled";
}

// The take-profit price for a remainder's pair: the bracket's own take-profit leg (as Alpaca holds it), else the stored entry's
// take-profit. Null when neither is known or the pair could not be sent (Alpaca wants the stop at least 1 cent below the limit, after both
// are rounded down to the cent as the client sends them).
export function pairTakeProfitFor(entry: Pick<Order, "legs">, storedTakeProfit: number | null | undefined, stopPrice: number): number | null {
  const leg = entry.legs.find((l) => l.side === "sell" && l.type === "limit" && l.limitPrice !== null && l.limitPrice > 0);
  const tp = leg?.limitPrice ?? (storedTakeProfit != null && storedTakeProfit > 0 ? storedTakeProfit : null);
  if (tp === null || !Number.isFinite(tp) || !(stopPrice > 0)) return null;
  const c = (x: number) => Math.floor(x * 100 + 1e-9);
  return c(tp) - c(stopPrice) >= 1 ? tp : null;
}
