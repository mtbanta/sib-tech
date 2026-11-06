// Read-only client for Alpaca's market data host. Never calls a trading host.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "https://data.alpaca.markets"; // the only host these keys may be used against

function loadKeys(): { id: string; secret: string } {
  const p = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  const env: Record<string, string> = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
  }
  const id = env.ALPACA_RESEARCH_API_KEY_ID, secret = env.ALPACA_RESEARCH_API_SECRET_KEY;
  if (!id || !secret) throw new Error("research keys missing in strategy/.env.local");
  return { id, secret };
}
const keys = loadKeys();

// Simple pacing: stay under the published 200 requests a minute (we use at most 180).
let last = 0;
const GAP_MS = 334;
async function pace() {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  last = Date.now();
}

export async function get(path: string, params: Record<string, string | number | undefined> = {}): Promise<any> {
  const url = new URL(path, HOST);
  if (url.origin !== HOST) throw new Error("refusing non-data host");
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 6; attempt++) {
    await pace();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "APCA-API-KEY-ID": keys.id, "APCA-API-SECRET-KEY": keys.secret, "User-Agent": "sib-tech-research" },
        signal: AbortSignal.timeout(60000),
      });
    } catch { await new Promise(r => setTimeout(r, 5000 * (attempt + 1))); continue; } // network error: wait and retry
    if (res.status === 429 || res.status >= 500) {
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url.pathname}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  }
  throw new Error("too many retries " + url.pathname);
}

// Multi-symbol bars with every page followed. Returns symbol -> bars.
export async function bars(symbols: string[], params: Record<string, string | number>): Promise<Record<string, any[]>> {
  const out: Record<string, any[]> = {};
  let token: string | undefined;
  do {
    const r = await get("/v2/stocks/bars", { ...params, symbols: symbols.join(","), limit: 10000, page_token: token });
    for (const [s, b] of Object.entries(r.bars ?? {})) (out[s] ??= []).push(...(b as any[]));
    token = r.next_page_token ?? undefined;
  } while (token);
  return out;
}
