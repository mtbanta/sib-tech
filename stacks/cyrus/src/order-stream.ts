// LIVE ORDER UPDATES (release B, Michael's approval of 2026-11-04; every day since the speed release of 2026-11-05). From "Armed"
// to the close the worker listens to Alpaca's paper `trade_updates` stream. When an exit fills and leaves no shares of that symbol,
// the symbol is freed at once (its entry is closed in memory, the database write follows, and the gate's cached positions drop
// it), so the next entry on it need not wait for the order sync. Since the speed release it also:
//   - closes an entry that never filled when Alpaca reports it cancelled or expired (a load-window limit buy cancelled after its
//     wait), which frees the symbol the same way;
//   - keeps the gate's cached positions current from each fill's share count (`position_qty`), between the 10 second reads;
//   - reports a protective stop that Alpaca cancelled while the take-profit had partly filled (shares left without a stop), so the
//     worker runs the order sync 3 seconds after the cancel instead of at the next 10 second sync.
//
// It is a listener only. It never sends an order and never calls Alpaca's REST interface, so it costs none of the 200 requests a
// minute. The order sync stays the record of truth: it runs every 10 seconds, still frees what this misses (while the stream is
// down, everything), and still runs the missing-exit and bare-remainder checks.
//
// PAPER ONLY: the address is built from the fixed paper host and checked; nothing can point it anywhere else.
import { PAPER_TRADING_HOST, ConfigError, type Settings } from "./config.ts";
import { parseOrder, type Order } from "./alpaca-trading.ts";
import type { OrderRecord } from "./store.ts";

export const ORDER_STREAM_URL = `wss://${PAPER_TRADING_HOST}/stream`;

export function assertPaperStream(address: string): void {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new ConfigError("Order stream address is not a valid web address");
  }
  if (url.protocol !== "wss:" || url.hostname !== PAPER_TRADING_HOST || url.port !== "" || url.pathname !== "/stream") {
    throw new ConfigError("Refusing an order stream address that is not Alpaca's paper host");
  }
}

// One `trade_updates` message, parsed.
export interface TradeUpdate {
  event: string;
  order: Order;
  // The position in this symbol after the event, in shares (fill and partial_fill events only); null when Alpaca did not say.
  positionQty: number | null;
  // When Alpaca says the event happened (milliseconds), or null.
  atMs: number | null;
  // The price of this fill (fill and partial_fill events), or null.
  price?: number | null;
  // The message as Alpaca sent it (one a minute is kept in the statistics, item 10). It holds order data only, no keys.
  raw?: Record<string, unknown>;
}

export function parseTradeUpdate(data: Record<string, unknown>): TradeUpdate | null {
  if (typeof data.event !== "string" || !data.order || typeof data.order !== "object") return null;
  const order = parseOrder(data.order as Record<string, unknown>);
  const pq = data.position_qty;
  const positionQty = pq === undefined || pq === null || pq === "" ? null : Number(pq);
  const at = typeof data.timestamp === "string" ? Date.parse(data.timestamp) : NaN;
  const px = data.price === undefined || data.price === null || data.price === "" ? NaN : Number(data.price);
  return { event: data.event, order, positionQty: Number.isFinite(positionQty as number) ? (positionQty as number) : null, atMs: Number.isFinite(at) ? at : null, price: Number.isFinite(px) ? px : null, raw: data };
}

export type OrderStreamStatus = "connecting" | "authenticating" | "live" | "reconnecting" | "auth_failed" | "stopped";

interface SocketLike {
  send(data: string): void;
  close(): void;
  binaryType?: string;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface OrderStreamDeps {
  makeSocket?: (url: string) => SocketLike;
  setTimer?: (fn: () => void, ms: number) => unknown;
}

// Paper sends `trade_updates` as binary frames holding JSON text; the authorization answers may come as text. Both are read.
async function frameText(data: unknown): Promise<string | null> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data as ArrayBufferView);
  if (data && typeof (data as { text?: unknown }).text === "function") return (data as Blob).text();
  return null;
}

export class OrderStream {
  status: OrderStreamStatus = "connecting";
  reconnects = 0;
  private socket: SocketLike | null = null;
  private attempts = 0;
  private stopped = false;
  private readonly settings: Settings;
  private readonly onUpdate: (u: TradeUpdate) => void;
  private readonly onStatus: (s: OrderStreamStatus, detail?: string) => void;
  private readonly makeSocket: (url: string) => SocketLike;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;

  constructor(settings: Settings, onUpdate: (u: TradeUpdate) => void, onStatus: (s: OrderStreamStatus, detail?: string) => void, deps: OrderStreamDeps = {}) {
    assertPaperStream(ORDER_STREAM_URL);
    this.settings = settings;
    this.onUpdate = onUpdate;
    this.onStatus = onStatus;
    this.makeSocket = deps.makeSocket ?? ((u) => new WebSocket(u) as unknown as SocketLike);
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  }

  private set(status: OrderStreamStatus, detail?: string) {
    this.status = status;
    this.onStatus(status, detail);
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.socket?.close();
    this.set("stopped");
  }

  private connect(): void {
    this.set(this.attempts === 0 ? "connecting" : "reconnecting");
    assertPaperStream(ORDER_STREAM_URL);
    const ws = this.makeSocket(ORDER_STREAM_URL);
    this.socket = ws;
    try {
      ws.binaryType = "arraybuffer";
    } catch {
      /* not every socket has it */
    }
    ws.onopen = () => {
      this.set("authenticating");
      ws.send(JSON.stringify({ action: "auth", key: this.settings.alpaca.keyId, secret: this.settings.alpaca.secretKey }));
    };
    ws.onmessage = (ev) => {
      void frameText(ev.data)
        .then((text) => text !== null && this.handle(ws, text))
        .catch(() => undefined);
    };
    ws.onerror = () => {}; // the close event follows and drives the reconnect
    ws.onclose = () => {
      if (this.stopped || this.status === "auth_failed") return;
      this.attempts++;
      this.reconnects++;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.attempts, 5));
      this.set("reconnecting", `retry in ${delay} ms`);
      this.setTimer(() => {
        if (!this.stopped) this.connect();
      }, delay);
    };
  }

  private handle(ws: SocketLike, raw: string): void {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    const data = (m.data ?? {}) as Record<string, unknown>;
    if (m.stream === "authorization") {
      if (data.status === "authorized") ws.send(JSON.stringify({ action: "listen", data: { streams: ["trade_updates"] } }));
      else {
        this.set("auth_failed", "not authorized"); // reconnecting cannot fix this
        ws.close();
      }
    } else if (m.stream === "listening") {
      this.attempts = 0;
      this.set("live");
    } else if (m.stream === "trade_updates") {
      const u = parseTradeUpdate(data);
      if (u) this.onUpdate(u);
    }
  }
}

// What freeing a symbol needs from the rest of the worker.
export interface FreeDeps {
  // The stored entry, by its client id.
  getOrder: (clientOrderId: string) => Promise<OrderRecord | null>;
  closeOrder: (clientOrderId: string, patch: Partial<OrderRecord>) => Promise<void>;
  // Drops a symbol from the gate's cached positions (Alpaca has just said none are held).
  dropPosition: (symbol: string) => void;
  // The speed release, item 8: sets a symbol's share count in the gate's cached positions from a fill's `position_qty` (0 drops it).
  setPosition?: (symbol: string, qty: number, price: number | null) => void;
  // The speed release (decision 3): a bracket's stop was cancelled while its take-profit had partly filled, so shares are left
  // without a stop. The worker brings the order sync forward to 3 seconds after `atMs`.
  onStopCancelled?: (info: { clientOrderId: string; symbol: string; atMs: number }) => void;
  // The entry (Alpaca's parent order, with its fill) for a group id, from the order sync's latest view, if the stream has not seen it.
  entryForGroup?: (groupId: string) => Order | null;
  now: () => number;
  log?: (event: string, data?: Record<string, unknown>) => void;
}

interface EntryInfo {
  clientOrderId: string;
  symbol: string;
  filledQty: number;
  filledAvgPrice: number | null;
  final: boolean;
}

// Turns live order updates into freed symbols. The safety rules:
//   - only a fill of a SELL order counts;
//   - the symbol is freed only when Alpaca says the position is now 0 shares (`position_qty`), or, if Alpaca does not say, when
//     the exit fills of that entry's own group add up to the entry's whole filled quantity;
//   - the entry closed is found by Alpaca's group id, never by symbol, so a late update about an older position can never close
//     a newer entry on the same symbol (which would let a second entry go out beside it and take it out of the missing-exit check);
//   - an entry is closed only if its own fill is known, so its record is written correctly; otherwise only the cached position is
//     dropped and the order sync closes the record.
export class OrderUpdateHandler {
  readonly counts = { events: 0, freed: 0, closedRecords: 0, cancelledEntries: 0, stopGaps: 0 };
  private readonly freeMs: number[] = [];
  // Free times since the per-minute statistics last took them (the slowest of each minute is logged).
  private minuteFreeMs: number[] = [];
  // Entries (client ids) a fill was seen for, so the load window's expiry knows not to cancel them.
  private readonly filledIds = new Set<string>();
  private readonly entries = new Map<string, EntryInfo>(); // by group id
  private readonly exitLegs = new Map<string, Map<string, number>>(); // group id -> leg id -> filled qty
  private readonly d: FreeDeps;

  constructor(deps: FreeDeps) {
    this.d = deps;
  }

  // True once a fill of this entry has arrived on the stream.
  wasFilled(clientOrderId: string): boolean {
    return this.filledIds.has(clientOrderId);
  }

  // Free times (milliseconds) since the last call, for the per-minute statistics.
  takeMinuteFrees(): number[] {
    const t = this.minuteFreeMs;
    this.minuteFreeMs = [];
    return t;
  }

  // Typical (median) time from the exit fill (Alpaca's timestamp) to the free, in milliseconds.
  medianFreeMs(): number | null {
    if (this.freeMs.length === 0) return null;
    const s = [...this.freeMs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)]!;
  }

  private entry(groupId: string): EntryInfo | null {
    const known = this.entries.get(groupId);
    if (known) return known;
    const o = this.d.entryForGroup?.(groupId);
    if (!o) return null;
    return { clientOrderId: o.clientOrderId, symbol: o.symbol, filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, final: o.status === "filled" };
  }

  async handle(u: TradeUpdate): Promise<void> {
    this.counts.events++;
    const o = u.order;
    const g = o.groupId ?? null;
    const isFill = u.event === "fill" || u.event === "partial_fill";
    const fillPrice = u.price ?? o.filledAvgPrice ?? null;
    if (o.side === "buy") {
      const ours = o.clientOrderId.startsWith("cyrus-") && !o.clientOrderId.startsWith("cyrus-x-");
      if (g && ours) this.entries.set(g, { clientOrderId: o.clientOrderId, symbol: o.symbol, filledQty: o.filledQty, filledAvgPrice: o.filledAvgPrice, final: o.status === "filled" });
      if (isFill) {
        if (ours) this.filledIds.add(o.clientOrderId);
        if (u.positionQty !== null) this.d.setPosition?.(o.symbol, u.positionQty, fillPrice);
      }
      // An entry of ours that never filled and is now final (a load-window limit buy cancelled after its wait): its record is closed
      // as cancelled, which frees the symbol at once. One that partly filled is left to the order sync.
      if ((u.event === "canceled" || u.event === "expired") && ours && !(o.filledQty > 0) && !this.filledIds.has(o.clientOrderId)) {
        if (g) this.entries.delete(g);
        const row = await this.d.getOrder(o.clientOrderId);
        if (row && !row.closedAt && row.symbol === o.symbol && row.status !== "filled" && !(row.filledQty && row.filledQty > 0)) {
          await this.d.closeOrder(o.clientOrderId, { closedAt: new Date(this.d.now()).toISOString(), status: "canceled", alpacaOrderId: o.id });
          this.counts.cancelledEntries++;
          this.d.log?.("order_stream_entry_cancelled", { symbol: o.symbol });
        }
      }
      return;
    }
    if (o.side !== "sell") return;
    // A bracket's stop cancelled while the take-profit has partly filled: shares are left without a stop (release A, fix 1). Only
    // that case is reported: a stop cancelled because the take-profit filled completely, or by one of our own sales, is not.
    if (u.event === "canceled" && g && (o.type === "stop" || o.stopPrice !== null)) {
      const info = this.entry(g);
      const exited = [...(this.exitLegs.get(g) ?? new Map<string, number>()).values()].reduce((a, b) => a + b, 0);
      if (info && info.final && info.filledQty > 0 && exited > 1e-9 && exited < info.filledQty - 1e-9) {
        this.counts.stopGaps++;
        this.d.onStopCancelled?.({ clientOrderId: info.clientOrderId, symbol: o.symbol, atMs: u.atMs ?? this.d.now() });
      }
      return;
    }
    if (!isFill) return;
    if (g) {
      const legs = this.exitLegs.get(g) ?? new Map<string, number>();
      legs.set(o.id, o.filledQty);
      this.exitLegs.set(g, legs);
    }
    if (u.positionQty !== null && u.positionQty > 1e-9) this.d.setPosition?.(o.symbol, u.positionQty, fillPrice);
    const info = g ? this.entry(g) : null;
    let flat: boolean;
    if (u.positionQty !== null) flat = u.positionQty <= 1e-9;
    else if (g && info && info.final && info.filledQty > 0) flat = [...(this.exitLegs.get(g) ?? new Map<string, number>()).values()].reduce((a, b) => a + b, 0) >= info.filledQty - 1e-9;
    else flat = false; // cannot be decided here: the order sync will
    if (!flat) return;

    this.d.dropPosition(o.symbol);
    this.counts.freed++;
    if (u.atMs !== null) {
      const ms = Math.max(0, this.d.now() - u.atMs);
      this.freeMs.push(ms);
      if (this.freeMs.length > 2_000) this.freeMs.shift();
      this.minuteFreeMs.push(ms);
      if (this.minuteFreeMs.length > 5_000) this.minuteFreeMs.shift();
    }
    let closed = false;
    if (g && info && info.final && info.filledQty > 0 && info.symbol === o.symbol) {
      const row = await this.d.getOrder(info.clientOrderId);
      if (row && !row.closedAt && row.symbol === o.symbol) {
        await this.d.closeOrder(info.clientOrderId, { closedAt: new Date(this.d.now()).toISOString(), status: "filled", filledQty: info.filledQty, filledAvgPrice: info.filledAvgPrice });
        this.counts.closedRecords++;
        closed = true;
      }
      this.entries.delete(g);
      this.exitLegs.delete(g);
    }
    this.d.log?.("order_stream_freed", { symbol: o.symbol, closedRecord: closed, ms: u.atMs !== null ? this.d.now() - u.atMs : null });
  }
}
