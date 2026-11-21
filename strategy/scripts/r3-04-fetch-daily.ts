// Run 3 step 4: daily bars for the 3x screen's candidates that run 1 did not fetch. Same window, feed,
// adjustment and cache folder as run 1's step 4 (data/raw/daily/<period>/), so run 1's files are reused.
// Writes each file whole after its chunk completes. Usage: node scripts/r3-04-fetch-daily.ts B C D A
import { join } from "node:path";
import { exists, readJson, writeJson } from "./common.ts";
import { bars } from "./alpaca-data.ts";
import { dailyWindow, dailyFile } from "./04-fetch-daily.ts";
import { WORK3 } from "./r3-common.ts";
import type { PeriodId } from "./periods.ts";

const cands = readJson<Record<PeriodId, string[]>>(join(WORK3, "candidates.json"));
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
