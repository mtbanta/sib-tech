// The daily screen. A deliberately simple placeholder: its job is to exercise the plumbing, not to find
// anything worth trading. It looks at the last few completed daily bars (consolidated prices) and keeps the
// liquid names whose last session traded far more than their recent norm.
//
// Rule, in plain words:
//   1. price: last close between MIN_PRICE and MAX_PRICE dollars
//   2. liquid: average daily dollar volume over the window of at least MIN_DOLLAR_VOLUME
//   3. rank by last session volume divided by the average of the earlier sessions (unusual activity)
//   4. keep the top N, where N is the live list size
// A load day (load-mode.ts) ranks instead by average daily share volume (the most shares traded gives the most prints on
// the free feed), with its own price band and list size. A normal day leaves `rankBy` unset and is unchanged.
export interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ScreenOptions {
  minPrice: number;
  maxPrice: number;
  minDollarVolume: number;
  minSessions: number;
  listSize: number;
  rankBy?: "ratio" | "shares";
}

export const DEFAULT_SCREEN: ScreenOptions = { minPrice: 10, maxPrice: 500, minDollarVolume: 100_000_000, minSessions: 4, listSize: 20 };

export interface Candidate {
  symbol: string;
  lastClose: number;
  avgDollarVolume: number;
  volumeRatio: number;
  avgShares: number;
}

export function screen(barsBySymbol: ReadonlyMap<string, readonly Bar[]>, options: ScreenOptions = DEFAULT_SCREEN): Candidate[] {
  const out: Candidate[] = [];
  for (const [symbol, bars] of barsBySymbol) {
    if (bars.length < options.minSessions) continue;
    const sorted = [...bars].sort((a, b) => a.t.localeCompare(b.t));
    const last = sorted[sorted.length - 1]!;
    if (!(last.c >= options.minPrice && last.c <= options.maxPrice)) continue;
    const avgDollar = sorted.reduce((s, b) => s + b.c * b.v, 0) / sorted.length;
    if (!(avgDollar >= options.minDollarVolume)) continue;
    const earlier = sorted.slice(0, -1);
    const earlierAvg = earlier.reduce((s, b) => s + b.v, 0) / earlier.length;
    if (!(earlierAvg > 0)) continue;
    out.push({ symbol, lastClose: last.c, avgDollarVolume: avgDollar, volumeRatio: last.v / earlierAvg, avgShares: sorted.reduce((s, b) => s + b.v, 0) / sorted.length });
  }
  // Highest ratio first (or, on a load day, most shares traded); ties broken by symbol so the same data always gives the same list.
  if (options.rankBy === "shares") out.sort((a, b) => b.avgShares - a.avgShares || a.symbol.localeCompare(b.symbol));
  else out.sort((a, b) => b.volumeRatio - a.volumeRatio || a.symbol.localeCompare(b.symbol));
  return out.slice(0, options.listSize);
}

// The free IEX stream carries at most 30 symbols. A bigger request is cut down, never sent.
export const IEX_STREAM_CAP = 30;
export function liveListSize(requested: number, feed: "iex" | "sip"): number {
  return feed === "iex" ? Math.min(requested, IEX_STREAM_CAP) : requested;
}
