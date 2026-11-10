// Release 2 of 2026-11-09: the mid-day cycle (builds/c2-proposal-2026-11-09.md, part D, with Michael's answers). Trading from the open
// to 10:30 AM Central; at 10:30 the pause and the mid-day close-out (the 2:55 close-out code) until flat; a deploy while flat and
// paused resumes trading on its own before 1:30 PM unless `hold`; a plain restart stays paused; `go` resumes. The simulated day is
// 2026-11-02 (New York standard time): open 14:30 UTC (8:30 CT), pause 16:30 UTC (10:30 CT), 1:30 PM CT is 19:30 UTC, the
// close-out 20:55 UTC, the close 21:00 UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";
import { clientOrderIdFor, MIDDAY_PAUSED, OrderGate } from "../src/gate.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Governor } from "../src/governor.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { closeOut } from "../src/closeout.ts";
import { ensureDay } from "../src/morning.ts";
import { MemoryStore, CONTROL_STOP, type Store } from "../src/store.ts";
import { CachingStore } from "../src/caching-store.ts";
import { parseCommand } from "../src/morning.ts";
import { recordStart } from "../src/start-note.ts";
import { FakeBroker, FakeBot } from "./helpers.ts";
import type { Signal } from "../src/strategy.ts";
import { MIDDAY_NOTE_PHASE, MIDDAY_PHASE, MiddayBudget, blockedNext, deployRefusals, emptyPause, type DeployFacts, goRefusal, middayHoldKey, middayKey, middayTimes, readHold, readPause, retryAllowed, retrySymbols, startupAction, updatePause, type MiddayPause } from "../src/midday.ts";

const until = async (cond: () => boolean | Promise<boolean>, n = 400) => {
  for (let i = 0; i < n && !(await cond()); i++) await settle();
};

// An approved, armed day in the simulator (cap 2, so a cap left alone is visible), with the order rig's clock on the simulator's.
async function armedDay(opts: { early?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  if (opts.early) sim.calendar = [{ date: "2026-11-02", open: "09:30", close: "13:00" }];
  const events: Array<{ e: string; d: any }> = [];
  const bot = new FakeBot();
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, bot, log: (_l, e, d) => void events.push({ e, d }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  return { sim, r, events, bot };
}

// A filled bracket entry with far-away exits, written down as the gate would have.
async function hold(sim: SimBroker, store: Store, symbol: string, qty: number, price: number, n = 1) {
  const id = clientOrderIdFor(D, symbol, n);
  await sim.submitEntry({ symbol, qty, stopPrice: price * 0.9, takeProfitPrice: price * 1.1, referencePrice: price, clientOrderId: id });
  sim.fillEntry(id, price);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price * 0.9, takeProfitPrice: price * 1.1, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  return id;
}

// The pass at 10:30 CT and the mid-day close-out to flat.
async function middayFlat(w: Awaited<ReturnType<typeof armedDay>>) {
  await w.r.at("16:30:00");
  await until(async () => Boolean((await w.r.store.getDay(D))!.phases[MIDDAY_PHASE]));
}

// A second worker on the same store and simulator: a restart (a deploy when `deploy` is set).
function restart(w: Awaited<ReturnType<typeof armedDay>>, info: { deploy: boolean; release: string } | null) {
  const r2 = rig<SimBroker>({ broker: w.sim, sleep: w.sim.sleep, simClock: w.sim, store: w.r.store, bot: w.bot });
  if (info) r2.worker.setStartInfo(info);
  return r2;
}

// ---------------- the day ----------------

test("a full day: at 10:30 CT the pause goes on and the mid-day close-out sells everything (slow cancels) without touching the cap or the 2:55 close-out; the 1:30 note once; the 2:55 close-out and the summary still run", async () => {
  const w = await armedDay();
  const { sim, r } = w;
  assert.equal(sim.config.maxMarginMultiplier, 2, "armed at the approved cap");
  sim.advanceTo(z("16:00:00").getTime());
  await hold(sim, r.store, "AAA", 10, 50);
  await hold(sim, r.store, "BBB", 20, 10);
  await r.store.insertOrder({ clientOrderId: clientOrderIdFor(D, "CCC", 1), tradeDate: D, symbol: "CCC", qty: 1, referencePrice: 5, stopPrice: 4.9, takeProfitPrice: 5.1, status: "canceled", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: "stop flag set before sending", createdAt: new Date(sim.simMs).toISOString() });
  sim.cancelMs = 7_000;
  await r.at("16:29:55");
  assert.equal(await readPause(r.store, D), null, "nothing before 10:30");
  const streamBefore = r.counts();
  assert.ok(streamBefore.streamStarts >= 1, "live prices running");
  await middayFlat(w);
  assert.equal(r.counts().streamStops, streamBefore.streamStops, "the mid-day close-out leaves the price stream running (a `go` trades at once)");
  const pause = (await readPause(r.store, D))!;
  assert.equal(pause.on, true);
  assert.equal(pause.since, z("16:30:00").toISOString());
  assert.equal((await sim.listPositions()).length, 0, "flat");
  assert.deepEqual(sim.sellLog.map((x) => [x.symbol, x.qty]).sort(), [["AAA", 10], ["BBB", 20]]);
  assert.equal(sim.oversellAttempts, 0);
  const day = (await r.store.getDay(D))!;
  assert.equal(day.phases.middayFlat, "yes");
  assert.equal(day.phases.closeout, undefined, "the mid-day close-out never writes the closeout phase");
  assert.equal(sim.config.maxMarginMultiplier, 2, "the cap is left alone at mid-day");
  assert.ok(r.said("trading").includes("Mid-day close-out done: the account is flat. Paused for the mid-day cycle."));
  assert.ok(!r.said("trading").some((t) => t.startsWith("Close-out done")), "not the 2:55 message");
  const morning = r.said("commands").find((t) => t.startsWith("Morning (open to"))!;
  assert.ok(morning.startsWith("Morning (open to 10:30 AM CT): "), morning);
  assert.ok(morning.includes("before 1:30 PM CT") && morning.includes("(last entry 2:00 PM CT)"), morning);
  assert.ok(morning && morning.includes("2 entries sent (2 filled)") && morning.includes("rate-limit answers from Alpaca: 0") && morning.includes("unless you send `hold`"), morning);
  const co = r.store.events.find((e) => e.event === "closeout_result")!;
  assert.equal(co.data!.path, "midday", "recorded as the mid-day close-out");
  assert.equal(co.data!.flat, true);
  // the 1:30 PM note, once
  await r.at("19:29:55");
  assert.ok(!r.said("commands").some((t) => t.startsWith("1:30 PM CT")));
  await r.at("19:30:00");
  await r.at("19:30:05");
  assert.equal(r.said("commands").filter((t) => t === "1:30 PM CT: nothing was deployed, so I stay paused. Send `go` to trade until 2:00 PM CT (the last entry), or nothing.").length, 1);
  assert.ok((await r.store.getDay(D))!.phases[MIDDAY_NOTE_PHASE]);
  // the 2:55 close-out and the summary
  await r.at("20:55:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases.closeout));
  assert.equal(sim.config.maxMarginMultiplier, 1, "the 2:55 close-out puts the cap back to 1");
  assert.equal(r.said("trading").filter((t) => t === "Close-out done: the account is flat.").length, 1);
  await r.at("21:05:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases.summary));
  assert.equal(r.said("trading").filter((t) => t.startsWith("Mid-day close-out done")).length, 1, "posted once, never again after flat");
  const summary = r.said("trading").find((t) => t.includes("Daily summary"))!;
  assert.ok(summary.includes("Mid-day cycle: paused at") && summary.includes("stayed paused for the rest of the day"), summary.slice(-600));
  assert.ok(!summary.includes("Restarted at"), "no restart today");
});

test("the mid-day close-out keeps trying until flat (a retry is one round: it sends the sale, a later retry sees it filled), with one alert to Michael, and entries stay paused", async () => {
  const w = await armedDay();
  const { sim, r } = w;
  sim.advanceTo(z("16:00:00").getTime());
  await hold(sim, r.store, "AAA", 10, 50);
  sim.refuseSellsTimes = 1_000; // every sell refused for now
  await r.at("16:30:00");
  await until(() => r.said("alerts").some((t) => t.includes("mid-day close-out is NOT FLAT yet")));
  await r.at("16:30:30");
  await until(() => !r.worker["inflight"].has("midday"));
  assert.equal(r.said("alerts").filter((t) => t.includes("mid-day close-out is NOT FLAT yet")).length, 1, "one alert");
  assert.equal((await readPause(r.store, D))!.on, true);
  assert.equal((await r.store.getDay(D))!.phases[MIDDAY_PHASE], undefined, "not flat: no phase yet");
  sim.refuseSellsTimes = 0;
  for (let k = 0; k < 20 && !(await r.store.getDay(D))!.phases[MIDDAY_PHASE]; k++) {
    await r.at(new Date(Math.max(z("16:31:10").getTime(), sim.simMs) + 20_000 * k).toISOString());
    await until(() => !r.worker["inflight"].has("midday"));
  }
  assert.ok((await r.store.getDay(D))!.phases[MIDDAY_PHASE], "flat");
  assert.equal((await sim.listPositions()).length, 0);
  assert.equal(r.said("alerts").filter((t) => t.includes("mid-day close-out is NOT FLAT yet")).length, 1, "still one alert");
});

test("a half day (close 12:00 PM CT) runs the cycle at 10:30; its texts use the real last entry (11:00 AM CT), the automatic resume ends then, and no 1:30 note", async () => {
  assert.deepEqual(middayTimes({ isTradingDay: true, openAt: z("14:30:00"), closeAt: z("18:00:00") }), { pauseAt: z("16:30:00"), resumeUntil: z("17:00:00"), lastEntryAt: z("17:00:00") });
  assert.deepEqual(middayTimes({ isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00") }), { pauseAt: z("16:30:00"), resumeUntil: z("19:30:00"), lastEntryAt: z("20:00:00") });
  assert.equal(middayTimes({ isTradingDay: true, openAt: z("14:30:00"), closeAt: z("16:35:00") }), null, "10:30 already inside the close-out's last minutes");
  const w = await armedDay({ early: true });
  w.sim.advanceTo(z("16:00:00").getTime());
  await hold(w.sim, w.r.store, "AAA", 10, 50);
  await middayFlat(w);
  assert.equal((await w.sim.listPositions()).length, 0, "the cycle runs at 10:30 on a half day");
  const morning = w.r.said("commands").find((t) => t.startsWith("Morning (open to"))!;
  assert.ok(morning.includes("before 11:00 AM CT") && morning.includes("(last entry 11:00 AM CT)") && !morning.includes("2:00 PM") && !morning.includes("1:30 PM"), morning);
  // a plain restart after the last entry: the alert says no entries are left, without mentioning Michael
  const r2 = restart(w, { deploy: false, release: "SAMEREL9" });
  await r2.at("17:05:00");
  await r2.at("17:05:05");
  const alert = w.bot.posts.find((m) => m.channel === "alerts" && m.text.includes("I restarted during the mid-day pause"))!;
  assert.ok(alert.text.includes("No entries are left today (last entry 11:00 AM CT).") && !alert.text.includes("Send `go`"), alert.text);
  assert.equal(alert.mention, false, "no mention once no entries are left");
  await r2.at("17:06:00");
  assert.ok(!w.r.said("commands").some((t) => t.includes("nothing was deployed")), "no 1:30 note when there is no time left to trade");
  w.r.ownerSays("go", "17:06:10");
  await r2.at("17:06:15");
  assert.ok(w.r.said("commands").some((t) => t === "The mid-day pause is over, but no entries are left today (last entry 11:00 AM CT)."));
});

test("a half day: a deploy after the last entry stays paused and says no entries are left", async () => {
  const w = await armedDay({ early: true });
  await middayFlat(w);
  const r2 = restart(w, { deploy: true, release: "NEWREL10" });
  await r2.at("17:05:00");
  await r2.at("17:05:05");
  assert.equal((await readPause(w.r.store, D))!.on, true);
  assert.ok(r2.said("commands").some((t) => t.includes("but it is 11:00 AM CT or later, so I stay paused. No entries are left today (last entry 11:00 AM CT).")));
});

// ---------------- restarts ----------------

test("a deploy while flat and paused, before 1:30: nothing is sold at start-up, and trading resumes on its own with the same limits", async () => {
  const w = await armedDay();
  w.sim.advanceTo(z("16:00:00").getTime());
  await hold(w.sim, w.r.store, "AAA", 10, 50);
  await middayFlat(w);
  const sold = w.sim.sellLog.length;
  const r2 = restart(w, { deploy: true, release: "NEWREL01" });
  await r2.at("16:40:00");
  await r2.at("16:40:05");
  const p = (await readPause(w.r.store, D))!;
  assert.equal(p.on, false);
  assert.equal(p.resumedBy, "deploy");
  assert.ok(r2.said("commands").includes("Resumed after release NEWREL01 (deployed while flat): same limits as this morning; the loss stop counts from the open."));
  assert.equal(w.sim.sellLog.length, sold, "nothing sold at start-up");
  assert.equal((await w.r.store.getDay(D))!.phases.carried, undefined, "no carried-position sale");
  assert.equal(w.sim.config.maxMarginMultiplier, 2, "same cap");
  // the evening summary names the cycle and the restart
  await r2.at("20:55:00");
  await until(async () => Boolean((await w.r.store.getDay(D))!.phases.closeout));
  await r2.at("21:05:00");
  await until(async () => Boolean((await w.r.store.getDay(D))!.phases.summary));
  const summary = r2.said("trading").find((t) => t.includes("Daily summary"))!;
  assert.ok(summary.includes("resumed at") && summary.includes("(after a deploy)"), summary.slice(-500));
  assert.ok(summary.includes("Restarted at") && summary.includes("the request figures, the live-update figures and the entry-expiry counts cover only the time since"), summary.slice(-500));
});

test("a plain restart while flat and paused stays paused and says so", async () => {
  const w = await armedDay();
  await middayFlat(w);
  const r2 = restart(w, { deploy: false, release: "SAMEREL1" });
  await r2.at("16:40:00");
  await r2.at("16:40:05");
  assert.equal((await readPause(w.r.store, D))!.on, true);
  assert.ok(r2.said("alerts").some((t) => t.includes("I restarted during the mid-day pause without a new release, so I stay paused.")));
  // no start information at all (a failed start note) counts as a plain restart
  const r3 = restart(w, null);
  await r3.at("16:41:00");
  await r3.at("16:41:05");
  assert.equal((await readPause(w.r.store, D))!.on, true);
});

test("a deploy after 1:30, or with `hold` set, stays paused; `hold` sent while the worker was down counts", async () => {
  const late = await armedDay();
  await middayFlat(late);
  const r2 = restart(late, { deploy: true, release: "NEWREL02" });
  // its first loss check is slow, so its start-up decision comes a pass later; the 1:30 note must wait for that decision
  const history = late.sim.getEquityHistoryToday.bind(late.sim);
  let slowOnce = true;
  late.sim.getEquityHistoryToday = async () => {
    if (slowOnce) {
      slowOnce = false;
      await new Promise((res) => setTimeout(res, 30));
    }
    return history();
  };
  await r2.at("19:31:00");
  await new Promise((res) => setTimeout(res, 40));
  await r2.at("19:31:05");
  assert.equal((await readPause(late.r.store, D))!.on, true);
  assert.ok(r2.said("commands").some((t) => t.includes("it is 1:30 PM CT or later, so I stay paused")));
  assert.ok(!r2.said("commands").some((t) => t.includes("nothing was deployed")), "a deploy happened: no 'nothing was deployed' note");

  const held = await armedDay();
  await middayFlat(held);
  held.r.ownerSays("hold", "16:35:00"); // the old worker never reads it: the new one does at start
  const r3 = restart(held, { deploy: true, release: "NEWREL03" });
  await r3.at("16:40:00");
  await r3.at("16:40:05");
  assert.equal((await readPause(held.r.store, D))!.on, true);
  assert.equal(await readHold(held.r.store, D), true);
  assert.ok(r3.said("commands").some((t) => t.includes("`hold` is set, so I stay paused")));
});

test("the loss stop counts from the open after a restart: the morning's loss plus the afternoon's crosses the limit and the stop goes on", async () => {
  const w = await armedDay();
  const { sim, r } = w;
  const start = (await r.store.getDay(D))!.dayStartEquity;
  sim.advanceTo(z("16:00:00").getTime());
  await hold(sim, r.store, "AAA", 100, 50);
  sim.prices.set("AAA", 48.5); // the mid-day close-out sells at a 150 dollar loss (the limit is 200)
  await middayFlat(w);
  const r2 = restart(w, { deploy: true, release: "NEWREL04" });
  await r2.at("16:40:00");
  await r2.at("16:40:05");
  assert.equal((await readPause(r.store, D))!.on, false, "resumed");
  assert.equal((await r.store.getDay(D))!.dayStartEquity, start, "the day's start is unchanged by the restart");
  assert.ok(!(await r.store.getControl<{ on: boolean }>(CONTROL_STOP))?.on, "150 lost, not 200 yet");
  // an afternoon position loses 60 more
  sim.advanceTo(z("16:45:00").getTime());
  await hold(sim, r.store, "BBB", 100, 10, 2);
  sim.prices.set("BBB", 9.4);
  await r2.at("16:45:10");
  await r2.at("16:45:15");
  await until(async () => Boolean((await r.store.getControl<{ on: boolean; reason: string }>(CONTROL_STOP))?.on));
  const flag = (await r.store.getControl<{ on: boolean; reason: string }>(CONTROL_STOP))!;
  assert.equal(flag.on, true);
  assert.ok(flag.reason.startsWith("daily loss stop"), flag.reason);
});

test("a deploy while the daily loss stop is in force does not end the pause", async () => {
  const w = await armedDay();
  const { sim, r } = w;
  sim.advanceTo(z("16:00:00").getTime());
  await hold(sim, r.store, "AAA", 100, 50);
  await middayFlat(w);
  await r.store.setControl(CONTROL_STOP, { on: true, at: z("16:35:00").toISOString(), reason: "daily loss stop reached (test)" });
  const r2 = restart(w, { deploy: true, release: "NEWREL05" });
  await r2.at("16:40:00");
  await r2.at("16:40:05");
  assert.equal((await readPause(r.store, D))!.on, true);
  assert.ok(r2.said("commands").some((t) => t.includes("the daily loss stop is in force, so I stay paused. The daily loss stop is in force, so trading stays paused for the rest of the day unless you send `resume` and then `go`.")));
});

// ---------------- the commands ----------------

test("`go` and `hold`: parsed as one word only; every refusal of `go`; `go` resumes once flat; `hold` after a resume changes nothing", async () => {
  assert.deepEqual(parseCommand("go"), { kind: "go" });
  assert.deepEqual(parseCommand("HOLD"), { kind: "hold" });
  assert.equal(parseCommand("go long").kind, "unknown");
  assert.equal(parseCommand("hold on").kind, "unknown");

  const w = await armedDay();
  const { r } = w;
  w.r.ownerSays("go", "16:00:00");
  await r.at("16:00:05");
  assert.ok(r.said("commands").some((t) => t.includes("Not resumed: trading is not paused for the mid-day cycle.")));
  await middayFlat(w);
  w.r.ownerSays("stop", "16:35:00");
  await r.at("16:35:05");
  w.r.ownerSays("go", "16:35:10");
  await r.at("16:35:15");
  assert.ok(r.said("commands").some((t) => t.includes("Not resumed: the stop flag is on")));
  w.r.ownerSays("resume", "16:35:20");
  await r.at("16:35:25");
  w.r.ownerSays("go", "16:35:30");
  await r.at("16:35:35");
  const p = (await readPause(r.store, D))!;
  assert.equal(p.on, false);
  assert.equal(p.resumedBy, "go");
  assert.ok(r.said("commands").some((t) => t.startsWith("Resumed: the mid-day pause is over.")));
  w.r.ownerSays("go", "16:35:40");
  await r.at("16:35:45");
  assert.ok(r.said("commands").some((t) => t.includes("Not resumed: trading has already resumed today.")));
  w.r.ownerSays("hold", "16:35:50");
  await r.at("16:35:55");
  assert.ok(r.said("commands").some((t) => t.includes("Trading has already resumed today, so `hold` changes nothing.")));
  assert.equal((await readPause(r.store, D))!.on, false, "hold never re-pauses");
  w.r.ownerSays("status", "16:36:00");
  await r.at("16:36:05");
  assert.ok(r.said("commands").some((t) => t.includes("Mid-day cycle: resumed at")));
});

test("`go` refusals as a rule: no cycle today, not flat yet, the daily loss stop", () => {
  const on: MiddayPause = { ...emptyPause(), on: true, since: "x" };
  assert.equal(goRefusal({ hasCycle: false, pause: on, flat: true, stop: null }), "there is no mid-day cycle today");
  assert.equal(goRefusal({ hasCycle: true, pause: on, flat: false, stop: null }), "the mid-day close-out has not finished flat yet");
  assert.equal(goRefusal({ hasCycle: true, pause: on, flat: true, stop: { on: true, reason: "daily loss stop reached" } }), "the daily loss stop is in force");
  assert.equal(goRefusal({ hasCycle: true, pause: on, flat: true, stop: { on: false, reason: "" } }), null);
  const now = z("17:00:00");
  const until = z("19:30:00");
  const base = { pause: on, hold: false, flat: true, deploy: true, now, resumeUntil: until, stop: null, startedAfterPause: true };
  assert.equal(startupAction(base), "resume");
  assert.equal(startupAction({ ...base, flat: false }), "not-flat-yet");
  assert.equal(startupAction({ ...base, pause: null }), "none");
  assert.equal(startupAction({ ...base, now: until }), "stay-late");
  assert.equal(startupAction({ ...base, hold: true }), "stay-hold");
  assert.equal(startupAction({ ...base, stop: { on: true } }), "stay-stop");
  assert.equal(startupAction({ ...base, deploy: false }), "stay-plain-restart");
  assert.equal(startupAction({ ...base, startedAfterPause: false }), "none", "a start before the pause (an evening deploy) is not a mid-day start");
  const last = z("20:00:00");
  assert.equal(blockedNext({ stop: { on: true, reason: "daily loss stop reached" }, now, lastEntryAt: last }), "The daily loss stop is in force, so trading stays paused for the rest of the day unless you send `resume` and then `go`.");
  assert.equal(blockedNext({ stop: { on: true, reason: "owner command (stop)" }, now, lastEntryAt: last }), "The stop flag is on: send `resume`, then `go`.");
  assert.equal(blockedNext({ stop: null, now: last, lastEntryAt: last }), "No entries are left today (last entry 2:00 PM CT).");
  assert.equal(blockedNext({ stop: null, now, lastEntryAt: last }), null);
  assert.equal(retryAllowed({ room: 60, estimate: 50, governorBudget: 140, reserve: 80 }), true);
  assert.equal(retryAllowed({ room: 40, estimate: 50, governorBudget: 200, reserve: 80 }), false, "the minute's budget");
  assert.equal(retryAllowed({ room: 60, estimate: 50, governorBudget: 129, reserve: 80 }), false, "never below the reserve");
  const b = new MiddayBudget();
  b.spend(0, 45);
  assert.equal(b.room(59_999), 15);
  assert.equal(b.room(60_000), 60, "a minute later the spend has expired");
});

// ---------------- the gate ----------------

async function gateSetup() {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const now = z("15:30:00");
  const governor = new Governor(() => now.getTime());
  const view = new BrokerView(broker, () => now.getTime());
  const say = async () => true;
  const liquidator = new Liquidator({ broker, gate: new SellGate({ broker, say: say as any }), now: () => now, sleep: async () => undefined });
  await ensureDay({ broker, store, now: () => now, say: say as any, liquidator } as any, D);
  await store.updateDay(D, { status: "approved", decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z" } });
  const gate = new OrderGate({ broker, store, view, governor, now: () => now, say: say as any, note: () => undefined });
  const signal = (symbol = "AAA", price = 50): Signal => ({ symbol, price, tradeTime: new Date(now.getTime() - 5000), stopPrice: Math.round(price * 0.985 * 100) / 100, takeProfitPrice: Math.round(price * 1.0025 * 100) / 100 });
  return { store, broker, gate, signal };
}

test("the gate refuses every entry while paused, before any broker request; and sends again once the pause is off", async () => {
  const s = await gateSetup();
  await updatePause(s.store, D, { on: true, since: z("15:30:00").toISOString(), reason: "mid-day cycle" });
  const before = s.broker.calls.length;
  const r = await s.gate.enter(s.signal());
  assert.deepEqual(r, { status: "refused", reason: MIDDAY_PAUSED });
  assert.equal(s.broker.calls.length, before, "no request to Alpaca");
  await updatePause(s.store, D, { on: false, resumedAt: z("15:31:00").toISOString(), resumedBy: "go" });
  assert.equal((await s.gate.enter(s.signal())).status, "sent");
});

test("the gate looks at the pause again just before sending: a pause set in between cancels the entry", async () => {
  const s = await gateSetup();
  const orig = s.store.getControl.bind(s.store);
  let reads = 0;
  s.store.getControl = (async (key: string) => (key === middayKey(D) ? (reads++ === 0 ? null : { ...emptyPause(), on: true }) : orig(key))) as Store["getControl"];
  const r = await s.gate.enter(s.signal());
  assert.deepEqual(r, { status: "refused", reason: MIDDAY_PAUSED });
  assert.equal(s.broker.count("submitEntry"), 0, "nothing sent");
  const row = (await s.store.listOrders(D))[0]!;
  assert.equal(row.status, "canceled");
  assert.equal(row.note, "mid-day pause set before sending");
});

test("the caching store serves the pause like the stop flag: a write is seen at once", async () => {
  const inner = new MemoryStore();
  let t = 0;
  const store = new CachingStore(inner, () => t);
  assert.equal(await readPause(store, D), null);
  await updatePause(store, D, { on: true });
  assert.equal((await readPause(store, D))!.on, true);
  await inner.setControl(middayKey(D), { ...emptyPause(), on: false }); // a change made elsewhere shows after the short cache
  assert.equal((await readPause(store, D))!.on, true, "inside the short cache");
  t += 2_000;
  assert.equal((await readPause(store, D))!.on, false);
});

// ---------------- the start note and the deploy check ----------------

test("the start note tells a deploy (a new release) from a plain restart", async () => {
  const store = new MemoryStore();
  assert.equal((await recordStart(store, z("16:00:00"), "AAAA1111")).deploy, false, "first start on record");
  assert.equal((await recordStart(store, z("16:01:00"), "AAAA1111")).deploy, false, "same release again");
  const n = await recordStart(store, z("16:02:00"), "BBBB2222");
  assert.equal(n.deploy, true);
  assert.equal(n.release, "BBBB2222");
  const broken = new MemoryStore();
  broken.getControl = (async () => { throw new Error("down"); }) as Store["getControl"];
  assert.equal((await recordStart(broken, z("16:03:00"), "CCCC3333")).deploy, false, "history unreadable: never a deploy");
});

test("the deploy check refuses unless flat, paused, no positions or open orders, in the window, and on the reviewed commit", () => {
  const day = { isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), phases: { [MIDDAY_PHASE]: z("16:31:00").toISOString(), middayFlat: "yes" } };
  const ok: DeployFacts = { now: z("16:40:00"), day, pause: { ...emptyPause(), on: true }, positions: 0, openOrders: 0, afterOneThirtyAllowed: false, reviewedCommit: "abc1234", checkedOutCommit: "abc1234def5678", gitStatus: "" };
  assert.deepEqual(deployRefusals(ok), []);
  const has = (o: Partial<DeployFacts>, text: string) => assert.ok(deployRefusals({ ...ok, ...o }).some((r) => r.includes(text)), `${text}: ${deployRefusals({ ...ok, ...o }).join("; ")}`);
  has({ day: { ...day, phases: {} } }, "has not finished flat");
  has({ pause: { ...emptyPause(), on: false } }, "pause is not on");
  has({ positions: 1 }, "1 position");
  has({ openOrders: 2 }, "2 open order");
  has({ now: z("19:30:00") }, "1:30 PM CT or later");
  assert.deepEqual(deployRefusals({ ...ok, now: z("19:30:00"), afterOneThirtyAllowed: true }), [], "after 1:30 only with the flag");
  has({ now: z("16:20:00") }, "before the mid-day close-out");
  has({ now: z("21:10:00"), afterOneThirtyAllowed: true }, "market is closed");
  has({ reviewedCommit: null }, "--reviewed");
  has({ reviewedCommit: "fff9999" }, "not the reviewed commit");
  has({ reviewedCommit: "abc" }, "not the reviewed commit");
  has({ day: { ...day, closeAt: z("16:35:00") } }, "no mid-day cycle");
  has({ day: { ...day, closeAt: z("18:00:00") }, now: z("17:00:00") }, "11:00 AM CT or later");
  has({ day: null }, "no mid-day cycle");
  has({ gitStatus: " M src/worker.ts\n" }, "git status is not clean");
  has({ gitStatus: "?? stray.txt\n" }, "git status is not clean");
  has({ gitStatus: "git status failed" }, "git status is not clean");
});

test("the mid-day close-out's retries are 20 seconds apart, and none starts once the regular close-out time has come", async () => {
  const w = await armedDay();
  const { sim, r } = w;
  sim.advanceTo(z("16:00:00").getTime());
  await hold(sim, r.store, "AAA", 10, 50);
  sim.refuseSellsTimes = 100_000;
  const middayTries = () => r.store.events.filter((e) => e.event === "closeout_result" && e.data!.path === "midday").length;
  await r.at("16:30:00");
  await until(() => middayTries() === 1 && !r.worker["inflight"].has("midday"));
  assert.equal(middayTries(), 1);
  if (sim.simMs < z("16:30:19").getTime()) {
    await r.at("16:30:19");
    await until(() => !r.worker["inflight"].has("midday"));
    assert.equal(middayTries(), 1, "not before 20 seconds");
  }
  await r.at("16:30:21");
  await until(() => middayTries() === 2 && !r.worker["inflight"].has("midday"));
  assert.equal(middayTries(), 2, "again after 20 seconds");
  await r.at("20:55:00");
  await until(() => !r.worker["inflight"].has("midday") && !r.worker["inflight"].has("closeout"));
  assert.equal(middayTries(), 2, "from the regular close-out time on, only the regular close-out sells");
  assert.ok(r.store.events.some((e) => e.event === "closeout_result" && e.data!.path === "close-out"));
});

test("during the mid-day close-out's wait for its own sells, an order sync sells nothing more (no double sale)", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const events: string[] = [];
  let armed = false;
  let hooked = false;
  let r: ReturnType<typeof rig<SimBroker>>;
  const sleep = async (ms: number) => {
    await sim.sleep(ms);
    if (armed && !hooked && r.worker["inflight"].has("midday") && !r.worker["liquidator"].isLiquidating()) {
      hooked = true;
      await r.at("16:30:25"); // the order sync falls due while the mid-day close-out waits for its own sells
    }
  };
  r = rig<SimBroker>({ broker: sim, sleep, simClock: sim, log: (_l, e) => void events.push(e) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  sim.advanceTo(z("16:00:00").getTime());
  await hold(sim, r.store, "AAA", 10, 50);
  await hold(sim, r.store, "BBB", 20, 10);
  sim.sellFillDelayMs = 30_000;
  armed = true;
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]), 800);
  assert.equal(hooked, true, "the sync really fell inside the wait");
  assert.deepEqual(sim.sellLog.map((x) => [x.symbol, x.qty]).sort(), [["AAA", 10], ["BBB", 20]], "one sell per symbol, from the mid-day close-out alone");
  assert.equal(sim.oversellAttempts, 0);
  assert.ok(!events.includes("unprotected_position"), "the sync did not start a sale");
});

test("a deploy right after a morning loss past the limit: the loss stop's first check after the start comes first, so the pause stays", async () => {
  const w = await armedDay();
  const { sim, r } = w;
  sim.advanceTo(z("16:00:00").getTime());
  await hold(sim, r.store, "AAA", 100, 50);
  await r.at("16:29:58"); // the old worker's last loss check sees no loss
  sim.prices.set("AAA", 47); // a 300 dollar loss (the limit is 200), realised by the mid-day close-out's sale
  await r.at("16:30:00"); // the loss check is not due yet in this pass (5 second spacing)
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  assert.ok(!(await r.store.getControl<{ on: boolean }>(CONTROL_STOP))?.on, "the old worker never saw the loss");
  const r2 = restart(w, { deploy: true, release: "NEWREL06" });
  // The new worker's loss stop is slow to save its flag (a slow database write), so the start-up decision has to wait for the check.
  const setControl = r.store.setControl.bind(r.store);
  let slowOnce = true;
  r.store.setControl = (async (key: string, value: unknown) => {
    if (key === CONTROL_STOP && slowOnce) {
      slowOnce = false;
      await new Promise((res) => setTimeout(res, 30));
    }
    return setControl(key, value);
  }) as Store["setControl"];
  await r2.at("16:40:00");
  await r2.at("16:40:05");
  await new Promise((res) => setTimeout(res, 40));
  await r2.at("16:40:10");
  await r2.at("16:40:15");
  const flag = await r.store.getControl<{ on: boolean; reason: string }>(CONTROL_STOP);
  assert.ok(flag?.on && flag.reason.startsWith("daily loss stop"), "the new worker's first loss check fired");
  assert.equal((await readPause(r.store, D))!.on, true, "no resume ahead of the loss stop");
  assert.ok(!r2.said("commands").some((t) => t.startsWith("Resumed after release")));
});

test("the start-up decision waits for this start's first read of commands, so a `hold` sent while the worker was down is never missed", async () => {
  const w = await armedDay();
  await middayFlat(w);
  w.r.ownerSays("hold", "16:35:00");
  const r2 = restart(w, { deploy: true, release: "NEWREL07" });
  const bot = w.bot as any;
  const orig = bot.commandMessagesAfter.bind(bot);
  const origLatest = bot.latestCommandMessageId.bind(bot);
  bot.commandMessagesAfter = async () => { throw new Error("Discord down"); };
  bot.latestCommandMessageId = async () => { throw new Error("Discord down"); };
  await r2.at("16:40:00");
  await r2.at("16:40:05");
  await r2.at("16:40:10");
  assert.equal((await readPause(w.r.store, D))!.on, true, "commands unread: no decision yet");
  bot.commandMessagesAfter = orig;
  bot.latestCommandMessageId = origLatest;
  await r2.at("16:40:15");
  await r2.at("16:40:20");
  assert.equal((await readPause(w.r.store, D))!.on, true, "the hold was read first");
  assert.ok(r2.said("commands").some((t) => t.includes("`hold` is set, so I stay paused")));
});

test("closeOut on the mid-day path never touches the cap or posts 'Close-out done', even on its market-closed branch", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 22, 0));
  sim.clockOpen = false; // Alpaca's clock says closed
  sim.config = { ...sim.config, maxMarginMultiplier: 2 };
  const said: string[] = [];
  const say = async (_c: string, t: string) => (said.push(t), true);
  const liquidator = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: say as any, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep: sim.sleep });
  const res = await closeOut({ broker: sim, liquidator, store: new MemoryStore(), now: () => new Date(sim.simMs), say: say as any, sleep: sim.sleep }, D, { alert: false, path: "midday" });
  assert.deepEqual(res, { flat: true, remaining: [] });
  assert.equal(sim.config.maxMarginMultiplier, 2);
  assert.ok(!said.some((t) => t.includes("Close-out done")));
});

// ---------------- review round 1 ----------------

test("a retry takes at most 10 positions, in turn; and a retry over some positions counts as flat only when the whole account is flat", async () => {
  const pool = Array.from({ length: 25 }, (_, i) => `S${i}`);
  assert.equal(retrySymbols(pool.slice(0, 10), 0), null, "ten or fewer: a whole-account round");
  assert.deepEqual(retrySymbols(pool, 0), pool.slice(0, 10));
  assert.deepEqual(retrySymbols(pool, 1), pool.slice(10, 20));
  assert.deepEqual(retrySymbols(pool, 2), [...pool.slice(20, 25), ...pool.slice(0, 5)], "wraps around");
  assert.equal(retrySymbols(["(could not read positions)"], 0), null);
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 16, 0));
  sim.sellFillDelayMs = 0; // sales fill at once here, so the remaining list shows only what the retry did not sell
  const store = new MemoryStore();
  const said: string[] = [];
  const say = async (_c: string, t: string) => (said.push(t), true);
  const liquidator = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: say as any, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep: sim.sleep });
  await hold(sim, store, "AAA", 10, 50, 1);
  await hold(sim, store, "BBB", 10, 20, 2);
  const deps = { broker: sim, liquidator, store, now: () => new Date(sim.simMs), say: say as any, sleep: sim.sleep };
  const res = await closeOut(deps, D, { alert: false, path: "midday", maxRounds: 1, waitForOwnSells: false, onlySymbols: ["AAA"] });
  sim.advance(5_000);
  assert.equal(res.flat, false, "BBB is still held");
  assert.deepEqual(res.remaining, ["BBB"], "the whole account's remaining, not only the retry's symbols");
  assert.deepEqual(sim.sellLog.map((x) => x.symbol), ["AAA"], "only AAA was sold");
  assert.ok(sim.orders.some((o) => o.symbol === "BBB" && o.legs.some((l) => l.status === "new" || l.status === "held")), "BBB's exits were not touched");
});

test("Michael's ruling on a mid-day close-out that cannot get flat: 40 positions with every sale refused; after the unlimited first try, mid-day requests stay within 60 a minute, no rate-limit answers after the first try's minute, one alert and one 5 minute alert, and the positions are sold once Alpaca accepts", { timeout: 120_000 }, async () => {
  const w = await armedDay();
  const { sim, r } = w;
  sim.onRate = (remaining) => r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining, reset: null });
  sim.advanceTo(z("16:00:00").getTime());
  for (let i = 0; i < 40; i++) await hold(sim, r.store, `S${i}`, 1, 10);
  sim.refuseSellsTimes = 1_000_000;
  // count the requests made while a mid-day try is running (routine work running beside it is counted too: a conservative count)
  const reqDuring: number[] = [];
  const midday = () => r.worker["inflight"].has("midday");
  for (const fn of ["listPositions", "listOrders", "listOrdersPaged", "cancelOrder", "cancelAllOrders", "submitSell", "getAccount", "findOrderByClientId"] as const) {
    const orig = (sim as any)[fn].bind(sim);
    (sim as any)[fn] = (...a: unknown[]) => { if (midday()) reqDuring.push(sim.simMs); return orig(...a); };
  }
  const tries = () => r.store.events.filter((e) => e.event === "closeout_result" && e.data!.path === "midday").length;
  await r.at("16:30:00");
  await until(() => tries() === 1 && !midday(), 2000);
  const firstEnd = sim.simMs;
  const after = firstEnd + 60_000;
  let rejectedAtMinute: number | null = null;
  let t = Math.ceil(firstEnd / 5000) * 5000;
  const stopAt = z("16:40:00").getTime();
  while (t <= stopAt) {
    if (rejectedAtMinute === null && t >= after) rejectedAtMinute = sim.rejected429;
    await w.r.at(new Date(t).toISOString());
    await until(() => !midday(), 2000);
    t = Math.max(t + 5000, Math.ceil(sim.simMs / 5000) * 5000);
  }
  const retryReqs = reqDuring.filter((x) => x > firstEnd);
  let worst = 0;
  for (let i = 0; i < retryReqs.length; i++) worst = Math.max(worst, retryReqs.filter((x) => x >= retryReqs[i]! && x < retryReqs[i]! + 60_000).length);
  assert.ok(tries() >= 3, `retries happened (${tries()} tries)`);
  assert.ok(worst <= 60, `mid-day requests in any 60 seconds after the first try: ${worst}`);
  assert.equal(sim.rejected429, rejectedAtMinute, "no rate-limit answers after the first try's minute");
  assert.equal(r.said("alerts").filter((x) => x.includes("mid-day close-out is NOT FLAT yet")).length, 1, "one alert");
  assert.equal(r.said("alerts").filter((x) => x.includes("still NOT FLAT after 5 minutes")).length, 1, "one 5 minute alert");
  assert.equal((await readPause(r.store, D))!.on, true);
  assert.ok(!w.events.some((e) => e.e === "unprotected_position"), "the order sync's missing-exit check stood aside while the mid-day close-out owned the selling");
  // Alpaca accepts sales again
  sim.refuseSellsTimes = 0;
  for (let k = 0; k < 40 && !(await r.store.getDay(D))!.phases[MIDDAY_PHASE]; k++) {
    t += 5000;
    await r.at(new Date(t).toISOString());
    await until(() => !midday(), 2000);
  }
  assert.ok((await r.store.getDay(D))!.phases[MIDDAY_PHASE], "flat in the end");
  assert.equal((await sim.listPositions()).length, 0);
  assert.equal(sim.oversellAttempts, 0);
  assert.equal(r.said("alerts").filter((x) => x.includes("still NOT FLAT after 5 minutes")).length, 1, "still one 5 minute alert");
});

test("the loss stop on: the morning line and the 1:30 note say trading stays paused for the rest of the day unless `resume` and then `go`", async () => {
  const w = await armedDay();
  const { r } = w;
  await r.store.setControl(CONTROL_STOP, { on: true, at: z("16:00:00").toISOString(), reason: "daily loss stop reached (test)" });
  await middayFlat(w);
  const text = "The daily loss stop is in force, so trading stays paused for the rest of the day unless you send `resume` and then `go`.";
  const morning = r.said("commands").find((t) => t.startsWith("Morning (open to 10:30 AM CT):"))!;
  assert.ok(morning.endsWith(text) && !morning.includes("unless you send `hold`"), morning);
  await r.at("19:30:00");
  await r.at("19:30:05");
  assert.ok(r.said("commands").includes(`1:30 PM CT: nothing was deployed, so I stay paused. ${text}`), r.said("commands").slice(-2).join(" | "));
});

test("`hold` lives in its own key: sent before 10:30 it survives the pause's own writes, and its reply does not offer `go` to trade", async () => {
  const w = await armedDay();
  const { r } = w;
  w.r.ownerSays("hold", "16:00:00");
  await r.at("16:00:05");
  assert.ok(r.said("commands").includes("Hold: after today's mid-day deploy I will stay paused until you send `go`."));
  assert.ok((await r.store.getControl(middayHoldKey(D))) !== null);
  await middayFlat(w);
  assert.equal(await readHold(r.store, D), true, "the pause's write did not overwrite it");
  assert.ok(r.said("commands").find((t) => t.startsWith("Morning (open to"))!.includes("`hold` is set"));
  w.r.ownerSays("status", "16:36:00");
  await r.at("16:36:05");
  assert.ok(r.said("commands").some((t) => t.includes("Mid-day cycle: entries paused since 10:30 AM CT (flat); `hold` is set")));
});

test("a process that started before the pause (an earlier deploy) does not count as a mid-day deploy, even if its start-up decision comes late", async () => {
  const w = await armedDay();
  const { r } = w;
  // this worker started on the evening before, as a new release; its start-up decision is held back until after the pause because
  // its commands cannot be read
  r.worker.setStartInfo({ deploy: true, release: "EVENING1" });
  r.worker["middayStartupDone"] = false;
  const bot = w.bot as any;
  const orig = bot.commandMessagesAfter.bind(bot);
  const origLatest = bot.latestCommandMessageId.bind(bot);
  bot.commandMessagesAfter = async () => { throw new Error("Discord down"); };
  bot.latestCommandMessageId = async () => { throw new Error("Discord down"); };
  r.worker["lastCommandReadOk"] = null;
  await middayFlat(w);
  bot.commandMessagesAfter = orig;
  bot.latestCommandMessageId = origLatest;
  await r.at("16:40:00");
  await r.at("16:40:05");
  assert.equal((await readPause(r.store, D))!.on, true, "no automatic resume");
  assert.ok(!r.said("commands").some((t) => t.startsWith("Resumed after release")));
});

test("`hold` with the stop flag on says what will really happen", async () => {
  const w = await armedDay();
  const { r } = w;
  w.r.ownerSays("stop", "16:00:00");
  await r.at("16:00:05");
  w.r.ownerSays("hold", "16:00:10");
  await r.at("16:00:15");
  assert.ok(r.said("commands").includes("Hold noted. The stop flag is on: send `resume`, then `go`."), r.said("commands").slice(-2).join(" | "));
});

test("a retry does not wait for its own sale to fill (the next retry looks again), so it stays a short burst", async () => {
  const w = await armedDay();
  const { sim, r } = w;
  sim.advanceTo(z("16:00:00").getTime());
  await hold(sim, r.store, "AAA", 10, 50);
  sim.refuseSellsTimes = 1_000;
  await r.at("16:30:00");
  await until(() => !r.worker["inflight"].has("midday") && r.store.events.some((e) => e.event === "closeout_result"));
  sim.refuseSellsTimes = 0;
  sim.sellFillDelayMs = 30_000; // Alpaca holds the sale a while before filling it
  await r.at(new Date(Math.max(z("16:30:21").getTime(), sim.simMs + 21_000)).toISOString());
  await until(() => !r.worker["inflight"].has("midday"));
  const results = r.store.events.filter((e) => e.event === "closeout_result" && e.data!.path === "midday");
  assert.equal(results.length, 2);
  assert.equal(results[1]!.data!.waitedMs, 0, "the retry did not wait for its own sale");
  assert.equal(sim.sellLog.length, 1, "the sale was sent");
});
