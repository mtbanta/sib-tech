// The real store: Postgres at Supabase, reached with the project's database address (never the Data API).
import pg from "pg";
import type { Limits } from "./limits.ts";
import type { DayRecord, OrderRecord, RefusalRecord, Store } from "./store.ts";

// Anything with a query method: a Pool in the worker, or a single client inside a rolled-back transaction in
// the check tool.
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

// Postgres "date" values come back as plain YYYY-MM-DD text, not as a JavaScript Date (which would shift the day
// by the machine's time zone).
pg.types.setTypeParser(1082, (v: string) => v);

// Supabase's pooler and direct hosts require TLS. The connection is encrypted; the server certificate is not
// pinned yet (Supabase signs with its own authority, which Node does not know). Recorded in the build log as
// a known gap to close by pinning Supabase's published certificate.
export function makePool(databaseUrl: string): pg.Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
  });
}

const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const dateOnly = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

function dayFromRow(r: any): DayRecord {
  return {
    tradeDate: dateOnly(r.trade_date),
    isTradingDay: r.is_trading_day,
    openAt: r.open_at ? new Date(r.open_at) : null,
    closeAt: r.close_at ? new Date(r.close_at) : null,
    status: r.status,
    dayStartEquity: n(r.day_start_equity),
    suggested: r.suggested as Limits,
    limits: r.limits as Limits,
    decided: r.decided ?? {},
    liveList: r.live_list ?? null,
    phases: r.phases ?? {},
  };
}

function orderFromRow(r: any): OrderRecord {
  return {
    clientOrderId: r.client_order_id,
    tradeDate: dateOnly(r.trade_date),
    symbol: r.symbol,
    qty: Number(r.qty),
    referencePrice: Number(r.reference_price),
    stopPrice: Number(r.stop_price),
    status: r.status,
    alpacaOrderId: r.alpaca_order_id ?? null,
    filledQty: n(r.filled_qty),
    filledAvgPrice: n(r.filled_avg_price),
    note: r.note ?? null,
  };
}

export class PgStore implements Store {
  private readonly db: Queryable;
  constructor(db: Queryable) {
    this.db = db;
  }

  async getControl<T = unknown>(key: string): Promise<T | null> {
    const r = await this.db.query("select value from control where key = $1", [key]);
    return r.rows.length ? (r.rows[0].value as T) : null;
  }
  async setControl(key: string, value: unknown): Promise<void> {
    await this.db.query(
      "insert into control (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value, updated_at = now()",
      [key, JSON.stringify(value)],
    );
  }

  async getDay(tradeDate: string): Promise<DayRecord | null> {
    const r = await this.db.query("select * from trading_days where trade_date = $1", [tradeDate]);
    return r.rows.length ? dayFromRow(r.rows[0]) : null;
  }
  async createDay(d: DayRecord): Promise<DayRecord> {
    await this.db.query(
      `insert into trading_days (trade_date, is_trading_day, open_at, close_at, status, day_start_equity, suggested, limits, decided, live_list, phases)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
       on conflict (trade_date) do nothing`,
      [d.tradeDate, d.isTradingDay, d.openAt, d.closeAt, d.status, d.dayStartEquity, JSON.stringify(d.suggested), JSON.stringify(d.limits), JSON.stringify(d.decided), d.liveList === null ? null : JSON.stringify(d.liveList), JSON.stringify(d.phases)],
    );
    const got = await this.getDay(d.tradeDate);
    if (!got) throw new Error("day row missing after insert");
    return got;
  }
  async updateDay(tradeDate: string, patch: Partial<Omit<DayRecord, "tradeDate">>): Promise<DayRecord> {
    const cols: string[] = [];
    const vals: unknown[] = [tradeDate];
    const add = (col: string, v: unknown, json = false) => {
      vals.push(json ? (v === null ? null : JSON.stringify(v)) : v);
      cols.push(`${col} = $${vals.length}${json ? "::jsonb" : ""}`);
    };
    if (patch.isTradingDay !== undefined) add("is_trading_day", patch.isTradingDay);
    if (patch.openAt !== undefined) add("open_at", patch.openAt);
    if (patch.closeAt !== undefined) add("close_at", patch.closeAt);
    if (patch.status !== undefined) add("status", patch.status);
    if (patch.dayStartEquity !== undefined) add("day_start_equity", patch.dayStartEquity);
    if (patch.suggested !== undefined) add("suggested", patch.suggested, true);
    if (patch.limits !== undefined) add("limits", patch.limits, true);
    if (patch.decided !== undefined) add("decided", patch.decided, true);
    if (patch.liveList !== undefined) add("live_list", patch.liveList, true);
    if (patch.phases !== undefined) add("phases", patch.phases, true);
    if (cols.length) await this.db.query(`update trading_days set ${cols.join(", ")}, updated_at = now() where trade_date = $1`, vals);
    const got = await this.getDay(tradeDate);
    if (!got) throw new Error(`no such day ${tradeDate}`);
    return got;
  }

  async insertOrder(o: OrderRecord): Promise<boolean> {
    const r = await this.db.query(
      `insert into orders (client_order_id, trade_date, symbol, qty, reference_price, stop_price, status, alpaca_order_id, filled_qty, filled_avg_price, note)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) on conflict (client_order_id) do nothing`,
      [o.clientOrderId, o.tradeDate, o.symbol, o.qty, o.referencePrice, o.stopPrice, o.status, o.alpacaOrderId, o.filledQty, o.filledAvgPrice, o.note],
    );
    return (r.rowCount ?? 0) === 1;
  }
  async updateOrder(clientOrderId: string, patch: Partial<Omit<OrderRecord, "clientOrderId" | "tradeDate">>): Promise<void> {
    const map: Record<string, string> = { symbol: "symbol", qty: "qty", referencePrice: "reference_price", stopPrice: "stop_price", status: "status", alpacaOrderId: "alpaca_order_id", filledQty: "filled_qty", filledAvgPrice: "filled_avg_price", note: "note" };
    const cols: string[] = [];
    const vals: unknown[] = [clientOrderId];
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in map) || v === undefined) continue;
      vals.push(v);
      cols.push(`${map[k]} = $${vals.length}`);
    }
    if (!cols.length) return;
    const r = await this.db.query(`update orders set ${cols.join(", ")}, updated_at = now() where client_order_id = $1`, vals);
    if ((r.rowCount ?? 0) !== 1) throw new Error(`no such order ${clientOrderId}`);
  }
  async getOrder(clientOrderId: string): Promise<OrderRecord | null> {
    const r = await this.db.query("select * from orders where client_order_id = $1", [clientOrderId]);
    return r.rows.length ? orderFromRow(r.rows[0]) : null;
  }
  async listOrders(tradeDate: string): Promise<OrderRecord[]> {
    const r = await this.db.query("select * from orders where trade_date = $1 order by created_at, client_order_id", [tradeDate]);
    return r.rows.map(orderFromRow);
  }

  async addRefusal(x: RefusalRecord): Promise<void> {
    await this.db.query("insert into refusals (trade_date, symbol, reason, detail) values ($1, $2, $3, $4::jsonb)", [x.tradeDate, x.symbol, x.reason, x.detail ? JSON.stringify(x.detail) : null]);
  }
  async listRefusals(tradeDate: string): Promise<RefusalRecord[]> {
    const r = await this.db.query("select * from refusals where trade_date = $1 order by id", [tradeDate]);
    return r.rows.map((row) => ({ tradeDate: dateOnly(row.trade_date), symbol: row.symbol, reason: row.reason, detail: row.detail ?? undefined }));
  }

  async addEvent(level: string, event: string, data?: Record<string, unknown>): Promise<void> {
    await this.db.query("insert into events (level, event, data) values ($1, $2, $3::jsonb)", [level, event, data ? JSON.stringify(data) : null]);
  }
}
