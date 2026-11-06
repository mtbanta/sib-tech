// Release 11: a rehearsal of a load window at Michael's 150 orders a minute ceiling (ruling of 2026-11-06), on the simulated broker
// with Alpaca's bucket (200, refilling at 200 a minute), the governor reading what is left, the scaled reserve, limit entries cancelled
// 5 seconds after Alpaca accepts them, and live order updates. It measures what Monday's pass rule looks at; it asserts only the
// safety facts (no rate-limit answer, never above 150, nothing oversold, flat at the end), and prints the rest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/store.ts";
import { reserveFor } from "../src/governor.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig } from "./rig.ts";

test("rehearsal: a load window at 150 orders a minute on the simulated broker", { timeout: 600_000 }, async () => {
  const OPEN_MS = Date.UTC(2026, 10, 2, 14, 30);
  const { CachingStore } = await import("../src/caching-store.ts");
  const mem = new MemoryStore();
  let nowMs = OPEN_MS - 3600_000;
  const store = new CachingStore(mem, () => nowMs, { controlTtlMs: 1_500, dayTtlMs: 2_000 });
  const sim = new SimBroker(nowMs);
  sim.bucketOn = false; // the evening and the morning do not count
  const symbols = Array.from({ length: 30 }, (_, i) => `S${String(i).padStart(2, "0")}`);
  const r = rig<SimBroker, InstanceType<typeof CachingStore>>({ broker: sim, store, sleep: sim.sleep, liveList: symbols, orderStream: true });
  sim.onRate = (remaining) => r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining, reset: null });
  const entryTimes: number[] = [];
  const realSubmit = sim.submitEntry.bind(sim);
  const working = new Map<string, { id: string; limit: number; at: number }>();
  sim.submitEntry = async (e) => {
    const o = await realSubmit(e);
    entryTimes.push(nowMs);
    working.set(e.symbol, { id: e.clientOrderId, limit: e.limitPrice ?? e.referencePrice, at: nowMs });
    return o;
  };
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("load on\nposition 400\nloss 5000\ntrades 150\ncap 1", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  assert.equal((await mem.getDay(D))!.limits.maxTradesPerMinute, 150);
  await r.at("13:45:00");
  sim.clockOpen = true;
  await r.at("14:25:00");
  assert.ok((await mem.getDay(D))!.phases.armed);
  sim.bucketOn = true;
  sim.tokens = 200;
  let seed = 7;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const price = symbols.map((_, i) => 10 + i * 0.5);
  const live = new Map<string, { id: string; tp: number; stop: number }>();
  let lastTick = 0;
  let minMargin = Infinity; // Alpaca's remaining minus the reserve in force, at its lowest
  let minMarginAt = 0;
  const marginByMinute = new Map<number, number>();
  const step = 60; // a print every 60 ms over the 30 names (about 2 a second each)
  for (let t = OPEN_MS + 14 * 60_000; t < OPEN_MS + 31 * 60_000; t += step) {
    nowMs = t;
    sim.advanceTo(t);
    r.setNow(new Date(t).toISOString()); // timers: the entry wait, the syncs brought forward
    const margin = sim.tokens - r.governor.reserve();
    if (margin < minMargin) { minMargin = margin; minMarginAt = t; }
    const m = Math.floor((t - OPEN_MS - 15 * 60_000) / 60_000);
    marginByMinute.set(m, Math.min(marginByMinute.get(m) ?? Infinity, margin));
    const i = Math.floor(rng() * symbols.length);
    const sym = symbols[i]!;
    price[i] = Math.round((price[i]! + (rng() < 0.5 ? -0.01 : 0.01)) * 100) / 100;
    sim.prices.set(sym, price[i]!);
    if (t - lastTick >= 5_000) { lastTick = t; await r.at(new Date(t).toISOString()); }
    await r.trade(sym, price[i]!, new Date(t).toISOString());
    // A working limit entry fills when a later print is at or below its limit (at least 0.3 s after it was sent); one the entry wait
    // cancelled is reported cancelled.
    for (const [s, w] of [...working]) {
      const o = sim.orders.find((x) => x.clientOrderId === w.id)!;
      if (o.status === "canceled") {
        working.delete(s);
        for (const l of o.legs) l.status = "canceled";
        await r.orderUpdate({ event: "canceled", order: { ...structuredClone(o), legs: [] }, positionQty: null, atMs: t });
      } else if (s === sym && (o.status === "accepted" || o.status === "new") && t - w.at >= 300 && price[i]! <= w.limit) {
        working.delete(s);
        sim.fillEntry(w.id, w.limit);
        live.set(s, { id: w.id, tp: o.legs.find((l) => l.type === "limit")!.limitPrice!, stop: o.legs.find((l) => l.type === "stop")!.stopPrice! });
        await r.orderUpdate({ event: "fill", order: { ...structuredClone(o), filledQty: o.qty, filledAvgPrice: w.limit, status: "filled", legs: [] }, positionQty: o.qty, atMs: t, price: w.limit, fillQty: o.qty });
      }
    }
    const l = live.get(sym);
    if (l && (price[i]! >= l.tp || price[i]! <= l.stop)) {
      const which = price[i]! >= l.tp ? "take_profit" : "stop";
      sim.fillExit(l.id, which, which === "take_profit" ? l.tp : l.stop);
      live.delete(sym);
      const leg = sim.orders.find((x) => x.clientOrderId === l.id)!.legs.find((x) => x.status === "filled")!;
      await r.orderUpdate({ event: "fill", order: structuredClone(leg), positionQty: sim.heldQty(sym), atMs: t, price: leg.filledAvgPrice, fillQty: leg.filledQty });
    }
  }
  const W0 = OPEN_MS + 15 * 60_000, W1 = OPEN_MS + 30 * 60_000;
  const inWindow = entryTimes.filter((x) => x >= W0 && x < W1);
  const perMin = Array.from({ length: 15 }, (_, m) => inWindow.filter((x) => x >= W0 + m * 60_000 && x < W0 + (m + 1) * 60_000).length);
  let maxRequests = 0;
  for (let i = 0, j = 0; i < sim.bucketTimes.length; i++) { while (sim.bucketTimes[i]! - sim.bucketTimes[j]! >= 60_000) j++; if (sim.bucketTimes[i]! >= W0 && sim.bucketTimes[i]! < W1) maxRequests = Math.max(maxRequests, i - j + 1); }
  let best = 0;
  for (let i = 0, j = 0; i < inWindow.length; i++) { while (inWindow[i]! - inWindow[j]! >= 60_000) j++; best = Math.max(best, i - j + 1); }
  const incomplete = mem.events.filter((e) => e.event === "order_list_incomplete").length;
  const held = (await mem.listRefusals(D)).filter((x) => /holding back for safety/.test(x.reason)).reduce((n, x) => n + (typeof x.detail?.count === "number" ? (x.detail.count as number) : 1), 0);
  const filled = sim.orders.filter((o) => o.clientOrderId.startsWith("cyrus-2") && o.filledQty > 0 && Date.parse(o.createdAt ?? "") >= W0 && Date.parse(o.createdAt ?? "") < W1).length;
  console.log(JSON.stringify({ accepted: inWindow.length, perMinute: perMin, busiest60s: best, filled, maxRequests60s: maxRequests, lowestLeft: Math.floor(sim.lowestTokens), minRemainingMinusReserve: Math.floor(minMargin), at: new Date(minMarginAt).toISOString(), marginByMinute: [...marginByMinute].filter(([m]) => m >= 0 && m < 15).map(([, v]) => Math.floor(v)), governorLowestAboveReserve: r.governor.stats().lowestAboveReserve, reserveNow: r.governor.reserve(), reserveAt30: reserveFor(30), heldBackByGovernor: held, rateLimited: sim.rejected429, syncListIncomplete: incomplete, oversell: sim.oversellAttempts }));
  assert.equal(sim.rejected429, 0, "no rate-limit answer");
  assert.ok(best <= 150, "never above 150 in any 60 seconds");
  assert.equal(sim.oversellAttempts, 0);
});
