// Item 3 of the night build (Michael's request of 2026-11-16, about 8:50 PM, decision 4 changed): "First tries: paced, not exempt; they
// wait only for Alpaca's requests to refill, at most about 3 s." A first try waits, sending nothing, while Alpaca's remaining less the
// room budgeted tries hold unsent less what the try can send is below the urgent floor of 20; at most 3 s; a one-entry first try's wait
// ends at once when a sale of the whole account is asked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FIRST_TRY_MOST, FIRST_TRY_WAIT_MAX_MS, P1_FLOOR, RequestBudget } from "../src/request-budget.ts";

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

test("night build, item 3: with room a first try goes at once; without, it waits 0.25, 0.5, 1, then 1 and 0.25 s (3 s in all), sending nothing, then goes ahead", async () => {
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
});

test("night build, item 3: the wait ends as soon as Alpaca's requests have refilled enough", async () => {
  let rem = 40;
  const r = rig(() => rem);
  const sleep = async (ms: number) => {
    await r.sleep(ms);
    rem += ms / 300; // about 3.3 requests a second
  };
  const waited = await r.b.paceFirst(25, "remainder", sleep, true);
  assert.ok(waited > 0 && waited < 3_000, `waited ${waited} ms`);
  assert.equal(r.b.firstRoom(25), true);
});

test("night build, item 3: a one-entry first try's wait ends at once when a sale of the whole account is asked; a close-out's first try (not wakeable) waits on", async () => {
  const r = rig(() => 0);
  const sleep = (ms: number) => new Promise<void>((res) => setTimeout(() => (r.advance(ms), res()), 5));
  const p = r.b.paceFirst(25, "missing-exit sale", sleep, true);
  await new Promise((res) => setTimeout(res, 2));
  r.b.wakeFirstWaiters();
  const waited = await p;
  assert.ok(waited < 250, `woken at once (${waited} ms)`);
  const q = r.b.paceFirst(60, "close-out", r.sleep, false);
  r.b.wakeFirstWaiters();
  assert.equal(await q, 3_000);
});

test("night build, item 3: which first tries are paced (missing-exit, remainder, fast sale) and which are not (the close-outs, the loss stop, the start-up check, the carried sale)", () => {
  const risk = readFileSync(new URL("../src/risk.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
  assert.match(risk, /if \(d\.sleep\) await budgetOf\(d, mem\)\.paceFirst\(FIRST_TRY_MOST, label, d\.sleep, true\);\n    return withReservation\(budgetOf\(d, mem\)\.first\(label\), fn, "first"\);/);
  assert.match(risk, /paceFirst\(FIRST_TRY_MOST, "fast sale", d\.sleep, true\)/);
  // The close-outs' first tries are not paced (night-a2 tuning): measured on 2026-11-16 (simulator, the worker's own 2:55 and mid-day
  // close-outs, Alpaca's remaining forced to 60 at the loss), waiting 1.8 to 3 s before the close-out delayed its sales by as much against v24.
  assert.ok(!worker.includes("paceFirst"), "no close-out first try waits");
  assert.match(worker, /onWholeAccountAsk: \(\) => this\.budget\.wakeFirstWaiters\(\),/);
  // Not paced: the loss stop's first sale (the most urgent), the start-up protection check (reads only), the carried-position sale.
  assert.doesNotMatch(risk, /paceFirst\([^)]*"loss stop first sale"/);
  assert.doesNotMatch(risk, /paceFirst\([^)]*"start-up protection check"/);
  assert.ok(!worker.includes('paceFirstTry("carried-position sale")'));
});
