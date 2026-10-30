// Alpaca market data, read only. The feed is a setting: iex (free, one exchange) or sip (full consolidated,
// needs a live account). Moving from iex to sip is a configuration change, not a code change.
import type { Settings } from "./config.ts";
import type { Bar } from "./screen.ts";

export class AlpacaData {
  private readonly settings: Settings;
  private readonly fetchImpl: typeof fetch;

  constructor(settings: Settings, fetchImpl: typeof fetch = fetch) {
    this.settings = settings;
    this.fetchImpl = fetchImpl;
  }

  get feed() {
    return this.settings.alpaca.dataFeed;
  }

  private async get(path: string, query: Record<string, string> = {}, feed: "iex" | "sip" = this.feed, timeoutMs = 10_000): Promise<unknown> {
    const url = new URL(this.settings.alpaca.dataBaseUrl + path);
    url.searchParams.set("feed", feed);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, {
      headers: { "APCA-API-KEY-ID": this.settings.alpaca.keyId, "APCA-API-SECRET-KEY": this.settings.alpaca.secretKey },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
    });
    if (!res.ok) throw new Error(`Alpaca data ${path} answered ${res.status}`);
    return res.json();
  }

  async latestTrade(symbol: string): Promise<{ price: number; time: string }> {
    const body = (await this.get(`/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`)) as { trade?: { p?: number; t?: string } };
    if (!body.trade || typeof body.trade.p !== "number") throw new Error(`No latest trade for ${symbol}`);
    return { price: body.trade.p, time: String(body.trade.t) };
  }

  // Daily bars for many symbols. Historical data older than 15 minutes is free on the Basic plan, even on the
  // consolidated feed, so the screen asks for sip history while live prices come from the configured feed.
  async dailyBars(symbols: readonly string[], startIso: string, endIso: string, feed: "iex" | "sip" = "sip"): Promise<Map<string, Bar[]>> {
    const out = new Map<string, Bar[]>();
    for (let i = 0; i < symbols.length; i += 400) {
      const chunk = symbols.slice(i, i + 400);
      let token: string | undefined;
      do {
        const query: Record<string, string> = { symbols: chunk.join(","), timeframe: "1Day", start: startIso, end: endIso, limit: "10000", adjustment: "raw" };
        if (token) query.page_token = token;
        const body = (await this.get("/v2/stocks/bars", query, feed, 60_000)) as { bars?: Record<string, Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>>; next_page_token?: string | null };
        for (const [sym, bars] of Object.entries(body.bars ?? {})) {
          const list = out.get(sym) ?? [];
          for (const b of bars) list.push({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v });
          out.set(sym, list);
        }
        token = body.next_page_token ?? undefined;
      } while (token);
    }
    return out;
  }
}
