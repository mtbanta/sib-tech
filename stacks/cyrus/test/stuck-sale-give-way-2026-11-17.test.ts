// Michael's ruling of 2026-11-17 (morning): "while a stuck sale is waiting for room, new entries give way (the governor holds entries back) so
// Alpaca's room goes to the sale". A stuck sale refused because Alpaca's remaining requests are short of its floor holds new entries back
// until the earlier of the moment that shortfall ends and its next look, plus half a second; a refusal for the budgeted minute alone holds
// nothing, and a sale short on both holds entries only for the floor's part (group 2, round 1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { RequestBudget, Reservation, STUCK_SALE_GIVE_WAY, STUCK_SALE_GIVE_WAY_MARGIN_MS, type Refusal } from "../src/request-budget.ts";
import { Governor } from "../src/governor.ts";
import { OrderGate } from "../src/gate.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { ensureDay } from "../src/morning.ts";
import { MemoryStore } from "../src/store.ts";
import { SimBroker } from "./sim-broker.ts";
import { FakeBroker } from "./helpers.ts";
import { rig, D, z } from "./rig.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import type { Signal } from "../src/strategy.ts";

const REFILL_MS_PER_REQUEST = 300; // Alpaca's 200 a minute
// A budget and a governor on one clock; `coupled`: the budget reads the governor's estimate of Alpaca's remaining, as main.ts wires it.
function world(remaining: number, coupled = false) {
  const box = { now: 1_000_000, remaining };
  const governor = new Governor(() => box.now);
  const setRemaining = (n: number) => {
    box.remaining = n;
    governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: n, reset: null });
  };
  const budget = new RequestBudget({ now: () => box.now, remaining: coupled ? () => governor.budget() : () => box.remaining });
  governor.setSafetyHold(budget);
  if (coupled) setRemaining(remaining);
  return { box, budget, governor, setRemaining };
}
const stuckTry = (b: RequestBudget) => b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: 45 });

test("a stuck sale refused for Alpaca's room holds new entries back until its floor's shortfall ends (before its next look), with its own refusal text and counts", () => {
  const w = world(25); // 25 - 10 = 15 left, 5 short of the floor of 20: room in about 1.5 s at Alpaca's refill
  const r = stuckTry(w.budget) as Refusal;
  assert.equal(r.ok, false);
  assert.equal(r.floorShort, true);
  assert.equal(r.floorAt, w.box.now + 5 * REFILL_MS_PER_REQUEST);
  assert.equal(w.governor.admitTrade(150, 150).ok, true, "nothing is held before the sale says it waits");
  w.budget.noteStuckSaleWaiting(r, w.box.now + 4_000, "stuck retry");
  const refused = w.governor.admitTrade(150, 150) as { ok: false; reason: string };
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "holding back for safety: a stuck sale is waiting for Alpaca's request room");
  w.box.now = r.floorAt! + STUCK_SALE_GIVE_WAY_MARGIN_MS - 1;
  assert.equal(w.budget.givingWay(), true, "still held just before the floor's return plus the margin");
  w.box.now += 1;
  assert.equal(w.budget.givingWay(), false, "ends on its own, before the 4 s look");
  assert.equal(w.governor.admitTrade(150, 150).ok, true);
  const m = w.budget.takeMinute();
  assert.equal(m.stuckSaleHolds, 1);
  assert.equal(m.stuckSaleEntriesRefused, 1);
  assert.equal(m.givingWayRefusals, 1, "also counted with the other give-way refusals");
});

test("a next look sooner than the floor's return ends the hold at that look plus the margin (renewed only if refused again)", () => {
  const w = world(5); // 5 - 10 = -5: 25 short, room in 7.5 s
  const r = stuckTry(w.budget) as Refusal;
  w.budget.noteStuckSaleWaiting(r, w.box.now + 2_000, "stuck retry");
  w.box.now += 2_000 + STUCK_SALE_GIVE_WAY_MARGIN_MS - 1;
  assert.equal(w.budget.givingWay(), true);
  w.box.now += 1;
  assert.equal(w.budget.givingWay(), false);
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

test("group 2, round 1: a stuck sale short on both the budgeted minute (about 40 s) and Alpaca's room (1.5 s) holds entries only for the floor's part", () => {
  const w = world(200);
  for (let i = 0; i < 4; i++) {
    const g = stuckTry(w.budget) as Reservation;
    for (let k = 0; k < 10; k++) g.charge("/v2/orders");
    g.end();
    w.box.now += 5_001;
  }
  w.box.remaining = 25;
  const r = stuckTry(w.budget) as Refusal;
  assert.equal(r.why, "class", "the minute's ceiling is the first reason");
  assert.equal(r.floorShort, true);
  assert.ok(r.at - w.box.now > 30_000, `the minute frees in ${r.at - w.box.now} ms`);
  w.budget.noteStuckSaleWaiting(r, r.at, "stuck retry");
  w.box.now = r.floorAt! + STUCK_SALE_GIVE_WAY_MARGIN_MS;
  assert.equal(w.budget.givingWay(), false, "not held until the minute frees");
});

test("each further refusal on the floor renews the hold; a later end wins, an earlier one never shortens it", () => {
  const w = world(5);
  w.budget.noteStuckSaleWaiting(stuckTry(w.budget) as Refusal, w.box.now + 2_000, "stuck retry");
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

test("coupled as in main.ts: at 25 left the reserve of 80 already refuses entries first, so the hold is set but no entry is refused for it", () => {
  const w = world(25, true);
  const r = stuckTry(w.budget) as Refusal;
  assert.equal(r.floorShort, true);
  w.budget.noteStuckSaleWaiting(r, w.box.now + 4_000, "stuck retry");
  assert.equal(w.budget.givingWay(), true);
  const a = w.governor.admitTrade(150, 150) as { ok: false; reason: string };
  assert.equal(a.ok, false);
  assert.match(a.reason, /^holding back for safety: Alpaca's request budget is down to/);
  const m = w.budget.takeMinute();
  assert.deepEqual([m.stuckSaleHolds, m.stuckSaleEntriesRefused, m.givingWayRefusals], [1, 0, 0]);
});

test("the worker's local room check for a stuck sale renews the hold; for other work it does not", async () => {
  for (const stuckSale of [true, false]) {
    const r = rig();
    r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: 25, reset: null });
    const wk: any = r.worker;
    const roomAt = wk.loop.d.roomAt as (need: any) => number | null;
    const at = roomAt({ cls: "P1", n: 10, reads: 2, minuteCap: 45, ...(stuckSale ? { stuckSale: true } : {}) });
    assert.ok(typeof at === "number", "no room");
    assert.equal(wk.budget.givingWay(), stuckSale, stuckSale ? "a stuck sale's check: entries give way" : "another need: nothing held");
  }
});

test("the order sync: a stuck retry refused for Alpaca's room makes entries give way; with room it does not", async () => {
  const { syncOrders, SyncMemory } = await import("../src/risk.ts");
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
  const acts: string[] = [];
  const loop = { busy: () => false, act: async (_id: string, label: string) => void acts.push(label), wake: () => undefined };
  const sync = () => syncOrders({ broker: sim, store, now, say: async () => true, liquidator, syncMemory: mem } as any, dd, { protect: true, loop } as any);
  mem.stuck.set(id, { symbol: "AAA", since: sim.simMs - 60_000, nextAt: sim.simMs - 1, delayMs: 0, alerted: true, escalated: false, lastTriedAt: sim.simMs - 5_000, why: "x" } as any);
  await sync();
  assert.equal(acts.length, 0, "no room: no try");
  assert.equal(budget.givingWay(), true, "entries give way while the stuck sale waits for Alpaca's room");
  sim.advance(10_000);
  assert.equal(budget.givingWay(), false, "and it ends on its own");
  box.remaining = 200;
  await sync();
  assert.equal(budget.givingWay(), false, "with room the retry is decided and nothing is held");
  assert.equal(acts.length, 1);
});

test("the gate: entries refused for a stuck sale land as one counted (many) row with the new text", async () => {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  let now = z("15:00:00");
  const governor = new Governor(() => now.getTime());
  governor.setSafetyHold({ givingWay: () => true, givingWayReason: () => "stuck sale", noteGiveWayRefusal: () => undefined });
  const view = new BrokerView(broker, () => now.getTime());
  const say = async () => true;
  const liquidator = new Liquidator({ broker, gate: new SellGate({ broker, say: say as any }), now: () => now, sleep: async () => undefined });
  await ensureDay({ broker, store, now: () => now, say: say as any, liquidator } as any, D);
  await store.updateDay(D, { status: "approved", limits: { maxPositionUsd: 300, dailyLossStopUsd: 500, maxTradesPerMinute: 20, borrowingCap: 1 }, decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z" } } as any);
  const gate = new OrderGate({ broker, store, view, governor, now: () => now, say: say as any, note: () => undefined });
  const sig = (symbol: string): Signal => ({ symbol, price: 20, tradeTime: new Date(now.getTime() - 300), stopPrice: 19.8, takeProfitPrice: 20.2 });
  for (const s of ["AAA", "BBB", "CCC"]) {
    const r = (await gate.enter(sig(s))) as { status: string; reason?: string };
    assert.equal(r.status, "refused");
    assert.equal(r.reason, "holding back for safety: a stuck sale is waiting for Alpaca's request room");
  }
  await gate.flush();
  const rows = (await store.listRefusals(D)).filter((x) => x.reason.includes("a stuck sale is waiting"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.symbol, "(many)");
  assert.equal((rows[0]!.detail as { count: number }).count, 3);
  assert.equal(broker.calls.filter((c) => c.fn === "submitEntry").length, 0, "nothing sent");
});
