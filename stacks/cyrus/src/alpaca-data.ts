// Alpaca market data, read only. The feed is a setting: iex (free, one exchange) or sip (full consolidated,
// needs a live account). Moving from iex to sip is a configuration change, not a code change.
import type { Settings } from "./config.ts";

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

  private async get(path: string, query: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(this.settings.alpaca.dataBaseUrl + path);
    url.searchParams.set("feed", this.feed);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const res = await this.fetchImpl(url, {
      headers: { "APCA-API-KEY-ID": this.settings.alpaca.keyId, "APCA-API-SECRET-KEY": this.settings.alpaca.secretKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Alpaca data ${path} answered ${res.status}`);
    return res.json();
  }

  async latestTrade(symbol: string): Promise<{ price: number; time: string }> {
    const body = (await this.get(`/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`)) as { trade?: { p?: number; t?: string } };
    if (!body.trade || typeof body.trade.p !== "number") throw new Error(`No latest trade for ${symbol}`);
    return { price: body.trade.p, time: String(body.trade.t) };
  }
}
