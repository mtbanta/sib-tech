// THE ORDER-RATE GOVERNOR. Fixed code, no settings. Two jobs:
//
//  1. Hold the per-minute cap on orders that open positions ("trades a minute", at most MAX_TRADES_PER_MINUTE
//     whatever Michael approved) with a sliding 60 second window.
//  2. Keep headroom under Alpaca's request limit. Alpaca counts account, order and position calls in one bucket of
//     200 requests a minute (measured 2026-11-02; refills at about 3.3 a second; the clock and calendar are counted
//     separately). The governor listens to the `X-Ratelimit-Remaining` header on every answer. Work that is NOT about
//     safety (entries, and the reads that serve them) may only use the bucket down to the RESERVE; the last tokens
//     belong to the stop command, cancels, protective actions and the close-out, which are never held back by it.
//
// THE RESERVE (Michael's decision 7 of 2026-11-06): it scales with what is open, instead of a fixed 80. Enough for a full
// emergency flatten of every open symbol (a symbol held, or with an entry working), with a floor and a cap of 80:
//     reserve = min(80, 59 + 2 x open symbols)
// Why (the C2 log, "The scaled reserve, re-derived"): in the simulator, with the real sale code and the early wake-up limits
// (early-wake.ts), routine work beside it at 75 requests a minute for the whole flatten, Alpaca's cancel completions and sell fills
// spread at random over their delays (cancels of 0.2 to 11 seconds, sells held 16 seconds, 8 random draws), the worst full flatten
// (the flatten command's 4 rounds with 11 second cancels; early looks are blocked near the reserve, so its timed looks) drew the bucket
// at most 41 + 2 per open symbol below where it started. Plus 8: at sustained load the bucket sits up to 6 or 7 below the reserve
// (cancels, the sync and the loss stop's reads keep spending after entries stop; the 150 a minute rehearsals). Plus 10 left at the
// bottom (5 percent of the bucket). 59 with nothing open, 80 (the cap) from 11 open symbols. Until the gate or the worker has said how
// many symbols are open, the reserve is the cap.
import { MAX_TRADES_PER_MINUTE, MAX_TRADES_PER_MINUTE_LOAD_DAY } from "./limits.ts";
import type { RateInfo } from "./alpaca-trading.ts";

export const ALPACA_REQUESTS_PER_MINUTE = 200;
// The cap of the reserve (and its old fixed value).
export const SAFETY_RESERVE = 80;
// 41 (the flatten command's own draw with routine work beside it) + 8 (the shortfall at sustained load) + 10 (left at the bottom).
export const RESERVE_FLOOR = 59;
// Each open symbol: up to 2 more requests in the worst flatten (its sell, and the extra looks while its cancel or fill is awaited).
export const RESERVE_PER_SYMBOL = 2;
// In force since the early wake-up fix passed review (Michael's weekend approval of 2026-11-07, this change reviewed in its own round).
export const RESERVE_SCALING = true;

// The reserve for a number of open symbols (held, or with an entry working): one more request (its sell) per symbol.
export function reserveFor(openSymbols: number): number {
  const n = Number.isFinite(openSymbols) && openSymbols > 0 ? Math.ceil(openSymbols) : 0;
  return Math.min(SAFETY_RESERVE, RESERVE_FLOOR + RESERVE_PER_SYMBOL * n);
}
const REFILL_PER_MS = ALPACA_REQUESTS_PER_MINUTE / 60_000;

export type Admission = { ok: true } | { ok: false; reason: string };

export class Governor {
  private readonly now: () => number;
  private tradeTimes: number[] = [];
  private requestTimes: number[] = [];
  private remaining: number | null = null;
  private remainingAt = 0;
  private lowest: number | null = null;
  private peakTrades = 0;
  private refused = 0;
  private rateLimited = 0; // answers from Alpaca saying "too many requests" (429), for the record only
  // Decision 7: how many symbols are open (held, or with an entry working), as the gate or the worker last counted them. Null until
  // told: the reserve is then the cap.
  private openSymbols: number | null = null;
  // The lowest of (remaining - the reserve in force at that moment) Alpaca has reported today, and the reserve's range this
  // minute, for the statistics (the Monday pass rule: remaining requests never below the reserve in force).
  private lowestAboveReserve: number | null = null;
  private minuteReserve: { min: number; max: number } | null = null;
  // The same two lows for the current minute only (reset by takeMinuteReserve), so each minute's depth is visible.
  private minuteLowest: number | null = null;
  private minuteLowestAboveReserve: number | null = null;

  private readonly scaleReserve: boolean;

  constructor(now: () => number = Date.now, opts: { scaleReserve?: boolean } = {}) {
    this.now = now;
    this.scaleReserve = opts.scaleReserve ?? RESERVE_SCALING;
  }

  // How many symbols the gate or the worker last said are open (null until told).
  openSymbolCount(): number | null {
    return this.openSymbols;
  }

  // Called with every answer from Alpaca's trading interface (see AlpacaTrading `onRate`).
  observe(info: RateInfo): void {
    const clockPath = info.path === "/v2/clock" || info.path.startsWith("/v2/calendar");
    if (info.status === 429 && !clockPath) {
      this.rateLimited++;
      // A refusal means the bucket is empty, whatever headers came with it.
      const t0 = this.now();
      this.remaining = 0;
      this.remainingAt = t0;
      this.lowest = 0;
      return;
    }
    if (info.limit !== ALPACA_REQUESTS_PER_MINUTE) return; // the clock and calendar have their own bucket
    const t = this.now();
    this.requestTimes.push(t);
    this.requestTimes = this.requestTimes.filter((x) => t - x < 60_000);
    if (info.remaining !== null) {
      this.remaining = info.status === 429 ? 0 : info.remaining;
      this.remainingAt = t;
      this.lowest = this.lowest === null ? this.remaining : Math.min(this.lowest, this.remaining);
      const above = this.remaining - this.reserve();
      this.lowestAboveReserve = this.lowestAboveReserve === null ? above : Math.min(this.lowestAboveReserve, above);
      this.minuteLowest = this.minuteLowest === null ? this.remaining : Math.min(this.minuteLowest, this.remaining);
      this.minuteLowestAboveReserve = this.minuteLowestAboveReserve === null ? above : Math.min(this.minuteLowestAboveReserve, above);
    }
  }

  // Decision 7: the gate (before each entry, counting the entry it is about to send) and the worker (at each view refresh) say how
  // many symbols are open.
  setOpenSymbols(n: number): void {
    if (!Number.isFinite(n) || n < 0) return;
    this.openSymbols = Math.ceil(n);
    const r = this.reserve();
    this.minuteReserve = this.minuteReserve ? { min: Math.min(this.minuteReserve.min, r), max: Math.max(this.minuteReserve.max, r) } : { min: r, max: r };
  }

  // The reserve in force now.
  reserve(): number {
    return !this.scaleReserve || this.openSymbols === null ? SAFETY_RESERVE : reserveFor(this.openSymbols);
  }

  // Our best estimate of the tokens left in Alpaca's bucket right now: the last number it told us, plus the refill since.
  budget(): number {
    if (this.remaining === null) return ALPACA_REQUESTS_PER_MINUTE;
    return Math.min(ALPACA_REQUESTS_PER_MINUTE, this.remaining + (this.now() - this.remainingAt) * REFILL_PER_MS);
  }

  // Can work that is not about safety spend a request right now?
  canSpend(): boolean {
    return this.budget() >= this.reserve() + 1;
  }

  // After a restart the governor knows nothing of the entries sent just before it. The gate tells it, from the day's
  // stored entries, so a restart can never allow a second full minute's worth inside one minute.
  prime(sentAtMs: number[]): void {
    this.tradeTimes.push(...sentAtMs);
    this.tradeTimes.sort((a, b) => a - b);
  }

  tradesInLastMinute(): number {
    const t = this.now();
    this.tradeTimes = this.tradeTimes.filter((x) => t - x < 60_000);
    return this.tradeTimes.length;
  }

  // An order that opens a position asks for a slot. Refused while the sliding minute is full, and while the
  // request bucket is down to the reserve. The slot is taken when it is granted, so ten entries arriving at
  // the same instant cannot all see "9 of 10 used". `ceiling` is the ceiling in force (limits.ts tradesCeiling: 150 while a
  // load day's window is on, else 100); it can never be above 150.
  admitTrade(limitPerMinute: number, ceiling: number = MAX_TRADES_PER_MINUTE): Admission {
    const cap = Math.min(Math.floor(limitPerMinute), Math.min(ceiling, MAX_TRADES_PER_MINUTE_LOAD_DAY));
    if (!(cap >= 1)) return this.refuse("trades-per-minute limit is below 1");
    if (this.tradesInLastMinute() >= cap) return this.refuse(`trades-per-minute limit reached (${cap})`);
    if (!this.canSpend()) return this.refuse(`holding back for safety: Alpaca's request budget is down to ${Math.floor(this.budget())} (the last ${this.reserve()} are kept for the stop command, cancels and the close-out)`);
    this.tradeTimes.push(this.now());
    this.peakTrades = Math.max(this.peakTrades, this.tradeTimes.length);
    return { ok: true };
  }

  private refuse(reason: string): Admission {
    this.refused++;
    return { ok: false, reason };
  }

  stats(): { requestsLastMinute: number; lowestBudget: number | null; peakTradesPerMinute: number; refusedByGovernor: number; rateLimitAnswers: number; reserveNow: number; lowestAboveReserve: number | null } {
    const t = this.now();
    return { requestsLastMinute: this.requestTimes.filter((x) => t - x < 60_000).length, lowestBudget: this.lowest, peakTradesPerMinute: this.peakTrades, refusedByGovernor: this.refused, rateLimitAnswers: this.rateLimited, reserveNow: this.reserve(), lowestAboveReserve: this.lowestAboveReserve };
  }

  // The reserve's lowest and highest value since the last call, and Alpaca's lowest remaining and lowest (remaining minus the reserve
  // in force) since the last call (for the per-minute statistics).
  takeMinuteReserve(): { min: number; max: number; lowestRemaining: number | null; lowestAboveReserve: number | null } {
    const r = this.minuteReserve ?? { min: this.reserve(), max: this.reserve() };
    const out = { ...r, lowestRemaining: this.minuteLowest, lowestAboveReserve: this.minuteLowestAboveReserve };
    this.minuteReserve = null;
    this.minuteLowest = null;
    this.minuteLowestAboveReserve = null;
    return out;
  }
  resetDayStats(): void {
    this.lowest = null;
    this.lowestAboveReserve = null;
    this.peakTrades = 0;
    this.refused = 0;
    this.rateLimited = 0;
  }
}
