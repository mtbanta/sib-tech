// Michael's request of 2026-11-18 with his addition: "the load window's stop distance becomes a setting (default 2 cents as today), which I
// can set for an afternoon load window, for example 5 cents, so load positions qualify for the moves" and "Add the take-profit to the same
// setting: "load afternoon stop 5 take 3" (stop 2 to 10 cents, take-profit 1 to 10 cents; each defaults to today's value if left out; that
// window only, then back to the defaults). The bot's reply shows both values in force."
// The simulated day is 2026-11-02: open 14:30 UTC (8:30 CT), pause 16:30 UTC, 1:30 PM CT is 19:30 UTC, last entry 20:00 UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";
import {
  DEFAULT_LOAD_EXITS,
  LOAD_AFTERNOON_EXITS_PHASE,
  LOAD_AFTERNOON_PHASE,
  LOAD_PHASE,
  LOAD_STOP_CENTS,
  LOAD_TAKE_PROFIT_CENTS,
  afternoonLoadExits,
  exitsInWords,
  loadExitsAt,
  loadWindowRules,
  parseLoadExits,
} from "../src/load-mode.ts";
import { parseCommand } from "../src/morning.ts";
import { BusyPlaceholder } from "../src/strategy.ts";
import { MIDDAY_PHASE } from "../src/midday.ts";
import { pricedMoves, withStops, type MoveCandidate } from "../src/moved-take-profit.ts";
import type { DayRecord } from "../src/store.ts";

const until = async (cond: () => boolean | Promise<boolean>, n = 400) => {
  for (let i = 0; i < n && !(await cond()); i++) await settle();
};

async function flatAtMidday(opts: { load?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const events: Array<{ e: string; d: any }> = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, log: (_l, e, d) => void events.push({ e, d }), loadAfternoon: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays(`${opts.load ? "load on\n" : ""}trades 20\nposition 300\napprove`, "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:15:00");
  await r.at("14:25:00");
  await r.at("14:30:05");
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  const sent: any[] = [];
  const orig = sim.submitEntry.bind(sim);
  sim.submitEntry = async (e: any) => (sent.push(e), orig(e));
  return { sim, r, events, sent };
}

// ---------------- the words ----------------

test("the words after `load afternoon`: stop and take in either order, each optional, whole cents in range; anything else refused with the reason", () => {
  const ok = (w: string) => {
    const p = parseLoadExits(w ? w.split(" ") : []);
    assert.ok("exits" in p, `${w}: ${JSON.stringify(p)}`);
    return (p as { exits: { stopCents: number; takeProfitCents: number } }).exits;
  };
  const bad = (w: string) => {
    const p = parseLoadExits(w.split(" "));
    assert.ok("error" in p, w);
    return (p as { error: string }).error;
  };
  assert.deepEqual(ok(""), { stopCents: 2, takeProfitCents: 1 }, "nothing given: today's values");
  assert.deepEqual(DEFAULT_LOAD_EXITS, { stopCents: LOAD_STOP_CENTS, takeProfitCents: LOAD_TAKE_PROFIT_CENTS });
  assert.deepEqual(ok("stop 5 take 3"), { stopCents: 5, takeProfitCents: 3 });
  assert.deepEqual(ok("take 3 stop 5"), { stopCents: 5, takeProfitCents: 3 }, "either order");
  assert.deepEqual(ok("stop 5"), { stopCents: 5, takeProfitCents: 1 }, "take-profit left out: its default");
  assert.deepEqual(ok("take 3"), { stopCents: 2, takeProfitCents: 3 }, "stop left out: its default");
  // The ranges, at their edges.
  assert.deepEqual(ok("stop 2 take 1"), { stopCents: 2, takeProfitCents: 1 });
  assert.deepEqual(ok("stop 10 take 10"), { stopCents: 10, takeProfitCents: 10 });
  assert.match(bad("stop 1"), /the stop must be a whole number of cents from 2 to 10 \(got `1`\)/);
  assert.match(bad("stop 11"), /the stop must be a whole number of cents from 2 to 10/);
  assert.match(bad("take 0"), /the take-profit must be a whole number of cents from 1 to 10 \(got `0`\)/);
  assert.match(bad("take 11"), /the take-profit must be a whole number of cents from 1 to 10/);
  // Not whole cents, or not numbers.
  for (const w of ["stop 5.5", "stop 0.05", "stop -5", "stop five", "take 3c", "stop 100"]) assert.match(bad(w), /must be a whole number of cents/, w);
  // The shape.
  for (const w of ["stop", "stop 5 take", "now", "stop 5 5", "stop 5 take 3 stop 4", "loss 5"]) assert.match(bad(w), /write it as `load afternoon`/, w);
  assert.match(bad("stop 5 stop 6"), /`stop` is given twice/);
});

test("parseCommand: `load afternoon` with or without the values; a bad value is its own kind with the reason; other load commands unchanged", () => {
  assert.deepEqual(parseCommand("load afternoon"), { kind: "loadAfternoon", exits: { stopCents: 2, takeProfitCents: 1 }, given: false });
  assert.deepEqual(parseCommand("Load Afternoon Stop 5 Take 3"), { kind: "loadAfternoon", exits: { stopCents: 5, takeProfitCents: 3 }, given: true });
  assert.deepEqual(parseCommand("  load   afternoon  take 4 "), { kind: "loadAfternoon", exits: { stopCents: 2, takeProfitCents: 4 }, given: true });
  const badCmd = parseCommand("load afternoon stop 12");
  assert.equal(badCmd.kind, "loadAfternoonInvalid");
  assert.match((badCmd as { why: string }).why, /from 2 to 10/);
  assert.deepEqual(parseCommand("load on"), { kind: "load", on: true });
  assert.deepEqual(parseCommand("load off"), { kind: "load", on: false });
  assert.equal(parseCommand("load morning").kind, "unknown");
});

// ---------------- the rule for which values apply ----------------

const base = { tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), dayStartEquity: 20000, status: "approved", limits: { maxPositionUsd: 300, dailyLossStopUsd: 500, maxTradesPerMinute: 20, borrowingCap: 1 } } as unknown as DayRecord;
const dayWith = (phases: Record<string, string>): DayRecord => ({ ...base, phases } as DayRecord);

test("which values apply: the afternoon window's own while it is on; the morning load window and every other time the defaults", () => {
  const both = dayWith({ [LOAD_PHASE]: "on", [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString(), [LOAD_AFTERNOON_EXITS_PHASE]: "stop 5 take 3" });
  assert.deepEqual(loadExitsAt(both, z("15:00:00")), DEFAULT_LOAD_EXITS, "the morning load window keeps the defaults");
  assert.deepEqual(loadExitsAt(both, z("16:39:59")), DEFAULT_LOAD_EXITS, "before the afternoon window");
  assert.deepEqual(loadExitsAt(both, z("16:40:00")), { stopCents: 5, takeProfitCents: 3 }, "at its start");
  assert.deepEqual(loadExitsAt(both, z("17:09:59")), { stopCents: 5, takeProfitCents: 3 }, "just before its end");
  assert.deepEqual(loadExitsAt(both, z("17:10:00")), DEFAULT_LOAD_EXITS, "at its end (30 minutes): back to the defaults");
  // A day record without the values (written before this release), or with one that does not read back in range: the defaults.
  assert.deepEqual(afternoonLoadExits(dayWith({ [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString() })), DEFAULT_LOAD_EXITS);
  for (const v of ["stop 1 take 3", "stop 5 take 0", "stop 5 take 11", "stop 5", "", "stop 5.5 take 3", "STOP 5 TAKE 3"]) assert.deepEqual(afternoonLoadExits(dayWith({ [LOAD_AFTERNOON_EXITS_PHASE]: v })), DEFAULT_LOAD_EXITS, v);
  assert.deepEqual(loadExitsAt(null, z("16:45:00")), DEFAULT_LOAD_EXITS);
  // The words in replies and the rules phrase.
  assert.equal(exitsInWords({ stopCents: 5, takeProfitCents: 3 }), "stop 5 cents and take-profit 3 cents");
  assert.equal(exitsInWords(DEFAULT_LOAD_EXITS), "stop 2 cents and take-profit 1 cent");
  assert.match(loadWindowRules({ stopCents: 5, takeProfitCents: 3 }), /take-profit 3 cents up and stop 5 cents down from the limit price$/);
  assert.match(loadWindowRules(), /take-profit 1 cent up and stop 2 cents down from the limit price$/, "the default phrase is unchanged");
});

test("the strategy prices a load entry's exits with the values in force at the trade's time; a normal entry is unchanged", () => {
  const exitsAt = (t: Date) => (t >= z("16:40:00") ? { stopCents: 5, takeProfitCents: 3 } : DEFAULT_LOAD_EXITS);
  const s = new BusyPlaceholder(["AAA", "CHP"], { loadActive: () => true, loadExits: exitsAt });
  const before = s.onTrade({ symbol: "AAA", price: 20.004, time: z("16:39:00").toISOString() } as any)!;
  assert.deepEqual([before.limitPrice, before.stopPrice, before.takeProfitPrice], [20.01, 19.99, 20.02], "defaults: 2 down, 1 up");
  const after = s.onTrade({ symbol: "AAA", price: 20.004, time: z("16:41:00").toISOString() } as any)!;
  assert.deepEqual([after.limitPrice, after.stopPrice, after.takeProfitPrice], [20.01, 19.96, 20.04], "stop 5 take 3");
  // A price whose stop would be at or below zero gives no signal (the guard uses the stop in force).
  assert.equal(s.onTrade({ symbol: "CHP", price: 0.04, time: z("16:42:00").toISOString() } as any), null, "limit 0.05, stop 5 cents: no signal");
  const d = new BusyPlaceholder(["CHP"], { loadActive: () => true });
  assert.ok(d.onTrade({ symbol: "CHP", price: 0.04, time: z("16:42:00").toISOString() } as any), "limit 0.05 with the default stop of 2 cents still signals");
  // Without loadExits (every caller before this release): the defaults.
  const plain = new BusyPlaceholder(["AAA"], { loadActive: () => true });
  const p = plain.onTrade({ symbol: "AAA", price: 20.004, time: z("16:41:00").toISOString() } as any)!;
  assert.deepEqual([p.stopPrice, p.takeProfitPrice], [19.99, 20.02]);
});

// ---------------- the moves: the same rule, no separate change (Michael's confirmation of 2026-11-18) ----------------

test("the moves qualify load positions by the same rule once the stop is wider: stop 5 take 3 qualifies at bids from 1 cent below to 3 cents above the entry", () => {
  const L = 5.0;
  const cand = (stopCents: number, takeCents: number): MoveCandidate => ({ symbol: "AAA", qty: 1, legId: "tp", groupId: "g", oldLimit: Math.round((L + takeCents / 100) * 100) / 100, stopPrice: 0 });
  const qualifies = (stopCents: number, takeCents: number, bid: number): boolean => {
    const stop = Math.round((L - stopCents / 100) * 100) / 100;
    const s = withStops([cand(stopCents, takeCents)], new Map([["tp", stop]]));
    if (s.candidates.length === 0) return false;
    return pricedMoves(s.candidates, new Map([["AAA", { bid, ask: bid + 0.01, atMs: 1000 }]]), 1000).moves.length === 1;
  };
  const bids = [4.97, 4.98, 4.99, 5.0, 5.01, 5.02, 5.03, 5.04, 5.05];
  const which = (s: number, t: number) => bids.filter((b) => qualifies(s, t, b));
  assert.deepEqual(which(2, 1), [], "today's load bracket (2 down, 1 up) never qualifies");
  assert.deepEqual(which(5, 3), [4.99, 5.0, 5.01, 5.02, 5.03], "stop 5 take 3: bids 4.99 to 5.03");
  assert.deepEqual(which(5, 1), [4.99, 5.0, 5.01], "stop 5 take 1: bids 4.99 to 5.01");
  assert.deepEqual(which(2, 3), [5.02, 5.03], "stop 2 take 3: bids 5.02 and 5.03");
});

// ---------------- through the worker ----------------

test("a normal morning: `load afternoon stop 5 take 3` names both values in the screen reply and the start reply; the window's entries use them", async () => {
  const { r, sent, events } = await flatAtMidday();
  r.ownerSays("load afternoon stop 5 take 3", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:40:10");
  const screenLine = r.said("commands").find((t) => t.startsWith("Running the cheap-symbol screen"));
  assert.ok(screenLine, r.said("commands").join(" | "));
  assert.match(screenLine!, /The window will use stop 5 cents and take-profit 3 cents \(this window only\)\.$/);
  const reply = r.said("commands").find((t) => t.startsWith("Afternoon load window on until"));
  assert.ok(reply, r.said("commands").join(" | "));
  assert.match(reply!, /take-profit 3 cents up and stop 5 cents down from the limit price/);
  assert.match(reply!, /In force for this window only: stop 5 cents and take-profit 3 cents; after it, back to the defaults \(stop 2 cents and take-profit 1 cent\)\.$/);
  const day = (await r.store.getDay(D))!;
  assert.equal(day.phases[LOAD_AFTERNOON_EXITS_PHASE], "stop 5 take 3", "stored with the window's start");
  assert.ok(events.some((e) => e.e === "load_afternoon" && e.d.stopCents === 5 && e.d.takeProfitCents === 3));
  await r.trade("AAA", 20.004, "16:40:20");
  await until(() => sent.length > 0);
  assert.equal(sent.length, 1);
  assert.deepEqual([sent[0].qty, sent[0].limitPrice, sent[0].stopPrice, sent[0].takeProfitPrice], [1, 20.01, 19.96, 20.04]);
  // `status` shows both values while the window is on.
  r.ownerSays("status", "16:45:00");
  await r.at("16:45:05");
  const st = r.said("commands").filter((t) => t.startsWith("**Status**")).at(-1)!;
  assert.match(st, /Afternoon load window: on since 10:40 AM CT, until 11:10 AM CT \(then a close-out to flat, entries paused\): 1 share churn, stop 5 cents and take-profit 3 cents,/);
});

test("a load day: `load afternoon take 3` (stop left out) starts at once with stop 2 and take-profit 3; after a flatten, a plain `load afternoon` is back to the defaults", async () => {
  const { r, sent } = await flatAtMidday({ load: true });
  r.ownerSays("load afternoon take 3", "16:40:00");
  await r.at("16:40:05");
  const first = r.said("commands").find((t) => t.startsWith("Afternoon load window on until"));
  assert.ok(first, r.said("commands").join(" | "));
  assert.match(first!, /In force for this window only: stop 2 cents and take-profit 3 cents; after it, back to the defaults/);
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_EXITS_PHASE], "stop 2 take 3");
  await r.trade("AAA", 20.004, "16:40:20");
  await until(() => sent.length > 0);
  assert.deepEqual([sent[0].stopPrice, sent[0].takeProfitPrice], [19.99, 20.04]);
  r.ownerSays("flatten", "16:50:00");
  await r.at("16:50:05");
  await r.at("16:50:30");
  r.ownerSays("load afternoon", "16:55:00");
  await r.at("16:55:05");
  const again = r.said("commands").find((t) => t.startsWith("Afternoon load window on again"));
  assert.ok(again, r.said("commands").join(" | "));
  assert.match(again!, /take-profit 1 cent up and stop 2 cents down from the limit price/);
  assert.match(again!, /In force for this window only: stop 2 cents and take-profit 1 cent \(the defaults\)\.$/);
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_EXITS_PHASE], "stop 2 take 1", "the earlier window's values are not kept");
  const n = sent.length;
  await r.trade("BBB", 10.004, "16:55:20");
  await until(() => sent.length > n);
  assert.deepEqual([sent.at(-1).stopPrice, sent.at(-1).takeProfitPrice], [9.99, 10.02]);
});

test("a value out of range starts nothing and changes nothing; the reply says why", async () => {
  const { r, sent } = await flatAtMidday({ load: true });
  r.ownerSays("load afternoon stop 12 take 3", "16:40:00");
  await r.at("16:40:05");
  assert.ok(r.said("commands").includes("Not started: the stop must be a whole number of cents from 2 to 10 (got `12`). Nothing changed."), r.said("commands").join(" | "));
  const day = (await r.store.getDay(D))!;
  assert.equal(day.phases[LOAD_AFTERNOON_PHASE], undefined);
  assert.equal(day.phases[LOAD_AFTERNOON_EXITS_PHASE], undefined);
  await r.trade("AAA", 20.004, "16:40:20");
  for (let i = 0; i < 50; i++) await settle();
  assert.equal(sent.length, 0, "still paused");
});

test("`help` stays one Discord message (under 2000 characters) and names the new words", async () => {
  const { r } = await flatAtMidday();
  r.ownerSays("help", "16:41:00");
  await r.at("16:41:05");
  const help = r.said("commands").find((t) => t.startsWith("**Commands**"))!;
  assert.ok(help.length < 2000, String(help.length));
  assert.ok(help.includes("Add `stop 5 take 3` for that window only (stop 2 to 10 cents, take-profit 1 to 10; defaults 2 and 1)."));
});
