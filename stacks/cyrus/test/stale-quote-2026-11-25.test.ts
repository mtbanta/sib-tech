// Michael's decision 4 of 2026-11-25 (builds/build-c2-log.md, "Michael's decisions from Wednesday's mid-day review"): "Yes: if the quote is
// older than 30 s but the latest trade is at most 10 s old, price the move from the latest trade minus 1 cent (same checks and fallback)."
// At the 10:30 close-out of 2026-11-25 AMBA-99's exit pair was skipped for a quote 32 s old while its latest trade was 230 ms old.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { MOVE_QUOTE_MAX_AGE_MS, MOVE_TRADE_MAX_AGE_MS, MoveWatch, type MoveRow, pricedMoves } from "../src/moved-take-profit.ts";
import { SimBroker } from "./sim-broker.ts";

const now = 1_000_000;
// AMBA-99's pair at 10:30 on 2026-11-25 (the stored `move_phase_skips` row): stop 35.53, the pair's limit 35.76.
const amba = [{ symbol: "AMBA", qty: 1, legId: "pp", groupId: "g", oldLimit: 35.76, stopPrice: 35.53, pair: { legIds: ["leg"] } }];
const quote = (bid: number, quoteAgeMs: number, trade: number | null, tradeAgeMs = 0) => new Map([["AMBA", { bid, ask: bid + 0.01, atMs: now - quoteAgeMs, ...(trade !== null ? { tradePrice: trade, tradeAtMs: now - tradeAgeMs } : {}) }]]);

test("decision 4 of 2026-11-25: AMBA-99 at the 10:30 close-out (quote 31.7 s old, bid 34.67, trade 35.61 230 ms old, stop 35.53) moves at 35.60, priced from the trade because the quote was stale", () => {
  assert.equal(MOVE_QUOTE_MAX_AGE_MS, 30_000);
  assert.equal(MOVE_TRADE_MAX_AGE_MS, 10_000);
  const r = pricedMoves(amba, quote(34.67, 31_747, 35.61, 230), now);
  assert.equal(r.skipped.length, 0);
  const m = r.moves[0]!;
  assert.deepEqual([m.limit, m.priceFrom, m.bid, m.quoteAgeMs, m.tradePrice, m.tradeAgeMs], [35.6, "trade_stale_quote", 34.67, 31_747, 35.61, 230]);
  assert.deepEqual(m.pair, { legIds: ["leg"] }, "an exit pair moves by the same rule");
});

test("decision 4: the trade's limit is 10 s inclusive: a trade exactly 10,000 ms old prices the move; 10,001 ms old is skipped with today's reason", () => {
  assert.equal(pricedMoves(amba, quote(34.67, 32_000, 35.61, 10_000), now).moves[0]?.priceFrom, "trade_stale_quote");
  const over = pricedMoves(amba, quote(34.67, 32_000, 35.61, 10_001), now);
  assert.equal(over.moves.length, 0);
  assert.equal(over.skipped[0]!.why, "quote 32 s old");
  assert.equal(over.skipped[0]!.tradeAgeMs, 10_001);
});

test("decision 4: the quote's limit is unchanged (30 s inclusive): exactly 30,000 ms old is a fresh quote (priced as before); 30,001 ms old takes the trade", () => {
  // A fresh quote whose bid gives a good limit: priced from the bid, as before, even with a trade present.
  const at30 = pricedMoves(amba, quote(35.7, 30_000, 35.61, 230), now).moves[0]!;
  assert.deepEqual([at30.limit, at30.priceFrom], [35.69, "bid"]);
  const past = pricedMoves(amba, quote(35.7, 30_001, 35.61, 230), now).moves[0]!;
  assert.deepEqual([past.limit, past.priceFrom], [35.6, "trade_stale_quote"], "the stale bid (35.70) is not used");
  // At exactly 30 s with the bid below the stop, today's decision 2 of 2026-11-24 still applies (priced from the trade as "trade").
  assert.equal(pricedMoves(amba, quote(34.67, 30_000, 35.61, 230), now).moves[0]?.priceFrom, "trade");
});

test("decision 4: a stale quote with no trade, or with a trade over 10 s old, is skipped as today (SLF at 10:30 on 2026-11-25: quote 75 s, trade 71.7 s)", () => {
  const none = pricedMoves(amba, quote(34.67, 32_000, null), now);
  assert.deepEqual(none.skipped.map((s) => s.why), ["quote 32 s old"]);
  const slf = pricedMoves([{ symbol: "AMBA", qty: 1, legId: "tp", groupId: "g", oldLimit: 69.88, stopPrice: 69.43 }], quote(69.41, 75_190, 69.66, 71_655), now);
  assert.deepEqual(slf.skipped.map((s) => s.why), ["quote 75 s old"]);
  assert.equal(slf.moves.length, 0);
});

test("decision 4: the same checks on the trade's price: within the 2 cent margin above the stop, or at or above the old take-profit, it is skipped, and the reason says the price came from the trade because the quote was stale", () => {
  const thin = pricedMoves(amba, quote(34.67, 32_000, 35.55, 230), now); // 35.54 is 1 cent above the stop
  assert.equal(thin.moves.length, 0);
  assert.equal(thin.skipped[0]!.why, "price within 2 cents of the stop (from the latest trade; the quote is 32 s old)");
  const atMargin = pricedMoves(amba, quote(34.67, 32_000, 35.56, 230), now); // 35.55, exactly 2 cents above: moves
  assert.deepEqual([atMargin.moves[0]?.limit, atMargin.moves[0]?.priceFrom], [35.55, "trade_stale_quote"]);
  const below = pricedMoves(amba, quote(34.67, 32_000, 35.4, 230), now); // the trade below the stop
  assert.equal(below.skipped[0]!.why, "price within 2 cents of the stop (from the latest trade; the quote is 32 s old)");
  const high = pricedMoves(amba, quote(34.67, 32_000, 35.8, 230), now); // 35.79, above the pair's 35.76
  assert.equal(high.skipped[0]!.why, "take-profit already at or below the price (from the latest trade; the quote is 32 s old)");
  // The bid is not required below the stop in this case (it is stale): a stale bid above the stop changes nothing.
  assert.equal(pricedMoves(amba, quote(36, 32_000, 35.61, 230), now).moves[0]?.limit, 35.6);
});

// ------------------------------------------------------------- in a sale -------------------------------------------------------------
const D = "2026-11-02";
function world() {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 20, 50));
  sim.openShape20261118 = true;
  const logs: Array<{ e: string; d: Record<string, unknown> }> = [];
  const log = (e: string, d?: Record<string, unknown>) => void logs.push({ e, d: d ?? {} });
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs, log });
  const watch = new MoveWatch(() => sim.simMs);
  sim.onOrderEvent = (event, o, atMs) => watch.onUpdate({ event, order: o, positionQty: null, atMs });
  const q = { bid: 0, ageMs: 0, trade: 0, tradeAgeMs: 0 };
  const moves = {
    quotes: async (symbols: string[]) => new Map(symbols.map((s) => [s, { bid: q.bid, ask: q.bid + 0.01, atMs: sim.simMs - q.ageMs, tradePrice: q.trade, tradeAtMs: sim.simMs - q.tradeAgeMs }])),
    stopsFor: async (legs: Array<{ legId: string; groupId: string; symbol: string }>) => {
      const out = new Map<string, number>();
      for (const l of legs) {
        const stop = sim.orders.find((o) => o.groupId === l.groupId)?.legs.find((x) => x.type === "stop" || x.status === "replaced")?.stopPrice;
        if (stop) out.set(l.legId, stop);
      }
      return out;
    },
    watch,
    room: () => true,
  };
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log, moves });
  const rows = () => logs.filter((l) => l.e === "take_profit_moved").map((l) => l.d as unknown as MoveRow);
  return { sim, q, liquidator, rows };
}
async function hold(w: ReturnType<typeof world>, symbol: string, qty: number, price: number, stop: number, tp: number) {
  const id = `cyrus-${D.replaceAll("-", "")}-${symbol}-1`;
  await w.sim.submitEntry({ symbol, qty, stopPrice: stop, takeProfitPrice: tp, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
}

test("decision 4, in a close-out: a stale quote with a fresh trade sends the move at the trade less 1 cent and its row says so; filled, nothing else is sold; not filled, today's fallback sells", async () => {
  const a = world();
  await hold(a, "AMBA", 3, 35.6, 35.53, 35.76);
  Object.assign(a.q, { bid: 34.67, ageMs: 31_747, trade: 35.61, tradeAgeMs: 230 });
  await a.liquidator.flatten({ reason: "mid-day close-out", tradeDate: D });
  a.sim.advance(3_000);
  const r = a.rows()[0]!;
  assert.deepEqual([r.limit, r.priceFrom, r.accepted, r.quoteAgeMs, r.tradePrice, r.tradeAgeMs], [35.6, "trade_stale_quote", true, 31_747, 35.61, 230]);
  assert.equal(a.sim.heldQty("AMBA"), 0);
  assert.equal(a.sim.sellLog.length, 0, "the move sold it");
  const b = world();
  await hold(b, "AMBA", 3, 35.6, 35.53, 35.76);
  b.sim.setPrice("AMBA", 35.57); // the market is below the trade-priced limit: the move rests
  Object.assign(b.q, { bid: 34.67, ageMs: 31_747, trade: 35.61, tradeAgeMs: 230 });
  await b.liquidator.flatten({ reason: "mid-day close-out", tradeDate: D });
  b.sim.advance(3_000);
  const rb = b.rows()[0]!;
  assert.equal(rb.priceFrom, "trade_stale_quote");
  assert.deepEqual([rb.fallback, rb.fallbackSoldQty], [true, 3], "today's fallback sold the shares");
  assert.equal(b.sim.heldQty("AMBA"), 0);
  // A stale quote with a stale trade: no move at all; today's path sells at market.
  const c = world();
  await hold(c, "AMBA", 3, 35.6, 35.53, 35.76);
  Object.assign(c.q, { bid: 34.67, ageMs: 31_747, trade: 35.61, tradeAgeMs: 10_001 });
  await c.liquidator.flatten({ reason: "mid-day close-out", tradeDate: D });
  c.sim.advance(3_000);
  assert.equal(c.rows().length, 0);
  assert.deepEqual(c.sim.sellLog.map((x) => [x.symbol, x.qty]), [["AMBA", 3]]);
});
