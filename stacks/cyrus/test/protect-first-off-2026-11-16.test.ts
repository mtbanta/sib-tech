// Protect-first ships switched off (night build of 2026-11-16; protect-first.ts, PROTECT_FIRST): no entry is refused for it, P2 never
// gives way for it, no mark is kept and no protect_first event is stored. The tests with it switched on are in protect-first-2026-11-16.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROTECT_FIRST, PROTECT_FIRST_PAUSED, PROTECT_FIRST_REDUCED, ProtectFirst } from "../src/protect-first.ts";
import { RequestBudget, Reservation } from "../src/request-budget.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import type { TradeUpdate } from "../src/order-stream.ts";
import { SimBroker } from "./sim-broker.ts";
import { FakeBot, order } from "./helpers.ts";
import { D, rig, settle, z } from "./rig.ts";

test("protect-first is switched off as shipped", () => {
  assert.equal(PROTECT_FIRST.on, false);
});

test("protect-first off: a mark is not kept, no entry is refused, P2 does not give way, nothing is logged", () => {
  const events: string[] = [];
  const pf = new ProtectFirst({ now: () => 0, heldSince: () => null, stuck: new Map([["e9", { symbol: "ZZZ" }]]), freshStops: new Map([["e8", { symbol: "YYY", status: "unclear", stopClientOrderId: "cyrus-p-8" }]]), timedOutStops: new Map(), log: (e) => events.push(e) });
  pf.mark("e1", "AAA", "both exits lost");
  assert.equal(pf.phase(), "off");
  assert.deepEqual(pf.marked(), []);
  assert.equal(pf.entryRefusal(), null);
  assert.equal(pf.entryRefusal(true), null);
  assert.equal(pf.p2GivesWay(), false);
  assert.deepEqual(events, []);
  const b = new RequestBudget({ now: () => 0, remaining: () => 200 });
  b.p2GivesWay = () => pf.p2GivesWay();
  assert.ok(b.tryReserve("P2", 3, { label: "list lag recheck" }) instanceof Reservation);
});

const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null, atMs: number | null = null): TradeUpdate => ({ event, order: order(o), positionQty, atMs });

test("protect-first off, worker: lost exits with a refused sale neither pause entries nor store a protect_first event", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.hideFilledParents = true;
  const events: string[] = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true, bot: new FakeBot(), log: (_l, event) => events.push(event) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("14:59:00").getTime());
  const id = clientOrderIdFor(D, "IREN", 1);
  await sim.submitEntry({ symbol: "IREN", qty: 1, stopPrice: 9.98, takeProfitPrice: 10.01, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "IREN", qty: 1, referencePrice: 10, stopPrice: 9.98, takeProfitPrice: 10.01, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  const o = sim.orders.find((x) => x.clientOrderId === id)!;
  await r.at("15:00:00");
  sim.refuseSellIf = (x) => x.symbol === "IREN";
  await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: "IREN", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 10, groupId: o.groupId }, 1));
  sim.cancelExitsAtFill(id);
  for (const l of o.legs) await r.orderUpdate(upd("canceled", { ...structuredClone(l), status: "canceled", groupId: o.groupId }, null, sim.simMs));
  for (let i = 0; i < 10; i++) await settle();
  await r.at("15:00:03");
  assert.ok(events.includes("exits_lost"), "the loss was seen");
  assert.ok(sim.sellLog.length > 0 || events.includes("unprotected_position"), "and acted on");
  const wk = r.worker as unknown as { protectFirst: ProtectFirst; gate: { enter(s: unknown): Promise<{ status: string; reason?: string }> } };
  assert.equal(wk.protectFirst.phase(), "off");
  const a = await wk.gate.enter({ symbol: "AAA", price: 10, tradeTime: new Date(sim.simMs), stopPrice: 9.9, takeProfitPrice: 10.2 });
  assert.notEqual(a.reason, PROTECT_FIRST_PAUSED);
  assert.notEqual(a.reason, PROTECT_FIRST_REDUCED);
  assert.equal(a.status, "sent", a.reason ?? "");
  assert.ok(!events.some((e) => e.startsWith("protect_first_")), "no protect_first event while off");
  assert.equal(sim.oversellAttempts, 0);
});
