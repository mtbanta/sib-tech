// Michael's mid-day build of 2026-11-16, item 1: an order sync at once after Alpaca's live order updates reconnect (on 2026-11-16 at
// 9:54:56 a 2 second reconnect lost three fills; the 5 second cancels then went to filled entries, Alpaca cancelled their exits, and the
// regular sync found them 14 s later). Items 3 and 4 are tested beside their older tests (release-2026-11-12, midday).
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig } from "./rig.ts";

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
