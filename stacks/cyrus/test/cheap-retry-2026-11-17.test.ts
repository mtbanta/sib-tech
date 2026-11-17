// Michael's decision 1 of 2026-11-17 (about 9:10 AM): "Cheap retry: build version C for real (admits on today's 10, sends 3, gives back 7)."
// An ordinary stuck retry of a missing-exit sale, with the live updates connected and nothing to cancel, sends 3 requests (open orders,
// positions, the sell), admitted on 10 and giving the rest back; anything else takes the full path; the sell gate's check is unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { syncOrders, SyncMemory, CHEAP_RETRY, STUCK_TRY_REQUESTS } from "../src/risk.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { RequestBudget } from "../src/request-budget.ts";

const COUNTED = ["getAccount", "listPositions", "listOrders", "listOrdersPaged", "listOrdersWindow", "findOrderByClientId", "getOrderById", "submitSell", "cancelOrder", "cancelAllOrders", "getPosition"];

async function world(opts: { streamLive?: boolean } = {}) {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  await ensureDay({ store, broker: sim, now } as any, D);
  const dd = (await store.getDay(D))!;
  const id = clientOrderIdFor(D, "AAA", 1);
  await sim.submitEntry({ symbol: "AAA", qty: 5, stopPrice: 9.87, takeProfitPrice: 10.08, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "AAA", qty: 5, referencePrice: 10, stopPrice: 9.87, takeProfitPrice: 10.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(20_000);
  const counts: Record<string, number> = {};
  let counting = false;
  for (const m of COUNTED) {
    if (typeof sim[m] !== "function") continue;
    const orig = sim[m].bind(sim);
    sim[m] = (...a: any[]) => { if (counting) counts[m] = (counts[m] ?? 0) + 1; return orig(...a); };
  }
  // Requests that reach the simulated Alpaca (each call to its rate bucket; a refused sale is one request).
  let spends = 0;
  const spendOrig = sim.spend.bind(sim);
  sim.spend = (...a: any[]) => { if (counting) spends++; return spendOrig(...a); };
  const mem: any = new SyncMemory();
  const budget = new RequestBudget({ now: () => sim.simMs, remaining: () => 200 });
  mem.budget = budget;
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now, sleep: sim.sleep });
  const acts: Array<{ label: string; run: () => Promise<any> }> = [];
  const loop = { busy: () => false, act: async (_id: string, label: string, run: () => Promise<any>) => void acts.push({ label, run }), wake: () => undefined };
  const sync = () => syncOrders({ broker: sim, store, now, say: async () => true, liquidator, syncMemory: mem } as any, dd, { protect: true, loop, streamLive: opts.streamLive ?? true } as any);
  // One try: the sync's look (not counted), then the try's action (counted).
  const oneTry = async () => {
    const st = mem.stuck.get(id);
    if (st) st.nextAt = sim.simMs - 1;
    acts.length = 0;
    await sync();
    for (const k of Object.keys(counts)) delete counts[k];
    counting = true;
    spends = 0;
    const before = budget.inUse().minute;
    if (acts[0]) await acts[0].run();
    counting = false;
    const sent = budget.inUse().minute - before;
    const requests = spends;
    sim.advance(5_000);
    return { label: acts[0]?.label ?? null, counts: { ...counts }, total: requests, budgeted: sent, open: budget.inUse().reservedUnsent };
  };
  return { sim, id, mem, budget, oneTry };
}

test("with the live updates connected, an ordinary stuck retry sends 3 requests (open orders, positions, the sell) and keeps nothing reserved after it", async () => {
  const w = await world();
  w.sim.refuseSellIf = () => true;
  const first = await w.oneTry(); // the first try: full path, never refused
  assert.ok(first.total > 3, `the first try takes the full path (${first.total})`);
  const retry = await w.oneTry();
  assert.equal(retry.total, 3, JSON.stringify(retry.counts));
  assert.deepEqual([retry.counts.listOrdersPaged, retry.counts.listPositions, retry.counts.submitSell, retry.counts.findOrderByClientId ?? 0], [1, 1, 1, 0], "open orders, positions, the sell; no entry lookup");
  assert.equal(retry.budgeted, 3, "3 budgeted requests, admitted on the 10");
  assert.equal(retry.open, 0, "the unused 7 given back when the try ended");
  assert.equal(STUCK_TRY_REQUESTS, 10);
  assert.equal(w.sim.heldQty("AAA"), 5, "Alpaca refused the sale: still held");
  w.sim.refuseSellIf = null;
  const ok = await w.oneTry();
  assert.equal(ok.total, 3);
  assert.equal(w.sim.heldQty("AAA"), 0, "sold by the cheap retry");
  assert.equal(w.sim.oversellAttempts ?? 0, 0);
});

test("with the live updates down, the retry takes the full path (the entry lookup and its re-reads)", async () => {
  const w = await world({ streamLive: false });
  w.sim.refuseSellIf = () => true;
  await w.oneTry();
  const retry = await w.oneTry();
  assert.ok((retry.counts.findOrderByClientId ?? 0) >= 1, JSON.stringify(retry.counts));
  assert.ok(retry.total > 3);
});

test("switched off, the retry takes the full path", async () => {
  CHEAP_RETRY.on = false;
  try {
    const w = await world();
    w.sim.refuseSellIf = () => true;
    await w.oneTry();
    const retry = await w.oneTry();
    assert.ok((retry.counts.findOrderByClientId ?? 0) >= 1, JSON.stringify(retry.counts));
    assert.ok(retry.total > 3);
  } finally {
    CHEAP_RETRY.on = true;
  }
});

test("the gate's check is unchanged: with a sell of ours already open for every share, the cheap retry sends no sell", async () => {
  const w = await world();
  w.sim.refuseSellIf = () => true;
  await w.oneTry();
  // A sell of all 5 shares rests at Alpaca (as if an earlier sell is still working).
  w.sim.refuseSellIf = null;
  await w.sim.submitSell({ symbol: "AAA", qty: 5, clientOrderId: "cyrus-x-test-AAA-hold", stopPrice: 5 });
  const sells0 = w.sim.sellLog.length;
  const retry = await w.oneTry();
  assert.equal(retry.counts.findOrderByClientId ?? 0, 0, "the cheap path ran (no entry lookup)");
  assert.equal(retry.counts.submitSell ?? 0, 0, `no sell sent (${JSON.stringify(retry.counts)})`);
  assert.equal(w.sim.sellLog.length, sells0);
  assert.equal(w.sim.oversellAttempts ?? 0, 0);
});
