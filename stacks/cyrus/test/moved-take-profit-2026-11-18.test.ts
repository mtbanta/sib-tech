// The moved take-profit (Michael's decision of 2026-11-18; his answers "moves first" and "one bracket only"), against the simulator in its
// 2026-11-18 mode: the open list shows a filled bracket as its take-profit alone; a replace answers with a new order (new id, same group,
// `replaces`); a take-profit at or below the stop is refused (422); a selling limit fills about 0.6 s later and Alpaca cancels the stop.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { MOVED_TAKE_PROFIT, MOVE_FILL_WAIT_MS, MoveWatch, type MoveRow, pricedMoves, structuralCandidates, withStops } from "../src/moved-take-profit.ts";
import { OrderUpdateHandler, type TradeUpdate } from "../src/order-stream.ts";
import { MemoryStore } from "../src/store.ts";
import { order } from "./helpers.ts";
import { SimBroker } from "./sim-broker.ts";

const D = "2026-11-02";

function world(opts: { moves?: boolean; room?: () => boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 20, 50));
  sim.openShape20261118 = true;
  const said: Array<{ ch: string; text: string }> = [];
  const logs: Array<{ e: string; d: Record<string, unknown> }> = [];
  const log = (e: string, d?: Record<string, unknown>) => void logs.push({ e, d: d ?? {} });
  const say = async (ch: string, text: string) => (said.push({ ch, text }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const watch = new MoveWatch(() => sim.simMs);
  sim.onOrderEvent = (event, o, atMs) => watch.onUpdate({ event, order: o, positionQty: null, atMs });
  const bids = new Map<string, number>(); // a quote that differs from the simulator's price (else the price is the bid)
  const quoteCalls: string[][] = [];
  const moves = {
    quotes: async (symbols: string[]) => {
      quoteCalls.push(symbols);
      return new Map(symbols.map((s) => [s, { bid: bids.get(s) ?? sim.prices.get(s)!, ask: (bids.get(s) ?? sim.prices.get(s)!) + 0.01, atMs: sim.simMs }]));
    },
    stopsFor: async (legs: Array<{ legId: string; groupId: string; symbol: string }>) => {
      const out = new Map<string, number>();
      for (const l of legs) {
        const stop = sim.orders.find((o) => o.groupId === l.groupId)?.legs.find((x) => x.type === "stop" || x.status === "replaced")?.stopPrice;
        if (stop) out.set(l.legId, stop);
      }
      return out;
    },
    watch,
    room: opts.room ?? (() => true),
  };
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log, ...(opts.moves === false ? {} : { moves }) });
  const rows = () => logs.filter((l) => l.e === "take_profit_moved").map((l) => l.d as unknown as MoveRow);
  return { sim, said, logs, gate, watch, bids, quoteCalls, liquidator, rows };
}

// A filled bracket: `stop` and `tp` as given (a normal day's 0.4 percent stop, or a load day's 2 cents).
async function hold(w: ReturnType<typeof world>, symbol: string, qty: number, price: number, stop: number, tp: number, n = 1) {
  const id = `cyrus-${D.replaceAll("-", "")}-${symbol}-${n}`;
  await w.sim.submitEntry({ symbol, qty, stopPrice: stop, takeProfitPrice: tp, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  return id;
}
const normal = (w: ReturnType<typeof world>, s: string, qty = 10, p = 20) => hold(w, s, qty, p, 19.92, 20.05);
const loadDay = (w: ReturnType<typeof world>, s: string, p = 5) => hold(w, s, 1, p, p - 0.02, p + 0.01);

// ---- the rules ----
test("rules: one bracket's take-profit covering the whole holding qualifies; two sells, a partly filled or pending take-profit, or a short count do not", () => {
  const tp = (over: Record<string, unknown> = {}) => order({ id: "tp-1", symbol: "AAA", side: "sell", type: "limit", orderClass: "bracket", status: "new", qty: 10, filledQty: 0, limitPrice: 20.05, groupId: "g1", ...over });
  const pos = (qty = 10, qtyAvailable: number | null = 0) => [{ symbol: "AAA", qty, qtyAvailable, marketValue: 0, avgEntryPrice: 20, unrealizedPl: 0 }];
  assert.equal(structuralCandidates(pos(), [tp()]).candidates.length, 1);
  assert.equal(structuralCandidates(pos(), [tp(), order({ id: "x", symbol: "AAA", side: "sell", status: "new", qty: 2 })]).candidates.length, 0, "another sell open");
  assert.equal(structuralCandidates(pos(), [tp({ status: "partially_filled", filledQty: 3 })]).candidates.length, 0, "partly filled");
  assert.equal(structuralCandidates(pos(), [tp({ status: "pending_cancel" })]).candidates.length, 0, "being cancelled");
  assert.equal(structuralCandidates(pos(12, 2), [tp()]).candidates.length, 0, "a second position on the symbol without its own exit");
  assert.equal(structuralCandidates(pos(), [tp({ orderClass: "" })]).candidates.length, 0, "a plain limit sell, not a bracket's");
  assert.equal(structuralCandidates(pos(), [tp()], () => null).skipped[0]!.why, "stop price unknown");
  const c = structuralCandidates(pos(), [tp()]).candidates;
  assert.equal(withStops(c, new Map()).candidates.length, 0, "no stop known: today's path");
  assert.equal(withStops(c, new Map([["tp-1", 19.92]])).candidates[0]!.stopPrice, 19.92);
});

test("rules: the selling limit is the bid less 1 cent, at least 3 cents above the stop, below the take-profit, from a quote at most 5 s old", () => {
  const c = [{ symbol: "AAA", qty: 1, legId: "tp", groupId: "g", oldLimit: 20.05, stopPrice: 19.95 }];
  const q = (bid: number, ageMs = 0) => new Map([["AAA", { bid, ask: bid + 0.01, atMs: 1_000_000 - ageMs }]]);
  assert.equal(pricedMoves(c, q(19.99), 1_000_000).moves[0]!.limit, 19.98, "19.98 is exactly 3 cents above 19.95: allowed");
  assert.equal(pricedMoves(c, q(19.98), 1_000_000).moves.length, 0, "19.97 is 2 cents above the stop: today's path");
  assert.equal(pricedMoves(c, q(20.06), 1_000_000).moves.length, 0, "the take-profit is already at or below the price");
  assert.equal(pricedMoves(c, q(19.99, 6_000), 1_000_000).moves.length, 0, "a stale quote");
  assert.equal(pricedMoves(c, new Map(), 1_000_000).skipped[0]!.why, "no quote");
  assert.equal(pricedMoves([{ ...c[0]!, stopPrice: 19.5 }], q(20.0049), 1_000_000).moves[0]!.limit, 19.99, "rounded down to the cent");
});

// ---- the sell gate ----
test("sell gate: a replace adds no shares (never refused for the exits already open), but names no more than the shares held and only a sell of that symbol", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  const tpId = w.sim.orders[0]!.legs.find((l) => l.type === "limit")!.id;
  assert.equal((await w.gate.replace({ orderId: tpId, symbol: "AAA", qty: 11, limitPrice: 19.99, reason: "test" })).status, "refused", "more than held");
  const r0 = await w.gate.replace({ orderId: w.sim.orders[0]!.id, symbol: "AAA", qty: 10, limitPrice: 19.99, reason: "test" });
  assert.ok(r0.status === "error" && r0.httpStatus === 404, "an order the open list does not show (the filled entry, like a held stop) is not refused by the gate for that alone; Alpaca answers");
  const w2 = world();
  await normal(w2, "BBB", 10);
  const tp2 = w2.sim.orders[0]!.legs.find((l) => l.type === "limit")!.id;
  const r = await w2.gate.replace({ orderId: tp2, symbol: "BBB", qty: 10, limitPrice: 19.99, reason: "test" });
  assert.equal(r.status, "sent");
  assert.equal(w2.said.length, 0, "no short-sale alert: a replace is not a new sell");
  const w3 = world();
  await normal(w3, "CCC", 10);
  w3.sim.refuseReplaceIf = () => 503;
  const r3 = await w3.gate.replace({ orderId: w3.sim.orders[0]!.legs.find((l) => l.type === "limit")!.id, symbol: "CCC", qty: 10, limitPrice: 19.99, reason: "test" });
  assert.ok(r3.status === "error" && r3.unclear, "a 5xx is unclear: the replace may have happened");
  w3.sim.refuseReplaceIf = () => 422;
  const r4 = await w3.gate.replace({ orderId: w3.sim.orders[0]!.legs.find((l) => l.type === "limit")!.id, symbol: "CCC", qty: 10, limitPrice: 19.99, reason: "test" });
  assert.ok(r4.status === "error" && !r4.unclear && r4.httpStatus === 422, "a 422 is a definite refusal");
});

// ---- the sale ----
test("nothing qualifies (a load day: price within 3 cents of the stop): the trading requests are exactly today's, no replace, no delay", async () => {
  const run = async (moves: boolean) => {
    const w = world({ moves });
    await loadDay(w, "AAA");
    await loadDay(w, "BBB", 7);
    const t0 = w.sim.simMs;
    const r = await w.liquidator.flatten({ reason: "mid-day close-out", tradeDate: D });
    return { requests: w.sim.requests, sells: w.sim.sellLog.map((s) => `${s.symbol}@${s.at - t0}`), flat: r.flat, replaces: w.sim.replaceLog.length, rows: w.rows().length, quotes: w.quoteCalls.length };
  };
  const off = await run(false);
  const on = await run(true);
  assert.deepEqual({ ...on, quotes: 0 }, { ...off, quotes: 0 }, "same trading requests, same sells at the same simulated times");
  assert.equal(on.replaces, 0);
  assert.equal(on.quotes, 0, "no quote read either: a load day's bracket (1 cent up, 2 down) cannot qualify at any price, so the sale does not wait for one");
});

test("one qualifying position is sold by its moved take-profit (Alpaca cancels the stop); the others take today's path after the wait; one row stored", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  await loadDay(w, "BBB");
  const t0 = w.sim.simMs;
  const r = await w.liquidator.flatten({ reason: "mid-day close-out", tradeDate: D });
  w.sim.advance(3_000);
  assert.equal(w.sim.replaceLog.length, 1);
  assert.deepEqual(w.sim.sellLog.map((s) => s.symbol), ["BBB"], "no market sell for the moved position");
  assert.ok(w.sim.sellLog[0]!.at - t0 <= MOVE_FILL_WAIT_MS + 1_500, "the other position's sale started after the wait (moves first)");
  assert.equal(w.sim.heldQty("AAA"), 0);
  assert.equal(w.sim.oversellAttempts, 0);
  assert.deepEqual(r.moved, { sent: 1, accepted: 1, filledInWait: 1 });
  const [row] = w.rows();
  assert.ok(row);
  assert.deepEqual([row.symbol, row.accepted, row.fallback, row.stopCancelledByAlpaca, row.timeToFillMs, row.limit], ["AAA", true, false, true, 600, 19.99]);
  assert.equal(w.said.length, 0, "no alert");
});

test("a moved take-profit that does not fill within 2 s falls back: today's cancel and a market sale, the row says so", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  w.sim.setPrice("AAA", 19.97); // the quote said 20.00, the price has moved below the limit 19.99
  w.bids.set("AAA", 20);
  const t0 = w.sim.simMs;
  await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  w.sim.advance(3_000);
  assert.equal(w.sim.replaceLog.length, 1);
  assert.equal(w.sim.sellLog.length, 1, "sold at market");
  assert.ok(w.sim.sellLog[0]!.at - t0 >= MOVE_FILL_WAIT_MS, "only after the 2 s");
  assert.equal(w.sim.heldQty("AAA"), 0);
  assert.equal(w.sim.oversellAttempts, 0);
  const [row] = w.rows();
  assert.deepEqual([row!.accepted, row!.fallback, row!.stopCancelledByAlpaca, row!.timeToFillMs], [true, true, false, null]);
});

test("a refused replace (422) and an unclear one (503) go to today's path at once, with Alpaca's answer stored", async () => {
  for (const status of [422, 503]) {
    const w = world();
    await normal(w, "AAA", 10);
    w.sim.refuseReplaceIf = () => status;
    const t0 = w.sim.simMs;
    await w.liquidator.flatten({ reason: "flatten command", tradeDate: D });
    w.sim.advance(3_000);
    assert.equal(w.sim.heldQty("AAA"), 0);
    assert.equal(w.sim.sellLog.length, 1);
    assert.ok(w.sim.sellLog[0]!.at - t0 < MOVE_FILL_WAIT_MS, "no 2 s wait for a refusal");
    const [row] = w.rows();
    assert.equal(row!.accepted, false);
    assert.equal(row!.httpStatus, status);
    assert.ok(status === 503 ? row!.answer!.startsWith("unclear") : !row!.answer!.startsWith("unclear"));
  }
});

test("the moved take-profit fills while today's cancel is landing (a pending cancel can still fill): no second sale, no short, no false alert", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  w.sim.replaceFillDelayMs = 2_100; // fills just after the 2 s fallback began
  await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  w.sim.advance(3_000);
  assert.equal(w.sim.heldQty("AAA"), 0);
  assert.equal(w.sim.sellLog.length, 0, "the shares were gone by the time today's path looked");
  assert.equal(w.sim.oversellAttempts, 0);
  assert.equal(w.said.length, 0);
  assert.equal(w.rows()[0]!.fallback, true, "counted as a fallback (not filled within 2 s); its late fill is recorded");
  assert.equal(w.rows()[0]!.timeToFillMs, 2_100);
});

test("a close-out's retry of named symbols moves too; its fallback's single cancels reach the new take-profit (whatever its id) and free the shares", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  await hold(w, "ZZZ", 5, 30, 29.88, 30.08);
  w.sim.setPrice("AAA", 19.97);
  w.bids.set("AAA", 20);
  await w.liquidator.flatten({ reason: "mid-day close-out", tradeDate: D, only: ["AAA"], maxRounds: 1 });
  w.sim.advance(3_000);
  assert.equal(w.sim.heldQty("AAA"), 0, "sold after the fallback");
  assert.equal(w.sim.heldQty("ZZZ"), 5, "a symbol not named is left alone");
  assert.equal(w.sim.replaceLog.filter((r) => r.change.limitPrice !== undefined).length, 1, "only the named symbol was moved");
});

test("the daily loss stop's one-round sale: the moves, then today's round for the rest in the same single round", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  await loadDay(w, "BBB");
  await w.liquidator.flatten({ reason: "daily loss stop", tradeDate: D, maxRounds: 1, priority: true });
  w.sim.advance(3_000);
  assert.equal(w.sim.heldQty("AAA"), 0);
  assert.equal(w.sim.heldQty("BBB"), 0);
  assert.deepEqual(w.sim.sellLog.map((s) => s.symbol), ["BBB"]);
});

test("one entry's own sale never moves; the switch off, or no room in the shared budget, means today's path", async () => {
  const own = world();
  await normal(own, "AAA", 10);
  await own.liquidator.flatten({ reason: "missing exit", tradeDate: D, only: ["AAA"], ownEntryOnly: { maxQty: { AAA: 10 } }, maxRounds: 1 });
  assert.equal(own.sim.replaceLog.length, 0);
  MOVED_TAKE_PROFIT.on = false;
  try {
    const off = world();
    await normal(off, "AAA", 10);
    await off.liquidator.flatten({ reason: "close-out", tradeDate: D });
    assert.equal(off.sim.replaceLog.length, 0);
    assert.equal(off.quoteCalls.length, 0);
  } finally {
    MOVED_TAKE_PROFIT.on = true;
  }
  const full = world({ room: () => false });
  await normal(full, "AAA", 10);
  await full.liquidator.flatten({ reason: "close-out", tradeDate: D });
  assert.equal(full.sim.replaceLog.length, 0);
  assert.ok(full.logs.some((l) => l.e === "move_phase_no_room"));
  full.sim.advance(3_000);
  assert.equal(full.sim.heldQty("AAA"), 0, "sold by today's path");
});

// ---- the live updates' tally ----
test("the live updates never count a replaced leg twice: the replacement's count includes the old order's, which is dropped", async () => {
  const store = new MemoryStore();
  const dropped: string[] = [];
  const t = Date.parse("2026-11-18T16:00:00.000Z");
  const watch = new MoveWatch(() => t);
  const h = new OrderUpdateHandler({ getOrder: (id) => store.getOrder(id), closeOrder: (id, p) => store.updateOrder(id, p), dropPosition: (s) => void dropped.push(s), now: () => t, replacedOf: (o) => watch.replacedOf(o) });
  await store.insertOrder({ clientOrderId: "cyrus-20261118-AAA-1", tradeDate: "2026-11-18", symbol: "AAA", qty: 3, referencePrice: 20, stopPrice: 19.92, takeProfitPrice: 20.05, status: "submitted", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: "2026-11-18T15:59:00.000Z" });
  const up = (o: Record<string, unknown>, event = "fill"): TradeUpdate => ({ event, order: order({ symbol: "AAA", ...o }), positionQty: null, atMs: t });
  await h.handle(up({ clientOrderId: "cyrus-20261118-AAA-1", side: "buy", status: "filled", qty: 3, filledQty: 3, filledAvgPrice: 20, groupId: "g" }));
  await h.handle(up({ id: "old-tp", side: "sell", type: "limit", status: "partially_filled", qty: 3, filledQty: 1, groupId: "g" }, "partial_fill"));
  // the stack replaced old-tp; the replacement has filled 1 more, so it reports 2 (cumulative), without a `replaces` field in the update
  watch.expect("g", "old-tp", 3); // expected before the send; the update arrives before the answer named the new id
  await h.handle(up({ id: "new-tp", side: "sell", type: "limit", status: "partially_filled", qty: 3, filledQty: 2, groupId: "g" }, "partial_fill"));
  assert.deepEqual(dropped, [], "2 of 3 sold, not 1 + 2 = 3: still held");
  await h.handle(up({ id: "new-tp", side: "sell", type: "limit", status: "filled", qty: 3, filledQty: 3, groupId: "g" }));
  assert.deepEqual(dropped, ["AAA"], "all 3 sold");
  // the same through Alpaca's own `replaces` field
  const h2dropped: string[] = [];
  const h2 = new OrderUpdateHandler({ getOrder: (id) => store.getOrder(id), closeOrder: async () => undefined, dropPosition: (s) => void h2dropped.push(s), now: () => t });
  await h2.handle(up({ clientOrderId: "cyrus-20261118-AAA-1", side: "buy", status: "filled", qty: 3, filledQty: 3, filledAvgPrice: 20, groupId: "g2" }));
  await h2.handle(up({ id: "o2", side: "sell", type: "limit", status: "partially_filled", qty: 3, filledQty: 1, groupId: "g2" }, "partial_fill"));
  await h2.handle(up({ id: "n2", side: "sell", type: "limit", status: "partially_filled", qty: 3, filledQty: 2, groupId: "g2", replaces: "o2" }, "partial_fill"));
  assert.deepEqual(h2dropped, []);
});

// ---- the summary ----
test("the summary never counts a replaced leg twice: an order a replacement replaced (looked up from the fills list) is left out", async () => {
  const { computeDay, partLines, replacedIds } = await import("../src/summary.ts");
  const entry = order({ id: "e1", clientOrderId: "cyrus-20261118-AAA-1", symbol: "AAA", side: "buy", status: "filled", qty: 3, filledQty: 3, filledAvgPrice: 20, filledAt: "2026-11-18T16:00:00Z", orderClass: "bracket", legs: [
    order({ id: "new-tp", clientOrderId: "cyrus-m-20261118-AAA-x", symbol: "AAA", side: "sell", type: "limit", status: "filled", qty: 3, filledQty: 3, filledAvgPrice: 20.1, filledAt: "2026-11-18T16:00:05Z", replaces: "old-tp" }),
    order({ id: "sl", symbol: "AAA", side: "sell", type: "stop", status: "canceled", qty: 3, filledQty: 0 }),
  ] });
  // the old take-profit had filled 1 share before the replace; the fills check fetched it by its id, as a top-level order
  const old = order({ id: "old-tp", symbol: "AAA", side: "sell", type: "limit", status: "replaced", qty: 3, filledQty: 1, filledAvgPrice: 20.1, filledAt: "2026-11-18T16:00:02Z" });
  assert.deepEqual([...replacedIds([entry, old])], ["old-tp"]);
  const day = computeDay([entry, old]);
  assert.equal(day.symbols[0]!.sold, 3, "3 sold, not 4");
  assert.ok(Math.abs(day.realized - 0.3) < 1e-9);
  assert.equal(day.unmatchedSellShares, 0);
  const rows = [{ clientOrderId: "cyrus-20261118-AAA-1", tradeDate: "2026-11-18", symbol: "AAA", qty: 3, referencePrice: 20, stopPrice: 19.92, status: "filled" as const, alpacaOrderId: "e1", filledQty: 3, filledAvgPrice: 20, note: null, createdAt: "2026-11-18T15:59:59Z", acceptMs: 50 }];
  assert.ok(partLines("Day", rows as never, [entry, old])[0]!.includes("Closed by take-profit 0, by stop 0 (+0.00 on those), closed later or still open 1"), "a close-out sale by a moved take-profit counts as closed later, like any close-out exit, not as a take-profit close");
});

test("the request math: a sale with moves costs today's trading requests plus 2 (round 1's fresh reads after the moves); each replace stands in for a sale", async () => {
  const run = async (moves: boolean) => {
    const w = world({ moves });
    await normal(w, "AAA", 10);
    await hold(w, "BBB", 4, 30, 29.88, 30.08);
    await loadDay(w, "CCC");
    const b0 = w.sim.bucketTimes.length;
    await w.liquidator.flatten({ reason: "close-out", tradeDate: D, returnWhenOnlyOwnSells: true });
    w.sim.advance(3_000);
    return { trading: w.sim.bucketTimes.length - b0, replaces: w.sim.replaceLog.length, sells: w.sim.sellLog.length, flat: w.sim.heldQty("AAA") + w.sim.heldQty("BBB") + w.sim.heldQty("CCC") === 0 };
  };
  const off = await run(false);
  const on = await run(true);
  assert.deepEqual([off.replaces, off.sells, off.flat], [0, 3, true]);
  assert.deepEqual([on.replaces, on.sells, on.flat], [2, 1, true]);
  assert.equal(on.trading, off.trading + 2, `with moves ${on.trading}, today ${off.trading}`);
});

// ---- through the worker (live updates connected, quotes wired, the order sync's copies, the close-out) ----
test("in the worker: the 2:55 close-out moves a qualifying take-profit (stop from the sync's copy), the live updates end the wait, one row is logged, every replace is tagged", async () => {
  const { rig, settle, z } = await import("./rig.ts");
  const { clientOrderIdFor } = await import("../src/gate.ts");
  const { routineSafetyCalls } = await import("./tag-audit.ts");
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.openShape20261118 = true;
  sim.replaceAnswerMs = 60;
  const auditBefore = routineSafetyCalls.length;
  const events: Array<{ e: string; d: Record<string, unknown> }> = [];
  const quoted: string[][] = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, midday: false, orderStream: true, log: (_l, e, d) => void events.push({ e, d: d ?? {} }), latestQuotes: async (symbols) => (quoted.push(symbols), new Map(symbols.map((s) => [s, { bid: sim.prices.get(s)!, ask: sim.prices.get(s)! + 0.01, atMs: sim.simMs }]))) });
  sim.onOrderEvent = (event, o, atMs) => void r.orderUpdate({ event, order: o, positionQty: null, atMs });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const id = clientOrderIdFor(D, "AAA", 1);
  await sim.submitEntry({ symbol: "AAA", qty: 10, stopPrice: 19.92, takeProfitPrice: 20.05, referencePrice: 20, clientOrderId: id });
  sim.fillEntry(id, 20);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "AAA", qty: 10, referencePrice: 20, stopPrice: 19.92, takeProfitPrice: 20.05, status: "filled", alpacaOrderId: sim.orders[0]!.id, filledQty: 10, filledAvgPrice: 20, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  await r.at("20:54:30");
  await r.at("20:55:00");
  for (let i = 0; i < 400 && !(await r.store.getDay(D))!.phases.closeout; i++) await settle();
  assert.equal(sim.heldQty("AAA"), 0, "flat");
  assert.equal(sim.replaceLog.length, 1, "the take-profit was moved");
  assert.equal(sim.sellLog.length, 0, "no market sale");
  assert.equal(quoted.length, 1);
  const row = events.find((x) => x.e === "take_profit_moved")?.d as unknown as MoveRow | undefined;
  assert.ok(row, "one row");
  assert.deepEqual([row.accepted, row.fallback, row.stopCancelledByAlpaca, row.limit, row.stopPrice], [true, false, true, 19.99, 19.92]);
  assert.ok(row.clientId?.startsWith("cyrus-m-"), "the stack's own client id");
  assert.equal(routineSafetyCalls.slice(auditBefore).filter((c) => c.fn === "replaceOrder").length, 0, "no replace sent outside a request scope (the shared budget counts it)");
  void z;
});

test("a fill that arrives before the replace's answer is caught (the move is expected before the send): no 2 s wait, no fallback", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  await loadDay(w, "BBB");
  w.sim.replaceFillDelayMs = 100;
  w.sim.replaceAnswerMs = 240; // the fill (0.1 s) comes before the answer (0.24 s)
  const t0 = w.sim.simMs;
  await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  assert.equal(w.rows()[0]!.fallback, false);
  assert.equal(w.rows()[0]!.timeToFillMs, 100);
  assert.ok(w.sim.sellLog[0]!.at - t0 < 1_000, `the other sale did not wait 2 s (${w.sim.sellLog[0]!.at - t0} ms)`);
});

test("a replace with no answer within its 2 s limit is unclear: no further replace, the fallback cancels whatever happened, and the row says what the updates saw", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  await hold(w, "CCC", 5, 30, 29.88, 30.08);
  w.sim.replaceAnswerMs = 2_500; // past MOVE_REPLACE_TIMEOUT_MS; the replace happened at Alpaca all the same
  w.sim.replaceFillDelayMs = 5_000; // and its selling limit does not fill before today's path cancels it
  w.sim.setPrice("AAA", 19.995);
  await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  w.sim.advance(3_000);
  assert.equal(w.sim.replaceLog.length, 1, "no second replace after an unclear answer");
  assert.equal(w.sim.heldQty("AAA") + w.sim.heldQty("CCC"), 0, "both sold by today's path");
  assert.equal(w.sim.oversellAttempts, 0);
  const row = w.rows().find((x) => x.symbol === "AAA")!;
  assert.ok(row.answer?.startsWith("unclear"));
  assert.ok(row.newId, "the new id seen in the live updates is recorded");
});

test("a burst of live updates during the wait does not end it early: the count backstop is far above the updates a sale's moves make", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 20, 50));
  sim.openShape20261118 = true;
  const watch = new MoveWatch(() => sim.simMs);
  sim.onOrderEvent = (event, o, atMs) => watch.onUpdate({ event, order: o, positionQty: null, atMs });
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
  let wakes = 0;
  // An update for these symbols every 50 ms (40 in the 2 s, ten times a move's own 3 or 4).
  const waitEvent = async (_s: ReadonlySet<string>, ms: number) => { const step = Math.min(ms, 50); sim.advance(step); wakes++; return step < ms; };
  const quotes = async (symbols: string[]) => new Map(symbols.map((s) => [s, { bid: sim.prices.get(s)!, ask: sim.prices.get(s)! + 0.01, atMs: sim.simMs }]));
  const stopsFor = async (legs: Array<{ legId: string; groupId: string }>) => new Map(legs.map((l) => [l.legId, sim.orders.find((o) => o.groupId === l.groupId)!.legs.find((x) => x.type === "stop")!.stopPrice!]));
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, waitEvent, moves: { quotes, stopsFor, watch } });
  const id = "cyrus-20261102-AAA-1";
  await sim.submitEntry({ symbol: "AAA", qty: 10, stopPrice: 19.92, takeProfitPrice: 20.05, referencePrice: 20, clientOrderId: id });
  sim.fillEntry(id, 20);
  sim.replaceFillDelayMs = 1_600;
  await liquidator.flatten({ reason: "close-out", tradeDate: D });
  assert.equal(sim.sellLog.length, 0, "the move filled at 1.6 s; it was not cancelled by an early end of the wait");
  assert.equal(sim.heldQty("AAA"), 0);
  assert.ok(wakes <= 40 + 20 * 1, `bounded (${wakes} waits)`);
});
