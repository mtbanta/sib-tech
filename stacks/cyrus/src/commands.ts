// Commands from Michael's phone, read from the command channel. Only the owner's messages in the stack's own
// command channel count. Commands: help, status, stop, resume, flatten, limits, approve, and the four limit
// overrules. The stop flag is stored in the database, and the gate reads it before every order.
import type { Broker } from "./broker.ts";
import type { DiscordBot, DiscordMessage } from "./discord-bot.ts";
import { isOwnerCommand } from "./discord-bot.ts";
import type { Settings } from "./config.ts";
import { decideLimits, limitLines, parseCommand } from "./morning.ts";
import { CONTROL_COMMAND_CURSOR, CONTROL_STOP, type StopFlag, type Store } from "./store.ts";
import { NOT_ADVICE } from "./discord.ts";
import { describeLimits } from "./limits.ts";
import { etDate } from "./time.ts";

export type CommandBot = Pick<DiscordBot, "post" | "latestCommandMessageId" | "commandMessagesAfter">;

export interface CommandDeps {
  settings: Settings;
  store: Store;
  broker: Broker;
  bot: CommandBot;
  now: () => Date;
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
  "`approve` or `approve cap` accept the limits; `position 1500`, `loss 150`, `trades 5`, `cap 2` change one before the open",
  NOT_ADVICE,
].join("\n");

export class CommandProcessor {
  private readonly d: CommandDeps;
  constructor(deps: CommandDeps) {
    this.d = deps;
  }

  private say(text: string): Promise<boolean> {
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
          const kind = parseCommand(m.content).kind;
          await this.say(
            kind === "stop" || kind === "flatten"
              ? "**STOP DID NOT COMPLETE.** The stack could not save the stop flag. It also cannot place new entries while its database is unreachable, but check Alpaca's dashboard and cancel or close anything open by hand."
              : "That command failed. Nothing may have changed, so check `status`.",
          );
        }
      }
      await this.d.store.setControl(CONTROL_COMMAND_CURSOR, { id: m.id });
    }
    return handled;
  }

  async handle(m: DiscordMessage): Promise<void> {
    const cmd = parseCommand(m.content);
    const now = this.d.now();
    this.d.log?.("command", { kind: cmd.kind });
    switch (cmd.kind) {
      case "help":
        await this.say(HELP);
        return;
      case "unknown":
        await this.say(`I did not understand "${cmd.text}". Type \`help\` for the list.`);
        return;
      case "stop": {
        await this.setStop(true, "owner command (stop)", now);
        const n = await this.cancelUnfilledEntries();
        await this.say(`Stopped. No new entries. Cancelled ${n} unfilled entr${n === 1 ? "y" : "ies"}. Open positions keep their protective stops and will be closed at the end of the day (or type \`flatten\`).`);
        return;
      }
      case "resume":
        await this.setStop(false, "owner command (resume)", now);
        await this.say("Stop cleared. New entries still need today's limits approved before the open.");
        return;
      case "flatten": {
        await this.setStop(true, "owner command (flatten)", now);
        await this.d.broker.closeAllPositions();
        await this.say("Stopped, and sent orders to sell every position and cancel every open order. Check `status` in a minute.");
        return;
      }
      case "limits": {
        const day = await this.d.store.getDay(etDate(now));
        await this.say(day ? `Limits for ${day.tradeDate} (${day.status}):\n${limitLines(day)}` : "No limits yet today.");
        return;
      }
      case "status":
        await this.say(await this.statusText(now));
        return;
      case "approve":
      case "set": {
        const date = etDate(now);
        const day = await this.d.store.getDay(date);
        if (!day) {
          await this.say("There is no request for today yet, so there is nothing to approve.");
          return;
        }
        const account = await this.d.broker.getAccount();
        const decision = decideLimits(day, cmd, account.equity, now, m.at);
        if (!decision.ok) {
          await this.say(decision.reply);
          return;
        }
        // The borrowing cap is set at Alpaca first; if that fails, nothing is approved.
        if (decision.patch.decided.cap) {
          await this.d.broker.setAccountConfig({ maxMarginMultiplier: decision.patch.limits.borrowingCap, noShorting: true });
        }
        await this.d.store.updateDay(date, decision.patch);
        this.d.log?.("limits_decision", { status: decision.patch.status, limits: decision.patch.limits });
        await this.say(decision.reply);
        return;
      }
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
    const lines = [
      "**Status**",
      `Stop flag: ${flag?.on ? `ON (${flag.reason})` : "off"}`,
      `Market: ${clock.isOpen ? "open" : "closed"}`,
      day ? `Today (${day.tradeDate}): ${day.status}${day.isTradingDay ? `, limits: ${describeLimits(day.limits)}` : ""}` : "Today: not set up yet",
      day && day.status === "pending" ? limitLines(day) : "",
      `Live list: ${day?.liveList ? day.liveList.join(" ") || "(empty)" : "not built yet"}`,
      `Entries today: ${orders.filter((o) => o.status !== "failed" && o.status !== "rejected").length}; positions now: ${positions.length}`,
      `Equity: ${account.equity.toFixed(2)} (day start ${day?.dayStartEquity?.toFixed(2) ?? "?"})`,
      ...((await this.d.extraStatus?.()) ?? []),
      NOT_ADVICE,
    ];
    return lines.filter(Boolean).join("\n");
  }
}
