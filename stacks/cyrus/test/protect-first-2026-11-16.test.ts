// Protect-first (Michael's night build request of 2026-11-16, item 2): while any position lacks a confirmed stop, new entries stop and
// low-priority work gives way, for at most about 30 s, after which entries resume at a reduced rate.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { MAX_MARKS, PROTECT_FIRST, PROTECT_FIRST_LIMIT_MS, PROTECT_FIRST_PAUSED, PROTECT_FIRST_REDUCED, PROTECT_FIRST_REDUCED_GAP_MS, ProtectFirst } from "../src/protect-first.ts";
import { BrokerView } from "../src/broker-view.ts";
import { RequestBudget, Reservation } from "../src/request-budget.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import type { TradeUpdate } from "../src/order-stream.ts";
import { SimBroker } from "./sim-broker.ts";
import { FakeBot, order } from "./helpers.ts";
import { D, rig, settle, z } from "./rig.ts";
import { STORED_INFO_EVENTS, shouldStoreEvent } from "../src/run-log.ts";

// Protect-first ships switched off (protect-first.ts, PROTECT_FIRST); these tests switch it on, so switching it on later is one line.
before(() => {
  PROTECT_FIRST.on = true;
});
after(() => {
  PROTECT_FIRST.on = false;
});

// Group 2, night build round 1: the two refusal reasons fit the daily summary's 70 characters (summary.ts cuts each at 70), differ, and
// keep the prefix the gate counts as a flow reason.
test("protect-first's refusal reasons fit the summary's 70 characters with their meaning intact", () => {
  for (const r of [PROTECT_FIRST_PAUSED, PROTECT_FIRST_REDUCED]) {
    assert.ok(r.length <= 70, `${r.length}: ${r}`);
    assert.match(r, /^protecting positions first: /);
  }
  assert.notEqual(PROTECT_FIRST_PAUSED, PROTECT_FIRST_REDUCED);
  assert.match(PROTECT_FIRST_PAUSED, /no new entries for up to 30 s/);
  assert.match(PROTECT_FIRST_REDUCED, /one every 2 s/);
});

// Group 2, night build round 1 (B1): the episode's three events are stored in the run log, not only in Fly's log (logging only).
test("protect-first's events are stored in the run log", () => {
  for (const n of ["protect_first_started", "protect_first_limit_reached", "protect_first_ended"]) {
    assert.ok(STORED_INFO_EVENTS.has(n), n);
    assert.equal(shouldStoreEvent("info", n), true, n);
  }
});

function unit() {
  let now = 1_000_000;
  const news = new Map<string, { held: boolean; at: number }>();
  const stuck = new Map<string, { symbol: string }>();
  const freshStops = new Map<string, { symbol: string; status: string; stopClientOrderId: string }>();
  const timedOutStops = new Map<string, string>();
  const events: Array<{ event: string; data?: Record<string, unknown> }> = [];
  const pf = new ProtectFirst({
    now: () => now,
    heldSince: (symbol, since) => {
      const n = news.get(symbol);
      return n && n.at >= since ? n.held : null;
    },
    stuck,
    freshStops,
    timedOutStops,
    log: (event, data) => events.push({ event, ...(data ? { data } : {}) }),
  });
  return { pf, news, stuck, freshStops, timedOutStops, events, at: (ms: number) => (now = ms), now: () => now };
}

test("protect-first: entries are refused and P2 gives way while a position lacks a confirmed stop; the start is logged once", () => {
  const u = unit();
  assert.equal(u.pf.phase(), "off");
  assert.equal(u.pf.entryRefusal(), null);
  assert.equal(u.pf.p2GivesWay(), false);
  u.pf.mark("e1", "AAA", "both exits lost");
  assert.equal(u.pf.phase(), "paused");
  assert.equal(u.pf.entryRefusal(), PROTECT_FIRST_PAUSED);
  assert.equal(u.pf.entryRefusal(true), PROTECT_FIRST_PAUSED, "the last look before sending refuses too");
  assert.equal(u.pf.p2GivesWay(), true);
  u.pf.mark("e2", "BBB", "both exits lost");
  assert.equal(u.events.filter((e) => e.event === "protect_first_started").length, 1);
  assert.deepEqual(u.events[0]!.data!.symbols, ["AAA"]);
});

test("protect-first: after 30 s entries resume at one every 2 s and P2 resumes; the limit is logged once; overlapping marks stay in one episode", () => {
  const u = unit();
  const t0 = u.now();
  u.pf.mark("e1", "AAA", "both exits lost");
  u.at(t0 + PROTECT_FIRST_LIMIT_MS - 1);
  assert.equal(u.pf.entryRefusal(), PROTECT_FIRST_PAUSED);
  u.pf.mark("e2", "BBB", "both exits lost"); // a new mark inside the episode: no new 30 s
  u.at(t0 + PROTECT_FIRST_LIMIT_MS);
  assert.equal(u.pf.phase(), "reduced");
  assert.equal(u.pf.p2GivesWay(), false, "P2 resumes after the limit");
  assert.equal(u.pf.entryRefusal(), null, "the first entry after the limit may go");
  u.pf.entryAdmitted();
  assert.equal(u.pf.entryRefusal(true), null, "its own last look before sending is not refused by the reduced rate");
  u.at(t0 + PROTECT_FIRST_LIMIT_MS + PROTECT_FIRST_REDUCED_GAP_MS - 1);
  assert.equal(u.pf.entryRefusal(), PROTECT_FIRST_REDUCED);
  u.at(t0 + PROTECT_FIRST_LIMIT_MS + PROTECT_FIRST_REDUCED_GAP_MS);
  assert.equal(u.pf.entryRefusal(), null);
  u.pf.entryAdmitted();
  // Over a minute in the reduced phase, at most 30 entries (one every 2 s).
  let admitted = 0;
  for (let ms = 0; ms < 60_000; ms += 100) {
    u.at(t0 + PROTECT_FIRST_LIMIT_MS + 10_000 + ms);
    if (u.pf.entryRefusal() === null) {
      u.pf.entryAdmitted();
      admitted++;
    }
  }
  assert.equal(admitted, 30);
  assert.equal(u.events.filter((e) => e.event === "protect_first_limit_reached").length, 1);
  assert.equal(u.events.filter((e) => e.event === "protect_first_started").length, 1);
});

test("protect-first: a sale clears the mark only on news newer than the mark; an older view never does", () => {
  const u = unit();
  const t0 = u.now();
  u.news.set("AAA", { held: false, at: t0 - 1 }); // a view from before the mark that does not show the shares
  u.pf.mark("e1", "AAA", "both exits lost");
  assert.equal(u.pf.phase(), "paused", "stale news does not clear");
  u.at(t0 + 3_000);
  u.news.set("AAA", { held: true, at: t0 + 2_000 }); // newer news: still held
  assert.equal(u.pf.phase(), "paused");
  u.news.set("AAA", { held: false, at: t0 + 2_500 }); // newer news: sold
  assert.equal(u.pf.phase(), "off");
  assert.equal(u.pf.entryRefusal(), null);
  const ended = u.events.find((e) => e.event === "protect_first_ended");
  assert.ok(ended);
  assert.equal(ended!.data!.durationMs, 3_000);
  assert.equal(ended!.data!.limitReached, false);
});

test("protect-first: the order sync's own positions read clears marks older than the read only", () => {
  const u = unit();
  const t0 = u.now();
  u.pf.mark("e1", "AAA", "both exits lost");
  u.at(t0 + 500);
  u.pf.mark("e2", "BBB", "both exits lost");
  u.pf.positionsRead(new Map([["CCC", 1]]), t0 + 200); // a read that started between the two marks, showing neither
  assert.deepEqual(u.pf.marked(), ["e2"], "the mark made after the read started stays");
  u.pf.positionsRead(new Map([["BBB", 1]]), t0 + 600);
  assert.deepEqual(u.pf.marked(), ["e2"], "still held");
  u.pf.positionsRead(new Map(), t0 + 700);
  assert.equal(u.pf.phase(), "off");
});

test("protect-first: confirmed protection clears (a fresh stop with Alpaca's status, or the walk seeing live exits); an unclear or timed-out stop does not", () => {
  const u = unit();
  u.pf.mark("e1", "AAA", "a remainder's stop was cancelled");
  u.freshStops.set("e1", { symbol: "AAA", status: "unclear", stopClientOrderId: "cyrus-p-1" });
  assert.equal(u.pf.phase(), "paused", "unclear is not confirmed");
  u.freshStops.set("e1", { symbol: "AAA", status: "accepted", stopClientOrderId: "cyrus-p-1" });
  u.timedOutStops.set("cyrus-p-1", "e1");
  assert.equal(u.pf.phase(), "paused", "a stop that hit the 15 second limit is never protection");
  u.timedOutStops.clear();
  assert.equal(u.pf.phase(), "off", "confirmed by Alpaca's status");
  u.pf.mark("e2", "BBB", "both exits lost");
  u.pf.protectedNow("e2");
  assert.equal(u.pf.phase(), "off", "the walk saw its exits live");
  // An unclear fresh stop marks by itself.
  u.freshStops.set("e3", { symbol: "CCC", status: "unclear", stopClientOrderId: "cyrus-p-3" });
  assert.equal(u.pf.phase(), "paused");
});

test("protect-first: a stuck entry is marked; once its shares are found gone it is not marked again while its record lasts; a new mark after a gap starts a new 30 s", () => {
  const u = unit();
  const t0 = u.now();
  u.stuck.set("e1", { symbol: "AAA" });
  assert.equal(u.pf.phase(), "paused");
  u.at(t0 + 40_000);
  assert.equal(u.pf.phase(), "reduced");
  u.news.set("AAA", { held: false, at: t0 + 39_000 });
  assert.equal(u.pf.phase(), "off");
  u.at(t0 + 41_000);
  assert.equal(u.pf.phase(), "off", "the stuck record is still there but its shares are gone");
  u.stuck.clear();
  u.pf.phase();
  u.at(t0 + 50_000);
  u.pf.mark("e2", "BBB", "both exits lost");
  assert.equal(u.pf.phase(), "paused", "a new episode");
  u.at(t0 + 50_000 + PROTECT_FIRST_LIMIT_MS - 1);
  assert.equal(u.pf.phase(), "paused", "with its own 30 s");
  assert.equal(u.events.filter((e) => e.event === "protect_first_started").length, 2);
  assert.equal(u.events.filter((e) => e.event === "protect_first_ended").length, 1);
});

test("protect-first: marks are bounded", () => {
  const u = unit();
  for (let i = 0; i < MAX_MARKS + 50; i++) u.pf.mark(`e${i}`, `S${i}`, "both exits lost");
  assert.equal(u.pf.marked().length, MAX_MARKS);
});

test("protect-first: the account view answers only with news newer than the asked time", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  const view = new BrokerView(sim, () => sim.simMs);
  const id = clientOrderIdFor(D, "AAA", 1);
  await sim.submitEntry({ symbol: "AAA", qty: 1, stopPrice: 9.98, takeProfitPrice: 10.01, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  const t0 = sim.simMs;
  assert.equal(view.heldSince("AAA", t0), null, "nothing read yet");
  await view.refreshFast();
  assert.equal(view.heldSince("AAA", t0), true);
  sim.advance(1_000);
  assert.equal(view.heldSince("AAA", sim.simMs), null, "the read started before");
  const mark = sim.simMs;
  sim.advance(500);
  view.setPositionFromUpdate("AAA", 0, null);
  assert.equal(view.heldSince("AAA", mark), false, "a live update after the mark");
  assert.equal(view.heldSince("AAA", sim.simMs + 1), null);
});

test("protect-first: the shared request budget refuses P2 while it gives way, never P1", () => {
  let giving = true;
  const b = new RequestBudget({ now: () => 0, remaining: () => 200 });
  b.p2GivesWay = () => giving;
  const p2 = b.tryReserve("P2", 3, { label: "list lag recheck" });
  assert.ok(!(p2 instanceof Reservation));
  assert.equal((p2 as { why: string }).why, "class");
  assert.equal(b.roomFor("P2", 3).ok, false);
  assert.ok(b.tryReserve("P1", 3, { label: "a stuck sale" }) instanceof Reservation);
  giving = false;
  assert.ok(b.tryReserve("P2", 3, { label: "list lag recheck" }) instanceof Reservation);
});

// ---- the worker ----

const upd = (event: string, o: Parameters<typeof order>[0], positionQty: number | null, atMs: number | null = null): TradeUpdate => ({ event, order: order(o), positionQty, atMs });

async function simDay(existing?: { sim: SimBroker; store: unknown }) {
  const sim = existing?.sim ?? new SimBroker(Date.UTC(2026, 10, 1, 22, 0));
  sim.hideFilledParents = true;
  const events: Array<{ event: string; data?: Record<string, unknown> }> = [];
  const r = rig<SimBroker>({ broker: sim, sleep: sim.sleep, simClock: sim, orderStream: true, bot: new FakeBot(), ...(existing ? { store: existing.store as never } : {}), log: (_l, event, data) => events.push({ event, ...(data ? { data } : {}) }) });
  if (!existing) {
    await r.at("2026-11-01T22:10:00Z");
    r.ownerSays("approve", "2026-11-01T22:20:00Z");
    await r.at("2026-11-01T22:20:10Z");
    await r.at("14:25:00");
    sim.advanceTo(z("14:59:00").getTime());
  }
  return { sim, r, events, wk: r.worker as unknown as { protectFirst: ProtectFirst; gate: { enter(s: unknown): Promise<{ status: string; reason?: string }>; flush(): Promise<void> } } };
}

async function holdOne(sim: SimBroker, r: Awaited<ReturnType<typeof simDay>>["r"], symbol: string) {
  const id = clientOrderIdFor(D, symbol, 1);
  await sim.submitEntry({ symbol, qty: 1, stopPrice: 9.98, takeProfitPrice: 10.01, referencePrice: 10, clientOrderId: id });
  sim.fillEntry(id, 10);
  await r.store.insertOrder({ clientOrderId: id, tradeDate: D, symbol, qty: 1, referencePrice: 10, stopPrice: 9.98, takeProfitPrice: 10.01, status: "filled", alpacaOrderId: null, filledQty: 1, filledAvgPrice: 10, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  return { id, o: sim.orders.find((x) => x.clientOrderId === id)! };
}

const signal = (symbol: string, sim: SimBroker) => ({ symbol, price: 10, tradeTime: new Date(sim.simMs), stopPrice: 9.9, takeProfitPrice: 10.2 });

async function loseExits(sim: SimBroker, r: Awaited<ReturnType<typeof simDay>>["r"], id: string, o: ReturnType<SimBroker["orders"]["find"]> & object) {
  await r.orderUpdate(upd("fill", { id: o.id, clientOrderId: id, symbol: o.symbol, side: "buy", status: "filled", qty: 1, filledQty: 1, filledAvgPrice: 10, groupId: o.groupId }, 1));
  sim.cancelExitsAtFill(id);
  for (const l of o.legs) await r.orderUpdate(upd("canceled", { ...structuredClone(l), status: "canceled", groupId: o.groupId }, null, sim.simMs));
}

test("protect-first, worker: lost exits pause entries (refusal stored as one counted row) and the sale ends the pause", async () => {
  const { sim, r, events, wk } = await simDay();
  const { id, o } = await holdOne(sim, r, "IREN");
  await r.at("15:00:00");
  sim.refuseSellIf = (x) => x.symbol === "IREN"; // Alpaca refuses the sale for now
  await loseExits(sim, r, id, o);
  for (let i = 0; i < 10; i++) await settle();
  assert.equal(wk.protectFirst.phase(), "paused");
  assert.ok(events.some((e) => e.event === "protect_first_started"));
  const a = await wk.gate.enter(signal("AAA", sim));
  assert.equal(a.status, "refused");
  assert.equal(a.reason, PROTECT_FIRST_PAUSED);
  await wk.gate.flush();
  const rows = await r.store.listRefusals(D);
  assert.ok(rows.some((x) => x.reason === PROTECT_FIRST_PAUSED && x.symbol === "(many)" && (x.detail as { count?: number })?.count === 1), "stored as a counted row");
  // Alpaca accepts the sale again: the next try sells it, its fill comes as a live update, and the pause ends.
  sim.refuseSellIf = null;
  for (let s = 1; s <= 20 && sim.heldQty("IREN") > 0; s++) await r.at(new Date(z("15:00:00").getTime() + s * 1000).toISOString());
  assert.equal(sim.heldQty("IREN"), 0, "sold");
  const sale = sim.orders.find((x) => x.symbol === "IREN" && x.side === "sell" && x.status === "filled")!;
  await r.orderUpdate(upd("fill", { ...structuredClone(sale) }, 0, sim.simMs));
  assert.equal(wk.protectFirst.phase(), "off");
  assert.ok(events.some((e) => e.event === "protect_first_ended"));
  const b = await wk.gate.enter(signal("BBB", sim));
  assert.notEqual(b.reason, PROTECT_FIRST_PAUSED);
  assert.notEqual(b.reason, PROTECT_FIRST_REDUCED);
});

test("protect-first, worker: after 30 s still unprotected, entries resume at one every 2 s and the limit is logged", async () => {
  const { sim, r, events, wk } = await simDay();
  const { id, o } = await holdOne(sim, r, "IREN");
  await r.at("15:00:00");
  sim.refuseSellIf = (x) => x.symbol === "IREN";
  await loseExits(sim, r, id, o);
  const t0 = sim.simMs;
  assert.equal((await wk.gate.enter(signal("AAA", sim))).reason, PROTECT_FIRST_PAUSED);
  await r.at(new Date(t0 + PROTECT_FIRST_LIMIT_MS + 100).toISOString());
  assert.equal(wk.protectFirst.phase(), "reduced");
  assert.ok(events.some((e) => e.event === "protect_first_limit_reached"));
  const first = await wk.gate.enter(signal("AAA", sim));
  assert.ok(first.reason !== PROTECT_FIRST_PAUSED && first.reason !== PROTECT_FIRST_REDUCED, `the first entry after the limit is not held back by protect-first (${first.status} ${first.reason ?? ""})`);
  assert.equal(first.status, "sent", `it was sent (${first.reason ?? ""})`);
  const second = await wk.gate.enter(signal("BBB", sim));
  assert.equal(second.reason, PROTECT_FIRST_REDUCED);
  r.setNow(new Date(sim.simMs + PROTECT_FIRST_REDUCED_GAP_MS).toISOString());
  const third = await wk.gate.enter(signal("CCC", sim));
  assert.equal(third.status, "sent", `${third.reason ?? ""}`);
});

test("protect-first, worker: a restart while a position lacks its stop: the first sync marks it again and entries are refused", async () => {
  const first = await simDay();
  const { id, o } = await holdOne(first.sim, first.r, "IREN");
  await first.r.at("15:00:00");
  first.sim.refuseSellIf = (x) => x.symbol === "IREN";
  await loseExits(first.sim, first.r, id, o);
  assert.equal(first.wk.protectFirst.phase(), "paused");
  // A restart: a new worker with the same broker and database; its memory is empty.
  const second = await simDay({ sim: first.sim, store: first.r.store });
  assert.equal(second.wk.protectFirst.phase(), "off", "nothing in memory yet");
  for (let s = 1; s <= 15 && second.wk.protectFirst.phase() === "off"; s++) await second.r.at(new Date(z("15:00:05").getTime() + s * 1000).toISOString());
  assert.equal(second.wk.protectFirst.phase(), "paused", "the first sync's walk found it without exits");
  assert.ok(second.events.some((e) => e.event === "protect_first_started"));
  const a = await second.wk.gate.enter(signal("AAA", second.sim));
  assert.equal(a.status, "refused");
  assert.equal(a.reason, PROTECT_FIRST_PAUSED);
  assert.equal(first.sim.oversellAttempts, 0);
});
