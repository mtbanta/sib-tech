import { get } from "../alpaca-data.ts";
for (const sym of ["META","FB","SQ","XYZ","GOOG"]) {
  try { const r = await get("/v2/stocks/bars", { symbols: sym, timeframe: "1Day", start: "2016-01-01", end: "2026-11-01", limit: 10000, adjustment: "split", feed: "sip" });
  const b = r.bars?.[sym] ?? []; console.log(sym, b.length, b[0]?.t?.slice(0,10), b.at(-1)?.t?.slice(0,10), "more:", !!r.next_page_token); } catch(e:any){console.log(sym,"ERR",e.message)}
}
for (const types of ["cash_merger","stock_merger","name_change","worthless_removal","spin_off","stock_and_cash_merger","unit_split"]) {
  try { const r = await get("/v1/corporate-actions", { types, start: "2009-01-01", end: "2016-12-31", limit: 3, sort:"asc" });
  console.log(types, JSON.stringify(r.corporate_actions).slice(0,300)); } catch(e:any){console.log(types,"ERR",e.message.slice(0,200))}
}
