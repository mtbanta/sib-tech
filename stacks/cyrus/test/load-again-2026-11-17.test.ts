// Michael's request of 2026-11-17 (about 11:00 AM): "allow load afternoon to start again the same day if the earlier window ended early by
// my stop or flatten (still only while flat, before 1:30 PM)". The simulated day is 2026-11-02: open 14:30 UTC (8:30 CT), pause 16:30 UTC,
// 1:30 PM CT is 19:30 UTC, last entry 20:00 UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";
import { CONTROL_STOP, type StopFlag } from "../src/store.ts";
import { AFTERNOON_FLAT_PHASE, LOAD_AFTERNOON_ENDED_EARLY_PHASE, LOAD_AFTERNOON_PHASE, LOAD_AFTERNOON_PREVIOUS_PHASE, afternoonLoadWindow, afternoonMayStartAgain } from "../src/load-mode.ts";
import { loadAfternoonRefusal } from "../src/commands.ts";
import { MIDDAY_PHASE, readPause } from "../src/midday.ts";
import { STORED_INFO_EVENTS } from "../src/run-log.ts";

const until = async (cond: () => boolean | Promise<boolean>, n = 400) => {
  for (let i = 0; i < n && !(await cond()); i++) await settle();
};

async function flatAtMidday(opts: { load?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const events: Array<{ e: string; d: any }> = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, log: (_l, e, d) => void events.push({ e, d }), loadAfternoon: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays(`${opts.load ? "load on\n" : ""}trades 20\nposition 300\napprove`, "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:15:00");
  await r.at("14:25:00");
  await r.at("14:30:05");
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  return { sim, r, events };
}

test("the rule: the window may start again only after Michael's stop or flatten during it", () => {
  const base = { tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), dayStartEquity: 20000, limits: { maxPositionUsd: 300, dailyLossStopUsd: 500, maxTradesPerMinute: 20, borrowingCap: 1 } } as any;
  const day = (phases: Record<string, string>) => ({ ...base, phases: { [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString(), ...phases } });
  assert.equal(afternoonMayStartAgain(day({})), false, "no stop or flatten during it");
  assert.equal(afternoonMayStartAgain(day({ [LOAD_AFTERNOON_ENDED_EARLY_PHASE]: z("16:50:00").toISOString() })), true, "during the window");
  assert.equal(afternoonMayStartAgain(day({ [LOAD_AFTERNOON_ENDED_EARLY_PHASE]: z("16:39:00").toISOString() })), false, "before it started");
  assert.equal(afternoonMayStartAgain(day({ [LOAD_AFTERNOON_ENDED_EARLY_PHASE]: z("17:10:00").toISOString() })), false, "at its end or later: not early");
  assert.equal(afternoonMayStartAgain({ ...base, phases: {} }), false, "no window");
  assert.ok(STORED_INFO_EVENTS.has("load_afternoon_ended_early"));
  // Through the refusal: the other conditions still apply (here the stop route, flat, before 1:30 PM).
  const facts = (phases: Record<string, string>, now: string) => loadAfternoonRefusal({ day: { ...day(phases), status: "approved", phases: { ...day(phases).phases, armed: "x", [MIDDAY_PHASE]: "x", middayFlat: "yes" } } as any, now: z(now), pause: { on: false } as any, stop: { on: true, at: z("16:50:00").toISOString(), reason: "owner command (flatten)" }, notFlat: null, positions: 0, openOrders: 0, equity: 20000 });
  assert.match(facts({}, "16:55:00") ?? "", /already started today, and only your `stop` or `flatten` during it lets it start again/);
  assert.equal(facts({ [LOAD_AFTERNOON_ENDED_EARLY_PHASE]: z("16:50:00").toISOString() }, "16:55:00"), null);
  assert.match(facts({ [LOAD_AFTERNOON_ENDED_EARLY_PHASE]: z("16:50:00").toISOString() }, "19:30:00") ?? "", /accepted only before then/, "not from 1:30 PM CT");
});

test("a load day: flatten during the window, then `load afternoon` again: a fresh 30 minutes, its own close-out to flat with a first try; a third start without another stop is refused", async () => {
  const { sim, r, events } = await flatAtMidday({ load: true });
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  const first = (await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE];
  assert.equal(first, z("16:40:05").toISOString());
  r.ownerSays("flatten", "16:50:00");
  await r.at("16:50:05");
  await r.at("16:50:30");
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_ENDED_EARLY_PHASE], z("16:50:05").toISOString(), "Michael's flatten during the window is written down");
  assert.ok(events.some((e) => e.e === "load_afternoon_ended_early" && e.d.by === "flatten"));
  r.ownerSays("load afternoon", "16:55:00");
  await r.at("16:55:05");
  const line = r.said("commands").find((t) => t.startsWith("Afternoon load window on again"));
  assert.ok(line, r.said("commands").join(" | "));
  assert.match(line!, /until 11:25 AM CT/);
  assert.match(line!, /Stop cleared/);
  assert.equal((await r.store.getControl<StopFlag>(CONTROL_STOP))!.on, false);
  const day = (await r.store.getDay(D))!;
  assert.equal(day.phases[LOAD_AFTERNOON_PHASE], z("16:55:05").toISOString());
  assert.equal(day.phases[LOAD_AFTERNOON_PREVIOUS_PHASE], first, "the earlier start kept");
  assert.equal(afternoonLoadWindow(day)!.end.getTime(), z("17:25:05").getTime(), "a fresh 30 minutes");
  assert.ok(events.some((e) => e.e === "load_afternoon" && e.d.again === true && e.d.previousStart === first));
  // The second window ends at 17:25:05: its close-out runs with a first try and writes the flat phase.
  await r.at("17:25:06");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[AFTERNOON_FLAT_PHASE]) && !r.worker["inflight"].has("midday"));
  assert.equal(events.filter((e) => e.e === "afternoon_closeout" && e.d.step === "first").length, 1, "one first try, for the window that reached its end");
  assert.equal((await readPause(r.store, D))!.on, true, "entries paused after it");
  // A stop now (after the window) does not let it start a third time.
  r.ownerSays("stop", "17:30:00");
  await r.at("17:30:05");
  r.ownerSays("load afternoon", "17:31:00");
  await r.at("17:31:05");
  assert.ok(r.said("commands").some((t) => t.startsWith("Not started: the afternoon load window was already started today, and only your `stop` or `flatten` during it lets it start again")), r.said("commands").join(" | "));
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], z("16:55:05").toISOString(), "unchanged");
  assert.equal((await sim.listPositions()).length, 0);
});

test("a stop during the window but positions still held: the window does not start again until flat", async () => {
  const { sim, r } = await flatAtMidday({ load: true });
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  const id = "cyrus-20261102-HLD-1";
  await sim.submitEntry({ symbol: "HLD", qty: 1, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  // A stored entry of today with both exits resting, so the worker keeps it (not a carried position, not a missing-exit sale).
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "HLD", qty: 1, referencePrice: 10, stopPrice: 9, takeProfitPrice: 11, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  r.ownerSays("stop", "16:50:00");
  await r.at("16:50:05");
  await r.at("16:50:30");
  assert.ok(r.said("commands").some((t) => t.startsWith("Stopped.")), JSON.stringify(r.said("commands").slice(-3).map((t: string) => t.slice(0, 120))) + JSON.stringify(r.said("alerts").slice(-2).map((t: string) => t.slice(0, 160))));
  r.ownerSays("load afternoon", "16:51:00");
  await r.at("16:51:05");
  await r.at("16:51:30");
  assert.ok(r.said("commands").some((t) => t.startsWith("Not started:") && /position/.test(t)), r.said("commands").slice(-4).join(" | "));
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], z("16:40:05").toISOString(), "the first window's start unchanged");
  assert.equal((await sim.listPositions()).length, 1, "still held (kept by the worker, so the refusal is for holding it)");
});

test("a normal morning: flatten during the window, then `load afternoon` again runs the screen again and starts a fresh window", async () => {
  const { r } = await flatAtMidday();
  r.ownerSays("go", "16:35:00");
  await r.at("16:35:05");
  r.ownerSays("flatten", "16:38:00");
  await r.at("16:38:05");
  await r.at("16:38:30");
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:40:10");
  assert.ok(r.said("commands").some((t) => t.startsWith("Afternoon load window on until")), r.said("commands").join(" | "));
  const first = (await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE]!;
  r.ownerSays("flatten", "16:50:00");
  await r.at("16:50:05");
  await r.at("16:50:30");
  const screens = r.screenOpts.filter((o: any) => o?.load).length;
  r.ownerSays("load afternoon", "16:55:00");
  await r.at("16:55:05");
  await r.at("16:55:10");
  assert.equal(r.screenOpts.filter((o: any) => o?.load).length, screens + 1, "the screen ran again");
  assert.ok(r.said("commands").some((t) => t.startsWith("Afternoon load window on again")), r.said("commands").join(" | "));
  const day = (await r.store.getDay(D))!;
  assert.notEqual(day.phases[LOAD_AFTERNOON_PHASE], first);
  assert.equal(day.phases[LOAD_AFTERNOON_PREVIOUS_PHASE], first);
});

test("a stop during the window, its close-out at the window's end, then `load afternoon` again: the flat mark is cleared and the second window's close-out starts with its own first try", async () => {
  const { r, events } = await flatAtMidday({ load: true });
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  r.ownerSays("stop", "16:50:00");
  await r.at("16:50:05");
  await r.at("16:50:30");
  await r.at("17:10:06");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[AFTERNOON_FLAT_PHASE]) && !r.worker["inflight"].has("midday"));
  assert.equal(events.filter((e) => e.e === "afternoon_closeout" && e.d.step === "first").length, 1, "the first window's close-out ran at its end");
  r.ownerSays("load afternoon", "17:15:00");
  await r.at("17:15:05");
  await r.at("17:15:30");
  assert.ok(r.said("commands").some((t) => t.startsWith("Afternoon load window on again")), r.said("commands").slice(-3).join(" | "));
  assert.equal((await r.store.getDay(D))!.phases[AFTERNOON_FLAT_PHASE], "", "the earlier window's flat mark cleared");
  assert.equal((await readPause(r.store, D))!.on, false, "trading resumed in the new window");
  await r.at("17:45:06");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[AFTERNOON_FLAT_PHASE]) && !r.worker["inflight"].has("midday"));
  assert.equal(events.filter((e) => e.e === "afternoon_closeout" && e.d.step === "first").length, 2, "the second window's close-out started with its own first try (counted per window)");
  assert.equal((await readPause(r.store, D))!.on, true);
});
