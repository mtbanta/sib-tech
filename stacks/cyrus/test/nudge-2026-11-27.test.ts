// Michael's request of 2026-11-27 (messaging only): a mention in commands at 7:45 and 8:15 AM Central while the day's limits are undecided.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureDay, NudgeTries, NUDGE_MAX_TRIES, postLimitsRequest, postMorningReview, postReminderIfNeeded, postUndecidedNudges, formatUndecidedNudge } from "../src/morning.ts";
import { MemoryStore } from "../src/store.ts";
import { FakeBroker } from "./helpers.ts";
import { readFileSync } from "node:fs";

const D = "2026-11-02"; // a Monday; the open is 8:30 AM Central (14:30Z)

function rig() {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const posts: Array<{ channel: string; text: string; mention: boolean }> = [];
  let ok = true;
  let now = new Date("2026-11-01T22:00:00Z");
  const steps = {
    store,
    broker,
    say: async (channel: any, text: string, opts?: { mentionOwner?: boolean }) => {
      if (!ok) return false;
      posts.push({ channel, text, mention: opts?.mentionOwner === true });
      return true;
    },
    now: () => now,
    feed: "iex",
  };
  return { store, posts, steps, set: (iso: string) => (now = new Date(iso)), fail: (v: boolean) => (ok = !v) };
}

// The limits flow for today, in the worker's order (limitsFlow): request, review, nudges, reminder.
async function flow(r: ReturnType<typeof rig>, tries: NudgeTries) {
  let day = (await r.store.getDay(D))!;
  day = await postLimitsRequest(r.steps, day);
  day = await postMorningReview(r.steps, day);
  day = await postUndecidedNudges(r.steps, day, tries);
  day = await postReminderIfNeeded(r.steps, day);
  return day;
}

const nudges = (r: ReturnType<typeof rig>) => r.posts.filter((p) => p.text.startsWith("**Michael: the limits for"));

test("undecided all morning: a mention at 7:45 and at 8:15 AM Central, once each, in commands; the 8:20 reminder unchanged", async () => {
  const r = rig();
  const tries = new NudgeTries();
  await ensureDay(r.steps, D);
  await flow(r, tries); // the evening request
  r.set("2026-11-02T13:44:59Z"); // 7:44:59 AM: too early
  await flow(r, tries);
  assert.equal(nudges(r).length, 0);
  r.set("2026-11-02T13:45:00Z"); // 7:45:00 AM
  await flow(r, tries);
  await flow(r, tries);
  assert.equal(nudges(r).length, 1);
  assert.equal(nudges(r)[0]!.channel, "commands");
  assert.equal(nudges(r)[0]!.mention, true);
  assert.ok(nudges(r)[0]!.text.includes("8:30 AM"), nudges(r)[0]!.text);
  r.set("2026-11-02T14:14:59Z");
  await flow(r, tries);
  assert.equal(nudges(r).length, 1);
  r.set("2026-11-02T14:15:00Z"); // 8:15:00 AM
  await flow(r, tries);
  await flow(r, tries);
  assert.equal(nudges(r).length, 2);
  assert.equal(nudges(r)[1]!.mention, true);
  r.set("2026-11-02T14:20:00Z"); // 8:20 AM: the existing reminder, no mention
  const day = await flow(r, tries);
  assert.ok(r.posts.at(-1)!.text.startsWith("**Reminder"));
  assert.equal(r.posts.at(-1)!.mention, false);
  assert.ok(day.phases.nudge745 && day.phases.nudge815 && day.phases.reminder);
  assert.equal(nudges(r).length, 2);
});

test("decided before 7:45: no mention; decided between them: only the first", async () => {
  const r = rig();
  const tries = new NudgeTries();
  await ensureDay(r.steps, D);
  await flow(r, tries);
  await r.store.updateDay(D, { status: "approved", decided: { position: true, loss: true, trades: true, cap: true } });
  for (const iso of ["2026-11-02T13:45:00Z", "2026-11-02T14:15:00Z", "2026-11-02T14:20:00Z"]) {
    r.set(iso);
    await flow(r, tries);
  }
  assert.equal(nudges(r).length, 0);

  const r2 = rig();
  const t2 = new NudgeTries();
  await ensureDay(r2.steps, D);
  await flow(r2, t2);
  r2.set("2026-11-02T13:50:00Z");
  await flow(r2, t2);
  await r2.store.updateDay(D, { status: "approved", decided: { position: true, loss: true, trades: true, cap: true } });
  r2.set("2026-11-02T14:15:00Z");
  await flow(r2, t2);
  assert.equal(nudges(r2).length, 1);
});

test("the mention names only the limits still waiting", async () => {
  const r = rig();
  await ensureDay(r.steps, D);
  const day = await r.store.updateDay(D, { decided: { position: true, loss: true } });
  const text = formatUndecidedNudge(day);
  assert.ok(text.includes("orders a minute (`trades`)") && text.includes("borrowing cap (`cap`)"), text);
  assert.ok(!text.includes("(`position`)") && !text.includes("(`loss`)"), text);
  assert.ok(text.includes("`approve`") && text.includes("`limits`"));
  assert.ok(!/[–—]/.test(text), "no em or en dashes");
});

test("a worker started after a window does not post that mention late; a lapsed day or no request gets none", async () => {
  const r = rig();
  const tries = new NudgeTries();
  await ensureDay(r.steps, D);
  await flow(r, tries);
  r.set("2026-11-02T14:16:00Z"); // first seen at 8:16 AM
  const day = await flow(r, tries);
  assert.equal(nudges(r).length, 1, "only the 8:15 one");
  assert.equal(day.phases.nudge745, undefined);
  r.set("2026-11-02T14:30:00Z"); // the open: nothing more
  await flow(r, tries);
  assert.equal(nudges(r).length, 1);

  const r2 = rig();
  await ensureDay(r2.steps, D);
  let d2 = (await r2.store.getDay(D))!; // no request posted
  r2.set("2026-11-02T13:46:00Z");
  d2 = await postUndecidedNudges(r2.steps, d2, new NudgeTries());
  assert.equal(nudges(r2).length, 0);
  d2 = await r2.store.updateDay(D, { status: "lapsed", phases: { request: "x" } });
  await postUndecidedNudges(r2.steps, d2, new NudgeTries());
  assert.equal(nudges(r2).length, 0);
});

test("a failed mention is tried at most 3 times, 30 s then 60 s apart, then stored as failed", async () => {
  const r = rig();
  const tries = new NudgeTries();
  await ensureDay(r.steps, D);
  await flow(r, tries);
  let calls = 0;
  const realSay = r.steps.say;
  r.steps.say = async (c: any, t: string, o?: any) => {
    if (t.startsWith("**Michael: the limits for")) {
      calls++;
      return false;
    }
    return realSay(c, t, o);
  };
  const at = (s: number) => r.set(new Date(Date.parse("2026-11-02T13:45:00Z") + s * 1000).toISOString());
  for (const s of [0, 5, 10, 29]) {
    at(s);
    await flow(r, tries);
  }
  assert.equal(calls, 1, "waits 30 s after the first failure");
  at(30);
  await flow(r, tries);
  assert.equal(calls, 2);
  at(89);
  await flow(r, tries);
  assert.equal(calls, 2, "waits 60 s after the second");
  at(90);
  const day = await flow(r, tries);
  assert.equal(calls, NUDGE_MAX_TRIES);
  assert.ok(day.phases.nudge745?.startsWith("failed "));
  at(200);
  await flow(r, tries);
  assert.equal(calls, 3, "never again after the last try");
  // A say that throws counts as a failed try (never breaks the limits flow).
  r.steps.say = async () => {
    throw new Error("discord down (test)");
  };
  r.set("2026-11-02T14:15:00Z");
  const d = await flow(r, tries).catch((e) => e);
  assert.ok(!(d instanceof Error), "a throwing post does not break the flow");
});

test("the worker runs the mentions in the limits flow, between the review and the reminder, with the owner mention passed through", () => {
  const src = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
  const i = src.indexOf("cur = await postMorningReview(steps, cur);");
  const j = src.indexOf("cur = await postUndecidedNudges(steps, cur, this.nudgeTries);");
  const k = src.indexOf("cur = await postReminderIfNeeded(steps, cur);");
  assert.ok(i > 0 && j > i && k > j);
  assert.ok(src.includes("say: (c, t, o) => this.say(c, t, o), now: this.d.now, feed: this.d.settings.alpaca.dataFeed };"));
});

test("round 2 (group 2 finding 1): a database write that fails after a post never makes the same mention post again", async () => {
  const r = rig();
  const tries = new NudgeTries();
  await ensureDay(r.steps, D);
  await flow(r, tries);
  r.set("2026-11-02T13:31:00Z");
  await flow(r, tries); // the 7:30 review, stored
  const realUpdate = r.store.updateDay.bind(r.store);
  r.store.updateDay = async () => {
    throw new Error("db down (test)");
  };
  for (let s = 0; s < 46 * 60; s += 5) {
    r.set(new Date(Date.parse("2026-11-02T13:44:00Z") + s * 1000).toISOString()); // 7:44 to 8:30, a pass every 5 s
    await flow(r, tries).catch(() => undefined);
  }
  assert.equal(nudges(r).length, 2, "one at 7:45, one at 8:15, despite every write failing");
  r.store.updateDay = realUpdate;
});

test("round 2: a give-up whose write fails is not tried again; a post that throws counts as a try", async () => {
  const r = rig();
  const tries = new NudgeTries();
  await ensureDay(r.steps, D);
  await flow(r, tries);
  r.set("2026-11-02T13:31:00Z");
  await flow(r, tries);
  let calls = 0;
  r.steps.say = async (_c: any, t: string) => {
    if (t.startsWith("**Michael: the limits for")) {
      calls++;
      throw new Error("discord down (test)");
    }
    return true;
  };
  r.store.updateDay = async () => {
    throw new Error("db down (test)");
  };
  for (let s = 0; s < 29 * 60; s += 5) {
    r.set(new Date(Date.parse("2026-11-02T13:45:00Z") + s * 1000).toISOString());
    await flow(r, tries).catch(() => undefined);
  }
  assert.equal(calls, NUDGE_MAX_TRIES, "three throwing tries, then never again in the window");
});
