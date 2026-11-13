// The worker's real 5 second pass and remainder rechecks: group 1's round 7 finding, Michael's fix (a) of 2026-11-13 (the pass cancels a
// recheck's own timer when its sync runs that recheck), and the fix (a) round 1 cases (the regular branch, an older recheck's own timer).
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

// ---------------- Fix (a), round 1 ----------------
// Group 2: a slow sync (the next pass 10 s or more after it started) makes the pass take its regular branch 100 ms before the recheck is
// due. That sync takes the recheck's place, so it cancels the recheck's own timer: no leftover sync runs after it, charged or not.
async function regularBranch(lagMs: number, N: number, old: boolean, PRE: number, EXTRA: number) {
  const { sim, r } = await armedDay(old);
  const wk: any = r.worker;
  const mem = wk.syncMemory;
  const ids: string[] = [];
  for (const [i, s] of ["LUNR", "AAPL", "MSFT", "AMD", "INTC"].slice(0, N).entries()) {
    const id = clientOrderIdFor(D, s, i + 1);
    ids.push(id);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: s, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(old ? sim.simMs - 30 * 60_000 : sim.simMs - 1000).toISOString() });
  }
  await r.at(old ? "15:05:10" : "14:30:10");
  const t0 = sim.simMs + 100;
  for (let i = 0; i < PRE; i++) {
    mem.retrySpend.push(t0 - 20_000);
    mem.retryLog.push(t0 - 20_000);
  }
  r.setNow(iso(t0));
  for (const id of ids) {
    sim.partialTakeProfitListLag(id, 1, 12.08, lagMs);
    mem.liveStopCancelled.set(id, t0);
    mem.mustLook.add(id);
  }
  const syncs: Array<{ at: number; how: string; req: number }> = [];
  let cur: { at: number; how: string; req: number } | null = null;
  const realSpend = (sim as any).spend.bind(sim);
  (sim as any).spend = (k: any) => {
    if (cur && wk.inflight.has("risk")) cur.req++;
    return realSpend(k);
  };
  const real = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any, how: any = {}) => {
    if (!wk.inflight.has("risk")) {
      cur = { at: sim.simMs - t0, how: how.fromPass ? "pass" : how.leftover ? "leftover" : "timer", req: 0 };
      syncs.push(cur);
    }
    return real(d, c, how);
  };
  wk.syncAt(t0, 0);
  r.setNow(iso(t0 + 1));
  await settle();
  await settle();
  const due1 = wk.syncRecheckAt as number;
  for (let i = 0; i < EXTRA; i++) {
    mem.retrySpend.push(sim.simMs);
    mem.retryLog.push(sim.simMs);
  }
  wk.lastSync = sim.simMs - 11_000; // as if the report's sync had started 11 s ago (a slow sync)
  await r.at(iso(due1 - 100)); // the pass: regular branch, the recheck not due yet
  await settle();
  const afterPass = syncs.length;
  r.setNow(iso(due1 + 260));
  await settle();
  await settle();
  const leftover = syncs.slice(afterPass).filter((s) => s.at <= due1 + 260 - t0).length;
  r.setNow(iso(due1 + 3_000));
  await settle();
  await settle();
  const recheckReal = PRE + EXTRA + syncs.filter((s) => s.how !== "pass" && s.at > 1).reduce((a: number, s) => a + s.req, 0);
  wk.stop?.();
  return { leftover, recheckReal, trace: syncs.map((s) => `${s.how}@+${s.at} req=${s.req}`).join(" | ") };
}

test("fix (a), round 1 (group 2): on the pass's regular branch before the recheck is due, the pass cancels the recheck's own timer; no leftover sync, and real recheck requests stay within 40 a minute", async () => {
  const rows: string[] = [];
  for (const [lag, N, old, PRE, EXTRA] of [[300, 1, false, 0, 0], [15_000, 1, false, 0, 0], [300, 5, true, 0, 0], [40_000, 5, true, 33, 1], [40_000, 1, false, 38, 1]] as Array<[number, number, boolean, number, number]>) {
    const x = await regularBranch(lag, N, old, PRE, EXTRA);
    rows.push(`lag ${lag / 1000} s, ${N} ${old ? "older" : "recent"}, ${PRE}+${EXTRA} charged: leftover syncs ${x.leftover}, real recheck requests ${x.recheckReal} (${x.trace})`);
    assert.equal(x.leftover, 0, rows[rows.length - 1]!);
    assert.ok(x.recheckReal <= 40, rows[rows.length - 1]!);
  }
  console.log("MEASURE regular branch with fix (a)\n" + rows.join("\n"));
});

test("fix (a), round 1: while a sync is still running, the pass's regular branch starts nothing and cancels nothing", async () => {
  const { r, wk, due1, starts } = await lagReported();
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

test("fix (a), round 1 (group 2's note): a timer replaced by an earlier one drops a leftover mark it carried", async () => {
  const { r, wk, due1 } = await lagReported();
  wk.leftoverTimerAt = wk.eventSyncAt; // as if a pass had marked it
  assert.ok(wk.leftoverTimerAt !== null);
  r.setNow(iso(due1 - 300));
  wk.syncAt(due1 - 300, 0);
  assert.equal(wk.leftoverTimerAt, null);
  assert.equal(wk.recheckTimerAt, null);
  wk.stop?.();
});

// Group 1, fix (a) round 1 (B1): an older recheck's own timer R1 is still pending when a sync asks for a newer recheck; R1 keeps its place
// and its own mark, so the pass that runs the newer recheck cancels it (before, the mark was lost and R1's sync ran uncharged: 47 and 52
// real requests in the minute against 40). Group 1's probe, kept as a test: the older timer injected, 415 ms per read so the syncs take time.
async function olderOwn(PRE: number, N: number, lagMs: number, LAT: number, r1Off: number | null) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, bot: new FakeBot(), orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const wk: any = r.worker;
  const mem = wk.syncMemory;
  const syms = ["LUNR", "AAPL", "MSFT", "AMD", "INTC", "F", "T", "KO", "PFE", "BAC"].slice(0, N);
  const ids: string[] = [];
  for (const [i, s] of syms.entries()) {
    const id = clientOrderIdFor(D, s, i + 1); ids.push(id);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: s, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 30 * 60_000).toISOString() });
  }
  await r.at("15:05:10");
  // pass grid: the worker's pass runs every 5 s; pS is a pass time
  const pS = sim.simMs + 4_000;
  r.setNow(iso(pS - 3_000));
  const pre: number[] = [];
  for (let i = 0; i < PRE; i++) { const at = pS - 20_000; mem.retrySpend.push(at); mem.retryLog.push(at); pre.push(at); }
  for (const id of ids) { sim.partialTakeProfitListLag(id, 1, 12.08, lagMs); mem.liveStopCancelled.set(id, pS - 3_000); mem.mustLook.add(id); mem.liveLagTries.set(id, 3); }
  // The previous sync P (10 s ago) asked for a recheck at R1; the need has gone (for example its stuck position closed).
  wk.lastSync = pS - 10_000;
  const R1 = r1Off === null ? pS + 20_000 : pS + r1Off;
  wk.syncRecheckAt = R1; wk.syncAt(R1); wk.recheckTimerAt = R1;
  let cur: any = null;
  const syncs: any[] = [];
  let reading = 0;
  for (const m of ["listOrdersPaged", "listPositions", "findOrderByClientId"]) { const f = (sim as any)[m].bind(sim); (sim as any)[m] = async (...a: any[]) => { reading++; if (LAT && cur) { await Promise.resolve(); sim.advance(LAT); } try { return await f(...a); } finally { reading--; } }; }
  const realSpend = (sim as any).spend.bind(sim);
  (sim as any).spend = (k: any) => { if (cur && reading > 0 && wk.inflight.has("risk")) cur.reqAt.push(sim.simMs); return realSpend(k); };
  const real = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any, how: any = {}) => {
    if (!wk.inflight.has("risk")) {
      const now = sim.simMs;
      const due = wk.syncRecheckAt !== null && now >= wk.syncRecheckAt;
      cur = { at: now - pS, kind: how.fromPass ? (due ? "pass-recheck" : "pass-regular") : how.leftover ? "leftover" : "timer", reqAt: [] as number[], timerAt: wk.eventSyncAt === null ? null : wk.eventSyncAt - pS, own: wk.recheckTimerAt === null ? null : wk.recheckTimerAt - pS };
      syncs.push(cur);
    }
    return real(d, c, how);
  };
  let nextPass = pS;
  const end = pS + 12_000;
  let dueAfterS: number | null = null;
  for (let g = 0; g < 2000; g++) {
    const tAll = Math.min(...r.timers(), Infinity);
    if (tAll <= sim.simMs) { r.setNow(iso(sim.simMs)); await settle(); await settle(); continue; }
    const next = Math.min(nextPass, tAll);
    if (next > end) break;
    if (next === nextPass) { await r.at(iso(next)); nextPass += 5_000; } else r.setNow(iso(next));
    await settle(); await settle();
    if (dueAfterS === null && syncs.length >= 1 && !wk.inflight.has("risk")) dueAfterS = wk.syncRecheckAt === null ? -1 : wk.syncRecheckAt - pS;
  }
  wk.stop?.();
  const rc = syncs.filter((s) => s.kind !== "pass-regular");
  const reqs = [...pre, ...rc.flatMap((s) => s.reqAt)].sort((a, b) => a - b);
  let max60 = 0, max5 = 0;
  for (let i = 0; i < reqs.length; i++) { let j = i; while (j < reqs.length && reqs[j]! - reqs[i]! < 60_000) j++; max60 = Math.max(max60, j - i); }
  const r5 = reqs.filter((x) => x >= pS - 1);
  for (let i = 0; i < r5.length; i++) { let k = i; while (k < r5.length && r5[k]! - r5[i]! < 5_000) k++; max5 = Math.max(max5, k - i); }
  const charged = mem.retryLog.filter((x: number) => x >= pS - 1).length;
  return { leftovers: syncs.filter((s) => s.kind === "leftover").length, R1: R1 - pS, dueAfterS, max60, max5, chargedSince: charged, trace: syncs.map((s) => `${s.kind}@+${s.at} req=${s.reqAt.length} timer=${s.timerAt} own=${s.own}`).join(" | ") };
}
test("fix (a), round 1 (group 1, B1): an older recheck's own timer that a newer recheck lands on is still cancelled by the pass; real recheck requests stay within 40 a minute and 15 in 5 s", async () => {
  const rows: string[] = [];
  for (const [PRE, N] of [[33, 5], [28, 10], [16, 10]] as Array<[number, number]>) {
    const dry = await olderOwn(PRE, N, 25_000, 415, null);
    const x = await olderOwn(PRE, N, 25_000, 415, (dry.dueAfterS as number) - 100);
    rows.push(`${N} older, ${PRE} charged, R1 at +${x.R1}: ${x.max60} a minute, ${x.max5} in 5 s, leftover syncs ${x.leftovers} (${x.trace})`);
    assert.ok(x.max60 <= 40 && x.max5 <= 15, rows[rows.length - 1]!);
  }
  console.log("MEASURE older own timer with fix (a)\n" + rows.join("\n"));
});
