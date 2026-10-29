# Project State

This file is the running status of sib-tech. Read it at the start of every session.

**HOW TO READ THIS FILE.** It accretes. An entry is true as of its own date and may be superseded further down without either entry saying so. Use it for history and reasoning. **Measure the present value rather than quoting a number from here.** Cite it by its text and heading, never by line number.

## Current Stage

**STACK NOT DECIDED; MESSAGING APP RESEARCHED TWICE.** As of October 28, 2026. Run 5 repeated run 4's comparison with Signal and Google Chat added, encryption scored as a preference, and every source opened first hand. The strongest pick is still Discord, 4.50 of 5 against Telegram's 4.18; Matrix 3.51, Google Chat 3.38, Signal 2.97, Slack 2.88. Discord's own pages now settle run 4's two open facts (history kept for the account's life; bots under 10,000 users read messages by a toggle). Run 3's page carries run 5 in its Messaging tab, and its Sources tab no longer scrolls sideways on a phone. The decisions on the stack and on the app are the owner's and have not been made. No code, no database, no deployment, no accounts. `CLAUDE.md`'s Tech stack section still reads NOT DECIDED.

Earlier entry, superseded by the paragraph above: **STACK NOT DECIDED; MESSAGING APP RESEARCHED.** As of October 28, 2026. Run 4 compared four free phone apps for the stack's alerts, messages and commands (Telegram, Discord, Slack, and Matrix on the Element app) and its strongest pick is Discord, 4.53 of 5 against Telegram's 4.28. Run 3's deliverable and page now name Discord wherever they named Telegram, with costs, scores and the stack pick (option C) unchanged, and the page has a Messaging tab. The decisions on the stack and on the app are the owner's and have not been made. No code, no database, no deployment, no accounts. `CLAUDE.md`'s Tech stack section still reads NOT DECIDED.

Earlier entry, superseded by the paragraph above: **STACK DESCRIBED THREE TIMES, RUN 3 CORRECTED, NOT DECIDED.** As of October 28, 2026. A correction to run 3 fixed option C's scoring: C can be asked questions through Claude reading the database, as B can, so its on-demand mode and flexibility rose from 3 to 5, and a full audit raised C's and D's Claude-driver target from 4 to 5. The strongest pick is now option C, the always-on worker, first under both drivers (4.25 and 3.60) by more than the 0.10 tie rule. On the owner's follow-up ruling, section 12, item 6 now lowers ease of running for every option, not only B; under it C and D tie under the Claude driver (3.45 each) only because D's score was already at the floor of 1. The decision is the owner's and has not been made. No code, no database, no deployment. `CLAUDE.md`'s Tech stack section still reads NOT DECIDED.

Earlier entry, superseded by the paragraph above: **STACK DESCRIBED THREE TIMES, NOT DECIDED.** As of October 13, 2026. Run 3 described four stack options (B, C, D, F) with Michael's answers to run 2's questions (perpetual contracts out, one broker, consolidated real-time data, a new margin account, speed and reliability of execution crucial) and new content: build hours, itemized monthly costs for two example setups per option, daily use, a driver comparison, a borrowing cost table, a glossary and answers to two questions about Anthropic's terms. Its strongest pick is option B, tied on the arithmetic with option D and chosen on a stated judgment. The decision is the owner's and has not been made. No code, no database, no deployment. `CLAUDE.md`'s Tech stack section still reads NOT DECIDED, and nothing is installed or scaffolded until the owner decides and that section is written.

Earlier entry, superseded by the paragraph above: **STACK RESEARCHED TWICE, NOT DECIDED.** As of October 9, 2026. Run 2 repeated the stack scoping with the owner's answers and changed requirements (perpetual contracts in scope, margin allowed, 10,000 to 25,000 dollars of capital, a 5 minute reaction target, the agent may act alone inside fixed limits). It produced a new recommendation with trade-offs. The decision is the owner's and has not been made. No code, no database, no deployment. `CLAUDE.md`'s Tech stack section still reads NOT DECIDED, and nothing is installed or scaffolded until the owner decides and that section is written.

Earlier entry, superseded by the paragraph above: **STACK RESEARCHED, NOT DECIDED.** As of October 8, 2026. Run 1 produced a recommendation with trade-offs. The decision is the owner's and has not been made. No code, no database, no deployment. `CLAUDE.md`'s Tech stack section still reads NOT DECIDED, and nothing is installed or scaffolded until the owner decides and that section is written.

Earlier entry, superseded by the paragraph above: **NOT STARTED.** Created October 7, 2026. The first piece of work is scoping the stack, between a Relii-style web application and a Claude-native agent on connectors.

## Completed

- **2026-10-08. Run 1, scope the stack.** Research and recommendation only. Read `runs/run-1-deliverable.md` (the source of record), `runs/run-1-deliverable.html` (an interactive view of the same content) and `runs/run-1-trajectory.md` (how it was reached, with a self-assessment). Five architectures were compared against seven weighted criteria, from 204 live sources accessed that day. The run's strongest pick is option D, a hybrid: a small always-on program for live prices, the settled cash ledger and orders, with Claude on top as the research layer. The lead is thin and conditional, and the deliverable's section 6 says what would overturn it. This is research input for a human decision, never an instruction to act.
- **2026-10-09. Run 2, scope the stack again with changed context.** Research and recommendation only. Read `runs/run-2-deliverable.md` (the source of record), `runs/run-2-deliverable.html` (an interactive view of the same content) and `runs/run-2-trajectory.md` (how it was reached, with a self-assessment). Five architectures were compared against eight re-derived criteria, from 281 dated sources (170 opened that day, 111 reused from run 1 with their original date). The run's strongest pick is option F: a scheduled core on the Relii stack (Supabase timer and functions, Vercel screen) that fetches prices, applies fixed rules and limits and sends orders, with Claude on top as the research layer. It ties with run 1's pick, option D, at 3.80 of 5, and is chosen on a stated tie-break. The deliverable's section 6 says what would overturn it. This is research input for a human decision, never an instruction to act.
- **2026-10-13. Run 3, describe the strongest stacks.** Research and recommendation only. Read `runs/run-3-deliverable.md` (the source of record), `runs/run-3-deliverable.html` (an interactive view of the same content) and `runs/run-3-trajectory.md` (how it was reached, with a self-assessment). Four architectures were scored under both drivers (Claude, or software Claude Code writes) against seven criteria, from 130 dated sources (96 opened that day, 34 reused). The strongest pick is option B, the scheduled web app on the Relii stack. It is tied on the arithmetic with option D (always-on worker plus Claude): each is first or within 0.10 of first in 10 of 16 rankings across weightings. B is chosen on a stated judgment (cheaper to be wrong about before a strategy exists), and section 12 says what evidence would make D or C the pick. Two brokers pass every requirement: Tradier and Alpaca. This is research input for a human decision, never an instruction to act.
- **2026-10-28. Run 3 correction.** Read the correction block at the top of `runs/run-3-deliverable.md` and `runs/run-3-correction-trajectory.md`. Option C's on-demand and flexibility scores rose from 3 to 5 under both drivers, and C's and D's Claude-driver target from 4 to 5. The pick changed from B (tied with D) to C, the always-on worker: software C 4.25, D 4.10, B 4.00; Claude C 3.60, D 3.45, B 3.35. C is first or within 0.10 of first in all 16 rankings. The deliverable and its page were corrected in place and browser-tested. `CLAUDE.md`'s Supabase line now says Micro compute in `us-west-2`. A second commit the same day applied the owner's ruling on section 12, item 6: "hosted code proves hard to manage" lowers ease of running for B, C, D and F, giving software C 4.10, D 3.95, B 3.85, F 3.70 and Claude C 3.45, D 3.45, B 3.20, F 3.05. The base pick is unchanged. This is research input for a human decision, never an instruction to act.
- **2026-10-28. Run 4, choose the messaging app.** Research and recommendation only. Read `runs/run-4-deliverable.md` (the source of record), the Messaging tab of `runs/run-3-deliverable.html`, and `runs/run-4-trajectory.md` (how it was reached, with a self-assessment). Four apps scored against eight criteria, free tier limits weighted highest (30 of 100), from 77 sources dated that day (73 opened, 4 seen only as search summaries and marked). Strongest pick: Discord on its free plan (4.53), then Telegram (4.28), Matrix (3.63), Slack (2.96); Discord first in 8 of 8 weightings. Run 3's markdown and page updated in place, with a dated "Update, run 4" block under the title. Nothing was created at any vendor. This is research input for a human decision, never an instruction to act.
- **2026-10-28. Run 5, choose the messaging app with every source read first hand.** Research and recommendation only. Read `runs/run-5-deliverable.md` (the source of record), the Messaging tab of `runs/run-3-deliverable.html`, and `runs/run-5-trajectory.md`. Six apps scored by script against nine criteria (free tier limits 28 of 100, encryption 5) from 89 sources, all opened on 2026-10-28. Strongest pick: Discord on its free plan (4.50), then Telegram (4.18). Run 3's markdown gained one line pointing to run 5; its page was rebuilt and browser-tested. Nothing was created at any vendor. This is research input for a human decision, never an instruction to act.
- **2026-10-09. `.gitignore` extended.** It now holds `.DS_Store`, `.claude/` and `.playwright-mcp/`.
- **2026-10-08. Git wired.** Local folder tracks `origin/main` on the private GitHub repo. `.gitignore` holds `.DS_Store`.

## Open Issues

Raised by run 1 on 2026-10-08. Each is quoted and sourced in the run 1 deliverable. None is resolved.

- **Anthropic's terms and a securities agent.** The Consumer Terms that govern a Max plan list relying on the service "to buy or sell securities" or to "receive advice about securities" among prohibited uses. Whether a personal research or trading agent is permitted on a Max plan, and whether the answer differs on the pay-as-you-go API, needs an answer from Anthropic in writing. See the deliverable, section 4.0.1 and section 7.
- **Market data licensing for a program.** Whether a personal program reading prices counts as "non-display use", and what that costs, is unsettled. See section 4.0.1.
- **Schwab's interface.** How long its sign-in lasts and whether it reports settled cash rest on community sources only. See section 4.0.2, category 8.
- **Two items left out of the run 1 commit on purpose.** `.claude/settings.local.json` (a per-machine settings file) and `.playwright-mcp/` (scratch snapshots written by the browser tool). The owner may want both added to `.gitignore`. See the trajectory, decisions D1 and D6.
- **The HTML was filled in partly by script.** Footnote numbers and source records were inserted mechanically. See the trajectory, decision D21, for the owner to rule on.

Raised by run 2 on 2026-10-09. Each is quoted and sourced in the run 2 deliverable. None is resolved.

- **Perpetual contracts for a U.S. resident.** Every onchain venue read (Hyperliquid, trade.xyz, Lighter, Ostium) bars U.S. residents in its own terms, and Liquid defers to them. The one lawful live route found is an index contract at Kalshi, a U.S. regulated exchange, with the money held at a futures broker, not in a wallet. Single stock contracts are filed and pending, the earliest dated November 2, 2026. Whether software can trade there for a retail customer is not verified. See the run 2 deliverable, sections 1.2 and 4.0.1 D.
- **Three readings of the brief that are the run's, not the owner's.** That an index contract counts as "tracking U.S. equities", that a look-alike index is acceptable, and that "futures are out" means dated futures. See section 4.0.1 D and section 7.
- **Which day trading rule a broker applies.** The rule that replaced the pattern day trader rule lets brokers keep the old one until October 20, 2027. Interactive Brokers is mixed and Tradier is unconfirmed. See section 4.0.1 B.
- **Anthropic's terms and an agent that acts alone.** Still open from run 1, now sharper: the Usage Policy effective November 12, 2026 requires review by a qualified person "before it is used to implement a decision" and excludes "applying a fixed rule". Whether a setting Claude writes is a fixed rule is not answered by the text. See section 4.0.1 F and section 7.
- **A helper sent the owner's email address to sec.gov.** Two requests by a research helper in run 2 carried it in a request header. Not asked for, not approved, cannot be undone, not repeated, and in no file. See the run 2 trajectory, section 2 step 16 and section 6.
- **Resolved from run 1:** the two items left out of the run 1 commit are now in `.gitignore`, and the owner approved filling the HTML's footnote numbers and source records by script.

Raised by run 3 on 2026-10-13. Each is quoted and sourced in the run 3 deliverable. None is resolved.

- **Anthropic's "qualified person".** The Usage Policy effective November 12, 2026 requires review by "A qualified person" before a personalized buy or sell recommendation "is used to implement a decision". No Anthropic text says whether the account owner can be that person. Twelve yes or no questions for Anthropic are listed in the deliverable, section 11.3.
- **Which terms govern the Max plan's 100 dollar monthly API credit** is not stated. It decides whether a Claude driver or research layer can run inside the credit.
- **Program use of market data.** Whether Tradier's and Alpaca's terms, and the exchanges', let the owner's own program use real-time data with no person watching is not found either way.
- **Supabase "nano".** Resolved 2026-10-28: the owner ruled in the correction brief, and `CLAUDE.md` now says Micro compute in `us-west-2` (Oregon).
- **Playwright did not connect** during run 3. Resolved 2026-10-28: it connected for the run 3 correction.
- **Helpers sent a generic browser identification string** in some requests (no personal information in it). Recorded in the run 3 trajectory, section 2, steps 14 and 16, for the owner to rule on.
- **Resolved from run 2:** which day trading rule Tradier applies (new, for all accounts, from June 4, 2026), and tastytrade (new, confirmed). Interactive Brokers is still not settled. Perpetual contracts are out of scope by the owner's ruling.

Raised by run 4 on 2026-10-28. Each is sourced in the run 4 deliverable. None is resolved.

- **Does Discord hold phone alerts while its desktop app is open?** Only community posts say so. A confirmed holdback makes Discord and Telegram a tie. A five-minute test settles it once a Discord account exists (run 4 deliverable, section 6, item 1).
- **Does Discord keep free server history forever?** No vendor page limits it, and none promises it. A cap would make Telegram the pick (item 5).
- **How many bot applications one Discord account may own** is not published. Two stacks need two.
- **Run 3's Sources tab scrolls sideways on a phone** (long web addresses). It predates run 4 and was left unchanged; a one-line style fix is available if the owner wants it.

Raised by run 5 on 2026-10-28. Each is sourced in the run 5 deliverable. None is resolved.

- **Discord desktop holdback** is still untested (no source was read for it in run 5). The five-minute test in run 5, section 5, settles it once an account exists.
- **Bot applications per Discord account** are still not published. Two stacks need two.
- **Signal's "auto-messaging" clause** may or may not cover a personal alert bot; only Signal can say.
- **Resolved from run 4:** Discord free history (kept for the account's life, no message limit named; an account idle two years may be deleted) and whether a bot can read Michael's messages (yes, by a toggle under 10,000 users, with direct messages and mentions readable regardless). Run 3's Sources tab now wraps at phone width.

## Decisions


| Date       | Decision                                      | Why                                                            |
| ---------- | --------------------------------------------- | -------------------------------------------------------------- |
| 2026-10-07 | The agent is for the owner's own trading only | Owner's statement at project setup                             |
| 2026-10-07 | Stack deliberately left unscoped              | Connector-native and web-app approaches have not been compared |
| 2026-10-08 | Work proceeds as research runs, each with an auditable trajectory | The owner's iteration method: review the output and the trail, change one lever, compare the next run to the last |
| 2026-10-08 | Run 1 is stack scoping only, public-market research, no strategy | Keeps the first run falsifiable and the stack decision clean |
| 2026-10-08 | Private GitHub repo `mtbanta/sib-tech` created, wired during run 1 | Offsite trail and run-to-run diffs |
| 2026-10-08 | Cost is banded by research, not capped in advance | A ceiling given up front silently deletes options before they are researched |
| 2026-10-09 | Run 2 changes one lever, context: the owner's answers to run 1's open questions and several changed requirements | Run 1 had to hedge across every possibility because the answers were the owner's to give |
| 2026-10-09 | Run 1 sources may be reused with their original access dates, and the HTML's footnote numbers and source records may be filled in by script | Owner's ruling in the run 2 brief |

| 2026-10-13 | Run 3 changes two levers, context and instructions, as a stated exception | The owner's answers removed scope (perpetual contracts out), and the new instruction sections are visible on their own |
| 2026-10-13 | Perpetual contracts out entirely; one broker; consolidated real-time data required; a new margin account | Owner's answers in the run 3 brief |
| 2026-10-13 | Estimates (build hours, monthly cost) may be given before a stack is chosen | Owner reversed the earlier ruling in the run 3 brief |
| 2026-10-28 | If Supabase is used, it is Micro compute in `us-west-2` (Oregon), not "nano" | Supabase bills Nano at the Micro price on paid plans (run 3 deliverable, section 13, item 6). Owner's ruling in the correction brief |
| 2026-10-28 | Section 12, item 6 lowers ease of running for every option that runs hosted code (B, C, D and F), not only B | The same fact gets the same score in every option. Owner's ruling after the run 3 correction |



## Runs

Research runs, oldest first. **Lever** is the one thing changed from the previous run: context, workspace, or instructions. Run 1 has no lever because there is no previous run.

| Run | Date | Lever changed | Outcome |
| :---- | :---- | :---- | :---- |
| 1 | 2026-10-08 | n/a, first run | Deliverable, trajectory and index written. Stack scoped, not decided. Five architectures compared from 204 dated sources. Strongest by the run's weights: option D, hybrid of an always-on worker plus Claude as the research layer, 3.85 of 5, a thin and conditional lead. Standard self-assessed as met with stated weaknesses (see the trajectory, section 6). |

| 2 | 2026-10-09 | context (Michael's answers and changed requirements) | Deliverable, trajectory and index written. Stack scoped, not decided. Five architectures compared from 281 dated sources (170 new, 111 reused). Strongest by the run's weights: option F, a scheduled core on the Relii stack plus Claude as the research layer, 3.80 of 5, tied with run 1's option D and chosen on a stated tie-break. The scheduled web app alone is 3.70. Perpetual contracts: onchain venues bar U.S. residents, one lawful index contract is live, single stocks are pending. Standard self-assessed as met with stated weaknesses (see the trajectory, section 6). |

| 3 | 2026-10-13 | context and instructions | Deliverable, trajectory and index written. Stack described, not decided. Four options scored under both drivers from 130 dated sources (96 new, 34 reused). Strongest pick: option B, scheduled web app on the Relii stack, 4.00 (software driver) and 3.35 (Claude driver), tied on the arithmetic with option D (4.10 and 3.30) and chosen on a stated judgment. Brokers passing every requirement: Tradier and Alpaca. Cheapest workable B setup 145 dollars a month, 125 of it already paid. Standard self-assessed as met with stated weaknesses (see the trajectory, section 6). |

| 3 correction | 2026-10-28 | none (a correction: option C's on-demand and flexibility scoring, plus a full score audit) | Deliverable and page corrected in place and browser-tested; trajectory and index written. Pick changed from B (tied with D) to C, the always-on worker: software C 4.25, D 4.10, B 4.00, F 3.85; Claude C 3.60, D 3.45, B 3.35, F 3.20. Two inconsistencies fixed: C's on-demand and flexibility (3 to 5) and C's and D's Claude-driver target (4 to 5). Self-assessed as met, with the audit being one session's reading (see the correction trajectory, section 6). Follow-up commit, owner's ruling: item 6 applied to all four options; C first under the software driver (4.10), tied with D under the Claude driver (3.45). |

| 4 | 2026-10-28 | instructions (new question: the messaging app) | Deliverable, trajectory and index written; run 3's deliverable and page updated in place and browser-tested, with a new Messaging tab. Four apps scored by script against eight criteria (free tier limits 30 of 100) from 77 sources dated 2026-10-28 (73 opened, 4 search summaries only). Strongest pick: Discord, free plan, 4.53; Telegram 4.28; Matrix on Element 3.63; Slack free 2.96. A first scoring tie (Telegram 4.43, Discord 4.41) was audited before any conclusion: three score bases were made consistent (push, the command route behind security, Telegram's 24 hour message hold). One fact alone would make Telegram the pick: Discord capping free history or blocking bots from reading messages. Standard self-assessed as met with stated weaknesses (see the trajectory, section 6). |

| 5 | 2026-10-28 | context and instructions (Signal added, encryption preferred, every source read first hand) | Deliverable, trajectory and index written; run 3's page rebuilt (Messaging tab from run 5, Sources tab fixed at phone width) and browser-tested; run 3's markdown gained a one-line note. Six apps scored by script against nine criteria from 89 sources, all opened 2026-10-28. Strongest pick unchanged: Discord, free plan, 4.50; Telegram 4.18; Matrix on Element 3.51; Google Chat 3.38; Signal 2.97; Slack free 2.88. Two facts alone would make Telegram the pick: Discord capping history, or gating message reading for small bots with no direct message exception. Standard self-assessed as met with stated weaknesses (see the trajectory, section 6). |

The full record of each run lives in `runs/`. This table is the index you read first.

## Next Steps

As of 2026-10-28, after run 5:

1. The owner reads the run 5 deliverable (or the Messaging tab) and decides the messaging app. Run 3's designs already assume Discord, so choosing it changes nothing there; choosing Telegram means reverting the "Update, run 4" changes.
2. The stack decision is unchanged and still the owner's. The two-week do-nothing worker trial is still the measurement that matters most.
3. When accounts are created (not before the stack is decided): Discord account on a sib-tech email, passkey or authenticator sign-in, one private server and one bot per stack, the bot's role allowed to see and read the command channel, Message Content switched on, then the five-minute desktop holdback test (run 5 deliverable, section 5).
4. When the stack and the app are decided, record both here under Decisions and in `CLAUDE.md`'s Tech stack section. Until then the no-scaffolding rule stands.

Earlier entry, superseded by the list above:

As of 2026-10-28, after run 4:

1. The owner reads the run 4 deliverable (or the Messaging tab) and decides the messaging app. Run 3's designs now assume Discord; choosing Telegram instead means reverting the "Update, run 4" changes.
2. The stack decision is unchanged and still the owner's (see the run 3 list below). The two-week do-nothing worker trial is still the measurement that matters most.
3. When accounts are created (not before the stack is decided): Discord account on a sib-tech email, sign-in protection by authenticator app or passkey, one private server and one bot per stack, then the five-minute desktop holdback test (run 4 deliverable, section 5).
4. When the stack and the app are decided, record both here under Decisions and in `CLAUDE.md`'s Tech stack section. Until then the no-scaffolding rule stands.

Earlier entry, superseded by the list above:

As of 2026-10-28, after the run 3 correction:

1. The owner reads the correction block at the top of the run 3 deliverable, then either decides the stack or scopes run 4.
2. The measurement that matters most is now a two-week do-nothing worker trial (section 12, item 7). A hang the heartbeat missed, or one the owner could not resolve alone, makes B the pick.
3. The owner's questions in section 13 still stand, with two changed: the driver no longer decides the pick (C is first under both), and a must-have Claude research layer would make D tie with C. Hosted code proving hard to manage (item 6) would also make D tie with C under the Claude driver.
4. Questions to Anthropic and the chosen broker are unchanged (section 11.3 and section 13).
5. When the stack is decided, record it here under Decisions and in `CLAUDE.md`'s Tech stack section. Until then the no-scaffolding rule stands.

Earlier entry, superseded by the list above:

As of 2026-10-13, after run 3:

1. The owner reads the run 3 deliverable and trajectory and either decides the stack or scopes run 4.
2. The owner answers the questions in the deliverable's section 13 that are his to decide: which driver; whether a Claude research layer is a must (it makes option D the pick); whether the wide daily screen may use the prior day's prices; Tradier or Alpaca; the borrowing limit on day one; and the Supabase tier.
3. Questions go to others before any provider is chosen: Anthropic (the twelve in section 11.3, chiefly whether the owner can be the "qualified person" and which terms govern the Max API credit), and the chosen broker (program use of its data, symbol limits, and at Alpaca a key that cannot change the borrowing cap).
4. Two cheap measurements would settle the closest scores: a two-week do-nothing timer trial on Supabase (section 12, item 1) and, if option C or D stays in view, a two-week do-nothing worker trial (item 7).
5. When the stack is decided, record it here under Decisions and in `CLAUDE.md`'s Tech stack section. Until then the no-scaffolding rule stands.

Earlier entry, superseded by the list above:

As of 2026-10-09, after run 2:

1. The owner reads the run 2 deliverable and trajectory and either decides the stack or scopes run 3 by changing one lever.
2. The owner answers the questions in the deliverable's section 7 that are his to decide. The first four decide the most: whether index contracts count as perpetual contracts that track U.S. equities, whether "futures are out" covers a futures contract with no end date, whether money at a futures broker is acceptable now that the wallet route is closed, and who drives.
3. Three questions go to others before any provider is chosen: Anthropic (may Claude research and trade for the subscriber's own account, on the plan and on a key), Kalshi (can a retail customer get a key for its perpetuals trading interface), and the chosen broker (which margin rule it applies to a new small account, and whether its terms allow an individual's own program to place orders).
4. A dated event to watch: Kalshi's single stock perpetual filing takes effect November 2, 2026 or later.
5. When the stack is decided, record it here under Decisions and in `CLAUDE.md`'s Tech stack section. Until then the no-scaffolding rule stands.

Earlier entry, superseded by the list above:

As of 2026-10-08, after run 1:

1. The owner reads the run 1 deliverable and trajectory and either decides the stack or scopes run 2 by changing one lever.
2. The owner answers, or gets answered, the open questions in the deliverable's section 7. The first three (how fast it must react, how wide the live watch list is, and Anthropic's terms) decide the most.
3. When the stack is decided, record it here under Decisions and in `CLAUDE.md`'s Tech stack section. Until then the no-scaffolding rule stands.

Earlier entry, now done as far as research goes: scope the stack and the connector strategy, and record the decision here and in CLAUDE.md.

