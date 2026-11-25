// Michael's decision 3 of 2026-11-25 (builds/build-c2-log.md, "Michael's decisions from Wednesday's mid-day review"): "When an exit pair's
// stop leg triggers and fills, that exit is correct. Fix how the stack reads it: recognise the pair as closed by its stop, with no false gap
// logged and no extra sale attempted. Group 1 review."
//
// What Alpaca did on 2026-11-25 (its order records, five pairs): when the pair's stop leg triggered, Alpaca cancelled the pair's limit (its
// parent) FIRST, and the stop leg showed submitted 7 to 147 ms later; the leg then filled 0.33 to 3.95 s after the parent's cancel, in one
// to three pieces. AMBA-3 (8:37:56) and NTNX-36 (9:32:18) were read as unprotected positions (`fresh_stop_gone`, `unprotected_position`,
// AMBA's `late_notice` "gap began", a blocked sale, `remainder_recount` sold 0). The simulator's `triggerPairStop` fills the leg at once and
// then cancels the parent, the reverse order, so the staged helper below follows Alpaca's order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { PAIR_STOP_EXIT, PAIR_STOP_EXIT_MAX_MS, PAIR_STOP_LEG_WORKING, SyncMemory, notePairBroken, notePairStopLegUpdate, syncOrders } from "../src/risk.ts";
import { STORED_INFO_EVENTS } from "../src/run-log.ts";
import { MemoryStore, setPhase } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { EXIT_PAIR_PHASE } from "../src/exit-pair.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day, in the session
const READ_MS = 70;

function world(opts: { liveWake?: boolean } = {}) {
  const sim = new SimBroker(MID);
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, o?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: o?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  // Staged events at fixed simulated times (Alpaca's own timeline, run as the simulated clock passes them, also inside a sale's waits).
  const plan: Array<{ at: number; fn: () => void }> = [];
  const adv = sim.advance.bind(sim);
  (sim as any).advance = (ms: number) => {
    const end = sim.simMs + Math.max(0, ms);
    for (;;) {
      const due = plan.filter((p) => p.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      plan.splice(plan.indexOf(due), 1);
      if (due.at > sim.simMs) adv(due.at - sim.simMs);
      due.fn();
    }
    if (end > sim.simMs) adv(end - sim.simMs);
  };
  const lo = sim.listOrdersPaged.bind(sim);
  const lp = sim.listPositions.bind(sim);
  let readsOn = false;
  (sim as any).listOrdersPaged = async (...a: any[]) => (readsOn && sim.advance(READ_MS), (lo as any)(...a));
  (sim as any).listPositions = async () => (readsOn && sim.advance(READ_MS), lp());
  const at = (msFromNow: number, fn: () => void) => void plan.push({ at: sim.simMs + msFromNow, fn });
  // With `liveWake`: what the worker does on Alpaca's live update for a pair's stop leg (worker.ts afterOrderUpdate): it records it on the pair
  // (notePairStopLegUpdate, the real function) and asks for a look at once (`wakeAt`, run by followUp).
  const wake = { at: null as number | null, entries: [] as string[] };
  if (opts.liveWake) {
    sim.onOrderEvent = (event, o, atMs) => {
      if (o.side !== "sell") return;
      const leg = notePairStopLegUpdate(memory, { orderId: o.id, event, filledQty: o.filledQty, atMs }, sim.simMs);
      if (!leg) return;
      if (leg.log) log("exit_pair_stop_exit", leg.log);
      memory.mustLook.add(leg.entry);
      wake.entries.push(leg.entry);
      if (wake.at === null) wake.at = sim.simMs;
    };
  }
  return { sim, events, said, store, now, risk, memory, liquidator, plan, at, wake, reads: (on: boolean) => void (readsOn = on) };
}
type World = ReturnType<typeof world>;

async function day(w: World) {
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  await setPhase(w.store, D, EXIT_PAIR_PHASE, "on");
  return (await w.store.getDay(D))!;
}
async function hold(w: World, symbol: string, qty: number, price: number, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}
// A remainder of `left` shares protected by its exit pair (the take-profit filled the rest; Alpaca cancelled the bracket's stop).
async function pairRemainder(w: World, dd: Awaited<ReturnType<typeof day>>, symbol: string, qty: number, left: number, price: number, n: number) {
  const id = await hold(w, symbol, qty, price, n);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, qty - left, price + 0.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const f = w.memory.freshStops.get(id)!;
  assert.ok(f && f.takeProfitPrice !== undefined, "the exit pair placed");
  return { id, f };
}
const pairOf = (w: World, symbol: string) => w.sim.orders.find((o) => o.symbol === symbol && o.side === "sell" && o.orderClass === "oco" && o.type === "limit")!;
const legOf = (w: World, symbol: string) => pairOf(w, symbol).legs[0]!;
const ev = (w: World, name: string) => w.events.filter((e) => e.event === name);
const S = (w: World) => w.sim as any;

// Alpaca's order on 2026-11-25: the pair's limit (parent) cancelled by Alpaca, its stop leg submitted `legAfterMs` later, then its fills
// (`fills`: [ms after the parent's cancel, shares]). The live update of the parent's cancel reaches the worker as on that day.
function stageStopExit(w: World, symbol: string, legAfterMs: number, fills: Array<[number, number]>) {
  const p = pairOf(w, symbol);
  const leg = p.legs[0]!;
  S(w).setStatus(p.id, "canceled"); // Alpaca cancels the limit as the stop triggers
  w.at(legAfterMs, () => {
    leg.status = "new"; // the triggered stop, working at Alpaca
    leg.updatedAt = new Date(w.sim.simMs).toISOString();
  });
  let done = 0;
  for (const [ms, q] of fills) {
    w.at(ms, () => {
      done += q;
      leg.filledQty = done;
      leg.filledAvgPrice = leg.stopPrice;
      leg.status = done >= leg.qty - 1e-9 ? "filled" : "partially_filled";
      if (leg.status === "filled") leg.filledAt = new Date(w.sim.simMs).toISOString();
      S(w).removeShares(symbol, q, leg.stopPrice ?? 0);
      w.sim.onOrderEvent?.(leg.status === "filled" ? "fill" : "partial_fill", structuredClone(leg), w.sim.simMs);
    });
  }
  return { p, leg };
}


const GAP_ROWS = ["fresh_stop_gone", "unprotected_position", "late_notice", "sale_blocked", "remainder_recount", "missing_exit_sale_checks", "exit_pair_rest_cancel", "exit_pair_sale_start", "unprotected_position_already_gone"];
const gapRows = (w: World) => w.events.filter((e) => GAP_ROWS.includes(e.event)).map((e) => e.event);
// Every look the stack asks for (the order sync's `recheckAt`), run when it falls due, until none is asked for or `untilMs` passes.
async function followUp(w: World, dd: Awaited<ReturnType<typeof day>>, first: { recheckAt?: number }, untilMs: number, opts: { streamLive?: boolean } = {}) {
  const looksAt: number[] = [];
  let r = first;
  w.wake.at = null; // a wake asked for during the first look is served by it (as the loop does for a look already running)
  for (let i = 0; i < 60; i++) {
    // The next look: the earlier of the recheck asked for and a live wake (staged events are run in time order on the way).
    // A protection recheck (`recheckAt`) or a list-lag recheck (the window's rechecks since round 2: `lagRecheck`, within its own window).
    const lag = w.memory.lagRecheck && w.memory.lagRecheck.dueAt <= w.memory.lagRecheck.until ? w.memory.lagRecheck.dueAt : undefined;
    const due = [r.recheckAt, lag].filter((x): x is number => x !== undefined && x <= untilMs);
    const recheck = due.length > 0 ? Math.min(...due) : null;
    let next: number | null = recheck;
    for (;;) {
      if (w.wake.at !== null) break;
      const staged = w.plan.map((p) => p.at).filter((a) => a > w.sim.simMs && (next === null || a <= next)).sort((a, b) => a - b)[0];
      if (staged === undefined) break;
      w.sim.advance(staged - w.sim.simMs);
    }
    if (w.wake.at !== null) next = w.sim.simMs;
    if (next === null) break;
    if (next > w.sim.simMs) w.sim.advance(next - w.sim.simMs);
    w.wake.at = null;
    looksAt.push(w.sim.simMs);
    r = await syncOrders(w.risk, dd, { protect: true, ...opts });
  }
  return looksAt;
}

// AMBA-3 at 8:37:56 on 2026-11-25: a 2-share pair; Alpaca cancelled its limit at 56.755, showed the stop leg submitted 28 ms later; the look
// the live update woke ended its reads 626 ms after the cancel (the shares still held); the leg filled 1 at +856 ms and 1 at +2,538 ms.
async function amba3(on = true) {
  const was = PAIR_STOP_EXIT.on;
  PAIR_STOP_EXIT.on = on;
  try {
    const w = world();
    const dd = await day(w);
    const { id, f } = await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
    w.sim.advance(10_000);
    w.reads(true);
    const t0 = w.sim.simMs;
    stageStopExit(w, "AMBA", 28, [[856, 1], [2_538, 1]]);
    w.sim.advance(626 - 2 * READ_MS);
    const r = await syncOrders(w.risk, dd, { protect: true });
    const looksAt = await followUp(w, dd, r, t0 + 15_000);
    w.sim.advance(Math.max(0, t0 + 15_000 - w.sim.simMs));
    await syncOrders(w.risk, dd, { protect: true }); // the regular sync after
    return { w, id, f, t0, looksAt };
  } finally {
    PAIR_STOP_EXIT.on = was;
  }
}

test("decision 3 of 2026-11-25, AMBA-3's sequence: the pair is read as closed by its own stop: no fresh_stop_gone, no unprotected_position, no late_notice, no blocked or attempted sale; one exit_pair_stop_exit row; the entry closes once the stop has sold the shares", async () => {
  const { w, id, f, t0, looksAt } = await amba3();
  assert.deepEqual(gapRows(w), [], "no row of a gap and no sale");
  assert.equal(w.sim.sellLog.length, 0, "no extra sale attempted");
  const rows = ev(w, "exit_pair_stop_exit");
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0]!.data.clientOrderId, rows[0]!.data.pairClientOrderId, rows[0]!.data.legStatus, rows[0]!.data.legFilledQty, rows[0]!.data.held], [id, f.stopClientOrderId, "new", 0, 2]);
  assert.equal(rows[0]!.data.stopLegId, legOf(w, "AMBA").id, "keyed on the pair's own stop leg");
  assert.equal(rows[0]!.data.msFromLimitCancel, 626);
  assert.deepEqual(looksAt.map((x) => x - t0), [1_126, 2_266, 3_406], "looked at again 0.5 s, then every second (timed from the end of each look's reads, 140 ms here), until the shares were gone");
  assert.equal(ev(w, "exit_pair_stop_exit_timeout").length, 0);
  assert.ok((await w.store.listOrders(D)).find((r) => r.clientOrderId === id)!.closedAt, "the entry closed (its shares are gone)");
  assert.equal(w.memory.freshStops.has(id), false);
  assert.equal(w.said.filter((m) => m.mention).length, 0, "no alert");
});

test("decision 3: the code before the fix (the switch off) produced this morning's rows for the same sequence: fresh_stop_gone, unprotected_position, the late_notice 'gap began', a blocked sale, remainder_recount sold 0", async () => {
  const { w } = await amba3(false);
  const rows = gapRows(w);
  for (const e of ["fresh_stop_gone", "unprotected_position", "late_notice", "sale_blocked", "remainder_recount"]) assert.ok(rows.includes(e), e);
  assert.match(ev(w, "late_notice")[0]!.data.label, /^fresh stop ended \(canceled\): the gap began at its end/);
  assert.equal(ev(w, "remainder_recount")[0]!.data.sold, 0);
  assert.equal(w.sim.sellLog.length, 0, "the gate refused it then too");
  assert.equal(ev(w, "exit_pair_stop_exit").length, 0);
});

test("decision 3, NTNX-36's sequence (9:32:18): a 1-share pair, the leg submitted 14 ms after the limit's cancel, the look 336 ms after, the fill at 514 ms: quiet, and the next look closes the entry", async () => {
  const w = world();
  const dd = await day(w);
  const { id } = await pairRemainder(w, dd, "NTNX", 5, 1, 44.84, 36);
  w.sim.advance(90_000);
  w.reads(true);
  const t0 = w.sim.simMs;
  stageStopExit(w, "NTNX", 14, [[514, 1]]);
  w.sim.advance(336 - 2 * READ_MS);
  const r = await syncOrders(w.risk, dd, { protect: true });
  const looksAt = await followUp(w, dd, r, t0 + 12_000);
  assert.deepEqual(gapRows(w), []);
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(ev(w, "exit_pair_stop_exit").length, 1);
  assert.deepEqual(looksAt.map((x) => x - t0), [836], "one look 0.5 s later found the share gone");
  assert.ok((await w.store.listOrders(D)).find((r) => r.clientOrderId === id)!.closedAt);
});

// ---------------------------------------------- everything else keeps today's path --------------------------------------------------
// Run the same scenario with the switch on and off (off is the code before the fix): the requests, the sales and the rows must match.
async function both(scn: (w: World, dd: Awaited<ReturnType<typeof day>>) => Promise<void>) {
  const out: Array<{ w: World; calls: string[] }> = [];
  for (const on of [true, false]) {
    const was = PAIR_STOP_EXIT.on;
    PAIR_STOP_EXIT.on = on;
    try {
      const w = world();
      const dd = await day(w);
      const calls: string[] = [];
      for (const m of ["cancelOrder", "submitSell", "findOrderByClientId", "getOrderById"]) {
        const f0 = (w.sim as any)[m].bind(w.sim);
        (w.sim as any)[m] = async (...a: any[]) => (calls.push(`${m}@${w.sim.simMs}`), f0(...a));
      }
      await scn(w, dd);
      out.push({ w, calls });
    } finally {
      PAIR_STOP_EXIT.on = was;
    }
  }
  const [a, b] = out as [{ w: World; calls: string[] }, { w: World; calls: string[] }];
  const strip = (w: World) => w.events.map((e) => [e.event, JSON.stringify(e.data)]);
  assert.deepEqual(a.calls, b.calls, "the same requests at the same times as before the fix");
  assert.deepEqual(a.w.sim.sellLog, b.w.sim.sellLog);
  assert.deepEqual(strip(a.w), strip(b.w), "the same rows");
  return a.w;
}

test("decision 3, negative: the limit cancelled and the pair's own stop leg ended too (cancelled, expired), shares still held: sold exactly as today", async () => {
  for (const end of ["canceled", "expired"] as const) {
    const w = await both(async (w, dd) => {
      await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
      w.sim.advance(10_000);
      const p = pairOf(w, "QXO");
      (w.sim as any).setStatus(p.id, "canceled");
      p.legs[0]!.status = end;
      w.sim.advance(300);
      await syncOrders(w.risk, dd, { protect: true });
      w.sim.advance(3_000);
    });
    assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["QXO", 4]], `${end}: sold at market, as today`);
    assert.ok(gapRows(w).includes("unprotected_position"), end);
    assert.equal(ev(w, "exit_pair_stop_exit").length, 0, end);
  }
});

test("decision 3, the leg shown untriggered ('held', what a lagging list shows for a leg Alpaca already cancelled): today's path at once while PAIR_STOP_LEG_WORKING leaves 'held' out (Michael's question 2); read as a stop exit if it is added", async () => {
  if (PAIR_STOP_LEG_WORKING.has("held")) {
    const w = world();
    const dd = await day(w);
    await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
    w.sim.advance(10_000);
    (w.sim as any).setStatus(pairOf(w, "QXO").id, "canceled");
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    assert.equal(ev(w, "exit_pair_stop_exit").length, 1);
    assert.deepEqual(gapRows(w), []);
    return;
  }
  const w = await both(async (w, dd) => {
    await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
    w.sim.advance(10_000);
    const p = pairOf(w, "QXO");
    (w.sim as any).setStatus(p.id, "canceled"); // the leg stays "held" in the list
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    w.sim.advance(3_000);
  });
  assert.ok(gapRows(w).includes("unprotected_position"));
  assert.equal(ev(w, "exit_pair_stop_exit").length, 0);
});

test("decision 3, negative: the stop leg still working when the time limit runs out: exit_pair_stop_exit_timeout, then today's path (the rows of an unprotected position and its sale, which the working leg blocks)", async () => {
  const w = world();
  const dd = await day(w);
  const { id } = await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
  w.sim.advance(10_000);
  const t0 = w.sim.simMs;
  stageStopExit(w, "AMBA", 28, []); // triggered, never fills (Alpaca holds it)
  w.sim.advance(300);
  const r = await syncOrders(w.risk, dd, { protect: true });
  const looksAt = await followUp(w, dd, r, t0 + 300 + PAIR_STOP_EXIT_MAX_MS);
  assert.equal(PAIR_STOP_EXIT_MAX_MS, 10_000);
  assert.deepEqual(looksAt.map((x) => x - t0 - 300), [500, 1_500, 2_500, 3_500, 4_500, 5_500, 6_500, 7_500, 8_500, 9_500, 10_000], "the looks inside the limit (0.5 s, then every second), the last at the limit");
  const to = ev(w, "exit_pair_stop_exit_timeout");
  assert.equal(to.length, 1);
  assert.deepEqual([to[0]!.data.clientOrderId, to[0]!.data.msFromFirstSeen, to[0]!.data.legStatus], [id, PAIR_STOP_EXIT_MAX_MS, "new"]);
  const after = gapRows(w);
  assert.ok(after.includes("fresh_stop_gone") && after.includes("unprotected_position") && after.includes("sale_blocked"), "today's path ran at the limit");
  assert.ok(w.events.findIndex((e) => e.event === "exit_pair_stop_exit_timeout") < w.events.findIndex((e) => e.event === "unprotected_position"));
  assert.equal(w.sim.sellLog.length, 0, "the working leg holds the shares: the gate refuses, as on AMBA-3");
});

test("decision 3, negative: a stop leg that is not this pair's own does not count (another id under the pair, or another entry's pair on the symbol)", async () => {
  // (a) The leg listed under the pair is not the one recorded for it: today's path.
  const a = await both(async (w, dd) => {
    const { f } = await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
    w.sim.advance(10_000);
    await syncOrders(w.risk, dd, { protect: true }); // a look while the pair is open records its own stop leg's id
    assert.equal(f.stopLegId, legOf(w, "QXO").id);
    const p = pairOf(w, "QXO");
    (w.sim as any).setStatus(p.id, "canceled");
    p.legs[0]!.status = "canceled";
    p.legs.unshift({ ...structuredClone(p.legs[0]!), id: "another-leg", status: "new" }); // a triggered stop that is not its own, listed first
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    w.sim.advance(3_000);
  });
  assert.ok(gapRows(a).includes("unprotected_position"));
  assert.equal(ev(a, "exit_pair_stop_exit").length, 0);
  // (b) An older entry's pair on the symbol (its limit cancelled, its leg triggered) while this pair's own limit and leg are cancelled.
  const b = await both(async (w, dd) => {
    await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
    const p = pairOf(w, "QXO");
    const other = structuredClone(p);
    other.id = "older-pair";
    other.clientOrderId = "cyrus-p-20261102-QXO-older-s1";
    other.status = "canceled";
    other.legs = [{ ...structuredClone(p.legs[0]!), id: "older-leg", status: "new" }];
    w.sim.orders.unshift(other);
    w.sim.advance(10_000);
    (w.sim as any).setStatus(p.id, "canceled");
    p.legs[0]!.status = "canceled";
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    w.sim.advance(3_000);
  });
  assert.ok(gapRows(b).includes("unprotected_position"));
  assert.equal(ev(b, "exit_pair_stop_exit").length, 0);
});

test("decision 3, negative: a pair the stack cancelled itself (remembered broken, or a timed-out stop) is never read as closed by its stop", async () => {
  for (const how of ["broken", "timed out"] as const) {
    const w = await both(async (w, dd) => {
      const { id, f } = await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
      w.sim.advance(10_000);
      // As the worker does on a pair seen broken (its take-profit filled part): sticky on the entry's record and remembered by the pair's id.
      if (how === "broken") (f.pairBroken = true, notePairBroken(w.memory, f.stopClientOrderId, { orderId: f.orderId, symbol: "QXO", nowMs: w.sim.simMs, entry: id }));
      else w.memory.timedOutStops.set(f.stopClientOrderId, id);
      const p = pairOf(w, "QXO");
      (w.sim as any).setStatus(p.id, "canceled");
      p.legs[0]!.status = "new";
      w.sim.advance(300);
      await syncOrders(w.risk, dd, { protect: true });
      w.sim.advance(3_000);
    });
    assert.equal(ev(w, "exit_pair_stop_exit").length, 0, how);
  }
});

test("decision 3, negative: more shares held than the pair protects: today's path", async () => {
  const w = await both(async (w, dd) => {
    await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
    w.sim.advance(10_000);
    stageStopExit(w, "QXO", 28, []);
    (w.sim as any).positionsMap.get("QXO").qty += 2; // 6 held, the pair covers 4
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    w.sim.advance(3_000);
  });
  assert.equal(ev(w, "exit_pair_stop_exit").length, 0);
  assert.ok(gapRows(w).includes("unprotected_position"));
});

test("decision 3: the worker's live update of the pair's limit cancelled only records it and wakes the entry (no sale, no gap row); the rows are stored in the run log", async () => {
  const { rig } = await import("./rig.ts");
  const r = rig({ orderStream: true });
  const wk: any = r.worker;
  wk.startOrderStream(D);
  const woke: string[] = [];
  wk.loop.wake = (id: string) => void woke.push(id);
  const entry = "cyrus-20261102-AMBA-3";
  wk.syncMemory.freshStops.set(entry, { symbol: "AMBA", entryClientOrderId: entry, stopClientOrderId: "cyrus-p-20261102-AMBA-x-s1", orderId: "p1", qty: 2, stopPrice: 33.04, placedAt: 0, status: "accepted", lookedAt: 0, takeProfitPrice: 33.26 });
  wk.orderHandler.d.onFreshStopUpdate({ clientOrderId: "cyrus-p-20261102-AMBA-x-s1", symbol: "AMBA", event: "canceled", status: "canceled", atMs: wk.d.now().getTime() });
  assert.deepEqual(woke, [entry], "the entry is looked at at once (the look decides)");
  assert.equal(wk.syncMemory.freshStops.get(entry).status, "canceled");
  assert.ok(STORED_INFO_EVENTS.has("exit_pair_stop_exit") && STORED_INFO_EVENTS.has("exit_pair_stop_exit_timeout"));
});

test("decision 3, negative: the pair's limit ended another way (expired) while its leg shows working: today's path (only Alpaca's cancel of the limit counts)", async () => {
  const w = await both(async (w, dd) => {
    await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
    w.sim.advance(10_000);
    const p = pairOf(w, "QXO");
    p.status = "expired";
    p.legs[0]!.status = "new";
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    w.sim.advance(3_000);
  });
  assert.equal(ev(w, "exit_pair_stop_exit").length, 0);
  assert.ok(gapRows(w).includes("unprotected_position"));
});

// ------------------------------------------- the worker's mode: the live updates connected ----------------------------------------

test("decision 3, with the live updates connected and an entry older than the order list (11 minutes): every look in the window reaches it (looked up by its id), and today's path starts at the time limit", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "AMBA", 7, 33.17, 3);
  w.sim.advance(11 * 60_000);
  w.sim.partialTakeProfit(id, 5, 33.25);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true }); // an old entry: looked up, the pair placed
  assert.ok(w.memory.freshStops.get(id)?.takeProfitPrice !== undefined, "the pair placed");
  w.sim.advance(31_000); // past the entry's periodic lookup (every 30 s), so the first look reaches it as a sync would
  const lookups: number[] = [];
  const f0 = (w.sim as any).findOrderByClientId.bind(w.sim);
  (w.sim as any).findOrderByClientId = async (cid: string) => (cid === id && lookups.push(w.sim.simMs), f0(cid));
  const t0 = w.sim.simMs;
  stageStopExit(w, "AMBA", 28, []); // triggered, never fills
  w.sim.advance(300);
  const r = await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.equal(ev(w, "exit_pair_stop_exit").length, 1, "recognised at the first look");
  const looksAt = await followUp(w, dd, r, t0 + 300 + PAIR_STOP_EXIT_MAX_MS, { streamLive: true });
  assert.equal(looksAt.length, 11);
  assert.ok(looksAt.every((t) => lookups.includes(t)), "each look looked the old entry up by its id");
  assert.equal(ev(w, "exit_pair_stop_exit_timeout").length, 1, "the time limit ran out at the last look");
  assert.ok(gapRows(w).includes("unprotected_position"), "today's path then ran");
});

// ------------------------------------- pinned to the code before the fix (literals from abf7c0f) -----------------------------------
// The requests after the event (time from it), the sales and the rows, as the code before this change produced them in the same scenarios.
function record(w: World) {
  let t0 = 0;
  const calls: string[] = [];
  for (const m of ["cancelOrder", "submitSell", "findOrderByClientId", "getOrderById"]) {
    const f0 = (w.sim as any)[m].bind(w.sim);
    (w.sim as any)[m] = async (...a: any[]) => (t0 > 0 && calls.push(`${m}@${w.sim.simMs - t0}`), f0(...a));
  }
  return { calls, mark: () => void (t0 = w.sim.simMs) };
}
const rowsOf = (w: World) => w.events.map((e) => e.event).filter((e) => !["startup_protection_check", "bare_remainder", "fresh_stop", "liquidation_result", "sync_slow", "missing_exit_sale_checks"].includes(e));

test("decision 3, pinned: the pair's own stop leg ended too (cancelled, expired): the same requests, sale and rows as the code before the fix", async () => {
  for (const end of ["canceled", "expired"]) {
    const w = world();
    const dd = await day(w);
    const rec = record(w);
    await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
    w.sim.advance(10_000);
    rec.mark();
    const p = pairOf(w, "QXO");
    (w.sim as any).setStatus(p.id, "canceled");
    p.legs[0]!.status = end;
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    w.sim.advance(3_000);
    assert.deepEqual(rec.calls, ["findOrderByClientId@300", "submitSell@300"], end);
    assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["QXO", 4]], end);
    assert.deepEqual(rowsOf(w), ["fresh_stop_gone", "unprotected_position", "late_notice"], end);
  }
});

test("decision 3, pinned: the leg shown untriggered ('held'): the same requests and rows as the code before the fix (while PAIR_STOP_LEG_WORKING leaves 'held' out)", async () => {
  if (PAIR_STOP_LEG_WORKING.has("held")) return; // counted: the test above checks the stop exit instead
  const w = world();
  const dd = await day(w);
  const rec = record(w);
  await pairRemainder(w, dd, "QXO", 10, 4, 13.5, 11);
  w.sim.advance(10_000);
  rec.mark();
  (w.sim as any).setStatus(pairOf(w, "QXO").id, "canceled");
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(3_000);
  assert.deepEqual(rec.calls, ["findOrderByClientId@300", "findOrderByClientId@300"]);
  assert.deepEqual(w.sim.sellLog, []);
  assert.deepEqual(rowsOf(w), ["fresh_stop_gone", "unprotected_position", "late_notice", "sale_blocked", "sale_blocked", "sale_blocked"]);
});

test("decision 3, residual (not changed): the shares gone within 10 s of the entry's fill: the look cannot yet close the entry, so it is read as before (unprotected_position, then a sale that finds nothing), as the code before the fix did", async () => {
  const w = world();
  const dd = await day(w);
  const rec = record(w);
  const id = await hold(w, "QXO", 10, 13.5, 11);
  w.sim.advance(1_000);
  w.sim.partialTakeProfit(id, 6, 13.58);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(1_000);
  rec.mark();
  stageStopExit(w, "QXO", 28, [[200, 4]]);
  w.sim.advance(400);
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(3_000);
  assert.deepEqual(rec.calls, ["findOrderByClientId@400"]);
  assert.deepEqual(w.sim.sellLog, []);
  assert.deepEqual(rowsOf(w), ["unprotected_position", "unprotected_position_already_gone"]);
});

// ------------------------------------------------- the trade-off, measured (for Michael) ---------------------------------------------
// Alpaca cancels the triggered stop leg itself and the shares are left without a stop. The code before the fix had a sale running (blocked
// by the working leg) that sold as soon as its next look saw the shares free; the fix starts today's path only at its next look, and that
// sale then makes its own reads first. Simulator, 70 ms reads, a leg cancelled 0.1 to 11 s after the limit (220 runs, both list modes).
// Without the instant wake (pinned in this test, the cancel report not used): the fix sold later in 87 runs (by up to 1.36 s), earlier in 127.
// With the instant wake on Alpaca's live report (Michael's answer to question 1; the later tests): later in 33 runs (by up to 0.51 s),
// earlier in 177 (median 0.92 s earlier, at best 4.84 s), the same in 10. Each position's rechecks go 0.5 s after its first sight, then
// every second (the wait grows once, then stays at its cap).
test("decision 3, the trade-off: a triggered leg Alpaca cancels at 0.4 s is sold at 1.57 s (the code before the fix: 0.93 s); one cancelled at 3.4 s at 4.99 s (before: 7.19 s)", async () => {
  for (const [endMs, expected] of [[400, 1_570], [3_400, 4_990]] as const) {
    const w = world();
    const dd = await day(w);
    await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
    const sells: number[] = [];
    let t0 = 0;
    const f0 = (w.sim as any).submitSell.bind(w.sim);
    (w.sim as any).submitSell = async (...a: any[]) => (sells.push(w.sim.simMs - t0), f0(...a));
    w.sim.advance(10_000);
    t0 = w.sim.simMs;
    w.reads(true);
    const { leg } = stageStopExit(w, "AMBA", 28, []);
    w.at(endMs, () => (w.sim as any).setStatus(leg.id, "canceled"));
    w.sim.advance(300);
    const r = await syncOrders(w.risk, dd, { protect: true });
    await followUp(w, dd, r, t0 + 40_000);
    assert.equal(sells[0], expected, `leg cancelled at ${endMs} ms`);
  }
});

// ------------------------- Michael's answer to question 1 (2026-11-25): "add the instant wake" ---------------------------------------
// "add the instant wake, if it means the stack reacts at once to Alpaca's live report that the stop leg filled." A live update for the pair's
// own stop leg (exact Alpaca id, recorded from Alpaca's answer to the pair) is recorded on the pair and wakes the entry's look at once.

test("instant wake: the pair's stop leg id is recorded from Alpaca's answer to the pair, before any look", async () => {
  const w = world();
  const dd = await day(w);
  const { f } = await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
  assert.equal(f.stopLegId, legOf(w, "AMBA").id);
});

test("instant wake: the fill report closes it at once: a look runs at the last fill, the entry's record closes there, and no look follows", async () => {
  const w = world({ liveWake: true });
  const dd = await day(w);
  const { id } = await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
  w.sim.advance(10_000);
  w.reads(true);
  const t0 = w.sim.simMs;
  stageStopExit(w, "AMBA", 28, [[856, 1], [2_538, 1]]);
  w.sim.advance(626 - 2 * READ_MS);
  const r = await syncOrders(w.risk, dd, { protect: true });
  const looksAt = await followUp(w, dd, r, t0 + 15_000);
  assert.deepEqual(looksAt.map((x) => x - t0), [856, 1_996, 2_538], "woken at each fill report (the recheck at 1,996 between them)");
  const closed = (await w.store.listOrders(D)).find((x) => x.clientOrderId === id)!.closedAt;
  assert.equal(Date.parse(closed!) - t0, 2_538 + 2 * READ_MS, "closed by the look the last fill woke");
  assert.deepEqual(gapRows(w), []);
  assert.equal(ev(w, "exit_pair_stop_exit").length, 1, "written once");
  assert.equal(w.sim.sellLog.length, 0);
});

test("instant wake: a fill reported before any look saw the pair closing writes exit_pair_stop_exit at once (by the live update), and a look whose list still shows the leg untriggered reads it as filled", async () => {
  const w = world();
  const dd = await day(w);
  const { id, f } = await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
  w.sim.advance(10_000);
  const p = pairOf(w, "AMBA");
  (w.sim as any).setStatus(p.id, "canceled"); // the list shows the leg still "held" (lagging)
  const first = notePairStopLegUpdate(w.memory, { orderId: f.stopLegId!, event: "partial_fill", filledQty: 1, atMs: w.sim.simMs }, w.sim.simMs);
  assert.deepEqual([first?.entry, first?.kind, first?.log?.by, first?.log?.legStatus], [id, "filled", "live update", "partially_filled"]);
  assert.equal(notePairStopLegUpdate(w.memory, { orderId: f.stopLegId!, event: "fill", filledQty: 2, atMs: w.sim.simMs }, w.sim.simMs)?.log, undefined, "written once");
  w.sim.advance(100);
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(gapRows(w), [], "the live fill counts though the list shows the leg held");
  assert.equal(ev(w, "exit_pair_stop_exit").length, 0, "the look writes no second row (the worker wrote the first)");
  assert.equal(w.memory.freshStops.get(id)!.stopExitLogged, true);
});

test("instant wake: Alpaca's cancel of the triggered leg starts today's path at once: the sale goes out at 4.03 s for a cancel at 3.4 s (without the wake 4.99 s; the code before the fix 7.19 s)", async () => {
  const w = world({ liveWake: true });
  const dd = await day(w);
  await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
  const sells: number[] = [];
  let t0 = 0;
  const f0 = (w.sim as any).submitSell.bind(w.sim);
  (w.sim as any).submitSell = async (...a: any[]) => (sells.push(w.sim.simMs - t0), f0(...a));
  w.sim.advance(10_000);
  t0 = w.sim.simMs;
  w.reads(true);
  const { leg } = stageStopExit(w, "AMBA", 28, []);
  w.at(3_400, () => (w.sim as any).setStatus(leg.id, "canceled"));
  w.sim.advance(300);
  const r = await syncOrders(w.risk, dd, { protect: true });
  const looksAt = await followUp(w, dd, r, t0 + 40_000);
  assert.ok(looksAt.map((x) => x - t0).includes(3_400), "a look at the report itself, not at the next recheck");
  assert.equal(sells[0], 4_030);
  const ended = w.memory.freshStops.size === 0 || [...w.memory.freshStops.values()].every((f) => f.stopLegEnded?.event === "canceled");
  assert.ok(ended);
  assert.ok(gapRows(w).includes("unprotected_position"));
});

test("instant wake: a report for a different order id, or an event that is not a fill or an end, does nothing", async () => {
  const w = world({ liveWake: true });
  const dd = await day(w);
  const { f } = await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
  assert.equal(notePairStopLegUpdate(w.memory, { orderId: "another-order", event: "canceled", filledQty: 0, atMs: 1 }, 1), null);
  assert.equal(notePairStopLegUpdate(w.memory, { orderId: f.stopLegId!, event: "new", filledQty: 0, atMs: 1 }, 1), null);
  assert.deepEqual([f.stopLegEnded, f.stopLegFilled, f.stopExitLogged], [undefined, undefined, undefined]);
  // Another order's events on the live updates (the entry's own bracket legs, the pair's parent) wake nothing.
  const p = pairOf(w, "AMBA");
  (w.sim as any).setStatus(p.id, "canceled");
  assert.deepEqual(w.wake.entries, []);
});

test("instant wake, in the worker: one routine look per report through the protection loop; a burst of reports for the same leg makes one wake; none while a close-out owns selling; a different id none", async () => {
  const { rig } = await import("./rig.ts");
  const logs: Array<{ level: string; event: string; data: any }> = [];
  const r = rig({ orderStream: true, log: (level: string, event: string, data?: Record<string, unknown>) => void logs.push({ level, event, data }) });
  const wk: any = r.worker;
  wk.startOrderStream(D);
  const woke: string[] = [];
  const realWake = wk.loop.wake.bind(wk.loop);
  wk.loop.wake = (id: string, at: number, kind: string) => (woke.push(`${id}:${kind}`), realWake(id, at, kind));
  const entry = "cyrus-20261102-AMBA-3";
  wk.syncMemory.freshStops.set(entry, { symbol: "AMBA", entryClientOrderId: entry, stopClientOrderId: "cyrus-p-20261102-AMBA-x-s1", orderId: "p1", qty: 2, stopPrice: 33.04, placedAt: 0, status: "canceled", lookedAt: 0, takeProfitPrice: 33.26, stopLegId: "leg-1" });
  const legUpd = (event: string, filledQty: number, id = "leg-1") => ({ event, order: { id, clientOrderId: "alpaca-own-id", symbol: "AMBA", side: "sell", type: "stop", orderClass: "oco", status: event === "fill" ? "filled" : "partially_filled", qty: 2, filledQty, filledAvgPrice: 33, limitPrice: null, stopPrice: 33.04, groupId: "g-pair", legs: [], replaces: null, createdAt: null, updatedAt: null, submittedAt: null, filledAt: null, canceledAt: null } as any, positionQty: 2 - filledQty, atMs: wk.d.now().getTime() });
  wk.afterOrderUpdate(legUpd("canceled", 0, "leg-2")); // another order
  assert.deepEqual(woke, []);
  for (let i = 0; i < 5; i++) wk.afterOrderUpdate(legUpd("partial_fill", 1));
  assert.equal(woke.length, 5, "one wake asked per report");
  assert.equal([...wk.loop.pendingWakes().keys()].filter((k: string) => k === entry).length, 1, "the loop keeps one wake for the entry: one look");
  assert.equal(wk.loop.pendingWakes().get(entry).kind, "protect", "a routine look (the same kind the pair's own cancel update wakes)");
  assert.ok(wk.syncMemory.mustLook.has(entry), "looked up by its id at that look if it is older than the list");
  assert.ok(logs.some((l: any) => l.event === "exit_pair_stop_exit" && l.data.by === "live update" && l.level === "info"), "stored at level info (the run log keeps info rows of its list)");
  wk.closingOut = true;
  woke.length = 0;
  wk.afterOrderUpdate(legUpd("fill", 2));
  assert.deepEqual(woke, [], "not while a close-out owns selling");
  assert.equal(wk.syncMemory.freshStops.get(entry).stopLegFilled.filledQty, 2, "still recorded");
});

test("instant wake: a live report that the leg was cancelled vetoes the stop exit even while Alpaca's list still shows the leg working: today's path at once", async () => {
  const w = world();
  const dd = await day(w);
  const { f } = await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
  w.sim.advance(10_000);
  stageStopExit(w, "AMBA", 0, []);
  w.sim.advance(10); // the list shows the parent cancelled and the leg "new"
  assert.equal(legOf(w, "AMBA").status, "new");
  assert.equal(notePairStopLegUpdate(w.memory, { orderId: f.stopLegId!, event: "canceled", filledQty: 0, atMs: w.sim.simMs }, w.sim.simMs)?.kind, "ended");
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(ev(w, "exit_pair_stop_exit").length, 0);
  assert.ok(gapRows(w).includes("unprotected_position"));
});

// --------------------------------------------- round 2 (group 1 round 1 and group 2 round 1) ----------------------------------------
import { RequestBudget, Reservation, withReservation } from "../src/request-budget.ts";
import { ProtectionLoop } from "../src/protection.ts";

test("round 2, finding 1: a pair older than the order list's window (resting 11 minutes) is read by one budgeted lookup by its id at each look: a stop exit, no gap, no sale; the entry closes when the stop has sold", async () => {
  const w = world();
  const dd = await day(w);
  const { id, f } = await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
  w.sim.advance(11 * 60_000); // the pair rests 11 minutes: older than the sync's 10 minute order list
  const lookups: string[] = [];
  const g0 = (w.sim as any).getOrderById.bind(w.sim);
  (w.sim as any).getOrderById = async (oid: string) => (lookups.push(oid), g0(oid));
  const t0 = w.sim.simMs;
  stageStopExit(w, "AMBA", 28, [[2_000, 2]]);
  f.status = "canceled"; // what the worker's live update of the limit's cancel records (onFreshStopUpdate)
  w.memory.mustLook.add(id);
  w.sim.advance(300);
  const r = await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.equal(ev(w, "exit_pair_stop_exit").length, 1);
  assert.deepEqual(lookups, [f.orderId], "one lookup of the pair by its id");
  const looksAt = await followUp(w, dd, r, t0 + 15_000, { streamLive: true });
  assert.deepEqual(gapRows(w), []);
  assert.equal(w.sim.sellLog.length, 0);
  assert.ok(lookups.length <= 1 + looksAt.length && lookups.every((x) => x === f.orderId), "at most one per look, only the pair");
  assert.ok((await w.store.listOrders(D)).find((x) => x.clientOrderId === id)!.closedAt, "closed once the stop sold the shares");
});

test("round 2, finding 1: the old pair's lookup is a P1 try of the shared budget: with no room it is not made and today's path runs (as the code before the fix); the switch off makes no lookup either", async () => {
  for (const how of ["no room", "switch off"] as const) {
    const was = PAIR_STOP_EXIT.on;
    if (how === "switch off") PAIR_STOP_EXIT.on = false;
    try {
      const w = world();
      const dd = await day(w);
      const { id, f } = await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
      w.sim.advance(11 * 60_000);
      if (how === "no room") w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => 10 }); // below the P1 floor of 20
      const lookups: string[] = [];
      const g0 = (w.sim as any).getOrderById.bind(w.sim);
      (w.sim as any).getOrderById = async (oid: string) => (lookups.push(oid), g0(oid));
      stageStopExit(w, "AMBA", 28, []);
      f.status = "canceled";
      w.memory.mustLook.add(id);
      w.sim.advance(300);
      await syncOrders(w.risk, dd, { protect: true, streamLive: true });
      assert.deepEqual(lookups.filter((x) => x === f.orderId), [], how);
      assert.equal(ev(w, "exit_pair_stop_exit").length, 0, how);
      assert.ok(gapRows(w).includes("unprotected_position"), `${how}: today's path`);
    } finally {
      PAIR_STOP_EXIT.on = was;
    }
  }
});

test("round 2, finding 2: a live partial fill does not override a list that shows the leg cancelled (the rest cancelled, its report missed): the next look withdraws the stop exit and sells the last share at once", async () => {
  const w = world({ liveWake: true });
  const dd = await day(w);
  await pairRemainder(w, dd, "AMBA", 7, 2, 33.17, 3);
  const sells: number[] = [];
  let t0 = 0;
  const f0 = (w.sim as any).submitSell.bind(w.sim);
  (w.sim as any).submitSell = async (...a: any[]) => (sells.push(w.sim.simMs - t0), f0(...a));
  w.sim.advance(10_000);
  t0 = w.sim.simMs;
  w.reads(true);
  const { leg } = stageStopExit(w, "AMBA", 28, [[600, 1]]); // 1 of 2 filled, reported live
  w.at(1_200, () => {
    leg.status = "canceled"; // Alpaca cancels the rest; its live report is missed
    leg.canceledAt = new Date(w.sim.simMs).toISOString();
  });
  w.sim.advance(300);
  const r = await syncOrders(w.risk, dd, { protect: true });
  await followUp(w, dd, r, t0 + 20_000);
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["AMBA", 1]], "the last share sold");
  assert.ok(sells[0]! < 3_000, `sold at ${sells[0]} ms (the first look after the list showed the cancel), not at the time limit`);
  const wd = ev(w, "exit_pair_stop_exit_withdrawn");
  assert.equal(wd.length, 1);
  assert.deepEqual([wd[0]!.data.legStatus, wd[0]!.data.liveEnded], ["canceled", null]);
  assert.equal(ev(w, "exit_pair_stop_exit_timeout").length, 0);
});

test("round 2, finding 4: with the switch off a live report for the pair's stop leg records nothing, wakes nothing and writes no row (v41)", async () => {
  const was = PAIR_STOP_EXIT.on;
  PAIR_STOP_EXIT.on = false;
  try {
    const logs: Array<{ level: string; event: string }> = [];
    const { rig } = await import("./rig.ts");
    const r = rig({ orderStream: true, log: (level: string, event: string) => void logs.push({ level, event }) });
    const wk: any = r.worker;
    wk.startOrderStream(D);
    const woke: string[] = [];
    wk.loop.wake = (id: string) => void woke.push(id);
    const entry = "cyrus-20261102-AMBA-3";
    wk.syncMemory.freshStops.set(entry, { symbol: "AMBA", entryClientOrderId: entry, stopClientOrderId: "cyrus-p-20261102-AMBA-x-s1", orderId: "p1", qty: 2, stopPrice: 33.04, placedAt: 0, status: "canceled", lookedAt: 0, takeProfitPrice: 33.26, stopLegId: "leg-1" });
    for (const event of ["partial_fill", "fill", "canceled"]) wk.afterOrderUpdate({ event, order: { id: "leg-1", clientOrderId: "alpaca-own-id", symbol: "AMBA", side: "sell", type: "stop", orderClass: "oco", status: "filled", qty: 2, filledQty: 1, filledAvgPrice: 33, limitPrice: null, stopPrice: 33.04, groupId: "g", legs: [], replaces: null, createdAt: null, updatedAt: null, submittedAt: null, filledAt: null, canceledAt: null }, positionQty: 1, atMs: wk.d.now().getTime() });
    assert.deepEqual(woke, []);
    assert.equal(logs.filter((l) => l.event === "exit_pair_stop_exit").length, 0);
    const f = wk.syncMemory.freshStops.get(entry);
    assert.deepEqual([f.stopLegFilled, f.stopLegEnded, f.stopExitLogged], [undefined, undefined, undefined]);
  } finally {
    PAIR_STOP_EXIT.on = was;
  }
});

// Finding 3: the window's rechecks across many positions, through the real protection loop and the real shared request budget, with the
// worker's look rule (a "lag" look runs inside a P2 reservation of its cost; Worker.look). Ten positions' stop legs trigger 300 ms apart and
// fill 6 s later; every read takes 150 ms.
test("round 2, finding 3: ten positions' rechecks stay inside P2's share of the shared budget (at most 40 requests in any 60 s, 15 in any 5 s) and share looks", async () => {
  const w = world();
  const dd = await day(w);
  const syms = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ"];
  const ids: string[] = [];
  for (let i = 0; i < syms.length; i++) ids.push((await pairRemainder(w, dd, syms[i]!, 7, 2, 20 + i, i + 1)).id);
  w.sim.advance(5_000);
  const budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => 200 });
  w.memory.budget = budget;
  const timers: Array<{ at: number; fn: () => void }> = [];
  const lagLooks: Array<{ at: number; n: number; ids: number }> = [];
  let protectLooks = 0;
  const loop: ProtectionLoop = new ProtectionLoop({
    now: () => w.sim.simMs,
    setTimer: (fn, ms) => {
      const h = { at: w.sim.simMs + ms, fn };
      timers.push(h);
      return h;
    },
    clearTimer: (h) => {
      const i = timers.indexOf(h as any);
      if (i >= 0) timers.splice(i, 1);
    },
    look: async (lookIds, kind, extra) => {
      let res: Reservation | null = null;
      if (kind === "lag") {
        const rr = budget.tryReserve("P2", w.memory.lastListPages + 1 + extra, { label: "list lag recheck", waitKey: "list lag recheck" });
        if (!(rr instanceof Reservation)) return { outcome: "wait", retryAt: rr.at };
        res = rr;
      }
      const before = w.sim.requests;
      const run = () => syncOrders(w.risk, dd, { protect: true, loop, only: lookIds });
      if (res) await withReservation(res, run);
      else await run();
      if (kind === "lag") lagLooks.push({ at: w.sim.simMs, n: w.sim.requests - before, ids: lookIds.size });
      else protectLooks++;
      return { outcome: "done" };
    },
  });
  // Every read takes 150 ms from here.
  const lo = w.sim.listOrdersPaged.bind(w.sim);
  const lp = w.sim.listPositions.bind(w.sim);
  (w.sim as any).listOrdersPaged = async (...a: any[]) => (w.sim.advance(150), (lo as any)(...a));
  (w.sim as any).listPositions = async () => (w.sim.advance(150), lp());
  const t0 = w.sim.simMs;
  for (let i = 0; i < syms.length; i++) {
    w.at(i * 300, () => {
      stageStopExit(w, syms[i]!, 28, [[6_000, 2]]);
      loop.wake(ids[i]!, w.sim.simMs, "protect"); // the worker's wake on the limit's cancel update
    });
  }
  const settle = async () => {
    for (let k = 0; k < 200; k++) await new Promise((r) => setImmediate(r));
  };
  const end = t0 + 20_000;
  for (let guard = 0; guard < 2_000; guard++) {
    const staged = w.plan.map((p) => p.at).sort((a, b) => a - b)[0];
    const timer = timers.slice().sort((a, b) => a.at - b.at)[0];
    const next = Math.min(staged ?? Infinity, timer?.at ?? Infinity);
    if (!(next <= end)) break;
    w.sim.advance(Math.max(0, next - w.sim.simMs)); // also runs staged events due now
    if (timer && timer.at <= w.sim.simMs) {
      timers.splice(timers.indexOf(timer), 1);
      timer.fn();
      await settle();
    }
  }
  loop.stop?.();
  const inWindow = (ms: number) => Math.max(...lagLooks.map((l) => lagLooks.filter((x) => x.at > l.at - ms && x.at <= l.at).reduce((n, x) => n + x.n, 0)), 0);
  const total = lagLooks.reduce((n, x) => n + x.n, 0);
  if (process.env.PRINT_BOUND) console.log(JSON.stringify({ lagLooks: lagLooks.length, total, max60: inWindow(60_000), max5: inWindow(5_000), shared: lagLooks.filter((l) => l.ids > 1).length, protectLooks }));
  assert.ok(lagLooks.length > 0, "the window's rechecks ran as list-lag looks");
  assert.ok(inWindow(60_000) <= 40, `${inWindow(60_000)} requests in 60 s`);
  assert.ok(inWindow(5_000) <= 15, `${inWindow(5_000)} requests in 5 s`);
  assert.ok(lagLooks.some((l) => l.ids > 1), "positions due together share one look");
  assert.deepEqual(gapRows(w), [], "every one read as a stop exit");
  assert.equal(w.sim.sellLog.length, 0);
});
