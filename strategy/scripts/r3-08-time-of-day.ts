// Run 3 step 8 (changes 6, 7 and 8): from the cached 1 minute bars, per period:
//  - coverage per stock: late-starting history, days with a daily bar but no regular-session minute bars,
//    share of regular-session minutes with no bar (no trade that minute);
//  - gains by time of day: 5 minute slices from 9:30 to 16:00 Eastern (8:30 AM to 3:00 PM Central);
//  - volume by time of day: each slice's share of that stock's regular-session volume that day.
// Full trading days only: a day is a half day when SPY has fewer than 390 regular-session minute bars AND its
// volume after 13:00 Eastern is under 50 percent of its volume from 9:30 to 13:00 (rule and evidence in the main block).
// Times are converted with an explicit America/New_York zone (this Mac runs on Pacific time); Central is
// always Eastern minus one hour. No network calls. Writes data/work/r3/tod-<P>.json.
// Usage: node scripts/r3-08-time-of-day.ts B C D A
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { exists, readJson, writeJson } from "./common.ts";
import { WORK3, removalReasons, minuteFile } from "./r3-common.ts";
import type { PeriodId } from "./periods.ts";

export const SLICE = 5, NS = 78;                 // 78 five-minute slices, 9:30 to 16:00 Eastern
export const OPEN_MIN = 9 * 60 + 30, CLOSE_MIN = 16 * 60;
export const INCLUDE_CLOSE_BAR = (globalThis as any).R3_INCLUDE_CLOSE_BAR ?? true; // see decision in the trajectory
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
const cache = new Map<number, { d: string; m: number; wd: string }>();
export function et(sec: number) {          // Eastern date, minute of day and weekday of a bar's start time
  const k = Math.floor(sec / 3600); let base = cache.get(k);
  if (!base) { const parts = Object.fromEntries(fmt.formatToParts(new Date(k * 3600000)).map(x => [x.type, x.value]));
    base = { d: `${parts.year}-${parts.month}-${parts.day}`, m: Number(parts.hour) * 60, wd: parts.weekday }; cache.set(k, base); }
  return { d: base.d, m: base.m + Math.floor((sec % 3600) / 60), wd: base.wd };
}
export const WD = ["Mon", "Tue", "Wed", "Thu", "Fri"];
type Bar = number[]; // [sec, o, h, l, c, v]
export function loadMinutes(p: string, s: string): Bar[] | null { const f = minuteFile(p, s); return exists(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString()) : null; }

// Split a stock's bars into regular-session days: date -> { wd, bars with slice index }.
function byDay(bars: Bar[]) {
  const days = new Map<string, { wd: string; rows: { k: number; o: number; c: number; v: number; m: number }[]; closeBarV: number }>();
  for (const b of bars) {
    const t = et(b[0]);
    if (t.m < OPEN_MIN || t.m > CLOSE_MIN) continue;
    let e = days.get(t.d); if (!e) { e = { wd: t.wd, rows: [], closeBarV: 0 }; days.set(t.d, e); }
    if (t.m === CLOSE_MIN) { e.closeBarV += b[5]; continue; } // the 16:00 bar: closing auction prints (decision in trajectory)
    e.rows.push({ k: Math.floor((t.m - OPEN_MIN) / SLICE), o: b[1], c: b[4], v: b[5], m: t.m });
  }
  return days;
}
// Per-day slice measures: log return per slice (price carried forward through slices without a trade)
// and volume per slice.
function dayMeasures(rows: { k: number; o: number; c: number; v: number }[], closeBarV: number) {
  const ret = new Array(NS).fill(0), vol = new Array(NS).fill(0);
  if (!rows.length) return null;
  let prev = rows[0].o, j = 0;
  for (let k = 0; k < NS; k++) {
    let last: number | null = null;
    while (j < rows.length && rows[j].k === k) { last = rows[j].c; vol[k] += rows[j].v; j++; }
    if (last !== null) { ret[k] = Math.log(last / prev); prev = last; }
  }
  if (INCLUDE_CLOSE_BAR) vol[NS - 1] += closeBarV;
  const total = vol.reduce((a, b) => a + b, 0);
  return { ret, vol, total };
}

const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const median = (a: number[]) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

// Accumulator for one stock: per weekday key ("all", "Mon".."Fri"), per slice sums.
function newAcc() { const o: any = {}; for (const w of ["all", ...WD]) o[w] = { n: 0, nv: 0, ret: new Array(NS).fill(0), pos: new Array(NS).fill(0), neg: new Array(NS).fill(0), up: new Array(NS).fill(0), share: new Array(NS).fill(0), shareDays: [] as number[][], retDays: [] as number[][] }; return o; }

export function processStock(bars: Bar[], keepDay: (d: string) => boolean, keepShareDays = false) {
  const days = byDay(bars); const acc = newAcc(); let used = 0;
  for (const [d, e] of days) {
    if (!keepDay(d)) continue;
    const m = dayMeasures(e.rows, e.closeBarV); if (!m) continue;
    used++;
    for (const w of ["all", e.wd]) { const a = acc[w]; if (!a) continue; a.n++;
      for (let k = 0; k < NS; k++) { const r = m.ret[k]; a.ret[k] += r; if (r > 0) { a.pos[k] += r; a.up[k]++; } else if (r < 0) a.neg[k] += r; }
      if (keepShareDays) a.retDays.push([...m.ret]); // benchmarks: keep each day's slice returns for the median across days
      if (m.total > 0) { a.nv++; for (let k = 0; k < NS; k++) a.share[k] += m.vol[k] / m.total; if (keepShareDays) a.shareDays.push(m.vol.map(v => v / m.total)); }
    }
  }
  return { acc, used, days };
}

// Pick up and drop off (method stated in the deliverable): smooth the curve with a centered 15 minute
// (3 slice) moving average; the session's average level is 1/78 of the day's volume per 5 minutes.
// Drop off = the first time after the open the smoothed curve falls below that level; pick up = the last
// time before the close it rises back above it. Times are interpolated between slice midpoints and given
// in Central time (Eastern minus one hour).
export function pickupDropoff(curve: number[]) {
  const sm = curve.map((_, i) => { const a = curve.slice(Math.max(0, i - 1), Math.min(NS, i + 2)); return a.reduce((x, y) => x + y, 0) / a.length; });
  const L = 1 / NS, mid = (i: number) => OPEN_MIN + i * SLICE + SLICE / 2;
  let drop: number | null = null, pick: number | null = null;
  for (let i = 1; i < NS; i++) if (sm[i - 1] >= L && sm[i] < L) { drop = mid(i - 1) + SLICE * (sm[i - 1] - L) / (sm[i - 1] - sm[i]); break; }
  for (let i = NS - 1; i > 0; i--) if (sm[i - 1] < L && sm[i] >= L) { pick = mid(i - 1) + SLICE * (L - sm[i - 1]) / (sm[i] - sm[i - 1]); break; }
  const ct = (m: number | null) => m === null ? null : `${Math.floor((m - 60) / 60)}:${String(Math.round((m - 60) % 60)).padStart(2, "0")}`;
  return { drop_off_ct: ct(drop), pick_up_ct: ct(pick), drop_min_et: drop, pick_min_et: pick, smoothed: sm };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const which = (process.argv.slice(2).length ? process.argv.slice(2) : ["B", "C", "D", "A"]) as PeriodId[];
  for (const p of which) {
    const j = readJson(join(WORK3, `period-${p}.json`));
    const spyBars = loadMinutes(p, "SPY"); if (!spyBars) { console.log(p, "no SPY minutes yet"); continue; }
    const spyDays = byDay(spyBars); const full = new Set<string>(), half: string[] = [];
    // Half day (early close at 13:00 Eastern) = BOTH of: SPY has fewer than 390 bars from 9:30 to 15:59 Eastern (SPY trades
    // in every regular minute of a full day), AND its volume from 13:01 to 15:59 is under 50 percent of its 9:30 to 12:59
    // volume (after an early close only extended-hours trading continues). Measured on SPY in all four periods: days with
    // under 390 bars that are full days have ratios 0.74 to 1.01; early closes 0.03 to 0.40; 390-bar days never fall
    // below 0.39, so neither test alone separates them (2025-07-16 had 390 bars and a ratio of 0.39).
    for (const [d, e] of spyDays) { if (d < j.first || d > j.last) continue;
      const am = e.rows.filter(r => r.m < 13 * 60).reduce((x, r) => x + r.v, 0), pm = e.rows.filter(r => r.m > 13 * 60).reduce((x, r) => x + r.v, 0);
      const isHalf = e.rows.length < 390 && (am === 0 || pm < 0.50 * am);
      if (am > 0 && !isHalf) full.add(d); else half.push(d); }
    const groups: Record<string, any[]> = { "3x": [], "4x": [], "5x": [], "6x+": [], all: [] };
    const coverage: any[] = [];
    const W = (j.winners as any[]).filter(w => removalReasons(w.flags).length === 0);
    for (const w of W) {
      const bars = loadMinutes(p, w.symbol);
      if (!bars) { coverage.push({ symbol: w.symbol, missing_file: true }); continue; }
      const dailyDays = new Set((w.daily as any[]).map(r => r.t));
      const keep = (d: string) => full.has(d) && dailyDays.has(d) && d >= w.start && d <= w.end;
      const r = processStock(bars, keep);
      // Coverage: compare against the daily bars.
      let noMin = 0, minutesExpected = 0, minutesWith = 0; let firstMinDay: string | null = null;
      for (const d of [...r.days.keys()].sort()) { if (d >= w.start) { firstMinDay = d; break; } }
      for (const d of dailyDays) { const e = r.days.get(d); if (!e || !e.rows.length) { noMin++; continue; }
        if (full.has(d)) { minutesExpected += 390; minutesWith += new Set(e.rows.map(x => x.m)).size; } }
      coverage.push({ symbol: w.symbol, group: w.group, start: w.start, end: w.end, daily_days: dailyDays.size, days_used: r.used,
        days_with_daily_bar_but_no_minutes: noMin, first_minute_day: firstMinDay, late_start: firstMinDay !== null && firstMinDay > w.start,
        share_minutes_without_trade: minutesExpected ? 1 - minutesWith / minutesExpected : null });
      const per = { symbol: w.symbol, acc: r.acc };
      groups[w.group].push(per); groups.all.push(per);
    }
    // Benchmarks over every full day of the period.
    const bench: any = {};
    for (const s of ["SPY", "QQQ"]) { const b = loadMinutes(p, s); if (b) bench[s] = processStock(b, d => full.has(d), true).acc; }
    // Summaries per group and weekday.
    const out: any = { period: p, full_days: full.size, half_days: half.sort(), groups: {}, bench: {}, coverage };
    for (const [g, list] of Object.entries(groups)) {
      out.groups[g] = {};
      for (const wd of ["all", ...WD]) {
        const stocks = list.map(x => x.acc[wd]).filter(a => a.n > 0);
        const vstocks = list.map(x => x.acc[wd]).filter(a => a.nv > 0);
        const sl = [];
        let posAll = 0, negAll = 0; const posK = new Array(NS).fill(0), negK = new Array(NS).fill(0);
        for (const a of stocks) for (let k = 0; k < NS; k++) { posK[k] += a.pos[k]; negK[k] += a.neg[k]; posAll += a.pos[k]; negAll += a.neg[k]; }
        for (let k = 0; k < NS; k++) {
          const r = stocks.map(a => a.ret[k] / a.n), u = stocks.map(a => a.up[k] / a.n), v = vstocks.map(a => a.share[k] / a.nv);
          sl.push({ k, ret_mean: mean(r), ret_median: median(r), up_mean: mean(u), up_median: median(u), gain_share: posAll ? posK[k] / posAll : null, loss_share: negAll ? negK[k] / negAll : null, vol_mean: mean(v), vol_median: median(v) });
        }
        const pdm = pickupDropoff(sl.map(x => x.vol_mean ?? 0)), pdd = pickupDropoff(sl.map(x => x.vol_median ?? 0));
        out.groups[g][wd] = { stocks: stocks.length, stock_days: stocks.reduce((x, a) => x + a.n, 0), slices: sl, mean_curve: { drop_off_ct: pdm.drop_off_ct, pick_up_ct: pdm.pick_up_ct }, median_curve: { drop_off_ct: pdd.drop_off_ct, pick_up_ct: pdd.pick_up_ct } };
      }
    }
    for (const [s, acc] of Object.entries(bench) as [string, any][]) {
      out.bench[s] = {};
      for (const wd of ["all", ...WD]) {
        const a = acc[wd];
        const sl = []; for (let k = 0; k < NS; k++) { const days = a.shareDays.map((x: number[]) => x[k]);
          sl.push({ k, ret_mean: a.n ? a.ret[k] / a.n : null, ret_median: median(a.retDays.map((x: number[]) => x[k])), up_mean: a.n ? a.up[k] / a.n : null, vol_mean: a.nv ? a.share[k] / a.nv : null, vol_median: median(days) }); }
        const pdm = pickupDropoff(sl.map(x => x.vol_mean ?? 0)), pdd = pickupDropoff(sl.map(x => x.vol_median ?? 0));
        out.bench[s][wd] = { days: a.n, slices: sl, mean_curve: { drop_off_ct: pdm.drop_off_ct, pick_up_ct: pdm.pick_up_ct }, median_curve: { drop_off_ct: pdd.drop_off_ct, pick_up_ct: pdd.pick_up_ct } };
      }
    }
    writeJson(join(WORK3, `tod-${p}.json`), out);
    const g = out.groups.all.all, sp = out.bench.SPY?.all;
    console.log(`period ${p}: full days ${full.size}, half days ${half.length}; winners with minutes ${groups.all.length}; all winners drop off ${g.mean_curve.drop_off_ct} pick up ${g.mean_curve.pick_up_ct}; SPY drop off ${sp?.mean_curve.drop_off_ct} pick up ${sp?.mean_curve.pick_up_ct}`);
  }
}
