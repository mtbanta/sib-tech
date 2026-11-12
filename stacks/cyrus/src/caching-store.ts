// A store that remembers what it has read, so the order gate does not wait on the database for every decision.
// It wraps the real store and passes every WRITE straight through first (and only then updates its memory, so a
// failed write changes nothing). It serves repeat READS of the stop flag, the not-flat flag, a day's record and a
// day's orders from memory for a very short time. Everything that writes those things in this program goes through
// it, so its memory is the same as the database's; a change made by hand in the database shows up within a couple
// of seconds for the two flags and for days (a day's ORDERS are loaded once and then kept in step by this program's own
// writes). A read that was already waiting on the database when a write happened never replaces what the write stored:
// each key has a write counter, and a read may fill the memory only if the counter did not move while it waited. A
// database that is down fails closed anyway: the gate writes each entry down before sending it.
import type { DayRecord, OrderRecord, RefusalRecord, Store } from "./store.ts";
import { CONTROL_NOT_FLAT, CONTROL_STOP } from "./store.ts";
import { isMiddayKey } from "./midday.ts";
import { DayOrders, type DayOrderIndex } from "./order-index.ts";

const FAST_KEYS = new Set([CONTROL_STOP, CONTROL_NOT_FLAT]);
// The mid-day pause (one key per day) is read by the order gate before every entry, like the two flags.
const isFastKey = (key: string) => FAST_KEYS.has(key) || isMiddayKey(key);

// A kept order row: frozen, so it is read-only for every caller (see listOrders).
const frozen = (o: OrderRecord): OrderRecord => Object.freeze(o);

export class CachingStore implements Store {
  private readonly inner: Store;
  private readonly now: () => number;
  private readonly controlTtlMs: number;
  private readonly dayTtlMs: number;
  private controls = new Map<string, { value: unknown; at: number }>();
  // A stop that could not be saved to the database stays believed here, with no expiry, until a later write to that key succeeds
  // (Michael's own `resume` is such a write). An unsaved stop must not fade after a moment and let entries through.
  private unsavedStop: unknown = null;
  private days = new Map<string, { value: DayRecord | null; at: number }>();
  // Each day's orders, indexed by client id, symbol and "still working" (Michael's approval C of 2026-11-12).
  private orders = new Map<string, DayOrders>();
  private gen = new Map<string, number>();
  private g(key: string): number {
    return this.gen.get(key) ?? 0;
  }
  private bump(key: string): void {
    this.gen.set(key, this.g(key) + 1);
  }

  constructor(inner: Store, now: () => number = Date.now, opts: { controlTtlMs?: number; dayTtlMs?: number } = {}) {
    this.inner = inner;
    this.now = now;
    this.controlTtlMs = opts.controlTtlMs ?? 1_500;
    this.dayTtlMs = opts.dayTtlMs ?? 2_000;
  }

  async getControl<T = unknown>(key: string): Promise<T | null> {
    if (key === CONTROL_STOP && this.unsavedStop) return structuredClone(this.unsavedStop) as T | null;
    if (isFastKey(key)) {
      const hit = this.controls.get(key);
      if (hit && this.now() - hit.at < this.controlTtlMs) return structuredClone(hit.value) as T | null;
    }
    const k = `c:${key}`;
    const g0 = this.g(k);
    const value = await this.inner.getControl<T>(key);
    if (isFastKey(key)) {
      if (this.g(k) === g0) this.controls.set(key, { value: structuredClone(value), at: this.now() });
      else {
        const newer = this.controls.get(key); // a write happened while this read waited: the write wins
        if (newer) return structuredClone(newer.value) as T | null;
      }
    }
    return value;
  }
  async setControl(key: string, value: unknown): Promise<void> {
    const k = `c:${key}`;
    this.bump(k);
    // A stop is believed at once, even if the database write then fails or hangs: the safe direction. This happens before the
    // first wait in this method, so a caller that does not wait for the write (the daily loss stop) has the stop in force as
    // soon as the call returns.
    const isStopOn = key === CONTROL_STOP && (value as { on?: boolean } | null)?.on === true;
    if (isStopOn) {
      this.controls.set(key, { value: structuredClone(value), at: this.now() });
      this.unsavedStop = structuredClone(value);
    }
    const write = async () => {
      await this.inner.setControl(key, value); // a failed write leaves memory as it was (a stop that was set stays set)
      if (key === CONTROL_STOP) this.unsavedStop = null; // saved (on or off): the database is the truth again
      if (isFastKey(key)) this.controls.set(key, { value: structuredClone(value), at: this.now() });
      this.bump(k);
    };
    if (key !== CONTROL_STOP) return write();
    return this.queueStopWrite(write);
  }

  // Writes to the stop flag reach the database one at a time, in the order they were asked for, so a retry of an unsaved stop and
  // Michael's `resume` can never land in the wrong order.
  private stopChain: Promise<unknown> = Promise.resolve();
  private queueStopWrite(write: () => Promise<void>): Promise<void> {
    const p = this.stopChain.then(write, write);
    this.stopChain = p.catch(() => undefined);
    return p;
  }

  // True while a stop is in force that the database has not stored.
  hasUnsavedStop(): boolean {
    return this.unsavedStop !== null;
  }

  // Tries again to store a stop that could not be saved (called on every pass of the worker, review round 5). Never overwrites a
  // later write: if any other write to the stop flag succeeded meanwhile (Michael's `resume`), or a newer stop replaced it, this
  // does nothing. Returns true if it stored the stop.
  async retryUnsavedStop(): Promise<boolean> {
    const pending = this.unsavedStop;
    if (pending === null) return false;
    let saved = false;
    await this.queueStopWrite(async () => {
      if (this.unsavedStop !== pending) return;
      await this.inner.setControl(CONTROL_STOP, pending);
      if (this.unsavedStop !== pending) return;
      this.unsavedStop = null;
      this.controls.set(CONTROL_STOP, { value: structuredClone(pending), at: this.now() });
      this.bump(`c:${CONTROL_STOP}`);
      saved = true;
    });
    return saved;
  }

  async getDay(tradeDate: string): Promise<DayRecord | null> {
    const hit = this.days.get(tradeDate);
    if (hit && this.now() - hit.at < this.dayTtlMs) return structuredClone(hit.value);
    const k = `d:${tradeDate}`;
    const g0 = this.g(k);
    const value = await this.inner.getDay(tradeDate);
    if (this.g(k) === g0) this.days.set(tradeDate, { value: structuredClone(value), at: this.now() });
    else {
      const newer = this.days.get(tradeDate);
      if (newer) return structuredClone(newer.value);
    }
    return value;
  }
  async createDay(day: DayRecord): Promise<DayRecord> {
    const k = `d:${day.tradeDate}`;
    this.bump(k);
    const v = await this.inner.createDay(day);
    this.days.set(day.tradeDate, { value: structuredClone(v), at: this.now() });
    this.bump(k);
    return v;
  }
  async updateDay(tradeDate: string, patch: Partial<Omit<DayRecord, "tradeDate">>): Promise<DayRecord> {
    const k = `d:${tradeDate}`;
    this.bump(k);
    const v = await this.inner.updateDay(tradeDate, patch);
    this.days.set(tradeDate, { value: structuredClone(v), at: this.now() });
    this.bump(k);
    return v;
  }

  private loading = new Map<string, Promise<DayOrders>>();

  // A day's orders are loaded once, and two callers that arrive together share the one load (otherwise the slower load
  // could replace a list that already holds a newer entry). Lists for days before the last two are dropped.
  private ordersFor(tradeDate: string): Promise<DayOrders> {
    const have = this.orders.get(tradeDate);
    if (have) return Promise.resolve(have);
    let p = this.loading.get(tradeDate);
    if (!p) {
      p = this.inner
        .listOrders(tradeDate)
        .then((rows) => {
          const m = new DayOrders(rows.map((o) => frozen(o)));
          this.orders.set(tradeDate, m);
          for (const d of [...this.orders.keys()].sort().slice(0, -2)) this.orders.delete(d);
          return m;
        })
        .finally(() => this.loading.delete(tradeDate));
      this.loading.set(tradeDate, p);
    }
    return p;
  }
  async insertOrder(order: OrderRecord): Promise<boolean> {
    const m = await this.ordersFor(order.tradeDate);
    const inserted = await this.inner.insertOrder(order);
    if (inserted) m.set(order.clientOrderId, frozen({ createdAt: new Date(this.now()).toISOString(), ...structuredClone(order) }));
    else if (!m.has(order.clientOrderId)) this.orders.delete(order.tradeDate); // it exists in the database: reload next time
    return inserted;
  }
  async updateOrder(clientOrderId: string, patch: Partial<Omit<OrderRecord, "clientOrderId" | "tradeDate">>): Promise<void> {
    await Promise.allSettled([...this.loading.values()]); // a load in flight may have read the row before this write
    await this.inner.updateOrder(clientOrderId, patch);
    for (const m of this.orders.values()) {
      const o = m.get(clientOrderId);
      if (o) m.set(clientOrderId, frozen({ ...o, ...structuredClone(patch) }));
    }
  }
  // THE SPEED RELEASE, ITEM 1 (Michael's approval of 2026-11-05). Alpaca's live order updates close an entry (its exit filled and
  // Alpaca says no shares are held, or an entry that never filled was cancelled) in this memory AT ONCE, so the order gate sees the
  // symbol free without waiting for the database; the database write follows in the background. On 2026-11-05 about 115 entries
  // waited 2 to 21 seconds behind that write. This is the one exception to "write first, then memory", and it is safe in one
  // direction only: until the write lands, anything read back from the database (after a restart, or a day not loaded yet) can only
  // show the entry as still active, which makes the gate REFUSE that symbol, never send beside it. A write that fails is kept and
  // tried again on the worker's next pass (retrySoonWrites). The returned promise never rejects.
  private soonPending = new Map<string, Partial<Omit<OrderRecord, "clientOrderId" | "tradeDate">>>();
  private soonTimes: number[] = [];
  updateOrderSoon(clientOrderId: string, patch: Partial<Omit<OrderRecord, "clientOrderId" | "tradeDate">>): Promise<void> {
    for (const m of this.orders.values()) {
      const o = m.get(clientOrderId);
      if (o) m.set(clientOrderId, frozen({ ...o, ...structuredClone(patch) }));
    }
    this.soonPending.set(clientOrderId, { ...(this.soonPending.get(clientOrderId) ?? {}), ...structuredClone(patch) });
    return this.writeSoon(clientOrderId);
  }
  private async writeSoon(clientOrderId: string): Promise<void> {
    const patch = this.soonPending.get(clientOrderId);
    if (!patch) return;
    const t0 = this.now();
    try {
      await Promise.allSettled([...this.loading.values()]);
      await this.inner.updateOrder(clientOrderId, patch);
      if (this.soonPending.get(clientOrderId) === patch) this.soonPending.delete(clientOrderId);
      this.soonTimes.push(Math.max(0, this.now() - t0));
      if (this.soonTimes.length > 5_000) this.soonTimes.shift();
    } catch {
      /* kept in soonPending: tried again by retrySoonWrites */
    }
  }
  // Tries again every close that could not be written yet (called on every pass of the worker).
  // One run at a time (group 1 review note): a database that hangs cannot pile up a new waiting write on every pass.
  private retrying: Promise<void> | null = null;
  retrySoonWrites(): Promise<void> {
    if (this.retrying) return this.retrying;
    this.retrying = (async () => {
      for (const id of [...this.soonPending.keys()]) await this.writeSoon(id);
    })().finally(() => void (this.retrying = null));
    return this.retrying;
  }
  // How long each background write took (milliseconds) since the last call, for the per-minute statistics.
  takeSoonWriteTimes(): number[] {
    const t = this.soonTimes;
    this.soonTimes = [];
    return t;
  }

  async getOrder(clientOrderId: string): Promise<OrderRecord | null> {
    for (const m of this.orders.values()) {
      const o = m.get(clientOrderId);
      if (o) return structuredClone(o);
    }
    return this.inner.getOrder(clientOrderId);
  }
  // THE NO-COPY FIX (Michael's approval of 2026-11-11). The rows are handed out as they are kept, not copied one by one: on 2026-11-11
  // copying all 7,700 of the day's rows on every entry decision grew the worker's CPU from about 5 to about 20 percent, spent Fly's
  // CPU burst balance by 10:22, and the machine was throttled until 10:30 (builds/build-c2-log.md, "Fly metrics read"). Each kept
  // row is frozen and never changed in place (a write replaces it with a new frozen row), so a caller cannot change the memory, and a
  // list read earlier keeps the rows as they were when it was read, as the copies did. The array itself is new on every call.
  // The day's index, kept up to date by every write above: the gate, the account view and the sync read it instead of the full list.
  async orderIndex(tradeDate: string): Promise<DayOrderIndex> {
    return this.ordersFor(tradeDate);
  }

  async listOrders(tradeDate: string): Promise<OrderRecord[]> {
    return [...(await this.ordersFor(tradeDate)).values()].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "") || a.clientOrderId.localeCompare(b.clientOrderId));
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
