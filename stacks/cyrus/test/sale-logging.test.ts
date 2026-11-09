// Michael's decision of 2026-11-09 (logging only): on 2026-11-09 four positions sat without exits for 16 to 28 minutes because every
// sale attempt found no shares free to sell, and nothing recorded why. These tests check that a blocked sale now says what held the
// shares (Alpaca's held and available quantities, the open sell orders counted), that such an attempt is logged, that the order sync
// logs how old its order list was when it acted, and that none of it adds a request to Alpaca or changes what is sold.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate, openSellOrdersFor, openSellQty } from "../src/sells.ts";
import { SyncMemory, syncOrders } from "../src/risk.ts";
import { shouldStoreEvent } from "../src/run-log.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { order } from "./helpers.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // in the session

function world(opts: { log?: boolean } = {}) {
  const sim = new SimBroker(MID);
  const events: Array<{ event: string; data: any }> = [];
  const log = opts.log === false ? undefined : (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const said: Array<{ ch: string; text: string }> = [];
  const say = async (ch: string, text: string) => (said.push({ ch, text }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, ...(log ? { log } : {}) });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, ...(log ? { log } : {}) });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const risk = { broker: sim, store, now, say, liquidator, syncMemory: new SyncMemory(), ...(log ? { log } : {}) };
  return { sim, events, said, gate, liquidator, store, now, risk };
}

async function hold(w: ReturnType<typeof world>, symbol: string, qty: number, price: number, n = 1) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.06, takeProfitPrice: price + 0.01, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.06, takeProfitPrice: price + 0.01, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}

test("the open sell orders listed for a blocked sale are exactly the ones openSellQty counts, each with its entry's client id", () => {
  const legs = [order({ id: "tp1", symbol: "AAA", side: "sell", qty: 10, type: "limit", status: "new" }), order({ id: "st1", symbol: "AAA", side: "sell", qty: 10, type: "stop", status: "held" })];
  const parent = order({ symbol: "AAA", side: "buy", qty: 10, filledQty: 10, status: "filled", clientOrderId: "cyrus-e1", legs });
  const own = order({ id: "x1", symbol: "AAA", side: "sell", qty: 4, filledQty: 1, status: "partially_filled", clientOrderId: "cyrus-x-1", legs: [] });
  const other = order({ symbol: "BBB", side: "sell", qty: 3, status: "new", legs: [] });
  const listed = openSellOrdersFor([parent, own, other], "AAA");
  assert.deepEqual(listed.map((x) => [x.id, x.clientOrderId, x.status]), [["tp1", "cyrus-e1", "new"], ["st1", "cyrus-e1", "held"], ["x1", "cyrus-x-1", "partially_filled"]]);
  assert.equal(openSellQty([parent, own, other], "AAA"), 13, "the count these explain: 10 (one linked group) plus 3 left");
  assert.deepEqual(openSellOrdersFor([parent], "BBB"), []);
});

test("Monday's case: Alpaca keeps the shares reported as not available with no open order; every skipped round is logged with qty, qtyAvailable and no open sells, and the attempt itself is logged", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  await hold(w, "IONQ", 2, 33.88);
  await w.sim.cancelAllOrders();
  w.sim.advance(1_000);
  w.sim.staleHeld.set("IONQ", 2);
  const r = await w.liquidator.flatten({ reason: "no live protective stop", tradeDate: D, only: ["IONQ"], maxRounds: 3 });
  assert.equal(r.flat, false);
  assert.equal(r.sold.length, 0);
  assert.deepEqual(r.errors, [], "as on Monday: no error, nothing sent");
  assert.equal(w.sim.sellLog.length, 0);
  const blocked = w.events.filter((e) => e.event === "sale_blocked");
  assert.equal(blocked.length, 3, "one per round");
  for (const [i, e] of blocked.entries()) {
    assert.equal(e.data.symbol, "IONQ");
    assert.equal(e.data.round, i + 1);
    assert.equal(e.data.reason, "no live protective stop");
    assert.equal(e.data.qty, 2);
    assert.equal(e.data.qtyAvailable, 0);
    assert.equal(e.data.openSellQty, 0);
    assert.deepEqual(e.data.openSells, []);
    assert.ok(e.data.openListAgeMs >= 0 && e.data.openListAgeMs < 10_000, `open list age ${e.data.openListAgeMs}`);
    assert.ok(e.data.waitedMs >= 0);
  }
  const res = w.events.filter((e) => e.event === "liquidation_result");
  assert.equal(res.length, 1, "an attempt that sold nothing and met no error is logged now");
  assert.equal(res[0]!.data.flat, false);
  assert.equal(res[0]!.data.blocked, 3);
  assert.deepEqual(res[0]!.data.remaining, ["IONQ"]);
});

test("a sale held up by exits whose cancel has not landed logs those exit orders, then sells once they are gone", async () => {
  const w = world();
  w.sim.cancelMs = 20_000; // longer than the sale's whole first round of waiting
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const id = await hold(w, "AAA", 10, 50);
  const r = await w.liquidator.flatten({ reason: "no live protective stop", tradeDate: D, only: ["AAA"], maxRounds: 4 });
  const first = w.events.find((e) => e.event === "sale_blocked");
  assert.ok(first, "the first round was blocked");
  assert.equal(first!.data.qty, 10);
  assert.equal(first!.data.openSellQty, 10);
  assert.ok(first!.data.openSells.length >= 1 && first!.data.openSells.every((x: any) => x.clientOrderId === id), "the exits named, with their entry's client id");
  assert.equal(r.flat, true, "sold once the cancels landed");
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["AAA", 10]]);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("logging changes nothing: the same blocked sale and the same clean sale make the same requests and sells with and without a log", async () => {
  async function run(log: boolean, stale: boolean) {
    const w = world({ log });
    await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
    await hold(w, "AAA", 10, 50);
    if (stale) w.sim.staleHeld.set("AAA", 10);
    const before = w.sim.requests;
    const r = await w.liquidator.flatten({ reason: "no live protective stop", tradeDate: D, only: ["AAA"], maxRounds: 3 });
    return { requests: w.sim.requests - before, sells: JSON.stringify(w.sim.sellLog), flat: r.flat, ms: w.sim.simMs };
  }
  for (const stale of [true, false]) assert.deepEqual(await run(true, stale), await run(false, stale), stale ? "blocked" : "clean");
});

test("the order sync logs how old its order list was when it acts: on a missing exit and on a remainder sale", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  // a position whose exits are both gone
  const lost = await hold(w, "LOST", 4, 16.46);
  for (const l of w.sim.orders.find((o) => o.clientOrderId === lost)!.legs) await w.sim.cancelOrder(l.id);
  w.sim.advance(2_000);
  // a remainder: the take-profit partly filled and Alpaca cancelled the stop
  const bare = await hold(w, "BARE", 10, 7.27, 1);
  w.sim.advance(1_000);
  w.sim.partialTakeProfit(bare, 3, 7.28);
  w.sim.advance(10_000);
  await syncOrders(w.risk, day, { protect: true });
  const u = w.events.find((e) => e.event === "unprotected_position");
  assert.ok(u, "the missing exit was seen");
  assert.equal(u!.data.symbol, "LOST");
  assert.equal(u!.data.clientOrderId, lost);
  assert.ok(typeof u!.data.listAgeMs === "number" && u!.data.listAgeMs >= 0);
  const b = w.events.find((e) => e.event === "bare_remainder");
  assert.ok(b, "the remainder was seen");
  assert.equal(b!.data.clientOrderId, bare);
  assert.ok(typeof b!.data.listAgeMs === "number" && b!.data.listAgeMs > 0, "handled after the LOST sale, so its list is older than when it was read");
});

test("the new events are kept in the run log", () => {
  for (const e of ["sale_blocked", "bare_remainder", "liquidation_result", "unprotected_position"]) assert.equal(shouldStoreEvent("info", e), true, e);
});
