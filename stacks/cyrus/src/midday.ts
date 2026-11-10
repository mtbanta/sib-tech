// The mid-day cycle (Michael's decision of 2026-11-09; builds/c2-proposal-2026-11-09.md, part D). Trading runs from the open to
// 10:30 AM Central. At 10:30 new entries are paused and a mid-day close-out (the 2:55 close-out code, closeout.ts) sells everything
// until the account is flat. While flat and paused a deploy may happen. After a deploy the worker resumes on its own under the same
// day's limits, unless Michael sent `hold`, and only before 1:30 PM Central. A plain restart stays paused. `go` resumes at any time
// once the mid-day close-out is flat. This file holds the times, the pause record and the decisions; the worker, the commands and
// the deploy check use them.
import type { DayRecord, Store } from "./store.ts";
import { addMinutes } from "./time.ts";

// 10:30 AM Central is two hours after a regular 8:30 AM open; 1:30 PM Central is five hours after it.
export const MIDDAY_PAUSE_MINUTES_AFTER_OPEN = 120;
export const MIDDAY_RESUME_UNTIL_MINUTES_AFTER_OPEN = 300;
// A regular session is 6.5 hours. On an early-close day (a half day) there is no mid-day cycle (builder's choice: the day runs as
// before).
export const MIDDAY_MIN_SESSION_MINUTES = 390;
// A mid-day close-out that ends not flat is tried again after this long (the same as the 2:55 close-out's retry).
export const MIDDAY_RETRY_MS = 20_000;
// Day phases: the mid-day close-out finished (with `middayFlat: "yes"`), and the 1:30 PM note was posted.
export const MIDDAY_PHASE = "midday";
export const MIDDAY_NOTE_PHASE = "midday1330";

export const middayKey = (date: string) => `midday_pause:${date}`;
export const isMiddayKey = (key: string) => key.startsWith("midday_pause:");

// The pause for one day. It is not the stop flag: it belongs to its day only, so it can never carry into the next day, and it
// does not touch the daily loss stop.
export interface MiddayPause {
  on: boolean;
  since: string | null; // when the pause started
  reason: string;
  hold: boolean; // Michael's `hold`: no automatic resume after a deploy
  resumedAt: string | null;
  resumedBy: string | null; // "deploy" or "go"
  deployedAt?: string | null; // a new release started while paused
}

export function emptyPause(): MiddayPause {
  return { on: false, since: null, reason: "", hold: false, resumedAt: null, resumedBy: null, deployedAt: null };
}

export async function readPause(store: Store, date: string): Promise<MiddayPause | null> {
  return store.getControl<MiddayPause>(middayKey(date));
}

// Writes the pause record with these fields changed (read, change, write).
export async function updatePause(store: Store, date: string, patch: Partial<MiddayPause>): Promise<MiddayPause> {
  const now = (await readPause(store, date)) ?? emptyPause();
  const next = { ...emptyPause(), ...now, ...patch };
  await store.setControl(middayKey(date), next);
  return next;
}

// The day's mid-day times, or null when the day has no mid-day cycle (not a trading day, or an early close).
export function middayTimes(day: Pick<DayRecord, "isTradingDay" | "openAt" | "closeAt">): { pauseAt: Date; resumeUntil: Date } | null {
  if (!day.isTradingDay || !day.openAt || !day.closeAt) return null;
  if ((day.closeAt.getTime() - day.openAt.getTime()) / 60_000 < MIDDAY_MIN_SESSION_MINUTES) return null;
  return { pauseAt: addMinutes(day.openAt, MIDDAY_PAUSE_MINUTES_AFTER_OPEN), resumeUntil: addMinutes(day.openAt, MIDDAY_RESUME_UNTIL_MINUTES_AFTER_OPEN) };
}

export function middayFlat(day: Pick<DayRecord, "phases">): boolean {
  return Boolean(day.phases[MIDDAY_PHASE]) && day.phases.middayFlat === "yes";
}

// What a start-up does about the pause. `deploy` is true when the start note saw a new release.
// Builder's choice: with the stop flag on (Michael's `stop`, or the daily loss stop) a deploy does not end the pause either, as `go` would
// refuse; Michael ends the stop with `resume`, then sends `go`.
export type StartupAction = "none" | "resume" | "stay-plain-restart" | "stay-hold" | "stay-late" | "stay-stop" | "not-flat-yet";
export function startupAction(o: { pause: MiddayPause | null; flat: boolean; deploy: boolean; now: Date; resumeUntil: Date | null; stop?: { on: boolean } | null }): StartupAction {
  if (!o.pause?.on || !o.resumeUntil) return "none";
  if (!o.flat) return "not-flat-yet"; // the mid-day close-out carries on
  if (!o.deploy) return "stay-plain-restart";
  if (o.pause.hold) return "stay-hold";
  if (o.stop?.on) return "stay-stop";
  if (o.now >= o.resumeUntil) return "stay-late";
  return "resume";
}

// Why `go` cannot end the pause now, or null when it can.
export function goRefusal(o: { hasCycle: boolean; pause: MiddayPause | null; flat: boolean; stop: { on: boolean; reason: string } | null }): string | null {
  if (!o.hasCycle) return "there is no mid-day cycle today";
  if (o.pause?.resumedAt && !o.pause.on) return "trading has already resumed today";
  if (!o.pause?.on) return "trading is not paused for the mid-day cycle";
  if (!o.flat) return "the mid-day close-out has not finished flat yet";
  if (o.stop?.on) return o.stop.reason.startsWith("daily loss stop") ? "the daily loss stop is in force" : "the stop flag is on (send `resume` first if you want trading)";
  return null;
}

// The deploy check (tools/midday-deploy.mjs): every reason a mid-day deploy must not go ahead, from facts read beforehand. Empty
// means it may go ahead. Pure, so it is tested without the network.
export interface DeployFacts {
  now: Date;
  day: Pick<DayRecord, "isTradingDay" | "openAt" | "closeAt" | "phases"> | null;
  pause: MiddayPause | null;
  positions: number;
  openOrders: number;
  afterOneThirtyAllowed: boolean;
  reviewedCommit: string | null;
  checkedOutCommit: string;
}
export function deployRefusals(f: DeployFacts): string[] {
  const out: string[] = [];
  const times = f.day ? middayTimes(f.day) : null;
  if (!f.day || !times) out.push("today has no mid-day cycle");
  else {
    if (!middayFlat(f.day)) out.push("the mid-day close-out has not finished flat (day phase `midday` with `middayFlat: yes`)");
    if (f.now < times.pauseAt) out.push("it is before the mid-day close-out");
    if (f.now >= times.resumeUntil && !f.afterOneThirtyAllowed) out.push("it is 1:30 PM Central or later (pass --after-130 only if Michael asked)");
    if (f.day.closeAt && f.now >= f.day.closeAt) out.push("the market is closed: use a normal deploy");
  }
  if (!f.pause?.on) out.push("the mid-day pause is not on");
  if (f.positions !== 0) out.push(`Alpaca shows ${f.positions} position(s)`);
  if (f.openOrders !== 0) out.push(`Alpaca shows ${f.openOrders} open order(s)`);
  if (!f.reviewedCommit) out.push("--reviewed <commit> is required (the commit that passed group 1)");
  else if (!f.checkedOutCommit.startsWith(f.reviewedCommit) || f.reviewedCommit.length < 7) out.push(`the checkout is ${f.checkedOutCommit.slice(0, 7)}, not the reviewed commit ${f.reviewedCommit}`);
  return out;
}
