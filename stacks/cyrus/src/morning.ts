// The limits flow. After each close the stack posts the NEXT trading day's suggested limits and a checklist to
// the command channel. Michael approves or overrules each limit there that evening, and can review and change
// them again before the open (the stack posts a review at 60 minutes before the open and a reminder at 10).
// If any limit is undecided when the market opens, the stack does not trade that day. The borrowing cap is
// set at Alpaca, and the day's starting equity read, only at 5 minutes before the open ("arming"), so the
// account is never left at a raised cap overnight. This file builds the day record, the messages and the
// decisions (pure where it can be).
import type { Broker } from "./broker.ts";
import { LIMIT_NAMES, SUGGESTED_LIMITS, applyOverride, describeLimits, type LimitName, type Limits } from "./limits.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP, setPhase, type DayRecord, type NotFlatState, type StopFlag, type Store } from "./store.ts";
import { NOT_ADVICE } from "./discord.ts";
import { addMinutes, centralClock, dayWord, etDate, etInstant, sessionPhase } from "./time.ts";

export interface MorningDeps {
  store: Store;
  broker: Broker;
  // Optional so a caller that only needs the record can leave it out. When given, a day first seen after its
  // own open is created as already decided (see ensureDay).
  now?: () => Date;
}

// Builds and stores a day's record: calendar times, the suggested limits. Works for a future date, which is how
// the evening request is made. A day first seen after the close is created as lapsed with its close-out and
// summary marked skipped, so a start-up after hours posts nothing about a day that never had a request.
export async function ensureDay(deps: MorningDeps, date: string): Promise<DayRecord> {
  const existing = await deps.store.getDay(date);
  if (existing) return existing;
  const calendar = await deps.broker.getCalendar(date, date);
  const session = calendar.find((c) => c.date === date);
  const account = await deps.broker.getAccount();
  const base = { tradeDate: date, suggested: SUGGESTED_LIMITS, limits: SUGGESTED_LIMITS, decided: {}, liveList: null, phases: {} as Record<string, string>, dayStartEquity: account.lastEquity > 0 ? account.lastEquity : account.equity };
  if (!session) {
    return deps.store.createDay({ ...base, isTradingDay: false, openAt: null, closeAt: null, status: "not_trading_day" });
  }
  const openAt = etInstant(date, session.open);
  const closeAt = etInstant(date, session.close);
  const now = deps.now?.();
  if (now && now >= closeAt) {
    return deps.store.createDay({ ...base, phases: { closeout: "skipped", summary: "skipped", request: "skipped" }, isTradingDay: true, openAt, closeAt, status: "lapsed" });
  }
  return deps.store.createDay({ ...base, isTradingDay: true, openAt, closeAt, status: "pending" });
}

export interface Session {
  date: string;
  openAt: Date;
  closeAt: Date;
}

// Finds the next trading session that has not opened yet, from Alpaca's calendar (so holidays and half days
// come from the calendar, never from "tomorrow"). Looks 14 days ahead. Cached until that session opens.
export class NextSessionFinder {
  private readonly broker: Pick<Broker, "getCalendar">;
  private cached: Session | null = null;
  constructor(broker: Pick<Broker, "getCalendar">) {
    this.broker = broker;
  }
  async next(now: Date): Promise<Session | null> {
    if (this.cached && this.cached.openAt > now) return this.cached;
    const calendar = await this.broker.getCalendar(etDate(now), etDate(addMinutes(now, 14 * 24 * 60)));
    const sessions = calendar
      .map((c) => ({ date: c.date, openAt: etInstant(c.date, c.open), closeAt: etInstant(c.date, c.close) }))
      .filter((s) => s.openAt > now)
      .sort((a, b) => a.openAt.getTime() - b.openAt.getTime());
    this.cached = sessions[0] ?? null;
    return this.cached;
  }
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

// What Michael should look at before approving: state the stack can read right now. A line that cannot be read
// says so instead of being left out.
export async function buildChecklist(deps: { store: Store; broker: Broker; feed: string }): Promise<string[]> {
  const lines: string[] = [];
  try {
    const flag = await deps.store.getControl<StopFlag>(CONTROL_STOP);
    lines.push(flag?.on ? `- Stop flag is ON (${flag.reason}). Type \`resume\` or there will be no entries.` : "- Stop flag: off.");
  } catch {
    lines.push("- Stop flag: could not be read (database problem).");
  }
  try {
    const notFlat = await deps.store.getControl<NotFlatState>(CONTROL_NOT_FLAT);
    const positions = await deps.broker.listPositions();
    if (positions.length > 0) lines.push(`- Account is HOLDING ${positions.map((p) => p.symbol).join(", ")}. I will sell it at the open and make no entries until the account is flat.`);
    else lines.push(notFlat?.on ? "- The last close-out ended not flat; the account looks flat now and I will confirm it shortly." : "- Account: flat, no open positions.");
  } catch {
    lines.push("- Account positions: could not be read (Alpaca or database problem).");
  }
  try {
    const config = await deps.broker.getAccountConfig();
    lines.push(`- Borrowing cap at Alpaca right now: ${config.maxMarginMultiplier}${config.noShorting ? ", long only" : ", SHORTING IS ON (I switch long only on at 5 minutes before the open)"}. The approved cap is set at Alpaca 5 minutes before the open, not before.`);
  } catch {
    lines.push("- Alpaca account settings: could not be read.");
  }
  lines.push(`- Price feed: ${deps.feed}${deps.feed === "iex" ? " (one exchange only, so prices are rough; the strategy is a placeholder to test the plumbing)" : ""}.`);
  return lines;
}

export type RequestKind = "evening" | "morning" | "reminder";

export function formatLimitsRequest(day: DayRecord, kind: RequestKind = "evening", checklist: string[] = []): string {
  const open = day.openAt ? centralClock(day.openAt) : "?";
  const head =
    kind === "reminder"
      ? `**Reminder: limits for ${dayWord(day.tradeDate)} are not all decided.** The market opens at ${open}.`
      : kind === "morning"
        ? `**Good morning. Limits for today, ${dayWord(day.tradeDate)} (market opens at ${open}): ${day.status === "approved" ? "all four are decided" : "NOT all decided yet"}.**`
        : `**Suggested limits for ${dayWord(day.tradeDate)} (market opens at ${open}).** Nothing is approved until you reply.`;
  return [
    head,
    limitLines(day),
    ...(checklist.length > 0 ? ["", "**Checklist**", ...checklist] : []),
    "",
    "Reply here: `approve` accepts every limit as shown, `approve cap` accepts one, or change one with `position 1500`, `loss 150`, `trades 5`, `cap 2` (that also counts as your decision). You can change any of them again until the open.",
    `**If any limit is still undecided at the open, I will not trade that day.**`,
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

// Applies an approve or overrule to a day. Pure: no clock, no network. `messageAt` is when Michael wrote it.
// Allowed any time before that day's open, including again after the day is already approved.
export function decideLimits(day: DayRecord, cmd: Extract<Command, { kind: "approve" | "set" }>, equity: number, now: Date, messageAt: Date): Decision {
  if (!day.isTradingDay) return { ok: false, reply: "That day is not a trading day, so there is nothing to approve." };
  if (day.status === "lapsed") return { ok: false, reply: `Too late: ${dayWord(day.tradeDate)} opened with limits undecided, so there is no trading that day.` };
  if (!day.openAt || now >= day.openAt) return { ok: false, reply: `Too late: ${dayWord(day.tradeDate)} has already opened and its limits are fixed.` };
  // A reply written before the request was posted cannot approve it (this guards a restart that re-reads old messages).
  const asked = day.phases.request && day.phases.request !== "skipped" ? new Date(day.phases.request) : null;
  if (!asked || messageAt < asked) return { ok: false, reply: "That message is older than the request for that day, so I ignored it." };

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
  const reply = all
    ? `All four limits decided for ${dayWord(day.tradeDate)}. Trading is allowed that day within: ${describeLimits(limits)}. You can still change any until the open.`
    : `Noted.\n${limitLines(next)}`;
  return { ok: true, patch: { limits, decided, status }, reply };
}

// ---- the steps the scheduler runs ----

export interface MorningSteps extends MorningDeps {
  say: (channel: "commands" | "trading" | "alerts", text: string) => Promise<boolean>;
  now: () => Date;
  feed: string;
}

// Posts the request for a day, once, as soon as the scheduler decides it is time (after the close, or at any
// quiet hour if it was missed). The phase time is stored so a restart does not post it twice, and it is the
// moment before which a reply cannot count as an approval.
export async function postLimitsRequest(steps: MorningSteps, day: DayRecord): Promise<DayRecord> {
  if (!day.isTradingDay || day.phases.request || day.status === "lapsed") return day;
  const checklist = await buildChecklist({ store: steps.store, broker: steps.broker, feed: steps.feed });
  const posted = await steps.say("commands", formatLimitsRequest(day, "evening", checklist));
  if (!posted) throw new Error("Could not post the limits request to Discord");
  return setPhase(steps.store, day.tradeDate, "request", steps.now().toISOString());
}

// At 60 minutes before the open: the day's limits as they stand and the checklist again, so Michael can review
// and change them once more. Posted once, only if the request went out earlier.
export async function postMorningReview(steps: MorningSteps, day: DayRecord): Promise<DayRecord> {
  const t = steps.now();
  if (!day.isTradingDay || !day.openAt || !day.phases.request || day.phases.morning || day.status === "lapsed") return day;
  if (t < addMinutes(day.openAt, -60) || t >= day.openAt) return day;
  // A request that itself went out inside this window (the worker was down overnight) already is the review.
  if (new Date(day.phases.request!) >= addMinutes(day.openAt, -60)) return setPhase(steps.store, day.tradeDate, "morning", "skipped");
  const checklist = await buildChecklist({ store: steps.store, broker: steps.broker, feed: steps.feed });
  if (!(await steps.say("commands", formatLimitsRequest(day, "morning", checklist)))) return day; // not posted: try again next tick
  return setPhase(steps.store, day.tradeDate, "morning", t.toISOString());
}

// One reminder, ten minutes before the open, if anything is still undecided.
export async function postReminderIfNeeded(steps: MorningSteps, day: DayRecord): Promise<DayRecord> {
  const t = steps.now();
  if (!day.isTradingDay || day.status !== "pending" || day.phases.reminder || !day.openAt) return day;
  if (t < addMinutes(day.openAt, -10) || t >= day.openAt) return day;
  if (!(await steps.say("commands", formatLimitsRequest(day, "reminder")))) return day; // not posted: try again next tick
  return setPhase(steps.store, day.tradeDate, "reminder", t.toISOString());
}

// At the open, a day that is not fully approved becomes lapsed: no trading. Michael is told only if the session
// is actually on; a day first seen after the close lapses quietly (ensureDay already created it that way).
export async function lapseIfUndecided(steps: MorningSteps, day: DayRecord): Promise<DayRecord> {
  const phase = sessionPhase(day, steps.now());
  if (day.status !== "pending" || (phase !== "open" && phase !== "after_close")) return day;
  const updated = await steps.store.updateDay(day.tradeDate, { status: "lapsed" });
  let told = false;
  if (phase === "open") {
    told = await steps.say("commands", `The market opened at ${centralClock(day.openAt!)} and the limits for ${dayWord(day.tradeDate)} were not all decided, so **I will not trade today**. Nothing is open. ${NOT_ADVICE}`);
  }
  await steps.store.addEvent("warn", "day_lapsed", { date: day.tradeDate, phase, told });
  return updated;
}

// Arming, from 5 minutes before the open for an approved day: set long only and the approved borrowing cap at
// Alpaca (and read them back), and read the day's starting equity. Until a day is armed the gate refuses every
// entry, so a failure here means no trading, never trading at an unchecked cap. Throws on failure; the
// scheduler reports it and tries again.
export async function armDay(steps: MorningSteps, day: DayRecord): Promise<DayRecord> {
  if (day.status !== "approved" || day.phases.armed || !day.openAt || !day.closeAt) return day;
  const t = steps.now();
  if (t < addMinutes(day.openAt, -5) || t >= day.closeAt) return day;
  const cap = day.limits.borrowingCap;
  const config = await steps.broker.setAccountConfig({ maxMarginMultiplier: cap, noShorting: true });
  if (config.maxMarginMultiplier !== cap || !config.noShorting) throw new Error(`Alpaca did not keep the borrowing cap ${cap} and long only`);
  const account = await steps.broker.getAccount();
  const start = account.lastEquity > 0 ? account.lastEquity : account.equity;
  await steps.store.updateDay(day.tradeDate, { dayStartEquity: start });
  const armed = await setPhase(steps.store, day.tradeDate, "armed", t.toISOString());
  await steps.say("commands", `Armed for ${dayWord(day.tradeDate)}: borrowing cap ${cap} and long only are set at Alpaca; the day starts at ${start.toFixed(2)} dollars of equity.`);
  return armed;
}
