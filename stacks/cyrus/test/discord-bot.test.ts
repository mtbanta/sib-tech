import { test } from "node:test";
import assert from "node:assert/strict";
import { DiscordBot, isOwnerCommand } from "../src/discord-bot.ts";
import { makeRedactor } from "../src/redact.ts";
import { settings, OWNER, COMMANDS } from "./helpers.ts";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

function bot(replies: Array<Response | Error>) {
  const calls: Array<{ url: string; method: string; body: any; auth: string }> = [];
  const impl = (async (url: any, init: any) => {
    calls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : null, auth: init.headers.Authorization });
    const r = replies.shift();
    if (!r) throw new Error("no reply queued");
    if (r instanceof Error) throw r;
    return r;
  }) as typeof fetch;
  return { calls, bot: new DiscordBot(settings, makeRedactor([settings.discord.botToken]), impl) };
}
const channels = [{ id: COMMANDS, name: "commands", type: 0 }, { id: "400000000000000001", name: "trading", type: 0 }, { id: "400000000000000002", name: "alerts", type: 0 }];

test("start finds the channels and checks the command channel belongs to the server", async () => {
  const ok = bot([json(channels)]);
  await ok.bot.start();
  assert.ok(ok.calls[0]!.url.includes(`/guilds/${settings.discord.guildId}/channels`));
  assert.ok(ok.calls[0]!.auth.startsWith("Bot "));
  const wrong = bot([json([{ id: "500000000000000009", name: "commands", type: 0 }, ...channels.slice(1)])]);
  await assert.rejects(wrong.bot.start(), /command channel/);
});

test("posts go to the right channel, redacted, with mentions off, cut to 2000 characters", async () => {
  const b = bot([json(channels), json({}), json({})]);
  await b.bot.start();
  assert.equal(await b.bot.post("trading", `hello @everyone ${settings.discord.botToken} ` + "x".repeat(3000)), true);
  const call = b.calls[1]!;
  assert.ok(call.url.endsWith("/channels/400000000000000001/messages"));
  assert.deepEqual(call.body.allowed_mentions, { parse: [] });
  assert.ok(call.body.content.length <= 2000);
  assert.ok(!call.body.content.includes(settings.discord.botToken));
  assert.equal((await (async () => { const f = bot([json(channels), new Error("down")]); await f.bot.start(); return f.bot.post("trading", "x"); })()), false, "a failed post returns false instead of throwing");
});

test("messages come back oldest first with their author and time", async () => {
  const b = bot([json([{ id: "300000000000000002", channel_id: COMMANDS, content: "b", author: { id: OWNER }, timestamp: "2026-11-02T12:00:02Z" }, { id: "300000000000000001", channel_id: COMMANDS, content: "a", author: { id: OWNER, bot: false }, timestamp: "2026-11-02T12:00:01Z" }])]);
  const msgs = await b.bot.commandMessagesAfter("300000000000000000");
  assert.deepEqual(msgs.map((m) => m.content), ["a", "b"]);
  assert.equal(msgs[0]!.at.toISOString(), "2026-11-02T12:00:01.000Z");
});

test("a rate limit answer is waited out once", async () => {
  const b = bot([new Response(JSON.stringify({ retry_after: 0.01 }), { status: 429 }), json([])]);
  assert.deepEqual(await b.bot.commandMessagesAfter("1"), []);
});

test("only the owner's non-bot message in the command channel is a command", () => {
  const m = { id: "1", channelId: COMMANDS, content: "stop", authorId: OWNER, authorIsBot: false, at: new Date() };
  assert.equal(isOwnerCommand(m, settings), true);
  assert.equal(isOwnerCommand({ ...m, authorId: "1" }, settings), false);
  assert.equal(isOwnerCommand({ ...m, channelId: "1" }, settings), false);
  assert.equal(isOwnerCommand({ ...m, authorIsBot: true }, settings), false);
});
