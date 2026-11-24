// Michael's decisions of 2026-11-24 (builds/build-c2-log.md, "Michael's decisions from Monday's end-of-day review and Tuesday's mid-day
// review"), item 2: "When the bid is below the stop but the latest trade (from the same snapshot) is above it, price the move from the latest
// trade minus 1 cent; today's fallback still applies if it does not fill." With his answer: "10 s limit on the latest trade's age."
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { MOVE_TRADE_MAX_AGE_MS, MoveWatch, type MoveRow, pricedMoves } from "../src/moved-take-profit.ts";
import { SimBroker } from "./sim-broker.ts";

const D = "2026-11-02";

function world(opts: { room?: () => boolean; logThrowsOn?: string; quotesFail?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 20, 50));
  sim.openShape20261118 = true;
  const logs: Array<{ e: string; d: Record<string, unknown> }> = [];
  const log = (e: string, d?: Record<string, unknown>) => {
    if (e === opts.logThrowsOn) throw new Error("log boom");
    logs.push({ e, d: d ?? {} });
  };
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs, log });
  const watch = new MoveWatch(() => sim.simMs);
  sim.onOrderEvent = (event, o, atMs) => watch.onUpdate({ event, order: o, positionQty: null, atMs });
  const bids = new Map<string, number>();
  const ages = new Map<string, number>(); // quote age in ms at the read (default 0)
  const trades = new Map<string, { price: number; ageMs: number }>();
  const quoteCalls: string[][] = [];
  const moves = {
    quotes: async (symbols: string[]) => {
      quoteCalls.push(symbols);
      if (opts.quotesFail) throw new Error("market data down");
      return new Map(symbols.map((s) => {
        const bid = bids.get(s) ?? sim.prices.get(s)!;
        const t = trades.get(s);
        return [s, { bid, ask: bid + 0.01, atMs: sim.simMs - (ages.get(s) ?? 0), ...(t ? { tradePrice: t.price, tradeAtMs: sim.simMs - t.ageMs } : {}) }];
      }));
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
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log, moves });
  const rows = () => logs.filter((l) => l.e === "take_profit_moved").map((l) => l.d as unknown as MoveRow);
  const skips = () => logs.filter((l) => l.e === "move_phase_skips").map((l) => l.d as { reason: string; positions: number; moved: number; skipped: Array<Record<string, unknown>>; more?: number });
  return { sim, logs, bids, ages, trades, quoteCalls, liquidator, rows, skips, gate };
}

async function hold(w: ReturnType<typeof world>, symbol: string, qty: number, price: number, stop: number, tp: number, n = 1) {
  const id = `cyrus-${D.replaceAll("-", "")}-${symbol}-${n}`;
  await w.sim.submitEntry({ symbol, qty, stopPrice: stop, takeProfitPrice: tp, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  return id;
}

const now = 1_000_000;
const cand = (stop: number, oldLimit: number) => [{ symbol: "BIP", qty: 1, legId: "tp", groupId: "g", oldLimit, stopPrice: stop }];
const quote = (bid: number, trade: number | null, tradeAgeMs: number, quoteAgeMs = 0) => new Map([["BIP", { bid, ask: bid + 0.01, atMs: now - quoteAgeMs, ...(trade !== null ? { tradePrice: trade, tradeAtMs: now - tradeAgeMs } : {}) }]]);

test("item 2 of 2026-11-24: BIP at the 10:30 close-out of 2026-11-24 (bid 43.13 below the stop 44.68, trade 44.72 3 s old) moves at the trade less 1 cent, priced from the trade", () => {
  assert.equal(MOVE_TRADE_MAX_AGE_MS, 10_000);
  const r = pricedMoves(cand(44.68, 44.97), quote(43.13, 44.72, 3_000, 3_000), now);
  assert.equal(r.skipped.length, 0);
  const m = r.moves[0]!;
  assert.deepEqual([m.limit, m.priceFrom, m.bid, m.tradePrice, m.tradeAgeMs], [44.71, "trade", 43.13, 44.72, 3_000]);
});

test("item 2: the trade's age limit is 10 s (Michael's answer): 10 s moves, just over is skipped as before; SJM's 260 s old trade is skipped", () => {
  assert.equal(pricedMoves(cand(44.68, 44.97), quote(43.13, 44.72, 10_000), now).moves[0]?.priceFrom, "trade");
  const over = pricedMoves(cand(44.68, 44.97), quote(43.13, 44.72, 10_001), now);
  assert.equal(over.moves.length, 0);
  assert.equal(over.skipped[0]!.why, "price within 2 cents of the stop", "the old skip, unchanged");
  const sjm = pricedMoves([{ symbol: "BIP", qty: 1, legId: "tp", groupId: "g", oldLimit: 133.55, stopPrice: 132.69 }], quote(126.07, 133.06, 260_000), now);
  assert.equal(sjm.moves.length, 0);
});

test("item 2: only when the bid is BELOW the stop: a bid at or just above the stop (within the 2 cent margin) keeps today's skip even with a trade above (AAL on 2026-11-19: bid 12.80, stop 12.78, trade 12.81)", () => {
  const aal = pricedMoves([{ symbol: "BIP", qty: 1, legId: "tp", groupId: "g", oldLimit: 12.86, stopPrice: 12.78 }], quote(12.8, 12.81, 1_000), now);
  assert.equal(aal.moves.length, 0);
  assert.equal(aal.skipped[0]!.why, "price within 2 cents of the stop");
  const atStop = pricedMoves(cand(44.68, 44.97), quote(44.68, 44.75, 1_000), now);
  assert.equal(atStop.moves.length, 0, "a bid exactly at the stop is not below it");
});

test("item 2: the trade-priced limit must pass the same rules: the 2 cent margin above the stop (worded as from the trade), below the old take-profit, and the quote's own age first", () => {
  const thin = pricedMoves(cand(44.68, 44.97), quote(43.13, 44.7, 1_000), now); // 44.69 is 1 cent above the stop
  assert.equal(thin.moves.length, 0);
  assert.equal(thin.skipped[0]!.why, "price within 2 cents of the stop (from the latest trade; the bid is below the stop)");
  const high = pricedMoves(cand(44.68, 44.97), quote(43.13, 45.1, 1_000), now); // 45.09 is above the old take-profit
  assert.equal(high.skipped[0]!.why, "take-profit already at or below the price");
  const stale = pricedMoves(cand(44.68, 44.97), quote(43.13, 44.72, 1_000, 31_000), now);
  assert.equal(stale.skipped[0]!.why, "quote 31 s old");
  const below = pricedMoves(cand(44.68, 44.97), quote(43.13, 44.6, 1_000), now); // the trade is below the stop too
  assert.equal(below.skipped[0]!.why, "price within 2 cents of the stop");
  const none = pricedMoves(cand(44.68, 44.97), quote(43.13, null, 0), now);
  assert.equal(none.skipped[0]!.why, "price within 2 cents of the stop");
});

test("item 2: a normal bid prices from the bid as before (priceFrom bid)", () => {
  const m = pricedMoves(cand(44.68, 44.97), quote(44.9, 44.95, 1_000), now).moves[0]!;
  assert.deepEqual([m.limit, m.priceFrom], [44.89, "bid"]);
});

test("item 2, in a close-out: the move is sent at the trade less 1 cent and its row says so; filled, nothing else is sold; not filled, today's fallback sells", async () => {
  const a = world();
  await hold(a, "BIP", 3, 44.75, 44.68, 44.97);
  a.bids.set("BIP", 43.13);
  a.trades.set("BIP", { price: 44.72, ageMs: 3_000 });
  await a.liquidator.flatten({ reason: "close-out", tradeDate: D });
  a.sim.advance(3_000);
  const r = a.rows()[0]!;
  assert.deepEqual([r.limit, r.priceFrom, r.accepted], [44.71, "trade", true]);
  assert.equal(a.sim.heldQty("BIP"), 0);
  assert.equal(a.sim.sellLog.length, 0, "the move sold it");
  const b = world();
  await hold(b, "BIP", 3, 44.75, 44.68, 44.97);
  b.sim.setPrice("BIP", 44.69); // the market is below the trade-priced limit: the move rests
  b.bids.set("BIP", 43.13);
  b.trades.set("BIP", { price: 44.72, ageMs: 3_000 });
  await b.liquidator.flatten({ reason: "close-out", tradeDate: D });
  b.sim.advance(3_000);
  const rb = b.rows()[0]!;
  assert.equal(rb.priceFrom, "trade");
  assert.deepEqual([rb.fallback, rb.fallbackSoldQty], [true, 3], "today's fallback sold the shares");
  assert.equal(b.sim.heldQty("BIP"), 0);
});

// ---------------- item 5: a failed overnight not-flat check posts an alert ----------------
import { FakeBot, FakeBroker } from "./helpers.ts";
import { rig } from "./rig.ts";
import { NOT_FLAT_FAIL_ALERT_MS } from "../src/worker.ts";

function overnightRig() {
  const b = new FakeBroker();
  b.calendar = [{ date: "2026-11-02", open: "09:30", close: "16:00" }, { date: "2026-11-03", open: "09:30", close: "16:00" }];
  b.clock = { isOpen: false, timestamp: "", nextOpen: "", nextClose: "" };
  let fail = true;
  const real = b.listPositions.bind(b);
  b.listPositions = async () => {
    if (fail) throw new Error("timeout of 10000 ms (test)");
    return real();
  };
  const bot = new FakeBot();
  const r = rig({ broker: b, bot });
  return { r, bot, setFail: (x: boolean) => void (fail = x) };
}
const failAlerts = (bot: FakeBot) => bot.posts.filter((p) => p.channel === "alerts" && p.text.includes("overnight not-flat check failed"));

test("item 5 of 2026-11-24: a not-flat check that fails outside the session (Monday's 2:11 AM timeout) posts an alert in alerts, without a mention; again only after 30 minutes while it keeps failing", async () => {
  assert.equal(NOT_FLAT_FAIL_ALERT_MS, 30 * 60_000);
  const { r, bot } = overnightRig();
  await r.at("2026-11-03T08:11:00Z"); // 2:11 AM Central
  const first = failAlerts(bot);
  assert.equal(first.length, 1);
  assert.equal(first[0]!.mention, false, "no mention (Michael's answer)");
  assert.match(first[0]!.text, /timeout of 10000 ms \(test\)/);
  assert.match(first[0]!.text, /Paper trading only\./);
  await r.at("2026-11-03T08:11:05Z");
  await r.at("2026-11-03T08:40:00Z");
  assert.equal(failAlerts(bot).length, 1, "not again within 30 minutes");
  await r.at("2026-11-03T08:41:05Z");
  assert.equal(failAlerts(bot).length, 2, "again after 30 minutes");
});

test("item 5: a check that succeeds posts nothing; a failure during the session posts no such alert (the decision is for overnight checks)", async () => {
  const ok = overnightRig();
  ok.setFail(false);
  await ok.r.at("2026-11-03T08:11:00Z");
  assert.equal(failAlerts(ok.bot).length, 0);
  const inSession = overnightRig();
  await inSession.r.at("2026-11-03T16:00:00Z"); // 10:00 AM Central, in the session
  assert.equal(failAlerts(inSession.bot).length, 0);
});
