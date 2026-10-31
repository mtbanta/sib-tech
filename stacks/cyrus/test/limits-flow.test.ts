// The limits flow (evening request for the next trading day), market hours and time zones, arming, and the
// close-out rules added after the round 2 review. Dates are real 2026 dates: 2026-10-30 is a Friday, 2026-11-02
// a Monday (winter time began on 2026-11-01), and Thanksgiving is Thursday 2026-11-26 with a half day on Friday.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dayWord, etInstant, sessionPhase } from "../src/time.ts";
import { NextSessionFinder, ensureDay } from "../src/morning.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP, MemoryStore, type NotFlatState, type StopFlag } from "../src/store.ts";
import { enforceDailyLoss, sweepEntriesWhileStopped } from "../src/risk.ts";
import { OrderGate } from "../src/gate.ts";
import { recordStart, releaseLabel } from "../src/start-note.ts";
import { FakeBroker, FakeBot, order } from "./helpers.ts";
import { D, rig, settle } from "./rig.ts";
import type { Position } from "../src/alpaca-trading.ts";

const full = (date: string) => ({ date, open: "09:30", close: "16:00" });
const CALENDAR = [full("2026-10-29"), full("2026-10-30"), full("2026-11-02"), full("2026-11-03")];
const HOLD: Position[] = [{ symbol: "AAA", qty: 5, marketValue: 500, avgEntryPrice: 100, unrealizedPl: 0 }];

function brokerWith(calendar = CALENDAR, isOpen = false) {
  const b = new FakeBroker();
  b.calendar = calendar;
  b.clock = { isOpen, timestamp: "", nextOpen: "", nextClose: "" };
  return b;
}

// ---- market hours and time zones ----

test("sessionPhase: before the open, at the open, during, at the close, after, weekend and holiday", () => {
  const fri = { isTradingDay: true, openAt: etInstant("2026-10-30", "09:30"), closeAt: etInstant("2026-10-30", "16:00") };
  const at = (iso: string) => sessionPhase(fri, new Date(iso));
  assert.equal(at("2026-10-30T13:29:59Z"), "before_open");
  assert.equal(at("2026-10-30T13:30:00Z"), "open", "the open itself is open");
  assert.equal(at("2026-10-30T19:59:59Z"), "open");
  assert.equal(at("2026-10-30T20:00:00Z"), "after_close", "the close itself is closed");
  // Friday 2026-10-30, 4:32 PM Central (daylight time) is 21:32 UTC: the exact moment of the original bug
  assert.equal(at("2026-10-30T21:32:58Z"), "after_close");
  assert.equal(sessionPhase(null, new Date()), "no_session", "a weekend or holiday has no record");
  assert.equal(sessionPhase({ isTradingDay: false, openAt: null, closeAt: null }, new Date()), "no_session");
});

test("sessionPhase on the daylight saving weekend and on a half day", () => {
  // Monday 2026-11-02 is winter time: 8:30 AM Central is 14:30 UTC, and 3:00 PM Central is 21:00 UTC
  const mon = { isTradingDay: true, openAt: etInstant("2026-11-02", "09:30"), closeAt: etInstant("2026-11-02", "16:00") };
  assert.equal(sessionPhase(mon, new Date("2026-11-02T14:29:00Z")), "before_open");
  assert.equal(sessionPhase(mon, new Date("2026-11-02T14:30:00Z")), "open");
  assert.equal(sessionPhase(mon, new Date("2026-11-02T21:00:00Z")), "after_close");
  // the half day after Thanksgiving closes at 1:00 PM Eastern
  const half = { isTradingDay: true, openAt: etInstant("2026-11-27", "09:30"), closeAt: etInstant("2026-11-27", "13:00") };
  assert.equal(sessionPhase(half, new Date("2026-11-27T17:59:00Z")), "open");
  assert.equal(sessionPhase(half, new Date("2026-11-27T18:00:00Z")), "after_close");
});

test("dayWord names the weekday of a market date", () => {
  assert.equal(dayWord("2026-11-02"), "Monday 2026-11-02");
  assert.equal(dayWord("2026-10-30"), "Friday 2026-10-30");
  assert.equal(dayWord("2026-11-27"), "Friday 2026-11-27");
});

test("the next session comes from the calendar: Friday evening and the weekend give Monday", async () => {
  const f = new NextSessionFinder(brokerWith());
  for (const iso of ["2026-10-30T21:00:00Z", "2026-10-31T05:00:00Z", "2026-10-31T17:00:00Z", "2026-11-01T23:00:00Z"]) {
    assert.equal((await f.next(new Date(iso)))?.date, "2026-11-02", iso);
  }
});

test("the next session skips Thanksgiving and finds the half day; during a session it is the following day", async () => {
  const cal = [full("2026-11-24"), full("2026-11-25"), { date: "2026-11-27", open: "09:30", close: "13:00" }, full("2026-11-30")];
  const f = new NextSessionFinder(brokerWith(cal));
  const tuesdayNight = await f.next(new Date("2026-11-25T02:00:00Z")); // Tuesday 8 PM Central, Wednesday is next
  assert.equal(tuesdayNight?.date, "2026-11-25");
  const afterWednesday = await new NextSessionFinder(brokerWith(cal)).next(new Date("2026-11-26T04:00:00Z")); // Wednesday 10 PM ET
  assert.equal(afterWednesday?.date, "2026-11-27", "Thursday is a holiday");
  assert.equal(afterWednesday?.closeAt.toISOString(), "2026-11-27T18:00:00.000Z", "half day close");
  const during = await new NextSessionFinder(brokerWith(cal)).next(new Date("2026-11-24T16:00:00Z")); // Tuesday midday
  assert.equal(during?.date, "2026-11-25", "while Tuesday is open, the next session is Wednesday");
});

test("with no session in the next two weeks there is no next session, and a late-night Central time still uses the New York date", async () => {
  assert.equal(await new NextSessionFinder(brokerWith([])).next(new Date("2026-11-02T12:00:00Z")), null);
  // 11:30 PM Central on Monday is already Tuesday in UTC and Tuesday 12:30 AM in New York; Tuesday's open is still ahead
  assert.equal((await new NextSessionFinder(brokerWith()).next(new Date("2026-11-03T05:30:00Z")))?.date, "2026-11-03");
});

test("a day first seen after its close is created lapsed and quiet; a day first seen during the session is pending", async () => {
  const store = new MemoryStore();
  const broker = brokerWith();
  const after = await ensureDay({ store, broker, now: () => new Date("2026-10-30T21:32:58Z") }, "2026-10-30");
  assert.equal(after.status, "lapsed");
  assert.ok(after.phases.closeout && after.phases.summary);
  const during = await ensureDay({ store, broker, now: () => new Date("2026-11-02T16:00:00Z") }, "2026-11-02");
  assert.equal(during.status, "pending");
});

test("the original bug: a deploy at 4:32 PM Central on a Friday says nothing about the market being open", async () => {
  const bot = new FakeBot();
  const r = rig({ broker: brokerWith(), bot });
  await r.at("2026-10-30T21:32:58Z");
  await r.at("2026-10-30T21:33:03Z");
  assert.ok(!bot.posts.some((p) => /market is open/i.test(p.text) || p.text.includes("will not trade today")), "no false open or lapse message");
  assert.equal(r.said("commands").filter((t) => t.includes("Suggested limits for Monday 2026-11-02")).length, 1, "Monday's request goes out once");
  assert.equal(r.said("trading").length, 0, "no close-out or summary for a day that was over before we looked");
  assert.equal(r.broker.count("closeAllPositions"), 0);
  assert.equal((await r.store.getDay("2026-10-30"))!.status, "lapsed");
});

test("status after hours says the session ended, flags a disagreeing broker clock, and never says 'open' by itself", async () => {
  const r = rig({ broker: brokerWith() });
  await r.at("2026-10-30T21:32:58Z");
  r.ownerSays("status", "2026-10-30T21:40:00Z");
  await r.at("2026-10-30T21:40:10Z");
  const closed = r.said("commands").at(-1)!;
  assert.ok(closed.includes("closed by Alpaca's clock") && closed.includes("session ended") && closed.includes("Next session: Monday 2026-11-02"), closed);
  assert.ok(!closed.includes("disagree"));
  r.broker.clock = { ...r.broker.clock, isOpen: true };
  r.ownerSays("status", "2026-10-30T21:41:00Z");
  await r.at("2026-10-30T21:41:10Z");
  assert.ok(r.said("commands").at(-1)!.includes("disagree"));
});

// ---- the evening request ----

test("the request for the next trading day goes out once at every quiet hour: Friday night, Saturday, Sunday", async () => {
  const broker = brokerWith();
  const store = new MemoryStore();
  const bot = new FakeBot();
  for (const iso of ["2026-10-31T02:00:00Z", "2026-10-31T17:00:00Z", "2026-11-02T03:00:00Z"]) {
    // a fresh worker each time (a restart), the same store: still exactly one request
    const r = rig({ broker, store, bot });
    await r.at(iso);
    await r.at(iso.replace(":00Z", ":10Z"));
  }
  assert.equal(bot.posts.filter((p) => p.text.includes("Suggested limits for Monday 2026-11-02")).length, 1);
  assert.ok(bot.posts[0]!.text.includes("Checklist") && bot.posts[0]!.text.includes("Stop flag: off") && bot.posts[0]!.text.includes("Account: flat") && bot.posts[0]!.text.includes("Price feed: iex"));
});

test("during a session the next request waits until 10 minutes after the close (after the summary)", async () => {
  const r = rig({ broker: brokerWith() });
  r.broker.clock = { ...r.broker.clock, isOpen: true };
  await r.at("2026-11-02T16:00:00Z"); // Monday midday
  assert.ok(!r.said("commands").some((t) => t.includes("Tuesday")), "nothing about Tuesday during the session");
  await r.at("2026-11-02T21:09:00Z");
  assert.ok(!r.said("commands").some((t) => t.includes("Tuesday")), "not yet");
  await r.at("2026-11-02T21:10:00Z");
  assert.equal(r.said("commands").filter((t) => t.includes("Suggested limits for Tuesday 2026-11-03")).length, 1);
});

test("an approval after the close applies to the next trading day, not to the day that just ended", async () => {
  const r = rig({ broker: brokerWith() });
  await r.at("2026-10-30T21:32:58Z");
  r.ownerSays("approve", "2026-10-30T21:40:00Z");
  await r.at("2026-10-30T21:40:10Z");
  assert.equal((await r.store.getDay("2026-11-02"))!.status, "approved");
  assert.equal((await r.store.getDay("2026-10-30"))!.status, "lapsed");
});

test("a change after approval applies before the open and is refused at the open", async () => {
  const r = rig({ broker: brokerWith() });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  r.ownerSays("position 1500", "2026-11-01T22:30:00Z");
  await r.at("2026-11-01T22:30:10Z");
  const day = (await r.store.getDay(D))!;
  assert.equal(day.status, "approved");
  assert.equal(day.limits.maxPositionUsd, 1500);
  r.ownerSays("position 900", "14:30:05"); // the open
  await r.at("14:30:10");
  assert.equal((await r.store.getDay(D))!.limits.maxPositionUsd, 1500, "fixed at the open");
});

test("nothing approved before the open means no trading that day, and the checklist warns about a stop flag", async () => {
  const store = new MemoryStore();
  await store.setControl(CONTROL_STOP, { on: true, at: "x", reason: "owner command (stop)" } satisfies StopFlag);
  const r = rig({ broker: brokerWith(), store });
  await r.at("2026-11-01T22:10:00Z");
  assert.ok(r.said("commands")[0]!.includes("Stop flag is ON"));
  await r.at("14:30:00");
  assert.equal((await r.store.getDay(D))!.status, "lapsed");
});

// ---- arming ----

test("arming sets the approved cap and long only at Alpaca at open - 5 minutes, and reads the day's start equity", async () => {
  const broker = brokerWith();
  broker.account = { ...broker.account, lastEquity: 19950, equity: 19990 };
  const r = rig({ broker });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2", "2026-11-01T22:20:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:10Z");
  await r.at("2026-11-01T22:20:20Z");
  assert.equal(broker.config.maxMarginMultiplier, 1, "overnight the account stays at 1");
  await r.at("14:24:00");
  assert.equal(broker.config.maxMarginMultiplier, 1);
  await r.at("14:25:00");
  assert.equal(broker.config.maxMarginMultiplier, 2);
  assert.equal(broker.config.noShorting, true);
  assert.equal((await r.store.getDay(D))!.dayStartEquity, 19950);
});

test("if arming fails the day does not trade, Michael is told, and it works once Alpaca does", async () => {
  const broker = brokerWith();
  broker.clock = { ...broker.clock, isOpen: true };
  const r = rig({ broker });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("13:45:00"); // screen: live list AAA, BBB
  broker.failOn.add("setAccountConfig");
  await r.at("14:25:00");
  assert.equal((await r.store.getDay(D))!.phases.armed, undefined);
  assert.ok(r.said("alerts").some((t) => t.includes("Could not arm")));
  await r.trade("AAA", 100, "14:31:00");
  await r.trade("AAA", 102, "14:36:00"); // a breakout
  assert.equal(broker.count("submitEntry"), 0, "no entry while unarmed");
  assert.ok((await r.store.listRefusals(D)).some((x) => x.reason.includes("not armed")));
  broker.failOn.clear();
  await r.at("14:37:00");
  assert.ok((await r.store.getDay(D))!.phases.armed, "armed once Alpaca answers");
});

test("arming fails if Alpaca does not keep the cap", async () => {
  const broker = brokerWith();
  const r = rig({ broker });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2", "2026-11-01T22:20:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:10Z");
  await r.at("2026-11-01T22:20:20Z");
  broker.setAccountConfig = async () => broker.config; // ignores the request: still cap 1
  await r.at("14:25:00");
  assert.equal((await r.store.getDay(D))!.phases.armed, undefined);
});

// ---- the gate ----

async function gateRig(patch: Partial<{ armed: boolean; notFlat: boolean; stop: boolean }> = {}) {
  const store = new MemoryStore();
  const broker = brokerWith(CALENDAR, true);
  const said: Array<{ ch: string; text: string }> = [];
  const now = new Date("2026-11-02T15:30:00Z");
  const deps = { broker, store, now: () => now, say: (async (ch: string, text: string) => (said.push({ ch, text }), true)) as any };
  await ensureDay(deps, D);
  await store.updateDay(D, { status: "approved", decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "x", ...(patch.armed === false ? {} : { armed: "x" }) } });
  if (patch.notFlat) await store.setControl(CONTROL_NOT_FLAT, { on: true, since: "x", remaining: ["AAA"] } satisfies NotFlatState);
  if (patch.stop) await store.setControl(CONTROL_STOP, { on: true, at: "x", reason: "owner command (stop)" } satisfies StopFlag);
  const signal = { symbol: "AAA", price: 50, tradeTime: new Date(now.getTime() - 5000), stopPrice: 49.25 };
  return { gate: new OrderGate(deps), broker, store, said, signal };
}

test("the gate refuses an approved day that is not armed, and a carried not-flat account, with their own reasons", async () => {
  const a = await gateRig({ armed: false });
  assert.match((await a.gate.enter(a.signal) as any).reason, /not armed/);
  assert.equal(a.broker.count("submitEntry"), 0);
  const b = await gateRig({ notFlat: true });
  assert.match((await b.gate.enter(b.signal) as any).reason, /not flat/);
  assert.equal(b.broker.count("submitEntry"), 0);
  const ok = await gateRig();
  assert.equal((await ok.gate.enter(ok.signal)).status, "sent");
});

test("the stop flag is still the reason given when the day is also unarmed or not flat", async () => {
  const a = await gateRig({ armed: false, stop: true });
  assert.equal((await a.gate.enter(a.signal) as any).reason, "stop flag is set");
  const b = await gateRig({ notFlat: true, stop: true });
  assert.equal((await b.gate.enter(b.signal) as any).reason, "stop flag is set");
});

test("if the record cannot be updated after the order was sent, Michael is told and the entry still counts", async () => {
  const g = await gateRig();
  const realUpdate = g.store.updateOrder.bind(g.store);
  g.store.updateOrder = async (id, patch) => { if (patch.status === "submitted") throw new Error("db blip (test)"); return realUpdate(id, patch); };
  const r = await g.gate.enter(g.signal);
  assert.equal(r.status, "sent");
  assert.ok(g.said.some((m) => m.ch === "alerts" && m.text.includes("record could not be updated")));
  assert.equal((await g.store.listOrders(D))[0]!.status, "intent", "still counted");
});

// ---- risk additions ----

const riskDeps = (broker: FakeBroker, store: MemoryStore, said: Array<{ ch: string; text: string }>) => ({ broker, store, now: () => new Date("2026-11-02T16:00:00Z"), say: (async (ch: string, text: string) => (said.push({ ch, text }), true)) as any });

test("while the stop flag is on, an unfilled entry that arrives late is cancelled; protective stops and partial fills are left alone", async () => {
  const store = new MemoryStore();
  const broker = brokerWith(CALENDAR, true);
  const said: Array<{ ch: string; text: string }> = [];
  broker.orders = [
    order({ id: "00000000-0000-0000-0000-00000000000a", side: "buy", filledQty: 0, status: "accepted" }),
    order({ id: "00000000-0000-0000-0000-00000000000b", side: "sell", type: "stop", filledQty: 0, status: "new" }),
    order({ id: "00000000-0000-0000-0000-00000000000c", side: "buy", filledQty: 3, status: "partially_filled" }),
  ];
  assert.equal(await sweepEntriesWhileStopped(riskDeps(broker, store, said)), 0, "flag off: nothing");
  await store.setControl(CONTROL_STOP, { on: true, at: "x", reason: "owner command (stop)" } satisfies StopFlag);
  assert.equal(await sweepEntriesWhileStopped(riskDeps(broker, store, said)), 1);
  assert.deepEqual(broker.calls.filter((c) => c.fn === "cancelOrder").map((c) => c.args[0]), ["00000000-0000-0000-0000-00000000000a"]);
  assert.ok(said.some((m) => m.text.includes("reached Alpaca late")));
});

test("the daily loss stop retries its sale until the account is flat, but not for an owner stop or while a sell is working", async () => {
  const day = (await ensureDay({ store: new MemoryStore(), broker: brokerWith() }, D));
  const approved = { ...day, status: "approved" as const, dayStartEquity: 20000 };
  const store = new MemoryStore();
  const broker = brokerWith(CALENDAR, true);
  const said: Array<{ ch: string; text: string }> = [];
  broker.positions = HOLD;
  await store.setControl(CONTROL_STOP, { on: true, at: "x", reason: "daily loss stop reached (250.00 dollars)" } satisfies StopFlag);
  await enforceDailyLoss(riskDeps(broker, store, said), approved);
  assert.equal(broker.count("closeAllPositions"), 1, "retried");
  broker.positions = HOLD;
  broker.orders = [order({ side: "sell", type: "market", status: "accepted", symbol: "AAA" })];
  await enforceDailyLoss(riskDeps(broker, store, said), approved);
  assert.equal(broker.count("closeAllPositions"), 1, "a sell is already working");
  broker.orders = [];
  await store.setControl(CONTROL_STOP, { on: true, at: "x", reason: "owner command (stop)" } satisfies StopFlag);
  await enforceDailyLoss(riskDeps(broker, store, said), approved);
  assert.equal(broker.count("closeAllPositions"), 1, "an owner stop keeps positions");
});

// ---- close-out: not flat, after hours, restarts, overlap ----

async function notFlatDay() {
  const broker = brokerWith(CALENDAR, true);
  const r = rig({ broker });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("13:45:00");
  broker.positions = HOLD;
  let fails = true;
  const realClose = broker.closeAllPositions.bind(broker);
  broker.closeAllPositions = async () => { broker.calls.push({ fn: "closeAllPositions", args: [] }); if (fails) throw new Error("rejected (test)"); broker.positions = []; };
  void realClose;
  await r.at("20:55:00"); // close - 5: cannot get flat
  return { r, broker, fix: () => { fails = false; } };
}

test("a failed close-out is remembered in the database, so a restart does not forget it", async () => {
  const { r, broker } = await notFlatDay();
  const saved = await r.store.getControl<NotFlatState>(CONTROL_NOT_FLAT);
  assert.equal(saved?.on, true);
  assert.deepEqual(saved?.remaining, ["AAA"]);
  // a brand new worker over the same store, late Monday evening
  const again = rig({ broker, store: r.store, bot: r.bot });
  await again.at("2026-11-03T01:00:00Z");
  assert.ok(again.said("alerts").some((t) => t.includes("restarted while the account was NOT FLAT")));
  assert.equal(again.pings.at(-1), "fail", "the heartbeat keeps saying fail");
  // someone closes by hand: cleared on the next pass, on any day
  broker.positions = [];
  await again.at("2026-11-03T01:00:10Z");
  assert.equal((await r.store.getControl<NotFlatState>(CONTROL_NOT_FLAT))?.on, false);
  assert.ok(again.said("commands").some((t) => t.includes("not-flat flag is cleared")));
  await again.at("2026-11-03T01:00:20Z");
  assert.notEqual(again.pings.at(-1), "fail");
});

test("after the close a retry sends nothing and says so once; the next open sells the carried position", async () => {
  const { r, broker, fix } = await notFlatDay();
  const sends = broker.count("closeAllPositions");
  broker.clock = { ...broker.clock, isOpen: false }; // the close has passed
  await r.at("21:01:00");
  await r.at("21:07:00");
  assert.equal(broker.count("closeAllPositions"), sends, "no sell is queued after hours");
  assert.equal(r.said("alerts").filter((t) => t.includes("NOT FLAT")).length, 1, "the failure is reported once, not every 5 minutes");
  assert.equal(r.pings.at(-1), "fail");
  // Tuesday: the market opens, the broker accepts sells again
  fix();
  broker.clock = { ...broker.clock, isOpen: true };
  await r.at("2026-11-03T14:35:00Z");
  assert.equal(broker.count("closeAllPositions"), sends + 1, "sold at the open");
  assert.equal(broker.positions.length, 0);
  assert.equal((await r.store.getControl<NotFlatState>(CONTROL_NOT_FLAT))?.on, false);
});

test("the gate refuses entries while the account is flagged not flat", async () => {
  const { r, broker } = await notFlatDay();
  broker.clock = { ...broker.clock, isOpen: false };
  await r.at("21:01:00");
  const g = await gateRig({ notFlat: true });
  assert.match((await g.gate.enter(g.signal) as any).reason, /not flat/);
});

test("the emergency close-out and the regular one never run at the same time", { timeout: 20_000 }, async () => {
  const broker = brokerWith(CALENDAR, true);
  broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  const r = rig({ broker });
  await r.at("2026-11-01T22:10:00Z");
  await r.at("13:45:00");
  broker.positions = HOLD;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((res) => (release = res));
  broker.closeAllPositions = async () => { broker.calls.push({ fn: "closeAllPositions", args: [] }); await gate; broker.positions = []; };
  try {
    await r.at("20:55:00"); // the regular close-out starts and waits on the broker
    assert.equal(broker.count("closeAllPositions"), 1);
    r.store.failing = true; // the database drops: the emergency path would normally fire
    await r.at("20:56:00");
    assert.equal(broker.count("closeAllPositions"), 1, "the emergency path stood aside");
  } finally {
    r.store.failing = false;
    release(); // always let the waiting close-out finish, even when an assertion above fails
    await settle();
  }
});

// ---- the start message ----

test("the start message says whether it is a new release or the same one again, and a run of starts raises the flag", async () => {
  const store = new MemoryStore();
  const t0 = new Date("2026-10-30T21:32:00Z");
  const first = await recordStart(store, t0, "abc12345");
  assert.ok(first.text.includes("first start on record") && first.text.includes("4:32 PM CT") && !first.repeated);
  const deploy = await recordStart(store, new Date(t0.getTime() + 5 * 60_000), "def67890");
  assert.ok(deploy.text.includes("New release def67890") && deploy.text.includes("it was abc12345") && deploy.text.includes("deploy"));
  const same = await recordStart(store, new Date(t0.getTime() + 10 * 60_000), "def67890");
  assert.ok(same.text.includes("same code started again") && same.text.includes("Starts in the last hour: 3"));
  assert.equal(same.repeated, true, "three starts in an hour");
  const later = await recordStart(store, new Date(t0.getTime() + 5 * 3600_000), "def67890");
  assert.equal(later.repeated, false);
  assert.equal(later.recentStarts, 1);
  store.failing = true;
  const noStore = await recordStart(store, t0, "x");
  assert.ok(noStore.text.includes("started at"), "still produces a message when the database is down");
});

test("release label comes from Fly's image reference, and says local elsewhere", () => {
  assert.equal(releaseLabel({}), "local");
  assert.equal(releaseLabel({ FLY_IMAGE_REF: "registry.fly.io/sib-tech-cyrus:deployment-01M67CAR055T90FWZTN3TYCF2D" }), "ZTN3TYCF2D".slice(-8));
});

test("a request posted late, inside the review window, is not followed by a duplicate review", async () => {
  const r = rig({ broker: brokerWith() });
  await r.at("2026-11-02T13:45:00Z"); // the worker was down all night: the first request goes out at 7:45 AM Central
  assert.equal(r.said("commands").filter((t) => t.includes("Suggested limits for Monday")).length, 1);
  await r.at("2026-11-02T13:46:00Z");
  assert.ok(!r.said("commands").some((t) => t.includes("Good morning")), "the request itself was the review");
  assert.equal((await r.store.getDay(D))!.phases.morning, "skipped");
});

test("the lapse says nothing when a pending day is somehow found after the close, and speaks when the session is on", async () => {
  const store = new MemoryStore();
  const broker = brokerWith();
  const said: string[] = [];
  let now = new Date("2026-11-02T21:30:00Z"); // after the 4:00 PM Eastern close
  const steps = { store, broker, now: () => now, feed: "iex", say: async (_c: string, t: string) => (said.push(t), true) } as any;
  const { lapseIfUndecided } = await import("../src/morning.ts");
  let day = await ensureDay({ store, broker }, D); // created without a clock, so it is pending
  day = await lapseIfUndecided(steps, day);
  assert.equal(day.status, "lapsed");
  assert.equal(said.length, 0, "no message about a session that is over");
  await store.updateDay(D, { status: "pending" });
  now = new Date("2026-11-02T15:00:00Z"); // the session is on
  day = await lapseIfUndecided(steps, (await store.getDay(D))!);
  assert.equal(said.length, 1);
  assert.ok(said[0]!.includes("8:30 AM CT") && !said[0]!.includes("The market is open"));
});

test("the scheduler keeps cancelling unfilled entries while the stop flag is on, and leaves the protective stop alone", async () => {
  const broker = brokerWith(CALENDAR, true);
  const r = rig({ broker });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:26:00"); // armed
  r.ownerSays("stop", "14:40:00");
  await r.at("14:40:05");
  // an entry that passed the gate's last look just before the stop reaches Alpaca afterwards
  broker.orders = [
    order({ id: "00000000-0000-0000-0000-00000000000a", side: "buy", filledQty: 0, status: "accepted" }),
    order({ id: "00000000-0000-0000-0000-00000000000b", side: "sell", type: "stop", filledQty: 0, status: "new" }),
  ];
  await r.at("14:41:00");
  assert.deepEqual(broker.calls.filter((c) => c.fn === "cancelOrder").map((c) => c.args[0]), ["00000000-0000-0000-0000-00000000000a"]);
  assert.ok(r.said("commands").some((t) => t.includes("reached Alpaca late")));
});
