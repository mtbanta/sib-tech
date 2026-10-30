import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEntry, applyOverride, SUGGESTED_LIMITS, type EntryContext } from "../src/limits.ts";

const base: EntryContext = {
  symbol: "AAPL", price: 100, limits: SUGGESTED_LIMITS, stopFlag: false, marketOpen: true, minutesSinceOpen: 60, minutesToClose: 300,
  tradesToday: 0, symbolsTradedToday: new Set(), heldSymbols: new Set(), dayStartEquity: 20000, equity: 20000, grossExposure: 0, priceAgeSeconds: 2,
};
const refused = (over: Partial<EntryContext>, reason: RegExp) => {
  const d = checkEntry({ ...base, ...over });
  assert.equal(d.ok, false);
  assert.match((d as { reason: string }).reason, reason);
};

test("a clean entry sizes to the position limit", () => {
  const d = checkEntry(base);
  assert.deepEqual(d, { ok: true, qty: 10, notional: 1000 });
});

test("stop flag wins over everything, even with approved limits", () => refused({ stopFlag: true }, /stop flag/));
test("no approved limits means no trade", () => refused({ limits: null }, /no limits approved/));
test("stop flag is reported before missing limits", () => refused({ stopFlag: true, limits: null }, /stop flag/));
test("closed market", () => refused({ marketOpen: false }, /closed/));
test("first minutes of the session", () => refused({ minutesSinceOpen: 2 }, /first minutes/));
test("too close to the close", () => refused({ minutesToClose: 30 }, /close/));
test("stale or missing price", () => { refused({ priceAgeSeconds: 600 }, /stale/); refused({ price: 0 }, /stale/); refused({ price: NaN }, /stale/); });
test("daily loss stop, exactly at the limit", () => refused({ equity: 19800 }, /loss stop/));
test("just inside the daily loss stop still trades", () => assert.equal(checkEntry({ ...base, equity: 19801 }).ok, true));
test("trades per day", () => refused({ tradesToday: 10 }, /trades-a-day/));
test("one entry per symbol per day, and no doubling a held symbol", () => {
  refused({ symbolsTradedToday: new Set(["AAPL"]) }, /already traded/);
  refused({ heldSymbols: new Set(["AAPL"]) }, /already holding/);
});

test("borrowing cap 1 limits exposure to equity; cap 2 allows more", () => {
  refused({ grossExposure: 20000 }, /no room/);
  const small = checkEntry({ ...base, grossExposure: 19500 });
  assert.deepEqual(small, { ok: true, qty: 5, notional: 500 });
  refused({ grossExposure: 20000, limits: { ...SUGGESTED_LIMITS, borrowingCap: 1 } }, /no room/);
  assert.equal(checkEntry({ ...base, grossExposure: 20000, limits: { ...SUGGESTED_LIMITS, borrowingCap: 2 } }).ok, true);
});

test("a position limit below one share is refused", () => refused({ price: 1500 }, /smaller than one share/));

test("quantity is always a whole number and never above the limit", () => {
  for (const price of [3.33, 17.77, 99.99, 333.33, 499]) {
    const d = checkEntry({ ...base, price });
    assert.equal(d.ok, true, String(price));
    if (d.ok) {
      assert.ok(Number.isInteger(d.qty) && d.qty >= 1);
      assert.ok(d.notional <= SUGGESTED_LIMITS.maxPositionUsd);
    }
  }
});

test("owner overrides: valid values apply, typos are refused", () => {
  const ok = applyOverride(SUGGESTED_LIMITS, "position", "$1,500", 20000);
  assert.ok("limits" in ok && ok.limits.maxPositionUsd === 1500);
  assert.ok("error" in applyOverride(SUGGESTED_LIMITS, "position", "150000", 20000));
  assert.ok("error" in applyOverride(SUGGESTED_LIMITS, "position", "abc", 20000));
  assert.ok("error" in applyOverride(SUGGESTED_LIMITS, "loss", "9000", 20000));
  assert.ok("error" in applyOverride(SUGGESTED_LIMITS, "trades", "2.5", 20000));
  assert.ok("error" in applyOverride(SUGGESTED_LIMITS, "cap", "3", 20000));
  const cap = applyOverride(SUGGESTED_LIMITS, "cap", "2", 20000);
  assert.ok("limits" in cap && cap.limits.borrowingCap === 2);
  assert.ok("error" in applyOverride(SUGGESTED_LIMITS, "nonsense", "1", 20000));
});
