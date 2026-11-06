// Shared paths and small helpers for strategy run 1.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = join(ROOT, "data");          // git-ignored raw downloads and caches
export const RUN = join(ROOT, "runs");
export const OUT = join(RUN, "strategy-run-1-data");

export function ensureDir(p: string) { mkdirSync(p, { recursive: true }); return p; }
export function readJson<T = any>(p: string): T { return JSON.parse(readFileSync(p, "utf8")); }
export function writeJson(p: string, v: unknown) { ensureDir(dirname(p)); writeFileSync(p, JSON.stringify(v)); }
export function exists(p: string) { return existsSync(p); }
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Generic client name with no personal information (brief: never send contact details).
export const USER_AGENT = "sib-tech-research-bot (personal research, no contact)";

// Fetch a URL once and keep the raw bytes in the cache; later runs read the cache.
let lastPlain = 0;
export async function cachedFetch(url: string, file: string, minGapMs = 250): Promise<Buffer> {
  if (existsSync(file)) return readFileSync(file);
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = lastPlain + minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastPlain = Date.now();
    let res: Response;
    try { res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Encoding": "gzip, deflate" }, signal: AbortSignal.timeout(60000) }); }
    catch { await sleep(5000 * (attempt + 1)); continue; } // network error: wait and retry
    if (res.status === 404) throw Object.assign(new Error("404 " + url), { status: 404 });
    if (res.status === 429 || res.status >= 500 || res.status === 403) { await sleep(3000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    ensureDir(dirname(file)); writeFileSync(file, buf);
    return buf;
  }
  throw new Error("gave up " + url);
}
