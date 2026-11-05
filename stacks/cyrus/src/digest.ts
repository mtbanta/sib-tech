// Trade news for Michael's phone, in batches. Posting to Discord one message per trade would flood the phone and, worse,
// make trading wait on Discord's own rate limit. The order gate only adds to it here (instant, never waits); the worker posts
// the batch every so often as ONE message to `trading`.
//
// The speed release (Michael's decision 6, 2026-11-05, "Discord, quieter"): on 2026-11-05 the digest was 792 of the day's 896
// messages, one line per entry, every 20 seconds. It is now ONE line per period with counts (entries sent, filled, unfilled
// limit entries cancelled, take-profits, stops, refused by Alpaca). A line of any other kind is still listed (at most a few).
// An entry whose outcome at Alpaca is unclear is not here: it keeps its own post in `commands`.

export type DigestKind = "entry" | "refused" | "filled" | "cancelled" | "take_profit" | "stop" | "other";

// How often the worker posts the digest during the session: at most 78 lines on a full day (6.5 hours), against 792 messages on
// 2026-11-05. Five minutes is short enough to see the load window minute by minute in three lines, long enough not to buzz.
export const DIGEST_PERIOD_MS = 5 * 60_000;

const ORDER: Array<[DigestKind, (n: number) => string]> = [
  ["entry", (n) => `${n} entr${n === 1 ? "y" : "ies"} sent`],
  ["filled", (n) => `${n} filled`],
  ["cancelled", (n) => `${n} unfilled and cancelled`],
  ["take_profit", (n) => `${n} take-profit${n === 1 ? "" : "s"}`],
  ["stop", (n) => `${n} stop${n === 1 ? "" : "s"}`],
  ["refused", (n) => `${n} refused by Alpaca`],
];

export class TradeDigest {
  private counts = new Map<DigestKind, number>();
  private others: string[] = [];
  private droppedOthers = 0;
  private readonly maxOthers: number;
  constructor(maxOthers = 5) {
    this.maxOthers = maxOthers;
  }

  // Adds one event. `line` is kept only for the "other" kind (for the counted kinds the count is the news).
  add(line: string, kind: DigestKind = "other"): void {
    if (kind !== "other") {
      this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1);
      return;
    }
    if (this.others.length >= this.maxOthers) this.droppedOthers++;
    else this.others.push(line);
  }

  count(kind: Exclude<DigestKind, "other">): void {
    this.add("", kind);
  }

  pending(): number {
    return [...this.counts.values()].reduce((a, b) => a + b, 0) + this.others.length + this.droppedOthers;
  }

  // Takes what is waiting, as messages that each fit Discord's limit (one line, plus any "other" lines). Empty when there is
  // nothing. `label` names the period, for example "9:05 to 9:10 AM".
  take(label = "", maxChars = 1800): string[] {
    if (this.pending() === 0) return [];
    const parts = ORDER.filter(([k]) => (this.counts.get(k) ?? 0) > 0).map(([k, f]) => f(this.counts.get(k)!));
    const head = parts.length > 0 ? `${label ? `${label}: ` : ""}${parts.join(", ")}.` : "";
    const lines = [head, ...this.others, this.droppedOthers > 0 ? `(+${this.droppedOthers} more not listed)` : ""].filter(Boolean);
    this.counts = new Map();
    this.others = [];
    this.droppedOthers = 0;
    const out: string[] = [];
    let chunk = "";
    for (const l of lines) {
      if (chunk && chunk.length + l.length + 1 > maxChars) {
        out.push(chunk);
        chunk = "";
      }
      chunk = chunk ? `${chunk}\n${l}` : l;
    }
    if (chunk) out.push(chunk);
    return out;
  }
}
