// A simulated Alpaca paper broker that reproduces what was MEASURED on 2026-11-02 (see builds/build-c2-log.md), so a
// rehearsal against it cannot pass by construction:
//   - a cancel is not instant: the order stays "pending_cancel" (and still holds its shares) for about 200 ms of
//     simulated time, and a sell for shares that are still held by an open order is refused (403, insufficient qty)
//   - a bracket's two exit orders are linked: when one fills the other is cancelled
//   - the account/order/position calls share a bucket of 200 requests that refills at 200 a minute; above it, 429
//   - the order list returns at most 500 orders at a time, oldest first
//   - failures can be injected: a bulk cancel that cancels and then fails, sells that are refused
// Time here is the simulation's own counter (`simMs`), moved by `sleep()` and `advance()`, not the test's wall clock.
import { AlpacaError, type Account, type AccountConfig, type CalendarDay, type Clock, type EntryOrder, type Order, type Position, type SellOrder } from "../src/alpaca-trading.ts";
import type { FullBroker } from "../src/broker.ts";
import { order } from "./helpers.ts";

const OPEN = new Set(["new", "accepted", "pending_new", "partially_filled", "held", "pending_cancel"]);
const CANCEL_MS = 200;

interface Pending {
  id: string;
  doneAt: number;
}

export class SimBroker implements FullBroker {
  simMs = 0;
  clockOpen = true;
  tokens = 200;
  bucketOn = true;
  config: AccountConfig = { maxMarginMultiplier: 1, noShorting: true, suspendTrade: false };
  cash = 20000;
  prices = new Map<string, number>();
  orders: Order[] = [];
  calendar: CalendarDay[] = [{ date: "2026-11-02", open: "09:30", close: "16:00" }];
  requests = 0;
  lowestTokens = 200;
  // Modes for the things nobody has measured yet: Alpaca may leave a FILLED entry (with its live exits) out of the open list,
  // and may not report qty_available. The sell tests run in every combination.
  hideFilledParents = false;
  reportQtyAvailable = true;
  rejected429 = 0;
  // Fault injection.
  cancelAllFailsAfterCancelling = false;
  refuseSellsTimes = 0;
  refuseSellIf: ((s: SellOrder) => boolean) | null = null; // a 403 for any sell this says yes to
  bucketTimes: number[] = []; // simulated time of every request that counted against the 200 a minute bucket
  sellFillDelayMs = 1500;
  maxSellQtyEver = 0;
  oversellAttempts = 0;
  sellLog: Array<{ symbol: string; qty: number; at: number }> = [];
  onRate: ((remaining: number) => void) | null = null;
  private positionsMap = new Map<string, { qty: number; avg: number }>();
  private n = 0;
  constructor(startMs = 0) {
    this.simMs = startMs;
  }
  private cancels: Pending[] = [];
  private sellFills: Array<{ id: string; at: number }> = [];


  // ---- simulated time ----
  advance(ms: number): void {
    this.simMs += ms;
    this.refill(ms);
    for (const c of [...this.cancels]) {
      if (this.simMs >= c.doneAt) {
        this.cancels = this.cancels.filter((x) => x !== c);
        this.setStatus(c.id, "canceled");
      }
    }
    for (const f of [...this.sellFills]) {
      if (this.simMs >= f.at) {
        this.sellFills = this.sellFills.filter((x) => x !== f);
        this.fillSell(f.id);
      }
    }
  }
  advanceTo(ms: number): void {
    if (ms > this.simMs) this.advance(ms - this.simMs);
  }
  sleep = async (ms: number): Promise<void> => this.advance(ms);

  private refill(ms: number) {
    this.tokens = Math.min(200, this.tokens + (ms * 200) / 60_000);
  }
  // One request against the bucket. `kind` copies what the real client does on a 429: reads retry 3 times with a
  // growing pause, safety writes (sells, cancels) wait and retry up to 8 times, and anything else fails at once.
  private spend(kind: "read" | "safety" | "plain" = "read") {
    const attempts = kind === "plain" ? 1 : kind === "read" ? 3 : 8;
    for (let i = 0; i < attempts; i++) {
      this.requests++;
      if (!this.bucketOn || this.tokens >= 1) {
        if (this.bucketOn) this.tokens -= 1;
        this.bucketTimes.push(this.simMs);
        this.lowestTokens = Math.min(this.lowestTokens, this.tokens);
        this.onRate?.(Math.floor(this.tokens));
        return;
      }
      this.rejected429++;
      if (i < attempts - 1) this.advance(kind === "read" ? 500 * 2 ** i : Math.min(2000, 250 * 2 ** i));
    }
    throw new AlpacaError("rate limit exceeded", 429);
  }

  // ---- state helpers ----
  private id() {
    return `00000000-0000-0000-0000-${String(++this.n).padStart(12, "0")}`;
  }
  private all(): Order[] {
    return this.orders.flatMap((o) => [o, ...o.legs]);
  }
  private setStatus(id: string, status: string) {
    for (const o of this.all()) if (o.id === id) o.status = status;
  }
  position(symbol: string) {
    return this.positionsMap.get(symbol);
  }
  heldQty(symbol: string): number {
    return this.positionsMap.get(symbol)?.qty ?? 0;
  }
  // Shares held by open sell orders (a bracket's two exits count once: only one can fill).
  private reservedBySells(symbol: string): number {
    let total = 0;
    for (const o of this.orders) {
      if (o.side === "buy") {
        const live = o.legs.filter((l) => l.side === "sell" && OPEN.has(l.status) && l.symbol === symbol);
        if (live.length) total += Math.max(...live.map((l) => l.qty - l.filledQty));
      } else if (o.symbol === symbol && OPEN.has(o.status)) total += o.qty - o.filledQty;
    }
    return total;
  }

  // Test-side market moves.
  fillEntry(clientOrderId: string, price: number): void {
    const o = this.orders.find((x) => x.clientOrderId === clientOrderId);
    if (!o) throw new Error("no such entry");
    o.status = "filled";
    o.filledQty = o.qty;
    o.filledAvgPrice = price;
    o.filledAt = new Date(this.simMs).toISOString();
    const cur = this.positionsMap.get(o.symbol) ?? { qty: 0, avg: 0 };
    this.positionsMap.set(o.symbol, { qty: cur.qty + o.qty, avg: price });
    this.prices.set(o.symbol, price);
    this.cash -= o.qty * price;
    for (const l of o.legs) l.status = "new"; // the exits wake up when the entry has filled
  }
  // The take-profit (or the stop) of an entry fills: the position closes and the linked leg is cancelled.
  fillExit(clientOrderId: string, which: "take_profit" | "stop", price: number): void {
    const o = this.orders.find((x) => x.clientOrderId === clientOrderId);
    if (!o) throw new Error("no such entry");
    const leg = o.legs.find((l) => (which === "stop" ? l.type === "stop" : l.type === "limit"));
    if (!leg || !OPEN.has(leg.status)) return; // already gone (cancelled by a liquidation): nothing fills
    leg.status = "filled";
    leg.filledQty = leg.qty;
    leg.filledAvgPrice = price;
    leg.filledAt = new Date(this.simMs).toISOString();
    for (const other of o.legs) if (other !== leg && OPEN.has(other.status)) other.status = "canceled";
    this.removeShares(o.symbol, leg.qty, price);
  }
  private removeShares(symbol: string, qty: number, price: number) {
    const cur = this.positionsMap.get(symbol);
    if (!cur) return;
    const left = cur.qty - qty;
    this.cash += qty * price;
    if (left <= 1e-9) this.positionsMap.delete(symbol);
    else this.positionsMap.set(symbol, { qty: left, avg: cur.avg });
  }
  private fillSell(id: string) {
    const o = this.orders.find((x) => x.id === id);
    if (!o || !OPEN.has(o.status)) return;
    const price = this.prices.get(o.symbol) ?? 100;
    o.status = "filled";
    o.filledQty = o.qty;
    o.filledAvgPrice = price;
    o.filledAt = new Date(this.simMs).toISOString();
    this.removeShares(o.symbol, o.qty, price);
  }

  // ---- the Broker interface ----
  async getClock(): Promise<Clock> {
    this.requests++; // separate bucket
    return { isOpen: this.clockOpen, timestamp: new Date(this.simMs).toISOString(), nextOpen: "", nextClose: new Date(Date.UTC(2026, 10, 2, 21, 0)).toISOString() };
  }
  async getCalendar(start: string, end: string): Promise<CalendarDay[]> {
    this.requests++;
    return this.calendar.filter((c) => c.date >= start && c.date <= end);
  }
  async getAccount(): Promise<Account> {
    this.spend();
    let equity = this.cash;
    for (const [s, p] of this.positionsMap) equity += p.qty * (this.prices.get(s) ?? p.avg);
    return { status: "ACTIVE", equity, lastEquity: 20000, cash: this.cash, buyingPower: equity, multiplier: this.config.maxMarginMultiplier, tradingBlocked: false, accountBlocked: false, shortingEnabled: !this.config.noShorting };
  }
  // The simulator keeps no minute-by-minute equity record: an empty history means "nothing crossed earlier".
  async getEquityHistoryToday(): Promise<Array<{ atMs: number; equity: number }>> {
    this.spend();
    return [];
  }
  async getAccountConfig(): Promise<AccountConfig> {
    this.spend();
    return { ...this.config };
  }
  async setAccountConfig(patch: Partial<AccountConfig>): Promise<AccountConfig> {
    this.spend();
    this.config = { ...this.config, ...patch };
    return { ...this.config };
  }
  async listPositions(): Promise<Position[]> {
    this.spend();
    return [...this.positionsMap].map(([symbol, p]) => {
      const price = this.prices.get(symbol) ?? p.avg;
      return { symbol, qty: p.qty, qtyAvailable: this.reportQtyAvailable ? Math.max(0, p.qty - this.reservedBySells(symbol)) : undefined, marketValue: p.qty * price, avgEntryPrice: p.avg, unrealizedPl: (price - p.avg) * p.qty };
    });
  }
  async listOrders(status: "open" | "closed" | "all", afterIso?: string): Promise<Order[]> {
    this.spend();
    let rows = this.orders.filter((o) => (status === "all" ? true : status === "open" ? OPEN.has(o.status) || (!this.hideFilledParents && o.legs.some((l) => OPEN.has(l.status))) : !OPEN.has(o.status)));
    if (afterIso) rows = rows.filter((o) => (o.createdAt ?? "") > afterIso);
    return rows.slice(0, 500).map((o) => structuredClone(o)); // oldest first, at most 500
  }
  async listOrdersPaged(status: "open" | "closed" | "all", afterIso: string, maxPages = 20) {
    const seen = new Map<string, Order>();
    let cursor = afterIso;
    let pages = 0;
    let complete = false;
    while (pages < maxPages) {
      const page = await this.listOrders(status, cursor);
      pages++;
      for (const o of page) seen.set(o.id, o);
      if (page.length < 500) {
        complete = true;
        break;
      }
      const last = page[page.length - 1]!.createdAt;
      if (!last || last === cursor) break;
      cursor = last;
    }
    return { orders: [...seen.values()], complete, pages };
  }
  async findOrderByClientId(id: string): Promise<Order | null> {
    this.spend();
    return structuredClone(this.orders.find((o) => o.clientOrderId === id) ?? null);
  }
  async submitEntry(e: EntryOrder): Promise<Order> {
    this.spend("plain");
    if (this.orders.some((o) => o.clientOrderId === e.clientOrderId)) throw new AlpacaError("client_order_id must be unique", 422);
    const created = new Date(this.simMs + this.n).toISOString();
    const parent = order({ id: this.id(), clientOrderId: e.clientOrderId, symbol: e.symbol, qty: e.qty, status: "accepted", orderClass: e.takeProfitPrice !== undefined ? "bracket" : "oto", createdAt: created });
    parent.legs = [
      ...(e.takeProfitPrice !== undefined ? [order({ id: this.id(), clientOrderId: `${e.clientOrderId}-tp`, symbol: e.symbol, side: "sell", qty: e.qty, status: "held", type: "limit", limitPrice: e.takeProfitPrice, createdAt: created })] : []),
      order({ id: this.id(), clientOrderId: `${e.clientOrderId}-sl`, symbol: e.symbol, side: "sell", qty: e.qty, status: "held", type: "stop", stopPrice: e.stopPrice, createdAt: created }),
    ];
    this.prices.set(e.symbol, e.referencePrice);
    this.orders.push(parent);
    return structuredClone(parent);
  }
  async submitSell(s: SellOrder): Promise<Order> {
    this.spend("safety");
    this.maxSellQtyEver = Math.max(this.maxSellQtyEver, s.qty);
    if (this.refuseSellIf?.(s)) throw new AlpacaError("sell refused (test)", 403);
    if (this.refuseSellsTimes > 0) {
      this.refuseSellsTimes--;
      throw new AlpacaError("sell refused (test)", 403);
    }
    const free = this.heldQty(s.symbol) - this.reservedBySells(s.symbol);
    if (s.qty > free + 1e-9) {
      this.oversellAttempts++;
      throw new AlpacaError(`insufficient qty available for order (requested: ${s.qty}, available: ${Math.max(0, free)})`, 403);
    }
    const o = order({ id: this.id(), clientOrderId: s.clientOrderId, symbol: s.symbol, side: "sell", qty: s.qty, status: "accepted", type: "market", orderClass: "", createdAt: new Date(this.simMs + this.n).toISOString() });
    this.orders.push(o);
    this.sellLog.push({ symbol: s.symbol, qty: s.qty, at: this.simMs });
    this.sellFills.push({ id: o.id, at: this.simMs + this.sellFillDelayMs });
    return structuredClone(o);
  }
  private startCancel(id: string) {
    const o = this.all().find((x) => x.id === id);
    if (!o || !OPEN.has(o.status) || o.status === "pending_cancel") return;
    o.status = "pending_cancel";
    this.cancels.push({ id, doneAt: this.simMs + CANCEL_MS });
  }
  async cancelOrder(id: string): Promise<void> {
    this.spend("safety");
    this.startCancel(id);
  }
  async cancelAllOrders(): Promise<{ attempted: number; failed: string[] }> {
    this.spend("safety");
    let n = 0;
    for (const o of this.all()) if (OPEN.has(o.status) && o.status !== "pending_cancel") (this.startCancel(o.id), n++);
    if (this.cancelAllFailsAfterCancelling) throw new AlpacaError("bulk cancel failed after cancelling (test)", 500);
    return { attempted: n, failed: [] };
  }
}
