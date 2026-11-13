// Group 1, round 7 of the weekend build, through the worker's real 5 second pass: when the pass runs a remainder recheck that is due while
// the recheck's own timer is still pending (inside its 250 ms slack), the timer's leftover sync keeps the next recheck's charge, so the
// charges equal the syncs that ran. The simulated day is 2026-11-02: the open is 14:30 UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, D } from "./rig.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { FakeBot } from "./helpers.ts";

async function armedDay() {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, bot });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  return { sim, r };
}

const iso = (ms: number) => new Date(ms).toISOString();

test("group 1, round 7 of the weekend build: through the worker's real pass, a due recheck run by the pass inside the timer's slack, then the leftover timer's sync: charges equal the syncs that ran", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const mem = wk.syncMemory;
  const id = clientOrderIdFor(D, "LUNR", 1);
  await sim.submitEntry({ symbol: "LUNR", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  sim.fillEntry(id, 12);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "LUNR", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  await r.at("14:30:10");
  const base = mem.retrySpend.length;
  // The live report of the stop's cancel, while Alpaca's list keeps showing the stop open for 15 s.
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
  const starts: Array<{ at: number; fromPass: boolean; leftover: boolean }> = [];
  const real = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any, how: any = {}) => {
    if (!wk.inflight.has("risk")) starts.push({ at: sim.simMs, fromPass: how.fromPass === true, leftover: how.leftover === true });
    return real(d, c, how);
  };
  // The real 5 second pass lands 100 ms after the recheck was due: its timer (due + 250 ms) is still pending.
  await r.at(iso(due1 + 100));
  await settle();
  assert.ok(starts.some((s) => s.fromPass), "the pass started the recheck");
  assert.equal(mem.retrySpend.length - base, 4, "the recheck ran (kept) and the next one is charged");
  r.setNow(iso(due1 + 260)); // the leftover timer fires
  await settle();
  await settle();
  assert.ok(starts.some((s) => s.leftover), "the leftover timer's sync ran");
  assert.equal(mem.retrySpend.length - base, 6, `three syncs after the report, three charges: ${JSON.stringify(starts.map((s) => ({ ...s, at: s.at - t0 })))}`);
  wk.stop?.();
});
