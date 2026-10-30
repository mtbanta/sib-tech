// Live trades for the day's live list, over Alpaca's market data stream (one connection).
// The feed comes from settings. On the free iex feed the stream carries at most 30 symbols.
import type { Settings } from "./config.ts";
import { IEX_STREAM_CAP } from "./screen.ts";

export interface Trade {
  symbol: string;
  price: number;
  size: number;
  time: string;
}

export type StreamStatus = "connecting" | "authenticating" | "live" | "reconnecting" | "auth_failed" | "stopped";

interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export interface StreamDeps {
  makeSocket?: (url: string) => SocketLike;
  setTimer?: (fn: () => void, ms: number) => unknown;
}

export class TradeStream {
  status: StreamStatus = "connecting";
  lastMessageAt = 0;
  private socket: SocketLike | null = null;
  private attempts = 0;
  private readonly url: string;
  private readonly settings: Settings;
  private readonly symbols: string[];
  private readonly onTrade: (t: Trade) => void;
  private readonly onStatus: (s: StreamStatus, detail?: string) => void;
  private readonly makeSocket: (url: string) => SocketLike;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private stopped = false;

  constructor(settings: Settings, symbols: readonly string[], onTrade: (t: Trade) => void, onStatus: (s: StreamStatus, detail?: string) => void, deps: StreamDeps = {}) {
    if (settings.alpaca.dataFeed === "iex" && symbols.length > IEX_STREAM_CAP) {
      throw new Error(`The free iex stream carries at most ${IEX_STREAM_CAP} symbols, got ${symbols.length}`);
    }
    this.settings = settings;
    this.symbols = [...symbols];
    this.onTrade = onTrade;
    this.onStatus = onStatus;
    this.url = `wss://stream.data.alpaca.markets/v2/${settings.alpaca.dataFeed}`;
    this.makeSocket = deps.makeSocket ?? ((u) => new WebSocket(u) as unknown as SocketLike);
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  }

  private set(status: StreamStatus, detail?: string) {
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
    const ws = this.makeSocket(this.url);
    this.socket = ws;
    ws.onmessage = (ev) => this.handle(ws, String(ev.data));
    ws.onerror = () => {}; // the close event follows and drives the reconnect
    ws.onclose = () => {
      if (this.stopped || this.status === "auth_failed") return;
      this.attempts++;
      const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.attempts, 5));
      this.set("reconnecting", `retry in ${delay} ms`);
      this.setTimer(() => {
        if (!this.stopped) this.connect();
      }, delay);
    };
  }

  private handle(ws: SocketLike, raw: string): void {
    this.lastMessageAt = Date.now();
    let messages: Array<Record<string, unknown>>;
    try {
      const parsed = JSON.parse(raw);
      messages = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return;
    }
    for (const m of messages) {
      if (m.T === "success" && m.msg === "connected") {
        this.set("authenticating");
        ws.send(JSON.stringify({ action: "auth", key: this.settings.alpaca.keyId, secret: this.settings.alpaca.secretKey }));
      } else if (m.T === "success" && m.msg === "authenticated") {
        ws.send(JSON.stringify({ action: "subscribe", trades: this.symbols }));
      } else if (m.T === "subscription") {
        this.attempts = 0;
        this.set("live");
      } else if (m.T === "t" && typeof m.S === "string" && typeof m.p === "number") {
        this.onTrade({ symbol: m.S, price: m.p, size: typeof m.s === "number" ? m.s : 0, time: String(m.t) });
      } else if (m.T === "error") {
        const code = Number(m.code);
        // 402 auth failed, 401 not authenticated: reconnecting cannot fix these.
        if (code === 402 || code === 401) {
          this.set("auth_failed", `error ${code}`);
          ws.close();
        } else {
          // 406 connection limit exceeded and others: leave the close/reconnect path to back off.
          this.onStatus("reconnecting", `stream error ${code}`);
        }
      }
    }
  }
}
