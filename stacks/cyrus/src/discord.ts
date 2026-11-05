// Posting to Discord through stack C's alerts webhook. A webhook needs no bot and posts to one channel.
// Reading the command channel is a later piece.
import type { Redactor } from "./redact.ts";

export const PAPER_ONLY = "Paper trading only.";
// For messages that are research input for a decision Michael makes: the evening limits post and the daily summary.
export const NOT_ADVICE = "Paper trading only. Research input for a human decision, never an instruction to act.";

const MAX_CONTENT = 2000;

export type ChannelName = "alerts" | "trading" | "commands";

// THE FOOTER RULE (Michael's speed-release decision 6, 2026-11-05: "the footer only where it applies", fewer "Research input" lines):
//   - the evening limits post and the daily summary end with NOT_ADVICE (they are research input for a decision);
//   - every message to `alerts`, the live list, and the full morning review or reminder end with PAPER_ONLY;
//   - one-line confirmations, the trade digest and command replies carry no footer.
// The `alerts` footer is added here, at posting (footerFor); the others are written into their texts by the code that makes them.
export function footerFor(channel: ChannelName, text: string): string {
  return channel === "alerts" && !text.trimEnd().endsWith(PAPER_ONLY) && !text.trimEnd().endsWith(NOT_ADVICE) ? `\n${PAPER_ONLY}` : "";
}

// Adds "Paper trading only." to a text that lacks it and cuts it to one message. Kept for a caller that must send a single
// message; the bot and the alerts webhook use messagesFor below instead, which never cuts.
export function finalizeMessage(text: string, max = MAX_CONTENT): string {
  const footer = text.includes(PAPER_ONLY) ? "" : `\n${PAPER_ONLY}`;
  const room = max - footer.length;
  const body = text.length > room ? `${text.slice(0, room - 12)}\n(cut short)` : text;
  return body + footer;
}

// Michael's ruling, 2026-11-03: a post longer than Discord's limit is sent as consecutive messages, never cut, so nothing is
// lost. The text is split at line breaks (a single line longer than a message is split inside the line). The earlier parts say
// the text continues; the last part keeps the original ending, so a closing warning or footer arrives last, as written. A text
// that fits is sent exactly as it is (since the speed release no footer is added here: see footerFor and messagesFor).
export const CONTINUED = "(continued in the next message)";
export function splitMessage(text: string, max = MAX_CONTENT): string[] {
  if (text.length <= max) return [text];
  const tail = `\n${CONTINUED}`;
  const room = max - tail.length; // for every part but the last
  const lines = text.split("\n").flatMap((l) => (l.length <= room ? [l] : l.match(new RegExp(`[\\s\\S]{1,${room}}`, "g"))!));
  const parts: string[] = [];
  let cur = "";
  for (const line of lines) {
    const next = cur === "" ? line : `${cur}\n${line}`;
    if (next.length <= room) cur = next;
    else {
      parts.push(cur);
      cur = line;
    }
  }
  // The last part must fit too; if it does not, its first lines move into a part of their own.
  while (cur.length > max) {
    const cut = cur.lastIndexOf("\n", room);
    const at = cut > 0 ? cut : room;
    parts.push(cur.slice(0, at));
    cur = cur.slice(at).replace(/^\n/, "");
  }
  return [...parts.map((p) => p + tail), cur];
}

// What a post to a channel becomes: the footer rule applied, then split into messages that each fit.
export function messagesFor(channel: ChannelName, text: string): string[] {
  return splitMessage(text + footerFor(channel, text));
}

export interface PostResult {
  ok: boolean;
  status: number;
}

// Posts a plain text message to the alerts webhook. Retries once after a rate limit answer. Never throws on a refused post: the
// caller decides what a failed alert means. The text is redacted and carries "Paper trading only." (an alert); a text over
// Discord's 2000 character limit is sent as consecutive messages, and the result is that of the first part that failed, or of
// the last part.
export async function postWebhook(
  webhookUrl: string,
  text: string,
  redact: Redactor,
  fetchImpl: typeof fetch = fetch,
): Promise<PostResult> {
  let last: PostResult = { ok: false, status: 0 };
  for (const content of messagesFor("alerts", redact(text))) {
    last = await postOnePart(webhookUrl, content, fetchImpl);
    if (!last.ok) return last;
  }
  return last;
}

async function postOnePart(webhookUrl: string, content: string, fetchImpl: typeof fetch): Promise<PostResult> {
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
