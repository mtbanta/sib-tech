// Alpaca trading client, PAPER ONLY. Every request goes to the one fixed paper host. The address is built
// from a constant and checked again before each call, so no input can send a request to a live endpoint.
//
// Orders are safe to retry: each entry carries a client_order_id, and after any unclear failure the client
// asks Alpaca whether that id already exists before it sends again.
import { assertPaperHost, PAPER_TRADING_BASE_URL, type Settings } from "./config.ts";

export class AlpacaError extends Error {
  readonly status: number;
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
  legs: Order[];
}

export interface EntryOrder {
  symbol: string;
  qty: number;
  stopPrice: number;
  referencePrice: number;
  clientOrderId: string;
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
    legs,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface TradingClientOptions {
  fetchImpl?: typeof fetch;
  // Pause between retries of a read. Tests set this to 0.
  retryDelayMs?: number;
}

export class AlpacaTrading {
  private readonly keyId: string;
  private readonly secretKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly retryDelayMs: number;

  constructor(settings: Settings, options: TradingClientOptions = {}) {
    assertPaperHost(PAPER_TRADING_BASE_URL);
    this.keyId = settings.alpaca.keyId;
    this.secretKey = settings.alpaca.secretKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.retryDelayMs = options.retryDelayMs ?? 500;
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
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const message = parsed && typeof parsed === "object" && "message" in parsed ? String((parsed as Json).message) : text.slice(0, 200);
      throw new AlpacaError(`Alpaca ${method} ${path} answered ${res.status}: ${message}`, res.status);
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

  async findOrderByClientId(clientOrderId: string): Promise<Order | null> {
    try {
      const raw = (await this.read("/v2/orders:by_client_order_id", { client_order_id: clientOrderId })) as Json;
      return parseOrder(raw);
    } catch (err) {
      if (err instanceof AlpacaError && err.status === 404) return null;
      throw err;
    }
  }

  // The only way this client opens a position: a long, whole-share market buy that carries a protective stop
  // order held at Alpaca (an "OTO" order: the stop is created with the entry and lives at the broker).
  async submitEntry(entry: EntryOrder): Promise<Order> {
    if (!/^[A-Z.]{1,6}$/.test(entry.symbol)) throw new AlpacaError("Bad symbol", 0);
    if (!Number.isInteger(entry.qty) || entry.qty < 1) throw new AlpacaError("Quantity must be a whole number of shares, at least 1", 0);
    if (!(entry.stopPrice > 0) || !(entry.stopPrice < entry.referencePrice)) {
      throw new AlpacaError("Protective stop must be positive and below the reference price", 0);
    }
    if (!/^[\w.-]{8,128}$/.test(entry.clientOrderId)) throw new AlpacaError("Bad client order id", 0);
    const body: Json = {
      symbol: entry.symbol,
      qty: String(entry.qty),
      side: "buy",
      type: "market",
      time_in_force: "day",
      order_class: "oto",
      stop_loss: { stop_price: (Math.floor(entry.stopPrice * 100) / 100).toFixed(2) },
      client_order_id: entry.clientOrderId,
    };
    try {
      return parseOrder((await this.once("POST", "/v2/orders", undefined, body)) as Json);
    } catch (err) {
      // An unclear outcome (network error, timeout, 429, 5xx) or a duplicate id: ask Alpaca before sending again.
      const unclear = !(err instanceof AlpacaError) || err.status === 429 || err.status >= 500;
      const duplicate = err instanceof AlpacaError && err.status === 422 && /client_order_id/i.test(err.message);
      if (!unclear && !duplicate) throw err;
      const existing = await this.findOrderByClientId(entry.clientOrderId);
      if (existing) return existing;
      if (duplicate) throw err;
      // Not there: the first send did not land. Sending again with the same id cannot create two orders.
      return parseOrder((await this.once("POST", "/v2/orders", undefined, body)) as Json);
    }
  }

  // Alpaca answers these two bulk calls with 207 and one result per item, so a 2xx does not mean every item worked.
  private assertAllItemsOk(result: unknown, what: string): void {
    if (!Array.isArray(result)) return;
    const failed = (result as Json[]).filter((r) => num(r.status) >= 400).map((r) => String(r.symbol ?? r.id ?? "?"));
    if (failed.length > 0) throw new AlpacaError(`${what} failed for: ${failed.join(", ")}`, 207);
  }

  // Cancels one order (used by the stop command, for entries that have not filled yet).
  async cancelOrder(orderId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/.test(orderId)) throw new AlpacaError("Bad order id", 0);
    await this.once("DELETE", `/v2/orders/${orderId}`);
  }

  // Sells one position at market (used when a position turns out to have no protective stop).
  async closePosition(symbol: string): Promise<void> {
    if (!/^[A-Z.]{1,6}$/.test(symbol)) throw new AlpacaError("Bad symbol", 0);
    await this.once("DELETE", `/v2/positions/${encodeURIComponent(symbol)}`);
  }

  async cancelAllOrders(): Promise<void> {
    this.assertAllItemsOk(await this.once("DELETE", "/v2/orders"), "Cancelling orders");
  }

  // Sells every position at market and cancels the open orders first. Used by the stop command and the close-out.
  async closeAllPositions(): Promise<void> {
    this.assertAllItemsOk(await this.once("DELETE", "/v2/positions", { cancel_orders: "true" }), "Closing positions");
  }
}
