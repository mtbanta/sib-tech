// Run 3 probe 1: (a) where the closing auction volume lands in Alpaca's 1 minute bars, by comparing the
// sum of regular-session minute volume (9:30 to 15:59 Eastern), the 16:00 bar, and the daily bar's volume;
// (b) bars per day and bytes per bar for the minute pull estimate. Market data host only, read-only.
// Usage: node strategy/scripts/probes/r3-probe-1-minute-bars.ts
import { get } from "../alpaca-data.ts";
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const cases = [["SPY", "2021-06-15"], ["SPY", "2024-03-12"], ["KIRK", "2021-06-15"], ["INOD", "2024-03-12"], ["AXTI", "2026-03-10"]];
for (const [s, d] of cases) {
  const m = await get("/v2/stocks/bars", { symbols: s, timeframe: "1Min", start: d + "T00:00:00Z", end: d + "T23:59:59Z", adjustment: "split", feed: "sip", limit: 10000 });
  const day = await get("/v2/stocks/bars", { symbols: s, timeframe: "1Day", start: d, end: d, adjustment: "split", feed: "sip" });
  const bars = m.bars?.[s] ?? [];
  let reg = 0, at16 = 0, pre = 0, post = 0, nReg = 0;
  for (const b of bars) { const [h, mi] = fmt.format(new Date(b.t)).split(":").map(Number); const t = h * 60 + mi;
    if (t >= 570 && t < 960) { reg += b.v; nReg++; } else if (t === 960) at16 += b.v; else if (t < 570) pre += b.v; else post += b.v; }
  const dv = day.bars?.[s]?.[0]?.v ?? null;
  console.log(`${s} ${d}: bars ${bars.length} (regular ${nReg}); bytes per bar ${(JSON.stringify(bars).length / Math.max(1, bars.length)).toFixed(0)}; daily volume ${dv}; regular-minute sum ${reg} (${dv ? (100 * reg / dv).toFixed(1) : "?"}%); 16:00 bar ${at16} (${dv ? (100 * at16 / dv).toFixed(1) : "?"}%); regular + 16:00 ${dv ? (100 * (reg + at16) / dv).toFixed(1) : "?"}%; pre ${pre}, post (after 16:00) ${post}`);
}
