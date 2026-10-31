// End of day close-out: cancel what is open, sell every position, check the account is flat, and put the
// borrowing cap back to 1. Leaves the account flat, or says loudly that it did not.
import type { Broker } from "./broker.ts";
import type { Store } from "./store.ts";
import { NOT_ADVICE } from "./discord.ts";

export interface CloseoutDeps {
  broker: Broker;
  store: Store;
  now: () => Date;
  say: (channel: "commands" | "trading" | "alerts", text: string) => Promise<boolean>;
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
  // False on a repeat attempt, so a failure that was already reported is not reported again every 5 minutes.
  alert?: boolean;
}

export const CLOSEOUT_MINUTES_BEFORE_CLOSE = 5;

// While the market is closed this never sends a sell: a market order sent after the close would queue for the
// next open and, because closing positions cancels the open orders first, would also cancel what protects them.
// It reports what is held instead, and the scheduler sells at the next open. If the broker's clock cannot be
// read, it goes ahead and sells (the safer direction at the regular close time).
export async function closeOut(d: CloseoutDeps, tradeDate: string, options: CloseoutOptions = {}): Promise<CloseoutResult> {
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const alert = options.alert !== false;
  let remaining: string[] = [];
  const clock = await d.broker.getClock().catch(() => null);
  if (clock && !clock.isOpen) {
    let held: string[];
    try {
      held = (await d.broker.listPositions()).map((p) => p.symbol);
    } catch {
      held = ["(could not read positions)"];
    }
    if (held.length > 0) {
      if (alert) {
        await d.say("alerts", `**NOT FLAT and the market is closed: ${held.join(", ")}.** I will not queue sell orders after hours. I will sell at the next open, or close by hand in Alpaca now. ${NOT_ADVICE}`);
        await d.say("commands", `**NOT FLAT: ${held.join(", ")}.** The market is closed, so nothing was sent. I will sell at the next open unless you close by hand first.`);
        await d.store.addEvent("error", "closeout_not_flat", { remaining: held, marketClosed: true }).catch(() => undefined);
      }
      return { flat: false, remaining: held, deferred: true };
    }
    return finishFlat(d);
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await d.broker.closeAllPositions(); // cancels open orders first, then sells at market
    } catch (err) {
      d.log?.("closeout_call_failed", { attempt, error: (err as Error).message.slice(0, 160) });
    }
    // Give the sells time to fill, then look.
    for (let look = 0; look < 6; look++) {
      await sleep(5_000);
      try {
        remaining = (await d.broker.listPositions()).map((p) => p.symbol);
      } catch {
        remaining = ["(could not read positions)"];
      }
      if (remaining.length === 0) break;
    }
    if (remaining.length === 0) break;
  }
  const flat = remaining.length === 0;
  if (flat) return finishFlat(d);
  if (alert) {
    await d.say("alerts", `**NOT FLAT after the close-out: ${remaining.join(", ")}.** Please check Alpaca now and close by hand. ${NOT_ADVICE}`);
    await d.say("commands", `**NOT FLAT after the close-out: ${remaining.join(", ")}.**`);
    await d.store.addEvent("error", "closeout_not_flat", { remaining }).catch(() => undefined);
  }
  return { flat, remaining };
}

// The account is flat: put the borrowing cap back to the safe default overnight and say so.
async function finishFlat(d: CloseoutDeps): Promise<CloseoutResult> {
  try {
    await d.broker.setAccountConfig({ maxMarginMultiplier: 1 });
  } catch {
    await d.say("commands", "The account is flat, but I could not set the borrowing cap back to 1. Check it before tomorrow.");
  }
  await d.say("trading", `Close-out done: the account is flat. ${NOT_ADVICE}`);
  return { flat: true, remaining: [] };
}
