// The `resume` reply (fix of 2026-11-11): it says what happens next, following the order gate's own checks. At 1:31 PM on
// 2026-11-11 it said "Entries still need the day's limits approved." on an approved, armed day, and entries restarted at once.
// Wording only: the stop flag is cleared the same way in every case.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig, z, D } from "./rig.ts";
import { FakeBot } from "./helpers.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP, type StopFlag } from "../src/store.ts";
import { MIDDAY_PHASE, readPause } from "../src/midday.ts";
import { LOAD_PHASE } from "../src/load-mode.ts";

async function armedDay() {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, bot });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  return { sim, r };
}

type W = Awaited<ReturnType<typeof armedDay>>;
const until = async (f: () => Promise<boolean>) => {
  for (let i = 0; i < 200 && !(await f()); i++) await new Promise((res) => setTimeout(res, 5));
};

// Sends `stop` then `resume` at the given time (UTC on the test day) and returns the resume reply; checks the flag was cleared.
async function stopThenResume(w: W, hhmm: string): Promise<string> {
  const t = z(`${hhmm}:00`).getTime();
  const iso = (ms: number) => new Date(ms).toISOString();
  w.r.ownerSays("stop", iso(t));
  await w.r.at(iso(t + 5_000));
  const before = w.r.said("commands").length;
  w.r.ownerSays("resume", iso(t + 10_000));
  await w.r.at(iso(t + 15_000));
  const flag = await w.r.store.getControl<StopFlag>(CONTROL_STOP);
  assert.equal(flag?.on, false, "resume clears the stop flag in every case");
  return w.r.said("commands").slice(before).find((x) => x.startsWith("Stop cleared"))!;
}

test("resume reply: the 1:31 PM case (approved, armed, after `go` ended the mid-day pause) says entries resume now", async () => {
  const w = await armedDay();
  await w.r.at("14:25:00");
  await w.r.at("14:30:05");
  await w.r.at("16:30:00");
  await until(async () => Boolean((await w.r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  w.r.ownerSays("go", "16:35:00");
  await w.r.at("16:35:05");
  assert.equal((await readPause(w.r.store, D))!.on, false);
  assert.equal(await stopThenResume(w, "19:31"), "Stop cleared. Entries resume now under today's approved limits.");
});

test("resume reply: during the mid-day pause it says entries wait for `go`", async () => {
  const w = await armedDay();
  await w.r.at("14:25:00");
  await w.r.at("14:30:05");
  await w.r.at("16:30:00");
  await until(async () => Boolean((await w.r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  assert.equal(await stopThenResume(w, "16:40"), "Stop cleared. Today's limits are approved, but entries stay paused for the mid-day cycle until you send `go`.");
});

test("resume reply: an armed morning before the pause says entries resume now; past the last entry it says none are left", async () => {
  const w = await armedDay();
  await w.r.at("14:25:00");
  await w.r.at("14:30:05");
  assert.equal(await stopThenResume(w, "15:00"), "Stop cleared. Entries resume now under today's approved limits.");
  const w2 = await armedDay();
  await w2.r.at("14:25:00");
  await w2.r.at("14:30:05");
  await w2.r.store.updateDay(D, { phases: { ...(await w2.r.store.getDay(D))!.phases, [MIDDAY_PHASE]: z("16:31:00").toISOString() } });
  const reply = await stopThenResume(w2, "20:05");
  assert.ok(reply.startsWith("Stop cleared. Today's last entry time (2:00 PM CT) has passed"), reply);
});

test("resume reply: the not-flat flag blocks entries, and the reply says so", async () => {
  const w = await armedDay();
  await w.r.at("14:25:00");
  await w.r.at("14:30:05");
  await w.r.store.setControl(CONTROL_NOT_FLAT, { on: true, since: z("14:30:00").toISOString(), remaining: ["XYZ"] });
  assert.equal(await stopThenResume(w, "15:00"), "Stop cleared, but the account was not flat after the last close-out, so there are no entries until those positions are sold.");
});

test("resume reply: before the open (normal day and load day), and while the cap is being set again (re-arm)", async () => {
  const w = await armedDay();
  assert.equal(await stopThenResume(w, "13:00"), "Stop cleared. Today's limits are approved, so entries can start at the open.");

  const l = await armedDay();
  await l.r.store.updateDay(D, { phases: { ...(await l.r.store.getDay(D))!.phases, [LOAD_PHASE]: "on" } });
  assert.equal(await stopThenResume(l, "13:00"), "Stop cleared. Today's limits are approved; it is a load day, so entries start at 8:45 AM CT.");

  const a = await armedDay();
  await a.r.at("14:25:00");
  await a.r.at("14:30:05");
  a.r.ownerSays("stop", z("14:40:00").toISOString());
  await a.r.at("14:40:05");
  // The cap was changed after arming: `armed` is removed and `rearm` set, just before `resume` is read (commands come first in a pass).
  const phases = { ...(await a.r.store.getDay(D))!.phases };
  delete phases.armed;
  phases.rearm = z("14:40:06").toISOString();
  await a.r.store.updateDay(D, { phases });
  const before = a.r.said("commands").length;
  a.r.ownerSays("resume", z("14:40:07").toISOString());
  await a.r.at("14:40:08");
  const rr = a.r.said("commands").slice(before).find((x) => x.startsWith("Stop cleared"))!;
  assert.ok(rr.startsWith("Stop cleared. The borrowing cap is being set again at Alpaca"), rr);
});

test("resume reply: a load day after the open but before its window says when entries start", async () => {
  const w = await armedDay();
  await w.r.store.updateDay(D, { phases: { ...(await w.r.store.getDay(D))!.phases, [LOAD_PHASE]: "on" } });
  await w.r.at("14:25:00");
  await w.r.at("14:30:05");
  assert.equal(await stopThenResume(w, "14:35"), "Stop cleared. It is a load day, so entries start at 8:45 AM CT.");
});

test("resume reply: a day whose limits are not approved says they still need approval", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, bot: new FakeBot() });
  await r.at("2026-11-01T22:10:00Z");
  await r.at("14:25:00");
  const reply = await stopThenResume({ sim, r }, "14:35");
  assert.equal(reply, "Stop cleared. Entries still need the day's limits approved.");
});
