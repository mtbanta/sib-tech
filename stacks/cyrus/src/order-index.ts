// Michael's approval C of 2026-11-12 (the CPU fixes): the day's orders as an index, so the order gate, the account view and the order
// sync do not copy and sort the whole day's list on every decision or pass. On 2026-11-12 CPU per decision rose from about 5.5 ms to
// about 17 ms as the day reached 9,000 stored orders; most of it was the gate's full read, sort and 6 passes over every row.
// The caching store keeps one index per day up to date on every insert and update (caching-store.ts); any other store (the tests'
// memory store) builds one from its list, so every caller reads through the same shape.
import type { OrderRecord, Store } from "./store.ts";

// An entry still working: not closed, and sent or about to be (the same rule the gate, the account view and the sync used).
export const isActiveOrder = (o: OrderRecord): boolean => !o.closedAt && (o.status === "intent" || o.status === "submitted" || o.status === "filled");

export interface DayOrderIndex {
  readonly size: number;
  hasSymbol(symbol: string): boolean;
  // The day's orders for one symbol, in no particular order.
  forSymbol(symbol: string): OrderRecord[];
  // The orders still working, in no particular order.
  active(): OrderRecord[];
  // Every order of the day, in no particular order (read once, after a start, to prime the governor).
  all(): OrderRecord[];
}

// One day's orders kept by client id, by symbol and by "still working". Rows are frozen by the caller and replaced, never changed in
// place, so a row handed out keeps what it was when read.
export class DayOrders implements DayOrderIndex {
  private readonly byId = new Map<string, OrderRecord>();
  private readonly bySymbol = new Map<string, Map<string, OrderRecord>>();
  private readonly working = new Map<string, OrderRecord>();

  constructor(rows: Iterable<OrderRecord> = []) {
    for (const o of rows) this.set(o.clientOrderId, o);
  }
  get size(): number {
    return this.byId.size;
  }
  get(clientOrderId: string): OrderRecord | undefined {
    return this.byId.get(clientOrderId);
  }
  has(clientOrderId: string): boolean {
    return this.byId.has(clientOrderId);
  }
  values(): IterableIterator<OrderRecord> {
    return this.byId.values();
  }
  set(clientOrderId: string, o: OrderRecord): this {
    const old = this.byId.get(clientOrderId);
    if (old && old.symbol !== o.symbol) this.bySymbol.get(old.symbol)?.delete(clientOrderId);
    this.byId.set(clientOrderId, o);
    let m = this.bySymbol.get(o.symbol);
    if (!m) this.bySymbol.set(o.symbol, (m = new Map()));
    m.set(clientOrderId, o);
    if (isActiveOrder(o)) this.working.set(clientOrderId, o);
    else this.working.delete(clientOrderId);
    return this;
  }
  hasSymbol(symbol: string): boolean {
    return (this.bySymbol.get(symbol)?.size ?? 0) > 0;
  }
  forSymbol(symbol: string): OrderRecord[] {
    const m = this.bySymbol.get(symbol);
    return m ? [...m.values()] : [];
  }
  active(): OrderRecord[] {
    return [...this.working.values()];
  }
  all(): OrderRecord[] {
    return [...this.byId.values()];
  }
}

// The day's index from any store: the caching store's own (kept up to date), or one built from the store's list.
export async function dayOrderIndex(store: Store, tradeDate: string): Promise<DayOrderIndex> {
  const own = (store as Store & { orderIndex?: (d: string) => Promise<DayOrderIndex> }).orderIndex;
  if (typeof own === "function") return own.call(store, tradeDate);
  return new DayOrders(await store.listOrders(tradeDate));
}

// The orders still working, oldest first (created time, then client id), for the order sync, whose walk keeps that order.
export async function activeOrdersOldestFirst(store: Store, tradeDate: string): Promise<OrderRecord[]> {
  return (await dayOrderIndex(store, tradeDate)).active().sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.clientOrderId.localeCompare(b.clientOrderId));
}
