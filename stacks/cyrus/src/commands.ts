// Commands from Michael's phone, read from the command channel. Only the owner's messages in the stack's own
// command channel count. Commands: help, status, stop, resume, flatten, limits, approve, and the four limit
// overrules. The stop flag is stored in the database, and the gate reads it before every order.
import type { Broker } from "./broker.ts";
import type { DiscordBot, DiscordMessage } from "./discord-bot.ts";
import { isOwnerCommand } from "./discord-bot.ts";
import type { Settings } from "./config.ts";
import { decideLimits, decideLoad, limitLines, parseCommand, type NextSessionFinder } from "./morning.ts";
import { AFTERNOON_FLAT_PHASE, LOAD_AFTERNOON_PHASE, LOAD_MAX_POSITION_USD, LOAD_PHASE, afternoonCloseoutPending, afternoonLoadStart, afternoonLoadWindow, beforeLoadWindow, inAfternoonLoad, isLoadDay, loadLine, loadWindow, loadWindowRules } from "./load-mode.ts";
import { CLOSEOUT_MINUTES_BEFORE_CLOSE } from "./closeout.ts";
import type { Liquidator, Say } from "./sells.ts";
import { CONTROL_COMMAND_CURSOR, CONTROL_NOT_FLAT, CONTROL_STOP, setPhase, type DayRecord, type NotFlatState, type StopFlag, type Store } from "./store.ts";
import { MAX_TRADES_PER_MINUTE, MAX_TRADES_PER_MINUTE_LOAD_DAY, MIN_MINUTES_BEFORE_CLOSE, describeLimits } from "./limits.ts";
import { addMinutes, centralClock, dayWord, etDate, sessionPhase } from "./time.ts";
import { blockedNext, goRefusal, lossPast, middayFlat, middayTimes, readHold, readPause, resumedByText, setHold, updatePause, type MiddayPause } from "./midday.ts";

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
  // `load afternoon` on a normal morning: starts the cheap-symbol screen and the price feed switch in the background (it can take
  // minutes, and the main loop must keep reading commands). The worker calls finishAfternoonLoad in a later pass, after that pass has
  // read commands, so a `stop` or `go` sent meanwhile is seen first (group 1 review, round 1). False if one is already running.
  // Returns "finishing" when an earlier screen was cancelled and is still running (fix of 2026-11-12).
  afternoonScreen?: (date: string) => boolean | "finishing";
  // Michael's approval of 2026-11-11 (after round 2): a `stop`, `flatten` or `go` handled while that screen is running or done but not
  // yet decided cancels the pending window (what Michael can do next: screenCancelledLine). True if one was pending.
  cancelAfternoonScreen?: (date: string) => boolean | "switched";
  // `load afternoon` was built but switched OFF in the release of 2026-11-11 (option B). The release of 2026-11-12 fixes group 1's
  // round 3 findings and main.ts switches it on (one line there, `loadAfternoon: true`, turns it off again).
  loadAfternoonEnabled?: boolean;
}

// Why `load afternoon` cannot start now, or null (Michael's standing requirement of 2026-11-11): today has a mid-day cycle, is approved
// and armed, the window was not started already, it is before 1:30 PM Central (or the last entry if earlier), the mid-day pause is on
// and its close-out finished flat, no stop is on, the not-flat flag is off, and Alpaca shows no positions and no open orders.
// Michael's ruling of 2026-11-12 (afternoon): it is also accepted while the account is flat and a plain stop flag is on (his `stop` or
// `flatten`, never the daily loss stop), after the mid-day close-out finished flat and before 1:30 PM, whether or not the pause is
// still on; it then clears the stop and starts the window (startAfternoonWindow).
export function loadAfternoonRefusal(o: { day: DayRecord | null; now: Date; pause: MiddayPause | null; stop: StopFlag | null; notFlat: NotFlatState | null; positions: number | null; openOrders: number | null }): string | null {
  const times = o.day ? middayTimes(o.day) : null;
  if (!o.day || !times) return "there is no mid-day cycle today";
  if (o.day.status !== "approved" || !o.day.phases.armed) return "today is not approved and armed";
  if (afternoonLoadStart(o.day)) return "the afternoon load window was already started today";
  if (o.now >= times.resumeUntil) return `it is ${centralClock(times.resumeUntil)} or later (\`load afternoon\` is accepted only before then)`;
  if (plainStop(o.stop)) {
    if (!middayFlat(o.day)) return "the mid-day close-out has not finished flat yet";
  } else {
    const go = goRefusal({ hasCycle: true, pause: o.pause, flat: middayFlat(o.day), stop: o.stop });
    if (go) return go;
  }
  if (o.notFlat?.on) return "the account was not flat after the last close-out";
  if (o.positions === null || o.openOrders === null) return "I could not read Alpaca's positions and open orders";
  if (o.positions !== 0) return `Alpaca shows ${o.positions} position(s)`;
  if (o.openOrders !== 0) return `Alpaca shows ${o.openOrders} open order(s)`;
  return null;
}

// A stop flag set by Michael (`stop` or `flatten`), not the daily loss stop.
export function plainStop(stop: StopFlag | null | undefined): boolean {
  return Boolean(stop?.on && !stop.reason.startsWith("daily loss stop"));
}

// Fix of 2026-11-12 (group 2, round 3, and group 2 rounds 1 and 2 of 2026-11-12): a failed afternoon load window's last sentence
// depends on why it failed, and never repeats what the line already says (`why`). Every branch is true in every state that reaches
// it (the list is in the release log):
//  - the daily loss stop: no more trading today (a `resume` is undone within about 5 seconds, goRefusal);
//  - the pause unknown (not readable, or no record): `status`;
//  - past the last entry: no entries are left today;
//  - a plain stop, still paused: `resume`, then `go`; a plain stop, the pause over: `resume` alone;
//  - the pause over: trading has already resumed;
//  - still paused, no stop: `go` resumes a normal afternoon (a pending screen means the account was flat).
export function afternoonFailureTail(stop: StopFlag | null, pause: MiddayPause | null | undefined, why = "", lastEntryPassed = false): string {
  if (stop?.on && stop.reason.startsWith("daily loss stop")) return /daily loss stop/.test(why) ? "There is no more trading today." : "The daily loss stop is in force, so there is no more trading today.";
  if (!pause) return "Send `status` to see what is allowed now.";
  if (lastEntryPassed) return /no entries are left/i.test(why) ? "" : "No entries are left today.";
  const named = /stop flag is on/.test(why);
  if (stop?.on && pause.on) return named ? "Send `resume`, then `go`, for a normal afternoon." : "The stop flag is on: send `resume`, then `go`, for a normal afternoon.";
  if (stop?.on) return named ? "Send `resume` to trade a normal afternoon." : "The stop flag is on: send `resume` to trade a normal afternoon.";
  if (!pause.on) return /already resumed/.test(why) ? "" : "Trading has already resumed.";
  return "Still paused; `go` resumes a normal afternoon.";
}

// Michael's answer 6 of 2026-11-11 (night): `load afternoon` sent while a cancelled screen is still finishing.
// Group 1, round 1 of 2026-11-12 (wording): true whether the earlier screen was cancelled or failed.
export const SCREEN_STILL_FINISHING = "The earlier screen is still finishing. Send `load afternoon` again in a minute or two.";

// Said when a `stop`, `flatten` or `go` cancels a pending afternoon load window.
// Group 1, round 1 of 2026-11-12 (wording): the same cancel once the screen had already switched the live list.
export const SCREEN_CANCELLED_SWITCHED = "The afternoon load window is cancelled: it will not start. Its screen had already switched the live list to the cheap names, so they stay live, and any trading on them uses today's normal limits (not the window's).";
export const SCREEN_CANCELLED = "The afternoon load window is cancelled (its cheap-symbol screen had not finished): it will not start, and the live list stays as it is.";
// Group 2, rounds 1 and 2 of 2026-11-12: what Michael can do next depends on the command that cancelled the window and its result.
// A pending screen means `load afternoon` was accepted (a mid-day cycle, the pause on, flat, no stop), so a `go` can only be refused
// because the daily loss stop came on, the pause ended meanwhile (the automatic resume after a mid-day deploy), or a stop flag was set.
//  - `go` that resumed trading: the pause is over, so the window cannot be started again today (`load afternoon` needs the pause);
//  - the daily loss stop (a refused `go` names it already; after `stop` or `flatten` it is said): no more trading today;
//  - a `go` refused because the pause ended: the same "pause is over" sentence;
//  - a `go` refused for a plain stop, or `stop` or `flatten`: `resume`, then `load afternoon`, or, once its time has passed, that it
//    is no longer accepted today;
//  - any other refusal: `status` (never the advice to send it again).
export function screenCancelledLine(switched: boolean | "switched", after: "go-resumed" | "go-refused" | "stop", o: { lossStop: boolean; why?: string; tooLate?: boolean }): string {
  const base = switched === "switched" ? SCREEN_CANCELLED_SWITCHED : SCREEN_CANCELLED;
  const pauseOver = "The mid-day pause is over, so the window cannot be started again today.";
  const tryAgain = o.tooLate ? "`load afternoon` is no longer accepted today (its time has passed)." : "To try again, send `resume`, then `load afternoon` (accepted until 1:30 PM CT, or the last entry if earlier).";
  const why = o.why ?? "";
  let next: string;
  if (after === "go-resumed") next = pauseOver;
  else if (o.lossStop) next = /daily loss stop/.test(why) ? "There is no more trading today." : "The daily loss stop is in force, so there is no more trading today.";
  else if (after === "stop") next = tryAgain;
  else if (/already resumed|not paused/.test(why)) next = pauseOver;
  else if (/stop flag is on/.test(why)) next = tryAgain;
  else next = "Send `status` to see what is allowed now.";
  return `${base} ${next}`;
}

// The `status` line for the afternoon load window (group 2 review, round 1).
function afternoonStatusLine(day: DayRecord, now: Date): string {
  const w = afternoonLoadWindow(day)!;
  if (inAfternoonLoad(day, now)) return `Afternoon load window: on since ${centralClock(w.start)}, until ${centralClock(w.end)} (then a close-out to flat, entries paused): 1 share churn, at most ${LOAD_MAX_POSITION_USD} dollars a position, up to ${MAX_TRADES_PER_MINUTE_LOAD_DAY} orders a minute`;
  if (now < w.start) return "";
  const after = day.phases[AFTERNOON_FLAT_PHASE] ? "; its close-out finished flat, entries paused" : "; its close-out is still selling, entries paused";
  return `Afternoon load window: ran from ${centralClock(w.start)} to ${centralClock(w.end)}${after}`;
}

const LOAD_AFTERNOON_HELP = "`load afternoon` while flat, during the mid-day pause or (on a load day) after `stop` or `flatten`, which it clears, before 1:30 PM CT: a load window of at most 30 minutes (1 share churn, 75 dollars a position, up to 150 orders a minute even above today's approved limit), then entries pause and a close-out sells to flat. On a normal morning the cheap-symbol screen runs first (a few minutes; `stop`, `flatten` or `go` meanwhile cancels it: after a `go` that resumes trading it cannot be started again today, after `stop` or `flatten` send `resume`, then `load afternoon`).";
const LOAD_AFTERNOON_OFF_HELP = "`load afternoon` is switched off in this release while a fix to it is finished; it changes nothing.";
export const LOAD_AFTERNOON_OFF = "`load afternoon` is switched off in this release while a fix to it is finished, so nothing changed. `go` still resumes a normal afternoon.";

const HELP = [
  "**Commands** (only you, only here)",
  "`status` what the stack is doing",
  "`stop` no new entries; unfilled entries are cancelled; positions keep their protective stops and are closed at the end of the day",
  "`resume` clears the stop (approved limits are still needed)",
  "`flatten` stop, then sell everything now",
  "`limits` today's limits",
  "`approve` or `approve cap` accept the next trading day's limits; `position 1500`, `loss 150`, `trades 20`, `cap 2` change one (`trades` is orders a minute, 1 to 100, or up to 150 on a load day: send `load on` first, or in the same message). Until the `Armed` message 5 minutes before the open you can change any limit; after it only tighten (lower) a limit, until the evening post.",
  "`go` end the mid-day pause now (the pause starts at 10:30 AM CT; `go` works once the mid-day close-out is flat, with or without a deploy). `hold` no automatic resume after a mid-day deploy today (the automatic resume ends at 1:30 PM CT, or at the last entry if earlier; `go` still resumes).",
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
  // How many messages the last command read returned (the worker treats a read of Discord's maximum, 50, as possibly incomplete).
  lastReadCount = 0;

  async poll(): Promise<number> {
    const cursor = await this.d.store.getControl<{ id: string }>(CONTROL_COMMAND_CURSOR);
    if (!cursor) {
      // First run: start after whatever is already there, never act on history.
      const latest = await this.d.bot.latestCommandMessageId();
      await this.d.store.setControl(CONTROL_COMMAND_CURSOR, { id: latest ?? "0" });
      return 0;
    }
    const messages = await this.d.bot.commandMessagesAfter(cursor.id);
    this.lastReadCount = messages.length;
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
        await this.say([HELP, this.d.loadAfternoonEnabled ? LOAD_AFTERNOON_HELP : LOAD_AFTERNOON_OFF_HELP].join("\n"));
        return;
      case "unknown":
        await this.say(`I did not understand the line "${cmd.text}". Nothing was done for it. Type \`help\` for the list.`);
        return;
      case "stop": {
        // Fix of 2026-11-12 (group 2, round 3): the pending afternoon window is cancelled before the stop is saved, so a screen finishing
        // during the save is already cancelled (it says nothing) and this reply keeps its cancel line.
        const screenCancelled = this.d.cancelAfternoonScreen?.(etDate(now)) ?? false;
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
        if (screenCancelled) await this.say(screenCancelledLine(screenCancelled, "stop", { lossStop: (await this.lossStillPast(now)) !== null, tooLate: await this.afternoonTooLate(now) }));
        return;
      }
      case "resume": {
        await this.setStop(false, "owner command (resume)", now);
        // Wording only (the 10:31 AM note of 2026-11-03): if today's loss is still past the limit, the daily loss stop puts the stop
        // back on at its next check, so the reply says so. The resume itself is done above and is not changed by this look.
        const past = await this.lossStillPast(now);
        await this.say(past ? `Stop cleared, but today's loss (${past.loss.toFixed(2)} dollars) is still past the ${past.limit} dollar daily limit, so the daily loss stop will put the stop back on within about 5 seconds, and it stays on until the next trading day.` : await this.resumeReply(now));
        return;
      }
      case "flatten": {
        const screenCancelled = this.d.cancelAfternoonScreen?.(etDate(now)) ?? false; // before the stop's save, as for `stop`
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
        if (screenCancelled) await this.say(screenCancelledLine(screenCancelled, "stop", { lossStop: (await this.lossStillPast(now)) !== null, tooLate: await this.afternoonTooLate(now) }));
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
      case "go": {
        const screenCancelled = this.d.cancelAfternoonScreen?.(etDate(now)) ?? false;
        // The mid-day cycle (Michael, 2026-11-09): end the pause, only when the mid-day close-out is flat and no stop is on.
        const date = etDate(now);
        const day = await this.d.store.getDay(date);
        const pause = await readPause(this.d.store, date);
        const stop = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
        // Michael, 2026-11-12 (afternoon): never while the close-out after the afternoon load window is still selling.
        const why = day && afternoonCloseoutPending(day, now) ? "the close-out after the afternoon load window has not finished flat yet" : goRefusal({ hasCycle: Boolean(day && middayTimes(day)), pause, flat: Boolean(day && middayFlat(day)), stop });
        if (why) {
          await this.say(`Not resumed: ${why}.`);
          if (screenCancelled) await this.say(screenCancelledLine(screenCancelled, "go-refused", { lossStop: Boolean(stop?.on && stop.reason.startsWith("daily loss stop")), why, tooLate: await this.afternoonTooLate(now) }));
          return;
        }
        await updatePause(this.d.store, date, { on: false, resumedAt: now.toISOString(), resumedBy: "go" });
        const lastEntryAt = middayTimes(day!)!.lastEntryAt;
        await this.say(now >= lastEntryAt ? `The mid-day pause is over, but no entries are left today (last entry ${centralClock(lastEntryAt)}).` : "Resumed: the mid-day pause is over. Same limits as this morning; the loss stop counts from the open.");
        if (screenCancelled) await this.say(screenCancelledLine(screenCancelled, "go-resumed", { lossStop: false }));
        return;
      }
      case "loadAfternoon": {
        if (!this.d.loadAfternoonEnabled) {
          await this.say(LOAD_AFTERNOON_OFF);
          return;
        }
        const date = etDate(now);
        const facts = await this.afternoonFacts(date);
        const why = loadAfternoonRefusal({ ...facts, now });
        if (why) {
          await this.say(`Not started: ${why}.`);
          return;
        }
        // Michael's ruling of 2026-11-12 (afternoon) covers a stop on a load day: the cheap list is already live. On a normal morning
        // the screen switches the list only while paused with no stop, so this release refuses there.
        if (plainStop(facts.stop) && !isLoadDay(facts.day)) {
          await this.say("Not started: with the stop flag on, `load afternoon` works in this release only on a load day (its cheap list is already live). Send `resume` first if you want trading.");
          return;
        }
        // A load day already has the cheap list live: the window starts now (the facts above were just read, Alpaca included).
        if (isLoadDay(facts.day)) {
          await this.startAfternoonWindow(date, { switched: false, list: facts.day!.liveList ?? [] }, facts, now);
          return;
        }
        if (!this.d.afternoonScreen) {
          await this.say("Not started: this part of the stack cannot switch the live list.");
          return;
        }
        const started = this.d.afternoonScreen(date);
        await this.say(
          started === "finishing"
            ? SCREEN_STILL_FINISHING
            : started
              ? "Running the cheap-symbol screen for the afternoon load window now; it can take a few minutes. When it is done I check again that the account is flat and paused, then start the window and resume trading. `stop`, `flatten` or `go` before then cancels the window."
              : "Not started yet: the cheap-symbol screen for the afternoon load window is already running.",
        );
        return;
      }
      case "hold": {
        // No automatic resume after a mid-day deploy today. It never pauses trading that has already resumed (`stop` does that).
        const date = etDate(now);
        const day = await this.d.store.getDay(date);
        if (!day || !middayTimes(day)) {
          await this.say("There is no mid-day cycle today, so `hold` changes nothing.");
          return;
        }
        const pause = await readPause(this.d.store, date);
        if (pause?.resumedAt && !pause.on) {
          await this.say("Trading has already resumed today, so `hold` changes nothing. Send `stop` to halt new entries.");
          return;
        }
        await setHold(this.d.store, date, now.toISOString());
        const times = middayTimes(day)!;
        const stop = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
        // Wording only: after a daily loss stop, is the loss still past the limit? Before the pause, `go` cannot be used yet.
        const equity = stop?.on && stop.reason.startsWith("daily loss stop") ? ((await this.d.broker.getAccount().catch(() => null))?.equity ?? null) : null;
        const blocked = blockedNext({ stop, now, lastEntryAt: times.lastEntryAt, lossPast: lossPast(day, equity), pauseAt: pause?.on ? null : times.pauseAt });
        if (blocked) await this.say(`Hold noted. ${blocked}`);
        else if (pause?.on) await this.say(`Hold: after a mid-day deploy today I stay paused. Send \`go\` to trade until ${centralClock(times.lastEntryAt)} (the last entry).`);
        else await this.say("Hold: after today's mid-day deploy I will stay paused until you send `go`.");
        return;
      }
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
          lowered = ` \`trades\` lowered from ${latest.limits.maxTradesPerMinute} to ${MAX_TRADES_PER_MINUTE} (above ${MAX_TRADES_PER_MINUTE}, up to ${MAX_TRADES_PER_MINUTE_LOAD_DAY}, is for load days only).`;
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

  // Wording only (group 2, round 2 of 2026-11-12): is it past the time `load afternoon` is accepted today (1:30 PM CT, or the last
  // entry if earlier)? Reads only; false if it cannot tell.
  private async afternoonTooLate(now: Date): Promise<boolean> {
    try {
      const day = await this.d.store.getDay(etDate(now));
      const times = day ? middayTimes(day) : null;
      return times !== null && now >= times.resumeUntil;
    } catch {
      return false;
    }
  }

  // For the `resume` reply only (fix of 2026-11-11: at 1:31 PM it said "Entries still need the day's limits approved" on an approved,
  // armed day, and entries restarted at once). Says what happens next, following the order gate's own early checks in the same order
  // (gate.ts: armed, not flat, approved, the mid-day pause, the load window's start, the last entry). Wording only: it reads, never
  // writes, never throws, and gives up after 3 seconds (then a neutral reply is used).
  private async resumeReply(now: Date): Promise<string> {
    const neutral = "Stop cleared. Entries go ahead only on an approved and armed day, outside the mid-day pause.";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = (async (): Promise<string> => {
      const day = await this.d.store.getDay(etDate(now));
      const phase = sessionPhase(day, now);
      if (!day || phase === "no_session" || phase === "after_close") return "Stop cleared. No session is running now, so nothing trades until the next one (on its approved limits).";
      if (day.status !== "approved") return "Stop cleared. Entries still need the day's limits approved.";
      const notFlat = await this.d.store.getControl<NotFlatState>(CONTROL_NOT_FLAT);
      if (notFlat?.on) return "Stop cleared, but the account was not flat after the last close-out, so there are no entries until those positions are sold.";
      if (phase === "before_open") {
        const w = isLoadDay(day) ? loadWindow(day) : null;
        return w ? `Stop cleared. Today's limits are approved; it is a load day, so entries start at ${centralClock(w.start)}.` : "Stop cleared. Today's limits are approved, so entries can start at the open.";
      }
      if (!day.phases.armed) return day.phases.rearm ? "Stop cleared. The borrowing cap is being set again at Alpaca, so entries wait until that is confirmed (usually seconds)." : "Stop cleared. Today's limits are approved, but the day is not armed yet, so entries wait for that.";
      const lastEntryAt = middayTimes(day)?.lastEntryAt ?? addMinutes(day.closeAt!, -MIN_MINUTES_BEFORE_CLOSE);
      if (now >= lastEntryAt) return `Stop cleared. Today's last entry time (${centralClock(lastEntryAt)}) has passed, so there are no more entries today.`;
      const pause = middayTimes(day) ? await readPause(this.d.store, day.tradeDate) : null;
      if (pause?.on) return "Stop cleared. Today's limits are approved, but entries stay paused for the mid-day cycle until you send `go`.";
      if (beforeLoadWindow(day, now)) return `Stop cleared. It is a load day, so entries start at ${centralClock(loadWindow(day)!.start)}.`;
      return "Stop cleared. Entries resume now under today's approved limits.";
    })().catch(() => neutral);
    try {
      return await Promise.race([look, new Promise<string>((r) => (timer = setTimeout(() => r(neutral), 3_000)))]);
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

  // What `load afternoon` is decided on: the day, the pause, the stop and not-flat flags, and Alpaca's positions and open orders
  // (null when Alpaca cannot be read: refused, fail closed).
  private async afternoonFacts(date: string) {
    const day = await this.d.store.getDay(date);
    const pause = await readPause(this.d.store, date);
    const stop = await this.d.store.getControl<StopFlag>(CONTROL_STOP);
    const notFlat = await this.d.store.getControl<NotFlatState>(CONTROL_NOT_FLAT);
    let positions: number | null = null;
    let openOrders: number | null = null;
    try {
      positions = (await this.d.broker.listPositions()).length;
      openOrders = (await this.d.broker.listOrders("open")).length;
    } catch {
      positions = null;
      openOrders = null;
    }
    return { day, pause, stop, notFlat, positions, openOrders };
  }

  // Writes the window's start and ends the pause, then says so.
  private async startAfternoonWindow(date: string, r: { switched: boolean; list: string[] }, facts: Awaited<ReturnType<CommandProcessor["afternoonFacts"]>>, at: Date): Promise<void> {
    // Michael's ruling of 2026-11-12 (afternoon): accepted with his own stop on (flat, checked by loadAfternoonRefusal), it clears the
    // stop with the same write `resume` makes. The window's phase is written first, so a failed clear leaves entries stopped (safe).
    const clearsStop = plainStop(facts.stop);
    await setPhase(this.d.store, date, LOAD_AFTERNOON_PHASE, at.toISOString());
    await updatePause(this.d.store, date, { on: false, resumedAt: at.toISOString(), resumedBy: "load afternoon" });
    if (clearsStop) await this.setStop(false, "owner command (load afternoon)", at);
    this.d.log?.("load_afternoon", { date, switched: r.switched, symbols: r.list.length, clearedStop: clearsStop });
    const day = facts.day!;
    const end = afternoonLoadWindow({ ...day, phases: { ...day.phases, [LOAD_AFTERNOON_PHASE]: at.toISOString() } })?.end ?? middayTimes(day)!.lastEntryAt;
    const closeoutAt = day.closeAt ? centralClock(addMinutes(day.closeAt, -CLOSEOUT_MINUTES_BEFORE_CLOSE)) : "the usual time";
    await this.say(
      `Afternoon load window on until ${centralClock(end)}: ${loadWindowRules()}; at most ${LOAD_MAX_POSITION_USD} dollars a position and up to ${MAX_TRADES_PER_MINUTE_LOAD_DAY} orders a minute (your ruling, this window only). ${r.switched ? `The live list is now ${r.list.length} cheap names (posted in trading). ` : ""}${clearsStop ? (facts.pause?.on ? "Stop cleared, and the mid-day pause is over: trading resumed. " : "Stop cleared: trading resumed. ") : "Resumed: the mid-day pause is over. "}At ${centralClock(end)} entries pause and a close-out sells to flat; trading does not resume on its own after it. The loss stop counts from the open; the regular close-out runs at ${closeoutAt}.`,
    );
  }

  // `load afternoon` on a normal morning, once the screen and the feed switch are done: called by the worker in a pass that has
  // already read commands since the screen finished. Every condition is read again (Alpaca included, fail closed) just before the
  // window starts.
  async finishAfternoonLoad(date: string, r: { switched: boolean; list: string[] }): Promise<void> {
    // A second guard (group 1's quick review of option B): nothing here runs unless `load afternoon` is switched on.
    if (!this.d.loadAfternoonEnabled) return;
    const at = this.d.now();
    if (etDate(at) !== date) return;
    const facts = await this.afternoonFacts(date);
    const why = loadAfternoonRefusal({ ...facts, now: at });
    if (why) {
      this.d.log?.("load_afternoon_refused", { date, why });
      const listNote = r.switched ? " The live list was switched to the cheap names while paused." : "";
      // Fix of 2026-11-12: the closing sentence depends on the reason (a stop on, or trading already resumed).
      const times = facts.day ? middayTimes(facts.day) : null;
      const lastEntryPassed = times !== null && at >= times.lastEntryAt;
      const tail = facts.stop?.on || (facts.pause && !facts.pause.on) || lastEntryPassed ? afternoonFailureTail(facts.stop, facts.pause, why, lastEntryPassed) : r.switched ? "If you send `go`, the normal placeholder trades on them." : "";
      await this.say(`Afternoon load window not started: ${why}.${listNote}${tail ? ` ${tail}` : ""}`);
      return;
    }
    await this.startAfternoonWindow(date, r, facts, at);
  }

  // The mid-day cycle's status line (empty on a day without one).
  private async middayStatus(day: DayRecord | null): Promise<string> {
    if (!day || !middayTimes(day)) return "";
    const pause = await readPause(this.d.store, day.tradeDate).catch(() => null);
    const hold = (await readHold(this.d.store, day.tradeDate).catch(() => false)) ? "; `hold` is set" : "";
    if (pause?.on) return `Mid-day cycle: entries paused since ${pause.since ? centralClock(new Date(pause.since)) : "?"} (${middayFlat(day) ? "flat" : "mid-day close-out still selling"})${hold}`;
    if (pause?.resumedAt) return `Mid-day cycle: resumed at ${centralClock(new Date(pause.resumedAt))} (${resumedByText(pause.resumedBy)})`;
    return `Mid-day cycle: pause at ${centralClock(middayTimes(day)!.pauseAt)}${hold}`;
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
      day && afternoonLoadWindow(day) ? afternoonStatusLine(day, now) : "",
      day && day.status === "pending" ? limitLines(day) : "",
      `Live list: ${day?.liveList ? day.liveList.join(" ") || "(empty)" : "not built yet"}`,
      `Entries today: ${orders.filter((o) => o.status !== "failed" && o.status !== "rejected").length}; positions now: ${positions.length}`,
      `Equity: ${account.equity.toFixed(2)} (day start ${day?.dayStartEquity?.toFixed(2) ?? "?"})`,
      await this.middayStatus(day),
      ...((await this.d.extraStatus?.()) ?? []),
    ];
    return lines.filter(Boolean).join("\n");
  }
}
