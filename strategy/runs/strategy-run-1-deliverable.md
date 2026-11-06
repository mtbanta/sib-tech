# Strategy run 1: how past bull market winners behaved, day by day

Written 2026-11-05 and 2026-11-06. This is research input for a human decision, never an instruction to act. **Nothing here is financial advice.** It describes stocks picked with hindsight; it tests no trading rule and recommends no strategy.

**Terms used.**

- **SEC:** U.S. Securities and Exchange Commission. **EDGAR:** its public filings database.
- **XBRL:** the tagged data inside filings. **SIC:** the SEC's Standard Industrial Classification code.
- **CUSIP:** the nine-character identifier of a security; its first six characters identify the issuer.
- **ADR:** American Depositary Receipt, a foreign company's shares traded in the U.S. **OTC:** over the counter, trading off the exchanges.
- **IPO:** initial public offering. **SPAC:** special purpose acquisition company, a listed cash shell (usually priced near 10 dollars) that later merges with a private company.
- **ETF:** exchange-traded fund. **SaaS:** software sold as a subscription service.
- **SPY and QQQ:** the funds that track the S&P 500 and the Nasdaq 100, used only as measuring sticks.
- **`sip` feed:** Alpaca's consolidated data from all U.S. exchanges. **IEX:** a single exchange, the source of Alpaca's free real-time feed.
- **Median:** the middle value when sorted. **Log returns:** returns measured as natural logarithms, so daily pieces add up exactly to the total.
- **CSV:** comma-separated values, a spreadsheet-readable file. **JSON:** a text data format. **GB:** gigabytes.

## 1. Summary

**What was found.** Stocks listed on Nasdaq or the NYSE that ended at 4 times their starting price or more, measured from each period's first open to its last close (rules in section 2; prices from Alpaca[^1], filings from the SEC[^7][^8]):

| Period | Window measured | 4x | 5x | 6x+ | Total | SPY multiple | QQQ multiple |
| :---- | :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| A, stand-in | 2016-01-04 to 2020-01-31 (period A asked from April 2009; no free data before 2016) | 50 | 38 | 63 | 151 | 1.60 | 2.00 |
| B | 2020-04-01 to 2022-01-31 | 137 | 77 | 140 | 354 | 1.81 | 1.96 |
| C | 2023-01-03 to 2025-02-28 | 57 | 22 | 46 | 125 | 1.55 | 1.89 |
| D | 2025-04-01 to 2026-10-01 | 55 | 36 | 73 | 164 | 1.37 | 1.59 |

**The most important findings.**

- **Winners did not rise on most days.** The median winner closed above its open on 49 to 51 percent of trading days in every period, and above the prior close on 50 to 52 percent[^1].
  - In periods A, B and C that is less often than SPY and QQQ (54 to 59 percent).
  - Only 2 to 10 percent of winners closed above their open on more than 55 percent of days.
  - This contradicts the starting premise that winners have "many more up days than down days".
- **They won on size, not frequency.** The median winner's average up day (close above open) was 2.2 to 3.9 percent and its average down day 2.0 to 3.3 percent. Only about 37 percent of up days were above the average up day: a minority of big days carried the gains.
- **Much of the gain came overnight.** By log returns, the median winner earned 84 percent of its gain between the close and the next open in period B, 59 percent in C, 55 percent in D and 57 percent in the A stand-in. In B, 90 percent of winners earned more than half their gain overnight, and 97 of 354 lost money during trading hours overall. A strategy that ends every day flat gives up the overnight part entirely.
- **The daily range is wide and nearly symmetric.** The median winner moved about 2 to 3.5 percent from open to close on an average day (SPY about 0.4 to 0.6 percent), and its high was on average about as far above the open (2.2 to 3.9 percent) as its low was below it (2.1 to 3.4 percent). The average day's net move from open to close was small by comparison: +0.12 to +0.37 percent.
- **They rarely rose against the market.** On days SPY closed down or flat, winners closed above their prior close only 37 to 39 percent of the time (QQQ: 37 to 41 percent).
- **Industries (SEC's labels, today's)[^7].** B is led by oil and gas producers (36 of 354); A by drug makers and software; C by drug makers and finance; D by drug makers (43 of 164) and semiconductors (22). SaaS and big tech, named in the brief for the 2010s, appear in the A stand-in (Shopify 18x, AMD 17x, The Trade Desk 11x).
- **Run 2 sizing (estimate).** 1 minute bars for every winner in B, C and D together: about 108 million rows at most, about 8.4 GB as CSV, about 11,300 requests, about 56 minutes at Alpaca's free limit (section 6).
- **Biggest caveats.**
  - Winners are picked with hindsight, and the A stand-in is not period A.
  - 122 winners have non-standard starts or ends; they are marked.
  - Survivorship gaps remain (section 3.3).

Research input for a human decision, never an instruction to act. Not financial advice.

## 2. Definitions and method

### 2.1 The periods as measured

| Period | Asked for | Measured | Why |
| :---- | :---- | :---- | :---- |
| A | First trading day of April 2009 to last trading day of January 2020 | **Stand-in window: 2016-01-04 open to 2020-01-31 close** | No free source reaches 2009 to 2015 (section 3). The stand-in is the part of period A that free data covers. Its counts are not comparable with B, C and D |
| B | April 2020 to January 2022 | First and last trading days taken from SPY's daily bars | |
| C | January 2023 to February 2025 | Same | |
| D | April 2025 to October 1, 2026 | Same | |

### 2.2 Who counts (the universe)

- **Listed on Nasdaq or the NYSE.** For a stock on today's exchange lists, its exchange is today's (Nasdaq Trader symbol directory[^3]). For a stock no longer listed, its exchange is the one named on its Form 25 (notice of removal from listing) at the SEC[^7]. If neither exists, the exchange is "unknown" and the stock is shown separately as a possible winner, exchange not confirmed.
- **Company stocks only.** Kept: common stock, ADRs (American Depositary Receipts, foreign companies' shares traded in the U.S., marked), real estate investment trusts and other operating trusts, and partnership common units (businesses organized as partnerships, marked).
- **Excluded:** funds and exchange-traded products (Nasdaq Trader's ETF flag, fund words in the name, or SEC fund filings N-CSR, N-2, N-1A or N-PORT); warrants, rights and units (by name, and Nasdaq's fifth letter W, R or U); preferred shares, notes and debentures (by name); SPAC shells before their merger; exchange test symbols.
- **No minimum price and no minimum volume.**
- **Russell 2000 members listed elsewhere (note only).** From iShares' Russell 2000 fund (IWM) holdings as of November 4, 2026[^6], the stocks held are on NASDAQ (1,193) and the NYSE (724), with 45 on NYSE American ("Nyse Mkt Llc"), 7 marked "no market (unlisted)", 2 on the OTC "Non-NMS Quotation Service" and 1 marked "TXE". So about 55 of 1,972 holdings (under 3 percent) are outside Nasdaq and the NYSE. This is today's membership only; the brief asks for membership during each period, which no free source found here gives.
- **How the universe was found.** No free source lists every Nasdaq and NYSE stock since 2016 including delisted ones. So every 1 to 4 letter symbol (475,254 strings), every 5 letter symbol in the SEC's fails-to-deliver files (19,949) and every symbol on today's Nasdaq Trader lists (198 more) was asked for monthly bars at Alpaca[^1]. A symbol with bars traded on an exchange; Alpaca's free data carries no over-the-counter stocks (checked on three, section 3).

### 2.3 Who is a winner, and from when

- **Gain** = last close divided by first open, on prices adjusted for splits but not for dividends (Alpaca's `adjustment=split`).
- **Groups:** 4x (at least 4, under 5), 5x (at least 5, under 6), 6x+ (6 or more). Under 4x is not a winner in this run.
- **Standard start:** the period's first open. **Standard end:** the period's last close.
- **New listing (IPO, spinoff, direct listing):** measured from the open on the trading day after the first earnings report.
  - The first earnings report is the first 8-K with item 2.02 (results of operations) accepted by the SEC on or after the first trading day[^7].
  - If there is none, the first 10-Q or 10-K filed after listing is used and flagged.
  - If neither exists (most foreign companies, which file 6-K reports without item numbers), the stock is measured from its first trading day and flagged "missing earnings date".
  - If the first report falls in the period's final three months, the stock is excluded and listed with the reason (`excluded.csv`).
- **SPAC merger:** the merger date is the SEC acceptance date of the 8-K with item 5.06 (change in shell company status). The earnings rule then runs from that date. Without this, Alpaca's habit of filing the shell's 10 dollar history under the merged company's symbol would create false winners.
- **Moved exchange (already public, for example from over the counter):** the company filed a 10-K, 10-Q, 20-F or 40-F more than 30 days before its first exchange trade, and did not merge with a shell. Measured from its first trading day on the exchange.
- **New shares after bankruptcy (borderline call):** treated as a new listing with the earnings rule, not as a move. Two tests: an 8-K with item 1.03 (bankruptcy) in the two years before the first trade; or, when Alpaca joins the old and new shares under one symbol, a new CUSIP (security identifier) with the same issuer code after a break of more than 20 days and a price jump of 3 times or more near the break. Old shares cancelled in a bankruptcy are a different security, so joining them would invent gains (CBL & Associates showed 140x before this rule).
- **Delisted or acquired:** measured to the last close. "Acquired" if, in the 18 months before the last trade, the company filed a merger proxy (DEFM14A, PREM14A, DEFM14C), a tender offer response (SC 14D9) or a going-private statement (SC 13E3), or was the subject of a tender offer (SC TO-T). Otherwise "delisted".
- **Marked as non-standard:** new listing, shell merger, missing earnings date, moved exchange, new shares, delisted, acquired. These rows carry a badge and a purple bar in the HTML.

### 2.4 The daily measures

A daily bar is the day's open, high, low, close and volume. Alpaca's daily bar covers the regular session only (9:30 AM to 4:00 PM Eastern): on three test days for three stocks, its high and low matched the regular-session minute bars and its open and close were the official auction prices[^1]. So pre-market and after-hours moves sit inside the overnight gap.

- **Open to close:** close minus open, in dollars and percent.
- **Overnight gap:** open divided by the prior close, minus 1.
- **Up day, two definitions:** close above that day's open; close above the prior day's close. A day exactly equal is counted as flat, neither up nor down.
- **Biggest rise from the open:** high minus open. **Biggest drop from the open:** open minus low. Both in dollars and percent of the open.
- **Average up-day gain**, under each definition, with how many up days were above that average and how many at or below it.
- **Overnight and intraday shares of the gain, by log returns.**
  - For the measured days 1 to N: intraday = the sum of ln(close / open) over days 1 to N; overnight = the sum of ln(open / prior close) over days 2 to N. The two add up exactly to ln(last close / first open).
  - Day 1's own gap happens before the first open, so it is in the daily file but not in the gain.
  - A share can be above 100 percent or below 0 when the other part is negative.
  - Ex-dividend drops land in the overnight part, because prices are not dividend-adjusted.
- **Benchmarks:** SPY and QQQ, for the S&P 500 and Nasdaq 100, on the same days. Reported: how often a winner closed above its prior close on days the benchmark closed down or flat, and the same with open to close.
- **Market cap:** shares outstanding from the cover page of the company's SEC filings (XBRL field `EntityCommonStockSharesOutstanding`, the report nearest the date, within 200 days)[^8], times the unadjusted close on that day[^1]. The share count is restated across any split between the two dates using the ratio of unadjusted to split-adjusted prices. Left blank for ADRs (the SEC share count is in the foreign company's ordinary shares, not ADRs) and where no share count exists; both flagged.
- **Industry:** the SEC's SIC (Standard Industrial Classification) description for the company today[^7]. Blank and flagged where the SEC has none.
- **Bars with zero volume are dropped.** Alpaca returns some days with volume 0 and a repeated price; no trade happened.

### 2.5 Duplicates and tickers that changed hands

- Alpaca files a company's whole history under the symbol it uses today[^1]. Its 2020 CNR bars are CONSOL Energy's (then CEIX), not Cornerstone Building Brands', which used CNR at the time. An old symbol can also return the same bars up to its change (SQ and XYZ for Block).
- So two symbols sharing 3 or more identical monthly bars are one history, and the one on today's lists (else the latest) is kept. A symbol on today's lists is treated as today's company.
- For a stock no longer listed, the company is found from the CUSIP in the SEC fails-to-deliver record nearest its last trade (within 365 days), using EDGAR full-text search[^9], then EDGAR name lookup. Its name in the output is the period-era description from the fails-to-deliver file (upper case, sometimes cut short); SEC's current name is in a separate column.

### 2.6 Rebuilding every number

One command, run from the repository root, rebuilds every CSV, `summary.json`, `summary-tables.md` and the HTML page from the cached raw data in `strategy/data/` (git-ignored):

```
sh strategy/scripts/rebuild.sh
```

- The steps are `01-fetch-lists.ts`, `02-fetch-monthly.ts`, `03-screen.ts`, `03b-ftd-index.ts`, `04-fetch-daily.ts`, `05-build.ts`, `07-sizing-audit.ts`, `06-outputs.ts` and `08-html.ts`, all in `strategy/scripts/`, run by Node 24 with no installed packages.
- A download step calls the network only when its cache file is missing. On a machine without the cache, it needs `strategy/.env.local` with the research login's Alpaca market data keys, and it downloads again, so today's lists (Nasdaq Trader, SEC tickers) may differ.
- The tables in section 4 are copied from `summary-tables.md` as generated on 2026-11-05; the numbers in section 1 were taken from `summary.json`.
- SEC answers of "not found" are not cached, so a rebuild repeats those few SEC requests (read-only).
- Facts measured once by hand (regular-session bars, history start dates, no OTC data, bytes per minute bar, SPY's March 2020 low) come from the probe scripts in `strategy/scripts/probes/`, listed in its README.

## 3. Data sources and coverage

### 3.1 Coverage table (free sources)

| Source | Daily history | 1 minute history | Delisted stocks | What it was used for | Limits |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Alpaca Market Data API, free plan, `sip` feed (all U.S. exchanges)[^1][^2] | From 2016-01-04 (measured; Alpaca states "Since 2016") | From 2016 (measured: first 1 minute bar 2016-01-01, overnight prints) | Yes (Twitter to 2022-10-27, Celgene, Bed Bath & Beyond under BBBYQ to 2023-05) | Every price in this run | 200 requests a minute; data in the latest 15 minutes withheld. No over-the-counter stocks (Tencent, Nestle and Roche ADRs: 0 bars) |
| Alpaca, `iex` feed[^1] | Patchy (SPY: one bar in 2018-11, then from 2020-07-27) | Same | n/a | Not used | Single exchange only |
| SEC fails-to-deliver files[^5] | Not a price source (only a prior-day close on days with fails, no open) | No | Yes, by symbol and CUSIP | Historical symbols, CUSIPs and names, July 2009 to 2026 (413 half-month files) | A stock with no fails in a half month is absent from it |
| SEC EDGAR submissions and company facts[^7][^8] | No prices | No | Yes, by company | Filings (earnings dates, shell mergers, bankruptcy, Form 25 exchange), industry code, shares outstanding | 10 requests a second (SEC's stated maximum)[^10]; this run stayed near 4 |
| EDGAR full-text and name search[^9] | No | No | Yes | Finding a delisted company's SEC number from its CUSIP or name | Name lookup knows current names only |
| Nasdaq Trader symbol directory[^3] | No | No | No (today only) | Today's exchange, ETF flag and test-issue flag | Today's list |
| SEC company tickers with exchange[^4] | No | No | No (today only) | Ticker to SEC number for listed stocks | Today's list |
| iShares IWM holdings[^6] | No | No | No (today only) | Russell 2000 note | Holdings as of Nov 04, 2026 only |
| Stooq daily download[^11] | Not reached | Not reached | Not reached | Dead end: a JavaScript proof-of-work page instead of data | Getting past it in bulk would mean posing as a browser, which the brief forbids |
| Yahoo Finance chart endpoint[^12] | Answers plain requests | n/a | Mostly dropped | Not used | Its terms forbid automated collection without prior permission |

**Bottom line on coverage.**

- **2016 on (periods B, C, D and the A stand-in):** free, consolidated, split-adjusted daily and 1 minute bars, including delisted stocks.
- **2009 to 2015 (the first seven years of period A):** no free source usable under the brief's rules. Period A as asked cannot be measured free.
- **No free source gives a list of every listed stock with its exchange on past dates.** This run rebuilt one from symbol strings (section 2.2), with the gaps in section 3.3.

### 3.2 Paid options (not bought; Michael decides)

Prices were read on the vendors' own pages on 2026-11-05 by a helper agent working under the brief's prohibitions (no forms, no accounts). "Published" means on the vendor's public page; "gated" means behind a login, a form or an interactive calculator that was not operated.

| Vendor and plan | Price | Label | What it would add | Source |
| :---- | :---- | :---- | :---- | :---- |
| FirstRate Data, Stocks Complete | 499.95 dollars one time (plus 199.95 for fundamentals); updates 59.95 a month | Published | 1 minute to daily bars, January 2000 to November 2026, about 9,333 liquid stocks plus over 7,000 delisted. Fills period A and run 2's minute bars before 2016 | [^13] |
| Kibot, Essentials bundle | 990 dollars one time (All Stocks at 1 minute alone: 3,000) | Published | 1 minute and daily bars for 18,000+ stocks, intraday from 1998; delisted coverage "driven by liquidity at the time of delisting" | [^14] |
| EODHD, Fundamentals or All-in-one | 59.99 or 99.99 dollars a month (EOD plus intraday plan 29.99) | Published | Daily 30+ years, U.S. 1 minute from 2004, delisted tickers keep history, historical market cap (Fundamentals and All-in-one) | [^15] |
| Massive (formerly Polygon.io), Stocks Advanced | 199 dollars a month (Developer, 10 years, 79) | Published | 20+ years, minute flat files from 2003-09-10, a ticker list by date with an active or delisted flag; delisted coverage in bars not stated | [^16] |
| Financial Modeling Prep, Premium | 69 dollars a month (49 billed yearly) | Published | 30+ years of daily data, 1 minute charts, delisted companies, historical market cap (Starter and up) | [^17] |
| Tiingo, Power | 30 dollars a month or 300 a year | Published | 30+ years of daily prices; delisted coverage not stated | [^18] |
| Alpha Vantage, Premium | 49.99 to 249.99 dollars a month | Published | Intraday since 2000-01; delisted coverage in bars not stated | [^19] |
| Intrinio, Individual | 150 dollars a month | Published | Daily 50+ years, minute bars; delisted not stated | [^20] |
| Databento | From 0.40 dollars a gigabyte; Standard 199 a month | Published | U.S. equities since 2018 only, so no help for 2009 | [^21] |
| Alpaca, Algo Trader Plus | 99 dollars a month | Published | Removes the 15 minute delay and raises the limit to 10,000 calls a minute; history still "Since 2016" | [^2] |
| Norgate Data, U.S. Stocks Platinum | Not read (calculator not operated) | Gated | Daily from 1990 with delisted stocks and historical index members; market cap current only | [^22] |
| Nasdaq Data Link, Sharadar SEP and SF1 | Login required | Gated | Daily from 1998 for 21,000+ active and delisted tickers; point-in-time fundamentals | [^23] |
| CRSP U.S. Stock Databases | Request form only | Gated | 36,000+ active and inactive securities; licensed to institutions | [^24] |

For market cap specifically, the paid sources that state historical market cap are EODHD (Fundamentals and up) and Financial Modeling Prep. This run's free method (SEC share counts times price) covers most U.S. filers but not ADRs.

### 3.3 Gaps and survivorship

Survivorship bias means missing the stocks that left the market, which flatters any study of winners. What this run can and cannot see:

- **Delisted and acquired stocks are included** where Alpaca still serves them, which it does for every case checked. In the final data, the winners include stocks marked delisted and acquired (counts in section 4).
- **Tickers later reused by another company.** Alpaca files history under today's holder of a symbol, so an earlier company's history under a reused ticker may be unreachable[^1].
  - Upper bound, per window: symbols whose fails-to-deliver CUSIP during the window has a different issuer code from the latest one, and whose latest CUSIP first appears after the window[^5]. A stand-in 1,636 (1,071 of those symbols have bars today); B 1,024 (626); C 523 (325); D 10 (5).
  - These counts include warrants, funds and OTC securities, so the number of hidden company stocks is lower, and the number of hidden winners is unknown.
  - Where a history ended before the reuse, this run does reach it and names the earlier company (L Brands under LB, for example).
- **"Delisted" can include a ticker change** that Alpaca did not carry to the new symbol (L Brands became Bath & Body Works in 2021 and is shown as delisted at its last LB close). The gain to that close is still correct.
- **Five letter delisted symbols with no fails** in any half month, and **delisted dotted share classes** (for example a class B share), were not asked for, because they are neither 1 to 4 letter combinations nor on today's lists. Most five letter Nasdaq symbols are warrants, rights, units or ADRs; the count of missed company stocks is unknown.
- **Exchange not confirmed.** Stocks that reached 4x but whose exchange could not be found (no Form 25, no current exchange at SEC; banks that file with bank regulators instead of the SEC fall here) are listed separately in `other-exchanges.csv` as "possible winner, exchange not confirmed", not counted as winners.
- **Exchange at the time.** A stock on today's lists is given today's exchange; a stock that moved from NYSE American to the NYSE (or the reverse) during a period may be misplaced.
- **Market cap** is blank for ADRs and where SEC has no share count within 200 days of the date.
- **Earnings dates** come from SEC filing acceptance times; a company that announced results by press release before filing its 8-K is dated by the filing.

## 4. Period sections

- Tables in this section are copied from `strategy-run-1-data/summary-tables.md`, which `scripts/06-outputs.ts` generates from Alpaca prices[^1], SEC filings[^7][^8] and the exchange lists[^3][^4].
- Medians are of the winners in each group; "pooled" shares count every winner-day together.
- Full lists: `period-<A|B|C|D>-winners.csv` (one row per winner) and `period-<A|B|C|D>-daily.csv` (one row per winner per day).
- Excluded stocks with reasons: `excluded.csv`. Stocks that reached 4x but are on other exchanges, or whose exchange is not confirmed: `other-exchanges.csv`.

### 4.1 Stand-in for period A: stand-in window January 4, 2016 to January 31, 2020 (period A asked: April 2009 to January 2020)

- **This is a stand-in, not period A.** Period A as asked starts in April 2009; free data starts on 2016-01-04 (section 3). Stocks that listed in late 2015 count as standard starts here.
- **Counts:** 50 at 4x, 38 at 5x, 63 at 6x+ (151 in all). Excluded after measurement: 40 (reasons in `excluded.csv`). Reached 4x on another exchange: 15; exchange not confirmed: 5 (BIMI, EBR, LUNA, NFEC, RADA).
- **Non-standard start or end:** 43 winners (new listing 24, missing earnings date 3, moved exchange 0, history starts late in Alpaca 4, new shares 0, delisted 3, acquired 14). Also marked: ADR 9, partnership units 0. Market cap blank for 41.


| Group | Winners | Median multiple | Non-standard start or end | Median share of days up (close above open) | Median share of days up (close above prior close) | Median overnight share of gain | Median intraday share of gain |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 50 | 4.45 | 12 | 50.5% | 51.4% | 59% | 41% |
| 5x | 38 | 5.42 | 10 | 50.0% | 52.1% | 48% | 52% |
| 6x+ | 63 | 7.74 | 21 | 50.3% | 51.2% | 60% | 40% |
| all | 151 | 5.56 | 43 | 50.3% | 51.6% | 57% | 43% |
| SPY (benchmark) | n/a | 1.60 | n/a | 53.8% | 55.2% | 65% | 35% |
| QQQ (benchmark) | n/a | 2.00 | n/a | 54.2% | 57.0% | 65% | 35% |

| Group | Median average up-day gain (close above open) | Median average down-day loss (close below open) | Median average up-day gain (close above prior close) | Median average down-day loss (close below prior close) | Median of mean daily open to close | Median of mean overnight gap |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 2.02% | -1.83% | 2.21% | -1.98% | 0.087% | 0.103% |
| 5x | 1.92% | -1.83% | 2.10% | -1.92% | 0.111% | 0.095% |
| 6x+ | 2.61% | -2.40% | 2.93% | -2.48% | 0.173% | 0.156% |
| all | 2.15% | -2.00% | 2.42% | -2.12% | 0.117% | 0.126% |

| Group | Median of mean daily move, open to close (either way) | Median of mean rise from open (high minus open) | Median of mean drop from open (open minus low) | Median average up-day gain (close above open) | Up days above that average (pooled) | Median average up-day gain (close above prior close) | Up days above that average (pooled) |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 1.90% | 2.00% | 1.94% | 2.02% | 37% | 2.21% | 35% |
| 5x | 1.83% | 1.96% | 1.94% | 1.92% | 38% | 2.10% | 36% |
| 6x+ | 2.44% | 2.55% | 2.47% | 2.61% | 37% | 2.93% | 35% |
| all | 2.02% | 2.17% | 2.11% | 2.15% | 37% | 2.42% | 35% |
| SPY (benchmark) | 0.43% | | | | | | |
| QQQ (benchmark) | 0.60% | | | | | | |

| Group | Winner rose (close above prior close) on days SPY fell or was flat | Same, QQQ | Winner rose open to close on days SPY fell or was flat open to close |
| :---- | ----: | ----: | ----: |
| 4x | 38% | 38% | 39% |
| 5x | 38% | 37% | 39% |
| 6x+ | 39% | 38% | 39% |
| all | 38% | 38% | 39% |

Daily open-to-close moves, all winners pooled (share of winner-days in each band):

| Band | below -10% | -10 to -5 | -5 to -3 | -3 to -2 | -2 to -1 | -1 to -0.5 | -0.5 to 0 | 0 to 0.5 | 0.5 to 1 | 1 to 2 | 2 to 3 | 3 to 5 | 5 to 10 | 10% and up |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 0.4% | 2.8% | 6.0% | 6.7% | 12.6% | 9.1% | 9.8% | 13.0% | 9.8% | 13.2% | 7.2% | 5.7% | 2.9% | 0.7% |
| 5x | 0.3% | 2.4% | 5.5% | 6.8% | 12.7% | 9.4% | 10.3% | 12.4% | 9.7% | 13.5% | 7.6% | 6.3% | 2.7% | 0.5% |
| 6x+ | 0.7% | 4.4% | 7.9% | 7.6% | 11.6% | 7.6% | 7.6% | 11.0% | 7.8% | 12.1% | 8.0% | 7.9% | 4.8% | 1.1% |
| all | 0.5% | 3.3% | 6.6% | 7.1% | 12.2% | 8.6% | 9.0% | 12.1% | 9.0% | 12.8% | 7.6% | 6.8% | 3.6% | 0.8% |

Top industries (SEC SIC description, today's label): Pharmaceutical Preparations (22); Services-Prepackaged Software (19); Services-Computer Programming, Data Processing, Etc. (6); Biological Products, (No Diagnostic Substances) (6); Semiconductors & Related Devices (5); Services-Business Services, NEC (5); Services-Computer Processing & Data Preparation (4); Surgical & Medical Instruments & Apparatus (4).

| Ticker | Company | Group | Multiple | Start | End | Exchange | Flags |
| :---- | :---- | :---- | ----: | :---- | :---- | :---- | :---- |
| GRVY | GRAVITY Co., Ltd. - American depositary  | 6x+ | 20.47 | 2016-01-04 | 2020-01-31 | Nasdaq | ADR; market cap missing |
| SHOP | Shopify Inc. - Class A Subordinate Votin | 6x+ | 18.28 | 2016-01-04 | 2020-01-31 | Nasdaq | market cap missing |
| CPXX | CELATOR PHARMACEUTICALS INC. C | 6x+ | 17.18 | 2016-01-04 | 2016-07-11 | Nasdaq | acquired; check: overnight price jump x4.85 on 2016-03-15 |
| AMD | Advanced Micro Devices, Inc. - Common St | 6x+ | 16.97 | 2016-01-04 | 2020-01-31 | Nasdaq |  |
| RETA | REATA PHARMACEUTICALS INC CL A | 6x+ | 13.61 | 2016-08-12 | 2020-01-31 | Nasdaq | new listing; market cap missing |
| GOL | GOL LINHAS AEREAS INTELIGENTES | 6x+ | 13.58 | 2016-01-04 | 2020-01-31 | NYSE | market cap missing |
| INS | INTELLIGENT SYSTEMS CORP (GA) | 6x+ | 12.13 | 2016-01-04 | 2020-01-31 | NYSE |  |
| TNDM | Tandem Diabetes Care, Inc. - Common Stoc | 6x+ | 11.18 | 2017-10-10 | 2020-01-31 | Nasdaq | history starts late in Alpaca (company was exchange-registered earlier; ticker change or data gap) |
| KEM | KEMET CORP NEW COM STK (DE) | 6x+ | 10.99 | 2016-01-04 | 2020-01-31 | NYSE |  |
| TTD | The Trade Desk, Inc. - Class A Common St | 6x+ | 10.76 | 2016-11-11 | 2020-01-31 | Nasdaq | new listing; market cap missing |
| EHTH | eHealth, Inc. - Common Stock | 6x+ | 10.72 | 2016-01-04 | 2020-01-31 | Nasdaq |  |
| EXAS | EXACT SCIENCES CORPORATION | 6x+ | 10.39 | 2016-01-04 | 2020-01-31 | Nasdaq |  |
| AMRN | Amarin Corporation plc - American Deposi | 6x+ | 9.97 | 2016-01-04 | 2020-01-31 | Nasdaq | ADR; check: overnight price jump x3.49 on 2018-09-24; market cap missing |
| ARQL | ARQULE INC | 6x+ | 9.22 | 2016-01-04 | 2020-01-15 | Nasdaq | acquired |
| ENPH | Enphase Energy, Inc. - Common Stock | 6x+ | 9.19 | 2016-01-04 | 2020-01-31 | Nasdaq |  |
| AXSM | Axsome Therapeutics, Inc. - Common Stock | 6x+ | 9.10 | 2016-01-04 | 2020-01-31 | Nasdaq |  |
| APPF | AppFolio, Inc. - Class A Common Stock | 6x+ | 9.05 | 2016-01-04 | 2020-01-31 | Nasdaq | market cap missing |
| SODA | SODASTREAM INTERNATIONAL LTD | 6x+ | 9.04 | 2016-01-04 | 2018-12-04 | Nasdaq | delisted; market cap missing |
| CIH | CHINA INDEX HLDGS LTD SPON ADS | 6x+ | 8.94 | 2019-06-12 | 2020-01-31 | Nasdaq | new listing; missing earnings date; ADR; market cap missing |
| RNG | RingCentral, Inc. Class A Common Stock | 6x+ | 8.90 | 2016-01-04 | 2020-01-31 | NYSE | market cap missing |
| AVXS | AVEXIS INC COM STK (DE) | 6x+ | 8.83 | 2016-03-17 | 2018-05-14 | Nasdaq | new listing; acquired |
| CYRX | CryoPort, Inc. - Common Stock | 6x+ | 8.82 | 2016-01-04 | 2020-01-31 | Nasdaq |  |
| CWST | Casella Waste Systems, Inc. - Class A Co | 6x+ | 8.68 | 2016-01-04 | 2020-01-31 | Nasdaq | market cap missing |
| PAYC | Paycom Software, Inc. Common Stock | 6x+ | 8.57 | 2016-01-04 | 2020-01-31 | NYSE |  |
| LOXO | LOXO ONCOLOGY INC COM STK | 6x+ | 8.48 | 2016-01-04 | 2019-02-14 | Nasdaq | acquired |

### 4.2 Period B: April 2020 to January 2022

- Period B starts six trading days after SPY's lowest close in the cached data (222.68 on 2020-03-23)[^1], so many winners started from deeply depressed prices; oil and gas producers are the largest industry group (36 of 354).
- **Counts:** 137 at 4x, 77 at 5x, 140 at 6x+ (354 in all). Excluded after measurement: 115 (reasons in `excluded.csv`). Reached 4x on another exchange: 24; exchange not confirmed: 19 (ACY, ALTM, ATTOF, CADE, DTEAF, LAZY, LPI, MTBL, OBLN, PLYA, SBNY, SICP, SPI, SPLP, SUNWQ, TRXC, TTM, USCR, YELLQ).
- **Non-standard start or end:** 41 winners (new listing 3, missing earnings date 1, moved exchange 0, history starts late in Alpaca 0, new shares 2, delisted 11, acquired 27). Also marked: ADR 7, partnership units 11. Market cap blank for 57.


| Group | Winners | Median multiple | Non-standard start or end | Median share of days up (close above open) | Median share of days up (close above prior close) | Median overnight share of gain | Median intraday share of gain |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 137 | 4.40 | 11 | 49.2% | 51.6% | 88% | 12% |
| 5x | 77 | 5.45 | 11 | 49.0% | 51.2% | 84% | 16% |
| 6x+ | 140 | 8.43 | 19 | 48.8% | 51.4% | 78% | 22% |
| all | 354 | 5.46 | 41 | 49.0% | 51.4% | 84% | 16% |
| SPY (benchmark) | n/a | 1.81 | n/a | 55.3% | 57.7% | 96% | 4% |
| QQQ (benchmark) | n/a | 1.96 | n/a | 56.4% | 59.4% | 86% | 14% |

| Group | Median average up-day gain (close above open) | Median average down-day loss (close below open) | Median average up-day gain (close above prior close) | Median average down-day loss (close below prior close) | Median of mean daily open to close | Median of mean overnight gap |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 2.75% | -2.60% | 3.26% | -2.76% | 0.119% | 0.321% |
| 5x | 3.15% | -2.86% | 3.70% | -2.97% | 0.133% | 0.359% |
| 6x+ | 3.80% | -3.24% | 4.35% | -3.33% | 0.224% | 0.437% |
| all | 3.29% | -2.92% | 3.83% | -3.06% | 0.151% | 0.371% |

| Group | Median of mean daily move, open to close (either way) | Median of mean rise from open (high minus open) | Median of mean drop from open (open minus low) | Median average up-day gain (close above open) | Up days above that average (pooled) | Median average up-day gain (close above prior close) | Up days above that average (pooled) |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 2.67% | 2.79% | 2.68% | 2.75% | 37% | 3.26% | 35% |
| 5x | 2.98% | 3.09% | 3.05% | 3.15% | 37% | 3.70% | 35% |
| 6x+ | 3.50% | 3.85% | 3.46% | 3.80% | 37% | 4.35% | 34% |
| all | 3.03% | 3.26% | 3.12% | 3.29% | 37% | 3.83% | 35% |
| SPY (benchmark) | 0.62% | | | | | | |
| QQQ (benchmark) | 0.87% | | | | | | |

| Group | Winner rose (close above prior close) on days SPY fell or was flat | Same, QQQ | Winner rose open to close on days SPY fell or was flat open to close |
| :---- | ----: | ----: | ----: |
| 4x | 36% | 40% | 38% |
| 5x | 36% | 41% | 37% |
| 6x+ | 37% | 42% | 38% |
| all | 37% | 41% | 38% |

Daily open-to-close moves, all winners pooled (share of winner-days in each band):

| Band | below -10% | -10 to -5 | -5 to -3 | -3 to -2 | -2 to -1 | -1 to -0.5 | -0.5 to 0 | 0 to 0.5 | 0.5 to 1 | 1 to 2 | 2 to 3 | 3 to 5 | 5 to 10 | 10% and up |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 1.0% | 6.3% | 9.3% | 8.0% | 11.3% | 6.7% | 6.9% | 8.3% | 6.6% | 10.8% | 7.6% | 9.1% | 6.3% | 1.7% |
| 5x | 1.4% | 7.2% | 10.1% | 8.3% | 10.9% | 6.2% | 5.9% | 7.1% | 5.9% | 10.2% | 7.7% | 9.7% | 7.0% | 2.3% |
| 6x+ | 1.9% | 8.8% | 10.5% | 8.1% | 9.9% | 5.6% | 5.0% | 6.3% | 5.3% | 9.2% | 7.4% | 9.8% | 8.9% | 3.3% |
| all | 1.4% | 7.5% | 9.9% | 8.1% | 10.7% | 6.1% | 5.9% | 7.3% | 6.0% | 10.0% | 7.6% | 9.5% | 7.5% | 2.5% |

Top industries (SEC SIC description, today's label): Crude Petroleum & Natural Gas (36); Pharmaceutical Preparations (12); Semiconductors & Related Devices (11); Services-Prepackaged Software (8); Biological Products, (No Diagnostic Substances) (7); Metal Mining (7); Retail-Eating  Places (7); Finance Services (6).

| Ticker | Company | Group | Multiple | Start | End | Exchange | Flags |
| :---- | :---- | :---- | ----: | :---- | :---- | :---- | :---- |
| MARA | MARA Holdings, Inc. - Common Stock | 6x+ | 51.17 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| GME | GameStop Corporation Common Stock | 6x+ | 31.57 | 2020-04-01 | 2022-01-31 | NYSE |  |
| PR | Permian Resources Corporation Class A Co | 6x+ | 29.87 | 2020-04-01 | 2022-01-31 | NYSE |  |
| SM | SM Energy Company Common Stock | 6x+ | 28.28 | 2020-04-01 | 2022-01-31 | NYSE |  |
| AR | Antero Resources Corporation Common Stoc | 6x+ | 28.10 | 2020-04-01 | 2022-01-31 | NYSE |  |
| AMR | Alpha Metallurgical Resources, Inc. Comm | 6x+ | 26.46 | 2020-04-01 | 2022-01-31 | NYSE |  |
| DAC | Danaos Corporation Common Stock | 6x+ | 24.21 | 2020-04-01 | 2022-01-31 | NYSE |  |
| KIRK | KIRKLANDS INC | 6x+ | 21.99 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| ALTO | Alto Ingredients, Inc. - Common Stock | 6x+ | 20.63 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| MVIS | MicroVision, Inc. - Common Stock | 6x+ | 19.76 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| HOME | AT HOME GROUP INC COM (DE) | 6x+ | 19.57 | 2020-04-01 | 2021-07-22 | NYSE | acquired |
| MTDR | Matador Resources Company Common Stock | 6x+ | 19.47 | 2020-04-01 | 2022-01-31 | NYSE |  |
| RIOT | Riot Platforms, Inc. - Common Stock | 6x+ | 19.20 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| CLDX | Celldex Therapeutics, Inc. - Common Stoc | 6x+ | 19.14 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| BGFV | BIG 5 SPORTING GOODS CORP | 6x+ | 18.75 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| AMTX | Aemetis, Inc - Common Stock | 6x+ | 17.30 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| FPRX | FIVE PRIME THERAPEUTICS INC | 6x+ | 16.81 | 2020-04-01 | 2021-04-15 | Nasdaq | acquired; check: overnight price jump x4.22 on 2020-11-11 |
| ESEA | Euroseas Ltd. - Common Stock | 6x+ | 15.00 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| OVV | Ovintiv Inc. (DE) | 6x+ | 14.59 | 2020-04-01 | 2022-01-31 | NYSE |  |
| BXC | Bluelinx Holdings Inc. Common Stock | 6x+ | 14.41 | 2020-04-01 | 2022-01-31 | NYSE |  |
| MWK | MOHAWK GROUP HLDGS INC COM | 6x+ | 14.33 | 2020-04-01 | 2021-04-29 | Nasdaq | delisted |
| SIG | Signet Jewelers Limited Common Shares | 6x+ | 14.31 | 2020-04-01 | 2022-01-31 | NYSE |  |
| MIK | MICHAELS COS INC COM STK (DE) | 6x+ | 14.17 | 2020-04-01 | 2021-04-14 | Nasdaq | acquired |
| HBP | HUTTIG BUILDING PRODS INC | 6x+ | 13.91 | 2020-04-01 | 2022-01-31 | Nasdaq |  |
| CAR | Avis Budget Group, Inc. - Common Stock | 6x+ | 13.83 | 2020-04-01 | 2022-01-31 | Nasdaq |  |

### 4.3 Period C: January 2023 to February 2025

- The strongest C winners include Carvana (48.5x), Root (30.9x), AppLovin (30.1x), MicroStrategy (17.5x) and Palantir (12.9x).
- **Counts:** 57 at 4x, 22 at 5x, 46 at 6x+ (125 in all). Excluded after measurement: 127 (reasons in `excluded.csv`). Reached 4x on another exchange: 4; exchange not confirmed: 3 (AMAM, GMVWF, MOR).
- **Non-standard start or end:** 18 winners (new listing 3, missing earnings date 2, moved exchange 1, history starts late in Alpaca 1, new shares 0, delisted 2, acquired 11). Also marked: ADR 14, partnership units 1. Market cap blank for 40.


| Group | Winners | Median multiple | Non-standard start or end | Median share of days up (close above open) | Median share of days up (close above prior close) | Median overnight share of gain | Median intraday share of gain |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 57 | 4.44 | 7 | 49.2% | 50.0% | 75% | 25% |
| 5x | 22 | 5.46 | 2 | 51.3% | 51.0% | 53% | 47% |
| 6x+ | 46 | 7.70 | 9 | 49.2% | 50.1% | 58% | 42% |
| all | 125 | 5.14 | 18 | 49.5% | 50.1% | 59% | 41% |
| SPY (benchmark) | n/a | 1.55 | n/a | 56.2% | 57.3% | 59% | 41% |
| QQQ (benchmark) | n/a | 1.89 | n/a | 55.6% | 57.3% | 62% | 38% |

| Group | Median average up-day gain (close above open) | Median average down-day loss (close below open) | Median average up-day gain (close above prior close) | Median average down-day loss (close below prior close) | Median of mean daily open to close | Median of mean overnight gap |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 3.02% | -2.83% | 3.57% | -2.89% | 0.149% | 0.254% |
| 5x | 2.97% | -2.61% | 3.17% | -2.68% | 0.232% | 0.185% |
| 6x+ | 4.07% | -3.41% | 4.53% | -3.53% | 0.226% | 0.329% |
| all | 3.26% | -2.93% | 3.76% | -2.99% | 0.196% | 0.254% |

| Group | Median of mean daily move, open to close (either way) | Median of mean rise from open (high minus open) | Median of mean drop from open (open minus low) | Median average up-day gain (close above open) | Up days above that average (pooled) | Median average up-day gain (close above prior close) | Up days above that average (pooled) |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 2.87% | 3.06% | 3.01% | 3.02% | 37% | 3.57% | 34% |
| 5x | 2.69% | 2.92% | 2.69% | 2.97% | 38% | 3.17% | 36% |
| 6x+ | 3.60% | 3.93% | 3.54% | 4.07% | 36% | 4.53% | 34% |
| all | 2.95% | 3.27% | 3.01% | 3.26% | 37% | 3.76% | 35% |
| SPY (benchmark) | 0.51% | | | | | | |
| QQQ (benchmark) | 0.72% | | | | | | |

| Group | Winner rose (close above prior close) on days SPY fell or was flat | Same, QQQ | Winner rose open to close on days SPY fell or was flat open to close |
| :---- | ----: | ----: | ----: |
| 4x | 38% | 40% | 39% |
| 5x | 37% | 39% | 39% |
| 6x+ | 35% | 36% | 37% |
| all | 37% | 38% | 38% |

Daily open-to-close moves, all winners pooled (share of winner-days in each band):

| Band | below -10% | -10 to -5 | -5 to -3 | -3 to -2 | -2 to -1 | -1 to -0.5 | -0.5 to 0 | 0 to 0.5 | 0.5 to 1 | 1 to 2 | 2 to 3 | 3 to 5 | 5 to 10 | 10% and up |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 1.3% | 6.5% | 8.9% | 7.8% | 10.9% | 6.7% | 6.3% | 8.8% | 6.7% | 10.8% | 7.5% | 8.6% | 6.8% | 2.3% |
| 5x | 0.7% | 5.4% | 8.3% | 7.8% | 11.5% | 7.1% | 6.1% | 8.5% | 7.3% | 11.3% | 8.7% | 9.1% | 6.5% | 1.6% |
| 6x+ | 2.4% | 8.7% | 10.3% | 7.9% | 9.3% | 5.6% | 5.5% | 7.2% | 5.2% | 9.2% | 7.0% | 9.1% | 8.4% | 4.1% |
| all | 1.6% | 7.1% | 9.3% | 7.8% | 10.4% | 6.4% | 6.0% | 8.2% | 6.3% | 10.3% | 7.6% | 8.9% | 7.4% | 2.8% |

Top industries (SEC SIC description, today's label): Pharmaceutical Preparations (20); Finance Services (13); Services-Prepackaged Software (7); Biological Products, (No Diagnostic Substances) (5); Fire, Marine & Casualty Insurance (4); Surgical & Medical Instruments & Apparatus (4); Commercial Banks, NEC (4); Services-Computer Programming, Data Processing, Etc. (3).

| Ticker | Company | Group | Multiple | Start | End | Exchange | Flags |
| :---- | :---- | :---- | ----: | :---- | :---- | :---- | :---- |
| CVNA | Carvana Co. Class A Common Stock | 6x+ | 48.46 | 2023-01-03 | 2025-02-28 | NYSE | market cap missing |
| ROOT | Root, Inc. - Common Stock | 6x+ | 30.86 | 2023-01-03 | 2025-02-28 | Nasdaq | market cap missing |
| APP | Applovin Corporation - Class A Common St | 6x+ | 30.13 | 2023-01-03 | 2025-02-28 | Nasdaq | market cap missing |
| SLNO | SOLENO THERAPEUTICS INC COM PA | 6x+ | 23.36 | 2023-01-03 | 2025-02-28 | Nasdaq | check: overnight price jump x4.74 on 2023-09-26 |
| LBPH | LONGBOARD PHARMACEUTICALS INC | 6x+ | 17.67 | 2023-01-03 | 2024-11-29 | Nasdaq | acquired; check: overnight price jump x3.06 on 2024-01-02 |
| MSTR | Strategy Inc - Class A Common Stock | 6x+ | 17.53 | 2023-01-03 | 2025-02-28 | Nasdaq | market cap missing |
| INOD | Innodata Inc. - Common Stock | 6x+ | 17.12 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| DGNX | Diginex Limited - Ordinary Shares | 6x+ | 16.13 | 2025-01-22 | 2025-02-28 | Nasdaq | new listing; missing earnings date |
| SEZL | Sezzle Inc. - Common Stock | 6x+ | 13.21 | 2023-08-17 | 2025-02-28 | Nasdaq | moved exchange; check: overnight price jump x0.27 on 2023-09-14 |
| PLTR | Palantir Technologies Inc. - Class A Com | 6x+ | 12.91 | 2023-01-03 | 2025-02-28 | Nasdaq | market cap missing |
| KINS | Kingstone Companies, Inc - Common Stock | 6x+ | 12.17 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| WGS | GeneDx Holdings Corp. - Class A Common S | 6x+ | 11.54 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| RGTI | Rigetti Computing, Inc.  - Common stock | 6x+ | 11.28 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| AAOI | Applied Optoelectronics, Inc. - Common S | 6x+ | 11.27 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| ACIC | American Coastal Insurance Corporation - | 6x+ | 11.14 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| DAVE | Dave Inc.  - Class A Common Stock | 6x+ | 10.85 | 2023-01-03 | 2025-02-28 | Nasdaq | market cap missing |
| DRUG | Bright Minds Biosciences Inc. - common s | 6x+ | 9.62 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| CLS | Celestica, Inc. Common Stock | 6x+ | 9.46 | 2023-01-03 | 2025-02-28 | NYSE | market cap missing |
| NPCE | Neuropace, Inc. - Common Stock | 6x+ | 9.38 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| ALPN | ALPINE IMMUNE SCIENCES INC | 6x+ | 8.83 | 2023-01-03 | 2024-05-17 | Nasdaq | acquired |
| NVDA | NVIDIA Corporation - Common Stock | 6x+ | 8.41 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| LMB | Limbach Holdings, Inc. - Common Stock | 6x+ | 7.99 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| ATGL | Alpha Technology Group Limited - Class A | 6x+ | 7.82 | 2023-10-31 | 2025-02-28 | Nasdaq | new listing; missing earnings date |
| FTAI | FTAI Aviation Ltd. - Common Stock | 6x+ | 7.57 | 2023-01-03 | 2025-02-28 | Nasdaq |  |
| SPOT | Spotify Technology S.A. Ordinary Shares | 6x+ | 7.43 | 2023-01-03 | 2025-02-28 | NYSE |  |

### 4.4 Period D: April 2025 to October 1, 2026

- D ends on October 1, 2026, at its close. Its leaders include AXT (58.9x), Sandisk (37.6x), Kodiak Sciences (35.3x) and Lumentum (16.9x); drug makers (43) and semiconductors (22) are the largest industry groups.
- **Counts:** 55 at 4x, 36 at 5x, 73 at 6x+ (164 in all). Excluded after measurement: 74 (reasons in `excluded.csv`). Reached 4x on another exchange: 6; exchange not confirmed: 2 (NWTN, QMMM).
- **Non-standard start or end:** 20 winners (new listing 4, missing earnings date 4, moved exchange 0, history starts late in Alpaca 0, new shares 0, delisted 6, acquired 12). Also marked: ADR 6, partnership units 0. Market cap blank for 34.


| Group | Winners | Median multiple | Non-standard start or end | Median share of days up (close above open) | Median share of days up (close above prior close) | Median overnight share of gain | Median intraday share of gain |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 55 | 4.36 | 6 | 51.1% | 51.3% | 55% | 45% |
| 5x | 36 | 5.35 | 2 | 49.5% | 50.8% | 53% | 47% |
| 6x+ | 73 | 7.74 | 12 | 52.0% | 51.8% | 55% | 45% |
| all | 164 | 5.55 | 20 | 51.1% | 51.3% | 55% | 45% |
| SPY (benchmark) | n/a | 1.37 | n/a | 50.8% | 54.5% | 55% | 45% |
| QQQ (benchmark) | n/a | 1.59 | n/a | 52.4% | 56.9% | 59% | 41% |

| Group | Median average up-day gain (close above open) | Median average down-day loss (close below open) | Median average up-day gain (close above prior close) | Median average down-day loss (close below prior close) | Median of mean daily open to close | Median of mean overnight gap |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 3.41% | -3.03% | 4.17% | -3.25% | 0.305% | 0.261% |
| 5x | 3.88% | -3.13% | 4.46% | -3.39% | 0.342% | 0.312% |
| 6x+ | 4.41% | -3.67% | 5.15% | -3.88% | 0.503% | 0.360% |
| all | 3.91% | -3.26% | 4.60% | -3.53% | 0.373% | 0.319% |

| Group | Median of mean daily move, open to close (either way) | Median of mean rise from open (high minus open) | Median of mean drop from open (open minus low) | Median average up-day gain (close above open) | Up days above that average (pooled) | Median average up-day gain (close above prior close) | Up days above that average (pooled) |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 3.12% | 3.49% | 3.02% | 3.41% | 37% | 4.17% | 35% |
| 5x | 3.51% | 3.72% | 3.31% | 3.88% | 37% | 4.46% | 35% |
| 6x+ | 4.04% | 4.37% | 3.61% | 4.41% | 36% | 5.15% | 33% |
| all | 3.52% | 3.85% | 3.36% | 3.91% | 36% | 4.60% | 34% |
| SPY (benchmark) | 0.54% | | | | | | |
| QQQ (benchmark) | 0.73% | | | | | | |

| Group | Winner rose (close above prior close) on days SPY fell or was flat | Same, QQQ | Winner rose open to close on days SPY fell or was flat open to close |
| :---- | ----: | ----: | ----: |
| 4x | 38% | 37% | 41% |
| 5x | 36% | 35% | 39% |
| 6x+ | 40% | 39% | 42% |
| all | 39% | 37% | 41% |

Daily open-to-close moves, all winners pooled (share of winner-days in each band):

| Band | below -10% | -10 to -5 | -5 to -3 | -3 to -2 | -2 to -1 | -1 to -0.5 | -0.5 to 0 | 0 to 0.5 | 0.5 to 1 | 1 to 2 | 2 to 3 | 3 to 5 | 5 to 10 | 10% and up |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 4x | 1.4% | 7.1% | 9.2% | 7.6% | 10.1% | 6.4% | 5.8% | 7.5% | 6.3% | 10.7% | 7.4% | 10.1% | 7.7% | 2.7% |
| 5x | 1.9% | 8.5% | 9.7% | 7.5% | 9.7% | 6.0% | 5.5% | 6.7% | 5.4% | 9.4% | 7.6% | 9.0% | 9.3% | 3.8% |
| 6x+ | 2.7% | 9.3% | 10.0% | 7.2% | 8.8% | 4.9% | 4.7% | 6.3% | 5.0% | 8.8% | 7.0% | 9.8% | 10.4% | 5.0% |
| all | 2.1% | 8.4% | 9.7% | 7.4% | 9.5% | 5.6% | 5.2% | 6.8% | 5.5% | 9.6% | 7.3% | 9.7% | 9.3% | 3.9% |

Top industries (SEC SIC description, today's label): Pharmaceutical Preparations (43); Semiconductors & Related Devices (22); Biological Products, (No Diagnostic Substances) (12); Finance Services (12); Instruments For Meas & Testing of  Electricity & Elec Signals (5); Services-Medical Laboratories (4); Computer Storage Devices (3); Services-Computer Programming, Data Processing, Etc. (3).

| Ticker | Company | Group | Multiple | Start | End | Exchange | Flags |
| :---- | :---- | :---- | ----: | :---- | :---- | :---- | :---- |
| AXTI | AXT Inc - Common Stock | 6x+ | 58.86 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| SNDK | Sandisk Corporation - Common Stock When- | 6x+ | 37.60 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| KOD | Kodiak Sciences Inc - Common Stock | 6x+ | 35.29 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| MGRT | Mega Fortune Company Limited - Ordinary  | 6x+ | 26.40 | 2025-07-16 | 2026-10-01 | Nasdaq | new listing; missing earnings date; market cap missing |
| TERN | TERNS PHARMACEUTICALS INC COM | 6x+ | 19.25 | 2025-04-01 | 2026-05-04 | Nasdaq | acquired |
| TNGX | Tango Therapeutics, Inc. - Common Stock | 6x+ | 17.98 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| LITE | Lumentum Holdings Inc. - Common Stock | 6x+ | 16.86 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| KDLY | KINDLY MD INC COM(UT) | 6x+ | 15.89 | 2025-04-01 | 2025-05-22 | Nasdaq | delisted; check: overnight price jump x7.31 on 2025-05-12 |
| JNVR | JANOVER INC COM NEW COM PAR $0 | 6x+ | 15.25 | 2025-04-01 | 2025-05-02 | Nasdaq | delisted; check: overnight price jump x3.57 on 2025-04-07 |
| ABVX | Abivax SA - American Depositary Shares | 6x+ | 15.19 | 2025-04-01 | 2026-10-01 | Nasdaq | ADR; check: overnight price jump x6.31 on 2025-07-23; market cap missing |
| SLGL | Sol-Gel Technologies Ltd. - Ordinary Sha | 6x+ | 14.04 | 2025-04-01 | 2026-10-01 | Nasdaq | market cap missing |
| BE | Bloom Energy Corporation Class A Common  | 6x+ | 13.98 | 2025-04-01 | 2026-10-01 | NYSE |  |
| AEHR | Aehr Test Systems - Common Stock | 6x+ | 13.90 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| RLMD | Relmada Therapeutics, Inc. - Common Stoc | 6x+ | 13.65 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| MU | Micron Technology, Inc. - Common Stock | 6x+ | 12.40 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| VTYX | VENTYX BIOSCIENCES INC | 6x+ | 12.07 | 2025-04-01 | 2026-03-03 | Nasdaq | acquired |
| XMAX | XMAX, Inc. - Common Stock | 6x+ | 12.06 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| ANRO | Alto Neuroscience, Inc. Common Stock | 6x+ | 11.72 | 2025-04-01 | 2026-10-01 | NYSE |  |
| WDC | Western Digital Corporation - Common Sto | 6x+ | 11.54 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| STX | Seagate Technology Holdings PLC - Ordina | 6x+ | 11.18 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| ROMA | Roma Green Finance Limited - Class A Ord | 6x+ | 11.08 | 2025-04-01 | 2026-10-01 | Nasdaq | market cap missing |
| ERAS | Erasca, Inc. - Common Stock | 6x+ | 10.80 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| NBIS | Nebius Group N.V. - Class A Ordinary Sha | 6x+ | 10.72 | 2025-04-01 | 2026-10-01 | Nasdaq | market cap missing |
| SLS | SELLAS Life Sciences Group, Inc.  - Comm | 6x+ | 10.49 | 2025-04-01 | 2026-10-01 | Nasdaq |  |
| CDTX | CIDARA THERAPEUTICS INC COM NE | 6x+ | 10.35 | 2025-04-01 | 2026-01-06 | Nasdaq | acquired |

## 5. Across the periods

**The same in every period** (from the tables in section 4, built on Alpaca prices[^1]).

- The median winner closed up on about half its days (49 to 51 percent close above open, 50 to 52 percent close above prior close), never clearly more.
- About 37 percent of up days were above the average up day: gains came from a minority of large days.
- A winner's average up day was larger than its average down day, but only by about 0.15 to 0.65 percentage points.
- The median winner's average open-to-close move was about 5 to 6.5 times SPY's, and its high and low sat at about equal distances from the open.
- Winners rose on only 37 to 39 percent of the days SPY fell or was flat.
- 6x+ winners moved more each day than 4x winners, in both directions.

**What differs.**

- **Where the gain came from.** Overnight share of the median winner: B 84 percent, C 59, A stand-in 57, D 55. Period B began right after the March 2020 crash, when the market as a whole also gained mostly overnight (SPY 96 percent overnight in B). In C and D, winners' split matched SPY's (59 and 55 percent).
- **How many.** B had the most winners (354 in 22 months), C the fewest (125 in 26 months). The A stand-in's 151 cover 4 years, so they are not comparable.
- **Industries[^7]:** B, oil and gas producers; A stand-in, drug makers and software; C, drug makers and finance; D, drug makers and semiconductors.
- **Volatility.** The median daily move grew from about 2.0 percent in the A stand-in to about 3.5 percent in D.
- **Market cap.** Many winners started small. Market caps are in the winners files where SEC data allowed (blank for 34 to 57 winners per period, mostly ADRs and companies with several share classes).

## 6. Run 2 sizing: 1 minute bars (estimates)

- Every figure here is an estimate.
- Rows are an upper bound: every winner's measured days times 390 regular-session minutes (many small stocks do not trade every minute).
- Size uses 110 bytes per bar as Alpaca returns it and 78 bytes as CSV, measured on 391 AAPL bars on 2026-11-05[^1].
- Requests assume 10,000 bars a page, one symbol at a time; time assumes Alpaca's free limit of 200 requests a minute[^2].

| Period | Group | Winners | Winner-days | Rows (upper bound) | Size as CSV | Size as Alpaca JSON | Requests | Minutes at 200 a minute |
| :---- | :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| A stand-in | 4x | 50 | 45,748 | 17,841,720 | 1.39 GB | 1.96 GB | 1,823 | 9 |
| A stand-in | 5x | 38 | 35,257 | 13,750,230 | 1.07 GB | 1.51 GB | 1,404 | 7 |
| A stand-in | 6x+ | 63 | 55,166 | 21,514,740 | 1.68 GB | 2.37 GB | 2,199 | 11 |
| A stand-in | all | 151 | 136,171 | 53,106,690 | 4.14 GB | 5.84 GB | 5,426 | 27 |
| B | 4x | 137 | 61,524 | 23,994,360 | 1.87 GB | 2.64 GB | 2,518 | 13 |
| B | 5x | 77 | 33,631 | 13,116,090 | 1.02 GB | 1.44 GB | 1,379 | 7 |
| B | 6x+ | 140 | 61,603 | 24,025,170 | 1.87 GB | 2.64 GB | 2,526 | 13 |
| B | all | 354 | 156,758 | 61,135,620 | 4.77 GB | 6.72 GB | 6,423 | 32 |
| C | 4x | 57 | 28,555 | 11,136,450 | 0.87 GB | 1.23 GB | 1,162 | 6 |
| C | 5x | 22 | 11,473 | 4,474,470 | 0.35 GB | 0.49 GB | 465 | 2 |
| C | 6x+ | 46 | 23,061 | 8,993,790 | 0.70 GB | 0.99 GB | 937 | 5 |
| C | all | 125 | 63,089 | 24,604,710 | 1.92 GB | 2.71 GB | 2,564 | 13 |
| D | 4x | 55 | 19,311 | 7,531,290 | 0.59 GB | 0.83 GB | 770 | 4 |
| D | 5x | 36 | 13,258 | 5,170,620 | 0.40 GB | 0.57 GB | 527 | 3 |
| D | 6x+ | 73 | 25,168 | 9,815,520 | 0.77 GB | 1.08 GB | 1,003 | 5 |
| D | all | 164 | 57,737 | 22,517,430 | 1.76 GB | 2.48 GB | 2,300 | 12 |

- **Free coverage:** Alpaca's free 1 minute bars start in 2016, so all of B, C, D and the A stand-in are free. Period A from 2009 needs a paid source (section 3.2; FirstRate 499.95 dollars one time, or Kibot 990, are the published one-time options with delisted stocks).
- **Disk:** the whole run 2 pull for B, C and D is roughly 8.4 GB as CSV; compressed it would be several times smaller (estimate, not measured).

## 7. What would undercut the idea

The idea: winners rise on many more days than they fall, so buying and selling them many times a day for small gains, flat every night, should profit. What in this data argues against it:

1. **Winners did not rise on most days.** Up and down days were close to even (section 1). A per-day edge from "up days outnumber down days" is not present in these daily bars.
2. **Much of the gain is overnight.** In B the median winner earned 84 percent of its gain while the market was closed; 97 of 354 B winners lost money during trading hours overall. Ending every day flat forfeits that part. In C and D the split was nearer even (about 55 to 59 percent overnight).
3. **The net daily drift is small next to the noise and the costs.** The average day's open-to-close gain was +0.12 to +0.37 percent on stocks that swing about 3 percent from the open either way. This stack's own paper trading measured trading costs of about 0.27 percent of each round trip's value on a fast placeholder strategy[^25]; many trades a day at a cost of that size would consume the drift several times over. (That cost was measured on different stocks, at a different speed, on the free IEX feed; it is an indication, not a measurement for these stocks.)
4. **Wide, symmetric ranges.** The high was as far above the open as the low was below it. Small take-profits and tight stops would be hit about equally often on such paths; daily bars cannot tell which comes first, which is run 2's question.
5. **Hindsight.** Every stock here was chosen because it ended up 4x or more. On any given day during the period, nobody knew it would. A later run has to find them in real time, and the losers that looked the same at the start are not in this data.
6. **Not yet gathered.** Run 2's 1 minute bars could show a time-of-day pattern (for example, gains concentrated in the first or last half hour) that daily bars hide. That would weaken point 1. It would not change point 2.

**What would support the idea instead:** 1 minute bars showing that intraday rises come in repeatable, tradable runs larger than the round-trip cost, or that up moves inside the day are consistently larger or longer than down moves.

## 8. Open questions

1. **Period A from 2009.** Michael's call: buy a paid source (FirstRate 499.95 one time, Kibot 990 one time, EODHD or Massive monthly) or keep the 2016 stand-in.
2. **Time of day.** Where inside the day do winners' gains and losses happen? Run 2.
3. **Costs for these stocks.** What does a round trip cost in a typical winner (spread and slippage at the size Michael would trade)? Not measurable from daily bars.
4. **The 3x group.** Planned for a later run; its counts will be larger.
5. **Exchange not confirmed.** 29 stocks across the four windows reached 4x but their exchange could not be confirmed (`other-exchanges.csv`). Some (Cadence Bank, Signature Bank) are banks that file with bank regulators, not the SEC.
6. **Check flags.** 29 winners carry a "check: overnight price jump" flag (a one-night move of 3x to 10x). Most are real (trial results, squeezes), but some may be unadjusted splits.
7. **Late history.** A few winners' Alpaca history starts after their real listing (flag "history starts late in Alpaca"); their full-period gain is unknown from free data.
8. **Survivorship upper bound.** How many earlier companies' histories are hidden behind reused tickers (section 3.3)? A paid point-in-time source (Massive's ticker list by date, Sharadar) would settle it.

## 9. Sources

Every source was accessed on 2026-11-05 (U.S. Central time; some API calls ran after midnight UTC). Strength labels follow `runs/run-3-deliverable.md` section 5: A is primary (a regulator, an exchange, or the vendor's own documentation, pricing or terms, seen live), B reputable press, C commercial review sites, D forums and personal sites. Sources 13 to 24 were read by a helper agent under the brief's prohibitions.

| # | Source | URL | Accessed | Strength |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Alpaca Market Data API, historical stock bars (data host only; monthly, daily and 1 minute bars, `sip` and `iex` feeds, raw and split-adjusted), and its corporate actions endpoint | https://data.alpaca.markets/v2/stocks/bars | 2026-11-05 | A |
| 2 | Alpaca, About Market Data API (plans, "Since 2016", 200 calls a minute free, 10,000 paid, 99 dollars a month) | https://docs.alpaca.markets/docs/about-market-data-api | 2026-11-05 | A |
| 3 | Nasdaq Trader symbol directory: nasdaqlisted.txt and otherlisted.txt | https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt and https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt | 2026-11-05 | A |
| 4 | SEC company tickers with exchange | https://www.sec.gov/files/company_tickers_exchange.json | 2026-11-05 | A |
| 5 | SEC fails-to-deliver data page and its 413 half-month files, July 2009 to 2026 | https://www.sec.gov/data-research/sec-markets-data/fails-deliver-data | 2026-11-05 | A |
| 6 | iShares Russell 2000 ETF, holdings CSV (as of Nov 04, 2026) | https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/latest-holdings.csv | 2026-11-05 | A |
| 7 | SEC EDGAR submissions API (filings, 8-K items, SIC, Form 25 XML) | https://data.sec.gov/submissions/ | 2026-11-05 | A |
| 8 | SEC EDGAR XBRL company facts API (EntityCommonStockSharesOutstanding) | https://data.sec.gov/api/xbrl/companyfacts/ | 2026-11-05 | A |
| 9 | SEC EDGAR full-text search and company name lookup | https://efts.sec.gov/LATEST/search-index | 2026-11-05 | A |
| 10 | SEC, Accessing EDGAR Data ("Current max request rate: 10 requests/second") | https://www.sec.gov/os/accessing-edgar-data | 2026-11-05 | A |
| 11 | Stooq daily download (returned a JavaScript proof-of-work page) | https://stooq.com/q/d/l/?s=aapl.us&i=d | 2026-11-05 | A |
| 12 | Yahoo Terms of Service, section 2 (no automated collection without prior permission) | https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html | 2026-11-05 | A |
| 13 | FirstRate Data, Stocks Complete | https://firstratedata.com/b/22/stock-complete | 2026-11-05 | A |
| 14 | Kibot, buy page and FAQ | https://www.kibot.com/buy.aspx and https://www.kibot.com/faq.html | 2026-11-05 | A |
| 15 | EODHD pricing and historical data documentation | https://eodhd.com/pricing and https://eodhd.com/financial-apis/api-for-historical-data-and-volumes | 2026-11-05 | A |
| 16 | Massive (formerly Polygon.io) pricing, tickers and minute flat files documentation | https://massive.com/pricing , https://massive.com/docs/rest/stocks/tickers/all-tickers and https://massive.com/docs/flat-files/stocks/minute-aggregates | 2026-11-05 | A |
| 17 | Financial Modeling Prep pricing (personal use) | https://site.financialmodelingprep.com/developer/docs/pricing | 2026-11-05 | A |
| 18 | Tiingo pricing | https://www.tiingo.com/about/pricing | 2026-11-05 | A |
| 19 | Alpha Vantage premium | https://www.alphavantage.co/premium/ | 2026-11-05 | A |
| 20 | Intrinio pricing | https://intrinio.com/pricing | 2026-11-05 | A |
| 21 | Databento pricing and equities pages | https://databento.com/pricing and https://databento.com/equities | 2026-11-05 | A |
| 22 | Norgate Data packages and data content | https://norgatedata.com/stockmarketpackages.php and https://norgatedata.com/data-content-tables.php | 2026-11-05 | A (price gated) |
| 23 | Nasdaq Data Link, Sharadar SEP and SF1 | https://data.nasdaq.com/databases/SEP and https://data.nasdaq.com/databases/SF1 | 2026-11-05 | A (price gated) |
| 24 | CRSP U.S. Stock Databases (Morningstar Indexes) | https://indexes.morningstar.com/research-data-products/crsp-us-stock-databases | 2026-11-05 | A (price gated) |
| 25 | This repo: `PROJECT_STATE.md`, Current Stage, the Thursday 2026-11-05 entry ("Alpaca refused 15 percent of orders") and the Tuesday 2026-11-03 trading-cost figure in Next Steps ("about 0.27 percent of each round trip's value") | `PROJECT_STATE.md` | 2026-11-05 | A (own measurement on paper) |

[^1]: Source 1 in the table above.
[^2]: Source 2 in the table above.
[^3]: Source 3 in the table above.
[^4]: Source 4 in the table above.
[^5]: Source 5 in the table above.
[^6]: Source 6 in the table above.
[^7]: Source 7 in the table above.
[^8]: Source 8 in the table above.
[^9]: Source 9 in the table above.
[^10]: Source 10 in the table above.
[^11]: Source 11 in the table above.
[^12]: Source 12 in the table above.
[^13]: Source 13 in the table above.
[^14]: Source 14 in the table above.
[^15]: Source 15 in the table above.
[^16]: Source 16 in the table above.
[^17]: Source 17 in the table above.
[^18]: Source 18 in the table above.
[^19]: Source 19 in the table above.
[^20]: Source 20 in the table above.
[^21]: Source 21 in the table above.
[^22]: Source 22 in the table above.
[^23]: Source 23 in the table above.
[^24]: Source 24 in the table above.
[^25]: Source 25 in the table above.
