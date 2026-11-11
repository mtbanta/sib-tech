// LOAD MODE (Michael's decision, 2026-11-03): a day set aside to drive the stack at up to 100 entries a minute for 15
// minutes, to measure whether Alpaca's 200 requests a minute holds. Off by default every day, never carried forward,
// switched on with `load on` before the morning screen (45 minutes before the open) and approved with the evening limits.
// On a normal day nothing here applies and the stack behaves exactly as before.
//
// On a load day:
//   - the morning screen picks 30 cheap, heavily traded names (5 to 35 dollars) instead of the usual 20;
//   - no entry before the load window, which runs from 15 minutes after the open (8:45 AM Central) to the mid-day pause (10:30 AM
//     Central; Michael's decision of 2026-11-10, before 9:00), so the mid-day close-out runs with the window's positions open;
//   - in the window the placeholder churns (release B, Michael's approval of 2026-11-04, changed by the speed release of 2026-11-05):
//     any new print is a signal once 1 second has passed since that name's last signal; every entry is 1 share, a LIMIT buy at or
//     below the price seen (the print rounded down to the cent), with its take-profit LOAD_TAKE_PROFIT_CENTS above and its stop
//     LOAD_STOP_CENTS below that limit price; an entry not filled within LOAD_ENTRY_WAIT_MS is cancelled (entry-expiry.ts). The
//     60 second time limit is gone (Michael's decision 2: Alpaca refused all 19 tries on 2026-11-05);
//   - after the window the normal placeholder runs for the rest of the day;
//   - every entry is at most 75 dollars until the mid-day pause (whatever position limit was approved), and the ceiling is 150
//     orders a minute until then while the window is switched on. From the mid-day pause the day is a normal day (Michael's decision
//     of 2026-11-10, replacing the 75 dollar cap all day): the approved largest position and at most 100 orders a minute;
//   - the request statistics are written every minute around the window instead of every 5 minutes.
// Every entry still carries its take-profit and protective stop at Alpaca, and the 500 dollar loss stop is unchanged.
import type { DayRecord } from "./store.ts";
import type { ScreenOptions } from "./screen.ts";
import { centralClock } from "./time.ts";
import { middayTimes } from "./midday.ts";

// The day record's phases carry the switch: "on" = a load day; "ended" = a load day whose window Michael switched off
// after "Armed" (the window and the churn stop, the 75 dollar cap stays until the mid-day pause: only the tighter direction is
// allowed after "Armed"); absent or "off" = a normal day. (The 10 second sync, once a load-day rule, runs on every day since the speed release.)
export const LOAD_PHASE = "load";
// Set once the next day's mode has been shown to Michael (with the evening request, or by a one-time note after a release that
// added load mode started when that request was already posted).
export const LOAD_NOTE_PHASE = "loadNote";
export type LoadState = "on" | "ended" | "off";

export const LOAD_MAX_POSITION_USD = 75;
export const LOAD_WINDOW_START_MIN = 15; // minutes after the open
// The window ends at the mid-day pause (middayTimes, 10:30 AM Central). Only on a day with no mid-day cycle (a session too short for
// one) does it end this many minutes after the open, as before Michael's decision of 2026-11-10.
export const LOAD_WINDOW_END_MIN = 30;
export const LOAD_SWITCH_DEADLINE_MIN = 45; // `load on` is accepted until this many minutes before the open (the morning screen)
export const LOAD_COOLDOWN_SECONDS = 1;
// The speed release (Michael's decision 4, chosen from the replay of 2026-11-05's prints, see the C2 log): the two load-day settings.
// The take-profit sits this many cents above the entry's limit price.
export const LOAD_TAKE_PROFIT_CENTS = 1;
// A window entry (a limit buy) not filled this long after Alpaca accepted it is cancelled.
export const LOAD_ENTRY_WAIT_MS = 5_000;
export const LOAD_STOP_CENTS = 2;
// Release B: shares per entry in the window. A 1-share order cannot partly fill, so no remainder is ever left without its stop,
// and an unfilled entry that is cancelled leaves nothing behind.
export const LOAD_WINDOW_SHARES = 1;

export const LOAD_SCREEN: ScreenOptions = { minPrice: 5, maxPrice: 35, minDollarVolume: 25_000_000, minSessions: 4, listSize: 30, rankBy: "shares" };

export function loadState(day: Pick<DayRecord, "phases"> | null | undefined): LoadState {
  const v = day?.phases?.[LOAD_PHASE];
  return v === "on" || v === "ended" ? v : "off";
}

// A load day at all, whether or not its window is still switched on (the cheap list, the summary's window part).
export const isLoadDay = (day: Pick<DayRecord, "phases"> | null | undefined): boolean => loadState(day) !== "off";

// THE AFTERNOON LOAD WINDOW (Michael's standing requirement of 2026-11-11). On any day, while the account is flat and the mid-day pause
// is on, `load afternoon` (until 1:30 PM Central) makes the rest of the day until the last entry (2:00 PM Central on a full day) a load
// window: the load day's entries and exits, at most 75 dollars a position, and up to 150 orders a minute even above the day's approved
// limit (his ruling, only for that window). The day record's phase holds the time it started. The 2:55 close-out runs as normal.
export const LOAD_AFTERNOON_PHASE = "loadAfternoon";

type AfternoonDay = Pick<DayRecord, "phases"> & WindowDay;

// When `load afternoon` started the window today, or null.
export function afternoonLoadStart(day: Pick<DayRecord, "phases"> | null | undefined): Date | null {
  const v = day?.phases?.[LOAD_AFTERNOON_PHASE];
  if (typeof v !== "string") return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t;
}

// The afternoon window's span: from `load afternoon` to the day's last entry. Null if it was not started or the times are unknown.
export function afternoonLoadWindow(day: AfternoonDay | null | undefined): { start: Date; end: Date } | null {
  const start = afternoonLoadStart(day);
  if (!day || !start || !day.openAt || !day.closeAt) return null;
  const times = middayTimes({ isTradingDay: day.isTradingDay ?? true, openAt: day.openAt, closeAt: day.closeAt });
  return times && start < times.lastEntryAt ? { start, end: times.lastEntryAt } : null;
}

// The afternoon load window is on at time t.
export function inAfternoonLoad(day: AfternoonDay | null | undefined, t: Date): boolean {
  const w = afternoonLoadWindow(day);
  return !!w && t >= w.start && t < w.end;
}

// Load-day entries (1 share, a limit buy) may be sent today: a load day, or a day whose afternoon load window was started.
export const hasLoadEntries = (day: Pick<DayRecord, "phases"> | null | undefined): boolean => isLoadDay(day) || afternoonLoadStart(day) !== null;

type WindowDay = Pick<DayRecord, "openAt"> & Partial<Pick<DayRecord, "closeAt" | "isTradingDay">>;

export function loadWindow(day: WindowDay): { start: Date; end: Date } | null {
  if (!day.openAt) return null;
  const start = new Date(day.openAt.getTime() + LOAD_WINDOW_START_MIN * 60_000);
  // Michael's decision of 2026-11-10: the window runs until the mid-day pause.
  const midday = day.closeAt ? middayTimes({ isTradingDay: day.isTradingDay ?? true, openAt: day.openAt, closeAt: day.closeAt }) : null;
  const end = midday && midday.pauseAt > start ? midday.pauseAt : new Date(day.openAt.getTime() + LOAD_WINDOW_END_MIN * 60_000);
  return { start, end };
}

// Michael's decision of 2026-11-10: the load day's own limits (the 75 dollar cap, the short backoff after a refusal) apply until the
// mid-day pause (the window's end); from then on the day is a normal day. A day whose times are unknown keeps them (it cannot trade).
// `pauseStarted` (the gate passes it): the worker writes the pause a few seconds after 10:30:00, so the cap is kept until the pause has
// in fact started (builder's choice, the tighter direction: no full-size entry in those seconds). Without it, the clock alone decides.
export function loadRulesApply(day: (Pick<DayRecord, "phases"> & WindowDay) | null | undefined, t: Date, pauseStarted?: boolean): boolean {
  if (inAfternoonLoad(day, t)) return true;
  if (!day || !isLoadDay(day)) return false;
  const w = loadWindow(day);
  if (!w || t < w.end) return true;
  return pauseStarted === false;
}

// The 150 a minute ceiling (Michael's ruling of 2026-11-06) is in force only while the window is switched on (`load on`) and, since
// his decision of 2026-11-10, only until the mid-day pause; after it, 100.
export function loadCeilingOn(day: (Pick<DayRecord, "phases"> & WindowDay) | null | undefined, t: Date): boolean {
  if (inAfternoonLoad(day, t)) return true; // the afternoon load window (Michael, 2026-11-11)
  return !!day && loadState(day) === "on" && loadRulesApply(day, t); // by the clock alone: 100 from 10:30:00 (the tighter direction)
}

// The churn is on: a load day still switched on, inside its window.
export function inLoadWindow(day: (Pick<DayRecord, "phases"> & WindowDay) | null | undefined, t: Date): boolean {
  if (inAfternoonLoad(day, t)) return true; // the afternoon load window (Michael, 2026-11-11)
  if (!day || loadState(day) !== "on") return false;
  const w = loadWindow(day);
  return !!w && t >= w.start && t < w.end;
}

// Before the window on a day still switched on: no entries yet (so the window starts on fresh names and is measured cleanly).
export function beforeLoadWindow(day: (Pick<DayRecord, "phases"> & WindowDay) | null | undefined, t: Date): boolean {
  if (!day || loadState(day) !== "on") return false;
  const w = loadWindow(day);
  return !!w && t < w.start;
}

// The speed release: a window entry's limit price, at or below the price seen (the print rounded down to the cent).
export function limitEntryPrice(print: number): number | null {
  if (!(print > 0) || !Number.isFinite(print)) return null;
  const p = Math.floor(print * 100 + 1e-9) / 100;
  return p >= 0.01 ? p : null;
}

// The window's rules in one phrase, for the Armed message, the mode line and the summary.
export function loadWindowRules(): string {
  return `1 share a trade on any new print, a limit buy at or below the price seen, cancelled if not filled in ${LOAD_ENTRY_WAIT_MS / 1000} seconds, take-profit ${LOAD_TAKE_PROFIT_CENTS} cent${LOAD_TAKE_PROFIT_CENTS === 1 ? "" : "s"} up and stop ${LOAD_STOP_CENTS} cents down from that price`;
}

// The fifth line of the limits request, the morning review and every limits reply.
export function loadLine(day: Pick<DayRecord, "phases"> & WindowDay): string {
  const s = loadState(day);
  const w = loadWindow(day);
  const span = w ? `${centralClock(w.start)} to ${centralClock(w.end)}` : "from 15 minutes after the open to the mid-day pause";
  if (s === "on") return `5. mode: **LOAD DAY** (cheap list, 1 share churn ${span}, at most ${LOAD_MAX_POSITION_USD} dollars a position until the mid-day pause, then a normal day)`;
  if (s === "ended") return `5. mode: load window switched off (normal placeholder, still at most ${LOAD_MAX_POSITION_USD} dollars a position until the mid-day pause, then a normal day)`;
  return "5. mode: normal (`load on` makes it a load day)";
}
