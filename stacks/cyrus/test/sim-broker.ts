// A simulated Alpaca paper broker that reproduces what was MEASURED on 2026-11-02 (see builds/build-c2-log.md), so a
// rehearsal against it cannot pass by construction:
//   - a cancel is not instant: the order stays "pending_cancel" (and still holds its shares) for about 200 ms of
//     simulated time, and a sell for shares that are still held by an open order is refused (403, insufficient qty)
//   - a bracket's two exit orders are linked: when one fills the other is cancelled
//   - the account/order/position calls share a bucket of 200 requests that refills at 200 a minute; above it, 429
//   - the order list returns at most 500 orders at a time, oldest first
//   - failures can be injected: a bulk cancel that cancels and then fails, sells that are refused
// Time here is the simulation's own counter (`simMs`), moved by `sleep()` and `advance()`, not the test's wall clock.
import { AlpacaError, type Account, type AccountConfig, type CalendarDay, type Clock, type EntryOrder, type Order, type Position, type ReplaceOrder, type SellOrder } from "../src/alpaca-trading.ts";
import type { FullBroker } from "../src/broker.ts";
import { chargeFromScope } from "../src/request-scope.ts";
import { noteSafetyCall } from "./tag-audit.ts";
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
  // 2026-11-09: shares Alpaca keeps reporting as not available for a symbol although no open order holds them (a guess at what blocked
  // four sales that day; a test fault).
  staleHeld = new Map<string, number>();
  rejected429 = 0;
  // Fault injection.
  cancelAllFailsAfterCancelling = false;
  refuseSellsTimes = 0;
  refuseSellIf: ((s: SellOrder) => boolean) | null = null; // a 403 for any sell this says yes to
  bucketTimes: number[] = []; // simulated time of every request that counted against the 200 a minute bucket
  sellFillDelayMs = 1500;
  // Release A: how long a cancel takes (2026-11-04 measured about 11 seconds for a resting take-profit at the close-out).
  cancelMs = CANCEL_MS;
  // Release A: client ids the "list orders" answer leaves out (2026-11-04: 2 of 2,022 entries were missing from every page).
  hiddenFromListing = new Set<string>();
  findCalls = 0;
  maxSellQtyEver = 0;
  oversellAttempts = 0;
  sellLog: Array<{ symbol: string; qty: number; at: number }> = [];
  onRate: ((remaining: number) => void) | null = null;
  // The redesign of 2026-11-14, part 1: told about every request as it is sent (the budget's per-tag statistics), like the real client.
  onSend: ((path: string) => void) | null = null;
  private positionsMap = new Map<string, { qty: number; avg: number }>();
  private n = 0;
  constructor(startMs = 0) {
    this.simMs = startMs;
  }
  private cancels: Pending[] = [];
  // ---- the moved take-profit (Michael's decision of 2026-11-18), as MEASURED on paper on 2026-11-17 and 2026-11-18 ----
  //   - a replace answers with a NEW order: a new id, `replaces` naming the old one, the same group id; the old one becomes "replaced", and
  //     the entry's nested legs show the new one (the old one is no longer among them)
  //   - Alpaca keeps a bracket's take-profit above its stop: a replace that would put the take-profit at or below the stop (or the stop at or
  //     above the take-profit) is refused, 422 "take_profit.limit_price must be > stop_loss.stop_price"
  //   - a selling limit (at or below the price) fills about 0.3 to 1.4 s after the replace (`replaceFillDelayMs`), and the stop is cancelled
  //     by Alpaca at the fill (OCO); a limit above the price waits
  //   - a replacement's filled quantity includes what the order it replaced had filled (the partial test of 2026-11-18)
  //   - `openShape20261118`: the open-orders list shows a FILLED bracket as its take-profit leg alone, at the top level with no legs; the
  //     stop leg (held) is not listed (one read on 2026-11-18, 27 open brackets)
  replaceFillDelayMs = 600;
  openShape20261118 = false;
  refuseReplaceIf: ((id: string, change: ReplaceOrder) => number | null) | null = null; // an HTTP status to answer instead (fault injection)
  keepsReplaceClientId = true; // whether the replacement carries the client id asked for (else Alpaca's own)
  readonly replaceLog: Array<{ id: string; newId: string; at: number; change: ReplaceOrder }> = [];
  // Told about each order event as the live updates would report it (a test connects it to the worker's handlers).
  onOrderEvent: ((event: string, o: Order, atMs: number) => void) | null = null;
  private replacedOrders: Order[] = [];
  private limitChecks: Array<{ id: string; at: number }> = [];
  private sellFills: Array<{ id: string; at: number }> = [];
  // A4: fresh stops placed, and whether Alpaca refuses them.
  readonly stopLog: Array<{ symbol: string; qty: number; stopPrice: number; at: number; clientOrderId: string }> = [];
  refuseStops = false;
  // A4: the price fell to a resting stop sell of this symbol: it fills now.
  triggerStop(symbol: string): void {
    const o = this.orders.find((x) => x.symbol === symbol && x.side === "sell" && x.type === "stop" && OPEN.has(x.status) && x.status !== "pending_cancel");
    if (o) this.fillSell(o.id);
  }


  // ---- simulated time ----
  advance(ms: number): void {
    if (this.openShape20261118) return this.advanceInOrder(ms);
    this.simMs += ms;
    this.refill(ms);
    for (const c of [...this.cancels]) {
      if (this.simMs >= c.doneAt) {
        this.cancels = this.cancels.filter((x) => x !== c);
        // In the 2026-11-18 mode, an order that filled while its cancel was pending stays filled (a pending cancel can still fill).
        if (this.openShape20261118 && this.all().some((o) => o.id === c.id && o.status !== "pending_cancel")) continue;
        this.setStatus(c.id, "canceled");
      }
    }
    for (const f of [...this.sellFills]) {
      if (this.simMs >= f.at) {
        this.sellFills = this.sellFills.filter((x) => x !== f);
        this.fillSell(f.id);
      }
    }
    for (const c of [...this.limitChecks]) {
      if (this.simMs >= c.at) {
        this.limitChecks = this.limitChecks.filter((x) => x !== c);
        this.fillLegIfMarketable(c.id);
      }
    }
  }
  // The 2026-11-18 mode: what falls due inside one step is done in time order (a fill due before a cancel completes happens first), each at
  // its own time.
  private advanceInOrder(ms: number): void {
    const end = this.simMs + ms;
    this.refill(ms);
    for (let guard = 0; guard < 10_000; guard++) {
      const due: Array<{ at: number; run: () => void }> = [
        ...this.cancels.filter((c) => c.doneAt <= end).map((c) => ({ at: c.doneAt, run: () => {
          this.cancels = this.cancels.filter((x) => x !== c);
          if (this.all().some((o) => o.id === c.id && o.status === "pending_cancel")) this.setStatus(c.id, "canceled");
        } })),
        ...this.sellFills.filter((f) => f.at <= end).map((f) => ({ at: f.at, run: () => {
          this.sellFills = this.sellFills.filter((x) => x !== f);
          this.fillSell(f.id);
        } })),
        ...this.limitChecks.filter((c) => c.at <= end).map((c) => ({ at: c.at, run: () => {
          this.limitChecks = this.limitChecks.filter((x) => x !== c);
          this.fillLegIfMarketable(c.id);
        } })),
      ].sort((a, b) => a.at - b.at);
      const next = due[0];
      if (!next) break;
      this.simMs = Math.max(this.simMs, next.at);
      next.run();
    }
    this.simMs = end;
  }
  // A resting take-profit leg whose limit is at or below the price fills now; its sibling is cancelled (OCO).
  private fillLegIfMarketable(id: string): void {
    for (const p of this.orders) {
      const leg = p.legs.find((l) => l.id === id);
      if (!leg) continue;
      // A pending cancel can still fill (2026-11-18 mode); otherwise only a working leg.
      if (!(leg.status === "new" || leg.status === "accepted" || (this.openShape20261118 && leg.status === "pending_cancel")) || leg.limitPrice === null) return;
      const price = this.prices.get(leg.symbol) ?? 0;
      if (!(leg.limitPrice <= price + 1e-9)) return;
      const qty = leg.qty - leg.filledQty;
      leg.status = "filled";
      leg.filledQty = leg.qty;
      leg.filledAvgPrice = price;
      leg.filledAt = new Date(this.simMs).toISOString();
      this.removeShares(leg.symbol, qty, price);
      this.onOrderEvent?.("fill", structuredClone(leg), this.simMs);
      for (const other of p.legs) {
        if (other !== leg && OPEN.has(other.status)) {
          this.setStatus(other.id, "canceled");
          this.onOrderEvent?.("canceled", structuredClone(other), this.simMs + 2);
        }
      }
      return;
    }
  }
  advanceTo(ms: number): void {
    if (ms > this.simMs) this.advance(ms - this.simMs);
  }
  sleep = async (ms: number): Promise<void> => this.advance(ms);

  // Release 11 (decision 7): the refill a test leaves for the work it simulates (200 a minute; less to stand for routine requests that
  // run beside it, which the simulation does not send itself).
  refillPerMinute = 200;
  private refill(ms: number) {
    this.tokens = Math.min(200, this.tokens + (ms * this.refillPerMinute) / 60_000);
  }
  // One request against the bucket. `kind` copies what the real client does on a 429: reads retry 3 times with a
  // growing pause, safety writes (sells, cancels) wait and retry up to 8 times, and anything else fails at once.
  private spend(kind: "read" | "safety" | "plain" = "read") {
    const attempts = kind === "plain" ? 1 : kind === "read" ? 3 : 8;
    for (let i = 0; i < attempts; i++) {
      // Like the real client: every attempt is charged to the reservation of the scope it is made in.
      chargeFromScope("/v2/sim");
      this.onSend?.("/v2/sim");
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
    for (const o of this.all()) if (o.id === id) {
      o.status = status;
      o.updatedAt = new Date(this.simMs).toISOString();
      if (status === "canceled") o.canceledAt = o.updatedAt;
    }
    if (status === "canceled" && this.onOrderEvent) for (const o of this.all()) if (o.id === id) this.onOrderEvent("canceled", structuredClone(o), this.simMs);
  }
  // What Alpaca paper did 655 times on 2026-11-04: the take-profit fills part of the shares and, 2 ms later, the stop is
  // cancelled (Alpaca's documentation says it should be resized instead). The rest stays on the take-profit alone.
  partialTakeProfit(clientOrderId: string, qty: number, price: number): void {
    const o = this.orders.find((x) => x.clientOrderId === clientOrderId);
    if (!o) throw new Error("no such entry");
    const tp = o.legs.find((l) => l.type === "limit")!;
    const stop = o.legs.find((l) => l.type === "stop")!;
    tp.filledQty += qty;
    tp.filledAvgPrice = price;
    tp.status = tp.filledQty >= tp.qty - 1e-9 ? "filled" : "partially_filled";
    if (tp.status === "filled") tp.filledAt = new Date(this.simMs).toISOString();
    if (OPEN.has(stop.status)) this.setStatus(stop.id, "canceled");
    this.removeShares(o.symbol, qty, price);
  }
  // Michael's item 1 of 2026-11-13 (afternoon): a partial take-profit where Alpaca's own order list keeps showing the stop as pending cancel
  // for `lagMs` (the live update already said "canceled"), as on 2026-11-13 (7 of 34 remainders noticed 11 to 16 s late).
  partialTakeProfitListLag(clientOrderId: string, qty: number, price: number, lagMs: number): void {
    const o = this.orders.find((x) => x.clientOrderId === clientOrderId);
    if (!o) throw new Error("no such entry");
    const tp = o.legs.find((l) => l.type === "limit")!;
    const stop = o.legs.find((l) => l.type === "stop")!;
    tp.filledQty += qty;
    tp.filledAvgPrice = price;
    tp.status = tp.filledQty >= tp.qty - 1e-9 ? "filled" : "partially_filled";
    stop.status = "pending_cancel";
    this.cancels.push({ id: stop.id, doneAt: this.simMs + lagMs });
    this.removeShares(o.symbol, qty, price);
  }
  // What Alpaca paper did 6 times on 2026-11-06: a cancel of the entry reached Alpaca as the entry filled; the entry stayed filled
  // and BOTH exits were cancelled, leaving the shares with no exit at all.
  cancelExitsAtFill(clientOrderId: string): void {
    const o = this.orders.find((x) => x.clientOrderId === clientOrderId);
    if (!o) throw new Error("no such entry");
    for (const l of o.legs) if (OPEN.has(l.status)) this.setStatus(l.id, "canceled");
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
      return { symbol, qty: p.qty, qtyAvailable: this.reportQtyAvailable ? Math.max(0, p.qty - this.reservedBySells(symbol) - (this.staleHeld.get(symbol) ?? 0)) : undefined, marketValue: p.qty * price, avgEntryPrice: p.avg, unrealizedPl: (price - p.avg) * p.qty };
    });
  }
  async listOrders(status: "open" | "closed" | "all", afterIso?: string): Promise<Order[]> {
    this.spend();
    let rows = this.orders.filter((o) => (status === "all" ? true : status === "open" ? OPEN.has(o.status) || (!this.hideFilledParents && o.legs.some((l) => OPEN.has(l.status))) : !OPEN.has(o.status)));
    if (status === "open" && this.openShape20261118) {
      // 2026-11-18: a filled bracket shows as its open take-profit leg alone (top level, no legs); the held stop is not listed.
      rows = this.orders.flatMap((o) => {
        if (OPEN.has(o.status)) return [o];
        if (o.side !== "buy") return [];
        return o.legs.filter((l) => OPEN.has(l.status) && l.type === "limit").map((l) => ({ ...l, legs: [] }));
      });
    }
    if (afterIso) rows = rows.filter((o) => (o.createdAt ?? "") > afterIso);
    rows = rows.filter((o) => !this.hiddenFromListing.has(o.clientOrderId));
    return rows.slice(0, 500).map((o) => structuredClone(o)); // oldest first, at most 500
  }
  async listOrdersWindow(afterIso: string, untilIso: string, maxPages = 10) {
    const seen = new Map<string, Order>();
    let cursor = afterIso;
    let pages = 0;
    let complete = false;
    while (pages < maxPages) {
      this.spend();
      const page = this.orders
        .filter((o) => !this.hiddenFromListing.has(o.clientOrderId))
        .filter((o) => {
          const t = o.submittedAt ?? o.createdAt ?? "";
          return t > cursor && t < untilIso;
        })
        .slice(0, 500)
        .map((o) => structuredClone(o));
      pages++;
      for (const o of page) seen.set(o.id, o);
      if (page.length < 500) {
        complete = true;
        break;
      }
      const lastOrder = page[page.length - 1]!;
      const last = lastOrder.submittedAt ?? lastOrder.createdAt;
      if (!last || last === cursor) break;
      cursor = last;
    }
    return { orders: [...seen.values()], complete, pages };
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
    this.findCalls++;
    return structuredClone(this.orders.find((o) => o.clientOrderId === id) ?? null);
  }
  async getOrderById(id: string): Promise<Order | null> {
    this.spend();
    for (const o of this.orders) {
      if (o.id === id) return structuredClone(o);
      const leg = o.legs.find((l) => l.id === id);
      if (leg) return structuredClone(leg);
    }
    const old = this.replacedOrders.find((o) => o.id === id);
    if (old) return structuredClone(old);
    return null;
  }
  // About one read per 100 fills, as Alpaca pages them (each page waits for `beforePage`, the summary's pacing).
  async listFillsForDay(_date: string, _maxPages = 400, beforePage?: () => Promise<void>) {
    const n = this.all().filter((o) => o.filledQty > 0).length;
    for (let i = 0; i < Math.max(1, Math.ceil(n / 100)); i++) {
      if (beforePage) await beforePage();
      this.spend();
    }
    const fills: Array<{ id: string; orderId: string; symbol: string; side: string; qty: number; price: number; at: string }> = [];
    for (const o of this.all()) if (o.filledQty > 0) fills.push({ id: `fill-${o.id}`, orderId: o.id, symbol: o.symbol, side: o.side, qty: o.filledQty, price: o.filledAvgPrice ?? 0, at: o.filledAt ?? "" });
    return { fills, complete: true, pages: 1 };
  }
  async submitEntry(e: EntryOrder): Promise<Order> {
    noteSafetyCall("submitEntry");
    this.spend("plain");
    if (this.orders.some((o) => o.clientOrderId === e.clientOrderId)) throw new AlpacaError("client_order_id must be unique", 422);
    const created = new Date(this.simMs + this.n).toISOString();
    const groupId = `group-${this.n + 1}`; // release B: Alpaca gives a bracket's entry and its legs one group id
    const parent = order({ id: this.id(), clientOrderId: e.clientOrderId, symbol: e.symbol, qty: e.qty, status: "accepted", orderClass: e.takeProfitPrice !== undefined ? "bracket" : "oto", createdAt: created, groupId });
    parent.legs = [
      ...(e.takeProfitPrice !== undefined ? [order({ id: this.id(), clientOrderId: `${e.clientOrderId}-tp`, symbol: e.symbol, side: "sell", qty: e.qty, status: "held", type: "limit", limitPrice: e.takeProfitPrice, createdAt: created, groupId, ...(this.openShape20261118 ? { orderClass: "bracket" } : {}) })] : []),
      order({ id: this.id(), clientOrderId: `${e.clientOrderId}-sl`, symbol: e.symbol, side: "sell", qty: e.qty, status: "held", type: "stop", stopPrice: e.stopPrice, createdAt: created, groupId, ...(this.openShape20261118 ? { orderClass: e.takeProfitPrice !== undefined ? "bracket" : "oto" } : {}) }),
    ];
    this.prices.set(e.symbol, e.referencePrice);
    this.orders.push(parent);
    return structuredClone(parent);
  }
  async submitSell(s: SellOrder): Promise<Order> {
    noteSafetyCall("submitSell");
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
    // A4 of 2026-11-12: a stop sell rests at Alpaca (it holds the shares) until `triggerStop` fills it. `refuseStops` makes Alpaca refuse
    // it outright, as it does when the price is already below the stop price.
    if (s.stopPrice !== undefined) {
      if (this.refuseStops) throw new AlpacaError("stop price must be below the current price (test)", 422);
      const st = order({ id: this.id(), clientOrderId: s.clientOrderId, symbol: s.symbol, side: "sell", qty: s.qty, status: "accepted", type: "stop", stopPrice: s.stopPrice, orderClass: "", createdAt: new Date(this.simMs + this.n).toISOString() });
      this.orders.push(st);
      this.stopLog.push({ symbol: s.symbol, qty: s.qty, stopPrice: s.stopPrice, at: this.simMs, clientOrderId: s.clientOrderId });
      return structuredClone(st);
    }
    const o = order({ id: this.id(), clientOrderId: s.clientOrderId, symbol: s.symbol, side: "sell", qty: s.qty, status: "accepted", type: "market", orderClass: "", createdAt: new Date(this.simMs + this.n).toISOString() });
    this.orders.push(o);
    this.sellLog.push({ symbol: s.symbol, qty: s.qty, at: this.simMs });
    this.sellFills.push({ id: o.id, at: this.simMs + this.sellFillDelayMs });
    return structuredClone(o);
  }
  async replaceOrder(id: string, change: ReplaceOrder): Promise<Order> {
    noteSafetyCall("replaceOrder");
    this.spend("plain");
    const forced = this.refuseReplaceIf?.(id, change) ?? null;
    if (forced !== null) throw new AlpacaError(`replace refused (test ${forced})`, forced);
    const parent = this.orders.find((o) => o.legs.some((l) => l.id === id));
    const leg = parent?.legs.find((l) => l.id === id);
    if (!parent || !leg) throw new AlpacaError("order not found", 404);
    if (!OPEN.has(leg.status) || leg.status === "pending_cancel") throw new AlpacaError(`order is not open (${leg.status})`, 422);
    const tp = leg.type === "limit" ? leg : parent.legs.find((l) => l.type === "limit");
    const sl = leg.type === "stop" ? leg : parent.legs.find((l) => l.type === "stop");
    const newLimit = leg.type === "limit" ? (change.limitPrice ?? leg.limitPrice) : (tp?.limitPrice ?? null);
    const newStop = leg.type === "stop" ? (change.stopPrice ?? leg.stopPrice) : (sl?.stopPrice ?? null);
    if (newLimit !== null && newStop !== null && tp && sl && OPEN.has(tp.status) && OPEN.has(sl.status) && !(newLimit > newStop + 1e-9)) throw new AlpacaError("take_profit.limit_price must be > stop_loss.stop_price", 422);
    const nu: Order = structuredClone(leg);
    nu.id = this.id();
    nu.clientOrderId = change.clientOrderId && this.keepsReplaceClientId ? change.clientOrderId : `alpaca-${this.n}`;
    if (change.limitPrice !== undefined) nu.limitPrice = Math.floor(change.limitPrice * 100 + 1e-9) / 100;
    if (change.stopPrice !== undefined) nu.stopPrice = Math.floor(change.stopPrice * 100 + 1e-9) / 100;
    nu.replaces = leg.id;
    nu.status = leg.status === "held" ? "held" : "new";
    nu.createdAt = new Date(this.simMs).toISOString();
    leg.status = "replaced";
    this.replacedOrders.push(leg);
    parent.legs = parent.legs.map((l) => (l.id === id ? nu : l));
    this.replaceLog.push({ id, newId: nu.id, at: this.simMs, change });
    this.onOrderEvent?.("replaced", structuredClone(leg), this.simMs);
    if (nu.type === "limit" && nu.status === "new") this.limitChecks.push({ id: nu.id, at: this.simMs + this.replaceFillDelayMs });
    return structuredClone(nu);
  }
  // The price moves: a resting take-profit at or below the new price fills (test-side).
  setPrice(symbol: string, price: number): void {
    this.prices.set(symbol, price);
  }
  private startCancel(id: string) {
    const o = this.all().find((x) => x.id === id);
    if (!o || !OPEN.has(o.status) || o.status === "pending_cancel") return;
    o.status = "pending_cancel";
    this.cancels.push({ id, doneAt: this.simMs + this.cancelMs });
    // In the 2026-11-18 mode, cancelling one leg of a filled bracket cancels its sibling too (one-cancels-other; paper test A of 2026-11-17:
    // the stop's own cancel was answered "already cancelling with its sibling").
    if (this.openShape20261118) {
      const parent = this.orders.find((p) => p.legs.some((l) => l.id === id));
      for (const sib of parent?.legs ?? []) if (sib.id !== id && OPEN.has(sib.status) && sib.status !== "pending_cancel") {
        sib.status = "pending_cancel";
        this.cancels.push({ id: sib.id, doneAt: this.simMs + this.cancelMs });
      }
    }
  }
  async cancelOrder(id: string): Promise<void> {
    noteSafetyCall("cancelOrder");
    this.spend("safety");
    this.startCancel(id);
  }
  async cancelAllOrders(): Promise<{ attempted: number; failed: string[] }> {
    noteSafetyCall("cancelAllOrders");
    this.spend("safety");
    let n = 0;
    const failed: string[] = [];
    for (const o of this.all()) {
      if (o.status === "pending_cancel") failed.push(`${o.id}: order pending cancel`); // what Alpaca answered on 2026-11-04
      else if (OPEN.has(o.status)) (this.startCancel(o.id), n++);
    }
    if (this.cancelAllFailsAfterCancelling) throw new AlpacaError("bulk cancel failed after cancelling (test)", 500);
    return { attempted: n, failed };
  }
}
