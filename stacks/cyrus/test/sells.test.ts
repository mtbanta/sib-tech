// The sell gate, the liquidator and the close-out, against a simulated broker that reproduces what was measured on
// 2026-11-02: cancels that take about 200 ms and keep holding the shares, per-item failures, a 200-request bucket.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate, openSellQty } from "../src/sells.ts";
import { closeOut } from "../src/closeout.ts";
import { syncOrders } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { order } from "./helpers.ts";
import { SimBroker } from "./sim-broker.ts";

const D = "2026-11-02";

function world() {
  const sim = new SimBroker();
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: opts?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(Date.UTC(2026, 10, 2, 20, 55) + sim.simMs), sleep: sim.sleep });
  const store = new MemoryStore();
  const now = () => new Date(Date.UTC(2026, 10, 2, 20, 55) + sim.simMs);
  return { sim, said, say, gate, liquidator, store, now };
}

// Enters and fills a bracket position in the simulator, the way the gate would have.
async function hold(w: ReturnType<typeof world>, symbol: string, qty: number, price: number, n = 1) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price * 0.996, takeProfitPrice: price * 1.0025, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price * 0.996, status: "submitted", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null });
  return id;
}

test("open sells are counted per linked group: a bracket's two exits count once, a pending cancel still counts", () => {
  const parent = order({ symbol: "AAA", side: "buy", qty: 10, filledQty: 10, status: "filled", legs: [order({ symbol: "AAA", side: "sell", qty: 10, type: "limit", status: "new" }), order({ symbol: "AAA", side: "sell", qty: 10, type: "stop", status: "new" })] });
  assert.equal(openSellQty([parent], "AAA"), 10, "take-profit and stop are one-cancels-other: 10, not 20");
  const cancelling = order({ symbol: "AAA", side: "buy", qty: 10, filledQty: 10, status: "filled", legs: [order({ symbol: "AAA", side: "sell", qty: 10, status: "pending_cancel" }), order({ symbol: "AAA", side: "sell", qty: 10, status: "canceled" })] });
  assert.equal(openSellQty([cancelling], "AAA"), 10, "a cancel that has not finished can still fill");
  assert.equal(openSellQty([parent, order({ symbol: "AAA", side: "sell", qty: 4, filledQty: 1, status: "partially_filled", legs: [] })], "AAA"), 13, "plus a separate market sell with 3 left");
  assert.equal(openSellQty([parent], "BBB"), 0);
  assert.equal(openSellQty([order({ symbol: "AAA", side: "sell", qty: 10, status: "filled", filledQty: 10 })], "AAA"), 0, "a finished sell holds nothing");
});

test("no sell larger than the position, counting sells already open: refused, alerted to Michael, nothing sent", async () => {
  const w = world();
  await hold(w, "AAA", 10, 50);
  const view = { positions: await w.sim.listPositions(), openOrders: await w.sim.listOrders("open") };
  // the bracket's exits already cover all 10 shares, so not even 1 more can be sold
  const r1 = await w.gate.sell({ symbol: "AAA", qty: 1, clientOrderId: "cyrus-x-test-aaa-1", reason: "test" }, view);
  assert.equal(r1.status, "refused");
  assert.equal(w.sim.sellLog.length, 0);
  const alert = w.said.find((m) => m.ch === "alerts")!;
  assert.ok(alert.text.includes("Michael") && alert.mention === true);
  // after the exits are cancelled and gone, 10 can be sold but 11 cannot, and a symbol never held cannot be sold at all
  await w.sim.cancelAllOrders();
  w.sim.advance(300);
  const fresh = { positions: await w.sim.listPositions(), openOrders: await w.sim.listOrders("open") };
  assert.equal((await w.gate.sell({ symbol: "AAA", qty: 11, clientOrderId: "cyrus-x-test-aaa-2", reason: "test" }, fresh)).status, "refused");
  assert.equal((await w.gate.sell({ symbol: "ZZZ", qty: 1, clientOrderId: "cyrus-x-test-zzz-1", reason: "test" }, fresh)).status, "refused");
  assert.equal((await w.gate.sell({ symbol: "AAA", qty: 0, clientOrderId: "cyrus-x-test-aaa-3", reason: "test" }, fresh)).status, "refused");
  assert.equal((await w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-4", reason: "test" }, fresh)).status, "sent");
  assert.equal(w.sim.maxSellQtyEver, 10, "no sell above the position ever reached the broker");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("a sell cannot be sent twice for the same shares: the second is refused because the first is already open", async () => {
  const w = world();
  await hold(w, "AAA", 10, 50);
  await w.sim.cancelAllOrders();
  w.sim.advance(300);
  const a = await w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-1", reason: "test" });
  const b = await w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-2", reason: "test" });
  assert.equal(a.status, "sent");
  assert.equal(b.status, "refused", "the shares are already being sold");
});

test("the Monday case: five positions with live stops, the close-out alone flattens them, no sell above any position, no false alarm", async () => {
  const w = world();
  for (const [sym, qty, px] of [["HRL", 92, 21.6], ["COO", 33, 60.4], ["AEM", 11, 171.2], ["FIS", 51, 39.1], ["RMD", 8, 233.7]] as const) await hold(w, sym, qty, px);
  const day = await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  // Monday's sequence: the close-out starts, and about 5 seconds later the 30 second order sync runs.
  const deps = { broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep };
  let syncSold = 0;
  const realSleep = w.sim.sleep;
  let synced = false;
  deps.sleep = async (ms) => {
    await realSleep(ms);
    if (!synced && w.sim.simMs > 2000) {
      synced = true;
      // the order sync with the guard on (a close-out is running): it must not sell anything
      const r = await syncOrders({ broker: w.sim, store: w.store, now: w.now, say: w.say, liquidator: w.liquidator }, day, { protect: false });
      syncSold += r.unprotected.length;
    }
  };
  const res = await closeOut({ ...deps, liquidator: new Liquidator({ broker: w.sim, gate: new SellGate({ broker: w.sim, say: w.say }), now: w.now, sleep: deps.sleep }) }, D);
  assert.deepEqual(res, { flat: true, remaining: [] });
  assert.equal((await w.sim.listPositions()).length, 0);
  assert.equal(syncSold, 0);
  assert.ok(!w.said.some((m) => m.text.includes("no live protective stop")), "no false alarm");
  assert.equal(w.sim.oversellAttempts, 0, "no sell was ever refused for being too big, because the cancels were awaited first");
  const sells = new Map(w.sim.sellLog.map((x) => [x.symbol, x.qty]));
  assert.deepEqual([...sells].sort(), [["AEM", 11], ["COO", 33], ["FIS", 51], ["HRL", 92], ["RMD", 8]]);
  assert.equal(w.sim.sellLog.length, 5, "exactly one sell per symbol");
});

test("the bulk cancel fails after cancelling the stops: the close-out still flattens the account and tells Michael", async () => {
  const w = world();
  for (const [sym, qty, px] of [["AAA", 10, 50], ["BBB", 20, 25]] as const) await hold(w, sym, qty, px);
  w.sim.cancelAllFailsAfterCancelling = true;
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D);
  assert.equal(res.flat, true);
  assert.equal((await w.sim.listPositions()).length, 0);
  assert.equal(w.sim.oversellAttempts, 0);
  assert.ok(w.said.some((m) => m.ch === "alerts" && m.text.includes("Michael") && m.text.includes("recovered")), "Michael is told it had trouble");
  const events = (w.store as MemoryStore).events;
  assert.ok(events.some((e) => e.event === "closeout_result"), "the result is written to the run log");
});

test("sells refused by the broker are retried in the next round; what is still held at the end is named to Michael", async () => {
  const w = world();
  await hold(w, "AAA", 10, 50);
  w.sim.refuseSellsTimes = 2; // the first two sells are refused
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D);
  assert.equal(res.flat, true, "the third round sells it");
  const w2 = world();
  await hold(w2, "AAA", 10, 50);
  w2.sim.refuseSellsTimes = 99;
  const bad = await closeOut({ broker: w2.sim, liquidator: w2.liquidator, store: w2.store, now: w2.now, say: w2.say, sleep: w2.sim.sleep }, D);
  assert.equal(bad.flat, false);
  assert.deepEqual(bad.remaining, ["AAA"]);
  const alert = w2.said.find((m) => m.ch === "alerts" && m.text.includes("NOT FLAT"))!;
  assert.ok(alert.text.includes("Michael") && alert.mention);
  assert.ok(alert.text.includes("sell refused (test)"), "the reason the broker gave is in the alert");
});

test("an empty request bucket does not stop the close-out: safety work waits for the refill and goes on", async () => {
  const w = world();
  await hold(w, "AAA", 10, 50);
  w.sim.tokens = 0;
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D);
  assert.equal(res.flat, true);
  assert.ok(w.sim.rejected429 > 0, "the bucket really was empty at first");
});

test("selling one unprotected symbol leaves every other position and its stops alone", async () => {
  const w = world();
  const a = await hold(w, "AAA", 10, 50);
  await hold(w, "BBB", 20, 25);
  const r = await w.liquidator.flatten({ reason: "test", tradeDate: D, only: ["AAA"] });
  assert.equal(r.flat, true);
  assert.equal(w.sim.heldQty("AAA"), 0);
  assert.equal(w.sim.heldQty("BBB"), 20);
  const bbbOrder = (await w.sim.listOrders("open")).find((o) => o.symbol === "BBB")!;
  assert.ok(bbbOrder.legs.some((l) => l.status === "new"), "BBB's exits are still live");
  void a;
});

test("the close-out sends nothing while the market is closed", async () => {
  const w = world();
  await hold(w, "AAA", 10, 50);
  w.sim.clockOpen = false;
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D);
  assert.equal(res.deferred, true);
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.sim.heldQty("AAA"), 10);
});
