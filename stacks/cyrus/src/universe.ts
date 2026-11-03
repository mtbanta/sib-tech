// The day's starting universe: common stocks listed on Nasdaq and on the NYSE, from Nasdaq Trader's free
// symbol files. That covers every member of the six indexes (Dow, S&P 500, Nasdaq 100, Russell 2000, Nasdaq
// Composite, NYSE Composite) without labelling which index a name is in. Labelling is a later refinement.
export const NASDAQ_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
export const OTHER_LISTED_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";

const EXCLUDED_NAME = /\b(warrants?|rights?|units?|preferred|notes?|debentures?|trust preferred|depositary shares|acquisition corp)\b/i;

function rows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.includes("|") && !l.startsWith("File Creation Time"))
    .map((l) => l.split("|"));
}

function keep(symbol: string, name: string, test: string, etf: string): boolean {
  // Plain tickers only (no $ . or digits, which mark preferreds, classes and when-issued lines).
  return /^[A-Z]{1,5}$/.test(symbol) && test === "N" && etf === "N" && !EXCLUDED_NAME.test(name);
}

// "Intel Corporation - Common Stock" becomes "Intel". Cuts the share-class part after " - " and the trailing company
// form (Inc, Corp, Corporation, Company, Ltd, Holdings and so on), so a live list reads like "Intel (INTC)".
export function cleanCompanyName(raw: string): string {
  let name = raw.split(" - ")[0]!.replace(/\s+/g, " ").trim();
  const suffix = /[,\s]+(inc\.?|incorporated|corp\.?|corporation|company|co\.?|ltd\.?|limited|plc|n\.?v\.?|s\.?a\.?|holdings?|group|llc|l\.?p\.?|the)$/i;
  for (let i = 0; i < 3 && suffix.test(name) && name.replace(suffix, "").length > 1; i++) name = name.replace(suffix, "").replace(/,$/, "").trim();
  return name.replace(/\s+(and|&)$/i, "").trim();
}

// Symbol to cleaned company name, from the two Nasdaq symbol files. A symbol with no name is simply absent.
export function parseNames(nasdaqListed: string, otherListed: string): Map<string, string> {
  const names = new Map<string, string>();
  const [, ...a] = rows(nasdaqListed);
  for (const r of a) if (r[0] && r[1]) names.set(r[0], cleanCompanyName(r[1]));
  const [, ...b] = rows(otherListed);
  for (const r of b) if (r[0] && r[1] && !names.has(r[0])) names.set(r[0], cleanCompanyName(r[1]));
  return names;
}

// "3. Intel (INTC)", one per line, numbered. A symbol with no name shows the ticker alone.
export function formatLiveList(symbols: readonly string[], names: Readonly<Record<string, string>>): string {
  return symbols.map((s, i) => `${i + 1}. ${names[s] ? `${names[s]} (${s})` : s}`).join("\n");
}

export function parseNasdaqListed(text: string): string[] {
  const [, ...data] = rows(text); // first row is the header
  return data.filter((r) => keep(r[0] ?? "", r[1] ?? "", r[3] ?? "", r[6] ?? "")).map((r) => r[0]!);
}

// Only exchange code N (NYSE). NYSE American, Arca and Cboe listings are not in the NYSE Composite.
export function parseOtherListed(text: string): string[] {
  const [, ...data] = rows(text);
  return data.filter((r) => r[2] === "N" && keep(r[0] ?? "", r[1] ?? "", r[6] ?? "", r[4] ?? "")).map((r) => r[0]!);
}

export interface Universe {
  symbols: string[];
  names: Map<string, string>;
}

export async function fetchUniverse(fetchImpl: typeof fetch = fetch): Promise<string[]> {
  return (await fetchUniverseWithNames(fetchImpl)).symbols;
}

export async function fetchUniverseWithNames(fetchImpl: typeof fetch = fetch): Promise<Universe> {
  const get = async (url: string) => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Symbol file ${url} answered ${res.status}`);
    return res.text();
  };
  const [a, b] = await Promise.all([get(NASDAQ_LISTED_URL), get(OTHER_LISTED_URL)]);
  const symbols = [...new Set([...parseNasdaqListed(a), ...parseOtherListed(b)])].sort();
  if (symbols.length < 2000) throw new Error(`Universe looks too small (${symbols.length}); refusing to screen on it`);
  return { symbols, names: parseNames(a, b) };
}
