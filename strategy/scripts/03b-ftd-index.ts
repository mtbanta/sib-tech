// Step 3b: index the SEC fails-to-deliver files: symbol -> one entry per CUSIP with its latest
// description and first and last settlement date seen. A reused ticker gets several entries.
// Used to name symbols no longer listed and to find them in EDGAR.
import { join } from "node:path";
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { DATA, writeJson } from "./common.ts";

const idx: Record<string, { d: string; cusip: string; first: string; last: string }[]> = {};
for (const f of readdirSync(join(DATA, "raw", "ftd")).sort()) {
  const txt = execFileSync("unzip", ["-p", join(DATA, "raw", "ftd", f)], { maxBuffer: 1 << 28 }).toString("latin1");
  for (const line of txt.split(/\r?\n/)) {
    const x = line.split("|"); if (x.length < 5 || !/^\d{8}$/.test(x[0])) continue;
    const s = x[2].trim(); if (!s) continue;
    const d = `${x[0].slice(0, 4)}-${x[0].slice(4, 6)}-${x[0].slice(6, 8)}`;
    const cusip = x[1].trim();
    const list = (idx[s] ??= []);
    const e = list.find(y => y.cusip === cusip);
    if (!e) list.push({ d: x[4].trim(), cusip, first: d, last: d });
    else { if (d < e.first) e.first = d; if (d >= e.last) { e.last = d; e.d = x[4].trim(); } }
  }
}
writeJson(join(DATA, "work", "ftd-index.json"), idx);
console.log("symbols in fails-to-deliver files:", Object.keys(idx).length);
