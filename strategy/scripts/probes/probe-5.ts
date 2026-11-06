import { bars } from "../alpaca-data.ts";
for (const day of ["2024-03-12","2021-06-15","2023-11-07"]) {
  for (const s of ["AAPL","NVDA","PLTR"]) {
    const d = (await bars([s], { timeframe: "1Day", start: day, end: day, adjustment: "raw", feed: "sip" }))[s]?.[0];
    const m = (await bars([s], { timeframe: "1Min", start: day+"T00:00:00Z", end: day+"T23:59:59Z", adjustment: "raw", feed: "sip" }))[s] ?? [];
    const et = (t:string)=> new Date(t).toLocaleTimeString("en-US",{timeZone:"America/New_York",hour12:false});
    const reg = m.filter(b=>{const x=et(b.t); return x>="09:30:00" && x<"16:00:00";});
    const hi = Math.max(...reg.map(b=>b.h)), lo = Math.min(...reg.map(b=>b.l));
    const hiAll = Math.max(...m.map(b=>b.h)), loAll = Math.min(...m.map(b=>b.l));
    console.log(day, s, "daily o/h/l/c", d.o, d.h, d.l, d.c, "| 9:30 open", reg[0]?.o, et(reg[0]?.t), "15:59 close", reg.at(-1)?.c, "| reg hi/lo", hi, lo, "| all-session hi/lo", hiAll, loAll, "first/last minute", et(m[0].t), et(m.at(-1).t));
  }
}
