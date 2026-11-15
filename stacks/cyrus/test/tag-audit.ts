// The redesign of 2026-11-14 (an independent check, the advisor's point after part 1): the worker must never send a sell, a cancel or an
// entry with no tag (outside every scope), since then it would be counted as routine work and escape the shared request budget. The test
// brokers record any such call here with the first source frame that made it; worker-level tests assert none came from src/.
import { currentTag } from "../src/request-scope.ts";

export const routineSafetyCalls: Array<{ fn: string; from: string }> = [];

export function noteSafetyCall(fn: string): void {
  if (currentTag() !== "routine") return;
  const frames = (new Error().stack ?? "").split("\n").map((l) => l.trim());
  const src = frames.find((l) => l.includes("/stacks/cyrus/src/") && !l.includes("request-scope.ts")) ?? "";
  const test = frames.find((l) => l.includes("/stacks/cyrus/test/") && !l.includes("tag-audit.ts") && !l.includes("sim-broker.ts") && !l.includes("helpers.ts")) ?? "";
  routineSafetyCalls.push({ fn, from: src || test });
  if (process.env.STRICT_TAGS) {
    const chain = frames.filter((l) => l.includes("/stacks/cyrus/")).map((l) => (l.match(/at (?:async )?([^ ]+)/)?.[1] ?? "?") + "@" + (l.match(/(src|test)\/([^:/]+):/)?.slice(1).join("/") ?? "?")).join(" < ");
    console.log(`ROUTINE_SAFETY ${fn} ${chain}`);
  }
}

// The calls made from the worker's own code (not a test calling the broker or the liquidator directly).
export const fromSource = (): Array<{ fn: string; from: string }> => routineSafetyCalls.filter((c) => c.from.includes("/stacks/cyrus/src/"));

// Also noted, at the moment a sale is asked for (the caller is still on the stack then): every liquidation and sell-gate sale asked for
// outside any scope (`routineAsks`; printed with the source functions that asked when STRICT_TAGS is set). Worker-level tests assert none
// (a test that calls the liquidator or the close-out directly is outside any scope by design).
export const routineAsks: string[] = [];
{
  const { Liquidator, SellGate } = await import("../src/sells.ts");
  const where = (): string =>
    (new Error().stack ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes("/stacks/cyrus/src/") && !l.includes("sells.ts"))
      .map((l) => (l.match(/at (?:async )?([^ ]+)/)?.[1] ?? "?") + "@" + (l.match(/src\/([^:/]+):/)?.[1] ?? "?"))
      .join(" < ");
  const lf = Liquidator.prototype.flatten;
  Liquidator.prototype.flatten = function (o: any) {
    if (currentTag() === "routine") {
      routineAsks.push(`flatten(${o.reason})`);
      if (process.env.STRICT_TAGS) console.log(`ROUTINE_ASK flatten(${o.reason}) ${where() || "(test)"}`);
    }
    return lf.call(this, o);
  };
  const gs = SellGate.prototype.sell;
  SellGate.prototype.sell = function (r: any) {
    if (currentTag() === "routine") {
      routineAsks.push(`sell(${r.reason})`);
      if (process.env.STRICT_TAGS) console.log(`ROUTINE_ASK sell(${r.reason}) ${where() || "(test)"}`);
    }
    return gs.call(this, r);
  };
}
