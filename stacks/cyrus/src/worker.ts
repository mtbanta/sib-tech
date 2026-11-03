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
import { enforceDailyLoss, sweepEntriesWhileStopped, syncOrders } from "./risk.ts";
import { BusyPlaceholder } from "./strategy.ts";
import type { Trade } from "./stream.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP, setPhase, type DayRecord, type NotFlatState, type StopFlag, type Store } from "./store.ts";
import { computeDay, formatSummary } from "./summary.ts";
import { addMinutes, centralClock, etDate, etInstant, sessionPhase } from "./time.ts";
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
  buildLiveList: () => Promise<LiveListResult>;
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

  constructor(deps: WorkerDeps) {
    this.d = deps;
    this.sessions = new NextSessionFinder(deps.broker);
    this.view = new BrokerView(deps.broker, () => deps.now().getTime());
    this.sellGate = new SellGate({ broker: deps.broker, say: (c, t, o) => this.say(c, t, o), log: (e, data) => deps.log?.("info", e, data) });
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

  private riskDeps() {
    return { broker: this.d.broker, store: this.d.store, now: this.d.now, say: (c: Channel, t: string, o?: { mentionOwner?: boolean }) => this.say(c, t, o), liquidator: this.liquidator, log: (e: string, data?: Record<string, unknown>) => this.d.log?.("info", e, data) };
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
        void this.say("alerts", `Step "${name}" failed: ${(err as Error).message.slice(0, 150)}`);
      })
      .finally(() => this.inflight.delete(name));
  }

  async tick(): Promise<boolean> {
    if (this.ticking) return true; // a slow pass is still running: do not start a second one
    this.ticking = true;
    let ok = true;
    try {
      await this.pass();
      this.lastTickError = null;
      this.failedTicks = 0;
    } catch (err) {
      ok = false;
      this.failedTicks++;
      this.lastTickError = (err as Error).message.slice(0, 150);
      this.d.log?.("error", "tick_failed", { error: this.lastTickError });
      // The database may be what failed. Selling needs only the broker, so the end of the day does not wait for it.
      await this.emergencyCloseoutIfNeeded().catch(() => undefined);
    } finally {
      this.ticking = false;
    }
    await this.heartbeat(ok);
    return ok;
  }

  // "ok" at most every 30 seconds; "fail" after 3 failed passes in a row, or at once while the account is
  // still holding positions after the close-out time.
  private async heartbeat(ok: boolean): Promise<void> {
    const nowMs = this.d.now().getTime();
    if (this.notFlat) {
      await this.d.ping("fail").catch(() => false);
      return;
    }
    if (!ok) {
      if (this.failedTicks >= 3) await this.d.ping("fail").catch(() => false);
      return;
    }
    if (nowMs - this.lastOkPing >= 30_000) {
      this.lastOkPing = nowMs;
      await this.d.ping("ok").catch(() => false);
    }
  }

  // Needs no database: reads the market clock from the broker and sells everything near the close.
  private async emergencyCloseoutIfNeeded(): Promise<void> {
    const now = this.d.now();
    const date = etDate(now);
    if (this.emergencyDate === date || this.closingOut || this.inflight.has("closeout")) return;
    const clock = await this.d.broker.getClock();
    const minutesToClose = (new Date(clock.nextClose).getTime() - now.getTime()) / 60_000;
    if (!clock.isOpen || minutesToClose > CLOSEOUT_MINUTES_BEFORE_CLOSE) return;
    this.emergencyDate = date;
    await this.say("alerts", "The database is unreachable near the close, so I am closing everything from the broker's clock alone.");
    this.closingOut = true;
    try {
      const result = await closeOut(this.closeoutDeps(), date);
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
    // Commands first, at any hour: a stop must never wait behind anything else.
    await this.commands.poll();

    const date = etDate(now);
    const today = await ensureDay({ store: this.d.store, broker: this.d.broker, now: this.d.now }, date);
    if (!this.migrated) {
      // Once per start: a future day saved by an older release (before build C2) is put in the new shape and its old
      // request is forgotten, so an old reply cannot count and the request is posted again in the new format.
      const reset = await resetOldShapeFutureDays(this.d.store, now);
      this.migrated = true;
      if (reset.length > 0) this.d.log?.("info", "future_days_reset", { days: reset });
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
      current = await this.limitsFlow(now, date, today, steps);
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

    if (at(-45) && now < day.closeAt && alivePending && !current.phases.screen) this.background("screen", () => this.screenPhase(date));

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
    if (at(0)) current = await lapseIfUndecided(steps, current);

    // Live prices: from 5 minutes before the open, only while the day is still alive.
    const alive = current.status === "approved" || current.status === "pending";
    if (at(-5) && now < day.closeAt && alive && current.liveList && current.liveList.length > 0 && this.streamDate !== date) {
      this.startStream(current, current.liveList);
    }
    if (this.stream && (!alive || now >= day.closeAt)) this.endStream();

    const inSession = now >= day.openAt && now < day.closeAt && current.status === "approved";
    if (inSession && current.phases.armed) await this.refreshView(now);
    if (inSession && now.getTime() - this.lastSync >= SYNC_EVERY_MS) {
      this.lastSync = now.getTime();
      const risk = this.riskDeps();
      const dayNow = current;
      const closeAt = day.closeAt;
      // Runs in the background: a sale that takes a while (a liquidation waits for cancels) must never hold up reading
      // Michael's next command. While a close-out is running, and from the close-out time on, the missing-exit check is
      // switched off and nothing is sold here: the close-out alone flattens the account. It is asked again just before
      // each sale, so a close-out that starts meanwhile switches it off.
      const protect = () => !this.closingOut && !this.inflight.has("closeout") && !this.inflight.has("carried") && this.d.now() < addMinutes(closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE);
      this.background("risk", async () => {
        await syncOrders(risk, dayNow, { protect });
        await enforceDailyLoss(risk, dayNow);
        await sweepEntriesWhileStopped(risk);
      });
    }
    if (inSession || (day.closeAt && now < addMinutes(day.closeAt, 10))) {
      await this.flushDigest();
      if (now.getTime() - this.lastStatsEvent >= 5 * 60_000 && inSession) {
        this.lastStatsEvent = now.getTime();
        await this.d.store.addEvent("info", "governor_stats", { ...this.d.governor.stats(), tradesLastMinute: this.d.governor.tradesInLastMinute() }).catch(() => undefined);
      }
    }

    // Positions carried over from a close-out that did not get flat: sold as soon as the market is open again.
    if (this.notFlat && now >= day.openAt && now < day.closeAt && !this.closingOut && now.getTime() - this.lastCarriedAttempt >= 5 * 60_000) {
      this.lastCarriedAttempt = now.getTime();
      this.background("carried", () => this.carriedPhase(date));
    }

    // Close-out runs until the account is flat: a failed attempt is retried every 5 minutes for 30 minutes
    // past the close (after the close it only reports, it sends nothing), and the heartbeat says "fail" for as
    // long as positions remain.
    const retryMs = now < day.closeAt ? CLOSEOUT_RETRY_MS : 5 * 60_000;
    if (now >= addMinutes(day.closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE) && !current.phases.closeout && !this.closingOut && now.getTime() - this.lastCloseoutAttempt >= retryMs) {
      this.lastCloseoutAttempt = now.getTime();
      this.background("closeout", () => this.closeoutPhase(date, now >= addMinutes(day.closeAt!, 30), day.closeAt));
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
      await postLimitsRequest(steps, target);
      return today;
    }
    // Today is the next session and has not opened: post the request if the evening one was missed, then the
    // review at open - 60 and the reminder at open - 10.
    let cur = await postLimitsRequest(steps, today);
    cur = await postMorningReview(steps, cur);
    cur = await postReminderIfNeeded(steps, cur);
    return cur;
  }

  private async screenPhase(date: string): Promise<void> {
    const { symbols: list, names } = await this.d.buildLiveList();
    await this.d.store.updateDay(date, { liveList: list });
    await this.d.store.setControl(`live_names:${date}`, names).catch(() => undefined);
    await setPhase(this.d.store, date, "screen", this.d.now().toISOString());
    await this.say("trading", `Today's live list (${list.length}):\n${list.length ? formatLiveList(list, names) : "(empty, nothing passed the screen)"}\n${NOT_ADVICE}`);
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
    this.strategy = new BusyPlaceholder(symbols);
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
    const signal = this.strategy?.onTrade(t);
    if (!signal) return;
    this.d.log?.("info", "signal", { symbol: signal.symbol, price: signal.price });
    this.gate.enter(signal).catch((err) => this.d.log?.("error", "gate_failed", { error: (err as Error).message.slice(0, 200) }));
  }

  private async closeoutPhase(date: string, lastTry: boolean, closeAt: Date | null = null): Promise<void> {
    this.endStream();
    this.closingOut = true;
    try {
      const result = await closeOut(this.closeoutDeps(), date, { alert: this.notFlatAlertDate !== date, closeAt: closeAt ?? undefined });
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
      const result = await closeOut(this.closeoutDeps(), date, { alert: this.notFlatAlertDate !== date });
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
    const result = computeDay(listed.orders);
    const fees = estimateFees(date, result.fills);
    const prev = await this.d.store.getControl<FeesRunning>(CONTROL_FEES).catch(() => null);
    const running = addToRunning(prev, date, fees.total);
    await this.d.store.setControl(CONTROL_FEES, running).catch(() => undefined);
    const text = formatSummary({
      day,
      stored: await this.d.store.listOrders(date),
      refusals: await this.d.store.listRefusals(date),
      alpacaOrders: listed.orders,
      account,
      peak: await this.d.store.getControl(peakKey(date)),
      stop: await this.d.store.getControl<StopFlag>(CONTROL_STOP),
      flat: positions.length === 0,
      requests: this.d.governor.stats(),
      feesRunning: running.total,
      listComplete: listed.complete,
    });
    await this.say("trading", text);
    await setPhase(this.d.store, date, "summary", this.d.now().toISOString());
    this.d.governor.resetDayStats();
  }
}
