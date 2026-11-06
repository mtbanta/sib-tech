// Step 3: from the cached monthly bars, (1) drop duplicate histories (Alpaca files a company's history
// under its current symbol, and an old symbol can return the same bars), (2) keep, per period, every
// symbol that could have reached 4x inside the period: some month's high at least 4 times an earlier
// (or the same) month's low. That is a superset of the winners under every start and end rule.
// Writes data/work/monthly-index.json and data/work/candidates.json.
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { DATA, readJson, writeJson } from "./common.ts";
import { PERIODS, type PeriodId } from "./periods.ts";

type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };
const all: Record<string, Bar[]> = {};
for (const f of readdirSync(join(DATA, "raw", "monthly")).sort()) {
  const j = readJson(join(DATA, "raw", "monthly", f));
  // Months with zero volume are filler (no trade) and are dropped.
  for (const [s, b] of Object.entries(j.bars as Record<string, Bar[]>)) { const t = b.filter(x => x.v > 0); if (t.length) all[s] = t; }
}
const listed = new Set<string>();
for (const f of ["nasdaqlisted.txt", "otherlisted.txt"])
  for (const l of readFileSync(join(DATA, "raw", "lists", f), "utf8").split(/\r?\n/).slice(1)) { const s = l.split("|")[0]; if (s) listed.add(s); }

// Duplicate detection: two symbols sharing 3 or more identical monthly bars carry the same history.
const byKey = new Map<string, string[]>();
for (const [s, b] of Object.entries(all)) for (const x of b) {
  if (x.v < 1000) continue; // tiny bars can coincide by chance
  const k = `${x.t}|${x.o}|${x.h}|${x.l}|${x.c}|${x.v}`;
  const a = byKey.get(k); a ? a.push(s) : byKey.set(k, [s]);
}
const pair = new Map<string, number>();
for (const a of byKey.values()) if (a.length > 1 && a.length < 6)
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { const k = [a[i], a[j]].sort().join(" "); pair.set(k, (pair.get(k) ?? 0) + 1); }
// Union-find over duplicate pairs.
const parent: Record<string, string> = {};
const find = (s: string): string => (parent[s] ??= s) === s ? s : (parent[s] = find(parent[s]));
for (const [k, n] of pair) if (n >= 3) { const [a, b] = k.split(" "); parent[find(a)] = find(b); }
const groups = new Map<string, string[]>();
for (const s of Object.keys(all)) { const r = find(s); const g = groups.get(r); g ? g.push(s) : groups.set(r, [s]); }
// Keep, in each group: a symbol on today's Nasdaq Trader lists, else the one with the latest last bar,
// else the longest history.
const keep: Record<string, string[]> = {};
for (const g of groups.values()) {
  g.sort((a, b) => (Number(listed.has(b)) - Number(listed.has(a))) || (all[b].at(-1)!.t.localeCompare(all[a].at(-1)!.t)) || (all[b].length - all[a].length));
  keep[g[0]] = g.slice(1);
}
const dupCount = Object.values(keep).reduce((n, a) => n + a.length, 0);

const candidates: Record<PeriodId, string[]> = { A: [], B: [], C: [], D: [] };
for (const s of Object.keys(keep)) {
  const b = all[s];
  for (const [p, { from, to }] of Object.entries(PERIODS) as [PeriodId, any][]) {
    const m0 = from.slice(0, 7), m1 = to.slice(0, 7);
    const w = b.filter(x => x.t.slice(0, 7) >= m0 && x.t.slice(0, 7) <= m1);
    let minLow = Infinity, best = 0;
    for (const x of w) { minLow = Math.min(minLow, x.l); if (minLow > 0) best = Math.max(best, x.h / minLow); }
    if (best >= 4) candidates[p].push(s);
  }
}
writeJson(join(DATA, "work", "monthly-index.json"), { symbolsWithData: Object.keys(all).length, kept: Object.keys(keep).length, duplicates: keep });
writeJson(join(DATA, "work", "candidates.json"), candidates);
console.log("symbols with any bar:", Object.keys(all).length, "duplicate symbols dropped:", dupCount, "kept:", Object.keys(keep).length);
for (const p of Object.keys(candidates)) console.log("period", p, "candidates", candidates[p as PeriodId].length);
