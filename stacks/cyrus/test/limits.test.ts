import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEntry, applyOverride, loosened, normalizeLimits, MAX_TRADES_PER_MINUTE, SUGGESTED_LIMITS, type EntryContext } from "../src/limits.ts";

const base: EntryContext = {
  symbol: "AAPL", price: 100, limits: SUGGESTED_LIMITS, stopFlag: false, marketOpen: true, minutesSinceOpen: 60, minutesToClose: 300,
  tradesLastMinute: 0, heldSymbols: new Set(), dayStartEquity: 20000, equity: 20000, grossExposure: 0, priceAgeSeconds: 2,
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
test("trades a minute: refused at the cap, and the fixed ceiling holds even above a stored value", () => {
  refused({ tradesLastMinute: 20 }, /trades-per-minute/);
  assert.equal(checkEntry({ ...base, tradesLastMinute: 19 }).ok, true);
  refused({ tradesLastMinute: 100, limits: { ...SUGGESTED_LIMITS, maxTradesPerMinute: 5000 } }, /trades-per-minute/);
});
test("there is no daily total: thousands of trades in a day are fine if no minute is over the cap", () => {
  assert.equal(checkEntry({ ...base, tradesLastMinute: 3 }).ok, true);
});
test("no doubling a held symbol", () => {
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

test("trades a minute: 1 to the fixed ceiling of 100, nothing else", () => {
  assert.equal(MAX_TRADES_PER_MINUTE, 100);
  const ok = applyOverride(SUGGESTED_LIMITS, "trades", "100", 20000);
  assert.ok("limits" in ok && ok.limits.maxTradesPerMinute === 100);
  const bad = applyOverride(SUGGESTED_LIMITS, "trades", "101", 20000);
  assert.ok("error" in bad && /fixed ceiling/.test(bad.error));
  assert.ok("error" in applyOverride(SUGGESTED_LIMITS, "trades", "0", 20000));
  assert.ok("error" in applyOverride(SUGGESTED_LIMITS, "trades", "200", 20000));
});

test("old records are read safely: a daily trade count is not mistaken for a per-minute cap", () => {
  const old = normalizeLimits({ maxPositionUsd: 2000, dailyLossStopUsd: 500, maxTradesPerDay: 100, borrowingCap: 1 });
  assert.equal(old.tradesPerMinuteMissing, true);
  assert.equal(old.limits.maxTradesPerMinute, SUGGESTED_LIMITS.maxTradesPerMinute);
  assert.equal(old.limits.maxPositionUsd, 2000);
  const fresh = normalizeLimits({ ...SUGGESTED_LIMITS, maxTradesPerMinute: 7 });
  assert.equal(fresh.tradesPerMinuteMissing, false);
  // Michael's ruling of 2026-11-06: a stored value is clamped to the load-day ceiling (150) when read; the ceiling in force (100 on a
  // normal day) is applied where entries are checked (limits.test.ts, "the ceiling in force").
  assert.equal(normalizeLimits({ ...SUGGESTED_LIMITS, maxTradesPerMinute: 9999 }).limits.maxTradesPerMinute, 150, "clamped to the load-day ceiling when read");
  assert.equal(normalizeLimits(null).limits.borrowingCap, 1);
});

test("loosened: only a bigger value is looser", () => {
  const l = SUGGESTED_LIMITS;
  assert.deepEqual(loosened(l, l), []);
  assert.deepEqual(loosened(l, { ...l, maxPositionUsd: 500, dailyLossStopUsd: 100, maxTradesPerMinute: 5 }), []);
  assert.deepEqual(loosened(l, { ...l, maxPositionUsd: 2000, maxTradesPerMinute: 30, borrowingCap: 2, dailyLossStopUsd: 300 }), ["position", "loss", "trades", "cap"]);
});
