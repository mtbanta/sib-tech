// Market time. The market keeps New York time, Michael lives on Central time. Everything is stored as
// instants (UTC); these helpers convert only at the edges. Daylight saving is handled by the platform's
// time zone data, not by hand (it changes this weekend, on 2026-11-01).

const ET = "America/New_York";
const CT = "America/Chicago";

function parts(d: Date, timeZone: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(d)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out;
}

// The market's calendar date (YYYY-MM-DD) at an instant.
export function etDate(d: Date): string {
  const p = parts(d, ET);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

// How far New York is from UTC at an instant, in minutes (-240 in summer, -300 in winter).
function etOffsetMinutes(at: Date): number {
  const p = parts(at, ET);
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

// The instant when New York's clock reads `hhmm` on `date`.
export function etInstant(date: string, hhmm: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const wall = Date.UTC(y!, m! - 1, d!, h!, mi!);
  let instant = wall - etOffsetMinutes(new Date(wall)) * 60_000;
  instant = wall - etOffsetMinutes(new Date(instant)) * 60_000; // settle across a daylight saving edge
  return new Date(instant);
}

export const minutesBetween = (from: Date, to: Date): number => (to.getTime() - from.getTime()) / 60_000;
export const addMinutes = (d: Date, minutes: number): Date => new Date(d.getTime() + minutes * 60_000);

// For messages to Michael: Central time, e.g. "7:30 AM CT".
export function centralClock(d: Date): string {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: CT, hour: "numeric", minute: "2-digit" }).format(d);
  return `${s} CT`;
}

// Where a trading day stands at an instant, by the day's own calendar times. Every step that behaves differently
// before the open, during the session or after the close asks this one function instead of comparing times itself.
//   no_session   a weekend, a holiday, or no record of the day
//   before_open  a session is scheduled and has not started
//   open         from the open up to (not including) the close
//   after_close  the close has passed
export type SessionPhase = "no_session" | "before_open" | "open" | "after_close";

export function sessionPhase(day: { isTradingDay: boolean; openAt: Date | null; closeAt: Date | null } | null, now: Date): SessionPhase {
  if (!day || !day.isTradingDay || !day.openAt || !day.closeAt) return "no_session";
  if (now < day.openAt) return "before_open";
  if (now < day.closeAt) return "open";
  return "after_close";
}

// "Monday 2026-11-02", for messages that name a day. The date is a market calendar date, so noon UTC is safe.
export function dayWord(date: string): string {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(new Date(`${date}T12:00:00Z`));
  return `${weekday} ${date}`;
}
