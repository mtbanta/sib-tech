// Release B (Michael's approval of 2026-11-04): the load window aims at 100 entries a minute. Live order updates free a symbol the
// moment its exit fills, any new print is a signal after 1 second, every window entry is 1 share. Each test was checked to fail with
// its change taken out (builds/build-c2-log.md, "Release B"). The speed release (2026-11-05) removed the 60 second time limit,
// made window entries limit buys (speed-release.test.ts) and connects the live updates on every day; the tests below follow it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDER_STREAM_URL, OrderStream, OrderUpdateHandler, assertPaperStream, parseTradeUpdate, type TradeUpdate } from "../src/order-stream.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore, setPhase, type DayRecord, type OrderRecord } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { loadLine } from "../src/load-mode.ts";
import { formatSummary } from "../src/summary.ts";
import { FakeBroker, order, settings } from "./helpers.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle, z } from "./rig.ts";

// ---------------------------------------------------------------- the listener ----------------------------------------------

class FakeSocket {
  sent: string[] = [];
  binaryType = "blob";
  closed = false;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  readonly url: string;
  constructor(url: string) { this.url = url; }
  send(d: string) { this.sent.push(d); }
  close() { this.closed = true; }
  bin(obj: unknown) { this.onmessage?.({ data: new TextEncoder().encode(JSON.stringify(obj)).buffer }); }
}

test("the order stream connects only to Alpaca's paper host, authenticates, listens to trade_updates, reads binary frames, and sends nothing else", async () => {
  assert.equal(ORDER_STREAM_URL, "wss://paper-api.alpaca.markets/stream");
  for (const bad of ["wss://api.alpaca.markets/stream", "ws://paper-api.alpaca.markets/stream", "wss://paper-api.alpaca.markets:444/stream", "https://paper-api.alpaca.markets/stream", "wss://evil.example/stream"]) assert.throws(() => assertPaperStream(bad), bad);
  const sockets: FakeSocket[] = [];
  const updates: TradeUpdate[] = [];
  const statuses: string[] = [];
  const s = new OrderStream(settings, (u) => updates.push(u), (st) => statuses.push(st), { makeSocket: (u) => { const f = new FakeSocket(u); sockets.push(f); return f; }, setTimer: () => undefined });
  s.start();
  const ws = sockets[0]!;
  assert.equal(ws.url, ORDER_STREAM_URL);
  assert.equal(ws.binaryType, "arraybuffer");
  ws.onopen?.({});
  assert.deepEqual(JSON.parse(ws.sent[0]!), { action: "auth", key: settings.alpaca.keyId, secret: settings.alpaca.secretKey });
  ws.bin({ stream: "authorization", data: { status: "authorized", action: "authenticate" } });
  await settle();
  assert.deepEqual(JSON.parse(ws.sent[1]!), { action: "listen", data: { streams: ["trade_updates"] } });
  ws.bin({ stream: "listening", data: { streams: ["trade_updates"] } });
  await settle();
  assert.equal(s.status, "live");
  ws.bin({ stream: "trade_updates", data: { event: "fill", timestamp: "2026-11-05T14:46:04.000Z", position_qty: "0", price: "12.01", qty: "1", order: { id: "11111111-1111-1111-1111-111111111111", client_order_id: "x", symbol: "SOFI", side: "sell", type: "limit", qty: "1", filled_qty: "1", status: "filled", group_id: "g1", legs: null } } });
  await settle();
  assert.equal(updates.length, 1);
  assert.deepEqual([updates[0]!.event, updates[0]!.positionQty, updates[0]!.order.groupId, updates[0]!.atMs], ["fill", 0, "g1", Date.parse("2026-11-05T14:46:04.000Z")]);
  assert.equal(ws.sent.length, 2, "only the authentication and the listen message: the stream never sends an order");
});

test("the order stream reconnects with a growing wait after a drop, and stops trying after 'not authorized'", async () => {
  const sockets: FakeSocket[] = [];
  const timers: number[] = [];
  const s = new OrderStream(settings, () => undefined, () => undefined, { makeSocket: (u) => { const f = new FakeSocket(u); sockets.push(f); return f; }, setTimer: (fn, ms) => { timers.push(ms); fn(); } });
  s.start();
  sockets[0]!.onclose?.({});
  sockets[1]!.onclose?.({});
  assert.deepEqual(timers, [2000, 4000]);
  assert.equal(s.reconnects, 2);
  sockets[2]!.onopen?.({});
  sockets[2]!.bin({ stream: "authorization", data: { status: "unauthorized" } });
  await settle();
  assert.equal(s.status, "auth_failed");
  sockets[2]!.onclose?.({});
  assert.equal(sockets.length, 3, "no reconnect after not authorized");
});

// ---------------------------------------------------------------- the handler -----------------------------------------------

function handlerWorld() {
  const store = new MemoryStore();
  const dropped: string[] = [];
  let t = Date.parse("2026-11-05T14:46:05.000Z");
  const h = new OrderUpdateHandler({ getOrder: (id) => store.getOrder(id), closeOrder: (id, p) => store.updateOrder(id, p), dropPosition: (s) => void dropped.push(s), now: () => t });
  const row = async (id: string, symbol: string) => store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 1, referencePrice: 12, stopPrice: 11.98, takeProfitPrice: 12.01, status: "submitted", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: "2026-11-05T14:46:00.000Z" });
  const buy = (id: string, symbol: string, g: string): TradeUpdate => ({ event: "fill", order: order({ clientOrderId: id, symbol, side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 12, groupId: g }), positionQty: 1, atMs: t });
  const sell = (symbol: string, g: string | null, positionQty: number | null, event = "fill", filledQty = 1): TradeUpdate => ({ event, order: order({ id: `leg-${g}`, clientOrderId: "uuid-like", symbol, side: "sell", type: "limit", status: event === "fill" ? "filled" : "partially_filled", qty: 1, filledQty, filledAvgPrice: 12.01, groupId: g }), positionQty, atMs: t - 300 });
  return { store, dropped, h, row, buy, sell, setT: (x: number) => (t = x) };
}

test("live updates free a symbol only when a sell fill leaves 0 shares, and close the entry of the same group with its fill written", async () => {
  const w = handlerWorld();
  await w.row("cyrus-20261105-SOFI-1", "SOFI");
  await w.h.handle(w.buy("cyrus-20261105-SOFI-1", "SOFI", "g1"));
  await w.h.handle(w.sell("SOFI", "g1", 3, "partial_fill"));
  assert.deepEqual(w.dropped, [], "shares still held: nothing freed");
  assert.equal((await w.store.getOrder("cyrus-20261105-SOFI-1"))!.closedAt ?? null, null);
  await w.h.handle(w.sell("SOFI", "g1", 0));
  assert.deepEqual(w.dropped, ["SOFI"]);
  const r = (await w.store.getOrder("cyrus-20261105-SOFI-1"))!;
  assert.ok(r.closedAt, "the entry is recorded as closed");
  assert.deepEqual([r.status, r.filledQty, r.filledAvgPrice], ["filled", 1, 12], "with its own fill, so the record is right");
  assert.equal(w.h.medianFreeMs(), 300, "time from the exit fill to the free");
  // a buy fill never frees anything
  await w.h.handle(w.buy("cyrus-20261105-SOFI-2", "SOFI", "g2"));
  assert.deepEqual(w.dropped, ["SOFI"]);
});

test("a late update about an older position never closes a newer entry on the same symbol (entries are matched by Alpaca's group id, not by symbol)", async () => {
  const w = handlerWorld();
  await w.row("cyrus-20261105-SOFI-1", "SOFI");
  await w.h.handle(w.buy("cyrus-20261105-SOFI-1", "SOFI", "g1"));
  await w.h.handle(w.sell("SOFI", "g1", 0));
  await w.row("cyrus-20261105-SOFI-2", "SOFI"); // the next entry, sent after the free
  await w.h.handle(w.buy("cyrus-20261105-SOFI-2", "SOFI", "g2")); // and filled
  await w.h.handle(w.sell("SOFI", "g1", 0)); // a repeated or late update about the first position
  await w.h.handle(w.sell("SOFI", "g-unknown", 0)); // or one whose entry is unknown here
  assert.equal((await w.store.getOrder("cyrus-20261105-SOFI-2"))!.closedAt ?? null, null, "the newer entry stays open, so the gate still refuses beside it and the sync still checks it");
});

test("without position_qty, a symbol is freed only when that group's exit fills add up to the entry's filled shares; undecidable updates are left to the sync", async () => {
  const w = handlerWorld();
  await w.row("cyrus-20261105-RIG-1", "RIG");
  await w.h.handle({ ...w.buy("cyrus-20261105-RIG-1", "RIG", "g9"), order: order({ clientOrderId: "cyrus-20261105-RIG-1", symbol: "RIG", side: "buy", status: "filled", qty: 2, filledQty: 2, filledAvgPrice: 5, groupId: "g9" }) });
  await w.h.handle(w.sell("RIG", "g9", null, "partial_fill", 1));
  assert.deepEqual(w.dropped, [], "1 of 2 sold");
  await w.h.handle(w.sell("RIG", "g9", null, "fill", 2));
  assert.deepEqual(w.dropped, ["RIG"], "2 of 2 sold");
  const w3 = handlerWorld();
  await w3.row("cyrus-20261105-T-1", "T");
  await w3.h.handle({ ...w3.buy("cyrus-20261105-T-1", "T", "g7"), event: "new", order: order({ clientOrderId: "cyrus-20261105-T-1", symbol: "T", side: "buy", status: "accepted", qty: 1, filledQty: 0, groupId: "g7" }), positionQty: null });
  await w3.h.handle(w3.sell("T", "g7", 0)); // the entry's own fill was missed (a reconnect), its exit's fill arrives
  assert.deepEqual(w3.dropped, ["T"], "0 shares: the cached position goes");
  assert.equal((await w3.store.getOrder("cyrus-20261105-T-1"))!.closedAt ?? null, null, "but the record is left to the sync, since its fill is not known here");
  const w2 = handlerWorld();
  await w2.row("cyrus-20261105-F-1", "F");
  await w2.h.handle(w2.sell("F", "g-never-seen", null));
  assert.deepEqual(w2.dropped, [], "no entry known for that group and no position count: nothing freed");
  await w2.h.handle(w2.sell("F", null, 0)); // a liquidation's market sell (no group): the position is gone, the record is the sync's
  assert.deepEqual(w2.dropped, ["F"]);
  assert.equal((await w2.store.getOrder("cyrus-20261105-F-1"))!.closedAt ?? null, null);
});

test("structure: the order stream never sends anything; nothing changes a take-profit's price any more (the time limit is gone); the entry wait only cancels", async () => {
  const { readdirSync, readFileSync, existsSync } = await import("node:fs");
  const { join } = await import("node:path");
  const src = join(import.meta.dirname, "../src");
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
  assert.ok(!existsSync(join(src, "time-limit.ts")), "the time limit's module is gone");
  assert.deepEqual(files(src).filter((f) => /replaceOrderLimit|lowerTakeProfit|PATCH", `\/v2\/orders/.test(readFileSync(f, "utf8"))), [], "no code can change an order's price");
  const stream = readFileSync(join(src, "order-stream.ts"), "utf8");
  assert.ok(!/fetch\(|submitEntry|submitSell|replaceOrderLimit|cancelOrder|from "\.\/broker/.test(stream), "the order stream has no way to reach Alpaca's REST interface");
  const expiry = readFileSync(join(src, "entry-expiry.ts"), "utf8");
  assert.ok(!/submitSell|submitEntry|flatten\(|cancelAllOrders|fetch\(/.test(expiry), "the entry wait can only cancel one order");
});

// ---------------------------------------------------------------- worker level ----------------------------------------------

const RAMP = [...Array(12).fill(50), 50.4];
const plus = (t: string, seconds: number) => new Date(z(t).getTime() + seconds * 1000).toISOString();

async function day(load: boolean) {
  const r = rig<FakeBroker, MemoryStore>({ liveList: ["BBB", "CCC", "DDD", "EEE"], orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays(`position 500\napprove${load ? "\nload on" : ""}`, "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("13:45:00");
  await r.at("14:25:00");
  return r;
}
const entries = (r: { broker: FakeBroker }) => r.broker.calls.filter((c) => c.fn === "submitEntry").map((c) => c.args[0] as { symbol: string; qty: number; stopPrice: number; takeProfitPrice: number; clientOrderId: string });

test("worker: on a load day the live order updates connect at Armed and stop at the close; an exit fill frees the symbol at once, without waiting for the order sync", async () => {
  const r = await day(true);
  assert.equal(r.counts().orderStreamStarts, 1, "connected at Armed");
  await r.at("14:46:00");
  await r.trade("BBB", 50, "14:46:01");
  assert.equal(entries(r).length, 1);
  assert.equal(entries(r)[0]!.qty, 1, "1 share");
  assert.equal((entries(r)[0] as { limitPrice?: number }).limitPrice, 50, "a limit buy at the price seen");
  r.broker.positions = [{ symbol: "BBB", qty: 1, marketValue: 50, avgEntryPrice: 50, unrealizedPl: 0 }];
  await r.at("14:46:06"); // the cached view refreshes and shows BBB held (no order sync until 14:46:10)
  await r.at("14:46:11"); // the 10 second view (the live updates are connected) has read it by now
  await r.trade("BBB", 50, "14:46:07");
  assert.equal(entries(r).length, 1, "the entry is still open: no second entry");
  const id = entries(r)[0]!.clientOrderId;
  await r.orderUpdate({ event: "fill", order: order({ clientOrderId: id, symbol: "BBB", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 50, groupId: "gB1" }), positionQty: 1, atMs: z("14:46:02").getTime() });
  await r.orderUpdate({ event: "fill", order: order({ id: "11111111-1111-1111-1111-111111111111", clientOrderId: "leg", symbol: "BBB", side: "sell", type: "limit", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 50.01, groupId: "gB1" }), positionQty: 0, atMs: z("14:46:07").getTime() });
  await r.trade("BBB", 50.02, "14:46:08");
  assert.equal(entries(r).length, 2, "freed by the live update (the record closed and the cached position dropped): the next print enters again, with no order sync or account refresh in between");
  // a late repeat of the first exit's update cannot free the second entry (whose own fill the stream has seen)
  await r.orderUpdate({ event: "fill", order: order({ clientOrderId: entries(r)[1]!.clientOrderId, symbol: "BBB", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 50.02, groupId: "gB2" }), positionQty: 1, atMs: z("14:46:08").getTime() });
  await r.orderUpdate({ event: "fill", order: order({ id: "11111111-1111-1111-1111-111111111111", clientOrderId: "leg", symbol: "BBB", side: "sell", type: "limit", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 50.01, groupId: "gB1" }), positionQty: 0, atMs: z("14:46:04").getTime() });
  await r.trade("BBB", 50.02, "14:46:09");
  assert.equal(entries(r).length, 2, "the second entry is still open");
  await r.at("14:47:10");
  const stats = r.store.events.filter((e) => e.event === "governor_stats" && e.data && (e.data as any).orderStream);
  assert.ok(stats.length > 0 && (stats.at(-1)!.data as any).orderStream.freed === 2, "the per-minute statistics carry the live updates' counters (2 frees: the exit fill, and the late repeat, which only drops the cached position)");
  assert.ok(!(stats.at(-1)!.data as any).timeLimit, "and no time limit any more");
  await r.at("21:00:00");
  assert.equal(r.counts().orderStreamStops, 1, "stopped at the close");
  const armed = r.said("commands").find((m) => m.startsWith("Armed for"))!;
  assert.ok(armed.includes("1 share a trade on any new print, a limit buy at or below the price seen, cancelled if not filled in 5 seconds, take-profit 1 cent up and stop 2 cents down from that price") && !armed.includes("time limit"), armed);
  assert.ok(loadLine((await r.store.getDay(D))!).includes("1 share churn 8:45 AM CT to 10:30 AM CT")); // since Michael's decision of 2026-11-10
});

test("a normal day: the live order updates connect at Armed too (speed release); the uptick rule, the approved size, market entries and normal exits are unchanged", async () => {
  const r = await day(false);
  for (const t of ["14:30:00", "14:46:00", "15:30:00"]) await r.at(t);
  assert.equal(r.counts().orderStreamStarts, 1, "connected on a normal day as well");
  assert.equal(loadLine((await r.store.getDay(D))!), "5. mode: normal (`load on` makes it a load day)");
  await r.trade("DDD", 50, "15:30:01");
  assert.equal(entries(r).length, 0, "a single print is no signal on a normal day");
  await r.ramp("DDD", RAMP, plus("15:30:00", 2));
  const e = entries(r).at(-1)!;
  assert.equal(e.qty, 9, "500 dollars at 50.40 is 9 shares");
  assert.deepEqual([e.takeProfitPrice, e.stopPrice], [50.53, 50.2]);
  assert.equal((e as { limitPrice?: number }).limitPrice, undefined, "a market buy, as before");
});

// ---------------------------------------------------------------- the summary -----------------------------------------------

test("a load day's summary reports the window settings, the entry wait and the live updates; a normal day's has none of it", () => {
  const base = { tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), status: "approved", dayStartEquity: 20000, suggested: {}, limits: { maxPositionUsd: 500, dailyLossStopUsd: 500, maxTradesPerMinute: 100, borrowingCap: 1 }, decided: {}, liveList: [], phases: { load: "on" } } as unknown as DayRecord;
  const input = { day: base, stored: [] as OrderRecord[], refusals: [], alpacaOrders: [], account: { equity: 20000 } as never, peak: null, stop: null, flat: true, loadWindow: { start: z("14:45:00"), end: z("15:00:00") }, loadExtras: { orderStream: { events: 900, freed: 400, reconnects: 1, medianFreeMs: 420 }, entryExpiry: { scheduled: 1500, cancelled: 700, filledFirst: 20, failed: 0 } } };
  const text = formatSummary(input);
  assert.ok(text.includes("- window settings: 1 share a trade on any new print, a limit buy at or below the price seen, cancelled if not filled in 5 seconds, take-profit 1 cent up and stop 2 cents down from that price. Of 0 limit buys: 0 filled, 0 cancelled unfilled"), text);
  assert.ok(text.includes("- live order updates: 900 received, 400 symbols freed, typically 420 ms after the exit filled, 1 reconnects"), text);
  const normal = formatSummary({ ...input, loadWindow: null, loadExtras: null });
  assert.ok(!normal.includes("window settings") && !normal.includes("live order updates"));
});

// ---------------------------------------------------------------- the window at volume ---------------------------------------

test("the window at volume on the simulated broker: 1-share entries up to the 100 a minute ceiling, symbols freed by live updates, no remainder sales, requests under 200 a minute", { timeout: 300_000 }, async () => {
  const OPEN_MS = Date.UTC(2026, 10, 2, 14, 30);
  const { CachingStore } = await import("../src/caching-store.ts");
  const mem = new MemoryStore();
  let nowMs = OPEN_MS - 3600_000;
  const store = new CachingStore(mem, () => nowMs, { controlTtlMs: 1_500, dayTtlMs: 2_000 });
  const sim = new SimBroker(nowMs);
  const symbols = Array.from({ length: 30 }, (_, i) => `S${String(i).padStart(2, "0")}`);
  const r = rig<SimBroker, InstanceType<typeof CachingStore>>({ broker: sim, store, sleep: sim.sleep, liveList: symbols, orderStream: true });
  const entryTimes: Array<{ t: number; qty: number }> = [];
  const realSubmit = sim.submitEntry.bind(sim);
  const pending = new Map<string, string>();
  sim.submitEntry = async (e) => { entryTimes.push({ t: nowMs, qty: e.qty }); const o = await realSubmit(e); pending.set(e.symbol, e.clientOrderId); return o; };
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("position 400\nloss 5000\ntrades 100\ncap 1\nload on", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("13:45:00");
  sim.clockOpen = true;
  await r.at("14:25:00");
  assert.ok((await mem.getDay(D))!.phases.armed);
  assert.equal(r.counts().orderStreamStarts, 1);
  // a busy market: one print every 100 ms over the 30 names, prices moving in 1 cent steps, 8:44 to 9:01 AM Central
  let seed = 42;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const price = symbols.map((_, i) => 10 + i * 0.5);
  const live = new Map<string, { id: string; tp: number; stop: number; group: string }>();
  let lastTick = 0;
  for (let t = OPEN_MS + 14 * 60_000; t < OPEN_MS + 31 * 60_000; t += 100) {
    nowMs = t;
    sim.advanceTo(t);
    const i = Math.floor(rng() * symbols.length);
    const sym = symbols[i]!;
    price[i] = Math.round((price[i]! + (rng() < 0.5 ? -0.01 : 0.01)) * 100) / 100;
    sim.prices.set(sym, price[i]!);
    if (t - lastTick >= 5_000) { lastTick = t; await r.at(new Date(t).toISOString()); }
    await r.trade(sym, price[i]!, new Date(t).toISOString());
    const w = pending.get(sym);
    if (w) {
      pending.delete(sym);
      const o = sim.orders.find((x) => x.clientOrderId === w)!;
      if (o.status === "accepted" || o.status === "new") {
        sim.fillEntry(w, price[i]!);
        live.set(sym, { id: w, tp: o.legs.find((l) => l.type === "limit")!.limitPrice!, stop: o.legs.find((l) => l.type === "stop")!.stopPrice!, group: o.groupId! });
        await r.orderUpdate({ event: "fill", order: { ...structuredClone(o), filledQty: o.qty, status: "filled", legs: [] }, positionQty: o.qty, atMs: t });
      }
    } else {
      const l = live.get(sym);
      if (l && (price[i]! >= l.tp || price[i]! <= l.stop)) {
        const which = price[i]! >= l.tp ? "take_profit" : "stop";
        sim.fillExit(l.id, which, which === "take_profit" ? l.tp : l.stop);
        live.delete(sym);
        const leg = sim.orders.find((x) => x.clientOrderId === l.id)!.legs.find((x) => x.status === "filled")!;
        await r.orderUpdate({ event: "fill", order: structuredClone(leg), positionQty: sim.heldQty(sym), atMs: t });
      }
    }
  }
  const W0 = OPEN_MS + 15 * 60_000, W1 = OPEN_MS + 30 * 60_000;
  const inWindow = entryTimes.filter((e) => e.t >= W0 && e.t < W1);
  const perMin = Array.from({ length: 15 }, (_, m) => inWindow.filter((e) => e.t >= W0 + m * 60_000 && e.t < W0 + (m + 1) * 60_000).length);
  let maxRequests = 0;
  for (let i = 0, j = 0; i < sim.bucketTimes.length; i++) { while (sim.bucketTimes[i]! - sim.bucketTimes[j]! >= 60_000) j++; if (sim.bucketTimes[i]! >= W0 && sim.bucketTimes[i]! < W1) maxRequests = Math.max(maxRequests, i - j + 1); }
  console.log(`window at volume: ${inWindow.length} entries, a minute ${perMin.join(",")}, most requests in any 60 s ${maxRequests}, lowest budget ${Math.floor(sim.lowestTokens)}, remainder sales ${sim.sellLog.length}, freed ${(r.worker as any).orderHandler?.counts.freed}`);
  assert.ok(inWindow.every((e) => e.qty === 1), "every window entry is 1 share");
  assert.ok(Math.max(...perMin) <= 100, "never above the fixed ceiling");
  assert.ok(perMin.filter((n) => n >= 90).length >= 10, `at least 10 minutes at 90 or more in this busy simulated market (${perMin.join(",")})`);
  assert.equal(sim.sellLog.length, 0, "no remainder or missing-exit sales: a 1-share entry cannot partly fill");
  assert.ok(maxRequests <= 200, `requests in any 60 seconds of the window: ${maxRequests}`);
  assert.ok(sim.lowestTokens >= 80, "the safety reserve was never reached");
  assert.equal(sim.rejected429, 0);
  assert.equal(sim.oversellAttempts, 0);
  assert.ok(!r.said("alerts").some((a) => a.includes("confirm a live protective stop") || a.includes("NO PROTECTIVE STOP")), "no false alarm");
});
