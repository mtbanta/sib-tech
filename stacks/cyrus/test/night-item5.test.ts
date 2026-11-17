// Item 5 of the night build (Michael's request of 2026-11-16, about 8:50 PM): "Fix the 15-in-5-seconds logging gap; close-out retries go ahead
// of stuck retries; measure flatten's request use after the cancel fix." (a) and (b) here; (c) is measured, see the C2 log.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLOSEOUT_FIRST_HOLD_MS, Reservation, RequestBudget } from "../src/request-budget.ts";
import { STUCK_RETRY_MINUTE_CAP } from "../src/risk.ts";

function rig(remaining: () => number) {
  let now = 1_000_000;
  const b = new RequestBudget({ now: () => now, remaining });
  return { b, advance: (ms: number) => (now += ms) };
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

test("night build, item 5 (b): a close-out retry refused for room holds ordinary stuck retries back until it gets in (at most 5.5 s); other work is not held", () => {
  assert.equal(CLOSEOUT_FIRST_HOLD_MS, 5_500);
  let rem = 70;
  const r = rig(() => rem);
  // The close-out retry of 60 does not fit above 20 with 70 left; a stuck retry of 10 would.
  const co = r.b.tryReserve("P1", 60, { label: "close-out retry", fiveSec: false, closeOut: true });
  assert.ok(!(co instanceof Reservation), "the close-out retry waits for room");
  const stuck = r.b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP });
  assert.ok(!(stuck instanceof Reservation) && stuck.why === "class", "the stuck retry gives way");
  assert.equal(r.b.roomFor("P1", 10, true, 0, STUCK_RETRY_MINUTE_CAP).ok, false, "its local room check too");
  const timedOut = r.b.tryReserve("P1", 5, { label: "timed-out stop try", limitRetries: true });
  assert.ok(timedOut instanceof Reservation, "a timed-out stop's try (not an ordinary stuck retry) is not held");
  (timedOut as Reservation).end();
  const p2 = r.b.tryReserve("P2", 3, { label: "list lag recheck" });
  assert.ok(!(p2 instanceof Reservation) && p2.why === "floor", "P2 keeps its own floor of 80, unchanged");
  // Room returns and the close-out retry gets in: the hold ends at once.
  rem = 200;
  const co2 = r.b.tryReserve("P1", 60, { label: "close-out retry", fiveSec: false, closeOut: true });
  assert.ok(co2 instanceof Reservation);
  (co2 as Reservation).end(); // its unused room goes back (it would otherwise fill the stuck retries' 45 until it ends)
  assert.ok(r.b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) instanceof Reservation, "the stuck retry may draw again");
  const m = r.b.takeMinute();
  assert.equal(m.closeOutHolds, 1);
  assert.ok(m.closeOutHeldRetries >= 2);
});

test("night build, item 5 (b): the hold ends by itself 5.5 s after the close-out retry's refusal if it never asks again (room further off than that)", () => {
  const rem = 30;
  const r = rig(() => rem);
  r.b.tryReserve("P1", 60, { label: "close-out retry", fiveSec: false, closeOut: true });
  r.advance(5_000);
  assert.ok(!(r.b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) instanceof Reservation), "still held at 5 s");
  r.advance(600);
  assert.ok(r.b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: STUCK_RETRY_MINUTE_CAP }) instanceof Reservation, "free after 5.5 s");
});

test("night build, item 5 (b): every close-out retry is marked (2:55, mid-day, afternoon, carried)", () => {
  const w = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
  for (const l of ["close-out retry", "mid-day close-out retry", "afternoon close-out retry", "carried-position retry"]) {
    assert.match(w, new RegExp(`closeOut: true, label: "${l}"`), l);
  }
});
