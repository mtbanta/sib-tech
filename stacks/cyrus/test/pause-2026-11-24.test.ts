// Michael's approval of 2026-11-24 (evening), item 2: "The fresh-stop pause proposal is approved as recommended (drop the discarded reads;
// end the pause on Alpaca's live cancel confirmation; single-position sales only, close-outs unchanged)."
// Options A and B of builds/c2-proposal-2026-11-24-fresh-stop-pause.md:
//   A: one position's own sale that cancelled something pauses BEFORE its first look (the reads it made before the pause were thrown away);
//   B: that pause ends once the live updates report every order the round cancelled cancelled, by exact id (src/cancel-seen.ts);
//   every whole-account sale and close-out retry is unchanged (reads, then the plain half second).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { CANCEL_SEEN_MAX, CANCEL_SEEN_MEMORY_MS, CancelSeen, type PauseEnd } from "../src/cancel-seen.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day, in the session
const READ_MS = 70; // every read of the order list or positions takes 70 ms (about Tuesday's measured reads)

type Stub = (ids: readonly string[], ms: number) => Promise<PauseEnd>;

function world(waitCancelled?: Stub, readMs = READ_MS) {
  const sim = new SimBroker(MID);
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log, ...(waitCancelled ? { waitCancelled } : {}) });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  const reads: Array<{ what: string; at: number }> = [];
  if (readMs > 0) {
    const lo = sim.listOrdersPaged.bind(sim);
    const lp = sim.listPositions.bind(sim);
    (sim as any).listOrdersPaged = async (...a: any[]) => {
      sim.advance(readMs);
      reads.push({ what: "orders", at: sim.simMs });
      return (lo as any)(...a);
    };
    (sim as any).listPositions = async () => {
      sim.advance(readMs);
      reads.push({ what: "positions", at: sim.simMs });
      return lp();
    };
  }
  return { sim, events, store, now, risk, memory, liquidator, reads };
}
type World = ReturnType<typeof world>;

async function hold(w: World, symbol: string, qty: number, price: number, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}
const tpLegId = (w: World, id: string) => w.sim.orders.find((o) => o.clientOrderId === id)!.legs.find((l) => l.type === "limit")!.id;
const ms = (x: string | null | undefined) => (x ? Date.parse(x) : NaN);

// A leftover after a partial take-profit, protected by the order sync: returns the fresh stop's times and the stub's calls.
async function leftover(stub?: (w: World) => Stub, cancelMs = 30) {
  const calls: Array<{ ids: string[]; ms: number }> = [];
  let wref: World | null = null;
  const w = world(stub ? (ids, m) => (calls.push({ ids: [...ids], ms: m }), stub(wref!)(ids, m)) : undefined);
  wref = w;
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const dd = (await w.store.getDay(D))!;
  const id = await hold(w, "SNDK", 3, 94.06, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 94.14); // Alpaca cancels the stop here
  w.sim.cancelMs = cancelMs; // on 2026-11-24 Alpaca's cancel landed before its answer in 32 of 33 cases
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const fs = w.events.find((e) => e.event === "fresh_stop");
  return { w, id, calls, fs, t: fs?.data.times };
}
// Reads made from the take-profit cancel's answer to the stop asked of the gate.
const readsBetween = (w: World, t: any) => w.reads.filter((r) => r.at > ms(t.cancelsAnsweredAt[0]) && r.at <= ms(t.askedAt)).map((r) => r.what);

test("item 2 (A): without the live confirmation, one position's own sale pauses the full half second BEFORE its first look: no thrown-away reads (850 ms became 710)", async () => {
  const { w, t } = await leftover();
  assert.ok(t, "the fresh stop is placed");
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SNDK", 2]]);
  assert.deepEqual(readsBetween(w, t), ["orders", "positions", "positions"], "one look (orders, positions) after the pause, then step 3's positions; before the change two more came before the pause");
  assert.equal(ms(t.askedAt) - ms(t.cancelsAnsweredAt[0]), 500 + 3 * READ_MS);
  assert.deepEqual(t.pause, { ms: 500, endedBy: "timer" });
  assert.equal(w.sim.oversellAttempts, 0);
});

test("item 2 (B): the live confirmation of the exact take-profit rest arriving 60 ms into the pause ends it then; the stop is asked 60 ms plus one look later", async () => {
  const { w, id, calls, t } = await leftover((w) => async () => (w.sim.advance(60), "confirmed"));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { ids: [tpLegId(w, id)], ms: 500 }, "only the order this round cancelled, by its Alpaca id, for at most the half second");
  assert.deepEqual(readsBetween(w, t), ["orders", "positions", "positions"]);
  assert.equal(ms(t.askedAt) - ms(t.cancelsAnsweredAt[0]), 60 + 3 * READ_MS);
  assert.deepEqual(t.pause, { ms: 60, endedBy: "confirmed" });
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SNDK", 2]]);
  assert.equal(w.sim.sellLog.length, 0, "no market sale");
});

test("item 2 (B): a confirmation that arrived before the pause began (the usual case) means no pause at all", async () => {
  const { w, t } = await leftover(() => async () => "confirmed");
  assert.equal(ms(t.askedAt) - ms(t.cancelsAnsweredAt[0]), 3 * READ_MS);
  assert.deepEqual(t.pause, { ms: 0, endedBy: "confirmed" });
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SNDK", 2]]);
});

test("item 2 (B): no confirmation within the half second ('timer') or the live updates not connected ('not_live'): the full half second, as before", async () => {
  for (const end of ["timer", "not_live"] as const) {
    const { w, t } = await leftover((w) => async (_ids, m) => (w.sim.advance(m), end));
    assert.equal(ms(t.askedAt) - ms(t.cancelsAnsweredAt[0]), 500 + 3 * READ_MS, end);
    assert.deepEqual(t.pause, { ms: 500, endedBy: end });
    assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SNDK", 2]]);
  }
});

test("item 2 (B): a wait that throws counts as no confirmation: the rest of the half second is waited", async () => {
  const { w, t } = await leftover((w) => async () => {
    w.sim.advance(100);
    throw new Error("boom");
  });
  assert.equal(ms(t.askedAt) - ms(t.cancelsAnsweredAt[0]), 500 + 3 * READ_MS);
  assert.deepEqual(t.pause, { ms: 500, endedBy: "timer" });
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SNDK", 2]]);
});

test("item 2 (B): confirmed early but Alpaca's positions still show the shares held: the existing 250 ms poll waits, then the stop covers the whole leftover (never a part, never a market sale)", async () => {
  // Alpaca's cancel takes 400 ms here: the look after a 20 ms confirmation (at 160 ms) still sees the take-profit holding the shares.
  const { w, t } = await leftover((w) => async () => (w.sim.advance(20), "confirmed"), 400);
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SNDK", 2]], "one stop, for all of it");
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.sim.oversellAttempts, 0);
  assert.deepEqual(t.pause, { ms: 20, endedBy: "confirmed" });
  const between = readsBetween(w, t);
  assert.ok(between.length >= 5, `a poll looked again: ${between.join(",")}`);
  assert.ok(ms(t.askedAt) - ms(t.cancelsAnsweredAt[0]) >= 400, "not before Alpaca's cancel landed");
});

test("item 2 (B): the missing-exit sale (one position's own market sale after its exits are cancelled) also ends its pause on the confirmation", async () => {
  const calls: string[][] = [];
  const w = world(async (ids) => (calls.push([...ids]), "confirmed"));
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const id = await hold(w, "LUNR", 5, 12, 1);
  w.sim.cancelMs = 30;
  const legs = w.sim.orders.find((o) => o.clientOrderId === id)!.legs.map((l) => l.id);
  const r = await w.liquidator.flatten({ reason: "missing exits", tradeDate: D, only: ["LUNR"], ownEntryOnly: { maxQty: { LUNR: 5 } }, cancelIds: legs, maxRounds: 2 } as any);
  assert.deepEqual(calls, [legs], "the exact ids it cancelled");
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["LUNR", 5]]);
  assert.equal(r.errors.length, 0, r.errors.join("; "));
});

// The whole-account sales and close-out retries: exactly as before, whether or not the confirmation is available.
async function closeoutRun(withStub: boolean, shape: "all" | "retry") {
  const calls: string[][] = [];
  const w = world(withStub ? async (ids) => (calls.push([...ids]), "confirmed") : undefined);
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const a = await hold(w, "AAA", 4, 20, 1);
  await hold(w, "BBB", 3, 30, 2);
  w.sim.cancelMs = 30;
  const opts: any = shape === "all" ? { reason: "close-out", tradeDate: D } : { reason: "close-out retry", tradeDate: D, only: ["AAA"], cancelIds: w.sim.orders.find((o) => o.clientOrderId === a)!.legs.map((l) => l.id) };
  const r = await w.liquidator.flatten(opts);
  return { calls, sells: w.sim.sellLog.map((x) => [x.symbol, x.qty, x.at]), reads: w.reads.map((x) => [x.what, x.at]), requests: w.sim.requests, flat: r.flat };
}

// The old code's timelines (bd24705, measured in this rig before the change; group 2, round 1: the test must pin them, not compare the new
// code with itself). Times are ms from the start; "o" an open-orders read, "p" a positions read. Both start with a full look (positions, then
// orders, orders, positions) and only then the plain half second (280 -> 850).
const OLD = {
  all: { requests: 27, reads: [["p", 70], ["o", 140], ["o", 210], ["p", 280], ["o", 850], ["p", 920], ["p", 990], ["o", 1060], ["p", 1130], ["p", 2200], ["o", 2270], ["o", 2340], ["p", 2410], ["o", 2730], ["p", 2800], ["p", 2870], ["p", 3940]], sells: [["AAA", 4, 1130], ["BBB", 3, 1130]] },
  retry: { requests: 29, reads: [["p", 70], ["o", 140], ["o", 210], ["p", 280], ["o", 850], ["p", 920], ["p", 990], ["o", 1060], ["p", 1130], ["p", 2200], ["o", 2270], ["o", 2340], ["p", 2410], ["o", 2980], ["p", 3050], ["p", 3120], ["p", 4190]], sells: [["AAA", 4, 1130]] },
};

test("item 2: close-outs unchanged: a whole-account sale and a close-out retry of named symbols never ask for the confirmation, and read, pause and sell at exactly the old code's moments, with or without it", async () => {
  for (const shape of ["all", "retry"] as const) {
    for (const withStub of [false, true]) {
      const r = await closeoutRun(withStub, shape);
      const label = `${shape}, ${withStub ? "with" : "without"} the confirmation`;
      assert.deepEqual(r.calls, [], `${label}: never asked`);
      assert.ok(r.flat, label);
      assert.deepEqual(r.reads.map(([w, t]) => [(w as string)[0], (t as number) - MID]), OLD[shape].reads, `${label}: the old reads at the old moments`);
      assert.deepEqual(r.sells.map(([sym, q, t]) => [sym, q, (t as number) - MID]), OLD[shape].sells, `${label}: the old sales at the old moments`);
      assert.equal(r.requests, OLD[shape].requests, label);
    }
  }
});

test("item 2 (group 1, round 1, finding 1): a timed-out stop's try (waitCancelMs 500, one round) keeps its one look after the pause, confirmed early or not, so it stays inside its request reservation", async () => {
  const run = async (end: PauseEnd) => {
    const w = world(async (_ids, m) => (w.sim.advance(end === "confirmed" ? 20 : m), end));
    await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
    const id = await hold(w, "LUNR", 5, 12, 1);
    w.sim.cancelMs = 700; // Alpaca's cancel lands after the pause and the look
    const legs = w.sim.orders.find((o) => o.clientOrderId === id)!.legs.map((l) => l.id);
    const before = w.sim.requests;
    const r0 = w.reads.length;
    await w.liquidator.flatten({ reason: "timed-out stop", tradeDate: D, only: ["LUNR"], ownEntryOnly: { maxQty: { LUNR: 5 } }, cancelIds: legs, maxRounds: 1, waitCancelMs: 500 } as any);
    return { requests: w.sim.requests - before, reads: w.reads.slice(r0).map((x) => x.what), sold: w.sim.sellLog.length };
  };
  const timer = await run("timer");
  const confirmed = await run("confirmed");
  assert.deepEqual(confirmed.reads, timer.reads, "the same looks");
  assert.equal(confirmed.requests, timer.requests, "the same requests");
  assert.equal(confirmed.sold, 0, "nothing sold while the take-profit still holds the shares");
});

test("item 2: the refused fresh stop's row carries the pause too; a stop placed by a round that cancelled nothing carries none", async () => {
  // Refused: the market sale follows, as before; its row has the pause.
  const w = world(async () => (w.sim.advance(40), "confirmed"));
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const dd = (await w.store.getDay(D))!;
  const id = await hold(w, "HDB", 4, 60, 1);
  w.sim.refuseStops = true;
  w.sim.cancelMs = 30;
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 60.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(w.events.find((e) => e.event === "fresh_stop_refused")!.data.times.pause, { ms: 40, endedBy: "confirmed" });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["HDB", 3]]);
  // Nothing to cancel (the exits already ended): no pause, so no `pause` on the stop's times.
  const v = world(async () => "confirmed");
  await ensureDay({ store: v.store, broker: v.sim, now: v.now }, D);
  const id2 = await hold(v, "LUNR", 5, 12, 1);
  for (const l of v.sim.orders.find((o) => o.clientOrderId === id2)!.legs) await v.sim.cancelOrder(l.id);
  v.sim.advance(1_000);
  const r = await v.liquidator.flatten({ reason: "fresh stop", tradeDate: D, only: ["LUNR"], ownEntryOnly: { maxQty: { LUNR: 5 } }, cancelIds: [], protectWithStop: { LUNR: 11.87 }, maxRounds: 1 } as any);
  assert.ok(r.freshStop?.times, "the stop is placed with its times");
  assert.equal("pause" in r.freshStop!.times!, false);
});

test("item 2: a real watcher through a sale: the take-profit rest's live cancel arriving with Alpaca's answer means no pause; a cancel of another order on the symbol means the full half second", async () => {
  for (const exact of [true, false]) {
    let cs: CancelSeen | null = null;
    let w: World | null = null;
    w = world((ids, m) => cs!.wait(ids, m));
    const ww = w;
    cs = new CancelSeen({ now: () => ww.sim.simMs, live: () => true, sleep: ww.sim.sleep });
    const co = ww.sim.cancelOrder.bind(ww.sim);
    (ww.sim as any).cancelOrder = async (oid: string) => {
      const r = await co(oid);
      cs!.note({ event: "canceled", order: { id: exact ? oid : `${oid}-other`, symbol: "SNDK" } as any, positionQty: null, atMs: ww.sim.simMs });
      return r;
    };
    await ensureDay({ store: ww.store, broker: ww.sim, now: ww.now }, D);
    const dd = (await ww.store.getDay(D))!;
    const id = await hold(ww, "SNDK", 3, 94.06, 1);
    ww.sim.advance(5_000);
    ww.sim.partialTakeProfit(id, 1, 94.14);
    ww.sim.cancelMs = 30;
    ww.sim.advance(300);
    await syncOrders(ww.risk, dd, { protect: true });
    const t = ww.events.find((e) => e.event === "fresh_stop")!.data.times;
    assert.deepEqual(t.pause, exact ? { ms: 0, endedBy: "confirmed" } : { ms: 500, endedBy: "timer" });
    assert.deepEqual(ww.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SNDK", 2]]);
  }
});

// ---- the exact-id watcher (src/cancel-seen.ts) ----

function seen(opts: { live?: boolean } = {}) {
  let t = 1_000;
  const timers: Array<{ at: number; fire: () => void }> = [];
  const live = { on: opts.live ?? true };
  const cs = new CancelSeen({
    now: () => t,
    live: () => live.on,
    sleep: (m) => new Promise<void>((r) => void timers.push({ at: t + m, fire: r })),
  });
  const advance = async (m: number) => {
    t += m;
    for (const x of [...timers]) if (x.at <= t) {
      timers.splice(timers.indexOf(x), 1);
      x.fire();
    }
    await new Promise((r) => setImmediate(r));
  };
  const up = (event: string, id: string, symbol = "SNDK") => cs.note({ event, order: { id, symbol } as any, positionQty: null, atMs: t });
  return { cs, advance, up, live, now: () => t };
}

test("cancel-seen: a confirmation already seen ends the wait at once; one arriving mid-wait ends it then", async () => {
  const s = seen();
  s.up("canceled", "tp1");
  assert.equal(await s.cs.wait(["tp1"], 500), "confirmed");
  let got: PauseEnd | null = null;
  void s.cs.wait(["tp2"], 500).then((v) => (got = v));
  await s.advance(60);
  assert.equal(got, null);
  s.up("canceled", "tp2");
  await s.advance(0);
  assert.equal(got, "confirmed");
  assert.equal(s.cs.size().waiting, 0);
});

test("cancel-seen: only a `canceled` update for that exact id counts: not pending_cancel, not a fill or partial fill, not another order of the same symbol", async () => {
  const s = seen();
  let got: PauseEnd | null = null;
  void s.cs.wait(["tp1"], 500).then((v) => (got = v));
  s.up("pending_cancel", "tp1");
  s.up("partial_fill", "tp1");
  s.up("fill", "tp1");
  s.up("canceled", "tp9"); // same symbol, another order
  s.up("canceled", "stop1");
  await s.advance(499);
  assert.equal(got, null);
  await s.advance(1);
  assert.equal(got, "timer");
  assert.equal(s.cs.size().waiting, 0);
});

test("cancel-seen: with two ids, one confirmed is not enough: the full wait", async () => {
  const s = seen();
  let got: PauseEnd | null = null;
  void s.cs.wait(["tp1", "stop1"], 500).then((v) => (got = v));
  s.up("canceled", "tp1");
  await s.advance(500);
  assert.equal(got, "timer");
  // A stop leg Alpaca cancelled shortly before (its update came before the sale) counts.
  s.up("canceled", "stop2");
  await s.advance(1_000);
  s.up("canceled", "tp2");
  assert.equal(await s.cs.wait(["tp2", "stop2"], 500), "confirmed");
});

test("cancel-seen: live updates not connected: a plain pause of the full time, even with the ids already seen", async () => {
  const s = seen();
  s.up("canceled", "tp1");
  s.live.on = false;
  let got: PauseEnd | null = null;
  void s.cs.wait(["tp1"], 500).then((v) => (got = v));
  await s.advance(499);
  assert.equal(got, null);
  await s.advance(1);
  assert.equal(got, "not_live");
});

test("cancel-seen: memory bounded: a confirmation older than 60 s no longer counts, and at most 2,000 ids are kept (oldest dropped first); an empty list never confirms", async () => {
  const s = seen();
  s.up("canceled", "old");
  await s.advance(CANCEL_SEEN_MEMORY_MS + 1);
  let got: PauseEnd | null = null;
  void s.cs.wait(["old"], 500).then((v) => (got = v));
  await s.advance(500);
  assert.equal(got, "timer");
  for (let i = 0; i <= CANCEL_SEEN_MAX; i++) s.up("canceled", `id${i}`);
  assert.equal(s.cs.size().seen, CANCEL_SEEN_MAX);
  let first: PauseEnd | null = null;
  void s.cs.wait(["id0"], 10).then((v) => (first = v));
  await s.advance(10);
  assert.equal(first, "timer", "the oldest was dropped");
  assert.equal(await s.cs.wait([`id${CANCEL_SEEN_MAX}`], 10), "confirmed");
  let empty: PauseEnd | null = null;
  void s.cs.wait([], 10).then((v) => (empty = v));
  await s.advance(10);
  assert.equal(empty, "timer");
});

test("cancel-seen: a malformed update never throws", () => {
  const s = seen();
  assert.doesNotThrow(() => s.cs.note({ event: "canceled", order: undefined as any, positionQty: null, atMs: null }));
  assert.doesNotThrow(() => s.cs.note(undefined as any));
});

test("item 2: the worker feeds every live update to the watcher and gives the sell path its wait", async () => {
  const { rig } = await import("./rig.ts");
  const r = rig({ orderStream: true });
  const wk: any = r.worker;
  const asked: Array<[string[], number]> = [];
  wk.cancelSeen.wait = (ids: string[], m: number) => (asked.push([ids, m]), Promise.resolve("timer"));
  assert.equal(await wk.liquidator.d.waitCancelled(["tp-1"], 500), "timer");
  assert.deepEqual(asked, [[["tp-1"], 500]], "the sell path's wait is the watcher's");
  wk.afterOrderUpdate({ event: "canceled", order: { id: "tp-x", symbol: "LUNR", side: "sell", clientOrderId: "c1", filledQty: 0 }, positionQty: null, atMs: null });
  wk.afterOrderUpdate({ event: "fill", order: { id: "tp-y", symbol: "LUNR", side: "sell", clientOrderId: "c2", filledQty: 1 }, positionQty: null, atMs: null, fillQty: 1, price: 1 });
  assert.equal(wk.cancelSeen.size().seen, 1, "only the cancel is remembered");
});
