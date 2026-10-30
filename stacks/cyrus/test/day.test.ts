// A whole simulated trading day through the real scheduler, with a fake clock, broker, Discord and price
// stream. This is the rehearsal in code; the rehearsal on Alpaca's paper server happens on a real trading day.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Worker, type StreamLike } from "../src/worker.ts";
import { MemoryStore, CONTROL_STOP, type StopFlag } from "../src/store.ts";
import type { Trade } from "../src/stream.ts";
import { FakeBroker, FakeBot, order, settings } from "./helpers.ts";

const D = "2026-11-02";
const z = (hhmmss: string) => new Date(`2026-11-02T${hhmmss}Z`);
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

function rig(opts: { store?: MemoryStore; bot?: FakeBot; broker?: FakeBroker } = {}) {
  const store = opts.store ?? new MemoryStore();
  const broker = opts.broker ?? new FakeBroker();
  const bot = opts.bot ?? new FakeBot();
  let now = z("12:00:00");
  const pings: string[] = [];
  let onTrade: (t: Trade) => void = () => undefined;
  let streamStarts = 0;
  let streamStops = 0;
  let screens = 0;
  const worker = new Worker({
    settings, broker, store, bot,
    now: () => now,
    ping: async (k) => (pings.push(k), true),
    buildLiveList: async () => (screens++, ["AAA", "BBB"]),
    makeStream: (_symbols, cb): StreamLike => {
      onTrade = cb;
      return { start: () => void streamStarts++, stop: () => void streamStops++, status: () => "live" };
    },
    sleep: async () => undefined,
  });
  return {
    store, broker, bot, worker, pings,
    at: async (t: string) => { now = z(t); await worker.tick(); await settle(); },
    trade: async (symbol: string, price: number, t: string) => { now = z(t); onTrade({ symbol, price, size: 100, time: z(t).toISOString() }); await settle(); },
    counts: () => ({ streamStarts, streamStops, screens }),
    said: (ch: string) => bot.posts.filter((p) => p.channel === ch).map((p) => p.text),
    ownerSays: (text: string, t: string) => bot.say(text, z(t)),
  };
}

test("a full day: request, approval, screen, live list, entry with a stop, a refusal after stop, close-out, summary", async () => {
  const r = rig();
  await r.at("12:00:00"); // 7:00 New York: too early for the request, but commands and the heartbeat already run
  assert.equal(r.said("commands").length, 0);
  assert.deepEqual(r.pings, ["ok"]);

  await r.at("13:30:00"); // 8:30 New York
  assert.equal(r.said("commands").length, 1);
  assert.ok(r.said("commands")[0]!.includes("will not trade today"));

  r.ownerSays("position 500", "13:35:00");
  r.ownerSays("approve", "13:35:10");
  await r.at("13:35:20");
  assert.equal((await r.store.getDay(D))!.status, "approved");
  assert.equal((await r.store.getDay(D))!.limits.maxPositionUsd, 500);
  assert.equal(r.broker.config.maxMarginMultiplier, 1);

  await r.at("13:45:00"); // 8:45: the screen starts in the background
  assert.equal(r.counts().screens, 1);
  assert.deepEqual((await r.store.getDay(D))!.liveList, ["AAA", "BBB"]);
  assert.ok(r.said("trading").some((t) => t.includes("live list") && t.includes("AAA BBB")));
  await r.at("13:46:00");
  assert.equal(r.counts().screens, 1, "the screen runs once");

  await r.at("14:25:00");
  assert.equal(r.counts().streamStarts, 1);

  r.broker.clock = { ...r.broker.clock, isOpen: true };
  await r.trade("AAA", 100, "14:31:00"); // inside the first 5 minutes: builds the range
  await r.trade("BBB", 50, "14:31:30");
  await r.trade("AAA", 101, "14:36:00"); // breakout
  await settle();
  const sent = r.broker.calls.filter((c) => c.fn === "submitEntry");
  assert.equal(sent.length, 1);
  assert.equal((sent[0]!.args[0] as any).qty, 4, "500 dollar limit at 101 dollars is 4 shares");
  assert.ok((sent[0]!.args[0] as any).stopPrice < 101);
  assert.ok(r.said("trading").some((t) => t.includes("Entry sent")));

  // a fill arrives; the next sync marks it
  const row = (await r.store.listOrders(D))[0]!;
  r.broker.positions = [{ symbol: "AAA", qty: 4, marketValue: 404, avgEntryPrice: 101, unrealizedPl: 0 }];
  r.broker.orders = [order({ id: row.alpacaOrderId!, clientOrderId: row.clientOrderId, symbol: "AAA", status: "filled", filledQty: 4, filledAvgPrice: 101, legs: [order({ side: "sell", type: "stop", stopPrice: 99.48, status: "new" })] })];
  await r.at("14:38:00");
  assert.equal((await r.store.getOrder(row.clientOrderId))!.status, "filled");

  // Michael types stop; a later breakout is refused
  r.ownerSays("stop", "14:39:00");
  await r.at("14:39:10");
  assert.equal(((await r.store.getControl(CONTROL_STOP)) as StopFlag).on, true);
  await r.trade("BBB", 52, "14:40:00");
  assert.equal(r.broker.calls.filter((c) => c.fn === "submitEntry").length, 1);
  assert.equal((await r.store.listRefusals(D)).at(-1)!.reason, "stop flag is set");

  await r.at("20:54:00"); // 3:54 PM New York: not yet
  assert.equal(r.broker.count("closeAllPositions"), 0);
  await r.at("20:55:00"); // close - 5 minutes
  assert.equal(r.broker.count("closeAllPositions"), 1);
  assert.equal(r.broker.positions.length, 0);
  assert.ok((await r.store.getDay(D))!.phases.closeout);
  assert.equal(r.counts().streamStops, 1);

  await r.at("21:04:00");
  assert.equal(r.said("trading").filter((t) => t.includes("Daily summary")).length, 0, "not before close + 5");
  r.broker.account = { ...r.broker.account, equity: 20012 };
  await r.at("21:05:00");
  const summary = r.said("trading").find((t) => t.includes("Daily summary"))!;
  for (const w of ["AAA", "Entries: 1", "Refused entries: 1", "stop flag is set", "Borrowing used", "flat", "never an instruction to act"]) assert.ok(summary.includes(w), w);
  await r.at("21:10:00");
  assert.equal(r.said("trading").filter((t) => t.includes("Daily summary")).length, 1, "the summary is posted once");
  assert.ok(r.pings.every((p) => p === "ok"));
});

test("if limits are not all decided at the open: no trading, no stream, and a late approval is refused", async () => {
  const r = rig();
  await r.at("13:30:00");
  r.ownerSays("approve position", "13:40:00");
  await r.at("13:45:00");
  await r.at("14:26:00"); // a stream may start while the day is still pending
  await r.at("14:30:00"); // the open
  assert.equal((await r.store.getDay(D))!.status, "lapsed");
  assert.ok(r.said("commands").some((t) => t.includes("will not trade today") && t.includes("not all decided")));
  assert.equal(r.counts().streamStops >= 1, true, "prices stop");
  r.ownerSays("approve", "14:31:00");
  await r.at("14:31:10");
  assert.equal((await r.store.getDay(D))!.status, "lapsed");
  await r.trade("AAA", 100, "14:31:20");
  await r.trade("AAA", 110, "14:40:00");
  assert.equal(r.broker.count("submitEntry"), 0);
  await r.at("20:55:00");
  await r.at("21:05:00");
  assert.ok(r.said("trading").some((t) => t.includes("No trading today")));
});

test("a restart in the middle of the morning does not repeat the request or the screen", async () => {
  const first = rig();
  await first.at("13:30:00");
  await first.at("13:45:00");
  const second = rig({ store: first.store, broker: first.broker, bot: first.bot });
  await second.at("13:50:00");
  assert.equal(first.said("commands").filter((t) => t.includes("Suggested limits")).length, 1);
  assert.equal(second.counts().screens, 0, "the stored live list is reused");
});

test("a non-trading day does nothing but answer commands and send the heartbeat", async () => {
  const r = rig();
  r.broker.calendar = []; // a holiday
  await r.at("13:30:00");
  await r.at("14:30:00");
  assert.equal(r.said("commands").length, 0);
  assert.equal(r.counts().screens, 0);
  r.ownerSays("status", "15:00:00");
  await r.at("15:00:10");
  assert.ok(r.said("commands").at(-1)!.includes("Status"));
  assert.ok(r.pings.length >= 3);
});

test("when the database is down the heartbeat says fail after three bad passes, and nothing trades", async () => {
  const r = rig();
  await r.at("13:30:00");
  r.store.failing = true;
  await r.at("13:31:00");
  await r.at("13:31:10");
  assert.equal(r.pings.filter((p) => p === "fail").length, 0, "one or two bad passes are not an alarm");
  await r.at("13:31:20");
  assert.equal(r.pings.at(-1), "fail");
  assert.equal(r.broker.count("submitEntry"), 0);
});

test("the ok heartbeat goes out about every 30 seconds, not every pass", async () => {
  const r = rig();
  await r.at("13:00:00");
  await r.at("13:00:05");
  await r.at("13:00:10");
  assert.equal(r.pings.length, 1);
  await r.at("13:00:31");
  assert.equal(r.pings.length, 2);
});

test("with the database down at the close, the broker's own clock still triggers the close-out", async () => {
  const r = rig();
  await r.at("13:30:00");
  r.store.failing = true;
  r.broker.positions = [{ symbol: "AAA", qty: 5, marketValue: 500, avgEntryPrice: 100, unrealizedPl: 0 }];
  r.broker.clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "2026-11-02T21:00:00Z" };
  await r.at("20:40:00");
  assert.equal(r.broker.count("closeAllPositions"), 0, "not yet near the close");
  await r.at("20:56:00");
  assert.equal(r.broker.count("closeAllPositions"), 1);
  assert.equal(r.broker.positions.length, 0);
  await r.at("20:56:10");
  assert.equal(r.broker.count("closeAllPositions"), 1, "only once");
});

test("a close-out that cannot get flat is retried, is not recorded as done, and the heartbeat says fail until flat", async () => {
  const r = rig();
  await r.at("13:30:00");
  r.broker.positions = [{ symbol: "AAA", qty: 5, marketValue: 500, avgEntryPrice: 100, unrealizedPl: 0 }];
  const realClose = r.broker.closeAllPositions.bind(r.broker);
  let works = false;
  r.broker.closeAllPositions = async () => { if (!works) { r.broker.calls.push({ fn: "closeAllPositions", args: [] }); throw new Error("rejected (test)"); } return realClose(); };
  await r.at("20:55:00");
  assert.equal((await r.store.getDay(D))!.phases.closeout, undefined, "not recorded as done");
  assert.ok(r.said("alerts").some((t) => t.includes("NOT FLAT")));
  await r.at("20:55:05");
  assert.equal(r.pings.at(-1), "fail");
  const attempts = r.broker.count("closeAllPositions");
  await r.at("20:57:00");
  assert.equal(r.broker.count("closeAllPositions"), attempts, "waits 5 minutes between tries");
  works = true;
  await r.at("21:01:00");
  assert.ok((await r.store.getDay(D))!.phases.closeout, "recorded once flat");
  await r.at("21:01:10");
  assert.notEqual(r.pings.at(-1), "fail");
});

test("a stopped worker stops pinging, which is what the heartbeat service watches for", async () => {
  const r = rig();
  await r.at("13:30:00");
  const n = r.pings.length;
  r.worker.stop();
  await settle();
  assert.equal(r.pings.length, n, "no pings after stop");
});
