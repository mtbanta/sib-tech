// Michael's approval of 2026-11-24 (evening), item 2: "end the pause on Alpaca's live cancel confirmation; single-position sales only,
// close-outs unchanged" (option B of builds/c2-proposal-2026-11-24-fresh-stop-pause.md).
//
// Remembers, by exact Alpaca order id, the orders Alpaca's live updates reported cancelled in the last CANCEL_SEEN_MEMORY_MS, and lets one
// position's own sale wait for every order it cancelled to be reported cancelled. Only a `canceled` update for that very id counts: never
// `pending_cancel`, a fill, a partial fill, or any update for the symbol (group 1 ruled out ending the pause on "any update for the
// symbol"). A take-profit rest that filled instead of cancelling is never confirmed here, so its sale waits the full half second, as today.
//
// The memory is kept because the confirmation often arrives before the pause starts: on 2026-11-24 Alpaca's cancel landed before its answer
// in 32 of 33 fresh stops, and the live update of a stop leg Alpaca cancelled itself reached the worker 38 to 100 ms after Alpaca's cancel
// time (measured that day for stop legs, on two clocks; not yet measured for the take-profit rest a sale cancels). It also covers a stop leg
// Alpaca cancelled itself shortly before the sale (its update arrived before the sale existed).
//
// It never sends anything and never retries. Bounds: entries older than CANCEL_SEEN_MEMORY_MS are dropped, and at most CANCEL_SEEN_MAX are
// kept (oldest dropped first); every wait ends at its own time limit; with the live updates not connected, a wait is a plain pause.

import type { TradeUpdate } from "./order-stream.ts";

export const CANCEL_SEEN_MEMORY_MS = 60_000;
export const CANCEL_SEEN_MAX = 2_000;

// How a sale's half-second pause ended: "confirmed", every order it cancelled reported cancelled by the live updates (the pause ended then,
// or did not start); "timer", the full pause ran; "not_live", the live updates were not connected, so the full pause ran.
export type PauseEnd = "confirmed" | "timer" | "not_live";

export interface CancelSeenDeps {
  now: () => number;
  live: () => boolean;
  sleep: (ms: number) => Promise<void>;
}

export class CancelSeen {
  private readonly d: CancelSeenDeps;
  // Order id -> the worker's clock when its `canceled` update arrived. Insertion order is arrival order (an id seen again moves to the end).
  private readonly seen = new Map<string, number>();
  private readonly waiters = new Set<{ ids: readonly string[]; confirm: () => void }>();
  constructor(d: CancelSeenDeps) {
    this.d = d;
  }

  // Told about every live update (never throws).
  note(u: TradeUpdate): void {
    try {
      if (u.event !== "canceled" || !u.order?.id) return;
      const t = this.d.now();
      this.seen.delete(u.order.id);
      this.seen.set(u.order.id, t);
      this.prune(t);
      for (const w of [...this.waiters]) if (this.allSeen(w.ids)) w.confirm();
    } catch {
      // logging-grade bookkeeping: never breaks the live updates
    }
  }

  private prune(t: number): void {
    for (const [id, at] of this.seen) {
      if (t - at <= CANCEL_SEEN_MEMORY_MS && this.seen.size <= CANCEL_SEEN_MAX) break;
      this.seen.delete(id);
    }
  }

  private allSeen(ids: readonly string[]): boolean {
    const t = this.d.now();
    return ids.length > 0 && ids.every((id) => {
      const at = this.seen.get(id);
      return at !== undefined && t - at <= CANCEL_SEEN_MEMORY_MS;
    });
  }

  // Waits up to `ms` for every one of `ids` to be reported cancelled. "confirmed" at once when they all already are; otherwise at the
  // moment the last one is; "timer" when `ms` ran out first. With the live updates not connected (at the start), a plain pause of `ms`
  // ("not_live"). An empty list never confirms.
  wait(ids: readonly string[], ms: number): Promise<PauseEnd> {
    if (!this.d.live()) return this.d.sleep(ms).then(() => "not_live" as const);
    this.prune(this.d.now());
    if (this.allSeen(ids)) return Promise.resolve("confirmed" as const);
    return new Promise<PauseEnd>((resolve) => {
      let done = false;
      const w = {
        ids: [...ids],
        confirm: () => {
          if (done) return;
          done = true;
          this.waiters.delete(w);
          resolve("confirmed");
        },
      };
      this.waiters.add(w);
      const end = () => {
        if (done) return;
        done = true;
        this.waiters.delete(w);
        resolve("timer");
      };
      void this.d.sleep(ms).then(end, end);
    });
  }

  // For tests: how many ids are remembered, and how many waits are open.
  size(): { seen: number; waiting: number } {
    return { seen: this.seen.size, waiting: this.waiters.size };
  }
}
