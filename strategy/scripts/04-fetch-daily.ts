// Step 4: daily bars (split-adjusted, not dividend-adjusted, "sip" feed) for each period's candidates,
// plus SPY and QQQ. Window: 15 calendar days before the period (for the first day's overnight gap)
// to the period's last day. Cached one file per symbol in data/raw/daily/<period>/.
// Usage: node scripts/04-fetch-daily.ts B C D   (periods to fetch)
import { join } from "node:path";
import { DATA, exists, readJson, writeJson } from "./common.ts";
import { bars } from "./alpaca-data.ts";
import { PERIODS, ALPACA_FLOOR, type PeriodId } from "./periods.ts";

export function dailyWindow(p: PeriodId) {
  const { from, to } = PERIODS[p];
  const start0 = new Date(Date.parse(from) - 15 * 864e5).toISOString().slice(0, 10);
  return { start: start0 < ALPACA_FLOOR ? ALPACA_FLOOR : start0, end: to };
}
const safe = (s: string) => s.replace(/\./g, "_");
export const dailyFile = (p: PeriodId, s: string) => join(DATA, "raw", "daily", p, safe(s) + ".json");

if (import.meta.url === `file://${process.argv[1]}`) {
  const cands = readJson<Record<PeriodId, string[]>>(join(DATA, "work", "candidates.json"));
  const which = (process.argv.slice(2).length ? process.argv.slice(2) : ["B", "C", "D", "A"]) as PeriodId[];
  const CH = 200;
  for (const p of which) {
    const { start, end } = dailyWindow(p);
    const todo = [...new Set(["SPY", "QQQ", ...cands[p]])].sort().filter(s => !exists(dailyFile(p, s)));
    console.log(p, "symbols to fetch", todo.length);
    for (let i = 0; i < todo.length; i += CH) {
      const chunk = todo.slice(i, i + CH);
      const r = await bars(chunk, { timeframe: "1Day", start, end, adjustment: "split", feed: "sip" });
      for (const s of chunk) writeJson(dailyFile(p, s), r[s] ?? []);
      console.log(new Date().toISOString(), p, "chunk", i / CH + 1, "of", Math.ceil(todo.length / CH));
    }
  }
  console.log("done");
}
