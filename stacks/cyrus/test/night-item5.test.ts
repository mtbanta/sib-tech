// Item 5 of the night build (Michael's request of 2026-11-16, about 8:50 PM): "Fix the 15-in-5-seconds logging gap; close-out retries go ahead
// of stuck retries; measure flatten's request use after the cancel fix." (a) and (b) here; (c) is measured, see the C2 log.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLOSEOUT_HOLD, CLOSEOUT_FIRST_HOLD_MS, CLOSEOUT_HOLD_TOTAL_MS, CLOSEOUT_SPELL_GAP_MS, Reservation, RequestBudget } from "../src/request-budget.ts";
import { STUCK_RETRY_MINUTE_CAP } from "../src/risk.ts";

function rig(remaining: () => number) {
  let now = 1_000_000;
  const b = new RequestBudget({ now: () => now, remaining });
  return { b, advance: (ms: number) => (now += ms), at: () => now };
}

test("night build, item 5 (a): mostUrgentCappedIn5s counts only urgent sends from tries that reserve against the 5 seconds (logging only)", () => {
  const r = rig(() => 200);
  const p1 = r.b.tryReserve("P1", 5, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) as Reservation;
  const p2 = r.b.tryReserve("P2", 4, { label: "list lag recheck" }) as Reservation;
  const co = r.b.tryReserve("P1", 9, { label: "close-out retry", fiveSec: false, closeOut: true }) as Reservation;
  for (const res of [p1, p2, co]) assert.ok(res instanceof Reservation);
  for (let i = 0; i < 4; i++) r.b.recordSend(p1, "/v2/orders");
  for (let i = 0; i < 3; i++) r.b.recordSend(p2, "/v2/orders");
  for (let i = 0; i < 9; i++) r.b.recordSend(co, "/v2/orders");
  const m = r.b.takeMinute();
  assert.equal(m.mostUrgentCappedIn5s, 4, "the urgent capped try's 4, not P2's 3 nor the close-out retry's 9");
  assert.equal(m.mostCappedIn5s, 7, "P1 and P2 capped together, as before");
});

// Item 5 (b) ships switched off (CLOSEOUT_HOLD; night build, after group 1 round 1, under Michael's pre-approved split). The tests of the
// narrowed design below run with it switched on; the off tests set it off themselves and put it back.
before(() => {
  CLOSEOUT_HOLD.on = true;
});
after(() => {
  CLOSEOUT_HOLD.on = false;
});
function holdOff<T>(fn: () => T): T {
  CLOSEOUT_HOLD.on = false;
  try {
    return fn();
  } finally {
    CLOSEOUT_HOLD.on = true;
  }
}

test("item 5 (b) switched off as shipped", () => {
  assert.equal(holdOff(() => CLOSEOUT_HOLD.on), false);
});

test("item 5 (b) off: where the hold would engage (the stuck retries' use keeps a close-out retry out), the stuck retry is granted at once, as on v24", () =>
  holdOff(() => {
    const r = rig(() => 200);
    stuckSent(r, 20);
    const co = r.b.tryReserve("P1", 45, { label: "close-out retry", fiveSec: false, closeOut: true });
    assert.ok(!(co instanceof Reservation) && co.why === "minute", "the close-out retry is refused, as on v24");
    for (let i = 0; i < 3; i++) {
      r.advance(5_000);
      assert.ok(!(r.b.tryReserve("P1", 45, { label: "close-out retry", fiveSec: false, closeOut: true }) instanceof Reservation));
    }
    const s = stuckTry(r);
    assert.ok(s instanceof Reservation, "the stuck retry is granted at once");
    const m = r.b.takeMinute();
    assert.equal(m.closeOutHolds, 0);
    assert.equal(m.closeOutHeldRetries, 0);
  }));

// Group 1, night build round 1 (finding 2): the hold is set only when the ordinary stuck retries' own use is what keeps the close-out retry
// out, and lasts at most 10 s in all in one waiting spell. `stuckSent(k)`: ordinary stuck retries sent k requests 30 to about 20 s ago, in
// tries of at most 10 spaced 6 s apart (each within the 15 in 5 seconds).
function stuckSent(r: ReturnType<typeof rig>, k: number) {
  const back = 30_000;
  r.advance(-back);
  let moved = 0;
  for (let left = k; left > 0; left -= 10) {
    const n = Math.min(10, left);
    const s = r.b.tryReserve("P1", n, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) as Reservation;
    assert.ok(s instanceof Reservation, "the earlier stuck retry was granted");
    for (let i = 0; i < n; i++) r.b.recordSend(s, "/v2/orders");
    s.end();
    r.advance(6_000);
    moved += 6_000;
  }
  r.advance(back - moved);
}
const stuckTry = (r: ReturnType<typeof rig>) => r.b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });

test("night build, item 5 (b): a close-out retry kept out by the stuck retries' own use holds them back until it gets in (at most 5.5 s a refusal); other work is not held", () => {
  assert.deepEqual([CLOSEOUT_FIRST_HOLD_MS, CLOSEOUT_HOLD_TOTAL_MS, CLOSEOUT_SPELL_GAP_MS], [5_500, 10_000, 15_000]);
  const r = rig(() => 200);
  stuckSent(r, 20);
  // 20 + 45 passes the minute's 60; without the stuck retries' 20 it would fit.
  const co = r.b.tryReserve("P1", 45, { label: "close-out retry", fiveSec: false, closeOut: true });
  assert.ok(!(co instanceof Reservation) && co.why === "minute", "the close-out retry waits for room");
  const stuck = stuckTry(r);
  assert.ok(!(stuck instanceof Reservation) && stuck.why === "class", "the stuck retry gives way");
  assert.equal(r.b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP).ok, false, "its local room check too");
  const timedOut = r.b.tryReserve("P1", 5, { label: "timed-out stop try", limitRetries: true });
  assert.ok(timedOut instanceof Reservation, "a timed-out stop's try (not an ordinary stuck retry) is not held");
  (timedOut as Reservation).end();
  const p2 = r.b.tryReserve("P2", 3, { label: "list lag recheck" });
  assert.ok(p2 instanceof Reservation, "P2 is not held by it");
  (p2 as Reservation).end();
  // A smaller close-out retry fits and gets in: the hold ends at once.
  const co2 = r.b.tryReserve("P1", 30, { label: "close-out retry", fiveSec: false, closeOut: true });
  assert.ok(co2 instanceof Reservation);
  (co2 as Reservation).end();
  assert.ok(stuckTry(r) instanceof Reservation, "the stuck retry may draw again");
  const m = r.b.takeMinute();
  assert.equal(m.closeOutHolds, 1);
  assert.ok(m.closeOutHeldRetries >= 2);
});

test("night build, item 5 (b): no hold when the stuck retries' use is not what keeps the close-out retry out (Alpaca's remaining below its floor, or other work filling the minute)", () => {
  // The floor: 70 left, a close-out retry of 60 would leave 10, under 20. Holding the stuck retries would not let it in.
  const low = rig(() => 70);
  assert.ok(!(low.b.tryReserve("P1", 60, { label: "close-out retry", fiveSec: false, closeOut: true }) instanceof Reservation));
  assert.ok(stuckTry(low) instanceof Reservation, "the stuck retry is not held");
  // Other work: P2 sent 3 in the minute and the close-out retry is estimated at 60 (the reviewer's probe, one P2 read every 20 s).
  const p2 = rig(() => 200);
  for (let i = 0; i < 3; i++) {
    const x = p2.b.tryReserve("P2", 1, { label: "list lag recheck" }) as Reservation;
    p2.b.recordSend(x, "/v2/orders");
    x.end();
    p2.advance(1_000);
  }
  assert.ok(!(p2.b.tryReserve("P1", 60, { label: "carried-position retry", fiveSec: false, closeOut: true }) instanceof Reservation));
  assert.ok(stuckTry(p2) instanceof Reservation, "the stuck retry is not held (v24 granted it at once)");
  assert.equal(p2.b.takeMinute().closeOutHolds, 0);
});

test("night build, item 5 (b): the hold ends by itself 5.5 s after the close-out retry's refusal if it never asks again (room further off than that)", () => {
  const r = rig(() => 200);
  stuckSent(r, 20);
  r.b.tryReserve("P1", 45, { label: "close-out retry", fiveSec: false, closeOut: true });
  r.advance(5_000);
  assert.ok(!(stuckTry(r) instanceof Reservation), "still held at 5 s");
  r.advance(600);
  assert.ok(stuckTry(r) instanceof Reservation, "free after 5.5 s");
});

test("night build, item 5 (b): the hold lasts at most 10 s in all in one waiting spell however often the close-out retry is refused; a new spell starts only after it stops asking for 15 s", () => {
  const r = rig(() => 200);
  stuckSent(r, 20);
  const t0 = r.at();
  const ask = () => r.b.tryReserve("P1", 45, { label: "close-out retry", fiveSec: false, closeOut: true });
  // The close-out retry asks every 5 s (refused each time: the stuck retries' 20 stay in the minute until 30 and 36 s from now); a stuck retry asks
  // every 0.5 s. When is it first granted?
  let granted: number | null = null;
  for (let t = 0; t <= 25_000 && granted === null; t += 500) {
    r.advance(t0 + t - r.at());
    if (t % 5_000 === 0) assert.ok(!(ask() instanceof Reservation), `the close-out retry refused at ${t} ms`);
    const s = stuckTry(r);
    if (s instanceof Reservation) {
      granted = t;
      s.end();
    }
  }
  assert.equal(granted, CLOSEOUT_HOLD_TOTAL_MS, "held exactly 10 s, then granted although the close-out retry is still refused");
  // The spell goes on while the close-out retry keeps asking: no new hold.
  for (let t = 15_000; t <= 25_000; t += 5_000) {
    r.advance(t0 + t - r.at());
    assert.ok(!(ask() instanceof Reservation));
    const s = stuckTry(r);
    assert.ok(s instanceof Reservation, `not held again at ${t} ms`);
    (s as Reservation).end();
  }
  // It stops asking for 15 s; its next refusal starts a new spell and a new hold. (The stuck retries' 20 had left the minute by 36 s, so 20
  // more are sent first to keep the close-out retry out by their use.)
  r.advance(t0 + 40_000 - r.at());
  stuckSent(r, 20);
  assert.ok(!(ask() instanceof Reservation));
  assert.ok(!(stuckTry(r) instanceof Reservation), "held again in the new spell");
});

// The reviewer's probe `hold-warm.mts` as a test: P2 sends one request every `p2Gap` ms from t = 0; from 60 s a close-out retry that cannot
// fit (estimate `est`) asks every 5 s, and an ordinary stuck retry of 10 asks every 5 s. v24 granted the stuck retry at 0, 0 and 10 s;
// before this fix the night build never granted it in 300 s.
for (const [est, p2Gap, v24] of [[60, 20_000, 0], [40, 2_000, 0], [30, 1_500, 10_000]] as const) {
  test(`night build, item 5 (b): the reviewer's warm-minute probe (estimate ${est}, P2 every ${p2Gap} ms): the stuck retry is granted no later than on v24 (${v24 / 1000} s) while the close-out retry keeps asking`, () => {
    const r = rig(() => 150);
    const t0 = r.at();
    let co: number | null = null;
    let st: number | null = null;
    for (let t = 0; t <= 360_000; t += 500) {
      r.advance(t0 + t - r.at());
      if (t % p2Gap === 0) {
        const x = r.b.tryReserve("P2", 1, { label: "recheck" });
        if (x instanceof Reservation) {
          r.b.recordSend(x, "/v2/orders");
          x.end();
        }
      }
      if (t < 60_000 || t % 5_000 !== 0) continue;
      if (co === null) {
        const x = r.b.tryReserve("P1", est, { fiveSec: false, closeOut: true, label: "carried-position retry" });
        if (x instanceof Reservation) {
          co = t - 60_000;
          for (let i = 0; i < est; i++) r.b.recordSend(x, "/v2/orders");
          x.end();
        }
      }
      if (st === null) {
        const x = stuckTry(r);
        if (x instanceof Reservation) {
          st = t - 60_000;
          x.end();
        }
      }
    }
    assert.ok(st !== null && st <= v24, `stuck retry granted at ${st} ms (v24 ${v24})`);
    assert.equal(co, null, "the close-out retry never fits here (as on v24)");
  });
}

test("night build, item 5 (b): every close-out retry is marked (2:55, mid-day, afternoon, carried)", () => {
  const w = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
  for (const l of ["close-out retry", "mid-day close-out retry", "afternoon close-out retry", "carried-position retry"]) {
    assert.match(w, new RegExp(`closeOut: true, label: "${l}"`), l);
  }
});
