// The scheduler: one pass every few seconds ("tick") that runs the day. Each step of the day is recorded in
// the database when it finishes, so a restart picks up where it left off and never repeats a step.
//
// A day, in New York time (Michael sees Central time in messages):
//   close + 10 min  request for the NEXT trading day's limits, with a checklist (Michael answers that evening)
//   open - 60 min   review of that day's limits (he can change them again)   open - 10 min  reminder if undecided
//   open - 45 min   daily screen builds the live list      open - 5 min   arming (cap and long only set at Alpaca), live prices
//   open            undecided limits lapse: no trading     open to close  entries (gate), order sync, loss stop
//   close - 5 min   close-out: flat                        close + 5 min  daily summary
// Commands are read on every tick, at any hour. The heartbeat is sent at the end of a tick that worked, and
// "fail" after a tick that did not, so Healthchecks hears when the worker is unwell, not only when it is dead.
import type { FullBroker } from "./broker.ts";
import { BrokerView } from "./broker-view.ts";
import { CommandProcessor, afternoonFailureTail, plainStop, type CommandBot } from "./commands.ts";
import { dayOrderIndex } from "./order-index.ts";
import { COMMAND_READ_LIMIT } from "./discord-bot.ts";
import { DIGEST_PERIOD_MS, TradeDigest } from "./digest.ts";
import { addToRunning, CONTROL_FEES, estimateFees, type FeesRunning } from "./fees.ts";
import type { Governor } from "./governor.ts";
import { Liquidator, OPEN_STATUSES, SellGate, flattenLegs } from "./sells.ts";
import { MoveWatch } from "./moved-take-profit.ts";
import type { Order } from "./alpaca-trading.ts";
import { formatLiveList } from "./universe.ts";
import type { Settings } from "./config.ts";
import { closeOut } from "./closeout.ts";
import { OrderGate, peakKey } from "./gate.ts";
import { resetOldShapeFutureDays, armDay, ensureDay, lapseIfUndecided, NextSessionFinder, postLimitsRequest, postMorningReview, postReminderIfNeeded, suggestedFromHistory, type MorningSteps } from "./morning.ts";
import { ProgressGap, RetryBackoff } from "./retry-backoff.ts";
import { BARE_GRACE_MS, enforceDailyLoss, fastLostExitSale, LossStopMemory, noteTimedOutStopEnded, settleFreshStop, SyncMemory, sweepEntriesWhileStopped, syncOrders } from "./risk.ts";
import type { SelfMonitor } from "./self-monitor.ts";
import { SCREEN_MINUTES_BEFORE_OPEN, AFTERNOON_FLAT_PHASE, AFTERNOON_PAUSE_REASON, LOAD_ENTRY_WAIT_MS, LOAD_NOTE_PHASE, afternoonCloseoutPending, afternoonLoadStart, afternoonLoadWindow, inLoadWindow, isLoadDay, loadExitsAt, loadLine, loadWindow, type LoadExits } from "./load-mode.ts";
import { BusyPlaceholder } from "./strategy.ts";
import { OrderUpdateHandler, type TradeUpdate } from "./order-stream.ts";
import { EntryExpiry } from "./entry-expiry.ts";
import { StopGapMeter, stopGapKey } from "./stop-gap.ts";
import { ShadowLedger } from "./shadow-ledger.ts";
import { earlyLookAllowed } from "./early-wake.ts";
import type { Trade } from "./stream.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP, setPhase, type DayRecord, type NotFlatState, type StopFlag, type Store } from "./store.ts";
import { computeDay, formatSummary, isSentEntry, knownOrderIds, type StopGapDay } from "./summary.ts";
import { listDaySliced, summaryWindows } from "./summary-listing.ts";
import { addMinutes, centralClock, dayWord, etDate, etInstant, sessionPhase } from "./time.ts";
import { PAPER_ONLY } from "./discord.ts";
import { CLOSEOUT_RETRY_MOST, MIDDAY_NOT_FLAT_ALERT_AFTER_MS, MIDDAY_NOTE_PHASE, MIDDAY_PHASE, MIDDAY_RETRY_MS, blockedNext, lossPast, middayFlat, middayTimes, readHold, readPause, resumedByText, retrySymbols, startupAction, updatePause } from "./midday.ts";
import { Reservation, RequestBudget, withReservation } from "./request-budget.ts";
import { ProtectFirst } from "./protect-first.ts";
import { inRequestScope, outsideScope } from "./request-scope.ts";
import { ProtectionLoop, type WakeKind } from "./protection.ts";
import type { PingKind } from "./heartbeat.ts";

export type Channel = "commands" | "trading" | "alerts";

export interface StreamLike {
  start(): void;
  stop(): void;
  status(): string;
  // A new live list on the same connection (the afternoon load window). A stream without it is stopped and started again.
  setSymbols?(symbols: string[]): void;
}

export interface LiveListResult {
  symbols: string[];
  names: Record<string, string>;
}

export interface WorkerDeps {
  // The moved take-profit (Michael's decision of 2026-11-18): the latest bid and ask of some symbols, in one market-data read with a short
  // time limit. Unset (the tests that do not set it): no take-profit is moved; every sale keeps today's path.
  latestQuotes?: (symbols: string[]) => Promise<ReadonlyMap<string, { bid: number; ask: number; atMs: number; tradePrice?: number; tradeAtMs?: number }>>;
  settings: Settings;
  broker: FullBroker;
  governor: Governor;
  store: Store;
  bot: CommandBot;
  now: () => Date;
  ping: (kind: PingKind) => Promise<boolean>;
  // Builds the day's live list (universe, daily bars, screen). Slow (minutes), so it runs in the background.
  buildLiveList: (opts?: { load?: boolean }) => Promise<LiveListResult>;
  makeStream: (symbols: string[], onTrade: (t: Trade) => void) => StreamLike;
  // Self-monitoring (Michael's approval of 2026-11-11): one `self_monitor` row a minute in the session. Absent: none.
  selfMonitor?: Pick<SelfMonitor, "sample">;
  // `load afternoon` on (the tests only, in the release of 2026-11-11: switched off, Michael's fallback option B).
  loadAfternoon?: boolean;
  // Alpaca's live order updates (order-stream.ts), connected from "Armed" to the close on every day (the speed release; release B
  // had them on load days only). Optional: without it the order sync alone frees symbols, as before.
  // `onStatus` (Michael's mid-day build of 2026-11-16, item 1): the stream's status as it changes, so a reconnect can bring an order sync.
  makeOrderStream?: (onUpdate: (u: TradeUpdate) => void, onStatus?: (status: string) => void) => StreamLike & { reconnects?: () => number };
  sleep?: (ms: number) => Promise<void>;
  log?: (level: "info" | "warn" | "error", event: string, data?: Record<string, unknown>) => void;
  // The timer for the order sync brought forward by a stop's cancel (default setTimeout; the tests run it by hand).
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  // The mid-day cycle (Michael, 2026-11-09) is on unless this is false. main.ts never sets it; only tests about something else, whose
  // simulated day crosses 10:30 AM Central, turn it off (the cycle itself is tested in test/midday.test.ts).
  middayCycle?: boolean;
  // The redesign of 2026-11-14, part 1: the shared request budget (main.ts makes it, so the Alpaca client's `onSend` counts into it).
  // Without one, the worker makes its own on its clock and the governor's estimate of Alpaca's remaining requests.
  budget?: RequestBudget;
}

// The speed release, item 3: the order sync runs every 10 seconds on every day (it was 30 on a normal day, 10 on a load day). With the
// live order updates connected it is the backstop and reads only the last 10 minutes of orders (risk.ts).
// Decision 2 of 2026-11-06: the day phase set when shares carried from an earlier day were sold (the summary's "carried" note).
export const CARRIED_PHASE = "carried";
// Decision 2 of 2026-11-06: the summary's reads (on a day of 10,000 fills or more, a few hundred: the fills' pages and the lookups) wait
// while Alpaca's request budget is below this, so the summary never runs the bucket low and never causes a rate-limit answer.
export const SUMMARY_MIN_BUDGET = 100;
export const SYNC_EVERY_MS = 10_000;
// Michael's mid-day build of 2026-11-16, item 4: the most entries the morning line looks up at Alpaca (those still stored as working).
export const MORNING_LINE_LOOKUPS = 20;
// Group 2, round 1: the most time, in all, the morning line's lookups may take (real time).
export const MORNING_LINE_LOOKUP_MS = 3_000;
// The speed release, item 8: the gate's cached account and positions are read every 10 seconds while the live order updates are
// connected (they keep the positions current in between), and every 5 seconds, as before, while they are not. 10, not the
// proposal's 15: the gate refreshes a view older than 15 seconds inside the order path, and passes run every 5 seconds.
export const VIEW_EVERY_MS = 10_000;
export const VIEW_EVERY_NO_STREAM_MS = 5_000;
// The speed release, item 10: the request and stream statistics are written every minute of the session (they were every 5 minutes,
// and every minute only around a load window).
export const STATS_EVERY_MS = 60_000;
// A self-monitoring sample covering more than this is written as a marker row only (`longWindow`).
export const SELF_MONITOR_MAX_WINDOW_MS = 120_000;
// Successful remainder sales (shares left without a stop, sold by the order sync) are gathered into one alert a minute (the speed
// release, decision 6): on 2026-11-05 they were 101 separate alerts, and at the 3 second grace of that time about 270 a day were expected.
// A sell not filled yet is still posted at once; a position that cannot be sold gets one alert, one after 5 minutes and one line when it
// resolves (release 1 of 2026-11-09, risk.ts `cleanupSale`).
export const REMAINDER_ALERT_EVERY_MS = 60_000;
// (Since A4 of 2026-11-12 a remainder gets a fresh stop, so these sales are only the fallbacks: a refused fresh stop, or another position on
// the symbol.)

// The batched alert: one line listing each symbol and the shares sold.
export function remainderAlert(sales: Array<{ symbol: string; shares: number }>): string {
  const n = sales.length;
  return `**Sold ${n} remainder${n === 1 ? "" : "s"} left without a stop** (Alpaca cancelled the stop when the take-profit partly filled): ${sales.map((s) => `${s.symbol} ${s.shares}`).join(", ")}.`;
}
const FLUSH_EVERY_MS = 60_000;
// The close-out's first retry wait before the close (item 3 of 2026-11-13: then 40 s, at most 60, and 20 s again in the last minute).
const CLOSEOUT_RETRY_MS = 20_000;
// Michael's change B of 2026-11-14: from this long before the close (2:58 PM Central on a normal day) the regular close-out's retry (at
// the set time, 2:55 by default) is counted but never refused by the shared request budget, so the account always gets flat before the close.
export const CLOSEOUT_NEVER_REFUSED_MS = 2 * 60_000;
// Item 3 of 2026-11-13: the wait before the next try after `attempts` tries: `firstMs` after the first, doubling, at most `maxMs`.
export function retryGapMs(firstMs: number, attempts: number, maxMs = 3 * firstMs): number {
  return attempts <= 1 ? firstMs : Math.min(firstMs * 2 ** (attempts - 1), maxMs);
}
// The daily loss stop is checked every 5 seconds (Michael's ruling, 2026-11-03; it was 30, then 10). Passes run on a 5 second
// tick, so the check runs on every tick; the 1 second allowance keeps a tick that fires a few milliseconds early from pushing it
// to 10.
export const LOSS_STOP_EVERY_MS = 5_000;
const LOSS_STOP_SLACK_MS = 1_000;
// Michael's ruling, 2026-11-03: if his commands cannot be read for this long, new entries are blocked (one alert) until a read
// works again. Stops at Alpaca, the daily loss stop and the close-out carry on. After a start, entries also wait for the first
// read that works: a `stop` sent while the worker was down may be waiting, and the worker cannot know how long it has waited.
export const COMMANDS_UNREAD_BLOCK_MS = 120_000;
// A pass that has run this long is stuck (review round 5, finding 1). Every call in a pass has its own time limit now, so this
// should never happen; if it does, the watchdog takes over the safety work that needs only the broker (see watchdog()).
export const PASS_WATCHDOG_MS = 60_000;

// The afternoon screen switches the live list only while nothing trades, by the route its command came in: the mid-day pause on with
// no stop (as before), or (Michael's ruling E of 2026-11-12) Michael's own stop still on (`stop` or `flatten`, never the daily loss
// stop), which keeps entries off until the window starts.
export function switchAllowed(pause: { on: boolean } | null, stop: StopFlag | null, route: "pause" | "stop" = "pause"): boolean {
  return route === "stop" ? plainStop(stop) : Boolean(pause?.on) && !stop?.on;
}
// Why it was not allowed (only called when switchAllowed is false); the pause route keeps its earlier wording.
export function notSwitchedWhy(pause: { on: boolean } | null, stop: StopFlag | null, route: "pause" | "stop" = "pause"): string {
  if (route === "stop") return stop?.on ? "the daily loss stop is on" : "the stop flag was cleared";
  return stop?.on ? "the stop flag is on" : "trading is no longer paused for the mid-day cycle";
}

export class Worker {
  private readonly d: WorkerDeps;
  private readonly commands: CommandProcessor;
  private readonly gate: OrderGate;
  private readonly inflight = new Set<string>();
  private stream: StreamLike | null = null;
  private streamDate: string | null = null;
  private strategy: BusyPlaceholder | null = null;
  private lastSync = 0;
  private lastTradeAt: Date | null = null;
  private lastTickError: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private failedTicks = 0;
  private lastOkPing = 0;
  private notFlat = false;
  private notFlatLoaded = false;
  private notFlatSaved = false;
  private lastFlowAlert = 0;
  private lastCarriedScan = 0;
  private lastScanAlert = 0;
  private notFlatAlertDate: string | null = null;
  private emergencyDate: string | null = null;
  private lastCloseoutAttempt = 0;
  // Item 3 of 2026-11-13 (Michael's retry rule: a maximum number of tries or a maximum rate, always with a backoff): one backoff for each
  // older retry that had none. Each wait starts small and doubles to its cap; a success resets it.
  private readonly unsavedStopRetry = new RetryBackoff(5_000, 30_000);
  private readonly notFlatSaveRetry = new RetryBackoff(5_000, 30_000);
  private readonly migrateRetry = new RetryBackoff(5_000, 60_000);
  private readonly carriedScanRetry = new RetryBackoff(5_000, 60_000); // the first retry on the next pass, as before
  private readonly lapseRetry = new RetryBackoff(5_000, 60_000);
  private readonly stopGapRetry = new RetryBackoff(5_000, 60_000);
  private readonly limitsFlowRetry = new RetryBackoff(5_000, 60_000);
  private readonly armRetry = new RetryBackoff(10_000, 60_000);
  // Background steps that are retried when they fail (the screen, the daily summary): waits by step name.
  private readonly stepRetry = new Map<string, RetryBackoff>([
    ["screen", new RetryBackoff(5_000, 60_000)],
    ["summary", new RetryBackoff(5_000, 5 * 60_000)],
  ]);
  private lastCarriedAttempt = 0;
  // The redesign of 2026-11-14: what the last carried-position try sent (the next retry's reservation).
  private carriedLastCost: number | null = null;
  private carriedAttemptDate: string | null = null;
  private carriedAttempts = 0;
  // Group 1, round 2 of the weekend build: the mid-day and afternoon close-out retries grow their wait only while they sell nothing.
  private readonly middayProgress = new ProgressGap();
  private readonly afternoonProgress = new ProgressGap();
  // Close-out tries since the close (their own count: the tries before the close do not lengthen the first wait after it).
  private closeoutAttemptsAfterClose = 0;
  private lastArmAttempt = 0;
  private lastArmAlert = 0;
  // True while any close-out (regular, carried-over or emergency) is running, so two never overlap.
  private closingOut = false;
  private readonly sessions: NextSessionFinder;
  private readonly view: BrokerView;
  private readonly digest = new TradeDigest();
  private readonly liquidator: Liquidator;
  private readonly sellGate: SellGate;
  private migrated = false;
  private lastViewSlow = 0;
  private lastDigest = 0;
  private remainderSales: Array<{ symbol: string; shares: number }> = [];
  private lastRemainderAlert = 0;
  private lastFlush = 0;
  private lastStatsEvent = 0;
  private lastViewError = 0;
  private lastLossCheckAlert = 0;
  private lastCommandReadOk: number | null = null;
  private startedAtMs: number | null = null;
  private commandsAlerted = false;
  // Review round 5 (finding 1): when the current pass started, and the watchdog's state for a pass that runs too long.
  private passStartedAt = 0;
  private watchdogRunning = false;
  private watchdogAlerted = false;
  private lastWatchdogPing = 0;
  // Review round 5 (finding 3): the last day record read for today, used when the database cannot be read.
  private lastDay: DayRecord | null = null;
  private lastDayFallbackAlert = 0;
  private passDegraded = false;
  private lastMigrateAlert = 0;
  // The loss stop's own schedule and memory, and the date its first check after this start (with today's equity history) worked.
  private lastLossStop = 0;
  private readonly lossMemory = new LossStopMemory();
  // Release A, fix 1: what the order sync remembers between runs, and when a bare remainder reaches its grace time (the next
  // sync runs then instead of waiting the full 10 or 30 seconds).
  private readonly syncMemory = new SyncMemory();
  // Release A, fixes 3 and 5: the day whose close-out has been attempted, and how many times (the first is "close-out", the
  // rest "retry"). The carried-position sale never runs on a day whose close-out has started.
  private closeoutAttemptDate: string | null = null;
  private closeoutAttempts = 0;
  // Release A, fix 5: heartbeat failure signals sent in the current not-flat episode.
  private failPings = 0;
  private lossRederivedDate: string | null = null;
  private lastBackgroundAlert = new Map<string, number>();
  private retryingStop = false;
  // Release B: the live order updates (every day since the speed release), and what they freed; the last price seen per symbol.
  private orderStream: (StreamLike & { reconnects?: () => number }) | null = null;
  private orderStreamDate: string | null = null;
  private orderHandler: OrderUpdateHandler | null = null;
  private readonly lastPrices = new Map<string, number>();
  // The speed release: waits that end at a live order update (item 9); the load window's entry wait (decision 4); the stop-gap
  // measurement (decision 3); the sync brought forward by a stop's cancel (decision 3); the per-minute statistics (item 10).
  private readonly waiters = new Set<{ symbols: ReadonlySet<string>; wake: () => void }>();
  private readonly entryExpiry: EntryExpiry;
  private readonly stopGap = new StopGapMeter();
  private stopGapDate: string | null = null;
  private stopGapSaving = false;
  // The redesign of 2026-11-14, part 2: the protection loop (protection.ts) owns when each position's protection work runs: the order sync
  // hands it each action and asks it for wakes, and the live updates wake the entry they are about. It replaces the sync brought forward by
  // a timer (`syncAt`), fix (a)'s marks and the list-lag recheck's own timer.
  readonly loop: ProtectionLoop;
  // Refusals in a row of a list-lag look for room (its out-of-room event is stored once per wait).
  private lagWaits = 0;
  // Logging only (Michael's approval of 2026-11-10), for `late_notice`: when the live updates last reported each symbol's stop cancelled,
  // and the moment the protection loop was woken for (since the redesign of 2026-11-14; the timed sync is gone).
  private readonly stopCancelSeen = new Map<string, { alpacaAtMs: number; receivedMs: number; wokeFor: number }>();
  // The trade digest only (messaging): take-profit legs already counted (Alpaca order ids), so a partial fill and a later fill count once.
  private readonly digestTakeProfits = new Set<string>();
  private syncAgain = false;
  private sessionForSync: { day: DayRecord; closeAt: Date } | null = null;
  // Michael's mid-day build of 2026-11-16, item 1: the live updates went down (a reconnect is under way), and a sync is owed once they are
  // live again but could not start yet because another sync was running.
  private orderStreamWasDown = false;
  private reconnectSyncOwed = false;
  private lastRawSampleAt = 0;
  private rawSample: string | null = null;
  // Decision 4 of 2026-11-06 (shadow only): the estimate's own book of cash and shares, and each loss-stop read's comparison.
  private readonly shadowLedger = new ShadowLedger();
  private shadowReconnects = 0;
  private shadow: Array<{ diff: number; at: number; estimate: number; equity: number; sinceFillMs: number | null; sinceBaseMs: number | null }> = [];
  private shadowNoEstimate = 0;
  // Decision 1 of 2026-11-06: entries whose two exits the live updates reported lost, with the symbol, when, and the syncs tried.
  private readonly lostExitsPending = new Map<string, { symbol: string; at: number; tries: number }>();
  // Protect-first (Michael's night build request of 2026-11-16, item 2; protect-first.ts): while a held position lacks a confirmed stop,
  // new entries stop and P2 gives way for up to 30 s, then entries run at a reduced rate until every position is protected or sold.
  // (Switched off: see the constant, PROTECT_FIRST.)
  readonly protectFirst: ProtectFirst;
  // Michael's item 1 of 2026-11-13 (afternoon): a remainder whose stop cancel the live update reported complete gets up to 3 more syncs,
  // 0.5, 1 and 2 seconds apart, until it has its fresh stop (or is sold or closed); the 10 second sync is the backstop after that.
  private readonly stopCancelPending = new Map<string, { symbol: string; at: number; tries: number }>();
  // The mid-day cycle (Michael, 2026-11-09): what started this process (main.ts, from the start note), whether the start-up decision
  // about the pause has been made, the mid-day close-out's last attempt, and the day its not-flat alert went out.
  private startInfo: { deploy: boolean; release: string } | null = null;
  private middayStartupDone = false;
  private lastMiddayAttempt = 0;
  private middayAlertDate: string | null = null;
  // Michael's ruling of 2026-11-09 on a mid-day close-out that ends not flat: the first try is not held back; each retry (one round,
  // every 20 seconds at most) runs only with room in the shared request budget (the redesign of 2026-11-14: P1, its estimated cost against
  // the minute, down to 20 of Alpaca's remaining). Each try's real cost is what it sent. One alert when a try first ends not flat, and one
  // more if still not flat 5 minutes later.
  readonly budget: RequestBudget;
  private closeoutLastCost: number | null = null;
  private middayAttemptDate: string | null = null;
  private middayAttempts = 0;
  private middayLastCost: number | null = null;
  private middayNotFlatSince: number | null = null;
  private middayLastRemaining: string[] = [];
  private middayFiveMinAlertDate: string | null = null;
  // True from 10:30 until the mid-day close-out has finished flat (set on every pass): the mid-day close-out alone sells then.
  private middayOwnsSelling = false;
  // The close-out after the afternoon load window (Michael, 2026-11-12). Since Michael's request of 2026-11-17 the "date" fields hold the
  // window's key (the date and the window's start), as the window may start again the same day.
  private lastAfternoonAttempt = 0;
  private afternoonAttemptDate: string | null = null;
  private afternoonAttempts = 0;
  private afternoonLastCost: number | null = null;
  private afternoonLastRemaining: string[] = [];
  private afternoonAlertDate: string | null = null;

  constructor(deps: WorkerDeps) {
    this.d = deps;
    this.budget = deps.budget ?? new RequestBudget({ now: () => deps.now().getTime(), remaining: () => deps.governor.budget(), log: (e, data) => deps.log?.("info", e, data) });
    this.syncMemory.budget = this.budget;
    this.lossMemory.budget = this.budget;
    deps.governor.setSafetyHold?.(this.budget);
    this.loop = new ProtectionLoop({ now: () => deps.now().getTime(), ...(deps.setTimer ? { setTimer: deps.setTimer } : {}), ...(deps.clearTimer ? { clearTimer: deps.clearTimer } : {}), look: (ids, kind, extra, until) => this.look(ids, kind, extra, until), log: (e, data) => deps.log?.("info", e, data), onActionFailed: (id, label, err) => this.protectionActionFailed(id, label, err), onLagDropped: () => this.lagWaitOver(), roomAt: (need) => {
      // Group 1, round 4 of part 2: asked locally (no request): when the shared budget would grant that try with the look's reads ahead of it.
      const r = this.budget.roomFor(need.cls, need.n, true, need.reads, need.minuteCap);
      if (r.ok) return null;
      // Michael's ruling of 2026-11-17: a stuck sale still waiting for Alpaca's room keeps new entries giving way until it is checked again.
      if (need.stuckSale) this.budget.noteStuckSaleWaiting(r, r.at, "stuck sale room check");
      return r.at;
    } });
    this.sessions = new NextSessionFinder(deps.broker);
    this.view = new BrokerView(deps.broker, () => deps.now().getTime());
    this.protectFirst = new ProtectFirst({ now: () => deps.now().getTime(), heldSince: (symbol, sinceMs) => this.view.heldSince(symbol, sinceMs), stuck: this.syncMemory.stuck, freshStops: this.syncMemory.freshStops, timedOutStops: this.syncMemory.timedOutStops, log: (e, data) => deps.log?.("info", e, data) });
    this.syncMemory.protectFirst = this.protectFirst;
    this.budget.p2GivesWay = () => this.protectFirst.p2GivesWay();
    this.sellGate = new SellGate({ broker: deps.broker, say: (c, t, o) => this.say(c, t, o), log: (e, data) => deps.log?.("info", e, data), nowMs: () => deps.now().getTime() });
    this.moveWatch = new MoveWatch(() => deps.now().getTime());
    const latestQuotes = deps.latestQuotes;
    this.liquidator = new Liquidator({ broker: deps.broker, gate: this.sellGate, now: deps.now, sleep: deps.sleep, log: (e, data) => deps.log?.("info", e, data), waitEvent: (symbols, ms) => this.waitEvent(symbols, ms),
      // The moved take-profit (Michael's decision of 2026-11-18): each replace only with room for one more request above the urgent floor.
      ...(latestQuotes ? { moves: { quotes: (symbols: string[]) => latestQuotes(symbols), stopsFor: (legs: Array<{ legId: string; groupId: string; symbol: string }>) => this.stopsForMoves(legs), watch: this.moveWatch, room: () => this.budget.urgentRoom(1), live: () => this.orderStreamLive() } } : {}),
      ownSalesMayRun: () => {
      const s = this.sessionForSync;
      return !s || this.protectNow(s.closeAt);
    },
      // Item 3 of the night build: one-entry first tries waiting for room go ahead the moment a sale of the whole account is asked.
      onWholeAccountAsk: () => this.budget.wakeFirstWaiters(),
      // Item 1 of the night build (round 1 follow-up): a cancel's result is looked up only with room above the urgent floor.
      lookupRoom: () => this.budget.urgentRoom(1),
    });
    // The load window's 5 second cancels are part of entering (tagged as entries for the shared request budget's statistics).
    this.entryExpiry = new EntryExpiry({ cancelOrder: (id) => inRequestScope({ tag: "entry" }, () => deps.broker.cancelOrder(id)), wasFilled: (id) => this.orderHandler?.wasFilled(id) ?? false, log: (e, data) => deps.log?.("info", e, data), nowMs: () => deps.now().getTime(), ...(deps.setTimer ? { setTimer: deps.setTimer } : {}) });
    this.commands = new CommandProcessor({
      sessions: this.sessions,
      settings: deps.settings,
      store: deps.store,
      broker: deps.broker,
      liquidator: this.liquidator,
      bot: deps.bot,
      now: deps.now,
      extraStatus: async () => this.statusLines(),
      afternoonScreen: (date, route, exits) => this.startAfternoonScreen(date, route, exits),
      cancelAfternoonScreen: (date) => this.cancelAfternoonScreen(date),
      loadAfternoonEnabled: deps.loadAfternoon === true,
      // Michael's request of 2026-11-18: the day just written with an afternoon window's start becomes the copy the strategy reads.
      dayWritten: (d) => {
        if (d.tradeDate === etDate(this.d.now())) this.lastDay = d;
      },
      log: (e, data) => deps.log?.("info", e, data),
    });
    this.gate = new OrderGate({
      broker: deps.broker,
      store: deps.store,
      view: this.view,
      governor: deps.governor,
      now: deps.now,
      say: (c, t) => this.say(c, t),
      note: (line, kind) => this.digest.add(line, kind),
      log: (e, data) => deps.log?.("info", e, data),
      entryBlock: () => this.entryBlockReason(),
      protectFirst: this.protectFirst,
      onLimitEntrySent: (e) => this.entryExpiry.schedule(e, LOAD_ENTRY_WAIT_MS),
    });
  }

  // The moved take-profit (Michael's decision of 2026-11-18): the live updates about the running sale's moves (never sends anything).
  readonly moveWatch: MoveWatch;

  // The moved take-profit: the stop price of each take-profit leg's bracket, from what the worker already holds (no request). First the order
  // sync's copy of the entry (its stop leg, exactly as Alpaca holds it); else the entry's stored row, its stop rounded down to the cent as it
  // was sent (submitEntry). The stack never moves a stop, so the two agree. A leg whose entry is not known is left out (today's path).
  private async stopsForMoves(legs: Array<{ legId: string; groupId: string; symbol: string }>): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const byGroup = new Map<string, Order>();
    for (const o of this.syncMemory.lastSeen.values()) if (o.groupId) byGroup.set(o.groupId, o);
    for (const l of legs) {
      const seen = byGroup.get(l.groupId);
      const stopLeg = seen ? flattenLegs(seen).find((x) => x.side === "sell" && (x.type === "stop" || x.type === "stop_limit") && x.stopPrice !== null && x.stopPrice > 0) : undefined;
      // Michael's scope, "both legs open" (group 1, round 1): a stop the sync's copy shows ended (cancelled, filled) leaves the leg unknown.
      if (stopLeg && !OPEN_STATUSES.has(stopLeg.status)) continue;
      if (stopLeg && stopLeg.stopPrice !== null && seen!.symbol === l.symbol) {
        out.set(l.legId, stopLeg.stopPrice);
        continue;
      }
      const cid = seen?.clientOrderId ?? this.orderHandler?.entryClientIdForGroup(l.groupId) ?? null;
      if (!cid) continue;
      const row = await this.d.store.getOrder(cid).catch(() => null);
      if (row && row.symbol === l.symbol && row.stopPrice > 0) out.set(l.legId, Math.floor(row.stopPrice * 100 + 1e-9) / 100);
    }
    return out;
  }

  // Told by main.ts before start(): whether this start is a new release (a deploy) or the same release again (a plain restart). The
  // mid-day cycle resumes on its own only after a deploy. Without it (tests, a failed start note) a start counts as a plain restart.
  setStartInfo(info: { deploy: boolean; release: string }): void {
    this.startInfo = info;
  }

  // True while Alpaca's live order updates are connected and listening.
  private orderStreamLive(): boolean {
    return this.orderStream !== null && this.orderStream.status() === "live";
  }

  // Item 9: waits up to `ms`; ends early (true) when a live order update arrives for one of the symbols. A plain pause while the
  // updates are not connected. Since Michael's decision of 2026-11-06 (early-wake.ts) an update is ignored while Alpaca's request
  // budget is less than EARLY_LOOK_HEADROOM above the reserve: the wait then runs to its timed look.
  private waitEvent(symbols: ReadonlySet<string>, ms: number): Promise<boolean> {
    const sleep = this.d.sleep ?? ((t: number) => new Promise<void>((r) => setTimeout(r, t)));
    if (!this.orderStreamLive()) return sleep(ms).then(() => false);
    return new Promise<boolean>((resolve) => {
      let done = false;
      const w = {
        symbols,
        wake: () => {
          if (done) return;
          if (!earlyLookAllowed(this.d.governor.budget(), this.d.governor.reserve())) return;
          done = true;
          this.waiters.delete(w);
          resolve(true);
        },
      };
      this.waiters.add(w);
      void sleep(ms).then(() => {
        if (done) return;
        done = true;
        this.waiters.delete(w);
        resolve(false);
      });
    });
  }

  private say(channel: Channel, text: string, opts?: { mentionOwner?: boolean }): Promise<boolean> {
    return this.d.bot.post(channel, text, opts);
  }

  // Posts the trade digest (one line per 5 minute period, digest.ts), the batched remainder-sale alert (one a minute) and the
  // gate's counted refusals. Never called from the order path.
  private async flushDigest(force = false): Promise<void> {
    const t = this.d.now().getTime();
    if (force || t - this.lastDigest >= DIGEST_PERIOD_MS) {
      const from = this.lastDigest > 0 ? centralClock(new Date(this.lastDigest)) : null;
      this.lastDigest = t;
      for (const m of this.digest.take(from ? `${from} to ${centralClock(new Date(t))}` : `To ${centralClock(new Date(t))}`)) await this.say("trading", m);
    }
    if (this.remainderSales.length > 0 && (force || t - this.lastRemainderAlert >= REMAINDER_ALERT_EVERY_MS)) {
      this.lastRemainderAlert = t;
      const sales = this.remainderSales;
      this.remainderSales = [];
      await this.say("alerts", remainderAlert(sales));
    }
    if (force || t - this.lastFlush >= FLUSH_EVERY_MS) {
      this.lastFlush = t;
      await this.gate.flush();
    }
  }

  // The regular close-out's time on a day that closes at `closeAt`: the setting's minutes before it (Michael's night build request of
  // 2026-11-16, item 4; default 5, 2:55 PM Central).
  closeoutAt(closeAt: Date): Date {
    return addMinutes(closeAt, -this.d.settings.closeoutMinutesBeforeClose);
  }

  // May the order sync sell a position whose exits are gone? Not while any liquidation runs or waits (close-out, flatten, loss
  // stop, carried, emergency), and not from the close-out time on: the close-out alone flattens the account. Since the redesign of
  // 2026-11-14 (part 2) one position's own cleanup sale (the loop's, or the fast sale) does not stop the others: they wait their turn in the
  // one-at-a-time sale queue (`isLiquidatingOthers`).
  protectNow(closeAt: Date): boolean {
    return !this.closingOut && !this.liquidator.isLiquidatingOthers() && !this.inflight.has("closeout") && !this.inflight.has("carried") && !this.inflight.has("midday") && !this.middayOwnsSelling && this.d.now() < this.closeoutAt(closeAt);
  }

  private riskDeps() {
    return {
      broker: this.d.broker,
      store: this.d.store,
      now: this.d.now,
      say: (c: Channel, t: string, o?: { mentionOwner?: boolean }) => this.say(c, t, o),
      liquidator: this.liquidator,
      lossMemory: this.lossMemory,
      closeoutMinutesBeforeClose: this.d.settings.closeoutMinutesBeforeClose,
      syncMemory: this.syncMemory,
      governor: this.d.governor,
      log: (e: string, data?: Record<string, unknown>) => this.d.log?.("info", e, data),
      onBareSale: (sale: { symbol: string; shares: number; takeProfit: number | null; atMs: number; clientOrderId?: string }) => this.stopGap.onSale(sale),
      onFreshStop: (x: { symbol: string; shares: number }) => this.stopGap.onFreshStop(x),
      budget: this.budget,
      // Item 3 of the night build: first tries wait for room (at most 3 s) with the worker's own clock.
      ...(this.d.sleep ? { sleep: this.d.sleep } : {}),
      onRemainderSold: (symbol: string, shares: number) => void this.remainderSales.push({ symbol, shares }),
      onAccountRead: (account: { equity: number; cash: number }) => this.shadowEstimate(account),
      lateNoticeContext: (symbol: string) => this.lateNoticeContext(symbol),
    };
  }

  // Logging only (Michael's approval of 2026-11-10): what the worker knew when a sale was noticed late. Times are "ms ago" from now.
  private lateNoticeContext(symbol: string): Record<string, unknown> {
    const now = this.d.now().getTime();
    const ago = (t: number) => (t > 0 ? now - t : null);
    const seen = this.stopCancelSeen.get(symbol);
    const next = this.loop.nextLookAt();
    return {
      streamReportedCancel: seen ? { alpacaAgoMs: ago(seen.alpacaAtMs), receivedAgoMs: ago(seen.receivedMs), wokeForAgoMs: ago(seen.wokeFor) } : null,
      streamStatus: this.orderStream ? this.orderStreamLive() : false,
      // The redesign of 2026-11-14, part 2: the protection loop's next look and its pending wakes (replacing the timed sync's figures).
      loop: { nextLookInMs: next === null ? null : next - now, pendingWakes: this.loop.pendingWakes().size, actionsRunning: this.loop.actionsRunning() },
      workerSyncStartedAgoMs: ago(this.lastSync),
      saleRunning: this.liquidator.isLiquidating(),
    };
  }

  // Item 5, SHADOW ONLY: the stack's own estimate of equity beside Alpaca's equity at each loss stop read. Logged per minute; it
  // triggers nothing. Since decision 4 of 2026-11-06 the estimate comes from its own book (shadow-ledger.ts): cash and shares moved by
  // the live fills, set from a quiet read, so cash and shares are from the same moment.
  private shadowEstimate(account: { equity: number; cash: number }): void {
    if (!Number.isFinite(account.equity)) return;
    this.shadowCheckStream();
    const t = this.d.now().getTime();
    const estimate = this.shadowLedger.estimate(this.lastPrices, t);
    if (estimate === null) {
      this.shadowNoEstimate++;
      return;
    }
    const lastFill = this.shadowLedger.lastFillTime();
    const base = this.shadowLedger.baseTime();
    this.shadow.push({ diff: estimate - account.equity, at: t, estimate, equity: account.equity, sinceFillMs: Number.isFinite(lastFill) ? t - lastFill : null, sinceBaseMs: base !== null ? t - base : null });
    if (this.shadow.length > 1_000) this.shadow.shift();
  }

  // The book can only follow the fills while the live updates are connected: when they are not, or have reconnected since the last
  // look (a fill may have been missed), it is dropped until the next quiet read.
  private shadowCheckStream(): void {
    const reconnects = this.orderStream?.reconnects?.() ?? 0;
    if (!this.orderStreamLive() || reconnects !== this.shadowReconnects) {
      this.shadowReconnects = reconnects;
      this.shadowLedger.drop();
    }
  }

  // A view refresh (account and positions asked together) is offered to the book; it is used only if no fill came near it.
  private shadowRebase(startedMs: number, endedMs: number): void {
    try {
      this.shadowCheckStream();
      if (!this.orderStreamLive()) return;
      const account = this.view.cachedAccount();
      const positions = this.view.cachedPositions();
      if (account && positions) this.shadowLedger.offerBase(account.cash, positions, startedMs, endedMs);
    } catch {
      /* shadow logging must never break the view refresh */
    }
  }

  private closeoutDeps() {
    return { broker: this.d.broker, liquidator: this.liquidator, store: this.d.store, now: this.d.now, say: (c: Channel, t: string, o?: { mentionOwner?: boolean }) => this.say(c, t, o), sleep: this.d.sleep, log: (e: string, data?: Record<string, unknown>) => this.d.log?.("info", e, data), waitEvent: (symbols: ReadonlySet<string>, ms: number) => this.waitEvent(symbols, ms) };
  }

  private statusLines(): string[] {
    return [
      `Live prices: ${this.stream ? this.stream.status() : "not started"}${this.lastTradeAt ? `, last trade seen ${centralClock(this.lastTradeAt)}` : ""}`,
      (() => {
        const g = this.d.governor.stats();
        return `Orders in the last minute: ${this.d.governor.tradesInLastMinute()}; Alpaca requests in the last minute: about ${g.requestsLastMinute} of 200`;
      })(),
      this.lastTickError ? `Last problem: ${this.lastTickError}` : "",
    ].filter(Boolean);
  }

  start(everyMs = 5_000): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), everyMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.loop.stop();
    this.stream?.stop();
    this.orderStream?.stop();
  }

  // Runs a long step in the background once; its finish is recorded in the database by the step itself.
  // The redesign of 2026-11-14, part 1: it starts outside any request scope (request-scope.ts), so a timer or a try set up inside one never
  // carries its scope into this new work. Returns whether it started.
  private background(name: string, fn: () => Promise<void>): boolean {
    if (!this.backgroundReady(name)) return false;
    const retry = this.stepRetry.get(name);
    this.inflight.add(name);
    outsideScope(() => fn())
      .then(() => retry?.succeeded())
      .catch((err) => {
        retry?.failed(this.d.now().getTime());
        this.lastTickError = `${name}: ${(err as Error).message.slice(0, 150)}`;
        this.d.log?.("error", "background_failed", { name, error: (err as Error).message.slice(0, 200) });
        // At most one alert per step every 5 minutes (a database outage would otherwise post one every 30 seconds). The summary step,
        // which is retried every pass until midnight Eastern, alerts once per trading day (fix of 2026-11-11: it posted about 95 alerts
        // that evening); every failure is still in the run log.
        const t = this.d.now().getTime();
        const key = name === "summary" ? `${name}:${etDate(this.d.now())}` : name;
        const gap = name === "summary" ? Infinity : 5 * 60_000;
        const last = this.lastBackgroundAlert.get(key);
        if (last === undefined || t - last >= gap) {
          this.lastBackgroundAlert.set(key, t);
          void this.say("alerts", `Step "${name}" failed: ${(err as Error).message.slice(0, 150)}`).catch(() => undefined);
        }
      })
      .finally(() => {
        this.inflight.delete(name);
        // Item 1 of 2026-11-16: a sync owed after a reconnect starts as soon as the sync that was running then has ended.
        if (name === "risk" && this.reconnectSyncOwed) this.syncAfterReconnect();
      });
    return true;
  }

  // Michael's mid-day build of 2026-11-16, item 1: an order sync at once after Alpaca's live updates reconnect, because updates sent while
  // they were down are lost (on 2026-11-16 at 9:54:56 three fills were missed, so the 5 second cancels went to filled entries and Alpaca
  // cancelled their exits; the regular sync found them 14 s later). One sync per reconnect, routine work; it never repeats on its own (a
  // reconnect itself waits 2, 4, 8, 16, then 30 s, order-stream.ts), so it adds no retry loop. Only in the session; never doubled: if a
  // sync is running it is owed and starts when that one ends.
  private onOrderStreamStatus(status: string): void {
    if (status === "reconnecting") {
      this.orderStreamWasDown = true;
      return;
    }
    if (status !== "live" || !this.orderStreamWasDown) return;
    this.orderStreamWasDown = false;
    // Group 2, round 1: logged only when a sync is really owed (in the session).
    const s = this.sessionForSync;
    if (!s || this.d.now() >= s.closeAt) return;
    this.reconnectSyncOwed = true;
    this.d.log?.("info", "order_stream_reconnect_sync", { syncRunning: this.inflight.has("risk") });
    this.syncAfterReconnect();
  }

  private syncAfterReconnect(): void {
    const s = this.sessionForSync;
    if (!s || this.d.now() >= s.closeAt) {
      this.reconnectSyncOwed = false;
      return;
    }
    if (!this.backgroundReady("risk")) return; // owed: starts when the running sync ends (`background`), or at the next regular sync
    this.reconnectSyncOwed = false;
    this.startSync(s.day, s.closeAt);
  }

  // Whether `background(name, ...)` would start now (not running, and not waiting out a failure's backoff).
  private backgroundReady(name: string): boolean {
    if (this.inflight.has(name)) return false;
    const retry = this.stepRetry.get(name);
    return !(retry && !retry.due(this.d.now().getTime()));
  }

  async tick(): Promise<boolean> {
    if (this.startedAtMs === null) this.startedAtMs = this.d.now().getTime();
    // Protect-first: its start, 30 s limit and end are logged on time even when no entry asks.
    this.protectFirst.refresh();
    if (this.ticking) {
      // A pass that is slow or stuck is not reading commands either: the 2 minute rule is checked from here too.
      this.commandsWatch(this.d.now());
      // A slow pass is still running: do not start a second one. The daily loss stop does not wait for it (a Discord rate
      // limit in the digest can hold a pass for minutes): it is started from here, from the day record held in memory, on its
      // usual 5 second schedule. If the pass has run too long, the watchdog acts as well.
      this.lossStopFromMemory(this.d.now());
      await this.watchdog();
      return true;
    }
    this.ticking = true;
    this.passStartedAt = this.d.now().getTime();
    this.passDegraded = false;
    let ok = true;
    try {
      await this.pass();
      if (this.passDegraded) {
        // The pass ran on the day record held in memory (the database could not be read). It did the safety work, but the
        // heartbeat must still say the worker is unwell, and the broker-only close-out still stands by near the close.
        ok = false;
        this.failedTicks++;
        await this.emergencyCloseoutIfNeeded("The database is unreachable near the close").catch(() => undefined);
      } else {
        this.lastTickError = null;
        this.failedTicks = 0;
      }
    } catch (err) {
      ok = false;
      this.failedTicks++;
      this.lastTickError = (err as Error).message.slice(0, 150);
      this.d.log?.("error", "tick_failed", { error: this.lastTickError });
      // The database may be what failed. Selling needs only the broker, so the end of the day does not wait for it.
      await this.emergencyCloseoutIfNeeded("The database is unreachable near the close").catch(() => undefined);
    } finally {
      this.ticking = false;
      this.watchdogAlerted = false;
    }
    this.commandsWatch(this.d.now()); // after the pass's own read of commands, so a read that worked is counted first
    await this.heartbeat(ok);
    return ok;
  }

  // Runs on a tick that finds the previous pass still running. Once that pass is older than PASS_WATCHDOG_MS it is treated as
  // stuck: the heartbeat says "fail" (so Healthchecks alerts now, not after its grace period), Michael is told once, the daily
  // loss stop is run from the day record held in memory, and near the close the broker-only close-out runs. The stuck pass is
  // left alone: starting a second pass beside it could do things twice, and restarting the worker in market hours is not allowed.
  private async watchdog(): Promise<void> {
    const now = this.d.now();
    const stuckMs = now.getTime() - this.passStartedAt;
    if (stuckMs < PASS_WATCHDOG_MS || this.watchdogRunning) return;
    this.watchdogRunning = true;
    try {
      this.lastTickError = `a pass has been running for ${Math.round(stuckMs / 1000)} seconds`;
      if (!this.watchdogAlerted) {
        this.watchdogAlerted = true;
        this.d.log?.("error", "pass_stuck", { seconds: Math.round(stuckMs / 1000) });
        void this.say("alerts", `**Michael: my main loop is stuck** (one pass has run for ${Math.round(stuckMs / 1000)} seconds). Entries are not being placed by it. I keep running the daily loss stop and, near the close, the close-out from the broker alone. Check the Fly logs.`, { mentionOwner: true }).catch(() => undefined);
      }
      if (now.getTime() - this.lastWatchdogPing >= 30_000) {
        this.lastWatchdogPing = now.getTime();
        void this.d.ping("fail").catch(() => false);
      }
      this.retryUnsavedStop();
      this.lossStopFromMemory(now);
      await this.emergencyCloseoutIfNeeded("My main loop is stuck near the close").catch(() => undefined);
    } finally {
      this.watchdogRunning = false;
    }
  }

  // Tries again to save a stop that could not be saved, in the background, one try at a time (review round 5).
  private retryUnsavedStop(): void {
    const store = this.d.store;
    if (this.retryingStop || !store.hasUnsavedStop?.()) return;
    if (!this.unsavedStopRetry.due(this.d.now().getTime())) return;
    this.retryingStop = true;
    void store
      .retryUnsavedStop!()
      .then((saved) => {
        if (store.hasUnsavedStop?.()) this.unsavedStopRetry.failed(this.d.now().getTime());
        else this.unsavedStopRetry.succeeded();
        if (saved) {
          this.d.log?.("info", "unsaved_stop_saved");
          void this.say("alerts", "The stop flag that could not be saved earlier is now saved in the database.").catch(() => undefined);
        }
      })
      .catch((err) => {
        this.unsavedStopRetry.failed(this.d.now().getTime());
        this.d.log?.("warn", "unsaved_stop_retry_failed", { error: (err as Error).message.slice(0, 120) });
      })
      .finally(() => void (this.retryingStop = false));
  }

  // True while the stop flag is on for the daily loss stop. The flag itself decides, so Michael's `resume` ends it and the
  // missing-exit check watches again (round 8 review). Only if the flag cannot be read does this process's memory that the
  // loss stop fired today count, as in enforceDailyLoss. An owner's plain `stop` does not count: positions then keep their
  // exits, and the missing-exit check must keep watching them.
  private async lossStopInForce(date: string): Promise<boolean> {
    let flag: StopFlag | null;
    try {
      flag = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
    } catch {
      return this.lossMemory.firedDate === date;
    }
    return !!flag?.on && flag.reason.startsWith("daily loss stop");
  }

  // Why new entries are blocked right now because Michael's commands are not being read, or null when they are being read.
  // Read by the order gate before every entry (twice: at the start and just before sending).
  entryBlockReason(): string | null {
    const now = this.d.now().getTime();
    if (this.lastCommandReadOk === null) return "my commands have not been read since I started, so no entry yet";
    if (now - this.lastCommandReadOk >= COMMANDS_UNREAD_BLOCK_MS) return "my commands could not be read for 2 minutes, so no new entries";
    return null;
  }

  private commandsReadOk(): void {
    this.lastCommandReadOk = this.d.now().getTime();
    if (this.commandsAlerted) {
      this.commandsAlerted = false;
      this.d.log?.("warn", "commands_readable_again");
      void this.say("alerts", "I can read your commands again, so new entries are allowed again (within today's limits).").catch(() => undefined);
    }
  }

  // Runs on every tick, also while a pass is slow or stuck: one alert when commands have gone unread for 2 minutes.
  private commandsWatch(now: Date): void {
    const since = this.lastCommandReadOk ?? this.startedAtMs ?? now.getTime();
    if (!this.commandsAlerted && now.getTime() - since >= COMMANDS_UNREAD_BLOCK_MS) {
      this.commandsAlerted = true;
      this.d.log?.("error", "commands_unread_entries_blocked", { seconds: Math.round((now.getTime() - since) / 1000) });
      void this.say("alerts", "**Michael: I have not been able to read your commands for 2 minutes, so I have blocked new entries.** Protective stops at Alpaca, the daily loss stop and the close-out carry on. Entries resume as soon as a read works.", { mentionOwner: true }).catch(() => undefined);
    }
  }

  // While a pass is still running (slow or stuck), the daily loss stop is scheduled from the last copy of today's record held
  // in memory. Only in today's session on an approved day; scheduleLossStop's own timer and the one-at-a-time guard apply.
  private lossStopFromMemory(now: Date): void {
    const day = this.lastDay;
    if (day && day.tradeDate === etDate(now) && day.status === "approved" && day.openAt && day.closeAt && now >= day.openAt && now < day.closeAt) this.scheduleLossStop(day, now);
  }

  // The daily loss stop has its own background task every 5 seconds, so a failed or slow order sync can never keep it from
  // running (round 3 review). One check at a time: while a check is still waiting on Alpaca (each request has a time limit,
  // about 31.5 seconds at worst with retries), later slots are skipped, never queued, so slow checks cannot pile up. Its first run after a start also reads today's equity history (round 5), and until that run has
  // worked the live price stream is not started, so no entry can follow a loss stop that a restart forgot.
  private scheduleLossStop(day: DayRecord, now: Date): void {
    if (this.inflight.has("lossstop")) return; // the previous check is still running: skip this slot, never queue it
    if (now.getTime() - this.lastLossStop < LOSS_STOP_EVERY_MS - LOSS_STOP_SLACK_MS) return;
    this.lastLossStop = now.getTime();
    const risk = this.riskDeps();
    const rederive = this.lossRederivedDate !== day.tradeDate;
    this.background("lossstop", async () => {
      try {
        await enforceDailyLoss(risk, day, { rederive });
        if (rederive) this.lossRederivedDate = day.tradeDate;
      } catch (err) {
        this.lastTickError = `daily loss stop: ${(err as Error).message.slice(0, 120)}`;
        this.d.log?.("error", "loss_stop_check_failed", { error: (err as Error).message.slice(0, 200) });
        if (this.d.now().getTime() - this.lastLossCheckAlert >= 5 * 60_000) {
          this.lastLossCheckAlert = this.d.now().getTime();
          void this.say("alerts", `**Michael: I could not check the daily loss stop** (${(err as Error).message.slice(0, 100)}). I try again in 5 seconds.`, { mentionOwner: true }).catch(() => undefined);
        }
      }
    });
  }

  // "ok" at most every 30 seconds; "fail" after 3 failed passes in a row, or at once while the account is
  // still holding positions after the close-out time.
  private async heartbeat(ok: boolean): Promise<void> {
    const nowMs = this.d.now().getTime();
    if (this.notFlat) {
      this.failPings++;
      // Release A, fix 5: every failure signal is logged, and the first of an episode is kept in the run log.
      this.d.log?.("warn", "heartbeat_fail", { reason: "not flat", count: this.failPings });
      if (this.failPings === 1) void this.d.store.addEvent("warn", "heartbeat_fail", { reason: "not flat" }).catch(() => undefined);
      await this.d.ping("fail").catch(() => false);
      return;
    }
    if (!ok) {
      if (this.failedTicks >= 3) {
        this.failPings++;
        this.d.log?.("warn", "heartbeat_fail", { reason: "failed passes", failedTicks: this.failedTicks, count: this.failPings });
        if (this.failPings === 1) void this.d.store.addEvent("warn", "heartbeat_fail", { reason: "failed passes" }).catch(() => undefined);
        await this.d.ping("fail").catch(() => false);
      }
      return;
    }
    if (this.failPings > 0) {
      this.d.log?.("info", "heartbeat_recovered", { failSignals: this.failPings });
      this.failPings = 0;
    }
    if (nowMs - this.lastOkPing >= 30_000) {
      this.lastOkPing = nowMs;
      await this.d.ping("ok").catch(() => false);
    }
  }

  // Needs no database: reads the market clock from the broker and sells everything near the close.
  private async emergencyCloseoutIfNeeded(why: string): Promise<void> {
    const now = this.d.now();
    const date = etDate(now);
    if (this.emergencyDate === date || this.closingOut || this.inflight.has("closeout")) return;
    const clock = await this.d.broker.getClock();
    const minutesToClose = (new Date(clock.nextClose).getTime() - now.getTime()) / 60_000;
    if (!clock.isOpen || minutesToClose > this.d.settings.closeoutMinutesBeforeClose) return;
    this.emergencyDate = date;
    await this.say("alerts", `${why}, so I am closing everything from the broker's clock alone.`);
    this.closingOut = true;
    try {
      // A first try of safety work (the redesign of 2026-11-14): counted, never refused.
      const result = await inRequestScope({ tag: "first" }, () => closeOut(this.closeoutDeps(), date, { path: "emergency" }));
      await this.setNotFlat(!result.flat, result.remaining, date);
    } finally {
      this.closingOut = false;
    }
  }

  // "Not flat" is remembered in the database as well as in memory, so a restart cannot forget it. Saving it is
  // best effort: with the database down the in-memory value still drives the heartbeat.
  private async setNotFlat(on: boolean, remaining: string[], date: string): Promise<void> {
    this.notFlat = on;
    if (on) this.notFlatAlertDate = date;
    const state: NotFlatState = { on, since: this.d.now().toISOString(), remaining };
    this.notFlatSaved = false;
    await this.d.store
      .setControl(CONTROL_NOT_FLAT, state)
      .then(() => {
        this.notFlatSaved = true;
        this.notFlatSaveRetry.succeeded();
      })
      .catch((err) => {
        this.notFlatSaveRetry.failed(this.d.now().getTime());
        this.d.log?.("warn", "not_flat_save_failed", { error: (err as Error).message.slice(0, 120) });
      });
  }

  // Runs on every pass, on any day. Loads the remembered state after a restart. Outside the session (before the
  // open, after the close, a weekend) any position that is held counts as not flat, even if no flag was ever
  // saved (the worker was down across the close, or the database was down when a close-out failed): it sets the
  // flag, saves it, and alerts. Clears the flag as soon as the account is seen flat, and then puts the borrowing
  // cap back to 1 if that happens outside the session.
  private async notFlatCheck(today: DayRecord, now: Date): Promise<void> {
    if (!this.notFlatLoaded) {
      const saved = await this.d.store.getControl<NotFlatState>(CONTROL_NOT_FLAT);
      this.notFlatLoaded = true;
      if (saved?.on) {
        this.notFlat = true;
        this.notFlatSaved = true;
        await this.say("alerts", `**Michael: the worker restarted while the account was NOT FLAT** (${saved.remaining.join(", ") || "positions held"}, since ${centralClock(new Date(saved.since))}). It stays flagged until the account is seen flat. No entries until then.`, { mentionOwner: true });
      }
    }
    const idle = !this.closingOut && !this.inflight.has("closeout") && !this.inflight.has("carried");
    const outside = sessionPhase(today, now) !== "open";
    if (!idle) return;
    // During the session a held position is normal, but one this worker did not enter today is a carried one (the
    // worker was down across the close, or came back after the open): flag it like any other carried position.
    if (!outside && !this.notFlat) {
      await this.scanForCarried(today, now);
      return;
    }
    if (!(this.notFlat || outside)) return;
    const held = (await this.d.broker.listPositions()).map((p) => p.symbol);
    const date = etDate(now);
    if (held.length === 0) {
      if (!this.notFlat) return;
      await this.setNotFlat(false, [], date);
      await this.say("commands", "The account is flat now, so the not-flat flag is cleared.");
      if (outside) {
        try {
          await this.d.broker.setAccountConfig({ maxMarginMultiplier: 1 }); // the armed cap must not sit at Alpaca overnight
        } catch {
          await this.say("commands", "The account is flat, but I could not set the borrowing cap back to 1. Check it before the next open.");
        }
      }
      return;
    }
    if (!this.notFlat) {
      await this.setNotFlat(true, held, date);
      await this.say("alerts", `**Michael: positions are held outside the session (${held.join(", ")}) and nothing had flagged it.** Flagged as not flat: no entries until the account is flat, and I will sell at the next open. You can also close by hand in Alpaca.`, { mentionOwner: true });
    } else if (!this.notFlatSaved && this.notFlatSaveRetry.due(now.getTime())) {
      await this.setNotFlat(true, held, date); // the earlier save failed (database down): save it again, on the backoff
    }
  }

  // In-session check, every 30 seconds while nothing is flagged: any held symbol with no stored order from today
  // (every entry is written down by the gate before it is sent, so a legitimate position always has one) is carried.
  private async scanForCarried(today: DayRecord, now: Date): Promise<void> {
    if (now.getTime() - this.lastCarriedScan < 30_000 || !this.carriedScanRetry.due(now.getTime())) return;
    try {
      const held = (await this.view.freshPositions(10_000)).map((p) => p.symbol);
      let carried: string[] = [];
      if (held.length > 0) {
        const known = new Set((await this.d.store.listOrders(today.tradeDate)).map((o) => o.symbol));
        carried = held.filter((sym) => !known.has(sym));
      }
      this.lastCarriedScan = now.getTime(); // only a scan that finished counts; a failed one is retried on the backoff (5 s doubling to 60)
      this.carriedScanRetry.succeeded();
      if (carried.length === 0) return;
      await this.setNotFlat(true, carried, etDate(now));
      await this.say("alerts", `**Michael: positions are held that this worker did not enter today (${carried.join(", ")}).** Treated as carried over: no entries until the account is flat, and I am selling everything now (nothing here has a protective stop from today).`, { mentionOwner: true });
    } catch (err) {
      this.lastTickError = `carried-position scan: ${(err as Error).message.slice(0, 120)}`;
      this.carriedScanRetry.failed(now.getTime());
      this.d.log?.("error", "carried_scan_failed", { error: (err as Error).message.slice(0, 200) });
      if (now.getTime() - this.lastScanAlert >= 5 * 60_000) {
        this.lastScanAlert = now.getTime();
        await this.say("alerts", `I could not check for carried-over positions (${(err as Error).message.slice(0, 100)}). The order gate refuses any entry beside a position it did not enter today, and I retry on the next pass.`);
      }
    }
  }

  private async pass(): Promise<void> {
    const now = this.d.now();
    // A stop that could not be saved is retried on every pass, at any hour (it carries over to later days until `resume`).
    this.retryUnsavedStop();
    if (!this.migrated && this.migrateRetry.due(now.getTime())) {
      // Once per start, before any command is read: a future day saved by an older release (before build C2) is put in the
      // new shape and its old request is forgotten, so an old reply cannot count and the request is posted again. If the
      // database cannot do it now, commands and the limits flow wait for it (an old reply must not count), and so do live
      // prices: nothing trades while a `stop` could go unread (review round 6). The safety work below still runs (round 5 audit).
      try {
        const reset = await resetOldShapeFutureDays(this.d.store, now);
        this.migrated = true;
        if (reset.length > 0) this.d.log?.("info", "future_days_reset", { days: reset });
      } catch (err) {
        this.lastTickError = `start-up check of future days: ${(err as Error).message.slice(0, 120)}`;
        this.migrateRetry.failed(now.getTime());
        this.d.log?.("error", "future_days_reset_failed", { error: (err as Error).message.slice(0, 200) });
        this.passDegraded = true;
        if (now.getTime() - this.lastMigrateAlert >= 10 * 60_000) {
          this.lastMigrateAlert = now.getTime();
          void this.say("alerts", `I could not run my start-up check of future days (${(err as Error).message.slice(0, 100)}). Until it works I do not read commands, so I place no entries either; the daily loss stop and the close-out continue. I keep trying.`).catch(() => undefined);
        }
      }
    }
    // Commands first, at any hour: a stop must never wait behind anything else. A failed read of Discord (or of the database for the
    // command cursor) must not stop the rest of the pass, least of all the daily loss stop: it is reported, rate limited, and the
    // pass goes on.
    if (this.migrated) {
      const pollStartedAt = now.getTime();
      try {
        await this.commands.poll();
        this.commandsReadOk();
        // Fix of 2026-11-12 (round 3 note): a read that returned Discord's maximum of 50 messages may have left more waiting, so only a
        // read that returned fewer counts for deciding the afternoon load window.
        if (this.commands.lastReadCount < COMMAND_READ_LIMIT) this.lastPollStartedAt = pollStartedAt;
      } catch (err) {
        // Logged (and kept in the run log) every time; Michael is told once, when it has lasted 2 minutes (commandsWatch).
        this.lastTickError = `commands: ${(err as Error).message.slice(0, 120)}`;
        this.d.log?.("error", "command_poll_failed", { error: (err as Error).message.slice(0, 200) });
      }
    }
    // `load afternoon` on a normal morning: once its screen is done, the window is decided in a pass whose command read started after
    // the screen finished, so a `stop` or `go` sent while the screen ran has been read first (group 1 review, round 1).
    const screened = this.afternoonScreenState;
    if (screened?.state === "ready" && screened.readyAt < this.lastPollStartedAt) {
      this.afternoonScreenState = null;
      try {
        await this.commands.finishAfternoonLoad(screened.date, screened.result!);
      } catch (err) {
        this.d.log?.("error", "load_afternoon_finish_failed", { error: (err as Error).message.slice(0, 200) });
        // The window's start is written before the pause is ended, so a failure may leave either state: say so plainly.
        await this.say("commands", "Afternoon load window: I could not finish starting it (the database did not answer). Send `status` to see whether the window is on and whether trading is still paused.").catch(() => undefined);
      }
    }

    const date = etDate(now);
    // Review round 5 (finding 3): if today's record cannot be read, the pass carries on with the copy held in memory, so the
    // daily loss stop, the missing-exit check and the close-out are still scheduled. Only a copy of TODAY counts; with none,
    // the pass fails as before (and the broker-only close-out stands by). The order gate does not use this copy: it reads the
    // database itself and refuses when it cannot.
    let today: DayRecord;
    try {
      today = await ensureDay({ store: this.d.store, broker: this.d.broker, now: this.d.now }, date);
      this.lastDay = today;
    } catch (err) {
      if (!this.lastDay || this.lastDay.tradeDate !== date) throw err;
      today = this.lastDay;
      this.passDegraded = true;
      this.lastTickError = `day record: ${(err as Error).message.slice(0, 120)}`;
      this.d.log?.("error", "day_read_failed_using_memory", { error: (err as Error).message.slice(0, 200) });
      if (now.getTime() - this.lastDayFallbackAlert >= 10 * 60_000) {
        this.lastDayFallbackAlert = now.getTime();
        void this.say("alerts", `**Michael: I cannot read today's record from the database** (${(err as Error).message.slice(0, 100)}). I keep running the daily loss stop, the missing-exit check and the close-out from the copy in memory. The order gate refuses any entry it cannot write down first. I keep trying.`, { mentionOwner: true }).catch(() => undefined);
      }
    }
    try {
      await this.notFlatCheck(today, now);
    } catch (err) {
      // A failed check must not stop the limits flow, arming or the close-out below; the gate reads the saved flag itself.
      this.lastTickError = `not-flat check: ${(err as Error).message.slice(0, 120)}`;
      this.d.log?.("error", "not_flat_check_failed", { error: (err as Error).message.slice(0, 200) });
    }
    const steps: MorningSteps = { store: this.d.store, broker: this.d.broker, say: (c, t) => this.say(c, t), now: this.d.now, feed: this.d.settings.alpaca.dataFeed };

    // The limits flow for the next session (it may be a later day) runs at any hour, even on a weekend.
    // A failure here (the calendar, Discord) must not skip the order sync, the loss stop or the close-out below.
    let current: DayRecord = today;
    try {
      if (this.migrated && this.limitsFlowRetry.due(now.getTime())) {
        current = await this.limitsFlow(now, date, today, steps);
        this.limitsFlowRetry.succeeded();
      }
    } catch (err) {
      this.limitsFlowRetry.failed(now.getTime());
      this.lastTickError = `limits flow: ${(err as Error).message.slice(0, 120)}`;
      this.d.log?.("error", "limits_flow_failed", { error: (err as Error).message.slice(0, 200) });
      if (now.getTime() - this.lastFlowAlert >= 10 * 60_000) {
        this.lastFlowAlert = now.getTime();
        await this.say("alerts", `The limits flow hit a problem (${(err as Error).message.slice(0, 120)}). Trading checks continue; I keep trying.`);
      }
    }
    const day = current;
    if (!day.isTradingDay || !day.openAt || !day.closeAt) return;
    const at = (minutesFromOpen: number) => now >= addMinutes(day.openAt!, minutesFromOpen);
    const alivePending = current.status === "approved" || current.status === "pending";

    // Michael's item 4 of 2026-11-13: the morning screen at 8:15 AM Central (15 minutes before the open), after `load on` closes.
    if (at(-SCREEN_MINUTES_BEFORE_OPEN) && now < day.closeAt && alivePending && !current.phases.screen) this.background("screen", () => this.screenPhase(date, isLoadDay(current)));

    // Arming: set long only and the approved cap at Alpaca. Until it works the gate refuses every entry.
    if (at(-5) && now < day.closeAt && current.status === "approved" && !current.phases.armed && now.getTime() - this.lastArmAttempt >= 10_000 && this.armRetry.due(now.getTime())) {
      this.lastArmAttempt = now.getTime();
      try {
        current = await armDay(steps, current);
        this.armRetry.succeeded();
      } catch (err) {
        this.armRetry.failed(now.getTime());
        this.lastTickError = `arming: ${(err as Error).message.slice(0, 120)}`;
        if (now.getTime() - this.lastArmAlert >= 5 * 60_000) {
          this.lastArmAlert = now.getTime();
          await this.say("alerts", `Could not arm today (${(err as Error).message.slice(0, 120)}). There will be no entries until it works; I keep trying.`);
        }
      }
    }
    if (at(0) && this.lapseRetry.due(now.getTime())) {
      try {
        current = await lapseIfUndecided(steps, current);
        this.lapseRetry.succeeded();
      } catch (err) {
        this.lapseRetry.failed(now.getTime());
        this.lastTickError = `lapse: ${(err as Error).message.slice(0, 120)}`; // retried on the backoff; an undecided day never trades
      }
    }
    if (current.tradeDate === date) this.lastDay = current;

    // Live prices: from 5 minutes before the open, only while the day is still alive.
    const alive = current.status === "approved" || current.status === "pending";
    // After a start in the middle of the session, live prices wait until the loss stop's first check (with today's equity
    // history) has worked: no entry may follow a loss stop that the restart forgot (review round 5).
    const lossReady = now < day.openAt || this.lossRederivedDate === date;
    // Review round 6: no live prices (so no signals and no entries) until the start-up check has worked, because until then
    // Michael's commands are not read, and the stack must never trade while a `stop` could go unread.
    if (at(-5) && now < day.closeAt && alive && lossReady && this.migrated && current.liveList && current.liveList.length > 0 && this.streamDate !== date) {
      this.startStream(current, current.liveList);
    }
    if (this.stream && (!alive || now >= day.closeAt)) this.endStream();
    // Live order updates on every day (the speed release, item 1), from "Armed" to the close.
    if (this.d.makeOrderStream && current.phases.armed && now < day.closeAt && alive && this.migrated && this.orderStreamDate !== date) this.startOrderStream(date);
    if (this.orderStream && (!alive || now >= day.closeAt || this.orderStreamDate !== date)) this.endOrderStream();

    const inSession = now >= day.openAt && now < day.closeAt && current.status === "approved";
    // The mid-day cycle: from 10:30 until the mid-day close-out has finished flat, it alone sells (as the regular close-out, at the set time, does from its
    // time on), so the order sync's missing-exit check stands aside and its sales cannot spend Alpaca's requests outside the mid-day
    // close-out's 60 a minute (CLOSEOUT_MINUTE_CAP; the shared minute is 75 since Michael's decision 2 of 2026-11-17) (group 1 review, round 1: 40 positions with refused sales made 80 such sales in 10 minutes).
    const middayToday = this.d.middayCycle === false ? null : middayTimes(current);
    // The close-out after the afternoon load window (Michael, 2026-11-12) owns selling the same way until it has finished flat.
    const afternoonCloseoutDue = Boolean(inSession && current.phases.armed && afternoonCloseoutPending(current, now) && now < this.closeoutAt(day.closeAt));
    this.middayOwnsSelling = Boolean(inSession && middayToday && current.phases.armed && now >= middayToday.pauseAt && !current.phases[MIDDAY_PHASE] && now < this.closeoutAt(day.closeAt)) || afternoonCloseoutDue;
    // The loss stop is scheduled first, before anything else in the session that waits on the broker.
    if (inSession) this.scheduleLossStop(current, now);
    // Closes the live updates wrote to memory but could not write to the database yet are tried again (item 1). Never waited on.
    void this.d.store.retrySoonWrites?.().catch(() => undefined);
    this.sessionForSync = inSession ? { day: current, closeAt: day.closeAt } : null;
    if (inSession && current.phases.armed) await this.refreshView(now, date);
    // The regular order sync, every 10 seconds (the record of truth). Since the redesign of 2026-11-14 (part 2) protection work never brings it
    // forward: the protection loop looks at the entries that are due (`look`).
    if (inSession && now.getTime() - this.lastSync >= SYNC_EVERY_MS) this.startSync(current, day.closeAt);
    if (inSession || (day.closeAt && now < addMinutes(day.closeAt, 10))) {
      await this.flushDigest();
      await this.stopGapStep(date, now);
      if (inSession && now.getTime() - this.lastStatsEvent >= STATS_EVERY_MS) {
        this.lastStatsEvent = now.getTime();
        await this.d.store.addEvent("info", "governor_stats", this.minuteStats()).catch(() => undefined);
        if (this.d.selfMonitor) {
          let row: Record<string, unknown> | null = null;
          try {
            row = this.d.selfMonitor.sample(this.gate.takeDecisionTimes()) as unknown as Record<string, unknown>;
          } catch {
            row = null; // measurement must never break the pass
          }
          // A window much longer than a minute (the first sample of a day, after a start, or a real stall) is written as a short
          // marker row only: its length and the event loop's worst delay, flagged `longWindow` (group 2 review, rounds 1 and 2).
          if (row && typeof row.windowMs === "number" && row.windowMs > SELF_MONITOR_MAX_WINDOW_MS) row = { windowMs: row.windowMs, longWindow: true, eventLoopDelayMs: row.eventLoopDelayMs ?? null };
          if (row) await this.d.store.addEvent("info", "self_monitor", row).catch(() => undefined);
        }
      }
    }

    // Positions carried over from a close-out that did not get flat: sold as soon as the market is open again.
    // Release A, fix 3: only before the day's close-out time, and never once that day's close-out has started; from then on the
    // close-out and its retry alone sell (on 2026-11-04 both ran and each posted "Close-out done").
    const closeoutStarted = this.closeoutAttemptDate === date || Boolean(current.phases.closeout);
    // Item 3 of 2026-11-13, with group 1's round 2: tried again after 1 minute, then 2, 4, at most every 5 (v21's interval); the count starts
    // again each day and whenever the account is flat (a later carried position starts from the first wait).
    if (this.carriedAttemptDate !== date || !this.notFlat) {
      this.carriedAttemptDate = date;
      this.carriedAttempts = 0;
    }
    const carriedGapMs = this.carriedAttempts === 0 ? 0 : Math.min(60_000 * 2 ** (this.carriedAttempts - 1), 5 * 60_000);
    if (this.notFlat && now >= day.openAt && now < this.closeoutAt(day.closeAt) && !closeoutStarted && !this.closingOut && now.getTime() - this.lastCarriedAttempt >= carriedGapMs && this.backgroundReady("carried")) {
      // The redesign of 2026-11-14 (decision 6, every retry joins): the first try is a first try (counted, never refused); a retry is a P1 try
      // of the shared request budget, reserving the last try's measured cost (at most CLOSEOUT_RETRY_MOST) against the minute only, down to
      // 20 of Alpaca's remaining. Refused, it is not an attempt; the next pass asks again.
      const retry = this.carriedAttempts > 0;
      const res = retry ? this.budget.tryReserve("P1", Math.min(CLOSEOUT_RETRY_MOST, this.carriedLastCost ?? CLOSEOUT_RETRY_MOST), { fiveSec: false, closeOut: true, label: "carried-position retry" }) : this.budget.first("carried-position sale");
      if (res instanceof Reservation) {
        this.lastCarriedAttempt = now.getTime();
        this.carriedAttempts++;
        const started = this.background("carried", () =>
          withReservation(res, async () => {
            try {
              await this.carriedPhase(date);
            } finally {
              this.carriedLastCost = res.used;
            }
          }, retry ? undefined : "first"),
        );
        if (!started) res.end();
      }
    }

    // The mid-day cycle (Michael, 2026-11-09): at 10:30 AM Central the pause goes on and the mid-day close-out sells everything, retried
    // every 20 seconds until flat, never from the regular close-out time on (that close-out takes over). Its own phase, never `closeout`.
    const mt = this.d.middayCycle === false ? null : middayTimes(current);
    if (inSession && mt && current.phases.armed && now >= mt.pauseAt && !current.phases[MIDDAY_PHASE] && now < this.closeoutAt(day.closeAt) && !this.closingOut && !this.inflight.has("carried") && !this.inflight.has("midday") && now.getTime() - this.lastMiddayAttempt >= (this.middayAttemptDate === date ? this.middayProgress.gapMs(MIDDAY_RETRY_MS, 60_000, this.middayLastRemaining.length) : 0)) {
      if (this.middayAttemptDate !== date) {
        this.middayAttemptDate = date;
        this.middayAttempts = 0;
        this.middayLastCost = null;
        this.middayNotFlatSince = null;
        this.middayLastRemaining = [];
        this.middayProgress.reset();
      }
      const retry = this.middayAttempts > 0;
      // A retry's cost is estimated from the last try's measured cost, at most CLOSEOUT_RETRY_MOST; it reserves that against the shared
      // budget's minute (P1, down to 20 of Alpaca's remaining). The first try is a first try: never refused, counted.
      const estimate = Math.min(CLOSEOUT_RETRY_MOST, this.middayLastCost ?? CLOSEOUT_RETRY_MOST);
      const res = !this.backgroundReady("midday") ? null : retry ? this.budget.tryReserve("P1", estimate, { fiveSec: false, closeOut: true, label: "mid-day close-out retry" }) : this.budget.first("mid-day close-out");
      if (res instanceof Reservation) {
        this.lastMiddayAttempt = now.getTime();
        // A retry sells at most MIDDAY_RETRY_SYMBOLS positions, in turn (the first retry takes the first ten left, and so on).
        const only = retry ? retrySymbols(this.middayLastRemaining, this.middayAttempts - 1) : null;
        this.middayProgress.started(retry ? this.middayLastRemaining.length : Infinity);
        this.middayAttempts++;
        if (!this.background("midday", () => withReservation(res, () => this.middayPhase(date, current, mt.pauseAt, retry, only, res), retry ? undefined : "first"))) res.end();
      }
    }
    // The close-out after the afternoon load window (Michael, 2026-11-12): when the window's 30 minutes are up (or the last entry comes
    // first), entries pause again and the mid-day close-out code sells everything, retried 20 seconds apart (longer while nothing sells, at
    // most a minute; item 3 of 2026-11-13) within the same 60 requests
    // a minute and above the reserve, until flat. Never from the regular close-out time on (that close-out takes over). Its own phase.
    // Michael's request of 2026-11-17 (the window may start again the same day): the close-out's tries and its alert are counted per window
    // (the date and the window's start), so a second window's close-out starts with a first try and can alert again.
    const afternoonKey = `${date}|${afternoonLoadStart(current)?.toISOString() ?? ""}`;
    if (afternoonCloseoutDue && !this.closingOut && !this.inflight.has("carried") && !this.inflight.has("midday") && now.getTime() - this.lastAfternoonAttempt >= (this.afternoonAttemptDate === afternoonKey ? this.afternoonProgress.gapMs(MIDDAY_RETRY_MS, 60_000, this.afternoonLastRemaining.length) : 0)) {
      if (this.afternoonAttemptDate !== afternoonKey) {
        this.afternoonAttemptDate = afternoonKey;
        this.afternoonAttempts = 0;
        this.afternoonLastCost = null;
        this.afternoonLastRemaining = [];
        this.afternoonProgress.reset();
      }
      const retry = this.afternoonAttempts > 0;
      const estimate = Math.min(CLOSEOUT_RETRY_MOST, this.afternoonLastCost ?? CLOSEOUT_RETRY_MOST);
      const res = !this.backgroundReady("midday") ? null : retry ? this.budget.tryReserve("P1", estimate, { fiveSec: false, closeOut: true, label: "afternoon close-out retry" }) : this.budget.first("afternoon close-out");
      if (res instanceof Reservation) {
        this.lastAfternoonAttempt = now.getTime();
        const only = retry ? retrySymbols(this.afternoonLastRemaining, this.afternoonAttempts - 1) : null;
        this.afternoonProgress.started(retry ? this.afternoonLastRemaining.length : Infinity);
        this.afternoonAttempts++;
        // The same background name as the mid-day close-out, so every guard that stands aside for it stands aside for this too.
        const windowStart = afternoonLoadStart(current)?.toISOString() ?? null;
        if (!this.background("midday", () => withReservation(res, () => this.afternoonCloseoutPhase(date, retry, only, res, windowStart), retry ? undefined : "first"))) res.end();
      }
    }
    // The second alert: still not flat 5 minutes after a try first ended not flat (once a day).
    if (inSession && mt && this.middayAttemptDate === date && this.middayNotFlatSince !== null && !current.phases[MIDDAY_PHASE] && this.middayFiveMinAlertDate !== date && now.getTime() - this.middayNotFlatSince >= MIDDAY_NOT_FLAT_ALERT_AFTER_MS) {
      this.middayFiveMinAlertDate = date;
      void this.say("alerts", `**Michael: the mid-day close-out is still NOT FLAT after 5 minutes: ${this.middayLastRemaining.length > 0 ? this.middayLastRemaining.join(", ") : "the positions could not be listed"}.** Entries stay paused and I keep trying within 60 Alpaca requests a minute. You can also close them by hand in Alpaca. No deploy until the account is flat.`, { mentionOwner: true }).catch(() => undefined);
    }
    if (inSession && mt && current.phases.armed) {
      try {
        await this.middayFollowUps(date, current, mt, now);
      } catch (err) {
        this.lastTickError = `mid-day cycle: ${(err as Error).message.slice(0, 120)}`;
        this.d.log?.("error", "midday_followup_failed", { error: (err as Error).message.slice(0, 200) });
      }
    }

    // Close-out runs until the account is flat (after the close it only reports, it sends nothing; a try from 30 minutes after the close
    // writes the phase), and the heartbeat says "fail" for as long as positions remain.
    // Item 3 of 2026-11-13: before the close the retries come 20 s apart, then 40, then every 60; after the close (it only reports then, and
    // a try from 30 minutes on writes the phase) 5 minutes apart for the first two, then 10, then every 15, until the day ends. No hard end (group 2, round 2
    // of the weekend build): with the database down past the hour, the phase, and with it the daily summary, would never come.
    // Group 1, round 2 of the weekend build: in the last minute before the close the tries come every 20 seconds again (the last chances to
    // get flat before the shares, already without their stops, are held overnight); after the close the waits count the tries since the close.
    const attemptsToday = this.closeoutAttemptDate === date ? this.closeoutAttempts : 0;
    const lastMinute = now >= addMinutes(day.closeAt, -1);
    const retryMs = now < day.closeAt ? (lastMinute ? CLOSEOUT_RETRY_MS : retryGapMs(CLOSEOUT_RETRY_MS, attemptsToday, 60_000)) : retryGapMs(5 * 60_000, Math.max(1, this.closeoutAttemptsAfterClose), 15 * 60_000);
    if (now >= this.closeoutAt(day.closeAt) && !current.phases.closeout && !this.closingOut && now.getTime() - this.lastCloseoutAttempt >= retryMs && this.backgroundReady("closeout")) {
      if (this.closeoutAttemptDate !== date) {
        this.closeoutAttemptDate = date;
        this.closeoutAttempts = 0;
        this.closeoutAttemptsAfterClose = 0;
        this.closeoutLastCost = null;
      }
      const path = this.closeoutAttempts === 0 ? "close-out" : "retry";
      // The redesign of 2026-11-14 (decision 6 with Michael's change B): a retry is class P1 of the shared request budget, reserving its
      // estimated cost (the last try's measured cost, at most CLOSEOUT_RETRY_MOST) against the minute, down to 20 of Alpaca's remaining;
      // from CLOSEOUT_NEVER_REFUSED_MS before the close (2:58 PM Central) it is counted but never refused. Refused, it is not an attempt:
      // the next pass asks again. The first try is a first try (never refused, counted).
      const force = now.getTime() >= day.closeAt.getTime() - CLOSEOUT_NEVER_REFUSED_MS;
      const res = path === "retry" ? this.budget.tryReserve("P1", Math.min(CLOSEOUT_RETRY_MOST, this.closeoutLastCost ?? CLOSEOUT_RETRY_MOST), { fiveSec: false, force, closeOut: true, label: "close-out retry" }) : this.budget.first("close-out");
      if (res instanceof Reservation) {
        this.lastCloseoutAttempt = now.getTime();
        this.closeoutAttempts++;
        if (now >= day.closeAt) this.closeoutAttemptsAfterClose++;
        const closeAt = day.closeAt;
        const started = this.background("closeout", () =>
          withReservation(res, async () => {
            try {
              await this.closeoutPhase(date, now >= addMinutes(closeAt, 30), closeAt, path);
            } finally {
              this.closeoutLastCost = res.used;
            }
          }, path === "retry" ? undefined : "first"),
        );
        if (!started) res.end();
      }
    }
    if (now >= addMinutes(day.closeAt, 5) && current.phases.closeout && !current.phases.summary) {
      this.background("summary", () => this.summaryPhase(date));
    }
  }

  // The order sync, in the background: a sale that takes a while (a liquidation waits for cancels) must never hold up reading
  // Michael's next command. While a close-out is running, and from the close-out time on, the missing-exit check is switched off
  // and nothing is sold here: the close-out alone flattens the account. It is asked again just before each sale, so a close-out
  // that starts meanwhile switches it off. One at a time: a sync already running is never doubled.
  // The redesign of 2026-11-14, part 2: it hands each entry's action to the protection loop and carries on (it never waits on a sale), and
  // asks the loop for wakes instead of a sync brought forward. It is routine work.
  private startSync(dayNow: DayRecord, closeAt: Date): void {
    if (!this.backgroundReady("risk")) return;
    this.lastSync = this.d.now().getTime();
    // Item 1 of 2026-11-16 (group 1, round 1): any full sync that starts after a reconnect is the sync owed for it (never two in a row).
    this.reconnectSyncOwed = false;
    const risk = this.riskDeps();
    const protect = () => this.protectNow(closeAt);
    const streamLive = this.orderStreamLive();
    this.background("risk", async () => {
      // While the daily loss stop is in force its own retry re-sells whatever is still held, inside its request budget; the
      // missing-exit check would otherwise start a liquidation of its own for every such position every 30 seconds (round 8).
      const lossStopped = await this.lossStopInForce(dayNow.tradeDate);
      const synced = await syncOrders(risk, dayNow, { protect: () => !lossStopped && protect(), streamLive, middayOwnsSelling: () => this.middayOwnsSelling, loop: this.loop });
      await this.lostExitsFollowUp(dayNow.tradeDate, synced.unprotected);
      await this.stopCancelFollowUp(dayNow.tradeDate);
      await sweepEntriesWhileStopped(risk);
    });
  }

  // Group 2, round 1 of the redesign (part 2): an action of the loop that threw is logged at error level and alerted, at most once every 5
  // minutes (as a failed "risk" step was before part 2); the loop waits 5 s, doubling to 30 s, before acting on that entry again.
  private protectionActionFailed(id: string, label: string, err: unknown): void {
    const msg = (err as Error)?.message?.slice(0, 150) ?? String(err).slice(0, 150);
    this.lastTickError = `protection (${label}): ${msg}`;
    this.d.log?.("error", "protection_action_failed", { clientOrderId: id, label, error: msg });
    const t = this.d.now().getTime();
    const last = this.lastBackgroundAlert.get("protection");
    if (last === undefined || t - last >= 5 * 60_000) {
      this.lastBackgroundAlert.set("protection", t);
      void this.say("alerts", `Step "protection" failed (${label}): ${msg}`).catch(() => undefined);
    }
  }

  // The list-lag wait is over only when no list-lag wake is left in the loop (one dropped window or a protection look for another entry does
  // not end it while another list-lag look still waits on its floor; group 2, round 2 of part 2): its out-of-room event is then stored
  // afresh next time (part 1, group 2 round 4), and entries stop giving way for it.
  private lagWaitOver(): void {
    for (const w of this.loop.pendingWakes().values()) if (w.kind === "lag") return;
    this.lagWaits = 0;
    this.budget.stopWaiting("list lag recheck");
  }

  // The redesign of 2026-11-14, part 2: one look of the protection loop for the entries that are due: the reads the order sync makes, for
  // those entries only, and their decisions (risk.ts `syncOrders` with `only`). One at a time with the regular sync (both are "risk"); it
  // never resets the regular sync's 10 seconds. A look only for list-lag rechecks runs inside a P2 reservation of its cost (the order list's
  // pages as the last sync read them, the positions, and a lookup per older entry), as in part 1; any other look is routine work, as the
  // sync it replaces was. Without room it waits for room (entries give way meanwhile).
  private async look(ids: ReadonlySet<string>, kind: WakeKind, extraRequests: number, untilMs = Infinity): Promise<{ outcome: "busy" | "done" | "failed" | "idle" } | { outcome: "wait"; retryAt: number }> {
    const s = this.sessionForSync;
    if (!s || this.d.now() >= s.closeAt) return { outcome: "idle" };
    // Group 1, round 1 of part 2: the regular sync (the record of truth, every 10 s) goes first. When it is due, it starts now and the look
    // waits a quarter second (its wakes kept), so looks can never crowd it out.
    if (this.d.now().getTime() - this.lastSync >= SYNC_EVERY_MS) {
      this.startSync(s.day, s.closeAt);
      return { outcome: "busy" };
    }
    if (!this.backgroundReady("risk")) return { outcome: "busy" };
    let res: Reservation | null = null;
    if (kind === "lag") {
      const cost = this.syncMemory.lastListPages + 1 + extraRequests;
      const r = this.budget.tryReserve("P2", cost, { label: "list lag recheck", waitKey: "list lag recheck" });
      if (!(r instanceof Reservation)) {
        // Stored once per wait (the first refusal in a row; group 2, round 3 of part 1); `next` says what comes: the look when there is room,
        // or the regular sync when the 30 s window ends first (the loop then drops it).
        if (++this.lagWaits === 1) this.d.log?.("info", "timed_out_try_out_of_room", { stage: "list lag recheck", cost, why: r.why, roomInMs: r.at - this.d.now().getTime(), next: r.at < untilMs ? "when the budget has room" : "regular sync" });
        // Decision 5 as changed by A (part 1, round 4): entries give way while it waits on its floor, through to its next look (the loop
        // looks again at `retryAt`), never past the latest due lag window's end; a refusal for another reason ends the give-way (the budget).
        if (r.why === "floor") this.budget.extendWait("list lag recheck", Math.min(r.at + 500, untilMs));
        return { outcome: "wait", retryAt: r.at };
      }
      this.lagWaits = 0;
      res = r;
    }
    this.inflight.add("risk");
    try {
      await outsideScope(async () => {
        const risk = this.riskDeps();
        const protect = () => this.protectNow(s.closeAt);
        const lossStopped = await this.lossStopInForce(s.day.tradeDate);
        const run = () => syncOrders(risk, s.day, { protect: () => !lossStopped && protect(), streamLive: this.orderStreamLive(), middayOwnsSelling: () => this.middayOwnsSelling, loop: this.loop, only: ids });
        const synced = res ? await withReservation(res, run) : await run();
        await this.lostExitsFollowUp(s.day.tradeDate, synced.unprotected);
        await this.stopCancelFollowUp(s.day.tradeDate);
      });
      // A protection look may have served list-lag wakes (a lag look's grant already ended its wait): the wait is over if no list-lag wake
      // is left (part 1, group 2 round 4; group 2, round 2 of part 2).
      if (kind !== "lag") this.lagWaitOver();
      return { outcome: "done" };
    } catch (err) {
      this.d.log?.("warn", kind === "lag" ? "list_lag_recheck_failed" : "protection_look_failed", { error: (err as Error).message.slice(0, 120), entries: ids.size, next: "a look again after the loop's wait (1 s, doubling to 10 s)" });
      return { outcome: "failed" };
    } finally {
      res?.end();
      this.inflight.delete("risk");
      // A regular sync that fell due while this look ran (its pass found "risk" held) starts now.
      if (this.d.now().getTime() - this.lastSync >= SYNC_EVERY_MS && this.sessionForSync && this.d.now() < this.sessionForSync.closeAt) this.startSync(this.sessionForSync.day, this.sessionForSync.closeAt);
      // Item 1 of 2026-11-16 (group 1, round 1): a sync owed after a reconnect that came while this look ran starts now.
      else if (this.reconnectSyncOwed) this.syncAfterReconnect();
    }
  }

  // Decision 1 of 2026-11-06: after a sync, an entry reported with both exits lost that the sync neither sold nor found closed (Alpaca's
  // order list may not show the cancel yet) gets another sync shortly: at most 3 more, 0.5, 1 and 2 seconds later. After that the
  // 10 second sync is the backstop, as before.
  private async lostExitsFollowUp(date: string, sold: string[]): Promise<void> {
    if (this.lostExitsPending.size === 0) return;
    const rows = await this.d.store.listOrders(date).catch(() => null);
    const now = this.d.now().getTime();
    for (const [id, p] of [...this.lostExitsPending]) {
      const row = rows?.find((r) => r.clientOrderId === id);
      // The redesign of 2026-11-14, part 2: handled also when the loop is running its action, or it is on the stuck list.
      if (sold.includes(p.symbol) || this.loop.busy(id) || this.syncMemory.stuck.has(id) || !row || row.closedAt || p.tries >= 3 || now - p.at > 10_000) {
        this.lostExitsPending.delete(id);
        continue;
      }
      const wait = [500, 1_000, 2_000][p.tries]!;
      p.tries++;
      this.loop.wake(id, now + wait, "protect");
    }
  }

  // Michael's item 1 of 2026-11-13 (afternoon), the backup: after a sync, a remainder reported by the live update whose entry has no fresh
  // stop yet and is still open gets another sync, at most 3 more, 0.5, 1 and 2 seconds later, within 10 seconds of the report.
  // Michael's change of 2026-11-13 (evening): an entry whose order list any sync saw still showing the stop open (`liveLagTries`) is left
  // to the sync's own quick rechecks, which run inside P2 reservations of the shared request budget, or, after their 30 seconds, to the
  // regular sync; the backup never adds uncharged syncs for it.
  private async stopCancelFollowUp(date: string): Promise<void> {
    if (this.stopCancelPending.size === 0) return;
    const rows = await this.d.store.listOrders(date).catch((err) => {
      this.d.log?.("warn", "stop_cancel_followup_read_failed", { error: (err as Error).message.slice(0, 120), pending: this.stopCancelPending.size });
      return null;
    });
    const now = this.d.now().getTime();
    for (const [id, p] of [...this.stopCancelPending]) {
      const row = rows?.find((r) => r.clientOrderId === id);
      const handled = this.syncMemory.freshStops.has(id) || this.syncMemory.stuck.has(id) || this.syncMemory.liveLagTries.has(id) || this.loop.busy(id);
      if (handled || !row || row.closedAt || p.tries >= 3 || now - p.at > 10_000) {
        this.stopCancelPending.delete(id);
        continue;
      }
      const wait = [500, 1_000, 2_000][p.tries]!;
      p.tries++;
      this.loop.wake(id, now + wait, "protect");
    }
  }

  // Decision 3's measurement: loads the day's saved totals once, settles the sales whose 5 seconds are over, and saves the totals.
  private async stopGapStep(date: string, now: Date): Promise<void> {
    if (this.stopGapDate !== date) {
      if (!this.stopGapRetry.due(now.getTime())) return;
      let saved: StopGapDay | null;
      try {
        saved = await this.d.store.getControl<StopGapDay>(stopGapKey(date));
        this.stopGapRetry.succeeded();
      } catch {
        this.stopGapRetry.failed(now.getTime());
        return; // tried again on the backoff
      }
      this.stopGap.startDay(date, saved);
      this.stopGapDate = date;
    }
    if (this.stopGap.settle(now.getTime()) && !this.stopGapSaving) {
      this.stopGapSaving = true;
      void this.d.store
        .setControl(stopGapKey(date), this.stopGap.saved())
        .catch(() => undefined)
        .finally(() => void (this.stopGapSaving = false));
    }
  }

  // Item 10: one line of statistics a minute, all session.
  private minuteStats(): Record<string, unknown> {
    const frees = this.orderHandler?.takeMinuteFrees() ?? [];
    const writes = this.d.store.takeSoonWriteTimes?.() ?? [];
    const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : null);
    const shadow = this.shadow;
    this.shadow = [];
    const noEstimate = this.shadowNoEstimate;
    this.shadowNoEstimate = 0;
    const worst = shadow.length ? shadow.reduce((a, b) => (Math.abs(b.diff) > Math.abs(a.diff) ? b : a)) : null;
    const reserve = this.d.governor.takeMinuteReserve?.();
    const raw = this.rawSample;
    this.rawSample = null;
    return {
      ...this.d.governor.stats(),
      tradesLastMinute: this.d.governor.tradesInLastMinute(),
      orderStream: this.orderStreamStats(),
      freesThisMinute: { n: frees.length, medianMs: med(frees), slowestMs: frees.length ? Math.max(...frees) : null },
      databaseCloses: { n: writes.length, medianMs: med(writes), slowestMs: writes.length ? Math.max(...writes) : null },
      entryExpiry: this.entryExpiry.counts,
      // Decision 4 of 2026-11-06: with the read time of the largest gap, the time since the last fill and since the book's quiet read.
      lossStopShadow: shadow.length || noEstimate ? { n: shadow.length, noEstimate, meanDiff: shadow.length ? Math.round((shadow.reduce((a, b) => a + b.diff, 0) / shadow.length) * 100) / 100 : null, maxAbsDiff: worst ? Math.round(Math.abs(worst.diff) * 100) / 100 : null, ...(worst ? { maxAt: new Date(worst.at).toISOString(), maxEstimate: Math.round(worst.estimate * 100) / 100, maxEquity: Math.round(worst.equity * 100) / 100, maxSinceFillMs: worst.sinceFillMs, maxSinceBaseMs: worst.sinceBaseMs } : {}), book: this.shadowLedger.counts } : null,
      // Decision 7 of 2026-11-06: the request reserve's range this minute.
      ...(reserve ? { reserveThisMinute: reserve } : {}),
      viewEveryMs: this.orderStreamLive() ? VIEW_EVERY_MS : VIEW_EVERY_NO_STREAM_MS,
      ...(raw ? { rawUpdate: raw } : {}),
      // The redesign of 2026-11-14, part 1: the shared request budget this minute: requests sent by tag (entries, first tries, P1, P2,
      // routine, and the clock's separate bucket), tries granted and refused (and why), forced (the regular close-out's retry from 2:58), overdrafts, the
      // most budgeted requests in any minute and any 5 seconds (at most 60 and 15 unless forced or overdrawn), and entries refused while a
      // P2 try waited on its floor or (Michael's ruling of 2026-11-17) a stuck sale waited for Alpaca's room (`stuckSaleHolds`,
      // `stuckSaleEntriesRefused`).
      requestBudget: this.budget.takeMinute(),
      // The redesign of 2026-11-14, part 2: the protection loop this minute (looks run, list-lag looks, failed, put off while a sync ran,
      // waited for room, actions started, wakes asked for; wakes pending and actions running now).
      protectionLoop: this.loop.takeMinute(),
    };
  }

  // Posts the request for the next session once the current session is over, and the review and reminder before
  // an open. Returns today's record (updated if today is the next session).
  private async limitsFlow(now: Date, date: string, today: DayRecord, steps: MorningSteps): Promise<DayRecord> {
    const next = await this.sessions.next(now);
    if (!next) return today;
    if (next.date !== date) {
      // The next session is a later day. Its request goes out once today's session is over and summarized.
      const sessionOn = today.isTradingDay && today.openAt !== null && today.closeAt !== null && now >= today.openAt && now < addMinutes(today.closeAt, 10);
      if (sessionOn) return today;
      const target = await ensureDay(steps, next.date);
      await this.loadNoteIfNeeded(steps, await postLimitsRequest(steps, target), now);
      return today;
    }
    // Today is the next session and has not opened: post the request if the evening one was missed, then the
    // review at open - 60 and the reminder at open - 10.
    let cur = await postLimitsRequest(steps, today);
    cur = await this.loadNoteIfNeeded(steps, cur, now);
    cur = await postMorningReview(steps, cur);
    cur = await postReminderIfNeeded(steps, cur);
    return cur;
  }

  // Once per day record: a request posted before load mode existed (by an older release) did not show the day's mode. Since the
  // speed release (decision 6, "one limits post") no separate note is posted for it: the mode is line 5 of every limits list (the
  // morning review, every limits reply, `limits`), so the day is only marked as shown.
  private async loadNoteIfNeeded(steps: MorningSteps, day: DayRecord, now: Date): Promise<DayRecord> {
    if (!day.isTradingDay || !day.phases.request || day.phases.request === "skipped" || day.phases[LOAD_NOTE_PHASE] || day.status === "lapsed" || !day.openAt || now >= day.openAt) return day;
    return setPhase(steps.store, day.tradeDate, LOAD_NOTE_PHASE, `folded into the limits lists ${now.toISOString()}`);
  }

  private async screenPhase(date: string, load = false): Promise<void> {
    const startedMs = this.d.now().getTime();
    const { symbols: list, names } = await this.d.buildLiveList(load ? { load: true } : undefined);
    await this.d.store.updateDay(date, { liveList: list });
    await this.d.store.setControl(`live_names:${date}`, names).catch(() => undefined);
    await setPhase(this.d.store, date, "screen", this.d.now().toISOString());
    // Item 4 of 2026-11-13 (logging only, stored): how long the screen took, so each morning measures it against the 10 minutes to "Armed".
    this.d.log?.("info", "screen_done", { load, symbols: list.length, durationMs: this.d.now().getTime() - startedMs });
    await this.say("trading", `Today's live list (${list.length})${load ? ", a load day: cheap, heavily traded names" : ""}:\n${list.length ? formatLiveList(list, names) : "(empty, nothing passed the screen)"}\n${PAPER_ONLY}`);
  }

  // Keeps the cached broker view fresh while the session runs: account and positions every 10 seconds while the live order updates
  // are connected (they keep the positions current in between), every 5 seconds while they are not (2 requests); settings and clock
  // every 30 seconds. Skipped while Alpaca's request budget is down to the safety reserve.
  private async refreshView(now: Date, date: string): Promise<void> {
    const t = now.getTime();
    try {
      // By the view's own age, so a read made earlier in the pass (the carried-position scan) is not repeated.
      if (this.view.fastAgeMs() >= (this.orderStreamLive() ? VIEW_EVERY_MS : VIEW_EVERY_NO_STREAM_MS) - 500 && this.d.governor.canSpend()) {
        const readFrom = this.d.now().getTime();
        await this.view.refreshFast();
        this.shadowRebase(readFrom, this.d.now().getTime());
      }
      // Decision 7 (2026-11-06): the request reserve follows the symbols open (held, or with an entry working). The gate counts them
      // before each entry; this keeps the count current as positions close.
      const positions = this.view.cachedPositions();
      if (positions) {
        // Michael's approval C of 2026-11-12: the index's still-working set (the same one the sync and the gate read), not the full list.
        const working = await dayOrderIndex(this.d.store, date).then((i) => i.active()).catch(() => null);
        if (working) this.d.governor.setOpenSymbols(new Set([...positions.map((p) => p.symbol), ...working.map((o) => o.symbol)]).size);
      }
      if (t - this.lastViewSlow >= 30_000) {
        this.lastViewSlow = t;
        await Promise.all([this.view.refreshConfig(), this.view.refreshClock()]);
      }
    } catch (err) {
      this.lastTickError = `broker view: ${(err as Error).message.slice(0, 120)}`;
      if (t - this.lastViewError >= 5 * 60_000) {
        this.lastViewError = t;
        await this.say("alerts", `I could not refresh my view of the account (${(err as Error).message.slice(0, 100)}). Entries are refused while it is stale; I keep trying.`);
      }
    }
  }

  private startStream(day: DayRecord, symbols: string[]): void {
    this.streamDate = day.tradeDate;
    // A load day: the churn rules apply while its window is on (read from the latest copy of the day, so `load off` takes effect).
    this.strategy = this.makeStrategy(day, symbols);
    this.stream = this.d.makeStream(symbols, (t) => this.onTrade(t));
    this.stream.start();
    this.d.log?.("info", "stream_started", { symbols: symbols.length });
  }

  // The churn rules apply while a load window is on: a load day's morning window, or the afternoon load window (Michael, 2026-11-11),
  // read from the latest copy of the day, so `load off` and `load afternoon` take effect. On a normal day without `load afternoon`,
  // inLoadWindow is always false, so the placeholder behaves exactly as before.
  private makeStrategy(day: DayRecord, symbols: string[]): BusyPlaceholder {
    // Michael's request of 2026-11-18: the afternoon load window's own stop and take-profit, read from the same latest copy of the day.
    const latest = () => (this.lastDay?.tradeDate === day.tradeDate ? this.lastDay : day);
    return new BusyPlaceholder(symbols, { loadActive: (t) => inLoadWindow(latest(), t), loadExits: (t) => loadExitsAt(latest(), t) });
  }

  // `load afternoon` on a normal morning (Michael's standing requirement of 2026-11-11): the command has checked every condition and
  // starts this. The screen runs in the background (it can take minutes); the window itself is decided later (see pass). False if one
  // is already running for today.
  // `exits`: the stop and take-profit given with this `load afternoon` (Michael's request of 2026-11-18), carried to the window's start.
  private afternoonScreenState: { date: string; route: "pause" | "stop"; exits?: LoadExits; state: "running" | "ready" | "cancelled"; readyAt: number; switched?: boolean; result?: { switched: boolean; list: string[]; route: "pause" | "stop"; exits?: LoadExits } } | null = null;
  private lastPollStartedAt = -Infinity;
  private startAfternoonScreen(date: string, route: "pause" | "stop" = "pause", exits?: LoadExits): boolean | "finishing" {
    // Fix of 2026-11-12 (round 3, group 2): a cancelled screen still running is told apart from one that is live, so the reply can ask
    // Michael to send the command again instead of saying "already running" with nothing to follow.
    if (this.inflight.has("afternoon-screen")) return this.afternoonScreenState === null || this.afternoonScreenState.state === "cancelled" ? "finishing" : false;
    if (this.afternoonScreenState?.date === date && this.afternoonScreenState.state !== "cancelled") return false;
    const mine = { date, route, ...(exits ? { exits: { ...exits } } : {}), state: "running" as "running" | "ready" | "cancelled", readyAt: 0 } as NonNullable<Worker["afternoonScreenState"]>;
    this.afternoonScreenState = mine;
    this.background("afternoon-screen", async () => {
      try {
        const result = await this.afternoonLoadList(date, () => mine.state === "cancelled", () => void (mine.switched = true), route);
        if (result === null || mine.state === "cancelled") return; // cancelled by a command: it said so
        mine.state = "ready";
        mine.readyAt = this.d.now().getTime();
        mine.result = { ...result, route, ...(mine.exits ? { exits: mine.exits } : {}) };
      } catch (err) {
        if (this.afternoonScreenState === mine) this.afternoonScreenState = null;
        if (mine.state === "cancelled") return;
        const why = (err as Error).message.slice(0, 200).replace(/\.$/, "");
        this.d.log?.("info", "load_afternoon_failed", { error: why });
        const stopNow = await this.d.store.getControl<StopFlag>(CONTROL_STOP).catch(() => null);
        // `undefined` when the pause cannot be read: the tail is then neutral (never "Still paused" after "no longer paused").
        const pauseNow = await readPause(this.d.store, date).catch(() => undefined);
        const dayNow = await this.d.store.getDay(date).catch(() => null);
        const timesNow = dayNow ? middayTimes(dayNow) : null;
        const tail = afternoonFailureTail(stopNow, pauseNow, why, timesNow !== null && this.d.now() >= timesNow.lastEntryAt);
        await this.say("commands", `Afternoon load window not started: ${why}.${tail ? ` ${tail}` : ""}`);
      }
    });
    return true;
  }

  // A `stop`, `flatten` or `go` while the screen is running or done but not decided: the pending window is cancelled for good (the
  // finished screen then changes nothing). True if one was pending.
  // "switched" when the screen had already switched the live list to the cheap names (they then stay live; the reply says so).
  private cancelAfternoonScreen(date: string): boolean | "switched" {
    const st = this.afternoonScreenState;
    if (!st || st.date !== date || st.state === "cancelled") return false;
    st.state = "cancelled";
    this.d.log?.("info", "load_afternoon_cancelled", { date, switched: Boolean(st.switched) });
    return st.switched ? "switched" : true;
  }

  // The screen and the feed switch for `load afternoon`. On a load day the cheap list is already live. Otherwise the cheap-symbol
  // screen runs and the price feed switches to its 30 names on the same connection. Throws if the screen fails or finds nothing.
  // Returns null (and changes nothing) if the window was cancelled while the screen ran; throws if, when it finishes, its route no longer
  // holds (the pause route: the pause on with no stop; the stop route, ruling E of 2026-11-12: Michael's own stop still on): the list
  // and the feed switch only while nothing trades.
  private async afternoonLoadList(date: string, cancelled: () => boolean = () => false, onSwitched: () => void = () => undefined, route: "pause" | "stop" = "pause"): Promise<{ switched: boolean; list: string[] } | null> {
    const day = await this.d.store.getDay(date);
    if (!day) throw new Error("no day record for today");
    if (isLoadDay(day)) return { switched: false, list: day.liveList ?? [] };
    const { symbols: list, names } = await this.d.buildLiveList({ load: true });
    if (cancelled()) return null;
    if (list.length === 0) throw new Error("the cheap-symbol screen found no names");
    const pauseNow = await readPause(this.d.store, date);
    const stopNow = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
    if (cancelled()) return null;
    if (!switchAllowed(pauseNow, stopNow, route)) {
      this.d.log?.("info", "load_afternoon_not_switched", { pause: Boolean(pauseNow?.on), stop: Boolean(stopNow?.on) });
      throw new Error(`${notSwitchedWhy(pauseNow, stopNow, route)}, so the live list was not changed`);
    }
    // Fix of 2026-11-12 (group 1, round 3, probes G and H): a `go` or `stop` handled while these writes are in flight must still win. The
    // old list and names are kept; after the writes the cancel, the pause and the stop are read again, and if any changed the old list
    // is written back and nothing else changes (no strategy or feed switch, no post). From the last check to the switch in memory
    // there is no wait, so nothing can slip in between. Group 1, round 1 of 2026-11-12: any error from the first list write on (a
    // failed write, a failed read after it) is handled the same way: logged, the old list written back once, and if that write-back
    // fails, an alert, because a restart that day would start the feed from the stored list. This runs when the window was cancelled too.
    const oldList = day.liveList ?? [];
    const oldNames = await this.d.store.getControl<Record<string, string>>(`live_names:${date}`).catch(() => null);
    let restored = false;
    let restoreFailed = false;
    const putBack = async (why: string): Promise<void> => {
      restored = true;
      try {
        const back = await this.d.store.updateDay(date, { liveList: oldList });
        if (oldNames !== null) await this.d.store.setControl(`live_names:${date}`, oldNames).catch(() => undefined);
        this.lastDay = back;
        this.d.log?.("info", "load_afternoon_list_restored", { why });
      } catch (err) {
        restoreFailed = true;
        this.d.log?.("error", "load_afternoon_restore_failed", { why, error: (err as Error).message.slice(0, 160) });
        await this.say("alerts", `Afternoon load window: I could not put the live list back after the window did not start (${why}). The names trading now are unchanged, but the stored live list may still be the cheap names, and a restart would trade them. Send \`status\`; if its live list shows the cheap names, tell the builder before any restart or deploy.\n${PAPER_ONLY}`).catch(() => undefined);
      }
    };
    let updated: DayRecord;
    try {
      updated = await this.d.store.updateDay(date, { liveList: list });
      await this.d.store.setControl(`live_names:${date}`, names).catch(() => undefined);
      const pauseAfter = await readPause(this.d.store, date);
      const stopAfter = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
      if (cancelled() || !switchAllowed(pauseAfter, stopAfter, route)) {
        const why = cancelled() ? "cancelled by a command" : notSwitchedWhy(pauseAfter, stopAfter, route);
        await putBack(why);
        if (cancelled()) return null;
        // Group 2, round 1 of 2026-11-12: "the live list was not changed" only when the write-back worked; otherwise the stored list
        // may still be the cheap names (the alert says so).
        const after = restoreFailed ? "; the names trading are unchanged, but the stored live list could not be put back (see the alert in alerts)" : ", so the live list was not changed";
        throw new Error(`${why}${after}`);
      }
    } catch (err) {
      if (!restored) {
        this.d.log?.("error", "load_afternoon_write_failed", { error: (err as Error).message.slice(0, 160) });
        await putBack(`an error: ${(err as Error).message.slice(0, 80)}`);
      }
      throw err;
    }
    // No await from here to the end of the switch.
    this.lastDay = updated;
    if (this.stream && this.streamDate === date) {
      this.strategy = this.makeStrategy(updated, list);
      if (this.stream.setSymbols) this.stream.setSymbols(list);
      else {
        this.endStream();
        this.startStream(updated, list);
      }
    }
    onSwitched();
    this.d.log?.("info", "afternoon_load_list", { symbols: list.length });
    // Group 1, round 1 of 2026-11-12 (wording): the post does not promise the window, since a `stop`, `flatten` or `go` before the
    // decision cancels it and leaves these names live.
    await this.say("trading", `Live list switched to ${list.length} cheap, heavily traded names for the afternoon load window. The window starts only after I check again that the account is flat and paused; a \`stop\`, \`flatten\` or \`go\` before then cancels it, and these names stay live under today's normal limits:\n${formatLiveList(list, names)}\n${PAPER_ONLY}`);
    return { switched: true, list };
  }

  private endStream(): void {
    this.stream?.stop();
    this.stream = null;
    this.strategy = null;
  }

  // Alpaca's live order updates (every day since the speed release). A fill that leaves a symbol at 0 shares frees it at once, in
  // memory first (order-stream.ts, caching-store.ts updateOrderSoon).
  private startOrderStream(date: string): void {
    this.endOrderStream();
    this.orderStreamDate = date;
    // The shadow book starts each day afresh (group 2 review, round 1): it is set again from the first quiet read.
    this.shadowLedger.drop();
    const store = this.d.store;
    this.orderHandler = new OrderUpdateHandler({
      getOrder: (id) => store.getOrder(id),
      closeOrder: (id, patch) => (store.updateOrderSoon ? store.updateOrderSoon(id, patch) : store.updateOrder(id, patch)),
      dropPosition: (symbol) => this.view.dropPosition(symbol),
      setPosition: (symbol, qty, price) => this.view.setPositionFromUpdate(symbol, qty, price),
      onExitEnded: (clientOrderId) => this.syncMemory.mustLook.add(clientOrderId),
      onStopCancelled: (info) => {
        this.d.log?.("info", "stop_cancelled_at_partial_take_profit", { symbol: info.symbol });
        // Item 1 of 2026-11-13 (afternoon): the order sync takes this live report over an order list that may still show the stop open.
        this.syncMemory.liveStopCancelled.set(info.clientOrderId, info.atMs);
        this.protectFirst.mark(info.clientOrderId, info.symbol, "a remainder's stop was cancelled");
        this.stopCancelPending.set(info.clientOrderId, { symbol: info.symbol, at: this.d.now().getTime(), tries: 0 });
        this.stopCancelSeen.set(info.symbol, { alpacaAtMs: info.atMs, receivedMs: this.d.now().getTime(), wokeFor: info.atMs + BARE_GRACE_MS });
        // A4 of 2026-11-12: BARE_GRACE_MS is 0, so the entry is looked at once and the remainder gets its fresh stop (the redesign of
        // 2026-11-14: a wake of the protection loop for that entry, not a sync of the whole account).
        this.loop.wake(info.clientOrderId, info.atMs + BARE_GRACE_MS, "protect");
      },
      // A4 of 2026-11-12: a fresh stop's status. If it ended (cancelled, expired or rejected) other than by one of our own sales, the
      // remainder is unprotected again: the protection loop looks at the entry at once and its missing-exit check sells it, as before A4.
      onFreshStopUpdate: (info) => {
        const f = [...this.syncMemory.freshStops.values()].find((x) => x.stopClientOrderId === info.clientOrderId);
        if (!f) {
          // Ruling B (group 1, round 2 of the night release): a fresh stop that hit the 15 second limit has ended at Alpaca: its entry's
          // sale is due now (no new request; a pending retry time for that entry is cleared), so the protection loop looks at the entry at once.
          const entry = this.syncMemory.timedOutStops.get(info.clientOrderId);
          if (entry && (info.event === "canceled" || info.event === "expired" || info.event === "rejected")) {
            // Recorded before any early return (group 1, round 5): a sale of that entry running now will not back off afterwards.
            noteTimedOutStopEnded(this.syncMemory, info.clientOrderId, this.d.now().getTime());
            if (this.closingOut || this.liquidator.isLiquidatingOthers() || this.middayOwnsSelling) return;
            this.protectFirst.mark(entry, info.symbol, "a fresh stop that hit the 15 second limit ended");
            this.loop.wake(entry, this.d.now().getTime(), "protect");
          }
          return;
        }
        // Ruling B of 2026-11-12: a stop that was unclear gets its time to confirm logged here too.
        settleFreshStop((e, data) => this.d.log?.("info", e, data), f, info.status, "live update", this.d.now().getTime());
        if (info.event === "canceled" || info.event === "expired" || info.event === "rejected") {
          this.d.log?.("info", "fresh_stop_ended", { symbol: info.symbol, stopClientOrderId: info.clientOrderId, event: info.event });
          if (this.closingOut || this.liquidator.isLiquidatingOthers() || this.middayOwnsSelling) return;
          this.protectFirst.mark(f.entryClientOrderId, info.symbol, "a fresh stop ended");
          this.loop.wake(f.entryClientOrderId, this.d.now().getTime(), "protect");
        }
      },
      // A5 of 2026-11-12: an entry filled after the load window's 5 second cancel was sent: its exits are most likely being cancelled by
      // Alpaca, so its share is sold at once (the sale waits for that cancel; nothing is sold if Alpaca kept the exits).
      onEntryFill: (info) => {
        const sentAt = this.entryExpiry.cancelSentAt(info.clientOrderId);
        if (sentAt === undefined) return;
        this.protectFirst.mark(info.clientOrderId, info.symbol, "a load entry filled after its cancel was sent");
        void this.fastLostExit(info.clientOrderId, info.symbol, info.atMs);
      },
      // Decision 1 of 2026-11-06: both exits of a filled entry ended with nothing filled. The order sync runs at once (not at the
      // next 10 second sync); its missing-exit check sells the shares, with its guards (no sale while a close-out or any other sale
      // runs, only the newest entry of the symbol, none if a sell is already working on it). Not while a sale or the close-out
      // runs: the exits were most likely cancelled by that sale itself, and the check is off then anyway.
      onExitsLost: (info) => {
        this.syncMemory.mustLook.add(info.clientOrderId);
        if (this.closingOut || this.liquidator.isLiquidatingOthers()) return;
        this.d.log?.("info", "exits_lost", { symbol: info.symbol });
        this.protectFirst.mark(info.clientOrderId, info.symbol, "both exits lost");
        this.lostExitsPending.set(info.clientOrderId, { symbol: info.symbol, at: this.d.now().getTime(), tries: 0 });
        this.loop.wake(info.clientOrderId, this.d.now().getTime(), "protect");
      },
      entryForGroup: (groupId) => [...this.syncMemory.lastSeen.values()].find((o) => o.groupId === groupId) ?? null,
      onAnyUpdate: (u) => this.moveWatch.onUpdate(u),
      replacedOf: (o) => this.moveWatch.replacedOf(o),
      now: () => this.d.now().getTime(),
      log: (e, data) => this.d.log?.("info", e, data),
    });
    const handler = this.orderHandler;
    this.orderStreamWasDown = false;
    this.reconnectSyncOwed = false;
    this.orderStream = this.d.makeOrderStream!(
      (u) => {
        handler.handle(u).catch((err) => this.d.log?.("error", "order_stream_update_failed", { error: (err as Error).message.slice(0, 200) }));
        this.afterOrderUpdate(u);
      },
      (status) => this.onOrderStreamStatus(status),
    );
    this.orderStream.start();
    this.d.log?.("info", "order_stream_started", {});
  }

  // A5 of 2026-11-12: the fast sale of an entry that filled as its cancel reached Alpaca. Not while a close-out, the mid-day close-out or
  // a carried-position sale runs, nor from the close-out time on, nor while the daily loss stop is in force (they sell it themselves);
  // only the newest open entry of its symbol (the order sync's rule). Another one-entry sale running does not stop it: it waits its turn in
  // the one-at-a-time sell path, and stands aside at its turn if a sale of the whole account was asked for, a close-out step owns selling
  // or the close-out time has come (part 2 of the redesign, `Liquidator.run`). Never throws.
  private async fastLostExit(clientOrderId: string, symbol: string, fillAtMs: number): Promise<void> {
    try {
      const s = this.sessionForSync;
      if (!s || this.d.now() >= this.closeoutAt(s.closeAt)) return;
      if (this.closingOut || this.middayOwnsSelling || this.inflight.has("closeout") || this.inflight.has("carried") || this.inflight.has("midday")) return;
      if (await this.lossStopInForce(s.day.tradeDate)) return;
      const rows = await this.d.store.listOrders(s.day.tradeDate);
      const row = rows.find((r) => r.clientOrderId === clientOrderId);
      if (!row || row.closedAt || row.symbol !== symbol) return;
      const newer = rows.some((r) => r.symbol === symbol && !r.closedAt && r.clientOrderId !== clientOrderId && (r.createdAt ?? "") > (row.createdAt ?? ""));
      if (newer) return;
      this.d.log?.("info", "lost_exit_fast_start", { symbol, msFromFill: this.d.now().getTime() - fillAtMs });
      await fastLostExitSale(this.riskDeps(), s.day, this.syncMemory, row, fillAtMs);
    } catch (err) {
      this.d.log?.("warn", "lost_exit_fast_failed", { symbol, error: (err as Error).message.slice(0, 120) });
    }
  }

  // After the handler has seen an update: wake the waits for that symbol (item 9), give the stop-gap measurement the fill price of one
  // of our own sells, and keep one raw update a minute for the statistics (item 10).
  private afterOrderUpdate(u: TradeUpdate): void {
    const o = u.order;
    for (const w of [...this.waiters]) if (w.symbols.has(o.symbol)) w.wake();
    const nowMs = this.d.now().getTime();
    // Decision 4 of 2026-11-06 (shadow only): every fill moves the estimate's own book.
    if ((u.event === "fill" || u.event === "partial_fill") && (o.side === "buy" || o.side === "sell")) {
      try {
        this.shadowLedger.onFill({ symbol: o.symbol, side: o.side, fillQty: u.fillQty ?? null, price: u.price ?? null, positionQty: u.positionQty, arrivedMs: nowMs });
      } catch {
        /* shadow logging must never break the live updates */
      }
    }
    if (o.side === "sell" && o.clientOrderId.startsWith("cyrus-x-") && u.event === "fill") {
      const px = o.filledAvgPrice ?? u.price ?? null;
      if (px !== null && px > 0) this.stopGap.onOwnSellFill(o.clientOrderId, o.symbol, px, u.atMs ?? nowMs, nowMs);
    }
    // The trade digest's counts (messaging only): entries filled, never-filled entries cancelled, and exits by take-profit or stop.
    const entryOfOurs = o.side === "buy" && o.clientOrderId.startsWith("cyrus-") && !o.clientOrderId.startsWith("cyrus-x-");
    if (entryOfOurs && u.event === "fill") this.digest.count("filled");
    else if (entryOfOurs && (u.event === "canceled" || u.event === "expired") && !(o.filledQty > 0)) this.digest.count("cancelled");
    // A4 of 2026-11-12 (group 2 review, messaging only): a fresh stop (cyrus-p-, no group id) that fills is a stop; a take-profit leg is
    // counted once, at its first fill or partial fill, because A4 cancels the rest of a partly filled take-profit (its full fill never comes).
    else if (o.side === "sell" && u.event === "fill" && o.clientOrderId.startsWith("cyrus-p-")) this.digest.count("stop");
    else if (o.side === "sell" && o.groupId && (u.event === "fill" || u.event === "partial_fill")) {
      if (o.type === "stop" || o.stopPrice !== null) {
        if (u.event === "fill") this.digest.count("stop");
      } else if (o.type === "limit" && !o.clientOrderId.startsWith("cyrus-m-") && !this.digestTakeProfits.has(o.id)) {
        // (A take-profit the stack moved to sell in a close-out, `flatten` or the loss stop, client id cyrus-m-, is that sale, not a
        // take-profit: like the close-out's own market sales it is not counted here. Group 2, round 1 of 2026-11-18.)
        this.digestTakeProfits.add(o.id);
        if (this.digestTakeProfits.size > 20_000) this.digestTakeProfits.delete(this.digestTakeProfits.values().next().value!);
        this.digest.count("take_profit");
      }
    }
    if (u.raw && nowMs - this.lastRawSampleAt >= 60_000) {
      this.lastRawSampleAt = nowMs;
      try {
        // Only the fields the statistics need (group 1 review note): the event, its time, price, quantity and share count, and the
        // order's symbol, side, type, status and quantities.
        const r = u.raw;
        const ord = (r.order ?? {}) as Record<string, unknown>;
        const pick = (x: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => k in x).map((k) => [k, x[k]]));
        this.rawSample = JSON.stringify({ ...pick(r, ["event", "timestamp", "price", "qty", "position_qty"]), order: pick(ord, ["symbol", "side", "type", "order_class", "status", "qty", "filled_qty", "filled_avg_price", "limit_price", "stop_price"]) }).slice(0, 1500);
      } catch {
        this.rawSample = null;
      }
    }
  }

  private endOrderStream(): void {
    this.orderStream?.stop();
    this.orderStream = null;
  }

  private orderStreamStats(): { status: string; events: number; freed: number; closedRecords: number; cancelledEntries: number; stopGaps: number; reconnects: number; medianFreeMs: number | null } | null {
    if (!this.orderHandler) return null;
    return { status: this.orderStream ? this.orderStream.status() : "stopped", ...this.orderHandler.counts, reconnects: this.orderStream?.reconnects?.() ?? 0, medianFreeMs: this.orderHandler.medianFreeMs() };
  }

  private onTrade(t: Trade): void {
    this.lastTradeAt = new Date(t.time);
    if (t.price > 0) {
      this.lastPrices.set(t.symbol, t.price);
      this.stopGap.onPrint(t.symbol, t.price, this.lastTradeAt.getTime());
    }
    // Backstop for the rule above: never act on a price while commands are not being read (the start-up check has not worked).
    if (!this.migrated) return;
    const signal = this.strategy?.onTrade(t);
    if (!signal) return;
    this.d.log?.("info", "signal", { symbol: signal.symbol, price: signal.price });
    this.gate.enter(signal).catch((err) => this.d.log?.("error", "gate_failed", { error: (err as Error).message.slice(0, 200) }));
  }

  private async closeoutPhase(date: string, lastTry: boolean, closeAt: Date | null = null, path: "close-out" | "retry" = "close-out"): Promise<void> {
    this.endStream();
    this.closingOut = true;
    try {
      const result = await closeOut(this.closeoutDeps(), date, { alert: this.notFlatAlertDate !== date, closeAt: closeAt ?? undefined, path });
      await this.setNotFlat(!result.flat, result.remaining, date);
      // Recorded as done only when flat (or when this was the last try), so otherwise the next tick tries again.
      if (result.flat || lastTry) await setPhase(this.d.store, date, "closeout", this.d.now().toISOString(), { flat: result.flat ? "yes" : "no" });
    } finally {
      this.closingOut = false;
    }
  }

  // The mid-day close-out (Michael, 2026-11-09): the pause first (the gate refuses every entry from then on, and looks again just
  // before sending), then the regular close-out's code with path "midday". Unlike the regular close-out's wrapper it never writes the `closeout` phase or
  // the close-out's attempt date (the regular close-out, the carried-position sale and the summary must not take it for the day's close),
  // never stops the price stream (a `go` without a deploy trades at once), never sets the not-flat flag, and leaves the borrowing cap
  // alone (closeOut skips that for this path). The missing-exit check is off while it runs (protectNow). The first try is the full
  // close-out; a retry is ONE round of it without the wait for its own sells (the next retry looks again), which is how retries stay
  // inside 60 requests a minute. Since the redesign of 2026-11-14 each retry reserves its estimate in the shared request budget first, and its requests are counted as they are sent.
  private async middayPhase(date: string, day: DayRecord, pauseAt: Date, retry = false, only: string[] | null = null, res: Reservation | null = null): Promise<void> {
    const pause = await readPause(this.d.store, date);
    if (pause?.resumedAt) return; // already resumed today
    if (!pause?.on) await updatePause(this.d.store, date, { on: true, since: this.d.now().toISOString(), reason: "mid-day cycle" });
    let result;
    try {
      result = await closeOut(this.closeoutDeps(), date, retry ? { alert: false, path: "midday", maxRounds: 1, waitForOwnSells: false, ...(only ? { onlySymbols: only } : {}) } : { alert: false, path: "midday" });
    } finally {
      // What this try sent (counted as it was sent, in its reservation): the next retry's estimate.
      if (res) this.middayLastCost = res.used;
    }
    if (result.flat) {
      await setPhase(this.d.store, date, MIDDAY_PHASE, this.d.now().toISOString(), { middayFlat: "yes" });
      await this.say("trading", "Mid-day close-out done: the account is flat. Paused for the mid-day cycle.");
      await this.say("commands", await this.middayMorningLine(date, day, pauseAt));
      return;
    }
    this.middayLastRemaining = result.remaining;
    if (this.middayNotFlatSince === null) this.middayNotFlatSince = this.d.now().getTime();
    if (this.middayAlertDate !== date) {
      this.middayAlertDate = date;
      await this.say("alerts", `**Michael: the mid-day close-out is NOT FLAT yet: ${result.remaining.length > 0 ? result.remaining.join(", ") : "the positions could not be listed"}.** New entries stay paused. I keep trying (20 seconds apart, longer while nothing sells, at most a minute) within 60 Alpaca requests a minute. No deploy until the account is flat.`, { mentionOwner: true });
    }
  }

  // The close-out after the afternoon load window (Michael, 2026-11-12): the pause back on first (the gate refuses every entry from
  // then on), then the mid-day close-out code (path "midday": no `closeout` phase, no not-flat flag, the borrowing cap untouched, the
  // price stream kept). A retry is one round without the wait for its own sells, as for the mid-day close-out. When flat it writes its
  // own phase and says so; entries stay paused (no automatic return to normal trading).
  private async afternoonCloseoutPhase(date: string, retry: boolean, only: string[] | null, res: Reservation | null = null, windowStart: string | null = null): Promise<void> {
    const pause = await readPause(this.d.store, date);
    if (!pause?.on) {
      // The pause's start time stays the mid-day one (the summary and `status` name it); only the flag and the reason change.
      await updatePause(this.d.store, date, { on: true, since: pause?.since ?? this.d.now().toISOString(), reason: AFTERNOON_PAUSE_REASON });
      this.d.log?.("info", "afternoon_closeout", { date, step: "paused" });
    }
    let result;
    try {
      result = await closeOut(this.closeoutDeps(), date, retry ? { alert: false, path: "midday", maxRounds: 1, waitForOwnSells: false, ...(only ? { onlySymbols: only } : {}) } : { alert: false, path: "midday" });
    } finally {
      if (res) this.afternoonLastCost = res.used;
    }
    this.d.log?.("info", "afternoon_closeout", { date, step: retry ? "retry" : "first", flat: result.flat, remaining: result.remaining.length });
    if (result.flat) {
      // Group 1, round 1 (Michael's request of 2026-11-17): the flat mark is written only for the window this close-out was closing; if a
      // new window started meanwhile (it cannot while this is pending, but a second guard), it is not marked flat by an older close-out.
      const dayNow0 = await this.d.store.getDay(date).catch(() => null);
      const startNow = afternoonLoadStart(dayNow0)?.toISOString() ?? null;
      if (windowStart !== null && startNow !== windowStart) {
        this.d.log?.("warn", "afternoon_closeout_stale", { date, windowStart, startNow });
        return;
      }
      await setPhase(this.d.store, date, AFTERNOON_FLAT_PHASE, this.d.now().toISOString());
      await this.say("trading", "Afternoon load window over: the close-out after it is done and the account is flat. Entries stay paused.");
      const dayNow = await this.d.store.getDay(date).catch(() => null);
      const lastEntryAt = dayNow ? (middayTimes(dayNow)?.lastEntryAt ?? null) : null;
      // Group 2, round 1: what really comes next, as the mid-day line says it (the stop flag, the daily loss stop, no entries left), else
      // what `go` does.
      const now = this.d.now();
      const blocked = dayNow && lastEntryAt ? (await this.middayBlocked(dayNow, now, lastEntryAt).catch(() => null))?.blocked ?? null : null;
      const next = blocked ?? (lastEntryAt && now < lastEntryAt ? `\`go\` resumes a normal afternoon until ${centralClock(lastEntryAt)} (the last entry).` : "");
      await this.say("commands", `Afternoon load window over: entries paused and the account is flat. Trading does not resume on its own.${next ? ` ${next}` : ""} The regular close-out and the daily summary run as usual.`);
      return;
    }
    this.afternoonLastRemaining = result.remaining;
    if (this.afternoonAlertDate !== this.afternoonAttemptDate) {
      this.afternoonAlertDate = this.afternoonAttemptDate; // once a window (its date and start; Michael's request of 2026-11-17)
      await this.say("alerts", `**Michael: the close-out after the afternoon load window is NOT FLAT yet: ${result.remaining.length > 0 ? result.remaining.join(", ") : "the positions could not be listed"}.** New entries stay paused. I keep trying (20 seconds apart, longer while nothing sells, at most a minute) within 60 Alpaca requests a minute; the regular close-out takes over at its time.`, { mentionOwner: true });
    }
  }

  // What to tell Michael comes next while paused and flat: what really blocks trading (the stop flag, the daily loss stop, no entries
  // left today), or else what `go` does.
  private async middayBlocked(day: DayRecord, now: Date, lastEntryAt: Date): Promise<{ blocked: string | null; stop: StopFlag | null; lossStop: boolean; goLine: string }> {
    const stop = await this.d.store.getControl<StopFlag>(CONTROL_STOP).catch(() => null);
    const lossStop = Boolean(stop?.on && stop.reason.startsWith("daily loss stop"));
    // Wording only: after a daily loss stop, is the loss still past the limit (then `resume` would be stopped again)?
    const equity = lossStop ? ((await this.d.broker.getAccount().catch(() => null))?.equity ?? null) : null;
    return { blocked: blockedNext({ stop, now, lastEntryAt, lossPast: lossPast(day, equity) }), stop, lossStop, goLine: `Send \`go\` to trade until ${centralClock(lastEntryAt)} (the last entry).` };
  }

  // The morning in one line for `commands`, and what happens next.
  private async middayMorningLine(date: string, day: DayRecord, pauseAt: Date): Promise<string> {
    const mt = middayTimes(day)!;
    const now = this.d.now();
    const stored = await this.d.store.listOrders(date).catch(() => []);
    const sent = stored.filter(isSentEntry).length;
    // Michael's mid-day build of 2026-11-16, item 4: the line is written right after the close-out is flat, when a few entries can still be
    // stored as working although Alpaca has filled them (on 2026-11-16 it said 3,481 filled; Alpaca and the records later said 3,483). Those
    // are looked up at Alpaca by client id: at most MORNING_LINE_LOOKUPS, once each, no retry (a failed lookup keeps the stored status and the
    // line says how many it could not confirm). Messaging only; read-only lookups while paused and flat.
    // Group 2, round 1: the lookups run inside the mid-day step, so they stop after MORNING_LINE_LOOKUP_MS in all (each one is also cut
    // off at what is left of that time; the request itself may finish later, unread): the step is never held up longer than that.
    const notFinal = stored.filter((o) => isSentEntry(o) && (o.status === "intent" || o.status === "submitted"));
    let lateFilled = 0;
    let looked = 0;
    let unconfirmed = 0;
    const lookDeadline = Date.now() + MORNING_LINE_LOOKUP_MS;
    for (const o of notFinal.slice(0, MORNING_LINE_LOOKUPS)) {
      const left = lookDeadline - Date.now();
      if (left <= 0) break;
      looked++;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cutOff = new Promise<undefined>((res) => (timer = setTimeout(() => res(undefined), left)));
      const a = await Promise.race([this.d.broker.findOrderByClientId(o.clientOrderId).catch(() => undefined), cutOff]);
      clearTimeout(timer);
      if (a === undefined) unconfirmed++;
      else if (a && a.status === "filled") lateFilled++;
    }
    unconfirmed += notFinal.length - looked;
    const filled = stored.filter((o) => o.status === "filled").length + lateFilled;
    // Michael's item 3 of 2026-11-13 (afternoon): entries Alpaca refused (status "failed": a definite refusal, nothing sent) shown apart.
    const refused = stored.filter((o) => o.status === "failed").length;
    const account = await this.d.broker.getAccount().catch(() => null);
    const start = day.dayStartEquity;
    const plText = account && start ? `P and L ${account.equity - start >= 0 ? "+" : ""}${(account.equity - start).toFixed(2)} dollars (equity ${start.toFixed(2)} to ${account.equity.toFixed(2)})` : "P and L not known (the account could not be read)";
    const hold = await readHold(this.d.store, date).catch(() => false);
    const { blocked } = await this.middayBlocked(day, now, mt.lastEntryAt);
    const until = centralClock(mt.resumeUntil);
    const last = centralClock(mt.lastEntryAt);
    // On a half day the automatic resume ends at the last entry, so "from then I stay paused unless you send `go`" would offer a `go`
    // that cannot trade: dropped then.
    const sameEnd = mt.resumeUntil.getTime() === mt.lastEntryAt.getTime();
    const next =
      blocked ??
      (hold
        ? `\`hold\` is set: after a deploy I stay paused. Send \`go\` to trade until ${last} (the last entry).`
        : `Next: after a deploy before ${until} I resume on my own under today's limits, unless you send \`hold\`. Without a deploy, send \`go\` to resume${sameEnd ? ` (last entry ${last})` : `; from ${until} I stay paused unless you send \`go\` (last entry ${last})`}.`);
    return `Morning (open to ${centralClock(pauseAt)}): ${sent} ${sent === 1 ? "entry" : "entries"} sent (${filled} filled${unconfirmed > 0 ? `, ${unconfirmed} not yet confirmed` : ""})${refused > 0 ? `, ${refused} refused by Alpaca` : ""}; ${plText}; rate-limit answers from Alpaca: ${this.d.governor.stats().rateLimitAnswers}. ${next}`;
  }

  // After the mid-day close-out is flat: the start-up decision (once per start, after this start's first read of commands, so a
  // `hold` sent while the worker was down counts), and the 1:30 PM note.
  private async middayFollowUps(date: string, day: DayRecord, mt: { pauseAt: Date; resumeUntil: Date; lastEntryAt: Date }, now: Date): Promise<void> {
    // Also only after the loss stop's first check since this start (with today's equity history) has worked, so a resume can never
    // come before a loss stop that the restart has not seen yet.
    if (!this.middayStartupDone && this.lastCommandReadOk !== null && this.lossRederivedDate === date) {
      this.middayStartupDone = true;
      const pause = await readPause(this.d.store, date);
      const hold = await readHold(this.d.store, date);
      const { blocked, stop, lossStop, goLine } = await this.middayBlocked(day, now, mt.lastEntryAt);
      const deploy = this.startInfo?.deploy === true;
      const release = this.startInfo?.release ?? "unknown";
      // Only a start after the pause began is a mid-day start (a start before it, such as an evening deploy, is not).
      const startedAfterPause = Boolean(pause?.since) && this.startedAtMs !== null && this.startedAtMs > Date.parse(pause!.since!);
      // Michael, 2026-11-12 (afternoon): once the afternoon load window has started, a start never resumes on its own (the pause after
      // that window has no automatic return to normal trading).
      const action = afternoonLoadStart(day) ? "none" : startupAction({ pause, hold, flat: middayFlat(day), deploy, now, resumeUntil: mt.resumeUntil, stop, startedAfterPause });
      if (action !== "none") this.d.log?.("info", "midday_startup", { action, deploy, release });
      const late = now >= mt.lastEntryAt;
      if (action === "resume") {
        await updatePause(this.d.store, date, { on: false, resumedAt: now.toISOString(), resumedBy: "deploy", deployedAt: now.toISOString() });
        await this.say("commands", `Resumed after release ${release} (deployed while flat): same limits as this morning; the loss stop counts from the open.`);
      } else if (action === "stay-plain-restart") {
        await this.say("alerts", `**Michael: I restarted during the mid-day pause without a new release, so I stay paused.** ${blocked ?? goLine}`, { mentionOwner: !late && !lossStop });
      } else if (action === "stay-hold") {
        await updatePause(this.d.store, date, { deployedAt: now.toISOString() });
        await this.say("commands", `Release ${release} started while flat and paused. \`hold\` is set, so I stay paused. ${blocked ?? goLine}`);
      } else if (action === "stay-stop") {
        await updatePause(this.d.store, date, { deployedAt: now.toISOString() });
        await this.say("commands", `Release ${release} started while flat and paused, so I stay paused. ${blocked ?? goLine}`);
      } else if (action === "stay-late") {
        await updatePause(this.d.store, date, { deployedAt: now.toISOString() });
        await this.say("commands", `Release ${release} started while flat and paused, but it is ${centralClock(mt.resumeUntil)} or later, so I stay paused. ${blocked ?? goLine}`);
      }
    }
    // The 1:30 note: only after this start's decision (so it can never contradict it), and only while there is still time to trade.
    if (this.middayStartupDone && now >= mt.resumeUntil && middayFlat(day) && !day.phases[MIDDAY_NOTE_PHASE]) {
      const pause = await readPause(this.d.store, date);
      if (pause?.on && !pause.deployedAt && now < mt.lastEntryAt && !afternoonLoadStart(day)) {
        const { blocked } = await this.middayBlocked(day, now, mt.lastEntryAt);
        await this.say("commands", `${centralClock(mt.resumeUntil)}: nothing was deployed, so I stay paused. ${blocked ?? `Send \`go\` to trade until ${centralClock(mt.lastEntryAt)} (the last entry), or nothing.`}`);
      }
      await setPhase(this.d.store, date, MIDDAY_NOTE_PHASE, now.toISOString());
    }
  }

  // The summary's mid-day lines: the cycle (paused, flat, resumed and how, or stayed paused) and, if this process started after the
  // open, which figures cover only the time since then.
  private async middaySummaryLines(date: string, day: DayRecord): Promise<string[]> {
    const lines: string[] = [];
    const mt = middayTimes(day);
    const pause = mt ? await readPause(this.d.store, date).catch(() => null) : null;
    if (mt && pause?.since) {
      const flatIso = middayFlat(day) ? day.phases[MIDDAY_PHASE] : undefined;
      const resumed = pause.resumedAt ? `resumed at ${centralClock(new Date(pause.resumedAt))} (${resumedByText(pause.resumedBy)})` : "stayed paused for the rest of the day";
      lines.push(`Mid-day cycle: paused at ${centralClock(new Date(pause.since))}, ${flatIso ? `flat at ${centralClock(new Date(flatIso))}` : "**never flat at mid-day**"}, ${resumed}.`);
    }
    if (this.startedAtMs !== null && day.openAt && this.startedAtMs > day.openAt.getTime()) {
      const t = centralClock(new Date(this.startedAtMs));
      lines.push(`Restarted at ${t}; the request figures, the live-update figures and the entry-expiry counts cover only the time since ${t}.`);
    }
    return lines;
  }

  // Sells positions carried over from an earlier close-out that ended not flat. The market is open, so this sends.
  private async carriedPhase(date: string): Promise<void> {
    this.closingOut = true;
    try {
      // Decision 2 of 2026-11-06: the day began with shares held, so the summary may call an unmatched sale "carried".
      // Not waited on: the sale never waits on the database.
      void setPhase(this.d.store, date, CARRIED_PHASE, this.d.now().toISOString()).catch(() => undefined);
      const result = await closeOut(this.closeoutDeps(), date, { alert: this.notFlatAlertDate !== date, path: "carried" });
      await this.setNotFlat(!result.flat, result.remaining, date);
    } finally {
      this.closingOut = false;
    }
  }

  // Decision 2 of 2026-11-06: waits (at most a minute) while Alpaca's request budget is below SUMMARY_MIN_BUDGET.
  private async summaryPace(): Promise<void> {
    const sleep = this.d.sleep ?? ((t: number) => new Promise<void>((r) => setTimeout(r, t)));
    for (let i = 0; i < 240 && this.d.governor.budget() < SUMMARY_MIN_BUDGET; i++) await sleep(250);
  }

  private async summaryPhase(date: string): Promise<void> {
    // The day's request figures are taken before the summary's own reads, so they describe the session, not the summary.
    const requestsAtClose = this.d.governor.stats();
    await this.flushDigest(true);
    const day = (await this.d.store.getDay(date))!;
    const [account, positions] = await Promise.all([this.d.broker.getAccount(), this.d.broker.listPositions()]);
    // Bring the stored entries up to date from the final fills before summarising (no sells: the day is over).
    await syncOrders(this.riskDeps(), day, { protect: false }).catch(() => undefined);
    const stored = await this.d.store.listOrders(date);
    // Fix of 2026-11-11: the day's orders are read in bounded windows (summary-listing.ts), not in one open-ended listing, which Alpaca
    // answered too slowly (about 28 s) and only in part on a day of about 8,000 orders.
    // The windows end 10 minutes past the close (the regular close-out's last sales, at the set time, 2:55 by default, are inside them); without a close time, a minute from now.
    const listUntil = day.closeAt ? new Date(day.closeAt.getTime() + 10 * 60_000) : new Date(this.d.now().getTime() + 60_000);
    // Only entries Alpaca has (the same rule as the lookups below) count as missing; refused or never-sent rows do not.
    const atAlpaca = stored.filter((s) => s.alpacaOrderId || s.status === "filled" || s.status === "submitted");
    const sliced = await listDaySliced(this.d.broker, summaryWindows(etInstant(date, "00:00"), day.openAt, listUntil), atAlpaca, () => this.summaryPace());
    const listed = { orders: sliced.orders, complete: sliced.complete };
    this.d.log?.("info", "summary_listing", { windows: sliced.windows, requests: sliced.requests, orders: sliced.orders.length, failedWindows: sliced.failedWindows, rereadWindows: sliced.rereadWindows, complete: sliced.complete });
    // Release A, fix 4, and Michael's decision 2 of 2026-11-06: every entry Alpaca's listing left out (71 on 2026-11-06) is fetched by
    // its client id, with no cap (the cap of 50 left 21 filled entries out on 2026-11-06), so the counts and the profit match the account.
    const listedIds = new Set(listed.orders.map((o) => o.clientOrderId));
    const missing = stored.filter((s) => !listedIds.has(s.clientOrderId) && (s.alpacaOrderId || s.status === "filled" || s.status === "submitted"));
    let lookupsFailed = 0;
    for (const s of missing) {
      await this.summaryPace();
      const found = await this.d.broker.findOrderByClientId(s.clientOrderId).catch(() => (lookupsFailed++, null));
      if (found) listed.orders.push(found);
    }
    if (missing.length > 0) this.d.log?.("info", "summary_orders_missing_from_listing", { missing: missing.length, lookupsFailed });
    // Decision 2 of 2026-11-06: sells are not stored, so a sell the listing left out (4 on 2026-11-06) is found from Alpaca's list of
    // the day's fills: every fill names its order, and an order not known yet is fetched by that id.
    let fillsCheck: { complete: boolean; found: number; stillMissing: number } | null = null;
    try {
      const fills = await this.d.broker.listFillsForDay(date, 400, () => this.summaryPace());
      // The moved take-profit (2026-11-18): an order a listed replacement replaced is known too (its fills are inside the replacement's).
      const known = knownOrderIds(listed.orders);
      const unknown = [...new Set(fills.fills.map((f) => f.orderId).filter((id) => id && !known.has(id)))];
      let found = 0;
      for (const id of unknown) {
        if (known.has(id)) continue; // a leg of an order fetched a moment ago
        await this.summaryPace();
        const o = await this.d.broker.getOrderById(id).catch(() => null);
        if (!o) continue;
        listed.orders.push(o);
        for (const x of [o, ...flattenLegs(o)]) known.add(x.id);
        found++;
      }
      fillsCheck = { complete: fills.complete, found, stillMissing: unknown.filter((id) => !known.has(id)).length };
      if (unknown.length > 0) this.d.log?.("info", "summary_fills_check", fillsCheck);
    } catch (err) {
      this.d.log?.("warn", "summary_fills_check_failed", { error: (err as Error).message.slice(0, 120) });
    }
    const result = computeDay(listed.orders);
    const fees = estimateFees(date, result.fills);
    const prev = await this.d.store.getControl<FeesRunning>(CONTROL_FEES).catch(() => null);
    const running = addToRunning(prev, date, fees.total);
    await this.d.store.setControl(CONTROL_FEES, running).catch(() => undefined);
    const text = formatSummary({
      day,
      stored,
      refusals: await this.d.store.listRefusals(date),
      alpacaOrders: listed.orders,
      account,
      peak: await this.d.store.getControl(peakKey(date)),
      stop: await this.d.store.getControl<StopFlag>(CONTROL_STOP),
      flat: positions.length === 0,
      requests: requestsAtClose,
      feesRunning: running.total,
      // Complete if every window was read, or if what a failed window hid was all found by the lookups and the fills check.
      listComplete: lookupsFailed === 0 && (listed.complete || (fillsCheck !== null && fillsCheck.complete && fillsCheck.stillMissing === 0)),
      // A load day reports its morning window; a normal day with `load afternoon` reports the afternoon window.
      loadWindow: isLoadDay(day) ? loadWindow(day) : afternoonLoadWindow(day),
      loadWindowKind: isLoadDay(day) ? "morning" : "afternoon",
      afternoonOnLoadDay: isLoadDay(day) ? afternoonLoadWindow(day) : null,
      ...(isLoadDay(day) || afternoonLoadWindow(day) ? { loadExtras: { orderStream: this.orderStreamStats(), entryExpiry: { ...this.entryExpiry.counts } } } : {}),
      stopGap: this.stopGapDate === date ? this.stopGap.totals() : await this.d.store.getControl<StopGapDay>(stopGapKey(date)).catch(() => null),
      carriedAtStart: Boolean(day.phases[CARRIED_PHASE]),
      fillsCheck,
      middayLines: await this.middaySummaryLines(date, day).catch(() => []),
    });
    await this.say("trading", text);
    await setPhase(this.d.store, date, "summary", this.d.now().toISOString());
    this.d.governor.resetDayStats();
    this.entryExpiry.resetDay();
  }
}
