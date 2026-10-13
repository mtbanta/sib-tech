# Run 3 brief: describe the strongest stacks

## Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:

- Launched from `~/Projects/sib-tech`.
- Model: latest Opus, high effort. Advisor: on, latest Opus. Auto-mode: on.
- Playwright MCP already configured at project scope in `.mcp.json`, committed in run 1.
- No setting changed from run 2. The brief was copied from the raw file in TextEdit, so its markdown should arrive intact.

## What changed from the previous run

Levers changed: context and instructions. This is a deliberate exception to changing one lever per run.

Why both at once:
- Michael's answers to run 2's open questions remove scope (perpetual contracts are out entirely). An instructions-only run would spend effort on a route he has already closed.
- The instructions changes are mostly new sections (build hours, itemized cost, daily use, driver comparison, Anthropic answers). Their effect on the output is visible on its own, so a reader can still tell which lever produced what.

Context changes, from Michael's answers to run 2's section 7:
- Perpetual contracts are out entirely, including index perpetuals and perpetuals that are legally futures with no end date. The crypto wallet question is moot.
- All trading happens on one platform (one broker). A separate data vendor is fine.
- Data must be real time and cover trades on every U.S. exchange (consolidated data). A single-exchange feed is not enough.
- A wide daily screen may feed a short live list during the session.
- Michael will open a new margin account. His existing Schwab cash account is not used.
- Either driver is acceptable: Claude, or software Claude Code writes. Michael needs the pros and cons of each.
- Once a strategy is decided, speed and reliability of executing it are crucial.
- Michael's Claude Max plan is the 100 dollar a month tier.

Instructions changes, from Michael's review of run 2:
- Cover four options only: B, C, D and F as run 2 defined them. Option A is dropped as an option, but Claude as the driver is explained inside each of the four.
- New per-option content: Michael's hands-on build hours, an itemized monthly cost for two example setups, a bulleted "how Michael uses it" section, and how each driver model works in that option.
- A shared driver comparison, a shared borrowing cost table, and a plain-English glossary.
- Two research questions about Anthropic's terms.
- Formatting: bullets and tables throughout, and the HTML carries everything the markdown has.
- Michael reversed his earlier ruling that estimates wait until a stack is chosen.

Housekeeping, not part of either lever: a new prohibition on sending Michael's personal information anywhere. In run 2 a helper put his email address in requests to sec.gov (run 2 trajectory, section 6).

## Step zero: save this brief

Before anything else, write this entire brief, verbatim and unedited, to `runs/run-3-brief.md`. Then create `runs/run-3-trajectory.md` and paste this brief into its first section.

## The goal

When this run is done, Michael can choose among four stack options for a future agent that trades U.S. stocks and ETFs intraday. For each option he can see, without clicking through to any source:

- How many hours of his own hands-on time it would take to build.
- What it would cost each month, tool by tool, with a total, for two example setups.
- How he would use it day to day.
- How it works with Claude as the driver and with software as the driver, and the trade-offs.
- What borrowing would cost at the brokers that fit it.

He also gets your strongest pick and why, and direct answers to two questions about Anthropic's terms.

This run is research and recommendation only. The decision is Michael's.

### What you need to know about the future agent

- It is for Michael's own trading. It is not a product, and nothing is published or sold.
- Today it would research and recommend. Eventually it will place trades. The stack has to be judged on whether it can get there.
- Trading style is intraday. The agent needs to get in and out of positions repeatedly within the same day, sometimes within minutes.
- Reaction time: within 5 minutes is the target, and quicker is better.
- Once a strategy is decided, speed and reliability of executing it are crucial. Weigh this when you set your criteria and weights. The weights are still yours to choose and show.
- Instruments: U.S. stocks and ETFs (exchange traded funds) only. Perpetual contracts, options, futures and crypto are out. No shorting.
- One trading platform: every order goes through one broker. A separate data vendor is fine.
- Account: a new margin account. Michael would borrow little at first and increase borrowing only as the agent proves itself.
- Starting capital is 10,000 to 25,000 dollars.
- The agent may act alone inside fixed limits. It does not need Michael's approval for every order.
- A person signing in weekly is acceptable. Michael will likely sign in daily.
- Driver: either is acceptable. It could be Claude doing the work, or software that Claude Code writes and that runs on its own. Do not choose between them. Explain both.
- How often it runs is undecided. Score each option across three run modes (on a schedule, triggered by an event, on demand) and two memory modes (keeping memory across runs, and each run independent).
- Universe: as many names as possible across the Dow Jones Industrial Average, Nasdaq 100, NASDAQ Composite, NYSE Composite, S&P 500 and Russell 2000. A wide daily screen may feed a shorter live list during the session.
- Data: real time, covering trades on every U.S. exchange. Single-exchange feeds (for example IEX only) do not meet this.

### What Michael already has

Mention these where they bear on an option, but judge every option neutrally. Already owning something is neither a plus nor a minus in your scoring. In the itemized costs, list them at their real price and mark them "already paid".

- Claude Max, the 100 dollar a month tier, one account shared across Claude desktop, Cowork and Claude Code.
- Supabase Pro, about 25 dollars a month. His first project is covered by compute credits. Each additional project costs from 10 dollars a month.
- Vercel, free Hobby tier.
- GitHub, free tier, private repos.
- Node and npm installed locally on an M1 MacBook Air.
- No paid data subscriptions.
- A Schwab cash account that will not be used for this.

### How builds happen, for the hours estimate

Michael is a non-coder. Every build follows the same pattern as his other projects:
- Claude Code writes all code in auto-mode, with Advisor on.
- Claude Code reviews and tests its own work through Playwright and any other MCP server or API connection the build needs.
- One build piece per fresh Claude Code session, ending built, tested, committed and pushed.
- Michael's hands-on time is reading, deciding, approving, setting up accounts, and testing what Claude Code hands him.

Estimate Michael's hands-on hours under that pattern, not a developer's hours. Break it down by phase. Label every figure as an estimate, and say what would turn it into a measurement.

### Where this run stops

Cover these:
- Options B, C, D and F, as run 2 defined them, updated for the changes above.
- The categories of data and services each needs, with named candidates and cost bands.
- Two example setups per option, labeled clearly as examples and not picks:
  - Cheapest workable: the lowest-cost setup that still meets every requirement above.
  - Recommended: the setup you would suggest for speed and reliability.

Do not decide:
- Which provider Michael uses. The example setups illustrate. They do not choose.
- What the agent researches.
- How often it runs.
- Which tickers it watches.

Include broker and regulatory rules wherever they bear on picking the stack, including margin rules and which day trading rule each broker applies to a new account under 25,000 dollars. Leave out perpetual contract law, now out of scope.

### Two questions about Anthropic

Answer each with quotes from Anthropic's own pages. Do not interpret the law. Say plainly what only Anthropic can settle in writing.

1. What does it take to open and use a commercial Anthropic account with pay-as-you-go API use? How would that account enable or limit using Claude to identify trades and execute them for Michael's own account?
2. How do Anthropic's Commercial Terms and Usage Policy define a "qualified person" who must review personalized buy or sell recommendations? What do the texts say about whether the account owner can be that person?

## The sources

Use:
- Live web research. It's authorized and expected.
- The Playwright MCP, for pages that need JavaScript to render.
- `~/Projects/relii/CLAUDE.md`, read only. Read that one file and nothing else in that repo.
- This repo's `CLAUDE.md` and `PROJECT_STATE.md`.
- The trails of runs 1 and 2: `runs/run-1-deliverable.md`, `runs/run-2-deliverable.md`, both trajectories and the six `runs/run-*-notes-*.md` files. Read run 2's deliverable and trajectory in full before researching.

Reusing earlier sources:
- You may cite run 1 and run 2 sources with their original access dates and labels.
- Reopen a page only where this run's changes touch it. Every price that goes into an itemized cost table must have been seen on the vendor's own page in run 2 or run 3, or be labeled as gated or corroborated.
- Say in the trajectory which earlier findings you reused, which you reopened, and why.

Ignore:
- Anything in `~/Projects/relii` other than its CLAUDE.md.
- Your own recalled knowledge as evidence. Use it to decide where to look, but every capability or pricing claim needs a live source.

Source strength:
- Use every kind of source you find: vendor documentation, reputable press, review sites, affiliate blogs, forums.
- Label each one by strength, using the same scale as runs 1 and 2.

Gated pricing:
- If a price sits behind a login, sales call or signup, do not create an account or start a trial.
- Record that the price is gated, then look for multiple independent sources.
- Label every price as published, corroborated (and name the sources), or gated and unverified.

## The output

Two files, plus the trajectory. Build them in this order:

1. Finish `runs/run-3-deliverable.md` and `runs/run-3-trajectory.md` first, so they're ready to commit.
2. Only then start the HTML.

If the session runs short, a complete markdown file without the HTML beats both files half done.

### Formatting rules for both files

- Bullets and tables throughout. No paragraph longer than three sentences.
- Lead every section with its key point.
- Michael is a non-coder. Write in plain English and define every acronym the first time it appears.
- Never make Michael click a link to understand something. Footnotes are for checking, not for explaining.
- No em dashes or en dashes anywhere.
- State plainly that this is research input for a human decision, never an instruction to trade.

### `runs/run-3-deliverable.md`, the source of record

Contents, in this order:

1. Summary. Your strongest option and why, in bullets.
2. What changed since run 2, option by option, so the two runs can be compared.
3. Plain-English glossary. Include at least:
   - Each cost band, in dollars a month, and what that level of spending typically buys.
   - The borrowing cap options at the brokers that offer one, defined (for example, what a setting of 1, 2 or 4 means in dollars at 10,000 and 25,000 of equity).
   - Every other term a non-coder would need.
4. Your criteria and weights, with a short reason for each weight.
5. Your scale for source strength and your cost bands.
6. Driver models compared: Claude as the driver versus software as the driver. For each, in bullets: how it works, speed, reliability, cost, safety, and what Anthropic's terms say about it.
7. Shared reference, as tables: margin rules, which day trading rule each broker applies, data candidates, broker candidates.
8. Borrowing cost table, shared across options: each broker that fits any option, its published margin rate, and the cost of borrowing 2,000, 5,000 and 10,000 dollars held overnight for one month. Note any broker that charges nothing for money borrowed and repaid within the same day. Keep borrowing out of the monthly platform totals.
9. Options B, C, D and F. For each:
   - The architecture in plain English, as bullets.
   - Driver models: how this option works with Claude as the driver, and with software as the driver.
   - Categories, candidates, coverage of the universe preference, and cost bands.
   - Brokerage and order execution candidates.
   - Account and regulatory rules that affect it.
   - Scores against your criteria, and across the run modes and memory modes.
   - Build estimate: Michael's hands-on hours by phase, and the total.
   - Example setups, cheapest workable and recommended. For each, a table with one row per tool: tool, plan, what it does in this stack, monthly price, price label, footnote. Then the monthly total. Mark tools Michael already pays for.
   - How Michael uses it, bullets only:
     - A day with this stack: before the open, during the session, after the close.
     - What he checks.
     - What he can change, and how.
     - How he stops it.
     - What alerts he gets, and how.
   - Pros and cons.
   - Its failure mode: the most likely way it breaks or disappoints.
10. Comparison table across the four options, including build hours, both monthly totals, and each driver model.
11. Answers to the two Anthropic questions.
12. Falsifiability: what specific evidence would overturn your strongest pick.
13. Open questions for Michael that the research could not settle.
14. Sources.

Sourcing rules:
- Every claim gets a numbered footnote marker.
- The Sources section lists each number with title, URL, access date, strength label, and, for prices, published, corroborated or gated.

### `runs/run-3-deliverable.html`, the interactive view

- Built from the markdown. Footnote numbers and the source list may be filled in by script, as Michael approved after run 1.
- It carries everything the markdown has, including the glossary, the rules, the data and broker tables, the borrowing table, the example setups and the daily use sections. Nothing should live only in the markdown.
- Give Michael multiple interactive ways to view and compare the options. The design is your call.
- Charting libraries may load from a public CDN (content delivery network). Everything else lives in the one file, and it must open by double-clicking it locally.
- The HTML may not contain any claim that is not in the markdown. If the two ever disagree, the markdown is correct.
- Footnote markers link to a sources panel showing the same fields as the markdown Sources section.

## The standard

Michael accepts the work when all of these hold, and rejects it otherwise:

1. Every connector claim traced to a live source with an access date.
2. Pricing verified rather than recalled.
3. Each option's failure mode named.
4. The recommendation falsifiable, stating what evidence would overturn it.

## Documenting your work: `runs/run-3-trajectory.md`

Append to this file as you work, after each source and each decision. Do not write it all at the end. If the session runs out of room, the trail has to survive. Required structure:

1. The brief as given, verbatim.
2. The sequence of what you actually did, in the order it happened.
3. Sources, every one, with URL and access date.
4. Decision points, each with what you chose and why. Choosing criteria, weights, cost bands, example setups and hour estimates counts.
5. Dead ends, each with what you dropped and why.
6. Self-assessment against the standard above, item by item, including where the run fell short.

Do not record time spent or token cost.

## Run conventions

- File names: `runs/run-3-brief.md`, `runs/run-3-deliverable.md`, `runs/run-3-deliverable.html`, `runs/run-3-trajectory.md`, and `runs/README.md` as the index. Add one line to the index for run 3: number, date, "context and instructions: Michael's answers, plus build hours, itemized cost and daily use", outcome.
- Update `PROJECT_STATE.md`: a new Runs table row for run 3 with lever "context and instructions", Current Stage, Completed and Next Steps. Do not write a stack into CLAUDE.md's Tech stack section, because this run recommends and Michael decides.
- Check the date with `date` before writing any date.
- Done means all five of these are true:
  1. The deliverable is written.
  2. The trajectory is written.
  3. The index entry exists.
  4. PROJECT_STATE.md is updated.
  5. Everything is committed and pushed.
- One commit and one push, at the end, covering everything the run produced. Auto-mode's carve-out covers that commit and push, so don't stop to ask.
- Then end the session. Do not start run 4.

## Prohibitions

- No scaffolding. Do not run npm, pip or any package manager. Do not create package.json, a lockfile, a virtual environment or an application folder structure. Do not create a database. Creating files under `runs/` is allowed.
- No connector or MCP server configured for the future agent itself. Playwright is for your research only.
- No account creation and no trial signups, anywhere.
- Nothing installed. The Playwright MCP running through npx, as set up before this session, is the one authorized exception.
- No reading anything in `~/Projects/relii` except its CLAUDE.md.
- No credentials, API keys or account numbers in any file or commit message.
- Never send Michael's name, email address or any other personal information to any website or service, including inside request headers such as a User-Agent. If a site requires automated readers to identify themselves, read it in the browser instead, or skip it and record it as a dead end. Give this rule, word for word, to every research helper you start.
