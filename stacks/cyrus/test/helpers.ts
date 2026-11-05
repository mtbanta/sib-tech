// Test doubles for the broker and Discord, shared by the command, gate and day tests.
import type { Account, AccountConfig, CalendarDay, Clock, EntryOrder, Order, Position, SellOrder } from "../src/alpaca-trading.ts";
import { AlpacaError } from "../src/alpaca-trading.ts";
import type { FullBroker } from "../src/broker.ts";
import { splitMessage } from "../src/discord.ts";
import type { CommandBot } from "../src/commands.ts";
import type { DiscordMessage } from "../src/discord-bot.ts";
import { loadSettings } from "../src/config.ts";
import { FAKE_ENV } from "./fakes.ts";

export const settings = loadSettings({ ...FAKE_ENV });
export const OWNER = settings.discord.ownerUserId;
export const COMMANDS = settings.discord.commandChannelId;

export function order(over: Partial<Order> = {}): Order {
  return { id: "00000000-0000-0000-0000-000000000001", clientOrderId: "x", symbol: "AAA", side: "buy", qty: 1, filledQty: 0, filledAvgPrice: null, status: "new", orderClass: "oto", type: "market", stopPrice: null, limitPrice: null, createdAt: null, filledAt: null, legs: [], ...over };
}

export class FakeBroker implements FullBroker {
  calls: Array<{ fn: string; args: unknown[] }> = [];
  clock: Clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "" };
  account: Account = { status: "ACTIVE", equity: 20000, lastEquity: 20000, cash: 20000, buyingPower: 20000, multiplier: 1, tradingBlocked: false, accountBlocked: false, shortingEnabled: false };
  config: AccountConfig = { maxMarginMultiplier: 1, noShorting: true, suspendTrade: false };
  calendar: CalendarDay[] = [{ date: "2026-11-02", open: "09:30", close: "16:00" }];
  positions: Position[] = [];
  orders: Order[] = [];
  failOn = new Set<string>();
  // When true a sell is accepted but the position stays (the sell has not filled yet).
  sellsStick = false;
  // A test can make every sell wait, or fail, by setting this (it runs inside submitSell before the position changes).
  onSell: ((s: SellOrder) => Promise<void>) | null = null;
  private n = 0;

  private rec(fn: string, ...args: unknown[]) {
    this.calls.push({ fn, args });
    if (this.failOn.has(fn)) throw new Error(`${fn} failed (test)`);
  }
  count(fn: string) {
    return this.calls.filter((c) => c.fn === fn).length;
  }
  async getClock() { this.rec("getClock"); return this.clock; }
  async getAccount() { this.rec("getAccount"); return this.account; }
  // Today's equity a minute at a time (Alpaca's portfolio history). Empty unless a test fills it.
  equityHistory: Array<{ atMs: number; equity: number }> = [];
  async getEquityHistoryToday() { this.rec("getEquityHistoryToday"); return this.equityHistory; }
  async getAccountConfig() { this.rec("getAccountConfig"); return this.config; }
  async setAccountConfig(patch: Partial<AccountConfig>) {
    this.rec("setAccountConfig", patch);
    this.config = { ...this.config, ...patch };
    return this.config;
  }
  async getCalendar(start: string, end: string) { this.rec("getCalendar", start, end); return this.calendar.filter((c) => c.date >= start && c.date <= end); }
  async listPositions() { this.rec("listPositions"); return this.positions; }
  async listOrders(status: "open" | "closed" | "all", afterIso?: string) {
    this.rec("listOrders", status, afterIso);
    const open = new Set(["new", "accepted", "pending_new", "partially_filled", "held"]);
    return this.orders.filter((o) => (status === "all" ? true : status === "open" ? open.has(o.status) : !open.has(o.status)));
  }
  async findOrderByClientId(id: string) { this.rec("findOrderByClientId", id); return this.orders.find((o) => o.clientOrderId === id) ?? null; }
  async listOrdersPaged(status: "open" | "closed" | "all", afterIso: string, _maxPages = 20) {
    this.rec("listOrdersPaged", status, afterIso);
    const orders = await this.listOrders(status, afterIso);
    return { orders, complete: true, pages: 1 };
  }
  async submitEntry(e: EntryOrder) {
    this.rec("submitEntry", e);
    const o = order({ id: `00000000-0000-0000-0000-${String(++this.n).padStart(12, "0")}`, clientOrderId: e.clientOrderId, symbol: e.symbol, qty: e.qty, status: "accepted", orderClass: e.takeProfitPrice !== undefined ? "bracket" : "oto" });
    this.orders.push(o);
    return o;
  }
  async submitSell(s: SellOrder) {
    this.rec("submitSell", s);
    await this.onSell?.(s);
    const held = this.positions.find((p) => p.symbol === s.symbol)?.qty ?? 0;
    if (s.qty > held + 1e-9) throw new AlpacaError("insufficient qty available for order", 403);
    const o = order({ id: `00000000-0000-0000-0000-${String(++this.n).padStart(12, "0")}`, clientOrderId: s.clientOrderId, symbol: s.symbol, side: "sell", qty: s.qty, status: this.sellsStick ? "accepted" : "filled", filledQty: this.sellsStick ? 0 : s.qty, filledAvgPrice: this.sellsStick ? null : 100, type: "market", orderClass: "" });
    this.orders.push(o);
    if (!this.sellsStick) this.positions = this.positions.filter((p) => p.symbol !== s.symbol);
    return o;
  }
  async cancelOrder(id: string) { this.rec("cancelOrder", id); this.orders = this.orders.map((o) => (o.id === id ? { ...o, status: "canceled" } : { ...o, legs: o.legs.map((l) => (l.id === id ? { ...l, status: "canceled" } : l)) })); }
  async cancelAllOrders() {
    this.rec("cancelAllOrders");
    const open = new Set(["new", "accepted", "pending_new", "partially_filled", "held"]);
    const n = this.orders.filter((o) => open.has(o.status) || o.legs.some((l) => open.has(l.status))).length;
    this.orders = this.orders.map((o) => ({ ...o, status: open.has(o.status) ? "canceled" : o.status, legs: o.legs.map((l) => (open.has(l.status) ? { ...l, status: "canceled" } : l)) }));
    return { attempted: n, failed: [] as string[] };
  }
}

import { Liquidator, SellGate } from "../src/sells.ts";
// A liquidator wired to a fake broker, for tests that call the risk or close-out code directly.
export function liquidatorFor(broker: FakeBroker, say: (ch: any, text: string, opts?: any) => Promise<boolean>, now: () => Date) {
  return new Liquidator({ broker, gate: new SellGate({ broker, say }), now, sleep: async () => undefined });
}

export class FakeBot implements CommandBot {
  posts: Array<{ channel: string; text: string; mention: boolean }> = [];
  messages: DiscordMessage[] = [];
  // Like the real bot: a text over Discord's limit arrives as consecutive messages (splitMessage).
  async post(channel: "alerts" | "trading" | "commands", text: string, opts: { mentionOwner?: boolean } = {}) { splitMessage(text).forEach((part, i) => this.posts.push({ channel, text: part, mention: opts.mentionOwner === true && i === 0 })); return true; }
  async latestCommandMessageId() { return this.messages.length ? this.messages[this.messages.length - 1]!.id : null; }
  async commandMessagesAfter(afterId: string) { return this.messages.filter((m) => BigInt(m.id) > BigInt(afterId)); }
  last() { return this.posts[this.posts.length - 1]?.text ?? ""; }
  say(content: string, at: Date, over: Partial<DiscordMessage> = {}) {
    const id = String(100000000000000000n + BigInt(this.messages.length + 1));
    this.messages.push({ id, channelId: COMMANDS, content, authorId: OWNER, authorIsBot: false, at, ...over });
  }
}
