// A store that remembers what it has read, so the order gate does not wait on the database for every decision.
// It wraps the real store and passes every WRITE straight through first (and only then updates its memory, so a
// failed write changes nothing). It serves repeat READS of the stop flag, the not-flat flag, a day's record and a
// day's orders from memory for a very short time. Everything that writes those things in this program goes through
// it, so its memory is the same as the database's; a change made by hand in the database shows up within a couple
// of seconds. A database that is down fails closed anyway: the gate writes each entry down before sending it.
import type { DayRecord, OrderRecord, RefusalRecord, Store } from "./store.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP } from "./store.ts";

const FAST_KEYS = new Set([CONTROL_STOP, CONTROL_NOT_FLAT]);

export class CachingStore implements Store {
  private readonly inner: Store;
  private readonly now: () => number;
  private readonly controlTtlMs: number;
  private readonly dayTtlMs: number;
  private controls = new Map<string, { value: unknown; at: number }>();
  private days = new Map<string, { value: DayRecord | null; at: number }>();
  private orders = new Map<string, Map<string, OrderRecord>>();

  constructor(inner: Store, now: () => number = Date.now, opts: { controlTtlMs?: number; dayTtlMs?: number } = {}) {
    this.inner = inner;
    this.now = now;
    this.controlTtlMs = opts.controlTtlMs ?? 1_500;
    this.dayTtlMs = opts.dayTtlMs ?? 2_000;
  }

  async getControl<T = unknown>(key: string): Promise<T | null> {
    if (FAST_KEYS.has(key)) {
      const hit = this.controls.get(key);
      if (hit && this.now() - hit.at < this.controlTtlMs) return structuredClone(hit.value) as T | null;
    }
    const value = await this.inner.getControl<T>(key);
    if (FAST_KEYS.has(key)) this.controls.set(key, { value: structuredClone(value), at: this.now() });
    return value;
  }
  async setControl(key: string, value: unknown): Promise<void> {
    await this.inner.setControl(key, value);
    if (FAST_KEYS.has(key)) this.controls.set(key, { value: structuredClone(value), at: this.now() });
  }

  async getDay(tradeDate: string): Promise<DayRecord | null> {
    const hit = this.days.get(tradeDate);
    if (hit && this.now() - hit.at < this.dayTtlMs) return structuredClone(hit.value);
    const value = await this.inner.getDay(tradeDate);
    this.days.set(tradeDate, { value: structuredClone(value), at: this.now() });
    return value;
  }
  async createDay(day: DayRecord): Promise<DayRecord> {
    const v = await this.inner.createDay(day);
    this.days.set(day.tradeDate, { value: structuredClone(v), at: this.now() });
    return v;
  }
  async updateDay(tradeDate: string, patch: Partial<Omit<DayRecord, "tradeDate">>): Promise<DayRecord> {
    const v = await this.inner.updateDay(tradeDate, patch);
    this.days.set(tradeDate, { value: structuredClone(v), at: this.now() });
    return v;
  }

  private async ordersFor(tradeDate: string): Promise<Map<string, OrderRecord>> {
    let m = this.orders.get(tradeDate);
    if (!m) {
      m = new Map((await this.inner.listOrders(tradeDate)).map((o) => [o.clientOrderId, o]));
      this.orders.set(tradeDate, m);
    }
    return m;
  }
  async insertOrder(order: OrderRecord): Promise<boolean> {
    const m = await this.ordersFor(order.tradeDate);
    const inserted = await this.inner.insertOrder(order);
    if (inserted) m.set(order.clientOrderId, { createdAt: new Date(this.now()).toISOString(), ...structuredClone(order) });
    else if (!m.has(order.clientOrderId)) this.orders.delete(order.tradeDate); // it exists in the database: reload next time
    return inserted;
  }
  async updateOrder(clientOrderId: string, patch: Partial<Omit<OrderRecord, "clientOrderId" | "tradeDate">>): Promise<void> {
    await this.inner.updateOrder(clientOrderId, patch);
    for (const m of this.orders.values()) {
      const o = m.get(clientOrderId);
      if (o) m.set(clientOrderId, { ...o, ...structuredClone(patch) });
    }
  }
  async getOrder(clientOrderId: string): Promise<OrderRecord | null> {
    for (const m of this.orders.values()) {
      const o = m.get(clientOrderId);
      if (o) return structuredClone(o);
    }
    return this.inner.getOrder(clientOrderId);
  }
  async listOrders(tradeDate: string): Promise<OrderRecord[]> {
    return [...(await this.ordersFor(tradeDate)).values()].map((o) => structuredClone(o)).sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.clientOrderId.localeCompare(b.clientOrderId));
  }

  recentDays(beforeDate: string, n: number): Promise<DayRecord[]> {
    return this.inner.recentDays(beforeDate, n);
  }
  daysFrom(date: string): Promise<DayRecord[]> {
    return this.inner.daysFrom(date);
  }
  addRefusal(r: RefusalRecord): Promise<void> {
    return this.inner.addRefusal(r);
  }
  listRefusals(tradeDate: string): Promise<RefusalRecord[]> {
    return this.inner.listRefusals(tradeDate);
  }
  addEvent(level: string, event: string, data?: Record<string, unknown>): Promise<void> {
    return this.inner.addEvent(level, event, data);
  }
}
