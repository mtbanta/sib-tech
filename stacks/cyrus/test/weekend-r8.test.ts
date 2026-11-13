// Group 1, round 7 of the weekend build, through the worker's real 5 second pass: when the pass runs a remainder recheck that is due while
// the recheck's own timer is still pending (inside its 250 ms slack), the timer's leftover sync keeps the next recheck's charge, so the
// charges equal the syncs that ran. The simulated day is 2026-11-02: the open is 14:30 UTC.
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

test("Michael's fix (a) of 2026-11-13: through the worker's real pass, a due recheck run by the pass inside its timer's slack cancels that timer, so no second sync repeats it; the next recheck runs at its own time and is charged", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const mem = wk.syncMemory;
  const id = clientOrderIdFor(D, "LUNR", 1);
  await sim.submitEntry({ symbol: "LUNR", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  sim.fillEntry(id, 12);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "LUNR", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  await r.at("14:30:10");
  const base = mem.retrySpend.length;
  const t0 = sim.simMs + 100;
  r.setNow(iso(t0));
  sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
  mem.liveStopCancelled.set(id, t0);
  mem.mustLook.add(id);
  wk.syncAt(t0, 0);
  r.setNow(iso(t0 + 1));
  await settle();
  await settle();
  const due1 = wk.syncRecheckAt;
  assert.ok(due1 !== null && due1 - sim.simMs <= 500, "a quick recheck was asked for");
  assert.equal(mem.retrySpend.length - base, 2, "and charged");
  assert.ok(r.timers().includes(due1 + 250), "its own timer is pending (250 ms slack)");
  const starts: Array<{ at: number; fromPass: boolean; leftover: boolean }> = [];
  const real = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any, how: any = {}) => {
    if (!wk.inflight.has("risk")) starts.push({ at: sim.simMs, fromPass: how.fromPass === true, leftover: how.leftover === true });
    return real(d, c, how);
  };
  await r.at(iso(due1 + 100)); // the real 5 second pass, 100 ms after the recheck was due
  await settle();
  assert.equal(starts.length, 1);
  assert.ok(starts[0]!.fromPass, "the pass ran the recheck");
  assert.ok(!r.timers().includes(due1 + 250), "and cancelled the recheck's own timer");
  assert.equal(mem.retrySpend.length - base, 4, "the recheck that ran stays charged; the next one is charged");
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
  assert.equal(mem.retrySpend.length - base, 6, "and stayed charged; the one after is charged");
  wk.stop?.();
});

// Group 1, round 8 of the weekend build (B1): with the allowance nearly full, or with lagging remainders older than the order list's
// window (each needs a lookup), the pass's recheck charged nothing new and the leftover timer's sync then ran uncharged (42 to 52 real
// requests in the minute against 40). With fix (a) there is no leftover sync.
async function nearlyFull(PRE: number, N: number, old: boolean) {
  const { sim, r } = await armedDay(true); // with Alpaca's live order updates, so only the last 10 minutes are listed and older entries are looked up
  const wk: any = r.worker;
  const mem = wk.syncMemory;
  const syms = ["LUNR", "AAPL", "MSFT", "AMD", "INTC", "F", "T", "KO", "PFE", "BAC"].slice(0, N);
  const ids: string[] = [];
  for (const [i, s] of syms.entries()) {
    const id = clientOrderIdFor(D, s, i + 1);
    ids.push(id);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    const created = old ? sim.simMs - 30 * 60_000 : sim.simMs - 1000;
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: s, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(created).toISOString() });
  }
  await r.at(old ? "15:05:10" : "14:30:10");
  const t0 = sim.simMs + 100;
  for (let i = 0; i < PRE; i++) {
    mem.retrySpend.push(t0 - 20_000);
    mem.retryLog.push(t0 - 20_000);
  }
  r.setNow(iso(t0));
  for (const id of ids) {
    sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
    mem.liveStopCancelled.set(id, t0);
    mem.mustLook.add(id);
  }
  let cur: { req: number; how: string } | null = null;
  const syncs: Array<{ req: number; how: string }> = [];
  const realSpend = (sim as any).spend.bind(sim);
  (sim as any).spend = (k: any) => {
    if (cur && wk.inflight.has("risk")) cur.req++;
    return realSpend(k);
  };
  const real = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any, how: any = {}) => {
    if (!wk.inflight.has("risk")) {
      cur = { req: 0, how: how.fromPass ? "pass" : how.leftover ? "leftover" : "timer" };
      syncs.push(cur);
    }
    return real(d, c, how);
  };
  wk.syncAt(t0, 0);
  r.setNow(iso(t0 + 1));
  await settle();
  await settle();
  const due1 = wk.syncRecheckAt;
  if (due1 === null) {
    wk.stop?.();
    return null;
  }
  await r.at(iso(due1 + 100));
  await settle();
  r.setNow(iso(due1 + 260));
  await settle();
  await settle();
  r.setNow(iso(due1 + 600));
  await settle();
  await settle();
  const recheckRequests = syncs.slice(1).reduce((a: number, x: { req: number }) => a + x.req, 0);
  wk.stop?.();
  return { realInMinute: PRE + recheckRequests, syncsAfterReport: syncs.length - 1, streamLive: wk.orderStreamLive(), perSync: syncs.map((x) => `${x.how} ${x.req}`).join(", ") };
}

test("group 1, round 8 of the weekend build (B1), with fix (a): no uncharged second sync when the allowance is nearly full or the lagging remainders need lookups; real recheck requests stay within 40 a minute", async () => {
  const rows: string[] = [];
  for (const [PRE, N, old] of [[38, 1, false], [37, 1, true], [33, 5, true], [28, 10, true]] as Array<[number, number, boolean]>) {
    const x = await nearlyFull(PRE, N, old);
    assert.ok(x, "a recheck was asked for");
    rows.push(`${N} ${old ? "older" : "recent"} remainder(s), ${PRE} already charged: ${x!.realInMinute} real requests in the minute, ${x!.syncsAfterReport} sync(s) after the report (requests per sync: ${x!.perSync}; live updates ${x!.streamLive})`);
    assert.ok(x!.realInMinute <= 40, rows[rows.length - 1]!);
    assert.equal(x!.syncsAfterReport, 1, "only the pass's recheck ran (no leftover sync)");
  }
  console.log("MEASURE B1 with fix (a)\n" + rows.join("\n"));
});

async function lagReported() {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const mem = wk.syncMemory;
  const id = clientOrderIdFor(D, "LUNR", 1);
  await sim.submitEntry({ symbol: "LUNR", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  sim.fillEntry(id, 12);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "LUNR", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  await r.at("14:30:10");
  const t0 = sim.simMs + 100;
  r.setNow(iso(t0));
  sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
  mem.liveStopCancelled.set(id, t0);
  mem.mustLook.add(id);
  wk.syncAt(t0, 0);
  r.setNow(iso(t0 + 1));
  await settle();
  await settle();
  const starts: Array<{ at: number; fromPass: boolean }> = [];
  const real = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any, how: any = {}) => {
    if (!wk.inflight.has("risk")) starts.push({ at: sim.simMs, fromPass: how.fromPass === true });
    return real(d, c, how);
  };
  return { sim, r, wk, mem, due1: wk.syncRecheckAt as number, starts };
}

test("Michael's fix (a): a recheck's own timer that was put off while a sync ran is still its own; the pass that runs the recheck cancels it", async () => {
  const { r, wk, due1, starts } = await lagReported();
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
  const { r, wk, due1, starts } = await lagReported();
  wk.inflight.add("risk");
  r.setNow(iso(due1 - 200));
  wk.syncAt(due1 - 200, 0); // a live update: earlier than the recheck's timer, so it replaces it
  assert.equal(wk.recheckTimerAt, null, "the replaced timer's mark goes with it");
  assert.equal(wk.leftoverTimerAt, null);
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
