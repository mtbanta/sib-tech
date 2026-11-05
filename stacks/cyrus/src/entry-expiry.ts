// THE LOAD WINDOW'S ENTRY WAIT (the speed release, Michael's decision 4 of 2026-11-05). In the load window every entry is a 1-share
// LIMIT buy at or below the price seen. One that Alpaca has not filled LOAD_ENTRY_WAIT_MS after it accepted it is cancelled, so its
// symbol is free for the next print instead of waiting on a price that has moved away.
//
// Safety:
//   - only an entry the gate sent as a 1-share limit buy is ever scheduled here (a 1-share order cannot partly fill, so a cancel can
//     never leave part of a position behind);
//   - the cancel goes to the entry order itself. If Alpaca filled it in the meantime, Alpaca refuses the cancel ("already filled",
//     treated as done by the client) and the position keeps both of its exits;
//   - an entry whose fill has already arrived on the live order updates is not cancelled at all;
//   - nothing here sends an order or a sell, and the symbol is freed only by the live update of the cancel (order-stream.ts), or by
//     the order sync, never by this timer.
// Each cancel is one request to Alpaca (not an order: it does not count against the trades-a-minute ceiling).

export interface EntryExpiryDeps {
  cancelOrder: (alpacaOrderId: string) => Promise<void>;
  // True once a fill of this entry has arrived on the live order updates.
  wasFilled: (clientOrderId: string) => boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  log?: (event: string, data?: Record<string, unknown>) => void;
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
  }

  private async expire(e: { clientOrderId: string; alpacaOrderId: string; symbol: string }): Promise<void> {
    if (this.d.wasFilled(e.clientOrderId)) {
      this.counts.filledFirst++;
      return;
    }
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
