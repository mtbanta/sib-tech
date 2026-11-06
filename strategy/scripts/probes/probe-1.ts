import { get } from "../alpaca-data.ts";
for (const [sym, feed] of [["SPY","sip"],["AAPL","sip"],["TWTR","sip"],["CELG","sip"],["SPY","iex"]]) {
  try {
    const r = await get("/v2/stocks/bars", { symbols: sym, timeframe: "1Day", start: "2000-01-01", end: "2026-11-01", limit: 3, adjustment: "split", feed });
    const b = r.bars?.[sym] ?? [];
    console.log(sym, feed, "first bars:", b.map((x:any)=>x.t.slice(0,10)+" o="+x.o).join(" | "));
  } catch (e:any) { console.log(sym, feed, "ERR", e.message); }
}
// latest TWTR bar
try { const r = await get("/v2/stocks/bars", { symbols: "TWTR", timeframe: "1Day", start: "2022-10-01", end: "2022-12-01", limit: 100, adjustment: "split", feed: "sip" });
console.log("TWTR late:", (r.bars?.TWTR??[]).slice(-2).map((x:any)=>x.t.slice(0,10)+" c="+x.c).join(" | ")); } catch(e:any){console.log("ERR",e.message)}
// minute bars earliest
try { const r = await get("/v2/stocks/bars", { symbols: "AAPL", timeframe: "1Min", start: "2000-01-01", end: "2026-11-01", limit: 2, feed: "sip" });
console.log("AAPL 1Min first:", (r.bars?.AAPL??[]).map((x:any)=>x.t).join(" | ")); } catch(e:any){console.log("ERR",e.message)}
// corporate actions
try { const r = await get("/v1/corporate-actions", { types: "cash_merger", start: "2022-10-01", end: "2022-11-30", limit: 5 });
console.log("CA keys:", Object.keys(r), JSON.stringify(r).slice(0,600)); } catch(e:any){console.log("CA ERR",e.message)}
