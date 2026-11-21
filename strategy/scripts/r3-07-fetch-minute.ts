// Run 3 step 7 (change 6): 1 minute bars from Alpaca's market data host (free plan, "sip" feed, split adjusted),
// for every run 3 winner over its measured window, and for SPY and QQQ over each whole period.
// Stored compact and gzip-compressed, one file per symbol per period: data/raw/minute/<P>/<SYM>.json.gz,
// holding [unix seconds, open, high, low, close, volume] for every bar Alpaca returns (all sessions).
// Each file is written to a temporary name and renamed when complete, so an interrupted file is never
// mistaken for a finished one. Progress goes to data/work/r3/minute-progress.txt; a finished run writes
// data/work/r3/minute-done.txt. Usage: node scripts/r3-07-fetch-minute.ts [maxMinutes] (default 600).
import { join } from "node:path";
import { writeFileSync, renameSync, appendFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { DATA, ensureDir, exists, readJson } from "./common.ts";
import { get } from "./alpaca-data.ts";
import { WORK3, removalReasons, minuteFile } from "./r3-common.ts";
import type { PeriodId } from "./periods.ts";

const maxMin = Number(process.argv[2] ?? 600);
const deadline = Date.now() + maxMin * 60000; // the job stops itself after this many minutes
const nextDay = (d: string) => new Date(Date.parse(d + "T12:00:00Z") + 864e5).toISOString().slice(0, 10);

type Job = { p: PeriodId; s: string; start: string; end: string };
const jobs: Job[] = [];
for (const p of ["B", "C", "D", "A"] as PeriodId[]) {
  const f = join(WORK3, `period-${p}.json`); if (!exists(f)) continue;
  const j = readJson(f);
  for (const s of ["SPY", "QQQ"]) jobs.push({ p, s, start: j.first, end: j.last });
  for (const w of j.winners) if (removalReasons(w.flags).length === 0) jobs.push({ p, s: w.symbol, start: w.start, end: w.end });
}
const progress = join(WORK3, "minute-progress.txt");
let done = 0, skipped = 0, requests = 0, bars = 0;
for (const job of jobs) {
  if (Date.now() > deadline) { appendFileSync(progress, `${new Date().toISOString()} stopped at time limit\n`); process.exit(0); }
  const file = minuteFile(job.p, job.s);
  if (exists(file)) { skipped++; continue; }
  const out: number[][] = [];
  let token: string | undefined;
  do {
    const r = await get("/v2/stocks/bars", { symbols: job.s, timeframe: "1Min", start: job.start + "T00:00:00Z", end: nextDay(job.end) + "T00:00:00Z", adjustment: "split", feed: "sip", limit: 10000, page_token: token });
    requests++;
    for (const b of (r.bars?.[job.s] ?? []) as any[]) out.push([Date.parse(b.t) / 1000, b.o, b.h, b.l, b.c, b.v]);
    token = r.next_page_token ?? undefined;
  } while (token);
  ensureDir(join(DATA, "raw", "minute", job.p));
  writeFileSync(file + ".tmp", gzipSync(JSON.stringify(out)));
  renameSync(file + ".tmp", file);
  done++; bars += out.length;
  if (done % 10 === 0) writeFileSync(progress, `${new Date().toISOString()} files done ${done}, skipped (cached) ${skipped}, of ${jobs.length}; requests ${requests}; bars ${bars}\n`);
}
writeFileSync(progress, `${new Date().toISOString()} files done ${done}, skipped ${skipped}, of ${jobs.length}; requests ${requests}; bars ${bars}\n`);
writeFileSync(join(WORK3, "minute-done.txt"), `finished ${new Date().toISOString()} jobs ${jobs.length}\n`);
console.log("done", done, "skipped", skipped, "requests", requests, "bars", bars);
