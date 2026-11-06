// SEC EDGAR client: generic client name, no contact details, at most about 4 requests a second
// (SEC's published fair-access limit is 10 a second). Responses cached under data/raw/sec/.
import { join } from "node:path";
import { DATA, cachedFetch } from "./common.ts";

export async function submissions(cik: number): Promise<any> {
  const id = String(cik).padStart(10, "0");
  const main = JSON.parse((await cachedFetch(`https://data.sec.gov/submissions/CIK${id}.json`, join(DATA, "raw", "sec", "submissions", `${id}.json`), 260)).toString());
  // Older filings live in extra files; merge them so the first earnings report can be found.
  for (const f of main.filings.files ?? []) {
    const extra = JSON.parse((await cachedFetch(`https://data.sec.gov/submissions/${f.name}`, join(DATA, "raw", "sec", "submissions", f.name), 260)).toString());
    for (const k of Object.keys(main.filings.recent)) main.filings.recent[k].push(...(extra[k] ?? []));
  }
  return main;
}
export async function companyFacts(cik: number): Promise<any | null> {
  const id = String(cik).padStart(10, "0");
  try { return JSON.parse((await cachedFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${id}.json`, join(DATA, "raw", "sec", "facts", `${id}.json`), 260)).toString()); }
  catch (e: any) { if (e.status === 404) return null; throw e; }
}
// EDGAR's company name lookup (used only for symbols no longer listed).
export async function nameLookup(q: string): Promise<any> {
  const safe = q.replace(/[^A-Za-z0-9 ]/g, " ").trim().replace(/\s+/g, " ");
  return JSON.parse((await cachedFetch(`https://efts.sec.gov/LATEST/search-index?keysTyped=${encodeURIComponent(safe)}`, join(DATA, "raw", "sec", "lookup", safe.replace(/ /g, "_") + ".json"), 260)).toString());
}

// EDGAR full-text search for a CUSIP (it appears on the cover of ownership filings such as SC 13G).
// Each hit names the filer and the subject company. The issuer is chosen as: the company whose name
// shares its first word with the given description, else the company seen with the most different
// co-filers (the subject of many filers' reports).
export async function cusipSearch(cusip: string, description = ""): Promise<{ cik: number; name: string; hits: number } | null> {
  const r = JSON.parse((await cachedFetch(`https://efts.sec.gov/LATEST/search-index?q=%22${cusip}%22`, join(DATA, "raw", "sec", "cusip", cusip + ".json"), 260)).toString());
  const info = new Map<string, { n: number; name: string; co: Set<string> }>();
  for (const h of r?.hits?.hits ?? []) {
    const ciks = h._source.ciks as string[];
    ciks.forEach((c, i) => {
      const e = info.get(c) ?? { n: 0, name: h._source.display_names?.[i] ?? "", co: new Set<string>() };
      e.n++; for (const o of ciks) if (o !== c) e.co.add(o); info.set(c, e);
    });
  }
  const word = (x: string) => x.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").trim().split(/\s+/)[0] ?? "";
  const w0 = word(description);
  const ranked = [...info.entries()].sort((a, b) =>
    (Number(w0 !== "" && word(b[1].name) === w0) - Number(w0 !== "" && word(a[1].name) === w0)) || (b[1].co.size - a[1].co.size) || (b[1].n - a[1].n));
  const best = ranked[0];
  return best ? { cik: Number(best[0]), name: best[1].name, hits: best[1].n } : null;
}
// The raw XML of a Form 25 or 25-NSE names the exchange and the class of security removed.
export async function form25(cik: number, acc: string): Promise<{ exchange: string; security: string } | null> {
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${acc.replace(/-/g, "")}/primary_doc.xml`;
  try {
    const x = (await cachedFetch(url, join(DATA, "raw", "sec", "form25", acc + ".xml"), 260)).toString();
    const ex = x.match(/<exchange>[\s\S]*?<entityName>([^<]*)<\/entityName>/)?.[1] ?? "";
    const sec = x.match(/<descriptionClassSecurity>([^<]*)</)?.[1] ?? "";
    return { exchange: ex, security: sec };
  } catch (e: any) { if (e.status === 404) return null; throw e; }
}
