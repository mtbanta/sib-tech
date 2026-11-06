// Commands from Michael's phone, read from the command channel. Only the owner's messages in the stack's own
// command channel count. Commands: help, status, stop, resume, flatten, limits, approve, and the four limit
// overrules. The stop flag is stored in the database, and the gate reads it before every order.
import type { Broker } from "./broker.ts";
import type { DiscordBot, DiscordMessage } from "./discord-bot.ts";
import { isOwnerCommand } from "./discord-bot.ts";
import type { Settings } from "./config.ts";
import { decideLimits, decideLoad, limitLines, parseCommand, type NextSessionFinder } from "./morning.ts";
import { LOAD_PHASE, loadLine } from "./load-mode.ts";
import type { Liquidator, Say } from "./sells.ts";
import { CONTROL_COMMAND_CURSOR, CONTROL_STOP, setPhase, type DayRecord, type StopFlag, type Store } from "./store.ts";
import { MAX_TRADES_PER_MINUTE, MAX_TRADES_PER_MINUTE_LOAD_DAY, describeLimits } from "./limits.ts";
import { centralClock, dayWord, etDate, sessionPhase } from "./time.ts";

export type CommandBot = Pick<DiscordBot, "post" | "latestCommandMessageId" | "commandMessagesAfter">;

export interface CommandDeps {
  settings: Settings;
  store: Store;
  broker: Broker;
  bot: CommandBot;
  liquidator: Liquidator;
  now: () => Date;
  // Finds the next trading day that has not opened yet: the day approvals and limit changes apply to.
  sessions: NextSessionFinder;
  // Extra status lines the worker knows (stream state, last price time). Optional.
  extraStatus?: () => Promise<string[]>;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

const HELP = [
  "**Commands** (only you, only here)",
  "`status` what the stack is doing",
  "`stop` no new entries; unfilled entries are cancelled; positions keep their protective stops and are closed at the end of the day",
  "`resume` clears the stop (approved limits are still needed)",
  "`flatten` stop, then sell everything now",
  "`limits` today's limits",
  "`approve` or `approve cap` accept the next trading day's limits; `position 1500`, `loss 150`, `trades 20`, `cap 2` change one (`trades` is orders a minute, 1 to 100, or up to 150 on a load day: send `load on` first, or in the same message). Until the `Armed` message 5 minutes before the open you can change any limit; after it only tighten (lower) a limit, until the evening post.",
  "`load on` / `load off` make the next trading day a load day or a normal day (see line 5 of the limits); `load on` until the morning screen, 45 minutes before the open; after `Armed` only `load off`.",
  "You can send several commands in one message, one per line; I answer each line in one short reply and then show the limits once.",
].join("\n");

// The limits list that ends a reply to a limit or load command (once per message), with a closing line on what it means.
export function limitsListFor(day: DayRecord, mode: "edit" | "tighten"): string {
  const closing =
    day.status === "approved"
      ? mode === "tighten"
        ? "All four decided. The day is armed, so a limit can only be lowered until the next evening post."
        : "All four decided: trading is allowed within these. You can change any of them until the Armed message, 5 minutes before the open."
      : day.status === "pending"
        ? "Not all decided yet: if any limit is still waiting at the open, I will not trade that day."
        : "";
  return [`**${dayWord(day.tradeDate)}** (${day.status}):`, limitLines(day), closing].filter(Boolean).join("\n");
}

export class CommandProcessor {
  private readonly d: CommandDeps;
  constructor(deps: CommandDeps) {
    this.d = deps;
  }

  // While one owner message is being handled, replies are collected and posted together as one message.
  private readonly pending = new Set<Promise<unknown>>();
  // Resolves when every background flatten started by a command has finished (the tests use it).
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }

  private out: string[] | null = null;
  private prefix = "";

  private async say(text: string): Promise<boolean> {
    if (this.out) {
      this.out.push(this.prefix ? `${this.prefix}${text}` : text);
      return true;
    }
    return this.d.bot.post("commands", text);
  }

  // Reads new messages and acts on the owner's. The cursor moves after each message is handled, so a restart
  // never skips a command. A replayed command is harmless: every command is safe to run twice, and limit
  // decisions older than this morning's request are ignored.
  async poll(): Promise<number> {
    const cursor = await this.d.store.getControl<{ id: string }>(CONTROL_COMMAND_CURSOR);
    if (!cursor) {
      // First run: start after whatever is already there, never act on history.
      const latest = await this.d.bot.latestCommandMessageId();
      await this.d.store.setControl(CONTROL_COMMAND_CURSOR, { id: latest ?? "0" });
      return 0;
    }
    const messages = await this.d.bot.commandMessagesAfter(cursor.id);
    let handled = 0;
    for (const m of messages) {
      if (isOwnerCommand(m, this.d.settings)) {
        handled++;
        try {
          await this.handle(m);
        } catch (err) {
          this.d.log?.("command_failed", { error: (err as Error).message });
          await this.say("That command failed. Nothing may have changed, so check `status`.");
        }
      }
      await this.d.store.setControl(CONTROL_COMMAND_CURSOR, { id: m.id });
    }
    return handled;
  }

  // The speed release (decision 6, "one consolidated reply per message"): the day whose limits list ends the reply (set by a limit
  // or load command in the message), and whether that day is armed (only tightening allowed).
  private listDate: string | null = null;
  private listMode: "edit" | "tighten" = "edit";

  // One message can hold several commands, one per line. The whole message gets ONE reply: one short line per command (an unknown
  // line is named), then, if any limit or load command was in it, the limits list once at the end (before, every line repeated the
  // full five-line list). It goes out as one message, so Discord's rate limit is not a limit on commands. What each command DOES is
  // unchanged.
  async handle(m: DiscordMessage): Promise<void> {
    const lines = m.content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
    const multi = lines.length > 1;
    // Michael's ruling of 2026-11-06: `load on` / `load off` lines are handled first, so `trades 150` in the same message is judged
    // against the day's mode as that message sets it, whatever the order of the lines.
    // The replies keep the order of the lines as written.
    const isLoadLine = (l: string) => /^load\s+(on|off)$/i.test(l);
    const shown = multi ? lines.slice(0, 20) : [m.content];
    const order = multi ? [...shown.keys()].sort((x, y) => Number(!isLoadLine(shown[x]!)) - Number(!isLoadLine(shown[y]!)) || x - y) : [0];
    const slots: string[][] = shown.map(() => []);
    this.out = [];
    this.listDate = null;
    try {
      for (const idx of order) {
        const line = shown[idx]!;
        this.prefix = multi ? `**${line.slice(0, 40)}**: ` : "";
        const mark = this.out.length;
        try {
          await this.handleLine({ ...m, content: line });
        } catch (err) {
          this.d.log?.("command_failed", { error: (err as Error).message });
          this.out.push(`${this.prefix}${multi ? "that" : "That"} command failed. Nothing may have changed, so check \`status\`.`);
        }
        slots[idx] = this.out.splice(mark);
      }
      this.out.push(...slots.flat());
      if (lines.length > shown.length) this.out.push(`I only read the first ${shown.length} lines; ${lines.length - shown.length} more were ignored.`);
      if (this.listDate) {
        const day = await this.d.store.getDay(this.listDate).catch(() => null);
        if (day) this.out.push(`\n${limitsListFor(day, this.listMode)}`);
      }
    } finally {
      const replies = this.out;
      this.out = null;
      this.prefix = "";
      this.listDate = null;
      let chunk = "";
      for (const r of replies) {
        if (chunk && chunk.length + r.length + 1 > 1800) {
          await this.d.bot.post("commands", chunk);
          chunk = "";
        }
        chunk = chunk ? `${chunk}\n${r}` : r;
      }
      if (chunk) await this.d.bot.post("commands", chunk);
    }
  }

  // A limit or load command was in this message: show that day's list once at the end of the reply.
  private showList(date: string, mode: "edit" | "tighten"): void {
    this.listDate = date;
    this.listMode = mode;
  }

  private async handleLine(m: DiscordMessage): Promise<void> {
    if (m.content.trim() === "") {
      // Discord hides message text from a bot whose Message Content switch is off. Say that, not "did not understand".
      this.d.log?.("command", { kind: "empty_text" });
      await this.say("I can see that you wrote a message, but its text came through empty, so I cannot read it. If this keeps happening, the bot's **Message Content Intent** is off: Discord Developer Portal, this bot's application, Bot page, Privileged Gateway Intents.");
      return;
    }
    const cmd = parseCommand(m.content);
    const now = this.d.now();
    this.d.log?.("command", { kind: cmd.kind });
    switch (cmd.kind) {
      case "help":
        await this.say(HELP);
        return;
      case "unknown":
        await this.say(`I did not understand the line "${cmd.text}". Nothing was done for it. Type \`help\` for the list.`);
        return;
      case "stop": {
        const saved = await this.trySetStop(true, "owner command (stop)", now);
        let n = 0;
        let cancelFailed = false;
        try {
          n = await this.cancelUnfilledEntries();
        } catch {
          cancelFailed = true;
        }
        if (!saved) {
          await this.say("**STOP DID NOT COMPLETE.** The stack could not save the stop flag. It also cannot place new entries while its database is unreachable, but check Alpaca's dashboard and cancel or close anything open by hand.");
        } else if (cancelFailed) {
          await this.say("Stop flag is set, so no new entries. But **cancelling unfilled entries failed**: check Alpaca's dashboard for open buy orders.");
        } else {
          await this.say(`Stopped. No new entries. Cancelled ${n} unfilled entr${n === 1 ? "y" : "ies"}. Open positions keep their protective stops and will be closed at the end of the day (or type \`flatten\`).`);
        }
        return;
      }
      case "resume": {
        await this.setStop(false, "owner command (resume)", now);
        // Wording only (the 10:31 AM note of 2026-11-03): if today's loss is still past the limit, the daily loss stop puts the stop
        // back on at its next check, so the reply says so. The resume itself is done above and is not changed by this look.
        const past = await this.lossStillPast(now);
        await this.say(past ? `Stop cleared, but today's loss (${past.loss.toFixed(2)} dollars) is still past the ${past.limit} dollar daily limit, so the daily loss stop will put the stop back on within about 5 seconds, and it stays on until the next trading day.` : "Stop cleared. Entries still need the day's limits approved.");
        return;
      }
      case "flatten": {
        const saved = await this.trySetStop(true, "owner command (flatten)", now);
        // The sale can take a while (it waits for cancels). It runs in the background so the next command, the heartbeat
        // and the rest of the pass are not held up; the reply follows when it is done.
        const task = (async () => {
          let flat = false;
          let remaining: string[] = [];
          let failed = false;
          try {
            const r = await this.d.liquidator.flatten({ reason: "flatten command", tradeDate: etDate(now) });
            flat = r.flat;
            remaining = r.remaining;
          } catch {
            failed = true;
          }
          const text =
            failed || !flat
              ? `${saved ? "Stop flag is set" : "**The stop flag could not be saved**"}, but **the account is not flat yet${remaining.length ? ` (${remaining.join(", ")})` : ""}**. I keep the stop on; check Alpaca's dashboard and close positions by hand if it stays that way.`
              : saved
                ? "Stopped, and sold every position and cancelled every open order: the account is flat."
                : "Sold everything, but **the stop flag could not be saved**: no new entries can happen while the database is down, check `status` once it is back.";
          const line = this.prefix ? `${this.prefix}${text}` : text;
          await this.d.bot.post("commands", line);
        })();
        this.pending.add(task);
        void task.finally(() => this.pending.delete(task));
        await this.say(saved ? "Stopped. Selling every position and cancelling every open order now; I will say when the account is flat." : "**The stop flag could not be saved.** Selling every position now anyway; I will say when it is done.");
        return;
      }
      case "limits": {
        const next = await this.d.sessions.next(now);
        const nextDay = next ? await this.d.store.getDay(next.date) : null;
        const today = await this.d.store.getDay(etDate(now));
        const parts: string[] = [];
        if (today && today.isTradingDay && today.status !== "not_trading_day" && (!nextDay || today.tradeDate !== nextDay.tradeDate)) {
          parts.push(`Today, ${dayWord(today.tradeDate)} (${today.status}):\n${limitLines(today)}`);
        }
        if (nextDay) parts.push(`${dayWord(nextDay.tradeDate)} (${nextDay.status}):\n${limitLines(nextDay)}`);
        await this.say(parts.length > 0 ? parts.join("\n\n") : next ? `No limits request yet for ${dayWord(next.date)}. It is posted after the close.` : "No upcoming trading day found.");
        return;
      }
      case "status":
        await this.say(await this.statusText(now));
        return;
      case "load": {
        const target = await this.targetDay(now);
        if (!target) {
          await this.say("I cannot find the next trading day in Alpaca's calendar, so there is nothing to switch.");
          return;
        }
        const { date, day, mode } = target;
        if (!day) {
          await this.say(`There is no limits request for ${dayWord(date)} yet. I post it after the market closes.`);
          return;
        }
        // Decided again on the record as it is now, just before writing (the clock may have passed a deadline meanwhile).
        const latest = await this.d.store.getDay(date);
        const decision = latest ? decideLoad(latest, cmd.on, this.d.now(), m.at, mode) : decideLoad(day, cmd.on, now, m.at, mode);
        this.showList(date, mode);
        if (!decision.ok || !latest) {
          await this.say(decision.reply);
          return;
        }
        await setPhase(this.d.store, date, LOAD_PHASE, decision.value);
        this.d.log?.("load_mode", { date, value: decision.value, mode });
        // Michael's ruling of 2026-11-06: above 100 orders a minute only while the load window is on. Switching it off lowers an
        // approved value above 100 to 100 (lowering is always allowed); the gate caps at 100 from then on in any case.
        let lowered = "";
        if (decision.value !== "on" && latest.limits.maxTradesPerMinute > MAX_TRADES_PER_MINUTE) {
          await this.d.store.updateDay(date, { limits: { ...latest.limits, maxTradesPerMinute: MAX_TRADES_PER_MINUTE } });
          lowered = ` trades lowered from ${latest.limits.maxTradesPerMinute} to ${MAX_TRADES_PER_MINUTE} (above ${MAX_TRADES_PER_MINUTE}, up to ${MAX_TRADES_PER_MINUTE_LOAD_DAY}, is for load days only).`;
          this.d.log?.("trades_lowered_for_load_off", { date, from: latest.limits.maxTradesPerMinute });
        }
        // One short line (the mode line itself is in the list at the end of the reply).
        await this.say(`${decision.reply.split("\n")[0]!}${lowered}`);
        return;
      }
      case "approve":
      case "set": {
        const target = await this.targetDay(now);
        if (!target) {
          await this.say("I cannot find the next trading day in Alpaca's calendar, so there is nothing to approve.");
          return;
        }
        const { date, day, mode } = target;
        if (!day) {
          await this.say(`There is no limits request for ${dayWord(date)} yet, so there is nothing to approve. I post it after the market closes.`);
          return;
        }
        this.showList(date, mode);
        const account = await this.d.broker.getAccount();
        const decision = decideLimits(day, cmd, account.equity, now, m.at, mode);
        if (!decision.ok) {
          await this.say(decision.reply);
          return;
        }
        // The scheduler may have lapsed the day while we were talking to Alpaca: look again before writing.
        // The borrowing cap itself is set at Alpaca only at 5 minutes before the open (arming), never here.
        const latest = await this.d.store.getDay(date);
        const stillOpenForChange = latest && latest.status !== "lapsed" && (mode === "tighten" ? latest.closeAt !== null && this.d.now() < latest.closeAt : !(latest.openAt && this.d.now() >= latest.openAt));
        if (!latest || !stillOpenForChange) {
          await this.say("Too late: the market opened while I was saving that, so that day's limits are fixed and nothing changed.");
          return;
        }
        // A changed cap after the day was armed must be set at Alpaca again, so arming is undone and the scheduler
        // arms again (the gate refuses entries in between). Other limits are read from the day at each entry.
        // `rearm` keeps the day in the "armed, tighten only" state while that happens.
        const { armed: _armed, ...phasesWithoutArmed } = latest.phases;
        const rearm = latest.phases.armed !== undefined && decision.patch.limits.borrowingCap !== latest.limits.borrowingCap;
        await this.d.store.updateDay(date, rearm ? { ...decision.patch, phases: { ...phasesWithoutArmed, rearm: this.d.now().toISOString() } } : decision.patch);
        // One short line per command; the full list (with what is decided and what is waiting) ends the reply once.
        // In a several-command message each reply is already named by its line, so the line is not repeated.
        const what = cmd.kind === "set" ? `${cmd.name} ${cmd.value}` : cmd.name === "all" ? "approve" : `approve ${cmd.name}`;
        let reply = `${this.prefix ? "" : `${what}: `}${cmd.kind === "approve" && cmd.name === "all" ? "all four limits accepted." : cmd.kind === "approve" ? "accepted." : "noted."}`;
        if (rearm) reply += " The cap changed after arming, so I will set it at Alpaca again in a few seconds.";
        const flag = await this.d.store.getControl<StopFlag>(CONTROL_STOP).catch(() => null);
        if (flag?.on && decision.patch.status === "approved") reply += ` **Note: the stop flag is ON (${flag.reason}), so there will be no entries until you type \`resume\`.**`;
        this.d.log?.("limits_decision", { status: decision.patch.status, limits: decision.patch.limits, mode, date });
        await this.say(reply);
        return;
      }
    }
  }

  // Which day a limit command applies to, at this moment:
  //  - before the "Armed" message (5 minutes before the open): the next session that has not opened, any change allowed;
  //  - from "Armed" until the close of that session: the day that is running, and a limit may only be tightened;
  //  - after the close (the evening post): the next session again.
  private async targetDay(now: Date): Promise<{ date: string; day: DayRecord | null; mode: "edit" | "tighten" } | null> {
    const today = await this.d.store.getDay(etDate(now));
    // Armed, re-arming, or an approved day inside its last 5 minutes before the open whose arming has not worked yet: in all
    // of these a limit may only be tightened.
    const armed = today && (today.phases.armed !== undefined || today.phases.rearm !== undefined || (today.status === "approved" && today.openAt !== null && now.getTime() >= today.openAt.getTime() - 5 * 60_000));
    if (today && today.isTradingDay && today.status === "approved" && armed && today.openAt && today.closeAt && now < today.closeAt) {
      return { date: today.tradeDate, day: today, mode: "tighten" };
    }
    const next = await this.d.sessions.next(now);
    if (!next) return null;
    return { date: next.date, day: await this.d.store.getDay(next.date), mode: "edit" };
  }

  // The stop flag is the first thing a stop does; if it cannot be saved the broker side still gets its turn.
  private async trySetStop(on: boolean, reason: string, now: Date): Promise<boolean> {
    try {
      await this.setStop(on, reason, now);
      return true;
    } catch {
      return false;
    }
  }

  private async setStop(on: boolean, reason: string, now: Date): Promise<void> {
    const flag: StopFlag = { on, at: now.toISOString(), reason };
    await this.d.store.setControl(CONTROL_STOP, flag);
  }

  // For the `resume` reply only: today's loss if it is still at or past the approved daily limit on an armed day, else null. Never
  // throws, and gives up after 3 seconds (then the plain reply is used), so it can neither fail nor hold up the resume.
  private async lossStillPast(now: Date): Promise<{ loss: number; limit: number } | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = (async () => {
      const day = await this.d.store.getDay(etDate(now));
      if (!day || day.status !== "approved" || !(day.phases.armed || day.phases.rearm) || day.dayStartEquity === null) return null;
      const account = await this.d.broker.getAccount();
      const loss = day.dayStartEquity - account.equity;
      return loss >= day.limits.dailyLossStopUsd ? { loss, limit: day.limits.dailyLossStopUsd } : null;
    })().catch(() => null);
    try {
      return await Promise.race([look, new Promise<null>((r) => (timer = setTimeout(() => r(null), 3_000)))]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // Cancels buy orders that have not filled at all. Protective stops of filled entries are left alone.
  private async cancelUnfilledEntries(): Promise<number> {
    const open = await this.d.broker.listOrders("open");
    let n = 0;
    for (const o of open) {
      if (o.side === "buy" && o.filledQty === 0) {
        await this.d.broker.cancelOrder(o.id);
        n++;
      }
    }
    return n;
  }

  private async statusText(now: Date): Promise<string> {
    const flag = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
    const day = await this.d.store.getDay(etDate(now));
    const [account, positions, clock] = await Promise.all([this.d.broker.getAccount(), this.d.broker.listPositions(), this.d.broker.getClock()]);
    const orders = day ? await this.d.store.listOrders(day.tradeDate) : [];
    const next = await this.d.sessions.next(now).catch(() => null);
    const nextDay = next && (!day || next.date !== day.tradeDate) ? await this.d.store.getDay(next.date) : null;
    const phase = sessionPhase(day, now);
    const phaseText = { no_session: "no session today (weekend, holiday or not set up)", before_open: `session not started (opens ${day?.openAt ? centralClock(day.openAt) : "?"})`, open: "session in progress", after_close: "session ended" }[phase];
    const disagree = (phase === "open") !== clock.isOpen && phase !== "no_session" ? " (the calendar and Alpaca's clock disagree, so check Alpaca)" : "";
    const lines = [
      "**Status**",
      `Stop flag: ${flag?.on ? `ON (${flag.reason})` : "off"}`,
      `Market: ${clock.isOpen ? "open" : "closed"} by Alpaca's clock; ${phaseText}${disagree}`,
      next ? `Next session: ${dayWord(next.date)}, opens ${centralClock(next.openAt)}${nextDay ? `, limits ${nextDay.status}` : ", limits request not posted yet"}` : "",
      day ? `Today (${day.tradeDate}): ${day.status}${day.isTradingDay ? `, limits: ${describeLimits(day.limits)}` : ""}` : "Today: not set up yet",
      day && day.isTradingDay ? loadLine(day).replace(/^5\. mode: /, "Mode today: ") : "",
      day && day.status === "pending" ? limitLines(day) : "",
      `Live list: ${day?.liveList ? day.liveList.join(" ") || "(empty)" : "not built yet"}`,
      `Entries today: ${orders.filter((o) => o.status !== "failed" && o.status !== "rejected").length}; positions now: ${positions.length}`,
      `Equity: ${account.equity.toFixed(2)} (day start ${day?.dayStartEquity?.toFixed(2) ?? "?"})`,
      ...((await this.d.extraStatus?.()) ?? []),
    ];
    return lines.filter(Boolean).join("\n");
  }
}
