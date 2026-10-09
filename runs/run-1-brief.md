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
