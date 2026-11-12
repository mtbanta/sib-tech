// The speed release, messaging only (Michael's decision 6 of 2026-11-05, "Discord, quieter"; builds/build-c2-log.md, "Speed release").
// These tests cover how messages are worded, batched and posted. Nothing here changes what the stack does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DiscordBot } from "../src/discord-bot.ts";
import { PAPER_ONLY, messagesFor } from "../src/discord.ts";
import { makeRedactor } from "../src/redact.ts";
import { Liquidator, SellGate } from "../src/sells.ts";
import { SyncMemory, enforceDailyLoss, syncOrders } from "../src/risk.ts";
import { MemoryStore, type DayRecord, type OrderRecord } from "../src/store.ts";
import { armedLine, ensureDay, formatMorningLine } from "../src/morning.ts";
import { clientOrderIdFor } from "../src/gate.ts";
import { formatSummary } from "../src/summary.ts";
import { remainderAlert } from "../src/worker.ts";
import { loadWindowRules } from "../src/load-mode.ts";
import { FakeBroker, order, settings } from "./helpers.ts";
import { SimBroker } from "./sim-broker.ts";
import { D, rig, z } from "./rig.ts";

async function evening(load = false) {
  const r = rig<FakeBroker, MemoryStore>({ orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  return r;
}

const day = (over: Partial<DayRecord> = {}): DayRecord => ({ tradeDate: D, isTradingDay: true, openAt: z("14:30:00"), closeAt: z("21:00:00"), status: "approved", dayStartEquity: 20000, suggested: { maxPositionUsd: 500, dailyLossStopUsd: 500, maxTradesPerMinute: 100, borrowingCap: 1 }, limits: { maxPositionUsd: 500, dailyLossStopUsd: 500, maxTradesPerMinute: 100, borrowingCap: 1 }, decided: { position: true, loss: true, trades: true, cap: true }, liveList: [], phases: {}, ...over });

test("one consolidated reply per message: one short line per command, then the limits list once", async () => {
  const r = await evening();
  const before = r.said("commands").length;
  r.ownerSays("position 400\nloss 300\nload on\napprove", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  const replies = r.said("commands").slice(before);
  assert.equal(replies.length, 1, "one reply for the message");
  const t = replies[0]!;
  assert.ok(t.startsWith("**position 400**: noted.\n**loss 300**: noted.\n**load on**: Monday 2026-11-02 will be a **load day** (once all four limits are decided).\n**approve**: all four limits accepted."), t);
  assert.equal(t.split("1. position:").length - 1, 1, "the list once");
  assert.ok(t.includes("5. mode: **LOAD DAY**") && t.includes("All four decided: trading is allowed within these"), t);
  assert.ok(!t.includes("Paper trading only."), "a command reply carries no footer");
  const d = (await r.store.getDay(D))!;
  assert.deepEqual([d.limits.maxPositionUsd, d.limits.dailyLossStopUsd, d.status, d.phases.load], [400, 300, "approved", "on"], "the commands did what they always did");
});

test("a single limit command gets a short line naming it, plus the list", async () => {
  const r = await evening();
  r.ownerSays("trades 50", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  const t = r.bot.last();
  assert.ok(t.startsWith("trades 50: noted.\n"), t);
  assert.ok(t.includes("3. trades: at most 50 orders a minute") && t.includes("Not all decided yet"), t);
});

test("the morning review is one line when all four limits are decided; a warning from the checklist follows it", () => {
  const line = formatMorningLine(day({ phases: { load: "on" } }), ["- Stop flag: off.", "- Account: flat, no open positions.", "- Borrowing cap at Alpaca right now: 1, long only. The approved cap is set at Alpaca 5 minutes before the open, not before.", "- Price feed: iex (one exchange only)."]);
  assert.ok(!line.includes("\n"), line);
  assert.ok(line.includes("all four limits decided (largest position 500 dollars") && line.includes("mode: **LOAD DAY**") && line.includes("Armed at 8:25 AM CT, market opens 8:30 AM CT"), line);
  const warned = formatMorningLine(day(), ["- Stop flag is ON (owner command (stop)). Type `resume` or there will be no entries."]);
  assert.deepEqual(warned.split("\n").slice(1), ["- Stop flag is ON (owner command (stop)). Type `resume` or there will be no entries."]);
});

test("Armed is one line; on a load day it describes the window, and after a load off it says the window is off (wording backlog)", () => {
  const on = armedLine(day({ phases: { load: "on" } }), 1, 19067.76);
  assert.ok(!on.includes("\n") && on.startsWith("Armed for Monday 2026-11-02: cap 1, long only, the day starts at 19067.76 dollars.") && on.includes(loadWindowRules()) && on.includes("8:45 AM CT to 10:30 AM CT") && on.includes("after the mid-day pause, a normal day"), on); // Michael's decision of 2026-11-10: the window runs to the mid-day pause
  const ended = armedLine(day({ phases: { load: "ended" } }), 1, 19067.76);
  assert.ok(ended.includes("Load window switched off") && !ended.includes(loadWindowRules()) && !ended.includes("in the load window"), ended);
  assert.equal(armedLine(day(), 1, 20000), "Armed for Monday 2026-11-02: cap 1, long only, the day starts at 20000.00 dollars.");
});

test("remainder sales: the order sync hands a successful sale to the batch instead of posting it; the worker posts one alert a minute, full and with the footer", async () => {
  const sim = new SimBroker(Date.UTC(2026, 10, 2, 15, 0));
  sim.hideFilledParents = true;
  const said: string[] = [];
  const say = async (_c: string, text: string) => (said.push(text), true);
  const gate = new SellGate({ broker: sim, say, nowMs: () => sim.simMs });
  const liquidator = new Liquidator({ broker: sim, gate, now: () => new Date(sim.simMs), sleep: sim.sleep });
  const store = new MemoryStore();
  const now = () => new Date(sim.simMs);
  await ensureDay({ store, broker: sim, now }, D);
  const id = clientOrderIdFor(D, "CIFR", 1);
  await sim.submitEntry({ symbol: "CIFR", qty: 10, stopPrice: 7.21, takeProfitPrice: 7.28, referencePrice: 7.27, clientOrderId: id });
  sim.fillEntry(id, 7.27);
  await store.insertOrder({ clientOrderId: id, tradeDate: D, symbol: "CIFR", qty: 10, referencePrice: 7.27, stopPrice: 7.21, takeProfitPrice: 7.28, status: "filled", alpacaOrderId: null, filledQty: 10, filledAvgPrice: 7.27, note: null, createdAt: new Date(sim.simMs - 1000).toISOString() });
  sim.partialTakeProfit(id, 3, 7.28);
  sim.advance(4_000);
  const handed: Array<[string, number]> = [];
  await syncOrders({ broker: sim, store, now, say, liquidator, syncMemory: new SyncMemory(), onRemainderSold: (s, n) => void handed.push([s, n]) }, (await store.getDay(D))!, { protect: true });
  assert.deepEqual(sim.sellLog.map((x) => [x.symbol, x.qty]), [["CIFR", 7]], "the sale itself is unchanged");
  assert.deepEqual(handed, [["CIFR", 7]]);
  assert.ok(!said.some((t) => t.includes("so I sold the remaining")), "no separate alert");
  const text = remainderAlert([{ symbol: "WULF", shares: 3 }, { symbol: "IREN", shares: 2 }]);
  assert.equal(text, "**Sold 2 remainders left without a stop** (Alpaca cancelled the stop when the take-profit partly filled): WULF 3, IREN 2.");
  assert.deepEqual(messagesFor("alerts", text), [`${text}\n${PAPER_ONLY}`], "in alerts, with the footer");

  const r = rig<FakeBroker, MemoryStore>({ orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:31:00");
  (r.worker as any).remainderSales.push({ symbol: "WULF", shares: 3 }, { symbol: "IREN", shares: 2 });
  await r.at("14:31:05");
  const alerts = r.said("alerts").filter((t) => t.includes("remainders left without a stop"));
  assert.equal(alerts.length, 1);
  assert.ok(alerts[0]!.includes("WULF 3, IREN 2") && alerts[0]!.endsWith(PAPER_ONLY));
  (r.worker as any).remainderSales.push({ symbol: "CIFR", shares: 7 });
  await r.at("14:31:30");
  assert.equal(r.said("alerts").filter((t) => t.includes("left without a stop")).length, 1, "at most one a minute");
  await r.at("14:32:10");
  assert.equal(r.said("alerts").filter((t) => t.includes("left without a stop")).length, 2);
});

test("the trade digest counts fills and exits from the live updates, one line per 5 minutes", async () => {
  const r = rig<FakeBroker, MemoryStore>({ orderStream: true });
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.at("14:30:00");
  await r.orderUpdate({ event: "fill", order: order({ clientOrderId: "cyrus-20261102-AAA-1", symbol: "AAA", side: "buy", status: "filled", qty: 2, filledQty: 2, filledAvgPrice: 10, groupId: "g1" }), positionQty: 2, atMs: z("14:31:00").getTime() });
  await r.orderUpdate({ event: "fill", order: order({ id: "11111111-1111-1111-1111-111111111111", clientOrderId: "leg", symbol: "AAA", side: "sell", type: "limit", status: "filled", qty: 2, filledQty: 2, filledAvgPrice: 10.03, groupId: "g1" }), positionQty: 0, atMs: z("14:31:30").getTime() });
  await r.orderUpdate({ event: "canceled", order: order({ clientOrderId: "cyrus-20261102-BBB-1", symbol: "BBB", side: "buy", status: "canceled", qty: 1, filledQty: 0, groupId: "g2" }), positionQty: null, atMs: z("14:32:00").getTime() });
  await r.at("14:34:00");
  assert.ok(!r.said("trading").some((t) => t.includes("filled")), "not before the 5 minutes");
  await r.at("14:35:00");
  assert.ok(r.said("trading").includes("8:30 AM CT to 8:35 AM CT: 1 filled, 1 unfilled and cancelled, 1 take-profit."), r.said("trading").slice(-2).join(" | "));
});

test("resume while today's loss is past the limit: the flag is still cleared, and the reply says the loss stop puts it back and it stays until the next trading day", async () => {
  const r = rig<FakeBroker, MemoryStore>();
  await r.at("2026-11-01T22:10:00Z");
  r.ownerSays("approve", "2026-11-01T22:20:00Z");
  await r.at("2026-11-01T22:20:10Z");
  await r.at("14:25:00");
  await r.store.setControl("stop_flag", { on: true, at: z("14:26:00").toISOString(), reason: "daily loss stop reached (600.00 dollars)" });
  r.broker.account = { ...r.broker.account, equity: 19400 };
  const setStop: boolean[] = [];
  const realSet = r.store.setControl.bind(r.store);
  r.store.setControl = async (k, v) => (k === "stop_flag" && setStop.push((v as { on: boolean }).on), realSet(k, v));
  r.ownerSays("resume", "14:27:00");
  await r.at("14:27:05");
  assert.equal(setStop[0], false, "resume cleared the flag, as before");
  const reply = r.said("commands").find((t) => t.startsWith("Stop cleared"))!;
  assert.ok(reply.includes("today's loss (600.00 dollars) is still past the 200 dollar daily limit") && reply.includes("within about 5 seconds") && reply.includes("until the next trading day"), reply);

  const ok = rig<FakeBroker, MemoryStore>();
  await ok.at("2026-11-01T22:10:00Z");
  ok.broker.failOn.add("getAccount");
  ok.ownerSays("resume", "2026-11-01T22:20:00Z");
  await ok.at("2026-11-01T22:20:10Z");
  // Fix of 2026-11-11: the plain reply now says what happens next (here no session is running: a Sunday evening).
  assert.equal(ok.bot.last(), "Stop cleared. No session is running now, so nothing trades until the next one (on its approved limits).", "the plain reply; a failed look never fails the resume");
  assert.equal(((await ok.store.getControl("stop_flag")) as { on: boolean }).on, false);
});

test("the loss stop's message does not say 'sold everything' when nothing was held (wording backlog)", async () => {
  const fb = new FakeBroker();
  const store = new MemoryStore();
  await ensureDay({ store, broker: fb, now: () => z("15:00:00") }, D);
  await store.updateDay(D, { status: "approved", phases: { armed: "x" }, dayStartEquity: 20000 });
  fb.account = { ...fb.account, equity: 19400 };
  const said: string[] = [];
  const liquidator = new Liquidator({ broker: fb, gate: new SellGate({ broker: fb, say: async () => true }), now: () => z("15:00:00"), sleep: async () => undefined });
  await enforceDailyLoss({ broker: fb, store, now: () => z("15:00:00"), say: async (_c, t) => (said.push(t), true), liquidator }, (await store.getDay(D))!);
  for (let i = 0; i < 20 && said.length === 0; i++) await new Promise((r) => setImmediate(r));
  const msg = said.find((t) => t.includes("Daily loss stop reached"))!;
  assert.ok(msg.includes("nothing was held") && !msg.includes("sold everything"), msg);
});

test("a long post whose later part fails is resumed by the retry from that part, without sending the first parts again (wording backlog)", async () => {
  const bodies: string[] = [];
  let failNext = 1; // the second message fails once
  let posts = 0;
  const impl = (async (url: string, init?: RequestInit) => {
    if (String(url).endsWith(`/guilds/${settings.discord.guildId}/channels`)) {
      return new Response(JSON.stringify([{ id: settings.discord.commandChannelId, name: "commands", type: 0 }, { id: "222222222222222222", name: "trading", type: 0 }, { id: "333333333333333333", name: "alerts", type: 0 }]), { status: 200 });
    }
    posts++;
    if (posts === 2 && failNext-- > 0) return new Response("{}", { status: 500 });
    bodies.push(JSON.parse(String(init!.body)).content);
    return new Response(JSON.stringify({ id: "1" }), { status: 200 });
  }) as typeof fetch;
  const bot = new DiscordBot(settings, makeRedactor([settings.discord.botToken]), impl);
  await bot.start();
  const text = Array.from({ length: 100 }, (_, i) => `row ${i} ${"z".repeat(40)}`).join("\n");
  const parts = messagesFor("commands", text);
  assert.ok(parts.length >= 3);
  assert.equal(await bot.post("commands", text), false, "the first try fails at its second part");
  assert.equal(await bot.post("commands", text), true, "the retry");
  assert.deepEqual(bodies, parts, "every part arrived exactly once, in order");
});

test("the summary says how many entries Alpaca refused and counts break-even trades, and ends with the research-input line", () => {
  const row = (id: string, status: OrderRecord["status"]): OrderRecord => ({ clientOrderId: id, tradeDate: D, symbol: "BBB", qty: 1, referencePrice: 50, stopPrice: 49.98, status, alpacaOrderId: status === "failed" ? null : id, filledQty: 1, filledAvgPrice: 50, note: null, createdAt: z("15:00:00").toISOString(), acceptMs: 100 });
  const trade = (id: string, exit: number) => order({ id, clientOrderId: id, symbol: "BBB", qty: 1, filledQty: 1, filledAvgPrice: 50, status: "filled", filledAt: z("15:00:01").toISOString(), legs: [order({ id: `${id}-x`, clientOrderId: `${id}-x`, side: "sell", type: "limit", qty: 1, filledQty: 1, filledAvgPrice: exit, status: "filled", symbol: "BBB", filledAt: z("15:00:02").toISOString() })] });
  const text = formatSummary({ day: day(), stored: [row("a", "filled"), row("b", "filled"), row("c", "failed")], refusals: [], alpacaOrders: [trade("a", 50.01), trade("b", 50)], account: { equity: 20000.01 } as never, peak: null, stop: null, flat: true });
  assert.ok(text.includes("Trades: 2 entry orders sent (2 filled); Alpaca refused 1 more, 2 sells filled. Closed trades: 1 won, 0 lost, 1 broke even."), text);
  assert.ok(!text.includes("60 second"), "no time-limit line");
  assert.ok(text.endsWith("Research input for a human decision, never an instruction to act."));
});
