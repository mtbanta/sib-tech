// Release A (2026-11-04, evening): the five fixes from Wednesday's session review (builds/build-c2-log.md, "Wednesday
// 2026-11-04 session review"), each with a test that fails without it. The simulated broker reproduces what Wednesday showed:
// a take-profit's first partial fill cancels the stop, a resting take-profit takes about 11 seconds to cancel, Alpaca paper
// holds a close-out sell about 16 seconds before submitting it, and the order listing can leave an entry out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { closeOut } from "../src/closeout.ts";
import { BARE_GRACE_MS, SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { OrderGate, clientOrderIdFor } from "../src/gate.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Governor } from "../src/governor.ts";
import type { Signal } from "../src/strategy.ts";
import { FakeBroker } from "./helpers.ts";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";

function world(startMs: number, mode: { hide?: boolean } = {}) {
  const sim = new SimBroker(startMs);
  sim.hideFilledParents = mode.hide === true;
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: opts?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const events: Array<{ event: string; data: any }> = [];
  const origAdd = store.addEvent.bind(store);
  store.addEvent = async (level: string, event: string, data?: Record<string, unknown>) => (events.push({ event, data }), origAdd(level as any, event, data));
  const memory = new SyncMemory();
  const risk = { broker: sim, store, now, say, liquidator, syncMemory: memory };
  return { sim, said, say, gate, liquidator, store, now, events, risk };
}

// A filled bracket entry, written down the way the gate and the sync would have it.
async function hold(w: ReturnType<typeof world>, symbol: string, qty: number, price: number, n = 1, status: "filled" | "submitted" = "filled") {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.06, takeProfitPrice: price + 0.01, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.06, takeProfitPrice: price + 0.01, status, alpacaOrderId: null, filledQty: status === "filled" ? qty : null, filledAvgPrice: status === "filled" ? price : null, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}

const MID = Date.UTC(2026, 10, 2, 15, 0); // 10:00 New York, in the session

// ---------------- Fix 1: shares left with no stop after a partial take-profit ----------------

test("fix 1, the CIFR case: the stop is cancelled at the take-profit's first partial fill, the take-profit is hidden from the open list; the remaining 7 shares are sold about 5 seconds later, with no oversell", async () => {
  const w = world(MID, { hide: true });
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "CIFR", 10, 7.27);
  w.sim.advance(10_000);
  w.sim.partialTakeProfit(id, 3, 7.28); // Alpaca paper cancels the stop here
  const cancelledAt = w.sim.simMs;
  w.sim.advance(2_000);
  const first = await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.sim.sellLog.length, 0, "inside the grace time: nothing sold yet");
  assert.equal(first.recheckAt, cancelledAt + BARE_GRACE_MS, "the sync asks to look again exactly when the grace time ends");
  w.sim.advanceTo(first.recheckAt!);
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["CIFR", 7]]);
  const gap = w.sim.sellLog[0]!.at - cancelledAt;
  assert.ok(gap >= BARE_GRACE_MS && gap < BARE_GRACE_MS + 2_000, `the sell went out ${gap} ms after the stop was cancelled`);
  assert.equal(w.sim.oversellAttempts, 0);
  w.sim.advance(5_000);
  assert.equal(w.sim.heldQty("CIFR"), 0, "flat in CIFR");
  assert.ok(w.said.some((m) => m.ch === "alerts" && m.text.includes("CIFR: Alpaca cancelled its stop when the take-profit partly filled, so I sold the remaining 7 shares")));
});

test("fix 1 with Wednesday's slow cancel (11 seconds): the take-profit is cancelled first, then the remainder is sold, no oversell, no false alarm", async () => {
  const w = world(MID, { hide: true });
  w.sim.cancelMs = 11_000;
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "CIFR", 10, 7.27);
  w.sim.partialTakeProfit(id, 3, 7.28);
  w.sim.advance(6_000);
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["CIFR", 7]]);
  assert.equal(w.sim.oversellAttempts, 0);
  assert.ok(!w.said.some((m) => m.text.includes("COULD NOT SELL")), "no false could-not-sell alarm");
});

test("fix 1: a take-profit that finishes inside the grace time is left alone (the usual case: 604 of 655 on Wednesday)", async () => {
  const w = world(MID, { hide: true });
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "CMG", 2, 34.75);
  w.sim.partialTakeProfit(id, 1, 34.76);
  w.sim.advance(2_000);
  await syncOrders(w.risk, day, { protect: true });
  w.sim.partialTakeProfit(id, 1, 34.76); // the rest fills at 3 seconds
  w.sim.advance(5_000);
  const r = await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(r.recheckAt, undefined);
  assert.ok((await w.store.listOrders(D))[0]!.closedAt, "closed by its own take-profit");
});

test("fix 1: Alpaca's documented behaviour (the stop resized and still live after a partial take-profit) is not touched", async () => {
  const w = world(MID);
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "ADT", 7, 9.9);
  w.sim.partialTakeProfit(id, 2, 9.91);
  const stop = w.sim.orders.find((o) => o.clientOrderId === id)!.legs.find((l) => l.type === "stop")!;
  stop.status = "held"; // as the documentation says: resized, not cancelled
  stop.canceledAt = null;
  w.sim.advance(30_000);
  const r = await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(r.unprotected.length, 0);
});

test("fix 1: nothing is sold while the protect switch is off (a close-out is running, or the close-out time has come)", async () => {
  const w = world(MID, { hide: true });
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "CIFR", 10, 7.27);
  w.sim.partialTakeProfit(id, 3, 7.28);
  w.sim.advance(30_000);
  await syncOrders(w.risk, day, { protect: false });
  assert.equal(w.sim.sellLog.length, 0);
});

test("normal behaviour unchanged: an entry with no live exit at all is still sold at once, with the old message", async () => {
  const w = world(MID);
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "AAA", 5, 20);
  for (const l of w.sim.orders.find((o) => o.clientOrderId === id)!.legs) l.status = "canceled";
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["AAA", 5]]);
  assert.ok(w.said.some((m) => m.text.includes("AAA had no live protective stop, so I sold it")));
});

test("fix 1, worker level: a bare remainder found by a sync before its grace is over is sold by a timer at the grace time (3 seconds since the speed release), not at the next sync", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.hideFilledParents = true;
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("14:59:00").getTime());
  const id = clientOrderIdFor(D, "CIFR", 1);
  await sim.submitEntry({ symbol: "CIFR", qty: 10, stopPrice: 7.21, takeProfitPrice: 7.28, referencePrice: 7.27, clientOrderId: id });
  sim.fillEntry(id, 7.27);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "CIFR", qty: 10, referencePrice: 7.27, stopPrice: 7.21, takeProfitPrice: 7.28, status: "filled", alpacaOrderId: null, filledQty: 10, filledAvgPrice: 7.27, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  await r.at("15:00:00"); // a regular sync: nothing wrong yet
  sim.advanceTo(z("15:00:28").getTime());
  sim.partialTakeProfit(id, 3, 7.28);
  await r.at("15:00:30"); // the regular sync sees it 2 seconds old: not yet
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(sim.sellLog.length, 0);
  assert.ok(r.timers().some((t) => t >= z("15:00:31").getTime() && t <= z("15:00:31.5").getTime()), "a timer at the grace time (the cancel plus 3 seconds, plus a quarter second for the clocks)");
  r.setNow("15:00:32"); // the timer fires; no pass runs (the next 5 second pass would be 15:00:35)
  for (let i = 0; i < 10 && sim.sellLog.length === 0; i++) await settle();
  assert.deepEqual(sim.sellLog.map((x) => [x.symbol, x.qty]), [["CIFR", 7]]);
  assert.ok(sim.sellLog[0]!.at < z("15:00:33").getTime(), "sold within about 4 seconds of the stop's cancel, not at the next sync");
});

// ---------------- Fix 2: no NOT FLAT while the close-out's own sells are working ----------------

const CLOSEOUT = Date.UTC(2026, 10, 2, 20, 55);
const CLOSE = new Date(Date.UTC(2026, 10, 2, 21, 0));

test("fix 2, Wednesday's close-out: 11 second cancels and sells filled 20 seconds after they were sent end flat, with no NOT FLAT and one 'Close-out done'", async () => {
  const w = world(CLOSEOUT - 6 * 3600_000);
  await hold(w, "ADT", 7, 9.9);
  await hold(w, "CIFR", 7, 7.27);
  w.sim.advanceTo(CLOSEOUT);
  w.sim.cancelMs = 11_000;
  w.sim.sellFillDelayMs = 20_000;
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D, { closeAt: CLOSE, path: "close-out" });
  assert.deepEqual(res, { flat: true, remaining: [] });
  assert.ok(!w.said.some((m) => m.text.includes("NOT FLAT")), "no NOT FLAT");
  assert.equal(w.said.filter((m) => m.text.includes("Close-out done")).length, 1);
  assert.ok(!w.said.some((m) => m.text.includes("had trouble")), "waiting for Alpaca, or 'pending cancel' answers, are not trouble");
  assert.equal(w.sim.oversellAttempts, 0);
  const ev = w.events.find((e) => e.event === "closeout_result")!;
  assert.equal(ev.data.flat, true);
  assert.equal(ev.data.path, "close-out", "fix 5: the path is recorded");
  assert.ok(ev.data.waitedMs > 0, "the wait is recorded");
  assert.equal(ev.data.steps.sells.length, 2, "fix 5: the sells and their times are recorded");
  assert.ok(ev.data.steps.cancelsSentAt.length >= 1);
});

test("fix 2: if Alpaca still has not filled the close-out's own sells 2 minutes before the close, NOT FLAT names the true reason and does not say 'close by hand'", async () => {
  const w = world(CLOSEOUT - 6 * 3600_000);
  await hold(w, "ADT", 7, 9.9);
  w.sim.advanceTo(CLOSEOUT);
  w.sim.sellFillDelayMs = 30 * 60_000; // never fills in time
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D, { closeAt: CLOSE });
  assert.equal(res.flat, false);
  assert.ok(w.sim.simMs >= CLOSE.getTime() - 2 * 60_000 && w.sim.simMs < CLOSE.getTime() - 60_000, "waited until about 2 minutes before the close");
  const alert = w.said.find((m) => m.ch === "alerts" && m.text.includes("NOT FLAT"))!;
  assert.match(alert.text, /1 sell sent at .* for ADT; Alpaca had not filled it by/);
  assert.ok(!alert.text.includes("close by hand"));
  assert.ok(!alert.text.includes("pending cancel"));
});

test("fix 2: while waiting it looks gently, at most about one request a second", async () => {
  const w = world(CLOSEOUT - 6 * 3600_000);
  await hold(w, "ADT", 7, 9.9);
  w.sim.advanceTo(CLOSEOUT);
  w.sim.sellFillDelayMs = 60_000;
  const before = w.sim.bucketTimes.length;
  await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say, sleep: w.sim.sleep }, D, { closeAt: CLOSE });
  const during = w.sim.bucketTimes.slice(before).filter((t) => t > CLOSEOUT + 15_000); // after the sale was sent
  const span = (Math.max(...during) - Math.min(...during)) / 1000;
  assert.ok(during.length <= span + 2, `${during.length} requests in ${span} seconds of waiting`);
});

test("normal behaviour unchanged: the loss stop's and the missing-exit check's sales do not stop early on their own working sells", async () => {
  const w = world(MID);
  await hold(w, "AAA", 5, 20);
  w.sim.sellFillDelayMs = 60_000;
  const r = await w.liquidator.flatten({ reason: "daily loss stop", tradeDate: D });
  assert.equal(r.working, undefined, "no early return without the close-out's option");
  assert.equal(r.flat, false);
  assert.deepEqual(r.sold, [{ symbol: "AAA", qty: 5 }]);
});

// ---------------- Fix 3 (and the close-out at worker level): one close-out per day ----------------

async function closeoutDay() {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const events: Array<{ e: string; data?: any }> = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, log: (_l, e, data) => void events.push({ e, data }) });
  const stored: Array<{ event: string; data: any }> = [];
  const origAdd = r.store.addEvent.bind(r.store);
  r.store.addEvent = async (level: any, event: string, data?: Record<string, unknown>) => (stored.push({ event, data }), origAdd(level, event, data));
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  for (const [sym, qty, px] of [["ADT", 7, 9.9], ["CIFR", 7, 7.27]] as const) {
    const id = clientOrderIdFor(D, sym, 1);
    await sim.submitEntry({ symbol: sym, qty, stopPrice: px - 0.04, takeProfitPrice: px + 0.02, referencePrice: px, clientOrderId: id });
    sim.fillEntry(id, px);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: sym, qty, referencePrice: px, stopPrice: px - 0.04, takeProfitPrice: px + 0.02, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: px, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  }
  return { sim, r, events, stored };
}
const tickThrough = async (r: ReturnType<typeof rig<SimBroker>>, from: string, to: string) => {
  for (let t = z(from).getTime(); t <= z(to).getTime(); t += 5_000) {
    await r.at(new Date(t).toISOString());
    await settle();
  }
};

test("worker level, Wednesday's close-out: slow cancels and late sells give no NOT FLAT, no failure signal to Healthchecks, one 'Close-out done', the step recorded", async () => {
  const { sim, r } = await closeoutDay();
  sim.cancelMs = 11_000;
  sim.sellFillDelayMs = 20_000;
  await tickThrough(r, "20:54:55", "20:57:00");
  const all = r.bot.posts.map((p) => p.text);
  assert.ok(!all.some((t) => t.includes("NOT FLAT")), "no NOT FLAT");
  assert.ok(!r.pings.includes("fail"), "no failure signal");
  assert.equal(r.said("trading").filter((t) => t.includes("Close-out done")).length, 1);
  assert.ok((await r.store.getDay(D))!.phases.closeout);
  assert.equal((await sim.listPositions()).length, 0);
});

test("fix 3: after a close-out that ends NOT FLAT, the carried-position sale does not run that day; the retry finishes the job and 'Close-out done' posts once", async () => {
  const { sim, r, stored } = await closeoutDay();
  let refusing = true;
  sim.refuseSellIf = () => refusing;
  await r.at("20:55:00");
  await settle();
  assert.ok(r.bot.posts.some((p) => p.text.includes("NOT FLAT")), "the first close-out really ended not flat");
  refusing = false;
  await tickThrough(r, "20:55:05", "20:56:30");
  const paths = stored.filter((e) => e.event === "closeout_result").map((e) => e.data.path);
  assert.ok(!paths.includes("carried"), `paths: ${paths.join(", ")}`);
  assert.ok(paths.includes("retry"));
  assert.equal(r.said("trading").filter((t) => t.includes("Close-out done")).length, 1);
  assert.equal((await sim.listPositions()).length, 0);
});

// ---------------- Fix 4: Alpaca's listing checked against the stored entries ----------------

test("fix 4: an entry Alpaca's listing leaves out is fetched by its client id and recorded; one Alpaca does not know is not asked again for a minute", async () => {
  const w = world(MID);
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "CMG", 2, 34.75, 7, "submitted");
  w.sim.hiddenFromListing.add(id);
  await w.store.insertOrder({ clientOrderId: clientOrderIdFor(D, "RIVN", 9), tradeDate: D, symbol: "RIVN", qty: 5, referencePrice: 14, stopPrice: 13.9, status: "intent", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: new Date(w.sim.simMs - 20_000).toISOString() });
  await syncOrders(w.risk, day, { protect: true });
  const rec = (await w.store.listOrders(D)).find((o) => o.clientOrderId === id)!;
  assert.equal(rec.status, "filled", "the missing entry is recorded from the lookup");
  assert.equal(w.sim.findCalls, 2, "one lookup each");
  w.sim.advance(30_000);
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.sim.findCalls, 3, "the unknown intent is not asked again inside a minute (the hidden entry is)");
  w.sim.advance(31_000);
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.sim.findCalls, 5);
});

test("fix 4: the daily summary includes an entry Alpaca's listing left out, so its counts match the account", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("15:00:00").getTime());
  for (const [sym, n] of [["CMG", 7], ["RIVN", 7]] as const) {
    const id = clientOrderIdFor(D, sym, n);
    await sim.submitEntry({ symbol: sym, qty: 2, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    sim.fillExit(id, "take_profit", 10.1);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: sym, qty: 2, referencePrice: 10, stopPrice: 9.9, takeProfitPrice: 10.1, status: "filled", alpacaOrderId: "x", filledQty: 2, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  }
  sim.hiddenFromListing.add(clientOrderIdFor(D, "RIVN", 7));
  await (r.worker as unknown as { summaryPhase(d: string): Promise<void> }).summaryPhase(D);
  const text = r.said("trading").join("\n");
  assert.match(text, /2 entry orders sent \(2 filled\)/);
});

// ---------------- Fix 5: logging ----------------

test("fix 5: 'too close to the close' refusals are counted into one row, not written one row each", async () => {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const now = new Date("2026-11-02T20:10:00Z");
  const say = async () => true;
  await ensureDay({ store, broker, now: () => now }, D);
  await store.updateDay(D, { status: "approved", decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z" } });
  const gate = new OrderGate({ broker, store, view: new BrokerView(broker, () => now.getTime()), governor: new Governor(() => now.getTime()), now: () => now, say: say as any, note: () => undefined });
  const signal = (symbol: string): Signal => ({ symbol, price: 50, tradeTime: new Date(now.getTime() - 2000), stopPrice: 49, takeProfitPrice: 50.2 });
  for (const sym of ["AAA", "BBB", "CCC"]) assert.match(((await gate.enter(signal(sym))) as any).reason, /too close to the close/);
  await gate.flush();
  const rows = await store.listRefusals(D);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]!.detail, { count: 3 });
});

test("fix 5: each heartbeat failure signal is logged, and the first of an episode is kept in the run log", async () => {
  const events: string[] = [];
  const r = rig({ log: (_l, e) => void events.push(e) });
  const stored: string[] = [];
  const origAdd = r.store.addEvent.bind(r.store);
  r.store.addEvent = async (level: any, event: string, data?: Record<string, unknown>) => (stored.push(event), origAdd(level, event, data));
  r.broker.positions = [{ symbol: "AAA", qty: 1, marketValue: 50, avgEntryPrice: 50, unrealizedPl: 0 }]; // held outside the session
  await r.at("2026-11-01T22:10:00Z");
  (r.worker as unknown as { notFlat: boolean; notFlatLoaded: boolean }).notFlatLoaded = true;
  (r.worker as unknown as { notFlat: boolean }).notFlat = true;
  await r.at("2026-11-01T22:10:05Z");
  await r.at("2026-11-01T22:10:10Z");
  const fails = r.pings.filter((p) => p === "fail").length;
  assert.ok(fails >= 2);
  assert.equal(events.filter((e) => e === "heartbeat_fail").length, fails, "every failure signal is logged");
  assert.equal(stored.filter((e) => e === "heartbeat_fail").length, 1, "one run-log row for the episode");
});
