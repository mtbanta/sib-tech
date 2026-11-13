// Michael's standing design rule (2026-11-13, confirmed the same day): every retry loop has a limit (a maximum number of tries or a
// maximum rate) and always a backoff; no loop may retry without bound. This is the one small helper the older loops use (item 3 of
// 2026-11-13): after a failure the next try waits `firstMs`, then twice as long each time, at most `maxMs`; a success resets it. The
// longest wait is the rate limit (at most one try per `maxMs` once it has grown). No requests are made here.
export class RetryBackoff {
  private nextAt = 0;
  private delayMs = 0;
  private readonly firstMs: number;
  private readonly maxMs: number;
  constructor(firstMs: number, maxMs: number) {
    this.firstMs = firstMs;
    this.maxMs = maxMs;
  }

  // True when a try may go ahead now (never failed, or the wait after the last failure has passed).
  due(nowMs: number): boolean {
    return nowMs >= this.nextAt;
  }

  // A try failed: the next one waits longer (first, then doubling, at most the maximum). Returns the wait.
  failed(nowMs: number): number {
    this.delayMs = this.delayMs > 0 ? Math.min(this.delayMs * 2, this.maxMs) : this.firstMs;
    this.nextAt = nowMs + this.delayMs;
    return this.delayMs;
  }

  // A try worked: the next failure starts from the first wait again.
  succeeded(): void {
    this.delayMs = 0;
    this.nextAt = 0;
  }

  // When the next try may go ahead (0 when it may now), for logging and scheduling.
  dueAt(): number {
    return this.nextAt;
  }
}
