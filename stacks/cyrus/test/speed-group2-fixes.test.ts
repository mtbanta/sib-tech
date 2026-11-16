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
  // Urgent work sends 50 one a second (out of the 5 s by the time it looks), then 10 more fit and 11 do not.
  for (let i = 0; i < 50; i++) {
    assert.ok(send(w.b, "P1", 1), `urgent request ${i}`);
    w.seen.n = 50 + w.b.inUse().minute;
    w.clock.t += 1_000;
  }
  w.clock.t += 5_000;
  assert.equal(w.b.budgetMinute(), 150, "still 150");
  assert.ok(w.b.roomFor("P1", 10, false).ok && !w.b.roomFor("P1", 11, false).ok, "its own 60 in the minute");
  // The refusal says when its own oldest request leaves the window (not when any request does).
  const no = w.b.roomFor("P1", 11, false);
  assert.ok(!no.ok);
  const oldest = 1_000_000 + 10_000; // its first request, after the 10 s climb
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
