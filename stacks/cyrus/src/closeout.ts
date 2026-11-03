// End of day close-out: sell every position, check the account is flat, and put the borrowing cap back to 1.
// Leaves the account flat, or says loudly, to Michael by name, that it did not.
//
// It sells through the Liquidator (sells.ts), which cancels the exits that hold the shares, waits until Alpaca
// shows them gone, and sells each symbol with an explicit quantity, several rounds if need be. It no longer uses
// Alpaca's bulk "close all positions" call: on 2026-11-02 that call cancelled the protective stops and then failed
// for every position, and the account was flat only because the order sync happened to sell the positions.
import type { Broker } from "./broker.ts";
import type { Store } from "./store.ts";
import type { Liquidator, Say } from "./sells.ts";

export interface CloseoutDeps {
  broker: Broker;
  liquidator: Liquidator;
  store: Store;
  now: () => Date;
  say: Say;
  sleep?: (ms: number) => Promise<void>;
  log?: (event: string, data?: Record<string, unknown>) => void;
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
}

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
    return finishFlat(d);
  }

  const res = await d.liquidator.flatten({ reason: "close-out", tradeDate });
  await d.store.addEvent(res.flat ? "info" : "error", "closeout_result", { flat: res.flat, remaining: res.remaining, sold: res.sold, errors: res.errors.slice(0, 8) }).catch(() => undefined);
  if (res.flat) {
    // Flat, but something went wrong on the way (a cancel or a sell was refused and had to be repeated): say so.
    if (alert && res.errors.length > 0) await d.say("alerts", `Michael: the close-out had trouble but recovered and the account is flat. First problem: ${res.errors[0]!.slice(0, 200)}`);
    return finishFlat(d);
  }
  if (alert) {
    const why = res.errors.length > 0 ? ` Last problem: ${res.errors[res.errors.length - 1]}` : "";
    await d.say("alerts", `**Michael: NOT FLAT after the close-out: ${res.remaining.join(", ")}.** Please check Alpaca now and close by hand.${why}`.slice(0, 1800), { mentionOwner: true });
    await d.say("commands", `**Michael: NOT FLAT after the close-out: ${res.remaining.join(", ")}.**`);
  }
  return { flat: false, remaining: res.remaining };
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
