// Item 1 of the night build (Michael's request of 2026-11-16, about 8:50 PM): "a flatten or close-out sends each cancel once and then waits
// for its result (live update or one lookup) instead of re-sending every round". On 2026-11-16 (simulator), a `flatten` whose second round
// began before Alpaca's 8 s cancels had finished re-sent a single cancel for every order still pending cancel, each round (81 cancels).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CANCEL_LOOKUP_FAILS_MAX, CANCEL_THROWS_MAX, CANCEL_LOOKUPS_MAX, CANCEL_MEMORY_MS, CANCEL_RESENDS_MAX, CANCEL_RESULT_WAIT_MS, Liquidator, SellGate } from "../src/sells.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";
import { STORED_INFO_EVENTS, shouldStoreEvent } from "../src/run-log.ts";
import { RequestBudget } from "../src/request-budget.ts";

// `bracketed` positions with both exits resting, `bare` positions whose exits are already gone (their sale goes out in round 1 and, with
// slow fills, stays open), Alpaca taking `cancelMs` per cancel; a liquidator on a clock the test moves. Counts requests by kind.
async function world(bracketed: number, bare: number, cancelMs: number) {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  const events: Array<{ e: string; d: any }> = [];
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep, log: (e: string, d: any) => void events.push({ e, d }) });
  const legIds: string[] = [];
  for (let i = 0; i < bracketed + bare; i++) {
    const s = "Q" + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    const legs = sim.orders.find((x: any) => x.clientOrderId === id)!.legs;
    if (i >= bracketed) for (const l of legs) await sim.cancelOrder(l.id);
    else legIds.push(...legs.map((l: any) => l.id));
  }
  sim.advance(1_000);
  sim.cancelMs = cancelMs;
  sim.sellFillDelayMs = 16_000;
  const calls: Record<string, number> = {};
  for (const m of ["cancelOrder", "cancelAllOrders", "getOrderById", "submitSell"]) {
    const orig = sim[m].bind(sim);
    sim[m] = (...a: any[]) => {
      calls[m] = (calls[m] ?? 0) + 1;
      return orig(...a);
    };
  }
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
  return { sim, liq, events, calls, drive, legIds };
}

test("night build, item 1: the constants", () => {
  assert.deepEqual([CANCEL_MEMORY_MS, CANCEL_RESULT_WAIT_MS, CANCEL_RESENDS_MAX, CANCEL_LOOKUPS_MAX], [60_000, 2_000, 2, 3]);
});

// Group 2, night build round 1 (B1): a cancel not confirmed is rare and stored; the re-sends and failed lookups stay in Fly's log only.
test("night build, item 1: cancel_not_confirmed is stored in the run log; cancel_resent and cancel_lookup_failed are not", () => {
  assert.ok(STORED_INFO_EVENTS.has("cancel_not_confirmed"));
  assert.equal(shouldStoreEvent("info", "cancel_not_confirmed"), true);
  assert.equal(shouldStoreEvent("info", "cancel_resent"), false);
  assert.equal(shouldStoreEvent("info", "cancel_lookup_failed"), false);
  // Group 2, night round 2: the skipped lookup and the close-out hold's cap stay in Fly's log only too.
  assert.equal(shouldStoreEvent("info", "cancel_lookup_skipped"), false);
  assert.equal(shouldStoreEvent("info", "closeout_hold_capped"), false);
});

test("night build, item 1: a flatten whose own sells are open in round 2, with 8 s cancels, sends no cancel again for orders pending cancel (v24 re-sent one each, every round)", async () => {
  const w = await world(10, 3, 8_000);
  const t0 = w.sim.simMs;
  const p = w.liq.flatten({ reason: "flatten command", tradeDate: D });
  await w.drive(t0 + 60_000);
  const r = await p;
  assert.equal(w.calls.cancelAllOrders ?? 0, 1, "one cancel of every order, in round 1");
  assert.equal(w.calls.cancelOrder ?? 0, 0, "no single cancel for the 20 exits pending cancel");
  assert.equal(w.calls.getOrderById ?? 0, 0, "no lookup: the list showed them pending cancel");
  assert.equal(w.sim.oversellAttempts, 0);
  assert.ok(r.sold.length >= 13 || r.flat, JSON.stringify({ flat: r.flat, sold: r.sold.length, errors: r.errors.slice(0, 3) }));
});

test("night build, item 1: a close-out's retry of some symbols (single cancels) sends each cancel once across liquidations, while Alpaca has it pending", async () => {
  const w = await world(4, 0, 30_000);
  const syms = ["QAA", "QAB", "QAC", "QAD"];
  const t0 = w.sim.simMs;
  const a = w.liq.flatten({ reason: "close-out", tradeDate: D, only: syms, maxRounds: 2 });
  await w.drive(t0 + 20_000);
  await a;
  const first = w.calls.cancelOrder ?? 0;
  assert.equal(first, 8, "each of the 8 exits once");
  const b = w.liq.flatten({ reason: "close-out", tradeDate: D, only: syms, maxRounds: 2 });
  await w.drive(w.sim.simMs + 20_000);
  await b;
  assert.equal(w.calls.cancelOrder ?? 0, first, "the retry sent none again (all pending cancel)");
});

test("night build, item 1: a cancel Alpaca lost is looked up once after 2 s and sent again; one always lost is sent at most 3 times and looked up at most 3 times", async () => {
  const w = await world(2, 0, 200);
  // Alpaca drops every cancel of one stop leg (it stays working) and of nothing else.
  const lost = w.legIds[1]!;
  const realCancel = w.sim.cancelOrder;
  w.sim.cancelOrder = async (id: string) => {
    if (id === lost) {
      w.calls.cancelOrder = (w.calls.cancelOrder ?? 0) + 1;
      w.calls.lostCancels = (w.calls.lostCancels ?? 0) + 1;
      return;
    }
    return realCancel(id);
  };
  const realAll = w.sim.cancelAllOrders.bind(w.sim);
  w.sim.cancelAllOrders = async () => {
    const leg = w.sim.orders.flatMap((o: any) => o.legs).find((l: any) => l.id === lost);
    const before = leg.status;
    const r = await realAll();
    if (leg.status === "pending_cancel") {
      leg.status = before; // lost
      w.sim.cancels = w.sim.cancels.filter((c: any) => c.id !== lost);
    }
    return r;
  };
  const syms = ["QAA", "QAB"];
  const t0 = w.sim.simMs;
  const p = w.liq.flatten({ reason: "close-out", tradeDate: D, only: syms, maxRounds: 4 });
  await w.drive(t0 + 60_000);
  await p;
  assert.ok((w.calls.lostCancels ?? 0) >= 2, `sent again after its lookup (${w.calls.lostCancels} sends)`);
  assert.ok((w.calls.lostCancels ?? 0) <= 1 + CANCEL_RESENDS_MAX, `at most ${1 + CANCEL_RESENDS_MAX} sends (${w.calls.lostCancels})`);
  assert.ok((w.calls.getOrderById ?? 0) <= CANCEL_LOOKUPS_MAX, `at most ${CANCEL_LOOKUPS_MAX} lookups (${w.calls.getOrderById})`);
  assert.ok(w.events.some((x) => x.e === "cancel_resent"));
  assert.equal(w.sim.oversellAttempts, 0, "the stop still holding its shares: never sold past it");
});

// Group 2, night build round 1 (B4): the bound holds within the 60 s cancel memory only. After it, an order still shown working is
// treated as new and the cycle repeats, so a cancel Alpaca keeps refusing costs about 3 cancels and 3 lookups a minute.
test("night build, item 1: an order that always stays working, over more than 70 s of close-out retries: at most 3 cancels and 3 lookups in any 60 s, and the cycle repeats after the memory", async () => {
  const w = await world(2, 0, 200);
  const lost = w.legIds[1]!;
  const cancelsAt: number[] = [];
  const lookupsAt: number[] = [];
  const realCancel = w.sim.cancelOrder;
  w.sim.cancelOrder = async (id: string) => {
    if (id === lost) {
      cancelsAt.push(w.sim.simMs);
      return; // refused every time: it stays working
    }
    return realCancel(id);
  };
  const realLookup = w.sim.getOrderById;
  w.sim.getOrderById = async (id: string) => {
    if (id === lost) lookupsAt.push(w.sim.simMs);
    return realLookup(id);
  };
  const syms = ["QAA", "QAB"];
  const t0 = w.sim.simMs;
  const end = t0 + 150_000;
  // The close-out's retries, one liquidation after another, as the worker sends them while a position is not flat.
  for (let n = 0; n < 40 && w.sim.simMs < end; n++) {
    let done = false;
    const p = w.liq.flatten({ reason: "close-out", tradeDate: D, only: syms, maxRounds: 4 }).finally(() => (done = true));
    // Moves the clock until this liquidation ends (at most 60 s each), so it is never awaited with the clock stopped.
    const cap = w.sim.simMs + 60_000;
    while (!done && w.sim.simMs < cap) await w.drive(w.sim.simMs + 500);
    assert.ok(done, "each liquidation ends");
    await p;
    await w.drive(w.sim.simMs + 1_000); // the worker's retries are about a second or more apart
  }
  const inAny60 = (ts: number[]) => Math.max(0, ...ts.map((a) => ts.filter((b) => b >= a && b < a + 60_000).length));
  const lastAt = Math.max(...cancelsAt, ...lookupsAt);
  assert.ok(lastAt - t0 > 70_000, `activity past 70 s (${lastAt - t0} ms)`);
  assert.ok(inAny60(cancelsAt) <= 1 + CANCEL_RESENDS_MAX, `cancels in any 60 s: ${inAny60(cancelsAt)} (${cancelsAt.map((t) => t - t0).join(", ")})`);
  assert.ok(inAny60(lookupsAt) <= CANCEL_LOOKUPS_MAX, `lookups in any 60 s: ${inAny60(lookupsAt)} (${lookupsAt.map((t) => t - t0).join(", ")})`);
  assert.ok(cancelsAt.length > 1 + CANCEL_RESENDS_MAX, `the cycle repeats after the memory (${cancelsAt.length} cancels)`);
  const minutes = Math.ceil((w.sim.simMs - t0) / 60_000);
  assert.ok(cancelsAt.length <= (1 + CANCEL_RESENDS_MAX) * minutes, `about 3 cancels a minute: ${cancelsAt.length} in ${minutes} minutes`);
  assert.ok(lookupsAt.length <= CANCEL_LOOKUPS_MAX * minutes, `about 3 lookups a minute: ${lookupsAt.length} in ${minutes} minutes`);
  assert.equal(w.events.filter((x) => x.e === "cancel_not_confirmed").length, Math.floor(lookupsAt.length / CANCEL_LOOKUPS_MAX), "one a cycle, after its third lookup");
  assert.equal(w.sim.oversellAttempts, 0);
  // Measured when written: cancels at 0.05, 7.6, 15.15 s, then 78.15, 85.7, 94.55 s (the memory runs from the last re-send).
});

// Group 1, night build round 1 follow-up, the reviewer's probe `cancel-throw.mts` as a test: one exit's cancel throws (an Alpaca 503 after
// the client's own retries) the first `throws` times; close-out retries of both symbols, one every 20 s. A cancel that threw was not sent, so
// it is sent again in the next retry, as on v24 (20ba5bd), which sold both symbols at 20.55, 40.55 and 60.55 s with 1, 2 and 3 throws and not
// within 80 s with 4 (before this fix the night build did not sell QAA within 80 s with 3).
for (const [throws, v24] of [[1, 20_550], [2, 40_550], [3, 60_550], [4, null]] as const) {
  test(`night build, item 1: a cancel that throws ${throws} time(s) is not counted as sent; sold no later than on v24 (${v24 === null ? "not within 80 s" : `${v24} ms`})`, async () => {
    const w = await world(2, 0, 200);
    w.sim.sellFillDelayMs = 0;
    const bad = w.legIds[0]!;
    let left: number = throws;
    let sends = 0;
    const realCancel = w.sim.cancelOrder;
    w.sim.cancelOrder = async (id: string) => {
      if (id === bad) {
        sends++;
        if (left > 0) {
          left--;
          throw new Error("Alpaca 503");
        }
      }
      return realCancel(id);
    };
    const soldAt: Record<string, number> = {};
    const realSell = w.sim.submitSell;
    w.sim.submitSell = (x: { symbol: string }) => {
      soldAt[x.symbol] ??= w.sim.simMs;
      return realSell(x);
    };
    const t0 = w.sim.simMs;
    for (let k = 0; k < 4; k++) {
      const p = w.liq.flatten({ reason: "close-out", tradeDate: D, only: ["QAA", "QAB"], maxRounds: 1 });
      await w.drive(w.sim.simMs + 20_000);
      await p;
    }
    const at = soldAt.QAA === undefined ? null : soldAt.QAA - t0;
    if (v24 !== null) assert.ok(at !== null && at <= v24, `QAA sold at ${at} ms (v24: ${v24})`);
    assert.ok(sends <= throws + 1, `one cancel a retry at most (${sends})`);
    const notConfirmed = w.events.filter((x) => x.e === "cancel_not_confirmed" && x.d.id === bad).length;
    assert.equal(notConfirmed, throws > CANCEL_THROWS_MAX ? 1 : 0, "stored once when the thrown cancels are used up");
    assert.equal(w.sim.oversellAttempts, 0);
  });
}

test("night build, item 1: a cancel that always throws stays bounded (one try a retry; after 3 uncounted, the item 1 schedule)", async () => {
  const w = await world(2, 0, 200);
  const bad = w.legIds[0]!;
  let sends = 0;
  const realCancel = w.sim.cancelOrder;
  w.sim.cancelOrder = async (id: string) => {
    if (id === bad) {
      sends++;
      throw new Error("Alpaca 503");
    }
    return realCancel(id);
  };
  const t0 = w.sim.simMs;
  for (let k = 0; k < 10 && w.sim.simMs - t0 < 50_000; k++) {
    let done = false;
    const p = w.liq.flatten({ reason: "close-out", tradeDate: D, only: ["QAA", "QAB"], maxRounds: 4 }).finally(() => (done = true));
    const cap = w.sim.simMs + 60_000;
    while (!done && w.sim.simMs < cap) await w.drive(w.sim.simMs + 500);
    assert.ok(done, "each liquidation ends");
    await p;
    await w.drive(w.sim.simMs + 1_000);
  }
  assert.equal(CANCEL_THROWS_MAX, 3);
  assert.ok(sends <= CANCEL_THROWS_MAX + 1 + CANCEL_RESENDS_MAX, `cancels in about 50 s: ${sends}`);
  // Stored when the thrown cancels are used up, and again when the item 1 schedule ends with the cancel still not confirmed.
  const rows = w.events.filter((x) => x.e === "cancel_not_confirmed" && x.d.id === bad);
  assert.ok(rows.length >= 1 && rows.length <= 2, `rows ${rows.length}`);
  assert.equal(rows[0]!.d.thrown, CANCEL_THROWS_MAX + 1);
});

// Group 1, night build round 1 (finding 3), the reviewer's probe `lookup-fail.mts` as a test: one exit's first cancel is lost and the lookups
// of its result fail `fails` times (an Alpaca 503); close-out retries of both symbols, one every 20 s. On v24 (20ba5bd) the symbol was sold
// at 20.55 s in every case; before this fix the night build sold it at 40.55 s after 1 failed lookup and not within 80 s after 3.
for (const fails of [1, 3, 10]) {
  test(`night build, item 1: a failed cancel-result lookup (${fails} in a row) does not use up the allowance; the cancel is sent again and the symbol sold no later than on v24`, async () => {
    const w = await world(2, 0, 200);
    w.sim.sellFillDelayMs = 0;
    const bad = w.legIds[0]!;
    let lost = 1;
    let lookFails = fails;
    const realCancel = w.sim.cancelOrder;
    w.sim.cancelOrder = async (id: string) => {
      if (id === bad && lost > 0) {
        lost--;
        return; // lost: the order stays working
      }
      return realCancel(id);
    };
    const realGet = w.sim.getOrderById;
    w.sim.getOrderById = async (id: string) => {
      if (lookFails > 0) {
        lookFails--;
        throw new Error("Alpaca 503 on lookup");
      }
      return realGet(id);
    };
    const soldAt: Record<string, number> = {};
    const realSell = w.sim.submitSell;
    w.sim.submitSell = (x: { symbol: string }) => {
      soldAt[x.symbol] ??= w.sim.simMs;
      return realSell(x);
    };
    const t0 = w.sim.simMs;
    for (let k = 0; k < 4; k++) {
      const p = w.liq.flatten({ reason: "close-out", tradeDate: D, only: ["QAA", "QAB"], maxRounds: 1 });
      await w.drive(w.sim.simMs + 20_000);
      await p;
    }
    assert.ok(soldAt.QAA !== undefined && soldAt.QAA - t0 <= 20_550, `QAA sold at ${soldAt.QAA === undefined ? "never" : soldAt.QAA - t0} ms (v24: 20550)`);
    assert.ok(w.events.some((x) => x.e === "cancel_lookup_failed"));
    assert.equal(w.sim.oversellAttempts, 0);
  });
}

// Group 2, night build round 2 (their probe as a test): failed and answered lookups mixed. One stop leg's cancels are always lost, its first
// 2 lookups throw and the rest answer; close-out retries of both symbols with `only`. Within one cancel memory (60 s from the first cancel)
// the order gets at most 3 cancels (the first and 2 re-sends), at most 6 lookups (3 answered, 3 failed) and at most about 3 stored
// `cancel_not_confirmed` rows (measured by group 2: 3 cancels, 5 lookups, 2 failed and 3 answered, and 3 rows).
test("night build, item 1: failed and answered lookups mixed: within one cancel memory at most 3 cancels, 6 lookups (3 answered, 3 failed) and about 3 cancel_not_confirmed rows an order", async () => {
  const w = await world(2, 0, 200);
  const bad = w.legIds[1]!;
  const cancelsAt: number[] = [];
  const answeredAt: number[] = [];
  const failedAt: number[] = [];
  const realCancel = w.sim.cancelOrder;
  w.sim.cancelOrder = async (id: string) => {
    if (id === bad) {
      cancelsAt.push(w.sim.simMs);
      return; // lost: it stays working
    }
    return realCancel(id);
  };
  const realGet = w.sim.getOrderById;
  w.sim.getOrderById = async (id: string) => {
    if (id === bad) {
      if (failedAt.length < 2 && answeredAt.length === 0) {
        failedAt.push(w.sim.simMs);
        throw new Error("Alpaca 503 on lookup");
      }
      answeredAt.push(w.sim.simMs);
    }
    return realGet(id);
  };
  const rowsAt: number[] = [];
  const t0 = w.sim.simMs;
  for (let k = 0; k < 20 && w.sim.simMs - t0 < 60_000; k++) {
    let done = false;
    const p = w.liq.flatten({ reason: "close-out", tradeDate: D, only: ["QAA", "QAB"], maxRounds: 4 }).finally(() => (done = true));
    const cap = w.sim.simMs + 60_000;
    while (!done && w.sim.simMs < cap) await w.drive(w.sim.simMs + 500);
    assert.ok(done, "each liquidation ends");
    await p;
    await w.drive(w.sim.simMs + 1_000);
  }
  for (const x of w.events) if (x.e === "cancel_not_confirmed" && x.d.id === bad) rowsAt.push(1);
  const first = cancelsAt[0]!;
  const within = (ts: number[]) => ts.filter((t) => t - first < CANCEL_MEMORY_MS).length;
  assert.ok(within(cancelsAt) <= 1 + CANCEL_RESENDS_MAX, `cancels ${within(cancelsAt)}`);
  assert.ok(within(answeredAt) <= CANCEL_LOOKUPS_MAX, `answered lookups ${within(answeredAt)}`);
  assert.ok(within(failedAt) <= CANCEL_LOOKUP_FAILS_MAX, `failed lookups ${within(failedAt)}`);
  assert.ok(within(answeredAt) + within(failedAt) <= CANCEL_LOOKUPS_MAX + CANCEL_LOOKUP_FAILS_MAX, "at most 6 lookups");
  assert.ok(rowsAt.length >= 1 && rowsAt.length <= 3, `cancel_not_confirmed rows ${rowsAt.length}`);
  assert.equal(failedAt.length, 2, "the probe's 2 failed lookups");
  assert.equal(w.sim.oversellAttempts, 0);
  // Measured when written: cancels at 0.05, 7.6, 15.15 s; failed lookups at 7.6 and 15.15 s; answered at 31.55, 39.1, 46.65 s; 3 rows.
});

test("night build, item 1: lookups that keep failing stay bounded (at most 3 failed lookups and 2 re-sends an order within the memory)", async () => {
  const w = await world(2, 0, 200);
  const bad = w.legIds[0]!;
  let sends = 0;
  let looks = 0;
  const realCancel = w.sim.cancelOrder;
  w.sim.cancelOrder = async (id: string) => {
    if (id === bad) {
      sends++;
      return; // always lost
    }
    return realCancel(id);
  };
  w.sim.getOrderById = async (id: string) => {
    if (id === bad) looks++;
    throw new Error("Alpaca 503 on lookup");
  };
  const t0 = w.sim.simMs;
  for (let k = 0; k < 10 && w.sim.simMs - t0 < 50_000; k++) {
    let done = false;
    const p = w.liq.flatten({ reason: "close-out", tradeDate: D, only: ["QAA", "QAB"], maxRounds: 4 }).finally(() => (done = true));
    const cap = w.sim.simMs + 60_000; // the clock moves until it ends, so it is never awaited with the clock stopped
    while (!done && w.sim.simMs < cap) await w.drive(w.sim.simMs + 500);
    assert.ok(done, "each liquidation ends");
    await p;
    await w.drive(w.sim.simMs + 1_000);
  }
  assert.ok(w.sim.simMs - t0 >= 50_000 && w.sim.simMs - t0 < 60_000 + 61_000, "about 50 s of retries, inside the 60 s memory of the last re-send");
  assert.ok(sends <= 1 + CANCEL_RESENDS_MAX, `cancels ${sends}`);
  assert.ok(looks <= CANCEL_LOOKUP_FAILS_MAX, `failed lookups ${looks}`);
  assert.ok(sends >= 2, "the failed lookup fell back to sending the cancel again");
  assert.equal(CANCEL_LOOKUP_FAILS_MAX, 3);
  // The give-up is not silent: one stored row (cancel_not_confirmed) when the last allowed lookup fails with no re-send left.
  assert.equal(w.events.filter((x) => x.e === "cancel_not_confirmed" && x.d.id === bad).length, 1);
});

// Night build round 1 follow-up (a judgment call under Michael's overnight instructions, item 1): with too little room above the urgent
// floor (remaining less unsent below 21), a cancel's result is not looked up; the cancel is sent again directly, as v24 does. The builder's
// probe `lookup-429.mts` as a test: one exit's first cancel is lost; Alpaca's remaining is set to `tok` at the start of the second close-out
// retry (where the head would look the result up and v24 sends the cancel again), refill `refill` a minute; the lookup room is the shared
// request budget's `urgentRoom(1)` over the simulated bucket. v24 (20ba5bd) sold QAA at 42.05 s (tok 0, refill 30) and 28.3 s (tok 2,
// refill 60); with the lookup made there, the night build sold it at 60.05 s and 29.3 s.
async function lookup429(tok: number, refill: number, withRoomCheck = true) {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  const budget = new RequestBudget({ now: () => sim.simMs, remaining: () => Math.floor(sim.tokens) });
  const events: Array<{ e: string; d: any }> = [];
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep, log: (e: string, d: any) => void events.push({ e, d }), ...(withRoomCheck ? { lookupRoom: () => budget.urgentRoom(1) } : {}) });
  const legs: string[] = [];
  for (const s of ["QAA", "QAB"]) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    legs.push(...sim.orders.find((x: any) => x.clientOrderId === id)!.legs.map((l: any) => l.id));
  }
  sim.advance(1000);
  sim.cancelMs = 200;
  sim.refillPerMinute = refill;
  const bad = legs[0];
  let lost = 1;
  let lookups = 0;
  const realCancel = sim.cancelOrder.bind(sim);
  sim.cancelOrder = async (id: string) => {
    if (id === bad && lost > 0) {
      lost--;
      sim.spend("safety"); // Alpaca took the request and lost the cancel
      return;
    }
    return realCancel(id);
  };
  const realGet = sim.getOrderById.bind(sim);
  sim.getOrderById = async (id: string) => {
    lookups++;
    return realGet(id);
  };
  const soldAt: Record<string, number> = {};
  const realSell = sim.submitSell.bind(sim);
  sim.submitSell = (x: any) => {
    soldAt[x.symbol] ??= sim.simMs;
    return realSell(x);
  };
  const t0 = sim.simMs;
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
  for (let k = 0; k < 4; k++) {
    if (k === 1) sim.tokens = tok;
    const p = liq.flatten({ reason: "close-out", tradeDate: D, only: ["QAA", "QAB"], maxRounds: 1 });
    await drive(sim.simMs + 20_000);
    await p;
  }
  return { soldQAA: soldAt.QAA === undefined ? null : soldAt.QAA - t0, lookups, events, oversell: sim.oversellAttempts };
}

for (const [tok, refill, v24, before] of [[0, 30, 42_050, 60_050], [2, 60, 28_300, 29_300]] as const) {
  test(`night build, item 1: with Alpaca's remaining low (set to ${tok}, refill ${refill} a minute) the cancel is sent again without the lookup; QAA sold no later than on v24 (${v24} ms)`, async () => {
    const r = await lookup429(tok, refill);
    assert.ok(r.soldQAA !== null && r.soldQAA <= v24, `QAA sold at ${r.soldQAA} ms (v24 ${v24})`);
    assert.equal(r.lookups, 0, "no lookup while the room is low");
    assert.ok(r.events.some((x) => x.e === "cancel_lookup_skipped"));
    assert.equal(r.oversell, 0);
    // The control: without the room check (a liquidator built alone), the lookup is made and the sale comes later.
    const off = await lookup429(tok, refill, false);
    assert.equal(off.soldQAA, before, "the lookup made: as measured before this change");
  });
}

test("night build, item 1: the worker gives the liquidator the lookup room check (one request above the urgent floor of 20)", async () => {
  const { readFileSync } = await import("node:fs");
  const w = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
  assert.match(w, /lookupRoom: \(\) => this\.budget\.urgentRoom\(1\),/);
  const b = new RequestBudget({ now: () => 0, remaining: () => 21 });
  assert.equal(b.urgentRoom(1), true, "21 less 1 is 20");
  const c = new RequestBudget({ now: () => 0, remaining: () => 20 });
  assert.equal(c.urgentRoom(1), false, "20 less 1 is 19");
});

test("night build, item 1: with no room for the lookup, re-sends stay within the allowance (2), and nothing more is sent once it is used", async () => {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep, lookupRoom: () => false });
  const id = clientOrderIdFor(D, "QAA", 1);
  await sim.submitEntry({ symbol: "QAA", qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  const bad = sim.orders.find((x: any) => x.clientOrderId === id)!.legs[0].id;
  sim.advance(1000);
  let sends = 0;
  let lookups = 0;
  const realCancel = sim.cancelOrder.bind(sim);
  sim.cancelOrder = async (x: string) => (x === bad ? void sends++ : realCancel(x)); // always lost
  sim.getOrderById = async () => void lookups++;
  const t0 = sim.simMs;
  for (let k = 0; k < 10 && sim.simMs - t0 < 50_000; k++) {
    let done = false;
    const p = liq.flatten({ reason: "close-out", tradeDate: D, only: ["QAA"], maxRounds: 4 }).finally(() => (done = true));
    const cap = sim.simMs + 60_000;
    while (!done && sim.simMs < cap) {
      const until = sim.simMs + 500;
      while (sim.simMs < until) {
        sim.advance(50);
        for (const h of holds.filter((h) => h.until <= sim.simMs)) {
          holds.splice(holds.indexOf(h), 1);
          h.res();
        }
        for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
      }
    }
    assert.ok(done, "each liquidation ends");
    await p;
  }
  assert.equal(lookups, 0);
  assert.equal(sends, 1 + CANCEL_RESENDS_MAX, "the first cancel and 2 re-sends, within about 50 s");
});

test("night build, item 1: a round where 20ba5bd would have cancelled again keeps its timing (the blind half second, then the same looks) without the cancel: with 8 s cancels the sale goes out within 0.1 s of the exits ending, as on 20ba5bd", async () => {
  const w = await world(5, 0, 8_000);
  const sold: number[] = [];
  const realSell = w.sim.submitSell;
  w.sim.submitSell = (x: any) => {
    sold.push(w.sim.simMs);
    return realSell(x);
  };
  const t0 = w.sim.simMs;
  const p = w.liq.flatten({ reason: "flatten command", tradeDate: D, maxRounds: 3 });
  await w.drive(t0 + 30_000);
  await p;
  assert.equal(w.calls.cancelAllOrders ?? 0, 1, "round 1 only (20ba5bd sent it again in round 2)");
  assert.ok(sold.length === 5, `sold ${sold.length}`);
  const gap = sold[0]! - (t0 + 8_000);
  assert.ok(gap >= 0 && gap <= 100, `first sale ${gap} ms after the cancels ended (20ba5bd: 50 ms)`);
});

test("night build, item 1: one entry's own sale is unchanged (its own exits, as before)", async () => {
  const w = await world(1, 0, 200);
  const legs = w.legIds;
  const t0 = w.sim.simMs;
  const p = w.liq.flatten({ reason: "QAA", tradeDate: D, only: ["QAA"], ownEntryOnly: { maxQty: { QAA: 5 } }, cancelIds: legs, maxRounds: 1 });
  await w.drive(t0 + 15_000);
  const r = await p;
  assert.equal(w.calls.cancelOrder ?? 0, 2, "its two exits");
  assert.equal(w.calls.cancelAllOrders ?? 0, 0);
  assert.ok(r.sold.length === 1);
});
