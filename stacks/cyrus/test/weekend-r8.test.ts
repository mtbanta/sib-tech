// The worker's real 5 second pass and the rechecks a sync asks for: Michael's fix (a) of 2026-11-13 (the pass cancels a recheck's own timer
// when its sync runs that recheck), and the fix (a) round 1 and 2 cases (the regular branch, a failed pass sync puts the time back).
// The redesign of 2026-11-14 (part 1): the list-lag recheck has its own timer (worker.ts `armLagRecheck`) and is charged at what it sends,
// so these tests use a stuck sale's retry (a remainder whose fresh stop and market sale Alpaca refuses) as the recheck on the shared timer;
// the list-lag recheck's own timer is tested in release-2026-11-12-night.test.ts. The tests of the retired charge and give-back (group 1's
// round 8 B1 and fix (a) round 1 B1 probes) went with that mechanism: nothing is charged ahead now, so no sync can run uncharged.
// The simulated day is 2026-11-02: the open is 14:30 UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, D } from "./rig.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { FakeBot } from "./helpers.ts";

async function armedDay(orderStream = false) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, bot, orderStream });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  return { sim, r };
}

const iso = (ms: number) => new Date(ms).toISOString();

// A remainder whose fresh stop and market sale Alpaca refuses: a stuck sale, retried 5, 10, 20, then every 30 s, each retry a recheck the
// sync asks for on the worker's shared timer (its own timer, fix (a)).
async function stuckReported(orderStream = false) {
  const { sim, r } = await armedDay(orderStream);
  const wk: any = r.worker;
  const mem = wk.syncMemory;
  const id = clientOrderIdFor(D, "GE", 1);
  await sim.submitEntry({ symbol: "GE", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  sim.fillEntry(id, 12);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "GE", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  await r.at("14:30:10");
  const t0 = sim.simMs + 100;
  r.setNow(iso(t0));
  sim.refuseStops = true;
  sim.refuseSellIf = (x: any) => x.symbol === "GE";
  sim.partialTakeProfit(id, 1, 12.08);
  wk.syncAt(t0, 0);
  r.setNow(iso(t0 + 1));
  await settle();
  await settle();
  await settle();
  const starts: Array<{ at: number; fromPass: boolean }> = [];
  const real = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any, how: any = {}) => {
    if (!wk.inflight.has("risk")) starts.push({ at: sim.simMs, fromPass: how.fromPass === true });
    return real(d, c, how);
  };
  const due1 = wk.syncRecheckAt as number;
  assert.ok(due1 !== null && mem.stuck.get(id)?.nextAt === due1, "the stuck sale's retry is the recheck the sync asked for");
  return { sim, r, wk, mem, due1, starts, t0, id };
}

test("Michael's fix (a) of 2026-11-13: through the worker's real pass, a due recheck run by the pass inside its timer's slack cancels that timer, so no second sync repeats it; the next recheck runs at its own time", async () => {
  const { r, wk, due1, starts } = await stuckReported();
  assert.ok(r.timers().includes(due1 + 250), "its own timer is pending (250 ms slack)");
  await r.at(iso(due1 + 100)); // the real 5 second pass, 100 ms after the recheck was due
  await settle();
  assert.equal(starts.length, 1);
  assert.ok(starts[0]!.fromPass, "the pass ran the recheck");
  assert.ok(!r.timers().includes(due1 + 250), "and cancelled the recheck's own timer");
  r.setNow(iso(due1 + 260));
  await settle();
  await settle();
  assert.equal(starts.length, 1, "no second sync repeats the recheck");
  const due2 = wk.syncRecheckAt;
  assert.ok(due2 !== null && due2 > due1);
  r.setNow(iso(due2 + 260)); // the next recheck's own timer
  await settle();
  await settle();
  assert.equal(starts.length, 2, "the next recheck ran at its own time");
  wk.stop?.();
});

test("Michael's fix (a): a recheck's own timer that was put off while a sync ran is still its own; the pass that runs the recheck cancels it", async () => {
  const { r, wk, due1, starts } = await stuckReported();
  wk.inflight.add("risk"); // a sync is running when the recheck's timer fires
  r.setNow(iso(due1 + 260));
  await settle();
  assert.equal(starts.length, 0, "put off");
  const putOffAt = wk.eventSyncAt;
  assert.ok(putOffAt !== null && wk.recheckTimerAt === putOffAt, "the put-off timer is still the recheck's own");
  wk.inflight.delete("risk");
  await r.at(iso(due1 + 300)); // the pass runs the recheck before the put-off timer fires
  await settle();
  assert.equal(starts.length, 1);
  assert.ok(starts[0]!.fromPass);
  r.setNow(iso(putOffAt + 600));
  await settle();
  await settle();
  assert.equal(starts.length, 1, "the put-off timer was cancelled: no second sync");
  wk.stop?.();
});

test("Michael's fix (a): the pass cancels only the recheck's own timer; a live update's timer (here put off while a sync ran) still fires", async () => {
  const { r, wk, due1, starts } = await stuckReported();
  wk.inflight.add("risk");
  r.setNow(iso(due1 - 200));
  wk.syncAt(due1 - 200, 0); // a live update: earlier than the recheck's timer, so it replaces it
  assert.equal(wk.recheckTimerAt, null, "the replaced timer's mark goes with it");
  r.setNow(iso(due1 - 199)); // it fires while a sync runs: put off
  await settle();
  const liveAt = wk.eventSyncAt;
  assert.ok(liveAt !== null && r.timers().some((x: number) => x > due1 + 10), "put off past the pass below");
  wk.inflight.delete("risk");
  await r.at(iso(due1 + 10)); // the pass runs the due recheck
  await settle();
  assert.equal(starts.length, 1);
  assert.ok(r.timers().length > 0 && wk.eventSyncAt !== null, "the live update's timer is left pending");
  r.setNow(iso(liveAt + 600));
  await settle();
  await settle();
  assert.equal(starts.length, 2, "and it fires");
  wk.stop?.();
});

// ---------------- Fix (a), round 1 ----------------
// Group 2: a slow sync (the next pass 10 s or more after it started) makes the pass take its regular branch 100 ms before the recheck is
// due. That sync takes the recheck's place, so it cancels the recheck's own timer: no leftover sync runs after it, charged or not.
test("fix (a), round 1 (group 2): on the pass's regular branch before the recheck is due, the pass cancels the recheck's own timer; that sync asks again, and the recheck runs once, at its time", async () => {
  const { r, wk, due1, starts } = await stuckReported();
  wk.lastSync = due1 - 11_000; // a slow sync: the next pass takes its regular branch before the recheck is due
  await r.at(iso(due1 - 100));
  await settle();
  assert.equal(starts.length, 1);
  assert.ok(starts[0]!.fromPass);
  r.setNow(iso(due1 + 260));
  await settle();
  await settle();
  r.setNow(iso(due1 + 600));
  await settle();
  await settle();
  assert.equal(starts.filter((x) => x.at >= due1 && x.at < due1 + 1_000).length, 1, `the recheck ran once at its time: ${starts.map((x) => x.at - due1).join(", ")}`);
  wk.stop?.();
});

test("fix (a), round 1: while a sync is still running, the pass's regular branch starts nothing and cancels nothing", async () => {
  const { r, wk, due1, starts } = await stuckReported();
  const own = wk.eventSyncAt;
  assert.equal(wk.recheckTimerAt, own);
  wk.inflight.add("risk");
  wk.lastSync = due1 - 11_000;
  await r.at(iso(due1 - 100));
  assert.equal(starts.length, 0, "no sync started");
  assert.equal(wk.eventSyncAt, own, "the recheck's own timer is still pending");
  wk.inflight.delete("risk");
  wk.stop?.();
});

test("fix (a), round 1 (group 2's note): a timer replaced by an earlier one drops the recheck's own mark it carried", async () => {
  const { r, wk, due1 } = await stuckReported();
  assert.equal(wk.recheckTimerAt, wk.eventSyncAt, "the pending timer is the recheck's own");
  r.setNow(iso(due1 - 300));
  wk.syncAt(due1 - 300, 0);
  assert.equal(wk.recheckTimerAt, null);
  wk.stop?.();
});


test("fix (a), round 2 (group 2): a live update's timer that kept its place at a sync's end is not the recheck's own; the regular pass leaves it to fire", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const mem = wk.syncMemory;
  void mem;
  const id = clientOrderIdFor(D, "GE", 1);
  await sim.submitEntry({ symbol: "GE", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  sim.fillEntry(id, 12);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "GE", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  await r.at("14:30:10");
  const t0 = sim.simMs + 100;
  r.setNow(iso(t0));
  sim.refuseStops = true;
  sim.refuseSellIf = (x: any) => x.symbol === "GE";
  sim.partialTakeProfit(id, 1, 12.08); // a stuck sale: its retry is the recheck the sync asks for
  let inject = true;
  const realList = (sim as any).listOrdersPaged.bind(sim);
  (sim as any).listOrdersPaged = async (...a: any[]) => {
    if (inject && wk.inflight.has("risk")) {
      inject = false;
      wk.syncAt(t0 + 50, 0); // a live update while the report's sync runs
    }
    return realList(...a);
  };
  const starts: string[] = [];
  const real = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any, how: any = {}) => {
    if (!wk.inflight.has("risk")) starts.push(`${how.fromPass ? "pass" : "timer"}@+${sim.simMs - t0}`);
    return real(d, c, how);
  };
  wk.syncAt(t0, 0);
  r.setNow(iso(t0 + 1));
  await settle();
  await settle();
  assert.equal(wk.eventSyncAt, t0 + 50, "the live update's timer kept its place");
  assert.ok(wk.syncRecheckAt > t0 + 50, "the recheck asked for is later");
  assert.notEqual(wk.recheckTimerAt, t0 + 50, "and the live update's timer is not marked as the recheck's own");
  wk.lastSync = sim.simMs - 11_000; // a slow sync: the next pass takes its regular branch
  await r.at(iso(t0 + 20));
  await settle();
  r.setNow(iso(t0 + 60));
  await settle();
  await settle();
  assert.ok(starts.some((x) => x.startsWith("timer@+")), `the live update's timer fired: ${starts.join(" | ")}`);
  wk.stop?.();
});

// ---------------- Fix (a), round 2 (group 1): the pass's sync fails after the pass cancelled a recheck's own timer ----------------
// Group 1's probes Q5 and Q6, kept as tests: the cancelled time is put back once, so a stuck sale's retry and a lost-exits follow-up still
// run at their times (before this fix, the retry came 5.75 to 9.85 s late and the follow-up's remaining tries were dropped).
async function driveTo(r: any, sim: SimBroker, nextPass: number, end: number) {
  for (let g = 0; g < 4000; g++) {
    const tAll = Math.min(...r.timers(), Infinity);
    if (tAll <= sim.simMs) {
      r.setNow(iso(sim.simMs));
      await settle();
      await settle();
      continue;
    }
    const next = Math.min(nextPass, tAll);
    if (next > end) break;
    if (next === nextPass) {
      await r.at(iso(next));
      nextPass += 5_000;
    } else r.setNow(iso(next));
    await settle();
    await settle();
  }
}

test("fix (a), round 2 (group 1): when the pass's sync fails (the order list read throws), the cancelled recheck is put back, so a stuck sale's retry still runs at its time, on either branch", async () => {
  const rows: string[] = [];
  for (const off of [-4_000, -300, 100]) {
    const { sim, r } = await armedDay(true);
    const wk: any = r.worker;
    const mem = wk.syncMemory;
    const id = clientOrderIdFor(D, "GE", 1);
    await sim.submitEntry({ symbol: "GE", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "GE", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
    await r.at("14:30:10");
    const t0 = sim.simMs + 100;
    r.setNow(iso(t0));
    const sells: number[] = [];
    sim.refuseStops = true;
    sim.refuseSellIf = (s: any) => {
      if (s.symbol === "GE") {
        sells.push(sim.simMs - t0);
        return true;
      }
      return false;
    };
    sim.partialTakeProfit(id, 1, 12.08); // a remainder whose fresh stop and sale Alpaca refuses: a stuck sale
    wk.syncAt(t0, 0);
    r.setNow(iso(t0 + 1));
    await settle();
    await settle();
    await settle();
    const due = mem.stuck.get(id)?.nextAt ?? wk.syncRecheckAt;
    const P = due + off;
    if (off < 0) wk.lastSync = P - 10_000; // a slow sync: the pass takes its regular branch
    let armed = true;
    const realList = (sim as any).listOrdersPaged.bind(sim);
    (sim as any).listOrdersPaged = async (...a: any[]) => {
      if (armed && sim.simMs >= P) {
        armed = false;
        throw new Error("order list read failed (test)");
      }
      return realList(...a);
    };
    await driveTo(r, sim, P, t0 + 40_000);
    wk.stop?.();
    const retry = sells.filter((x) => x > 5_000)[0];
    rows.push(`pass ${off} ms from due: retry due +${due - t0}, ran +${retry}`);
    assert.equal(armed, false, "the pass's sync failed");
    assert.ok(retry !== undefined && retry - (due - t0) >= 250 && retry - (due - t0) <= 350, rows[rows.length - 1]!); // the timer's 250 ms slack kept
  }
  console.log("MEASURE failed pass sync\n" + rows.join("\n"));
});

test("fix (a), round 2 (group 1): when the pass's regular sync fails, a lost-exits follow-up keeps its tries (0.5, 1 and 2 s apart)", async () => {
  const { sim, r } = await armedDay(true);
  const wk: any = r.worker;
  const mem = wk.syncMemory;
  const mk = async (s: string, n: number) => {
    const id = clientOrderIdFor(D, s, n);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: s, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
    return id;
  };
  const a = await mk("LUNR", 1);
  const b = await mk("AAPL", 2);
  await r.at("14:30:10");
  const t0 = sim.simMs + 100;
  r.setNow(iso(t0));
  // A stuck sale for LUNR (its fresh stop and market sale refused): its retry is the recheck the sync asks for (since the redesign of
  // 2026-11-14 a list-lag recheck has its own timer, so it no longer serves here).
  sim.refuseStops = true;
  sim.refuseSellIf = (x: any) => x.symbol === "LUNR";
  sim.partialTakeProfit(a, 1, 12.08);
  void mem;
  wk.lostExitsPending.set(b, { symbol: "AAPL", at: t0, tries: 0 });
  const triesAt: Array<{ at: number; tries: number | string }> = [];
  const real = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any, how: any = {}) => {
    if (!wk.inflight.has("risk")) triesAt.push({ at: sim.simMs - t0, tries: wk.lostExitsPending.get(b)?.tries ?? "gone" });
    return real(d, c, how);
  };
  wk.syncAt(t0, 0);
  r.setNow(iso(t0 + 1));
  await settle();
  await settle();
  const P = wk.syncRecheckAt - 300;
  wk.lastSync = P - 10_000;
  let armed = true;
  const realList = (sim as any).listOrdersPaged.bind(sim);
  (sim as any).listOrdersPaged = async (...x: any[]) => {
    if (armed && sim.simMs >= P) {
      armed = false;
      throw new Error("order list read failed (test)");
    }
    return realList(...x);
  };
  await driveTo(r, sim, P, Math.max(t0 + 6_000, P + 2_000)); // the stuck sale's first try takes a moment, so its retry can come after 6 s
  wk.stop?.();
  const trace = triesAt.map((x) => `+${x.at} tries=${x.tries}`).join(" | ");
  assert.equal(armed, false, "the pass's sync failed");
  // The stuck sale's first try (in the first sync) takes about 4 s in this setup, so the tries are counted within the follow-up's own 10 s.
  for (const n of [1, 2, 3]) assert.ok(triesAt.some((x) => x.tries === n && x.at < 10_000), `try ${n} ran within 10 s: ${trace}`);
});

test("fix (a), round 2 (group 1): the time put back after a failed pass sync is the recheck's own timer again (a later pass would cancel it)", async () => {
  const { sim, r, wk, due1 } = await stuckReported();
  let armed = true;
  const realList = (sim as any).listOrdersPaged.bind(sim);
  (sim as any).listOrdersPaged = async (...x: any[]) => {
    if (armed) {
      armed = false;
      throw new Error("order list read failed (test)");
    }
    return realList(...x);
  };
  wk.lastSync = due1 - 11_000;
  await r.at(iso(due1 - 100)); // the regular pass cancels the recheck's own timer; its sync fails
  await settle();
  assert.equal(armed, false, "the pass's sync failed");
  assert.equal(wk.eventSyncAt, due1, "the cancelled time is back");
  assert.equal(wk.recheckTimerAt, due1, "as the recheck's own timer");
  wk.stop?.();
});

// Group 2, fix (a) round 3: the restore after a failed pass sync is bounded. With Alpaca's order list failing for 30 s and a recheck
// pending, the real code makes one more failing sync than before the restore, also in the 250 ms two-restore window (see the build log,
// "Fix (a), round 7 (7879416): group 2"); a variant whose restored timer restores itself again failed every 100 ms (263 to 286 failed reads).
test("fix (a), rounds 3 to 7: with Alpaca's order list failing for 30 s and a recheck pending, the restore is bounded: at most 4 failed reads and at most 2 sync starts in 5 s, including (a stuck sale) when the next pass lands in the restored timer's 250 ms slack and two restores happen", async () => {
  const rows: string[] = [];
  // The redesign of 2026-11-14: the list-lag recheck no longer uses the shared timer (its own timer drops it after a failed sync), so only
  // the stuck kind is left here.
  for (const kind of ["stuck"] as const) {
    // Group 1, fix (a) round 5: -4 900 and -9 900 put the next pass inside the restored timer's 250 ms slack (two restores, each after its
    // own pass cancel). Group 1, round 6: a lagging remainder's recheck is due 0.5 s after the report, so offsets before about -500 ms would
    // lie in the past (the simulated clock never moves back) and run a different case; the lag kind uses only offsets that lie ahead.
    for (const off of [-4_000, -300, 100, -4_900, -9_900]) {
      const { sim, r } = await armedDay(true);
      const wk: any = r.worker;
      const mem = wk.syncMemory;
      const id = clientOrderIdFor(D, "GE", 1);
      await sim.submitEntry({ symbol: "GE", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
      sim.fillEntry(id, 12);
      await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "GE", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
      await r.at("14:30:10");
      const t0 = sim.simMs + 100;
      r.setNow(iso(t0));
      sim.refuseStops = true;
      sim.refuseSellIf = (s: any) => s.symbol === "GE";
      sim.partialTakeProfit(id, 1, 12.08);
      wk.syncAt(t0, 0);
      r.setNow(iso(t0 + 1));
      await settle();
      await settle();
      await settle();
      const due = mem.stuck.get(id)?.nextAt ?? wk.syncRecheckAt;
      const P = due + off;
      assert.ok(P >= sim.simMs, `${kind} ${off}: the pass time lies ahead of the clock at setup (it ran as labelled)`);
      if (off < 0) wk.lastSync = P - 10_000;
      let fails = 0;
      const realList = (sim as any).listOrdersPaged.bind(sim);
      (sim as any).listOrdersPaged = async (...a: any[]) => {
        if (sim.simMs >= P && sim.simMs < P + 30_000) {
          fails++;
          throw new Error("order list read failed (test)");
        }
        return realList(...a);
      };
      const starts: number[] = [];
      let restoring = 0; // pass syncs that carried a cancelled time to put back if they failed
      const realStart = wk.startSync.bind(wk);
      wk.startSync = (d: any, c: any, how: any = {}) => {
        if (!wk.inflight.has("risk")) {
          starts.push(sim.simMs);
          if (how.restoreAt !== undefined && sim.simMs < P + 30_000) restoring++;
        }
        return realStart(d, c, how);
      };
      await driveTo(r, sim, P, P + 45_000);
      wk.stop?.();
      const most5s = Math.max(0, ...starts.map((a) => starts.filter((b) => b >= a && b < a + 5_000).length));
      rows.push(`${kind}, pass ${off} ms from due: ${fails} failed order list reads in the 30 s outage, at most ${most5s} sync starts in 5 s, ${restoring} pass sync(s) carrying a time to put back`);
      // Group 2, fix (a) round 7: the window rows must really get two restores (so a timing change cannot let them drift out unseen).
      if (off === -4_900 || off === -9_900) assert.equal(restoring, 2, `${rows[rows.length - 1]}: the two-restore window`);
      assert.ok(fails >= 1 && fails <= 4, rows[rows.length - 1]!);
      assert.ok(most5s <= 2, rows[rows.length - 1]!);
    }
  }
  console.log("MEASURE 30 s outage\n" + rows.join("\n"));
});

// Group 1, fix (a) round 4: a loop that keeps restoring for a whole outage (even with a growing wait) must not pass. The sync's Alpaca reads
// (order lists, positions, lookups) fail for 120 s while a stuck sale's retry is pending; the real code made 13 syncs, at most 7 in a minute and 2 in 5 s
// (group 1's measurement). Bounds: at most 8 a minute and 2 in 5 s.
test("fix (a), round 4 (group 1): with the sync's Alpaca reads (order lists, positions, lookups) failing for 120 s, syncs stay at most 8 a minute and 2 in 5 s (no restore loop for the length of the outage)", async () => {
  const rows: string[] = [];
  for (const off of [-4_000, -300, 100, -4_900]) {
    const { sim, r } = await armedDay(true);
    const wk: any = r.worker;
    const mem = wk.syncMemory;
    const id = clientOrderIdFor(D, "GE", 1);
    await sim.submitEntry({ symbol: "GE", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "GE", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
    await r.at("14:30:10");
    const t0 = sim.simMs + 100;
    r.setNow(iso(t0));
    sim.refuseStops = true;
    sim.refuseSellIf = (s: any) => s.symbol === "GE";
    sim.partialTakeProfit(id, 1, 12.08);
    wk.syncAt(t0, 0);
    r.setNow(iso(t0 + 1));
    await settle();
    await settle();
    await settle();
    const due = mem.stuck.get(id)?.nextAt ?? wk.syncRecheckAt;
    const P = due + off;
    assert.ok(P >= sim.simMs, `${off}: the pass time lies ahead of the clock at setup`);
    if (off < 0) wk.lastSync = P - 10_000;
    let failed = 0;
    for (const m of ["listOrdersPaged", "listPositions", "findOrderByClientId", "listOrders"]) {
      const f = (sim as any)[m].bind(sim);
      (sim as any)[m] = async (...a: any[]) => {
        if (wk.inflight.has("risk") && (new Error().stack ?? "").includes("syncOrders") && sim.simMs >= P) {
          failed++;
          throw new Error(`${m} failed (test)`);
        }
        return f(...a);
      };
    }
    const starts: number[] = [];
    const realStart = wk.startSync.bind(wk);
    wk.startSync = (d: any, c: any, how: any = {}) => {
      if (!wk.inflight.has("risk")) starts.push(sim.simMs);
      return realStart(d, c, how);
    };
    await driveTo(r, sim, P, P + 120_000);
    wk.stop?.();
    const most = (w: number) => Math.max(0, ...starts.map((a) => starts.filter((b) => b >= a && b < a + w).length));
    rows.push(`pass ${off} ms from due: ${starts.length} syncs in 120 s, at most ${most(60_000)} a minute and ${most(5_000)} in 5 s, ${failed} failed reads`);
    assert.ok(failed >= 20, `the outage really failed the sync's reads: ${rows[rows.length - 1]}`);
    assert.ok(most(60_000) <= 8 && most(5_000) <= 2, rows[rows.length - 1]!);
  }
  console.log("MEASURE 120 s outage\n" + rows.join("\n"));
});
