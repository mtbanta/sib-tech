// The speed release of 2026-11-16, item 3c (Michael's ruling 5: "Item 3c: all four stuck-retry items"; builds/c2-proposal-stuck-retry-cost.md,
// items 1 to 4). Item 4: the low-priority hold ends as soon as the stuck retry it was set for gets in (or its stuck record resolves), and
// with several retries waiting, one getting in keeps the hold for the others. Item 3: fair turns among stuck positions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { STUCK_RETRY_MINUTE_CAP, SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { RequestBudget, Reservation, withReservation } from "../src/request-budget.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, settle } from "./rig.ts";
import { FakeBot } from "./helpers.ts";

const CAP = STUCK_RETRY_MINUTE_CAP;
const iso = (ms: number) => new Date(ms).toISOString();

// The worker with `n` positions whose exits are gone and whose shares Alpaca keeps holding (`hidden`: reported not free with no open order
// to explain it, as on 2026-11-09) or whose every sale Alpaca refuses (`refused`), for `minutes`, with steady low-priority demand when `p2`
// (a P2 try of 3 requests asked every half second). Alpaca's live remaining reaches the governor, as main.ts wires it. Returns each position's
// try times (the start of each of its sales) and the order of all tries.
export async function stuckWorld(o: { n: number; minutes: number; p2: boolean; shape: "hidden" | "refused"; stream?: boolean; quietMs?: number; onStep?: (x: { sim: SimBroker; r: any; wk: any; tMs: number }) => void }) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const holds: Array<{ until: number; res: () => void }> = [];
  let timed = false;
  const tsleep = (ms: number): Promise<void> => (timed ? new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res })) : sim.sleep(ms));
  const r: any = rig<SimBroker>({ broker: sim, sleep: tsleep, simClock: sim, bot, orderStream: o.stream === true });
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
  const syms = Array.from({ length: o.n }, (_, i) => "QX" + String.fromCharCode(65 + i));
  for (const s of syms) {
    const id = clientOrderIdFor(D, s, 1);
    await sim.submitEntry({ symbol: s, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
    sim.fillEntry(id, 12);
    await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: s, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  }
  await r.at("15:00:01");
  for (const s of syms) for (const l of sim.orders.find((x: any) => x.clientOrderId === clientOrderIdFor(D, s, 1))!.legs) await sim.cancelOrder(l.id);
  if (o.shape === "refused") sim.refuseSellIf = (x: any) => syms.includes(x.symbol);
  else for (const s of syms) sim.staleHeld.set(s, 5);
  const tries = new Map<string, number[]>();
  const order: string[] = [];
  const liq: any = wk.liquidator;
  const realRun = liq.run.bind(liq);
  liq.run = (x: any) => {
    if (x.ownEntryOnly && x.only?.length === 1) {
      tries.set(x.only[0], [...(tries.get(x.only[0]) ?? []), sim.simMs]);
      order.push(x.only[0]);
    }
    return realRun(x);
  };
  timed = true;
  const r429 = sim.rejected429;
  const start = sim.simMs;
  const end = start + o.minutes * 60_000;
  let nextPass = start + 5_000;
  let nextTimed = start + 1_000;
  let nextP2 = start + 500;
  while (sim.simMs < end) {
    if (sim.simMs >= nextPass) {
      void r.at(iso(sim.simMs));
      nextPass += 5_000;
    } else r.setNow(iso(sim.simMs + 100));
    if (sim.simMs >= nextTimed) {
      nextTimed += 1_000;
      void wk.timedTick();
    }
    if (o.p2 && sim.simMs >= nextP2) {
      nextP2 += 500;
      const res = wk.budget.tryReserve("P2", 3, { label: "test low-priority load" });
      if (res instanceof Reservation)
        void withReservation(res, async () => {
          for (let i = 0; i < 3; i++) await sim.listPositions();
        }).catch(() => undefined);
    }
    for (const h of holds.filter((h) => h.until <= sim.simMs)) {
      holds.splice(holds.indexOf(h), 1);
      h.res();
    }
    o.onStep?.({ sim, r, wk, tMs: sim.simMs - start });
    await settle();
  }
  timed = false;
  for (const h of holds.splice(0)) h.res();
  wk.stop?.();
  // From each position's first retry on (its first try is three rounds, counted, never refused).
  const gaps = syms.map((s) => {
    const t = tries.get(s) ?? [];
    return t.slice(1).map((x, i) => x - t[i]!).slice(1);
  });
  const all = gaps.flat();
  return { syms, tries, order, gaps, longest: Math.max(...all), mean: all.reduce((a, b) => a + b, 0) / all.length, rateLimited: sim.rejected429 - r429, oversell: sim.oversellAttempts, wk, sim };
}

// P2 sends `n` requests, one a second from `fromMs`, outside the 5 seconds by the time the test looks.
function p2Minute(b: RequestBudget, clock: { t: number }, n: number, fromMs = 0): void {
  for (let i = 0; i < n; i++) {
    clock.t = fromMs + i * 1_000;
    const r = b.tryReserve("P2", 1, { label: "list lag recheck", fiveSec: false }) as Reservation;
    assert.ok(r instanceof Reservation, `P2 ${i} granted`);
    r.charge("/v2/test");
    r.end();
  }
}

// ---------------- item 4: the hold ends when its retry gets in ----------------

test("item 4: a stuck retry that gets in ends the hold at once (P2 has its 40 back), and the hold's time in force stops then", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p2Minute(b, clock, 34);
  clock.t = 40_000;
  // P2 takes 4 more in the minute: 38 of 60, so a stuck retry of 10 under its 45 does not fit.
  const more = b.tryReserve("P2", 4, { label: "list lag recheck", fiveSec: false }) as Reservation;
  for (let i = 0; i < 4; i++) more.charge("/v2/test");
  more.end();
  b.takeMinute();
  const refused = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "A" });
  assert.ok(!(refused instanceof Reservation) && refused.why === "class");
  assert.ok(b.retryWaitUntil > clock.t, "the hold is set for A");
  assert.ok(!b.roomFor("P2", 1, false).ok, "P2 held at 35 while A waits (38 used)");
  // Room returns for A: P2's requests sent at 0, 1 and 2 s leave the minute (35 used).
  clock.t = 62_000;
  assert.equal(b.inUse().minute, 35);
  const holdEndBefore = b.retryWaitUntil;
  assert.ok(holdEndBefore > clock.t, "the hold would still run (until A's next look plus 0.5 s, at least 2.5 s)");
  const granted = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "A" });
  assert.ok(granted instanceof Reservation, "A gets in");
  assert.ok(b.retryWaitUntil <= clock.t, "the hold ended the moment A got in");
  (granted as Reservation).end();
  assert.ok(b.roomFor("P2", 5, false).ok, "P2 may take its share up to 40 again at once (35 + 5)");
  clock.t = holdEndBefore + 10_000;
  const m = b.takeMinute().retryHold;
  assert.equal(m.inForceMs, 62_000 - 40_000, "time in force counted up to A's grant, not to the old end");
});

test("item 4: with two stuck retries waiting, one getting in keeps the hold for the other; the hold ends when the other's record resolves", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p2Minute(b, clock, 38);
  clock.t = 40_000;
  const a = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "A" });
  const bb = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "B" });
  assert.ok(!(a instanceof Reservation) && !(bb instanceof Reservation), "both kept out by P2's 38");
  clock.t = 62_000; // 35 used: room for one retry of 10 under 45
  const ga = b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: "A" });
  assert.ok(ga instanceof Reservation, "A gets in");
  (ga as Reservation).end(); // sent nothing: 35 used
  assert.ok(b.retryWaitUntil > clock.t, "B still waits, so the hold goes on");
  assert.ok(!b.roomFor("P2", 1, false).ok, "P2 still held at 35 for B");
  b.forgetRetry("B"); // B's stuck record resolved (risk.ts resolveStuck)
  assert.ok(b.retryWaitUntil <= clock.t, "no retry waits: the hold is over");
  assert.ok(b.roomFor("P2", 5, false).ok, "P2 has its share again");
});

test("item 4: a look that finds room does not end the hold (only a grant does)", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p2Minute(b, clock, 38);
  clock.t = 40_000;
  assert.ok(!b.roomFor("P1", 10, true, 0, CAP, "A").ok);
  clock.t = 62_000;
  assert.ok(b.roomFor("P1", 10, true, 0, CAP, "A").ok, "A's look finds room");
  assert.ok(b.retryWaitUntil > clock.t, "the hold stays until A's try is granted");
  assert.ok(!b.roomFor("P2", 1, false).ok, "so P2 cannot take A's room between its look and its try");
});

test("item 4: a stuck record that resolves ends its retry's hold (resolveStuck calls the budget's forgetRetry)", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const say = async () => true;
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  memory.budget = new RequestBudget({ now: () => sim.simMs, remaining: () => 200 });
  const risk: any = { broker: sim, store, now, say, liquidator, syncMemory: memory, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  await ensureDay({ store, broker: sim, now } as any, D);
  const dd = (await store.getDay(D))!;
  const id = clientOrderIdFor(D, "IONQ", 7);
  await sim.submitEntry({ symbol: "IONQ", qty: 2, stopPrice: 33, takeProfitPrice: 34.5, referencePrice: 33.88, clientOrderId: id });
  sim.fillEntry(id, 33.88);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "IONQ", qty: 2, referencePrice: 33.88, stopPrice: 33, takeProfitPrice: 34.5, status: "filled", alpacaOrderId: null, filledQty: 2, filledAvgPrice: 33.88, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(20_000);
  memory.stuck.set(id, { symbol: "IONQ", since: sim.simMs - 60_000, nextAt: sim.simMs + 60_000, delayMs: 0, alerted: true, escalated: false, lastTriedAt: sim.simMs, why: "x" } as any);
  const forgotten: string[] = [];
  const real = memory.budget.forgetRetry.bind(memory.budget);
  memory.budget.forgetRetry = (k: string) => (forgotten.push(k), real(k));
  await sim.submitSell({ symbol: "IONQ", qty: 2, clientOrderId: "elsewhere-1" } as any); // the shares leave
  sim.advance(3_000);
  await syncOrders(risk, dd, { protect: true });
  assert.ok(!memory.stuck.has(id), "resolved");
  assert.ok(forgotten.includes(id), "its key was forgotten by the budget");
});

// ---------------- item 3: fair turns among stuck positions ----------------

// Fills the budgeted minute with urgent P1 work sent one a second from `fromMs` (out of the 5 seconds by the time the test looks), so stuck
// retries wait for the minute and room returns one request a second.
function p1Minute(b: RequestBudget, clock: { t: number }, n: number, fromMs = 0): void {
  for (let i = 0; i < n; i++) {
    clock.t = fromMs + i * 1_000;
    const r = b.tryReserve("P1", 1, { label: "urgent", fiveSec: false }) as Reservation;
    assert.ok(r instanceof Reservation);
    r.charge("/v2/test");
    r.end();
  }
}
const retry = (b: any, key: string) => b.tryReserve("P1", 10, { label: "stuck retry", minuteCap: CAP, retryKey: key });
const look = (b: any, key: string) => b.roomFor("P1", 10, true, 0, CAP, key);
// While they wait, the retries look again every 4 s (their room wakes; in the worker the walk also sees them), `keys` in that order each
// time; `seenOnly` are seen by the walk without a budget check. The clock ends at `until`, with no look then.
function lookUntil(b: any, clock: { t: number }, until: number, keys: string[], seenOnly: string[] = []): void {
  for (let t = clock.t + 4_000; t < until; t += 4_000) {
    clock.t = t;
    for (const k of keys) look(b, k);
    for (const k of seenOnly) b.seenRetry(k);
  }
  clock.t = until;
}

test("item 3: when room comes back, the stuck retry that waited longest gets it, though another looks first; the other is told `turn`", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p1Minute(b, clock, 40);
  clock.t = 41_000;
  assert.equal(retry(b, "A").why, "class", "A waits first (40 + 10 passes 45)");
  clock.t = 42_000;
  assert.equal(look(b, "B").why, "class", "B waits second");
  assert.deepEqual(b.waitingRetries(), ["A", "B"]);
  lookUntil(b, clock, 65_000, ["B", "A"]); // 34 used at 65 s: room for one retry of 10 under 45
  const bFirst = look(b, "B");
  assert.ok(!bFirst.ok && bFirst.why === "turn", "B looks first but waits its turn");
  assert.ok(bFirst.at >= clock.t + 250, "and looks again no sooner than a quarter second later");
  const bTry = retry(b, "B");
  assert.ok(!(bTry instanceof Reservation) && bTry.why === "turn", "B's try is refused too");
  const a = retry(b, "A");
  assert.ok(a instanceof Reservation, "A, which waited longest, gets the room");
  assert.deepEqual(b.waitingRetries(), ["B"], "A left the list");
  a.end();
});

test("item 3: a refusal for its turn is counted in the per-minute statistics (once, under `turn`) and logged; it sets no hold", () => {
  const clock = { t: 0 };
  const logged: any[] = [];
  const b: any = new RequestBudget({ now: () => clock.t, log: (e, d) => void logged.push({ e, d }) });
  p1Minute(b, clock, 40);
  clock.t = 41_000;
  retry(b, "A");
  lookUntil(b, clock, 65_000, ["A"]);
  b.takeMinute();
  const r = retry(b, "B");
  assert.equal(r.why, "turn");
  const m = b.takeMinute();
  assert.equal(m.refused.turn, 1);
  assert.equal(m.refused.class + m.refused.minute + m.refused.five + m.refused.floor, 0, "counted once, under `turn` only");
  assert.ok(logged.some((x) => x.e === "budget_refused" && x.d.why === "turn" && x.d.label === "stuck retry"));
  assert.equal(m.retryHold.started + m.retryHold.renewed, 0, "a retry with room waiting its turn sets no hold");
});

test("item 3: a retry that was granted goes to the back: on its next refusal it waits behind the others", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p1Minute(b, clock, 40);
  clock.t = 41_000;
  retry(b, "A");
  clock.t = 42_000;
  retry(b, "B");
  lookUntil(b, clock, 65_000, ["B", "A"]);
  const a = retry(b, "A") as Reservation;
  assert.ok(a instanceof Reservation);
  for (let i = 0; i < 10; i++) a.charge("/v2/test");
  a.end(); // A's try sent 10
  clock.t = 67_500;
  assert.equal(retry(b, "A").why, "class", "A is stuck again and waits");
  assert.deepEqual(b.waitingRetries(), ["B", "A"], "behind B");
  lookUntil(b, clock, 76_000, ["A", "B"]); // the urgent requests sent up to 16 s have left: room for one retry
  assert.equal(look(b, "A").why, "turn", "A looks first, but B has waited longer");
  assert.ok(retry(b, "B") instanceof Reservation, "B gets the room");
});

test("item 3: a retry not seen for more than 10 s leaves the list, so it can never block the others; one the walk saw keeps its place", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p1Minute(b, clock, 40);
  clock.t = 41_000;
  retry(b, "A");
  clock.t = 42_000;
  retry(b, "B");
  clock.t = 43_000;
  retry(b, "C");
  // A is never seen again (its entry vanished); B is seen by the walk while it waits for its time (no budget check then); C keeps looking.
  clock.t = 50_000;
  b.seenRetry("B");
  clock.t = 51_000;
  look(b, "C");
  assert.deepEqual(b.waitingRetries(), ["A", "B", "C"], "A was last seen exactly 10 s ago: still waiting");
  clock.t = 51_001;
  assert.equal(look(b, "C").why, "class", "C looks (no room yet)");
  assert.deepEqual(b.waitingRetries(), ["B", "C"], "A, unseen for more than 10 s, was dropped; B kept its place");
  lookUntil(b, clock, 65_000, ["C"], ["B"]);
  assert.equal(look(b, "C").why, "turn", "B is ahead of C");
  assert.ok(retry(b, "B") instanceof Reservation, "B gets the room; a vanished A blocks nobody");
});

test("item 3: urgent work, timed-out stop tries and low-priority work are not in the list and never wait for a turn", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p1Minute(b, clock, 30);
  clock.t = 41_000;
  b.tryReserve("P1", 20, { label: "stuck retry", minuteCap: CAP, retryKey: "A" }); // 30 + 20 passes 45: A waits
  assert.deepEqual(b.waitingRetries(), ["A"]);
  const t = b.tryReserve("P1", 13, { label: "timed-out stop try", limitRetries: true });
  assert.ok(t instanceof Reservation, "a timed-out stop's try (no cap, no key) goes ahead");
  t.end();
  assert.ok(b.tryReserve("P2", 1, { label: "list lag recheck", fiveSec: false }) instanceof Reservation, "P2 is not in the list");
  assert.deepEqual(b.waitingRetries(), ["A"]);
});

test("item 3: forgetting a retry (its stuck record resolved) takes it out of the list", () => {
  const clock = { t: 0 };
  const b: any = new RequestBudget({ now: () => clock.t });
  p1Minute(b, clock, 40);
  clock.t = 41_000;
  retry(b, "A");
  retry(b, "B");
  b.forgetRetry("A");
  assert.deepEqual(b.waitingRetries(), ["B"]);
  lookUntil(b, clock, 65_000, ["B"]);
  assert.ok(retry(b, "B") instanceof Reservation);
});

// In the worker, 10 minutes, 5 positions whose shares Alpaca keeps holding, with steady low-priority demand. Before item 3 (b995c17's code,
// measured with this same shape): the longest wait between one position's tries was 167.5 s against an average of about 95 s, and the turns
// were uneven (5 to 8 tries each). With turns the positions are tried in turn, so no position waits much longer than another: each one's
// longest wait is within 15 s of every other's. (With item 2 the longest waits are set by the budgeted minute filling, the same for all.)
test("item 3, in the worker: 5 stuck positions under steady low-priority demand are tried in turn, and no position waits much longer than another", async () => {
  const w = await stuckWorld({ n: 5, minutes: 10, p2: true, shape: "hidden" });
  assert.equal(w.rateLimited, 0);
  const longestEach = w.gaps.map((g) => Math.max(...g));
  assert.ok(Math.max(...longestEach) - Math.min(...longestEach) <= 15_000, `each position's longest wait: ${longestEach.map((x) => Math.round(x / 1000)).join(", ")} s`);
  const counts = w.syms.map((s) => w.tries.get(s)?.length ?? 0);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `tries per position ${counts.join(", ")}`);
  // In turn: after every position's first try, no position is tried twice while another waits without a try between.
  const later = w.order.slice(w.syms.length);
  for (let i = 0; i + w.syms.length <= later.length; i++) {
    const window = later.slice(i, i + w.syms.length);
    assert.equal(new Set(window).size, w.syms.length, `in turn: ${window.join(", ")}`);
  }
});

// ---------------- item 2: a retry budget that grows with spare room ----------------

// A budget whose governor reports `seen.n` answers in the last 60 s, with Alpaca's remaining at `rem.n`.
function growWorld(seenN: number, remN = 200) {
  const clock = { t: 1_000_000 };
  const seen = { n: seenN };
  const rem = { n: remN };
  const b: any = new RequestBudget({ now: () => clock.t, remaining: () => rem.n, requestsLastMinute: () => seen.n });
  return { clock, seen, rem, b };
}
// Lets the minute climb to its target (one step a second).
function climb(w: ReturnType<typeof growWorld>, seconds: number): void {
  for (let i = 0; i < seconds; i++) {
    w.b.budgetMinute();
    w.clock.t += 1_000;
  }
  w.b.budgetMinute();
}
// Sends `n` budgeted requests of class `cls` now (one try), outside any cap (forced), to fill the window.
function sendNow(b: any, cls: "P1" | "P2", n: number, minuteCap?: number): void {
  const r = b.tryReserve(cls, n, { label: "fill", force: true, fiveSec: false, ...(minuteCap ? { minuteCap } : {}) }) as Reservation;
  for (let i = 0; i < n; i++) r.charge("/v2/test");
  r.end();
}

test("item 2: when busy (Alpaca's spare under 60) the minute is 60, with the 15 in 5 seconds, the stuck retries' 45 and P2's 40, as before", () => {
  const w = growWorld(170); // 170 requests the budget did not send: spare 30
  climb(w, 10);
  assert.equal(w.b.budgetMinute(), 60);
  assert.ok(w.b.roomFor("P1", 15).ok && !w.b.roomFor("P1", 16).ok, "15 in 5 seconds");
  sendNow(w.b, "P1", 35);
  assert.ok(w.b.roomFor("P1", 10, false, 0, CAP, "A").ok, "a stuck retry fits at 35 + 10 = 45");
  assert.ok(!w.b.roomFor("P1", 11, false, 0, CAP, "A").ok, "not at 46");
  assert.ok(w.b.roomFor("P2", 5, false).ok && !w.b.roomFor("P2", 6, false).ok, "P2 up to 40");
  assert.ok(w.b.roomFor("P1", 25, false).ok && !w.b.roomFor("P1", 26, false).ok, "urgent work up to 60");
});

test("item 2: when quiet the minute grows to Alpaca's spare (200 less what the budget did not send), with the 5 seconds a quarter of it, the stuck ceiling 15 below it and P2's share 20 below it", () => {
  const w = growWorld(50); // spare 150
  climb(w, 10);
  assert.equal(w.b.budgetMinute(), 150);
  assert.ok(w.b.roomFor("P1", 37).ok && !w.b.roomFor("P1", 38).ok, "the 5 seconds: 37 (a quarter of 150)");
  sendNow(w.b, "P1", 125);
  w.seen.n = 50 + 125; // the governor sees the budget's own 125 too: still 50 not budgeted
  w.clock.t += 6_000; // out of the 5 seconds, still in the minute
  assert.equal(w.b.budgetMinute(), 150, "its own requests do not count against the spare");
  assert.ok(w.b.roomFor("P1", 10, false, 0, CAP, "A").ok, "a stuck retry fits at 125 + 10 = 135 (150 less 15)");
  assert.ok(!w.b.roomFor("P1", 11, false, 0, CAP, "A").ok, "not at 136: 15 always kept for urgent work");
  assert.ok(w.b.roomFor("P2", 5, false).ok && !w.b.roomFor("P2", 6, false).ok, "P2 up to 130 (150 less 20)");
  assert.ok(w.b.roomFor("P1", 25, false).ok && !w.b.roomFor("P1", 26, false).ok, "urgent work up to 150");
});

test("item 2: the minute is computed at most once a second and rises by at most 20 at a time; it falls at once", () => {
  const w = growWorld(50);
  assert.equal(w.b.budgetMinute(), 80, "first step from 60");
  w.clock.t += 999;
  assert.equal(w.b.budgetMinute(), 80, "not again within the second");
  w.clock.t += 1;
  assert.equal(w.b.budgetMinute(), 100);
  w.clock.t += 1_000;
  assert.equal(w.b.budgetMinute(), 120);
  w.clock.t += 1_000;
  assert.equal(w.b.budgetMinute(), 140);
  w.clock.t += 1_000;
  assert.equal(w.b.budgetMinute(), 150, "up to its target");
  w.seen.n = 160; // entries start: spare 40
  w.clock.t += 1_000;
  assert.equal(w.b.budgetMinute(), 60, "falls at once to 60");
  w.seen.n = 90; // spare 110
  w.clock.t += 1_000;
  assert.equal(w.b.budgetMinute(), 80, "and rises again 20 at a time");
});

test("item 2: with no answer seen by the governor in the last minute the spare cannot be measured and the minute stays 60; without a governor count it is always 60", () => {
  const w = growWorld(0);
  climb(w, 10);
  assert.equal(w.b.budgetMinute(), 60);
  const plain: any = new RequestBudget({ now: () => 0 });
  assert.equal(plain.budgetMinute(), 60);
});

test("item 2: the floors on Alpaca's remaining are unchanged when the minute grows (20 for urgent work and stuck retries, 80 for P2)", () => {
  const w = growWorld(20); // spare 180
  climb(w, 10);
  assert.equal(w.b.budgetMinute(), 180);
  w.rem.n = 29;
  assert.ok(w.b.roomFor("P1", 9, false).ok && !w.b.roomFor("P1", 10, false).ok, "P1 leaves 20");
  const s = w.b.roomFor("P1", 10, false, 0, CAP, "A");
  assert.ok(!s.ok && s.why === "floor", "a stuck retry too");
  w.rem.n = 89;
  assert.ok(w.b.roomFor("P2", 9, false).ok && !w.b.roomFor("P2", 10, false).ok, "P2 leaves 80");
});

test("item 2: when the minute falls, urgent work keeps its 15 above what stuck retries were let in for; stuck retries and P2 wait for the new minute", () => {
  const w = growWorld(50);
  climb(w, 10);
  assert.equal(w.b.budgetMinute(), 150);
  sendNow(w.b, "P1", 135, CAP); // stuck retries used their whole 135
  w.seen.n = 135 + 170; // entries started: 170 not budgeted, spare 30
  w.clock.t += 6_000;
  assert.equal(w.b.budgetMinute(), 60, "the minute fell to 60 at once");
  assert.ok(w.b.roomFor("P1", 13, false).ok, "a timed-out stop's try of 13 still gets in (135 + 13 under the 150 in force this minute)");
  assert.ok(w.b.roomFor("P1", 15, false).ok && !w.b.roomFor("P1", 16, false).ok, "urgent work has exactly its 15");
  assert.ok(!w.b.roomFor("P1", 1, false, 0, CAP, "A").ok, "stuck retries wait (45 now)");
  assert.ok(!w.b.roomFor("P2", 1, false).ok, "P2 waits (40 now)");
  w.clock.t += 60_000; // the 135 have left the window; the 150 is no longer in force within it
  assert.ok(w.b.roomFor("P1", 60, false).ok && !w.b.roomFor("P1", 61, false).ok, "urgent work back to the minute in force, 60");
});

test("item 2: while the minute is still rising, a refusal on the minute is looked at again at its next step, not when the oldest requests leave", () => {
  const w = growWorld(50);
  w.b.budgetMinute(); // 80, rising toward 150
  sendNow(w.b, "P1", 60, CAP);
  const r = w.b.roomFor("P1", 10, false, 0, CAP, "A"); // 60 + 10 passes 80 less 15
  assert.ok(!r.ok && r.at <= w.clock.t + 1_000, `looked at again within a second (${r.at - w.clock.t} ms), not in a minute`);
  w.clock.t += 1_000;
  assert.ok(w.b.roomFor("P1", 10, false, 0, CAP, "A").ok, "and at 100 it fits (60 + 10 under 85)");
});
