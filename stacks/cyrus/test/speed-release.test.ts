// The speed release (Michael's decisions of 2026-11-05, builds/build-c2-log.md, "Speed release"). Each test is meant to fail with its
// change taken out (the log lists which change each test guards).
import { test } from "node:test";
import assert from "node:assert/strict";
import { AlpacaTrading, AlpacaError } from "../src/alpaca-trading.ts";
import { loadSettings } from "../src/config.ts";
import { BusyPlaceholder } from "../src/strategy.ts";
import { LOAD_ENTRY_WAIT_MS, LOAD_TAKE_PROFIT_CENTS, limitEntryPrice, loadWindowRules } from "../src/load-mode.ts";
import { EntryExpiry } from "../src/entry-expiry.ts";
import { OrderUpdateHandler, type TradeUpdate } from "../src/order-stream.ts";
import { CachingStore } from "../src/caching-store.ts";
import { MemoryStore, type OrderRecord } from "../src/store.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { BARE_GRACE_MS, OLD_LOOKUPS_PER_SYNC, RECENT_MAX_PAGES, RECENT_WINDOW_MS, SyncMemory, enforceDailyLoss, syncOrders } from "../src/risk.ts";
import { REFUSAL_BACKOFF_CAP_MS, clientOrderIdFor, refusalWaitMs } from "../src/gate.ts";
import { StopGapMeter } from "../src/stop-gap.ts";
import { stopGapLine } from "../src/summary.ts";
import { ensureDay } from "../src/morning.ts";
import { FAKE_ENV } from "./fakes.ts";
import { FakeBroker, order } from "./helpers.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle, z } from "./rig.ts";

const plus = (t: string, seconds: number) => new Date(z(t).getTime() + seconds * 1000).toISOString();

// A worker day on the fakes: limits approved the evening before (with `load on` for a load day), armed at 8:25 AM Central.
async function day(load: boolean, liveList = ["BBB", "CCC", "DDD", "EEE"]) {
  const r = rig<FakeBroker, MemoryStore>({ liveList, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays(`position 500\napprove${load ? "\nload on" : ""}`, "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("13:45:00");
  await r.at("14:25:00");
  return r;
}
const entries = (r: { broker: FakeBroker }) => r.broker.calls.filter((c) => c.fn === "submitEntry").map((c) => c.args[0] as { symbol: string; qty: number; stopPrice: number; takeProfitPrice: number; clientOrderId: string; limitPrice?: number; referencePrice: number });
const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null, atMs: number | null = null): TradeUpdate => ({ event, order: order(o), positionQty, atMs });

// ------------------------------------------------ decision 4: limit entries in the load window ------------------------------------

test("decision 4: a load-window signal is a limit buy at the print rounded down to the cent, take-profit 1 cent above and stop 2 cents below that limit; a normal signal is unchanged", () => {
  assert.equal(LOAD_TAKE_PROFIT_CENTS, 1);
  assert.equal(LOAD_ENTRY_WAIT_MS, 5_000);
  assert.equal(limitEntryPrice(13.415), 13.41);
  assert.equal(limitEntryPrice(13.41), 13.41, "a whole-cent print is the limit itself");
  const s = new BusyPlaceholder(["AAA"], { loadActive: () => true }).onTrade({ symbol: "AAA", price: 13.415, size: 100, time: z("14:46:00").toISOString() })!;
  assert.deepEqual([s.limitPrice, s.takeProfitPrice, s.stopPrice, s.load], [13.41, 13.42, 13.39, true]);
  const normal = new BusyPlaceholder(["AAA"]);
  let last = null;
  for (let i = 0; i < 13; i++) last = normal.onTrade({ symbol: "AAA", price: i < 12 ? 50 : 50.4, size: 100, time: new Date(z("14:46:00").getTime() + i * 1000).toISOString() });
  assert.ok(last && last.limitPrice === undefined && !last.load, "the normal placeholder still sends market entries");
  assert.ok(loadWindowRules().includes("limit buy at or below the price seen, cancelled if not filled in 5 seconds, take-profit 1 cent up and stop 2 cents down"));
});

test("decision 4: the broker client sends a limit bracket at the limit price, and refuses a limit above the price seen or exits not around it", async () => {
  const settings = loadSettings({ ...FAKE_ENV });
  const bodies: any[] = [];
  const impl = (async (_u: URL | string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init!.body)));
    return new Response(JSON.stringify({ id: "o1", client_order_id: "cyrus-20261102-AAA-1", symbol: "AAA", side: "buy", qty: "1", filled_qty: "0", status: "accepted", order_class: "bracket", type: "limit", legs: [] }), { status: 200 });
  }) as typeof fetch;
  const c = new AlpacaTrading(settings, { fetchImpl: impl, retryDelayMs: 0 });
  const e = { symbol: "AAA", qty: 1, stopPrice: 13.39, takeProfitPrice: 13.42, referencePrice: 13.415, limitPrice: 13.41, clientOrderId: "cyrus-20261102-AAA-1" };
  await c.submitEntry(e);
  assert.deepEqual([bodies[0].type, bodies[0].limit_price, bodies[0].order_class, bodies[0].take_profit.limit_price, bodies[0].stop_loss.stop_price, bodies[0].side], ["limit", "13.41", "bracket", "13.42", "13.39", "buy"]);
  await assert.rejects(c.submitEntry({ ...e, limitPrice: 13.42 }), AlpacaError, "a limit above the price seen");
  await assert.rejects(c.submitEntry({ ...e, stopPrice: 13.41 }), AlpacaError, "a stop not below the limit");
  await assert.rejects(c.submitEntry({ ...e, referencePrice: 13.43, takeProfitPrice: 13.44, limitPrice: 13.44 }), AlpacaError);
  assert.equal(bodies.length, 1, "nothing else was sent");
  await c.submitEntry({ ...e, limitPrice: undefined });
  assert.equal(bodies[1].type, "market", "without a limit price: a market buy, as before");
  assert.equal(bodies[1].limit_price, undefined);
});

test("decision 4, worker: a window entry goes out as a 1-share limit buy and is cancelled 5 seconds later if no fill has arrived; one whose fill arrived is left alone", async () => {
  const r = await day(true);
  await r.at("14:46:00");
  await r.trade("BBB", 50.004, "14:46:01");
  await r.trade("CCC", 20, "14:46:01");
  const [b, c] = entries(r);
  assert.deepEqual([b!.qty, b!.limitPrice, b!.takeProfitPrice, b!.stopPrice], [1, 50, 50.01, 49.98]);
  const cOrder = r.broker.orders.find((o) => o.clientOrderId === c!.clientOrderId)!;
  await r.orderUpdate(upd("fill", { id: cOrder.id, clientOrderId: c!.clientOrderId, symbol: "CCC", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 20, groupId: "gC" }, 1, z("14:46:02").getTime()));
  r.setNow(plus("14:46:01", 4.9));
  await settle();
  assert.equal(r.broker.count("cancelOrder"), 0, "not before 5 seconds");
  r.setNow(plus("14:46:01", 5.1));
  await settle();
  const bOrder = r.broker.orders.find((o) => o.clientOrderId === b!.clientOrderId)!;
  assert.deepEqual(r.broker.calls.filter((x) => x.fn === "cancelOrder").map((x) => x.args[0]), [bOrder.id], "only the unfilled entry, by its own order id");
});

test("decision 4, entry wait: only 1-share entries are ever scheduled; a cancel that fails is counted and not retried", async () => {
  const timers: Array<() => void> = [];
  const sent: string[] = [];
  let fail = false;
  const ex = new EntryExpiry({ cancelOrder: async (id) => { sent.push(id); if (fail) throw new Error("timeout"); }, wasFilled: () => false, setTimer: (fn) => void timers.push(fn) });
  ex.schedule({ clientOrderId: "a", alpacaOrderId: "A", symbol: "AAA", qty: 2 }, 5_000);
  assert.equal(timers.length, 0, "a 2-share entry is never cancelled by the wait");
  ex.schedule({ clientOrderId: "b", alpacaOrderId: "B", symbol: "AAA", qty: 1 }, 5_000);
  fail = true;
  timers[0]!();
  await ex.settled();
  assert.deepEqual(sent, ["B"]);
  assert.deepEqual(ex.counts, { scheduled: 1, cancelled: 0, filledFirst: 0, failed: 1 });
});

// ------------------------------------------------ item 1: live updates every day, memory first --------------------------------------

test("item 1: a cancelled unfilled entry's live update closes its record as cancelled, so the next print can enter at once", async () => {
  const r = await day(true);
  await r.at("14:46:00");
  await r.trade("BBB", 50, "14:46:01");
  await r.trade("BBB", 50, "14:46:02.5");
  assert.equal(entries(r).length, 1, "the first entry is still working");
  const id = entries(r)[0]!.clientOrderId;
  const o = r.broker.orders.find((x) => x.clientOrderId === id)!;
  await r.orderUpdate(upd("canceled", { id: o.id, clientOrderId: id, symbol: "BBB", side: "buy", status: "canceled", qty: 1, filledQty: 0, groupId: "gB" }, null, z("14:46:03").getTime()));
  const row = (await r.store.getOrder(id))!;
  assert.equal(row.status, "canceled");
  assert.ok(row.closedAt, "closed");
  assert.equal(row.alpacaOrderId, o.id, "still counted as sent in the summary");
  await r.trade("BBB", 50.01, "14:46:03.6");
  assert.equal(entries(r).length, 2, "freed by the update, with no sync in between");
});

test("item 1: an entry whose fill was seen is never closed by a later cancel update (only a never-filled entry is)", async () => {
  const store = new MemoryStore();
  const id = clientOrderIdFor(D, "BBB", 1);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "BBB", qty: 1, referencePrice: 50, stopPrice: 49.98, takeProfitPrice: 50.01, status: "submitted", alpacaOrderId: "A", filledQty: null, filledAvgPrice: null, note: null, createdAt: z("14:46:00").toISOString() });
  const h = new OrderUpdateHandler({ getOrder: (x) => store.getOrder(x), closeOrder: (x, p) => store.updateOrder(x, p), dropPosition: () => undefined, now: () => z("14:46:05").getTime() });
  await h.handle(upd("fill", { clientOrderId: id, symbol: "BBB", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 50, groupId: "g" }, 1));
  await h.handle(upd("canceled", { clientOrderId: id, symbol: "BBB", side: "buy", status: "canceled", qty: 1, filledQty: 0, groupId: "g" }, null));
  assert.equal((await store.getOrder(id))!.closedAt ?? null, null, "left open: the position is real");
  assert.equal(h.wasFilled(id), true);
});

test("item 1: the caching store closes an entry in memory before the database write lands; a failed write is kept and retried; the database can only show it still active", async () => {
  const inner = new MemoryStore();
  let release: () => void = () => undefined;
  let failNext = false;
  const realUpdate = inner.updateOrder.bind(inner);
  inner.updateOrder = async (id, patch) => {
    if (failNext) { failNext = false; throw new Error("database down (test)"); }
    await new Promise<void>((r) => (release = r));
    return realUpdate(id, patch);
  };
  const store = new CachingStore(inner);
  const row: OrderRecord = { clientOrderId: "cyrus-20261102-BBB-1", tradeDate: D, symbol: "BBB", qty: 1, referencePrice: 50, stopPrice: 49.98, status: "filled", alpacaOrderId: "A", filledQty: 1, filledAvgPrice: 50, note: null, createdAt: z("14:46:00").toISOString() };
  await store.insertOrder(row);
  const write = store.updateOrderSoon(row.clientOrderId, { closedAt: z("14:46:05").toISOString() });
  await settle();
  assert.ok((await store.listOrders(D))[0]!.closedAt, "the gate's view (memory) shows it closed at once");
  assert.equal((await inner.getOrder(row.clientOrderId))!.closedAt ?? null, null, "the database does not yet: anything read from it shows the entry active (the refusing direction)");
  release();
  await write;
  assert.ok((await inner.getOrder(row.clientOrderId))!.closedAt, "then written");
  assert.equal(store.takeSoonWriteTimes().length, 1, "and its time is kept for the statistics");
  // a failed write is kept and tried again on the next pass
  await store.insertOrder({ ...row, clientOrderId: "cyrus-20261102-BBB-2" });
  failNext = true;
  await store.updateOrderSoon("cyrus-20261102-BBB-2", { closedAt: z("14:47:00").toISOString() });
  assert.equal((await inner.getOrder("cyrus-20261102-BBB-2"))!.closedAt ?? null, null);
  const retry = store.retrySoonWrites();
  await settle();
  release();
  await retry;
  assert.ok((await inner.getOrder("cyrus-20261102-BBB-2"))!.closedAt, "written by the retry");
});

// ------------------------------------------------ item 3: the 10 second sync's smaller read -----------------------------------------

test("item 3: with the live updates connected the sync reads only the last 10 minutes (at most 3 pages) and looks up older open entries by id, a few per sync and each at most every 30 seconds; without them it reads from the oldest open entry", async () => {
  const T0 = Date.UTC(2026, 10, 2, 15, 0);
  const sim = new SimBroker(T0);
  const store = new MemoryStore();
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const mem = new SyncMemory();
  const risk = { broker: sim, store, now: () => new Date(sim.simMs), say, liquidator, syncMemory: mem };
  await ensureDay({ store, broker: sim, now: risk.now }, D);
  const day = (await store.getDay(D))!;
  const hold = async (symbol: string) => {
    const id = clientOrderIdFor(D, symbol, 1);
    await sim.submitEntry({ symbol, qty: 1, stopPrice: 9.98, takeProfitPrice: 10.01, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 1, referencePrice: 10, stopPrice: 9.98, takeProfitPrice: 10.01, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs).toISOString() });
  };
  for (const s of ["A1", "A2", "A3", "A4", "A5", "A6"]) await hold(s);
  sim.advance(30 * 60_000);
  await hold("NEW");
  const lists: Array<{ after: string; maxPages: number }> = [];
  const looked: string[] = [];
  const realList = sim.listOrdersPaged.bind(sim);
  sim.listOrdersPaged = async (status, after, maxPages = 20) => (status === "all" && lists.push({ after, maxPages }), realList(status, after, maxPages));
  const realFind = sim.findOrderByClientId.bind(sim);
  sim.findOrderByClientId = async (id) => (looked.push(id), realFind(id));
  await syncOrders(risk, day, { protect: true, streamLive: true });
  assert.equal(lists[0]!.after, new Date(sim.simMs - RECENT_WINDOW_MS).toISOString(), "the last 10 minutes only");
  assert.equal(lists[0]!.maxPages, RECENT_MAX_PAGES);
  assert.equal(looked.length, OLD_LOOKUPS_PER_SYNC, "4 older entries looked up by id");
  assert.equal(mem.lastSeen.size, 1 + OLD_LOOKUPS_PER_SYNC, "the recent one from the listing, 4 from lookups");
  sim.advance(10_000);
  await syncOrders(risk, day, { protect: true, streamLive: true });
  assert.equal(looked.length, 6, "the next sync looks up the 2 not yet seen; the 4 seen 10 seconds ago wait their 30 seconds");
  sim.advance(10_000);
  await syncOrders(risk, day, { protect: true, streamLive: true });
  assert.equal(looked.length, 6, "nothing is due 20 seconds after its last look");
  sim.advance(10_000);
  await syncOrders(risk, day, { protect: true, streamLive: true });
  assert.equal(looked.length, 10, "30 seconds after their look the first 4 are due again");
  await syncOrders(risk, day, { protect: true, streamLive: false });
  assert.equal(lists.at(-1)!.after, new Date(T0 - 60_000).toISOString(), "without the live updates: everything since the oldest open entry, as before");
  assert.equal(lists.at(-1)!.maxPages, 20);
});

// ------------------------------------------------ decision 3: the 3 second stop gap -------------------------------------------------

test("decision 3: the handler reports a stop cancelled while the take-profit had partly filled, and nothing else (a full take-profit's cancel, a sale's cancel)", async () => {
  const seen: string[] = [];
  const mk = () => new OrderUpdateHandler({ getOrder: async () => null, closeOrder: async () => undefined, dropPosition: () => undefined, onStopCancelled: (i) => void seen.push(i.symbol), now: () => 0 });
  const entry = (sym: string) => upd("fill", { clientOrderId: `cyrus-20261102-${sym}-1`, symbol: sym, side: "buy", status: "filled", qty: 10, filledQty: 10, filledAvgPrice: 7.27, groupId: `g${sym}` }, 10);
  const tp = (sym: string, filled: number, event: string) => upd(event, { id: `tp-${sym}`, clientOrderId: "x", symbol: sym, side: "sell", type: "limit", status: event === "fill" ? "filled" : "partially_filled", qty: 10, filledQty: filled, groupId: `g${sym}` }, 10 - filled);
  const stop = (sym: string) => upd("canceled", { id: `sl-${sym}`, clientOrderId: "y", symbol: sym, side: "sell", type: "stop", stopPrice: 7.21, status: "canceled", qty: 10, groupId: `g${sym}` }, null, 1000);
  const h = mk();
  for (const u of [entry("CIFR"), tp("CIFR", 3, "partial_fill"), stop("CIFR")]) await h.handle(u);
  for (const u of [entry("WULF"), tp("WULF", 10, "fill"), stop("WULF")]) await h.handle(u);
  for (const u of [entry("IREN"), stop("IREN")]) await h.handle(u);
  assert.deepEqual(seen, ["CIFR"]);
  assert.equal(BARE_GRACE_MS, 3_000);
});

test("decision 3, worker: the live update of the stop's cancel runs the sync 3 seconds later by a timer, which sells the shares left without a stop", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.hideFilledParents = true;
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("14:59:00").getTime());
  const id = clientOrderIdFor(D, "CIFR", 1);
  await sim.submitEntry({ symbol: "CIFR", qty: 10, stopPrice: 7.21, takeProfitPrice: 7.28, referencePrice: 7.27, clientOrderId: id });
  sim.fillEntry(id, 7.27);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "CIFR", qty: 10, referencePrice: 7.27, stopPrice: 7.21, takeProfitPrice: 7.28, status: "filled", alpacaOrderId: null, filledQty: 10, filledAvgPrice: 7.27, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  await r.at("15:00:00"); // a sync: all well
  const o = sim.orders.find((x) => x.clientOrderId === id)!;
  await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: "CIFR", side: "buy", status: "filled", qty: 10, filledQty: 10, filledAvgPrice: 7.27, groupId: o.groupId }, 10));
  sim.advanceTo(z("15:00:01").getTime());
  sim.partialTakeProfit(id, 3, 7.28);
  const tp = o.legs.find((l) => l.type === "limit")!;
  const sl = o.legs.find((l) => l.type === "stop")!;
  await r.orderUpdate(upd("partial_fill", { ...structuredClone(tp), groupId: o.groupId }, 7, sim.simMs));
  await r.orderUpdate(upd("canceled", { ...structuredClone(sl), groupId: o.groupId }, null, sim.simMs));
  assert.equal(sim.sellLog.length, 0);
  r.setNow("15:00:04.3"); // 3.3 seconds after the cancel: the timer has fired; the next pass and the next 10 second sync are later
  for (let i = 0; i < 10 && sim.sellLog.length === 0; i++) await settle();
  assert.deepEqual(sim.sellLog.map((x) => [x.symbol, x.qty]), [["CIFR", 7]]);
  assert.ok(sim.sellLog[0]!.at < z("15:00:05").getTime(), "sold about 3 seconds after Alpaca cancelled the stop");
});

test("decision 3, measurement: each sale is valued against waiting 5 more seconds, from the free feed's prints and the sale's fill", async () => {
  const m = new StopGapMeter();
  m.startDay(D, null);
  const t = z("15:00:00").getTime();
  m.onSale({ symbol: "CIFR", shares: 7, takeProfit: 7.28, atMs: t });
  m.onSale({ symbol: "WULF", shares: 4, takeProfit: 9.5, atMs: t });
  m.onSale({ symbol: "IREN", shares: 2, takeProfit: 20, atMs: t });
  m.onPrint("CIFR", 7.27, t + 1000);
  m.onPrint("CIFR", 7.28, t + 3000); // the take-profit price printed inside 5 seconds
  m.onPrint("CIFR", 7.27, t + 4500); // and the price fell back before the 5 seconds were over
  m.onPrint("CIFR", 7.3, t + 6000); // after the 5 seconds: not counted
  m.onPrint("WULF", 9.45, t + 2000);
  m.onPrint("WULF", 9.4, t + 4900); // the last print inside the 5 seconds
  m.onOwnSellFill("CIFR", 7.26, t + 1500);
  m.onOwnSellFill("WULF", 9.44, t + 1500);
  assert.equal(m.settle(t + 4000), false, "nothing before its 5 seconds are over");
  assert.equal(m.settle(t + 5001), true);
  const d = m.totals();
  assert.deepEqual([d.sales, d.shares, d.wouldHaveFilled, d.unmeasured], [3, 13, 1, 1], "IREN has no fill yet: not measured");
  // CIFR: sold at 7.26, waiting would have filled at 7.28: -0.14. WULF: sold at 9.44, waiting ends at 9.40: +0.16.
  assert.equal(d.dollarsVsWaiting, 0.02);
  m.settle(t + 61_000);
  assert.deepEqual(m.saved(), { sales: 3, shares: 13, wouldHaveFilled: 1, unmeasured: 1, dollarsVsWaiting: 0.02 }, "after a minute with no fill IREN stays not measured");
  const { formatSummary } = await import("../src/summary.ts");
  const dayRec = { tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), status: "approved", dayStartEquity: 20000, suggested: {}, limits: { maxPositionUsd: 500, dailyLossStopUsd: 500, maxTradesPerMinute: 100, borrowingCap: 1 }, decided: {}, liveList: [], phases: {} } as never;
  assert.ok(formatSummary({ day: dayRec, stored: [], refusals: [], alpacaOrders: [], account: { equity: 20000 } as never, peak: null, stop: null, flat: true, stopGap: m.saved() }).includes(stopGapLine(m.saved())), "the summary carries the line");
  assert.ok(stopGapLine(m.saved()).includes("3 sales, 13 shares; 1 would have filled at their take-profit within the next 5 seconds; selling at once came out +0.02 dollars against waiting 5 seconds (1 not measured)"));
});

// ------------------------------------------------ item 6: the loss stop's sale goes first --------------------------------------------

test("item 6: a remainder sale waiting on slow cancels gives way to the daily loss stop's sale, which sells everything; no false 'could not sell' alert", async () => {
  const MID = Date.UTC(2026, 10, 2, 15, 0);
  const sim = new SimBroker(MID);
  sim.hideFilledParents = true;
  sim.cancelMs = 3_000; // slow enough that the remainder sale is still waiting on its cancel when the loss stop fires
  const said: string[] = [];
  const say = async (_c: string, text: string) => (said.push(text), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  // The remainder sale's pauses are held open until the test lets them go, so it is truly under way when the loss stop fires.
  let holding = true;
  let resume: () => void = () => undefined;
  let paused = 0;
  const sleep = async (ms: number) => { paused++; if (holding) await new Promise<void>((r) => (resume = r)); sim.advance(ms); };
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  await ensureDay({ store, broker: sim, now }, D);
  const day = (await store.getDay(D))!;
  const hold = async (symbol: string, qty: number, price: number) => {
    const id = clientOrderIdFor(D, symbol, 1);
    await sim.submitEntry({ symbol, qty, stopPrice: price - 0.06, takeProfitPrice: price + 0.01, referencePrice: price, clientOrderId: id });
    sim.fillEntry(id, price);
    await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.06, takeProfitPrice: price + 0.01, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
    return id;
  };
  const cifr = await hold("CIFR", 10, 7.27);
  await hold("ADT", 5, 9.88);
  sim.partialTakeProfit(cifr, 3, 7.28);
  sim.advance(4_000);
  const sync = syncOrders({ broker: sim, store, now, say, liquidator, syncMemory: new SyncMemory() }, day, { protect: true });
  for (let i = 0; i < 200 && paused === 0; i++) await new Promise((r) => setImmediate(r));
  assert.ok(liquidator.isLiquidating() && paused === 1, "the remainder sale is under way, waiting on its cancel");
  const t0 = sim.simMs;
  const lossRun = liquidator.flatten({ reason: "daily loss stop", tradeDate: D, maxRounds: 1, priority: true });
  holding = false;
  resume();
  const loss = await lossRun;
  const synced = await sync;
  assert.deepEqual(synced.unprotected, ["CIFR"]);
  assert.ok(loss.sold.some((s) => s.symbol === "ADT") && loss.sold.some((s) => s.symbol === "CIFR"), JSON.stringify(loss));
  const firstLossSell = Math.min(...sim.sellLog.map((x) => x.at));
  assert.ok(firstLossSell - t0 < 8_000, `the loss stop's sale did not wait out the remainder sale's rounds (${firstLossSell - t0} ms)`);
  assert.equal(sim.sellLog.filter((x) => x.symbol === "CIFR").length, 1, "CIFR sold once, by the loss stop's sale");
  assert.ok(!said.some((t) => t.includes("COULD NOT SELL")), said.join("\n"));
  assert.equal(sim.oversellAttempts, 0);
});

test("item 6: the daily loss stop's sale is marked priority, the order sync's one-position sales give way to it", async () => {
  const { readFileSync } = await import("node:fs");
  const risk = readFileSync(new URL("../src/risk.ts", import.meta.url), "utf8");
  assert.ok(/reason: "daily loss stop", tradeDate: day\.tradeDate, maxRounds: 1, priority: true/.test(risk));
  assert.equal((risk.match(/only: \[s\.symbol\], maxRounds: 3,[^)]*yieldToPriority: true/g) ?? []).length, 2);
});

// ------------------------------------------------ decision 5: the refusal backoff ---------------------------------------------------

test("decision 5: after Alpaca refuses an entry the symbol waits 3 seconds, then 6, 12, 24, at most 30; a minute later nothing is left", () => {
  const t = z("14:50:00").getTime();
  const failed = (secondsAgo: number[]) => secondsAgo.map((s, i): OrderRecord => ({ clientOrderId: `f${i}`, tradeDate: D, symbol: "AAA", qty: 1, referencePrice: 10, stopPrice: 9.98, status: "failed", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: new Date(t - s * 1000).toISOString() }));
  assert.equal(refusalWaitMs([], "AAA", t), 0);
  assert.equal(refusalWaitMs(failed([1]), "AAA", t), 2_000);
  assert.equal(refusalWaitMs(failed([3.1]), "AAA", t), 0, "3 seconds after one refusal: clear");
  assert.equal(refusalWaitMs(failed([4, 1]), "AAA", t), 5_000, "a second refusal: 6 seconds from it");
  assert.equal(REFUSAL_BACKOFF_CAP_MS, 30_000);
  assert.equal(refusalWaitMs(failed([50, 40, 30, 20, 10, 1]), "AAA", t), 29_000, "capped at 30 seconds");
  assert.equal(refusalWaitMs(failed([61]), "AAA", t), 0);
  assert.equal(refusalWaitMs(failed([1]), "BBB", t), 0, "per symbol");
});

test("decision 5, worker: a refused symbol is tried again 3 seconds later, not a minute later, and the refused order counted against the minute's ceiling", async () => {
  const r = await day(true);
  await r.at("14:46:00");
  const real = r.broker.submitEntry.bind(r.broker);
  let refuse = true;
  r.broker.submitEntry = async (e) => {
    if (refuse) { refuse = false; r.broker.calls.push({ fn: "submitEntry", args: [e] }); throw new AlpacaError("Alpaca POST /v2/orders answered 422: take_profit.limit_price must be >= base_price + 0.01", 422); }
    return real(e);
  };
  await r.trade("BBB", 50, "14:46:01");
  assert.equal(entries(r).length, 1);
  await r.trade("BBB", 50, "14:46:03");
  assert.equal(entries(r).length, 1, "2 seconds later: still waiting");
  await r.trade("BBB", 50, "14:46:04.2");
  assert.equal(entries(r).length, 2, "3 seconds later: tried again");
  assert.equal(r.governor.tradesInLastMinute(), 2, "both orders took a slot under the ceiling");
});

// ------------------------------------------------ item 8: the cached view -----------------------------------------------------------

test("item 8: a read of positions that started before a live update cannot undo it; one that started after shows Alpaca's view", async () => {
  let t = 1_000;
  let release: () => void = () => undefined;
  const fb = new FakeBroker();
  fb.positions = [{ symbol: "BBB", qty: 1, marketValue: 50, avgEntryPrice: 50, unrealizedPl: 0 }];
  const realList = fb.listPositions.bind(fb);
  let slow = false;
  fb.listPositions = async () => { const p = await realList(); if (slow) await new Promise<void>((r) => (release = r)); return p; };
  const v = new BrokerView(fb, () => t);
  slow = true;
  const read = v.refreshFast(); // starts at t=1000, answers later with BBB still held
  t = 1_050;
  v.setPositionFromUpdate("BBB", 0, null); // the exit's update arrives while the read is out
  v.setPositionFromUpdate("CCC", 3, 20); // and an entry's fill
  await settle();
  release();
  await read;
  assert.deepEqual((await v.freshPositions(60_000)).map((p) => [p.symbol, p.qty]), [["CCC", 3]]);
  slow = false;
  t = 2_000;
  fb.positions = [{ symbol: "BBB", qty: 2, marketValue: 100, avgEntryPrice: 50, unrealizedPl: 0 }];
  await v.refreshFast();
  assert.deepEqual(v.cachedPositions()!.map((p) => [p.symbol, p.qty]), [["BBB", 2]], "a read that started after the updates is Alpaca's view");
});

test("item 8, worker: the account and positions are read every 10 seconds while the live updates are connected, every 5 seconds while they are not", async () => {
  for (const live of [true, false]) {
    const r = await day(false);
    if (!live) (r.worker as any).orderStream.status = () => "reconnecting";
    const view = (r.worker as any).view as BrokerView;
    let reads = 0;
    const real = view.refreshFast.bind(view);
    view.refreshFast = async () => (reads++, real());
    for (let s = 0; s < 60; s += 5) await r.at(plus("15:00:00", s));
    assert.equal(reads, live ? 6 : 12, live ? "live" : "not live");
  }
});

// ------------------------------------------------ item 9: waits end at the event ----------------------------------------------------

test("item 9: a sale's wait for its cancels ends at a live update for that symbol; a run of updates cannot turn the wait into more than 20 extra looks", async () => {
  const fb = new FakeBroker();
  fb.positions = [{ symbol: "AAA", qty: 5, qtyAvailable: 0, marketValue: 100, avgEntryPrice: 20, unrealizedPl: 0 }];
  const sleeps: number[] = [];
  const waits: number[] = [];
  const gate = new SellGate({ broker: fb, say: async () => true, nowMs: () => 0 });
  const liq = new Liquidator({ broker: fb, gate, now: () => new Date(0), sleep: async (ms) => void sleeps.push(ms), waitEvent: async (syms, ms) => (assert.ok(syms.has("AAA")), waits.push(ms), true) });
  const res = await liq.flatten({ reason: "test", tradeDate: D, only: ["AAA"], maxRounds: 1 });
  assert.ok(!res.flat, "the shares stay held by an order nothing cancels (a stuck exit)");
  assert.ok(waits.length > 0 && sleeps.length === 0, "every pause is a wait that an update can end");
  const looks = fb.count("listPositions");
  assert.ok(looks <= 2 * (20 + 12) + 4, `bounded: ${looks} position reads`);
});

// ------------------------------------------------ items 5 and 10: shadow estimate and statistics ------------------------------------

test("item 5: the loss stop hands each account read to the shadow estimate, and still decides on Alpaca's equity only", async () => {
  const fb = new FakeBroker();
  const store = new MemoryStore();
  await ensureDay({ store, broker: fb, now: () => z("15:00:00") }, D);
  await store.updateDay(D, { status: "approved", phases: { armed: "x" }, dayStartEquity: 20000 });
  const day = (await store.getDay(D))!;
  const reads: Array<{ equity: number; cash: number }> = [];
  const liquidator = new Liquidator({ broker: fb, gate: new SellGate({ broker: fb, say: async () => true }), now: () => z("15:00:00"), sleep: async () => undefined });
  fb.account = { ...fb.account, equity: 19900, cash: 19000 };
  const fired = await enforceDailyLoss({ broker: fb, store, now: () => z("15:00:00"), say: async () => true, liquidator, onAccountRead: (a) => void reads.push(a) }, day);
  assert.equal(fired, false);
  assert.deepEqual(reads.map((a) => [a.equity, a.cash]), [[19900, 19000]]);
});

test("item 10: one statistics line a minute, all session, with the live updates, the frees, the database closes, the entry wait, the shadow estimate and one raw update", async () => {
  const r = await day(false);
  await r.at("15:00:00");
  r.broker.positions = [{ symbol: "BBB", qty: 2, marketValue: 100, avgEntryPrice: 50, unrealizedPl: 0 }];
  await r.at("15:00:10");
  await r.trade("BBB", 50.5, "15:00:11");
  const raw = { event: "fill", position_qty: "0" };
  await r.orderUpdate({ ...upd("fill", { clientOrderId: "leg", symbol: "BBB", side: "sell", type: "limit", status: "filled", qty: 2, filledQty: 2, filledAvgPrice: 50.5, groupId: "g" }, 0, z("15:00:11").getTime()), raw });
  await r.at("15:01:05");
  const stats = r.store.events.filter((e) => e.event === "governor_stats").map((e) => e.data as any);
  const last = stats.at(-1)!;
  for (const k of ["orderStream", "freesThisMinute", "databaseCloses", "entryExpiry", "lossStopShadow", "viewEveryMs", "rawUpdate"]) assert.ok(k in last, `${k} in ${JSON.stringify(last).slice(0, 400)}`);
  assert.equal(last.freesThisMinute.n, 1);
  assert.ok(last.lossStopShadow.n >= 1, "the estimate was logged beside the loss stop's reads");
  assert.equal(last.rawUpdate, JSON.stringify(raw));
  assert.ok(stats.length >= 2, "one a minute");
});
