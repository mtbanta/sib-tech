// Michael's request of 2026-11-19 (about 11:15 AM CT) and his answer to the quote question (about 11:20 AM CT): the moved take-profit accepts a
// quote up to 30 s old (was 5 s), relying on the fallback with the stop still live; the quote is read in one multi-symbol snapshot request;
// every move phase stores why each position was skipped (`move_phase_skips`), and each move row stores whether the backup step actually sold
// (`fallbackSoldQty`). Against the simulator in its 2026-11-18 mode, as in moved-take-profit-2026-11-18.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { MOVE_QUOTE_MAX_AGE_MS, MoveWatch, type MoveRow, pricedMoves } from "../src/moved-take-profit.ts";
import { AlpacaData } from "../src/alpaca-data.ts";
import { STORED_INFO_EVENTS } from "../src/run-log.ts";
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
const normal = (w: ReturnType<typeof world>, s: string, qty = 10, p = 20) => hold(w, s, qty, p, 19.92, 20.05);
const loadDay = (w: ReturnType<typeof world>, s: string, p = 5) => hold(w, s, 1, p, p - 0.02, p + 0.01);

test("the stale limit is 30 s: a quote 29 s old moves from the bid; one 31 s old is skipped with its prices and the snapshot's last trade when that trade is over 10 s old, and priced from a trade at most 10 s old (Michael's decision 4 of 2026-11-25)", () => {
  assert.equal(MOVE_QUOTE_MAX_AGE_MS, 30_000);
  const c = [{ symbol: "AAA", qty: 1, legId: "tp", groupId: "g", oldLimit: 20.05, stopPrice: 19.95 }];
  const now = 1_000_000;
  const q = (ageMs: number) => new Map([["AAA", { bid: 19.99, ask: 20, atMs: now - ageMs, tradePrice: 19.995, tradeAtMs: now - 4_000 }]]);
  const m = pricedMoves(c, q(29_000), now).moves[0]!;
  assert.deepEqual([m.limit, m.quoteAgeMs, m.tradePrice, m.tradeAgeMs], [19.98, 29_000, 19.995, 4_000]);
  assert.equal(pricedMoves(c, q(6_000), now).moves.length, 1, "6 s: skipped under the old 5 s limit, moves now (TGT and WPM's 3.3 and 3.5 s, AU's 5.9 s on 2026-11-19)");
  const qOld = (ageMs: number, tradeAgeMs: number) => new Map([["AAA", { bid: 19.99, ask: 20, atMs: now - ageMs, tradePrice: 19.995, tradeAtMs: now - tradeAgeMs }]]);
  const s = pricedMoves(c, qOld(31_000, 11_000), now);
  assert.equal(s.moves.length, 0);
  assert.deepEqual(s.skipped[0], { symbol: "AAA", why: "quote 31 s old", stopPrice: 19.95, oldLimit: 20.05, bid: 19.99, quoteAgeMs: 31_000, tradePrice: 19.995, tradeAgeMs: 11_000 });
  // Decision 4 of 2026-11-25: the same stale quote with its trade 4 s old is priced from the trade (19.995 less 1 cent, floored: 19.98).
  const fromTrade = pricedMoves(c, q(31_000), now).moves[0]!;
  assert.deepEqual([fromTrade.limit, fromTrade.priceFrom, fromTrade.quoteAgeMs], [19.98, "trade_stale_quote", 31_000]);
  const noTrade = pricedMoves(c, new Map([["AAA", { bid: 19.9, ask: 20, atMs: now }]]), now).skipped[0]!;
  assert.deepEqual([noTrade.why, noTrade.tradePrice, noTrade.tradeAgeMs], ["price within 2 cents of the stop", null, null]);
});

test("the quote read is ONE multi-symbol snapshot request on the configured feed; a symbol without a usable quote is left out; the trade is kept", async () => {
  const calls: string[] = [];
  const fakeFetch = (async (url: URL | string) => {
    calls.push(String(url));
    const body = {
      AAA: { latestQuote: { bp: 19.99, ap: 20, t: "2026-11-19T16:30:05.000Z" }, latestTrade: { p: 19.995, t: "2026-11-19T16:30:04.000Z" } },
      BBB: { latestQuote: { bp: 0, ap: 0, t: "2026-11-19T16:30:05.000Z" }, latestTrade: { p: 5, t: "2026-11-19T16:30:04.000Z" } },
      CCC: { latestQuote: { bp: 7.1, ap: 7.12, t: "2026-11-19T16:29:00.000Z" }, latestTrade: null },
      DDD: null,
    };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  const data = new AlpacaData({ alpaca: { dataBaseUrl: "https://data.example", keyId: "k", secretKey: "s", dataFeed: "iex" } } as never, fakeFetch);
  const q = await data.latestQuotes(["AAA", "BBB", "CCC", "DDD", "AAA", "bad symbol"]);
  assert.equal(calls.length, 1, "one request for every symbol");
  const u = new URL(calls[0]!);
  assert.equal(u.pathname, "/v2/stocks/snapshots");
  assert.equal(u.searchParams.get("symbols"), "AAA,BBB,CCC,DDD");
  assert.equal(u.searchParams.get("feed"), "iex");
  assert.deepEqual([...q.keys()], ["AAA", "CCC"], "BBB has no usable bid, DDD no snapshot");
  assert.deepEqual(q.get("AAA"), { bid: 19.99, ask: 20, atMs: Date.parse("2026-11-19T16:30:05.000Z"), tradePrice: 19.995, tradeAtMs: Date.parse("2026-11-19T16:30:04.000Z") });
  assert.deepEqual(q.get("CCC"), { bid: 7.1, ask: 7.12, atMs: Date.parse("2026-11-19T16:29:00.000Z") }, "no trade fields when the snapshot carried none");
  // The wrapped shape is read too.
  const wrapped = (async () => new Response(JSON.stringify({ snapshots: { AAA: { latestQuote: { bp: 1, ap: 1.01, t: "2026-11-19T16:30:05.000Z" } } } }), { status: 200 })) as unknown as typeof fetch;
  assert.deepEqual([...(await new AlpacaData({ alpaca: { dataBaseUrl: "https://data.example", keyId: "k", secretKey: "s", dataFeed: "iex" } } as never, wrapped).latestQuotes(["AAA"])).keys()], ["AAA"]);
  assert.equal((await data.latestQuotes([])).size, 0);
  assert.equal(calls.length, 1, "no request for no symbols");
});

test("a sale with moves stores why every other position was skipped (one row, the stage that skipped each, with its prices); the old 5 s case now moves", async () => {
  const w = world();
  await normal(w, "AAA", 10); // quote 6 s old: moves under 30 s
  await normal(w, "BBB", 10); // quote 40 s old: skipped
  await normal(w, "CCC", 10); // bid 19.94: limit 19.93, 1 cent above the stop: skipped
  await loadDay(w, "DDD"); // a load bracket at bid 5.00: limit 4.99, 1 cent above its stop (since decision A of 2026-11-19 it reaches the price step)
  w.ages.set("AAA", 6_000);
  w.ages.set("BBB", 40_000);
  w.trades.set("BBB", { price: 20.01, ageMs: 50_000 });
  w.bids.set("CCC", 19.94);
  await w.liquidator.flatten({ reason: "mid-day close-out", tradeDate: D });
  w.sim.advance(3_000);
  assert.deepEqual(w.rows().map((r) => r.symbol), ["AAA"]);
  assert.equal(w.rows()[0]!.quoteAgeMs, 6_000);
  const sk = w.skips();
  assert.equal(sk.length, 1, "one row per move phase");
  assert.deepEqual([sk[0]!.reason, sk[0]!.positions, sk[0]!.moved], ["mid-day close-out", 4, 1]);
  const by = Object.fromEntries(sk[0]!.skipped.map((s) => [s.symbol, s]));
  assert.equal(by.BBB!.why, "quote 40 s old");
  assert.deepEqual([by.BBB!.bid, by.BBB!.quoteAgeMs, by.BBB!.tradePrice, by.BBB!.tradeAgeMs, by.BBB!.stopPrice, by.BBB!.oldLimit], [20, 40_000, 20.01, 50_000, 19.92, 20.05]);
  assert.equal(by.CCC!.why, "price within 2 cents of the stop");
  assert.deepEqual([by.DDD!.why, by.DDD!.bid, by.DDD!.stopPrice, by.DDD!.oldLimit], ["price within 2 cents of the stop", 5, 4.98, 5.01]);
  assert.deepEqual(Object.keys(by).sort(), ["BBB", "CCC", "DDD"]);
  assert.equal(w.sim.heldQty("BBB") + w.sim.heldQty("CCC") + w.sim.heldQty("DDD") + w.sim.heldQty("AAA"), 0, "all sold");
  assert.ok(STORED_INFO_EVENTS.has("move_phase_skips"), "stored in the run log, not only Fly's log");
});

test("a sale with no move still stores its skips: before any quote read when nothing could qualify (take-profits 2 cents above their stops), after one read for a load day's brackets (since decision A of 2026-11-19), and with no read at all when nothing is held", async () => {
  const w = world();
  await hold(w, "AAA", 1, 5, 4.99, 5.01); // take-profit 2 cents above the stop: no selling limit can be 2 cents above the stop and below it
  await hold(w, "BBB", 1, 7, 6.99, 7.01);
  await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  w.sim.advance(3_000);
  assert.equal(w.quoteCalls.length, 0, "no quote read");
  const sk = w.skips();
  assert.equal(sk.length, 1);
  assert.deepEqual(sk[0]!.skipped.map((s) => [s.symbol, s.why]), [["AAA", "take-profit within 3 cents of the stop"], ["BBB", "take-profit within 3 cents of the stop"]]);
  assert.equal(sk[0]!.moved, 0);
  const ld = world();
  await loadDay(ld, "AAA");
  await loadDay(ld, "BBB", 7);
  await ld.liquidator.flatten({ reason: "close-out", tradeDate: D });
  ld.sim.advance(3_000);
  assert.equal(ld.quoteCalls.length, 1, "a load day's brackets (1 cent up, 2 down): one quote read since decision A (none before)");
  assert.equal(ld.sim.replaceLog.length, 0, "bids at the entry price: no move");
  assert.deepEqual(ld.skips()[0]!.skipped.map((s) => [s.symbol, s.why]), [["AAA", "price within 2 cents of the stop"], ["BBB", "price within 2 cents of the stop"]]);
  assert.equal(ld.sim.heldQty("AAA") + ld.sim.heldQty("BBB"), 0, "both sold by today's path");
  const empty = world();
  await empty.liquidator.flatten({ reason: "close-out", tradeDate: D });
  assert.equal(empty.skips().length, 0, "nothing held: nothing to say");
});

test("moves not sent are stored with why: no room in the request budget", async () => {
  const w = world({ room: () => false });
  await normal(w, "AAA", 10);
  await normal(w, "BBB", 10);
  await w.liquidator.flatten({ reason: "flatten command", tradeDate: D });
  w.sim.advance(3_000);
  assert.equal(w.sim.replaceLog.length, 0);
  assert.deepEqual(w.skips()[0]!.skipped.map((s) => [s.symbol, s.why]), [["AAA", "no room in the request budget"], ["BBB", "no room in the request budget"]]);
  assert.equal(w.sim.heldQty("AAA") + w.sim.heldQty("BBB"), 0, "sold by today's path");
});

test("whether the backup step sold: 0 when the move sold the shares (even when it filled after the wait's read), the shares sent when the fallback sold them", async () => {
  // The move fills in the wait: no backup sale.
  const a = world();
  await normal(a, "AAA", 10);
  await a.liquidator.flatten({ reason: "close-out", tradeDate: D });
  a.sim.advance(3_000);
  assert.deepEqual([a.rows()[0]!.fallback, a.rows()[0]!.fallbackSoldQty], [false, 0]);
  // 2026-11-19's case: the move fills just after the wait (the read says still held), before the fallback acts: fallback true, sold 0.
  const b = world();
  await normal(b, "AAA", 10);
  b.sim.replaceFillDelayMs = 2_100;
  await b.liquidator.flatten({ reason: "close-out", tradeDate: D });
  b.sim.advance(3_000);
  assert.equal(b.sim.sellLog.length, 0);
  assert.deepEqual([b.rows()[0]!.fallback, b.rows()[0]!.fallbackSoldQty], [true, 0], "the backup step ran but sold nothing");
  // The move does not fill (the price fell below the limit): the backup sells all 10.
  const c = world();
  await normal(c, "AAA", 10);
  c.sim.setPrice("AAA", 19.97);
  c.bids.set("AAA", 20);
  await c.liquidator.flatten({ reason: "close-out", tradeDate: D });
  c.sim.advance(3_000);
  assert.equal(c.sim.sellLog.length, 1);
  assert.deepEqual([c.rows()[0]!.fallback, c.rows()[0]!.fallbackSoldQty], [true, 10]);
  assert.equal(c.sim.heldQty("AAA"), 0);
  // A refused replace: never sent, the backup sold it.
  const d = world();
  await normal(d, "AAA", 10);
  d.sim.refuseReplaceIf = () => 422;
  await d.liquidator.flatten({ reason: "close-out", tradeDate: D });
  d.sim.advance(3_000);
  assert.deepEqual([d.rows()[0]!.accepted, d.rows()[0]!.fallbackSoldQty], [false, 10]);
});

test("the move row carries the snapshot's last trade for the record; the selling limit still comes from the bid alone", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  w.trades.set("AAA", { price: 20.03, ageMs: 1_500 });
  await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  w.sim.advance(3_000);
  const r = w.rows()[0]!;
  assert.deepEqual([r.limit, r.bid, r.tradePrice, r.tradeAgeMs], [19.99, 20, 20.03, 1_500]);
});

test("group 2, round 1 note: the skip row lists at most 40 positions and counts the rest; with 35 qualifying, 30 move and the other 5 are listed once (more than 30), nothing moved is listed", async () => {
  const w = world();
  for (let i = 0; i < 45; i++) await loadDay(w, `L${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`, 5 + i * 0.1);
  await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  w.sim.advance(5_000);
  const sk = w.skips()[0]!;
  assert.deepEqual([sk.positions, sk.skipped.length, sk.more], [45, 40, 5]);
  const v = world();
  for (let i = 0; i < 35; i++) await hold(v, `Q${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`, 1, 20, 19.92, 20.05);
  await v.liquidator.flatten({ reason: "close-out", tradeDate: D });
  v.sim.advance(5_000);
  const moved = new Set(v.rows().map((r) => r.symbol));
  const listed = v.skips()[0]!.skipped;
  assert.equal(moved.size, 30);
  assert.equal(listed.length, 5);
  assert.ok(listed.every((s) => s.why === "more than 30 moves in one sale" && !moved.has(String(s.symbol))));
  assert.equal(new Set(listed.map((s) => s.symbol)).size, 5, "each listed once");
});

test("group 1, round 1 note: a skip log that throws cannot reach the sale (round 1's cancels and sales go ahead, nothing reports a cancel failure)", async () => {
  const w = world({ logThrowsOn: "move_phase_skips" });
  await normal(w, "AAA", 10);
  await loadDay(w, "BBB");
  const r = await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  w.sim.advance(3_000);
  assert.equal(w.sim.heldQty("AAA") + w.sim.heldQty("BBB"), 0);
  assert.ok(!r.errors.some((e) => /log boom/.test(e)), r.errors.join("; "));
  assert.deepEqual(w.sim.sellLog.map((x) => x.symbol), ["BBB"], "the load position sold in round 1 after the moves, as without the throw");
});

test("group 1 and group 2, round 1 notes: a move phase that throws part way lists the moves it never tried as \"move phase failed\"; lookups that fail keep the old take-profit", async () => {
  const w = world();
  await normal(w, "AAA", 10);
  await normal(w, "BBB", 10);
  await normal(w, "CCC", 10);
  const real = w.gate.replace.bind(w.gate);
  let n = 0;
  w.gate.replace = (async (...a: Parameters<typeof real>) => {
    if (++n === 2) throw new Error("replace threw");
    return real(...a);
  }) as typeof w.gate.replace;
  await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  w.sim.advance(3_000);
  assert.equal(w.sim.heldQty("AAA") + w.sim.heldQty("BBB") + w.sim.heldQty("CCC"), 0, "sold anyway");
  assert.ok(w.logs.some((l) => l.e === "move_phase_failed"));
  const rows = w.rows().map((r) => r.symbol);
  const listed = w.skips()[0]!.skipped;
  assert.deepEqual(rows.sort(), ["AAA", "BBB"], "a row for the one that went out and for the one whose send threw");
  assert.deepEqual(listed.map((s) => [s.symbol, s.why]), [["CCC", "move phase failed"]]);
  const q = world({ quotesFail: true });
  await normal(q, "AAA", 10);
  await q.liquidator.flatten({ reason: "close-out", tradeDate: D });
  q.sim.advance(3_000);
  assert.deepEqual(q.skips()[0]!.skipped, [{ symbol: "AAA", why: "quote read failed", oldLimit: 20.05 }]);
});
