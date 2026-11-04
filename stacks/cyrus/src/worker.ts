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
import { CommandProcessor, type CommandBot } from "./commands.ts";
import { TradeDigest } from "./digest.ts";
import { addToRunning, CONTROL_FEES, estimateFees, type FeesRunning } from "./fees.ts";
import type { Governor } from "./governor.ts";
import { Liquidator, SellGate } from "./sells.ts";
import { formatLiveList } from "./universe.ts";
import type { Settings } from "./config.ts";
import { closeOut, CLOSEOUT_MINUTES_BEFORE_CLOSE } from "./closeout.ts";
import { OrderGate, peakKey } from "./gate.ts";
import { resetOldShapeFutureDays, armDay, ensureDay, lapseIfUndecided, NextSessionFinder, postLimitsRequest, postMorningReview, postReminderIfNeeded, suggestedFromHistory, type MorningSteps } from "./morning.ts";
import { enforceDailyLoss, LossStopMemory, SyncMemory, sweepEntriesWhileStopped, syncOrders } from "./risk.ts";
import { LOAD_NOTE_PHASE, LOAD_STATS_EVERY_MS, LOAD_SYNC_EVERY_MS, inLoadWindow, isLoadDay, loadLine, loadWindow } from "./load-mode.ts";
import { BusyPlaceholder } from "./strategy.ts";
import type { Trade } from "./stream.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP, setPhase, type DayRecord, type NotFlatState, type StopFlag, type Store } from "./store.ts";
import { computeDay, formatSummary } from "./summary.ts";
import { addMinutes, centralClock, dayWord, etDate, etInstant, sessionPhase } from "./time.ts";
import { NOT_ADVICE } from "./discord.ts";
import type { PingKind } from "./heartbeat.ts";

export type Channel = "commands" | "trading" | "alerts";

export interface StreamLike {
  start(): void;
  stop(): void;
  status(): string;
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
  sleep?: (ms: number) => Promise<void>;
  log?: (level: "info" | "warn" | "error", event: string, data?: Record<string, unknown>) => void;
}

const SYNC_EVERY_MS = 30_000;
const VIEW_EVERY_MS = 5_000;
const DIGEST_EVERY_MS = 20_000;
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
  private lastView = 0;
  private lastViewSlow = 0;
  private lastDigest = 0;
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

  constructor(deps: WorkerDeps) {
    this.d = deps;
    this.sessions = new NextSessionFinder(deps.broker);
    this.view = new BrokerView(deps.broker, () => deps.now().getTime());
    this.sellGate = new SellGate({ broker: deps.broker, say: (c, t, o) => this.say(c, t, o), log: (e, data) => deps.log?.("info", e, data), nowMs: () => deps.now().getTime() });
    this.liquidator = new Liquidator({ broker: deps.broker, gate: this.sellGate, now: deps.now, sleep: deps.sleep, log: (e, data) => deps.log?.("info", e, data) });
    this.commands = new CommandProcessor({
      sessions: this.sessions,
      settings: deps.settings,
      store: deps.store,
      broker: deps.broker,
      liquidator: this.liquidator,
      bot: deps.bot,
      now: deps.now,
      extraStatus: async () => this.statusLines(),
      log: (e, data) => deps.log?.("info", e, data),
    });
    this.gate = new OrderGate({
      broker: deps.broker,
      store: deps.store,
      view: this.view,
      governor: deps.governor,
      now: deps.now,
      say: (c, t) => this.say(c, t),
      note: (line) => this.digest.add(line),
      log: (e, data) => deps.log?.("info", e, data),
      entryBlock: () => this.entryBlockReason(),
    });
  }

  private say(channel: Channel, text: string, opts?: { mentionOwner?: boolean }): Promise<boolean> {
    return this.d.bot.post(channel, text, opts);
  }

  // Posts the trade digest (one message per batch) and the gate's counted refusals. Never called from the order path.
  private async flushDigest(force = false): Promise<void> {
    const t = this.d.now().getTime();
    if (force || t - this.lastDigest >= DIGEST_EVERY_MS) {
      this.lastDigest = t;
      for (const m of this.digest.take()) await this.say("trading", m);
    }
    if (force || t - this.lastFlush >= FLUSH_EVERY_MS) {
      this.lastFlush = t;
      await this.gate.flush();
    }
  }

  // May the order sync sell a position whose exits are gone? Not while any liquidation runs or waits (close-out, flatten, loss
  // stop, carried, emergency), and not from the close-out time on: the close-out alone flattens the account.
  protectNow(closeAt: Date): boolean {
    return !this.closingOut && !this.liquidator.isLiquidating() && !this.inflight.has("closeout") && !this.inflight.has("carried") && this.d.now() < addMinutes(closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE);
  }

  private riskDeps() {
    return { broker: this.d.broker, store: this.d.store, now: this.d.now, say: (c: Channel, t: string, o?: { mentionOwner?: boolean }) => this.say(c, t, o), liquidator: this.liquidator, lossMemory: this.lossMemory, syncMemory: this.syncMemory, governor: this.d.governor, log: (e: string, data?: Record<string, unknown>) => this.d.log?.("info", e, data) };
  }

  private closeoutDeps() {
    return { broker: this.d.broker, liquidator: this.liquidator, store: this.d.store, now: this.d.now, say: (c: Channel, t: string, o?: { mentionOwner?: boolean }) => this.say(c, t, o), sleep: this.d.sleep, log: (e: string, data?: Record<string, unknown>) => this.d.log?.("info", e, data) };
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
    this.stream?.stop();
  }

  // Runs a long step in the background once; its finish is recorded in the database by the step itself.
  private background(name: string, fn: () => Promise<void>): void {
    if (this.inflight.has(name)) return;
    this.inflight.add(name);
    fn()
      .catch((err) => {
        this.lastTickError = `${name}: ${(err as Error).message.slice(0, 150)}`;
        this.d.log?.("error", "background_failed", { name, error: (err as Error).message.slice(0, 200) });
        // At most one alert per step every 5 minutes (a database outage would otherwise post one every 30 seconds).
        const t = this.d.now().getTime();
        if (t - (this.lastBackgroundAlert.get(name) ?? -Infinity) >= 5 * 60_000) {
          this.lastBackgroundAlert.set(name, t);
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
      try {
        await this.commands.poll();
        this.commandsReadOk();
      } catch (err) {
        // Logged (and kept in the run log) every time; Michael is told once, when it has lasted 2 minutes (commandsWatch).
        this.lastTickError = `commands: ${(err as Error).message.slice(0, 120)}`;
        this.d.log?.("error", "command_poll_failed", { error: (err as Error).message.slice(0, 200) });
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

    const inSession = now >= day.openAt && now < day.closeAt && current.status === "approved";
    // The loss stop is scheduled first, before anything else in the session that waits on the broker.
    if (inSession) this.scheduleLossStop(current, now);
    if (inSession && current.phases.armed) await this.refreshView(now);
    // A load day syncs every 10 seconds (closed entries free their symbol sooner; a bare position is found sooner), all day.
    const syncEvery = isLoadDay(current) ? LOAD_SYNC_EVERY_MS : SYNC_EVERY_MS;
    // Release A, fix 1: a bare remainder found by the last sync brings the next one forward to its grace time.
    const recheckDue = this.syncRecheckAt !== null && now.getTime() >= this.syncRecheckAt && !this.inflight.has("risk");
    if (inSession && (now.getTime() - this.lastSync >= syncEvery || recheckDue)) {
      this.lastSync = now.getTime();
      const risk = this.riskDeps();
      const dayNow = current;
      const closeAt = day.closeAt;
      // Runs in the background: a sale that takes a while (a liquidation waits for cancels) must never hold up reading
      // Michael's next command. While a close-out is running, and from the close-out time on, the missing-exit check is
      // switched off and nothing is sold here: the close-out alone flattens the account. It is asked again just before
      // each sale, so a close-out that starts meanwhile switches it off.
      const protect = () => this.protectNow(closeAt);
      this.background("risk", async () => {
        // While the daily loss stop is in force its own retry re-sells whatever is still held, inside its request budget; the
        // missing-exit check would otherwise start a liquidation of its own for every such position every 30 seconds (round 8).
        const lossStopped = await this.lossStopInForce(dayNow.tradeDate);
        this.syncRecheckAt = null;
        const synced = await syncOrders(risk, dayNow, { protect: () => !lossStopped && protect() });
        if (synced.recheckAt !== undefined) this.syncRecheckAt = synced.recheckAt;
        await sweepEntriesWhileStopped(risk);
      });
    }
    if (inSession || (day.closeAt && now < addMinutes(day.closeAt, 10))) {
      await this.flushDigest();
      // Around a load window (from a minute before to a minute after) the request statistics are written every minute.
      const lw = isLoadDay(current) ? loadWindow(current) : null;
      const nearWindow = lw !== null && now.getTime() >= lw.start.getTime() - 60_000 && now.getTime() < lw.end.getTime() + 60_000;
      if (now.getTime() - this.lastStatsEvent >= (nearWindow ? LOAD_STATS_EVERY_MS : 5 * 60_000) && inSession) {
        this.lastStatsEvent = now.getTime();
        await this.d.store.addEvent("info", "governor_stats", { ...this.d.governor.stats(), tradesLastMinute: this.d.governor.tradesInLastMinute() }).catch(() => undefined);
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

  // Once per day record: if its request was posted before load mode existed (by an older release), show the day's mode now.
  private async loadNoteIfNeeded(steps: MorningSteps, day: DayRecord, now: Date): Promise<DayRecord> {
    if (!day.isTradingDay || !day.phases.request || day.phases.request === "skipped" || day.phases[LOAD_NOTE_PHASE] || day.status === "lapsed" || !day.openAt || now >= day.openAt) return day;
    if (!(await steps.say("commands", `**Mode for ${dayWord(day.tradeDate)}** (new: load mode, added after that day's request was posted):\n${loadLine(day)}\n${NOT_ADVICE}`))) return day;
    return setPhase(this.d.store, day.tradeDate, LOAD_NOTE_PHASE, now.toISOString());
  }

  private async screenPhase(date: string, load = false): Promise<void> {
    const { symbols: list, names } = await this.d.buildLiveList(load ? { load: true } : undefined);
    await this.d.store.updateDay(date, { liveList: list });
    await this.d.store.setControl(`live_names:${date}`, names).catch(() => undefined);
    await setPhase(this.d.store, date, "screen", this.d.now().toISOString());
    await this.say("trading", `Today's live list (${list.length})${load ? ", a load day: cheap, heavily traded names" : ""}:\n${list.length ? formatLiveList(list, names) : "(empty, nothing passed the screen)"}\n${NOT_ADVICE}`);
  }

  // Keeps the cached broker view fresh while the session runs: account and positions every few seconds (2 requests),
  // settings and clock every 30 seconds. Skipped while Alpaca's request budget is down to the safety reserve.
  private async refreshView(now: Date): Promise<void> {
    const t = now.getTime();
    try {
      if (t - this.lastView >= VIEW_EVERY_MS && this.d.governor.canSpend()) {
        this.lastView = t;
        await this.view.refreshFast();
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
    this.strategy = isLoadDay(day) ? new BusyPlaceholder(symbols, { loadActive: (t) => inLoadWindow(this.lastDay?.tradeDate === day.tradeDate ? this.lastDay : day, t) }) : new BusyPlaceholder(symbols);
    this.stream = this.d.makeStream(symbols, (t) => this.onTrade(t));
    this.stream.start();
    this.d.log?.("info", "stream_started", { symbols: symbols.length });
  }

  private endStream(): void {
    this.stream?.stop();
    this.stream = null;
    this.strategy = null;
  }

  private onTrade(t: Trade): void {
    this.lastTradeAt = new Date(t.time);
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

  // Sells positions carried over from an earlier close-out that ended not flat. The market is open, so this sends.
  private async carriedPhase(date: string): Promise<void> {
    this.closingOut = true;
    try {
      const result = await closeOut(this.closeoutDeps(), date, { alert: this.notFlatAlertDate !== date, path: "carried" });
      await this.setNotFlat(!result.flat, result.remaining, date);
    } finally {
      this.closingOut = false;
    }
  }

  private async summaryPhase(date: string): Promise<void> {
    await this.flushDigest(true);
    const day = (await this.d.store.getDay(date))!;
    const [account, listed, positions] = await Promise.all([this.d.broker.getAccount(), this.d.broker.listOrdersPaged("all", etInstant(date, "00:00").toISOString(), 60), this.d.broker.listPositions()]);
    // Bring the stored entries up to date from the final fills before summarising (no sells: the day is over).
    await syncOrders(this.riskDeps(), day, { protect: false }).catch(() => undefined);
    // Release A, fix 4: an entry Alpaca's listing left out (2 on 2026-11-04) is fetched by its client id, so the counts and the
    // profit match the account.
    const stored = await this.d.store.listOrders(date);
    const listedIds = new Set(listed.orders.map((o) => o.clientOrderId));
    const missing = stored.filter((s) => !listedIds.has(s.clientOrderId) && (s.alpacaOrderId || s.status === "filled" || s.status === "submitted")).slice(0, 50);
    for (const s of missing) {
      const found = await this.d.broker.findOrderByClientId(s.clientOrderId).catch(() => null);
      if (found) listed.orders.push(found);
    }
    if (missing.length > 0) this.d.log?.("info", "summary_orders_missing_from_listing", { missing: missing.length });
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
      requests: this.d.governor.stats(),
      feesRunning: running.total,
      listComplete: listed.complete,
      loadWindow: isLoadDay(day) ? loadWindow(day) : null,
    });
    await this.say("trading", text);
    await setPhase(this.d.store, date, "summary", this.d.now().toISOString());
    this.d.governor.resetDayStats();
  }
}
