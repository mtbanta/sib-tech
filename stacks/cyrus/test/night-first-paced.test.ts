// Item 3 of the night build (Michael's request of 2026-11-16, about 8:50 PM, decision 4 changed): "First tries: paced, not exempt; they
// wait only for Alpaca's requests to refill, at most about 3 s." A first try waits, sending nothing, while Alpaca's remaining less the
// room budgeted tries hold unsent less what the try can send is below the urgent floor of 20; at most 3 s; a one-entry first try's wait
// ends at once when a sale of the whole account is asked.
//
// Item 3 ships switched off (Michael's answer of 2026-11-16, about 10:25 PM; FIRST_TRY_PACING): the off tests come first; the pacing
// tests after them switch it on, one test at a time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIRST_TRY_MOST, FIRST_TRY_PACING, FIRST_TRY_WAIT_MAX_MS, P1_FLOOR, RequestBudget } from "../src/request-budget.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import type { TradeUpdate } from "../src/order-stream.ts";
import { SimBroker } from "./sim-broker.ts";
import { FakeBot, order } from "./helpers.ts";
import { D, rig as workerRig, settle, z } from "./rig.ts";

// Runs `fn` with item 3 switched on, then switches it off again whatever happens.
async function pacingOn<T>(fn: () => T | Promise<T>): Promise<T> {
  FIRST_TRY_PACING.on = true;
  try {
    return await fn();
  } finally {
    FIRST_TRY_PACING.on = false;
  }
}

test("item 3 switched off as shipped", () => {
  assert.equal(FIRST_TRY_PACING.on, false);
});

test("item 3 off: a first try with no room goes ahead at once (no wait, no first_try_paced, firstPaced 0), as on v24", async () => {
  const logs: string[] = [];
  const sleeps: number[] = [];
  const b = new RequestBudget({ now: () => 1_000_000, remaining: () => 0, log: (e) => void logs.push(e) });
  assert.equal(b.firstRoom(25), false, "no room: pacing would wait if it were on");
  assert.equal(await b.paceFirst(25, "missing-exit sale", async (ms) => void sleeps.push(ms), true), 0);
  assert.equal(await b.paceFirst(25, "fast sale", async (ms) => void sleeps.push(ms), true), 0);
  assert.deepEqual(sleeps, []);
  assert.deepEqual(logs, []);
  const m = b.takeMinute();
  assert.equal(m.firstPaced, 0);
  assert.equal(m.firstPacedMs, 0);
});

const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null, atMs: number | null = null): TradeUpdate => ({ event, order: order(o), positionQty, atMs });

// Lost exits on a normal day with Alpaca's remaining at 0 (no room above the urgent floor): the order sync's missing-exit sale is a first try.
async function lostExitsNoRoom() {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.hideFilledParents = true;
  const events: string[] = [];
  const r = workerRig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true, bot: new FakeBot(), log: (_l, event) => events.push(event) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("14:59:00").getTime());
  const budget = (r.worker as unknown as { budget: RequestBudget }).budget;
  (budget as unknown as { remaining: () => number }).remaining = () => 0;
  const id = clientOrderIdFor(D, "IREN", 1);
  await sim.submitEntry({ symbol: "IREN", qty: 1, stopPrice: 9.98, takeProfitPrice: 10.01, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "IREN", qty: 1, referencePrice: 10, stopPrice: 9.98, takeProfitPrice: 10.01, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  const o = sim.orders.find((x) => x.clientOrderId === id)!;
  await r.at("15:00:00");
  await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: "IREN", side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 10, groupId: o.groupId }, 1));
  sim.cancelExitsAtFill(id);
  for (const l of o.legs) await r.orderUpdate(upd("canceled", { ...structuredClone(l), status: "canceled", groupId: o.groupId }, null, sim.simMs));
  for (let i = 0; i < 10; i++) await settle();
  for (const t of ["15:00:03", "15:00:05", "15:00:10"]) await r.at(t);
  const sale = sim.sellLog.find((x) => x.symbol === "IREN");
  return { events, sale, sim, firstPaced: budget.takeMinute().firstPaced };
}

// main.ts builds the Worker without `sleep`, so the paced call sites (`if (d.sleep)`) never paced on Fly (group 1, night round 1). With the
// switch off, even a worker given a sleep (as every test rig is) never paces.
test("item 3 off, worker: main.ts builds the Worker without a sleep, and a worker given one never paces either (lost exits with no room)", async () => {
  const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
  const ctor = main.slice(main.indexOf("const worker = new Worker({"), main.indexOf("log: logAndStore,\n});"));
  assert.ok(ctor.length > 0 && !/\n  sleep[:,]/.test(ctor), "no sleep in main.ts's Worker");
  const off = await lostExitsNoRoom();
  assert.ok(off.events.includes("exits_lost"), "the loss was seen");
  assert.ok(off.sale, "sold");
  assert.ok(!off.events.includes("first_try_paced"), "no first_try_paced");
  assert.equal(off.firstPaced, 0);
  assert.equal(off.sim.oversellAttempts, 0);
  // The control: switched on, the same first try waits for room (so the check above can tell the two apart).
  const on = await pacingOn(lostExitsNoRoom);
  assert.ok(on.events.includes("first_try_paced") || on.firstPaced > 0, on.events.join(","));
  assert.ok(on.sale && on.sale.at - off.sale!.at >= 2_500, `switched on the sale waits about 3 s for room (off ${off.sale!.at}, on ${on.sale?.at})`); // measured: 15:00:03 off, 15:00:06 on
});

// A budget on a clock the test owns; `remaining` is Alpaca's remaining as the governor estimates it.
function rig(remaining: () => number) {
  let now = 1_000_000;
  const logs: Array<{ e: string; d: any }> = [];
  const b = new RequestBudget({ now: () => now, remaining, log: (e, d) => void logs.push({ e, d }) });
  const sleeps: number[] = [];
  const sleep = async (ms: number) => {
    sleeps.push(ms);
    now += ms;
  };
  return { b, logs, sleeps, sleep, at: () => now, advance: (ms: number) => (now += ms) };
}

test("night build, item 3: the constants and the room rule (remaining less unsent less the try's requests, at or above 20)", () => {
  assert.deepEqual([FIRST_TRY_WAIT_MAX_MS, FIRST_TRY_MOST, P1_FLOOR], [3_000, 25, 20]);
  let rem = 45;
  const r = rig(() => rem);
  assert.equal(r.b.firstRoom(25), true, "45 - 25 = 20");
  rem = 44;
  assert.equal(r.b.firstRoom(25), false);
  rem = 60;
  const res = r.b.tryReserve("P1", 10, { label: "x" });
  assert.ok(!("ok" in res), "a reservation of 10, unsent");
  assert.equal(r.b.firstRoom(25), true, "60 - 10 - 25 = 25");
  assert.equal(r.b.firstRoom(31), false, "60 - 10 - 31 = 19");
});

test("night build, item 3: with room a first try goes at once; without, it waits 0.25, 0.5, 1, then 1 and 0.25 s (3 s in all), sending nothing, then goes ahead", () => pacingOn(async () => {
  const r = rig(() => 100);
  assert.equal(await r.b.paceFirst(25, "missing-exit sale", r.sleep, true), 0);
  assert.deepEqual(r.sleeps, []);
  const low = rig(() => 30);
  const waited = await low.b.paceFirst(25, "missing-exit sale", low.sleep, true);
  assert.equal(waited, 3_000);
  assert.deepEqual(low.sleeps, [250, 500, 1_000, 1_000, 250]);
  const m = low.b.takeMinute();
  assert.equal(m.firstPaced, 1);
  assert.equal(m.firstPacedMs, 3_000);
  assert.ok(low.logs.some((x) => x.e === "first_try_paced" && x.d.waitedMs === 3_000 && x.d.room === false));
}));

test("night build, item 3: the wait ends as soon as Alpaca's requests have refilled enough", () => pacingOn(async () => {
  let rem = 40;
  const r = rig(() => rem);
  const sleep = async (ms: number) => {
    await r.sleep(ms);
    rem += ms / 300; // about 3.3 requests a second
  };
  const waited = await r.b.paceFirst(25, "remainder", sleep, true);
  assert.ok(waited > 0 && waited < 3_000, `waited ${waited} ms`);
  assert.equal(r.b.firstRoom(25), true);
}));

// The close-outs' first tries no longer wait at all (v24's code since the night build tuning; see the test below); the second wait here
// only checks that a wait asked as not wakeable is not ended by a whole-account ask.
test("night build, item 3: a one-entry first try's wait ends at once when a sale of the whole account is asked; a wait asked as not wakeable waits on", () => pacingOn(async () => {
  const r = rig(() => 0);
  const sleep = (ms: number) => new Promise<void>((res) => setTimeout(() => (r.advance(ms), res()), 5));
  const p = r.b.paceFirst(25, "missing-exit sale", sleep, true);
  await new Promise((res) => setTimeout(res, 2));
  r.b.wakeFirstWaiters();
  const waited = await p;
  assert.ok(waited < 250, `woken at once (${waited} ms)`);
  const q = r.b.paceFirst(60, "not wakeable", r.sleep, false);
  r.b.wakeFirstWaiters();
  assert.equal(await q, 3_000);
}));

test("night build, item 3: which first tries are paced (missing-exit, remainder, fast sale) and which are not (the close-outs, the loss stop, the start-up check, the carried sale)", () => {
  const risk = readFileSync(new URL("../src/risk.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
  assert.match(risk, /if \(d\.sleep\) await budgetOf\(d, mem\)\.paceFirst\(FIRST_TRY_MOST, label, d\.sleep, true\);\n    return withReservation\(budgetOf\(d, mem\)\.first\(label\), fn, "first"\);/);
  assert.match(risk, /paceFirst\(FIRST_TRY_MOST, "fast sale", d\.sleep, true\)/);
  // The close-outs' first tries are not paced (night-a2 tuning): measured on 2026-11-16 (simulator, the worker's own 2:55 and mid-day
  // close-outs, Alpaca's remaining forced to 60 at the loss), waiting 1.8 to 3 s before the close-out delayed its sales by as much against v24.
  assert.ok(!worker.includes("paceFirst"), "no close-out first try waits");
  // The whole-account wake-up (`onWholeAccountAsk`) lived in item 1's sells.ts; with item 1 left out (night-noitem1) sells.ts is v24's text,
  // so the worker no longer wires it. Item 3 is switched off, so no first try ever waits to be woken.
  assert.ok(!worker.includes("onWholeAccountAsk"), "not wired: sells.ts is v24's");
  // Not paced: the loss stop's first sale (the most urgent), the start-up protection check (reads only), the carried-position sale.
  assert.doesNotMatch(risk, /paceFirst\([^)]*"loss stop first sale"/);
  assert.doesNotMatch(risk, /paceFirst\([^)]*"start-up protection check"/);
  assert.ok(!worker.includes('paceFirstTry("carried-position sale")'));
});
