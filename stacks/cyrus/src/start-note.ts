// The worker's start message says why it started. Each start is remembered (the release it ran and the time),
// so the message can tell a new release from the same release coming back, and a run of starts in a short time
// (a crash loop) raises an alert instead of looking like routine restarts.
import { CONTROL_START_HISTORY, type Store } from "./store.ts";
import type { LogAndStore } from "./run-log.ts";
import { centralClock } from "./time.ts";

interface StartHistory {
  release: string;
  starts: string[]; // ISO times, newest last, at most 10
}

export interface StartNote {
  text: string;
  // Starts within the last hour, this one included.
  recentStarts: number;
  // True when there have been 3 or more starts in an hour.
  repeated: boolean;
  // The mid-day cycle (Michael, 2026-11-09): true when this start is a new release (a deploy). False for the same release again, or
  // when the history could not be read (then a start never counts as a deploy, so the mid-day pause stays on).
  deploy: boolean;
  release: string;
}

const HOUR_MS = 60 * 60_000;

export async function recordStart(store: Store, now: Date, release: string): Promise<StartNote> {
  let history: StartHistory | null = null;
  try {
    history = await store.getControl<StartHistory>(CONTROL_START_HISTORY);
  } catch {
    /* the message just goes out without a reason */
  }
  const starts = [...(history?.starts ?? []), now.toISOString()].slice(-10);
  const recentStarts = starts.filter((t) => now.getTime() - new Date(t).getTime() <= HOUR_MS).length;
  let reason: string;
  if (!history) reason = `release ${release}, the first start on record`;
  else if (history.release !== release) reason = `new release ${release} (was ${history.release}): a deploy`;
  else reason = `release ${release} again (a restart, a crash or Fly moving the machine; if you did not do that, check the Fly logs)`;
  await store.setControl(CONTROL_START_HISTORY, { release, starts } satisfies StartHistory).catch(() => undefined);
  // One line (the speed release, decision 6: routine confirmations on one line, no footer). A run of starts raises an alert in main.ts.
  return {
    text: `Worker started at ${centralClock(now)} (paper): ${reason}. Starts in the last hour: ${recentStarts}.`,
    recentStarts,
    repeated: recentStarts >= 3,
    deploy: history !== null && history.release !== release,
    release,
  };
}

// Group 2, night build of 2026-11-16, round 1: the start-up lines go into the run log, not only Fly's log, so the reviews read the day's
// close-out setting from the stored `worker_started` row. A setting that was not valid fell back to its default (config.ts): its warnings
// are found before the store exists, so main.ts holds them (in `settings.warnings`) and logs them here once the database has answered,
// each once, before `worker_started`. `setting_invalid` is a warning, so it is stored; `worker_started` is in STORED_INFO_EVENTS.
export function logSettingWarnings(out: LogAndStore, warnings: readonly string[]): void {
  for (const warning of warnings) out("warn", "setting_invalid", { warning });
}

export function logWorkerStarted(out: LogAndStore, fields: { feed: string; closeoutMinutesBeforeClose: number; recentStarts: number; deploy: boolean }): void {
  out("info", "worker_started", fields);
}

// A short, safe label for the running release, from Fly's image reference (its last 8 characters). "local" off Fly.
export function releaseLabel(env: Record<string, string | undefined>): string {
  const ref = env.FLY_IMAGE_REF;
  if (!ref) return "local";
  return (ref.split(":").pop() ?? ref).replace(/[^A-Za-z0-9]/g, "").slice(-8) || "unknown";
}
