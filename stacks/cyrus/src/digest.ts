// Trade news for Michael's phone, in batches. Posting to Discord one message per trade would flood the phone and, worse,
// make trading wait on Discord's own rate limit. The order gate only adds a line here (instant, never waits); the
// worker posts the batch every so often as ONE message to `trading`.
export class TradeDigest {
  private lines: string[] = [];
  private dropped = 0;
  private readonly maxLines: number;
  constructor(maxLines = 60) {
    this.maxLines = maxLines;
  }

  add(line: string): void {
    if (this.lines.length >= this.maxLines) this.dropped++;
    else this.lines.push(line);
  }

  pending(): number {
    return this.lines.length + this.dropped;
  }

  // Takes what is waiting, as messages that each fit Discord's limit. Empty when there is nothing.
  take(maxChars = 1800): string[] {
    if (this.pending() === 0) return [];
    const out: string[] = [];
    let chunk = "";
    for (const l of this.lines) {
      if (chunk && chunk.length + l.length + 1 > maxChars) {
        out.push(chunk);
        chunk = "";
      }
      chunk = chunk ? `${chunk}\n${l}` : l;
    }
    if (this.dropped > 0) chunk = `${chunk}\n(+${this.dropped} more not listed)`;
    if (chunk) out.push(chunk);
    this.lines = [];
    this.dropped = 0;
    return out;
  }
}
