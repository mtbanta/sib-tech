// Michael's decision 2 of 2026-11-23 (logging only): "record for every fresh stop when the stack learned the old stop was gone, when it sent
// the new one, and when Alpaca accepted it, so cases like SNDK's 5.9 s can be judged against the 5-second rule."
// Each `fresh_stop`, `fresh_stop_unclear` and `fresh_stop_refused` row carries `times` (FreshStopTimes in src/sells.ts): Alpaca's cancel of
// the old stop, the worker's first sight of it gone and how, the sale's start, the take-profit rest's cancel sent and answered (where SNDK's
// unexplained 3.76 s sat), the stop asked of the gate, sent to Alpaca, and Alpaca's answer. Nothing the stack does changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { SyncMemory, learnedGone, syncOrders } from "../src/risk.ts";
import { MemoryStore, setPhase } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { EXIT_PAIR_PHASE } from "../src/exit-pair.ts";
import { AlpacaError } from "../src/alpaca-trading.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day, in the session

function world(startMs = MID) {
  const sim = new SimBroker(startMs);
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  return { sim, events, store, now, risk, memory };
}
type World = ReturnType<typeof world>;

async function day(w: World, pair: "on" | null = null) {
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  if (pair) await setPhase(w.store, D, EXIT_PAIR_PHASE, pair);
  return (await w.store.getDay(D))!;
}
async function hold(w: World, symbol: string, qty: number, price: number, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}
const ms = (x: string | null | undefined) => (x ? Date.parse(x) : NaN);
const KEYS = ["stopGoneAt", "learnedAt", "learnedBy", "saleStartedAt", "cancelsSentAt", "cancelsAnsweredAt", "askedAt", "sentAt", "round"];

// The times run forward: Alpaca's cancel, the worker's sight, the sale, the take-profit rest's cancel, the stop asked, sent, answered.
function inOrder(t: any, answerKey: "acceptedAt" | "answeredAt") {
  for (const k of KEYS) assert.ok(k in t, `times.${k}`);
  const seq = [t.stopGoneAt, t.learnedAt, t.saleStartedAt, t.cancelsSentAt[0], t.cancelsAnsweredAt[0], t.askedAt, t.sentAt, t[answerKey]].map(ms);
  for (const [i, v] of seq.entries()) assert.ok(Number.isFinite(v), `time ${i} is set`);
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i - 1]! <= seq[i]!, `time ${i - 1} (${seq[i - 1]}) is not after time ${i} (${seq[i]})`);
}

test("decision 2 of 2026-11-23: a remainder seen by the order sync: its fresh_stop row carries every time, in order, learned by the order sync; the existing fields are unchanged", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "SNDK", 2, 94.06, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 94.14); // Alpaca cancels the stop here
  const cancelledAt = w.sim.simMs;
  w.sim.advance(300);
  const seenAt = w.sim.simMs;
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SNDK", 1]], "the fresh stop, as before");
  const ev = w.events.find((e) => e.event === "fresh_stop")!;
  const t = ev.data.times;
  inOrder(t, "acceptedAt");
  assert.equal(t.learnedBy, "order sync");
  assert.equal(ms(t.learnedAt), seenAt, "the sync's own sight, on the worker's clock");
  assert.ok(Math.abs(ms(t.stopGoneAt) - cancelledAt) < 1_000, "Alpaca's cancel time of the old stop");
  assert.equal(t.cancelsSentAt.length, 1, "the take-profit rest's cancel");
  assert.equal(t.cancelsAnsweredAt.length, 1);
  assert.equal(t.round, 1);
  assert.equal(ms(t.acceptedAt) - ms(t.askedAt), ev.data.msToConfirm, "Alpaca's answer, the same as msToConfirm");
  assert.equal(typeof ev.data.msFromStopCancel, "number", "the old field is kept");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("decision 2 of 2026-11-23: a remainder reported by the live update: learned by the live update at the worker's receipt time (not Alpaca's time)", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "UMC", 5, 14.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 14.58);
  const alpacaAt = w.sim.simMs;
  w.sim.advance(40);
  const receivedAt = w.sim.simMs;
  // What the worker's live-update hook records (src/worker.ts onStopCancelled): Alpaca's time, and its own receipt time.
  w.memory.liveStopCancelled.set(id, alpacaAt);
  w.memory.liveStopCancelSeenAt.set(id, receivedAt);
  w.sim.advance(260);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const t = w.events.find((e) => e.event === "fresh_stop")!.data.times;
  assert.equal(t.learnedBy, "live update");
  assert.equal(ms(t.learnedAt), receivedAt);
  inOrder(t, "acceptedAt");
});

test("decision 2 of 2026-11-23: the worker records its own receipt time of a live stop-cancel report, once, beside Alpaca's time", async () => {
  const { rig } = await import("./rig.ts");
  const r = rig({ orderStream: true });
  const wk: any = r.worker;
  wk.startOrderStream(D);
  wk.loop.wake = () => undefined;
  const id = "cyrus-20261102-LUNR-1";
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "LUNR", qty: 5, referencePrice: 12, stopPrice: 11.87, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null });
  const before = wk.d.now().getTime();
  wk.orderHandler.d.onStopCancelled({ clientOrderId: id, symbol: "LUNR", atMs: 1_000 });
  const first = wk.syncMemory.liveStopCancelSeenAt.get(id);
  assert.equal(wk.syncMemory.liveStopCancelled.get(id), 1_000, "Alpaca's time, as before");
  assert.ok(typeof first === "number" && first >= before, "the worker's own clock");
  wk.orderHandler.d.onStopCancelled({ clientOrderId: id, symbol: "LUNR", atMs: 2_000 });
  assert.equal(wk.syncMemory.liveStopCancelSeenAt.get(id), first, "the first sight is kept");
});

test("decision 2 of 2026-11-23: learnedGone takes the earlier of the live report's receipt and the sync's sight; nothing known gives none", () => {
  const mem = new SyncMemory();
  assert.equal(learnedGone(mem, "a", undefined), undefined);
  assert.deepEqual(learnedGone(mem, "a", 5_000), { atMs: 5_000, by: "order sync" });
  mem.liveStopCancelSeenAt.set("a", 4_000);
  assert.deepEqual(learnedGone(mem, "a", 5_000), { atMs: 4_000, by: "live update" });
  assert.deepEqual(learnedGone(mem, "a", 3_000), { atMs: 3_000, by: "order sync" });
  assert.deepEqual(learnedGone(mem, "a", undefined), { atMs: 4_000, by: "live update" });
});

test("decision 2 of 2026-11-23: a refused fresh stop's row carries the times with Alpaca's answer (answeredAt, no acceptedAt); the market sale follows as before", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "HDB", 4, 60, 1);
  w.sim.refuseStops = true;
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 60.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["HDB", 3]], "the market sale, as before");
  const t = w.events.find((e) => e.event === "fresh_stop_refused")!.data.times;
  inOrder(t, "answeredAt");
  assert.equal("acceptedAt" in t, false);
  assert.equal(t.learnedBy, "order sync");
});

test("decision 2 of 2026-11-23: an unclear fresh stop's row carries the times with the moment the unclear answer came; nothing else is sent, as before", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "PLUG", 4, 3, 1);
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (s: any) => {
    if (s.stopPrice !== undefined) throw new AlpacaError("outcome unclear (test)", 502);
    return realSubmit(s);
  };
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 3.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.sim.sellLog.length, 0, "no market sale on top of an unclear stop");
  const u = w.events.find((e) => e.event === "fresh_stop_unclear")!;
  inOrder(u.data.times, "answeredAt");
  assert.equal(u.data.sentToAlpaca, true);
});

test("decision 2 of 2026-11-23: with exit pairs on, the pair's fresh_stop row carries the times too", async () => {
  const w = world();
  const dd = await day(w, "on");
  const id = await hold(w, "MOS", 10, 25, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 3, 25.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const ev = w.events.find((e) => e.event === "fresh_stop")!;
  assert.equal(ev.data.pair, true);
  inOrder(ev.data.times, "acceptedAt");
});

// ---------------- Group 1 and group 2, round 1 of 2026-11-23 ----------------

test("round 1 (both groups): a remainder whose first try stuck, protected on a later try by the remainder route (asRemainder): learnedAt is the first sight, kept across the stuck try, not the later sync's time", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "LUNR", 5, 12, 51);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 12.08);
  w.sim.cancelMs = 25_000; // the take-profit rest's cancel takes 25 s at Alpaca, so the first try sticks
  w.sim.advance(300);
  const firstSync = w.sim.simMs;
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.ok(w.memory.stuck.get(id)?.protecting, "the first try stuck while protecting");
  assert.equal(w.events.some((e) => e.event === "fresh_stop"), false);
  w.sim.advance(26_000);
  w.memory.stuck.get(id)!.nextAt = 0;
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.ok(w.events.some((e) => e.event === "unprotected_position" && e.data.asRemainder === true), "the remainder route");
  const t = w.events.find((e) => e.event === "fresh_stop")!.data.times;
  assert.equal(t.learnedBy, "order sync");
  assert.equal(ms(t.learnedAt), firstSync, "the first sight, 26 s before this try");
  assert.ok(ms(t.saleStartedAt) - ms(t.learnedAt) >= 26_000, "this try's sale started 26 s later: the stuck try's time shows as the stack's, not as late learning");
});

// The sell gate reads Alpaca's open orders and positions before it sends; here every read takes 70 ms.
function slowReads(w: World, readMs: number) {
  const ends: number[] = [];
  const lo = w.sim.listOrdersPaged.bind(w.sim);
  const lp = w.sim.listPositions.bind(w.sim);
  (w.sim as any).listOrdersPaged = async (...a: any[]) => {
    w.sim.advance(readMs);
    const r = await (lo as any)(...a);
    ends.push(w.sim.simMs);
    return r;
  };
  (w.sim as any).listPositions = async () => {
    w.sim.advance(readMs);
    const r = await lp();
    ends.push(w.sim.simMs);
    return r;
  };
  return ends;
}

test("round 1 (group 2): sentAt is the end of the sell gate's own reads after askedAt, later than askedAt when the gate's reads take time, and never after Alpaca's answer", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "SNDK", 2, 94.06, 2);
  const ends = slowReads(w, 70);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 94.14);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const t = w.events.find((e) => e.event === "fresh_stop")!.data.times;
  inOrder(t, "acceptedAt");
  const asked = ms(t.askedAt);
  const sent = ms(t.sentAt);
  assert.ok(sent - asked >= 70, `the gate's reads took ${sent - asked} ms`);
  assert.ok(ends.includes(sent), "the end of a read");
  assert.equal(sent, Math.max(...ends.filter((x) => x >= asked && x <= ms(t.acceptedAt))), "the last of the gate's reads before the answer");
});

test("round 1 (group 2): with exit pairs on and the pair refused, the plain stop's sentAt counts only its own gate reads, not the pair's", async () => {
  const w = world();
  w.sim.pairAnswer = "refuse";
  const dd = await day(w, "on");
  const id = await hold(w, "CIFR", 10, 7.27, 3);
  const ends = slowReads(w, 70);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 3, 7.35);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(w.events.some((e) => e.event === "exit_pair_refused"));
  const ev = w.events.find((e) => e.event === "fresh_stop")!;
  assert.equal(ev.data.afterPairRefused, true);
  const t = ev.data.times;
  inOrder(t, "acceptedAt");
  const asked = ms(t.askedAt);
  const pairAsked = asked - ev.data.afterPairRefusedMs;
  assert.ok(pairAsked < asked, "the pair was asked first");
  assert.ok(ends.some((x) => x > pairAsked && x < asked), "the pair's gate reads came before the plain stop was asked");
  assert.ok(ms(t.sentAt) - asked >= 70 && ms(t.sentAt) - asked < 70 * 3, `only the plain stop's own reads: ${ms(t.sentAt) - asked} ms`);
});
