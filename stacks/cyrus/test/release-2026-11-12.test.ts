// The release of 2026-11-12, part A (Michael's approval of builds/c2-proposal-2026-11-12.md, answers 1 and 2):
//   A4. after a partial take-profit Alpaca cancels the bracket's stop on the first share sold; the stack now cancels the take-profit's
//       rest at once and places a fresh stop sell for the shares left, at the bracket's own stop price. The remainder ends at that stop
//       or at the next close-out (option a). If Alpaca refuses the stop, the shares are sold at market, as before.
//   A5. a load-window entry that fills as the stack's 5 second cancel reaches Alpaca loses both exits (24 of 24 on 2026-11-11); its
//       share is now sold at once, the sale waiting for Alpaca's cancel to free it; nothing is sold if Alpaca kept the exits.
// Each test fails on the code before this release (no fresh stops, no fast sale).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { FAST_LOST_EXIT_WAIT_MS, SyncMemory, fastLostExitSale, syncOrders } from "../src/risk.ts";
import { closeOut } from "../src/closeout.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { OrderUpdateHandler } from "../src/order-stream.ts";
import { EntryExpiry } from "../src/entry-expiry.ts";
import { StopGapMeter } from "../src/stop-gap.ts";
import { stopGapLine } from "../src/summary.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day, in the session
const CLOSE = new Date(Date.UTC(2026, 10, 2, 21, 0));

function world(startMs = MID) {
  const sim = new SimBroker(startMs);
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: opts?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const fresh: Array<{ symbol: string; shares: number }> = [];
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: (x: { symbol: string; shares: number }) => void fresh.push(x) };
  return { sim, events, said, say, gate, liquidator, store, now, risk, memory, fresh };
}
type World = ReturnType<typeof world>;

async function hold(w: World, symbol: string, qty: number, price: number, n: number, stored = true) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  if (stored) await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}
const entryOf = (w: World, id: string) => w.sim.orders.find((o) => o.clientOrderId === id)!;
const freshStopOrder = (w: World, symbol: string) => w.sim.orders.find((o) => o.symbol === symbol && o.side === "sell" && o.type === "stop" && o.clientOrderId.startsWith("cyrus-p-"));
const mentions = (w: World) => w.said.filter((m) => m.ch === "alerts" && m.mention);
async function day(w: World) {
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  return (await w.store.getDay(D))!;
}

// ------------------------------------------------------------ A4 -------------------------------------------------------------------

test("A4, Tuesday's QXO shape: a partial take-profit leaves 9 shares; the take-profit's rest is cancelled at once and a fresh stop protects the 9, at the bracket's own stop price; nothing is sold", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "QXO", 10, 13.5, 11);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 13.58); // Alpaca cancels the stop here
  const cancelledAt = w.sim.simMs;
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.sim.sellLog.length, 0, "no market sale");
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty, x.stopPrice]), [["QXO", 9, 13.37]]);
  assert.ok(w.sim.stopLog[0]!.clientOrderId.startsWith("cyrus-p-"), "its own prefix, so whole-account sales cancel it like an exit");
  assert.equal(entryOf(w, id).legs.find((l) => l.type === "limit")!.status, "canceled", "the take-profit's rest was cancelled first");
  assert.ok(w.sim.stopLog[0]!.at - cancelledAt < 2_000, `the fresh stop ${w.sim.stopLog[0]!.at - cancelledAt} ms after Alpaca cancelled the stop`);
  const ev = w.events.find((e) => e.event === "fresh_stop")!;
  assert.equal(ev.data.symbol, "QXO");
  assert.equal(ev.data.qty, 9);
  assert.equal(typeof ev.data.msFromStopCancel, "number");
  assert.deepEqual(w.fresh, [{ symbol: "QXO", shares: 9 }], "counted for the summary's stop-gap line");
  assert.ok(w.memory.freshStops.has(id));
  assert.equal(w.sim.oversellAttempts, 0);
  assert.equal(w.sim.heldQty("QXO"), 9, "the shares are still held, now protected");
  assert.equal(mentions(w).length, 0);
});

test("A4: the take-profit fills more while its cancel lands (fix A's recount stays): the fresh stop is for what is actually left; nothing left means no stop", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "RRC", 9, 51.27, 4);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 51.35); // 8 left
  const orig = w.sim.cancelOrder.bind(w.sim);
  let done = false;
  w.sim.cancelOrder = async (oid: string) => {
    await orig(oid);
    if (!done && oid === entryOf(w, id).legs.find((l) => l.type === "limit")!.id) {
      done = true;
      w.sim.partialTakeProfit(id, 5, 51.35); // 3 left
    }
  };
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["RRC", 3]]);
  assert.equal(w.sim.oversellAttempts, 0);

  const v = world();
  const vd = await day(v);
  const vid = await hold(v, "RRC", 9, 51.27, 5);
  v.sim.advance(5_000);
  v.sim.partialTakeProfit(vid, 1, 51.35);
  const vorig = v.sim.cancelOrder.bind(v.sim);
  v.sim.cancelOrder = async (oid: string) => {
    await vorig(oid);
    if (v.sim.heldQty("RRC") > 0) v.sim.partialTakeProfit(vid, 8, 51.35); // every share left fills while the cancel lands
  };
  v.sim.advance(300);
  await syncOrders(v.risk, vd, { protect: true });
  assert.equal(v.sim.stopLog.length, 0, "nothing left: no stop");
  assert.equal(v.sim.sellLog.length, 0);
  assert.equal(mentions(v).length, 0);
});

test("A4: Alpaca refuses the fresh stop (the price already below it): the shares are sold at market in the same cleanup, as before, and it is logged", async () => {
  const w = world();
  w.sim.refuseStops = true;
  const dd = await day(w);
  const id = await hold(w, "CIFR", 10, 7.27, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 3, 7.35);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.sim.stopLog.length, 0);
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["CIFR", 7]]);
  const ev = w.events.find((e) => e.event === "fresh_stop_refused")!;
  assert.equal(ev.data.symbol, "CIFR");
  assert.equal(ev.data.httpStatus, 422);
  assert.equal(w.memory.freshStops.size, 0);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("A4: an unclear answer to the fresh stop (a 5xx after the client's checks) sends no market sale on top; the next sync looks the stop up and leaves it alone if it exists", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "WULF", 6, 9.5, 2);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 9.58);
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (s) => {
    const o = await realSubmit(s);
    if (s.stopPrice !== undefined) {
      const { AlpacaError } = await import("../src/alpaca-trading.ts");
      throw new AlpacaError("outcome of the first send is still unclear (test)", 502);
    }
    return o;
  };
  w.sim.advance(300);
  const r = await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.sim.sellLog.length, 0, "no market sale while the stop may exist");
  assert.equal(w.memory.freshStops.get(id)!.status, "unclear");
  assert.ok(r.recheckAt !== undefined);
  w.sim.submitSell = realSubmit;
  w.sim.advance(3_000);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.sim.sellLog.length, 0, "the stop exists at Alpaca (the sync's own list shows it working): nothing sold");
  assert.equal(w.sim.stopLog.length, 1, "no second stop");
  // Once the stop is older than the sync's 10 minute read, it is looked up by its client id.
  w.sim.advance(11 * 60_000);
  for (let i = 0; i < 4; i++) {
    w.sim.advance(10_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.equal(w.memory.freshStops.get(id)!.status, "accepted", "looked up: it exists");
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.sim.stopLog.length, 1);
});

test("A4: the missing-exit check leaves a fresh-stopped remainder alone, sync after sync (an older stop is looked up at most every 30 seconds while the live updates are on)", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "IREN", 8, 20, 3);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 3, 20.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.sim.stopLog.length, 1);
  const stopClient = w.sim.stopLog[0]!.clientOrderId;
  let looks = 0;
  const realFind = w.sim.findOrderByClientId.bind(w.sim);
  w.sim.findOrderByClientId = async (cid: string) => (cid === stopClient && looks++, realFind(cid));
  for (let i = 0; i < 3; i++) {
    w.sim.advance(5_000);
    const r = await syncOrders(w.risk, dd, { protect: true, streamLive: false });
    assert.equal(r.unprotected.length, 0);
  }
  assert.equal(looks, 0, "while the sync's own list shows the stop working, no lookup is needed");
  w.sim.advance(11 * 60_000); // now older than the sync's 10 minute read
  for (let i = 0; i < 6; i++) {
    w.sim.advance(10_000);
    const r = await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    assert.equal(r.unprotected.length, 0);
  }
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.sim.stopLog.length, 1);
  assert.ok(looks >= 1 && looks <= 3, `${looks} lookups in a minute with the live updates on`);
  assert.equal(mentions(w).length, 0);
});

test("A4: the fresh stop cancelled by someone else (not our sale): the next sync sells the remainder through the missing-exit check, as before", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "MARA", 5, 15, 4);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 15.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const st = freshStopOrder(w, "MARA")!;
  await w.sim.cancelOrder(st.id); // cancelled by hand at Alpaca
  w.sim.advance(1_000);
  w.memory.freshStops.get(id)!.status = "canceled"; // what the live update tells the worker
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["MARA", 3]]);
  assert.ok(w.events.some((e) => e.event === "fresh_stop_gone" && e.data.symbol === "MARA"));
  assert.equal(w.sim.oversellAttempts, 0);
});

test("A4: the fresh stop fills (the price fell to it): the position is gone and the entry is closed by the order sync, with nothing sold", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "RIOT", 4, 15, 5);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 15.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(2_000);
  w.sim.triggerStop("RIOT");
  assert.equal(w.sim.heldQty("RIOT"), 0);
  w.sim.advance(15_000);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok((await w.store.listOrders(D)).find((r) => r.clientOrderId === id)!.closedAt, "closed");
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.memory.freshStops.size, 0, "forgotten once the entry is closed");
  assert.equal(mentions(w).length, 0);
});

test("A4: the 2:55 close-out and the mid-day close-out cancel the fresh stop with everything else and sell the remainder; flat, no NOT FLAT", async () => {
  for (const path of ["close-out", "midday"] as const) {
    const w = world(CLOSE.getTime() - 6 * 3600_000);
    const dd = await day(w);
    const id = await hold(w, "ADT", 7, 9.9, 6);
    await hold(w, "CIFR", 4, 7.27, 7); // another position, with its bracket
    w.sim.advance(5_000);
    w.sim.partialTakeProfit(id, 2, 9.98);
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    assert.ok(freshStopOrder(w, "ADT"), "protected by its fresh stop");
    w.sim.advanceTo(CLOSE.getTime() - 5 * 60_000);
    const res = await closeOut({ broker: w.sim, liquidator: w.liquidator, store: w.store, now: w.now, say: w.say as any, sleep: w.sim.sleep }, D, { closeAt: CLOSE, path, alert: path === "close-out" });
    w.sim.advance(5_000);
    assert.equal(w.sim.heldQty("ADT"), 0, `${path}: ADT sold`);
    assert.equal(w.sim.heldQty("CIFR"), 0, `${path}: CIFR sold`);
    assert.equal(freshStopOrder(w, "ADT")!.status, "canceled", `${path}: the fresh stop was cancelled`);
    assert.ok(res.flat !== false, `${path}: flat`);
    assert.ok(!w.said.some((m) => /NOT FLAT/.test(m.text)), `${path}: no NOT FLAT`);
    assert.equal(w.sim.oversellAttempts, 0);
  }
});

test("A4: the daily loss stop's whole-account sale cancels the fresh stop and sells the remainder", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "HIMS", 6, 30, 8);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 30.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(freshStopOrder(w, "HIMS"));
  // The loss stop's sale (risk.ts enforceDailyLoss): the whole account, priority, one round.
  const r = await w.liquidator.flatten({ reason: "daily loss stop", tradeDate: D, maxRounds: 1, priority: true });
  w.sim.advance(5_000);
  assert.equal(w.sim.heldQty("HIMS"), 0);
  assert.ok(r.sold.some((x) => x.symbol === "HIMS" && x.qty === 4));
  assert.equal(freshStopOrder(w, "HIMS")!.status, "canceled");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("A4 keeps release 1's rule: with a newer position on the same symbol, the older entry's remainder is sold at market (no fresh stop) and the newer position keeps its exits", async () => {
  const w = world();
  const dd = await day(w);
  const older = await hold(w, "APLD", 5, 16.46, 107);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(older, 2, 16.54); // 3 left on the older entry
  w.sim.advance(300);
  const newer = await hold(w, "APLD", 4, 16.46, 108, false); // bought after the sync read the records
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.sim.stopLog.length, 0, "no fresh stop when the entry is not the whole holding");
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["APLD", 3]]);
  w.sim.advance(5_000);
  assert.equal(w.sim.heldQty("APLD"), 4);
  assert.ok(entryOf(w, newer).legs.every((l) => l.status === "new"), "the newer position's exits are live");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("A4: the summary's stop-gap line counts the fresh stops beside the sales; a saved day without them still reads", () => {
  const m = new StopGapMeter();
  m.startDay(D, null);
  m.onFreshStop({ shares: 9 });
  m.onFreshStop({ shares: 3 });
  assert.equal(m.settle(MID), true, "a fresh stop counts as a change to save");
  const line = stopGapLine(m.totals());
  assert.equal(line, "Fresh stops after a partial take-profit: 2 placed (12 shares); no remainder sold at market at that step.");
  const old = stopGapLine({ sales: 1, shares: 7, wouldHaveFilled: 0, unmeasured: 0, dollarsVsWaiting: 0.5 });
  assert.ok(old.startsWith("Fresh stops after a partial take-profit: none placed; 1 remainder sold at market at that step instead (7 shares; "), old);
});

// ------------------------------------------- group 2 review, rounds 1 and 2 (messaging only) ------------------------------------------

test("group 2, finding 1 (round 2 wording): the stop-gap line names only the fresh-stop step and its own market sales; zero case; singular and plural right", () => {
  assert.equal(stopGapLine({ sales: 0, shares: 0, wouldHaveFilled: 0, unmeasured: 0, dollarsVsWaiting: 0 }), "Fresh stops after a partial take-profit: none placed today, and no remainder sold at market at that step.");
  const one = stopGapLine({ sales: 1, shares: 1, wouldHaveFilled: 0, unmeasured: 0, dollarsVsWaiting: -0.01, freshStops: 1, freshStopShares: 1 });
  assert.ok(one.startsWith("Fresh stops after a partial take-profit: 1 placed (1 share); 1 remainder sold at market at that step instead (1 share; Alpaca refused the fresh stop, or another position shared the symbol). Of the sales, 0 would have filled"), one);
  const salesOnly = stopGapLine({ sales: 2, shares: 9, wouldHaveFilled: 1, unmeasured: 0, dollarsVsWaiting: 0.12 });
  assert.ok(salesOnly.startsWith("Fresh stops after a partial take-profit: none placed; 2 remainders sold at market at that step instead (9 shares;"), salesOnly);
  for (const l of [one, salesOnly]) assert.ok(!/\b1 shares\b|\b1 remainders\b|\b1 sales\b|at once|none today/.test(l), l);
});

// Group 2 review, round 2, probe 2: a remainder sold outside the fresh-stop step (by the missing-exit check after a stuck cleanup, or after
// its fresh stop ended) is not counted by the line, and the line must not claim anything false about it.
test("group 2, round 2 (probe 2): a stuck remainder later sold by the missing-exit check, and a fresh stop cancelled in the dashboard then sold: the line claims nothing false", async () => {
  for (const shape of ["stuck", "fresh-ended"] as const) {
    const w = world();
    const meter = new StopGapMeter();
    meter.startDay(D, null);
    w.risk.onBareSale = (x: any) => meter.onSale(x);
    w.risk.onFreshStop = (x: any) => meter.onFreshStop(x);
    const dd = await day(w);
    const id = await hold(w, "LUNR", 5, 12, 51);
    w.sim.advance(5_000);
    w.sim.partialTakeProfit(id, 2, 12.08);
    if (shape === "stuck") w.sim.cancelMs = 40_000;
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    if (shape === "fresh-ended") await w.sim.cancelOrder(freshStopOrder(w, "LUNR")!.id);
    w.sim.advance(41_000);
    await syncOrders(w.risk, dd, { protect: true });
    w.sim.advance(10_000);
    await syncOrders(w.risk, dd, { protect: true });
    meter.settle(w.sim.simMs + 70_000);
    const line = stopGapLine(meter.totals());
    assert.ok(w.sim.sellLog.some((x) => x.symbol === "LUNR"), `${shape}: the remainder was sold (outside the fresh-stop step)`);
    assert.ok(!/none today|no remainder(s)? (was )?sold\b(?! at market at that step)/.test(line), `${shape}: no general claim: ${line}`);
    if (shape === "stuck") assert.equal(line, "Fresh stops after a partial take-profit: none placed today, and no remainder sold at market at that step.");
    else assert.equal(line, "Fresh stops after a partial take-profit: 1 placed (3 shares); no remainder sold at market at that step.");
  }
});

// Group 2 review, round 2, the reviewer's probe: the take-profit's cancel outlasts the cleanup (reported stuck), the retry places the fresh
// stop but its answer is unclear (it exists at Alpaca). No 5 minute alert while that stop rests, also after it leaves the sync's 10 minute
// list; nothing is sold.
for (const [CMS, GAP] of [[25_000, 0], [30_000, 0], [28_000, 1_000], [35_000, 5_000]] as const) {
  test(`group 2, round 2 (probe, cancel ${CMS / 1000} s, gap ${GAP / 1000} s): a stuck remainder whose fresh stop answered unclearly but rests at Alpaca gets no 5 minute alert over 15 minutes`, async () => {
    const w = world();
    const dd = await day(w);
    const id = await hold(w, "LUNR", 5, 12, 51);
    w.sim.advance(5_000);
    w.sim.partialTakeProfit(id, 2, 12.08);
    w.sim.cancelMs = CMS;
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    assert.ok(w.memory.stuck.get(id)?.alerted, "reported stuck first");
    w.sim.advance(GAP);
    const realSubmit = w.sim.submitSell.bind(w.sim);
    w.sim.submitSell = async (s) => {
      const o = await realSubmit(s);
      if (s.stopPrice !== undefined) {
        const { AlpacaError } = await import("../src/alpaca-trading.ts");
        throw new AlpacaError("unclear (test)", 502);
      }
      return o;
    };
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    w.sim.submitSell = realSubmit;
    assert.equal(w.memory.freshStops.get(id)?.status, "unclear");
    const before = mentions(w).length;
    for (let i = 0; i < 90; i++) {
      w.sim.advance(10_000);
      await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    }
    const late = mentions(w).slice(before).map((m) => m.text);
    assert.ok(!late.some((t) => t.includes("has no protective stop")), late.join(" | "));
    assert.equal(freshStopOrder(w, "LUNR")!.status, "accepted", "the fresh stop rests");
    assert.equal(w.sim.heldQty("LUNR"), 3);
    assert.equal(w.sim.sellLog.length, 0, "nothing sold");
  });
}

test("group 2, finding 3: a remainder waiting for its fresh stop (the take-profit's cancel outlasting the cleanup) is reported as 'could not protect or sell', and the 5 minute alert says the same", async () => {
  const w = world();
  w.sim.cancelMs = 40_000;
  const dd = await day(w);
  const id = await hold(w, "NVTS", 6, 8, 50);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 8.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const first = mentions(w).at(-1)!.text;
  assert.ok(first.includes("I could not protect or sell them yet"), first);
  assert.ok(first.includes("will post again when they have a stop, are sold, or are gone"), first);
  // Keep the cancel landing past 5 minutes so the escalation comes.
  w.sim.cancelMs = 10 * 60_000;
  w.memory.stuck.get(id)!.since -= 5 * 60_000;
  await syncOrders(w.risk, dd, { protect: true });
  const esc = mentions(w).at(-1)!.text;
  assert.ok(esc.includes("I have not been able to protect or sell it yet"), esc);
});

test("group 2, finding 4: no 5 minute alert while a remembered fresh stop (confirmed after an unclear answer) is working and covers the holding; the stuck record itself is unchanged", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "LUNR", 5, 12, 51);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 12.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const st = freshStopOrder(w, "LUNR")!;
  // As if this entry had been reported stuck earlier, and its fresh stop was then confirmed working.
  w.memory.stuck.set(id, { symbol: "LUNR", since: w.sim.simMs - 6 * 60_000, nextAt: 0, delayMs: 0, alerted: true, escalated: false, lastTriedAt: w.sim.simMs, why: "still held", protecting: true });
  w.memory.freshStops.get(id)!.status = "accepted";
  const before = mentions(w).length;
  w.sim.advance(10_000);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(mentions(w).length, before, "no escalation while protected");
  const rec = w.memory.stuck.get(id)!;
  assert.equal(rec.escalated, false, "the stuck record is unchanged");
  assert.equal(rec.alerted, true);
  // If the fresh stop ends, the escalation can still come.
  w.memory.freshStops.get(id)!.status = "canceled";
  await w.sim.cancelOrder(st.id);
  w.sim.advance(1_000);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(mentions(w).length > before, "the alert comes once the stop is gone");
});

test("group 2, finding 2: the trade digest counts a fresh stop's fill as a stop, and a take-profit once at its first fill or partial fill", async () => {
  const { rig, z } = await import("./rig.ts");
  const { order } = await import("./helpers.ts");
  const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null, atMs: number | null = null) => ({ event, order: order(o), positionQty, atMs });
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("15:00:00").getTime());
  await r.at("15:00:00");
  const counts = () => Object.fromEntries((r.worker as any).digest.counts as Map<string, number>) as Record<string, number>;
  const before = counts();
  await r.orderUpdate(upd("partial_fill", { id: "tp-1", clientOrderId: "x", symbol: "QXO", side: "sell", type: "limit", status: "partially_filled", qty: 10, filledQty: 1, groupId: "g1" }, 9) as any);
  await r.orderUpdate(upd("fill", { id: "tp-1", clientOrderId: "x", symbol: "QXO", side: "sell", type: "limit", status: "filled", qty: 10, filledQty: 10, groupId: "g1" }, 0) as any);
  await r.orderUpdate(upd("fill", { id: "fs-1", clientOrderId: "cyrus-p-20261102-RRC-x-s1", symbol: "RRC", side: "sell", type: "stop", stopPrice: 51.14, status: "filled", qty: 3, filledQty: 3, groupId: null }, 0) as any);
  // A4's case: a partial take-profit whose rest the stack cancels (its full fill never comes).
  await r.orderUpdate(upd("partial_fill", { id: "tp-2", clientOrderId: "x", symbol: "SOFI", side: "sell", type: "limit", status: "partially_filled", qty: 10, filledQty: 4, groupId: "g2" }, 6) as any);
  await r.orderUpdate(upd("canceled", { id: "tp-2", clientOrderId: "x", symbol: "SOFI", side: "sell", type: "limit", status: "canceled", qty: 10, filledQty: 4, groupId: "g2" }, null) as any);
  const after = counts();
  assert.equal((after.take_profit ?? 0) - (before.take_profit ?? 0), 2, "each take-profit counted once: one filled after a partial fill, one cancelled after a partial fill");
  assert.equal((after.stop ?? 0) - (before.stop ?? 0), 1, "the fresh stop's fill counted as a stop");
});

// ------------------------------------------------------------ A5 -------------------------------------------------------------------

async function loadEntry(w: World, symbol: string, price: number, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty: 1, stopPrice: price - 0.02, takeProfitPrice: price + 0.01, limitPrice: price, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 1, referencePrice: price, stopPrice: price - 0.02, takeProfitPrice: price + 0.01, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 5000).toISOString() });
  return id;
}

test("A5, APLD-81's shape: the entry filled as its 5 second cancel landed and Alpaca cancels both exits a moment later; the share is sold as soon as that cancel frees it, without waiting for the order sync", async () => {
  const w = world();
  const dd = await day(w);
  const id = await loadEntry(w, "APLD", 16.46, 81);
  const fillAt = w.sim.simMs;
  // Alpaca's own cancel of both exits, landing about 0.2 seconds later (the simulator's cancel time).
  for (const l of entryOf(w, id).legs) await w.sim.cancelOrder(l.id);
  const row = (await w.store.listOrders(D)).find((r) => r.clientOrderId === id)!;
  await fastLostExitSale(w.risk, dd, w.memory, row, fillAt);
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["APLD", 1]]);
  assert.ok(w.sim.sellLog[0]!.at - fillAt < 2_000, `sold ${w.sim.sellLog[0]!.at - fillAt} ms after the fill (the morning's median was 4.8 s, five over 10 s)`);
  const ev = w.events.find((e) => e.event === "lost_exit_fast")!;
  assert.equal(ev.data.symbol, "APLD");
  assert.equal(typeof ev.data.msFromFill, "number");
  w.sim.advance(3_000);
  assert.equal(w.sim.heldQty("APLD"), 0);
  assert.equal(w.sim.oversellAttempts, 0);
  // Sold and filled ("so I sold it"), or sold and reported "not filled yet" with its closing line to come (fix C of 2026-11-10).
  assert.ok(w.said.some((m) => m.text.includes("APLD: I could not confirm a live protective stop")), w.said.map((m) => m.text).join(" | "));
  assert.equal(mentions(w).length, 0);
});

test("A5: Alpaca kept the exits (it refused the cancel because the entry had filled): nothing is sold, no blocked sale is logged, no alert", async () => {
  const w = world();
  const dd = await day(w);
  const id = await loadEntry(w, "RKT", 18.2, 47);
  const fillAt = w.sim.simMs;
  const row = (await w.store.listOrders(D)).find((r) => r.clientOrderId === id)!;
  await fastLostExitSale(w.risk, dd, w.memory, row, fillAt);
  assert.equal(w.sim.sellLog.length, 0);
  assert.ok(w.sim.simMs - fillAt <= FAST_LOST_EXIT_WAIT_MS + 3_000, "it waited a bounded time");
  assert.ok(entryOf(w, id).legs.every((l) => l.status === "new"), "the exits are untouched");
  assert.ok(w.events.some((e) => e.event === "lost_exit_fast_skipped"));
  assert.ok(!w.events.some((e) => e.event === "sale_blocked"));
  assert.equal(w.said.length, 0);
});

test("A5: an entry one of whose exits already sold is not treated as lost; nor one Alpaca does not show filled", async () => {
  const w = world();
  const dd = await day(w);
  const id = await loadEntry(w, "DKNG", 35.7, 357);
  w.sim.fillExit(id, "take_profit", 35.71);
  const row = (await w.store.listOrders(D)).find((r) => r.clientOrderId === id)!;
  await fastLostExitSale(w.risk, dd, w.memory, row, w.sim.simMs);
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.said.length, 0);
});

test("A5 wiring: the entry expiry remembers when each cancel was sent, and the live updates report an entry's first fill once", async () => {
  let t = 1_000;
  const timers: Array<() => void> = [];
  const ex = new EntryExpiry({ cancelOrder: async () => undefined, wasFilled: () => false, setTimer: (fn) => void timers.push(fn), nowMs: () => t });
  ex.schedule({ clientOrderId: "cyrus-20261102-APLD-81", alpacaOrderId: "a".repeat(36), symbol: "APLD", qty: 1 }, 5_000);
  assert.equal(ex.cancelSentAt("cyrus-20261102-APLD-81"), undefined);
  t = 6_000;
  timers[0]!();
  await ex.settled();
  assert.equal(ex.cancelSentAt("cyrus-20261102-APLD-81"), 6_000);
  ex.resetDay();
  assert.equal(ex.cancelSentAt("cyrus-20261102-APLD-81"), undefined);

  const fills: string[] = [];
  const h = new OrderUpdateHandler({ getOrder: async () => null, closeOrder: async () => undefined, dropPosition: () => undefined, onEntryFill: (i) => void fills.push(`${i.symbol}:${i.atMs}`), now: () => 0 });
  const fill = (atMs: number) => ({ event: "fill", order: { id: "e1", clientOrderId: "cyrus-20261102-APLD-81", symbol: "APLD", side: "buy", qty: 1, filledQty: 1, filledAvgPrice: 16.46, status: "filled", orderClass: "bracket", type: "limit", stopPrice: null, limitPrice: 16.46, createdAt: null, filledAt: null, groupId: "g1", legs: [] }, positionQty: 1, price: 16.46, fillQty: 1, atMs }) as any;
  await h.handle(fill(100));
  await h.handle(fill(200));
  assert.deepEqual(fills, ["APLD:100"], "once per entry");

  const ups: string[] = [];
  const h2 = new OrderUpdateHandler({ getOrder: async () => null, closeOrder: async () => undefined, dropPosition: () => undefined, onFreshStopUpdate: (i) => void ups.push(`${i.event}:${i.status}`), now: () => 0 });
  await h2.handle({ event: "canceled", order: { id: "s1", clientOrderId: "cyrus-p-20261102-ADT-x-s1", symbol: "ADT", side: "sell", qty: 5, filledQty: 0, filledAvgPrice: null, status: "canceled", orderClass: "", type: "stop", stopPrice: 9.77, limitPrice: null, createdAt: null, filledAt: null, groupId: null, legs: [] }, positionQty: null, price: null, fillQty: null, atMs: 5 } as any);
  await h2.handle({ event: "canceled", order: { id: "s2", clientOrderId: "cyrus-x-20261102-ADT-x-1", symbol: "ADT", side: "sell", qty: 5, filledQty: 0, filledAvgPrice: null, status: "canceled", orderClass: "", type: "market", stopPrice: null, limitPrice: null, createdAt: null, filledAt: null, groupId: null, legs: [] }, positionQty: null, price: null, fillQty: null, atMs: 6 } as any);
  assert.deepEqual(ups, ["canceled:canceled"], "only the fresh stops (cyrus-p-)");
});

test("A5, worker level: a live fill of an entry whose 5 second cancel was already sent starts the fast sale at once; a fill before any cancel does not", async () => {
  const { rig, settle, z } = await import("./rig.ts");
  const { order } = await import("./helpers.ts");
  const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null, atMs: number | null = null) => ({ event, order: order(o), positionQty, atMs });
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.hideFilledParents = true;
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("15:00:00").getTime());
  await r.at("15:00:00");
  const mk = async (sym: string, n: number) => {
    const id = clientOrderIdFor(D, sym, n);
    await sim.submitEntry({ symbol: sym, qty: 1, stopPrice: 16.44, takeProfitPrice: 16.47, limitPrice: 16.46, referencePrice: 16.46, clientOrderId: id });
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: sym, qty: 1, referencePrice: 16.46, stopPrice: 16.44, takeProfitPrice: 16.47, status: "submitted", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: new Date(sim.simMs - 5000).toISOString() });
    return id;
  };
  const a = await mk("APLD", 81);
  const b = await mk("RKT", 47);
  // APLD: the expiry's cancel went out, then the fill arrives; Alpaca cancels both exits a moment later.
  (r.worker as any).entryExpiry.cancelSent.set(a, sim.simMs);
  sim.fillEntry(a, 16.46);
  const oa = sim.orders.find((x) => x.clientOrderId === a)!;
  for (const l of oa.legs) await sim.cancelOrder(l.id);
  await r.orderUpdate(upd("fill", { id: oa.id, clientOrderId: a, symbol: "APLD", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 16.46, groupId: oa.groupId }, 1, sim.simMs) as any);
  for (let i = 0; i < 30 && sim.sellLog.length === 0; i++) await settle();
  assert.deepEqual(sim.sellLog.map((x) => [x.symbol, x.qty]), [["APLD", 1]]);
  // RKT: filled before any cancel was sent (the usual case): its exits are live, nothing is sold.
  sim.fillEntry(b, 16.46);
  const ob = sim.orders.find((x) => x.clientOrderId === b)!;
  await r.orderUpdate(upd("fill", { id: ob.id, clientOrderId: b, symbol: "RKT", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 16.46, groupId: ob.groupId }, 1, sim.simMs) as any);
  for (let i = 0; i < 10; i++) await settle();
  assert.equal(sim.sellLog.filter((x) => x.symbol === "RKT").length, 0);
  assert.equal(sim.oversellAttempts, 0);
});

// ------------------------------------------- group 1 review, round 1 (2026-11-12, night) ----------------------------------------------

// Places a fresh stop for IREN's remainder (5 shares) and returns the world, the day and the entry.
async function freshStopped() {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "IREN", 8, 20, 30);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 3, 20.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.ok(freshStopOrder(w, "IREN"), "a fresh stop rests");
  return { w, dd, id };
}

test("finding 1, restart: a fresh-stopped remainder 11 minutes old, a new worker memory, syncs every 10 seconds with the live updates for 5 minutes: no sale, no alert, few requests", async () => {
  const { w, dd, id } = await freshStopped();
  w.sim.advance(11 * 60_000);
  w.risk.syncMemory = new SyncMemory(); // a restart: the memory of the fresh stop is gone
  const req0 = w.sim.requests;
  for (let i = 0; i < 30; i++) {
    w.sim.advance(10_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  const used = w.sim.requests - req0;
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(mentions(w).length, 0);
  assert.ok(!w.said.some((m) => /confirm a (live )?protective stop/.test(m.text)), "no \'cannot confirm a protective stop\' alert");
  assert.equal(freshStopOrder(w, "IREN")!.status, "accepted", "the fresh stop is left resting");
  assert.ok(w.risk.syncMemory.freshStops.has(id), "remembered again");
  assert.ok(w.events.some((e) => e.event === "fresh_stop_recovered"));
  assert.ok(used <= 110, `${used} requests in 5 minutes (the reviewer's probe found 266)`);
});

test("finding 1, restart with the open-orders read failing once: the sale path alone (round 2: there is no rebuild) finds the resting fresh stop, sells nothing, cancels nothing, says nothing, and remembers it", async () => {
  const { w, dd, id } = await freshStopped();
  w.sim.advance(11 * 60_000);
  w.risk.syncMemory = new SyncMemory();
  const realList = w.sim.listOrdersPaged.bind(w.sim);
  let failOnce = true;
  w.sim.listOrdersPaged = (async (status: "open" | "closed" | "all", after: string, pages: number) => {
    if (status === "open" && failOnce) {
      failOnce = false;
      throw new Error("open orders unreadable (test)");
    }
    return realList(status, after, pages);
  }) as typeof w.sim.listOrdersPaged;
  for (let i = 0; i < 9; i++) {
    w.sim.advance(10_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(freshStopOrder(w, "IREN")!.status, "accepted");
  assert.equal(mentions(w).length, 0);
  assert.equal(w.said.length, 0);
  assert.ok(w.risk.syncMemory.freshStops.has(id));
});

test("finding 2 (M10): Alpaca shows only part of the remainder free (the take-profit's cancel still landing): no stop for part of it; once all is free, one stop for all of it", async () => {
  const w = world();
  w.sim.reportQtyAvailable = true;
  const dd = await day(w);
  const id = await hold(w, "SOFI", 10, 15, 31);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 4, 15.08); // 6 left
  w.sim.staleHeld.set("SOFI", 2); // Alpaca reports only 4 of the 6 free for a moment
  const realSleep = w.sim.sleep;
  let slept = 0;
  w.sim.sleep = async (ms: number) => {
    slept += ms;
    if (slept >= 7_000) w.sim.staleHeld.delete("SOFI"); // then all 6 are free (after the first round's 6 second wait)
    return realSleep(ms);
  };
  (w.liquidator as any).sleep = w.sim.sleep;
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SOFI", 6]], "one stop, for all 6 shares");
  assert.ok(w.events.some((e) => e.event === "sale_blocked" && e.data.symbol === "SOFI" && e.data.freshStopWaitsFor === 6), "it waited while only part was free");
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("finding 2 (probe 1): the loss stop's retry cancels a resting fresh stop and sells the remainder to flat", async () => {
  const { w } = await freshStopped();
  const { LossStopMemory, enforceDailyLoss } = await import("../src/risk.ts");
  const { CONTROL_STOP } = await import("../src/store.ts");
  const { SUGGESTED_LIMITS } = await import("../src/limits.ts");
  await w.store.updateDay(D, { status: "approved", dayStartEquity: w.sim.cash + 10_000, limits: { ...SUGGESTED_LIMITS, dailyLossStopUsd: 200 }, decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "x", armed: "x" } });
  await w.store.setControl(CONTROL_STOP, { on: true, at: w.now().toISOString(), reason: "daily loss stop reached (500.00 dollars)" });
  const deps = { ...w.risk, lossMemory: new LossStopMemory() };
  for (let i = 0; i < 6 && w.sim.heldQty("IREN") > 0; i++) {
    await enforceDailyLoss(deps, (await w.store.getDay(D))!);
    w.sim.advance(5_000);
  }
  assert.equal(w.sim.heldQty("IREN"), 0, "flat");
  assert.equal(freshStopOrder(w, "IREN")!.status, "canceled", "the fresh stop was cancelled by the retry");
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["IREN", 5]]);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("finding 3: the order sync's own missing-exit sale got in first and has not filled; the fast sale finds it covered, sells nothing more, and does not alert Michael", async () => {
  const w = world();
  w.sim.sellFillDelayMs = 20_000;
  const dd = await day(w);
  const id = await loadEntry(w, "APLD", 16.46, 82);
  const fillAt = w.sim.simMs;
  w.sim.cancelExitsAtFill(id);
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["APLD", 1]], "the sync's own sale");
  const before = w.said.length;
  const row = (await w.store.listOrders(D)).find((r) => r.clientOrderId === id)!;
  await fastLostExitSale(w.risk, dd, w.memory, row, fillAt);
  assert.equal(w.sim.sellLog.length, 1, "no second sale");
  assert.equal(w.said.length, before, "nothing more said");
  assert.equal(mentions(w).length, 0);
  assert.ok(!w.memory.stuck.has(id), "not marked stuck");
  assert.ok(w.events.some((e) => e.event === "lost_exit_fast_skipped" && e.data.reason === "a sale of ours already covers it"));
  assert.equal(w.sim.oversellAttempts, 0);
});

test("A5 cost: requests used by an ordinary fast sale and by one where Alpaca kept the exits", async () => {
  const a = world();
  const ad = await day(a);
  const ida = await loadEntry(a, "APLD", 16.46, 83);
  for (const l of entryOf(a, ida).legs) await a.sim.cancelOrder(l.id);
  const ra = a.sim.requests;
  await fastLostExitSale(a.risk, ad, a.memory, (await a.store.listOrders(D)).find((r) => r.clientOrderId === ida)!, a.sim.simMs);
  const sold = a.sim.requests - ra;
  const k = world();
  const kd = await day(k);
  const idk = await loadEntry(k, "RKT", 18.2, 84);
  const rk = k.sim.requests;
  await fastLostExitSale(k.risk, kd, k.memory, (await k.store.listOrders(D)).find((r) => r.clientOrderId === idk)!, k.sim.simMs);
  const kept = k.sim.requests - rk;
  console.log(`A5 requests: ordinary fast sale ${sold}, exits kept ${kept}`);
  assert.equal(a.sim.sellLog.length, 1);
  assert.equal(k.sim.sellLog.length, 0);
  // The clock read counts here but has its own bucket at Alpaca (not the 200 a minute).
  assert.ok(sold <= 13 && kept <= 18, `ordinary ${sold}, kept ${kept}`);
});

// Group 1 review, round 1 (M5, M9): the worker's guards on the fast sale. Each case would sell APLD's share without its guard.
async function fastSaleWorld() {
  const { rig, settle, z } = await import("./rig.ts");
  const { order } = await import("./helpers.ts");
  const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null, atMs: number | null = null) => ({ event, order: order(o), positionQty, atMs });
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.hideFilledParents = true;
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("15:00:00").getTime());
  await r.at("15:00:00");
  const id = clientOrderIdFor(D, "APLD", 85);
  await sim.submitEntry({ symbol: "APLD", qty: 1, stopPrice: 16.44, takeProfitPrice: 16.47, limitPrice: 16.46, referencePrice: 16.46, clientOrderId: id });
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "APLD", qty: 1, referencePrice: 16.46, stopPrice: 16.44, takeProfitPrice: 16.47, status: "submitted", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: new Date(sim.simMs - 5000).toISOString() });
  const fire = async () => {
    (r.worker as any).entryExpiry.cancelSent.set(id, sim.simMs);
    sim.fillEntry(id, 16.46);
    const o = sim.orders.find((x) => x.clientOrderId === id)!;
    for (const l of o.legs) await sim.cancelOrder(l.id);
    await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: "APLD", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 16.46, groupId: o.groupId }, 1, sim.simMs) as any);
    for (let i = 0; i < 30; i++) await settle();
  };
  return { sim, r, fire, z };
}

test("finding 2 (M5, M9): no fast sale while the mid-day close-out owns selling, while a close-out runs, at or after the close-out time, or while the daily loss stop is in force", async () => {
  {
    const f = await fastSaleWorld();
    (f.r.worker as any).middayOwnsSelling = true;
    await f.fire();
    assert.equal(f.sim.sellLog.length, 0, "mid-day close-out owns selling");
  }
  {
    const f = await fastSaleWorld();
    (f.r.worker as any).closingOut = true;
    await f.fire();
    assert.equal(f.sim.sellLog.length, 0, "a close-out is running");
  }
  {
    const f = await fastSaleWorld();
    (f.r.worker as any).inflight.add("carried");
    await f.fire();
    assert.equal(f.sim.sellLog.length, 0, "a carried-position sale is running");
  }
  {
    const f = await fastSaleWorld();
    f.r.setNow("20:55:00"); // the close-out time (5 minutes before the 3:00 PM Central close)
    f.sim.advanceTo(f.z("20:55:00").getTime());
    await f.fire();
    assert.equal(f.sim.sellLog.length, 0, "at the close-out time");
  }
  {
    const f = await fastSaleWorld();
    const { CONTROL_STOP } = await import("../src/store.ts");
    await f.r.store.setControl(CONTROL_STOP, { on: true, at: new Date(f.sim.simMs).toISOString(), reason: "daily loss stop reached (250.00 dollars)" });
    await f.fire();
    assert.equal(f.sim.sellLog.length, 0, "the daily loss stop is in force");
  }
  {
    const f = await fastSaleWorld();
    await f.fire();
    assert.deepEqual(f.sim.sellLog.map((x) => [x.symbol, x.qty]), [["APLD", 1]], "and with none of these, it sells");
  }
});

// ------------------------------------------- group 1 review, round 2 (2026-11-12, night) ----------------------------------------------
// A fresh stop counts as protection only when it covers the symbol's whole holding. With two positions on one symbol: E1 (the older) keeps
// its resting fresh stop untouched (never re-sold, no alert: the order sync only ever checks the newest entry of a symbol); E2 (the newer)
// is checked as before, so if it loses its exits it is sold, or reported if its shares are still held by a cancel landing.

// E1: 5 shares, partial take-profit of 2, fresh stop for 3. Then E2: 4 shares of the same symbol, bought later, with its bracket.
async function twoOnOneSymbol() {
  const w = world();
  const dd = await day(w);
  const e1 = await hold(w, "SOUN", 5, 10, 40);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(e1, 2, 10.08);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["SOUN", 3]], "E1's fresh stop");
  w.sim.advance(60_000);
  const e2 = await hold(w, "SOUN", 4, 10.2, 41);
  assert.equal(w.sim.heldQty("SOUN"), 7);
  return { w, dd, e1, e2 };
}
const e1StopResting = (w: World) => freshStopOrder(w, "SOUN")!.status === "accepted";

test("round 2, PA as a restart: E1's 3-share fresh stop rests, E2 (4 shares) loses its exits, a new worker memory 11 minutes on: E2 is sold, E1 keeps its stop, is not re-sold, no alert, bounded requests", async () => {
  const { w, dd, e2 } = await twoOnOneSymbol();
  w.sim.advance(11 * 60_000);
  w.risk.syncMemory = new SyncMemory(); // a restart
  for (const l of entryOf(w, e2).legs) await w.sim.cancelOrder(l.id); // E2's exits are lost
  const req0 = w.sim.requests;
  for (let i = 0; i < 18; i++) {
    w.sim.advance(10_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  const used = w.sim.requests - req0;
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["SOUN", 4]], "E2's 4 shares sold; E1's 3 never re-sold");
  assert.equal(w.sim.heldQty("SOUN"), 3, "E1's 3 shares, still held");
  assert.ok(e1StopResting(w), "E1's fresh stop still rests");
  assert.ok(w.said.some((m) => m.text.includes("SOUN: I could not confirm a live protective stop, so I sold it")), "E2's sale is reported");
  assert.equal(mentions(w).length, 0, "no alert to Michael");
  assert.equal(w.sim.oversellAttempts, 0);
  // 91 measured: 18 syncs (2 each), E2's sale, and E1's stop looked up every 30 seconds once it is older than the sync's 10 minute read.
  assert.ok(used <= 100, `${used} requests in 3 minutes`);
});

test("round 2, PB2: E2's take-profit partly fills and its cancel takes 40 seconds; E1's fresh stop does not stand in for E2: E2 is reported once, then sold when the cancel lands; E1 is not re-sold", async () => {
  const { w, dd, e2 } = await twoOnOneSymbol();
  w.sim.cancelMs = 40_000;
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(e2, 1, 10.28); // E2: 3 shares left on its take-profit, its stop cancelled
  const req0 = w.sim.requests;
  for (let i = 0; i < 12; i++) {
    w.sim.advance(10_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    // While both positions are held (6 shares), E1's 3-share stop never counts as E2's protection, in memory or in the sale path.
    if (w.sim.heldQty("SOUN") > 3) {
      assert.ok(!w.memory.freshStops.has(e2), `sync ${i}: E1's stop must not stand in for E2`);
      assert.ok(!w.events.some((e) => e.event === "fresh_stop_recovered" && e.data.clientOrderId === e2), `sync ${i}: not adopted for E2`);
    }
  }
  const used = w.sim.requests - req0;
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["SOUN", 3]], "E2's 3 shares sold once its take-profit's cancel landed; E1's 3 never re-sold");
  assert.equal(w.sim.stopLog.length, 1, "no fresh stop for E2 (not the whole holding)");
  assert.equal(w.sim.heldQty("SOUN"), 3);
  assert.ok(e1StopResting(w));
  assert.ok(mentions(w).length <= 1, "E2 reported at most once while its shares were held by the cancel landing");
  assert.ok(mentions(w).every((m) => m.text.includes("SOUN") && !m.text.includes("5 shares")), "never about E1's shares");
  assert.equal(w.sim.oversellAttempts, 0);
  // 151 measured: most is release 1's retry, at every sync, of a sale held by a visible cancel still landing (E2's take-profit, 40 s).
  assert.ok(used <= 165, `${used} requests in 2 minutes`);
});

test("round 2, inside 10 minutes: E1's fresh stop is in the sync's own order list, E2 loses its exits: E2 is not skipped (sold in the same sync), E1 is not re-sold, no alert", async () => {
  const { w, dd, e2 } = await twoOnOneSymbol();
  for (const l of entryOf(w, e2).legs) await w.sim.cancelOrder(l.id);
  w.sim.advance(1_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["SOUN", 4]], "E2 sold at once, not left for up to 10 minutes");
  for (let i = 0; i < 6; i++) {
    w.sim.advance(10_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.equal(w.sim.sellLog.length, 1, "E1 never re-sold");
  assert.equal(w.sim.heldQty("SOUN"), 3);
  assert.ok(e1StopResting(w));
  assert.equal(mentions(w).length, 0);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("round 2, P3c: the order sync's cleanup is past its checks when the fast sale's sale goes out first and has not filled; the sync's cleanup finds the share covered by our own sale: no second sale, not stuck, no alert", async () => {
  const w = world();
  w.sim.sellFillDelayMs = 20_000;
  const dd = await day(w);
  const id = await loadEntry(w, "APLD", 16.46, 86);
  const fillAt = w.sim.simMs;
  w.sim.cancelExitsAtFill(id);
  const row = (await w.store.listOrders(D)).find((r) => r.clientOrderId === id)!;
  // The sync's cleanup looks the entry up (after its protect check); at that moment the fast sale runs to the end and sends its sale.
  const realFind = w.sim.findOrderByClientId.bind(w.sim);
  let hooked = false;
  w.sim.findOrderByClientId = async (cid: string) => {
    const o = await realFind(cid);
    if (!hooked && cid === id) {
      hooked = true;
      await fastLostExitSale(w.risk, dd, w.memory, row, fillAt); // its own lookup comes back here with `hooked` set
    }
    return o;
  };
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(hooked);
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["APLD", 1]], "one sale, the fast sale's");
  assert.equal(mentions(w).length, 0);
  assert.ok(!w.memory.stuck.has(id), "not marked stuck");
  assert.ok(w.events.some((e) => e.event === "cleanup_covered_by_own_sale" && e.data.symbol === "APLD"));
  assert.equal(w.sim.oversellAttempts, 0);
});

test("round 2, the second guard: even if the worker's memory wrongly tied E1's 3-share stop to E2, it does not count while 7 shares are held; E2's lost exits are sold", async () => {
  const { w, dd, e2 } = await twoOnOneSymbol();
  const st = freshStopOrder(w, "SOUN")!;
  w.memory.freshStops.set(e2, { symbol: "SOUN", entryClientOrderId: e2, stopClientOrderId: st.clientOrderId, orderId: st.id, qty: 3, stopPrice: st.stopPrice ?? 0, placedAt: w.sim.simMs, status: "accepted", lookedAt: w.sim.simMs });
  w.sim.advance(11 * 60_000); // E1's stop is out of the sync's 10 minute list
  for (const l of entryOf(w, e2).legs) await w.sim.cancelOrder(l.id);
  w.sim.advance(1_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["SOUN", 4]]);
  assert.ok(e1StopResting(w));
  assert.equal(mentions(w).length, 0);
});

test("A and C: in the afternoon load window the same 1-share limit entries get the 5 second cancel, and an entry that fills after it gets the fast sale (A5)", async () => {
  const { rig, settle, z } = await import("./rig.ts");
  const { order } = await import("./helpers.ts");
  const { LOAD_AFTERNOON_PHASE, LOAD_ENTRY_WAIT_MS, hasLoadEntries } = await import("../src/load-mode.ts");
  const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null, atMs: number | null = null) => ({ event, order: order(o), positionQty, atMs });
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.hideFilledParents = true;
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const { MIDDAY_PHASE } = await import("../src/midday.ts");
  await r.at("16:30:00"); // the mid-day pause and its close-out (flat: nothing held)
  for (let i = 0; i < 200 && !(await r.store.getDay(D))!.phases[MIDDAY_PHASE]; i++) await settle();
  assert.ok((await r.store.getDay(D))!.phases[MIDDAY_PHASE], "the mid-day close-out finished");
  sim.advanceTo(z("18:00:00").getTime()); // 12:00 PM Central
  await r.at("18:00:00");
  const dd = (await r.store.getDay(D))!;
  await r.store.updateDay(D, { phases: { ...dd.phases, [LOAD_AFTERNOON_PHASE]: z("17:45:00").toISOString() } });
  assert.ok(hasLoadEntries((await r.store.getDay(D))!), "the afternoon load window gives load entries (1-share limit buys)");
  const id = clientOrderIdFor(D, "RIOT", 90);
  const sent = await sim.submitEntry({ symbol: "RIOT", qty: 1, stopPrice: 15.18, takeProfitPrice: 15.21, limitPrice: 15.2, referencePrice: 15.2, clientOrderId: id });
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "RIOT", qty: 1, referencePrice: 15.2, stopPrice: 15.18, takeProfitPrice: 15.21, status: "submitted", alpacaOrderId: sent.id, filledQty: null, filledAvgPrice: null, note: null, createdAt: new Date(sim.simMs).toISOString() });
  // What the gate does for a limit entry (gate.ts onLimitEntrySent): the worker's 5 second wait.
  (r.worker as any).entryExpiry.schedule({ clientOrderId: id, alpacaOrderId: sent.id, symbol: "RIOT", qty: 1 }, LOAD_ENTRY_WAIT_MS);
  r.setNow("18:00:05.1"); // the wait is over: the cancel is sent
  sim.advanceTo(z("18:00:05.1").getTime());
  for (let i = 0; i < 10; i++) await settle();
  assert.ok((r.worker as any).entryExpiry.cancelSentAt(id) !== undefined, "the cancel was sent");
  // Alpaca fills the entry as the cancel lands, and cancels both exits.
  const o = sim.orders.find((x) => x.clientOrderId === id)!;
  o.status = "new";
  sim.fillEntry(id, 15.2);
  sim.cancelExitsAtFill(id);
  await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: "RIOT", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 15.2, groupId: o.groupId }, 1, sim.simMs) as any);
  for (let i = 0; i < 30 && sim.sellLog.length === 0; i++) await settle();
  assert.deepEqual(sim.sellLog.map((x) => [x.symbol, x.qty]), [["RIOT", 1]]);
  assert.equal(sim.oversellAttempts, 0);
});
