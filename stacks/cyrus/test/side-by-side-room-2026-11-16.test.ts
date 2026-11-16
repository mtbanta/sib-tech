// The fix of the rate-limit storm in the side-by-side room check (Michael's ruling on item 2 of 2026-11-16: "as many at once as the request
// budget allows at that moment, above the floor for urgent work"). With 10 positions whose sales Alpaca refused at once, up to 7 first tries
// ran their 3 rounds together, each counted at a fixed 18 but sending 25 from its start, and Alpaca's bucket ran dry: 27 to 36 rate-limit
// answers in the first 30 s on 79f52ec, none on v24 (20ba5bd). Now the room is asked before each round of a side-by-side sale, and each
// round is counted at the most its steps can send (sells.ts `sideBySideRoundMost`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate, sideBySideRoundMost } from "../src/sells.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle } from "./rig.ts";
import { FakeBot } from "./helpers.ts";

const iso = (ms: number) => new Date(ms).toISOString();

// The worker with `n` positions whose exits are gone and whose every sale Alpaca refuses at once, for `seconds`, with Alpaca's live
// remaining fed to the governor (as main.ts wires it). Returns the rate-limit answers, the lowest remaining, and each first try's requests.
async function refusedWorld(n: number, seconds: number) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
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
  const prev = sim.onRate;
  sim.onRate = (k: number) => {
    r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: k, reset: null });
    prev?.(k);
  };
  await r.at("15:00:00");
  const syms = Array.from({ length: n }, (_, i) => "QX" + String.fromCharCode(65 + i));
  for (const s of syms) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: s, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  }
  await r.at("15:00:01");
  for (const s of syms) for (const l of sim.orders.find((x: any) => x.clientOrderId === clientOrderIdFor(D, s, 1))!.legs) await sim.cancelOrder(l.id);
  sim.refuseSellIf = (x: any) => syms.includes(x.symbol);
  const firsts: any[] = [];
  const realFirst = wk.budget.first.bind(wk.budget);
  wk.budget.first = (label: string) => {
    const res = realFirst(label);
    if (label === "missing-exit sale") firsts.push(res);
    return res;
  };
  timed = true;
  const r429 = sim.rejected429;
  const start = sim.simMs;
  let nextPass = start + 5_000;
  let nextTimed = start + 1_000;
  let lowest = 200;
  let peak = 0;
  while (sim.simMs < start + seconds * 1000) {
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
    lowest = Math.min(lowest, sim.tokens);
    peak = Math.max(peak, wk.liquidator.sideBySideNow());
    await settle();
  }
  timed = false;
  for (const h of holds.splice(0)) h.res();
  wk.stop?.();
  return { rateLimited: sim.rejected429 - r429, lowest: Math.floor(lowest), firstTries: firsts.map((x) => x.used), peak, oversell: sim.oversellAttempts };
}

test("rate-limit storm: 10 positions whose sales Alpaca refuses at once: no rate-limit answer in the first 30 s and Alpaca's remaining never below 20 (79f52ec: 27 or 28 answers, remaining 0)", async () => {
  const w = await refusedWorld(10, 30);
  assert.equal(w.rateLimited, 0, `rate-limit answers: ${w.rateLimited} (lowest remaining ${w.lowest})`);
  assert.ok(w.lowest >= 20, `lowest remaining ${w.lowest}`);
  assert.ok(w.peak >= 2, `still side by side (most at once: ${w.peak})`);
  assert.equal(w.oversell, 0);
});

// Michael's answer of 2026-11-16 ("Lone sale waits above 20"): with the headroom of 120 a second sale rarely starts, and before this the sale
// running alone (and each first one starting when none ran) went ahead with no floor: first tries ran back to back and drained the bucket
// (4c8e688: 144 rate-limit answers in 2 minutes, 17 to 22 on sells and cancels; v24 152 to 161). Now the lone sale waits for room above 20.
test("rate-limit storm: 30 positions whose sales Alpaca refuses at once: no rate-limit answer at all in a minute, none on sells or cancels, remaining never below 20", async () => {
  const w = await refusedWorld(30, 60);
  assert.equal(w.rateLimited, 0, `rate-limit answers: ${w.rateLimited} (lowest remaining ${w.lowest})`);
  assert.ok(w.lowest >= 20, `lowest remaining ${w.lowest}`);
  assert.equal(w.oversell, 0);
});

test("the room check's count: a first try of 3 rounds whose sale Alpaca refuses sends exactly its rounds' most from its start (its lookup before it)", async () => {
  const w = await refusedWorld(1, 10);
  const most = sideBySideRoundMost({}) * 3 + 1; // three rounds, the last with its last look
  assert.equal(most, 25);
  assert.deepEqual(w.firstTries, [1 + most], "its lookup, then 25");
});

test("the room check's count from the liquidator's steps: one page, cancels, waiting for Alpaca's cancel", () => {
  assert.equal(sideBySideRoundMost({}), 8, "positions, open orders, one look (2), positions again, the gate's read (2), the sell");
  assert.equal(sideBySideRoundMost({}, 2), 11, "each read of the open orders is one request a page");
  // A5's fast sale: no cancel, looks while waiting 2.5 s for Alpaca's cancel (at 0, 0.25, 0.65, 1.25, 2.05 and 2.85 s) and 5 early wakes.
  assert.equal(sideBySideRoundMost({ waitForAlpacaCancel: true, waitCancelMs: 2_500 }), 1 + 1 + 11 * 2 + 1 + 2 + 1);
  // A timed-out stop's try: one cancel, half a second blind (a look before and after), and 5 early wakes.
  assert.equal(sideBySideRoundMost({ cancelIds: ["a"], waitCancelMs: 500 }), 1 + 1 + 1 + 7 * 2 + 1 + 2 + 1);
});

// The round gate on its own: two side-by-side sales on a simulated Alpaca whose sales are refused, on a clock the test moves. The room check
// says yes at their start, then no for 5 s, then yes again. While both run and there is no room, neither starts its next round (nothing is
// sent); when room returns they go on. With no lone-sale check given (`sideBySideRoomAlone`), a sale running alone goes ahead even with no
// room at all; the worker gives one (room above the urgent floor of 20, Michael's "Lone sale waits above 20"), tested in round4-2026-11-16.
test("a running side-by-side sale asks for room before each round: with no room it waits while another runs; alone, with no lone-sale check given, it goes ahead", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  let room = true;
  const events: Array<{ e: string; d: any; t: number }> = [];
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep, log: (e, d) => void events.push({ e, d, t: sim.simMs }), sideBySideRoom: () => room });
  for (const s of ["AAA", "BBB"]) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    for (const l of sim.orders.find((x: any) => x.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  }
  sim.advance(1_000);
  const tries: Array<{ s: string; t: number }> = [];
  const realSell = sim.submitSell.bind(sim);
  sim.submitSell = async (x: any) => {
    tries.push({ s: x.symbol, t: sim.simMs });
    throw new Error("sell refused (test)");
  };
  void realSell;
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
  const sale = (s: string) => ({ reason: s, tradeDate: D, only: [s], ownEntryOnly: { maxQty: { [s]: 5 } }, sideBySide: true, maxRounds: 3 });
  const t0 = sim.simMs;
  const a = liq.flatten(sale("AAA"));
  const b = liq.flatten(sale("BBB"));
  await drive(t0 + 200);
  assert.equal(liq.sideBySideNow(), 2, "both started (room for both)");
  assert.deepEqual(tries.map((x) => x.s).sort(), ["AAA", "BBB"], "both sent their first round's sale");
  room = false;
  await drive(t0 + 5_000);
  assert.equal(tries.length, 2, "no room while both run: neither started its second round");
  assert.ok(events.some((x) => x.e === "side_by_side_round_waited") === false, "still waiting (logged when the wait ends)");
  room = true;
  await drive(t0 + 15_000);
  await Promise.all([a, b]);
  assert.equal(tries.filter((x) => x.s === "AAA").length, 3, "AAA ran its 3 rounds once room returned");
  assert.equal(tries.filter((x) => x.s === "BBB").length, 3, "BBB too");
  assert.ok(tries.slice(2).every((x) => x.t >= t0 + 5_000), "second rounds only after room returned");
  assert.ok(events.filter((x) => x.e === "side_by_side_round_waited").length >= 2, "both waited before a round");
  // Alone, with no room at all and no lone-sale check given: every round goes ahead.
  room = false;
  const n0 = tries.length;
  const t1 = sim.simMs;
  const c = liq.flatten(sale("AAA"));
  await drive(t1 + 6_000);
  await c;
  assert.equal(tries.length - n0, 3, "alone: its 3 rounds, no waiting");
});
