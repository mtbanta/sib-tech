// The night release of 2026-11-12 (Michael's rulings of 2026-11-12, afternoon). Ruling B: a fresh stop still unclear 15 seconds after
// it was sent is cancelled by its client id (if Alpaca has it), Alpaca's cancel is waited for, and the remainder is sold through the
// checked sell path, with an alert to Michael at once and one line when it resolves; unclear fresh stops are looked up every 5 seconds;
// every fresh stop's time to confirm is stored.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Liquidator, SellGate } from "../src/sells.ts";
import { FRESH_STOP_CONFIRM_MS, SyncMemory, syncOrders } from "../src/risk.ts";
import { MemoryStore } from "../src/store.ts";
import { ensureDay } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { AlpacaError } from "../src/alpaca-trading.ts";
import { SimBroker } from "./sim-broker.ts";
import { D } from "./rig.ts";
import { FRESH_STOP_LIMIT as RULING_B } from "../src/risk.ts";
import { Reservation, RequestBudget, withReservation } from "../src/request-budget.ts";
import { currentTag } from "../src/request-scope.ts";

// These tests check ruling B switched on, whatever the shipped default of the switch (Michael's decision 2 of 2026-11-13: a release with B
// off ships the same code with the switch's default off). Node runs each test file in its own process.
RULING_B.on = true;

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day
// Every wording Michael's decision 2 of 2026-11-13 retired (a claim that there is no stop, or a guess that one may rest).
// Group 2, round 2 of the weekend build: and a reason stated in the present tense from an older check.
const OLD_WORDING = /has no protective stop|no live protective stop|without a protective stop|may still be resting|\(its fresh stop \(not confirmed in time\) is still open|\(Alpaca has not finished cancelling/;

function world() {
  const sim = new SimBroker(MID);
  const events: Array<{ event: string; data: any; at: number }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data, at: sim.simMs });
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  // Michael's decision 2 of 2026-11-13 (group 2, round 1 of the weekend build): any message with an old wording fails the test at once,
  // whoever posts it (the sell gate posts through this too).
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => {
    assert.ok(!OLD_WORDING.test(text), `old wording posted: ${text}`);
    said.push({ ch, text, mention: opts?.mentionOwner });
    return true;
  };
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  // The redesign of 2026-11-14, part 1: the shared request budget, on the simulated clock (the risk code keeps it in the sync's memory).
  memory.budget = new RequestBudget({ now: () => sim.simMs, log });
  // Requests the simulated broker received, by the tag of the scope they were made in (the oracle for what the budget charges: a first
  // try inside a recheck sync is counted as a first try, never charged to the recheck).
  const tagged: Record<string, number> = { entry: 0, first: 0, P1: 0, P2: 0, routine: 0 };
  sim.onSend = () => void (tagged[currentTag()] = (tagged[currentTag()] ?? 0) + 1);
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  return { sim, events, said, store, now, risk, memory, tagged };
}

// The worker's scheduling of syncs since the redesign of 2026-11-14 (part 1), as worker.ts does it: the walk's own recheck time (its
// `recheckAt`), the list-lag recheck on its own timer (`SyncMemory.lagRecheck`) run as a sync inside a P2 reservation of the shared budget
// (waiting for room, until the last lagging remainder's window ends), or the 10 s sync, whichever is first. `onSync` is told each sync's
// start (ms from `t0`), what it asked for next (ms from its end), whether it was a recheck, and the requests the simulated broker received
// during it.
async function drive(w: World, dd: any, opts: any, t0: number, untilMs: number, stop: () => boolean = () => false, onSync?: (x: { at: number; inMs: number | undefined; recheck: boolean; requests: number; used: number | null }) => void): Promise<void> {
  let lastSync = w.sim.simMs;
  let lagDue = false;
  let first = true;
  while (w.sim.simMs < untilMs && !stop()) {
    const lr = w.memory.lagRecheck;
    let res: Reservation | null = null;
    if (!first && lagDue) {
      if (!lr || w.sim.simMs >= lr.until) {
        // The window is over: the timer drops it and the regular sync carries on.
        w.memory.lagRecheck = undefined;
        lagDue = false;
        w.sim.advanceTo(Math.min(lastSync + 10_000, untilMs));
        continue;
      }
      const g = w.memory.budget!.tryReserve("P2", lr.cost, { label: "list lag recheck", waitKey: "list lag recheck" });
      if (!(g instanceof Reservation)) {
        const at = Math.min(g.at, lr.until);
        lagDue = at < lastSync + 10_000;
        w.sim.advanceTo(Math.min(lagDue ? at : lastSync + 10_000, untilMs));
        continue;
      }
      res = g;
    }
    first = false;
    const start = w.sim.simMs;
    const before = w.tagged.P2!;
    const r: any = res ? await withReservation(res, () => syncOrders(w.risk, dd, opts)) : await syncOrders(w.risk, dd, opts);
    lastSync = start;
    const lrNow = w.memory.lagRecheck;
    const inMs = lrNow ? lrNow.dueAt - w.sim.simMs : r.recheckAt !== undefined ? r.recheckAt - w.sim.simMs : undefined;
    onSync?.({ at: start - t0, inMs, recheck: res !== null, requests: w.tagged.P2! - before, used: res ? res.used : null });
    const cands: Array<[number, boolean]> = [[w.sim.simMs + 10_000, false]];
    if (r.recheckAt !== undefined) cands.push([Math.max(w.sim.simMs + 100, Math.min(r.recheckAt, w.sim.simMs + 10_000)), false]);
    if (lrNow) cands.push([Math.max(w.sim.simMs, Math.min(lrNow.dueAt, lrNow.until)), true]);
    cands.sort((a, b) => a[0] - b[0]);
    lagDue = cands[0]![1];
    w.sim.advanceTo(Math.min(cands[0]![0], untilMs));
  }
}
type World = ReturnType<typeof world>;

async function hold(w: World, symbol: string, qty: number, price: number, n: number) {
  const id = clientOrderIdFor(D, symbol, n);
  await w.sim.submitEntry({ symbol, qty, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, referencePrice: price, clientOrderId: id });
  w.sim.fillEntry(id, price);
  await w.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty, referencePrice: price, stopPrice: price - 0.13, takeProfitPrice: price + 0.08, status: "filled", alpacaOrderId: null, filledQty: qty, filledAvgPrice: price, note: null, createdAt: new Date(w.sim.simMs - 1000).toISOString() });
  return id;
}
async function day(w: World) {
  await ensureDay({ store: w.store, broker: w.sim, now: w.now } as any, D);
  return (await w.store.getDay(D))!;
}
const freshStops = (w: World, symbol: string) => w.sim.orders.filter((o) => o.symbol === symbol && o.side === "sell" && o.type === "stop" && o.clientOrderId.startsWith("cyrus-p-"));
const heldQty = async (w: World, symbol: string) => (await w.sim.listPositions()).find((p) => p.symbol === symbol)?.qty ?? 0;

// Every fresh stop's answer is unclear (a 502), and lookups of fresh stops by client id fail. `create`: whether Alpaca in fact took it.
function unclearStops(w: World, create: boolean) {
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (s: any) => {
    if (s.stopPrice !== undefined) {
      if (create) await realSubmit(s);
      throw new AlpacaError("outcome unclear (test)", 502);
    }
    return realSubmit(s);
  };
  const realFind = w.sim.findOrderByClientId.bind(w.sim);
  let lookupsFail = true;
  w.sim.findOrderByClientId = async (id: string) => {
    if (id.startsWith("cyrus-p-") && lookupsFail) throw new Error("lookup timed out (test)");
    return realFind(id);
  };
  return { lookupsWork: () => void (lookupsFail = false) };
}

test("ruling B: a fresh stop still unclear 15 s after it was sent is treated as unprotected: Michael is alerted at once, the remainder is sold, and one line follows when it is sold", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "WULF", 6, 9.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 9.58);
  unclearStops(w, false); // Alpaca did not take it, and cannot be asked
  w.sim.advance(300);
  const sentAt = w.sim.simMs;
  const r1 = await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.memory.freshStops.get(id)!.status, "unclear");
  assert.ok(r1.recheckAt! <= sentAt + 2_500);
  // Looked up every 5 seconds while unclear: each sync asks again and brings the next one within 5 seconds.
  w.sim.advance(2_000);
  const r2 = await syncOrders(w.risk, dd, { protect: true });
  assert.ok(r2.recheckAt !== undefined && r2.recheckAt - w.sim.simMs <= 5_000, `next look in ${r2.recheckAt! - w.sim.simMs} ms`);
  assert.equal(w.sim.sellLog.length, 0, "no sale before 15 seconds");
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.sim.sellLog.length, 0);
  w.sim.advance(FRESH_STOP_CONFIRM_MS - 7_000);
  await syncOrders(w.risk, dd, { protect: true });
  const alert = w.said.find((m) => m.ch === "alerts" && m.mention && m.text.includes("was not confirmed within 15 seconds"));
  assert.ok(alert, JSON.stringify(w.said));
  assert.match(alert!.text, /^\*\*Michael: WULF's fresh protective stop for 4 shares was not confirmed within 15 seconds, so I treat them as unprotected\.\*\*/);
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["WULF", 4]], "the remainder sold at market through the checked path");
  assert.equal(w.sim.oversellAttempts, 0);
  const ev = w.events.find((e) => e.event === "fresh_stop_timeout")!;
  assert.ok(ev.data.msFromSent >= FRESH_STOP_CONFIRM_MS);
  assert.equal(ev.data.found, "not in Alpaca's open orders", "the client id lookup failed; Alpaca's open orders (the second way) do not show it");
  // The one line when it resolves.
  for (let i = 0; i < 3 && (await heldQty(w, "WULF")) > 0; i++) {
    w.sim.advance(2_000);
    await syncOrders(w.risk, dd, { protect: true });
  }
  assert.equal(await heldQty(w, "WULF"), 0);
  assert.ok(w.said.some((m) => m.ch === "alerts" && m.text.startsWith("WULF: ") && /after I reported that I could not confirm its protective stop/.test(m.text)), JSON.stringify(w.said.map((m) => m.text)));
  assert.equal(w.said.filter((m) => m.mention).length, 1, "one alert mentioning Michael");
});

test("ruling B: when Alpaca did take the unclear stop, it is cancelled by its client id, the sale waits for Alpaca's cancel, then sells; never two sales of the same shares", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "IREN", 8, 20, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 3, 20.08);
  const ctl = unclearStops(w, true);
  // The sync's own order list does not show the stop either (it stays unclear until the limit).
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return a[0] === "all" ? { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) } : r;
  };
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(freshStops(w, "IREN").length, 1, "Alpaca holds the stop");
  for (const step of [2_000, 5_000, 5_000]) {
    w.sim.advance(step);
    await syncOrders(w.risk, dd, { protect: true });
  }
  assert.equal(w.sim.sellLog.length, 0);
  ctl.lookupsWork(); // at the limit the lookup by client id answers
  w.sim.advance(3_500);
  await syncOrders(w.risk, dd, { protect: true });
  for (let i = 0; i < 3 && (await heldQty(w, "IREN")) > 0; i++) {
    w.sim.advance(1_500);
    await syncOrders(w.risk, dd, { protect: true });
  }
  assert.equal(freshStops(w, "IREN")[0]!.status, "canceled", "the unconfirmed stop was cancelled");
  assert.deepEqual(w.sim.sellLog.map((x) => [x.symbol, x.qty]), [["IREN", 5]]);
  assert.equal(await heldQty(w, "IREN"), 0);
  assert.equal(w.sim.oversellAttempts, 0, "never a sale on top of the stop");
  assert.ok(w.events.some((e) => e.event === "fresh_stop_timeout" && e.data.cancelling === true));
});

test("ruling B: a timed-out stop found only later (both reads failed at the limit) is never taken as protection again: it is cancelled and the shares sold", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "RIOT", 5, 18, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 18.08);
  unclearStops(w, true);
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return a[0] === "all" ? { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) } : r;
  };
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  // At the limit, Alpaca's open orders cannot be read either (the second way to find the stop).
  const realList = w.sim.listOrders.bind(w.sim);
  let openFails = true;
  w.sim.listOrders = async (status: any, after?: string) => {
    if (status === "open" && openFails) {
      openFails = false; // only the timeout's own read fails; the sale's reads answer
      throw new Error("timeout (test)");
    }
    return realList(status, after);
  };
  w.sim.advance(FRESH_STOP_CONFIRM_MS);
  await syncOrders(w.risk, dd, { protect: true });
  // Item 2 of 2026-11-13: the tries are charged to the stuck-retry allowance per request (40 a minute, 15 in 5 seconds), so they are spaced.
  for (let i = 0; i < 60 && (await heldQty(w, "RIOT")) > 0; i++) {
    w.sim.advance(1_500);
    await syncOrders(w.risk, dd, { protect: true });
  }
  assert.equal(freshStops(w, "RIOT")[0]!.status, "canceled", "cancelled when the sale saw it working");
  assert.ok(w.events.some((e) => e.event === "fresh_stop_timeout_cancel"));
  assert.equal(await heldQty(w, "RIOT"), 0);
  assert.equal(w.sim.oversellAttempts, 0);
  assert.ok(!w.events.some((e) => e.event === "fresh_stop_recovered"), "never re-adopted as protection");
});

test("ruling B: time to confirm is stored for every fresh stop: Alpaca's answer for a clear one, and the lookup time for an unclear one confirmed later", async () => {
  const w = world();
  const dd = await day(w);
  const a = await hold(w, "QXO", 10, 13.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(a, 1, 13.58);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const clear = w.events.find((e) => e.event === "fresh_stop")!;
  assert.equal(clear.data.confirmedBy, "answer");
  assert.equal(typeof clear.data.msToConfirm, "number");

  const b = await hold(w, "SOFI", 6, 9, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(b, 2, 9.08);
  const ctl = unclearStops(w, true);
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...x: any[]) => {
    const r: any = await (realPaged as any)(...x);
    return x[0] === "all" ? { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) } : r;
  };
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(2_000);
  await syncOrders(w.risk, dd, { protect: true });
  ctl.lookupsWork();
  w.sim.advance(3_000);
  await syncOrders(w.risk, dd, { protect: true });
  const conf = w.events.find((e) => e.event === "fresh_stop_confirmed" && e.data.symbol === "SOFI")!;
  assert.ok(conf, JSON.stringify(w.events.map((e) => e.event)));
  assert.equal(conf.data.by, "lookup");
  assert.equal(conf.data.found, true);
  assert.ok(conf.data.msToConfirm >= 5_000 && conf.data.msToConfirm < FRESH_STOP_CONFIRM_MS, `${conf.data.msToConfirm}`);
  assert.equal(conf.data.afterLimit, false);
  assert.equal(w.sim.sellLog.length, 0, "confirmed in time: nothing sold");
});

test("ruling B: an unclear fresh stop that the sync's own order list shows working is confirmed there (time logged) and never cancelled at the limit", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "LUNR", 5, 12, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 12.08);
  unclearStops(w, true); // Alpaca took it; lookups by client id fail, but the sync's own list shows it
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  for (const step of [2_000, 5_000, 5_000, 5_000, 10_000]) {
    w.sim.advance(step);
    await syncOrders(w.risk, dd, { protect: true });
  }
  const conf = w.events.find((e) => e.event === "fresh_stop_confirmed" && e.data.symbol === "LUNR");
  assert.ok(conf, JSON.stringify(w.events.map((e) => e.event)));
  assert.equal(conf!.data.by, "order list");
  assert.ok(conf!.data.msToConfirm < FRESH_STOP_CONFIRM_MS);
  assert.ok(!w.events.some((e) => e.event === "fresh_stop_timeout"));
  assert.equal(freshStops(w, "LUNR")[0]!.status, "accepted", "the stop rests");
  assert.equal(w.sim.sellLog.length, 0);
});

test("group 2, round 1 (night): no 5 minute escalation while ruling B's own sale is working at Alpaca, and the one line comes when it fills", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "WULF", 6, 9.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 9.58);
  unclearStops(w, false);
  w.sim.sellFillDelayMs = 7 * 60_000; // Alpaca holds the sale about 7 minutes
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.advance(FRESH_STOP_CONFIRM_MS);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.sim.sellLog.length, 1, "the sale was sent");
  for (let i = 0; i < 50; i++) {
    w.sim.advance(10_000);
    await syncOrders(w.risk, dd, { protect: true });
  }
  assert.ok(!w.said.some((m) => m.text.includes("has no protective stop")), w.said.map((m) => m.text).join(" | "));
  assert.equal(w.said.filter((m) => m.mention).length, 1, "only the one alert at once");
  assert.equal(await heldQty(w, "WULF"), 0);
  assert.ok(w.said.some((m) => m.text.startsWith("WULF: ")), w.said.map((m) => m.text).join(" | "));
});

test("group 2, round 1 (night): every unclear fresh stop ends in one outcome event; one whose stop filled first ends in fresh_stop_unclear_end, joined by its stop's client id", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "PLUG", 4, 3, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 3.08);
  unclearStops(w, true);
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return a[0] === "all" ? { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) } : r;
  };
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const sent = w.events.find((e) => e.event === "fresh_stop_unclear")!;
  assert.ok(sent.data.stopClientOrderId?.startsWith("cyrus-p-"), "the join key");
  w.sim.triggerStop("PLUG"); // the stop fills before anything confirms it
  for (let i = 0; i < 4; i++) {
    w.sim.advance(3_000);
    await syncOrders(w.risk, dd, { protect: true });
  }
  const ends = w.events.filter((e) => ["fresh_stop_confirmed", "fresh_stop_timeout", "fresh_stop_unclear_end"].includes(e.event) && e.data.stopClientOrderId === sent.data.stopClientOrderId);
  assert.equal(ends.length, 1, JSON.stringify(w.events.map((e) => e.event)));
  assert.equal(ends[0]!.event, "fresh_stop_unclear_end");
  assert.equal(w.sim.oversellAttempts, 0);
});

test("group 1, round 1 (night): with the live updates on, an entry older than the sync's 10 minute list still gets its unclear stop looked up every 5 seconds and its limit at 15 seconds", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "OLD", 5, 12, 1);
  w.sim.advance(11 * 60_000); // older than the sync's 10 minute list
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  w.sim.partialTakeProfit(id, 1, 12.08);
  w.risk.syncMemory.mustLook.add(id); // as the live update of the stop's cancel does
  unclearStops(w, false);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.equal(w.memory.freshStops.get(id)?.status, "unclear");
  const sentAt = w.memory.freshStops.get(id)!.placedAt; // when the stop was sent
  let lookups = 0;
  const realFind = w.sim.findOrderByClientId.bind(w.sim);
  w.sim.findOrderByClientId = async (x: string) => (x.startsWith("cyrus-p-") && lookups++, realFind(x));
  for (const t of [2_500, 7_500, 12_500]) {
    w.sim.advance(sentAt + t - w.sim.simMs);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.ok(lookups >= 3, `${lookups} lookups of the unclear stop before the limit`);
  assert.ok(!w.events.some((e) => e.event === "fresh_stop_timeout"));
  w.sim.advance(sentAt + 15_200 - w.sim.simMs);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const ev = w.events.find((e) => e.event === "fresh_stop_timeout");
  assert.ok(ev, "the limit at 15 seconds");
  assert.ok(ev!.data.msFromSent < 16_000, `${ev!.data.msFromSent}`);
});

test("group 1, round 1 (night): a stop that hit the limit and later shows working in the sync's own list is cancelled, then the shares are sold", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "RKLB", 5, 20, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 20.08);
  unclearStops(w, true);
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  let hide = true;
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return hide && a[0] === "all" ? { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) } : r;
  };
  // At the limit nothing can find it: the lookup fails and so do the open orders (the timeout's own read and the sale's).
  const realList = w.sim.listOrders.bind(w.sim);
  let openFails = false;
  w.sim.listOrders = async (status: any, after?: string) => {
    if (status === "open" && openFails) throw new Error("timeout (test)");
    return realList(status, after);
  };
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  openFails = true;
  w.sim.advance(FRESH_STOP_CONFIRM_MS);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(w.events.some((e) => e.event === "fresh_stop_timeout"));
  // Later the sync's own list shows the stop working.
  openFails = false;
  hide = false;
  for (let i = 0; i < 5 && (await heldQty(w, "RKLB")) > 0; i++) {
    w.sim.advance(2_000);
    await syncOrders(w.risk, dd, { protect: true });
  }
  assert.ok(w.events.some((e) => e.event === "fresh_stop_timeout_cancel"), JSON.stringify(w.events.map((e) => e.event)));
  assert.equal(freshStops(w, "RKLB")[0]!.status, "canceled");
  assert.equal(await heldQty(w, "RKLB"), 0);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("group 2, round 2 (night): a fresh stop our own sell gate stopped before any request is logged with sentToAlpaca false", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "NIO", 5, 5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 5.08);
  // The sell gate reads the position before sending; that read fails only for the fresh stop's check.
  const realPositions = w.sim.listPositions.bind(w.sim);
  let failNext = false;
  const realSubmit = w.sim.submitSell.bind(w.sim);
  (w.risk.liquidator as any).d.gate.d.broker = new Proxy(w.sim, { get: (t: any, k) => (k === "listPositions" && failNext ? async () => { failNext = false; throw new Error("read timed out (test)"); } : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  w.sim.submitSell = async (s: any) => realSubmit(s);
  const realStop = (w.risk.liquidator as any).d.gate.sell.bind((w.risk.liquidator as any).d.gate);
  (w.risk.liquidator as any).d.gate.sell = async (req: any) => {
    if (req.stopPrice !== undefined) failNext = true;
    return realStop(req);
  };
  void realPositions;
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const ev = w.events.find((e) => e.event === "fresh_stop_unclear");
  assert.ok(ev, JSON.stringify(w.events.map((e) => e.event)));
  assert.equal(ev!.data.sentToAlpaca, false);
  assert.equal(freshStops(w, "NIO").length, 0, "nothing reached Alpaca");
});

// ---------------- group 1, round 2 (night): a timed-out stop that shows up working later ----------------

// The stop timed out while hidden from every read; then it shows working in the sync's own list.
async function timedOutThenVisible(w: World, symbol = "RKLB", n = 1, price = 20) {
  const dd = await day(w);
  const id = await hold(w, symbol, 5, price, n);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, price + 0.08);
  return { dd, id };
}
function hideAndFail(w: World) {
  unclearStops(w, true);
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  const ctl = { hide: true, openFails: false };
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return ctl.hide && a[0] === "all" ? { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) } : r;
  };
  const realList = w.sim.listOrders.bind(w.sim);
  w.sim.listOrders = async (status: any, after?: string) => {
    if (status === "open" && ctl.openFails) throw new Error("timeout (test)");
    return realList(status, after);
  };
  return ctl;
}
// The worker's scheduling, roughly: the 10 second sync, or the recheck it asks for (250 ms slack, at least 100 ms on).
async function runWorker(w: World, dd: any, ms: number) {
  const end = w.sim.simMs + ms;
  while (w.sim.simMs < end) {
    const r = await syncOrders(w.risk, dd, { protect: true });
    const next = r.recheckAt !== undefined ? Math.max(w.sim.simMs + 100, Math.min(r.recheckAt + 250, w.sim.simMs + 10_000)) : w.sim.simMs + 10_000;
    w.sim.advanceTo(Math.min(next, end));
  }
}

for (const cancelMs of [200, 1_400, 3_000, 8_700, 11_000]) {
  test(`group 1, round 2 (night): a timed-out stop seen working later is cancelled by its entry's sale, which waits for Alpaca's cancel (pending ${cancelMs / 1000} s) and sells soon after it lands`, async () => {
    const w = world();
    const { dd } = await timedOutThenVisible(w);
    const ctl = hideAndFail(w);
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    ctl.openFails = true;
    w.sim.advance(FRESH_STOP_CONFIRM_MS);
    await syncOrders(w.risk, dd, { protect: true });
    assert.ok(w.events.some((e) => e.event === "fresh_stop_timeout"));
    ctl.openFails = false;
    ctl.hide = false;
    w.sim.cancelMs = cancelMs;
    const stopId = freshStops(w, "RKLB")[0]!.id;
    let cancelAt: number | null = null;
    const realCancel = w.sim.cancelOrder.bind(w.sim);
    w.sim.cancelOrder = async (id: string) => {
      if (id === stopId && cancelAt === null) cancelAt = w.sim.simMs;
      return realCancel(id);
    };
    await runWorker(w, dd, 60_000);
    const sale = w.sim.sellLog.find((x) => x.symbol === "RKLB");
    assert.ok(cancelAt !== null && sale, "cancelled, then sold");
    const gap = sale!.at - (cancelAt! + cancelMs);
    console.log(`MEASURE pending ${cancelMs} ms: sale ${gap} ms after Alpaca's cancel landed`);
    // Item 2 of 2026-11-13: the live updates are down here, so the stop's status is checked every 10 seconds (the sync's own list), and
    // the sale follows within one try (before item 2: the sale's own 6 second wait caught it, at up to 40 polls a minute).
    assert.ok(gap <= 11_000, `sale ${gap} ms after Alpaca's cancel landed`);
    assert.equal(await heldQty(w, "RKLB"), 0);
    assert.equal(w.sim.oversellAttempts, 0);
  });
}

test("group 1, round 2 (night): cancels Alpaca keeps refusing for 3 timed-out stops are retried on the backoff within the shared request budget, never every second, and never a sale on top", async () => {
  const w = world();
  const dd = await day(w);
  const ids: string[] = [];
  for (const [i, sym] of ["AAA", "BBB", "CCC"].entries()) {
    const id = await hold(w, sym, 5, 20 + i, 1);
    ids.push(id);
  }
  w.sim.advance(5_000);
  for (const [i, id] of ids.entries()) w.sim.partialTakeProfit(id, 1, 20 + i + 0.08);
  const ctl = hideAndFail(w);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  ctl.openFails = true;
  w.sim.advance(FRESH_STOP_CONFIRM_MS);
  await syncOrders(w.risk, dd, { protect: true });
  ctl.openFails = false;
  ctl.hide = false;
  const stopIds = new Set(w.sim.orders.filter((o) => o.clientOrderId.startsWith("cyrus-p-")).map((o) => o.id));
  assert.equal(stopIds.size, 3);
  const cancelTimes: number[] = [];
  const realCancel = w.sim.cancelOrder.bind(w.sim);
  w.sim.cancelOrder = async (id: string) => {
    if (stopIds.has(id)) {
      cancelTimes.push(w.sim.simMs);
      throw new AlpacaError("internal error (test)", 500);
    }
    return realCancel(id);
  };
  const t0 = w.sim.simMs;
  await runWorker(w, dd, 5 * 60_000);
  const reqs = w.sim.bucketTimes.filter((t) => t >= t0);
  const maxIn = (arr: number[], win: number) => Math.max(0, ...arr.map((t) => arr.filter((x) => x >= t && x < t + win).length));
  console.log(`MEASURE refused cancels, 3 stops, 5 minutes: ${cancelTimes.length} cancels (most in a minute ${maxIn(cancelTimes, 60_000)}, in 5 s ${maxIn(cancelTimes, 5_000)}); requests ${reqs.length} (most in a minute ${maxIn(reqs, 60_000)})`);
  // Item 2 of 2026-11-13: each cancel sent again is one request, a P1 try of the shared request budget, on the backoff (5, 10, 20, then 30 s): at most
  // about 4 a stop in a minute (before: whole tries of about 10 requests each, at most 4 a minute in all).
  assert.ok(maxIn(cancelTimes, 60_000) <= 4 * 3, `cancels in a minute ${maxIn(cancelTimes, 60_000)}: at most 4 a stop`);
  assert.ok(maxIn(reqs, 60_000) <= 120, `requests in a minute ${maxIn(reqs, 60_000)}: Alpaca's 200 minus the reserve of 80`);
  assert.equal(w.sim.oversellAttempts, 0);
  // The stops then trigger: still never a sale on top of them.
  for (const sym of ["AAA", "BBB", "CCC"]) w.sim.triggerStop(sym);
  await runWorker(w, dd, 30_000);
  assert.equal(w.sim.oversellAttempts, 0);
  for (const sym of ["AAA", "BBB", "CCC"]) assert.equal(await heldQty(w, sym), 0);
});

// ---------------- ruling C: the order index ----------------
import { CachingStore } from "../src/caching-store.ts";
import { DayOrders, dayOrderIndex, isActiveOrder, activeOrdersOldestFirst } from "../src/order-index.ts";

test("ruling C: the caching store's index always agrees with the full list (symbols, per symbol, still working), through inserts, updates and live-update closes", async () => {
  const inner = new MemoryStore();
  let t = Date.UTC(2026, 10, 2, 15, 0);
  const store = new CachingStore(inner, () => t);
  const syms = ["AAA", "BBB", "CCC", "DDD"];
  let seed = 7;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
  const ids: string[] = [];
  for (let i = 0; i < 400; i++) {
    t += 100;
    const op = rnd(4);
    if (op === 0 || ids.length === 0) {
      const sym = syms[rnd(syms.length)]!;
      const id = `cyrus-20261102-${sym}-${i}`;
      ids.push(id);
      await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: sym, qty: 1, referencePrice: 10, stopPrice: 9.9, takeProfitPrice: 10.1, status: "intent", alpacaOrderId: null, filledQty: null, filledAvgPrice: null, note: null, createdAt: new Date(t).toISOString() });
    } else if (op === 1) await store.updateOrder(ids[rnd(ids.length)]!, { status: (["submitted", "filled", "canceled", "failed"] as const)[rnd(4)] });
    else if (op === 2) await store.updateOrderSoon(ids[rnd(ids.length)]!, { closedAt: new Date(t).toISOString() });
    else await store.updateOrder(ids[rnd(ids.length)]!, { filledQty: 1 });
    if (i % 20 === 0 || i === 399) {
      const list = await store.listOrders(D);
      const idx = await dayOrderIndex(store, D);
      assert.equal(idx.size, list.length);
      for (const s of [...syms, "ZZZ"]) {
        assert.equal(idx.hasSymbol(s), list.some((o) => o.symbol === s), s);
        assert.deepEqual(idx.forSymbol(s).map((o) => o.clientOrderId).sort(), list.filter((o) => o.symbol === s).map((o) => o.clientOrderId).sort());
      }
      assert.deepEqual(idx.active().map((o) => o.clientOrderId).sort(), list.filter(isActiveOrder).map((o) => o.clientOrderId).sort());
      assert.deepEqual((await activeOrdersOldestFirst(store, D)).map((o) => o.clientOrderId), list.filter(isActiveOrder).map((o) => o.clientOrderId), "the sync's order: oldest first, as the full sorted list");
    }
  }
});

test("ruling C: the gate no longer copies or sorts the day's whole list on each decision (the full list is read once, at the first load)", async () => {
  const { OrderGate } = await import("../src/gate.ts");
  const { BrokerView } = await import("../src/broker-view.ts");
  const { Governor } = await import("../src/governor.ts");
  const { FakeBroker } = await import("./helpers.ts");
  const { updatePause } = await import("../src/midday.ts");
  const inner = new MemoryStore();
  let now = new Date(Date.UTC(2026, 10, 2, 15, 0));
  const store = new CachingStore(inner, () => now.getTime());
  let fullReads = 0;
  const realList = store.listOrders.bind(store);
  store.listOrders = async (d: string) => (fullReads++, realList(d));
  const broker = new FakeBroker();
  const governor = new Governor(() => now.getTime());
  const view = new BrokerView(broker, () => now.getTime());
  const say = async () => true;
  const liquidator = new Liquidator({ broker, gate: new SellGate({ broker, say: say as any }), now: () => now, sleep: async () => undefined });
  await ensureDay({ broker, store, now: () => now, say: say as any, liquidator } as any, D);
  await store.updateDay(D, { status: "approved", limits: { maxPositionUsd: 300, dailyLossStopUsd: 500, maxTradesPerMinute: 100, borrowingCap: 1 }, decided: { position: true, loss: true, trades: true, cap: true }, phases: { request: "x", armed: "2026-11-02T14:25:00.000Z" } } as any);
  await updatePause(store, D, { on: false });
  const gate = new OrderGate({ broker, store, view, governor, now: () => now, say: say as any, note: () => undefined });
  for (let i = 0; i < 30; i++) {
    now = new Date(now.getTime() + 1_000);
    const r = await gate.enter({ symbol: `S${i}`, price: 10, tradeTime: new Date(now.getTime() - 200), stopPrice: 9.9, takeProfitPrice: 10.1 });
    assert.equal(r.status, "sent", (r as any).reason);
  }
  assert.equal(fullReads, 0, "the gate read the index, never the full sorted list");
  assert.equal((await dayOrderIndex(store, D)).size, 30);
});

test("ruling C: the index built from any store's list (the tests' memory store) has the same shape", () => {
  const rows = [
    { clientOrderId: "a", symbol: "X", status: "filled", closedAt: null },
    { clientOrderId: "b", symbol: "X", status: "canceled", closedAt: null },
    { clientOrderId: "c", symbol: "Y", status: "submitted", closedAt: "2026-11-02T15:00:00Z" },
  ] as any[];
  const idx = new DayOrders(rows);
  assert.equal(idx.size, 3);
  assert.deepEqual(idx.active().map((o) => o.clientOrderId), ["a"]);
  assert.equal(idx.forSymbol("X").length, 2);
  assert.equal(idx.hasSymbol("Z"), false);
});

// ---------------- Michael's decisions of 2026-11-13: the round 3 fixes ----------------
import { FRESH_STOP_LIMIT } from "../src/risk.ts";

// Stops placed with an unclear answer that Alpaca did take, timed out while hidden from every read (the 15 second limit), then the
// sync's own "all" list hides them (`hide`) or shows them, and the sale's open-orders read shows them.
async function timedOutStops(w: World, syms: string[], hide: boolean) {
  const dd = await day(w);
  const ids: string[] = [];
  for (const [i, sym] of syms.entries()) ids.push(await hold(w, sym, 5, 20 + i, 1));
  w.sim.advance(5_000);
  for (const [i, id] of ids.entries()) w.sim.partialTakeProfit(id, 1, 20 + i + 0.08);
  const ctl = hideAndFail(w);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  ctl.openFails = true;
  w.sim.advance(FRESH_STOP_CONFIRM_MS);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.events.filter((e) => e.event === "fresh_stop_timeout").length, syms.length);
  ctl.openFails = false;
  ctl.hide = hide;
  const stopIds = new Set(w.sim.orders.filter((o) => o.clientOrderId.startsWith("cyrus-p-")).map((o) => o.id));
  assert.equal(stopIds.size, syms.length);
  return { dd, ids, stopIds, ctl };
}
const maxInWindow = (arr: number[], win: number) => Math.max(0, ...arr.map((t) => arr.filter((x) => x >= t && x < t + win).length));
// Alpaca answers each cancel of these stops but keeps showing them working (status "new") until `untilMs`.
function acceptedButStillWorking(w: World, stopIds: Set<string>, untilMs: number): number[] {
  const realCancel = w.sim.cancelOrder.bind(w.sim);
  const times: number[] = [];
  w.sim.cancelOrder = async (id: string) => {
    if (stopIds.has(id)) {
      times.push(w.sim.simMs);
      if (w.sim.simMs < untilMs) {
        (w.sim as any).spend("safety");
        return;
      }
    }
    return realCancel(id);
  };
  return times;
}

for (const n of [1, 3]) {
  test(`group 1, round 3 (night, Michael's decision 1 of 2026-11-13): ${n} timed-out stop(s) the sync's list does not show, whose accepted cancel does not clear for 60 s: only the first accepted cancel gets a look in a second, then the stuck backoff within the shared request budget; with routine traffic beside, no rate-limit answer`, async () => {
    const w = world();
    const syms = ["AAA", "BBB", "CCC"].slice(0, n);
    const { dd, stopIds } = await timedOutStops(w, syms, true);
    const t0 = w.sim.simMs;
    const r0 = w.sim.rejected429;
    // 75 requests a minute of routine traffic beside: the bucket refills at 200 - 75 and starts at 120 (the reviewer's probe).
    w.sim.refillPerMinute = 125;
    w.sim.tokens = 120;
    w.sim.lowestTokens = 120;
    const times = acceptedButStillWorking(w, stopIds, t0 + 60_000);
    await runWorker(w, dd, 60_000);
    const reqs = w.sim.bucketTimes.filter((t) => t >= t0 && t < t0 + 60_000);
    const spent = w.memory.budget!.totals.P1;
    console.log(`MEASURE round 3 fix, hidden route, accepted cancel held 60 s, ${n} stop(s): cancels ${times.length} (most in 5 s ${maxInWindow(times, 5_000)}); requests in the minute ${reqs.length}; lowest tokens ${Math.floor(w.sim.lowestTokens)} (from 120); rate-limit answers ${w.sim.rejected429 - r0}; retry charges ${spent}`);
    assert.equal(w.sim.rejected429 - r0, 0, "no rate-limit answer");
    assert.ok(w.sim.lowestTokens >= 30, `lowest tokens ${w.sim.lowestTokens}: before the fix, one stop drove it to 0`);
    // Per stop: the first cancel, the look a second later (a second cancel), then the backoff: 5, 10, 20, 30 s apart. At most 6 in the minute.
    assert.ok(times.length <= 6 * n, `cancels ${times.length}: at most 6 a stop in the minute (before the fix, about 15)`);
    assert.ok(spent >= 1, "the retries were charged to the shared request budget (P1)");
    assert.ok(reqs.length <= 80 + 35 * n, `requests in the minute ${reqs.length} (before the fix: about 290 for one stop, 374 for three)`);
    assert.equal(w.sim.oversellAttempts, 0);
    // Alpaca's cancel then takes effect: the shares are sold once a try (P1 tries of the shared request budget, shared among the stops)
    // sends the cancel again, and nothing is oversold.
    await runWorker(w, dd, 240_000);
    for (const sym of syms) assert.equal(await heldQty(w, sym), 0, `${sym} sold once the stop really ended`);
    assert.equal(w.sim.oversellAttempts, 0);
  });
}

test("group 1, round 3 (night, Michael's decision 1 of 2026-11-13): a timed-out stop the sync's list shows, whose accepted cancel stays pending 120 s: the sale that waited for it goes on the stuck backoff (not every sync), its outcome is logged after the cancel was tried, and it sells once the cancel lands", async () => {
  const w = world();
  const { dd, ids, stopIds } = await timedOutStops(w, ["RKLB"], false);
  w.sim.cancelMs = 120_000;
  const times: number[] = [];
  const realCancel = w.sim.cancelOrder.bind(w.sim);
  w.sim.cancelOrder = async (id: string) => {
    if (stopIds.has(id)) times.push(w.sim.simMs);
    return realCancel(id);
  };
  const t0 = w.sim.simMs;
  w.sim.tokens = 200;
  w.sim.lowestTokens = 200;
  await runWorker(w, dd, 40_000);
  const st = w.memory.stuck.get(ids[0]!);
  assert.ok(st && st.delayMs > 0 && st.nextAt > 0, "on the backoff after a stuck try with a pending cancel (before: retried at every sync)");
  // Item 2 of 2026-11-13: while the stop is shown open, its cancel is sent by the status check (no sale try).
  const outcome = w.events.filter((e) => e.event === "fresh_stop_timeout_cancel" && (e.data.by === "missing-exit sale" || e.data.by === "status check"));
  assert.ok(outcome.length >= 1, "the cancel's outcome is logged by the sale");
  await runWorker(w, dd, 140_000);
  const reqs = w.sim.bucketTimes.filter((t) => t >= t0);
  const sale = w.sim.sellLog.find((x) => x.symbol === "RKLB");
  console.log(`MEASURE round 3 fix, visible route, cancel pending 120 s: sale tries ${w.events.filter((e) => e.event === "unprotected_position" && e.data.symbol === "RKLB").length}; requests most in a minute ${maxInWindow(reqs, 60_000)}; lowest tokens ${Math.floor(w.sim.lowestTokens)}; sale at ${sale ? Math.round((sale.at - t0) / 100) / 10 : null} s; oversell ${w.sim.oversellAttempts}`);
  assert.ok(maxInWindow(reqs, 60_000) <= 170, `requests in a minute ${maxInWindow(reqs, 60_000)}`);
  assert.equal(await heldQty(w, "RKLB"), 0);
  assert.equal(w.sim.oversellAttempts, 0);
});

const RESTING = "still resting at Alpaca";
// Group 2, round 4: swept over start times, so the 5 minute mark falls at different points of a try (inside a sale's wait, too).
for (const c of [
  { name: "shown in the sync's list, cancel pending", hide: false, mode: "pending", want: "Alpaca shows it pending cancel but has not finished cancelling it" },
  { name: "shown in the sync's list, cancel accepted but the stop still working", hide: false, mode: "accepted", want: "Alpaca accepted my cancel of it but still shows it working" },
  { name: "shown in the sync's list, every cancel refused", hide: false, mode: "refused", want: "Alpaca did not accept my last cancel of it" },
  { name: "hidden from the sync's list, cancel pending", hide: true, mode: "pending", want: "At my last check its fresh stop (not confirmed in time) was still resting at Alpaca; Alpaca showed it pending cancel" },
  { name: "hidden from the sync's list, cancel accepted but the stop still working", hide: true, mode: "accepted", want: "At my last check its fresh stop (not confirmed in time) was still resting at Alpaca; Alpaca had accepted my cancel of it but still showed it working" },
  { name: "hidden from the sync's list, every cancel refused", hide: true, mode: "refused", want: "At my last check its fresh stop (not confirmed in time) was still resting at Alpaca; Alpaca did not accept my last cancel of it" },
] as const) {
  test(`group 2, rounds 3 and 4 (night): the 5 minute alert tells the truth when the timed-out stop still rests at Alpaca (${c.name}), whenever the 5 minute mark falls`, async () => {
    for (const shift of [0, 4_000, 8_000, 13_000, 15_000, 19_000, 24_000, 27_000]) {
      const w = world();
      const { dd, stopIds } = await timedOutStops(w, ["RKLB"], c.hide);
      if (c.mode === "refused") {
        const realCancel = w.sim.cancelOrder.bind(w.sim);
        w.sim.cancelOrder = async (id: string) => {
          if (stopIds.has(id)) {
            (w.sim as any).spend("safety");
            throw new AlpacaError("internal error (test)", 500);
          }
          return realCancel(id);
        };
      } else if (c.mode === "accepted") acceptedButStillWorking(w, stopIds, Infinity);
      else w.sim.cancelMs = 10 * 60_000;
      w.sim.advance(shift);
      await runWorker(w, dd, 5 * 60_000 + 40_000);
      const five = w.said.filter((m) => m.mention && /(after|, )\d+ minutes?( on)?[;*]|after \d+ minute/.test(m.text));
      const at = `shift ${shift / 1000} s: `;
      assert.equal(five.length, 1, at + (five.map((m) => m.text).join(" | ") || "no 5 minute alert"));
      assert.ok(five[0]!.text.includes(RESTING), at + five[0]!.text);
      assert.ok(five[0]!.text.includes(c.want), at + five[0]!.text);
      assert.ok(!OLD_WORDING.test(five[0]!.text), at + five[0]!.text);
      assert.equal(await heldQty(w, "RKLB"), 4, at + "the stop still holds the shares (nothing sold on top)");
      assert.equal(w.sim.oversellAttempts, 0);
    }
  });
}

test("group 1 note of round 4 (night): a timed-out stop pending cancel that the sync's list does not show is retried on the stuck backoff, not at every sync", async () => {
  const w = world();
  const { dd, ids } = await timedOutStops(w, ["RKLB"], true);
  w.sim.cancelMs = 10 * 60_000;
  const t0 = w.sim.simMs;
  await runWorker(w, dd, 3 * 60_000);
  const tries = w.events.filter((e) => e.event === "unprotected_position" && e.data.symbol === "RKLB");
  const reqs = w.sim.bucketTimes.filter((t) => t >= t0 + 60_000 && t < t0 + 180_000);
  const st = w.memory.stuck.get(ids[0]!)!;
  console.log(`MEASURE round 4 fix, hidden route, stop pending cancel: tries in 3 minutes ${tries.length}; requests in minutes 2 to 3 ${reqs.length}; delay ${st.delayMs} ms; budgeted P1 requests ${w.memory.budget!.totals.P1}, most in a minute ${w.memory.budget!.peak.minute}`);
  void st;
  // Item 2 of 2026-11-13: while the stop is known pending cancel no sale is tried; its status is checked (here those checks fail, so the
  // tries go on, as P1 tries of the shared request budget and spaced by it).
  const gaps = tries.map((e, i) => (i ? e.at - tries[i - 1]!.at : Infinity)).slice(1);
  assert.ok(tries.length <= 10, `tries ${tries.length} (before: about 15 in 3 minutes, one a sync)`);
  assert.ok(gaps.every((g) => g >= 4_000), `tries spaced at least 4 s apart: ${gaps.join(", ")}`);
  assert.ok(w.memory.budget!.peak.minute <= 60, `the shared budget's minute (most ${w.memory.budget!.peak.minute})`);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("group 2, round 4 (night): a cancel of a timed-out stop the sale never sent (it gave way to the loss stop's sale) is logged as not sent, never as accepted, and not remembered as accepted", async () => {
  // Since item 2 of 2026-11-13 a stop shown open is waited on (no sale try), so the case is the 15 second limit's own try: its lookup finds
  // the stop open, and its sale gives way to the loss stop's sale before sending anything.
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "RKLB", 5, 20, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 20.08);
  const u = unclearStops(w, true);
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  const stopIds = new Set(freshStops(w, "RKLB").map((o) => o.id));
  const sent: string[] = [];
  const realCancel = w.sim.cancelOrder.bind(w.sim);
  w.sim.cancelOrder = async (oid: string) => {
    if (stopIds.has(oid)) sent.push(oid);
    return realCancel(oid);
  };
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return a[0] === "all" ? { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) } : r;
  };
  u.lookupsWork();
  (w.risk.liquidator as any).priorityPending = 1;
  const before = w.events.length;
  w.sim.advance(FRESH_STOP_CONFIRM_MS);
  await syncOrders(w.risk, dd, { protect: true });
  const ev = w.events.slice(before).filter((e) => e.event.startsWith("fresh_stop_timeout_cancel"));
  assert.ok(w.events.slice(before).some((e) => e.event === "fresh_stop_timeout" && e.data.cancelling === true));
  assert.equal(sent.length, 0);
  assert.deepEqual(ev.map((e) => e.event), ["fresh_stop_timeout_cancel_not_sent"]);
  assert.equal(w.memory.timedOutCancelAccepted.size, 0);
});

test("Michael's decision 2 of 2026-11-13 (the split): with ruling B switched off, an unclear fresh stop is handled as on Fly release v20: no 15 second limit, no cancel, no sale on top, no alert, no 5 second lookups", async () => {
  FRESH_STOP_LIMIT.on = false;
  try {
    const w = world();
    const dd = await day(w);
    const id = await hold(w, "WULF", 6, 9.5, 1);
    w.sim.advance(5_000);
    w.sim.partialTakeProfit(id, 2, 9.58);
    const u = unclearStops(w, true); // Alpaca did take it, and cannot be asked
    w.sim.advance(300);
    await syncOrders(w.risk, dd, { protect: true });
    assert.equal(w.memory.freshStops.get(id)!.status, "unclear");
    assert.equal(w.memory.mustLook.has(id), false, "no 5 second lookups of an old entry");
    await runWorker(w, dd, 60_000);
    assert.equal(w.events.filter((e) => e.event.startsWith("fresh_stop_timeout")).length, 0, "no limit");
    assert.equal(w.memory.timedOutStops.size, 0);
    assert.equal(freshStops(w, "WULF").filter((o) => o.status === "new" || o.status === "accepted").length, 1, "the stop still rests at Alpaca, not cancelled");
    assert.equal(await heldQty(w, "WULF"), 4, "nothing sold on top of it");
    assert.equal(w.said.filter((m) => m.mention).length, 0, "no alert");
    // As on v20: the sync's own list shows the stop working, so its symbol counts as having a working sell and is skipped (protected);
    // nothing confirms it from the list (that confirmation is part of ruling B).
    u.lookupsWork();
    await runWorker(w, dd, 10_500);
    assert.equal(w.memory.freshStops.get(id)?.status, "unclear");
    assert.equal(await heldQty(w, "WULF"), 4);
    assert.equal(w.sim.oversellAttempts, 0);
  } finally {
    FRESH_STOP_LIMIT.on = true;
  }
});

test("group 1, round 3 (night): the live update that a timed-out stop ended clears its entry's backoff time and the resting-stop note, and looks at the entry at once (no wait for the backoff)", async () => {
  const { rig } = await import("./rig.ts");
  const r = rig({ orderStream: true });
  const wk: any = r.worker;
  wk.startOrderStream(D);
  const mem: SyncMemory = wk.syncMemory;
  // The redesign of 2026-11-14, part 2: a wake of the protection loop for the entry (it was a sync brought forward).
  const syncs: number[] = [];
  wk.loop.wake = (id: string, atMs: number) => void (id === "cyrus-20261102-RKLB-1" && syncs.push(atMs));
  mem.timedOutStops.set("cyrus-p-20261102-RKLB-x-s1", "cyrus-20261102-RKLB-1");
  mem.stuck.set("cyrus-20261102-RKLB-1", { symbol: "RKLB", since: 0, nextAt: 9e15, delayMs: 30_000, alerted: true, escalated: false, lastTriedAt: 0, why: "x", restingStop: { stopClientOrderId: "cyrus-p-20261102-RKLB-x-s1", cancel: "accepted" } });
  const hook = wk.orderHandler.d.onFreshStopUpdate;
  hook({ clientOrderId: "cyrus-p-20261102-RKLB-x-s1", symbol: "RKLB", event: "new", status: "new", atMs: 0 });
  assert.equal(mem.stuck.get("cyrus-20261102-RKLB-1")!.nextAt, 9e15, "an update that is not an end changes nothing");
  assert.equal(syncs.length, 0);
  hook({ clientOrderId: "cyrus-p-20261102-RKLB-x-s1", symbol: "RKLB", event: "canceled", status: "canceled", atMs: 0 });
  const st = mem.stuck.get("cyrus-20261102-RKLB-1")!;
  assert.equal(st.nextAt, 0, "the sale is due now");
  assert.equal(st.restingStop, undefined, "the 5 minute alert no longer says the stop rests at Alpaca");
  assert.equal(syncs.length, 1, "the entry is looked at at once");
  // Group 1, round 6 note (the wiring): while another liquidation runs (a close-out, `flatten`) the hook asks for no look, but it still records
  // the end, so that sale does not back off afterwards. (Since part 2 of the redesign, the entry's own cleanup sale does not count here.)
  mem.timedOutStops.set("cyrus-p-20261102-RKLB-x-s2", "cyrus-20261102-RKLB-1");
  st.nextAt = 9e15;
  wk.liquidator.isLiquidatingOthers = () => true;
  hook({ clientOrderId: "cyrus-p-20261102-RKLB-x-s2", symbol: "RKLB", event: "canceled", status: "canceled", atMs: 0 });
  assert.ok(mem.timedOutEndedAt.has("cyrus-p-20261102-RKLB-x-s2"), "the end is recorded while a sale runs");
  assert.equal(st.nextAt, 0);
  assert.equal(syncs.length, 1, "no look asked for while another liquidation runs (as on v20)");
  wk.endOrderStream?.();
});

// ---------------- round 5 fixes ----------------
import { noteTimedOutStopEnded } from "../src/risk.ts";

// The worker's live update (onFreshStopUpdate) at the moment Alpaca's cancel of the timed-out stop lands: the real hook function, and a sync
// at once when no sale is running (as the worker does). Returns the time from the cancel landing to our sale.
async function raceRun(hide: boolean, pendMs: number): Promise<{ gap: number | null; oversell: number }> {
  const w = world();
  const { dd } = await timedOutStops(w, ["RKLB"], hide);
  w.sim.cancelMs = pendMs;
  const stop = w.sim.orders.find((o) => o.clientOrderId.startsWith("cyrus-p-"))!;
  let landedAt: number | null = null;
  let syncNow = false;
  const realAdvance = w.sim.advance.bind(w.sim);
  (w.sim as any).advance = (ms: number) => {
    const before = stop.status;
    realAdvance(ms);
    if (landedAt === null && before !== "canceled" && stop.status === "canceled") {
      landedAt = w.sim.simMs;
      noteTimedOutStopEnded(w.memory, stop.clientOrderId, w.sim.simMs);
      if (!(w.risk.liquidator as any).isLiquidating()) syncNow = true;
    }
  };
  w.sim.sleep = async (ms: number) => (w.sim as any).advance(ms);
  (w.risk.liquidator as any).sleep = w.sim.sleep;
  const end = w.sim.simMs + pendMs + 90_000;
  while (w.sim.simMs < end && !w.sim.sellLog.some((x) => x.symbol === "RKLB")) {
    syncNow = false;
    const r = await syncOrders(w.risk, dd, { protect: true });
    const next = r.recheckAt !== undefined ? Math.max(w.sim.simMs + 100, Math.min(r.recheckAt + 250, w.sim.simMs + 10_000)) : w.sim.simMs + 10_000;
    while (w.sim.simMs < Math.min(next, end) && !syncNow) (w.sim as any).advance(50);
  }
  const sale = w.sim.sellLog.find((x) => x.symbol === "RKLB")?.at ?? null;
  return { gap: sale !== null && landedAt !== null ? sale - landedAt : null, oversell: w.sim.oversellAttempts };
}
for (const hide of [true, false]) {
  test(`group 1, round 5 (night): with the live updates on, the sale comes within a second of the timed-out stop's cancel landing, even when the update arrives during that entry's own sale (${hide ? "hidden from" : "shown in"} the sync's list; cancel pending 0.5 to 45 s)`, async () => {
    let worst = 0;
    for (let p = 500; p <= 45_000; p += 500) {
      const r = await raceRun(hide, p);
      assert.ok(r.gap !== null, `pending ${p} ms: no sale`);
      worst = Math.max(worst, r.gap!);
      if (process.env.RACE_DUMP) console.log(`RACE ${hide ? "hidden" : "visible"} pending ${p} gap ${r.gap}`);
      // Item 2 of 2026-11-13: the tries are P1 tries of the shared request budget, and its 15 in 5 seconds can be full for about 5 seconds after
      // the try that sent the cancel; once that has passed, the live update brings the sale at once.
      assert.ok(r.gap! <= (p >= 6_000 ? 1_000 : 6_000), `pending ${p} ms: sale ${r.gap} ms after the cancel landed (before the fix: up to 30 s)`);
      assert.equal(r.oversell, 0);
    }
    console.log(`MEASURE round 5 fix, live update during the sale, ${hide ? "hidden" : "visible"}: worst ${worst} ms from the cancel landing to the sale`);
  });
}

const fiveMinute = (w: World) => w.said.filter((m) => m.mention && /minute/.test(m.text) && !/within 15 seconds/.test(m.text));
for (const hide of [false, true]) {
  test(`group 2, round 5 (night): with the live updates off, a timed-out stop whose cancel lands between tries near the 5 minute mark is never called "still resting" once the sync's list shows it ended (${hide ? "hidden from" : "shown in"} the list)`, async () => {
    for (let land = 270_000; land <= 340_000; land += 2_000) {
      const w = world();
      const statusAt: string[] = [];
      const realSay = w.risk.say;
      w.risk.say = async (ch: string, text: string, opts?: any) => {
        if (opts?.mentionOwner) statusAt.push(String(w.sim.orders.find((o) => o.clientOrderId.startsWith("cyrus-p-"))?.status));
        return realSay(ch, text, opts);
      };
      const { dd } = await timedOutStops(w, ["RKLB"], hide);
      const before = w.said.length;
      const statusBefore = statusAt.length;
      w.sim.cancelMs = land;
      await runWorker(w, dd, 5 * 60_000 + 60_000);
      const five = w.said.slice(before).filter((m) => m.mention && /minute/.test(m.text));
      const statuses = statusAt.slice(statusBefore);
      assert.ok(five.length <= 1, `land ${land / 1000} s: ${five.length} alerts`);
      for (const [i, m] of five.entries()) {
        const at = `land ${land / 1000} s, stop ${statuses[i]} at the alert: `;
        if (statuses[i] === "canceled") assert.ok(!m.text.includes("is still resting"), at + m.text);
        if (statuses[i] === "canceled" && !hide) assert.ok(m.text.includes("now shows its fresh stop (not confirmed in time) ended") || m.text.includes("has ended at Alpaca; the sale is due"), at + m.text);
        assert.ok(!OLD_WORDING.test(m.text) || statuses[i] === "canceled", at + m.text);
      }
      assert.equal(w.sim.oversellAttempts, 0);
    }
  });
}

for (const hide of [false, true]) {
  test(`group 2, round 5 (night): a try that gives way to the loss stop's sale keeps the note, so the 5 minute alert still says the stop rests at Alpaca (${hide ? "hidden from" : "shown in"} the list, cancel pending)`, async () => {
    const w = world();
    const { dd } = await timedOutStops(w, ["RKLB"], hide);
    w.sim.cancelMs = 10 * 60_000;
    await runWorker(w, dd, 4 * 60_000 + 30_000);
    (w.risk.liquidator as any).priorityPending = 1;
    await runWorker(w, dd, 70_000);
    const five = fiveMinute(w);
    assert.equal(five.length, 1, five.map((m) => m.text).join(" | ") || "no 5 minute alert");
    assert.ok(five[0]!.text.includes("still resting at Alpaca"), five[0]!.text);
    assert.ok(!OLD_WORDING.test(five[0]!.text), five[0]!.text);
  });
}

for (const hide of [false, true]) {
  test(`group 2, round 6 (night): when Alpaca's open-orders read fails inside the sale near the 5 minute mark, the alert never says "no protective stop" while the timed-out stop rests at Alpaca (${hide ? "hidden from" : "shown in"} the sync's list, cancel pending)`, async () => {
    for (let y = 240_000; y <= 320_000; y += 10_000) for (const len of [10_000, 40_000]) {
      const w = world();
      const { dd } = await timedOutStops(w, ["RKLB"], hide);
      w.sim.cancelMs = 10 * 60_000;
      const t0 = w.sim.simMs;
      let inSale = false;
      const liq = w.risk.liquidator as any;
      const realFlatten = liq.flatten.bind(liq);
      liq.flatten = async (...a: any[]) => {
        inSale = true;
        try {
          return await realFlatten(...a);
        } finally {
          inSale = false;
        }
      };
      const realList = w.sim.listOrders.bind(w.sim);
      w.sim.listOrders = async (status: any, after?: string) => {
        const t = w.sim.simMs - t0;
        if (inSale && status === "open" && t >= y && t < y + len) throw new Error("open orders timeout (test)");
        return realList(status, after);
      };
      await runWorker(w, dd, 6 * 60_000);
      const five = fiveMinute(w);
      const at = `window ${y / 1000} s for ${len / 1000} s: `;
      assert.equal(five.length, 1, at + (five.map((m) => m.text).join(" | ") || "no 5 minute alert"));
      assert.ok(five[0]!.text.includes("still resting at Alpaca"), at + five[0]!.text);
      assert.ok(!OLD_WORDING.test(five[0]!.text), at + five[0]!.text);
      assert.equal(w.sim.oversellAttempts, 0);
    }
  });
}

// Group 1 and group 2, round 7: the sale's step 3 re-read of positions fails once near the 5 minute mark (its look never saw the stop).
import { readFileSync } from "node:fs";
const REREAD_LINE = readFileSync(new URL("../src/sells.ts", import.meta.url), "utf8").split("\n").findIndex((l) => l.includes("freshPositions = await heldNow();")) + 1;
for (const hide of [false, true]) {
  test(`group 1 and group 2, round 7 (night): a failed step 3 re-read of positions near the 5 minute mark never yields "no protective stop" while the timed-out stop rests at Alpaca (${hide ? "hidden from" : "shown in"} the sync's list, cancel pending)`, async () => {
    assert.ok(REREAD_LINE > 0);
    let hits = 0;
    for (let y = 200_000; y <= 320_000; y += 4_000) {
      const w = world();
      const { dd } = await timedOutStops(w, ["RKLB"], hide);
      w.sim.cancelMs = 10 * 60_000;
      const t0 = w.sim.simMs;
      let used = false;
      const realPos = w.sim.listPositions.bind(w.sim);
      w.sim.listPositions = async () => {
        if (!used && w.sim.simMs - t0 >= y && (new Error().stack ?? "").includes(`sells.ts:${REREAD_LINE}:`)) {
          used = true;
          hits++;
          throw new Error("positions timeout (test)");
        }
        return realPos();
      };
      await runWorker(w, dd, 6 * 60_000);
      const five = fiveMinute(w);
      const at = `y ${y / 1000} s: `;
      assert.equal(five.length, 1, at + (five.map((m) => m.text).join(" | ") || "no 5 minute alert"));
      assert.ok(five[0]!.text.includes("still resting at Alpaca"), at + five[0]!.text);
      assert.ok(!OLD_WORDING.test(five[0]!.text), at + five[0]!.text);
      assert.equal(w.sim.oversellAttempts, 0);
    }
    // Item 2 of 2026-11-13: while the stop is known pending cancel no sale is tried (its status is checked instead), so the sale's re-read,
    // and with it this fault, rarely or never comes in this window; the alerts above must still be true in every run.
    console.log(`MEASURE round 7 re-read fault fired in ${hits} runs (${hide ? "hidden" : "shown"})`);
  });
}

test("Michael's decision 2 of 2026-11-13 (10:15 AM): a timed-out stop that no look has seen gets the 5 minute alert that says only what the stack knows (\"I can't confirm a protective stop\"), never that there is no stop", async () => {
  const w = world();
  const { dd } = await timedOutStops(w, ["RKLB"], true);
  w.sim.cancelMs = 10 * 60_000;
  // Every positions read inside a sale fails from now on, so no try's look ever completes and no note is made.
  let inSale = false;
  const liq = w.risk.liquidator as any;
  const realFlatten = liq.flatten.bind(liq);
  liq.flatten = async (...a: any[]) => {
    inSale = true;
    try {
      return await realFlatten(...a);
    } finally {
      inSale = false;
    }
  };
  const realPos = w.sim.listPositions.bind(w.sim);
  w.sim.listPositions = async () => {
    if (inSale) throw new Error("positions timeout (test)");
    return realPos();
  };
  await runWorker(w, dd, 6 * 60_000);
  const five = fiveMinute(w);
  assert.equal(five.length, 1, five.map((m) => m.text).join(" | ") || "no 5 minute alert");
  assert.ok(five[0]!.text.includes("I can't confirm a protective stop for RKLB after 5 minutes"), five[0]!.text);
  assert.ok(!OLD_WORDING.test(five[0]!.text) && !five[0]!.text.includes("is still resting"), five[0]!.text);
});

for (const hide of [false, true]) {
  test(`group 2, round 8 (night): after a complete look has seen the timed-out stop gone, the 5 minute alert never says it "may still be resting" (live updates off, the cancel lands, every market sale refused; ${hide ? "hidden from" : "shown in"} the sync's list)`, async () => {
    let checked = 0;
    for (let land = 20_000; land <= 300_000; land += 20_000) {
      const w = world();
      const statusAt: string[] = [];
      const realSay = w.risk.say;
      w.risk.say = async (ch: string, text: string, opts?: any) => {
        if (opts?.mentionOwner) statusAt.push(String(w.sim.orders.find((o) => o.clientOrderId.startsWith("cyrus-p-"))?.status));
        return realSay(ch, text, opts);
      };
      const { dd } = await timedOutStops(w, ["RKLB"], hide);
      const before = w.said.length;
      const statusBefore = statusAt.length;
      w.sim.cancelMs = land;
      w.sim.refuseSellIf = (s: any) => s.stopPrice === undefined;
      await runWorker(w, dd, 7 * 60_000);
      const alerts = w.said.slice(before).filter((m) => m.mention);
      const statuses = statusAt.slice(statusBefore);
      const five = alerts.map((m, i) => ({ m, status: statuses[i] })).filter((x) => /minute/.test(x.m.text) && !/within 15 seconds/.test(x.m.text) && !/shares \(since /.test(x.m.text));
      assert.ok(five.length <= 1, `land ${land / 1000} s: ${five.length} alerts`);
      for (const x of five) {
        if (x.status === "canceled") {
          checked++;
          assert.ok(!x.m.text.includes("may still be resting"), `land ${land / 1000} s, stop canceled: ${x.m.text}`);
          assert.ok(!x.m.text.includes("is still resting"), `land ${land / 1000} s, stop canceled: ${x.m.text}`);
        }
      }
      assert.equal(w.sim.oversellAttempts, 0);
    }
    assert.ok(checked >= 10, `alerts with the stop already cancelled: ${checked}`);
  });
}

// ---------------- weekend build, item 2 point 2: timed-out stops in the database, and the start-up protection check ----------------
import { timedOutStopsKey } from "../src/risk.ts";

test("item 2 (second point): a timed-out stop is written to the database; a failed write is retried on a backoff, not at every sync", async () => {
  const w = world();
  const realSet = w.store.setControl.bind(w.store);
  let fails = 2;
  const writes: number[] = [];
  w.store.setControl = async (key: string, value: unknown) => {
    if (key.startsWith("timed_out_stops:")) {
      writes.push(w.sim.simMs);
      if (fails-- > 0) throw new Error("database down (test)");
    }
    return realSet(key, value);
  };
  const { dd, ids } = await timedOutStops(w, ["RKLB"], true);
  w.sim.cancelMs = 10 * 60_000;
  await runWorker(w, dd, 60_000);
  const saved = await w.store.getControl<{ stops: Array<[string, string]> }>(timedOutStopsKey(D));
  assert.ok(saved && saved.stops.some(([, e]) => e === ids[0]), JSON.stringify(saved));
  const gaps = writes.map((t, i) => (i ? t - writes[i - 1]! : Infinity)).slice(1);
  assert.ok(writes.length >= 3 && gaps[0]! >= 4_900 && gaps[1]! >= 9_900, `writes at ${writes.join(", ")}`);
});

test("item 2 (second point): after a restart the stored timed-out stop is loaded and never taken as protection again; its shares are sold once its cancel lands", async () => {
  const w = world();
  const { dd, ids } = await timedOutStops(w, ["RKLB"], true);
  w.sim.cancelMs = 20_000;
  await runWorker(w, dd, 2_000);
  assert.ok(await w.store.getControl(timedOutStopsKey(D)), "stored");
  // A restart: the worker's memory is new.
  const fresh = new SyncMemory();
  w.risk.syncMemory = fresh;
  await runWorker(w, dd, 90_000);
  assert.ok([...fresh.timedOutStops.values()].includes(ids[0]!), "loaded from the database");
  assert.ok(!w.events.some((e) => e.event === "fresh_stop_recovered" || e.event === "startup_fresh_stop_confirmed"), "never re-adopted");
  assert.equal(await heldQty(w, "RKLB"), 0);
  assert.equal(w.sim.oversellAttempts, 0);
});

async function restartedWith(status: "accepted" | "pending_cancel", entries: 1 | 2) {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "IREN", 5, 9, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 9.08);
  await syncOrders(w.risk, dd, { protect: true }); // A4: a fresh stop for the 4 left
  const stop = freshStops(w, "IREN")[0]!;
  assert.ok(stop, "fresh stop placed");
  if (entries === 2) {
    const id2 = await hold(w, "IREN", 3, 9.1, 2);
    void id2;
  }
  if (status === "pending_cancel") {
    w.sim.cancelMs = 30_000;
    await w.sim.cancelOrder(stop.id); // someone else's cancel (a restart forgot why): Alpaca shows it pending cancel
  }
  w.risk.syncMemory = new SyncMemory();
  return { w, dd, id, stop };
}

test("item 2 (second point): start-up check: a fresh stop Alpaca shows working and covering the whole holding is confirmed; nothing is sold or said", async () => {
  const { w, dd, id } = await restartedWith("accepted", 1);
  await runWorker(w, dd, 30_000);
  assert.ok(w.events.some((e) => e.event === "startup_fresh_stop_confirmed"));
  assert.ok(w.risk.syncMemory.freshStops.has(id));
  assert.equal(w.sim.sellLog.length, 0);
  assert.equal(w.said.filter((m) => m.mention).length, 0);
});

test("item 2 (second point): start-up check: a fresh stop Alpaca shows pending cancel is not protection; it takes the B path and the shares are sold once the cancel lands, never on top of it", async () => {
  const { w, dd, id } = await restartedWith("pending_cancel", 1);
  await runWorker(w, dd, 90_000);
  assert.ok(w.events.some((e) => e.event === "startup_fresh_stop_unconfirmed" && e.data.clientOrderId === id));
  assert.equal(await heldQty(w, "IREN"), 0);
  assert.equal(w.sim.oversellAttempts, 0);
});

test("item 2 (second point): start-up check: a symbol held by two open entries is left as it is (the fresh stop's entry is not known)", async () => {
  const { w, dd } = await restartedWith("accepted", 2);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(w.events.some((e) => e.event === "startup_protection_check"));
  assert.ok(!w.events.some((e) => e.event === "startup_fresh_stop_unconfirmed" || e.event === "startup_fresh_stop_confirmed"));
  assert.equal(w.risk.syncMemory.timedOutStops.size, 0);
});

test("item 2 (second point): a start-up check that cannot read Alpaca's open orders is retried on a backoff (5, 10, 20 s ...), not at every sync", async () => {
  const { w, dd } = await restartedWith("accepted", 1);
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  const tries: number[] = [];
  w.sim.listOrdersPaged = async (...a: any[]) => {
    if (a[0] === "open" && a[1] === "2000-01-01T00:00:00Z" && tries.length < 3 && new Error().stack?.includes("startupProtectionCheck")) {
      tries.push(w.sim.simMs);
      throw new Error("timeout (test)");
    }
    return (realPaged as any)(...a);
  };
  await runWorker(w, dd, 60_000);
  const gaps = tries.map((t, i) => (i ? t - tries[i - 1]! : Infinity)).slice(1);
  assert.equal(tries.length, 3, `tries at ${tries.join(", ")}`);
  assert.ok(gaps[0]! >= 4_900 && gaps[1]! >= 9_900, `gaps ${gaps.join(", ")}`);
  assert.ok(w.events.some((e) => e.event === "startup_protection_check"), "succeeds once Alpaca answers");
});

test("group 2, round 2 of the weekend build: after a restart, a stored timed-out stop that keeps holding the shares gets the first alert once, then the 5 minute alert", async () => {
  const w = world();
  const { dd } = await timedOutStops(w, ["RKLB"], true);
  w.sim.cancelMs = 20 * 60_000; // the cancel stays pending: the stop keeps holding the shares
  await runWorker(w, dd, 2_000);
  const before = w.said.length;
  w.risk.syncMemory = new SyncMemory(); // a restart
  await runWorker(w, dd, 6 * 60_000);
  const after = w.said.slice(before).filter((m) => m.mention);
  const first = after.filter((m) => m.text.includes("I can't confirm a protective stop for RKLB (noticed at"));
  const five = after.filter((m) => /after \d+ minutes?/.test(m.text));
  assert.equal(first.length, 1, after.map((m) => m.text).join(" | ") || "nothing posted");
  assert.equal(five.length, 1, after.map((m) => m.text).join(" | "));
  assert.equal(await heldQty(w, "RKLB"), 4);
  assert.equal(w.sim.oversellAttempts, 0);
});

// Group 1, round 3 of the weekend build: the start-up check's parts, each guarded by a test.
test("item 2 (second point): with the database down at a restart, Alpaca's check still runs; the stored list is read once the database answers, a stop the sale re-adopted meanwhile is dropped as protection, and nothing is written before that read", async () => {
  const w = world();
  const { dd, ids } = await timedOutStops(w, ["RKLB"], true);
  w.sim.cancelMs = 20 * 60_000;
  await runWorker(w, dd, 2_000);
  const stored = await w.store.getControl<{ stops: Array<[string, string]> }>(timedOutStopsKey(D));
  assert.ok(stored && stored.stops.length === 1);
  const stopId = stored.stops[0]![0];
  // A restart with the database down for reads and writes of that key.
  const fresh = new SyncMemory();
  w.risk.syncMemory = fresh;
  const realGet = w.store.getControl.bind(w.store);
  const realSet = w.store.setControl.bind(w.store);
  let down = true;
  let writesWhileUnread = 0;
  w.store.getControl = (async (key: string) => {
    if (down && key.startsWith("timed_out_stops:")) throw new Error("database down (test)");
    return realGet(key);
  }) as any;
  w.store.setControl = async (key: string, value: unknown) => {
    if (key.startsWith("timed_out_stops:") && !fresh.storedLoaded) writesWhileUnread++;
    return realSet(key, value);
  };
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(fresh.alpacaChecked, true, "Alpaca's check ran although the stored list could not be read");
  assert.equal(fresh.storedLoaded, false);
  // Meanwhile the sale re-adopts that stop as the entry's fresh stop (it is working at Alpaca).
  fresh.freshStops.set(ids[0]!, { symbol: "RKLB", entryClientOrderId: ids[0]!, stopClientOrderId: stopId, orderId: null, qty: 4, stopPrice: 19.87, placedAt: w.sim.simMs, status: "accepted", lookedAt: w.sim.simMs });
  fresh.timedOutDirty = true;
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(writesWhileUnread, 0, "the stored list is never written before it has been read");
  down = false;
  w.sim.advance(65_000);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(fresh.storedLoaded, true);
  assert.ok(fresh.timedOutStops.has(stopId), "loaded");
  assert.ok(![...fresh.freshStops.values()].some((f) => f.stopClientOrderId === stopId), "the re-adopted stop is dropped as protection");
});

test("item 3: a failed lookup's wait does not hold back an entry a live update has just flagged", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "IREN", 5, 9, 1);
  // The listing leaves the entry out, and its lookup fails once.
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return a[0] === "all" ? { ...r, orders: r.orders.filter((o: any) => o.clientOrderId !== id) } : r;
  };
  const realFind = w.sim.findOrderByClientId.bind(w.sim);
  let fails = 1;
  const looks: number[] = [];
  w.sim.findOrderByClientId = async (cid: string) => {
    if (cid === id) {
      looks.push(w.sim.simMs);
      if (fails-- > 0) throw new Error("lookup timed out (test)");
    }
    return realFind(cid);
  };
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(looks.length, 1);
  w.sim.advance(1_000);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(looks.length, 1, "within the failed lookup's wait: not looked up");
  w.memory.mustLook.add(id); // a live update flagged it
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(looks.length, 2, "flagged by a live update: looked up at once");
});

// ---------------- Michael's item 1 of 2026-11-13 (afternoon): remainders noticed late while the list still shows the stop pending ----------------
async function remainderRun(lagMs: number, live: boolean): Promise<{ msToStop: number | null; lagLogged: boolean; oversell: number; requests: number; lagEvents: number }> {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "LUNR", 5, 12, 1);
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const t0 = w.sim.simMs;
  w.sim.partialTakeProfitListLag(id, 1, 12.08, lagMs);
  if (live) w.memory.liveStopCancelled.set(id, t0); // what the worker's live-update hook records
  // The worker: a sync at once (the live update), then the rechecks the sync asks for (or the 10 s sync).
  await drive(w, dd, { protect: true, streamLive: true }, t0, t0 + 40_000, () => w.sim.stopLog.length > 0);
  const placed = w.sim.stopLog[0];
  return { msToStop: placed ? placed.at - t0 : null, lagLogged: w.events.some((e) => e.event === "stop_cancel_list_lag"), oversell: w.sim.oversellAttempts, requests: w.sim.bucketTimes.filter((x) => x >= t0).length, lagEvents: w.events.filter((e) => e.event === "stop_cancel_list_lag").length };
}

test("Michael's item 1 of 2026-11-13 (afternoon): after a live report of a completed stop cancel, the sync rechecks quickly while the list still shows the stop open, and the remainder's fresh stop follows within about 2 seconds of the list clearing (before: the next 10 second sync)", async () => {
  const rows: string[] = [];
  for (const lag of [500, 2_000, 5_000, 11_000, 15_000]) {
    const before = await remainderRun(lag, false);
    const now = await remainderRun(lag, true);
    rows.push(`list lag ${lag / 1000} s: fresh stop ${now.msToStop} ms after the live report, ${now.requests} requests (without the live report: ${before.msToStop} ms, ${before.requests} requests)`);
    assert.equal(now.lagEvents, 1, "the lag is logged once, not at every recheck");
    assert.ok(now.msToStop !== null && now.msToStop <= lag + 2_500, `lag ${lag}: ${now.msToStop} ms (the list's lag plus at most one 2 s recheck, Michael's change of 2026-11-13 evening)`);
    assert.ok(now.lagLogged, "the list's lag is logged");
    assert.equal(now.oversell, 0);
    assert.equal(before.oversell, 0);
  }
  console.log("MEASURE item 1\n" + rows.join("\n"));
});

test("Michael's item 1 of 2026-11-13 (afternoon): the worker records the live report of a completed stop cancel for the sync, and schedules backup syncs 0.5, 1 and 2 s apart until the entry has its fresh stop", async () => {
  const { rig } = await import("./rig.ts");
  const r = rig({ orderStream: true });
  const wk: any = r.worker;
  wk.startOrderStream(D);
  const syncs: number[] = [];
  // The redesign of 2026-11-14, part 2: the protection loop's wakes for the entry (they were syncs brought forward).
  wk.loop.wake = (_id: string, atMs: number) => void syncs.push(atMs);
  const id = "cyrus-20261102-LUNR-1";
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "LUNR", qty: 5, referencePrice: 12, stopPrice: 11.87, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null });
  wk.orderHandler.d.onStopCancelled({ clientOrderId: id, symbol: "LUNR", atMs: 1_000 });
  assert.equal(wk.syncMemory.liveStopCancelled.get(id), 1_000, "recorded for the sync");
  assert.equal(syncs.length, 1, "a look at once");
  await wk.stopCancelFollowUp(D);
  await wk.stopCancelFollowUp(D);
  await wk.stopCancelFollowUp(D);
  await wk.stopCancelFollowUp(D);
  const gaps = syncs.slice(1).map((x) => x - wk.d.now().getTime());
  assert.deepEqual(gaps, [500, 1_000, 2_000], `backup syncs ${gaps.join(", ")}`);
  // Once the entry has its fresh stop, no more.
  wk.stopCancelPending.set(id, { symbol: "LUNR", at: wk.d.now().getTime(), tries: 0 });
  wk.syncMemory.freshStops.set(id, { symbol: "LUNR", entryClientOrderId: id, stopClientOrderId: "cyrus-p-x", orderId: "x", qty: 4, stopPrice: 11.87, placedAt: 0, status: "accepted", lookedAt: 0 });
  const n = syncs.length;
  await wk.stopCancelFollowUp(D);
  assert.equal(syncs.length, n, "no backup sync once it has its fresh stop");
  wk.endOrderStream?.();
});

test("Michael's item 2 of 2026-11-13 (afternoon): a fresh stop Alpaca refuses is logged once (fresh_stop_refused), not also as a failed sale", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "TWST", 5, 12, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 1, 12.08);
  w.sim.refuseStops = true;
  w.sim.advance(300);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(w.events.some((e) => e.event === "fresh_stop_refused" && e.data.symbol === "TWST"));
  assert.ok(!w.events.some((e) => e.event === "sell_failed" && e.data.symbol === "TWST"), "not also a failed sale");
  assert.equal(await heldQty(w, "TWST"), 0, "sold at market instead, as designed");
});

test("Michael's item 4 of 2026-11-13 (afternoon): a sync of 2 seconds or more logs the time of each of its steps", async () => {
  const w = world();
  const dd = await day(w);
  await hold(w, "IREN", 5, 9, 1);
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(!w.events.some((e) => e.event === "sync_slow"), "a quick sync logs nothing");
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    w.sim.advance(3_000); // a slow order list
    return (realPaged as any)(...a);
  };
  await syncOrders(w.risk, dd, { protect: true });
  const slow = w.events.find((e) => e.event === "sync_slow");
  assert.ok(slow, "logged");
  assert.ok(slow!.data.totalMs >= 3_000 && slow!.data.steps.orderListAndPositions >= 3_000, JSON.stringify(slow!.data));
  for (const k of ["store", "orderListAndPositions", "settleAwaiting", "olderLookups", "missingLookups", "alerts", "walk", "save"]) assert.ok(k in slow!.data.steps, k);
});

test("group 2, round 4 of the weekend build: a remainder whose list still shows its stop open never holds up the sync; another remainder at the same moment gets its fresh stop at once", async () => {
  for (const lag of [2_000, 11_000, 15_000]) {
    const w = world();
    const dd = await day(w);
    const lunr = await hold(w, "LUNR", 5, 12, 1); // the older entry, walked first
    w.sim.advance(1_000);
    const smci = await hold(w, "SMCI", 5, 30, 1);
    w.sim.advance(5_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    const t0 = w.sim.simMs;
    w.sim.partialTakeProfitListLag(lunr, 1, 12.08, lag);
    w.memory.liveStopCancelled.set(lunr, t0);
    w.sim.partialTakeProfit(smci, 1, 30.08);
    const r = await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    const smciStop = w.sim.stopLog.find((x) => x.symbol === "SMCI");
    assert.ok(smciStop && smciStop.at - t0 <= 1_000, `lag ${lag}: SMCI's fresh stop ${smciStop ? smciStop.at - t0 : "none"} ms`);
    assert.ok(w.sim.simMs - t0 <= 2_000, `lag ${lag}: the sync took ${w.sim.simMs - t0} ms (it never waited on LUNR's list)`);
    void r;
    assert.ok(w.memory.lagRecheck !== undefined && w.memory.lagRecheck.dueAt - w.sim.simMs <= 600, "a quick recheck for LUNR (its own timer, since the redesign of 2026-11-14)");
    assert.ok(!w.sim.stopLog.some((x) => x.symbol === "LUNR"), "nothing placed for LUNR while its list shows the stop open");
    assert.equal(w.sim.oversellAttempts, 0);
  }
});

test("bareRemainder: a stop that filled part of the shares is not a bare remainder (the stop did its work), even with a live report", async () => {
  const { bareRemainder } = await import("../src/risk.ts");
  const o: any = { filledQty: 5, legs: [{ side: "sell", type: "limit", status: "partially_filled", filledQty: 1, stopPrice: null, legs: [] }, { side: "sell", type: "stop", status: "canceled", filledQty: 2, stopPrice: 9, legs: [] }] };
  assert.equal(bareRemainder(o), null);
  assert.equal(bareRemainder(o, 1_000), null);
  o.legs[1].filledQty = 0;
  assert.ok(bareRemainder(o));
});

test("item 2 of 2026-11-13 (afternoon): a refused market sale is still logged as sell_failed (only a fresh stop's refusal is logged once by the sale)", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "AAA", 5, 20, 1);
  w.sim.cancelExitsAtFill(id); // both exits gone: a missing-exit sale at market
  w.sim.refuseSellIf = (s: any) => s.stopPrice === undefined;
  await syncOrders(w.risk, dd, { protect: true });
  assert.ok(w.events.some((e) => e.event === "sell_failed" && e.data.symbol === "AAA"), "a refused market sale is logged");
});

// Group 2, round 5 of the weekend build: the list-clearing event's bounds, and the 30 second window of quick rechecks.
async function lagRun(lagMs: number, runMs: number) {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "LUNR", 5, 12, 1);
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const t0 = w.sim.simMs;
  w.sim.partialTakeProfitListLag(id, 1, 12.08, lagMs);
  w.memory.liveStopCancelled.set(id, t0);
  const syncs: number[] = [];
  const asked: Array<{ at: number; inMs: number | undefined }> = [];
  const rechecks: Array<{ requests: number; used: number | null }> = [];
  await drive(w, dd, { protect: true, streamLive: true }, t0, t0 + runMs, () => w.sim.stopLog.length > 0, (x) => {
    syncs.push(x.at);
    asked.push({ at: x.at, inMs: x.inMs });
    if (x.recheck) rechecks.push({ requests: x.requests, used: x.used });
  });
  return { w, syncs, asked, rechecks };
}

test("group 2, round 5 of the weekend build: the list-clearing event comes once per entry, and the list's real lag lies between its two bounds", async () => {
  for (const lag of [2_000, 11_000, 29_000]) {
    const { w } = await lagRun(lag, 60_000);
    const cleared = w.events.filter((e) => e.event === "stop_cancel_list_cleared");
    assert.equal(cleared.length, 1, `lag ${lag}: ${cleared.length} cleared events`);
    const c = cleared[0]!.data;
    assert.ok(c.lagAtLeastMs < lag && c.msFromLiveCancel >= lag, `lag ${lag}: between ${c.lagAtLeastMs} and ${c.msFromLiveCancel}`);
    assert.ok(c.msFromLiveCancel - c.lagAtLeastMs <= 2_500, `lag ${lag}: bounds ${c.lagAtLeastMs} to ${c.msFromLiveCancel} within one recheck (at most 2 s apart)`);
    assert.ok(c.syncsSawOpen >= 1);
  }
});

test("group 1 note, round 5 of the weekend build: the quick rechecks stop 30 seconds after the live report (a limit); after that the regular syncs carry on", async () => {
  const { syncs } = await lagRun(120_000, 90_000);
  const quick = syncs.filter((t, i) => i > 0 && t - syncs[i - 1]! < 9_000);
  const late = syncs.filter((t, i) => i > 0 && t > 31_000 + 4_000 && t - syncs[i - 1]! < 9_000);
  assert.ok(quick.length >= 5, `quick rechecks within the window: ${syncs.join(", ")}`);
  assert.equal(late.length, 0, `no quick recheck after the 30 s window: ${syncs.join(", ")}`);
});

// ---------------- Michael's change of 2026-11-13 (evening), and group 1's round 5 tests ----------------
test("Michael's change of 2026-11-13 (evening): while the list lags, the quick rechecks come 0.5 s, then 1 s, then every 2 s apart (not 4)", async () => {
  const { syncs, asked } = await lagRun(15_000, 20_000);
  const gaps = syncs.slice(1).map((t, i) => t - syncs[i]!);
  assert.deepEqual(gaps.slice(0, 6), [500, 1_000, 2_000, 2_000, 2_000, 2_000], `gaps ${gaps.join(", ")}`);
  assert.deepEqual(asked.slice(0, 6).map((a) => a.inMs), [500, 1_000, 2_000, 2_000, 2_000, 2_000], "what each sync asked for");
});

test("group 1, round 5 of the weekend build: no sync asks for a quick recheck from 30 s after the live report; every one before that asks within 2 s", async () => {
  const { asked } = await lagRun(120_000, 90_000);
  const early = asked.filter((a) => a.at < 30_000);
  const late = asked.filter((a) => a.at >= 30_000);
  assert.ok(early.length >= 15, `quick rechecks inside the window: ${early.length}`);
  for (const a of early) assert.ok(a.inMs !== undefined && a.inMs <= 2_000, `at ${a.at}: asked ${a.inMs}`);
  assert.ok(late.length >= 5, `regular syncs after the window: ${late.length}`);
  for (const a of late) assert.equal(a.inMs, undefined, `at ${a.at}: asked ${a.inMs} after the 30 s window`);
});

test("group 1, round 5 of the weekend build: an entry older than the 10 minute window gets its fresh stop within the list's lag plus about 2.5 s (it is looked up by id at each recheck)", async () => {
  for (const lag of [2_000, 5_000, 15_000]) {
    const w = world();
    const dd = await day(w);
    const id = await hold(w, "LUNR", 5, 12, 1);
    for (let i = 0; i < 70; i++) {
      w.sim.advance(10_000); // 11 minutes and more of regular syncs
      await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    }
    const t0 = w.sim.simMs;
    w.sim.partialTakeProfitListLag(id, 1, 12.08, lag);
    w.memory.liveStopCancelled.set(id, t0);
    w.memory.mustLook.add(id); // as the live update of the stop's cancel does
    await drive(w, dd, { protect: true, streamLive: true }, t0, t0 + 60_000, () => w.sim.stopLog.length > 0);
    const placed = w.sim.stopLog[0];
    assert.ok(placed && placed.at - t0 <= lag + 2_500, `lag ${lag}: fresh stop ${placed ? placed.at - t0 : "none"} ms after the live report`);
    assert.equal(w.sim.oversellAttempts, 0);
  }
});

test("group 1, round 5 of the weekend build (mutant M12): bareRemainder is null for a stop still open with no live report, and a remainder with one", async () => {
  const { bareRemainder } = await import("../src/risk.ts");
  for (const status of ["pending_cancel", "new", "accepted", "held"]) {
    const o: any = { filledQty: 5, legs: [{ side: "sell", type: "limit", status: "partially_filled", filledQty: 1, stopPrice: null, legs: [] }, { side: "sell", type: "stop", status, filledQty: 0, stopPrice: 9, legs: [] }] };
    assert.equal(bareRemainder(o), null, `${status}, no live report`);
    const r = bareRemainder(o, 1_000);
    assert.ok(r && r.shares === 4 && r.liveCancel === true, `${status}, live report: ${JSON.stringify(r)}`);
  }
  const done: any = { filledQty: 5, legs: [{ side: "sell", type: "limit", status: "partially_filled", filledQty: 1, stopPrice: null, legs: [] }, { side: "sell", type: "stop", status: "canceled", filledQty: 0, stopPrice: 9, legs: [] }] };
  const r = bareRemainder(done);
  assert.ok(r && r.shares === 4 && r.liveCancel === false, "a cancel the list shows needs no live report");
});

test("the redesign of 2026-11-14, part 1: with many remainders lagging at once, the quick rechecks run inside P2 reservations of the shared budget and never take it past P2's 40 a minute or 15 in 5 seconds", async () => {
  const w = world();
  const dd = await day(w);
  const syms = ["LUNR", "SMCI", "IREN", "CIFR", "RIOT", "MARA", "HUT", "WULF"];
  const ids: string[] = [];
  for (const [i, sym] of syms.entries()) ids.push(await hold(w, sym, 5, 10 + i, 1));
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const t0 = w.sim.simMs;
  for (const [i, id] of ids.entries()) {
    w.sim.partialTakeProfitListLag(id, 1, 10 + i + 0.08, 25_000 + i * 1_000);
    w.memory.liveStopCancelled.set(id, t0);
  }
  let syncs = 0;
  let sentInRechecks = 0;
  await drive(w, dd, { protect: true, streamLive: true }, t0, t0 + 90_000, () => w.sim.stopLog.length >= ids.length, (x) => {
    syncs++;
    if (x.recheck) sentInRechecks += x.requests;
  });
  const b = w.memory.budget!;
  assert.ok(b.totals.P2 > 0, "the rechecks were charged (P2)");
  assert.equal(b.totals.P2, sentInRechecks, "charged exactly the P2 requests the simulated broker received during the recheck syncs");
  assert.ok(b.peak.minute <= 40 && b.peak.five <= 15, `budget at most ${b.peak.minute} a minute and ${b.peak.five} in 5 s over ${syncs} syncs`);
  assert.equal(w.sim.stopLog.length, ids.length, "every remainder got its fresh stop");
  assert.equal(w.sim.oversellAttempts, 0);
  console.log(`MEASURE many remainders: budget at most ${b.peak.minute} a minute and ${b.peak.five} in 5 s, ${b.totals.P2} P2 requests, ${syncs} syncs`);
});

test("the redesign of 2026-11-14, part 1: a quick recheck needs room in the shared budget; with none it waits for room (nothing charged meanwhile), then runs and is charged", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "LUNR", 5, 12, 1);
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const t0 = w.sim.simMs;
  w.sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
  w.memory.liveStopCancelled.set(id, t0);
  const b = w.memory.budget!;
  const filler = b.tryReserve("P1", 15, { label: "test: a P1 burst" }) as Reservation;
  for (let i = 0; i < 15; i++) filler.charge("/v2/test"); // the 5 seconds' room is used up
  filler.end();
  const rechecks: Array<{ at: number; requests: number }> = [];
  await drive(w, dd, { protect: true, streamLive: true }, t0, t0 + 12_000, () => false, (x) => {
    if (x.recheck) rechecks.push({ at: x.at, requests: x.requests });
  });
  assert.ok(w.events.some((e) => e.event === "budget_refused" && e.data.label === "list lag recheck" && e.data.why === "five"), "refused while the 5 seconds are full");
  assert.ok(rechecks.length >= 1 && rechecks[0]!.at >= 5_000, `the first recheck ran once there was room: ${JSON.stringify(rechecks)}`);
  assert.equal(b.totals.P2, rechecks.reduce((n, x) => n + x.requests, 0), "charged exactly the rechecks that ran");
});

test("the redesign of 2026-11-14, part 1 (decision 5 with change A): a P2 recheck waiting on its floor of 80 makes entries give way; a P1 try's floor is 20", async () => {
  let remaining = 85;
  let t = 0;
  const b = new RequestBudget({ now: () => t, remaining: () => remaining });
  const { Governor } = await import("../src/governor.ts");
  const g = new Governor(() => t);
  g.setSafetyHold(b);
  assert.equal(g.admitTrade(100).ok, true, "nothing waits: entries go");
  const r = b.tryReserve("P2", 6, { label: "list lag recheck", waitKey: "list lag recheck" });
  assert.ok(!(r instanceof Reservation) && r.why === "floor", "85 - 6 is below 80: refused on the floor");
  const e = g.admitTrade(100);
  assert.ok(!e.ok && /^holding back for safety: a recheck is waiting/.test(e.reason), "entries give way while it waits");
  const p1 = b.tryReserve("P1", 13, { label: "stuck retry" });
  assert.ok(p1 instanceof Reservation, "a P1 try still starts (85 - 13 is above 20)");
  p1.end();
  t += 2_500;
  assert.equal(g.admitTrade(100).ok, true, "the wait lapses 2 s after its last refusal");
  remaining = 30;
  const p1b = b.tryReserve("P1", 13, { label: "stuck retry" });
  assert.ok(!(p1b instanceof Reservation) && p1b.why === "floor", "30 - 13 is below 20: P1 refused on its floor");
});

test("Michael's change of 2026-11-13 (evening): the worker's backup syncs stand aside for an entry the sync is rechecking (those rechecks are charged)", async () => {
  const { rig } = await import("./rig.ts");
  const r = rig({ orderStream: true });
  const wk: any = r.worker;
  wk.startOrderStream(D);
  const syncs: number[] = [];
  // The redesign of 2026-11-14, part 2: the protection loop's wakes for the entry (they were syncs brought forward).
  wk.loop.wake = (_id: string, atMs: number) => void syncs.push(atMs);
  const id = "cyrus-20261102-LUNR-1";
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "LUNR", qty: 5, referencePrice: 12, stopPrice: 11.87, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null });
  wk.orderHandler.d.onStopCancelled({ clientOrderId: id, symbol: "LUNR", atMs: 1_000 });
  assert.equal(syncs.length, 1, "a sync at once");
  wk.syncMemory.liveLagTries.set(id, 1); // the sync saw the list still showing the stop open
  await wk.stopCancelFollowUp(D);
  assert.equal(syncs.length, 1, "no backup look: the walk's own list-lag looks carry it");
  assert.equal(wk.stopCancelPending.has(id), false);
  wk.endOrderStream?.();
});

test("the redesign of 2026-11-14, part 1: a recheck asks for its real cost (the order list's pages and the positions, plus one lookup for an entry older than the list's window), and runs within it", async () => {
  async function asked(oldEntry: boolean) {
    const w = world();
    const dd = await day(w);
    const id = await hold(w, "LUNR", 5, 12, 1);
    for (let i = 0; i < (oldEntry ? 70 : 1); i++) {
      w.sim.advance(10_000);
      await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    }
    const t0 = w.sim.simMs;
    w.sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
    w.memory.liveStopCancelled.set(id, t0);
    w.memory.mustLook.add(id);
    const before = w.memory.budget!.totals.P2;
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    assert.equal(w.memory.budget!.totals.P2, before, "nothing charged ahead");
    const cost = w.memory.lagRecheck!.cost;
    w.sim.advanceTo(w.memory.lagRecheck!.dueAt);
    const res = w.memory.budget!.tryReserve("P2", cost, { label: "list lag recheck" }) as Reservation;
    const reqs = w.sim.requests;
    await withReservation(res, () => syncOrders(w.risk, dd, { protect: true, streamLive: true }));
    assert.equal(res.used, w.sim.requests - reqs, "charged what it sent");
    assert.ok(res.used <= cost, `sent ${res.used}, within its reservation of ${cost}`);
    return cost;
  }
  assert.equal(await asked(false), 2, "a recent entry: one page of the order list and the positions");
  assert.equal(await asked(true), 3, "an entry older than the window: and its lookup by id");
});

test("the redesign of 2026-11-14, part 1: a sync that runs before the recheck is due (a live update's) is routine work and charges nothing; only the recheck that runs is charged", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "LUNR", 5, 12, 1);
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const t0 = w.sim.simMs;
  w.sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
  w.memory.liveStopCancelled.set(id, t0);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const due = w.memory.lagRecheck!.dueAt;
  w.sim.advanceTo(due - 300); // another sync comes first (a live update)
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.equal(w.memory.budget!.totals.P2, 0, "nothing charged for syncs that were not rechecks");
  let sent = 0;
  await drive(w, dd, { protect: true, streamLive: true }, t0, t0 + 20_000, () => w.sim.stopLog.length > 0, (x) => {
    if (x.recheck) sent += x.requests;
  });
  assert.ok(sent > 0 && w.memory.budget!.totals.P2 === sent, `charged ${w.memory.budget!.totals.P2}, sent in rechecks ${sent}`);
});

test("the redesign of 2026-11-14, part 1: with other syncs every 1 or 3 seconds, the requests charged equal the requests the recheck syncs sent", async () => {
  for (const every of [1_000, 3_000]) {
    const w = world();
    const dd = await day(w);
    const id = await hold(w, "LUNR", 5, 12, 1);
    w.sim.advance(5_000);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
    const t0 = w.sim.simMs;
    w.sim.partialTakeProfitListLag(id, 1, 12.08, 25_000);
    w.memory.liveStopCancelled.set(id, t0);
    let nextOther = t0;
    let sentInRechecks = 0;
    let rechecks = 0;
    while (w.sim.simMs < t0 + 40_000 && w.sim.stopLog.length === 0) {
      const lr = w.memory.lagRecheck;
      const lagNow = lr !== undefined && w.sim.simMs >= lr.dueAt && w.sim.simMs < lr.until;
      if (lagNow) {
        const res = w.memory.budget!.tryReserve("P2", lr!.cost, { label: "list lag recheck" });
        if (res instanceof Reservation) {
          const before = w.tagged.P2!;
          await withReservation(res, () => syncOrders(w.risk, dd, { protect: true, streamLive: true }));
          sentInRechecks += w.tagged.P2! - before;
          rechecks++;
        }
      } else await syncOrders(w.risk, dd, { protect: true, streamLive: true });
      if (w.sim.simMs >= nextOther) nextOther = w.sim.simMs + every;
      const lr2 = w.memory.lagRecheck;
      const next = Math.min(lr2 ? lr2.dueAt : Infinity, nextOther, w.sim.simMs + 10_000);
      w.sim.advanceTo(Math.max(w.sim.simMs + 100, next));
    }
    assert.equal(w.memory.budget!.totals.P2, sentInRechecks, `other syncs every ${every} ms: charged ${w.memory.budget!.totals.P2}, sent in ${rechecks} rechecks ${sentInRechecks}`);
    assert.ok(w.sim.stopLog.length === 1 && w.sim.stopLog[0]!.at - t0 <= 25_000 + 2_500, "the fresh stop still comes within the lag plus 2.5 s");
  }
});

test("group 1, round 6 of the weekend build (mutant E8): a new lagging remainder gets its first recheck 0.5 s later, while an older one is already at 2 s", async () => {
  const w = world();
  const dd = await day(w);
  const lunr = await hold(w, "LUNR", 5, 12, 1);
  w.sim.advance(1_000);
  const smci = await hold(w, "SMCI", 5, 30, 1);
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const t0 = w.sim.simMs;
  w.sim.partialTakeProfitListLag(lunr, 1, 12.08, 20_000);
  w.memory.liveStopCancelled.set(lunr, t0);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  for (let i = 0; i < 4; i++) {
    w.sim.advanceTo(w.memory.lagRecheck!.dueAt);
    await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  }
  assert.equal(w.memory.lagRecheck!.dueAt - w.sim.simMs, 2_000, "LUNR is at 2 s");
  w.sim.partialTakeProfitListLag(smci, 1, 30.08, 20_000);
  w.memory.liveStopCancelled.set(smci, w.sim.simMs);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.equal(w.memory.lagRecheck!.dueAt - w.sim.simMs, 500, "SMCI's first recheck is 0.5 s away, not LUNR's 2 s");
});

test("group 1, round 6 of the weekend build (mutant E12): a recheck's cost counts every page of the order list", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "LUNR", 5, 12, 1);
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => ({ ...(await (realPaged as any)(...a)), pages: 3 }); // a busy day: three pages
  const t0 = w.sim.simMs;
  w.sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
  w.memory.liveStopCancelled.set(id, t0);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.equal(w.memory.lagRecheck!.cost, 4, "three pages and the positions");
});

// ---------------- Group 1, round 7 of the weekend build: the worker's own scheduling ----------------
async function workerLag() {
  const { rig, settle } = await import("./rig.ts");
  const sim = new SimBroker(MID);
  const r = rig({ broker: sim as any, simClock: sim, orderStream: true });
  const wk: any = r.worker;
  const id = clientOrderIdFor(D, "LUNR", 1);
  await sim.submitEntry({ symbol: "LUNR", qty: 5, stopPrice: 11.87, takeProfitPrice: 12.08, referencePrice: 12, clientOrderId: id });
  sim.fillEntry(id, 12);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "LUNR", qty: 5, referencePrice: 12, stopPrice: 11.87, takeProfitPrice: 12.08, status: "filled", alpacaOrderId: null, filledQty: 5, filledAvgPrice: 12, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() } as any);
  await ensureDay({ store: r.store, broker: sim, now: () => new Date(sim.simMs) } as any, D);
  const dd = (await r.store.getDay(D))!;
  const closeAt = new Date(MID + 3 * 3600_000);
  wk.sessionForSync = { day: dd, closeAt };
  wk.lastSync = sim.simMs; // a regular sync just ran (since part 2's round 1 it goes first whenever it is due)
  const mem = wk.syncMemory;
  const t0 = sim.simMs;
  sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
  mem.liveStopCancelled.set(id, t0);
  mem.mustLook.add(id);
  const run = async (how: any) => {
    wk.startSync(dd, closeAt, how);
    await settle();
    await settle();
  };
  return { sim, r, wk, mem, dd, closeAt, t0, run, settle, id };
}





// Group 2, round 1 of the redesign (part 1): the unclear stop's own lookups (every 5 s) are charged even when they fail (a timeout or a 5xx
// reaches Alpaca). The 15 second limit then still looks the stop up (its look and its first try are reserved separately), and its alert says
// what the stack is doing: selling now, or as soon as the budget has room.
test("redesign part 1 (group 2, round 1): with the unclear stop's failing lookups charged, the 15 second limit still looks the stop up, its alert is true, and the sale follows within 5.5 s of the limit", async () => {
  for (const offset of [0, 1_000, 2_500, 4_000]) {
    const w = world();
    const dd = await day(w);
    const id = await hold(w, "WULF", 6, 9.5, 1);
    w.sim.advance(5_000);
    w.sim.partialTakeProfit(id, 2, 9.58);
    const realSubmit = w.sim.submitSell.bind(w.sim);
    w.sim.submitSell = async (x: any) => {
      if (x.stopPrice !== undefined) throw new AlpacaError("outcome unclear (test)", 502); // Alpaca did not take it
      return realSubmit(x);
    };
    const realFind = w.sim.findOrderByClientId.bind(w.sim);
    w.sim.findOrderByClientId = async (cid: string) => {
      if (cid.startsWith("cyrus-p-")) {
        (w.sim as any).spend("plain"); // the request reached Alpaca and failed: it counts
        throw new AlpacaError("internal error (test)", 500);
      }
      return realFind(cid);
    };
    w.sim.advance(300);
    const sentAt = w.sim.simMs;
    // The syncs at the recheck times the walk asks for (the unclear stop's lookups), shifted so the limit's sync falls at different points.
    let r: any = await syncOrders(w.risk, dd, { protect: true });
    while (w.sim.simMs < sentAt + FRESH_STOP_CONFIRM_MS + 8_000 && w.sim.sellLog.length === 0) {
      const next = Math.max(w.sim.simMs + 100, Math.min(r.recheckAt ?? Infinity, w.sim.simMs + 10_000));
      w.sim.advanceTo(next === sentAt + FRESH_STOP_CONFIRM_MS ? next + offset : next);
      r = await syncOrders(w.risk, dd, { protect: true });
    }
    const at = `offset ${offset}: `;
    const ev = w.events.find((e) => e.event === "fresh_stop_timeout")!;
    assert.ok(ev, at + "the limit fired");
    assert.ok(!String(ev.data.found).startsWith("not looked up"), at + `the limit looked the stop up (${ev.data.found})`);
    const alert = w.said.find((m) => m.mention && m.text.includes("was not confirmed within 15 seconds"))!;
    const sale = w.sim.sellLog.find((x) => x.symbol === "WULF");
    assert.ok(sale && sale.at - sentAt <= FRESH_STOP_CONFIRM_MS + offset + 5_500, at + `sold ${sale ? sale.at - sentAt : "never"} ms after the stop was sent`);
    const soldAtOnce = sale !== undefined && sale.at - ev.at <= 2_000;
    if (/selling them now/.test(alert.text)) assert.ok(soldAtOnce, at + "the alert said 'now', and the sale came at once");
    else assert.match(alert.text, /as soon as my request budget has room/, at + alert.text);
    assert.equal(w.sim.oversellAttempts, 0);
  }
});

// Group 2, round 1 of the redesign (part 1): the rule 6 limit of the list-lag recheck's own timer. A recheck sync that fails is dropped
// (the warning `list_lag_recheck_failed`), its reservation is released, and it never fires again at once on a failing read.

// Group 1, round 1 of the redesign (part 1), B4: the lagging remainder's entry closes while no other entry is open, so the next sync returns
// early. Its recheck must not stay asked for (before: the worker's timer fired at once after every sync until the window ended).
test("redesign part 1 (group 1, round 1, B4): a sync that returns early (no open entry) or fails leaves no list-lag recheck to fire again", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "LUNR", 5, 12, 1);
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  w.sim.partialTakeProfitListLag(id, 1, 12.08, 15_000);
  w.memory.liveStopCancelled.set(id, w.sim.simMs);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.ok(w.memory.lagRecheck, "a recheck is asked for");
  await w.store.updateOrder(id, { closedAt: new Date(w.sim.simMs).toISOString() }); // the entry closed (its shares are gone)
  w.sim.advance(600);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.equal(w.memory.lagRecheck, undefined, "the early return dropped it");
  // A failing sync drops it too.
  const id2 = await hold(w, "SMCI", 5, 30, 1);
  w.sim.advance(5_000);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  w.sim.partialTakeProfitListLag(id2, 1, 30.08, 15_000);
  w.memory.liveStopCancelled.set(id2, w.sim.simMs);
  await syncOrders(w.risk, dd, { protect: true, streamLive: true });
  assert.ok(w.memory.lagRecheck);
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async () => {
    throw new Error("order list read failed (test)");
  };
  await assert.rejects(syncOrders(w.risk, dd, { protect: true, streamLive: true }));
  assert.equal(w.memory.lagRecheck, undefined, "a failed sync dropped it");
  w.sim.listOrdersPaged = realPaged;
});

// Group 1, round 1 of the redesign (part 1), B3: an unclear fresh stop that Alpaca does hold, while Alpaca's remaining sits at the P2 floor
// of 80 (a load window's level). Its lookup waits for room: entries give way, the bucket refills, and the next look comes as soon as room
// returns (before: skipped until the next sync, so the 15 second limit fired on a stop Alpaca held, cancelled it and sold).
test("redesign part 1 (group 1, round 1, B3): an unclear fresh stop's lookup waits on its floor with entries giving way, and looks again as soon as room returns; the stop is confirmed and nothing is sold", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "WULF", 6, 9.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 9.58);
  let remaining = 80;
  w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => remaining });
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (x: any) => {
    if (x.stopPrice !== undefined) {
      await realSubmit(x); // Alpaca took it
      throw new AlpacaError("outcome unclear (test)", 502);
    }
    return realSubmit(x);
  };
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) }; // the list does not show it yet
  };
  w.sim.advance(300);
  const sentAt = w.sim.simMs;
  let r: any = await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.memory.freshStops.get(id)?.status, "unclear");
  let gaveWay = false;
  while (w.sim.simMs < sentAt + 20_000 && w.memory.freshStops.get(id)?.status === "unclear") {
    // Entries gave way and the bucket refilled above the floor for one second only (busy again after): the look must come then.
    remaining = w.sim.simMs >= sentAt + 3_000 && w.sim.simMs < sentAt + 4_000 ? 95 : 80;
    const next = Math.max(w.sim.simMs + 100, Math.min(r.recheckAt ?? Infinity, w.sim.simMs + 10_000));
    w.sim.advanceTo(next);
    r = await syncOrders(w.risk, dd, { protect: true });
    if (w.sim.simMs < sentAt + 3_000) gaveWay ||= w.memory.budget.givingWay();
  }
  assert.ok(w.events.some((e) => e.event === "fresh_stop_lookup_skipped"), "a lookup found no room at 80");
  const f = w.memory.freshStops.get(id);
  assert.ok(f && f.status !== "unclear", `confirmed by a lookup once there was room (${f?.status})`);
  assert.ok(w.events.find((e) => e.event === "fresh_stop_confirmed")!.at - sentAt < FRESH_STOP_CONFIRM_MS, "before the 15 second limit");
  assert.equal(w.events.filter((e) => e.event === "fresh_stop_timeout").length, 0, "the limit never fired");
  assert.equal(w.sim.sellLog.filter((x) => x.symbol === "WULF").length, 0, "nothing sold");
  assert.ok(gaveWay, "entries gave way while it waited");
});

test("redesign part 1 (group 1, round 1, B3): while an unclear fresh stop's lookup waits on its floor, entries give way", async () => {
  let t = 0;
  const b = new RequestBudget({ now: () => t, remaining: () => 80 });
  const r = b.tryReserve("P2", 1, { label: "fresh stop lookup", waitKey: "fresh stop lookup cyrus-p-x" });
  assert.ok(!(r instanceof Reservation) && r.why === "floor");
  assert.equal(b.givingWay(), true);
  t += 2_000;
  assert.equal(b.givingWay(), false, "lapses 2 s after its last refusal");
});

// Group 1, round 1 of the redesign (B3), with the builder's check after it (the advisor's point): a realistic bucket, not a pinned figure.
// Entries take every request above 80 until they give way; the syncs that come for the lookup's next try read the order list and the
// positions from the same bucket. Before the backoff and the room for those reads, 21 lookups were skipped in 22 syncs about 0.7 s apart and
// the 15 second limit fired.
test("redesign part 1 (B3, a real bucket): with entries holding Alpaca's bucket at 80 until they give way, an unclear fresh stop's lookup still gets room before the 15 second limit, after a few syncs spaced by its backoff", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "WULF", 6, 9.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 9.58);
  w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => w.sim.tokens });
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (x: any) => {
    if (x.stopPrice !== undefined) {
      await realSubmit(x);
      throw new AlpacaError("outcome unclear (test)", 502);
    }
    return realSubmit(x);
  };
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) };
  };
  w.sim.advance(300);
  const sentAt = w.sim.simMs;
  let r: any = await syncOrders(w.risk, dd, { protect: true });
  w.sim.tokens = 80;
  const syncsAt: number[] = [];
  while (w.sim.simMs < sentAt + 20_000 && w.memory.freshStops.get(id)?.status === "unclear") {
    const next = Math.max(w.sim.simMs + 100, Math.min(r.recheckAt ?? Infinity, w.sim.simMs + 10_000));
    while (w.sim.simMs < next) {
      w.sim.advance(100);
      if (!w.memory.budget.givingWay()) w.sim.tokens = Math.min(w.sim.tokens, 80); // entries take everything above 80
    }
    syncsAt.push(w.sim.simMs - sentAt);
    r = await syncOrders(w.risk, dd, { protect: true });
  }
  const gaps = syncsAt.slice(1).map((t, i) => t - syncsAt[i]!);
  console.log(`MEASURE B3 real bucket: syncs at ${syncsAt.join(", ")} ms; confirmed ${w.memory.freshStops.get(id)?.status}`);
  assert.ok(w.memory.freshStops.get(id)?.status !== "unclear", "confirmed");
  assert.equal(w.events.filter((e) => e.event === "fresh_stop_timeout").length, 0, "the limit never fired");
  assert.ok(syncsAt.length <= 6, `few syncs: ${syncsAt.join(", ")}`);
  assert.ok(gaps.every((g) => g >= 400), `spaced by the backoff: ${gaps.join(", ")}`);
  assert.equal(w.sim.sellLog.length, 0);
});

// Group 2, round 2 of the redesign (part 1): the same with the bucket starting at 70, 79 or 85 and no other load (group 2's probe): the
// syncs that come for the lookup's next tries must not spend the refill it waits for (before: 16 to 23 syncs, the bucket falling, and the
// 15 second limit selling shares whose stop Alpaca held).
for (const start of [70, 79, 85]) {
  test(`redesign part 1 (group 2, round 2): an unclear fresh stop's lookup, the bucket starting at ${start} with no other load: confirmed before the 15 second limit, few syncs, nothing sold`, async () => {
    const w = world();
    const dd = await day(w);
    const id = await hold(w, "WULF", 6, 9.5, 1);
    w.sim.advance(5_000);
    w.sim.partialTakeProfit(id, 2, 9.58);
    w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => w.sim.tokens });
    const realSubmit = w.sim.submitSell.bind(w.sim);
    w.sim.submitSell = async (x: any) => {
      if (x.stopPrice !== undefined) {
        await realSubmit(x);
        throw new AlpacaError("outcome unclear (test)", 502);
      }
      return realSubmit(x);
    };
    const realPaged = w.sim.listOrdersPaged.bind(w.sim);
    w.sim.listOrdersPaged = async (...a: any[]) => {
      const r: any = await (realPaged as any)(...a);
      return { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) };
    };
    w.sim.advance(300);
    w.sim.tokens = start;
    const sentAt = w.sim.simMs;
    let r: any = await syncOrders(w.risk, dd, { protect: true });
    let syncs = 1;
    while (w.sim.simMs < sentAt + 20_000 && w.memory.freshStops.get(id)?.status === "unclear") {
      w.sim.advanceTo(Math.max(w.sim.simMs + 100, Math.min(r.recheckAt ?? Infinity, w.sim.simMs + 10_000)));
      r = await syncOrders(w.risk, dd, { protect: true });
      syncs++;
    }
    assert.ok(w.memory.freshStops.get(id)?.status !== "unclear", `start ${start}: confirmed`);
    assert.equal(w.events.filter((e) => e.event === "fresh_stop_timeout").length, 0, `start ${start}: the limit never fired`);
    assert.ok(syncs <= 7, `start ${start}: ${syncs} syncs`);
    assert.ok(w.events.filter((e) => e.event === "fresh_stop_lookup_skipped").length <= 1, "the skip is stored once per wait");
    assert.equal(w.sim.sellLog.length, 0);
  });
}

// Group 2, round 2 of the redesign: a timed-out stop's try waiting on its floor (Alpaca's remaining 32 for 6 s after the limit) no longer
// brings a sync forward every half second; its waits grow (0.5, 1, 2, then 4 s at least) and the out-of-room event is stored once per wait.
test("redesign part 1 (group 2, round 2): a timed-out stop's try waiting for room is retried on growing waits, not every half second", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "WULF", 6, 9.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 9.58);
  let low = false;
  w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => (low ? 32 : w.sim.tokens) });
  unclearStops(w, false);
  w.sim.advance(300);
  const sentAt = w.sim.simMs;
  let r: any = await syncOrders(w.risk, dd, { protect: true });
  const syncsAt: number[] = [];
  while (w.sim.simMs < sentAt + 40_000 && (await heldQty(w, "WULF")) > 0) {
    low = w.sim.simMs >= sentAt + FRESH_STOP_CONFIRM_MS && w.sim.simMs < sentAt + FRESH_STOP_CONFIRM_MS + 6_000;
    w.sim.advanceTo(Math.max(w.sim.simMs + 100, Math.min(r.recheckAt ?? Infinity, w.sim.simMs + 10_000)));
    low = w.sim.simMs >= sentAt + FRESH_STOP_CONFIRM_MS && w.sim.simMs < sentAt + FRESH_STOP_CONFIRM_MS + 6_000;
    if (low) syncsAt.push(w.sim.simMs - sentAt);
    r = await syncOrders(w.risk, dd, { protect: true });
  }
  const gaps = syncsAt.slice(1).map((t, i) => t - syncsAt[i]!);
  assert.ok(syncsAt.length <= 5, `syncs while waiting: ${syncsAt.join(", ")}`);
  assert.ok(gaps.every((g) => g >= 450), `spaced: ${gaps.join(", ")}`);
  assert.ok(w.events.filter((e) => e.event === "timed_out_try_out_of_room").length <= 2, "stored once per wait");
  assert.equal(await heldQty(w, "WULF"), 0, "sold once room returned");
  assert.equal(w.sim.oversellAttempts, 0);
});

// Group 1, round 2 of the redesign (mutant N4): Michael's item 2 limit on the client's own retries applies at the right call sites. The
// simulated broker here retries a failed request the way the real client does, asking `retryAllowedInScope` before each retry: inside the 15
// second limit's look (a reservation of 2 that limits retries) the lookup stops at 2 attempts; the unclear stop's earlier 5 s lookups (P2,
// not limited) make all 3; an ordinary stuck retry's sale (not limited) is retried as before.
import { retryAllowedInScope } from "../src/request-scope.ts";
test("redesign part 1 (group 1, round 2, N4): the client's retries stop at the reservation only in a timed-out stop's work (the 15 second limit's look), never in other budgeted tries", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "WULF", 6, 9.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 9.58);
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (x: any) => {
    if (x.stopPrice !== undefined) throw new AlpacaError("outcome unclear (test)", 502);
    return realSubmit(x);
  };
  const attempts: Array<{ at: number; n: number }> = [];
  const realFind = w.sim.findOrderByClientId.bind(w.sim);
  w.sim.findOrderByClientId = async (cid: string) => {
    if (!cid.startsWith("cyrus-p-")) return realFind(cid);
    let n = 0;
    for (;;) {
      n++;
      (w.sim as any).spend("plain"); // the attempt reached Alpaca and failed
      if (n >= 3 || !retryAllowedInScope()) break; // the real client's reads: at most 3 tries, each retry asked first
    }
    attempts.push({ at: w.sim.simMs, n });
    throw new AlpacaError("internal error (test)", 500);
  };
  w.sim.advance(300);
  const sentAt = w.sim.simMs;
  let r: any = await syncOrders(w.risk, dd, { protect: true });
  while (w.sim.simMs < sentAt + FRESH_STOP_CONFIRM_MS + 6_000 && !w.events.some((e) => e.event === "fresh_stop_timeout")) {
    w.sim.advanceTo(Math.max(w.sim.simMs + 100, Math.min(r.recheckAt ?? Infinity, w.sim.simMs + 10_000)));
    r = await syncOrders(w.risk, dd, { protect: true });
  }
  const limitAt = w.events.find((e) => e.event === "fresh_stop_timeout")!.at;
  const before = attempts.filter((a) => a.at < limitAt);
  const atLimit = attempts.filter((a) => a.at >= limitAt);
  assert.ok(before.length >= 1 && before.every((a) => a.n === 3), `the 5 s lookups (not limited): ${before.map((a) => a.n).join(",")}`);
  assert.equal(atLimit[0]?.n, 2, `the limit's lookup stops at its reservation of 2: ${atLimit.map((a) => a.n).join(",")}`);
});

test("redesign part 1 (group 1, round 2, N4): an ordinary stuck retry's sale is never stopped halfway: the client's retries go on beyond its reservation", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "AAA", 1, 10, 1);
  for (const l of w.sim.orders.find((o) => o.clientOrderId === id)!.legs) await w.sim.cancelOrder(l.id);
  w.sim.advance(2_000);
  w.sim.staleHeld.set("AAA", 1); // a hidden hold: the first try ends stuck, then the retries come
  await syncOrders(w.risk, dd, { protect: true });
  w.sim.staleHeld.delete("AAA");
  let n = 0;
  const realSell = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (x: any) => {
    for (;;) {
      n++;
      (w.sim as any).spend("plain");
      if (n >= 8 || !retryAllowedInScope()) break; // the real client's safety writes after a 429: up to 8 sends
    }
    return realSell(x);
  };
  const st = w.memory.stuck.get(id)!;
  w.sim.advanceTo(st.nextAt);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(n, 8, `all 8 sends of the retry's sale went out (its reservation is 10, the try's reads came first): ${n}`);
});

// The redesign of 2026-11-14, part 2: in the worker, the list-lag rechecks are looks of the protection loop (only the lagging entry, the
// reads the sync makes for it), inside a P2 reservation of their cost; the budget charges exactly the P2 requests those looks sent; the
// regular sync charges nothing; a look never resets the regular sync's 10 seconds.
test("redesign part 2: in the worker, list-lag looks run inside P2 reservations, charged exactly what they sent; the regular sync charges nothing; looks never reset the regular sync's clock", async () => {
  const { sim, r, wk, mem, run, settle } = await workerLag();
  const tagged: Record<string, number> = { entry: 0, first: 0, P1: 0, P2: 0, routine: 0 };
  sim.onSend = () => void (tagged[currentTag()] = (tagged[currentTag()] ?? 0) + 1);
  wk.loop.wake("cyrus-20261102-LUNR-1", sim.simMs, "protect"); // the live report: a look at once
  r.setNow(new Date(sim.simMs).toISOString());
  await settle();
  await settle();
  const lag = [...wk.loop.pendingWakes()].find(([, w]: any) => w.kind === "lag");
  assert.ok(lag, "the look saw the lag and asked for a list-lag look");
  // Looks never reset the regular sync's clock (regular syncs may run beside them when due; they go first).
  let resets = 0;
  const realLook = wk.look.bind(wk);
  wk.look = async (...a: any[]) => {
    const before = wk.lastSync;
    const out = await realLook(...a);
    if (out.outcome === "done" && wk.lastSync !== before) resets++;
    return out;
  };
  for (let i = 0; i < 20 && wk.loop.nextLookAt() !== null; i++) {
    r.setNow(new Date(wk.loop.nextLookAt()).toISOString());
    await settle();
    await settle();
  }
  assert.ok(mem.budget.totals.P2 > 0, "list-lag looks ran (P2)");
  assert.equal(mem.budget.totals.P2, tagged.P2, "charged exactly the P2 requests they sent");
  assert.equal(resets, 0, "looks never reset the regular sync's clock");
  const p2 = mem.budget.totals.P2;
  await run({}); // a regular sync
  assert.equal(mem.budget.totals.P2, p2, "a regular sync is routine");
  r.worker.stop?.();
});

test("redesign part 2: in the worker, a list-lag look with no room waits for room without any request, and is dropped at the end of its 30 second window", async () => {
  const { sim, r, wk, mem, t0, settle } = await workerLag();
  wk.loop.wake("cyrus-20261102-LUNR-1", sim.simMs, "protect");
  r.setNow(new Date(sim.simMs).toISOString());
  await settle();
  await settle();
  assert.ok([...wk.loop.pendingWakes().values()].some((w: any) => w.kind === "lag"), "a list-lag look is asked for");
  const filler = mem.budget.tryReserve("P1", 60, { fiveSec: false, label: "test: a full minute", force: true });
  for (let i = 0; i < 60; i++) filler.charge("/v2/test");
  filler.end();
  const p2 = mem.budget.totals.P2;
  for (let i = 0; i < 30 && wk.loop.nextLookAt() !== null && sim.simMs < t0 + 31_000; i++) {
    r.setNow(new Date(Math.min(wk.loop.nextLookAt(), t0 + 31_000)).toISOString());
    await settle();
  }
  assert.equal(mem.budget.totals.P2, p2, "no list-lag request while it waited for room (regular syncs may run beside it)");
  r.setNow(new Date(t0 + 31_000).toISOString());
  await settle();
  assert.equal([...wk.loop.pendingWakes().values()].some((w: any) => w.kind === "lag"), false, "dropped at the end of its window");
  r.worker.stop?.();
});

test("redesign part 2: in the worker, a look whose reads fail keeps its wakes and looks again after a growing wait (1 s, 2 s, ...), with a warning", async () => {
  const { sim, r, wk, settle } = await workerLag();
  const warns: string[] = [];
  const realLog = wk.d.log;
  wk.d.log = (level: string, e: string, data: any) => {
    if (level === "warn") warns.push(e);
    return realLog?.(level, e, data);
  };
  const tries: number[] = []; // the looks' reads only (regular syncs may run beside them when due)
  let inLook = false;
  const realLookFn = wk.look.bind(wk);
  wk.look = async (...a: any[]) => {
    inLook = true;
    try {
      return await realLookFn(...a);
    } finally {
      inLook = false;
    }
  };
  const realList = (sim as any).listOrdersPaged.bind(sim);
  (sim as any).listOrdersPaged = async () => {
    if (inLook) tries.push(sim.simMs);
    throw new Error("order list read failed (test)");
  };
  wk.loop.wake("cyrus-20261102-LUNR-1", sim.simMs, "protect");
  const start = sim.simMs;
  for (let i = 0; i < 12 && wk.loop.nextLookAt() !== null && sim.simMs < start + 20_000; i++) {
    r.setNow(new Date(Math.max(sim.simMs, wk.loop.nextLookAt())).toISOString());
    await settle();
    await settle();
  }
  const gaps = tries.slice(1).map((t, i) => t - tries[i]!);
  assert.ok(warns.includes("protection_look_failed"), warns.join(","));
  assert.ok(tries.length >= 3, `looked again: ${tries.map((t) => t - start).join(", ")}`);
  assert.ok(gaps.every((g, i) => i === 0 || g >= gaps[i - 1]!), `growing waits: ${gaps.join(", ")}`);
  assert.ok(gaps[0]! >= 1_000, `the first wait is 1 s: ${gaps.join(", ")}`);
  assert.equal(wk.budget.inUse().open, 0, "no reservation left open");
  (sim as any).listOrdersPaged = realList;
  r.worker.stop?.();
});

// Group 1, round 3 of the redesign (B1): entries give way *while* an unclear fresh stop's lookup waits on its floor (decision 5 with change
// A), through the whole wait, not only 2 s after each refusal. Entries take every request above 81 unless they give way; other traffic (first
// tries, routine reads) takes 2 a second and never gives way. Before: entries came back during the 2 and 4 s waits and the 15 second limit
// sold shares whose stop Alpaca held.
test("redesign part 1 (group 1, round 3, B1): with entries running and other traffic at 2 a second, entries give way through the lookup's whole wait; the stop is confirmed and nothing is sold", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "WULF", 6, 9.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 9.58);
  w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => w.sim.tokens });
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (x: any) => {
    if (x.stopPrice !== undefined) {
      await realSubmit(x);
      throw new AlpacaError("outcome unclear (test)", 502);
    }
    return realSubmit(x);
  };
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) };
  };
  w.sim.advance(300);
  const sentAt = w.sim.simMs;
  let r: any = await syncOrders(w.risk, dd, { protect: true });
  w.sim.tokens = 80;
  let entriesBackWhileWaiting = 0;
  while (w.sim.simMs < sentAt + 20_000 && w.memory.freshStops.get(id)?.status === "unclear") {
    const next = Math.max(w.sim.simMs + 100, Math.min((r.recheckAt ?? Infinity) + 250, w.sim.simMs + 10_000)); // the worker's 250 ms slack
    while (w.sim.simMs < next) {
      w.sim.advance(100);
      w.sim.tokens = Math.max(0, w.sim.tokens - 0.2); // other traffic, 2 a second
      if (!w.memory.budget.givingWay()) {
        if (w.memory.freshStops.get(id)?.lookWaits) entriesBackWhileWaiting++;
        w.sim.tokens = Math.min(w.sim.tokens, 81); // entries take everything above 81
      }
    }
    r = await syncOrders(w.risk, dd, { protect: true });
  }
  assert.ok(w.memory.freshStops.get(id)?.status !== "unclear", "confirmed");
  assert.equal(w.events.filter((e) => e.event === "fresh_stop_timeout").length, 0, "the limit never fired");
  assert.equal(w.sim.sellLog.length, 0, "nothing sold");
  assert.equal(entriesBackWhileWaiting, 0, "entries never came back while the lookup waited");
});

// Group 1, round 3 of the redesign (B2, mutants Q13, Q5 and Q6): each budgeted try refused for lack of room waits until there is room for the
// coming sync's reads (2) and the try together. With Alpaca's remaining held where the try alone would fit after a little refill but not with
// the reads, the wait is longer than the try's own refill time.
test("redesign part 1 (group 1, round 3, Q13): a stuck retry refused on its floor waits for room for the sync's reads too", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "AAA", 1, 10, 1);
  for (const l of w.sim.orders.find((o) => o.clientOrderId === id)!.legs) await w.sim.cancelOrder(l.id);
  w.sim.advance(2_000);
  w.sim.staleHeld.set("AAA", 1);
  await syncOrders(w.risk, dd, { protect: true });
  const st = w.memory.stuck.get(id)!;
  assert.ok(st && st.nextAt > w.sim.simMs);
  w.sim.advanceTo(st.nextAt);
  w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => 29 }); // 29 - 10 = 19: refused; with the reads 3 short
  await syncOrders(w.risk, dd, { protect: true });
  const wait = w.memory.stuck.get(id)!.nextAt - w.sim.simMs;
  assert.ok(wait >= 850, `waited ${wait} ms: room for the try and the sync's 2 reads (about 0.9 s), not the try alone (0.5 s)`);
  assert.equal(w.memory.stuck.get(id)!.roomWaits, 1);
});

test("redesign part 1 (group 1, round 3, Q5): a timed-out stop's status check refused on its floor waits for room for the sync's reads too", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "RKLB", 5, 20, 1);
  for (const l of w.sim.orders.find((o) => o.clientOrderId === id)!.legs) await w.sim.cancelOrder(l.id);
  w.sim.advance(2_000);
  const stop = "cyrus-p-20261102-RKLB-x-s1"; // a timed-out stop Alpaca's list does not show, whose cancel was accepted
  w.memory.timedOutStops.set(stop, id);
  w.memory.stuck.set(id, { symbol: "RKLB", since: w.sim.simMs, nextAt: 0, delayMs: 0, alerted: true, escalated: false, lastTriedAt: w.sim.simMs, why: "x", restingStop: { stopClientOrderId: stop, cancel: "accepted" } });
  w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => 21 }); // 21 - 2 = 19: refused; with the reads 3 short
  await syncOrders(w.risk, dd, { protect: true });
  const chk = w.memory.timedOutCheck.get(stop)!;
  assert.ok(chk && chk.probeAt - w.sim.simMs >= 850, `the next check in ${chk ? chk.probeAt - w.sim.simMs : "none"} ms (room for the check and the sync's reads)`);
});

test("redesign part 1 (group 1, round 3, Q6): a timed-out stop's cancel sent again, refused on its floor, waits for room for the sync's reads too", async () => {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "RKLB", 5, 20, 1);
  for (const l of w.sim.orders.find((o) => o.clientOrderId === id)!.legs) await w.sim.cancelOrder(l.id);
  const stop = "cyrus-p-20261102-RKLB-x-s1";
  w.sim.advance(30_000); // the exits' cancels have landed
  await w.sim.submitSell({ symbol: "RKLB", qty: 5, clientOrderId: stop, stopPrice: 19.8 } as any); // the stop rests at Alpaca, shown in its list
  w.sim.advance(2_000);
  w.memory.timedOutStops.set(stop, id);
  w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => 20 }); // 20 - 1 = 19: refused; with the reads 3 short
  await syncOrders(w.risk, dd, { protect: true });
  const chk = w.memory.timedOutCheck.get(stop)!;
  assert.ok(chk && chk.resendAt - w.sim.simMs >= 850, `the cancel again in ${chk ? chk.resendAt - w.sim.simMs : "none"} ms (room for the cancel and the sync's reads)`);
});

// ---------------- Redesign part 1, round 4 (group 1 B1 and group 2 items 1 and 2) ----------------
// Decision 5 with change A: entries give way only while a P2 try has room in the minute but waits on the 80, never because the minute or
// the 5 seconds are used up (then entries giving way helps nothing).
test("redesign part 1 (round 4): a P2 try's floor wait ends when it is refused for another reason (the 5 seconds), and extendWait does not bring it back", () => {
  const t = 0;
  let remaining = 82;
  const b = new RequestBudget({ now: () => t, remaining: () => remaining });
  const r1 = b.tryReserve("P2", 5, { label: "recheck", waitKey: "k" });
  assert.ok(!(r1 instanceof Reservation) && r1.why === "floor");
  assert.equal(b.givingWay(), true);
  remaining = 200;
  const other = b.tryReserve("P1", 12, { label: "other" });
  assert.ok(other instanceof Reservation);
  const r2 = b.tryReserve("P2", 5, { label: "recheck", waitKey: "k" });
  assert.ok(!(r2 instanceof Reservation) && r2.why === "five");
  assert.equal(b.givingWay(), false, "refused on the 5 seconds: entries do not give way");
  b.extendWait("k", t + 10_000);
  assert.equal(b.givingWay(), false, "only a recorded floor wait is extended");
  other.end();
});

async function unclearLookup() {
  const w = world();
  const dd = await day(w);
  const id = await hold(w, "WULF", 6, 9.5, 1);
  w.sim.advance(5_000);
  w.sim.partialTakeProfit(id, 2, 9.58);
  const box = { remaining: 200 };
  w.memory.budget = new RequestBudget({ now: () => w.sim.simMs, remaining: () => box.remaining });
  const realSubmit = w.sim.submitSell.bind(w.sim);
  w.sim.submitSell = async (x: any) => {
    if (x.stopPrice !== undefined) {
      await realSubmit(x);
      throw new AlpacaError("outcome unclear (test)", 502);
    }
    return realSubmit(x);
  };
  const realPaged = w.sim.listOrdersPaged.bind(w.sim);
  w.sim.listOrdersPaged = async (...a: any[]) => {
    const r: any = await (realPaged as any)(...a);
    return { ...r, orders: r.orders.filter((o: any) => !o.clientOrderId.startsWith("cyrus-p-")) };
  };
  w.sim.advance(300);
  const r: any = await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.memory.freshStops.get(id)?.status, "unclear");
  return { w, dd, id, box, r };
}

test("redesign part 1 (round 4, group 1 B1): an unclear fresh stop's lookup refused on P2's share of the minute (class) after a floor refusal: entries are not held", async () => {
  const { w, dd, id, box, r } = await unclearLookup();
  box.remaining = 80;
  w.sim.advanceTo(Math.max(w.sim.simMs + 100, r.recheckAt ?? 0));
  const r2: any = await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.memory.freshStops.get(id)?.status, "unclear");
  assert.equal(w.memory.budget!.givingWay(), true, "refused on its floor: entries give way");
  box.remaining = 200;
  const other = w.memory.budget!.tryReserve("P1", 45, { label: "other P1 work", fiveSec: false });
  assert.ok(other instanceof Reservation);
  w.sim.advanceTo(Math.max(w.sim.simMs + 100, r2.recheckAt ?? 0));
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.memory.freshStops.get(id)?.status, "unclear");
  assert.equal(w.memory.freshStops.get(id)?.lookWaits, 2, "the lookup was refused again");
  assert.equal((w.memory.budget!.roomFor("P2", 1) as any).why, "class", "on the minute's P2 share");
  assert.equal(w.memory.budget!.givingWay(), false, "entries are not held while the minute itself is used");
  other.end();
});

test("redesign part 1 (round 4, group 1 B1, mutant E2): the give-way for an unclear fresh stop's lookup never runs past the 15 second limit", async () => {
  const { w, dd, id, box } = await unclearLookup();
  const placedAt = w.memory.freshStops.get(id)!.placedAt;
  box.remaining = 40; // room for the lookup is more than 10 s away
  w.sim.advanceTo(placedAt + 12_000);
  await syncOrders(w.risk, dd, { protect: true });
  const f = w.memory.freshStops.get(id)!;
  assert.equal(f.status, "unclear");
  assert.ok((f.lookRoomAt ?? 0) > placedAt + FRESH_STOP_CONFIRM_MS, "its next try is due after the limit");
  w.sim.advanceTo(placedAt + FRESH_STOP_CONFIRM_MS - 100);
  assert.equal(w.memory.budget!.givingWay(), true, "entries give way through the wait");
  w.sim.advanceTo(placedAt + FRESH_STOP_CONFIRM_MS + 100);
  assert.equal(w.memory.budget!.givingWay(), false, "not past the limit, even before the sync at the limit runs");
});

test("redesign part 1 (round 4, group 1 B1): the 15 second limit ends the lookup's give-way", async () => {
  const { w, dd, id, box } = await unclearLookup();
  const placedAt = w.memory.freshStops.get(id)!.placedAt;
  box.remaining = 80;
  w.sim.advanceTo(placedAt + 14_000);
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(w.memory.budget!.givingWay(), true);
  box.remaining = 200;
  w.sim.advanceTo(placedAt + FRESH_STOP_CONFIRM_MS);
  let atLimit: boolean | null = null;
  const realTry = w.memory.budget!.tryReserve.bind(w.memory.budget);
  w.memory.budget!.tryReserve = (c: any, n: any, o: any) => {
    if (o?.label === "15 second limit lookup") atLimit = w.memory.budget!.givingWay(); // the limit's own look, as it starts
    return realTry(c, n, o);
  };
  await syncOrders(w.risk, dd, { protect: true });
  assert.equal(atLimit, false, "entries are back as soon as the limit fires (its base wait ran to 16 s)");
  assert.ok(w.events.some((e) => e.event === "fresh_stop_timeout"), "the limit fired");
  assert.equal(w.memory.budget!.givingWay(), false, "entries are back at once");
});

