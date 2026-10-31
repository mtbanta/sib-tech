// The worker's start message says why it started. Each start is remembered (the release it ran and the time),
// so the message can tell a new release from the same release coming back, and a run of starts in a short time
// (a crash loop) raises an alert instead of looking like routine restarts.
import { CONTROL_START_HISTORY, type Store } from "./store.ts";
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
  if (!history) reason = `Release ${release}. This is the first start on record.`;
  else if (history.release !== release) reason = `New release ${release} (it was ${history.release}), so this is a deploy.`;
  else reason = `Release ${release} again: the same code started again (a stop and start, a crash, or Fly moving the machine). If you did not do that, check the Fly logs.`;
  await store.setControl(CONTROL_START_HISTORY, { release, starts } satisfies StartHistory).catch(() => undefined);
  return {
    text: `Stack C worker started at ${centralClock(now)} (paper trading only). ${reason} Starts in the last hour: ${recentStarts}. Type \`help\` for commands. Research input for a human decision, never an instruction to act.`,
    recentStarts,
    repeated: recentStarts >= 3,
  };
}

// A short, safe label for the running release, from Fly's image reference (its last 8 characters). "local" off Fly.
export function releaseLabel(env: Record<string, string | undefined>): string {
  const ref = env.FLY_IMAGE_REF;
  if (!ref) return "local";
  return (ref.split(":").pop() ?? ref).replace(/[^A-Za-z0-9]/g, "").slice(-8) || "unknown";
}
