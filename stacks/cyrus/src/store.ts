// The worker's memory: the stop flag, the Discord command cursor, each day's limits and approvals, every
// entry it decided to send, every refusal, and the run log. Anything that must survive a restart lives here.
//
// There are two implementations: PgStore (src/pg-store.ts, the real database) and MemoryStore (below, for
// tests). The worker never falls back to memory if the database is down: it fails closed and does not trade.
import type { Limits, LimitName } from "./limits.ts";

export type DayStatus = "pending" | "approved" | "lapsed" | "not_trading_day";

export interface DayRecord {
  tradeDate: string; // YYYY-MM-DD, New York date
  isTradingDay: boolean;
  openAt: Date | null;
  closeAt: Date | null;
  status: DayStatus;
  dayStartEquity: number | null;
  suggested: Limits;
  limits: Limits; // suggested values, replaced one by one as Michael overrules
  decided: Partial<Record<LimitName, boolean>>; // which limits Michael has approved or overruled
  liveList: string[] | null;
  phases: Record<string, string>; // phase name to ISO time it finished
}

export type OrderStatus = "intent" | "submitted" | "filled" | "canceled" | "rejected" | "failed";

export interface OrderRecord {
  clientOrderId: string;
  tradeDate: string;
  symbol: string;
  qty: number;
  referencePrice: number;
  stopPrice: number;
  status: OrderStatus;
  alpacaOrderId: string | null;
  filledQty: number | null;
  filledAvgPrice: number | null;
  note: string | null;
}

export interface RefusalRecord {
  tradeDate: string;
  symbol: string;
  reason: string;
  detail?: Record<string, unknown>;
}

export interface Store {
  getControl<T = unknown>(key: string): Promise<T | null>;
  setControl(key: string, value: unknown): Promise<void>;

  getDay(tradeDate: string): Promise<DayRecord | null>;
  // Inserts the day if it does not exist yet; returns the stored row either way.
  createDay(day: DayRecord): Promise<DayRecord>;
  updateDay(tradeDate: string, patch: Partial<Omit<DayRecord, "tradeDate">>): Promise<DayRecord>;

  // Writes a new order row. Returns false if that client_order_id already exists (nothing is overwritten).
  insertOrder(order: OrderRecord): Promise<boolean>;
  updateOrder(clientOrderId: string, patch: Partial<Omit<OrderRecord, "clientOrderId" | "tradeDate">>): Promise<void>;
  getOrder(clientOrderId: string): Promise<OrderRecord | null>;
  listOrders(tradeDate: string): Promise<OrderRecord[]>;

  addRefusal(r: RefusalRecord): Promise<void>;
  listRefusals(tradeDate: string): Promise<RefusalRecord[]>;

  addEvent(level: string, event: string, data?: Record<string, unknown>): Promise<void>;
}

export const CONTROL_STOP = "stop_flag";
export const CONTROL_COMMAND_CURSOR = "discord_command_cursor";

export interface StopFlag {
  on: boolean;
  at: string;
  reason: string;
}

// In-memory store for tests. Behaves like the real one, including "do not overwrite an existing order".
export class MemoryStore implements Store {
  control = new Map<string, unknown>();
  days = new Map<string, DayRecord>();
  orders = new Map<string, OrderRecord>();
  refusals: RefusalRecord[] = [];
  events: Array<{ level: string; event: string; data?: Record<string, unknown> }> = [];
  // Tests set this to make every call fail, to prove the worker fails closed.
  failing = false;

  private check() {
    if (this.failing) throw new Error("store is down (test)");
  }
  async getControl<T = unknown>(key: string): Promise<T | null> {
    this.check();
    return this.control.has(key) ? (structuredClone(this.control.get(key)) as T) : null;
  }
  async setControl(key: string, value: unknown): Promise<void> {
    this.check();
    this.control.set(key, structuredClone(value));
  }
  async getDay(tradeDate: string): Promise<DayRecord | null> {
    this.check();
    const d = this.days.get(tradeDate);
    return d ? structuredClone(d) : null;
  }
  async createDay(day: DayRecord): Promise<DayRecord> {
    this.check();
    if (!this.days.has(day.tradeDate)) this.days.set(day.tradeDate, structuredClone(day));
    return structuredClone(this.days.get(day.tradeDate)!);
  }
  async updateDay(tradeDate: string, patch: Partial<Omit<DayRecord, "tradeDate">>): Promise<DayRecord> {
    this.check();
    const d = this.days.get(tradeDate);
    if (!d) throw new Error(`no such day ${tradeDate}`);
    const next = { ...d, ...structuredClone(patch) };
    this.days.set(tradeDate, next);
    return structuredClone(next);
  }
  async insertOrder(order: OrderRecord): Promise<boolean> {
    this.check();
    if (this.orders.has(order.clientOrderId)) return false;
    this.orders.set(order.clientOrderId, structuredClone(order));
    return true;
  }
  async updateOrder(clientOrderId: string, patch: Partial<Omit<OrderRecord, "clientOrderId" | "tradeDate">>): Promise<void> {
    this.check();
    const o = this.orders.get(clientOrderId);
    if (!o) throw new Error(`no such order ${clientOrderId}`);
    this.orders.set(clientOrderId, { ...o, ...patch });
  }
  async getOrder(clientOrderId: string): Promise<OrderRecord | null> {
    this.check();
    const o = this.orders.get(clientOrderId);
    return o ? structuredClone(o) : null;
  }
  async listOrders(tradeDate: string): Promise<OrderRecord[]> {
    this.check();
    return [...this.orders.values()].filter((o) => o.tradeDate === tradeDate).map((o) => structuredClone(o));
  }
  async addRefusal(r: RefusalRecord): Promise<void> {
    this.check();
    this.refusals.push(structuredClone(r));
  }
  async listRefusals(tradeDate: string): Promise<RefusalRecord[]> {
    this.check();
    return this.refusals.filter((r) => r.tradeDate === tradeDate).map((r) => structuredClone(r));
  }
  async addEvent(level: string, event: string, data?: Record<string, unknown>): Promise<void> {
    this.check();
    this.events.push({ level, event, data: data ? structuredClone(data) : undefined });
  }
}
