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
import { CommandProcessor, afternoonFailureTail, type CommandBot } from "./commands.ts";
import { COMMAND_READ_LIMIT } from "./discord-bot.ts";
import { DIGEST_PERIOD_MS, TradeDigest } from "./digest.ts";
import { addToRunning, CONTROL_FEES, estimateFees, type FeesRunning } from "./fees.ts";
import type { Governor } from "./governor.ts";
import { Liquidator, SellGate, flattenLegs } from "./sells.ts";
import { formatLiveList } from "./universe.ts";
import type { Settings } from "./config.ts";
import { closeOut, CLOSEOUT_MINUTES_BEFORE_CLOSE } from "./closeout.ts";
import { OrderGate, peakKey } from "./gate.ts";
import { resetOldShapeFutureDays, armDay, ensureDay, lapseIfUndecided, NextSessionFinder, postLimitsRequest, postMorningReview, postReminderIfNeeded, suggestedFromHistory, type MorningSteps } from "./morning.ts";
import { BARE_GRACE_MS, enforceDailyLoss, LossStopMemory, SyncMemory, sweepEntriesWhileStopped, syncOrders } from "./risk.ts";
import type { SelfMonitor } from "./self-monitor.ts";
import { LOAD_ENTRY_WAIT_MS, LOAD_NOTE_PHASE, afternoonLoadWindow, inLoadWindow, isLoadDay, loadLine, loadWindow } from "./load-mode.ts";
import { BusyPlaceholder } from "./strategy.ts";
import { OrderUpdateHandler, type TradeUpdate } from "./order-stream.ts";
import { EntryExpiry } from "./entry-expiry.ts";
import { StopGapMeter, stopGapKey } from "./stop-gap.ts";
import { ShadowLedger } from "./shadow-ledger.ts";
import { earlyLookAllowed } from "./early-wake.ts";
import type { Trade } from "./stream.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP, setPhase, type DayRecord, type NotFlatState, type StopFlag, type Store } from "./store.ts";
import { computeDay, formatSummary, isSentEntry, type StopGapDay } from "./summary.ts";
import { listDaySliced, summaryWindows } from "./summary-listing.ts";
import { addMinutes, centralClock, dayWord, etDate, etInstant, sessionPhase } from "./time.ts";
import { PAPER_ONLY } from "./discord.ts";
import { MIDDAY_NOT_FLAT_ALERT_AFTER_MS, MIDDAY_NOTE_PHASE, MIDDAY_PHASE, MIDDAY_RETRY_MS, MIDDAY_RETRY_REQUESTS_PER_MINUTE, MiddayBudget, blockedNext, lossPast, middayFlat, middayTimes, readHold, readPause, resumedByText, retryAllowed, retrySymbols, startupAction, updatePause } from "./midday.ts";
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
  makeOrderStream?: (onUpdate: (u: TradeUpdate) => void) => StreamLike & { reconnects?: () => number };
  sleep?: (ms: number) => Promise<void>;
  log?: (level: "info" | "warn" | "error", event: string, data?: Record<string, unknown>) => void;
  // The timer for the order sync brought forward by a stop's cancel (default setTimeout; the tests run it by hand).
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  // The mid-day cycle (Michael, 2026-11-09) is on unless this is false. main.ts never sets it; only tests about something else, whose
  // simulated day crosses 10:30 AM Central, turn it off (the cycle itself is tested in test/midday.test.ts).
  middayCycle?: boolean;
}

// The speed release, item 3: the order sync runs every 10 seconds on every day (it was 30 on a normal day, 10 on a load day). With the
// live order updates connected it is the backstop and reads only the last 10 minutes of orders (risk.ts).
// Decision 2 of 2026-11-06: the day phase set when shares carried from an earlier day were sold (the summary's "carried" note).
export const CARRIED_PHASE = "carried";
// Decision 2 of 2026-11-06: the summary's reads (on a day of 10,000 fills or more, a few hundred: the fills' pages and the lookups) wait
// while Alpaca's request budget is below this, so the summary never runs the bucket low and never causes a rate-limit answer.
export const SUMMARY_MIN_BUDGET = 100;
export const SYNC_EVERY_MS = 10_000;
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
// release, decision 6): on 2026-11-05 they were 101 separate alerts, and at the 3 second grace about 270 a day are expected.
// A sell not filled yet is still posted at once; a position that cannot be sold gets one alert, one after 5 minutes and one line when it
// resolves (release 1 of 2026-11-09, risk.ts `cleanupSale`).
export const REMAINDER_ALERT_EVERY_MS = 60_000;

// The batched alert: one line listing each symbol and the shares sold.
export function remainderAlert(sales: Array<{ symbol: string; shares: number }>): string {
  const n = sales.length;
  return `**Sold ${n} remainder${n === 1 ? "" : "s"} left without a stop** (Alpaca cancelled the stop when the take-profit partly filled): ${sales.map((s) => `${s.symbol} ${s.shares}`).join(", ")}.`;
}
const FLUSH_EVERY_MS = 60_000;
// Before the close the close-out is retried this often until the account is flat; after the close, every 5 minutes.
const CLOSEOUT_RETRY_MS = 20_000;
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
  private lastCarriedAttempt = 0;
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
  private syncRecheckAt: number | null = null;
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
  private eventSyncTimer: unknown = null;
  private eventSyncAt: number | null = null;
  // Logging only (Michael's approval of 2026-11-10), for `late_notice`: when the live updates last reported each symbol's stop cancelled,
  // and what the timed sync did (last set, last fired, how often it was put off because a sync was still running, since the last sync
  // the timer started).
  private readonly stopCancelSeen = new Map<string, { alpacaAtMs: number; receivedMs: number; syncSetFor: number }>();
  private syncTimerLog = { setAt: 0, setFor: 0, firedAt: 0, putOff: 0, lastPutOffAt: 0 };
  private syncAgain = false;
  private sessionForSync: { day: DayRecord; closeAt: Date } | null = null;
  private lastRawSampleAt = 0;
  private rawSample: string | null = null;
  // Decision 4 of 2026-11-06 (shadow only): the estimate's own book of cash and shares, and each loss-stop read's comparison.
  private readonly shadowLedger = new ShadowLedger();
  private shadowReconnects = 0;
  private shadow: Array<{ diff: number; at: number; estimate: number; equity: number; sinceFillMs: number | null; sinceBaseMs: number | null }> = [];
  private shadowNoEstimate = 0;
  // Decision 1 of 2026-11-06: entries whose two exits the live updates reported lost, with the symbol, when, and the syncs tried.
  private readonly lostExitsPending = new Map<string, { symbol: string; at: number; tries: number }>();
  // The mid-day cycle (Michael, 2026-11-09): what started this process (main.ts, from the start note), whether the start-up decision
  // about the pause has been made, the mid-day close-out's last attempt, and the day its not-flat alert went out.
  private startInfo: { deploy: boolean; release: string } | null = null;
  private middayStartupDone = false;
  private lastMiddayAttempt = 0;
  private middayAlertDate: string | null = null;
  // Michael's ruling of 2026-11-09 on a mid-day close-out that ends not flat: the first try is not held back; each retry (one round,
  // every 20 seconds at most) runs only within 60 Alpaca requests a minute and never below the reserve. Each try's real cost is
  // charged afterwards. One alert when a try first ends not flat, and one more if still not flat 5 minutes later.
  private readonly middayBudget = new MiddayBudget();
  private middayAttemptDate: string | null = null;
  private middayAttempts = 0;
  private middayLastCost: number | null = null;
  private middayNotFlatSince: number | null = null;
  private middayLastRemaining: string[] = [];
  private middayFiveMinAlertDate: string | null = null;
  // True from 10:30 until the mid-day close-out has finished flat (set on every pass): the mid-day close-out alone sells then.
  private middayOwnsSelling = false;

  constructor(deps: WorkerDeps) {
    this.d = deps;
    this.sessions = new NextSessionFinder(deps.broker);
    this.view = new BrokerView(deps.broker, () => deps.now().getTime());
    this.sellGate = new SellGate({ broker: deps.broker, say: (c, t, o) => this.say(c, t, o), log: (e, data) => deps.log?.("info", e, data), nowMs: () => deps.now().getTime() });
    this.liquidator = new Liquidator({ broker: deps.broker, gate: this.sellGate, now: deps.now, sleep: deps.sleep, log: (e, data) => deps.log?.("info", e, data), waitEvent: (symbols, ms) => this.waitEvent(symbols, ms) });
    this.entryExpiry = new EntryExpiry({ cancelOrder: (id) => deps.broker.cancelOrder(id), wasFilled: (id) => this.orderHandler?.wasFilled(id) ?? false, log: (e, data) => deps.log?.("info", e, data), ...(deps.setTimer ? { setTimer: deps.setTimer } : {}) });
    this.commands = new CommandProcessor({
      sessions: this.sessions,
      settings: deps.settings,
      store: deps.store,
      broker: deps.broker,
      liquidator: this.liquidator,
      bot: deps.bot,
      now: deps.now,
      extraStatus: async () => this.statusLines(),
      afternoonScreen: (date) => this.startAfternoonScreen(date),
      cancelAfternoonScreen: (date) => this.cancelAfternoonScreen(date),
      loadAfternoonEnabled: deps.loadAfternoon === true,
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
      onLimitEntrySent: (e) => this.entryExpiry.schedule(e, LOAD_ENTRY_WAIT_MS),
    });
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

  // May the order sync sell a position whose exits are gone? Not while any liquidation runs or waits (close-out, flatten, loss
  // stop, carried, emergency), and not from the close-out time on: the close-out alone flattens the account.
  protectNow(closeAt: Date): boolean {
    return !this.closingOut && !this.liquidator.isLiquidating() && !this.inflight.has("closeout") && !this.inflight.has("carried") && !this.inflight.has("midday") && !this.middayOwnsSelling && this.d.now() < addMinutes(closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE);
  }

  private riskDeps() {
    return {
      broker: this.d.broker,
      store: this.d.store,
      now: this.d.now,
      say: (c: Channel, t: string, o?: { mentionOwner?: boolean }) => this.say(c, t, o),
      liquidator: this.liquidator,
      lossMemory: this.lossMemory,
      syncMemory: this.syncMemory,
      governor: this.d.governor,
      log: (e: string, data?: Record<string, unknown>) => this.d.log?.("info", e, data),
      onBareSale: (sale: { symbol: string; shares: number; takeProfit: number | null; atMs: number; clientOrderId?: string }) => this.stopGap.onSale(sale),
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
    const t = this.syncTimerLog;
    return {
      streamReportedCancel: seen ? { alpacaAgoMs: ago(seen.alpacaAtMs), receivedAgoMs: ago(seen.receivedMs), syncSetForAgoMs: ago(seen.syncSetFor) } : null,
      streamStatus: this.orderStream ? this.orderStreamLive() : false,
      timedSync: { setAgoMs: ago(t.setAt), setForAgoMs: ago(t.setFor), firedAgoMs: ago(t.firedAt), putOff: t.putOff, lastPutOffAgoMs: ago(t.lastPutOffAt) },
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
    if (this.eventSyncTimer) (this.d.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>)))(this.eventSyncTimer);
    this.stream?.stop();
    this.orderStream?.stop();
  }

  // Runs a long step in the background once; its finish is recorded in the database by the step itself.
  private background(name: string, fn: () => Promise<void>): void {
    if (this.inflight.has(name)) return;
    this.inflight.add(name);
    fn()
      .catch((err) => {
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
      .finally(() => this.inflight.delete(name));
  }

  async tick(): Promise<boolean> {
    if (this.startedAtMs === null) this.startedAtMs = this.d.now().getTime();
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
    this.retryingStop = true;
    void store
      .retryUnsavedStop!()
      .then((saved) => {
        if (saved) {
          this.d.log?.("info", "unsaved_stop_saved");
          void this.say("alerts", "The stop flag that could not be saved earlier is now saved in the database.").catch(() => undefined);
        }
      })
      .catch((err) => this.d.log?.("warn", "unsaved_stop_retry_failed", { error: (err as Error).message.slice(0, 120) }))
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
    if (!clock.isOpen || minutesToClose > CLOSEOUT_MINUTES_BEFORE_CLOSE) return;
    this.emergencyDate = date;
    await this.say("alerts", `${why}, so I am closing everything from the broker's clock alone.`);
    this.closingOut = true;
    try {
      const result = await closeOut(this.closeoutDeps(), date, { path: "emergency" });
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
    await this.d.store.setControl(CONTROL_NOT_FLAT, state).then(() => void (this.notFlatSaved = true)).catch((err) => this.d.log?.("warn", "not_flat_save_failed", { error: (err as Error).message.slice(0, 120) }));
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
    } else if (!this.notFlatSaved) {
      await this.setNotFlat(true, held, date); // the earlier save failed (database down): save it again
    }
  }

  // In-session check, every 30 seconds while nothing is flagged: any held symbol with no stored order from today
  // (every entry is written down by the gate before it is sent, so a legitimate position always has one) is carried.
  private async scanForCarried(today: DayRecord, now: Date): Promise<void> {
    if (now.getTime() - this.lastCarriedScan < 30_000) return;
    try {
      const held = (await this.view.freshPositions(10_000)).map((p) => p.symbol);
      let carried: string[] = [];
      if (held.length > 0) {
        const known = new Set((await this.d.store.listOrders(today.tradeDate)).map((o) => o.symbol));
        carried = held.filter((sym) => !known.has(sym));
      }
      this.lastCarriedScan = now.getTime(); // only a scan that finished counts; a failed one is retried on the next pass
      if (carried.length === 0) return;
      await this.setNotFlat(true, carried, etDate(now));
      await this.say("alerts", `**Michael: positions are held that this worker did not enter today (${carried.join(", ")}).** Treated as carried over: no entries until the account is flat, and I am selling everything now (nothing here has a protective stop from today).`, { mentionOwner: true });
    } catch (err) {
      this.lastTickError = `carried-position scan: ${(err as Error).message.slice(0, 120)}`;
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
    if (!this.migrated) {
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
      if (this.migrated) current = await this.limitsFlow(now, date, today, steps);
    } catch (err) {
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

    if (at(-45) && now < day.closeAt && alivePending && !current.phases.screen) this.background("screen", () => this.screenPhase(date, isLoadDay(current)));

    // Arming: set long only and the approved cap at Alpaca. Until it works the gate refuses every entry.
    if (at(-5) && now < day.closeAt && current.status === "approved" && !current.phases.armed && now.getTime() - this.lastArmAttempt >= 10_000) {
      this.lastArmAttempt = now.getTime();
      try {
        current = await armDay(steps, current);
      } catch (err) {
        this.lastTickError = `arming: ${(err as Error).message.slice(0, 120)}`;
        if (now.getTime() - this.lastArmAlert >= 5 * 60_000) {
          this.lastArmAlert = now.getTime();
          await this.say("alerts", `Could not arm today (${(err as Error).message.slice(0, 120)}). There will be no entries until it works; I keep trying.`);
        }
      }
    }
    if (at(0)) {
      try {
        current = await lapseIfUndecided(steps, current);
      } catch (err) {
        this.lastTickError = `lapse: ${(err as Error).message.slice(0, 120)}`; // retried on the next pass; an undecided day never trades
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
    // The mid-day cycle: from 10:30 until the mid-day close-out has finished flat, it alone sells (as the 2:55 close-out does from its
    // time on), so the order sync's missing-exit check stands aside and its sales cannot spend Alpaca's requests outside the mid-day
    // close-out's 60 a minute (group 1 review, round 1: 40 positions with refused sales made 80 such sales in 10 minutes).
    const middayToday = this.d.middayCycle === false ? null : middayTimes(current);
    this.middayOwnsSelling = Boolean(inSession && middayToday && current.phases.armed && now >= middayToday.pauseAt && !current.phases[MIDDAY_PHASE] && now < addMinutes(day.closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE));
    // The loss stop is scheduled first, before anything else in the session that waits on the broker.
    if (inSession) this.scheduleLossStop(current, now);
    // Closes the live updates wrote to memory but could not write to the database yet are tried again (item 1). Never waited on.
    void this.d.store.retrySoonWrites?.().catch(() => undefined);
    this.sessionForSync = inSession ? { day: current, closeAt: day.closeAt } : null;
    if (inSession && current.phases.armed) await this.refreshView(now, date);
    // Release A, fix 1: a bare remainder found by the last sync brings the next one forward to its grace time (also by a timer, see
    // syncAt, so it does not wait for the next 5 second pass).
    const recheckDue = this.syncRecheckAt !== null && now.getTime() >= this.syncRecheckAt && !this.inflight.has("risk");
    if (inSession && (now.getTime() - this.lastSync >= SYNC_EVERY_MS || recheckDue)) this.startSync(current, day.closeAt);
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
    if (this.notFlat && now >= day.openAt && now < addMinutes(day.closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE) && !closeoutStarted && !this.closingOut && now.getTime() - this.lastCarriedAttempt >= 5 * 60_000) {
      this.lastCarriedAttempt = now.getTime();
      this.background("carried", () => this.carriedPhase(date));
    }

    // The mid-day cycle (Michael, 2026-11-09): at 10:30 AM Central the pause goes on and the mid-day close-out sells everything, retried
    // every 20 seconds until flat, never from the regular close-out time on (that close-out takes over). Its own phase, never `closeout`.
    const mt = this.d.middayCycle === false ? null : middayTimes(current);
    if (inSession && mt && current.phases.armed && now >= mt.pauseAt && !current.phases[MIDDAY_PHASE] && now < addMinutes(day.closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE) && !this.closingOut && !this.inflight.has("carried") && !this.inflight.has("midday") && now.getTime() - this.lastMiddayAttempt >= MIDDAY_RETRY_MS) {
      if (this.middayAttemptDate !== date) {
        this.middayAttemptDate = date;
        this.middayAttempts = 0;
        this.middayLastCost = null;
        this.middayNotFlatSince = null;
        this.middayLastRemaining = [];
      }
      const retry = this.middayAttempts > 0;
      // A retry's cost is estimated from the last try's charged cost, at most the minute's whole budget.
      const estimate = Math.min(MIDDAY_RETRY_REQUESTS_PER_MINUTE, this.middayLastCost ?? MIDDAY_RETRY_REQUESTS_PER_MINUTE);
      if (!retry || retryAllowed({ room: this.middayBudget.room(now.getTime()), estimate, governorBudget: this.d.governor.budget(), reserve: this.d.governor.reserve() })) {
        this.lastMiddayAttempt = now.getTime();
        // A retry sells at most MIDDAY_RETRY_SYMBOLS positions, in turn (the first retry takes the first ten left, and so on).
        const only = retry ? retrySymbols(this.middayLastRemaining, this.middayAttempts - 1) : null;
        this.middayAttempts++;
        this.background("midday", () => this.middayPhase(date, current, mt.pauseAt, retry, only));
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

    // Close-out runs until the account is flat: a failed attempt is retried every 5 minutes for 30 minutes
    // past the close (after the close it only reports, it sends nothing), and the heartbeat says "fail" for as
    // long as positions remain.
    const retryMs = now < day.closeAt ? CLOSEOUT_RETRY_MS : 5 * 60_000;
    if (now >= addMinutes(day.closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE) && !current.phases.closeout && !this.closingOut && now.getTime() - this.lastCloseoutAttempt >= retryMs) {
      this.lastCloseoutAttempt = now.getTime();
      if (this.closeoutAttemptDate !== date) {
        this.closeoutAttemptDate = date;
        this.closeoutAttempts = 0;
      }
      const path = this.closeoutAttempts === 0 ? "close-out" : "retry";
      this.closeoutAttempts++;
      this.background("closeout", () => this.closeoutPhase(date, now >= addMinutes(day.closeAt!, 30), day.closeAt, path));
    }
    if (now >= addMinutes(day.closeAt, 5) && current.phases.closeout && !current.phases.summary) {
      this.background("summary", () => this.summaryPhase(date));
    }
  }

  // The order sync, in the background: a sale that takes a while (a liquidation waits for cancels) must never hold up reading
  // Michael's next command. While a close-out is running, and from the close-out time on, the missing-exit check is switched off
  // and nothing is sold here: the close-out alone flattens the account. It is asked again just before each sale, so a close-out
  // that starts meanwhile switches it off. One at a time: a sync already running is never doubled.
  private startSync(dayNow: DayRecord, closeAt: Date): void {
    if (this.inflight.has("risk")) return;
    this.lastSync = this.d.now().getTime();
    const risk = this.riskDeps();
    const protect = () => this.protectNow(closeAt);
    const streamLive = this.orderStreamLive();
    this.background("risk", async () => {
      // While the daily loss stop is in force its own retry re-sells whatever is still held, inside its request budget; the
      // missing-exit check would otherwise start a liquidation of its own for every such position every 30 seconds (round 8).
      const lossStopped = await this.lossStopInForce(dayNow.tradeDate);
      this.syncRecheckAt = null;
      const synced = await syncOrders(risk, dayNow, { protect: () => !lossStopped && protect(), streamLive, middayOwnsSelling: () => this.middayOwnsSelling });
      if (synced.recheckAt !== undefined) {
        this.syncRecheckAt = synced.recheckAt;
        this.syncAt(synced.recheckAt);
      }
      await this.lostExitsFollowUp(dayNow.tradeDate, synced.unprotected);
      await sweepEntriesWhileStopped(risk);
    });
  }

  // Decision 1 of 2026-11-06: after a sync, an entry reported with both exits lost that the sync neither sold nor found closed (Alpaca's
  // order list may not show the cancel yet) gets another sync shortly: at most 3 more, 0.5, 1 and 2 seconds later. After that the
  // 10 second sync is the backstop, as before.
  private async lostExitsFollowUp(date: string, sold: string[]): Promise<void> {
    if (this.lostExitsPending.size === 0) return;
    const rows = await this.d.store.listOrders(date).catch(() => null);
    const now = this.d.now().getTime();
    let again: number | null = null;
    for (const [id, p] of [...this.lostExitsPending]) {
      const row = rows?.find((r) => r.clientOrderId === id);
      if (sold.includes(p.symbol) || !row || row.closedAt || p.tries >= 3 || now - p.at > 10_000) {
        this.lostExitsPending.delete(id);
        continue;
      }
      const wait = [500, 1_000, 2_000][p.tries]!;
      p.tries++;
      again = again === null ? now + wait : Math.min(again, now + wait);
    }
    if (again !== null) this.syncAt(again, 0);
  }

  // The speed release (decision 3): runs the order sync at a given moment (plus a quarter second for the clocks), by a timer, so a
  // remainder left without a stop is sold about 3 seconds after Alpaca cancelled the stop rather than at the next 5 second pass. If
  // a sync is running at that moment, it tries again a quarter second later. Only in the session.
  // `slackMs` is added for the clocks (a grace counted from Alpaca's timestamp); 0 for "now" (decision 1 of 2026-11-06).
  private syncAt(atMs: number, slackMs = 250): void {
    if (this.eventSyncAt !== null && this.eventSyncAt <= atMs) return;
    if (this.eventSyncTimer) (this.d.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>)))(this.eventSyncTimer);
    this.eventSyncAt = atMs;
    this.syncTimerLog.setAt = this.d.now().getTime();
    this.syncTimerLog.setFor = atMs;
    const delay = Math.max(slackMs > 0 ? 100 : 0, atMs + slackMs - this.d.now().getTime());
    this.eventSyncTimer = (this.d.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms)))(() => this.syncFromTimer(), delay);
  }

  private syncFromTimer(): void {
    this.eventSyncTimer = null;
    this.eventSyncAt = null;
    const s = this.sessionForSync;
    if (!s || this.d.now() >= s.closeAt) return;
    this.syncTimerLog.firedAt = this.d.now().getTime();
    if (this.inflight.has("risk")) {
      this.syncTimerLog.putOff++;
      this.syncTimerLog.lastPutOffAt = this.d.now().getTime();
      this.syncAt(this.d.now().getTime());
      return;
    }
    this.syncTimerLog.putOff = 0;
    this.startSync(s.day, s.closeAt);
  }

  // Decision 3's measurement: loads the day's saved totals once, settles the sales whose 5 seconds are over, and saves the totals.
  private async stopGapStep(date: string, now: Date): Promise<void> {
    if (this.stopGapDate !== date) {
      let saved: StopGapDay | null;
      try {
        saved = await this.d.store.getControl<StopGapDay>(stopGapKey(date));
      } catch {
        return; // tried again on the next pass
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
    const { symbols: list, names } = await this.d.buildLiveList(load ? { load: true } : undefined);
    await this.d.store.updateDay(date, { liveList: list });
    await this.d.store.setControl(`live_names:${date}`, names).catch(() => undefined);
    await setPhase(this.d.store, date, "screen", this.d.now().toISOString());
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
        const rows = await this.d.store.listOrders(date).catch(() => null);
        if (rows) this.d.governor.setOpenSymbols(new Set([...positions.map((p) => p.symbol), ...rows.filter((o) => !o.closedAt && (o.status === "intent" || o.status === "submitted" || o.status === "filled")).map((o) => o.symbol)]).size);
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
    return new BusyPlaceholder(symbols, { loadActive: (t) => inLoadWindow(this.lastDay?.tradeDate === day.tradeDate ? this.lastDay : day, t) });
  }

  // `load afternoon` on a normal morning (Michael's standing requirement of 2026-11-11): the command has checked every condition and
  // starts this. The screen runs in the background (it can take minutes); the window itself is decided later (see pass). False if one
  // is already running for today.
  private afternoonScreenState: { date: string; state: "running" | "ready" | "cancelled"; readyAt: number; result?: { switched: boolean; list: string[] } } | null = null;
  private lastPollStartedAt = -Infinity;
  private startAfternoonScreen(date: string): boolean | "finishing" {
    // Fix of 2026-11-12 (round 3, group 2): a cancelled screen still running is told apart from one that is live, so the reply can ask
    // Michael to send the command again instead of saying "already running" with nothing to follow.
    if (this.inflight.has("afternoon-screen")) return this.afternoonScreenState === null || this.afternoonScreenState.state === "cancelled" ? "finishing" : false;
    if (this.afternoonScreenState?.date === date && this.afternoonScreenState.state !== "cancelled") return false;
    const mine = { date, state: "running" as "running" | "ready" | "cancelled", readyAt: 0 } as NonNullable<Worker["afternoonScreenState"]>;
    this.afternoonScreenState = mine;
    this.background("afternoon-screen", async () => {
      try {
        const result = await this.afternoonLoadList(date, () => mine.state === "cancelled");
        if (result === null || mine.state === "cancelled") return; // cancelled by a command: it said so
        mine.state = "ready";
        mine.readyAt = this.d.now().getTime();
        mine.result = result;
      } catch (err) {
        if (this.afternoonScreenState === mine) this.afternoonScreenState = null;
        if (mine.state === "cancelled") return;
        const why = (err as Error).message.slice(0, 120).replace(/\.$/, "");
        this.d.log?.("info", "load_afternoon_failed", { error: why });
        const stopNow = await this.d.store.getControl<StopFlag>(CONTROL_STOP).catch(() => null);
        const pauseNow = await readPause(this.d.store, date).catch(() => null);
        await this.say("commands", `Afternoon load window not started: ${why}. ${afternoonFailureTail(stopNow, pauseNow)}`);
      }
    });
    return true;
  }

  // A `stop`, `flatten` or `go` while the screen is running or done but not decided: the pending window is cancelled for good (the
  // finished screen then changes nothing). True if one was pending.
  private cancelAfternoonScreen(date: string): boolean {
    const st = this.afternoonScreenState;
    if (!st || st.date !== date || st.state === "cancelled") return false;
    st.state = "cancelled";
    this.d.log?.("info", "load_afternoon_cancelled", { date });
    return true;
  }

  // The screen and the feed switch for `load afternoon`. On a load day the cheap list is already live. Otherwise the cheap-symbol
  // screen runs and the price feed switches to its 30 names on the same connection. Throws if the screen fails or finds nothing.
  // Returns null (and changes nothing) if the window was cancelled while the screen ran, or if the mid-day pause is no longer on or a
  // stop is set when the screen finishes: the list and the feed switch only at the pause, while nothing trades.
  private async afternoonLoadList(date: string, cancelled: () => boolean = () => false): Promise<{ switched: boolean; list: string[] } | null> {
    const day = await this.d.store.getDay(date);
    if (!day) throw new Error("no day record for today");
    if (isLoadDay(day)) return { switched: false, list: day.liveList ?? [] };
    const { symbols: list, names } = await this.d.buildLiveList({ load: true });
    if (cancelled()) return null;
    if (list.length === 0) throw new Error("the cheap-symbol screen found no names");
    const pauseNow = await readPause(this.d.store, date);
    const stopNow = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
    if (cancelled()) return null;
    if (!pauseNow?.on || stopNow?.on) {
      this.d.log?.("info", "load_afternoon_not_switched", { pause: Boolean(pauseNow?.on), stop: Boolean(stopNow?.on) });
      throw new Error(stopNow?.on ? "the stop flag is on, so the live list was not changed" : "trading is no longer paused for the mid-day cycle, so the live list was not changed");
    }
    // Fix of 2026-11-12 (group 1, round 3, probes G and H): a `go` or `stop` handled while these writes are in flight must still win. The
    // old list and names are kept; after the writes the cancel, the pause and the stop are read again, and if any changed the old list
    // is written back and nothing else changes (no strategy or feed switch, no post). From the last check to the switch in memory
    // there is no wait, so nothing can slip in between.
    const oldList = day.liveList ?? [];
    const oldNames = await this.d.store.getControl<Record<string, string>>(`live_names:${date}`).catch(() => null);
    const updated = await this.d.store.updateDay(date, { liveList: list });
    await this.d.store.setControl(`live_names:${date}`, names).catch(() => undefined);
    const pauseAfter = await readPause(this.d.store, date);
    const stopAfter = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
    if (cancelled() || !pauseAfter?.on || stopAfter?.on) {
      const restored = await this.d.store.updateDay(date, { liveList: oldList });
      if (oldNames !== null) await this.d.store.setControl(`live_names:${date}`, oldNames).catch(() => undefined);
      this.lastDay = restored;
      this.d.log?.("info", "load_afternoon_list_restored", { cancelled: cancelled(), pause: Boolean(pauseAfter?.on), stop: Boolean(stopAfter?.on) });
      if (cancelled()) return null;
      throw new Error(stopAfter?.on ? "the stop flag is on, so the live list was not changed" : "trading is no longer paused for the mid-day cycle, so the live list was not changed");
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
    this.d.log?.("info", "afternoon_load_list", { symbols: list.length });
    await this.say("trading", `Live list switched for the afternoon load window (${list.length} cheap, heavily traded names; the window starts once I have checked again that the account is flat and paused):\n${formatLiveList(list, names)}\n${PAPER_ONLY}`);
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
        this.stopCancelSeen.set(info.symbol, { alpacaAtMs: info.atMs, receivedMs: this.d.now().getTime(), syncSetFor: info.atMs + BARE_GRACE_MS });
        this.syncAt(info.atMs + BARE_GRACE_MS);
      },
      // Decision 1 of 2026-11-06: both exits of a filled entry ended with nothing filled. The order sync runs at once (not at the
      // next 10 second sync); its missing-exit check sells the shares, with its guards (no sale while a close-out or any other sale
      // runs, only the newest entry of the symbol, none if a sell is already working on it). Not while a sale or the close-out
      // runs: the exits were most likely cancelled by that sale itself, and the check is off then anyway.
      onExitsLost: (info) => {
        this.syncMemory.mustLook.add(info.clientOrderId);
        if (this.closingOut || this.liquidator.isLiquidating()) return;
        this.d.log?.("info", "exits_lost", { symbol: info.symbol });
        this.lostExitsPending.set(info.clientOrderId, { symbol: info.symbol, at: this.d.now().getTime(), tries: 0 });
        this.syncAt(this.d.now().getTime(), 0);
      },
      entryForGroup: (groupId) => [...this.syncMemory.lastSeen.values()].find((o) => o.groupId === groupId) ?? null,
      now: () => this.d.now().getTime(),
      log: (e, data) => this.d.log?.("info", e, data),
    });
    const handler = this.orderHandler;
    this.orderStream = this.d.makeOrderStream!((u) => {
      handler.handle(u).catch((err) => this.d.log?.("error", "order_stream_update_failed", { error: (err as Error).message.slice(0, 200) }));
      this.afterOrderUpdate(u);
    });
    this.orderStream.start();
    this.d.log?.("info", "order_stream_started", {});
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
    else if (o.side === "sell" && u.event === "fill" && o.groupId) {
      if (o.type === "stop" || o.stopPrice !== null) this.digest.count("stop");
      else if (o.type === "limit") this.digest.count("take_profit");
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
  // before sending), then the 2:55 close-out code with path "midday". Unlike the 2:55 wrapper it never writes the `closeout` phase or
  // the close-out's attempt date (the 2:55 close-out, the carried-position sale and the summary must not take it for the day's close),
  // never stops the price stream (a `go` without a deploy trades at once), never sets the not-flat flag, and leaves the borrowing cap
  // alone (closeOut skips that for this path). The missing-exit check is off while it runs (protectNow). The first try is the full
  // close-out; a retry is ONE round of it without the wait for its own sells (the next retry looks again), which is how retries stay
  // inside 60 requests a minute. What Alpaca counted for each try is charged to the retries' budget afterwards.
  private async middayPhase(date: string, day: DayRecord, pauseAt: Date, retry = false, only: string[] | null = null): Promise<void> {
    const pause = await readPause(this.d.store, date);
    if (pause?.resumedAt) return; // already resumed today
    if (!pause?.on) await updatePause(this.d.store, date, { on: true, since: this.d.now().toISOString(), reason: "mid-day cycle" });
    const before = this.d.governor.stats().requestsLastMinute;
    let result;
    try {
      result = await closeOut(this.closeoutDeps(), date, retry ? { alert: false, path: "midday", maxRounds: 1, waitForOwnSells: false, ...(only ? { onlySymbols: only } : {}) } : { alert: false, path: "midday" });
    } finally {
      const cost = Math.max(0, this.d.governor.stats().requestsLastMinute - before);
      this.middayBudget.spend(this.d.now().getTime(), cost);
      this.middayLastCost = cost;
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
      await this.say("alerts", `**Michael: the mid-day close-out is NOT FLAT yet: ${result.remaining.length > 0 ? result.remaining.join(", ") : "the positions could not be listed"}.** New entries stay paused. I keep trying every 20 seconds within 60 Alpaca requests a minute. No deploy until the account is flat.`, { mentionOwner: true });
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
    const filled = stored.filter((o) => o.status === "filled").length;
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
    return `Morning (open to ${centralClock(pauseAt)}): ${sent} ${sent === 1 ? "entry" : "entries"} sent (${filled} filled); ${plText}; rate-limit answers from Alpaca: ${this.d.governor.stats().rateLimitAnswers}. ${next}`;
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
      const action = startupAction({ pause, hold, flat: middayFlat(day), deploy, now, resumeUntil: mt.resumeUntil, stop, startedAfterPause });
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
      if (pause?.on && !pause.deployedAt && now < mt.lastEntryAt) {
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
    // The windows end 10 minutes past the close (the 2:55 close-out's last sales are inside them); without a close time, a minute from now.
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
      const known = new Set(listed.orders.flatMap((o) => [o.id, ...flattenLegs(o).map((l) => l.id)]));
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
