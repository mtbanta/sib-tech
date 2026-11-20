// Michael's decision of 2026-11-20 (after the mid-day review), word for word: "start every close-out on a timer at its due time, instead
// of on the next 5-second pass." Each pass sets a one-shot timer for a close-out whose first try is due within 15 s (the mid-day close-out
// at 10:30 AM Central, the afternoon window's close-out at the window's end, the regular close-out at its set time); the timer runs the
// pass's own start code at the due time. `closeout_result.timing.triggeredBy` says "timer" or "pass". Retries, the carried sale and the
// emergency close-out stay on the pass. The pass still starts a first try whose timer did not (the fallback, v34's behaviour).
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientOrderIdFor } from "../src/gate.ts";
import { MIDDAY_PHASE } from "../src/midday.ts";
import { afternoonLoadWindow } from "../src/load-mode.ts";
import { CLOSEOUT_TIMER_AHEAD_MS, CLOSEOUT_TIMER_REARMS } from "../src/worker.ts";
import { shouldStoreEvent } from "../src/run-log.ts";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";

const until = async (cond: () => boolean | Promise<boolean>, n = 400) => {
  for (let i = 0; i < n && !(await cond()); i++) await settle();
};
const iso = (s: string | null) => (s === null ? NaN : Date.parse(s));

// The rig's day in the session (8:30 AM Central is 14:30 UTC on the rig's day), armed, with logs kept.
async function rigDay(opts: { loadAfternoon?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const logs: Array<{ level: string; event: string; data?: Record<string, unknown> }> = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, log: (level, event, data) => void logs.push({ level, event, ...(data ? { data } : {}) }), ...(opts.loadAfternoon ? { loadAfternoon: true } : {}) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("trades 20\nposition 300\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:15:00");
  await r.at("14:25:00");
  await r.at("14:30:05");
  return { sim, r, logs };
}
async function rigHold(sim: SimBroker, r: ReturnType<typeof rig<SimBroker>>, symbol: string, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await sim.submitEntry({ symbol, qty: 10, stopPrice: 45, takeProfitPrice: 55, referencePrice: 50, clientOrderId: id });
  sim.fillEntry(id, 50);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 10, referencePrice: 50, stopPrice: 45, takeProfitPrice: 55, status: "filled", alpacaOrderId: null, filledQty: 10, filledAvgPrice: 50, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
}
const results = (r: ReturnType<typeof rig<SimBroker>>, path: string, fromIdx = 0) => r.store.events.slice(fromIdx).filter((e) => e.event === "closeout_result" && e.data!.path === path).map((e) => e.data as any);
const timers = (r: ReturnType<typeof rig<SimBroker>>) => r.worker["closeoutTimers"] as Map<string, { dueMs: number; rearms: number }>;
// A pass held at its first wait (the command read) until `release` is called: its `now` is the time it started.
function holdNextPass(r: ReturnType<typeof rig<SimBroker>>) {
  const commands = r.worker["commands"];
  const orig = commands.poll.bind(commands);
  let release!: () => void;
  const gate = new Promise<void>((res) => (release = res));
  commands.poll = async () => {
    commands.poll = orig;
    await gate;
    return orig();
  };
  return () => release();
}

test("the mid-day close-out starts at 10:30:00.000 by its timer: due, triggered and the timer's own start are the same instant; the missing-exit check stands aside from that moment; the pass at 10:30:00 starts nothing more", async () => {
  const { sim, r } = await rigDay();
  sim.advanceTo(z("16:00:00").getTime());
  await rigHold(sim, r, "AAA", 1);
  await r.at("16:29:50"); // a pass 10 s before the pause sets the timer
  assert.equal(timers(r).get("midday")?.dueMs, z("16:30:00").getTime(), "the mid-day timer is set for the pause");
  assert.equal(r.worker["middayOwnsSelling"], false);
  r.setNow("16:30:00"); // the clock reaches the pause: the timer fires, no pass runs
  assert.equal(r.worker["inflight"].has("midday"), true, "started by the timer, before any pass");
  assert.equal(r.worker["middayOwnsSelling"], true, "the missing-exit check stands aside from the first moment");
  assert.equal(r.worker.protectNow(new Date(Date.UTC(2026, 10, 2, 21, 0))), false);
  await r.worker.tick(); // the pass at the same instant
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]) && !r.worker["inflight"].has("midday"));
  const all = results(r, "midday");
  assert.equal(all.length, 1, "one try, flat");
  assert.equal(all[0].flat, true);
  assert.equal(all[0].timing.dueAt, z("16:30:00").toISOString());
  assert.equal(all[0].timing.triggeredAt, z("16:30:00").toISOString(), "triggered at the due time (the simulated clock is exact)");
  assert.equal(all[0].timing.triggeredBy, "timer");
  assert.ok(iso(all[0].timing.startedAt) >= iso(all[0].timing.triggeredAt));
  assert.equal(timers(r).has("midday"), false, "the timer is used up");
  assert.equal(sim.oversellAttempts, 0);
});

test("the regular close-out starts at its set time by its timer (5 minutes before the close in the rig), and its retry stays on the pass", async () => {
  const { sim, r } = await rigDay();
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  sim.advanceTo(z("20:50:00").getTime());
  await rigHold(sim, r, "BBB", 1);
  sim.refuseSellsTimes = 100_000; // the first try cannot sell: a retry follows
  await r.at("20:54:50");
  assert.equal(timers(r).get("regular")?.dueMs, z("20:55:00").getTime());
  r.setNow("20:55:00");
  assert.equal(r.worker["inflight"].has("closeout"), true, "started by the timer");
  await until(() => results(r, "close-out").length >= 1 && !r.worker["inflight"].has("closeout"));
  const first = results(r, "close-out")[0]!;
  assert.equal(first.flat, false);
  assert.equal(first.timing.dueAt, z("20:55:00").toISOString());
  assert.equal(first.timing.triggeredBy, "timer");
  assert.ok(iso(first.timing.triggeredAt) - iso(first.timing.dueAt) < 50, "triggered within 50 ms of its due time");
  sim.refuseSellsTimes = 0;
  await r.at(new Date(sim.simMs + 25_000).toISOString());
  await until(() => results(r, "retry").length >= 1 && !r.worker["inflight"].has("closeout"));
  const retry = results(r, "retry")[0]!;
  assert.equal(retry.timing.triggeredBy, "pass", "retries stay on the pass");
  assert.equal(retry.timing.dueAt, null);
  assert.equal(sim.oversellAttempts, 0);
});

test("the afternoon window's close-out starts at the window's end by its timer", async () => {
  const { sim, r } = await rigDay({ loadAfternoon: true });
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:40:10");
  const end = afternoonLoadWindow((await r.store.getDay(D))!)!.end;
  assert.ok(end.getTime() > sim.simMs, "the window is on");
  await rigHold(sim, r, "AAA", 7);
  const from = r.store.events.length;
  await r.at(new Date(end.getTime() - 8_000).toISOString());
  assert.equal(timers(r).get("afternoon")?.dueMs, end.getTime());
  r.setNow(end.toISOString());
  assert.equal(r.worker["inflight"].has("midday"), true, "the afternoon close-out runs under the mid-day step's name, started by the timer");
  assert.equal(r.worker["middayOwnsSelling"], true);
  await until(() => results(r, "midday", from).length >= 1 && !r.worker["inflight"].has("midday"));
  const first = results(r, "midday", from)[0]!;
  assert.equal(first.timing.dueAt, end.toISOString());
  assert.equal(first.timing.triggeredAt, end.toISOString());
  assert.equal(first.timing.triggeredBy, "timer");
});

test("fallback: with no pass in the 15 s before the due time no timer is set, and the pass starts the close-out as in v34 (triggeredBy pass)", async () => {
  const { sim, r } = await rigDay();
  sim.advanceTo(z("16:00:00").getTime());
  await rigHold(sim, r, "AAA", 1);
  await r.at(new Date(z("16:30:00").getTime() - CLOSEOUT_TIMER_AHEAD_MS - 1_000).toISOString());
  assert.equal(timers(r).has("midday"), false, "more than 15 s ahead: not set yet");
  await r.at("16:30:03");
  await until(() => results(r, "midday").length >= 1 && !r.worker["inflight"].has("midday"));
  const first = results(r, "midday")[0]!;
  assert.equal(first.timing.triggeredBy, "pass");
  assert.equal(first.timing.triggeredAt, z("16:30:03").toISOString());
});

test("a pass that started before 10:30 and is still waiting when the timer fires: one try only, and the pass, reaching its end after the timer, leaves the missing-exit check standing aside", async () => {
  const { sim, r } = await rigDay();
  sim.advanceTo(z("16:00:00").getTime());
  await rigHold(sim, r, "AAA", 1);
  await r.at("16:29:50");
  sim.advanceTo(z("16:29:59").getTime() + 900);
  const release = holdNextPass(r);
  const pass = r.worker.tick(); // starts at 10:29:59.900 and waits at its command read
  await settle();
  r.setNow("16:30:00"); // the timer fires meanwhile
  assert.equal(r.worker["inflight"].has("midday"), true);
  release();
  await pass;
  assert.equal(r.worker["middayOwnsSelling"], true, "judged at this moment's time, not the pass's start");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]) && !r.worker["inflight"].has("midday"));
  assert.equal(results(r, "midday").length, 1);
  assert.equal(results(r, "midday")[0].timing.triggeredBy, "timer");
});

test("a pass that started at 10:30 (before the timer fired) and waits: the timer starts the try, the pass then finds it running and starts nothing", async () => {
  const { sim, r } = await rigDay();
  sim.advanceTo(z("16:00:00").getTime());
  await rigHold(sim, r, "AAA", 1);
  await r.at("16:29:50");
  sim.advanceTo(z("16:30:00").getTime()); // the clock moves without running timers
  const release = holdNextPass(r);
  const pass = r.worker.tick();
  await settle();
  r.setNow("16:30:00"); // now the timer fires
  release();
  await pass;
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]) && !r.worker["inflight"].has("midday"));
  assert.equal(results(r, "midday").length, 1);
  assert.equal(results(r, "midday")[0].timing.triggeredBy, "timer");
});

test("the pass starts the try first (the timer late): the timer then starts nothing", async () => {
  const { sim, r } = await rigDay();
  sim.advanceTo(z("16:00:00").getTime());
  await rigHold(sim, r, "AAA", 1);
  sim.refuseSellsTimes = 100_000; // keeps the first try running long enough to overlap
  await r.at("16:29:50");
  sim.advanceTo(z("16:30:00").getTime());
  await r.worker.tick(); // the pass at 10:30:00 starts it
  assert.equal(r.worker["inflight"].has("midday"), true);
  r.setNow("16:30:00"); // the timer fires late
  sim.refuseSellsTimes = 0;
  await until(() => results(r, "midday").length >= 1 && !r.worker["inflight"].has("midday"));
  assert.equal(results(r, "midday").length, 1);
  assert.equal(results(r, "midday")[0].timing.triggeredBy, "pass");
  // A first try that finished (flat or not) is not started again by a late start call within the retry gap.
  r.worker["startMiddayCloseouts"](r.worker["lastDay"]!, new Date(sim.simMs), D, "timer");
  assert.equal(r.worker["inflight"].has("midday"), false, "inside the 20 s retry gap: nothing started");
});

test("a timer that fires early is set again for the rest, at most CLOSEOUT_TIMER_REARMS times, then gives way to the pass (logged)", async () => {
  const { sim, r, logs } = await rigDay();
  await r.at("16:29:50");
  const set = timers(r).get("midday")!;
  const due = set.dueMs;
  for (let i = 0; i <= CLOSEOUT_TIMER_REARMS; i++) {
    r.worker["closeoutTimerFired"]("midday", due); // fired while the clock is still before the due time
    if (i < CLOSEOUT_TIMER_REARMS) assert.equal(timers(r).get("midday")?.rearms, i + 1, "set again for the rest");
  }
  assert.equal(timers(r).has("midday"), false, "no further re-arm");
  assert.ok(logs.some((l) => l.event === "closeout_timer_early" && l.level === "warn"));
  assert.equal(r.worker["inflight"].has("midday"), false, "nothing started early");
  assert.ok(sim.simMs < due);
});

test("no record of today in memory when the timer fires: nothing starts, it is logged, and the next pass starts the close-out", async () => {
  const { sim, r, logs } = await rigDay();
  sim.advanceTo(z("16:00:00").getTime());
  await rigHold(sim, r, "AAA", 1);
  await r.at("16:29:50");
  r.worker["lastDay"] = null;
  r.setNow("16:30:00");
  assert.equal(r.worker["inflight"].has("midday"), false);
  assert.ok(logs.some((l) => l.event === "closeout_timer_no_day" && l.level === "warn"), "a warning, so it is stored in the run log");
  await r.at("16:30:04");
  await until(() => results(r, "midday").length >= 1 && !r.worker["inflight"].has("midday"));
  assert.equal(results(r, "midday")[0].timing.triggeredBy, "pass");
});

test("a timer whose due time moves is replaced and stop() clears every timer", async () => {
  const { r } = await rigDay();
  await r.at("16:29:50");
  const day = r.worker["lastDay"]!;
  const before = r.timers().length;
  assert.ok(timers(r).has("midday"));
  // A day whose pause is 5 s later: the old timer is cleared and a new one set.
  const moved = { ...day, openAt: new Date(day.openAt!.getTime() + 5_000) };
  r.worker["armCloseoutTimers"](moved, new Date(z("16:29:50").getTime()));
  assert.equal(timers(r).get("midday")?.dueMs, z("16:30:05").getTime());
  assert.equal(r.timers().length, before, "replaced, not added");
  r.worker.stop();
  assert.equal(timers(r).size, 0);
  assert.equal(r.timers().filter((t) => t === z("16:30:05").getTime()).length, 0, "cleared from the clock");
});

test("a record of another day in memory when the timer fires counts as none: nothing starts from it", async () => {
  const { sim, r, logs } = await rigDay();
  sim.advanceTo(z("16:00:00").getTime());
  await rigHold(sim, r, "AAA", 1);
  await r.at("16:29:50");
  r.worker["lastDay"] = { ...r.worker["lastDay"]!, tradeDate: "2026-10-30" };
  r.setNow("16:30:00");
  assert.equal(r.worker["inflight"].has("midday"), false);
  assert.ok(logs.some((l) => l.event === "closeout_timer_no_day" && l.level === "warn"), "a warning, so it is stored in the run log");
});

test("the timer's three give-way events are logged at levels the run log stores (warnings and an error)", () => {
  for (const [level, name] of [["warn", "closeout_timer_early"], ["warn", "closeout_timer_no_day"], ["error", "closeout_timer_failed"]] as const) assert.equal(shouldStoreEvent(level, name), true, name);
});

test("start code that throws inside the timer: logged as closeout_timer_failed (an error), nothing thrown out of the timer, and the next pass starts the close-out (triggeredBy pass)", async () => {
  const { sim, r, logs } = await rigDay();
  sim.advanceTo(z("16:00:00").getTime());
  await rigHold(sim, r, "AAA", 1);
  await r.at("16:29:50");
  const orig = r.worker["startMiddayCloseouts"].bind(r.worker);
  r.worker["startMiddayCloseouts"] = (...a: Parameters<typeof orig>) => {
    if (a[3] === "timer") throw new Error("boom in the start code");
    return orig(...a);
  };
  assert.doesNotThrow(() => r.setNow("16:30:00"));
  const failed = logs.find((l) => l.event === "closeout_timer_failed");
  assert.equal(failed?.level, "error");
  assert.equal(failed?.data?.kind, "midday");
  assert.equal(r.worker["inflight"].has("midday"), false);
  await r.at("16:30:04");
  await until(() => results(r, "midday").length >= 1 && !r.worker["inflight"].has("midday"));
  assert.equal(results(r, "midday")[0].timing.triggeredBy, "pass");
});
