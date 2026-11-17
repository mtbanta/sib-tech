// Michael's rulings of 2026-11-14 (night) on part 2 of the redesign, and his two answers after them, with the reviewers' probes of rulings
// round 1 turned into tests: ordinary stuck retries stop at 45 of the budget's 60 a minute (60 of 75 since Michael's decision 2 of
// 2026-11-17), so urgent work keeps room (group 1's finding 1, group 2's B3); a remainder already being protected keeps its fresh stop only before any fresh stop was recorded for it (group 1's finding
// 2); `asRemainder` is logged (group 2's B2); the "sold" resolution line's 2 minute window (group 2's note).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { STUCK_RETRY_MINUTE_CAP, SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { AlpacaError } from "../src/alpaca-trading.ts";
import { BUDGET_PER_5S, BUDGET_PER_MINUTE, P1_KEEP, RequestBudget, Reservation } from "../src/request-budget.ts";
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
// Alpaca, so its try needs 13. Before the 45 cap, T was never sold in 300 s; with it, T is sold within seconds. Michael's decision 2 of
// 2026-11-17: the cap is 60 of a shared 75, and S's retries (10 about every 5 s) reach their 60 by about 35 s, so T becomes due at 40 s
// (was 30 s, when S had reached the old 45) or 45 s, each while S is at its most (checked).
for (const delay of [40_000, 45_000]) {
  test(`Michael's answer (60 of 75 for stuck retries, decision 2 of 2026-11-17; was 45 of 60): with another position stuck and every sale refused, a timed-out position's try (13) still gets room (it becomes due ${delay / 1000} s after the other got stuck)`, async () => {
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
    assert.ok(wk.budget.inUse().minute + 10 > STUCK_RETRY_MINUTE_CAP, `S's retries are at their most (a further one would pass the ${STUCK_RETRY_MINUTE_CAP}): ${wk.budget.inUse().minute} in the minute`);
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
test("Michael's answer (60 of 75 for stuck retries, decision 2 of 2026-11-17; was 45 of 60): with another position stuck and every sale refused, an unclear fresh stop's lookup still gets room; confirmed, nothing of it sold, no 15 second limit", async () => {
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
  await drive(t0 + 40_000); // S has reserved 60 of the minute (a seventh retry would pass its 60; Michael's decision 2 of 2026-11-17, was 40 of 45)
  const tU = sim.simMs;
  assert.ok(wk.budget.inUse().minute + 10 > STUCK_RETRY_MINUTE_CAP, `S's retries are at their most: ${wk.budget.inUse().minute} in the minute`);
  // Group 2, round 1 of decision 2 (2026-11-17): the fresh stop is hidden from the routine order list, so it can only be confirmed by its
  // budgeted lookup, which must win room while S's retries hold their 60 (before, the routine list confirmed it and no lookup ran).
  const realList = sim.listOrders.bind(sim);
  sim.listOrders = async (...a: any[]) => (await (realList as any)(...a)).filter((o: any) => !(o.symbol === "QXU" && String(o.clientOrderId).startsWith("cyrus-p-")));
  sim.partialTakeProfit(U, 2, 12.08);
  wk.loop.wake(U, sim.simMs, "protect");
  await drive(tU + 60_000);
  const uEv = (name: string) => ev.filter((x) => x.t >= tU && x.e === name && JSON.stringify(x.d ?? {}).includes("QXU"));
  assert.equal(uEv("fresh_stop_confirmed").length, 1, "confirmed by its lookup");
  assert.notEqual((uEv("fresh_stop_confirmed")[0]!.d as any).by, "order list", `confirmed by the budgeted lookup, not the routine list: ${JSON.stringify(uEv("fresh_stop_confirmed")[0]!.d)}`);
  assert.ok(wk.budget.peak.minute > STUCK_RETRY_MINUTE_CAP, `the lookup used the urgent room above the stuck retries' 60: peak ${wk.budget.peak.minute}`);
  assert.equal(uEv("fresh_stop_timeout").length, 0, "the 15 second limit never fired");
  assert.equal(sim.heldQty("QXU"), 3, "the remainder kept (its stop rests)");
  assert.ok(!r.bot.posts.some((p: any) => p.text.includes("QXU") && /not confirmed within 15 seconds/.test(p.text)), "no 15 second alert");
  assert.ok(wk.budget.peak.minute <= BUDGET_PER_MINUTE, `within the shared minute (75 since Michael's decision 2 of 2026-11-17, was 60): ${wk.budget.peak.minute}`);
  r.worker.stop?.();
});

// Michael's decision 2 of 2026-11-17: the cap is 60 of a shared 75 (was 45 of 60), so urgent work keeps its 15.
test("Michael's answer, raised by his decision 2 of 2026-11-17: the cap is 60 of the 75", () => {
  assert.equal(STUCK_RETRY_MINUTE_CAP, 60);
  assert.equal(BUDGET_PER_MINUTE - STUCK_RETRY_MINUTE_CAP, 15, "urgent work keeps 15 of the minute, as before");
  let t = 0;
  const b = new RequestBudget({ now: () => t });
  const reserve = () => b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP, fiveSec: false });
  const held: Reservation[] = [];
  for (let i = 0; i < 6; i++) held.push(reserve() as Reservation);
  assert.ok(held.every((x) => x instanceof Reservation), "60 fit");
  const seventh = reserve();
  assert.ok(!(seventh instanceof Reservation) && seventh.why === "class", "a seventh (70) would pass 60");
  assert.ok(b.tryReserve("P1", 13, { label: "timed-out stop try", fiveSec: false }) instanceof Reservation, "urgent work still fits (73 of 75)");
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
  const other = w.memory.budget.tryReserve("P1", 75, { label: "other P1 work", fiveSec: false }); // the whole minute: 75 since Michael's decision 2 of 2026-11-17 (was 60)
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

// Michael's decision 2 of 2026-11-17: the retry's ceiling is 60 of a shared 75, so the hold's room in the minute (60 - 10 = 50) is above
// P2's own share of 40: in the minute P2's share alone already leaves a waiting retry its room, and the hold no longer narrows P2 there.
// P2 can keep the retry out only in the 5 seconds, where the hold still holds P2 to 15 - 10 = 5 (before: P2 held to 45 - 10 = 35 of the
// minute, the retry getting in at 35).
test("Michael's answer (rechecks leave room): while a capped stuck retry waits and P2 is what keeps it out, P2 may draw only up to 5 in the 5 seconds (in the minute its own 40 leave the retry room under 60); the retry gets in once the 5 seconds have room", () => {
  let t = 0;
  const b: any = new RequestBudget({ now: () => t });
  const p2Send = () => {
    const r = b.tryReserve("P2", 1, { label: "list lag recheck", fiveSec: false }) as Reservation;
    assert.ok(r instanceof Reservation);
    r.charge("/v2/test");
    r.end();
  };
  for (let i = 0; i < 33; i++) {
    t = i * 1_000;
    p2Send();
  }
  for (let i = 0; i < 6; i++) {
    t = 36_000 + i * 800; // six of P2's 39 in the last 5 seconds
    p2Send();
  }
  t = 40_100;
  assert.ok(b.roomFor("P2", 1, false).ok, "before any retry waits, P2 may go to 40");
  const retry = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(!(retry instanceof Reservation) && retry.why === "five", "39 + 10 fits the 60, but 6 + 10 passes the 15 in 5 seconds");
  assert.equal(b.retryWaitRoom, STUCK_RETRY_MINUTE_CAP - 10);
  assert.ok(b.retryWaitRoom >= BUDGET_PER_MINUTE - P1_KEEP, "the hold's room in the minute (50) is not below P2's share (40)");
  assert.equal(b.retryWaitFive, BUDGET_PER_5S - 10);
  // The hold lasts until the retry looks again (when room may return), not only a moment: else P2 takes the room back meanwhile.
  assert.ok(b.retryWaitUntil >= retry.at + 500 && b.retryWaitUntil >= t + 2_500, `held until the retry's next look (${b.retryWaitUntil - t} ms)`);
  const p2 = b.tryReserve("P2", 1, { label: "list lag recheck" });
  assert.ok(!(p2 instanceof Reservation) && p2.why === "five", "P2 holds back above 5 in the 5 seconds while the retry waits");
  assert.ok(b.roomFor("P2", 1, false).ok, "in the minute P2 still has its 40 while the retry waits");
  t = 41_000; // the request sent at 36.0 s has left the 5 seconds: 5 left there
  assert.equal(b.inUse().five, 5);
  assert.ok(b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) instanceof Reservation, "the retry gets in at 5 in the 5 seconds");
});

test("Michael's answer (rechecks leave room): P2 keeps its share when holding back would not help (the stuck retries' own use fills their 60), and the hold lapses when the retry stops looking", () => {
  let t = 0;
  const b: any = new RequestBudget({ now: () => t });
  // Michael's decision 2 of 2026-11-17: six retries of 10 fill the stuck retries' 60 (was four filling 45).
  for (let i = 0; i < 6; i++) {
    t = i * 6_000;
    const r = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP, fiveSec: false }) as Reservation;
    for (let k = 0; k < 10; k++) r.charge("/v2/test");
    r.end();
  }
  t = 36_000;
  const seventh = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(!(seventh instanceof Reservation), "its own 60 keep a seventh out");
  assert.ok(b.retryWaitUntil <= t, "no hold on P2: it would not help");
  // a retry kept out by P2 sets the hold, which lapses once the retry stops looking (since decision 2 P2 can keep it out only in the 5
  // seconds: six P2 requests in the last 5 seconds)
  t = 0;
  const b2: any = new RequestBudget({ now: () => t });
  for (let i = 0; i < 6; i++) {
    t = 36_000 + i * 800;
    const p2 = b2.tryReserve("P2", 1, { label: "list lag recheck" }) as Reservation;
    p2.charge("/v2/test");
    p2.end();
  }
  t = 40_100;
  b2.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(b2.retryWaitUntil > t, "held");
  t = b2.retryWaitUntil;
  assert.ok(b2.roomFor("P2", 7).ok, "at its end P2 has its 15 in the 5 seconds again (the exact end is checked in the rulings round 3 test)");
});

// Michael's decision 2 of 2026-11-17: the stuck retries' ceiling is 60 of the shared 75 (was 45 of 60), so the minute starts at 55 here.
test("group 1, rulings round 2 (finding 2): a timed-out stop's try is not under the stuck retries' 60: it starts with 55 budgeted requests already in the minute", async () => {
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
  for (let i = 0; i < 5; i++) {
    const r = w.memory.budget.tryReserve("P1", 11, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP, fiveSec: false }) as Reservation;
    for (let k = 0; k < 11; k++) r.charge("/v2/test");
    r.end();
  }
  w.sim.advance(6_000); // out of the 5 seconds, still in the minute (55)
  assert.equal(w.memory.budget.roomFor("P1", 10, false, 0, STUCK_RETRY_MINUTE_CAP).ok, false, "an ordinary stuck retry of 10 would be held (65 above its 60)");
  await syncOrders(w.risk, dd, { protect: true });
  assert.deepEqual(w.sim.sellLog.filter((x: any) => x.symbol === "QXB").map((x: any) => x.qty), [5], "tried and sold (55 + 13 = 68 of 75; an ordinary retry would be held to 60)");
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

// Group 2, rulings round 3 (finding 2): the hold from below and its length. While a waiting stuck retry holds P2 back, P2 is granted up to the
// retry's ceiling less its size in the minute and 5 in the 5 seconds (one above each is refused); the hold is set to exactly those values
// when a retry of 10 under its ceiling is refused with P2 in the way, and it ends at the later of 2.5 s after the refusal and the time room
// may return plus 0.5 s. Michael's decision 2 of 2026-11-17: the ceiling is 60 (was 45), so the minute's value is 50 (was 35), above P2's own
// share of 40; only the 5 seconds' value narrows P2.
test("rulings round 3: a refused stuck retry sets the hold to 50 of the minute (above P2's 40) and 5 in the 5 seconds, ending at the later of 2.5 s and its room time plus 0.5 s", () => {
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
  assert.equal(b.retryWaitRoom, 50);
  assert.equal(b.retryWaitFive, 5);
  assert.equal(b.retryWaitUntil, Math.max(t + 2_500, retry.at + 500), "the hold's end");
  const p2 = b.tryReserve("P2", 1, { label: "list lag recheck" });
  assert.ok(!(p2 instanceof Reservation) && p2.why === "five", "P2 held to 5 in the 5 seconds (6 already)");
  // Group 2, rulings round 4: the hold ends exactly then: just before, P2 may not take 7 of the 5 seconds; at its end it may.
  t = b.retryWaitUntil - 1;
  assert.ok(!b.roomFor("P2", 7).ok, "just before its end: still held to 5 in the 5 seconds");
  t = b.retryWaitUntil;
  assert.ok(b.roomFor("P2", 7).ok, "at its end: P2 has its 15 in the 5 seconds again");
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

// Group 1, rulings round 3: the 5-second side of the hold, with P2 drawn under the 5 seconds (the reviewer's suggested tests). Case A: the
// retry's own last try fills the 5 seconds, so holding P2 back would not help: no hold, P2 keeps its 15. Case B: a P2 burst keeps the retry
// out on the 5 seconds with the minute low: P2 held to 5 there until the retry looks again, and the retry gets in.
const sendAs = (b: any, cls: "P1" | "P2", n: number, opts: any = {}) => {
  const r = b.tryReserve(cls, n, { label: "x", ...opts });
  assert.ok(r instanceof Reservation, `${cls} ${n} granted`);
  for (let i = 0; i < n; i++) r.charge("/v2/x");
  r.end();
};
test("group 1, rulings round 3 (case A): the stuck retry's own last try fills the 5 seconds: no hold, P2 keeps its 15 in the 5 seconds", () => {
  let t = 0;
  const b: any = new RequestBudget({ now: () => t });
  sendAs(b, "P1", 10, { minuteCap: STUCK_RETRY_MINUTE_CAP });
  t = 1_000;
  const r = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(!(r instanceof Reservation) && r.why === "five", "kept out by its own use of the 5 seconds");
  assert.ok(b.retryWaitUntil <= t, "no hold: P2 holding back would not help");
  assert.ok(b.roomFor("P2", 5).ok, "P2 may still draw up to 15 in the 5 seconds (10 + 5)");
});
test("group 1, rulings round 3 (case B): a P2 burst keeps the retry out on the 5 seconds: P2 held to 5 there until the retry looks again, and the retry gets in", () => {
  let t = 0;
  const b: any = new RequestBudget({ now: () => t });
  sendAs(b, "P2", 8);
  t = 1_000;
  const r = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(!(r instanceof Reservation) && r.why === "five", "kept out by P2's use of the 5 seconds");
  assert.ok(b.retryWaitUntil >= r.at, "held until the retry's next look");
  t = 5_000;
  const p2 = b.roomFor("P2", 6);
  assert.ok(!p2.ok && p2.why === "five", "P2 may not take 6 of the 5 seconds back while the retry waits");
  assert.ok(b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) instanceof Reservation, "the retry gets in");
});

// Group 2, rulings round 5: each refused look of the retry renews the hold. On the loop's real look times (the retry looks again at each
// refusal's `at`), urgent work arriving between its looks moves its next look past the first hold's end; the second refused look renews the
// hold past that, so P2 cannot take the room in the gap, and the retry gets in at its next look.
test("rulings round 5: a refused look of a waiting stuck retry renews the hold past its first end, so P2 cannot take the room in the gap, and the retry gets in", () => {
  let t = 0;
  const b: any = new RequestBudget({ now: () => t });
  for (let i = 0; i < 6; i++) {
    t = 36_000 + i * 800;
    const r = b.tryReserve("P2", 1, { label: "list lag recheck" }) as Reservation;
    r.charge("/v2/t");
    r.end();
  }
  t = 40_100;
  const a1 = b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP);
  assert.ok(!a1.ok && a1.why === "five");
  const end1 = b.retryWaitUntil;
  t = 40_900;
  const urgent = b.tryReserve("P1", 3, { label: "15 second limit lookup" }) as Reservation;
  assert.ok(urgent instanceof Reservation);
  for (let i = 0; i < 3; i++) urgent.charge("/v2/u");
  urgent.end();
  t = a1.at;
  const a2 = b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP);
  assert.ok(!a2.ok && a2.why === "five", "refused again");
  assert.ok(a2.at > end1, "its next look falls after the first hold's end");
  assert.ok(b.retryWaitUntil >= a2.at + 500, `renewed past its next look (${b.retryWaitUntil - end1} ms past the first end)`);
  t = end1 + 100;
  const p2 = b.tryReserve("P2", 4, { label: "list lag recheck" });
  assert.ok(!(p2 instanceof Reservation), "P2 cannot take the room in the gap");
  t = a2.at;
  assert.ok(b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) instanceof Reservation, "the retry gets in at its next look");
});

// Group 2, rulings round 6: a later refused look never shortens the hold. Stuck retry A looks while an urgent reservation is open (room for A
// returns late); the urgent try ends having sent nothing; stuck retry B looks and is refused with an earlier room time, and never tries (its
// record resolved). The hold keeps A's end, so P2 cannot take the room before A's look, and A gets in.
test("rulings round 6: a later refused look with an earlier room time never shortens the hold; P2 cannot take the room before the first retry's look, and it gets in", () => {
  let t = 0;
  const b: any = new RequestBudget({ now: () => t });
  for (let i = 0; i < 6; i++) {
    t = 36_000 + i * 800;
    const r = b.tryReserve("P2", 1, { label: "list lag recheck" }) as Reservation;
    r.charge("/v2/t");
    r.end();
  }
  t = 40_100;
  const urgent = b.tryReserve("P1", 3, { label: "15 second limit lookup" }) as Reservation;
  assert.ok(urgent instanceof Reservation);
  const a = b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP);
  assert.ok(!a.ok && a.why === "five");
  const endA = b.retryWaitUntil;
  t = 40_200;
  urgent.end(); // ended having sent nothing
  const bLook = b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP);
  assert.ok(!bLook.ok && bLook.at < a.at, "B refused, with an earlier room time");
  assert.equal(b.retryWaitUntil, endA, "the hold's end did not move back");
  t = bLook.at + 2_000; // after B's room time plus 0.5 s, before A's look
  assert.ok(t > bLook.at + 500 && t < a.at);
  assert.ok(!(b.tryReserve("P2", 5, { label: "list lag recheck" }) instanceof Reservation), "P2 still held");
  t = a.at;
  assert.ok(b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) instanceof Reservation, "A gets in at its look");
});
