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
}

export const CLOSEOUT_MINUTES_BEFORE_CLOSE = 5;

export async function closeOut(d: CloseoutDeps, tradeDate: string): Promise<CloseoutResult> {
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let remaining: string[] = [];
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
  if (flat) {
    try {
      await d.broker.setAccountConfig({ maxMarginMultiplier: 1 }); // back to the safe default overnight
    } catch {
      await d.say("commands", "The account is flat, but I could not set the borrowing cap back to 1. Check it before tomorrow.");
    }
    await d.say("trading", `Close-out done: the account is flat. ${NOT_ADVICE}`);
  } else {
    await d.say("alerts", `**NOT FLAT after the close-out: ${remaining.join(", ")}.** Please check Alpaca now and close by hand. ${NOT_ADVICE}`);
    await d.say("commands", `**NOT FLAT after the close-out: ${remaining.join(", ")}.**`);
    await d.store.addEvent("error", "closeout_not_flat", { remaining }).catch(() => undefined);
  }
  return { flat, remaining };
}
