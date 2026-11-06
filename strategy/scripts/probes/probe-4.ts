import { get } from "../alpaca-data.ts";
const syms = "TCEHY,NSRGY,RHHBY,AAPL,ZZZZ,QQQQ,BRK.B,GOOGL,TWTR,BBBY,BBBYQ,SIVB,SIVBQ";
const r = await get("/v2/stocks/bars", { symbols: syms, timeframe: "1Month", start: "2016-01-01", end: "2026-10-31", limit: 10000, adjustment: "split", feed: "sip" });
for (const s of syms.split(",")) { const b = r.bars?.[s]??[]; console.log(s, b.length, b[0]?.t?.slice(0,10), b.at(-1)?.t?.slice(0,10)); }
console.log("next:", !!r.next_page_token);
