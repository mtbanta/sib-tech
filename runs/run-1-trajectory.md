# Run 1 trajectory

This file is appended to as the run proceeds. It is a record of how the run 1 deliverable was reached. Nothing in it is an instruction to trade. It is research input for a human decision.

## 1. The brief as given

Verbatim copy of `runs/run-1-brief.md`, saved as the first act of the session on 2026-10-08 (date checked with `date`: Thu Oct 8 18:51 CDT 2026).

````text
Run 1 brief: scope the stack

Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:





Launched from ~/Projects/sib-tech.



Model: latest Opus, high effort. Advisor: on, latest Opus. Auto-mode: on.



Playwright MCP added at project scope through npx, which creates .mcp.json in the repo.

What changed from the previous run

Nothing. This is run 1.

Step zero: save this brief

Before anything else, create the runs/ folder and write this entire brief, verbatim and unedited, to runs/run-1-brief.md. Then create runs/run-1-trajectory.md and paste this brief into its first section. For this run, this step comes before the git wiring, even though CLAUDE.md says to wire git first. Saving the brief does not conflict with the wiring because runs/ is untracked and does not exist on the remote.

Step one: git wiring (CC runs this)

If .git already exists in ~/Projects/sib-tech, skip this whole step and note that in the trajectory.

Otherwise run these one at a time, and verify each one worked before running the next (for example git remote -v after adding the remote, and git branch -vv after checkout). Do not assume.

cd ~/Projects/sib-tech
git init
git remote add origin https://github.com/mtbanta/sib-tech.git
git fetch origin
git checkout -b main --track origin/main

Then write .gitignore containing .DS_Store, before any commit. If any step fails, stop, record the exact error in the trajectory, and do not improvise a workaround that rewrites history or force-pushes.

The goal

When this run is done, Michael can choose a technology and tool stack for a future agent that does intraday trading in U.S. stocks and ETFs. He'll choose from up to five researched options, see which one you consider strongest and why, and trace every claim to a dated live source.

This run is research and recommendation only. The decision is Michael's.

What you need to know about the future agent





It is for Michael's own trading. It is not a product, and nothing is published or sold.



Today it would research and recommend. Eventually it will place trades. The stack has to be judged on whether it can get there.



Trading style is intraday.



Instruments are U.S. stocks and ETFs only (an ETF is an exchange traded fund). No shorting. No margin.



The account would be a cash account, not a margin account.



Who drives the future agent is deliberately undecided. It could be Claude Code itself doing the work, or software that Claude Code writes and that runs on its own. Tag each option with which of those driver models it supports. Do not choose between them.



How often it runs is undecided. Score each option across three run modes: on a schedule, triggered by an event, and on demand. Also score it two ways on memory: keeping memory across runs, and running each time independently.



Universe preference: Dow Jones Industrial Average (30 stocks), Nasdaq 100, NASDAQ Composite, NYSE Composite, S&P 500, Russell 2000. This is a preference, not a filter. Report each candidate provider's coverage of these. A provider that misses one is noted, not ruled out.



What Michael already has

Mention these where they bear on an option, but judge every option neutrally. Already owning something is neither a plus nor a minus in your scoring.





Claude Max, one account shared across Claude desktop, Cowork and Claude Code, so usage is drawn from one plan.



Supabase Pro, about 25 dollars a month. His first project is covered by compute credits. Each additional project costs from 10 dollars a month.



Vercel, free Hobby tier.



GitHub, free tier, private repos.



Node and npm installed locally on an M1 MacBook Air.



A regular Charles Schwab brokerage cash account holding equities and cash. Historically he buys and holds and rarely sells, and he has never sold anything held under a year. Treat Schwab like any other broker candidate.



No paid data subscriptions.



Where this run stops

Cover these:





The architecture options.



The categories of data and services each architecture needs. Include brokerage and order execution as a category.



Named candidate providers in each category.



Cost bands per category, defined by you.

You may say which candidates fit which option. Do not decide:





Which provider to use.



What the agent researches.



How often it runs.



Which tickers it watches.

Include broker and regulatory rules wherever they bear on picking the stack. That includes rules on how often a cash account can trade and when proceeds from a sale can be used again. Leave out rules that don't affect the stack choice.

The sources

Use:





Live web research. It's authorized and expected, and it's the point of this run.



The Playwright MCP, for vendor pricing and documentation pages that need JavaScript to render.



~/Projects/relii/CLAUDE.md, read only, to describe the Relii stack accurately. Read that one file and nothing else in that repo.



This repo's CLAUDE.md and PROJECT_STATE.md.

Starting points, not a closed list: the two directions in CLAUDE.md (a Relii-style web app on Next.js, Vercel and Supabase, and a Claude-native agent built on connectors and MCP servers) and the tools named there (LiquidTrade, QuiverQuant, FireCrawl, Co-Invest). None of them has to show up in your final options. Go wherever the evidence leads.

Ignore:





Anything in ~/Projects/relii other than its CLAUDE.md.



Your own recalled knowledge as evidence. Use it to decide where to look, but every capability or pricing claim needs a live source.

Source strength:





Use every kind of source you find: vendor documentation, reputable press, review sites, affiliate blogs, forums.



Label each one by strength, using a scale you define and state in the deliverable.

Gated pricing:





If a price sits behind a login, sales call or signup, do not create an account or start a trial.



Record that the price is gated, then look for multiple independent sources.



Label every price as published, corroborated (and name the sources), or gated and unverified.



The output

Two files, plus the trajectory. Build them in this order:





Finish runs/run-1-deliverable.md and runs/run-1-trajectory.md first, so they're ready to commit.



Only then start the HTML.

If the session runs short, a complete markdown file without the HTML beats both files half done.

runs/run-1-deliverable.md, the source of record

Contents, in this order:





Summary. Your strongest option, and why, in a few sentences.



Your criteria and weights. You choose them and show them, with a short reason for each weight.



Your scale for source strength and your cost bands, defined.



Up to five options. If you find fewer viable ones, present only those and say why there aren't more. You don't need one of each direction. For each option:





The architecture in plain English.



The driver models it supports.



The data and service categories it needs, with candidate providers, coverage of the universe preference, and the cost band for each.



Brokerage and order execution candidates.



Account and regulatory rules that affect it.



Scores against your criteria.



Scores across the three run modes and the two memory modes.



Pros and cons.



Its failure mode: the most likely way it breaks or disappoints.



A comparison table across all options.



Falsifiability: what specific evidence would overturn your strongest pick.



Open questions for Michael that the research could not settle.



Sources.

Sourcing rules:





Every claim gets a numbered footnote marker.



The Sources section lists each number with title, URL, access date, strength label, and, for prices, published, corroborated or gated.

Writing rules:





Michael is a non-coder. Write in plain English and define every acronym the first time it appears.



No em dashes or en dashes anywhere.



State plainly that this is research input for a human decision, never an instruction to trade.



No length cap. Be as long as the content needs and no longer.



runs/run-1-deliverable.html, the interactive view





Write it by hand from the markdown file. Install no converter.



Give Michael multiple interactive ways to view and compare the pros and cons of the options. The design is your call.



Charting libraries may load from a public CDN (content delivery network). Everything else lives in the one file, and it must open by double-clicking it locally.



The HTML may not contain any claim that is not in the markdown. If the two ever disagree, the markdown is correct.



Footnote markers link to a sources panel showing the same fields as the markdown Sources section.



The standard

Michael accepts the work when all of these hold, and rejects it otherwise:





Every connector claim traced to a live source with an access date.



Pricing verified rather than recalled.



Each option's failure mode named.



The recommendation falsifiable, stating what evidence would overturn it.



Documenting your work: runs/run-1-trajectory.md

Append to this file as you work, after each source and each decision. Do not write it all at the end. If the session runs out of room, the trail has to survive. Required structure:





The brief as given, verbatim.



The sequence of what you actually did, in the order it happened.



Sources, every one, with URL and access date.



Decision points, each with what you chose and why. Choosing criteria, weights and cost bands counts.



Dead ends, each with what you dropped and why.



Self-assessment against the standard above, item by item, including where the run fell short.

Do not record time spent or token cost.

Run conventions





File names: runs/run-1-brief.md, runs/run-1-deliverable.md, runs/run-1-deliverable.html, runs/run-1-trajectory.md, and runs/README.md as the index. Create the index with one line for run 1: number, date, "first run", outcome.



Update PROJECT_STATE.md: the Runs table row for run 1, Current Stage, Completed and Next Steps. Do not write a stack into CLAUDE.md's Tech stack section, because this run recommends and Michael decides.



Check the date with date before writing any date.



Done means all five of these are true:





The deliverable is written.



The trajectory is written.



The index entry exists.



PROJECT_STATE.md is updated.



Everything is committed and pushed.



One commit and one push, at the end, covering everything the run produced. That includes .gitignore and the .mcp.json the Playwright setup created. Auto-mode's carve-out covers that commit and push, so don't stop to ask.



Then end the session. Do not start run 2.



Prohibitions





No scaffolding. Do not run npm, pip or any package manager. Do not create package.json, a lockfile, a virtual environment or an application folder structure. Do not create a database. Creating runs/ is allowed.



No connector or MCP server configured for the future agent itself. Playwright is for your research only.



No account creation and no trial signups, anywhere.



Nothing installed. The Playwright MCP running through npx, as set up before this session, is the one authorized exception.



No reading anything in ~/Projects/relii except its CLAUDE.md.



No credentials, API keys or account numbers in any file or commit message.
````

## 2. Sequence of what was actually done

Entries are in the order they happened.

1. Read `PROJECT_STATE.md` (required by the start-of-session rule in `CLAUDE.md`), ran `date`, and listed the project folder. Found: no `.git`, no `runs/`, a `.mcp.json` holding only the Playwright MCP entry, `CLAUDE.md`, `PROJECT_STATE.md`, `.DS_Store` and a `.claude/` folder.
2. Step zero: created `runs/` and wrote the brief verbatim to `runs/run-1-brief.md`. Created this file with the brief in section 1.
3. Step one, git wiring. `.git` did not exist, so the step was run, one command at a time, each verified:
   - `git init`: output "Initialized empty Git repository". Verified with `git status`.
   - `git remote add origin https://github.com/mtbanta/sib-tech.git`: verified with `git remote -v` (fetch and push both point at the repo).
   - `git fetch origin`: brought down `origin/main`, one commit `a750708 Initial commit`, containing only `README.md`.
   - `git checkout -b main --track origin/main`: git answered "Already on 'main'" and "branch 'main' set up to track 'origin/main'". Verified with `git branch -vv`, which shows `main a750708 [origin/main]`. `README.md` is now in the folder. `CLAUDE.md`, `PROJECT_STATE.md`, `.mcp.json`, `.claude/` and `runs/` remain untracked, as expected.
   - Wrote `.gitignore` containing the single line `.DS_Store`. Verified `.DS_Store` no longer shows in `git status`.
   - No step failed. No history was rewritten and nothing was force-pushed.
   - Observation: `.claude/settings.local.json` exists (it only enables the Playwright MCP server for this project and holds no credential). It is a per-machine local settings file. See decision D1.
4. Read `~/Projects/relii/CLAUDE.md` (that one file only). Logged as source T1.
5. Consulted the advisor before any research. Advice taken: research in constraint order with brokers first (automated order placement into a cash account is the tightest constraint), treat data coverage as two questions (which securities a feed covers, and where index membership lists come from), find a source behind every run-mode score, keep a source register with labels assigned at capture time, and split the reading across parallel research helpers. See decisions D2 to D4.
6. Defined the source strength scale and the price labels (D2) before the first search so every source is labeled when captured.
7. Started three parallel research helpers (subagents, which are separate Claude sessions that report back to this one), each with questions rather than hypotheses, and each bound by the same prohibitions as this run. Topics: (a) brokers and regulation, (b) market data and universe coverage, (c) runtime, hosting and Claude platform limits. Each writes a findings register to a notes file under `runs/` as it goes. The main session kept the fourth topic for itself: the four named tools (LiquidTrade, QuiverQuant, FireCrawl, Co-Invest), the Claude connector directory, and all pages needing the Playwright browser.
8. Main session researched the four named tools while the helpers ran (sources T2 to T16). Findings: LiquidTrade and Co-Invest are one vendor (Liquid, at liquid.trade, company LiquidX AI, Inc.). Its "US stocks" are perpetual contracts routed to crypto-style venues, not shares held at a broker, and by its own terms it is not a broker-dealer. QuiverQuant sells an API with its own remote MCP server from 30 dollars a month. Firecrawl publishes its prices and has a free monthly allowance.
9. Noticed that the Playwright MCP writes page snapshots into a `.playwright-mcp/` folder at the repo root. These are browser scratch files, not run deliverables. They are left out of the commit (see D6).
10. Browsed Anthropic's connector directory with Playwright (T17 to T19). Loaded all 927 listed connectors and read the names, then opened the two broker connector pages. Finding that shapes the options: both brokers with an official listed connector (Interactive Brokers and Webull) expose account and market data to Claude but do not let Claude send an order to the market through the connector.
11. Independent spot check of the pattern day trader rule status (T21, T22), done by the main session without reference to the helper's answer, so the two can be compared.
12. Waited for the three helpers to finish.
13. The runtime and platform helper finished first: 89 findings (RT-01 to RT-89) in `runs/run-1-notes-runtime-platform.md`, with a not-verified list of 20 items and 7 contradictions. Method note from the helper: it fetched many pages with `curl` (a command that downloads a page's raw text) as well as the fetch and search tools, because the fetch tool paraphrased. It reported creating no file other than its notes file and installing nothing. The main session read its summary table, not-verified list, contradictions and a compact index of all 89 findings.
14. Main-session verification of the helper's most consequential finding (T23 to T25): Anthropic's Consumer Terms, which govern a Max plan, list relying on the service "to buy or sell securities" or to "receive advice about securities" among prohibited uses. Confirmed on the live page. Checked the Commercial Terms (which govern pay-as-you-go API use): no equivalent passage found. Checked the Usage Policy: personalized buy, sell or hold recommendations are a high-risk area needing review by a qualified person. This is the single finding most likely to shape the driver-model tags, so it is reported as a quoted fact with the legal reading left to Michael and, if he wants certainty, to Anthropic or a lawyer.
15. Tried QuantConnect's pricing page in the browser for the live trading node price the helper could not read (T26). Not found there either.
16. The market data helper finished: 72 findings (MD-01 to MD-72) in `runs/run-1-notes-market-data.md`, 21 not-verified items, 12 contradictions. Its own reliability note: four findings quote PDF text exactly, and every other quote passed through the fetch tool's summarizing model, so wording should be re-opened before a decision hangs on it.
17. Main-session spot checks of market data prices on the vendors' own pages (T27 to T30). Massive and Alpaca matched the helper. Financial Modeling Prep did not: the vendor page gave different prices from the third-party sites the helper had to rely on, so the vendor figures replace them. Finnhub's page rendered in the browser and gave the free tier and one 3,500 dollar plan.
18. The brokers and regulation helper finished: 73 findings (BR-01 to BR-73) in `runs/run-1-notes-brokers-regulation.md`, 17 not-verified items, 28 pages needing a browser, 7 contradictions. Its biggest stated limitation: Schwab, Interactive Brokers, TradeStation's main site and E*TRADE's developer site all refused the fetch tool, so no Schwab-owned page was read and every Schwab fact it has is strength D. Method note from the helper: it read four PDFs that the fetch tool had saved outside the repo, using the Mac's built-in Python with nothing installed. Its pattern day trader finding (approved April 14, 2026, effective June 4, 2026, phase-in to October 20, 2027) matches the main session's independent check in T22.
19. Opened in the browser the broker pages that had refused the helper (T31 to T35): Schwab's developer portal, Schwab's cash account violations page, Schwab's pricing page and Interactive Brokers' plan comparison. Result: Schwab's personal trading API, its cash account rules and its zero commission are now confirmed on Schwab's own pages. Schwab's refresh token life is not stated on any public Schwab page found, so the "sign in again every 7 days" claim stays at strength D.
20. Closed the browser. Stated the planned option set, criteria, weights and cost bands, then consulted the advisor a second time before writing. Advice taken: do not let the pick choose a driver, provider or run frequency; mark Alpaca as failing the cash account requirement; normalize price labels to the brief's three; footnote negative connector claims; treat the Anthropic terms finding as cross-cutting; treat market data licensing for automated use as an open question; define what scores of 1, 3 and 5 mean; split event mode into callback and stream; write the HTML by hand and use a script only to check it. Decisions D7 to D16 record the choices.
21. Wrote the deliverable in four parts (summary, criteria and scales; the shared rules and candidate catalog; options A to C; options D and E, comparison, falsifiability, open questions, sources). After each part the numbering script was run so that `runs/run-1-deliverable.md` existed on disk in partial form. Final state: 204 numbered sources, every footnote marker has a Sources entry and every Sources entry is cited, no em or en dashes.
22. Checked the score arithmetic by script: weighted totals A 2.75, B 3.25, C 3.60, D 3.85, E 3.30. Equal weights give D 3.71, C 3.43, B 3.29, A 3.00, E 3.00. Operability-first weights (path 20, intraday 10, flexibility 10, operability 35, safety 10, cost 10, reversibility 5) give B 3.45, A 3.35, D 3.30, C 3.15, E 3.15. The falsifiability figures (D at 3.55 with flexibility 3, D at 3.60 with path 3, E at 3.65 with path 5 and cost 3) were checked the same way.
23. Loaded the data visualization skill and validated the five option colors with its bundled checker, in light and dark mode (all checks pass, with one contrast warning in light mode that is answered by always showing the number beside each bar and by the table views). The checker is a script that ships with Claude Code. Nothing was installed.
24. Wrote `runs/run-1-deliverable.html` by hand as a single file with no outside dependency (no charting library was needed, so nothing loads from a content delivery network). Seven views: overview, a weight explorer with sliders and presets, a scores grid, head to head, a pros and cons explorer filtered by criterion, what would overturn the pick with the open questions, and sources. Footnote markers open a sources panel showing number, title, address, access date, strength, price label and register ID. See D21 for the one mechanical step.
25. Checked the HTML by script: all 57 footnote numbers it uses exist in the markdown, no em or en dashes, and 108 of 110 sentences in its data are word for word in the markdown. The other two are shortened forms of markdown sentences ("Claude calls connectors to fetch prices, news and filings, reasons about them, and writes its recommendation to a file." and "This is a fact about the option, not a choice of driver."), not new claims.
26. Render test. The browser tool refuses addresses that start with `file:`, so the page was served for a minute by Python's built-in local web server (nothing installed, stopped afterwards and confirmed stopped) and opened in the browser. Confirmed: 7 tabs, 5 option cards, 204 sources in the panel, the three weight presets give D 3.85, B 3.45 and D 3.71 as in the markdown, the grids and filters fill, a footnote click opens the panel on the right source, no sideways scrolling. The only console error was the test server lacking a site icon. Looked at a screenshot of the weight explorer and fixed the axis numbers so they sit under the grid lines.
27. Wrote `runs/README.md`, updated `PROJECT_STATE.md`, wrote the self-assessment below, and ran dash and credential checks over every file to be committed.
28. Consulted the advisor a third time, before committing. It found two scores that contradicted the run's own rubric. Both were corrected (see D24), both files were rebuilt, and the arithmetic was rechecked by script. New weighted totals: A 2.50, B 3.25, C 3.60, D 3.85, E 3.15. Equal weights: D 3.71, C 3.43, B 3.29, A 2.86, E 2.86. Operability-first weights: B 3.45, D 3.30, A 3.15, C 3.15, E 3.05. The pick did not change. The order below it did: the web app now ranks above the hosted platform. The figures in step 22 are the earlier ones and are left as they were recorded.
29. Extended the HTML check to the page's fixed text as well as its data. The sentences that do not match the markdown word for word are page navigation, headings, and reworded forms of statements that are in the markdown (the summary sentence and the strength scale). No claim is on the page that is not in the markdown.
30. The last act of the run, which by its nature cannot be recorded from inside the commit: stage the run's files by explicit path, make one commit, push once to `origin/main`. If the push fails, the run stops there, with no force-push and no second commit, and the exact error goes to Michael in the session's final message. Whether it succeeded is visible in the repository's history, not in this file.

## 3. Sources

Every source consulted, with URL and access date. Numbering here is the order of access and is not the footnote numbering of the deliverable.

Sources gathered by the three research helpers are listed in full, with URL, access date, strength label and a short quote, in their notes files, which are part of this trajectory:

- `runs/run-1-notes-brokers-regulation.md`
- `runs/run-1-notes-market-data.md`
- `runs/run-1-notes-runtime-platform.md`

Sources gathered by the main session (IDs starting with T):

- **T1.** Relii project instructions, local file `~/Projects/relii/CLAUDE.md`, read 2026-10-08. Strength A (the owner's own document). Gives the Relii stack: Next.js deployed on Vercel, Supabase for database, auth and file storage, OpenAI Realtime API for voice, browser MediaRecorder for webcam capture, and scoring by a large language model.
- **T2.** Web search, "LiquidTrade MCP server Claude connector trading", 2026-10-08. No product called LiquidTrade found under that name. Returned unrelated trading connectors.
- **T3.** Web search, "Co-Invest MCP connector Claude stock research", 2026-10-08. Surfaced a third-party directory listing (mcpservers.org/servers/co-invest-mcp, which refused a direct fetch with HTTP 403) that ties Co-Invest to a company called Liquid.
- **T4.** Extended web search tying Liquid and Co-Invest together, 2026-10-08. Surfaced the vendor page and press coverage below. This resolved the two names in `CLAUDE.md`: "LiquidTrade" is the trading venue front end at liquid.trade and "Co-Invest" is its connector for AI assistants. They are one vendor, not two.
- **T5.** Liquid, "AI Trading in ChatGPT, Claude, Grok, and Meta Muse, Liquid Co-Invest", https://www.liquid.trade/coinvest, accessed 2026-10-08 (WebFetch and Playwright). Strength A (vendor page). Connector address is https://coinvest.liquid.trade. Quote: "Your funds sit in your own wallet, not on a Liquid server." Quote: the assistant "can't transfer money out, change your account settings, or send a single order without you tapping Confirm." Price: "Co-Invest costs nothing to install or use" (published), plus Liquid's trading fees. Footer names the company as LiquidX AI, Inc.
- **T6.** Traders Magazine, "Liquid Launches Co-Invest", https://www.tradersmagazine.com/news/liquid-launches-co-invest/, dated 2026-05-26, accessed 2026-10-08. Strength B for the outlet, but the text is a republished vendor press release, so treated as strength A for what the vendor claims and nothing more. Quote: the platform "routes trades to underlying venues including Hyperliquid, Lighter, and Ostium."
- **T7.** Liquid, Terms of Service, https://www.liquid.trade/termsofservice, last updated 2026-09-17, accessed 2026-10-08. Strength A. Quotes: "We do not operate any exchange, designated contract market, swap execution facility, broker-dealer," and users may "trade digital asset pairs and perpetual contracts directly in a peer-to-peer manner." and "The App and Protocol are non-custodial in nature." The terms list embargoed countries and do not name the United States either way.
- **T8.** Liquid docs, fees page, https://docs.liquid.trade/trading/fees (redirects to https://docs.tryliquid.xyz/trading/fees), accessed 2026-10-08. Strength A. Price, published: perpetuals tier 0 taker 0.095 percent and maker 0.065 percent; "On all Ostium-routed trades, Liquid adds 5 bps."
- **T9.** Liquid, Co-Invest docs, https://www.liquid.trade/coinvest-docs, accessed 2026-10-08. Strength A. Quote: "Liquid's perpetual markets span crypto, US stocks, commodities". Quote: "an order is not sent until you confirm it." Also describes a "Co-Invest Computer" mode that can "send live orders within the limits you enable", and a 15 dollar minimum collateral per order.
- **T10.** Web search, "Quiver Quantitative API pricing MCP server", 2026-10-08. Third-party pages disagreed on price (10, 25, 75 dollars), so the vendor pages below were fetched.
- **T11.** Quiver Quantitative, "Premium vs API", https://www.quiverquant.com/premium-vs-api/, accessed 2026-10-08. Strength A. Price, published: Quiver Premium (the website subscription) 25 dollars a month or 300 dollars a year. Quote: "Premium doesn't include an API key." Quote: "MCP isn't a separate subscription."
- **T12.** Quiver Quantitative API pricing, https://api.quiverquant.com/pricing/, accessed 2026-10-08. Strength A. Prices, published: Hobbyist 30 dollars a month (25 a month billed yearly), with "10 of 18 Quiver MCP Tools". Trader 75 dollars a month (62.50 billed yearly), with "All 18 Quiver MCP Tools". Both marked "No Commercial Use Rights". Hobbyist datasets include Congress trading, government contracts, lobbying, off-exchange trading and daily equity prices. Trader adds insider trading, hedge fund activity, top shareholders, patents, executive pay, app ratings and the Quiver newsfeed. Rate limits are not stated.
- **T13.** Quiver Quantitative, MCP Server page, https://api.quiverquant.com/mcp-server/, accessed 2026-10-08. Strength A. The server is remote at https://mcp.quiverquant.com/ and uses an API key. Quote: "Works with Claude Code/Desktop, Cursor, VS Code, and any MCP-compatible client."
- **T14.** Web search, "Firecrawl pricing plans MCP server official", 2026-10-08. Third-party trackers disagreed on the free allowance, so the vendor page was fetched.
- **T15.** Firecrawl pricing, https://www.firecrawl.dev/pricing, accessed 2026-10-08. Strength A. Prices, published: Free, "1,000 credits every month, refreshed monthly, no credit card required", 2 concurrent requests. Hobby 19 dollars a month billed monthly or 16 a month billed yearly, 5,000 credits. Standard 83 dollars a month (yearly billing rate), 100,000 credits. Growth 333. Scale 599. "1 credit = 1 page on a basic scrape, crawl, or map."
- **T16.** Two searches for Liquid's United States eligibility (query: liquid.trade terms of service restricted jurisdictions "United States" LiquidX AI perpetuals stocks Hyperliquid), 2026-10-08. Nothing from Liquid states a United States position. A different Hyperliquid front end (trade.xyz docs, https://docs.trade.xyz/about-trade-xyz/introduction, strength A for that vendor only) says its interface may be unavailable in the U.S. That is not evidence about Liquid.
- **T17.** Anthropic, Claude Marketplace, "Connectors and plugins", https://claude.com/marketplace/connectors-plugins (claude.com/connectors redirects here), accessed 2026-10-08 with Playwright. Strength A. The page showed "Show all 926" and, once every page was loaded, "Showing all 927 connectors". The Financial services filter (https://claude.com/marketplace/connectors-plugins?categories=financial-services) showed "142 connectors". Read all 927 names. Listed and relevant to U.S. stocks: Interactive Brokers (IBKR), Webull, Alpha Vantage MCP Server, Twelve Data, FMP (Financial Modeling Prep), Financial Datasets, Morningstar, MT Newswires, Zacks Data, Clear Street, TEXT TO QUANT, Bigdata.com, Aiera, Quartr, Fiscal.ai, viaNexus vAST, Finance Toolkit, S&P Global, FactSet, LSEG, and Firecrawl. Also listed, relevant to hosting: Supabase, Vercel, Railway, Render, Cloudflare Developer Platform, Neon, n8n, Zapier. NOT in the list on this date: Alpaca, Charles Schwab, Polygon or Massive, Quiver Quantitative, Liquid or Co-Invest, Tradier, Public, Robinhood, E*TRADE, tastytrade, TradeStation, Fidelity, Databento, QuantConnect. Absence from the directory does not mean no MCP server exists, only that it is not in Anthropic's listed directory.
- **T18.** Anthropic, connector page for Interactive Brokers, https://claude.com/marketplace/connectors/interactive-brokers, accessed 2026-10-08 with Playwright. Strength A. Made by Interactive Brokers, added May 2026, connector URL https://api.ibkr.com/v1/api/mcp, sign-in required. Ten tools, all read or draft (balances, positions, orders, price history, price snapshot, search contracts, get_order_instructions). Quote: trade instructions "are sent to your IBKR account for your review and approval. Claude never submits orders directly to the market."
- **T19.** Anthropic, connector page for Webull, https://claude.com/marketplace/connectors/webull, accessed 2026-10-08 with Playwright. Strength A. Made by Webull, added July 2026, connector URL https://api.webull.com/mcp, sign-in required. The page says "Show all 71 tools". The only order-related tools are get_open_orders, get_order_detail and get_order_history. No tool places, changes or cancels an order. Stock data tools include get_stock_bars, get_stock_quotes, get_stock_snapshot and get_stock_tick.
- **T20.** Anthropic, connector page for Firecrawl, https://claude.com/marketplace/connectors/firecrawl, accessed 2026-10-08 with Playwright. Strength A. Made by Firecrawl, added July 2026, connector URL https://mcp.firecrawl.dev/v2/mcp-search, sign-in required. Tools include firecrawl_search and firecrawl_scrape. Described as supporting "website change monitoring".
- **T21.** Extended web search limited to finra.org, sec.gov and federalregister.gov, "FINRA pattern day trader rule 4210 amendment SEC approval intraday margin effective date 2026", 2026-10-08. An independent check by the main session, run before reading the broker helper's answer on the same question. Surfaced SEC releases 34-104572 and 34-105226 and FINRA Regulatory Notice 26-10.
- **T22.** FINRA Regulatory Notice 26-10, "FINRA Adopts New Intraday Margin Standards to Replace the Day Trading Margin Requirements", https://www.finra.org/rules-guidance/notices/26-10, accessed 2026-10-08. Strength A (regulator). SEC approval dated April 14, 2026 (Release No. 105226, file SR-FINRA-2025-017). Quote: effective "June 4, 2026, 45 days from publication of this Notice." Phase-in for firms that need more time ends "October 20, 2027". Eliminates "the day trade count requirements for designating a customer as a 'pattern day trader'" and "the $25,000 pattern day trader minimum equity requirement". The notice page does not mention cash accounts.
- **T23.** Anthropic, Consumer Terms of Service, https://www.anthropic.com/legal/consumer-terms, effective October 8, 2025, accessed 2026-10-08. Strength A. Main-session verification of the runtime helper's finding RT-34. Section 3, "Use of our Services", list introduced by "You may not access or use, or help another person to access or use, our Services in the following ways:". Item quoted in segments by the fetch tool: "To rely upon the Services, the Materials, or the Actions to buy or sell securities" "or to provide or receive advice about securities, commodities, derivatives, or other financial products or services," "as Anthropic is not a broker-dealer or a registered investment adviser". Separate item on automation: "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it," "to access the Services through automated or non-human means, whether through a bot, script, or otherwise."
- **T24.** Anthropic, Commercial Terms of Service, https://www.anthropic.com/legal/commercial-terms, effective June 17, 2025, accessed 2026-10-08. Strength A. The fetch reported no passage mentioning securities, broker-dealer, investment adviser, financial advice or trading. Section D.2 quote: "Customer and its Users may only use the Services in compliance with these Terms, including (a) the Usage Policy". Caution: this is a tool-assisted read of a long document, not a lawyer's read.
- **T25.** Anthropic, Usage Policy, https://www.anthropic.com/legal/aup, accessed 2026-10-08. Strength A. The page shows the version "Effective November 12, 2026" (not yet in force on the access date; the helper's RT-35 quotes the version in force, effective September 15, 2025). Quotes from the November version: Finance high-risk area is "a personalized recommendation to buy, sell, hold, or allocate among specific investment products". "A qualified person must meaningfully review a High-risk AI Recommendation" "with the authority to change or modify it". "A qualified person is someone with the training or experience to evaluate the output in that field". Listed exclusion: "Using our products to assist in workflows that are related to, but do not actually provide, High-risk AI Recommendations." "Agentic use cases must comply with the Usage Policy." No exclusion for personal use was found on the page.
- **T26.** QuantConnect pricing page, https://www.quantconnect.com/pricing, accessed 2026-10-08 with Playwright (the helper could not render it). Strength A. The rendered page shows "Live Trading Node Limit" by tier as 0, 2, 10, Unlimited, Unlimited, but no price for a live trading node itself. That price stays labeled gated and unverified.
- **T27.** Massive (formerly Polygon.io) pricing, https://massive.com/pricing, accessed 2026-10-08 with Playwright. Strength A. Main-session spot check of helper findings MD-03 and MD-04. Prices, published, monthly billing: Stocks Basic 0 ("End of Day Data", "5 API Calls / Minute"), Stocks Starter 29 ("15-minute Delayed Data"), Stocks Developer 79 ("15-minute Delayed Data"), Stocks Advanced 199 ("Real-time Data", "Non-pros only"). All marked "Individual use". Matches the helper.
- **T28.** Alpaca docs, "About Market Data API", https://docs.alpaca.markets/docs/about-market-data-api, accessed 2026-10-08. Strength A. Spot check of MD-10 to MD-12. Prices, published: Basic free, real-time coverage "IEX", 30 streaming symbols, 200 historical calls a minute. Algo Trader Plus 99 dollars a month, "All US Stock Exchanges", unlimited streaming symbols, 10,000 calls a minute. Matches the helper.
- **T29.** Financial Modeling Prep pricing, https://site.financialmodelingprep.com/developer/docs/pricing, accessed 2026-10-08 with Playwright (the helper got HTTP 403 and had only third-party figures). Strength A. Prices, published, personal use: Basic 0 (250 calls a day, end of day data), Starter 29 monthly or 19 a month billed yearly (300 calls a minute), Premium 69 or 49 ("Intraday Charts"), Ultimate 139 or 99 ("1 Minute Intraday Charting"). This CORRECTS helper finding MD-40, whose third-party figures (about 22, 59 and 149) do not match the vendor page.
- **T30.** Finnhub pricing, https://finnhub.io/pricing, accessed 2026-10-08 with Playwright (the helper could not render it). Strength A. Prices, published: Free 0 a month, "60 API calls/minute", "Websocket 50 symbols", license "Personal Use. Terms apply". The only other plan shown on this page is "All-In-One" at "$3500/month". Other paid plans, if any, were not on the page as rendered.
- **T31.** Charles Schwab Developer Portal, home page, https://developer.schwab.com/home (the product address https://developer.schwab.com/products/trader-api--individual redirected here without a login), accessed 2026-10-08 with Playwright. Strength A. Under "I'm developing for", the "Myself" card reads: "As a self-directed trader, these APIs provide your application with the ability to perform trading activities using your own brokerage trading account". Quote: "Create an account to setup a company profile, join an existing company or register as an individual developer." The product detail (limits, token life, fees) sits behind a developer sign-in and was not opened, because the brief forbids account creation.
- **T32.** Charles Schwab Developer Portal, user guides "Authenticate with OAuth" and "OAuth Restart vs. Refresh Token", https://developer.schwab.com/user-guides/get-started/authenticate-with-oauth and https://developer.schwab.com/user-guides/apis-and-apps/oauth-restart-vs-refresh-token, accessed 2026-10-08 with Playwright. Strength A. These public pages describe the sign-in flow (the user signs in on Schwab's own login site and grants access) and say "The token's lifetime is returned expressed in seconds in the \"expires_in\" parameter". They do NOT state how long a refresh token lasts. So the helper's claim that a person must sign in again every 7 days (BR-12) remains supported only by two community sources, strength D.
- **T33.** Charles Schwab, "Trading in Cash Accounts: Avoid These Violations", https://www.schwab.com/learn/story/avoid-these-violations-when-trading-cash, page dated December 17, 2024, accessed 2026-10-08 with Playwright (the helper got an error page). Strength A. Quotes: "the standard for equities is the trade date plus one day, known as T+1". Freeriding: "If this happens just once during a 12-month period, a client could be restricted to using settled cash to place trades for 90 days." Good faith violation: "If this problem happens three times in a 12-month period, a client could be restricted to trading with settled cash for 90 days." Also describes a third type, a cash liquidation violation. "Only cash or proceeds from a sale are considered settled funds."
- **T34.** Charles Schwab pricing, https://www.schwab.com/pricing, accessed 2026-10-08 with Playwright. Strength A. Price, published: "Listed Stocks and ETFs" "$0 online commission".
- **T35.** Interactive Brokers, "Compare IBKR Lite and IBKR Pro", https://www.interactivebrokers.com/en/general/compare-lite-pro.php, accessed 2026-10-08 with Playwright (the helper got HTTP 403). Strength A. US exchange-listed stocks and ETFs: IBKR Lite "Commission-free", IBKR Pro "Fixed or Tiered Pricing". In the "Trading Technology" table the "IBKR APIs" row has a check mark in the Pro column and none in the Lite column (read from the page structure, since the marks are icons, not text). Market data for US listed stocks and ETFs on both plans: "Complimentary non-consolidated, real time streaming data* for primary exchanges for US Equities and ETFs." This upgrades helper finding BR-31 (API needs Pro) from strength C to a vendor page.
- Every Anthropic connector page carries this warning, quoted: "Only use connectors from developers you trust. Anthropic does not control which tools developers make available and cannot verify that they will work as intended or that they won't change."

## 4. Decision points

- **D1. `.claude/settings.local.json` is left out of the commit and out of `.gitignore`.** Chosen because the brief specifies `.gitignore` containing `.DS_Store` and lists what the commit covers (the run's files, `.gitignore`, `.mcp.json`). The local settings file was not produced by the run and is machine-specific by convention. It is left untracked and flagged for Michael rather than silently ignored or committed.
- **D2. Source strength scale and price labels, fixed before the first search.** Strength A: primary and authoritative (a regulator, or the vendor's own documentation, pricing page or terms, seen live). Strength B: reputable independent press or an established reference publisher. Strength C: review sites, comparison sites and affiliate blogs, which have a commercial incentive. Strength D: forums, social posts, personal blogs and community code repositories. Price labels: "published" (on the vendor's own public page, seen live this run), "corroborated" (not on a vendor page, but at least two independent sources agree, and they are named), "gated and unverified" (behind a login, signup or sales call, and not corroborated). Why: the brief requires a stated scale, and four levels is the smallest scale that separates the four kinds of source the brief lists.
- **D3. Research split across three helpers plus the main session.** Why: the scope is dozens of vendor pages, and reading them all in one session risks exhausting the session before the deliverable is written. The helpers were given questions, not expected answers, to avoid them simply confirming a guess. The main session spot-checks prices and the regulatory status itself before relying on them.
- **D4. Helpers write notes files under `runs/` (`run-1-notes-*.md`).** These files are not named in the brief. Chosen anyway because the brief and `CLAUDE.md` both put the audit trail first, the carve-out covers new files under `runs/`, and a notes file written as the helper works survives a session that runs out of room. They are committed with the run.
- **D5. Only the main session uses the Playwright browser.** Why: the helpers would share one browser and could navigate over each other. Helpers list pages that would not load without a browser, and the main session opens those.
- **D6. `.playwright-mcp/` is left out of the commit.** It holds page snapshots and console logs the browser tool writes on its own. They are scratch output, large, and not a claim source in themselves (the URL and access date are the record). Left untracked and flagged for Michael, same handling as D1.
- **D7. Research stopped and writing started.** After the three helper reports and the main-session checks, about 270 findings were in hand and the advisor (consulted a second time, before writing) judged the research sufficient. Remaining gaps are carried into the deliverable as open questions instead of being chased.
- **D8. The option set: five architectures.** A, Claude in the chair (Claude does each run through connectors). B, Relii-style web app (Next.js on Vercel plus Supabase, scheduled jobs, no always-on part). C, always-on worker (a program on a small always-on host holding a live price stream). D, hybrid (the always-on worker plus Claude as a research layer on a shared database). E, hosted algorithm platform (QuantConnect). Why these five: they are the distinct answers to two questions the evidence made decisive, namely "what stays running during market hours" and "does a language model sit in the order path". A and B are the two directions named in `CLAUDE.md`. C and E came from the evidence that neither A nor B can hold a live price stream. D is the combination that supports both driver models.
- **D9. Excluded as architectures, each with its source.** Liquid and Co-Invest (the "LiquidTrade" and "Co-Invest" named in `CLAUDE.md`): its stock markets are perpetual contracts on crypto-style venues and its terms say it does not operate a broker-dealer (T7, T9), so it cannot trade real shares in a brokerage cash account. Composer: automated trades happen once a day in a 15 minute window (RT-80), so it is not intraday. TradingView alerts: no page found saying an alert can place a broker order by itself (RT-84), so it is a possible trigger, not an architecture. Yahoo data through unofficial libraries: Yahoo's terms prohibit automated collection (MD-51). IEX Cloud: closed August 31, 2024 (MD-50).
- **D10. Criteria and weights (sum 100).** Path to placing trades in a cash account, 25, because the brief says the stack must be judged on whether it can get to placing trades, and the cash account is the tightest constraint found. Fitness for intraday timing, 20, because the trading style is fixed as intraday. Flexibility across run modes and driver models, 15, because the brief leaves both deliberately undecided. Operability for a non-coder, 15, because the owner writes no code and must still notice when it breaks. Safety and control, 10. Monthly cost of the platform itself, 10, kept low because the owner chose to band cost and not cap it. Reversibility, 5.
- **D11. Scoring rubric.** Scores are 1 to 5. For each criterion the deliverable states what a 1, a 3 and a 5 mean, so each score can be checked against a cited fact. Scores are my judgment applied to cited facts. They are not measurements.
- **D12. Cost bands, per month, per category.** Band 0: free. Band 1: 1 to 25 dollars. Band 2: 26 to 100 dollars. Band 3: 101 to 300 dollars. Band 4: over 300 dollars. Why these edges: 25 is roughly one small subscription (Supabase Pro is 25), 100 is where the lowest-priced consolidated real-time data feed found sits (99) and where Claude Max 5x sits (100), and 300 separates hobby-scale from professional-scale data.
- **D13. Event-triggered mode is scored in two parts.** "Callback" (something else wakes the agent with a web request) and "stream" (the agent itself holds an open connection and hears every price change). The evidence showed platforms differ exactly on this split.
- **D14. The Anthropic terms finding is treated as cross-cutting.** It is quoted, not interpreted, in every option where Claude is in the loop, and it appears in the scores, the falsifiability section and the open questions.
- **D15. Price labels normalized to the brief's three.** The helper files also used "unverified", "not verified" and "free". In the deliverable: anything not seen on a public vendor page is "gated and unverified" with the reason, "corroborated" names both sources, and free tiers seen on a vendor page are "published". Vendor figures the main session saw itself replace third-party figures (T29 replaces MD-40, T30 replaces MD-36).
- **D16. Footnote numbering done mechanically.** The markdown is drafted with register IDs as citation keys, and a small throwaway script (kept outside the repo, in the session scratch folder) replaces them with sequential numbers in order of first use and prints the Sources section from the same register. Why: about 150 citations numbered by hand would drift. The script changes no wording. Each Sources entry keeps its register ID so a footnote traces back to this trail.
- **D17. The strongest pick is option D, the hybrid, stated as conditional.** Chosen because it has the highest weighted total and is the only option supporting both driver models and scoring 4 or above on every run mode. Stated as conditional because the lead over option C is 0.25, because it is the hardest option for a non-coder to run, and because the ranking flips to option B when operability is weighted above intraday fitness. The pick names an architecture only. It does not choose a driver, a provider, a broker or a run frequency.
- **D18. Platform cost criterion excludes market data and brokerage.** Every option needs both, in the same bands, so including them would add the same number to each option and hide the differences in hosting and model cost. Option E is the exception, since its data is bundled, and the deliverable says so.
- **D19. Claude's plan cost is counted in options A and D even though Michael already has the plan.** The brief says owning something is neither a plus nor a minus, so the price is counted as if he did not.
- **D20. A shared catalog precedes the five options.** The brief asks for categories, candidates, coverage and cost bands inside each option. Repeating eight categories five times would have added length without content, so the candidates are listed once in section 4.0.2 and each option says which fit it and in what band.
- **D21. The HTML's footnote numbers and source records were filled in mechanically.** The page itself (layout, styles, script and every sentence) was written by hand. Two things were then filled in by a small throwaway script kept outside the repo: the footnote numbers, taken from the same numbering the markdown uses, and the list of 204 source records. Why: typing 204 addresses by hand invites exactly the transcription errors the standard is meant to prevent, and it guarantees the two files cannot disagree on a number. No converter was installed and no prose was generated. This is a judgment call against the brief's "write it by hand", flagged here so Michael can rule on it.
- **D22. No charting library.** The brief allows one from a public content delivery network. The views needed only bars and shaded grids, which plain HTML does, so the file has no outside dependency and opens the same with or without a network connection.
- **D23. Order of the last steps.** The brief says to finish the markdown and the trajectory before starting the HTML. The markdown was finished first and the trajectory was current through step 22 before the HTML began. The self-assessment section was written after the HTML, because it has to assess the HTML too.
- **D24. Two scores corrected after the final review.** Option A's score for "path to placing trades in a cash account" went from 2 to 1, because its basis (the whole order path runs on a subscription whose terms list relying on it to buy or sell securities as prohibited) is the rubric's own description of a 1. Option E's flexibility score went from 3 to 2, because it has one driver model and two weak run modes, which is below the rubric's description of a 3. Option B's flexibility stays at 3 with its reason now written into the basis. Why this matters: D11 says every score can be checked against the rubric, and these two could not.
- **D25. What the two throwaway scripts did, recorded here because the scratch folder does not survive the session.** The numbering script read the draft parts in order and applied one substitution: every citation key of the form `[^BR35]`, `[^RT19]`, `[^MD11]` or `[^T23]` was replaced by `[^n]`, where n is the position of that key's first appearance. It then printed one Sources line per key in this fixed shape:

````text
[^n]: <page title from the register>. <address> . Accessed 2026-10-08. Strength <A to D>. Price label: <label, only if the entry is a price>. Register ID <key> in `runs/<file>`.
````

  Title, address and strength were read from the helper notes files by pattern, with eleven entries corrected by hand where the pattern missed a title or where a price label needed its reason. The 26 main-session sources were typed into the script by hand from section 3 of this file. The HTML script applied the same key-to-number substitution to the hand-written page, using the numbering already fixed by the markdown, and pasted in the list of 204 source records. It stopped with an error if the page cited a key the markdown did not. Neither script wrote or altered a sentence.

## 5. Dead ends
- **X1. Guessing connector page addresses.** Tried fetching guessed addresses such as /marketplace/connectors/alpaca to test whether a vendor is listed. Abandoned because two connectors known to be listed (Clear Street, TEXT TO QUANT) returned "not found" under the guessed spelling, so a miss proved nothing. Replaced by loading the complete list of 927 and reading it.
- **X2. Liquid's United States eligibility.** Two searches and the vendor's terms page gave no statement either way. Left as an open question rather than inferred from a different vendor's policy.
- **X3. QuantConnect live trading node price.** The helper could not read it from page text, and the main session could not find it on the rendered pricing page either. Not pursued into the signup flow, because the brief forbids account creation. Recorded as gated and unverified.
- **X4. Schwab's token life from a Schwab page.** The public user guides do not state it and the product page needs a developer sign-in. Not pursued, because registering is account creation. Stays community-sourced.
- **X5. Interactive Brokers Web API pages, TradeStation, E*TRADE developer pages.** Listed by the helper as needing a browser. Only the Interactive Brokers plan comparison was opened. The rest were left, because the session had to move to writing, and those brokers already carry enough verified facts to place them in the options. The gaps are named in the deliverable's open questions.

## 6. Self-assessment against the standard

Written at the end of the run, against the four acceptance conditions in the brief, then the brief's other requirements.

**1. Every connector claim traced to a live source with an access date. Met, with four weaknesses.**

- Met: every factual claim in the deliverable carries a numbered marker, all 204 markers resolve to a Sources entry with an address and the access date 2026-10-08, and each entry carries a register ID that leads to a fuller note with a quote. Claims that a connector does NOT exist or is NOT listed are footnoted too (the full list of 927 directory entries was read, T17).
- Weakness: most quotes in the three helper files passed through a fetch tool that can paraphrase. The quotes read in a browser by the main session (Anthropic's terms, the connector pages, Schwab, Interactive Brokers, and the price pages for Massive, Financial Modeling Prep and Finnhub) are exact. The deliverable says this at the top.
- Weakness: "no official MCP server found" for Schwab, E*TRADE, Fidelity, Databento and Finnhub rests on one or two searches each. One such claim was wrong on the first pass and corrected within the run (Interactive Brokers, BR-33).
- Weakness: the main session worked from a compact index of the helpers' 234 findings (each claim cut to about 300 characters) and read nine findings in full. A nuance present only in the tail of a long finding could have been missed.
- Weakness: two connector facts rest on trade press, not a vendor page (TradeStation's MCP release, BR-46, and the date Interactive Brokers widened its AI integration, BR-57). The Interactive Brokers connector itself is confirmed on Anthropic's page (T18).

**2. Pricing verified rather than recalled. Mostly met.**

- Met: no price in the deliverable comes from memory. Every price carries one of the three labels, and gated prices say why.
- Spot-checked by the main session on the vendor's own page: Massive, Alpaca market data, Financial Modeling Prep, Finnhub, Quiver, Firecrawl, Schwab's commission, Interactive Brokers' plan comparison. One of these checks overturned a helper figure (Financial Modeling Prep, where third-party sites were wrong), which is a warning about the prices that were not spot-checked.
- Not spot-checked by the main session, so resting on a helper's single read: Tradier, Databento, Twelve Data (whose page shows two conflicting price sets), Alpha Vantage, Tiingo, EODHD, Intrinio, Vercel, Supabase, Cloudflare, the small server hosts, QuantConnect's tier price, GitHub Actions, and Claude's plan and API prices.
- Gated and unverified, stated as such: QuantConnect's live trading node, Hetzner, Twelve Data's consolidated feed, Intrinio's enterprise feeds, Nasdaq's index membership service, Webull's market data, TradeStation's commission.
- One "corroborated" label is used (Interactive Brokers Pro per-share commission), and one of its two sources is a review site.

**3. Each option's failure mode named. Met.** All five options have a named failure mode, written as the most likely way the option breaks or disappoints, and repeated in one line in the comparison table.

**4. The recommendation falsifiable, stating what evidence would overturn it. Met.** Section 6 gives seven conditions, each with the specific evidence and the pick that would replace option D. Two of them name a measurement that could be run (a month of logged practice signals, and a two week trial of a do-nothing worker). The section also states that the lead over option C is 0.25 and that the ranking flips to option B under operability-first weights.

**Where the run fell short of the brief in other ways.**

- **Schwab is the thinnest broker entry.** Its personal trading interface, cash account rules and commission are confirmed on Schwab's pages. Its sign-in life and its settled cash fields rest on community sources (strength D), because the detail pages need a developer sign-in and the brief forbids account creation.
- **Universe coverage is uneven.** Price coverage statements were captured for four providers (Massive, Alpaca, Databento, Tradier). For the rest the deliverable says "not captured" instead of guessing. Membership list routes were found for all six indexes, but two are unconfirmed (the Nasdaq 100 fund's download, and current NYSE Composite rules).
- **Several broker facts are "not verified".** Cash account support through the interface at TradeStation, tastytrade, Webull, Public and Interactive Brokers, and commissions at E*TRADE, tastytrade, Webull and Robinhood.
- **Scores are judgment.** The rubric makes them checkable against cited facts, but a different reader could move several by one point. Two scores failed that check in the final review and were corrected before the commit (D24), which suggests others deserve a second look. The weight explorer in the HTML exists so Michael can see how much that matters.
- **Inferences.** That a small rented server can hold a price stream all session is inferred from pricing pages, not quoted or measured. It is marked as inference wherever it is used, and section 6 item 3 names the measurement.
- **The option set is my framing.** Five architectures were chosen by reasoning from the evidence (D8). A different cut is possible, for example treating Robinhood's agent account or Anthropic's Managed Agents as architectures in their own right. They appear as candidates, not options.
- **HTML and "by hand".** See D21. Also, the page was tested through a local web server, not by double-clicking, because the browser tool refuses file addresses. It has no outside dependency, so it should behave the same, but Michael double-clicking it is the real test.
- **Files outside the brief's list.** Three helper notes files were written under `runs/` (D4) and are committed. `.claude/settings.local.json` and `.playwright-mcp/` were left out of the commit and are flagged (D1, D6).
- **Legal reading deliberately not done.** The Anthropic terms and the market data licensing questions are quoted and left open. That is by design, but it means the single most consequential finding of the run ends as a question.
