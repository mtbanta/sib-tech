// Posting to Discord through stack C's alerts webhook. A webhook needs no bot and posts to one channel.
// Reading the command channel is a later piece.
import type { Redactor } from "./redact.ts";

export const PAPER_ONLY = "Paper trading only.";
// For messages that are research input (the suggested limits, the live list): they offer something for Michael to
// decide on. A message that reports something the bot has already DONE (a sale, a close-out) carries only
// PAPER_ONLY, because "never an instruction to act" does not fit a report of an action taken.
export const NOT_ADVICE = "Paper trading only. Research input for a human decision, never an instruction to act.";

const MAX_CONTENT = 2000;

// The one place every outgoing message passes through: "Paper trading only." is on all of them, and the text is
// cut to Discord's limit with that line kept (the cut falls on the body, not on the footer).
export function finalizeMessage(text: string, max = MAX_CONTENT): string {
  const footer = text.includes(PAPER_ONLY) ? "" : `\n${PAPER_ONLY}`;
  const room = max - footer.length;
  const body = text.length > room ? `${text.slice(0, room - 12)}\n(cut short)` : text;
  return body + footer;
}

export interface PostResult {
  ok: boolean;
  status: number;
}

// Posts a plain text message. Retries once after a rate limit answer. Never throws on a refused post: the
// caller decides what a failed alert means. The text is redacted and cut to Discord's 2000 character limit.
export async function postWebhook(
  webhookUrl: string,
  text: string,
  redact: Redactor,
  fetchImpl: typeof fetch = fetch,
): Promise<PostResult> {
  const content = finalizeMessage(redact(text));
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No mentions: an alert must not ping @everyone by accident.
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return { ok: false, status: 0 };
    }
    if (res.status === 429 && attempt === 0) {
      const wait = Number(res.headers.get("retry-after")) || 1;
      await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
      continue;
    }
    return { ok: res.ok, status: res.status };
  }
  return { ok: false, status: 429 };
}
