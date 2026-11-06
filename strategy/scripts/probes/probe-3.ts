import { get } from "../alpaca-data.ts";
for (const y of [2015,2016,2017,2018,2019,2020,2021]) {
  const r = await get("/v1/corporate-actions", { types: "cash_merger,stock_merger,stock_and_cash_merger,worthless_removal,name_change", start: `${y}-01-01`, end: `${y}-03-31`, limit: 1000 });
  const ca = r.corporate_actions; console.log(y, Object.fromEntries(Object.entries(ca).map(([k,v]:any)=>[k,v.length])), "more:", !!r.next_page_token);
}
