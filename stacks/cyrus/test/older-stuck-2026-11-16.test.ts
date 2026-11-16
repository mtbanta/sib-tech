// Michael's answer of 2026-11-16 on the speed release, 3 (a): "when budget room frees up, also look up waiting positions older than 10
// minutes". With the live order updates connected the order sync lists only the last 10 minutes and looks older entries up about every 30 s;
// a look the protection loop made for an older stuck entry's room wake skipped it, so with steady low-priority demand its retry rarely ran
// (on 79f52ec 4 of 5 such positions got no retry in 10 minutes, and while busy often none of the 5). Now that look looks the entry up (one
// routine request, at most every 2 s per entry). And such an entry keeps its place among the stuck retries while it waits for room.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Reservation, RequestBudget, withReservation } from "../src/request-budget.ts";
import { ROOM_LOOKUP_GAP_MS, STUCK_RETRY_MINUTE_CAP, SyncMemory, syncOrders } from "../src/risk.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle } from "./rig.ts";
import { FakeBot } from "./helpers.ts";

const iso = (ms: number) => new Date(ms).toISOString();

// The worker, live updates connected, Alpaca's remaining fed to the governor. `old` positions are opened at 14:44 (older than the 10 minute
// list window by 15:00), `young` at 15:00; at 15:00:01 every one loses its exits and Alpaca keeps holding its shares (reported not free, no
// open order to explain it). Steady low-priority demand: a P2 try of 3 requests asked every half second. `busy`: the governor counts 150
// requests a minute the budget did not send, so the budgeted minute stays 60. Returns each position's retries in `minutes`.
async function olderWorld(o: { old: number; young: number; minutes: number; busy: boolean }) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const holds: Array<{ until: number; res: () => void }> = [];
  let timed = false;
  const tsleep = (ms: number): Promise<void> => (timed ? new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res })) : sim.sleep(ms));
  const r: any = rig<SimBroker>({ broker: sim, sleep: tsleep, simClock: sim, bot, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const wk: any = r.worker;
  const prev = sim.onRate;
  sim.onRate = (k: number) => {
    r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: k, reset: null });
    prev?.(k);
  };
  if (o.busy) {
    const realStats = r.governor.stats.bind(r.governor);
    r.governor.stats = () => ({ ...realStats(), requestsLastMinute: wk.budget.inUse().minute + 150 });
  }
  const syms = Array.from({ length: o.old + o.young }, (_, i) => "QX" + String.fromCharCode(65 + i));
  const open = async (s: string) => {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: s, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  };
  await r.at("14:44:00");
  for (const s of syms.slice(0, o.old)) await open(s);
  await r.at("15:00:00");
  for (const s of syms.slice(o.old)) await open(s);
  await r.at("15:00:01");
  for (const s of syms) for (const l of sim.orders.find((x: any) => x.clientOrderId === clientOrderIdFor(D, s, 1))!.legs) await sim.cancelOrder(l.id);
  for (const s of syms) sim.staleHeld.set(s, 5);
  const tries = new Map<string, number>();
  const liq: any = wk.liquidator;
  const realRun = liq.run.bind(liq);
  liq.run = (x: any) => {
    if (x.ownEntryOnly && x.only?.length === 1) tries.set(x.only[0], (tries.get(x.only[0]) ?? 0) + 1);
    return realRun(x);
  };
  timed = true;
  const r429 = sim.rejected429;
  const start = sim.simMs;
  let nextPass = start + 5_000;
  let nextTimed = start + 1_000;
  let nextP2 = start + 500;
  while (sim.simMs < start + o.minutes * 60_000) {
    if (sim.simMs >= nextPass) {
      void r.at(iso(sim.simMs));
      nextPass += 5_000;
    } else r.setNow(iso(sim.simMs + 100));
    if (sim.simMs >= nextTimed) {
      nextTimed += 1_000;
      void wk.timedTick();
    }
    if (sim.simMs >= nextP2) {
      nextP2 += 500;
      const res = wk.budget.tryReserve("P2", 3, { label: "test low-priority load" });
      if (res instanceof Reservation)
        void withReservation(res, async () => {
          for (let i = 0; i < 3; i++) await sim.listPositions();
        }).catch(() => undefined);
    }
    for (const h of holds.filter((h) => h.until <= sim.simMs)) {
      holds.splice(holds.indexOf(h), 1);
      h.res();
    }
    await settle();
  }
  timed = false;
  for (const h of holds.splice(0)) h.res();
  wk.stop?.();
  return { retries: syms.map((s) => Math.max(0, (tries.get(s) ?? 0) - 1)), rateLimited: sim.rejected429 - r429 };
}

// v24 (20ba5bd) on the same shape: mostly 2 retries each in 10 minutes (one seed of six starved 4 of the 5). 79f52ec: 4 of 5 with none,
// or all 5 with none while busy.
for (const busy of [false, true]) {
  test(`older positions (3 (a)): 5 positions older than the list window, steady low-priority demand, ${busy ? "busy" : "quiet"}: each is retried at least twice in 10 minutes, no rate-limit answer`, async () => {
    const w = await olderWorld({ old: 5, young: 0, minutes: 10, busy });
    assert.equal(w.rateLimited, 0);
    assert.ok(w.retries.every((n) => n >= 2), `retries per position: ${w.retries.join(", ")}`);
  });
}

// An older stuck position at the head of the waiting list with younger ones behind it: the younger ones are not held off by its turn, and
// it is retried too (79f52ec: 0 to 2 retries for the older one in 10 minutes).
test("older positions (3 (a)): an older stuck position with 3 younger ones: the younger are not held off, and the older is retried too", async () => {
  const w = await olderWorld({ old: 1, young: 3, minutes: 10, busy: true });
  assert.equal(w.rateLimited, 0);
  assert.ok(w.retries[0]! >= 4, `the older one: ${w.retries[0]} retries`);
  assert.ok(w.retries.slice(1).every((n) => n >= 10), `the younger ones: ${w.retries.slice(1).join(", ")}`);
});

// The turn list: a retry told to look again much later (it waits for the minute) keeps its place though not seen meanwhile; a retry that
// vanished leaves the list 10 s after the time it was told to look again (79f52ec dropped any key unseen for 10 s).
test("older positions: a stuck retry waiting a long time for room keeps its place in the turn list; a vanished one still leaves it", () => {
  let t = 0;
  const b: any = new RequestBudget({ now: () => t });
  for (let i = 0; i < 40; i++) {
    t = i * 1_000;
    const r = b.tryReserve("P1", 1, { label: "urgent", fiveSec: false }) as Reservation;
    r.charge("/v2/test");
    r.end();
  }
  t = 41_000;
  const a = b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP, "OLD"); // waits for the minute: told to look again in about 24 s
  assert.ok(!a.ok && a.at - t > 20_000);
  t = 41_500;
  assert.ok(!b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP, "YOUNG").ok);
  assert.deepEqual(b.waitingRetries(), ["OLD", "YOUNG"]);
  t = 60_000; // OLD unseen for 19 s, but its look is not due before about 65 s
  b.seenRetry("YOUNG");
  assert.deepEqual(b.waitingRetries(), ["OLD", "YOUNG"], "OLD keeps its place");
  t = a.at; // OLD looks at its time: it gets the room, YOUNG waits its turn
  assert.ok(b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP, "OLD").ok);
  assert.equal(b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP, "YOUNG").why, "turn");
  // OLD vanishes (never looks again): it leaves the list 10 s after the time it was told to look again.
  const told = t;
  t = told + 10_001;
  b.seenRetry("YOUNG");
  b.firstWaitingRetry();
  assert.deepEqual(b.waitingRetries(), ["YOUNG"], "a vanished retry leaves the list");
});

// The sync on its own: a look for an older entry's room wake looks it up (one request) so its retry can run, at most once every 2 s.
test("older positions (3 (a)): a look made for an older entry's room wake looks it up, at most once every 2 s", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  memory.budget = new RequestBudget({ now: () => sim.simMs, remaining: () => 200 });
  const risk: any = { broker: sim, store, now, say, liquidator, syncMemory: memory, onRemainderSold: () => undefined, onFreshStop: () => undefined, streamLive: () => true };
  await ensureDay({ store, broker: sim, now } as any, D);
  const dd = (await store.getDay(D))!;
  const id = clientOrderIdFor(D, "QXA", 1);
  await sim.submitEntry({ symbol: "QXA", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  sim.fillEntry(id, 12);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "QXA", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.staleHeld.set("QXA", 5);
  sim.advance(15 * 60_000); // older than the 10 minute list window
  memory.oldLookedAt.set(id, sim.simMs - 5_000); // its 30 s lookup is not due
  memory.stuck.set(id, { symbol: "QXA", since: sim.simMs - 60_000, nextAt: sim.simMs - 1, delayMs: 0, alerted: true, escalated: false, lastTriedAt: sim.simMs - 3_000, why: "x" } as any);
  const looked: string[] = [];
  const realFind = sim.findOrderByClientId.bind(sim);
  (sim as any).findOrderByClientId = async (cid: string) => (looked.push(cid), realFind(cid));
  const tried: number[] = [];
  const realRun = (liquidator as any).run.bind(liquidator);
  (liquidator as any).run = (x: any) => (tried.push(sim.simMs), realRun(x));
  const loop = { busy: () => false, act: async (_id: string, _l: string, run: () => Promise<any>) => void (await run()), wake: () => undefined };
  // A look without the room wake: the entry is not looked up, so it is not walked and not tried.
  await syncOrders(risk, dd, { protect: true, streamLive: true, loop, only: new Set([id]) } as any);
  assert.equal(tried.length, 0, "a plain look skips an older entry whose lookup is not due");
  // A look for its room wake: looked up (once by the sync, once by its try's own lookup), then tried.
  looked.length = 0;
  await syncOrders(risk, dd, { protect: true, streamLive: true, loop, only: new Set([id]), roomLookups: new Set([id]) } as any);
  assert.equal(tried.length, 1, "its retry ran");
  assert.equal(looked.filter((x) => x === id).length, 2, "the sync's lookup and the try's own");
  // Again at once (within 2 s): the sync does not look it up again.
  looked.length = 0;
  memory.stuck.get(id)!.nextAt = sim.simMs - 1;
  sim.advance(ROOM_LOOKUP_GAP_MS - 500);
  memory.stuck.get(id)!.nextAt = sim.simMs - 1;
  await syncOrders(risk, dd, { protect: true, streamLive: true, loop, only: new Set([id]), roomLookups: new Set([id]) } as any);
  assert.equal(looked.length, 0, "not looked up again within 2 s");
});
