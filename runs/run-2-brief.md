Run 2 brief: scope the stack

Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:





Launched from ~/Projects/sib-tech.



Model: latest Opus, high effort. Advisor: on, latest Opus. Auto-mode: on.



Playwright MCP already configured at project scope in .mcp.json, committed in run 1.



No setting changed from run 1.

What changed from the previous run

Lever changed: context. Instructions (goal structure, output, standard, prohibitions) are the same as run 1. Only the facts about what Michael wants have changed.

Why: run 1 met all four standard items. Its own open questions (section 7 of runs/run-1-deliverable.md) were decisions only Michael could make, so run 1 had to hedge across every possibility. Michael has now answered them, and he has changed several requirements. Those answers are below, under "What you need to know about the future agent". The changes from run 1:





Instruments now include perpetual contracts that track U.S. equities, in addition to U.S. stocks and ETFs.



A margin account is allowed. The cash account is no longer a requirement.



Holding trading money in a crypto wallet is acceptable.



Starting capital is 10,000 to 25,000 dollars.



Reaction within 5 minutes is the target. Near real time data is acceptable and is a variable to compare.



The agent may act alone inside fixed limits.



A person signing in weekly is acceptable.



The universe is as many names as possible across the six indexes.



Run 1's sources may be reused with their original access dates.



Michael approved run 1's decision D21 (HTML footnote numbers and source records filled in by script).

Housekeeping, not part of the lever: .gitignore gains .claude/ and .playwright-mcp/ (step one below). Run 1 flagged both as untracked (its decisions D1 and D6).

Step zero: save this brief

Before anything else, write this entire brief, verbatim and unedited, to runs/run-2-brief.md. Then create runs/run-2-trajectory.md and paste this brief into its first section.

Step one: housekeeping (CC runs this)

Git is already wired from run 1. Do not repeat the wiring.

Add two lines to .gitignore, keeping .DS_Store:

.claude/
.playwright-mcp/

Verify with git --no-optional-locks status that neither folder shows as untracked. Record the result in the trajectory.

The goal

When this run is done, Michael can choose a technology and tool stack for a future agent that does intraday trading in U.S. stocks, ETFs and perpetual contracts that track U.S. equities. He'll choose from up to five researched options, see which one you consider strongest and why, and trace every claim to a dated live source.

This run is research and recommendation only. The decision is Michael's.

What you need to know about the future agent





It is for Michael's own trading. It is not a product, and nothing is published or sold.



Today it would research and recommend. Eventually it will place trades. The stack has to be judged on whether it can get there.



Trading style is intraday. The agent needs to get in and out of positions repeatedly within the same day, sometimes within minutes.



Reaction time: within 5 minutes is the target, and quicker is better. Near real time data (for example delayed by around 5 minutes) is acceptable. Treat data delay as a variable: for each data candidate, state how delayed it is and score options with that in view.



Instruments are U.S. stocks, ETFs (exchange traded funds), and perpetual contracts that track U.S. equities (like Liquid's, which run 1 described). Options, futures, perpetuals on non-U.S. equities, and crypto are out. Real shares in a brokerage account are not a requirement.



No shorting.



The account may be a margin account. A cash account is no longer required. Michael would borrow little at first and increase borrowing only as the agent proves itself.



Holding trading money in a crypto wallet is acceptable.



Starting capital is 10,000 to 25,000 dollars. Use it to say which account minimums and margin rules actually apply.



The agent may act alone inside fixed limits. It does not need Michael's approval for every order.



A person signing in weekly is acceptable. Michael will likely sign in daily.



Who drives the future agent is deliberately undecided. It could be Claude Code itself doing the work, or software that Claude Code writes and that runs on its own. Tag each option with which of those driver models it supports. Do not choose between them.



How often it runs is undecided. Score each option across three run modes: on a schedule, triggered by an event, and on demand. Also score it two ways on memory: keeping memory across runs, and running each time independently.



Universe preference: as many names as possible across the Dow Jones Industrial Average (30 stocks), Nasdaq 100, NASDAQ Composite, NYSE Composite, S&P 500 and Russell 2000. This is a preference, not a filter. Report each candidate provider's coverage of these. A provider that misses one is noted, not ruled out.



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



The categories of data and services each architecture needs. Include brokerage and order execution as a category, and include venues for perpetual contracts in it.



Named candidate providers in each category.



Cost bands per category, defined by you.

You may say which candidates fit which option. Do not decide:





Which provider to use.



What the agent researches.



How often it runs.



Which tickers it watches.

Include broker and regulatory rules wherever they bear on picking the stack. That includes rules for cash and margin accounts on how often an account can trade, when proceeds can be used again, and what minimums apply at Michael's starting capital, and rules on whether and how a U.S. resident may trade perpetual contracts that track U.S. equities. Leave out rules that don't affect the stack choice.

The sources

Use:





Live web research. It's authorized and expected, and it's the point of this run.



The Playwright MCP, for vendor pricing and documentation pages that need JavaScript to render.



~/Projects/relii/CLAUDE.md, read only, to describe the Relii stack accurately. Read that one file and nothing else in that repo.



This repo's CLAUDE.md and PROJECT_STATE.md.



Run 1's trail: runs/run-1-deliverable.md, runs/run-1-trajectory.md and the three runs/run-1-notes-*.md files. Read them before researching.

Reusing run 1's sources:





You may cite run 1's sources with their original access date (2026-10-08) and their original strength and price labels.



Reopen a page only where the changed requirements above touch it. A reopened or new source carries the date you access it.



Say in the trajectory which run 1 findings you reused, which you reopened, and why.

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





Finish runs/run-2-deliverable.md and runs/run-2-trajectory.md first, so they're ready to commit.



Only then start the HTML.

If the session runs short, a complete markdown file without the HTML beats both files half done.

runs/run-2-deliverable.md, the source of record

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



runs/run-2-deliverable.html, the interactive view





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



Documenting your work: runs/run-2-trajectory.md

Append to this file as you work, after each source and each decision. Do not write it all at the end. If the session runs out of room, the trail has to survive. Required structure:





The brief as given, verbatim.



The sequence of what you actually did, in the order it happened.



Sources, every one, with URL and access date.



Decision points, each with what you chose and why. Choosing criteria, weights and cost bands counts.



Dead ends, each with what you dropped and why.



Self-assessment against the standard above, item by item, including where the run fell short.

Do not record time spent or token cost.

Run conventions





File names: runs/run-2-brief.md, runs/run-2-deliverable.md, runs/run-2-deliverable.html, runs/run-2-trajectory.md, and runs/README.md as the index. Add one line to the index for run 2: number, date, "context: Michael's answers and changed requirements", outcome.



Update PROJECT_STATE.md: a new Runs table row for run 2 with lever "context", Current Stage, Completed and Next Steps. Do not write a stack into CLAUDE.md's Tech stack section, because this run recommends and Michael decides.



Check the date with date before writing any date.



Done means all five of these are true:





The deliverable is written.



The trajectory is written.



The index entry exists.



PROJECT_STATE.md is updated.



Everything is committed and pushed.



One commit and one push, at the end, covering everything the run produced. That includes the updated .gitignore. Auto-mode's carve-out covers that commit and push, so don't stop to ask.



Then end the session. Do not start run 3.



Prohibitions





No scaffolding. Do not run npm, pip or any package manager. Do not create package.json, a lockfile, a virtual environment or an application folder structure. Do not create a database. Creating runs/ is allowed.



No connector or MCP server configured for the future agent itself. Playwright is for your research only.



No account creation and no trial signups, anywhere.



Nothing installed. The Playwright MCP running through npx, as set up before this session, is the one authorized exception.



No reading anything in ~/Projects/relii except its CLAUDE.md.



No credentials, API keys or account numbers in any file or commit message.
