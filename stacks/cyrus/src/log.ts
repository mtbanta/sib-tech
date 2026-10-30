// One JSON object per line on standard output. Every string passes through the redactor first.
import type { Redactor } from "./redact.ts";

export type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  (level: Level, event: string, fields?: Record<string, unknown>): void;
}

export function makeLogger(redact: Redactor, write: (line: string) => void = (l) => console.log(l)): Logger {
  return (level, event, fields = {}) => {
    const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields });
    write(redact(line));
  };
}

// Turns any thrown value into a short redacted string safe to log or post.
export function describeError(err: unknown, redact: Redactor): string {
  const base = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const cause = err instanceof Error && err.cause ? ` (cause: ${err.cause instanceof Error ? err.cause.message : String(err.cause)})` : "";
  return redact(`${base}${cause}`).slice(0, 500);
}
