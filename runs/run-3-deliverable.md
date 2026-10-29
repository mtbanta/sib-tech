# Run 3 deliverable: the strongest stacks, described

## Update, run 4, 2026-10-28

**Key point: run 4 compared four messaging apps and picked Discord over Telegram. Every place this document named Telegram as the alert or command app now names Discord. Costs, scores, hours and the pick (option C) are unchanged.**

- **Why.** Discord scored 4.53 of 5 against Telegram's 4.28. Both are free with no history limit found, but Telegram discards a bot's unread messages after 24 hours, so a stop sent while a stack sleeps can vanish, and a Telegram account can only be tied to a phone number, not a sib-tech email. The full comparison is in `runs/run-4-deliverable.md`.
- **What changed here, item by item.**
  - Section 3.1, cost band 0: "Telegram alerts" became "Discord alerts and commands".[^131]
  - Option B's "Categories, candidates, coverage and cost bands" table: the alerts row names Discord (free).
  - Tool tables: both example setups of options B and C, and setup 1 of options D and F. Telegram became Discord, plan "Free", 0.00 dollars, citing footnote 131. Setup 2 of D and F ("As option C", "As option B") changed the same way.
  - Every monthly total is unchanged, because both apps cost 0.00.
  - Option B's build hours, step 0: "set up the Telegram bot and heartbeat" became "set up the Discord server, bot and heartbeat", still 0.5 hours (an estimate, my judgment).
  - Option B's cheapest setup note: Michael stops the agent from Discord.
  - Option C's run mode "On demand" and build pieces: Telegram became Discord.
  - "How Michael uses it", options B, C, D and F: each Telegram post, stop command and alert now names Discord.[^133] The stop is read at the next run even if it was sent while the stack slept. Options B and C add a one-time test of whether Discord holds phone alerts while its desktop app is open.
  - Healthchecks.io alerts in options B and C now say they arrive through Discord.[^132]
  - Section 14: footnotes 131 to 133 added, dated 2026-10-28. Footnote 10 (Telegram) is kept for the record and marked no longer cited.
- **Run 5, 2026-10-28.** Run 5 repeated the comparison with six apps, Signal and Google Chat added, every source read first hand. Discord stays the pick (4.50 against Telegram's 4.18), so nothing else here changed. See `runs/run-5-deliverable.md`.

## Correction, 2026-10-28

**Key point: the pick changes from B to C, the always-on worker. Run 3 scored C's "On demand" mode 3 while giving B, D and F a 5 for the same fact. Scored consistently, C is first under both drivers by more than the 0.10 tie rule.**

**What was wrong.**

- Option B scored "On demand" 5 because Michael can ask Claude, which reads the Supabase database. Option C keeps its memory in the same kind of Supabase database, so the same route works. Yet C scored 3 ("nothing to ask unless an interface is built").
- That 3 was C's only run mode below 4, so it held C's flexibility at 3 instead of 5.
- A full audit of every score in sections 9 and 10 found one more fact scored two ways. Under the Claude driver, C's and D's target score fell from 5 to 4 because "the model call adds time", while B's and F's stayed level with the same call.
- Section 6.1 already judged that call to be inside the 5 minute target, and its reliability cost is already taken off execution for every option. So the drop counted the same penalty twice, and C's and D's target under the Claude driver returns to 5.
- Section 12, item 6 lowered only B's operability if hosted code proves hard to manage, although every option runs hosted code. On Michael's ruling it now lowers every option's (see the item table below).

**Every value that changed.**

| Value | Old | New |
| :-- | :-- | :-- |
| C, run mode "On demand" | 3 | 5 |
| C, flexibility, software / Claude driver | 3 / 3 | 5 / 5 |
| C, 5 minute target, Claude driver | 4 | 5 |
| D, 5 minute target, Claude driver | 4 | 5 |
| C, weighted total, software / Claude driver | 4.05 / 3.25 | 4.25 / 3.60 |
| D, weighted total, software / Claude driver | 4.10 / 3.30 | 4.10 / 3.45 |
| C, average of the two | 3.65 | 3.93 |
| D, average of the two | 3.70 | 3.78 |
| B and F | 4.00 / 3.35 and 3.85 / 3.20 | Unchanged |
| Ranking, software driver | D 4.10, C 4.05, B 4.00, F 3.85 | C 4.25, D 4.10, B 4.00, F 3.85 |
| Ranking, Claude driver | B 3.35, D 3.30, C 3.25, F 3.20 | C 3.60, D 3.45, B 3.35, F 3.20 |
| First or within 0.10 of first, of 16 rankings | B 10, D 10, C 2, F 1 | C 16, D 6, B 4, F 0 |
| Exact first places, of 16 rankings | B 9, D 8, C 0, F 0 | C 12, B 2, D 2, F 0 |
| The pick | B, tied with D, chosen on a stated judgment | C, first under both drivers |
| Worst gap behind first, across 16 rankings | B 0.40, D 0.45, C 0.36 | C 0.07, D 0.35, B 0.45 |

**What each section 12 item now does to the pick.** The full old and new figures for all 16 weightings and all 20 item rankings are in `runs/run-3-correction-trajectory.md`, section 7.

| Item | Old outcome | New outcome |
| :-- | :-- | :-- |
| 1. A timer fires reliably every minute | D, with C tied | C stays the pick |
| 2. A minute is fast enough | D, with C tied | C stays the pick |
| 3. Morning research by Claude stays optional | D, tied with F under the Claude driver | D, tied with C |
| 4. The driver stays open, or Claude stays possible | C | C stays the pick |
| 5. Rewritten: was "C stays hard to ask", now "C is easy to ask through Claude" | C | A three-way tie of D, C and B |
| 6. Rewritten: now lowers every option's operability, not only B's | D, with C tied | C under the software driver, tied with D under the Claude driver |
| 7. A worker stays healthy | B's lead widens | B becomes the pick |
| 8. Anthropic's answers | Unchanged (B, tied with D) | Unchanged (C) |
| 9. Program use of the data is affordable | No new winner | No new winner |
| 10. At least one broker keeps passing | Order unchanged | Order unchanged |

**Whether the pick changed: yes, from B to C.**

- C now leads D by 0.15 and B by 0.25 under both drivers. Both gaps are outside the 0.10 tie rule.
- Run 3 chose B on a judgment only because the arithmetic was a tie. A judgment breaks a tie but does not override a clear lead, so the same rule now gives C.
- C scores at least as high as D on every criterion. D's research layer earns points only in the weighting that values research, where D leads C by 0.06 to 0.07, a tie.
- What would make B the pick again is a measurement: a two-week trial of a do-nothing worker that shows a hang the heartbeat missed, or one Michael could not resolve alone (section 12, item 7).

**What else changed.** The summary, section 2, the text of options B, C and D, section 10, section 12 (every item re-ranked by script, items 5 and 6 rewritten) and section 13, items 1, 2 and 6. Facts, prices, hours and sources are unchanged, and nothing was re-researched. Git history keeps the original.

Written 2026-10-13 (America/Chicago). Sources opened in run 3 carry that date. Sources reused from runs 1 and 2 carry their original dates, as the brief allows.

**What this document is.**

- Research input for a human decision about the stack for a future agent that trades U.S. stocks and ETFs (exchange traded funds) intraday, for Michael's own margin account.
- It is never an instruction to trade, to open an account, to buy a subscription, to borrow or to build anything.
- It recommends an architecture, and Michael decides.
- It does not choose a provider, a broker, a driver, a run frequency, a research method or a ticker. The example setups illustrate. They do not choose.
- Nothing here is legal advice. Laws and contracts are quoted, not interpreted.

**How to read it.**

- Every factual claim carries a numbered footnote. Section 14 lists each with its title, address, access date, strength label and, for prices, a price label.
- Footnotes are for checking. Nothing needs a click to be understood.
- Sentences marked "my judgment", "my inference", "my reading", "my arithmetic" or "estimate" are reasoning from cited facts, not sourced facts.
- Most quotes were read as exact page text. Some passed through a tool that can paraphrase lightly, and the notes files mark which. Reopen the address before a decision hangs on exact wording.

## 1. Summary

**Strongest option: C, the always-on worker. It is first under both drivers, by more than this run's 0.10 tie rule.** This replaces run 3's original pick, B tied with D (see the correction above).

- **What it is.** One small program runs on a rented server through market hours and keeps live connections open to the price feed and the broker.
  - It reacts to each price change within seconds, checks every order against fixed limits, and sends it to the broker.
  - Before the open, the same program screens the wide universe and picks the day's live list. The server restarts it if it exits, and an outside heartbeat alerts Michael if it hangs.
- **Why it is the pick.**
  - This run treats totals within 0.10 of each other as a tie, because one point on a weight-10 criterion moves a total by 0.10.
  - On this run's weights C leads under both drivers: software C 4.25, D 4.10, B 4.00, F 3.85; Claude C 3.60, D 3.45, B 3.35, F 3.20.
  - Across eight weightings and both drivers (16 rankings), C is first or within 0.10 of first in all 16, D in 6, B in 4, F in none (section 10).
  - C scores at least as high as D on every criterion, with one layer fewer to keep in step. It hosts either driver, and Michael asks it questions the same way as B: through Claude reading the shared database.
- **What it costs Michael, compared with B.**
  - A running part he cannot repair himself. A stuck worker means a Claude Code session, and upkeep is about 2 hours a month against B's 1 (estimates).
  - A slightly longer build (29.5 hours of his time against 27.5, estimate) and slightly more new spending (22.19 dollars a month against 20.00 in the cheapest setup).
- **What would change the pick.**
  - A two-week trial of a do-nothing worker that shows a hang the heartbeat missed, or one Michael could not resolve alone, makes B the pick (section 12, item 7).
  - If Michael wants a Claude research layer as a must, D ties with C (item 3). If hosted code proves hard to manage, D ties with C under the Claude driver (item 6). If he weights upkeep far above execution, B ties with C (section 10).
  - Run 3's original reason for B, that it is cheaper to be wrong about before a strategy exists, was a tie-break and no longer decides. B is still a possible first stage that becomes C by adding a worker (my judgment).
- **The two passing brokers are Tradier and Alpaca.** They are the only ones read that meet every requirement: consolidated real-time data, the new day trading rule, unattended orders, a lasting sign-in and plain requests.
  - Tradier includes the data with the account.[^1]
  - Alpaca needs its 99 dollar a month data plan.[^2]
- **Costs, as examples.** The cheapest workable setup for C is 147.19 dollars a month, of which 125 is already paid (the Max plan and Supabase Pro). The recommended setup is 240.70. A Claude driver adds an estimated 4.50 (Haiku) to 90 (Sonnet) a month, possibly inside the Max plan's 100 dollar API credit.[^3]
- **Anthropic's terms leave two decisive questions open.** Can Michael be the "qualified person" who must review a buy or sell recommendation, and does an agent's order count as being "used to implement a decision"? The texts do not say.[^4][^5] Only Anthropic can settle this in writing (section 11).

**This is research input for a human decision, never an instruction to trade.**

## 2. What changed since run 2

**Key point: the pick moved from F to C (corrected 2026-10-28; run 3 first said B, tied with D). Two levers changed at once, and the table says which one moved each score.**

**Levers.**

- **Context lever** (Michael's answers): perpetual contracts out; one broker; consolidated real-time data required; a wide daily screen may feed a short live list; a new margin account; speed and reliability of execution crucial; the 100 dollar Max tier.
- **Instructions lever** (Michael's review): four options only; Claude as the driver explained inside each; build hours, itemized costs, daily use, a driver comparison, a borrowing table, a glossary and two Anthropic questions.
- **Research, not a lever:** facts found in this run, such as Tradier's rule now being confirmed.

**Criteria changes, and which lever.**

| Change | Lever |
| :-- | :-- |
| New criterion "execution speed and reliability", weight 25, the heaviest | Context: speed and reliability crucial |
| "Reach to a lawful perpetual venue" (5) dropped | Context: perpetual contracts out |
| "Reversibility" (5) dropped, because it barely separated the options | My choice, made to free weight for execution |
| Path and target each 20 to 15, flexibility 15 to 10 | Context: execution now holds part of what path measured; the daily screen removes most of the sweep risk; either driver is acceptable |
| Cost now scored on the full monthly total, data included | Instructions: itemized costs |
| Each option scored under both drivers | Instructions: Claude as the driver inside each option |

**Option by option.**

| Option | Run 2 total | Run 3 total, software / Claude | What moved it | Lever |
| :-- | :-- | :-- | :-- | :-- |
| A: Claude-native agent | 2.75 | Dropped | Michael dropped it. Claude as the driver now lives inside each option (section 6) | Instructions |
| B: scheduled web app | 3.70 | 4.00 / 3.35 | Flexibility 3 to 5, because B can now host the Claude driver through an API call. The sweep risk shrank with the daily screen | Instructions (flexibility), context (screen) |
| C: always-on worker | 3.65 | 4.25 / 3.60 | Execution 5 under the new criterion. Safety 3 to 4 and operability 2 to 3, because run 3's setups add an independent heartbeat and stops held at the broker. Flexibility 5: both drivers, and Michael asks it through Claude reading the database, as in B (corrected) | Context (execution weight); research and design (heartbeat, broker-held stops); instructions (both drivers) |
| D: worker plus Claude | 3.80 | 4.10 / 3.45 | As C, with one point less operability for the extra layer, which stays the lowest | Context; research and design |
| F: scheduled core plus Claude | 3.80 | 3.85 / 3.20 | Its edge over B (both drivers) is gone, because B now has both. Its extra layer still costs a point of operability | Instructions |
| **The pick** | **F** | **C** | The execution weight lifts the worker options above B and F. C leads D because D's extra layer costs a point of operability and earns no score. Run 3 first said B, tied with D, from a mis-scored C | Context (the execution weight), instructions (both drivers in every option) |

**Other changes since run 2.**

- **Data.** Requiring consolidated data removes the free single-exchange feeds that made run 2's cheapest data free (Alpaca Basic, Tiingo).[^6] It also removes Webull and moomoo as brokers.[^7][^8] Context lever.
- **Tradier's day trading rule is now confirmed new**, from a help answer dated June 4, 2026, which run 2 did not find.[^1] Research.
- **Massive's real-time plan is "strictly for display use only"**, so it cannot feed a program.[^2] Research.
- **Run 2 missed an Anthropic news post** dated October 8, 2026, which says the high-risk requirements "haven't changed".[^9] Research.
- **Perpetual contracts, Liquid and Kalshi** are no longer covered. Context lever.

## 3. Plain-English glossary

**Key point: every term a non-coder needs to read this document, in one place.** Definitions are plain-English explanations. Where a definition carries a fact (a price, a limit, a rule), it has a footnote.

### 3.1 Cost bands

Per month, in U.S. dollars. "What it typically buys" is drawn from the prices in this document.

| Band | Range | What that level of spending typically buys here |
| :-- | :-- | :-- |
| 0 | Free | Discord alerts and commands,[^131] Healthchecks.io's free heartbeats,[^11] GitHub's free plan,[^12] Tradier's included data,[^13] Alpaca's single-exchange data[^2] |
| 1 | 1 to 25 | A Supabase project (10),[^14] Tradier Pro (10),[^15] a small always-on server (2.19 to 6.70),[^16] Vercel Pro (20),[^17] a Claude driver on Haiku (about 4.50, estimate)[^18] |
| 2 | 26 to 100 | Consolidated real-time data for a program (Alpaca, 99),[^2] the Max plan (100),[^19] a Claude driver on Sonnet (about 90, estimate)[^18] |
| 3 | 101 to 300 | Professional-scale data such as Databento's or Massive's top retail plans (199),[^20][^2] a Claude driver on Opus (about 180, estimate)[^18] |
| 4 | Over 300 | Data licensed for business-scale program use (Twelve Data's 999 plan)[^21] |

### 3.2 Borrowing caps

**Key point: only Alpaca lets the customer set a borrowing cap, as 1, 2 or 4.**[^22] Public has an on/off switch.[^23] No cap Michael can set was found at Tradier or the other brokers read.[^24]

What Alpaca's setting means, in dollars (my arithmetic from the rule's limits in section 7.1).[^25]

| Setting | Meaning | At 10,000 of equity | At 25,000 of equity |
| :-- | :-- | :-- | :-- |
| 1 | No borrowing. Orders above available cash are rejected[^26] | Up to 10,000 of stock | Up to 25,000 |
| 2 | Up to 2 times equity, day or night | Up to 20,000 (borrowing up to 10,000) | Up to 50,000 (borrowing up to 25,000) |
| 4 | Up to 4 times during the day. Anything held overnight is still limited to 2 times | Up to 40,000 during the day, 20,000 overnight | Up to 100,000 during the day, 50,000 overnight |

- Setting 4 works only for an account in Alpaca's "4x intraday" class, and whether a new small account gets it by default is not stated.[^27] Setting 2 is the default for accounts with 2,000 dollars or more.[^27]
- The same key the agent uses can change the setting, so it stops accidents, not software that changes it on purpose.[^22]
- Tradier removed its 4 times intraday figure from all accounts, so intraday buying power there is the standard margin amount (about 2 times, the helper's reading).[^28]

### 3.3 Other terms

| Term | Meaning |
| :-- | :-- |
| Agent | Software that acts on its own inside limits, here to research and eventually trade |
| Always-on worker | A program that runs all session on a rented server and keeps its connections open |
| API (application programming interface) | The way one program talks to another, such as the agent talking to the broker |
| API key, token | The password a program uses. A "personal token" at Tradier "never expire[s]"[^1] |
| Bracket order, one-cancels-other (OCO) | An entry order with a stop and a target attached. When one of the two exits fills, the other is cancelled. Held at the broker, so it works even if the agent stops[^29][^30] |
| Buying power | How much the account can buy right now, cash plus what may be borrowed |
| Claude API credit (Max) | 100 dollars a month of API use included with Michael's Max tier. It does not cover interactive Claude Code[^3] |
| Claude as the driver | A language model chooses each trade, inside limits fixed code enforces (section 6) |
| Software as the driver | Fixed rules in code choose each trade (section 6) |
| `claude -p` | Claude Code run by a program, with no person typing[^31] |
| Commercial Terms, Consumer Terms | Anthropic's two contracts. API keys fall under the Commercial Terms. Claude Code on a Max plan falls under the Consumer Terms[^32] |
| Connector, MCP (Model Context Protocol) | The standard that lets Claude use an outside service as a tool |
| Consolidated data, SIP, CTA, UTP | Price data that covers trades on every U.S. exchange. CTA and UTP are the two official tapes, together called the SIP (Securities Information Processor)[^2] |
| Cron, timer | A schedule that starts a job at set times. Supabase's can fire "every second"[^33] |
| Day trade, round trip | Buying and selling the same stock on the same day |
| Display and non-display use | Exchange licensing terms. Display is data shown to a person. Non-display is data read by a program[^34] |
| ETF (exchange traded fund) | A fund that trades like a single stock |
| Function | A short program a platform starts on demand and stops when done. Supabase's run at most 400 seconds[^35] |
| Heartbeat, dead man's switch | The agent pings a service after every run. If the pings stop, the service alerts Michael[^11] |
| IEX | One U.S. exchange. A feed from it alone is not consolidated[^2] |
| Intraday margin standard | The rule that replaced the pattern day trader rule on June 4, 2026: no limit on round trips, 2,000 dollars to borrow[^36][^37][^38] |
| Margin account, margin loan, debit balance | An account that may borrow from the broker. The amount borrowed is the debit balance, and interest is charged on it |
| Margin call, forced sale | A demand to add money or reduce positions. A broker may sell without asking[^39] |
| Managed Agents | Anthropic's hosted agents, billed on an API key, with schedules down to one minute[^40] |
| Pattern day trader rule | The old rule: four day trades in five days required 25,000 dollars of equity. Brokers may keep it until October 20, 2027[^36] |
| Practice trading (paper trading) | Trading with pretend money on the broker's test system |
| Qualified person | Anthropic's term for who must review a personalized buy or sell recommendation from November 12, 2026 (section 11)[^4] |
| Rate limit, HTTP 429, HTTP 529 | A cap on requests per minute. 429 means "too many requests". 529 is the Claude API's "overloaded" error[^41] |
| Region pinning | Making a function run in a chosen location. Vercel runs functions in Washington, D.C. by default[^42] |
| Settlement | When a trade is final: one business day after the trade. Interest at most brokers is charged on the settled debit[^43] |
| Stream, WebSocket | A connection that stays open so prices arrive as they change |
| Token (model) | A unit of text a model reads or writes, roughly three quarters of a word. Model prices are per million tokens[^44] |
| Usage Policy | Anthropic's rules for every user. A new version takes effect November 12, 2026[^45] |

## 4. Criteria and weights

**Key point: execution speed and reliability now carries the most weight (25 of 100), because Michael said that once a strategy is decided, speed and reliability of executing it are crucial.**

- Seven criteria, weights summing to 100. Scores run from 1 (worst) to 5 (best).
- The scores are my judgment applied to cited facts. They are not measurements. Section 12 names what would turn the key ones into measurements.
- The anchors for 1, 3 and 5 were written before any option was scored. Scores of 2 and 4 fall between them.
- Each option is scored twice, once per driver, because the driver changes criteria 1, 2, 5 and 7.
- A weighted total is each score times its weight, added up, then divided by the sum of the weights.

| # | Criterion | Weight | Why this weight |
| :-- | :-- | :-- | :-- |
| 1 | Execution speed and reliability | 25 | Michael's new statement that speed and reliability of execution are crucial. Defined narrowly so it does not double count criteria 3 and 4 |
| 2 | Unattended order path inside fixed limits | 15 | The stack must be able to get to placing trades alone. Down from 20 in run 2, because part of what it measured (does the order actually land) is now criterion 1 |
| 3 | The 5 minute target on consolidated data | 15 | The target is unchanged. Down from 20, because a wide daily screen may now feed a short live list, which removes most of run 2's unmeasured "sweep the whole market every minute" risk |
| 4 | Operability for a non-coder | 15 | Michael writes no code and must still notice when it breaks |
| 5 | Safety of an agent that acts alone | 10 | The agent may act without approval and may borrow. Kept at 10 because every option can be made safer by design |
| 6 | Flexibility across drivers and run modes | 10 | Down from 15, because Michael has now said either driver is acceptable, so closing one door costs less |
| 7 | Monthly cost of the whole setup | 10 | At 10,000 to 25,000 dollars, a monthly bill is a hurdle the trading must clear. Now scored on the full tool total, data included |

Dropped from run 2, with the reason:

- **Reach to a lawful perpetual venue (was 5).** Perpetual contracts are out entirely.
- **Reversibility (was 5).** All four options are Michael's own code and data, so it barely separated them in run 2 (3 or 4 for every option). Its 5 points went to criterion 1.

**Anchors.**

| # | A score of 1 means | A score of 3 means | A score of 5 means |
| :-- | :-- | :-- | :-- |
| 1 | Decisions that are due often do not run (a sleeping computer, an hourly floor), or an order depends on a part with no retry and no detection | Decisions run within about a minute of when they are due, but late or missed runs are documented possibilities (best-effort timers, model overload) and detecting a missed run must be built | A process that stays connected sends an order within seconds of the decision, retries documented failures, and a missed or failed run is detected and alerted automatically by a part independent of the one that failed |
| 2 | Cannot place an order without a person each time, or only by a route the provider's terms appear to prohibit | Can place orders unattended, but the limits are held only by a model following instructions, or a key fact (the broker's day trading rule, a lasting sign-in, the terms) rests on unverified evidence | Orders go unattended at a broker confirmed on the new rule, with limits enforced in fixed code, a borrowing cap set at the broker, a sign-in lasting at least a week, under terms that clearly allow it |
| 3 | Cannot run unattended more often than hourly, or cannot get consolidated real-time data | Reacts within 5 minutes only with a caveat: a computer that must stay awake, runs that can be late or skipped, or a live list cut below what the strategy needs | Screens thousands of names daily and checks the live list on consolidated real-time data every minute or faster, with room to spare |
| 4 | Several parts he is responsible for keeping alive, failing silently by default | Hosted code on platforms that keep it running, with more than two parts to keep in step, or one always-on part that is managed for him | No code to maintain and nothing to keep running |
| 5 | A language model can send orders and borrow with no fixed check | Fixed checks exist in one place only, or a failure can leave a position open with nobody told | Every order passes a fixed check in code, a borrowing cap and an off switch sit at the broker where the agent cannot change them, protective orders sit at the broker, and everything is recorded |
| 6 | One driver and one strong run mode | One driver, or one weak run mode | Both drivers, and at least 4 on every run mode |
| 7 | Cheapest workable setup over 300 dollars a month | 101 to 200 dollars a month (2 is 201 to 300) | Under 50 dollars a month (4 is 50 to 100) |

**Run modes and memory modes** are scored on the same 1 to 5 scale, separately from the weighted total, as the brief asks.

- **On a schedule:** how short and how dependable the interval can be.
- **Triggered by an event,** in two parts. "Callback" means something outside wakes the agent with a web request. "Price event" means how soon the option itself notices a price change: seconds scores 5, about a minute scores 4, five minutes with caveats scores 3, hourly scores 2.
- **On demand:** how easily Michael can ask it something or start a run.
- **Memory kept across runs,** and **each run independent.**

## 5. Source strength scale and cost bands

**Key point: both scales are the same as runs 1 and 2, so earlier labels can be reused.**

**Source strength.**

| Label | Meaning |
| :-- | :-- |
| A | Primary and authoritative: a regulator, a statute, an exchange, an index owner, or the vendor's own documentation, pricing page or terms, seen live |
| B | Reputable independent press or an established reference publisher |
| C | Review sites, comparison sites and affiliate blogs, which have a commercial incentive |
| D | Forums, social posts, personal blogs and community code repositories |

**Price labels.**

| Label | Meaning |
| :-- | :-- |
| Published | On the vendor's own public page, seen live on the access date (run 2 or run 3) |
| Corroborated | Not seen on a vendor page, but at least two independent sources agree, and they are named |
| Gated and unverified | Behind a sign-in, a signup or a sales call, or on a page that would not load, and not corroborated. The reason is stated |

**Cost bands.** Per month, in U.S. dollars. What each band typically buys is in the glossary (section 3).

| Band | Range | Top of band over a year, as a share of 10,000 dollars | Share of 25,000 dollars |
| :-- | :-- | :-- | :-- |
| 0 | Free | 0 | 0 |
| 1 | 1 to 25 | 3 percent | 1.2 percent |
| 2 | 26 to 100 | 12 percent | 4.8 percent |
| 3 | 101 to 300 | 36 percent | 14.4 percent |
| 4 | Over 300 | Over 36 percent | Over 14.4 percent |

The last two columns are my arithmetic. They show the yearly bill as a share of starting capital, which the trading has to earn back before it makes anything.

## 6. Driver models compared

**Key point: the driver decides who picks each trade. Either way, fixed code should send the order and enforce the limits. Software as the driver is faster, more predictable and clear of the "qualified person" question. Claude as the driver can weigh news and context, but a model is then in the decision path, under Anthropic's review rule and on a best-effort service.**

- **Claude as the driver:** a language model chooses each trade (what, which way, how much), inside limits that fixed code checks before anything reaches the broker.
- **Software as the driver:** fixed rules in code choose each trade. Claude, if present, researches and writes settings (a watch list, thresholds), which fixed code then applies.
- In both, this run's designs keep the broker connection in fixed code, never in Claude's hands. That is a design choice (my judgment), made so that the limits hold whatever the driver does.

### 6.1 Claude as the driver

- **How it works.**
  - On a timer or an event, the program (options B and C) or a separate Claude run (options D and F) gathers prices and research for the live list
  - Claude returns a decision: buy, sell or hold, and how much
  - Fixed code checks the decision against the limits and sends it, or refuses it
- **Speed.**
  - Adds a model call to every decision. Its length is not published, and this run did not measure it (an estimate of seconds to tens of seconds is my guess; one timed test call would turn it into a measurement)
  - Inside a 5 minute target either way (my judgment)
  - A separate Claude run on Managed Agents starts up to 15 percent of its interval late, so up to 45 seconds on a 5 minute schedule[^40]
- **Reliability.**
  - The API's standard tier is "best-effort availability"[^41]
  - It documents an "overloaded" error that "can occur when the API experiences high traffic across all users"[^41]
  - The paid priority option is "no longer available for purchase"[^41]
  - A monthly spend cap stops calls until the 1st of the next month[^46]
  - The same inputs can produce different outputs (my judgment), so a missed or odd decision is harder to diagnose
  - On the Max plan, usage stops at the plan's limit until it resets[^47]
- **Cost.**
  - Model use on top of the platform. An estimate, not a measurement: one decision call every 5 minutes through a regular session (1,638 a month) at 20,000 tokens in and 1,500 out costs about 4.50 dollars a month on Haiku, 90 on Sonnet and 180 on Opus without caching[^18]
  - Every Claude driver cost in this document assumes one call every 5 minutes. The fixed code still checks prices every minute or faster, and calls Claude every 5 minutes or when a rule flags a candidate (design choice)
  - At one call a minute the cost is about five times higher (my arithmetic): about 22.50 on Haiku, 450 on Sonnet and 900 on Opus. Sonnet would then sit close to the new-account spend cap of 500 dollars a month, and Opus above it; at the cap the API refuses calls until the 1st of the next month[^46]
  - Today's prices per million tokens are unchanged: Haiku 5.5 0.10 and 0.50, Sonnet 5.5 2 and 10, Opus 5.5 4 and 20[^44]
  - Michael's Max tier includes 100 dollars a month of API credit, which could cover the Sonnet estimate,[^3] but which terms govern it is not stated[^48]
- **Safety.**
  - A model decides. Fixed limits in code and a cap at the broker still bound what it can do (design choice)
  - The risk is a decision that is inside the limits but wrong, made for a reason nobody can replay (my judgment)
- **Anthropic's terms.**
  - Run on a key: the Commercial Terms, which say nothing about securities,[^49] plus the Usage Policy
  - Run through Claude Code on the Max plan: the Consumer Terms,[^32] which bar relying on the service "to buy or sell securities"[^50]
  - From November 12, 2026, a personalized buy or sell recommendation needs review by "A qualified person" before it "is used to implement a decision"[^4]
  - Whether Michael can be that person is not answered by the texts (section 11)[^5]

### 6.2 Software as the driver

- **How it works.**
  - On a timer or a price change, fixed code reads prices for the live list
  - Fixed rules decide buy, sell or hold, and how much
  - The same fixed code checks the limits and sends the order
  - Claude may research before the open and write settings the rules use
- **Speed.**
  - No model call in the decision path. A rule is evaluated in well under a second (my inference, not measured)
  - Speed is set by the timer or the price stream, not by the decision
- **Reliability.**
  - No dependency on a model service at decision time
  - The same inputs always produce the same decision, so a wrong trade can be traced and repeated (my judgment)
  - Still depends on the timer or worker, the data feed and the broker, which every option shares
- **Cost.**
  - No model cost at decision time
  - An optional Claude research layer costs whatever its runs cost, on the plan or on a key
- **Safety.**
  - No model in the decision path or the order path
  - Rules can be tested on past prices and in practice trading before real money (my judgment)
- **Anthropic's terms.**
  - If no model runs, Anthropic's terms do not bear on the running system
  - If Claude researches, the Usage Policy lists exclusions for "Internal drafting, research, summarization, or analysis that is not the ultimate High-risk AI Recommendation delivered" and for "applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual"[^51]
  - Whether a setting Claude writes each morning is "a fixed rule" or a recommendation is not answered by the text (my reading)

### 6.3 Side by side, in one line each

| | Claude as the driver | Software as the driver |
| :-- | :-- | :-- |
| Who picks each trade | A language model, inside fixed limits | Fixed rules in code |
| Speed | Adds a model call per decision, not measured here | No model call at decision time |
| Reliability | Best-effort model service, plus the shared parts | Only the shared parts (timer or worker, data, broker) |
| Cost | Estimated 4.50 to 180 dollars a month in model use at a 5 minute cadence, by model | No model cost at decision time |
| Safety | Limits hold, but a decision inside them may be unexplainable | Every decision can be replayed and tested |
| Anthropic's terms | The "qualified person" review applies on its face, and the Consumer Terms passage applies on the Max plan | Out of scope if no model runs. Research by Claude falls near two listed exclusions |

### 6.4 Which Anthropic account the Claude driver runs under, by option

 This is the sharpest practical difference between the options for the Claude driver.

| Option | Where Claude runs when it drives | Account and terms |
| :-- | :-- | :-- |
| B and C (one layer) | Called through the API from inside the program | An API key, so the Commercial Terms and the Usage Policy[^52][^32] |
| D and F (two layers) | A separate Claude run: Claude Code (a routine or `claude -p`) or Anthropic's hosted Managed Agents | Claude Code on the Max login: the Consumer Terms.[^32] Claude Code with an API key, or Managed Agents: the Commercial Terms.[^32][^3] Both: the Usage Policy |

### 6.5 What both drivers share


- Fixed code sends every order and enforces every limit, so the broker never takes instructions directly from a model (design choice).
- The same data, the same broker, the same off switch and the same alerts.
- Michael can switch drivers later without changing broker, data or hosting (my judgment), because the order path does not change.

## 7. Shared reference

**Key point: two brokers pass every requirement today, Tradier and Alpaca, and no separate data vendor rescues any of the others.** The tables below hold the rules and the candidates every option draws on.

### 7.1 Margin rules for a new account with 10,000 to 25,000 dollars

**Key point: the new rule has no limit on round trips and needs 2,000 dollars to borrow. It allows at most about 4 times equity during the day and 2 times overnight, and brokers may set lower limits.** These findings are reused from run 2 (2026-10-09), because nothing in run 3's changes touches the rule itself.

| Rule | What it says | Footnote |
| :-- | :-- | :-- |
| Which rule | The pattern day trader rule was replaced by "intraday margin standards", effective June 4, 2026. Brokers may keep the old rule until October 20, 2027 | [^36] |
| Round trips | The four-trades-in-five-days test is deleted. A broker may still set its own limits | [^37] |
| Minimum to borrow | 2,000 dollars of equity. The 25,000 dollar sentence was struck | [^38] |
| Intraday limit | Stock held long needs 25 percent of its value in equity through the day, so about 4 times equity at most | [^53][^25] |
| Overnight limit | The federal initial requirement is 50 percent, so about 2 times equity at most | [^54][^25] |
| In dollars (my arithmetic) | At 10,000 of equity: about 40,000 during the day, 20,000 overnight. At 25,000: about 100,000 and 50,000. These are ceilings a broker may lower, not targets | [^25] |
| A shortfall during the day | The broker works out the worst shortfall reached after any purchase that day, even if the account is fine by the close | [^55] |
| Meeting a shortfall | "As promptly as possible". A practice of unmet shortfalls can freeze new borrowing for 90 days | [^56][^57] |
| Blocking in advance | A broker may instead block, in real time, any order that would create a shortfall | [^58] |
| Sale proceeds | Usable again the same day in a margin account. The settlement wait belongs to cash accounts | [^59] |
| Forced sales | Brokers may sell without reaching the customer. Alpaca says so in its documentation | [^39] |

### 7.2 Which day trading rule each broker applies to a new margin account under 25,000 dollars

**Key point: Tradier's status, open in run 2, is now settled: it applies the new rule to all accounts. Interactive Brokers is still not settled.**

| Broker | Rule today | Evidence | Footnote |
| :-- | :-- | :-- | :-- |
| Tradier | **New**, all accounts, from June 4, 2026. Tradier also removed its 4 times intraday buying power figure, so intraday buying power is the standard margin amount (about 2 times, the helper's reading) | Tradier help answer, read in full by the main session | [^1][^28] |
| Alpaca | New. Switch date not stated | Vendor docs (run 2) | [^60] |
| tastytrade | **New**, adopted June 4, 2026, now confirmed. Appears to give 2 times, not 4, on stock | Vendor page | [^61] |
| Charles Schwab | New, stopped counting day trades June 8, 2026 | Vendor page (run 2) | [^62] |
| Public | New, from June 4, 2026 | Vendor help pages (run 2) | [^63] |
| TradeStation | New, described as live | Vendor pages (run 2) | [^64] |
| Webull | New, from June 4, 2026 | Vendor page (run 2) | [^65] |
| E*TRADE | New, since June 9, 2026 | Vendor page (run 2) | [^66] |
| Interactive Brokers | **Not settled.** Its guides, last updated June 3, 2026, still say an account "may still be subject to existing PDT rules" | Vendor pages | [^67] |
| Lightspeed | Partly. "Not all Lightspeed platforms will be ready"; the old rule is to "fully sunset on October 27, 2026" | Vendor page | [^68] |
| Robinhood agentic account | Not applicable: no borrowing | Vendor page | [^69] |

### 7.3 Price data candidates, against the consolidated requirement

**Key point: consolidated real-time data that a program may use comes from Tradier (included with the account) or Alpaca (99 dollars a month). Every separate vendor read fails on coverage, on program use or on an unreadable step.**

"Consolidated" means covering trades on every U.S. exchange, through the two official tapes (CTA and UTP, together called the SIP). Data for a program is called "non-display use" by the exchanges, and is licensed separately from data shown on a screen.[^34][^70]

| Candidate and plan | Price a month | Real time and consolidated? | May a program use it? | Fits the wide screen? | Footnote |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **Tradier, with a brokerage account** | Included | **Yes**: "a consolidated feed from all exchanges" | Its interface is "entitled for personal use only". Exchange terms on program use not found either way | Live list yes. Wide screen: per-request limit unpublished | [^1][^13][^71] |
| **Alpaca, Algo Trader Plus** | 99, published | **Yes**: CTA and UTP, "All US Stock Exchanges" | Alpaca's own data agreement on program use was not read | Yes: 10,000 data calls a minute, unlimited streaming symbols | [^2] |
| Alpaca, Basic | 0 | No: real time from IEX only, one exchange | | Prior-day consolidated history is free, which can feed a morning screen (my reading of the plan table) | [^2][^6][^72] |
| Interactive Brokers | 4.50 or 14.50 (two findings disagree) | Yes, for a fee. The free feed is "Non-consolidated" | | No: about 100 streaming lines by default. Needs a gateway program | [^73][^74] |
| Massive, Advanced | 199, published | Yes | **No**: "strictly for display use only" | | [^2] |
| Twelve Data, below 999 | 29 to 329 | No | **No**: "cannot be programmatically processed" | | [^21] |
| Databento, Standard | 199, published | Real time, but no consolidated dataset named | | | [^20] |
| Alpha Vantage, premium | 49.99 and up, published | Claims "consolidated NBBO", but real time needs an entitlement step behind a signup | Not readable | | [^75][^76] |
| Finazon | "from 4", not confirmed purchasable | Claimed. The plan page redirects to an IEX-based product | | | [^77] |
| Webull API | Free | No: Nasdaq Basic | | | [^7] |
| moomoo API | Free during a promotion | No: three exchange feeds, not the SIP | | | [^8] |
| tastytrade, TradeStation, Public APIs | Not stated | **Not stated** whether consolidated | | | [^78][^79][^80] |
| EODHD, Finnhub, Financial Modeling Prep | 19.99 to 199.99 | Delayed, or the feed is not stated | | | [^81][^82][^83] |

- **Why this matters for "a separate data vendor is fine".** tastytrade, TradeStation and Public pass every other gate. A separate vendor would rescue them only if one sold consolidated real-time data for program use, and none read does, unless Alpaca's data plan can be bought without trading at Alpaca, which is not verified (my reading of the rows above).
- **The wide daily screen does not need real-time data** (my reading, flagged for Michael to overrule). Screening before the open can use the prior day's consolidated prices. Only the live list needs real time.
- **Licensing is still open.** The official feeds' policies describe "non-display use" with examples that fit a trading program.[^34] For Nasdaq-listed stocks the fee applies "only to Vendors that receive a Data Feed".[^70] No page read at Tradier or Alpaca addresses an individual's own program.[^13]

**Index member lists, for the universe.** Reused from runs 1 and 2: the Dow (30) and S&P 500 (503) from State Street fund holdings,[^84] the Russell 2000 (about 2,000) from iShares' daily holdings file,[^85] the Nasdaq 100 from a fund whose downloadable file was not confirmed,[^86] the NASDAQ Composite and NYSE Composite by filtering Nasdaq Trader's free symbol files.[^87] Together about 5,000 to 6,000 names after overlap (run 2's arithmetic).

### 7.4 Broker candidates: the five gates

**Key point: Tradier and Alpaca pass all five gates. Three more fail only on whether their data is consolidated.**

The gates: (1) consolidated real-time data through the broker's own interface, (2) the new rule for a new margin account under 25,000 dollars, (3) software places orders with no person confirming, (4) a sign-in lasting at least a week, (5) access by plain request, with no gateway program to keep running.

| Broker | 1. Data | 2. Rule | 3. Unattended orders | 4. Sign-in | 5. By request | Borrowing cap Michael sets | Protective orders held at the broker | Result | Footnotes |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **Tradier** | Yes, included | New | Yes | Personal token "never expire[s]" | Yes | None found | Brackets, one-cancels-other. No trailing stop | **Passes** | [^1][^29][^24] |
| **Alpaca** | Yes, with the 99 dollar plan | New | Yes | Keys, no expiry stated | Yes | Yes: 1, 2 or 4, plus long-only and a block on new orders. The same key can change it | Brackets, one-cancels-other, trailing stops | **Passes** (with the data plan) | [^6][^60][^22][^30] |
| tastytrade | Not stated | New | Yes | Refresh token "do[es] not expire" | Yes | None found | Not checked | Fails on data only | [^78][^61][^88] |
| TradeStation | Not readable | New | Yes, through the API. Its connector confirms every order | Refresh token "valid indefinitely" by default | Yes | None found | Not checked | Fails on data only | [^79][^89] |
| Public | Not stated | New | Yes | Long-lived secret key | Yes | An on/off switch, not a multiplier | Not checked | Fails on data only | [^80][^90][^23] |
| Charles Schwab | Community sources only | New | Community sources only | 7 days; whether it renews without a person is contradicted | Community sources only | None found | Not checked | Uncertain | [^91] |
| Interactive Brokers | For a fee | Not settled | Yes, prompts can be suppressed | About daily in practice, per an IBKR staff podcast | No: gateway program | None found | Not checked | Fails | [^74][^67][^92] |
| Webull | No | New | Direct API yes | Lapses after 15 idle days | Yes | None found | Not checked | Fails on data | [^7] |
| E*TRADE | Not checked | New | Yes | Expires at midnight every day | Yes | None found | Not checked | Fails on sign-in | [^93] |
| Robinhood agentic | Not checked | n/a | Yes, once approvals are off | Not stated | Connector only | No borrowing at all | Not checked | Fails: no borrowing | [^69] |

- **Commissions and fees at the two passing brokers.** Tradier: Lite 0 a month and 0.35 a stock trade, Pro 10 a month and 0 a trade, plus regulatory pass-through fees.[^15][^94] Alpaca: "In general, we do not charge a commission for trades", with "Relevant SEC and FINRA fees".[^95] The Alpaca disclosure sentence names cash accounts, and the same page does not restate it for margin accounts.[^95]
- **Request limits.** Tradier: 120 data and 60 trading requests a minute.[^71] Alpaca: 200 trading requests a minute.[^30]
- **Terms on automation.** Tradier: "entitled for personal use only".[^1] Alpaca's agreement on an individual's own program was not read.[^96]

## 8. Borrowing cost table

**Key point: at the two passing brokers, money borrowed and repaid within the same day costs nothing, and money held overnight costs 6.50 percent a year at Alpaca or 9.75 percent at Tradier.** Borrowing is kept out of the monthly platform totals in section 9.

- "Held overnight for one month" means the amount stays borrowed every night for 30 days. The cost is my arithmetic: amount times the rate times 30, divided by the broker's day count (360, or 365 where stated), and divided by 360 where the day count is not stated.
- Rates are for the smallest balance tier, which covers 2,000 to 10,000 dollars at every broker listed.
- These are the brokers that fit any option, plus the near-miss brokers for comparison.

| Broker | Fits which options | Published rate | How interest is charged | Borrow 2,000 for a month | 5,000 | 10,000 | Same-day borrowing | Footnotes |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **Alpaca** | B, C, D, F (with the data plan) | 6.50 percent | Daily on the end-of-day settlement-date debit, divided by 360 | 10.83 | 27.08 | 54.17 | **Free, stated**: "you would not incur any interest expense" | [^97] |
| **Tradier** | B, C, D, F | 9.75 percent, one flat rate | Daily on the settled debit balance; day count not stated | 16.25 | 40.63 | 81.25 | Free by inference from "settled debit balance", not stated | [^15][^43] |
| Public (near miss: data not stated) | None today | 5.15 percent, the rate for the lowest balance tier | Daily, 365 days | 8.47 | 21.16 | 42.33 | Not stated | [^98] |
| tastytrade (near miss) | None today | About 11 percent, per one review site; gated and unverified | Not stated | 18.33 | 45.83 | 91.67 | Not stated | [^99] |
| TradeStation (near miss) | None today | 12.00 percent under 50,000 | Not stated | 20.00 | 50.00 | 100.00 | Not stated | [^100] |
| Charles Schwab (uncertain) | None today | 12.075 percent | Daily from the settlement date, 360 days | 20.13 | 50.31 | 100.63 | Free by inference from "settlement date", not stated | [^101] |
| Interactive Brokers Pro (fails) | None | 5.38 percent | Daily on ending settled cash, 360 days | 8.97 | 22.42 | 44.83 | Free by inference, not stated | [^102] |
| Webull (fails on data) | None | 8.74 percent | Daily average of closing settled debit, 360 days | 14.57 | 36.42 | 72.83 | **Free, stated** | [^103] |

- **What this means at the two passing brokers** (my arithmetic). Borrowing 5,000 dollars every night costs about 13.54 dollars a month more at Tradier than at Alpaca. That is less than Alpaca's 99 dollar data plan, so Tradier stays cheaper overall unless the overnight debt is large.
- **An intraday agent that ends every day flat borrows for free** at both, on the wording above. Interest starts only with a position held overnight on borrowed money.
- **Borrowing caps.** Only Alpaca lets the customer set one (1, 2 or 4; glossary, section 3).[^22] Public offers an on/off switch.[^23] At Tradier the limit lives in the agent's own code.[^24]

## 9. The four options

**Key point: all four options put fixed code, not a language model, in front of the broker. They differ on two things: is the core woken by a timer or always running, and is there a separate Claude research layer on top.**

| | Timer core (nothing stays running) | Always-on core (one program runs all session) |
| :-- | :-- | :-- |
| No separate Claude layer | **B: scheduled web app** | **C: always-on worker** |
| Claude research layer on top | **F: scheduled core plus Claude** | **D: worker plus Claude** |

- The letters are run 2's, so that each means the same thing in both runs.
- In every option Claude can be the driver, by being called through the API at each decision (section 6). In D and F, Claude also runs separately as a research layer.
- The hours, costs and daily routines below are estimates and examples, labelled as such. They are not picks.

### 9.1 Option B: scheduled web app

**Key point: the simplest option to keep running. A timer inside the database wakes a short program every minute, and nothing stays running in between.**

**The architecture in plain English.**

- This is the shape of Relii: a Supabase database with its built-in timer and functions, and optionally a Vercel screen.[^104]
- Supabase's timer can fire "anywhere from every second to once a year".[^33] Every minute during market hours it wakes a function.
- The function fetches current prices for the live list, decides, checks every order against fixed limits, sends it to the broker, and writes down what it did.
- Before the open, a longer run screens the wide universe and writes the day's live list.
- A function can run for at most 400 seconds, with 2 seconds of processor time per request.[^35] Each run starts fresh, so a failed minute is followed by a clean one (my judgment).
- An outside heartbeat service expects a ping after every run and alerts Michael when one is missing.[^11]

**Driver models in this option.**

- **Software as the driver.** The function applies fixed rules. Claude can still be asked questions about what happened, by reading the same database.
- **Claude as the driver.** At each decision the function sends Claude the live list's prices and the day's context through the API, and gets back a decision. The function then checks it against the limits and sends it or refuses it. This runs under an API key, so the Commercial Terms and the Usage Policy apply.[^32][^52]

**Categories, candidates, coverage and cost bands.**

| Category | Candidates that fit | Band |
| :-- | :-- | :-- |
| Reasoning model | None (software driver), or the Claude API (Claude driver): Haiku 5.5 estimated at 4.50 a month, Sonnet 5.5 at 90, at one decision every 5 minutes[^18][^44] | 0, or 1 to 2 |
| Where it runs | Supabase timer and functions in an additional project, about 10 a month.[^105][^14] Optional Vercel Pro screen, 20[^17] | 1 |
| Memory | The same Supabase database[^105] | Inside the above |
| Price data | The broker's own consolidated data (Tradier, included),[^13] or Alpaca's Algo Trader Plus (99)[^2] | 0 or 2 |
| Alerts and heartbeat | Discord (free),[^131] Healthchecks.io (free for 20 checks),[^11] Pushover (4.99 once)[^106] | 0 |
| Brokerage | Tradier or Alpaca (section 7.4) | 0 to 1 |

- **Universe coverage.** Both data sources cover every U.S. exchange.[^13][^2] A wide daily screen of thousands of names fits Alpaca's 10,000 data calls a minute.[^2] At Tradier the per-request symbol limit is not published and Tradier warns against "asking for an entire exchange's worth of symbols", so the wide screen should be tested gently or drawn from prior-day data.[^71]
- **The live list** of 50 to 200 names fits easily: Tradier allows 120 data requests a minute and a "larger list of symbols" per request.[^71]
- The daily screen feeding a short live list removes most of run 2's unmeasured risk for this option (whole-market sweeps every minute inside a short function).

**Brokerage and order execution candidates.**

- **Tradier.** Passes every gate: the new day trading rule for all accounts, a personal token that "never expire[s]", orders by plain request, consolidated real-time data included.[^1] Protective orders (brackets and one-cancels-other) are held at the broker.[^29]
- **Alpaca.** Passes every gate with its 99 dollar data plan.[^6] Adds a borrowing cap the customer sets and trailing stops held at the broker.[^22][^30]
- tastytrade, TradeStation and Public would fit the order path, but whether their data is consolidated is not stated (section 7.4).[^78][^79][^80]

**Account and regulatory rules that affect it.**

- Both passing brokers apply the new intraday margin standard, so there is no limit on round trips.[^1][^60]
- The function must read buying power from the broker before each order. Alpaca's interface reports it.[^107]
- Supabase sits in Oregon (this repo's `CLAUDE.md`). If a Vercel screen is used, its functions must be pinned to Oregon, because Vercel runs them in Washington, D.C. by default.[^42]
- Software reads prices with no person watching, so the exchanges' "non-display use" rules may apply (section 7.3).[^34]

**Scores against the criteria.**

| Criterion (weight) | Software driver | Claude driver | Basis |
| :-- | :-- | :-- | :-- |
| Execution speed and reliability (25) | 4 | 3 | A timer that can fire every second,[^33] each run fresh, an independent heartbeat.[^11] Not 5: nothing stays connected, and no page promises a missed run is retried. Claude driver: a best-effort model call in every decision[^41] |
| Unattended order path (15) | 4 | 3 | Passing brokers, orders by request, a lasting sign-in.[^1] Not 5: no borrowing cap the agent cannot change.[^22][^24] Claude driver: the "qualified person" question is open[^5] |
| 5 minute target on consolidated data (15) | 4 | 4 | A check every minute on consolidated data.[^13] Not 5: no live stream, because a function cannot hold one all session[^108] |
| Operability (15) | 4 | 3 | Hosted code with no always-on part. Claude driver: a model service and its spend cap to manage as well[^46] |
| Safety (10) | 4 | 3 | Fixed checks in code, stops held at the broker,[^29] a heartbeat. Not 5: no cap the agent cannot change. Claude driver: a model chooses inside the limits |
| Flexibility (10) | 5 | 5 | Both drivers, every run mode at 4 or 5 |
| Cost (10) | 3 | 3 | Cheapest total 145.00 (software) or 149.50 (Claude), with the Max plan and Supabase Pro counted at their price |
| **Weighted total** | **4.00** | **3.35** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 4 | Every minute or faster.[^33] A timer has no documented retry |
| Event, callback | 4 | A web request can wake a function at any time (my inference from how functions are called) |
| Event, price event | 4 | Notices at the next check, about a minute |
| On demand | 5 | Ask Claude, which reads the database, or open the screen |
| Memory kept across runs | 5 | The database |
| Each run independent | 5 | Each function run starts fresh |

**Build estimate: Michael's hands-on hours.** All figures are estimates, not measurements (section 4 of the trajectory, decision D12, gives the method).

| Phase | What Michael does | Hours, software driver | Hours, Claude driver |
| :-- | :-- | :-- | :-- |
| 0. Decide and set up accounts | Read and decide (2), open and fund the margin account and get the API token (2), create the Supabase project (0.5), set up the Discord server, bot and heartbeat (0.5). Claude driver: open the Anthropic Console organization (0.5) | 5.0 | 5.5 |
| 1. Build pieces | 8 pieces: database and limits; broker connection in practice mode; prices (daily screen and live list); decision rules (or the Claude decision step); limit checks and order sending with broker-held stops; timer, run log and end-of-day close-out; alerts, heartbeat and off switch; a rehearsal on a recorded day. Three touch money (2.5 hours each), five do not (1.5 each). Claude driver: the decision step also touches money. The recommended setup adds a screen (1.5) | 15.0 (16.5 with the screen) | 16.0 (17.5) |
| 2. Practice trading | Two weeks: 15 minutes a session reading the log, one review hour a week. Claude driver: one more review hour reading the model's decisions | 4.5 | 5.5 |
| 3. First live week | 30 minutes a session, plus a review | 3.0 | 3.0 |
| **Total** | | **27.5 (29.0 with the screen)** | **30.0 (31.5)** |

- Upkeep after the build: about 1 hour a month (my estimate).
- What would turn these into measurements: Michael logs his hands-on minutes for each session of the first three pieces, and the rest are re-scaled from that.

**Example setup 1: cheapest workable.** An example, not a pick. It meets the brief's requirements on published facts (consolidated real-time data, one broker, a margin account, unattended orders, alerts), with one gap noted under the table: the wide morning screen.

| Tool | Plan | What it does in this stack | Monthly price | Price label | Footnote |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Claude Max | Max 5x | Claude Code builds and maintains the stack; Michael asks it questions. **Already paid** | 100.00 | Published | [^19] |
| Supabase | Pro organization | Holds the projects. **Already paid** | 25.00 | Published | [^105] |
| Supabase | Additional project, Micro compute | Database, timer, functions, run log, limits | 10.00 | Published | [^14] |
| Tradier | Pro plan | Broker: margin account, orders, broker-held stops, consolidated real-time data included | 10.00 | Published | [^15][^13] |
| Discord | Free | Alerts, and a stop command | 0.00 | Published | [^131] |
| Healthchecks.io | Hobbyist | Heartbeat: alerts when a run is missed | 0.00 | Published | [^11] |
| GitHub | Free | Stores the code. **Already paid (free tier)** | 0.00 | Published | [^12] |
| Claude API | Haiku 5.5, pay as you go | **Claude driver only:** decides each trade, one call every 5 minutes | 4.50, estimate | Estimate on published prices | [^18][^44] |

- **Monthly total, software driver: 145.00 dollars.** New spending: 20.00.
- **Monthly total, Claude driver: 149.50 dollars (estimate).** New spending: 24.50, or 20.00 if the Max plan's 100 dollar API credit covers the model calls, which depends on which terms govern that credit (section 11).[^3][^48]
- No screen: Vercel Hobby is "non-commercial personal use only", and a trading dashboard sits near that line, so this setup leaves it out.[^17] Michael looks at the log through Claude or the Supabase dashboard, and stops the agent from Discord or the broker's own app.
- Trading costs are extra: Tradier Pro charges 0 a stock trade, with regulatory pass-through fees on sales.[^94] Lite is 0 a month and 0.35 a trade, cheaper below about 29 trades a month (my arithmetic).[^15]
- Borrowing is priced separately (section 8).
- **Gap in this setup: the wide morning screen.** Tradier does not publish how many symbols one quote request may carry, and warns against "asking for an entire exchange's worth of symbols".[^71] The fallback, Alpaca's free prior-day history, needs an Alpaca account, and whether a data-only account is possible was not verified.[^2] So this setup meets the live-list requirement on published facts, and the wide screen only on a gentle test (my judgment).

**Example setup 2: recommended for speed and reliability.** An example, not a pick.

| Tool | Plan | What it does in this stack | Monthly price | Price label | Footnote |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Claude Max | Max 5x | Builds and maintains; answers questions. **Already paid** | 100.00 | Published | [^19] |
| Supabase | Pro organization | Holds the projects. **Already paid** | 25.00 | Published | [^105] |
| Supabase | Additional project, Micro compute | Database, timer, functions, run log, limits | 10.00 | Published | [^14] |
| Vercel | Pro | A screen with positions, limits, the log and an off switch, pinned to Oregon | 20.00 | Published | [^17][^42] |
| Alpaca | Brokerage account | Broker: margin account, orders, brackets and trailing stops held at the broker, a borrowing cap Michael sets | 0.00 (no commission) | Published | [^95][^30][^22] |
| Alpaca | Algo Trader Plus | Real-time data from all U.S. exchanges, unlimited streaming symbols, 10,000 data calls a minute | 99.00 | Published | [^2] |
| Discord | Free | Alerts, and a stop command | 0.00 | Published | [^131] |
| Healthchecks.io | Hobbyist | Heartbeat | 0.00 | Published | [^11] |
| Pushover | Individual | A second alert route to the phone. 4.99 once per platform, not monthly | 0.00 | Published | [^106] |
| GitHub | Free | Stores the code. **Already paid (free tier)** | 0.00 | Published | [^12] |
| Claude API | Sonnet 5.5, pay as you go | **Claude driver only:** decides each trade, one call every 5 minutes | 90.00, estimate | Estimate on published prices | [^18][^44] |

- **Monthly total, software driver: 254.00 dollars.** New spending: 129.00.
- **Monthly total, Claude driver: 344.00 dollars (estimate).** New spending: 219.00, or 129.00 if the Max plan's API credit covers the model calls.[^3][^48]
- **Why these choices, for speed and reliability:** Alpaca's data plan removes Tradier's unpublished symbol limits for the wide screen,[^71][^2] and Alpaca holds trailing stops at the broker, which Tradier does not offer.[^30][^29] The screen gives Michael one place to see and stop everything.
- **Both brokers have had recent incidents.** Alpaca's status page lists "Intermittent HTTP 500 errors" on its order interface on September 11 (major) and "Order processing delays" on September 30 (minor).[^97] Tradier's lists an "Elevated API Errors" incident on market data today, October 13.[^109] Neither is evidence that one is more reliable than the other (my judgment).

**How Michael uses it.**

- **A day with this stack.**
  - Before the open: the screen run picks the day's live list and posts it to the stack's Discord server. Michael glances at it on his phone.
  - During the session: nothing to do. Every minute a run checks prices and acts inside the limits. Each order and each fill posts to Discord.
  - After the close: the close-out run confirms nothing borrowed is held overnight beyond the limit, and posts a summary of the day.
- **What he checks.**
  - The end-of-day summary: trades, profit or loss, borrowing used, any refused orders.
  - That the heartbeat has been quiet (no missed-run alerts).
  - Weekly: the broker's own statement against the run log.
- **What he can change, and how.**
  - Limits (largest position, daily loss stop, maximum borrowing, trades a day): as values in a settings table, through the screen in the recommended setup, or by asking Claude Code to change them in the cheapest.
  - The rules themselves, or the Claude driver's instructions: only through a new Claude Code build piece, tested in practice mode first.
  - At Alpaca, the borrowing cap of 1, 2 or 4 in the account settings.[^22]
- **How he stops it.**
  - A stop typed in the stack's Discord command channel, or the off switch on the screen. Either sets a flag every run checks first, and the next run reads the stop even if it was sent while the stack slept.[^133]
  - At Alpaca, the "suspend_trade" switch blocks all new orders at the broker.[^22]
  - In any case, the broker's own app can cancel orders and close positions.
- **What alerts he gets, and how.**
  - Discord: every order and fill, every refused order, the daily summary, any error.
  - Healthchecks.io: an alert through Discord or Pushover when a run is missed.[^11][^132]
  - Users report that Discord can hold phone alerts while its desktop app is open. This is unconfirmed, so Michael tests it once and closes the desktop app during market hours if needed (run 4 deliverable, section 6, item 1).
  - Pushover (recommended setup): urgent alerts only, such as a daily loss stop or a margin warning.

**Pros.**

- No always-on part to keep alive. Each run starts fresh.
- The cheapest new spending of the four (20 dollars a month in the cheapest setup).
- Works with either driver without changing the design.
- Third under both drivers on this run's weights (4.00 and 3.35), 0.25 behind C. First or within 0.10 of first in 4 of 16 rankings, all of them weightings that raise operability (section 10).
- Built on the stack Michael already uses for Relii (noted, not scored).

**Cons.**

- Reacts at the next check, about a minute, not in seconds.
- A timed run that fails is not retried by the platform, as far as any page read says.[^33][^110]
- Learns that an order filled only by asking again.
- The wide screen at Tradier depends on an unpublished symbol limit.[^71]

**Failure mode: a missed minute at the wrong moment.** A timed run fails or starts late at the one moment an exit was due, and the next chance is a minute later. The heartbeat tells Michael, but after the fact. The damage is limited only if a stop was already sitting at the broker, so every entry should carry one (design choice).

### 9.2 Option C: always-on worker

**Key point: the fastest option, and the pick (corrected 2026-10-28). One program stays connected all session and reacts to prices in seconds, at the cost of a running part Michael cannot repair himself.**

**The architecture in plain English.**

- One program runs on a small rented server through market hours.
- It keeps a live connection open to the price feed and the broker, applies the decision to every price change, checks each order against fixed limits, sends it and records it.
- The server restarts the program automatically if it exits: Fly.io's "always" policy will "never let it enter a stopped state".[^111]
- A restart policy acts when the program exits. It does not catch a program that is still running but stuck (my reading of R3-S8). So the program pings a heartbeat service, which alerts Michael when the pings stop.[^11]
- Before the open, the same program screens the wide universe and builds the day's live list.

**Driver models in this option.**

- **Software as the driver.** Fixed rules act on each price change. Claude can still be asked questions about what happened, by reading the same database, as in option B.
- **Asking it something.** That route is Michael's own Claude Code session reading the database, not a part of the agent, so it adds no build piece. Options D and F list Claude's database access as a build piece because their research layer is part of the agent.
- **Claude as the driver.** When the rules flag a candidate, the program asks Claude through the API for a decision, then checks the limits and sends or refuses. Under an API key: the Commercial Terms and the Usage Policy.[^32][^52]

**Categories, candidates, coverage and cost bands.**

| Category | Candidates that fit | Band |
| :-- | :-- | :-- |
| Reasoning model | None, or the Claude API (estimates as option B)[^18] | 0, or 1 to 2 |
| Where it runs | Fly.io 256 MB at 2.19 a month, 1 GB at 6.70;[^16] DigitalOcean 4.00[^112] | 1 |
| Memory | A Supabase project (10),[^14] because a Fly machine's own disk is wiped on restart by default[^111] | 1 |
| Price data | A stream from the broker or the data plan: Tradier's stream handles "in excess of several hundred symbols", one stream at a time;[^71] Alpaca's plan has unlimited streaming symbols[^2] | 0 or 2 |
| Alerts and heartbeat | As option B[^10][^11] | 0 |
| Brokerage | Tradier or Alpaca | 0 to 1 |

- **Universe coverage:** as option B. The live list streams instead of being checked each minute.
- **Region.** Fly.io's 2.19 price is stated for its Ashburn and Secaucus regions only, and a U.S. West price was not shown.[^16] The database is in Oregon, so a worker in the East sits farther from it.
  - The worker keeps working state in memory and writes to the database after acting, so the distance should not slow an order (my inference, not measured).
  - The brokers' own server locations were not checked.

**Brokerage and order execution candidates.**

- Tradier and Alpaca, as option B.[^1][^6]
- An always-on program could also run Interactive Brokers' gateway program, but Interactive Brokers still fails on a sign-in that is about daily in practice and an unconfirmed day trading rule for a new account.[^92][^67]

**Account and regulatory rules that affect it.**

- As option B for the day trading rule, buying power checks and data licensing.
- A stuck worker matters more with borrowed money. Alpaca may sell holdings without reaching the customer,[^39] and a deficit must be met "as promptly as possible".[^56] Stops held at the broker limit this (design choice).[^29][^30]

**Scores against the criteria.**

| Criterion (weight) | Software driver | Claude driver | Basis |
| :-- | :-- | :-- | :-- |
| Execution speed and reliability (25) | 5 | 4 | Stays connected, acts in seconds, restarts on exit,[^111] an independent heartbeat catches a hang.[^11] Claude driver: a best-effort model call before each order[^41] |
| Unattended order path (15) | 4 | 3 | As option B |
| 5 minute target on consolidated data (15) | 5 | 5 | A live stream on consolidated data, seconds.[^71][^2] Claude driver: the model call adds seconds, inside the 5 minute target (section 6.1). Its reliability cost is counted under execution (corrected) |
| Operability (15) | 3 | 2 | One always-on part, restarted for him by the platform: the anchor for 3. Claude driver: a model service as well |
| Safety (10) | 4 | 3 | Fixed checks, stops at the broker, a heartbeat. Claude driver: a model chooses |
| Flexibility (10) | 5 | 5 | Both drivers, every run mode at 4 or 5 (corrected) |
| Cost (10) | 3 | 3 | Cheapest total 147.19 (software) or 151.69 (Claude) |
| **Weighted total** | **4.25** | **3.60** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 5 | Any interval (my inference: a running program keeps its own clock) |
| Event, callback | 4 | A running server can receive web requests (my inference) |
| Event, price event | 5 | Seconds. Its purpose |
| On demand | 5 | Ask Claude, which reads the database, as in option B (corrected). Discord commands could add a way to start a run (my judgment) |
| Memory kept across runs | 5 | The database |
| Each run independent | 4 | Possible by design, though a long-running program naturally carries state |

**Build estimate: Michael's hands-on hours.** Estimates, not measurements.

| Phase | What Michael does | Hours, software driver | Hours, Claude driver |
| :-- | :-- | :-- | :-- |
| 0. Decide and set up accounts | As option B, plus a Fly.io account (0.5) | 5.5 | 6.0 |
| 1. Build pieces | 9 pieces: database; broker connection in practice mode; the worker on Fly.io with its restart policy; the live stream with reconnection, plus the daily screen; decision rules (or the Claude step); limit checks and order sending; end-of-day close-out; alerts, heartbeat and Discord stop command; a rehearsal on a recorded day. Three touch money (2.5 each), six do not (1.5 each) | 16.5 | 17.5 |
| 2. Practice trading | As option B | 4.5 | 5.5 |
| 3. First live week | As option B | 3.0 | 3.0 |
| **Total** | | **29.5** | **32.0** |

- Upkeep after the build: about 2 hours a month (my estimate), mostly reading heartbeat alerts and asking Claude Code to diagnose a stuck worker.

**Example setup 1: cheapest workable.** An example, not a pick.

| Tool | Plan | What it does in this stack | Monthly price | Price label | Footnote |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Claude Max | Max 5x | Builds and maintains; answers questions. **Already paid** | 100.00 | Published | [^19] |
| Supabase | Pro organization | Holds the projects. **Already paid** | 25.00 | Published | [^105] |
| Supabase | Additional project, Micro compute | Memory: positions, limits, the run log | 10.00 | Published | [^14] |
| Fly.io | shared-cpu-1x, 256 MB, always on | Runs the worker all session | 2.19 | Published | [^16] |
| Tradier | Pro plan | Broker, broker-held stops, consolidated real-time data and stream included | 10.00 | Published | [^15][^13] |
| Discord | Free | Alerts, and a stop command | 0.00 | Published | [^131] |
| Healthchecks.io | Hobbyist | Heartbeat: alerts when the worker stops pinging | 0.00 | Published | [^11] |
| GitHub | Free | Stores the code. **Already paid (free tier)** | 0.00 | Published | [^12] |
| Claude API | Haiku 5.5 | **Claude driver only:** one decision call every 5 minutes | 4.50, estimate | Estimate on published prices | [^18][^44] |

- **Monthly total, software driver: 147.19 dollars.** New spending: 22.19.
- **Monthly total, Claude driver: 151.69 dollars (estimate).** New spending: 26.69, or 22.19 if the Max plan's API credit covers the calls.[^3][^48]
- Fly.io adds 0.02 dollars per gigabyte sent out.[^16]
- **Gap in this setup: the wide morning screen.** Tradier does not publish how many symbols one quote request may carry, and warns against "asking for an entire exchange's worth of symbols".[^71] The fallback, Alpaca's free prior-day history, needs an Alpaca account, and whether a data-only account is possible was not verified.[^2] So this setup meets the live-list requirement on published facts, and the wide screen only on a gentle test (my judgment).

**Example setup 2: recommended for speed and reliability.** An example, not a pick.

| Tool | Plan | What it does in this stack | Monthly price | Price label | Footnote |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Claude Max | Max 5x | Builds and maintains; answers questions. **Already paid** | 100.00 | Published | [^19] |
| Supabase | Pro organization | **Already paid** | 25.00 | Published | [^105] |
| Supabase | Additional project, Micro compute | Memory | 10.00 | Published | [^14] |
| Fly.io | shared-cpu-1x, 1 GB, always on | Runs the worker with memory headroom | 6.70 | Published | [^16] |
| Alpaca | Brokerage account | Broker, brackets and trailing stops held at the broker, a borrowing cap | 0.00 (no commission) | Published | [^95][^30][^22] |
| Alpaca | Algo Trader Plus | Consolidated real-time stream, unlimited symbols | 99.00 | Published | [^2] |
| Discord | Free | Alerts, and a stop command | 0.00 | Published | [^131] |
| Healthchecks.io | Hobbyist | Heartbeat | 0.00 | Published | [^11] |
| Pushover | Individual | Second alert route. 4.99 once per platform | 0.00 | Published | [^106] |
| GitHub | Free | **Already paid (free tier)** | 0.00 | Published | [^12] |
| Claude API | Sonnet 5.5 | **Claude driver only:** one decision call every 5 minutes | 90.00, estimate | Estimate on published prices | [^18][^44] |

- **Monthly total, software driver: 240.70 dollars.** New spending: 115.70.
- **Monthly total, Claude driver: 330.70 dollars (estimate).** New spending: 205.70, or 115.70 if the Max plan's API credit covers the calls.
- **Why these choices, for speed and reliability:** 1 GB gives the worker room to hold a stream and the live list without running out of memory (my judgment). Alpaca's unlimited streaming symbols remove Tradier's unpublished stream limit.[^71][^2] Both brokers' recent incidents are disclosed under option B.[^97][^109]

**How Michael uses it.**

- **A day with this stack.**
  - Before the open: the worker wakes, screens the universe, posts the live list to Discord.
  - During the session: nothing to do. The worker reacts to each price change within seconds and posts each order and fill.
  - After the close: the close-out step confirms positions are within the overnight limit, posts the day's summary, and the worker idles until the next morning.
- **What he checks.**
  - The daily summary and that the heartbeat stayed quiet.
  - Weekly: the broker's statement against the log.
  - Anything else, by asking Claude, which reads the run log and positions in the database, as in option B.
- **What he can change, and how.**
  - Limits: in a settings table, by asking Claude Code, or (if built) by a Discord command.
  - Rules or Claude's instructions: a new Claude Code build piece, tested in practice mode first.
  - At Alpaca, the borrowing cap of 1, 2 or 4.[^22]
- **How he stops it.**
  - A stop typed in the stack's Discord command channel, which the worker reads before every order.[^133]
  - At Alpaca, the "suspend_trade" switch.[^22] At either broker, the broker's own app.
  - Stopping the server itself from the Fly.io dashboard (my inference; not documented in the pages read).
- **What alerts he gets, and how.**
  - Discord: orders, fills, refusals, errors, the daily summary, a "stream reconnected" notice.
  - Healthchecks.io: an alert through Discord when the worker stops pinging, which is how a stuck worker shows up.[^11][^132]
  - As option B: test once whether Discord holds phone alerts while its desktop app is open.

**Pros.**

- The fastest reaction: seconds, not a minute.
- Restarts automatically if it exits.[^111]
- Second-lowest new spending in the cheapest setup.
- First under both drivers on this run's weights (4.25 and 3.60), and first or within 0.10 of first in all 16 rankings (section 10).
- Michael can ask it questions through Claude reading the database, as in option B.

**Cons.**

- A running part Michael cannot diagnose himself. Every stuck worker means a Claude Code session.
- A hang is not caught by the platform, only by the heartbeat (my reading of R3-S8).
- About twice B's upkeep: 2 hours a month against 1 (estimates).
- The cheapest server's price is stated for East coast regions only, away from the Oregon database.[^16]

**Failure mode: stuck, not stopped.** The program keeps running but stops acting, for example because a stream went quiet without an error. The platform does not restart it, because it never exited. The heartbeat alerts Michael within minutes, but he cannot tell what went wrong, and positions sit on whatever stops were already placed at the broker until a Claude Code session repairs it.

### 9.3 Option D: always-on worker plus Claude on top

**Key point: option C's speed with a Claude research layer on top. Second under both drivers (4.10 and 3.45): it matches C on every criterion except operability, where its extra layer costs a point. It leads only when a research layer is valued as a criterion of its own (corrected 2026-10-28).**

**The architecture in plain English.**

- **The worker** is option C's program. It stays connected, checks every order against fixed limits, and is the only part that talks to the broker.
- **Claude** is a separate research and explanation layer. Before the open, or when asked, it reads filings, news and the database, and writes research notes, the live list and settings back to the database. The worker acts only on what is in the database, and only inside its limits.
- In this design Claude never holds a broker connection (design choice).

**Driver models in this option.**

- **Software as the driver.** The worker's fixed rules choose trades. Claude's research layer writes the live list and settings each morning.
- **Claude as the driver, scored shape.** The worker calls Claude through the API for each decision, as in option C, with the research layer's notes as context.
- **Claude as the driver, second shape (described, not scored).** A separate Claude agent run writes trade intentions into the database, and the worker checks and sends them. On Managed Agents that run starts up to 15 percent of its interval late,[^40] and on the Max login it would fall under the Consumer Terms passage on securities.[^32][^50]

**Categories, candidates, coverage and cost bands.**

| Category | Candidates that fit | Band |
| :-- | :-- | :-- |
| Reasoning model | The research layer: Claude Code with an API key from the Console organization linked to the Max plan, paid from its 100 dollar monthly API credit,[^3] or Managed Agents (token prices plus 0.08 a session-hour).[^113] The Claude driver as option C | 0 to 2 |
| Where it runs | Worker as option C.[^16] Claude: `claude -p` under a scheduler,[^31] a routine started by a web request,[^114] or Managed Agents[^40] | 1 |
| Memory | One shared Supabase database, which both layers read and write[^14] | 1 |
| Price data | As option C | 0 or 2 |
| Research sources | SEC filings (free, but the SEC asks automated readers to identify themselves, so the future agent would have to send a contact name to sec.gov),[^115] Quiver from 30 a month,[^116] Firecrawl free tier[^117] | 0 to 2 |
| Alerts and heartbeat | As option C | 0 |
| Brokerage | As option C | 0 to 1 |

**Brokerage and order execution candidates.** As option C: Tradier or Alpaca.[^1][^6]

**Account and regulatory rules that affect it.**

- As option C for margin, the stuck-worker risk and data licensing.
- The research layer involves Claude in research about securities. On a key: the Commercial Terms and the Usage Policy, whose exclusions name research that is "not the ultimate High-risk AI Recommendation delivered".[^51] On the Max login: the Consumer Terms passage.[^50]
- Whether a setting Claude writes each morning is "a fixed rule" or a recommendation is not answered by the text (my reading).[^51]

**Scores against the criteria.**

| Criterion (weight) | Software driver | Claude driver | Basis |
| :-- | :-- | :-- | :-- |
| Execution speed and reliability (25) | 5 | 4 | As option C. The research layer is outside the order path |
| Unattended order path (15) | 4 | 3 | As option C |
| 5 minute target on consolidated data (15) | 5 | 5 | As option C (corrected) |
| Operability (15) | 2 | 1 | The most parts: a worker, a database, a Claude layer on its own schedule. Claude driver: a model in the order path as well |
| Safety (10) | 4 | 3 | As option C. The Claude layer adds explanation, not a fixed check |
| Flexibility (10) | 5 | 5 | Both drivers, every run mode at 4 or 5 |
| Cost (10) | 3 | 3 | Cheapest total 147.19 (software) or 151.69 (Claude) |
| **Weighted total** | **4.10** | **3.45** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 5 | The worker at any interval. Claude's research on its own schedule |
| Event, callback | 5 | The worker can receive a callback and can start a Claude routine with a web request, 30 an hour per routine[^114] |
| Event, price event | 5 | The worker, in seconds |
| On demand | 5 | Ask Claude, which reads the shared database |
| Memory kept across runs | 5 | The shared database |
| Each run independent | 4 | Claude's runs start empty. The worker carries state |

**Build estimate: Michael's hands-on hours.** Estimates, not measurements.

| Phase | What Michael does | Hours, software driver | Hours, Claude driver |
| :-- | :-- | :-- | :-- |
| 0. Decide and set up accounts | As option C, plus linking a Console organization to the Max plan for the research layer's API credit (0.5) | 6.0 | 6.0 |
| 1. Build pieces | Option C's 9, plus 2: the research run that writes the live list and settings, and read-only access for Claude to the database. Claude driver: the decision step touches money | 19.5 | 20.5 |
| 2. Practice trading | As option B | 4.5 | 5.5 |
| 3. First live week | As option B | 3.0 | 3.0 |
| **Total** | | **33.0** | **35.0** |

- Upkeep: about 3 hours a month (my estimate).

**Example setup 1: cheapest workable.** An example, not a pick.

| Tool | Plan | What it does in this stack | Monthly price | Price label | Footnote |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Claude Max | Max 5x | Builds and maintains; its 100 dollar monthly API credit pays for the research layer's runs through a key. **Already paid** | 100.00 | Published | [^19][^3] |
| Supabase | Pro organization | **Already paid** | 25.00 | Published | [^105] |
| Supabase | Additional project, Micro compute | Shared memory for both layers | 10.00 | Published | [^14] |
| Fly.io | shared-cpu-1x, 256 MB | The worker | 2.19 | Published | [^16] |
| Tradier | Pro plan | Broker and consolidated real-time data | 10.00 | Published | [^15][^13] |
| Discord | Free | Alerts, and a stop command | 0.00 | Published | [^131] |
| Healthchecks.io | Hobbyist | Heartbeat for the worker and for the research run | 0.00 | Published | [^11] |
| GitHub | Free | **Already paid (free tier)** | 0.00 | Published | [^12] |
| Claude API | Research layer runs, inside the Max credit | Morning research and the live list | 0.00 within the credit, estimate | Estimate | [^3] |
| Claude API | Haiku 5.5 | **Claude driver only:** one decision call every 5 minutes | 4.50, estimate | Estimate on published prices | [^18][^44] |

- **Monthly total, software driver: 147.19 dollars.** New spending: 22.19.
- **Monthly total, Claude driver: 151.69 dollars (estimate).** New spending: 26.69, or 22.19 if the credit covers both the research runs and the decisions.
- The research layer's monthly token use is not measured. That it fits inside 100 dollars is my estimate. One month of logged research runs would measure it.
- Which terms govern spending the credit is not stated (section 11).[^48]
- The same gap as option C's cheapest setup: the wide morning screen rests on an unpublished Tradier limit.[^71]

**Example setup 2: recommended for speed and reliability.** An example, not a pick. Option C's recommended setup (240.70 software, 330.70 Claude driver, estimate), with the research layer inside the Max credit, and Quiver's 30 dollar plan if Michael wants alternative data (not counted).[^116]

| Tool | Plan | What it does in this stack | Monthly price | Price label | Footnote |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Claude Max | Max 5x | Builds and maintains; API credit for research. **Already paid** | 100.00 | Published | [^19][^3] |
| Supabase | Pro organization | **Already paid** | 25.00 | Published | [^105] |
| Supabase | Additional project, Micro compute | Shared memory | 10.00 | Published | [^14] |
| Fly.io | shared-cpu-1x, 1 GB | The worker | 6.70 | Published | [^16] |
| Alpaca | Brokerage account | Broker, broker-held brackets and trailing stops, borrowing cap | 0.00 (no commission) | Published | [^95][^30][^22] |
| Alpaca | Algo Trader Plus | Consolidated real-time stream | 99.00 | Published | [^2] |
| Discord, Healthchecks.io, Pushover | As option C | Alerts and heartbeats | 0.00 | Published | [^131][^11][^106] |
| GitHub | Free | **Already paid (free tier)** | 0.00 | Published | [^12] |
| Claude API | Sonnet 5.5 | **Claude driver only:** one decision call every 5 minutes | 90.00, estimate | Estimate on published prices | [^18][^44] |

- **Monthly total, software driver: 240.70 dollars.** New spending: 115.70.
- **Monthly total, Claude driver: 330.70 dollars (estimate).** New spending: 205.70, or 115.70 if the credit covers the calls.

**How Michael uses it.**

- **A day with this stack.**
  - Before the open: the Claude research run reads filings and news, writes notes and the live list to the database, and posts a short briefing to Discord. The worker picks the list up.
  - During the session: nothing to do. The worker acts in seconds and posts each order and fill. Michael can ask Claude, at any time, "what did it do and why?"
  - After the close: the worker's close-out runs, and Claude can write a short review of the day.
- **What he checks.**
  - The morning briefing and the evening summary.
  - That both heartbeats stayed quiet: the worker's, and the research run's.
- **What he can change, and how.**
  - Limits, in the settings table or by asking Claude Code.
  - What the research layer looks at: its instructions file, changed through Claude Code.
  - The worker's rules: a new build piece, tested in practice mode.
- **How he stops it.**
  - A Discord stop command for the worker.[^133] Pausing the research layer's schedule stops the morning list.
  - At Alpaca, "suspend_trade".[^22] At either broker, the broker's own app.
- **What alerts he gets, and how.**
  - Discord: as option C, plus the morning briefing.
  - Healthchecks.io: a missing worker ping or a research run that did not report.

**Pros.**

- Second under both drivers (4.10 and 3.45), and first when a Claude research layer is valued at 10 (section 10).
- Seconds-level execution plus a research layer that writes the morning list and briefing.
- Either layer can be replaced without touching the other (my judgment).

**Cons.**

- The most parts, and the lowest operability score.
- Scores no higher than C on any criterion, and one point lower on operability.
- The longest build of the four (33 hours, estimate).
- Two layers can disagree, and someone has to decide which is right.
- Carries option C's stuck-worker risk.

**Failure mode: upkeep outruns the owner.** Each part works, but keeping a worker, a database, a research schedule and two heartbeats in step falls to one non-coder. A small break in one layer (a research run that silently writes yesterday's list, a worker that is stuck) is noticed late, because there is more to check every day than one person keeps checking.

### 9.4 Option F: scheduled core plus Claude on top

**Key point: run 2's pick, now last in both driver rankings. Option B already hosts either driver, so F's Claude layer adds research and a way to ask questions but no score, and costs a point of operability.**

**The architecture in plain English.**

- **The scheduled core** is option B: a timer in the database, short functions, fixed limits, and the only line to the broker.[^33]
- **Claude** is a separate research and explanation layer, exactly as in option D. Before the open it writes notes, the live list and settings to the database. It can be asked at any time what the core did and why.
- If a check every minute later proves too slow, the timer can be replaced by option C's worker, which turns F into D. The database, limits and Claude layer stay (my judgment).

**Driver models in this option.**

- **Software as the driver.** The core's fixed rules choose trades on the list and settings Claude wrote.
- **Claude as the driver, scored shape.** The core calls Claude through the API at each decision, as in option B, with the research notes as context.
- **Claude as the driver, second shape (described, not scored).** A separate Claude agent writes trade intentions, as in option D, with the same timing and terms caveats.[^40][^50]

**Categories, candidates, coverage and cost bands.**

| Category | Candidates that fit | Band |
| :-- | :-- | :-- |
| Reasoning model | Research layer as option D (the Max plan's API credit, or Managed Agents).[^3][^113] Claude driver as option B | 0 to 2 |
| Where it runs | Core as option B.[^33][^14] Claude as option D[^31][^114][^40] | 1 |
| Memory | One shared Supabase database | 1 |
| Price data | As option B[^13][^2] | 0 or 2 |
| Research sources | As option D[^115][^116][^117] | 0 to 2 |
| Alerts and heartbeat | As option B | 0 |
| Brokerage | As option B | 0 to 1 |

- **Universe coverage:** as option B. The research layer offers one more way to build the live list: Claude screens the wide universe before the open and hands the core a shorter list (my judgment).

**Brokerage and order execution candidates.** As option B: Tradier or Alpaca.[^1][^6]

**Account and regulatory rules that affect it.** As option B for margin, buying power, region pinning and data licensing. As option D for Anthropic's terms on the research layer.[^51][^50]

**Scores against the criteria.**

| Criterion (weight) | Software driver | Claude driver | Basis |
| :-- | :-- | :-- | :-- |
| Execution speed and reliability (25) | 4 | 3 | As option B |
| Unattended order path (15) | 4 | 3 | As option B |
| 5 minute target on consolidated data (15) | 4 | 4 | As option B |
| Operability (15) | 3 | 2 | More than two parts to keep in step, none always-on: the anchor for 3. One below B for the extra layer |
| Safety (10) | 4 | 3 | As option B. The Claude layer is not a fixed check |
| Flexibility (10) | 5 | 5 | Both drivers, every run mode at 4 or 5 |
| Cost (10) | 3 | 3 | Cheapest total 145.00 (software) or 149.50 (Claude) |
| **Weighted total** | **3.85** | **3.20** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 4 | The core every minute or faster. Claude on its own schedule |
| Event, callback | 5 | A function can be woken by a web request, and can start a Claude routine, 30 an hour per routine[^114] |
| Event, price event | 4 | The core notices at its next check, about a minute |
| On demand | 5 | Ask Claude, or open the screen |
| Memory kept across runs | 5 | The shared database |
| Each run independent | 5 | Each function run starts fresh, and Claude's runs start empty |

**Build estimate: Michael's hands-on hours.** Estimates, not measurements.

| Phase | What Michael does | Hours, software driver | Hours, Claude driver |
| :-- | :-- | :-- | :-- |
| 0. Decide and set up accounts | As option B, plus linking a Console organization to the Max plan (0.5) | 5.5 | 5.5 |
| 1. Build pieces | Option B's 8, plus the research run and Claude's read-only database access (1.5 each). The recommended setup adds a screen (1.5) | 18.0 (19.5 with the screen) | 19.0 (20.5) |
| 2. Practice trading | As option B | 4.5 | 5.5 |
| 3. First live week | As option B | 3.0 | 3.0 |
| **Total** | | **31.0 (32.5 with the screen)** | **33.0 (34.5)** |

- Upkeep: about 2 hours a month (my estimate).

**Example setup 1: cheapest workable.** An example, not a pick. Option B's cheapest setup plus the research layer inside the Max plan's API credit.

| Tool | Plan | What it does in this stack | Monthly price | Price label | Footnote |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Claude Max | Max 5x | Builds and maintains; its API credit pays for the research layer. **Already paid** | 100.00 | Published | [^19][^3] |
| Supabase | Pro organization | **Already paid** | 25.00 | Published | [^105] |
| Supabase | Additional project, Micro compute | Shared database, timer, functions | 10.00 | Published | [^14] |
| Tradier | Pro plan | Broker and consolidated real-time data | 10.00 | Published | [^15][^13] |
| Discord | Free | Alerts, briefing, stop command | 0.00 | Published | [^131] |
| Healthchecks.io | Hobbyist | Heartbeats for the core and the research run | 0.00 | Published | [^11] |
| GitHub | Free | **Already paid (free tier)** | 0.00 | Published | [^12] |
| Claude API | Research layer runs, inside the Max credit | Morning research and the live list | 0.00 within the credit, estimate | Estimate | [^3] |
| Claude API | Haiku 5.5 | **Claude driver only:** one decision call every 5 minutes | 4.50, estimate | Estimate on published prices | [^18][^44] |

- **Monthly total, software driver: 145.00 dollars.** New spending: 20.00.
- **Monthly total, Claude driver: 149.50 dollars (estimate).** New spending: 24.50, or 20.00 if the credit covers both.
- The same gap as option B's cheapest setup: the wide morning screen rests on an unpublished Tradier limit, unless the research layer screens it another way.[^71]

**Example setup 2: recommended for speed and reliability.** An example, not a pick. Option B's recommended setup plus the research layer inside the Max credit.

| Tool | Plan | What it does in this stack | Monthly price | Price label | Footnote |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Claude Max | Max 5x | Builds and maintains; API credit for research. **Already paid** | 100.00 | Published | [^19][^3] |
| Supabase | Pro organization | **Already paid** | 25.00 | Published | [^105] |
| Supabase | Additional project, Micro compute | Shared database, timer, functions | 10.00 | Published | [^14] |
| Vercel | Pro | Screen and off switch, pinned to Oregon | 20.00 | Published | [^17][^42] |
| Alpaca | Brokerage account | Broker, broker-held brackets and trailing stops, borrowing cap | 0.00 (no commission) | Published | [^95][^30][^22] |
| Alpaca | Algo Trader Plus | Consolidated real-time data | 99.00 | Published | [^2] |
| Discord, Healthchecks.io, Pushover | As option B | Alerts and heartbeats | 0.00 | Published | [^131][^11][^106] |
| GitHub | Free | **Already paid (free tier)** | 0.00 | Published | [^12] |
| Claude API | Sonnet 5.5 | **Claude driver only:** one decision call every 5 minutes | 90.00, estimate | Estimate on published prices | [^18][^44] |

- **Monthly total, software driver: 254.00 dollars.** New spending: 129.00.
- **Monthly total, Claude driver: 344.00 dollars (estimate).** New spending: 219.00, or 129.00 if the credit covers the calls.

**How Michael uses it.**

- **A day with this stack.**
  - Before the open: the research run writes notes and the live list, and posts a briefing to Discord.
  - During the session: nothing to do. Every minute the core checks the list and acts inside the limits. Orders and fills post to Discord.
  - After the close: the core's close-out run, and an optional Claude review of the day.
- **What he checks.** The briefing, the evening summary, the screen (recommended setup), and that the heartbeats stayed quiet.
- **What he can change, and how.**
  - Limits, on the screen or through Claude Code.
  - The research layer's instructions, through Claude Code.
  - The rules: a new build piece, tested in practice mode.
  - At Alpaca, the borrowing cap.[^22]
- **How he stops it.** The screen's off switch or a Discord command;[^133] pausing the research schedule; at Alpaca, "suspend_trade";[^22] the broker's own app.
- **What alerts he gets, and how.** As option B, plus the morning briefing.

**Pros.**

- No always-on part, and a research layer to ask questions of.
- Can be built in stages: the first stage is option B, useful alone (my judgment).
- Becomes option D by swapping the timer for a worker.

**Cons.**

- Last in both driver rankings on this run's weights.
- More parts than option B for no gain in score.
- Two layers can disagree.
- The terms questions apply to the research layer.[^50][^51]

**Failure mode: the Claude layer quietly becomes the trader.** Run 2's failure mode still applies. The rules start simple; then, because the morning research is good, more of each day's decisions arrive as "settings" Claude wrote: which names, which direction, what size. The core still checks limits but has become a relay for a model's choices, and the "qualified person" question has arrived without anyone deciding it should.[^4]

## 10. Comparison across the four options

**Key point: on this run's weights C is first under both drivers, 0.15 ahead of D and 0.25 ahead of B, which is outside the 0.10 tie rule. Across 16 rankings, C is first or within 0.10 of first in all 16 (corrected 2026-10-28).**

| | B: scheduled web app | C: always-on worker | D: worker plus Claude | F: scheduled core plus Claude |
| :-- | :-- | :-- | :-- | :-- |
| **Weighted total, software driver** | 4.00 | **4.25** | 4.10 | 3.85 |
| **Weighted total, Claude driver** | 3.35 | **3.60** | 3.45 | 3.20 |
| Average of the two | 3.68 | 3.93 | 3.78 | 3.53 |
| Execution speed and reliability (25) | 4 / 3 | 5 / 4 | 5 / 4 | 4 / 3 |
| Unattended order path (15) | 4 / 3 | 4 / 3 | 4 / 3 | 4 / 3 |
| 5 minute target, consolidated data (15) | 4 / 4 | 5 / 5 | 5 / 5 | 4 / 4 |
| Operability (15) | 4 / 3 | 3 / 2 | 2 / 1 | 3 / 2 |
| Safety (10) | 4 / 3 | 4 / 3 | 4 / 3 | 4 / 3 |
| Flexibility (10) | 5 | 5 | 5 | 5 |
| Cost (10) | 3 | 3 | 3 | 3 |
| Run mode: schedule | 4 | 5 | 5 | 4 |
| Run mode: event, callback | 4 | 4 | 5 | 5 |
| Run mode: event, price event | 4 | 5 | 5 | 4 |
| Run mode: on demand | 5 | 5 | 5 | 5 |
| Memory kept across runs | 5 | 5 | 5 | 5 |
| Each run independent | 5 | 4 | 4 | 5 |
| **Build hours, software driver (estimate)** | 27.5 (29.0 with screen) | 29.5 | 33.0 | 31.0 (32.5 with screen) |
| **Build hours, Claude driver (estimate)** | 30.0 (31.5) | 32.0 | 35.0 | 33.0 (34.5) |
| Upkeep a month (estimate) | About 1 hour | About 2 hours | About 3 hours | About 2 hours |
| **Cheapest workable, monthly total, software / Claude driver** | 145.00 / 149.50 | 147.19 / 151.69 | 147.19 / 151.69 | 145.00 / 149.50 |
| New spending in the cheapest setup, software driver | 20.00 | 22.19 | 22.19 | 20.00 |
| **Recommended, monthly total, software / Claude driver** | 254.00 / 344.00 | 240.70 / 330.70 | 240.70 / 330.70 | 254.00 / 344.00 |
| New spending in the recommended setup, software driver | 129.00 | 115.70 | 115.70 | 129.00 |
| How Claude drives (scored shape) | API call from the function, on a key | API call from the worker, on a key | API call from the worker, on a key; a separate agent is a second shape | API call from the function, on a key; a separate agent is a second shape |
| How software drives | Fixed rules in the function | Fixed rules in the worker | Fixed rules in the worker, on Claude's morning list | Fixed rules in the function, on Claude's morning list |
| Reacts to a price change in | About a minute | Seconds | Seconds | About a minute |
| Brokers that pass every gate | Tradier, Alpaca | Tradier, Alpaca | Tradier, Alpaca | Tradier, Alpaca |
| Failure mode in one line | A missed minute at the wrong moment | Stuck, not stopped | Upkeep outruns the owner | The Claude layer quietly becomes the trader |

Monthly totals count the Max plan (100) and Supabase Pro (25) at their real price, marked "already paid" in section 9. Claude driver totals are estimates. Scores are shown software / Claude where they differ.

**How sensitive the ranking is.** Every figure below was computed by a throwaway script that ranks all four options under both drivers (trajectory, decision D9).

| Weighting | Software driver, first to last | Claude driver, first to last |
| :-- | :-- | :-- |
| This run's weights | C 4.25, D 4.10, B 4.00, F 3.85 | C 3.60, D 3.45, B 3.35, F 3.20 |
| All seven criteria equal | C 4.14, then B and D 4.00, F 3.86 | C 3.57, then B and D 3.43, F 3.29 |
| Operability first (30), execution 15, target 10 | B 4.00, C 3.95, F 3.70, D 3.65 | B 3.30, C 3.25, F 3.00, D 2.95 |
| Execution cut to 15, operability raised to 25 | C 4.05, B 4.00, D 3.80, F 3.75 | C 3.40, B 3.35, D 3.15, F 3.10 |
| Close to run 2's weights (execution 10, path 20, flexibility 15) | C 4.16, B 4.05, D 4.00, F 3.89 | C 3.58, B 3.47, D 3.42, F 3.32 |
| A Claude research layer valued at 10 (others scaled down) | D 4.19, C 4.13, F 3.97, B 3.90 | D 3.61, C 3.54, F 3.38, B 3.32 |
| Execution raised to 35, operability cut to 5 | C 4.45, D 4.40, B 4.00, F 3.95 | C 3.80, D 3.75, B 3.35, F 3.30 |
| Target raised to 25, operability cut to 5 | C 4.45, D 4.40, B 4.00, F 3.95 | C 3.90, D 3.85, B 3.45, F 3.40 |

- In the research row, D and F score 5 on the added research criterion and B and C score 3, because only D and F have a research layer (my judgment). The other seven weights are scaled to 90.
- The last two rows mirror the two rows that weight operability up, so that execution and upkeep are each raised twice.
- **Robustness count,** across these 16 rankings, using the same 0.10 tie rule as the pick: C is first or within 0.10 of first in all 16, D in 6, B in 4, F in none. Counting exact first places only: C 12, B 2, D 2, F none, with no shared first places.
- C's worst showing is 0.07 behind first (research layer valued, Claude driver). B's worst is 0.45 behind (execution or target raised, Claude driver). D's worst is 0.35 behind (operability first).
- So C's lead does not depend on the weights chosen. Where C is not first, the leader is within 0.07 of it: B when operability is weighted first, D when a research layer is valued.
- Run 3's original count (B and D at 10 each) rested on C's mis-scored on-demand mode and Claude-driver target (correction, 2026-10-28). Its first draft had already been corrected once, for weightings that cut execution three times and raised it never (trajectory, decision D16).

## 11. Answers to the two Anthropic questions

**Key point: the texts open the door to a pay-as-you-go account and say nothing about securities, but they leave the two decisive questions open. Only Anthropic can settle those in writing.**

These answers quote Anthropic's own pages, read on 2026-10-13. They do not interpret the law, and they do not predict how Anthropic would rule. Quotation marks in Anthropic's pages are curly and are shown straight here.

### 11.1 Question 1: opening and using a pay-as-you-go API account

**What it takes to open one.**

| Step | What Anthropic's pages say |
| :-- | :-- |
| Who the contract is with | The Commercial Terms are "an agreement between Anthropic and you or the organization, company, or other entity that you represent ("Customer")".[^52] They govern "Customer's use of Anthropic API keys".[^52] |
| Business or personal | The same terms say "Services under these Terms are not for consumer use. Our consumer offerings (e.g., Claude.ai) are governed by our Consumer Terms of Service instead."[^4] "Consumer use" is not defined.[^52] No page read says only businesses may sign up, and none says individuals may.[^118] |
| Signup | An organization fills out "some additional information about your organization and use case", enters payment details, then adds prepaid credits.[^118] A Claude account needs a phone number from a supported location that can receive a text message.[^118] Anthropic may ask "to verify Customer's identity".[^52] A photo ID check exists for some use cases.[^119] |
| Where | The United States is a supported region.[^120] |
| Billing | Prepaid credits, available at once, non-refundable, expiring one year after purchase. Optional auto-reload. Monthly invoicing only through sales. Calls stop when credits run out.[^121] |
| Limits for a new account | No deposit moves an account up a tier: "There's no deposit or purchase that moves you up".[^122] New organizations "may start in the Evaluation tier", whose numbers are not published.[^46] The lowest standard tier (Start) allows 1,000 requests, 2,000,000 input tokens and 400,000 output tokens a minute for each of Opus 5.5, Sonnet 5.5 and Haiku 5.5,[^123] and a spend cap of 500 dollars a month, after which the API refuses calls until the 1st of the next month.[^46] |
| Prices | Per million tokens, input and output: Opus 5.5 4 and 20, Sonnet 5.5 2 and 10, Haiku 5.5 0.10 and 0.50. Batch is half price but not instant.[^44][^113] |
| The Max plan's credit | Michael's 100 dollar Max tier (Max 5x) includes 100 dollars a month of API credit, claimed by linking one Console organization after seven days on the plan.[^3] It covers the API, Managed Agents and the Agent SDK, and covers `claude -p` only "when you run them yourself with an API key from your linked Claude Console organization".[^3] It does not cover interactive Claude Code, and unused credit does not roll over.[^3] No page says which terms govern spending it.[^48] |

**How that account would enable using Claude to identify and execute trades.**

- The Commercial Terms contain no passage on securities, trading, investing, brokers or advice. The words return no hits.[^49] The Consumer Terms passage that names buying and selling securities is not in them.[^49]
- The Service Specific Terms, which the Commercial Terms bring in, also return no hits for those words.[^124]
- A program can call the API unattended, with an API key, at a rate far above what a trading agent needs at the Start tier (my arithmetic from the limits above).[^123]

**How it would limit it.**

- **The Usage Policy applies under the Commercial Terms too.** The terms bring it in by reference.[^52] Its finance rules are in question 2 below.
- **"Not for consumer use".** Whether an individual's own investing is "consumer use" is not defined.[^52] Only Anthropic can say.
- **Reliability is best effort.** The API documents an "overloaded" error that "can occur when the API experiences high traffic across all users", and the standard tier is "best-effort availability".[^41]
  - The paid Priority Tier is "no longer available for purchase".[^41] The terms give no uptime commitment and provide the service "AS IS".[^52]
  - The status page listed up to seven incidents between September 29 and October 13, 2026.[^125]
- **The spend cap can stop an order path.** At the Start tier's 500 dollar cap the API refuses calls until the 1st of the next month.[^46]
- **The agents article.** Anthropic's help article on agents lists "unauthorized, illegal, or fraudulent financial transactions (such as brokerage or investment advisory activities)" under "Do Not Use Agents for Unauthorized System Access or Manipulation".[^126] It does not say whether lawful trades in the user's own account are inside or outside that example.[^126]
- **The same use on the Max plan sits under different terms.** Claude Code is under the Consumer Terms "for Free, Pro, and Max users".[^32] Those terms still bar using the service "To rely upon the Services, the Materials, or the Actions to buy or sell securities or to provide or receive advice about securities, commodities, derivatives, or other financial products or services, as Anthropic is not a broker-dealer or a registered investment adviser under the securities laws of the United States or any other jurisdiction."[^50]

### 11.2 Question 2: the "qualified person"

**The Commercial Terms do not use the words "qualified person" or "qualified professional" at all.** The word "qualified" has no hits.[^49][^4] The requirement lives in the Usage Policy, which has two versions.

| | Usage Policy in force today (effective September 15, 2025) | Usage Policy effective November 12, 2026 |
| :-- | :-- | :-- |
| Scope | Finance is a high-risk use case, described as "financial decisions, including investment advice", in requirements for "specific consumer-facing use cases"[^127] | Covers "a personalized recommendation to buy, sell, hold, or allocate among specific investment products, such as securities, funds, digital assets, or annuities"[^4] |
| Who must review | "a qualified professional in that field must review the content or decision prior to dissemination or finalization"[^127] | "A qualified person must meaningfully review a High-risk AI Recommendation, with the authority to change or modify it, before it is delivered as advice to an individual who might rely on it or before it is used to implement a decision."[^4] |
| Definition | None. "Qualified professional" is not defined[^127] | "A qualified person is someone with the training or experience to evaluate the output in that field, and who holds a license where applicable law requires one for the underlying activity. The qualified person remains responsible for the accuracy and appropriateness of what is delivered or decided."[^4] |
| Exclusions | None listed[^127] | Six listed, introduced as non-exhaustive.[^51] Two bear on this project: "Internal drafting, research, summarization, or analysis that is not the ultimate High-risk AI Recommendation delivered", and "Carrying out a decision a person has already made, or applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual."[^51][^4] |
| Agents | Users are responsible for agents they build or deploy[^128] | "Users are responsible for ensuring that agents they build or deploy, including actions those agents take through tools, browsers, or connected systems, comply with this Usage Policy."[^129] |

**What the texts say about whether the account owner can be the qualified person: nothing.**

- A word search of both Usage Policy versions, the Commercial Terms and Anthropic's October 8, 2026 news post finds no "account owner", "own account", "self-directed", "personal use" or "yourself".[^5]
- No text says whether the user who builds the agent, "an individual who might rely on it" and the "qualified person" can be one and the same person.[^5]
- The news post says the high-risk requirements "haven't changed" and does not address this point.[^9]
- The definition has two parts: "training or experience to evaluate the output in that field", and a license "where applicable law requires one for the underlying activity".[^4] This run does not interpret whether any law requires a license for trading one's own account.

### 11.3 What only Anthropic can settle in writing

Each is a yes or no question Michael could send to Anthropic. The texts read leave every one open.[^5]

1. Is an individual using an API key for his own investing engaged in "consumer use" under the Commercial Terms?[^52]
2. Which terms govern spending the Max plan's monthly API credit?[^48]
3. Can the user who builds the agent also be "an individual who might rely on it" and the "qualified person" who reviews it?[^4]
4. Is there a minimum "training or experience" for a finance recommendation, and does a license apply to deciding trades in one's own account?[^4]
5. When an agent places an order in the user's own account, is the model's output "used to implement a decision", so that review must come first?[^4]
6. If fixed code applies the rules and the model only researches, does the "fixed rule, formula, or algorithm" exclusion apply?[^51]
7. Does the "research ... not the ultimate High-risk AI Recommendation" exclusion cover research the model hands to fixed code or to Michael, who then decides?[^51]
8. Until November 12, 2026, does "specific consumer-facing use cases" cover a person's own use for his own investments?[^127]
9. Does "unauthorized" in the agents article leave lawful trades in the user's own account outside that example?[^126]
10. Does the Consumer Terms securities passage apply to Claude Code or `claude -p` run on a Max login when the code it writes places trades?[^50][^32]
11. What are the Evaluation tier's limits for a new organization?[^46]
12. Does the Max plan's advertised "priority access" apply to API calls paid with the Max credit?[^130]

## 12. Falsifiability: what would overturn the pick

**Key point: option C is the pick only while the evidence below holds. Each item names specific evidence and what the pick becomes, using the same 0.10 tie rule as the pick. Every item was re-ranked across all four options and both drivers by script (re-run for the correction of 2026-10-28).**

1. **A timer fires reliably every minute.** This is B's weakest link, and it is not measured.
   - The test: a do-nothing scheduled job on Supabase that fetches the live list every minute for two weeks of sessions, logging how late each run starts and how many are missed.
   - The evidence: more than one run in a hundred missed, or more than 30 seconds late. B's and F's execution scores then fall by one.
   - Re-ranked: software C 4.25, D 4.10, B 3.75. Claude C 3.60, D 3.45, B 3.10.
   - **The pick stays C, and B falls further behind.** This trial matters again only if item 7 brings B back, and it is what turns "about a minute" into a measurement.
2. **A minute is fast enough.**
   - The evidence: a month of practice signals, logged with the price at the signal and at the next whole minute, showing a material difference. B's and F's target scores fall to 3.
   - Re-ranked: software C 4.25, D 4.10, B 3.85. Claude C 3.60, D 3.45, B 3.20.
   - **The pick stays C.** This evidence would only widen its lead.
3. **Morning research by Claude stays optional.**
   - The evidence that overturns: Michael says a Claude research layer is a must, worth 10 of 100.
   - Re-ranked: D first under both drivers (4.19 and 3.61), with C within 0.10 under both (4.13 and 3.54).
   - **The pick becomes D, tied with C.**
4. **The driver stays open, or Claude stays possible.**
   - The evidence: Michael decides on software only, so flexibility no longer earns points. Re-ranked: software C 4.17, D 4.00, B 3.89.
   - Or Anthropic says in writing that Claude may neither drive nor research for his own account. Every option drops to one driver: C 4.05, D 3.90, B 3.80.
   - **The pick stays C either way.** The driver no longer decides between the options.
5. **C is easy to ask through Claude.** Rewritten in the correction of 2026-10-28, because run 3's version ("C stays hard to ask") assumed the score this correction removed.
   - C's on-demand score of 5, and so its flexibility of 5, rests on Michael asking his own Claude Code session, which reads the database, as in option B.
   - The evidence that overturns: a month of use shows that is not enough, because he needs to ask the running worker itself or start a run on demand, and no command interface is built. C's on-demand score and flexibility fall back to 3.
   - Re-ranked: software D 4.10, C 4.05, B 4.00. Claude D 3.45, C 3.40, B 3.35.
   - **The pick becomes a three-way tie of D, C and B** under both drivers. Run 3's original tie-break judgment, B, would then apply again.
6. **A non-coder finds hosted code manageable.** Rewritten in the correction of 2026-10-28: run 3 lowered only B, but every option runs hosted code.
   - The evidence: running hosted code (B's and F's functions and timer, C's and D's worker, every option's database) proves harder than expected. Every option's operability falls by one, except D's under the Claude driver, which is already 1, the lowest score.
   - Re-ranked: software C 4.10, D 3.95, B 3.85. Claude C 3.45, D 3.45, B 3.20.
   - **The pick stays C under the software driver, and ties with D under the Claude driver.** D catches up only because its score cannot fall below 1.
7. **A worker stays healthy.** This is now the test that matters most.
   - The evidence that overturns: a two-week trial of a do-nothing worker under C shows a hang the heartbeat did not catch, or one Michael could not resolve without a Claude Code session. C's and D's execution, operability and safety fall by one.
   - Re-ranked: software B 4.00, F 3.85, C 3.75, D 3.60. Claude B 3.35, F 3.20, C 3.10, D 3.10.
   - **The pick becomes B**, clearly under both drivers. It is the cheapest measurement that could overturn the pick, so it is the one to run first (my judgment).
8. **Anthropic's answers.**
   - If Anthropic confirms the owner can be the "qualified person" and a model may choose trades inside owner-set limits on a key, every Claude driver path score rises to 4.
   - Re-ranked: Claude C 3.75, D 3.60, B 3.50. The pick is unchanged.
   - If it says no, see item 4.
9. **Program use of the data is affordable.**
   - The evidence that overturns: Tradier, Alpaca or the exchanges confirm that a personal program's use of real-time data is "non-display use" priced in band 4. Every option's cost falls to 1.
   - Re-ranked: software C 4.05, D 3.90, B 3.80. Claude C 3.40, D 3.25. No new winner, because the cost falls on all four.
   - My judgment: **the architecture stands and the data category narrows.**
10. **At least one broker keeps passing.**
    - The path score of 4 assumes Tradier or Alpaca.
    - The evidence that overturns: both fail a gate, for example an Alpaca data agreement forbidding program use plus a Tradier symbol limit too small for the live list. Every path score falls by one (4 to 3 under the software driver, 3 to 2 under the Claude driver), and every total by 0.15.
    - The order does not change, but the near-miss brokers in section 7.4 would need their data confirmed.

**Full re-rankings, by item.** Each row applies that item's score changes and ranks all four options. Computed by the same script as section 10.

| Item | Software driver, first to last | Claude driver, first to last |
| :-- | :-- | :-- |
| 1. A timer fires reliably every minute | C 4.25, D 4.10, B 3.75, F 3.60 | C 3.60, D 3.45, B 3.10, F 2.95 |
| 2. A minute is fast enough | C 4.25, D 4.10, B 3.85, F 3.70 | C 3.60, D 3.45, B 3.20, F 3.05 |
| 3. Morning research by Claude stays optional | D 4.19, C 4.13, F 3.97, B 3.90 | D 3.61, C 3.54, F 3.38, B 3.32 |
| 4. The driver stays open (software only, flexibility not weighted) | C 4.17, D 4.00, B 3.89, F 3.72 | C 3.44, D 3.28, B 3.17, F 3.00 |
| 5. C is easy to ask through Claude | D 4.10, C 4.05, B 4.00, F 3.85 | D 3.45, C 3.40, B 3.35, F 3.20 |
| 6. A non-coder finds hosted code manageable | C 4.10, D 3.95, B 3.85, F 3.70 | C 3.45, D 3.45, B 3.20, F 3.05 |
| 7. A worker stays healthy | B 4.00, F 3.85, C 3.75, D 3.60 | B 3.35, F 3.20, C 3.10, D 3.10 |
| 8. Anthropic's answers (yes) | C 4.25, D 4.10, B 4.00, F 3.85 | C 3.75, D 3.60, B 3.50, F 3.35 |
| 9. Program use of the data is affordable | C 4.05, D 3.90, B 3.80, F 3.65 | C 3.40, D 3.25, B 3.15, F 3.00 |
| 10. At least one broker keeps passing | C 4.10, D 3.95, B 3.85, F 3.70 | C 3.45, D 3.30, B 3.20, F 3.05 |

**What would not overturn it:** a lower price from one data vendor, a new connector in Anthropic's directory, or a third broker confirming consolidated data. Those change which candidates fit, not which architecture is strongest.

## 13. Open questions the research could not settle

**Key point: four questions are Michael's to decide, and the rest go to Anthropic, the chosen broker, and Supabase.**

**For Michael to decide.**

1. **Which driver, or both?** It no longer decides the pick, because C is first under both (section 12, item 4). It still decides the build hours, the monthly cost and which Anthropic terms apply.
2. **Is a Claude research layer a must?** If yes, D ties with C (section 12, item 3).
3. **May the wide daily screen use the prior day's prices?** This run reads it that way. If the screen must use real-time data too, Tradier's unpublished per-request limit matters, and Alpaca's 99 dollar plan becomes the safer data source.[^71][^2]
4. **Tradier or Alpaca?** Tradier is cheaper (data included) but has no borrowing cap Michael can set and no trailing stop.[^13][^24][^29] Alpaca costs 99 a month for data, but has the cap, trailing stops and the lower margin rate.[^22][^30][^97]
5. **What borrowing limit on day one?** At Alpaca a setting of 1 means no borrowing at all.[^22] At Tradier the limit lives in the agent's code only.[^24]
6. **Is the Supabase tier in this repo's `CLAUDE.md` still right?** It says sib-tech uses Relii's "nano" tier.
   - Supabase says "You cannot launch Nano instances on paid plans" and bills Nano at the Micro price in paid organizations, about 10 dollars a month.[^14]
   - This run did not edit `CLAUDE.md`. The correction of 2026-10-28 changed it to Micro compute in `us-west-2` (Oregon), as that correction's brief asked.

**For Anthropic, in writing.** The twelve questions in section 11.3. The three that decide the most: whether Michael can be the "qualified person" for his own account; whether an order placed by an agent is "used to implement a decision"; and which terms govern spending the Max plan's API credit.[^4][^48]

**For the chosen broker.**

7. **Tradier:** the maximum number of symbols per quote request, and whether its "personal use only" interface license lets a customer's own program use the consolidated data with no person watching.[^71][^1]
8. **Alpaca:** whether its data agreement allows a customer's own program to use the data; whether a new account under 25,000 dollars gets the 4 times intraday class by default;[^27] whether an individual can get a key that trades but cannot change the borrowing cap;[^96] whether "commission free" applies to margin accounts as written for cash accounts.[^95]
9. **tastytrade, TradeStation, Public:** whether their interface data is consolidated. A yes would add a third passing broker.[^78][^79][^80]
10. **Interactive Brokers:** which rule a new margin account under 25,000 dollars gets.[^67]

**Not verified in this run, worth a short follow-up before choosing a provider.**

- The two Interactive Brokers data prices disagree: 4.50 a month in one finding, a 10 dollar bundle plus 4.50 in another.[^73][^74]
- Whether same-day borrowing is free at Tradier, Schwab and Interactive Brokers is inferred from their wording, not stated.[^43][^101][^102]
- Fly.io's price for a U.S. West region was not shown.[^16]
- How long a Claude API call takes, and how much a research run uses in tokens. Both are unmeasured.
- The Evaluation tier's limits for a new Anthropic organization are not published.[^46]

## 14. Sources

133 sources. 96 were opened in run 3 (dated 2026-10-13), three were added by run 4 (131 to 133, dated 2026-10-28), and 34 are reused from runs 1 and 2 with their original access dates and labels, as the brief allows.

Strength labels and price labels are defined in section 5. The register ID at the end of each entry points to the fuller note, with a quote, in the named file.

[^1]: "What are the Pattern Day Trading rules that apply to margin accounts?" (Tradier support), "FAQ" and "Market Data" (Tradier API docs), main-session check. https://support.tradier.com/kb/guide/en/general-trading-faq-QgwvDZHiwB/Steps/4532869 . Accessed 2026-10-13. Strength A. Register ID R3-S11 in `runs/run-3-trajectory.md`.
[^2]: "About Market Data API" (Alpaca docs); "Market Data Terms of Service" (Massive); "Compute and Disk" (Supabase docs), main-session check. https://docs.alpaca.markets/docs/about-market-data-api.md . Accessed 2026-10-13. Strength A. Price label: published. Register ID R3-S10 in `runs/run-3-trajectory.md`.
[^3]: Monthly API credits for Max and Team plans (Claude Help Center). https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans . Accessed 2026-10-13. Strength A. Price label: published. Register ID AN-18 in `runs/run-3-notes-anthropic.md`.
[^4]: "Usage Policy" (Anthropic, effective November 12, 2026) and "Commercial Terms of Service" (Anthropic), main-session check. https://www.anthropic.com/legal/aup . Accessed 2026-10-13. Strength A. Register ID R3-S9 in `runs/run-3-trajectory.md`.
[^5]: Word searches of both Usage Policy versions, the Commercial Terms and Anthropic's October 8, 2026 news post: what the texts do not say. https://www.anthropic.com/legal/aup . Accessed 2026-10-13. Strength A. Register ID AN-35 in `runs/run-3-notes-anthropic.md`.
[^6]: "About Market Data API" (updatedAt 2026-10-06), "Market Data FAQ", "Snapshots" reference (Alpaca docs). https://docs.alpaca.markets/us/docs/about-market-data-api.md . Accessed 2026-10-13. Strength A. Price label: published. Register ID BK-17 in `runs/run-3-notes-brokers.md`.
[^7]: "Market Data API Overview" (Webull developer docs) and "Open API" (Webull). https://developer.webull.com/apis/docs/market-data-api/overview/ . Accessed 2026-10-13. Strength A. Price label: published as "Free Level 1" on the marketing page; subscription screen gated and unverified (login). Register ID BK-34 in `runs/run-3-notes-brokers.md`.
[^8]: "Authorities and Quota" (moomoo API docs). https://openapi.moomoo.com/moomoo-api-doc/en/intro/authority.html . Accessed 2026-10-13. Strength A. Register ID BK-40 in `runs/run-3-notes-brokers.md`.
[^9]: 2026 Usage Policy update (Anthropic news, dated Oct 8, 2026). https://www.anthropic.com/news/2026-usage-policy-update . Accessed 2026-10-13. Strength A. Register ID AN-31 in `runs/run-3-notes-anthropic.md`.
[^10]: Telegram Bot Platform; Bots FAQ. https://core.telegram.org/bots . Accessed 2026-10-13. Strength A. Price label: published (free). Register ID PX-31 in `runs/run-3-notes-prices.md`. No longer cited: run 4 replaced Telegram with Discord (see the Update, run 4 block at the top).
[^11]: Plans and Pricing - Healthchecks.io; Healthchecks.io home page. https://healthchecks.io/pricing/ . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-37 in `runs/run-3-notes-prices.md`.
[^12]: "Pricing" (GitHub). https://github.com/pricing . Accessed 2026-10-13. Strength A. Price label: published. Register ID R3-S13 in `runs/run-3-trajectory.md`.
[^13]: "Market Data" (Tradier API docs, updatedAt 2026-02-05) and "FAQ" (Tradier API docs). https://docs.tradier.com/docs/market-data.md . Accessed 2026-10-13. Strength A. Price label: published (included with the account; no data fee is named on the docs pages or the pricing page). Register ID BK-04 in `runs/run-3-notes-brokers.md`.
[^14]: Compute and Disk (Supabase docs, `.md`); Manage Compute usage (Supabase docs, `.md`). https://supabase.com/docs/guides/platform/compute-and-disk.md . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-18 in `runs/run-3-notes-prices.md`.
[^15]: "Pricing & Plans" (Tradier). https://tradier.com/individuals/pricing . Accessed 2026-10-13. Strength A. Price label: published. Register ID R3-S2 in `runs/run-3-trajectory.md`.
[^16]: Fly.io Resource Pricing (docs, `.md`). https://fly.io/docs/about/pricing.md . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-24 in `runs/run-3-notes-prices.md`.
[^17]: Vercel Pricing: Hobby, Pro, and Enterprise plans; Fair use guidelines (Vercel docs, `.md`); Vercel Hobby Plan (`.md`); Vercel Pro Plan (`.md`). https://vercel.com/pricing . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-20 in `runs/run-3-notes-prices.md`.
[^18]: Estimate in the helper notes: monthly model cost at a 5 minute cadence, built on the prices in finding DC-35 (Anthropic pricing page, https://platform.claude.com/docs/en/about-claude/pricing ). no single address, see the finding . Accessed 2026-10-09. Strength A (an estimate, not a price). Register ID DC-37 in `runs/run-2-notes-data-cadence.md`.
[^19]: "What is the Max plan?" (Claude Help Center, "Updated today"); Pricing (claude.com). https://support.claude.com/en/articles/11049741-what-is-the-max-plan . Accessed 2026-10-13. Strength A. Price label: published. Register ID AN-30 in `runs/run-3-notes-anthropic.md`.
[^20]: Pricing | Databento. https://databento.com/pricing . Accessed 2026-10-13. Strength A. Price label: published (read via fetch tool; `curl` blocked). Register ID PX-07 in `runs/run-3-notes-prices.md`.
[^21]: Twelve Data pricing (Personal use tab, rendered text and the page's own tier data). https://twelvedata.com/pricing . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-10 in `runs/run-3-notes-prices.md`.
[^22]: "Account Configurations" (Alpaca Trading API reference, updatedAt 2026-05-27). https://docs.alpaca.markets/us/reference/patchaccountconfig-1.md . Accessed 2026-10-13. Strength A. Register ID BK-15 in `runs/run-3-notes-brokers.md`.
[^23]: "How do I disable Margin investing?" (Public help center). https://help.public.com/en/articles/10151908-how-do-i-disable-margin-investing . Accessed 2026-10-13. Strength A. Register ID BK-36 in `runs/run-3-notes-brokers.md`.
[^24]: web search result summaries only (no page opened for this negative finding). no single address, see the finding . Accessed 2026-10-13. Strength D. Register ID BK-37 in `runs/run-3-notes-brokers.md`.
[^25]: Derivation in the helper notes: intraday and overnight multiples for a long-only margin account, built on findings MB-02, MB-12 and MB-13. no single address, see the finding . Accessed 2026-10-09. Strength A (arithmetic on strength A sources). Register ID MB-14 in `runs/run-2-notes-margin-brokers.md`.
[^26]: "Dan, where's the cash-only account option?" (Alpaca community forum; staff member Dan_Whitnable_Alpaca, posts dated January 26 and 30, 2026). https://forum.alpaca.markets/t/dan-wheres-the-cash-only-account-option/18353 . Accessed 2026-10-08. Strength D. Register ID BR-17 in `runs/run-1-notes-brokers-regulation.md`.
[^27]: "Trading Account" (Alpaca docs, updatedAt 2026-07-07). https://docs.alpaca.markets/us/docs/account-plans.md . Accessed 2026-10-13. Strength A. Register ID BK-42 in `runs/run-3-notes-brokers.md`.
[^28]: "What are the Pattern Day Trading rules that apply to margin accounts?" (Tradier support, General Trading FAQ). https://support.tradier.com/kb/guide/en/general-trading-faq-QgwvDZHiwB/Steps/4532869 . Accessed 2026-10-13. Strength A. Register ID BK-01 in `runs/run-3-notes-brokers.md`.
[^29]: "Advanced Orders" (updatedAt 2025-08-07) and "Place Order" (Tradier API reference). https://docs.tradier.com/reference/advanced-orders.md . Accessed 2026-10-13. Strength A. Register ID BK-06 in `runs/run-3-notes-brokers.md`.
[^30]: "Is there a usage limit for the number of API calls per second?" and "What flags an account as non-retail" (Alpaca support, the first dated December 2022); "Placing Orders" (Alpaca docs, updatedAt 2026-08-10). https://alpaca.markets/support/usage-limit-api-calls . Accessed 2026-10-13. Strength A. Register ID BK-18 in `runs/run-3-notes-brokers.md`.
[^31]: "Use the Claude Agent SDK with your Claude plan" (Claude Help Center, "Updated yesterday"). https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan . Accessed 2026-10-09. Strength A. Register ID DC-28 in `runs/run-2-notes-data-cadence.md`.
[^32]: Legal and compliance (Claude Code docs). https://code.claude.com/docs/en/legal-and-compliance.md . Accessed 2026-10-13. Strength A. Register ID AN-17 in `runs/run-3-notes-anthropic.md`.
[^33]: "Cron" (Supabase docs). https://supabase.com/docs/guides/cron.md . Accessed 2026-10-13. Strength A. Register ID R3-S5 in `runs/run-3-trajectory.md`.
[^34]: "CTA Market Data Non-Display Use Policy" (CTA Plan, dated 1 Nov 2015, 2 pages). https://www.ctaplan.com/publicdocs/ctaplan/Policy_CTA_Non_Display_with_FAQ.pdf . Accessed 2026-10-09. Strength A. Register ID DC-71 in `runs/run-2-notes-data-cadence.md`.
[^35]: "Limits" (Supabase Edge Functions docs). https://supabase.com/docs/guides/functions/limits.md . Accessed 2026-10-13. Strength A. Register ID R3-S6 in `runs/run-3-trajectory.md`.
[^36]: "Regulatory Notice 26-10: FINRA Adopts New Intraday Margin Standards to Replace the Day Trading Margin Requirements" (FINRA). https://www.finra.org/rules-guidance/notices/26-10 . Accessed 2026-10-08. Strength A. Register ID T22 in `runs/run-1-trajectory.md`.
[^37]: "Regulatory Notice 26-10, Attachment A" (FINRA, the deleted day trading text), and the SEC approval order (Federal Register, April 17, 2026). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-10 in `runs/run-2-notes-margin-brokers.md`.
[^38]: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-11 in `runs/run-2-notes-margin-brokers.md`.
[^39]: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17). https://docs.alpaca.markets/us/docs/margin-and-short-selling . Accessed 2026-10-09. Strength A. Register ID MB-27 in `runs/run-2-notes-margin-brokers.md`.
[^40]: "Scheduled deployments" (Claude Platform docs, status beta). https://platform.claude.com/docs/en/managed-agents/scheduled-deployments.md . Accessed 2026-10-09. Strength A. Register ID DC-30 in `runs/run-2-notes-data-cadence.md`.
[^41]: Errors (Claude Platform docs); Service tiers (Claude Platform docs). https://platform.claude.com/docs/en/api/errors.md . Accessed 2026-10-13. Strength A. Register ID AN-24 in `runs/run-3-notes-anthropic.md`.
[^42]: Usage & Pricing for Cron Jobs; Vercel Functions Limitations; Configuring regions for Vercel Functions (Vercel docs, `.md`). https://vercel.com/docs/cron-jobs/usage-and-pricing.md . Accessed 2026-10-13. Strength A. Register ID PX-21 in `runs/run-3-notes-prices.md`.
[^43]: "Margin Disclosure Statement" (Tradier Brokerage, PDF dated 01/13/2023 in its file name, linked from the help center's "Account Disclosures" guide, updated September 29, 2026). https://s3.amazonaws.com/documents.tradierbrokerage.com/apex/tbi_margin_disclosure_statement-01132023.pdf . Accessed 2026-10-13. Strength A. Register ID BK-09 in `runs/run-3-notes-brokers.md`.
[^44]: Pricing (Claude Platform docs); Models overview (Claude Platform docs). https://platform.claude.com/docs/en/about-claude/pricing.md . Accessed 2026-10-13. Strength A. Price label: published. Register ID AN-20 in `runs/run-3-notes-anthropic.md`.
[^45]: Usage Policy (Anthropic). https://www.anthropic.com/legal/aup . Accessed 2026-10-13. Strength A. Register ID AN-01 in `runs/run-3-notes-anthropic.md`.
[^46]: Rate limits (Claude Platform docs). https://platform.claude.com/docs/en/api/rate-limits.md . Accessed 2026-10-13. Strength A. Register ID AN-22 in `runs/run-3-notes-anthropic.md`.
[^47]: "Automate work with routines". https://code.claude.com/docs/en/routines.md . Accessed 2026-10-09. Strength A. Register ID DC-24 in `runs/run-2-notes-data-cadence.md`.
[^48]: Supplemental Credit Terms. https://www.anthropic.com/legal/credit-terms . Accessed 2026-10-13. Strength A. Register ID AN-19 in `runs/run-3-notes-anthropic.md`.
[^49]: Commercial Terms of Service. https://www.anthropic.com/legal/commercial-terms . Accessed 2026-10-13. Strength A. Register ID AN-14 in `runs/run-3-notes-anthropic.md`.
[^50]: Consumer Terms of Service. https://www.anthropic.com/legal/consumer-terms . Accessed 2026-10-13. Strength A. Register ID AN-15 in `runs/run-3-notes-anthropic.md`.
[^51]: Usage Policy, section "Exclusions". https://www.anthropic.com/legal/aup . Accessed 2026-10-13. Strength A. Register ID AN-10 in `runs/run-3-notes-anthropic.md`.
[^52]: Commercial Terms of Service. https://www.anthropic.com/legal/commercial-terms . Accessed 2026-10-13. Strength A. Register ID AN-13 in `runs/run-3-notes-anthropic.md`.
[^53]: "4210. Margin Requirements" (FINRA rulebook), paragraph (c)(1); and "Understanding the New Intraday Margin Requirements" (FINRA Investor Insights, April 20, 2026). https://www.finra.org/rules-guidance/rulebooks/finra-rules/4210 . Accessed 2026-10-09. Strength A. Register ID MB-12 in `runs/run-2-notes-margin-brokers.md`.
[^54]: "§ 220.12 Supplement: margin requirements." 12 CFR Part 220 (Regulation T), 2025 annual edition on govinfo.gov. https://www.govinfo.gov/content/pkg/CFR-2025-title12-vol3/xml/CFR-2025-title12-vol3-sec220-12.xml . Accessed 2026-10-09. Strength A. Register ID MB-13 in `runs/run-2-notes-margin-brokers.md`.
[^55]: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-04 in `runs/run-2-notes-margin-brokers.md`.
[^56]: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-05 in `runs/run-2-notes-margin-brokers.md`.
[^57]: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-06 in `runs/run-2-notes-margin-brokers.md`.
[^58]: SEC approval order, Federal Register, 91 FR 20731 (April 17, 2026), plain-text copy. https://www.federalregister.gov/documents/2026/04/17/2026-07485/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-of . Accessed 2026-10-09. Strength A. Register ID MB-08 in `runs/run-2-notes-margin-brokers.md`.
[^59]: "Frequent Intraday Trading: Understanding the Basics" (FINRA, page dated June 04, 2026). https://www.finra.org/investors/investing/investment-products/stocks/day-trading . Accessed 2026-10-09. Strength A. Register ID MB-15 in `runs/run-2-notes-margin-brokers.md`.
[^60]: "Intraday Margin Rule for Non-Leverage Margin Accounts" (Alpaca docs, updatedAt 2026-04-27) and "The Intraday Margin Rule" (Alpaca docs, updatedAt 2026-07-07). https://docs.alpaca.markets/us/docs/understanding-the-new-intraday-margin-rule . Accessed 2026-10-09. Strength A. Register ID MB-20 in `runs/run-2-notes-margin-brokers.md`.
[^61]: "What Is Intraday Margin? tastytrade's Post-PDT Rules Explained" (tastytrade Learn, Updated Oct 2, 2026). https://tastytrade.com/learn/accounts/account-resources/intraday-margin/ . Accessed 2026-10-13. Strength A. Register ID BK-20 in `runs/run-3-notes-brokers.md`.
[^62]: "Schwab Updates Day Trading and Margin Rules" (Charles Schwab, July 6, 2026). https://www.schwab.com/learn/story/schwab-changes-rules-around-day-trading . Accessed 2026-10-09. Strength A. Register ID S10 in `runs/run-2-trajectory.md`.
[^63]: "What changed with day trading rules?" (Public help center, dated June 4, 2026) and "Do I need a minimum balance to day trade?" (dated June 4, 2026). https://help.public.com/en/articles/15378349-what-changed-with-day-trading-rules . Accessed 2026-10-09. Strength A. Register ID MB-59 in `runs/run-2-notes-margin-brokers.md`.
[^64]: TradeStation home page, "What's new at TradeStation"; and "Day Trading Requirements" (TradeStation Learn). https://www.tradestation.com/ . Accessed 2026-10-09. Strength A. Register ID MB-53 in `runs/run-2-notes-margin-brokers.md`.
[^65]: "Day Trade Without the $25K Minimum" (Webull). https://www.webull.com/pdt-info . Accessed 2026-10-09. Strength A. Register ID MB-69 in `runs/run-2-notes-margin-brokers.md`.
[^66]: "FINRA's pattern day trader rules are going away" (E*TRADE from Morgan Stanley, June 5, 2026). https://us.etrade.com/knowledge/library/margin/pattern-day-trading-rule-change . Accessed 2026-10-09. Strength A. Register ID S16 in `runs/run-2-trajectory.md`.
[^67]: "Pattern Day Trader Reset" (IBKR Guides, last updated June 3, 2026); "Configuring Your Account" (Interactive Brokers); "Web API Account Management" (IBKR Campus). https://www.ibkrguides.com/orgportal/messagecenter/supportpdtreset.htm . Accessed 2026-10-13. Strength A. Register ID BK-10 in `runs/run-3-notes-brokers.md`.
[^68]: "FAQ: New Intraday Margin Rules (Effective 2026)" (Lightspeed). https://lightspeed.com/trading/intraday-trading-faqs . Accessed 2026-10-13. Strength A. Register ID BK-41 in `runs/run-3-notes-brokers.md`.
[^69]: "Setting up an agent" (Robinhood support). https://robinhood.com/us/en/support/articles/setting-up-an-agent/ . Accessed 2026-10-13. Strength A. Register ID BK-39 in `runs/run-3-notes-brokers.md`.
[^70]: "Data Policies" (UTP Plan, Published September 2023), sections "Uncontrolled Product", "Usage Fees: Non-Display" and "Non-Display Policy". https://www.utpplan.com/DOC/Datapolicies.pdf . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-72 in `runs/run-2-notes-data-cadence.md`.
[^71]: "Rate Limiting" (updatedAt 2025-06-27), "Post Quotes" (updatedAt 2026-04-22), "Streaming Data" (updatedAt 2026-01-21), Tradier API docs. https://docs.tradier.com/docs/rate-limiting.md . Accessed 2026-10-13. Strength A. Register ID BK-05 in `runs/run-3-notes-brokers.md`.
[^72]: "About Market Data API". https://docs.alpaca.markets/docs/about-market-data-api . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-12 in `runs/run-1-notes-market-data.md`.
[^73]: Market Data Pricing | Interactive Brokers. https://www.interactivebrokers.com/en/pricing/market-data-pricing.php . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-16 in `runs/run-3-notes-prices.md`.
[^74]: "Market Data Pricing" (Interactive Brokers). https://www.interactivebrokers.com/en/pricing/market-data-pricing.php . Accessed 2026-10-13. Strength A. Price label: published. Register ID BK-13 in `runs/run-3-notes-brokers.md`.
[^75]: Premium API Key | Alpha Vantage. https://www.alphavantage.co/premium/ . Accessed 2026-10-13. Strength A. Price label: published (plan price); entitlement step gated and unverified (behind a sign-up). Register ID PX-11 in `runs/run-3-notes-prices.md`.
[^76]: API Documentation | Alpha Vantage. https://www.alphavantage.co/documentation/ . Accessed 2026-10-13. Strength A. Register ID PX-12 in `runs/run-3-notes-prices.md`.
[^77]: US Stocks Market Data (Finazon featured dataset); US Equities Basic (Finazon); Pricing (Finazon). https://finazon.io/featured-datasets/us-stocks-market-data . Accessed 2026-10-13. Strength A. Price label: claim published on the vendor's page, but NOT confirmed as a purchasable plan (dataset page redirects to a different, IEX-derived product). Treat as gated and unverified for a cost table. Register ID PX-09 in `runs/run-3-notes-prices.md`.
[^78]: "Get Quotes By Instrument Type" (reference), "Streaming", "Rate limits & backoff" (tastytrade developer docs). https://developer.tastytrade.com/reference/market-data/getMarketDataByType.md . Accessed 2026-10-13. Strength A. Register ID BK-22 in `runs/run-3-notes-brokers.md`.
[^79]: "Market Data Pricing" (TradeStation). https://www.tradestation.com/pricing/market-data-pricing/ . Accessed 2026-10-13. Strength A. Price label: gated and unverified (the equities price table is drawn by script and did not come through curl). Register ID BK-30 in `runs/run-3-notes-brokers.md`.
[^80]: "Get quotes" (Public API docs). https://public.com/api/docs/resources/market-data/get-quotes . Accessed 2026-10-13. Strength A. Register ID BK-32 in `runs/run-3-notes-brokers.md`.
[^81]: EODHD pricing; Real-Time Data API via WebSockets (EODHD docs). https://eodhd.com/pricing . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-13 in `runs/run-3-notes-prices.md`.
[^82]: Finnhub pricing (page source: `window.serverData.price` and the page's script bundle). https://finnhub.io/pricing . Accessed 2026-10-13. Strength A. Price label: published (read from the page's own embedded data with `curl`, not as rendered; a browser check of the rendered page would confirm). Register ID PX-14 in `runs/run-3-notes-prices.md`.
[^83]: Pricing Plans - FMP API; FMP Real-Time Market Data APIs. https://site.financialmodelingprep.com/pricing-plans . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-15 in `runs/run-3-notes-prices.md`.
[^84]: "SPDR S&P 500 ETF Trust (SPY)". https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy . Accessed 2026-10-08. Strength A. Register ID MD-61 in `runs/run-1-notes-market-data.md`.
[^85]: "iShares Russell 2000 ETF". https://www.ishares.com/us/products/239710/ishares-russell-2000-etf . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-62 in `runs/run-1-notes-market-data.md`.
[^86]: "Nasdaq-100 Index". https://indexes.nasdaqomx.com/Index/Overview/NDX . Accessed 2026-10-08. Strength A. Price label: gated and unverified (Global Index Watch price not public). Register ID MD-57 in `runs/run-1-notes-market-data.md`.
[^87]: "Symbol Look-Up/Directory Data Fields & Definitions". https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-64 in `runs/run-1-notes-market-data.md`.
[^88]: "OAuth2 authentication", "Orders & Order Types", "Agent Quickstart" (tastytrade developer docs). https://developer.tastytrade.com/docs/authentication/oauth2.md . Accessed 2026-10-13. Strength A. Register ID BK-23 in `runs/run-3-notes-brokers.md`.
[^89]: "Refresh Tokens" and "FAQ" (TradeStation API docs). https://api.tradestation.com/docs/fundamentals/authentication/refresh-tokens . Accessed 2026-10-13. Strength A. Register ID BK-27 in `runs/run-3-notes-brokers.md`.
[^90]: "Create personal access token" and "Place order" (Public API docs); "publicdotcom-py" README (Public's own SDK, GitHub organization PublicDotCom). https://public.com/api/docs/resources/authorization/create-personal-access-token . Accessed 2026-10-13. Strength A. Register ID BK-31 in `runs/run-3-notes-brokers.md`.
[^91]: Schwabdev documentation, "client.md" and "api.md" (community Python library, GitHub, tylerebowers/Schwabdev); "Using dp_exchange_schwab" (hex.pm package preview, version 0.1.7). https://raw.githubusercontent.com/tylerebowers/Schwabdev/main/docs/pages-raw/client.md . Accessed 2026-10-13. Strength D. Register ID BK-26 in `runs/run-3-notes-brokers.md`.
[^92]: "Authenticating with the IBKR Client Portal REST API" (IBKR Campus podcast transcript). https://www.interactivebrokers.com/campus/podcasts/ibkr-podcasts/authenticating-with-the-ibkr-client-portal-rest-api/ . Accessed 2026-10-13. Strength A. Register ID BK-14 in `runs/run-3-notes-brokers.md`.
[^93]: "Authorization API: Renew Access Token" (E*TRADE developer docs, sandbox host). https://apisb.etrade.com/docs/api/authorization/renew_access_token.html . Accessed 2026-10-13. Strength A. Register ID BK-38 in `runs/run-3-notes-brokers.md`.
[^94]: "Pricing & Plans | Tradier". https://tradier.com/individuals/pricing . Accessed 2026-10-13. Strength A. Price label: published. Register ID BK-08 in `runs/run-3-notes-brokers.md`.
[^95]: "Will I incur commission or clearing fees with Alpaca?" (Alpaca support). https://alpaca.markets/support/commission-clearing-fees . Accessed 2026-10-13. Strength A. Price label: published. Register ID R3-S12 in `runs/run-3-trajectory.md`.
[^96]: "Using OAuth2 and Trading API" (Alpaca docs, updatedAt 2026-03-02). https://docs.alpaca.markets/us/docs/using-oauth2-and-trading-api.md . Accessed 2026-10-13. Strength A. Register ID BK-16 in `runs/run-3-notes-brokers.md`.
[^97]: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17); Alpaca status page incident feed. https://docs.alpaca.markets/us/docs/margin-and-short-selling.md . Accessed 2026-10-13. Strength A. Price label: published. Register ID BK-19 in `runs/run-3-notes-brokers.md`.
[^98]: "Margin" (Public, redirected to /invest/margin) and "Margin rates compared across leading brokers (2026)" (Public Learn). https://public.com/invest/margin . Accessed 2026-10-13. Strength A. Price label: published. Register ID BK-33 in `runs/run-3-notes-brokers.md`.
[^99]: "tastytrade Review" (StockBrokers.com). https://tastytrade.com/margin-rates/ . Accessed 2026-10-13. Strength C. Price label: gated and unverified (vendor rate page returns 404; one review figure only, not corroborated by an opened second source). Register ID BK-24 in `runs/run-3-notes-brokers.md`.
[^100]: "Pricing" and "Margin rates" (TradeStation). https://www.tradestation.com/pricing/ . Accessed 2026-10-13. Strength A. Price label: published. Register ID BK-29 in `runs/run-3-notes-brokers.md`.
[^101]: "Schwab margin rates and requirements" and "Understanding Margin Interest" (Charles Schwab). https://www.schwab.com/margin/margin-rates-and-requirements . Accessed 2026-10-13. Strength A. Price label: published. Register ID BK-25 in `runs/run-3-notes-brokers.md`.
[^102]: "Margin Rates" and "Margin Interest Calculations" (Interactive Brokers). https://www.interactivebrokers.com/en/trading/margin-rates.php . Accessed 2026-10-13. Strength A. Price label: published. Register ID BK-11 in `runs/run-3-notes-brokers.md`.
[^103]: "Margin Trading" (Webull) and "Margin Interest & Short Selling Fees" (Webull help, FAQ 11019). https://www.webull.com/margin . Accessed 2026-10-13. Strength A. Price label: published (but dated March 31, 2026 on the page). Register ID BK-35 in `runs/run-3-notes-brokers.md`.
[^104]: Relii project instructions (local file ~/Projects/relii/CLAUDE.md, the owner's own document). local file, no web address . Accessed 2026-10-13. Strength A. Register ID R3-S1 in `runs/run-3-trajectory.md`.
[^105]: Pricing & Fees | Supabase. https://supabase.com/pricing . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-17 in `runs/run-3-notes-prices.md`.
[^106]: Pushover: Pricing. https://pushover.net/pricing . Accessed 2026-10-13. Strength A. Price label: published (ONE-TIME, not monthly). Register ID PX-32 in `runs/run-3-notes-prices.md`.
[^107]: "Get Account" API reference (Alpaca docs, updatedAt 2026-05-27) and "Margin and Short Selling". https://docs.alpaca.markets/us/reference/getaccount-1 . Accessed 2026-10-09. Strength A. Register ID MB-26 in `runs/run-2-notes-margin-brokers.md`.
[^108]: "Handling WebSockets" (Supabase docs). https://supabase.com/docs/guides/functions/websockets.md . Accessed 2026-10-08. Strength A. Register ID RT-54 in `runs/run-1-notes-runtime-platform.md`.
[^109]: "Tradier API/Services Status" and its public incidents feed. https://status.tradier.com/ . Accessed 2026-10-13. Strength A. Register ID BK-07 in `runs/run-3-notes-brokers.md`.
[^110]: "Usage & Pricing for Cron Jobs" and "Managing Cron Jobs" (Vercel docs). https://vercel.com/docs/cron-jobs/manage-cron-jobs.md . Accessed 2026-10-13. Strength A. Register ID R3-S7 in `runs/run-3-trajectory.md`.
[^111]: "Machine restart policy" and "App configuration (fly.toml)" (Fly.io docs). https://fly.io/docs/machines/guides-examples/machine-restart-policy/ . Accessed 2026-10-13. Strength A. Register ID R3-S8 in `runs/run-3-trajectory.md`.
[^112]: Droplet Pricing | DigitalOcean. https://www.digitalocean.com/pricing/droplets . Accessed 2026-10-13. Strength A. Price label: published. Register ID PX-25 in `runs/run-3-notes-prices.md`.
[^113]: Pricing (Claude Platform docs). https://platform.claude.com/docs/en/about-claude/pricing.md . Accessed 2026-10-13. Strength A. Price label: published. Register ID AN-21 in `runs/run-3-notes-anthropic.md`.
[^114]: "Automate work with routines", section "Usage and limits". https://code.claude.com/docs/en/routines.md . Accessed 2026-10-09. Strength A. Register ID DC-22 in `runs/run-2-notes-data-cadence.md`.
[^115]: "Accessing EDGAR Data". https://www.sec.gov/os/accessing-edgar-data . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-66 in `runs/run-1-notes-market-data.md`.
[^116]: Quiver Quantitative API. https://api.quiverquant.com/ . Accessed 2026-10-13. Strength A. Price label: published for the 30 starting price; the higher tier is gated and unverified (pricing page sits behind a sign-up redirect). Register ID PX-40 in `runs/run-3-notes-prices.md`.
[^117]: Pricing | Firecrawl. https://www.firecrawl.dev/pricing . Accessed 2026-10-13. Strength A. Price label: published (annual-billing figures); monthly-billing Hobby price inferred, not seen. Register ID PX-41 in `runs/run-3-notes-prices.md`.
[^118]: "I created a Claude Console organization - how do I start using the Claude API?"; "Verify your phone number"; "Log in to your Console account"; "Can I have a Claude account and a Console account?" (Claude Help Center). https://support.claude.com/en/articles/8114531-i-created-a-claude-console-organization-how-do-i-start-using-the-claude-api . Accessed 2026-10-13. Strength A. Register ID AN-26 in `runs/run-3-notes-anthropic.md`.
[^119]: Safeguards collection; "Updates to our Acceptable Use Policy ..."; "Exceptions to our Usage Policy"; "Identity verification on Claude" (Claude Help Center). https://support.claude.com/en/collections/4078535-safeguards . Accessed 2026-10-13. Strength A. Register ID AN-34 in `runs/run-3-notes-anthropic.md`.
[^120]: Supported countries and regions (Anthropic); "Where can I access Claude?" (Claude Help Center). https://www.anthropic.com/supported-countries . Accessed 2026-10-13. Strength A. Register ID AN-29 in `runs/run-3-notes-anthropic.md`.
[^121]: "How do I pay for my Claude API usage?"; "I have a paid Claude subscription ... Why is Claude API usage billed separately from my paid Claude plan?" (Claude Help Center). https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage . Accessed 2026-10-13. Strength A. Register ID AN-27 in `runs/run-3-notes-anthropic.md`.
[^122]: "How can I get higher rate limits on the Claude API?" (Claude Help Center). https://support.claude.com/en/articles/10366389-how-can-i-get-higher-rate-limits-on-the-claude-api . Accessed 2026-10-13. Strength A. Register ID AN-28 in `runs/run-3-notes-anthropic.md`.
[^123]: Rate limits (Claude Platform docs), Start tier table. https://platform.claude.com/docs/en/api/rate-limits.md . Accessed 2026-10-13. Strength A. Register ID AN-23 in `runs/run-3-notes-anthropic.md`.
[^124]: Service Specific Terms, section "B. Beta Services". https://www.anthropic.com/legal/service-specific-terms . Accessed 2026-10-13. Strength A. Register ID AN-36 in `runs/run-3-notes-anthropic.md`.
[^125]: Claude Status. https://status.claude.com/ . Accessed 2026-10-13. Strength A. Register ID AN-25 in `runs/run-3-notes-anthropic.md`.
[^126]: Using Agents According to Our Usage Policy (Claude Help Center, dated March 16, 2026). https://support.claude.com/en/articles/12005017-using-agents-according-to-our-usage-policy . Accessed 2026-10-13. Strength A. Register ID AN-32 in `runs/run-3-notes-anthropic.md`.
[^127]: Usage Policy (archived version), section "High-Risk Use Case Requirements". https://www.anthropic.com/legal/archive/22742366-2ef0-4c7a-a833-6523f10d3944 . Accessed 2026-10-13. Strength A. Register ID AN-03 in `runs/run-3-notes-anthropic.md`.
[^128]: Usage Policy (archived version), section "Additional Use Case Guidelines". https://www.anthropic.com/legal/archive/22742366-2ef0-4c7a-a833-6523f10d3944 . Accessed 2026-10-13. Strength A. Register ID AN-04 in `runs/run-3-notes-anthropic.md`.
[^129]: Usage Policy, section "Additional Use Case Guidelines". https://www.anthropic.com/legal/aup . Accessed 2026-10-13. Strength A. Register ID AN-11 in `runs/run-3-notes-anthropic.md`.
[^130]: Pricing (claude.com); "I have a paid Claude subscription ... Why is Claude API usage billed separately from my paid Claude plan?" (Claude Help Center). https://claude.com/pricing . Accessed 2026-10-13. Strength A. Register ID AN-37 in `runs/run-3-notes-anthropic.md`.
[^131]: Getting Started (Discord support): "You can download Discord for free". Run 4's comparison of Telegram, Discord, Slack and Matrix is in `runs/run-4-deliverable.md`. https://support.discord.com/hc/en-us/articles/360033931551-Getting-Started . Accessed 2026-10-28. Strength A. Price label: published (free). Register ID DC-26 in `runs/run-4-trajectory.md`.
[^132]: Healthchecks.io home page, Integrations list (Discord, Telegram, Slack, Matrix and others) and its Discord setup template ("will send a notification to a Discord channel when a check goes up or down"). https://healthchecks.io/ . Accessed 2026-10-28. Strength A. Register IDs HC-02 and HC-09 in `runs/run-4-trajectory.md`.
[^133]: Message resource (Discord developer docs): Get Channel Messages, up to 100 per call; the bot reads message text after "Message Content" is switched on (What are Privileged Intents). https://docs.discord.com/developers/resources/message . Accessed 2026-10-28. Strength A. Register IDs DC-07 and DC-08 in `runs/run-4-trajectory.md`.
