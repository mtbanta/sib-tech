// The morning limits flow. Before each open the stack posts its suggested limits to the command channel.
// Michael approves or overrules each one there. If any is undecided when the market opens, the stack does
// not trade that day. This file builds the day record, the request message, and the decisions (pure).
import type { Broker } from "./broker.ts";
import { LIMIT_NAMES, SUGGESTED_LIMITS, applyOverride, describeLimits, type LimitName, type Limits } from "./limits.ts";
import { setPhase, type DayRecord, type Store } from "./store.ts";
import { NOT_ADVICE } from "./discord.ts";
import { centralClock, etInstant } from "./time.ts";

export interface MorningDeps {
  store: Store;
  broker: Broker;
}

// Builds and stores the day's record: calendar times, the starting equity, the suggested limits.
export async function ensureDay(deps: MorningDeps, date: string): Promise<DayRecord> {
  const existing = await deps.store.getDay(date);
  if (existing) return existing;
  const calendar = await deps.broker.getCalendar(date, date);
  const session = calendar.find((c) => c.date === date);
  const account = await deps.broker.getAccount();
  const base = { tradeDate: date, suggested: SUGGESTED_LIMITS, limits: SUGGESTED_LIMITS, decided: {}, liveList: null, phases: {}, dayStartEquity: account.lastEquity > 0 ? account.lastEquity : account.equity };
  if (!session) {
    return deps.store.createDay({ ...base, isTradingDay: false, openAt: null, closeAt: null, status: "not_trading_day" });
  }
  return deps.store.createDay({ ...base, isTradingDay: true, openAt: etInstant(date, session.open), closeAt: etInstant(date, session.close), status: "pending" });
}

export function limitLines(day: DayRecord): string {
  const l = day.limits;
  const mark = (n: LimitName) => (day.decided[n] ? "decided" : "waiting for you");
  return [
    `1. position: largest single position ${l.maxPositionUsd} dollars (${mark("position")})`,
    `2. loss: daily loss stop ${l.dailyLossStopUsd} dollars (${mark("loss")})`,
    `3. trades: entries a day ${l.maxTradesPerDay} (${mark("trades")})`,
    `4. cap: borrowing cap ${l.borrowingCap}, where 1 means no borrowing (${mark("cap")})`,
  ].join("\n");
}

export function formatLimitsRequest(day: DayRecord, reminder = false): string {
  const open = day.openAt ? centralClock(day.openAt) : "?";
  return [
    reminder ? `**Reminder: limits for today are not all decided.** The market opens at ${open}.` : `**Good morning. Suggested limits for today (market opens at ${open}).**`,
    limitLines(day),
    "",
    "Reply here before the open: `approve` accepts every limit as shown, `approve cap` accepts one, or change one with `position 1500`, `loss 150`, `trades 5`, `cap 2` (that also counts as your decision).",
    "**If any limit is still undecided at the open, I will not trade today.**",
    NOT_ADVICE,
  ].join("\n");
}

export type Command =
  | { kind: "help" }
  | { kind: "status" }
  | { kind: "stop" }
  | { kind: "resume" }
  | { kind: "flatten" }
  | { kind: "limits" }
  | { kind: "approve"; name: LimitName | "all" }
  | { kind: "set"; name: LimitName; value: string }
  | { kind: "unknown"; text: string };

export function parseCommand(content: string): Command {
  const text = content.trim().replace(/^[/!]/, "").toLowerCase();
  const [word = "", arg1, arg2] = text.split(/\s+/);
  switch (word) {
    case "help":
    case "?":
      return { kind: "help" };
    case "status":
      return { kind: "status" };
    case "stop":
      return { kind: "stop" };
    case "resume":
      return { kind: "resume" };
    case "flatten":
      return { kind: "flatten" };
    case "limits":
      return { kind: "limits" };
    case "approve": {
      if (arg1 === undefined || arg1 === "all") return { kind: "approve", name: "all" };
      return (LIMIT_NAMES as readonly string[]).includes(arg1) ? { kind: "approve", name: arg1 as LimitName } : { kind: "unknown", text: content.slice(0, 40) };
    }
    case "position":
    case "loss":
    case "trades":
    case "cap":
      return arg1 !== undefined && arg2 === undefined ? { kind: "set", name: word, value: arg1 } : { kind: "unknown", text: content.slice(0, 40) };
    default:
      return { kind: "unknown", text: content.slice(0, 40) };
  }
}

export type Decision = { ok: true; patch: Pick<DayRecord, "limits" | "decided" | "status">; reply: string } | { ok: false; reply: string };

// Applies an approve or overrule to the day. Pure: no clock, no network. `messageAt` is when Michael wrote it.
export function decideLimits(day: DayRecord, cmd: Extract<Command, { kind: "approve" | "set" }>, equity: number, now: Date, messageAt: Date): Decision {
  if (!day.isTradingDay) return { ok: false, reply: "Today is not a trading day, so there is nothing to approve." };
  if (day.status === "lapsed") return { ok: false, reply: "Too late: the market opened with limits undecided, so there is no trading today." };
  if (!day.openAt || now >= day.openAt) return { ok: false, reply: "Too late: the market is open and today's limits are fixed." };
  // A reply written before this morning's request cannot approve it (this guards a restart that re-reads old messages).
  const asked = day.phases.morning ? new Date(day.phases.morning) : null;
  if (!asked || messageAt < asked) return { ok: false, reply: "That message is older than this morning's request, so I ignored it." };

  let limits: Limits = day.limits;
  const decided = { ...day.decided };
  if (cmd.kind === "set") {
    const r = applyOverride(limits, cmd.name, cmd.value, equity);
    if ("error" in r) return { ok: false, reply: `Not changed: ${r.error}.` };
    limits = r.limits;
    decided[cmd.name] = true;
  } else if (cmd.name === "all") {
    for (const n of LIMIT_NAMES) decided[n] = true;
  } else {
    decided[cmd.name] = true;
  }
  const all = LIMIT_NAMES.every((n) => decided[n]);
  const status = all ? "approved" : "pending";
  const next = { ...day, limits, decided, status } as DayRecord;
  const reply = all ? `All four limits decided. Trading is allowed today within: ${describeLimits(limits)}.` : `Noted.\n${limitLines(next)}`;
  return { ok: true, patch: { limits, decided, status }, reply };
}

// ---- the steps the scheduler runs ----

export interface MorningSteps extends MorningDeps {
  say: (channel: "commands" | "trading" | "alerts", text: string) => Promise<boolean>;
  now: () => Date;
}

// Posts this morning's request, once. The phase time is stored so a restart does not post it twice, and it
// is also the moment before which a reply cannot count as an approval.
export async function postMorningRequest(steps: MorningSteps, day: DayRecord): Promise<DayRecord> {
  if (!day.isTradingDay || day.phases.morning) return day;
  const posted = await steps.say("commands", formatLimitsRequest(day));
  if (!posted) throw new Error("Could not post the morning request to Discord");
  return setPhase(steps.store, day.tradeDate, "morning", steps.now().toISOString());
}

// One reminder, ten minutes before the open, if anything is still undecided.
export async function postReminderIfNeeded(steps: MorningSteps, day: DayRecord): Promise<DayRecord> {
  const t = steps.now();
  if (!day.isTradingDay || day.status !== "pending" || day.phases.reminder || !day.openAt) return day;
  if (t < new Date(day.openAt.getTime() - 10 * 60_000) || t >= day.openAt) return day;
  if (!(await steps.say("commands", formatLimitsRequest(day, true)))) return day; // not posted: try again next tick
  return setPhase(steps.store, day.tradeDate, "reminder", t.toISOString());
}

// At the open, a day that is not fully approved becomes lapsed: no trading, and Michael is told.
export async function lapseIfUndecided(steps: MorningSteps, day: DayRecord): Promise<DayRecord> {
  if (!day.isTradingDay || day.status !== "pending" || !day.openAt || steps.now() < day.openAt) return day;
  const updated = await steps.store.updateDay(day.tradeDate, { status: "lapsed" });
  const told = await steps.say("commands", `The market is open and today's limits were not all decided, so **I will not trade today**. Nothing is open. ${NOT_ADVICE}`);
  await steps.store.addEvent("warn", "day_lapsed", { date: day.tradeDate, told });
  return updated;
}
