import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OrderGate, clientOrderIdFor, peakKey } from "../src/gate.ts";
import { BusyPlaceholder, type Signal } from "../src/strategy.ts";
import { syncOrders, enforceDailyLoss } from "../src/risk.ts";
import { closeOut } from "../src/closeout.ts";
import { ensureDay } from "../src/morning.ts";
import { MemoryStore, CONTROL_STOP } from "../src/store.ts";
import { AlpacaError } from "../src/alpaca-trading.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Governor } from "../src/governor.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { FeedAlerter } from "../src/feed-alert.ts";
import { FakeBroker, order } from "./helpers.ts";

const D = "2026-11-02";
const NOW = new Date("2026-11-02T15:30:00Z"); // 10:30 New York, an hour into the session

async function setup(over: { approved?: boolean; now?: Date } = {}) {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const notes: string[] = [];
  let now = over.now ?? NOW;
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: opts?.mentionOwner }), true);
  const governor = new Governor(() => now.getTime());
  const view = new BrokerView(broker, () => now.getTime());
  const liquidator = new Liquidator({ broker, gate: new SellGate({ broker, say: say as any }), now: () => now, sleep: async () => undefined });
  const deps = { broker, store, now: () => now, say: say as any, liquidator };
  await ensureDay(deps, D);
  if (over.approved !== false) await store.updateDay(D, { status: "approved", decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z" } });
  const gate = new OrderGate({ broker, store, view, governor, now: () => now, say: say as any, note: (l) => notes.push(l) });
  const signal = (symbol = "AAA", price = 50, ageSeconds = 5): Signal => ({ symbol, price, tradeTime: new Date(now.getTime() - ageSeconds * 1000), stopPrice: Math.round(price * 0.985 * 100) / 100, takeProfitPrice: Math.round(price * 1.0025 * 100) / 100 });
  return { store, broker, said, notes, gate, deps, governor, view, liquidator, signal, setNow: (d: Date) => (now = d) };
}
const LIM = (over: Partial<{ maxPositionUsd: number; dailyLossStopUsd: number; maxTradesPerMinute: number; borrowingCap: 1 | 2 | 4 }>) => ({ maxPositionUsd: 1000, dailyLossStopUsd: 200, maxTradesPerMinute: 20, borrowingCap: 1 as const, ...over });

test("an approved, in-window entry is sent once, long, whole shares, with its exits, and recorded first", async () => {
  const s = await setup();
  const r = await s.gate.enter(s.signal("AAA", 50));
  assert.equal(r.status, "sent");
  await s.gate.settled();
  const sent = s.broker.calls.find((c) => c.fn === "submitEntry")!.args[0] as any;
  assert.equal(sent.symbol, "AAA");
  assert.equal(sent.qty, 20, "1000 dollar limit at 50 dollars");
  assert.equal(sent.stopPrice, 49.25);
  assert.equal(sent.takeProfitPrice, 50.13);
  assert.equal(sent.clientOrderId, clientOrderIdFor(D, "AAA", 1));
  const row = (await s.store.getOrder(sent.clientOrderId))!;
  assert.equal(row.status, "submitted");
  assert.ok(row.alpacaOrderId);
  assert.equal(typeof row.acceptMs, "number", "the time to accept is recorded");
  assert.ok(s.notes.some((n) => n.includes("BUY 20 AAA") && n.includes("accepted in")), "trade news goes to the digest, not to Discord");
  assert.ok(!s.said.some((m) => m.ch === "trading"), "the gate never posts to Discord itself");
  await s.gate.flush();
  assert.ok(await s.store.getControl(peakKey(D)));
});

test("the same symbol cannot be entered twice at once, or after a restart, but can be entered again once its position has closed", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA"));
  const again = await s.gate.enter(s.signal("AAA"));
  assert.equal(again.status, "refused");
  const restarted = new OrderGate({ broker: s.broker, store: s.store, view: s.view, governor: new Governor(() => NOW.getTime()), now: () => NOW, say: async () => true, note: () => undefined });
  assert.equal((await restarted.enter(s.signal("AAA"))).status, "refused");
  assert.equal(s.broker.count("submitEntry"), 1);
  // the first position closes (the sync marks it)
  const row = (await s.store.listOrders(D))[0]!;
  await s.store.updateOrder(row.clientOrderId, { status: "filled", closedAt: NOW.toISOString() });
  const second = await s.gate.enter(s.signal("AAA"));
  assert.equal(second.status, "sent");
  assert.equal((second as any).clientOrderId, clientOrderIdFor(D, "AAA", 2), "a running number keeps the ids unique");
});

test("no approved limits means no entry (the morning gate)", async () => {
  for (const status of ["pending", "lapsed"] as const) {
    const s = await setup({ approved: false });
    await s.store.updateDay(D, { status });
    const r = await s.gate.enter(s.signal());
    assert.deepEqual(r, { status: "refused", reason: "no limits approved for today" }, status);
    assert.equal(s.broker.count("submitEntry"), 0);
    assert.equal((await s.store.listRefusals(D)).length, 1, "the refusal is logged");
  }
});

test("the stop flag wins, even over approved limits", async () => {
  const s = await setup();
  await s.store.setControl(CONTROL_STOP, { on: true, at: "t", reason: "test" });
  const r = await s.gate.enter(s.signal());
  assert.deepEqual(r, { status: "refused", reason: "stop flag is set" });
  assert.equal(s.broker.count("submitEntry"), 0);
});

test("a stop set after the checks but before the send still stops the order", async () => {
  const s = await setup();
  const realGet = s.store.getControl.bind(s.store);
  let reads = 0;
  s.store.getControl = async <T,>(k: string) => {
    if (k === CONTROL_STOP && ++reads === 2) return { on: true, at: "t", reason: "late stop" } as T;
    return realGet<T>(k);
  };
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "refused");
  assert.equal(s.broker.count("submitEntry"), 0);
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA", 1)))?.status, "canceled");
});

test("a database outage refuses the entry (fail closed) and sends nothing", async () => {
  const s = await setup();
  s.store.failing = true;
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "refused");
  assert.equal(s.broker.count("submitEntry"), 0);
});

test("a broker outage refuses the entry", async () => {
  const s = await setup();
  s.broker.failOn.add("getAccount");
  assert.equal((await s.gate.enter(s.signal())).status, "refused");
  assert.equal(s.broker.count("submitEntry"), 0);
});

test("each fixed limit refuses with its own reason", async () => {
  const cases: Array<[string, (s: Awaited<ReturnType<typeof setup>>) => Promise<unknown> | void, RegExp, number?]> = [
    ["market closed", (s) => void (s.broker.clock = { ...s.broker.clock, isOpen: false }), /market is closed/],
    ["first minutes", (s) => void s.setNow(new Date("2026-11-02T14:33:00Z")), /first minutes/],
    ["too close to the close", (s) => void s.setNow(new Date("2026-11-02T20:10:00Z")), /too close to the close/],
    ["stale price", () => undefined, /stale/, 600],
    ["daily loss", (s) => void (s.broker.account = { ...s.broker.account, equity: 19790 }), /daily loss stop/],
    ["holding a symbol this worker did not enter today", (s) => void (s.broker.positions = [{ symbol: "AAA", qty: 1, marketValue: 50, avgEntryPrice: 50, unrealizedPl: 0 }]), /carried over/],
  ];
  for (const [name, arrange, re, age] of cases) {
    const s = await setup();
    await arrange(s);
    const r = await s.gate.enter(s.signal("AAA", 50, age ?? 5));
    assert.equal(r.status, "refused", name);
    assert.match((r as any).reason, re, name);
    assert.equal(s.broker.count("submitEntry"), 0, name);
  }
});

test("trades a minute: the governor refuses the third entry inside one minute, and allows it after the minute", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: LIM({ maxTradesPerMinute: 2, borrowingCap: 4 }) });
  const results = [];
  for (const sym of ["AAA", "BBB", "CCC"]) results.push((await s.gate.enter(s.signal(sym, 20))).status);
  assert.deepEqual(results, ["sent", "sent", "refused"]);
  s.setNow(new Date(NOW.getTime() + 61_000));
  assert.equal((await s.gate.enter(s.signal("CCC", 20))).status, "sent", "the minute has passed");
});

test("the fixed ceiling holds even if a stored limit is higher than 100", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: LIM({ maxTradesPerMinute: 5000, borrowingCap: 4, maxPositionUsd: 60 }) });
  let sent = 0;
  for (let i = 0; i < 130; i++) {
    const sym = `S${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`;
    if ((await s.gate.enter(s.signal(sym, 10))).status === "sent") sent++;
  }
  assert.equal(sent, 100, "never more than 100 orders in a minute");
});

test("the governor holds back entries when Alpaca's request budget is down to the safety reserve", async () => {
  const s = await setup();
  s.governor.observe({ path: "/v2/account", status: 200, limit: 200, remaining: 60, reset: 0 });
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "refused");
  assert.match((r as any).reason, /holding back for safety/);
  assert.equal(s.broker.count("submitEntry"), 0);
});

test("an entry makes one order request and no repeated reads: the cached view serves the second entry", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: LIM({ borrowingCap: 4 }) });
  await s.gate.enter(s.signal("AAA", 20));
  s.broker.calls.length = 0;
  await s.gate.enter(s.signal("BBB", 20));
  assert.deepEqual(s.broker.calls.map((c) => c.fn), ["submitEntry"], "no account, positions, config or clock reads for the second entry");
});

test("a signal that waited too long in the queue is dropped, not sent late", async () => {
  const s = await setup();
  let t = NOW.getTime();
  await s.store.updateDay(D, { limits: LIM({ borrowingCap: 4 }) });
  const gate = new OrderGate({ broker: s.broker, store: s.store, view: new BrokerView(s.broker, () => t), governor: new Governor(() => t), now: () => new Date(t), say: async () => true, note: () => undefined, maxQueueMs: 5000 });
  const realSubmit = s.broker.submitEntry.bind(s.broker);
  s.broker.submitEntry = async (e) => { t += 6000; return realSubmit(e); }; // the first send is slow
  const [first, second] = await Promise.all([gate.enter(s.signal("AAA", 20)), gate.enter(s.signal("BBB", 20))]);
  assert.equal(first.status, "sent");
  assert.equal(second.status, "refused");
  assert.match((second as any).reason, /waited more than 5 seconds/);
  assert.equal(s.broker.count("submitEntry"), 1);
});

test("borrowing cap 1: exposure never goes above equity; the cap is held at Alpaca", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: LIM({ maxPositionUsd: 15000, borrowingCap: 1 }) });
  s.broker.account = { ...s.broker.account, equity: 20000 };
  s.broker.positions = [{ symbol: "ZZZ", qty: 1, marketValue: 19900, avgEntryPrice: 1, unrealizedPl: 0 }];
  await s.store.insertOrder({ clientOrderId: "cyrus-20261102-ZZZ-1", tradeDate: D, symbol: "ZZZ", qty: 1, referencePrice: 19900, stopPrice: 19000, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: 19900, note: null }); // today's own entry
  const r = await s.gate.enter(s.signal("AAA", 150));
  assert.equal(r.status, "refused");
  assert.match((r as any).reason, /borrowing cap/);
});

test("if Alpaca's cap is higher than approved, the gate lowers it first; shorting is forced off", async () => {
  const s = await setup();
  s.broker.config = { maxMarginMultiplier: 4, noShorting: false, suspendTrade: false };
  assert.equal((await s.gate.enter(s.signal())).status, "sent");
  assert.deepEqual(s.broker.config, { maxMarginMultiplier: 1, noShorting: true, suspendTrade: false });
  const s2 = await setup();
  s2.broker.config = { maxMarginMultiplier: 4, noShorting: true, suspendTrade: false };
  s2.broker.failOn.add("setAccountConfig");
  assert.equal((await s2.gate.enter(s2.signal())).status, "refused", "cannot fix it, so no entry");
  assert.equal(s2.broker.count("submitEntry"), 0);
});

test("a definite refusal from Alpaca is recorded as failed, reported in the digest, and the symbol waits a minute", async () => {
  const s = await setup();
  s.broker.submitEntry = async () => { s.broker.calls.push({ fn: "submitEntry", args: [] }); throw new AlpacaError("insufficient buying power", 403); };
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "error");
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA", 1)))?.status, "failed");
  assert.ok(s.notes.some((m) => m.includes("refused the entry")));
  const again = await s.gate.enter(s.signal());
  assert.equal(again.status, "refused", "a second try a moment later is refused");
  assert.equal(s.broker.count("submitEntry"), 1);
});

test("an unclear outcome (timeout, server error) is kept as an intent that still counts, and the sync finds the order", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: LIM({ maxTradesPerMinute: 1, borrowingCap: 4 }) });
  s.broker.submitEntry = async (e) => {
    s.broker.calls.push({ fn: "submitEntry", args: [e] });
    s.broker.orders.push(order({ id: "00000000-0000-0000-0000-0000000000aa", clientOrderId: e.clientOrderId, symbol: e.symbol, status: "accepted" })); // it landed
    throw new Error("timeout (test)");
  };
  const r = await s.gate.enter(s.signal("AAA", 20));
  assert.equal(r.status, "error");
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA", 1)))?.status, "intent", "not marked failed");
  assert.ok(s.said.some((m) => m.text.includes("outcome at Alpaca is unclear")));
  assert.equal((await s.gate.enter(s.signal("BBB", 20))).status, "refused", "it still counts toward the trades-a-minute cap");
  await syncOrders({ ...s.deps }, (await s.store.getDay(D))!);
  const row = (await s.store.getOrder(clientOrderIdFor(D, "AAA", 1)))!;
  assert.equal(row.status, "submitted");
  assert.equal(row.alpacaOrderId, "00000000-0000-0000-0000-0000000000aa");
});

test("a duplicate-id answer (the order exists at Alpaca) is kept as an intent that still counts, never recorded as failed", async () => {
  const s = await setup();
  s.broker.submitEntry = async (e) => { s.broker.calls.push({ fn: "submitEntry", args: [e] }); throw new AlpacaError("client_order_id must be unique", 422); };
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "error");
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA", 1)))?.status, "intent");
  assert.ok(s.said.some((m) => m.text.includes("outcome at Alpaca is unclear")));
});

test("if the database fails after the order was sent, the order is not reported as failed", async () => {
  const s = await setup();
  const realUpdate = s.store.updateOrder.bind(s.store);
  s.store.updateOrder = async (id, patch) => { if (patch.status === "submitted") throw new Error("db blip (test)"); return realUpdate(id, patch); };
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "sent");
  await s.gate.settled();
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA", 1)))?.status, "intent", "stays an intent, counted, reconciled later");
  assert.ok(!s.said.some((m) => m.text.includes("failed")));
  assert.ok(s.said.some((m) => m.ch === "alerts" && m.text.includes("could not be updated")));
});

test("simultaneous signals are handled one at a time", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: LIM({ maxTradesPerMinute: 1, borrowingCap: 4 }) });
  const rs = await Promise.all(["AAA", "BBB", "CCC"].map((x) => s.gate.enter(s.signal(x, 20))));
  assert.deepEqual(rs.map((r) => r.status).sort(), ["refused", "refused", "sent"]);
  assert.equal(s.broker.count("submitEntry"), 1);
});

test("structure: only the gate sends entries, only the sell gate sends sells, and nothing closes positions in bulk", () => {
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
  const src = join(import.meta.dirname, "../src");
  const callers = (fn: string) => files(src).filter((f) => new RegExp(`\\.${fn}\\(`).test(readFileSync(f, "utf8"))).map((f) => f.slice(src.length + 1)).sort();
  assert.deepEqual(callers("submitEntry"), ["gate.ts", "tools/paper-check.ts"]);
  assert.deepEqual(callers("submitSell"), ["sells.ts"]);
  assert.deepEqual(callers("setAccountConfig"), ["closeout.ts", "gate.ts", "morning.ts", "tools/paper-check.ts", "worker.ts"]);
  assert.deepEqual(callers("closeAllPositions"), []);
  assert.deepEqual(callers("closePosition"), []);
  for (const f of files(src)) assert.ok(!/DELETE", "\/v2\/positions|\/v2\/positions\//.test(readFileSync(f, "utf8")), `${f} must not close positions through Alpaca's bulk or single-position calls`);
  // nothing in the worker (outside tools) imports a tool
  for (const f of files(src).filter((f) => !f.includes("/tools/"))) assert.ok(!/from "\.\/tools\//.test(readFileSync(f, "utf8")), f);
});

// ---- strategy ----
const tick = (symbol: string, price: number, sec: number) => ({ symbol, price, size: 1, time: new Date(Date.UTC(2026, 10, 2, 14, 40, sec)).toISOString() });
test("busy placeholder: signals on an uptick at or above the recent average, with a cooldown per name, never for names off the list", () => {
  const st = new BusyPlaceholder(["AAA", "BBB"]);
  for (let i = 0; i < 11; i++) assert.equal(st.onTrade(tick("AAA", 100, i)), null, "warming up");
  const sig = st.onTrade(tick("AAA", 100.5, 12))!;
  assert.equal(sig.symbol, "AAA");
  assert.ok(sig.stopPrice < 100.5 && sig.takeProfitPrice > 100.5);
  assert.equal(sig.stopPrice, 100.1);
  assert.equal(sig.takeProfitPrice, 100.75);
  assert.equal(st.onTrade(tick("AAA", 100.6, 13)), null, "cooldown: not again within 15 seconds");
  assert.ok(st.onTrade(tick("AAA", 101, 30)), "after the cooldown it can signal again");
  assert.equal(st.onTrade(tick("ZZZ", 5, 1)), null, "not on the list");
  const down = new BusyPlaceholder(["BBB"]);
  for (let i = 0; i < 12; i++) down.onTrade(tick("BBB", 100 - i * 0.1, i));
  assert.equal(down.onTrade(tick("BBB", 98.5, 13)), null, "an uptick below the average is not a signal");
});

test("busy placeholder is deterministic: the same trades give the same signals", () => {
  const run = () => {
    const st = new BusyPlaceholder(["AAA"]);
    const out: unknown[] = [];
    for (let i = 0; i < 200; i++) out.push(st.onTrade(tick("AAA", 100 + Math.sin(i / 3) * 2 + i * 0.01, i)));
    return JSON.stringify(out);
  };
  assert.equal(run(), run());
  assert.ok(JSON.parse(run()).filter(Boolean).length > 3, "it is busy");
});

// ---- risk ----
test("sync marks fills; an entry whose exits are gone is sold and reported", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA", 50));
  await s.gate.settled();
  const row = (await s.store.listOrders(D))[0]!;
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.orders = [order({ id: row.alpacaOrderId!, clientOrderId: row.clientOrderId, symbol: "AAA", status: "filled", filledQty: 20, filledAvgPrice: 50, legs: [order({ side: "sell", type: "stop", stopPrice: 49.25, status: "new" })] })];
  const day = (await s.store.getDay(D))!;
  let r = await syncOrders({ ...s.deps }, day);
  assert.deepEqual(r.unprotected, []);
  assert.equal((await s.store.getOrder(row.clientOrderId))?.status, "filled");
  assert.equal(s.broker.count("submitSell"), 0);
  // now the stop leg is cancelled while the position is still held
  s.broker.orders[0] = { ...s.broker.orders[0]!, legs: [order({ side: "sell", type: "stop", stopPrice: 49.25, status: "canceled" })] };
  r = await syncOrders({ ...s.deps }, day);
  assert.deepEqual(r.unprotected, ["AAA"]);
  assert.equal(s.broker.count("submitSell"), 1);
  assert.ok(s.said.some((m) => m.ch === "alerts" && m.text.includes("no live protective stop")));
});

test("with protection checks off (a close-out is running or its time has come) the sync sells nothing", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA", 50));
  await s.gate.settled();
  const row = (await s.store.listOrders(D))[0]!;
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.orders = [order({ id: row.alpacaOrderId!, clientOrderId: row.clientOrderId, symbol: "AAA", status: "filled", filledQty: 20, filledAvgPrice: 50, legs: [order({ side: "sell", type: "stop", status: "canceled" })] })];
  const r = await syncOrders({ ...s.deps }, (await s.store.getDay(D))!, { protect: false });
  assert.deepEqual(r.unprotected, []);
  assert.equal(s.broker.count("submitSell"), 0);
  assert.ok(!s.said.some((m) => m.text.includes("no live protective stop")), "no false alarm");
});

test("a symbol entered again after its first position closed is judged by its own order, not the old one", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA", 50));
  await s.gate.settled();
  const first = (await s.store.listOrders(D))[0]!;
  // the first entry filled and its take-profit leg filled: closed. The position then re-opened with a second entry.
  await s.store.updateOrder(first.clientOrderId, { status: "filled", closedAt: NOW.toISOString() });
  await s.gate.enter(s.signal("AAA", 50));
  await s.gate.settled();
  const second = (await s.store.listOrders(D)).find((o) => o.clientOrderId !== first.clientOrderId)!;
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.orders = [
    order({ id: first.alpacaOrderId!, clientOrderId: first.clientOrderId, symbol: "AAA", status: "filled", filledQty: 20, filledAvgPrice: 50, legs: [order({ side: "sell", type: "limit", status: "filled", filledQty: 20, qty: 20 }), order({ side: "sell", type: "stop", status: "canceled" })] }),
    order({ id: second.alpacaOrderId!, clientOrderId: second.clientOrderId, symbol: "AAA", status: "filled", filledQty: 20, filledAvgPrice: 50, legs: [order({ side: "sell", type: "limit", status: "new" }), order({ side: "sell", type: "stop", status: "new" })] }),
  ];
  const r = await syncOrders({ ...s.deps }, (await s.store.getDay(D))!);
  assert.deepEqual(r.unprotected, [], "the new position has live exits; the old row's dead stop does not matter");
  assert.equal(s.broker.count("submitSell"), 0);
});

test("an entry cancelled before filling is marked cancelled", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA", 50));
  await s.gate.settled();
  const row = (await s.store.listOrders(D))[0]!;
  s.broker.orders = [order({ id: row.alpacaOrderId!, clientOrderId: row.clientOrderId, symbol: "AAA", status: "canceled", filledQty: 0 })];
  await syncOrders({ ...s.deps }, (await s.store.getDay(D))!);
  assert.equal((await s.store.getOrder(row.clientOrderId))?.status, "canceled");
});

test("the daily loss stop sets the stop flag and sells everything, once", async () => {
  const s = await setup();
  const day = (await s.store.getDay(D))!;
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.account = { ...s.broker.account, equity: 19850 };
  assert.equal(await enforceDailyLoss({ ...s.deps }, day), false, "150 of 200 is not enough");
  s.broker.account = { ...s.broker.account, equity: 19790 };
  assert.equal(await enforceDailyLoss({ ...s.deps }, day), true);
  assert.equal(((await s.store.getControl(CONTROL_STOP)) as any).on, true);
  assert.equal(s.broker.count("submitSell"), 1);
  assert.equal(s.broker.positions.length, 0);
  assert.equal(await enforceDailyLoss({ ...s.deps }, day), false, "already stopped");
  assert.equal(s.broker.count("submitSell"), 1);
});

// ---- close-out ----
test("close-out sells everything, checks the account is flat, and resets the cap to 1", async () => {
  const s = await setup();
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.config = { ...s.broker.config, maxMarginMultiplier: 2 };
  const r = await closeOut({ ...s.deps }, D);
  assert.deepEqual(r, { flat: true, remaining: [] });
  assert.equal(s.broker.config.maxMarginMultiplier, 1);
  assert.ok(s.said.some((m) => m.text.includes("account is flat")));
});

test("close-out that cannot get flat retries, then shouts to Michael by name with a mention", async () => {
  const s = await setup();
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.sellsStick = true;
  const r = await closeOut({ ...s.deps }, D);
  assert.equal(r.flat, false);
  assert.deepEqual(r.remaining, ["AAA"]);
  const alert = s.said.find((m) => m.ch === "alerts" && m.text.includes("NOT FLAT"))!;
  assert.ok(alert.text.startsWith("**Michael:"), "named");
  assert.equal(alert.mention, true, "and mentioned");
});

test("sync reads only orders newer than the oldest entry it still watches, and does not cry wolf while a sell is already working", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA", 50));
  await s.gate.settled();
  const row = (await s.store.listOrders(D))[0]!;
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.orders = [
    order({ id: row.alpacaOrderId!, clientOrderId: row.clientOrderId, symbol: "AAA", status: "filled", filledQty: 20, filledAvgPrice: 50, legs: [order({ side: "sell", type: "stop", status: "canceled" })] }),
    order({ id: "00000000-0000-0000-0000-0000000000bb", clientOrderId: "flatten", symbol: "AAA", side: "sell", type: "market", status: "new", orderClass: "" }),
  ];
  s.broker.calls.length = 0;
  const r = await syncOrders({ ...s.deps }, (await s.store.getDay(D))!);
  assert.deepEqual(r.unprotected, []);
  assert.equal(s.broker.count("submitSell"), 0);
  const call = s.broker.calls.find((c) => c.fn === "listOrdersPaged")!;
  assert.equal(call.args[1], "2026-11-02T15:29:00.000Z", "one minute before the entry, not the whole day");
});

test("the feed alerter: login failure at once, reconnects only when repeated, with a cooldown", () => {
  const a = new FeedAlerter();
  assert.ok(a.onStatus("auth_failed", 0)!.includes("refused our login"));
  assert.equal(a.onStatus("auth_failed", 60_000), null, "cooldown");
  const b = new FeedAlerter();
  for (let i = 0; i < 4; i++) assert.equal(b.onStatus("reconnecting", i), null);
  assert.ok(b.onStatus("reconnecting", 5)!.includes("keeps dropping"));
  assert.equal(b.onStatus("reconnecting", 6), null);
  b.onStatus("live", 7);
  assert.equal(new FeedAlerter().onStatus("live", 0), null);
});

// ---- review round 1 fixes ----
test("the cached stop flag cannot be hidden by a database read that was already in flight when the stop was written", async () => {
  const { CachingStore } = await import("../src/caching-store.ts");
  const inner = new MemoryStore();
  const s = new CachingStore(inner);
  let release: () => void = () => undefined;
  const slow = new Promise<void>((r) => (release = r));
  const realGet = inner.getControl.bind(inner);
  let first = true;
  inner.getControl = async <T,>(k: string) => {
    const v = await realGet<T>(k); // the old value ("nothing set") is read first...
    if (first) { first = false; await slow; } // ...and the answer is held up
    return v;
  };
  const reading = s.getControl<StopFlagT>(CONTROL_STOP);
  await s.setControl(CONTROL_STOP, { on: true, at: "t", reason: "stop" }); // the stop command writes while the read waits
  release();
  await reading;
  assert.equal((await s.getControl<StopFlagT>(CONTROL_STOP))?.on, true, "the stop is not overwritten by the older read");
  // the same for a day's record
  await inner.createDay({ tradeDate: D, isTradingDay: true, openAt: null, closeAt: null, status: "pending", dayStartEquity: 1, suggested: LIM({}), limits: LIM({}), decided: {}, liveList: null, phases: {} });
  let release2: () => void = () => undefined;
  const slow2 = new Promise<void>((r) => (release2 = r));
  const realDay = inner.getDay.bind(inner);
  let firstDay = true;
  inner.getDay = async (d: string) => { const v = await realDay(d); if (firstDay) { firstDay = false; await slow2; } return v; };
  const readingDay = s.getDay(D);
  await s.updateDay(D, { limits: LIM({ maxPositionUsd: 300 }) });
  release2();
  await readingDay;
  assert.equal((await s.getDay(D))!.limits.maxPositionUsd, 300, "a tightened limit is not overwritten by an older read");
});
type StopFlagT = { on: boolean };

test("exposure counts entries the order sync marked filled but the cached account view does not show yet", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: LIM({ maxPositionUsd: 10000, borrowingCap: 1 }) });
  s.broker.account = { ...s.broker.account, equity: 20000 };
  await s.gate.enter(s.signal("AAA", 100)); // 10,000 dollars
  await s.gate.settled();
  const row = (await s.store.listOrders(D))[0]!;
  await s.store.updateOrder(row.clientOrderId, { status: "filled", filledQty: row.qty, filledAvgPrice: 100 }); // the sync saw the fill; the view (positions) has not caught up
  assert.equal((await s.gate.enter(s.signal("BBB", 100))).status, "sent", "10,000 + 10,000 is exactly the cap");
  const third = await s.gate.enter(s.signal("CCC", 100));
  assert.equal(third.status, "refused");
  assert.match((third as any).reason, /borrowing cap/);
});

test("after a restart the governor still counts the entries sent in the last minute", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: LIM({ maxTradesPerMinute: 3, borrowingCap: 4 }) });
  for (const sym of ["AAA", "BBB", "CCC"]) assert.equal((await s.gate.enter(s.signal(sym, 20))).status, "sent");
  s.setNow(new Date(NOW.getTime() + 10_000)); // ten seconds later the worker restarts: a new gate and an empty governor
  const t = NOW.getTime() + 10_000;
  const governor = new Governor(() => t);
  const gate = new OrderGate({ broker: s.broker, store: s.store, view: new BrokerView(s.broker, () => t), governor, now: () => new Date(t), say: async () => true, note: () => undefined });
  const r = await gate.enter({ ...s.signal("DDD", 20), tradeTime: new Date(t - 2000) });
  assert.equal(r.status, "refused");
  assert.match((r as any).reason, /trades-per-minute limit reached/);
  const later = NOW.getTime() + 62_000;
  const gate2 = new OrderGate({ broker: s.broker, store: s.store, view: new BrokerView(s.broker, () => later), governor: new Governor(() => later), now: () => new Date(later), say: async () => true, note: () => undefined });
  assert.equal((await gate2.enter({ ...s.signal("DDD", 20), tradeTime: new Date(later - 2000) })).status, "sent", "a minute later it may send again");
});

test("strategy work never spends the last request headroom: with the budget at the reserve and a stale view, no request is made, and a failed refresh is not repeated for every queued signal", async () => {
  const s = await setup();
  s.governor.observe({ path: "/v2/account", status: 200, limit: 200, remaining: 70, reset: 0 });
  s.broker.calls.length = 0;
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "refused");
  assert.match((r as any).reason, /holding back for safety/);
  assert.equal(s.broker.calls.length, 0, "not one request was made");
  // budget fine, but the refresh fails: the next signals within a few seconds do not try again
  const s2 = await setup();
  s2.broker.failOn.add("getAccount");
  s2.broker.calls.length = 0;
  await s2.gate.enter(s2.signal("AAA"));
  const before = s2.broker.calls.length;
  for (const sym of ["BBB", "CCC", "DDD", "EEE"]) await s2.gate.enter(s2.signal(sym));
  assert.equal(s2.broker.calls.length, before, "no more requests until the pause is over");
});

test("the order sync does not call an entry closed just because the position is not in a read taken at the same moment as its fill", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA", 50));
  await s.gate.settled();
  const row = (await s.store.listOrders(D))[0]!;
  s.broker.positions = []; // the position read comes back empty (taken a moment before the fill)
  s.broker.orders = [order({ id: row.alpacaOrderId!, clientOrderId: row.clientOrderId, symbol: "AAA", status: "filled", filledQty: 20, filledAvgPrice: 50, filledAt: new Date(NOW.getTime() - 2000).toISOString(), legs: [order({ side: "sell", type: "stop", status: "new" })] })];
  await syncOrders({ ...s.deps }, (await s.store.getDay(D))!);
  assert.equal((await s.store.getOrder(row.clientOrderId))?.closedAt ?? null, null, "still watched");
});
