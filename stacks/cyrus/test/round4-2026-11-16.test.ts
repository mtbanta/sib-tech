// The speed release, round 4 (group 1's blocker) and Michael's answers of 2026-11-16: "Every side-by-side sale after the first needs 120 left,
// not 20", and a side-by-side sale waiting for room ends its wait at once when a sale of the whole account is asked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientOrderIdFor } from "../src/gate.ts";
import { Liquidator, SIDE_BY_SIDE_LONE_WAIT_MAX_MS, SellGate } from "../src/sells.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle } from "./rig.ts";
import { FakeBot } from "./helpers.ts";

const iso = (ms: number) => new Date(ms).toISOString();

// Group 1's shape (probe G): 5 positions lose their exits at once and Alpaca refuses their sales, so missing-exit sales run side by side; 25
// other positions keep their bracket exits. `flatten` (the close-outs' call) is asked `askAfterMs` after the losses, with Alpaca taking 8 s to
// cancel each bracket exit. Alpaca's live remaining reaches the governor, as main.ts wires it. Returns the rate-limit answers on sells and
// cancels from the ask on, and when the last bracketed position's sale went out after the ask.
async function lostThenFlatten(askAfterMs: number) {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const holds: Array<{ until: number; res: () => void }> = [];
  let timed = false;
  const tsleep = (ms: number): Promise<void> => (timed ? new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res })) : sim.sleep(ms));
  const r: any = rig<SimBroker>({ broker: sim, sleep: tsleep, simClock: sim, bot, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const wk: any = r.worker;
  await r.at("20:40:00");
  const mk = (p: string, n: number) => Array.from({ length: n }, (_, i) => p + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
  const bad = mk("QX", 5);
  const good = mk("BR", 25);
  for (const s of [...bad, ...good]) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: s, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  }
  await r.at("20:40:01");
  const loseAt = new Date(`${D}T20:40:05Z`).getTime();
  sim.refuseSellIf = (x: any) => bad.includes(x.symbol);
  let afterAsk = false;
  let onSellsOrCancels = 0;
  const realSpend = sim.spend.bind(sim);
  sim.spend = (kind: string) => {
    const b = sim.rejected429;
    try {
      return realSpend(kind);
    } finally {
      if (afterAsk && kind !== "read") onSellsOrCancels += sim.rejected429 - b;
    }
  };
  const prev = sim.onRate;
  sim.onRate = (k: number) => {
    r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: k, reset: null });
    prev?.(k);
  };
  timed = true;
  let nextPass = sim.simMs + 5_000;
  let nextTimed = sim.simMs + 1_000;
  const askAt = loseAt + askAfterMs;
  let lost = false;
  let asked: Promise<unknown> | null = null;
  while (sim.simMs < askAt + 60_000) {
    if (!lost && sim.simMs >= loseAt) {
      lost = true;
      sim.cancelMs = 100;
      for (const s of bad) for (const l of sim.orders.find((o: any) => o.clientOrderId === clientOrderIdFor(D, s, 1))!.legs) await sim.cancelOrder(l.id);
    }
    if (!asked && sim.simMs >= askAt) {
      sim.cancelMs = 8_000;
      afterAsk = true;
      asked = wk.liquidator.flatten({ reason: "flatten command", tradeDate: D });
    }
    if (sim.simMs >= nextPass) {
      void r.at(iso(sim.simMs));
      nextPass += 5_000;
    } else r.setNow(iso(sim.simMs + 100));
    if (sim.simMs >= nextTimed) {
      nextTimed += 1_000;
      void wk.timedTick();
    }
    for (const h of holds.filter((h) => h.until <= sim.simMs)) {
      holds.splice(holds.indexOf(h), 1);
      h.res();
    }
    await settle();
  }
  timed = false;
  for (const h of holds.splice(0)) h.res();
  wk.stop?.();
  const sales = sim.sellLog.filter((x: any) => good.includes(x.symbol) && x.at >= askAt);
  return { onSellsOrCancels, lastSaleMs: Math.max(...sales.map((x: any) => x.at)) - askAt, sold: new Set(sales.map((x: any) => x.symbol)).size, oversell: sim.oversellAttempts };
}

// v24 (20ba5bd) in this shape, rate-limit answers on sells and cancels by when the ask came: 5 s 0, 10 s 17, 20 s 20, 25 s 17; last bracketed
// sale 8.2 to 10.1 s after the ask. f9a4254 (the floor of 20): 59 to 72 answers, 17.2 to 23.1 s. With the headroom of 120 alone (4c8e688),
// asks at 5 and 10 s still got 54 and 36; with the lone sale also waiting above 20 (Michael's "Lone sale waits above 20"), 0 at every ask.
const v24Answers: Record<number, number> = { 5_000: 0, 10_000: 17, 20_000: 20, 25_000: 17 };
for (const after of [5_000, 10_000, 20_000, 25_000]) {
  test(`round 4 (headroom 120, lone sale above 20): lost-exit sales side by side, then flatten asked ${after / 1000} s later: no more rate-limit answers on sells and cancels than v24 (${v24Answers[after]}), last bracketed sale within 12 s`, async () => {
    const w = await lostThenFlatten(after);
    assert.equal(w.sold, 25, "every bracketed position sold");
    assert.ok(w.onSellsOrCancels <= v24Answers[after]!, `rate-limit answers on sells and cancels: ${w.onSellsOrCancels} (v24: ${v24Answers[after]})`);
    assert.ok(w.lastSaleMs <= 12_000, `last bracketed sale ${w.lastSaleMs} ms after the ask`);
    assert.equal(w.oversell, 0);
  });
}

// Michael's answer on the round 4 blocker ("end the wait at once"): three side-by-side sales on a simulated Alpaca whose sales are refused,
// on a clock the test moves (50 ms steps), with no room after their start: two running ones wait before their second round, a third waits to
// start. A sale of the whole account (`flatten`, or the loss stop's priority sale) asked meanwhile starts within 0.1 s: the waiting sales
// wake at once and stand aside or give way. Before, they noticed only when their pause of up to 2 s ended (20ba5bd: `flatten` 0.01 to 2.7 s,
// the loss stop 0.01 to 0.8 s; f9a4254 up to about 1.8 s).
for (const kind of ["flatten", "loss stop"] as const) {
  test(`round 4 (end the wait at once): a ${kind === "flatten" ? "flatten" : "loss stop's sale"} asked while side-by-side sales wait for room starts within 0.1 s`, async () => {
    const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
    const holds: Array<{ until: number; res: () => void }> = [];
    const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
    let room = true;
    const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep, sideBySideRoom: () => room });
    const syms = ["AAA", "BBB", "CCC"];
    for (const s of syms) {
      const id = clientOrderIdFor(D, s, 1);
      await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
      sim.fillEntry(id, 10);
      for (const l of sim.orders.find((x: any) => x.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
    }
    sim.advance(1_000);
    sim.refuseSellIf = () => true;
    const drive = async (until: number) => {
      while (sim.simMs < until) {
        sim.advance(50);
        for (const h of holds.filter((h) => h.until <= sim.simMs)) {
          holds.splice(holds.indexOf(h), 1);
          h.res();
        }
        for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
      }
    };
    const sale = (s: string) => liq.flatten({ reason: s, tradeDate: D, only: [s], ownEntryOnly: { maxQty: { [s]: 5 } }, sideBySide: true, maxRounds: 3 });
    let wholeStart: number | null = null;
    const realRun = liq.run.bind(liq);
    liq.run = (o: any) => {
      if (!o.ownEntryOnly && wholeStart === null) wholeStart = sim.simMs;
      return realRun(o);
    };
    const t0 = sim.simMs;
    const a = sale("AAA");
    const b = sale("BBB");
    await drive(t0 + 200);
    assert.equal(liq.sideBySideNow(), 2);
    room = false;
    const c = sale("CCC"); // waits to start
    await drive(t0 + 4_300); // A and B are in their waits before round 2, now pausing 2 s each
    assert.equal(liq.sideBySideNow(), 2, "C still waiting to start");
    const askAt = sim.simMs;
    const whole = liq.flatten(kind === "flatten" ? { reason: "flatten command", tradeDate: D } : { reason: "daily loss stop", tradeDate: D, maxRounds: 1, priority: true });
    await drive(askAt + 3_000);
    assert.ok(wholeStart !== null, "the sale of the whole account started");
    assert.ok(wholeStart! - askAt <= 100, `it started ${wholeStart! - askAt} ms after the ask`);
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    assert.equal(ra.gaveWay, "whole account");
    assert.equal(rb.gaveWay, "whole account");
    assert.equal(rc.stoodAside, "whole account");
    room = true;
    await drive(sim.simMs + 30_000);
    await whole;
  });
}

// Michael's answer of 2026-11-16 ("Lone sale waits above 20"), and its bound: a lone side-by-side sale waits (sending nothing) while the
// room check above the urgent floor of 20 says no, at its start and before each round; whatever the estimate says, it goes ahead after
// SIDE_BY_SIDE_LONE_WAIT_MAX_MS (30 s), as the one-at-a-time queue would. A sale of the whole account asked meanwhile ends the wait at once.
test("lone sale above 20: it waits while there is no room, and goes ahead after 30 s whatever the estimate says; a whole-account ask ends its wait at once", async () => {
  assert.equal(SIDE_BY_SIDE_LONE_WAIT_MAX_MS, 30_000);
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  let alone = false; // the room check above 20 for a lone sale: no room at all (an estimate stuck low)
  const events: Array<{ e: string; d: any; t: number }> = [];
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep, log: (e, d) => void events.push({ e, d, t: sim.simMs }), sideBySideRoom: () => false, sideBySideRoomAlone: () => alone });
  for (const s of ["AAA", "BBB"]) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    for (const l of sim.orders.find((x: any) => x.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  }
  sim.advance(1_000);
  const sells: Array<{ s: string; t: number }> = [];
  sim.submitSell = async (x: any) => {
    sells.push({ s: x.symbol, t: sim.simMs });
    throw new Error("sell refused (test)");
  };
  const drive = async (until: number) => {
    while (sim.simMs < until) {
      sim.advance(50);
      for (const h of holds.filter((h) => h.until <= sim.simMs)) {
        holds.splice(holds.indexOf(h), 1);
        h.res();
      }
      for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
    }
  };
  const sale = (s: string) => liq.flatten({ reason: s, tradeDate: D, only: [s], ownEntryOnly: { maxQty: { [s]: 5 } }, sideBySide: true, maxRounds: 2 });
  const t0 = sim.simMs;
  const a = sale("AAA");
  await drive(t0 + 25_000);
  assert.equal(sells.length, 0, "no room above 20: the lone sale has sent nothing after 25 s");
  await drive(t0 + 40_000);
  assert.equal(sells.length, 1, "it went ahead once its wait reached 30 s");
  assert.ok(sells[0]!.t >= t0 + 30_000 && sells[0]!.t <= t0 + 33_000, `first sell at ${sells[0]!.t - t0} ms`);
  assert.ok(events.some((x) => x.e === "side_by_side_lone_wait_over" && x.d.at === "start"));
  await drive(t0 + 80_000);
  await a;
  assert.equal(sells.length, 2, "its second round waited too, and went ahead after 30 s");
  assert.ok(events.some((x) => x.e === "side_by_side_lone_wait_over" && x.d.at === "round 2"));
  // With room above 20 it goes ahead at once.
  alone = true;
  const t1 = sim.simMs;
  const b = sale("BBB");
  await drive(t1 + 500);
  assert.equal(sells.filter((x) => x.s === "BBB").length, 1, "room above 20: at once");
  await drive(t1 + 5_000);
  await b;
  // No room again: a whole-account ask ends the lone wait at once (it stands aside, sending nothing).
  alone = false;
  const c = sale("AAA");
  await drive(sim.simMs + 3_000);
  const n = sells.length;
  const whole = liq.flatten({ reason: "flatten command", tradeDate: D });
  await drive(sim.simMs + 200);
  const rc = await c;
  assert.equal(rc.stoodAside, "whole account");
  assert.equal(sells.length, n, "nothing sent by the waiting sale");
  await drive(sim.simMs + 20_000);
  await whole;
});

// The bound counts only time waited alone. A sale that queued more than 30 s behind another (for the headroom of 120) and then finds itself
// alone with no room above 20 still waits, sending nothing, for up to 30 s more of waiting alone (before this, it went ahead at once).
async function queuedThenAlone(at: "start" | "round") {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  let room120 = true;
  let alone = true;
  const events: Array<{ e: string; d: any; t: number }> = [];
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep, log: (e, d) => void events.push({ e, d, t: sim.simMs }), sideBySideRoom: () => room120, sideBySideRoomAlone: () => alone });
  for (const s of ["AAA", "BBB"]) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    for (const l of sim.orders.find((x: any) => x.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  }
  sim.advance(1_000);
  let release: () => void = () => {};
  const held = new Promise<void>((res) => (release = res));
  const sells: Array<{ s: string; t: number }> = [];
  sim.submitSell = async (x: any) => {
    sells.push({ s: x.symbol, t: sim.simMs });
    if (x.symbol === "AAA") await held; // AAA's sale is in flight until the test lets it end
    throw new Error("sell refused (test)");
  };
  const drive = async (until: number) => {
    while (sim.simMs < until) {
      sim.advance(50);
      for (const h of holds.filter((h) => h.until <= sim.simMs)) {
        holds.splice(holds.indexOf(h), 1);
        h.res();
      }
      for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
    }
  };
  const sale = (s: string, maxRounds: number) => liq.flatten({ reason: s, tradeDate: D, only: [s], ownEntryOnly: { maxQty: { [s]: 5 } }, sideBySide: true, maxRounds });
  const t0 = sim.simMs;
  // "start": AAA runs (one round, its sell in flight) and BBB queues behind it at its start. "round": BBB starts alone, its first sell is
  // refused at once and it pauses 1 s; AAA starts beside it (its sell in flight; the sell gate sends one sale at a time, so AAA goes second);
  // BBB's second round then queues behind AAA.
  let a: Promise<any>;
  let b: Promise<any>;
  if (at === "start") {
    a = sale("AAA", 1);
    room120 = false;
    await drive(t0 + 200);
    b = sale("BBB", 1);
  } else {
    b = sale("BBB", 2);
    await drive(t0 + 200);
    a = sale("AAA", 1);
  }
  await drive(t0 + 400);
  room120 = false;
  alone = false;
  await drive(t0 + 40_000);
  const bBefore = sells.filter((x) => x.s === "BBB").length;
  release(); // AAA's sale ends; BBB is now alone with no room above 20, after more than 30 s of queueing
  const t1 = sim.simMs;
  await drive(t1 + 25_000);
  const bAt25 = sells.filter((x) => x.s === "BBB").length;
  await drive(t1 + 40_000);
  await Promise.all([a, b]);
  const bLate = sells.filter((x) => x.s === "BBB");
  return { bBefore, bAt25, bAfter: bLate.length, lastB: bLate.length ? bLate[bLate.length - 1]!.t - t1 : null, over: events.filter((x) => x.e === "side_by_side_lone_wait_over").map((x) => x.d) };
}

test("lone sale above 20: a sale that queued 40 s behind another at its start, then alone with no room, still waits up to 30 s alone before going ahead", async () => {
  const w = await queuedThenAlone("start");
  assert.equal(w.bBefore, 0, "queued behind AAA (headroom 120): nothing sent");
  assert.equal(w.bAt25, 0, "alone with no room above 20: still nothing 25 s after AAA ended");
  assert.equal(w.bAfter, 1, "went ahead once it had waited 30 s alone");
  assert.ok(w.lastB! >= 30_000 && w.lastB! <= 34_000, `sent ${w.lastB} ms after AAA ended`);
  assert.ok(w.over.some((d: any) => d.at === "start" && d.waitedAloneMs >= 30_000 && d.waitedMs >= 60_000), JSON.stringify(w.over));
});

test("lone sale above 20: a round that queued 40 s behind another sale, then alone with no room, still waits up to 30 s alone before going ahead", async () => {
  const w = await queuedThenAlone("round");
  assert.equal(w.bBefore, 1, "BBB's first round only; its second queued behind AAA (headroom 120)");
  assert.equal(w.bAt25, 1, "alone with no room above 20: its second round still not sent 25 s after AAA ended");
  assert.equal(w.bAfter, 2, "its second round went ahead once it had waited 30 s alone");
  assert.ok(w.lastB! >= 30_000 && w.lastB! <= 34_000, `sent ${w.lastB} ms after AAA ended`);
  assert.ok(w.over.some((d: any) => d.at === "round 2" && d.waitedAloneMs >= 30_000 && d.waitedMs >= 60_000), JSON.stringify(w.over));
});
