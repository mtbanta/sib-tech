// Michael's rulings of 2026-11-14 (night) on part 2 of the redesign, and his two answers after them, with the reviewers' probes of rulings
// round 1 turned into tests: ordinary stuck retries stop at 45 of the budget's 60 a minute, so urgent work keeps room (group 1's finding 1,
// group 2's B3); a remainder already being protected keeps its fresh stop only before any fresh stop was recorded for it (group 1's finding
// 2); `asRemainder` is logged (group 2's B2); the "sold" resolution line's 2 minute window (group 2's note).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { STUCK_RETRY_MINUTE_CAP, SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { AlpacaError } from "../src/alpaca-trading.ts";
import { RequestBudget, Reservation } from "../src/request-budget.ts";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, D } from "./rig.ts";
import { FakeBot } from "./helpers.ts";

const iso = (ms: number) => new Date(ms).toISOString();

// ---------------- the worker: one stuck position never starves urgent work ----------------

async function workerWorld() {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const ev: Array<{ t: number; e: string; d: any }> = [];
  const r: any = rig({ broker: sim, sleep: sim.sleep, simClock: sim, bot, log: (_l: string, e: string, d?: any) => void ev.push({ t: sim.simMs, e, d }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const wk: any = r.worker;
  const hold = async (symbol: string) => {
    const id = clientOrderIdFor(D, symbol, 1);
    await sim.submitEntry({ symbol, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
    return id;
  };
  // The regular 5 second passes keep their own schedule across calls (group 1, rulings round 2: a drive that restarted it never ran them).
  let nextPass = sim.simMs + 5_000;
  const drive = async (end: number) => {
    for (let g = 0; g < 5000; g++) {
      const tAll = Math.min(...r.timers(), Infinity);
      const next = Math.min(nextPass, tAll);
      if (next > end) break;
      if (next === nextPass) {
        await r.at(iso(next));
        nextPass += 5_000;
      } else r.setNow(iso(Math.max(next, sim.simMs)));
      await settle();
      await settle();
    }
    r.setNow(iso(Math.max(end, sim.simMs)));
  };
  return { sim, r, wk, ev, hold, drive };
}

// Group 1's probe P8: S stuck with every sale refused (one-round retries of 10, under ruling 1); T has a timed-out fresh stop and no stop at
// Alpaca, so its try needs 13. Before the 45 cap, T was never sold in 300 s; with it, T is sold within seconds.
for (const delay of [30_000, 45_000]) {
  test(`Michael's answer (45 for stuck retries): with another position stuck and every sale refused, a timed-out position's try (13) still gets room (it becomes due ${delay / 1000} s after the other got stuck)`, async () => {
    const { sim, r, wk, hold, drive } = await workerWorld();
    const S = await hold("QXA");
    const T = await hold("QXB");
    await r.at("14:30:10");
    for (const l of sim.orders.find((o: any) => o.clientOrderId === S)!.legs) await sim.cancelOrder(l.id);
    sim.refuseSellIf = (x: any) => x.symbol === "QXA";
    const sold: string[] = [];
    const realSell = sim.submitSell.bind(sim);
    sim.submitSell = async (x: any) => (sold.push(x.symbol), realSell(x));
    const t0 = sim.simMs;
    await drive(t0 + delay);
    for (const l of sim.orders.find((o: any) => o.clientOrderId === T)!.legs) await sim.cancelOrder(l.id);
    const mem = wk.syncMemory;
    mem.timedOutStops.set("cyrus-p-20261102-QXB-x-s1", T);
    mem.stuck.set(T, { symbol: "QXB", since: sim.simMs, nextAt: 0, delayMs: 0, alerted: true, escalated: false, lastTriedAt: sim.simMs, why: "x" });
    const tT = sim.simMs;
    wk.loop.wake(T, sim.simMs, "protect");
    while (sim.simMs < tT + 60_000 && sim.heldQty("QXB") > 0) await drive(sim.simMs + 1_000);
    assert.equal(sim.heldQty("QXB"), 0, "T sold");
    // With the regular passes running, within seconds (group 1 measured at most 10 s; the code before the rulings 57 to 59 s at worst).
    assert.ok(sim.simMs - tT <= 15_000, `within 15 s: ${sim.simMs - tT} ms`);
    assert.ok(sold.filter((x) => x === "QXA").length > 3, "S kept retrying meanwhile");
    assert.equal(wk.budget.totals.overdraft, 0);
    r.worker.stop?.();
  });
}

// Group 2's B3 and group 1's probe P10: S stuck with every sale refused; a second position's remainder gets a fresh stop whose answer is
// unclear but which rests at Alpaca. Its lookup (urgent work) gets room: confirmed, never timed out, nothing sold, no mention for it.
test("Michael's answer (45 for stuck retries): with another position stuck and every sale refused, an unclear fresh stop's lookup still gets room; confirmed, nothing of it sold, no 15 second limit", async () => {
  const { sim, r, wk, ev, hold, drive } = await workerWorld();
  const S = await hold("QXA");
  const U = await hold("QXU");
  await r.at("14:30:10");
  for (const l of sim.orders.find((o: any) => o.clientOrderId === S)!.legs) await sim.cancelOrder(l.id);
  sim.refuseSellIf = (x: any) => x.symbol === "QXA";
  const realSell = sim.submitSell.bind(sim);
  sim.submitSell = async (x: any) => {
    if (x.symbol === "QXU" && x.stopPrice !== undefined) {
      await realSell(x); // Alpaca took it
      throw new AlpacaError("unclear (test)", 502);
    }
    return realSell(x);
  };
  const t0 = sim.simMs;
  await drive(t0 + 40_000); // S has reserved 40 of the minute (a fifth retry would pass its 45)
  const tU = sim.simMs;
  sim.partialTakeProfit(U, 2, 12.08);
  wk.loop.wake(U, sim.simMs, "protect");
  await drive(tU + 60_000);
  const uEv = (name: string) => ev.filter((x) => x.t >= tU && x.e === name && JSON.stringify(x.d ?? {}).includes("QXU"));
  assert.equal(uEv("fresh_stop_confirmed").length, 1, "confirmed by its lookup");
  assert.equal(uEv("fresh_stop_timeout").length, 0, "the 15 second limit never fired");
  assert.equal(sim.heldQty("QXU"), 3, "the remainder kept (its stop rests)");
  assert.ok(!r.bot.posts.some((p: any) => p.text.includes("QXU") && /not confirmed within 15 seconds/.test(p.text)), "no 15 second alert");
  assert.ok(wk.budget.peak.minute <= 60);
  r.worker.stop?.();
});

test("Michael's answer: the cap is 45 of the 60", () => {
  assert.equal(STUCK_RETRY_MINUTE_CAP, 45);
  let t = 0;
  const b = new RequestBudget({ now: () => t });
  const reserve = () => b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP, fiveSec: false });
  const held: Reservation[] = [];
  for (let i = 0; i < 4; i++) held.push(reserve() as Reservation);
  assert.ok(held.every((x) => x instanceof Reservation), "40 fit");
  const fifth = reserve();
  assert.ok(!(fifth instanceof Reservation) && fifth.why === "class", "a fifth (50) would pass 45");
  assert.ok(b.tryReserve("P1", 13, { label: "timed-out stop try", fiveSec: false }) instanceof Reservation, "urgent work still fits (53 of 60)");
});

// ---------------- the remainder rule, exactly Michael's answer ----------------

function syncWorld() {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const events: any[] = [];
  const log = (event: string, data?: any) => void events.push({ event, data });
  const said: any[] = [];
  const say = async (ch: string, text: string, o?: any) => (said.push({ ch, text, mention: o?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const risk: any = { broker: sim, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  return { sim, events, said, store, now, memory, risk };
}

async function stuckRemainder(w: ReturnType<typeof syncWorld>) {
  await ensureDay({ store: w.store, broker: w.sim, now: w.now } as any, D);
  const dd = (await w.store.getDay(D))!;
  const id = clientOrderIdFor(D, "LUNR", 51);
  await w.sim.submitEntry({ symbol: "LUNR", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  w.sim.fillEntry(id, 12);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "LUNR", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 12.08);
  w.sim.cancelMs = 25_000; // the take-profit's cancel outlasts the first try
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.ok(w.memory.stuck.get(id)?.protecting, "stuck, being protected");
  return { dd, id };
}

const freshStops = (w: ReturnType<typeof syncWorld>) => w.sim.orders.filter((o: any) => o.symbol === "LUNR" && o.side === "sell" && o.type === "stop" && o.clientOrderId.startsWith("cyrus-p-"));

test("Michael's answer on ruling 1: a remainder being protected, seen with no exits once its own take-profit cancel landed, gets its fresh stop (logged asRemainder), not a market sale", async () => {
  const w = syncWorld();
  const { dd, id } = await stuckRemainder(w);
  w.sim.advance(26_000); // the take-profit's cancel has landed: no exits at all
  w.memory.stuck.get(id)!.nextAt = 0;
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const up = w.events.filter((e) => e.event === "unprotected_position");
  assert.equal(up.length, 1);
  assert.equal(up[0].data.asRemainder, true, "logged as a remainder");
  assert.equal(freshStops(w).length, 1, "its fresh stop placed");
  assert.equal(w.sim.sellLog.filter((x: any) => x.symbol === "LUNR").length, 0, "not sold at market");
});

// Group 1's probe P9: the retry's fresh stop answered unclearly and was then confirmed (the stuck record stays); then that fresh stop ends
// (cancelled in the dashboard). Sold at market, as A4's rule says, not a second fresh stop.
test("rulings round 1 (group 1, finding 2): after a fresh stop was recorded and later ended, the remainder is sold at market as before, never given a second fresh stop", async () => {
  const w = syncWorld();
  const { dd, id } = await stuckRemainder(w);
  w.memory.stuck.get(id)!.nextAt = 0;
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (s: any) => {
    const o = await realSubmit(s);
    if (s.stopPrice !== undefined) throw new AlpacaError("unclear (test)", 502);
    return o;
  };
  for (let i = 0; i < 40 && !w.memory.freshStops.has(id); i++) {
    const r: any = await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    if (!w.memory.freshStops.has(id)) w.sim.advanceTo(Math.max(w.sim.simMs + 500, r.recheckAt ?? 0));
  }
  w.sim.submitSell = realSubmit;
  for (let i = 0; i < 4; i++) {
    w.sim.advance(2_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.equal(w.memory.freshStops.get(id)?.status, "accepted", "confirmed by its lookup");
  assert.ok(w.memory.stuck.get(id)?.freshStopRecorded, "a fresh stop is recorded for it");
  await w.sim.cancelOrder(freshStops(w)[0]!.id); // cancelled in the dashboard
  w.sim.advance(20_000);
  for (let i = 0; i < 6; i++) {
    w.sim.advance(3_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.equal(freshStops(w).length, 1, "never a second fresh stop");
  assert.deepEqual(w.sim.sellLog.filter((x: any) => x.symbol === "LUNR").map((x: any) => x.qty), [3], "sold at market");
  assert.ok(w.events.filter((e) => e.event === "unprotected_position").every((e) => !e.data.asRemainder));
  assert.equal(w.sim.oversellAttempts, 0);
});

// Group 1's probe P11: the retry's fresh stop answered unclearly and the 15 second limit timed it out while the budget had no room; the
// later sale is a market sale (ruling B), never a fresh stop.
test("rulings round 1 (group 1, finding 2): a timed-out fresh stop's remainder is sold at market, never given a fresh stop", async () => {
  const w = syncWorld();
  const { dd, id } = await stuckRemainder(w);
  w.memory.stuck.get(id)!.nextAt = 0;
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (s: any) => {
    if (s.stopPrice !== undefined) throw new AlpacaError("unclear (test)", 502); // never reached Alpaca
    return realSubmit(s);
  };
  for (let i = 0; i < 40 && !w.memory.freshStops.has(id); i++) {
    const r: any = await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    if (!w.memory.freshStops.has(id)) w.sim.advanceTo(Math.max(w.sim.simMs + 500, r.recheckAt ?? 0));
  }
  w.sim.submitSell = realSubmit;
  w.memory.budget ??= new RequestBudget({ now: () => w.sim.simMs, remaining: () => 200 });
  const other = w.memory.budget.tryReserve("P1", 60, { label: "other P1 work", fiveSec: false });
  assert.ok(other instanceof Reservation);
  for (let i = 0; i < 9; i++) {
    w.sim.advance(2_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.equal(w.memory.timedOutStops.size, 1, "timed out");
  other.end();
  for (let i = 0; i < 8; i++) {
    w.sim.advance(3_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.equal(freshStops(w).length, 0, "never a fresh stop at Alpaca");
  assert.deepEqual(w.sim.sellLog.filter((x: any) => x.symbol === "LUNR").map((x: any) => x.qty), [3], "sold at market");
  assert.ok(w.events.filter((e) => e.event === "unprotected_position").every((e) => !e.data.asRemainder));
});

// ---------------- the "sold" resolution line's window (group 2's note) ----------------

for (const [agoMs, line] of [[60_000, "sold"], [150_000, "no longer held"]] as const) {
  test(`ruling 1's messaging: a stuck entry whose shares go ${agoMs / 1000} s after a retry's unfilled sale is reported "${line}"`, async () => {
    const w = syncWorld();
    await ensureDay({ store: w.store, broker: w.sim, now: w.now } as any, D);
    const dd = (await w.store.getDay(D))!;
    const id = clientOrderIdFor(D, "IONQ", 125);
    await w.sim.submitEntry({ symbol: "IONQ", qty: 2, stopPrice: 33, takeProfitPrice: 34.5, referencePrice: 33.88, clientOrderId: id });
    w.sim.fillEntry(id, 33.88);
    await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "IONQ", qty: 2, referencePrice: 33.88, stopPrice: 33, takeProfitPrice: 34.5, status: "filled", alpacaOrderId: null, filledQty: 2, filledAvgPrice: 33.88, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
    for (const l of w.sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await w.sim.cancelOrder(l.id);
    w.sim.advance(20_000);
    w.memory.stuck.set(id, { symbol: "IONQ", since: w.sim.simMs - 300_000, nextAt: w.sim.simMs + 60_000, delayMs: 0, alerted: true, escalated: true, lastTriedAt: w.sim.simMs, why: "x", saleSentAt: w.sim.simMs - agoMs } as any);
    await w.sim.submitSell({ symbol: "IONQ", qty: 2, clientOrderId: "elsewhere-1" } as any); // the shares leave
    w.sim.advance(3_000);
    await syncOrders(w.risk, dd, { protect: true });
    w.sim.advance(3_000);
    await syncOrders(w.risk, dd, { protect: true });
    const lines = w.said.filter((m) => m.ch === "alerts" && m.text.startsWith("IONQ: "));
    assert.equal(lines.length, 1, lines.map((m) => m.text).join(" | "));
    assert.ok(lines[0].text.startsWith(`IONQ: ${line} (`), lines[0].text);
  });
}

// ---------------- Michael's answer after group 1's rulings round 2: rechecks leave room for a waiting stuck retry ----------------

test("Michael's answer (rechecks leave room): while a capped stuck retry waits and P2 is what keeps it out, P2 may draw only up to 35 of the minute; the retry gets in at 35", () => {
  let t = 0;
  const b = new RequestBudget({ now: () => t });
  for (let i = 0; i < 38; i++) {
    t = i * 1_000;
    const r = b.tryReserve("P2", 1, { label: "list lag recheck", fiveSec: false }) as Reservation;
    assert.ok(r instanceof Reservation);
    r.charge("/v2/test");
    r.end();
  }
  t = 38_000;
  assert.ok(b.roomFor("P2", 1, false).ok, "before any retry waits, P2 may go to 40");
  const retry = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(!(retry instanceof Reservation) && retry.why === "class", "38 + 10 passes 45");
  // The hold lasts until the retry looks again (when room may return), not only a moment: else P2 takes the room back meanwhile.
  assert.ok((b as any).retryWaitUntil >= retry.at + 500 && retry.at - t > 3_000, `held until the retry's next look (${(b as any).retryWaitUntil - t} ms)`);
  const p2 = b.tryReserve("P2", 1, { label: "list lag recheck", fiveSec: false });
  assert.ok(!(p2 instanceof Reservation) && p2.why === "class", "P2 holds back above 35 while the retry waits");
  t = 62_500; // the requests sent at 0, 1 and 2 s have aged out: 35 left
  assert.equal(b.inUse().minute, 35);
  assert.ok(b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) instanceof Reservation, "the retry gets in at 35");
});

test("Michael's answer (rechecks leave room): P2 keeps its share when holding back would not help (the stuck retries' own use fills their 45), and the hold lapses when the retry stops looking", () => {
  let t = 0;
  const b: any = new RequestBudget({ now: () => t });
  for (let i = 0; i < 4; i++) {
    t = i * 6_000;
    const r = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP, fiveSec: false }) as Reservation;
    for (let k = 0; k < 10; k++) r.charge("/v2/test");
    r.end();
  }
  t = 24_000;
  const fifth = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(!(fifth instanceof Reservation), "its own 40 keep a fifth out");
  assert.ok(b.retryWaitUntil <= t, "no hold on P2: it would not help");
  // a retry kept out by P2 sets the hold, which lapses once the retry stops looking
  const b2: any = new RequestBudget({ now: () => t });
  t = 0;
  const p2 = b2.tryReserve("P2", 38, { label: "list lag recheck", fiveSec: false }) as Reservation;
  for (let k = 0; k < 38; k++) p2.charge("/v2/test");
  p2.end();
  b2.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(b2.retryWaitUntil > t, "held");
  t = b2.retryWaitUntil;
  assert.ok(b2.roomFor("P2", 1, false).ok, "lapsed: P2 may go to 40 again");
});

test("group 1, rulings round 2 (finding 2): a timed-out stop's try is not under the 45: it starts with 40 budgeted requests already in the minute", async () => {
  const w = syncWorld();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now } as any, D);
  const dd = (await w.store.getDay(D))!;
  const id = clientOrderIdFor(D, "QXB", 1);
  await w.sim.submitEntry({ symbol: "QXB", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  w.sim.fillEntry(id, 12);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "QXB", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  for (const l of w.sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await w.sim.cancelOrder(l.id);
  w.sim.advance(20_000);
  w.memory.timedOutStops.set("cyrus-p-test-QXB", id);
  w.memory.stuck.set(id, { symbol: "QXB", since: w.sim.simMs - 30_000, nextAt: 0, delayMs: 0, alerted: true, escalated: false, lastTriedAt: w.sim.simMs - 30_000, why: "x" } as any);
  w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => 200 });
  for (let i = 0; i < 4; i++) {
    const r = w.memory.budget.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP, fiveSec: false }) as Reservation;
    for (let k = 0; k < 10; k++) r.charge("/v2/test");
    r.end();
  }
  w.sim.advance(6_000); // out of the 5 seconds, still in the minute (40)
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(w.sim.sellLog.filter((x: any) => x.symbol === "QXB").map((x: any) => x.qty), [5], "tried and sold (53 of 60; an ordinary retry would be held to 45)");
});

// Group 1's probe P13d, rulings round 2: the order list keeps lagging (list-lag rechecks, P2, chained 30 s windows through the loop) from 90 s
// before a position gets stuck with every sale refused, for 180 s after. The stuck sale is retried within a minute throughout (before the
// fix: no retry for 204 s), and the rechecks still get room.
test("Michael's answer (rechecks leave room): with the order list lagging throughout, a stuck sale is still retried within a minute, and the rechecks still get room", async () => {
  const { sim, r, wk, hold } = await workerWorld();
  const S = await hold("QSA");
  const L: string[] = [];
  for (let i = 0; i < 11; i++) L.push(await hold("QL" + String.fromCharCode(65 + i)));
  await r.at("14:30:10");
  const lagRes: Record<string, number> = {};
  const realTry = wk.budget.tryReserve.bind(wk.budget);
  wk.budget.tryReserve = (cls: any, n: any, o: any) => {
    const x = realTry(cls, n, o);
    if (o?.label === "list lag recheck") lagRes[x.ok === false ? x.why : "granted"] = (lagRes[x.ok === false ? x.why : "granted"] ?? 0) + 1;
    return x;
  };
  const sells: number[] = [];
  const realSell = sim.submitSell.bind(sim);
  const tL = sim.simMs;
  const t0 = tL + 90_000;
  let stuckOn = false;
  sim.submitSell = async (x: any) => {
    if (x.symbol === "QSA") sells.push(sim.simMs - t0);
    return realSell(x);
  };
  const win = L.map((id, i) => ({ id, from: tL + i * 25_000, until: tL + i * 25_000 + 30_000, tries: 0 }));
  const reWake = () => {
    const now = sim.simMs;
    const pend = wk.loop.pendingWakes();
    for (const w of win) {
      if (now < w.from || now >= w.until || pend.has(w.id)) continue;
      const gap = Math.min(500 * 2 ** w.tries, 2_000);
      w.tries++;
      wk.loop.wake(w.id, now + (w.tries === 1 ? 0 : gap), "lag", { extraRequests: 1, untilMs: w.until });
    }
  };
  let nextPass = sim.simMs + 5_000;
  let nextTick = sim.simMs + 250;
  for (let g = 0; g < 40_000; g++) {
    const next = Math.min(nextPass, Math.min(...r.timers(), Infinity), nextTick);
    if (next > t0 + 180_000) break;
    if (next === nextPass) {
      await r.at(iso(next));
      nextPass += 5_000;
    } else {
      r.setNow(iso(Math.max(next, sim.simMs)));
      if (next === nextTick) nextTick += 250;
    }
    if (!stuckOn && sim.simMs >= t0) {
      stuckOn = true;
      for (const l of sim.orders.find((o: any) => o.clientOrderId === S)!.legs) await sim.cancelOrder(l.id);
      sim.refuseSellIf = (x: any) => x.symbol === "QSA";
    }
    await settle();
    await settle();
    reWake();
  }
  const gaps = sells.slice(1).map((t, i) => t - sells[i]!);
  assert.ok(sells.length >= 8, `retried: ${sells.length} tries`);
  assert.ok(Math.max(...gaps) <= 60_000, `never more than a minute between tries: ${Math.max(...gaps)} ms`);
  assert.ok((lagRes.granted ?? 0) >= 10, `the rechecks still got room: ${JSON.stringify(lagRes)}`);
  assert.equal(wk.budget.totals.overdraft, 0);
  r.worker.stop?.();
});

// Group 2, rulings round 3 (finding 2): the hold from below and its length. While a waiting stuck retry holds P2 back, P2 is granted up to 35
// of the minute and 5 in the 5 seconds (one above each is refused); the hold is set to exactly those values when a retry of 10 under its 45
// is refused with P2 in the way, and it ends at the later of 2.5 s after the refusal and the time room may return plus 0.5 s.
test("rulings round 3: a refused stuck retry sets the hold to 35 of the minute and 5 in the 5 seconds, ending at the later of 2.5 s and its room time plus 0.5 s", () => {
  let t = 0;
  const b: any = new RequestBudget({ now: () => t });
  for (let i = 0; i < 6; i++) {
    t = 36_000 + i * 800; // six P2 requests in the last 5 seconds
    const r = b.tryReserve("P2", 1, { label: "list lag recheck" }) as Reservation;
    r.charge("/v2/test");
    r.end();
  }
  t = 40_100;
  const retry = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(!(retry instanceof Reservation) && retry.why === "five", "6 + 10 passes 15 in the 5 seconds");
  assert.equal(b.retryWaitRoom, 35);
  assert.equal(b.retryWaitFive, 5);
  assert.equal(b.retryWaitUntil, Math.max(t + 2_500, retry.at + 500), "the hold's end");
  const p2 = b.tryReserve("P2", 1, { label: "list lag recheck" });
  assert.ok(!(p2 instanceof Reservation) && p2.why === "five", "P2 held to 5 in the 5 seconds (6 already)");
  t = b.retryWaitUntil;
  assert.ok(b.roomFor("P2", 1).ok, "the hold has ended: P2 has its 15 in the 5 seconds again");
});

test("rulings round 3: while the hold is in force, P2 is granted at 34 of the minute and at 4 in the 5 seconds, and refused one above each", () => {
  const t = 100_000;
  const mk = () => {
    const b: any = new RequestBudget({ now: () => t });
    b.retryWaitUntil = t + 10_000;
    b.retryWaitRoom = 35;
    b.retryWaitFive = 5;
    return b;
  };
  const fill = (b: any, n: number, atMs: number, fiveSec: boolean) => {
    const r = b.tryReserve("P1", n, { label: "other P1 work", fiveSec, force: true }) as Reservation;
    for (let i = 0; i < n; i++) r.charge("/v2/test");
    r.end();
    void atMs;
  };
  // the minute: 34 used (sent more than 5 s ago, so the 5 seconds are empty)
  const bm = mk();
  const realNow = bm.nowMs.bind(bm);
  bm.nowMs = () => t - 30_000;
  fill(bm, 34, t - 30_000, false);
  bm.nowMs = realNow;
  assert.ok(bm.roomFor("P2", 1, false).ok, "35 of the minute: granted");
  assert.ok(!bm.roomFor("P2", 2, false).ok, "36: refused");
  // the 5 seconds: 4 used just now
  const bf = mk();
  fill(bf, 4, t, true);
  assert.ok(bf.roomFor("P2", 1).ok, "5 in the 5 seconds: granted");
  assert.ok(!bf.roomFor("P2", 2).ok, "6: refused");
});
