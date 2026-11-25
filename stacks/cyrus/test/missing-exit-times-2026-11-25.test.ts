// Michael's decision 2 of 2026-11-25 (builds/build-c2-log.md, "Michael's decisions from Wednesday's mid-day review"): "Yes: the missing-exit
// sale records its checks (logging only), so cases like AMBA-57 can be split." One `missing_exit_sale_checks` row at the end of each
// missing-exit sale (the order sync's sale of a position found without its exits, or of a broken exit pair's rest): when it started, each
// look (the reads, when asked and answered, and what they showed), each round's pause and how it ended, each poll's wait, the market sale
// asked and answered, and the rounds. Logging only: the request sequence and its timing are pinned below to the numbers the code before
// this change (abf7c0f, Fly v41) produced in the same scenarios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore, setPhase } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { EXIT_PAIR_PHASE } from "../src/exit-pair.ts";
import type { PauseEnd } from "../src/cancel-seen.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";
import { STORED_INFO_EVENTS } from "../src/run-log.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day, in the session
const READ_MS = 70; // every read takes 70 ms (about the measured reads)

type Opts = { waitCancelled?: (w: World) => (ids: readonly string[], ms: number) => Promise<PauseEnd>; waitEvent?: (w: World) => (symbols: ReadonlySet<string>, ms: number) => Promise<boolean> };

function world(o: Opts = {}) {
  const sim = new SimBroker(MID);
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const calls: string[] = [];
  let t0 = 0;
  let recording = false;
  const ref: { w: World | null } = { w: null };
  const liquidator = new Liquidator({
    broker: sim,
    gate,
    now: () => new Date(sim.simMs),
    sleep: sim.sleep,
    log,
    ...(o.waitCancelled ? { waitCancelled: (ids: readonly string[], ms: number) => (recording && calls.push(`waitCancelled@${sim.simMs - t0}`), o.waitCancelled!(ref.w!)(ids, ms)) } : {}),
    ...(o.waitEvent ? { waitEvent: (symbols: ReadonlySet<string>, ms: number) => (recording && calls.push(`waitEvent(${ms})@${sim.simMs - t0}`), o.waitEvent!(ref.w!)(symbols, ms)) } : {}),
  });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  // Every broker call, with its time from the start of the recording; reads take READ_MS.
  const wrap = (name: string, readMs: number, detail?: (...a: any[]) => string) => {
    const f = (sim as any)[name].bind(sim);
    (sim as any)[name] = async (...a: any[]) => {
      if (recording) calls.push(`${name}${detail ? `(${detail(...a)})` : ""}@${sim.simMs - t0}`);
      if (readMs > 0) sim.advance(readMs);
      return f(...a);
    };
  };
  wrap("listOrdersPaged", READ_MS, (s: string) => s);
  wrap("listPositions", READ_MS);
  wrap("getClock", READ_MS);
  wrap("findOrderByClientId", READ_MS);
  wrap("getOrderById", READ_MS);
  wrap("cancelOrder", 0);
  wrap("cancelAllOrders", 0);
  wrap("submitSell", 0, (s: { symbol: string; qty: number; stopPrice?: number }) => `${s.symbol} ${s.qty}${s.stopPrice !== undefined ? " stop" : ""}`);
  const start = () => {
    t0 = sim.simMs;
    recording = true;
  };
  const w = { sim, events, store, now, risk, memory, liquidator, calls, start };
  ref.w = w;
  return w;
}
type World = ReturnType<typeof world>;

async function hold(w: World, symbol: string, qty: number, price: number, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}
async function day(w: World) {
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  await setPhase(w.store, D, EXIT_PAIR_PHASE, "on");
  return (await w.store.getDay(D))!;
}

// AMBA-57's shape (9:33 on 2026-11-25): a remainder protected by an exit pair; the pair's take-profit fills part, Alpaca cancels its stop leg;
// the next look cancels the pair's rest and sells the share left at market. `cancelMs`: how long Alpaca takes to land the rest's cancel.
async function brokenPair(o: Opts & { cancelMs?: number } = {}) {
  const w = world(o);
  const dd = await day(w);
  const id = await hold(w, "AMBA", 7, 35.6, 57);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 4, 35.68); // 3 left; Alpaca cancels the bracket's stop
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true }); // the remainder gets its exit pair
  w.sim.advance(2_000);
  w.sim.fillPairTakeProfit("AMBA", 2); // 1 left; the pair's stop leg cancelled
  w.sim.advance(300);
  w.sim.cancelMs = o.cancelMs ?? 700;
  w.start();
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(3_000);
  return { w, id };
}
// A position found with no exits at all (both cancelled as the entry filled): nothing to cancel, so no pause and no wait.
async function noExits() {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "KSS", 4, 26.5, 3);
  w.sim.cancelExitsAtFill(id);
  w.sim.advance(300);
  w.start();
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(3_000);
  return { w, id };
}
// A cheap stuck retry (Michael's decision 1 of 2026-11-17): the first try's sale is refused by Alpaca, so the entry is stuck; its ordinary
// retry, with the live updates connected and nothing to cancel, makes one read through the sell gate and the sell.
async function cheapRetry() {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "KSS", 4, 26.5, 3);
  w.sim.cancelExitsAtFill(id);
  w.sim.advance(300);
  w.sim.refuseSellsTimes = 3; // every round of the first try
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.ok(w.memory.stuck.has(id), "stuck after the refused sale");
  w.sim.advance(3_000);
  w.memory.stuck.get(id)!.nextAt = w.sim.simMs - 1;
  w.start();
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  w.sim.advance(3_000);
  return { w, id };
}
// A read that fails inside the sale: the first look after the pause cannot read the open orders; the round ends and round 2 tries again.
async function failedRead() {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "AMBA", 7, 35.6, 57);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 4, 35.68);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(2_000);
  w.sim.fillPairTakeProfit("AMBA", 2);
  w.sim.advance(300);
  w.sim.cancelMs = 700;
  const lo = w.sim.listOrdersPaged.bind(w.sim);
  let openReads = 0;
  (w.sim as any).listOrdersPaged = async (...a: any[]) => {
    const r = await (lo as any)(...a);
    if (a[0] === "open" && ++openReads === 2) throw new Error("read failed (test)");
    return r;
  };
  w.start();
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(3_000);
  return { w, id };
}
const checks = (w: World) => w.events.filter((e) => e.event === "missing_exit_sale_checks").map((e) => e.data);

// ----------------------------------------------- the pin: what the sale sends and when ---------------------------------------------
// The expected sequences were produced by the code before this change (abf7c0f) in these same scenarios, and are compared as fixed numbers.

const PIN: Record<string, string[]> = {
  "broken pair, the full half second (no live confirmation), the cancel lands after 700 ms":
    ["listOrdersPaged(all)@0", "listPositions@70", "findOrderByClientId@140", "getClock@210", "listPositions@280", "listOrdersPaged(open)@350", "cancelOrder@420", "listOrdersPaged(open)@920", "listPositions@990", "listOrdersPaged(open)@1310", "listPositions@1380", "listPositions@1450", "listOrdersPaged(open)@1520", "listPositions@1590", "submitSell(AMBA 1)@1660", "getClock@2660", "listPositions@2730", "listOrdersPaged(open)@2800", "listOrdersPaged(open)@2870", "listPositions@2940", "listPositions@3010", "getClock@4080", "listPositions@4150"],
  "broken pair, the live confirmation 40 ms into the pause":
    ["listOrdersPaged(all)@0", "listPositions@70", "findOrderByClientId@140", "getClock@210", "listPositions@280", "listOrdersPaged(open)@350", "cancelOrder@420", "waitCancelled@420", "listOrdersPaged(open)@460", "listPositions@530", "listOrdersPaged(open)@850", "listPositions@920", "listOrdersPaged(open)@1390", "listPositions@1460", "listPositions@1530", "listOrdersPaged(open)@1600", "listPositions@1670", "submitSell(AMBA 1)@1740", "getClock@2740", "listPositions@2810", "listOrdersPaged(open)@2880", "listOrdersPaged(open)@2950", "listPositions@3020", "listPositions@3090", "getClock@4160", "listPositions@4230"],
  "broken pair, live updates not connected (the full half second)":
    ["listOrdersPaged(all)@0", "listPositions@70", "findOrderByClientId@140", "getClock@210", "listPositions@280", "listOrdersPaged(open)@350", "cancelOrder@420", "waitCancelled@420", "listOrdersPaged(open)@920", "listPositions@990", "listOrdersPaged(open)@1310", "listPositions@1380", "listPositions@1450", "listOrdersPaged(open)@1520", "listPositions@1590", "submitSell(AMBA 1)@1660", "getClock@2660", "listPositions@2730", "listOrdersPaged(open)@2800", "listOrdersPaged(open)@2870", "listPositions@2940", "listPositions@3010", "getClock@4080", "listPositions@4150"],
  "broken pair, polls woken early by a live update":
    ["listOrdersPaged(all)@0", "listPositions@70", "findOrderByClientId@140", "getClock@210", "listPositions@280", "listOrdersPaged(open)@350", "cancelOrder@420", "listOrdersPaged(open)@920", "listPositions@990", "waitEvent(250)@1060", "listOrdersPaged(open)@1160", "listPositions@1230", "listPositions@1300", "listOrdersPaged(open)@1370", "listPositions@1440", "submitSell(AMBA 1)@1510", "waitEvent(1000)@1510", "getClock@1610", "listPositions@1680", "listOrdersPaged(open)@1750", "listOrdersPaged(open)@1820", "listPositions@1890", "listPositions@1960", "waitEvent(1000)@2030", "getClock@2130", "listPositions@2200", "listOrdersPaged(open)@2270", "listOrdersPaged(open)@2340", "listPositions@2410", "listPositions@2480", "waitEvent(1000)@2550", "listPositions@2650"],
  "broken pair, Alpaca's cancel takes 12 s: a blocked round, then round 2":
    ["listOrdersPaged(all)@0", "listPositions@70", "findOrderByClientId@140", "getClock@210", "listPositions@280", "listOrdersPaged(open)@350", "cancelOrder@420", "listOrdersPaged(open)@920", "listPositions@990", "listOrdersPaged(open)@1310", "listPositions@1380", "listOrdersPaged(open)@1850", "listPositions@1920", "listOrdersPaged(open)@2590", "listPositions@2660", "listOrdersPaged(open)@3530", "listPositions@3600", "listOrdersPaged(open)@4470", "listPositions@4540", "listOrdersPaged(open)@5410", "listPositions@5480", "listOrdersPaged(open)@6350", "listPositions@6420", "listOrdersPaged(open)@7290", "listPositions@7360", "listOrdersPaged(open)@8230", "listPositions@8300", "listPositions@8370", "getClock@9440", "listPositions@9510", "listOrdersPaged(open)@9580", "cancelOrder@9650", "listOrdersPaged(open)@10150", "listPositions@10220", "listOrdersPaged(open)@10540", "listPositions@10610", "listOrdersPaged(open)@11080", "listPositions@11150", "listOrdersPaged(open)@11820", "listPositions@11890", "listOrdersPaged(open)@12760", "listPositions@12830", "listPositions@12900", "listOrdersPaged(open)@12970", "listPositions@13040", "submitSell(AMBA 1)@13110", "getClock@14110", "listPositions@14180", "listOrdersPaged(open)@14250", "listOrdersPaged(open)@14320", "listPositions@14390", "listPositions@14460", "listPositions@15530"],
  "no exits at all: nothing cancelled, no pause, no wait":
    ["listOrdersPaged(all)@0", "listPositions@70", "listOrdersPaged(open)@140", "findOrderByClientId@210", "getClock@280", "listPositions@350", "listOrdersPaged(open)@420", "listOrdersPaged(open)@490", "listPositions@560", "listPositions@630", "listOrdersPaged(open)@700", "listPositions@770", "submitSell(KSS 4)@840", "getClock@1840", "listPositions@1910", "listOrdersPaged(open)@1980", "listOrdersPaged(open)@2050", "listPositions@2120", "listPositions@2190", "getClock@3260", "listPositions@3330", "listPositions@3400"],
  "a cheap stuck retry (one read through the sell gate, then the sell)":
    ["listOrdersPaged(all)@0", "listPositions@70", "getClock@140", "listOrdersPaged(open)@210", "listPositions@280", "submitSell(KSS 4)@350"],
  "a read that fails inside the sale (the first look after the pause), then round 2":
    ["listOrdersPaged(all)@0", "listPositions@70", "findOrderByClientId@140", "getClock@210", "listPositions@280", "listOrdersPaged(open)@350", "cancelOrder@420", "listOrdersPaged(open)@920", "getClock@1990", "listPositions@2060", "listOrdersPaged(open)@2130", "listOrdersPaged(open)@2200", "listPositions@2270", "listPositions@2340", "listOrdersPaged(open)@2410", "listPositions@2480", "submitSell(AMBA 1)@2550", "getClock@3550", "listPositions@3620", "listOrdersPaged(open)@3690", "listOrdersPaged(open)@3760", "listPositions@3830", "listPositions@3900", "listPositions@4970"],
};

const scenarios: Record<string, () => Promise<{ w: World }>> = {
  "broken pair, the full half second (no live confirmation), the cancel lands after 700 ms": () => brokenPair(),
  "broken pair, the live confirmation 40 ms into the pause": () => brokenPair({ waitCancelled: (w) => async () => (w.sim.advance(40), "confirmed") }),
  "broken pair, live updates not connected (the full half second)": () => brokenPair({ waitCancelled: (w) => async (_i, m) => (w.sim.advance(m), "not_live") }),
  "broken pair, polls woken early by a live update": () => brokenPair({ waitEvent: (w) => async (_s, m) => (w.sim.advance(Math.min(m, 100)), m > 100) }),
  "broken pair, Alpaca's cancel takes 12 s: a blocked round, then round 2": () => brokenPair({ cancelMs: 12_000 }),
  "no exits at all: nothing cancelled, no pause, no wait": () => noExits(),
  "a cheap stuck retry (one read through the sell gate, then the sell)": () => cheapRetry(),
  "a read that fails inside the sale (the first look after the pause), then round 2": () => failedRead(),
};

for (const [name, run] of Object.entries(scenarios)) {
  test(`decision 2 of 2026-11-25, the pin (requests and their times as before the change): ${name}`, async () => {
    const { w } = await run();
    if (process.env.PRINT_PIN) console.log(JSON.stringify({ name, calls: w.calls }));
    assert.ok(PIN[name], "a pinned sequence for every scenario");
    assert.deepEqual(w.calls, PIN[name]);
  });
}


// ----------------------------------------------- the row: what each check showed ---------------------------------------------------
const at = (x: string) => Date.parse(x);

test("decision 2: AMBA-57's shape stores one row: the half-second pause (timer), the look that still saw the share held by the pair's rest, the poll, the look that saw it free, the step's read, and the market sale asked and answered", async () => {
  const { w, id } = await brokenPair();
  const rows = checks(w);
  assert.equal(rows.length, 1, "one row for the missing-exit sale (none for the remainder's own sale that placed the pair)");
  const r = rows[0];
  assert.equal(r.symbol, "AMBA");
  assert.equal(r.clientOrderId, id);
  assert.equal(r.alsoCancel.length, 1, "the pair's rest it cancelled");
  assert.equal(r.reads.length, 18);
  assert.ok(r.reads.length <= 40);
  assert.deepEqual(r.pauses.map((p: any) => [p.round, p.ms, p.endedBy]), [[1, 500, "timer"]]);
  assert.equal(at(r.pauses[0].at), at(r.cancelsAnsweredAt[0]), "the pause starts at the cancel's answer");
  const [first, second, step] = r.looks;
  assert.deepEqual([first.by, first.round, first.held, first.qtyAvailable, first.openSellQty, first.free, first.left, first.holding], ["wait", 1, 1, 0, 1, 0, 1, true]);
  assert.deepEqual(first.openSells.map((x: any) => [x.type, x.status, x.qty, x.filledQty]), [["limit", "pending_cancel", 3, 2]], "what held the share: the pair's rest, its cancel not landed");
  assert.deepEqual([first.openMs, first.positionsMs], [70, 70]);
  assert.equal(at(first.at) - at(r.pauses[0].at), 500, "the first look right after the pause");
  assert.deepEqual(r.polls.map((p: any) => [p.round, p.askedMs, p.countedMs, p.ms]), [[1, 250, 250, 250]]);
  assert.deepEqual([second.by, second.held, second.qtyAvailable, second.free, second.holding], ["wait", 1, 1, 1, false]);
  assert.deepEqual([step.by, step.held, step.openMs, step.positionsMs, step.holding], ["step", 1, null, 70, null]);
  assert.deepEqual(r.sales.map((x: any) => [x.round, x.qty, x.status]), [[1, 1, "sent"]]);
  assert.equal(at(r.sales[0].answeredAt) - at(r.sales[0].askedAt), 140, "the gate's two reads before the sale");
  assert.equal(r.rounds, 3);
  assert.equal(r.sold, 1);
  assert.ok(at(r.startedAt) <= at(r.reads[0].at) && at(r.endedAt) >= at(r.sales[0].answeredAt));
  assert.ok(w.events.findIndex((e) => e.event === "missing_exit_sale_checks") > w.events.findIndex((e) => e.event === "exit_pair_sale_start"), "stored at the sale's end");
});

test("decision 2: the pause ended by Alpaca's live confirmation is stored with its time and how it ended", async () => {
  const { w } = await brokenPair({ waitCancelled: (w) => async () => (w.sim.advance(40), "confirmed") });
  assert.deepEqual(checks(w)[0].pauses.map((p: any) => [p.ms, p.endedBy]), [[40, "confirmed"]]);
  const n = await brokenPair({ waitCancelled: (w) => async (_i, m) => (w.sim.advance(m), "not_live") });
  assert.deepEqual(checks(n.w)[0].pauses.map((p: any) => [p.ms, p.endedBy]), [[500, "not_live"]]);
});

test("decision 2: a poll woken early by a live update stores the wait asked, the time counted and the time it really took", async () => {
  const { w } = await brokenPair({ waitEvent: (w) => async (_s, m) => (w.sim.advance(Math.min(m, 100)), m > 100) });
  assert.deepEqual(checks(w)[0].polls.map((p: any) => [p.askedMs, p.countedMs, p.ms]), [[250, 100, 100]]);
});

test("decision 2: Alpaca's cancel taking 12 s: every look of round 1 still saw the share held, the last one at the waiting limit; round 2's pause and looks follow", async () => {
  const { w } = await brokenPair({ cancelMs: 12_000 });
  const r = checks(w)[0];
  const r1 = r.looks.filter((l: any) => l.round === 1 && l.by === "wait");
  assert.equal(r1.length, 10);
  assert.ok(r1.every((l: any) => l.held === 1 && l.free === 0));
  assert.deepEqual(r1.map((l: any) => l.holding), [true, true, true, true, true, true, true, true, true, false], "the last look ends the wait at its limit, with the share still held");
  assert.deepEqual(r.polls.filter((p: any) => p.round === 1).map((p: any) => p.askedMs), [250, 400, 600, 800, 800, 800, 800, 800, 800]);
  assert.deepEqual(r.pauses.map((p: any) => [p.round, p.endedBy]), [[1, "timer"], [2, "timer"]]);
  assert.deepEqual(r.sales.map((x: any) => [x.round, x.qty]), [[2, 1]]);
  assert.ok(w.events.some((e) => e.event === "sale_blocked" && e.data.round === 1));
});

test("decision 2: a position with no exits at all: no pause (nothing cancelled), one look that ends the wait, the sale", async () => {
  const { w } = await noExits();
  const r = checks(w)[0];
  assert.deepEqual(r.pauses, []);
  assert.deepEqual(r.polls, []);
  assert.deepEqual(r.looks.filter((l: any) => l.round === 1).map((l: any) => [l.by, l.held, l.free, l.holding]), [["wait", 4, 4, false], ["step", 4, null, null]]);
  assert.deepEqual(r.sales.map((x: any) => [x.qty, x.status]), [[4, "sent"]]);
  assert.equal(r.cancelsSentAt.length, 0);
});

test("decision 2: capped (40 looks and 40 polls kept, the rest counted); a sale of the whole account carries no checks", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "PINS", 5, 18.7, 1);
  void dd;
  w.sim.cancelMs = 120_000; // the cancel never lands within the wait
  const legs = w.sim.orders.find((o) => o.clientOrderId === id)!.legs.map((l) => l.id);
  const r = await w.liquidator.flatten({ reason: "protective stop not confirmed", tradeDate: D, only: ["PINS"], maxRounds: 1, cancelIds: legs, ownEntryOnly: { maxQty: { PINS: 5 } }, waitCancelMs: 60_000 });
  assert.equal(r.checks!.looks.length, 40);
  assert.ok(r.checks!.looksMore > 0);
  assert.equal(r.checks!.polls.length, 40);
  assert.ok(r.checks!.pollsMore > 0);
  const v = world();
  await hold(v, "PINS", 5, 18.7, 1);
  const whole = await v.liquidator.flatten({ reason: "close-out", tradeDate: D });
  assert.equal(whole.checks, undefined);
});

test("decision 2: a run log that throws on the row changes nothing: the same requests at the same times, the share sold", async () => {
  const name = "broken pair, the full half second (no live confirmation), the cancel lands after 700 ms";
  const w = world();
  const orig = w.risk.log;
  w.risk.log = (e: string, d?: Record<string, unknown>) => {
    if (e === "missing_exit_sale_checks") throw new Error("log boom");
    orig(e, d);
  };
  const dd = await day(w);
  const id = await hold(w, "AMBA", 7, 35.6, 57);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 4, 35.68);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(2_000);
  w.sim.fillPairTakeProfit("AMBA", 2);
  w.sim.advance(300);
  w.sim.cancelMs = 700;
  w.start();
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(3_000);
  assert.deepEqual(w.calls, PIN[name]);
  assert.equal(w.sim.heldQty("AMBA"), 0);
});

test("decision 2: the row is stored in the run log (not only Fly's log)", () => {
  assert.ok(STORED_INFO_EVENTS.has("missing_exit_sale_checks"));
});

test("decision 2: a look whose read failed is stored as not ok, with the read that answered (the open orders failed here); round 2 follows", async () => {
  const { w } = await failedRead();
  const r = checks(w)[0];
  const bad = r.looks.find((l: any) => !l.ok);
  assert.ok(bad, "the failed look is stored");
  assert.deepEqual([bad.round, bad.by, bad.held, bad.openSellQty, bad.positionsMs, bad.holding], [1, "wait", null, null, null, null]);
  assert.equal(bad.openMs, null, "the open orders read is the one that failed");
  assert.ok(r.errors.some((e: string) => e.includes("could not read open orders")));
  assert.deepEqual(r.sales.map((x: any) => [x.round, x.qty, x.status]), [[2, 1, "sent"]]);
});

test("decision 2: a cheap stuck retry stores its one look and its sale (its reads go through the sell gate and are not timed)", async () => {
  const { w } = await cheapRetry();
  const rows = checks(w);
  const r = rows[rows.length - 1];
  assert.deepEqual(r.looks.filter((l: any) => l.by === "wait").map((l: any) => [l.held, l.free, l.holding]), [[4, 4, false]]);
  assert.deepEqual(r.sales.map((x: any) => [x.qty, x.status]), [[4, "sent"]]);
  assert.equal(r.rounds, 1);
});

test("decision 2: the row's size (logging only; for the reader of the run log): one ordinary sale, and a sale at the caps", async () => {
  const { w } = await brokenPair();
  const typical = JSON.stringify(checks(w)[0]).length;
  const v = world();
  await day(v);
  const id = await hold(v, "PINS", 5, 18.7, 1);
  v.sim.cancelMs = 120_000;
  const legs = v.sim.orders.find((o) => o.clientOrderId === id)!.legs.map((l) => l.id);
  const r = await v.liquidator.flatten({ reason: "protective stop not confirmed", tradeDate: D, only: ["PINS"], maxRounds: 1, cancelIds: legs, ownEntryOnly: { maxQty: { PINS: 5 } }, waitCancelMs: 60_000 });
  const capped = JSON.stringify({ reads: r.reads, ...r.checks }).length;
  if (process.env.PRINT_SIZES) console.log(JSON.stringify({ typical, capped }));
  assert.ok(typical < 8_000, `${typical}`);
  assert.ok(capped < 32_000, `${capped}`);
});
