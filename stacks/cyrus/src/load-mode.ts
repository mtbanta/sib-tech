// LOAD MODE (Michael's decision, 2026-11-03): a day set aside to drive the stack at up to 100 entries a minute for 15
// minutes, to measure whether Alpaca's 200 requests a minute holds. Off by default every day, never carried forward,
// switched on with `load on` before the morning screen (15 minutes before the open since Michael's item 4 of 2026-11-13) and approved with the evening limits.
// On a normal day nothing here applies and the stack behaves exactly as before.
//
// On a load day:
//   - the morning screen picks 30 cheap, heavily traded names (5 to 35 dollars) instead of the usual 20;
//   - no entry before the load window, which runs from 15 minutes after the open (8:45 AM Central) to the mid-day pause (10:30 AM
//     Central; Michael's decision of 2026-11-10, before 9:00), so the mid-day close-out runs with the window's positions open;
//   - in the window the placeholder churns (release B, Michael's approval of 2026-11-04, changed by the speed release of 2026-11-05):
//     any new print is a signal once 1 second has passed since that name's last signal; every entry is 1 share, a LIMIT buy at the
//     price seen rounded down to the cent plus 1 cent (Michael's ruling 3 of 2026-11-16, LOAD_ENTRY_ABOVE_CENTS; before: at or below
//     the price seen), with its take-profit LOAD_TAKE_PROFIT_CENTS above and its stop
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
// Michael's item 4 of 2026-11-13: the morning screen runs 15 minutes before the open (8:15 AM Central), and `load on` is accepted until
// then (it was 45, 7:45 AM). "Armed" stays 5 minutes before the open; the price feed waits for the screen's list (fail safe).
export const SCREEN_MINUTES_BEFORE_OPEN = 15;
export const LOAD_SWITCH_DEADLINE_MIN = SCREEN_MINUTES_BEFORE_OPEN; // `load on` is accepted until this many minutes before the open
export const LOAD_COOLDOWN_SECONDS = 1;
// The speed release (Michael's decision 4, chosen from the replay of 2026-11-05's prints, see the C2 log): the two load-day settings.
// The take-profit sits this many cents above the entry's limit price.
export const LOAD_TAKE_PROFIT_CENTS = 1;
// A window entry (a limit buy) not filled this long after Alpaca accepted it is cancelled.
export const LOAD_ENTRY_WAIT_MS = 5_000;
export const LOAD_STOP_CENTS = 2;

// MICHAEL'S REQUEST OF 2026-11-18 (with his addition): "the load window's stop distance becomes a setting (default 2 cents as today), which I
// can set for an afternoon load window, for example 5 cents, so load positions qualify for the moves" and "Add the take-profit to the same
// setting: "load afternoon stop 5 take 3" (stop 2 to 10 cents, take-profit 1 to 10 cents; each defaults to today's value if left out; that
// window only, then back to the defaults). The bot's reply shows both values in force."
// So `load afternoon` may carry `stop N` and `take M` (whole cents, either order, each at most once). The values apply to that afternoon
// window's entries only; the morning load window always uses the defaults above, and every new `load afternoon` (a window starting again
// included) writes its own values, the defaults when left out. They are stored in the day record with the window's start, in one write.
export interface LoadExits {
  stopCents: number;
  takeProfitCents: number;
}
export const DEFAULT_LOAD_EXITS: Readonly<LoadExits> = Object.freeze({ stopCents: LOAD_STOP_CENTS, takeProfitCents: LOAD_TAKE_PROFIT_CENTS });
export const LOAD_AFTERNOON_STOP_MIN_CENTS = 2;
export const LOAD_AFTERNOON_STOP_MAX_CENTS = 10;
export const LOAD_AFTERNOON_TAKE_MIN_CENTS = 1;
export const LOAD_AFTERNOON_TAKE_MAX_CENTS = 10;
// Day phase: the afternoon window's exits, written with LOAD_AFTERNOON_PHASE ("stop 5 take 3").
export const LOAD_AFTERNOON_EXITS_PHASE = "loadAfternoonExits";

const STOP_RANGE_TEXT = `a whole number of cents from ${LOAD_AFTERNOON_STOP_MIN_CENTS} to ${LOAD_AFTERNOON_STOP_MAX_CENTS}`;
const TAKE_RANGE_TEXT = `a whole number of cents from ${LOAD_AFTERNOON_TAKE_MIN_CENTS} to ${LOAD_AFTERNOON_TAKE_MAX_CENTS}`;

// The words after `load afternoon` (already lower case, split on spaces): nothing, or `stop N` and/or `take M` in either order. Returns
// the exits in force (a value left out is its default) or why the words were not accepted (nothing then changes).
export function parseLoadExits(words: readonly string[]): { exits: LoadExits } | { error: string } {
  const exits: LoadExits = { ...DEFAULT_LOAD_EXITS };
  const seen = new Set<string>();
  const usage = "write it as `load afternoon`, `load afternoon stop 5`, `load afternoon take 3` or `load afternoon stop 5 take 3`";
  if (words.length % 2 !== 0 || words.length > 4) return { error: usage };
  for (let i = 0; i < words.length; i += 2) {
    const name = words[i]!;
    const value = words[i + 1]!;
    if (name !== "stop" && name !== "take") return { error: usage };
    if (seen.has(name)) return { error: `\`${name}\` is given twice; ${usage}` };
    seen.add(name);
    const n = /^\d{1,2}$/.test(value) ? Number(value) : NaN;
    if (name === "stop") {
      if (!(n >= LOAD_AFTERNOON_STOP_MIN_CENTS && n <= LOAD_AFTERNOON_STOP_MAX_CENTS)) return { error: `the stop must be ${STOP_RANGE_TEXT} (got \`${value.slice(0, 10)}\`)` };
      exits.stopCents = n;
    } else {
      if (!(n >= LOAD_AFTERNOON_TAKE_MIN_CENTS && n <= LOAD_AFTERNOON_TAKE_MAX_CENTS)) return { error: `the take-profit must be ${TAKE_RANGE_TEXT} (got \`${value.slice(0, 10)}\`)` };
      exits.takeProfitCents = n;
    }
  }
  return { exits };
}

export const formatLoadExits = (e: LoadExits): string => `stop ${e.stopCents} take ${e.takeProfitCents}`;

const validExits = (e: LoadExits): boolean =>
  Number.isInteger(e.stopCents) && e.stopCents >= LOAD_AFTERNOON_STOP_MIN_CENTS && e.stopCents <= LOAD_AFTERNOON_STOP_MAX_CENTS &&
  Number.isInteger(e.takeProfitCents) && e.takeProfitCents >= LOAD_AFTERNOON_TAKE_MIN_CENTS && e.takeProfitCents <= LOAD_AFTERNOON_TAKE_MAX_CENTS;

// The afternoon window's exits as stored with its start. A day record without them (written before this release), or with a value that
// does not read back as one in range, gives the defaults (today's behaviour).
export function afternoonLoadExits(day: Pick<DayRecord, "phases"> | null | undefined): LoadExits {
  const v = day?.phases?.[LOAD_AFTERNOON_EXITS_PHASE];
  const m = typeof v === "string" ? /^stop (\d{1,2}) take (\d{1,2})$/.exec(v) : null;
  if (!m) return { ...DEFAULT_LOAD_EXITS };
  const e = { stopCents: Number(m[1]), takeProfitCents: Number(m[2]) };
  return validExits(e) ? e : { ...DEFAULT_LOAD_EXITS };
}

// The two values in words, for Michael's replies: "stop 5 cents and take-profit 3 cents".
export const exitsInWords = (e: LoadExits): string => `stop ${e.stopCents} cent${e.stopCents === 1 ? "" : "s"} and take-profit ${e.takeProfitCents} cent${e.takeProfitCents === 1 ? "" : "s"}`;
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
// limit (his ruling, only for that window). The day record's phase holds the time it started. The regular close-out (at the set time, 2:55 by default) runs as normal.
export const LOAD_AFTERNOON_PHASE = "loadAfternoon";

type AfternoonDay = Pick<DayRecord, "phases"> & WindowDay;

// When `load afternoon` started the window today, or null.
export function afternoonLoadStart(day: Pick<DayRecord, "phases"> | null | undefined): Date | null {
  const v = day?.phases?.[LOAD_AFTERNOON_PHASE];
  if (typeof v !== "string") return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t;
}

// Michael, 2026-11-12 (afternoon): the afternoon load window runs for at most 30 minutes, then a close-out to flat (the mid-day
// close-out code) with entries paused again. No automatic return to normal trading after it.
export const AFTERNOON_LOAD_MAX_MINUTES = 30;
// Day phase: the close-out after the afternoon load window finished flat (its time).
export const AFTERNOON_FLAT_PHASE = "afternoonFlat";
// The pause's reason once the afternoon load window has ended (its close-out).
export const AFTERNOON_PAUSE_REASON = "afternoon load window ended";

// The afternoon window's span: from `load afternoon` to the earlier of 30 minutes later and the day's last entry. Null if it was not
// started or the times are unknown.
export function afternoonLoadWindow(day: AfternoonDay | null | undefined): { start: Date; end: Date } | null {
  const start = afternoonLoadStart(day);
  if (!day || !start || !day.openAt || !day.closeAt) return null;
  const times = middayTimes({ isTradingDay: day.isTradingDay ?? true, openAt: day.openAt, closeAt: day.closeAt });
  if (!times || start >= times.lastEntryAt) return null;
  const cap = new Date(start.getTime() + AFTERNOON_LOAD_MAX_MINUTES * 60_000);
  return { start, end: cap < times.lastEntryAt ? cap : times.lastEntryAt };
}

// The close-out after the afternoon load window is due or still running: the window has ended and its close-out has not finished
// flat yet. Until then `go` and `load afternoon` are refused, and the close-out alone sells.
export function afternoonCloseoutPending(day: (AfternoonDay & Pick<DayRecord, "phases">) | null | undefined, t: Date): boolean {
  const w = afternoonLoadWindow(day);
  return !!w && t >= w.end && !day!.phases[AFTERNOON_FLAT_PHASE];
}

// The afternoon load window is on at time t.
export function inAfternoonLoad(day: AfternoonDay | null | undefined, t: Date): boolean {
  const w = afternoonLoadWindow(day);
  return !!w && t >= w.start && t < w.end;
}

// MICHAEL'S REQUEST OF 2026-11-17 (about 11:00 AM): "allow load afternoon to start again the same day if the earlier window ended early by
// my stop or flatten (still only while flat, before 1:30 PM)". Day phase: when Michael's own `stop` or `flatten` came while the afternoon
// load window was on (its time). The previous window's start is kept in LOAD_AFTERNOON_PREVIOUS_PHASE when it starts again.
export const LOAD_AFTERNOON_ENDED_EARLY_PHASE = "loadAfternoonEndedEarly";
export const LOAD_AFTERNOON_PREVIOUS_PHASE = "loadAfternoonPrevious";
// The window started today may start again: Michael's stop or flatten came while it was on (at or after its start, before its end).
// Every other condition of `load afternoon` (flat, before 1:30 PM, not after the daily loss stop) still applies (loadAfternoonRefusal).
export function afternoonMayStartAgain(day: AfternoonDay | null | undefined): boolean {
  const w = afternoonLoadWindow(day);
  const v = day?.phases?.[LOAD_AFTERNOON_ENDED_EARLY_PHASE];
  if (!w || typeof v !== "string") return false;
  const t = new Date(v);
  return !Number.isNaN(t.getTime()) && t >= w.start && t < w.end;
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
// The exits for a load entry signalled at time t: the afternoon window's own values while it is on (Michael's request of 2026-11-18),
// otherwise (the morning load window) the defaults.
export function loadExitsAt(day: (Pick<DayRecord, "phases"> & WindowDay) | null | undefined, t: Date): LoadExits {
  return inAfternoonLoad(day, t) ? afternoonLoadExits(day) : { ...DEFAULT_LOAD_EXITS };
}

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

// The speed release: a window entry's limit price (before ruling 3 below: the print rounded down to the cent, at or below the price seen).
// Michael's ruling 3 of 2026-11-16 (the speed release, option A, load windows only for now; his answer to question 6: every load window,
// the afternoon one too): the entry is priced at the price seen (rounded down to the cent) plus LOAD_ENTRY_ABOVE_CENTS, so most entries
// fill and fewer need a 5 second cancel (on 2026-11-16 58 percent did, each one a request and the cause of the lost exits). The exits stay
// 1 cent above and 2 cents below this price. Ported alone onto v27 on 2026-11-17 (Michael's morning request).
export const LOAD_ENTRY_ABOVE_CENTS = 1;
export function limitEntryPrice(print: number): number | null {
  if (!(print > 0) || !Number.isFinite(print)) return null;
  const p = Math.floor(print * 100 + 1e-9) / 100;
  return p >= 0.01 ? Math.round((p + LOAD_ENTRY_ABOVE_CENTS / 100) * 100) / 100 : null;
}

// The window's rules in one phrase, for the Armed message, the mode line and the summary.
// Michael's request of 2026-11-18: an afternoon window shows its own exits (the defaults otherwise).
export function loadWindowRules(exits: LoadExits = DEFAULT_LOAD_EXITS): string {
  return `1 share a trade on any new print, a limit buy at the price seen plus ${LOAD_ENTRY_ABOVE_CENTS} cent, cancelled if not filled in ${LOAD_ENTRY_WAIT_MS / 1000} seconds, take-profit ${exits.takeProfitCents} cent${exits.takeProfitCents === 1 ? "" : "s"} up and stop ${exits.stopCents} cent${exits.stopCents === 1 ? "" : "s"} down from the limit price`;
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
