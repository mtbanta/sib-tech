// Protect-first fix (a), Michael's morning decision 2 of 2026-11-17 (builds/build-c2-log.md, "Michael's morning decisions (2026-11-17)"):
// a running one-entry cleanup sale gives way to a sale of the whole account at the start of its next round, only when that ask covers its
// symbol (GIVE_WAY_AT_NEXT_ROUND in src/sells.ts). Each test is meant to fail with the change taken out or the switch off where it says so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GIVE_WAY_AT_NEXT_ROUND, Liquidator, SellGate, type LiquidateResult } from "../src/sells.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0);

async function setup() {
  const sim = new SimBroker(MID);
  sim.hideFilledParents = true;
  const logs: Array<{ ev: string; data: Record<string, unknown> }> = [];
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log: (ev: string, data?: Record<string, unknown>) => logs.push({ ev, data: data ?? {} }) } as never);
  // A filled bracket entry; `lost` cancels its exits (the lost-exit case the protection loop sells).
  const hold = async (symbol: string, qty: number, price: number, lost = true) => {
    const id = clientOrderIdFor(D, symbol, 1);
    await sim.submitEntry({ symbol, qty, stopPrice: price - 0.06, takeProfitPrice: price + 0.01, referencePrice: price, clientOrderId: id });
    sim.fillEntry(id, price);
    if (lost) sim.cancelExitsAtFill(id);
    return id;
  };
  // The protection loop's first try of a lost-exit sale, as risk.ts cleanupSale sends it (3 rounds, its own shares only).
  const cleanup = (symbol: string, qty: number) => liquidator.flatten({ reason: "protective stop not confirmed", tradeDate: D, only: [symbol], maxRounds: 3, cancelIds: [], yieldToPriority: true, ownEntryOnly: { maxQty: { [symbol]: qty } }, endWhenHiddenHold: true });
  return { sim, liquidator, logs, hold, cleanup };
}

// Round 1's sale is refused once (Alpaca); while it is being sent, a whole-account sale (`only` as given) is asked for.
async function runCase(askOnly: string[] | null) {
  const s = await setup();
  await s.hold("AAA", 5, 10, true);
  await s.hold("BBB", 4, 20, true);
  s.sim.refuseSellsTimes = 1;
  let ask: Promise<LiquidateResult> | null = null;
  s.sim.refuseSellIf = (x) => {
    if (!ask && x.symbol === "AAA") ask = s.liquidator.flatten({ reason: "flatten", tradeDate: D, ...(askOnly ? { only: askOnly, maxRounds: 1 } : {}) });
    return false;
  };
  const r = await s.cleanup("AAA", 5);
  s.sim.refuseSellIf = null;
  const w = await ask!;
  return { ...s, r, w };
}

test("fix (a): a running cleanup sale gives way at its next round to a whole-account sale; that sale sells its shares, no oversell", async () => {
  assert.equal(GIVE_WAY_AT_NEXT_ROUND.on, true, "ships switched on");
  const { sim, r, w, logs } = await runCase(null);
  assert.equal(r.yielded, true, JSON.stringify(r));
  assert.equal(r.gaveWay, "whole account");
  assert.equal(r.stoodAside, undefined, "it was running, not standing aside at its turn");
  assert.deepEqual(r.sold, [], "nothing sold by the cleanup sale");
  assert.deepEqual(r.remaining, ["AAA"]);
  assert.equal(sim.sellLog.filter((x) => x.symbol === "AAA").length, 1, "AAA sold once, by the whole-account sale (the refused try is not in the sell log)");
  assert.ok(w.sold.some((x) => x.symbol === "AAA" && x.qty === 5), JSON.stringify(w));
  assert.ok(w.sold.some((x) => x.symbol === "BBB"), "the whole-account sale sold the other position too");
  assert.equal(sim.oversellAttempts, 0);
  const gave = logs.find((l) => l.ev === "liquidation_gave_way");
  assert.ok(gave && gave.data.round === 2, JSON.stringify(logs.map((l) => l.ev)));
});

test("fix (a): an ask that does not cover the sale's symbol (a retry of named symbols) does not stop it; it sells its own shares", async () => {
  const { sim, r, w, logs } = await runCase(["BBB"]);
  assert.notEqual(r.yielded, true, JSON.stringify(r));
  assert.ok(r.sold.some((x) => x.symbol === "AAA" && x.qty === 5), JSON.stringify(r));
  assert.ok(!w.sold.some((x) => x.symbol === "AAA"));
  assert.ok(w.sold.some((x) => x.symbol === "BBB"));
  assert.equal(sim.oversellAttempts, 0);
  assert.ok(!logs.some((l) => l.ev === "liquidation_gave_way"));
});

test("fix (a): an ask naming the sale's symbol does stop it", async () => {
  const { r, w } = await runCase(["AAA", "BBB"]);
  assert.equal(r.gaveWay, "whole account");
  assert.ok(w.sold.some((x) => x.symbol === "AAA"));
});

test("fix (a) switched off: the running sale runs its next round as on v26 and sells its own shares", async () => {
  GIVE_WAY_AT_NEXT_ROUND.on = false;
  try {
    const { sim, r, w } = await runCase(null);
    assert.notEqual(r.yielded, true, JSON.stringify(r));
    assert.ok(r.sold.some((x) => x.symbol === "AAA" && x.qty === 5));
    assert.ok(!w.sold.some((x) => x.symbol === "AAA"), "the whole-account sale found AAA already sold");
    assert.equal(sim.oversellAttempts, 0);
  } finally {
    GIVE_WAY_AT_NEXT_ROUND.on = true;
  }
});

test("fix (a): never inside round 1 (the round already started sends its sale); a one-round try never gives way", async () => {
  const s = await setup();
  await s.hold("AAA", 5, 10, true);
  let ask: Promise<LiquidateResult> | null = null;
  s.sim.refuseSellIf = (x) => {
    if (!ask && x.symbol === "AAA") ask = s.liquidator.flatten({ reason: "flatten", tradeDate: D });
    return false;
  };
  s.sim.refuseSellsTimes = 1;
  const r = await s.liquidator.flatten({ reason: "protective stop not confirmed", tradeDate: D, only: ["AAA"], maxRounds: 1, cancelIds: [], yieldToPriority: true, ownEntryOnly: { maxQty: { AAA: 5 } } });
  s.sim.refuseSellIf = null;
  await ask!;
  assert.notEqual(r.gaveWay, "whole account", "a one-round try has no next round");
  assert.equal(s.sim.oversellAttempts, 0);
});

test("fix (a), structure: the give-way check sits at the start of a round after the first, before any request of that round", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../src/sells.ts", import.meta.url), "utf8");
  const loop = src.indexOf("for (let round = 1; round <= rounds; round++) {");
  const check = src.indexOf("if (round > 1 && GIVE_WAY_AT_NEXT_ROUND.on && o.ownEntryOnly && only && this.wholeAccountAskCovers(only))");
  const clock = src.indexOf("const clock = await this.d.broker.getClock()", loop);
  assert.ok(loop > 0 && check > loop && clock > check, "the check comes before the round's first request");
  // The ask is forgotten when its sale ends, so a later cleanup sale is not stopped by a finished one.
  assert.ok(/if \(ask\) this\.othersAsked\.delete\(ask\);/.test(src));
});
