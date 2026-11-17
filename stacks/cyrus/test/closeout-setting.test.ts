// Michael's night build request of 2026-11-16, item 4: "The close-out time becomes a setting; set it to 2:45 PM Central for the test."
// The setting is CLOSEOUT_MINUTES_BEFORE_CLOSE (minutes before the market close, a whole number from 5 to 30, default 5). The simulated
// day is 2026-11-02 (New York standard time): open 14:30 UTC (8:30 CT), the close 21:00 UTC (3:00 PM CT); 5 minutes gives 20:55 UTC
// (2:55 PM CT), 15 gives 20:45 UTC (2:45 PM CT). The half day closes at 13:00 New York (18:00 UTC, 12:00 PM CT): 15 gives 11:45 AM CT.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, z, D } from "./rig.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { DEFAULT_CLOSEOUT_MINUTES_BEFORE_CLOSE, loadSettings, parseCloseoutMinutes } from "../src/config.ts";
import { retryQuietBeforeCloseMs } from "../src/risk.ts";
import { MIDDAY_PHASE, readPause } from "../src/midday.ts";
import { AFTERNOON_FLAT_PHASE, LOAD_AFTERNOON_PHASE } from "../src/load-mode.ts";
import { centralClock } from "../src/time.ts";
import { CONTROL_STOP, MemoryStore, type DayRecord, type StopFlag, type Store } from "../src/store.ts";
import { makeLogAndStore } from "../src/run-log.ts";
import { logSettingWarnings, logWorkerStarted } from "../src/start-note.ts";
import { afternoonStatusLine } from "../src/commands.ts";
import { FakeBroker } from "./helpers.ts";
import { FAKE_ENV } from "./fakes.ts";

const until = async (cond: () => boolean | Promise<boolean>, n = 400) => {
  for (let i = 0; i < n && !(await cond()); i++) await settle();
};

// ---------------- the setting ----------------

test("the setting: unset is the default 5 with no warning; 5 to 30 are taken as they are", () => {
  assert.equal(DEFAULT_CLOSEOUT_MINUTES_BEFORE_CLOSE, 5);
  const s = loadSettings({ ...FAKE_ENV });
  assert.equal(s.closeoutMinutesBeforeClose, 5);
  assert.deepEqual(s.warnings, []);
  assert.deepEqual(parseCloseoutMinutes(undefined), { minutes: 5, warning: null });
  assert.deepEqual(parseCloseoutMinutes("  "), { minutes: 5, warning: null }, "blank is unset");
  for (const [raw, n] of [["5", 5], ["15", 15], [" 15 ", 15], ["30", 30], ["010", 10]] as const) {
    const t = loadSettings({ ...FAKE_ENV, CLOSEOUT_MINUTES_BEFORE_CLOSE: raw });
    assert.equal(t.closeoutMinutesBeforeClose, n, raw);
    assert.deepEqual(t.warnings, [], raw);
  }
});

test("the setting: anything else falls back to the default with a warning (the worker still starts)", () => {
  for (const raw of ["4", "0", "31", "60", "-5", "15.5", "1e1", "abc", "15 minutes", "0x0f", "+15"]) {
    const t = loadSettings({ ...FAKE_ENV, CLOSEOUT_MINUTES_BEFORE_CLOSE: raw });
    assert.equal(t.closeoutMinutesBeforeClose, 5, raw);
    assert.equal(t.warnings.length, 1, raw);
    assert.match(t.warnings[0]!, /CLOSEOUT_MINUTES_BEFORE_CLOSE .*not a whole number from 5 to 30: using the default, 5/, raw);
  }
});

// fly.toml's [env] carries the setting (15 for the test, 2:45 PM Central, when this was written). Only its validity is checked here, so
// changing the test value back (or removing the line) needs no change to this test; a value that would fall back to the default fails it.
test("fly.toml's setting, when present, is a valid whole number (no fallback warning)", () => {
  const toml = readFileSync(new URL("../fly.toml", import.meta.url), "utf8");
  const env = toml.split("[env]")[1]!.split(/\n\[/)[0]!;
  const m = env.match(/^\s*CLOSEOUT_MINUTES_BEFORE_CLOSE = "([^"]*)"\s*$/m);
  if (!m) return;
  const s = loadSettings({ ...FAKE_ENV, CLOSEOUT_MINUTES_BEFORE_CLOSE: m[1] });
  assert.deepEqual(s.warnings, []);
  assert.equal(s.closeoutMinutesBeforeClose, Number(m[1]));
});

// Group 2, night build round 1 (B2): `setting_invalid` and `worker_started` reach the run log, not only Fly's log, so the reviews take the
// day's setting from the stored `worker_started` row.
test("start-up lines: an invalid setting's warning and worker_started (with the setting) go to Fly's log and into the run log, in that order, each once", async () => {
  const s = loadSettings({ ...FAKE_ENV, CLOSEOUT_MINUTES_BEFORE_CLOSE: "abc" });
  assert.equal(s.warnings.length, 1);
  const fly: Array<{ level: string; event: string; fields?: Record<string, unknown> }> = [];
  const store = new MemoryStore();
  const out = makeLogAndStore((level, event, fields) => void fly.push({ level, event, fields }), store, (t) => t);
  logSettingWarnings(out, s.warnings);
  logWorkerStarted(out, { feed: s.alpaca.dataFeed, closeoutMinutesBeforeClose: s.closeoutMinutesBeforeClose, recentStarts: 1, deploy: true });
  await settle();
  assert.deepEqual(fly.map((x) => `${x.level} ${x.event}`), ["warn setting_invalid", "info worker_started"]);
  assert.deepEqual(store.events.map((x) => `${x.level} ${x.event}`), ["warn setting_invalid", "info worker_started"]);
  assert.match(String(store.events[0]!.data?.warning), /CLOSEOUT_MINUTES_BEFORE_CLOSE/);
  assert.equal(store.events[1]!.data?.closeoutMinutesBeforeClose, 5, "the value in use, from the stored row");
  const fifteen = loadSettings({ ...FAKE_ENV, CLOSEOUT_MINUTES_BEFORE_CLOSE: "15" });
  const store2 = new MemoryStore();
  const out2 = makeLogAndStore(() => undefined, store2, (t) => t);
  logSettingWarnings(out2, fifteen.warnings);
  logWorkerStarted(out2, { feed: fifteen.alpaca.dataFeed, closeoutMinutesBeforeClose: fifteen.closeoutMinutesBeforeClose, recentStarts: 1, deploy: false });
  await settle();
  assert.deepEqual(store2.events.map((x) => x.event), ["worker_started"], "a valid setting: no warning");
  assert.equal(store2.events[0]!.data?.closeoutMinutesBeforeClose, 15);
});

test("start-up lines (structure): main.ts logs both through the run log's logger, the warnings once the database has answered, and prints them to Fly's log alone only if the start fails", () => {
  const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
  assert.match(main, /const logAndStore: LogAndStore = makeLogAndStore\(log, store, redact\);/);
  assert.match(main, /logWorkerStarted\(logAndStore, \{ feed: settings\.alpaca\.dataFeed, closeoutMinutesBeforeClose: settings\.closeoutMinutesBeforeClose,/);
  assert.doesNotMatch(main, /log\("(info|warn)", "(worker_started|setting_invalid)"/, "never straight to Fly's log only");
  const check = main.indexOf('await store.getControl("startup_check")');
  const failed = main.indexOf('log("error", "startup_failed"');
  const stored = main.indexOf("logSettingWarnings(logAndStore, settings.warnings);");
  const started = main.indexOf("logWorkerStarted(logAndStore");
  assert.ok(check > 0 && failed > check && stored > failed && started > stored, "the database check, the failure path, then the stored warnings, then worker_started");
  assert.ok(main.slice(check, failed).includes("logSettingWarnings(log, settings.warnings);"), "the failure path still prints them");
  assert.equal(main.split("logSettingWarnings(").length - 1, 2, "logged once on each path");
});

test("the close-out time: the default gives 2:55 PM CT; 15 gives 2:45 PM CT on a normal day and 11:45 AM CT on a half day", () => {
  const normalClose = z("21:00:00");
  const halfClose = new Date("2026-11-27T18:00:00Z"); // the day after Thanksgiving closes at 1:00 PM New York, 12:00 PM Central
  const dflt = rig().worker;
  const fifteen = rig({ closeoutMinutes: 15 }).worker;
  assert.equal(centralClock(dflt.closeoutAt(normalClose)), "2:55 PM CT");
  assert.equal(centralClock(dflt.closeoutAt(halfClose)), "11:55 AM CT");
  assert.equal(centralClock(fifteen.closeoutAt(normalClose)), "2:45 PM CT");
  assert.equal(centralClock(fifteen.closeoutAt(halfClose)), "11:45 AM CT");
});

test("the loss stop's retry goes quiet one minute before the close-out: 6 minutes before the close by default, 16 with 15", () => {
  assert.equal(retryQuietBeforeCloseMs(), 6 * 60_000, "unchanged at the default");
  assert.equal(retryQuietBeforeCloseMs(5), 6 * 60_000);
  assert.equal(retryQuietBeforeCloseMs(15), 16 * 60_000);
});

// ---------------- the worker ----------------

// An approved, armed day in the simulator with one filled position, the mid-day cycle off (it is tested in midday.test.ts).
async function armedHolding(opts: { closeoutMinutes?: number; early?: boolean } = {}) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  if (opts.early) sim.calendar = [{ date: "2026-11-02", open: "09:30", close: "13:00" }];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, midday: false, ...(opts.closeoutMinutes === undefined ? {} : { closeoutMinutes: opts.closeoutMinutes }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  await hold(sim, r.store, "AAA", 3, 20);
  return { sim, r };
}

async function hold(sim: SimBroker, store: Store, symbol: string, qty: number, price: number) {
  const id = clientOrderIdFor(D, symbol, 1);
  await sim.submitEntry({ symbol, qty, stopPrice: price * 0.9, takeProfitPrice: price * 1.1, referencePrice: price, clientOrderId: id });
  sim.fillEntry(id, price);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price * 0.9, takeProfitPrice: price * 1.1, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
}

test("in the worker, 15 starts the close-out phase at 2:45 PM CT (20:45 UTC), not before", async () => {
  const { sim, r } = await armedHolding({ closeoutMinutes: 15 });
  await r.at("20:44:00");
  await r.at("20:44:59");
  assert.equal((await r.store.getDay(D))!.phases.closeout, undefined, "not at 2:44:59 PM CT");
  assert.equal((await sim.listPositions()).length, 1, "still held at 2:44:59 PM CT");
  await r.at("20:45:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases.closeout));
  assert.ok((await r.store.getDay(D))!.phases.closeout, "the close-out ran at 2:45 PM CT");
  assert.equal((await sim.listPositions()).length, 0, "flat");
});

test("in the worker, the default still starts the close-out at 2:55 PM CT (20:55 UTC)", async () => {
  const { sim, r } = await armedHolding();
  await r.at("20:45:00");
  await r.at("20:54:59");
  assert.equal((await r.store.getDay(D))!.phases.closeout, undefined, "not at 2:45 or 2:54:59 PM CT");
  assert.equal((await sim.listPositions()).length, 1);
  await r.at("20:55:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases.closeout));
  assert.ok((await r.store.getDay(D))!.phases.closeout);
  assert.equal((await sim.listPositions()).length, 0);
});

test("in the worker, 15 on a half day starts the close-out at 11:45 AM CT (17:45 UTC)", async () => {
  const { sim, r } = await armedHolding({ closeoutMinutes: 15, early: true });
  await r.at("17:44:59");
  assert.equal((await r.store.getDay(D))!.phases.closeout, undefined);
  assert.equal((await sim.listPositions()).length, 1);
  await r.at("17:45:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases.closeout));
  assert.ok((await r.store.getDay(D))!.phases.closeout);
  assert.equal((await sim.listPositions()).length, 0);
});

test("the missing-exit check stands aside from the set close-out time (20:45 UTC with 15), and not before it by default", () => {
  const close = z("21:00:00");
  const fifteen = rig({ closeoutMinutes: 15 });
  fifteen.setNow("20:44:59");
  assert.equal(fifteen.worker.protectNow(close), true);
  fifteen.setNow("20:45:00");
  assert.equal(fifteen.worker.protectNow(close), false, "from 2:45 PM CT the close-out alone sells");
  const dflt = rig();
  dflt.setNow("20:45:00");
  assert.equal(dflt.worker.protectNow(close), true, "the default leaves it on until 2:55");
  dflt.setNow("20:55:00");
  assert.equal(dflt.worker.protectNow(close), false);
});

test("the emergency close-out (database down) follows the setting: from 2:45 PM CT with 15", { timeout: 20_000 }, async () => {
  const broker = new FakeBroker();
  broker.calendar = [{ date: "2026-11-02", open: "09:30", close: "16:00" }];
  broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  const r = rig({ broker, closeoutMinutes: 15 });
  await r.at("2026-11-01T22:10:00Z");
  await r.at("14:15:00");
  broker.positions = [{ symbol: "AAA", qty: 5, marketValue: 500, avgEntryPrice: 100, unrealizedPl: 0 }];
  r.store.failing = true;
  try {
    await r.at("20:44:00");
    assert.equal(broker.count("submitSell"), 0, "not 16 minutes before the close");
    await r.at("20:45:00");
    assert.equal(broker.count("submitSell"), 1, "sold from the broker's clock alone at 2:45 PM CT");
  } finally {
    r.store.failing = false;
    await settle();
  }
});

// ---------------- the texts ----------------

// Flat after the mid-day close-out, as release-2026-11-11.test.ts does it, with the afternoon load window on.
async function flatAtMidday(closeoutMinutes?: number, early = false) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  if (early) sim.calendar = [{ date: "2026-11-02", open: "09:30", close: "13:00" }];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, loadAfternoon: true, ...(closeoutMinutes === undefined ? {} : { closeoutMinutes }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("trades 20\nposition 300\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:15:00");
  await r.at("14:25:00");
  await r.at("14:30:05");
  await r.at("16:30:00");
  await until(async () => Boolean((await r.store.getDay(D))!.phases[MIDDAY_PHASE]));
  return { sim, r };
}

async function loadAfternoonReply(closeoutMinutes?: number, early = false): Promise<string> {
  const { r } = await flatAtMidday(closeoutMinutes, early);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:40:10");
  assert.ok((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], "the window started");
  const reply = r.said("commands").find((t) => t.startsWith("Afternoon load window on until"));
  assert.ok(reply, r.said("commands").join(" | "));
  return reply!;
}

test("the `load afternoon` reply names the set close-out time: 2:55 PM CT by default, 2:45 PM CT with 15, 11:45 AM CT on a half day", async () => {
  assert.match(await loadAfternoonReply(), /the regular close-out runs at 2:55 PM CT\./);
  const fifteen = await loadAfternoonReply(15);
  assert.match(fifteen, /the regular close-out runs at 2:45 PM CT\./);
  assert.doesNotMatch(fifteen, /2:55/);
  assert.match(await loadAfternoonReply(15, true), /the regular close-out runs at 11:45 AM CT\./);
});

test("the `status` line after the afternoon window: the regular close-out takes over at the set time (2:45 PM CT with 15)", () => {
  // The window ran from 11:40 AM CT to 12:10 PM CT and its close-out has not finished flat.
  const day = { tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), status: "approved", phases: { armed: "2026-11-02T14:25:00.000Z", [MIDDAY_PHASE]: "2026-11-02T16:31:00.000Z", [LOAD_AFTERNOON_PHASE]: z("16:40:10").toISOString() }, limits: { maxPositionUsd: 300, dailyLossStopUsd: 500, maxTradesPerMinute: 20, borrowingCap: 1 }, decided: { position: true, loss: true, trades: true, cap: true }, dayStartEquity: 20000, liveList: ["AAA"] } as unknown as DayRecord;
  const line = (t: string, minutes: number) => afternoonStatusLine(day, z(t), null, minutes);
  assert.match(line("20:44:59", 15), /its close-out is still selling/);
  assert.match(line("20:45:00", 15), /its close-out did not finish flat before the regular close-out took over/);
  assert.match(line("20:54:59", 5), /its close-out is still selling/, "the default: not before 2:55 PM CT");
  assert.match(line("20:55:00", 5), /regular close-out took over/);
});

// Group 2, night build round 1 (B5): the `go` refusal and the `status` Mid-day cycle line at a setting other than 5, in the worker. The
// afternoon window from 10:40 to 11:10 AM CT, a position held, its close-out kept from going flat (sales refused) up to the set close-out time.
test("with 15 and the afternoon close-out still pending: `go` at 2:44:59 PM CT says not finished flat yet; at 2:45:00 PM CT that the regular close-out has taken over; `status` at 2:45:00 says it took over", async () => {
  const { sim, r } = await flatAtMidday(15);
  r.ownerSays("load afternoon", "16:40:00");
  await r.at("16:40:05");
  await r.at("16:40:10");
  assert.ok((await r.store.getDay(D))!.phases[LOAD_AFTERNOON_PHASE], "the window started");
  await r.at("16:50:00");
  await hold(sim, r.store, "AAA", 1, 10);
  sim.refuseSellsTimes = 1_000_000;
  await r.at("17:10:06");
  await until(() => !r.worker["inflight"].has("midday"));
  await r.at("20:44:00");
  await until(() => !r.worker["inflight"].has("midday"));
  const pending = async (when: string) => {
    const day = (await r.store.getDay(D))!;
    assert.equal(day.phases[AFTERNOON_FLAT_PHASE], undefined, `the afternoon close-out has not finished flat (${when})`);
    assert.equal((await readPause(r.store, D))?.on, true, `the pause is still on (${when})`);
  };
  // The reply to a command (other lines the worker posts on the same pass are skipped).
  const ask = async (text: string, t: string, prefix: string) => {
    const before = r.said("commands").length;
    r.ownerSays(text, t);
    await r.at(t); // commands are read on the worker's pass
    const replies = () => r.said("commands").slice(before).filter((x) => x.startsWith(prefix));
    await until(() => replies().length > 0);
    assert.equal(replies().length, 1, `one reply to ${text}: ${r.said("commands").slice(before).join(" | ")}`);
    return replies()[0]!;
  };
  await pending("2:44 PM CT");
  assert.equal(await ask("go", "20:44:59", "Not resumed"), "Not resumed: the close-out after the afternoon load window has not finished flat yet.");
  await pending("2:44:59 PM CT");
  assert.equal(await ask("go", "20:45:00", "Not resumed"), "Not resumed: the close-out after the afternoon load window did not finish flat (the regular close-out has taken over).");
  await pending("2:45:00 PM CT");
  const st = await ask("status", "20:45:00", "**Status**");
  assert.ok(st.startsWith("**Status**"), st);
  assert.match(st, /Mid-day cycle: entries paused again at 11:10 AM CT, when the afternoon load window ended \(the regular close-out took over\)/);
  assert.ok(!st.includes("its close-out still selling"), st);
});

// The worker passes the setting to the loss stop's retry (risk.ts): quiet from one minute before the close-out, so from 20:44 UTC
// (2:44 PM CT) with 15, and from 20:54 UTC by default. The stop flag is the daily loss stop and the shares cannot be sold, so every
// loss check from here is a retry (round8.test.ts tests the retry itself). Only the retry's own sells are counted (reason "daily loss
// stop (retry)"): the shares also look carried from an earlier day, and that path's sells stop at the close-out time.
async function lossStopRetries(closeoutMinutes?: number) {
  const broker = new FakeBroker();
  let retrySells = 0;
  const log = (_l: string, e: string, d?: Record<string, unknown>) => void (e === "sell_failed" && d?.reason === "daily loss stop (retry)" && retrySells++);
  const r = rig({ broker, midday: false, log, ...(closeoutMinutes === undefined ? {} : { closeoutMinutes }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  await r.store.setControl(CONTROL_STOP, { on: true, at: z("20:40:00").toISOString(), reason: "daily loss stop reached (500.00 dollars)" } satisfies StopFlag);
  broker.positions = [{ symbol: "AAA", qty: 10, marketValue: 1000, avgEntryPrice: 100, unrealizedPl: 0 }];
  broker.onSell = async () => { throw new Error("sell refused (test)"); };
  // One pass every 5 seconds, as in production, from `from` (inclusive) to `to` (exclusive); the retry's sells sent in that span.
  const span = async (from: string, to: string) => {
    const before = retrySells;
    for (let t = z(from).getTime(); t < z(to).getTime(); t += 5_000) await r.at(new Date(t).toISOString());
    return retrySells - before;
  };
  return { span };
}

test("the loss stop's retry, through the worker, is quiet from one minute before the set close-out (20:44 UTC with 15, 20:54 by default)", async () => {
  const fifteen = await lossStopRetries(15);
  assert.ok((await fifteen.span("20:43:00", "20:44:00")) > 0, "retries before 2:44 PM CT");
  assert.equal(await fifteen.span("20:44:00", "20:45:00"), 0, "quiet from 2:44 PM CT, one minute before the 2:45 close-out");
  const dflt = await lossStopRetries();
  assert.ok((await dflt.span("20:43:00", "20:44:00")) > 0);
  assert.ok((await dflt.span("20:44:00", "20:45:00")) > 0, "the default still retries at 2:44 PM CT");
  assert.equal(await dflt.span("20:54:00", "20:55:00"), 0, "the default is quiet from 2:54 PM CT, as before");
});
