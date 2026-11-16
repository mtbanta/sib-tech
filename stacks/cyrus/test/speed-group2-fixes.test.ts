// The speed release, group 2 round 1 fixes (builds/build-c2-log.md, "Speed release, round 1"; Michael's answers on the speed release
// questions). Item 1: choice 5 reverted; urgent work (P1 without a minuteCap) is held to its own 60 a minute and 15 in 5 seconds, as on
// 20ba5bd, while stuck retries keep the grown minute (the minute less 15) and P2 the minute less 20.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RequestBudget, Reservation, URGENT_GROWN_MINUTE } from "../src/request-budget.ts";
import { STUCK_RETRY_MINUTE_CAP } from "../src/risk.ts";

const CAP = STUCK_RETRY_MINUTE_CAP;

// A budget whose governor reports `seen.n` answers in the last 60 s, with Alpaca's remaining at `rem.n`.
function world(seenN: number, opts: { urgentGrownMinute?: boolean } = {}) {
  const clock = { t: 1_000_000 };
  const seen = { n: seenN };
  const rem = { n: 200 };
  const logs: Array<{ event: string; data?: Record<string, unknown> }> = [];
  const b: any = new RequestBudget({ now: () => clock.t, remaining: () => rem.n, requestsLastMinute: () => seen.n, log: (event, data) => logs.push({ event, data }), ...opts });
  const climb = (seconds = 10) => {
    for (let i = 0; i < seconds; i++) {
      b.budgetMinute();
      clock.t += 1_000;
    }
    b.budgetMinute();
  };
  return { clock, seen, rem, b, logs, climb };
}
// One try of `n` requests, sent at once (not forced unless asked), ended.
function send(b: any, cls: "P1" | "P2", n: number, o: { minuteCap?: number; fiveSec?: boolean; force?: boolean; retryKey?: string } = {}): boolean {
  const r = b.tryReserve(cls, n, { label: "test", fiveSec: o.fiveSec ?? false, ...(o.force ? { force: true } : {}), ...(o.minuteCap ? { minuteCap: o.minuteCap } : {}), ...(o.retryKey ? { retryKey: o.retryKey } : {}) });
  if (!(r instanceof Reservation)) return false;
  for (let i = 0; i < n; i++) r.charge("/v2/test");
  r.end();
  return true;
}

test("item 1: choice 5 is switched off (urgent work held to its own 60 a minute and 15 in 5 s)", () => {
  assert.equal(URGENT_GROWN_MINUTE, false);
});

test("item 1: at a grown minute (150), urgent work alone stops at its own 60 a minute and 15 in 5 seconds", () => {
  const w = world(50); // spare 150
  w.climb();
  assert.equal(w.b.budgetMinute(), 150);
  assert.ok(w.b.roomFor("P1", 15).ok, "15 in 5 s");
  assert.ok(!w.b.roomFor("P1", 16).ok, "not 16 in 5 s");
  assert.equal(w.b.roomFor("P1", 16).why, "five");
  assert.ok(w.b.roomFor("P1", 60, false).ok, "a close-out retry of 60 (no 5 s cap)");
  const r = w.b.roomFor("P1", 61, false);
  assert.ok(!r.ok && r.why === "minute", "not 61");
  // A stuck retry's 5 requests first (not urgent work's), then urgent work sends 50 one a second (out of the 5 s by the time it looks);
  // then 10 more fit and 11 do not.
  assert.ok(send(w.b, "P1", 5, { minuteCap: CAP }));
  w.seen.n = 55;
  w.clock.t += 1_000;
  for (let i = 0; i < 50; i++) {
    assert.ok(send(w.b, "P1", 1), `urgent request ${i}`);
    w.seen.n = 50 + w.b.inUse().minute;
    w.clock.t += 1_000;
  }
  w.clock.t += 5_000;
  assert.equal(w.b.budgetMinute(), 150, "still 150");
  assert.ok(w.b.roomFor("P1", 10, false).ok && !w.b.roomFor("P1", 11, false).ok, "its own 60 in the minute");
  // The refusal says when urgent work's own oldest request leaves the window (not when the stuck retry's older ones do).
  const no = w.b.roomFor("P1", 11, false);
  assert.ok(!no.ok);
  const oldest = 1_000_000 + 11_000; // its first request: after the 10 s climb and the stuck retry's second
  assert.equal(no.at, oldest + 60_000);
});

test("item 1: with stuck retries at their grown ceiling (the minute less 15), urgent work still gets 15: a try of 15 is granted, one of 16 refused", () => {
  const w = world(50);
  w.climb();
  assert.equal(w.b.budgetMinute(), 150);
  // Stuck retries use their whole 135, spread out so the 5 seconds are clear by the time urgent work looks.
  for (let i = 0; i < 27; i++) {
    assert.ok(send(w.b, "P1", 5, { minuteCap: CAP }), `stuck try ${i}`);
    w.seen.n = 50 + w.b.inUse().minute;
    w.clock.t += 1_500;
  }
  w.clock.t += 5_000;
  assert.equal(w.b.inUse().minute, 135);
  assert.equal(w.b.budgetMinute(), 150);
  assert.ok(!w.b.roomFor("P1", 1, false, 0, CAP, "S").ok, "the stuck retries are at their ceiling");
  assert.ok(w.b.roomFor("P1", 15, false).ok, "urgent work: 15");
  assert.ok(!w.b.roomFor("P1", 16, false).ok, "not 16");
  // The stuck sends are not in urgent work's own 60: it takes its 15, and its own count is 15 of 60.
  assert.ok(send(w.b, "P1", 15));
  assert.equal(w.b.inUse().minute, 150);
});

test("item 1: after the minute falls, urgent work still has its 15 above the stuck retries' sends, and never more than 60 of its own", () => {
  const w = world(50);
  w.climb();
  for (let i = 0; i < 27; i++) {
    send(w.b, "P1", 5, { minuteCap: CAP });
    w.seen.n = 50 + w.b.inUse().minute;
    w.clock.t += 1_500;
  }
  w.seen.n = 135 + 170; // entries start: spare 30
  w.clock.t += 6_000;
  assert.equal(w.b.budgetMinute(), 60, "the minute fell to 60");
  assert.ok(w.b.roomFor("P1", 15, false).ok && !w.b.roomFor("P1", 16, false).ok, "urgent work has exactly its 15");
  assert.ok(!w.b.roomFor("P1", 1, false, 0, CAP, "S").ok, "stuck retries wait");
  assert.ok(!w.b.roomFor("P2", 1, false).ok, "P2 waits");
});

test("item 1 (known, as on 20ba5bd): the guarantee is for the minute; in the 5 seconds stuck retries may use the quarter of the minute, and an urgent try that does not fit waits for the 5 seconds (at most 5 s)", () => {
  const w = world(50);
  w.climb();
  assert.equal(w.b.budgetMinute(), 150);
  // Stuck retries send 35 of the 5 seconds' 37 (a quarter of 150), within 5 s.
  for (let i = 0; i < 7; i++) {
    assert.ok(send(w.b, "P1", 5, { minuteCap: CAP, fiveSec: true }), `stuck try ${i}`);
    w.seen.n = 50 + w.b.inUse().minute;
    w.clock.t += 500;
  }
  assert.ok(w.b.roomFor("P1", 2).ok, "urgent work: 2 fit in the 5 seconds");
  const no = w.b.roomFor("P1", 3);
  assert.ok(!no.ok && no.why === "five", "3 do not (35 + 3 above 37)");
  assert.ok(no.at - w.clock.t <= 5_000, `it waits at most 5 s: ${no.at - w.clock.t} ms`);
  assert.ok(w.b.roomFor("P1", 3, false).ok, "a close-out retry (no 5 s cap) is not held by it");
});

test("item 1: while busy (the minute 60), urgent work's room is exactly 20ba5bd's: 60 in all, 15 in 5 s, 15 left when stuck retries used 45", () => {
  const w = world(170); // spare 30
  w.climb();
  assert.equal(w.b.budgetMinute(), 60);
  assert.ok(w.b.roomFor("P1", 15).ok && !w.b.roomFor("P1", 16).ok);
  for (let i = 0; i < 9; i++) {
    send(w.b, "P1", 5, { minuteCap: CAP });
    w.seen.n = 170 + w.b.inUse().minute;
    w.clock.t += 1_500;
  }
  w.clock.t += 5_000;
  assert.equal(w.b.inUse().minute, 45);
  assert.ok(w.b.roomFor("P1", 15, false).ok && !w.b.roomFor("P1", 16, false).ok);
});

test("item 1: a forced try (the 2:55 retry from 2:58) is counted in urgent work's own 60, so later urgent work waits for it", () => {
  const w = world(50);
  w.climb();
  assert.ok(send(w.b, "P1", 60, { force: true }));
  w.seen.n = 50 + 60;
  w.clock.t += 6_000;
  assert.ok(!w.b.roomFor("P1", 1, false).ok, "urgent work's own 60 used");
  assert.ok(w.b.roomFor("P1", 10, false, 0, CAP, "S").ok, "a stuck retry still fits in the grown minute (60 + 10 under 135)");
});

test("item 1: urgent tries running (reserved, not yet sent) count against its own 60 and 15", () => {
  const w = world(50);
  w.climb();
  const a = w.b.tryReserve("P1", 50, { label: "close-out retry", fiveSec: false });
  assert.ok(a instanceof Reservation);
  assert.ok(w.b.roomFor("P1", 10, false).ok && !w.b.roomFor("P1", 11, false).ok, "50 reserved: 10 left");
  const b = w.b.tryReserve("P1", 10, { label: "loss stop re-sell" });
  assert.ok(b instanceof Reservation);
  assert.ok(!w.b.roomFor("P1", 1, true).ok, "60 reserved");
  a.end();
  assert.ok(w.b.roomFor("P1", 5).ok && !w.b.roomFor("P1", 6).ok, "the 5 seconds: 10 reserved by a 5 s try, 5 left");
  b.end();
});

test("item 1: with the switch on (choice 5), urgent work goes above 60 under the grown minute, as at 9e48f2f", () => {
  const w = world(50, { urgentGrownMinute: true });
  w.climb();
  assert.equal(w.b.budgetMinute(), 150);
  assert.ok(w.b.roomFor("P1", 37).ok && !w.b.roomFor("P1", 38).ok, "the 5 seconds: a quarter of 150");
  assert.ok(w.b.roomFor("P1", 150, false).ok && !w.b.roomFor("P1", 151, false).ok, "the minute: 150");
});

// ---------------- item 3: the minute in force in the stored row (logging only) ----------------

test("item 3: a quiet minute's row stores the minute in force (lowest, highest, the ceiling urgent work was checked against, urgent work's own 60 and 15), with mostBudgetedInMinute at or below its highest, and refused.turn", () => {
  const w = world(50); // spare 150
  w.b.takeMinute(); // start a fresh stored minute
  w.climb(); // 80, 100, 120, 140, 150
  for (let i = 0; i < 20; i++) {
    send(w.b, "P1", 5, { minuteCap: CAP });
    w.seen.n = 50 + w.b.inUse().minute;
    w.clock.t += 1_000;
  }
  send(w.b, "P1", 3); // urgent work
  w.b.roomFor("P1", 1, false); // urgent work's ceiling looked at
  const row = w.b.takeMinute();
  assert.deepEqual(row.minuteInForce, { lowest: 60, highest: 150, ceilingHighest: 150, urgent: { minute: 60, five: 15 } });
  assert.equal(row.mostBudgetedInMinute, 103);
  assert.ok(row.mostBudgetedInMinute <= row.minuteInForce.highest);
  assert.equal(row.mostUrgentInMinute, 3);
  assert.equal(row.mostUrgentIn5s, 3);
  assert.equal(typeof row.refused.turn, "number");
  // The next stored minute starts from the minute in force (150), not 60, and storing it changed no decision (the minute is not recomputed).
  const next = w.b.takeMinute();
  assert.deepEqual(next.minuteInForce, { lowest: 150, highest: 150, ceilingHighest: 150, urgent: { minute: 60, five: 15 } });
});

test("item 3: after the minute falls, the row keeps the higher ceiling urgent work was checked against, which bounds mostBudgetedInMinute", () => {
  const w = world(50);
  w.climb();
  for (let i = 0; i < 27; i++) {
    send(w.b, "P1", 5, { minuteCap: CAP });
    w.seen.n = 50 + w.b.inUse().minute;
    w.clock.t += 1_500;
  }
  w.b.takeMinute();
  w.seen.n = 135 + 170; // spare 30
  w.clock.t += 6_000;
  assert.ok(send(w.b, "P1", 15)); // urgent work takes its 15 above the stuck retries' 135
  const row = w.b.takeMinute();
  assert.equal(row.minuteInForce.lowest, 60);
  assert.equal(row.minuteInForce.highest, 150, "the 150 was in force when the stored minute began");
  assert.equal(row.minuteInForce.ceilingHighest, 150);
  assert.equal(row.mostBudgetedInMinute, 150);
  assert.ok(row.mostBudgetedInMinute <= row.minuteInForce.ceilingHighest);
});

test("item 3: with choice 5 switched on, the row says urgent work has no own ceiling (null)", () => {
  const w = world(50, { urgentGrownMinute: true });
  assert.equal(w.b.takeMinute().minuteInForce.urgent, null);
});

// ---------------- item 2: the timed pass's failed view read backs off ----------------

import { SimBroker } from "./sim-broker.ts";
import { rig } from "./rig.ts";
import { VIEW_BACKOFF_FIRST_MS, VIEW_BACKOFF_MOST_MS } from "../src/worker.ts";

// An armed session at 14:30:05 UTC on the simulator, with the live order updates connected; every view read is recorded with its source
// (the timed pass, the full pass, or the gate inside an entry decision) and whether it failed.
async function viewSession() {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const logs: Array<{ level: string; event: string; data?: Record<string, unknown> }> = [];
  const r: any = rig({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true, log: (level, event, data) => logs.push({ level, event, data }) });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const w: any = r.worker;
  const fail = { on: false };
  const reads: Array<{ t: number; from: string; failed: boolean }> = [];
  const where = { now: "other" };
  const rf = w.view.refreshFast.bind(w.view);
  w.view.refreshFast = async () => {
    reads.push({ t: sim.simMs, from: where.now, failed: fail.on });
    if (fail.on) throw new Error("simulated view read failure");
    return rf();
  };
  const timed = w.timedTick.bind(w);
  w.timedTick = async () => {
    where.now = "timed pass";
    try { return await timed(); } finally { where.now = "other"; }
  };
  // The carried-position scan's read (every 30 s, a view no older than 10 s) runs inside the full pass; told apart here.
  const fresh = w.view.freshPositions.bind(w.view);
  w.view.freshPositions = async (maxAgeMs: number) => {
    const was = where.now;
    where.now = "carried-position scan";
    try { return await fresh(maxAgeMs); } finally { where.now = was; }
  };
  const syncs: number[] = [];
  const origSync = w.startSync.bind(w);
  w.startSync = (...a: unknown[]) => {
    if (w.backgroundReady("risk")) syncs.push(sim.simMs);
    return origSync(...a);
  };
  const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((x) => setImmediate(x)); };
  // One second at a time from `fromMs`: the timed pass every second, and the full pass every 5 s when `full`.
  const run = async (fromMs: number, seconds: number, full = false) => {
    for (let i = 1; i <= seconds; i++) {
      const iso = new Date(fromMs + i * 1_000).toISOString();
      if (full && i % 5 === 0) {
        where.now = "full pass";
        await r.at(iso);
        where.now = "other";
      } else r.setNow(iso);
      await w.timedTick();
      await settle();
    }
  };
  const rows = () => logs.filter((l) => l.level === "warn" && l.event === "timed_pass_failed");
  return { r, sim, w, fail, reads, where, run, rows, logs, syncs };
}

test("item 2: the backoff constants are 5 s doubling to 30 s", () => {
  assert.equal(VIEW_BACKOFF_FIRST_MS, 5_000);
  assert.equal(VIEW_BACKOFF_MOST_MS, 30_000);
});

test("item 2: with the view read failing for 60 s, the timed pass reads at 5, 10, 20, 30 s steps (4 reads, 4 rows, not about one a second); a success resets the backoff", async () => {
  const s = await viewSession();
  s.w.view.invalidate(); // the view is due at once
  s.fail.on = true;
  const t0 = s.sim.simMs;
  s.reads.length = 0;
  await s.run(t0, 60);
  const timed = s.reads.filter((x) => x.from === "timed pass");
  console.log(`item 2, timed pass alone, 60 s failing: ${timed.length} reads, ${s.rows().length} rows, at +${timed.map((x) => (x.t - t0) / 1000).join(", +")} s`);
  assert.deepEqual(timed.map((x) => x.t - t0), [1_000, 6_000, 16_000, 36_000], "after 5, 10 and 20 s (the next, 30 s later, falls after the 60 s)");
  assert.equal(s.rows().length, 4, "one row per backoff step");
  assert.deepEqual(s.rows().map((x) => x.data?.retryInMs), [5_000, 10_000, 20_000, 30_000]);
  // The order sync keeps its 6 s through the backoff (only the view is skipped).
  const during = s.syncs.filter((t) => t > t0 && t <= t0 + 60_000);
  const syncGaps = during.slice(1).map((t, i) => t - during[i]!);
  assert.ok(syncGaps.length >= 8 && syncGaps.every((g) => g === 6_000), `syncs every 6 s during the backoff: ${syncGaps.join(", ")}`);
  // Success: the read at +66 s succeeds and resets the backoff; a later failure starts again at 5 s.
  s.fail.on = false;
  await s.run(t0 + 60_000, 10);
  const ok = s.reads.filter((x) => x.from === "timed pass" && !x.failed);
  assert.equal(ok.length, 1);
  assert.equal(ok[0]!.t - t0, 66_000);
  assert.equal(s.w.viewBackoffMs, 0, "reset on success");
  s.w.view.invalidate();
  s.fail.on = true;
  const t1 = s.sim.simMs;
  const before = s.rows().length;
  await s.run(t1, 7);
  assert.equal(s.rows().length - before, 2, "two failures 5 s apart");
  assert.deepEqual(s.rows().slice(before).map((x) => x.data?.retryInMs), [5_000, 10_000], "the backoff starts again at 5 s");
});

test("item 2: with the full pass running too, its own view read every 5 s is unchanged (as on 20ba5bd) and a success by it resets the timed pass's backoff", async () => {
  const s = await viewSession();
  s.w.view.invalidate();
  s.fail.on = true;
  const t0 = s.sim.simMs;
  s.reads.length = 0;
  await s.run(t0, 60, true);
  const timed = s.reads.filter((x) => x.from === "timed pass").length;
  const full = s.reads.filter((x) => x.from === "full pass").length;
  const scan = s.reads.filter((x) => x.from === "carried-position scan").length;
  console.log(`item 2, timed and full pass, 60 s failing: ${s.reads.length} reads (timed pass ${timed}, full pass's own view read ${full}, carried-position scan ${scan}, other ${s.reads.length - timed - full - scan}), ${s.rows().length} timed_pass_failed rows`);
  assert.ok(timed <= 4, `timed pass reads: ${timed}`);
  assert.equal(full, 12, "the full pass reads its own view on each of its 12 passes while the view is stale, as on 20ba5bd");
  assert.ok(s.rows().length <= 4, `rows: ${s.rows().length}`);
  // The full pass's next read succeeds: the timed pass's backoff ends with it.
  s.fail.on = false;
  await s.run(t0 + 60_000, 5, true);
  assert.ok(s.reads.some((x) => x.from !== "timed pass" && !x.failed), "a read by the full pass succeeded");
  await s.run(t0 + 65_000, 1);
  assert.equal(s.w.viewBackoffMs, 0, "a success by the full pass ends the backoff");
});

// ---------------- item 7: ruling 4 (the view every 20 s) against the gate's own 15 s refresh (a measurement) ----------------

// Runs 60 s of a load window (live updates connected) from 14:46 UTC (8:46 AM Central), with prints every 0.1 s across 30 names when
// `withEntries` (none otherwise), the full pass every 5 s and the timed pass every second; returns every view read with its source.
async function viewReads(withEntries: boolean) {
  const symbols = Array.from({ length: 30 }, (_, i) => `S${String(i).padStart(2, "0")}`);
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const r: any = rig({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true, liveList: symbols });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("load on\nposition 400\nloss 5000\ntrades 150\ncap 1", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:15:00");
  sim.clockOpen = true;
  await r.at("14:25:00");
  await r.at("14:45:00");
  const w: any = r.worker;
  const where = { now: "other" };
  const reads: Array<{ t: number; from: string }> = [];
  const rf = w.view.refreshFast.bind(w.view);
  w.view.refreshFast = async () => (reads.push({ t: sim.simMs, from: where.now }), rf());
  const snap = w.view.snapshot.bind(w.view);
  w.view.snapshot = async (limits: unknown) => {
    const was = where.now;
    where.now = "gate";
    try { return await snap(limits); } finally { where.now = was; }
  };
  const fresh = w.view.freshPositions.bind(w.view);
  w.view.freshPositions = async (maxAgeMs: number) => {
    const was = where.now;
    where.now = "carried-position scan";
    try { return await fresh(maxAgeMs); } finally { where.now = was; }
  };
  let entries = 0;
  const realSubmit = sim.submitEntry.bind(sim);
  sim.submitEntry = async (e: any) => (entries++, realSubmit(e));
  const price = symbols.map((_, i) => 10 + i * 0.5);
  const t0 = Date.UTC(2026, 10, 2, 14, 46);
  const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((x) => setImmediate(x)); };
  for (let ms = 0; ms <= 60_000; ms += 100) {
    const t = t0 + ms;
    const iso = new Date(t).toISOString();
    if (ms % 5_000 === 0) {
      where.now = "full pass";
      await r.at(iso);
      where.now = "other";
    }
    if (ms % 1_000 === 0) {
      r.setNow(iso);
      where.now = "timed pass";
      await w.timedTick();
      where.now = "other";
      await settle();
    }
    if (!withEntries) continue;
    const i = (ms / 100) % symbols.length;
    price[i] = Math.round((price[i]! + (ms % 300 === 0 ? 0.01 : -0.01)) * 100) / 100;
    sim.prices.set(symbols[i]!, price[i]!);
    await r.trade(symbols[i]!, price[i]!, iso);
  }
  const from = (f: string) => reads.filter((x) => x.from === f).length;
  const gaps = reads.slice(1).map((x, i) => Math.round((x.t - reads[i]!.t) / 100) / 10);
  const line = `${entries} entries sent; ${reads.length} view reads (gate ${from("gate")}, timed pass ${from("timed pass")}, carried-position scan ${from("carried-position scan")}, full pass's own ${from("full pass")}, other ${from("other")}); at +${reads.map((x) => (x.t - t0) / 1000).join(", +")} s; gaps ${gaps.join(", ")} s`;
  return { entries, reads, from, gaps, line, live: w.orderStreamLive() as boolean };
}

test("item 7 (measured): entries flowing for 60 s on a load window with the live updates connected: the view is read about every 15 s, by the gate inside entry decisions and by the 30 s carried-position scan, not every 20 s", { timeout: 120_000 }, async () => {
  const m = await viewReads(true);
  console.log(`item 7, with entries: ${m.line}`);
  assert.ok(m.live, "the live updates connected");
  assert.ok(m.entries >= 30, `entries flowed: ${m.entries}`);
  // What it shows (not a rule the code must keep): the gate's 15 s limit (VIEW.fastMs in gate.ts) reads the view inside an entry decision
  // before the timed pass's 20 s (19.5 s) comes due, and the carried-position scan (every 30 s, a view no older than 10 s) reads it too.
  assert.ok(m.from("gate") >= 1, "the gate reads the view inside entry decisions");
  assert.equal(m.from("timed pass"), 0, "the timed pass's 20 s never comes due");
  assert.ok(m.reads.length >= 4 && m.reads.length <= 5, `about every 15 s: ${m.reads.length} reads in 60 s`);
  assert.ok(m.gaps.every((g) => g >= 14 && g < 20), `gaps about 15 s: ${m.gaps.join(", ")}`);
});

test("item 7 (measured): the same 60 s without entries: the view is read every 20 s (here by the full pass and the carried-position scan, which run first at the same moment as the timed pass)", { timeout: 120_000 }, async () => {
  const m = await viewReads(false);
  console.log(`item 7, without entries: ${m.line}`);
  assert.equal(m.entries, 0);
  assert.equal(m.from("gate"), 0);
  assert.ok(m.gaps.length >= 2 && m.gaps.every((g) => g >= 19.5 && g <= 20), `every 20 s: ${m.gaps.join(", ")}`);
});
