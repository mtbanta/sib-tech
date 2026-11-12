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
import { CachingStore } from "../src/caching-store.ts";
import { FakeBroker, order } from "./helpers.ts";
import type { Signal } from "../src/strategy.ts";
import { BusyPlaceholder } from "../src/strategy.ts";
import { LOAD_AFTERNOON_PHASE, LOAD_PHASE, afternoonLoadWindow, hasLoadEntries, inAfternoonLoad, inLoadWindow, loadCeilingOn, loadRulesApply } from "../src/load-mode.ts";
import { MIDDAY_PHASE, readPause, updatePause, emptyPause } from "../src/midday.ts";
import { LOAD_AFTERNOON_OFF, SCREEN_CANCELLED, loadAfternoonRefusal } from "../src/commands.ts";
import { TradeStream } from "../src/stream.ts";
import { settings } from "./helpers.ts";
import { SelfMonitor, parseMemAvailable, parseProcStat } from "../src/self-monitor.ts";

const until = async (cond: () => boolean | Promise<boolean>, n = 400) => {
  for (let i = 0; i < n && !(await cond()); i++) await settle();
};

// An approved, armed normal day in the simulator, flat after the mid-day close-out (as midday.test.ts does it).
async function flatAtMidday(opts: { load?: boolean; early?: boolean; off?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  if (opts.early) sim.calendar = [{ date: "2026-11-02", open: "09:30", close: "13:00" }];
  const events: Array<{ e: string; d: any }> = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, log: (_l, e, d) => void events.push({ e, d }), loadAfternoon: !opts.off });
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
  assert.ok(r.said("commands").some((t) => t.startsWith("Running the cheap-symbol screen for the afternoon load window now")));
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined, "not in the pass that started the screen");
  assert.equal((await readPause(r.store, D))!.on, true);
  await r.at("16:40:10");
  const day = (await r.store.getDay(D))!;
  assert.equal(day.phases[LOAD_AFTERNOON_PHASE], z("16:40:10").toISOString(), "the window starts in the next pass, after its command read");
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
  assert.match(reply!, /the close-out runs as normal at 2:55 PM CT/);
  assert.ok(r.said("trading").some((t) => t.startsWith("Live list switched for the afternoon load window (2 cheap")));
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
  await r.at("16:40:10");
  assert.ok(r.said("commands").some((t) => t.startsWith("Afternoon load window not started: the cheap-symbol screen found no names. Still paused")), r.said("commands").join(" | "));
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
  // Node's histogram includes its 20 ms sampling interval: an idle loop reads about 22 ms, and 20 is taken off each figure.
  const hist = { count: 10, percentile: (p: number) => (p === 50 ? 22e6 : 110e6), max: 420e6, mean: 15e6, reset: () => void resets++ };
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
  assert.deepEqual(row.eventLoopDelayMs, { p50: 2, p99: 90, max: 400, mean: 0 }, "the interval taken off, never below 0");
  assert.equal(resets, 1, "the histogram starts afresh each window");
  assert.deepEqual(row.decisions, { n: 3, medianMs: 70, p90Ms: 80, maxMs: 80, queueMedianMs: 10, queueMaxMs: 4000, storedOrders: 7470, dropped: 0 });
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

// ---------------- part 3: the no-copy fix (Michael's approval of 2026-11-11) ----------------

async function cachedDay(n: number) {
  const inner = new MemoryStore();
  let nowMs = z("15:00:00").getTime();
  const store = new CachingStore(inner, () => nowMs);
  for (let i = 0; i < n; i++) {
    inner.orders.set(`cyrus-20261102-S${i % 30}-${i}`, { clientOrderId: `cyrus-20261102-S${i % 30}-${i}`, tradeDate: D, symbol: `S${i % 30}`, qty: 1, referencePrice: 10, stopPrice: 9.98, takeProfitPrice: 10.01, status: i % 3 === 0 ? "canceled" : "filled", alpacaOrderId: `a${i}`, filledQty: i % 3 === 0 ? 0 : 1, filledAvgPrice: 10, note: null, createdAt: new Date(nowMs - (n - i) * 700).toISOString(), closedAt: new Date(nowMs - 1).toISOString() });
  }
  return { store, inner, tick: (ms: number) => (nowMs += ms) };
}

test("the caching store hands out its kept rows without copying each one: no structuredClone per row, the same frozen objects, in the same order as before", async () => {
  const { store } = await cachedDay(2000);
  const first = await store.listOrders(D);
  const real = globalThis.structuredClone;
  let clones = 0;
  globalThis.structuredClone = ((v: unknown, o?: StructuredSerializeOptions) => (clones++, real(v, o))) as typeof structuredClone;
  let second: Awaited<ReturnType<typeof store.listOrders>>;
  try {
    second = await store.listOrders(D);
  } finally {
    globalThis.structuredClone = real;
  }
  assert.equal(clones, 0, "no copy per row");
  assert.equal(second.length, 2000);
  assert.notEqual(second, first, "a new array each call");
  assert.ok(second.every((o, i) => o === first[i]), "the same row objects, in the same order");
  assert.ok(second.every((o) => Object.isFrozen(o)));
  const sorted = [...second].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.clientOrderId.localeCompare(b.clientOrderId));
  assert.ok(second.every((o, i) => o === sorted[i]), "sorted by time written, then id, as before");
});

test("a kept row cannot be changed by a caller, and a list read before a write keeps the rows as they were (as the copies did)", async () => {
  const { store } = await cachedDay(10);
  const before = await store.listOrders(D);
  const row = before[0]!;
  assert.throws(() => {
    (row as any).status = "failed";
  }, TypeError);
  await store.updateOrder(row.clientOrderId, { status: "failed", note: "x" });
  assert.equal(row.status, "canceled", "the earlier read is unchanged");
  const after = await store.listOrders(D);
  const now = after.find((o) => o.clientOrderId === row.clientOrderId)!;
  assert.equal(now.status, "failed");
  assert.ok(Object.isFrozen(now));
  store.updateOrderSoon!(after[1]!.clientOrderId, { closedAt: "2026-11-02T15:30:00.000Z" });
  assert.ok(Object.isFrozen((await store.listOrders(D)).find((o) => o.clientOrderId === after[1]!.clientOrderId)!));
  await store.insertOrder({ clientOrderId: "cyrus-20261102-NEW-1", tradeDate: D, symbol: "NEW", qty: 1, referencePrice: 5, stopPrice: 4.98, takeProfitPrice: 5.01, status: "intent", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null });
  assert.ok(Object.isFrozen((await store.listOrders(D)).find((o) => o.symbol === "NEW")!));
  // getOrder still hands out a copy (one row).
  const one = (await store.getOrder("cyrus-20261102-NEW-1"))!;
  one.note = "mine";
  assert.equal((await store.getOrder("cyrus-20261102-NEW-1"))!.note, null);
});

test("the gate decides exactly as it did with copied rows: the same answers for the same 300 signals over 3,000 stored orders", async () => {
  async function run(copying: boolean) {
    const { store } = await cachedDay(3000);
    if (copying) {
      const orig = store.listOrders.bind(store);
      (store as any).listOrders = async (d: string) => (await orig(d)).map((o) => structuredClone(o));
    }
    const broker = new FakeBroker();
    let now = z("17:00:00");
    const governor = new Governor(() => now.getTime());
    const view = new BrokerView(broker, () => now.getTime());
    const say = async () => true;
    const liquidator = new Liquidator({ broker, gate: new SellGate({ broker, say: say as any }), now: () => now, sleep: async () => undefined });
    await ensureDay({ broker, store, now: () => now, say: say as any, liquidator } as any, D);
    await store.updateDay(D, { status: "approved", limits: { maxPositionUsd: 250, dailyLossStopUsd: 500, maxTradesPerMinute: 100, borrowingCap: 1 }, decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z" } } as any);
    const gate = new OrderGate({ broker, store, view, governor, now: () => now, say: say as any, note: () => undefined });
    let seed = 11;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const out: string[] = [];
    for (let i = 0; i < 300; i++) {
      now = new Date(now.getTime() + Math.floor(rnd() * 1500));
      const r: any = await gate.enter(normalSignal(`S${Math.floor(rnd() * 30)}`, 10 + Math.floor(rnd() * 20), now));
      await gate.settled();
      out.push(`${r.status}|${r.reason ?? ""}|${r.clientOrderId ?? ""}|${r.qty ?? ""}`);
      if (r.status === "sent") {
        const x = rnd();
        await store.updateOrder(r.clientOrderId, x < 0.4 ? { status: "filled", closedAt: now.toISOString() } : x < 0.55 ? { status: "failed" } : { status: "submitted" });
      }
    }
    return out;
  }
  const a = await run(true);
  const b = await run(false);
  assert.deepEqual(b, a);
  assert.ok(a.some((x) => x.startsWith("sent")) && a.some((x) => x.includes("still working")), "the run covers sends and refusals");
});

// ---------------- round 2 (group 1 and group 2 reviews, round 1) ----------------

test("group 1, round 1: a `stop` sent while the cheap-symbol screen runs wins; the window does not start and trading stays paused", async () => {
  const { r } = await flatAtMidday();
  let release: (v: { symbols: string[]; names: Record<string, string> }) => void = () => undefined;
  (r.worker as any).d.buildLiveList = () => new Promise((res) => (release = res));
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  assert.ok(r.said("commands").some((t) => t.startsWith("Running the cheap-symbol screen")));
  // The main loop is not held by the screen: later passes run and read commands.
  r.ownerSays("stop", "16:41:00");
  await r.at("16:41:05");
  assert.ok(r.said("commands").some((t) => t.startsWith("Stopped.")), "the stop was read while the screen ran");
  assert.ok(r.said("commands").some((t) => t.includes(SCREEN_CANCELLED)), "the stop says the window is cancelled");
  release({ symbols: ["CHP1", "CHP2"], names: {} });
  await settle();
  await r.at("16:41:10");
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined);
  assert.equal((await readPause(r.store, D))!.on, true);
  assert.deepEqual((await r.store.getDay(D))!.liveList, ["AAA", "BBB"], "the finished screen changed nothing");
  // `go` sent while the screen runs also cancels the window.
  const w = await flatAtMidday();
  let rel2: (v: { symbols: string[]; names: Record<string, string> }) => void = () => undefined;
  (w.r.worker as any).d.buildLiveList = () => new Promise((res) => (rel2 = res));
  w.r.ownerSays("load afternoon", "16:40:00");
  await w.r.at("16:40:05");
  w.r.ownerSays("go", "16:41:00");
  await w.r.at("16:41:05");
  assert.ok(w.r.said("commands").some((t) => t.includes(SCREEN_CANCELLED)));
  const streamsBefore = w.r.counts();
  rel2({ symbols: ["CHP1"], names: {} });
  await settle();
  await w.r.at("16:41:10");
  assert.equal((await w.r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined);
  assert.deepEqual((await w.r.store.getDay(D))!.liveList, ["AAA", "BBB"], "group 2 round 2: the list is not switched under trading resumed by `go`");
  assert.deepEqual(w.r.counts(), streamsBefore, "the price feed was not switched");
  assert.ok(!w.r.said("trading").some((t) => t.startsWith("Live list switched")), "no post about a switch");
  assert.ok(!w.r.said("commands").some((t) => t.startsWith("Afternoon load window not started")), "no second line after the cancel");
});

test("group 1, round 1: the window is decided only in a pass that read commands after the screen finished, with Alpaca read again (a position opened meanwhile refuses it; unreadable refuses it)", async () => {
  const { r, sim } = await flatAtMidday();
  let release: (v: { symbols: string[]; names: Record<string, string> }) => void = () => undefined;
  (r.worker as any).d.buildLiveList = () => new Promise((res) => (release = res));
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await sim.submitEntry({ symbol: "ZZZ", qty: 1, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: "manual-zzz" });
  sim.fillEntry("manual-zzz", 10);
  release({ symbols: ["CHP1"], names: {} });
  await settle();
  await r.at("16:40:20");
  assert.ok(r.said("commands").some((t) => t.startsWith("Afternoon load window not started: Alpaca shows 1 position(s)")), r.said("commands").join(" | "));
  assert.equal((await readPause(r.store, D))!.on, true);

  const w = await flatAtMidday();
  let rel2: (v: { symbols: string[]; names: Record<string, string> }) => void = () => undefined;
  (w.r.worker as any).d.buildLiveList = () => new Promise((res) => (rel2 = res));
  w.r.ownerSays("load afternoon", "16:40:00");
  await w.r.at("16:40:05");
  const realPositions = w.sim.listPositions.bind(w.sim);
  w.sim.listPositions = async () => { throw new Error("down"); };
  rel2({ symbols: ["CHP1"], names: {} });
  await settle();
  await w.r.at("16:40:20");
  assert.ok(w.r.said("commands").some((t) => t.startsWith("Afternoon load window not started: I could not read Alpaca's positions and open orders")));
  w.sim.listPositions = realPositions;
});

test("group 2, round 1: on a half day the reply names the real close-out time; `status` shows the window and the resume by `load afternoon`", async () => {
  const { r } = await flatAtMidday({ load: true, early: true });
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  const reply = r.said("commands").find((t) => t.startsWith("Afternoon load window on until"));
  assert.ok(reply, r.said("commands").join(" | "));
  assert.match(reply!, /^Afternoon load window on until 11:00 AM CT \(the last entry\)/);
  assert.match(reply!, /the close-out runs as normal at 11:55 AM CT/);
  r.ownerSays("status", "16:41:00");
  await r.at("16:41:05");
  const st = r.said("commands").find((t) => t.startsWith("**Status**"))!;
  assert.match(st, /Afternoon load window: on since 10:40 AM CT, until 11:00 AM CT \(the last entry\)/);
  assert.match(st, /Mid-day cycle: resumed at 10:40 AM CT \(by `load afternoon`\)/);
});

test("group 2, round 1: the daily summary on a normal day with `load afternoon` heads its window 'Afternoon load window' and credits the resume to it", async () => {
  const { r } = await flatAtMidday();
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:40:10");
  await r.at("20:55:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases.closeout));
  for (const t of ["20:56:00", "21:00:30", "21:05:00", "21:05:30"]) await r.at(t);
  await until(async () => Boolean((await r.store.getDay(D))!.phases.summary));
  const summary = r.said("trading").find((t) => t.includes("Afternoon load window"));
  assert.ok(summary, r.said("trading").map((t) => t.slice(0, 80)).join(" | "));
  assert.ok(summary!.includes("**Afternoon load window**"));
  assert.ok(!summary!.includes("**Load day**"));
  assert.ok(summary!.includes("(by `load afternoon`)"));
});

test("group 2, rounds 1 and 2: a self-monitoring sample covering more than 2 minutes (the first of a day, or a stall) is written as a marker row only; the next one in full", async () => {
  const { r } = await flatAtMidday();
  const windows = [600_000, 60_000];
  (r.worker as any).d.selfMonitor = { sample: () => ({ windowMs: windows.shift() ?? 60_000, decisions: { n: 0 } }) };
  await r.at("16:50:00");
  await r.at("16:51:01");
  const rows = (r.store as any).events.filter((e: any) => e.event === "self_monitor");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].data, { windowMs: 600_000, longWindow: true, eventLoopDelayMs: null }, "a long window is a marker row only");
  assert.equal(rows[1].data.windowMs, 60_000);
  assert.equal(rows[1].data.longWindow, undefined);
});

test("group 2, round 1: the gate's decision-time list stops at 20,000 and counts the rest, without shifting", async () => {
  const s = await gateAt("17:00:00", { [MIDDAY_PHASE]: "x", middayFlat: "yes" });
  for (let i = 0; i < 20_003; i++) (s.gate as any).noteTime(1, 2);
  const t = s.gate.takeDecisionTimes();
  assert.equal(t.times.length, 20_000);
  assert.equal(t.dropped, 3);
  assert.equal(s.gate.takeDecisionTimes().dropped, 0);
});

// ---------------- round 3 (Michael's approval after both groups' round 2) ----------------

type Rel = (v: { symbols: string[]; names: Record<string, string> }) => void;
function slowScreen(r: any): { release: Rel } {
  const h = { release: (() => undefined) as Rel };
  r.worker.d.buildLiveList = () => new Promise((res) => (h.release = res));
  return h;
}

test("round 3: `stop` then `resume`, and `flatten` then `resume`, while the screen runs: the window never starts and trading stays paused", async () => {
  for (const first of ["stop", "flatten"]) {
    const { r } = await flatAtMidday();
    const h = slowScreen(r);
    r.ownerSays("load afternoon", "16:40:00");
    await r.at("16:40:05");
    r.ownerSays(first, "16:40:30");
    await r.at("16:40:35");
    assert.ok(r.said("commands").some((t) => t.includes(SCREEN_CANCELLED)), `${first} says the window is cancelled`);
    r.ownerSays("resume", "16:41:00");
    await r.at("16:41:05");
    h.release({ symbols: ["CHP1", "CHP2"], names: {} });
    await settle();
    for (const t of ["16:41:10", "16:41:20", "16:41:30"]) await r.at(t);
    assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined, first);
    assert.equal((await readPause(r.store, D))!.on, true, `${first}: still paused after resume`);
    assert.deepEqual((await r.store.getDay(D))!.liveList, ["AAA", "BBB"]);
    assert.ok(!r.said("commands").some((t) => t.startsWith("Afternoon load window on")));
  }
});

test("round 3: after a cancel, `load afternoon` can be sent again (a fresh screen and check); two sent while one screen runs start it once", async () => {
  const { r } = await flatAtMidday();
  const h = slowScreen(r);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  r.ownerSays("load afternoon", "16:40:10");
  await r.at("16:40:15");
  assert.ok(r.said("commands").some((t) => t === "Not started yet: the cheap-symbol screen for the afternoon load window is already running."));
  r.ownerSays("stop", "16:40:20");
  await r.at("16:40:25");
  h.release({ symbols: ["CHP1"], names: {} });
  await settle();
  r.ownerSays("resume", "16:41:00");
  await r.at("16:41:05");
  (r.worker as any).d.buildLiveList = async () => ({ symbols: ["CHP1", "CHP2"], names: {} });
  r.ownerSays("load afternoon", "16:42:00");
  await r.at("16:42:05");
  await r.at("16:42:10");
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], z("16:42:10").toISOString());
  assert.deepEqual((await r.store.getDay(D))!.liveList, ["CHP1", "CHP2"]);
  assert.equal(r.said("commands").filter((t) => t.startsWith("Afternoon load window on")).length, 1);
});

test("round 3: a screen that finishes after 1:30 PM CT does not start the window; a failed command read holds the decision until a read succeeds", async () => {
  const { r } = await flatAtMidday();
  const h = slowScreen(r);
  r.ownerSays("load afternoon", "19:25:00");
  await r.at("19:25:05");
  h.release({ symbols: ["CHP1"], names: {} });
  await settle();
  await r.at("19:30:10");
  assert.ok(r.said("commands").some((t) => t.startsWith("Afternoon load window not started: it is 1:30 PM CT or later")), r.said("commands").join(" | "));
  assert.equal((await readPause(r.store, D))!.on, true);

  const w = await flatAtMidday();
  const h2 = slowScreen(w.r);
  w.r.ownerSays("load afternoon", "16:40:00");
  await w.r.at("16:40:05");
  h2.release({ symbols: ["CHP1"], names: {} });
  await settle();
  const bot: any = w.r.bot;
  const real = bot.commandMessagesAfter.bind(bot);
  bot.commandMessagesAfter = async () => { throw new Error("discord down"); };
  await w.r.at("16:40:10");
  assert.equal((await w.r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined, "no decision without a successful command read");
  bot.commandMessagesAfter = real;
  await w.r.at("16:40:20");
  assert.equal((await w.r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], z("16:40:20").toISOString());
});

test("round 3: on a load day with `load afternoon`, the summary keeps its morning window and adds one line for the afternoon window", async () => {
  const { r } = await flatAtMidday({ load: true });
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("20:55:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases.closeout));
  for (const t of ["20:56:00", "21:00:30", "21:05:00", "21:05:30"]) await r.at(t);
  await until(async () => Boolean((await r.store.getDay(D))!.phases.summary));
  const summary = r.said("trading").find((t) => t.includes("**Load day**"));
  assert.ok(summary);
  assert.ok(summary!.includes("- afternoon load window 10:40 AM CT to 2:00 PM CT (by `load afternoon`): its entries are counted in the rest of the day"), summary);
});

// ---------------- option B (Michael's fallback after group 1's round 3) ----------------

test("option B: in this release `load afternoon` is switched off unless the worker is built with it on (main.ts does not): it changes nothing, and `help` says so", async () => {
  const { r, sim } = await flatAtMidday({ off: true });
  const screens = r.screenOpts.length;
  const before = r.counts();
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:40:10");
  assert.ok(r.said("commands").some((t) => t === LOAD_AFTERNOON_OFF), r.said("commands").join(" | "));
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], undefined);
  assert.equal((await readPause(r.store, D))!.on, true, "still paused");
  assert.equal(r.screenOpts.length, screens, "no screen");
  assert.deepEqual(r.counts(), before, "no feed switch");
  assert.deepEqual((await r.store.getDay(D))!.liveList, ["AAA", "BBB"]);
  r.ownerSays("help", "16:41:00");
  await r.at("16:41:05");
  const help = r.said("commands").find((t) => t.startsWith("**Commands**"))!;
  assert.match(help, /`load afternoon` is switched off in this release/);
  assert.ok(!help.includes("up to 150 orders a minute even above"));
  // `go` still resumes a normal afternoon, with the approved limits.
  r.ownerSays("go", "16:42:00");
  await r.at("16:42:05");
  assert.equal((await readPause(r.store, D))!.resumedBy, "go");
  void sim;
});

test("release of 2026-11-12: main.ts switches `load afternoon` on, in exactly one line", async () => {
  const { readFileSync } = await import("node:fs");
  const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
  assert.equal((main.match(/loadAfternoon\s*:/g) ?? []).length, 1, "one switch");
  assert.match(main, /^\s*loadAfternoon: true,$/m, "main.ts switches `load afternoon` on in this release");
});
