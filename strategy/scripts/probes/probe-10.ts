import { bars } from "../alpaca-data.ts";
const r = await bars(["CNR","CEIX","AAC","AACH","AACQ"], { timeframe: "1Day", start: "2020-04-01", end: "2020-04-03", adjustment: "split", feed: "sip" });
for (const [s,b] of Object.entries(r)) console.log(s, b.map((x:any)=>x.t.slice(0,10)+" o="+x.o+" v="+x.v).join(" | "));
const r2 = await bars(["CNR","CEIX"], { timeframe: "1Day", start: "2022-07-20", end: "2022-07-29", adjustment: "split", feed: "sip" });
for (const [s,b] of Object.entries(r2)) console.log(s, b.map((x:any)=>x.t.slice(0,10)+" c="+x.c).join(" | "));
