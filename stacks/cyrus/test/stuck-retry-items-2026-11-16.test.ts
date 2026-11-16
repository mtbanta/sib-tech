// The speed release of 2026-11-16, item 3c (Michael's ruling 5: "Item 3c: all four stuck-retry items"; builds/c2-proposal-stuck-retry-cost.md,
// items 1 to 4). Item 4: the low-priority hold ends as soon as the stuck retry it was set for gets in (or its stuck record resolves), and
// with several retries waiting, one getting in keeps the hold for the others.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { STUCK_RETRY_MINUTE_CAP, SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { RequestBudget, Reservation } from "../src/request-budget.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const CAP = STUCK_RETRY_MINUTE_CAP;

// P2 sends `n` requests, one a second from `fromMs`, outside the 5 seconds by the time the test looks.
function p2Minute(b: RequestBudget, clock: { t: number }, n: number, fromMs = 0): void {
  for (let i = 0; i < n; i++) {
    clock.t = fromMs + i * 1_000;
    const r = b.tryReserve("P2", 1, { label: "list lag recheck", fiveSec: false }) as Reservation;
    assert.ok(r instanceof Reservation, `P2 ${i} granted`);
    r.charge("/v2/test");
    r.end();
  }
}

// ---------------- item 4: the hold ends when its retry gets in ----------------

test("item 4: a stuck retry that gets in ends the hold at once (P2 has its 40 back), and the hold's time in force stops then", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p2Minute(b, clock, 34);
  clock.t = 40_000;
  // P2 takes 4 more in the minute: 38 of 60, so a stuck retry of 10 under its 45 does not fit.
  const more = b.tryReserve("P2", 4, { label: "list lag recheck", fiveSec: false }) as Reservation;
  for (let i = 0; i < 4; i++) more.charge("/v2/test");
  more.end();
  b.takeMinute();
  const refused = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "A" });
  assert.ok(!(refused instanceof Reservation) && refused.why === "class");
  assert.ok(b.retryWaitUntil > clock.t, "the hold is set for A");
  assert.ok(!b.roomFor("P2", 1, false).ok, "P2 held at 35 while A waits (38 used)");
  // Room returns for A: P2's requests sent at 0, 1 and 2 s leave the minute (35 used).
  clock.t = 62_000;
  assert.equal(b.inUse().minute, 35);
  const holdEndBefore = b.retryWaitUntil;
  assert.ok(holdEndBefore > clock.t, "the hold would still run (until A's next look plus 0.5 s, at least 2.5 s)");
  const granted = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "A" });
  assert.ok(granted instanceof Reservation, "A gets in");
  assert.ok(b.retryWaitUntil <= clock.t, "the hold ended the moment A got in");
  (granted as Reservation).end();
  assert.ok(b.roomFor("P2", 5, false).ok, "P2 may take its share up to 40 again at once (35 + 5)");
  clock.t = holdEndBefore + 10_000;
  const m = b.takeMinute().retryHold;
  assert.equal(m.inForceMs, 62_000 - 40_000, "time in force counted up to A's grant, not to the old end");
});

test("item 4: with two stuck retries waiting, one getting in keeps the hold for the other; the hold ends when the other's record resolves", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p2Minute(b, clock, 38);
  clock.t = 40_000;
  const a = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "A" });
  const bb = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "B" });
  assert.ok(!(a instanceof Reservation) && !(bb instanceof Reservation), "both kept out by P2's 38");
  clock.t = 62_000; // 35 used: room for one retry of 10 under 45
  const ga = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "A" });
  assert.ok(ga instanceof Reservation, "A gets in");
  (ga as Reservation).end(); // sent nothing: 35 used
  assert.ok(b.retryWaitUntil > clock.t, "B still waits, so the hold goes on");
  assert.ok(!b.roomFor("P2", 1, false).ok, "P2 still held at 35 for B");
  b.forgetRetry("B"); // B's stuck record resolved (risk.ts resolveStuck)
  assert.ok(b.retryWaitUntil <= clock.t, "no retry waits: the hold is over");
  assert.ok(b.roomFor("P2", 5, false).ok, "P2 has its share again");
});

test("item 4: a look that finds room does not end the hold (only a grant does)", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p2Minute(b, clock, 38);
  clock.t = 40_000;
  assert.ok(!b.roomFor("P1", 10, true, 0, CAP, "A").ok);
  clock.t = 62_000;
  assert.ok(b.roomFor("P1", 10, true, 0, CAP, "A").ok, "A's look finds room");
  assert.ok(b.retryWaitUntil > clock.t, "the hold stays until A's try is granted");
  assert.ok(!b.roomFor("P2", 1, false).ok, "so P2 cannot take A's room between its look and its try");
});

test("item 4: a stuck record that resolves ends its retry's hold (resolveStuck calls the budget's forgetRetry)", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  memory.budget = new RequestBudget({ now: () => sim.simMs, remaining: () => 200 });
  const risk: any = { broker: sim, store, now, say, liquidator, syncMemory: memory, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  await ensureDay({ store, broker: sim, now } as any, D);
  const dd = (await store.getDay(D))!;
  const id = clientOrderIdFor(D, "IONQ", 7);
  await sim.submitEntry({ symbol: "IONQ", qty: 2, stopPrice: 33, takeProfitPrice: 34.5, referencePrice: 33.88, clientOrderId: id });
  sim.fillEntry(id, 33.88);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "IONQ", qty: 2, referencePrice: 33.88, stopPrice: 33, takeProfitPrice: 34.5, status: "filled", alpacaOrderId: null, filledQty: 2, filledAvgPrice: 33.88, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(20_000);
  memory.stuck.set(id, { symbol: "IONQ", since: sim.simMs - 60_000, nextAt: sim.simMs + 60_000, delayMs: 0, alerted: true, escalated: false, lastTriedAt: sim.simMs, why: "x" } as any);
  const forgotten: string[] = [];
  const real = memory.budget.forgetRetry.bind(memory.budget);
  memory.budget.forgetRetry = (k: string) => (forgotten.push(k), real(k));
  await sim.submitSell({ symbol: "IONQ", qty: 2, clientOrderId: "elsewhere-1" } as any); // the shares leave
  sim.advance(3_000);
  await syncOrders(risk, dd, { protect: true });
  assert.ok(!memory.stuck.has(id), "resolved");
  assert.ok(forgotten.includes(id), "its key was forgotten by the budget");
});
