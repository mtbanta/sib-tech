// Decides when a price feed problem is worth telling Michael about. A failed login is reported at once;
// reconnecting is reported only when it keeps happening, and never more than once every 15 minutes.
import type { StreamStatus } from "./stream.ts";

const COOLDOWN_MS = 15 * 60_000;
const RECONNECTS_BEFORE_ALERT = 5;

export class FeedAlerter {
  private reconnects = 0;
  private lastAlertAt = -Infinity;

  // Returns a message to post, or null.
  onStatus(status: StreamStatus, nowMs: number): string | null {
    if (status === "live") {
      this.reconnects = 0;
      return null;
    }
    const cooled = nowMs - this.lastAlertAt >= COOLDOWN_MS;
    if (status === "auth_failed" && cooled) {
      this.lastAlertAt = nowMs;
      return "**The live price feed refused our login.** No prices means no entries today (nothing unsafe), but nothing will trade until this is fixed.";
    }
    if (status === "reconnecting") {
      this.reconnects++;
      if (this.reconnects >= RECONNECTS_BEFORE_ALERT && cooled) {
        this.lastAlertAt = nowMs;
        return `The live price feed keeps dropping (${this.reconnects} reconnects in a row). Entries wait for fresh prices.`;
      }
    }
    return null;
  }
}
