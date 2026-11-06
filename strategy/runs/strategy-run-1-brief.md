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
