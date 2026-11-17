// The floor of 20 (Michael's ruling of 2026-11-16 evening; decision 4 changed): one entry's own sale in the one-at-a-time queue (a
// missing-exit sale, its retries, a remainder sale, the fast sale) waits before each round, sending nothing, until Alpaca's remaining less
// the room budgeted tries hold unsent less the most that round can send is at least 20; at most 30 s a round; a sale of the whole account
// asked meanwhile ends the wait at once and the waiting sale stands aside. Sales of the whole account never wait. Before (20ba5bd and the
// one-at-a-time commit d3eab63), first tries ran back to back with no floor and drained Alpaca's bucket: with 10 positions whose sales
// Alpaca refused, 7 to 23 rate-limit answers in 2 minutes; with 30, 152 to 185.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Liquidator, SALE_ROOM_WAIT_MAX_MS, SellGate, ownSaleRoundMost } from "../src/sells.ts";
import { shouldStoreEvent } from "../src/run-log.ts";
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
    await settle();
  }
  timed = false;
  for (const h of holds.splice(0)) h.res();
  wk.stop?.();
  return { rateLimited: sim.rejected429 - r429, lowest: Math.floor(lowest), firstTries: firsts.map((x) => x.used), oversell: sim.oversellAttempts };
}

test("floor of 20: 10 positions whose sales Alpaca refuses at once: no rate-limit answer in the first 30 s, remaining never below 20", async () => {
  const w = await refusedWorld(10, 30);
  assert.equal(w.rateLimited, 0, `rate-limit answers: ${w.rateLimited} (lowest remaining ${w.lowest})`);
  assert.ok(w.lowest >= 20, `lowest remaining ${w.lowest}`);
  assert.equal(w.oversell, 0);
});

test("floor of 20: 30 positions whose sales Alpaca refuses at once: no rate-limit answer in a minute, remaining never below 20", async () => {
  const w = await refusedWorld(30, 60);
  assert.equal(w.rateLimited, 0, `rate-limit answers: ${w.rateLimited} (lowest remaining ${w.lowest})`);
  assert.ok(w.lowest >= 20, `lowest remaining ${w.lowest}`);
  assert.equal(w.oversell, 0);
});

test("floor of 20: the round count from the liquidator's steps (one page, cancels, waiting for Alpaca's cancel)", () => {
  assert.equal(ownSaleRoundMost({}), 8, "positions, open orders, one look (2), positions again, the gate's read (2), the sell");
  assert.equal(ownSaleRoundMost({}, 2), 11, "each read of the open orders is one request a page");
  assert.equal(ownSaleRoundMost({ waitForAlpacaCancel: true, waitCancelMs: 2_500 }), 1 + 1 + 11 * 2 + 1 + 2 + 1);
  assert.equal(ownSaleRoundMost({ cancelIds: ["a"], waitCancelMs: 500 }), 1 + 1 + 1 + 7 * 2 + 1 + 2 + 1);
});

// A liquidator on a simulated Alpaca whose sales are refused, on a clock the test moves; `room` answers the floor's check.
async function world(syms: string[]) {
  const sim: any = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const holds: Array<{ until: number; res: () => void }> = [];
  const sleep = (ms: number) => new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res }));
  const state = { room: false, most: [] as number[] };
  const events: Array<{ e: string; d: any; t: number }> = [];
  const liq: any = new Liquidator({ broker: sim, gate: new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs }), now: () => new Date(sim.simMs), sleep, log: (e: string, d: any) => void events.push({ e, d, t: sim.simMs }), saleRoom: (most: number) => (state.most.push(most), state.room) });
  for (const s of syms) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 9, takeProfitPrice: 11, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    for (const l of sim.orders.find((x: any) => x.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  }
  sim.advance(1_000);
  const sells: Array<{ s: string; t: number }> = [];
  sim.submitSell = async (x: any) => {
    sells.push({ s: x.symbol, t: sim.simMs });
    throw new Error("sell refused (test)");
  };
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
  const own = (s: string, maxRounds: number) => liq.flatten({ reason: s, tradeDate: D, only: [s], ownEntryOnly: { maxQty: { [s]: 5 } }, yieldToPriority: true, maxRounds });
  return { sim, liq, state, events, sells, drive, own };
}

test("floor of 20, its bound: with no room above 20, one entry's own sale sends nothing for 25 s, goes ahead at 30 s, and waits again (at most 30 s) before its next round", async () => {
  assert.equal(SALE_ROOM_WAIT_MAX_MS, 30_000);
  const w = await world(["AAA"]);
  const t0 = w.sim.simMs;
  const p = w.own("AAA", 2);
  await w.drive(t0 + 25_000);
  assert.equal(w.sells.length, 0, "nothing sent while it waits");
  await w.drive(t0 + 40_000);
  assert.equal(w.sells.length, 1, "its first round went ahead once it had waited 30 s");
  assert.ok(w.sells[0]!.t - t0 >= 30_000 && w.sells[0]!.t - t0 <= 33_000, `first sell at ${w.sells[0]!.t - t0} ms`);
  await w.drive(t0 + 80_000);
  await p;
  assert.equal(w.sells.length, 2, "its second round waited too, then went ahead");
  assert.ok(w.sells[1]!.t - w.sells[0]!.t >= 30_000, "the second round's wait: 30 s again");
  assert.deepEqual(w.events.filter((x) => x.e === "sale_room_wait_over").map((x) => x.d.round), [1, 2]);
  assert.ok(w.state.most.every((m) => m >= 8), "each round asked for at least its 8 requests");
});

test("floor of 20: with room above 20, one entry's own sale goes at once; a sale of the whole account never asks for room", async () => {
  const w = await world(["AAA", "BBB"]);
  w.state.room = true;
  const t0 = w.sim.simMs;
  const a = w.own("AAA", 1);
  await w.drive(t0 + 300);
  assert.equal(w.sells.filter((x) => x.s === "AAA").length, 1, "at once");
  await w.drive(t0 + 5_000);
  await a;
  w.state.room = false;
  const asked = w.state.most.length;
  const t1 = w.sim.simMs;
  const whole = w.liq.flatten({ reason: "flatten command", tradeDate: D, maxRounds: 1 });
  await w.drive(t1 + 2_000);
  assert.ok(w.sells.some((x) => x.t >= t1 && x.t <= t1 + 2_000), "the whole-account sale sold within its own half-second wait and first look, with no room");
  assert.equal(w.state.most.length, asked, "and never asked for room");
  await w.drive(t1 + 10_000);
  await whole;
});

test("floor of 20: a sale of the whole account asked while one entry's own sale waits for room ends that wait at once; the waiting sale stands aside, sending nothing", async () => {
  const w = await world(["AAA"]);
  const t0 = w.sim.simMs;
  const own = w.own("AAA", 3);
  await w.drive(t0 + 3_000);
  assert.equal(w.sells.length, 0);
  const t1 = w.sim.simMs;
  const whole = w.liq.flatten({ reason: "flatten command", tradeDate: D, maxRounds: 1 });
  await w.drive(t1 + 100);
  const r = await own;
  assert.equal(r.stoodAside, "whole account");
  assert.ok(r.errors.includes("stood aside: a sale of the whole account was asked for and sells these shares"));
  assert.ok(w.events.some((x) => x.e === "liquidation_stood_aside" && x.t - t1 <= 100), "within 0.1 s of the ask");
  await w.drive(t1 + 10_000);
  await whole;
  assert.ok(w.sells.length >= 1 && w.sells.every((x) => x.t >= t1), "only the whole-account sale sold");
});

test("floor of 20: the worker's check and the stored events", () => {
  const wsrc = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
  assert.match(wsrc, /saleRoom: \(most\) => deps\.governor\.budget\(\) - this\.budget\.inUse\(\)\.reservedUnsent - most >= P1_FLOOR,/);
  assert.equal(shouldStoreEvent("info", "sale_room_waited"), true);
  assert.equal(shouldStoreEvent("info", "sale_room_wait_over"), true);
});
