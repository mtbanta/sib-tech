// Round 7 changes. Each test was checked to fail with its change taken out (recorded in builds/build-c2-log.md).
//   A. Review round 6's blocking finding: a start-up check that keeps failing must never leave the stack trading while
//      Michael's commands go unread.
//   B. Michael's ruling of 2026-11-03: the daily loss stop is checked every 10 seconds (it was 30), a slow pass does not
//      hold it back, a check that hangs never piles up, and it does not wait for the request budget the governor keeps
//      for entries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTROL_STOP, MemoryStore, type StopFlag, type Store } from "../src/store.ts";
import { FakeBroker } from "./helpers.ts";
import { D, rig, settle, z } from "./rig.ts";

const never = <T>() => new Promise<T>(() => undefined);
const AAA = { symbol: "AAA", qty: 20, marketValue: 1000, avgEntryPrice: 50, unrealizedPl: 0 };
const stopIn = async (s: Store) => (await s.getControl<StopFlag>(CONTROL_STOP))?.on === true;
const plus = (t: string, seconds: number) => new Date(z(t).getTime() + seconds * 1000).toISOString();

// A worker on a day Michael approved (loss stop 200 dollars), armed at 14:25 UTC (9:25 New York), holding 20 AAA that it
// entered. Same setup as round6.test.ts.
async function armedRig(opts: { store?: MemoryStore; broker?: FakeBroker } = {}) {
  const r = rig<FakeBroker, MemoryStore>(opts);
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("loss 200\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("14:25:00");
  assert.ok((await r.store.getDay(D))!.phases.armed, "armed");
  await r.store.insertOrder({ clientOrderId: "cyrus-20261102-AAA-1", tradeDate: D, symbol: "AAA", qty: 20, referencePrice: 50, stopPrice: 49, status: "filled", alpacaOrderId: "x", filledQty: 20, filledAvgPrice: 50, note: null, createdAt: "2026-11-02T14:40:00.000Z" });
  r.broker.positions = [{ ...AAA }];
  return r;
}

// ---------- A. a failing start-up check never leaves the stack trading with commands unread ----------
// The round 6 reviewer's reproduction: an armed day, a restart in the session with only the start-up check's query failing,
// Michael posts `stop`, then prices arrive. At b764741 the stream started and an entry was sent after the unread `stop`.
test("a start-up check that keeps failing after a restart in the session: no live prices, no entry, and the stop is read once it works", async () => {
  const r1 = await armedRig();
  await r1.at("14:50:00");
  r1.worker.stop();
  const store = r1.store;
  const realDaysFrom = store.daysFrom.bind(store);
  let failing = true;
  store.daysFrom = async (d: string) => {
    if (failing) throw new Error("start-up query failed (test)");
    return realDaysFrom(d);
  };
  // The same Discord channel before and after the restart (the saved command cursor points into it).
  const r2 = rig<FakeBroker, MemoryStore>({ store, broker: r1.broker, bot: r1.bot });
  await r2.at("14:55:00");
  r2.ownerSays("stop", "14:55:01");
  await r2.at("14:55:05");
  await r2.at("14:55:10");
  await r2.at("14:55:40");
  assert.equal(r2.counts().streamStarts, 0, "no live prices while commands cannot be read");
  await r2.ramp("BBB", [...Array(12).fill(50), 50.4], "14:56:00");
  assert.equal(r2.broker.count("submitEntry"), 0, "no entry");
  assert.equal(await stopIn(store), false, "the stop has not been read yet (the start-up check still fails)");
  assert.ok(r2.said("alerts").some((t) => t.includes("start-up check") && t.includes("place no entries")), "Michael is told that nothing trades until it works");

  // The database is back: the start-up check works, the `stop` is read in the same pass, before live prices start.
  failing = false;
  await r2.at("14:57:00");
  await settle();
  assert.equal(await stopIn(store), true, "the stop is read as soon as the check works");
  await r2.ramp("BBB", [...Array(12).fill(50), 50.4], "14:57:05");
  assert.equal(r2.broker.count("submitEntry"), 0, "and still no entry: the stop holds");
});

// The same restart without the failure trades normally, so the test above is not passing for some other reason.
test("control: the same restart with a working start-up check starts live prices and can enter", async () => {
  const r1 = await armedRig();
  await r1.at("14:50:00");
  r1.worker.stop();
  const r2 = rig<FakeBroker, MemoryStore>({ store: r1.store, broker: r1.broker, bot: r1.bot });
  await r2.at("14:55:00");
  await r2.at("14:55:05");
  assert.equal(r2.counts().streamStarts, 1, "live prices start");
  await r2.ramp("BBB", [...Array(12).fill(50), 50.4], "14:56:00");
  assert.ok(r2.broker.count("submitEntry") >= 1, "an entry goes out");
});

// ---------- B. the daily loss stop every 10 seconds ----------
test("the daily loss stop is checked every 10 seconds: a loss just after one check is caught by the next, 10 seconds later", async () => {
  const r = await armedRig();
  await r.at("14:50:00"); // a check runs here (the first of the session)
  r.broker.account = { ...r.broker.account, equity: 19500 }; // down 500 against a 200 loss stop, just after the check
  await r.at("14:50:05");
  assert.equal(await stopIn(r.store), false, "5 seconds later: not yet (every second pass)");
  await r.at("14:50:10");
  await settle();
  assert.equal(await stopIn(r.store), true, "10 seconds later: fired");
  assert.ok(r.said("commands").some((t) => t.includes("Daily loss stop reached")), "and said so");
});

test("a slow pass does not hold the daily loss stop back: it still runs every 10 seconds, long before the 60 second watchdog", { timeout: 10_000 }, async () => {
  const r = await armedRig();
  await r.at("14:50:00");
  r.store.getDay = () => never(); // the next pass hangs on the database (in production: bounded, but up to about 30 s; or a Discord 429 storm)
  r.setNow("14:50:05");
  void r.worker.tick();
  await settle();
  r.broker.account = { ...r.broker.account, equity: 19500 };
  await r.at("14:50:10"); // the pass started at 14:50:05 is still running
  await settle();
  assert.equal(await stopIn(r.store), true, "fired 5 seconds into the slow pass, from the day record held in memory");
  assert.ok(!r.said("alerts").some((t) => t.includes("main loop is stuck")), "the watchdog had not acted yet");
});

test("a loss stop check that hangs is never started twice: later 10 second slots are skipped, not queued", { timeout: 10_000 }, async () => {
  const r = await armedRig();
  await r.at("14:50:00");
  let accountCalls = 0;
  r.broker.getAccount = () => {
    accountCalls++;
    return never();
  };
  // 14:50:05: the pass's view refresh asks for the account and hangs (1 call). 14:50:10: the loss stop's slot comes round
  // during the hung pass and asks once (2 calls). Every slot after that, for more than a minute, finds it still running.
  r.setNow("14:50:05");
  void r.worker.tick();
  await settle();
  for (let s = 10; s <= 95; s += 5) await r.at(plus("14:50:00", s));
  assert.equal(accountCalls, 2, "one hung view refresh and one hung loss stop check, nothing piled up behind them");
});

test("the daily loss stop does not wait for the request budget: it runs while the governor holds entries back for the safety reserve", async () => {
  const r = await armedRig();
  await r.at("14:50:00");
  // Alpaca says 5 requests are left in the minute: entries and the view refresh must wait (they stop at the reserve of 80).
  r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: 5, reset: null });
  r.broker.account = { ...r.broker.account, equity: 19500 };
  await r.at("14:50:05");
  await r.at("14:50:10");
  await settle();
  assert.equal(r.governor.canSpend(), false, "the budget is still inside the safety reserve");
  assert.equal(await stopIn(r.store), true, "the loss stop read the account and fired anyway");
});
