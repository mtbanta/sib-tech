// The release of 2026-11-12 (afternoon), Michael's request of 2026-11-12: (1) the fast-sale and fresh-stop events are stored in the
// run log (logging only); (2) every screen asks Alpaca whether each name is tradable and drops any that is not; (3) the afternoon load
// window runs for at most 30 minutes, then a close-out to flat (the mid-day close-out code), with no automatic return to normal. And
// his two rulings: a deploy while flat with the stop flag on, and `load afternoon` accepted while flat with the stop flag on.
// The simulated day is 2026-11-02: open 14:30 UTC (8:30 CT), pause 16:30 UTC, 1:30 PM CT is 19:30 UTC, last entry 20:00 UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";
import { AFTERNOON_WINDOW_ENDED, OrderGate, clientOrderIdFor } from "../src/gate.ts";
import { BrokerView } from "../src/broker-view.ts";
import { Governor } from "../src/governor.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { ensureDay } from "../src/morning.ts";
import { MemoryStore } from "../src/store.ts";
import { FakeBroker } from "./helpers.ts";
import type { Signal } from "../src/strategy.ts";
import { CONTROL_STOP, type StopFlag, type Store } from "../src/store.ts";
import { AFTERNOON_FLAT_PHASE, LOAD_AFTERNOON_PHASE, afternoonCloseoutPending, afternoonLoadWindow } from "../src/load-mode.ts";
import { MIDDAY_PHASE, readPause, updatePause } from "../src/midday.ts";
import { STORED_INFO_EVENTS, shouldStoreEvent } from "../src/run-log.ts";
import { pickTradable } from "../src/screen.ts";

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
  await r.at("13:45:00");
  await r.at("14:25:00");
  await r.at("14:30:05");
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  return { sim, r, events };
}

async function hold(sim: SimBroker, store: Store, symbol: string, qty: number, price: number, n = 1) {
  const id = clientOrderIdFor(D, symbol, n);
  await sim.submitEntry({ symbol, qty, stopPrice: price * 0.9, takeProfitPrice: price * 1.1, referencePrice: price, clientOrderId: id });
  sim.fillEntry(id, price);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price * 0.9, takeProfitPrice: price * 1.1, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  return id;
}

// ---------------- (1) the run log ----------------

test("the fast-sale and fresh-stop events (and the new afternoon and screen events) are stored in the run log", () => {
  const names = ["lost_exit_fast_start", "lost_exit_fast", "lost_exit_fast_skipped", "lost_exit_fast_failed", "cleanup_covered_by_own_sale", "fresh_stop", "fresh_stop_gone", "fresh_stop_ended", "fresh_stop_recovered", "fresh_stop_unclear", "fresh_stop_refused", "fresh_stop_lookup_failed", "load_afternoon", "afternoon_closeout", "screen_not_tradable"];
  for (const n of names) {
    assert.ok(STORED_INFO_EVENTS.has(n), n);
    assert.equal(shouldStoreEvent("info", n), true, n);
  }
  assert.equal(shouldStoreEvent("info", "governor_wait"), false, "an unlisted info event is still not stored");
});

// ---------------- (2) the tradable check ----------------

test("the screen drops names Alpaca says are not tradable, fills the list from the next ranked names, and keeps a name whose check failed", async () => {
  const notTradable = new Set(["OMH", "BBB"]);
  const asked: string[] = [];
  const check = async (s: string) => {
    asked.push(s);
    if (s === "ERR") throw new Error("timeout");
    return !notTradable.has(s);
  };
  const r = await pickTradable(["AAA", "OMH", "CCC", "ERR", "BBB", "DDD", "EEE", "FFF"], 4, check);
  assert.deepEqual(r.kept, ["AAA", "CCC", "ERR", "DDD"]);
  assert.deepEqual(r.dropped, ["OMH", "BBB"]);
  assert.deepEqual(r.unchecked, ["ERR"]);
  assert.deepEqual(asked, ["AAA", "OMH", "CCC", "ERR", "BBB", "DDD"], "stops asking once the list is full");
  const short = await pickTradable(["OMH", "AAA"], 30, check);
  assert.deepEqual(short.kept, ["AAA"], "fewer names than the list size: the list is shorter, never padded with untradable ones");
});

// ---------------- (3) the 30 minute window and its close-out ----------------

test("the afternoon window is 30 minutes at most; its close-out is pending from the end until its phase is written", () => {
  const day = { tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), phases: { [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString() } } as any;
  assert.deepEqual(afternoonLoadWindow(day), { start: z("16:40:00"), end: z("17:10:00") });
  assert.equal(afternoonCloseoutPending(day, z("17:09:59")), false);
  assert.equal(afternoonCloseoutPending(day, z("17:10:00")), true);
  assert.equal(afternoonCloseoutPending({ ...day, phases: { ...day.phases, [AFTERNOON_FLAT_PHASE]: z("17:10:20").toISOString() } }, z("17:11:00")), false);
  assert.equal(afternoonCloseoutPending({ ...day, phases: {} }, z("17:11:00")), false, "no window, no close-out");
});

test("after 30 minutes the window ends: entries pause, the close-out sells to flat (retried while refused), `go` is refused until flat, and trading does not resume on its own", async () => {
  const { sim, r, events } = await flatAtMidday({ load: true });
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  assert.equal((await readPause(r.store, D))!.on, false, "the window is trading");
  await r.at("16:50:00");
  await hold(sim, r.store, "AAA", 1, 10, 1);
  await hold(sim, r.store, "BBB", 1, 12, 2);
  sim.refuseSellsTimes = 100_000;
  await r.at("17:10:04");
  assert.equal((await readPause(r.store, D))!.on, false, "the window started at 16:40:05 (the pass that read the command), so it runs until 17:10:05");
  await r.at("17:10:06");
  await until(() => events.some((e) => e.e === "afternoon_closeout" && e.d.step === "first") && !r.worker["inflight"].has("midday"));
  const p = (await readPause(r.store, D))!;
  assert.equal(p.on, true, "entries paused again");
  assert.equal(p.reason, "afternoon load window ended");
  assert.equal((await r.store.getDay(D))!.phases[AFTERNOON_FLAT_PHASE], undefined, "not flat yet");
  assert.ok(r.said("alerts").some((t) => t.includes("the close-out after the afternoon load window is NOT FLAT yet")), r.said("alerts").join(" | "));
  r.ownerSays("go", "17:10:12");
  await r.at("17:10:14");
  assert.ok(r.said("commands").some((t) => t === "Not resumed: the close-out after the afternoon load window has not finished flat yet."), r.said("commands").join(" | "));
  assert.equal((await readPause(r.store, D))!.on, true);
  sim.refuseSellsTimes = 0;
  // Retries every 20 seconds, within the retries' budget, until flat.
  for (const t of ["17:10:27", "17:10:50", "17:11:15", "17:11:40", "17:12:05", "17:12:30"]) {
    await r.at(t);
    await until(() => !r.worker["inflight"].has("midday"));
    if ((await r.store.getDay(D))!.phases[AFTERNOON_FLAT_PHASE]) break;
  }
  assert.ok((await r.store.getDay(D))!.phases[AFTERNOON_FLAT_PHASE], "flat: its own phase");
  assert.equal((await sim.listPositions()).length, 0);
  assert.ok(r.said("commands").some((t) => t.startsWith("Afternoon load window over: entries paused and the account is flat.") && t.includes("`go` resumes a normal afternoon until 2:00 PM CT")), r.said("commands").join(" | "));
  // Group 2, round 1: `status` after the window is true: flat, paused, and the pause named as the window's end.
  r.ownerSays("status", "17:13:00");
  await r.at("17:13:05");
  const st = r.said("commands").filter((t) => t.startsWith("**Status**")).at(-1)!;
  assert.match(st, /Afternoon load window: ran from 10:40 AM CT to 11:10 AM CT; its close-out finished flat, entries paused/);
  assert.match(st, /Mid-day cycle: entries paused again at 11:10 AM CT, when the afternoon load window ended \(flat\)/);
  assert.equal((await readPause(r.store, D))!.on, true, "no automatic return to normal trading");
  // A `go` after the close-out is flat resumes a normal afternoon, and `status` then says so.
  r.ownerSays("go", "17:14:00");
  await r.at("17:14:05");
  r.ownerSays("status", "17:15:00");
  await r.at("17:15:05");
  const st2 = r.said("commands").filter((t) => t.startsWith("**Status**")).at(-1)!;
  assert.match(st2, /its close-out finished flat, trading resumed at 11:14 AM CT \(by `go`\)/);
  assert.ok(events.some((e) => e.e === "afternoon_closeout" && e.d.flat === true));
  const tries = events.filter((e) => e.e === "afternoon_closeout" && e.d.step !== "paused");
  assert.equal(tries[0]!.d.step, "first");
  assert.ok(tries.length >= 2 && tries.slice(1).every((e) => e.d.step === "retry"), "the refused first try was retried");
});

// ---------------- Michael's rulings ----------------

test("after `go`, then `flatten`, `load afternoon` on a load day clears the stop and starts the window; the daily loss stop is never cleared", async () => {
  const { r } = await flatAtMidday({ load: true });
  r.ownerSays("go", "16:35:00");
  await r.at("16:35:05");
  r.ownerSays("flatten", "16:38:00");
  await r.at("16:38:05");
  await r.at("16:38:30");
  assert.equal((await r.store.getControl<StopFlag>(CONTROL_STOP))!.on, true);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  assert.ok(r.said("commands").some((t) => t.startsWith("Afternoon load window on until 11:10 AM CT") && t.includes("Stop cleared: trading resumed.")), r.said("commands").join(" | "));
  const stop = (await r.store.getControl<StopFlag>(CONTROL_STOP))!;
  assert.equal(stop.on, false);
  assert.equal(stop.reason, "owner command (load afternoon)");
  assert.equal((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], z("16:40:05").toISOString());

  const loss = await flatAtMidday({ load: true });
  await loss.r.store.setControl(CONTROL_STOP, { on: true, at: z("16:39:00").toISOString(), reason: "daily loss stop: loss 210 dollars" });
  loss.r.ownerSays("load afternoon", "16:40:00");
  await loss.r.at("16:40:05");
  assert.ok(loss.r.said("commands").some((t) => t.startsWith("Not started: the daily loss stop is in force")), loss.r.said("commands").join(" | "));
  assert.equal((await loss.r.store.getControl<StopFlag>(CONTROL_STOP))!.on, true);
});

// ---------------- group 1, round 1: the gate stops entries by the clock when the window ends ----------------

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
  // The pause as `load afternoon` left it: off. No pass has written it back on.
  await updatePause(store, D, { on: false, since: z("16:30:05").toISOString(), resumedAt: z("16:40:00").toISOString(), resumedBy: "load afternoon" });
  const gate = new OrderGate({ broker, store, view, governor, now: () => now, say: say as any, note: () => undefined });
  return { store, broker, gate, setNow: (x: string) => (now = z(x)), now: () => now };
}
const loadSignal = (symbol: string, price: number, now: Date): Signal => ({ symbol, price, tradeTime: new Date(now.getTime() - 300), stopPrice: Math.round((price - 0.02) * 100) / 100, takeProfitPrice: Math.round((price + 0.01) * 100) / 100, load: true, limitPrice: price });
const normalSignal = (symbol: string, price: number, now: Date): Signal => ({ symbol, price, tradeTime: new Date(now.getTime() - 300), stopPrice: Math.round(price * 0.99 * 100) / 100, takeProfitPrice: Math.round(price * 1.01 * 100) / 100 });

test("group 1, round 1: after the 30 minutes the gate refuses every entry by the clock, before any pass writes the pause, until the close-out is flat", async () => {
  const phases = { [MIDDAY_PHASE]: "x", middayFlat: "yes", [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString() };
  const s = await gateAt("17:09:59", phases);
  assert.equal((await s.gate.enter(loadSignal("IN", 20, s.now()))).status, "sent", "inside the window");
  s.setNow("17:10:01");
  for (const sig of [loadSignal("A1", 20, s.now()), normalSignal("N1", 20, s.now())]) {
    const r = await s.gate.enter(sig);
    assert.equal(r.status, "refused", sig.symbol);
    assert.equal((r as any).reason, AFTERNOON_WINDOW_ENDED);
  }
  // A `resume` in the gap (the stop flag cleared) changes nothing: the clock check does not read the stop flag.
  await s.store.setControl(CONTROL_STOP, { on: false, at: z("17:10:01").toISOString(), reason: "owner command (resume)" });
  assert.equal((await s.gate.enter(normalSignal("N2", 20, s.now()))).status, "refused");
  // Once the close-out has finished flat (its phase written), this check no longer refuses (a later `go` can trade).
  await s.store.updateDay(D, { phases: { ...phases, armed: "2026-11-02T14:25:00.000Z", [AFTERNOON_FLAT_PHASE]: z("17:10:30").toISOString() } } as any);
  s.setNow("17:11:00");
  const after = await s.gate.enter(normalSignal("N3", 20, s.now()));
  assert.notEqual((after as any).reason, AFTERNOON_WINDOW_ENDED);
});

test("group 1, round 1: an entry whose checks began inside the window is cancelled before it leaves if the window ended meanwhile", async () => {
  const phases = { [MIDDAY_PHASE]: "x", middayFlat: "yes", [LOAD_AFTERNOON_PHASE]: z("16:40:00").toISOString() };
  const s = await gateAt("17:09:58", phases); // the window (from 16:40:00) ends at 17:10:00
  const insert = s.store.insertOrder.bind(s.store);
  s.store.insertOrder = async (o: any) => {
    const r = await insert(o);
    s.setNow("17:10:01"); // the window ends while the entry is being prepared
    return r;
  };
  const r = await s.gate.enter(loadSignal("EDGE", 20, s.now()));
  assert.equal(r.status, "refused");
  assert.equal((r as any).reason, AFTERNOON_WINDOW_ENDED);
  assert.equal(s.broker.orders.filter((o) => o.symbol === "EDGE").length, 0, "nothing reached Alpaca");
  const stored = (await s.store.listOrders(D)).find((o) => o.symbol === "EDGE");
  assert.equal(stored?.note, "afternoon load window ended before sending", "refused by the check just before sending");
});

test("group 2, round 1: with the stop on when the afternoon close-out finishes flat, its line names the stop instead of offering `go`", async () => {
  const { r } = await flatAtMidday({ load: true });
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  r.ownerSays("stop", "17:00:00");
  await r.at("17:00:05");
  await r.at("17:10:06");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[AFTERNOON_FLAT_PHASE]) && !r.worker["inflight"].has("midday"));
  const line = r.said("commands").find((t) => t.startsWith("Afternoon load window over:"));
  assert.ok(line, r.said("commands").join(" | "));
  assert.ok(!line!.includes("`go` resumes"), line);
  assert.match(line!, /The stop flag is on/);
});

test("group 2, round 2: on a normal morning after `go`, then `flatten`, the stop refusal says the window cannot start today (no false next step)", async () => {
  const { r } = await flatAtMidday();
  r.ownerSays("go", "16:35:00");
  await r.at("16:35:05");
  r.ownerSays("flatten", "16:38:00");
  await r.at("16:38:05");
  await r.at("16:38:30");
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  const line = r.said("commands").find((t) => t.startsWith("Not started: with the stop flag on"));
  assert.ok(line, r.said("commands").join(" | "));
  assert.match(line!, /trading already resumed after the mid-day pause today, so the window cannot start today\. `resume` returns to normal trading at once\.$/);
  assert.ok(!line!.includes("`load afternoon` again"));
});

test("group 2, round 2: if the afternoon close-out never finished flat, `status` after the regular close-out time says that close-out took over, in both lines", async () => {
  const { sim, r } = await flatAtMidday({ load: true });
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:50:00");
  await hold(sim, r.store, "AAA", 1, 10, 1);
  sim.refuseSellsTimes = 1_000_000;
  await r.at("17:10:06");
  await until(() => !r.worker["inflight"].has("midday"));
  sim.refuseSellsTimes = 0;
  await r.at("20:56:00"); // after the regular close-out time (2:55 PM CT)
  await until(() => !r.worker["inflight"].has("closeout") && !r.worker["inflight"].has("midday"));
  r.ownerSays("status", "20:57:00");
  await r.at("20:57:05");
  const st = r.said("commands").filter((t) => t.startsWith("**Status**")).at(-1)!;
  assert.ok((await r.store.getDay(D))!.phases[AFTERNOON_FLAT_PHASE] === undefined, "the afternoon close-out never wrote its phase");
  assert.match(st, /its close-out did not finish flat before the regular close-out took over/);
  assert.match(st, /entries paused again at 11:10 AM CT, when the afternoon load window ended \(the regular close-out took over\)/);
  assert.ok(!st.includes("its close-out still selling"), st);
});
