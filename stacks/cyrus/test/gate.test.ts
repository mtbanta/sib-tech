import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OrderGate, clientOrderIdFor, peakKey } from "../src/gate.ts";
import { OpeningRangeBreakout, type Signal } from "../src/strategy.ts";
import { syncOrders, enforceDailyLoss } from "../src/risk.ts";
import { closeOut } from "../src/closeout.ts";
import { ensureDay } from "../src/morning.ts";
import { MemoryStore, CONTROL_STOP, type DayRecord } from "../src/store.ts";
import { AlpacaError } from "../src/alpaca-trading.ts";
import { FeedAlerter } from "../src/feed-alert.ts";
import { FakeBroker, order } from "./helpers.ts";

const D = "2026-11-02";
const NOW = new Date("2026-11-02T15:30:00Z"); // 10:30 New York, an hour into the session

async function setup(over: { approved?: boolean; now?: Date } = {}) {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const said: Array<{ ch: string; text: string }> = [];
  let now = over.now ?? NOW;
  const say = async (ch: string, text: string) => (said.push({ ch, text }), true);
  const deps = { broker, store, now: () => now, say: say as any };
  await ensureDay(deps, D);
  if (over.approved !== false) await store.updateDay(D, { status: "approved", decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z" } });
  const gate = new OrderGate(deps);
  const signal = (symbol = "AAA", price = 50, ageSeconds = 5): Signal => ({ symbol, price, tradeTime: new Date(now.getTime() - ageSeconds * 1000), stopPrice: Math.round(price * 0.985 * 100) / 100 });
  return { store, broker, said, gate, deps, signal, setNow: (d: Date) => (now = d) };
}

test("an approved, in-window entry is sent once, long, whole shares, with a stop, and recorded first", async () => {
  const s = await setup();
  const r = await s.gate.enter(s.signal("AAA", 50));
  assert.equal(r.status, "sent");
  const sent = s.broker.calls.find((c) => c.fn === "submitEntry")!.args[0] as any;
  assert.equal(sent.symbol, "AAA");
  assert.equal(sent.qty, 20, "1000 dollar limit at 50 dollars");
  assert.equal(sent.stopPrice, 49.25);
  assert.equal(sent.clientOrderId, clientOrderIdFor(D, "AAA"));
  const row = (await s.store.getOrder(sent.clientOrderId))!;
  assert.equal(row.status, "submitted");
  assert.ok(row.alpacaOrderId);
  assert.ok(s.said.some((m) => m.ch === "trading" && m.text.includes("protective stop")));
  assert.ok(await s.store.getControl(peakKey(D)));
});

test("the same entry twice, or after a restart, is never sent twice", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA"));
  const again = await s.gate.enter(s.signal("AAA"));
  assert.equal(again.status, "refused");
  // a brand new gate (a restart) over the same store
  const restarted = new OrderGate(s.deps);
  assert.equal((await restarted.enter(s.signal("AAA"))).status, "refused");
  assert.equal(s.broker.count("submitEntry"), 1);
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
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA")))?.status, "canceled");
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
    ["already holding", (s) => void (s.broker.positions = [{ symbol: "AAA", qty: 1, marketValue: 50, avgEntryPrice: 50, unrealizedPl: 0 }]), /already holding/],
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

test("trades-a-day limit: the eleventh entry is refused", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: { maxPositionUsd: 1000, dailyLossStopUsd: 200, maxTradesPerDay: 2, borrowingCap: 4 } });
  const results = [];
  for (const sym of ["AAA", "BBB", "CCC"]) results.push((await s.gate.enter(s.signal(sym, 20))).status);
  assert.deepEqual(results, ["sent", "sent", "refused"]);
});

test("borrowing cap 1: exposure never goes above equity; the cap is held at Alpaca", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: { maxPositionUsd: 15000, dailyLossStopUsd: 200, maxTradesPerDay: 10, borrowingCap: 1 } });
  s.broker.account = { ...s.broker.account, equity: 20000 };
  s.broker.positions = [{ symbol: "ZZZ", qty: 1, marketValue: 19900, avgEntryPrice: 1, unrealizedPl: 0 }];
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

test("a definite refusal from Alpaca is recorded as failed, reported and not retried", async () => {
  const s = await setup();
  s.broker.submitEntry = async () => { s.broker.calls.push({ fn: "submitEntry", args: [] }); throw new AlpacaError("insufficient buying power", 403); };
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "error");
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA")))?.status, "failed");
  assert.ok(s.said.some((m) => m.text.includes("refused by Alpaca")));
  assert.equal((await s.gate.enter(s.signal())).status, "refused", "a second try the same day is refused");
});

test("an unclear outcome (timeout, server error) is kept as an intent that still counts, and the sync finds the order", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: { maxPositionUsd: 1000, dailyLossStopUsd: 200, maxTradesPerDay: 1, borrowingCap: 4 } });
  s.broker.submitEntry = async (e) => {
    s.broker.calls.push({ fn: "submitEntry", args: [e] });
    s.broker.orders.push(order({ id: "00000000-0000-0000-0000-0000000000aa", clientOrderId: e.clientOrderId, symbol: e.symbol, status: "accepted" })); // it landed
    throw new Error("timeout (test)");
  };
  const r = await s.gate.enter(s.signal("AAA", 20));
  assert.equal(r.status, "error");
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA")))?.status, "intent", "not marked failed");
  assert.ok(s.said.some((m) => m.text.includes("outcome at Alpaca is unclear")));
  assert.equal((await s.gate.enter(s.signal("BBB", 20))).status, "refused", "it still counts toward trades a day");
  await syncOrders({ ...s.deps }, (await s.store.getDay(D))!);
  const row = (await s.store.getOrder(clientOrderIdFor(D, "AAA")))!;
  assert.equal(row.status, "submitted");
  assert.equal(row.alpacaOrderId, "00000000-0000-0000-0000-0000000000aa");
});

test("a duplicate-id answer (the order exists at Alpaca) is kept as an intent that still counts, never recorded as failed", async () => {
  const s = await setup();
  s.broker.submitEntry = async (e) => { s.broker.calls.push({ fn: "submitEntry", args: [e] }); throw new AlpacaError("client_order_id must be unique", 422); };
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "error");
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA")))?.status, "intent");
  assert.ok(s.said.some((m) => m.text.includes("outcome at Alpaca is unclear")));
});

test("if the database fails after the order was sent, the order is not reported as failed", async () => {
  const s = await setup();
  const realUpdate = s.store.updateOrder.bind(s.store);
  s.store.updateOrder = async (id, patch) => { if (patch.status === "submitted") throw new Error("db blip (test)"); return realUpdate(id, patch); };
  const r = await s.gate.enter(s.signal());
  assert.equal(r.status, "sent");
  assert.equal((await s.store.getOrder(clientOrderIdFor(D, "AAA")))?.status, "intent", "stays an intent, counted, reconciled later");
  assert.ok(!s.said.some((m) => m.text.includes("failed")));
});

test("simultaneous signals are handled one at a time", async () => {
  const s = await setup();
  await s.store.updateDay(D, { limits: { maxPositionUsd: 1000, dailyLossStopUsd: 200, maxTradesPerDay: 1, borrowingCap: 4 } });
  const rs = await Promise.all(["AAA", "BBB", "CCC"].map((x) => s.gate.enter(s.signal(x, 20))));
  assert.deepEqual(rs.map((r) => r.status).sort(), ["refused", "refused", "sent"]);
  assert.equal(s.broker.count("submitEntry"), 1);
});

test("structure: only the gate sends entries; only known places change the account or sell everything", () => {
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
  const src = join(import.meta.dirname, "../src");
  const callers = (fn: string) => files(src).filter((f) => new RegExp(`\\.${fn}\\(`).test(readFileSync(f, "utf8"))).map((f) => f.slice(src.length + 1)).sort();
  assert.deepEqual(callers("submitEntry"), ["gate.ts", "tools/paper-check.ts"]);
  assert.deepEqual(callers("setAccountConfig"), ["closeout.ts", "gate.ts", "morning.ts", "tools/paper-check.ts", "worker.ts"]);
  assert.deepEqual(callers("closeAllPositions"), ["closeout.ts", "commands.ts", "risk.ts", "tools/paper-check.ts"]);
  // nothing in the worker (outside tools) imports a tool
  for (const f of files(src).filter((f) => !f.includes("/tools/"))) assert.ok(!/from "\.\/tools\//.test(readFileSync(f, "utf8")), f);
});

// ---- strategy ----
const T = (min: number, sec = 0) => new Date(Date.UTC(2026, 10, 2, 14, 30 + min, sec)).toISOString();
test("opening range breakout: signals once, after the first 5 minutes, above the range high", () => {
  const open = new Date("2026-11-02T14:30:00Z");
  const s = new OpeningRangeBreakout(open, ["AAA", "BBB"]);
  assert.equal(s.onTrade({ symbol: "AAA", price: 99, size: 1, time: T(-3) }), null, "before the open is ignored");
  assert.equal(s.onTrade({ symbol: "AAA", price: 100, size: 1, time: T(1) }), null);
  assert.equal(s.onTrade({ symbol: "AAA", price: 101, size: 1, time: T(4, 59) }), null, "still inside the range");
  assert.equal(s.onTrade({ symbol: "AAA", price: 101, size: 1, time: T(5) }), null, "equal to the high is not a breakout");
  const sig = s.onTrade({ symbol: "AAA", price: 102, size: 1, time: T(6) })!;
  assert.equal(sig.symbol, "AAA");
  assert.equal(sig.stopPrice, 100.47);
  assert.equal(s.onTrade({ symbol: "AAA", price: 105, size: 1, time: T(7) }), null, "once per name");
  assert.equal(s.onTrade({ symbol: "BBB", price: 5, size: 1, time: T(6) }), null, "no range seen, no signal");
  assert.equal(s.onTrade({ symbol: "ZZZ", price: 5, size: 1, time: T(1) }), null, "not on the list");
});

// ---- risk ----
test("sync marks fills; an entry whose stop is gone is sold and reported", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA", 50));
  const row = (await s.store.listOrders(D))[0]!;
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.orders = [order({ id: row.alpacaOrderId!, clientOrderId: row.clientOrderId, symbol: "AAA", status: "filled", filledQty: 20, filledAvgPrice: 50, legs: [order({ side: "sell", type: "stop", stopPrice: 49.25, status: "new" })] })];
  const day = (await s.store.getDay(D))!;
  let r = await syncOrders({ ...s.deps }, day);
  assert.deepEqual(r.unprotected, []);
  assert.equal((await s.store.getOrder(row.clientOrderId))?.status, "filled");
  assert.equal(s.broker.count("closePosition"), 0);
  // now the stop leg is cancelled while the position is still held
  s.broker.orders[0] = { ...s.broker.orders[0]!, legs: [order({ side: "sell", type: "stop", stopPrice: 49.25, status: "canceled" })] };
  r = await syncOrders({ ...s.deps }, day);
  assert.deepEqual(r.unprotected, ["AAA"]);
  assert.equal(s.broker.count("closePosition"), 1);
  assert.ok(s.said.some((m) => m.ch === "alerts" && m.text.includes("no live protective stop")));
});

test("an entry cancelled before filling is marked cancelled", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA", 50));
  const row = (await s.store.listOrders(D))[0]!;
  s.broker.orders = [order({ id: row.alpacaOrderId!, clientOrderId: row.clientOrderId, symbol: "AAA", status: "canceled", filledQty: 0 })];
  await syncOrders({ ...s.deps }, (await s.store.getDay(D))!);
  assert.equal((await s.store.getOrder(row.clientOrderId))?.status, "canceled");
});

test("the daily loss stop sets the stop flag and sells everything, once", async () => {
  const s = await setup();
  const day = (await s.store.getDay(D))!;
  s.broker.account = { ...s.broker.account, equity: 19850 };
  assert.equal(await enforceDailyLoss({ ...s.deps }, day), false, "150 of 200 is not enough");
  s.broker.account = { ...s.broker.account, equity: 19790 };
  assert.equal(await enforceDailyLoss({ ...s.deps }, day), true);
  assert.equal(((await s.store.getControl(CONTROL_STOP)) as any).on, true);
  assert.equal(s.broker.count("closeAllPositions"), 1);
  assert.equal(await enforceDailyLoss({ ...s.deps }, day), false, "already stopped");
  assert.equal(s.broker.count("closeAllPositions"), 1);
});

// ---- close-out ----
test("close-out sells everything, checks the account is flat, and resets the cap to 1", async () => {
  const s = await setup();
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.config = { ...s.broker.config, maxMarginMultiplier: 2 };
  const r = await closeOut({ ...s.deps, sleep: async () => undefined }, D);
  assert.deepEqual(r, { flat: true, remaining: [] });
  assert.equal(s.broker.config.maxMarginMultiplier, 1);
  assert.ok(s.said.some((m) => m.text.includes("account is flat")));
});

test("close-out that cannot get flat retries, then shouts", async () => {
  const s = await setup();
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.closeAllPositions = async () => { s.broker.calls.push({ fn: "closeAllPositions", args: [] }); throw new Error("rejected (test)"); };
  const r = await closeOut({ ...s.deps, sleep: async () => undefined }, D);
  assert.equal(r.flat, false);
  assert.deepEqual(r.remaining, ["AAA"]);
  assert.equal(s.broker.count("closeAllPositions"), 3);
  assert.ok(s.said.some((m) => m.ch === "alerts" && m.text.includes("NOT FLAT")));
});

test("sync reads only today's orders, and does not cry wolf while a sell is already working", async () => {
  const s = await setup();
  await s.gate.enter(s.signal("AAA", 50));
  const row = (await s.store.listOrders(D))[0]!;
  s.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  s.broker.orders = [
    order({ id: row.alpacaOrderId!, clientOrderId: row.clientOrderId, symbol: "AAA", status: "filled", filledQty: 20, filledAvgPrice: 50, legs: [order({ side: "sell", type: "stop", status: "canceled" })] }),
    order({ id: "00000000-0000-0000-0000-0000000000bb", clientOrderId: "flatten", symbol: "AAA", side: "sell", type: "market", status: "new", orderClass: "" }),
  ];
  s.broker.calls.length = 0;
  const r = await syncOrders({ ...s.deps }, (await s.store.getDay(D))!);
  assert.deepEqual(r.unprotected, []);
  assert.equal(s.broker.count("closePosition"), 0);
  const call = s.broker.calls.find((c) => c.fn === "listOrders" && c.args[0] === "all")!;
  assert.equal(call.args[1], "2026-11-02T05:00:00.000Z", "from the start of the New York day");
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

test("a strategy created after the open gives no signals that day", () => {
  const open = new Date("2026-11-02T14:30:00Z");
  const late = new OpeningRangeBreakout(open, ["AAA"], new Date("2026-11-02T14:33:00Z"));
  late.onTrade({ symbol: "AAA", price: 100, size: 1, time: "2026-11-02T14:34:00Z" });
  assert.equal(late.onTrade({ symbol: "AAA", price: 120, size: 1, time: "2026-11-02T14:40:00Z" }), null);
  const early = new OpeningRangeBreakout(open, ["AAA"], new Date("2026-11-02T14:25:00Z"));
  early.onTrade({ symbol: "AAA", price: 100, size: 1, time: "2026-11-02T14:31:00Z" });
  assert.ok(early.onTrade({ symbol: "AAA", price: 120, size: 1, time: "2026-11-02T14:40:00Z" }));
});
