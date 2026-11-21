// Run 3 step 9: write the committed outputs to runs/strategy-run-3-data/ from data/work/r3/:
//   period-<P>-winners.csv, period-<P>-daily.csv (run 1's columns, run 3 additions), period-<P>-gains-by-time.csv,
//   period-<P>-volume-by-time.csv, volume-pickup-dropoff.csv, benchmarks.csv, removed.csv, excluded.csv,
//   other-exchanges.csv, market-cap-sources.csv, minute-coverage.csv, change-effects.csv, summary.json (read by
//   the HTML builder) and summary-tables.md (the tables quoted in the deliverable). No network calls.
import { join } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { DATA, ensureDir, exists, readJson } from "./common.ts";
import { PERIODS, type PeriodId } from "./periods.ts";
import { WORK3, OUT3, removalReasons, REMOVE_FLAGS } from "./r3-common.ts";
import { NS, SLICE, OPEN_MIN, WD } from "./r3-08-time-of-day.ts";

ensureDir(OUT3);
const IDS = (["A", "B", "C", "D"] as PeriodId[]).filter(p => exists(join(WORK3, `period-${p}.json`)));
const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(+v.toPrecision(10)) : "";
  if (typeof v === "boolean") return v ? "1" : "0";
  const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const compressed: string[] = [];
const writeCsv = (file: string, header: string[], rows: unknown[][]) => {
  const text = [header.join(","), ...rows.map(r => r.map(csvCell).join(","))].join("\n") + "\n";
  const plain = join(OUT3, file), gz = plain + ".gz";
  if (Buffer.byteLength(text) > 45 * 1024 * 1024) { writeFileSync(gz, gzipSync(text, { level: 9 })); if (exists(plain)) unlinkSync(plain); compressed.push(file + ".gz"); }
  else { writeFileSync(plain, text); if (exists(gz)) unlinkSync(gz); }
};
const median = (a: (number | null)[]) => { const b = a.filter((x): x is number => x !== null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = (a: (number | null)[]) => { const b = a.filter((x): x is number => x !== null && Number.isFinite(x)); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : null; };
const pct = (x: number | null | undefined, d = 1) => x === null || x === undefined ? "n/a" : (x * 100).toFixed(d) + "%";
const has = (w: any, re: RegExp) => w.flags.some((f: string) => re.test(f));
const ct = (minEt: number) => `${Math.floor((minEt - 60) / 60)}:${String((minEt - 60) % 60).padStart(2, "0")}`; // Central time label

// ---- change 3: the large-difference flag. A mean and a median "differ a lot" when BOTH hold:
// (a) the gap is more than 25 percent of the larger of the two (in absolute value), and
// (b) the gap is more than the absolute floor for that kind of measure (below).
const FLOOR: Record<string, number> = { multiple: 0.25, share: 0.02, gainshare: 0.10, ret: 0.001, beta: 0.2, vol: 0.005, vola: 0.08 };
export const bigDiff = (a: number | null, b: number | null, kind: string) => a !== null && b !== null && Math.abs(a - b) > 0.25 * Math.max(Math.abs(a), Math.abs(b)) && Math.abs(a - b) > FLOOR[kind];

// ---- change 5: market cap bands
export const BANDS = ["up to 1B", "over 1B to 10B", "over 10B to 50B", "over 50B to 100B", "over 100B to 250B", "over 250B to 1T", "over 1T", "unknown"];
export const band = (c: number | null | undefined) => c === null || c === undefined ? "unknown" : c <= 1e9 ? BANDS[0] : c <= 10e9 ? BANDS[1] : c <= 50e9 ? BANDS[2] : c <= 100e9 ? BANDS[3] : c <= 250e9 ? BANDS[4] : c <= 1e12 ? BANDS[5] : BANDS[6];

const FLAG_COLS: [string, RegExp][] = [
  ["new_listing", /^new listing/], ["moved_exchange", /moved exchange/], ["history_starts_late", /starts late in Alpaca/],
  ["earnings_from_10q_10k", /earnings date from first/], ["adr", /^ADR$/], ["partnership_units", /partnership units/],
];
function extra(w: any) {
  const d = w.daily as any[];
  return {
    mean_abs_oc: mean(d.map(r => Math.abs(r.oc))), median_oc: median(d.map(r => r.oc)),
    mean_rise: mean(d.map(r => r.rise)), mean_drop: mean(d.map(r => r.drop)),
    avg_down_oc: mean(d.filter(r => r.c < r.o).map(r => r.oc)), avg_down_cc: mean(d.filter(r => r.cc !== null && r.cc < 0).map(r => r.cc)),
    mean_oc: mean(d.map(r => r.oc)), mean_gap: mean(d.filter(r => r.measured_gap && r.gap !== null).map(r => r.gap)),
    share_up_oc: w.up_oc / w.days, share_up_cc: (w.up_cc + w.down_cc + w.flat_cc) ? w.up_cc / (w.up_cc + w.down_cc + w.flat_cc) : null,
  };
}
// The per-winner measures summarized by mean and median (change 3), with the flag kind.
export const MEASURES: [string, string, string][] = [
  ["ratio", "Multiple", "multiple"], ["share_up_oc", "Share of days up (close above open)", "share"], ["share_up_cc", "Share of days up (close above prior close)", "share"],
  ["share_overnight", "Overnight share of gain", "gainshare"], ["share_intraday", "Intraday share of gain", "gainshare"],
  ["avg_up_oc", "Average up-day gain (close above open)", "ret"], ["avg_down_oc", "Average down-day loss (close below open)", "ret"],
  ["avg_up_cc", "Average up-day gain (close above prior close)", "ret"], ["avg_down_cc", "Average down-day loss (close below prior close)", "ret"],
  ["mean_oc", "Mean daily open to close", "ret"], ["mean_gap", "Mean overnight gap", "ret"], ["mean_abs_oc", "Mean daily move, open to close (either way)", "ret"],
  ["mean_rise", "Mean rise from open (high minus open)", "ret"], ["mean_drop", "Mean drop from open (open minus low)", "ret"],
  ["beta", "Beta against SPY", "beta"], ["vol_daily", "Volatility, daily", "vol"], ["vol_annual", "Volatility, annualized", "vola"],
];
const fmtM = (k: string, v: number | null) => v === null ? "n/a" : k === "multiple" || k === "beta" ? v.toFixed(2) : k === "ret" ? pct(v, 2) : k === "gainshare" ? pct(v, 0) : pct(v, 1);

const caps = exists(join(WORK3, "caps.json")) ? readJson(join(WORK3, "caps.json")) : {};
const summary: any = { periods: {}, bands: BANDS, groups: ["3x", "4x", "5x", "6x+"], floors: FLOOR, slice_minutes: SLICE };
const md: string[] = ["# Summary tables, strategy run 3", "", "Generated by `node scripts/r3-09-outputs.ts` from the cached data. Percentages are of trading days unless stated. A ⚑ marks a mean and median that differ a lot (rule in the deliverable, section 3).", ""];
const benchRows: unknown[][] = [], removedRows: unknown[][] = [], exclRows: unknown[][] = [], otherRows: unknown[][] = [], capRows: unknown[][] = [], covRows: unknown[][] = [], effRows: unknown[][] = [], pdRows: unknown[][] = [];
const r1 = (p: PeriodId) => { const f = join(DATA, "work", `period-${p}.json`); return exists(f) ? readJson(f).winners as any[] : []; };

for (const p of IDS) {
  const j = readJson(join(WORK3, `period-${p}.json`));
  const ALL = j.winners as any[];
  for (const w of ALL) { Object.assign(w, extra(w)); const c = caps[`${p}:${w.symbol}`]; if (c) Object.assign(w, { cap_start: c.start?.cap ?? null, cap_end: c.end?.cap ?? null, cap_src_start: c.start, cap_src_end: c.end }); w.removed = removalReasons(w.flags);
    // Run 1's "market cap missing" flag is restated from run 3's caps: dropped when both sides are now filled.
    w.flags = w.flags.filter((f: string) => f !== "market cap missing");
    const us = w.cap_start === null || w.cap_start === undefined, ue = w.cap_end === null || w.cap_end === undefined;
    if (us || ue) w.flags.push(us && ue ? "market cap unknown (start and end)" : us ? "market cap unknown (start)" : "market cap unknown (end)"); }
  const W = ALL.filter(w => w.removed.length === 0);
  for (const w of ALL.filter(w => w.removed.length)) removedRows.push([p, w.symbol, w.name, w.group, w.ratio, w.start, w.end, w.removed.join("; "), w.flags.join("; ")]);

  // ---- change effects (section 2 of the deliverable)
  const r1w = r1(p); const r1set = new Set(r1w.map(w => w.symbol));
  const at4 = ALL.filter(w => w.ratio >= 4); const at4set = new Set(at4.map(w => w.symbol));
  const cnt = (a: any[], g?: string) => g ? a.filter(w => w.group === g).length : a.length;
  for (const g of ["3x", "4x", "5x", "6x+", "all"]) {
    const gg = g === "all" ? undefined : g;
    effRows.push([p, g, g === "3x" ? null : cnt(r1w, gg), g === "3x" ? null : cnt(at4, gg), g === "3x" ? null : cnt(at4.filter(w => !w.removed.length), gg), cnt(W, gg)]);
  }
  const rebuiltMatches = r1w.length === at4.length && r1w.every(w => at4set.has(w.symbol));

  // ---- winners CSV
  const wh = ["ticker", "company_name", "sec_current_name", "exchange", "exchange_source", "gain_group", "multiple", "gain_dollars", "gain_pct",
    "start_date", "end_date", "start_open", "end_close", "nonstandard_start", ...FLAG_COLS.map(f => f[0]), "all_flags",
    "market_cap_start", "market_cap_end", "market_cap_band_start", "market_cap_band_end", "market_cap_source_start", "market_cap_source_end", "industry_sic_description", "sic_code", "cik", "cik_source",
    "beta_vs_spy", "beta_days", "volatility_daily_pct", "volatility_annualized_pct", "volatility_days",
    "trading_days", "up_days_close_above_open", "down_days_close_below_open", "flat_days_open_close",
    "up_days_close_above_prior_close", "down_days_close_below_prior_close", "flat_days_close_close",
    "avg_up_day_gain_open_to_close_pct", "up_days_above_avg_open_to_close", "up_days_at_or_below_avg_open_to_close",
    "avg_up_day_gain_close_to_close_pct", "up_days_above_avg_close_to_close", "up_days_at_or_below_avg_close_to_close",
    "avg_down_day_loss_open_to_close_pct", "avg_down_day_loss_close_to_close_pct", "mean_open_to_close_pct", "mean_overnight_gap_pct",
    "overnight_share_of_gain", "intraday_share_of_gain", "log_gain_total", "log_gain_overnight", "log_gain_intraday",
    "mean_abs_open_to_close_pct", "median_open_to_close_pct", "mean_rise_from_open_pct", "mean_drop_from_open_pct",
    "spy_down_or_flat_days", "winner_up_on_spy_down_or_flat_days", "qqq_down_or_flat_days", "winner_up_on_qqq_down_or_flat_days",
    "spy_open_to_close_down_or_flat_days", "winner_open_to_close_up_on_those_days", "also_listed_as"];
  const srcTxt = (s: any) => s ? `${s.method}${s.url ? " " + s.url : ""}${s.accessed ? " (accessed " + s.accessed + ")" : ""}` : "unknown";
  const p100 = (x: number | null) => x === null || x === undefined ? null : x * 100;
  writeCsv(`period-${p}-winners.csv`, wh, W.map(w => [w.symbol, w.name, w.sec_name, w.exchange, w.exchange_via, w.group, w.ratio, w.gain_d, w.gain_pct * 100,
    w.start, w.end, w.start_open, w.end_close, has(w, /new listing|moved exchange|starts late/), ...FLAG_COLS.map(f => has(w, f[1])), w.flags.join("; "),
    w.cap_start, w.cap_end, band(w.cap_start), band(w.cap_end), srcTxt(w.cap_src_start), srcTxt(w.cap_src_end), w.industry, w.sic, w.cik, w.cik_via,
    w.beta, w.beta_days, p100(w.vol_daily), p100(w.vol_annual), w.vol_days,
    w.days, w.up_oc, w.down_oc, w.flat_oc, w.up_cc, w.down_cc, w.flat_cc,
    p100(w.avg_up_oc), w.up_oc_above, w.up_oc_below, p100(w.avg_up_cc), w.up_cc_above, w.up_cc_below,
    p100(w.avg_down_oc), p100(w.avg_down_cc), p100(w.mean_oc), p100(w.mean_gap),
    w.share_overnight, w.share_intraday, w.log_total, w.log_overnight, w.log_intraday,
    p100(w.mean_abs_oc), p100(w.median_oc), p100(w.mean_rise), p100(w.mean_drop),
    w.spy_down_days, w.up_when_spy_down, w.qqq_down_days, w.up_when_qqq_down, w.spy_oc_down_days, w.up_oc_when_spy_oc_down, (w.also_listed_as ?? []).join(" ")]));
  for (const w of W) for (const [side, s] of [["start", w.cap_src_start], ["end", w.cap_src_end]] as [string, any][])
    capRows.push([p, w.symbol, side, side === "start" ? w.start : w.end, s?.cap ?? null, band(s?.cap), s?.method ?? "unknown", s?.shares ?? null, s?.price ?? null, s?.ratio ?? null, s?.asOf ?? null, s?.url ?? "", s?.accessed ?? "", s?.note ?? ""]);

  // ---- daily CSV (run 1's columns)
  const dh = ["ticker", "date", "open", "high", "low", "close", "volume", "open_to_close_dollars", "open_to_close_pct", "overnight_gap_dollars", "overnight_gap_pct",
    "gap_counted_in_gain", "up_close_above_open", "up_close_above_prior_close", "rise_from_open_dollars", "rise_from_open_pct", "drop_from_open_dollars", "drop_from_open_pct",
    "spy_open_to_close_pct", "spy_close_to_close_pct", "qqq_open_to_close_pct", "qqq_close_to_close_pct"];
  const drows: unknown[][] = [];
  for (const w of W) for (const r of w.daily) drows.push([w.symbol, r.t, r.o, r.h, r.l, r.c, r.v, r.oc_d, r.oc * 100, r.gap_d, p100(r.gap), r.measured_gap, r.up_oc, r.up_cc, r.rise_d, r.rise * 100, r.drop_d, r.drop * 100, p100(r.spy_oc), p100(r.spy_cc), p100(r.qqq_oc), p100(r.qqq_cc)]);
  writeCsv(`period-${p}-daily.csv`, dh, drows);

  for (const s of ["SPY", "QQQ"]) { let pc: number | null = null; for (const b of j.benchDaily[s]) { benchRows.push([p, s, b.t.slice(0, 10), b.o, b.h, b.l, b.c, b.v, (b.c / b.o - 1) * 100, pc ? (b.c / pc - 1) * 100 : null]); pc = b.c; } }
  for (const e of j.excluded) exclRows.push([p, e.symbol, e.name, e.reason, e.ratio ?? null, e.start ?? null, e.end ?? null]);
  for (const e of j.otherExchange) otherRows.push([p, e.symbol, e.name, e.exchange, e.exchange_via, e.ratio, e.start, e.end, e.flags.join("; "), e.exchange === "unknown" ? "possible winner, exchange not confirmed" : "listed elsewhere"]);

  // ---- group summaries, mean and median (change 3)
  const groups = ["3x", "4x", "5x", "6x+", "all"];
  const grp = (g: string) => g === "all" ? W : W.filter(w => w.group === g);
  const gs = groups.map(g => {
    const a = grp(g); const days = a.flatMap(w => w.daily as any[]);
    const m: any = {};
    for (const [k, , kind] of MEASURES) { const v = a.map(w => w[k] ?? null); const mn = mean(v), md2 = median(v); m[k] = { mean: mn, median: md2, flag: bigDiff(mn, md2, kind) }; }
    const pooled = (num: string, den: string) => { const d = a.reduce((x, w) => x + w[den], 0); return d ? a.reduce((x, w) => x + w[num], 0) / d : null; };
    const edges = [-Infinity, -10, -5, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5, 10, Infinity]; const hc = new Array(14).fill(0);
    for (const r of days) { const x = r.oc * 100; for (let i = 0; i < 14; i++) if (x >= edges[i] && x < edges[i + 1]) { hc[i]++; break; } }
    return { group: g, n: a.length, m,
      nonstandard: a.filter(w => has(w, /new listing|moved exchange|starts late/)).length,
      share_up_days_above_avg_oc: pooled("up_oc_above", "up_oc"), share_up_days_above_avg_cc: pooled("up_cc_above", "up_cc"),
      up_when_spy_down: pooled("up_when_spy_down", "spy_down_days"), up_when_qqq_down: pooled("up_when_qqq_down", "qqq_down_days"), up_oc_when_spy_oc_down: pooled("up_oc_when_spy_oc_down", "spy_oc_down_days"),
      hist: hc, hist_total: days.length,
      bands_start: Object.fromEntries(BANDS.map(b => [b, a.filter(w => band(w.cap_start) === b).length])),
      bands_end: Object.fromEntries(BANDS.map(b => [b, a.filter(w => band(w.cap_end) === b).length])) };
  });
  const bench = (j.benchmarks as any[]).map(b => ({ symbol: b.symbol, multiple: b.ratio, days: b.days, share_up_oc: b.up_oc / b.days, share_up_cc: b.up_cc / (b.up_cc + b.down_cc + b.flat_cc), overnight_share: b.share_overnight, intraday_share: b.share_intraday,
    mean_abs_oc: mean((j.benchDaily[b.symbol] as any[]).map((x: any) => Math.abs(x.c / x.o - 1))) }));
  const industries = Object.entries(W.reduce((m: any, w) => { const k = w.industry || "(missing)"; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a: any, b: any) => b[1] - a[1]);

  // ---- time of day (changes 7 and 8)
  const tod = exists(join(WORK3, `tod-${p}.json`)) ? readJson(join(WORK3, `tod-${p}.json`)) : null;
  if (tod) {
    const gRows: unknown[][] = [], vRows: unknown[][] = [];
    const lab = (k: number) => [ct(OPEN_MIN + k * SLICE), ct(OPEN_MIN + (k + 1) * SLICE)];
    for (const wd of ["all", ...WD]) {
      for (const g of groups) { const t = tod.groups[g]?.[wd]; if (!t) continue;
        for (const s of t.slices) { gRows.push([p, wd, g, ...lab(s.k), t.stocks, t.stock_days, p100(s.ret_mean), p100(s.ret_median), s.up_mean, s.up_median, s.gain_share, s.loss_share]);
          vRows.push([p, wd, g, ...lab(s.k), t.stocks, t.stock_days, s.vol_mean, s.vol_median]); }
        pdRows.push([p, wd, g, t.stocks, t.stock_days, t.mean_curve.drop_off_ct, t.mean_curve.pick_up_ct, t.median_curve.drop_off_ct, t.median_curve.pick_up_ct]); }
      for (const s of ["SPY", "QQQ"]) { const t = tod.bench[s]?.[wd]; if (!t) continue;
        for (const x of t.slices) { gRows.push([p, wd, s, ...lab(x.k), 1, t.days, p100(x.ret_mean), p100(x.ret_median ?? null), x.up_mean, null, null, null]); vRows.push([p, wd, s, ...lab(x.k), 1, t.days, x.vol_mean, x.vol_median]); }
        pdRows.push([p, wd, s, 1, t.days, t.mean_curve.drop_off_ct, t.mean_curve.pick_up_ct, t.median_curve.drop_off_ct, t.median_curve.pick_up_ct]); }
    }
    writeCsv(`period-${p}-gains-by-time.csv`, ["period", "weekday", "group", "slice_start_ct", "slice_end_ct", "stocks", "stock_days", "mean_slice_return_pct", "median_slice_return_pct", "mean_share_of_days_up_in_slice", "median_share_of_days_up_in_slice", "share_of_all_intraday_gains", "share_of_all_intraday_losses"], gRows);
    writeCsv(`period-${p}-volume-by-time.csv`, ["period", "weekday", "group", "slice_start_ct", "slice_end_ct", "stocks", "stock_days", "mean_share_of_daily_volume", "median_share_of_daily_volume"], vRows);
    for (const c of tod.coverage) covRows.push([p, c.symbol, c.group ?? "", c.start ?? "", c.end ?? "", c.missing_file ? 1 : 0, c.daily_days ?? null, c.days_used ?? null, c.days_with_daily_bar_but_no_minutes ?? null, c.first_minute_day ?? "", c.late_start ? 1 : 0, c.share_minutes_without_trade ?? null]);
  }

  summary.periods[p] = {
    label: PERIODS[p].label, first: j.first, last: j.last, cutoff: j.cutoff, stats: j.stats,
    counts: Object.fromEntries(["3x", "4x", "5x", "6x+"].map(g => [g, W.filter(w => w.group === g).length])),
    removed: Object.fromEntries(REMOVE_FLAGS.map(([k]) => [k, ALL.filter(w => w.removed.includes(k)).length])), removed_total: ALL.length - W.length,
    removed_by_group: Object.fromEntries(["3x", "4x", "5x", "6x+"].map(g => [g, ALL.filter(w => w.group === g && w.removed.length).length])),
    rebuilt_matches_run1: rebuiltMatches, run1_total: r1w.length, at4_total: at4.length,
    excluded: j.excluded.length, other_exchange: j.otherExchange.filter((e: any) => e.exchange !== "unknown").length,
    unknown_exchange: j.otherExchange.filter((e: any) => e.exchange === "unknown").map((e: any) => e.symbol),
    groups: gs, benchmarks: bench, industries,
    flags: Object.fromEntries(FLAG_COLS.map(([k, re]) => [k, W.filter(w => has(w, re)).length])),
    cap_unknown_start: W.filter(w => w.cap_start === null || w.cap_start === undefined).length, cap_unknown_end: W.filter(w => w.cap_end === null || w.cap_end === undefined).length,
    winners: W.map(w => ({ t: w.symbol, n: w.name, g: w.group, m: w.ratio, s: w.start, e: w.end, x: w.exchange, f: w.flags, i: w.industry,
      bs: band(w.cap_start), be: band(w.cap_end), cs: w.cap_start, ce: w.cap_end, b: w.beta, v: w.vol_annual,
      ...Object.fromEntries(MEASURES.map(([k]) => ["_" + k, w[k] ?? null])),
      sd: w.spy_down_days, su: w.up_when_spy_down, qd: w.qqq_down_days, qu: w.up_when_qqq_down,
      h: (() => { const edges = [-Infinity, -10, -5, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5, 10, Infinity]; const c = new Array(14).fill(0);
        for (const r of w.daily) { const x = r.oc * 100; for (let i = 0; i < 14; i++) if (x >= edges[i] && x < edges[i + 1]) { c[i]++; break; } } return c; })() })),
    tod: tod && { full_days: tod.full_days, half_days: tod.half_days,
      groups: Object.fromEntries(Object.entries(tod.groups).map(([g, x]: any) => [g, Object.fromEntries(Object.entries(x).map(([wd, t]: any) => [wd, { n: t.stocks, nd: t.stock_days, mc: t.mean_curve, dc: t.median_curve,
        rm: t.slices.map((s: any) => s.ret_mean), rd: t.slices.map((s: any) => s.ret_median), gs: t.slices.map((s: any) => s.gain_share), ls: t.slices.map((s: any) => s.loss_share), vm: t.slices.map((s: any) => s.vol_mean), vd: t.slices.map((s: any) => s.vol_median) }]))])),
      bench: Object.fromEntries(Object.entries(tod.bench).map(([s, x]: any) => [s, Object.fromEntries(Object.entries(x).map(([wd, t]: any) => [wd, { nd: t.days, mc: t.mean_curve, dc: t.median_curve,
        rm: t.slices.map((q: any) => q.ret_mean), rd: t.slices.map((q: any) => q.ret_median ?? null), vm: t.slices.map((q: any) => q.vol_mean), vd: t.slices.map((q: any) => q.vol_median) }]))])) },
  };

  // ---- markdown
  md.push(`## Period ${p}: ${PERIODS[p].label}`, "", `Trading days measured: ${j.first} to ${j.last}. Candidates from the 3x monthly screen: ${j.stats.candidates}; passed the daily pre-check: ${j.stats.prelim}. Removed (change 1): ${ALL.length - W.length}.`, "");
  md.push("| Group | Winners | Non-standard start | " + MEASURES.slice(0, 5).map(x => `${x[1]}, mean | median`).join(" | ") + " |", "| :---- | ----: | ----: |" + " ----: | ----: |".repeat(5));
  const mm = (g: any, k: string, kind: string) => `${fmtM(kind, g.m[k].mean)}${g.m[k].flag ? " ⚑" : ""} | ${fmtM(kind, g.m[k].median)}`;
  for (const g of gs) md.push(`| ${g.group} | ${g.n} | ${g.nonstandard} | ` + MEASURES.slice(0, 5).map(([k, , kind]) => mm(g, k, kind)).join(" | ") + " |");
  for (const b of bench) md.push(`| ${b.symbol} (benchmark) | n/a | n/a | ${b.multiple.toFixed(2)} | | ${pct(b.share_up_oc)} | | ${pct(b.share_up_cc)} | | ${pct(b.overnight_share, 0)} | | ${pct(b.intraday_share, 0)} | |`);
  for (const [from, to] of [[5, 10], [10, 14], [14, 17]]) {
    md.push("", "| Group | " + MEASURES.slice(from, to).map(x => `${x[1]}, mean | median`).join(" | ") + " |", "| :---- |" + " ----: | ----: |".repeat(to - from));
    for (const g of gs) md.push(`| ${g.group} | ` + MEASURES.slice(from, to).map(([k, , kind]) => mm(g, k, kind)).join(" | ") + " |");
    if (from === 10) for (const b of bench) md.push(`| ${b.symbol} (benchmark) | | | ${pct(b.mean_abs_oc, 2)} | | | | | |`);
  }
  md.push("", "| Group | Up days above the average up day, close above open (pooled) | Same, close above prior close (pooled) | Winner rose (close above prior close) on days SPY fell or was flat | Same, QQQ | Winner rose open to close on days SPY fell or was flat open to close |", "| :---- | ----: | ----: | ----: | ----: | ----: |");
  for (const g of gs) md.push(`| ${g.group} | ${pct(g.share_up_days_above_avg_oc, 0)} | ${pct(g.share_up_days_above_avg_cc, 0)} | ${pct(g.up_when_spy_down, 0)} | ${pct(g.up_when_qqq_down, 0)} | ${pct(g.up_oc_when_spy_oc_down, 0)} |`);
  md.push("", "Market cap bands, number of winners (start / end):", "", "| Group | " + BANDS.join(" | ") + " |", "| :---- |" + " ----: |".repeat(BANDS.length));
  for (const g of gs) md.push(`| ${g.group} | ` + BANDS.map(b => `${g.bands_start[b]} / ${g.bands_end[b]}`).join(" | ") + " |");
  md.push("", "Daily open-to-close moves, all winners pooled (share of winner-days in each band):", "", "| Band | " + ["below -10%", "-10 to -5", "-5 to -3", "-3 to -2", "-2 to -1", "-1 to -0.5", "-0.5 to 0", "0 to 0.5", "0.5 to 1", "1 to 2", "2 to 3", "3 to 5", "5 to 10", "10% and up"].join(" | ") + " |", "| :---- |" + " ----: |".repeat(14));
  for (const g of gs) md.push(`| ${g.group} | ` + g.hist.map((c: number) => pct(g.hist_total ? c / g.hist_total : null, 1)).join(" | ") + " |");
  md.push("", `Top industries (SEC SIC description, today's label): ${industries.slice(0, 8).map(([k, v]) => `${k} (${v})`).join("; ")}.`, "");
  if (tod) {
    // 30 minute view of the 5 minute slices, all weekdays.
    md.push("Gains by time of day, all weekdays, 30 minute blocks (Central time). Return = mean (or median) across winners of the winner's average log return in that block (SPY and QQQ: mean or median across days); gains and losses = share of all intraday rises (falls) that happened in the block, pooled.", "");
    md.push("| Block (CT) | " + ["3x", "4x", "5x", "6x+", "all"].map(g => `${g} mean | ${g} median`).join(" | ") + " | all: share of gains | all: share of losses | SPY mean | SPY median | QQQ mean | QQQ median |", "| :---- |" + " ----: |".repeat(16));
    for (let b = 0; b < 13; b++) {
      const ks = [...Array(6).keys()].map(i => b * 6 + i);
      const sum = (arr: (number | null)[]) => ks.reduce((x, k) => x + (arr[k] ?? 0), 0);
      const cells = ["3x", "4x", "5x", "6x+", "all"].map(g => { const t = summary.periods[p].tod.groups[g].all; return `${pct(sum(t.rm), 3)} | ${pct(sum(t.rd), 3)}`; });
      const ta = summary.periods[p].tod.groups.all.all, sb = summary.periods[p].tod.bench;
      md.push(`| ${ct(OPEN_MIN + b * 30)} to ${ct(OPEN_MIN + b * 30 + 30)} | ${cells.join(" | ")} | ${pct(sum(ta.gs), 1)} | ${pct(sum(ta.ls), 1)} | ${pct(sum(sb.SPY.all.rm), 3)} | ${pct(sum(sb.SPY.all.rd), 3)} | ${pct(sum(sb.QQQ.all.rm), 3)} | ${pct(sum(sb.QQQ.all.rd), 3)} |`);
    }
    md.push("", "(The block median is the sum of the 5 minute medians, an approximation; the CSV holds every 5 minute slice.)", "");
    md.push("Volume by time of day: share of the day's regular-session volume in each 30 minute block, all weekdays. Mean across stocks (winners) or days (SPY, QQQ); the median is in brackets. The last block includes the closing auction (the 3:00 PM Central bar).", "");
    md.push("| Block (CT) | 3x | 4x | 5x | 6x+ | all winners | SPY | QQQ |", "| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |");
    const blk = (arr: (number | null)[], b: number) => { let x = 0; for (let i = 0; i < 6; i++) x += arr[b * 6 + i] ?? 0; return x; };
    const mdv = (t: any, b: number) => `${pct(blk(t.vm, b), 1)} (${pct(blk(t.vd, b), 1)})`;
    for (let b = 0; b < 13; b++) { const T = summary.periods[p].tod;
      md.push(`| ${ct(OPEN_MIN + b * 30)} to ${ct(OPEN_MIN + b * 30 + 30)} | ${["3x", "4x", "5x", "6x+", "all"].map(g => mdv(T.groups[g].all, b)).join(" | ")} | ${mdv(T.bench.SPY.all, b)} | ${mdv(T.bench.QQQ.all, b)} |`); }
    md.push("", "(A block median is the sum of its six 5 minute medians, an approximation.)", "");
    md.push("Volume by weekday, all winners against SPY and QQQ: share of the day's volume in the first 30 minutes (8:30 to 9:00 CT), the quietest hour (11:30 to 12:30 CT) and the last 30 minutes (2:30 to 3:00 CT, with the closing auction). Mean, median in brackets. Every 5 minute slice per weekday is in the CSV.", "");
    md.push("| Weekday | Winners, first 30 min | SPY, first 30 min | QQQ, first 30 min | Winners, 11:30 to 12:30 | SPY, 11:30 to 12:30 | QQQ, 11:30 to 12:30 | Winners, last 30 min | SPY, last 30 min | QQQ, last 30 min |", "| :---- |" + " ----: |".repeat(9));
    for (const wd of WD) { const T = summary.periods[p].tod; const ser = [T.groups.all[wd], T.bench.SPY[wd], T.bench.QQQ[wd]];
      const hour = (t: any) => `${pct(blk(t.vm, 6) + blk(t.vm, 7), 1)} (${pct(blk(t.vd, 6) + blk(t.vd, 7), 1)})`;
      md.push(`| ${wd} | ${ser.map(t => mdv(t, 0)).join(" | ")} | ${ser.map(hour).join(" | ")} | ${ser.map(t => mdv(t, 12)).join(" | ")} |`); }
    md.push("");
    md.push("", "Volume drop off and pick up, Central time (mean curve; median curve in brackets). Each is the middle of a window that may run up to 30 minutes either side.", "");
    md.push("| Weekday | All winners: drop off | All winners: pick up | SPY: drop off | SPY: pick up | QQQ: drop off | QQQ: pick up | Winner-days | SPY days |", "| :---- | :---- | :---- | :---- | :---- | :---- | :---- | ----: | ----: |");
    for (const wd of ["all", ...WD]) { const T = summary.periods[p].tod; const a = T.groups.all[wd], s = T.bench.SPY[wd], q = T.bench.QQQ[wd];
      md.push(`| ${wd === "all" ? "All days" : wd} | ${a.mc.drop_off_ct} (${a.dc.drop_off_ct}) | ${a.mc.pick_up_ct} (${a.dc.pick_up_ct}) | ${s.mc.drop_off_ct} (${s.dc.drop_off_ct}) | ${s.mc.pick_up_ct} (${s.dc.pick_up_ct}) | ${q.mc.drop_off_ct} (${q.dc.drop_off_ct}) | ${q.mc.pick_up_ct} (${q.dc.pick_up_ct}) | ${a.nd} | ${s.nd} |`); }
    md.push("", "Drop off and pick up by gain group, Central time, all weekdays (mean curve; median curve in brackets):", "", "| Group | Stocks | Drop off | Pick up |", "| :---- | ----: | :---- | :---- |");
    for (const g of groups) { const t = summary.periods[p].tod.groups[g]?.all; if (t) md.push(`| ${g} | ${t.n} | ${t.mc.drop_off_ct} (${t.dc.drop_off_ct}) | ${t.mc.pick_up_ct} (${t.dc.pick_up_ct}) |`); }
    md.push("", `Full trading days in the period: ${tod.full_days}; half days excluded: ${tod.half_days.length} (${tod.half_days.join(", ")}).`, "");
  }
  md.push("| Ticker | Company | Group | Multiple | Start | End | Exchange | Beta | Volatility (annualized) | Cap band start | Cap band end | Flags |", "| :---- | :---- | :---- | ----: | :---- | :---- | :---- | ----: | ----: | :---- | :---- | :---- |");
  for (const w of W.slice(0, 25)) md.push(`| ${w.symbol} | ${String(w.name).slice(0, 40).replace(/\|/g, "/")} | ${w.group} | ${w.ratio.toFixed(2)} | ${w.start} | ${w.end} | ${w.exchange} | ${w.beta?.toFixed(2) ?? "n/a"} | ${pct(w.vol_annual, 0)} | ${band(w.cap_start)} | ${band(w.cap_end)} | ${w.flags.join("; ").replace(/\|/g, "/")} |`);
  md.push("");
}
writeCsv("benchmarks.csv", ["period", "symbol", "date", "open", "high", "low", "close", "volume", "open_to_close_pct", "close_to_close_pct"], benchRows);
writeCsv("removed.csv", ["period", "ticker", "name", "gain_group", "multiple", "start", "end", "removed_for", "all_flags_exact_text"], removedRows);
writeCsv("excluded.csv", ["period", "ticker", "name", "reason", "multiple", "start", "end"], exclRows);
writeCsv("other-exchanges.csv", ["period", "ticker", "name", "exchange", "exchange_source", "multiple", "start", "end", "flags", "class"], otherRows);
writeCsv("market-cap-sources.csv", ["period", "ticker", "side", "date", "market_cap", "band", "method", "shares_used", "price_used", "adr_ratio", "share_count_as_of", "source_url", "accessed", "note"], capRows);
writeCsv("minute-coverage.csv", ["period", "ticker", "group", "start", "end", "minute_file_missing", "daily_bars", "full_days_used", "days_with_daily_bar_but_no_minute_bars", "first_minute_bar_day", "late_start", "share_of_regular_minutes_without_a_trade"], covRows);
writeCsv("volume-pickup-dropoff.csv", ["period", "weekday", "group", "stocks", "stock_days", "drop_off_ct_mean_curve", "pick_up_ct_mean_curve", "drop_off_ct_median_curve", "pick_up_ct_median_curve"], pdRows);
writeCsv("change-effects.csv", ["period", "group", "run1_published", "run3_rebuilt_at_4x_and_up_before_removal", "after_removal_4x_and_up", "run3_final_with_3x"], effRows);
summary.change_effects = effRows; summary.compressed_files = compressed;
summary.coverage = { files_missing: covRows.filter(r => r[5]).length, late_start: covRows.filter(r => r[10]).length, rows: covRows.length };
writeFileSync(join(OUT3, "summary.json"), JSON.stringify(summary));
writeFileSync(join(OUT3, "summary-tables.md"), md.join("\n") + "\n");
console.log("wrote outputs for periods", IDS.join(" "), compressed.length ? "compressed: " + compressed.join(", ") : "");
