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

const MID = Date.UTC(2026, 10, 2, 15, 0); // 9:00 AM Central on the rig's day

function world() {
  const sim = new SimBroker(MID);
  const events: Array<{ event: string; data: any }> = [];
  const log = (event: string, data?: Record<string, unknown>) => void events.push({ event, data });
  const said: Array<{ ch: string; text: string; mention?: boolean }> = [];
  const say = async (ch: string, text: string, opts?: { mentionOwner?: boolean }) => (said.push({ ch, text, mention: opts?.mentionOwner }), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs, log });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep, log });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  const memory = new SyncMemory();
  const risk: any = { broker: sim as any, store, now, say, liquidator, syncMemory: memory, log, onRemainderSold: () => undefined, onFreshStop: () => undefined };
  return { sim, events, said, store, now, risk, memory };
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
  assert.ok(w.said.some((m) => m.ch === "alerts" && m.text.startsWith("WULF: ") && /after I reported it without a protective stop/.test(m.text)), JSON.stringify(w.said.map((m) => m.text)));
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
  for (let i = 0; i < 4 && (await heldQty(w, "RIOT")) > 0; i++) {
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
  assert.ok(!w.said.some((m) => m.text.includes("still has no protective stop")), w.said.map((m) => m.text).join(" | "));
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
    assert.ok(gap <= 2_000, `sale ${gap} ms after Alpaca's cancel landed`);
    assert.equal(await heldQty(w, "RKLB"), 0);
    assert.equal(w.sim.oversellAttempts, 0);
  });
}

test("group 1, round 2 (night): cancels Alpaca keeps refusing for 3 timed-out stops are retried on the backoff within the allowance, never every second, and never a sale on top", async () => {
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
  assert.ok(maxIn(cancelTimes, 60_000) <= 3 + 4, `cancels in a minute ${maxIn(cancelTimes, 60_000)}: the first try each, then at most 4 a minute (40 requests at 10 each)`);
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
  return { dd, ids, stopIds };
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
  test(`group 1, round 3 (night, Michael's decision 1 of 2026-11-13): ${n} timed-out stop(s) the sync's list does not show, whose accepted cancel does not clear for 60 s: only the first accepted cancel gets a look in a second, then the stuck backoff within the allowance; with routine traffic beside, no rate-limit answer`, async () => {
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
    const spent = w.memory.retrySpend.length;
    console.log(`MEASURE round 3 fix, hidden route, accepted cancel held 60 s, ${n} stop(s): cancels ${times.length} (most in 5 s ${maxInWindow(times, 5_000)}); requests in the minute ${reqs.length}; lowest tokens ${Math.floor(w.sim.lowestTokens)} (from 120); rate-limit answers ${w.sim.rejected429 - r0}; retry charges ${spent}`);
    assert.equal(w.sim.rejected429 - r0, 0, "no rate-limit answer");
    assert.ok(w.sim.lowestTokens >= 30, `lowest tokens ${w.sim.lowestTokens}: before the fix, one stop drove it to 0`);
    // Per stop: the first cancel, the look a second later (a second cancel), then the backoff: 5, 10, 20, 30 s apart. At most 6 in the minute.
    assert.ok(times.length <= 6 * n, `cancels ${times.length}: at most 6 a stop in the minute (before the fix, about 15)`);
    assert.ok(spent >= 1, "the retries were charged to the retry allowance");
    assert.ok(reqs.length <= 80 + 35 * n, `requests in the minute ${reqs.length} (before the fix: about 290 for one stop, 374 for three)`);
    assert.equal(w.sim.oversellAttempts, 0);
    // Alpaca's cancel then takes effect: the shares are sold within one backoff step (at most 30 s plus the allowance) and nothing oversold.
    await runWorker(w, dd, 75_000);
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
  const outcome = w.events.filter((e) => e.event === "fresh_stop_timeout_cancel" && e.data.by === "missing-exit sale");
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
for (const c of [
  { name: "hidden from the sync's list, Alpaca refusing every cancel", hide: true, mode: "refused", want: "Alpaca has not accepted my cancel of it" },
  { name: "hidden from the sync's list, Alpaca accepting each cancel but still showing the stop", hide: true, mode: "accepted", want: "Alpaca accepted my cancel of it but still shows it working" },
  { name: "shown in the sync's list with its cancel pending", hide: false, mode: "pending", want: "Alpaca accepted my cancel of it but has not finished cancelling it" },
] as const) {
  test(`group 2, round 3 (night): the 5 minute alert tells the truth when the timed-out stop still rests at Alpaca (${c.name})`, async () => {
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
    await runWorker(w, dd, 5 * 60_000 + 20_000);
    const five = w.said.filter((m) => m.mention && /after \d+ minute/.test(m.text));
    assert.equal(five.length, 1, five.map((m) => m.text).join(" | ") || "no 5 minute alert");
    assert.ok(five[0]!.text.includes(RESTING), five[0]!.text);
    assert.ok(five[0]!.text.includes(c.want), five[0]!.text);
    assert.ok(!five[0]!.text.includes("still has no protective stop"), five[0]!.text);
    assert.equal(w.sim.oversellAttempts, 0);
  });
}

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

test("group 1, round 3 (night): the live update that a timed-out stop ended clears its entry's backoff time and the resting-stop note, and runs the order sync at once (no wait for the backoff)", async () => {
  const { rig } = await import("./rig.ts");
  const r = rig({ orderStream: true });
  const wk: any = r.worker;
  wk.startOrderStream(D);
  const mem: SyncMemory = wk.syncMemory;
  const syncs: number[] = [];
  wk.syncAt = (atMs: number) => void syncs.push(atMs);
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
  assert.equal(syncs.length, 1, "the order sync runs at once");
  wk.endOrderStream?.();
});
