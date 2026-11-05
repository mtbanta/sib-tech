// Alpaca trading client, PAPER ONLY. Every request goes to the one fixed paper host. The address is built
// from a constant and checked again before each call, so no input can send a request to a live endpoint.
//
// Orders are safe to retry: each entry carries a client_order_id, and after any unclear failure the client
// asks Alpaca whether that id already exists before it sends again.
import { assertPaperHost, PAPER_TRADING_BASE_URL, type Settings } from "./config.ts";

export class AlpacaError extends Error {
  readonly status: number;
  // The per-item answers of a bulk call, when there were any.
  items?: Array<Record<string, unknown>>;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AlpacaError";
    this.status = status;
  }
}

export interface Account {
  status: string;
  equity: number;
  lastEquity: number; // equity at the previous close: the day's starting point
  cash: number;
  buyingPower: number;
  multiplier: number;
  tradingBlocked: boolean;
  accountBlocked: boolean;
  shortingEnabled: boolean;
}

// One point of the account's equity during today's session (Alpaca's portfolio history, one point a minute).
export interface EquityPoint {
  atMs: number;
  equity: number;
}

export interface AccountConfig {
  maxMarginMultiplier: number;
  noShorting: boolean;
  suspendTrade: boolean;
}

export interface Clock {
  isOpen: boolean;
  timestamp: string;
  nextOpen: string;
  nextClose: string;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  open: string; // HH:MM New York time
  close: string; // HH:MM New York time (earlier on half days)
}

export interface Position {
  symbol: string;
  qty: number;
  // Shares not held by open orders, if Alpaca reports it (null when it does not).
  qtyAvailable?: number | null;
  marketValue: number;
  avgEntryPrice: number;
  unrealizedPl: number;
}

export interface Order {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: string;
  qty: number;
  filledQty: number;
  filledAvgPrice: number | null;
  status: string;
  orderClass: string;
  type: string;
  stopPrice: number | null;
  limitPrice: number | null;
  createdAt: string | null;
  filledAt: string | null;
  // When Alpaca cancelled the order, and when it last changed (release A: the time a bracket's stop was cancelled after a
  // partial take-profit). Optional so older test doubles need not set them.
  canceledAt?: string | null;
  updatedAt?: string | null;
  // Release B: Alpaca's group id. A bracket's entry and its two exit legs share it, which is how a live order update about an
  // exit leg (which carries no client id of ours) is tied back to its entry.
  groupId?: string | null;
  legs: Order[];
}

export interface EntryOrder {
  symbol: string;
  qty: number;
  stopPrice: number;
  referencePrice: number;
  clientOrderId: string;
  // With a take-profit price the entry is a bracket (two linked exits held at Alpaca, only one can fill);
  // without it, an OTO order with the protective stop only.
  takeProfitPrice?: number;
  // The speed release (the load window): a limit buy at this price, at or below the reference price, instead of a market buy.
  // Alpaca then checks the exits against this limit price.
  limitPrice?: number;
}

export interface SellOrder {
  symbol: string;
  qty: number;
  clientOrderId: string;
}

// What the rate-limit headers on a response said. Alpaca counts the account, order and position calls in one
// bucket (limit 200); the clock and calendar have their own (limit 1000).
export interface RateInfo {
  path: string;
  status: number;
  limit: number | null;
  remaining: number | null;
  reset: number | null;
}

type Json = Record<string, unknown>;
const num = (v: unknown): number => (typeof v === "string" || typeof v === "number" ? Number(v) : NaN);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v));

export function parseOrder(raw: Json): Order {
  const legs = Array.isArray(raw.legs) ? (raw.legs as Json[]).map(parseOrder) : [];
  return {
    id: String(raw.id),
    clientOrderId: String(raw.client_order_id),
    symbol: String(raw.symbol),
    side: String(raw.side),
    qty: num(raw.qty),
    filledQty: num(raw.filled_qty ?? 0),
    filledAvgPrice: numOrNull(raw.filled_avg_price),
    status: String(raw.status),
    orderClass: String(raw.order_class ?? ""),
    type: String(raw.type ?? raw.order_type ?? ""),
    stopPrice: numOrNull(raw.stop_price),
    limitPrice: numOrNull(raw.limit_price),
    createdAt: raw.created_at ? String(raw.created_at) : null,
    filledAt: raw.filled_at ? String(raw.filled_at) : null,
    canceledAt: raw.canceled_at ? String(raw.canceled_at) : null,
    updatedAt: raw.updated_at ? String(raw.updated_at) : null,
    groupId: raw.group_id ? String(raw.group_id) : null,
    legs,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface TradingClientOptions {
  fetchImpl?: typeof fetch;
  // Pause between retries of a read. Tests set this to 0.
  retryDelayMs?: number;
  // Told about the rate-limit headers of every response (the governor listens).
  onRate?: (info: RateInfo) => void;
}

export class AlpacaTrading {
  private readonly keyId: string;
  private readonly secretKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly retryDelayMs: number;
  private readonly onRate: ((info: RateInfo) => void) | undefined;

  constructor(settings: Settings, options: TradingClientOptions = {}) {
    assertPaperHost(PAPER_TRADING_BASE_URL);
    this.keyId = settings.alpaca.keyId;
    this.secretKey = settings.alpaca.secretKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? 500;
    this.onRate = options.onRate;
  }

  // One HTTP call. No retry here.
  private async once(method: string, path: string, query?: Record<string, string>, body?: Json): Promise<unknown> {
    if (!path.startsWith("/v2/")) throw new AlpacaError("Refusing a path outside /v2/", 0);
    const url = new URL(PAPER_TRADING_BASE_URL + path);
    assertPaperHost(url.toString());
    for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        "APCA-API-KEY-ID": this.keyId,
        "APCA-API-SECRET-KEY": this.secretKey,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
      redirect: "error", // never follow a redirect with the key headers attached
    });
    const text = await res.text();
    if (this.onRate) {
      const h = (name: string) => (res.headers.get(name) === null ? null : Number(res.headers.get(name)));
      try {
        this.onRate({ path, status: res.status, limit: h("x-ratelimit-limit"), remaining: h("x-ratelimit-remaining"), reset: h("x-ratelimit-reset") });
      } catch {
        /* a listener must never break a request */
      }
    }
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const message = parsed && typeof parsed === "object" && "message" in parsed ? String((parsed as Json).message) : text.slice(0, 200);
      const err = new AlpacaError(`Alpaca ${method} ${path} answered ${res.status}: ${message}`, res.status);
      err.items = Array.isArray(parsed) ? (parsed as Json[]) : undefined;
      throw err;
    }
    return parsed;
  }

  // Reads retry on network errors, 429 and 5xx. Writes never retry here.
  private async read(path: string, query?: Record<string, string>): Promise<unknown> {
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.once("GET", path, query);
      } catch (err) {
        last = err;
        const retryable = !(err instanceof AlpacaError) || err.status === 429 || err.status >= 500;
        if (!retryable || attempt === 2) break;
        await sleep(this.retryDelayMs * 2 ** attempt);
      }
    }
    throw last;
  }

  async getAccount(): Promise<Account> {
    const a = (await this.read("/v2/account")) as Json;
    return {
      status: String(a.status),
      equity: num(a.equity),
      lastEquity: num(a.last_equity),
      cash: num(a.cash),
      buyingPower: num(a.buying_power),
      multiplier: num(a.multiplier),
      tradingBlocked: a.trading_blocked === true,
      accountBlocked: a.account_blocked === true,
      shortingEnabled: a.shorting_enabled === true,
    };
  }

  async getClock(): Promise<Clock> {
    const c = (await this.read("/v2/clock")) as Json;
    return { isOpen: c.is_open === true, timestamp: String(c.timestamp), nextOpen: String(c.next_open), nextClose: String(c.next_close) };
  }

  private parseConfig(c: Json): AccountConfig {
    return { maxMarginMultiplier: num(c.max_margin_multiplier), noShorting: c.no_shorting === true, suspendTrade: c.suspend_trade === true };
  }

  async getAccountConfig(): Promise<AccountConfig> {
    return this.parseConfig((await this.read("/v2/account/configurations")) as Json);
  }

  // Changes the broker side switches. The borrowing cap must be 1, 2 or 4. Raising it is a decision for the
  // caller to gate: this method only checks that the value is allowed by Alpaca.
  async setAccountConfig(patch: Partial<AccountConfig>): Promise<AccountConfig> {
    const body: Json = {};
    if (patch.maxMarginMultiplier !== undefined) {
      if (![1, 2, 4].includes(patch.maxMarginMultiplier)) throw new AlpacaError("Borrowing cap must be 1, 2 or 4", 0);
      body.max_margin_multiplier = String(patch.maxMarginMultiplier);
    }
    // Long only is not negotiable: this client can turn shorting off but never back on.
    if (patch.noShorting === false) throw new AlpacaError("Refusing to allow shorting: stack C is long only", 0);
    if (patch.noShorting === true) body.no_shorting = true;
    if (patch.suspendTrade !== undefined) body.suspend_trade = patch.suspendTrade;
    return this.parseConfig((await this.once("PATCH", "/v2/account/configurations", undefined, body)) as Json);
  }

  // Today's equity, one point a minute over the regular session (measured on paper 2026-11-02 after the close: 391
  // points from 9:30 to 16:00 New York, no empty values). Used after a restart to see whether the daily loss line was
  // crossed earlier in the day (review round 5). Points with no usable value are dropped.
  async getEquityHistoryToday(): Promise<EquityPoint[]> {
    const h = (await this.read("/v2/account/portfolio/history", { period: "1D", timeframe: "1Min", intraday_reporting: "market_hours" })) as Json;
    const ts = Array.isArray(h.timestamp) ? (h.timestamp as unknown[]) : [];
    const eq = Array.isArray(h.equity) ? (h.equity as unknown[]) : [];
    const out: EquityPoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const t = num(ts[i]);
      const e = eq[i] === null || eq[i] === undefined ? NaN : num(eq[i]);
      if (Number.isFinite(t) && Number.isFinite(e) && e > 0) out.push({ atMs: t * 1000, equity: e });
    }
    return out;
  }

  // The market's sessions between two dates, inclusive. A weekend or holiday is simply absent.
  async getCalendar(start: string, end: string): Promise<CalendarDay[]> {
    const rows = (await this.read("/v2/calendar", { start, end })) as Json[];
    return rows.map((r) => ({ date: String(r.date), open: String(r.open), close: String(r.close) }));
  }

  async listPositions(): Promise<Position[]> {
    const rows = (await this.read("/v2/positions")) as Json[];
    return rows.map((p) => ({
      symbol: String(p.symbol),
      qty: num(p.qty),
      qtyAvailable: numOrNull(p.qty_available),
      marketValue: num(p.market_value),
      avgEntryPrice: num(p.avg_entry_price),
      unrealizedPl: num(p.unrealized_pl),
    }));
  }

  async listOrders(status: "open" | "closed" | "all", afterIso?: string): Promise<Order[]> {
    const query: Record<string, string> = { status, limit: "500", nested: "true", direction: "asc" };
    if (afterIso) query.after = afterIso;
    return ((await this.read("/v2/orders", query)) as Json[]).map(parseOrder);
  }

  // Every order since `afterIso`, page by page (Alpaca returns at most 500 at a time, oldest first). A day with
  // thousands of orders needs this: one call would show only the oldest 500 and hide the newest. Stops at
  // `maxPages` and says so, rather than looping for ever.
  async listOrdersPaged(status: "open" | "closed" | "all", afterIso: string, maxPages = 20): Promise<{ orders: Order[]; complete: boolean; pages: number }> {
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
      if (!last || last === cursor) break; // cannot advance: do not claim completeness
      cursor = last;
    }
    return { orders: [...seen.values()], complete, pages };
  }

  async findOrderByClientId(clientOrderId: string): Promise<Order | null> {
    try {
      const raw = (await this.read("/v2/orders:by_client_order_id", { client_order_id: clientOrderId })) as Json;
      return parseOrder(raw);
    } catch (err) {
      if (err instanceof AlpacaError && err.status === 404) return null;
      throw err;
    }
  }

  private cents(x: number): string {
    return (Math.floor(x * 100 + 1e-9) / 100).toFixed(2);
  }

  // Sends an order body that carries a client_order_id, safely: after any unclear failure (network error, timeout,
  // 5xx, and 429 when `retry429` is set) it asks Alpaca whether that id exists before it sends again, so a retry
  // can never make a second order. A 429 means the request was refused, so for safety sells it is retried
  // with the SAME id after a pause.
  private async postOrder(body: Json, clientOrderId: string, retry429: boolean): Promise<Order> {
    let sent429 = 0;
    for (;;) {
      try {
        return parseOrder((await this.once("POST", "/v2/orders", undefined, body)) as Json);
      } catch (err) {
        const is429 = err instanceof AlpacaError && err.status === 429;
        if (is429 && retry429 && sent429 < 8) {
          sent429++;
          await sleep(Math.min(2000, 250 * 2 ** (sent429 - 1)));
          continue;
        }
        const unclear = !(err instanceof AlpacaError) || is429 || err.status >= 500;
        const duplicate = err instanceof AlpacaError && err.status === 422 && /client_order_id/i.test(err.message);
        if (!unclear && !duplicate) throw err;
        // From here the first send may have landed, so whatever goes wrong next is still "unclear" to the caller
        // (status 502), never a definite refusal: the caller keeps such an order counted and reconciles it by its id.
        const stillUnclear = (e: unknown): never => {
          throw new AlpacaError(`outcome of the first send is still unclear: ${(e as Error).message.slice(0, 160)}`, 502);
        };
        let existing: Order | null;
        try {
          existing = await this.findOrderByClientId(clientOrderId);
        } catch (e) {
          return stillUnclear(e);
        }
        if (existing) return existing;
        if (duplicate) throw err;
        // Not there: the first send did not land. Sending again with the same id cannot create two orders.
        try {
          return parseOrder((await this.once("POST", "/v2/orders", undefined, body)) as Json);
        } catch (e) {
          const dup2 = e instanceof AlpacaError && e.status === 422 && /client_order_id/i.test(e.message);
          if (dup2) throw e;
          return stillUnclear(e);
        }
      }
    }
  }

  // The only way this client opens a position: a long, whole-share market buy (or, with `limitPrice`, a limit buy at or below the
  // reference price) that carries its exits held at Alpaca. With `takeProfitPrice` it is a bracket (a take-profit limit and a
  // protective stop, only one of which can fill); without it, an OTO order (the protective stop only).
  async submitEntry(entry: EntryOrder): Promise<Order> {
    if (!/^[A-Z.]{1,6}$/.test(entry.symbol)) throw new AlpacaError("Bad symbol", 0);
    if (!Number.isInteger(entry.qty) || entry.qty < 1) throw new AlpacaError("Quantity must be a whole number of shares, at least 1", 0);
    if (!(entry.stopPrice > 0) || !(entry.stopPrice < entry.referencePrice)) {
      throw new AlpacaError("Protective stop must be positive and below the reference price", 0);
    }
    if (entry.takeProfitPrice !== undefined && !(entry.takeProfitPrice > entry.referencePrice)) {
      throw new AlpacaError("Take-profit must be above the reference price", 0);
    }
    if (entry.limitPrice !== undefined) {
      if (!(entry.limitPrice > 0) || !Number.isFinite(entry.limitPrice) || entry.limitPrice > entry.referencePrice) throw new AlpacaError("Limit price must be positive and at or below the reference price", 0);
      if (!(entry.stopPrice < entry.limitPrice) || (entry.takeProfitPrice !== undefined && !(entry.takeProfitPrice > entry.limitPrice))) throw new AlpacaError("The exits must be on either side of the limit price", 0);
    }
    if (!/^[\w.-]{8,128}$/.test(entry.clientOrderId)) throw new AlpacaError("Bad client order id", 0);
    const body: Json = {
      symbol: entry.symbol,
      qty: String(entry.qty),
      side: "buy",
      type: entry.limitPrice !== undefined ? "limit" : "market",
      ...(entry.limitPrice !== undefined ? { limit_price: this.cents(entry.limitPrice) } : {}),
      time_in_force: "day",
      order_class: entry.takeProfitPrice !== undefined ? "bracket" : "oto",
      stop_loss: { stop_price: this.cents(entry.stopPrice) },
      client_order_id: entry.clientOrderId,
    };
    if (entry.takeProfitPrice !== undefined) body.take_profit = { limit_price: (Math.ceil(entry.takeProfitPrice * 100 - 1e-9) / 100).toFixed(2) };
    return this.postOrder(body, entry.clientOrderId, false);
  }

  // A plain market sell with an explicit quantity. Only the sell gate (sells.ts) may call this: it checks that the
  // quantity is not more than the shares held, counting sells already open. Safety sells wait out a 429 and retry
  // with the same id.
  async submitSell(sell: SellOrder): Promise<Order> {
    if (!/^[A-Z.]{1,6}$/.test(sell.symbol)) throw new AlpacaError("Bad symbol", 0);
    if (!(sell.qty > 0) || !Number.isFinite(sell.qty)) throw new AlpacaError("Sell quantity must be positive", 0);
    if (!/^[\w.-]{8,128}$/.test(sell.clientOrderId)) throw new AlpacaError("Bad client order id", 0);
    const body: Json = {
      symbol: sell.symbol,
      qty: Number.isInteger(sell.qty) ? String(sell.qty) : String(Number(sell.qty.toFixed(9))),
      side: "sell",
      type: "market",
      time_in_force: "day",
      client_order_id: sell.clientOrderId,
    };
    return this.postOrder(body, sell.clientOrderId, true);
  }

  // Cancels one order. Safe to repeat, so it waits out a 429 and tries again. An order that is already gone (404 or
  // 422 "already done") counts as cancelled.
  async cancelOrder(orderId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/.test(orderId)) throw new AlpacaError("Bad order id", 0);
    for (let attempt = 0; ; attempt++) {
      try {
        await this.once("DELETE", `/v2/orders/${orderId}`);
        return;
      } catch (err) {
        if (err instanceof AlpacaError && (err.status === 404 || err.status === 422)) return;
        const retryable = !(err instanceof AlpacaError) || err.status === 429 || err.status >= 500;
        if (!retryable || attempt >= 5) throw err;
        await sleep(Math.min(2000, 250 * 2 ** attempt));
      }
    }
  }

  // Cancels every open order in one request. Alpaca answers 207 with one result per order, so a 2xx does not
  // mean each one worked: the per-item answers come back, and the caller checks the orders afterwards.
  async cancelAllOrders(): Promise<{ attempted: number; failed: string[] }> {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.once("DELETE", "/v2/orders");
        const items = Array.isArray(result) ? (result as Json[]) : [];
        const failed = items.filter((r) => num(r.status) >= 400).map((r) => `${String(r.id ?? "?")}: ${(r.body as Json | undefined)?.message ?? r.status}`);
        return { attempted: items.length, failed };
      } catch (err) {
        const retryable = !(err instanceof AlpacaError) || err.status === 429 || err.status >= 500;
        if (!retryable || attempt >= 5) throw err;
        await sleep(Math.min(2000, 250 * 2 ** attempt));
      }
    }
  }
}
