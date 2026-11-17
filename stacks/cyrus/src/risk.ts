// Watching what the gate set in motion: bring the stored entries up to date from Alpaca, check that every open
// entry still has a live exit resting at Alpaca, and stop the day if the daily loss limit is reached.
import { AlpacaError, type Order } from "./alpaca-trading.ts";
import { activeOrdersOldestFirst } from "./order-index.ts";
import { FIRST_TRY_MOST, Reservation, RequestBudget, withReservation, type Refusal } from "./request-budget.ts";
import { inRequestScope } from "./request-scope.ts";
import type { ProtectionHooks, RoomNeed } from "./protection.ts";
import type { Broker } from "./broker.ts";
import { centralClock, etInstant } from "./time.ts";
import { DEFAULT_CLOSEOUT_MINUTES_BEFORE_CLOSE } from "./config.ts";
import { CONTROL_STOP, type DayRecord, type OrderRecord, type StopFlag, type Store } from "./store.ts";
import { OPEN_STATUSES, flattenLegs, openOrderIds, openSellQty, type Liquidator, type Say } from "./sells.ts";

export interface RiskDeps {
  broker: Broker;
  store: Store;
  now: () => Date;
  say: Say;
  liquidator: Liquidator;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // Optional: the worker passes its own, so the loss stop remembers that it fired even when the stop flag cannot be read.
  lossMemory?: LossStopMemory;
  // The regular close-out's time in minutes before the close (the setting, Michael's night build request of 2026-11-16, item 4). The
  // loss stop's retry goes quiet one minute before it. Absent: the default, 5.
  closeoutMinutesBeforeClose?: number;
  // Optional: the order-rate governor. When given, the loss stop's retry never spends Alpaca's last requests (the reserve in force,
  // decision 7 of 2026-11-06; the fixed SAFETY_RESERVE when the governor does not say), and the first sale's requests (as Alpaca
  // counted them) are charged to the loss stop's budget.
  governor?: { budget(): number; reserve?(): number; stats?(): { requestsLastMinute: number } };
  // Item 3 of the night build: the clock first tries wait on for room (at most FIRST_TRY_WAIT_MAX_MS). Without it they go ahead at once.
  sleep?: (ms: number) => Promise<void>;
  // Optional: the worker passes its own, so the order sync remembers between runs (release A, fixes 1 and 4).
  syncMemory?: SyncMemory;
  // The speed release (Michael's decision 3): told about each sale of shares left without a stop, so the worker can measure it
  // against waiting 5 more seconds.
  // Since decision 3 of 2026-11-06 it is told when Alpaca accepts the sale (not after the sale has filled), with the sale's client id.
  onBareSale?: (sale: { symbol: string; shares: number; takeProfit: number | null; atMs: number; clientOrderId?: string }) => void;
  // The speed release, item 5 (shadow only): told about each account read of the loss stop, so the worker can log its own estimate
  // of equity beside Alpaca's. It never changes what the loss stop does.
  onAccountRead?: (account: { equity: number; cash: number }) => void;
  // Messaging only (the speed release, decision 6): a successful sale of shares left without a stop is handed here, so the worker can
  // post them as one alert a minute. Without it the sale is posted to `alerts` at once, as before. Failures are always posted at once.
  onRemainderSold?: (symbol: string, shares: number) => void;
  // Logging only (Michael's approval of 2026-11-10): what the worker knows about a symbol when a sale is noticed late (when the live
  // update reported the stop's cancel, the timed sync it set, syncs put off because one was running). Must not throw.
  lateNoticeContext?: (symbol: string) => Record<string, unknown>;
  // A4 (counting only): told about each fresh stop placed for a remainder, for the summary's stop-gap line. Must not throw.
  onFreshStop?: (x: { symbol: string; shares: number }) => void;
  // The redesign of 2026-11-14, part 1: the shared request budget every retry, recheck and status check draws from (request-budget.ts).
  // The worker passes its own; without one, a budget of their own is kept in the sync's or the loss stop's memory.
  budget?: RequestBudget;
}

// Group 2, round 2 of the redesign (rule 6): when a budgeted try finds no room, the sync that comes for its next try first reads the order
// list and the positions (routine work from the same Alpaca bucket). So the next try waits until there is room for those reads and the try
// together, and at least 0.5, 1, 2, then 4 s after refusals in a row (`waits`, counted by the caller; a try that starts resets it). Before
// this, such a wait brought a whole sync forward about every half second, whose reads spent the refill the try was waiting for.
export const ROOM_WAIT_FIRST_MS = 500;
export const ROOM_WAIT_MAX_MS = 4_000;
function roomWaitUntil(d: Pick<RiskDeps, "budget" | "now" | "governor">, holder: { budget?: RequestBudget }, cls: "P1" | "P2", n: number, waits: number, nowMs: number, syncReads = 2, fiveSec = true, minuteCap?: number): number {
  const room = budgetOf(d, holder).roomFor(cls, n, fiveSec, syncReads, minuteCap);
  const roomAt = room.ok ? nowMs : room.at;
  return Math.max(roomAt, nowMs + Math.min(ROOM_WAIT_FIRST_MS * 2 ** Math.max(0, waits - 1), ROOM_WAIT_MAX_MS));
}

// The shared request budget for these deps: the worker's, else one kept in `holder` (a test's own memory), on the deps' clock.
function budgetOf(d: Pick<RiskDeps, "budget" | "now" | "governor">, holder: { budget?: RequestBudget }): RequestBudget {
  if (d.budget) return d.budget;
  holder.budget ??= new RequestBudget({ now: () => d.now().getTime(), remaining: () => d.governor?.budget() ?? 200 });
  return holder.budget;
}

// Logging only (Michael's approval of 2026-11-10): a shares-without-a-stop case noticed this long after Alpaca's cancel is logged as
// `late_notice`, with what the order sync was doing. By design it is noticed at once since A4 of 2026-11-12 (BARE_GRACE_MS is 0; it was
// about 3 seconds before); on 2026-11-10
// HIMS-38 was noticed 14.7 seconds after, with no cause in the records.
export const LATE_NOTICE_MS = 6_000;
// Fix C (Michael's approval of 2026-11-10): a sale reported as "not filled yet" gets its closing line when it fills; after this long
// without a fill seen, it is dropped without a line (the order sync deals with the shares again if they are still held).
export const AWAITING_FILL_MAX_MS = 2 * 60_000;
export interface AwaitingFill {
  symbol: string;
  qty: number;
  kind: "missing" | "bare";
  saleIds: string[];
  since: number;
}

// Release A, fix 1. On 2026-11-04 Alpaca paper cancelled a bracket's stop 2 ms after its take-profit's first partial fill (655
// times that day; Alpaca's documentation says the stop is "adjusted to the remaining quantity" instead). Until the take-profit
// finishes, the rest of the position has no stop. If it is still like that this long after the stop was cancelled, the rest is
// sold. 604 of the 655 finished within 10 seconds, 90 took longer than 5.
// The speed release (Michael's decision 3, 2026-11-05): 3 seconds, counted from Alpaca's cancel. The live update of the stop's cancel
// wakes the entry at that moment (worker.ts; since the redesign of 2026-11-14 a look of the protection loop); the 10 second sync stays the backstop. On 2026-11-05, of 1,100 such
// cancels the take-profit finished on its own within 3 seconds in 827.
// A4 of the proposal of 2026-11-12 (Michael's approval): at once. The take-profit's rest is cancelled and a fresh stop placed for the
// shares left as soon as the stop's cancel is seen (the take-profits that would have finished on their own, about two thirds, are given
// up for that; the remainder ends at its fresh stop or the close-out).
export const BARE_GRACE_MS = 0;
// A5: how long the fast sale of a lost-exit entry waits for Alpaca's own cancel of its exits to free the share (this morning's cancels
// landed 0.05 to 1.06 seconds after the fill); if the share is still held by its exits after that, Alpaca kept them and nothing is sold.
export const FAST_LOST_EXIT_WAIT_MS = 2_500;
// Release A, fix 4: at most this many entries missing from Alpaca's listing are looked up by id in one sync, and an id Alpaca
// does not know is not asked again for this long.
export const MISSING_LOOKUPS_PER_SYNC = 10;
// Michael's item 4 of 2026-11-13 (afternoon): a sync that takes this long or longer logs the time of each of its steps (`sync_slow`).
export const SLOW_SYNC_MS = 2_000;
// Group 2, round 4 of the weekend build: how long after a live report of a completed stop cancel the sync keeps rechecking quickly while the
// list still shows that stop open.
export const LIVE_LAG_WATCH_MS = 30_000;
// Michael's change of 2026-11-13 (evening): the longest gap between those rechecks (since part 2 of the redesign each recheck is a look of the protection loop that runs
// inside a P2 reservation of the shared request budget, charged at what it sends, once for all the remainders it serves).
export const LIVE_LAG_RECHECK_MAX_MS = 2_000;
const MISSING_RETRY_MS = 60_000;
const MISSING_INTENT_AGE_MS = 10_000;
// The speed release, item 3: while Alpaca's live order updates are connected (they free symbols and report a stop's cancel at once),
// the 10 second sync is the backstop and reads only the orders of the last 10 minutes (at most 3 pages). An open entry older than
// that is looked up by its id instead: at most OLD_LOOKUPS_PER_SYNC in one sync, each at most every OLD_LOOKUP_EVERY_MS (as often as
// the normal-day sync used to read it). While the updates are NOT connected the sync reads everything since the oldest open entry,
// as before. On 2026-11-05 one entry held from 9:33 made every sync read about 2,600 entries (6 pages) by 2:00 PM.
export const RECENT_WINDOW_MS = 10 * 60_000;
export const RECENT_MAX_PAGES = 3;
export const OLD_LOOKUPS_PER_SYNC = 4;
// Group 1 review, round 1: at least this many, and enough that every older entry is looked up at least every OLD_LOOKUP_EVERY_MS
// (no slower than the normal-day sync of v9). An entry whose exit Alpaca just reported cancelled, expired or rejected (live updates,
// `mustLook`) is looked up on the very next sync, outside this budget, so the 3 second stop-gap sale also reaches an older entry.
export const OLD_LOOKUP_EVERY_MS = 30_000;

// Release 1 of 2026-11-09 (Michael's approval of parts A and C, builds/c2-proposal-2026-11-09.md): a cleanup sale that finds the
// shares held with no open order visible is tried again after 5 seconds, then 10, 20, and at most every 30 (part A, step 1), so a
// stuck symbol no longer holds up the sync. Michael hears once when a position is first stuck, once if it is still stuck after
// 5 minutes (part A, step 4), and once when it resolves (part C).
export const STUCK_RETRY_FIRST_MS = 5_000;
export const STUCK_RETRY_MAX_MS = 30_000;
// Item 3 of 2026-11-13: the first wait for a sale held by visible open orders (about one order sync, as before).
export const STUCK_VISIBLE_RETRY_FIRST_MS = 10_000;
// Michael's ruling 1 of 2026-11-14 (night), replacing the two waits above for an ordinary stuck retry (one without a timed-out fresh stop):
// each retry is one round (so it fits the 10 requests it reserves), and the next one is due this long after it, then runs as soon as the
// shared request budget has room (a room wake: checked locally, no request, until there is room). Rule 6: its limit is the budget's cap
// (75 a minute since Michael's decision 2 of 2026-11-17, 60 before; 15 in 5 seconds; shared); its wait grows while the budget has no room (0.5, 1, 2, then 4 s, `roomWaitUntil`).
export const STUCK_RETRY_MIN_GAP_MS = 2_000;
// Michael's answer of 2026-11-14 (night) on rulings 1 and 2: ordinary stuck retries stop at 45 of the budget's 60 a minute, leaving 15 for
// urgent work (unclear fresh-stop lookups, the 15 second limit's try of 13, timed-out stop checks and tries, and then close-out retries), so one
// stuck position whose sales Alpaca refuses can never fill the minute.
// Michael's decision 2 of 2026-11-17 (about 8:25 AM): "raise stuck sales to 60 a minute ... only in the version where urgent work keeps its 15
// (shared budget 75) and the three behaviour tests (timed-out stop, unclear stop) pass". So 60 of the shared 75 (BUDGET_PER_MINUTE); the
// last 15 stay for urgent work as before, and one refused stuck position still cannot fill the minute.
export const STUCK_RETRY_MINUTE_CAP = 60;
// Michael's decision of 2026-11-13 (item 2, first point): with the live updates down, an entry with a timed-out fresh stop is tried at
// least every 10 seconds (5, then 10), within the shared request budget.
export const STUCK_RETRY_MAX_NO_STREAM_MS = 10_000;
// Item 2 of 2026-11-13: while an entry's timed-out stop is known open and our cancel of it was accepted (or it shows pending cancel), no
// sale is tried; its status is checked instead (one lookup by client id when the sync's list does not show it): every 10 seconds with the
// live updates down, every 30 seconds with them up (the live update that it ended runs the sale at once). A sale try runs once it is known
// to have ended. Since the redesign of 2026-11-14 (part 1) these checks and the tries are class P1 of the shared request budget.
export const TIMED_OUT_PROBE_NO_STREAM_MS = 10_000;
export const TIMED_OUT_PROBE_STREAM_MS = 30_000;
export const TIMED_OUT_PROBE_FAIL_MAX_MS = 60_000;
// The redesign of 2026-11-14, part 1: what each budgeted try reserves before it starts (its most requests; section 3.2's table of the
// design). A sale try for an entry with a timed-out stop: clock and positions 2, open orders 1, a cancel 1, two looks 4, re-read 1, sale 3,
// last look 1. A status check of a timed-out stop, and the 15 second limit's look: its lookup by client id, and Alpaca's open orders if that
// lookup fails. The 15 second limit reserves its look and its first try separately (group 2, round 1 of the redesign).
export const TIMED_OUT_TRY_REQUESTS = 13;
export const TIMED_OUT_CHECK_REQUESTS = 2;
export const STUCK_ESCALATE_MS = 5 * 60_000;
// The redesign of 2026-11-14, part 1 (Michael's approval): the short retries of stuck entries are class P1 of the shared request budget
// (request-budget.ts: 75 a minute (60 before 2026-11-17) and 15 in any 5 seconds for every retry and check together, down to 20 of Alpaca's remaining). Each
// retry reserves STUCK_TRY_REQUESTS before it starts (one lookup plus one short round of the sale; at most 8 were measured in the simulator
// on 2026-11-09, the 2 more are margin); what it really sends is counted as it is sent. A retry that does not fit waits for room. A
// position's first sale is never refused (it is counted, as a first try).
export const STUCK_TRY_REQUESTS = 10;
export interface StuckEntry {
  // Group 2 review of 2026-11-12: true when the stuck case is a remainder the stack is trying to give a fresh stop (A4), so the alerts say
  // "protect or sell", not only "sell". Since Michael's answer of 2026-11-14 (night) on ruling 1 it is also read by the order sync: such a
  // remainder seen with no exits, before any fresh stop was recorded for it (`freshStopRecorded`), still gets its fresh stop.
  protecting?: boolean;
  // Group 1, rulings round 1: a fresh stop was recorded for this entry (placed, unclear, or found resting). From then on, a remainder seen
  // with no exits is sold at market as before (A4: once its fresh stop is gone, the missing-exit check sells it).
  freshStopRecorded?: boolean;
  symbol: string;
  since: number;
  nextAt: number;
  delayMs: number;
  alerted: boolean;
  escalated: boolean;
  // Michael's decision of 2026-11-09 (after group 1 round 2 of release 1): when it was last tried, so the shared request budget's room goes
  // to the stuck entry that has waited longest (taking turns), and the reason given in its last alert, for the 5 minute alert.
  lastTriedAt: number;
  why: string;
  // Messaging only (group 2, round 3 of the night release): the entry's fresh stop that hit the 15 second limit was still working at
  // Alpaca at the last try (the sale's own read showed it holding the shares), and whether Alpaca accepted our cancel of it. Read by the
  // 5 minute alert alone, so it tells the truth (a stop resting at Alpaca, not "no protective stop"); never by the retry or the sale.
  restingStop?: { stopClientOrderId: string; cancel: "accepted" | "refused" | "pending" | "not sent" };
  // Item 3 of 2026-11-13: the wait for a sale held by visible open orders (10 s, doubling to 30). Since Michael's ruling 1 of 2026-11-14
  // (night) such a sale is tried again 2 s later as soon as the budget has room, so this is always 0 (kept so a stored record reads alike).
  visibleDelayMs?: number;
  // Messaging only (Michael's ruling 1 of 2026-11-14, night: a retry is one round, so its sale often fills after the round's last look):
  // when a retry last sent a sale that had not filled yet. Shares found gone within AWAITING_FILL_MAX_MS of it are reported "sold".
  saleSentAt?: number;
  // The redesign of 2026-11-14 (group 2, round 2): retries refused for lack of room in a row (their wait grows); reset when one starts.
  roomWaits?: number;
}

export class SyncMemory {
  // When this worker first saw an entry with its stop gone and shares left (used when Alpaca gives no cancel time).
  readonly bareSeen = new Map<string, number>();
  // Client ids Alpaca answered "not found" for, and until when not to ask again.
  readonly notFoundUntil = new Map<string, number>();
  // Release B: the latest copy of each open entry (with its exit legs) as Alpaca showed it to the last sync, and when that sync
  // finished. The live order updates read these instead of asking Alpaca again.
  readonly lastSeen = new Map<string, Order>();
  lastSyncAt = 0;
  // The speed release, item 3: when each open entry older than the recent window was last looked up by its id.
  readonly oldLookedAt = new Map<string, number>();
  // Entries (client ids) whose exit leg the live updates just reported cancelled, expired or rejected: looked up on the next sync.
  readonly mustLook = new Set<string>();
  // Release 1 of 2026-11-09: entries (client ids) whose cleanup sale could not sell their shares, with the retry and alert state.
  readonly stuck = new Map<string, StuckEntry>();
  // Protect-first (Michael's night build request of 2026-11-16, item 2; protect-first.ts): told when the walk finds an entry without a
  // confirmed stop, when it finds one protected, and what its own positions read showed. Unset (a test's own memory): nothing is told.
  protectFirst?: { mark(entryClientOrderId: string, symbol: string, why: string): void; protectedNow(entryClientOrderId: string): void; positionsRead(heldQty: ReadonlyMap<string, number>, readStartedMs: number): void };
  // The redesign of 2026-11-14, part 1: the shared request budget when the deps bring none (a test's own memory; the worker passes its own).
  budget?: RequestBudget;
  // Whether the live order updates were connected at the start of the current sync (set by syncOrders; read by the backoff's cap).
  streamLive = false;
  // Fix C of 2026-11-10: entries whose cleanup sale was sent but not seen filled, waiting for their closing line.
  readonly awaitingFill = new Map<string, AwaitingFill>();
  // Entries already logged as `late_notice` (once per entry: a stuck entry's retries are not new late notices).
  readonly lateLogged = new Set<string>();
  // A4 of the proposal of 2026-11-12: entries (client ids) whose remainder is protected by a fresh stop the stack placed.
  readonly freshStops = new Map<string, FreshStop>();
  // Ruling B of 2026-11-12: fresh stops that were not confirmed within 15 seconds (the stop's client id to its entry's). They are never
  // taken as protection again: if one shows up working later, its entry's missing-exit sale cancels it, waits for Alpaca's cancel, sells.
  readonly timedOutStops = new Map<string, string>();
  // Group 1, round 3 of the night release (Michael's decision 1 of 2026-11-13): timed-out fresh stops (client ids) whose cancel Alpaca has
  // already accepted once. If such a stop still holds the shares at a later try, the cancel is sent again only on the stuck backoff
  // (5, 10, 20, then every 30 seconds), a P1 try of the shared request budget, like a refused cancel: never every second.
  readonly timedOutCancelAccepted = new Set<string>();
  // Group 1, round 5 of the night release: when the live update said a timed-out stop ended (the stop's client id to the time). A sale of
  // its entry that was running then does not back off afterwards (it would undo the update's "sell now"): it is due again at once. This
  // fires once per stop end, because only an end at or after that try's start counts.
  readonly timedOutEndedAt = new Map<string, number>();
  // Michael's item 1 of 2026-11-13 (afternoon): entries (client ids) whose stop cancel Alpaca's live update reported complete, with its
  // time; set by the worker, dropped when the entry closes. Also: entries whose list lag was already logged (once each).
  readonly liveStopCancelled = new Map<string, number>();
  readonly listLagLogged = new Set<string>();
  // Group 2, round 4 of the weekend build: the quick rechecks while the list still shows such a stop open (per entry), and the entries whose
  // list clearing was logged.
  readonly liveLagTries = new Map<string, number>();
  readonly listClearLogged = new Set<string>();
  // Logging only (group 2, round 5): when a sync last saw such a stop still open (a lower bound on the list's lag).
  readonly liveLagLastOpen = new Map<string, number>();
  // The redesign of 2026-11-14, part 1: the quick list-lag recheck the last sync asked for (when it is due, its most requests, and the end
  // of the last lagging remainder's 30 second window). Read only by a sync run without the protection loop (the risk tests); with the loop the walk asks the loop for a list-lag wake instead,
  // (nothing is charged before it runs, so nothing is given back); with no room it waits for room, until `until`.
  lagRecheck: { dueAt: number; cost: number; until: number } | undefined = undefined;
  // The redesign of 2026-11-14, part 2: the pages of the order list the last sync read (a list-lag look's cost is sized from it).
  lastListPages = 1;
  // Item 3 of 2026-11-13: the wait after a failed lookup of an entry missing from Alpaca's listing (per entry, doubling to a minute).
  readonly lookupFailDelay = new Map<string, number>();
  readonly lookupFailUntil = new Map<string, number>();
  // Item 2 of 2026-11-13: per timed-out stop (client id), when its status is next checked, and when its cancel may next be sent again
  // while it is known open (on the stuck backoff's steps: 5, 10, 20, then every 30 seconds).
  // `probeFailed`: the last status check could not be read (the next one waits on the backoff).
  // `probeFailDelayMs`: after a failed check the next one waits longer (doubling from the normal interval, at most a minute), so failed
  // checks do not take the shared budget's room from the sale's tries.
  // `roomWaits` (the redesign, group 2 round 2): checks or cancels refused for lack of room in a row (their wait grows).
  readonly timedOutCheck = new Map<string, { probeAt: number; resendAt: number; resendDelayMs: number; probeFailed: boolean; probeFailDelayMs: number; roomWaits?: number }>();
  // Item 2 of 2026-11-13, second point: the start-up protection check (once per process, retried on a backoff until it succeeds), and the
  // timed-out stops written to the database (control key `timed_out_stops:<date>`) so a restart keeps them.
  startupChecked = false;
  // Group 1, round 2 of the weekend build: the stored list and Alpaca's check are done separately (a database down at a restart does not
  // stop the check of Alpaca), and the stored list is never written before it has been read (it would be overwritten).
  storedLoaded = false;
  alpacaChecked = false;
  startupStoredCount = 0; // logging only: what the parts found, whichever try did them
  startupUnconfirmed = 0;
  startupCheckAt = 0;
  startupDelayMs = 0;
  timedOutDirty = false;
  persistAt = 0;
  persistDelayMs = 0;
}

export const timedOutStopsKey = (tradeDate: string): string => `timed_out_stops:${tradeDate}`;
// Rule 6 (Michael, 2026-11-13): the start-up check and the database write are retried on a backoff (5 s doubling, at most a minute).
const START_RETRY_FIRST_MS = 5_000;
const START_RETRY_MAX_MS = 60_000;
const FAR_PAST_ISO = "2000-01-01T00:00:00Z";

// Item 2 of 2026-11-13 (Michael: "Store timed-out stop state in the database. At start-up, check every open position's protection at
// Alpaca, and treat any fresh stop not confirmed working as unprotected (the B path)."). Once per process, with ruling B on: the stops
// stored for today are loaded; Alpaca's open orders are read; for every position held, each fresh stop of ours (cyrus-p-) on its symbol
// is confirmed working when Alpaca shows it working (not pending cancel) and covering the whole holding, and is then remembered as the
// entry's fresh stop; one Alpaca shows pending cancel is a timed-out stop (the B path: its cancel waited for, then the shares sold). Only a
// symbol held by one open entry is checked (a fresh stop is placed only then, so the entry is known); a working stop covering part of the
// holding is left as it is. Any later read showing a fresh stop working (the sync's list, the sale's own read) confirms it too, and a stop
// pending cancel does not count as a working sell in the sync's walk (syncOrders). A failure is retried on the backoff; the stored list
// and Alpaca's check are done separately, and each is tried until it succeeds.
async function startupProtectionCheck(d: RiskDeps, mem: SyncMemory, tradeDate: string, positions: readonly { symbol: string; qty: number }[], latestPerSymbol: ReadonlyMap<string, OrderRecord>, openEntries: ReadonlyMap<string, number>, nowMs: number): Promise<void> {
  if (mem.startupChecked || nowMs < mem.startupCheckAt) return;
  let failed: string | null = null;
  let storedCount = 0;
  let added = 0;
  if (!mem.storedLoaded) {
    try {
      const stored = await d.store.getControl<{ stops?: Array<[string, string]> }>(timedOutStopsKey(tradeDate));
      for (const [stop, entry] of stored?.stops ?? []) {
        if (!mem.timedOutStops.has(stop)) mem.timedOutStops.set(stop, entry);
        // A timed-out stop the sale re-adopted before this read is not protection (ruling B: never taken as protection again).
        for (const [e, f] of [...mem.freshStops]) if (f.stopClientOrderId === stop) mem.freshStops.delete(e);
      }
      storedCount = stored?.stops?.length ?? 0;
      mem.startupStoredCount = storedCount;
      mem.storedLoaded = true;
      if (mem.timedOutStops.size > storedCount) mem.timedOutDirty = true; // stops timed out before the read are written with the loaded ones
    } catch (err) {
      failed = `stored list: ${(err as Error).message.slice(0, 120)}`;
    }
  }
  if (!mem.alpacaChecked) {
    try {
      const open = await d.broker.listOrdersPaged("open", FAR_PAST_ISO, 5);
      if (!open.complete) throw new Error("the list of open orders is longer than I can read");
      for (const p of positions) {
        const entry = latestPerSymbol.get(p.symbol);
        if (!entry || (openEntries.get(p.symbol) ?? 0) !== 1) continue;
        for (const x of open.orders.filter((o) => o.symbol === p.symbol && o.side === "sell" && o.clientOrderId.startsWith("cyrus-p-"))) {
          if (mem.timedOutStops.has(x.clientOrderId)) continue;
          const covers = x.qty - x.filledQty >= p.qty - 1e-9;
          const working = x.status !== "pending_cancel";
          if (working && covers && !mem.freshStops.has(entry.clientOrderId)) {
            mem.freshStops.set(entry.clientOrderId, { symbol: p.symbol, entryClientOrderId: entry.clientOrderId, stopClientOrderId: x.clientOrderId, orderId: x.id, qty: x.qty - x.filledQty, stopPrice: x.stopPrice ?? 0, placedAt: nowMs, status: x.status, lookedAt: nowMs });
            d.log?.("startup_fresh_stop_confirmed", { symbol: p.symbol, clientOrderId: entry.clientOrderId, stopClientOrderId: x.clientOrderId, status: x.status });
          } else if (!working) {
            mem.timedOutStops.set(x.clientOrderId, entry.clientOrderId);
            added++;
            d.log?.("startup_fresh_stop_unconfirmed", { symbol: p.symbol, clientOrderId: entry.clientOrderId, stopClientOrderId: x.clientOrderId, status: x.status, coversHolding: covers });
          }
        }
      }
      if (added > 0) mem.timedOutDirty = true;
      mem.startupUnconfirmed = added;
      mem.alpacaChecked = true;
    } catch (err) {
      failed = `${failed ? `${failed}; ` : ""}Alpaca: ${(err as Error).message.slice(0, 120)}`;
    }
  }
  if (failed === null) {
    mem.startupChecked = true;
    d.log?.("startup_protection_check", { positions: positions.length, storedTimedOut: mem.startupStoredCount, unconfirmed: mem.startupUnconfirmed });
    return;
  }
  mem.startupDelayMs = mem.startupDelayMs > 0 ? Math.min(mem.startupDelayMs * 2, START_RETRY_MAX_MS) : START_RETRY_FIRST_MS;
  mem.startupCheckAt = nowMs + mem.startupDelayMs;
  d.log?.("startup_protection_check_failed", { error: failed, retryInMs: mem.startupDelayMs, storedLoaded: mem.storedLoaded, alpacaChecked: mem.alpacaChecked });
}

// Item 2 of 2026-11-13: today's timed-out stops written to the database when they change; a failed write is retried on the backoff.
async function persistTimedOutStops(d: RiskDeps, mem: SyncMemory, tradeDate: string, nowMs: number): Promise<void> {
  if (!mem.timedOutDirty || nowMs < mem.persistAt || !mem.storedLoaded) return;
  try {
    await d.store.setControl(timedOutStopsKey(tradeDate), { stops: [...mem.timedOutStops] });
    mem.timedOutDirty = false;
    mem.persistDelayMs = 0;
  } catch (err) {
    mem.persistDelayMs = mem.persistDelayMs > 0 ? Math.min(mem.persistDelayMs * 2, START_RETRY_MAX_MS) : START_RETRY_FIRST_MS;
    mem.persistAt = nowMs + mem.persistDelayMs;
    d.log?.("timed_out_stops_save_failed", { error: (err as Error).message.slice(0, 160), retryInMs: mem.persistDelayMs });
  }
}

// Ruling B (the worker's live update, onFreshStopUpdate): a timed-out fresh stop ended at Alpaca. Its entry's sale is due now (no new
// request), the resting-stop note is dropped, and a sale of that entry still running will not back off afterwards.
export function noteTimedOutStopEnded(mem: SyncMemory, stopClientOrderId: string, nowMs: number): void {
  const entry = mem.timedOutStops.get(stopClientOrderId);
  if (!entry) return;
  mem.timedOutEndedAt.set(stopClientOrderId, nowMs);
  const st = mem.stuck.get(entry);
  if (st) {
    st.nextAt = 0;
    st.why = "its fresh stop (not confirmed in time) has ended at Alpaca; the sale is due"; // messaging only
    delete st.restingStop; // messaging only: the 5 minute alert no longer says the stop rests at Alpaca
  }
}

// A4 of the proposal of 2026-11-12 (Michael's approval): after a partial take-profit, Alpaca cancels the bracket's stop on the first share
// sold (436 of 436 cases this week). The stack then cancels the take-profit's rest at once and places a fresh stop sell for the shares
// left, at the bracket's own stop price. The remainder ends at that stop or at the next close-out (Michael's option a): no new take-profit.
export interface FreshStop {
  symbol: string;
  entryClientOrderId: string;
  stopClientOrderId: string;
  orderId: string | null;
  qty: number;
  stopPrice: number;
  placedAt: number;
  // Alpaca's last known status of the fresh stop ("unclear" while its first answer was unclear and it has not been looked up yet).
  status: string;
  lookedAt: number;
  // The redesign of 2026-11-14 (group 1, round 1, B3): when its last lookup found no room in the shared request budget, the moment room
  // may return (the next look is scheduled then, never after the 15 second limit). Scheduling only.
  lookRoomAt?: number;
  // Lookups refused in a row (the next waits 0.5, 1, 2, then 4 s at least: a backoff, rule 6); reset by a lookup that ran.
  lookWaits?: number;
}
// The fresh stop's status comes from the sync's own order list when it is there (any sell working on the symbol already keeps the
// missing-exit check away), else from the live order updates; this often it is also looked up by its client id (one request), and at
// every such sync while the live updates are down or its first answer was unclear.
export const FRESH_STOP_LOOKUP_MS = 30_000;
// Michael's ruling B of 2026-11-12: a fresh stop whose first answer was unclear is looked up every 5 seconds (the entry is looked at again that
// soon while one is unclear), and if it is still unclear 15 seconds after it was sent, the remainder is treated as unprotected: the stop
// is looked up by its client id and cancelled if Alpaca has it, the sale waits for that cancel, and the shares are sold through the
// checked sell path, with an alert to Michael at once and one line when it resolves.
export const FRESH_STOP_UNCLEAR_LOOKUP_MS = 5_000;
export const FRESH_STOP_CONFIRM_MS = 15_000;
// Michael's decision 2 of 2026-11-13 (the split, pre-approved): the one switch for ruling B's 15 second limit and 5 second lookups. Off
// (false), an unclear fresh stop is handled as on Fly release v20: looked up at each sync, never cancelled by a time limit, never sold on
// top of. The time-to-confirm logging of a confirmed stop stays (logging only). The switch is `on` below (an object so the tests can
// check both states; nothing in the worker changes it).
export const FRESH_STOP_LIMIT = { on: true };

// A fresh stop's status from the order list, a lookup or a live update. When it was "unclear", its time to confirm (from when it was
// sent) is logged, so the share confirmed after 15 seconds can be reported (ruling B). "unknown_at_alpaca": Alpaca does not have it.
export function settleFreshStop(log: ((event: string, data?: Record<string, unknown>) => void) | undefined, f: FreshStop, status: string, by: string, nowMs: number): void {
  const was = f.status;
  f.status = status;
  f.lookedAt = nowMs;
  if (was === "unclear" && status !== "unclear") log?.("fresh_stop_confirmed", { symbol: f.symbol, clientOrderId: f.entryClientOrderId, stopClientOrderId: f.stopClientOrderId, status, by, found: status !== "unknown_at_alpaca", msToConfirm: nowMs - f.placedAt, afterLimit: nowMs - f.placedAt >= FRESH_STOP_CONFIRM_MS });
}

// Forgets an entry's fresh stop. Group 2, round 1 of the night release: one that was still unclear gets its outcome logged
// (`fresh_stop_unclear_end`), so every unclear fresh stop ends in exactly one of fresh_stop_confirmed, fresh_stop_timeout or this.
function dropFreshStop(d: RiskDeps, mem: SyncMemory, entryClientOrderId: string, how: string, nowMs: number): void {
  const f = mem.freshStops.get(entryClientOrderId);
  if (!f) return;
  mem.freshStops.delete(entryClientOrderId);
  if (f.status === "unclear") d.log?.("fresh_stop_unclear_end", { symbol: f.symbol, clientOrderId: entryClientOrderId, stopClientOrderId: f.stopClientOrderId, how, msFromSent: nowMs - f.placedAt });
}

// True while the fresh stop can still protect its remainder. Its status is taken from the sync's own order list when it is there, else
// from the live updates, else looked up. A failed look keeps what was known (an unclear stop counts as live, so no sale goes on top).
// The redesign of 2026-11-14, part 1 (behaviour item 4): the lookup is a try of the shared request budget (1 request); with no room it is
// not made this sync, and what was known is kept. Michael's ruling 2 of 2026-11-14 (night): an unclear stop's lookup is class P1 (urgent
// work, which may go down to Alpaca's remaining of 20: it is about shares without a confirmed stop, and the 15 second limit otherwise sells
// shares whose stop Alpaca may hold); a confirmed stop's periodic lookup stays P2.
async function freshStopLive(d: RiskDeps, mem: SyncMemory, f: FreshStop, listed: Order[], nowMs: number, streamLive: boolean, syncReads = 2): Promise<boolean> {
  const inList = listed.find((x) => x.clientOrderId === f.stopClientOrderId);
  if (inList) {
    f.orderId = inList.id;
    settleFreshStop(d.log, f, inList.status, "order list", nowMs);
  } else if (f.status === "unclear" || !streamLive || nowMs - f.lookedAt >= FRESH_STOP_LOOKUP_MS) {
    // An unclear stop's lookup (P1) is tried again when there is room; a confirmed stop's periodic lookup (P2) simply waits for the next sync.
    const cls = f.status === "unclear" ? "P1" : "P2";
    const r = budgetOf(d, mem).tryReserve(cls, 1, { label: "fresh stop lookup" });
    // Group 1, round 1 of the redesign (B3), with the builder's check after it: the sync that comes for the next try reads the order list
    // and the positions first (routine work from the same bucket), so the next try waits until there is room for those reads and the lookup
    // together, and at least 0.5, 1, 2, then 4 s after refusals in a row (rule 6). A lookup that runs resets it.
    if (!(r instanceof Reservation)) {
      f.lookWaits = (f.lookWaits ?? 0) + 1;
      f.lookRoomAt = roomWaitUntil(d, mem, cls, 1, f.lookWaits, nowMs, syncReads);
      // Stored once per wait (the first refusal in a row), not at every sync (group 2, round 2).
      if (f.lookWaits === 1) d.log?.("fresh_stop_lookup_skipped", { symbol: f.symbol, stopClientOrderId: f.stopClientOrderId, why: r.why, roomInMs: r.at - nowMs, status: f.status });
    } else {
      f.lookRoomAt = undefined;
      f.lookWaits = 0;
      await withReservation(r, async () => {
      try {
        const x = await d.broker.findOrderByClientId(f.stopClientOrderId);
        if (x) f.orderId = x.id;
        settleFreshStop(d.log, f, x ? x.status : "unknown_at_alpaca", "lookup", nowMs);
      } catch (err) {
        d.log?.("fresh_stop_lookup_failed", { symbol: f.symbol, error: (err as Error).message.slice(0, 120) });
      }
      });
    }
  }
  return OPEN_STATUSES.has(f.status) || f.status === "unclear";
}

// Ruling B: true when the entry has a fresh stop that hit the 15 second limit.
const hasTimedOut = (mem: SyncMemory, entryClientOrderId: string): boolean => [...mem.timedOutStops.values()].includes(entryClientOrderId);
// The backoff's longest step: 30 seconds, or 10 for an entry with a timed-out stop while the live updates are down (item 2, first point).
const backoffCap = (mem: SyncMemory, entryClientOrderId: string): number => (!mem.streamLive && hasTimedOut(mem, entryClientOrderId) ? STUCK_RETRY_MAX_NO_STREAM_MS : STUCK_RETRY_MAX_MS);
const fallbackSync = new SyncMemory();

// An entry whose stop is no longer live (cancelled or expired, not filled) while some of its shares are not sold yet: those shares
// have no stop, even if the take-profit is still open. Null when the stop is live, filled, absent, or nothing is left.
// Michael's item 1 of 2026-11-13 (afternoon): `liveCancelledAtMs`, when Alpaca's live update has reported this entry's stop cancel as
// complete (event "canceled"), while the order list Alpaca serves may still show the stop open (pending cancel) for several seconds (7 of
// 34 remainders waited 11 to 16 s on 2026-11-13). The live update is taken over the lagging list. The sell gate still counts any sell the
// list shows as open, so no sale or fresh stop can go on top of shares a stop still holds.
export function bareRemainder(o: Order, liveCancelledAtMs?: number): { shares: number; stop: Order; liveCancel: boolean } | null {
  const stop = stopLeg(o);
  if (!stop || stop.filledQty > 0) return null;
  const liveCancel = OPEN_STATUSES.has(stop.status) && liveCancelledAtMs !== undefined;
  if (OPEN_STATUSES.has(stop.status) && !liveCancel) return null;
  const left = o.filledQty - exitFilledQty(o);
  return left > 1e-9 ? { shares: left, stop, liveCancel } : null;
}

// A live exit leg of an entry: a sell leg that can still execute.
export const hasLiveExit = (o: Order): boolean => flattenLegs(o).some((l) => l.side === "sell" && OPEN_STATUSES.has(l.status));
const exitFilledQty = (o: Order): number => flattenLegs(o).filter((l) => l.side === "sell").reduce((n, l) => n + l.filledQty, 0);

// Kept for older callers and tests: the protective stop leg, if Alpaca shows one.
export function stopLeg(o: Order): Order | undefined {
  return o.legs.find((l) => l.side === "sell" && (l.type === "stop" || l.stopPrice !== null));
}

export interface SyncOptions {
  // False while a close-out is running or after the close-out time: the missing-exit check is skipped and NO sell is
  // placed. The close-out alone flattens the account. (On 2026-11-02 this check sold five positions the close-out had
  // just un-protected on purpose, and raised five false alarms.)
  // A function is asked again just before each sale, so a close-out that starts while the sync is running switches it off.
  protect: boolean | (() => boolean);
  // The speed release, item 3: true while Alpaca's live order updates are connected; then only the last 10 minutes are read.
  streamLive?: boolean;
  // Michael's decision of 2026-11-09 ("Mid-day owns it"): true while the mid-day close-out is selling (10:30 until flat). Its own two
  // alerts (not flat yet, and 5 minutes later) cover those positions, so the stuck-entry 5 minute alert stands aside meanwhile.
  middayOwnsSelling?: () => boolean;
  // The redesign of 2026-11-14, part 2: the protection loop (protection.ts). The walk hands each entry's action (a sale, a fresh stop, the 15
  // second limit's work) to it and carries on, and asks it for a wake instead of a sync. Without one (a sync run on its own, as in the risk
  // tests), an inline loop runs each action as the walk reaches it and gathers the wakes into `recheckAt`, as before.
  loop?: ProtectionHooks;
  // A look of the loop: only these entries are walked and looked up; everything else (which entries are open, the newest per symbol, what is
  // forgotten) is still worked out from every open entry.
  only?: ReadonlySet<string>;
}

// Updates stored entries from Alpaca by looking only at orders newer than the oldest entry still being watched
// (paged, so a day with thousands of orders is read in full). An entry is judged by its OWN order and its OWN exit
// legs, never by symbol, because a symbol can be entered again after the first position closed.
// An open entry with no live exit while its position is still held is sold at once and reported.
// Release A: `recheckAt` is the earliest moment a bare remainder (fix 1) reaches its grace time; the worker runs the next sync then.
export async function syncOrders(d: RiskDeps, day: DayRecord, opts: SyncOptions = { protect: true }): Promise<{ unprotected: string[]; incomplete: boolean; recheckAt?: number }> {
  const mem = d.syncMemory ?? fallbackSync;
  mem.streamLive = opts.streamLive === true;
  // The redesign of 2026-11-14, group 1 round 1 (rule 6): a list-lag recheck is asked for afresh by each sync's walk (at its end); one the
  // last sync asked for is dropped here, so a sync that returns early (no open entry) or fails never leaves a stale recheck to fire again.
  mem.lagRecheck = undefined;
  // Logging only (Michael's approval of 2026-11-10): what this sync did before it reached an entry noticed late.
  const syncStartMs = d.now().getTime();
  // Michael's item 4 of 2026-11-13 (afternoon), logging only: the time of each step of this sync, logged (and stored) when the sync took
  // SLOW_SYNC_MS or more, so a slow sync can be diagnosed.
  const steps: Record<string, number> = {};
  let stepFrom = syncStartMs;
  const mark = (name: string): void => {
    const t = d.now().getTime();
    steps[name] = (steps[name] ?? 0) + (t - stepFrom);
    stepFrom = t;
  };
  const prevSyncEndedAt = mem.lastSyncAt;
  const mustLookAtStart = new Set(mem.mustLook);
  const lookedUp = new Set<string>();
  let cleanupsThisSync = 0;
  let cleanupMsThisSync = 0;
  // Michael's approval C of 2026-11-12: the index's still-working set, oldest first as before (the walk keeps that order).
  const active = await activeOrdersOldestFirst(d.store, day.tradeDate);
  if (active.length === 0) {
    await settleAwaiting(d, mem, null, new Set());
    // Group 2 review, round 1: an entry reported stuck whose record was closed elsewhere (the live updates close a record when an exit
    // fill leaves the symbol flat) still gets its one resolution line.
    // The redesign of 2026-11-14, part 2 (group 2, round 1): not while the entry's own action runs (it resolves the record itself, with the
    // right line; otherwise the first sync after it ends does), so one resolution never posts two lines.
    for (const id of [...mem.stuck.keys()]) if (!opts.loop?.busy(id)) await resolveStuck(d, mem, id, "no longer held");
    mem.bareSeen.clear();
    mem.lastSeen.clear();
    for (const id of [...mem.freshStops.keys()]) dropFreshStop(d, mem, id, "its entry is no longer open", syncStartMs);
    mem.lastSyncAt = d.now().getTime();
    return { unprotected: [], incomplete: false };
  }
  const activeIds = new Set(active.map((o) => o.clientOrderId));
  for (const id of [...mem.lastSeen.keys()]) if (!activeIds.has(id)) mem.lastSeen.delete(id);
  for (const id of [...mem.oldLookedAt.keys()]) if (!activeIds.has(id)) mem.oldLookedAt.delete(id);
  for (const id of [...mem.mustLook]) if (!activeIds.has(id)) mem.mustLook.delete(id);
  for (const id of [...mem.lateLogged]) if (!activeIds.has(id)) mem.lateLogged.delete(id);
  for (const id of [...mem.liveStopCancelled.keys()]) if (!activeIds.has(id)) mem.liveStopCancelled.delete(id);
  for (const id of [...mem.listLagLogged]) if (!activeIds.has(id)) mem.listLagLogged.delete(id);
  for (const id of [...mem.liveLagTries.keys()]) if (!activeIds.has(id)) mem.liveLagTries.delete(id);
  for (const id of [...mem.listClearLogged]) if (!activeIds.has(id)) mem.listClearLogged.delete(id);
  for (const id of [...mem.liveLagLastOpen.keys()]) if (!activeIds.has(id)) mem.liveLagLastOpen.delete(id);
  for (const id of [...mem.freshStops.keys()]) if (!activeIds.has(id)) dropFreshStop(d, mem, id, "its entry is no longer open", syncStartMs);
  for (const id of [...mem.stuck.keys()]) if (!activeIds.has(id) && !opts.loop?.busy(id)) await resolveStuck(d, mem, id, "no longer held");
  const midnight = etInstant(day.tradeDate, "00:00").getTime();
  const nowMs = d.now().getTime();
  const createdMs = (o: OrderRecord) => (o.createdAt ? new Date(o.createdAt).getTime() : midnight);
  const oldest = Math.min(...active.map(createdMs));
  const fromMs = Math.max(midnight, oldest - 60_000, opts.streamLive ? nowMs - RECENT_WINDOW_MS : midnight);
  const since = new Date(fromMs).toISOString();
  mark("store");
  const [listed, positions] = await Promise.all([d.broker.listOrdersPaged("all", since, opts.streamLive ? RECENT_MAX_PAGES : 20), d.broker.listPositions()]);
  mark("orderListAndPositions");
  // Logging only (Michael's decision of 2026-11-09): how old this order list and these positions are when the sync acts on them.
  const listedAtMs = d.now().getTime();
  const listAgeMs = () => d.now().getTime() - listedAtMs;
  const byClientId = new Map(listed.orders.map((o) => [o.clientOrderId, o]));
  // Fix C of 2026-11-10: a sale reported as "not filled yet" that has now filled gets its closing line.
  await settleAwaiting(d, mem, listed.orders, activeIds);
  mark("settleAwaiting");
  // Item 3: open entries made before the window read above are looked up by id, a few per sync, oldest look first.
  if (opts.streamLive) {
    const older = active.filter((s) => createdMs(s) < fromMs && !byClientId.has(s.clientOrderId) && (!opts.only || opts.only.has(s.clientOrderId)));
    const must = older.filter((s) => mem.mustLook.has(s.clientOrderId));
    const due = older.filter((s) => !mem.mustLook.has(s.clientOrderId) && nowMs - (mem.oldLookedAt.get(s.clientOrderId) ?? 0) >= OLD_LOOKUP_EVERY_MS);
    due.sort((a, b) => (mem.oldLookedAt.get(a.clientOrderId) ?? 0) - (mem.oldLookedAt.get(b.clientOrderId) ?? 0) || createdMs(a) - createdMs(b));
    const budget = Math.max(OLD_LOOKUPS_PER_SYNC, Math.ceil(older.length / 3));
    for (const s of [...must, ...due.slice(0, budget)]) {
      mem.oldLookedAt.set(s.clientOrderId, nowMs);
      mem.mustLook.delete(s.clientOrderId);
      try {
        const found = await d.broker.findOrderByClientId(s.clientOrderId);
        if (found) {
          byClientId.set(s.clientOrderId, found);
          lookedUp.add(s.clientOrderId);
        }
      } catch (err) {
        d.log?.("order_lookup_failed", { clientOrderId: s.clientOrderId, error: (err as Error).message.slice(0, 120) });
      }
    }
  }
  mark("olderLookups");
  // Release A, fix 4: on 2026-11-04 Alpaca's listing left out 2 of the day's entries. An entry that should be at Alpaca but is
  // missing from the listing is fetched by its client id, so it still gets its record update and its missing-exit check. (An entry
  // older than the window read above is not "missing": item 3's lookups above take care of it.)
  let lookups = 0;
  // Decision 1 of 2026-11-06: an entry the live updates just reported (both exits lost, or an exit ended) is looked up first, so it
  // is never left behind the other missing entries on a busy day.
  const lookupOrder = [...active].sort((a, b) => Number(mem.mustLook.has(b.clientOrderId)) - Number(mem.mustLook.has(a.clientOrderId)));
  for (const s of lookupOrder) {
    if (byClientId.has(s.clientOrderId) || lookups >= MISSING_LOOKUPS_PER_SYNC) continue;
    if (opts.only && !opts.only.has(s.clientOrderId)) continue;
    if (createdMs(s) < fromMs) continue;
    const age = s.createdAt ? nowMs - new Date(s.createdAt).getTime() : Infinity;
    if (!(s.status === "submitted" || s.status === "filled" || (s.status === "intent" && age > MISSING_INTENT_AGE_MS))) continue;
    if ((mem.notFoundUntil.get(s.clientOrderId) ?? 0) > nowMs) continue;
    // A failed lookup's wait (item 3 of 2026-11-13) does not hold back an entry a live update has just flagged.
    if ((mem.lookupFailUntil.get(s.clientOrderId) ?? 0) > nowMs && !mem.mustLook.has(s.clientOrderId)) continue;
    lookups++;
    mem.mustLook.delete(s.clientOrderId);
    try {
      const found = await d.broker.findOrderByClientId(s.clientOrderId);
      if (found) {
        byClientId.set(s.clientOrderId, found);
        lookedUp.add(s.clientOrderId);
      } else mem.notFoundUntil.set(s.clientOrderId, nowMs + MISSING_RETRY_MS);
      mem.lookupFailDelay.delete(s.clientOrderId);
      d.log?.("order_missing_from_listing", { clientOrderId: s.clientOrderId, found: found !== null });
    } catch (err) {
      // Item 3 of 2026-11-13 (Michael's retry rule): a lookup that failed waits 10 seconds, doubling to 60, before it is tried again.
      const delay = Math.min((mem.lookupFailDelay.get(s.clientOrderId) ?? 5_000) * 2, MISSING_RETRY_MS);
      mem.lookupFailDelay.set(s.clientOrderId, delay);
      mem.lookupFailUntil.set(s.clientOrderId, nowMs + delay);
      d.log?.("order_lookup_failed", { clientOrderId: s.clientOrderId, error: (err as Error).message.slice(0, 120), retryInMs: delay });
    }
  }
  mark("missingLookups");
  const held = new Set(positions.map((p) => p.symbol));
  let recheckAt: number | undefined;
  // Logging only (Michael's approval of 2026-11-10): an entry whose stop (or both exits) Alpaca cancelled more than LATE_NOTICE_MS ago.
  const lateNotice = (s: OrderRecord, kind: "missing" | "bare", cancelledAt: string | null, extra: Record<string, unknown> = {}) => {
    // Group 2 review, round 1: once per entry, and never for an entry already reported stuck (its retries go down the missing-exit
    // path measured from the take-profit cancel our own cleanup made, which is not a late notice).
    if (mem.stuck.has(s.clientOrderId) || mem.lateLogged.has(s.clientOrderId)) return;
    const t = cancelledAt ? Date.parse(cancelledAt) : NaN;
    const at = d.now().getTime();
    if (!Number.isFinite(t) || at - t <= LATE_NOTICE_MS) return;
    mem.lateLogged.add(s.clientOrderId);
    let ctx: Record<string, unknown> = {};
    try {
      ctx = d.lateNoticeContext?.(s.symbol) ?? {};
    } catch {
      /* logging must never break the sync */
    }
    d.log?.("late_notice", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, lagMs: at - t, cancelledAt, syncStartedAgoMs: at - syncStartMs, gapSincePreviousSyncMs: prevSyncEndedAt > 0 ? syncStartMs - prevSyncEndedAt : null, cleanupsEarlierThisSync: cleanupsThisSync, cleanupMsThisSync, foundBy: lookedUp.has(s.clientOrderId) ? "lookup" : "listing", mustLook: mustLookAtStart.has(s.clientOrderId), listAgeMs: listAgeMs(), streamLive: opts.streamLive === true, ...extra, ...ctx });
  };
  const timedCleanup = async (...args: Parameters<typeof cleanupSale>) => {
    const t0 = d.now().getTime();
    try {
      return await cleanupSale(...args);
    } finally {
      cleanupsThisSync++;
      cleanupMsThisSync += d.now().getTime() - t0;
    }
  };
  const latestPerSymbol = new Map<string, OrderRecord>();
  for (const s of active) {
    const prev = latestPerSymbol.get(s.symbol);
    if (!prev || (s.createdAt ?? "") > (prev.createdAt ?? "") || ((s.createdAt ?? "") === (prev.createdAt ?? "") && s.clientOrderId > prev.clientOrderId)) latestPerSymbol.set(s.symbol, s);
  }
  // Item 2 of 2026-11-13: the start-up protection check (ruling B on), once per process until it has succeeded.
  if (FRESH_STOP_LIMIT.on) {
    const openEntries = new Map<string, number>();
    for (const s of active) openEntries.set(s.symbol, (openEntries.get(s.symbol) ?? 0) + 1);
    // A first try (the redesign of 2026-11-14): counted, never refused; never charged to a recheck's reservation.
    if (!mem.startupChecked) await withReservation(budgetOf(d, mem).first("start-up protection check"), () => startupProtectionCheck(d, mem, day.tradeDate, positions, latestPerSymbol, openEntries, nowMs), "first");
  }
  mark("startupCheck");
  // A sell already working on a symbol (a liquidation in progress) explains a missing exit: no false alarm.
  // A4 (group 1 review, round 2): a fresh stop of ours (cyrus-p-) counts only when it covers the symbol's whole holding (it is placed only
  // when its entry holds the whole symbol). With another position on the symbol it protects only its own shares, so it must not keep the
  // check away from the other position.
  const heldQty = new Map(positions.map((p) => [p.symbol, p.qty]));
  mem.protectFirst?.positionsRead(heldQty, syncStartMs);
  // Ruling B (group 1, round 2 of the night release): a fresh stop that hit the 15 second limit never counts here (it is not protection and
  // not a sale of ours): the walk reaches its entry, whose missing-exit sale cancels it, waits for Alpaca's cancel and sells.
  const sellingSymbols = new Set(listed.orders.filter((x) => x.side === "sell" && OPEN_STATUSES.has(x.status) && !mem.timedOutStops.has(x.clientOrderId) && (!x.clientOrderId.startsWith("cyrus-p-") || (!(FRESH_STOP_LIMIT.on && x.status === "pending_cancel") && x.qty - x.filledQty >= (heldQty.get(x.symbol) ?? 0) - 1e-9))).map((x) => x.symbol));
  const unprotected: string[] = [];
  // Item 2 of 2026-11-13 (group 1, round 1 of the weekend build): a timed-out stop the sync's own list shows ended is noted before the
  // 5 minute alerts below, so they never give an older reason; its entry's sale is then tried in the walk.
  if (FRESH_STOP_LIMIT.on) {
    for (const [stop, entry] of mem.timedOutStops) {
      if (mem.timedOutEndedAt.has(stop)) continue;
      const shown = byClientId.get(stop) ?? listed.orders.find((x) => x.clientOrderId === stop);
      if (shown && !OPEN_STATUSES.has(shown.status)) {
        noteTimedOutStopEnded(mem, stop, nowMs);
        d.log?.("fresh_stop_timeout_ended", { symbol: shown.symbol, clientOrderId: entry, stopClientOrderId: stop, status: shown.status, by: "order list" });
      }
    }
  }
  // Michael's decision of 2026-11-09: the 5 minute alert goes by the clock, for every entry reported stuck, whether or not its retry
  // has had room yet.
  // Group 2, round 1 of the night release: a symbol the position list does not show is passed as 0 held (nothing left to protect).
  mark("timedOutEnds");
  // The redesign of 2026-11-14, part 2: not in a look of the loop for other entries, and not for an entry whose action is running (its try is
  // changing what the alert reads; the next sync looks again).
  if (!opts.middayOwnsSelling?.()) for (const id of [...mem.stuck.keys()]) {
    if ((opts.only && !opts.only.has(id)) || opts.loop?.busy(id)) continue;
    await escalateIfDue(d, mem, id, positions.find((p) => p.symbol === mem.stuck.get(id)?.symbol)?.qty ?? 0, listed.orders);
  }
  // Michael's decision of 2026-11-09: entries on the short retry list are walked last, longest waiting first, so the first one due
  // takes the shared budget's room and the others take turns (before, the same few won every minute).
  const shortRetry = (s: OrderRecord) => (mem.stuck.get(s.clientOrderId)?.nextAt ?? 0) > 0;
  // Ruling B of 2026-11-12: an unclear fresh stop that the sync's own order list shows is confirmed here, before the walk (the walk
  // skips a symbol with a working sell, which is how a resting fresh stop appears), so its time to confirm is logged and the 15 second
  // limit never cancels a stop Alpaca visibly holds.
  if (FRESH_STOP_LIMIT.on) for (const f of mem.freshStops.values()) {
    if (f.status !== "unclear") continue;
    const shown = listed.orders.find((x) => x.clientOrderId === f.stopClientOrderId);
    if (shown) {
      f.orderId = shown.id;
      settleFreshStop(d.log, f, shown.status, "order list", nowMs);
    }
  }
  mark("alerts");
  // Michael's change of 2026-11-13 (evening): one look serves every remainder whose list still lags (a list-lag wake of the loop; without the loop, gathered in `ctx.lag`).
  const walk = [...active.filter((s) => !shortRetry(s)), ...active.filter(shortRetry).sort((a, b) => mem.stuck.get(a.clientOrderId)!.lastTriedAt - mem.stuck.get(b.clientOrderId)!.lastTriedAt)];
  const ctx: WalkCtx = { d, day, mem, opts, nowMs, listed, held, heldQty, latestPerSymbol, sellingSymbols, lookedUp, listAgeMs, fromMs, createdMs, lateNotice, timedCleanup, unprotected, lag: { until: 0, lookups: 0 }, loop: undefined as unknown as ProtectionHooks };
  ctx.loop = opts.loop ?? inlineLoop(ctx);
  mem.lastListPages = Math.max(1, listed.pages);
  for (const s of walk) {
    if (opts.only && !opts.only.has(s.clientOrderId)) continue;
    const o = byClientId.get(s.clientOrderId);
    if (!o) continue;
    mem.lastSeen.set(s.clientOrderId, o);
    if (s.status === "intent" && o.status !== "filled" && o.status !== "canceled" && o.status !== "expired" && o.status !== "rejected") {
      await d.store.updateOrder(s.clientOrderId, { status: "submitted", alpacaOrderId: o.id, note: null });
    }
    if (o.status === "filled" && s.status !== "filled") {
      await d.store.updateOrder(s.clientOrderId, { status: "filled", filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id });
    } else if ((o.status === "canceled" || o.status === "expired") && o.filledQty === 0 && s.status !== "canceled") {
      await d.store.updateOrder(s.clientOrderId, { status: "canceled", alpacaOrderId: o.id });
    } else if ((o.status === "canceled" || o.status === "expired") && o.filledQty > 0 && s.status !== "filled") {
      // cancelled after a partial fill: what filled is a real position
      await d.store.updateOrder(s.clientOrderId, { status: "filled", filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id, note: "cancelled after a partial fill" });
    } else if (o.status === "partially_filled" && (s.filledQty ?? 0) !== o.filledQty) {
      await d.store.updateOrder(s.clientOrderId, { filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, alpacaOrderId: o.id });
    } else if (o.status === "rejected" && s.status !== "rejected") {
      await d.store.updateOrder(s.clientOrderId, { status: "rejected", alpacaOrderId: o.id, note: "rejected by Alpaca" });
      await d.say("commands", `Alpaca rejected the entry for ${s.symbol}.`);
    }
    if (!(o.filledQty > 0)) continue;
    // Closed: its exit leg has filled for the whole quantity, or the position is no longer held at all.
    // Closed: its exit leg has filled for the whole quantity, or the position is gone. "Gone" counts only when the entry order is
    // final (not still working at Alpaca) and its fill is clearly old: the orders and positions are read at nearly the same
    // moment, and an entry that fills between the two reads would otherwise look closed. An unknown fill time is treated as
    // recent unless the entry itself is more than a minute old.
    const orderFinal = o.status === "filled" || o.status === "canceled" || o.status === "expired";
    const ageMs = (iso: string | null) => (iso ? d.now().getTime() - new Date(iso).getTime() : null);
    const fillAge = ageMs(o.filledAt) ?? ageMs(s.createdAt ?? null);
    const goneForGood = !held.has(s.symbol) && orderFinal && fillAge !== null && fillAge > (o.filledAt ? 10_000 : 60_000);
    if (exitFilledQty(o) >= o.filledQty - 1e-9 || goneForGood) {
      await d.store.updateOrder(s.clientOrderId, { closedAt: d.now().toISOString() });
      (opts.loop as { forget?: (id: string) => void } | undefined)?.forget?.(s.clientOrderId);
      mem.bareSeen.delete(s.clientOrderId);
      mem.lastSeen.delete(s.clientOrderId);
      dropFreshStop(d, mem, s.clientOrderId, "its entry closed (its shares are gone)", nowMs);
      if (!opts.loop?.busy(s.clientOrderId)) await resolveStuck(d, mem, s.clientOrderId, "no longer held");
      continue;
    }
    await protectEntry(ctx, s, o);
  }
  // The redesign of 2026-11-14, part 1: the quick recheck is asked of the worker with its most requests (the order list's pages and the
  // positions as this sync read them, plus a lookup per lagging entry older than the list's window). Without the protection loop it is kept in `lagRecheck`; with the loop each lagging entry has a list-lag wake, and its
  // look runs inside a P2 reservation of that size, so it is charged when it runs, at what it really sends (nothing ahead, nothing to give
  // back). With no room it waits for room (entries give way while it waits on the floor of 80), until the last lagging remainder's 30
  // second window ends; after that the regular sync carries on.
  if (ctx.recheckAt !== undefined) recheckAt = recheckAt === undefined ? ctx.recheckAt : Math.min(recheckAt, ctx.recheckAt);
  if (ctx.lag.gap !== undefined) {
    const t = d.now().getTime();
    mem.lagRecheck = { dueAt: t + ctx.lag.gap, cost: Math.max(1, listed.pages) + 1 + ctx.lag.lookups, until: ctx.lag.until };
  } else mem.lagRecheck = undefined;
  mark("walk");
  if (!listed.complete) d.log?.("order_list_incomplete", { since, pages: listed.pages });
  if (FRESH_STOP_LIMIT.on) await persistTimedOutStops(d, mem, day.tradeDate, d.now().getTime());
  mark("save");
  const totalMs = d.now().getTime() - syncStartMs;
  if (totalMs >= SLOW_SYNC_MS) d.log?.("sync_slow", { totalMs, steps, active: active.length, listed: listed.orders.length, pages: listed.pages, cleanups: cleanupsThisSync, cleanupMs: cleanupMsThisSync, olderLookups: lookedUp.size, streamLive: opts.streamLive === true });
  mem.lastSyncAt = d.now().getTime();
  return { unprotected, incomplete: !listed.complete, ...(recheckAt !== undefined ? { recheckAt } : {}) };
}

// What the order sync's walk knows when it comes to an entry's protection (the redesign of 2026-11-14, part 2, step 1: the walk's reads and
// its decision for one entry are apart, with no change in behaviour). `unprotected`, the earliest recheck asked for and the list-lag recheck
// are gathered here for the sync's result.
interface WalkCtx {
  d: RiskDeps;
  day: DayRecord;
  mem: SyncMemory;
  opts: SyncOptions;
  nowMs: number;
  listed: { orders: Order[]; pages: number; complete: boolean };
  held: ReadonlySet<string>;
  heldQty: ReadonlyMap<string, number>;
  latestPerSymbol: ReadonlyMap<string, OrderRecord>;
  sellingSymbols: ReadonlySet<string>;
  lookedUp: ReadonlySet<string>;
  listAgeMs: () => number;
  fromMs: number;
  createdMs: (o: OrderRecord) => number;
  lateNotice: (s: OrderRecord, kind: "missing" | "bare", cancelledAt: string | null, extra?: Record<string, unknown>) => void;
  timedCleanup: (...args: Parameters<typeof cleanupSale>) => ReturnType<typeof cleanupSale>;
  unprotected: string[];
  recheckAt?: number;
  lag: { gap?: number; until: number; lookups: number };
  loop: ProtectionHooks;
}

// A sync run on its own (no protection loop, as in the risk tests): each action runs as the walk reaches it, and the wakes are gathered into
// the sync's `recheckAt` and its list-lag recheck, as before part 2.
function inlineLoop(ctx: WalkCtx): ProtectionHooks {
  return {
    busy: () => false,
    act: async (_id, _label, run) => {
      const r = await run();
      if (r && r.recheckAt !== undefined) ask(ctx, r.recheckAt);
    },
    wake: (_id, at, kind, extra = {}) => {
      if (kind === "protect") return ask(ctx, at);
      const gap = at - ctx.d.now().getTime();
      ctx.lag.gap = ctx.lag.gap === undefined ? gap : Math.min(ctx.lag.gap, gap);
      ctx.lag.until = Math.max(ctx.lag.until, extra.untilMs ?? 0);
      ctx.lag.lookups += extra.extraRequests ?? 0;
    },
  };
}
const ask = (ctx: WalkCtx, at: number): void => {
  ctx.recheckAt = ctx.recheckAt === undefined ? at : Math.min(ctx.recheckAt, at);
};

// The walk's decision for one entry that has shares and is not closed: whether it needs a sale, a fresh stop, a check, a recheck, or nothing.
async function protectEntry(ctx: WalkCtx, s: OrderRecord, o: Order): Promise<void> {
  const { d, day, mem, opts, nowMs, listed, held, heldQty, latestPerSymbol, sellingSymbols, lookedUp, listAgeMs, fromMs, createdMs, lateNotice, timedCleanup } = ctx;
  const id = s.clientOrderId;
  // The redesign of 2026-11-14, part 2: an entry whose action is running is decided again when it ends (the loop keeps its wake).
  if (ctx.loop.busy(id)) return;
  const wake = (at: number, room?: RoomNeed): void => ctx.loop.wake(id, at, "protect", room ? { room } : {});
  // Asked again just before each action starts (a close-out or another liquidation may have started meanwhile).
  const stillProtect = (): boolean => (typeof opts.protect === "function" ? opts.protect() : opts.protect);
  const protectNow = typeof opts.protect === "function" ? opts.protect() : opts.protect;
  // Group 1 review, round 1 (messaging): an entry reported stuck that is no longer the newest on its symbol gets its resolution line.
  if (latestPerSymbol.get(s.symbol)?.clientOrderId !== s.clientOrderId) await resolveStuck(d, mem, s.clientOrderId, `a newer ${s.symbol} position took over, and I watch that one now`);
  if (!protectNow || latestPerSymbol.get(s.symbol)?.clientOrderId !== s.clientOrderId || sellingSymbols.has(s.symbol)) return;
  // A4: a remainder protected by its fresh stop is left alone while that stop can still execute. Once the stop is gone (cancelled,
  // expired or rejected by anyone but our own sale) and the shares are still held, the missing-exit check below sells them, as before.
  const fresh = mem.freshStops.get(s.clientOrderId);
  if (fresh) {
    // Only while it covers the whole holding (group 1 review, round 2).
    const covering = held.has(s.symbol) && fresh.qty >= (heldQty.get(s.symbol) ?? 0) - 1e-9;
    // Michael's ruling B of 2026-11-12: still unclear 15 seconds after it was sent (as known before this sync's look): unprotected. The
    // look at the limit is part of cancelling it (freshStopTimeout), not a late confirmation.
    if (FRESH_STOP_LIMIT.on && covering && fresh.status === "unclear" && nowMs - fresh.placedAt >= FRESH_STOP_CONFIRM_MS) {
      await ctx.loop.act(id, "15 second limit", async () => {
        if (!stillProtect()) return;
        const t = await freshStopTimeout(d, day, mem, s, o, fresh, nowMs);
        if (t.attempted) (ctx.unprotected.push(s.symbol), mem.protectFirst?.mark(s.clientOrderId, s.symbol, "the order sync found it unprotected"));
        return t.recheckAt !== undefined ? { recheckAt: t.recheckAt, ...(t.room ? { room: t.room } : {}) } : undefined;
      });
      return;
    }
    const live = covering && (await freshStopLive(d, mem, fresh, listed.orders, nowMs, opts.streamLive === true, Math.max(1, listed.pages) + 1));
  if (live) {
      if (FRESH_STOP_LIMIT.on && fresh.status === "unclear") {
        // Still unclear: looked up again within 5 seconds, and the entry is looked at again at the 15 second limit (it is looked up at that
        // sync too, even if it is older than the 10 minute list).
        // Group 1, round 1 of the redesign (B3), with group 2's round 2: a lookup that found no room is tried again when there is room for it
      // and the coming sync's reads, and at least 0.5, 1, 2, then 4 s after refusals in a row (`roomWaitUntil`).
        const roomAt = fresh.lookRoomAt !== undefined ? Math.max(nowMs + 250, fresh.lookRoomAt) : Infinity;
        const due = Math.min(nowMs + FRESH_STOP_UNCLEAR_LOOKUP_MS, roomAt, fresh.placedAt + FRESH_STOP_CONFIRM_MS);
        wake(due);
        mem.mustLook.add(s.clientOrderId);
      }
      return;
    }
    dropFreshStop(d, mem, s.clientOrderId, held.has(s.symbol) ? "it no longer covers the holding" : "the shares are no longer held", nowMs);
    if (held.has(s.symbol)) d.log?.("fresh_stop_gone", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: fresh.stopClientOrderId, status: fresh.status, msFromSent: nowMs - fresh.placedAt });
  }
  if (!hasLiveExit(o)) {
    // Item 2 of 2026-11-13: an entry whose timed-out stop is known open with its cancel accepted or pending waits for that stop to end
    // (status checks, no sale tries); one known to have ended is tried at once.
    if (hasTimedOut(mem, s.clientOrderId)) {
      const w = await timedOutWait(d, mem, s, listed.orders, d.now().getTime());
      if (w !== null) {
        (ctx.unprotected.push(s.symbol), mem.protectFirst?.mark(s.clientOrderId, s.symbol, "the order sync found it unprotected"));
        wake(w.at, w.room);
        return;
      }
    }
    const due = retryDue(d, mem, s.clientOrderId, d.now().getTime());
    if ("wait" in due) {
      // Part A, step 1: tried moments ago and stuck; it is tried again at `due` (or when the shared request budget has room), and the
      // sync carries on with the others.
      (ctx.unprotected.push(s.symbol), mem.protectFirst?.mark(s.clientOrderId, s.symbol, "the order sync found it unprotected"));
      wake(due.wait, due.room);
      return;
    }
    // Michael's answer of 2026-11-14 (night) on ruling 1: a remainder the stack is already trying to give a fresh stop (A4; its stuck record
    // says so) whose take-profit our own cleanup cancelled is seen here with no exits at all once that cancel lands between one-round retries.
    // It still gets its fresh stop (the remainder's sale, with the stop price), not a market sale. Only before any fresh stop was recorded for
    // it (group 1, rulings round 1): a fresh stop that existed and then ended is sold at market as before; never for a timed-out stop (ruling B).
    const stRem = mem.stuck.get(id);
    const remainderStop = stRem?.protecting === true && stRem.freshStopRecorded !== true && !hasTimedOut(mem, id) ? (stopLeg(o)?.stopPrice ?? s.stopPrice) : null;
    mem.protectFirst?.mark(s.clientOrderId, s.symbol, "no live exit");
    d.log?.("unprotected_position", { symbol: s.symbol, clientOrderId: s.clientOrderId, listAgeMs: listAgeMs(), ...(remainderStop !== null ? { asRemainder: true } : {}) });
    const endedAt = flattenLegs(o).filter((l) => l.side === "sell" && !OPEN_STATUSES.has(l.status)).map((l) => l.canceledAt ?? l.updatedAt ?? "").filter((x) => Number.isFinite(Date.parse(x))).sort().at(-1) ?? null;
    lateNotice(s, "missing", endedAt);
    // Ruling B: a timed-out fresh stop of this entry still shown working is cancelled by this sale (which waits for Alpaca's cancel).
    const timedOutShown = listed.orders.filter((x) => mem.timedOutStops.get(x.clientOrderId) === s.clientOrderId && OPEN_STATUSES.has(x.status));
    const timedOutIds = timedOutShown.map((x) => x.id);
    // Group 2, round 3 (logging only): the cancel's outcome is logged by the sale after it was tried (cleanupSale), not here before it.
    await ctx.loop.act(id, "missing-exit sale", async () => {
      if (!stillProtect()) return;
      const c = remainderStop !== null && timedOutIds.length === 0
        ? await inTry(d, mem, s, due.go, "remainder", () => timedCleanup(d, day, mem, s, o, "bare", undefined, { stopPrice: remainderStop, stopCancelledAt: stopLeg(o)?.canceledAt ?? null }))
        : await inTry(d, mem, s, due.go, "missing-exit sale", () => timedCleanup(d, day, mem, s, o, "missing", undefined, timedOutIds.length > 0 ? { alsoCancel: timedOutIds, alsoCancelStops: timedOutShown.map((x) => x.clientOrderId) } : {}));
      if (c.attempted) (ctx.unprotected.push(s.symbol), mem.protectFirst?.mark(s.clientOrderId, s.symbol, "the order sync found it unprotected"));
      return c.recheckAt !== undefined ? { recheckAt: c.recheckAt, ...(c.room ? { room: c.room } : {}) } : undefined;
    });
    return;
  }
  // Release A, fix 1: the take-profit is still open (so the check above passes) but the stop is gone and shares are left.
  const liveAt = mem.liveStopCancelled.get(s.clientOrderId);
  const bare = held.has(s.symbol) ? bareRemainder(o, liveAt) : null;
  // Michael's item 1 of 2026-11-13 (afternoon), logging first: what this sync's list showed for a stop the live update reported cancelled.
  if (liveAt !== undefined && !mem.listLagLogged.has(s.clientOrderId)) {
    const leg = stopLeg(o);
    if (leg && OPEN_STATUSES.has(leg.status)) {
      mem.listLagLogged.add(s.clientOrderId);
      d.log?.("stop_cancel_list_lag", { symbol: s.symbol, clientOrderId: s.clientOrderId, listStatus: leg.status, msFromLiveCancel: nowMs - liveAt, foundBy: lookedUp.has(s.clientOrderId) ? "lookup" : "listing", listAgeMs: listAgeMs() });
    }
  }
  if (!bare) {
    mem.bareSeen.delete(s.clientOrderId);
    // Protect-first: its exits are live and no remainder is bare, so it is protected.
    if (!mem.stuck.has(s.clientOrderId)) mem.protectFirst?.protectedNow(s.clientOrderId);
    return;
  }
  // Group 2, round 4 of the weekend build: while the list still shows the stop open, the sale is not started (the sell gate counts that
  // stop, so the sale would wait inside this sync, up to about 22 s, and every entry after it would wait too). The entry is looked at again soon
  // instead (a list-lag wake of the protection loop): 0.5 s, then 1, then every 2 s (Michael, 2026-11-13 evening), for up to LIVE_LAG_WATCH_MS after the live report, each charged
  // run by the worker inside a P2 reservation of the shared request budget (rule 6: the 30 s window and the budget, and these steps); the sale
  // then starts in the first look or sync after the list clears. After that window the regular syncs carry on.
  if (bare.liveCancel) {
    const tries = (mem.liveLagTries.get(s.clientOrderId) ?? 0) + 1;
    mem.liveLagTries.set(s.clientOrderId, tries);
    mem.liveLagLastOpen.set(s.clientOrderId, nowMs);
    if (nowMs - liveAt! < LIVE_LAG_WATCH_MS) {
      // Michael's change of 2026-11-13 (evening): every 2 s after the first steps; since the redesign of 2026-11-14 each recheck runs inside
      // a P2 reservation of its cost (the sync's order list, its positions and this entry's lookup), so many remainders at once can never exceed it. With
      // no room the recheck waits for room (the loop's list-lag wake) until the last lagging remainder's 30 second window ends.
      const gap = Math.min(500 * 2 ** (tries - 1), LIVE_LAG_RECHECK_MAX_MS);
      // A list-lag wake (a lookup by id at the look for an entry older than the order list's window; its 30 s window).
      // Group 1, round 1 of part 2: timed from now (after the look's reads), as v22 and part 1 timed the recheck from the sync's end, so the
      // steps stay 0.5, 1, then 2 s apart however long the reads take.
      ctx.loop.wake(id, d.now().getTime() + gap, "lag", { extraRequests: createdMs(s) < fromMs ? 1 : 0, untilMs: liveAt! + LIVE_LAG_WATCH_MS });
      mem.mustLook.add(s.clientOrderId);
    }
    return;
  }
  // Logging only: the list now shows the stop ended, for an entry whose lag was logged. The list's lag lies between `lagAtLeastMs` (the
  // last sync that still saw the stop open) and `msFromLiveCancel` (this sync, the first that saw it ended); `syncsSawOpen` counts the
  // syncs that saw it still open (the quick rechecks and any other sync).
  if (liveAt !== undefined && mem.listLagLogged.has(s.clientOrderId) && !mem.listClearLogged.has(s.clientOrderId)) {
    mem.listClearLogged.add(s.clientOrderId);
    d.log?.("stop_cancel_list_cleared", { symbol: s.symbol, clientOrderId: s.clientOrderId, msFromLiveCancel: nowMs - liveAt, lagAtLeastMs: (mem.liveLagLastOpen.get(s.clientOrderId) ?? liveAt) - liveAt, syncsSawOpen: mem.liveLagTries.get(s.clientOrderId) ?? 0 });
  }
  const firstSeen = mem.bareSeen.get(s.clientOrderId) ?? nowMs;
  mem.bareSeen.set(s.clientOrderId, firstSeen);
  const cancelTime = bare.stop.canceledAt ?? (bare.liveCancel ? new Date(liveAt!).toISOString() : (bare.stop.updatedAt ?? null));
  const parsed = cancelTime ? Date.parse(cancelTime) : NaN;
  // Alpaca's own cancel time, never later than this worker's first sight of it (a clock that runs behind cannot add wait).
  const since = Number.isFinite(parsed) ? Math.min(parsed, firstSeen) : firstSeen;
  if (nowMs - since < BARE_GRACE_MS) {
    const due = since + BARE_GRACE_MS;
    wake(due);
    // Group 1 review, round 2: the sync at the grace time must look this entry up again, even if it is older than the 10 minute read.
    mem.mustLook.add(s.clientOrderId);
    return;
  }
  const stuckDue = retryDue(d, mem, s.clientOrderId, d.now().getTime());
  if ("wait" in stuckDue) {
    // Part A, step 1: tried moments ago and stuck; it is tried again then (or when the shared request budget has room), and the sync
    // carries on with the others.
    (ctx.unprotected.push(s.symbol), mem.protectFirst?.mark(s.clientOrderId, s.symbol, "the order sync found it unprotected"));
    wake(stuckDue.wait, stuckDue.room);
    return;
  }
  mem.protectFirst?.mark(s.clientOrderId, s.symbol, "a remainder without its stop");
  d.log?.("bare_remainder", { symbol: s.symbol, clientOrderId: s.clientOrderId, shares: bare.shares, stopCancelledAt: cancelTime, listAgeMs: listAgeMs() });
  lateNotice(s, "bare", cancelTime, { firstSeenAgoMs: d.now().getTime() - firstSeen });
  const tp = flattenLegs(o).find((l) => l.side === "sell" && l.type === "limit");
  // Decision 3 of 2026-11-06: the measurement starts the moment Alpaca accepts the sale, so it sees the sale's fill and the prints
  // after it (before, it was told only after the sale had filled, and 99 of 103 sales went unmeasured).
  const onSellSent = (x: { symbol: string; qty: number; clientOrderId: string; atMs: number }) => {
    if (x.symbol !== s.symbol) return;
    try {
      d.onBareSale?.({ symbol: x.symbol, shares: x.qty, takeProfit: tp?.limitPrice ?? null, atMs: x.atMs, clientOrderId: x.clientOrderId });
    } catch {
      /* a measurement must never break the sync */
    }
  };
  await ctx.loop.act(id, "remainder", async () => {
    if (!stillProtect()) return;
    const c = await inTry(d, mem, s, stuckDue.go, "remainder", () => timedCleanup(d, day, mem, s, o, "bare", onSellSent, { stopPrice: bare.stop.stopPrice ?? s.stopPrice, stopCancelledAt: cancelTime }));
    if (c.attempted) (ctx.unprotected.push(s.symbol), mem.protectFirst?.mark(s.clientOrderId, s.symbol, "the order sync found it unprotected"));
    if (!c.stuck) mem.bareSeen.delete(s.clientOrderId);
    return c.recheckAt !== undefined ? { recheckAt: c.recheckAt, ...(c.room ? { room: c.room } : {}) } : undefined;
  });
}

const EPS_QTY = 1e-9;

// The stuck record on the hidden-hold backoff (5, 10, 20, then every 30 seconds; retryDue reserves room in the shared request budget when
// it is due).
function backoffStuck(mem: SyncMemory, symbol: string, clientOrderId: string, nowMs: number, why: string): StuckEntry {
  const st = mem.stuck.get(clientOrderId) ?? { symbol, since: nowMs, nextAt: 0, delayMs: 0, alerted: false, escalated: false, lastTriedAt: nowMs, why: "" };
  st.lastTriedAt = nowMs;
  st.delayMs = st.delayMs > 0 ? Math.min(st.delayMs * 2, backoffCap(mem, clientOrderId)) : STUCK_RETRY_FIRST_MS;
  st.nextAt = nowMs + st.delayMs;
  if (!st.why) st.why = why;
  mem.stuck.set(clientOrderId, st);
  return st;
}

// A retry's reservation (the redesign of 2026-11-14): what `inTry` reserves when the try starts.
type TrySpec = { n: number; timedOut: boolean };
// Group 1, round 4 of part 2: what a P1 try of `n` requests waiting for room will ask the budget, with the look's two reads (the order list
// and the positions) ahead of it, as `roomWaitUntil` counts them. The loop checks it locally (no request) before it looks again.
const p1Room = (n: number, minuteCap?: number): RoomNeed => ({ cls: "P1", n, reads: 2, ...(minuteCap !== undefined ? { minuteCap } : {}) });
// Michael's ruling of 2026-11-17: a stuck sale's room need (an ordinary stuck retry or a timed-out stop's try), so its local room check keeps
// new entries giving way while it waits for Alpaca's room.
const saleRoom = (n: number, minuteCap?: number): RoomNeed => ({ ...p1Room(n, minuteCap), stuckSale: true });
// An ordinary stuck retry's ceiling on the budgeted minute (none for a timed-out stop's try).
const retryCap = (timedOut: boolean): number | undefined => (timedOut ? undefined : STUCK_RETRY_MINUTE_CAP);
function retryDue(d: RiskDeps, mem: SyncMemory, clientOrderId: string, nowMs: number): { wait: number; room: RoomNeed } | { go: TrySpec | null } {
  const st = mem.stuck.get(clientOrderId);
  const timedOut = hasTimedOut(mem, clientOrderId);
  // A first try (no stuck record, or due at once) goes ahead, never refused (decision 4): counted as a first try. Since group 1's round 1
  // of the weekend build, a try for an entry with a timed-out stop is never a first try: it always needs room for a whole try.
  if (!timedOut && (!st || st.nextAt === 0)) return { go: null };
  // Group 1, round 4 of part 2: any wait of a retry ends in a try that needs room for its whole try, so the loop's wake for it is a room
  // wake: checked against the budget locally, with no look (and no request) until the try would have room.
  if (st && st.nextAt > nowMs) return { wait: st.nextAt, room: saleRoom(timedOut ? TIMED_OUT_TRY_REQUESTS : STUCK_TRY_REQUESTS, retryCap(timedOut)) };
  // The redesign of 2026-11-14, part 1: a retry is class P1 of the shared request budget. It starts only with room for its whole try
  // (TIMED_OUT_TRY_REQUESTS for an entry with a timed-out stop, else STUCK_TRY_REQUESTS); what it sends is counted as it is sent. Part 2
  // (the advisor's point, and group 1's leak note): here the room is only looked at; the reservation is taken when the try starts (`inTry`,
  // inside the loop's action, after its busy check and the stand-aside rules are asked again).
  const n = timedOut ? TIMED_OUT_TRY_REQUESTS : STUCK_TRY_REQUESTS;
  const room = budgetOf(d, mem).roomFor("P1", n, true, 0, retryCap(timedOut));
  if (room.ok) return { go: { n, timedOut } };
  return { wait: waitForRoom(d, mem, st, clientOrderId, timedOut, n, room, nowMs), room: saleRoom(n, retryCap(timedOut)) };
}

// Waiting for room (not a backoff step of the try itself): until there is room for the coming sync's reads and the try, and at least 0.5, 1,
// 2, then 4 s after refusals in a row (group 2, round 2 of the redesign).
function waitForRoom(d: RiskDeps, mem: SyncMemory, st: StuckEntry | undefined, clientOrderId: string, timedOut: boolean, n: number, refusal: Refusal, nowMs: number): number {
  const why = refusal.why;
  const waits = st ? (st.roomWaits = (st.roomWaits ?? 0) + 1) : 1;
  const at = roomWaitUntil(d, mem, "P1", n, waits, nowMs, 2, true, retryCap(timedOut));
  if (st) st.nextAt = at;
  // Michael's ruling of 2026-11-17: refused for Alpaca's room, new entries give way until this sale looks again (request-budget.ts).
  budgetOf(d, mem).noteStuckSaleWaiting(refusal, at, timedOut ? "timed-out stop try" : "stuck retry");
  if (timedOut && waits === 1) d.log?.("timed_out_try_out_of_room", { clientOrderId, why, retryInMs: at - nowMs });
  return at;
}

// Runs one try: inside its P1 reservation (a retry), taken now, or counted as a first try. The reservation ends with the try. A retry that
// finds no room now (another try took it since the walk looked) sends nothing and waits for room.
async function inTry(d: RiskDeps, mem: SyncMemory, s: OrderRecord, spec: TrySpec | null, label: string, fn: () => Promise<{ attempted: boolean; stuck: boolean; recheckAt?: number }>): Promise<{ attempted: boolean; stuck: boolean; recheckAt?: number; room?: RoomNeed }> {
  if (!spec) {
    // Item 3 of the night build (decision 4 changed): a first try would wait for room above the urgent floor, at most 3 s, then go ahead;
    // switched off (FIRST_TRY_PACING in request-budget.ts), so it goes ahead at once as on v24.
    if (d.sleep) await budgetOf(d, mem).paceFirst(FIRST_TRY_MOST, label, d.sleep, true);
    return withReservation(budgetOf(d, mem).first(label), fn, "first");
  }
  const r = budgetOf(d, mem).tryReserve("P1", spec.n, { label: spec.timedOut ? "timed-out stop try" : "stuck retry", limitRetries: spec.timedOut, ...(spec.timedOut ? {} : { minuteCap: STUCK_RETRY_MINUTE_CAP }) });
  const st = mem.stuck.get(s.clientOrderId);
  if (!(r instanceof Reservation)) return { attempted: true, stuck: true, recheckAt: waitForRoom(d, mem, st, s.clientOrderId, spec.timedOut, spec.n, r, d.now().getTime()), room: saleRoom(spec.n, retryCap(spec.timedOut)) };
  if (st) st.roomWaits = 0;
  return withReservation(r, fn);
}
const plural = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const minutesText = (ms: number): string => (ms < 60_000 ? plural(Math.max(1, Math.round(ms / 1000)), "second") : plural(Math.round(ms / 60_000), "minute"));

// Part A, step 4: the one alert after 5 minutes stuck (mentions Michael), by the clock (Michael's decision of 2026-11-09).
// Group 2 review of 2026-11-12, rounds 1 and 2 (messaging only): not posted while the entry's remembered fresh stop protects the position:
// its known status is working, or the order list the sync has already read (`listed`, read only) shows that stop (by its client id)
// working, in either case covering the holding. This is the case of a fresh stop whose first answer was unclear and which Alpaca in fact
// holds. Nothing is written here (not the stuck record, not the fresh stop's status), so the alert can still come if that stop ends.
async function escalateIfDue(d: RiskDeps, mem: SyncMemory, clientOrderId: string, heldQty?: number, listed?: readonly Order[]): Promise<void> {
  const st = mem.stuck.get(clientOrderId);
  const now = d.now().getTime();
  if (!st || !st.alerted || st.escalated || now - st.since < STUCK_ESCALATE_MS) return;
  // Messaging only (group 2, round 1 of the night release): nothing held, nothing to escalate; the entry's closing line follows.
  if (heldQty !== undefined && heldQty <= 1e-9) return;
  const fresh = mem.freshStops.get(clientOrderId);
  const covers = (q: number) => heldQty === undefined || q >= heldQty - 1e-9;
  const working = (status: string) => OPEN_STATUSES.has(status) && status !== "pending_cancel";
  const shown = fresh ? listed?.find((x) => x.clientOrderId === fresh.stopClientOrderId && working(x.status)) : undefined;
  // A status still "unclear" holds it too: the sync's walk looks that stop up (or the list shows it) and settles it, so a real problem is
  // reported at most one sync later.
  if (fresh && (fresh.status === "unclear" || (working(fresh.status) && covers(fresh.qty)) || (shown && covers(shown.qty - shown.filledQty)))) return;
  // Group 2, round 1 of the night release (messaging only): not posted while a sale of ours (cyrus-x-) covering the holding is working
  // in the list the sync has already read (ruling B's sale after the 15 second limit, waiting for Alpaca to fill it).
  const ourSale = (listed ?? []).filter((x) => x.symbol === st.symbol && x.side === "sell" && x.clientOrderId.startsWith("cyrus-x-") && working(x.status)).reduce((n, x) => n + Math.max(0, x.qty - x.filledQty), 0);
  if (ourSale > 0 && covers(ourSale)) return;
  st.escalated = true;
  // Michael's decision 2 of 2026-11-13 (10:15 AM), messaging only: the 5 minute alert says only what the stack knows, so it is true
  // whether or not a stop rests at Alpaca. One present-tense variant states what the list this sync has just read shows; every other
  // case leads with "I can't confirm a protective stop", plus what the stack last saw, in the past tense.
  const shownStop = (listed ?? []).find((x) => mem.timedOutStops.get(x.clientOrderId) === clientOrderId && OPEN_STATUSES.has(x.status));
  const minutes = minutesText(now - st.since);
  if (shownStop) {
    const known = st.restingStop?.stopClientOrderId === shownStop.clientOrderId ? st.restingStop.cancel : undefined;
    const cancel = shownStop.status === "pending_cancel" ? "Alpaca shows it pending cancel but has not finished cancelling it" : known === "refused" ? "Alpaca did not accept my last cancel of it" : known === "accepted" || mem.timedOutCancelAccepted.has(shownStop.clientOrderId) ? "Alpaca accepted my cancel of it but still shows it working" : "my cancel of it has not taken effect";
    await d.say("alerts", `**Michael: ${st.symbol}'s fresh protective stop, not confirmed in time, is still resting at Alpaca after ${minutes}; ${cancel}, so I still cannot sell the shares.** That stop may still protect them, but I no longer count on it. Please check ${st.symbol} in Alpaca's dashboard and close it there if needed. I keep trying.`, { mentionOwner: true });
    return;
  }
  // What the stack last saw of the entry's timed-out stop, as a fact with its time (never a claim about now).
  const noted = st.restingStop;
  let seen = "";
  if (noted && (listed ?? []).some((x) => x.clientOrderId === noted.stopClientOrderId && !OPEN_STATUSES.has(x.status))) {
    delete st.restingStop;
    seen = " Alpaca's order list now shows its fresh stop (not confirmed in time) ended.";
  } else if (noted) {
    const cancel = noted.cancel === "pending" ? "Alpaca showed it pending cancel" : noted.cancel === "refused" ? "Alpaca did not accept my last cancel of it" : noted.cancel === "accepted" || mem.timedOutCancelAccepted.has(noted.stopClientOrderId) ? "Alpaca had accepted my cancel of it but still showed it working" : "my cancel of it had not taken effect";
    seen = ` At my last check its fresh stop (not confirmed in time) was still resting at Alpaca; ${cancel}.`;
  }
  const what = st.protecting ? "protect or sell it" : "sell it";
  // Group 2, round 3 of the weekend build: the reason is left out when it says what the sentence after it says (the last check's finding).
  const reason = seen && (st.why ?? "").startsWith("at my last check") ? "" : ` (${st.why || "still held"})`;
  await d.say("alerts", `**Michael: I can't confirm a protective stop for ${st.symbol} after ${minutes}, and I have not been able to ${what} yet**${reason}.${seen} I am checking, and I will ${what} if it is still unconfirmed. Please check ${st.symbol} in Alpaca's dashboard and close it there if needed. I keep trying.`, { mentionOwner: true });
}

// Fix C (Michael's approval of 2026-11-10): the closing line for a sale reported as "not filled yet": when every sale of the entry is seen
// filled in Alpaca's list, or the entry is no longer open (its shares are gone). A sale Alpaca ended unfilled, or one not seen filled
// within AWAITING_FILL_MAX_MS, is dropped without a line (the order sync deals with the shares if they are still held). No request.
async function settleAwaiting(d: RiskDeps, mem: SyncMemory, orders: Order[] | null, activeIds: ReadonlySet<string>): Promise<void> {
  const now = d.now().getTime();
  for (const [id, a] of [...mem.awaitingFill]) {
    const sales = orders ? a.saleIds.map((sid) => orders.find((o) => o.clientOrderId === sid) ?? null) : [];
    const ended = sales.some((o) => o !== null && (o.status === "canceled" || o.status === "expired" || o.status === "rejected") && !(o.filledQty > 0));
    const filled = sales.length > 0 && sales.every((o) => o !== null && o.status === "filled");
    if (filled || (!activeIds.has(id) && !ended)) {
      mem.awaitingFill.delete(id);
      if (a.kind === "bare" && d.onRemainderSold) d.onRemainderSold(a.symbol, a.qty);
      // Group 1 review, round 1 (note 4): not waited for, so a slow Discord can never hold up the sync's safety sales after it.
      else void Promise.resolve(d.say("alerts", a.kind === "bare" ? `**${a.symbol}: the sale of the remaining ${plural(a.qty, "share")} has filled.**` : `**${a.symbol}: the sale of its ${plural(a.qty, "share")} has filled.**`)).catch(() => undefined);
      continue;
    }
    if (ended || now - a.since > AWAITING_FILL_MAX_MS) {
      mem.awaitingFill.delete(id);
      d.log?.("awaiting_fill_dropped", { symbol: a.symbol, clientOrderId: id, ended, ageMs: now - a.since });
    }
  }
}

// Group 2, round 2 of the weekend build (messaging only): an entry with a timed-out stop that has no open report in this process (after a
// restart, a stop loaded from the database or found pending cancel at start-up; or an older entry that is again the newest on its symbol
// after its earlier report was resolved) gets the first alert once, and from then the 5 minute alert and the resolution line as any other.
// The time given is when this process noticed it (group 2, round 3), not when protection was lost.
async function reportTimedOutOnce(d: RiskDeps, mem: SyncMemory, s: OrderRecord, nowMs: number): Promise<void> {
  const st = mem.stuck.get(s.clientOrderId);
  if (st?.alerted) return;
  const rec = st ?? { symbol: s.symbol, since: nowMs, nextAt: 0, delayMs: 0, alerted: false, escalated: false, lastTriedAt: nowMs, why: "" };
  rec.alerted = true;
  rec.why ||= "its fresh stop was not confirmed in time, so I do not count it as protection";
  mem.stuck.set(s.clientOrderId, rec);
  await d.say("alerts", `**Michael: I can't confirm a protective stop for ${s.symbol} (noticed at ${centralClock(new Date(nowMs))}): its fresh stop was not confirmed in time, so I do not count it as protection.** I am checking, and I will sell it if still unconfirmed. I will post again when it is sold or gone.`, { mentionOwner: true });
}

// Item 2 of 2026-11-13 (Michael's decision, the leftovers), with group 1's round 1 fixes: what to do this sync for an entry with a timed-out
// fresh stop. Returns null to go on to the sale (whole tries, P1 reservations of the shared request budget), or the moment to look again while it
// waits. It waits while the stop is known open (the sync's list shows it, or the last try or check saw it, whatever the state of our cancel:
// accepted, pending or refused): a sale try could not sell the shares that stop holds. Its status comes free from the sync's list when the
// list shows it; otherwise one lookup by client id (a P1 reservation of 2 in the shared request budget, with the open orders below), every 10 seconds with the live updates down and every 30
// with them up, then Alpaca's open orders if that lookup fails; a check that fails both ways waits on its own backoff (doubling to a
// minute). Ended (cancelled, expired, rejected, unknown to Alpaca, or not among the open orders): noted, and the sale is tried (when a whole
// try fits). While it waits its cancel is sent again on the backoff's steps (5, 10, 20, then every 30 seconds; the first at once), 1
// request each, never while Alpaca shows it pending cancel.
// Group 1, round 4 of part 2: the time to look again, and when that time is a check's or a cancel's (each needs room in the budget), what it
// will ask for, so the loop waits for that room locally (no request) instead of looking again.
async function timedOutWait(d: RiskDeps, mem: SyncMemory, s: OrderRecord, listed: readonly Order[], nowMs: number): Promise<{ at: number; room?: RoomNeed } | null> {
  await reportTimedOutOnce(d, mem, s, nowMs);
  const st = mem.stuck.get(s.clientOrderId);
  for (const [stop, entry] of mem.timedOutStops) {
    if (entry !== s.clientOrderId || mem.timedOutEndedAt.has(stop)) continue;
    const shown = listed.find((x) => x.clientOrderId === stop);
    if (shown && !OPEN_STATUSES.has(shown.status)) {
      // The sync's own list shows it ended (or filled: the shares are gone, and the sale finds nothing to sell).
      noteTimedOutStopEnded(mem, stop, nowMs);
      d.log?.("fresh_stop_timeout_ended", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: stop, status: shown.status, by: "order list" });
      continue;
    }
    const noted = st?.restingStop?.stopClientOrderId === stop ? st.restingStop.cancel : undefined;
    // Group 1, round 1 of the weekend build: also when our cancel was refused. A stop known open holds the shares, so a sale try cannot sell
    // them; a cheap check and the cancel sent again (on the backoff) do the work at 1 request each.
    const waiting = shown ? true : noted === "accepted" || noted === "pending" || noted === "refused";
    if (!waiting) continue;
    // The first cancel goes at once if none has been tried yet; later ones on the backoff.
    const tried = noted !== undefined || mem.timedOutCancelAccepted.has(stop);
    const chk = mem.timedOutCheck.get(stop) ?? { probeAt: 0, resendAt: tried ? nowMs + STUCK_RETRY_FIRST_MS : nowMs, resendDelayMs: STUCK_RETRY_FIRST_MS, probeFailed: false, probeFailDelayMs: 0 };
    mem.timedOutCheck.set(stop, chk);
    let status = shown?.status;
    let orderId = shown?.id;
    if (!shown) {
      // Group 1, round 1 of the weekend build: a failed check is simply checked again on its backoff (a sale try could not sell shares
      // the known-open stop holds, and would spend about 13 requests).
      if (chk.probeAt > nowMs) return { at: chk.probeAt, room: p1Room(TIMED_OUT_CHECK_REQUESTS) };
      // The redesign of 2026-11-14, part 1: the check is class P1 of the shared request budget, with room for both of its reads.
      const r = budgetOf(d, mem).tryReserve("P1", TIMED_OUT_CHECK_REQUESTS, { label: "timed-out stop check", limitRetries: true });
      if (!(r instanceof Reservation)) {
        chk.roomWaits = (chk.roomWaits ?? 0) + 1;
        chk.probeAt = roomWaitUntil(d, mem, "P1", TIMED_OUT_CHECK_REQUESTS, chk.roomWaits, nowMs);
        return { at: chk.probeAt, room: p1Room(TIMED_OUT_CHECK_REQUESTS) };
      }
      chk.roomWaits = 0;
      try {
        await withReservation(r, async () => {
          try {
            const x = await d.broker.findOrderByClientId(stop);
            status = x ? x.status : "unknown_at_alpaca";
            orderId = x?.id;
          } catch (err) {
            // The lookup by client id failed: Alpaca's open orders are the second way (one more request, in the same reservation; as at
            // the 15 second limit). Not among them: taken as ended, and the sale is tried (it never sells shares a working stop holds, sells.ts).
            d.log?.("fresh_stop_lookup_failed", { symbol: s.symbol, stopClientOrderId: stop, by: "status check", error: (err as Error).message.slice(0, 120) });
            const x = (await d.broker.listOrders("open")).find((y) => y.clientOrderId === stop);
            status = x ? x.status : "not in Alpaca's open orders";
            orderId = x?.id;
          }
        });
      } catch (err) {
        d.log?.("fresh_stop_lookup_failed", { symbol: s.symbol, stopClientOrderId: stop, by: "status check, open orders", error: (err as Error).message.slice(0, 120) });
        // Rule of 2026-11-13: the next check comes on a backoff (the normal interval, doubling, at most a minute), never at the next sync.
        chk.probeFailed = true;
        const base = mem.streamLive ? TIMED_OUT_PROBE_STREAM_MS : TIMED_OUT_PROBE_NO_STREAM_MS;
        chk.probeFailDelayMs = chk.probeFailDelayMs > 0 ? Math.min(chk.probeFailDelayMs * 2, TIMED_OUT_PROBE_FAIL_MAX_MS) : base;
        chk.probeAt = d.now().getTime() + chk.probeFailDelayMs;
        return { at: chk.probeAt, room: p1Room(TIMED_OUT_CHECK_REQUESTS) };
      }
      chk.probeFailed = false;
      chk.probeFailDelayMs = 0;
      d.log?.("fresh_stop_timeout_check", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: stop, status });
      if (!OPEN_STATUSES.has(status as string)) {
        noteTimedOutStopEnded(mem, stop, d.now().getTime());
        continue;
      }
      chk.probeAt = d.now().getTime() + (mem.streamLive ? TIMED_OUT_PROBE_STREAM_MS : TIMED_OUT_PROBE_NO_STREAM_MS);
      // The cancel state we know is kept (a refused cancel stays refused until one is accepted); pending cancel is what Alpaca shows.
      if (st) st.restingStop = { stopClientOrderId: stop, cancel: status === "pending_cancel" ? "pending" : noted === "refused" ? "refused" : "accepted" };
    }
    // Messaging only: the reason the 5 minute alert gives is what this check found, not an older error.
    // Past tense (group 2, round 2 of the weekend build): the alert can come a check later, so it states what this check saw.
    if (st) st.why = status === "pending_cancel" ? "at my last check Alpaca had not finished cancelling its fresh stop (not confirmed in time)" : "at my last check its fresh stop (not confirmed in time) was still open at Alpaca";
    // Known open: our cancel again, at most on the backoff's steps (not while Alpaca shows it pending cancel).
    if (status !== "pending_cancel" && orderId && chk.resendAt <= nowMs) {
      // The redesign of 2026-11-14, part 1: class P1 of the shared request budget (1 request).
      const r = budgetOf(d, mem).tryReserve("P1", 1, { label: "timed-out stop cancel again", limitRetries: true });
      if (r instanceof Reservation) {
        chk.roomWaits = 0;
        try {
          await withReservation(r, () => d.broker.cancelOrder(orderId!));
          d.log?.("fresh_stop_timeout_cancel", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: stop, by: "status check", again: mem.timedOutCancelAccepted.has(stop) });
          mem.timedOutCancelAccepted.add(stop);
        } catch (err) {
          d.log?.("fresh_stop_timeout_cancel_failed", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: stop, by: "status check", again: mem.timedOutCancelAccepted.has(stop), error: (err as Error).message.slice(0, 120) });
          if (st) {
            st.restingStop = { stopClientOrderId: stop, cancel: "refused" };
            st.why = "Alpaca did not accept my last cancel of its fresh stop (not confirmed in time)";
          }
        }
        chk.resendDelayMs = Math.min(chk.resendDelayMs * 2, STUCK_RETRY_MAX_MS);
        chk.resendAt = d.now().getTime() + chk.resendDelayMs;
      } else {
        // Group 1, round 1 of the weekend build: no room now, so not before the budget has room (never a quick look again).
        chk.roomWaits = (chk.roomWaits ?? 0) + 1;
        chk.resendAt = roomWaitUntil(d, mem, "P1", 1, chk.roomWaits, nowMs);
      }
    }
    const lookAt = shown ? nowMs + 10_000 : chk.probeAt;
    const resendAt = status !== "pending_cancel" ? chk.resendAt : Infinity;
    const next = Math.max(Math.min(lookAt, resendAt), nowMs + 250);
    // Room only when the next time is the cancel's (it needs room for one request) or the check's; a look at a stop the list shows is not.
    if (resendAt <= lookAt) return { at: next, room: p1Room(1) };
    return shown ? { at: next } : { at: next, room: p1Room(TIMED_OUT_CHECK_REQUESTS) };
  }
  return null;
}

// Part C: the one line when a position that was reported stuck resolves (no mention). Nothing is posted for an entry never reported.
// Michael's ruling B of 2026-11-12: a fresh stop still unclear 15 seconds after it was sent. The remainder is treated as unprotected:
// the stop is looked up by its client id and, if Alpaca has it open, cancelled through the cleanup sale (which waits for Alpaca's cancel
// before it sells, and never counts that stop as protection); the shares are then sold through the checked sell path (it never sells more
// than is held counting sells already open, so a stop Alpaca did take cannot be sold on top of). Michael gets an alert at once, and the
// stuck record (already "alerted") gives the one line when it resolves (sold, or gone).
async function freshStopTimeout(d: RiskDeps, day: DayRecord, mem: SyncMemory, s: OrderRecord, o: Order, f: FreshStop, nowMs: number): Promise<{ attempted: boolean; stuck: boolean; recheckAt?: number; room?: RoomNeed }> {
  mem.freshStops.delete(s.clientOrderId);
  mem.timedOutStops.set(f.stopClientOrderId, s.clientOrderId);
  mem.timedOutDirty = true; // written to the database by this sync (item 2 of 2026-11-13)
  let cancelId: string | null = f.orderId;
  let found: string = "lookup failed";
  // The redesign of 2026-11-14, part 1 (with group 2's round 1 finding): the 15 second limit's lookups (TIMED_OUT_CHECK_REQUESTS, 2) and its
  // first try (TIMED_OUT_TRY_REQUESTS, 13) are each a P1 try of the shared request budget, reserved separately, so a lookup made in the last
  // 5 seconds (the unclear stop's own, every 5 seconds) does not keep the limit from looking. Without room for the lookups they are skipped;
  // without room for the first try it comes when the budget has room (the order sync's walk, on the stuck record's time), as a try for an
  // entry with a timed-out stop (it never sells shares a working stop holds, sells.ts). The alert says which.
  const budget = budgetOf(d, mem);
  const look = budget.tryReserve("P1", TIMED_OUT_CHECK_REQUESTS, { label: "15 second limit lookup", limitRetries: true });
  if (!(look instanceof Reservation)) found = "not looked up (no room in the request budget)";
  else
    await withReservation(look, async () => {
      try {
        const x = await d.broker.findOrderByClientId(f.stopClientOrderId);
        found = x ? x.status : "unknown_at_alpaca";
        if (x) cancelId = OPEN_STATUSES.has(x.status) ? x.id : null;
        else cancelId = null;
      } catch (err) {
        d.log?.("fresh_stop_lookup_failed", { symbol: f.symbol, error: (err as Error).message.slice(0, 120) });
        // The lookup by client id failed: Alpaca's open orders are a second way to find it (one more request, in the same reservation).
        try {
          const x = (await d.broker.listOrders("open")).find((y) => y.clientOrderId === f.stopClientOrderId);
          found = x ? x.status : "not in Alpaca's open orders";
          cancelId = x ? x.id : null;
        } catch {
          /* neither read answered: the sale below still cannot sell shares a working stop holds (sells.ts) */
        }
      }
    });
  d.log?.("fresh_stop_timeout", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: f.stopClientOrderId, msFromSent: nowMs - f.placedAt, found, cancelling: cancelId !== null });
  // The stop filled after all: its shares are sold; the next sync closes the entry. Nothing to cancel or sell.
  if (found === "filled") return { attempted: false, stuck: false };
  const sale = budget.tryReserve("P1", TIMED_OUT_TRY_REQUESTS, { label: "timed-out stop try", limitRetries: true });
  const saleNow = sale instanceof Reservation;
  const left = f.qty;
  const st = mem.stuck.get(s.clientOrderId) ?? { symbol: s.symbol, since: nowMs, nextAt: 0, delayMs: 0, alerted: false, escalated: false, lastTriedAt: nowMs, why: "" };
  if (!st.alerted) {
    st.alerted = true;
    st.why = "its fresh protective stop was not confirmed within 15 seconds";
    mem.stuck.set(s.clientOrderId, st);
    const it = left === 1 ? "it" : "them";
    const notAsked = found.startsWith("not looked up");
    // Messaging only (group 2, round 1 of the redesign): what the stack is doing now, true whether or not the budget had room.
    const what = saleNow
      ? cancelId
        ? `I am cancelling that stop and selling ${it} now`
        : notAsked || found === "lookup failed"
          ? `Alpaca could not be asked about that stop, so I am selling ${it} now`
          : `Alpaca told me it does not hold that stop open, so I am selling ${it} now`
      : cancelId
        ? `I will cancel that stop and sell ${it} as soon as my request budget has room`
        : notAsked
          ? `I have not been able to ask Alpaca about that stop yet (no room in my request budget); I will sell ${it} as soon as there is room`
          : found === "lookup failed"
            ? `Alpaca could not be asked about that stop, so I will sell ${it} as soon as my request budget has room`
            : `Alpaca told me it does not hold that stop open, so I will sell ${it} as soon as my request budget has room`;
    try {
      await d.say("alerts", `**Michael: ${s.symbol}'s fresh protective stop for ${plural(left, "share")} was not confirmed within 15 seconds, so I treat ${it} as unprotected.** ${what}, and will post again when ${left === 1 ? "it is" : "they are"} sold or gone.`, { mentionOwner: true });
    } catch (err) {
      if (saleNow) sale.end(); // never left holding room
      throw err;
    }
  }
  if (!saleNow) {
    // Its first try waits for room (not a backoff step).
    st.roomWaits = (st.roomWaits ?? 0) + 1;
    st.nextAt = roomWaitUntil(d, mem, "P1", TIMED_OUT_TRY_REQUESTS, st.roomWaits, nowMs);
    st.lastTriedAt = nowMs;
    d.log?.("timed_out_try_out_of_room", { symbol: s.symbol, clientOrderId: s.clientOrderId, stage: "15 second limit", why: sale.why, retryInMs: st.nextAt - nowMs });
    // Michael's ruling of 2026-11-17: an unprotected position's sale waiting for Alpaca's room: new entries give way until it looks again.
    budgetOf(d, mem).noteStuckSaleWaiting(sale, st.nextAt, "15 second limit's sale");
    return { attempted: true, stuck: true, recheckAt: st.nextAt, room: saleRoom(TIMED_OUT_TRY_REQUESTS) };
  }
  return withReservation(sale, () => cleanupSale(d, day, mem, s, o, "missing", undefined, cancelId ? { alsoCancel: [cancelId], alsoCancelStops: [f.stopClientOrderId], alsoCancelBy: "15 second limit" } : {}));
}

async function resolveStuck(d: RiskDeps, mem: SyncMemory, clientOrderId: string, how: string): Promise<boolean> {
  const st = mem.stuck.get(clientOrderId);
  mem.stuck.delete(clientOrderId);
  if (!st?.alerted) return false;
  // Messaging only: the shares left after a sale of ours went out (ruling 1's one-round retries): they were sold.
  if (how === "no longer held" && st.saleSentAt !== undefined && d.now().getTime() - st.saleSentAt <= AWAITING_FILL_MAX_MS) how = "sold";
  await d.say("alerts", `${st.symbol}: ${how} (${minutesText(d.now().getTime() - st.since)} after I reported that I could not confirm its protective stop).`);
  return true;
}

// Release 1 of 2026-11-09 (Michael's approval of parts A, B and C, builds/c2-proposal-2026-11-09.md): the cleanup sale of ONE entry
// whose exits are gone ("missing") or whose stop is gone with shares left ("bare").
// - Part B, step 1 (and part A, step 2): the entry is looked up again by its client id right before acting (one request), since the
//   sync's own list can be a minute old. If its exits have sold every share, or (for "missing") it has a live exit after all, or (for
//   "bare") its stop is live, nothing is cancelled or sold.
// - Part B, steps 2 to 4: only that entry's own live exits are cancelled (by id, which also reaches exits Alpaca's open list does not
//   show), and at most that entry's own shares are sold, so a newer position on the same symbol keeps its exits and its shares.
// - Part A, step 1: a round that finds the shares held with no open order visible ends the attempt; it is retried after 5, 10, 20, then
//   every 30 seconds.
// - Part C and part A, step 4: one alert when first stuck, one after 5 minutes stuck, one line when it resolves.
// A4: `extra.stopPrice` (a "bare" remainder): a fresh stop at that price instead of the market sale (sells.ts protectWithStop).
// A5: `extra.fast` (a "missing" entry that filled as the stack's 5 second cancel reached Alpaca): sold at once, without waiting for
// Alpaca's cancel of its exits to show; the sale waits in sells.ts until that cancel frees the share, and nothing happens if Alpaca kept them.
async function cleanupSale(d: RiskDeps, day: DayRecord, mem: SyncMemory, s: OrderRecord, listedCopy: Order, kind: "missing" | "bare", onSellSent?: (x: { symbol: string; qty: number; clientOrderId: string; atMs: number }) => void, extra: { stopPrice?: number | null; stopCancelledAt?: string | null; fast?: { fillAtMs: number }; alsoCancel?: string[]; alsoCancelStops?: string[]; alsoCancelBy?: string } = {}): Promise<{ attempted: boolean; stuck: boolean; recheckAt?: number }> {
  let o = listedCopy;
  // Group 1, round 5: a live update during this try that the entry's timed-out stop ended overrides any backoff this try would set.
  const tryStartMs = d.now().getTime();
  const stopEndedDuringTry = (): boolean => [...mem.timedOutStops].some(([stop, entry]) => entry === s.clientOrderId && (mem.timedOutEndedAt.get(stop) ?? -1) >= tryStartMs);
  const dueNow = (now: number): { attempted: true; stuck: true; recheckAt: number } => {
    const st = mem.stuck.get(s.clientOrderId);
    if (st) {
      st.nextAt = 0;
      delete st.restingStop;
    }
    return { attempted: true, stuck: true, recheckAt: now };
  };
  // Item 2 of 2026-11-13: a try for an entry with a timed-out stop is shaped to fit its reservation (TIMED_OUT_TRY_REQUESTS): one round, a
  // half-second wait for Alpaca's cancel, no entry lookup. Since the redesign of 2026-11-14 (part 1) it runs inside its P1 reservation in the
  // shared request budget (taken by the caller before the try starts); every request it sends is counted as it is sent, and it is never cut
  // short for lack of room.
  const timedOutTry = hasTimedOut(mem, s.clientOrderId);
  // Michael's ruling 1 of 2026-11-14 (night): a retry (a try for an entry already reported stuck) is one round, so it fits its reservation;
  // a first try keeps its 3 rounds (it is counted, never refused, decision 4).
  const ordinaryRetry = !timedOutTry && mem.stuck.has(s.clientOrderId);
  // A5: the fast sale has just looked the entry up itself, so it is not looked up a second time here. Item 2 of 2026-11-13: nor a try for an
  // entry with a timed-out stop (whose bracket exits ended long ago): the copy from this sync's own list or lookup is used.
  if (!extra.fast && !timedOutTry) try {
    const fresh = await d.broker.findOrderByClientId(s.clientOrderId);
    if (fresh) o = fresh;
    else d.log?.("cleanup_lookup_empty", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind });
  } catch (err) {
    d.log?.("cleanup_lookup_failed", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, error: (err as Error).message.slice(0, 120) });
  }
  const ownShares = o.filledQty - exitFilledQty(o);
  // A5: at the moment the entry's fill arrives, Alpaca has not cancelled its exits yet, so they still look live: the sale goes ahead and
  // waits for that cancel in sells.ts (if Alpaca keeps the exits, nothing is sold).
  const stillNeeded = extra.fast ? true : kind === "missing" ? !hasLiveExit(o) : bareRemainder(o) !== null;
  if (!(ownShares > EPS_QTY) || !stillNeeded) {
    d.log?.("cleanup_skipped", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, ownShares, liveExit: hasLiveExit(o) });
    await resolveStuck(d, mem, s.clientOrderId, ownShares > EPS_QTY ? "it has a live exit again" : "its own exit orders sold the shares");
    return { attempted: false, stuck: false };
  }
  // A5: nothing is cancelled by the fast sale (the exits are Alpaca's to cancel, or to keep).
  // Ruling B of 2026-11-12: `alsoCancel`, a fresh stop that was not confirmed in time (cancelled here, and never counted as protection).
  const cancelIds = extra.fast ? [] : [...flattenLegs(o).filter((l) => l.side === "sell" && OPEN_STATUSES.has(l.status)).map((l) => l.id), ...(extra.alsoCancel ?? [])];
  // Michael's decision 2 of 2026-11-13 (group 2, round 1 of the weekend build): this reason reaches Discord in the sell gate's refusal
  // alert, so it says only what the stack knows. Nothing branches on it.
  const reason = kind === "missing" ? "protective stop not confirmed" : "stop cancelled after a partial take-profit";
  // Fix C of 2026-11-10: the client ids of this entry's sales, for the closing line when a sale is not seen filled yet.
  const saleIds: string[] = [];
  let firstSaleAt: number | null = null;
  const sent = (x: { symbol: string; qty: number; clientOrderId: string; atMs: number }) => {
    if (x.symbol === s.symbol) {
      saleIds.push(x.clientOrderId);
      firstSaleAt ??= x.atMs;
    }
    onSellSent?.(x);
  };
  const protectAt = kind === "bare" && extra.stopPrice != null && extra.stopPrice > 0 ? extra.stopPrice : null;
  // The Alpaca client's own retries inside this sale are charged to the caller's reservation like any other request (request-scope.ts).
  const r = await d.liquidator.flatten({
    reason,
    tradeDate: day.tradeDate,
    only: [s.symbol],
    // Item 2 of 2026-11-13: a try for an entry with a timed-out stop runs one round, so a whole try fits its reservation (and the budget's
    // 15 in 5 seconds); the next try comes on the backoff.
    maxRounds: extra.fast || timedOutTry || ordinaryRetry ? 1 : 3,
    cancelIds,
    yieldToPriority: true,
    ownEntryOnly: { maxQty: { [s.symbol]: ownShares } },
    endWhenHiddenHold: !extra.fast,
    onSellSent: sent,
    ...(protectAt !== null ? { protectWithStop: { [s.symbol]: protectAt } } : {}),
    ...((extra.alsoCancel?.length ?? 0) > 0 ? { endOnCancelFail: true } : {}),
    // Item 2 of 2026-11-13: such a try waits half a second for Alpaca's cancel (a cancel usually lands in about 0.2 s), so a whole try (at
    // most about 13 requests) fits; after that the stop's status checks take over (timedOutWait).
    ...(timedOutTry ? { waitCancelMs: 500 } : {}),
    ...(extra.fast ? { waitForAlpacaCancel: true, waitCancelMs: FAST_LOST_EXIT_WAIT_MS } : {}),
  });
  const soldQty = r.sold.filter((x) => x.symbol === s.symbol).reduce((n, x) => n + x.qty, 0);
  const now = d.now().getTime();
  // Ruling B, group 2 round 3 (logging only): the outcome of the cancel of a timed-out fresh stop, logged after the sale tried it
  // (`cancelFailed`: a cancel this sale sent was not accepted, by Alpaca's answer or for lack of one).
  // Group 2, round 4: by what the sale really did with each such cancel (sent and answered, sent and not accepted, or never sent, for
  // example when the sale gave way to the loss stop's sale or the market was closed). Only a cancel Alpaca answered is remembered as
  // accepted (`timedOutCancelAccepted`, which spaces later cancels of that stop).
  const timedOutCancel = (extra.alsoCancel?.length ?? 0) > 0;
  const cancelOutcome = new Map<string, "accepted" | "refused" | "not sent">();
  if (timedOutCancel) {
    (extra.alsoCancel ?? []).forEach((orderId, i) => {
      const stopClientOrderId = extra.alsoCancelStops?.[i];
      if (!stopClientOrderId) return;
      const tried = r.cancelsTried?.includes(orderId) === true;
      const accepted = r.cancelsAccepted?.includes(orderId) === true;
      const outcome = accepted ? "accepted" : tried ? "refused" : "not sent";
      cancelOutcome.set(stopClientOrderId, outcome);
      const event = outcome === "accepted" ? "fresh_stop_timeout_cancel" : outcome === "refused" ? "fresh_stop_timeout_cancel_failed" : "fresh_stop_timeout_cancel_not_sent";
      d.log?.(event, { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId, by: extra.alsoCancelBy ?? "missing-exit sale", again: mem.timedOutCancelAccepted.has(stopClientOrderId), ...(outcome === "refused" ? { error: (r.errors.find((e) => e.includes("cancel failed")) ?? "").slice(0, 120) } : {}) });
      if (accepted) mem.timedOutCancelAccepted.add(stopClientOrderId);
    });
  }
  // Messaging only: what the last try saw of a timed-out stop the sync's list does not show is set again below (the hidden route); a stop
  // the list shows is read from the list by the 5 minute alert itself.
  // Group 2, round 5: only a try that read the account clears it (not one that gave way to the loss stop's sale, found the market closed,
  // or could not read positions).
  const stuckBefore = mem.stuck.get(s.clientOrderId);
  // Group 2, round 6: and only when that try's last look read both the open orders and the positions (`lastLookOk`); a look that failed
  // never saw the stop, so it cannot say the stop is gone.
  if (stuckBefore && !r.yielded && r.lastLookOk === true) delete stuckBefore.restingStop;
  // A4: the remainder now has a fresh stop. Nothing is sold; the entry stays open until the stop fills or the close-out sells it.
  if (r.freshStop && r.freshStop.symbol === s.symbol) {
    const f = r.freshStop;
    mem.freshStops.set(s.clientOrderId, { symbol: s.symbol, entryClientOrderId: s.clientOrderId, stopClientOrderId: f.clientOrderId, orderId: f.orderId, qty: f.qty, stopPrice: f.stopPrice, placedAt: f.sentAtMs, status: "accepted", lookedAt: now });
    { const stRec = mem.stuck.get(s.clientOrderId); if (stRec) stRec.freshStopRecorded = true; }
    const cancelled = extra.stopCancelledAt ? Date.parse(extra.stopCancelledAt) : NaN;
    // Ruling B: its time to confirm is Alpaca's answer to the order itself (`msToConfirm`).
    d.log?.("fresh_stop", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: f.clientOrderId, qty: f.qty, stopPrice: f.stopPrice, msFromStopCancel: Number.isFinite(cancelled) ? now - cancelled : null, msToConfirm: f.answerMs, confirmedBy: "answer" });
    try {
      d.onFreshStop?.({ symbol: s.symbol, shares: f.qty });
    } catch {
      /* a count must never break the sync */
    }
    await resolveStuck(d, mem, s.clientOrderId, "it has a fresh protective stop");
    return { attempted: true, stuck: false };
  }
  if (r.freshStopUnclear && r.freshStopUnclear.symbol === s.symbol) {
    const f = r.freshStopUnclear;
    // Ruling B: timed from its sending; looked up at the next look of the entry, 2 seconds on, then every 5 seconds while still unclear. The entry
    // itself is looked up at each of those syncs too (group 1, round 1 of the night release): one older than the sync's 10 minute list
    // would otherwise be skipped by the walk and its limit would come late.
    if (FRESH_STOP_LIMIT.on) mem.mustLook.add(s.clientOrderId);
    mem.freshStops.set(s.clientOrderId, { symbol: s.symbol, entryClientOrderId: s.clientOrderId, stopClientOrderId: f.clientOrderId, orderId: null, qty: f.qty, stopPrice: f.stopPrice, placedAt: f.sentAtMs, status: "unclear", lookedAt: 0 });
    { const stRec = mem.stuck.get(s.clientOrderId); if (stRec) stRec.freshStopRecorded = true; }
    return { attempted: true, stuck: false, recheckAt: now + 2_000 };
  }
  // Group 2 round 4 and the group 1 note with it (Michael's decision 1 of 2026-11-13): at the sale's last look, the entry's timed-out
  // stop was still open and holding the shares, either named by this sale to cancel (the sync's list showed it) or pending cancel (the
  // sync's list may not show it). Nothing was sold. Its cancel has not cleared: the stuck backoff (P1 tries of the shared budget), never
  // the next sync (before, a stop pending cancel that the sync's list did not show was retried at every sync). The 5 minute alert says the
  // stop rests at Alpaca. A live update that the stop ended still runs the sale at once.
  const stillOpen = soldQty === 0 ? r.freshStopStillOpen?.find((x) => x.symbol === s.symbol && mem.timedOutStops.get(x.clientOrderId) === s.clientOrderId) : undefined;
  if (stillOpen) {
    if (stopEndedDuringTry()) return dueNow(now);
    await reportTimedOutOnce(d, mem, s, now);
    const outcome = cancelOutcome.get(stillOpen.clientOrderId);
    const cancel = stillOpen.status === "pending_cancel" ? "pending" : outcome === "accepted" || (outcome === undefined && mem.timedOutCancelAccepted.has(stillOpen.clientOrderId)) ? "accepted" : outcome === "refused" ? "refused" : "not sent";
    const st = backoffStuck(mem, s.symbol, s.clientOrderId, now, "the cancel of the unconfirmed fresh stop has not cleared at Alpaca");
    st.restingStop = { stopClientOrderId: stillOpen.clientOrderId, cancel };
    d.log?.("fresh_stop_timeout_still_open", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: stillOpen.clientOrderId, status: stillOpen.status, retryInMs: st.nextAt - now });
    return { attempted: true, stuck: true, recheckAt: st.nextAt };
  }
  const heldBy = r.heldByFreshStop?.find((x) => x.symbol === s.symbol);
  if (heldBy && soldQty === 0 && mem.timedOutStops.has(heldBy.clientOrderId)) {
    await reportTimedOutOnce(d, mem, s, now);
    // Ruling B of 2026-11-12: a fresh stop that was not confirmed in time is never taken as protection again: cancelled now.
    // Group 1, round 3 of the night release (Michael's decision 1 of 2026-11-13, and his rule that every retry loop has a limit and a
    // backoff): only the FIRST accepted cancel of a stop gets a look in a second, a P1 try of the shared request budget (Alpaca's cancel then
    // shows, and the sale waits for it if still pending). If the stop still holds the shares after a cancel Alpaca accepted, or Alpaca refused the cancel, the entry goes on
    // the stuck backoff (5, 10, 20, then every 30 seconds), each retry a P1 try of the shared request budget (75 requests a minute since 2026-11-17, 60 before; 15 in 5
    // seconds). A live update that the stop ended still runs the sale at once (worker.ts, onFreshStopUpdate).
    if (stopEndedDuringTry()) return dueNow(now);
    const acceptedBefore = mem.timedOutCancelAccepted.has(heldBy.clientOrderId);
    d.log?.("fresh_stop_timeout_still_open", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, status: heldBy.status, by: "sale" });
    try {
      await d.broker.cancelOrder(heldBy.orderId);
      d.log?.("fresh_stop_timeout_cancel", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, by: "sale", again: acceptedBefore });
      mem.timedOutCancelAccepted.add(heldBy.clientOrderId);
      if (stopEndedDuringTry()) return dueNow(d.now().getTime());
      const stNow = mem.stuck.get(s.clientOrderId);
      if (!acceptedBefore) {
        // The look a second later is a retry like the others: due then, with its reservation in the shared budget when it runs (retryDue), so
        // several such stops at once take turns instead of bursting.
        if (stNow) {
          stNow.restingStop = { stopClientOrderId: heldBy.clientOrderId, cancel: "accepted" };
          stNow.lastTriedAt = now;
          stNow.nextAt = now + 1_000;
        }
        return { attempted: true, stuck: false, recheckAt: now + 1_000 };
      }
      const st = backoffStuck(mem, s.symbol, s.clientOrderId, now, "Alpaca accepted the cancel of the unconfirmed fresh stop but still shows it working");
      st.restingStop = { stopClientOrderId: heldBy.clientOrderId, cancel: "accepted" };
      return { attempted: true, stuck: true, recheckAt: st.nextAt };
    } catch (err) {
      d.log?.("fresh_stop_timeout_cancel_failed", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, by: "sale", again: acceptedBefore, error: (err as Error).message.slice(0, 120) });
      if (stopEndedDuringTry()) return dueNow(d.now().getTime());
      // Group 1, round 2 of the night release: refused or unanswered: tried again on the stuck backoff (5, 10, 20, then every 30 seconds)
      // within the shared request budget, never every second.
      const st = backoffStuck(mem, s.symbol, s.clientOrderId, now, "Alpaca did not accept the cancel of the unconfirmed fresh stop");
      st.restingStop = { stopClientOrderId: heldBy.clientOrderId, cancel: "refused" };
      return { attempted: true, stuck: true, recheckAt: st.nextAt };
    }
  }
  if (heldBy && soldQty === 0) {
    // A4 (group 1 review, round 1): a resting fresh stop of ours protects the shares: remember it, say nothing, not stuck.
    mem.freshStops.set(s.clientOrderId, { symbol: s.symbol, entryClientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, orderId: heldBy.orderId, qty: heldBy.qty, stopPrice: heldBy.stopPrice ?? 0, placedAt: now, status: heldBy.status, lookedAt: now });
    { const stRec = mem.stuck.get(s.clientOrderId); if (stRec) stRec.freshStopRecorded = true; }
    d.log?.("fresh_stop_recovered", { symbol: s.symbol, clientOrderId: s.clientOrderId, stopClientOrderId: heldBy.clientOrderId, by: "sale" });
    await resolveStuck(d, mem, s.clientOrderId, "it has a fresh protective stop");
    return { attempted: false, stuck: false };
  }
  if (soldQty === 0 && r.coveredByOwnSale?.includes(s.symbol)) {
    // A5 (group 1 review, rounds 1 and 2): another sale of ours (the fast sale, or the order sync's own) already covers the entry's
    // shares: nothing to do here, and not stuck. That sale says what happened.
    d.log?.(extra.fast ? "lost_exit_fast_skipped" : "cleanup_covered_by_own_sale", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, reason: "a sale of ours already covers it" });
    return { attempted: false, stuck: false };
  }
  if (extra.fast && soldQty === 0 && r.exitsKept?.includes(s.symbol)) {
    d.log?.("lost_exit_fast_skipped", { symbol: s.symbol, clientOrderId: s.clientOrderId, reason: "Alpaca kept the exits" });
    return { attempted: false, stuck: false };
  }
  if (extra.fast && firstSaleAt !== null) d.log?.("lost_exit_fast", { symbol: s.symbol, clientOrderId: s.clientOrderId, msFromFill: firstSaleAt - extra.fast.fillAtMs });
  if (r.yielded && soldQty === 0) {
    d.log?.(kind === "missing" ? "unprotected_position_yielded" : "bare_remainder_yielded", { symbol: s.symbol, to: r.stoodAside === "whole account" ? "a sale of the whole account (stood aside at its turn)" : r.stoodAside === "close-out" ? "the close-out (stood aside at its turn)" : "the daily loss stop's sale" });
    return { attempted: true, stuck: false };
  }
  const before = r.heldBefore?.[s.symbol];
  const after = r.heldAfter?.[s.symbol] ?? 0;
  // Fix A (Michael's approval of 2026-11-10): every one of the entry's shares has left the holding (its take-profit filled the rest while
  // its cancel landed, and our sale, if any, filled): sold, not stuck.
  const gone = r.ownGone?.includes(s.symbol) === true;
  if (soldQty === 0 && gone) {
    d.log?.("remainder_recount", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, counted: ownShares, recounted: 0, sold: 0 });
    await resolveStuck(d, mem, s.clientOrderId, "its own exit orders sold the shares");
    return { attempted: true, stuck: false };
  }
  // Fix A: what was still the entry's to sell when its sale was sent (its exits may have taken some while their cancel landed).
  let target = r.ownTarget?.[s.symbol] ?? ownShares;
  let soldWhole = (x: number) => (before === undefined ? r.flat || !r.remaining.includes(s.symbol) : gone || after <= before - x + EPS_QTY);
  let soldMeasure = ownShares;
  if (soldQty > 0 && soldQty < target - EPS_QTY) {
    // Fix A, the narrow case: the take-profit filled more before the sale's first look at the holding, so the recount could not see it.
    // One more look at the entry (one request, only here) says what was still its own.
    try {
      const again = await d.broker.findOrderByClientId(s.clientOrderId);
      const ownNow = again ? again.filledQty - exitFilledQty(again) : null;
      if (ownNow !== null && soldQty >= ownNow - EPS_QTY) {
        target = ownNow;
        soldMeasure = soldQty; // the holding at the sale's first look already lacked what the take-profit took
        soldWhole = (x: number) => (before === undefined ? r.flat || !r.remaining.includes(s.symbol) : after <= before - x + EPS_QTY);
      }
    } catch (err) {
      d.log?.("cleanup_lookup_failed", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, error: (err as Error).message.slice(0, 120) });
    }
  }
  if (soldQty > 0 && soldQty >= target - EPS_QTY) {
    if (target < ownShares - EPS_QTY) d.log?.("remainder_recount", { symbol: s.symbol, clientOrderId: s.clientOrderId, kind, counted: ownShares, recounted: target, sold: soldQty });
    // Its own shares are gone if the symbol's holding fell by at least that much (a newer position may still be held).
    const filled = soldWhole(soldMeasure);
    if (filled) {
      if (!(await resolveStuck(d, mem, s.clientOrderId, "sold"))) {
        if (kind === "missing") await d.say("alerts", `**${s.symbol}: I could not confirm a live protective stop, so I sold it.**`);
        // Messaging only (speed release, decision 6): the worker gathers these into one alert a minute; without it, posted at once.
        else if (d.onRemainderSold) d.onRemainderSold(s.symbol, soldQty);
        else await d.say("alerts", `**${s.symbol}: Alpaca cancelled its stop when the take-profit partly filled, so I sold the remaining ${soldQty} shares.**`);
      }
      return { attempted: true, stuck: false };
    }
    // The sell went out and Alpaca has not filled it yet (paper has held sells 16 seconds before submitting them): not a failure.
    const stuckNow = mem.stuck.get(s.clientOrderId);
    if (stuckNow?.alerted) stuckNow.saleSentAt = now; // messaging only: its resolution line says "sold" if the shares then go
    if (!stuckNow?.alerted) {
      const what = kind === "missing" ? `**${s.symbol}: I could not confirm a live protective stop.** I sent a sell for its ${plural(soldQty, "share")}` : `**${s.symbol}: Alpaca cancelled its stop when the take-profit partly filled.** I sent a sell for the remaining ${plural(soldQty, "share")}`;
      await d.say("alerts", `${what}; Alpaca has not filled it yet. I will say when it has.`);
      // Fix C: its closing line comes from the order sync when the sale is seen filled.
      mem.awaitingFill.set(s.clientOrderId, { symbol: s.symbol, qty: soldQty, kind, saleIds: [...saleIds], since: now });
    }
    return { attempted: true, stuck: false };
  }
  if ((r.flat || gone) && soldQty === 0) {
    d.log?.(kind === "missing" ? "unprotected_position_already_gone" : "bare_remainder_already_gone", { symbol: s.symbol });
    await resolveStuck(d, mem, s.clientOrderId, "no longer held");
    return { attempted: true, stuck: false };
  }
  // Stuck: its shares are still held and not all of them could be sold.
  const st = mem.stuck.get(s.clientOrderId) ?? { symbol: s.symbol, since: now, nextAt: 0, delayMs: 0, alerted: false, escalated: false, lastTriedAt: now, why: "" };
  st.lastTriedAt = now;
  const hidden = r.hiddenHold?.includes(s.symbol) === true;
  // Ruling B: a sale that had to cancel a timed-out fresh stop and is still stuck goes on the same backoff and budget class (P1) as a hidden hold,
  // whether Alpaca refused that cancel (group 1, round 2 of the night release) or accepted it and the stop still holds the shares (group 1,
  // round 3, Michael's decision 1 of 2026-11-13: before, the second case was tried again at every sync, about 165 requests a minute for
  // one stop whose cancel stayed pending). A live update that the stop ended still runs the sale at once.
  // Group 1, round 4: and whenever this entry has a timed-out stop at all (whatever state Alpaca shows it in), so no try of ruling B's
  // ever falls back to the retry at every sync.
  const hasTimedOutStop = [...mem.timedOutStops.values()].includes(s.clientOrderId);
  const endedNow = hasTimedOutStop && stopEndedDuringTry();
  if (endedNow) {
    // Group 1, round 5: the live update said the timed-out stop ended during this try: due again at once (when a whole try fits), not on
    // the backoff.
    st.nextAt = 0;
    delete st.restingStop;
  } else if (timedOutCancel || hasTimedOutStop) {
    st.delayMs = st.delayMs > 0 ? Math.min(st.delayMs * 2, backoffCap(mem, s.clientOrderId)) : STUCK_RETRY_FIRST_MS;
    st.nextAt = now + st.delayMs;
  } else {
    // Michael's ruling 1 of 2026-11-14 (night): an ordinary stuck sale (a hidden hold, or shares held by visible open orders) is tried again
    // 2 s later, or as soon as the shared request budget has room after that (`retryDue` makes the wait a room wake), not on a fixed longer
    // backoff. It replaces the November 9 backoff (5, 10, 20, then 30 s) and item 3's (10, 20, then 30 s) for these.
    st.delayMs = 0;
    st.visibleDelayMs = 0;
    st.nextAt = now + STUCK_RETRY_MIN_GAP_MS;
  }
  mem.stuck.set(s.clientOrderId, st);
  // Messaging only (group 2, round 4): the sale ended at once because Alpaca did not accept the cancel of the timed-out stop, which the
  // sync's list showed open at the start of this try.
  const refusedStop = [...cancelOutcome].find(([, v]) => v === "refused")?.[0];
  if (refusedStop && !endedNow) st.restingStop = { stopClientOrderId: refusedStop, cancel: "refused" };
  const left = Math.max(0, target - soldQty) || ownShares - soldQty;
  const lastError = [...r.errors].reverse()[0];
  const why = hidden ? "Alpaca reports the shares as not free to sell, and no open order explains it" : lastError ? lastError.slice(0, 120) : "still held";
  st.why = why;
  // Messaging only: a remainder the stack is trying to give a fresh stop (A4) is waiting to be protected, not only to be sold.
  const protecting = kind === "bare" && protectAt !== null;
  st.protecting = protecting;
  const how = kind === "missing" ? "its exits are gone" : "Alpaca cancelled the stop when the take-profit partly filled";
  if (!st.alerted) {
    st.alerted = true;
    // Group 2 review, round 1: since when. The latest cancel or expiry among the entry's own exits (as Alpaca reports it), else now.
    const endedAt = flattenLegs(o).filter((l) => l.side === "sell" && !OPEN_STATUSES.has(l.status)).map((l) => Date.parse(l.canceledAt ?? l.updatedAt ?? "")).filter((t) => Number.isFinite(t) && t <= now);
    const lostAt = new Date(endedAt.length > 0 ? Math.max(...endedAt) : now);
    const it = left === 1 ? "it" : "them";
    const tail = protecting ? `I keep trying and will post again when ${left === 1 ? "it has" : "they have"} a stop, ${left === 1 ? "is" : "are"} sold, or ${left === 1 ? "is" : "are"} gone.` : `I keep trying and will post again when ${left === 1 ? "it is" : "they are"} sold or gone.`;
    // Michael's decision 2 of 2026-11-13 (10:15 AM), messaging only: what the stack knows, true whether or not a stop rests at Alpaca.
    await d.say("alerts", `**Michael: I can't confirm a protective stop for ${s.symbol}'s ${plural(left, "share")} (since ${centralClock(lostAt)}), and I could not ${protecting ? "protect or sell" : "sell"} ${it} yet** (${how}; ${why}). I am checking, and I will ${protecting ? "protect or sell" : "sell"} ${it} if still unconfirmed. ${tail}`, { mentionOwner: true });
    // Group 2, round 6 (messaging only): not after a try whose last look failed (it has no view of the stop); the next sync's own
    // escalation, which has the order list, decides then.
  } else if (r.lastLookOk === true) await escalateIfDue(d, mem, s.clientOrderId, r.heldAfter?.[s.symbol]); // messaging only: the holding this sale last saw, read only
  return { attempted: true, stuck: true, ...(st.nextAt > 0 ? { recheckAt: st.nextAt } : endedNow ? { recheckAt: now } : {}) };
}

// What the loss stop remembers in this process (the worker keeps one). It lets the loss stop keep selling when the stop flag
// cannot be read: without it, a database that keeps failing would make every pass fire the stop again from scratch.
export class LossStopMemory {
  firedDate: string | null = null;
  lastSaveAlert = 0;
  // The retry of a failed loss stop sale (Michael's ruling, 2026-11-03): the pause after a rate-limit answer. Since the redesign of
  // 2026-11-14 (part 1) its requests come from the shared request budget (the worker's; `budget` here only when the deps bring none).
  budget?: RequestBudget;
  backoffMs = 0;
  backoffUntil = 0;
  turn = 0; // where the next retry starts in the list of unsold symbols, so with a tight budget every symbol gets its turn
  lastRetryAlert = 0;
  awaitingFlat = false; // the first sale ended with shares still held: say so once the account is flat
}

// THE LOSS STOP'S RE-SELLS AND THE SHARED REQUEST BUDGET (the redesign of 2026-11-14, part 1, Michael's approval with his change A): each
// retry check is class P1 of the shared budget (request-budget.ts: 75 a minute (60 before 2026-11-17) and 15 in any 5 seconds for every retry and check together),
// reserving LOSS_STOP_RETRY_PER_CHECK before it starts, and starts only while Alpaca's remaining requests stay at or above 20 after it. The
// equity check every 5 seconds is routine work (counted, not limited). The first sale when the stop fires is a first try: never held back
// (it is the stop's whole job), ONE round of the liquidator (cancel the exits, wait, sell each symbol), a bounded burst, counted.
// At most this many requests in one retry check, so the minute's budget is spread over the checks instead of spent in one burst.
export const LOSS_STOP_RETRY_PER_CHECK = 15;
// From one minute before the regular close-out the retry is quiet: the close-out (5 minutes before the close by default; the setting,
// Michael's night build request of 2026-11-16, item 4) sells everything still held, and the minute before it is left to it, so the
// close-out never starts on a request bucket the retry has just used. 6 minutes before the close at the default.
export const RETRY_QUIET_BEFORE_CLOSEOUT_MS = 60_000;
export function retryQuietBeforeCloseMs(closeoutMinutesBeforeClose = DEFAULT_CLOSEOUT_MINUTES_BEFORE_CLOSE): number {
  return closeoutMinutesBeforeClose * 60_000 + RETRY_QUIET_BEFORE_CLOSEOUT_MS;
}
const RETRY_BACKOFF_FIRST_MS = 10_000;
const RETRY_BACKOFF_MAX_MS = 60_000;
const LOSS_REFUSED_BACKOFF_FIRST_MS = 5_000;
const LOSS_REFUSED_BACKOFF_MAX_MS = 30_000;
const is429 = (err: unknown) => err instanceof AlpacaError && err.status === 429;

export interface LossStopOptions {
  // First check after a start: also look at today's equity history at Alpaca, so a loss stop that fired (or should have) before
  // a restart is found again even if equity has since recovered and the stop flag never reached the database (round 5).
  rederive?: boolean;
}

// The lowest equity Alpaca shows for today's session after a moment (the open, or the last saved change to the stop flag,
// whichever is later, so Michael's own `resume` is respected). Null when there is no point after that moment.
export async function worstEquitySince(d: Pick<RiskDeps, "broker">, sinceMs: number): Promise<number | null> {
  const points = (await d.broker.getEquityHistoryToday()).filter((p) => p.atMs > sinceMs);
  return points.length ? Math.min(...points.map((p) => p.equity)) : null;
}

// When equity has fallen by the approved daily loss limit, stop the day: set the stop flag, sell everything.
// Runs again and again without harm (once the flag is set it does nothing new).
//
// Review round 5: the sale waits on nothing but the broker. The stop-flag write, the run-log event and every Discord post are
// started and left to finish on their own (each with its own error handling), so a database or Discord that hangs cannot hold
// the sale back, and cannot leave this task stuck so that it never runs again. The order gate still refuses entries from the
// moment the stop is decided: the caching store (caching-store.ts) believes a stop as soon as `setControl` is called, before
// its first wait, and keeps believing it until a later write succeeds. If the stop flag cannot be READ, equity is checked
// anyway and the stop fires if the line is crossed (the direction of selling).
export async function enforceDailyLoss(d: RiskDeps, day: DayRecord, opts: LossStopOptions = {}): Promise<boolean> {
  // Not before arming: until then the starting equity may be an earlier day's number.
  // (A day that is re-arming after a lowered cap counts as armed: its start equity was read at the first arming, and the loss stop
  // must not go dark while a re-arm is failing.)
  if (day.status !== "approved" || !(day.phases.armed || day.phases.rearm) || day.dayStartEquity === null) return false;
  const mem = d.lossMemory;
  let flag: StopFlag | null = null;
  let flagUnreadable = false;
  try {
    flag = await d.store.getControl<StopFlag>(CONTROL_STOP);
  } catch (err) {
    flagUnreadable = true;
    d.log?.("loss_stop_flag_unreadable", { error: (err as Error).message.slice(0, 120) });
  }
  const firedHere = mem?.firedDate === day.tradeDate;
  if (flag?.on || (flagUnreadable && firedHere)) {
    // The loss stop already fired. If its sale did not finish, try again on every pass. An owner's plain `stop` is
    // left alone: it keeps positions.
    if ((flag?.on && flag.reason.startsWith("daily loss stop")) || (flagUnreadable && firedHere)) await retryLossStopSale(d, day);
    return false;
  }
  const account = await d.broker.getAccount();
  try {
    d.onAccountRead?.(account);
  } catch {
    /* shadow logging must never break the loss stop */
  }
  const start = day.dayStartEquity;
  const limit = day.limits.dailyLossStopUsd;
  let loss = start - account.equity;
  let earlier: number | null = null;
  if (loss < limit && opts.rederive && day.openAt) {
    const savedAt = flag?.at ? Date.parse(flag.at) : NaN;
    const since = Math.max(day.openAt.getTime(), Number.isFinite(savedAt) ? savedAt : 0);
    const worst = await worstEquitySince(d, since);
    if (worst !== null && start - worst >= limit) {
      earlier = worst;
      loss = start - worst;
    }
  }
  if (loss < limit) return false;
  if (mem) mem.firedDate = day.tradeDate;
  const why = earlier !== null ? `daily loss stop reached earlier today (equity fell to ${earlier.toFixed(2)}, found after a restart)` : `daily loss stop reached (${loss.toFixed(2)} dollars)`;
  const flagNow: StopFlag = { on: true, at: d.now().toISOString(), reason: why };
  // Not waited on (see above). The caching store already believes the stop when this call returns.
  void d.store.setControl(CONTROL_STOP, flagNow).catch((err) => {
    const t = d.now().getTime();
    if (mem && t - mem.lastSaveAlert < 5 * 60_000) return;
    if (mem) mem.lastSaveAlert = t;
    void d.say("alerts", `**Michael: the daily loss stop was reached but the stop flag could not be saved** (${(err as Error).message.slice(0, 80)}). I sold anyway, I keep the stop in force in memory, and I keep trying to save it.`, { mentionOwner: true }).catch(() => undefined);
  });
  void d.store.addEvent("warn", "daily_loss_stop", { loss, earlier }).catch(() => undefined);
  // One round (round 8): with sells refused, the liquidator's later rounds would send every refused sell again, with fresh reads
  // each time (about 500 requests for 40 positions, more than Alpaca allows in a minute). What is still unsold after this round
  // is retried by retryLossStopSale on the next checks, every 5 seconds, inside the budget.
  const r = await withReservation(budgetOf(d, mem ?? fallbackMemory).first("loss stop first sale"), () => d.liquidator.flatten({ reason: "daily loss stop", tradeDate: day.tradeDate, maxRounds: 1, priority: true }), "first");
  // Sells that went out but have not filled yet are not failures; only symbols with no sell sent are.
  const unsold = r.remaining.filter((sym) => !r.sold.some((x) => x.symbol === sym));
  if (mem && !r.flat) mem.awaitingFlat = true;
  const outcome = r.flat ? (r.sold.length > 0 ? "sold everything" : "nothing was held, so nothing needed selling") : unsold.length === 0 ? "sent a sell for every position (I will say when the account is flat)" : `sent sells, but could not sell ${unsold.join(", ")} yet (I retry only those, every 5 seconds)`;
  void d.say("commands", `**Daily loss stop reached** (down ${loss.toFixed(2)} of the ${limit} dollar limit${earlier !== null ? ", seen in today's equity history after a restart" : ""}). Stopped for the day and ${outcome}.`).catch(() => undefined);
  if (unsold.length > 0) void d.say("alerts", `**Michael: daily loss stop reached but I could not sell ${unsold.join(", ")} yet.** Check Alpaca now. I retry every 5 seconds.`, { mentionOwner: true }).catch(() => undefined);
  return true;
}

// Sells what the loss stop failed to sell (Michael's ruling, 2026-11-03): on every loss stop check (every 5 seconds), only the
// symbols still held, each with one sell through the sell gate, never another whole-account liquidation. Inside the loss stop's
// request budget and never below the governor's safety reserve, so it cannot crowd out the close-out, a flatten, a stop or a
// protective sell; it stands aside completely while any liquidation (close-out, flatten, carried position, the first sale) runs.
// It pauses after a rate-limit answer from Alpaca (10 seconds, doubling to 60) and, since item 3 of 2026-11-13, after a check in which
// every sale was refused (5 seconds, doubling to 30). Shares still held by an exit resting at Alpaca (an entry that filled late) have that exit cancelled first; the
// sale follows on the next check. A sell of ours that is still working is left alone.
async function retryLossStopSale(d: RiskDeps, day: DayRecord): Promise<void> {
  const mem = d.lossMemory ?? fallbackMemory;
  const nowMs = d.now().getTime();
  if (d.liquidator.isLiquidating()) return;
  if (nowMs < mem.backoffUntil) return;
  if (day.closeAt && nowMs >= day.closeAt.getTime() - retryQuietBeforeCloseMs(d.closeoutMinutesBeforeClose)) return;
  // The redesign of 2026-11-14, part 1: the check's whole room is reserved in the shared request budget first (P1, at most
  // LOSS_STOP_RETRY_PER_CHECK requests, down to 20 of Alpaca's remaining). Without room the check waits for the next one (5 seconds).
  // Michael's ruling of 2026-11-09 ("within 60 Alpaca requests a minute (like the loss stop's retry)"): it keeps its 60 of the shared 75
  // (RULED_MINUTE_CAP, decision 2 of 2026-11-17; group 2, round 1).
  const res = budgetOf(d, mem).tryReserve("P1", LOSS_STOP_RETRY_PER_CHECK, { label: "loss stop re-sell", ruledCap: true });
  if (!(res instanceof Reservation)) return;
  await withReservation(res, () => retryLossStopCheck(d, day, mem));
}

async function retryLossStopCheck(d: RiskDeps, day: DayRecord, mem: LossStopMemory): Promise<void> {
  let spentHere = 0;
  // Within the check's reservation: at most LOSS_STOP_RETRY_PER_CHECK requests, as before.
  const canSpend = (n: number) => spentHere + n <= LOSS_STOP_RETRY_PER_CHECK;
  const spend = (n: number) => {
    spentHere += n;
  };
  const rateLimited = () => {
    mem.backoffMs = Math.min(RETRY_BACKOFF_MAX_MS, mem.backoffMs > 0 ? mem.backoffMs * 2 : RETRY_BACKOFF_FIRST_MS);
    mem.backoffUntil = d.now().getTime() + mem.backoffMs;
    d.log?.("loss_stop_retry_backoff", { ms: mem.backoffMs });
  };
  // The cheap look first (1 request): flat means nothing to do, which is every check of a normal afternoon after the stop.
  if (!canSpend(1)) return;
  spend(1);
  let held;
  try {
    held = await d.broker.listPositions();
  } catch (err) {
    if (is429(err)) return rateLimited();
    throw err;
  }
  if (held.length === 0) {
    mem.backoffMs = 0;
    if (mem.awaitingFlat) {
      mem.awaitingFlat = false;
      void d.say("commands", "Daily loss stop: everything is sold, the account is flat.").catch(() => undefined);
    }
    return;
  }
  const gate = d.liquidator.sellGate;
  if (!canSpend(2)) return;
  spend(2);
  let view;
  try {
    gate.invalidate();
    view = await gate.look(); // open orders, then positions, as the gate checks sells against them
  } catch (err) {
    if (is429(err)) return rateLimited();
    throw err;
  }
  // A sale already working: any open market sell (ours, or one placed by hand at Alpaca) is left alone, never cancelled; only the
  // shares no sell covers are sold again.
  const ours = (o: Order) => o.side === "sell" && (o.type === "market" || o.clientOrderId.startsWith("cyrus-x-"));
  const others = view.open.filter((o) => !ours(o));
  const mine = view.open.filter(ours);
  const n = view.positions.length;
  const first = n > 0 ? mem.turn % n : 0;
  const ordered = [...view.positions.slice(first), ...view.positions.slice(0, first)];
  let sent = 0;
  let hit429 = false;
  let looked = 0;
  const failed: string[] = [];
  for (const p of ordered) {
    looked++;
    const openMine = openSellQty(mine, p.symbol);
    const openOthers = openSellQty(others, p.symbol);
    const free = Math.min(p.qty - openMine - openOthers, p.qtyAvailable ?? Infinity);
    if (free > 1e-6) {
      const cost = gate.needsRead() ? 3 : 1; // the gate reads again (2 requests) after a refused sell
      if (!canSpend(cost)) {
        looked--;
        break;
      }
      spend(cost);
      const id = `cyrus-x-${day.tradeDate.replaceAll("-", "")}-${p.symbol}-${d.now().getTime().toString(36)}-r`;
      const r = await gate.sell({ symbol: p.symbol, qty: free, clientOrderId: id, reason: "daily loss stop (retry)" });
      if (r.status === "sent") sent++;
      else {
        failed.push(p.symbol);
        if (r.status === "error" && r.httpStatus === 429) {
          hit429 = true;
          break;
        }
      }
    } else if (openOthers > 1e-6 && openMine <= 1e-6) {
      for (const id of openOrderIds(others, new Set([p.symbol]))) {
        if (!canSpend(1)) break;
        spend(1);
        try {
          await d.broker.cancelOrder(id);
        } catch (err) {
          if (is429(err)) hit429 = true;
          break;
        }
      }
      if (hit429) break;
    }
  }
  mem.turn = n > 0 ? (first + looked) % n : 0; // the next check starts where this one stopped
  if (hit429) rateLimited();
  else if (failed.length > 0 && sent === 0) {
    // Item 3 of 2026-11-13 (Michael's retry rule): every sale this check tried was refused (not a rate limit): the next check waits 5
    // seconds, doubling to 30 (kept short: this is the loss stop's sale).
    mem.backoffMs = Math.min(LOSS_REFUSED_BACKOFF_MAX_MS, mem.backoffMs > 0 ? mem.backoffMs * 2 : LOSS_REFUSED_BACKOFF_FIRST_MS);
    mem.backoffUntil = d.now().getTime() + mem.backoffMs;
    d.log?.("loss_stop_retry_backoff", { ms: mem.backoffMs, refused: failed.length });
  } else mem.backoffMs = 0;
  d.log?.("loss_stop_sale_retried", { held: n, sent, failed: failed.length, backoffMs: mem.backoffMs });
  // At most one nudge every 5 minutes, not one on every check.
  if (failed.length > 0 && d.now().getTime() - mem.lastRetryAlert >= 5 * 60_000) {
    mem.lastRetryAlert = d.now().getTime();
    void d.say("alerts", `**Michael: daily loss stop: selling is still failing (${failed.slice(0, 10).join(", ")}${failed.length > 10 ? ", ..." : ""}).** I retry only those every 5 seconds, inside a fixed request budget. Check Alpaca now.`, { mentionOwner: true }).catch(() => undefined);
  }
}
const fallbackMemory = new LossStopMemory();

// While the stop flag is on, cancel any entry that has not filled. This catches an entry that passed the gate's
// last look at the flag just before a stop command and reached Alpaca after the command's own cancel pass.
// Exits resting at Alpaca (sell orders) and entries that have started to fill are left alone.
// Part of the stop command's work (the redesign of 2026-11-14): its requests are counted as a first try, never refused.
export async function sweepEntriesWhileStopped(d: RiskDeps): Promise<number> {
  return inRequestScope({ tag: "first" }, () => sweepEntriesNow(d));
}
async function sweepEntriesNow(d: RiskDeps): Promise<number> {
  const flag = await d.store.getControl<StopFlag>(CONTROL_STOP);
  if (!flag?.on) return 0;
  const open = await d.broker.listOrders("open");
  let n = 0;
  for (const o of open) {
    if (o.side === "buy" && o.filledQty === 0) {
      await d.broker.cancelOrder(o.id);
      n++;
    }
  }
  if (n > 0) {
    d.log?.("entries_swept_while_stopped", { cancelled: n });
    await d.say("commands", `The stop flag is on and ${n} unfilled entr${n === 1 ? "y" : "ies"} reached Alpaca late, so I cancelled ${n === 1 ? "it" : "them"}.`);
  }
  return n;
}

// A5 of the proposal of 2026-11-12 (Michael's approval): a load-window entry filled as the stack's 5 second cancel reached Alpaca. On
// 2026-11-11 Alpaca then cancelled both exits in 24 of 24 such cases (0.05 to 1.06 s later), and five waited 10 to 17 s for the order sync.
// The entry's share is sold at once through the checked sell path; the sale waits in sells.ts for Alpaca's cancel to free the share, and
// sells nothing if Alpaca kept the exits. Never throws.
export async function fastLostExitSale(d: RiskDeps, day: DayRecord, mem: SyncMemory, s: OrderRecord, fillAtMs: number): Promise<void> {
  // A first try (the redesign of 2026-11-14, part 1): counted, never refused.
  // Item 3 of the night build (decision 4 changed): the fast sale's first try would wait for room too, at most 3 s; switched off
  // (FIRST_TRY_PACING), so it goes at once as on v24.
  if (d.sleep) await budgetOf(d, mem).paceFirst(FIRST_TRY_MOST, "fast sale", d.sleep, true);
  return withReservation(budgetOf(d, mem).first("fast sale"), () => fastLostExitSaleInner(d, day, mem, s, fillAtMs), "first");
}
async function fastLostExitSaleInner(d: RiskDeps, day: DayRecord, mem: SyncMemory, s: OrderRecord, fillAtMs: number): Promise<void> {
  try {
    const o = await d.broker.findOrderByClientId(s.clientOrderId);
    // Michael's mid-day build of 2026-11-16, item 3: these two endings are stored too (`lost_exit_fast_ended`); with
    // `unprotected_position_yielded` now stored as well, every way a fast sale ends leaves a stored event (on 2026-11-16, 24 of 68 starts had
    // none stored). Logging only.
    if (!o || !(o.filledQty > 0) || o.side !== "buy") {
      d.log?.("lost_exit_fast_ended", { symbol: s.symbol, clientOrderId: s.clientOrderId, why: "Alpaca shows no filled buy for it" });
      return;
    }
    if (exitFilledQty(o) > 1e-9) {
      // an exit has sold shares: it was not a lost-exit case
      d.log?.("lost_exit_fast_ended", { symbol: s.symbol, clientOrderId: s.clientOrderId, why: "an exit already sold its shares", exitFilledQty: exitFilledQty(o) });
      return;
    }
    await cleanupSale(d, day, mem, s, o, "missing", undefined, { fast: { fillAtMs } });
  } catch (err) {
    d.log?.("lost_exit_fast_failed", { symbol: s.symbol, error: (err as Error).message.slice(0, 120) });
  }
}
