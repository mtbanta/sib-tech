// Step 2: monthly bars (split-adjusted, consolidated "sip" feed) for every candidate symbol string:
// every 1 to 4 letter combination, every 5 letter symbol in the SEC fails-to-deliver files, and every
// symbol in today's Nasdaq Trader lists. A symbol "exists" in Alpaca's data if it returns any bar.
// Raw responses are cached per chunk in data/raw/monthly/.
import { join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { DATA, exists, writeJson } from "./common.ts";
import { bars } from "./alpaca-data.ts";

const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const set = new Set<string>();
for (const a of L) { set.add(a); for (const b of L) { set.add(a + b); for (const c of L) { set.add(a + b + c); for (const d of L) set.add(a + b + c + d); } } }
const base = set.size;

for (const f of readdirSync(join(DATA, "raw", "ftd")).sort()) {
  const txt = execFileSync("unzip", ["-p", join(DATA, "raw", "ftd", f)], { maxBuffer: 1 << 28 }).toString("latin1");
  for (const line of txt.split(/\r?\n/)) { const s = line.split("|")[2]?.trim(); if (s && /^[A-Z]{5}$/.test(s)) set.add(s); }
}
const afterFtd = set.size;
const nl = readFileSync(join(DATA, "raw", "lists", "nasdaqlisted.txt"), "utf8").split(/\r?\n/).slice(1);
const ol = readFileSync(join(DATA, "raw", "lists", "otherlisted.txt"), "utf8").split(/\r?\n/).slice(1);
for (const l of nl) { const s = l.split("|")[0]; if (s && /^[A-Z.]+$/.test(s)) set.add(s); }
for (const l of ol) { const s = l.split("|")[0]; if (s && /^[A-Z.]+$/.test(s)) set.add(s); }
const syms = [...set].sort();
console.log("1-4 letter:", base, "plus FTD 5 letter:", afterFtd - base, "plus Nasdaq Trader:", set.size - afterFtd, "total:", syms.length);

const CH = 1000;
const dir = join(DATA, "raw", "monthly");
let done = 0, found = 0;
for (let i = 0; i < syms.length; i += CH) {
  const file = join(dir, `chunk-${String(i / CH).padStart(4, "0")}.json`);
  if (!exists(file)) {
    const chunk = syms.slice(i, i + CH);
    const r = await bars(chunk, { timeframe: "1Month", start: "2009-01-01", end: "2026-10-31", adjustment: "split", feed: "sip" });
    writeJson(file, { symbols: chunk, bars: r });
    found += Object.keys(r).length;
  }
  done++;
  if (done % 25 === 0) console.log(new Date().toISOString(), "chunks", done, "of", Math.ceil(syms.length / CH), "new symbols with data", found);
}
console.log("done");
