// Step 5: find the winners and measure them. Reads the cached daily bars, looks up SEC filings for the
// stocks that need them (cached under data/raw/sec), fetches unadjusted daily bars for winners
// (cached under data/raw/rawdaily) for market cap, and writes data/work/period-<P>.json.
// Network calls happen only when a cache file is missing.
// Usage: node scripts/05-build.ts B C D
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { DATA, exists, readJson, writeJson } from "./common.ts";
import { PERIODS, ALPACA_FLOOR, type PeriodId } from "./periods.ts";
import { submissions, companyFacts, nameLookup, cusipSearch, form25 } from "./sec.ts";
import { dailyFile } from "./04-fetch-daily.ts";

type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };
const d10 = (t: string) => t.slice(0, 10);

// ---------- reference lists ----------
type Listing = { symbol: string; name: string; exchange: string; etf: boolean; test: boolean };
const listing = new Map<string, Listing>();
{
  const nl = readFileSync(join(DATA, "raw", "lists", "nasdaqlisted.txt"), "utf8").split(/\r?\n/).slice(1);
  for (const l of nl) { const f = l.split("|"); if (f.length < 8 || f[0].startsWith("File Creation")) continue; listing.set(f[0], { symbol: f[0], name: f[1], exchange: "Nasdaq", etf: f[6] === "Y", test: f[3] === "Y" }); }
  const ex: Record<string, string> = { N: "NYSE", A: "NYSE American", P: "NYSE Arca", Z: "Cboe BZX", V: "IEX" };
  const ol = readFileSync(join(DATA, "raw", "lists", "otherlisted.txt"), "utf8").split(/\r?\n/).slice(1);
  for (const l of ol) { const f = l.split("|"); if (f.length < 8 || f[0].startsWith("File Creation")) continue; listing.set(f[0], { symbol: f[0], name: f[1], exchange: ex[f[2]] ?? f[2], etf: f[4] === "Y", test: f[6] === "Y" }); }
}
const secTickers = new Map<string, { cik: number; name: string; exchange: string }>();
{
  const j = readJson(join(DATA, "raw", "lists", "company_tickers_exchange.json"));
  for (const row of j.data) { const [cik, name, ticker, exchange] = row; if (!secTickers.has(ticker)) secTickers.set(ticker, { cik, name, exchange: exchange ?? "" }); }
}
// Fails-to-deliver: symbol -> latest description and CUSIP seen (names for symbols no longer listed).
const ftdAll = readJson<Record<string, { d: string; cusip: string; first: string; last: string }[]>>(join(DATA, "work", "ftd-index.json"));
// The fails-to-deliver entry for a symbol nearest to a date (a reused ticker has several CUSIPs).
function ftdNear(sym: string, date: string) {
  const list = ftdAll[sym]; if (!list?.length) return undefined;
  const dist = (e: { first: string; last: string }) => date < e.first ? Date.parse(e.first) - Date.parse(date) : date > e.last ? Date.parse(date) - Date.parse(e.last) : 0;
  const best = [...list].sort((a, b) => dist(a) - dist(b))[0];
  return dist(best) <= 365 * 864e5 ? best : undefined; // a record far from the date may be another company
}
const monthlyIdx = readJson(join(DATA, "work", "monthly-index.json"));
const dupOf: Record<string, string[]> = monthlyIdx.duplicates;

// The exchange that filed a Form 25-NSE is the filer in its accession number; its name comes from SEC.
function exchangeLabel(n: string): string {
  if (/nasdaq/i.test(n)) return "Nasdaq";
  if (/nyse american|nyse mkt|american stock exchange|nyse amex/i.test(n)) return "NYSE American";
  if (/arca/i.test(n)) return "NYSE Arca";
  if (/new york stock exchange|^nyse/i.test(n)) return "NYSE";
  if (/cboe|bats/i.test(n)) return "Cboe";
  return `other (${n})`;
}

// ---------- daily bars ----------
// Only this period's candidates (from the screen) are read, so stale cache files are ignored.
const cands = readJson<Record<PeriodId, string[]>>(join(DATA, "work", "candidates.json"));
function loadDaily(p: PeriodId): Record<string, Bar[]> {
  const out: Record<string, Bar[]> = {};
  // Bars with zero volume are filler (no trade that day) and are dropped.
  for (const s of ["SPY", "QQQ", ...cands[p]]) { const f = dailyFile(p, s); if (exists(f)) out[s] = (readJson(f) as Bar[]).filter(b => b.v > 0); }
  return out;
}

// ---------- name-based security type ----------
function typeFromName(name: string): string | null {
  const n = name.toLowerCase();
  if (/\bwarrants?\b|\bwts?\b/.test(n)) return "warrant";
  if (/\bunits?\b/.test(n) && !/unit corp|united|limited partner|partnership|\bl\.?p\.?\b|partners/.test(n)) return "unit";
  if ((/\brights?\b/.test(n) && !/rights? (holdings|inc|corp)/.test(n)) || /\brts\b|contingent val/.test(n)) return "right";
  if (/preferred|\bpfd\b|perpetual|cumulative/.test(n)) return "preferred";
  if (/\bnotes? due\b|\bdebentures?\b|senior notes|subordinated notes|\b\d+(\.\d+)?% notes/.test(n)) return "note";
  if (/\btr\b.*\b20\d\d\b|longevity|stone ri?dge|\betf\b|\betn\b|exchange[- ]traded|\bfund\b|ishares|proshares|direxion|invesco qqq|spdr|leveraged|inverse|2x|3x|ultrapro|ultra short|ultrashort/.test(n)) return "fund";
  return null;
}
const isPartnershipName = (name: string) => /limited partner|partnership units|common units|\bl\.p\.|\blp\b/i.test(name);
// Nasdaq's fifth-letter convention: W warrant, R right, U unit.
function typeFromSymbol(sym: string): string | null {
  if (/^[A-Z]{4}W$/.test(sym) || /\.W[SI]?$|-W[ST]?$/.test(sym)) return "warrant";
  if (/^[A-Z]{4}R$/.test(sym) || /\.R$|-R$/.test(sym)) return "right";
  if (/^[A-Z]{4}U$/.test(sym) || /\.U$|-U$/.test(sym)) return "unit";
  if (/^[A-Z]{4}Z$/.test(sym)) return "other security (Nasdaq fifth letter Z)";
  return null;
}
const isAdrName = (name: string) => /american depositary|\badrs?\b|\bads\b|depositary shares|sponsored adr|spon adr/i.test(name);

// ---------- SEC helpers ----------
// Has the issuer behind this ticker changed since the given date? (CUSIP issuer code, first 6 characters)
function issuerChangedSince(sym: string, date: string): boolean {
  const a = ftdNear(sym, date), b = ftdNear(sym, "2026-10-31");
  return !!(a && b && a.cusip.slice(0, 6) !== b.cusip.slice(0, 6));
}
async function cikFor(sym: string, listedToday: boolean, near: string): Promise<{ cik: number | null; via: string }> {
  const t = secTickers.get(sym) ?? secTickers.get(sym.replace(".", "-"));
  // Alpaca files a history under the company using the symbol today, so a listed symbol is today's company.
  if (t && listedToday) return { cik: t.cik, via: "SEC company tickers" };
  const f = ftdNear(sym, near);
  if (f) {
    const hit = await cusipSearch(f.cusip, f.d);
    if (hit && hit.hits >= 2) return { cik: hit.cik, via: `EDGAR full-text search for CUSIP ${f.cusip} (${hit.hits} filings)` };
  }
  if (f) {
    const cleaned = f.d.replace(/\b(COM|COMMON STOCK|CL A|CLASS A|NEW|SHS|ORD|INC DEL|DEL|SPONSORED ADR|SPON ADR|ADR|ADS)\b.*$/i, "").replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
    for (let k = cleaned.length; k >= 2; k--) { // drop truncated trailing words one at a time
      const name = cleaned.slice(0, k).join(" ");
      if (name.length < 4) break;
      const r = await nameLookup(name);
      const hit = r?.hits?.hits?.[0];
      if (hit) return { cik: Number(hit._id), via: `EDGAR name lookup "${name}"` };
    }
  }
  if (t) return { cik: t.cik, via: "SEC company tickers (not on today's exchange lists)" };
  return { cik: null, via: "not found" };
}
type Filing = { date: string; accepted: string; form: string; items: string; acc: string; doc: string };
function filingsOf(sub: any): Filing[] {
  const r = sub.filings.recent; const out: Filing[] = [];
  for (let i = 0; i < r.form.length; i++) out.push({ date: r.filingDate[i], accepted: r.acceptanceDateTime[i], form: r.form[i], items: r.items?.[i] ?? "", acc: r.accessionNumber[i], doc: r.primaryDocument?.[i] ?? "" });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
// Date in New York of an SEC acceptance time (UTC).
const nyDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });

// ---------- metrics ----------
const ln = Math.log;
function measure(rows: Bar[], prevClose: number | null) {
  // rows: the measured trading days, first to last; prevClose: close before the first measured day.
  let up_oc = 0, down_oc = 0, flat_oc = 0, up_cc = 0, down_cc = 0, flat_cc = 0;
  let intraLog = 0, overLog = 0;
  const upOcGains: number[] = [], upCcGains: number[] = [];
  const daily: any[] = [];
  let pc = prevClose;
  rows.forEach((b, i) => {
    const oc = b.c / b.o - 1;
    const gap = pc ? b.o / pc - 1 : null;
    const cc = pc ? b.c / pc - 1 : null;
    intraLog += ln(b.c / b.o);
    if (i > 0 && pc) overLog += ln(b.o / pc);
    if (b.c > b.o) { up_oc++; upOcGains.push(oc); } else if (b.c < b.o) down_oc++; else flat_oc++;
    if (cc !== null) { if (cc > 0) { up_cc++; upCcGains.push(cc); } else if (cc < 0) down_cc++; else flat_cc++; }
    daily.push({ t: d10(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, oc_d: b.c - b.o, oc, gap_d: pc ? b.o - pc : null, gap, cc, up_oc: b.c > b.o, up_cc: cc === null ? null : cc > 0, rise_d: b.h - b.o, rise: b.h / b.o - 1, drop_d: b.o - b.l, drop: 1 - b.l / b.o, measured_gap: i > 0 });
    pc = b.c;
  });
  const total = ln(rows.at(-1)!.c / rows[0].o);
  const avg = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const aOc = avg(upOcGains), aCc = avg(upCcGains);
  return {
    days: rows.length, up_oc, down_oc, flat_oc, up_cc, down_cc, flat_cc,
    avg_up_oc: aOc, up_oc_above: aOc === null ? 0 : upOcGains.filter(g => g > aOc).length, up_oc_below: aOc === null ? 0 : upOcGains.filter(g => g <= aOc).length,
    avg_up_cc: aCc, up_cc_above: aCc === null ? 0 : upCcGains.filter(g => g > aCc).length, up_cc_below: aCc === null ? 0 : upCcGains.filter(g => g <= aCc).length,
    log_total: total, log_intraday: intraLog, log_overnight: overLog,
    share_intraday: intraLog / total, share_overnight: overLog / total,
    daily,
  };
}

// ---------- unadjusted bars (for market cap) ----------
async function dayBars(sym: string, start: string, end: string, adjustment: "raw" | "split"): Promise<Bar[]> {
  const file = join(DATA, "raw", "capdaily", `${sym}-${start}-${end}-${adjustment}.json`);
  if (exists(file)) return readJson(file);
  const { bars } = await import("./alpaca-data.ts");
  const r = await bars([sym], { timeframe: "1Day", start, end, adjustment, feed: "sip" });
  writeJson(file, r[sym] ?? []);
  return r[sym] ?? [];
}
function sharesNear(facts: any, date: string): { val: number; end: string } | null {
  const arr = facts?.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares as any[] | undefined;
  if (!arr?.length) return null;
  let best: any = null, bestGap = Infinity;
  for (const x of arr) { const g = Math.abs(Date.parse(x.end) - Date.parse(date)) / 864e5; if (g < bestGap) { bestGap = g; best = x; } }
  return bestGap <= 200 ? { val: best.val, end: best.end } : null;
}
async function marketCaps(sym: string, cik: number | null, adr: boolean, start: string, end: string) {
  if (adr) return { cap_start: null, cap_end: null, cap_note: "ADR: share count is in ordinary shares, ratio not handled; left blank" };
  if (!cik) return { cap_start: null, cap_end: null, cap_note: "no SEC company found" };
  const facts = await companyFacts(cik);
  const lo = new Date(Date.parse(start) - 220 * 864e5).toISOString().slice(0, 10);
  const lo2 = lo < ALPACA_FLOOR ? ALPACA_FLOOR : lo;
  const raw = await dayBars(sym, lo2, end, "raw");
  const rawBy = new Map(raw.map(b => [d10(b.t), b.c]));
  const adj = new Map((await dayBars(sym, lo2, end, "split")).map(b => [d10(b.t), b.c]));
  const factor = (d: string) => { // unadjusted / split-adjusted close on or before d
    const days = [...rawBy.keys()].filter(x => x <= d).sort(); const k = days.at(-1);
    if (!k || !adj.get(k)) return null; return rawBy.get(k)! / adj.get(k)!;
  };
  const one = (d: string) => {
    const s = sharesNear(facts, d); const px = rawBy.get(d);
    if (!s || !px) return null;
    const fS = factor(s.end), fD = factor(d);
    const shares = fS && fD ? s.val * fS / fD : s.val; // restate the share count across any split
    return { cap: shares * px, asOf: s.end };
  };
  const a = one(start), b = one(end);
  const notes: string[] = [];
  if (!a) notes.push("start cap missing (no SEC share count within 200 days)");
  if (!b) notes.push("end cap missing (no SEC share count within 200 days)");
  return { cap_start: a?.cap ?? null, cap_end: b?.cap ?? null, cap_note: notes.join("; ") || `shares from SEC cover page (${a?.asOf}, ${b?.asOf}) times unadjusted close` };
}

// ---------- per period ----------
const which = (process.argv.slice(2).length ? process.argv.slice(2) : ["B", "C", "D"]) as PeriodId[];
for (const p of which) {
  const { from, to } = PERIODS[p];
  const all = loadDaily(p);
  const spy = all.SPY, qqq = all.QQQ;
  const cal = spy.map(b => d10(b.t)).filter(d => d >= from && d <= to);
  const first = cal[0], last = cal.at(-1)!;
  const cutoff = (() => { const d = new Date(last + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 3); return d.toISOString().slice(0, 10); })();
  const bench = (b: Bar[]) => { const m = new Map<string, { oc: number; cc: number | null }>(); let pc: number | null = null; for (const x of b) { m.set(d10(x.t), { oc: x.c / x.o - 1, cc: pc ? x.c / pc - 1 : null }); pc = x.c; } return m; };
  const bSpy = bench(spy), bQqq = bench(qqq);

  const winners: any[] = [], excluded: any[] = [], otherExchange: any[] = [], reviewed: any[] = [];
  const stats = { candidates: 0, prelim: 0, secLookups: 0 };
  for (const [sym, barsAll] of Object.entries(all)) {
    if (sym === "SPY" || sym === "QQQ") continue;
    stats.candidates++;
    const inP = barsAll.filter(b => d10(b.t) >= first && d10(b.t) <= last);
    if (inP.length < 2) continue;
    const before = barsAll.filter(b => d10(b.t) < first);
    const firstBar = d10(inP[0].t), lastBar = d10(inP.at(-1)!.t);
    const newListing = firstBar > first || (p === "A" && firstBar === ALPACA_FLOOR && false);
    const endedEarly = lastBar < last;
    // Gaps inside the history (ticker reuse or a long halt): more than 30 calendar days between bars.
    let gapFlag = false;
    for (let i = 1; i < inP.length; i++) if ((Date.parse(inP[i].t) - Date.parse(inP[i - 1].t)) / 864e5 > 30) gapFlag = true;
    const lastClose = inP.at(-1)!.c;
    const minOpen = Math.min(...inP.map(b => b.o));
    const stdGain = lastClose / inP[0].o;
    const spacLike = inP[0].o >= 9 && inP[0].o <= 11.5;
    // Superset filter before any SEC lookup.
    const hasSwitch = (ftdAll[sym] ?? []).filter(e => e.last >= new Date(Date.parse(first) - 400 * 864e5).toISOString().slice(0, 10) && e.first <= last).length > 1;
    if (!(stdGain >= 4 || ((newListing || spacLike || hasSwitch) && lastClose / minOpen >= 4))) continue;
    stats.prelim++;

    // ----- classify -----
    const lst0 = listing.get(sym);
    if (lst0?.test) continue; // exchange test symbols
    // A symbol on today's lists whose history here ended early, and whose CUSIP issuer changed since, was
    // reused by another company after this history ended; treat the history as the earlier company's.
    const lst = lst0 && endedEarly && issuerChangedSince(sym, lastBar) ? undefined : lst0;
    const reusedTicker = !!lst0 && !lst;
    const ftdRow = ftdNear(sym, lastBar);
    let name = lst?.name ?? ftdRow?.d ?? secTickers.get(sym)?.name ?? "";
    const { cik, via } = await cikFor(sym, !!lst, lastBar);
    let sub: any = null; if (cik) { sub = await submissions(cik); stats.secLookups++; }
    const secName = sub?.name ?? "";
    if (!lst) name = ftdRow?.d || secName || name;
    const files = sub ? filingsOf(sub) : [];
    const nameType = typeFromName(lst?.name ?? ftdRow?.d ?? name);
    const fundBySec = files.some(f => /^N-(CSR|2|1A|Q|PORT)/.test(f.form));
    let secType = lst?.etf ? "fund" : typeFromSymbol(sym) ?? nameType ?? (fundBySec ? "fund" : null);
    // Exchange: today's listing if any, else the exchange that filed the Form 25 delisting notice.
    const useToday = lst && via === "SEC company tickers";
    let exchange = useToday ? lst!.exchange : "";
    let exchangeVia = useToday ? "Nasdaq Trader list, 2026-11-05" : "";
    if (!exchange && cik) {
      // Form 25 notices (removal from listing) at or after the stock's last bar, common equity first.
      const lb30 = new Date(Date.parse(lastBar) - 30 * 864e5).toISOString().slice(0, 10);
      const f25s = files.filter(f => /^25(-NSE)?$/.test(f.form)).sort((a, b) => (a.date >= lb30 ? 0 : 1) - (b.date >= lb30 ? 0 : 1) || (a.date >= lb30 ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
      for (const f of f25s) {
        const x = await form25(cik, f.acc); if (!x || !x.exchange) continue;
        if (/note|debenture|preferred|warrant|right|unit|bond|%/i.test(x.security) && !/common|ordinary|american depositary/i.test(x.security)) continue;
        exchange = exchangeLabel(x.exchange); exchangeVia = `Form ${f.form} ${f.acc} filed ${f.date} (${x.exchange}; ${x.security})`; break;
      }
    }
    if (!exchange && sub?.exchanges?.length) { exchange = exchangeLabel(sub.exchanges[0]); exchangeVia = "SEC submissions, current exchange (no Form 25 found)"; }
    if (!exchange && lst) { exchange = lst.exchange; exchangeVia = "Nasdaq Trader list, 2026-11-05 (issuer behind the ticker may have changed)"; }
    if (!exchange) { exchange = "unknown"; exchangeVia = cik ? "no Form 25 and no current exchange at SEC" : "no SEC company found"; }
    const adr = isAdrName(lst?.name ?? ftdRow?.d ?? name);
    const foreignFiler = files.some(f => f.form === "20-F" || f.form === "40-F");

    // ----- SPAC merger, IPO, moved exchange -----
    const fb10 = new Date(Date.parse(firstBar) - 10 * 864e5).toISOString().slice(0, 10);
    const shellEnd = files.find(f => f.form.startsWith("8-K") && /(^|,)5\.06/.test(f.items) && f.date >= first && f.date >= fb10 && f.date <= last);
    let startKind = "standard", startDate = first, flags: string[] = [];
    let listingDate = firstBar;
    // Same company, new security: a new CUSIP with the same issuer code after a break of more than 20 days,
    // with a price jump of 3x or more (either way) between bars near the break. This is the pattern of a
    // bankruptcy where old shares are cancelled and new shares listed; Alpaca joins the two histories.
    let switchDate: string | null = null;
    let reemergedBefore = false;
    { const before400 = new Date(Date.parse(first) - 400 * 864e5).toISOString().slice(0, 10);
      const list = (ftdAll[sym] ?? []).filter(e => e.last >= before400 && e.first <= last).sort((a, b) => a.first.localeCompare(b.first));
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i];
        const gap = (Date.parse(b.first) - Date.parse(a.last)) / 864e5;
        if (a.cusip.slice(0, 6) !== b.cusip.slice(0, 6) || gap <= 20) continue;
        const lo = new Date(Date.parse(a.last) - 10 * 864e5).toISOString().slice(0, 10), hi = new Date(Date.parse(b.first) + 10 * 864e5).toISOString().slice(0, 10);
        const prior = barsAll.filter(x => d10(x.t) < lo).at(-1); // the last bar before the break, if trading stopped
        const near = [...(prior ? [prior] : []), ...barsAll.filter(x => d10(x.t) >= lo && d10(x.t) <= hi)];
        let jump: string | null = null;
        for (let k = 1; k < near.length; k++) { const r = near[k].o / near[k - 1].c; if (r >= 3 || r <= 1 / 3) jump = d10(near[k].t); }
        if (!jump) continue;
        if (jump > first) switchDate = jump; else if (firstBar > first) reemergedBefore = true;
      }
      // A first bar in the period right after an earlier security of the same issuer stopped trading.
      if (newListing && list.some(e => e.last < firstBar && (Date.parse(firstBar) - Date.parse(e.last)) / 864e5 < 365) && ftdNear(sym, firstBar) && list.some(e => e.last < firstBar && e.cusip.slice(0, 6) === ftdNear(sym, firstBar)!.cusip.slice(0, 6) && e.cusip !== ftdNear(sym, firstBar)!.cusip)) reemergedBefore = true;
    }
    if (shellEnd) { listingDate = nyDate(shellEnd.accepted); startKind = "spac-merger"; }
    // A one-night jump of 10x or more either way is not a price move: it is old shares swapped for new ones
    // (bankruptcy) or a split Alpaca did not adjust. Measured as new shares from the jump, earnings rule.
    let bigBreak: string | null = null, bigRatio = 0;
    for (let k = 1; k < inP.length; k++) { const r = inP[k].o / inP[k - 1].c; if (r >= 10 || r <= 0.1) { bigBreak = d10(inP[k].t); bigRatio = r; } }
    if (bigBreak && !shellEnd && (!switchDate || bigBreak > switchDate)) switchDate = bigBreak;
    const priorReports = files.filter(f => /^(10-K|10-Q|20-F|40-F|10-KSB|10-QSB)$/.test(f.form) && f.date < firstBar && (Date.parse(firstBar) - Date.parse(f.date)) / 864e5 > 30);
    // A bankruptcy filing (8-K item 1.03) in the two years before the first bar means new shares after a
    // reorganization: treated as a new listing, not a move from another market.
    const fb730 = new Date(Date.parse(firstBar) - 730 * 864e5).toISOString().slice(0, 10);
    if (files.some(f => f.form.startsWith("8-K") && /(^|,)1\.03/.test(f.items) && f.date >= fb730 && f.date <= firstBar)) reemergedBefore = true;
    if (!shellEnd && newListing) startKind = priorReports.length && !reemergedBefore ? "moved-exchange" : "new-listing";
    if (reemergedBefore && newListing && !shellEnd) flags.push("new shares after bankruptcy");
    if (switchDate && !shellEnd) { startKind = "new-listing"; listingDate = switchDate;
      flags.push(switchDate === bigBreak ? `new shares: price break x${bigRatio.toFixed(2)} overnight on ${switchDate} (share exchange or unadjusted split), measured after it` : `new shares listed ${switchDate} (same company, new CUSIP, price break): measured from the new shares`); }
    if (startKind === "standard") startDate = first;
    else if (startKind === "moved-exchange") {
      startDate = firstBar;
      // Registered on an exchange (Form 8-A12B) well before Alpaca's first bar: not a move, a late start in the data.
      const fb30 = new Date(Date.parse(firstBar) - 30 * 864e5).toISOString().slice(0, 10);
      if (files.some(f => /^8-A12B/.test(f.form) && f.date < fb30)) flags.push("history starts late in Alpaca (company was exchange-registered earlier; ticker change or data gap)");
      else flags.push("moved exchange");
    }
    else {
      flags.push(startKind === "spac-merger" ? "new listing (shell merger)" : "new listing");
      const rep = files.find(f => f.form.startsWith("8-K") && /(^|,)2\.02/.test(f.items) && nyDate(f.accepted) >= listingDate)
        ?? files.find(f => /^(10-Q|10-K)$/.test(f.form) && f.date >= listingDate);
      if (rep) {
        const repDate = nyDate(rep.accepted || rep.date);
        if (repDate > last) { excluded.push({ symbol: sym, name, reason: `first earnings report ${repDate} after the period ends` }); continue; }
        if (repDate > cutoff) { excluded.push({ symbol: sym, name, reason: `first earnings report ${repDate} falls in the period's final three months (after ${cutoff})` }); continue; }
        const next = inP.find(b => d10(b.t) > repDate);
        if (!next) { excluded.push({ symbol: sym, name, reason: `no trading day after first earnings report ${repDate}` }); continue; }
        startDate = d10(next.t);
        if (!rep.form.startsWith("8-K")) flags.push(`earnings date from first ${rep.form} filing (no 8-K item 2.02)`);
      } else {
        const firstAfter = inP.find(b => startKind === "spac-merger" ? d10(b.t) > listingDate : d10(b.t) >= listingDate);
        if (!firstAfter) { excluded.push({ symbol: sym, name, reason: "no trading day after the listing date" }); continue; }
        startDate = d10(firstAfter.t);
        flags.push("missing earnings date");
      }
    }
    if (endedEarly) {
      const merger = files.some(f => /^(DEFM14A|PREM14A|DEFM14C|SC 14D9|SC TO-T|SC 13E3)/.test(f.form) && f.date <= lastBar && (Date.parse(lastBar) - Date.parse(f.date)) / 864e5 < 550);
      flags.push(merger ? "acquired" : "delisted");
    }
    if (adr) flags.push("ADR");
    if (isPartnershipName(lst?.name ?? "") || isPartnershipName(ftdRow?.d ?? "")) flags.push("partnership units");
    if (endedEarly && lst) flags.push("check: history ended early but the symbol is listed today (possible ticker reuse)");
    if (reusedTicker) flags.push("ticker later reused by another company");
    if (gapFlag) flags.push("gap in price history");

    const rows = inP.filter(b => d10(b.t) >= startDate);
    if (rows.length < 2) { excluded.push({ symbol: sym, name, reason: "fewer than 2 trading days after the start rule" }); continue; }
    const prev = barsAll.filter(b => d10(b.t) < startDate).at(-1)?.c ?? null;
    // A one-night jump of 3x or more either way inside the measured days may be a missing split adjustment.
    for (let k = 1; k < rows.length; k++) { const r = rows[k].o / rows[k - 1].c; if (r >= 3 || r <= 1 / 3) { flags.push(`check: overnight price jump x${r.toFixed(2)} on ${d10(rows[k].t)}`); break; } }
    const ratio = rows.at(-1)!.c / rows[0].o;
    const base = { symbol: sym, name, sec_name: secName, cik, cik_via: via, exchange, exchange_via: exchangeVia, sec_type: secType, start: d10(rows[0].t), end: d10(rows.at(-1)!.t), start_open: rows[0].o, end_close: rows.at(-1)!.c, ratio, flags, foreign_filer: foreignFiler, also_listed_as: dupOf[sym] ?? [] };
    reviewed.push({ ...base, kept: false });
    if (ratio < 4) continue;
    if (secType) { excluded.push({ ...base, reason: `security type: ${secType}` }); continue; }
    if (!shellEnd && base.start_open >= 9 && base.start_open <= 11 && /acquisition (corp|co|company|ltd|inc|holdings)|\bacq(uisition)? corp/i.test(name + " " + secName)) { excluded.push({ ...base, reason: "probable SPAC shell (name and 10 dollar start; no shell merger found in SEC 8-K items)" }); continue; }
    if (startKind === "standard" && spacLike && files.some(f => f.form.startsWith("8-K") && /(^|,)5\.06/.test(f.items) && f.date > last)) { excluded.push({ ...base, reason: "SPAC shell during the period (merger after the period)" }); continue; }
    if (!(exchange === "Nasdaq" || exchange === "NYSE")) { otherExchange.push({ ...base, reason: `listed on ${exchange}` }); continue; }

    const m = measure(rows, prev);
    // Benchmarks, same days.
    let upWhenSpyDown = 0, spyDownDays = 0, upWhenQqqDown = 0, qqqDownDays = 0, upOcWhenSpyOcDown = 0, spyOcDown = 0;
    for (const r of m.daily) {
      const s = bSpy.get(r.t), q = bQqq.get(r.t);
      r.spy_oc = s?.oc ?? null; r.spy_cc = s?.cc ?? null; r.qqq_oc = q?.oc ?? null; r.qqq_cc = q?.cc ?? null;
      if (s?.cc != null && r.cc != null && s.cc <= 0) { spyDownDays++; if (r.cc > 0) upWhenSpyDown++; }
      if (q?.cc != null && r.cc != null && q.cc <= 0) { qqqDownDays++; if (r.cc > 0) upWhenQqqDown++; }
      if (s && s.oc <= 0) { spyOcDown++; if (r.oc > 0) upOcWhenSpyOcDown++; }
    }
    const caps = await marketCaps(sym, cik, adr, base.start, base.end);
    if (caps.cap_start && caps.cap_end) { const r = (caps.cap_end / caps.cap_start) / ratio;
      if (r > 20 || r < 0.05) Object.assign(caps, { cap_start: null, cap_end: null, cap_note: `share counts inconsistent with the price multiple (cap ratio / multiple = ${r.toFixed(2)}); left blank` }); }
    const group = ratio >= 6 ? "6x+" : ratio >= 5 ? "5x" : "4x";
    const industry = sub?.sicDescription || "";
    if (!industry) flags.push("industry missing");
    if (caps.cap_start === null || caps.cap_end === null) flags.push("market cap missing");
    const { daily, ...summary } = m;
    reviewed.at(-1).kept = true;
    winners.push({ ...base, group, gain_d: base.end_close - base.start_open, gain_pct: ratio - 1, industry, sic: sub?.sic ?? "", ...caps, ...summary,
      spy_down_days: spyDownDays, up_when_spy_down: upWhenSpyDown, qqq_down_days: qqqDownDays, up_when_qqq_down: upWhenQqqDown, spy_oc_down_days: spyOcDown, up_oc_when_spy_oc_down: upOcWhenSpyOcDown, daily });
  }
  winners.sort((a, b) => b.ratio - a.ratio);
  // Benchmarks over the full period, for the comparison rows.
  const benchRow = (b: Bar[], s: string) => { const rows = b.filter(x => d10(x.t) >= first && d10(x.t) <= last); const prev = b.filter(x => d10(x.t) < first).at(-1)?.c ?? null; const { daily, ...m } = measure(rows, prev); return { symbol: s, ratio: rows.at(-1)!.c / rows[0].o, ...m }; };
  writeJson(join(DATA, "work", `period-${p}.json`), { period: p, first, last, cutoff, stats, winners, excluded, otherExchange, reviewed, benchmarks: [benchRow(spy, "SPY"), benchRow(qqq, "QQQ")],
    benchDaily: { SPY: spy.filter(x => d10(x.t) >= first && d10(x.t) <= last), QQQ: qqq.filter(x => d10(x.t) >= first && d10(x.t) <= last) } });
  console.log(`period ${p}: ${first} to ${last}; candidates ${stats.candidates}, passed superset ${stats.prelim}, winners ${winners.length} (4x ${winners.filter(w => w.group === "4x").length}, 5x ${winners.filter(w => w.group === "5x").length}, 6x+ ${winners.filter(w => w.group === "6x+").length}), excluded ${excluded.length}, other exchanges ${otherExchange.length}`);
}
