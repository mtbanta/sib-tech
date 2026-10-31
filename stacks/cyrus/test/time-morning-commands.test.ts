import { test } from "node:test";
import assert from "node:assert/strict";
import { etDate, etInstant, centralClock } from "../src/time.ts";
import { ensureDay, formatLimitsRequest, parseCommand, decideLimits, NextSessionFinder } from "../src/morning.ts";
import { CommandProcessor } from "../src/commands.ts";
import { MemoryStore, CONTROL_STOP, CONTROL_COMMAND_CURSOR, type StopFlag } from "../src/store.ts";
import { FakeBroker, FakeBot, order, settings } from "./helpers.ts";

const D = "2026-11-02"; // a Monday, after daylight saving ends (winter time)
const OPEN = new Date("2026-11-02T14:30:00Z"); // 9:30 New York = 14:30 UTC in winter

test("market times: summer and winter, and the day change", () => {
  assert.equal(etInstant("2026-10-30", "09:30").toISOString(), "2026-10-30T13:30:00.000Z");
  assert.equal(etInstant("2026-11-02", "09:30").toISOString(), OPEN.toISOString());
  assert.equal(etInstant("2026-11-02", "16:00").toISOString(), "2026-11-02T21:00:00.000Z");
  assert.equal(etInstant("2026-11-27", "13:00").toISOString(), "2026-11-27T18:00:00.000Z"); // half day close
  // 11 PM in New York is already the next day in UTC, but the market date stays
  assert.equal(etDate(new Date("2026-11-03T03:30:00Z")), "2026-11-02");
  assert.equal(etDate(new Date("2026-11-02T04:59:00Z")), "2026-11-01");
  assert.equal(etDate(new Date("2026-11-02T05:00:00Z")), "2026-11-02");
  assert.equal(centralClock(OPEN), "8:30 AM CT");
  assert.equal(centralClock(new Date("2026-10-30T13:30:00Z")), "8:30 AM CT");
});

test("ensureDay builds a trading day from the calendar, using the previous close as the starting equity", async () => {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  broker.account = { ...broker.account, lastEquity: 19900, equity: 19950 };
  const day = await ensureDay({ store, broker }, D);
  assert.equal(day.status, "pending");
  assert.equal(day.openAt?.toISOString(), OPEN.toISOString());
  assert.equal(day.dayStartEquity, 19900);
  assert.equal(day.limits.borrowingCap, 1);
  assert.deepEqual(day.decided, {});
  const again = await ensureDay({ store, broker }, D);
  assert.equal(again.tradeDate, D);
  assert.equal(broker.count("getCalendar"), 1, "a stored day is not rebuilt");
});

test("a weekend is recorded as not a trading day", async () => {
  const day = await ensureDay({ store: new MemoryStore(), broker: new FakeBroker() }, "2026-11-01");
  assert.equal(day.status, "not_trading_day");
  assert.equal(day.isTradingDay, false);
});

test("the request message names every limit and says what silence means", async () => {
  const day = await ensureDay({ store: new MemoryStore(), broker: new FakeBroker() }, D);
  const text = formatLimitsRequest(day);
  for (const w of ["position", "loss", "trades", "cap", "8:30 AM CT", "Monday 2026-11-02", "will not trade that day", "change any of them again until the open", "never an instruction to act"]) assert.ok(text.includes(w), w);
  assert.ok(!text.includes("Good morning"), "an evening request is not a good morning");
  assert.ok(formatLimitsRequest(day, "morning").includes("Good morning"));
});

test("commands are parsed", () => {
  assert.deepEqual(parseCommand("  Stop "), { kind: "stop" });
  assert.deepEqual(parseCommand("/status"), { kind: "status" });
  assert.deepEqual(parseCommand("approve"), { kind: "approve", name: "all" });
  assert.deepEqual(parseCommand("approve cap"), { kind: "approve", name: "cap" });
  assert.deepEqual(parseCommand("position 1500"), { kind: "set", name: "position", value: "1500" });
  assert.equal(parseCommand("approve everything").kind, "unknown");
  assert.equal(parseCommand("loss").kind, "unknown");
  assert.equal(parseCommand("buy AAPL").kind, "unknown");
});

async function setup() {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const bot = new FakeBot();
  let now = new Date("2026-11-02T12:30:00Z"); // 7:30 AM Central, two hours before the open
  const proc = new CommandProcessor({ settings, store, broker, bot, now: () => now, sessions: new NextSessionFinder(broker) });
  const day = await ensureDay({ store, broker }, D);
  await store.updateDay(D, { phases: { request: "2026-11-02T12:00:00.000Z" } });
  await proc.poll(); // first run sets the cursor
  return { store, broker, bot, proc, day, setNow: (d: Date) => (now = d), get now() { return now; } };
}

test("first poll ignores history; later owner messages are handled", async () => {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const bot = new FakeBot();
  bot.say("stop", new Date("2026-11-02T11:00:00Z")); // old, before we started
  const proc = new CommandProcessor({ settings, store, broker, bot, now: () => new Date("2026-11-02T12:30:00Z"), sessions: new NextSessionFinder(broker) });
  assert.equal(await proc.poll(), 0);
  assert.equal(await store.getControl(CONTROL_STOP), null, "history is never acted on");
  bot.say("stop", new Date("2026-11-02T12:31:00Z"));
  assert.equal(await proc.poll(), 1);
  assert.equal((await store.getControl<StopFlag>(CONTROL_STOP))?.on, true);
});

test("only the owner, in the command channel, counts", async () => {
  const s = await setup();
  s.bot.say("stop", s.now, { authorId: "999999999999999999" });
  s.bot.say("stop", s.now, { channelId: "888888888888888888" });
  s.bot.say("stop", s.now, { authorIsBot: true });
  assert.equal(await s.proc.poll(), 0);
  assert.equal(await s.store.getControl(CONTROL_STOP), null);
  assert.equal(s.bot.posts.length, 0, "strangers get no reply");
  const cursor = await s.store.getControl<{ id: string }>(CONTROL_COMMAND_CURSOR);
  assert.equal(cursor?.id, s.bot.messages[2]!.id, "the cursor still moves past them");
});

test("stop sets the flag and cancels only unfilled entries, never a protective stop", async () => {
  const s = await setup();
  s.broker.orders = [
    order({ id: "00000000-0000-0000-0000-00000000000a", symbol: "AAA", side: "buy", filledQty: 0, status: "accepted" }),
    order({ id: "00000000-0000-0000-0000-00000000000b", symbol: "BBB", side: "sell", type: "stop", filledQty: 0, status: "new" }),
    order({ id: "00000000-0000-0000-0000-00000000000c", symbol: "CCC", side: "buy", filledQty: 1, status: "partially_filled" }),
  ];
  s.bot.say("stop", s.now);
  await s.proc.poll();
  const cancelled = s.broker.calls.filter((c) => c.fn === "cancelOrder").map((c) => c.args[0]);
  assert.deepEqual(cancelled, ["00000000-0000-0000-0000-00000000000a"]);
  assert.equal(s.broker.count("closeAllPositions"), 0);
  assert.ok(s.bot.last().includes("Stopped"));
  s.bot.say("resume", s.now);
  await s.proc.poll();
  assert.equal((await s.store.getControl<StopFlag>(CONTROL_STOP))?.on, false);
});

test("flatten sets the stop flag and sells everything", async () => {
  const s = await setup();
  s.bot.say("flatten", s.now);
  await s.proc.poll();
  assert.equal((await s.store.getControl<StopFlag>(CONTROL_STOP))?.on, true);
  assert.equal(s.broker.count("closeAllPositions"), 1);
});

test("approve, with an overrule, before the open: approved only when all four are decided", async () => {
  const s = await setup();
  s.bot.say("approve position", s.now);
  s.bot.say("loss 150", s.now);
  s.bot.say("trades 5", s.now);
  await s.proc.poll();
  let day = (await s.store.getDay(D))!;
  assert.equal(day.status, "pending", "three of four decided is not enough");
  assert.equal(day.limits.dailyLossStopUsd, 150);
  assert.equal(day.limits.maxTradesPerDay, 5);
  s.bot.say("approve cap", s.now);
  await s.proc.poll();
  day = (await s.store.getDay(D))!;
  assert.equal(day.status, "approved");
  assert.ok(s.bot.last().includes("All four limits decided"));
  assert.equal(s.broker.count("setAccountConfig"), 0, "approving never touches Alpaca; the cap is set when the day is armed");
});

test("overruling the cap records it but leaves Alpaca at 1 until the day is armed", async () => {
  const s = await setup();
  s.broker.failOn.add("setAccountConfig"); // would break the old behavior; now irrelevant
  s.bot.say("cap 2", s.now);
  await s.proc.poll();
  const day = (await s.store.getDay(D))!;
  assert.equal(day.decided.cap, true);
  assert.equal(day.limits.borrowingCap, 2);
  assert.equal(s.broker.config.maxMarginMultiplier, 1, "still 1 at Alpaca");
  assert.equal(s.broker.count("setAccountConfig"), 0);
});

test("a change after the day is already approved applies and the day stays approved", async () => {
  const s = await setup();
  s.bot.say("approve", s.now);
  await s.proc.poll();
  assert.equal((await s.store.getDay(D))!.status, "approved");
  s.setNow(new Date("2026-11-02T13:00:00Z")); // 8:00 AM Central, before the open
  s.bot.say("position 1500", s.now);
  await s.proc.poll();
  const day = (await s.store.getDay(D))!;
  assert.equal(day.status, "approved");
  assert.equal(day.limits.maxPositionUsd, 1500);
});

test("a bad value is refused and nothing changes", async () => {
  const s = await setup();
  s.bot.say("cap 3", s.now);
  s.bot.say("position 99999999", s.now);
  await s.proc.poll();
  const day = (await s.store.getDay(D))!;
  assert.deepEqual(day.decided, {});
  assert.equal(day.limits.borrowingCap, 1);
});

test("after the open, that day's limits are fixed: the pure decision refuses, and the command moves on to the next day", async () => {
  const s = await setup();
  const day = (await s.store.getDay(D))!;
  const r = decideLimits(day, { kind: "approve", name: "all" }, 20000, new Date("2026-11-02T14:31:00Z"), new Date("2026-11-02T14:31:00Z"));
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.reply.includes("already opened"));
  // With the market open, an approval is about the NEXT trading day, which has no request yet: nothing changes.
  s.broker.calendar = [...s.broker.calendar, { date: "2026-11-03", open: "09:30", close: "16:00" }];
  s.setNow(new Date("2026-11-02T14:31:00Z"));
  s.bot.say("approve", s.now);
  await s.proc.poll();
  assert.equal((await s.store.getDay(D))!.status, "pending", "today is untouched");
  assert.ok(s.bot.last().includes("Tuesday 2026-11-03") && s.bot.last().includes("no limits request"));
});

test("text that comes through empty gets an honest message, not 'did not understand'", async () => {
  const s = await setup();
  s.bot.say("   ", s.now);
  s.bot.say("", s.now);
  await s.proc.poll();
  assert.ok(s.bot.last().includes("Message Content Intent"));
  assert.ok(!s.bot.posts.some((p) => p.text.includes("did not understand")));
});

test("a lapsed day cannot be approved late", async () => {
  const s = await setup();
  await s.store.updateDay(D, { status: "lapsed" });
  s.bot.say("approve", s.now);
  await s.proc.poll();
  assert.equal((await s.store.getDay(D))!.status, "lapsed");
});

test("an approval written before the request was posted is ignored", async () => {
  const s = await setup();
  s.bot.say("approve", new Date("2026-11-01T20:00:00Z")); // yesterday evening
  await s.proc.poll();
  assert.equal((await s.store.getDay(D))!.status, "pending");
  assert.ok(s.bot.last().includes("older"));
});

test("the pure decision refuses on a non-trading day", () => {
  const day = { tradeDate: D, isTradingDay: false, openAt: null, closeAt: null, status: "not_trading_day", dayStartEquity: 1, suggested: settingsLimits(), limits: settingsLimits(), decided: {}, liveList: null, phases: {} } as any;
  const r = decideLimits(day, { kind: "approve", name: "all" }, 20000, OPEN, OPEN);
  assert.equal(r.ok, false);
});
function settingsLimits() {
  return { maxPositionUsd: 1000, dailyLossStopUsd: 200, maxTradesPerDay: 10, borrowingCap: 1 };
}

test("status reports the stop flag, limits and positions, and never a secret", async () => {
  const s = await setup();
  s.bot.say("status", s.now);
  await s.proc.poll();
  const t = s.bot.last();
  for (const w of ["Stop flag: off", "pending", "Equity", "never an instruction to act"]) assert.ok(t.includes(w), w);
});

test("a store failure while handling a command is reported, not swallowed", async () => {
  const s = await setup();
  s.bot.say("stop", s.now);
  s.store.failing = true;
  await assert.rejects(s.proc.poll(), "the cursor cannot be read, so polling fails loudly");
});

test("a stop that cannot be saved says so loudly", async () => {
  const s = await setup();
  s.bot.say("stop", s.now);
  const realSet = s.store.setControl.bind(s.store);
  s.store.setControl = async (k: string, v: unknown) => {
    if (k === CONTROL_STOP) throw new Error("db down (test)");
    return realSet(k, v);
  };
  await s.proc.poll();
  assert.ok(s.bot.last().includes("STOP DID NOT COMPLETE"));
});

import { postLimitsRequest, postReminderIfNeeded, lapseIfUndecided } from "../src/morning.ts";

test("the request is posted once; the reminder once; an undecided day lapses at the open", async () => {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const bot = new FakeBot();
  let now = new Date("2026-11-02T12:00:00Z");
  const steps = { store, broker, say: (c: any, t: string) => bot.post(c, t), now: () => now, feed: "iex" };
  let day = await ensureDay(steps, D);
  day = await postLimitsRequest(steps, day);
  day = await postLimitsRequest(steps, day);
  assert.equal(bot.posts.length, 1, "a restart does not repeat the request");
  assert.ok(day.phases.request);
  now = new Date("2026-11-02T14:15:00Z"); // 15 minutes before the open: too early for the reminder
  day = await postReminderIfNeeded(steps, day);
  assert.equal(bot.posts.length, 1);
  now = new Date("2026-11-02T14:21:00Z");
  day = await postReminderIfNeeded(steps, day);
  day = await postReminderIfNeeded(steps, day);
  assert.equal(bot.posts.length, 2);
  assert.ok(bot.last().includes("Reminder"));
  day = await lapseIfUndecided(steps, day);
  assert.equal(day.status, "pending", "not yet open");
  now = new Date("2026-11-02T14:30:00Z");
  day = await lapseIfUndecided(steps, day);
  assert.equal(day.status, "lapsed");
  assert.ok(bot.last().includes("will not trade today") && bot.last().includes("8:30 AM CT"));
  assert.ok(!bot.last().includes("The market is open"));
});

test("an approved day does not lapse", async () => {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const bot = new FakeBot();
  const steps = { store, broker, say: (c: any, t: string) => bot.post(c, t), now: () => new Date("2026-11-02T15:00:00Z"), feed: "iex" };
  await ensureDay(steps, D);
  const day = await store.updateDay(D, { status: "approved" });
  assert.equal((await lapseIfUndecided(steps, day)).status, "approved");
});

test("if cancelling fails after the flag is saved, the message says that, not that the flag failed", async () => {
  const s = await setup();
  s.broker.orders = [order({ id: "00000000-0000-0000-0000-00000000000a", side: "buy", filledQty: 0, status: "accepted" })];
  s.broker.failOn.add("cancelOrder");
  s.bot.say("stop", s.now);
  await s.proc.poll();
  assert.equal(((await s.store.getControl(CONTROL_STOP)) as StopFlag).on, true);
  assert.ok(s.bot.last().includes("cancelling unfilled entries failed"));
  assert.ok(!s.bot.last().includes("STOP DID NOT COMPLETE"));
});

test("flatten still tries to sell when the flag cannot be saved", async () => {
  const s = await setup();
  s.bot.say("flatten", s.now);
  const realSet = s.store.setControl.bind(s.store);
  s.store.setControl = async (k: string, v: unknown) => { if (k === CONTROL_STOP) throw new Error("db down (test)"); return realSet(k, v); };
  await s.proc.poll();
  assert.equal(s.broker.count("closeAllPositions"), 1);
  assert.ok(s.bot.last().includes("could not be saved"));
});

test("an approval that loses a race with the lapse does not undo the lapse", async () => {
  const s = await setup();
  // The day lapses while the approval is talking to Alpaca.
  const realGet = s.broker.getAccount.bind(s.broker);
  s.broker.getAccount = async () => { await s.store.updateDay(D, { status: "lapsed" }); return realGet(); };
  s.bot.say("cap 1", s.now);
  await s.proc.poll();
  assert.equal((await s.store.getDay(D))!.status, "lapsed");
  assert.ok(s.bot.last().includes("Too late"));
});

test("a reminder whose post failed is tried again", async () => {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  let ok = false;
  const steps = { store, broker, say: async () => ok, now: () => new Date("2026-11-02T14:21:00Z"), feed: "iex" };
  let day = await ensureDay(steps, D);
  day = await store.updateDay(D, { phases: { request: "x" } });
  day = await postReminderIfNeeded(steps, day);
  assert.equal(day.phases.reminder, undefined);
  ok = true;
  day = await postReminderIfNeeded(steps, day);
  assert.ok(day.phases.reminder);
});
