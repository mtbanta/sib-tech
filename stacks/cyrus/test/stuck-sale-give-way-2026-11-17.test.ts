// Michael's ruling of 2026-11-17 (morning): "while a stuck sale is waiting for room, new entries give way (the governor holds entries back) so
// Alpaca's room goes to the sale". A stuck sale refused because Alpaca's remaining requests are short of its floor holds new entries back
// until its next look plus half a second; a refusal for the budgeted minute alone holds nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RequestBudget, Reservation, STUCK_SALE_GIVE_WAY, STUCK_SALE_GIVE_WAY_MARGIN_MS, type Refusal } from "../src/request-budget.ts";
import { Governor } from "../src/governor.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";
import { clientOrderIdFor } from "../src/gate.ts";

function world(remaining = 200) {
  const box = { now: 1_000_000, remaining };
  const budget = new RequestBudget({ now: () => box.now, remaining: () => box.remaining });
  const governor = new Governor(() => box.now);
  governor.setSafetyHold(budget);
  return { box, budget, governor };
}
const stuckTry = (b: RequestBudget) => b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: 45 });

test("a stuck sale refused for Alpaca's room holds new entries back until its next look plus half a second, with its own refusal text", () => {
  const w = world(25); // 25 left: 25 - 10 < 20, the floor
  const r = stuckTry(w.budget) as Refusal;
  assert.equal(r.ok, false);
  assert.equal(r.floorShort, true);
  assert.equal(w.governor.admitTrade(150, 150).ok, true, "nothing is held before the sale says it waits");
  w.budget.noteStuckSaleWaiting(r, w.box.now + 4_000, "stuck retry");
  const refused = w.governor.admitTrade(150, 150) as { ok: false; reason: string };
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "holding back for safety: a stuck sale is waiting for Alpaca's request room");
  w.box.now += 4_000 + STUCK_SALE_GIVE_WAY_MARGIN_MS - 1;
  assert.equal(w.budget.givingWay(), true, "still held just before its next look plus the margin");
  w.box.now += 1;
  assert.equal(w.budget.givingWay(), false, "ends on its own");
  assert.equal(w.governor.admitTrade(150, 150).ok, true);
  const m = w.budget.takeMinute();
  assert.equal(m.stuckSaleHolds, 1);
  assert.equal(m.stuckSaleEntriesRefused, 1);
  assert.equal(m.givingWayRefusals, 1, "also counted with the other give-way refusals");
});

test("a stuck sale refused only for the budgeted minute holds nothing (entries do not use the budgeted minute)", () => {
  const w = world(200);
  for (let i = 0; i < 4; i++) {
    const g = stuckTry(w.budget);
    assert.ok(g instanceof Reservation);
    for (let k = 0; k < 10; k++) g.charge("/v2/orders");
    g.end();
    w.box.now += 5_001; // past the 5 seconds' 15
  }
  const r = stuckTry(w.budget) as Refusal; // 40 sent + 10 > 45
  assert.equal(r.ok, false);
  assert.notEqual(r.floorShort, true);
  w.budget.noteStuckSaleWaiting(r, w.box.now + 4_000, "stuck retry");
  assert.equal(w.budget.givingWay(), false);
  assert.equal(w.governor.admitTrade(150, 150).ok, true);
});

test("each further refusal on the floor renews the hold; the later look wins, an earlier one never shortens it", () => {
  const w = world(25);
  const r = stuckTry(w.budget) as Refusal;
  w.budget.noteStuckSaleWaiting(r, w.box.now + 2_000, "stuck retry");
  w.box.now += 1_500;
  w.budget.noteStuckSaleWaiting(stuckTry(w.budget) as Refusal, w.box.now + 3_000, "stuck retry");
  w.budget.noteStuckSaleWaiting(stuckTry(w.budget) as Refusal, w.box.now + 500, "stuck retry");
  w.box.now += 3_000 + STUCK_SALE_GIVE_WAY_MARGIN_MS - 1;
  assert.equal(w.budget.givingWay(), true);
  w.box.now += 1;
  assert.equal(w.budget.givingWay(), false);
  assert.equal(w.budget.takeMinute().stuckSaleHolds, 1, "one spell");
});

test("switched off, a stuck sale waiting for room holds nothing", () => {
  STUCK_SALE_GIVE_WAY.on = false;
  try {
    const w = world(25);
    w.budget.noteStuckSaleWaiting(stuckTry(w.budget) as Refusal, w.box.now + 4_000, "stuck retry");
    assert.equal(w.budget.givingWay(), false);
    assert.equal(w.governor.admitTrade(150, 150).ok, true);
  } finally {
    STUCK_SALE_GIVE_WAY.on = true;
  }
});

test("the order sync: a stuck retry refused for Alpaca's room makes entries give way; with room it does not", async () => {
  const { syncOrders, SyncMemory } = await import("../src/risk.ts");
  const { Liquidator, SellGate } = await import("../src/sells.ts");
  const { MemoryStore } = await import("../src/store.ts");
  const { ensureDay } = await import("../src/morning.ts");
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  await ensureDay({ store, broker: sim, now } as any, D);
  const dd = (await store.getDay(D))!;
  const id = clientOrderIdFor(D, "AAA", 1);
  await sim.submitEntry({ symbol: "AAA", qty: 5, stopPrice: 9.87, takeProfitPrice: 10.08, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "AAA", qty: 5, referencePrice: 10, stopPrice: 9.87, takeProfitPrice: 10.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  for (const l of sim.orders.find((o) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(20_000);
  const mem = new SyncMemory();
  const box = { remaining: 25 };
  const budget = new RequestBudget({ now: () => sim.simMs, remaining: () => box.remaining });
  mem.budget = budget;
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now, sleep: sim.sleep });
  const wakes: Array<{ at: number; room?: any }> = [];
  const acts: string[] = [];
  const loop = { busy: () => false, act: async (_id: string, label: string) => void acts.push(label), wake: (_id: string, at: number, _k: string, extra: any = {}) => void wakes.push({ at, room: extra.room }) };
  const sync = () => syncOrders({ broker: sim, store, now, say: async () => true, liquidator, syncMemory: mem } as any, dd, { protect: true, loop } as any);
  mem.stuck.set(id, { symbol: "AAA", since: sim.simMs - 60_000, nextAt: sim.simMs - 1, delayMs: 0, alerted: true, escalated: false, lastTriedAt: sim.simMs - 5_000, why: "x" } as any);
  await sync();
  assert.equal(acts.length, 0, "no room: no try");
  assert.equal(budget.givingWay(), true, "entries give way while the stuck sale waits for Alpaca's room");
  const until = mem.stuck.get(id)!.nextAt + STUCK_SALE_GIVE_WAY_MARGIN_MS;
  sim.advance(until - sim.simMs);
  assert.equal(budget.givingWay(), false, "until its next look plus the margin");
  box.remaining = 200;
  await sync();
  assert.equal(budget.givingWay(), false, "with room the retry is decided and nothing is held");
  assert.equal(acts.length, 1);
});
