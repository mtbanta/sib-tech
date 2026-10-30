// The scheduler: one pass every few seconds ("tick") that runs the day. Each step of the day is recorded in
// the database when it finishes, so a restart picks up where it left off and never repeats a step.
//
// A day, in New York time (Michael sees Central time in messages):
//   open - 60 min  morning request for the limits           open - 45 min  daily screen builds the live list
//   open - 5 min   live prices start                        open           undecided limits lapse: no trading
//   open to close  entries (gate), order sync, loss stop    close - 5 min  close-out: flat
//   close + 5 min  daily summary
// Commands are read on every tick, at any hour. The heartbeat is sent at the end of a tick that worked, and
// "fail" after a tick that did not, so Healthchecks hears when the worker is unwell, not only when it is dead.
import type { GateBroker } from "./broker.ts";
import { CommandProcessor, type CommandBot } from "./commands.ts";
import type { Settings } from "./config.ts";
import { closeOut, CLOSEOUT_MINUTES_BEFORE_CLOSE } from "./closeout.ts";
import { OrderGate, peakKey } from "./gate.ts";
import { ensureDay, lapseIfUndecided, postMorningRequest, postReminderIfNeeded } from "./morning.ts";
import { enforceDailyLoss, syncOrders } from "./risk.ts";
import { OpeningRangeBreakout } from "./strategy.ts";
import type { Trade } from "./stream.ts";
import { CONTROL_STOP, setPhase, type DayRecord, type StopFlag, type Store } from "./store.ts";
import { formatSummary } from "./summary.ts";
import { addMinutes, centralClock, etDate } from "./time.ts";
import { NOT_ADVICE } from "./discord.ts";
import type { PingKind } from "./heartbeat.ts";

export type Channel = "commands" | "trading" | "alerts";

export interface StreamLike {
  start(): void;
  stop(): void;
  status(): string;
}

export interface WorkerDeps {
  settings: Settings;
  broker: GateBroker;
  store: Store;
  bot: CommandBot;
  now: () => Date;
  ping: (kind: PingKind) => Promise<boolean>;
  // Builds the day's live list (universe, daily bars, screen). Slow (minutes), so it runs in the background.
  buildLiveList: () => Promise<string[]>;
  makeStream: (symbols: string[], onTrade: (t: Trade) => void) => StreamLike;
  sleep?: (ms: number) => Promise<void>;
  log?: (level: "info" | "warn" | "error", event: string, data?: Record<string, unknown>) => void;
}

const SYNC_EVERY_MS = 30_000;

export class Worker {
  private readonly d: WorkerDeps;
  private readonly commands: CommandProcessor;
  private readonly gate: OrderGate;
  private readonly inflight = new Set<string>();
  private stream: StreamLike | null = null;
  private streamDate: string | null = null;
  private strategy: OpeningRangeBreakout | null = null;
  private lastSync = 0;
  private lastTradeAt: Date | null = null;
  private lastTickError: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(deps: WorkerDeps) {
    this.d = deps;
    this.commands = new CommandProcessor({
      settings: deps.settings,
      store: deps.store,
      broker: deps.broker,
      bot: deps.bot,
      now: deps.now,
      extraStatus: async () => this.statusLines(),
      log: (e, data) => deps.log?.("info", e, data),
    });
    this.gate = new OrderGate({ broker: deps.broker, store: deps.store, now: deps.now, say: (c, t) => this.say(c, t), log: (e, data) => deps.log?.("info", e, data) });
  }

  private say(channel: Channel, text: string): Promise<boolean> {
    return this.d.bot.post(channel, text);
  }

  private statusLines(): string[] {
    return [
      `Live prices: ${this.stream ? this.stream.status() : "not started"}${this.lastTradeAt ? `, last trade seen ${centralClock(this.lastTradeAt)}` : ""}`,
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
    let ok = true;
    try {
      await this.pass();
      this.lastTickError = null;
    } catch (err) {
      ok = false;
      this.lastTickError = (err as Error).message.slice(0, 150);
      this.d.log?.("error", "tick_failed", { error: this.lastTickError });
    }
    await this.d.ping(ok ? "ok" : "fail").catch(() => false);
    return ok;
  }

  private async pass(): Promise<void> {
    const now = this.d.now();
    // Commands first, at any hour: a stop must never wait behind anything else.
    await this.commands.poll();

    const date = etDate(now);
    const day = await ensureDay({ store: this.d.store, broker: this.d.broker }, date);
    if (!day.isTradingDay || !day.openAt || !day.closeAt) return;
    const at = (minutesFromOpen: number) => now >= addMinutes(day.openAt!, minutesFromOpen);
    const steps = { store: this.d.store, broker: this.d.broker, say: (c: Channel, t: string) => this.say(c, t), now: this.d.now };

    let current: DayRecord = day;
    if (at(-60) && now < day.closeAt) {
      current = await postMorningRequest(steps, current);
      current = await postReminderIfNeeded(steps, current);
    }
    if (at(-45) && now < day.closeAt && !current.phases.screen) this.background("screen", () => this.screenPhase(date));
    if (at(0)) current = await lapseIfUndecided(steps, current);

    // Live prices: from 5 minutes before the open, only while the day is still alive.
    const alive = current.status === "approved" || current.status === "pending";
    if (at(-5) && now < day.closeAt && alive && current.liveList && current.liveList.length > 0 && this.streamDate !== date) {
      this.startStream(current, current.liveList);
    }
    if (this.stream && (!alive || now >= day.closeAt)) this.endStream();

    if (now >= day.openAt && now < day.closeAt && current.status === "approved" && now.getTime() - this.lastSync >= SYNC_EVERY_MS) {
      this.lastSync = now.getTime();
      const risk = { broker: this.d.broker, store: this.d.store, now: this.d.now, say: steps.say, log: (e: string, data?: Record<string, unknown>) => this.d.log?.("info", e, data) };
      await syncOrders(risk, current);
      await enforceDailyLoss(risk, current);
    }

    if (now >= addMinutes(day.closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE) && !current.phases.closeout) {
      this.background("closeout", () => this.closeoutPhase(date));
    }
    if (now >= addMinutes(day.closeAt, 5) && current.phases.closeout && !current.phases.summary) {
      this.background("summary", () => this.summaryPhase(date));
    }
  }

  private async screenPhase(date: string): Promise<void> {
    const list = await this.d.buildLiveList();
    await this.d.store.updateDay(date, { liveList: list });
    await setPhase(this.d.store, date, "screen", this.d.now().toISOString());
    await this.say("trading", `Today's live list (${list.length}): ${list.join(" ") || "(empty, nothing passed the screen)"}\n${NOT_ADVICE}`);
  }

  private startStream(day: DayRecord, symbols: string[]): void {
    this.streamDate = day.tradeDate;
    this.strategy = new OpeningRangeBreakout(day.openAt!, symbols);
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

  private async closeoutPhase(date: string): Promise<void> {
    this.endStream();
    const result = await closeOut({ broker: this.d.broker, store: this.d.store, now: this.d.now, say: (c, t) => this.say(c, t), sleep: this.d.sleep, log: (e, data) => this.d.log?.("info", e, data) }, date);
    await setPhase(this.d.store, date, "closeout", this.d.now().toISOString(), { flat: result.flat ? "yes" : "no" });
  }

  private async summaryPhase(date: string): Promise<void> {
    const day = (await this.d.store.getDay(date))!;
    const [account, alpacaOrders, positions] = await Promise.all([this.d.broker.getAccount(), this.d.broker.listOrders("all"), this.d.broker.listPositions()]);
    // Bring the stored entries up to date from the final fills before summarising.
    await syncOrders({ broker: this.d.broker, store: this.d.store, now: this.d.now, say: (c, t) => this.say(c, t) }, day).catch(() => undefined);
    const text = formatSummary({
      day,
      stored: await this.d.store.listOrders(date),
      refusals: await this.d.store.listRefusals(date),
      alpacaOrders,
      account,
      peak: await this.d.store.getControl(peakKey(date)),
      stop: await this.d.store.getControl<StopFlag>(CONTROL_STOP),
      flat: positions.length === 0,
    });
    await this.say("trading", text);
    await setPhase(this.d.store, date, "summary", this.d.now().toISOString());
  }
}
