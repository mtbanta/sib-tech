// MEASURING THE 3 SECOND STOP-GAP SALE (the speed release, Michael's decision 3 of 2026-11-05). When Alpaca cancels a bracket's stop
// at a partial take-profit, the shares left are sold 3 seconds after the cancel (risk.ts). Michael asked to see, every day, how
// many of those sold shares would have filled at their take-profit within the next 5 seconds, and the dollars gained or lost
// against waiting.
//
// For each such sale: the free feed's prints of that symbol in the 5 seconds after the sale was sent are watched, and the sale's own
// fill price is taken from Alpaca's live order updates. Waiting 5 more seconds is valued at the take-profit price if a print reached
// it in those 5 seconds, and otherwise at the last print at the end of them (as if the shares had been sold then). Dollars against
// waiting = (the sale's fill price minus that value) times the shares: positive means selling at once did better. It is an estimate
// (one exchange's prints, and paper fills within about a cent of them), and it is labelled so in the summary. It only watches: it
// never sends, cancels or changes anything.
import type { StopGapDay } from "./summary.ts";

export const STOP_GAP_WATCH_MS = 5_000;
// A sale whose fill price has not arrived this long after it was sent is counted as not measured.
const GIVE_UP_MS = 60_000;

interface Watch {
  symbol: string;
  shares: number;
  takeProfit: number | null;
  atMs: number;
  maxPrint: number | null;
  lastPrint: number | null;
  fill: number | null;
}

export const stopGapKey = (date: string) => `stop_gap:${date}`;

export const emptyStopGap = (): StopGapDay => ({ sales: 0, shares: 0, wouldHaveFilled: 0, unmeasured: 0, dollarsVsWaiting: 0 });

export class StopGapMeter {
  private watching: Watch[] = [];
  private day: StopGapDay = emptyStopGap();
  private date: string | null = null;

  // Starts a new day (or carries on with the totals already saved for it, after a restart).
  startDay(date: string, saved: StopGapDay | null): void {
    if (this.date === date) return;
    this.date = date;
    this.day = saved ? { ...emptyStopGap(), ...saved } : emptyStopGap();
    this.watching = [];
  }

  onSale(sale: { symbol: string; shares: number; takeProfit: number | null; atMs: number }): void {
    if (!(sale.shares > 0)) return;
    this.watching.push({ ...sale, maxPrint: null, lastPrint: null, fill: null });
  }

  // A print from the free feed's live prices.
  onPrint(symbol: string, price: number, atMs: number): void {
    for (const w of this.watching) {
      if (w.symbol !== symbol || atMs < w.atMs || atMs > w.atMs + STOP_GAP_WATCH_MS) continue;
      w.maxPrint = w.maxPrint === null ? price : Math.max(w.maxPrint, price);
      w.lastPrint = price;
    }
  }

  // A fill of one of the stack's own sells (client id cyrus-x-) from the live order updates: it belongs to the oldest watched sale
  // of that symbol that has no fill yet and was sent no later than the fill.
  onOwnSellFill(symbol: string, price: number, atMs: number): void {
    const w = this.watching.find((x) => x.symbol === symbol && x.fill === null && x.atMs <= atMs + 1_000);
    if (w) w.fill = price;
  }

  // Moves every sale whose 5 seconds are over and whose fill is known into the day's totals. Returns true when the totals changed.
  settle(nowMs: number): boolean {
    let changed = false;
    const still: Watch[] = [];
    for (const w of this.watching) {
      const watched = nowMs >= w.atMs + STOP_GAP_WATCH_MS;
      if (watched && w.fill !== null) {
        const hit = w.takeProfit !== null && w.maxPrint !== null && w.maxPrint >= w.takeProfit - 1e-9;
        const waitValue = hit ? w.takeProfit! : (w.lastPrint ?? w.fill);
        this.add(w, hit, (w.fill - waitValue) * w.shares);
        changed = true;
      } else if (nowMs >= w.atMs + GIVE_UP_MS) {
        this.day.sales++;
        this.day.shares += w.shares;
        this.day.unmeasured++;
        changed = true;
      } else still.push(w);
    }
    this.watching = still;
    return changed;
  }

  private add(w: Watch, hit: boolean, dollars: number): void {
    this.day.sales++;
    this.day.shares += w.shares;
    if (hit) this.day.wouldHaveFilled++;
    this.day.dollarsVsWaiting = Math.round((this.day.dollarsVsWaiting + dollars) * 100) / 100;
  }

  // The day so far, with sales still being watched counted as not measured.
  totals(): StopGapDay {
    return { ...this.day, sales: this.day.sales + this.watching.length, shares: this.day.shares + this.watching.reduce((n, w) => n + w.shares, 0), unmeasured: this.day.unmeasured + this.watching.length };
  }

  // The settled totals only (what is saved to the database).
  saved(): StopGapDay {
    return { ...this.day };
  }
}
