// The release of 2026-11-11 (builds/build-c2-log.md, "Michael's decisions of 2026-11-11"). Part 1: `load afternoon`, Michael's
// standing requirement: on any day, while flat and paused at mid-day and before 1:30 PM Central, the rest of the day until the last
// entry is a load window (load-day entries and exits, at most 75 dollars, up to 150 orders a minute even above the approved limit),
// the command resumes trading itself, and on a normal morning the cheap-symbol screen runs and the price feed switches first.
// The simulated day is 2026-11-02: open 14:30 UTC (8:30 CT), pause 16:30 UTC, 1:30 PM CT is 19:30 UTC, last entry 20:00 UTC (2:00 PM
// CT), the close 21:00 UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";
import { OrderGate } from "../src/gate.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Governor } from "../src/governor.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { ensureDay, parseCommand } from "../src/morning.ts";
import { MemoryStore, CONTROL_STOP, setPhase, type DayRecord } from "../src/store.ts";
import { FakeBroker, order } from "./helpers.ts";
import type { Signal } from "../src/strategy.ts";
import { BusyPlaceholder } from "../src/strategy.ts";
import { LOAD_AFTERNOON_PHASE, LOAD_PHASE, afternoonLoadWindow, hasLoadEntries, inAfternoonLoad, inLoadWindow, loadCeilingOn, loadRulesApply } from "../src/load-mode.ts";
import { MIDDAY_PHASE, readPause, updatePause, emptyPause } from "../src/midday.ts";
import { loadAfternoonRefusal } from "../src/commands.ts";
import { TradeStream } from "../src/stream.ts";
import { settings } from "./helpers.ts";
import { SelfMonitor, parseMemAvailable, parseProcStat } from "../src/self-monitor.ts";

const until = async (cond: () => boolean | Promise<boolean>, n = 400) => {
  for (let i = 0; i < n && !(await cond()); i++) await settle();
};

// An approved, armed normal day in the simulator, flat after the mid-day close-out (as midday.test.ts does it).
async function flatAtMidday(opts: { load?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const events: Array<{ e: string; d: any }> = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, log: (_l, e, d) => void events.push({ e, d }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays(`${opts.load ? "load on\n" : ""}trades 20\nposition 300\napprove`, "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("13:45:00"); // the morning screen (45 minutes before the open)
  await r.at("14:25:00");
  await r.at("14:30:05");
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  return { sim, r, events };
}

// ---------------- the rules, as pure functions ----------------

const dayWith = (phases: Record<string, string>): DayRecord =>
  ({ tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), status: "approved", phases: { armed: "2026-11-02T14:25:00.000Z", ...phases }, limits: { maxPositionUsd: 300, dailyLossStopUsd: 500, maxTradesPerMinute: 20, borrowingCap: 1 }, decided: { position: true, loss: true, trades: true, cap: true }, dayStartEquity: 20000, liveList: ["AAA"] }) as unknown as DayRecord;

test("the afternoon window's rules: from `load afternoon` to the last entry, the load rules, the 150 ceiling and the churn apply; nothing changes on a normal day without it", () => {
  const normal = dayWith({});
  for (const t of ["15:00:00", "17:00:00", "19:59:59"]) {
    assert.equal(inAfternoonLoad(normal, z(t)), false);
    assert.equal(loadRulesApply(normal, z(t), true), false);
    assert.equal(loadCeilingOn(normal, z(t)), false);
    assert.equal(inLoadWindow(normal, z(t)), false);
  }
  assert.equal(hasLoadEntries(normal), false);
  assert.equal(afternoonLoadWindow(normal), null);

  const afternoon = dayWith({ [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString() });
  assert.deepEqual(afternoonLoadWindow(afternoon), { start: z("16:40:00"), end: z("20:00:00") }, "it ends at the last entry, 2:00 PM CT");
  assert.equal(hasLoadEntries(afternoon), true);
  assert.equal(inAfternoonLoad(afternoon, z("16:39:59")), false, "not before the command");
  for (const t of ["16:40:00", "18:00:00", "19:59:59"]) {
    assert.equal(inAfternoonLoad(afternoon, z(t)), true, t);
    assert.equal(loadRulesApply(afternoon, z(t), true), true, "the 75 dollar cap and the short backoff, although the pause has started");
    assert.equal(loadCeilingOn(afternoon, z(t)), true, "the 150 ceiling");
    assert.equal(inLoadWindow(afternoon, z(t)), true, "the churn");
  }
  for (const t of ["20:00:00", "20:55:00"]) {
    assert.equal(inAfternoonLoad(afternoon, z(t)), false, t);
    assert.equal(loadCeilingOn(afternoon, z(t)), false);
  }

  // A load day keeps its morning window and adds the afternoon one; the gap between them is a normal day, as before.
  const both = dayWith({ [LOAD_PHASE]: "on", [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString() });
  assert.equal(inLoadWindow(both, z("15:00:00")), true);
  assert.equal(loadRulesApply(both, z("16:35:00"), true), false, "after the pause and before `load afternoon`: a normal day");
  assert.equal(inLoadWindow(both, z("17:00:00")), true);
});

test("`load afternoon` is parsed as exactly those two words; `load on` and `load off` are unchanged", () => {
  assert.deepEqual(parseCommand("load afternoon"), { kind: "loadAfternoon" });
  assert.deepEqual(parseCommand("Load Afternoon"), { kind: "loadAfternoon" });
  assert.equal(parseCommand("load afternoon now").kind, "unknown");
  assert.equal(parseCommand("load morning").kind, "unknown");
  assert.deepEqual(parseCommand("load on"), { kind: "load", on: true });
  assert.deepEqual(parseCommand("load off"), { kind: "load", on: false });
});

test("every refusal of `load afternoon`: no cycle, not armed, already on, 1:30 PM or later, not paused, not flat yet, a stop, the not-flat flag, Alpaca unreadable, positions, open orders", () => {
  const paused = { ...emptyPause(), on: true, since: z("16:30:05").toISOString(), reason: "mid-day cycle" };
  const flatDay = dayWith({ [MIDDAY_PHASE]: z("16:30:20").toISOString(), middayFlat: "yes" });
  const ok = { day: flatDay, now: z("16:40:00"), pause: paused, stop: null, notFlat: null, positions: 0, openOrders: 0 };
  assert.equal(loadAfternoonRefusal(ok), null);
  assert.equal(loadAfternoonRefusal({ ...ok, now: z("19:29:59") }), null, "accepted until 1:30 PM CT");
  assert.match(loadAfternoonRefusal({ ...ok, now: z("19:30:00") })!, /^it is 1:30 PM CT or later/);
  assert.equal(loadAfternoonRefusal({ ...ok, day: null }), "there is no mid-day cycle today");
  assert.equal(loadAfternoonRefusal({ ...ok, day: { ...flatDay, status: "pending" } as DayRecord }), "today is not approved and armed");
  assert.equal(loadAfternoonRefusal({ ...ok, day: { ...flatDay, phases: { ...flatDay.phases, armed: undefined } } as unknown as DayRecord }), "today is not approved and armed");
  assert.equal(loadAfternoonRefusal({ ...ok, day: dayWith({ [MIDDAY_PHASE]: "x", middayFlat: "yes", [LOAD_AFTERNOON_PHASE]: z("16:35:00").toISOString() }) }), "the afternoon load window is already on today");
  assert.equal(loadAfternoonRefusal({ ...ok, pause: null }), "trading is not paused for the mid-day cycle");
  assert.equal(loadAfternoonRefusal({ ...ok, pause: { ...paused, on: false, resumedAt: z("16:35:00").toISOString(), resumedBy: "go" } }), "trading has already resumed today");
  assert.equal(loadAfternoonRefusal({ ...ok, day: dayWith({}) }), "the mid-day close-out has not finished flat yet");
  assert.match(loadAfternoonRefusal({ ...ok, stop: { on: true, reason: "owner command (stop)", at: "x" } as any })!, /the stop flag is on/);
  assert.equal(loadAfternoonRefusal({ ...ok, stop: { on: true, reason: "daily loss stop", at: "x" } as any }), "the daily loss stop is in force");
  assert.equal(loadAfternoonRefusal({ ...ok, notFlat: { on: true, since: "x", remaining: ["AAA"] } as any }), "the account was not flat after the last close-out");
  assert.equal(loadAfternoonRefusal({ ...ok, positions: null }), "I could not read Alpaca's positions and open orders");
  assert.equal(loadAfternoonRefusal({ ...ok, positions: 1 }), "Alpaca shows 1 position(s)");
  assert.equal(loadAfternoonRefusal({ ...ok, openOrders: 2 }), "Alpaca shows 2 open order(s)");
});

// ---------------- the command in the worker ----------------

test("on a normal morning, `load afternoon` while flat and paused runs the cheap-symbol screen, switches the price feed, starts the window and resumes trading", async () => {
  const { r } = await flatAtMidday();
  const before = r.counts();
  assert.equal(r.screenOpts.filter((o) => o?.load).length, 0, "a normal morning used the normal screen");
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  const day = (await r.store.getDay(D))!;
  assert.equal(day.phases[LOAD_AFTERNOON_PHASE], z("16:40:05").toISOString(), "the window starts when the command is carried out");
  const p = (await readPause(r.store, D))!;
  assert.equal(p.on, false);
  assert.equal(p.resumedBy, "load afternoon");
  assert.equal(r.screenOpts.filter((o) => o?.load).length, 1, "the cheap-symbol screen ran once");
  assert.equal(r.counts().streamStops, before.streamStops + 1, "the price feed was switched (this stream has no setSymbols: stopped and started again)");
  assert.equal(r.counts().streamStarts, before.streamStarts + 1);
  const reply = r.said("commands").find((t) => t.startsWith("Afternoon load window on until 2:00 PM"));
  assert.ok(reply, r.said("commands").join(" | "));
  assert.match(reply!, /at most 75 dollars a position and up to 150 orders a minute \(your ruling, this window only\)/);
  assert.match(reply!, /Resumed: the mid-day pause is over/);
  assert.ok(r.said("trading").some((t) => t.startsWith("Afternoon load window: the live list is now 2 cheap")));
  r.ownerSays("load afternoon", "16:41:00");
  await r.at("16:41:05");
  assert.ok(r.said("commands").some((t) => t === "Not started: the afternoon load window is already on today."));
  assert.equal(r.screenOpts.filter((o) => o?.load).length, 1, "no second screen");
});

test("after `load afternoon` a print is a 1-share limit entry with the load day's exits; after `go` instead, the normal placeholder runs", async () => {
  const { r, sim } = await flatAtMidday();
  const sent: any[] = [];
  const orig = sim.submitEntry.bind(sim);
  sim.submitEntry = async (e: any) => (sent.push(e), orig(e));
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:40:10");
  await r.trade("AAA", 20.004, "16:40:20");
  await until(() => sent.length > 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].qty, 1);
  assert.equal(sent[0].limitPrice, 20);
  assert.equal(sent[0].takeProfitPrice, 20.01);
  assert.equal(sent[0].stopPrice, 19.98);

  const w2 = await flatAtMidday();
  const sent2: any[] = [];
  const orig2 = w2.sim.submitEntry.bind(w2.sim);
  w2.sim.submitEntry = async (e: any) => (sent2.push(e), orig2(e));
  w2.r.ownerSays("go", "16:40:00");
  await w2.r.at("16:40:05");
  await w2.r.trade("AAA", 20.004, "16:40:20");
  await settle();
  assert.equal(sent2.length, 0, "one print is not a normal signal (the uptick rule needs a run of prices)");
});

test("on a load day `load afternoon` keeps the cheap list (no second screen, no feed switch); it is refused after 1:30 PM, with a position held, or with the stop on", async () => {
  const { r } = await flatAtMidday({ load: true });
  const screens = r.screenOpts.length;
  const before = r.counts();
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  assert.equal(r.screenOpts.length, screens, "no screen");
  assert.equal(r.counts().streamStops, before.streamStops, "no feed switch");
  assert.ok(r.said("commands").some((t) => t.startsWith("Afternoon load window on until 2:00 PM") && !t.includes("live list is now")));

  const late = await flatAtMidday();
  late.r.ownerSays("load afternoon", "19:30:00");
  await late.r.at("19:30:05");
  assert.ok(late.r.said("commands").some((t) => t.startsWith("Not started: it is 1:30 PM CT or later")));
  assert.equal((await readPause(late.r.store, D))!.on, true, "still paused");

  const held = await flatAtMidday();
  await held.sim.submitEntry({ symbol: "ZZZ", qty: 1, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: "manual-zzz" });
  held.sim.fillEntry("manual-zzz", 10);
  held.r.ownerSays("load afternoon", "16:40:00");
  await held.r.at("16:40:05");
  assert.ok(held.r.said("commands").some((t) => t === "Not started: Alpaca shows 1 position(s)."), held.r.said("commands").join(" | "));
  assert.equal((await held.r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined);

  const stopped = await flatAtMidday();
  stopped.r.ownerSays("stop", "16:39:00");
  await stopped.r.at("16:39:05");
  stopped.r.ownerSays("load afternoon", "16:40:00");
  await stopped.r.at("16:40:05");
  assert.ok(stopped.r.said("commands").some((t) => t.startsWith("Not started: the stop flag is on")));
});

test("a failed cheap-symbol screen does not start the window or resume trading", async () => {
  const { r } = await flatAtMidday();
  (r.worker as any).d.buildLiveList = async () => ({ symbols: [], names: {} });
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  assert.ok(r.said("commands").some((t) => t.startsWith("Not started: the cheap-symbol screen found no names. Still paused")));
  assert.equal((await readPause(r.store, D))!.on, true);
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined);
});

// ---------------- the gate in the afternoon window ----------------

async function gateAt(t: string, phases: Record<string, string>) {
  const store = new MemoryStore();
  const broker = new FakeBroker();
  let now = z(t);
  const governor = new Governor(() => now.getTime());
  const view = new BrokerView(broker, () => now.getTime());
  const say = async () => true;
  const liquidator = new Liquidator({ broker, gate: new SellGate({ broker, say: say as any }), now: () => now, sleep: async () => undefined });
  await ensureDay({ broker, store, now: () => now, say: say as any, liquidator } as any, D);
  await store.updateDay(D, { status: "approved", limits: { maxPositionUsd: 300, dailyLossStopUsd: 500, maxTradesPerMinute: 20, borrowingCap: 1 }, decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z", ...phases } } as any);
  await updatePause(store, D, { on: false, since: z("16:30:05").toISOString(), resumedAt: z("16:40:00").toISOString(), resumedBy: "load afternoon" });
  const gate = new OrderGate({ broker, store, view, governor, now: () => now, say: say as any, note: () => undefined });
  return { store, broker, gate, setNow: (x: string) => (now = z(x)), now: () => now };
}
const loadSignal = (symbol: string, price: number, now: Date): Signal => ({ symbol, price, tradeTime: new Date(now.getTime() - 300), stopPrice: Math.round((price - 0.02) * 100) / 100, takeProfitPrice: Math.round((price + 0.01) * 100) / 100, load: true, limitPrice: price });
const normalSignal = (symbol: string, price: number, now: Date): Signal => ({ symbol, price, tradeTime: new Date(now.getTime() - 300), stopPrice: Math.round(price * 0.99 * 100) / 100, takeProfitPrice: Math.round(price * 1.01 * 100) / 100 });

test("in the afternoon window the gate sends 1-share limit entries, keeps every entry within 75 dollars, and allows up to 150 a minute above the approved 20; outside it, the approved limits", async () => {
  const s = await gateAt("17:00:00", { [MIDDAY_PHASE]: "x", middayFlat: "yes", [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString() });
  const r1 = await s.gate.enter(loadSignal("S0", 20, s.now()));
  assert.equal(r1.status, "sent");
  assert.equal((r1 as any).qty, 1);
  // A normal (non-load) signal in the window is sized to at most 75 dollars, not the approved 300.
  const big = await s.gate.enter(normalSignal("BIG", 10, s.now()));
  assert.equal(big.status, "sent");
  assert.ok((big as any).qty * 10 <= 75, `qty ${(big as any).qty}`);
  // 40 entries in one minute: more than the approved 20, all sent.
  let sentCount = 0;
  for (let i = 1; i <= 40; i++) {
    s.setNow(`17:00:${String(Math.floor(i * 1.2)).padStart(2, "0")}`);
    const r = await s.gate.enter(loadSignal(`S${i}`, 20, s.now()));
    if (r.status === "sent") sentCount++;
    else assert.fail(`entry ${i} refused: ${(r as any).reason}`);
  }
  assert.equal(sentCount, 40);

  // The same day before `load afternoon` (no phase): the approved 20 a minute holds, and a limit entry is refused.
  const n = await gateAt("17:00:00", { [MIDDAY_PHASE]: "x", middayFlat: "yes" });
  const lim = await n.gate.enter(loadSignal("L0", 20, n.now()));
  assert.equal(lim.status, "refused");
  let ok = 0;
  let refusedAt = -1;
  for (let i = 0; i < 30; i++) {
    n.setNow(`17:00:${String(i).padStart(2, "0")}`);
    const r = await n.gate.enter(normalSignal(`N${i}`, 20, n.now()));
    if (r.status === "sent") ok++;
    else if (refusedAt < 0) refusedAt = i, assert.match((r as any).reason, /trades-per-minute|per-minute/);
  }
  assert.equal(ok, 20, "the approved 20 a minute");

  // After the last entry (2:00 PM CT) the window is over: no entry at all (the day's last entry rule).
  s.setNow("20:00:30");
  assert.equal((await s.gate.enter(loadSignal("LATE", 20, s.now()))).status, "refused");
});

test("the gate never goes above 150 a minute in the afternoon window", async () => {
  const s = await gateAt("17:00:00", { [MIDDAY_PHASE]: "x", middayFlat: "yes", [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString() });
  let sent = 0;
  for (let i = 0; i < 170; i++) {
    s.setNow(new Date(z("17:00:00").getTime() + i * 300).toISOString());
    const r = await s.gate.enter(loadSignal(`T${i}`, 5, s.now()));
    if (r.status === "sent") sent++;
  }
  assert.ok(sent <= 150, `sent ${sent}`);
  assert.ok(sent >= 140, `sent ${sent} (the governor's own headroom may hold a few back)`);
});

// ---------------- the price feed switch ----------------

test("the price stream switches its symbols on the same connection: unsubscribe the names that left, subscribe the new list; more than 30 on iex is refused", () => {
  const sent: string[] = [];
  const sock: any = { send: (d: string) => sent.push(d), close: () => undefined, onopen: null, onmessage: null, onclose: null, onerror: null };
  const s = new TradeStream(settings, ["AAA", "BBB"], () => undefined, () => undefined, { makeSocket: () => sock, setTimer: () => 0 });
  s.start();
  sock.onmessage({ data: JSON.stringify([{ T: "success", msg: "connected" }]) });
  sock.onmessage({ data: JSON.stringify([{ T: "success", msg: "authenticated" }]) });
  sock.onmessage({ data: JSON.stringify([{ T: "subscription", trades: ["AAA", "BBB"] }]) });
  assert.equal(s.status, "live");
  sent.length = 0;
  s.setSymbols(["BBB", "CCC"]);
  assert.deepEqual(sent.map((x) => JSON.parse(x)), [{ action: "unsubscribe", trades: ["AAA"] }, { action: "subscribe", trades: ["BBB", "CCC"] }]);
  assert.throws(() => s.setSymbols(Array.from({ length: 31 }, (_, i) => `S${i}`)), /at most 30/);
  // A reconnect subscribes the new list.
  sent.length = 0;
  sock.onmessage({ data: JSON.stringify([{ T: "success", msg: "authenticated" }]) });
  assert.deepEqual(JSON.parse(sent[0]!), { action: "subscribe", trades: ["BBB", "CCC"] });
});

test("the placeholder with the load hook behaves exactly as before on a normal day (no afternoon window)", () => {
  const day = dayWith({});
  const a = new BusyPlaceholder(["AAA"]);
  const b = new BusyPlaceholder(["AAA"], { loadActive: (t) => inLoadWindow(day, t) });
  const prices = [10, 10.01, 10.02, 10.01, 10.03, 10.04, 10.05, 10.02, 10.06, 10.07, 10.08, 10.09];
  for (let i = 0; i < prices.length; i++) {
    const t = { symbol: "AAA", price: prices[i]!, size: 100, time: new Date(z("17:00:00").getTime() + i * 61_000).toISOString() };
    assert.deepEqual(b.onTrade(t), a.onTrade(t), `print ${i}`);
  }
  void order;
  void CONTROL_STOP;
  void setPhase;
});

// ---------------- part 2: self-monitoring (Michael's approval of 2026-11-11) ----------------

test("self-monitoring reads /proc/stat and /proc/meminfo; Fly's throttling shows as steal", () => {
  const stat = "cpu  100 0 50 1000 0 0 0 20 0 0\ncpu0 100 0 50 1000 0 0 0 20 0 0\n";
  assert.deepEqual(parseProcStat(stat), { user: 100, nice: 0, system: 50, idle: 1000, iowait: 0, irq: 0, softirq: 0, steal: 20 });
  assert.equal(parseProcStat("nonsense"), null);
  assert.equal(parseMemAvailable("MemTotal: 472576 kB\nMemAvailable:  312500 kB\n"), 312500 * 1024);
  assert.equal(parseMemAvailable(""), null);
});

test("a self-monitoring row: the process's CPU, the machine's busy and steal shares, memory, the event loop's delay and the gate's decision times over the window", () => {
  let nowMs = 0;
  let cpu = { user: 0, system: 0 };
  let stat = "cpu  0 0 0 0 0 0 0 0\n";
  let resets = 0;
  const hist = { count: 10, percentile: (p: number) => (p === 50 ? 2e6 : 90e6), max: 400e6, mean: 5e6, reset: () => void resets++ };
  const m = new SelfMonitor({ nowMs: () => nowMs, cpuUsage: () => cpu, readProcStat: () => stat, readMemInfo: () => "MemAvailable: 320000 kB\n", memoryUsage: () => ({ rss: 150e6, heapUsed: 60e6 }) as any, histogram: hist as any });
  nowMs = 60_000;
  cpu = { user: 9_000_000, system: 3_000_000 }; // 12 seconds of CPU in 60 seconds: 20 percent
  stat = "cpu  1000 0 200 900 0 0 0 3900\n"; // of 6,000 ticks: 1,200 busy (20 percent), 3,900 steal (65 percent)
  const row = m.sample({ times: [{ runMs: 70, queueMs: 10 }, { runMs: 80, queueMs: 4000 }, { runMs: 60, queueMs: 5 }], storedOrders: 7470 });
  assert.equal(row.windowMs, 60_000);
  assert.equal(row.processCpuPct, 20);
  assert.equal(row.machineBusyPct, 20);
  assert.equal(row.stealPct, 65);
  assert.equal(row.rssMb, 150);
  assert.equal(row.memAvailableMb, 327.7);
  assert.deepEqual(row.eventLoopDelayMs, { p50: 2, p99: 90, max: 400, mean: 5 });
  assert.equal(resets, 1, "the histogram starts afresh each window");
  assert.deepEqual(row.decisions, { n: 3, medianMs: 70, p90Ms: 80, maxMs: 80, queueMedianMs: 10, queueMaxMs: 4000, storedOrders: 7470 });
  // Off Linux (no /proc): those fields are null, the rest still measured.
  const off = new SelfMonitor({ readProcStat: () => { throw new Error("no /proc"); }, readMemInfo: () => { throw new Error("no /proc"); }, histogram: null });
  const r2 = off.sample({ times: [], storedOrders: null });
  assert.equal(r2.stealPct, null);
  assert.equal(r2.memAvailableMb, null);
  assert.equal(r2.eventLoopDelayMs, null);
  assert.equal(r2.decisions.n, 0);
});

test("the gate records each decision's own time and queue wait and the stored orders it read; taking them empties the list", async () => {
  const s = await gateAt("17:00:00", { [MIDDAY_PHASE]: "x", middayFlat: "yes" });
  await s.gate.enter(normalSignal("A1", 20, s.now()));
  await s.gate.enter(normalSignal("A2", 20, s.now()));
  const t = s.gate.takeDecisionTimes();
  assert.equal(t.times.length, 2);
  assert.ok(t.times.every((x) => x.runMs >= 0 && x.queueMs >= 0));
  assert.equal(t.storedOrders, 1, "the second decision read the first entry's row");
  assert.equal(s.gate.takeDecisionTimes().times.length, 0);
});

test("the worker writes one self_monitor row a minute in the session, beside the per-minute statistics; none without a monitor", async () => {
  const { r } = await flatAtMidday();
  const samples: any[] = [];
  (r.worker as any).d.selfMonitor = { sample: (g: any) => (samples.push(g), { decisions: { n: g.times.length }, stealPct: 0 }) };
  await r.at("16:50:00");
  await r.at("16:51:01");
  await r.at("16:52:02");
  const rows = (r.store as any).events.filter((e: any) => e.event === "self_monitor");
  assert.ok(rows.length >= 2, `rows ${rows.length}`);
  assert.equal(rows.length, samples.length);
  const stats = (r.store as any).events.filter((e: any) => e.event === "governor_stats").length;
  assert.ok(stats >= rows.length);
  // A monitor that throws does not break the pass.
  (r.worker as any).d.selfMonitor = { sample: () => { throw new Error("boom"); } };
  await r.at("16:53:03");
  assert.equal((r.store as any).events.filter((e: any) => e.event === "self_monitor").length, rows.length);
});
