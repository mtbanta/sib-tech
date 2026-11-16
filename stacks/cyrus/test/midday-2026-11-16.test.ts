// Michael's mid-day build of 2026-11-16, item 1: an order sync at once after Alpaca's live order updates reconnect (on 2026-11-16 at
// 9:54:56 a 2 second reconnect lost three fills; the 5 second cancels then went to filled entries, Alpaca cancelled their exits, and the
// regular sync found them 14 s later). Items 3 and 4 are tested beside their older tests (release-2026-11-12, midday).
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig } from "./rig.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { FakeBroker } from "./helpers.ts";

async function session() {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const ev: Array<{ e: string; d: any }> = [];
  const r: any = rig({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true, log: (_l: string, e: string, d?: any) => void ev.push({ e, d }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const w: any = r.worker;
  let syncs = 0;
  const orig = w.startSync.bind(w);
  w.startSync = (...a: unknown[]) => {
    syncs++;
    return orig(...a);
  };
  return { r, sim, w, ev, syncs: () => syncs };
}

test("item 1: after the live updates reconnect, an order sync starts at once (not at the next regular sync)", async () => {
  const s = await session();
  assert.ok(s.r.counts().orderStreamStarts >= 1, "the live updates are running");
  await s.r.setNow("14:30:06"); // a regular sync ran a second ago, so none is due for 9 s
  const before = s.syncs();
  await s.r.orderStreamStatus("reconnecting");
  assert.equal(s.syncs(), before, "nothing while it is down");
  await s.r.orderStreamStatus("live");
  assert.equal(s.syncs(), before + 1, "one sync at once when it is live again");
  assert.ok(s.ev.some((x) => x.e === "order_stream_reconnect_sync" && x.d.syncRunning === false));
  await s.r.orderStreamStatus("live");
  assert.equal(s.syncs(), before + 1, "a second 'live' without a drop brings nothing more: one sync per reconnect");
});

test("item 1: the first connection of the day brings no extra sync, only a reconnect does", async () => {
  const s = await session();
  await s.r.setNow("14:30:06");
  const before = s.syncs();
  await s.r.orderStreamStatus("connecting");
  await s.r.orderStreamStatus("authenticating");
  await s.r.orderStreamStatus("live");
  assert.equal(s.syncs(), before);
  assert.ok(!s.ev.some((x) => x.e === "order_stream_reconnect_sync"));
});

test("item 1: a reconnect while a sync is running is owed, and the sync starts as soon as that one ends (never two at once)", async () => {
  const s = await session();
  await s.r.setNow("14:30:06");
  let release!: () => void;
  const running = new Promise<void>((res) => (release = res));
  assert.ok(s.w.background("risk", () => running), "a sync is running");
  const before = s.syncs();
  await s.r.orderStreamStatus("reconnecting");
  await s.r.orderStreamStatus("live");
  assert.equal(s.syncs(), before, "not doubled while one runs");
  assert.ok(s.ev.some((x) => x.e === "order_stream_reconnect_sync" && x.d.syncRunning === true));
  release();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(s.syncs(), before + 1, "it starts once the running one ended");
});

// Group 1, round 1 (finding 1): a reconnect while a protection look holds "risk" is served when the look ends, and the next regular sync
// does not bring a second one (before the fix: nothing at the look's end, then two syncs back to back at the next regular sync).
test("item 1: a reconnect during a protection look gets its sync when the look ends, and no second one after the next regular sync", async () => {
  const s = await session();
  await s.r.setNow("14:30:06");
  const before = s.syncs();
  // The look's first read waits until the test lets it go, so the reconnect comes while it holds "risk".
  let letGo!: () => void;
  const gate = new Promise<void>((res) => (letGo = res));
  const lossStopInForce = s.w.lossStopInForce.bind(s.w);
  s.w.lossStopInForce = async (d: string) => { await gate; return lossStopInForce(d); };
  const look = s.w.look(new Set(["cyrus-20261102-ZZZ-1"]), "protect", 0); // takes "risk" before its first wait
  assert.equal(s.w.inflight.has("risk"), true, "the look holds risk");
  await s.r.orderStreamStatus("reconnecting");
  await s.r.orderStreamStatus("live");
  assert.equal(s.syncs(), before, "owed while the look runs");
  assert.equal(s.w.reconnectSyncOwed, true);
  s.w.lossStopInForce = lossStopInForce;
  letGo();
  await look;
  await new Promise((r) => setImmediate(r));
  assert.equal(s.syncs(), before + 1, "the owed sync starts when the look ends");
  assert.equal(s.w.reconnectSyncOwed, false);
  await new Promise((r) => setImmediate(r));
  await s.r.at("14:30:20"); // the next regular sync
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  assert.equal(s.syncs(), before + 2, "one regular sync, not a second owed one behind it");
});

test("item 1: a reconnect during a look that ends when a regular sync is due: that sync serves it, and no second sync follows it", async () => {
  const s = await session();
  await s.r.setNow("14:30:06");
  const before = s.syncs();
  let letGo!: () => void;
  const gate = new Promise<void>((res) => (letGo = res));
  const lossStopInForce = s.w.lossStopInForce.bind(s.w);
  s.w.lossStopInForce = async (d: string) => { await gate; return lossStopInForce(d); };
  const look = s.w.look(new Set(["cyrus-20261102-ZZZ-1"]), "protect", 0);
  await s.r.orderStreamStatus("reconnecting");
  await s.r.orderStreamStatus("live");
  assert.equal(s.w.reconnectSyncOwed, true);
  s.w.lossStopInForce = lossStopInForce;
  s.r.setNow("14:30:16"); // the regular sync is due by the time the look ends
  letGo();
  await look;
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  assert.equal(s.syncs(), before + 1, "the regular sync the look's end started is the one owed");
  assert.equal(s.w.reconnectSyncOwed, false);
});

test("item 1: outside the session a reconnect brings no sync", async () => {
  const s = await session();
  await s.r.at("21:05:00"); // after the close
  const before = s.syncs();
  await s.r.orderStreamStatus("reconnecting");
  await s.r.orderStreamStatus("live");
  assert.equal(s.syncs(), before);
});

// ---------------- item 2: missing-exit sales of different symbols side by side, one at a time per symbol ----------------


// The queue alone: `run` replaced by a step the test finishes by hand, so only the order in which sales start is under test.
function queue(room: (running: number) => boolean = () => true) {
  const broker = new FakeBroker();
  const liq: any = new Liquidator({ broker, gate: new SellGate({ broker, say: async () => true }), now: () => new Date(), sleep: async () => undefined, sideBySideRoom: room });
  const started: string[] = [];
  const finish = new Map<string, () => void>();
  liq.run = (o: any) => {
    started.push(o.reason);
    return new Promise((res) => finish.set(o.reason, () => res({ flat: true, remaining: [], sold: [], errors: [] })));
  };
  const tick = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };
  const missing = (name: string, symbol: string) => liq.flatten({ reason: name, only: [symbol], ownEntryOnly: { maxQty: { [symbol]: 1 } }, sideBySide: true });
  return { liq, started, finish, tick, missing };
}

test("item 2: missing-exit sales of different symbols start side by side; a second one on the same symbol waits for the first", async () => {
  const q = queue();
  const a = q.missing("AAL", "AAL");
  const b = q.missing("RIOT", "RIOT");
  const c = q.missing("SOFI", "SOFI");
  const a2 = q.missing("AAL again", "AAL");
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "RIOT", "SOFI"], "three symbols at once (at 9:55 SOFI waited 6.6 s behind the other two)");
  q.finish.get("AAL")!();
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "RIOT", "SOFI", "AAL again"], "the same symbol only after its earlier sale ended");
  for (const k of ["RIOT", "SOFI", "AAL again"]) q.finish.get(k)!();
  await Promise.all([a, b, c, a2]);
});

test("item 2: any other sale still runs alone: it waits for the side-by-side sales asked before it, and those asked after it wait for it", async () => {
  const q = queue();
  const a = q.missing("AAL", "AAL");
  const w = q.liq.flatten({ reason: "close-out" }); // a sale of the whole account
  const r = q.liq.flatten({ reason: "remainder", only: ["T"], ownEntryOnly: { maxQty: { T: 1 } } }); // a remainder sale: not side by side
  const b = q.missing("RIOT", "RIOT");
  await q.tick();
  assert.deepEqual(q.started, ["AAL"], "the close-out waits for the sale asked before it");
  q.finish.get("AAL")!();
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "close-out"]);
  q.finish.get("close-out")!();
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "close-out", "remainder"], "the remainder sale runs alone, after the close-out");
  q.finish.get("remainder")!();
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "close-out", "remainder", "RIOT"], "a missing-exit sale asked after them waits for both");
  q.finish.get("RIOT")!();
  await Promise.all([a, w, r, b]);
  assert.equal(q.liq.isLiquidating(), false);
});

test("item 2: a sale of the whole account asked while side-by-side sales run waits for all of them", async () => {
  const q = queue();
  const a = q.missing("AAL", "AAL");
  const b = q.missing("RIOT", "RIOT");
  const w = q.liq.flatten({ reason: "loss stop", priority: true });
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "RIOT"]);
  assert.equal(q.liq.priorityWaiting(), true, "the side-by-side sales see the loss stop waiting (they give way at their next step)");
  q.finish.get("RIOT")!();
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "RIOT"], "still waiting for AAL");
  q.finish.get("AAL")!();
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "RIOT", "loss stop"]);
  q.finish.get("loss stop")!();
  await Promise.all([a, b, w]);
});

test("item 2: a side-by-side sale that throws does not block the next sale of its symbol or the others", async () => {
  const broker = new FakeBroker();
  const liq: any = new Liquidator({ broker, gate: new SellGate({ broker, say: async () => true }), now: () => new Date(), sleep: async () => undefined, sideBySideRoom: () => true });
  const started: string[] = [];
  liq.run = async (o: any) => { started.push(o.reason); if (o.reason === "bad") throw new Error("boom (test)"); return { flat: true, remaining: [], sold: [], errors: [] }; };
  const bad = liq.flatten({ reason: "bad", only: ["AAL"], ownEntryOnly: { maxQty: { AAL: 1 } }, sideBySide: true }).catch(() => "threw");
  const next = liq.flatten({ reason: "next", only: ["AAL"], ownEntryOnly: { maxQty: { AAL: 1 } }, sideBySide: true });
  const w = liq.flatten({ reason: "close-out" });
  assert.equal(await bad, "threw");
  await next;
  await w;
  assert.deepEqual(started, ["bad", "next", "close-out"]);
});

// Michael's ruling on item 2: as many at once as the request budget allows above the urgent floor; one always runs when none does.
test("item 2 (ruling): with room for two, the third waits until one ends; with no room at all they run one at a time", async () => {
  const q = queue((running) => running < 2);
  const a = q.missing("AAL", "AAL");
  const b = q.missing("RIOT", "RIOT");
  const c = q.missing("SOFI", "SOFI");
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "RIOT"], "room for two");
  q.finish.get("AAL")!();
  await q.tick();
  assert.deepEqual(q.started, ["AAL", "RIOT", "SOFI"], "the third starts when one ends");
  q.finish.get("RIOT")!();
  q.finish.get("SOFI")!();
  await Promise.all([a, b, c]);
  const z = queue(() => false);
  const x = z.missing("AAL", "AAL");
  const y = z.missing("RIOT", "RIOT");
  await z.tick();
  assert.deepEqual(z.started, ["AAL"], "no room: one at a time (never worse than before)");
  z.finish.get("AAL")!();
  await z.tick();
  assert.deepEqual(z.started, ["AAL", "RIOT"]);
  z.finish.get("RIOT")!();
  await Promise.all([x, y]);
});

test("item 2 (ruling): a close-out request stops a waiting side-by-side sale from starting (it stands aside); the running one carries on", async () => {
  const broker = new FakeBroker();
  const liq: any = new Liquidator({ broker, gate: new SellGate({ broker, say: async () => true }), now: () => new Date(), sleep: async () => undefined, sideBySideRoom: () => false });
  const started: string[] = [];
  const finish = new Map<string, () => void>();
  const realRun = liq.run.bind(liq);
  liq.run = (o: any) => {
    started.push(o.reason);
    if (o.reason === "RIOT") return realRun(o); // the real start: it must stand aside before sending anything
    return new Promise((res) => finish.set(o.reason, () => res({ flat: true, remaining: [], sold: [], errors: [] })));
  };
  const tick = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r)); };
  const a = liq.flatten({ reason: "AAL", only: ["AAL"], ownEntryOnly: { maxQty: { AAL: 1 } }, sideBySide: true });
  const b = liq.flatten({ reason: "RIOT", only: ["RIOT"], ownEntryOnly: { maxQty: { RIOT: 1 } }, sideBySide: true });
  await tick();
  assert.deepEqual(started, ["AAL"], "RIOT waits for room");
  const w = liq.flatten({ reason: "close-out" });
  await tick();
  const rb = await b;
  assert.equal(rb.stoodAside, "whole account", "RIOT stood aside: the close-out was asked before it could start");
  assert.equal(broker.calls.length, 0, "it sent nothing");
  assert.deepEqual(started, ["AAL", "RIOT"], "AAL still running; the close-out waits for it");
  finish.get("AAL")!();
  await tick();
  assert.deepEqual(started, ["AAL", "RIOT", "close-out"]);
  finish.get("close-out")!();
  await Promise.all([a, w]);
});

test("item 2 (ruling): the worker's room rule: one more side-by-side sale only while Alpaca's remaining, less 18 for each running and the new one and the budget's unsent room, stays at or above 20", async () => {
  const s = await session();
  const room = s.w.liquidator.d.sideBySideRoom as (running: number) => boolean;
  s.w.d.governor.budget = () => 74;
  assert.equal(room(1), true, "74 - 2 x 18 = 38: room");
  assert.equal(room(2), true, "74 - 3 x 18 = 20: exactly the floor, room");
  assert.equal(room(3), false, "74 - 4 x 18 = 2: below the floor of 20, no room");
  const res = s.w.budget.tryReserve("P1", 10, { label: "stuck retry", force: true });
  assert.equal(room(2), false, "the budget's 10 reserved and unsent count too: 74 - 10 - 54 = 10");
  res.end();
  assert.equal(room(2), true);
});
