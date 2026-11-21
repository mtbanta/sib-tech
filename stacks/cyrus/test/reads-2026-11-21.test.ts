// Michael's approval of 2026-11-21, item 1 (logging only): "record the time of each read from Alpaca in the close-out's sale". Each read the
// liquidator makes (the clock, the positions, the open orders, a cancel's one lookup) is kept in `result.reads` (at most SALE_READS_STORED,
// the rest counted in `readsMore`) and stored by the close-out in `closeout_result.timing.reads`. The record adds no request and never
// changes what a read returns or throws.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate, SALE_READS_STORED } from "../src/sells.ts";
import { closeOut } from "../src/closeout.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { MoveWatch } from "../src/moved-take-profit.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const CLOSE = new Date(Date.UTC(2026, 10, 2, 21, 0));

function world(withMoves = false) {
  const sim = new SimBroker(CLOSE.getTime() - 15 * 60_000);
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  // The moved take-profit, as in night-2026-11-19.test.ts (the simulator's 2026-11-18 open-list shape, quotes at the simulator's price).
  sim.openShape20261118 = withMoves;
  const watch = new MoveWatch(() => sim.simMs);
  if (withMoves) sim.onOrderEvent = (event, o, atMs) => watch.onUpdate({ event, order: o, positionQty: null, atMs });
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
  return { sim, events, say, liquidator, store, now };
}
type World = ReturnType<typeof world>;

async function hold(w: World, symbol: string, qty: number, price: number, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  return id;
}
const result = (w: World) => w.store.events.filter((e) => e.event === "closeout_result").at(-1)!.data as any;
const iso = (s: string) => Date.parse(s);
const deps = (w: World) => ({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say as any, sleep: w.sim.sleep });

// Counts the liquidator's own read calls by wrapping the simulator's methods (the wrapper adds no request of its own).
function countReads(sim: SimBroker) {
  const n = { clock: 0, positions: 0, pages: 0, lookups: 0 };
  const clock = sim.getClock.bind(sim);
  const positions = sim.listPositions.bind(sim);
  const list = sim.listOrders.bind(sim);
  const lookup = sim.getOrderById.bind(sim);
  sim.getClock = async () => (n.clock++, clock());
  sim.listPositions = async () => (n.positions++, positions());
  sim.listOrders = async (s: any, a?: any) => (n.pages++, list(s, a));
  sim.getOrderById = async (id: string) => (n.lookups++, lookup(id));
  return n;
}

test("item 1: a close-out stores its sale's reads in timing.reads: round 1's clock, positions and open orders first, in order, each with its time; a slow positions read shows its own length", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  await hold(w, "AAA", 10, 20, 1);
  await hold(w, "BBB", 5, 30, 2);
  // The first positions read of the sale takes 4.5 s (Friday 2026-11-20's 2:45 close-out spent 4.89 s on round 1's reads).
  const positions = w.sim.listPositions.bind(w.sim);
  let slowOnce = false;
  let saleStarted = false;
  const getClock = w.sim.getClock.bind(w.sim);
  w.sim.getClock = async () => ((saleStarted = true), getClock());
  w.sim.listPositions = async () => {
    if (saleStarted && !slowOnce) {
      slowOnce = true;
      await w.sim.sleep(4_500);
    }
    return positions();
  };
  const res = await closeOut(deps(w), D, { closeAt: CLOSE, path: "close-out", timing: { dueAt: null, triggeredAt: w.now().toISOString() } });
  assert.equal(res.flat, true);
  const t = result(w).timing;
  assert.ok(Array.isArray(t.reads) && t.reads.length >= 3, `reads stored: ${JSON.stringify(t.reads)}`);
  assert.equal(t.readsMore, 0);
  const [c, p, o] = t.reads;
  assert.deepEqual([c.what, p.what, o.what], ["clock", "positions", "openOrders"]);
  assert.deepEqual([c.round, p.round, o.round], [1, 1, 1]);
  assert.ok(c.ok && p.ok && o.ok);
  assert.ok(p.ms >= 4_500, `the slow read took ${p.ms} ms`);
  assert.ok(c.ms < 100 && o.ms < 100, "the others were quick");
  assert.equal(o.pages, 1, "one page of open orders");
  assert.ok(iso(t.saleStartedAt) <= iso(c.at), "the first read at or after the sale's start");
  for (let i = 1; i < t.reads.length; i++) assert.ok(iso(t.reads[i - 1].at) <= iso(t.reads[i].at), "reads in the order they were made");
  assert.ok(iso(p.at) + p.ms <= iso(o.at), "the open orders were read after the positions answered");
  for (const r of t.reads) assert.deepEqual(Object.keys(r).filter((k) => k !== "pages" && k !== "by"), ["what", "round", "at", "ms", "ok"]);
  assert.ok(t.reads.some((r: any) => r.by === "gate" && r.what === "openOrders") && t.reads.some((r: any) => r.by === "gate" && r.what === "positions"), "the sell gate's own check before the market sales is timed too");
});

test("item 1: the record holds exactly the reads the sale made (no extra request): every clock, positions and open-orders read, and the pages", async () => {
  const w = world();
  await hold(w, "AAA", 10, 20, 1);
  await hold(w, "BBB", 5, 30, 2);
  const n = countReads(w.sim);
  const before = w.sim.requests;
  const res = await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  assert.equal(res.flat, true);
  const reads = res.reads ?? [];
  assert.equal(res.readsMore, undefined);
  assert.equal(reads.filter((r) => r.what === "clock").length, n.clock);
  assert.equal(reads.filter((r) => r.what === "positions").length, n.positions);
  assert.equal(reads.filter((r) => r.what === "openOrders").reduce((s, r) => s + (r.pages ?? 0), 0), n.pages);
  assert.equal(reads.filter((r) => r.what === "orderLookup").length, n.lookups);
  assert.ok(w.sim.requests > before);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("item 1: a read that throws is recorded with ok false and the sale behaves exactly as before (a failed clock read is ignored; a failed positions read is tried again next round)", async () => {
  const w = world();
  await hold(w, "AAA", 10, 20, 1);
  const clock = w.sim.getClock.bind(w.sim);
  const positions = w.sim.listPositions.bind(w.sim);
  let clockFails = 1;
  let positionsFails = 1;
  w.sim.getClock = async () => {
    if (clockFails-- > 0) throw new Error("clock read failed (test)");
    return clock();
  };
  w.sim.listPositions = async () => {
    if (positionsFails-- > 0) throw new Error("positions read failed (test)");
    return positions();
  };
  const res = await w.liquidator.flatten({ reason: "close-out", tradeDate: D });
  assert.equal(res.flat, true, "sold in round 2, as without the record");
  assert.ok(res.errors.some((e) => e.startsWith("round 1: could not read positions")), "the error is unchanged");
  const r = res.reads!;
  assert.deepEqual(r.slice(0, 3).map((x) => [x.what, x.round, x.ok]), [["clock", 1, false], ["positions", 1, false], ["clock", 2, true]]);
});

test("item 1: at most SALE_READS_STORED reads are kept; the rest are counted in readsMore and the close-out stores both", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  await hold(w, "AAA", 10, 20, 1);
  // Shares reported held by orders nothing visible explains, for the whole sale: every round waits its full 6 s, polling.
  w.sim.staleHeld.set("AAA", 10);
  const n = countReads(w.sim);
  await closeOut(deps(w), D, { closeAt: CLOSE, path: "midday", alert: false, maxRounds: 4, waitForOwnSells: false });
  const t = result(w).timing;
  assert.equal(t.reads.length, SALE_READS_STORED);
  assert.ok(t.readsMore > 0, `readsMore ${t.readsMore}`);
  assert.ok(t.reads.length + t.readsMore <= n.clock + n.positions + n.pages + n.lookups, "never more than the reads made (the close-out's own reads are not the sale's)");
});

test("item 1 (group 2, round 1): with a move sent, round 1 starts again and the record holds two sets of round 1 reads: the first step's three answered by movePhaseStartedAt, then a second round 1 clock read at or after it", async () => {
  const w = world(true);
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  await hold(w, "AAA", 10, 20, 1); // moves (bid 20, limit 19.99, stop 19.87)
  await hold(w, "BBB", 5, 30, 2); // moves too
  const res = await closeOut(deps(w), D, { closeAt: CLOSE, path: "close-out", timing: { dueAt: null, triggeredAt: w.now().toISOString() } });
  assert.equal(res.flat, true);
  const r = result(w);
  assert.ok(r.steps?.replaces?.length >= 1, "a move was sent");
  const t = r.timing;
  const move = iso(t.movePhaseStartedAt);
  // In the record's order: round 1's first clock, positions and open-orders reads are the first step (each answered by the move step's
  // start); the next round 1 clock read marks round 1 started again after the moves (asked at or after the move step's start).
  const r1 = t.reads.filter((x: any) => x.round === 1);
  assert.deepEqual(r1.slice(0, 3).map((x: any) => x.what), ["clock", "positions", "openOrders"], "the first step: round 1's three reads");
  for (const x of r1.slice(0, 3)) assert.ok(iso(x.at) + x.ms <= move, "answered by the move step's start");
  const againAt = r1.findIndex((x: any, i: number) => i > 0 && x.what === "clock");
  assert.ok(againAt >= 3, "a second round 1 clock read: round 1 started again, same number");
  assert.deepEqual(r1.slice(againAt, againAt + 3).map((x: any) => x.what), ["clock", "positions", "openOrders"]);
  assert.ok(iso(r1[againAt].at) >= move, "asked at or after the move step's start");
  assert.ok(!r1.slice(3, againAt).some((x: any) => x.by === "gate"), "the replaces used the sale's own fresh view: no gate read for them");
  assert.equal(w.sim.oversellAttempts, 0);
});
