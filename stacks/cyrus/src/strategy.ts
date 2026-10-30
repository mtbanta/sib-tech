// The placeholder strategy: an opening range breakout. Deliberately simple; its job is to exercise the
// plumbing, not to make money. Michael is researching the real strategy separately.
//
// Rule, in plain words. For each name on the day's live list, note the highest trade price in the first
// 5 minutes after the open (the "opening range"). After those 5 minutes, the first trade above that high is
// a signal to buy, once per name per day. The protective stop sits 1.5 percent below the signal price.
// Long only. The same trades always give the same signals (no clock, no randomness).
import type { Trade } from "./stream.ts";

export const RANGE_MINUTES = 5;
export const STOP_FRACTION = 0.015;

export interface Signal {
  symbol: string;
  price: number;
  tradeTime: Date;
  stopPrice: number;
}

const cents = (x: number) => Math.round(x * 100) / 100;

export class OpeningRangeBreakout {
  private readonly rangeEnd: Date;
  private readonly open: Date;
  private readonly highs = new Map<string, number>();
  private readonly signaled = new Set<string>();
  private readonly watch: ReadonlySet<string>;

  // `startedAt` is when this object was created. If that is already past the open, the range cannot be trusted
  // (some trades were missed), so this strategy gives no signals for the day.
  private readonly usable: boolean;

  constructor(open: Date, symbols: readonly string[], startedAt: Date = open) {
    this.usable = startedAt.getTime() <= open.getTime() + 30_000;
    this.open = open;
    this.rangeEnd = new Date(open.getTime() + RANGE_MINUTES * 60_000);
    this.watch = new Set(symbols);
  }

  onTrade(t: Trade): Signal | null {
    if (!this.usable || !this.watch.has(t.symbol) || !(t.price > 0)) return null;
    const time = new Date(t.time);
    if (!(time >= this.open)) return null; // before the open: ignored
    if (time < this.rangeEnd) {
      this.highs.set(t.symbol, Math.max(this.highs.get(t.symbol) ?? 0, t.price));
      return null;
    }
    const high = this.highs.get(t.symbol);
    if (high === undefined || this.signaled.has(t.symbol) || !(t.price > high)) return null;
    this.signaled.add(t.symbol);
    return { symbol: t.symbol, price: t.price, tradeTime: time, stopPrice: cents(t.price * (1 - STOP_FRACTION)) };
  }
}
