// Load mode (Michael's decisions of 2026-11-03). Each test was checked to fail with its change taken out (recorded in
// builds/build-c2-log.md). The session on this rig's day opens at 14:30 UTC (8:30 AM Central); the load window is
// 14:45 to 15:00 UTC (8:45 to 9:00 AM Central); the morning screen is at 13:45 UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BusyPlaceholder } from "../src/strategy.ts";
import { screen, DEFAULT_SCREEN, type Bar } from "../src/screen.ts";
import { LOAD_SCREEN, LOAD_NOTE_PHASE, inLoadWindow, isLoadDay, loadLine } from "../src/load-mode.ts";
import { Governor } from "../src/governor.ts";
import { formatSummary } from "../src/summary.ts";
import { MemoryStore, type DayRecord, type OrderRecord } from "../src/store.ts";
import { FakeBroker, order } from "./helpers.ts";
import { D, rig, settle, z } from "./rig.ts";

const RAMP = [...Array(12).fill(50), 50.4]; // twelve prints at 50, then an uptick: one signal at 50.40
const plus = (t: string, seconds: number) => new Date(z(t).getTime() + seconds * 1000).toISOString();

// A day approved the evening before with a 500 dollar position limit, armed at 14:25. `load` adds `load on` to the reply.
async function day(load: boolean) {
  const r = rig<FakeBroker, MemoryStore>({ liveList: ["BBB", "CCC", "DDD", "EEE"] });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays(`position 500\napprove${load ? "\nload on" : ""}`, "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("13:45:00");
  await r.at("14:25:00");
  assert.ok((await r.store.getDay(D))!.phases.armed, "armed");
  return r;
}
const entries = (r: { broker: FakeBroker }) => r.broker.calls.filter((c) => c.fn === "submitEntry").map((c) => c.args[0] as { symbol: string; qty: number; stopPrice: number; takeProfitPrice: number });
// A pass first, so Michael's commands count as read (the 2 minute rule), then one signal for the symbol.
async function signal(r: Awaited<ReturnType<typeof day>>, symbol: string, t: string) {
  await r.at(t);
  await r.ramp(symbol, RAMP, plus(t, 1));
  await settle();
}

// ---------- the switch ----------
test("load on: the day becomes a load day, the reply and the morning review show line 5, the Armed message says so", async () => {
  const r = await day(true);
  const d = (await r.store.getDay(D))!;
  assert.equal(d.phases.load, "on");
  assert.equal(d.status, "approved", "approve still covers the four limits");
  assert.ok(r.said("commands").some((t) => t.includes("will be a **load day**")));
  assert.ok(r.said("commands").some((t) => t.includes("Good morning") && t.includes("5. mode: **LOAD DAY**")), "the morning review shows it");
  assert.ok(r.said("commands").some((t) => t.startsWith("Armed for") && t.includes("This is a load day")));
});

test("the evening request shows line 5 as normal by default, and a load day is never carried to the next day", async () => {
  const r = await day(true);
  assert.ok(r.said("commands").some((t) => t.includes("Suggested limits") && t.includes("5. mode: normal (`load on` makes it a load day)")));
  await r.at("21:10:30"); // after Monday's close: Tuesday's request
  const tue = (await r.store.getDay("2026-11-03"))!;
  assert.equal(isLoadDay(tue), false, "Tuesday starts normal");
});

test("load on is refused from the morning screen on; after Armed only load off, which ends the window and keeps the cap", async () => {
  const r = await day(false);
  r.ownerSays("load on", "14:26:00");
  await r.at("14:26:10");
  assert.ok(r.bot.last().includes("Locked"), r.bot.last());
  assert.equal(isLoadDay((await r.store.getDay(D))!), false);

  const late = rig<FakeBroker, MemoryStore>();
  await late.at("2026-11-01T22:10:00Z");
  late.ownerSays("approve", "2026-11-01T22:20:00Z");
  await late.at("2026-11-01T22:20:10Z");
  late.ownerSays("load on", "13:46:00"); // after the 13:45 screen time
  await late.at("13:46:10");
  assert.ok(late.said("commands").some((t) => t.includes("Too late for a load day")), "refused after the screen time");
  assert.equal(isLoadDay((await late.store.getDay(D))!), false);

  const on = await day(true);
  on.ownerSays("load off", "14:50:00");
  await on.at("14:50:10");
  assert.equal((await on.store.getDay(D))!.phases.load, "ended");
  assert.ok(on.bot.last().includes("Load window switched off"));
});

test("a day whose request was posted before load mode existed gets one note showing its mode", async () => {
  const r = rig<FakeBroker, MemoryStore>();
  await r.at("2026-11-01T22:10:00Z");
  const d = (await r.store.getDay(D))!;
  const { [LOAD_NOTE_PHASE]: _gone, ...phases } = d.phases;
  await r.store.updateDay(D, { phases }); // as if an older release had posted the request
  await r.at("2026-11-01T22:15:00Z");
  await r.at("2026-11-01T22:15:05Z");
  const notes = r.said("commands").filter((t) => t.includes("**Mode for"));
  assert.equal(notes.length, 1, "once");
  assert.ok(notes[0]!.includes("5. mode: normal"));
});

// ---------- the screen ----------
test("the load screen keeps 5 to 35 dollar names and ranks them by shares traded; the worker asks for it only on a load day", async () => {
  // `last` is the last session's volume: CHEAP_SMALL had an unusual last day (it would rank first by the normal screen's
  // ratio), CHEAP_BIG trades far more shares every day (it ranks first by shares traded).
  const bars = (c: number, v: number, last = v): Bar[] => Array.from({ length: 5 }, (_, i) => ({ t: `2026-10-2${i}`, o: c, h: c, l: c, c, v: i === 4 ? last : v }));
  const data = new Map<string, Bar[]>([
    ["CHEAP_BIG", bars(10, 9_000_000)],
    ["CHEAP_SMALL", bars(20, 1_000_000, 3_000_000)],
    ["DEAR", bars(150, 50_000_000)],
    ["PENNY", bars(2, 90_000_000)],
  ]);
  assert.deepEqual(screen(data, LOAD_SCREEN).map((c) => c.symbol), ["CHEAP_BIG", "CHEAP_SMALL"]);
  assert.equal(LOAD_SCREEN.listSize, 30);
  assert.equal(DEFAULT_SCREEN.rankBy, undefined, "a normal day's screen is unchanged");
  const load = await day(true);
  assert.deepEqual(load.screenOpts, [{ load: true }]);
  const normal = await day(false);
  assert.deepEqual(normal.screenOpts, [undefined]);
});

// ---------- the churn and the gate ----------
test("a load day: no entry before 8:45, release B churn in the window (1 share, the first new print, exits 1 cent up and 2 down), the normal placeholder after, still at most 75 dollars", async () => {
  const r = await day(true);
  await signal(r, "DDD", "14:40:00");
  assert.equal(entries(r).length, 0, "before the window: refused");
  await signal(r, "BBB", "14:46:00");
  const inWindow = entries(r).at(-1)!;
  assert.equal(inWindow.symbol, "BBB");
  assert.equal(inWindow.qty, 1, "release B: 1 share in the window");
  assert.equal(inWindow.takeProfitPrice, 50.01, "release B: any new print signals, here the first one at 50.00; 1 cent up");
  assert.equal(inWindow.stopPrice, 49.98, "and 2 cents down");
  await signal(r, "CCC", "15:10:00");
  const after = entries(r).at(-1)!;
  assert.equal(after.symbol, "CCC");
  assert.equal(after.qty, 1, "the cap holds all day");
  assert.equal(after.takeProfitPrice, 50.53, "normal exits again: 0.25 percent up");
  assert.equal(after.stopPrice, 50.2, "and 0.4 percent down");
});

test("the strategy's churn rules apply only while the load window is on (release B: any new print after 1 second, exits 1 cent up and 2 down)", () => {
  let on = true;
  const s = new BusyPlaceholder(["X"], { loadActive: () => on });
  const at = (sec: number, price: number) => s.onTrade({ symbol: "X", price, size: 100, time: new Date(sec * 1000).toISOString() });
  const a = at(0, 50)!;
  assert.ok(a, "the very first print signals: no warm-up and no uptick needed in the window");
  assert.deepEqual([a.takeProfitPrice, a.stopPrice, a.load], [50.01, 49.98, true]);
  assert.equal(at(0.5, 50.1), null, "1 second cooldown");
  const b = at(1, 49.9);
  assert.ok(b, "a down-tick 1 second later still signals in the window");
  on = false;
  for (let i = 0; i < 12; i++) at(2 + i, 49.9);
  assert.equal(at(14.5, 49.8), null, "outside the window a down-tick is no signal");
  const c = at(30, 50.5)!;
  assert.ok(c && c.load === undefined, "outside the window: the uptick rule, and the signal is not marked as a window signal");
  assert.deepEqual([c.takeProfitPrice, c.stopPrice], [50.63, 50.3], "normal exits");
  assert.equal(at(35, 50.9), null, "15 second cooldown again");
});

// ---------- the faster sync and the statistics ----------
async function withActiveEntry(load: boolean) {
  const r = await day(load);
  await r.store.insertOrder({ clientOrderId: "cyrus-20261102-BBB-1", tradeDate: D, symbol: "BBB", qty: 1, referencePrice: 50, stopPrice: 49.96, status: "submitted", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: "2026-11-02T14:46:00.000Z" });
  return r;
}
const syncs = (r: { broker: FakeBroker }) => r.broker.calls.filter((c) => c.fn === "listOrdersPaged" && c.args[0] === "all").length;

test("a load day syncs orders every 10 seconds; a normal day every 30", async () => {
  for (const [load, expected] of [[true, 6], [false, 2]] as const) {
    const r = await withActiveEntry(load);
    await r.at("16:00:00");
    const before = syncs(r);
    for (let s = 5; s <= 60; s += 5) await r.at(plus("16:00:00", s));
    await settle();
    assert.equal(syncs(r) - before, expected, load ? "load day" : "normal day");
  }
});

test("request statistics are written every minute around the load window, every 5 minutes otherwise", async () => {
  for (const [load, atLeast, atMost] of [[true, 17, 30], [false, 3, 4]] as const) {
    const r = await day(load);
    const stats = () => r.store.events.filter((e) => e.event === "governor_stats").length;
    const before = stats();
    for (let s = 0; s <= 17 * 60; s += 5) await r.at(plus("14:44:00", s)); // 14:44 to 15:01
    const n = stats() - before;
    assert.ok(n >= atLeast && n <= atMost, `${load ? "load" : "normal"} day: ${n}`);
  }
});

test("the governor counts Alpaca's rate-limit answers, and the summary reports them", () => {
  const g = new Governor(() => 0);
  g.observe({ path: "/v2/orders", status: 429, limit: 200, remaining: 0, reset: null });
  g.observe({ path: "/v2/clock", status: 429, limit: null, remaining: null, reset: null }); // the clock's own bucket: not counted
  assert.equal(g.stats().rateLimitAnswers, 1);
});

// ---------- the summary ----------
test("a load day's summary reports the window and the rest of the day apart; a normal day's has no such part", () => {
  const base: DayRecord = { tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), status: "approved", dayStartEquity: 20000, suggested: { maxPositionUsd: 500, dailyLossStopUsd: 500, maxTradesPerMinute: 100, borrowingCap: 1 }, limits: { maxPositionUsd: 500, dailyLossStopUsd: 500, maxTradesPerMinute: 100, borrowingCap: 1 }, decided: {}, liveList: [], phases: { load: "on" } } as unknown as DayRecord;
  const row = (id: string, at: string, ms: number): OrderRecord => ({ clientOrderId: id, tradeDate: D, symbol: "BBB", qty: 1, referencePrice: 50, stopPrice: 49.96, status: "filled", alpacaOrderId: id, filledQty: 1, filledAvgPrice: 50, note: null, createdAt: z(at).toISOString(), acceptMs: ms } as OrderRecord);
  const parent = (id: string, exit: number, type: string) => order({ id, clientOrderId: id, symbol: "BBB", qty: 1, filledQty: 1, filledAvgPrice: 50, status: "filled", legs: [order({ id: `${id}-x`, clientOrderId: `${id}-x`, side: "sell", type, qty: 1, filledQty: 1, filledAvgPrice: exit, status: "filled", symbol: "BBB" })] });
  const stored = [row("a", "14:46:00", 100), row("b", "14:46:30", 120), row("c", "15:30:00", 300)];
  const alpacaOrders = [parent("a", 50.03, "limit"), parent("b", 49.96, "stop"), parent("c", 50.1, "limit")];
  const input = { day: base, stored, refusals: [], alpacaOrders, account: { equity: 20000 } as never, peak: null, stop: null, flat: true, loadWindow: { start: z("14:45:00"), end: z("15:00:00") } };
  const text = formatSummary(input);
  assert.ok(text.includes("**Load window (8:45 AM CT to 9:00 AM CT):** 2 entries sent, busiest minute 2. Closed by take-profit 1, by stop 1 (-0.01 on those)"), text);
  assert.ok(text.includes("**Rest of the day:** 1 entries sent, busiest minute 1. Closed by take-profit 1, by stop 0 (+0.10 on those)"), text);
  assert.ok(!formatSummary({ ...input, loadWindow: null }).includes("Load"), "normal day: no load part");
});

// ---------- a normal day is unchanged ----------
test("a normal day is unchanged: normal screen, entries from 8:35, the approved position size, normal exits", async () => {
  const r = await day(false);
  assert.equal(isLoadDay((await r.store.getDay(D))!), false);
  assert.ok(!inLoadWindow((await r.store.getDay(D))!, z("14:50:00")));
  assert.equal(loadLine((await r.store.getDay(D))!), "5. mode: normal (`load on` makes it a load day)");
  await signal(r, "DDD", "14:40:00");
  const e = entries(r).at(-1)!;
  assert.ok(e, "an entry before 8:45 on a normal day");
  assert.equal(e.qty, 9, "500 dollars at 50.40 is 9 shares");
  assert.deepEqual([e.takeProfitPrice, e.stopPrice], [50.53, 50.2]);
});
