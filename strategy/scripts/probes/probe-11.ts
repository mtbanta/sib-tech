import { get } from "../alpaca-data.ts";
const r = await get("/v2/stocks/bars", { symbols: "AAPL", timeframe: "1Min", start: "2024-03-12T13:30:00Z", end: "2024-03-12T20:00:00Z", limit: 10000, feed: "sip", adjustment: "split" });
const b = r.bars.AAPL; const json = JSON.stringify(b);
const csv = b.map((x:any)=>["AAPL",x.t,x.o,x.h,x.l,x.c,x.v,x.n,x.vw].join(",")).join("\n");
console.log("bars", b.length, "json bytes/bar", (json.length/b.length).toFixed(0), "csv bytes/bar", (csv.length/b.length).toFixed(0));
