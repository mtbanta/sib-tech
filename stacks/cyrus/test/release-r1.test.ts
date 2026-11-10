// Release 1 of 2026-11-09 (Michael's approval of parts A steps 1, 2 and 4, B and C of builds/c2-proposal-2026-11-09.md), with
// Monday's sequences replayed in the simulated broker: a cleanup sale working from an old order list must never cancel a newer
// position's exits or sell its shares (part B); a stuck symbol is retried on a short list instead of holding up the sync (part A);
// Michael hears once when a position is stuck, once after 5 minutes, and once when it resolves (part C).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate, OPEN_STATUSES } from "../src/sells.ts";
import { STUCK_ESCALATE_MS, STUCK_RETRY_FIRST_MS, STUCK_RETRY_MAX_MS, SyncMemory, syncOrders } from "../src/risk.ts";
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
  assert.ok(w.sim.requests - req0 <= 10, `${w.sim.requests - req0} requests`);
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(mentions(w).length, 1, "one alert");
  assert.match(mentions(w)[0]!.text, /IONQ has 2 shares with no protective stop, and I could not sell them yet/);
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
  assert.ok(/IONQ: sold after \d+ minutes without a protective stop\./.test(lines[2]!.text) && !lines[2]!.mention, lines[2]!.text);
});

test("part A: a stuck symbol does not hold up a remainder sale on another symbol in the same sync", async () => {
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
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["CIFR", 7]], "CIFR's remainder sold in the same sync");
  assert.ok(w.sim.sellLog[0]!.at - t0 < 3_000, `CIFR sold ${w.sim.sellLog[0]!.at - t0} ms after the sync began`);
});

test("part A and C: a sale held by a cancel still landing (visible) keeps the old waits, is tried again at the next sync, alerts once, and posts one line when sold", async () => {
  const w = world();
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
  const last = w.said.filter((m) => m.ch === "alerts").at(-1)!;
  assert.ok(/RIOT: (sold|no longer held) after .* without a protective stop\./.test(last.text) && !last.mention, last.text);
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
