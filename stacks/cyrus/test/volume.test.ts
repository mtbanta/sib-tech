// THE HIGH-VOLUME REHEARSAL. A whole simulated session through the real scheduler, with the broker simulated in code
// (test/sim-broker.ts: slow cancels, linked exits, a 200-request bucket, a 500-row order list), driven by a recorded
// input: a fixed sample of the first hour of IEX trades on 2026-11-02 for the 20 live-list names, replayed six times
// across the session at six times the speed. It checks, at full volume: the trades-a-minute cap holds, the stop
// command and the close-out still get through, no false "no live protective stop" alert, no sell above a position,
// the order list is read past 500 orders, fees and speed are in the summary, and the account ends flat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CachingStore } from "../src/caching-store.ts";
import { CONTROL_STOP, MemoryStore, type StopFlag } from "../src/store.ts";
import { FakeBot } from "./helpers.ts";
import { D, rig, settle } from "./rig.ts";
import { SimBroker } from "./sim-broker.ts";

const fx = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/iex-2026-11-02-sample.json"), "utf8")) as { symbols: string[]; trades: Array<[number, number, number]> };
const OPEN_MS = Date.UTC(2026, 10, 2, 14, 30);
const CLOSE_MS = Date.UTC(2026, 10, 2, 21, 0);
const PRICE_SHIFT = [1, 1.004, 0.997, 1.002, 0.995, 1.003];

interface Print {
  sym: string;
  t: number;
  px: number;
}

// The recorded hour, replayed `hours` times across the session at `speed` times the speed, with a small fixed price shift each time.
function* fixtureSource(hours: number, speed: number): Generator<Print> {
  for (let h = 0; h < hours; h++) {
    for (const [i, off, price] of fx.trades) yield { sym: fx.symbols[i]!, t: OPEN_MS + h * 3600_000 + Math.floor(off / speed), px: Math.round(price * PRICE_SHIFT[h % PRICE_SHIFT.length]! * 100) / 100 };
  }
}

// A busy synthetic market: `names` made-up symbols, ten prints a second spread over them, random-walk prices from a fixed seed.
function* syntheticSource(names: number, minutes: number): Generator<Print> {
  let seed = 123456789;
  const rng = () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const price = Array.from({ length: names }, (_, i) => 20 + (i % 40));
  for (let t = OPEN_MS; t < OPEN_MS + minutes * 60_000; t += 100) {
    const i = Math.floor(rng() * names);
    price[i] = Math.max(5, price[i]! * (1 + (rng() - 0.5) * 0.006));
    yield { sym: `S${String(i).padStart(3, "0")}`, t, px: Math.round(price[i]! * 100) / 100 };
  }
}

interface Run {
  r: ReturnType<typeof rig<SimBroker, CachingStore>>;
  sim: SimBroker;
  entryTimes: number[];
  bot: FakeBot;
  mem: MemoryStore;
  stopAt: number | null;
  stopRefusedAfter: number;
}

async function runDay(opts: { tradesPerMinute: number; source: () => Generator<Print>; liveList: string[]; stopAtMs?: number | null; midday?: boolean }): Promise<Run> {
  const mem = new MemoryStore();
  const store = new CachingStore(mem, () => nowMs, { controlTtlMs: 1_500, dayTtlMs: 2_000 });
  const sim = new SimBroker(OPEN_MS - 3600_000);
  let nowMs = OPEN_MS - 3600_000;
  const bot = new FakeBot();
  const r = rig<SimBroker, CachingStore>({ broker: sim, store, bot, sleep: sim.sleep, liveList: opts.liveList, ...(opts.midday === false ? { midday: false } : {}) });
  const entryTimes: number[] = [];
  const realSubmit = sim.submitEntry.bind(sim);
  const pending = new Map<string, string>(); // symbol -> client order id waiting to fill
  sim.submitEntry = async (e) => { entryTimes.push(nowMs); const o = await realSubmit(e); pending.set(e.symbol, e.clientOrderId); return o; };

  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays(`position 400\nloss 5000\ntrades ${opts.tradesPerMinute}\ncap 1`, "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  assert.equal((await mem.getDay(D))!.status, "approved", "four commands in one message decided all four limits");
  await r.at("13:45:00");
  sim.clockOpen = true;
  await r.at("14:25:00");
  assert.ok((await mem.getDay(D))!.phases.armed);

  let lastTick = 0;
  let stopAt: number | null = null;
  let stopRefusedAfter = 0;
  const stopAtMs = opts.stopAtMs ?? null;
  let stopDone = false;
  let resumed = false;
  const live = new Map<string, { id: string; tp: number; stop: number; qty: number }>(); // filled entries by symbol
  for (const { sym, t, px } of opts.source()) {
    if (t >= CLOSE_MS - 6 * 60_000) break;
    nowMs = t;
    sim.advanceTo(t);
    sim.prices.set(sym, px);
    if (t - lastTick >= 5_000) {
      lastTick = t;
      if (stopAtMs !== null && !stopDone && t >= stopAtMs) {
        stopDone = true;
        stopAt = t;
        r.ownerSays("status\nstop", new Date(t).toISOString());
      }
      if (stopDone && !resumed && t >= (stopAt ?? 0) + 120_000) {
        resumed = true;
        r.ownerSays("resume", new Date(t).toISOString());
      }
      await r.at(new Date(t).toISOString());
      if (stopDone && !resumed) {
        const flag = await mem.getControl<StopFlag>(CONTROL_STOP);
        assert.equal(flag?.on, true, "the stop command got through at full volume");
      }
    }
    await r.trade(sym, px, new Date(t).toISOString());
    // the simulated market: a waiting entry fills on the next print of its name; an exit fires when the print crosses it
    const w = pending.get(sym);
    if (w) {
      pending.delete(sym);
      const o = sim.orders.find((x) => x.clientOrderId === w)!;
      if (o.status === "accepted" || o.status === "new") {
        sim.fillEntry(w, px);
        live.set(sym, { id: w, tp: o.legs.find((l) => l.type === "limit")!.limitPrice!, stop: o.legs.find((l) => l.type === "stop")!.stopPrice!, qty: o.qty });
      }
    } else {
      const l = live.get(sym);
      if (l) {
        if (px >= l.tp) { sim.fillExit(l.id, "take_profit", l.tp); live.delete(sym); }
        else if (px <= l.stop) { sim.fillExit(l.id, "stop", l.stop); live.delete(sym); }
      }
    }
    if (stopDone && !resumed) stopRefusedAfter = entryTimes.filter((x) => x > (stopAt ?? Infinity)).length;
  }
  // the close-out, the summary, and the evening after
  for (const iso of ["20:50:00", "20:55:00", "20:55:20", "20:55:40", "20:56:10", "21:05:30", "21:10:30"]) {
    nowMs = Date.parse(`2026-11-02T${iso}Z`);
    sim.advanceTo(nowMs);
    await r.at(iso);
  }
  return { r, sim, entryTimes, bot, mem, stopAt, stopRefusedAfter };
}

const busiestMinute = (times: number[]) => {
  let best = 0;
  for (let i = 0, j = 0; i < times.length; i++) {
    while (times[i]! - times[j]! >= 60_000) j++;
    best = Math.max(best, i - j + 1);
  }
  return best;
};

test("high-volume rehearsal: a cap of 30 orders a minute, a stop command in the middle, and the close-out, all at full volume", { timeout: 300_000 }, async () => {
  const t = await runDay({ tradesPerMinute: 30, source: () => fixtureSource(6, 6), liveList: fx.symbols, stopAtMs: OPEN_MS + 2 * 3600_000, midday: false }); // the mid-day cycle (on in production) would sell at 10:30 CT; it is tested in midday.test.ts
  const { sim, entryTimes, r, mem } = t;
  const entries = entryTimes.length;
  console.log(`rehearsal: ${entries} entries, busiest minute ${busiestMinute(entryTimes)}, ${sim.requests} requests, ${sim.rejected429} rate-limit refusals, ${sim.sellLog.length} sells`);
  assert.ok(entries > 500, `the day must go past 500 orders to prove the order list is read in pages (got ${entries})`);
  assert.ok(busiestMinute(entryTimes) <= 30, "the governor holds the cap");
  assert.ok(busiestMinute(entryTimes) >= 20, "and the day was busy enough for the cap to matter");
  // stop, protective stops and the close-out got through
  assert.ok(t.stopAt !== null);
  assert.equal(t.stopRefusedAfter, 0, "no entry was sent while the stop was on");
  assert.ok((await mem.listRefusals(D)).some((x) => x.reason === "stop flag is set"), "and entries that were signalled meanwhile were refused for that reason");
  assert.equal(sim.oversellAttempts, 0, "no sell was ever larger than the position");
  const pos = await sim.listPositions();
  assert.equal(pos.length, 0, "the account ends flat");
  assert.equal(((await mem.getControl<{ on: boolean }>("not_flat")) ?? { on: false }).on, false);
  const alerts = r.said("alerts");
  assert.ok(!alerts.some((a) => a.includes("confirm a live protective stop")), "no false protective-stop alert");
  assert.ok(!alerts.some((a) => a.includes("NOT FLAT")));
  assert.ok(r.said("trading").some((x) => x.includes("Close-out done: the account is flat")));
  // every entry carried both exits at the broker
  assert.ok(sim.orders.filter((o) => o.side === "buy").every((o) => o.legs.length === 2));
  // the order sync kept up beyond 500 orders: nothing stayed unreconciled
  const rows = await mem.listOrders(D);
  assert.ok(rows.length > 500);
  assert.equal(rows.filter((x) => x.status === "intent").length, 0, "every entry was reconciled with Alpaca");
  assert.ok(rows.filter((x) => x.closedAt).length > rows.length * 0.8, "closed positions were marked closed, so the sync stayed small");
  // Discord: no message per trade, and it never held up the gate
  assert.ok(r.said("trading").length < entries / 5, `trade news arrives in batches (${r.said("trading").length} messages for ${entries} entries)`);
  // the summary
  const summary = r.said("trading").find((x) => x.includes("Daily summary"))!;
  assert.ok(summary, "the summary was posted");
  for (const w of ["Trades:", "Speed (decision to Alpaca accepting", "typical", "slowest", "Estimated regulatory fees", "Running total", "Alpaca requests", "End of day: flat"]) assert.ok(summary.includes(w), w);
  assert.ok(summary.length < 2000, "and it fits in one Discord message");
  // the run log recorded the day
  assert.ok(mem.events.some((e) => e.event === "closeout_result"));
  assert.ok(mem.events.some((e) => e.event === "governor_stats"));
});

test("high-volume rehearsal at the ceiling: 100 orders a minute never exceeded, and safety work still has room", { timeout: 300_000 }, async () => {
  const t = await runDay({ tradesPerMinute: 100, source: () => syntheticSource(300, 70), liveList: Array.from({ length: 300 }, (_, i) => `S${String(i).padStart(3, "0")}`) });
  console.log(`ceiling rehearsal: ${t.entryTimes.length} entries, busiest minute ${busiestMinute(t.entryTimes)}, lowest request budget ${Math.floor(t.sim.lowestTokens)}, rate-limit refusals ${t.sim.rejected429}`);
  assert.ok(busiestMinute(t.entryTimes) <= 100, "never above the fixed ceiling");
  assert.ok(busiestMinute(t.entryTimes) >= 40, "and the day was busy (the gate counts every entry the account view does not show yet as exposure, so the borrowing cap, not the order cap, is what limits it here)");
  assert.ok(t.sim.lowestTokens >= 40, "Alpaca's request budget was never run dry by trading: the reserve for safety work held");
  assert.equal(t.sim.oversellAttempts, 0);
  assert.equal((await t.sim.listPositions()).length, 0, "flat at the end even at the ceiling");
  assert.ok(!t.r.said("alerts").some((a) => a.includes("confirm a live protective stop")));
});
