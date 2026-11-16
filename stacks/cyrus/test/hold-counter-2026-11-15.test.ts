// Michael's approval of 2026-11-15 (logging only): a per-minute counter for when P2's hold for a waiting ordinary stuck retry ("rechecks
// leave room", his answer of 2026-11-14 night) is in force: `governor_stats.requestBudget.retryHold` = { started, renewed, inForceMs,
// p2Refused }. These tests check each number from below and above; the decisions themselves are unchanged (checked against fa357df).
import { test } from "node:test";
import assert from "node:assert/strict";
import { STUCK_RETRY_MINUTE_CAP } from "../src/risk.ts";
import { RequestBudget, Reservation } from "../src/request-budget.ts";

const CAP = STUCK_RETRY_MINUTE_CAP;

// A budget on a test clock with six P2 requests sent 36.0 to 40.0 s, so a stuck retry of 10 at 40.1 s is short in the 5 seconds while P1
// alone would leave it room: its refusal (a look or a try) sets the hold.
function world() {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  for (let i = 0; i < 6; i++) {
    clock.t = 36_000 + i * 800;
    const r = b.tryReserve("P2", 1, { label: "list lag recheck" }) as Reservation;
    r.charge("/v2/test");
    r.end();
  }
  b.takeMinute(); // start each test from an empty minute
  clock.t = 40_100;
  return { b, clock };
}

const look = (b: any) => b.roomFor("P1", 10, true, 0, CAP);

test("hold counter: all zero when no hold was set", () => {
  const { b, clock } = world();
  const p2 = b.tryReserve("P2", 1, { label: "list lag recheck" });
  assert.ok(p2 instanceof Reservation, "P2 granted: no hold");
  p2.end();
  clock.t = 70_000;
  const m = b.takeMinute();
  assert.deepEqual(m.retryHold, { started: 0, renewed: 0, inForceMs: 0, p2Refused: 0 });
});

test("hold counter: a refused retry that sets no hold (urgent work alone fills the 5 seconds) counts nothing", () => {
  let t = 100_000;
  const b: any = new RequestBudget({ now: () => t });
  const urgent = b.tryReserve("P1", 15, { label: "unclear fresh stop lookup" }) as Reservation;
  for (let i = 0; i < 15; i++) urgent.charge("/v2/test");
  urgent.end();
  t = 101_000;
  const retry = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP });
  assert.ok(!(retry instanceof Reservation) && retry.why === "five", "refused in the 5 seconds");
  assert.ok(!look(b).ok, "its look refused too");
  assert.ok(b.retryWaitUntil <= t, "no hold: P1 alone fills the 5 seconds");
  t = 130_000;
  assert.deepEqual(b.takeMinute().retryHold, { started: 0, renewed: 0, inForceMs: 0, p2Refused: 0 });
});

test("hold counter: a hold set by a look is counted, and its time in force stops at the hold's end, not at the read", () => {
  const { b, clock } = world();
  const setAt = clock.t;
  assert.ok(!look(b).ok, "the look is refused");
  const end = b.retryWaitUntil;
  assert.ok(end > setAt, "the look set the hold");
  clock.t = end + 20_000; // read well after the hold ended
  const m = b.takeMinute();
  assert.equal(m.retryHold.started, 1);
  assert.equal(m.retryHold.renewed, 0);
  assert.equal(m.retryHold.inForceMs, end - setAt);
});

test("hold counter: a hold set by a refused try is counted the same way", () => {
  const { b, clock } = world();
  const setAt = clock.t;
  const retry = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP });
  assert.ok(!(retry instanceof Reservation));
  const end = b.retryWaitUntil;
  clock.t = end + 1_000;
  const m = b.takeMinute();
  assert.equal(m.retryHold.started, 1);
  assert.equal(m.retryHold.inForceMs, end - setAt);
});

test("hold counter: a renewal while in force is not a new start, and overlapping renewals do not count time twice", () => {
  const { b, clock } = world();
  const setAt = clock.t;
  assert.ok(!look(b).ok);
  const firstEnd = b.retryWaitUntil;
  clock.t = setAt + 500; // still in force, and the retry still short in the 5 seconds
  assert.ok(clock.t < firstEnd);
  assert.ok(!look(b).ok, "refused again");
  const end = b.retryWaitUntil;
  assert.ok(end > firstEnd, "renewed past its first end");
  clock.t = end + 5_000;
  const m = b.takeMinute();
  assert.equal(m.retryHold.started, 1, "one start");
  assert.equal(m.retryHold.renewed, 1, "one renewal");
  assert.equal(m.retryHold.inForceMs, end - setAt, "one interval, from the start to the last end");
});

test("hold counter: a hold set again after it lapsed is a new start, and the gap between holds is not counted", () => {
  const { b, clock } = world();
  const set1 = clock.t;
  assert.ok(!look(b).ok);
  const end1 = b.retryWaitUntil;
  // the lapse: well after the first hold, P2 sends six more in the 5 seconds before the next look
  for (let i = 0; i < 6; i++) {
    clock.t = end1 + 10_000 + i * 500;
    const r = b.tryReserve("P2", 1, { label: "list lag recheck" }) as Reservation;
    assert.ok(r instanceof Reservation, "P2 granted after the hold ended");
    r.charge("/v2/test");
    r.end();
  }
  clock.t = end1 + 13_100;
  const set2 = clock.t;
  assert.ok(set2 > end1);
  assert.ok(!look(b).ok, "refused again");
  const end2 = b.retryWaitUntil;
  assert.ok(end2 > set2, "a second hold");
  clock.t = end2 + 1_000;
  const m = b.takeMinute();
  assert.equal(m.retryHold.started, 2);
  assert.equal(m.retryHold.renewed, 0);
  assert.equal(m.retryHold.inForceMs, end1 - set1 + (end2 - set2), "the two holds, not the gap");
});

test("hold counter: time in force is split across a minute's read, and the counters start again at zero", () => {
  const { b, clock } = world();
  const setAt = clock.t;
  assert.ok(!look(b).ok);
  const end = b.retryWaitUntil;
  const mid = setAt + Math.floor((end - setAt) / 2);
  clock.t = mid;
  const m1 = b.takeMinute();
  assert.equal(m1.retryHold.started, 1);
  assert.equal(m1.retryHold.inForceMs, mid - setAt, "the first minute up to the read");
  clock.t = end + 30_000;
  const m2 = b.takeMinute();
  assert.equal(m2.retryHold.started, 0, "the start belongs to the first minute");
  assert.equal(m2.retryHold.renewed, 0);
  assert.equal(m2.retryHold.inForceMs, end - mid, "the rest, up to the hold's end");
  clock.t = end + 90_000;
  assert.equal(b.takeMinute().retryHold.inForceMs, 0, "nothing once it has ended");
});

test("hold counter: P2 refusals counted only when the hold alone caused them, and only for tries", () => {
  const { b, clock } = world();
  assert.ok(!look(b).ok, "the hold is set (P2 held to 5 in the 5 seconds; 6 already)");
  // held only: without the hold P2 would have 15 in the 5 seconds
  const held = b.tryReserve("P2", 1, { label: "list lag recheck" });
  assert.ok(!(held instanceof Reservation) && held.why === "five");
  // a look by P2 under the hold is refused too, but looks are not counted (as `refused` counts tries only)
  assert.ok(!b.roomFor("P2", 1).ok);
  // refused even without the hold: 6 + 10 passes the 15 in the 5 seconds
  const anyway = b.tryReserve("P2", 10, { label: "list lag recheck" });
  assert.ok(!(anyway instanceof Reservation) && anyway.why === "five");
  // after the hold ends, a refusal is never counted as held
  clock.t = b.retryWaitUntil;
  const after = b.tryReserve("P2", 13, { label: "list lag recheck" }); // 3 still in the 5 seconds, + 13 passes 15
  assert.ok(!(after instanceof Reservation), "still refused on the 5 seconds");
  const m = b.takeMinute();
  assert.equal(m.retryHold.p2Refused, 1, "only the first try");
  assert.equal(m.refused.five, 3, "each refusal is also counted under its reason");
});

test("hold counter: a P2 refusal on its floor under the hold is not counted as held", () => {
  const clock = { t: 0 };
  let remaining = 200;
  const b: any = new RequestBudget({ now: () => clock.t, remaining: () => remaining });
  for (let i = 0; i < 6; i++) {
    clock.t = 36_000 + i * 800;
    const r = b.tryReserve("P2", 1, { label: "list lag recheck" }) as Reservation;
    r.charge("/v2/test");
    r.end();
  }
  clock.t = 40_100;
  assert.ok(!look(b).ok, "the hold is set");
  remaining = 70; // below P2's floor of 80
  const p2 = b.tryReserve("P2", 1, { label: "list lag recheck" });
  assert.ok(!(p2 instanceof Reservation));
  assert.equal(b.takeMinute().retryHold.p2Refused, 0, "the floor would have refused it anyway");
});

test("hold counter: a P2 refusal on its share of 40 under the hold is not counted, one at 35 to 39 is", () => {
  const t = 100_000;
  const b: any = new RequestBudget({ now: () => t - 30_000 });
  // 36 budgeted requests sent 30 s ago (outside the 5 seconds; P2's share counts the whole minute)
  const r = b.tryReserve("P1", 36, { label: "other P1 work", fiveSec: false, force: true }) as Reservation;
  for (let i = 0; i < 36; i++) r.charge("/v2/test");
  r.end();
  b.nowMs = () => t;
  b.retryWaitUntil = t + 10_000;
  b.retryWaitRoom = 35;
  b.retryWaitFive = 5;
  const held = b.tryReserve("P2", 1, { label: "list lag recheck" }); // 37: within 40, above 35
  assert.ok(!(held instanceof Reservation) && held.why === "class");
  const anyway = b.tryReserve("P2", 5, { label: "list lag recheck" }); // 41: above 40 anyway
  assert.ok(!(anyway instanceof Reservation) && anyway.why === "class");
  const m = b.takeMinute();
  assert.equal(m.retryHold.p2Refused, 1);
  assert.equal(m.refused.class, 2);
});

test("hold counter: P1 refusals are never counted as held P2 refusals", () => {
  const { b } = world();
  assert.ok(!look(b).ok);
  const retry = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP });
  assert.ok(!(retry instanceof Reservation));
  const m = b.takeMinute();
  assert.equal(m.retryHold.p2Refused, 0);
  assert.equal(m.retryHold.started, 1);
  assert.equal(m.retryHold.renewed, 1, "the try's refusal renewed the look's hold");
});

test("hold counter: a P2 try refused on a minute ceiling of its own under the hold is not counted as held", () => {
  const t = 100_000;
  const b: any = new RequestBudget({ now: () => t - 30_000 });
  const r = b.tryReserve("P1", 30, { label: "other P1 work", fiveSec: false, force: true }) as Reservation;
  for (let i = 0; i < 30; i++) r.charge("/v2/test");
  r.end();
  b.nowMs = () => t;
  b.retryWaitUntil = t + 10_000;
  b.retryWaitRoom = 35;
  b.retryWaitFive = 5;
  const own = b.tryReserve("P2", 1, { label: "list lag recheck", minuteCap: 30 }); // 31: above its own 30, within 35
  assert.ok(!(own instanceof Reservation) && own.why === "class");
  assert.equal(b.takeMinute().retryHold.p2Refused, 0, "its own ceiling refused it, not the hold");
});
