// The exit pair (Michael's approval of 2026-11-21, with his answers 1 to 4; src/exit-pair.ts). With the day's switch on (`pair on`), a
// remainder after a partial take-profit gets an exit pair (one OCO order: a limit at the bracket's original take-profit price and the stop at
// its stop price) instead of a fresh stop alone; a close-out moves the pair's limit like a bracket's take-profit. Off by default: with the
// switch off nothing changes (every older test runs unchanged). Alpaca's pair behaviour is not measured until Monday 2026-11-23's trials, so
// the simulator serves the three list shapes the code must survive.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate, openSellQty } from "../src/sells.ts";
import { MoveWatch, structuralCandidates } from "../src/moved-take-profit.ts";
import { SyncMemory, notePairBroken, syncOrders } from "../src/risk.ts";
import { closeOut } from "../src/closeout.ts";
import { MemoryStore, setPhase } from "../src/store.ts";
import { ensureDay, parseCommand } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { EXIT_PAIR_PHASE, exitPairOn, isExitPair, pairBroken, pairTakeProfitFor } from "../src/exit-pair.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";
import { STORED_INFO_EVENTS } from "../src/run-log.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day, in the session
const CLOSE = new Date(Date.UTC(2026, 10, 2, 21, 0));

function world(startMs = MID, opts: { shape?: SimBroker["pairListShape"]; alpacaShape?: boolean } = {}) {
  const sim = new SimBroker(startMs);
  if (opts.shape) sim.pairListShape = opts.shape;
  if (opts.alpacaShape) sim.openShape20261118 = true;
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, o?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: o?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const watch = new MoveWatch(() => sim.simMs);
  sim.onOrderEvent = (event, o, atMs) => watch.onUpdate({ event, order: o, positionQty: null, atMs });
  const memory = new SyncMemory();
  // As the worker's stopsForMoves: a bracket's stop from the entry, a pair's from what the stack placed (its memory).
  const moves = {
    quotes: async (symbols: string[]) => new Map(symbols.map((s) => [s, { bid: sim.prices.get(s)!, ask: sim.prices.get(s)! + 0.01, atMs: sim.simMs }])),
    stopsFor: async (legs: Array<{ legId: string; groupId: string; symbol: string }>) => {
      const out = new Map<string, number>();
      for (const l of legs) {
        const pair = [...memory.freshStops.values()].find((f) => f.takeProfitPrice !== undefined && f.orderId === l.legId);
        if (pair) {
          if (!pair.pairBroken) out.set(l.legId, pair.stopPrice);
          continue;
        }
        const stop = sim.orders.find((o) => o.groupId === l.groupId)?.legs.find((x) => x.type === "stop")?.stopPrice;
        if (stop) out.set(l.legId, stop);
      }
      return out;
    },
    watch,
    room: () => true,
  };
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log, moves });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const fresh: Array<{ symbol: string; shares: number }> = [];
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: (x: { symbol: string; shares: number }) => void fresh.push(x) };
  return { sim, events, said, say, gate, liquidator, store, now, risk, memory, fresh };
}
type World = ReturnType<typeof world>;

async function hold(w: World, symbol: string, qty: number, price: number, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}
async function day(w: World, pair: "on" | "off" | null) {
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  if (pair) await setPhase(w.store, D, EXIT_PAIR_PHASE, pair);
  return (await w.store.getDay(D))!;
}
const pairOrder = (w: World, symbol: string) => w.sim.orders.find((o) => o.symbol === symbol && o.side === "sell" && o.orderClass === "oco" && o.type === "limit");
const mentions = (w: World) => w.said.filter((m) => m.ch === "alerts" && m.mention);
const r2 = (x: number) => Math.round(x * 100) / 100;

// A remainder: 10 held, the take-profit fills 3, Alpaca cancels the stop; one sync gives the 7 their protection.
async function remainder(w: World, symbol: string, price: number, n: number, dd: Awaited<ReturnType<typeof day>>) {
  const id = await hold(w, symbol, 10, price, n);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 3, price + 0.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  return id;
}

// ------------------------------------------------------------ the switch -------------------------------------------------------------

test("switch: off unless that day's record says `on`; `pair on` / `pair off` parse; nothing else does", () => {
  assert.equal(exitPairOn(null), false);
  assert.equal(exitPairOn({ phases: {} }), false);
  assert.equal(exitPairOn({ phases: { [EXIT_PAIR_PHASE]: "off" } }), false);
  assert.equal(exitPairOn({ phases: { [EXIT_PAIR_PHASE]: "on" } }), true);
  assert.deepEqual(parseCommand("pair on"), { kind: "pair", on: true });
  assert.deepEqual(parseCommand("Pair OFF"), { kind: "pair", on: false });
  assert.equal(parseCommand("pair").kind, "unknown");
  assert.equal(parseCommand("pair on now").kind, "unknown");
});

test("switch off (no phase, or `off`): the remainder gets today's plain fresh stop and no pair is ever sent", async () => {
  for (const pair of [null, "off"] as const) {
    const w = world();
    const dd = await day(w, pair);
    await remainder(w, "QXO", 13.5, 11, dd);
    assert.equal(w.sim.pairLog.length, 0, `${pair}: no pair`);
    assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty, x.stopPrice]), [["QXO", 7, 13.37]], `${pair}: the plain stop`);
    assert.equal(w.sim.sellLog.length, 0);
    assert.ok(!w.events.some((e) => e.event === "fresh_stop" && e.data.pair), `${pair}: logged as a plain stop`);
  }
});

test("switch: another day's `on` never carries over (the record of the day in hand is what counts)", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const dd = (await w.store.getDay(D))!;
  const yesterday = { ...dd, tradeDate: "2026-10-30", phases: { ...dd.phases, [EXIT_PAIR_PHASE]: "on" } };
  assert.equal(exitPairOn(yesterday), true);
  await remainder(w, "QXO", 13.5, 12, dd);
  assert.equal(w.sim.pairLog.length, 0);
});

// ------------------------------------------------------------ placing it -------------------------------------------------------------

test("on: the remainder gets one exit pair, its limit at the bracket's original take-profit and its stop at the bracket's stop; nothing is sold; the next syncs leave it alone in every list shape", async () => {
  for (const shape of ["nested", "parentAlone", "separate"] as const) {
    const w = world(MID, { shape });
    const dd = await day(w, "on");
    const id = await remainder(w, "QXO", 13.5, 11, dd);
    assert.deepEqual(w.sim.pairLog.map((x) => [x.symbol, x.qty, r2(x.takeProfitPrice), r2(x.stopPrice)]), [["QXO", 7, 13.58, 13.37]], shape);
    assert.ok(w.sim.pairLog[0]!.clientOrderId.startsWith("cyrus-p-"), "the fresh stop's own prefix");
    assert.equal(w.sim.stopLog.length, 0, "no plain stop on top");
    assert.equal(w.sim.sellLog.length, 0, "nothing sold");
    const ev = w.events.find((e) => e.event === "fresh_stop")!;
    assert.equal(ev.data.pair, true);
    assert.equal(r2(ev.data.takeProfitPrice), 13.58);
    assert.equal(w.memory.freshStops.get(id)!.takeProfitPrice, 13.58);
    assert.deepEqual(w.fresh, [{ symbol: "QXO", shares: 7 }], "counted with the fresh stops for the summary");
    for (let i = 0; i < 4; i++) {
      w.sim.advance(10_000);
      await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    }
    assert.equal(w.sim.sellLog.length, 0, `${shape}: left alone`);
    assert.equal(w.sim.pairLog.length, 1, `${shape}: no second pair`);
    assert.equal(w.sim.heldQty("QXO"), 7);
    assert.equal(mentions(w).length, 0);
    assert.equal(w.sim.oversellAttempts, 0);
  }
});

test("answer 2: the pair refused -> the plain stop at once (its own client id); both refused -> the market sale; each step logged", async () => {
  const w = world();
  w.sim.pairAnswer = "refuse";
  const dd = await day(w, "on");
  await remainder(w, "CIFR", 7.27, 1, dd);
  assert.equal(w.sim.pairLog.length, 0);
  assert.equal(w.sim.stopLog.length, 1);
  assert.ok(w.sim.stopLog[0]!.clientOrderId.endsWith("b"), "the plain stop's own client id");
  const refused = w.events.find((e) => e.event === "exit_pair_refused")!;
  assert.equal(refused.data.httpStatus, 422);
  const fs = w.events.find((e) => e.event === "fresh_stop")!;
  assert.ok(fs.data.afterPairRefused === true && typeof fs.data.afterPairRefusedReason === "string" && typeof fs.data.afterPairRefusedMs === "number");
  assert.equal(fs.data.pair, undefined);
  assert.equal(w.sim.sellLog.length, 0);

  const v = world();
  v.sim.pairAnswer = "refuse";
  v.sim.refuseStops = true;
  const vd = await day(v, "on");
  await remainder(v, "CIFR", 7.27, 2, vd);
  assert.deepEqual(v.sim.sellLog.map((x) => [x.symbol, x.qty]), [["CIFR", 7]], "then the market sale, as today");
  assert.ok(v.events.some((e) => e.event === "fresh_stop_refused" && e.data.afterPairRefused === true));
  assert.equal(v.sim.oversellAttempts, 0);
});

test("answer 2: an unclear answer to the pair ends the chain (no plain stop, no market sale on top); remembered as an unclear pair", async () => {
  const w = world();
  w.sim.pairAnswer = "unclear";
  const dd = await day(w, "on");
  const id = await remainder(w, "MARA", 15, 3, dd);
  assert.equal(w.sim.stopLog.length, 0);
  assert.equal(w.sim.sellLog.length, 0);
  const u = w.events.find((e) => e.event === "fresh_stop_unclear")!;
  assert.equal(u.data.pair, true);
  const f = w.memory.freshStops.get(id)!;
  assert.equal(f.status, "unclear");
  assert.equal(f.takeProfitPrice, 15.08);
});

test("a pair is not sent when its take-profit is not at least 1 cent above the stop (unknown price): the plain stop, as today", async () => {
  const leg = { side: "sell", type: "limit", limitPrice: 10.0 } as any;
  assert.equal(pairTakeProfitFor({ legs: [leg] }, null, 10.0), null);
  assert.equal(pairTakeProfitFor({ legs: [{ ...leg, limitPrice: 10.009 }] }, null, 10.001), null, "both round down to 10.00");
  assert.equal(pairTakeProfitFor({ legs: [{ ...leg, limitPrice: 10.0 }] }, null, 9.99), 10.0);
  assert.equal(pairTakeProfitFor({ legs: [] }, 10.5, 10.0), 10.5, "the stored take-profit when the leg is not shown");
  assert.equal(pairTakeProfitFor({ legs: [] }, null, 10.0), null);
});

// ------------------------------------------------------------ answer 3 ---------------------------------------------------------------

test("answer 3: the pair's take-profit fills part (Alpaca cancels its stop): the next look cancels the pair's rest and sells the shares at market; no second pair", async () => {
  for (const shape of ["nested", "parentAlone"] as const) {
    const w = world(MID, { shape });
    const dd = await day(w, "on");
    const id = await remainder(w, "QXO", 13.5, 11, dd);
    w.sim.advance(2_000);
    w.sim.fillPairTakeProfit("QXO", 2); // 5 left, the pair's stop cancelled
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["QXO", 5]], `${shape}: the 5 left sold at market`);
    assert.equal(pairOrder(w, "QXO")!.status, "canceled", `${shape}: the pair's rest cancelled`);
    assert.equal(w.sim.pairLog.length, 1, `${shape}: no second pair`);
    assert.equal(w.sim.stopLog.length, 0, `${shape}: no plain stop either`);
    assert.ok(w.events.some((e) => e.event === "exit_pair_broken"));
    assert.ok(w.events.some((e) => e.event === "exit_pair_rest_cancel"));
    w.sim.advance(2_000);
    assert.equal(w.sim.heldQty("QXO"), 0);
    assert.equal(w.memory.freshStops.has(id), false);
    assert.equal(w.sim.oversellAttempts, 0);
  }
});

test("answer 3: once seen broken (the live update ahead of the list), a lagging list can never make the pair protection again", async () => {
  const w = world();
  const dd = await day(w, "on");
  const id = await remainder(w, "SOFI", 9, 4, dd);
  const f = w.memory.freshStops.get(id)!;
  // What the worker does on Alpaca's live `partial_fill` for the pair, before the list shows it (here the list never shows it).
  f.pairBroken = true;
  notePairBroken(w.memory, f.stopClientOrderId, { orderId: f.orderId, symbol: f.symbol });
  w.sim.advance(500);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["SOFI", 7]]);
  assert.equal(pairOrder(w, "SOFI")!.status, "canceled");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("answer 3, the race: the pair's rest fills while its cancel lands: nothing more is sold, no oversell, no alert", async () => {
  const w = world();
  const dd = await day(w, "on");
  await remainder(w, "RRC", 51.27, 5, dd);
  w.sim.fillPairTakeProfit("RRC", 2); // 5 left
  const orig = w.sim.cancelOrder.bind(w.sim);
  w.sim.cancelOrder = async (oid: string) => {
    const p = pairOrder(w, "RRC")!;
    if (oid === p.id && p.status === "partially_filled") w.sim.fillPairTakeProfit("RRC"); // the rest fills first
    await orig(oid);
  };
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(3_000);
  assert.equal(w.sim.heldQty("RRC"), 0);
  assert.equal(w.sim.sellLog.length, 0, "nothing left to sell");
  assert.equal(w.sim.oversellAttempts, 0);
  assert.equal(mentions(w).length, 0);
});

test("the pair's take-profit fills whole, or its stop fills: the shares are gone, nothing is sold, no alert, the entry closes", async () => {
  for (const how of ["take-profit", "stop"] as const) {
    const w = world();
    const dd = await day(w, "on");
    const id = await remainder(w, "RIOT", 15, 6, dd);
    w.sim.advance(2_000);
    if (how === "take-profit") w.sim.fillPairTakeProfit("RIOT");
    else w.sim.triggerPairStop("RIOT");
    assert.equal(w.sim.heldQty("RIOT"), 0);
    w.sim.advance(15_000);
    await syncOrders(w.risk, dd, { protect: true });
    assert.equal(w.sim.sellLog.length, 0, how);
    assert.ok((await w.store.listOrders(D)).find((r) => r.clientOrderId === id)!.closedAt, `${how}: closed`);
    assert.equal(mentions(w).length, 0, how);
    if (how === "stop") assert.equal(pairOrder(w, "RIOT")!.status, "canceled", "Alpaca cancelled the take-profit");
  }
});

// ------------------------------------------------------------ the close-out ----------------------------------------------------------

test("close-out: the pair's limit is moved to the bid less 1 cent (one replace of its parent), it sells, its stop goes with it, no market sale, flat, nothing left open", async () => {
  for (const shape of ["nested", "parentAlone"] as const) {
    const w = world(CLOSE.getTime() - 6 * 3600_000, { shape, alpacaShape: true });
    const dd = await day(w, "on");
    await remainder(w, "ADT", 9.9, 6, dd);
    const p = pairOrder(w, "ADT")!;
    w.sim.advanceTo(CLOSE.getTime() - 15 * 60_000);
    w.sim.setPrice("ADT", 9.95); // bid 9.95: limit 9.94, at least 2 cents above the stop 9.77, below the pair's 9.98
    const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say as any, sleep: w.sim.sleep }, D, { closeAt: CLOSE, path: "close-out" });
    w.sim.advance(5_000);
    assert.equal(res.flat, true, shape);
    assert.equal(w.sim.replaceLog.length, 1, `${shape}: one replace`);
    assert.equal(w.sim.replaceLog[0]!.id, p.id, `${shape}: of the pair's parent`);
    assert.equal(w.sim.replaceLog[0]!.change.limitPrice, 9.94);
    assert.ok(w.sim.replaceLog[0]!.change.clientOrderId?.startsWith("cyrus-m-"));
    assert.equal(w.sim.sellLog.filter((x) => x.symbol === "ADT").length, 0, `${shape}: no market sale`);
    assert.equal((await w.sim.listOrders("open")).length, 0, `${shape}: nothing left open`);
    const moved = w.events.find((e) => e.event === "take_profit_moved");
    assert.ok(moved && moved.data.accepted === true && moved.data.symbol === "ADT", `${shape}: one move row, accepted`);
    // Group 2, round 1: the row says it was a pair and carries the fill and the stop's cancel, heard from the live updates (the pair is
    // tracked by its orders' ids, as Alpaca may give it no group id), so the move step does not wait out its full 2 s.
    assert.equal(moved.data.pair, true, `${shape}: marked as a pair`);
    assert.equal(typeof moved.data.timeToFillMs, "number", `${shape}: its fill heard`);
    assert.equal(moved.data.stopCancelledByAlpaca, true, `${shape}: its stop leg's cancel heard`);
    assert.equal(w.sim.oversellAttempts, 0);
  }
});

test("close-out, the stop leg listed as its own top-level sell (an unmeasured shape): not moved (today's cancel-and-sell path), still flat", async () => {
  const w = world(CLOSE.getTime() - 6 * 3600_000, { shape: "separate", alpacaShape: true });
  const dd = await day(w, "on");
  await remainder(w, "ADT", 9.9, 6, dd);
  w.sim.advanceTo(CLOSE.getTime() - 15 * 60_000);
  w.sim.setPrice("ADT", 9.95);
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say as any, sleep: w.sim.sleep }, D, { closeAt: CLOSE, path: "close-out" });
  w.sim.advance(5_000);
  assert.equal(res.flat, true);
  assert.equal(w.sim.replaceLog.length, 0, "not moved");
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["ADT", 7]], "sold at market");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("the pure functions on each list shape: a pair counts once (nested, parent alone); listed as two top-level sells it counts twice, which errs toward refusing a sell, never toward overselling", async () => {
  for (const shape of ["nested", "parentAlone", "separate"] as const) {
    const w = world(MID, { shape });
    const dd = await day(w, "on");
    await remainder(w, "QXO", 13.5, 11, dd);
    const open = await w.sim.listOrders("open");
    const pos = (await w.sim.listPositions()).filter((x) => x.symbol === "QXO");
    const n = openSellQty(open, "QXO");
    assert.equal(n, shape === "separate" ? 14 : 7, shape);
    const c = structuralCandidates(pos, open);
    assert.deepEqual(c.candidates.map((x) => x.symbol), shape === "separate" ? [] : ["QXO"], shape);
    if (shape === "nested") assert.equal(c.candidates[0]!.stopPrice, 13.37, "its own stop leg's price");
    const parent = open.find((o) => isExitPair(o))!;
    assert.equal(pairBroken(parent), false);
  }
});

// ------------------------------------------------------------ a restart --------------------------------------------------------------

test("restart: a resting pair is confirmed by the start-up check (stop from its leg, take-profit from its limit); a partly filled one is not, and is sold", async () => {
  const w = world();
  const dd = await day(w, "on");
  const id = await remainder(w, "HIMS", 30, 8, dd);
  // A new process: the memory is gone.
  const m2 = new SyncMemory();
  w.risk.syncMemory = m2;
  w.sim.advance(1_000);
  await syncOrders(w.risk, dd, { protect: true });
  const f = m2.freshStops.get(id)!;
  assert.ok(f, "confirmed");
  assert.equal(f.stopPrice, 29.87);
  assert.equal(f.takeProfitPrice, 30.08);
  assert.equal(w.sim.sellLog.length, 0);

  const v = world();
  const vd = await day(v, "on");
  await remainder(v, "HIMS", 30, 9, vd);
  v.sim.fillPairTakeProfit("HIMS", 3); // 4 left, its stop cancelled
  const m3 = new SyncMemory();
  v.risk.syncMemory = m3;
  v.sim.advance(1_000);
  await syncOrders(v.risk, vd, { protect: true });
  assert.ok(v.events.some((e) => e.event === "startup_exit_pair_broken"));
  assert.deepEqual(v.sim.sellLog.map((x) => [x.symbol, x.qty]), [["HIMS", 4]]);
  assert.equal(pairOrder(v, "HIMS")!.status, "canceled");
  assert.equal(v.sim.oversellAttempts, 0);
});

// ------------------------------------------------------------ through the worker -----------------------------------------------------

async function worker() {
  const { rig, z } = await import("./rig.ts");
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const logs: Array<{ e: string; d: any }> = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true, log: (_l, e, d) => void logs.push({ e, d }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("15:00:00").getTime());
  await r.at("15:00:00");
  return { r, sim, logs };
}

test("`pair on` / `pair off` (the worker): stored in today's record and answered; not a trading day: nothing stored", async () => {
  const { r } = await worker();
  r.ownerSays("pair on", "15:00:05");
  await r.at("15:00:10");
  assert.equal(exitPairOn(await r.store.getDay(D)), true);
  assert.ok(r.said("commands").some((t) => t.startsWith("Exit pairs on for today")));
  r.ownerSays("pair off", "15:00:15");
  await r.at("15:00:20");
  assert.equal(exitPairOn(await r.store.getDay(D)), false);
  assert.ok(r.said("commands").some((t) => t.startsWith("Exit pairs off for today")));

  const { rig } = await import("./rig.ts");
  const sat = new SimBroker(Date.UTC(2026, 10, 7, 16, 0)); // Saturday 2026-11-07
  const s = rig<SimBroker>({ broker: sat, sleep: sat.sleep, simClock: sat });
  await s.at("2026-11-07T16:00:00Z");
  s.ownerSays("pair on", "2026-11-07T16:00:05Z");
  await s.at("2026-11-07T16:00:10Z");
  assert.ok(s.said("commands").some((t) => t.startsWith("Today is not a trading day")));
  assert.equal(exitPairOn(await s.store.getDay("2026-11-07")), false);
});

test("live update (the worker): a pair's take-profit partial fill marks it broken for good and wakes the entry; the digest counts a pair's fill as a take-profit and its stop leg's as a stop", async () => {
  const { r, logs } = await worker();
  const { order } = await import("./helpers.ts");
  const mem = (r.worker as any).syncMemory as SyncMemory;
  mem.freshStops.set("cyrus-20261102-QXO-1", { symbol: "QXO", entryClientOrderId: "cyrus-20261102-QXO-1", stopClientOrderId: "cyrus-p-20261102-QXO-x-s1", orderId: "p1", qty: 7, stopPrice: 13.37, placedAt: 0, status: "new", lookedAt: 0, takeProfitPrice: 13.58 });
  const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null) => ({ event, order: order(o), positionQty, atMs: null });
  await r.orderUpdate(upd("partial_fill", { id: "p1", clientOrderId: "cyrus-p-20261102-QXO-x-s1", symbol: "QXO", side: "sell", type: "limit", orderClass: "oco", status: "partially_filled", qty: 7, filledQty: 2 }, 5) as any);
  assert.equal(mem.freshStops.get("cyrus-20261102-QXO-1")!.pairBroken, true);
  assert.ok(mem.brokenPairIds.has("cyrus-p-20261102-QXO-x-s1"));
  assert.ok(logs.some((l) => l.e === "exit_pair_broken" && l.d.by === "live update"));
  const counts = () => Object.fromEntries((r.worker as any).digest.counts as Map<string, number>) as Record<string, number>;
  const before = counts();
  await r.orderUpdate(upd("partial_fill", { id: "p2", clientOrderId: "cyrus-p-20261102-RRC-x-s1", symbol: "RRC", side: "sell", type: "limit", orderClass: "oco", status: "partially_filled", qty: 3, filledQty: 1 }, 2) as any);
  await r.orderUpdate(upd("fill", { id: "p2", clientOrderId: "cyrus-p-20261102-RRC-x-s1", symbol: "RRC", side: "sell", type: "limit", orderClass: "oco", status: "filled", qty: 3, filledQty: 3 }, 0) as any);
  await r.orderUpdate(upd("fill", { id: "p3", clientOrderId: "alpaca-leg-9", symbol: "SOFI", side: "sell", type: "stop", stopPrice: 8.87, orderClass: "oco", status: "filled", qty: 4, filledQty: 4 }, 0) as any);
  await r.orderUpdate(upd("fill", { id: "p4", clientOrderId: "cyrus-p-20261102-MARA-x-s1", symbol: "MARA", side: "sell", type: "stop", stopPrice: 14.87, status: "filled", qty: 2, filledQty: 2 }, 0) as any);
  const after = counts();
  assert.equal((after.take_profit ?? 0) - (before.take_profit ?? 0), 1, "RRC's pair counted once, at its first partial fill, not again at its fill");
  assert.equal((after.stop ?? 0) - (before.stop ?? 0), 2, "the pair's stop leg and a plain fresh stop");
});

test("group 2, round 1: the exit pair's events are stored in the run log, not only Fly's log", () => {
  for (const e of ["exit_pair_refused", "exit_pair_broken", "exit_pair_rest_cancel", "startup_exit_pair_broken", "exit_pair_switch", "fresh_stop", "fresh_stop_unclear", "fresh_stop_refused", "take_profit_moved"]) assert.ok(STORED_INFO_EVENTS.has(e), e);
});

test("group 2, round 1: if Alpaca resizes the pair's stop at a partial fill instead of cancelling it, answer 3 still sells the rest at market (it acts on the partial fill itself)", async () => {
  const w = world();
  w.sim.pairPartialCancelsStop = false;
  const dd = await day(w, "on");
  await remainder(w, "QXO", 13.5, 11, dd);
  w.sim.fillPairTakeProfit("QXO", 2);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["QXO", 5]]);
  assert.equal(pairOrder(w, "QXO")!.status, "canceled");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("group 2, round 1: a close-out whose move of the pair is refused falls back to cancel and sell; flat, nothing left open", async () => {
  const w = world(CLOSE.getTime() - 6 * 3600_000, { alpacaShape: true });
  const dd = await day(w, "on");
  await remainder(w, "ADT", 9.9, 6, dd);
  w.sim.refuseReplaceIf = () => 422;
  w.sim.advanceTo(CLOSE.getTime() - 15 * 60_000);
  w.sim.setPrice("ADT", 9.95);
  const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say as any, sleep: w.sim.sleep }, D, { closeAt: CLOSE, path: "close-out" });
  w.sim.advance(5_000);
  assert.equal(res.flat, true);
  const row = w.events.find((e) => e.event === "take_profit_moved")!;
  assert.equal(row.data.accepted, false);
  assert.equal(row.data.pair, true);
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["ADT", 7]], "sold at market by the fallback");
  assert.equal((await w.sim.listOrders("open")).length, 0);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("group 2, round 1: an unclear pair that never reached Alpaca: looked up by its client id, found missing, and the shares are sold (ruling B's path), no pair on top", async () => {
  const w = world();
  w.sim.pairAnswer = "unclear";
  const dd = await day(w, "on");
  await remainder(w, "MARA", 15, 3, dd);
  w.sim.pairAnswer = "ok";
  for (let i = 0; i < 4 && w.sim.heldQty("MARA") > 0; i++) {
    w.sim.advance(5_000);
    await syncOrders(w.risk, dd, { protect: true });
    w.sim.advance(2_000);
  }
  assert.equal(w.sim.heldQty("MARA"), 0, "sold");
  assert.equal(w.sim.pairLog.length, 0, "no pair placed on top");
  assert.ok(w.sim.sellLog.some((x) => x.symbol === "MARA" && x.qty === 7));
  assert.equal(w.sim.oversellAttempts, 0);
});

// Group 1, round 1 (its probes A and B): the pair older than the sync's 10 minute order list, with the live updates on (the normal case).
test("group 1, round 1, probe A: a restart with a partly filled pair older than 10 minutes (live updates on): remembered broken, its rest cancelled, the shares sold; never re-taken as protection", async () => {
  const w = world();
  const dd = await day(w, "on");
  await remainder(w, "HIMS", 30, 9, dd);
  w.sim.advance(15 * 60_000);
  w.sim.fillPairTakeProfit("HIMS", 3); // 4 left, the pair's stop cancelled
  const m = new SyncMemory();
  w.risk.syncMemory = m;
  for (let i = 0; i < 4 && w.sim.heldQty("HIMS") > 0; i++) {
    w.sim.advance(1_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    w.sim.advance(2_000);
  }
  assert.ok(w.events.some((e) => e.event === "startup_exit_pair_broken"));
  assert.ok(!w.events.some((e) => e.event === "fresh_stop_recovered"), "never re-taken as protection");
  assert.equal(w.sim.heldQty("HIMS"), 0, "the 4 sold");
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["HIMS", 4]]);
  assert.equal(pairOrder(w, "HIMS")!.status, "canceled");
  assert.equal(w.sim.pairLog.length, 1, "no second pair");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("group 1, round 1, probe B: a pair marked broken by the live update, older than 10 minutes, whose first cancel Alpaca refuses: the next try cancels and sells; never re-taken as protection", async () => {
  const w = world();
  const dd = await day(w, "on");
  const id = await remainder(w, "SOFI", 9, 4, dd);
  w.sim.advance(15 * 60_000);
  w.sim.fillPairTakeProfit("SOFI", 2); // 5 left
  const f = w.memory.freshStops.get(id)!;
  f.pairBroken = true; // what the worker does on the live partial_fill
  notePairBroken(w.memory, f.stopClientOrderId, { orderId: f.orderId, symbol: f.symbol });
  const { AlpacaError } = await import("../src/alpaca-trading.ts");
  const orig = w.sim.cancelOrder.bind(w.sim);
  let refused = 0;
  w.sim.cancelOrder = async (oid: string) => {
    if (oid === pairOrder(w, "SOFI")!.id && refused === 0) {
      refused++;
      throw new AlpacaError("cancel refused (test)", 500);
    }
    return orig(oid);
  };
  for (let i = 0; i < 8 && w.sim.heldQty("SOFI") > 0; i++) {
    w.sim.advance(6_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.equal(refused, 1);
  assert.ok(!w.events.some((e) => e.event === "fresh_stop_recovered"), "never re-taken as protection");
  assert.equal(w.sim.heldQty("SOFI"), 0, "sold");
  assert.equal(pairOrder(w, "SOFI")!.status, "canceled");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("group 1, round 1: a whole pair older than 10 minutes, found by a sale after a restart, is recovered as a pair (its take-profit and stop kept), so a later partial fill is still recognised", async () => {
  const w = world();
  const dd = await day(w, "on");
  const id = await remainder(w, "HIMS", 30, 9, dd);
  w.sim.advance(15 * 60_000);
  const m = new SyncMemory();
  w.risk.syncMemory = m;
  w.sim.advance(1_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const f = m.freshStops.get(id)!;
  assert.ok(f, "remembered");
  assert.equal(f.takeProfitPrice, 30.08);
  assert.equal(f.stopPrice, 29.87);
  assert.equal(w.sim.sellLog.length, 0);
});

// Michael's answer of 2026-11-21 (afternoon): "at most one pair try per position. If the pair is refused once, later retries skip it and go
// straight to the plain stop, then the market sale." (Group 1's probe D: before, every stuck retry sent the pair again.)
test("one pair try per position: the pair, the plain stop and the market sale all refused; every later retry skips the pair (plain stop, then market sale); another position still gets its own one try", async () => {
  const w = world();
  w.sim.pairAnswer = "refuse";
  w.sim.refuseStops = true;
  w.sim.refuseSellIf = (s) => s.stopPrice === undefined && s.takeProfitPrice === undefined && s.symbol === "CIFR"; // the market sale refused too
  const kinds: string[] = [];
  const orig = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (s: any) => {
    if (s.symbol === "CIFR") kinds.push(s.takeProfitPrice !== undefined ? "pair" : s.stopPrice !== undefined ? "stop" : "market");
    return orig(s);
  };
  const dd = await day(w, "on");
  const id = await remainder(w, "CIFR", 7.27, 1, dd);
  for (let i = 0; i < 6; i++) {
    w.sim.advance(31_000);
    await syncOrders(w.risk, dd, { protect: true });
  }
  assert.ok(kinds.length >= 6, `retried: ${kinds.join(",")}`);
  assert.equal(kinds.filter((k) => k === "pair").length, 1, `one pair try: ${kinds.join(",")}`);
  assert.deepEqual(kinds.slice(0, 3), ["pair", "stop", "market"]);
  assert.ok(kinds.slice(3).every((k) => k !== "pair"), "later retries skip the pair");
  assert.ok(kinds.slice(3).includes("stop") && kinds.slice(3).includes("market"), "plain stop, then the market sale");
  assert.ok(w.memory.pairRefusedEntries.has(id));
  assert.equal(w.sim.oversellAttempts, 0);
  // Another position on another symbol still gets its own one pair try.
  w.sim.pairAnswer = "ok";
  w.sim.refuseStops = false;
  await remainder(w, "QXO", 13.5, 11, dd);
  assert.equal(w.sim.pairLog.filter((x) => x.symbol === "QXO").length, 1);
});
