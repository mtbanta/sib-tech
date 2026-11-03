// The worker's memory: the stop flag, the Discord command cursor, each day's limits and approvals, every
// entry it decided to send, every refusal, and the run log. Anything that must survive a restart lives here.
//
// There are two implementations: PgStore (src/pg-store.ts, the real database) and MemoryStore (below, for
// tests). The worker never falls back to memory if the database is down: it fails closed and does not trade.
import { normalizeLimits, type Limits, type LimitName } from "./limits.ts";

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
  // Which limits were carried forward from an earlier approved day instead of the built-in suggestion
  // (limit name to the date it was last approved). Shown in the evening post.
  carried?: Partial<Record<LimitName, string>>;
}

// A day record read from storage may be older than this code. Records from before build C2 have a daily trade
// count and no trades-a-minute limit: that limit is filled in with the suggestion and marked undecided, and an
// "approved" record that this leaves incomplete goes back to "pending", so an old approval can never stand for a
// limit it did not cover.
export function normalizeDay(day: DayRecord): DayRecord {
  const { limits, tradesPerMinuteMissing } = normalizeLimits(day.limits);
  const { limits: suggested } = normalizeLimits(day.suggested);
  if (!tradesPerMinuteMissing) return { ...day, limits, suggested };
  const decided = { ...day.decided, trades: false };
  return { ...day, limits, suggested, decided, status: day.status === "approved" ? "pending" : day.status };
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
  takeProfitPrice?: number | null;
  // When the row was written (ISO), and how long Alpaca took to accept the order, from the moment the gate began
  // to decide until Alpaca's answer came back (milliseconds). Both optional so older rows still read.
  createdAt?: string;
  acceptMs?: number | null;
  // Set when the position this entry opened has been closed (or is no longer held).
  closedAt?: string | null;
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

  // Days before a date, newest first (to find the most recently approved limits), and days from a date on.
  recentDays(beforeDate: string, n: number): Promise<DayRecord[]>;
  daysFrom(date: string): Promise<DayRecord[]>;

  addRefusal(r: RefusalRecord): Promise<void>;
  listRefusals(tradeDate: string): Promise<RefusalRecord[]>;

  addEvent(level: string, event: string, data?: Record<string, unknown>): Promise<void>;

  // Only the caching store has these (an unsaved stop lives in its memory). See caching-store.ts.
  hasUnsavedStop?(): boolean;
  retryUnsavedStop?(): Promise<boolean>;
}

// Records that a step of the day finished. Reads the day fresh first, and runs one at a time per day, so two steps
// finishing at nearly the same time (one runs in the background) cannot overwrite each other's record: without the
// queue, both could read the same phases and the second write would drop the first one's entry.
const phaseQueues = new Map<string, Promise<unknown>>();
export function setPhase(store: Store, tradeDate: string, name: string, iso: string, extra: Record<string, string> = {}): Promise<DayRecord> {
  const previous = phaseQueues.get(tradeDate) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(async () => {
    const fresh = await store.getDay(tradeDate);
    if (!fresh) throw new Error(`no such day ${tradeDate}`);
    return store.updateDay(tradeDate, { phases: { ...fresh.phases, [name]: iso, ...extra } });
  });
  phaseQueues.set(tradeDate, run.catch(() => undefined));
  return run;
}

export const CONTROL_STOP = "stop_flag";
export const CONTROL_COMMAND_CURSOR = "discord_command_cursor";
// Set when a close-out ended with positions still held. It survives a restart, and it is cleared only when the
// account is seen flat. While it is on, the gate refuses every entry.
export const CONTROL_NOT_FLAT = "not_flat";
// The last release that started and when recent starts happened, so a start message can say why.
export const CONTROL_START_HISTORY = "start_history";

export interface NotFlatState {
  on: boolean;
  since: string;
  remaining: string[];
}

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
    this.orders.set(order.clientOrderId, { createdAt: new Date(this.orders.size * 1000 + 1_700_000_000_000).toISOString(), ...structuredClone(order) });
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
  async recentDays(beforeDate: string, n: number): Promise<DayRecord[]> {
    this.check();
    return [...this.days.values()].filter((d) => d.tradeDate < beforeDate).sort((a, b) => b.tradeDate.localeCompare(a.tradeDate)).slice(0, n).map((d) => normalizeDay(structuredClone(d)));
  }
  async daysFrom(date: string): Promise<DayRecord[]> {
    this.check();
    return [...this.days.values()].filter((d) => d.tradeDate >= date).sort((a, b) => a.tradeDate.localeCompare(b.tradeDate)).map((d) => normalizeDay(structuredClone(d)));
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
