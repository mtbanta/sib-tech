// Michael's ruling of 2026-11-21 (afternoon): "the off-hours checker refuses from 8:00 AM Central until the open on trading days".
// The window function of tools/offhours-deploy.mjs, on Monday 2026-11-23 (open 8:30 AM CT = 14:30 UTC, close 3:00 PM CT = 21:00 UTC).
import { test } from "node:test";
import assert from "node:assert/strict";
import { offhoursWindowProblems } from "../tools/offhours-window.mjs";

const today = { is_trading_day: true, open_at: "2026-11-23T14:30:00Z", close_at: "2026-11-23T21:00:00Z" };
const at = (iso: string) => new Date(iso);
const closed = (nextOpen: string) => ({ is_open: false, next_open: nextOpen });
const NEXT = "2026-11-23T09:30:00-05:00";

test("8:00 cutoff: 7:59 AM CT passes; 8:00 AM CT and 8:29 are refused by both the day record and Alpaca's clock", () => {
  assert.deepEqual(offhoursWindowProblems(at("2026-11-23T13:59:00Z"), closed(NEXT), today), []);
  for (const iso of ["2026-11-23T14:00:00Z", "2026-11-23T14:29:59Z"]) {
    const p = offhoursWindowProblems(at(iso), closed(NEXT), today);
    assert.equal(p.length, 2, `${iso}: ${p.join("; ")}`);
    assert.match(p[0]!, /8:00 AM Central until the open by the day record/);
    assert.match(p[1]!, /next open is 30 minutes away or less/);
  }
});

test("8:00 cutoff: with no day record, Alpaca's clock alone still refuses (never fails open); with no next open given, refused", () => {
  assert.equal(offhoursWindowProblems(at("2026-11-23T14:10:00Z"), closed(NEXT), null).length, 1);
  assert.deepEqual(offhoursWindowProblems(at("2026-11-23T13:00:00Z"), closed(NEXT), null), []);
  assert.match(offhoursWindowProblems(at("2026-11-23T13:00:00Z"), { is_open: false }, null).join(" "), /no next open time/);
});

test("8:00 cutoff: with the day record alone saying so (a clock whose next open is wrongly far), still refused", () => {
  const p = offhoursWindowProblems(at("2026-11-23T14:10:00Z"), closed("2026-11-24T09:30:00-05:00"), today);
  assert.equal(p.length, 1);
  assert.match(p[0]!, /by the day record/);
});

test("market hours and an open clock are refused as before; after the close and at night it passes; a weekend passes", () => {
  assert.match(offhoursWindowProblems(at("2026-11-23T15:00:00Z"), { is_open: true, next_open: "2026-11-24T09:30:00-05:00" }, today).join(" "), /does not say closed.*market hours/);
  assert.deepEqual(offhoursWindowProblems(at("2026-11-23T21:05:00Z"), closed("2026-11-24T09:30:00-05:00"), today), []);
  assert.deepEqual(offhoursWindowProblems(at("2026-11-24T12:00:00Z"), closed("2026-11-24T09:30:00-05:00"), { ...today, open_at: "2026-11-24T14:30:00Z", close_at: "2026-11-24T21:00:00Z" }), [], "6 AM CT Tuesday");
  assert.deepEqual(offhoursWindowProblems(at("2026-11-21T18:00:00Z"), closed(NEXT), { is_trading_day: false, open_at: null, close_at: null }), [], "Saturday");
  assert.match(offhoursWindowProblems(at("2026-11-21T18:00:00Z"), null, null).join(" "), /does not say closed/);
});
