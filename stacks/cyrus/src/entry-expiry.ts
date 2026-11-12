// THE LOAD WINDOW'S ENTRY WAIT (the speed release, Michael's decision 4 of 2026-11-05). In the load window every entry is a 1-share
// LIMIT buy at or below the price seen. One that Alpaca has not filled LOAD_ENTRY_WAIT_MS after it accepted it is cancelled, so its
// symbol is free for the next print instead of waiting on a price that has moved away.
//
// Safety:
//   - only an entry the gate sent as a 1-share limit buy is ever scheduled here (a 1-share order cannot partly fill, so a cancel can
//     never leave part of a position behind);
//   - the cancel goes to the entry order itself. If Alpaca has already filled it, Alpaca may refuse the cancel ("already filled",
//     treated as done by the client) and the position keeps both of its exits. But when the cancel reaches Alpaca as the entry fills,
//     Alpaca fills the entry and still cancels both exits (0.05 to 1.06 seconds later): 24 of 24 such cases on 2026-11-11, and 3 on
//     2026-11-09 (the earlier comment here said the exits were kept, which was wrong). A5 of 2026-11-12: the time each cancel was sent is
//     kept, so a fill that arrives after it starts the fast sale at once (worker.ts, risk.ts fastLostExitSale);
//   - an entry whose fill has already arrived on the live order updates is not cancelled at all;
//   - nothing here sends an order or a sell, and the symbol is freed only by the live update of the cancel (order-stream.ts), or by
//     the order sync, never by this timer.
// Each cancel is one request to Alpaca (not an order: it does not count against the trades-a-minute ceiling).

const CANCEL_SENT_KEEP = 20_000;

export interface EntryExpiryDeps {
  cancelOrder: (alpacaOrderId: string) => Promise<void>;
  // True once a fill of this entry has arrived on the live order updates.
  wasFilled: (clientOrderId: string) => boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // Milliseconds now (A5: when each cancel was sent). The tests use a simulated clock.
  nowMs?: () => number;
}

export interface ExpiryCounts {
  scheduled: number;
  // Cancel requests sent (Alpaca may still have filled some first; the live updates count the entries really cancelled).
  cancelled: number;
  // Not cancelled because their fill had already arrived.
  filledFirst: number;
  // Cancel requests that failed (the entry stays working; the order sync and the close-out still see it).
  failed: number;
}

export class EntryExpiry {
  counts: ExpiryCounts = { scheduled: 0, cancelled: 0, filledFirst: 0, failed: 0 };
  private readonly d: EntryExpiryDeps;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly pending = new Set<Promise<void>>();
  // A5: when the cancel of each entry (client id) was sent, for the day (at most CANCEL_SENT_KEEP entries are kept).
  private readonly cancelSent = new Map<string, number>();

  constructor(deps: EntryExpiryDeps) {
    this.d = deps;
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  }

  // Starts the wait for one entry the gate has just sent (Alpaca has accepted it).
  schedule(e: { clientOrderId: string; alpacaOrderId: string; symbol: string; qty: number }, waitMs: number): void {
    if (e.qty !== 1 || !(waitMs > 0)) return;
    this.counts.scheduled++;
    this.setTimer(() => {
      const p = this.expire(e).finally(() => this.pending.delete(p));
      this.pending.add(p);
    }, waitMs);
  }

  // Resolves when every cancel started so far has finished (the tests use it).
  async settled(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }

  resetDay(): void {
    this.counts = { scheduled: 0, cancelled: 0, filledFirst: 0, failed: 0 };
    this.cancelSent.clear();
  }

  // A5: when this entry's cancel was sent (milliseconds), or undefined if it was never sent.
  cancelSentAt(clientOrderId: string): number | undefined {
    return this.cancelSent.get(clientOrderId);
  }

  private async expire(e: { clientOrderId: string; alpacaOrderId: string; symbol: string }): Promise<void> {
    if (this.d.wasFilled(e.clientOrderId)) {
      this.counts.filledFirst++;
      return;
    }
    this.cancelSent.set(e.clientOrderId, (this.d.nowMs ?? Date.now)());
    if (this.cancelSent.size > CANCEL_SENT_KEEP) this.cancelSent.delete(this.cancelSent.keys().next().value!);
    try {
      await this.d.cancelOrder(e.alpacaOrderId);
      this.counts.cancelled++;
      this.d.log?.("entry_expired", { symbol: e.symbol });
    } catch (err) {
      this.counts.failed++;
      this.d.log?.("entry_expiry_failed", { symbol: e.symbol, error: (err as Error).message.slice(0, 120) });
    }
  }
}
