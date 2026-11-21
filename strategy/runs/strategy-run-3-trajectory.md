# Strategy run 3 trajectory

## 1. The brief as given

# Strategy run 3 brief: bull market winners, revised, with 1 minute detail

## Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:

- Launched from `~/Projects/sib-tech` in a fresh session, with no other Claude Code session working in this repo.
- Model: Opus 5.5, medium effort. Advisor: on, Opus 5.5. Auto-mode: on.
- Playwright MCP confirmed connected with `/mcp` before pasting.
- Copied from the raw file in TextEdit.

## What changed from the previous runs

- Strategy run 1 (`strategy/runs/strategy-run-1-deliverable.md`) described Nasdaq and NYSE stocks that ended at 4x or more in four bull market windows, from daily bars. Read it, its trajectory and its scripts in `strategy/scripts/` first. Reuse its method, scripts and cached data in `strategy/data/` wherever they still apply.
- Strategy run 2 (`strategy/runs/strategy-run-2-deliverable.md`) researched trading costs. Use it for anything this run says about costs.
- Levers: context and instructions, several changes at once. Michael approved this as an exception to the one change per run rule. Report each change on its own in the deliverable, so its effect can be seen separately.
- Run 1's and run 2's files are not edited. This run writes new files.
- Nothing in this run is financial advice. Say so in the deliverable and on the page.

### The changes, all Michael's rulings

1. Remove every company carrying any of these flags, and the flags themselves: shell (SPAC) merger, new shares after bankruptcy, missing earnings date, delisted, acquired. List the removed companies with their flag in a CSV, and give the count per period. Michael accepts the survivorship bias this brings back. Say so plainly in the deliverable.
2. Add a 3x group (at least 3, under 4) in every period, including the 2016 stand-in for period A. The groups are now 3x, 4x, 5x and 6x+. Every rule from run 1 applies to 3x, including change 1.
3. Means as well as medians: everywhere run 1 reports a median (multiple, share of days up, overnight and intraday share of gain, daily move, rise and drop from the open, and the rest), also report the mean. On the HTML page, a mean or median switch, mean by default, with a visible flag on any value where the two differ a lot. State the threshold you use for "a lot".
4. Per company, over its measured window: beta against SPY and volatility (the spread of daily returns). State the method for each (for example daily close to close returns, and whether volatility is daily or annualized).
5. Market cap: fill as many missing values as possible from further research, for example for an ADR its home market listing with the ADR ratio, or financial sites such as CNBC or Yahoo Finance. Source every value with URL and access date. If all fails, label it "unknown". Add a market cap filter on both the start and the end value, with these bands: up to 1B; over 1B to 10B; over 10B to 50B; over 50B to 100B; over 100B to 250B; over 250B to 1T; over 1T; and unknown.
6. 1 minute bars for every winner in every period, from Alpaca's free history (the research keys in `strategy/.env.local`, market data host only). Record missing minutes and late starting histories per stock.
7. Gains by time of day, from the 1 minute bars: where inside the trading day the winners' gains and losses happen. You choose the time slices (30 minutes or finer). Report times in Central time, with means and medians.
8. Volume by time of day, for the winners, SPY and QQQ:
   - Measure each time slice's share of that stock's daily volume.
   - Market hours only: 8:30 AM to 3:00 PM Central.
   - Every full trading day in all four periods. Half days excluded.
   - Shown separately for Monday, Tuesday, Wednesday, Thursday and Friday, within each period, with the winners, SPY and QQQ side by side.
   - Report when volume picks up and when it drops off, as Central times. Each time is roughly the middle of a window that may run up to 30 minutes either side. State your method for deciding where a pick up or drop off begins.
9. Costs: do not repeat run 1's 0.27 percent framing. Where costs matter, cite run 2: regulatory fees are fractions of a cent per trade, and the measured cost on paper was execution (spread, a lagging feed, stop slippage), on a placeholder strategy, so it does not carry over to these stocks.

### Unchanged from run 1

- The four windows: the A stand-in (January 4, 2016 to January 31, 2020; no data is bought for before 2016), B (April 2020 to January 2022), C (January 2023 to February 2025), D (April 2025 to the close of October 1, 2026).
- The universe, the winner rules, split adjusted not dividend adjusted prices, the new listing and moved exchange rules, both up day definitions, SPY and QQQ as measuring sticks only, today's industry labels.
- Order of work: B, C and D first, then the A stand-in.

## Step zero: save this brief

1. Check the date with `date`.
2. Write this entire brief, verbatim and unedited, to `strategy/runs/strategy-run-3-brief.md`.
3. Create `strategy/runs/strategy-run-3-trajectory.md` and paste this brief into its first section.

## Step one: checks before downloading

1. Confirm `strategy/.env.local` still holds both research key names with values, without printing them, and that Git still ignores it.
2. Check free disk space. If under 30 GB is free, stop and tell Michael how much is free and how much the 1 minute pull needs (estimate). Otherwise continue.

## The goal

When this run is done, Michael can see, per bull market window, the 3x and better winners without the removed categories, with means and medians, beta, volatility and market cap bands, and he can see when during the day those winners gained and lost, and when trading volume picks up and drops off on each weekday.

## The sources

Use:
- Alpaca market data with the research keys, the SEC's free data, and the sources run 1 used.
- Live web research, and Playwright for pages that need JavaScript, for market caps and anything new.
- `strategy/runs/` (runs 1 and 2), `strategy/scripts/`, `strategy/data/`, `CLAUDE.md` and `PROJECT_STATE.md`.

Ignore:
- Anything in `~/Projects/relii`.
- Anything under `stacks/`, and every stack key, account, database, deployment, Discord server and heartbeat check.
- Your own recalled knowledge as evidence. Every data claim needs a source.

If a source asks for contact details, do not supply Michael's or anyone's. Use a generic client name with no personal information. If it then refuses, record a dead end.

## Code and data

- Code under `strategy/scripts/`, extending run 1's. Node 24, no installed packages unless needed; any dependency stays inside `strategy/` and is named in the trajectory.
- Raw downloads, including every 1 minute bar, go in `strategy/data/` (git ignored) and are never committed.
- Committed outputs: summaries and the files the page needs, no file over 50 MB (compress or split above that), never over GitHub's 100 MB limit.
- One documented command rebuilds every output from the cached raw data. Put it in the deliverable.
- Respect every source's published rate limits. Do not run two download jobs against one source at the same time.
- Do not edit `CLAUDE.md`, `builds/`, `runs/`, `stacks/`, `scripts/`, `.githooks/`, or run 1's and run 2's files.

## The output

Build in this order: CSVs and the markdown first, then the trajectory's self assessment, then the HTML. A short session must still leave a complete markdown answer.

### CSVs, in `strategy/runs/strategy-run-3-data/`

- Per period: a winners file (one row per winner, run 1's columns plus beta, volatility, market cap bands and the market cap source) and a daily file (run 1's columns).
- Time of day: gains by time slice and volume share by time slice, per period, per weekday, for the winners (by group), SPY and QQQ.
- Shared: benchmarks, removed companies with their flag, excluded companies with the reason, market cap sources.

### `strategy/runs/strategy-run-3-deliverable.md`, the source of record

1. Summary in bullets: counts per period and group, and the most important findings.
2. Each of the nine changes, one short section each: what changed and what it did to the results (for example run 1 counts against run 3 counts for 4x and above).
3. Definitions and method, including beta, volatility, the mean and median flag, the time slices and the pick up and drop off method.
4. Data sources and coverage, including missing minutes, late histories and market cap gaps.
5. One section per period: counts, winners table (or its top, with the CSV named), daily measures by group (means and medians), the market cap band breakdown, gains by time of day, and volume by time of day per weekday with the pick up and drop off times in Central time.
6. Across the periods: what is the same and what differs, including the volume windows.
7. What would undercut the idea.
8. Open questions.
9. Sources: numbered footnotes on every claim, linking to a sources list with URL, access date and a strength label (the same scale as `runs/run-3-deliverable.md` section 5).

Formatting: bullets and tables, no paragraph longer than three sentences, plain English, acronyms defined the first time, no em or en dashes. Michael is a non-coder.

### `strategy/runs/strategy-run-3-deliverable.html`, the interactive view

- Keep run 1's page design as the starting point; Michael liked it. Expect design iterations later.
- Overview tab, one tab per period, a time of day view (gains and volume, with a weekday selector), and a sources tab.
- Filters: gain group (3x, 4x, 5x, 6x+), industry, remaining flags (such as new listing, moved exchange, ADR), market cap band at start and at end (including unknown).
- The mean or median switch, mean by default, with the large difference flag.
- Volume charts: share of daily volume through the day, winners against SPY and QQQ, per weekday, with the pick up and drop off times marked in Central time.
- It opens with a double click on Michael's Mac, with no server. Charting libraries may load from a public CDN. The 1 minute data is too large to embed: the page shows the summaries, and says where the detail lives.
- The page holds no claim the markdown lacks; the markdown wins any disagreement.
- Test it with Playwright, served locally: every tab, filter and switch, at desktop and phone width.

## The standard

Michael accepts the work when all four hold:

1. Every dataset named with its provider and access date.
2. Data gaps and survivorship disclosed, including the bias from removing the flagged companies.
3. Every number reproducible by a committed script, with the command stated.
4. You state what evidence would undercut the idea.

Every paid option, if any comes up, carries its price, labeled "published" or "gated". Nothing is bought.

## Documenting your work: `strategy/runs/strategy-run-3-trajectory.md`

Append as you work, not at the end, so a session that runs out of context still leaves a usable trail. Six parts: the brief as given, the sequence of what you did, sources with URL and access date, decision points with reasons, dead ends, and a self assessment against the standard. Do not record time spent or token cost.

## Run conventions

- Add one line to `strategy/runs/README.md`: "3", the date, "context and instructions: run 1 revised (nine changes, approved exception), 1 minute bars, time of day", outcome.
- Add one dated line to `PROJECT_STATE.md` under Completed, pointing to the deliverable. Change nothing else in that file.
- Before the commit, run `node scripts/secret-scan.mjs --tree`, and separately confirm that neither research key value appears in any staged file, without printing the values.
- Done means all files written, the page browser tested, the index and the `PROJECT_STATE.md` line written, and one commit and one push at the end of the run. Auto-mode's research run carve-out covers that commit and push. If the push is blocked, do not work around it: tell Michael to run `! git push origin main`.
- Then end the session. Do not start another run.

## Prohibitions

- No live trading.
- No orders of any kind, paper or live, from strategy work. Never call a trading host.
- Nothing touching the stacks' resources: their folders, accounts, keys, databases, deployments, Discord servers or heartbeat checks.
- No credentials in files or commits, other than the two values already in the git ignored `strategy/.env.local`.
- No account creation, signups, trials or purchases, anywhere.
- No reading `~/Projects/relii`.
- Never send Michael's personal information to any site or service, including in request headers, and do not disguise automated requests as a regular browser. If a page refuses plain requests, read it with Playwright or skip it and record it.
- Give these prohibitions, word for word, to any helper you start.


## 2. Sequence of what was done

- 2026-11-21 11:26 PST (1:26 PM CT): `date` checked. Brief saved verbatim to `strategy/runs/strategy-run-3-brief.md`; this file created.

- Step one: `strategy/.env.local` holds both research key names (`ALPACA_RESEARCH_API_KEY_ID`, `ALPACA_RESEARCH_API_SECRET_KEY`) with values (checked by a Node parser, values not printed); Git ignores it (`.gitignore` rule `.env.*`) and `strategy/data/` (rule `strategy/data/`). Free disk: 81 GB of 228 GB, above the 30 GB stop line, so the run continued.
- Read run 1's deliverable (all sections), run 1's scripts (`common.ts`, `periods.ts`, `alpaca-data.ts`, `sec.ts`, `03-screen.ts`, `04-fetch-daily.ts`, `05-build.ts`, `06-outputs.ts`, `07-sizing-audit.ts`, `rebuild.sh`, probes README) and run 2's summary and section 6 (the 0.27 percent figure).
- Advisor consulted before building. Points taken: new r3 scripts and a new work folder so run 1's files and outputs are never overwritten; reproduce run 1's counts first; one Alpaca job at a time (the build step also calls Alpaca for market cap bars); probe the minute pull; write minute files atomically; explicit America/New_York conversion (this Mac runs on Pacific time); check where the closing auction volume lands; flag rule with both a relative and an absolute threshold; embed data in the HTML for double click use.
- Wrote `scripts/r3-common.ts` (run 3 paths, the 3x threshold, the five removal flags) and `scripts/r3-03-screen.ts` (run 1's monthly screen, threshold 3x, output to `data/work/r3/`). Result: the deduplicated monthly index is byte identical to run 1's (21,808 symbols kept); candidates A 2,857, B 3,505, C 3,439, D 3,280 (run 1 at 4x: 1,885, 2,314, 2,622, 2,310; every run 1 candidate is in the run 3 list).
- Wrote `scripts/r3-04-fetch-daily.ts` (run 1's daily fetch for the new candidates only, same cache folder and window). Fetched B 1,189, C 817, D 970, A 972 new symbols from Alpaca's market data host, `sip` feed, split adjusted.
- Wrote `scripts/r3-05-build.ts`: a mechanical copy of run 1's `05-build.ts` with four edits (candidates and index from `data/work/r3/`, the 3x threshold in the pre-check and the winner test, the 3x group, beta and volatility per winner) writing `data/work/r3/period-<P>.json`. The removals are applied later, in the outputs step, so each change can be counted on its own. Started it for B, C, D, A.
- Wrote `r3-07-fetch-minute.ts` (minute pull, atomic file writes, a self-imposed time limit, progress and done marker files), `r3-08-time-of-day.ts` (coverage, gains and volume by 5 minute slice, half day detection from SPY, pick up and drop off), `r3-09-outputs.ts` (CSVs, summary JSON, summary tables, mean and median with the flag), `r3-06-caps.ts` and `r3-cover.ts` (market cap fill from SEC cover pages and ADR ratios), `r3-10-html.ts` (the page, a copy of run 1's design extended), and `probes/r3-probe-1-minute-bars.ts`, while the build ran.
- One SEC request by hand (not a download job) to test the cover page idea: Carvana's 10-Q filed 2022-11-03, `R1.htm`, lists Class A 105,947,745 and Class B 82,900,276 shares; the company facts file has no `EntityCommonStockSharesOutstanding` for Carvana, AppLovin, Palantir or Shopify, which is why run 1 left them blank.
- Build, period B: 662 winners (3x 308, 4x 137, 5x 77, 6x+ 140). The 354 winners at 4x and above are exactly run 1's 354, same tickers and same multiples (checked symbol by symbol). So run 1's method reproduces.
- Build, all periods (`r3-05-build.ts`): A 311 winners (3x 160, 4x 50, 5x 38, 6x+ 63), B 662 (308, 137, 77, 140), C 232 (107, 57, 22, 46), D 296 (132, 55, 36, 73). At 4x and above every period equals run 1 symbol for symbol (A 151, B 354, C 125, D 164) with identical multiples. Excluded after measurement: A 73, B 187, C 163, D 115; other exchanges A 35, B 71, C 8, D 22.
- Probe `probes/r3-probe-1-minute-bars.ts` (Alpaca, 5 stock-days): bars per day 276 to 775 including extended hours (390 regular minutes for liquid names, 274 to 299 for thin ones); 95 to 106 bytes per bar as JSON. The 16:00 Eastern bar holds 2.1 to 10.8 percent of the daily bar's volume (the closing auction). Regular minutes plus the 16:00 bar are 85 to 99 percent of the daily bar's volume; for SPY the rest is after-hours prints that Alpaca's daily volume includes.
- Market caps (`r3-06-caps.ts`), pass 1 (company facts, then cover pages, then ADR ratios from cover pages): unknown 157 of 2,692 values. One SEC folder answered 504 (server error) five times in a row; made such failures count as "no cover page" rather than stop the run; on the rerun it answered.
- Pass 2 added the ADR ratio from the 20-F's own text. First version matched an outdated ratio deep in EDU's report (one ADS for four shares, changed in 2011), giving 1.15B instead of about 4.6B. Fixed by reading only the cover section (first 25,000 characters of text) and skipping a match right after the word "from" ("changed from ... to ..."). Result: company facts 2,173 values, cover pages 319, ADR 62, unknown 138 (of 2,692). Spot checks: EDU now ratio 1, 4.61B; Gravity (GRVY) ratio 2 in 2016 and 1 in 2020, and its cap growth (20.3x) matches its price multiple (20.47x), consistent with a ratio change; Daqo (DQ) 25 shares per ADS in 2016 and 2020.
- Removed companies (change 1): A 33, B 67, C 24, D 31 winners removed. At 4x and above: A 151 to 131, B 354 to 313, C 125 to 109, D 164 to 144.
- Started the minute pull in the background (`r3-07-fetch-minute.ts 600`, stops itself after 600 minutes): 1,346 winners plus SPY and QQQ per period, 757,751 winner-days; estimate about 417 million bars (at 550 a day, from the probe), about 41,700 requests, about 232 minutes at 180 requests a minute. Progress in `data/work/r3/minute-progress.txt`.
- Started one helper agent (general purpose, prohibitions given word for word) to research the 138 unknown market cap values on the web, writing to a scratchpad file; no Alpaca calls, no Yahoo.
- Tested `r3-08-time-of-day.ts` on the first 40 B winners. Half-day detection first used "no SPY bar at or after 14:00 Eastern" and found 0 half days in B: after an early close, extended-hours trading still prints bars. Looked at SPY's minutes: 2020-11-27 morning (9:30 to 13:00) 23.4 million shares, after 13:01 3.6 million (15 percent); 2020-12-24 20.3 and 4.5 million (22 percent); the full day 2020-11-25 20.2 and 14.9 million (73 percent). Rule changed to "afternoon volume under 30 percent of the morning's": it finds exactly 2020-11-27, 2020-12-24 and 2021-11-26 in B (460 full days).
- Quick page test (Playwright against a local server on 127.0.0.1, because Playwright blocks `file://` pages): first load threw an error because the mean or median switch was missing from the header (a text replacement had not applied); fixed. The volume chart was squashed by the closing-auction slice (about 12 percent), so the axis now stops at 6 percent with the cut value labelled; the 5 minute return line was noisy, so returns are shown as 30 minute bars (the bar chart gained a signed axis).
- The market cap helper returned share counts read from SEC filings for all 138 unknown values (a working file outside the repo, converted to the committed `scripts/r3-manual-caps.json`, which is the record). Its caveats: 19 values come from a predecessor company's filings (for example Apache for APA, Marvell Technology Group for MRVL, old IAC for PPLI 2016) or from the company that used the ticker at the time (Del Taco for TACO, Bazaarvoice for BV 2016, RADA for DRS); GOL and GGB trade as preferred-share ADSs. Decision: use them all except GOL and GGB, apply a ratio wherever one is given, and keep run 1's consistency check.
- Market caps after the helper: company facts 2,173 values, cover pages 319, ADR 61, further research 121, unknown 18 (10 winners). 16 of the 18 are set unknown by run 1's consistency rule (share counts grew or shrank more than 20 times relative to the price multiple: PLL, NNDM, WULF, AHG, DMRA, FTH, TRON, CHRN; the helper reports real share growth for WULF, DMRA, TRON and AHG and reverse splits for FTH and CHRN); 2 are GOL and GGB.
- On that rerun two SEC cover page requests failed after retries (server errors); the totals did not change. SEC failures are not cached, so a rebuild retries them; a rebuild on a day SEC fails could fill fewer values.

- Minute pull finished (`minute-done.txt`): 1,354 files (1,346 winners plus SPY and QQQ in each period), 22,001 requests, 213,308,689 bars, no failures. Fewer requests than estimated because thin stocks have fewer bars a day than the probe's average.
- Michael's go (2026-11-21, about 4:20 PM CT), with two reminders: pick up and drop off as Central times, each the middle of a window up to 30 minutes either side, for each weekday separately with half days excluded, means and medians throughout; and if the push is blocked, stop and tell him to run `! git push origin main`.
- Ran `r3-08-time-of-day.ts B C D A` and `r3-09-outputs.ts`. Added to the summary tables: medians beside means in the volume table, a per-weekday volume table (first 30 minutes, the quietest hour, the last 30 minutes, for winners, SPY and QQQ), and pick up and drop off per gain group. Run 1's "market cap missing" flag is now restated from run 3's caps ("market cap unknown (start)", "(end)" or "(start and end)"), because most of those values are now filled.
- Checked the half-day list against the dates on which early closes usually fall. The 30 percent rule missed 2019-11-29, 2024-11-29 and 2024-12-24: SPY's afternoon volume on those days was 33 to 40 percent of its morning's, but it had only 320 to 344 regular minute bars instead of 390. A sharper cliff test (13:01 to 13:30 against 12:30 to 12:59) did not separate either. Counted SPY's regular bars per day in all periods: 2,385 of 2,409 days have all 390; of the 24 others, 4 are full days with ratios 0.74 to 1.01 and 20 are early closes with ratios 0.03 to 0.40, while a 390-bar day can go as low as 0.39 (2025-07-16). New rule: under 390 bars AND ratio under 0.50. Half days now A 9, B 3, C 5, D 3. Reran `r3-08` and `r3-09`.

- Wrote the remaining deliverable sections (summary, change effects 6 to 8, minute coverage, period notes, across, undercut, open questions) from `summary-tables.md`, `summary.json`, `minute-coverage.csv` and `volume-pickup-dropoff.csv`, checking each figure against those files. Corrections made while checking: the best return block's range (0.01 to 0.05 percent, not 0.03 to 0.05; period A's is 0.013), volatility by group (3x always lowest and 6x+ always highest by median, but not in order between), and the mean and median curves' agreement (within 15 minutes for all winners, up to 53 minutes for SPY's drop off).
- Market cap wording aligned with the data: the helper's values are labelled "further research, SEC filing read by hand" everywhere; no financial site was used (Yahoo's terms forbid automated collection, run 1's source 12).
- Assembled `runs/strategy-run-3-deliverable.md` from the hand-written sections and the generated `summary-tables.md` with a short working script outside the repo (it only pastes text; section 5's tables are copied verbatim from `summary-tables.md`): no pending markers, no em or en dashes, every footnote 1 to 15 used, no paragraph over three sentences (checked by script).

- Rebuilt the page (`r3-10-html.ts`) and tested it with Playwright against a local server on 127.0.0.1 (Playwright refuses `file://` pages), at 1400 by 900 and 390 by 844. Each pass: all 7 tabs; both mean and median settings; in each period every gain group checkbox off and on, every option of the industry, flag, start band and end band filters (checking that industry and band options add up to the period's winner count), the search box, and every sortable column; on the Time of day tab all 120 combinations of period, weekday and winner group. Checked for script errors, "NaN" or "undefined" on the page, sideways scrolling and chart labels past the screen edge.
  - Found and fixed: industry options with no results (A 5, B 12, C 4, D 6), because an option without a value attribute collapses double spaces in its text; options now carry an explicit value. At phone width the weekday buttons did not wrap and pushed the page 136 pixels wide; they now wrap. An afternoon chart label ran past the right edge; afternoon labels now sit left of their line.
  - Final result at both widths: no problems, no sideways scroll, no label off screen, no console errors or warnings. (A first test pass reported no filtering because the test held a reference to a table the page had replaced; the test was corrected, not the page.)
- Added the index line to `strategy/runs/README.md` and the Completed line to `PROJECT_STATE.md`.

- Advisor's final review before the commit. Fixed: market caps unknown for 10 winners, not 9; period D's overnight wording (only the mean is under half) and the signed daily change named apart from the daily move either way; the summary no longer says beta rises with the gain; weekday spread restated (pick up within 5 minutes, drop off up to 17 minutes on the mean curve and 29 on the median curve, Friday earliest); the full-minute count stated for SPY only. Added SPY and QQQ medians across days to the gains by time of day (`r3-08` keeps each benchmark's daily slice returns; new CSV and table columns; the page's mean or median switch now covers them). Committed the half-day evidence as `scripts/probes/r3-probe-2-half-days.ts` (its output matches section 3.6). Checked: every filled market cap has a URL and access date (0 blank); the page loads nothing local (no `fetch`, every link is an outside URL), so it opens with a double click; the page carries "Not financial advice".
- Reran `r3-08`, `r3-09`, the assembly and `r3-10`, then the full Playwright test at 1400 and 390 wide: no problems, no sideways scroll, no label off screen, no script errors. The only console message was the test server's missing `favicon.ico` (a request the browser makes by itself, not part of the page).

## 3. Sources

| # | Source | URL | Accessed |
| :-- | :-- | :-- | :-- |
| 1 | Alpaca Market Data API, historical stock bars (market data host only) | https://data.alpaca.markets/v2/stocks/bars | 2026-11-21 |
| 2 | Run 1 cached data and scripts (Nasdaq Trader lists, SEC files, Alpaca bars as accessed 2026-11-05) | `strategy/data/`, `strategy/scripts/` | 2026-11-21 |
| 3 | Run 2 deliverable, section 6 and section 1 | `strategy/runs/strategy-run-2-deliverable.md` | 2026-11-21 |
| 4 | SEC EDGAR filing folder, Carvana 10-Q cover page (R1.htm) | https://www.sec.gov/Archives/edgar/data/1690820/000169082022000313/R1.htm | 2026-11-21 |
| 5 | SEC EDGAR filing cover pages (R1.htm) and 20-F main documents for every winner needing them (each URL in `market-cap-sources.csv`) | https://www.sec.gov/Archives/edgar/data/ | 2026-11-21 |
| 7 | Market cap helper agent's SEC filing reads, one URL and quote per value in `scripts/r3-manual-caps.json` and `market-cap-sources.csv` | https://www.sec.gov/Archives/edgar/data/ | 2026-11-21 |
| 6 | SEC EDGAR submissions and XBRL company facts (run 1's cache, accessed 2026-11-05, plus new companies) | https://data.sec.gov/submissions/ and https://data.sec.gov/api/xbrl/companyfacts/ | 2026-11-05 and 2026-11-21 |

## 4. Decision points

- **Helper's market caps:** accepted where the share count is read from an SEC filing and passes run 1's consistency check; GOL and GGB left unknown because their ADS is a preferred share and a common-only cap would mislabel the band.
- **New files, not edits.** Run 1's scripts write `data/work/candidates.json`, `data/work/period-*.json` and `strategy-run-1-data/`. Run 3 uses `r3-` scripts, `data/work/r3/` and `strategy-run-3-data/`, so run 1 still rebuilds exactly as it did.
- **Which "new shares" flags are removed (change 1).** Run 1 writes three forms: "new shares after bankruptcy" (an 8-K item 1.03 within two years, or a re-emergence), "new shares listed ... (same company, new CUSIP, price break)", and "new shares: price break xN overnight ... (share exchange or unadjusted split)". Run 1's section 2.3 describes all three under the heading "New shares after bankruptcy (borderline call)", so all three are removed. The removed CSV keeps each row's exact flag text so Michael can reverse this for the third form.
- **Beta (change 4).** Daily close to close returns over the winner's measured window, split adjusted. A return is used only when the stock's previous bar is SPY's previous trading day; returns spanning a halt or missing day are dropped rather than compounded. Beta = covariance with SPY divided by SPY's variance, needing at least 20 paired days. Volatility = sample standard deviation of the same daily returns, reported daily and annualized (times the square root of 252).

- **The 16:00 Eastern bar counts in volume.** It holds the closing auction (probe). Leaving it out would hide most of the end-of-day volume rise that change 8 asks about. It is added to the last slice's volume (2:55 to 3:00 PM Central) and left out of prices.
- **Half days from SPY's own minute bars** (afternoon volume under 30 percent of the morning's; see the sequence for why the first rule failed), because Alpaca's market calendar is on its trading host, which the brief forbids.
- **5 minute slices** for both gains and volume (the brief allows 30 minutes or finer); the markdown sums them into 30 minute blocks.
- **Pick up and drop off method:** crossing of the even-spread level (1/78 of the day per 5 minutes) on a 15 minute centered moving average. Chosen over a "halfway between peak and trough" rule because the opening peak decays within minutes, so that rule would put the drop off at about 8:40 AM Central for every series and say little.
- **Mean and median flag thresholds:** relative gap over 25 percent of the larger value AND an absolute floor per measure kind (multiple 0.25, share of days 2 points, gain shares 10 points, daily percent moves 0.10 points, beta 0.2, daily volatility 0.5 points, annualized 8 points). A note: the relative test is asymmetric for complementary pairs (overnight 73 percent against 59 is not flagged, intraday 27 against 41 is), because the larger value differs.
- **Several share classes:** added together at the listed class's price (advisor's suggestion), stated as an approximation for Up-C structures.
- **ADR ratio sources:** cover page first, then the 20-F's cover section text, skipping old ratios in "changed from" sentences.

- **Half-day rule, revised:** SPY with fewer than 390 regular minute bars AND afternoon volume under 50 percent of the morning's. Two tests because each alone misclassifies at least one day (sequence). Still inferred from data, not an exchange calendar (open question).

## 5. Dead ends

- **The first ADR ratio text search** read the whole 20-F and picked up historical ratios (EDU). Replaced by a cover-section-only search (above).
- **`timeout` command:** not installed on this Mac; background jobs carry their own time limits instead (the minute pull's argument, wait loops with a fixed count).

- **First half-day rule** (no SPY bar after 14:00 Eastern) found no half days, because extended-hours bars continue after an early close. Replaced by a volume rule.

- **Second half-day rule** (afternoon volume under 30 percent of the morning's) missed three early closes where after-hours trading was heavier (2019-11-29, 2024-11-29, 2024-12-24). A volume cliff right at 13:00 Eastern did not separate them either. Replaced by the bar count plus ratio rule.

## 6. Self assessment against the standard

| Standard | Met? | Evidence and shortfalls |
| :---- | :---- | :---- |
| 1. Every dataset named with its provider and access date | Yes | Deliverable section 4.1 (datasets table) and section 9 (15 sources with URL, access date and strength). Run 1's cached data keeps its 2026-11-05 access date. |
| 2. Data gaps and survivorship disclosed, including the bias from removing the flagged companies | Yes | Section 2.1 states the bias plainly; section 4.3 (minute coverage: no missing files, no late histories, days without minute bars, thin stocks), section 4.4 (18 unknown market caps and why, 19 values from another registrant's filings), section 4.2 (run 1's limits). |
| 3. Every number reproducible by a committed script, with the command stated | Yes, with caveats | `sh strategy/scripts/r3-rebuild.sh` rebuilds every CSV, `summary-tables.md` and the page from the cache; the half-day evidence comes from `node scripts/probes/r3-probe-2-half-days.ts`. Caveats: the deliverable's prose is hand-written from those files (section 5's tables are copied from `summary-tables.md`), not generated; SEC failures are not cached, so a rebuild on a day SEC errors could leave a few more caps unknown; the helper's 136 hand-read values are the committed input `scripts/r3-manual-caps.json`, not regenerated by script. |
| 4. State what evidence would undercut the idea | Yes | Section 7: hindsight with no non-winner comparison, survivorship, unstable returns across periods, returns smaller than likely costs, thin stocks, method sensitivity, half-day inference. |

**Where the run fell short**

- **Half days, first two rules wrong.** The first rule found none; the second missed three early closes and was found only by checking the list against likely dates, after the first full outputs were written. The final rule is still inferred from SPY's data, not from an official calendar.
- **No liquidity test.** 411 winners had no trade in over half their regular minutes. Whether the time of day patterns hold for liquid winners only was not tested; it is listed as something that would undercut the findings.
- **Market caps rely partly on hand reads.** 121 values come from a helper reading SEC filings by hand. Each has a URL and quoted text, but they were spot checked, not each re-verified; 19 come from a predecessor's or a former ticker holder's filings.
- **The brief's suggested sites were not used.** The brief named CNBC and Yahoo Finance as examples; every gap was filled from SEC filings instead, and Yahoo's terms forbid automated collection.
- **"New shares" removal is a judgement call.** All three of run 1's new shares forms were removed; `removed.csv` keeps the exact flag text so it can be reversed.
- **The page was built after the markdown, as the brief ordered.** Its Playwright test (both widths, every tab, filter option, switch and time of day combination) passed after three fixes, recorded in section 2.
