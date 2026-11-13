// Release 11 (Michael's decisions after the Friday 2026-11-06 review, builds/build-c2-log.md, "Release 11 proposal"). Each test is
// meant to fail with its change taken out (the log lists which change each test guards).
import { test } from "node:test";
import assert from "node:assert/strict";
import { OrderUpdateHandler, type TradeUpdate } from "../src/order-stream.ts";
import { MemoryStore, type DayRecord, type OrderRecord } from "../src/store.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { closeOut } from "../src/closeout.ts";
import { SyncMemory, enforceDailyLoss, syncOrders } from "../src/risk.ts";
import { OrderGate, clientOrderIdFor } from "../src/gate.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Governor, RESERVE_FLOOR, RESERVE_SCALING, SAFETY_RESERVE, reserveFor } from "../src/governor.ts";
import { MAX_TRADES_PER_MINUTE, MAX_TRADES_PER_MINUTE_LOAD_DAY, SUGGESTED_LIMITS, applyOverride, checkEntry, tradesCeiling, type EntryContext } from "../src/limits.ts";
import { StopGapMeter } from "../src/stop-gap.ts";
import { QUIET_MS, ShadowLedger } from "../src/shadow-ledger.ts";
import { formatSummary, windowLimitCounts } from "../src/summary.ts";
import { ensureDay, suggestedFromHistory } from "../src/morning.ts";
import type { Signal } from "../src/strategy.ts";
import { FakeBroker, order } from "./helpers.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle, z } from "./rig.ts";

const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null, atMs: number | null = null, extra: Partial<TradeUpdate> = {}): TradeUpdate => ({ event, order: order(o), positionQty, atMs, ...extra });

// A worker day on the simulated broker, approved the evening before and armed, with the live order updates connected.
async function simDay() {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.hideFilledParents = true;
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("14:59:00").getTime());
  return { sim, r };
}

// A filled 1-share window entry at the simulated broker, written down the way the gate and the sync have it.
async function holdOne(sim: SimBroker, r: Awaited<ReturnType<typeof simDay>>["r"], symbol: string, n = 1) {
  const id = clientOrderIdFor(D, symbol, n);
  await sim.submitEntry({ symbol, qty: 1, stopPrice: 9.98, takeProfitPrice: 10.01, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 1, referencePrice: 10, stopPrice: 9.98, takeProfitPrice: 10.01, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  return { id, o: sim.orders.find((x) => x.clientOrderId === id)! };
}

// ================================ 1. Lost exits: both exits of a filled entry cancelled ================================

test("decision 1, handler: both exits of a filled entry ended with nothing filled are reported once; a normal exit, a partial take-profit and an unfilled entry are not", async () => {
  const seen: string[] = [];
  const h = new OrderUpdateHandler({ getOrder: async () => null, closeOrder: async () => undefined, dropPosition: () => undefined, onExitsLost: (i) => void seen.push(i.symbol), now: () => 0 });
  const entry = (sym: string, filled = 1) => upd(filled > 0 ? "fill" : "canceled", { clientOrderId: `cyrus-20261102-${sym}-1`, symbol: sym, side: "buy", status: filled > 0 ? "filled" : "canceled", qty: Math.max(1, filled), filledQty: filled, filledAvgPrice: filled > 0 ? 10 : null, groupId: `g${sym}` }, filled > 0 ? filled : null);
  const leg = (sym: string, kind: "tp" | "sl", event: string, filled = 0) => upd(event, { id: `${kind}-${sym}`, clientOrderId: `${kind}`, symbol: sym, side: "sell", type: kind === "tp" ? "limit" : "stop", stopPrice: kind === "sl" ? 9.98 : null, status: event === "fill" ? "filled" : event === "partial_fill" ? "partially_filled" : "canceled", qty: 1, filledQty: filled, groupId: `g${sym}` }, null, 1000);
  for (const u of [entry("IREN"), leg("IREN", "tp", "canceled"), leg("IREN", "sl", "canceled")]) await h.handle(u);
  for (const u of [leg("IREN", "sl", "canceled")]) await h.handle(u); // the same leg again: still reported once
  for (const u of [entry("WULF"), leg("WULF", "tp", "fill", 1), leg("WULF", "sl", "canceled")]) await h.handle(u);
  // 3 shares, the take-profit filled 1, then both exits ended: the stop gap (decision 3 of 2026-11-05) handles it, not this.
  for (const u of [entry("CIFR", 3), leg("CIFR", "tp", "partial_fill", 1), leg("CIFR", "sl", "canceled"), leg("CIFR", "tp", "canceled", 1)]) await h.handle(u);
  for (const u of [entry("SNAP", 0), leg("SNAP", "tp", "canceled"), leg("SNAP", "sl", "canceled")]) await h.handle(u);
  for (const u of [entry("RIOT"), leg("RIOT", "sl", "canceled")]) await h.handle(u); // only one exit ended: the take-profit still holds
  assert.deepEqual(seen, ["IREN"]);
  assert.equal(h.lostExits.reported, 1);
  // The entry's fill can arrive after both cancels: reported when it arrives.
  for (const u of [leg("XP", "tp", "canceled"), leg("XP", "sl", "canceled")]) await h.handle(u);
  assert.deepEqual(seen, ["IREN"], "the entry is not known yet");
  await h.handle(entry("XP"));
  assert.deepEqual(seen, ["IREN", "XP"]);
});

test("decision 1, worker: the 6 cases of 2026-11-06 (both exits cancelled as the entry filled) are sold about a second after the cancel, not at the next 10 second sync", async () => {
  const { sim, r } = await simDay();
  const { id, o } = await holdOne(sim, r, "IREN");
  await r.at("15:00:00"); // a sync: all well
  await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: "IREN", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 10, groupId: o.groupId }, 1));
  sim.advanceTo(z("15:00:01").getTime());
  sim.cancelExitsAtFill(id);
  for (const l of o.legs) await r.orderUpdate(upd("canceled", { ...structuredClone(l), status: "canceled", groupId: o.groupId }, null, sim.simMs));
  assert.equal(sim.sellLog.length, 0);
  r.setNow("15:00:01.1");
  for (let i = 0; i < 20 && sim.sellLog.length === 0; i++) await settle();
  assert.deepEqual(sim.sellLog.map((x) => [x.symbol, x.qty]), [["IREN", 1]], "sold by the missing-exit check");
  assert.ok(sim.sellLog[0]!.at < z("15:00:03").getTime(), `sold ${(sim.sellLog[0]!.at - z("15:00:01").getTime()) / 1000} s after the cancel`);
  assert.ok(r.said("alerts").some((t) => t.includes("IREN: I could not confirm a live protective stop, so I sold it")));
  assert.equal(sim.oversellAttempts, 0);
});

test("decision 1, worker: if Alpaca's order list does not show the cancel yet, the sync is tried again half a second later", async () => {
  const { sim, r } = await simDay();
  const { id, o } = await holdOne(sim, r, "XP");
  await r.at("15:00:00");
  await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: "XP", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 10, groupId: o.groupId }, 1));
  sim.advanceTo(z("15:00:01").getTime());
  // The live updates say both exits are cancelled, but Alpaca's order list still shows them live.
  for (const l of o.legs) await r.orderUpdate(upd("canceled", { ...structuredClone(l), status: "canceled", groupId: o.groupId }, null, sim.simMs));
  r.setNow("15:00:01.1");
  for (let i = 0; i < 20; i++) await settle();
  assert.equal(sim.sellLog.length, 0, "the first sync sees live exits: nothing sold");
  sim.cancelExitsAtFill(id); // now the list shows it
  r.setNow("15:00:01.7");
  for (let i = 0; i < 20 && sim.sellLog.length === 0; i++) await settle();
  assert.deepEqual(sim.sellLog.map((x) => x.symbol), ["XP"]);
  assert.ok(sim.sellLog[0]!.at < z("15:00:03").getTime(), "the follow-up sync sold it, long before the next 10 second sync");
});

test("decision 1, sync: a reported entry the listing left out is looked up first, ahead of 12 older missing entries (10 lookups a sync)", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const store = new MemoryStore();
  await ensureDay({ store, broker: sim, now: () => new Date(sim.simMs) }, D);
  const day = (await store.getDay(D))!;
  const ids: string[] = [];
  for (let n = 0; n < 13; n++) {
    const sym = n === 12 ? "IREN" : `S${n}`;
    const id = clientOrderIdFor(D, sym, 1);
    await sim.submitEntry({ symbol: sym, qty: 1, stopPrice: 9.98, takeProfitPrice: 10.01, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: sym, qty: 1, referencePrice: 10, stopPrice: 9.98, takeProfitPrice: 10.01, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 60_000 + n * 1000).toISOString() });
    sim.hiddenFromListing.add(id);
    ids.push(id);
    sim.advance(10);
  }
  sim.cancelExitsAtFill(ids[12]!); // the newest entry lost both exits
  const memory = new SyncMemory();
  memory.mustLook.add(ids[12]!);
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const res = await syncOrders({ broker: sim, store, now: () => new Date(sim.simMs), say: async () => true, liquidator, syncMemory: memory }, day, { protect: true, streamLive: true });
  assert.deepEqual(res.unprotected, ["IREN"], "found and sold in the first sync");
  assert.equal(memory.mustLook.has(ids[12]!), false);
});

test("decision 1, worker: exits cancelled while a sale is running (that sale cancelled them) start no extra sync", async () => {
  const { sim, r } = await simDay();
  const { id, o } = await holdOne(sim, r, "SNAP");
  await r.at("15:00:00");
  await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: "SNAP", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 10, groupId: o.groupId }, 1));
  const w = r.worker as unknown as { liquidator: Liquidator };
  const orig = w.liquidator.isLiquidating.bind(w.liquidator);
  w.liquidator.isLiquidating = () => true;
  const before = r.timers().length;
  for (const l of o.legs) await r.orderUpdate(upd("canceled", { ...structuredClone(l), status: "canceled", groupId: o.groupId }, null, sim.simMs));
  assert.equal(r.timers().length, before, "no sync timer");
  w.liquidator.isLiquidating = orig;
});

// ================================ 2. The summary: every missing order, buys and sells ================================

test("decision 2: the summary looks up every entry the listing left out (no cap of 50) and the sells too, from the day's fills, so it matches the account", async () => {
  const { sim, r } = await simDay();
  const logged: Array<{ e: string; data: any }> = [];
  (r.worker as unknown as { d: { log: unknown } }).d.log = (_l: string, e: string, data: unknown) => void logged.push({ e, data });
  sim.advanceTo(z("15:00:00").getTime());
  for (let n = 1; n <= 60; n++) {
    const id = clientOrderIdFor(D, `S${n}`, 1);
    await sim.submitEntry({ symbol: `S${n}`, qty: 1, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    sim.fillExit(id, "take_profit", 10.1);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: `S${n}`, qty: 1, referencePrice: 10, stopPrice: 9.9, takeProfitPrice: 10.1, status: "filled", alpacaOrderId: "x", filledQty: 1, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
    sim.hiddenFromListing.add(id); // 60 entries missing from the listing: more than the old cap of 50
  }
  // A visible entry whose take-profit filled 1 of 3 shares; the other 2 were sold by a remainder sale the listing also left out.
  const id = clientOrderIdFor(D, "CIFR", 1);
  await sim.submitEntry({ symbol: "CIFR", qty: 3, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "CIFR", qty: 3, referencePrice: 10, stopPrice: 9.9, takeProfitPrice: 10.1, status: "filled", alpacaOrderId: "x", filledQty: 3, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  sim.partialTakeProfit(id, 1, 10.1);
  const tp = sim.orders.find((x) => x.clientOrderId === id)!.legs.find((l) => l.type === "limit")!;
  tp.status = "canceled";
  sim.prices.set("CIFR", 10.2);
  await sim.submitSell({ symbol: "CIFR", qty: 2, clientOrderId: "cyrus-x-20261102-CIFR-abc-1" });
  sim.advance(2_000);
  sim.hiddenFromListing.add("cyrus-x-20261102-CIFR-abc-1");
  await (r.worker as unknown as { summaryPhase(d: string): Promise<void> }).summaryPhase(D);
  const text = r.said("trading").join("\n");
  assert.match(text, /61 entry orders sent \(61 filled\)/, text.slice(0, 600));
  assert.match(text, /62 sells filled/);
  assert.match(text, /\+6\.50 from closed trades/, "60 x 0.10 + 1 x 0.10 + 2 x 0.20");
  assert.ok(!text.includes("Note:"), "nothing unmatched, so no note");
  assert.ok(!text.includes("could not check every order"), "the fills check ran in full");
  assert.deepEqual(logged.find((x) => x.e === "summary_fills_check")?.data, { complete: true, found: 1, stillMissing: 0 }, "every missing entry was found by its client id; only the sale needed the fills check");
});

test("decision 2: on a big day the summary's few hundred reads are paced and never cause a rate-limit answer; its request figures are the session's", async () => {
  const { sim, r } = await simDay();
  sim.onRate = (remaining) => r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining, reset: null });
  sim.advanceTo(z("15:00:00").getTime());
  sim.bucketOn = false; // the setup's own orders do not count
  for (let n = 1; n <= 300; n++) {
    const id = clientOrderIdFor(D, `S${n}`, 1);
    await sim.submitEntry({ symbol: `S${n}`, qty: 1, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    sim.fillExit(id, "take_profit", 10.1);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: `S${n}`, qty: 1, referencePrice: 10, stopPrice: 9.9, takeProfitPrice: 10.1, status: "filled", alpacaOrderId: "x", filledQty: 1, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
    sim.hiddenFromListing.add(id);
  }
  sim.bucketOn = true;
  sim.tokens = 200;
  sim.rejected429 = 0;
  const before = r.governor.stats().requestsLastMinute;
  await (r.worker as unknown as { summaryPhase(d: string): Promise<void> }).summaryPhase(D);
  assert.equal(sim.rejected429, 0, `no rate-limit answer (lowest left ${Math.floor(sim.lowestTokens)})`);
  const text = r.said("trading").join("\n");
  assert.match(text, /300 entry orders sent \(300 filled\)/);
  assert.match(text, new RegExp(`about ${before} in the minute before this summary`), "the session's figures, taken before the summary's own reads");
});

test("decision 2: the 'carried position' note only when the day began with shares held; otherwise unmatched shares are named as unmatched; a failed fills check is said", () => {
  const dayRec = { tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), status: "approved", dayStartEquity: 20000, suggested: {}, limits: { maxPositionUsd: 500, dailyLossStopUsd: 500, maxTradesPerMinute: 100, borrowingCap: 1 }, decided: {}, liveList: [], phases: {} } as never;
  const sell = order({ id: "s1", clientOrderId: "cyrus-x-a", symbol: "ADT", side: "sell", status: "filled", qty: 3, filledQty: 3, filledAvgPrice: 9.88, filledAt: z("15:00:00").toISOString() });
  const base = { day: dayRec, stored: [], refusals: [], alpacaOrders: [sell], account: { equity: 20000 } as never, peak: null, stop: null, flat: true, fillsCheck: { complete: true, found: 0, stillMissing: 0 } };
  const plain = formatSummary(base);
  assert.ok(plain.includes("Note: 3 sold shares could not be matched to a buy Alpaca showed for today, so no profit is counted for them."), plain);
  assert.ok(!plain.includes("carried position"));
  assert.ok(formatSummary({ ...base, carriedAtStart: true }).includes("bought before today (a carried position)"));
  assert.ok(!plain.includes("could not check every order"));
  assert.ok(formatSummary({ ...base, fillsCheck: null }).includes("I could not check every order against Alpaca's list of today's fills"));
  assert.ok(formatSummary({ ...base, fillsCheck: { complete: true, found: 2, stillMissing: 1 } }).includes("I could not check every order"));
});

test("decision 2, worker: selling a carried position marks the day, and only then does the summary call an unmatched sale carried", async () => {
  const r = rig<FakeBroker, MemoryStore>({ orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.orders = [order({ id: "s1", clientOrderId: "cyrus-x-20261102-ADT-a", symbol: "ADT", side: "sell", status: "filled", qty: 7, filledQty: 7, filledAvgPrice: 9.88, filledAt: z("14:31:00").toISOString(), createdAt: z("14:31:00").toISOString() })];
  const w = r.worker as unknown as { summaryPhase(d: string): Promise<void>; carriedPhase(d: string): Promise<void> };
  await w.summaryPhase(D);
  assert.ok(r.said("trading").join("\n").includes("7 sold shares could not be matched"), r.said("trading").join("\n").slice(0, 800));
  r.broker.clock = { ...r.broker.clock, isOpen: false }; // nothing is sold here; only the marker matters
  await w.carriedPhase(D);
  await settle();
  assert.ok((await r.store.getDay(D))!.phases.carried, "the day is marked");
  const before = r.said("trading").length;
  await w.summaryPhase(D);
  assert.ok(r.said("trading").slice(before).join("\n").includes("7 shares were sold that were bought before today (a carried position)"));
});

test("decision 2: the window line counts the limit buys from Alpaca's records (filled, cancelled unfilled), not the cancel requests", () => {
  const rows = ["A", "B", "C", "D"].map((s) => ({ clientOrderId: `c-${s}`, createdAt: z("14:46:00").toISOString() }) as OrderRecord);
  const orders = [
    order({ clientOrderId: "c-A", symbol: "A", type: "limit", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 10 }),
    order({ clientOrderId: "c-B", symbol: "B", type: "limit", status: "canceled", qty: 1, filledQty: 0 }),
    order({ clientOrderId: "c-C", symbol: "C", type: "limit", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 10 }), // a cancel met its fill
    order({ clientOrderId: "c-D", symbol: "D", type: "market", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 10 }),
  ];
  assert.deepEqual(windowLimitCounts(rows, orders), { sent: 3, filled: 2, cancelledUnfilled: 1 });
});

test("decision 2, worker: when Alpaca's fills cannot be read, the summary still posts and says it could not check every order", async () => {
  const r = rig<FakeBroker, MemoryStore>({ orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.fillsFail = true;
  await (r.worker as unknown as { summaryPhase(d: string): Promise<void> }).summaryPhase(D);
  assert.ok(r.said("trading").join("\n").includes("I could not check every order against Alpaca's list of today's fills"));
});

// ================================ 3. The stop-gap measurement starts when the sale is sent ================================

test("decision 3: the sell path reports each sale the moment Alpaca accepts it, before its fill", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  sim.sellFillDelayMs = 1_500;
  const id = "cyrus-20261102-CIFR-1";
  await sim.submitEntry({ symbol: "CIFR", qty: 4, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  sim.cancelExitsAtFill(id);
  sim.advance(1_000);
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
  const liq = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const sent: Array<{ clientOrderId: string; atMs: number; filledThen: boolean }> = [];
  await liq.flatten({ reason: "test", tradeDate: D, only: ["CIFR"], maxRounds: 2, onSellSent: (s) => void sent.push({ clientOrderId: s.clientOrderId, atMs: s.atMs, filledThen: sim.orders.find((o) => o.clientOrderId === s.clientOrderId)!.status === "filled" }) });
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.filledThen, false, "told before the sale filled");
  assert.equal(sent[0]!.clientOrderId, sim.sellLog.length ? sim.orders.find((o) => o.side === "sell" && !o.groupId)!.clientOrderId : "", "with the sale's own client id");
  assert.equal(sent[0]!.atMs, sim.sellLog[0]!.at);
});

test("decision 3, sync: the remainder sale is handed to the meter at send time with its client id (A4 fallback: Alpaca refuses the fresh stop, so the remainder is sold at market as before)", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  sim.refuseStops = true;
  sim.hideFilledParents = true;
  sim.sellFillDelayMs = 1_500;
  const store = new MemoryStore();
  await ensureDay({ store, broker: sim, now: () => new Date(sim.simMs) }, D);
  const day = (await store.getDay(D))!;
  const id = clientOrderIdFor(D, "CIFR", 1);
  await sim.submitEntry({ symbol: "CIFR", qty: 10, stopPrice: 7.21, takeProfitPrice: 7.28, referencePrice: 7.27, clientOrderId: id });
  sim.fillEntry(id, 7.27);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "CIFR", qty: 10, referencePrice: 7.27, stopPrice: 7.21, takeProfitPrice: 7.28, status: "filled", alpacaOrderId: null, filledQty: 10, filledAvgPrice: 7.27, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  sim.advance(5_000);
  sim.partialTakeProfit(id, 3, 7.28);
  sim.advance(4_000);
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const told: Array<{ clientOrderId?: string; atMs: number; shares: number; takeProfit: number | null; filledThen: boolean }> = [];
  await syncOrders({ broker: sim, store, now: () => new Date(sim.simMs), say: async () => true, liquidator, syncMemory: new SyncMemory(), onBareSale: (s) => void told.push({ ...s, filledThen: sim.orders.find((o) => o.clientOrderId === s.clientOrderId)?.status === "filled" }) }, day, { protect: true });
  assert.equal(told.length, 1);
  assert.ok(told[0]!.clientOrderId?.startsWith("cyrus-x-"), "with the sale's client id");
  assert.equal(told[0]!.filledThen, false, "at send time, before the fill");
  assert.deepEqual([told[0]!.shares, told[0]!.takeProfit], [7, 7.28]);
});

test("decision 3, meter: a fill is matched by the sale's client id (not the symbol), and a fill that arrives before the sale is reported is kept and matched", () => {
  const m = new StopGapMeter();
  m.startDay(D, null);
  const t = z("15:00:00").getTime();
  m.onOwnSellFill("cyrus-x-early", "WULF", 9.4, t + 300, t + 300); // the fill beat the report of the sale
  m.onSale({ symbol: "WULF", shares: 2, takeProfit: 9.45, atMs: t, clientOrderId: "cyrus-x-early" });
  m.onSale({ symbol: "CIFR", shares: 1, takeProfit: 7.3, atMs: t, clientOrderId: "cyrus-x-a" });
  m.onSale({ symbol: "CIFR", shares: 3, takeProfit: 7.3, atMs: t + 100, clientOrderId: "cyrus-x-b" });
  m.onOwnSellFill("cyrus-x-b", "CIFR", 7.2, t + 400, t + 400); // the later sale fills first
  m.onOwnSellFill("cyrus-x-a", "CIFR", 7.25, t + 600, t + 600);
  m.onPrint("CIFR", 7.26, t + 2_000);
  m.onPrint("WULF", 9.42, t + 2_000);
  m.settle(t + 6_000);
  const d = m.totals();
  assert.deepEqual([d.sales, d.shares, d.unmeasured, d.wouldHaveFilled], [3, 6, 0, 0], "every sale measured");
  // CIFR a: (7.25 - 7.26) x 1 = -0.01; CIFR b: (7.20 - 7.26) x 3 = -0.18; WULF: (9.40 - 9.42) x 2 = -0.04.
  assert.equal(d.dollarsVsWaiting, -0.23);
});

test("decision 3, worker: a remainder sale with its fill on the live updates is measured (not 'not measured') (A4 fallback: Alpaca refuses the fresh stop, so the remainder is sold at market as before)", async () => {
  const { sim, r } = await simDay();
  sim.refuseStops = true;
  const id = clientOrderIdFor(D, "CIFR", 1);
  await sim.submitEntry({ symbol: "CIFR", qty: 10, stopPrice: 7.21, takeProfitPrice: 7.28, referencePrice: 7.27, clientOrderId: id });
  sim.fillEntry(id, 7.27);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "CIFR", qty: 10, referencePrice: 7.27, stopPrice: 7.21, takeProfitPrice: 7.28, status: "filled", alpacaOrderId: null, filledQty: 10, filledAvgPrice: 7.27, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  await r.at("15:00:00");
  const o = sim.orders.find((x) => x.clientOrderId === id)!;
  sim.advanceTo(z("15:00:01").getTime());
  sim.partialTakeProfit(id, 3, 7.28);
  const tp = o.legs.find((l) => l.type === "limit")!;
  const sl = o.legs.find((l) => l.type === "stop")!;
  await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: "CIFR", side: "buy", status: "filled", qty: 10, filledQty: 10, filledAvgPrice: 7.27, groupId: o.groupId }, 10));
  await r.orderUpdate(upd("partial_fill", { ...structuredClone(tp), groupId: o.groupId }, 7, sim.simMs));
  await r.orderUpdate(upd("canceled", { ...structuredClone(sl), groupId: o.groupId }, null, sim.simMs));
  r.setNow("15:00:04.3");
  for (let i = 0; i < 10 && sim.sellLog.length === 0; i++) await settle();
  assert.equal(sim.sellLog.length, 1);
  const sale = sim.orders.find((x) => x.side === "sell" && x.clientOrderId.startsWith("cyrus-x-"))!;
  // The sale's fill arrives on the live updates after the sell path has reported it.
  await r.orderUpdate(upd("fill", { id: sale.id, clientOrderId: sale.clientOrderId, symbol: "CIFR", side: "sell", type: "market", status: "filled", qty: 7, filledQty: 7, filledAvgPrice: 7.27 }, 0, sim.simMs, { price: 7.27 }));
  await r.at("15:00:12");
  const totals = (r.worker as unknown as { stopGap: StopGapMeter }).stopGap.totals();
  assert.deepEqual([totals.sales, totals.shares, totals.unmeasured], [1, 7, 0]);
});

// ================================ 4. The shadow estimate's own book ================================

test("decision 4, book: no estimate until a quiet read; a read near a fill is not used; fills move cash and shares; a dropped stream drops the book", () => {
  const b = new ShadowLedger();
  const prices = new Map([["BBB", 50]]);
  assert.equal(b.estimate(prices, 0), null);
  b.offerBase(20_000, [], 1_000, 1_100);
  assert.equal(b.estimate(prices, 1_100 + QUIET_MS - 1), null, "not before its quiet time has passed");
  assert.equal(b.estimate(prices, 1_100 + QUIET_MS), 20_000);
  b.onFill({ symbol: "BBB", side: "buy", fillQty: 10, price: 50, positionQty: 10, arrivedMs: 10_000 });
  assert.equal(b.estimate(prices, 10_001), 20_000, "cash down 500, 10 shares at 50");
  prices.set("BBB", 50.5);
  assert.equal(b.estimate(prices, 10_002), 20_005);
  // While the book is trustworthy a read never overwrites it, even a quiet one whose position list lags (it only checks the cash).
  b.offerBase(19_500, [], 11_000, 11_100);
  assert.equal(b.estimate(prices, 20_000), 20_005);
  b.offerBase(19_400, [], 20_000, 20_100);
  assert.equal(b.estimate(prices, 25_000), 20_005, "the lagging read did not replace the book");
  assert.deepEqual([b.counts.checks, b.counts.maxCheckCashGap], [2, 100], "checked; the quiet read's cash differed by 100");
  b.onFill({ symbol: "BBB", side: "sell", fillQty: 4, price: 51, positionQty: 6, arrivedMs: 21_000 });
  assert.equal(b.estimate(prices, 30_000), 19_500 + 204 + 6 * 50.5);
  // A fill whose shares cannot be counted, or a dropped stream: no estimate until the next quiet read.
  b.drop();
  assert.equal(b.estimate(prices, 30_001), null);
  // While unset: a read that began within the quiet time after a fill is not used.
  b.onFill({ symbol: "BBB", side: "buy", fillQty: 1, price: 50, positionQty: 7, arrivedMs: 38_000 });
  b.offerBase(19_654, [{ symbol: "BBB", qty: 6, marketValue: 303 }], 40_000, 40_100);
  assert.equal(b.estimate(prices, 45_000), null, "the read came 2 seconds after a fill: not used");
  b.offerBase(19_654, [{ symbol: "BBB", qty: 7, marketValue: 353.5 }], 46_000, 46_100);
  assert.equal(b.estimate(prices, 46_100 + QUIET_MS), 19_654 + 7 * 50.5);
  b.drop();
  b.offerBase(19_704, [{ symbol: "BBB", qty: 6, marketValue: 303 }], 60_000, 60_100);
  assert.equal(b.estimate(prices, 60_100 + QUIET_MS), 19_704 + 6 * 50.5);
  b.onFill({ symbol: "BBB", side: "sell", fillQty: null, price: 51, positionQty: null, arrivedMs: 70_000 });
  assert.equal(b.estimate(prices, 70_001), null);
});

test("decision 4, worker: Alpaca's positions lag a fill by a second; the old estimate was 500 dollars off for up to 10 seconds, the book is exact", async () => {
  const r = rig<FakeBroker, MemoryStore>({ liveList: ["BBB", "CCC"], orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("13:45:00");
  await r.at("14:25:00");
  await r.at("15:00:00");
  await r.trade("BBB", 50, "15:00:05");
  await r.at("15:00:20");
  await r.at("15:00:31"); // a view refresh (account and positions): the book's quiet read
  await r.at("15:00:35");
  await r.at("15:00:38");
  // A buy of 10 BBB at 50 fills at 15:00:41: Alpaca's cash and equity show it at once, its position list a second later.
  r.broker.account = { ...r.broker.account, cash: 19_500, equity: 20_000 };
  await r.orderUpdate(upd("fill", { clientOrderId: "cyrus-20261102-BBB-1", symbol: "BBB", side: "buy", status: "filled", qty: 10, filledQty: 10, filledAvgPrice: 50, groupId: "gB" }, 10, z("15:00:41").getTime(), { price: 50, fillQty: 10 }));
  await r.at("15:00:41.2"); // the view's next refresh starts after the fill and gets Alpaca's old (empty) position list
  // The price moves: Alpaca's equity follows it; its position list catches up at 15:00:44.
  await r.trade("BBB", 51, "15:00:42");
  r.broker.account = { ...r.broker.account, cash: 19_500, equity: 20_010 };
  for (const t of ["15:00:43", "15:00:44"]) await r.at(t);
  r.broker.positions = [{ symbol: "BBB", qty: 10, qtyAvailable: 0, marketValue: 510, avgEntryPrice: 50, unrealizedPl: 10 }];
  for (const t of ["15:00:45", "15:00:46", "15:00:47", "15:00:48", "15:01:15"]) await r.at(t);
  const stats = r.store.events.filter((e) => e.event === "governor_stats").map((e) => (e.data as any).lossStopShadow).filter((s) => s && s.n > 0);
  if (process.env.DEBUG_SHADOW) console.log(JSON.stringify(stats));
  assert.ok(stats.length >= 1, "estimates were logged");
  for (const s of stats) assert.ok(s.maxAbsDiff < 1, `largest gap ${s.maxAbsDiff} dollars: ${JSON.stringify(s)}`);
  // The book starts each day afresh (group 2 review, round 1).
  const w = r.worker as unknown as { shadowLedger: ShadowLedger; startOrderStream(d: string): void };
  assert.equal(w.shadowLedger.valid(), true);
  w.startOrderStream(D);
  assert.equal(w.shadowLedger.valid(), false);
});

// ================================ 5. 150 orders a minute on load days only ================================

test("decision 5: trades is accepted up to 150 on a load day and up to 100 otherwise; the ceiling in force caps every check", () => {
  assert.deepEqual([MAX_TRADES_PER_MINUTE, MAX_TRADES_PER_MINUTE_LOAD_DAY, tradesCeiling(true), tradesCeiling(false)], [100, 150, 150, 100]);
  assert.ok("limits" in applyOverride(SUGGESTED_LIMITS, "trades", "150", 20000, { loadDay: true }));
  const normal = applyOverride(SUGGESTED_LIMITS, "trades", "150", 20000);
  assert.ok("error" in normal && normal.error.includes("up to 150 on a load day, after `load on`"), JSON.stringify(normal));
  assert.ok("error" in applyOverride(SUGGESTED_LIMITS, "trades", "151", 20000, { loadDay: true }));
  assert.ok("limits" in applyOverride(SUGGESTED_LIMITS, "trades", "100", 20000));
  const g = (ceiling: number | undefined, limit = 150) => {
    let t = 0;
    const gov = new Governor(() => t);
    let n = 0;
    while ((ceiling === undefined ? gov.admitTrade(limit) : gov.admitTrade(limit, ceiling)).ok && n < 1000) n++;
    return n;
  };
  assert.deepEqual([g(150), g(100), g(undefined), g(999), g(999, 999), g(150, 120)], [150, 100, 100, 150, 150, 120], "load day 150, normal 100, never above 150, never above the approved value");
  const ctx = (over: Partial<EntryContext>): EntryContext => ({ symbol: "AAA", price: 10, limits: { ...SUGGESTED_LIMITS, maxTradesPerMinute: 150 }, stopFlag: false, marketOpen: true, minutesSinceOpen: 20, minutesToClose: 300, tradesLastMinute: 120, heldSymbols: new Set(), dayStartEquity: 20000, equity: 20000, grossExposure: 0, priceAgeSeconds: 1, ...over });
  assert.equal(checkEntry(ctx({ tradesCeiling: 150 })).ok, true);
  assert.equal(checkEntry(ctx({})).ok, false, "without a ceiling given: 100");
  assert.equal(checkEntry(ctx({ tradesCeiling: 999 })).ok, true);
  assert.equal(checkEntry(ctx({ tradesCeiling: 999, tradesLastMinute: 150 })).ok, false, "never above 150");
});

async function gateFor(load: "on" | "ended" | null, approved = 150) {
  const broker = new FakeBroker();
  const store = new MemoryStore();
  const now = z("15:00:00");
  await ensureDay({ store, broker, now: () => now }, D);
  await store.updateDay(D, { status: "approved", limits: { maxPositionUsd: 500, dailyLossStopUsd: 500, maxTradesPerMinute: approved, borrowingCap: 1 }, decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z", ...(load ? { load } : {}) }, dayStartEquity: 20000 });
  const governor = new Governor(() => now.getTime());
  const ceilings: number[] = [];
  const orig = governor.admitTrade.bind(governor);
  governor.admitTrade = (limit: number, ceiling?: number) => (ceilings.push(ceiling ?? -1), orig(limit, ceiling));
  const gate = new OrderGate({ broker, store, view: new BrokerView(broker, () => now.getTime()), governor, now: () => now, say: (async () => true) as any, note: () => undefined });
  const signal: Signal = { symbol: "AAA", price: 20, tradeTime: new Date(now.getTime() - 1000), stopPrice: 19.9, takeProfitPrice: 20.05 };
  return { gate, governor, ceilings, signal, broker, store };
}

test("decision 5, gate: the ceiling is 150 only while a load day's window is on; 100 on a normal day and after `load off`, whatever was approved", async () => {
  for (const [load, want] of [["on", 150], ["ended", 100], [null, 100]] as const) {
    const { gate, ceilings, signal } = await gateFor(load);
    await gate.enter(signal);
    assert.deepEqual(ceilings, [want], `load ${load}`);
  }
});

test("decision 5, commands: `trades 150` needs `load on` (in the same message, either order); `load off` lowers it to 100; the evening suggestion never carries more than 100", async () => {
  const r = rig<FakeBroker, MemoryStore>({ orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  const before = r.said("commands").length;
  r.ownerSays("trades 150", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  assert.ok(r.said("commands").slice(before).join("\n").includes("Not changed: trades a minute must be a whole number from 1 to 100"), "refused on a normal day");
  r.ownerSays("trades 150\nload on\napprove", "2026-11-01T22:21:00Z");
  await r.at("2026-11-01T22:21:10Z");
  let d = (await r.store.getDay(D))!;
  assert.deepEqual([d.limits.maxTradesPerMinute, d.phases.load, d.status], [150, "on", "approved"]);
  const reply = r.said("commands").at(-1)!;
  assert.ok(reply.indexOf("**trades 150**") < reply.indexOf("**load on**"), "the replies keep the order the lines were written in");
  assert.ok(reply.includes("the ceiling is 150 on this load day until the mid-day pause, then 100"), reply);
  r.ownerSays("load off", "2026-11-01T22:22:00Z");
  await r.at("2026-11-01T22:22:10Z");
  d = (await r.store.getDay(D))!;
  assert.deepEqual([d.limits.maxTradesPerMinute, d.phases.load], [100, "off"]);
  assert.ok(r.said("commands").at(-1)!.includes("`trades` lowered from 150 to 100"));
  // The evening suggestion for the day after a load day approved at 150.
  await r.store.updateDay(D, { limits: { ...d.limits, maxTradesPerMinute: 150 } });
  const next = await suggestedFromHistory(r.store, "2026-11-03");
  assert.equal(next.limits.maxTradesPerMinute, 100);
});

// ================================ 7. The reserve scales with open symbols ================================

test("decision 7: the reserve is 52 + open symbols, at most 80; unknown means the cap; the lows are kept for the day and for each minute", () => {
  assert.deepEqual([0, 1, 2, 10, 20, 27, 28, 30, 100].map(reserveFor), [52, 53, 54, 62, 72, 79, 80, 80, 80]);
  assert.equal(RESERVE_FLOOR, 52);
  assert.equal(SAFETY_RESERVE, 80);
  let t = 0;
  assert.equal(new Governor(() => t).reserve(), 80);
  const fixed = new Governor(() => t);
  fixed.setOpenSymbols(0);
  assert.equal(fixed.reserve(), RESERVE_SCALING ? 52 : 80, "the reserve in force: fixed at 80 until the scaling is switched on (Michael, 2026-11-06)");
  const g = new Governor(() => t, { scaleReserve: true });
  assert.equal(g.reserve(), 80, "until told how many symbols are open");
  g.setOpenSymbols(0);
  g.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: 53, reset: null });
  assert.equal(g.canSpend(), true, "53 is above a reserve of 52");
  g.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: 52, reset: null });
  assert.equal(g.canSpend(), false);
  g.setOpenSymbols(20);
  g.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: 73, reset: null });
  assert.equal(g.canSpend(), true, "73 is above a reserve of 72");
  g.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: 40, reset: null });
  assert.equal(g.canSpend(), false, "20 open symbols: a reserve of 72");
  assert.match((g.admitTrade(150, 150) as { reason: string }).reason, /the last 72 are kept/);
  assert.equal(g.stats().reserveNow, 72);
  assert.equal(g.stats().lowestAboveReserve, -32, "the day's lowest of remaining minus the reserve in force (40 - 72)");
  const m1 = g.takeMinuteReserve();
  assert.deepEqual([m1.min, m1.max, m1.lowestRemaining, m1.lowestAboveReserve], [52, 72, 40, -32]);
  g.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: 120, reset: null });
  const m2 = g.takeMinuteReserve();
  assert.deepEqual([m2.lowestRemaining, m2.lowestAboveReserve], [120, 48], "each minute's lows start again");
  assert.equal(g.stats().lowestAboveReserve, -32, "the day's low stays");
  t += 1;
});

test("decision 7, gate: before each entry it tells the governor how many symbols are open, counting the entry it is about to send", async () => {
  const { gate, governor, signal, broker, store } = await gateFor("on");
  for (const s of ["BBB", "CCC"]) await store.insertOrder({ clientOrderId: `cyrus-20261102-${s}-1`, tradeDate: D, symbol: s, qty: 2, referencePrice: 20, stopPrice: 19.9, takeProfitPrice: 20.05, status: "filled", alpacaOrderId: "x", filledQty: 2, filledAvgPrice: 20, note: null, createdAt: z("14:59:00").toISOString() });
  broker.positions = [{ symbol: "BBB", qty: 2, qtyAvailable: 0, marketValue: 40, avgEntryPrice: 20, unrealizedPl: 0 }, { symbol: "CCC", qty: 2, qtyAvailable: 0, marketValue: 40, avgEntryPrice: 20, unrealizedPl: 0 }];
  await gate.enter(signal);
  assert.equal(governor.openSymbolCount(), 3, "BBB, CCC and AAA");
  assert.equal(governor.reserve(), RESERVE_SCALING ? reserveFor(3) : 80);
});

test("decision 7, worker: each view refresh counts the open symbols (held, or with an entry working)", async () => {
  const r = rig<FakeBroker, MemoryStore>({ liveList: ["BBB", "CCC"], orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("13:45:00");
  await r.at("14:25:00");
  r.broker.positions = Array.from({ length: 5 }, (_, i) => ({ symbol: `P${i}`, qty: 1, qtyAvailable: 0, marketValue: 10, avgEntryPrice: 10, unrealizedPl: 0 }));
  await r.store.insertOrder({ clientOrderId: "cyrus-20261102-W-1", tradeDate: D, symbol: "W", qty: 1, referencePrice: 10, stopPrice: 9.9, takeProfitPrice: 10.1, status: "submitted", alpacaOrderId: "x", filledQty: null, filledAvgPrice: null, note: null, createdAt: z("14:59:00").toISOString() });
  await r.at("15:00:00");
  assert.equal(r.governor.openSymbolCount(), 6);
  assert.equal(r.governor.reserve(), RESERVE_SCALING ? reserveFor(6) : 80);
});

test("decision 7, loss stop retry: it keeps the reserve in force (not the fixed 80)", async () => {
  for (const [reserve, sells] of [[30, true], [45, false]] as const) {
    const fb = new FakeBroker();
    const store = new MemoryStore();
    await ensureDay({ store, broker: fb, now: () => z("15:00:00") }, D);
    await store.updateDay(D, { status: "approved", phases: { armed: "x" }, dayStartEquity: 20000 });
    await store.setControl("stop_flag", { on: true, at: z("14:59:00").toISOString(), reason: "daily loss stop reached (510.00 dollars)" });
    fb.positions = [{ symbol: "AAA", qty: 3, qtyAvailable: 3, marketValue: 30, avgEntryPrice: 10, unrealizedPl: 0 }];
    const day = (await store.getDay(D))!;
    const liquidator = new Liquidator({ broker: fb, gate: new SellGate({ broker: fb, say: async () => true }), now: () => z("15:00:00"), sleep: async () => undefined });
    await enforceDailyLoss({ broker: fb, store, now: () => z("15:00:00"), say: async () => true, liquidator, governor: { budget: () => 40, reserve: () => reserve } }, day);
    assert.equal(fb.calls.some((c) => c.fn === "submitSell"), sells, `reserve ${reserve}, budget 40`);
  }
});

test("decision 7: a full flatten of 1 to 30 positions (30 is the most the live list allows), starting 8 below the reserve with routine work beside it, never hits a rate limit and leaves at least 10 requests", { timeout: 300_000 }, async () => {
  const MID = Date.UTC(2026, 10, 2, 20, 55);
  for (const n of [1, 5, 12, 20, 30]) for (const path of ["closeout", "lossstop", "flatten"] as const) {
    for (const cancelMs of [200, 7_000]) {
      const sim = new SimBroker(MID);
      sim.cancelMs = cancelMs;
      sim.sellFillDelayMs = 16_000; // Alpaca paper held close-out sells about 16 seconds
      for (let i = 0; i < n; i++) {
        const id = `cyrus-20261102-S${i}-1`;
        await sim.submitEntry({ symbol: `S${i}`, qty: 2, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
        sim.fillEntry(id, 10);
      }
      // Entries drained the bucket to the reserve, and cancels, the sync and the loss stop's reads took it up to 6 or 7 further (the
      // 150 a minute rehearsals; 8 here); routine work beside the flatten takes up to 75 a minute for its whole length.
      sim.tokens = (RESERVE_SCALING ? reserveFor(n) : SAFETY_RESERVE) - 8;
      sim.lowestTokens = sim.tokens;
      sim.refillPerMinute = 200 - 75;
      sim.rejected429 = 0;
      const say = async () => true;
      const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
      const liq = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
      if (path === "closeout") await closeOut({ broker: sim, liquidator: liq, store: new MemoryStore(), now: () => new Date(sim.simMs), say, sleep: sim.sleep }, D, { closeAt: new Date(MID + 300_000), path: "close-out" });
      else await liq.flatten({ reason: path, tradeDate: D, maxRounds: path === "lossstop" ? 1 : 4, priority: path === "lossstop" });
      const label = `${n} positions, ${path}, cancels ${cancelMs} ms`;
      assert.equal(sim.rejected429, 0, `${label}: no rate-limit answer (lowest left ${Math.floor(sim.lowestTokens)})`);
      // At least 10 left; where Michael's cap of 80 holds the reserve below 52 + n (28 open symbols or more), 10 less what the cap took.
      const capped = Math.max(0, RESERVE_FLOOR + n - SAFETY_RESERVE);
      assert.ok(sim.lowestTokens >= 10 - capped, `${label}: at least ${10 - capped} requests left at the lowest (${Math.floor(sim.lowestTokens)})`);
      assert.equal(sim.oversellAttempts, 0);
      sim.advance(20_000); // the sells Alpaca paper holds fill
      // The loss stop's first sale is one round: with 7 second cancels nothing is free to sell in it (its retry sells later).
      if (!(path === "lossstop" && cancelMs === 7_000)) assert.equal([...Array(n).keys()].filter((i) => sim.heldQty(`S${i}`) > 0).length, 0, `${label}: flat`);
    }
  }
});

void ({} as DayRecord);
