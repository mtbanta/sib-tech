// Run 3 probe 2: the evidence for the half-day rule in r3-08-time-of-day.ts (deliverable section 3.6).
// Reads the cached SPY 1 minute bars of each period (no network calls) and prints, per period:
//  - how many days have all 390 regular-session bars (9:30 to 15:59 Eastern);
//  - every day with fewer, with its afternoon ratio (volume 13:01 to 15:59 divided by 9:30 to 12:59);
//  - the three lowest afternoon ratios among days with all 390 bars.
// Usage, from strategy/: node scripts/probes/r3-probe-2-half-days.ts
import { loadMinutes, et } from "../r3-08-time-of-day.ts";

let total = 0, full390 = 0;
for (const p of ["A", "B", "C", "D"]) {
  const bars = loadMinutes(p, "SPY");
  if (!bars) { console.log(p, "no SPY minute file"); continue; }
  const by: Record<string, { n: number; am: number; pm: number }> = {};
  for (const b of bars) {
    const e = et(b[0]);
    if (e.m < 570 || e.m >= 960) continue; // regular session only, 16:00 closing auction bar left out
    const o = (by[e.d] ??= { n: 0, am: 0, pm: 0 });
    o.n++;
    if (e.m < 780) o.am += b[5]; else if (e.m > 780) o.pm += b[5];
  }
  const days = Object.entries(by);
  const ratio = (o: { am: number; pm: number }) => o.am ? o.pm / o.am : 0;
  const all = days.filter(([, o]) => o.n === 390);
  total += days.length; full390 += all.length;
  console.log(`period ${p}: ${days.length} days with regular-session bars, ${all.length} with all 390`);
  for (const [d, o] of days.filter(([, o]) => o.n < 390)) console.log(`  ${d}  bars ${o.n}  afternoon ratio ${ratio(o).toFixed(2)}  ${o.n < 390 && ratio(o) < 0.5 ? "half day" : "full day"}`);
  const low = all.map(([d, o]) => [d, ratio(o)] as [string, number]).sort((a, b) => a[1] - b[1]).slice(0, 3);
  console.log(`  lowest ratios on 390-bar days: ${low.map(([d, r]) => `${d} ${r.toFixed(2)}`).join(", ")}`);
}
console.log(`all periods: ${full390} of ${total} days with all 390 bars`);
