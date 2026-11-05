// Stack C's Discord bot, over Discord's plain web interface (no live connection needed). It posts to the
// server's channels and reads the command channel by asking for messages newer than the last one handled.
// Checked at start: the command channel really belongs to the configured server.
import type { Settings } from "./config.ts";
import type { Redactor } from "./redact.ts";
import { NOT_ADVICE, messagesFor, type ChannelName } from "./discord.ts";

const API = "https://discord.com/api/v10";
const MAX_CONTENT = 2000;

export interface DiscordMessage {
  id: string;
  channelId: string;
  content: string;
  authorId: string;
  authorIsBot: boolean;
  at: Date;
}

export type { ChannelName };

export class DiscordBot {
  private readonly settings: Settings;
  private readonly redact: Redactor;
  private readonly fetchImpl: typeof fetch;
  private channelIds: Partial<Record<ChannelName, string>> = {};

  constructor(settings: Settings, redact: Redactor, fetchImpl: typeof fetch = fetch) {
    this.settings = settings;
    this.redact = redact;
    this.fetchImpl = fetchImpl;
  }

  private async call(method: string, path: string, body?: unknown): Promise<any> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await this.fetchImpl(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bot ${this.settings.discord.botToken}`,
          "User-Agent": "DiscordBot (sib-tech-stack-c, 0.1)",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
      if (res.status === 429 && attempt === 0) {
        const wait = Number((await res.json().catch(() => ({}))).retry_after) || 1;
        await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`Discord ${method} ${path.replace(/\d{15,}/g, "<id>")} answered ${res.status}`);
      return res.status === 204 ? null : res.json();
    }
    throw new Error("Discord rate limit did not clear");
  }

  // Finds the server's channels by name and checks the command channel belongs to the configured server.
  async start(): Promise<void> {
    const { guildId, commandChannelId } = this.settings.discord;
    const channels = (await this.call("GET", `/guilds/${guildId}/channels`)) as Array<{ id: string; name: string; type: number }>;
    for (const name of ["alerts", "trading", "commands"] as const) {
      const c = channels.find((x) => x.name === name && x.type === 0);
      if (c) this.channelIds[name] = c.id;
    }
    if (this.channelIds.commands !== commandChannelId) throw new Error("The command channel is not the `commands` channel of the configured server");
    if (!this.channelIds.trading) throw new Error("The server has no `trading` channel");
  }

  private idFor(channel: ChannelName): string {
    const id = this.channelIds[channel];
    if (!id) throw new Error(`Channel ${channel} is not known (call start first)`);
    return id;
  }

  // A long post whose later part failed: the parts already sent, so that the caller's retry of the same text sends only the rest
  // (the speed release: before, a retry posted the first parts again). Forgotten after 10 minutes, or once the post completes.
  private partlySent = new Map<string, { sent: number; at: number }>();

  // Posts plain text, redacted, with the footer rule applied (discord.ts footerFor); a text over Discord's limit is sent as
  // consecutive messages. Mentions are switched off, except that a message can ask to mention the owner (and only the owner), for
  // the alerts that need a person now.
  async post(channel: ChannelName, text: string, opts: { mentionOwner?: boolean } = {}): Promise<boolean> {
    const owner = this.settings.discord.ownerUserId;
    const body = opts.mentionOwner ? `<@${owner}> ${text}` : text;
    // A text over Discord's limit goes out as consecutive messages, in order; the owner is mentioned in the first.
    const parts = messagesFor(channel, this.redact(body));
    const key = `${channel}\n${body}`;
    const now = Date.now();
    for (const [k, v] of [...this.partlySent]) if (now - v.at > 10 * 60_000) this.partlySent.delete(k);
    const from = parts.length > 1 ? (this.partlySent.get(key)?.sent ?? 0) : 0;
    let i = from;
    try {
      for (; i < parts.length; i++) {
        const mention = opts.mentionOwner && i === 0;
        await this.call("POST", `/channels/${this.idFor(channel)}/messages`, { content: parts[i], allowed_mentions: mention ? { parse: [], users: [owner] } : { parse: [] } });
      }
      this.partlySent.delete(key);
      return true;
    } catch {
      if (i > 0 && parts.length > 1) this.partlySent.set(key, { sent: i, at: now });
      return false;
    }
  }

  // Newest message id in the command channel, or null if it is empty.
  async latestCommandMessageId(): Promise<string | null> {
    const rows = (await this.call("GET", `/channels/${this.settings.discord.commandChannelId}/messages?limit=1`)) as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  }

  // Messages newer than `afterId`, oldest first.
  async commandMessagesAfter(afterId: string): Promise<DiscordMessage[]> {
    const rows = (await this.call("GET", `/channels/${this.settings.discord.commandChannelId}/messages?limit=50&after=${afterId}`)) as Array<any>;
    return rows
      .map((m) => ({ id: String(m.id), channelId: String(m.channel_id), content: String(m.content ?? ""), authorId: String(m.author?.id ?? ""), authorIsBot: m.author?.bot === true, at: new Date(m.timestamp) }))
      .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  }
}

// A command counts only if the owner wrote it, in the command channel, and it is not a bot's message.
export function isOwnerCommand(m: DiscordMessage, settings: Settings): boolean {
  return !m.authorIsBot && m.authorId === settings.discord.ownerUserId && m.channelId === settings.discord.commandChannelId;
}

export const footer = `\n${NOT_ADVICE}`;
