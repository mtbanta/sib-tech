# Strategy run 3: bull market winners, revised, with 1 minute detail

Written 2026-11-21. This is research input for a human decision, never an instruction to act. **Nothing here is financial advice.** It describes stocks picked with hindsight; it tests no trading rule and recommends no strategy.

**Terms used.**

- **SEC:** U.S. Securities and Exchange Commission. **EDGAR:** its public filings database. **XBRL:** the tagged data inside filings.
- **SPAC:** special purpose acquisition company, a listed cash shell that later merges with a private company. **IPO:** initial public offering.
- **ADR:** American Depositary Receipt, a foreign company's shares traded in the U.S.; one ADR (or ADS, American Depositary Share) stands for a stated number of the company's own shares, its **ADR ratio**.
- **CUSIP:** the nine-character identifier of a security. **SIC:** the SEC's Standard Industrial Classification code.
- **SPY and QQQ:** the funds that track the S&P 500 and the Nasdaq 100, used only as measuring sticks.
- **Beta:** how much a stock's daily return moved with SPY's (1 = in step with SPY, 2 = twice as much). **Volatility:** how widely its daily returns spread (section 3.3).
- **Mean:** the average. **Median:** the middle value when sorted. **⚑:** the mean and the median differ a lot (section 3.4).
- **CT:** Central time. **ET:** Eastern time (always CT plus one hour).
- **Market cap:** shares outstanding times the share price. **B, T:** billion and trillion dollars.
- **`sip` feed:** Alpaca's consolidated data from all U.S. exchanges. **CSV:** a spreadsheet-readable file. **Log returns:** returns as natural logarithms, so pieces add up exactly.

## 1. Summary

**Counts after removing the flagged companies** (removed: A 33, B 67, C 24, D 31; `removed.csv`)[^1][^4][^7]:

| Period | 3x | 4x | 5x | 6x+ | All | Run 1's 4x and above | Run 3's 4x and above |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| A stand-in (2016-01-04 to 2020-01-31) | 147 | 46 | 34 | 51 | 278 | 151 | 131 |
| B (2020-04-01 to 2022-01-31) | 282 | 126 | 66 | 121 | 595 | 354 | 313 |
| C (2023-01-03 to 2025-02-28) | 99 | 51 | 20 | 38 | 208 | 125 | 109 |
| D (2025-04-01 to 2026-10-01) | 121 | 49 | 34 | 61 | 265 | 164 | 144 |

**Most important findings**

- **Winners rose on about half their days**, by mean and by median (close above open: 48.8 to 50.6 percent), as run 1 found[^1][^4]. The 3x group behaves like the others, with smaller daily moves.
- **Removing the flagged companies brings survivorship bias back**: what is left are companies still trading under the same listing at the end of each window. Michael accepted this. Most removals (105 of 155) were acquisitions[^4][^7].
- **Beta and volatility are high:** all winners' median beta 1.20 (A) to 1.48 (D); median volatility 43 to 84 percent a year. The 6x+ group was always the most volatile and the 3x group the least, but beta does not rise in order from group to group[^1].
- **Most winners started small:** 56 to 75 percent at up to 1B in market cap. Market caps are now known for all but 18 of 2,692 values, each with its source[^8][^11][^13].
- **Volume, Central time, all weekdays:** winners' volume drops off at about 9:11 to 9:22 AM and picks up at about 2:26 to 2:32 PM (each the middle of a window up to 30 minutes either side). SPY drops off later (9:22 to 9:37) and picks up a little earlier (2:17 to 2:25); QQQ drops off later still (9:42 to 10:08)[^1].
- **Weekdays change the volume times only a little** for winners: the pick up moves by 5 minutes or less across weekdays; the drop off by up to 17 minutes on the mean curve (29 on the median curve, period A), and Friday's drop off is the earliest in every period (mean curve). Friday also has the heaviest close[^1].
- **The close is where winners trade most:** 26 to 29 percent of a winner's daily volume falls in the last 30 minutes, 16 to 19 percent in the last 5 minutes with the closing auction, more than SPY or QQQ[^1][^15].
- **Gains and losses happen at the same times of day.** Average returns by 30 minute block are tiny (0.01 to 0.05 percent at best) and no block is best in every period[^1].
- **Costs:** run 1's 0.27 percent framing is dropped. Fees are fractions of a cent; the cost that matters is execution, not measured for these stocks (change 9)[^5].

**Rebuild every output** from the cached raw data (run from the repo folder): `sh strategy/scripts/r3-rebuild.sh`. It reuses cached downloads and only asks Alpaca or the SEC for anything not cached. It regenerates every CSV, `summary-tables.md` and the page; the tables in section 5 are copied from `summary-tables.md`, and the prose in the other sections was written by hand from those files.

Research input for a human decision, never an instruction to act. Not financial advice.

## 2. The nine changes, one at a time

Michael approved several changes in one run as an exception to the one change per run rule. Each is reported on its own here. Counts come from `change-effects.csv` and `removed.csv`.

**Run 1 reproduces first.** Run 3 reran run 1's method on run 1's cached data before changing anything. At 4x and above it finds exactly run 1's winners in every period, the same tickers with the same multiples: A stand-in 151, B 354, C 125, D 164[^4][^1]. So every difference below comes from a change, not from the data moving.

### 2.1 Change 1: flagged companies removed

- **What changed.** Every winner flagged shell (SPAC) merger, new shares after bankruptcy, missing earnings date, delisted or acquired is removed, and those flags no longer appear. The list with each company's flag is `removed.csv`.
- **Effect, 4x and above (run 1's groups):**

| Period | Run 1 | After removal | Removed |
| :---- | ----: | ----: | ----: |
| A stand-in | 151 | 131 | 20 |
| B | 354 | 313 | 41 |
| C | 125 | 109 | 16 |
| D | 164 | 144 | 20 |

- **Removed across all four groups (3x included), by flag** (a company can carry more than one flag, so rows can add up to more than the total):

| Period | Removed in all | Shell merger | New shares after bankruptcy | Missing earnings date | Delisted | Acquired |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| A stand-in | 33 | 0 | 0 | 5 | 3 | 25 |
| B | 67 | 1 | 3 | 1 | 18 | 44 |
| C | 24 | 1 | 1 | 2 | 3 | 17 |
| D | 31 | 0 | 1 | 7 | 7 | 19 |

- **Survivorship bias, stated plainly.** Removing delisted and acquired companies brings back the bias run 1 worked to reduce: the winners left are those still trading at the end of each window under the same listing. Companies bought out at a high price, and companies that rose and then collapsed into delisting, are no longer counted.
  - Michael accepted this bias. Any comparison with a study that keeps them must allow for it.
- Most removals are acquisitions (105 of 155 across the periods), so the lost group is mainly companies bought at a gain, not failures.

### 2.2 Change 2: the 3x group added

- **What changed.** A 3x group (at least 3, under 4) in every period, with every run 1 rule, including change 1. The monthly screen was rerun at 3x, which added 972 (A), 1,191 (B), 817 (C) and 970 (D) candidate symbols; their daily bars were downloaded from Alpaca[^1].
- **Effect:** the 3x group is the largest in every period: A 147, B 282, C 99, D 121 (after removal). It roughly doubles the winner count: A 131 to 278, B 313 to 595, C 109 to 208, D 144 to 265.
- 3x winners moved less each day than 4x winners in every period (median daily move, open to close either way: A 1.47 against 1.87 percent, B 2.27 against 2.67, C 2.26 against 2.80, D 2.67 against 3.12) and had lower volatility in every period. Their beta was lower in B and D (median 1.38 against 1.50; 1.32 against 1.58) and about the same in A and C (section 5).

### 2.3 Change 3: means as well as medians

- **What changed.** Every measure run 1 summarized by a median now also has a mean. The page has a mean or median switch (mean by default) and a ⚑ on values where the two differ a lot (rule in section 3.4).
- **Effect.**
  - **Share of days up:** mean and median within about 1 point of each other in every group and period (for all winners, close above open: A 50.6 and 50.9 percent, B 48.8 and 49.0, C 49.1 and 49.2, D 50.6 and 51.1). Run 1's main finding holds with means: winners rose on about half their days.
  - **Multiple:** the mean is above the median in every period (all winners: A 4.79 against 3.89, B 5.36 against 4.09, C 5.34 against 4.07, D 5.50 against 4.17), pulled up by a few very large winners.
  - **Overnight share of the gain:** the mean is far from the median in several groups (for example A 4x: 73 percent mean, 59 median; C 5x: 34 mean, 49 median). A few winners with a large loss during trading hours (overnight share above 100 percent) or a large intraday gain move the mean.
  - **Volatility:** the mean is above the median everywhere (all winners, annualized: A 52 against 43 percent, B 82 against 69, C 88 against 71, D 100 against 84), and is flagged in several groups.

### 2.4 Change 4: beta and volatility

- **What changed.** Per winner over its measured window: beta against SPY and volatility, both from daily close to close returns (section 3.3). Columns `beta_vs_spy`, `volatility_daily_pct` and `volatility_annualized_pct` in the winners files.
- **Effect (all winners, median):** beta A 1.20, B 1.47, C 1.38, D 1.48; annualized volatility A 43 percent, B 69, C 71, D 84. Within each period, beta and volatility rise from the 3x to the 6x+ group in most cases (for example D: volatility median 72 percent at 3x, 105 at 6x+).

### 2.5 Change 5: market cap filled further, with bands

- **What changed.** Two new free SEC methods (the filing's cover page for companies with several share classes; the ADR ratio for ADRs), further research in SEC filings by hand for what remained, and bands at start and end (section 3.5). Every value's method, URL and access date is in `market-cap-sources.csv`.
- **Effect:** run 1 left the market cap blank for 41 (A), 57 (B), 40 (C) and 34 (D) of its 4x and above winners[^4]. In run 3, among the 4x and above winners left after change 1, a start or end value is unknown for 2 (A), 2 (B), 0 (C) and 1 (D); across all run 3 winners (3x included) for 2, 3, 1 and 4.
  - Of all 2,692 values (start and end, every winner): SEC company facts 2,173 (run 1's method); filing cover pages 319; ADR ratio from SEC filings 61; share counts found by further research in SEC filings 121; unknown 18.
  - Most winners started small: the share starting at up to 1B was A 56 percent (155 of 278), B 75 percent (444 of 595), C 68 percent (142 of 208), D 60 percent (159 of 265). By the end most were over 1B.

### 2.6 Change 6: 1 minute bars

- **What changed.** 1 minute bars for every run 3 winner over its measured window, and for SPY and QQQ over each whole period, from Alpaca's free history[^1].
- **Effect:** 1,354 files, one per winner per period plus SPY and QQQ in each period: 22,001 requests to Alpaca's market data host, 213,308,689 bars, no failed file[^1].
  - Every winner has minute bars from the first day of its measured window; no history starts late (section 4.3).
  - The bars are what changes 7 and 8 are built on. They do not change any daily number in this report, which still comes from daily bars as in run 1.

### 2.7 Change 7: gains by time of day

- **What changed.** From the minute bars, each winner's average return in every 5 minute slice of the regular session, with means and medians across winners, and where in the day all rises and all falls happened (section 3.7). Times in Central time.
- **Effect:** (all weekdays, all winners; tables in section 5)
  - **Movement bunches at the open, direction does not.** The first 30 minutes (8:30 to 9:00 CT) hold about 16 to 17 percent of all the winners' rises, and the same share of all their falls, in every period. In every 30 minute block the share of rises and the share of falls are within 0.3 points of each other.
  - **Average returns by block are tiny.** The best 30 minute block in each period averages 0.01 to 0.05 percent (mean across winners): A 10:30 to 11:00 CT, B 10:30 to 11:00, C 10:00 to 10:30, D 8:30 to 9:00. These are averages of log returns over hundreds of days, far smaller than one day's typical move of 2 to 3 percent.
  - **No block is better in every period.** The first 30 minutes were a loss in B (mean minus 0.026 percent, median minus 0.012) and the best block in D. The last 30 minutes were a loss in B (minus 0.030 percent) and a gain in D (plus 0.041).
  - Means and medians agree in sign in 48 of the 52 blocks (13 blocks in 4 periods); the 30 minute tables show both.

### 2.8 Change 8: volume by time of day

- **What changed.** Each 5 minute slice's share of the day's volume for winners, SPY and QQQ, on full trading days, for every weekday separately, with drop off and pick up times in Central time (section 3.8).
- **Effect:** (all weekdays; times are Central; each time is the middle of a window that may run up to 30 minutes either side)
  - **Drop off** (all winners, mean curve, median curve in brackets): A 9:11 (9:07), B 9:14 (9:11), C 9:21 (9:17), D 9:22 (9:19). SPY: 9:22, 9:37, 9:35, 9:33. QQQ: 9:42, 10:01, 9:59, 10:08.
  - SPY's and QQQ's drop off differs more between the mean and the median curve (up to 53 minutes) than the winners' (up to 15), so treat their drop off times as rougher.
  - **Pick up:** winners A 14:26 (14:27), B 14:31 (14:31), C 14:30 (14:30), D 14:32 (14:31). SPY: 14:23, 14:17, 14:25, 14:24. QQQ: 14:32, 14:33, 14:34, 14:38.
  - **The close matters more for winners.** The last 30 minutes, including the closing auction, hold 26 to 29 percent of a winner's day (mean), against 22 to 24 percent for SPY and 15 to 18 percent for QQQ. The last 5 minutes alone hold 16 to 19 percent for winners, 11 to 13 for SPY, 7 to 9 for QQQ.
  - **The open matters about as much as for SPY.** The first 30 minutes hold about 11 to 12 percent for winners and SPY (10.5 to 12.0), and about 14 to 15 percent for QQQ (13.7 to 15.0).
  - **Weekdays.**
    - Winners' pick up moves by 5 minutes or less across weekdays. Their drop off moves more: up to 17 minutes on the mean curve and 29 on the median curve (both period A), with Friday earliest in every period on the mean curve.
    - Friday has the largest closing share in every period (winners' last 30 minutes 28 to 32 percent).
    - SPY's pick up is earliest on Wednesday in every period (mean curve 14:04 to 14:19); this report does not test why.

### 2.9 Change 9: costs

- **What changed.** Run 1 compared the winners' small daily drift with a 0.27 percent trading cost. That framing is dropped.
- **What run 2 found instead**[^5]:
  - Regulatory fees on a trade are fractions of a cent per share: the SEC fee is 0.0000206 times the dollars sold, the FINRA trading activity fee is 0 until 2026-12-31 (then 0.000195 dollars a share sold, at most 9.79 a trade), and the CAT fee is 0.000003 dollars a share on both sides. Retail commission at Alpaca is 0.
  - The 0.27 percent was never a fee. It was the paper stack's execution cost on one day: crossing the spread, prices from a lagging free feed, and stops that slipped, on a deliberately meaningless placeholder strategy.
  - So it does not carry over to these stocks. The execution cost of trading these winners (their spreads and slippage at Michael's size) is not measured anywhere in this repo and is an open question (section 8).

## 3. Definitions and method

### 3.1 Unchanged from run 1

- **Periods, universe, winner rule, start and end rules, prices, up days, benchmarks, industry labels:** exactly run 1's (its section 2)[^4]. Prices are adjusted for splits, not dividends.
- **Gain** = last close divided by first open over the measured window. **Groups:** 3x (at least 3, under 4), 4x, 5x, 6x+.
- **Run 1's code, run again.** Run 3's build step (`r3-05-build.ts`) is a copy of run 1's `05-build.ts` with four edits: the 3x threshold, the 3x group, beta and volatility, and new file locations. The monthly screen is run 1's at a 3x threshold. Run 1's cached data is reused; only the new 3x candidates were downloaded.

### 3.2 Removed companies (change 1)

- A winner is removed if any of its run 1 flags is one of: shell (SPAC) merger; new shares after bankruptcy; missing earnings date; delisted; acquired.
- **"New shares after bankruptcy" covers all three of run 1's new shares forms:** an 8-K bankruptcy filing (item 1.03) within two years before the first trade; a new security identifier (CUSIP) from the same issuer after a trading break with a price jump; and a one-night price break of 10x or more (run 1 measured these from the break as new shares). Run 1's section 2.3 files all three under this heading. Each removed row in `removed.csv` keeps run 1's exact flag text, so this choice can be reversed.
- Removal happens after measurement, so a removed company does not make room for anyone else.

### 3.3 Beta and volatility (change 4)

- **Returns:** daily close to close, split adjusted, over the winner's measured window.
- **Beta** = covariance of the stock's daily returns with SPY's, divided by the variance of SPY's daily returns, on the same days. A return is used only when the stock's previous bar is SPY's previous trading day; a return that spans a trading halt or a missing day is dropped, not compounded. At least 20 paired days are required, else blank.
- **Volatility** = the sample standard deviation of the same daily returns. Reported **daily** and **annualized** (daily times the square root of 252, the usual trading days in a year). Tables show the annualized figure unless they say daily.

### 3.4 Means, medians and the "differs a lot" flag (change 3)

- Every per-winner measure that run 1 summarized by its median across winners is now also summarized by its mean across winners.
- Pooled shares (for example "up days above the average up day", "rose on days SPY fell") count every winner-day together, as in run 1; they are one number, not a median, so they have no mean twin.
- **The flag (⚑).** A mean and a median "differ a lot" when both of these hold:
  - the gap between them is more than **25 percent of the larger** of the two (in absolute value); and
  - the gap is more than a **floor** for that kind of measure: multiple 0.25; share of days 2 percentage points; overnight or intraday share of gain 10 percentage points; daily percent moves 0.10 percentage points; beta 0.2; daily volatility 0.5 percentage points; annualized volatility 8 percentage points.
- Why two tests: a relative test alone flags almost every value near zero (for example a mean daily move of 0.1 percent against a median of 0.05 percent), and an absolute test alone ignores scale.

### 3.5 Market cap (change 5)

Market cap on a date = shares outstanding near that date times the unadjusted close that day[^1]. Methods, tried in order:

1. **Run 1's method:** the SEC's company facts, field `EntityCommonStockSharesOutstanding`, the report nearest the date within 200 days[^8].
2. **The filing's own cover page:** the XBRL cover page (`R1.htm`) of the periodic report (10-K, 10-Q, 20-F or 40-F) filed nearest the date, within 200 days, or 400 days for companies that report only once a year (20-F and 40-F filers)[^11]. Every "Entity Common Stock, Shares Outstanding" value on it is added, so all share classes count; the price is the listed class's.
   - This fills most companies with two share classes, which the company facts leave out.
3. **ADRs:** the same cover page's ordinary share count divided by the ADR ratio stated in its "Title of 12(b) Security" line (for example "each representing two ordinary shares"), else the ratio from the nearest filing that states one (noted per value), times the ADR's unadjusted close.
4. **Further research** for what remains: share counts read by hand from the company's SEC filings, each value with its URL, access date and quoted text in `market-cap-sources.csv`[^13], times Alpaca's unadjusted close that day.
   - Financial sites such as Yahoo Finance were not used: Yahoo's terms forbid automated collection[^12], and every gap was filled from SEC filings instead. Else **"unknown"**.

- Share counts are restated across any split between the count's date and the price's date, as in run 1.
- Run 1's consistency check still applies: if (end cap divided by start cap) divided by the price multiple is above 20 or below 0.05, both values are set to unknown.
- **Bands** (start and end separately): up to 1B; over 1B to 10B; over 10B to 50B; over 50B to 100B; over 100B to 250B; over 250B to 1T; over 1T; unknown. B = billion dollars, T = trillion.
- **Rule for several share classes:** all classes are added and valued at the listed class's price. For companies whose second class does not trade or carries different economic rights (for example "Up-C" structures), this is an approximation.

### 3.6 One minute bars (change 6)

- Source: Alpaca's historical bars, free plan, `sip` (consolidated) feed, split adjusted, timeframe 1Min, market data host only[^1].
- Pulled for every run 3 winner over its own measured window, and for SPY and QQQ over each whole period.
- **Regular session** = bars stamped 9:30 to 15:59 Eastern (8:30 AM to 2:59 PM Central); a bar's time is the start of its minute.
- **The 16:00 Eastern bar** (3:00 PM Central) holds the closing auction prints (section 4.3). It is counted in the last slice's volume, not in prices.
- **Full trading days:** a day is a half day (early close at 1:00 PM Eastern, noon Central) when **both** of these hold for SPY's own minute bars[^1]:
  - fewer than 390 bars from 9:30 to 15:59 Eastern (SPY trades in every regular minute of a full day: 2,385 of 2,409 days had all 390); and
  - volume from 13:01 to 15:59 Eastern under 50 percent of its volume from 9:30 to 12:59 (after an early close only extended-hours trading continues).
- Why both: on the 24 days with fewer than 390 bars, the 4 full days had afternoon ratios of 0.74 to 1.01 and the 20 early closes 0.03 to 0.40. A day with all 390 bars can still have a ratio as low as 0.39 (2025-07-16), so neither test separates them alone. Every figure here is printed by `node scripts/probes/r3-probe-2-half-days.ts` (run from `strategy/`)[^1].
- Half days found: A 9, B 3, C 5, D 3 (listed per period in section 5). They are excluded from every time of day measure. Alpaca's market calendar was not used because it is on the trading host, which this run does not call.
- Times are converted with an explicit America/New_York time zone. Central time is always Eastern minus one hour, so every time below is Central.

### 3.7 Gains by time of day (change 7)

- **Time slices:** 5 minutes, 78 per day, 8:30 AM to 3:00 PM Central. The markdown shows 30 minute blocks; the CSVs hold every 5 minute slice.
- **Slice return:** for each winner-day, the natural log of the last trade price in the slice divided by the last trade price before it (for the first slice, the first minute bar's open). A slice with no trade has a return of 0. The 78 slice returns add up to the day's open to close move from minute bars.
- **Per winner:** the average of its slice return over its full trading days in the measured window. **Per group:** the mean and the median of those per-winner averages. SPY and QQQ: the mean and the median of the slice return across days.
- **Where gains and losses happen:** every winner-day's rises in each slice are added up, and each slice's share of all rises is reported; the same for falls.

### 3.8 Volume by time of day (change 8)

- **Share:** for each stock-day, each slice's volume divided by that stock's total regular-session volume that day (including the 16:00 Eastern closing auction bar in the last slice).
- **Days:** every full trading day in the period for SPY and QQQ; for a winner, its full trading days inside its measured window. Half days excluded. Each weekday (Monday to Friday) is also shown on its own.
- **Mean and median:** for winners, each stock's average share per slice over its days, then the mean and the median across stocks. For SPY and QQQ, the mean and the median across days.
- **Drop off and pick up, method:**
  - Smooth the curve with a centered 15 minute moving average (three 5 minute slices).
  - The reference level is an even spread: 1/78 of the day's volume per 5 minutes (about 1.28 percent).
  - **Drop off** = the first time after the open that the smoothed curve falls below the even level. **Pick up** = the last time before the close that it rises back above it. Each time is interpolated between slice midpoints.
  - Each reported time is roughly the middle of a window that may run up to 30 minutes either side, because the curve crosses the level gradually.

## 4. Data sources and coverage

### 4.1 Datasets used

| Dataset | Provider | Accessed | Used for |
| :---- | :---- | :---- | :---- |
| Monthly, daily and unadjusted daily bars, `sip` feed | Alpaca Market Data API, free plan, market data host only[^1][^2] | 2026-11-05 (run 1's cache) and 2026-11-21 (new 3x candidates, new market cap prices) | Every price and multiple |
| 1 minute bars, `sip` feed, split adjusted | Alpaca Market Data API[^1] | 2026-11-21 | Time of day (changes 6 to 8) |
| Today's exchange lists | Nasdaq Trader symbol directory[^3]; SEC company tickers with exchange[^14] | 2026-11-05 (run 1's cache) | Exchange, fund and test flags |
| Fails-to-deliver files | SEC[^6] | 2026-11-05 (run 1's cache) | Historical symbols and CUSIPs |
| Filings and industry codes | SEC EDGAR submissions[^7] | 2026-11-05 and 2026-11-21 | Earnings dates, shell mergers, bankruptcy, Form 25, SIC |
| Share counts | SEC XBRL company facts[^8]; filing cover pages and 20-F documents[^11] | 2026-11-05 and 2026-11-21 | Market cap |
| Share counts and ADR ratios found by further research, read by hand from SEC filings | SEC EDGAR filing documents, one URL per value in `market-cap-sources.csv`[^13] | 2026-11-21 | Market cap gaps |
| Trading costs | This repo's run 2 deliverable[^5] | 2026-11-21 | Change 9 |

### 4.2 What did not change from run 1

- The coverage limits of run 1's section 3 still apply[^4]: no free data before 2016 (so period A is a 2016 to 2020 stand-in), no free list of every past listing (rebuilt from symbol strings), tickers reused by another company can hide an earlier company's history, five letter delisted symbols without fails-to-deliver records were not asked for.
- **Survivorship:** change 1 removes the delisted and acquired winners that run 1 had kept (section 2.1). Run 3's winners are survivors by construction.

### 4.3 One minute bars: coverage

From `minute-coverage.csv` (one row per winner)[^1]:

| Period | Winners | Minute file missing | History starts late | Winners with days that have a daily bar but no regular-session minute bars | Those days | Full days used | Share of regular minutes with no trade, mean / median | Winners with no trade in over half their minutes |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| A stand-in | 278 | 0 | 0 | 11 | 84 | 268,931 | 36% / 35% | 84 |
| B | 595 | 0 | 0 | 12 | 21 | 273,079 | 35% / 31% | 183 |
| C | 208 | 0 | 0 | 4 | 30 | 110,517 | 39% / 35% | 81 |
| D | 265 | 0 | 0 | 3 | 4 | 99,044 | 28% / 20% | 63 |

- **Late history:** a winner's first minute bar falls after the first day of its measured window. None did.
- **Missing minutes:** a minute with no bar means no trade that minute (Alpaca sends no bar for a minute without trades). Thin stocks miss most minutes: the worst is TCI in A (98 percent of minutes without a trade). Their slice returns are 0 where nothing traded, and their volume shares are lumpy.
- **Days with a daily bar but no regular-session minute bars** (for example TCI 49 days in A, KEQU 14 in C) are left out of the time of day measures.
- SPY trades in every regular minute of a full day: 2,385 of 2,409 SPY days had all 390 bars; the rest are half days and 4 full days with a few missing minutes (counted by `scripts/probes/r3-probe-2-half-days.ts`). QQQ was not counted the same way.

### 4.4 Market cap gaps

- **Unknown: 18 of 2,692 values, 10 winners** (`market-cap-sources.csv`, method "unknown").
  - 16 are set unknown by run 1's consistency rule: the share count changed more than 20 times relative to the price multiple (B: PLL, NNDM, WULF; C: AHG; D: DMRA, FTH, TRON, CHRN). For WULF, DMRA, TRON and AHG the filings show real share issuance of that size; FTH and CHRN had reverse splits after the share count's date. The rule was kept unchanged from run 1 rather than tuned for these.
  - 2 are GOL and GGB in the A stand-in (start only): the traded ADS is a preferred share, so a common share count would mislabel the cap.
- **Approximations to know about.**
  - Several share classes are added at the listed class's price (section 3.5).
  - **Another SEC registrant's filings** for 19 values found by further research. Mostly predecessors, where the company reorganized (for example Apache before APA Corporation, Marvell Technology Group before Marvell Technology, Calumet's partnership before its corporation), because Alpaca files the whole price history under today's symbol[^1]. A few use the company that held the ticker at the time (Del Taco for TACO, Bazaarvoice for BV in 2016, RADA for DRS).
    - Each is named in the CSV's note; these three were not checked against the price series.
  - Unusual units: Cemex (CX) is counted in CPOs (certificates of two Series A and one Series B share, 10 per ADS); Volaris (VLRS) in Series A shares (10 per ADS); TAL's ratio is one third (three ADSs to a share); Petrobras (PBR) and Vale (VALE) count common shares only.
  - Some counts are up to about 9 months from the date (ASX, IMOS and JMIA at 2026-10-01 use counts from 2025-12-31).
- **Reproducibility.** SEC answers of "not found" or server errors are not cached, so a rebuild repeats those requests; on 2026-11-21 two cover page requests failed after retries on one rerun without changing any total.

### 4.5 Paid options

None was needed or bought. Run 1's section 3.2 lists the paid sources that would add data before 2016 and point-in-time market caps, with published prices[^4]; they were not re-checked in this run.

## 5. Period sections

- Tables below are copied from `strategy-run-3-data/summary-tables.md`, which `scripts/r3-09-outputs.ts` generates from Alpaca prices[^1], SEC filings[^7][^8][^11] and the exchange lists[^3][^14].
- "Mean" and "median" are across the winners in each group (each winner's own value first, then the mean or median of those). "Pooled" shares count every winner-day together.
- Full lists: `period-<A|B|C|D>-winners.csv` (one row per winner, with beta, volatility, market cap bands and their sources) and `period-<A|B|C|D>-daily.csv` (one row per winner per day; B's is gzip-compressed, `.csv.gz`, to stay under 50 MB).
- Time of day, every 5 minute slice: `period-<P>-gains-by-time.csv`, `period-<P>-volume-by-time.csv`, `volume-pickup-dropoff.csv`.

### 5.1 Stand-in for period A: January 4, 2016 to January 31, 2020 (period A asked: April 2009 to January 2020)

- **Winners:** 278 (3x 147, 4x 46, 5x 34, 6x+ 51) after removing 33. Period A asked for April 2009 onward; free data starts in 2016, so this is a stand-in[^2][^4].
- **Days:** winners rose on about half their days (close above open, mean 50.6 percent, median 50.9), against 53.8 percent for SPY. They moved less each day than in later periods (median daily move 1.68 percent) and had the lowest beta (median 1.20) and volatility (median 43 percent a year).
- **Market cap:** 155 of 278 started at up to 1B; 223 ended above 1B.
- **Time of day:** volume dropped off at 9:11 CT (median curve 9:07) and picked up at 14:26 (14:27), about 10 minutes before SPY's drop off and at about the same time as its pick up. Friday's winner drop off came earliest (8:57, median 8:42). 9 half days excluded.

Trading days measured: 2016-01-04 to 2020-01-31. Candidates from the 3x monthly screen: 2857; passed the daily pre-check: 692. Removed (change 1): 33.

| Group | Winners | Non-standard start | Multiple, mean | median | Share of days up (close above open), mean | median | Share of days up (close above prior close), mean | median | Overnight share of gain, mean | median | Intraday share of gain, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 147 | 9 | 3.39 | 3.33 | 51.0% | 51.1% | 52.4% | 52.6% | 63% | 56% | 37% | 44% |
| 4x | 46 | 8 | 4.42 | 4.45 | 49.8% | 50.5% | 51.3% | 51.4% | 73% | 59% | 27% ⚑ | 41% |
| 5x | 34 | 6 | 5.46 | 5.41 | 50.8% | 51.2% | 52.4% | 52.4% | 48% | 44% | 52% | 56% |
| 6x+ | 51 | 9 | 8.70 | 7.55 | 49.7% | 50.3% | 51.6% | 51.8% | 66% | 52% | 34% ⚑ | 48% |
| all | 278 | 32 | 4.79 | 3.89 | 50.6% | 50.9% | 52.1% | 52.3% | 63% | 55% | 37% | 45% |
| SPY (benchmark) | n/a | n/a | 1.60 | | 53.8% | | 55.2% | | 65% | | 35% | |
| QQQ (benchmark) | n/a | n/a | 2.00 | | 54.2% | | 57.0% | | 65% | | 35% | |

| Group | Average up-day gain (close above open), mean | median | Average down-day loss (close below open), mean | median | Average up-day gain (close above prior close), mean | median | Average down-day loss (close below prior close), mean | median | Mean daily open to close, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 1.68% | 1.54% | -1.62% | -1.46% | 1.88% | 1.65% | -1.75% | -1.61% | 0.08% | 0.07% |
| 4x | 2.14% | 1.96% | -1.94% | -1.80% | 2.40% | 2.15% | -2.03% | -1.95% | 0.10% | 0.09% |
| 5x | 2.13% | 1.90% | -1.84% | -1.81% | 2.41% | 2.00% | -1.96% | -1.92% | 0.18% | 0.11% |
| 6x+ | 2.59% | 2.44% | -2.34% | -2.31% | 2.86% | 2.73% | -2.44% | -2.45% | 0.17% | 0.16% |
| all | 1.98% | 1.75% | -1.83% | -1.70% | 2.21% | 1.92% | -1.95% | -1.84% | 0.11% | 0.09% |

| Group | Mean overnight gap, mean | median | Mean daily move, open to close (either way), mean | median | Mean rise from open (high minus open), mean | median | Mean drop from open (open minus low), mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 0.09% | 0.07% | 1.61% | 1.47% | 1.70% | 1.59% | 1.67% | 1.55% |
| 4x | 0.15% | 0.10% | 1.97% | 1.87% | 2.18% | 1.96% | 2.06% | 1.90% |
| 5x | 0.12% | 0.09% | 1.94% | 1.79% | 2.09% | 1.95% | 1.92% | 1.93% |
| 6x+ | 0.18% | 0.15% | 2.39% | 2.30% | 2.61% | 2.38% | 2.46% | 2.34% |
| all | 0.12% | 0.08% | 1.86% | 1.68% | 2.00% | 1.80% | 1.91% | 1.74% |
| SPY (benchmark) | | | 0.43% | | | | | |
| QQQ (benchmark) | | | 0.60% | | | | | |

| Group | Beta against SPY, mean | median | Volatility, daily, mean | median | Volatility, annualized, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 1.18 | 1.21 | 2.6% | 2.4% | 41.9% | 37.5% |
| 4x | 1.16 | 1.14 | 3.4% | 2.9% | 54.6% | 46.2% |
| 5x | 1.23 | 1.20 | 4.2% ⚑ | 2.8% | 67.3% ⚑ | 44.4% |
| 6x+ | 1.30 | 1.33 | 4.2% | 4.0% | 66.2% | 62.9% |
| all | 1.20 | 1.20 | 3.2% | 2.7% | 51.6% | 42.5% |

| Group | Up days above the average up day, close above open (pooled) | Same, close above prior close (pooled) | Winner rose (close above prior close) on days SPY fell or was flat | Same, QQQ | Winner rose open to close on days SPY fell or was flat open to close |
| :---- | ----: | ----: | ----: | ----: | ----: |
| 3x | 38% | 37% | 36% | 36% | 37% |
| 4x | 37% | 36% | 38% | 38% | 39% |
| 5x | 38% | 36% | 38% | 37% | 39% |
| 6x+ | 37% | 35% | 39% | 38% | 39% |
| all | 38% | 36% | 37% | 37% | 38% |

Market cap bands, number of winners (start / end):

| Group | up to 1B | over 1B to 10B | over 10B to 50B | over 50B to 100B | over 100B to 250B | over 250B to 1T | over 1T | unknown |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 61 / 22 | 68 / 82 | 14 / 26 | 0 / 9 | 1 / 4 | 3 / 1 | 0 / 3 | 0 / 0 |
| 4x | 32 / 14 | 13 / 23 | 0 / 9 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 1 / 0 |
| 5x | 20 / 9 | 14 / 15 | 0 / 10 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| 6x+ | 42 / 10 | 7 / 30 | 1 / 8 | 0 / 2 | 0 / 1 | 0 / 0 | 0 / 0 | 1 / 0 |
| all | 155 / 55 | 102 / 150 | 15 / 53 | 0 / 11 | 1 / 5 | 3 / 1 | 0 / 3 | 2 / 0 |

Daily open-to-close moves, all winners pooled (share of winner-days in each band):

| Band | below -10% | -10 to -5 | -5 to -3 | -3 to -2 | -2 to -1 | -1 to -0.5 | -0.5 to 0 | 0 to 0.5 | 0.5 to 1 | 1 to 2 | 2 to 3 | 3 to 5 | 5 to 10 | 10% and up |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 0.2% | 2.0% | 4.6% | 6.0% | 12.2% | 10.1% | 11.9% | 14.4% | 11.0% | 13.8% | 6.5% | 4.9% | 2.0% | 0.3% |
| 4x | 0.4% | 2.8% | 6.0% | 6.7% | 12.6% | 9.1% | 9.8% | 13.0% | 9.8% | 13.2% | 7.3% | 5.8% | 2.8% | 0.7% |
| 5x | 0.3% | 2.3% | 5.4% | 6.7% | 12.6% | 9.5% | 10.3% | 12.3% | 9.9% | 13.7% | 7.6% | 6.2% | 2.6% | 0.5% |
| 6x+ | 0.6% | 4.2% | 7.7% | 7.7% | 11.7% | 7.7% | 7.5% | 11.0% | 7.9% | 12.3% | 8.1% | 7.8% | 4.7% | 1.0% |
| all | 0.3% | 2.5% | 5.5% | 6.5% | 12.2% | 9.4% | 10.6% | 13.3% | 10.1% | 13.5% | 7.1% | 5.7% | 2.7% | 0.5% |

Top industries (SEC SIC description, today's label): Services-Prepackaged Software (34); Pharmaceutical Preparations (24); Surgical & Medical Instruments & Apparatus (12); Services-Business Services, NEC (12); Semiconductors & Related Devices (10); Biological Products, (No Diagnostic Substances) (7); Services-Computer Processing & Data Preparation (6); Services-Computer Programming, Data Processing, Etc. (5).

Gains by time of day, all weekdays, 30 minute blocks (Central time). Return = mean (or median) across winners of the winner's average log return in that block (SPY and QQQ: mean or median across days); gains and losses = share of all intraday rises (falls) that happened in the block, pooled.

| Block (CT) | 3x mean | 3x median | 4x mean | 4x median | 5x mean | 5x median | 6x+ mean | 6x+ median | all mean | all median | all: share of gains | all: share of losses | SPY mean | SPY median | QQQ mean | QQQ median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 8:30 to 9:00 | 0.007% | 0.004% | 0.012% | 0.020% | 0.021% | 0.024% | 0.016% | 0.013% | 0.011% | 0.009% | 16.2% | 16.3% | 0.008% | 0.019% | 0.014% | 0.027% |
| 9:00 to 9:30 | -0.004% | -0.000% | -0.003% | -0.001% | 0.016% | 0.009% | -0.005% | 0.004% | -0.002% | -0.000% | 10.5% | 10.6% | -0.002% | 0.011% | 0.000% | 0.021% |
| 9:30 to 10:00 | -0.006% | -0.004% | -0.004% | -0.006% | 0.005% | 0.002% | -0.012% | -0.012% | -0.005% | -0.005% | 8.7% | 8.8% | -0.005% | 0.003% | -0.006% | 0.010% |
| 10:00 to 10:30 | 0.008% | 0.009% | 0.010% | 0.008% | 0.013% | 0.008% | 0.013% | 0.013% | 0.010% | 0.009% | 7.9% | 7.9% | 0.007% | 0.013% | 0.010% | 0.015% |
| 10:30 to 11:00 | 0.010% | 0.008% | 0.011% | 0.007% | 0.010% | 0.011% | 0.022% | 0.019% | 0.013% | 0.010% | 7.1% | 7.1% | 0.005% | 0.009% | 0.003% | 0.005% |
| 11:00 to 11:30 | 0.006% | 0.004% | 0.007% | 0.005% | 0.012% | 0.011% | 0.001% | 0.003% | 0.006% | 0.005% | 6.4% | 6.4% | 0.002% | 0.006% | 0.001% | 0.007% |
| 11:30 to 12:00 | 0.005% | 0.005% | 0.008% | 0.011% | 0.008% | 0.007% | 0.001% | 0.005% | 0.005% | 0.006% | 6.0% | 6.0% | 0.004% | 0.007% | 0.003% | 0.003% |
| 12:00 to 12:30 | -0.006% | -0.007% | -0.004% | -0.002% | 0.004% | 0.002% | -0.002% | -0.003% | -0.004% | -0.004% | 5.8% | 5.9% | -0.008% | 0.004% | -0.008% | 0.003% |
| 12:30 to 13:00 | 0.009% | 0.008% | 0.010% | 0.012% | 0.022% | 0.017% | 0.007% | 0.011% | 0.010% | 0.010% | 5.8% | 5.7% | 0.003% | 0.008% | 0.000% | 0.005% |
| 13:00 to 13:30 | 0.004% | 0.004% | 0.006% | 0.007% | -0.001% | 0.004% | 0.007% | 0.008% | 0.004% | 0.006% | 6.0% | 6.0% | 0.003% | 0.005% | 0.002% | 0.003% |
| 13:30 to 14:00 | 0.005% | 0.003% | 0.006% | 0.004% | 0.008% | 0.002% | 0.014% | 0.009% | 0.007% | 0.004% | 5.9% | 5.9% | 0.001% | 0.006% | 0.004% | 0.017% |
| 14:00 to 14:30 | 0.009% | 0.010% | 0.003% | 0.009% | 0.013% | 0.016% | 0.013% | 0.011% | 0.009% | 0.011% | 6.1% | 6.0% | 0.008% | 0.005% | 0.007% | 0.011% |
| 14:30 to 15:00 | -0.002% | -0.006% | -0.008% | -0.003% | -0.003% | -0.005% | 0.025% | 0.009% | 0.002% | -0.005% | 7.4% | 7.4% | -0.006% | 0.004% | -0.004% | 0.005% |

(The block median is the sum of the 5 minute medians, an approximation; the CSV holds every 5 minute slice.)

Volume by time of day: share of the day's regular-session volume in each 30 minute block, all weekdays. Mean across stocks (winners) or days (SPY, QQQ); the median is in brackets. The last block includes the closing auction (the 3:00 PM Central bar).

| Block (CT) | 3x | 4x | 5x | 6x+ | all winners | SPY | QQQ |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 8:30 to 9:00 | 10.4% (9.5%) | 10.8% (9.8%) | 11.0% (10.4%) | 12.4% (11.6%) | 10.9% (10.0%) | 10.9% (10.3%) | 14.4% (13.2%) |
| 9:00 to 9:30 | 7.2% (7.1%) | 7.4% (7.1%) | 7.5% (7.5%) | 8.0% (7.9%) | 7.5% (7.3%) | 8.4% (7.4%) | 9.4% (8.2%) |
| 9:30 to 10:00 | 6.5% (6.4%) | 6.7% (6.5%) | 6.7% (6.8%) | 7.1% (7.2%) | 6.6% (6.6%) | 7.2% (6.1%) | 7.7% (6.4%) |
| 10:00 to 10:30 | 6.1% (6.1%) | 6.2% (6.2%) | 6.4% (6.5%) | 6.6% (6.7%) | 6.3% (6.2%) | 6.4% (5.5%) | 6.7% (5.6%) |
| 10:30 to 11:00 | 5.4% (5.4%) | 5.6% (5.5%) | 5.7% (5.6%) | 5.8% (5.8%) | 5.5% (5.5%) | 5.7% (4.7%) | 6.0% (4.7%) |
| 11:00 to 11:30 | 4.9% (4.9%) | 5.0% (4.9%) | 5.2% (5.1%) | 5.2% (5.2%) | 5.0% (5.0%) | 5.0% (4.0%) | 5.3% (4.0%) |
| 11:30 to 12:00 | 4.5% (4.5%) | 4.6% (4.6%) | 4.8% (4.8%) | 4.9% (4.8%) | 4.7% (4.6%) | 4.5% (3.6%) | 4.7% (3.6%) |
| 12:00 to 12:30 | 4.5% (4.5%) | 4.6% (4.5%) | 4.7% (4.7%) | 4.7% (4.7%) | 4.6% (4.6%) | 4.5% (3.6%) | 4.8% (3.5%) |
| 12:30 to 13:00 | 4.7% (4.6%) | 4.8% (4.6%) | 4.9% (4.8%) | 4.8% (4.8%) | 4.7% (4.7%) | 4.6% (3.6%) | 4.8% (3.6%) |
| 13:00 to 13:30 | 5.2% (5.1%) | 5.2% (5.1%) | 5.3% (5.2%) | 5.2% (5.1%) | 5.2% (5.1%) | 5.8% (4.6%) | 5.7% (4.3%) |
| 13:30 to 14:00 | 5.5% (5.4%) | 5.5% (5.4%) | 5.7% (5.6%) | 5.5% (5.4%) | 5.5% (5.4%) | 5.7% (4.8%) | 5.6% (4.3%) |
| 14:00 to 14:30 | 6.8% (6.6%) | 6.8% (6.6%) | 6.9% (6.8%) | 6.5% (6.5%) | 6.8% (6.6%) | 7.2% (6.2%) | 6.5% (5.2%) |
| 14:30 to 15:00 | 28.3% (27.3%) | 26.8% (26.1%) | 25.2% (24.5%) | 23.2% (21.1%) | 26.8% (25.2%) | 24.1% (22.1%) | 18.4% (16.7%) |

(A block median is the sum of its six 5 minute medians, an approximation.)

Volume by weekday, all winners against SPY and QQQ: share of the day's volume in the first 30 minutes (8:30 to 9:00 CT), the quietest hour (11:30 to 12:30 CT) and the last 30 minutes (2:30 to 3:00 CT, with the closing auction). Mean, median in brackets. Every 5 minute slice per weekday is in the CSV.

| Weekday | Winners, first 30 min | SPY, first 30 min | QQQ, first 30 min | Winners, 11:30 to 12:30 | SPY, 11:30 to 12:30 | QQQ, 11:30 to 12:30 | Winners, last 30 min | SPY, last 30 min | QQQ, last 30 min |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| Mon | 11.4% (10.5%) | 11.6% (11.1%) | 15.0% (14.0%) | 9.2% (8.9%) | 8.9% (7.1%) | 9.7% (7.1%) | 26.2% (24.6%) | 25.3% (23.2%) | 18.8% (17.2%) |
| Tue | 10.8% (9.9%) | 11.1% (10.4%) | 14.8% (13.6%) | 9.3% (9.1%) | 9.1% (7.4%) | 9.5% (7.1%) | 26.2% (24.7%) | 23.5% (22.0%) | 18.3% (16.3%) |
| Wed | 10.5% (9.7%) | 10.4% (9.9%) | 13.4% (12.3%) | 9.3% (9.0%) | 8.5% (6.8%) | 9.0% (6.9%) | 26.1% (24.5%) | 23.7% (22.0%) | 18.5% (16.4%) |
| Thu | 10.5% (9.6%) | 10.7% (10.0%) | 13.9% (12.9%) | 9.4% (9.2%) | 9.6% (7.9%) | 10.2% (7.7%) | 26.3% (25.5%) | 22.8% (20.7%) | 17.2% (15.6%) |
| Fri | 11.3% (10.5%) | 10.8% (10.1%) | 14.9% (13.2%) | 9.0% (8.8%) | 8.6% (7.0%) | 9.3% (7.0%) | 28.9% (28.1%) | 25.4% (23.0%) | 19.1% (17.5%) |


Volume drop off and pick up, Central time (mean curve; median curve in brackets). Each is the middle of a window that may run up to 30 minutes either side.

| Weekday | All winners: drop off | All winners: pick up | SPY: drop off | SPY: pick up | QQQ: drop off | QQQ: pick up | Winner-days | SPY days |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | ----: | ----: |
| All days | 9:11 (9:07) | 14:26 (14:27) | 9:22 (9:11) | 14:23 (14:30) | 9:42 (9:19) | 14:32 (14:40) | 268931 | 1018 |
| Mon | 9:14 (9:11) | 14:26 (14:27) | 9:21 (9:12) | 14:23 (14:29) | 9:35 (9:23) | 14:34 (14:40) | 49991 | 189 |
| Tue | 9:13 (9:09) | 14:25 (14:26) | 9:22 (9:13) | 14:25 (14:31) | 9:35 (9:21) | 14:30 (14:40) | 54925 | 208 |
| Wed | 9:11 (9:08) | 14:25 (14:25) | 9:16 (9:04) | 14:19 (14:27) | 9:42 (9:17) | 14:24 (14:40) | 54889 | 208 |
| Thu | 9:13 (9:09) | 14:25 (14:26) | 9:38 (9:12) | 14:25 (14:33) | 9:45 (9:24) | 14:34 (14:41) | 54942 | 208 |
| Fri | 8:57 (8:42) | 14:27 (14:29) | 9:42 (9:10) | 14:23 (14:30) | 9:49 (9:17) | 14:32 (14:39) | 54184 | 205 |

Drop off and pick up by gain group, Central time, all weekdays (mean curve; median curve in brackets):

| Group | Stocks | Drop off | Pick up |
| :---- | ----: | :---- | :---- |
| 3x | 147 | 9:04 (8:42) | 14:25 (14:26) |
| 4x | 46 | 9:11 (8:42) | 14:26 (14:27) |
| 5x | 34 | 9:12 (9:13) | 14:25 (14:26) |
| 6x+ | 51 | 9:21 (9:18) | 14:28 (14:28) |
| all | 278 | 9:11 (9:07) | 14:26 (14:27) |

Full trading days in the period: 1018; half days excluded: 9 (2016-11-25, 2017-07-03, 2017-11-24, 2018-07-03, 2018-11-23, 2018-12-24, 2019-07-03, 2019-11-29, 2019-12-24).

**Top 25 winners by multiple** (all winners in `period-A-winners.csv`):

| Ticker | Company | Group | Multiple | Start | End | Exchange | Beta | Volatility (annualized) | Cap band start | Cap band end | Flags |
| :---- | :---- | :---- | ----: | :---- | :---- | :---- | ----: | ----: | :---- | :---- | :---- |
| GRVY | GRAVITY Co., Ltd. - American depositary  | 6x+ | 20.47 | 2016-01-04 | 2020-01-31 | Nasdaq | 0.39 | 104% | up to 1B | up to 1B | ADR |
| SHOP | Shopify Inc. - Class A Subordinate Votin | 6x+ | 18.28 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.77 | 47% | over 1B to 10B | over 50B to 100B |  |
| AMD | Advanced Micro Devices, Inc. - Common St | 6x+ | 16.97 | 2016-01-04 | 2020-01-31 | Nasdaq | 2.09 | 66% | over 1B to 10B | over 50B to 100B |  |
| RETA | REATA PHARMACEUTICALS INC CL A | 6x+ | 13.61 | 2016-08-12 | 2020-01-31 | Nasdaq | 1.77 | 75% | up to 1B | over 1B to 10B | new listing |
| GOL | GOL LINHAS AEREAS INTELIGENTES | 6x+ | 13.58 | 2016-01-04 | 2020-01-31 | NYSE | 1.85 | 95% | unknown | over 10B to 50B | market cap unknown (start) |
| INS | INTELLIGENT SYSTEMS CORP (GA) | 6x+ | 12.13 | 2016-01-04 | 2020-01-31 | NYSE | 0.85 | 71% | up to 1B | up to 1B |  |
| TNDM | Tandem Diabetes Care, Inc. - Common Stoc | 6x+ | 11.18 | 2017-10-10 | 2020-01-31 | Nasdaq | 1.51 | 81% | up to 1B | over 1B to 10B | history starts late in Alpaca (company was exchange-registered earlier; ticker change or data gap) |
| KEM | KEMET CORP NEW COM STK (DE) | 6x+ | 10.99 | 2016-01-04 | 2020-01-31 | NYSE | 1.87 | 55% | up to 1B | over 1B to 10B |  |
| TTD | The Trade Desk, Inc. - Class A Common St | 6x+ | 10.76 | 2016-11-11 | 2020-01-31 | Nasdaq | 1.96 | 66% | up to 1B | over 10B to 50B | new listing |
| EHTH | eHealth, Inc. - Common Stock | 6x+ | 10.72 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.11 | 59% | up to 1B | over 1B to 10B |  |
| EXAS | EXACT SCIENCES CORPORATION | 6x+ | 10.39 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.75 | 63% | up to 1B | over 10B to 50B |  |
| AMRN | Amarin Corporation plc - American Deposi | 6x+ | 9.97 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.20 | 166% | up to 1B | over 1B to 10B | ADR; check: overnight price jump x3.49 on 2018-09-24 |
| ENPH | Enphase Energy, Inc. - Common Stock | 6x+ | 9.19 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.40 | 83% | up to 1B | over 1B to 10B |  |
| AXSM | Axsome Therapeutics, Inc. - Common Stock | 6x+ | 9.10 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.34 | 118% | up to 1B | over 1B to 10B |  |
| APPF | AppFolio, Inc. - Class A Common Stock | 6x+ | 9.05 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.05 | 34% | up to 1B | over 1B to 10B |  |
| RNG | RingCentral, Inc. Class A Common Stock | 6x+ | 8.90 | 2016-01-04 | 2020-01-31 | NYSE | 1.69 | 42% | over 1B to 10B | over 10B to 50B |  |
| CYRX | CryoPort, Inc. - Common Stock | 6x+ | 8.82 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.09 | 73% | up to 1B | up to 1B |  |
| CWST | Casella Waste Systems, Inc. - Class A Co | 6x+ | 8.68 | 2016-01-04 | 2020-01-31 | Nasdaq | 0.73 | 31% | up to 1B | over 1B to 10B |  |
| PAYC | Paycom Software, Inc. Common Stock | 6x+ | 8.57 | 2016-01-04 | 2020-01-31 | NYSE | 1.55 | 38% | over 1B to 10B | over 10B to 50B |  |
| SKY | Champion Homes, Inc. Common Stock | 6x+ | 8.41 | 2016-01-04 | 2020-01-31 | NYSE | 1.33 | 67% | up to 1B | over 1B to 10B |  |
| FIVN | Five9, Inc. - Common Stock | 6x+ | 8.35 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.43 | 45% | up to 1B | over 1B to 10B |  |
| RARX | RA PHARMACEUTICALS INC COM | 6x+ | 8.08 | 2018-02-14 | 2020-01-31 | Nasdaq | 1.17 | 96% | up to 1B | over 1B to 10B | new listing |
| IDN | Intellicheck, Inc. - Common Stock | 6x+ | 8.06 | 2016-01-04 | 2020-01-31 | Nasdaq | 0.62 | 77% | up to 1B | up to 1B |  |
| DRS | Leonardo DRS, Inc. - Common Stock | 6x+ | 7.74 | 2016-01-04 | 2020-01-31 | Nasdaq | 0.69 | 63% | up to 1B | up to 1B |  |
| FATE | Fate Therapeutics, Inc. - Common Stock | 6x+ | 7.57 | 2016-01-04 | 2020-01-31 | Nasdaq | 1.73 | 76% | up to 1B | over 1B to 10B |  |

### 5.2 Period B: April 2020 to January 2022

- **Winners:** 595 (3x 282, 4x 126, 5x 66, 6x+ 121) after removing 67, the largest set. The top industry is crude oil and natural gas (37)[^7].
- **Days:** winners rose on fewer than half their days (close above open, mean 48.8 percent, median 49.0), against 55.3 percent for SPY. Almost all their gain came overnight (mean 95 percent, median 92), as it did for SPY (96 percent).
- **Market cap:** 444 of 595 started at up to 1B, the highest share of the four periods.
- **Time of day:** the first 30 minutes and the last 30 minutes were both losing blocks on average (mean minus 0.026 and minus 0.030 percent). Volume dropped off at 9:14 CT and picked up at 14:31, while SPY's curve picked up earliest of all (14:17). 3 half days excluded.

Trading days measured: 2020-04-01 to 2022-01-31. Candidates from the 3x monthly screen: 3505; passed the daily pre-check: 1008. Removed (change 1): 67.

| Group | Winners | Non-standard start | Multiple, mean | median | Share of days up (close above open), mean | median | Share of days up (close above prior close), mean | median | Overnight share of gain, mean | median | Intraday share of gain, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 282 | 3 | 3.41 | 3.34 | 48.8% | 49.0% | 51.2% | 51.6% | 103% | 99% | -3% | 1% |
| 4x | 126 | 0 | 4.46 | 4.39 | 48.8% | 48.9% | 51.2% | 51.6% | 90% | 89% | 10% | 11% |
| 5x | 66 | 0 | 5.48 | 5.46 | 48.4% | 48.9% | 50.8% | 51.2% | 97% | 86% | 3% ⚑ | 14% |
| 6x+ | 121 | 0 | 10.77 | 8.36 | 48.9% | 49.2% | 51.2% | 51.4% | 80% | 77% | 20% | 23% |
| all | 595 | 3 | 5.36 | 4.09 | 48.8% | 49.0% | 51.1% | 51.4% | 95% | 92% | 5% | 8% |
| SPY (benchmark) | n/a | n/a | 1.81 | | 55.3% | | 57.7% | | 96% | | 4% | |
| QQQ (benchmark) | n/a | n/a | 1.96 | | 56.4% | | 59.4% | | 86% | | 14% | |

| Group | Average up-day gain (close above open), mean | median | Average down-day loss (close below open), mean | median | Average up-day gain (close above prior close), mean | median | Average down-day loss (close below prior close), mean | median | Mean daily open to close, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 2.71% | 2.36% | -2.45% | -2.25% | 3.21% | 2.82% | -2.57% | -2.40% | 0.07% | 0.05% |
| 4x | 3.09% | 2.75% | -2.72% | -2.60% | 3.63% | 3.25% | -2.88% | -2.78% | 0.13% | 0.12% |
| 5x | 3.36% | 3.21% | -2.96% | -2.88% | 3.98% | 3.65% | -3.09% | -2.97% | 0.11% | 0.13% |
| 6x+ | 3.91% | 3.72% | -3.32% | -3.24% | 4.62% | 4.26% | -3.47% | -3.31% | 0.23% | 0.23% |
| all | 3.11% | 2.84% | -2.74% | -2.64% | 3.67% | 3.31% | -2.88% | -2.77% | 0.12% | 0.09% |

| Group | Mean overnight gap, mean | median | Mean daily move, open to close (either way), mean | median | Mean rise from open (high minus open), mean | median | Mean drop from open (open minus low), mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 0.31% | 0.28% | 2.53% | 2.27% | 2.72% | 2.36% | 2.57% | 2.33% |
| 4x | 0.33% | 0.32% | 2.85% | 2.67% | 3.07% | 2.78% | 2.84% | 2.69% |
| 5x | 0.42% | 0.36% | 3.10% | 2.99% | 3.31% | 3.09% | 3.16% | 2.94% |
| 6x+ | 0.45% | 0.42% | 3.55% | 3.45% | 3.93% | 3.76% | 3.55% | 3.44% |
| all | 0.36% | 0.32% | 2.87% | 2.69% | 3.11% | 2.86% | 2.89% | 2.77% |
| SPY (benchmark) | | | 0.62% | | | | | |
| QQQ (benchmark) | | | 0.87% | | | | | |

| Group | Beta against SPY, mean | median | Volatility, daily, mean | median | Volatility, annualized, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 1.33 | 1.38 | 4.6% | 3.7% | 73.8% | 58.3% |
| 4x | 1.47 | 1.50 | 5.2% | 4.3% | 82.5% | 68.4% |
| 5x | 1.52 | 1.62 | 5.3% | 4.6% | 84.4% | 73.4% |
| 6x+ | 1.59 | 1.63 | 6.2% | 5.4% | 98.4% | 85.7% |
| all | 1.43 | 1.47 | 5.2% | 4.3% | 81.8% | 68.5% |

| Group | Up days above the average up day, close above open (pooled) | Same, close above prior close (pooled) | Winner rose (close above prior close) on days SPY fell or was flat | Same, QQQ | Winner rose open to close on days SPY fell or was flat open to close |
| :---- | ----: | ----: | ----: | ----: | ----: |
| 3x | 37% | 36% | 35% | 39% | 36% |
| 4x | 37% | 35% | 36% | 40% | 38% |
| 5x | 37% | 35% | 36% | 40% | 37% |
| 6x+ | 37% | 35% | 37% | 41% | 38% |
| all | 37% | 35% | 36% | 40% | 37% |

Market cap bands, number of winners (start / end):

| Group | up to 1B | over 1B to 10B | over 10B to 50B | over 50B to 100B | over 100B to 250B | over 250B to 1T | over 1T | unknown |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 180 / 99 | 81 / 128 | 19 / 43 | 0 / 7 | 1 / 3 | 0 / 1 | 0 / 0 | 1 / 1 |
| 4x | 101 / 41 | 20 / 71 | 4 / 10 | 0 / 2 | 0 / 1 | 0 / 0 | 0 / 0 | 1 / 1 |
| 5x | 56 / 30 | 9 / 30 | 1 / 4 | 0 / 2 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| 6x+ | 107 / 57 | 12 / 52 | 0 / 10 | 1 / 0 | 0 / 0 | 0 / 1 | 0 / 0 | 1 / 1 |
| all | 444 / 227 | 122 / 281 | 24 / 67 | 1 / 11 | 1 / 4 | 0 / 2 | 0 / 0 | 3 / 3 |

Daily open-to-close moves, all winners pooled (share of winner-days in each band):

| Band | below -10% | -10 to -5 | -5 to -3 | -3 to -2 | -2 to -1 | -1 to -0.5 | -0.5 to 0 | 0 to 0.5 | 0.5 to 1 | 1 to 2 | 2 to 3 | 3 to 5 | 5 to 10 | 10% and up |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 0.8% | 4.9% | 8.6% | 8.2% | 12.1% | 7.5% | 7.6% | 9.0% | 7.5% | 11.6% | 7.9% | 8.0% | 4.9% | 1.3% |
| 4x | 1.0% | 6.4% | 9.3% | 8.0% | 11.4% | 6.7% | 6.8% | 8.1% | 6.6% | 10.8% | 7.6% | 9.2% | 6.3% | 1.7% |
| 5x | 1.3% | 7.3% | 10.1% | 8.3% | 11.1% | 6.3% | 5.9% | 7.0% | 6.0% | 10.3% | 7.7% | 9.7% | 7.0% | 2.3% |
| 6x+ | 1.8% | 8.8% | 10.6% | 8.2% | 10.0% | 5.6% | 4.8% | 6.1% | 5.4% | 9.3% | 7.5% | 9.9% | 8.8% | 3.3% |
| all | 1.1% | 6.3% | 9.3% | 8.2% | 11.4% | 6.8% | 6.7% | 8.0% | 6.7% | 10.8% | 7.7% | 8.8% | 6.2% | 1.9% |

Top industries (SEC SIC description, today's label): Crude Petroleum & Natural Gas (37); Pharmaceutical Preparations (25); Semiconductors & Related Devices (23); State Commercial Banks (18); Services-Prepackaged Software (17); Finance Services (12); Biological Products, (No Diagnostic Substances) (11); Real Estate Investment Trusts (10).

Gains by time of day, all weekdays, 30 minute blocks (Central time). Return = mean (or median) across winners of the winner's average log return in that block (SPY and QQQ: mean or median across days); gains and losses = share of all intraday rises (falls) that happened in the block, pooled.

| Block (CT) | 3x mean | 3x median | 4x mean | 4x median | 5x mean | 5x median | 6x+ mean | 6x+ median | all mean | all median | all: share of gains | all: share of losses | SPY mean | SPY median | QQQ mean | QQQ median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 8:30 to 9:00 | -0.031% | -0.008% | -0.025% | -0.003% | -0.058% | -0.041% | 0.004% | 0.017% | -0.026% | -0.012% | 16.4% | 16.6% | 0.012% | 0.030% | 0.023% | 0.077% |
| 9:00 to 9:30 | -0.026% | -0.027% | -0.017% | -0.021% | -0.037% | -0.033% | -0.023% | -0.012% | -0.025% | -0.022% | 10.9% | 11.1% | -0.006% | 0.025% | -0.010% | 0.026% |
| 9:30 to 10:00 | -0.020% | -0.017% | -0.014% | -0.019% | -0.027% | -0.022% | -0.004% | -0.005% | -0.016% | -0.017% | 9.1% | 9.3% | -0.015% | 0.015% | -0.026% | 0.012% |
| 10:00 to 10:30 | 0.015% | 0.016% | 0.016% | 0.012% | 0.024% | 0.025% | 0.018% | 0.025% | 0.017% | 0.017% | 8.0% | 7.9% | 0.017% | 0.023% | 0.016% | 0.025% |
| 10:30 to 11:00 | 0.026% | 0.024% | 0.031% | 0.023% | 0.039% | 0.037% | 0.034% | 0.028% | 0.030% | 0.026% | 7.1% | 6.8% | 0.008% | 0.014% | 0.008% | 0.009% |
| 11:00 to 11:30 | 0.013% | 0.016% | 0.014% | 0.019% | 0.020% | 0.021% | 0.019% | 0.029% | 0.015% | 0.018% | 6.4% | 6.3% | 0.008% | 0.019% | 0.006% | 0.028% |
| 11:30 to 12:00 | 0.010% | 0.008% | 0.005% | 0.007% | 0.008% | 0.008% | 0.013% | 0.011% | 0.009% | 0.007% | 6.0% | 5.9% | 0.004% | 0.017% | 0.001% | 0.024% |
| 12:00 to 12:30 | 0.014% | 0.014% | 0.018% | 0.019% | 0.019% | 0.019% | 0.013% | 0.005% | 0.015% | 0.014% | 5.8% | 5.7% | 0.003% | 0.009% | 0.007% | 0.015% |
| 12:30 to 13:00 | -0.005% | -0.005% | -0.014% | -0.019% | -0.009% | -0.008% | -0.018% | -0.021% | -0.010% | -0.010% | 5.5% | 5.6% | -0.004% | 0.008% | -0.005% | 0.008% |
| 13:00 to 13:30 | 0.024% | 0.020% | 0.032% | 0.028% | 0.032% | 0.025% | 0.036% | 0.034% | 0.029% | 0.024% | 6.0% | 5.8% | 0.014% | 0.017% | 0.011% | 0.022% |
| 13:30 to 14:00 | 0.010% | 0.005% | 0.012% | 0.008% | 0.014% | 0.011% | 0.018% | 0.011% | 0.013% | 0.007% | 5.8% | 5.7% | 0.003% | 0.015% | 0.018% | 0.034% |
| 14:00 to 14:30 | -0.008% | -0.008% | -0.005% | -0.012% | -0.008% | -0.006% | -0.009% | -0.005% | -0.007% | -0.009% | 6.0% | 6.1% | -0.012% | -0.005% | -0.019% | -0.006% |
| 14:30 to 15:00 | -0.036% | -0.037% | -0.030% | -0.035% | -0.023% | -0.027% | -0.018% | -0.021% | -0.030% | -0.032% | 7.0% | 7.3% | -0.026% | -0.015% | -0.014% | -0.005% |

(The block median is the sum of the 5 minute medians, an approximation; the CSV holds every 5 minute slice.)

Volume by time of day: share of the day's regular-session volume in each 30 minute block, all weekdays. Mean across stocks (winners) or days (SPY, QQQ); the median is in brackets. The last block includes the closing auction (the 3:00 PM Central bar).

| Block (CT) | 3x | 4x | 5x | 6x+ | all winners | SPY | QQQ |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 8:30 to 9:00 | 11.2% (10.5%) | 12.2% (11.6%) | 12.1% (11.2%) | 13.9% (13.6%) | 12.0% (11.5%) | 11.2% (10.8%) | 15.0% (14.4%) |
| 9:00 to 9:30 | 7.2% (7.0%) | 7.8% (7.6%) | 7.9% (7.5%) | 8.6% (8.5%) | 7.7% (7.5%) | 8.4% (7.6%) | 10.0% (9.2%) |
| 9:30 to 10:00 | 6.4% (6.3%) | 6.8% (6.6%) | 6.8% (6.7%) | 7.4% (7.3%) | 6.7% (6.6%) | 7.3% (6.4%) | 8.3% (7.4%) |
| 10:00 to 10:30 | 5.7% (5.6%) | 5.9% (5.8%) | 6.0% (5.9%) | 6.4% (6.4%) | 5.9% (5.8%) | 6.3% (5.5%) | 7.1% (6.2%) |
| 10:30 to 11:00 | 5.0% (4.9%) | 5.2% (5.1%) | 5.3% (5.2%) | 5.5% (5.5%) | 5.2% (5.1%) | 5.5% (4.8%) | 6.0% (5.3%) |
| 11:00 to 11:30 | 4.6% (4.5%) | 4.7% (4.6%) | 4.8% (4.7%) | 5.0% (5.0%) | 4.8% (4.6%) | 4.8% (4.1%) | 5.4% (4.6%) |
| 11:30 to 12:00 | 4.4% (4.3%) | 4.5% (4.4%) | 4.5% (4.4%) | 4.7% (4.7%) | 4.5% (4.4%) | 4.4% (3.7%) | 4.8% (4.1%) |
| 12:00 to 12:30 | 4.3% (4.2%) | 4.3% (4.2%) | 4.4% (4.3%) | 4.5% (4.5%) | 4.4% (4.3%) | 4.4% (3.6%) | 4.7% (4.0%) |
| 12:30 to 13:00 | 4.3% (4.2%) | 4.4% (4.2%) | 4.4% (4.3%) | 4.5% (4.4%) | 4.4% (4.3%) | 4.4% (3.7%) | 4.6% (3.9%) |
| 13:00 to 13:30 | 4.7% (4.6%) | 4.7% (4.6%) | 4.8% (4.7%) | 4.9% (4.8%) | 4.8% (4.6%) | 5.7% (4.8%) | 5.5% (4.6%) |
| 13:30 to 14:00 | 5.0% (4.9%) | 5.0% (4.9%) | 5.0% (4.9%) | 5.1% (5.0%) | 5.0% (4.9%) | 5.7% (4.9%) | 5.5% (4.6%) |
| 14:00 to 14:30 | 6.1% (6.0%) | 6.0% (6.0%) | 6.1% (6.0%) | 6.1% (6.0%) | 6.1% (6.0%) | 7.5% (6.8%) | 6.4% (5.6%) |
| 14:30 to 15:00 | 31.0% (32.0%) | 28.5% (28.5%) | 28.0% (30.0%) | 23.4% (22.2%) | 28.6% (28.9%) | 24.4% (23.3%) | 16.5% (15.3%) |

(A block median is the sum of its six 5 minute medians, an approximation.)

Volume by weekday, all winners against SPY and QQQ: share of the day's volume in the first 30 minutes (8:30 to 9:00 CT), the quietest hour (11:30 to 12:30 CT) and the last 30 minutes (2:30 to 3:00 CT, with the closing auction). Mean, median in brackets. Every 5 minute slice per weekday is in the CSV.

| Weekday | Winners, first 30 min | SPY, first 30 min | QQQ, first 30 min | Winners, 11:30 to 12:30 | SPY, 11:30 to 12:30 | QQQ, 11:30 to 12:30 | Winners, last 30 min | SPY, last 30 min | QQQ, last 30 min |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| Mon | 13.4% (12.8%) | 11.7% (11.3%) | 15.6% (15.2%) | 8.8% (8.5%) | 8.7% (7.3%) | 9.5% (8.1%) | 27.7% (28.2%) | 24.6% (23.8%) | 16.6% (15.2%) |
| Tue | 12.2% (11.5%) | 11.5% (11.1%) | 15.2% (14.8%) | 8.9% (8.5%) | 8.5% (7.2%) | 9.3% (8.1%) | 27.9% (28.1%) | 24.3% (23.0%) | 16.2% (15.0%) |
| Wed | 11.4% (10.9%) | 10.6% (10.3%) | 14.7% (14.2%) | 8.9% (8.5%) | 8.3% (7.0%) | 9.3% (7.9%) | 28.1% (28.6%) | 24.8% (24.1%) | 16.4% (15.4%) |
| Thu | 11.7% (11.1%) | 11.4% (11.2%) | 14.9% (14.1%) | 9.2% (8.8%) | 9.5% (7.9%) | 10.0% (8.3%) | 27.7% (27.8%) | 23.0% (21.8%) | 16.5% (15.3%) |
| Fri | 11.6% (11.1%) | 10.8% (10.1%) | 14.6% (13.9%) | 8.6% (8.2%) | 8.7% (7.2%) | 9.7% (8.2%) | 31.6% (32.4%) | 25.2% (23.5%) | 16.6% (15.7%) |


Volume drop off and pick up, Central time (mean curve; median curve in brackets). Each is the middle of a window that may run up to 30 minutes either side.

| Weekday | All winners: drop off | All winners: pick up | SPY: drop off | SPY: pick up | QQQ: drop off | QQQ: pick up | Winner-days | SPY days |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | ----: | ----: |
| All days | 9:14 (9:11) | 14:31 (14:31) | 9:37 (9:12) | 14:17 (14:26) | 10:01 (9:40) | 14:33 (14:37) | 273079 | 460 |
| Mon | 9:18 (9:14) | 14:32 (14:32) | 9:33 (9:18) | 14:21 (14:26) | 10:08 (9:41) | 14:34 (14:39) | 52243 | 88 |
| Tue | 9:17 (9:13) | 14:31 (14:31) | 9:33 (9:17) | 14:15 (14:26) | 10:11 (9:48) | 14:33 (14:39) | 56398 | 95 |
| Wed | 9:12 (9:09) | 14:29 (14:29) | 9:14 (9:06) | 14:11 (14:24) | 9:47 (9:37) | 14:30 (14:34) | 56998 | 96 |
| Thu | 9:15 (9:11) | 14:31 (14:31) | 9:24 (9:12) | 14:23 (14:28) | 10:03 (9:41) | 14:31 (14:37) | 55202 | 93 |
| Fri | 9:07 (8:59) | 14:33 (14:33) | 9:42 (9:13) | 14:22 (14:29) | 10:03 (9:39) | 14:33 (14:36) | 52238 | 88 |

Drop off and pick up by gain group, Central time, all weekdays (mean curve; median curve in brackets):

| Group | Stocks | Drop off | Pick up |
| :---- | ----: | :---- | :---- |
| 3x | 282 | 9:06 (8:58) | 14:30 (14:31) |
| 4x | 126 | 9:17 (9:13) | 14:31 (14:31) |
| 5x | 66 | 9:17 (9:11) | 14:31 (14:31) |
| 6x+ | 121 | 9:39 (9:32) | 14:33 (14:32) |
| all | 595 | 9:14 (9:11) | 14:31 (14:31) |

Full trading days in the period: 460; half days excluded: 3 (2020-11-27, 2020-12-24, 2021-11-26).

**Top 25 winners by multiple** (all winners in `period-B-winners.csv`):

| Ticker | Company | Group | Multiple | Start | End | Exchange | Beta | Volatility (annualized) | Cap band start | Cap band end | Flags |
| :---- | :---- | :---- | ----: | :---- | :---- | :---- | ----: | ----: | :---- | :---- | :---- |
| MARA | MARA Holdings, Inc. - Common Stock | 6x+ | 51.17 | 2020-04-01 | 2022-01-31 | Nasdaq | 2.99 | 169% | up to 1B | over 1B to 10B |  |
| GME | GameStop Corporation Common Stock | 6x+ | 31.57 | 2020-04-01 | 2022-01-31 | NYSE | 0.48 | 216% | up to 1B | over 1B to 10B |  |
| PR | Permian Resources Corporation Class A Co | 6x+ | 29.87 | 2020-04-01 | 2022-01-31 | NYSE | 2.05 | 113% | up to 1B | over 1B to 10B |  |
| SM | SM Energy Company Common Stock | 6x+ | 28.28 | 2020-04-01 | 2022-01-31 | NYSE | 2.25 | 121% | up to 1B | over 1B to 10B |  |
| AR | Antero Resources Corporation Common Stoc | 6x+ | 28.10 | 2020-04-01 | 2022-01-31 | NYSE | 1.69 | 91% | up to 1B | over 1B to 10B |  |
| AMR | Alpha Metallurgical Resources, Inc. Comm | 6x+ | 26.46 | 2020-04-01 | 2022-01-31 | NYSE | 1.94 | 103% | up to 1B | over 1B to 10B |  |
| DAC | Danaos Corporation Common Stock | 6x+ | 24.21 | 2020-04-01 | 2022-01-31 | NYSE | 1.35 | 75% | up to 1B | over 1B to 10B |  |
| KIRK | KIRKLANDS INC | 6x+ | 21.99 | 2020-04-01 | 2022-01-31 | Nasdaq | 1.63 | 112% | up to 1B | up to 1B |  |
| ALTO | Alto Ingredients, Inc. - Common Stock | 6x+ | 20.63 | 2020-04-01 | 2022-01-31 | Nasdaq | 1.39 | 116% | up to 1B | up to 1B |  |
| MVIS | MicroVision, Inc. - Common Stock | 6x+ | 19.76 | 2020-04-01 | 2022-01-31 | Nasdaq | 2.24 | 187% | up to 1B | up to 1B |  |
| MTDR | Matador Resources Company Common Stock | 6x+ | 19.47 | 2020-04-01 | 2022-01-31 | NYSE | 2.22 | 86% | up to 1B | over 1B to 10B |  |
| RIOT | Riot Platforms, Inc. - Common Stock | 6x+ | 19.20 | 2020-04-01 | 2022-01-31 | Nasdaq | 2.80 | 141% | up to 1B | over 1B to 10B |  |
| CLDX | Celldex Therapeutics, Inc. - Common Stoc | 6x+ | 19.14 | 2020-04-01 | 2022-01-31 | Nasdaq | -0.18 | 109% | up to 1B | over 1B to 10B |  |
| BGFV | BIG 5 SPORTING GOODS CORP | 6x+ | 18.75 | 2020-04-01 | 2022-01-31 | Nasdaq | 1.72 | 107% | up to 1B | up to 1B |  |
| AMTX | Aemetis, Inc - Common Stock | 6x+ | 17.30 | 2020-04-01 | 2022-01-31 | Nasdaq | 1.50 | 153% | up to 1B | up to 1B |  |
| ESEA | Euroseas Ltd. - Common Stock | 6x+ | 15.00 | 2020-04-01 | 2022-01-31 | Nasdaq | 1.01 | 107% | up to 1B | up to 1B |  |
| OVV | Ovintiv Inc. (DE) | 6x+ | 14.59 | 2020-04-01 | 2022-01-31 | NYSE | 1.97 | 75% | up to 1B | over 1B to 10B |  |
| BXC | Bluelinx Holdings Inc. Common Stock | 6x+ | 14.41 | 2020-04-01 | 2022-01-31 | NYSE | 1.86 | 83% | up to 1B | up to 1B |  |
| SIG | Signet Jewelers Limited Common Shares | 6x+ | 14.31 | 2020-04-01 | 2022-01-31 | NYSE | 1.78 | 76% | up to 1B | over 1B to 10B |  |
| HBP | HUTTIG BUILDING PRODS INC | 6x+ | 13.91 | 2020-04-01 | 2022-01-31 | Nasdaq | 0.85 | 89% | up to 1B | up to 1B |  |
| CAR | Avis Budget Group, Inc. - Common Stock | 6x+ | 13.83 | 2020-04-01 | 2022-01-31 | Nasdaq | 2.30 | 115% | up to 1B | over 1B to 10B |  |
| CLMT | Calumet, Inc - Common Stock | 6x+ | 13.41 | 2020-04-01 | 2022-01-31 | Nasdaq | 1.15 | 86% | up to 1B | over 1B to 10B |  |
| BBW | Build-A-Bear Workshop, Inc. Common Stock | 6x+ | 13.12 | 2020-04-01 | 2022-01-31 | NYSE | 1.22 | 100% | up to 1B | up to 1B |  |
| SD | SandRidge Energy, Inc. Common Stock | 6x+ | 12.92 | 2020-04-01 | 2022-01-31 | NYSE | 1.36 | 108% | up to 1B | up to 1B |  |
| BLNK | Blink Charging Co. - Common Stock | 6x+ | 12.67 | 2020-04-01 | 2022-01-31 | Nasdaq | 1.67 | 130% | up to 1B | up to 1B |  |

### 5.3 Period C: January 2023 to February 2025

- **Winners:** 208 (3x 99, 4x 51, 5x 20, 6x+ 38) after removing 24.
- **Days:** winners rose on about half their days (mean 49.1 percent, median 49.2), against 56.2 percent for SPY. Overnight share of the gain: mean 75 percent, median 64; the intraday share's mean and median differ a lot (⚑).
- **Beta and volatility:** the mean beta (1.51) is above the median (1.38), pulled up by a few high-beta names; median volatility 71 percent a year.
- **Time of day:** the best block was 10:00 to 10:30 CT (mean 0.031 percent). Volume dropped off at 9:21 CT and picked up at 14:30. 5 half days excluded.

Trading days measured: 2023-01-03 to 2025-02-28. Candidates from the 3x monthly screen: 3439; passed the daily pre-check: 650. Removed (change 1): 24.

| Group | Winners | Non-standard start | Multiple, mean | median | Share of days up (close above open), mean | median | Share of days up (close above prior close), mean | median | Overnight share of gain, mean | median | Intraday share of gain, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 99 | 1 | 3.45 | 3.40 | 48.9% | 49.2% | 50.2% | 50.6% | 86% | 76% | 14% ⚑ | 24% |
| 4x | 51 | 1 | 4.45 | 4.39 | 49.1% | 49.0% | 50.2% | 50.1% | 68% | 67% | 32% | 33% |
| 5x | 20 | 0 | 5.46 | 5.46 | 50.8% | 51.3% | 51.5% | 51.0% | 34% ⚑ | 49% | 66% | 51% |
| 6x+ | 38 | 1 | 11.41 ⚑ | 7.78 | 48.7% | 49.2% | 50.1% | 50.1% | 77% | 59% | 23% ⚑ | 41% |
| all | 208 | 3 | 5.34 | 4.07 | 49.1% | 49.2% | 50.3% | 50.3% | 75% | 64% | 25% ⚑ | 36% |
| SPY (benchmark) | n/a | n/a | 1.55 | | 56.2% | | 57.3% | | 59% | | 41% | |
| QQQ (benchmark) | n/a | n/a | 1.89 | | 55.6% | | 57.3% | | 62% | | 38% | |

| Group | Average up-day gain (close above open), mean | median | Average down-day loss (close below open), mean | median | Average up-day gain (close above prior close), mean | median | Average down-day loss (close below prior close), mean | median | Mean daily open to close, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 2.93% | 2.40% | -2.56% | -2.18% | 3.32% | 2.72% | -2.62% | -2.37% | 0.12% | 0.11% |
| 4x | 3.33% | 2.96% | -2.86% | -2.83% | 3.97% | 3.40% | -2.98% | -2.89% | 0.23% | 0.14% |
| 5x | 2.95% | 2.97% | -2.53% | -2.61% | 3.30% | 3.17% | -2.68% | -2.68% | 0.28% | 0.22% |
| 6x+ | 4.37% | 4.15% | -3.45% | -3.45% | 5.03% | 4.78% | -3.57% | -3.59% | 0.33% ⚑ | 0.21% |
| all | 3.29% | 2.95% | -2.79% | -2.65% | 3.79% | 3.29% | -2.89% | -2.76% | 0.20% | 0.15% |

| Group | Mean overnight gap, mean | median | Mean daily move, open to close (either way), mean | median | Mean rise from open (high minus open), mean | median | Mean drop from open (open minus low), mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 0.23% | 0.18% | 2.67% | 2.26% | 2.86% | 2.41% | 2.66% | 2.28% |
| 4x | 0.29% | 0.22% | 3.02% | 2.80% | 3.40% | 3.04% | 2.98% | 3.01% |
| 5x | 0.13% | 0.18% | 2.68% | 2.69% | 2.96% | 2.92% | 2.58% | 2.76% |
| 6x+ | 0.39% | 0.31% | 3.81% | 3.76% | 4.14% | 4.15% | 3.55% | 3.54% |
| all | 0.26% | 0.21% | 2.97% | 2.70% | 3.24% | 3.01% | 2.90% | 2.80% |
| SPY (benchmark) | | | 0.51% | | | | | |
| QQQ (benchmark) | | | 0.72% | | | | | |

| Group | Beta against SPY, mean | median | Volatility, daily, mean | median | Volatility, annualized, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 1.39 | 1.26 | 4.4% | 3.9% | 69.8% | 61.6% |
| 4x | 1.26 | 1.27 | 6.2% ⚑ | 4.6% | 98.7% ⚑ | 73.3% |
| 5x | 1.69 | 1.53 | 4.2% | 3.9% | 66.8% | 61.8% |
| 6x+ | 2.05 | 2.20 | 8.2% | 6.3% | 129.7% | 99.5% |
| all | 1.51 | 1.38 | 5.5% | 4.5% | 87.5% | 70.7% |

| Group | Up days above the average up day, close above open (pooled) | Same, close above prior close (pooled) | Winner rose (close above prior close) on days SPY fell or was flat | Same, QQQ | Winner rose open to close on days SPY fell or was flat open to close |
| :---- | ----: | ----: | ----: | ----: | ----: |
| 3x | 37% | 36% | 36% | 38% | 37% |
| 4x | 37% | 34% | 38% | 39% | 39% |
| 5x | 38% | 37% | 36% | 38% | 39% |
| 6x+ | 36% | 35% | 34% | 35% | 36% |
| all | 37% | 35% | 36% | 38% | 37% |

Market cap bands, number of winners (start / end):

| Group | up to 1B | over 1B to 10B | over 10B to 50B | over 50B to 100B | over 100B to 250B | over 250B to 1T | over 1T | unknown |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 67 / 38 | 21 / 39 | 8 / 13 | 0 / 4 | 2 / 2 | 0 / 2 | 0 / 0 | 1 / 1 |
| 4x | 37 / 19 | 13 / 25 | 1 / 6 | 0 / 1 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| 5x | 11 / 6 | 8 / 9 | 0 / 3 | 0 / 1 | 0 / 0 | 1 / 0 | 0 / 1 | 0 / 0 |
| 6x+ | 27 / 9 | 8 / 17 | 2 / 7 | 0 / 1 | 0 / 3 | 1 / 0 | 0 / 1 | 0 / 0 |
| all | 142 / 72 | 50 / 90 | 11 / 29 | 0 / 7 | 2 / 5 | 2 / 2 | 0 / 2 | 1 / 1 |

Daily open-to-close moves, all winners pooled (share of winner-days in each band):

| Band | below -10% | -10 to -5 | -5 to -3 | -3 to -2 | -2 to -1 | -1 to -0.5 | -0.5 to 0 | 0 to 0.5 | 0.5 to 1 | 1 to 2 | 2 to 3 | 3 to 5 | 5 to 10 | 10% and up |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 1.1% | 5.4% | 8.1% | 7.8% | 11.9% | 7.7% | 7.2% | 9.2% | 7.4% | 11.6% | 7.6% | 7.5% | 5.5% | 1.9% |
| 4x | 1.3% | 6.4% | 9.0% | 7.8% | 11.1% | 6.7% | 6.3% | 8.6% | 6.8% | 11.0% | 7.6% | 8.6% | 6.7% | 2.1% |
| 5x | 0.7% | 5.4% | 8.2% | 7.7% | 11.6% | 7.1% | 6.2% | 8.3% | 7.4% | 11.4% | 8.7% | 9.1% | 6.5% | 1.6% |
| 6x+ | 2.4% | 8.9% | 10.5% | 8.0% | 9.4% | 5.6% | 5.1% | 6.5% | 5.2% | 9.4% | 7.2% | 9.2% | 8.5% | 4.2% |
| all | 1.4% | 6.3% | 8.7% | 7.8% | 11.2% | 7.0% | 6.5% | 8.5% | 6.9% | 11.0% | 7.6% | 8.2% | 6.5% | 2.3% |

Top industries (SEC SIC description, today's label): Pharmaceutical Preparations (24); Finance Services (21); Services-Prepackaged Software (16); Surgical & Medical Instruments & Apparatus (7); Fire, Marine & Casualty Insurance (5); Services-Business Services, NEC (5); Services-Computer Integrated Systems Design (5); Biological Products, (No Diagnostic Substances) (5).

Gains by time of day, all weekdays, 30 minute blocks (Central time). Return = mean (or median) across winners of the winner's average log return in that block (SPY and QQQ: mean or median across days); gains and losses = share of all intraday rises (falls) that happened in the block, pooled.

| Block (CT) | 3x mean | 3x median | 4x mean | 4x median | 5x mean | 5x median | 6x+ mean | 6x+ median | all mean | all median | all: share of gains | all: share of losses | SPY mean | SPY median | QQQ mean | QQQ median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 8:30 to 9:00 | -0.012% | 0.017% | 0.006% | 0.010% | 0.092% | 0.087% | 0.028% | 0.061% | 0.010% | 0.032% | 16.1% | 16.1% | 0.007% | 0.031% | 0.004% | 0.037% |
| 9:00 to 9:30 | -0.015% | -0.012% | 0.008% | -0.001% | 0.047% | 0.023% | -0.040% | -0.019% | -0.008% | -0.007% | 10.9% | 11.1% | -0.005% | 0.008% | -0.006% | 0.021% |
| 9:30 to 10:00 | -0.008% | -0.008% | -0.014% | 0.012% | 0.009% | 0.028% | 0.008% | 0.008% | -0.005% | 0.002% | 8.9% | 9.0% | -0.008% | 0.010% | -0.015% | 0.016% |
| 10:00 to 10:30 | 0.023% | 0.023% | 0.051% | 0.030% | 0.022% | 0.014% | 0.029% | 0.025% | 0.031% | 0.024% | 7.8% | 7.6% | 0.012% | 0.023% | 0.025% | 0.040% |
| 10:30 to 11:00 | 0.017% | 0.016% | 0.002% | 0.005% | 0.024% | 0.023% | 0.044% | 0.037% | 0.019% | 0.015% | 7.0% | 6.9% | 0.009% | 0.015% | 0.020% | 0.028% |
| 11:00 to 11:30 | 0.014% | 0.012% | 0.028% | 0.018% | 0.012% | 0.012% | 0.021% | 0.024% | 0.018% | 0.012% | 6.4% | 6.3% | 0.004% | 0.006% | 0.002% | 0.008% |
| 11:30 to 12:00 | 0.008% | 0.005% | 0.004% | 0.002% | 0.007% | 0.010% | 0.001% | 0.001% | 0.006% | 0.003% | 6.0% | 6.0% | 0.002% | 0.013% | 0.004% | 0.021% |
| 12:00 to 12:30 | 0.003% | 0.001% | 0.008% | -0.003% | -0.001% | -0.009% | 0.014% | 0.008% | 0.006% | 0.001% | 5.9% | 5.9% | 0.001% | 0.013% | 0.007% | 0.030% |
| 12:30 to 13:00 | 0.003% | 0.005% | 0.003% | 0.010% | 0.013% | 0.002% | 0.011% | 0.014% | 0.005% | 0.009% | 5.7% | 5.6% | 0.006% | 0.020% | 0.008% | 0.031% |
| 13:00 to 13:30 | 0.000% | 0.003% | 0.011% | 0.003% | 0.011% | 0.005% | 0.005% | -0.001% | 0.005% | 0.004% | 5.8% | 5.8% | -0.008% | 0.003% | -0.008% | -0.003% |
| 13:30 to 14:00 | 0.011% | 0.016% | 0.016% | 0.019% | 0.013% | 0.018% | -0.005% | 0.002% | 0.010% | 0.014% | 5.7% | 5.7% | 0.014% | 0.026% | 0.014% | 0.024% |
| 14:00 to 14:30 | -0.022% | -0.017% | -0.015% | -0.023% | -0.017% | -0.008% | -0.033% | -0.031% | -0.022% | -0.018% | 5.9% | 6.2% | -0.009% | 0.003% | -0.014% | 0.004% |
| 14:30 to 15:00 | -0.005% | -0.009% | -0.003% | 0.003% | -0.044% | -0.033% | 0.002% | 0.001% | -0.007% | -0.007% | 7.7% | 7.8% | 0.002% | -0.001% | -0.000% | 0.003% |

(The block median is the sum of the 5 minute medians, an approximation; the CSV holds every 5 minute slice.)

Volume by time of day: share of the day's regular-session volume in each 30 minute block, all weekdays. Mean across stocks (winners) or days (SPY, QQQ); the median is in brackets. The last block includes the closing auction (the 3:00 PM Central bar).

| Block (CT) | 3x | 4x | 5x | 6x+ | all winners | SPY | QQQ |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 8:30 to 9:00 | 11.1% (10.9%) | 12.1% (10.9%) | 12.5% (11.3%) | 14.0% (13.9%) | 12.0% (11.5%) | 10.5% (9.9%) | 13.7% (13.1%) |
| 9:00 to 9:30 | 7.6% (7.4%) | 8.0% (7.7%) | 8.2% (8.0%) | 9.2% (9.2%) | 8.1% (7.9%) | 8.5% (7.9%) | 9.9% (9.2%) |
| 9:30 to 10:00 | 6.6% (6.5%) | 6.9% (6.7%) | 6.8% (6.8%) | 7.6% (7.6%) | 6.9% (6.8%) | 7.2% (6.5%) | 8.2% (7.4%) |
| 10:00 to 10:30 | 5.8% (5.7%) | 6.0% (5.9%) | 6.0% (6.0%) | 6.5% (6.5%) | 6.0% (6.0%) | 6.2% (5.4%) | 6.9% (6.1%) |
| 10:30 to 11:00 | 5.3% (5.2%) | 5.4% (5.3%) | 5.3% (5.3%) | 5.7% (5.7%) | 5.4% (5.4%) | 5.5% (4.8%) | 6.1% (5.4%) |
| 11:00 to 11:30 | 4.9% (4.8%) | 5.0% (4.9%) | 4.9% (4.7%) | 5.1% (5.1%) | 5.0% (4.9%) | 4.9% (4.3%) | 5.4% (4.6%) |
| 11:30 to 12:00 | 4.7% (4.6%) | 4.7% (4.6%) | 4.7% (4.6%) | 4.8% (4.8%) | 4.7% (4.6%) | 4.7% (4.0%) | 5.0% (4.3%) |
| 12:00 to 12:30 | 4.7% (4.5%) | 4.7% (4.5%) | 4.6% (4.6%) | 4.7% (4.7%) | 4.7% (4.6%) | 4.9% (4.2%) | 5.2% (4.5%) |
| 12:30 to 13:00 | 4.7% (4.6%) | 4.7% (4.5%) | 4.5% (4.4%) | 4.6% (4.5%) | 4.6% (4.5%) | 4.9% (4.2%) | 5.0% (4.3%) |
| 13:00 to 13:30 | 4.9% (4.8%) | 4.9% (4.8%) | 4.8% (4.7%) | 4.9% (4.9%) | 4.9% (4.8%) | 5.9% (5.1%) | 5.7% (4.7%) |
| 13:30 to 14:00 | 5.3% (5.2%) | 5.3% (5.2%) | 5.2% (5.1%) | 5.2% (5.1%) | 5.3% (5.2%) | 6.1% (5.2%) | 5.9% (4.9%) |
| 14:00 to 14:30 | 6.4% (6.3%) | 6.3% (6.3%) | 6.3% (6.3%) | 6.1% (5.9%) | 6.3% (6.3%) | 7.2% (6.4%) | 6.7% (5.7%) |
| 14:30 to 15:00 | 28.1% (27.6%) | 25.8% (23.0%) | 26.2% (24.9%) | 21.4% (21.0%) | 26.1% (24.1%) | 23.6% (22.2%) | 16.4% (15.3%) |

(A block median is the sum of its six 5 minute medians, an approximation.)

Volume by weekday, all winners against SPY and QQQ: share of the day's volume in the first 30 minutes (8:30 to 9:00 CT), the quietest hour (11:30 to 12:30 CT) and the last 30 minutes (2:30 to 3:00 CT, with the closing auction). Mean, median in brackets. Every 5 minute slice per weekday is in the CSV.

| Weekday | Winners, first 30 min | SPY, first 30 min | QQQ, first 30 min | Winners, 11:30 to 12:30 | SPY, 11:30 to 12:30 | QQQ, 11:30 to 12:30 | Winners, last 30 min | SPY, last 30 min | QQQ, last 30 min |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| Mon | 13.2% (12.6%) | 11.6% (10.9%) | 14.8% (14.4%) | 9.3% (8.9%) | 9.1% (8.0%) | 9.9% (8.7%) | 25.2% (23.6%) | 24.1% (22.6%) | 16.1% (15.2%) |
| Tue | 12.1% (11.4%) | 10.4% (9.9%) | 13.8% (13.1%) | 9.4% (9.1%) | 9.9% (8.3%) | 10.6% (8.9%) | 25.8% (23.7%) | 23.8% (22.6%) | 16.7% (15.6%) |
| Wed | 11.6% (11.1%) | 10.0% (9.5%) | 12.9% (12.5%) | 9.3% (8.8%) | 9.1% (7.9%) | 9.8% (8.3%) | 25.9% (24.1%) | 24.0% (22.0%) | 16.4% (14.9%) |
| Thu | 11.7% (11.2%) | 10.4% (9.9%) | 13.8% (13.4%) | 9.6% (9.2%) | 10.1% (8.7%) | 10.5% (9.0%) | 25.8% (23.7%) | 23.4% (22.3%) | 16.4% (15.4%) |
| Fri | 11.6% (11.1%) | 10.1% (9.6%) | 13.1% (12.7%) | 9.4% (8.9%) | 9.6% (8.3%) | 10.1% (8.8%) | 27.9% (26.0%) | 22.7% (21.5%) | 16.5% (15.5%) |


Volume drop off and pick up, Central time (mean curve; median curve in brackets). Each is the middle of a window that may run up to 30 minutes either side.

| Weekday | All winners: drop off | All winners: pick up | SPY: drop off | SPY: pick up | QQQ: drop off | QQQ: pick up | Winner-days | SPY days |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | ----: | ----: |
| All days | 9:21 (9:17) | 14:30 (14:30) | 9:35 (9:14) | 14:25 (14:30) | 9:59 (9:38) | 14:34 (14:40) | 110517 | 536 |
| Mon | 9:26 (9:17) | 14:32 (14:32) | 9:41 (9:14) | 14:26 (14:32) | 9:52 (9:40) | 14:39 (14:42) | 20211 | 98 |
| Tue | 9:29 (9:21) | 14:30 (14:30) | 9:38 (9:21) | 14:27 (14:30) | 9:58 (9:41) | 14:36 (14:41) | 22889 | 111 |
| Wed | 9:18 (9:17) | 14:27 (14:28) | 9:17 (8:51) | 14:04 (14:24) | 9:39 (9:27) | 14:24 (14:37) | 22467 | 109 |
| Thu | 9:22 (9:16) | 14:29 (14:29) | 9:23 (9:14) | 14:25 (14:30) | 9:48 (9:34) | 14:33 (14:39) | 22478 | 109 |
| Fri | 9:16 (9:10) | 14:32 (14:33) | 9:45 (8:52) | 14:27 (14:32) | 10:17 (9:41) | 14:35 (14:42) | 22472 | 109 |

Drop off and pick up by gain group, Central time, all weekdays (mean curve; median curve in brackets):

| Group | Stocks | Drop off | Pick up |
| :---- | ----: | :---- | :---- |
| 3x | 99 | 9:12 (9:08) | 14:29 (14:29) |
| 4x | 51 | 9:20 (9:13) | 14:30 (14:30) |
| 5x | 20 | 9:21 (9:17) | 14:30 (14:29) |
| 6x+ | 38 | 9:42 (9:42) | 14:34 (14:33) |
| all | 208 | 9:21 (9:17) | 14:30 (14:30) |

Full trading days in the period: 536; half days excluded: 5 (2023-07-03, 2023-11-24, 2024-07-03, 2024-11-29, 2024-12-24).

**Top 25 winners by multiple** (all winners in `period-C-winners.csv`):

| Ticker | Company | Group | Multiple | Start | End | Exchange | Beta | Volatility (annualized) | Cap band start | Cap band end | Flags |
| :---- | :---- | :---- | ----: | :---- | :---- | :---- | ----: | ----: | :---- | :---- | :---- |
| CVNA | Carvana Co. Class A Common Stock | 6x+ | 48.46 | 2023-01-03 | 2025-02-28 | NYSE | 3.08 | 118% | up to 1B | over 10B to 50B |  |
| ROOT | Root, Inc. - Common Stock | 6x+ | 30.86 | 2023-01-03 | 2025-02-28 | Nasdaq | 1.32 | 121% | up to 1B | over 1B to 10B |  |
| APP | Applovin Corporation - Class A Common St | 6x+ | 30.13 | 2023-01-03 | 2025-02-28 | Nasdaq | 2.29 | 74% | over 1B to 10B | over 100B to 250B |  |
| SLNO | SOLENO THERAPEUTICS INC COM PA | 6x+ | 23.36 | 2023-01-03 | 2025-02-28 | Nasdaq | -0.85 | 353% | up to 1B | over 1B to 10B | check: overnight price jump x4.74 on 2023-09-26 |
| MSTR | Strategy Inc - Class A Common Stock | 6x+ | 17.53 | 2023-01-03 | 2025-02-28 | Nasdaq | 2.67 | 93% | over 1B to 10B | over 50B to 100B |  |
| INOD | Innodata Inc. - Common Stock | 6x+ | 17.12 | 2023-01-03 | 2025-02-28 | Nasdaq | 3.10 | 120% | up to 1B | over 1B to 10B |  |
| SEZL | Sezzle Inc. - Common Stock | 6x+ | 13.21 | 2023-08-17 | 2025-02-28 | Nasdaq | 3.61 | 149% | up to 1B | over 1B to 10B | moved exchange; check: overnight price jump x0.27 on 2023-09-14 |
| PLTR | Palantir Technologies Inc. - Class A Com | 6x+ | 12.91 | 2023-01-03 | 2025-02-28 | Nasdaq | 2.56 | 69% | over 10B to 50B | over 100B to 250B |  |
| KINS | Kingstone Companies, Inc - Common Stock | 6x+ | 12.17 | 2023-01-03 | 2025-02-28 | Nasdaq | 0.86 | 78% | up to 1B | up to 1B |  |
| WGS | GeneDx Holdings Corp. - Class A Common S | 6x+ | 11.54 | 2023-01-03 | 2025-02-28 | Nasdaq | 1.62 | 127% | up to 1B | over 1B to 10B |  |
| RGTI | Rigetti Computing, Inc.  - Common stock | 6x+ | 11.28 | 2023-01-03 | 2025-02-28 | Nasdaq | 3.35 | 160% | up to 1B | over 1B to 10B |  |
| AAOI | Applied Optoelectronics, Inc. - Common S | 6x+ | 11.27 | 2023-01-03 | 2025-02-28 | Nasdaq | 2.84 | 126% | up to 1B | over 1B to 10B |  |
| ACIC | American Coastal Insurance Corporation - | 6x+ | 11.14 | 2023-01-03 | 2025-02-28 | Nasdaq | 0.85 | 109% | up to 1B | up to 1B |  |
| DAVE | Dave Inc.  - Class A Common Stock | 6x+ | 10.85 | 2023-01-03 | 2025-02-28 | Nasdaq | 1.75 | 97% | up to 1B | over 1B to 10B |  |
| DRUG | Bright Minds Biosciences Inc. - common s | 6x+ | 9.62 | 2023-01-03 | 2025-02-28 | Nasdaq | -2.34 | 1001% | up to 1B | up to 1B |  |
| CLS | Celestica, Inc. Common Stock | 6x+ | 9.46 | 2023-01-03 | 2025-02-28 | NYSE | 2.06 | 54% | over 1B to 10B | over 10B to 50B |  |
| NPCE | Neuropace, Inc. - Common Stock | 6x+ | 9.38 | 2023-01-03 | 2025-02-28 | Nasdaq | 1.42 | 91% | up to 1B | up to 1B |  |
| NVDA | NVIDIA Corporation - Common Stock | 6x+ | 8.41 | 2023-01-03 | 2025-02-28 | Nasdaq | 2.44 | 52% | over 250B to 1T | over 1T |  |
| LMB | Limbach Holdings, Inc. - Common Stock | 6x+ | 7.99 | 2023-01-03 | 2025-02-28 | Nasdaq | 1.77 | 60% | up to 1B | up to 1B |  |
| FTAI | FTAI Aviation Ltd. - Common Stock | 6x+ | 7.57 | 2023-01-03 | 2025-02-28 | Nasdaq | 1.26 | 52% | over 1B to 10B | over 10B to 50B |  |
| SPOT | Spotify Technology S.A. Ordinary Shares | 6x+ | 7.43 | 2023-01-03 | 2025-02-28 | NYSE | 1.19 | 38% | over 10B to 50B | over 100B to 250B |  |
| BBAI | BigBear.ai, Inc. Common Stock | 6x+ | 7.21 | 2023-01-03 | 2025-02-28 | NYSE | 2.20 | 225% | up to 1B | over 1B to 10B | check: overnight price jump x4.29 on 2023-01-12 |
| CIFR | Cipher Digital Inc. - Common Stock | 6x+ | 7.06 | 2023-01-03 | 2025-02-28 | Nasdaq | 3.16 | 126% | up to 1B | over 1B to 10B |  |
| RDW | Redwire Corporation Common Stock | 6x+ | 6.99 | 2023-01-03 | 2025-02-28 | NYSE | 2.20 | 88% | up to 1B | over 1B to 10B |  |
| HIMS | Hims & Hers Health, Inc. Class A Common  | 6x+ | 6.94 | 2023-01-03 | 2025-02-28 | NYSE | 2.06 | 82% | over 1B to 10B | over 10B to 50B |  |

### 5.4 Period D: April 2025 to October 1, 2026

- **Winners:** 265 (3x 121, 4x 49, 5x 34, 6x+ 61) after removing 31. Pharmaceutical companies lead (61)[^7]. The window ends on 2026-10-01 and is still recent.
- **Days:** winners rose on 50.6 percent of days (median 51.1), about the same as SPY (50.8). It is the only period where the overnight share of the gain was close to half (mean 49 percent, median 53); in the other periods it was 55 percent or more. The average day's change from open to close (up or down, signed) was the largest of the four periods (mean 0.35 percent, median 0.30), and so was the typical size of a day's move either way (mean 3.33 percent, median 3.14).
- **Beta and volatility:** the highest of the four periods (beta median 1.48, volatility median 84 percent a year).
- **Time of day:** the first 30 minutes were the best block (mean 0.046 percent, median 0.050) and the last 30 minutes were also positive (0.041). Volume dropped off at 9:22 CT and picked up at 14:32. 3 half days excluded.

Trading days measured: 2025-04-01 to 2026-10-01. Candidates from the 3x monthly screen: 3280; passed the daily pre-check: 579. Removed (change 1): 31.

| Group | Winners | Non-standard start | Multiple, mean | median | Share of days up (close above open), mean | median | Share of days up (close above prior close), mean | median | Overnight share of gain, mean | median | Intraday share of gain, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 121 | 2 | 3.45 | 3.42 | 50.6% | 51.3% | 51.9% | 52.1% | 51% | 49% | 49% | 51% |
| 4x | 49 | 0 | 4.45 | 4.34 | 50.7% | 50.3% | 52.1% | 51.9% | 52% | 55% | 48% | 45% |
| 5x | 34 | 0 | 5.40 | 5.36 | 49.7% | 49.5% | 51.0% | 50.8% | 48% | 56% | 52% | 44% |
| 6x+ | 61 | 0 | 10.47 ⚑ | 7.47 | 51.0% | 51.6% | 52.0% | 51.3% | 42% | 55% | 58% | 45% |
| all | 265 | 2 | 5.50 | 4.17 | 50.6% | 51.1% | 51.9% | 51.9% | 49% | 53% | 51% | 47% |
| SPY (benchmark) | n/a | n/a | 1.37 | | 50.8% | | 54.5% | | 55% | | 45% | |
| QQQ (benchmark) | n/a | n/a | 1.59 | | 52.4% | | 56.9% | | 59% | | 41% | |

| Group | Average up-day gain (close above open), mean | median | Average down-day loss (close below open), mean | median | Average up-day gain (close above prior close), mean | median | Average down-day loss (close below prior close), mean | median | Mean daily open to close, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 3.26% | 2.85% | -2.80% | -2.49% | 3.76% | 3.43% | -3.04% | -2.84% | 0.26% | 0.25% |
| 4x | 3.47% | 3.41% | -2.98% | -3.01% | 4.06% | 3.98% | -3.28% | -3.25% | 0.30% | 0.24% |
| 5x | 4.07% | 4.09% | -3.28% | -3.23% | 4.82% | 4.58% | -3.63% | -3.45% | 0.37% | 0.34% |
| 6x+ | 4.49% | 4.27% | -3.64% | -3.53% | 5.37% | 4.92% | -3.90% | -3.74% | 0.53% | 0.43% |
| all | 3.69% | 3.42% | -3.09% | -2.90% | 4.32% | 3.96% | -3.36% | -3.17% | 0.35% | 0.30% |

| Group | Mean overnight gap, mean | median | Mean daily move, open to close (either way), mean | median | Mean rise from open (high minus open), mean | median | Mean drop from open (open minus low), mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 0.21% | 0.19% | 2.97% | 2.67% | 3.28% | 2.92% | 2.90% | 2.69% |
| 4x | 0.25% | 0.25% | 3.18% | 3.12% | 3.50% | 3.45% | 3.06% | 3.04% |
| 5x | 0.29% | 0.31% | 3.61% | 3.56% | 4.00% | 3.94% | 3.44% | 3.35% |
| 6x+ | 0.36% | 0.35% | 4.02% | 3.99% | 4.52% | 4.24% | 3.71% | 3.55% |
| all | 0.26% | 0.25% | 3.33% | 3.14% | 3.70% | 3.47% | 3.18% | 3.02% |
| SPY (benchmark) | | | 0.54% | | | | | |
| QQQ (benchmark) | | | 0.73% | | | | | |

| Group | Beta against SPY, mean | median | Volatility, daily, mean | median | Volatility, annualized, mean | median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 1.39 | 1.32 | 5.2% | 4.5% | 82.5% | 72.2% |
| 4x | 1.62 | 1.58 | 5.7% | 5.2% | 89.9% | 82.6% |
| 5x | 1.81 | 1.82 | 6.5% | 5.8% | 103.2% | 92.1% |
| 6x+ | 1.74 | 1.58 | 8.8% | 6.6% | 140.2% | 105.3% |
| all | 1.57 | 1.48 | 6.3% | 5.3% | 99.8% | 83.5% |

| Group | Up days above the average up day, close above open (pooled) | Same, close above prior close (pooled) | Winner rose (close above prior close) on days SPY fell or was flat | Same, QQQ | Winner rose open to close on days SPY fell or was flat open to close |
| :---- | ----: | ----: | ----: | ----: | ----: |
| 3x | 37% | 35% | 39% | 38% | 41% |
| 4x | 37% | 36% | 39% | 37% | 41% |
| 5x | 37% | 35% | 36% | 35% | 39% |
| 6x+ | 36% | 34% | 39% | 38% | 42% |
| all | 37% | 35% | 39% | 38% | 41% |

Market cap bands, number of winners (start / end):

| Group | up to 1B | over 1B to 10B | over 10B to 50B | over 50B to 100B | over 100B to 250B | over 250B to 1T | over 1T | unknown |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 68 / 34 | 40 / 56 | 7 / 21 | 2 / 1 | 1 / 3 | 0 / 3 | 0 / 0 | 3 / 3 |
| 4x | 27 / 12 | 18 / 25 | 2 / 7 | 2 / 3 | 0 / 1 | 0 / 1 | 0 / 0 | 0 / 0 |
| 5x | 23 / 13 | 7 / 13 | 2 / 4 | 2 / 2 | 0 / 0 | 0 / 2 | 0 / 0 | 0 / 0 |
| 6x+ | 41 / 18 | 13 / 25 | 4 / 6 | 1 / 6 | 1 / 2 | 0 / 1 | 0 / 2 | 1 / 1 |
| all | 159 / 77 | 78 / 119 | 15 / 38 | 7 / 12 | 2 / 6 | 0 / 7 | 0 / 2 | 4 / 4 |

Daily open-to-close moves, all winners pooled (share of winner-days in each band):

| Band | below -10% | -10 to -5 | -5 to -3 | -3 to -2 | -2 to -1 | -1 to -0.5 | -0.5 to 0 | 0 to 0.5 | 0.5 to 1 | 1 to 2 | 2 to 3 | 3 to 5 | 5 to 10 | 10% and up |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 3x | 1.3% | 6.3% | 8.5% | 7.6% | 10.8% | 6.8% | 6.5% | 8.0% | 6.9% | 11.2% | 8.0% | 9.1% | 6.6% | 2.3% |
| 4x | 1.3% | 7.2% | 9.2% | 7.6% | 10.3% | 6.5% | 5.8% | 7.0% | 6.3% | 10.8% | 7.4% | 10.2% | 7.7% | 2.6% |
| 5x | 1.9% | 8.6% | 9.8% | 7.6% | 9.7% | 6.0% | 5.3% | 6.5% | 5.4% | 9.5% | 7.7% | 9.0% | 9.3% | 3.8% |
| 6x+ | 2.5% | 9.2% | 10.0% | 7.3% | 9.1% | 5.1% | 4.6% | 6.0% | 5.2% | 9.0% | 7.1% | 9.9% | 10.4% | 4.7% |
| all | 1.7% | 7.4% | 9.2% | 7.5% | 10.1% | 6.2% | 5.8% | 7.2% | 6.2% | 10.4% | 7.7% | 9.5% | 8.0% | 3.1% |

Top industries (SEC SIC description, today's label): Pharmaceutical Preparations (61); Semiconductors & Related Devices (28); Biological Products, (No Diagnostic Substances) (16); Finance Services (12); Services-Medical Laboratories (6); Services-Prepackaged Software (6); Instruments For Meas & Testing of  Electricity & Elec Signals (5); Services-Business Services, NEC (5).

Gains by time of day, all weekdays, 30 minute blocks (Central time). Return = mean (or median) across winners of the winner's average log return in that block (SPY and QQQ: mean or median across days); gains and losses = share of all intraday rises (falls) that happened in the block, pooled.

| Block (CT) | 3x mean | 3x median | 4x mean | 4x median | 5x mean | 5x median | 6x+ mean | 6x+ median | all mean | all median | all: share of gains | all: share of losses | SPY mean | SPY median | QQQ mean | QQQ median |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 8:30 to 9:00 | 0.037% | 0.047% | 0.049% | 0.045% | 0.018% | 0.059% | 0.076% | 0.043% | 0.046% | 0.050% | 17.3% | 17.2% | 0.012% | 0.029% | 0.013% | 0.038% |
| 9:00 to 9:30 | -0.007% | 0.001% | -0.001% | 0.004% | 0.023% | 0.005% | 0.015% | 0.001% | 0.003% | 0.004% | 11.2% | 11.3% | 0.007% | 0.022% | 0.007% | 0.026% |
| 9:30 to 10:00 | 0.001% | -0.003% | 0.003% | -0.004% | -0.016% | -0.022% | 0.013% | 0.000% | 0.002% | -0.007% | 8.9% | 9.0% | -0.001% | 0.003% | -0.009% | 0.004% |
| 10:00 to 10:30 | 0.008% | 0.008% | 0.012% | 0.003% | 0.024% | 0.017% | 0.017% | 0.017% | 0.013% | 0.010% | 7.7% | 7.8% | -0.007% | 0.012% | 0.001% | 0.032% |
| 10:30 to 11:00 | 0.018% | 0.012% | 0.015% | 0.017% | 0.018% | 0.023% | 0.015% | 0.021% | 0.017% | 0.017% | 6.8% | 6.8% | 0.005% | 0.010% | 0.007% | 0.016% |
| 11:00 to 11:30 | 0.012% | 0.015% | 0.021% | 0.015% | 0.017% | 0.020% | 0.014% | 0.009% | 0.015% | 0.016% | 6.3% | 6.3% | 0.006% | 0.018% | 0.010% | 0.014% |
| 11:30 to 12:00 | 0.010% | 0.010% | 0.007% | 0.003% | 0.015% | 0.015% | 0.034% | 0.018% | 0.016% | 0.011% | 5.9% | 5.9% | -0.004% | -0.001% | -0.007% | 0.000% |
| 12:00 to 12:30 | 0.014% | 0.023% | 0.028% | 0.036% | 0.031% | 0.037% | 0.030% | 0.038% | 0.022% | 0.027% | 5.8% | 5.8% | 0.015% | 0.014% | 0.020% | 0.016% |
| 12:30 to 13:00 | 0.036% | 0.039% | 0.046% | 0.043% | 0.052% | 0.047% | 0.051% | 0.045% | 0.043% | 0.043% | 5.7% | 5.5% | 0.017% | 0.006% | 0.023% | 0.004% |
| 13:00 to 13:30 | 0.003% | -0.000% | -0.008% | 0.001% | -0.006% | 0.008% | -0.001% | 0.008% | -0.001% | 0.003% | 5.6% | 5.7% | -0.002% | 0.009% | -0.008% | 0.009% |
| 13:30 to 14:00 | -0.013% | -0.017% | -0.011% | -0.022% | -0.012% | -0.017% | -0.017% | -0.015% | -0.013% | -0.015% | 5.4% | 5.6% | -0.013% | -0.009% | -0.017% | -0.017% |
| 14:00 to 14:30 | 0.012% | 0.011% | 0.013% | 0.010% | 0.004% | 0.001% | 0.015% | 0.005% | 0.012% | 0.006% | 5.8% | 5.8% | -0.009% | -0.007% | -0.009% | 0.001% |
| 14:30 to 15:00 | 0.033% | 0.036% | 0.023% | 0.033% | 0.045% | 0.046% | 0.070% | 0.064% | 0.041% | 0.046% | 7.5% | 7.3% | 0.003% | -0.001% | 0.014% | 0.007% |

(The block median is the sum of the 5 minute medians, an approximation; the CSV holds every 5 minute slice.)

Volume by time of day: share of the day's regular-session volume in each 30 minute block, all weekdays. Mean across stocks (winners) or days (SPY, QQQ); the median is in brackets. The last block includes the closing auction (the 3:00 PM Central bar).

| Block (CT) | 3x | 4x | 5x | 6x+ | all winners | SPY | QQQ |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| 8:30 to 9:00 | 10.9% (9.9%) | 11.5% (10.9%) | 13.3% (12.9%) | 13.2% (13.2%) | 11.8% (11.3%) | 11.8% (11.4%) | 14.4% (13.9%) |
| 9:00 to 9:30 | 7.7% (7.4%) | 8.0% (7.7%) | 8.7% (8.7%) | 8.9% (8.8%) | 8.2% (7.9%) | 8.5% (7.8%) | 10.1% (9.4%) |
| 9:30 to 10:00 | 6.5% (6.2%) | 6.6% (6.5%) | 7.1% (7.1%) | 7.3% (7.3%) | 6.8% (6.6%) | 7.2% (6.5%) | 8.3% (7.5%) |
| 10:00 to 10:30 | 5.9% (5.7%) | 5.9% (5.8%) | 6.3% (6.2%) | 6.4% (6.3%) | 6.1% (6.0%) | 6.7% (5.7%) | 7.4% (6.6%) |
| 10:30 to 11:00 | 5.2% (5.0%) | 5.2% (5.1%) | 5.4% (5.4%) | 5.6% (5.5%) | 5.3% (5.2%) | 5.8% (5.0%) | 6.5% (5.6%) |
| 11:00 to 11:30 | 4.8% (4.7%) | 4.8% (4.8%) | 4.9% (4.9%) | 5.0% (4.9%) | 4.9% (4.8%) | 5.2% (4.5%) | 5.8% (5.0%) |
| 11:30 to 12:00 | 4.5% (4.3%) | 4.6% (4.4%) | 4.6% (4.5%) | 4.7% (4.6%) | 4.6% (4.5%) | 4.8% (4.2%) | 5.2% (4.5%) |
| 12:00 to 12:30 | 4.4% (4.2%) | 4.4% (4.3%) | 4.4% (4.4%) | 4.6% (4.4%) | 4.4% (4.3%) | 4.9% (4.2%) | 5.1% (4.5%) |
| 12:30 to 13:00 | 4.5% (4.3%) | 4.5% (4.4%) | 4.4% (4.3%) | 4.5% (4.4%) | 4.5% (4.4%) | 4.8% (4.1%) | 5.1% (4.3%) |
| 13:00 to 13:30 | 4.7% (4.6%) | 4.7% (4.7%) | 4.6% (4.5%) | 4.7% (4.6%) | 4.7% (4.6%) | 5.6% (4.9%) | 5.3% (4.5%) |
| 13:30 to 14:00 | 5.0% (5.0%) | 5.0% (5.0%) | 5.0% (4.9%) | 5.0% (4.9%) | 5.0% (5.0%) | 5.8% (4.9%) | 5.3% (4.5%) |
| 14:00 to 14:30 | 6.2% (6.2%) | 6.2% (6.2%) | 5.9% (5.9%) | 6.0% (6.0%) | 6.1% (6.1%) | 7.2% (6.4%) | 6.1% (5.3%) |
| 14:30 to 15:00 | 29.8% (31.7%) | 28.5% (27.8%) | 25.4% (23.2%) | 24.1% (22.7%) | 27.7% (27.4%) | 21.7% (20.4%) | 15.4% (14.3%) |

(A block median is the sum of its six 5 minute medians, an approximation.)

Volume by weekday, all winners against SPY and QQQ: share of the day's volume in the first 30 minutes (8:30 to 9:00 CT), the quietest hour (11:30 to 12:30 CT) and the last 30 minutes (2:30 to 3:00 CT, with the closing auction). Mean, median in brackets. Every 5 minute slice per weekday is in the CSV.

| Weekday | Winners, first 30 min | SPY, first 30 min | QQQ, first 30 min | Winners, 11:30 to 12:30 | SPY, 11:30 to 12:30 | QQQ, 11:30 to 12:30 | Winners, last 30 min | SPY, last 30 min | QQQ, last 30 min |
| :---- | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: | ----: |
| Mon | 13.0% (12.2%) | 12.7% (12.5%) | 15.5% (15.2%) | 8.9% (8.5%) | 9.5% (8.3%) | 10.5% (9.0%) | 26.9% (26.8%) | 22.0% (20.5%) | 15.7% (14.4%) |
| Tue | 11.7% (11.0%) | 11.6% (11.0%) | 14.3% (13.6%) | 9.3% (8.9%) | 10.1% (9.0%) | 10.8% (9.5%) | 27.4% (27.0%) | 21.7% (20.6%) | 15.5% (14.4%) |
| Wed | 11.5% (10.6%) | 11.5% (11.1%) | 14.0% (13.5%) | 8.9% (8.6%) | 9.4% (8.1%) | 9.6% (8.2%) | 27.2% (26.9%) | 22.1% (20.3%) | 15.5% (14.7%) |
| Thu | 11.7% (11.0%) | 11.9% (11.2%) | 14.7% (14.1%) | 9.1% (8.8%) | 9.9% (8.5%) | 10.5% (9.2%) | 27.3% (27.0%) | 21.0% (20.2%) | 14.7% (13.8%) |
| Fri | 11.5% (10.8%) | 11.6% (11.2%) | 13.8% (13.5%) | 8.8% (8.3%) | 9.6% (8.3%) | 10.3% (9.3%) | 29.6% (29.5%) | 21.4% (20.1%) | 15.7% (14.6%) |


Volume drop off and pick up, Central time (mean curve; median curve in brackets). Each is the middle of a window that may run up to 30 minutes either side.

| Weekday | All winners: drop off | All winners: pick up | SPY: drop off | SPY: pick up | QQQ: drop off | QQQ: pick up | Winner-days | SPY days |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | ----: | ----: |
| All days | 9:22 (9:19) | 14:32 (14:31) | 9:33 (9:14) | 14:24 (14:29) | 10:08 (9:40) | 14:38 (14:43) | 99044 | 375 |
| Mon | 9:26 (9:22) | 14:33 (14:33) | 9:39 (9:20) | 14:19 (14:32) | 9:59 (9:42) | 14:39 (14:43) | 19019 | 72 |
| Tue | 9:26 (9:16) | 14:32 (14:32) | 9:33 (9:15) | 14:26 (14:31) | 10:10 (9:37) | 14:38 (14:43) | 20867 | 79 |
| Wed | 9:23 (9:17) | 14:30 (14:30) | 9:15 (9:10) | 14:16 (14:26) | 9:47 (9:33) | 14:32 (14:39) | 20607 | 78 |
| Thu | 9:20 (9:15) | 14:30 (14:31) | 9:29 (9:13) | 14:27 (14:31) | 10:11 (9:45) | 14:40 (14:43) | 19542 | 74 |
| Fri | 9:19 (9:15) | 14:33 (14:33) | 9:35 (9:15) | 14:26 (14:29) | 10:12 (9:41) | 14:39 (14:43) | 19009 | 72 |

Drop off and pick up by gain group, Central time, all weekdays (mean curve; median curve in brackets):

| Group | Stocks | Drop off | Pick up |
| :---- | ----: | :---- | :---- |
| 3x | 121 | 9:14 (9:08) | 14:30 (14:29) |
| 4x | 49 | 9:19 (9:15) | 14:31 (14:30) |
| 5x | 34 | 9:32 (9:31) | 14:34 (14:33) |
| 6x+ | 61 | 9:37 (9:39) | 14:35 (14:34) |
| all | 265 | 9:22 (9:19) | 14:32 (14:31) |

Full trading days in the period: 375; half days excluded: 3 (2025-07-03, 2025-11-28, 2025-12-24).

**Top 25 winners by multiple** (all winners in `period-D-winners.csv`):

| Ticker | Company | Group | Multiple | Start | End | Exchange | Beta | Volatility (annualized) | Cap band start | Cap band end | Flags |
| :---- | :---- | :---- | ----: | :---- | :---- | :---- | ----: | ----: | :---- | :---- | :---- |
| AXTI | AXT Inc - Common Stock | 6x+ | 58.86 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.33 | 137% | up to 1B | over 1B to 10B |  |
| SNDK | Sandisk Corporation - Common Stock When- | 6x+ | 37.60 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.90 | 105% | over 1B to 10B | over 250B to 1T |  |
| KOD | Kodiak Sciences Inc - Common Stock | 6x+ | 35.29 | 2025-04-01 | 2026-10-01 | Nasdaq | 1.07 | 190% | up to 1B | over 1B to 10B |  |
| TNGX | Tango Therapeutics, Inc. - Common Stock | 6x+ | 17.98 | 2025-04-01 | 2026-10-01 | Nasdaq | 1.63 | 110% | up to 1B | over 1B to 10B |  |
| LITE | Lumentum Holdings Inc. - Common Stock | 6x+ | 16.86 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.30 | 88% | over 1B to 10B | over 50B to 100B |  |
| ABVX | Abivax SA - American Depositary Shares | 6x+ | 15.19 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.10 | 485% | up to 1B | over 1B to 10B | ADR; check: overnight price jump x6.31 on 2025-07-23 |
| SLGL | Sol-Gel Technologies Ltd. - Ordinary Sha | 6x+ | 14.04 | 2025-04-01 | 2026-10-01 | Nasdaq | 0.38 | 116% | up to 1B | up to 1B |  |
| BE | Bloom Energy Corporation Class A Common  | 6x+ | 13.98 | 2025-04-01 | 2026-10-01 | NYSE | 2.47 | 105% | over 1B to 10B | over 50B to 100B |  |
| AEHR | Aehr Test Systems - Common Stock | 6x+ | 13.90 | 2025-04-01 | 2026-10-01 | Nasdaq | 3.41 | 120% | up to 1B | over 1B to 10B |  |
| RLMD | Relmada Therapeutics, Inc. - Common Stoc | 6x+ | 13.65 | 2025-04-01 | 2026-10-01 | Nasdaq | 1.14 | 138% | up to 1B | up to 1B |  |
| MU | Micron Technology, Inc. - Common Stock | 6x+ | 12.40 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.49 | 75% | over 50B to 100B | over 1T |  |
| XMAX | XMAX, Inc. - Common Stock | 6x+ | 12.06 | 2025-04-01 | 2026-10-01 | Nasdaq | 0.36 | 100% | up to 1B | up to 1B |  |
| ANRO | Alto Neuroscience, Inc. Common Stock | 6x+ | 11.72 | 2025-04-01 | 2026-10-01 | NYSE | 1.29 | 114% | up to 1B | up to 1B |  |
| WDC | Western Digital Corporation - Common Sto | 6x+ | 11.54 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.10 | 72% | over 10B to 50B | over 100B to 250B |  |
| STX | Seagate Technology Holdings PLC - Ordina | 6x+ | 11.18 | 2025-04-01 | 2026-10-01 | Nasdaq | 1.75 | 68% | over 10B to 50B | over 100B to 250B |  |
| ROMA | Roma Green Finance Limited - Class A Ord | 6x+ | 11.08 | 2025-04-01 | 2026-10-01 | Nasdaq | 0.65 | 154% | up to 1B | up to 1B |  |
| ERAS | Erasca, Inc. - Common Stock | 6x+ | 10.80 | 2025-04-01 | 2026-10-01 | Nasdaq | 1.24 | 100% | up to 1B | over 1B to 10B |  |
| NBIS | Nebius Group N.V. - Class A Ordinary Sha | 6x+ | 10.72 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.56 | 109% | over 1B to 10B | over 50B to 100B |  |
| SLS | SELLAS Life Sciences Group, Inc.  - Comm | 6x+ | 10.49 | 2025-04-01 | 2026-10-01 | Nasdaq | 1.11 | 97% | up to 1B | over 1B to 10B |  |
| TXG | 10x Genomics, Inc. - Common Stock | 6x+ | 10.24 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.04 | 72% | over 1B to 10B | over 10B to 50B |  |
| CYPH | Cypherpunk Technologies Inc. - Common St | 6x+ | 9.87 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.61 | 344% | up to 1B | up to 1B |  |
| CLYM | Climb Bio, Inc. - Common Stock | 6x+ | 9.07 | 2025-04-01 | 2026-10-01 | Nasdaq | 1.29 | 91% | up to 1B | up to 1B |  |
| MXL | MaxLinear, Inc - Common Stock | 6x+ | 8.58 | 2025-04-01 | 2026-10-01 | Nasdaq | 2.58 | 109% | over 1B to 10B | over 1B to 10B |  |
| BW | Babcock & Wilcox Enterprises, Inc. Commo | 6x+ | 8.23 | 2025-04-01 | 2026-10-01 | NYSE | 2.96 | 147% | up to 1B | up to 1B |  |
| ORKA | Oruka Therapeutics, Inc. - Common Stock | 6x+ | 8.19 | 2025-04-01 | 2026-10-01 | Nasdaq | 1.19 | 74% | up to 1B | over 1B to 10B |  |

## 6. Across the periods

**The same in every period**

- Winners rose on about half their days (close above open, mean 48.8 to 50.6 percent, medians within a point), below SPY in A, B and C and level with it in D. Means and medians agree on this, so run 1's main finding holds with means.
- Winners rose on 36 to 39 percent of the days SPY fell or was flat. They did not avoid down markets.
- Bigger winners were more volatile: in every period the 3x group had the lowest median volatility and the 6x+ group the highest (for example D: 72 against 105 percent a year). The 6x+ group's median beta was above the 3x group's in every period; the groups between do not always rise in order.
- Most winners started at up to 1B in market cap (56 to 75 percent).
- **Volume shape:** heavy at the open, quiet from about 11:00 AM to 1:00 PM CT (the quietest 5 minutes are near 12:10 to 12:25 CT, about 0.75 percent of the day), and heaviest at the close. Winners drop off between 9:11 and 9:22 CT and pick up between 14:26 and 14:32 CT, within 11 minutes of each other across periods. Both times fall inside the 30 minute window that each one carries.
- **Against the measuring sticks:** winners drop off earlier than SPY (by 11 to 23 minutes) and much earlier than QQQ (by 31 to 47 minutes). They pick up a little later than SPY (by 3 to 14 minutes) and a little earlier than QQQ (by 2 to 6 minutes).
- **The close is bigger for winners:** 26 to 29 percent of their day's volume in the last 30 minutes, against 22 to 24 for SPY and 15 to 18 for QQQ.
- Rises and falls bunch at the same times: the first 30 minutes hold about 16 to 17 percent of both.

**What differs**

- **Size of daily moves:** median daily move from 1.68 percent (A) to 3.14 percent (D); volatility median 43 percent a year (A) to 84 percent (D).
- **Overnight against intraday:** B's gains came almost all overnight (median 92 percent); D's came about half overnight (median 53 percent).
- **Best time of day for returns:** no block is best in every period (section 2.7). The first 30 minutes lost money on average in B and were the best block in D.
- **Group with the earliest drop off:** in every period the 3x group drops off earliest and the 6x+ group latest (by 17 to 33 minutes, mean curve), so the biggest winners keep trading heavily for longer after the open.

## 7. What would undercut the idea

This run tests no trading idea; it describes winners picked with hindsight. These findings would weaken the use of its patterns in any later strategy:

- **Hindsight.** If the same patterns (about half the days up, volume shape, overnight share) show up just as often in stocks that did *not* become winners, they say nothing about winners. This run has no comparison group of non-winners; a later run would need one.
- **Survivorship.** If putting the 155 removed companies back changes the results a lot, the findings depend on the removal (section 2.1). Most removed companies were acquired, so they were mostly winners bought out, not failures.
- **Different results across periods.** The best time of day for returns flips between periods (section 2.7). If a later period also differs, there is no stable time of day effect for returns.
- **Returns too small to trade.** The best 30 minute block averages 0.01 to 0.05 percent a day. If spreads and slippage in these stocks at Michael's order size are larger than that, which is likely for thin stocks but not measured here (change 9, section 8), any time of day effect on returns is gone after costs.
- **Thin stocks steering the averages.** 411 winners had no trade in over half their regular minutes (section 4.3). If the volume and return patterns change when only the liquid winners are kept, the averages above are driven by thin stocks. This was not tested.
- **Volume times that are artifacts of the method.** If a different smoothing or reference level (section 3.8) moves the pick up or drop off by more than 30 minutes, the times say more about the method than about the market. For all winners the mean curve and the median curve agree within 15 minutes on every weekday. For SPY and QQQ the drop off differs by up to 53 minutes between the two curves (SPY, period C, Fridays), because a few very busy mornings pull the mean up; their drop off times are less certain than the winners'. Pick up times agree within 20 minutes.
- **Half days misread.** Half days are inferred from SPY's minute bars (section 3.6). If an official calendar shows a day classified wrongly, that day's numbers move slightly; the earlier rule missed three, which this run found and fixed.

## 8. Open questions

- **Execution cost for these stocks.** Spreads and slippage for the winners at Michael's order size are not measured in this repo (change 9, run 2[^5]). The 1 minute bars hold trades, not quotes, so they cannot answer it. Alpaca's historical quotes on the same free data host could, in a later run.
- **Survivorship.** How different are the results with the removed companies put back? `removed.csv` lists them with run 1's flag text, so a later run can report both views side by side.
- **Picked with hindsight.** Every winner was chosen because it ended at 3x or more. Whether any of these patterns show up *before* a stock becomes a winner is untested, and is the question a trading rule would need answered.
- **Pre-2016 data.** Period A is still a 2016 to 2020 stand-in. Run 1's section 3.2 lists the paid sources and their published prices[^4]; none was bought.
- **Several share classes.** Market caps add all classes at the listed class's price, which overstates companies whose other classes trade at a discount or carry different rights.
- **Predecessor filings.** 19 market cap values come from a predecessor company's or a former ticker holder's filings (section 4.4). Whether to treat those winners as the same company is Michael's call.
- **The three "new shares" forms.** All three of run 1's forms were removed (section 3.2). If Michael wants only the bankruptcy form removed, `removed.csv` has the exact flag text to reverse it.
- **Half days.** Detected from SPY's own minute volume, not from an exchange calendar (section 3.6). An official calendar from a free source not on the trading host would confirm the list.
- **Pick up and drop off method.** The even-level crossing is one reasonable rule among several. A different smoothing or reference level would move the times by minutes, not hours; the CSVs allow any other rule to be tried.

## 9. Sources

Strength labels follow `runs/run-3-deliverable.md` section 5: A is primary and authoritative (a regulator, an exchange, or the vendor's own documentation, pricing or terms, seen live); B reputable independent press or an established reference publisher; C review and comparison sites with a commercial incentive; D forums, social posts and personal sites. Access dates are U.S. Central time.

| # | Source | URL | Accessed | Strength |
| :---- | :---- | :---- | :---- | :---- |
| 1 | Alpaca Market Data API, historical stock bars (data host only; monthly, daily, unadjusted daily and 1 minute bars, `sip` feed) | https://data.alpaca.markets/v2/stocks/bars | 2026-11-05 (run 1's cache) and 2026-11-21 | A |
| 2 | Alpaca, About Market Data API (free plan: history "Since 2016", 200 calls a minute) | https://docs.alpaca.markets/docs/about-market-data-api | 2026-11-05 (run 1's source 2) | A |
| 3 | Nasdaq Trader symbol directory, nasdaqlisted.txt and otherlisted.txt | https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt and https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt | 2026-11-05 (run 1's cache) | A |
| 4 | Strategy run 1 deliverable, its method (section 2) and coverage (section 3) | `strategy/runs/strategy-run-1-deliverable.md` | 2026-11-21 | A (own earlier run) |
| 5 | Strategy run 2 deliverable, section 1 (fees) and section 6 (the 0.27 percent figure) | `strategy/runs/strategy-run-2-deliverable.md` | 2026-11-21 | A (own earlier run, citing Alpaca, SEC and FINRA) |
| 6 | SEC fails-to-deliver data, 413 half-month files, July 2009 to 2026 | https://www.sec.gov/data-research/sec-markets-data/fails-deliver-data | 2026-11-05 (run 1's cache) | A |
| 7 | SEC EDGAR submissions API (filings, 8-K items, SIC, Form 25) | https://data.sec.gov/submissions/ | 2026-11-05 and 2026-11-21 | A |
| 8 | SEC EDGAR XBRL company facts API (EntityCommonStockSharesOutstanding) | https://data.sec.gov/api/xbrl/companyfacts/ | 2026-11-05 and 2026-11-21 | A |
| 9 | SEC EDGAR full-text search and company name lookup | https://efts.sec.gov/LATEST/search-index | 2026-11-05 and 2026-11-21 | A |
| 10 | SEC, Accessing EDGAR Data (maximum 10 requests a second; this run stayed near 4) | https://www.sec.gov/os/accessing-edgar-data | 2026-11-05 (run 1's source 10) | A |
| 11 | SEC EDGAR filing folders: XBRL cover pages (R1.htm) and 20-F main documents, one URL per value in `market-cap-sources.csv` (for example Carvana's 10-Q of 2022-11-03) | https://www.sec.gov/Archives/edgar/data/1690820/000169082022000313/R1.htm | 2026-11-21 | A |
| 12 | Yahoo Terms of Service, section 2 (no automated collection without prior permission) | https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html | 2026-11-05 (run 1's source 12) | A |
| 13 | Further research for market cap gaps: share counts read by hand from SEC filings (10-K, 10-Q, 20-F, 40-F, 6-K, prospectuses), each value's URL, access date and quoted text in `market-cap-sources.csv` (method "further research, SEC filing read by hand") | https://www.sec.gov/Archives/edgar/data/ (one URL per value in the CSV) | 2026-11-21 | A |
| 14 | SEC company tickers with exchange | https://www.sec.gov/files/company_tickers_exchange.json | 2026-11-05 (run 1's cache) | A |
| 15 | Alpaca 1 minute bar probe (closing auction volume in the 16:00 bar, bars per day): `strategy/scripts/probes/r3-probe-1-minute-bars.ts` | https://data.alpaca.markets/v2/stocks/bars | 2026-11-21 | A (own measurement) |

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
