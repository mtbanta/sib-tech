// Step 1: download the symbol lists. Raw files land in data/raw/lists and data/raw/ftd.
// Sources: Nasdaq Trader symbol directory (current listings), SEC company tickers with exchange,
// SEC fails-to-deliver files (historical symbols with CUSIP and description), twice a month.
import { join, basename } from "node:path";
import { DATA, cachedFetch } from "./common.ts";

const lists = join(DATA, "raw", "lists");
await cachedFetch("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", join(lists, "nasdaqlisted.txt"));
await cachedFetch("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", join(lists, "otherlisted.txt"));
await cachedFetch("https://www.sec.gov/files/company_tickers_exchange.json", join(lists, "company_tickers_exchange.json"));
// Russell 2000 note: iShares IWM holdings (today's holdings only).
await cachedFetch("https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/latest-holdings.csv", join(lists, "iwm-holdings.csv"));

// The SEC's fails-to-deliver page links every half-month file; download the ones from 2009 on.
const page = (await cachedFetch("https://www.sec.gov/data-research/sec-markets-data/fails-deliver-data", join(lists, "ftd-page.html"))).toString();
const links = [...new Set([...page.matchAll(/href="([^"]*cnsfails(\d{6})[ab]\.zip)"/g)].filter(m => m[2] >= "200901").map(m => m[1]))];
let n = 0;
for (const href of links) {
  const url = href.startsWith("http") ? href : "https://www.sec.gov" + href;
  await cachedFetch(url, join(DATA, "raw", "ftd", basename(href)), 300); n++;
}
console.log("FTD files linked from 2009 on:", links.length, "downloaded or cached:", n);
