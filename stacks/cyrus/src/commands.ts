// Commands from Michael's phone, read from the command channel. Only the owner's messages in the stack's own
// command channel count. Commands: help, status, stop, resume, flatten, limits, approve, and the four limit
// overrules. The stop flag is stored in the database, and the gate reads it before every order.
import type { Broker } from "./broker.ts";
import type { DiscordBot, DiscordMessage } from "./discord-bot.ts";
import { isOwnerCommand } from "./discord-bot.ts";
import type { Settings } from "./config.ts";
import { decideLimits, limitLines, parseCommand, type NextSessionFinder } from "./morning.ts";
import type { Liquidator, Say } from "./sells.ts";
import { CONTROL_COMMAND_CURSOR, CONTROL_STOP, type DayRecord, type StopFlag, type Store } from "./store.ts";
import { describeLimits } from "./limits.ts";
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
  "`approve` or `approve cap` accept the next trading day's limits; `position 1500`, `loss 150`, `trades 20`, `cap 2` change one (`trades` is orders a minute, 1 to 100). Until the `Armed` message 5 minutes before the open you can change any limit; after it only tighten (lower) a limit, until the evening post.",
  "You can send several commands in one message, one per line; I reply to each line.",
].join("\n");

export class CommandProcessor {
  private readonly d: CommandDeps;
  constructor(deps: CommandDeps) {
    this.d = deps;
  }

  // While one owner message is being handled, replies are collected and posted together as one message.
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

  // One message can hold several commands, one per line. Each line gets its own reply (an unknown line is named),
  // and the replies go out together in one message so Discord's rate limit is not a limit on commands.
  async handle(m: DiscordMessage): Promise<void> {
    const lines = m.content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
    if (lines.length <= 1) {
      await this.handleLine(m);
      return;
    }
    const shown = lines.slice(0, 20);
    this.out = [];
    try {
      for (const line of shown) {
        this.prefix = `**${line.slice(0, 40)}**: `;
        try {
          await this.handleLine({ ...m, content: line });
        } catch (err) {
          this.d.log?.("command_failed", { error: (err as Error).message });
          this.out.push(`${this.prefix}that command failed. Nothing may have changed, so check \`status\`.`);
        }
      }
      if (lines.length > shown.length) this.out.push(`I only read the first ${shown.length} lines; ${lines.length - shown.length} more were ignored.`);
    } finally {
      const replies = this.out;
      this.out = null;
      this.prefix = "";
      let chunk = "";
      for (const r of replies) {
        if (chunk && chunk.length + r.length + 2 > 1800) {
          await this.d.bot.post("commands", chunk);
          chunk = "";
        }
        chunk = chunk ? `${chunk}\n\n${r}` : r;
      }
      if (chunk) await this.d.bot.post("commands", chunk);
    }
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
      case "resume":
        await this.setStop(false, "owner command (resume)", now);
        await this.say("Stop cleared. New entries still need today's limits approved before the open.");
        return;
      case "flatten": {
        const saved = await this.trySetStop(true, "owner command (flatten)", now);
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
        await this.say(
          failed || !flat
            ? `${saved ? "Stop flag is set" : "**The stop flag could not be saved**"}, but **the account is not flat yet${remaining.length ? ` (${remaining.join(", ")})` : ""}**. I keep the stop on; check Alpaca's dashboard and close positions by hand if it stays that way.`
            : saved
              ? "Stopped, and sold every position and cancelled every open order: the account is flat."
              : "Sold everything, but **the stop flag could not be saved**: no new entries can happen while the database is down, check `status` once it is back.",
        );
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
        if (rearm) decision.reply += "\nThe cap changed after arming, so I will set it at Alpaca again in a few seconds.";
        const flag = await this.d.store.getControl<StopFlag>(CONTROL_STOP).catch(() => null);
        if (flag?.on && decision.patch.status === "approved") decision.reply += `\n**Note: the stop flag is ON (${flag.reason}), so there will be no entries until you type \`resume\`.**`;
        this.d.log?.("limits_decision", { status: decision.patch.status, limits: decision.patch.limits, mode, date });
        await this.say(decision.reply);
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
    const armed = today && (today.phases.armed !== undefined || today.phases.rearm !== undefined);
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
      day && day.status === "pending" ? limitLines(day) : "",
      `Live list: ${day?.liveList ? day.liveList.join(" ") || "(empty)" : "not built yet"}`,
      `Entries today: ${orders.filter((o) => o.status !== "failed" && o.status !== "rejected").length}; positions now: ${positions.length}`,
      `Equity: ${account.equity.toFixed(2)} (day start ${day?.dayStartEquity?.toFixed(2) ?? "?"})`,
      ...((await this.d.extraStatus?.()) ?? []),
    ];
    return lines.filter(Boolean).join("\n");
  }
}
