// The redesign of 2026-11-14, part 2: the protection loop (src/protection.ts) and how the worker uses it. It replaces fix (a)'s tests
// (test/weekend-r8.test.ts, retired with the shared sync timer): the properties they guarded are kept here in the loop's terms (a recheck runs
// once at its time, a failed read does not lose a stuck sale's retry, an outage of the reads stays bounded).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ProtectionLoop, LOOK_FAIL_FIRST_MS, LOOK_FAIL_MAX_MS, LOOK_PUT_OFF_MS } from "../src/protection.ts";
import { SimBroker } from "./sim-broker.ts";
import { rig, settle, D } from "./rig.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { FakeBot } from "./helpers.ts";

const iso = (ms: number) => new Date(ms).toISOString();

// ---------------- the loop on its own ----------------

function loopWorld() {
  let now = 0;
  const timers: Array<{ due: number; fn: () => void }> = [];
  const looks: Array<{ at: number; ids: string[]; kind: string; extra: number }> = [];
  let next: (ids: ReadonlySet<string>) => any = () => ({ outcome: "done" });
  const loop = new ProtectionLoop({
    now: () => now,
    setTimer: (fn, ms) => {
      const h = { due: now + ms, fn };
      timers.push(h);
      return h;
    },
    clearTimer: (h) => {
      const i = timers.indexOf(h as any);
      if (i >= 0) timers.splice(i, 1);
    },
    look: async (ids, kind, extra) => {
      looks.push({ at: now, ids: [...ids].sort(), kind, extra });
      return next(ids);
    },
  });
  const to = async (t: number) => {
    for (let g = 0; g < 100; g++) {
      timers.sort((a, b) => a.due - b.due);
      const h = timers[0];
      if (!h || h.due > t) break;
      timers.shift();
      now = Math.max(now, h.due);
      h.fn();
      for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
    }
    now = Math.max(now, t);
  };
  return { loop, looks, timers, to, setNext: (f: typeof next) => void (next = f), now: () => now };
}

test("part 2, the loop: wakes for several entries due together make one look; the earliest wake wins; a protection wake is never turned into a list-lag one", async () => {
  const w = loopWorld();
  w.loop.wake("A", 1_000, "protect");
  w.loop.wake("B", 1_000, "lag", { extraRequests: 1, untilMs: 30_000 });
  w.loop.wake("A", 5_000, "protect"); // later: ignored
  w.loop.wake("C", 3_000, "lag", { untilMs: 30_000 });
  w.loop.wake("C", 2_000, "protect"); // earlier, and a protection wake
  await w.to(1_000);
  assert.deepEqual(w.looks, [{ at: 1_000, ids: ["A", "B"], kind: "protect", extra: 1 }], "one look for both; a protection wake makes it routine");
  await w.to(3_000);
  assert.deepEqual(w.looks.at(-1), { at: 2_000, ids: ["C"], kind: "protect", extra: 0 });
  assert.equal(w.looks.length, 2, "each wake served once");
});

test("part 2, the loop: a look only for list-lag wakes is a list-lag look (P2 in the worker); a list-lag wake past its window is dropped", async () => {
  const w = loopWorld();
  w.loop.wake("B", 500, "lag", { extraRequests: 1, untilMs: 30_000 });
  await w.to(500);
  assert.deepEqual(w.looks.at(-1), { at: 500, ids: ["B"], kind: "lag", extra: 1 });
  w.loop.wake("B", 31_000, "lag", { untilMs: 30_000 });
  await w.to(32_000);
  assert.equal(w.looks.length, 1, "past its window: no look");
  assert.equal(w.loop.pendingWakes().size, 0);
});

test("part 2, the loop: one action per entry at a time; a wake that comes while it runs is looked at when it ends; a recheck the action asks for becomes a wake", async () => {
  const w = loopWorld();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let runs = 0;
  await w.loop.act("A", "sale", async () => {
    runs++;
    await gate;
    return { recheckAt: 10_000 };
  });
  await w.loop.act("A", "sale", async () => void runs++);
  assert.equal(runs, 1, "a second action for the same entry does not start");
  assert.equal(w.loop.busy("A"), true);
  w.loop.wake("A", 100, "protect");
  await w.to(200);
  assert.equal(w.looks.length, 0, "no look while its action runs");
  release();
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
  assert.equal(w.loop.busy("A"), false);
  await w.to(300);
  assert.deepEqual(w.looks.map((l) => l.ids), [["A"]], "looked at once the action ended");
});

test("part 2, the loop: a look put off by a running sync comes a quarter second later; one that waits for room comes when room returns; both keep their wakes", async () => {
  const w = loopWorld();
  let n = 0;
  w.setNext(() => (++n === 1 ? { outcome: "busy" } : n === 2 ? { outcome: "wait", retryAt: 5_000 } : { outcome: "done" }));
  w.loop.wake("A", 1_000, "protect");
  await w.to(1_000);
  assert.equal(w.looks.length, 1);
  await w.to(1_000 + LOOK_PUT_OFF_MS);
  assert.equal(w.looks.length, 2, "a quarter second later");
  await w.to(4_999);
  assert.equal(w.looks.length, 2, "waiting for room: nothing before 5 s");
  await w.to(5_000);
  assert.equal(w.looks.length, 3);
  assert.equal(w.loop.pendingWakes().size, 0, "served");
});

test("part 2, the loop (rule 6): a look whose reads fail keeps its wakes and waits 1 s, doubling to 10 s; a look that works resets the wait", async () => {
  const w = loopWorld();
  let fail = true;
  w.setNext(() => (fail ? { outcome: "failed" } : { outcome: "done" }));
  w.loop.wake("A", 0, "protect");
  await w.to(60_000);
  const gaps = w.looks.slice(1).map((l, i) => l.at - w.looks[i]!.at);
  assert.deepEqual(gaps.slice(0, 5), [LOOK_FAIL_FIRST_MS, 2_000, 4_000, 8_000, LOOK_FAIL_MAX_MS], gaps.join(","));
  assert.ok(gaps.every((g) => g <= LOOK_FAIL_MAX_MS));
  fail = false;
  await w.to(80_000);
  assert.equal(w.loop.pendingWakes().size, 0, "served once a look worked");
  w.loop.wake("A", 80_500, "protect");
  await w.to(80_500);
  assert.equal(w.looks.at(-1)!.at, 80_500, "the wait was reset");
});

test("part 2, the loop: after stop, nothing more is looked at or started", async () => {
  const w = loopWorld();
  w.loop.wake("A", 1_000, "protect");
  w.loop.stop();
  await w.to(2_000);
  let ran = false;
  await w.loop.act("B", "x", async () => void (ran = true));
  assert.equal(w.looks.length, 0);
  assert.equal(ran, false);
});

// ---------------- the worker ----------------

async function armedDay(orderStream = false) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, bot, orderStream });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  return { sim, r };
}

async function holdOne(sim: SimBroker, r: any, symbol: string, n = 1) {
  const id = clientOrderIdFor(D, symbol, n);
  await sim.submitEntry({ symbol, qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  sim.fillEntry(id, 12);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  return id;
}

// Runs the worker's timers (the loop's looks) and 5 second passes up to `end`.
async function drive(r: any, sim: SimBroker, end: number, passFrom?: number) {
  let nextPass = passFrom ?? sim.simMs + 5_000;
  for (let g = 0; g < 2000; g++) {
    const tAll = Math.min(...r.timers(), Infinity);
    const next = Math.min(nextPass, tAll);
    if (next > end) break;
    if (next === nextPass) {
      await r.at(iso(next));
      nextPass += 5_000;
    } else r.setNow(iso(Math.max(next, sim.simMs)));
    await settle();
    await settle();
  }
}

test("part 2, the worker: a stuck sale's retry runs at its time in a look of the loop (not a sync brought forward), once, and never resets the regular sync's clock", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "GE");
  await r.at("14:30:10");
  sim.refuseStops = true;
  const sells: number[] = [];
  sim.refuseSellIf = (x: any) => (x.symbol === "GE" ? (sells.push(sim.simMs), true) : false);
  sim.partialTakeProfit(id, 1, 12.08);
  wk.loop.wake(id, sim.simMs, "protect"); // as the live update of the stop's cancel does
  r.setNow(iso(sim.simMs));
  for (let i = 0; i < 4; i++) await settle();
  const st = wk.syncMemory.stuck.get(id);
  assert.ok(st && st.nextAt > sim.simMs, "stuck, with a retry time");
  const due = st.nextAt;
  wk.lastSync = sim.simMs; // a regular sync just ran (it goes first when due; here it is not)
  const lastSync = wk.lastSync;
  const looks: number[] = [];
  const realLook = wk.look.bind(wk);
  wk.look = async (ids: any, kind: any, extra: any, until: any) => (looks.push(sim.simMs), realLook(ids, kind, extra, until));
  // The regular sync's clock moves only when a regular sync starts, and only when one was due (10 s since the last); a look never moves it.
  const early: number[] = [];
  const realStart = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any) => {
    if (wk.backgroundReady("risk") && sim.simMs - wk.lastSync < 10_000) early.push(sim.simMs);
    return realStart(d, c);
  };
  const before = sells.length;
  r.setNow(iso(due));
  for (let i = 0; i < 6; i++) await settle();
  assert.deepEqual(looks, [due], "one look, at the retry's time");
  assert.ok(sells.length > before, "the retry tried to sell");
  assert.deepEqual(early, [], "no regular sync was started before it was due");
  assert.ok(wk.lastSync === lastSync || wk.lastSync - lastSync >= 10_000, "the regular sync's clock moved only by a regular sync that was due");
  r.worker.stop?.();
});

test("part 2, the worker (Monday 2026-11-09's finding): a stuck sale whose try waits never holds up the order sync; another entry's remainder has its fresh stop started meanwhile (it then waits its turn in the one-at-a-time sale queue)", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const slow = await holdOne(sim, r, "IONQ", 1);
  const other = await holdOne(sim, r, "CMCSA", 2);
  await r.at("14:30:10");
  // IONQ: both exits gone, and every sell of it waits 20 s inside Alpaca before failing (a sale that takes a long time).
  for (const l of sim.orders.find((o) => o.clientOrderId === slow)!.legs) await sim.cancelOrder(l.id);
  sim.advance(1_000);
  const realSell = sim.submitSell.bind(sim);
  let release!: () => void;
  const heldAtAlpaca = new Promise<void>((x) => (release = x));
  let ionqSent = false;
  sim.submitSell = async (x: any) => {
    if (x.symbol === "IONQ") {
      ionqSent = true;
      await heldAtAlpaca; // Alpaca holds the request until the test lets it go
      throw new Error("held at Alpaca (test)");
    }
    return realSell(x);
  };
  const t0 = sim.simMs;
  r.setNow(iso(t0));
  wk.loop.wake(slow, t0, "protect");
  // The look may be put off a quarter second while the earlier sync finishes.
  for (let i = 0; i < 8 && !ionqSent; i++) {
    r.setNow(iso(t0 + i * 250));
    for (let k = 0; k < 6; k++) await settle();
  }
  assert.ok(ionqSent && wk.loop.busy(slow), "IONQ's sale is running, held at Alpaca");
  // CMCSA's stop is cancelled at a partial take-profit while IONQ's sale waits.
  sim.partialTakeProfit(other, 1, 12.08);
  wk.syncMemory.liveStopCancelled.set(other, sim.simMs);
  const syncStart = sim.simMs;
  wk.lastSync = 0;
  await r.at(iso(sim.simMs + 100)); // the regular sync
  for (let i = 0; i < 6; i++) await settle();
  assert.equal(wk.inflight.has("risk"), false, `the sync finished at once (${sim.simMs - syncStart} ms), without waiting on IONQ's sale`);
  assert.ok(wk.loop.busy(other) || sim.stopLog.some((x) => x.symbol === "CMCSA"), "CMCSA's fresh stop was started by the loop meanwhile");
  release();
  for (let i = 0; i < 10; i++) await settle();
  r.worker.stop?.();
});

test("part 2, the worker: a look for one entry does not touch the others (no false resolution line, another entry's fresh stop kept)", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const a = await holdOne(sim, r, "AAA", 1);
  const b = await holdOne(sim, r, "BBB", 2);
  await r.at("14:30:10");
  const mem = wk.syncMemory;
  mem.stuck.set(b, { symbol: "BBB", since: sim.simMs, nextAt: sim.simMs + 60_000, delayMs: 30_000, alerted: true, escalated: false, lastTriedAt: sim.simMs, why: "x" });
  mem.freshStops.set(b, { symbol: "BBB", entryClientOrderId: b, stopClientOrderId: "cyrus-p-x", orderId: null, qty: 5, stopPrice: 11.87, placedAt: sim.simMs, status: "accepted", lookedAt: sim.simMs });
  const said = r.bot.posts.length;
  const outcome = await wk.look(new Set([a]), "protect", 0);
  assert.equal(outcome.outcome, "done");
  assert.ok(mem.stuck.has(b), "BBB's stuck record kept");
  assert.ok(mem.freshStops.has(b), "BBB's fresh stop kept");
  assert.equal(r.bot.posts.slice(said).filter((p: any) => p.text.startsWith("BBB")).length, 0, "no line about BBB");
  r.worker.stop?.();
});

test("part 2, the worker: one entry's own cleanup sale does not stop the loop from deciding for another entry, but a whole-account liquidation (here a flatten) does", async () => {
  const { r } = await armedDay();
  const wk: any = r.worker;
  const closeAt = new Date(Date.UTC(2026, 10, 2, 21, 0));
  const own = wk.liquidator.flatten({ reason: "remainder", tradeDate: D, only: ["AAA"], ownEntryOnly: { maxQty: { AAA: 1 } }, maxRounds: 1 });
  assert.equal(wk.protectNow(closeAt), true, "a one-entry cleanup sale running: the others are still decided");
  const other = wk.liquidator.flatten({ reason: "flatten command", tradeDate: D, maxRounds: 1 });
  assert.equal(wk.protectNow(closeAt), false, "a whole-account liquidation: the loop stands aside");
  await Promise.allSettled([own, other]);
  assert.equal(wk.protectNow(closeAt), true);
  r.worker.stop?.();
});

test("part 2, the worker (fix (a)'s round 2 finding, in the loop's terms): when a look's reads fail, the stuck sale's retry still comes soon after they recover, and an outage of 120 s stays bounded", async () => {
  const { sim, r } = await armedDay(true);
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "GE");
  await r.at("14:30:10");
  sim.refuseStops = true;
  const sells: number[] = [];
  sim.refuseSellIf = (x: any) => (x.symbol === "GE" ? (sells.push(sim.simMs), true) : false);
  sim.partialTakeProfit(id, 1, 12.08);
  wk.loop.wake(id, sim.simMs, "protect");
  r.setNow(iso(sim.simMs));
  for (let i = 0; i < 4; i++) await settle();
  const due = wk.syncMemory.stuck.get(id).nextAt;
  let failing = true;
  let fails = 0;
  const realList = (sim as any).listOrdersPaged.bind(sim);
  (sim as any).listOrdersPaged = async (...a: any[]) => {
    if (failing) {
      fails++;
      throw new Error("order list read failed (test)");
    }
    return realList(...a);
  };
  const outageEnd = due + 120_000;
  await drive(r, sim, outageEnd);
  failing = false;
  const before = sells.length;
  await drive(r, sim, outageEnd + 12_000);
  console.log(`MEASURE part 2, 120 s outage: ${fails} failed order-list reads (looks and regular syncs)`);
  assert.ok(fails <= 40, `bounded: ${fails} failed reads in 120 s (12 regular syncs and the looks' growing waits)`);
  assert.ok(sells.length > before, "the stuck sale was retried after the reads recovered");
  r.worker.stop?.();
});

test("part 2, the worker: the 5 minute alert is not judged for an entry while its action runs (its try is changing what the alert reads)", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "GE");
  await r.at("14:30:10");
  const mem = wk.syncMemory;
  mem.stuck.set(id, { symbol: "GE", since: sim.simMs - 6 * 60_000, nextAt: sim.simMs + 60_000, delayMs: 30_000, alerted: true, escalated: false, lastTriedAt: sim.simMs, why: "x" });
  let release!: () => void;
  const held = new Promise<void>((x) => (release = x));
  await wk.loop.act(id, "test: a running try", async () => void (await held));
  wk.lastSync = 0;
  await r.at(iso(sim.simMs + 100));
  for (let i = 0; i < 6; i++) await settle();
  assert.equal(mem.stuck.get(id).escalated, false, "not judged while the try runs");
  release();
  for (let i = 0; i < 6; i++) await settle();
  wk.lastSync = 0;
  await r.at(iso(sim.simMs + 200));
  for (let i = 0; i < 6; i++) await settle();
  assert.ok(mem.stuck.has(id), "the record is still there");
  assert.equal(mem.stuck.get(id)!.escalated, true, "judged at the next sync after it ended");
  r.worker.stop?.();
});

// Group 2, round 1 of the redesign (part 2): a stuck entry's sale fills at Alpaca while its action is still running (the answer comes back
// slowly), and a regular sync meanwhile sees the entry closed. One resolution posts one line (before: "no longer held" from the sync, then
// the sold line from the action).
test("part 2 (group 2, round 1): an entry closed by a sync while its own action still runs gets exactly one resolution line", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "GE");
  await r.at("14:30:10");
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(15_000);
  wk.syncMemory.stuck.set(id, { symbol: "GE", since: sim.simMs - 120_000, nextAt: 0, delayMs: 0, alerted: true, escalated: false, lastTriedAt: sim.simMs - 30_000, why: "x" });
  sim.sellFillDelayMs = 0;
  const realSell = sim.submitSell.bind(sim);
  let release!: () => void;
  const slow = new Promise<void>((x) => (release = x));
  let sent = false;
  sim.submitSell = async (x: any) => {
    const o = await realSell(x);
    if (x.symbol === "GE" && !sent) {
      sent = true;
      await slow; // Alpaca filled it; its answer is slow to come back
    }
    return o;
  };
  const said0 = r.bot.posts.length;
  wk.loop.wake(id, sim.simMs, "protect");
  for (let i = 0; i < 10 && !sent; i++) {
    r.setNow(iso(sim.simMs + 250));
    for (let k = 0; k < 6; k++) await settle();
  }
  assert.ok(sent && wk.loop.busy(id), "the action is running with its sale sent");
  sim.advance(100);
  wk.lastSync = 0;
  await r.at(iso(sim.simMs + 100)); // the regular sync sees the shares gone
  for (let i = 0; i < 6; i++) await settle();
  release();
  for (let i = 0; i < 20; i++) {
    r.setNow(iso(sim.simMs + 200));
    await settle();
  }
  const lines = r.bot.posts.slice(said0).map((p: any) => p.text).filter((t: string) => t.includes("GE"));
  assert.equal(lines.length, 1, `one line: ${lines.join(" | ")}`);
  assert.match(lines[0]!, /^GE: sold \(/);
  r.worker.stop?.();
});

// Group 2, round 1 of the redesign (part 2): an action that throws (a database or broker error) is logged at error level and alerted, at
// most once every 5 minutes (as the failed "risk" step was before part 2); the loop waits 5 s, doubling to 30 s, before that entry's next
// action (rule 6).
test("part 2 (group 2, round 1): an action that throws is alerted once and logged at error level; that entry's next action waits 5 s, then 10 s", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const logs: Array<{ level: string; e: string }> = [];
  const realLog = wk.d.log;
  wk.d.log = (level: string, e: string, data: any) => (logs.push({ level, e }), realLog?.(level, e, data));
  const id = await holdOne(sim, r, "GE");
  await r.at("14:30:10");
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(15_000);
  const tries: number[] = [];
  wk.liquidator.flatten = async () => {
    tries.push(sim.simMs);
    throw new Error("database write failed (test)");
  };
  const t0 = sim.simMs;
  await drive(r, sim, t0 + 40_000, t0 + 100);
  const alerts = r.bot.posts.filter((p: any) => p.channel === "alerts" && p.text.startsWith('Step "protection" failed'));
  assert.equal(alerts.length, 1, "alerted once (at most once every 5 minutes)");
  assert.ok(logs.some((x) => x.level === "error" && x.e === "protection_action_failed"), "logged at error level");
  const gaps = tries.slice(1).map((t, i) => t - tries[i]!);
  assert.ok(tries.length >= 3, `tried again: ${tries.map((t) => t - t0).join(", ")}`);
  assert.ok(gaps[0]! >= 5_000 && gaps[1]! >= 10_000, `growing waits: ${gaps.join(", ")}`);
  r.worker.stop?.();
});

// Group 2, round 3 of part 1, in part 2's terms: a list-lag look refused again and again for lack of room stores its out-of-room event once
// per wait; `next` names the regular sync when the 30 s window ends before room returns.
test("part 2: a list-lag look refused again and again stores timed_out_try_out_of_room once per wait, and names the regular sync when its window ends first", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const events: any[] = [];
  const realLog = wk.d.log;
  wk.d.log = (level: string, e: string, data: any) => {
    if (e === "timed_out_try_out_of_room" && data?.stage === "list lag recheck") events.push(data);
    return realLog?.(level, e, data);
  };
  const realTry = wk.budget.tryReserve.bind(wk.budget);
  let refusals = 0;
  wk.budget.tryReserve = (cls: any, n: any, o: any) => {
    if (o?.label === "list lag recheck") {
      refusals++;
      return { ok: false, at: sim.simMs + 300, why: "floor" };
    }
    return realTry(cls, n, o);
  };
  const id = await holdOne(sim, r, "LUNR");
  await r.at("14:30:10");
  const t0 = sim.simMs;
  wk.loop.wake(id, t0, "lag", { untilMs: t0 + 5_000 });
  for (let i = 0; i < 40 && wk.loop.nextLookAt() !== null; i++) {
    r.setNow(iso(Math.max(sim.simMs, wk.loop.nextLookAt())));
    await settle();
  }
  assert.ok(refusals >= 5, `refused again and again (${refusals})`);
  assert.equal(events.length, 1, `stored once per wait (${events.length} for ${refusals} refusals)`);
  assert.equal(events[0].next, "when the budget has room");
  // A wait whose room comes only after the window: named as the regular sync, and the wake is dropped.
  wk.budget.tryReserve = (cls: any, n: any, o: any) => (o?.label === "list lag recheck" ? { ok: false, at: sim.simMs + 60_000, why: "minute" } : realTry(cls, n, o));
  events.length = 0;
  // The first wait ended with its window (the loop dropped the wake): the second wait stores its event afresh (part 1, group 2 round 4).
  assert.equal(wk.loop.pendingWakes().has(id), false, "the first wait ended with its window");
  const t1 = sim.simMs;
  wk.loop.wake(id, t1, "lag", { untilMs: t1 + 5_000 });
  r.setNow(iso(t1));
  await settle();
  await settle();
  assert.equal(events.length, 1, "the second wait is stored too");
  assert.equal(events[0]?.next, "regular sync");
  assert.equal(wk.loop.pendingWakes().has(id), false, "dropped: its window ends before room returns");
  r.worker.stop?.();
});

// Group 1, round 1 of the redesign (part 2), finding 1: looks never crowd out the regular 10 second sync (the record of truth). Looks that
// take 2 s each (slow reads) and come back to back for 60 s; the regular sync still starts at least every 10 to 15 s.
test("part 2 (group 1, round 1): with slow looks back to back, the regular sync still starts every 10 s or so", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "GE");
  await r.at("14:30:10");
  const realPaged = (sim as any).listOrdersPaged.bind(sim);
  (sim as any).listOrdersPaged = async (...a: any[]) => {
    await sim.sleep(2_000); // every order-list read takes 2 s
    return realPaged(...a);
  };
  const regular: number[] = [];
  const realStart = wk.startSync.bind(wk);
  wk.startSync = (d: any, c: any) => {
    if (wk.backgroundReady("risk")) regular.push(sim.simMs);
    return realStart(d, c);
  };
  const t0 = sim.simMs;
  let nextPass = t0 + 5_000;
  let nextWake = t0;
  while (sim.simMs < t0 + 60_000) {
    if (sim.simMs >= nextWake) {
      wk.loop.wake(id, sim.simMs, "protect"); // a wake every half second: looks back to back
      nextWake = sim.simMs + 500;
    }
    if (sim.simMs >= nextPass) {
      await r.at(iso(sim.simMs));
      nextPass += 5_000;
    } else r.setNow(iso(sim.simMs + 250));
    for (let i = 0; i < 4; i++) await settle();
  }
  const gaps = regular.slice(1).map((t, i) => t - regular[i]!);
  assert.ok(regular.length >= 4, `regular syncs ran: ${regular.map((t) => t - t0).join(", ")}`);
  assert.ok(Math.max(...gaps) <= 15_500, `longest gap between regular syncs ${Math.max(...gaps)} ms`);
  r.worker.stop?.();
});

// Finding 2: the list-lag steps are counted from after the look's reads (as v22 and part 1 counted from the sync's end), however long the
// reads take.
test("part 2 (group 1, round 1): with slow reads, a list-lag wake is asked for at least 0.5 s after the look's reads ended", async () => {
  const { sim, r } = await armedDay(true);
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "LUNR");
  await r.at("14:30:10");
  const realPaged = (sim as any).listOrdersPaged.bind(sim);
  let readEnd = 0;
  (sim as any).listOrdersPaged = async (...a: any[]) => {
    await sim.sleep(1_500);
    const out = await realPaged(...a);
    readEnd = sim.simMs;
    return out;
  };
  sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
  wk.syncMemory.liveStopCancelled.set(id, sim.simMs);
  wk.lastSync = sim.simMs;
  const out = await wk.look(new Set([id]), "protect", 0, Infinity);
  assert.equal(out.outcome, "done");
  const w = wk.loop.pendingWakes().get(id);
  assert.ok(w && w.kind === "lag", "a list-lag wake was asked for");
  assert.ok(w.at - readEnd >= 450, `due ${w.at - readEnd} ms after the reads ended (the first step is 0.5 s)`);
  r.worker.stop?.();
});

// Finding 3: the busy skip. While an entry's action runs, a sync's walk does nothing for it: no timed-out stop status check or cancel, no
// fresh-stop lookup, its fresh stop kept.
test("part 2 (group 1, round 1): while an entry's action runs, the walk sends no check or cancel for it and keeps its fresh stop", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "RKLB");
  await r.at("14:30:10");
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(2_000);
  const mem = wk.syncMemory;
  const stop = "cyrus-p-20261102-RKLB-x-s1";
  mem.timedOutStops.set(stop, id);
  mem.stuck.set(id, { symbol: "RKLB", since: sim.simMs, nextAt: 0, delayMs: 0, alerted: true, escalated: false, lastTriedAt: sim.simMs, why: "x", restingStop: { stopClientOrderId: stop, cancel: "accepted" } });
  let release!: () => void;
  const held = new Promise<void>((x) => (release = x));
  await wk.loop.act(id, "test: a running try", async () => void (await held));
  const lookups: string[] = [];
  const realFind = sim.findOrderByClientId.bind(sim);
  sim.findOrderByClientId = async (cid: string) => (lookups.push(cid), realFind(cid));
  let cancels = 0;
  const realCancel = sim.cancelOrder.bind(sim);
  sim.cancelOrder = async (oid: string) => (cancels++, realCancel(oid));
  wk.lastSync = 0;
  await r.at(iso(sim.simMs + 100)); // a regular sync walks while the action runs
  for (let i = 0; i < 6; i++) await settle();
  assert.equal(lookups.filter((x) => x === stop).length, 0, "no status check of its timed-out stop");
  assert.equal(cancels, 0, "no cancel sent");
  assert.ok(mem.stuck.has(id), "its record left alone");
  release();
  for (let i = 0; i < 6; i++) await settle();
  r.worker.stop?.();
});

// Finding 3: the stand-aside rules are asked again just before an action starts. Here the decision sees protection allowed, and a close-out
// starts before the action (the second ask says no): nothing is sold.
test("part 2 (group 1, round 1): a close-out that starts between the decision and its action stops the action (no sale reaches Alpaca)", async () => {
  const { syncOrders, SyncMemory } = await import("../src/risk.ts");
  const { Liquidator, SellGate } = await import("../src/sells.ts");
  const { MemoryStore } = await import("../src/store.ts");
  const { ensureDay } = await import("../src/morning.ts");
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  await ensureDay({ store, broker: sim, now } as any, D);
  const dd = (await store.getDay(D))!;
  const id = clientOrderIdFor(D, "AAA", 1);
  await sim.submitEntry({ symbol: "AAA", qty: 5, stopPrice: 9.87, takeProfitPrice: 10.08, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "AAA", qty: 5, referencePrice: 10, stopPrice: 9.87, takeProfitPrice: 10.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  for (const l of sim.orders.find((o) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(20_000);
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now, sleep: sim.sleep });
  let asks = 0;
  const protect = () => ++asks === 1; // the decision: allowed; the action's own ask: a close-out has started
  const acts: Array<() => Promise<unknown>> = [];
  const loop = { busy: () => false, act: async (_id: string, _l: string, run: () => Promise<unknown>) => void acts.push(run), wake: () => undefined };
  await syncOrders({ broker: sim, store, now, say: async () => true, liquidator, syncMemory: new SyncMemory() } as any, dd, { protect, loop } as any);
  assert.equal(acts.length, 1, "the decision handed one action to the loop");
  await acts[0]!();
  assert.ok(asks >= 2, "asked again before the action");
  assert.equal(sim.sellLog.length, 0, "no sale reached Alpaca");
});

// Part 1, round 4, in part 2's terms (decision 5 with change A, "while it waits"): a list-lag look refused on its floor keeps entries giving
// way through to its next look, never past its window; a refusal for another reason ends the give-way; a protection look that serves the
// lag wake ends it too.
test("part 2 (part 1, round 4): a list-lag look refused on its floor keeps entries giving way until its next look, never past its window; a protection look serving it ends the wait", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "LUNR");
  await r.at("14:30:10");
  const realRemaining = wk.budget.remaining;
  wk.budget.remaining = () => 60; // room for the look is several seconds away
  const t0 = sim.simMs;
  wk.loop.wake(id, t0, "lag", { untilMs: t0 + 20_000 });
  r.setNow(iso(t0));
  await settle();
  await settle();
  const next = wk.loop.nextLookAt();
  assert.ok(next !== null && next - t0 > 2_500, `its next look is more than 2.5 s away (${next === null ? null : next - t0} ms)`);
  r.setNow(iso(t0 + 2_200));
  assert.equal(wk.budget.givingWay(), true, "entries still give way after 2 s, through to the next look");
  const waitEnds: number = wk.budget.floorWaits.get("list lag recheck");
  assert.ok(waitEnds <= next + 500 && waitEnds <= t0 + 20_000, `the wait ends by the next look and within the window (${waitEnds - t0} ms)`);
  // A protection wake for the same entry: the look that serves it is not a lag look, and it ends the wait.
  wk.budget.remaining = realRemaining;
  wk.lastSync = sim.simMs; // no regular sync due (since ruling 1 of 2026-11-16 one falls due after 6 s, and the look lets it go first)
  wk.loop.wake(id, sim.simMs, "protect");
  r.setNow(iso(sim.simMs));
  await settle();
  await settle();
  assert.equal(wk.budget.givingWay(), false, "served by a protection look: entries are back");
  assert.equal(wk.lagWaits, 0);
  r.worker.stop?.();
});

// Group 2, round 2 of part 2 (finding A): the other two single-resolution guards. The stuck entry's record is closed elsewhere (as the live
// updates do when an exit fill leaves the symbol flat) while its own action's sale answer is slow; the regular sync meanwhile finds no open
// entry at all (the first branch), or another open entry but not this one (the "not active" sweep). One line, from the action.
for (const other of [false, true]) {
  test(`part 2 (group 2, round 2): a stuck entry whose record is closed elsewhere while its own action runs gets exactly one resolution line (${other ? "another entry still open" : "no open entry left"})`, async () => {
    const { sim, r } = await armedDay();
    const wk: any = r.worker;
    const id = await holdOne(sim, r, "GE");
    if (other) await holdOne(sim, r, "LUNR");
    await r.at("14:30:10");
    for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
    sim.advance(15_000);
    wk.syncMemory.stuck.set(id, { symbol: "GE", since: sim.simMs - 120_000, nextAt: 0, delayMs: 0, alerted: true, escalated: false, lastTriedAt: sim.simMs - 30_000, why: "x" });
    sim.sellFillDelayMs = 0;
    const realSell = sim.submitSell.bind(sim);
    let release!: () => void;
    const slow = new Promise<void>((x) => (release = x));
    let sent = false;
    sim.submitSell = async (x: any) => {
      const o = await realSell(x);
      if (x.symbol === "GE" && !sent) {
        sent = true;
        await slow;
      }
      return o;
    };
    const said0 = r.bot.posts.length;
    wk.loop.wake(id, sim.simMs, "protect");
    for (let i = 0; i < 10 && !sent; i++) {
      r.setNow(iso(sim.simMs + 250));
      for (let k = 0; k < 6; k++) await settle();
    }
    assert.ok(sent && wk.loop.busy(id), "the action is running with its sale sent");
    await r.store.updateOrder(id, { closedAt: new Date(sim.simMs).toISOString() }); // closed elsewhere
    sim.advance(100);
    wk.lastSync = 0;
    await r.at(iso(sim.simMs + 100)); // the regular sync: GE is no longer an open entry
    for (let i = 0; i < 6; i++) await settle();
    release();
    for (let i = 0; i < 20; i++) {
      r.setNow(iso(sim.simMs + 200));
      await settle();
    }
    const lines = r.bot.posts.slice(said0).map((p: any) => p.text).filter((t: string) => t.includes("GE"));
    assert.equal(lines.length, 1, `one line: ${lines.join(" | ")}`);
    r.worker.stop?.();
  });
}

// Group 2, round 2 of part 2 (finding A, rule 6): an action that throws, with its entry woken every half second: the loop's backoff (5 s,
// doubling to 30 s) paces the tries, not the regular sync.
test("part 2 (group 2, round 2): an action that throws while its entry is woken every 0.5 s is tried again only after 5, 10, then 20 s", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "GE");
  await r.at("14:30:10");
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(15_000);
  const tries: number[] = [];
  wk.liquidator.flatten = async () => {
    tries.push(sim.simMs);
    throw new Error("database write failed (test)");
  };
  const t0 = sim.simMs;
  while (sim.simMs < t0 + 45_000) {
    wk.loop.wake(id, sim.simMs, "protect");
    r.setNow(iso(sim.simMs + 500));
    await settle();
    await settle();
  }
  const gaps = tries.slice(1).map((t, i) => t - tries[i]!);
  assert.ok(tries.length >= 4 && tries.length <= 5, `tries: ${tries.map((t) => t - t0).join(", ")}`);
  assert.ok(gaps[0]! >= 5_000 && gaps[1]! >= 10_000 && gaps[2]! >= 20_000, `growing waits: ${gaps.join(", ")}`);
  r.worker.stop?.();
});

// Group 2, round 2 of part 2 (finding A, "never past its window", and finding B): the list-lag give-way ends when its wake is dropped and no
// other list-lag wake is left; it does not end while another list-lag look still waits on its floor (a second window, or a protection look
// for another entry), and its out-of-room event is stored once for that wait.
async function lagWorld() {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const a = await holdOne(sim, r, "LUNR");
  const b = await holdOne(sim, r, "GE");
  await r.at("14:30:10");
  const events: any[] = [];
  const realLog = wk.d.log;
  wk.d.log = (level: string, e: string, data: any) => {
    if (e === "timed_out_try_out_of_room" && data?.stage === "list lag recheck") events.push(data);
    return realLog?.(level, e, data);
  };
  wk.lastSync = sim.simMs; // no regular sync due during the test's first seconds
  wk.budget.remaining = () => 60; // room for a list-lag look is several seconds away
  const step = async (at: number) => {
    r.setNow(iso(at));
    await settle();
    await settle();
  };
  return { sim, r, wk, a, b, events, step };
}

test("part 2 (group 2, round 2): a list-lag wake dropped at its window's end with no other list-lag wake left ends the give-way at once", async () => {
  const { sim, r, wk, a, step } = await lagWorld();
  const t0 = sim.simMs;
  wk.loop.wake(a, t0, "lag", { untilMs: t0 + 3_000 }); // room only after its window
  await step(t0);
  assert.equal(wk.loop.pendingWakes().has(a), false, "dropped: its window ends before room returns");
  assert.equal(wk.budget.givingWay(), false, "nothing waits: entries are back");
  r.worker.stop?.();
});

test("part 2 (group 2, round 2, B): two list-lag wakes due together, windows of 3 s and 20 s: when the first is dropped, entries keep giving way for the second until its next look", async () => {
  const { sim, r, wk, a, b, events, step } = await lagWorld();
  const t0 = sim.simMs;
  wk.loop.wake(a, t0, "lag", { untilMs: t0 + 3_000 });
  wk.loop.wake(b, t0, "lag", { untilMs: t0 + 20_000 });
  await step(t0);
  assert.equal(wk.loop.pendingWakes().has(a), false, "the 3 s one is dropped");
  assert.equal(wk.loop.pendingWakes().get(b)?.kind, "lag", "the 20 s one still waits");
  const next = wk.loop.nextLookAt();
  assert.ok(next - t0 > 4_000, `its next look is more than 4 s away (${next - t0} ms)`);
  await step(t0 + 3_500);
  assert.equal(wk.budget.givingWay(), true, "entries still give way for the second (past the first window's end)");
  assert.equal(events.length, 1, "one wait, one stored event");
  r.worker.stop?.();
});

test("part 2 (group 2, round 2, B): a protection look for another entry does not end a list-lag look's wait on its floor; the wait stores one event", async () => {
  const { sim, r, wk, a, b, events, step } = await lagWorld();
  const t0 = sim.simMs;
  wk.loop.wake(a, t0, "lag", { untilMs: t0 + 20_000 });
  await step(t0);
  const next = wk.loop.nextLookAt();
  assert.ok(next - t0 > 4_000, `its next look is more than 4 s away (${next - t0} ms)`);
  wk.loop.wake(b, t0 + 1_000, "protect");
  await step(t0 + 1_000);
  await step(t0 + 2_500);
  assert.equal(wk.budget.givingWay(), true, "entries still give way while the list-lag look waits");
  await step(next);
  assert.equal(events.length, 1, `stored once for the wait (${events.length})`);
  r.worker.stop?.();
});

// Group 1, round 2 of part 2 (B1; design 4.3, "while the 2:55 close-out, the mid-day close-out or the afternoon close-out owns selling: no
// selling action"): four positions with no exits; the loop's four cleanup sales are queued in the one-at-a-time sale queue, the first one's
// sell held at Alpaca. A sale of the whole account is asked for: the queued cleanup sales stand aside at their turn (nothing sent), only the
// one already running carries on, and the whole-account sale runs next. Before: each queued sale ran ahead of it (group 1 measured the 2:55
// close-out held for minutes and bracketed positions still held at 3:00).
for (const reason of ["close-out", "flatten command"]) {
  test(`part 2 (group 1, round 2, B1): loop cleanup sales queued before a ${reason} stand aside at their turn; only the running one carries on`, async () => {
    const { sim, r } = await armedDay();
    const wk: any = r.worker;
    const syms = ["QXA", "QXB", "QXC", "QXD"];
    const ids: string[] = [];
    for (const s of syms) ids.push(await holdOne(sim, r, s));
    await r.at("14:30:10");
    for (const id of ids) for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
    sim.advance(15_000);
    wk.lastSync = sim.simMs; // no regular sync during the test
    const liq: any = wk.liquidator;
    let current: any = null;
    const realRun = liq.run.bind(liq);
    liq.run = async (o: any) => {
      current = o;
      try {
        return await realRun(o);
      } finally {
        current = null;
      }
    };
    const realSell = sim.submitSell.bind(sim);
    let release!: () => void;
    const held = new Promise<void>((x) => (release = x));
    let heldSent = false;
    let asked = false;
    const sent: Array<{ symbol: string; own: boolean; afterAsk: boolean }> = [];
    sim.submitSell = async (x: any) => {
      sent.push({ symbol: x.symbol, own: !!current?.ownEntryOnly, afterAsk: asked });
      if (!heldSent && current?.ownEntryOnly) {
        heldSent = true;
        await held; // Alpaca holds the first cleanup sale's sell
      }
      return realSell(x);
    };
    const yieldedTo = new Map<string, string>();
    const realLog = wk.d.log;
    wk.d.log = (level: string, e: string, data: any) => {
      if (e === "unprotected_position_yielded") yieldedTo.set(data.symbol, data.to);
      return realLog?.(level, e, data);
    };
    for (const id of ids) wk.loop.wake(id, sim.simMs, "protect");
    for (let i = 0; i < 20 && !(heldSent && wk.liquidator.running >= 4); i++) {
      r.setNow(iso(sim.simMs + 100));
      for (let k = 0; k < 6; k++) await settle();
    }
    assert.ok(heldSent && liq.running >= 4, `four cleanup sales asked for, the first one's sell held (${liq.running})`);
    const runningSymbol = sent.find((x) => x.own)!.symbol;
    asked = true;
    const said0 = r.bot.posts.length;
    const whole = wk.liquidator.flatten({ reason, tradeDate: D, maxRounds: 1 });
    release();
    for (let i = 0; i < 60; i++) {
      r.setNow(iso(sim.simMs + 250));
      await settle();
    }
    await whole;
    const ownAfter = sent.filter((x) => x.own && x.afterAsk && x.symbol !== runningSymbol);
    assert.equal(ownAfter.length, 0, `no queued cleanup sale sent anything after the ask: ${ownAfter.map((x) => x.symbol).join(", ")}`);
    for (const s of syms) assert.equal(sim.heldQty(s), 0, `${s} sold by the ${reason}`);
    // Group 2, round 3 of part 2: the stood-aside sales say nothing to Michael (no "I can't confirm a protective stop" alert, no "no longer
    // held" line for shares the whole-account sale sold); only the running one's own line is posted, and each stood-aside one is logged as
    // standing aside for a sale of the whole account.
    for (let i = 0; i < 20; i++) {
      r.setNow(iso(sim.simMs + 1_000));
      await settle();
    }
    const posts = r.bot.posts.slice(said0).map((p: any) => p.text).filter((t: string) => syms.some((x) => t.includes(x)));
    assert.ok(posts.every((t: string) => t.includes(runningSymbol) && !syms.some((x) => x !== runningSymbol && t.includes(x))), `only ${runningSymbol}'s own line: ${posts.join(" | ")}`);
    assert.ok(posts.length <= 1, `at most one line: ${posts.join(" | ")}`);
    for (const s of syms.filter((x) => x !== runningSymbol)) assert.equal(yieldedTo.get(s), "a sale of the whole account (stood aside at its turn)", `${s} logged as standing aside`);
    r.worker.stop?.();
  });
}

// Group 1, round 2 of part 2 (B2): the same second ask inside the other two actions: a bare remainder's sale (A4, its stop cancelled while
// its take-profit rests) and an unclear fresh stop's 15 second limit. A close-out starts between the decision and the action: nothing is
// sent (no sale, no fresh stop, no cancel, no look).
for (const which of ["remainder", "15 second limit"] as const) {
  test(`part 2 (group 1, round 2, B2): a close-out that starts between the decision and the ${which} action stops it (nothing reaches Alpaca)`, async () => {
    const { syncOrders, SyncMemory } = await import("../src/risk.ts");
    const { Liquidator, SellGate } = await import("../src/sells.ts");
    const { MemoryStore } = await import("../src/store.ts");
    const { ensureDay } = await import("../src/morning.ts");
    const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
    const store = new MemoryStore();
    const now = () => new Date(sim.simMs);
    await ensureDay({ store, broker: sim, now } as any, D);
    const dd = (await store.getDay(D))!;
    const id = clientOrderIdFor(D, "AAA", 1);
    await sim.submitEntry({ symbol: "AAA", qty: 5, stopPrice: 9.87, takeProfitPrice: 10.08, referencePrice: 10, clientOrderId: id });
    sim.fillEntry(id, 10);
    await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "AAA", qty: 5, referencePrice: 10, stopPrice: 9.87, takeProfitPrice: 10.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
    const legs = sim.orders.find((o) => o.clientOrderId === id)!.legs;
    const mem = new SyncMemory();
    if (which === "remainder") {
      for (const l of legs) if (l.type === "stop") await sim.cancelOrder(l.id); // the take-profit still rests
    } else {
      for (const l of legs) await sim.cancelOrder(l.id);
      mem.freshStops.set(id, { symbol: "AAA", entryClientOrderId: id, stopClientOrderId: "cyrus-p-test-AAA", orderId: null, qty: 5, stopPrice: 9.87, placedAt: sim.simMs, status: "unclear", lookedAt: sim.simMs });
    }
    sim.advance(20_000);
    const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
    const liquidator = new Liquidator({ broker: sim, gate, now, sleep: sim.sleep });
    let asks = 0;
    const protect = () => ++asks === 1;
    const acts: Array<{ label: string; run: () => Promise<unknown> }> = [];
    const loop = { busy: () => false, act: async (_id: string, label: string, run: () => Promise<unknown>) => void acts.push({ label, run }), wake: () => undefined };
    await syncOrders({ broker: sim, store, now, say: async () => true, liquidator, syncMemory: mem } as any, dd, { protect, loop } as any);
    assert.deepEqual(acts.map((a) => a.label), [which], "the decision handed this action to the loop");
    const req0 = sim.requests;
    const sells0 = sim.sellLog.length;
    await acts[0]!.run();
    assert.ok(asks >= 2, "asked again before the action");
    assert.equal(sim.sellLog.length, sells0, "no sale or fresh stop reached Alpaca");
    assert.equal(sim.requests, req0, "nothing sent at all (no cancel, no look)");
    assert.equal(mem.timedOutStops.size, 0, "no stop timed out");
  });
}

// Group 1, round 3 of part 2 (B1 and B2): loop cleanup sales queued just before 2:55 whose turn comes after 2:55:00 but before the close-out's
// own pass asks for it send nothing (design 4.3, "from the close-out time ... no selling action"; v22's sync started no cleanup from 2:55:00).
// The stood-aside entries say nothing to Michael, gain no stuck record, and an existing stuck record is left as it was.
for (const when of ["2:55", "mid-day pause", "mid-day step", "carried step", "starting close-out"] as const) {
  test(`part 2 (group 1, round 3, B1; group 2, round 4): loop cleanup sales whose turn comes ${when === "2:55" ? "after 2:55:00, before the close-out starts" : `while the ${when} owns selling`}, stand aside; no alert, no stuck record, an existing one unchanged`, async () => {
    const { sim, r } = await armedDay();
    const wk: any = r.worker;
    await r.at("20:54:40");
    wk.middayOwnsSelling = false; // an afternoon after Michael's `go` (the mid-day pause no longer owns selling)
    const syms = ["QXA", "QXB", "QXC", "QXD"];
    const ids: string[] = [];
    for (const s of syms) ids.push(await holdOne(sim, r, s));
    for (const id of ids) for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
    sim.advanceTo(new Date(`${D}T20:54:55Z`).getTime());
    wk.lastSync = sim.simMs;
    const stuckD = { symbol: "QXD", since: sim.simMs - 120_000, nextAt: 0, delayMs: 10_000, alerted: true, escalated: false, lastTriedAt: sim.simMs - 30_000, why: "x" };
    wk.syncMemory.stuck.set(ids[3], { ...stuckD });
    const liq: any = wk.liquidator;
    let current: any = null;
    const realRun = liq.run.bind(liq);
    liq.run = async (o: any) => {
      current = o;
      try {
        return await realRun(o);
      } finally {
        current = null;
      }
    };
    const realSell = sim.submitSell.bind(sim);
    let release!: () => void;
    const held = new Promise<void>((x) => (release = x));
    let heldSent = false;
    const closeoutAt = new Date(`${D}T20:55:00Z`).getTime();
    const sent: Array<{ symbol: string; own: boolean; at: number }> = [];
    sim.submitSell = async (x: any) => {
      sent.push({ symbol: x.symbol, own: !!current?.ownEntryOnly, at: sim.simMs });
      if (!heldSent && current?.ownEntryOnly) {
        heldSent = true;
        await held;
      }
      return realSell(x);
    };
    const yieldedTo = new Map<string, string>();
    const results: any[] = [];
    const realLog = wk.d.log;
    wk.d.log = (level: string, e: string, data: any) => {
      if (e === "unprotected_position_yielded") yieldedTo.set(data.symbol, data.to);
      if (e === "liquidation_result") results.push(data);
      return realLog?.(level, e, data);
    };
    for (const id of ids) wk.loop.wake(id, sim.simMs, "protect");
    for (let i = 0; i < 20 && !(heldSent && liq.running >= 4); i++) {
      r.setNow(iso(sim.simMs + 100));
      for (let k = 0; k < 6; k++) await settle();
    }
    assert.ok(heldSent && liq.running >= 4, `four cleanup sales asked for before 2:55, the first one's sell held (${liq.running})`);
    const runningSymbol = sent.find((x) => x.own)!.symbol;
    const said0 = r.bot.posts.length;
    // Group 2, round 4: each half of the worker's rule: the clock (2:55:01, no pass yet, so the close-out has not been asked for), or a step
    // that owns selling, set before 2:55.
    if (when === "2:55") {
      sim.advanceTo(closeoutAt + 1_000);
      assert.equal(wk.closingOut, false, "the close-out has not started");
    } else if (when === "mid-day pause") wk.middayOwnsSelling = true;
    else if (when === "mid-day step") wk.inflight.add("midday");
    else if (when === "carried step") wk.inflight.add("carried");
    else wk.closingOut = true;
    const turnFrom = sim.simMs;
    release();
    for (let i = 0; i < 40; i++) {
      sim.advance(50);
      await settle();
    }
    const ownAfter = sent.filter((x) => x.own && x.at >= turnFrom && x.symbol !== runningSymbol);
    assert.equal(ownAfter.length, 0, `no queued cleanup sale sent anything: ${ownAfter.map((x) => x.symbol).join(", ")}`);
    const stoodRows = results.filter((x) => (x.errors ?? []).includes("stood aside: the close-out owns selling (or its time has come) and sells these shares"));
    assert.equal(stoodRows.length, 3, `three stored liquidation_result rows with the close-out's text (${JSON.stringify(results.map((x) => x.errors))})`);
    for (const s of syms.filter((x) => x !== runningSymbol)) assert.equal(yieldedTo.get(s), "the close-out (stood aside at its turn)", `${s} logged as standing aside for the close-out`);
    const posts = r.bot.posts.slice(said0).map((p: any) => p.text).filter((t: string) => syms.some((x) => x !== runningSymbol && t.includes(x)));
    assert.equal(posts.length, 0, `nothing posted for the stood-aside ones: ${posts.join(" | ")}`);
    for (const [i, s] of syms.entries()) {
      if (s === runningSymbol) continue;
      if (s === "QXD") assert.deepEqual(wk.syncMemory.stuck.get(ids[i]), stuckD, "the existing stuck record is unchanged");
      else assert.equal(wk.syncMemory.stuck.has(ids[i]), false, `${s}: no stuck record`);
    }
    r.worker.stop?.();
  });
}

// Group 1, round 4 of part 2 (B1; design 4.4: the scheduler wakes "the moment the budget has room for the first record waiting"): 30
// positions without exits whose every sale Alpaca holds 8 s and then fails, for 12 minutes. A retry waiting for room in the shared budget
// waits locally (no request) and makes a look only once its try would have room. Before: each refused retry re-read the order list and the
// positions every 0.5 to 4 s with no end (group 1 measured 470 s below 80 left, 280 s below 20, and 49 rate-limit answers; v22 never below
// 120). Now: no rate-limit answer, and Alpaca's remaining never below 80. (Michael's change of direction of 2026-11-16: selling stays one at
// a time, so this test holds the 80 again, as on 20ba5bd.)
test("part 2 (group 1, round 4, B1): 30 stuck sales held 8 s at Alpaca for 12 minutes: retries waiting for room wait locally; no rate-limit answer, remaining never below 80", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const holds: Array<{ until: number; res: () => void }> = [];
  let timed = false;
  const tsleep = (ms: number): Promise<void> => (timed ? new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res })) : sim.sleep(ms));
  const r = rig<SimBroker>({ broker: sim, sleep: tsleep, simClock: sim, bot });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const wk: any = r.worker;
  await r.at("20:40:00");
  const bad = Array.from({ length: 30 }, (_, i) => "QX" + String.fromCharCode(65 + i));
  for (const s of bad) await holdOne(sim, r, s);
  await r.at("20:40:01");
  const loseAt = new Date(`${D}T20:40:05Z`).getTime();
  const realSell = sim.submitSell.bind(sim);
  sim.submitSell = async (x: any) => {
    if (bad.includes(x.symbol)) {
      await tsleep(8_000);
      throw new Error("held at Alpaca (test)");
    }
    return realSell(x);
  };
  timed = true;
  let lost = false;
  let lastTok = 200;
  let lastTokAt = sim.simMs;
  let below80 = 0;
  let lowest = 200;
  const prev = (sim as any).onRate;
  (sim as any).onRate = (k: number) => {
    const now = sim.simMs;
    if (now > loseAt) {
      if (lastTok < 80) below80 += now - lastTokAt;
      lowest = Math.min(lowest, k);
    }
    lastTok = k;
    lastTokAt = now;
    prev?.(k);
    // Alpaca's live remaining count reaches the governor, as main.ts wires it (group 1's note of 2026-11-16: before, the governor's estimate
    // stayed at 200 in this test).
    r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: k, reset: null });
  };
  const r429 = sim.rejected429;
  let nextPass = sim.simMs + 5_000;
  const end = new Date(`${D}T20:52:00Z`).getTime();
  while (sim.simMs < end) {
    if (!lost && sim.simMs >= loseAt) {
      lost = true;
      for (const s of bad) for (const l of sim.orders.find((o: any) => o.clientOrderId === clientOrderIdFor(D, s, 1))!.legs) await sim.cancelOrder(l.id);
    }
    if (sim.simMs >= nextPass) {
      void r.at(iso(sim.simMs));
      nextPass += 5_000;
    } else r.setNow(iso(sim.simMs + 100));
    for (const h of holds.filter((h) => h.until <= sim.simMs)) {
      holds.splice(holds.indexOf(h), 1);
      h.res();
    }
    await settle();
  }
  assert.ok(lost);
  assert.equal(sim.rejected429 - r429, 0, "no rate-limit answer");
  assert.equal(below80, 0, `remaining never below 80 (lowest ${Math.round(lowest)}, ${Math.round(below80 / 1000)} s below 80)`);
  timed = false;
  for (const h of holds.splice(0)) h.res();
  r.worker.stop?.();
});

// Group 1, round 4 of part 2: the loop's room wakes on their own. A wake whose only reason is room for a try is checked against the budget
// locally and makes no look until there is room; a deferred room wake never delays the entry's other wakes (a live update's, a follow-up's).
test("part 2 (group 1, round 4): a room wake makes no look until the budget has room, and never delays the entry's other wakes", async () => {
  let now = 0;
  let roomFrom = 10_000;
  const timers: Array<{ due: number; fn: () => void }> = [];
  const looks: Array<{ at: number; ids: string[] }> = [];
  const loop = new ProtectionLoop({
    now: () => now,
    setTimer: (fn, ms) => {
      const h = { due: now + ms, fn };
      timers.push(h);
      return h;
    },
    clearTimer: (h) => {
      const i = timers.indexOf(h as any);
      if (i >= 0) timers.splice(i, 1);
    },
    look: async (ids) => {
      looks.push({ at: now, ids: [...ids].sort() });
      return { outcome: "done" };
    },
    roomAt: () => (now >= roomFrom ? null : Math.min(roomFrom, now + 250)),
  });
  const to = async (t: number) => {
    for (let g = 0; g < 500; g++) {
      timers.sort((a, b) => a.due - b.due);
      const h = timers[0];
      if (!h || h.due > t) break;
      timers.shift();
      now = Math.max(now, h.due);
      h.fn();
      for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
    }
    now = Math.max(now, t);
  };
  loop.wake("A", 1_000, "protect", { room: { cls: "P1", n: 10, reads: 2 } });
  await to(5_000);
  assert.equal(looks.length, 0, "no room before 10 s: no look");
  assert.ok(loop.takeMinute().roomChecks > 0, "checked locally");
  loop.wake("A", 6_000, "protect"); // a live update for A, later than the room wake
  await to(6_000);
  assert.deepEqual(looks, [{ at: 6_000, ids: ["A"] }], "the live update's look comes at its time, not delayed by the room wake");
  await to(9_999);
  assert.equal(looks.length, 1, "still no room: no look");
  await to(10_500);
  assert.equal(looks.length, 2, "room at 10 s: one look");
  assert.equal(looks[1]!.at, 10_000);
  loop.wake("B", 11_000, "protect", { room: { cls: "P1", n: 10, reads: 2 } });
  loop.forget("B");
  await to(12_000);
  assert.equal(looks.length, 2, "a forgotten room wake makes no look");
  loop.stop();
});

// Group 2, round 5 of part 2 (note 1): each room wait the round 4 fix covers hands the loop what its try will ask for, so the loop waits for
// that room locally: a stuck retry's backoff wait and its wait for room; a retry refused at its action's start (the act path); a timed-out
// stop's status check refused for room; the 15 second limit's first try refused for room.
async function roomWorld() {
  const { syncOrders, SyncMemory, STUCK_TRY_REQUESTS, TIMED_OUT_CHECK_REQUESTS, TIMED_OUT_TRY_REQUESTS } = await import("../src/risk.ts");
  const { Liquidator, SellGate } = await import("../src/sells.ts");
  const { MemoryStore } = await import("../src/store.ts");
  const { ensureDay } = await import("../src/morning.ts");
  const { RequestBudget } = await import("../src/request-budget.ts");
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  await ensureDay({ store, broker: sim, now } as any, D);
  const dd = (await store.getDay(D))!;
  const id = clientOrderIdFor(D, "AAA", 1);
  await sim.submitEntry({ symbol: "AAA", qty: 5, stopPrice: 9.87, takeProfitPrice: 10.08, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "AAA", qty: 5, referencePrice: 10, stopPrice: 9.87, takeProfitPrice: 10.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  for (const l of sim.orders.find((o) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.advance(20_000);
  const mem = new SyncMemory();
  const box = { remaining: 200 };
  mem.budget = new RequestBudget({ now: () => sim.simMs, remaining: () => box.remaining });
  const gate = new SellGate({ broker: sim, say: async () => true, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now, sleep: sim.sleep });
  const wakes: Array<{ at: number; room?: any }> = [];
  const acts: Array<{ label: string; run: () => Promise<any> }> = [];
  const loop = { busy: () => false, act: async (_id: string, label: string, run: () => Promise<any>) => void acts.push({ label, run }), wake: (_id: string, at: number, _k: string, extra: any = {}) => void wakes.push({ at, room: extra.room }) };
  const sync = () => syncOrders({ broker: sim, store, now, say: async () => true, liquidator, syncMemory: mem } as any, dd, { protect: true, loop } as any);
  return { sim, id, mem, box, wakes, acts, sync, STUCK_TRY_REQUESTS, TIMED_OUT_CHECK_REQUESTS, TIMED_OUT_TRY_REQUESTS };
}

test("part 2 (group 2, round 5): a stuck retry's backoff wait and its wait for room are room wakes with what the retry will ask for", async () => {
  const w = await roomWorld();
  w.mem.stuck.set(w.id, { symbol: "AAA", since: w.sim.simMs - 60_000, nextAt: w.sim.simMs + 5_000, delayMs: 5_000, alerted: true, escalated: false, lastTriedAt: w.sim.simMs - 5_000, why: "x" } as any);
  await w.sync();
  assert.deepEqual(w.wakes.at(-1)?.room, { cls: "P1", n: w.STUCK_TRY_REQUESTS, reads: 2, minuteCap: 45, retryKey: w.id }, "its backoff wait");
  w.mem.stuck.get(w.id)!.nextAt = w.sim.simMs - 1;
  w.box.remaining = 25; // no room for the retry's 10
  await w.sync();
  assert.deepEqual(w.wakes.at(-1)?.room, { cls: "P1", n: w.STUCK_TRY_REQUESTS, reads: 2, minuteCap: 45, retryKey: w.id }, "its wait for room");
  assert.equal(w.acts.length, 0, "no action without room");
});

test("part 2 (group 2, round 5): a retry refused at its action's start (room gone since the decision) returns a room wake through the act path", async () => {
  const w = await roomWorld();
  w.mem.stuck.set(w.id, { symbol: "AAA", since: w.sim.simMs - 60_000, nextAt: w.sim.simMs - 1, delayMs: 5_000, alerted: true, escalated: false, lastTriedAt: w.sim.simMs - 5_000, why: "x" } as any);
  await w.sync();
  assert.equal(w.acts.length, 1, "decided with room");
  w.box.remaining = 25; // gone before the action starts
  const sells0 = w.sim.sellLog.length;
  const r = await w.acts[0]!.run();
  assert.deepEqual(r?.room, { cls: "P1", n: w.STUCK_TRY_REQUESTS, reads: 2, minuteCap: 45, retryKey: w.id });
  assert.ok(r?.recheckAt > w.sim.simMs);
  assert.equal(w.sim.sellLog.length, sells0, "nothing sold");
});

test("part 2 (group 2, round 5): a timed-out stop's status check refused for room is a room wake with the check's two requests", async () => {
  const w = await roomWorld();
  w.mem.timedOutStops.set("cyrus-p-test-AAA", w.id);
  // Its cancel was accepted, and the list does not show the stop: the entry waits for the stop to end (status checks, no sale tries).
  w.mem.stuck.set(w.id, { symbol: "AAA", since: w.sim.simMs - 60_000, nextAt: 0, delayMs: 5_000, alerted: true, escalated: false, lastTriedAt: w.sim.simMs - 5_000, why: "x", restingStop: { stopClientOrderId: "cyrus-p-test-AAA", cancel: "accepted" } } as any);
  w.mem.timedOutCheck.set("cyrus-p-test-AAA", { probeAt: 0, resendAt: w.sim.simMs + 60_000, resendDelayMs: 5_000, probeFailed: false, probeFailDelayMs: 0 });
  w.box.remaining = 15; // no room for the check
  await w.sync();
  assert.deepEqual(w.wakes.at(-1)?.room, { cls: "P1", n: w.TIMED_OUT_CHECK_REQUESTS, reads: 2 });
  assert.equal(w.acts.length, 0);
});

test("part 2 (group 2, round 5): the 15 second limit's first try refused for room returns a room wake with the try's requests", async () => {
  const w = await roomWorld();
  w.mem.freshStops.set(w.id, { symbol: "AAA", entryClientOrderId: w.id, stopClientOrderId: "cyrus-p-test-AAA", orderId: null, qty: 5, stopPrice: 9.87, placedAt: w.sim.simMs - 16_000, status: "unclear", lookedAt: w.sim.simMs - 16_000 });
  await w.sync();
  assert.deepEqual(w.acts.map((a) => a.label), ["15 second limit"]);
  w.box.remaining = 30; // room for the limit's look (2), not for its try (13)
  const r = await w.acts[0]!.run();
  assert.deepEqual(r?.room, { cls: "P1", n: w.TIMED_OUT_TRY_REQUESTS, reads: 2 });
});

// Michael's ruling 1 of 2026-11-14 (night): a stuck sale (here every sale is refused by Alpaca) is tried again within a few seconds while the
// shared budget has room (2 s after its last try, as soon as there is room), each retry is one round and never sends more than the 10
// requests it reserved (no overdraft), and the budget's limits (60 a minute, 15 in any 5 seconds) hold.
test("Michael's ruling 1 of 2026-11-14: in the worker, a stuck sale retries within a few seconds while the budget has room, one round each, with no overdraft", async () => {
  const { sim, r } = await armedDay();
  const wk: any = r.worker;
  const id = await holdOne(sim, r, "QXA");
  await r.at("14:30:10");
  for (const l of sim.orders.find((o: any) => o.clientOrderId === id)!.legs) await sim.cancelOrder(l.id);
  sim.refuseSellIf = (x: any) => x.symbol === "QXA";
  const tries: number[] = [];
  const realSell = sim.submitSell.bind(sim);
  sim.submitSell = async (x: any) => {
    if (x.symbol === "QXA") tries.push(sim.simMs);
    return realSell(x);
  };
  const t0 = sim.simMs;
  await drive(r, sim, t0 + 60_000, t0 + 100);
  // The first try keeps its 3 rounds (a first try is counted, never refused); each retry after it is one round, so one sell each.
  const retries = tries.slice(3);
  const gaps = retries.slice(1).map((t, i) => t - retries[i]!);
  // At least 2 s apart; about 5 s while there is room, set by the budget's 15 in any 5 seconds (each retry reserves 10); after 4 retries
  // this one position has reserved 40 and a fifth would pass the 45 that ordinary stuck retries may use (Michael's answer of 2026-11-14,
  // night), so the next waits for the minute; the other 15 stay for urgent work.
  assert.ok(retries.length >= 4, `retried while there was room: ${retries.length} retries in about 60 s`);
  assert.ok(gaps.slice(0, 3).every((g) => g >= 2_000 && g <= 6_000), `within a few seconds, never sooner than 2 s: ${gaps.join(", ")}`);
  const b = wk.budget;
  assert.equal(b.totals.overdraft, 0, "no retry sent more than it reserved");
  assert.ok(b.peak.minute <= 45 && b.peak.five <= 15, `within the stuck retries' 45 a minute and the 15 in 5 seconds (minute ${b.peak.minute}, 5 s ${b.peak.five})`);
  r.worker.stop?.();
});

// The speed release, item 3d: with 30 positions whose sales Alpaca holds 8 s, a `flatten` asked partway through must start no slower than on
// 20ba5bd (Michael's change of direction of 2026-11-16: selling stays one at a time, as on 20ba5bd). Alpaca's live remaining count reaches
// the governor, as main.ts wires it. Returns when the whole-account sale started after it was asked, and more.
async function flattenPartway(flattenAfterMs: number, minutes: number) {
  const sim = new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  const bot = new FakeBot();
  const holds: Array<{ until: number; res: () => void }> = [];
  let timed = false;
  const tsleep = (ms: number): Promise<void> => (timed ? new Promise<void>((res) => holds.push({ until: sim.simMs + ms, res })) : sim.sleep(ms));
  const r = rig<SimBroker>({ broker: sim, sleep: tsleep, simClock: sim, bot });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("cap 2\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:05");
  const wk: any = r.worker;
  await r.at("20:40:00");
  const bad = Array.from({ length: 30 }, (_, i) => "QX" + String.fromCharCode(65 + i));
  for (const s of bad) await holdOne(sim, r, s);
  await r.at("20:40:01");
  const loseAt = new Date(`${D}T20:40:05Z`).getTime();
  const realSell = sim.submitSell.bind(sim);
  sim.submitSell = async (x: any) => {
    if (bad.includes(x.symbol)) {
      await tsleep(8_000);
      throw new Error("held at Alpaca (test)");
    }
    return realSell(x);
  };
  const liq: any = wk.liquidator;
  let wholeStartAt: number | null = null;
  const realRun = liq.run.bind(liq);
  liq.run = (o: any) => {
    if (!o.ownEntryOnly && wholeStartAt === null) wholeStartAt = sim.simMs;
    return realRun(o);
  };
  timed = true;
  let lowest = 200;
  const prev = (sim as any).onRate;
  (sim as any).onRate = (k: number) => {
    if (sim.simMs > loseAt) lowest = Math.min(lowest, k);
    r.governor.observe({ path: "/v2/orders", status: 200, limit: 200, remaining: k, reset: null });
    prev?.(k);
  };
  const r429 = sim.rejected429;
  let nextPass = sim.simMs + 5_000;
  const end = loseAt + minutes * 60_000;
  const flatAt = loseAt + flattenAfterMs;
  let flatP: Promise<unknown> | null = null;
  let lost = false;
  while (sim.simMs < end) {
    if (!lost && sim.simMs >= loseAt) {
      lost = true;
      for (const s of bad) for (const l of sim.orders.find((o: any) => o.clientOrderId === clientOrderIdFor(D, s, 1))!.legs) await sim.cancelOrder(l.id);
    }
    if (!flatP && sim.simMs >= flatAt) flatP = liq.flatten({ reason: "flatten command", tradeDate: D });
    if (sim.simMs >= nextPass) {
      void r.at(iso(sim.simMs));
      nextPass += 5_000;
    } else r.setNow(iso(sim.simMs + 100));
    for (const h of holds.filter((h) => h.until <= sim.simMs)) {
      holds.splice(holds.indexOf(h), 1);
      h.res();
    }
    await settle();
  }
  const out = { startAfterMs: wholeStartAt === null ? null : wholeStartAt - flatAt, rateLimited: sim.rejected429 - r429, lowest: Math.round(lowest), oversell: sim.oversellAttempts };
  timed = false;
  for (const h of holds.splice(0)) h.res();
  r.worker.stop?.();
  return out;
}

// The baselines are 20ba5bd's own figures for these same runs (the one-at-a-time queue), measured by the builder with this function on a
// clean extract of 20ba5bd on 2026-11-16: asked 20 s in, the flatten started 13.0 s later; asked 60 s in, 27.0 s later (group 1 measured 13 s
// and 27 s). With side-by-side sales (from 9fd9060 to be439ee) it was 2.0 to 7.0 s; they are out of this release (Michael's change of
// direction of 2026-11-16), so the one-at-a-time figure is pinned again.
for (const [after, baselineMs] of [[20_000, 13_000], [60_000, 27_000]] as const) {
  test(`speed release, item 3d: a flatten asked ${after / 1000} s into 30 held sales starts no slower than on 20ba5bd (${baselineMs / 1000} s)`, async () => {
    const r = await flattenPartway(after, after === 20_000 ? 2 : 3);
    assert.ok(r.startAfterMs !== null, "the flatten started");
    assert.ok(r.startAfterMs <= baselineMs, `started ${r.startAfterMs} ms after the ask (20ba5bd: ${baselineMs} ms); ${JSON.stringify(r)}`);
    assert.equal(r.rateLimited, 0, "no rate-limit answer");
    assert.ok(r.lowest >= 20, `remaining never below 20 (lowest ${r.lowest})`);
    assert.equal(r.oversell, 0);
  });
}
