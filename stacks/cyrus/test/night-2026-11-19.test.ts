// Michael's decisions B and D of 2026-11-19 (evening), logging only:
//   B. "record when each close-out starts and when its move step starts": `closeout_result.timing` carries when the close-out was due, when
//      the worker's tick decided to start it, the close-out's own start, its sale's start (its turn in the sale queue) and its move step's
//      start (null when no move phase ran).
//   D. "label the false 'late' record": a `late_notice` for an entry whose fresh stop ended in the same look carries a label; a fresh stop
//      that filled is marked not a gap (on 2026-11-19 RIOT-19's fresh stop filled while the sync's positions read still showed the share).
// Decision A (the 2 cent margin) is tested in moved-take-profit-2026-11-18.test.ts, move-quote-2026-11-19.test.ts and
// load-stop-take-2026-11-18.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { MoveWatch } from "../src/moved-take-profit.ts";
import { SyncMemory, freshEndedLabel, syncOrders } from "../src/risk.ts";
import { closeOut } from "../src/closeout.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { MIDDAY_PHASE } from "../src/midday.ts";
import { afternoonLoadWindow } from "../src/load-mode.ts";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day
const CLOSE = new Date(Date.UTC(2026, 10, 2, 21, 0));
const until = async (cond: () => boolean | Promise<boolean>, n = 400) => {
  for (let i = 0; i < n && !(await cond()); i++) await settle();
};

function world(startMs = MID, withMoves = true) {
  const sim = new SimBroker(startMs);
  sim.openShape20261118 = true;
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const watch = new MoveWatch(() => sim.simMs);
  sim.onOrderEvent = (event, o, atMs) => watch.onUpdate({ event, order: o, positionQty: null, atMs });
  const moves = {
    quotes: async (symbols: string[]) => new Map(symbols.map((s) => [s, { bid: sim.prices.get(s)!, ask: sim.prices.get(s)! + 0.01, atMs: sim.simMs }])),
    stopsFor: async (legs: Array<{ legId: string; groupId: string; symbol: string }>) => {
      const out = new Map<string, number>();
      for (const l of legs) {
        const stop = sim.orders.find((o) => o.groupId === l.groupId)?.legs.find((x) => x.type === "stop")?.stopPrice;
        if (stop) out.set(l.legId, stop);
      }
      return out;
    },
    watch,
    room: () => true,
  };
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log, ...(withMoves ? { moves } : {}) });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  return { sim, events, say, liquidator, store, now, risk, memory };
}
type World = ReturnType<typeof world>;

async function hold(w: World, symbol: string, qty: number, price: number, n: number, stop = price - 0.13, tp = price + 0.08) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: stop, takeProfitPrice: tp, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: stop, takeProfitPrice: tp, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}
const result = (w: World) => w.store.events.filter((e) => e.event === "closeout_result").at(-1)!.data as any;
const iso = (s: string | null) => (s === null ? NaN : Date.parse(s));

// ---------------------------------------------------------------- B ----------------------------------------------------------------

test("B: closeout_result.timing holds the due and trigger times passed in, the close-out's start, its sale's start and its move step's start, in that order and before the first cancel", async () => {
  const w = world(CLOSE.getTime() - 15 * 60_000);
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  await hold(w, "AAA", 10, 20, 1); // moves (bid 20, limit 19.99, stop 19.87)
  await hold(w, "BBB", 5, 30, 2, 29.99, 30.08); // stop 1 cent under the bid: no move, cancelled and sold by today's path
  const due = new Date(w.sim.simMs - 3_000).toISOString();
  const trig = new Date(w.sim.simMs - 1_000).toISOString();
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say as any, sleep: w.sim.sleep }, D, { closeAt: CLOSE, path: "close-out", timing: { dueAt: due, triggeredAt: trig } });
  assert.equal(res.flat, true);
  const r = result(w);
  const t = r.timing;
  assert.deepEqual(Object.keys(t), ["dueAt", "triggeredAt", "triggeredBy", "startedAt", "saleStartedAt", "movePhaseStartedAt"]); // triggeredBy: the timer of 2026-11-20
  assert.equal(t.triggeredBy, null, "not passed in");
  assert.equal(t.dueAt, due);
  assert.equal(t.triggeredAt, trig);
  assert.ok(iso(t.triggeredAt) <= iso(t.startedAt), "started after it was triggered");
  assert.ok(iso(t.startedAt) <= iso(t.saleStartedAt), "the sale starts after the close-out (its clock read comes first)");
  assert.ok(iso(t.saleStartedAt) <= iso(t.movePhaseStartedAt), "the move step after the sale's start");
  assert.ok(r.steps && iso(t.movePhaseStartedAt) <= iso(r.steps.replaces[0].at), "the move step before its replace");
  assert.ok(iso(r.steps.replaces[0].at) <= iso(r.steps.cancelsSentAt[0]), "and both before the first cancel");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("B: without the moved take-profit the move step is null; an already-flat close-out still stores its timing (no steps); a call without timing stores nulls for due and trigger", async () => {
  const w = world(CLOSE.getTime() - 15 * 60_000, false);
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  await hold(w, "AAA", 10, 20, 1);
  await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say as any, sleep: w.sim.sleep }, D, { closeAt: CLOSE, path: "midday", alert: false });
  const t1 = result(w).timing;
  assert.equal(t1.movePhaseStartedAt, null, "no move phase ran");
  assert.equal(t1.dueAt, null);
  assert.equal(t1.triggeredAt, null);
  assert.ok(Number.isFinite(iso(t1.startedAt)) && Number.isFinite(iso(t1.saleStartedAt)));
  // Flat already: nothing sent, so no steps, but the timing is there.
  await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say as any, sleep: w.sim.sleep }, D, { closeAt: CLOSE, path: "midday", alert: false, timing: { dueAt: null, triggeredAt: w.now().toISOString() } });
  const r2 = result(w);
  assert.equal(r2.flat, true);
  assert.equal(r2.steps, null, "nothing was sent");
  assert.ok(Number.isFinite(iso(r2.timing.startedAt)) && Number.isFinite(iso(r2.timing.triggeredAt)));
});

// The rig's day in the session with one held bracket (AAA, 10 shares), stored as the gate would have.
async function rigDay(opts: { loadAfternoon?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, ...(opts.loadAfternoon ? { loadAfternoon: true } : {}) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("trades 20\nposition 300\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:15:00");
  await r.at("14:25:00");
  await r.at("14:30:05");
  return { sim, r };
}
async function rigHold(sim: SimBroker, r: ReturnType<typeof rig<SimBroker>>, symbol: string, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await sim.submitEntry({ symbol, qty: 10, stopPrice: 45, takeProfitPrice: 55, referencePrice: 50, clientOrderId: id });
  sim.fillEntry(id, 50);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 10, referencePrice: 50, stopPrice: 45, takeProfitPrice: 55, status: "filled", alpacaOrderId: null, filledQty: 10, filledAvgPrice: 50, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
}
// The stored close-out results of one path, from the event at index `fromIdx` on (the memory store keeps no time on its events).
const results = (r: ReturnType<typeof rig<SimBroker>>, path: string, fromIdx = 0) => r.store.events.slice(fromIdx).filter((e) => e.event === "closeout_result" && e.data!.path === path).map((e) => e.data as any);

test("B, through the worker: the mid-day close-out's first try is due at 10:30 and its retry has no due time; the regular close-out is due at its set time and its retry has none; each triggered at or after it is due and started after it is triggered", async () => {
  const { sim, r } = await rigDay();
  sim.advanceTo(z("16:00:00").getTime());
  await rigHold(sim, r, "AAA", 1);
  sim.refuseSellsTimes = 100_000; // the first try cannot sell, so a retry follows
  await r.at("16:30:02"); // the first tick at or after 10:30 lands 2 s late, so the trigger time differs from the due time
  await until(() => results(r, "midday").length >= 1 && !r.worker["inflight"].has("midday"));
  const first = results(r, "midday")[0]!;
  assert.equal(first.flat, false, "the first try ended not flat");
  assert.equal(first.timing.dueAt, z("16:30:00").toISOString(), "the mid-day pause time");
  assert.ok(iso(first.timing.triggeredAt) >= z("16:30:02").getTime(), "the trigger is the tick's own time, not the due time (group 2, round 2, B12)");
  assert.equal(first.timing.triggeredBy, "pass", "no pass in the 15 s before 10:30, so no timer was set (the close-out timer of 2026-11-20)");
  assert.ok(iso(first.timing.startedAt) >= iso(first.timing.triggeredAt));
  sim.refuseSellsTimes = 0;
  await r.at("16:30:27");
  await until(() => results(r, "midday").length >= 2 && !r.worker["inflight"].has("midday"));
  const retry = results(r, "midday")[1]!;
  assert.equal(retry.timing.dueAt, null, "a retry: its time is its retry gap");
  assert.ok(Number.isFinite(iso(retry.timing.triggeredAt)));
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  // The regular close-out (5 minutes before the close in the rig), its first try not flat, then a retry.
  sim.advanceTo(z("20:50:00").getTime());
  await rigHold(sim, r, "BBB", 1);
  sim.refuseSellsTimes = 100_000;
  await r.at("20:55:03");
  await until(() => results(r, "close-out").length >= 1 && !r.worker["inflight"].has("closeout"));
  const reg = results(r, "close-out")[0]!;
  assert.equal(reg.flat, false);
  assert.equal(reg.timing.dueAt, z("20:55:00").toISOString(), "the regular close-out's set time");
  assert.ok(iso(reg.timing.triggeredAt) >= z("20:55:03").getTime(), "the tick's own time");
  assert.equal(reg.timing.triggeredBy, "pass");
  sim.refuseSellsTimes = 0;
  const after = sim.simMs;
  await r.at(new Date(after + 25_000).toISOString());
  await until(() => results(r, "retry").length >= 1 && !r.worker["inflight"].has("closeout"));
  assert.equal(results(r, "retry")[0]!.timing.dueAt, null, "the regular close-out's retry: no due time");
});

test("B, through the worker: the afternoon window's close-out is due at the window's end on its first try, and its retry has no due time", async () => {
  const { sim, r } = await rigDay({ loadAfternoon: true });
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:40:10");
  const end = afternoonLoadWindow((await r.store.getDay(D))!)!.end;
  assert.ok(end.getTime() > sim.simMs, "the window is on");
  await rigHold(sim, r, "AAA", 7);
  sim.refuseSellsTimes = 100_000;
  const from = r.store.events.length;
  await r.at(end.toISOString());
  await r.at(new Date(end.getTime() + 5_000).toISOString());
  await until(() => results(r, "midday", from).length >= 1 && !r.worker["inflight"].has("midday"));
  const first = results(r, "midday", from)[0]!;
  assert.equal(first.flat, false);
  assert.equal(first.timing.dueAt, end.toISOString(), "the window's end");
  assert.ok(iso(first.timing.triggeredAt) >= end.getTime());
  sim.refuseSellsTimes = 0;
  await r.at(new Date(sim.simMs + 25_000).toISOString());
  await until(() => results(r, "midday", from).length >= 2 && !r.worker["inflight"].has("midday"));
  assert.equal(results(r, "midday", from)[1]!.timing.dueAt, null, "its retry");
});

test("B: the close-out's start is taken before its clock read (a slow clock read shows between the start and the sale's start)", async () => {
  const w = world(CLOSE.getTime() - 15 * 60_000, false);
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  await hold(w, "AAA", 10, 20, 1);
  const clock = w.sim.getClock.bind(w.sim);
  w.sim.getClock = async () => (w.sim.advance(700), clock());
  await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say as any, sleep: w.sim.sleep }, D, { closeAt: CLOSE, path: "midday", alert: false });
  const t = result(w).timing;
  assert.ok(iso(t.saleStartedAt) - iso(t.startedAt) >= 700, `${iso(t.saleStartedAt) - iso(t.startedAt)} ms from the start to the sale's start`);
});

// ---------------------------------------------------------------- D ----------------------------------------------------------------

test("D: the label itself: a filled fresh stop is not a gap; any other end says where the lag is counted from", () => {
  const f = freshEndedLabel({ status: "filled", stopClientOrderId: "cyrus-p-x", msFromSent: 799_342, covering: true });
  assert.equal(f.notAGap, true);
  assert.match(String(f.label), /^fresh stop filled: not a gap/);
  assert.deepEqual(f.freshStop, { status: "filled", stopClientOrderId: "cyrus-p-x", msFromSent: 799_342, covering: true });
  const c = freshEndedLabel({ status: "canceled", stopClientOrderId: "cyrus-p-y", msFromSent: 1_000, covering: true });
  assert.equal(c.notAGap, false);
  assert.match(String(c.label), /^fresh stop ended \(canceled\): the gap began at its end/);
  for (const st of ["rejected", "unknown_at_alpaca"]) {
    const n = freshEndedLabel({ status: st, stopClientOrderId: "cyrus-p-z", msFromSent: 500, covering: true });
    assert.equal(n.notAGap, false);
    assert.match(String(n.label), new RegExp(`^fresh stop never held at Alpaca \\(${st}\\): lagMs, from the bracket stop's cancel, is the gap`));
  }
  const u = freshEndedLabel({ status: "accepted", stopClientOrderId: "cyrus-p-w", msFromSent: 500, covering: false });
  assert.equal(u.notAGap, false);
  assert.match(String(u.label), /^fresh stop no longer covers the holding \(last seen accepted\)/);
  assert.equal(freshEndedLabel({ status: "filled", stopClientOrderId: "cyrus-p-v", msFromSent: 5, covering: false }).notAGap, false, "not covering wins over filled");
});

test("D, RIOT's shape of 2026-11-19: the fresh stop fills while the sync's positions read still shows the share: the late record is labelled not a gap, nothing is sold, no alert", async () => {
  const w = world(MID, false);
  const dd = (await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D), (await w.store.getDay(D))!);
  const id = await hold(w, "RIOT", 13, 18, 19);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 12, 18.08); // Alpaca cancels the bracket's stop; 1 share left
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(w.memory.freshStops.has(id), "the share is under its fresh stop");
  w.sim.advance(60_000);
  const stale = await w.sim.listPositions(); // the share still held, as read just before the fill
  w.sim.triggerStop("RIOT");
  assert.equal(w.sim.heldQty("RIOT"), 0);
  const real = w.sim.listPositions.bind(w.sim);
  let served = false;
  w.sim.listPositions = async () => (served ? real() : ((served = true), stale));
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const ln = w.events.filter((e) => e.event === "late_notice");
  assert.equal(ln.length, 1, "the late record is still stored (logging only)");
  assert.equal(ln[0]!.data.notAGap, true);
  assert.match(ln[0]!.data.label, /^fresh stop filled: not a gap/);
  assert.equal(ln[0]!.data.freshStop.status, "filled");
  assert.ok(ln[0]!.data.lagMs > 60_000, "its lag still counts from the bracket stop's cancel, as before");
  assert.ok(w.events.some((e) => e.event === "fresh_stop_gone" && e.data.status === "filled"));
  assert.equal(w.sim.sellLog.length, 0, "nothing sold: the share was already gone");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("D: a fresh stop cancelled by someone else more than 6 s after the bracket's stop cancel: the late record says the lag counts from the bracket stop's cancel; the remainder is sold as before", async () => {
  const w = world(MID, false);
  const dd = (await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D), (await w.store.getDay(D))!);
  const id = await hold(w, "MARA", 5, 15, 4);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 15.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const st = w.sim.orders.find((o) => o.symbol === "MARA" && o.side === "sell" && o.type === "stop" && o.clientOrderId.startsWith("cyrus-p-"))!;
  await w.sim.cancelOrder(st.id); // cancelled by hand at Alpaca (the simulator lands it as time passes)
  w.sim.advance(10_000);
  w.memory.freshStops.get(id)!.status = "canceled";
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const ln = w.events.find((e) => e.event === "late_notice")!;
  assert.equal(ln.data.notAGap, false);
  assert.match(ln.data.label, /^fresh stop ended \(canceled\): the gap began at its end/);
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["MARA", 3]], "sold as before");
});

test("D: a late record without a fresh stop carries no label (unchanged)", async () => {
  const w = world(MID, false);
  const dd = (await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D), (await w.store.getDay(D))!);
  const id = await hold(w, "SNAP", 4, 5.3, 2);
  w.sim.advance(2_000);
  for (const l of w.sim.orders.find((o) => o.clientOrderId === id)!.legs) await w.sim.cancelOrder(l.id); // both exits gone, by hand
  w.sim.advance(10_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const ln = w.events.find((e) => e.event === "late_notice")!;
  assert.ok(ln, "a late record");
  assert.equal("label" in ln.data, false);
  assert.equal("notAGap" in ln.data, false);
});

test("D, group 2's case: the fresh stop no longer covers the holding (shares added by an order the stack did not send): the label says so and does not claim the stop ended", async () => {
  const w = world(MID, false);
  const dd = (await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D), (await w.store.getDay(D))!);
  const id = await hold(w, "RIOT", 13, 18, 19);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 12, 18.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(w.memory.freshStops.has(id));
  w.sim.advance(30_000);
  await w.sim.submitEntry({ symbol: "RIOT", qty: 2, stopPrice: 17.5, takeProfitPrice: 18.5, referencePrice: 18, clientOrderId: "by-hand-1" });
  w.sim.fillEntry("by-hand-1", 18);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const ln = w.events.find((e) => e.event === "late_notice")!;
  assert.ok(ln, "a late record");
  assert.equal(ln.data.notAGap, false);
  assert.equal(ln.data.freshStop.covering, false);
  assert.match(ln.data.label, /^fresh stop no longer covers the holding \(last seen /);
  assert.doesNotMatch(ln.data.label, /ended|filled/);
});
