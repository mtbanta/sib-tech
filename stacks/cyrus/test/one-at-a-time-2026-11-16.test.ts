// Michael's change of direction of 2026-11-16 (about 6:15 PM): "Tonight's release ships without side-by-side sales: selling stays one at a
// time as on v24." These tests pin it: every sale, missing-exit sales of different symbols included, waits for the sale ahead of it in the
// one-at-a-time queue; the loss stop's priority wording and the remainder sale's give-way (`yieldToPriority`) are as on 20ba5bd.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Liquidator, SellGate } from "../src/sells.ts";
import { shouldStoreEvent } from "../src/run-log.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

// A liquidator on a simulated Alpaca whose clock the test moves, with positions bought and their exits cancelled.
async function world(symbols: string[]) {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep });
  for (const s of symbols) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    for (const l of sim.orders.find((x: any) => x.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  }
  sim.advance(1_000);
  const drive = async (until: number) => {
    while (sim.simMs < until) {
      sim.advance(50);
      for (const h of holds.filter((h) => h.until <= sim.simMs)) {
        holds.splice(holds.indexOf(h), 1);
        h.res();
      }
      for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
    }
  };
  // When each liquidation started and ended (simulated ms), by its reason.
  const spans = new Map<string, { start: number; end?: number }>();
  const realRun = liq.run.bind(liq);
  liq.run = async (o: any) => {
    spans.set(o.reason, { start: sim.simMs });
    try {
      return await realRun(o);
    } finally {
      spans.get(o.reason)!.end = sim.simMs;
    }
  };
  return { sim, liq, drive, spans };
}

const cleanup = (s: string, extra: Record<string, unknown> = {}) => ({ reason: s, tradeDate: D, only: [s], ownEntryOnly: { maxQty: { [s]: 5 } }, yieldToPriority: true, maxRounds: 3, ...extra });

test("one at a time: missing-exit sales of three different symbols asked together run one after another, each starting only after the one ahead has ended", async () => {
  const w = await world(["AAA", "BBB", "CCC"]);
  const sells: Array<{ s: string; t: number }> = [];
  w.sim.submitSell = async (x: any) => {
    sells.push({ s: x.symbol, t: w.sim.simMs });
    throw new Error("sell refused (test)");
  };
  const t0 = w.sim.simMs;
  const all = [w.liq.flatten(cleanup("AAA")), w.liq.flatten(cleanup("BBB")), w.liq.flatten(cleanup("CCC"))];
  await w.drive(t0 + 1_000);
  assert.ok(w.spans.has("AAA") && !w.spans.has("BBB") && !w.spans.has("CCC"), "only the first has started");
  await w.drive(t0 + 30_000);
  await Promise.all(all);
  const a = w.spans.get("AAA")!;
  const b = w.spans.get("BBB")!;
  const c = w.spans.get("CCC")!;
  assert.ok(b.start >= a.end!, `BBB started at ${b.start - t0} ms, AAA ended at ${a.end! - t0} ms`);
  assert.ok(c.start >= b.end!, `CCC started at ${c.start - t0} ms, BBB ended at ${b.end! - t0} ms`);
  assert.deepEqual([...new Set(sells.map((x) => x.s))], ["AAA", "BBB", "CCC"], "sells in the order asked");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("one at a time: a sale of the whole account asked while a missing-exit sale runs waits for it to end (no give-way at its next step); one queued behind stands aside at its turn", async () => {
  const w = await world(["AAA", "BBB"]);
  w.sim.submitSell = async (x: any) => {
    if (x.symbol === "AAA" || x.symbol === "BBB") throw new Error("sell refused (test)");
    throw new Error("unexpected");
  };
  const t0 = w.sim.simMs;
  const a = w.liq.flatten(cleanup("AAA"));
  const b = w.liq.flatten(cleanup("BBB"));
  await w.drive(t0 + 200);
  const whole = w.liq.flatten({ reason: "flatten command", tradeDate: D, maxRounds: 1 });
  await w.drive(t0 + 30_000);
  const ra = await a;
  const rb = await b;
  await whole;
  assert.ok(!ra.yielded, "the running missing-exit sale carried on to its end, as on 20ba5bd");
  assert.equal(rb.stoodAside, "whole account", "the queued one stood aside at its turn");
  assert.ok(w.spans.get("flatten command")!.start >= w.spans.get("AAA")!.end!, "the whole-account sale started after the running sale ended");
});

test("one at a time: a remainder sale running when the daily loss stop's sale is asked stops at its next step with 20ba5bd's wording", async () => {
  const w = await world(["AAA"]);
  w.sim.submitSell = async () => {
    throw new Error("sell refused (test)");
  };
  const t0 = w.sim.simMs;
  const rem = w.liq.flatten(cleanup("AAA"));
  await w.drive(t0 + 200);
  const loss = w.liq.flatten({ reason: "daily loss stop", tradeDate: D, priority: true, maxRounds: 1 });
  await w.drive(t0 + 20_000);
  const r = await rem;
  await loss;
  assert.equal(r.yielded, true);
  assert.ok(r.errors.includes("stopped: the daily loss stop's sale goes first and sells these shares"), JSON.stringify(r.errors));
  assert.equal(r.gaveWay, undefined);
});

test("one at a time: no side-by-side code is left in the sale path (sells.ts, risk.ts, worker.ts), and no side-by-side event is stored", () => {
  for (const f of ["sells.ts", "risk.ts", "worker.ts"]) {
    const s = src(f);
    assert.doesNotMatch(s, /sideBySide|SIDE_BY_SIDE|stillWanted|wholeAccountAsked|roomWait\(|gaveWay/, f);
  }
  // The stored events: a remainder sale giving way to the loss stop's sale is still stored (20ba5bd logs it too); the side-by-side waits are
  // gone and no longer stored (the give-way-messages test that pinned these was about side-by-side sales and is removed).
  assert.equal(shouldStoreEvent("info", "liquidation_yielded"), true);
  assert.equal(shouldStoreEvent("info", "side_by_side_waited"), false);
  assert.equal(shouldStoreEvent("info", "side_by_side_lone_wait_over"), false);
  // The queue: every sale waits for the one asked before it.
  assert.match(src("sells.ts"), /const run = this\.chain\.then\(\(\) => this\.run\(o\)\);\n\s+this\.chain = run\.catch\(\(\) => undefined\);/);
});
