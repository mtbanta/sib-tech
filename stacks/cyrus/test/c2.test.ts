// Build C2 behaviour: the governor, the caching store, the digest, fees, the aggregated summary, several commands in
// one message, tightening after "Armed", last-approved limits carried forward, the reset of an old-shape day, names
// on the live list, the single message footer, and what goes into the run log.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Governor, SAFETY_RESERVE } from "../src/governor.ts";
import { CachingStore } from "../src/caching-store.ts";
import { TradeDigest } from "../src/digest.ts";
import { CONTROL_FEES, addToRunning, estimateFees, tafActive } from "../src/fees.ts";
import { computeDay, formatSummary, speedStats } from "../src/summary.ts";
import { finalizeMessage } from "../src/discord.ts";
import { cleanCompanyName, formatLiveList, parseNames } from "../src/universe.ts";
import { shouldStoreEvent } from "../src/run-log.ts";
import { ensureDay, resetOldShapeFutureDays, suggestedFromHistory, formatLimitsRequest, limitLines } from "../src/morning.ts";
import { CONTROL_STOP, MemoryStore, normalizeDay, type DayRecord, type StopFlag } from "../src/store.ts";
import { SUGGESTED_LIMITS } from "../src/limits.ts";
import { order } from "./helpers.ts";
import { FakeBroker } from "./helpers.ts";
import { D, rig } from "./rig.ts";

// ---------- governor ----------
test("governor: a sliding minute, never above the ceiling, and a slot is taken when granted", () => {
  let t = 1_000_000;
  const g = new Governor(() => t);
  for (let i = 0; i < 5; i++) assert.equal(g.admitTrade(5).ok, true);
  const refused = g.admitTrade(5);
  assert.equal(refused.ok, false);
  assert.match((refused as any).reason, /trades-per-minute limit reached \(5\)/);
  t += 59_000;
  assert.equal(g.admitTrade(5).ok, false, "still inside the minute");
  t += 1_500;
  assert.equal(g.admitTrade(5).ok, true, "the first five have aged out");
  const h = new Governor(() => t);
  let n = 0;
  while (h.admitTrade(100000).ok) n++;
  assert.equal(n, 100, "a stored value above the ceiling cannot lift it");
  assert.equal(new Governor(() => t).admitTrade(0).ok, false);
});

test("governor: strategy work stops at the safety reserve; safety work is not its business; the refill is counted; a 429 means empty", () => {
  let t = 5_000_000;
  const g = new Governor(() => t);
  assert.equal(g.canSpend(), true, "unknown means full");
  g.observe({ path: "/v2/account", status: 200, limit: 200, remaining: SAFETY_RESERVE + 5, reset: 0 });
  assert.equal(g.canSpend(), true);
  g.observe({ path: "/v2/account", status: 200, limit: 200, remaining: SAFETY_RESERVE, reset: 0 });
  assert.equal(g.canSpend(), false, "down to the reserve");
  assert.match((g.admitTrade(10) as any).reason, /holding back for safety/);
  t += 6_000; // 6 seconds of refill at 200 a minute is 20 more
  assert.equal(g.canSpend(), true);
  g.observe({ path: "/v2/orders", status: 429, limit: 200, remaining: 0, reset: 0 });
  assert.equal(g.budget(), 0);
  g.observe({ path: "/v2/clock", status: 200, limit: 1000, remaining: 3, reset: 0 });
  assert.equal(g.budget(), 0, "the clock has its own bucket and does not count");
  assert.equal(g.stats().lowestBudget, 0);
});

// ---------- caching store ----------
test("caching store: the stop flag is served from memory for a moment, written through at once, and a failed write changes nothing", async () => {
  let now = 1_000_000;
  const inner = new MemoryStore();
  let reads = 0;
  const realGet = inner.getControl.bind(inner);
  inner.getControl = async <T,>(k: string) => (reads++, realGet<T>(k));
  const s = new CachingStore(inner, () => now);
  await s.getControl(CONTROL_STOP);
  await s.getControl(CONTROL_STOP);
  assert.equal(reads, 1, "the second read came from memory");
  await s.setControl(CONTROL_STOP, { on: true, at: "t", reason: "r" });
  assert.equal(((await s.getControl<StopFlag>(CONTROL_STOP)))?.on, true, "a write is seen at once");
  assert.equal(reads, 1);
  inner.failing = true;
  await assert.rejects(s.setControl(CONTROL_STOP, { on: false, at: "t", reason: "r" }));
  inner.failing = false;
  assert.equal(((await s.getControl<StopFlag>(CONTROL_STOP)))?.on, true, "a failed write left the cache alone");
  now += 2_000;
  await s.getControl(CONTROL_STOP);
  assert.equal(reads, 2, "after the short lifetime it reads the database again");
  // a change made by hand in the database shows up after that moment
  await inner.setControl(CONTROL_STOP, { on: false, at: "t", reason: "by hand" });
  now += 2_000;
  assert.equal(((await s.getControl<StopFlag>(CONTROL_STOP)))?.on, false);
});

test("caching store: orders are loaded once, inserts and updates are written through, and the database stays the truth", async () => {
  const inner = new MemoryStore();
  const s = new CachingStore(inner);
  let listed = 0;
  const realList = inner.listOrders.bind(inner);
  inner.listOrders = async (d: string) => (listed++, realList(d));
  const row = { clientOrderId: "cyrus-20261102-AAA-1", tradeDate: D, symbol: "AAA", qty: 5, referencePrice: 10, stopPrice: 9, status: "intent" as const, alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null };
  assert.equal(await s.insertOrder(row), true);
  assert.equal(await s.insertOrder({ ...row, qty: 99 }), false, "a duplicate id is still refused");
  await s.updateOrder(row.clientOrderId, { status: "submitted", acceptMs: 42 });
  await s.listOrders(D);
  await s.listOrders(D);
  assert.equal(listed, 1);
  assert.equal((await inner.getOrder(row.clientOrderId))?.status, "submitted", "written through");
  assert.equal((await s.listOrders(D))[0]!.acceptMs, 42);
  inner.failing = true;
  await assert.rejects(s.updateOrder(row.clientOrderId, { status: "filled" }));
  inner.failing = false;
  assert.equal((await s.listOrders(D))[0]!.status, "submitted", "a failed write left memory alone");
});

// ---------- digest ----------
test("digest: batches trade news into messages that fit, counts what did not fit, and is empty when nothing happened", () => {
  const d = new TradeDigest(5);
  assert.deepEqual(d.take(), []);
  for (let i = 0; i < 8; i++) d.add(`line ${i}`);
  const out = d.take();
  assert.equal(out.length, 1);
  assert.match(out[0]!, /line 4/);
  assert.match(out[0]!, /\(\+3 more not listed\)/);
  assert.deepEqual(d.take(), [], "taken once");
  const big = new TradeDigest(100);
  for (let i = 0; i < 100; i++) big.add("x".repeat(50));
  assert.ok(big.take(400).every((m) => m.length <= 450));
});

// ---------- fees ----------
test("fees: SEC on sells, FINRA TAF paused through 2026-12-31, CAT on buys and sells, rounded up to the cent per type", () => {
  const fills = [{ side: "buy" as const, qty: 100, price: 50 }, { side: "sell" as const, qty: 100, price: 50.5 }];
  const f = estimateFees("2026-11-02", fills);
  assert.equal(f.sec, 0.11, "5050 x 0.0000206 = 0.104 rounds up to 0.11");
  assert.equal(f.taf, 0, "paused");
  assert.equal(f.cat, 0.01, "200 shares x 0.000003 = 0.0006 rounds up to 0.01");
  assert.equal(f.total, 0.12);
  assert.equal(tafActive("2026-12-31"), false);
  assert.equal(tafActive("2027-01-04"), true);
  const later = estimateFees("2027-01-04", [{ side: "sell", qty: 100000, price: 10 }]);
  assert.equal(later.taf, 9.79, "0.000195 x 100000 = 19.50 is capped at 9.79 a trade");
  assert.equal(estimateFees("2027-01-04", [{ side: "sell", qty: 1000, price: 10 }]).taf, 0.2, "0.195 rounds up to 0.20");
  assert.equal(estimateFees("2026-11-02", []).total, 0);
});

test("fees: the running total replaces a day instead of adding it twice", () => {
  let r = addToRunning(null, "2026-11-02", 1.5);
  r = addToRunning(r, "2026-11-03", 2.25);
  r = addToRunning(r, "2026-11-02", 1.5);
  assert.equal(r.total, 3.75);
  assert.equal(CONTROL_FEES, "fees_running");
});

// ---------- summary ----------
const fill = (o: Partial<ReturnType<typeof order>>) => order({ status: "filled", ...o });
test("summary maths: profit is matched by quantity first-in first-out, so a name entered twice is not counted twice", () => {
  const orders = [
    fill({ id: "b1", symbol: "AAA", side: "buy", qty: 10, filledQty: 10, filledAvgPrice: 10, filledAt: "2026-11-02T15:00:00Z", legs: [fill({ id: "s1", symbol: "AAA", side: "sell", qty: 10, filledQty: 10, filledAvgPrice: 11, filledAt: "2026-11-02T15:10:00Z" }), order({ id: "s1b", symbol: "AAA", side: "sell", status: "canceled" })] }),
    fill({ id: "b2", symbol: "AAA", side: "buy", qty: 10, filledQty: 10, filledAvgPrice: 12, filledAt: "2026-11-02T16:00:00Z", legs: [] }),
    fill({ id: "s2", symbol: "AAA", side: "sell", qty: 10, filledQty: 10, filledAvgPrice: 11.5, filledAt: "2026-11-02T20:55:30Z" }),
    fill({ id: "b3", symbol: "BBB", side: "buy", qty: 5, filledQty: 5, filledAvgPrice: 100, filledAt: "2026-11-02T15:05:00Z", legs: [fill({ id: "s3", symbol: "BBB", side: "sell", qty: 5, filledQty: 5, filledAvgPrice: 99, filledAt: "2026-11-02T15:06:00Z" })] }),
    fill({ id: "s9", symbol: "ZZZ", side: "sell", qty: 3, filledQty: 3, filledAvgPrice: 20, filledAt: "2026-11-02T14:40:00Z" }), // sold, never bought today: a carried position
  ];
  const r = computeDay(orders);
  assert.equal(Math.round(r.realized * 100) / 100, 10 - 5 - 5, "AAA +10 (first), AAA -5 (second), BBB -5");
  assert.equal(r.wins, 1);
  assert.equal(r.losses, 2);
  assert.equal(r.unmatchedSellShares, 3);
  assert.equal(r.buys, 3);
  assert.equal(r.sells, 4);
  assert.deepEqual(r.stillHeld, []);
});

test("speed statistics: typical, 95th percentile and slowest", () => {
  const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 1000].map((ms, i) => ({ clientOrderId: `c${i}`, tradeDate: D, symbol: "A", qty: 1, referencePrice: 1, stopPrice: 1, status: "filled" as const, alpacaOrderId: null, filledQty: 1, filledAvgPrice: 1, note: null, acceptMs: ms }));
  assert.deepEqual(speedStats(rows), { n: 10, median: 60, p95: 1000, slowest: 1000 });
  assert.equal(speedStats([]), null);
});

test("the summary of a very busy day stays short and carries the trade count, speed, fees and request use", async () => {
  const broker = new FakeBroker();
  const day = await ensureDay({ store: new MemoryStore(), broker }, D);
  const orders = Array.from({ length: 400 }, (_, i) => fill({ id: `b${i}`, symbol: `S${i % 90}`, side: "buy", qty: 10, filledQty: 10, filledAvgPrice: 10, filledAt: `2026-11-02T15:${String(i % 60).padStart(2, "0")}:00Z`, legs: [fill({ id: `s${i}`, symbol: `S${i % 90}`, side: "sell", qty: 10, filledQty: 10, filledAvgPrice: i % 3 ? 10.02 : 9.98, filledAt: `2026-11-02T16:${String(i % 60).padStart(2, "0")}:00Z` })] }));
  const text = formatSummary({ day: { ...day, status: "approved", dayStartEquity: 20000 }, stored: [], refusals: Array.from({ length: 50 }, (_, i) => ({ tradeDate: D, symbol: "(many)", reason: `reason number ${i % 7} with a long explanation that goes on`, detail: { count: 100 } })), alpacaOrders: orders, account: { ...broker.account, equity: 20010 }, peak: null, stop: null, flat: true, requests: { requestsLastMinute: 120, lowestBudget: 90, peakTradesPerMinute: 80, refusedByGovernor: 12 }, feesRunning: 12.34 });
  assert.ok(text.length < 2000, `fits in one message (${text.length})`);
  for (const w of ["Trades:", "Estimated regulatory fees", "Running total 12.34", "Alpaca requests", "Refused entries: 5000"]) assert.ok(text.includes(w), w);
  assert.ok(text.split("\n").length < 25);
  assert.ok(!text.includes("never an instruction to act"));
});

// ---------- messages ----------
test("every outgoing message ends with 'Paper trading only.' once, and a long one is cut without losing it", () => {
  assert.equal(finalizeMessage("Armed for Monday."), "Armed for Monday.\nPaper trading only.");
  assert.equal(finalizeMessage("Already says Paper trading only."), "Already says Paper trading only.");
  const long = finalizeMessage("x".repeat(5000));
  assert.ok(long.length <= 2000 && long.endsWith("Paper trading only.") && long.includes("(cut short)"));
});

test("reports of what the bot did drop the 'never an instruction to act' line; requests and the live list keep it", async () => {
  const r = rig();
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("13:45:00");
  const live = r.said("trading").find((t) => t.includes("live list"))!;
  assert.ok(live.includes("never an instruction to act"), "the live list is research input");
  assert.ok(r.said("commands")[0]!.includes("never an instruction to act"), "so is the request for limits");
  r.broker.positions = [{ symbol: "AAA", qty: 5, marketValue: 500, avgEntryPrice: 100, unrealizedPl: 0 }];
  r.ownerSays("flatten", "14:00:00");
  await r.at("14:00:10");
  await r.at("20:55:00");
  const reports = r.bot.posts.filter((p) => /flat|Stopped|sold|Armed/.test(p.text) && !p.text.includes("Suggested limits") && !p.text.includes("Good morning") && !p.text.includes("live list"));
  assert.ok(reports.length >= 2);
  for (const p of reports) assert.ok(!p.text.includes("never an instruction to act"), p.text.slice(0, 60));
  for (const p of r.bot.posts) assert.ok(p.text.includes("Paper trading only."), p.text.slice(0, 60));
});

// ---------- run log ----------
test("run log: warnings and errors, and the info events that tell the story of a day, are stored; per-trade events are not", () => {
  assert.equal(shouldStoreEvent("error", "anything"), true);
  assert.equal(shouldStoreEvent("warn", "anything"), true);
  for (const e of ["command", "limits_decision", "unprotected_position", "sell_refused", "worker_started"]) assert.equal(shouldStoreEvent("info", e), true, e);
  for (const e of ["signal", "entry_sent", "entry_refused", "stream_started_x"]) assert.equal(shouldStoreEvent("info", e), false, e);
});

// ---------- names on the live list ----------
test("live list: numbered, one per line, company name and ticker, ticker alone when there is no name", () => {
  const text = formatLiveList(["INTC", "AAPL", "ZZZZ"], { INTC: "Intel", AAPL: "Apple" });
  assert.equal(text, "1. Intel (INTC)\n2. Apple (AAPL)\n3. ZZZZ");
  assert.equal(cleanCompanyName("Intel Corporation - Common Stock"), "Intel");
  assert.equal(cleanCompanyName("Coinbase Global, Inc. - Class A Common Stock"), "Coinbase Global");
  assert.equal(cleanCompanyName("Eli Lilly and Company"), "Eli Lilly");
  const names = parseNames("Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares\nINTC|Intel Corporation - Common Stock|Q|N|N|100|N|N\nFile Creation Time: 1|||||||", "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol\nHRL|Hormel Foods Corporation Common Stock|N|HRL|N|100|N|HRL");
  assert.equal(names.get("INTC"), "Intel");
  assert.equal(names.get("HRL"), "Hormel Foods");
});

// ---------- several commands in one message ----------
test("several commands in one message: each line is read, each gets a reply, an unknown line is named, nothing is lost", async () => {
  const r = rig();
  await r.at("2026-11-01T22:10:00Z");
  const before = r.bot.posts.length;
  r.ownerSays("Position 2000\nLoss 500\n\nTrades 200\nCap 1\nfoo bar", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  const day = (await r.store.getDay(D))!;
  assert.equal(day.limits.maxPositionUsd, 2000);
  assert.equal(day.limits.dailyLossStopUsd, 500);
  assert.equal(day.limits.maxTradesPerMinute, 20, "trades 200 was refused, so the value did not change");
  assert.equal(day.decided.trades, undefined);
  assert.equal(day.decided.cap, true);
  const replies = r.bot.posts.slice(before).filter((p) => p.channel === "commands");
  assert.equal(replies.length, 1, "the replies go out together in one message");
  const text = replies[0]!.text;
  for (const w of ["**Position 2000**", "**Loss 500**", "**Trades 200**: Not changed: trades a minute must be a whole number from 1 to 100", "**Cap 1**", "**foo bar**: I did not understand the line \"foo bar\""]) assert.ok(text.includes(w), w);
  // a single line behaves as before
  const n = r.bot.posts.length;
  r.ownerSays("approve", "2026-11-01T22:21:00Z");
  await r.at("2026-11-01T22:21:10Z");
  assert.ok(!r.bot.posts[n]!.text.startsWith("**approve**"), "no prefix for a single line");
  assert.equal((await r.store.getDay(D))!.decided.trades, true);
});

test("many lines: only the first twenty are read, and the owner is told", async () => {
  const r = rig();
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays(Array.from({ length: 25 }, () => "limits").join("\n"), "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  assert.ok(r.bot.posts.some((p) => p.text.includes("only read the first 20 lines; 5 more were ignored")));
});

// ---------- when limits can change ----------
async function armedDay(over: { trades?: number } = {}) {
  const r = rig();
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays(`position 1000\nloss 200\ntrades ${over.trades ?? 20}\ncap 2`, "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.ownerSays("approve", "2026-11-01T22:20:20Z");
  await r.at("2026-11-01T22:20:30Z");
  await r.at("14:25:00"); // Armed
  assert.ok((await r.store.getDay(D))!.phases.armed);
  return r;
}

test("before Armed any limit can change, in either direction, up to the Armed message", async () => {
  const r = rig();
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("position 500\nposition 5000\ntrades 100", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  const day = (await r.store.getDay(D))!;
  assert.equal(day.limits.maxPositionUsd, 5000);
  assert.equal(day.limits.maxTradesPerMinute, 100);
  await r.at("14:20:00");
  r.ownerSays("loss 1000", "14:21:00");
  await r.at("14:21:05");
  assert.equal((await r.store.getDay(D))!.limits.dailyLossStopUsd, 1000, "up to five minutes before the open it is still open");
});

test("after Armed tightening works at any time, in the session too, and loosening is locked until the next evening post", async () => {
  const r = await armedDay();
  r.ownerSays("trades 10", "14:26:00");
  r.ownerSays("loss 100", "14:26:01");
  r.ownerSays("position 500", "14:26:02");
  await r.at("14:26:10");
  let day = (await r.store.getDay(D))!;
  assert.deepEqual([day.limits.maxTradesPerMinute, day.limits.dailyLossStopUsd, day.limits.maxPositionUsd], [10, 100, 500]);
  r.ownerSays("trades 50\nposition 900\nloss 150\ncap 4", "14:27:00");
  await r.at("14:27:10");
  day = (await r.store.getDay(D))!;
  assert.deepEqual([day.limits.maxTradesPerMinute, day.limits.dailyLossStopUsd, day.limits.maxPositionUsd, day.limits.borrowingCap], [10, 100, 500, 2], "every loosening was refused");
  assert.equal(r.bot.last().split("Locked").length - 1, 4, "each refused line says Locked");
  // in the middle of the session (the market has opened) a tighter limit still applies to today
  r.ownerSays("trades 5", "15:00:00");
  await r.at("15:00:10");
  assert.equal((await r.store.getDay(D))!.limits.maxTradesPerMinute, 5);
  assert.ok(r.bot.last().includes("armed"), "the reply says why");
  // and the gate sees the tighter cap at once
  assert.equal((await r.store.getDay(D))!.status, "approved");
});

test("after the close, the evening post opens the next day for any change again", async () => {
  const r = await armedDay();
  await r.at("21:05:00");
  r.broker.calendar = [{ date: "2026-11-02", open: "09:30", close: "16:00" }, { date: "2026-11-03", open: "09:30", close: "16:00" }];
  await r.at("21:15:00"); // the request for Tuesday
  const tuesday = (await r.store.getDay("2026-11-03"))!;
  assert.ok(tuesday.phases.request);
  r.ownerSays("trades 90\nposition 3000", "21:20:00");
  await r.at("21:20:10");
  const t = (await r.store.getDay("2026-11-03"))!;
  assert.equal(t.limits.maxTradesPerMinute, 90, "unlocked for the next day");
  assert.equal(t.limits.maxPositionUsd, 3000);
  assert.equal((await r.store.getDay(D))!.limits.maxTradesPerMinute, 20, "today is untouched");
});

// ---------- last approved limits, carried forward ----------
test("each evening the suggestion is the last approved value of each limit; a limit with no approved value uses the built-in one; the post says which", async () => {
  const broker = new FakeBroker();
  broker.calendar = [{ date: "2026-11-02", open: "09:30", close: "16:00" }, { date: "2026-11-03", open: "09:30", close: "16:00" }];
  const store = new MemoryStore();
  const mon = await ensureDay({ store, broker }, "2026-11-02");
  // Michael decided position, loss and cap on Monday (the old shape also had a daily trade count that must NOT be carried)
  await store.updateDay("2026-11-02", { limits: { maxPositionUsd: 2000, dailyLossStopUsd: 500, maxTradesPerDay: 100, borrowingCap: 1 } as any, decided: { position: true, loss: true, trades: true, cap: true }, status: "approved" });
  void mon;
  const tue = await ensureDay({ store, broker }, "2026-11-03");
  assert.equal(tue.limits.maxPositionUsd, 2000);
  assert.equal(tue.limits.dailyLossStopUsd, 500);
  assert.equal(tue.limits.borrowingCap, 1);
  assert.equal(tue.limits.maxTradesPerMinute, SUGGESTED_LIMITS.maxTradesPerMinute, "the daily count is not a per-minute cap");
  assert.deepEqual(tue.carried, { position: "2026-11-02", loss: "2026-11-02", cap: "2026-11-02" });
  assert.deepEqual(tue.decided, {}, "Michael still approves every day: nothing is decided");
  assert.equal(tue.status, "pending");
  const text = formatLimitsRequest(tue);
  assert.ok(text.includes("suggested from your approval on 2026-11-02"));
  assert.ok(text.includes("new suggestion: no earlier approved value"), "trades a minute is new");
  assert.ok(limitLines(tue).split("\n")[2]!.includes("orders a minute"));
  // the most recent approval wins
  await store.updateDay("2026-11-03", { limits: { ...tue.limits, maxPositionUsd: 750 }, decided: { position: true } });
  const wed = await suggestedFromHistory(store, "2026-11-04");
  assert.equal(wed.limits.maxPositionUsd, 750);
  assert.equal(wed.carried.position, "2026-11-03");
  assert.equal(wed.carried.loss, "2026-11-02");
});

// ---------- an old-shape day saved by the previous release ----------
test("Tuesday's day saved by the previous release is reset: new limits, nothing decided, the old request forgotten so it is posted again", async () => {
  const broker = new FakeBroker();
  broker.calendar = [{ date: "2026-11-02", open: "09:30", close: "16:00" }, { date: "2026-11-03", open: "09:30", close: "16:00" }];
  const store = new MemoryStore();
  await ensureDay({ store, broker }, "2026-11-02");
  await store.updateDay("2026-11-02", { limits: { maxPositionUsd: 2000, dailyLossStopUsd: 500, maxTradesPerDay: 100, borrowingCap: 1 } as any, decided: { position: true, loss: true, trades: true, cap: true }, status: "approved" });
  // the old release's Tuesday: old shape, request posted, even already approved this evening
  const oldTue: DayRecord = { tradeDate: "2026-11-03", isTradingDay: true, openAt: new Date("2026-11-03T14:30:00Z"), closeAt: new Date("2026-11-03T21:00:00Z"), status: "approved", dayStartEquity: 20000, suggested: { maxPositionUsd: 1000, dailyLossStopUsd: 200, maxTradesPerDay: 10, borrowingCap: 1 } as any, limits: { maxPositionUsd: 1500, dailyLossStopUsd: 150, maxTradesPerDay: 5, borrowingCap: 2 } as any, decided: { position: true, loss: true, trades: true, cap: true }, liveList: null, phases: { request: "2026-11-02T21:10:06.150Z", morning: "x" } };
  await store.createDay(oldTue);
  const read = (await store.getDay("2026-11-03"))!;
  assert.equal(normalizeDay(read).status, "pending", "read in the new shape, an old approval no longer stands");
  const reset = await resetOldShapeFutureDays(store, new Date("2026-11-02T23:55:00Z"));
  assert.deepEqual(reset, ["2026-11-03"]);
  const tue = (await store.getDay("2026-11-03"))!;
  assert.equal(tue.status, "pending");
  assert.deepEqual(tue.decided, {});
  assert.equal(tue.phases.request, undefined, "the request will be posted again in the new format");
  assert.equal(tue.phases.morning, undefined);
  assert.equal(tue.phases.c2, "1");
  assert.equal(tue.limits.maxPositionUsd, 2000, "suggested from Monday's approval, not from Michael's unapproved change or the old constant");
  assert.equal(tue.limits.maxTradesPerMinute, SUGGESTED_LIMITS.maxTradesPerMinute);
  // a day already in the new shape, a past day and a second run change nothing
  assert.deepEqual(await resetOldShapeFutureDays(store, new Date("2026-11-02T23:56:00Z")), []);
});

test("after the reset the worker posts Tuesday's request again, and an answer from before it cannot count", async () => {
  const r = rig();
  r.broker.calendar = [{ date: "2026-11-02", open: "09:30", close: "16:00" }, { date: "2026-11-03", open: "09:30", close: "16:00" }];
  await r.store.createDay({ tradeDate: "2026-11-03", isTradingDay: true, openAt: new Date("2026-11-03T14:30:00Z"), closeAt: new Date("2026-11-03T21:00:00Z"), status: "approved", dayStartEquity: 20000, suggested: { maxPositionUsd: 1000, dailyLossStopUsd: 200, maxTradesPerDay: 10, borrowingCap: 1 } as any, limits: { maxPositionUsd: 1500, dailyLossStopUsd: 150, maxTradesPerDay: 5, borrowingCap: 2 } as any, decided: { position: true, loss: true, trades: true, cap: true }, liveList: null, phases: { request: "2026-11-02T21:10:06.150Z" } });
  r.ownerSays("approve", "2026-11-02T23:00:00Z"); // an answer to the old post, sent before the release
  await r.at("2026-11-02T23:56:00Z");
  const posts = r.said("commands").filter((t) => t.includes("Suggested limits for Tuesday"));
  assert.equal(posts.length, 1, "Tuesday's request is posted again");
  assert.ok(posts[0]!.includes("orders a minute"), "in the new format, with trades a minute");
  assert.equal((await r.store.getDay("2026-11-03"))!.status, "pending", "the old answer did not approve it");
});

// ---------- the stop flag is read once per entry from memory but a stop always wins ----------
test("a stop command sets the flag in memory before it does anything else, so the very next entry is refused", async () => {
  const mem = new MemoryStore();
  const store = new CachingStore(mem);
  const r = rig({ store });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  r.ownerSays("stop", "14:40:00");
  await r.at("14:40:05");
  await r.ramp("AAA", [...Array(12).fill(100), 100.5], "14:41:00");
  assert.equal(r.broker.count("submitEntry"), 0);
  assert.ok((await mem.listRefusals(D)).some((x) => x.reason === "stop flag is set"));
});
