// Lighter polling in the flatten command and the close-outs (Michael's change of direction of 2026-11-16, pending since 2026-11-07: "fewer
// looks while cancels are pending, sized by the request budget"). In a sale of the whole account, the wait for cancels keeps 20ba5bd's look
// times (so no sale is sent later) and drops two reads that cannot change what it decides: the look before the blind half second, and the
// open orders at a look whose positions already show shares held by orders (always read at the wait's last look). One entry's own sale
// is unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

// `n` positions with bracket exits whose cancels Alpaca takes `cancelMs`; a liquidation on a clock the test moves (50 ms steps). Returns the
// reads made from the ask (open orders, positions) with their times, the sells' times and the time every exit was cancelled.
async function run(n: number, cancelMs: number, opts: Record<string, unknown>, cancelOwn = false) {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep });
  const syms = Array.from({ length: n }, (_, i) => "Q" + String.fromCharCode(65 + i));
  const legIds: string[] = [];
  for (const s of syms) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    legIds.push(...sim.orders.find((x: any) => x.clientOrderId === id)!.legs.map((l: any) => l.id));
  }
  sim.advance(1_000);
  sim.cancelMs = cancelMs;
  const t0 = sim.simMs;
  const reads: Array<{ what: "open" | "positions"; t: number }> = [];
  const realOpen = sim.listOrdersPaged.bind(sim);
  sim.listOrdersPaged = (...a: any[]) => {
    reads.push({ what: "open", t: sim.simMs - t0 });
    return realOpen(...a);
  };
  const realPos = sim.listPositions.bind(sim);
  sim.listPositions = () => {
    reads.push({ what: "positions", t: sim.simMs - t0 });
    return realPos();
  };
  const sells: number[] = [];
  const realSell = sim.submitSell.bind(sim);
  sim.submitSell = (x: any) => {
    sells.push(sim.simMs - t0);
    return realSell(x);
  };
  let exitsGone: number | null = null;
  const p = liq.flatten({ tradeDate: D, ...opts, ...(cancelOwn ? { cancelIds: legIds } : {}) });
  while (sim.simMs < t0 + 30_000) {
    sim.advance(50);
    if (exitsGone === null && legIds.every((id) => sim.orders.flatMap((o: any) => [o, ...o.legs]).find((x: any) => x.id === id)?.status === "canceled")) exitsGone = sim.simMs - t0;
    for (const h of holds.filter((h) => h.until <= sim.simMs)) {
      holds.splice(holds.indexOf(h), 1);
      h.res();
    }
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  }
  const r = await p;
  return { reads, sells, exitsGone, flat: r.flat, oversell: sim.oversellAttempts };
}

test("lighter polling: a whole-account sale whose cancels take 3 s reads the positions at each look, the open orders only when the positions show the shares free, and sells at the first look after the cancels land", async () => {
  const w = await run(10, 3_000, { reason: "flatten command", maxRounds: 2 });
  assert.equal(w.flat, true);
  assert.equal(w.oversell, 0);
  assert.ok(w.exitsGone !== null);
  // Round 1: positions and open orders once (the round's own reads), then the cancel; no read before the blind half second.
  // (The round's own reads and its cancel come at the clock's first 50 ms step.)
  const firstLook = w.reads.filter((x) => x.t > 50 && x.t < 550);
  assert.deepEqual(firstLook, [], "nothing read in the blind half second after the cancel");
  // While the exits still hold the shares (until about 3 s): positions only.
  const during = w.reads.filter((x) => x.t >= 550 && x.t < w.exitsGone!);
  assert.ok(during.length >= 3 && during.every((x) => x.what === "positions"), JSON.stringify(during));
  // The sale goes out within one look (at most 0.8 s, 20ba5bd's longest pause) of the exits being cancelled.
  assert.ok(w.sells.length === 10 && w.sells[0]! >= w.exitsGone! && w.sells[0]! <= w.exitsGone! + 850, `first sell ${w.sells[0]} ms, exits gone ${w.exitsGone} ms`);
});

test("lighter polling: a whole-account sale whose cancels outlast the 6 s wait reads the open orders at its last look before selling", async () => {
  const w = await run(5, 9_000, { reason: "close-out", maxRounds: 1, waitCancelMs: 6_000 });
  const lastOpen = w.reads.filter((x) => x.what === "open").at(-1);
  assert.ok(lastOpen && lastOpen.t >= 6_000, `open orders read at ${lastOpen?.t} ms`);
  assert.equal(w.oversell, 0);
});

test("lighter polling: when slow reads make the clock outrun the wait (its 3 x waitCancelMs guard), the open orders are read before it ends, so the sells use a list no older than its last look", async () => {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  const events: Array<{ e: string; d: any }> = [];
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep, log: (e: string, d: any) => void events.push({ e, d }) });
  for (const s of ["QA", "QB"]) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
  }
  sim.advance(1_000);
  sim.cancelMs = 600_000; // the exits never come free in this test
  // Each positions read takes 4 s of the clock (a slow answer): after a few looks the clock is past 3 x 6 s while the pauses add up to ~2 s.
  const realPos = sim.listPositions.bind(sim);
  let slow = false;
  sim.listPositions = async () => {
    const r = await realPos();
    if (slow) sim.advance(4_000);
    return r;
  };
  const t0 = sim.simMs;
  const p = liq.flatten({ reason: "close-out", tradeDate: D, maxRounds: 1, waitCancelMs: 6_000 });
  slow = true;
  while (sim.simMs < t0 + 120_000) {
    sim.advance(50);
    for (const h of holds.filter((h) => h.until <= sim.simMs)) {
      holds.splice(holds.indexOf(h), 1);
      h.res();
    }
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  }
  await p;
  const blocked = events.filter((x) => x.e === "sale_blocked");
  assert.ok(blocked.length >= 1, "the held shares were reported blocked");
  // The list the step after the wait used is fresh: read after the wait's last positions read (4 s each), never left from its start.
  assert.ok(blocked.every((x) => x.d.openListAgeMs < 10_000), JSON.stringify(blocked.map((x) => [x.d.openListAgeMs, x.d.waitedMs])));
  assert.ok(blocked.every((x) => x.d.waitedMs < 6_000), "the wait ended at the clock guard, not after 6 s of pauses");
  assert.equal(sim.oversellAttempts, 0);
});

test("lighter polling: one entry's own sale is unchanged (the open orders and the positions at every look)", async () => {
  const w = await run(1, 3_000, { reason: "QA", only: ["QA"], ownEntryOnly: { maxQty: { QA: 5 } }, maxRounds: 1, waitCancelMs: 6_000 }, true);
  const looks = w.reads.filter((x) => x.t >= 500);
  const open = looks.filter((x) => x.what === "open").length;
  const pos = looks.filter((x) => x.what === "positions").length;
  assert.ok(open >= 3 && Math.abs(open - pos) <= 2, `open ${open}, positions ${pos}`);
  assert.equal(w.oversell, 0);
});
