// The speed release, round 4 (group 1's blocker) and Michael's answers of 2026-11-16: "Every side-by-side sale after the first needs 120 left,
// not 20", and a side-by-side sale waiting for room ends its wait at once when a sale of the whole account is asked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clientOrderIdFor } from "../src/gate.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle } from "./rig.ts";
import { FakeBot } from "./helpers.ts";

const iso = (ms: number) => new Date(ms).toISOString();

// Group 1's shape (probe G): 5 positions lose their exits at once and Alpaca refuses their sales, so missing-exit sales run side by side; 25
// other positions keep their bracket exits. `flatten` (the close-outs' call) is asked `askAfterMs` after the losses, with Alpaca taking 8 s to
// cancel each bracket exit. Alpaca's live remaining reaches the governor, as main.ts wires it. Returns the rate-limit answers on sells and
// cancels from the ask on, and when the last bracketed position's sale went out after the ask.
async function lostThenFlatten(askAfterMs: number) {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const holds: Array<{ until: number; res: () => void }> = [];
  let timed = false;
  const tsleep = (ms: number): Promise<void> => (timed ? new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res })) : sim.sleep(ms));
  const r: any = rig<SimBroker>({ broker: sim, sleep: tsleep, simClock: sim, bot, orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const wk: any = r.worker;
  await r.at("20:40:00");
  const mk = (p: string, n: number) => Array.from({ length: n }, (_, i) => p + String.fromCharCode(65 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
  const bad = mk("QX", 5);
  const good = mk("BR", 25);
  for (const s of [...bad, ...good]) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: s, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  }
  await r.at("20:40:01");
  const loseAt = new Date(`${D}T20:40:05Z`).getTime();
  sim.refuseSellIf = (x: any) => bad.includes(x.symbol);
  let afterAsk = false;
  let onSellsOrCancels = 0;
  const realSpend = sim.spend.bind(sim);
  sim.spend = (kind: string) => {
    const b = sim.rejected429;
    try {
      return realSpend(kind);
    } finally {
      if (afterAsk && kind !== "read") onSellsOrCancels += sim.rejected429 - b;
    }
  };
  const prev = sim.onRate;
  sim.onRate = (k: number) => {
    r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: k, reset: null });
    prev?.(k);
  };
  timed = true;
  let nextPass = sim.simMs + 5_000;
  let nextTimed = sim.simMs + 1_000;
  const askAt = loseAt + askAfterMs;
  let lost = false;
  let asked: Promise<unknown> | null = null;
  while (sim.simMs < askAt + 60_000) {
    if (!lost && sim.simMs >= loseAt) {
      lost = true;
      sim.cancelMs = 100;
      for (const s of bad) for (const l of sim.orders.find((o: any) => o.clientOrderId === clientOrderIdFor(D, s, 1))!.legs) await sim.cancelOrder(l.id);
    }
    if (!asked && sim.simMs >= askAt) {
      sim.cancelMs = 8_000;
      afterAsk = true;
      asked = wk.liquidator.flatten({ reason: "flatten command", tradeDate: D });
    }
    if (sim.simMs >= nextPass) {
      void r.at(iso(sim.simMs));
      nextPass += 5_000;
    } else r.setNow(iso(sim.simMs + 100));
    if (sim.simMs >= nextTimed) {
      nextTimed += 1_000;
      void wk.timedTick();
    }
    for (const h of holds.filter((h) => h.until <= sim.simMs)) {
      holds.splice(holds.indexOf(h), 1);
      h.res();
    }
    await settle();
  }
  timed = false;
  for (const h of holds.splice(0)) h.res();
  wk.stop?.();
  const sales = sim.sellLog.filter((x: any) => good.includes(x.symbol) && x.at >= askAt);
  return { onSellsOrCancels, lastSaleMs: Math.max(...sales.map((x: any) => x.at)) - askAt, sold: new Set(sales.map((x: any) => x.symbol)).size, oversell: sim.oversellAttempts };
}

// v24 (20ba5bd) in this shape: 17 to 20 rate-limit answers on sells and cancels, last bracketed sale 8.2 to 9.1 s after the ask. f9a4254 (the
// floor of 20): 59 to 72 answers, 17.2 to 23.1 s.
for (const after of [20_000, 25_000]) {
  test(`round 4 (headroom 120): lost-exit sales side by side, then flatten asked ${after / 1000} s later: no more rate-limit answers on sells and cancels than v24, last bracketed sale within 12 s`, async () => {
    const w = await lostThenFlatten(after);
    assert.equal(w.sold, 25, "every bracketed position sold");
    assert.ok(w.onSellsOrCancels <= 20, `rate-limit answers on sells and cancels: ${w.onSellsOrCancels} (v24: 17 to 20)`);
    assert.ok(w.lastSaleMs <= 12_000, `last bracketed sale ${w.lastSaleMs} ms after the ask`);
    assert.equal(w.oversell, 0);
  });
}
