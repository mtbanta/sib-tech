// Run 3 step 6 (change 5): market cap at each winner's start and end date, filling as many of run 1's gaps
// as free sources allow. Methods, tried in order for each date:
//  (a) run 1's method: SEC company facts, dei EntityCommonStockSharesOutstanding, report nearest the date
//      within 200 days, times Alpaca's unadjusted close that day (share count restated across splits);
//  (b) the filing's own XBRL cover page (R1.htm in the filing folder at SEC) for the periodic report
//      (10-K, 10-Q, 20-F, 40-F) filed nearest the date, within 200 days (400 for annual 20-F and 40-F filers):
//      every "Entity Common Stock, Shares Outstanding" value is added (all share classes), times the listed
//      class's unadjusted close;
//  (c) ADRs: the same cover page's ordinary share count divided by the ADR ratio stated in its "Title of
//      12(b) Security" (for example "each representing two ordinary shares"), else the ratio from the
//      nearest filing that states one (noted), times the ADR's unadjusted close;
//  (d) share counts found by further research, in scripts/r3-manual-caps.json (each with the SEC filing URL, a quote
//      and the access date; predecessor-company filings where the company was reorganized; GOL and GGB left out
//      because the traded ADS is a preferred share), valued at Alpaca's unadjusted close;
//  otherwise "unknown". Then run 1's consistency check: if (end cap / start cap) / price multiple is above
//  20 or below 0.05 the share counts are inconsistent and both values are set to unknown.
// Network: SEC (cached under data/raw/sec/r1/) and Alpaca market data (cached under data/raw/capdaily/).
// Writes data/work/r3/caps.json.
import { join } from "node:path";
import { statSync } from "node:fs";
import { DATA, exists, readJson, writeJson, cachedFetch } from "./common.ts";
import { ALPACA_FLOOR, type PeriodId } from "./periods.ts";
import { submissions, companyFacts } from "./sec.ts";
import { WORK3, removalReasons } from "./r3-common.ts";
import { parseCover, num } from "./r3-cover.ts";

type Bar = { t: string; c: number };
const d10 = (t: string) => t.slice(0, 10);
const mtime = (f: string) => exists(f) ? new Date(statSync(f).mtimeMs).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) : "";
async function dayBars(sym: string, start: string, end: string, adjustment: "raw" | "split"): Promise<{ bars: Bar[]; file: string }> {
  const file = join(DATA, "raw", "capdaily", `${sym}-${start}-${end}-${adjustment}.json`);
  if (exists(file)) return { bars: readJson(file), file };
  const { bars } = await import("./alpaca-data.ts");
  const r = await bars([sym], { timeframe: "1Day", start, end, adjustment, feed: "sip" });
  writeJson(file, r[sym] ?? []);
  return { bars: r[sym] ?? [], file };
}
const coverFailures: string[] = []; // SEC answered with server errors after retries; counted as no cover page
async function cover(cik: number, acc: string) {
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, "")}/R1.htm`;
  const file = join(DATA, "raw", "sec", "r1", acc + ".htm");
  try { const html = (await cachedFetch(url, file, 260)).toString(); return { ...parseCover(html), url, accessed: mtime(file) }; }
  catch (e: any) { if (e.status === 404) return null; if (/gave up/.test(String(e.message))) { coverFailures.push(url); return null; } throw e; }
}
// The ADR ratio from a filing's main document text.
async function docRatio(cik: number, acc: string, doc: string) {
  if (!doc) return null;
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, "")}/${doc}`;
  let html: string;
  try { html = (await cachedFetch(url, join(DATA, "raw", "sec", "docs", acc + "-" + doc.replace(/[^\w.]/g, "_")), 260)).toString("latin1"); }
  catch (e: any) { if (e.status === 404 || /gave up/.test(String(e.message))) return null; throw e; }
  const text = html.replace(/<[^>]*>/g, " ").replace(/&#160;|&nbsp;|&#xa0;/gi, " ").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/\s+/g, " ");
  const re = /(?:each|one|every) (?:ADS|ADSs|American Depositary Shares?|depositary share)\b[^.;]{0,60}?\b(?:represents?|representing|evidences|is equal to|equals)\s+(?:the right to receive\s+)?([\w\-.,]+(?: hundred)?)\s+(?:\(\d+(?:\.\d+)?\)\s+)?(?:of (?:our|the company's)\s+)?(?:fully paid\s+)?(?:ordinary|common|class [a-z] (?:ordinary|common)|shares?\b|preferred)/i;
  // Only the cover section (the first 25,000 characters of text), where the registered securities and their
  // current ratio are listed; later sections can quote ratios that no longer apply.
  // A ratio change is written "changed from one ADS representing four ... to one ADS representing one ...":
  // a match right after the word "from" is the old ratio and is skipped.
  const cover = text.slice(0, 25000); const g = new RegExp(re.source, "gi"); let m: RegExpExecArray | null = null, x: RegExpExecArray | null;
  while ((x = g.exec(cover))) { if (/\bfrom\s*$/i.test(cover.slice(Math.max(0, x.index - 12), x.index))) continue; m = x; break; }
  if (!m) return null;
  const n = num(m[1]); if (!n) return null;
  return { ratio: n, text: m[0].slice(0, 160), url };
}
function sharesNear(facts: any, date: string) {
  const arr = facts?.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares as any[] | undefined;
  if (!arr?.length) return null;
  let best: any = null, bestGap = Infinity;
  for (const x of arr) { const g = Math.abs(Date.parse(x.end) - Date.parse(date)) / 864e5; if (g < bestGap) { bestGap = g; best = x; } }
  return bestGap <= 200 ? { val: best.val as number, end: best.end as string } : null;
}

const manual = exists(join(import.meta.dirname, "r3-manual-caps.json")) ? readJson(join(import.meta.dirname, "r3-manual-caps.json")) : {};
const out: Record<string, any> = exists(join(WORK3, "caps.json")) ? readJson(join(WORK3, "caps.json")) : {};
const tally: Record<string, number> = {};
for (const p of ["B", "C", "D", "A"] as PeriodId[]) {
  const f = join(WORK3, `period-${p}.json`); if (!exists(f)) continue;
  const j = readJson(f);
  for (const w of j.winners as any[]) {
    if (removalReasons(w.flags).length) continue;
    const key = `${p}:${w.symbol}`;
    const adr = w.flags.includes("ADR");
    const lo = new Date(Date.parse(w.start) - 220 * 864e5).toISOString().slice(0, 10), lo2 = lo < ALPACA_FLOOR ? ALPACA_FLOOR : lo;
    const raw = await dayBars(w.symbol, lo2, w.end, "raw"), adj = await dayBars(w.symbol, lo2, w.end, "split");
    const rawBy = new Map(raw.bars.map(b => [d10(b.t), b.c])), adjBy = new Map(adj.bars.map(b => [d10(b.t), b.c]));
    const rawDays = [...rawBy.keys()].sort();
    const factor = (d: string) => { const k = rawDays.filter(x => x <= d).at(-1) ?? rawDays[0]; if (!k || !adjBy.get(k)) return null; return rawBy.get(k)! / adjBy.get(k)!; };
    const priceSrc = { file: raw.file, accessed: mtime(raw.file) };
    const facts = w.cik ? await companyFacts(w.cik) : null;
    const sub = w.cik ? await submissions(w.cik) : null;
    const periodic: { date: string; form: string; acc: string; doc: string }[] = [];
    if (sub) { const r = sub.filings.recent; for (let i = 0; i < r.form.length; i++) if (/^(10-K|10-Q|20-F|40-F|10-KT|10-K\/A|20-F\/A)$/.test(r.form[i])) periodic.push({ date: r.filingDate[i], form: r.form[i], acc: r.accessionNumber[i], doc: r.primaryDocument?.[i] ?? "" }); }
    const annual = periodic.some(x => /^(20-F|40-F)/.test(x.form)) && !periodic.some(x => x.form === "10-Q");
    const restate = (shares: number, asOf: string, d: string) => { const fS = factor(asOf), fD = factor(d); return fS && fD ? shares * fS / fD : shares; };
    const ratioCache: { date: string; ratio: number; text: string; url: string }[] = [];
    const one = async (d: string) => {
      const px = rawBy.get(d); if (!px) return { cap: null, method: "unknown", note: "no unadjusted close on the date" };
      // (a) run 1's method
      if (!adr && facts) { const s = sharesNear(facts, d); if (s) { const sh = restate(s.val, s.end, d);
        return { cap: sh * px, method: "SEC company facts (dei EntityCommonStockSharesOutstanding) x Alpaca unadjusted close", shares: sh, price: px, asOf: s.end, url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(w.cik).padStart(10, "0")}.json`, accessed: mtime(join(DATA, "raw", "sec", "facts", String(w.cik).padStart(10, "0") + ".json")), note: `price: Alpaca market data, accessed ${priceSrc.accessed}` }; } }
      // (b), (c) the cover page of the nearest periodic report
      const lim = annual ? 400 : 200;
      const near = periodic.map(x => ({ ...x, gap: Math.abs(Date.parse(x.date) - Date.parse(d)) / 864e5 })).filter(x => x.gap <= lim).sort((a, b) => a.gap - b.gap).slice(0, 3);
      for (const f of near) {
        const c = await cover(w.cik, f.acc); if (!c || !c.shares) continue;
        if (c.ratio) ratioCache.push({ date: f.date, ratio: c.ratio, text: c.ratioText, url: c.url });
        if (!adr) { const sh = restate(c.shares, f.date, d);
          return { cap: sh * px, method: `SEC filing cover page (${f.form} filed ${f.date}), all ${c.nShareRows} share class value(s) added, x Alpaca unadjusted close`, shares: sh, price: px, asOf: f.date, url: c.url, accessed: c.accessed, note: `price: Alpaca market data, accessed ${priceSrc.accessed}` }; }
        let ratio = c.ratio, rnote = "";
        if (!ratio) { // nearest filing of any date that states the ratio
          for (const g of periodic.filter(x => /^(20-F|40-F|10-K)/.test(x.form)).sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(f.date)) - Math.abs(Date.parse(b.date) - Date.parse(f.date))).slice(0, 4)) {
            const c2 = await cover(w.cik, g.acc); if (c2?.ratio) { ratio = c2.ratio; rnote = `ratio from ${g.form} filed ${g.date} (${c2.url}): "${c2.ratioText.slice(0, 120)}"`; break; } }
          // else the annual report's own text, same filing first ("each ADS represents two ordinary shares")
          if (!ratio) for (const g of [f, ...periodic.filter(x => /^(20-F|40-F)/.test(x.form) && x.acc !== f.acc).sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(f.date)) - Math.abs(Date.parse(b.date) - Date.parse(f.date))).slice(0, 2)]) {
            const t = await docRatio(w.cik, g.acc, g.doc); if (t) { ratio = t.ratio; rnote = `ratio from the text of ${g.form} filed ${g.date} (${t.url}): "${t.text}"`; break; } }
        } else rnote = `ratio from the same cover: "${c.ratioText.slice(0, 120)}"`;
        if (!ratio) continue;
        const ads = restate(c.shares / ratio, f.date, d);
        return { cap: ads * px, method: `ADR: SEC filing cover page (${f.form} filed ${f.date}) ordinary shares / ADR ratio ${ratio}, x Alpaca unadjusted ADR close`, shares: c.shares, ratio, price: px, asOf: f.date, url: c.url, accessed: c.accessed, note: rnote + `; price: Alpaca market data, accessed ${priceSrc.accessed}` };
      }
      // (d) web research
      // Each entry: a share count read from a cited page (ordinary shares and the ADR ratio for an ADR), valued here
      // at Alpaca's unadjusted close and restated across splits; or a market cap read directly from a cited page.
      const m = manual[`${p}:${w.symbol}:${d}`];
      if (m && m.shares) { const ads = restate(m.shares / (m.ratio ?? (adr ? NaN : 1)), m.asOf, d); // a ratio given for an ADS listing not flagged ADR is applied too
        if (Number.isFinite(ads)) return { cap: ads * px, method: `further research, SEC filing read by hand: shares outstanding${m.ratio ? " / ADR ratio " + m.ratio : ""} from a cited page, x Alpaca unadjusted close`, shares: m.shares, ratio: m.ratio ?? null, price: px, asOf: m.asOf, url: m.url, accessed: m.accessed, note: `quote: "${String(m.quote ?? "").slice(0, 140)}"${m.ratioUrl ? "; ratio from " + m.ratioUrl : ""}${m.note ? "; " + m.note : ""}; strength ${m.strength ?? "see URL"}` }; }
      if (m && m.marketCap) return { cap: m.marketCap, method: "further research: market cap read from a cited page", asOf: m.asOf, url: m.url, accessed: m.accessed, note: `quote: "${String(m.quote ?? "").slice(0, 140)}"${m.note ? "; " + m.note : ""}; strength ${m.strength ?? "see URL"}` };
      return { cap: null, method: "unknown", note: w.cik ? (adr ? "ADR: no cover page share count and ratio found" : "no share count within the window at SEC") : "no SEC company found" };
    };
    const a: any = await one(w.start), b: any = await one(w.end);
    if (a.cap && b.cap) { const r = (b.cap / a.cap) / w.ratio; if (r > 20 || r < 0.05) { a.note = b.note = `share counts inconsistent with the price multiple (cap ratio / multiple = ${r.toFixed(2)}); set to unknown`; a.cap = b.cap = null; a.method = b.method = "unknown"; } }
    out[key] = { start: a, end: b };
    for (const x of [a, b]) { const k = x.method.split(" (")[0].split(":")[0]; tally[k] = (tally[k] ?? 0) + 1; }
  }
  writeJson(join(WORK3, "caps.json"), out);
  console.log("period", p, "done");
}
console.log(tally, "cover pages that failed after retries:", coverFailures.length, coverFailures.slice(0, 5).join(" "));
