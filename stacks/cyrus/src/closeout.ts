// End of day close-out: sell every position, check the account is flat, and put the borrowing cap back to 1.
// Leaves the account flat, or says loudly, to Michael by name, that it did not.
//
// It sells through the Liquidator (sells.ts), which cancels the exits that hold the shares, waits until Alpaca
// shows them gone, and sells each symbol with an explicit quantity, several rounds if need be. It no longer uses
// Alpaca's bulk "close all positions" call: on 2026-11-02 that call cancelled the protective stops and then failed
// for every position, and the account was flat only because the order sync happened to sell the positions.
import { MAX_EARLY_WAKES } from "./early-wake.ts";
import type { Broker } from "./broker.ts";
import type { Store } from "./store.ts";
import { ownOpenSellQty, type Liquidator, type Say } from "./sells.ts";
import { centralClock } from "./time.ts";

export interface CloseoutDeps {
  broker: Broker;
  liquidator: Liquidator;
  store: Store;
  now: () => Date;
  say: Say;
  sleep?: (ms: number) => Promise<void>;
  log?: (event: string, data?: Record<string, unknown>) => void;
  // The speed release, item 9: a pause that ends early (true) at a live order update for one of these symbols (a fill of the
  // close-out's own sell), so the wait for those fills ends at the event; the 2 second look stays as the backstop.
  waitEvent?: (symbols: ReadonlySet<string>, ms: number) => Promise<boolean>;
}

export interface CloseoutResult {
  flat: boolean;
  remaining: string[];
  // True when the market was closed and positions were held: nothing was sent (see closeOut).
  deferred?: boolean;
}

export interface CloseoutOptions {
  // False on a repeat attempt, so a failure that was already reported is not reported again every few seconds.
  alert?: boolean;
  // The day's close. If the broker's clock cannot be read, a time at or after this counts as closed, so a clock
  // failure after the close never leads to market sells that would queue overnight.
  closeAt?: Date;
  // Which path asked (release A, fix 5): written to the run log with the result.
  path?: CloseoutPath;
  // Release A, fix 2: while every share still held is covered by a sell this close-out sent, wait for the fills (gently) up to
  // 2 minutes before the close instead of reporting NOT FLAT. On for the close-out, its retry and the emergency close-out; the
  // carried-position sale keeps its old behaviour.
  waitForOwnSells?: boolean;
  // Rounds of the liquidator (its default is 4). Only the mid-day close-out's retries use it: one round each, the way the loss stop's
  // first sale is one round, so a retry is a bounded burst that fits inside 60 requests a minute (Michael's ruling of 2026-11-09).
  maxRounds?: number;
  // Only these symbols (the mid-day close-out's retries: at most a few positions a retry, like the loss stop's retry, so a retry stays
  // inside 60 requests a minute even with many positions). The account counts as flat only when Alpaca shows no position at all, so
  // the result is read from the whole account afterwards (one request).
  onlySymbols?: string[];
}

// "midday": the mid-day cycle (Michael, 2026-11-09). It sells the same way, but leaves the borrowing cap alone (the account stays
// flat and paused until the afternoon resumes under the same day's limits) and posts nothing itself: the worker posts the mid-day
// messages.
export type CloseoutPath = "close-out" | "retry" | "carried" | "emergency" | "midday";

// How long before the close the close-out stops waiting for its own sells and reports what is still held.
export const OWN_SELLS_DEADLINE_BEFORE_CLOSE_MS = 2 * 60_000;
// Without a known close (the emergency path), it waits at most this long.
const OWN_SELLS_WAIT_NO_CLOSE_MS = 60_000;
// While waiting: positions every 2 seconds, open orders every 5th look (about 0.6 requests a second).
const OWN_SELLS_POLL_MS = 2_000;
const OWN_SELLS_ORDERS_EVERY = 5;

// Alpaca answering "order pending cancel" means a cancel is already under way: not a problem worth a note.
const benignError = (e: string) => /cancel answers:/.test(e) && e.split(": ").slice(2).join(": ").split("; ").every((part) => /pending cancel/i.test(part));

export const CLOSEOUT_MINUTES_BEFORE_CLOSE = 5;

// While the market is closed this never sends a sell: a market order sent after the close would queue for the
// next open and, because selling cancels the open orders first, would also cancel what protects the position. It
// reports what is held instead, and the scheduler sells at the next open. If the broker's clock cannot be read,
// it goes ahead and sells (the safer direction at the regular close time).
export async function closeOut(d: CloseoutDeps, tradeDate: string, options: CloseoutOptions = {}): Promise<CloseoutResult> {
  const alert = options.alert !== false;
  const clock = await d.broker.getClock().catch(() => null);
  const marketClosed = clock ? !clock.isOpen : options.closeAt !== undefined && d.now() >= options.closeAt;
  if (marketClosed) {
    let held: string[];
    try {
      held = (await d.broker.listPositions()).map((p) => p.symbol);
    } catch {
      held = ["(could not read positions)"];
    }
    if (held.length > 0) {
      if (alert) {
        await d.say("alerts", `**Michael: NOT FLAT and the market is closed: ${held.join(", ")}.** I will not queue sell orders after hours. I will sell at the next open, or close by hand in Alpaca now.`, { mentionOwner: true });
        await d.say("commands", `**Michael: NOT FLAT: ${held.join(", ")}.** The market is closed, so nothing was sent. I will sell at the next open unless you close by hand first.`);
        await d.store.addEvent("error", "closeout_not_flat", { remaining: held, marketClosed: true }).catch(() => undefined);
      }
      return { flat: false, remaining: held, deferred: true };
    }
    return options.path === "midday" ? { flat: true, remaining: [] } : finishFlat(d);
  }

  const path: CloseoutPath = options.path ?? "close-out";
  const waitForOwn = options.waitForOwnSells ?? path !== "carried";
  const res = await d.liquidator.flatten({ reason: path === "midday" ? "mid-day close-out" : "close-out", tradeDate, ...(waitForOwn ? { returnWhenOnlyOwnSells: true } : {}), ...(options.maxRounds !== undefined ? { maxRounds: options.maxRounds } : {}), ...(options.onlySymbols ? { only: options.onlySymbols } : {}) });
  let flat = res.flat;
  let remaining = res.remaining;
  if (options.onlySymbols) {
    try {
      const held = await d.broker.listPositions();
      flat = held.length === 0;
      remaining = held.map((p) => p.symbol);
    } catch {
      flat = false;
      remaining = ["(could not read positions)"];
    }
  }
  let waitedMs = 0;
  let stillWorking = false; // at the end, every share still held is covered by a sell of ours that Alpaca has not filled
  const sells = res.steps?.sells ?? [];
  if (!flat && waitForOwn && res.working && remaining.length > 0 && remaining.every((s) => res.working!.includes(s))) {
    // Release A, fix 2: the only thing holding the account is this close-out's own sells, sent and still working. Wait for
    // Alpaca to fill them, gently, until the deadline. On 2026-11-04 Alpaca paper held two sells 16 seconds before submitting them.
    const t0 = d.now().getTime();
    const deadline = options.closeAt ? options.closeAt.getTime() - OWN_SELLS_DEADLINE_BEFORE_CLOSE_MS : t0 + OWN_SELLS_WAIT_NO_CLOSE_MS;
    const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const maxLooks = Math.max(0, Math.ceil((deadline - t0) / OWN_SELLS_POLL_MS)) + 1; // bounded even if the clock does not move
    stillWorking = true;
    let earlyWakes = 0; // at most MAX_EARLY_WAKES looks are brought forward by updates; after that every look waits its 2 seconds again
    for (let look = 1; look <= maxLooks && d.now().getTime() < deadline; look++) {
      if (d.waitEvent && earlyWakes < MAX_EARLY_WAKES) {
        if (await d.waitEvent(new Set(remaining), OWN_SELLS_POLL_MS)) {
          earlyWakes++;
          look--; // a look brought forward by an update does not use up one of the timed looks
        }
      } else await sleep(OWN_SELLS_POLL_MS);
      try {
        const held = await d.broker.listPositions();
        remaining = held.map((p) => p.symbol);
        if (held.length === 0) {
          flat = true;
          stillWorking = false;
          break;
        }
        if (look % OWN_SELLS_ORDERS_EVERY === 0) {
          const open = (await d.broker.listOrdersPaged("open", "2000-01-01T00:00:00Z", 5)).orders;
          if (!held.every((p) => ownOpenSellQty(open, p.symbol) >= p.qty - 1e-6)) {
            stillWorking = false; // a sell of ours is gone (refused, cancelled) and shares are still held: report now
            break;
          }
        }
      } catch {
        // a failed look is just tried again on the next one
      }
    }
    waitedMs = d.now().getTime() - t0;
  }
  const errors = res.errors.filter((e) => !benignError(e));
  await d.store.addEvent(flat ? "info" : "error", "closeout_result", { path, flat, remaining: flat ? [] : remaining, sold: res.sold, errors: res.errors.slice(0, 8), waitedMs, steps: res.steps ?? null }).catch(() => undefined);
  if (flat) {
    // Flat, but something went wrong on the way (a sell was refused and had to be repeated): say so. Waiting for Alpaca to fill
    // our own sells, or Alpaca saying a cancel was already under way, is not a problem.
    if (alert && errors.length > 0) await d.say("alerts", `Michael: the close-out had trouble but recovered and the account is flat. First problem: ${errors[0]!.slice(0, 200)}`);
    return path === "midday" ? { flat: true, remaining: [] } : finishFlat(d);
  }
  if (alert) {
    if (stillWorking) {
      const sentAt = sells.length > 0 ? centralClock(new Date(sells[0]!.at)) : "earlier";
      const n = sells.filter((x) => remaining.includes(x.symbol)).length || remaining.length;
      const why = `${n} sell${n === 1 ? "" : "s"} sent at ${sentAt} for ${remaining.join(", ")}; Alpaca had not filled ${n === 1 ? "it" : "them"} by ${centralClock(d.now())}.`;
      await d.say("alerts", `**Michael: NOT FLAT after the close-out: ${remaining.join(", ")}.** ${why} Please check Alpaca now.`.slice(0, 1800), { mentionOwner: true });
      await d.say("commands", `**Michael: NOT FLAT after the close-out: ${remaining.join(", ")}.** ${why}`);
    } else {
      const last = errors.length > 0 ? errors[errors.length - 1] : res.errors[res.errors.length - 1];
      const why = last ? ` Last problem: ${last}` : "";
      await d.say("alerts", `**Michael: NOT FLAT after the close-out: ${remaining.join(", ")}.** Please check Alpaca now and close by hand.${why}`.slice(0, 1800), { mentionOwner: true });
      await d.say("commands", `**Michael: NOT FLAT after the close-out: ${remaining.join(", ")}.**`);
    }
  }
  return { flat: false, remaining };
}

// The account is flat: put the borrowing cap back to the safe default overnight and say so.
async function finishFlat(d: CloseoutDeps): Promise<CloseoutResult> {
  try {
    await d.broker.setAccountConfig({ maxMarginMultiplier: 1 });
  } catch {
    await d.say("commands", "The account is flat, but I could not set the borrowing cap back to 1. Check it before tomorrow.");
  }
  await d.say("trading", "Close-out done: the account is flat.");
  return { flat: true, remaining: [] };
}
