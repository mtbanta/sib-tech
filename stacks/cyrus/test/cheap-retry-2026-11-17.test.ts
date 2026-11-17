// Michael's decision 1 of 2026-11-17 (about 9:10 AM): "Cheap retry: build version C for real (admits on today's 10, sends 3, gives back 7)."
// An ordinary stuck retry of a missing-exit sale, with the live updates connected and nothing to cancel, sends 3 requests (open orders,
// positions, the sell), admitted on 10 and giving the rest back; anything else takes the full path; the sell gate's check is unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { syncOrders, SyncMemory, CHEAP_RETRY, STUCK_TRY_REQUESTS, cheapRetryApplies } from "../src/risk.ts";
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
  const oneTry = async (beforeRun?: () => Promise<void>) => {
    const st = mem.stuck.get(id);
    if (st) st.nextAt = sim.simMs - 1;
    acts.length = 0;
    await sync();
    if (beforeRun) await beforeRun();
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
  return { sim, id, mem, budget, oneTry, acts, store, counts, setCounting: (on: boolean) => { counting = on; if (on) for (const k of Object.keys(counts)) delete counts[k]; } };
}

test("with the live updates connected, an ordinary stuck retry sends 3 requests (open orders, positions, the sell) and keeps nothing reserved after it", async () => {
  const w = await world();
  w.sim.refuseSellIf = () => true;
  const first = await w.oneTry(); // the first try: full path, never refused
  assert.ok(first.total > 3, `the first try takes the full path (${first.total})`);
  assert.ok((first.counts.findOrderByClientId ?? 0) >= 1, "the first try looks the entry up (the cheap path is for ordinary retries only)");
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

test("the gate's check is unchanged: a sell of ours for every share appearing after the sync decided, before the cheap retry runs: its one read sees it and no sell is sent", async () => {
  const w = await world();
  w.sim.refuseSellIf = () => true;
  await w.oneTry();
  w.sim.refuseSellIf = null;
  // Group 2, round 1: the covering sell lands after the sync's look (which decided the try) and before the try runs.
  const retry = await w.oneTry(async () => {
    await w.sim.submitSell({ symbol: "AAA", qty: 5, clientOrderId: "cyrus-x-test-AAA-hold", stopPrice: 5 });
  });
  assert.equal(retry.label, "missing-exit sale", "the cheap retry was decided and ran");
  assert.equal(retry.counts.findOrderByClientId ?? 0, 0, "the cheap path (no entry lookup)");
  assert.deepEqual([retry.counts.listOrdersPaged, retry.counts.listPositions], [1, 1], "its one read of open orders and positions");
  assert.equal(retry.counts.submitSell ?? 0, 0, `no sell sent (${JSON.stringify(retry.counts)})`);
  assert.equal(w.sim.oversellAttempts ?? 0, 0);
});

// Group 2, round 1: each condition of the cheap path, one at a time (a remainder sale, the fast sale, live updates down, something to
// cancel, an exit of the entry still open in the sync's list, the switch off, a first try): each sends the retry down the full path.
test("the cheap path's conditions, one at a time: only an ordinary retry of a missing-exit sale, not fast, live updates up, nothing to cancel, no exit open in the sync's list", () => {
  const entry = (legStatus: string) => ({ id: "e", clientOrderId: "cyrus-20261102-AAA-1", symbol: "AAA", side: "buy", qty: 5, filledQty: 5, filledAvgPrice: 10, status: "filled", orderClass: "bracket", type: "market", stopPrice: null, limitPrice: null, createdAt: null, filledAt: null, legs: [{ id: "s", clientOrderId: "x-s", symbol: "AAA", side: "sell", qty: 5, filledQty: 0, filledAvgPrice: null, status: legStatus, orderClass: "", type: "stop", stopPrice: 9.87, limitPrice: null, createdAt: null, filledAt: null, legs: [] }] }) as any;
  const base = { ordinaryRetry: true, kind: "missing" as const, fast: false, streamLive: true, alsoCancel: 0, listedCopy: entry("canceled") };
  assert.equal(cheapRetryApplies(base), true, "the cheap case");
  assert.equal(cheapRetryApplies({ ...base, kind: "bare" }), false, "a remainder sale: full path");
  assert.equal(cheapRetryApplies({ ...base, ordinaryRetry: false }), false, "a first try: full path");
  assert.equal(cheapRetryApplies({ ...base, fast: true }), false, "the fast sale: full path");
  assert.equal(cheapRetryApplies({ ...base, streamLive: false }), false, "live updates down: full path");
  assert.equal(cheapRetryApplies({ ...base, alsoCancel: 1 }), false, "something to cancel: full path");
  assert.equal(cheapRetryApplies({ ...base, listedCopy: entry("new") }), false, "an exit of the entry open in the sync's list: full path");
  CHEAP_RETRY.on = false;
  try {
    assert.equal(cheapRetryApplies(base), false, "switched off");
  } finally {
    CHEAP_RETRY.on = true;
  }
});

// Group 1, round 1: a cheap sale left the gate's read in place; a second cheap try of the same symbol within the second reused it, the gate
// (counting its own sell sent since) refused, and posted a false "short sale" alert. The cheap look now clears the gate's read first.
test("two cheap one-entry sales of the same symbol within a second: the second reads afresh, sends nothing, and posts no short-sale alert", async () => {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const id = clientOrderIdFor(D, "AAA", 1);
  await sim.submitEntry({ symbol: "AAA", qty: 5, stopPrice: 9.87, takeProfitPrice: 10.08, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(5_000);
  const alerts: string[] = [];
  const gate = new SellGate({ broker: sim, say: async (_c: string, t: string) => (alerts.push(t), true), nowMs: () => sim.simMs });
  const liq = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: async () => undefined });
  const opts = { reason: "protective stop not confirmed", tradeDate: D, only: ["AAA"], ownEntryOnly: { maxQty: { AAA: 5 } }, maxRounds: 1, cheap: true } as any;
  await liq.flatten(opts);
  assert.equal(sim.sellLog.filter((x: any) => x.symbol === "AAA").length, 1, "the first cheap sale sold");
  sim.advance(200); // well within the gate's one second
  const before = sim.sellLog.length;
  await liq.flatten(opts);
  assert.equal(sim.sellLog.length, before, "the second sends nothing (the shares are sold or covered by the open sell)");
  assert.ok(!alerts.some((t) => /short sale/.test(t)), `no false short-sale alert: ${JSON.stringify(alerts)}`);
  assert.equal(sim.oversellAttempts ?? 0, 0);
});
