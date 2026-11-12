// The mid-day cycle (Michael's decision of 2026-11-09; builds/c2-proposal-2026-11-09.md, part D). Trading runs from the open to
// 10:30 AM Central. At 10:30 new entries are paused and a mid-day close-out (the 2:55 close-out code, closeout.ts) sells everything
// until the account is flat. While flat and paused a deploy may happen. After a deploy the worker resumes on its own under the same
// day's limits, unless Michael sent `hold`, and only before 1:30 PM Central (or the day's last entry, if earlier). A plain restart
// stays paused. `go` resumes at any time once the mid-day close-out is flat. This file holds the times, the pause and hold records,
// the request budget for retries, and the decisions; the worker, the commands and the deploy check use them.
import type { DayRecord, Store } from "./store.ts";
import { MIN_MINUTES_BEFORE_CLOSE } from "./limits.ts";
import { addMinutes, centralClock } from "./time.ts";

// 10:30 AM Central is two hours after a regular 8:30 AM open; 1:30 PM Central is five hours after it.
export const MIDDAY_PAUSE_MINUTES_AFTER_OPEN = 120;
export const MIDDAY_RESUME_UNTIL_MINUTES_AFTER_OPEN = 300;
// The mid-day close-out never starts from this long before the close (the regular close-out's time; it takes over).
export const MIDDAY_NOT_AFTER_MINUTES_BEFORE_CLOSE = 5;
// A try that ends not flat is tried again at most this often (Michael's ruling of 2026-11-09: "Keep trying every 20 seconds, but only
// within 60 Alpaca requests a minute (like the loss stop's retry), never below the reserve of 80").
export const MIDDAY_RETRY_MS = 20_000;
export const MIDDAY_RETRY_REQUESTS_PER_MINUTE = 60;
// At most this many positions a retry (builder's choice, like the loss stop's retry cap of 15 requests a check): one round with 40
// positions whose sales are refused costs about 130 requests (each refused sale reads the account again), so the retries sell a few
// positions each, in turn, to stay inside 60 a minute.
export const MIDDAY_RETRY_SYMBOLS = 10;

// The positions for the next retry: all of them when few are left, else the next MIDDAY_RETRY_SYMBOLS in turn.
export function retrySymbols(remaining: string[], turn: number): string[] | null {
  const pool = remaining.filter((s) => !s.startsWith("("));
  if (pool.length <= MIDDAY_RETRY_SYMBOLS) return null; // a whole-account round (it also cancels any stray order)
  const start = (turn * MIDDAY_RETRY_SYMBOLS) % pool.length;
  return [...pool, ...pool].slice(start, start + MIDDAY_RETRY_SYMBOLS);
}
// The second alert, if the account is still not flat this long after the first try ended not flat.
export const MIDDAY_NOT_FLAT_ALERT_AFTER_MS = 5 * 60_000;
// Day phases: the mid-day close-out finished (with `middayFlat: "yes"`), and the 1:30 PM note was handled.
export const MIDDAY_PHASE = "midday";
export const MIDDAY_NOTE_PHASE = "midday1330";

export const middayKey = (date: string) => `midday_pause:${date}`;
export const isMiddayKey = (key: string) => key.startsWith("midday_pause:");
// Michael's `hold` has its own key, so the pause's own writes can never overwrite it.
export const middayHoldKey = (date: string) => `midday_hold:${date}`;

// The pause for one day. It is not the stop flag: it belongs to its day only, so it can never carry into the next day, and it
// does not touch the daily loss stop.
export interface MiddayPause {
  on: boolean;
  since: string | null; // when the pause started
  reason: string;
  resumedAt: string | null;
  resumedBy: string | null; // "deploy", "go" or "load afternoon"
  deployedAt?: string | null; // a new release started while paused
}

export function emptyPause(): MiddayPause {
  return { on: false, since: null, reason: "", resumedAt: null, resumedBy: null, deployedAt: null };
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

export async function readHold(store: Store, date: string): Promise<boolean> {
  return Boolean((await store.getControl<{ on: boolean }>(middayHoldKey(date)))?.on);
}

export async function setHold(store: Store, date: string, at: string): Promise<void> {
  await store.setControl(middayHoldKey(date), { on: true, at });
}

// The day's mid-day times, or null when the day has no mid-day cycle (not a trading day, or a session so short that 10:30 is
// already in the close-out's last minutes). Michael's ruling of 2026-11-09: an early-close day runs the cycle at 10:30 too. The
// last entry is the close minus 60 minutes (limits.ts), and the automatic resume ends at the earlier of 1:30 PM and the last entry.
export function middayTimes(day: Pick<DayRecord, "isTradingDay" | "openAt" | "closeAt">): { pauseAt: Date; resumeUntil: Date; lastEntryAt: Date } | null {
  if (!day.isTradingDay || !day.openAt || !day.closeAt) return null;
  const pauseAt = addMinutes(day.openAt, MIDDAY_PAUSE_MINUTES_AFTER_OPEN);
  if (pauseAt >= addMinutes(day.closeAt, -MIDDAY_NOT_AFTER_MINUTES_BEFORE_CLOSE)) return null;
  const lastEntryAt = addMinutes(day.closeAt, -MIN_MINUTES_BEFORE_CLOSE);
  const oneThirty = addMinutes(day.openAt, MIDDAY_RESUME_UNTIL_MINUTES_AFTER_OPEN);
  return { pauseAt, resumeUntil: oneThirty < lastEntryAt ? oneThirty : lastEntryAt, lastEntryAt };
}

export function middayFlat(day: Pick<DayRecord, "phases">): boolean {
  return Boolean(day.phases[MIDDAY_PHASE]) && day.phases.middayFlat === "yes";
}

// What a start-up does about the pause. `deploy` is true when the start note saw a new release; `startedAfterPause` is true when
// this process started after the pause began (a start before it, such as an evening deploy, is not a mid-day deploy).
export type StartupAction = "none" | "resume" | "stay-plain-restart" | "stay-hold" | "stay-late" | "stay-stop" | "not-flat-yet";
export function startupAction(o: { pause: MiddayPause | null; hold: boolean; flat: boolean; deploy: boolean; now: Date; resumeUntil: Date | null; stop?: { on: boolean } | null; startedAfterPause: boolean }): StartupAction {
  if (!o.pause?.on || !o.resumeUntil || !o.startedAfterPause) return "none";
  if (!o.flat) return "not-flat-yet"; // the mid-day close-out carries on
  if (!o.deploy) return "stay-plain-restart";
  if (o.hold) return "stay-hold";
  // Builder's choice: with the stop flag on (Michael's `stop`, or the daily loss stop) a deploy does not end the pause either, as `go`
  // would refuse.
  if (o.stop?.on) return "stay-stop";
  if (o.now >= o.resumeUntil) return "stay-late";
  return "resume";
}

// Why `go` cannot end the pause now, or null when it can.
// How a resume is named in `status` and the daily summary.
export function resumedByText(by: string | null | undefined): string {
  if (by === "deploy") return "after a deploy";
  if (by === "load afternoon") return "by `load afternoon`";
  return "by `go`";
}

export function goRefusal(o: { hasCycle: boolean; pause: MiddayPause | null; flat: boolean; stop: { on: boolean; reason: string } | null }): string | null {
  if (!o.hasCycle) return "there is no mid-day cycle today";
  if (o.pause?.resumedAt && !o.pause.on) return "trading has already resumed today";
  if (!o.pause?.on) return "trading is not paused for the mid-day cycle";
  if (!o.flat) return "the mid-day close-out has not finished flat yet";
  if (o.stop?.on) return o.stop.reason.startsWith("daily loss stop") ? "the daily loss stop is in force" : "the stop flag is on (send `resume` first if you want trading)";
  return null;
}

// Is today's loss still past the daily limit (the same look the `resume` reply makes)? Then a `resume` is stopped again within about
// 5 seconds, and there is no more trading today.
export function lossPast(day: Pick<DayRecord, "dayStartEquity" | "limits">, equity: number | null): boolean {
  return equity !== null && day.dayStartEquity !== null && day.dayStartEquity - equity >= day.limits.dailyLossStopUsd;
}

// What will really happen next when something other than the pause blocks trading (group 2 review, rounds 1 and 2): the stop flag, the
// daily loss stop, or no entries left today. Null when nothing else blocks it (the caller then says what `go` or a deploy would do).
// `lossPast`: the loss is still past the limit. `pauseAt`: given only before the pause has started (then `go` cannot be used yet).
export function blockedNext(o: { stop: { on: boolean; reason: string } | null; now: Date; lastEntryAt: Date; lossPast?: boolean; pauseAt?: Date | null }): string | null {
  const before = o.pauseAt && o.now < o.pauseAt ? centralClock(o.pauseAt) : null;
  if (o.stop?.on && o.stop.reason.startsWith("daily loss stop")) {
    if (o.lossPast) return "No more trading today (the daily loss stop is in force).";
    return before
      ? `The daily loss stop is on: send \`resume\` to trade again before the ${before} pause; after the mid-day close-out, \`go\` resumes trading.`
      : "The daily loss stop is in force, so trading stays paused for the rest of the day unless you send `resume` and then `go`.";
  }
  if (o.stop?.on) return before ? `The stop flag is on: send \`resume\` to trade again before the ${before} pause; after the mid-day close-out, \`go\` resumes trading.` : "The stop flag is on: send `resume`, then `go`.";
  if (o.now >= o.lastEntryAt) return `No entries are left today (last entry ${centralClock(o.lastEntryAt)}).`;
  return null;
}

// The retries' request budget: a copy of the loss stop's (risk.ts, LossStopBudget), 60 requests in any 60 seconds.
export class MiddayBudget {
  private times: number[] = [];
  private readonly perMinute: number;
  constructor(perMinute = MIDDAY_RETRY_REQUESTS_PER_MINUTE) {
    this.perMinute = perMinute;
  }
  used(nowMs: number): number {
    this.times = this.times.filter((t) => nowMs - t < 60_000);
    return this.times.length;
  }
  room(nowMs: number): number {
    return this.perMinute - this.used(nowMs);
  }
  spend(nowMs: number, n = 1): void {
    for (let i = 0; i < n; i++) this.times.push(nowMs);
  }
}

// May a retry of the mid-day close-out start now? Only when the minute's budget has room for its estimated cost and Alpaca's request
// budget stays at or above the reserve after it.
export function retryAllowed(o: { room: number; estimate: number; governorBudget: number; reserve: number }): boolean {
  return o.estimate <= o.room && o.governorBudget - o.estimate >= o.reserve;
}

// The deploy check (tools/midday-deploy.mjs): every reason a mid-day deploy must not go ahead, from facts read beforehand. Empty
// means it may go ahead. Pure, so it is tested without the network.
export interface DeployFacts {
  now: Date;
  day: Pick<DayRecord, "isTradingDay" | "openAt" | "closeAt" | "phases"> | null;
  pause: MiddayPause | null;
  // Michael's ruling of 2026-11-12 (afternoon): a deploy is also allowed while flat with the stop flag on.
  stop?: { on: boolean; reason: string } | null;
  positions: number;
  openOrders: number;
  afterOneThirtyAllowed: boolean;
  reviewedCommit: string | null;
  checkedOutCommit: string;
  // What `git status --porcelain` printed for the checkout (fly deploy ships the working files, so they must be exactly the commit).
  gitStatus: string;
}
export function deployRefusals(f: DeployFacts): string[] {
  const out: string[] = [];
  const times = f.day ? middayTimes(f.day) : null;
  if (!f.day || !times) out.push("today has no mid-day cycle");
  else {
    if (!middayFlat(f.day)) out.push("the mid-day close-out has not finished flat (day phase `midday` with `middayFlat: yes`)");
    if (f.now < times.pauseAt) out.push("it is before the mid-day close-out");
    if (f.now >= times.resumeUntil && !f.afterOneThirtyAllowed) out.push(`it is ${centralClock(times.resumeUntil)} or later (pass --after-130 only if Michael asked)`);
    if (f.day.closeAt && f.now >= f.day.closeAt) out.push("the market is closed: use a normal deploy");
  }
  if (!f.pause?.on && !f.stop?.on) out.push("neither the mid-day pause nor the stop flag is on");
  if (f.positions !== 0) out.push(`Alpaca shows ${f.positions} position(s)`);
  if (f.openOrders !== 0) out.push(`Alpaca shows ${f.openOrders} open order(s)`);
  if (!f.reviewedCommit) out.push("--reviewed <commit> is required (the commit that passed group 1)");
  else if (!f.checkedOutCommit.startsWith(f.reviewedCommit) || f.reviewedCommit.length < 7) out.push(`the checkout is ${f.checkedOutCommit.slice(0, 7)}, not the reviewed commit ${f.reviewedCommit}`);
  if (f.gitStatus.trim() !== "") out.push("the checkout has changed or untracked files (git status is not clean), and fly deploy would ship them");
  return out;
}
