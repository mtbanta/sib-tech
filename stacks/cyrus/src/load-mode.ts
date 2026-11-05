// LOAD MODE (Michael's decision, 2026-11-03): a day set aside to drive the stack at up to 100 entries a minute for 15
// minutes, to measure whether Alpaca's 200 requests a minute holds. Off by default every day, never carried forward,
// switched on with `load on` before the morning screen (45 minutes before the open) and approved with the evening limits.
// On a normal day nothing here applies and the stack behaves exactly as before.
//
// On a load day:
//   - the morning screen picks 30 cheap, heavily traded names (5 to 35 dollars) instead of the usual 20;
//   - no entry before the load window (15 to 30 minutes after the open, 8:45 to 9:00 AM Central);
//   - in the window the placeholder churns (release B, Michael's approval of 2026-11-04, changed by the speed release of 2026-11-05):
//     any new print is a signal once 1 second has passed since that name's last signal; every entry is 1 share, a LIMIT buy at or
//     below the price seen (the print rounded down to the cent), with its take-profit LOAD_TAKE_PROFIT_CENTS above and its stop
//     LOAD_STOP_CENTS below that limit price; an entry not filled within LOAD_ENTRY_WAIT_MS is cancelled (entry-expiry.ts). The
//     60 second time limit is gone (Michael's decision 2: Alpaca refused all 19 tries on 2026-11-05);
//   - after the window the normal placeholder runs for the rest of the day;
//   - every entry is at most 75 dollars, all day (whatever position limit was approved);
//   - the request statistics are written every minute around the window instead of every 5 minutes.
// Every entry still carries its take-profit and protective stop at Alpaca, and the 500 dollar loss stop is unchanged.
import type { DayRecord } from "./store.ts";
import type { ScreenOptions } from "./screen.ts";
import { centralClock } from "./time.ts";

// The day record's phases carry the switch: "on" = a load day; "ended" = a load day whose window Michael switched off
// after "Armed" (the window and the churn stop, the 75 dollar cap stays: only the tighter direction is allowed after
// "Armed"); absent or "off" = a normal day. (The 10 second sync, once a load-day rule, runs on every day since the speed release.)
export const LOAD_PHASE = "load";
// Set once the next day's mode has been shown to Michael (with the evening request, or by a one-time note after a release that
// added load mode started when that request was already posted).
export const LOAD_NOTE_PHASE = "loadNote";
export type LoadState = "on" | "ended" | "off";

export const LOAD_MAX_POSITION_USD = 75;
export const LOAD_WINDOW_START_MIN = 15; // minutes after the open
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

// A load day at all (the 75 dollar cap applies), whether or not its window is still switched on.
export const isLoadDay = (day: Pick<DayRecord, "phases"> | null | undefined): boolean => loadState(day) !== "off";

export function loadWindow(day: Pick<DayRecord, "openAt">): { start: Date; end: Date } | null {
  if (!day.openAt) return null;
  return { start: new Date(day.openAt.getTime() + LOAD_WINDOW_START_MIN * 60_000), end: new Date(day.openAt.getTime() + LOAD_WINDOW_END_MIN * 60_000) };
}

// The churn is on: a load day still switched on, inside its window.
export function inLoadWindow(day: Pick<DayRecord, "phases" | "openAt"> | null | undefined, t: Date): boolean {
  if (!day || loadState(day) !== "on") return false;
  const w = loadWindow(day);
  return !!w && t >= w.start && t < w.end;
}

// Before the window on a day still switched on: no entries yet (so the window starts on fresh names and is measured cleanly).
export function beforeLoadWindow(day: Pick<DayRecord, "phases" | "openAt"> | null | undefined, t: Date): boolean {
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
export function loadLine(day: Pick<DayRecord, "phases" | "openAt">): string {
  const s = loadState(day);
  const w = loadWindow(day);
  const span = w ? `${centralClock(w.start)} to ${centralClock(w.end)}` : "15 to 30 minutes after the open";
  if (s === "on") return `5. mode: **LOAD DAY** (cheap list, at most ${LOAD_MAX_POSITION_USD} dollars a position, 1 share churn ${span}, then normal)`;
  if (s === "ended") return `5. mode: load window switched off (normal placeholder, still at most ${LOAD_MAX_POSITION_USD} dollars a position)`;
  return "5. mode: normal (`load on` makes it a load day)";
}
