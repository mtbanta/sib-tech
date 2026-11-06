import { get } from "../alpaca-data.ts";
const L="ABCDEFGHIJKLMNOPQRSTUVWXYZ"; const syms:string[]=[];
for (const a of L) for (const b of L) for (const c of "ABCDEFGH") syms.push(a+b+c);
for (const n of [500,1000,2000]) {
  try { const r = await get("/v2/stocks/bars", { symbols: syms.slice(0,n).join(","), timeframe: "1Month", start: "2016-01-01", end: "2026-10-31", limit: 10000, adjustment: "split", feed: "sip" });
  console.log(n, "ok symbols with data on page1:", Object.keys(r.bars).length, "next:", !!r.next_page_token); } catch(e:any){ console.log(n,"ERR",e.message.slice(0,200)); }
}
