// THE PLACEHOLDER STRATEGY ("busy"). It is MEANINGLESS AS A STRATEGY and is not meant to make money. Its only job is
// to exercise the stack at volume: it trades often, stays long only, ends the day flat (the close-out sells what is
// left; each entry also carries a take-profit and a protective stop resting at Alpaca), and stays inside every limit
// (the order gate and the governor check each entry; this file only proposes).
//
// Rule, in plain words. For each name on the day's live list, keep the last 12 trade prices. When a trade prints
// higher than the one before it AND at or above the average of those 12, and at least 15 seconds have passed since
// this name last signalled, propose a buy: a take-profit 0.25 percent above, a stop 0.4 percent below. The gate
// decides whether it goes out. The same trades always give the same signals (no clock, no randomness).
//
// Load day (load-mode.ts): while the load window is on, the cooldown is 5 seconds and the exits sit 3 cents above and 4 cents
// below the price, so positions turn over fast. Outside the window, and on every normal day, the rule above is unchanged.
import type { Trade } from "./stream.ts";
import { LOAD_COOLDOWN_SECONDS, LOAD_STOP_CENTS, LOAD_TAKE_PROFIT_CENTS } from "./load-mode.ts";

export const WINDOW = 12;
export const COOLDOWN_SECONDS = 15;
export const TAKE_PROFIT_FRACTION = 0.0025;
export const STOP_FRACTION = 0.004;

export interface Signal {
  symbol: string;
  price: number;
  tradeTime: Date;
  stopPrice: number;
  takeProfitPrice: number;
}

const cents = (x: number) => Math.round(x * 100) / 100;

export class BusyPlaceholder {
  private readonly watch: ReadonlySet<string>;
  private readonly prices = new Map<string, number[]>();
  private readonly lastSignal = new Map<string, number>();
  private readonly loadActive: (t: Date) => boolean;

  // `loadActive` says whether the load window is on at a trade's time (the worker passes it on a load day only).
  constructor(symbols: readonly string[], opts: { loadActive?: (t: Date) => boolean } = {}) {
    this.watch = new Set(symbols);
    this.loadActive = opts.loadActive ?? (() => false);
  }

  onTrade(t: Trade): Signal | null {
    if (!this.watch.has(t.symbol) || !(t.price > 0)) return null;
    const time = new Date(t.time);
    if (Number.isNaN(time.getTime())) return null;
    const ring = this.prices.get(t.symbol) ?? [];
    const previous = ring[ring.length - 1];
    ring.push(t.price);
    if (ring.length > WINDOW) ring.shift();
    this.prices.set(t.symbol, ring);
    if (ring.length < WINDOW || previous === undefined || !(t.price > previous)) return null;
    const mean = ring.reduce((s, x) => s + x, 0) / ring.length;
    if (t.price < mean) return null;
    const load = this.loadActive(time);
    const cooldown = load ? LOAD_COOLDOWN_SECONDS : COOLDOWN_SECONDS;
    const last = this.lastSignal.get(t.symbol);
    if (last !== undefined && time.getTime() - last < cooldown * 1000) return null;
    this.lastSignal.set(t.symbol, time.getTime());
    const stopPrice = load ? cents(t.price - LOAD_STOP_CENTS / 100) : Math.min(cents(t.price * (1 - STOP_FRACTION)), cents(t.price - 0.02));
    const takeProfitPrice = load ? cents(t.price + LOAD_TAKE_PROFIT_CENTS / 100) : Math.max(cents(t.price * (1 + TAKE_PROFIT_FRACTION)), cents(t.price + 0.02));
    return { symbol: t.symbol, price: t.price, tradeTime: time, stopPrice, takeProfitPrice };
  }
}
