// THE ORDER-RATE GOVERNOR. Fixed code, no settings. Two jobs:
//
//  1. Hold the per-minute cap on orders that open positions ("trades a minute", at most MAX_TRADES_PER_MINUTE
//     whatever Michael approved) with a sliding 60 second window.
//  2. Keep headroom under Alpaca's request limit. Alpaca counts account, order and position calls in one bucket of
//     200 requests a minute (measured 2026-11-02; refills at about 3.3 a second; the clock and calendar are counted
//     separately). The governor listens to the `X-Ratelimit-Remaining` header on every answer. Work that is NOT about
//     safety (entries, and the reads that serve them) may only use the bucket down to SAFETY_RESERVE; the last tokens
//     belong to the stop command, cancels, protective actions and the close-out, which are never held back by it.
import { MAX_TRADES_PER_MINUTE } from "./limits.ts";
import type { RateInfo } from "./alpaca-trading.ts";

export const ALPACA_REQUESTS_PER_MINUTE = 200;
export const SAFETY_RESERVE = 80;
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

  constructor(now: () => number = Date.now) {
    this.now = now;
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
    }
  }

  // Our best estimate of the tokens left in Alpaca's bucket right now: the last number it told us, plus the refill since.
  budget(): number {
    if (this.remaining === null) return ALPACA_REQUESTS_PER_MINUTE;
    return Math.min(ALPACA_REQUESTS_PER_MINUTE, this.remaining + (this.now() - this.remainingAt) * REFILL_PER_MS);
  }

  // Can work that is not about safety spend a request right now?
  canSpend(): boolean {
    return this.budget() >= SAFETY_RESERVE + 1;
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
  // request bucket is down to the safety reserve. The slot is taken when it is granted, so ten entries arriving at
  // the same instant cannot all see "9 of 10 used".
  admitTrade(limitPerMinute: number): Admission {
    const cap = Math.min(Math.floor(limitPerMinute), MAX_TRADES_PER_MINUTE);
    if (!(cap >= 1)) return this.refuse("trades-per-minute limit is below 1");
    if (this.tradesInLastMinute() >= cap) return this.refuse(`trades-per-minute limit reached (${cap})`);
    if (!this.canSpend()) return this.refuse(`holding back for safety: Alpaca's request budget is down to ${Math.floor(this.budget())} (the last ${SAFETY_RESERVE} are kept for the stop command, cancels and the close-out)`);
    this.tradeTimes.push(this.now());
    this.peakTrades = Math.max(this.peakTrades, this.tradeTimes.length);
    return { ok: true };
  }

  private refuse(reason: string): Admission {
    this.refused++;
    return { ok: false, reason };
  }

  stats(): { requestsLastMinute: number; lowestBudget: number | null; peakTradesPerMinute: number; refusedByGovernor: number; rateLimitAnswers: number } {
    const t = this.now();
    return { requestsLastMinute: this.requestTimes.filter((x) => t - x < 60_000).length, lowestBudget: this.lowest, peakTradesPerMinute: this.peakTrades, refusedByGovernor: this.refused, rateLimitAnswers: this.rateLimited };
  }
  resetDayStats(): void {
    this.lowest = null;
    this.peakTrades = 0;
    this.refused = 0;
    this.rateLimited = 0;
  }
}
