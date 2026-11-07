// EARLY WAKE-UPS (the speed release, item 9, limited by Michael's decision of 2026-11-06 after group 1 review round 2). A sale's wait for
// its cancels, its fills, and the close-out's wait for its own sells end early at a live order update for their symbols, so the next
// look comes at once. Each such look costs Alpaca requests (open orders and positions). In the simulator, with Alpaca's updates spread
// out over their delays, those extra looks pushed a full flatten into rate-limit answers from 5 open positions (group 1 review, round 2;
// v10 already from 12). So:
//   - an update ends a wait early only while Alpaca's request budget is at least EARLY_LOOK_HEADROOM above the reserve in force;
//     otherwise it is ignored and the wait runs to its timed look (the backstop it always had);
//   - at most MAX_EARLY_WAKES early wake-ups in one wait-loop (a liquidation's, or the close-out's), down from 20.
// It only decides WHEN the next look happens; it never sends, cancels or sizes anything.
export const EARLY_LOOK_HEADROOM = 20;
export const MAX_EARLY_WAKES = 5;

export function earlyLookAllowed(budget: number, reserve: number): boolean {
  return Number.isFinite(budget) && budget >= reserve + EARLY_LOOK_HEADROOM;
}
