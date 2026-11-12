// Release of 2026-11-12, part C: the afternoon load window's round 3 fixes (builds/c2-proposal-2026-11-12.md, part C; Michael's
// answers of 2026-11-11, night), then switched on. Each test fails without its fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";
import { CONTROL_STOP } from "../src/store.ts";
import { LOAD_AFTERNOON_PHASE } from "../src/load-mode.ts";
import { MIDDAY_PHASE, readPause, updatePause } from "../src/midday.ts";
import { SCREEN_CANCELLED, SCREEN_CANCELLED_SWITCHED, SCREEN_STILL_FINISHING, afternoonFailureTail, screenCancelledLine } from "../src/commands.ts";

const until = async (cond: () => boolean | Promise<boolean>, n = 400) => {
  for (let i = 0; i < n && !(await cond()); i++) await settle();
};

async function flatAtMidday(opts: { off?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const events: Array<{ e: string; d: any }> = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, log: (_l, e, d) => void events.push({ e, d }), loadAfternoon: !opts.off });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("trades 20\nposition 300\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("13:45:00");
  await r.at("14:25:00");
  await r.at("14:30:05");
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  return { sim, r, events };
}

type Rel = (v: { symbols: string[]; names: Record<string, string> }) => void;
function slowScreen(r: any): { release: Rel } {
  const h = { release: (() => undefined) as Rel };
  r.worker.d.buildLiveList = () => new Promise((res) => (h.release = res));
  return h;
}

// Holds the screen's first write of the new live list open until `release` is called (the reviewers' probes G and H).
function holdListWrite(r: any): { release: () => void; reached: () => boolean; writes: string[][] } {
  const real = r.store.updateDay.bind(r.store);
  let gate: () => void = () => undefined;
  let reached = false;
  const writes: string[][] = [];
  r.store.updateDay = async (date: string, patch: any) => {
    if (patch.liveList) {
      writes.push([...patch.liveList]);
      if (writes.length === 1) {
        reached = true;
        await new Promise<void>((res) => (gate = res));
      }
    }
    return real(date, patch);
  };
  return { release: () => gate(), reached: () => reached, writes };
}

for (const cmd of ["go", "stop"] as const) {
  test(`fix 1 (probe ${cmd === "go" ? "G" : "H"}): a \`${cmd}\` handled while the new list is being written wins: the old list is written back; the strategy, the feed and the post are unchanged`, async () => {
    const { r } = await flatAtMidday();
    (r.worker as any).d.buildLiveList = async () => ({ symbols: ["CHP1", "CHP2"], names: { CHP1: "Cheap" } });
    const h = holdListWrite(r);
    const before = r.counts();
    const strategyBefore = (r.worker as any).strategy;
    r.ownerSays("load afternoon", "16:40:00");
    await r.at("16:40:05");
    await until(() => h.reached());
    assert.ok(h.reached(), "the screen is inside its write");
    r.ownerSays(cmd, "16:40:10");
    await r.at("16:40:15");
    assert.ok(r.said("commands").some((t) => t.includes(SCREEN_CANCELLED)), "the command says the window is cancelled");
    h.release();
    await settle();
    await r.at("16:40:20");
    await r.at("16:40:25");
    assert.deepEqual((await r.store.getDay(D))!.liveList, ["AAA", "BBB"], "the old list was written back");
    assert.deepEqual(h.writes, [["CHP1", "CHP2"], ["AAA", "BBB"]], "the new list, then the old one again");
    assert.equal((r.worker as any).strategy, strategyBefore, "the strategy was not switched");
    assert.deepEqual({ ...r.counts(), screens: before.screens }, before, "the price feed was not switched");
    assert.ok(!r.said("trading").some((t) => t.startsWith("Live list switched")), "no switch post");
    assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined, "no window");
    assert.ok(!r.said("commands").some((t) => t.startsWith("Afternoon load window")), "nothing more is said after the cancel");
  });
}

test("fix 1 and fix 4: the pause ended by something other than a command during the writes: the old list goes back and the reply says trading has already resumed", async () => {
  const { r } = await flatAtMidday();
  (r.worker as any).d.buildLiveList = async () => ({ symbols: ["CHP1"], names: {} });
  const h = holdListWrite(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await until(() => h.reached());
  await updatePause(r.store, D, { on: false, resumedAt: z("16:40:06").toISOString(), resumedBy: "deploy" });
  h.release();
  await until(() => r.said("commands").some((t) => t.startsWith("Afternoon load window not started")));
  const line = r.said("commands").find((t) => t.startsWith("Afternoon load window not started"))!;
  assert.equal(line, "Afternoon load window not started: trading is no longer paused for the mid-day cycle, so the live list was not changed. Trading has already resumed.");
  assert.deepEqual((await r.store.getDay(D))!.liveList, ["AAA", "BBB"]);
  assert.ok(!r.said("trading").some((t) => t.startsWith("Live list switched")));
});

test("fix 2: `load afternoon` sent while a cancelled screen is still finishing asks Michael to send it again, and starts nothing", async () => {
  const { r } = await flatAtMidday();
  const h = slowScreen(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  r.ownerSays("stop", "16:40:10");
  await r.at("16:40:15");
  r.ownerSays("resume", "16:40:20");
  await r.at("16:40:25");
  const screens = r.counts().screens;
  r.ownerSays("load afternoon", "16:40:30");
  await r.at("16:40:35");
  assert.ok(r.said("commands").includes(SCREEN_STILL_FINISHING), r.said("commands").join(" | "));
  assert.equal(SCREEN_STILL_FINISHING, "The earlier screen is still finishing. Send `load afternoon` again in a minute or two.");
  assert.ok(!r.said("commands").some((t) => t === "Not started yet: the cheap-symbol screen for the afternoon load window is already running."));
  assert.equal(r.counts().screens, screens, "no second screen");
  h.release({ symbols: ["CHP1"], names: {} });
  await settle();
  await r.at("16:40:45");
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined);
  assert.equal((await readPause(r.store, D))!.on, true);
  // A live (not cancelled) screen still gets "already running".
  const w = await flatAtMidday();
  slowScreen(w.r);
  w.r.ownerSays("load afternoon", "16:40:00");
  await w.r.at("16:40:05");
  w.r.ownerSays("load afternoon", "16:40:10");
  await w.r.at("16:40:15");
  assert.ok(w.r.said("commands").some((t) => t === "Not started yet: the cheap-symbol screen for the afternoon load window is already running."));
});

for (const cmd of ["stop", "flatten"] as const) {
  test(`fix 3: \`${cmd}\` cancels the pending window before it saves the stop flag, and its reply keeps the cancel line`, async () => {
    const { r } = await flatAtMidday();
    slowScreen(r);
    r.ownerSays("load afternoon", "16:40:00");
    await r.at("16:40:05");
    const order: string[] = [];
    const deps = (r.worker as any).commands.d;
    const realCancel = deps.cancelAfternoonScreen;
    deps.cancelAfternoonScreen = (d: string) => (order.push("cancel"), realCancel(d));
    const realSet = r.store.setControl.bind(r.store);
    r.store.setControl = async (k: string, v: any) => (k === CONTROL_STOP && v?.on && order.push("stop saved"), realSet(k, v));
    r.ownerSays(cmd, "16:40:10");
    await r.at("16:40:15");
    await until(() => r.said("commands").some((t) => t.includes(SCREEN_CANCELLED)));
    assert.deepEqual(order.slice(0, 2), ["cancel", "stop saved"]);
    assert.ok(r.said("commands").some((t) => t.includes(SCREEN_CANCELLED)));
  });
}

test("fix 4 (group 2 rounds 1 and 2 of 2026-11-12): every branch of the failure's closing sentence, never repeating the line", () => {
  const loss = { on: true, at: "x", reason: "daily loss stop reached (510.00 dollars)" };
  const plain = { on: true, at: "x", reason: "owner command (stop)" };
  const paused = { on: true } as any;
  const over = { on: false, resumedAt: "x", resumedBy: "deploy" } as any;
  // The daily loss stop: no `resume` advice, whatever the pause.
  assert.equal(afternoonFailureTail(loss, paused), "The daily loss stop is in force, so there is no more trading today.");
  assert.equal(afternoonFailureTail(loss, over, "the daily loss stop is in force"), "There is no more trading today.");
  assert.equal(afternoonFailureTail(loss, undefined), "The daily loss stop is in force, so there is no more trading today.");
  // The pause unknown (not readable, or no record).
  assert.equal(afternoonFailureTail(null, undefined, "trading is no longer paused for the mid-day cycle"), "Send `status` to see what is allowed now.");
  assert.equal(afternoonFailureTail(plain, null), "Send `status` to see what is allowed now.");
  // Past the last entry.
  assert.equal(afternoonFailureTail(plain, paused, "it is 1:30 PM CT or later", true), "No entries are left today.");
  assert.equal(afternoonFailureTail(null, paused, "", true), "No entries are left today.");
  // A plain stop: still paused, `resume` then `go`; the pause over, `resume` alone.
  assert.equal(afternoonFailureTail(plain, paused), "The stop flag is on: send `resume`, then `go`, for a normal afternoon.");
  assert.equal(afternoonFailureTail(plain, paused, "the stop flag is on, so the live list was not changed"), "Send `resume`, then `go`, for a normal afternoon.");
  assert.equal(afternoonFailureTail(plain, over, "trading has already resumed today"), "The stop flag is on: send `resume` to trade a normal afternoon.");
  assert.equal(afternoonFailureTail(plain, over, "the stop flag is on, so the live list was not changed"), "Send `resume` to trade a normal afternoon.");
  // The pause over, no stop.
  assert.equal(afternoonFailureTail(null, over), "Trading has already resumed.");
  assert.equal(afternoonFailureTail(null, over, "trading has already resumed today"), "", "not said twice");
  // Still paused, no stop.
  assert.equal(afternoonFailureTail(null, paused, "the cheap-symbol screen found no names"), "Still paused; `go` resumes a normal afternoon.");
});

test("fix 4: the daily loss stop set while the screen runs: the line says there is no more trading today (no `resume`)", async () => {
  const { r } = await flatAtMidday();
  const h = slowScreen(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.store.setControl(CONTROL_STOP, { on: true, at: z("16:40:06").toISOString(), reason: "daily loss stop reached (510.00 dollars)" });
  h.release({ symbols: ["CHP1"], names: {} });
  await until(() => r.said("commands").some((t) => t.startsWith("Afternoon load window not started")));
  const line = r.said("commands").find((t) => t.startsWith("Afternoon load window not started"))!;
  assert.equal(line, "Afternoon load window not started: the stop flag is on, so the live list was not changed. The daily loss stop is in force, so there is no more trading today.");
  assert.ok(!line.includes("`resume`"));
});

test("fix 4: a plain stop flag (not the loss stop) set while the screen runs: the line says to send `resume`, then `go`, once", async () => {
  const { r } = await flatAtMidday();
  const h = slowScreen(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.store.setControl(CONTROL_STOP, { on: true, at: z("16:40:06").toISOString(), reason: "owner command (stop)" });
  h.release({ symbols: ["CHP1"], names: {} });
  await until(() => r.said("commands").some((t) => t.startsWith("Afternoon load window not started")));
  const line = r.said("commands").find((t) => t.startsWith("Afternoon load window not started"))!;
  assert.equal(line, "Afternoon load window not started: the stop flag is on, so the live list was not changed. Send `resume`, then `go`, for a normal afternoon.");
  assert.equal(line.split("stop flag is on").length, 2, "said once");
});

test("fix 4: the daily loss stop set after the screen finished: the decision's refusal does not contradict itself", async () => {
  const { r } = await flatAtMidday();
  const h = slowScreen(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  h.release({ symbols: ["CHP1"], names: {} });
  await until(() => r.said("trading").some((t) => t.startsWith("Live list switched")));
  await r.store.setControl(CONTROL_STOP, { on: true, at: z("16:40:07").toISOString(), reason: "daily loss stop reached (510.00 dollars)" });
  await r.at("16:40:10");
  const line = r.said("commands").find((t) => t.startsWith("Afternoon load window not started"))!;
  assert.equal(line, "Afternoon load window not started: the daily loss stop is in force. The live list was switched to the cheap names while paused. There is no more trading today.");
});

test("group 2 round 1: the refusal does not say 'trading has already resumed' twice", async () => {
  const { r } = await flatAtMidday();
  const h = slowScreen(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  h.release({ symbols: ["CHP1"], names: {} });
  await until(() => r.said("trading").some((t) => t.startsWith("Live list switched")));
  await updatePause(r.store, D, { on: false, resumedAt: z("16:40:07").toISOString(), resumedBy: "deploy" });
  await r.at("16:40:10");
  const line = r.said("commands").find((t) => t.startsWith("Afternoon load window not started"))!;
  assert.equal(line, "Afternoon load window not started: trading has already resumed today. The live list was switched to the cheap names while paused; any trading on them uses today's normal limits (not the window's).");
});

test("group 2 rounds 1 and 2: every branch of the cancel line's next step, chosen by the command and its result", async () => {
  // Night release (ruling E): `load afternoon` is accepted with Michael's own stop on, so the advice changed.
  const PAUSE_OVER = "Trading has resumed normally. To start the window instead, send `stop` (or `flatten`), then `load afternoon` once flat (accepted until 1:30 PM CT, or the last entry if earlier).";
  const TRY_AGAIN = "To try again, send `load afternoon` again once the account is flat (accepted until 1:30 PM CT, or the last entry if earlier).";
  const TOO_LATE = "`load afternoon` is no longer accepted today (its time has passed).";
  const LOSS = "The daily loss stop is in force, so there is no more trading today.";
  // `go` that resumed (also after the last entry: still true).
  assert.equal(screenCancelledLine(true, "go-resumed", { lossStop: false }), `${SCREEN_CANCELLED} ${PAUSE_OVER}`);
  // `go` refused: the loss stop (named once), the pause over (both refusal texts), a plain stop (in time and too late), anything else.
  assert.equal(screenCancelledLine(true, "go-refused", { lossStop: true, why: "the daily loss stop is in force" }), `${SCREEN_CANCELLED} There is no more trading today.`);
  assert.equal(screenCancelledLine(true, "go-refused", { lossStop: false, why: "trading has already resumed today" }), `${SCREEN_CANCELLED} ${PAUSE_OVER}`);
  assert.equal(screenCancelledLine(true, "go-refused", { lossStop: false, why: "trading is not paused for the mid-day cycle" }), `${SCREEN_CANCELLED} ${PAUSE_OVER}`);
  assert.equal(screenCancelledLine("switched", "go-refused", { lossStop: false, why: "the stop flag is on (send `resume` first if you want trading)" }), `${SCREEN_CANCELLED_SWITCHED} ${TRY_AGAIN}`);
  assert.equal(screenCancelledLine(true, "go-refused", { lossStop: false, why: "the stop flag is on (send `resume` first if you want trading)", tooLate: true }), `${SCREEN_CANCELLED} ${TOO_LATE}`);
  assert.equal(screenCancelledLine(true, "go-refused", { lossStop: false, why: "the mid-day close-out has not finished flat yet" }), `${SCREEN_CANCELLED} Send \`status\` to see what is allowed now.`);
  // `stop` or `flatten`: the loss stop, in time, too late.
  assert.equal(screenCancelledLine(true, "stop", { lossStop: true }), `${SCREEN_CANCELLED} ${LOSS}`);
  assert.equal(screenCancelledLine("switched", "stop", { lossStop: false }), `${SCREEN_CANCELLED_SWITCHED} ${TRY_AGAIN}`);
  assert.equal(screenCancelledLine(true, "stop", { lossStop: false, tooLate: true }), `${SCREEN_CANCELLED} ${TOO_LATE}`);
  // Never the advice to send it again.
  for (const after of ["go-resumed", "go-refused", "stop"] as const)
    for (const why of ["", "trading has already resumed today", "the stop flag is on", "the daily loss stop is in force", "x"])
      for (const lossStop of [false, true]) assert.ok(!screenCancelledLine(true, after, { lossStop, why }).includes("again if you want it"));

  const run = async (setup: (r: any) => Promise<unknown>, cmd: string) => {
    const w = await flatAtMidday();
    slowScreen(w.r);
    w.r.ownerSays("load afternoon", "16:40:00");
    await w.r.at("16:40:05");
    await setup(w.r);
    w.r.ownerSays(cmd, "16:40:10");
    await w.r.at("16:40:15");
    return w.r.said("commands").join(" | ");
  };
  const none = async () => undefined;
  // In the worker: a `go` that resumes.
  assert.ok((await run(none, "go")).includes(`${SCREEN_CANCELLED} ${PAUSE_OVER}`));
  // A `go` refused because the pause already ended (the automatic resume after a mid-day deploy).
  const resumed = await run((r) => updatePause(r.store, D, { on: false, resumedAt: z("16:40:06").toISOString(), resumedBy: "deploy" }), "go");
  assert.ok(resumed.includes("Not resumed: trading has already resumed today.") && resumed.includes(`${SCREEN_CANCELLED} ${PAUSE_OVER}`), resumed);
  // A `go` refused for a plain stop flag.
  const plain = await run((r) => r.store.setControl(CONTROL_STOP, { on: true, at: z("16:40:06").toISOString(), reason: "owner command (stop)" }), "go");
  assert.ok(plain.includes("Not resumed: the stop flag is on") && plain.includes(`${SCREEN_CANCELLED} ${TRY_AGAIN}`), plain);
  // A `go` refused for the daily loss stop: said once.
  const loss = await run((r) => r.store.setControl(CONTROL_STOP, { on: true, at: z("16:40:06").toISOString(), reason: "daily loss stop reached (510.00 dollars)" }), "go");
  assert.ok(loss.includes("Not resumed: the daily loss stop is in force.") && loss.includes(`${SCREEN_CANCELLED} There is no more trading today.`), loss);
  assert.equal(loss.split("daily loss stop is in force").length, 2, "the loss stop named once");
  // `stop` and `flatten`.
  assert.ok((await run(none, "stop")).includes(`${SCREEN_CANCELLED} ${TRY_AGAIN}`));
  assert.ok((await run(none, "flatten")).includes(`${SCREEN_CANCELLED} ${TRY_AGAIN}`));
});

test("group 2 round 2: a `stop` after 1:30 PM CT with a screen still pending says `load afternoon` is no longer accepted today", async () => {
  const { r } = await flatAtMidday();
  slowScreen(r);
  r.ownerSays("load afternoon", "19:25:00");
  await r.at("19:25:05");
  r.ownerSays("stop", "19:31:00");
  await r.at("19:31:05");
  assert.ok(r.said("commands").some((t) => t.includes(`${SCREEN_CANCELLED} \`load afternoon\` is no longer accepted today (its time has passed).`)), r.said("commands").join(" | "));
});

test("group 2 round 2: a screen that fails after the last entry says no entries are left (not `go`)", async () => {
  const { r } = await flatAtMidday();
  let fail: (e: Error) => void = () => undefined;
  (r.worker as any).d.buildLiveList = () => new Promise((_res, rej) => (fail = rej));
  r.ownerSays("load afternoon", "19:25:00");
  await r.at("19:25:05");
  r.setNow("20:01:00");
  fail(new Error("the screen failed (test)"));
  await until(() => r.said("commands").some((t) => t.startsWith("Afternoon load window not started")));
  const line = r.said("commands").find((t) => t.startsWith("Afternoon load window not started"))!;
  assert.equal(line, "Afternoon load window not started: the screen failed (test). No entries are left today.");
});

test("group 2 round 1: `help` no longer says the window is cancelled 'for good'", async () => {
  const { r } = await flatAtMidday();
  r.ownerSays("help", "16:41:00");
  await r.at("16:41:05");
  const text = r.said("commands").find((t) => t.startsWith("**Commands**"))!;
  assert.ok(!text.includes("for good"));
  assert.ok(text.includes("after `stop` or `flatten` send `load afternoon` again, after a `go` first `stop` or `flatten`"));
});


test("fix 5: a command read that returns Discord's maximum of 50 messages does not decide the window; the next shorter read does", async () => {
  const { r } = await flatAtMidday();
  const h = slowScreen(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  h.release({ symbols: ["CHP1"], names: {} });
  await until(() => r.said("trading").some((t) => t.startsWith("Live list switched")));
  // 50 messages from someone else arrive (they are not commands, but the read is full, so more may be waiting).
  for (let i = 0; i < 50; i++) r.bot.say(`chatter ${i}`, z("16:40:06"), { authorId: "someone-else" });
  await r.at("16:40:10");
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined, "not decided after a full read");
  assert.equal((await readPause(r.store, D))!.on, true);
  await r.at("16:40:20");
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], z("16:40:20").toISOString(), "decided after a read of fewer than 50");
});

test("fix 6: finishAfternoonLoad changes nothing and says nothing unless `load afternoon` is switched on", async () => {
  const { r } = await flatAtMidday({ off: true });
  const before = r.said("commands").length;
  await (r.worker as any).commands.finishAfternoonLoad(D, { switched: true, list: ["CHP1"] });
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined);
  assert.equal((await readPause(r.store, D))!.on, true);
  assert.equal(r.said("commands").length, before);
  // Switched on, the same call starts the window (the conditions hold).
  const w = await flatAtMidday();
  await (w.r.worker as any).commands.finishAfternoonLoad(D, { switched: false, list: ["AAA", "BBB"] });
  assert.ok((await w.r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE]);
});

test("switched on: `help` shows the real `load afternoon` line, not the switched-off one", async () => {
  const { r } = await flatAtMidday();
  r.ownerSays("help", "16:41:00");
  await r.at("16:41:05");
  const help = r.said("commands").find((t) => t.startsWith("**Commands**"))!;
  assert.ok(help.includes("up to 150 orders a minute even above today's approved limit"));
  assert.ok(!help.includes("switched off in this release"));
});

// ---------------- group 1, round 1 of 2026-11-12 ----------------

// Makes the screen's write-back of the old list (the second live-list write) fail; the first write is held open until `release`.
function holdThenFailWriteBack(r: any): { release: () => void; reached: () => boolean; writes: string[][] } {
  const real = r.store.updateDay.bind(r.store);
  let gate: () => void = () => undefined;
  let reached = false;
  const writes: string[][] = [];
  r.store.updateDay = async (date: string, patch: any) => {
    if (patch.liveList) {
      writes.push([...patch.liveList]);
      if (writes.length === 1) {
        reached = true;
        await new Promise<void>((res) => (gate = res));
      } else throw new Error("database timeout (test)");
    }
    return real(date, patch);
  };
  return { release: () => gate(), reached: () => reached, writes };
}

const RESTORE_ALERT = "Send `status`; if its live list shows the cheap names, tell the builder before any restart or deploy.";

test("group 2 round 1, finding 3: the pause ended during the writes and the write-back failed: the line does not claim the list was not changed", async () => {
  const { r } = await flatAtMidday();
  (r.worker as any).d.buildLiveList = async () => ({ symbols: ["CHP1"], names: {} });
  const h = holdThenFailWriteBack(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await until(() => h.reached());
  await updatePause(r.store, D, { on: false, resumedAt: z("16:40:06").toISOString(), resumedBy: "deploy" });
  h.release();
  await until(() => r.said("commands").some((t) => t.startsWith("Afternoon load window not started")));
  const line = r.said("commands").find((t) => t.startsWith("Afternoon load window not started"))!;
  assert.equal(line, "Afternoon load window not started: trading is no longer paused for the mid-day cycle; the names trading are unchanged, but the stored live list could not be put back (see the alert in alerts). Trading has already resumed.");
  assert.ok(!line.includes("so the live list was not changed"));
  const alert = r.said("alerts").find((t) => t.includes(RESTORE_ALERT))!;
  assert.ok(alert && alert.includes("The names trading now are unchanged, but the stored live list may still be the cheap names, and a restart would trade them."), r.said("alerts").join(" | "));
});

test("group 1 round 1, scenario A: `go` during the list write, then the write-back fails: logged and an alert in `alerts` (although the window was cancelled)", async () => {
  const { r, events } = await flatAtMidday();
  (r.worker as any).d.buildLiveList = async () => ({ symbols: ["CHP1", "CHP2"], names: {} });
  const h = holdThenFailWriteBack(r);
  const strategyBefore = (r.worker as any).strategy;
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await until(() => h.reached());
  r.ownerSays("go", "16:40:10");
  await r.at("16:40:15");
  h.release();
  await until(() => r.said("alerts").some((t) => t.includes(RESTORE_ALERT)));
  assert.deepEqual(h.writes, [["CHP1", "CHP2"], ["AAA", "BBB"]], "the write-back was attempted once");
  const alert = r.said("alerts").find((t) => t.includes(RESTORE_ALERT))!;
  assert.ok(alert, r.said("alerts").join(" | "));
  assert.ok(alert.startsWith("Afternoon load window: I could not put the live list back after the window did not start (cancelled by a command)."), alert);
  assert.ok(events.some((x) => x.e === "load_afternoon_restore_failed"));
  assert.equal((r.worker as any).strategy, strategyBefore, "memory still trades the morning list");
  assert.ok(!r.said("trading").some((t) => t.startsWith("Live list switched")));
});

test("group 1 round 1, scenario B: a read failing after the list write: the old list is written back; if the write-back fails too, the alert", async () => {
  // B1: the stop read after the write fails; the write-back works.
  const { r, events } = await flatAtMidday();
  (r.worker as any).d.buildLiveList = async () => ({ symbols: ["CHP1"], names: {} });
  const realGet = r.store.getControl.bind(r.store);
  let wrote = false;
  const realUpd = r.store.updateDay.bind(r.store);
  r.store.updateDay = async (d: string, p: any) => (p.liveList && (wrote = true), realUpd(d, p));
  r.store.getControl = (async (k: string) => {
    if (wrote && k === CONTROL_STOP) throw new Error("db read timeout (test)");
    return realGet(k);
  }) as typeof r.store.getControl;
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await until(() => events.some((x) => x.e === "load_afternoon_list_restored"));
  r.store.getControl = realGet;
  assert.deepEqual((await r.store.getDay(D))!.liveList, ["AAA", "BBB"], "the old list was written back");
  assert.ok(events.some((x) => x.e === "load_afternoon_write_failed"));
  assert.ok(!r.said("alerts").some((t) => t.includes(RESTORE_ALERT)), "no alert when the write-back worked");
  assert.ok(!r.said("trading").some((t) => t.startsWith("Live list switched")));

  // B2: the pause read after the write fails, and the write-back fails too: the alert.
  const w = await flatAtMidday();
  (w.r.worker as any).d.buildLiveList = async () => ({ symbols: ["CHP1"], names: {} });
  let n = 0;
  const upd = w.r.store.updateDay.bind(w.r.store);
  w.r.store.updateDay = async (d: string, p: any) => {
    if (p.liveList && ++n === 2) throw new Error("database timeout (test)");
    return upd(d, p);
  };
  const get2 = w.r.store.getControl.bind(w.r.store);
  w.r.store.getControl = (async (k: string) => {
    if (n >= 1 && k.startsWith("midday_pause")) throw new Error("db read timeout (test)");
    return get2(k);
  }) as typeof w.r.store.getControl;
  w.r.ownerSays("load afternoon", "16:40:00");
  await w.r.at("16:40:05");
  await until(() => w.r.said("alerts").some((t) => t.includes(RESTORE_ALERT)));
  w.r.store.getControl = get2;
  assert.equal(n, 2, "the write-back was attempted once");
  assert.ok(w.r.said("alerts").some((t) => t.includes(RESTORE_ALERT)), w.r.said("alerts").join(" | "));
});

test("group 1 round 1 (wording): a `go` after the screen switched the list but before the window is decided says the cheap names stay live under today's normal limits", async () => {
  const { r } = await flatAtMidday();
  const h = slowScreen(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  h.release({ symbols: ["CHP1"], names: {} });
  await until(() => r.said("trading").some((t) => t.startsWith("Live list switched")));
  const post = r.said("trading").find((t) => t.startsWith("Live list switched"))!;
  assert.ok(post.includes("a `stop`, `flatten` or `go` before then cancels it, and these names stay live under today's normal limits"), post);
  r.ownerSays("go", "16:40:06");
  await r.at("16:40:07");
  assert.ok(r.said("commands").some((t) => t.includes(SCREEN_CANCELLED_SWITCHED)), r.said("commands").join(" | "));
  assert.ok(!r.said("commands").some((t) => t.includes(SCREEN_CANCELLED)), "not the 'screen had not finished' line");
  await r.at("16:40:15");
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined, "no window");
  assert.deepEqual((await r.store.getDay(D))!.liveList, ["CHP1"], "the cheap names stay, as the reply says");
});

test("group 1 round 1 (wording): a resend while a failed screen is still posting its failure gets the 'still finishing' line, which is true for a failure too", async () => {
  const { r } = await flatAtMidday();
  let fail: (e: Error) => void = () => undefined;
  (r.worker as any).d.buildLiveList = () => new Promise((_res, rej) => (fail = rej));
  // The failure line's post is held open, so the failed screen is still in flight when the resend arrives.
  const bot: any = r.bot;
  const realPost = bot.post.bind(bot);
  let holdPost: () => void = () => undefined;
  bot.post = async (ch: string, text: string, o?: unknown) => {
    if (text.startsWith("Afternoon load window not started")) await new Promise<void>((res) => (holdPost = res));
    return realPost(ch, text, o);
  };
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  fail(new Error("the screen failed (test)"));
  await settle();
  r.ownerSays("load afternoon", "16:40:10");
  await r.at("16:40:15");
  assert.ok(r.said("commands").includes(SCREEN_STILL_FINISHING), r.said("commands").join(" | "));
  holdPost();
  await settle();
});
