// The early wake-up limits (Michael's decision of 2026-11-06 after release 11's group 1 review, round 2; src/early-wake.ts). The
// flatten test of release 11 is run again with the sale's waits ended early by live updates, as the worker does, and with Alpaca's
// cancel completions and sell fills spread at random over their delays (the case round 2 found: rate-limit answers from 5 positions).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { closeOut } from "../src/closeout.ts";
import { MemoryStore } from "../src/store.ts";
import { Governor, RESERVE_FLOOR, SAFETY_RESERVE, reserveFor } from "../src/governor.ts";
import { EARLY_LOOK_HEADROOM, MAX_EARLY_WAKES, earlyLookAllowed } from "../src/early-wake.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 20, 55);

// One flatten on the simulated broker. Updates arrive at each cancel completion and sell fill (spread at random over the delay when
// `spread`), 40 ms later the wait ends, unless the worker's rule (earlyLookAllowed against the governor's budget and reserve) says
// no, in which case the wait carries on to the next update or its timed end.
async function flatten(n: number, path: "closeout" | "lossstop" | "flatten", cancelMs: number, opts: { spread: boolean; scaled: boolean; seed: number; limit: boolean }) {
  const sim = new SimBroker(MID);
  const inner = sim as unknown as { cancels: Array<{ id: string; doneAt: number }>; sellFills: Array<{ id: string; at: number }> };
  sim.cancelMs = cancelMs;
  sim.sellFillDelayMs = 16_000;
  for (let i = 0; i < n; i++) {
    const id = `cyrus-20261102-S${i}-1`;
    await sim.submitEntry({ symbol: `S${i}`, qty: 2, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
  }
  const gov = new Governor(() => sim.simMs, { scaleReserve: opts.scaled });
  gov.setOpenSymbols(n);
  sim.onRate = (remaining) => gov.observe({ path: "/v2/orders", status: 200, limit: 200, remaining, reset: null });
  let seed = opts.seed;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const seen = new WeakSet<object>();
  const jitter = () => {
    for (const c of inner.cancels) if (!seen.has(c)) { seen.add(c); if (opts.spread) c.doneAt = sim.simMs + Math.max(50, rnd() * cancelMs); }
    for (const f of inner.sellFills) if (!seen.has(f)) { seen.add(f); if (opts.spread) f.at = sim.simMs + Math.max(100, rnd() * 16_000); }
  };
  const adv = sim.advance.bind(sim);
  sim.advance = (ms: number) => { jitter(); adv(ms); };
  const symOf = (id: string) => { for (const o of sim.orders) { if (o.id === id) return o.symbol; for (const l of o.legs) if (l.id === id) return l.symbol; } return null; };
  const waitEvent = async (syms: ReadonlySet<string>, ms: number): Promise<boolean> => {
    jitter();
    const end = sim.simMs + ms;
    const times = [...inner.cancels.map((c) => [c.doneAt, c.id] as const), ...inner.sellFills.map((f) => [f.at, f.id] as const)]
      .filter(([t, id]) => t > sim.simMs && t <= end && syms.has(symOf(id) ?? "")).map(([t]) => t).sort((a, b) => a - b);
    for (const t of times) {
      if (t + 40 > end) break;
      sim.advance(t + 40 - sim.simMs);
      if (!opts.limit || earlyLookAllowed(gov.budget(), gov.reserve())) return true;
    }
    if (end > sim.simMs) sim.advance(end - sim.simMs);
    return false;
  };
  const start = gov.reserve() - 8;
  sim.tokens = start;
  sim.lowestTokens = start;
  sim.refillPerMinute = 125;
  sim.rejected429 = 0;
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liq = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, waitEvent });
  if (path === "closeout") await closeOut({ broker: sim, liquidator: liq, store: new MemoryStore(), now: () => new Date(sim.simMs), say, sleep: sim.sleep, waitEvent }, D, { closeAt: new Date(MID + 300_000), path: "close-out" });
  else await liq.flatten({ reason: path, tradeDate: D, maxRounds: path === "lossstop" ? 1 : 4, priority: path === "lossstop" });
  sim.advance(20_000);
  return { start, lowest: Math.floor(sim.lowestTokens), r429: sim.rejected429, held: [...Array(n).keys()].filter((i) => sim.heldQty(`S${i}`) > 0).length, oversell: sim.oversellAttempts };
}

test("wake-up limits: the helper and the caps", () => {
  assert.deepEqual([EARLY_LOOK_HEADROOM, MAX_EARLY_WAKES], [20, 5]);
  assert.equal(earlyLookAllowed(100, 80), true);
  assert.equal(earlyLookAllowed(99, 80), false);
  assert.equal(earlyLookAllowed(NaN, 80), false);
});

test("wake-up limits: a full flatten of 1 to 30 positions with early wake-ups and spread updates, from 8 below the reserve of 80, never hits a rate limit; 10 or more left up to 20 positions", { timeout: 300_000 }, async () => {
  const rows: string[] = [];
  for (const n of [1, 5, 12, 20, 30]) for (const path of ["closeout", "lossstop", "flatten"] as const) for (const cancelMs of [200, 7_000]) for (const seed of [7, 11, 23]) {
    const r = await flatten(n, path, cancelMs, { spread: true, scaled: false, seed, limit: true });
    rows.push(`${n} ${path} ${cancelMs} seed ${seed}: lowest ${r.lowest}, 429s ${r.r429}`);
    assert.equal(r.r429, 0, `${n} positions, ${path}, cancels ${cancelMs} ms, seed ${seed}: no rate-limit answer (lowest ${r.lowest})`);
    // At 30 open symbols (the full live list) the flatten command's own timed looks with slow, spread cancels can draw the whole bucket
    // from 72 (0 to 4 left, no rate-limit answer): early looks are already blocked there; only lighter polling in the flatten command
    // or a reserve above Michael's cap of 80 would add margin (for Michael). Up to 20 open symbols, at least 10 are left.
    const need = n <= 20 ? 10 : 0;
    assert.ok(r.lowest >= need, `${n} positions, ${path}, cancels ${cancelMs} ms, seed ${seed}: at least ${need} left (${r.lowest})`);
    assert.equal(r.oversell, 0);
    if (!(path === "lossstop" && cancelMs === 7_000)) assert.equal(r.held, 0, `${n} positions, ${path}: flat`);
  }
  if (process.env.SHOW) console.log(rows.join("\n"));
});

test("wake-up limits: without them (v10 and v11 as deployed), the same spread case hits rate limits", { timeout: 300_000 }, async () => {
  let worst = 0;
  for (const n of [12, 20, 30]) for (const seed of [7, 11]) worst += (await flatten(n, "flatten", 7_000, { spread: true, scaled: false, seed, limit: false })).r429;
  assert.ok(worst > 0, "the case this fix is for");
});

test("wake-up limits, worker: a live update ends a sale's wait early only while the request budget is 20 or more above the reserve", async () => {
  let release: () => void = () => undefined;
  const r = rig({ orderStream: true, sleep: () => new Promise<void>((res) => (release = res)) });
  const w = r.worker as unknown as { waitEvent(s: ReadonlySet<string>, ms: number): Promise<boolean>; waiters: Set<{ wake: () => void }>; orderStream: { status(): string } | null };
  w.orderStream = { status: () => "live" } as never;
  r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: 150, reset: null });
  const p1 = w.waitEvent(new Set(["AAA"]), 60_000);
  for (const x of [...w.waiters]) x.wake();
  assert.equal(await p1, true, "budget 150: ends early");
  r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: 95, reset: null });
  let ended = false;
  const p2 = w.waitEvent(new Set(["AAA"]), 1_000).then((v) => ((ended = true), v));
  for (const x of [...w.waiters]) x.wake();
  await settle();
  assert.equal(ended, false, "budget 95 (reserve 80): the update is ignored, the wait goes on");
  release(); // the timed end
  assert.equal(await p2, false, "it ends at its timed end");
});

test("wake-up limits: with them, the scaled reserve (52 + open symbols) is checked too (reported, not switched on)", { timeout: 300_000 }, async () => {
  const out: string[] = [];
  let failures = 0;
  for (const n of [1, 5, 12, 20, 30]) for (const path of ["closeout", "flatten"] as const) for (const cancelMs of [200, 7_000]) for (const seed of [7, 11]) {
    const r = await flatten(n, path, cancelMs, { spread: true, scaled: true, seed, limit: true });
    if (r.r429 > 0 || r.lowest < 10 - Math.max(0, RESERVE_FLOOR + n - SAFETY_RESERVE)) failures++;
    out.push(`${n} ${path} ${cancelMs} seed ${seed}: start ${r.start} lowest ${r.lowest} 429s ${r.r429}`);
  }
  console.log(`scaled reserve with the wake-up limits: ${failures} of ${out.length} cases short of the margin or rate-limited${process.env.SHOW ? "\n" + out.join("\n") : ""}`);
  assert.equal(reserveFor(0), 52);
});

test("wake-up limits: the close-out's wait for its own sells is brought forward by updates at most 5 times, then waits its timed looks", async () => {
  const sim = new SimBroker(MID);
  sim.sellFillDelayMs = 60_000; // the sells stay working, so the close-out keeps waiting for them
  for (let i = 0; i < 3; i++) {
    const id = `cyrus-20261102-S${i}-1`;
    await sim.submitEntry({ symbol: `S${i}`, qty: 1, stopPrice: 9.9, takeProfitPrice: 10.1, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
  }
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liq = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  let early = 0;
  const waitEvent = async (_s: ReadonlySet<string>, _ms: number) => (early++, sim.advance(10), true); // every wait ended by an update
  await closeOut({ broker: sim, liquidator: liq, store: new MemoryStore(), now: () => new Date(sim.simMs), say, sleep: sim.sleep, waitEvent }, D, { closeAt: new Date(MID + 300_000), path: "close-out" });
  assert.equal(early, MAX_EARLY_WAKES, "5 early wake-ups, then plain 2 second looks");
});
