// Posting to Discord through stack C's alerts webhook. A webhook needs no bot and posts to one channel.
// Reading the command channel is a later piece.
import type { Redactor } from "./redact.ts";

export const NOT_ADVICE = "Paper trading only. Research input for a human decision, never an instruction to act.";

const MAX_CONTENT = 2000;

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
  const content = redact(text).slice(0, MAX_CONTENT);
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
