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
