import { get } from "../alpaca-data.ts";
const L="ABCDEFGHIJKLMNOPQRSTUVWXYZ"; const syms:string[]=[];
for (const a of L) for (const b of L) for (const c of "ABCDEFGH") syms.push(a+b+c);
const s = syms.slice(0,1000); let token; let pages=0; const seen:Record<string,number>={};
const t0=Date.now();
do { const r = await get("/v2/stocks/bars", { symbols: s.join(","), timeframe: "1Month", start: "2016-01-01", end: "2026-10-31", limit: 10000, adjustment: "split", feed: "sip", page_token: token });
 pages++; for (const [k,v] of Object.entries(r.bars)) seen[k]=(seen[k]??0)+(v as any[]).length; token=r.next_page_token; } while(token);
console.log("pages", pages, "symbols", Object.keys(seen).length, "bars", Object.values(seen).reduce((a,b)=>a+b,0), "secs", (Date.now()-t0)/1000);
