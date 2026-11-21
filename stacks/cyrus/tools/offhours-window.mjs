// The off-hours deploy's time window (offhours-deploy.mjs), pure so it can be tested. Refused (each reason returned):
//   - Alpaca's clock does not say closed (CLAUDE.md: never deploy during market hours);
//   - market hours by the day record (from its open to its close);
//   - Michael's ruling of 2026-11-21 (afternoon): "the off-hours checker refuses from 8:00 AM Central until the open on trading days". Two
//     sources, so a missing day record cannot open the window: the day record (from 30 minutes before its open, 8:00 AM CT on a normal day,
//     to its open) and Alpaca's clock (closed with the next open 30 minutes away or less, or no next open given).
// `clock`: Alpaca's /v2/clock answer ({ is_open, next_open }). `today`: today's day record ({ is_trading_day, open_at, close_at }) or null.
// Paper only; reads nothing itself.
export const CUTOFF_BEFORE_OPEN_MS = 30 * 60_000;

export function offhoursWindowProblems(now, clock, today) {
  const problems = [];
  const t = now.getTime();
  if (!clock || clock.is_open !== false) problems.push("Alpaca's clock does not say closed");
  const openMs = today?.open_at ? new Date(today.open_at).getTime() : NaN;
  const closeMs = today?.close_at ? new Date(today.close_at).getTime() : NaN;
  if (today?.is_trading_day && Number.isFinite(openMs) && Number.isFinite(closeMs)) {
    if (t >= openMs && t < closeMs) problems.push("market hours by the day record");
    if (t >= openMs - CUTOFF_BEFORE_OPEN_MS && t < openMs) problems.push("from 8:00 AM Central until the open by the day record (Michael, 2026-11-21)");
  }
  const nextOpenMs = Date.parse(clock?.next_open ?? "");
  if (clock?.is_open === false) {
    if (!Number.isFinite(nextOpenMs)) problems.push("Alpaca's clock gave no next open time");
    else if (nextOpenMs - t <= CUTOFF_BEFORE_OPEN_MS) problems.push("Alpaca's next open is 30 minutes away or less (Michael, 2026-11-21: no deploy from 8:00 AM Central until the open)");
  }
  return problems;
}
