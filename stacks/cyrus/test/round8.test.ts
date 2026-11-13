// Round 8 (Michael's decisions of 2026-11-03, after review round 7). Each test was checked to fail with its change taken out
// (recorded in builds/build-c2-log.md). The 5 second loss stop check itself is tested in round7.test.ts.
//   A. After a failed loss stop sale, only the sales that failed are retried, every 5 seconds, inside a request budget, pausing
//      only after a rate-limit answer. With 40 positions and repeated refusals Alpaca's limit is never reached and the close-out
//      still gets through.
//   B. Michael's commands unreadable for 2 minutes: new entries blocked, one alert; safety work carries on; entries resume
//      when a read works. Also after a restart (the gap round 7 found in v5).
//   C. The fee wording: the paper account is charged regulatory fees.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AlpacaError } from "../src/alpaca-trading.ts";
import { ensureDay } from "../src/morning.ts";
import { enforceDailyLoss, LossStopMemory, LOSS_STOP_REQUESTS_PER_MINUTE, LOSS_STOP_RETRY_PER_CHECK } from "../src/risk.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SAFETY_RESERVE } from "../src/governor.ts";
import { SUGGESTED_LIMITS } from "../src/limits.ts";
import { estimateFees } from "../src/fees.ts";
import { feeLines } from "../src/summary.ts";
import { CONTROL_STOP, MemoryStore, type StopFlag, type Store } from "../src/store.ts";
import { FakeBroker } from "./helpers.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle, z } from "./rig.ts";

const stopIn = async (s: Store) => (await s.getControl<StopFlag>(CONTROL_STOP))?.on === true;
const plus = (t: string, seconds: number) => new Date(z(t).getTime() + seconds * 1000).toISOString();

// ---------- A. the loss stop's retry ----------

// The loss stop has fired (the flag is saved) and these positions are still held: every check from here is a retry.
async function afterLossStop(symbols: string[], opts: { governor?: { budget(): number } } = {}) {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const clock = { t: z("16:00:00") };
  const said: string[] = [];
  const say = async (_c: string, t: string) => (said.push(t), true);
  const gate = new SellGate({ broker, say: say as any, nowMs: () => clock.t.getTime() });
  const liquidator = new Liquidator({ broker, gate, now: () => clock.t, sleep: async () => undefined });
  const deps = { broker, store, now: () => clock.t, say: say as any, lossMemory: new LossStopMemory(), liquidator, governor: opts.governor };
  await ensureDay(deps, D);
  await store.updateDay(D, { status: "approved", dayStartEquity: 20000, limits: { ...SUGGESTED_LIMITS, dailyLossStopUsd: 200 }, decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "x", armed: "x" } });
  await store.setControl(CONTROL_STOP, { on: true, at: clock.t.toISOString(), reason: "daily loss stop reached (500.00 dollars)" } satisfies StopFlag);
  broker.positions = symbols.map((symbol) => ({ symbol, qty: 10, marketValue: 1000, avgEntryPrice: 100, unrealizedPl: 0 }));
  const check = async () => enforceDailyLoss(deps, (await store.getDay(D))!);
  const step = (seconds: number) => void (clock.t = new Date(clock.t.getTime() + seconds * 1000));
  const sells = (sym?: string) => broker.calls.filter((c) => c.fn === "submitSell" && (!sym || (c.args[0] as { symbol: string }).symbol === sym)).length;
  return { store, broker, clock, said, check, step, sells };
}

test("after a failed loss stop sale, only the sales that failed are retried: no second whole-account liquidation", async () => {
  const p = await afterLossStop(["AAA", "BBB", "CCC"]);
  p.broker.onSell = async (s) => { if (s.symbol === "BBB") throw new AlpacaError("sell refused (test)", 403); };
  await p.check();
  assert.deepEqual(p.broker.positions.map((x) => x.symbol), ["BBB"], "AAA and CCC sold on the first retry");
  p.step(5);
  await p.check();
  assert.equal(p.sells("BBB"), 2, "BBB tried again 5 seconds later");
  assert.equal(p.sells("AAA") + p.sells("CCC"), 2, "nothing else is sold again");
  assert.equal(p.broker.count("cancelAllOrders"), 0, "no bulk cancel");
  assert.equal(p.broker.count("getClock"), 0, "the liquidator's rounds never ran");
  p.broker.onSell = null;
  p.step(5);
  await p.check();
  assert.equal(p.broker.positions.length, 0, "sold once Alpaca accepts it");
});

test("a working market sell is left alone: nothing more is sent for shares it covers, and it is not cancelled", async () => {
  const p = await afterLossStop(["AAA"]);
  const { order } = await import("./helpers.ts");
  p.broker.orders = [order({ id: "00000000-0000-0000-0000-0000000000aa", side: "sell", type: "market", status: "accepted", symbol: "AAA", qty: 4, clientOrderId: "by-hand" })];
  await p.check();
  assert.equal(p.sells("AAA"), 1, "one sell, for the 6 shares nothing covers");
  assert.equal((p.broker.calls.find((c) => c.fn === "submitSell")!.args[0] as { qty: number }).qty, 6);
  assert.equal(p.broker.count("cancelOrder") + p.broker.count("cancelAllOrders"), 0);
});

test("the retry pauses only after a rate-limit answer (10 seconds, then 20); any other refusal is tried again every 5 seconds", async () => {
  const refused = await afterLossStop(["AAA"]);
  refused.broker.onSell = async () => { throw new AlpacaError("insufficient buying power (test)", 403); };
  for (let i = 0; i < 4; i++) (await refused.check(), refused.step(5));
  assert.equal(refused.sells(), 4, "a 403 is retried on every 5 second check");

  const limited = await afterLossStop(["AAA"]);
  limited.broker.onSell = async () => { throw new AlpacaError("rate limit exceeded", 429); };
  const at: number[] = [];
  for (let s = 0; s <= 30; s += 5) {
    const before = limited.sells();
    await limited.check();
    if (limited.sells() > before) at.push(s);
    limited.step(5);
  }
  assert.deepEqual(at, [0, 10, 30], "after a 429: wait 10 seconds, then 20 (then 40)");
  limited.broker.onSell = null;
  for (let s = 35; s <= 70; s += 5) (await limited.check(), limited.step(5));
  assert.equal(limited.broker.positions.length, 0, "and it sells once Alpaca has room");
});

test("the retry never spends Alpaca's safety reserve: with the governor at the reserve it sends nothing", async () => {
  const p = await afterLossStop(["AAA"], { governor: { budget: () => SAFETY_RESERVE } });
  await p.check();
  assert.equal(p.broker.count("listPositions") + p.sells(), 0);
});

test("the retry keeps inside its budget of 60 requests a minute, with 40 positions all refused, and every symbol gets its turn", async () => {
  const syms = Array.from({ length: 40 }, (_, i) => `S${String(i).padStart(2, "0")}`);
  const p = await afterLossStop(syms);
  p.broker.onSell = async () => { throw new AlpacaError("sell refused (test)", 403); };
  const req = () => p.broker.calls.filter((c) => ["listPositions", "listOrdersPaged", "submitSell", "cancelOrder", "cancelAllOrders", "getAccount"].includes(c.fn)).length;
  const marks: number[] = [];
  for (let s = 0; s < 180; s += 5) {
    marks.push(req());
    await p.check();
    p.step(5);
  }
  marks.push(req());
  let worst = 0;
  let worstCheck = 0;
  for (let i = 0; i + 12 < marks.length; i++) worst = Math.max(worst, marks[i + 12]! - marks[i]!); // 12 checks = 60 seconds
  for (let i = 0; i + 1 < marks.length; i++) worstCheck = Math.max(worstCheck, marks[i + 1]! - marks[i]!);
  assert.ok(worst <= LOSS_STOP_REQUESTS_PER_MINUTE, `at most ${LOSS_STOP_REQUESTS_PER_MINUTE} in any minute (was ${worst})`);
  assert.ok(worstCheck <= LOSS_STOP_RETRY_PER_CHECK, `at most ${LOSS_STOP_RETRY_PER_CHECK} in one check, spread over the minute (was ${worstCheck})`);
  const tried = new Set(p.broker.calls.filter((c) => c.fn === "submitSell").map((c) => (c.args[0] as { symbol: string }).symbol));
  assert.equal(tried.size, 40, "every symbol was tried");
});

test("the retry is quiet from 6 minutes before the close: the close-out (5 minutes before) sells what is left", async () => {
  const p = await afterLossStop(["AAA"]);
  p.clock.t = z("20:54:30"); // the close is 21:00 UTC on this day
  await p.check();
  assert.equal(p.broker.count("listPositions") + p.sells(), 0, "nothing in the minute before the close-out");
  p.clock.t = z("20:53:55");
  await p.check();
  assert.equal(p.sells(), 1, "but it still works just before that");
});

test("when the loss stop's one-round sale leaves sells still filling, it says so, and says when the account is flat", async () => {
  const p = await afterLossStop(["AAA", "BBB"]);
  await p.store.setControl(CONTROL_STOP, { on: false, at: p.clock.t.toISOString(), reason: "owner command (resume)" } satisfies StopFlag);
  p.broker.sellsStick = true; // sells are accepted but not filled yet
  p.broker.account = { ...p.broker.account, equity: 19500 };
  assert.equal(await p.check(), true, "fired");
  await settle();
  assert.ok(p.said.some((t) => t.includes("sent a sell for every position")), "no false 'could not sell'");
  assert.ok(!p.said.some((t) => t.includes("could not sell")));
  p.broker.positions = [];
  p.step(5);
  await p.check();
  await settle();
  assert.ok(p.said.some((t) => t.includes("everything is sold, the account is flat")));
});

// Michael's test: 40 open positions, the loss stop fires, every sale is refused until the close-out, and every retry is refused
// all day. Alpaca's simulated bucket (200 a minute, 429 above it) must never be reached and the close-out must end flat.
test("40 positions and repeated refusals: total requests stay under Alpaca's limit, no rate-limit answer, and the close-out gets through", { timeout: 120_000 }, async () => {
  const START = Date.UTC(2026, 10, 1, 22, 0); // before the evening approval: the worker runs on the simulator's clock
  const CLOSEOUT = Date.UTC(2026, 10, 2, 20, 55);
  const sim = new SimBroker(START);
  const events: string[] = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, log: (_l, e) => void events.push(e), midday: false }); // one clock, as in production; the mid-day cycle (on in production) would sell at 10:30 CT; it is tested in midday.test.ts
  sim.onRate = (remaining) => r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining, reset: null });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("loss 200\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  assert.ok((await r.store.getDay(D))!.phases.armed);
  const syms = Array.from({ length: 40 }, (_, i) => `S${String(i).padStart(2, "0")}`);
  for (const sym of syms) {
    const id = clientOrderIdFor(D, sym, 1);
    await sim.submitEntry({ symbol: sym, qty: 40, stopPrice: 9.5, takeProfitPrice: 10.5, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    // Written down with the simulator's time of the entry, so the order sync matches it and its missing-exit check is live.
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: sym, qty: 40, referencePrice: 10, stopPrice: 9.5, takeProfitPrice: 10.5, status: "filled", alpacaOrderId: null, filledQty: 40, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  }
  // The loss stop's own first sale and every sale before the close-out are refused; every retry is refused all day.
  sim.refuseSellIf = (s) => s.clientOrderId.endsWith("-r") || sim.simMs < CLOSEOUT;
  const from = Date.UTC(2026, 10, 2, 20, 39);
  for (let t = from; t <= Date.UTC(2026, 10, 2, 20, 58); t += 5_000) {
    if (t === Date.UTC(2026, 10, 2, 20, 40)) for (const sym of syms) sim.prices.set(sym, 9.6); // down 640 against 200
    sim.advanceTo(t);
    await r.at(new Date(t).toISOString());
  }
  await settle();
  const times = sim.bucketTimes.filter((x) => x >= from).sort((a, b) => a - b);
  let worst = 0;
  let worstAt = 0;
  for (let i = 0, j = 0; i < times.length; i++) {
    while (times[i]! - times[j]! >= 60_000) j++;
    if (i - j + 1 > worst) (worst = i - j + 1, worstAt = times[j]!);
  }
  if (process.env.DEBUG_R8) {
    const bins = new Map<string, number>();
    for (const x of times) { const k = new Date(Math.floor(x / 10_000) * 10_000).toISOString().slice(11, 19); bins.set(k, (bins.get(k) ?? 0) + 1); }
    console.log("worst window from", new Date(worstAt).toISOString(), [...bins].map(([k, v]) => `${k}:${v}`).join(" "));
  }
  if (process.env.DEBUG_R8) console.log("events", [...new Set(events)].join(","), "unprotected", events.filter((e) => e === "unprotected_position").length);
  console.log(`40-position refusal rehearsal: busiest minute ${worst} requests, lowest bucket ${Math.floor(sim.lowestTokens)}, rate-limit answers ${sim.rejected429}`);
  assert.equal(await stopIn(r.store), true, "the loss stop fired");
  assert.equal(sim.rejected429, 0, "Alpaca never answered 'too many requests'");
  assert.ok(worst < 200, `under 200 in every minute (busiest ${worst})`);
  assert.equal((await sim.listPositions()).length, 0, "the close-out got through: flat");
  assert.equal(sim.oversellAttempts, 0);
  assert.equal((await r.store.getDay(D))!.phases.closeout !== undefined, true, "close-out recorded");
});

// ---------- B. Michael's commands unreadable for 2 minutes ----------

async function armedWithList() {
  const r = rig<FakeBroker, MemoryStore>({ liveList: ["BBB", "CCC", "DDD"] });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("loss 200\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("14:15:00");
  await r.at("14:25:00");
  assert.ok((await r.store.getDay(D))!.phases.armed, "armed");
  return r;
}
const RAMP = [...Array(12).fill(50), 50.4];
const ticks = async (r: { at: (t: string) => Promise<void> }, fromT: string, seconds: number) => {
  for (let s = 0; s <= seconds; s += 5) await r.at(plus(fromT, s));
};

test("commands unreadable: entries go on for 2 minutes, then are blocked with one alert, and resume when a read works", async () => {
  const r = await armedWithList();
  await ticks(r, "14:40:00", 0);
  const real = r.bot.commandMessagesAfter.bind(r.bot);
  let down = true;
  r.bot.commandMessagesAfter = async (id: string) => {
    if (down) throw new Error("Discord answered 503 (test)");
    return real(id);
  };
  await ticks(r, "14:40:05", 55);
  await r.ramp("BBB", RAMP, "14:41:01");
  assert.equal(r.broker.count("submitEntry"), 1, "75 seconds without a read: still trading (the ruling is 2 minutes)");
  await ticks(r, "14:41:15", 50); // to 14:42:05
  const alerts = () => r.said("alerts").filter((t) => t.includes("not been able to read your commands"));
  assert.equal(alerts().length, 1, "one alert at 2 minutes");
  await r.ramp("CCC", RAMP, "14:42:06");
  assert.equal(r.broker.count("submitEntry"), 1, "blocked: no new entry");
  await ticks(r, "14:42:20", 60);
  assert.equal(alerts().length, 1, "still one alert");
  down = false;
  await r.at("14:43:25");
  assert.ok(r.said("alerts").some((t) => t.includes("can read your commands again")), "told when it is over");
  await r.ramp("CCC", RAMP, "14:43:26");
  assert.equal(r.broker.count("submitEntry"), 2, "entries resume");
});

test("while commands are unreadable the daily loss stop still fires and sells", async () => {
  const r = await armedWithList();
  r.broker.positions = [{ symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 }];
  await r.store.insertOrder({ clientOrderId: "cyrus-20261102-AAA-1", tradeDate: D, symbol: "AAA", qty: 20, referencePrice: 50, stopPrice: 49, status: "filled", alpacaOrderId: "x", filledQty: 20, filledAvgPrice: 50, note: null, createdAt: "2026-11-02T14:40:00.000Z" });
  await ticks(r, "14:40:00", 0);
  r.bot.commandMessagesAfter = async () => { throw new Error("Discord answered 503 (test)"); };
  await ticks(r, "14:40:05", 150);
  r.broker.account = { ...r.broker.account, equity: 19500 };
  await ticks(r, "14:42:40", 10);
  await settle();
  assert.equal(await stopIn(r.store), true);
  assert.equal(r.broker.positions.length, 0, "sold");
});

test("a pass stuck for over 2 minutes is not reading commands either: the tick itself sends the one alert and entries stay blocked", { timeout: 10_000 }, async () => {
  const r = await armedWithList();
  await ticks(r, "14:40:00", 0);
  r.store.getDay = () => new Promise(() => undefined); // the next pass reads commands, then hangs on the database
  r.setNow("14:40:05");
  void r.worker.tick();
  await settle();
  await ticks(r, "14:40:10", 120); // to 14:42:10
  assert.equal(r.said("alerts").filter((t) => t.includes("not been able to read your commands")).length, 1);
  await r.ramp("CCC", RAMP, "14:42:11");
  assert.equal(r.broker.count("submitEntry"), 0);
});

// Round 7's note, also in v5: after a restart the start-up check works but the read of commands keeps failing, so a `stop` sent
// while the worker was down sits unread. Before round 8 live prices started and an entry went out.
test("a restart whose command reads keep failing never enters: a stop sent meanwhile is read before any entry", async () => {
  const r1 = await armedWithList();
  await r1.at("14:50:00");
  r1.worker.stop();
  const real = r1.bot.commandMessagesAfter.bind(r1.bot);
  let down = true;
  r1.bot.commandMessagesAfter = async (id: string) => {
    if (down) throw new Error("Discord answered 503 (test)");
    return real(id);
  };
  r1.ownerSays("stop", "14:54:00"); // sent while the worker was down
  const r2 = rig<FakeBroker, MemoryStore>({ store: r1.store, broker: r1.broker, bot: r1.bot, liveList: ["BBB", "CCC", "DDD"] });
  await ticks(r2, "14:55:00", 20);
  await r2.ramp("BBB", RAMP, "14:55:21");
  assert.equal(r2.broker.count("submitEntry"), 0, "no entry while commands have not been read since the start");
  down = false;
  await r2.at("14:55:40");
  assert.equal(await stopIn(r1.store), true, "the stop is read");
  await r2.ramp("CCC", RAMP, "14:55:41");
  assert.equal(r2.broker.count("submitEntry"), 0, "and it holds");
});

// ---------- C. the fee wording ----------
test("the daily summary and the fee code say the paper account is charged regulatory fees", () => {
  const line = feeLines(D, estimateFees(D, [{ side: "sell", qty: 100, price: 50 }]), null).join("\n");
  assert.ok(!/pays none/.test(line), line);
  assert.ok(line.includes("paper account too"), line);
  const src = readFileSync(new URL("../src/fees.ts", import.meta.url), "utf8");
  assert.ok(!/charges none/.test(src), "the fee code's comment no longer says paper charges none");
});
