// Review round 5 findings, fixed for round 6. One block per fix; each test was checked to fail with its fix taken out
// (recorded in builds/build-c2-log.md). The fix for the database query time limit has its own file, pg-timeout.test.ts.
//   1. a pass that runs too long: the watchdog (the query time limit itself is in pg-timeout.test.ts)
//   2. the day read falls back to the last day record held in memory
//   3. the loss stop checks equity even when the stop flag cannot be read
//   4. the loss stop sells without waiting on the stop-flag write, the alert or the event
//   5. an unsaved stop is retried on every pass, and is found again after a restart from today's equity history
import { test } from "node:test";
import assert from "node:assert/strict";
import { CachingStore } from "../src/caching-store.ts";
import { ensureDay } from "../src/morning.ts";
import { enforceDailyLoss, LossStopMemory } from "../src/risk.ts";
import { OrderGate, clientOrderIdFor } from "../src/gate.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Governor } from "../src/governor.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { SUGGESTED_LIMITS } from "../src/limits.ts";
import { CONTROL_STOP, MemoryStore, type StopFlag, type Store } from "../src/store.ts";
import { FakeBroker, FakeBot } from "./helpers.ts";
import { D, rig, settle, z } from "./rig.ts";

const never = <T>() => new Promise<T>(() => undefined);
const AAA = { symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 };

// A worker on a day Michael approved (loss stop 200 dollars), armed at 14:25 UTC (9:25 New York), holding 20 AAA that it entered.
async function armedRig<S extends Store = MemoryStore>(opts: { store?: S; broker?: FakeBroker; midday?: boolean } = {}) {
  const r = rig<FakeBroker, S>(opts);
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("loss 200\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("14:25:00");
  assert.ok((await r.store.getDay(D))!.phases.armed, "armed");
  await r.store.insertOrder({ clientOrderId: "cyrus-20261102-AAA-1", tradeDate: D, symbol: "AAA", qty: 20, referencePrice: 50, stopPrice: 49, status: "filled", alpacaOrderId: "x", filledQty: 20, filledAvgPrice: 50, note: null, createdAt: "2026-11-02T14:40:00.000Z" });
  r.broker.positions = [{ ...AAA }];
  return r;
}
// The caching store as the worker uses it, but with no cache lifetime, so a test cannot pass by reading inside the cache window.
const caching = (mem: MemoryStore) => new CachingStore(mem, Date.now, { controlTtlMs: 0, dayTtlMs: 0 });
const stopIn = async (s: Store) => (await s.getControl<StopFlag>(CONTROL_STOP))?.on === true;

// A loss-stop setup without the worker: an approved, armed day with start equity 20,000 and a 200 dollar loss stop.
async function lossSetup(store: Store) {
  const broker = new FakeBroker();
  const clock = { t: new Date("2026-11-02T16:00:00Z") };
  const now = clock.t;
  const said: string[] = [];
  const say = async (_c: string, t: string) => (said.push(t), true);
  const deps = { broker, store, now: () => clock.t, say: say as any, lossMemory: new LossStopMemory(), liquidator: new Liquidator({ broker, gate: new SellGate({ broker, say: say as any, nowMs: () => clock.t.getTime() }), now: () => clock.t, sleep: async () => undefined }) };
  await ensureDay(deps, D);
  await store.updateDay(D, { status: "approved", dayStartEquity: 20000, limits: { ...SUGGESTED_LIMITS, dailyLossStopUsd: 200, maxPositionUsd: 1000 }, decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "x", armed: "x" } });
  broker.positions = [{ ...AAA }];
  broker.account = { ...broker.account, equity: 19500 }; // down 500 against a 200 loss stop
  return { broker, deps, said, now, clock };
}

// ---------- 1. the watchdog ----------
test("watchdog: a pass stuck on the database near the close still closes out from the broker alone, and the heartbeat says fail", { timeout: 10_000 }, async () => {
  const r = await armedRig({ midday: false }); // the mid-day cycle (on in production) would sell at 10:30 CT; it is tested in midday.test.ts
  await r.at("20:40:00");
  r.store.getDay = () => never(); // from 20:50 every read of the day hangs, as in the round 5 reproduction
  r.setNow("20:50:00");
  void r.worker.tick();
  await settle();
  await r.at("20:51:10");
  assert.ok(r.said("alerts").some((t) => t.includes("main loop is stuck")), "Michael is told");
  assert.equal(r.pings.at(-1), "fail", "the heartbeat says fail at once");
  assert.equal(r.broker.count("submitSell"), 0, "not yet near the close");
  await r.at("20:56:00");
  assert.ok(r.broker.count("submitSell") > 0, "the close-out ran while the pass was still stuck");
  assert.equal(r.broker.positions.length, 0, "flat before the close");
  assert.equal(r.said("alerts").filter((t) => t.includes("my main loop is stuck**")).length, 1, "told once per stuck pass");
});

test("watchdog: during a stuck pass the daily loss stop still runs, from the day record held in memory", { timeout: 10_000 }, async () => {
  const r = await armedRig();
  await r.at("14:50:00");
  r.store.getDay = () => never();
  r.setNow("15:00:00");
  void r.worker.tick();
  await settle();
  r.broker.account = { ...r.broker.account, equity: 19500 };
  await r.at("15:01:05");
  await settle();
  assert.equal(await stopIn(r.store), true, "the loss stop fired");
  assert.equal(r.broker.positions.length, 0, "and sold");
});

// ---------- 2. the day read falls back to memory ----------
test("a failed read of today's record does not switch off the daily loss stop: the pass uses the copy in memory", async () => {
  const r = await armedRig();
  await r.at("14:50:00");
  r.store.getDay = async () => { throw new Error("the day read failed (test)"); };
  r.broker.account = { ...r.broker.account, equity: 19500 };
  await r.at("14:51:00");
  await settle();
  assert.equal(await stopIn(r.store), true, "the loss stop fired");
  assert.equal(r.broker.positions.length, 0, "and sold");
  assert.ok(r.said("alerts").some((t) => t.includes("cannot read today's record")), "Michael is told");
  await r.at("14:51:05");
  await r.at("14:51:10");
  assert.equal(r.pings.at(-1), "fail", "the heartbeat still reports the outage");
});

test("the copy in memory is used only for the same day: a new day with no readable record fails the pass as before", async () => {
  const r = await armedRig();
  await r.at("14:50:00");
  r.store.getDay = async () => { throw new Error("the day read failed (test)"); };
  await r.at("2026-11-03T14:50:00Z");
  assert.equal(r.said("alerts").filter((t) => t.includes("cannot read today's record")).length, 0, "yesterday's copy is not used for today");
});

// ---------- 3. equity is checked when the stop flag cannot be read ----------
test("with every database call failing in the session, the loss stop still fires once and sells (round 5 reproduction)", async () => {
  const r = await armedRig();
  await r.at("14:50:00");
  r.store.failing = true;
  r.broker.account = { ...r.broker.account, equity: 19500 };
  for (const t of ["14:51:00", "14:51:30", "14:52:00", "14:52:30", "14:53:00", "14:55:00"]) await r.at(t);
  await settle();
  assert.ok(r.broker.count("submitSell") > 0, "sold");
  assert.equal(r.broker.positions.length, 0);
  assert.equal(r.said("commands").filter((t) => t.includes("Daily loss stop reached")).length, 1, "fired once, not again on every pass");
});

test("loss stop unit: an unreadable stop flag still lets the stop fire; after firing, an unreadable flag means retry the sale, not fire again", async () => {
  const mem = new MemoryStore();
  const p = await lossSetup(mem);
  mem.getControl = async () => { throw new Error("the flag read failed (test)"); };
  assert.equal(await enforceDailyLoss(p.deps, (await mem.getDay(D))!), true, "fired");
  assert.equal(p.broker.positions.length, 0, "sold");
  p.broker.positions = [{ ...AAA }]; // say a sell did not fill
  p.clock.t = new Date(p.clock.t.getTime() + 30_000); // the next loss-stop pass, 30 seconds later
  assert.equal(await enforceDailyLoss(p.deps, (await mem.getDay(D))!), false, "not fired a second time");
  assert.equal(p.broker.positions.length, 0, "but the sale was retried");
});

// ---------- 4. the sale waits on nothing but the broker ----------
test("loss stop unit: a stop-flag write, event and alert that never finish do not hold the sale back, and the gate refuses an entry mid-sale", { timeout: 10_000 }, async () => {
  const mem = new MemoryStore();
  const store = caching(mem);
  const p = await lossSetup(store);
  const realSet = mem.setControl.bind(mem);
  mem.setControl = (k: string, v: unknown) => (k === CONTROL_STOP ? never<void>() : realSet(k, v));
  mem.addEvent = () => never<void>();
  p.deps.say = (() => never<boolean>()) as any; // Discord hangs too
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  p.broker.onSell = () => held; // the sale is in progress until released
  const run = enforceDailyLoss(p.deps, (await store.getDay(D))!);
  await settle();
  assert.equal(p.broker.count("submitSell"), 1, "the sell was sent although the flag write never finished");
  const gate = new OrderGate({ broker: p.broker, store, view: new BrokerView(p.broker, () => p.now.getTime()), governor: new Governor(() => p.now.getTime()), now: () => p.now, say: async () => true, note: () => undefined });
  const entry = await gate.enter({ symbol: "BBB", price: 20, tradeTime: new Date(p.now.getTime() - 1000), stopPrice: 19.7, takeProfitPrice: 20.1 });
  assert.equal(entry.status, "refused");
  assert.match((entry as any).reason, /stop flag is set/);
  release();
  assert.equal(await run, true, "finished as soon as the sale did");
  assert.equal(p.broker.positions.length, 0);
});

test("a stop-flag write that hangs does not stop the loss stop task from running again on the next pass", { timeout: 10_000 }, async () => {
  const mem = new MemoryStore();
  const r = await armedRig({ store: caching(mem) });
  await r.at("14:50:00");
  const realSet = mem.setControl.bind(mem);
  mem.setControl = (k: string, v: unknown) => (k === CONTROL_STOP ? never<void>() : realSet(k, v));
  let sellsWork = false;
  r.broker.onSell = async () => { if (!sellsWork) throw new Error("sell refused (test)"); };
  r.broker.account = { ...r.broker.account, equity: 19500 };
  await r.at("14:51:00");
  await settle();
  assert.ok(r.broker.count("submitSell") > 0, "the sale was tried at once");
  assert.equal(await stopIn(r.store), true, "the stop is in force (in memory)");
  assert.equal(r.broker.positions.length, 1, "still held: the sells failed");
  sellsWork = true;
  await r.at("14:51:30");
  await settle();
  assert.equal(r.broker.positions.length, 0, "the next loss-stop pass retried the sale");
});

// ---------- 5. an unsaved stop: retried, and found again after a restart ----------
test("an unsaved stop is saved by a later pass once the database is back", async () => {
  const mem = new MemoryStore();
  const r = await armedRig({ store: caching(mem) });
  await r.at("14:50:00");
  const realSet = mem.setControl.bind(mem);
  let down = true;
  mem.setControl = async (k: string, v: unknown) => { if (down && k === CONTROL_STOP) throw new Error("db down (test)"); return realSet(k, v); };
  r.broker.account = { ...r.broker.account, equity: 19500 };
  await r.at("14:51:00");
  await settle();
  assert.equal((mem.control.get(CONTROL_STOP) as StopFlag | undefined)?.on ?? false, false, "not saved yet");
  await r.at("14:51:05");
  await settle();
  assert.equal((mem.control.get(CONTROL_STOP) as StopFlag | undefined)?.on ?? false, false, "still down: still not saved");
  down = false;
  await r.at("14:51:10");
  await settle();
  assert.equal((mem.control.get(CONTROL_STOP) as StopFlag).on, true, "saved by the next pass");
  assert.match((mem.control.get(CONTROL_STOP) as StopFlag).reason, /daily loss stop/);
  assert.ok(r.said("alerts").some((t) => t.includes("now saved")));
});

test("the retry of an unsaved stop never overwrites a later resume, in either order", { timeout: 10_000 }, async () => {
  // resume asked while the retry's write is still on its way: the resume lands last
  const mem = new MemoryStore();
  const store = caching(mem);
  const realSet = mem.setControl.bind(mem);
  mem.setControl = async () => { throw new Error("db down (test)"); };
  await assert.rejects(store.setControl(CONTROL_STOP, { on: true, at: "t1", reason: "daily loss stop reached" }));
  let release!: () => void;
  const slow = new Promise<void>((r) => (release = r));
  let first = true;
  mem.setControl = async (k: string, v: unknown) => { if (first) { first = false; await slow; } return realSet(k, v); };
  const retry = store.retryUnsavedStop();
  await settle();
  const resume = store.setControl(CONTROL_STOP, { on: false, at: "t2", reason: "owner command (resume)" });
  await settle();
  release();
  await Promise.all([retry, resume]);
  assert.equal((mem.control.get(CONTROL_STOP) as StopFlag).on, false, "the database ends with the resume");
  assert.equal(await stopIn(store), false);
  assert.equal(store.hasUnsavedStop(), false);
  // resume saved first: a retry afterwards does nothing
  const mem2 = new MemoryStore();
  const store2 = caching(mem2);
  const realSet2 = mem2.setControl.bind(mem2);
  let down = true;
  mem2.setControl = async (k: string, v: unknown) => { if (down) throw new Error("db down (test)"); return realSet2(k, v); };
  await assert.rejects(store2.setControl(CONTROL_STOP, { on: true, at: "t1", reason: "daily loss stop reached" }));
  down = false;
  await store2.setControl(CONTROL_STOP, { on: false, at: "t2", reason: "owner command (resume)" });
  assert.equal(await store2.retryUnsavedStop(), false);
  assert.equal((mem2.control.get(CONTROL_STOP) as StopFlag).on, false);
});

// The reviewer's round 5 scratch case: the stop could not be saved, the sale failed, the worker restarted, equity recovered.
async function restartAfterUnsavedStop(history: Array<{ atMs: number; equity: number }>, beforeRestart?: (mem: MemoryStore) => Promise<void>) {
  const mem = new MemoryStore();
  const r1 = await armedRig({ store: caching(mem) });
  await r1.at("14:50:00");
  const realSet = mem.setControl.bind(mem);
  let down = true;
  mem.setControl = async (k: string, v: unknown) => { if (down && k === CONTROL_STOP) throw new Error("db down (test)"); return realSet(k, v); };
  r1.broker.onSell = async () => { throw new Error("sell refused (test)"); };
  r1.broker.account = { ...r1.broker.account, equity: 19500 };
  await r1.at("14:51:00");
  await settle();
  assert.equal(await stopIn(r1.store), true, "the stop fired (in memory only)");
  assert.equal(mem.control.get(CONTROL_STOP), undefined, "and was never saved");
  // the process restarts: a new caching store and worker over the same database and broker
  r1.worker.stop();
  down = false;
  r1.broker.onSell = null;
  r1.broker.account = { ...r1.broker.account, equity: 19990 }; // recovered above the loss line
  r1.broker.equityHistory = history;
  await beforeRestart?.(mem);
  const r2 = rig<FakeBroker, CachingStore>({ store: caching(mem), broker: r1.broker, bot: new FakeBot() });
  return { mem, r1, r2 };
}

test("after a restart that forgot an unsaved stop, today's equity history brings it back, and no entry is sent", async () => {
  const dip = [{ atMs: z("14:50:00").getTime(), equity: 19990 }, { atMs: z("14:51:00").getTime(), equity: 19500 }, { atMs: z("14:52:00").getTime(), equity: 19990 }];
  const { mem, r2 } = await restartAfterUnsavedStop(dip);
  await r2.at("14:55:00");
  await settle();
  const flag = mem.control.get(CONTROL_STOP) as StopFlag;
  assert.equal(flag?.on, true, "the stop is back, and saved");
  assert.match(flag.reason, /earlier today/);
  await r2.at("14:55:05");
  await r2.ramp("BBB", [...Array(12).fill(50), 50.4], "14:56:00");
  await settle();
  assert.equal(r2.broker.count("submitEntry"), 0, "no entry");
});

test("after a restart in the session, live prices wait until the loss stop's first check (with the equity history) has worked", async () => {
  const { r2 } = await restartAfterUnsavedStop([]);
  r2.broker.failOn.add("getEquityHistoryToday");
  await r2.at("14:55:00");
  await r2.at("14:55:05");
  await r2.at("14:55:40");
  assert.equal(r2.counts().streamStarts, 0, "no prices, so no signals, while the check cannot run");
  assert.ok(r2.said("alerts").some((t) => t.includes("could not check the daily loss stop")));
  r2.broker.failOn.delete("getEquityHistoryToday");
  await r2.at("14:56:10");
  await settle();
  await r2.at("14:56:15");
  assert.equal(r2.counts().streamStarts, 1, "prices start once the check has worked");
});

test("a dip before Michael's own resume is not brought back after a restart", async () => {
  const dip = [{ atMs: z("14:51:00").getTime(), equity: 19500 }, { atMs: z("14:54:00").getTime(), equity: 19990 }];
  const { mem, r2 } = await restartAfterUnsavedStop(dip, async (m) => {
    await m.setControl(CONTROL_STOP, { on: false, at: z("14:53:00").toISOString(), reason: "owner command (resume)" });
  });
  await r2.at("14:55:00");
  await settle();
  assert.equal((mem.control.get(CONTROL_STOP) as StopFlag).on, false, "the resume stands");
});
