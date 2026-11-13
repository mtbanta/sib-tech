// The release of 2026-11-10 (Michael's approval that evening, after the Tuesday end-of-day review in builds/build-c2-log.md):
//   A. a cleanup sale recounts the entry's own shares when its take-profit fills more while its cancel lands, and treats "every share
//      gone" as sold, not stuck (on 2026-11-10: 8 sales waited 6 seconds on a stale count and each sent a false alert to Michael);
//   B. the close-out's wait for its own sales reads open orders on timed looks only, and reads positions once more before ending
//      (on 2026-11-10 the mid-day close-out's wait ended after 544 ms with a false NOT FLAT alert);
//   C. a sale reported as "not filled yet" gets a closing line; a sale noticed late is logged with what the order sync was doing;
//   load days: the load window runs to the mid-day pause, and from the pause on the day is a normal day (approved largest position,
//   at most 100 orders a minute).
// Each test was run against the code before this release and failed there (recorded in builds/build-c2-log.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { LATE_NOTICE_MS, SyncMemory, syncOrders } from "../src/risk.ts";
import { closeOut } from "../src/closeout.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor, OrderGate } from "../src/gate.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Governor } from "../src/governor.ts";
import { LOAD_WINDOW_END_MIN, inLoadWindow, loadCeilingOn, loadRulesApply, loadWindow } from "../src/load-mode.ts";
import { updatePause } from "../src/midday.ts";
import { shouldStoreEvent } from "../src/run-log.ts";
import type { Signal } from "../src/strategy.ts";
import { SimBroker } from "./sim-broker.ts";
import { FakeBroker } from "./helpers.ts";
import { D, z } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day, in the session

function world() {
  const sim = new SimBroker(MID);
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: opts?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const batch: Array<{ symbol: string; shares: number }> = [];
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: (symbol: string, shares: number) => void batch.push({ symbol, shares }) };
  return { sim, events, said, gate, liquidator, store, now, risk, memory, batch };
}
type World = ReturnType<typeof world>;

async function hold(w: World, symbol: string, qty: number, price: number, n: number, stored = true) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  if (stored) await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}
const tpOf = (w: World, id: string) => w.sim.orders.find((o) => o.clientOrderId === id)!.legs.find((l) => l.type === "limit")!;
const mentions = (w: World) => w.said.filter((m) => m.ch === "alerts" && m.mention);

// The take-profit fills `more` shares the moment its cancel is asked for (it lands about 200 ms later in the simulator).
function fillAtCancel(w: World, entryId: string, more: number, price: number) {
  const orig = w.sim.cancelOrder.bind(w.sim);
  let done = false;
  w.sim.cancelOrder = async (id: string) => {
    await orig(id);
    if (!done && id === tpOf(w, entryId).id) {
      done = true;
      w.sim.partialTakeProfit(entryId, more, price);
    }
  };
}

async function remainderDay(w: World) {
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  return (await w.store.getDay(D))!;
}

// ------------------------------------------------------------- A -------------------------------------------------------------------

test("fix A, Tuesday's QXO case: 9 shares left without a stop, the take-profit fills 8 of them while its cancel lands; the 1 share left is sold at once, no alert to Michael, and the sale's line comes in the batch (A4 fallback: Alpaca refuses the fresh stop, so the remainder is sold at market as before)", async () => {
  const w = world();
  w.sim.refuseStops = true;
  const day = await remainderDay(w);
  const id = await hold(w, "QXO", 10, 13.5, 11);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 13.58); // Alpaca cancels the stop: 9 shares on the take-profit alone
  w.sim.advance(3_500); // past the 3 second grace
  fillAtCancel(w, id, 8, 13.58);
  const t0 = w.sim.simMs;
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["QXO", 1]], "only the share still held");
  assert.ok(w.sim.sellLog[0]!.at - t0 < 2_500, `sold ${w.sim.sellLog[0]!.at - t0} ms after the sync began (Tuesday: about 7 seconds)`);
  assert.equal(w.sim.oversellAttempts, 0);
  assert.equal(mentions(w).length, 0, "no 'could not sell it yet' alert");
  w.sim.advance(5_000);
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.sim.heldQty("QXO"), 0);
  assert.deepEqual(w.batch, [{ symbol: "QXO", shares: 1 }], "one line in the once-a-minute batch");
  assert.equal(mentions(w).length, 0);
  assert.ok(w.events.some((e) => e.event === "remainder_recount" && e.data.counted === 9 && e.data.recounted === 1 && e.data.sold === 1), "the recount is logged");
  assert.ok(!w.events.some((e) => e.event === "sale_blocked"), "no false blocked sale");
});

test("fix A: the take-profit fills every share left while its cancel lands; nothing is sold, nothing is said, and the wait does not run its 6 seconds", async () => {
  const w = world();
  const day = await remainderDay(w);
  const id = await hold(w, "TTD", 32, 15.46, 97);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 20, 15.54); // 12 left
  w.sim.advance(3_500);
  fillAtCancel(w, id, 12, 15.54);
  const t0 = w.sim.simMs;
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.sim.heldQty("TTD"), 0);
  assert.ok(w.sim.simMs - t0 < 4_000, `the sync took ${w.sim.simMs - t0} ms`);
  assert.equal(w.said.filter((m) => m.ch === "alerts").length, 0, "no alert of any kind");
  assert.ok(!w.events.some((e) => e.event === "sale_blocked"));
});

test("fix A, the narrow case: the take-profit fills more just before the sale's first look at the holding; the share left is sold and it is not reported stuck (A4 fallback: Alpaca refuses the fresh stop, so the remainder is sold at market as before)", async () => {
  const w = world();
  w.sim.refuseStops = true;
  const day = await remainderDay(w);
  const id = await hold(w, "RRC", 9, 51.27, 4);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 3, 51.35); // 6 left
  w.sim.advance(3_500);
  // the cleanup sale's own look at the entry counts 6; the take-profit fills 5 of them right after that look
  const origFind = w.sim.findOrderByClientId.bind(w.sim);
  let looks = 0;
  w.sim.findOrderByClientId = async (cid: string) => {
    const found = await origFind(cid);
    if (cid === id && ++looks === 1) w.sim.partialTakeProfit(id, 5, 51.35);
    return found;
  };
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["RRC", 1]]);
  assert.equal(mentions(w).length, 0, "not reported stuck");
  assert.ok(!w.said.some((m) => /has not filled it yet/.test(m.text)), "the sale had filled: no 'not filled yet' line (group 1 review, note 1)");
  w.sim.advance(5_000);
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.sim.heldQty("RRC"), 0);
  assert.equal(mentions(w).length, 0);
  assert.equal(w.batch.length + w.said.filter((m) => /RRC: the sale .* has filled/.test(m.text)).length, 1, `one closing line: ${JSON.stringify(w.said)} ${JSON.stringify(w.batch)}`);
});

test("fix A keeps release 1's rule: a newer position on the same symbol keeps its shares and its exits", async () => {
  const w = world();
  const day = await remainderDay(w);
  const older = await hold(w, "APLD", 5, 16.46, 107);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(older, 2, 16.54); // 3 left on the older entry
  w.sim.advance(1_000);
  const newer = await hold(w, "APLD", 4, 16.46, 108, false); // bought after the sync read the records (release 1's case)
  w.sim.advance(3_000);
  fillAtCancel(w, older, 2, 16.54); // 1 of the older entry's shares left
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["APLD", 1]]);
  w.sim.advance(5_000);
  assert.equal(w.sim.heldQty("APLD"), 4, "the newer entry's 4 shares");
  assert.ok(w.sim.orders.find((o) => o.clientOrderId === newer)!.legs.every((l) => l.status === "new"), "its exits are live");
  assert.equal(mentions(w).length, 0);
});

test("fix A, with another position on the symbol: the newer position's take-profit fills during the older entry's cancel; the recount is not used there, and the older entry's shares are still sold in the same cleanup (never left without exits)", async () => {
  const w = world();
  const day = await remainderDay(w);
  const older = await hold(w, "APLD", 5, 16.46, 107);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(older, 2, 16.54); // 3 left on the older entry
  w.sim.advance(1_000);
  const newer = await hold(w, "APLD", 4, 16.46, 108, false);
  w.sim.advance(3_000);
  const orig = w.sim.cancelOrder.bind(w.sim);
  let done = false;
  w.sim.cancelOrder = async (id: string) => {
    await orig(id);
    if (!done && id === tpOf(w, older).id) {
      done = true;
      w.sim.fillExit(newer, "take_profit", 16.54); // the holding drops by 4, none of them the older entry's
    }
  };
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["APLD", 3]], "the older entry's 3 shares");
  w.sim.advance(5_000);
  assert.equal(w.sim.heldQty("APLD"), 0);
  assert.equal(mentions(w).length, 0);
  assert.ok(!w.events.some((e) => e.event === "remainder_recount" && e.data.recounted === 0), "not taken for 'its own exits sold the shares'");
});

// ------------------------------------------------------------- B -------------------------------------------------------------------

async function closeoutWorld(symbols: string[]) {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 16, 30));
  sim.sellFillDelayMs = 30_000; // past the wait's first timed orders look (look 5, about 10 seconds in)
  for (const [i, s] of symbols.entries()) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 3 + i, stopPrice: 9.8, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
  }
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: opts?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liq = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  return { sim, said, liq };
}
// Once the close-out's wait has started (its first wait for an update), the first open-orders read of `trigger` sees `act` happen just
// before it: between the wait's positions read and its orders read.
function raceOnOrdersRead(sim: SimBroker, act: () => void) {
  const state = { waiting: false, fired: false };
  const orig = sim.listOrdersPaged.bind(sim);
  sim.listOrdersPaged = (async (status: string, after: string, pages: number) => {
    if (state.waiting && !state.fired && status === "open") {
      state.fired = true;
      act();
    }
    return orig(status as any, after, pages);
  }) as typeof sim.listOrdersPaged;
  const waitEvent = async (_s: ReadonlySet<string>, _ms: number) => {
    state.waiting = true;
    sim.advance(40);
    return true; // every wait ended at once by a live update, as on Tuesday when 18 sales filled in a burst
  };
  return { state, waitEvent };
}
const fillOneSellNow = (sim: SimBroker) => {
  const inner = sim as unknown as { sellFills: Array<{ id: string; at: number }>; fillSell: (id: string) => void };
  const f = inner.sellFills.shift()!;
  inner.fillSell(f.id);
};

test("fix B, Tuesday's 10:30:11 case: a sale fills between the wait's positions read and its orders read; the mid-day close-out keeps waiting, ends flat, and sends no NOT FLAT alert", async () => {
  const w = await closeoutWorld(["AKAM", "DBX", "IONS", "JHX"]);
  const race = raceOnOrdersRead(w.sim, () => fillOneSellNow(w.sim));
  const r = await closeOut({ broker: w.sim, liquidator: w.liq, store: new MemoryStore(), now: () => new Date(w.sim.simMs), say: w.said.push.bind(w.said) as any, sleep: w.sim.sleep, waitEvent: race.waitEvent }, D, { closeAt: new Date(Date.UTC(2026, 10, 2, 21, 0)), path: "midday" });
  assert.ok(race.state.fired, "the race happened");
  assert.equal(r.flat, true);
  assert.ok(!w.said.some((m: any) => /NOT FLAT/.test(typeof m === "string" ? m : m.text ?? "")), "no NOT FLAT alert");
  assert.equal((await w.sim.listPositions()).length, 0);
});

test("fix B: the same race in the 2:55 close-out sends no 'close by hand' alert", async () => {
  const w = await closeoutWorld(["AKAM", "DBX", "IONS"]);
  const race = raceOnOrdersRead(w.sim, () => fillOneSellNow(w.sim));
  const r = await closeOut({ broker: w.sim, liquidator: w.liq, store: new MemoryStore(), now: () => new Date(w.sim.simMs), say: async (ch: string, text: string, o?: { mentionOwner?: boolean }) => (w.said.push({ ch, text, mention: o?.mentionOwner }), true), sleep: w.sim.sleep, waitEvent: race.waitEvent }, D, { closeAt: new Date(Date.UTC(2026, 10, 2, 21, 0)), path: "close-out" });
  assert.ok(race.state.fired, "the race happened");
  assert.equal(r.flat, true);
  assert.ok(!w.said.some((m) => /NOT FLAT/.test(m.text)), w.said.map((m) => m.text).join(" | "));
  assert.ok(w.said.some((m) => m.text === "Close-out done: the account is flat."));
});

test("fix B keeps the early report: a sale of ours that Alpaca cancelled ends the wait at the next timed orders look, with the alert", async () => {
  const w = await closeoutWorld(["AKAM", "DBX"]);
  w.sim.sellFillDelayMs = 200_000; // the sales stay working
  const race = raceOnOrdersRead(w.sim, () => {
    const sale = w.sim.orders.find((o) => o.side === "sell" && o.symbol === "DBX" && o.status === "accepted")!;
    sale.status = "canceled"; // gone, shares still held
    const inner = w.sim as unknown as { sellFills: Array<{ id: string; at: number }> };
    inner.sellFills = inner.sellFills.filter((f) => f.id !== sale.id);
  });
  const t0 = w.sim.simMs;
  const r = await closeOut({ broker: w.sim, liquidator: w.liq, store: new MemoryStore(), now: () => new Date(w.sim.simMs), say: async (ch: string, text: string, o?: { mentionOwner?: boolean }) => (w.said.push({ ch, text, mention: o?.mentionOwner }), true), sleep: w.sim.sleep, waitEvent: race.waitEvent }, D, { closeAt: new Date(Date.UTC(2026, 10, 2, 21, 0)), path: "close-out" });
  assert.ok(race.state.fired, "the race happened");
  assert.equal(r.flat, false, JSON.stringify({ r, said: w.said, sells: w.sim.orders.filter((o) => o.side === "sell").map((o) => [o.symbol, o.status]), t: w.sim.simMs - t0 }));
  assert.ok(w.sim.simMs - t0 < 15_000, `reported after ${w.sim.simMs - t0} ms, not at the deadline`);
  assert.ok(w.said.some((m) => m.mention && /NOT FLAT after the close-out: .*DBX/.test(m.text)));
});

// ------------------------------------------------------------- C -------------------------------------------------------------------

test("fix C: a remainder sale Alpaca has not filled when the cleanup ends is reported once, and gets its closing line when it fills (A4 fallback: Alpaca refuses the fresh stop, so the remainder is sold at market as before)", async () => {
  const w = world();
  w.sim.refuseStops = true;
  const day = await remainderDay(w);
  w.sim.sellFillDelayMs = 9_000; // longer than the cleanup's rounds
  const id = await hold(w, "ONON", 14, 34.8, 60);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 11, 34.88); // 3 left
  w.sim.advance(3_500);
  await syncOrders(w.risk, day, { protect: true });
  const first = w.said.filter((m) => m.ch === "alerts");
  assert.equal(first.length, 1);
  assert.match(first[0]!.text, /ONON: Alpaca cancelled its stop when the take-profit partly filled.*sent a sell for the remaining 3 shares; Alpaca has not filled it yet\. I will say when it has\./);
  assert.equal(first[0]!.mention, undefined, "no mention");
  w.sim.advance(10_000);
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.batch, [{ symbol: "ONON", shares: 3 }], "the closing line, in the once-a-minute batch");
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.batch.length, 1, "once");
});

test("group 1 review, note 4: the missing-exit closing line is not waited for, so a slow Discord does not hold up the sync", async () => {
  const w = world();
  const day = await remainderDay(w);
  w.sim.sellFillDelayMs = 9_000;
  const id = await hold(w, "HIMS", 26, 18.8, 21);
  w.sim.advance(5_000);
  w.sim.cancelExitsAtFill(id);
  w.sim.advance(500);
  await syncOrders(w.risk, day, { protect: true });
  w.sim.advance(10_000);
  let release!: () => void;
  const slow = new Promise<void>((r) => (release = r));
  const fast = w.risk.say;
  w.risk.say = async (ch: string, text: string, o?: any) => (/has filled/.test(text) ? (await slow, fast(ch, text, o)) : fast(ch, text, o));
  const done = await Promise.race([syncOrders(w.risk, day, { protect: true }).then(() => "sync done"), new Promise((r) => setTimeout(() => r("sync held up"), 200))]);
  assert.equal(done, "sync done");
  release();
});

test("fix C: a missing-exit sale not filled yet gets its own closing line when it fills", async () => {
  const w = world();
  const day = await remainderDay(w);
  w.sim.sellFillDelayMs = 9_000;
  const id = await hold(w, "HIMS", 26, 18.8, 20);
  w.sim.advance(5_000);
  w.sim.cancelExitsAtFill(id);
  w.sim.advance(500);
  await syncOrders(w.risk, day, { protect: true });
  assert.ok(w.said.some((m) => /HIMS: I could not confirm a live protective stop.*has not filled it yet/.test(m.text)));
  w.sim.advance(10_000);
  await syncOrders(w.risk, day, { protect: true });
  assert.ok(w.said.some((m) => m.text === "**HIMS: the sale of its 26 shares has filled.**"), w.said.map((m) => m.text).join(" | "));
});

test("logging: a remainder noticed more than 6 seconds after Alpaca cancelled its stop is logged as late_notice with what the sync was doing, and the run log keeps it", async () => {
  const w = world();
  const day = await remainderDay(w);
  w.risk.lateNoticeContext = (symbol: string) => ({ fromWorker: symbol });
  const id = await hold(w, "HIMS", 26, 18.8, 38);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 10, 18.88);
  w.sim.advance(14_700); // Tuesday's HIMS-38: noticed 14.7 seconds after the cancel
  await syncOrders(w.risk, day, { protect: true });
  const late = w.events.find((e) => e.event === "late_notice");
  assert.ok(late, "logged");
  assert.equal(late!.data.symbol, "HIMS");
  assert.equal(late!.data.kind, "bare");
  assert.ok(late!.data.lagMs >= 14_700 && late!.data.lagMs > LATE_NOTICE_MS);
  for (const k of ["cancelledAt", "syncStartedAgoMs", "gapSincePreviousSyncMs", "cleanupsEarlierThisSync", "cleanupMsThisSync", "foundBy", "mustLook", "listAgeMs", "streamLive", "firstSeenAgoMs"]) assert.ok(k in late!.data, k);
  assert.equal(late!.data.fromWorker, "HIMS", "the worker's own view is added");
  assert.ok(shouldStoreEvent("info", "late_notice") && shouldStoreEvent("info", "remainder_recount"));
});

test("logging: a remainder noticed on time (about 3 seconds after the cancel) is not logged as late", async () => {
  const w = world();
  const day = await remainderDay(w);
  const id = await hold(w, "HIMS", 26, 18.8, 39);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 10, 18.88);
  w.sim.advance(3_600);
  await syncOrders(w.risk, day, { protect: true });
  assert.ok(w.events.some((e) => e.event === "bare_remainder"));
  assert.ok(!w.events.some((e) => e.event === "late_notice"));
});

test("group 2 review: a stuck remainder retried for a minute and a half gives at most one late_notice", async () => {
  const w = world();
  const day = await remainderDay(w);
  w.sim.refuseSellIf = () => true; // every sale refused: the entry is stuck and retried
  const id = await hold(w, "HIMS", 26, 18.8, 40);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 10, 18.88);
  w.sim.advance(8_000); // noticed late the first time
  for (let i = 0; i < 8; i++) {
    await syncOrders(w.risk, day, { protect: true });
    w.sim.advance(10_000);
  }
  assert.ok(w.memory.stuck.size > 0 || w.events.some((e) => e.event === "unprotected_position"), "it was retried");
  assert.ok(w.events.filter((e) => e.event === "late_notice").length <= 1, `${w.events.filter((e) => e.event === "late_notice").length} late notices`);
});

test("group 2 review: a 'not filled yet' sale that Alpaca ends unfilled gets no closing line and one stored drop (A4 fallback: Alpaca refuses the fresh stop, so the remainder is sold at market as before)", async () => {
  const w = world();
  w.sim.refuseStops = true;
  const day = await remainderDay(w);
  w.sim.sellFillDelayMs = 60_000;
  const id = await hold(w, "ONON", 14, 34.8, 61);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 11, 34.88);
  w.sim.advance(3_500);
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.memory.awaitingFill.size, 1);
  const sale = w.sim.orders.find((o) => o.side === "sell" && o.symbol === "ONON" && o.status === "accepted")!;
  sale.status = "canceled";
  const inner = w.sim as unknown as { sellFills: Array<{ id: string; at: number }> };
  inner.sellFills = inner.sellFills.filter((f) => f.id !== sale.id);
  w.sim.advance(2_000);
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.batch.length, 0, "no closing line");
  assert.ok(!w.said.some((m) => /has filled/.test(m.text)));
  assert.equal(w.events.filter((e) => e.event === "awaiting_fill_dropped").length, 1);
  assert.ok(shouldStoreEvent("info", "awaiting_fill_dropped"), "stored in the run log");
});

test("group 2 review: a 'not filled yet' sale still unfilled after 2 minutes is dropped once, stored, and never gets a late line (A4 fallback: Alpaca refuses the fresh stop, so the remainder is sold at market as before)", async () => {
  const w = world();
  w.sim.refuseStops = true;
  const day = await remainderDay(w);
  w.sim.sellFillDelayMs = 200_000;
  const id = await hold(w, "ONON", 14, 34.8, 62);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 11, 34.88);
  w.sim.advance(3_500);
  await syncOrders(w.risk, day, { protect: true });
  for (let i = 0; i < 14; i++) {
    w.sim.advance(10_000);
    await syncOrders(w.risk, day, { protect: true });
  }
  assert.equal(w.events.filter((e) => e.event === "awaiting_fill_dropped").length, 1, "dropped once");
  w.sim.advance(100_000); // the sale fills at last
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.batch.length, 0, "no late closing line after the drop");
});

// ---------------------------------------------------------- load days ---------------------------------------------------------------

const loadDayRecord = (load: "on" | "ended" = "on") => ({ isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), phases: { load } as Record<string, string> });

test("load days: the window runs from 8:45 AM to the mid-day pause at 10:30 AM (not 9:00); the load rules and the 150 ceiling end at the pause", () => {
  const day = loadDayRecord();
  const w = loadWindow(day)!;
  assert.equal(w.start.toISOString(), z("14:45:00").toISOString());
  assert.equal(w.end.toISOString(), z("16:30:00").toISOString(), "10:30 AM Central");
  assert.ok(inLoadWindow(day, z("15:30:00")), "9:30 AM: still in the window");
  assert.ok(inLoadWindow(day, z("16:29:59")));
  assert.ok(!inLoadWindow(day, z("16:30:00")));
  assert.ok(loadRulesApply(day, z("16:29:59")) && !loadRulesApply(day, z("16:30:00")));
  assert.ok(loadCeilingOn(day, z("16:29:59")) && !loadCeilingOn(day, z("16:30:00")));
  const ended = loadDayRecord("ended");
  assert.ok(loadRulesApply(ended, z("15:30:00")), "after load off the 75 dollar cap stays until the pause");
  assert.ok(!loadCeilingOn(ended, z("15:30:00")), "but the ceiling is 100 once the window is off");
  assert.ok(!loadRulesApply(ended, z("17:00:00")), "and after the pause the day is normal");
  const half = { ...day, closeAt: z("18:00:00") }; // a half day: the cycle runs at 10:30 too
  assert.equal(loadWindow(half)!.end.toISOString(), z("16:30:00").toISOString());
  const short = { ...day, closeAt: z("16:00:00") }; // no mid-day cycle: the window ends as before
  assert.equal(loadWindow(short)!.end.toISOString(), new Date(z("14:30:00").getTime() + LOAD_WINDOW_END_MIN * 60_000).toISOString());
});

async function loadGate(load: "on" | "ended", at: string) {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  let now = z(at);
  const governor = new Governor(() => now.getTime());
  const view = new BrokerView(broker, () => now.getTime());
  const say = async () => true;
  const liquidator = new Liquidator({ broker, gate: new SellGate({ broker, say: say as any }), now: () => now, sleep: async () => undefined });
  await ensureDay({ broker, store, now: () => now, say: say as any, liquidator } as any, D);
  await store.updateDay(D, { status: "approved", limits: { maxPositionUsd: 500, dailyLossStopUsd: 500, maxTradesPerMinute: 150, borrowingCap: 1 }, decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z", load } });
  const gate = new OrderGate({ broker, store, view, governor, now: () => now, say: say as any, note: () => undefined });
  const signal = (symbol: string, price = 50): Signal => ({ symbol, price, tradeTime: new Date(now.getTime() - 500), stopPrice: Math.round(price * 0.985 * 100) / 100, takeProfitPrice: Math.round(price * 1.0025 * 100) / 100 });
  const sent = () => broker.calls.filter((c) => c.fn === "submitEntry").map((c) => c.args[0] as { symbol: string; qty: number });
  return { store, broker, gate, governor, signal, sent, setNow: (t: string) => (now = z(t)) };
}

test("load days: before the mid-day pause an entry is at most 75 dollars and the ceiling is 150 a minute; after the pause and `go`, the approved 500 dollars and 100 a minute", async () => {
  const g = await loadGate("on", "15:30:00");
  assert.equal((await g.gate.enter(g.signal("AAA"))).status, "sent");
  assert.equal(g.sent().at(-1)!.qty, 1, "75 dollars at 50 is 1 share");
  g.governor.prime(Array(100).fill(z("15:30:00").getTime()));
  assert.equal((await g.gate.enter(g.signal("BBB"))).status, "sent", "the 101st order in a minute is allowed under the load day's 150");

  const after = await loadGate("on", "17:10:00");
  await updatePause(after.store, D, { on: false, since: z("16:30:00").toISOString(), resumedAt: z("17:05:00").toISOString(), resumedBy: "go" });
  assert.equal((await after.gate.enter(after.signal("CCC"))).status, "sent");
  assert.equal(after.sent().at(-1)!.qty, 10, "500 dollars at 50 is 10 shares: the 75 dollar cap is over");
  after.governor.prime(Array(100).fill(z("17:10:00").getTime()));
  const r = await after.gate.enter(after.signal("DDD"));
  assert.equal(r.status, "refused");
  assert.match((r as { reason: string }).reason, /trades-per-minute limit reached/, "the ceiling is 100 after the pause, whatever was approved for the load window");
});

test("load days: between 10:30:00 and the moment the pause is written, the 75 dollar cap still holds (the tighter direction), and the ceiling is already 100", async () => {
  const g = await loadGate("on", "16:30:01");
  assert.equal((await g.gate.enter(g.signal("AAA"))).status, "sent");
  assert.equal(g.sent().at(-1)!.qty, 1, "no pause written yet: still 75 dollars");
  g.governor.prime(Array(100).fill(z("16:30:01").getTime()));
  assert.equal((await g.gate.enter(g.signal("BBB"))).status, "refused", "the ceiling is 100 from 10:30:00");
  assert.equal(loadRulesApply(loadDayRecord(), z("16:30:01")), false, "by the clock alone the load rules have ended");
  assert.equal(loadRulesApply(loadDayRecord(), z("16:30:01"), false), true, "but not before the pause has started");
});

test("load days: after `load off`, the 75 dollar cap holds until the pause and ends with it", async () => {
  const before = await loadGate("ended", "15:30:00");
  await before.gate.enter(before.signal("AAA"));
  assert.equal(before.sent().at(-1)!.qty, 1);
  const after = await loadGate("ended", "17:10:00");
  await updatePause(after.store, D, { on: false, since: z("16:30:00").toISOString(), resumedAt: z("17:05:00").toISOString(), resumedBy: "go" });
  await after.gate.enter(after.signal("AAA"));
  assert.equal(after.sent().at(-1)!.qty, 10);
});
