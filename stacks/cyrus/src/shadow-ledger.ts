// THE SHADOW LOSS-STOP ESTIMATE'S OWN BOOK (Michael's decision 4 of 2026-11-06). SHADOW ONLY: nothing here sends, cancels, sizes,
// blocks or protects an order; the 5 second account check stays the loss stop.
//
// On 2026-11-06 the estimate (Alpaca's cash plus the broker view's positions at the last print) was up to 64 dollars away from
// Alpaca's equity, in both directions, about one position's value: the cash came from a fresh read and the positions from a view up
// to 10 seconds old. This book keeps cash and shares from the same moments instead:
//   - every fill on Alpaca's live order updates moves it (a buy takes its cost from cash and adds the shares; a sell the reverse;
//     the share count is Alpaca's own `position_qty` when given);
//   - it is SET from an account-and-positions read (the broker view's refresh, both asked at once) only while it has no trustworthy
//     state (before its first read, or after the live updates dropped, when a fill may have been missed), and only when no fill
//     arrived from QUIET_MS before that read began to QUIET_MS after it ended, so the read and the fills cannot overlap; such a read
//     waits until QUIET_MS has passed (a fill arriving meanwhile throws it away);
//   - while it is trustworthy, later reads only CHECK it (the largest cash difference is counted for the review), never overwrite
//     it: Alpaca's position list can lag a fill (the cause of the 2026-11-06 gaps), and the fills alone matched the account to the
//     cent on 2026-11-06;
//   - until the first such read, and after the live updates drop, it gives no estimate.
// The estimate is cash plus each position at the free feed's last print (or its last fill price).

export const QUIET_MS = 3_000;

interface PendingBase {
  cash: number;
  positions: Array<{ symbol: string; qty: number; price: number | null }>;
  startedMs: number;
  endedMs: number;
}

export class ShadowLedger {
  private cash: number | null = null;
  private readonly qty = new Map<string, number>();
  private readonly fillPrice = new Map<string, number>();
  private readonly basePrice = new Map<string, number>();
  private pending: PendingBase | null = null;
  private lastFillAt = Number.NEGATIVE_INFINITY;
  private baseAt: number | null = null;
  readonly counts = { bases: 0, basesSkipped: 0, fills: 0, dropped: 0, checks: 0, maxCheckCashGap: 0 };

  // True once the book has been set from a quiet read and nothing since has made it untrustworthy.
  valid(): boolean {
    return this.cash !== null;
  }

  // When the book was last set from a read (worker clock), or null.
  baseTime(): number | null {
    return this.baseAt;
  }

  lastFillTime(): number {
    return this.lastFillAt;
  }

  // An account-and-positions read, asked together from `startedMs` to `endedMs` (worker clock).
  offerBase(cash: number, positions: Array<{ symbol: string; qty: number; marketValue: number }>, startedMs: number, endedMs: number): void {
    if (!Number.isFinite(cash)) return;
    if (this.cash !== null) {
      // Trustworthy already: the read only checks the book (cash is what a lagging position list cannot distort).
      this.counts.checks++;
      if (this.lastFillAt < startedMs - QUIET_MS) this.counts.maxCheckCashGap = Math.max(this.counts.maxCheckCashGap, Math.round(Math.abs(cash - this.cash) * 100) / 100);
      return;
    }
    if (this.lastFillAt >= startedMs - QUIET_MS) {
      this.counts.basesSkipped++;
      return;
    }
    this.pending = { cash, positions: positions.map((p) => ({ symbol: p.symbol, qty: p.qty, price: p.qty > 0 ? p.marketValue / p.qty : null })), startedMs, endedMs };
  }

  // Sets the book from a pending read once its quiet time has passed with no fill.
  private commit(nowMs: number): void {
    const p = this.pending;
    if (!p || nowMs < p.endedMs + QUIET_MS) return;
    this.pending = null;
    this.cash = p.cash;
    this.qty.clear();
    this.basePrice.clear();
    for (const x of p.positions) {
      if (x.qty > 1e-9) this.qty.set(x.symbol, x.qty);
      if (x.price !== null && x.price > 0) this.basePrice.set(x.symbol, x.price);
    }
    this.baseAt = p.endedMs;
    this.counts.bases++;
  }

  // One fill from the live order updates, as it arrived (worker clock). `fillQty` is this fill's own shares; `positionQty` is
  // Alpaca's share count after it (null when not given).
  onFill(f: { symbol: string; side: "buy" | "sell"; fillQty: number | null; price: number | null; positionQty: number | null; arrivedMs: number }): void {
    if (this.pending) {
      if (f.arrivedMs <= this.pending.endedMs + QUIET_MS) {
        this.pending = null; // the read and this fill may overlap: not used
        this.counts.basesSkipped++;
      } else this.commit(f.arrivedMs);
    }
    this.lastFillAt = Math.max(this.lastFillAt, f.arrivedMs);
    this.counts.fills++;
    if (this.cash === null) return;
    const before = this.qty.get(f.symbol) ?? 0;
    let shares = f.fillQty;
    if (!(shares !== null && shares > 0) && f.positionQty !== null) shares = Math.abs(f.positionQty - before);
    if (!(shares !== null && shares > 0) || !(f.price !== null && f.price > 0)) {
      this.drop(); // a fill the book cannot count: no estimate until the next quiet read
      return;
    }
    this.cash += (f.side === "buy" ? -1 : 1) * shares * f.price;
    const after = f.positionQty !== null ? f.positionQty : before + (f.side === "buy" ? shares : -shares);
    if (after > 1e-9) this.qty.set(f.symbol, after);
    else this.qty.delete(f.symbol);
    this.fillPrice.set(f.symbol, f.price);
  }

  // The live updates dropped or reconnected: a fill may have been missed.
  drop(): void {
    if (this.cash !== null) this.counts.dropped++;
    this.cash = null;
    this.pending = null;
    this.qty.clear();
  }

  // Cash plus each position at the last print (else its last fill or read price). Null while the book is not trustworthy.
  estimate(lastPrices: ReadonlyMap<string, number>, nowMs: number): number | null {
    this.commit(nowMs);
    if (this.cash === null) return null;
    let value = this.cash;
    for (const [symbol, q] of this.qty) {
      const px = lastPrices.get(symbol) ?? this.fillPrice.get(symbol) ?? this.basePrice.get(symbol);
      if (px === undefined) return null;
      value += q * px;
    }
    return value;
  }
}
