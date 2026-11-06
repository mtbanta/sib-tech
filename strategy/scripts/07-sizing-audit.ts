// Step 7 (runs before step 6): (a) run 2 sizing estimates for 1 minute bars, per period and gain group;
// (b) audit lists printed for a human read (possible SPAC shells, heuristic starts, wrong company,
// market cap against price multiple); (c) survivorship gap counts. Writes data/work/run2-sizing.json,
// data/work/audit-<P>.txt and data/work/gaps.json. No network calls.
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { DATA, exists, readJson, writeJson } from "./common.ts";
import { PERIODS, type PeriodId } from "./periods.ts";

// Measured 2026-11-05: AAPL 1 minute bars, 2024-03-12 regular session (391 bars): 110 bytes each as Alpaca JSON, 78 as CSV.
const BYTES_JSON = 110, BYTES_CSV = 78, MIN_PER_DAY = 390, BARS_PER_PAGE = 10000, REQ_PER_MIN = 200;
const IDS = (["A", "B", "C", "D"] as PeriodId[]).filter(p => exists(join(DATA, "work", `period-${p}.json`)));
const sizing: any = {};
const gaps: any = {};
const ftdAll = readJson<Record<string, { d: string; cusip: string; first: string; last: string }[]>>(join(DATA, "work", "ftd-index.json"));
const kept = new Set(Object.keys(readJson(join(DATA, "work", "monthly-index.json")).duplicates));

for (const p of IDS) {
  const j = readJson(join(DATA, "work", `period-${p}.json`));
  const W = j.winners as any[];
  sizing[p] = {};
  for (const g of ["4x", "5x", "6x+", "all"]) {
    const a = g === "all" ? W : W.filter(w => w.group === g);
    const days = a.reduce((x, w) => x + w.days, 0);
    const rows = days * MIN_PER_DAY; // upper bound: regular session only, every minute traded
    const requests = a.reduce((x, w) => x + Math.max(1, Math.ceil(w.days * MIN_PER_DAY / BARS_PER_PAGE)), 0);
    sizing[p][g] = { winners: a.length, winner_days: days, rows_upper: rows, mb_json: rows * BYTES_JSON / 1e6, mb_csv: rows * BYTES_CSV / 1e6, requests, minutes_at_limit: requests / REQ_PER_MIN };
  }
  // Audit lists.
  const out: string[] = [`Audit, period ${p} (${PERIODS[p].label})`, ""];
  const line = (w: any) => `${w.symbol.padEnd(7)} ${w.ratio.toFixed(2).padStart(7)} ${w.start} ${w.end} open ${w.start_open} | ${String(w.name).slice(0, 40)} | ${w.flags.join("; ")}`;
  out.push("Possible SPAC shells (start open 9 to 11.5, no shell merger found):");
  for (const w of W) if (w.start_open >= 9 && w.start_open <= 11.5 && !w.flags.some((f: string) => /shell merger/.test(f))) out.push("  " + line(w));
  out.push("", "Heuristic starts (moved exchange, new shares, bankruptcy):");
  for (const w of W) if (w.flags.some((f: string) => /moved exchange|new shares/.test(f))) out.push("  " + line(w));
  out.push("", "Market cap ratio differs from price multiple by more than 3x either way:");
  for (const w of W) if (w.cap_start && w.cap_end) { const r = (w.cap_end / w.cap_start) / w.ratio; if (r > 3 || r < 1 / 3) out.push(`  ${line(w)} | cap ratio / multiple = ${r.toFixed(2)}`); }
  out.push("", "Unknown exchange, 4x or more (possible winners, exchange not confirmed):");
  for (const e of j.otherExchange) if (e.exchange === "unknown") out.push("  " + line(e));
  writeFileSync(join(DATA, "work", `audit-${p}.txt`), out.join("\n") + "\n");

  // Survivorship gaps: symbols whose fails-to-deliver record in the period has a different issuer code from
  // the record nearest today (an earlier company's history is not reachable under that ticker in Alpaca).
  const { from, to } = PERIODS[p];
  let reused = 0, reusedKept = 0;
  for (const [s, list] of Object.entries(ftdAll)) {
    const inP = list.filter(e => e.last >= from && e.first <= to);
    if (!inP.length) continue;
    const latest = [...list].sort((a, b) => b.last.localeCompare(a.last))[0];
    if (inP.some(e => e.cusip.slice(0, 6) !== latest.cusip.slice(0, 6)) && latest.first > to) { reused++; if (kept.has(s)) reusedKept++; }
  }
  gaps[p] = { ticker_reused_after_period: reused, of_which_symbol_has_bars_now: reusedKept, unknown_exchange_4x: j.otherExchange.filter((e: any) => e.exchange === "unknown").length };
}
writeJson(join(DATA, "work", "run2-sizing.json"), { assumptions: { bytes_per_bar_json: BYTES_JSON, bytes_per_bar_csv: BYTES_CSV, minutes_per_day: MIN_PER_DAY, bars_per_page: BARS_PER_PAGE, requests_per_minute: REQ_PER_MIN }, sizing, gaps });
console.log(JSON.stringify(gaps));
