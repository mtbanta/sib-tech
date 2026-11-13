// Item 3 of 2026-11-13 (Michael's retry rule, confirmed: a maximum number of tries or a maximum rate, always with a backoff): the older
// retry loops the audit found, brought into line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ProgressGap, RetryBackoff } from "../src/retry-backoff.ts";
import { retryGapMs } from "../src/worker.ts";
import { CommandProcessor } from "../src/commands.ts";
import { NextSessionFinder, ensureDay } from "../src/morning.ts";
import { MemoryStore, CONTROL_COMMAND_CURSOR } from "../src/store.ts";
import { CachingStore } from "../src/caching-store.ts";
import { TradeStream } from "../src/stream.ts";
import { FakeBroker, FakeBot, liquidatorFor, settings } from "./helpers.ts";
import { D } from "./rig.ts";

test("item 3: the backoff helper waits first, then twice as long each time, at most its cap, and a success resets it", () => {
  const b = new RetryBackoff(5_000, 30_000);
  assert.ok(b.due(0));
  assert.deepEqual([b.failed(0), b.failed(5_000), b.failed(15_000), b.failed(35_000), b.failed(65_000)], [5_000, 10_000, 20_000, 30_000, 30_000]);
  assert.ok(!b.due(94_999) && b.due(95_000));
  b.succeeded();
  assert.ok(b.due(95_000));
  assert.equal(b.failed(95_000), 5_000);
});

test("item 3: the close-out and mid-day retry gaps grow (20 s, 40 s, then 60 s) and stay capped", () => {
  assert.deepEqual([1, 2, 3, 4, 9].map((n) => retryGapMs(20_000, n)), [20_000, 40_000, 60_000, 60_000, 60_000]);
  assert.deepEqual([1, 2, 3, 4].map((n) => retryGapMs(5 * 60_000, n, 15 * 60_000)), [300_000, 600_000, 900_000, 900_000]);
});

test("item 3: when the command cursor cannot be written, the same command is not run again on the next pass (the read stays every pass)", async () => {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const bot = new FakeBot();
  const proc = new CommandProcessor({ settings, store, broker, bot, liquidator: liquidatorFor(broker, async () => true, () => new Date()), now: () => new Date("2026-11-02T12:30:00Z"), sessions: new NextSessionFinder(broker) });
  await ensureDay({ store, broker }, D);
  await proc.poll(); // first run sets the cursor
  bot.say("status", new Date("2026-11-02T12:31:00Z"));
  const realSet = store.setControl.bind(store);
  store.setControl = async (key: string, value: unknown) => {
    if (key === CONTROL_COMMAND_CURSOR) throw new Error("database down (test)");
    return realSet(key, value);
  };
  await assert.rejects(proc.poll());
  const after1 = bot.posts.length;
  assert.ok(after1 > 0, "the command was handled once");
  await assert.rejects(proc.poll()).catch(() => undefined);
  await proc.poll().catch(() => undefined);
  assert.equal(bot.posts.length, after1, "not handled again while the cursor cannot be written");
});

test("item 3: background closes that cannot be written are tried again on a backoff (2 s doubling to 30), not on every pass", async () => {
  let now = 0;
  const inner = new MemoryStore();
  const s = new CachingStore(inner, () => now);
  await inner.insertOrder({ clientOrderId: "c1", tradeDate: D, symbol: "AAA", qty: 1, referencePrice: 10, stopPrice: 9.9, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: 10, note: null });
  await s.listOrders(D);
  let writes = 0;
  const realUpdate = inner.updateOrder.bind(inner);
  inner.updateOrder = async (id: string, patch: any) => {
    writes++;
    throw new Error("database down (test)");
    return realUpdate(id, patch);
  };
  await s.updateOrderSoon("c1", { closedAt: new Date(0).toISOString() });
  const times: number[] = [];
  for (now = 0; now <= 60_000; now += 1_000) {
    const before = writes;
    await s.retrySoonWrites();
    if (writes > before) times.push(now);
  }
  assert.deepEqual(times, [0, 2_000, 6_000, 14_000, 30_000, 60_000], `tries at ${times.join(", ")}`);
});

test("item 3: a price stream that drops right after it is accepted keeps growing its reconnect wait (it reset on every subscribe before)", () => {
  const timers: number[] = [];
  const sockets: any[] = [];
  const make = () => {
    const ws: any = { send: () => undefined, close: () => undefined, onopen: null, onmessage: null, onclose: null, onerror: null };
    sockets.push(ws);
    return ws;
  };
  const st = new TradeStream(settings, ["AAA"], () => undefined, () => undefined, { makeSocket: make, setTimer: (fn, ms) => (timers.push(ms), fn()) });
  const realConnect = (st as any).connect.bind(st);
  let drops = 0;
  (st as any).connect = () => {
    if (drops++ >= 5) return;
    realConnect();
    const ws = sockets.at(-1);
    ws.onmessage?.({ data: JSON.stringify([{ T: "subscription" }]) }); // accepted
    ws.onclose?.({}); // and dropped at once
  };
  (st as any).connect();
  assert.deepEqual(timers.slice(0, 5), [2_000, 4_000, 8_000, 16_000, 30_000], `waits ${timers.join(", ")}`);
});

test("item 3 (group 2, round 2 of the weekend build): with the database down until 70 minutes after the close, the close-out phase is still written once it is back (no hard end), so the summary can follow", async () => {
  const { rig } = await import("./rig.ts");
  const r = rig();
  await r.at("13:30:00");
  r.broker.clock = { ...r.broker.clock, isOpen: true };
  r.broker.positions = [];
  const realUpdate = r.store.updateDay.bind(r.store);
  let down = true;
  r.store.updateDay = async (date: string, patch: any) => {
    if (down && patch?.phases?.closeout) throw new Error("database down (test)");
    return realUpdate(date, patch);
  };
  for (const t of ["20:55:00", "21:00:00", "21:05:00", "21:15:00", "21:30:00", "21:45:00", "22:00:00"]) await r.at(t);
  assert.equal((await r.store.getDay(D))!.phases.closeout, undefined, "not written while the database is down");
  down = false;
  for (const t of ["22:10:00", "22:20:00", "22:30:00", "22:40:00", "22:50:00"]) await r.at(t);
  assert.ok((await r.store.getDay(D))!.phases.closeout, "written once the database is back, more than an hour after the close");
});

test("item 3 (group 1, round 2 of the weekend build): a close-out retry's wait grows only while tries sell nothing, and is back to 20 s after a try that sold", () => {
  const g = new ProgressGap();
  g.started(Infinity); // the first try
  assert.equal(g.gapMs(20_000, 60_000, 40), 20_000, "after the first try");
  g.started(40);
  assert.equal(g.gapMs(20_000, 60_000, 30), 20_000, "it sold 10: back to 20 s");
  g.started(30);
  assert.equal(g.gapMs(20_000, 60_000, 30), 20_000, "nothing sold once");
  g.started(30);
  assert.equal(g.gapMs(20_000, 60_000, 30), 40_000, "nothing sold twice");
  g.started(30);
  assert.equal(g.gapMs(20_000, 60_000, 30), 60_000, "at most a minute");
  g.started(30);
  assert.equal(g.gapMs(20_000, 60_000, 20), 20_000, "sold again: 20 s");
});

for (const accept of ["20:59:10", "20:59:30"]) {
  test(`item 3 (group 1, round 2 of the weekend build): a close-out whose sales Alpaca accepts only from ${accept} UTC still gets flat before the close (tries every 20 s in the last minute)`, async () => {
    const { rig } = await import("./rig.ts");
    const r = rig();
    await r.at("13:30:00");
    r.broker.clock = { ...r.broker.clock, isOpen: true };
    r.broker.positions = [{ symbol: "AAA", qty: 5, marketValue: 500, avgEntryPrice: 100, unrealizedPl: 0 }];
    await r.store.insertOrder({ clientOrderId: "cyrus-20261102-AAA-1", tradeDate: D, symbol: "AAA", qty: 5, referencePrice: 100, stopPrice: 98.5, status: "submitted", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null });
    let works = false;
    r.broker.onSell = async () => { if (!works) throw new Error("rejected (test)"); };
    const acceptMs = new Date(`2026-11-02T${accept}Z`).getTime();
    for (let t = new Date("2026-11-02T20:55:00Z").getTime(); t < new Date("2026-11-02T21:00:00Z").getTime(); t += 5_000) {
      works = t >= acceptMs;
      await r.at(new Date(t).toISOString());
    }
    assert.ok((await r.store.getDay(D))!.phases.closeout, "flat (recorded) before the close");
  });
}
