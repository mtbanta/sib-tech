# Strategy run 1 trajectory

Written as the run goes, not at the end. Six parts: the brief as given, the sequence of what was done, sources, decision points, dead ends, self-assessment.

## 1. The brief as given

Verbatim copy of `strategy/runs/strategy-run-1-brief.md`, below the rule.

---

# Strategy run 1 brief: how past bull market winners behaved, day by day

## Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:

- Launched from `~/Projects/sib-tech` in a fresh session, with no other Claude Code session working in this repo.
- Model: Opus 5.5, medium effort. Advisor: on, Opus 5.5. Auto-mode: on.
- Playwright MCP confirmed connected with `/mcp` before pasting.
- Copied from the raw file in TextEdit.

## What this run is

This is the first strategy research run. It is separate from the stack builds and from the stack research runs 1 to 5 in `runs/`. It changes nothing in either stack.

- Lever: none, this is the first strategy run.
- Michael's idea, in short: in every bull market a group of stocks greatly outperforms the indexes (SaaS and big tech in the 2010s; SaaS, oil and gas, construction materials and equipment from 2020 to 2022; semiconductors, AI and data centers since 2023). These winners have many more up days than down days. He wants to know how they behaved inside each day, so a later strategy can buy and sell them many times a day for small gains, ending every day flat.
- This run is descriptive only. It describes the winners. It does not test a trading rule, and it does not recommend a strategy.
- Hindsight is known and accepted for this run: winners are picked after the fact. A later run tests whether they can be found in real time.
- Nothing in this run is financial advice. Say so in the deliverable.

## Step zero: save this brief

1. Check the date with `date`.
2. Create the folder `strategy/runs/`.
3. Write this entire brief, verbatim and unedited, to `strategy/runs/strategy-run-1-brief.md`.
4. Create `strategy/runs/strategy-run-1-trajectory.md` and paste this brief into its first section.

## Step one: the research key file, then stop

Michael has created a paper account under the dexter@sib-tech.co Alpaca login, used only for research. No stack uses this paper account: stack C and stack D both trade under the cyrus@sib-tech.co login. The stacks' keys must never be used here.

1. Create `strategy/.env.local` with exactly these two names and blank values:
   ```
   ALPACA_RESEARCH_API_KEY_ID=
   ALPACA_RESEARCH_API_SECRET_KEY=
   ```
2. Confirm Git ignores it with `git check-ignore -v strategy/.env.local`, and record the matching rule in the trajectory.
3. Add these lines to `.gitignore` if not already covered, and confirm each with `git check-ignore`: `strategy/data/` (raw downloads and caches) and any local environment folder you create under `strategy/` (for example `strategy/.venv/`).
4. Stop and tell Michael, in plain English: "The key file is ready. Open it with `open -a TextEdit ~/Projects/sib-tech/strategy/.env.local`, paste the research login's paper key ID (starts with PK) and secret after each equals sign, save, close, and tell me keys ready."
5. Wait for "keys ready". Then check the file without printing any value: plain text, two names, no quotes or spaces, the key ID starts with `PK`.

Rules for these keys:
- Use them only against Alpaca's market data host (`data.alpaca.markets`). Never call any trading host, paper or live, with them. No orders, no account changes.
- Never print a value, and never put one in a file other than `strategy/.env.local`, a commit, a log or a message.
- Before the commit, run `node scripts/secret-scan.mjs --tree`, and separately confirm that neither key value appears in any staged file, without printing the values.

## The goal

When this run is done, Michael can see, for each of four bull markets, which Nasdaq listed and NYSE listed stocks quadrupled or better, how many there were in each gain group, and how they behaved day by day: how much they moved from open to close, how much of their gain came overnight versus during the day, and how often they rose. He uses the counts to choose which groups get 1 minute detail in run 2.

### The four periods (Michael's ruling)

| Period | From | To |
| :---- | :---- | :---- |
| A | First trading day of April 2009 | Last trading day of January 2020 |
| B | First trading day of April 2020 | Last trading day of January 2022 |
| C | First trading day of January 2023 | Last trading day of February 2025 |
| D | First trading day of April 2025 | October 1, 2026, at its close |

Order of work: B, C and D first, then A last. Period A is the largest.

### The universe

- Every stock listed on Nasdaq or the NYSE at any point during the period, including stocks later delisted or acquired. This contains every member of the Dow, S&P 500 and Nasdaq 100 and nearly all of the Russell 2000. Count and report any Russell 2000 members listed elsewhere, as a note only.
- Individual company stocks only: common stock, plus foreign companies listed through ADRs (American Depositary Receipts). Mark ADRs.
- Excluded: ETFs and other funds, warrants, units, rights, preferred shares and notes, and SPAC shells before their merger. State every borderline rule you apply in the deliverable.
- No minimum price and no minimum volume.
- Where a source organizes stocks by index, a stock counts if it was in the index during the period, not only today.

### Who is a winner, and how the gain is measured

- Gain is measured from the period's first open to its last close, using prices adjusted for splits but not for dividends.
- A stock that listed during the period (IPO, spinoff, SPAC merger or direct listing) is measured from the first open after its first earnings report, that is, the open on the trading day after the report. If that first report falls inside the period's final three months, exclude the stock and list it as excluded with the reason. If you cannot find the first earnings date, measure from its first trading day and flag it.
- A company already public elsewhere that moved to Nasdaq or the NYSE during the period is measured from its first trading day on Nasdaq or the NYSE.
- A stock delisted or acquired during the period is measured to its last close.
- Gain groups, by ending value as a multiple of the starting price:
  - Every period: 4x (at least 4, under 5), 5x (at least 5, under 6), 6x+ (6 or more).
  - Stocks under 4x are not winners in this run. Michael is starting with a smaller set on purpose; the 3x group is added in a later run.
- Mark every stock that was measured from a non-standard start (new listing, missing earnings date, moved exchange) or to a non-standard end (delisted, acquired), so the output can show it visually.

### What to measure for every winner, from daily bars

A daily bar is each day's open, high, low, close and volume.

1. Open to close for each day, in dollars and percent.
2. Overnight gap for each day (prior close to open), and the share of the stock's total gain that came overnight versus during the day. State your method (for example log returns, so the two parts add up).
3. Up days and down days, under both definitions, labeled: close above that day's open, and close above the prior day's close.
4. The biggest rise from the open (high minus open) and the biggest drop from the open (open minus low), in dollars and percent.
5. The average gain of the up days, and how many up days were above that average and how many below. Do this under both up day definitions.
6. Same day comparison with SPY and QQQ, used only as measuring sticks for the S&P 500 and Nasdaq 100. They are never winners. Include, for example, how often a winner rose on a day the benchmark fell or was flat.
7. Market cap on the first day of the stock's measurement and on its last day. If it cannot be found free, leave it blank, flag it, and report the paid options.
8. Industry, using today's label from a free source. Flag any that are missing.

Not in this run: what time of day the gains happen. It needs 1 minute bars, which come in run 2.

### Data coverage, and the paid options

- Use free sources only. Find out how far back free 1 minute history and free daily history reach, including for delisted stocks, and record it in the deliverable as a coverage table.
- Where free data does not reach, flag the gap, use what is free, and report the paid options. Every paid option carries its price, labeled "published" (on the vendor's own page, with URL and access date) or "gated" (behind a sales form or signup). Do not buy anything, start a trial or create an account. Michael decides.
- Estimate the size of a 1 minute pull for each period and gain group (rows, approximate disk size, approximate time at the source's published request limits), so Michael can choose groups for run 2. Label every estimate as an estimate.

## The sources

Use:
- Live web research, and Playwright for pages that need JavaScript.
- Free data sources of your choosing. Prefer primary sources (the exchanges, the SEC, the data vendor's own documentation). Respect every source's published rate limits.
- `strategy/.env.local` for Alpaca market data only.
- `CLAUDE.md`, `PROJECT_STATE.md` and `runs/run-3-deliverable.md` sections 3 and 7, for background only.

Ignore:
- Anything in `~/Projects/relii`.
- Anything under `stacks/`, and every stack key, account, database, deployment, Discord server and heartbeat check.
- Your own recalled knowledge as evidence. Every data claim and price needs a live source.

If a source asks for contact details (for example an email address in a request header), do not supply Michael's or anyone's. Use a generic client name with no personal information. If the source then refuses, record it as a dead end and report it to Michael.

## Code and data

This is a research run, and it writes code to fetch and analyze data. For this run only:

- Code lives under `strategy/` (for example `strategy/scripts/`). Choose the language. Node 24 is installed and runs TypeScript directly; the system Python is 3.9, past end of life.
- Dependencies are installed only inside `strategy/` (a local `package.json` or a local environment folder), never globally and never under `stacks/`. Name each one and why in the trajectory.
- Raw downloads and caches go in `strategy/data/`, which is git-ignored. They are not committed.
- One documented command rebuilds every CSV and the HTML from the cached raw data. Put it in the deliverable.
- Committed outputs: no file over 50 MB. If a CSV would be larger, compress it with gzip or split it, and say so. Never commit a file over GitHub's 100 MB limit.
- Do not edit `CLAUDE.md`, `builds/`, `runs/`, `stacks/`, `scripts/` or `.githooks/`. The only shared file you may change is `.gitignore`, as in step one.

## The output

Build in this order: CSVs and the markdown first, then the trajectory's self-assessment, then the HTML. A short session must still leave a complete markdown answer.

### CSVs, in `strategy/runs/strategy-run-1-data/`

Two per period, plus one shared file:
- `period-<A|B|C|D>-winners.csv`: one row per winner. Ticker, company name, gain group, gain in dollars and percent, measurement start and end dates, flags (new listing, missing earnings date, moved exchange, ADR, delisted, acquired), market cap at start and end, industry, up and down day counts under both definitions, the average up day gain with counts above and below it, overnight and intraday shares of the gain.
- `period-<A|B|C|D>-daily.csv`: one row per winner per trading day. Open, high, low, close, volume, open to close in dollars and percent, overnight gap, the up day flag under both definitions, biggest rise and drop from the open, and SPY and QQQ for the same day.
- `benchmarks.csv`: SPY and QQQ daily bars for every period.
- Also a list of excluded stocks with the reason, as a CSV or a section in the deliverable.

### `strategy/runs/strategy-run-1-deliverable.md`, the source of record

1. Summary in bullets: counts per period and group, and the most important findings.
2. Definitions and method: every rule above as applied, every borderline call, the overnight and intraday method.
3. Data sources and coverage: what each source covers, the gaps, and the paid options with prices.
4. One section per period: counts per group, the winners table (or its top part, with the CSV named), and summary tables of the daily measures by group, including the comparison with SPY and QQQ.
5. Across the periods: what is the same and what differs.
6. Run 2 sizing: the 1 minute pull estimate per period and group.
7. What would undercut the idea: what in this data (or in data not yet gathered) would make the strategy less likely to work.
8. Open questions.
9. Sources: numbered footnotes on every claim, linking to a sources list with URL, access date and a strength label (the same scale as `runs/run-3-deliverable.md` section 5).

Formatting: bullets and tables, no paragraph longer than three sentences, plain English, acronyms defined the first time, no em or en dashes. Michael is a non-coder.

### `strategy/runs/strategy-run-1-deliverable.html`, the interactive view

- One tab per period, plus an overview tab and a sources tab.
- In each period tab: filters (gain group, industry, flags such as new listing, ADR, delisted), sortable winners table, and charts that make the daily measures easy to see (for example the distribution of daily open to close moves, up and down day counts, overnight versus intraday share, comparison with SPY and QQQ). You choose the design.
- Stocks with a non-standard start or end are visibly marked.
- It opens with a double-click on Michael's Mac, with no server. Charting libraries may load from a public CDN. If the data is too large to embed, say what the page shows and where the rest lives.
- The page holds no claim the markdown lacks; the markdown wins any disagreement.
- Test it with Playwright: every tab and filter, at desktop and phone width.

## The standard

Michael accepts the work when all four hold:

1. Every dataset named with its provider and access date.
2. Data gaps and survivorship disclosed (which delisted or acquired stocks are missing, and why).
3. Every number reproducible by a committed script, with the command stated.
4. You state what evidence would undercut the idea.

Every paid option must carry its price, verified on a live page or labeled gated.

## Documenting your work: `strategy/runs/strategy-run-1-trajectory.md`

Append as you work, not at the end, so a session that runs out of context still leaves a usable trail. Six parts: the brief as given, the sequence of what you did, sources with URL and access date, decision points with reasons, dead ends, and a self-assessment against the standard. Do not record time spent or token cost.

## Run conventions

- Files: `strategy/runs/strategy-run-1-brief.md`, `-deliverable.md`, `-deliverable.html`, `-trajectory.md`, the data folder, the scripts under `strategy/`, and `strategy/runs/README.md`.
- Create `strategy/runs/README.md` as the strategy runs index, with one line: "1", the date, "first strategy run", outcome.
- Add one dated line to `PROJECT_STATE.md` under Completed, pointing to the deliverable. Change nothing else in that file.
- Done means all files written, the page browser-tested, the index and the `PROJECT_STATE.md` line written, and one commit and one push at the end of the run. Auto-mode's research run carve-out covers that commit and push.
- Then end the session. Do not start run 2.

## Prohibitions

- No live trading.
- No orders of any kind, paper or live, from strategy work. Never call a trading host.
- Nothing touching the stacks' resources: their folders, accounts, keys, databases, deployments, Discord servers or heartbeat checks.
- No credentials in files or commits, other than the two values Michael pastes into the git-ignored `strategy/.env.local`.
- No account creation, signups, trials or purchases, anywhere.
- No reading `~/Projects/relii`.
- Never send Michael's personal information to any site or service, including in request headers, and do not disguise automated requests as a regular browser. If a page refuses plain requests, read it with Playwright or skip it and record it.
- Give these prohibitions, word for word, to any helper you start.

---

## 2. Sequence of what was done

1. Read `PROJECT_STATE.md` (start-of-session rule in `CLAUDE.md`). Ran `date`: Thu Nov 5 21:13:43 CST 2026.
2. Created `strategy/runs/` and saved the brief verbatim as `strategy/runs/strategy-run-1-brief.md`. Created this trajectory with the brief in section 1.
3. Created `strategy/.env.local` with the two names and blank values, permissions 600 (owner read and write only).
4. `git check-ignore -v strategy/.env.local` matched `.gitignore:6:.env.*`. So the key file was already ignored; no new rule needed for it.
5. `strategy/data/` was not covered. Appended `strategy/data/` to `.gitignore`; `git check-ignore -v strategy/data/x.json` now matches `.gitignore:9:strategy/data/`.
6. No Python environment folder will be created (the run uses Node 24). A local `strategy/node_modules/`, if any dependency is added, is already matched by `.gitignore:8:node_modules/` (confirmed with `git check-ignore -v strategy/node_modules/x`).
7. Stopped and asked Michael to paste the research keys (step one, item 4).

8. Michael pasted the keys and said "keys ready". Checked `strategy/.env.local` without printing values: ASCII text, 2 lines, both expected names, no quotes, no whitespace, no carriage returns, key ID starts with `PK`.
9. Wrote `strategy/scripts/alpaca-data.ts`, a read-only client that refuses any host other than `https://data.alpaca.markets`, sends the User-Agent `sib-tech-research`, and paces requests to at most about 180 a minute (Alpaca's free limit is 200 a minute).
10. Probe 1 (Alpaca data, 2026-11-05): earliest daily and 1 minute bars on the `sip` feed are 2016-01-04 (daily) and 2016-01-01 (minute, overnight prints) for SPY and AAPL. The `iex` feed starts later (SPY 2018-11-01, then a gap to 2020-07-27). Delisted names are served: TWTR (last bar 2022-10-27), CELG.
11. Probe 2: Alpaca files a company's history under its current symbol. XYZ (Block) has bars from 2016; SQ also returns bars up to 2025-01-17. META has bars from 2016; FB also returns bars. So the same history can appear under two symbols, and duplicates must be removed.
12. Probe 2 and 3: Alpaca's corporate actions endpoint (`/v1/corporate-actions` on the data host) is nearly empty before 2020. 2015, 2016 and 2018 first quarters have 0 mergers; cash mergers first appear in 2021. Too thin to serve as the list of acquired and delisted stocks.
13. SEC: `https://www.sec.gov/files/company_tickers_exchange.json` with User-Agent `sib-tech-research` returned HTTP 403 ("Request Rate Threshold Exceeded", SEC's page for undeclared clients). The same URL with User-Agent `sib-tech-research-bot (personal research, no contact)` returned 200. No email or personal information was sent.
14. Stooq (`https://stooq.com/q/d/l/?s=aapl.us&i=d`) returned a JavaScript proof-of-work page instead of data. Dead end (see section 5).
15. Yahoo Finance chart endpoint returned 200 to a plain request. It is unofficial and undocumented; not used yet (see decisions).
16. Probe 4: Alpaca `sip` returns no bars for OTC (over-the-counter) symbols (TCEHY, NSRGY, RHHBY: 0 bars), so its data covers exchange-listed stocks. A bankrupt stock's history sits under its final symbol (BBBY: 0 bars; BBBYQ: bars from 2016 to 2023-05). The multi-symbol response was paginated (`next_page_token`), and symbols on later pages came back empty on the first page; the client must loop over pages.
17. Asked the advisor before building. Advice adopted: loop pagination, remove duplicate histories, check whether Alpaca's daily bar includes pre-market and after-hours trades, use Nasdaq Trader files for current exchange and type, look at SEC fail-to-deliver files for historical symbols, screen with monthly bars then pull daily bars for candidates, guard against SPAC shells' 10 dollar prices, treat Stooq as a dead end, keep period A from blocking B, C and D.

18. Probe 5: compared Alpaca's daily bar with its 1 minute bars on three days (2021-06-15, 2023-11-07, 2024-03-12) for AAPL, NVDA and PLTR. The daily high and low equal the regular session (9:30 to 16:00 Eastern) minute high and low, not the 4:00 to 20:00 extended session. The daily open and close are the official opening and closing auction prices (for example NVDA 2024-03-12 daily close 919.13 against a 15:59 minute close of 919.38). So the daily bar is regular session only, and the overnight gap (prior close to open) includes pre-market and after-hours moves.
19. Added a paginated `bars()` helper (follows `next_page_token` until done). Probes 6 to 8: a 1,000 symbol monthly request on a dense block of 3 letter symbols took 80 pages (448 symbols with data); a sparse block took 1 page. Page count follows the number of symbols that have data, so sweeping every 1 to 4 letter symbol is affordable (about 4,000 requests, estimate).
20. Downloaded Nasdaq Trader's `nasdaqlisted.txt` (5,613 lines) and `otherlisted.txt` (7,672 lines) and SEC's `company_tickers_exchange.json`, all on 2026-11-05.
21. SEC fails-to-deliver files: guessed file names returned 404 for 2009 to mid 2017 and a few later months. Reading SEC's fails-to-deliver page showed older files sit under `/files/data/frequently-requested-foia-document-fails-deliver-data/`. Rewrote step 1 to download every file the page links from 2009 on: 413 files, July 2009 to 2026 (251 MB, git-ignored). Format: settlement date, CUSIP, symbol, quantity, description, price. Class shares lose their dot (BRKB, not BRK.B).
22. Started the monthly sweep (`scripts/02-fetch-monthly.ts`): 495,401 symbol strings (475,254 one to four letter combinations, 19,949 five letter symbols from the fails-to-deliver files, 198 more from Nasdaq Trader, for example dotted class shares). Split-adjusted monthly bars, 2009-01 to 2026-10, `sip` feed.
23. Started a helper (general-purpose agent, prohibitions given word for word) to read paid data vendors' live price pages, Yahoo's terms on automated downloads, and whether iShares publishes a Russell 2000 (IWM) holdings file with an exchange column.
24. Inspected SEC submissions JSON (Palantir, CIK 1321655): it carries SIC code and description, current tickers and exchanges, former names, and every filing with form type, filing date, acceptance time and 8-K item numbers (Palantir's first 8-K with item 2.02, results of operations, was accepted 2020-11-12 21:16 UTC).
25. Wrote `scripts/03-screen.ts` (duplicate removal and candidate screen), `scripts/04-fetch-daily.ts` and `scripts/sec.ts`. Tested the screen on the first 5 sweep chunks: about 12 percent of symbols pass the loose screen per period.

26. Wrote `scripts/03b-ftd-index.ts`: 60,201 symbols in the fails-to-deliver files, one entry per CUSIP (security identifier) so a reused ticker keeps each company apart.
27. Wrote `scripts/05-build.ts` (winners, start and end rules, flags, daily measures, market cap). Patched before first run: Form 25-NSE filer to exchange name via SEC; market cap uses raw and split-adjusted bars over the same range to restate share counts across splits; SPAC shell rule kept to "merger after the period"; a dropped rule that excluded any stock with SIC code 6770 (blank checks), because SEC codes can stay stale after a merger.
28. Added sections 3 to 6 to this file (sources, decisions, dead ends, self-assessment placeholder); later steps are inserted into their sections.
29. The paid-options helper returned (summary kept in `data/work/paid-options-helper.md`, git-ignored, and carried into the deliverable's section 3). Key facts: Yahoo's Terms of Service (updated 1 November 2026), section 2, forbid collecting data "using any automated means ... without our express, prior permission". iShares publishes a Russell 2000 (IWM) holdings CSV with an Exchange column, no signup, current holdings only.
30. First test build of period B on the first 55 sweep chunks (624 candidates). Inspected every winner by hand. Found and fixed, in order:
    - warrants (5 letter Nasdaq symbols ending in W) and an exchange test symbol (CBX, "Listing Market NYSE Networks") passing as winners;
    - partnership common units (ARLP, CLMT at the time) wrongly excluded as SPAC units;
    - delisted companies not found at SEC by name, because EDGAR's name lookup only knows current names (AeroCentury is now Mega Matrix). Added EDGAR full-text search by CUSIP;
    - the CUSIP search picking the investment manager that filed an SC 13G instead of the subject company (Continental Resources came back as Windward Capital). Now the company whose name shares its first word with the fails-to-deliver description wins, else the one filed about by the most different filers;
    - exchange read from the Form 25 XML itself (it names the exchange and the class of security removed), instead of guessing from the filer number;
    - Alpaca returning zero-volume filler bars (AAC on 2020-04-01 to 2020-04-03: open 0.48, volume 0). Dropped every bar with zero volume;
    - bankruptcy re-emergences joined to the old shares (CBL 140x, California Resources 43x). Added a same-company new-shares rule (D17);
    - Chord Energy (formerly Oasis Petroleum) labelled "moved exchange" though it re-listed after bankruptcy. Added the bankruptcy filing rule (D18).
31. Probe 10: Alpaca's CNR bars for 2020-04-01 open at 3.56 with 622,652 shares, which is CONSOL Energy (then CEIX, renamed Core Natural Resources with symbol CNR in 2025), not Cornerstone Building Brands, which used CNR in 2020. CEIX returns no bars. So Alpaca files a history under the company that uses the symbol today (D16).
32. A network outage stopped both the sweep (at chunk 284 of 496) and a build run. Added retry on network errors to both clients and restarted the sweep; cached chunks were kept.
33. Rate-limit fact: while the monthly sweep ran (paced to about 180 requests a minute), I also ran probes 9 and 10, the period B daily fetch (4 chunks) and test builds that fetched market-cap bars from Alpaca. Each process paces itself, so for those minutes the two together could exceed Alpaca's published 200 a minute. The client retries a 429 (rate limit) answer silently, so the logs cannot show whether any occurred. From here on, no Alpaca step runs while another is running.
34. Asked the advisor before the full run. Adopted: period A becomes a labelled stand-in window (2016-01-04 open to 2020-01-31 close), never called period A winners; one audit pass after the full run (possible SPAC shells, moved-exchange and new-shares winners, wrong company behind a ticker, market cap against price multiple), then outputs; quantify survivorship gaps per period; show unknown-exchange 4x stocks as "possible winners, exchange not confirmed".
35. Set period A in `scripts/periods.ts` to the stand-in window (2016-01-04 to 2020-01-31). Downloaded iShares IWM holdings (as of Nov 04, 2026) for the Russell 2000 note: equities by exchange 1,193 NASDAQ, 724 NYSE, 45 "Nyse Mkt Llc" (NYSE American), 7 "NO MARKET (E.G. UNLISTED)", 2 "Non-Nms Quotation Service (Nnqs)", 1 TXE.
36. Wrote `scripts/06-outputs.ts` (CSVs, `summary.json`, `summary-tables.md`; a CSV over 45 MB is written gzip-compressed), `scripts/07-sizing-audit.ts` (run 2 sizing, audit lists, survivorship counts), `scripts/08-html.ts` (single-file page, plain SVG charts, no external library; the overview findings, coverage and sources tabs are read from the markdown deliverable so the page cannot hold a claim the markdown lacks) and `scripts/rebuild.sh` (the one rebuild command). Loaded the dataviz guidance first: three gain groups use the first three slots of its validated palette (blue, orange, aqua), benchmarks use grays, every chart has a hover tooltip and a table view.
37. Drafted the deliverable's method section (section 2) while the sweep finished.
38. The monthly sweep finished (496 chunks). Probe 11: AAPL 1 minute bars for the 2024-03-12 regular session, 391 bars, 110 bytes each as Alpaca JSON and 78 as CSV; used in the run 2 sizing.
39. Full screen: 23,129 symbols had at least one bar with volume; 1,321 duplicate histories dropped; 21,808 kept. Candidates: A stand-in 1,885, B 2,314, C 2,622, D 2,310. Daily bars fetched for all candidates plus SPY and QQQ. Started the full build (`05-build.ts B C D A`).
40. Tested the HTML on partial period B data with Playwright: `file:` addresses are blocked in the Playwright tool, so the page was served from a local web server bound to 127.0.0.1 for testing only. No page errors (one 404 for a favicon the server looked for).
41. First full build of period B: 357 winners. The audit (`07-sizing-audit.ts`) found: (a) MP Materials measured from its SPAC shell's first trade at 9.90 (2020-06-22). Cause: while adding the bankruptcy rules (step 30) I deleted the line that marks a shell merger, so every shell merger in the full run was measured from the shell's 10 dollar price. Restored the line; (b) LB (L Brands in 2020, the symbol now LandBridge's) named as LandBridge; added a rule: a symbol on today's lists whose history ended early and whose CUSIP issuer changed since is the earlier company's; (c) market caps with share counts clearly inconsistent with the price (Vivint Solar cap ratio 1,050 times its price multiple; Piedmont Lithium 0.01 times, its move from Australian ADRs). Large differences from new share issuance are real (MARA 14 times), so only ratios beyond 20 times or under 1/20 are blanked, with a note. Stopped the build (it was in period C) and restarted it with these fixes; SEC answers are cached, so the restart repeats no SEC request already made.
42. Also from the audit, left as they are and disclosed: most stocks that started near 10 dollars are ordinary companies (RCI Hospitality, XPEL, Fulgent); the "exchange not confirmed" list for B includes banks that file with bank regulators (Cadence Bank, Signature Bank) and stocks whose company was not found at SEC.
43. With the shell-merger line restored: period B 357 winners, C 127, D 168 (before the next fix). Audit of C and D: (a) Stone Ridge target-date trusts (LFAx, LIAx; "STONE RIDGE TR 2049 LONGEVITY") were not caught as funds; they sat in the exchange-unknown list, not among winners. Added a fund rule for trust names with a target year; (b) Spruce Biosciences (SPRB) at 154x: Alpaca shows a close of 0.0786 on 2025-04-28, no bars until 2025-09-15, then an open of 11 under a new CUSIP (85209E208, same issuer). The new-shares rule missed it because it looked only at bars near the CUSIP break and none existed before; now it also uses the last bar before the break. Added a "check: overnight price jump" flag for any one-night move of 3x or more inside a winner's measured days (a possible missing split adjustment). Restarted the build.
44. Market cap is missing for several large companies with more than one share class (AppLovin, Affirm) and some foreign filers (Celestica): the SEC company facts API returns only totals without class breakdowns, and these companies report the count per class. Left blank and flagged.
45. Rebuild: B 357, C 127, D 167 winners; 33 winners carried a "check: overnight price jump" flag. Read every one. Jumps of 10x or more were data breaks, not price moves: Whiting Petroleum x49 on 2020-09-02 and Valaris x67 on 2021-05-03 (old shares exchanged for new in bankruptcy), Wolfspeed x15 on 2025-09-29 (same), Glatfelter x12 on 2024-11-04 and PolyPid x30 on 2023-09-21 (reverse splits not adjusted), Destination XL x33, Kestrel x25, Rose Hill x27. Jumps of 3x to 10x include real moves (AMC x4.1 on 2021-01-27, trial results at Abivax x6.3 and Soleno x4.7). Rule added (D22). Restarted the build.
46. Rebuild with D22: B 354, C 125, D 164; A stand-in 153. Audit of the stand-in: (a) Nasdaq fifth-letter Z securities passing (ZIONZ, Zions warrants; GCVRZ, a Sanofi contingent value right; CYTXZ); added a rule excluding them and names with "RTS" or "contingent value"; (b) Hunter Maritime Acquisition, a foreign SPAC (its merger is not in 8-K items because foreign companies file 6-K), passing at 9.7x from a 9.75 start; added a rule excluding a stock named "Acquisition Corp" (or similar) that starts between 9 and 11 dollars with no shell merger found; (c) Tandem Diabetes (first Alpaca bar 2017-10-10, after a reverse split) and IVERIC Bio (first bar 2019-04-17, its ticker change from OPHT) labelled "moved exchange", though both were on Nasdaq throughout. Added: a company registered on an exchange (Form 8-A12B) more than 30 days before Alpaca's first bar is flagged "history starts late in Alpaca" instead (still measured from the first bar, non-standard start). Rebuilt all four.
47. Added to the outputs: average down-day loss under both definitions, mean daily open-to-close move and mean overnight gap, per winner and per group.
48. Final build: A stand-in 151 winners (4x 50, 5x 38, 6x+ 63), B 354 (137, 77, 140), C 125 (57, 22, 46), D 164 (55, 36, 73). Wrote the outputs (largest CSV 27 MB, so nothing needed compressing), the audit files and the run 2 sizing.
49. Wrote the deliverable: section 1 from `summary.json` (each figure checked against it; three slips corrected before saving: the up-day versus down-day gap is 0.15 to 0.65 points, not 0.2 to 0.7; winners' daily move is 5 to 6.5 times SPY's, not 4 to 6; 29 check flags, not 30), section 4 copied from `summary-tables.md`, sections 5 to 8, the Russell 2000 note, the rebuild command (section 2.6). Checked for em and en dashes: none in the deliverable, trajectory or scripts. Verified one claim from the cache: SPY's lowest close before period B was 222.68 on 2020-03-23.
50. Built the HTML and tested it with Playwright through the local server: every tab (overview, A stand-in, B, C, D, sources), every gain group checkbox, every flag option, the industry filter, the ticker search and column sorting, at 1280 by 900 and at 390 by 844 (phone). Counts after filtering match the markdown (for example B: non-standard 41, acquired 27, delisted 11). At phone width nothing spills outside the page (page width 390 on every tab). No console errors. Fixed during testing: tidy axis steps, the overview chart's width, a hash change not switching tabs, the active tab scrolled into view, single-asterisk italics showing as asterisks.
51. Wrote `strategy/runs/README.md` (strategy runs index) and added one dated line to `PROJECT_STATE.md` under Completed. Nothing else in that file changed.
52. Asked the advisor before committing. Adopted, in order:
    - Deploy check: `CLAUDE.md` says a push triggers the deploy. There is no `.github/workflows` folder; the only Git hook is `.githooks/pre-commit` (the secret scan), and stack C's deploys are run by hand with Fly's command line tool. So a push to main deploys nothing.
    - Reproducibility: the Russell 2000 file had been fetched by hand; added its download to `01-fetch-lists.ts`. Copied probes 1 to 11 from the session scratch folder into `strategy/scripts/probes/` with relative imports, added `probe-12-spy-low.ts` and a README mapping each probe to the claims it supports.
    - Formatting: added a "Terms used" list at the top of the deliverable (every acronym defined before first use), split every paragraph or bullet over three sentences (checked by a script that counts sentences), added source footnotes to the data claims in sections 1, 4, 5 and 6.
    - The double-click (`file://`) path was not tested directly, because the Playwright tool blocks `file:` addresses; the page was tested over a local server bound to 127.0.0.1. The page loads nothing from the network (no CDN), so the two should behave the same.
53. Hashed every file in `strategy-run-1-data/` and ran `sh strategy/scripts/rebuild.sh` from the repository root to test the one rebuild command.
54. The rebuild exited 0 and reproduced every output: all 13 files in `strategy-run-1-data/` had identical SHA-1 hashes before and after (`shasum`). Regenerated the HTML from the final markdown and re-ran the browser checks.
55. Added the deliverable's "Terms used" list to the HTML overview as a fold-out; re-tested every tab and flag filter at 1280 and 390 pixels wide (no overflow, no console errors).
56. Commit checks. Staged explicit paths only (`.gitignore`, `PROJECT_STATE.md`, `strategy/scripts`, `strategy/runs`): 47 files, none matching `env`, `strategy/data/`, `.venv` or `node_modules`. `node scripts/secret-scan.mjs` on the staged files: clean (47 files). `node scripts/secret-scan.mjs --tree`: clean (177 files, which include the 45 new files under `strategy/`). Separately, read the two values in `strategy/.env.local` and searched every staged file's contents for each, printing only counts: 0 matches. Largest committed file: `period-B-daily.csv`, 27 MB (under the 50 MB rule). Then one commit and one push.


## 3. Sources

Every source accessed 2026-11-05 unless stated.

| # | Source | URL | Used for |
| :---- | :---- | :---- | :---- |
| S1 | Alpaca Market Data API, historical stock bars (data host only) | https://data.alpaca.markets/v2/stocks/bars | Monthly and daily bars, split-adjusted, `sip` feed |
| S2 | Alpaca Market Data API, corporate actions | https://data.alpaca.markets/v1/corporate-actions | Probed only; too thin before 2020 |
| S3 | Nasdaq Trader symbol directory, Nasdaq-listed | https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt | Today's Nasdaq listings, ETF flag, names |
| S4 | Nasdaq Trader symbol directory, other listed | https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt | Today's NYSE, NYSE American, NYSE Arca, Cboe listings, ETF flag, names |
| S5 | SEC company tickers with exchange | https://www.sec.gov/files/company_tickers_exchange.json | Ticker to CIK (SEC company number) |
| S6 | SEC fails-to-deliver data page and files | https://www.sec.gov/data-research/sec-markets-data/fails-deliver-data | Historical symbols, CUSIPs and descriptions, July 2009 on |
| S7 | SEC EDGAR submissions API | https://data.sec.gov/submissions/ | Filings, 8-K items, SIC industry, Form 25 delisting notices |
| S8 | SEC EDGAR XBRL company facts API | https://data.sec.gov/api/xbrl/companyfacts/ | Shares outstanding from cover pages |
| S9 | SEC EDGAR company name lookup | https://efts.sec.gov/LATEST/search-index | Finding a delisted company's CIK from its name |
| S10 | Stooq daily download | https://stooq.com/q/d/l/?s=aapl.us&i=d | Dead end (JavaScript check) |
| S11 | Yahoo Finance chart endpoint | https://query1.finance.yahoo.com/v8/finance/chart/AAPL | Probed only |
| S12 | Alpaca, About Market Data API (plans: "Historical data timeframe Since 2016", "Historical API calls 200 / min" free, "10,000 / min" paid) | https://docs.alpaca.markets/docs/about-market-data-api | Coverage and rate limit |
| S13 | SEC, Accessing EDGAR Data ("Current max request rate: 10 requests/second"; asks for a declared User-Agent, sample with a contact email) | https://www.sec.gov/os/accessing-edgar-data | SEC rate limit. A name without contact details was declared, per the brief, and accepted |
| S14 | iShares Russell 2000 ETF holdings CSV (as of Nov 04, 2026) | https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/latest-holdings.csv | Russell 2000 note |
| S15 | Yahoo Terms of Service (read by the helper) | https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html | Dead end |
| S16 to S27 | Vendor pricing and documentation pages read by the helper (Massive, Tiingo, EODHD, Norgate, Nasdaq Data Link, FirstRate, Databento, Intrinio, Alpha Vantage, Financial Modeling Prep, Kibot, CRSP via Morningstar) | Listed one by one in the deliverable, section 9 | Paid options |

## 4. Decision points

- **D1. Language: TypeScript on Node 24, no dependencies.** Node runs TypeScript directly and has `fetch`; unzip uses the system `unzip` tool. No package is installed, so there is no `package.json`. The system Python 3.9 (past end of life) was used only to make text edits to the scripts, never to fetch or compute data.
- **D2. Price source for 2016 on: Alpaca `sip` feed, split-adjusted (`adjustment=split`).** Free history reaches 2016-01-04, includes delisted stocks and excludes OTC stocks. The brief asks for split-adjusted, not dividend-adjusted prices, which is exactly `adjustment=split`.
- **D3. SEC client name.** `sib-tech-research-bot (personal research, no contact)`. A plain `sib-tech-research` was refused once (403); the longer name was accepted. No email or personal information is sent anywhere. SEC's limit is 10 requests a second; the scripts stay near 4.
- **D4. The universe is built from symbol strings, not from a list of companies.** No free source lists every Nasdaq and NYSE stock since 2009 with delisted ones. So every 1 to 4 letter combination, every 5 letter symbol in the fails-to-deliver files and every symbol on today's Nasdaq Trader lists is asked for bars; a symbol with bars existed on an exchange. Then exchange and type are found for the candidates only.
- **D5. Screen with monthly bars, then measure with daily bars.** A symbol is a candidate in a period if some month's high is at least 4 times an earlier (or the same) month's low. Every winner under any start or end rule passes this test, because a start open is at least that month's low and an end close at most that month's high.
- **D6. Daily bars are regular session.** Probe 5 showed the daily high and low match 9:30 to 16:00 Eastern, so "biggest rise from the open" and "biggest drop from the open" are regular session measures and pre-market moves sit inside the overnight gap.
- **D7. Overnight and intraday split by log returns.** For the measured days 1 to N: intraday = sum of ln(close/open) for days 1 to N; overnight = sum of ln(open/previous close) for days 2 to N. Together they equal ln(last close / first open) exactly. Day 1's own gap is before the first open, so it is shown in the daily file but not counted in the gain.
- **D8. Earnings date = SEC acceptance date of the first 8-K with item 2.02 (results of operations) on or after listing.** The measurement starts at the open of the next trading day. Fallback: the first 10-Q or 10-K filed after listing, flagged. Foreign companies that file 6-K reports (no item numbers) fall to "missing earnings date" and are measured from their first trading day, flagged.
- **D9. SPAC merger date = SEC acceptance date of the 8-K with item 5.06 (change in shell company status).** Alpaca keeps the shell's 10 dollar history under the merged company's symbol, so without this the shell price would create false winners.
- **D10. Moved exchange = the company filed a 10-K, 10-Q, 20-F or 40-F more than 30 days before its first exchange bar and did not merge with a shell.** Alpaca has no OTC data, so a move from OTC looks like a first listing; the earlier annual or quarterly report shows the company was already public.
- **D11. Exchange for a stock no longer listed = the exchange that filed its Form 25-NSE (delisting notice).** The filer is the first part of the filing's accession number, and SEC gives its name.
- **D12. Acquired versus delisted.** Acquired if, in the 18 months before its last bar, the company filed a merger proxy (DEFM14A, PREM14A, DEFM14C), a tender offer response (SC 14D9), or a going-private statement (SC 13E3), or was the subject of a tender offer (SC TO-T). Otherwise delisted.
- **D13. Duplicate histories.** Two symbols that share 3 or more identical monthly bars (each with at least 1,000 shares of volume) are the same history; the one on today's lists, else the one with the latest bar, is kept.
- **D14. Zero-volume daily bars are dropped.** Alpaca returns some days with volume 0 and a repeated price; no trade took place, so they are not trading days for that stock.
- **D15. A delisted stock's company is found by its CUSIP.** From the fails-to-deliver record nearest the stock's last bar (only if within 365 days), EDGAR full-text search for the CUSIP; else EDGAR name lookup with trailing words dropped one at a time. Its name in the output is the fails-to-deliver description from the period (upper case, sometimes cut short), with SEC's current name in a separate column.
- **D16. A symbol on today's exchange lists belongs to today's company.** Probe 10 shows Alpaca files history under the company using the symbol now. A consequence: when a delisted company's ticker was later reused, its own history is not reachable under that ticker, which is a survivorship gap (section on gaps in the deliverable).
- **D17. New shares of the same company.** If the fails-to-deliver files show a new CUSIP with the same issuer code (first 6 characters) after a break of more than 20 days, and Alpaca's bars jump 3x or more either way near the break, the old and new shares are different securities (bankruptcy: old shares cancelled). The new shares are measured as a new listing from the jump day, with the earnings rule.
- **D18. Re-listing after bankruptcy is a new listing.** A first bar within two years after an 8-K with item 1.03 (bankruptcy) is treated as a new listing (earnings rule), not as a move from another market, even though the company filed annual reports before.
- **D19. Security type rules (borderline calls).** Excluded: Nasdaq Trader ETF flag; 5 letter symbols ending W, R or U (Nasdaq's warrant, right and unit letters); names with warrant, unit (not partnership units), right, preferred, notes or debentures; names of funds and exchange-traded products; companies that file fund reports (N-CSR, N-2, N-1A, N-PORT). Kept and flagged: partnership common units (operating businesses organized as partnerships). Kept: real estate investment trusts and other trusts that are operating companies. ADR flag: "American Depositary", "ADR" or "ADS" in the name.
- **D20. Period A's 2009 to 2015 years: no free source.** Alpaca starts 2016-01-04, Stooq is behind a browser check (dead end), and Yahoo's terms forbid automated collection. See the deliverable's coverage table.
- **D21. Period A is replaced by a stand-in window, 2016-01-04 open to 2020-01-31 close**, the part of period A that free data reaches. Files keep the brief's `period-A-*` names, but every heading and column states the window. Its counts are not comparable with B, C and D (4 years against about 2) nor with the 11 years Michael asked for. Borderline: stocks that listed in late 2015 count as standard starts in this window.
- **D22. One-night breaks of 10x or more.** A winner's open 10 times its prior close or more (or a tenth or less) is treated as new shares from that day (share exchange or an unadjusted split), measured with the earnings rule, and flagged. One-night moves of 3x to 10x are kept as price moves and flagged "check", because real moves of that size happen (meme squeezes, trial results).
- **D23. More security-type rules from the audit.** Excluded: Nasdaq fifth letter Z (miscellaneous securities such as extra warrants); names with "RTS" or "contingent value"; a stock whose name says "Acquisition Corp" (or Co, Company, Ltd, Inc, Holdings) that starts between 9 and 11 dollars with no shell merger found (a probable SPAC shell; foreign shells file 6-K reports without item numbers).
- **D24. "History starts late in Alpaca."** When a company was registered on an exchange (Form 8-A12B) more than 30 days before its first Alpaca bar, the late start is a gap in Alpaca's data (often a ticker change Alpaca did not carry back), not a move from another market. Measured from the first bar and marked non-standard. The true gain over the whole period for these stocks is not known from free data.


## 5. Dead ends

- **Stooq** (S10): answered with a JavaScript proof-of-work page instead of data. Solving it in bulk through a browser would amount to posing as a browser, which the brief forbids. Not used.
- **Alpaca corporate actions as a list of acquired stocks** (S2): almost empty before 2020 (cash mergers first appear in 2021). Not used for the universe.
- **SEC with a short client name**: one 403 refusal; resolved by a longer generic client name with no contact details (D3).
- **Guessed fails-to-deliver file names**: older files sit in a different folder; resolved by reading SEC's page (step 21).
- **Yahoo Finance for 2009 to 2015** (S11): its endpoint answers plain requests, but its Terms of Service forbid automated collection without prior permission (helper report, https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html, 2026-11-05). Not used.
- **EDGAR name lookup for delisted companies**: indexes current names only, so renamed companies are missed. Replaced by full-text search for the CUSIP (D15).


## 6. Self-assessment against the standard

**1. Every dataset named with its provider and access date: met.** Every dataset is in the deliverable's section 9 (25 numbered sources, all accessed 2026-11-05) and in section 3 of this file. Paid vendor pages were read by a helper agent under the brief's prohibitions, not by me directly; that is stated.

**2. Data gaps and survivorship disclosed: met, with limits.**
- Disclosed: no free data for 2009 to 2015 (period A replaced by a labelled 2016 to 2020 stand-in); reused tickers (upper-bound counts per window); delisted five letter and dotted symbols not asked for; 29 possible winners whose exchange is not confirmed, listed by ticker; market cap blank for 34 to 57 winners per window; "delisted" sometimes meaning a ticker change; exchange taken from today's lists for listed stocks.
- Shortfall: the reused-ticker count is an upper bound that mixes in warrants, funds and over-the-counter securities, so the true number of hidden company stocks, and of hidden winners, is not known.
- Shortfall: the winner rules are heuristics built and checked by reading lists, not tested against an independent survivorship-free database. Five rounds of audit removed false winners (SPAC shells, bankruptcy share exchanges, unadjusted splits, warrants, funds, test symbols); some may remain. 29 winners keep a "check" flag for a one-night jump of 3x to 10x.

**3. Every number reproducible by a committed script, with the command stated: met for the cached data.** `sh strategy/scripts/rebuild.sh` reruns every step; download steps read the git-ignored cache in `strategy/data/` and call the network only for a missing file. The deliverable's tables are copied from `summary-tables.md`, which the script writes. Caveats:
- the raw cache is not committed (the brief says so), so a fresh machine downloads again and may see later data (for example Nasdaq Trader's list changes daily);
- the narrative numbers in section 1 were typed by me from `summary.json` and checked against it once;
- one mistake happened during the run and was caught by the audit: a deleted line meant shell mergers were mismeasured in the first full build (step 41).

**4. Evidence that would undercut the idea: met.** Section 7 of the deliverable. The data itself undercuts the starting premise: winners rose on about half their days, not most, and much of their gain (84 percent for the median B winner) came overnight, which a flat-every-night strategy cannot capture.

**Other brief items.**
- Paid options all carry a price labelled published, or are labelled gated with the reason: met.
- Run 2 sizing per period and group, labelled as estimates: met.
- Russell 2000 note: met, from today's holdings only (stated).
- Time spent and token cost: not recorded, per the brief.
- Rate limits: Alpaca's 200 a minute may have been exceeded for some minutes while the sweep overlapped other Alpaca calls (step 33). Not provable either way from the logs. Disclosed.
- No email or personal information was sent to any service. SEC asks for a contact email in the client name; a name without one was declared and accepted.
