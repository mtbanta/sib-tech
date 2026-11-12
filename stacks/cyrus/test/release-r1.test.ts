// Release 1 of 2026-11-09 (Michael's approval of parts A steps 1, 2 and 4, B and C of builds/c2-proposal-2026-11-09.md), with
// Monday's sequences replayed in the simulated broker: a cleanup sale working from an old order list must never cancel a newer
// position's exits or sell its shares (part B); a stuck symbol is retried on a short list instead of holding up the sync (part A);
// Michael hears once when a position is stuck, once after 5 minutes, and once when it resolves (part C).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate, OPEN_STATUSES } from "../src/sells.ts";
import { STUCK_ESCALATE_MS, STUCK_RETRY_COST, STUCK_RETRY_FIRST_MS, STUCK_RETRY_MAX_MS, STUCK_RETRY_PER_5S, STUCK_RETRY_PER_MINUTE, SyncMemory, syncOrders, takeRetryRoom } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";

const MID = Date.UTC(2026, 10, 2, 15, 0); // in the session

function world(mode: { hide?: boolean; noQty?: boolean } = {}) {
  const sim = new SimBroker(MID);
  sim.hideFilledParents = mode.hide === true;
  sim.reportQtyAvailable = mode.noQty !== true;
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: opts?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const risk = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log };
  return { sim, events, said, gate, liquidator, store, now, risk, memory };
}

// A filled bracket entry. `stored: false` stands for an entry bought after the sync read the stack's records.
async function hold(w: ReturnType<typeof world>, symbol: string, qty: number, price: number, n: number, stored = true) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.06, takeProfitPrice: price + 0.02, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  if (stored) await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.06, takeProfitPrice: price + 0.02, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}

// The sync's own reads (order list and positions) taken now and served later: Monday's minute-old list.
async function staleRisk(w: ReturnType<typeof world>) {
  const listed = structuredClone(await w.sim.listOrdersPaged("all", new Date(MID - 3_600_000).toISOString(), 20));
  const positions = structuredClone(await w.sim.listPositions());
  const broker = new Proxy(w.sim, {
    get(target, prop) {
      if (prop === "listOrdersPaged") return async () => structuredClone(listed);
      if (prop === "listPositions") return async () => structuredClone(positions);
      const v = (target as any)[prop];
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
  return { risk: { ...w.risk, broker: broker as any }, listed };
}

const legsOf = (w: ReturnType<typeof world>, id: string) => w.sim.orders.find((o) => o.clientOrderId === id)!.legs;
const mentions = (w: ReturnType<typeof world>) => w.said.filter((m) => m.ch === "alerts" && m.mention);

test("part B, Monday's APLD case: a remainder sale working from an old list, for an entry that has since finished at its take-profit, leaves the newer entry's exits and shares alone", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id107 = await hold(w, "APLD", 4, 16.46, 107);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id107, 2, 16.48); // Alpaca cancels the stop: 2 shares left without one
  w.sim.advance(4_000); // past the 3 second grace
  const stale = await staleRisk(w); // the sync reads its list here...
  w.sim.partialTakeProfit(id107, 2, 16.48); // ...APLD-107 then finishes at its take-profit
  w.sim.advance(6_000);
  const id108 = await hold(w, "APLD", 4, 16.46, 108, false); // and APLD-108 is bought, with live exits
  w.sim.advance(5_000);
  await syncOrders(stale.risk, day, { protect: true });
  assert.equal(w.sim.sellLog.length, 0, "nothing sold");
  assert.ok(legsOf(w, id108).every((l) => OPEN_STATUSES.has(l.status)), "APLD-108's exits are still live");
  assert.equal(w.sim.heldQty("APLD"), 4, "APLD-108's shares are still held");
  assert.equal(mentions(w).length, 0, "no alarm");
  assert.equal(w.said.filter((m) => m.ch === "alerts").length, 0, "never reported stuck, so no resolution line either");
  assert.ok(w.events.some((e) => e.event === "cleanup_skipped" && e.data.clientOrderId === id107), "the fresh look skipped it");
});

for (const [hide, noQty] of [[false, false], [true, false], [true, true]] as const) {
  test(`part B: an older entry with 1 share of its own left beside a newer position sells exactly that share and never touches the newer exits (open list ${hide ? "hides" : "shows"} filled entries' exits${noQty ? ", Alpaca reports no free count" : ""})`, async () => {
    const w = world({ hide, noQty });
    await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
    const day = (await w.store.getDay(D))!;
    const id107 = await hold(w, "APLD", 3, 16.46, 107);
    w.sim.advance(5_000);
    w.sim.partialTakeProfit(id107, 2, 16.48); // 1 left, the take-profit still open for it, the stop cancelled
    w.sim.advance(1_000);
    const id108 = await hold(w, "APLD", 4, 16.46, 108, false);
    w.sim.advance(4_000);
    const t0 = w.sim.simMs;
    await syncOrders(w.risk, day, { protect: true });
    assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["APLD", 1]], "only APLD-107's own share");
    assert.ok(w.sim.sellLog[0]!.at - t0 < 2_500, `sold ${w.sim.sellLog[0]!.at - t0} ms after the sync began: no wait on the newer exits`);
    assert.equal(w.sim.oversellAttempts, 0);
    assert.ok(legsOf(w, id108).every((l) => OPEN_STATUSES.has(l.status)), "APLD-108's exits are still live");
    w.sim.advance(5_000);
    assert.equal(w.sim.heldQty("APLD"), 4, "APLD-108's 4 shares are still held");
    assert.equal(mentions(w).length, 0);
    assert.ok(!w.said.some((m) => /reported it without a protective stop/.test(m.text)), "never reported stuck, so no resolution line");
  });
}

test("part B: a missing-exit sale working from an old list that shows the exits gone, while the entry's exits are in fact live, sells and cancels nothing", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "NCLH", 4, 18.38, 42);
  w.sim.advance(15_000);
  const stale = await staleRisk(w);
  for (const o of stale.listed.orders) if (o.clientOrderId === id) for (const l of o.legs) l.status = "canceled"; // the old list's view
  await syncOrders(stale.risk, day, { protect: true });
  assert.equal(w.sim.sellLog.length, 0);
  assert.ok(legsOf(w, id).every((l) => OPEN_STATUSES.has(l.status)), "its exits are untouched");
  assert.equal(mentions(w).length, 0);
});

test("part A and C, Monday's IONQ case: shares held with no open order visible; the attempt ends after one short round, is retried after 5, 10, 20 and then every 30 seconds, Michael hears once, once more after 5 minutes, and once when it is sold", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "IONQ", 2, 33.88, 125);
  for (const l of legsOf(w, id)) await w.sim.cancelOrder(l.id);
  w.sim.advance(2_000);
  w.sim.staleHeld.set("IONQ", 2); // Alpaca keeps the shares reported as not free
  const t0 = w.sim.simMs;
  const req0 = w.sim.requests;
  let r = await syncOrders(w.risk, day, { protect: true });
  assert.ok(w.sim.simMs - t0 < 2_000, `one short round, ${w.sim.simMs - t0} ms`);
  // 11 since A4 of 2026-11-12: the first sync after a start reads Alpaca's open orders once for resting fresh stops.
  assert.ok(w.sim.requests - req0 <= 11, `${w.sim.requests - req0} requests`);
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(mentions(w).length, 1, "one alert");
  assert.match(mentions(w)[0]!.text, /IONQ has 2 shares with no protective stop since \d{1,2}:\d{2} [AP]M CT, and I could not sell them yet.*will post again when they are sold or gone\./);
  assert.ok(r.recheckAt !== undefined, "a retry is set");
  const firstDue = r.recheckAt!;
  assert.ok(firstDue - w.sim.simMs <= STUCK_RETRY_FIRST_MS && firstDue - w.sim.simMs > STUCK_RETRY_FIRST_MS - 2_000, "about 5 seconds");
  // a sync before it is due does not try it
  w.sim.advance(2_000);
  const blocked0 = w.events.filter((e) => e.event === "sale_blocked").length;
  r = await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.events.filter((e) => e.event === "sale_blocked").length, blocked0, "not tried before it is due");
  assert.equal(r.recheckAt, firstDue);
  // the retries: 5, 10, 20, 30, 30 ... and one more alert after 5 minutes
  const gaps: number[] = [];
  let last = firstDue;
  while (w.sim.simMs - t0 < STUCK_ESCALATE_MS + 60_000) {
    w.sim.advanceTo(last);
    const at = w.sim.simMs;
    r = await syncOrders(w.risk, day, { protect: true });
    gaps.push(Math.round((r.recheckAt! - at) / 1000));
    last = r.recheckAt!;
  }
  assert.deepEqual(gaps.slice(0, 4), [10, 20, 30, 30], "after the first 5: 10, 20, then at most 30");
  assert.ok(gaps.every((g) => g <= STUCK_RETRY_MAX_MS / 1000));
  assert.equal(mentions(w).length, 2, "the first alert and one after 5 minutes, nothing in between");
  assert.match(mentions(w)[1]!.text, /still has no protective stop after 5 minutes.*Please close it in Alpaca's dashboard/);
  // Alpaca frees the shares: sold at the next try, one line without a mention
  w.sim.staleHeld.delete("IONQ");
  w.sim.advanceTo(last);
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["IONQ", 2]]);
  w.sim.advance(3_000);
  await syncOrders(w.risk, day, { protect: true });
  const lines = w.said.filter((m) => m.ch === "alerts" && m.text.includes("IONQ"));
  assert.equal(lines.length, 3, "three posts in all");
  assert.ok(/^IONQ: sold \(\d+ minutes after I reported it without a protective stop\)\.$/.test(lines[2]!.text) && !lines[2]!.mention, lines[2]!.text);
});

test("part A: a stuck symbol does not hold up a remainder's fresh stop (A4) on another symbol in the same sync", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const stuck = await hold(w, "IONQ", 1, 33.88, 125);
  for (const l of legsOf(w, stuck)) await w.sim.cancelOrder(l.id);
  w.sim.staleHeld.set("IONQ", 1);
  const cifr = await hold(w, "CIFR", 10, 7.27, 55);
  w.sim.advance(2_000);
  w.sim.partialTakeProfit(cifr, 3, 7.29);
  w.sim.advance(4_000);
  const t0 = w.sim.simMs;
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.stopLog.map((x) => [x.symbol, x.qty]), [["CIFR", 7]], "CIFR's remainder protected in the same sync");
  assert.ok(w.sim.stopLog[0]!.at - t0 < 3_000, `CIFR's fresh stop ${w.sim.stopLog[0]!.at - t0} ms after the sync began`);
});

test("part A and C: a sale held by a cancel still landing (visible) keeps the old waits, is tried again at the next sync, alerts once, and posts one line when sold (A4 fallback: Alpaca refuses the fresh stop, so the remainder is sold at market as before)", async () => {
  const w = world();
  w.sim.refuseStops = true;
  w.sim.cancelMs = 40_000; // longer than the whole attempt
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "RIOT", 4, 15, 31);
  w.sim.partialTakeProfit(id, 1, 15.02);
  w.sim.advance(4_000);
  const r = await syncOrders(w.risk, day, { protect: true });
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(r.recheckAt, undefined, "no short retry for a visible hold: the next sync tries again");
  assert.equal(mentions(w).length, 1);
  w.sim.advance(10_000);
  await syncOrders(w.risk, day, { protect: true }); // still held: no second alert
  assert.equal(mentions(w).length, 1);
  w.sim.advance(40_000); // the cancel has landed
  await syncOrders(w.risk, day, { protect: true });
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["RIOT", 3]]);
  w.sim.advance(3_000);
  await syncOrders(w.risk, day, { protect: true });
  const riot = w.said.filter((m) => m.ch === "alerts");
  assert.equal(riot.length, 2, "one alert and one resolution line, nothing else");
  const last = riot.at(-1)!;
  assert.ok(/^RIOT: (sold|no longer held) \(\d+ seconds after I reported it without a protective stop\)\.$/.test(last.text) && !last.mention, last.text);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("part B: once that entry's own share has filled, the cleanup sale stops looking (a newer position on the symbol stays held)", async () => {
  const w = world();
  w.sim.sellFillDelayMs = 300;
  const a = clientOrderIdFor(D, "APLD", 1);
  await w.sim.submitEntry({ symbol: "APLD", qty: 1, stopPrice: 16, takeProfitPrice: 17, referencePrice: 16.4, clientOrderId: a });
  w.sim.fillEntry(a, 16.4);
  for (const l of legsOf(w, a)) await w.sim.cancelOrder(l.id);
  const b = clientOrderIdFor(D, "APLD", 2);
  await w.sim.submitEntry({ symbol: "APLD", qty: 4, stopPrice: 16, takeProfitPrice: 17, referencePrice: 16.4, clientOrderId: b });
  w.sim.fillEntry(b, 16.4);
  w.sim.advance(2_000);
  const r0 = w.sim.requests, t0 = w.sim.simMs;
  const r = await w.liquidator.flatten({ reason: "no live protective stop", tradeDate: D, only: ["APLD"], maxRounds: 3, ownEntryOnly: { maxQty: { APLD: 1 } } });
  assert.deepEqual(r.sold, [{ symbol: "APLD", qty: 1 }]);
  assert.deepEqual(r.heldAfter, { APLD: 4 });
  assert.ok(w.sim.requests - r0 <= 15, `${w.sim.requests - r0} requests (22 without the stop)`);
  assert.ok(w.sim.simMs - t0 <= 1_500, `${w.sim.simMs - t0} ms (3,000 without the stop)`);
});

test("Michael's retry allowance: 40 requests a minute and 15 in any 5 seconds, each short retry counted at 10; the next room is computed", () => {
  assert.deepEqual([STUCK_RETRY_PER_MINUTE, STUCK_RETRY_PER_5S, STUCK_RETRY_COST], [40, 15, 10]);
  const mem = new SyncMemory();
  assert.deepEqual(takeRetryRoom(mem, 0), { ok: true });
  assert.deepEqual(takeRetryRoom(mem, 1_000), { ok: false, at: 5_000 }, "a second retry inside 5 seconds waits for the 5 second room");
  assert.deepEqual(takeRetryRoom(mem, 5_000), { ok: true });
  assert.deepEqual(takeRetryRoom(mem, 10_000), { ok: true });
  assert.deepEqual(takeRetryRoom(mem, 15_000), { ok: true });
  assert.deepEqual(takeRetryRoom(mem, 20_000), { ok: false, at: 60_000 }, "four retries in the minute (40 requests): the fifth waits for the first to age out");
  assert.deepEqual(takeRetryRoom(mem, 60_000), { ok: true });
});

test("Michael's retry allowance in the sync: ten symbols stuck at once all get their first sale at once, then their retries never exceed 4 a minute or 1 in 5 seconds, and the bucket stays above the reserve", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const syms = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH", "III", "JJJ"];
  for (const [i, sym] of syms.entries()) {
    const id = await hold(w, sym, 1, 10 + i, 1);
    for (const l of legsOf(w, id)) await w.sim.cancelOrder(l.id);
    w.sim.staleHeld.set(sym, 1);
  }
  w.sim.advance(2_000);
  const t0 = w.sim.simMs;
  w.sim.lowestTokens = w.sim.tokens;
  let r = await syncOrders(w.risk, day, { protect: true });
  const firstAttempts = new Set(w.events.filter((e) => e.event === "sale_blocked").map((e) => e.data.symbol));
  assert.equal(firstAttempts.size, 10, "every first sale ran at once, unlimited");
  const tries: number[] = [];
  const count = () => w.events.filter((e) => e.event === "sale_blocked").length;
  let seen = count();
  while (w.sim.simMs - t0 < 180_000) {
    w.sim.advanceTo(Math.min(r.recheckAt ?? w.sim.simMs + 10_000, w.sim.simMs + 10_000));
    r = await syncOrders(w.risk, day, { protect: true });
    const now = count();
    for (let k = seen; k < now; k++) tries.push(w.sim.simMs);
    seen = now;
  }
  assert.ok(tries.length >= 8, `retries still happen: ${tries.length} in 3 minutes`);
  for (const t of tries) {
    assert.ok(tries.filter((x) => x > t - 60_000 && x <= t).length <= 4, "at most 4 retries in any minute");
    assert.ok(tries.filter((x) => x > t - 5_000 && x <= t).length <= 1, "at most 1 retry in any 5 seconds");
  }
  assert.ok(w.sim.lowestTokens >= 80, `lowest bucket ${w.sim.lowestTokens}`);
  assert.equal(w.sim.rejected429, 0);
  assert.equal(mentions(w).length, 10, "one alert per position, no repeats");
});

for (const other of [false, true]) test(`part C: an entry reported stuck whose record is closed elsewhere (its hidden exit filled) gets exactly one resolution line, no mention${other ? ", with another position still open" : ""}`, async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  if (other) await hold(w, "RIG", 3, 5, 1); // another position, protected, stays open (so the sync does not take its early return)
  const id = await hold(w, "IONQ", 2, 33.88, 125);
  for (const l of legsOf(w, id)) await w.sim.cancelOrder(l.id);
  w.sim.advance(2_000);
  w.sim.staleHeld.set("IONQ", 2);
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(mentions(w).length, 1);
  await w.store.updateOrder(id, { closedAt: new Date(w.sim.simMs).toISOString() }); // the live updates closed the record
  w.sim.advance(10_000);
  await syncOrders(w.risk, day, { protect: true });
  w.sim.advance(10_000);
  await syncOrders(w.risk, day, { protect: true });
  const lines = w.said.filter((m) => m.ch === "alerts");
  assert.equal(lines.length, 2);
  assert.ok(/^IONQ: no longer held \(\d+ seconds after I reported it without a protective stop\)\.$/.test(lines[1]!.text) && !lines[1]!.mention, lines[1]!.text);
});

test("part C: an entry reported stuck that stops being the newest on its symbol gets one resolution line, no mention", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "IONQ", 2, 33.88, 125);
  for (const l of legsOf(w, id)) await w.sim.cancelOrder(l.id);
  w.sim.advance(2_000);
  w.sim.staleHeld.set("IONQ", 2);
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(mentions(w).length, 1);
  w.sim.advance(10_000);
  await hold(w, "IONQ", 1, 34, 126); // a newer IONQ entry on record
  await syncOrders(w.risk, day, { protect: true });
  const lines = w.said.filter((m) => m.ch === "alerts" && /reported it without a protective stop/.test(m.text));
  assert.equal(lines.length, 1);
  assert.match(lines[0]!.text, /^IONQ: a newer IONQ position took over, and I watch that one now \(\d+ seconds after I reported it without a protective stop\)\.$/);
  assert.ok(!lines[0]!.mention);
});

test("part A: a stuck remainder (its take-profit cancelled by the first attempt, Alpaca still holding the shares) moves to the short retry list and is not tried again before it is due", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "CIFR", 10, 7.27, 55);
  w.sim.partialTakeProfit(id, 3, 7.29);
  w.sim.advance(4_000);
  const old = await staleRisk(w); // a list that still shows the take-profit live (served to the third sync)
  w.sim.staleHeld.set("CIFR", 7);
  await syncOrders(w.risk, day, { protect: true }); // cancels the take-profit, waits, cannot sell: a visible hold
  assert.equal(mentions(w).length, 1);
  w.sim.advance(10_000);
  const r = await syncOrders(w.risk, day, { protect: true }); // nothing left to cancel: a hidden hold now
  assert.ok(r.recheckAt !== undefined && r.recheckAt - w.sim.simMs <= STUCK_RETRY_FIRST_MS, "on the short retry list");
  const n = w.events.filter((e) => e.event === "sale_blocked").length;
  w.sim.advance(2_000);
  await syncOrders(w.risk, day, { protect: true }); // the missing-exit path's skip
  await syncOrders(old.risk, day, { protect: true }); // the remainder path's skip (an old list shows the take-profit live)
  assert.equal(w.events.filter((e) => e.event === "sale_blocked").length, n, "not tried before it is due, on either path");
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(mentions(w).length, 1, "still one alert");
});

// Michael's decision of 2026-11-09 (after group 1 round 2): the allowance's room goes to the stuck entry that has waited longest.
async function stuckMany(n: number) {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const syms = Array.from({ length: n }, (_, i) => "S" + String.fromCharCode(65 + i) + "X");
  for (const [i, sym] of syms.entries()) {
    const id = await hold(w, sym, 1, 10 + i, 1);
    for (const l of legsOf(w, id)) await w.sim.cancelOrder(l.id);
    w.sim.staleHeld.set(sym, 1);
  }
  w.sim.advance(2_000);
  return { w, day, syms, t0: w.sim.simMs };
}
async function runFor(w: ReturnType<typeof world>, day: any, untilMs: number, onTick?: (t: number) => void) {
  let r = await syncOrders(w.risk, day, { protect: true });
  while (w.sim.simMs < untilMs) {
    w.sim.advanceTo(Math.min(r.recheckAt ?? w.sim.simMs + 10_000, w.sim.simMs + 10_000));
    onTick?.(w.sim.simMs);
    r = await syncOrders(w.risk, day, { protect: true });
  }
}

test("turns: five stuck, Alpaca frees the last one in the order after 60 seconds while the other four stay stuck: it is sold within about a minute and a half", async () => {
  const { w, day, syms, t0 } = await stuckMany(5);
  let freedAt = 0;
  await runFor(w, day, t0 + 240_000, (t) => {
    if (!freedAt && t - t0 >= 60_000) { freedAt = t; w.sim.staleHeld.delete(syms[4]!); }
  });
  const sale = w.sim.sellLog.find((x) => x.symbol === syms[4]);
  assert.ok(sale, "sold");
  assert.ok(sale!.at - freedAt <= 90_000, `sold ${Math.round((sale!.at - freedAt) / 1000)} s after Alpaca freed it`);
  assert.equal(w.sim.sellLog.length, 1, "the other four are still stuck");
});

test("turns: eight stuck, entries 5 to 8 freed after 60 seconds while 1 to 4 stay stuck: all four freed ones are sold within about two and a half minutes; every stuck one is tried in turn", async () => {
  const { w, day, syms, t0 } = await stuckMany(8);
  let freedAt = 0;
  await runFor(w, day, t0 + 360_000, (t) => {
    if (!freedAt && t - t0 >= 60_000) { freedAt = t; for (const sym of syms.slice(4)) w.sim.staleHeld.delete(sym); }
  });
  for (const sym of syms.slice(4)) {
    const sale = w.sim.sellLog.find((x) => x.symbol === sym);
    assert.ok(sale && sale.at - freedAt <= 150_000, `${sym} sold ${sale ? Math.round((sale.at - freedAt) / 1000) : "never"} s after it was freed`);
  }
  for (const sym of syms.slice(0, 4)) {
    const tries = w.events.filter((e) => e.event === "sale_blocked" && e.data.symbol === sym).length;
    assert.ok(tries >= 3, `${sym} tried ${tries} times in 6 minutes`);
  }
});

test("the 5 minute alert goes by the clock: eight stuck, each gets exactly one 5 minute alert by about 5 minutes and a half, though most retries wait for room", async () => {
  const { w, day, syms, t0 } = await stuckMany(8);
  await runFor(w, day, t0 + STUCK_ESCALATE_MS + 30_000);
  for (const sym of syms) {
    const esc = w.said.filter((m) => m.mention && m.text.includes(`${sym} still has no protective stop after`));
    assert.equal(esc.length, 1, `${sym}: ${esc.length} five minute alerts`);
  }
  assert.equal(mentions(w).length, 16, "one first alert and one 5 minute alert each, nothing else");
});

test("Michael's decision 'Mid-day owns it': while the mid-day close-out is selling, the stuck-entry 5 minute alert stands aside; it comes once afterwards if still stuck", async () => {
  const w = world();
  await ensureDay({ store: w.store, broker: w.sim, now: w.now }, D);
  const day = (await w.store.getDay(D))!;
  const id = await hold(w, "IONQ", 2, 33.88, 125);
  for (const l of legsOf(w, id)) await w.sim.cancelOrder(l.id);
  w.sim.advance(2_000);
  w.sim.staleHeld.set("IONQ", 2);
  await syncOrders(w.risk, day, { protect: true });
  assert.equal(mentions(w).length, 1, "the first stuck alert");
  let owns = true;
  w.sim.advance(STUCK_ESCALATE_MS + 30_000);
  await syncOrders(w.risk, day, { protect: false, middayOwnsSelling: () => owns });
  assert.equal(mentions(w).length, 1, "no 5 minute alert while the mid-day close-out owns selling");
  owns = false;
  w.sim.advance(10_000);
  await syncOrders(w.risk, day, { protect: true, middayOwnsSelling: () => owns });
  assert.equal(mentions(w).filter((m) => /still has no protective stop after/.test(m.text)).length, 1, "once afterwards");
});
