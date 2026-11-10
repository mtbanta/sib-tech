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

function world(mode: { hide?: boolean; noQty?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 20, 55));
  sim.hideFilledParents = mode.hide === true;
  sim.reportQtyAvailable = mode.noQty !== true;
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: opts?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
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
  // the bracket's exits already cover all 10 shares, so not even 1 more can be sold
  const r1 = await w.gate.sell({ symbol: "AAA", qty: 1, clientOrderId: "cyrus-x-test-aaa-1", reason: "test" });
  assert.equal(r1.status, "refused");
  assert.equal(w.sim.sellLog.length, 0);
  const alert = w.said.find((m) => m.ch === "alerts")!;
  assert.ok(alert.text.includes("Michael") && alert.mention === true);
  // after the exits are cancelled and gone, 10 can be sold but 11 cannot, and a symbol never held cannot be sold at all
  await w.sim.cancelAllOrders();
  w.sim.advance(1500);
  assert.equal((await w.gate.sell({ symbol: "AAA", qty: 11, clientOrderId: "cyrus-x-test-aaa-2", reason: "test" })).status, "refused");
  assert.equal((await w.gate.sell({ symbol: "ZZZ", qty: 1, clientOrderId: "cyrus-x-test-zzz-1", reason: "test" })).status, "refused");
  assert.equal((await w.gate.sell({ symbol: "AAA", qty: 0, clientOrderId: "cyrus-x-test-aaa-3", reason: "test" })).status, "refused");
  assert.equal((await w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-4", reason: "test" })).status, "sent");
  assert.equal(w.sim.maxSellQtyEver, 10, "no sell above the position ever reached the broker");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("a sell cannot be sent twice for the same shares, even if the second is asked for inside the same second", async () => {
  const w = world();
  await hold(w, "AAA", 10, 50);
  await w.sim.cancelAllOrders();
  w.sim.advance(1500);
  const [a, b] = await Promise.all([
    w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-1", reason: "one" }),
    w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-2", reason: "two" }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), ["refused", "sent"], "one sell goes, the other is refused by the gate itself");
  assert.equal(w.sim.oversellAttempts, 0, "the broker never even saw the second");
});

test("two liquidations at once never sell the same shares twice: the second waits its turn and finds nothing to do", async () => {
  const w = world();
  for (const [sym, qty, px] of [["AAA", 10, 50], ["BBB", 20, 25]] as const) await hold(w, sym, qty, px);
  const [a, b] = await Promise.all([w.liquidator.flatten({ reason: "close-out", tradeDate: D }), w.liquidator.flatten({ reason: "flatten", tradeDate: D })]);
  assert.equal(a.flat, true);
  assert.equal(b.flat, true);
  assert.equal(w.sim.oversellAttempts, 0);
  assert.equal(w.sim.sellLog.length, 2, "one sell per symbol, not two");
  assert.ok(!w.said.some((m) => m.text.includes("refused a sell")));
  assert.equal(w.liquidator.isLiquidating(), false);
});

test("while a liquidation runs (or waits), the liquidating flag is on; a single-symbol sale queued behind a whole-account one sells nothing and says nothing false", async () => {
  const w = world();
  await hold(w, "AAA", 10, 50);
  const day = await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const big = w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  assert.equal(w.liquidator.isLiquidating(), true);
  const small = w.liquidator.flatten({ reason: "no live protective stop", tradeDate: D, only: ["AAA"] });
  await Promise.all([big, small]);
  assert.equal(w.sim.sellLog.length, 1);
  void day;
});

test("a failed read of the open orders in the middle of a sale sends no sell that round, and the next round finishes the job", async () => {
  const w = world();
  await hold(w, "AAA", 10, 50);
  const real = w.sim.listOrdersPaged.bind(w.sim);
  let calls = 0;
  w.sim.listOrdersPaged = async (...a: Parameters<typeof real>) => {
    calls++;
    if (calls === 2) throw new Error("read failed (test)"); // the first look inside the wait loop
    return real(...a);
  };
  const r = await w.liquidator.flatten({ reason: "test", tradeDate: D });
  assert.equal(r.flat, true);
  assert.equal(w.sim.oversellAttempts, 0, "no sell was sent against an empty list of open orders");
  assert.ok(r.errors.some((e) => e.includes("could not read")));
});

test("the liquidator sends nothing while the market is closed, and an empty account still has its leftover orders cancelled", async () => {
  const w = world();
  await hold(w, "AAA", 10, 50);
  w.sim.clockOpen = false;
  const r = await w.liquidator.flatten({ reason: "flatten", tradeDate: D });
  assert.equal(r.flat, false);
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.sim.heldQty("AAA"), 10);
  const w2 = world();
  await w2.sim.submitEntry({ symbol: "ZZZ", qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: "cyrus-20261102-ZZZ-1" }); // never filled
  const r2 = await w2.liquidator.flatten({ reason: "flatten", tradeDate: D });
  assert.equal(r2.flat, true);
  w2.sim.advance(500);
  assert.equal((await w2.sim.listOrders("open")).length, 0, "the unfilled entry was cancelled");
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
  const res = await closeOut({ ...deps, liquidator: new Liquidator({ broker: w.sim, gate: new SellGate({ broker: w.sim, say: w.say, nowMs: () => w.sim.simMs }), now: w.now, sleep: deps.sleep }) }, D);
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

import { rig } from "./rig.ts";
test("worker level: a sync tick that lands inside the close-out's slow cancels sells nothing and raises no false alarm", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 14, 0));
  let r: ReturnType<typeof rig<SimBroker>>;
  let hooked = false;
  let armedHook = false;
  const sleep = async (ms: number) => {
    await sim.sleep(ms);
    if (armedHook && !hooked) {
      hooked = true;
      await r.at("20:55:40"); // the 30 second order sync falls due while the close-out waits for its cancels
    }
  };
  const events: string[] = [];
  r = rig<SimBroker>({ broker: sim, sleep, log: (_l, e) => void events.push(e), midday: false }); // the mid-day cycle (on in production) would sell at 10:30 CT; it is tested in midday.test.ts
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  const mk = async (sym: string, n: number) => {
    const id = clientOrderIdFor(D, sym, 1);
    await sim.submitEntry({ symbol: sym, qty: n, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: sym, qty: n, referencePrice: 10, stopPrice: 9.9, status: "submitted", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: "2026-11-02T14:40:00.000Z" });
  };
  await mk("AAA", 10);
  await mk("BBB", 20);
  await r.at("20:54:00"); // a normal sync: the exits are live, nothing to do
  assert.equal(sim.sellLog.length, 0);
  armedHook = true;
  await r.at("20:55:00"); // the close-out starts; the hook fires a tick at 20:55:40 inside it
  await r.at("20:55:50");
  assert.equal(hooked, true, "the tick really fell inside the close-out");
  assert.equal((await sim.listPositions()).length, 0);
  assert.equal(sim.sellLog.length, 2, "exactly one sell per symbol, from the close-out alone");
  assert.equal(sim.oversellAttempts, 0);
  assert.ok(!r.said("alerts").some((t) => t.includes("no live protective stop")), "no false alarm");
  assert.ok(!events.includes("unprotected_position"), "the sync did not even start a sale: the close-out guard is on");
});

test("the order sync's missing-exit check is off during any liquidation and from the close-out time on, and on otherwise", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 14, 0));
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep });
  await r.at("14:00:00");
  const closeAt = new Date("2026-11-02T21:00:00Z");
  const protect = () => (r.worker as unknown as { protectNow(c: Date): boolean }).protectNow(closeAt);
  assert.equal(protect(), true, "on in the middle of the session");
  await r.at("20:54:59");
  assert.equal(protect(), true, "still on one second before close-out time");
  await r.at("20:55:00");
  assert.equal(protect(), false, "off from 5 minutes before the close");
  await r.at("14:30:00");
  assert.equal(protect(), true);
  await hold(world(), "AAA", 1, 1); // (keeps the helper in use)
  const w = world();
  await hold(w, "AAA", 10, 50);
  const worker = r.worker as unknown as { protectNow(c: Date): boolean; liquidator: Liquidator };
  const real = worker.liquidator;
  let seen: boolean | null = null;
  const orig = real.flatten.bind(real);
  real.flatten = (o) => { const p = orig(o); seen = worker.protectNow(closeAt); return p; };
  await real.flatten({ reason: "flatten", tradeDate: D });
  assert.equal(seen, false, "off while a flatten is running or waiting its turn");
});


// ---- the things nobody has measured: run the key cases with Alpaca's open list hiding a filled entry's exits, and with no qty_available ----
const MODES: Array<[string, { hide?: boolean; noQty?: boolean }]> = [["open list hides filled entries' exits", { hide: true }], ["no qty_available reported", { noQty: true }], ["both", { hide: true, noQty: true }]];
for (const [label, mode] of MODES) {
  test(`close-out flattens five positions, without oversell or false alarm, when ${label}`, async () => {
    const w = world(mode);
    for (const [sym, qty, px] of [["HRL", 92, 21.6], ["COO", 33, 60.4], ["AEM", 11, 171.2], ["FIS", 51, 39.1], ["RMD", 8, 233.7]] as const) await hold(w, sym, qty, px);
    const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D);
    assert.equal(res.flat, true, JSON.stringify(res));
    assert.equal(w.sim.oversellAttempts, 0);
    assert.equal(w.sim.sellLog.length, 5);
    assert.ok(!w.said.some((m) => m.text.includes("no live protective stop")));
  });

  test(`the bulk cancel failing after cancelling still ends flat when ${label}`, async () => {
    const w = world(mode);
    await hold(w, "AAA", 10, 50);
    await hold(w, "BBB", 20, 25);
    w.sim.cancelAllFailsAfterCancelling = true;
    const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D);
    assert.equal(res.flat, true);
    assert.equal(w.sim.oversellAttempts, 0);
  });

  test(`two liquidations at once never oversell when ${label}`, async () => {
    const w = world(mode);
    await hold(w, "AAA", 10, 50);
    await hold(w, "BBB", 20, 25);
    const [a, b] = await Promise.all([w.liquidator.flatten({ reason: "close-out", tradeDate: D }), w.liquidator.flatten({ reason: "flatten", tradeDate: D })]);
    assert.equal(a.flat && b.flat, true);
    assert.equal(w.sim.oversellAttempts, 0);
    assert.equal(w.sim.sellLog.length, 2);
  });

  test(`a sell cannot be sent twice for the same shares when ${label}`, async () => {
    const w = world(mode);
    await hold(w, "AAA", 10, 50);
    await w.sim.cancelAllOrders();
    w.sim.advance(1500);
    const [a, b] = await Promise.all([w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-1", reason: "one" }), w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-2", reason: "two" })]);
    assert.deepEqual([a.status, b.status].sort(), ["refused", "sent"]);
    assert.equal(w.sim.oversellAttempts, 0);
  });

  test(`a failed read in the middle of a sale sends nothing that round when ${label}`, async () => {
    const w = world(mode);
    await hold(w, "AAA", 10, 50);
    const real = w.sim.listOrdersPaged.bind(w.sim);
    let calls = 0;
    w.sim.listOrdersPaged = async (...a: Parameters<typeof real>) => { calls++; if (calls === 2) throw new Error("read failed (test)"); return real(...a); };
    const r = await w.liquidator.flatten({ reason: "test", tradeDate: D });
    assert.equal(r.flat, true);
    assert.equal(w.sim.oversellAttempts, 0, "no sell went out against a list that could not be read");
  });
}

test("a sell that fills between the gate's two reads is not counted as still free (no qty_available reported)", async () => {
  const w = world({ noQty: true });
  await hold(w, "AAA", 10, 50);
  await w.sim.cancelAllOrders();
  w.sim.advance(1500);
  const first = await w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-1", reason: "one" });
  assert.equal(first.status, "sent");
  // the first sell fills in the middle of the next look: whichever of the two reads comes first returns its (old) answer,
  // and only then does the sale fill
  let firstRead = true;
  const fillAfterFirstRead = async <T,>(f: () => Promise<T>): Promise<T> => { const r = await f(); if (firstRead) { firstRead = false; w.sim.advance(2000); } return r; };
  const realOrders = w.sim.listOrdersPaged.bind(w.sim);
  const realPos = w.sim.listPositions.bind(w.sim);
  w.sim.listOrdersPaged = (...a: Parameters<typeof realOrders>) => fillAfterFirstRead(() => realOrders(...a));
  w.sim.listPositions = () => fillAfterFirstRead(() => realPos());
  w.sim.advance(1100); // the gate's old view has expired
  const second = await w.gate.sell({ symbol: "AAA", qty: 10, clientOrderId: "cyrus-x-test-aaa-2", reason: "two" });
  assert.equal(second.status, "refused", "counted twice (as filled and as open) rather than missed");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("the liquidator makes the sell gate look again after its cancels (a frozen clock must not keep an old view)", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 20, 55));
  const w0 = world();
  void w0;
  const said: string[] = [];
  const say = async (_c: string, t: string) => (said.push(t), true);
  const frozen = new SellGate({ broker: sim, say, nowMs: () => 0 });
  const liquidator = new Liquidator({ broker: sim, gate: frozen, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const mk = async (sym: string, n: number) => { const id = clientOrderIdFor(D, sym, 1); await sim.submitEntry({ symbol: sym, qty: n, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id }); sim.fillEntry(id, 10); };
  await mk("AAA", 10);
  await mk("BBB", 10);
  // BBB's exits are cancelled by hand and a sale of BBB goes through the gate, which caches its view (AAA's exits still live)
  for (const o of sim.orders.filter((x) => x.symbol === "BBB")) await sim.cancelOrder(o.legs[0]!.id), await sim.cancelOrder(o.legs[1]!.id);
  sim.advance(500);
  assert.equal((await frozen.sell({ symbol: "BBB", qty: 10, clientOrderId: "cyrus-x-test-bbb-1", reason: "x" })).status, "sent");
  // now AAA is liquidated; its exits will have been cancelled by the liquidator, and the frozen gate must not use the old view
  const r = await liquidator.flatten({ reason: "unprotected", tradeDate: D, only: ["AAA"] });
  assert.equal(r.flat, true, JSON.stringify(r));
  assert.equal(sim.oversellAttempts, 0);
  assert.deepEqual(said, [], "no refusal was needed on the way (a wrongly refused sale would also alert Michael)");
  assert.equal(r.errors.length, 0);
});
