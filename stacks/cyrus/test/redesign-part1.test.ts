// The redesign of 2026-11-14, part 1: the shared request budget (request-budget.ts), the scope that says who asked (request-scope.ts), and
// where the worker uses them (Michael's approval of 2026-11-14 with his changes A and B; builds/c2-redesign-2026-11-14.md, sections 3 and 10).
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGET_PER_5S, BUDGET_PER_MINUTE, GIVE_WAY_MAX_MS, P1_FLOOR, P1_KEEP, P2_FLOOR, Reservation, RequestBudget, withReservation } from "../src/request-budget.ts";
import { currentTag, inRequestScope, outsideScope, requestScope, retryAllowedInScope } from "../src/request-scope.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SAFETY_RESERVE } from "../src/governor.ts";
import { SimBroker } from "./sim-broker.ts";
import { FakeBroker } from "./helpers.ts";
import { D, rig } from "./rig.ts";

const granted = (r: unknown): r is Reservation => r instanceof Reservation;
const sendN = (r: Reservation, n: number) => {
  for (let i = 0; i < n; i++) r.charge("/v2/orders");
};

// ---------------- the budget's rules ----------------

test("part 1: the sizes Michael approved (decisions 1, 2 and change A)", () => {
  assert.deepEqual([BUDGET_PER_MINUTE, BUDGET_PER_5S, P1_KEEP, P1_FLOOR, P2_FLOOR], [60, 15, 20, 20, SAFETY_RESERVE]);
  assert.equal(P2_FLOOR, 80);
});

test("part 1: the minute and the 5 seconds count what was sent plus what running tries still hold; a try's unused room is released when it ends", () => {
  let t = 0;
  const b = new RequestBudget({ now: () => t });
  const a = b.tryReserve("P1", 15, { label: "a" });
  assert.ok(granted(a));
  assert.ok(!granted(b.tryReserve("P1", 1, { label: "b" })), "15 held in the 5 seconds: nothing more");
  sendN(a, 4);
  a.end();
  assert.deepEqual(b.inUse(), { minute: 4, five: 4, reservedUnsent: 0, open: 0 });
  const c = b.tryReserve("P1", 11, { label: "c" }) as Reservation;
  assert.ok(granted(c), "4 sent + 11 = 15: fits");
  t = 5_000;
  assert.ok(!granted(b.tryReserve("P1", 5, { label: "d" })), "c, still running, holds 11 of the 5 seconds: 11 + 5 > 15");
  assert.ok(granted(b.tryReserve("P1", 4, { label: "d" })), "11 + 4 = 15: fits");
  (b as any).open.clear(); // the tries end without sending (their room released)
  for (let i = 0; i < 3; i++) {
    const r = b.tryReserve("P1", 15, { label: "e" }) as Reservation;
    assert.ok(granted(r), `minute room ${i}`);
    sendN(r, 15);
    r.end();
    t += 5_000;
  }
  // 4 + 45 sent: 11 left in the minute
  const full = b.tryReserve("P1", 12, { label: "f" });
  assert.ok(!granted(full) && full.why === "minute");
  assert.ok(granted(b.tryReserve("P1", 11, { label: "g" })));
});

test("part 1: P2 may draw only while it leaves 20 of the minute for P1 (decision 2); P1 may use the whole minute", () => {
  let t = 0;
  const b = new RequestBudget({ now: () => t });
  for (let i = 0; i < 4; i++) {
    const r = b.tryReserve("P2", 10, { label: "recheck" }) as Reservation;
    assert.ok(granted(r), `P2 try ${i}`);
    sendN(r, 10);
    r.end();
    t += 5_000;
  }
  const p2 = b.tryReserve("P2", 1, { label: "recheck" });
  assert.ok(!granted(p2) && p2.why === "class", "40 used: P2 stops (20 kept for P1)");
  const p1 = b.tryReserve("P1", 15, { label: "stuck" });
  assert.ok(granted(p1), "P1 still has its 20");
});

test("part 1 (change A): P1 tries start only while 20 stay after them; P2 tries while 80 stay; each refusal says when room returns", () => {
  let t = 0;
  let remaining = 95;
  const b = new RequestBudget({ now: () => t, remaining: () => remaining });
  assert.ok(granted(b.tryReserve("P2", 15, { label: "x" })), "95 - 15 = 80: P2 at its floor");
  (b as any).open.clear();
  remaining = 94;
  const p2 = b.tryReserve("P2", 15, { label: "x" });
  assert.ok(!granted(p2) && p2.why === "floor");
  assert.equal(p2.at, 300, "1 short of the floor: about 0.3 s of Alpaca's refill (3.3 a second)");
  remaining = 34;
  const p1 = b.tryReserve("P1", 15, { label: "x" });
  assert.ok(!granted(p1) && p1.why === "floor", "34 - 15 = 19: below P1's floor");
  remaining = 35;
  assert.ok(granted(b.tryReserve("P1", 15, { label: "x" })), "35 - 15 = 20: P1 at its floor");
});

test("part 1: room another running try holds counts against the floor too", () => {
  const b = new RequestBudget({ now: () => 0, remaining: () => 60 });
  assert.ok(granted(b.tryReserve("P1", 15, { label: "a", fiveSec: false })), "60 - 15 = 45");
  assert.ok(granted(b.tryReserve("P1", 15, { label: "b", fiveSec: false })), "60 - 15 held - 15 = 30");
  const c = b.tryReserve("P1", 15, { label: "c", fiveSec: false });
  assert.ok(!granted(c) && c.why === "floor", "60 - 30 held - 15 = 15: below the floor of 20");
});

test("part 1: a close-out retry reserves against the minute only; others against both", () => {
  const b = new RequestBudget({ now: () => 0 });
  assert.ok(granted(b.tryReserve("P1", 40, { label: "close-out retry", fiveSec: false })), "40 fits the minute; the 5 seconds do not apply");
  assert.ok(!granted(b.tryReserve("P1", 16, { label: "stuck" })), "16 never fits 15 in 5 seconds");
});

test("part 1 (change B): a forced try is granted whatever the room, and counted", () => {
  let t = 0;
  const b = new RequestBudget({ now: () => t, remaining: () => 0 });
  const r = b.tryReserve("P1", 60, { label: "close-out retry", fiveSec: false, force: true });
  assert.ok(granted(r));
  sendN(r as Reservation, 70);
  (r as Reservation).end();
  const m = b.takeMinute();
  assert.equal(m.forced, 1);
  assert.equal(m.overdrafts, 10, "10 beyond its 60 reserved");
  assert.equal(b.totals.P1, 70);
});

test("part 1: a try that sends more than it reserved is never stopped; the extra is counted, logged once, and later tries wait for it", () => {
  let t = 0;
  const logs: string[] = [];
  const b = new RequestBudget({ now: () => t, log: (e) => void logs.push(e) });
  const r = b.tryReserve("P1", 5, { label: "stuck" }) as Reservation;
  sendN(r, 8);
  r.end();
  assert.equal(logs.filter((e) => e === "budget_overdraft").length, 1);
  assert.equal(b.inUse().five, 8);
  assert.ok(!granted(b.tryReserve("P1", 8, { label: "next" })), "8 + 8 > 15");
  assert.ok(granted(b.tryReserve("P1", 7, { label: "next" })));
});

test("part 1: a request sent after its try ended is still counted, and logged", () => {
  const logs: string[] = [];
  const b = new RequestBudget({ now: () => 0, log: (e) => void logs.push(e) });
  const r = b.tryReserve("P2", 2, { label: "x" }) as Reservation;
  r.end();
  r.charge("/v2/orders");
  assert.equal(b.totals.P2, 1);
  assert.ok(logs.includes("budget_sent_after_end"));
});

test("part 1: the clock and the calendar (a separate Alpaca bucket) are never charged", () => {
  const b = new RequestBudget({ now: () => 0 });
  const r = b.tryReserve("P1", 2, { label: "x" }) as Reservation;
  r.charge("/v2/clock");
  r.charge("/v2/calendar");
  assert.equal(b.totals.P1, 0);
  b.onSend("/v2/clock");
  assert.equal(b.takeMinute().sent.clock, 1);
});

test("part 1: a refusal's time is when enough of the oldest requests leave the window", () => {
  let t = 0;
  const b = new RequestBudget({ now: () => t });
  const a = b.tryReserve("P1", 10, { label: "a" }) as Reservation;
  sendN(a, 10);
  a.end();
  t = 1_000;
  const r = b.tryReserve("P1", 10, { label: "b" });
  assert.ok(!granted(r) && r.why === "five" && r.at === 5_000, JSON.stringify(r));
  t = 5_000;
  assert.ok(granted(b.tryReserve("P1", 10, { label: "b" })));
});

test("part 1: a first try's counter is never refused and not part of the budgeted minute", () => {
  const b = new RequestBudget({ now: () => 0, remaining: () => 0 });
  const f = b.first("close-out");
  sendN(f, 100);
  assert.equal(f.used, 100);
  assert.equal(b.totals.P1 + b.totals.P2, 0);
  assert.ok(granted(b.tryReserve("P1", 0, { label: "x", force: true })));
});

test("part 1 (decision 5 with change A): the give-way lapses GIVE_WAY_MAX_MS after the last floor refusal, or when the try is granted", () => {
  let t = 0;
  let remaining = 82;
  const b = new RequestBudget({ now: () => t, remaining: () => remaining });
  assert.equal(b.givingWay(), false);
  b.tryReserve("P2", 5, { label: "recheck", waitKey: "k" });
  assert.equal(b.givingWay(), true);
  remaining = 200;
  assert.ok(granted(b.tryReserve("P2", 5, { label: "recheck", waitKey: "k" })));
  assert.equal(b.givingWay(), false, "granted: no longer waiting");
  remaining = 82;
  b.tryReserve("P2", 5, { label: "recheck", waitKey: "k" });
  t += GIVE_WAY_MAX_MS;
  assert.equal(b.givingWay(), false, "lapsed");
  b.tryReserve("P1", 70, { label: "x", waitKey: "p1" });
  assert.equal(b.givingWay(), false, "a P1 refusal never makes entries give way");
});

// ---------------- who is asking ----------------

test("part 1: the tag follows a call through the sell gate's and the liquidator's one-at-a-time queues, and each try's requests go to its own reservation", async () => {
  const broker = new FakeBroker();
  broker.clock = { ...broker.clock, isOpen: true };
  broker.positions = [{ symbol: "AAA", qty: 5, marketValue: 500, avgEntryPrice: 100, unrealizedPl: 0 }, { symbol: "BBB", qty: 5, marketValue: 500, avgEntryPrice: 100, unrealizedPl: 0 }];
  const seen: string[] = [];
  broker.onSend = (path) => void (path.startsWith("/v2/clock") || seen.push(currentTag()));
  const gate = new SellGate({ broker, say: async () => true });
  const liquidator = new Liquidator({ broker, gate, now: () => new Date(0), sleep: async () => undefined });
  const b = new RequestBudget({ now: () => 0 });
  const p1 = b.tryReserve("P1", 60, { label: "a", fiveSec: false }) as Reservation;
  const first = b.first("b");
  // Two sales started together: the second waits its turn in the liquidator's queue, then runs in its own scope.
  const one = withReservation(p1, () => liquidator.flatten({ reason: "a", tradeDate: D, only: ["AAA"], maxRounds: 1 }));
  const two = withReservation(first, () => liquidator.flatten({ reason: "b", tradeDate: D, only: ["BBB"], maxRounds: 1 }), "first");
  await Promise.all([one, two]);
  assert.ok(p1.used > 0 && first.used > 0);
  assert.equal(seen.filter((x) => x === "P1").length, p1.used, "every P1 request charged once, to the P1 try");
  assert.equal(seen.filter((x) => x === "first").length, first.used, "every first-try request counted once, to the first try");
  assert.equal(seen.filter((x) => x === "routine").length, 0, "nothing escaped its scope");
});

test("part 1: new work started with outsideScope never carries a try's scope, even from a timer set inside it", async () => {
  const b = new RequestBudget({ now: () => 0 });
  const r = b.tryReserve("P2", 2, { label: "x" }) as Reservation;
  let inTimer = "";
  let outside = "";
  await requestScope.run(r.scope(), async () => {
    await new Promise<void>((done) => setTimeout(() => ((inTimer = currentTag()), done()), 0));
    outsideScope(() => void (outside = currentTag()));
  });
  assert.equal(inTimer, "P2", "a plain timer inherits the scope (why the worker starts new work outside it)");
  assert.equal(outside, "routine");
});

test("part 1 (group 1, round 1): the client's own retry is limited only inside a timed-out stop's work, while its reservation has room; never elsewhere", async () => {
  assert.equal(retryAllowedInScope(), true);
  const b = new RequestBudget({ now: () => 0 });
  const r = b.tryReserve("P1", 1, { label: "timed-out stop check", limitRetries: true }) as Reservation;
  await inRequestScope(r.scope(), async () => {
    assert.equal(retryAllowedInScope(), true);
    r.charge("/v2/orders");
    assert.equal(retryAllowedInScope(), false);
  });
  r.end();
  const s = b.tryReserve("P1", 1, { label: "stuck retry" }) as Reservation;
  await inRequestScope(s.scope(), async () => {
    s.charge("/v2/orders");
    assert.equal(retryAllowedInScope(), true, "a stuck retry is never stopped halfway");
  });
  s.end();
  await inRequestScope({ tag: "first" }, async () => assert.equal(retryAllowedInScope(), true));
});

// ---------------- the worker ----------------

test("part 1 (change B): the 2:55 close-out's retry waits for room in the shared budget until 2:58 PM Central, and from then it is never refused", async () => {
  const r = rig();
  await r.at("13:30:00");
  r.broker.clock = { ...r.broker.clock, isOpen: true };
  r.broker.positions = [{ symbol: "AAA", qty: 5, marketValue: 500, avgEntryPrice: 100, unrealizedPl: 0 }];
  await r.store.insertOrder({ clientOrderId: "cyrus-20261102-AAA-1", tradeDate: D, symbol: "AAA", qty: 5, referencePrice: 100, stopPrice: 98.5, status: "submitted", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null });
  r.broker.onSell = async () => {
    throw new Error("rejected (test)");
  };
  await r.at("20:55:00"); // the first try (a first try: never refused)
  const wk: any = r.worker;
  const fill = () => {
    // Something else used the whole minute just now.
    const x = wk.budget.tryReserve("P1", 60, { label: "test: a full minute", fiveSec: false, force: true });
    for (let i = 0; i < 60; i++) x.charge("/v2/test");
    x.end();
  };
  fill();
  const sellsAt = () => r.broker.count("submitSell");
  const before = sellsAt();
  await r.at("20:55:20");
  await r.at("20:55:40");
  assert.equal(sellsAt(), before, "before 2:58: refused while the minute is full (not an attempt)");
  assert.equal(r.broker.count("submitSell"), before);
  r.setNow("2026-11-02T20:57:30.000Z");
  fill(); // the first fill has aged out; the minute is full again
  const at = sellsAt();
  await r.at("20:57:40");
  await r.at("20:57:55");
  assert.equal(sellsAt(), at, "still before 2:58 PM Central (20:58 UTC): refused");
  await r.at("20:58:00");
  assert.ok(sellsAt() > at, "from 2:58 PM Central: never refused");
  assert.ok(wk.budget.takeMinute().forced >= 1);
  r.worker.stop?.();
});

test("part 1: the worker hands its budget to the governor (entries give way) and wires it into its statistics", async () => {
  const r = rig();
  const wk: any = r.worker;
  assert.equal(wk.syncMemory.budget, wk.budget);
  assert.equal(wk.lossMemory.budget, wk.budget);
  assert.equal((r.governor as any).safetyHold, wk.budget);
  const stats = wk.minuteStats();
  assert.ok(stats.requestBudget && "sent" in stats.requestBudget && "refused" in stats.requestBudget, JSON.stringify(stats.requestBudget));
  assert.equal("stuckRetryAllowance" in stats, false, "the old allowance's statistics are gone");
  r.worker.stop?.();
});

// ---------------- the oracle under random faults ----------------

// Stuck sales (refused), remainders whose order list lags, and timed-out stops at once, with random faults on Alpaca's reads, for 5 minutes:
// whatever happens, every request made in a P1 or P2 scope is charged exactly once (the simulated broker counts them by tag), no rate-limit
// answer, no oversell, and the budgeted minute stays within 60 (and 15 in 5 seconds) apart from logged overdrafts.
for (const rate of [0, 0.1, 0.3]) {
  test(`part 1: under random faults (${rate * 100} percent of reads), charges equal the P1 and P2 requests sent, with no rate-limit answer and no oversell`, async () => {
    const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
    const store = new MemoryStore();
    const now = () => new Date(sim.simMs);
    const logs: Array<{ e: string; d: any }> = [];
    const log = (e: string, d?: Record<string, unknown>) => void logs.push({ e, d });
    const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs, log });
    const liquidator = new Liquidator({ broker: sim, gate, now, sleep: sim.sleep, log });
    const memory = new SyncMemory();
    const budget = new RequestBudget({ now: () => sim.simMs, remaining: () => sim.tokens, log });
    memory.budget = budget;
    const tagged: Record<string, number> = { entry: 0, first: 0, P1: 0, P2: 0, routine: 0 };
    const budgetedAt: number[] = []; // the simulated broker's own times of every P1 or P2 request (the oracle's count, section 8)
    sim.onSend = () => {
      const tag = currentTag();
      tagged[tag] = (tagged[tag] ?? 0) + 1;
      if (tag === "P1" || tag === "P2") budgetedAt.push(sim.simMs);
    };
    const sellTags = new Map<string, Array<{ tag: string; at: number }>>(); // per symbol, the tag and time of each sell sent for it
    const realSell = sim.submitSell.bind(sim);
    sim.submitSell = async (x: any) => {
      sellTags.set(x.symbol, [...(sellTags.get(x.symbol) ?? []), { tag: currentTag(), at: sim.simMs }]);
      return realSell(x);
    };
    const firstTryEnd = new Map<string, number>(); // when each stuck entry's first try ended (its stuck record was made)
    let seed = 7 + Math.round(rate * 100);
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (const m of ["listOrdersPaged", "listPositions", "findOrderByClientId", "listOrders"] as const) {
      const real = (sim as any)[m].bind(sim);
      (sim as any)[m] = async (...a: any[]) => {
        if (rnd() < rate) {
          (sim as any).spend("plain");
          throw new Error(`${m} failed (test)`);
        }
        return real(...a);
      };
    }
    const risk: any = { broker: sim, store, now, say: async () => true, liquidator, syncMemory: memory, log, budget, onRemainderSold: () => undefined, onFreshStop: () => undefined };
    await ensureDay({ store, broker: sim, now } as any, D);
    const dd = (await store.getDay(D))!;
    const hold = async (symbol: string, n: number, price: number) => {
      const id = clientOrderIdFor(D, symbol, n);
      await sim.submitEntry({ symbol, qty: 5, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
      sim.fillEntry(id, price);
      await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 5, referencePrice: price, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: price, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
      return id;
    };
    const stuck = ["AAA", "BBB", "CCC"];
    const lagging = ["LUNR", "SMCI", "IREN"];
    const ids: Record<string, string> = {};
    for (const [i, s] of [...stuck, ...lagging].entries()) ids[s] = await hold(s, 1, 10 + i);
    sim.advance(5_000);
    sim.refuseStops = true;
    sim.refuseSellIf = (x) => stuck.includes(x.symbol);
    for (const s of stuck) sim.partialTakeProfit(ids[s]!, 1, 10.08);
    const t0 = sim.simMs;
    for (const [i, s] of lagging.entries()) {
      sim.partialTakeProfitListLag(ids[s]!, 1, 13 + i + 0.08, 8_000 + i * 6_000);
      memory.liveStopCancelled.set(ids[s]!, t0);
    }
    while (sim.simMs < t0 + 5 * 60_000) {
      const lr = memory.lagRecheck;
      let r: any = null;
      try {
        if (lr && sim.simMs >= lr.dueAt && sim.simMs < lr.until) {
          const res = budget.tryReserve("P2", lr.cost, { label: "list lag recheck" });
          if (granted(res)) {
            try {
              r = await withReservation(res, () => syncOrders(risk, dd, { protect: true, streamLive: true }));
            } catch (err) {
              memory.lagRecheck = undefined; // as the worker does after a failed recheck sync
              throw err;
            }
          }
        } else r = await syncOrders(risk, dd, { protect: true, streamLive: true });
        for (const sym of stuck) if (!firstTryEnd.has(sym) && memory.stuck.has(ids[sym]!)) firstTryEnd.set(sym, memory.stuck.get(ids[sym]!)!.since);
      } catch {
        /* a failed sync: the next one comes on time */
      }
      const lr2 = memory.lagRecheck;
      const next = Math.min(r?.recheckAt ?? Infinity, lr2 ? lr2.dueAt : Infinity, sim.simMs + 10_000);
      sim.advanceTo(Math.max(sim.simMs + 100, next));
    }
    const over = logs.filter((x) => x.e === "budget_overdraft").length;
    console.log(`MEASURE faults ${rate}: P1 ${budget.totals.P1} (sent ${tagged.P1}), P2 ${budget.totals.P2} (sent ${tagged.P2}), first ${tagged.first}, routine ${tagged.routine}; most budgeted ${budget.peak.minute} a minute, ${budget.peak.five} in 5 s; overdrafts ${over}; lowest tokens ${Math.floor(sim.lowestTokens)}; rate-limit answers ${sim.rejected429}`);
    assert.equal(budget.totals.P1, tagged.P1, "every P1 request charged once");
    assert.equal(budget.totals.P2, tagged.P2, "every P2 request charged once");
    assert.equal(sim.rejected429, 0);
    assert.equal(sim.oversellAttempts, 0);
    // Section 8's oracle, from the simulated broker's own times: budgeted requests in any 60 s at most 60, and in any 5 s at most 15, apart from
    // requests a try sent beyond its reservation in that same window (an ordinary stuck retry whose sale is refused runs up to 3 rounds,
    // about 26 requests, against the 10 it reserves; design 3.2, Michael's choice pending). Close-out retries do not run here.
    const overIn = (from: number, to: number) => budget.overdraftAt.filter((t) => t >= from && t < to).length;
    let worstMinute = 0;
    let worstFive = 0;
    for (const t of budgetedAt) {
      worstMinute = Math.max(worstMinute, budgetedAt.filter((x) => x >= t && x < t + 60_000).length - overIn(t, t + 60_000));
      worstFive = Math.max(worstFive, budgetedAt.filter((x) => x >= t && x < t + 5_000).length - overIn(t, t + 5_000));
    }
    console.log(`MEASURE faults ${rate}: from the broker's own counts, less the overdrafts in each window: at most ${worstMinute} a minute and ${worstFive} in 5 s`);
    assert.ok(worstMinute <= 60 && worstFive <= 15, `at most ${worstMinute} a minute and ${worstFive} in 5 s beyond the overdrafts`);
    // Every sale of a stuck symbol after its first try ended is a retry: tagged P1, never a first try or routine work (group 1, round 1,
    // mutant M6: retries run unbudgeted, as first tries). Each sale is a first try's or a P1 retry's.
    let retrySales = 0;
    for (const sym of stuck) {
      const sales = sellTags.get(sym) ?? [];
      assert.ok(sales.every((x) => x.tag === "first" || x.tag === "P1"), `${sym}: ${sales.map((x) => x.tag).join(",")}`);
      const end = firstTryEnd.get(sym);
      if (end === undefined) continue;
      const later = sales.filter((x) => x.at > end);
      assert.ok(later.every((x) => x.tag === "P1"), `${sym}: every sale after its first try (${end - t0} ms) is P1: ${sales.map((x) => `${x.tag}@${x.at - t0}`).join(",")}`);
      retrySales += later.length;
    }
    // At 30 percent faults on every read a retry rarely reaches its sale (a try reads about 6 times), so it is required below that only.
    if (rate < 0.3) assert.ok(retrySales > 0, "the stuck sales were retried");
  });
}

// Group 2, round 1 of the redesign: an entry refused while entries give way is counted like the other flow refusals (one row a minute at
// the flush), never one database write per refused signal inside the gate's queue.
test("part 1 (group 2, round 1): entries refused while a P2 recheck waits on its floor are counted in one row at the flush, not written one by one", async () => {
  const { OrderGate } = await import("../src/gate.ts");
  const { BrokerView } = await import("../src/broker-view.ts");
  const { Governor } = await import("../src/governor.ts");
  const store = new MemoryStore();
  const broker = new FakeBroker();
  const now = new Date("2026-11-02T15:30:00Z");
  const say = async () => true;
  await ensureDay({ broker, store, now: () => now, say } as any, D);
  await store.updateDay(D, { status: "approved", decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "2026-11-01T22:10:00.000Z", armed: "2026-11-02T14:25:00.000Z" } } as any);
  const governor = new Governor(() => now.getTime());
  const b = new RequestBudget({ now: () => now.getTime(), remaining: () => 82 });
  governor.setSafetyHold(b);
  b.tryReserve("P2", 5, { label: "list lag recheck", waitKey: "list lag recheck" }); // refused on its floor: waiting
  assert.equal(b.givingWay(), true);
  let writes = 0;
  const realAdd = store.addRefusal.bind(store);
  store.addRefusal = async (x: any) => (writes++, realAdd(x));
  const gate = new OrderGate({ broker, store, view: new BrokerView(broker, () => now.getTime()), governor, now: () => now, say: say as any, note: () => undefined });
  for (let i = 0; i < 10; i++) {
    const r = await gate.enter({ symbol: `S${i}`, price: 50, tradeTime: new Date(now.getTime() - 2_000), stopPrice: 49.25, takeProfitPrice: 50.13 });
    assert.equal(r.status, "refused");
    assert.match((r as any).reason, /^holding back for safety: a recheck is waiting/);
  }
  await gate.settled();
  assert.equal(writes, 0, "no write per refused signal");
  await gate.flush();
  assert.equal(writes, 1, "one counted row at the flush");
  assert.equal(broker.count("submitEntry"), 0);
});

// Group 1, round 1 of the redesign (mutant M2): work the worker starts in the background (the order sync, the close-outs) starts outside
// any scope, even when it is started from inside a budgeted try (for example a timer set during one).
test("part 1 (group 1, round 1, M2): the worker's background work starts outside any scope, even when started from inside a try", async () => {
  const r = rig();
  const wk: any = r.worker;
  const b = new RequestBudget({ now: () => 0 });
  const res = b.tryReserve("P2", 2, { label: "list lag recheck" }) as Reservation;
  let tag = "";
  await requestScope.run(res.scope(), async () => {
    let done!: () => void;
    const finished = new Promise<void>((x) => (done = x));
    wk.background("test-task", async () => {
      tag = currentTag();
      done();
    });
    await finished;
  });
  res.end();
  assert.equal(tag, "routine", "the background task did not inherit the P2 scope");
  r.worker.stop?.();
});
