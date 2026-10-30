// Test doubles for the broker and Discord, shared by the command, gate and day tests.
import type { Account, AccountConfig, CalendarDay, Clock, EntryOrder, Order, Position } from "../src/alpaca-trading.ts";
import type { Broker } from "../src/broker.ts";
import type { CommandBot } from "../src/commands.ts";
import type { DiscordMessage } from "../src/discord-bot.ts";
import { loadSettings } from "../src/config.ts";
import { FAKE_ENV } from "./fakes.ts";

export const settings = loadSettings({ ...FAKE_ENV });
export const OWNER = settings.discord.ownerUserId;
export const COMMANDS = settings.discord.commandChannelId;

export function order(over: Partial<Order> = {}): Order {
  return { id: "00000000-0000-0000-0000-000000000001", clientOrderId: "x", symbol: "AAA", side: "buy", qty: 1, filledQty: 0, filledAvgPrice: null, status: "new", orderClass: "oto", type: "market", stopPrice: null, legs: [], ...over };
}

export class FakeBroker implements Broker {
  calls: Array<{ fn: string; args: unknown[] }> = [];
  clock: Clock = { isOpen: true, timestamp: "", nextOpen: "", nextClose: "" };
  account: Account = { status: "ACTIVE", equity: 20000, lastEquity: 20000, cash: 20000, buyingPower: 20000, multiplier: 1, tradingBlocked: false, accountBlocked: false, shortingEnabled: false };
  config: AccountConfig = { maxMarginMultiplier: 1, noShorting: true, suspendTrade: false };
  calendar: CalendarDay[] = [{ date: "2026-11-02", open: "09:30", close: "16:00" }];
  positions: Position[] = [];
  orders: Order[] = [];
  failOn = new Set<string>();
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
  async getAccountConfig() { this.rec("getAccountConfig"); return this.config; }
  async setAccountConfig(patch: Partial<AccountConfig>) {
    this.rec("setAccountConfig", patch);
    this.config = { ...this.config, ...patch };
    return this.config;
  }
  async getCalendar(start: string, end: string) { this.rec("getCalendar", start, end); return this.calendar.filter((c) => c.date >= start && c.date <= end); }
  async listPositions() { this.rec("listPositions"); return this.positions; }
  async listOrders(status: "open" | "closed" | "all") {
    this.rec("listOrders", status);
    const open = new Set(["new", "accepted", "pending_new", "partially_filled", "held"]);
    return this.orders.filter((o) => (status === "all" ? true : status === "open" ? open.has(o.status) : !open.has(o.status)));
  }
  async findOrderByClientId(id: string) { this.rec("findOrderByClientId", id); return this.orders.find((o) => o.clientOrderId === id) ?? null; }
  async submitEntry(e: EntryOrder) {
    this.rec("submitEntry", e);
    const o = order({ id: `00000000-0000-0000-0000-${String(++this.n).padStart(12, "0")}`, clientOrderId: e.clientOrderId, symbol: e.symbol, qty: e.qty, status: "accepted" });
    this.orders.push(o);
    return o;
  }
  async cancelOrder(id: string) { this.rec("cancelOrder", id); this.orders = this.orders.map((o) => (o.id === id ? { ...o, status: "canceled" } : o)); }
  async closePosition(symbol: string) { this.rec("closePosition", symbol); this.positions = this.positions.filter((p) => p.symbol !== symbol); }
  async closeAllPositions() { this.rec("closeAllPositions"); this.positions = []; }
}

export class FakeBot implements CommandBot {
  posts: Array<{ channel: string; text: string }> = [];
  messages: DiscordMessage[] = [];
  async post(channel: "alerts" | "trading" | "commands", text: string) { this.posts.push({ channel, text }); return true; }
  async latestCommandMessageId() { return this.messages.length ? this.messages[this.messages.length - 1]!.id : null; }
  async commandMessagesAfter(afterId: string) { return this.messages.filter((m) => BigInt(m.id) > BigInt(afterId)); }
  last() { return this.posts[this.posts.length - 1]?.text ?? ""; }
  say(content: string, at: Date, over: Partial<DiscordMessage> = {}) {
    const id = String(100000000000000000n + BigInt(this.messages.length + 1));
    this.messages.push({ id, channelId: COMMANDS, content, authorId: OWNER, authorIsBot: false, at, ...over });
  }
}
