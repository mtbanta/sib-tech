// The load mode review's fixes (Michael's decisions of 2026-11-03, after that review). Each test was checked to fail with its
// change taken out (recorded in builds/build-c2-log.md).
//   1. A post over Discord's 2,000 character limit is sent as consecutive messages, never cut; the last ends with
//      "Paper trading only." and any no-trade warning. The redundant `load on` instruction line is gone from the request.
//   2. If load mode was on that morning, the 75 dollar cap stays all day, whenever `load off` comes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTINUED, NOT_ADVICE, PAPER_ONLY, splitMessage } from "../src/discord.ts";
import { DiscordBot } from "../src/discord-bot.ts";
import { makeRedactor } from "../src/redact.ts";
import { CONTROL_STOP, MemoryStore, type StopFlag } from "../src/store.ts";
import { FakeBroker, settings } from "./helpers.ts";
import { FAKE_WEBHOOK } from "./fakes.ts";
import { D, rig, settle, z } from "./rig.ts";

const WARNING = "**If any limit is still undecided at the open, I will not trade that day.**";
const RESTART_REASON = "daily loss stop reached earlier today (equity fell to 19500.00, found after a restart)";
const symbols = (n: number) => Array.from({ length: n }, (_, i) => `SY${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`);

// ---------- 1. long posts ----------
test("splitMessage: a long text becomes consecutive messages, each within the limit and carrying the paper-only line, nothing lost", () => {
  const text = Array.from({ length: 120 }, (_, i) => `line ${i}: ${"x".repeat(30)}`).join("\n") + `\n${WARNING}\n${NOT_ADVICE}`;
  const parts = splitMessage(text);
  assert.ok(parts.length >= 3, `${parts.length} parts`);
  for (const p of parts) assert.ok(p.length <= 2000 && p.includes(PAPER_ONLY), `${p.length}`);
  for (const p of parts.slice(0, -1)) assert.ok(p.endsWith(`${CONTINUED}\n${PAPER_ONLY}`));
  assert.ok(parts.at(-1)!.endsWith(`${WARNING}\n${NOT_ADVICE}`), "the last part ends as the text did");
  const rebuilt = parts.map((p, i) => (i < parts.length - 1 ? p.slice(0, -(`\n${CONTINUED}\n${PAPER_ONLY}`.length)) : p)).join("\n");
  assert.equal(rebuilt, text, "nothing lost");
  assert.deepEqual(splitMessage("short"), ["short\nPaper trading only."], "a short text is sent as before");
  const oneLine = splitMessage("y".repeat(4500));
  assert.ok(oneLine.every((p) => p.length <= 2000) && oneLine.at(-1)!.endsWith(PAPER_ONLY));
  assert.equal(oneLine.map((p) => p.replace(`\n${CONTINUED}\n${PAPER_ONLY}`, "").replace(`\n${PAPER_ONLY}`, "")).join(""), "y".repeat(4500));
});

test("the bot sends every part of a long post, in order, mentioning the owner only in the first", async () => {
  const bodies: Array<{ content: string; allowed_mentions: unknown }> = [];
  const impl = (async (url: string, init?: RequestInit) => {
    if (String(url).endsWith(`/guilds/${settings.discord.guildId}/channels`)) {
      return new Response(JSON.stringify([{ id: settings.discord.commandChannelId, name: "commands", type: 0 }, { id: "222222222222222222", name: "trading", type: 0 }, { id: "333333333333333333", name: "alerts", type: 0 }]), { status: 200 });
    }
    bodies.push(JSON.parse(String(init!.body)));
    return new Response(JSON.stringify({ id: "1" }), { status: 200 });
  }) as typeof fetch;
  const bot = new DiscordBot(settings, makeRedactor([settings.discord.botToken]), impl);
  await bot.start();
  const text = Array.from({ length: 100 }, (_, i) => `row ${i} ${"z".repeat(40)}`).join("\n") + `\n${WARNING}`;
  assert.equal(await bot.post("alerts", text, { mentionOwner: true }), true);
  assert.ok(bodies.length >= 3, `${bodies.length} messages`);
  assert.ok(bodies[0]!.content.startsWith(`<@${settings.discord.ownerUserId}>`));
  assert.deepEqual(bodies.slice(1).map((b) => b.allowed_mentions), bodies.slice(1).map(() => ({ parse: [] })));
  assert.ok(bodies.at(-1)!.content.endsWith(`${WARNING}\n${PAPER_ONLY}`));
});

// The evening request on a normal day with the stop flag on (the longest reason) and positions held.
async function eveningRequest(held: number): Promise<string[]> {
  const r = rig<FakeBroker, MemoryStore>();
  await r.store.setControl(CONTROL_STOP, { on: true, at: "2026-11-01T20:00:00.000Z", reason: RESTART_REASON } satisfies StopFlag);
  r.broker.positions = symbols(held).map((symbol) => ({ symbol, qty: 1, marketValue: 10, avgEntryPrice: 10, unrealizedPl: 0 }));
  await r.at("2026-11-01T22:10:00Z");
  const posts = r.said("commands");
  const start = posts.findIndex((t) => t.startsWith("**Suggested limits"));
  assert.ok(start >= 0, "the request was posted");
  const end = posts.findIndex((t, i) => i >= start && t.includes("never an instruction to act"));
  return posts.slice(start, end + 1);
}

test("a long normal-day request (stop flag on, 10 positions held) arrives complete, ending with the warning and the paper-only line", async () => {
  const parts = await eveningRequest(10);
  const last = parts.at(-1)!;
  assert.ok(last.endsWith(`${WARNING}\n${NOT_ADVICE}`), last.slice(-200));
  const all = parts.join("\n");
  for (const w of [RESTART_REASON, symbols(10).join(", "), "5. mode: normal", WARNING]) assert.ok(all.includes(w), w);
  assert.ok(!all.includes("(cut short)"));
  assert.ok(!all.includes("is accepted until the morning screen"), "the redundant instruction line is gone");
});

test("a request too long for one message (40 positions held) arrives as consecutive messages, nothing lost", async () => {
  const parts = await eveningRequest(40);
  assert.ok(parts.length >= 2, `${parts.length} parts`);
  assert.ok(parts.every((p) => p.length <= 2000));
  assert.ok(parts.at(-1)!.endsWith(`${WARNING}\n${NOT_ADVICE}`));
  assert.ok(parts.join("\n").includes(symbols(40).join(", ")), "every symbol arrived");
});

// ---------- 2. the cap stays after `load off` ----------
const RAMP = [...Array(12).fill(50), 50.4];
async function loadDay() {
  const r = rig<FakeBroker, MemoryStore>({ liveList: ["BBB", "CCC", "DDD"] });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("position 500\napprove\nload on", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("13:45:00"); // the morning screen: the cheap list
  return r;
}
const lastEntry = (r: { broker: FakeBroker }) => r.broker.calls.filter((c) => c.fn === "submitEntry").at(-1)?.args[0] as { qty: number } | undefined;

test("load mode on that morning: load off after the screen (before Armed) still keeps the 75 dollar cap all day", async () => {
  const r = await loadDay();
  r.ownerSays("load off", "13:50:00");
  await r.at("13:50:10");
  assert.equal((await r.store.getDay(D))!.phases.load, "ended", "the window ends, the load day does not");
  assert.ok(r.said("commands").some((t) => t.includes("Load mode was on this morning")));
  await r.at("14:25:00");
  await r.at("14:40:00");
  await r.ramp("BBB", RAMP, "14:40:01");
  await settle();
  assert.equal(lastEntry(r)?.qty, 1, "75 dollars at 50.40 is 1 share, not the 9 that 500 would allow");
});

test("load off after Armed also keeps the 75 dollar cap (checked on an entry, not only the switch)", async () => {
  const r = await loadDay();
  await r.at("14:25:00");
  r.ownerSays("load off", "14:26:00");
  await r.at("14:26:10");
  await r.at("14:40:00");
  await r.ramp("BBB", RAMP, "14:40:01");
  await settle();
  assert.equal(lastEntry(r)?.qty, 1);
});

test("load off before the morning screen gives a normal day (normal list, normal size)", async () => {
  const r = rig<FakeBroker, MemoryStore>();
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve\nload on", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.ownerSays("load off", "2026-11-02T12:00:00Z");
  await r.at("12:00:10");
  assert.equal((await r.store.getDay(D))!.phases.load, "off");
  void z;
});

test("the alerts webhook also sends a long post as consecutive messages", async () => {
  const sent: string[] = [];
  const impl = (async (_url: string, init?: RequestInit) => (sent.push(JSON.parse(String(init!.body)).content), new Response(null, { status: 204 }))) as typeof fetch;
  const { postWebhook } = await import("../src/discord.ts");
  const text = Array.from({ length: 100 }, (_, i) => `alert row ${i} ${"w".repeat(40)}`).join("\n");
  const res = await postWebhook(FAKE_WEBHOOK, text, (s) => s, impl);
  assert.equal(res.ok, true);
  assert.ok(sent.length >= 3 && sent.every((c) => c.length <= 2000));
  assert.ok(sent.at(-1)!.endsWith("alert row 99 " + "w".repeat(40) + `\n${PAPER_ONLY}`));
});

test("a long text that says 'Paper trading only.' near its start still ends its last part with it", () => {
  const text = `${PAPER_ONLY} header\n` + Array.from({ length: 100 }, (_, i) => `entry ${i} ${"v".repeat(40)}`).join("\n");
  const parts = splitMessage(text);
  assert.ok(parts.length >= 2);
  assert.ok(parts.at(-1)!.endsWith(`\n${PAPER_ONLY}`), parts.at(-1)!.slice(-80));
});
