# Run 2 deliverable: scoping the stack for sib-tech

Written 2026-10-09 (America/Chicago). Sources opened in run 2 carry that date. Sources reused from run 1 carry their original date, 2026-10-08, as the brief allows.

**What this document is.** It is research input for a human decision about the stack for a future agent that trades U.S. stocks, ETFs (exchange traded funds) and perpetual contracts that track U.S. equities, for Michael's own account. It is not an instruction to trade, to open an account, to buy a subscription, to borrow, or to build anything. It recommends an architecture and Michael decides. It does not choose a provider, a broker, a venue, a run frequency, a driver, a research method or a ticker. Nothing here is legal advice. Where a law or a contract is quoted, it is quoted and not interpreted.

**How to read the footnotes.** Every factual claim carries a numbered footnote marker. The Sources section at the end lists each number with its title, address, access date, a strength label and, for prices, a price label. Each entry also carries a register ID (for example MB-25 or S10) that points to the fuller note, with a quote, in the `runs/run-2-notes-*.md` files, the `runs/run-1-notes-*.md` files, or the trajectory files. Sentences marked "my judgment", "my inference", "my reading" or "my arithmetic" are reasoning from the cited facts and are not themselves sourced. The plain-English description of each architecture is a design sketch, not a sourced claim. Lists of pros and cons restate facts cited in the tables above them, or are my judgment, and carry a marker where they add a fact.

**A caution about quotes.** Many pages were read through a tool that converts a page to text and can paraphrase lightly. Quotes read in a browser or as raw page text by the main session (register IDs starting with S, except S19, S20, S21 and S22) are exact. The helper notes mark each quote as verbatim or as passed through the tool. Before a decision hangs on the exact wording of a quote, reopen the address.

**What changed from run 1.** Only the facts about what Michael wants. The method, the output and the standard are the same. Section 1.1 maps run 1's options to this run's.

## 1. Summary

**Strongest option: F, a scheduled core with Claude on top.** Small programs that Claude Code writes run on a timer on managed services (the Relii stack: Supabase for the database and the timer, Vercel for the screen Michael looks at). Every minute or so during market hours they fetch current prices for the whole watch list in one or a few requests, apply fixed rules, check every order against fixed limits, and send the order to a broker. Nothing has to stay running in between. Claude sits on top as the research and explanation layer, reading and writing the same database, and never holds a broker connection. Option F scores 3.80 out of 5 against the weighted criteria in section 2.

**It is a tie, and the top four are close.** Option D (run 1's pick: an always-on worker with Claude on top) also scores 3.80. Option B (the scheduled web app alone, with no Claude layer) scores 3.70. Option C (the worker alone) scores 3.65. Option A (Claude as the agent, through connectors) scores 2.75. The first four share one idea: fixed code, not a language model, places the orders, at a broker operating under the new margin rules. They differ on two questions only. Does Claude sit on top? Is the core scheduled or always-on?

**Why F over D, on a tie.** This is a tie-break, and it is my judgment. F becomes D by adding one part, the always-on worker, and keeping the database, the limit checks and the Claude layer. D becomes F by retiring a server that has already been built. So F is the cheaper one to be wrong about. The evidence that would justify D's extra part does not exist yet: a measurement showing that checking once a minute misses what a live stream would catch. Run 1 named exactly that measurement as what would overturn its pick, and Michael's answer (a 5 minute target) plus two facts found in this run make the scheduled core sufficient on paper. One data vendor returns "the entire U.S. stock market" in a single request,[^1] and timers on the Relii stack fire as often as every second.[^2]

**How sensitive this is.** With all eight criteria weighted equally, D and F tie again at 3.75, and B and C tie at 3.63. With operability weighted first (30 of 100), **B comes first** at 3.75, F second at 3.60. If Michael decides the driver will be software only, the Claude layer has no job and **B is the pick**. Section 6 gives the full list of what would overturn F.

**Five findings that shape everything, whichever option is chosen.**

1. **A margin account removes the limit that shaped run 1, but which rules apply depends on the broker.** The rule that replaced the pattern day trader rule on June 4, 2026 has no limit on the number of trades in a day,[^3] keeps the 2,000 dollar minimum for borrowing,[^4] and deletes the 25,000 dollar minimum.[^5] Brokers may keep applying the old rule until October 20, 2027.[^5] Schwab stopped counting day trades on June 8, 2026[^6] and E*TRADE switched on June 9.[^7] Alpaca's documentation says the old designation is gone.[^8] Interactive Brokers says an account "may still be subject to existing PDT rules" (PDT is pattern day trader).[^9] Tradier's help pages still describe the old rule.[^10] Michael's capital sits at or below the old 25,000 dollar line, so this decides whether the agent can trade freely at a given broker today.
2. **Perpetual contracts that track U.S. equities: one lawful route is live for a U.S. resident, and it is not the one Michael named.** A perpetual contract is a contract with no end date that tracks a price. Every onchain venue this run read bars U.S. residents in its own terms, including the three that Liquid routes to.[^11][^12][^13][^14] The law is written against a person of Michael's means trading a contract on a single stock anywhere except a registered U.S. exchange.[^15][^16] One U.S. regulated exchange, Kalshi, lists a live perpetual on an index of large U.S. companies, open to approved U.S. customers.[^17][^18] Perpetuals on single stocks are filed at U.S. exchanges and pending, the earliest dated November 2, 2026.[^19] No lawful route found uses a crypto wallet: at Kalshi the money is held in dollars by a futures broker.[^18] Whether software may trade there for a retail customer is not verified.[^20]
3. **Data delayed by "around 5 minutes" does not exist as a product.** Both official price feeds for U.S. stocks define delayed data as 15 minutes old and treat anything younger as real time.[^21][^22] No plan with a delay between zero and 15 minutes was found for individuals.[^22] Data that is 15 minutes old misses a 5 minute target (my arithmetic). So the real choice is between real-time data from one small exchange, free or 30 dollars a month,[^23][^24] real-time data from every exchange at 99 dollars a month,[^25] and real-time data that comes with a brokerage account.[^26]
4. **Anthropic's terms bear on who drives, and on acting alone.** The Consumer Terms that govern a Max plan still list relying on the service "to buy or sell securities" among prohibited uses.[^27] The Commercial Terms that govern use through an API key contain no such passage.[^28] (An API, application programming interface, is the way one program talks to another. An API key is the password a program uses, billed by usage.) The Usage Policy that takes effect November 12, 2026 requires that a "qualified person must meaningfully review" a personalized buy or sell recommendation "before it is used to implement a decision", and it excludes "applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual".[^29] Those two clauses are the sharpest line between a design where a model picks each trade and a design where fixed code applies rules. This is quoted, not interpreted, and it is the first open question in section 7.
5. **At this capital, the monthly bill is a hurdle the trading has to clear.** One hundred dollars a month is 1,200 dollars a year, which is 12 percent of 10,000 dollars and 4.8 percent of 25,000 dollars (my arithmetic). Borrowing has its own price: published margin interest rates for a loan under 25,000 dollars range from 5.15 to 12.70 percent a year across the brokers read.[^30][^31]

### 1.1 What changed since run 1, option by option

Run 1 chose option D and said what would overturn it. Its second condition was: if a live stream is not actually needed, the always-on worker has no job. Michael's 5 minute target is direct evidence on that condition. This table maps each run 1 option to its run 2 counterpart, so the two runs can be compared line by line.

| Run 1 option | Run 1 total | Run 2 option | Run 2 total | What moved it |
| :-- | :-- | :-- | :-- | :-- |
| A: Claude in the chair | 2.50 | A: Claude-native agent | 2.75 | Faster ways to run Claude unattended were found,[^32][^33] and some broker connectors now let an agent place an order with no human step.[^34] The terms questions remain |
| B: Relii-style web app | 3.25 | B: scheduled web app | 3.70 | A 5 minute target is met by a check every minute. A margin account removes the settled cash ledger |
| C: always-on worker | 3.60 | C: always-on worker | 3.65 | Little. Its speed is now more than the target asks for |
| D: hybrid, worker plus Claude | 3.85 | D: unchanged | 3.80 | Still strong. No longer alone at the top |
| (none) | | F: scheduled core plus Claude | 3.80 | New. It is option B with option D's Claude layer |
| E: hosted algorithm platform | 3.15 | Not carried as a full option | 3.05 if scored | None of Michael's changes touches it. See section 4 |

The totals are not strictly comparable, because the criteria were re-derived for the changed facts (section 2). The order is what matters.

### 1.2 Where Liquid and Co-Invest stand

This repo's `CLAUDE.md` names "LiquidTrade" and "Co-Invest" as candidates, and three of Michael's changes point straight at them: a crypto wallet is acceptable, perpetual contracts "like Liquid's" are in scope, and the agent may act alone inside fixed limits. So this gets a direct answer.

**What it is.** Liquid (liquid.trade) and Co-Invest are one vendor.[^35] Liquid is a front end for trading perpetual contracts, and its terms say "We do not operate any exchange, designated contract market, swap execution facility, broker-dealer,".[^36] Trades route to venues named Hyperliquid, Lighter and Ostium.[^37] Co-Invest is its connector for AI assistants. MCP is the Model Context Protocol, the standard that lets Claude call an outside tool, and a connector is a tool offered that way. In a chat, every order needs a tap on Confirm.[^38] A second mode, "Co-Invest Computer", is built for coding agents such as Claude Code, "so the agent executes within the limits you configure instead of asking you before every order".[^39] The limits it lists include a maximum size per order and per day, a maximum multiplier, a required stop-loss, an optional list of allowed symbols and daily order caps.[^39] Liquid says it is free beyond trading fees.[^39] The money sits in a wallet the user controls, funded with USDC, a crypto token priced at one dollar.[^40]

**Why it fits on paper.** It is the only product found in either run that combines all three of Michael's new allowances in one tool: perpetual contracts on U.S. stocks, a self-held wallet, and an agent that acts alone inside limits the owner sets (my judgment from the sources above).

**Why it is out for a U.S. resident, on the sources read.**

- The venues it routes to each exclude U.S. residents. Hyperliquid's terms: restricted persons include those who "reside in, are located in, are incorporated in, or have a registered office in the United States of America".[^11] The firm that deploys Hyperliquid's stock markets, trade.xyz, names persons "subject to the laws of the United States of America" as restricted, and says "You must not use a VPN, proxy, Tor, or similar to circumvent geo-blocks or our eligibility rules."[^12] (A VPN, virtual private network, hides where a computer is.) Lighter's terms cover its interface, its protocol and its API.[^13] Ostium's say "no exceptions".[^14]
- Liquid's own terms do not name the United States. They say that eligibility is "governed by that third party's rules and agreements", and they prohibit hiding location with a VPN and evading a connected venue's eligibility restrictions.[^41] So Liquid's silence is not a permission (my reading).
- A direct observation, not a quote from any terms: when this run opened Hyperliquid's site from Michael's Mac, the site displayed "You are accessing our products and services from a restricted jurisdiction."[^11]
- U.S. law, as written: "It shall be unlawful for any person to effect a transaction in a security-based swap with or for a person that is not an eligible contract participant, unless such transaction is effected on a national securities exchange".[^15] An individual is an eligible contract participant only with more than 10 million dollars invested (5 million in one case).[^16] A swap on a single stock is a "security-based swap" if it is a swap at all.[^42] Whether a perpetual contract is legally a swap or a future is not settled: the two regulators asked the public that question in June 2026,[^43] and a lawsuit over it has no ruling.[^44]

**What this run does not say.** It does not say what would happen to an individual who used these venues anyway. That is a legal question this run does not answer. It says that every door found is marked closed by the people who own it, that the workarounds are themselves prohibited by those terms, and that a stack should not be chosen on the assumption that this route is open. Whether Liquid blocks a U.S. visitor in practice was not tested, because that would have required creating an account.[^41]

## 2. Criteria and weights

Eight criteria, weights summing to 100. Scores run from 1 (worst) to 5 (best). The scores are my judgment applied to cited facts. They are not measurements, and what would turn them into measurements is named in section 6. The anchors for 1, 3 and 5 were written before any option was scored. Scores of 2 and 4 fall between the descriptions.

The criteria were re-derived for this run, because two of run 1's premises changed: the account no longer has to be a cash account, and the target is a reaction within 5 minutes, not a live stream.

| # | Criterion | Weight | Why this weight | A score of 1 means | A score of 3 means | A score of 5 means |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Unattended order path inside fixed limits | 20 | The brief says the stack must be judged on whether it can get to placing trades, and the agent may now act alone. Down from 25 in run 1, because a margin account removes the settled cash problem that made this the tightest constraint | Cannot place an order without a person each time, or only by a route the provider's terms appear to prohibit | Can place orders unattended, but the limits are held only by a model following instructions, or a key fact (the broker's margin regime, a lasting sign-in, the terms) rests on unverified evidence | Orders go from decision to broker unattended, at a broker confirmed on the new margin rules, with limits enforced in fixed code and a borrowing cap set at the broker, on a sign-in that lasts at least a week, under terms that clearly allow it |
| 2 | Meeting the 5 minute target across a wide universe | 20 | The style is intraday, the target is 5 minutes, and the universe preference is thousands of names | Cannot run unattended more often than hourly | Reacts within 5 minutes only with a caveat: a short watch list, runs that can be late or skipped, or a computer that must stay awake | Checks thousands of symbols on real-time data every minute or faster with room to spare, and can hold a live stream if one is ever needed |
| 3 | Flexibility across drivers and run modes | 15 | The brief leaves both deliberately undecided, so an option that closes either door costs something | One driver model and one strong run mode | One driver model, or one weak run mode | Both driver models, and at least 4 on every run mode |
| 4 | Operability for a non-coder | 15 | Michael writes no code and must still notice when it breaks | Several parts he is responsible for keeping alive, failing silently by default | Code hosted by platforms that keep it running, with more than two parts to keep in step, or one always-on part that is managed for him | No code to maintain and nothing to keep running |
| 5 | Safety of an agent that acts alone | 10 | The agent may now act without approval and may borrow. Kept at 10 because every option can be made safer by design, so this separates options less than the others | A language model can send orders and borrow with no fixed check | Fixed checks exist in one place only, or a failure leaves a position open with nobody told | Every order passes a fixed check in code, a borrowing cap and an off switch sit at the broker where the agent cannot change them, no model is in the order path, and everything is recorded |
| 6 | Monthly cost of the platform itself | 10 | The owner chose to band cost, not cap it. Covers the model, hosting and storage. Market data and brokerage are left out because every option needs them | Band 4 | Band 2 | Band 0 |
| 7 | Reach to a lawful perpetual venue | 5 | Perpetual contracts are now in scope. Kept at 5 because one lawful venue exists, it lists one index contract, and its interface for retail customers is unverified | Can use a venue only through a ready-made connector or platform link, and none exists for the lawful venue | Could reach the venue's interface, but only by a route with a material weakness | Can call the venue's published interface directly, including its live connections, as soon as access is granted |
| 8 | Reversibility | 5 | Nothing here is permanent, but lock-in is still a cost | Logic lives in a vendor's own format | Swapping needs rewriting, but the data and logic are his and portable | Swapping a provider or the driver is a settings change |

## 3. Source strength scale and cost bands

**Source strength.** Four levels, the same as run 1, so that run 1's labels can be reused.

| Label | Meaning |
| :-- | :-- |
| A | Primary and authoritative: a regulator, a statute, an exchange, an index owner, or the vendor's own documentation, pricing page or terms, seen live. For an onchain venue, its own documentation and terms count as A for what the venue says about itself, and nothing more |
| B | Reputable independent press or an established reference publisher |
| C | Review sites, comparison sites and affiliate blogs, which have a commercial incentive |
| D | Forums, social posts, personal blogs and community code repositories |

**Price labels.** Every price carries one of three.

| Label | Meaning |
| :-- | :-- |
| Published | On the vendor's own public page, seen live on the access date |
| Corroborated | Not seen on a vendor page, but at least two independent sources agree, and they are named |
| Gated and unverified | Behind a sign-in, a signup or a sales call, or on a page that would not load, and not corroborated. The reason is stated |

**Cost bands.** Per month, per category, in U.S. dollars. Unchanged from run 1. The last two columns are my arithmetic: the top of each band over a year, as a share of Michael's starting capital.

| Band | Range | Why this edge | Top of band per year, share of 10,000 | Share of 25,000 |
| :-- | :-- | :-- | :-- | :-- |
| 0 | Free | | 0 | 0 |
| 1 | 1 to 25 | About one small subscription. Supabase Pro is 25.[^45] | 3 percent | 1.2 percent |
| 2 | 26 to 100 | The lowest published price for real-time data from every exchange is 99,[^25] and Claude Max 5x is 100.[^46] | 12 percent | 4.8 percent |
| 3 | 101 to 300 | Separates hobby-scale from professional-scale data. Massive's real-time plan is 199.[^47] | 36 percent | 14.4 percent |
| 4 | Over 300 | | Over 36 percent | Over 14.4 percent |

A band is a range, not a quote. Where an option's total depends on how often it runs, that is said, because the run frequency is not decided.


## 4. The options

Five architectures: A, B, C, D and F. Before them comes a shared reference, because all five draw on the same rules and the same pool of candidate providers. Each option then says which categories it needs, which candidates fit it, and what band each falls in.

**Why these five.** The evidence left two questions that separate one stack from another. Does a language model sit in the order path, on top of fixed code, or nowhere? And is the fixed code woken by a timer or always running? Option A puts the model in the order path. B and C are fixed code alone, scheduled and always-on. F and D are the same two with Claude on top. The letters match run 1 where the architecture is the same, and the new one is F, so that D means the same thing in both runs.

**Looked at and not carried as full options.**

- **Liquid and Co-Invest, and onchain perpetual venues generally.** See section 1.2. They fit Michael's new allowances on paper and are closed to U.S. residents by the venues' own terms.[^11][^12][^13][^14]
- **Run 1's option E, a hosted algorithm platform (QuantConnect).** None of Michael's changes touches it. The price of its live trading node is still gated and unverified,[^48] and it was the lowest-scoring software option in run 1. Re-scored against this run's criteria it comes to 3.05 (path 4, timing 4, flexibility 2, operability 3, safety 3, cost 2, perpetual reach 2, reversibility 2), below B, C, D and F. Its list of supported brokers for U.S. stocks, as read in run 1, includes Alpaca, Interactive Brokers, Schwab, Tradier, TradeStation, tastytrade and Public,[^49] and does not include the one lawful perpetual venue. It remains a real alternative for someone who would rather rent the machine room than own it (my judgment), and run 1's deliverable describes it in full.
- **Composer.** Its automated trades happen once a day, in the last 15 minutes of the session, so it is not an intraday platform.[^50]
- **TradingView alerts.** An alert can send a web callback to another system, which must answer within three seconds.[^51] No page was found saying an alert can place an order at a broker by itself.[^52] It is a possible trigger for options B to F, not an architecture.

### 4.0 Shared reference

#### 4.0.1 Rules that affect every option

**A. Margin accounts at 10,000 to 25,000 dollars, under the new rule.**

- The pattern day trader rule was replaced by "intraday margin standards", effective June 4, 2026.[^5] FINRA is the Financial Industry Regulatory Authority, the brokerage industry's regulator, and the SEC is the Securities and Exchange Commission.
- What the new rule tests. The broker must work out an "intraday margin deficit" for each margin account on any day the account trades in a way that reduces its margin cushion.[^53] The deficit is the worst shortfall reached right after any purchase that day, even if the account is fine by the close.[^54]
- **No limit on the number of round trips.** The four-trades-in-five-days definition is deleted, and the SEC says the new rules no longer depend on counting trades.[^3] A broker may still impose its own limits.[^3]
- **Minimum.** 2,000 dollars of equity to borrow at all. The 25,000 dollar sentence was struck from the same paragraph.[^4]
- **How much such an account can hold.** The maintenance requirement for stock held long is 25 percent of its value, and must now be met through the day.[^55] The federal initial requirement for a position held overnight is 50 percent.[^56] From those two numbers: about 4 times equity during the day and 2 times overnight, at most. That is 40,000 and 20,000 dollars on 10,000 of equity, and 100,000 and 50,000 on 25,000. The multiples are arithmetic, not a quote from the rule.[^57] Schwab states the same shape: "up to four times the buying power intraday".[^6] So does Alpaca: "up to 4x intraday buying power".[^58] These are ceilings a broker may lower, and many stocks carry higher requirements.[^59] They are not a suggestion.
- **Sale proceeds can be used again the same day.** The settlement freeze that shaped run 1 belongs to cash accounts.[^60] Brokers say this outright for margin accounts,[^61][^62] and it follows from the rule's definitions, though no FINRA sentence says it in so many words.[^63]
- **What happens when a deficit is not met.** It must be met "as promptly as possible".[^64] If a customer makes a practice of not meeting deficits and one is still unmet after five business days, new borrowing is frozen for 90 days.[^65] A broker may avoid the whole question by blocking, in real time, any order that would create a deficit,[^66] and Schwab says it does.[^6] So an agent will meet either a rejected order or a margin call, depending on the broker (my inference).
- **Margin calls and forced sales.** Alpaca reserves the right to sell holdings without reaching the customer.[^67] Schwab says that if a call is not met it "may have to sell securities in your account".[^68] Interactive Brokers gives no grace period and liquidates at once.[^69] At Schwab, positions opened with intraday buying power beyond the overnight limit "must exit" by 8 p.m. Eastern.[^6] An unattended agent has to be built to cope with each of these (my inference).
- **What borrowing costs.** Published rates for a loan under 25,000 dollars: Public 5.15 percent (the page heads its comparison "introductory", so it may not be a standing rate),[^30] Interactive Brokers Pro 5.38 percent,[^70] Alpaca 6.50 percent,[^58] Webull 8.74 percent,[^71] Tradier 9.75 percent,[^72] TradeStation 12.00 percent,[^73] Schwab 12.075 percent,[^68] E*TRADE 12.45 to 12.70 percent.[^31] Alpaca charges only on the balance held at the end of the day,[^58] so money borrowed and repaid within the day costs nothing there.[^74]
- **"Borrow little at first".** Only one broker read documents a borrowing cap that the customer sets. Alpaca's account setting `max_margin_multiplier` accepts 1, 2 or 4, alongside a long-only switch and a switch that blocks new orders.[^75] A staff post says a value of 1 makes the system reject orders above available cash.[^76] A caution from the same finding: the key the agent uses can change that setting, so the cap stops accidents, not software that deliberately changes it.[^75] No customer-set cap was found at any other broker, which is not proof that none exists.[^75] Robinhood's agent account avoids the question: it offers "limited margin", which lets the agent use unsettled sale proceeds but "doesn't provide borrowing power or leverage".[^77]

**B. Which rule each broker applies today.** The new rule lets a broker keep the old one, account by account, until October 20, 2027,[^5] and nothing requires a broker to publish which it uses.[^78] With 10,000 to 25,000 dollars, a broker still on the old rule limits a margin account to three day trades in five business days (the old rule as Interactive Brokers still describes it).[^79]

| Broker | Rule applied today | Source and strength of the evidence |
| :-- | :-- | :-- |
| Alpaca | New. Day trades unlimited. Switch date not stated | Vendor docs[^8] |
| Charles Schwab | New. Stopped counting June 8, 2026. Intraday buying power from July 13, 2026 | Vendor page, read in a browser[^6] |
| E*TRADE | New, since June 9, 2026 | Vendor page, read in a browser[^7] |
| Public | New, on all margin accounts from June 4, 2026 | Vendor help pages[^80] |
| Webull | New, from June 4, 2026. One stale help page disagrees | Vendor page[^81] |
| TradeStation | New, described as live. Switch date not stated | Vendor pages[^82] |
| tastytrade | New, "ready" on June 4, 2026. Moderate confidence, the page mixes tenses | Vendor page and press[^83][^84] |
| Interactive Brokers | **Mixed.** "new margin accounts will generally not be subject to" the old rule, but "depending on your account setup" may be | Vendor pages, read in a browser[^85][^9][^79] |
| Tradier | **Not confirmed.** Its blog says the rule is replaced. Its help center still describes the old rule | Vendor pages[^10] |
| Robinhood, agent account | Not applicable. The agent account has no borrowing | Vendor page[^77] |

**C. Cash accounts, for completeness.** Michael's existing Schwab account is a cash account. Run 1's findings still apply to any cash account: trades settle one business day later,[^86] and buying with unsettled proceeds then selling before they settle is a good faith violation, three of which in 12 months can restrict the account for 90 days.[^87] A stack that used a cash account would need the settled cash ledger run 1 described. A margin account does not (my inference from section A).

**D. Perpetual contracts that track U.S. equities, for a U.S. resident.** This run quotes the law and the venues. It does not interpret them.

| Question | What the sources say | Settled? |
| :-- | :-- | :-- |
| What is a perpetual on one U.S. stock, in law? | If it is a "swap", it is a "security-based swap".[^42] If it is a "future", it is a "security future".[^88] The SEC and the CFTC (Commodity Futures Trading Commission, the futures regulator) asked the public in June 2026 whether such a contract "could be treated as a security future".[^43] A lawsuit over whether perpetuals are swaps has no ruling.[^44] | Not settled |
| May a small individual trade a security-based swap? | Only on a registered national securities exchange, by the statute.[^15] Offering one to such a person without a registration statement is also unlawful.[^89] SEC staff restated this for onchain products in January 2026.[^90] | Settled text |
| Is a person with 10,000 to 25,000 dollars exempt? | No. The exemption for individuals starts above 10 million dollars invested.[^16] | Settled text |
| Is a single stock perpetual live on a U.S. exchange? | Not yet. Kalshi, Coinbase Derivatives, Bitnomial and Nadex filed in September 2026.[^19][^91][^92][^93] Kalshi's SEC notice: "The CFTC has not yet approved the proposed rule change." and effective "November 2, 2026, or such later date".[^19] Its filing covers "up to" 58 large stocks.[^94] | Pending |
| What about a perpetual on a broad U.S. index? | Treated by the CFTC as a futures contract on a regulated exchange.[^95] Kalshi's US500 is live.[^17] Coinbase Derivatives lists similar contracts, but who may trade them was not verified.[^96] | Live at one venue |
| Is there an exemption for onchain venues? | None found. The SEC's September 2026 order on tokenized stocks leaves out "a tokenized security-based swap".[^97] The CFTC's policy statement sends stock perpetuals to case by case review "by the Commission and the U.S. Securities and Exchange Commission".[^98] | None found |
| Did Congress change this? | No law passed. A market structure bill failed a Senate vote on September 15, 2026, by a press report only.[^99] | No change, strength B |
| What do the onchain venues say? | Each bars U.S. residents.[^11][^12][^13][^14] | Settled as to their terms |

Three readings that are mine, flagged so Michael can overrule them.

1. **An index perpetual counts as "tracking U.S. equities".** The brief says "perpetual contracts that track U.S. equities". A contract on an index of the 500 largest U.S. companies does that in plain words. If Michael meant single stocks only, no lawful route is live today.
2. **Kalshi's contract is a look-alike.** It tracks the "MerQube US Large Cap Index", not the S&P 500 itself, by press reports.[^100]
3. **These contracts are legally futures, and the brief excludes "futures".** The U.S. exchanges list perpetuals as futures with no end date.[^19] I read the brief's exclusion as meaning ordinary dated futures. If Michael meant every futures contract, the lawful perpetual route is excluded by his own rule.

**E. Market data: delay, and licensing for a program.**

- "SIP" is the Securities Information Processor, the official feed that merges every U.S. exchange. "IEX" is one exchange, carrying about 2.5 percent of trading volume.[^101]
- The delay rule. For stocks listed on the New York Stock Exchange and other non-Nasdaq exchanges, the plan that governs the official feed sets the delay period at 15 minutes.[^21] For Nasdaq-listed stocks the rule is the same, and anything sent sooner is real time.[^22] One broker offers no delayed U.S. stock quotes at all.[^102]
- So the brief's example, data "delayed by around 5 minutes", was not found on any plan sold to individuals. The only shorter figure seen, 10 minutes, belongs to one exchange's order book on an institutional plan.[^103]
- Licensing. "Non-display use" is the exchanges' name for data read by a machine. The official feeds' policies describe it with examples that fit a trading program, such as automated order generation, but they are written about firms that receive a real-time data feed.[^104][^105] For Nasdaq-listed stocks the fee is 3,500 dollars a month per firm, applying "only to Vendors that receive a Data Feed".[^105] How vendors pass this on to an individual varies: one forbids non-display use unless licensed,[^106] one sells individuals a subscription named for it,[^107] and two say it is included.[^108][^109] A pending change to the official feeds' fee schedule would define professional use by what is done with the data, and says it is meant to end the question of whether "an individual trading for their own account" is a professional. It was not approved as of April 2026.[^110]
- **For the stack:** this is unresolved, as in run 1, and it bears on every option where software reads prices. It is an open question in section 7.

**F. Anthropic's terms, wherever Claude is in the loop.**

- Which terms apply. Claude Code used on a Max plan falls under the Consumer Terms. Use through an API key falls under the Commercial Terms.[^111]
- Consumer Terms, unchanged since run 1: the user may not use the service "To rely upon the Services, the Materials, or the Actions to buy or sell securities or to provide or receive advice about securities, commodities, derivatives, or other financial products or services, as Anthropic is not a broker-dealer or a registered investment adviser".[^27] No exception for personal use is written into it.[^27]
- Commercial Terms: no passage about securities, trading, investment advice or brokers.[^28]
- Usage Policy, which applies under both. The version in force today says that for advice or decisions "directly affecting individuals or consumers, a qualified professional in that field must review the content or decision prior to dissemination or finalization".[^112] The version effective November 12, 2026 is more specific. Its finance item is "a personalized recommendation to buy, sell, hold, or allocate among specific investment products, such as securities, funds, digital assets, or annuities".[^29] Its rule: "A qualified person must meaningfully review a High-risk AI Recommendation, with the authority to change or modify it, before it is delivered as advice to an individual who might rely on it or before it is used to implement a decision."[^29] Its definition: "A qualified person is someone with the training or experience to evaluate the output in that field, and who holds a license where applicable law requires one for the underlying activity."[^29]
- Two listed exclusions bear on this project: "Internal drafting, research, summarization, or analysis that is not the ultimate High-risk AI Recommendation delivered",[^113] and "Carrying out a decision a person has already made, or applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual."[^29]
- On agents: "Users are responsible for ensuring that agents they build or deploy, including actions those agents take through tools, browsers, or connected systems, comply with this Usage Policy."[^29] Neither version contains the words transaction, trading, broker or personal use.[^114]
- Related signals. Cloud routines run with no permission prompts, and every included connector's tools can be used without asking.[^115] On Anthropic's hosted agents, a tool reached through MCP pauses for approval by default and can be set to run with no confirmation.[^116] Anthropic's policy for its connector directory does not allow listed software that "executes financial transactions on behalf of users" unless Anthropic permits it in writing,[^117] and the directory on 2026-10-09 (929 connectors) lists no broker connector that places an order by itself.[^118][^119][^120]
- **For the stack:** this run does not interpret these terms. It notes which shape each option has. In option A a model picks each trade. In options B and C fixed code applies rules. In D and F fixed code applies rules and Claude researches and sets parameters. Any score that leans on these clauses is a reading of the text, and only Anthropic can settle it in writing.

**G. Regulators on a customer's own AI agent.** No SEC or FINRA rule or guidance specific to a retail customer's own agent placing orders was found.[^121] FINRA's January 2026 statement addresses member firms' own use of agents.[^122] Seven members of Congress wrote to the SEC about agentic trading at retail brokers on June 23, 2026, and no public reply was found.[^123] Brokers put responsibility on the customer: Robinhood says "You are ultimately responsible for the trades your AI agent places in your account."[^124]

#### 4.0.2 Categories, candidates and cost bands

Eight categories. A candidate appearing here is a candidate, not a choice.

**Category 1: the reasoning model.**

| Candidate | What it is | Price | Band |
| :-- | :-- | :-- | :-- |
| Claude Max subscription | One pool of usage shared by the Claude apps and Claude Code.[^125] No number of messages, tokens or runs is published.[^126] Michael has this (not counted for or against) | 100 or 200 a month, published[^46] | 2 or 3 |
| Claude API, pay per use | Billed per million tokens (a token is roughly three quarters of a word): Opus 5.5 is 4 in and 20 out, Sonnet 5.5 is 2 and 10, Haiku 5.5 is 0.10 and 0.50, published.[^127] Max plans include a monthly API credit of 100 or 200 that covers the API, the Agent SDK and Managed Agents, but not interactive Claude Code.[^128] | Depends on run frequency. An estimate, not a measurement: one run every 5 minutes through a regular session (78 a day, 1,638 a month) at 20,000 tokens in and 1,500 out costs about 4.50 a month on Haiku, 90 on Sonnet and 180 on Opus without caching, and roughly 2 to 71 with caching[^129] | 1 to 3 by model, estimated |
| Claude Managed Agents | Anthropic hosts the agent. Token rates plus 0.08 per session-hour, published.[^130] Schedules down to one minute, started up to 15 percent of the interval late. Beta.[^32] | As above plus an estimated 2 to 7 a month of runtime[^131] | As above |
| No language model | Fixed rules only. Possible in options B and C | 0 | 0 |

**Category 2: where it runs.** A regular U.S. session is 6.5 hours, so every 5 minutes is 78 runs a day and every minute is 390 (my arithmetic).

| Candidate | Smallest interval | Every 5 minutes? | Every minute? | Price and band |
| :-- | :-- | :-- | :-- | :-- |
| Claude Code cloud routine, own schedule | 1 hour[^132] | No | No | Inside the Max plan |
| Claude Code cloud routine, started by an outside caller | No floor stated. 30 starts an hour per routine, 100 an hour per account. Experimental[^133][^134] | Allowed by the caps, if something else sends the call | Only with two or more routines | Inside the Max plan. Stops at the usage limit[^115] |
| Claude Code desktop scheduled task | 1 minute, started "a few minutes" late by design. Mac awake, lid open. A missed run is skipped[^135] | Only with those caveats | Not credible | Inside the Max plan |
| `claude -p` (Claude Code run without a person) under any scheduler | Whatever the scheduler allows.[^136] Still runs on a Max plan today.[^33] A mode needing an API key "will become the default", no date[^137] | Yes, on a host that is awake | Yes, plan usage not verified | Max plan limits, or API rates with a key |
| Claude Managed Agents | 1 minute[^32] | Yes, up to 45 seconds late | Yes | Category 1 |
| GitHub Actions | 5 minutes, and runs can be late or dropped[^138] | In principle, timing not guaranteed | No | 0 to about 8, published rates.[^139] Band 0 to 1 |
| Vercel Hobby | Once a day[^140] | No | No | 0. Non-commercial use only, and whether trading one's own account counts is not answered[^141] |
| Vercel Pro | 1 minute[^140] | Yes | Yes | 20, published.[^142] Each run ends at 800 seconds.[^143] Band 1 |
| Supabase (Pro) | 1 second, through scheduled jobs inside the database[^2] | Yes | Yes | 25 with one project covered, about 10 for each further project, published.[^45][^144] A function lives at most 400 seconds with 2 seconds of processor time per request.[^145] Band 1 |
| Cloudflare Workers | 1 minute[^146] | Yes | Yes | From 5, published.[^147] A Durable Object can also hold a live stream.[^148] Band 1 |
| A small always-on rented server | Its own scheduler (my inference, not quoted from a vendor page) | Yes (inference) | Yes (inference) | Fly.io 2.19,[^149] DigitalOcean 4,[^150] AWS Lightsail 3.50 to 5,[^151] Railway 5,[^152] Render 7,[^153] all published. Band 1 |
| Michael's Mac | Jobs run late or are skipped while it sleeps[^154] | Only while awake | Only while awake | 0 |

**Category 3: memory.** Where the agent keeps what it learned between runs.

| Candidate | How it works | Band |
| :-- | :-- | :-- |
| Files in the repository, and Claude Code's own notes | Each Claude session starts empty. Local notes live on the Mac, so a cloud run sees only what is committed or held elsewhere[^155] | 0 |
| A Postgres database (Supabase) | A database the software and Claude can both read. Supabase is in Anthropic's connector directory[^118] | 1[^45] |
| Managed Agents memory stores | Document collections that survive across sessions. Beta[^156] | Not priced separately on the pages read |

**Category 4: price data, with the delay stated for each.** A "sweep" means getting a current price for about 5,000 to 6,000 symbols, the rough size of the six indexes together (my arithmetic from the index sizes further down, allowing for overlap). A WebSocket is a connection that stays open so prices are pushed as they change.

| Candidate and plan | Price a month | Delay | Feed | Can it sweep every minute? |
| :-- | :-- | :-- | :-- | :-- |
| Alpaca, free plan | 0, published[^23] | Real time from IEX only, or the full feed 15 minutes late[^23] | IEX, about 2.5 percent of volume[^101] | Probably, by request. The symbols-per-request cap is not stated.[^157] Its stream is capped at 30 symbols[^25] |
| Alpaca, Algo Trader Plus | 99, published[^25] | Real time[^23] | SIP, every U.S. exchange[^158] | Yes. 10,000 requests a minute, or one stream of minute bars for every symbol[^157][^159] |
| Massive (formerly Polygon.io), Starter and Developer | 29 and 79, published[^1] | 15 minutes[^1] | Direct feeds plus the SIP[^160] | Yes, in one request, but 15 minutes old[^1] |
| Massive, Advanced | 199, published[^1] | Real time[^1] | Same[^160] | Yes, one request returns the whole market.[^1] Its individual terms say "display use only"[^106] |
| Tiingo, Power | 30, published[^24] | Real time[^161] | IEX only. The full IEX feed needs the user's own agreement with IEX[^162] | Yes, one request for every ticker[^163] |
| Tradier, with a brokerage account | Comes with the account[^26] | Real time. Its test system is 15 minutes late[^26] | Consolidated, all exchanges[^26] | Only if 50 symbols per request is accepted. 120 requests a minute, cap not stated[^164] |
| Interactive Brokers, free with an account | 0[^165] | Real time. No delayed U.S. data offered[^165][^102] | Two venues, not consolidated[^165] | No. 100 symbols at once by default[^166] |
| Webull API, with its data subscription | Gated and unverified, behind sign-in[^107] | Real time[^107] | Nasdaq Basic, not the SIP[^107] | Just: 100 symbols times 60 requests a minute[^167] |
| Databento, Standard | 199, published[^109] | Real time[^109] | A blend of several venues, not the SIP[^168] | Probably. Mechanism not verified[^109] |
| Twelve Data | 79, 229, 999, published, with a second conflicting price set on the same page[^169] | Real time[^108] | Venues with about 5 percent of volume[^108] | No on any individual plan below 999[^170] |
| Alpha Vantage, premium | 49.99 to 249.99, published[^171] | Real time or 15 minutes, after an entitlement step[^172] | Not stated[^172] | On paper: 100 symbols a request[^173] |
| EODHD | 19.99 to 99.99, published[^174] | 15 to 20 minutes by request. Its real-time stream is one exchange, 50 symbols[^175][^176] | One exchange for real time[^176] | Yes, delayed, in one request[^175] |
| Finazon | "from $4", a published claim this run could not confirm, because the product page redirected[^177] | Real time claimed[^177] | SIP claimed[^177] | Not verified |
| Schwab, Robinhood, Public, TradeStation, tastytrade data through their interfaces | Not verified[^178][^179] | Not verified | Not verified | Not verified |
| Finnhub, Financial Modeling Prep | Run 1 prices stand: Finnhub free tier,[^180] Financial Modeling Prep 0 to 139[^181] | Not verified in either run[^179] | Not stated | Not verified |

Reading the table (my summary of the rows above). Data 15 minutes late misses a 5 minute target, whatever it costs. The lowest published prices for real-time data able to cover the wide universe are: 0 or 30 dollars for IEX-only data, with the caution that a thinly traded small company may print no trade there for many minutes;[^101] 99 dollars for every exchange;[^25] and the cost of holding a brokerage account at a broker that includes consolidated data.[^26]

**Coverage of the universe preference.** Two separate questions, as in run 1.

*Question 1, can the feed price the stocks?* A feed covering every U.S. exchange-listed stock can price every member of all six indexes. Massive states coverage of every U.S. exchange plus over-the-counter trading.[^160] Alpaca's paid plan covers all U.S. exchanges but not over-the-counter stocks.[^158][^182] Databento covers all exchange-listed stocks and ETFs.[^183] Tradier's feed is consolidated from all exchanges.[^26] Twelve Data says it covers "the entire universe of listed US equities".[^108] The single-venue feeds (Alpaca free, Tiingo, Interactive Brokers free) carry the symbols but only the trades on those venues, which matters most for the thinly traded Russell 2000 names.[^101] Coverage statements for the remaining vendors are in the notes.[^184]

*Question 2, where does the list of members come from?* Unchanged from run 1 and reused.

| Index | Size | A free route to the member list | Gaps |
| :-- | :-- | :-- | :-- |
| Dow Jones Industrial Average | 30[^185] | State Street's daily holdings file for its Dow fund[^186] | A fund's holdings are a close stand-in, not the official list |
| S&P 500 | 503[^185] | Daily holdings files from State Street and iShares funds[^186] | Same. A paid constituents product exists at 29.99 a month[^187] |
| Nasdaq 100 | 101[^188] | The Invesco fund tracks it, but a downloadable file was not confirmed[^189] | The official list is sold through a Nasdaq service whose price is gated and unverified[^188] |
| Russell 2000 | 1,996[^190] | iShares' daily holdings file, which held 1,985 names[^186] | Rebuilt twice a year from 2026[^190] |
| NASDAQ Composite | 3,396[^191] | Nasdaq Trader's free symbol files, filtered[^192][^193] | The files also list preferred shares, warrants and funds, which must be filtered out[^193] |
| NYSE Composite | Over 2,000, from a reference site only[^194] | The same symbol files, filtered by listing exchange[^193] | No tracking fund was found. The only eligibility text read dates from 2004[^195] |

*Perpetual venues against the six indexes.* None comes close to the universe preference. The lawful venue lists one live index contract and no single stocks.[^17] The largest onchain venue, closed to U.S. residents, lists 59 U.S. common stocks, concentrated in very large and well-known companies.[^196] Small-company exposure exists anywhere only as thinly traded index or fund contracts.[^197][^198]

**Category 5: news, filings and calendars.** Unchanged from run 1 and reused.

| Candidate | What it gives | Price and band |
| :-- | :-- | :-- |
| SEC EDGAR, the regulator's filing system | Company filings and reported figures, updated within about a second of filing, no key needed, up to 10 requests a second[^199][^200] | 0 |
| Alpaca news | Supplied by Benzinga, real time over a stream. Whether the free plan includes it is not stated[^201] | Not verified |
| Massive add-ons | Benzinga news, earnings and ratings at 99 each[^202] | 2 each |
| EODHD | News in every plan. Earnings calendar in the 59.99 and 99.99 plans[^203] | 0 to 2 |
| Finnhub free tier | Company news and a one month earnings calendar[^180] | 0 |
| Connectors listed in Anthropic's directory | MT Newswires, Aiera, Quartr, Zacks Data, Morningstar and others. Prices not researched[^204] | Not researched |

**Category 6: alternative data and web reading.** Unchanged from run 1 and reused.

| Candidate | What it gives | Price and band |
| :-- | :-- | :-- |
| Quiver Quantitative | Trades by members of Congress, government contracts, lobbying, off-exchange trading and, on the higher plan, insider trades and hedge fund holdings. Its own hosted MCP server is included[^205][^206] | 30 or 75 a month, published.[^205] Band 2 |
| Firecrawl | Reads and searches web pages for an agent. Listed in Anthropic's directory with its own connector[^207] | Free 1,000 credits a month, then 19 a month, published.[^208] Band 0 to 1 |
| Coinversa Pulse (new in the directory, September 2026) | Read-only data from Hyperliquid, including its stock markets: "Over 100 tools, all read-only"[^209] | Free account, paid plan gated and unverified[^209] |

**Category 7: seeing and controlling.** How Michael watches the agent, sets its limits and stops it. Per-order approval is no longer required, so this category is now about limits and an off switch. Candidates: the Claude apps themselves (options A, D and F), a web dashboard on Vercel (options B, D and F),[^142] the broker's own app, and the broker's own controls where they exist, such as Alpaca's borrowing cap and order block[^75] and Robinhood's push notification for every agent trade (press report).[^210] No separate price beyond categories 1 and 2.

**Category 8: brokerage and order execution, including perpetual venues.** "No human step" means software or an agent can place an order without a person confirming it. "Sign-in" means how long software can keep working before a person must sign in again. Commission is not the whole cost of trading: a small regulatory fee applies to sales.[^211]

| Broker | Rule applied (section B) | Route, and is there a human step? | Sign-in | Margin rate under 25,000 borrowed | Stock and ETF cost | Notes for 10,000 to 25,000 dollars |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Alpaca | New[^8] | API with keys. Official MCP server, runs locally, places orders. No human step[^212][^213] | Keys, no expiry stated[^212] | 6.50 percent, overnight balances only, published[^58] | 0 commission, published[^214] | Borrowing cap of 1, 2 or 4 set by the customer.[^75] Practice trading with pretend money.[^215] Every account is a margin account[^216] |
| Charles Schwab | New[^6] | API for an individual's own account.[^217] No official connector found[^218] | A person signs in again every 7 days, per two community sources, strength D[^219] | 12.075 percent, published[^68] | 0 online, published[^220] | 2,000 minimum to borrow.[^68] Blocks orders that would create a deficit.[^6] Michael has a cash account here (not counted for or against) |
| Public | New[^80] | API key, margin accounts supported.[^62] Official hosted MCP server.[^221] A review site says its agents run unattended once approved, strength C[^222] | Not verified | 5.15 percent, published, possibly introductory[^30] | 0, published[^223] | No short selling offered.[^62] Public may end API access at any time without notice[^224] |
| Webull | New[^81] | Direct API places orders, no confirmation mentioned.[^225] Hosted connector: a stock order "requires confirmation in Webull APP / Desktop"[^226] | Lapses after 15 idle days[^227] | 8.74 percent, published[^71] | 0, published[^228] | Reports open margin calls through the API.[^229] Data for the API is a separate subscription, price gated[^107] |
| TradeStation | New[^82] | Ordinary API, no per-order step stated.[^230][^231] Official connector "requires explicit confirmations before orders are placed"[^232] | Does not expire by default[^230] | 12.00 percent, published[^73] | 0 commission plus a per-share clearing fee, published[^233] | TradeStation's own pages disagree on a minimum for the connector. Its home page says "MCP now available without account minimum".[^234] Data embedded in the connector page's source, not in its visible text, still says "a minimum eligible account balance of $10,000".[^232] Not resolved. The visible statement is probably the current one (my judgment) |
| tastytrade | New, moderate confidence[^83] | Personal API application.[^235] Official self-hosted MCP server. A review site reports its confirmation token is not a human approval, strength C[^236][^222] | Does not expire[^235] | Not verified | 0 to open and close, published[^237] | Reports margin calls and closing-only status through the API[^238] |
| Interactive Brokers | Mixed[^85] | Web API through a small program the customer runs. Software can confirm its own order prompts.[^239][^240] Official connector only drafts: "Claude never submits orders directly to the market."[^119] | Desktop route: a person signs in about weekly.[^241] Web route: not verified[^242] | 5.38 percent on Pro, published[^70] | Pro only for the API: 0.005 a share, corroborated by NerdWallet and curvedtrading.com[^243] | One sign-in can hold one trading session at a time, so Michael using the app would compete with the agent[^242] |
| Tradier | Not confirmed[^10] | API token. Official hosted MCP server that places orders[^244][^245] | Personal token. Whether it expires is still not stated[^246] | 9.75 percent, published[^72] | 0.35 a trade, or 0 on the 10 a month plan, published[^211] | Consolidated real-time data comes with the account[^26] |
| Robinhood, Agentic account | Not applicable[^77] | Official connector only. Approvals are off by default for outside agents: "your agent can place eligible trades for you without your manual confirmation of each order." "Certain trades may still require your approval"[^34] | Not stated[^247] | No borrowing[^77] | Not verified | The agent trades only in a separate account holding what Michael deposits there.[^124] Unsettled proceeds are usable without borrowing[^77] |
| E*TRADE | New[^7] | API.[^248] No official connector[^249] | **A person signs in every day**[^250] | 12.45 to 12.70 percent, published[^31] | 0 online, published[^251] | Ruled out for unattended running by the daily sign-in (my inference from the weekly sign-in limit Michael set) |
| moomoo (new in run 2) | Not verified | Official API through a program the customer runs, and an official hosted MCP server that can trade. Approval is a setting. Starts in practice mode[^252] | Not verified | Not verified | 0 per one review, strength C[^252] | Facts are thin. Only the landing pages were read |
| Lightspeed (new in run 2) | Not verified | Official streaming API with practice trading. No connector found[^253] | Not verified | Not verified | Not verified | Facts are thin |
| Fidelity | | No retail API, per one review source, strength C[^254] | | | | |

| Perpetual venue | Open to a U.S. resident? | U.S. equity contracts today | Where the money sits | Software access | Notes |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Kalshi (regulated by the CFTC) | **Yes**, after identity checks and approval for a margin account[^18] | One live index contract, US500. A second index contract is listed but inactive. No single stocks live. About 60 in its test system[^17][^255] | In dollars at Kalshi Prime, a registered futures broker, "in a customer-segregated account". Not a wallet[^18] | A trading API exists, with a practice system. **Whether a retail customer can get a key for it is not verified**[^20] | Trades Sunday evening to Friday evening, not weekends.[^100] About 13.7 times maximum leverage shown.[^17] Fee rates gated and unverified.[^256] About 7.7 million dollars traded a day on the day read.[^17] No MCP server found[^257] |
| Coinbase Derivatives (regulated by the CFTC) | Not verified[^96] | Index contracts exist, per the CFTC.[^95] Single stocks pending[^91] | Not verified | Not verified | |
| Bitnomial, Nadex (regulated by the CFTC) | Filed, pending[^92][^93] | None live | | | A plan to offer Hyperliquid-deployed contracts to U.S. clients through Bitnomial is announced and pending[^258] |
| Hyperliquid, through the trade.xyz deployer | **No**, by its terms[^11][^12] | 59 U.S. common stocks and two index contracts[^196] | The user's own wallet, in USDC[^257] | Free public data, a test network, and trading keys that cannot withdraw money[^259][^260] | About 2.6 billion dollars traded a day across the deployer's markets[^196] |
| Lighter | **No**, by its terms, which cover its API[^13] | About 24 stocks and several index or fund contracts[^198] | The user's own wallet[^261] | API keys that can withdraw only to the creating wallet[^261] | Zero fees on standard accounts[^262] |
| Ostium | **No**, "no exceptions"[^14] | 35 stocks and three indexes, regular hours only[^263] | The user's own wallet, in USDC[^264] | Public price data and a delegate key[^264] | Lost about 18 million dollars to an attack on its price feed in July 2026[^265] |
| Liquid (a front end to the three above) | Terms silent, defer to the venues, ban VPNs[^41] | Eight examples named, count not published[^266] | A wallet the user controls[^40] | Its own hosted MCP server, and the "Co-Invest Computer" mode[^267][^39] | See section 1.2 |

Band for brokerage: 0 to 1 for every broker with a verified price. Borrowing is priced separately, as a rate on what is borrowed, not as a monthly band.

In the score tables below, run modes and memory modes use the same 1 to 5 scale. Event-triggered mode is scored in two parts. "Callback" means something else wakes the agent with a web request. "Price event" means how soon the option itself notices a price change, scored against the 5 minute target: seconds scores 5, about a minute scores 4, 5 minutes with caveats scores 3, hourly scores 2. Run 1 called the second part "stream". It is re-derived here because the requirement is a reaction time, not a type of connection.


### Option A: Claude-native agent

**The architecture in plain English.** Little or no program is written. Claude is the agent. A run starts on a timer or when Michael asks. Claude reads its instructions file, calls connectors to fetch prices, news and filings, reasons about them, decides, and calls a broker connector to place the order inside limits written into its instructions and, where the broker offers them, set at the broker. This is the "Claude-native agent built on connectors and MCP servers" named in this repo's `CLAUDE.md`.

**Driver models supported.** Claude Code itself doing the work: yes. Software that runs on its own: no. A close relative, Anthropic's hosted Managed Agents, is Claude doing the work through an API key, without Claude Code.[^32]

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | Claude Max subscription, or an API key | 2 or 3 on the plan.[^46] By model and cadence on a key, estimated 1 to 3[^129] |
| 2. Where it runs | For a 5 minute cadence: `claude -p` under a scheduler on a machine that is awake,[^33] Managed Agents on a schedule,[^32] or a cloud routine started by an outside caller.[^133] A routine's own schedule stops at hourly,[^132] and desktop tasks start "a few minutes" late[^135] | Inside category 1 |
| 3. Memory | Files in the repository, or a database reached through a connector[^155][^118] | 0 to 1 |
| 4. Price data | Vendors with their own MCP server: Massive,[^268] Alpaca,[^269] Twelve Data,[^270] Alpha Vantage,[^271] EODHD.[^272] A connector answers when Claude asks. A whole-market answer of over 10,000 tickers[^1] is more than a model can sensibly read each run, so this option suits a short watch list (my inference) | 0 to 3, by plan |
| 5. News and filings | Directory connectors such as MT Newswires, Aiera and Zacks Data,[^204] and SEC EDGAR read over the web[^200] | 0 upward, not researched |
| 6. Alternative data and web reading | Quiver's MCP server,[^206] Firecrawl's connector,[^207] Coinversa Pulse[^209] | 0 to 2 |
| 7. Seeing and controlling | The Claude apps themselves, plus the broker's own controls | 0 |
| 8. Brokerage and perpetual venues | See below | 0 to 1 |

Coverage of the universe preference depends on the price data candidate, as set out in 4.0.2. This option narrows it in practice, because every symbol looked at costs model usage (my inference).

**Brokerage and order execution candidates.** The fit is brokers with an official MCP server.

- An agent can place an order with no human step: Robinhood's Agentic account, where approvals are off by default for outside agents,[^34] Alpaca's server, which starts in practice mode,[^213] Tradier's,[^245] and, per a review site, Public's, tastytrade's and moomoo's.[^222]
- Draft or confirm only: Interactive Brokers,[^119] Webull's hosted connector,[^226] and TradeStation, which "requires explicit confirmations before orders are placed".[^232]
- No official server found: Schwab,[^218] E*TRADE[^249] and Fidelity.[^254] A community-built server would hold the sign-in to a real brokerage account, which is a risk in itself (my judgment).
- Perpetual venue: Kalshi has no MCP server.[^257] Claude Code could call its API by writing and running code inside a session, which would put the signing key within reach of a model (my inference), and retail access to that API is unverified.[^20] Liquid has a connector built for exactly this option,[^39] and section 1.2 says why it is out.

**Account and regulatory rules that affect it.**

- On a Max plan, the Consumer Terms passage on securities applies to the whole option.[^111][^27] On an API key, the Commercial Terms apply and contain no such passage.[^28]
- In this option a model picks each trade. The Usage Policy effective November 12, 2026 requires review by a qualified person "before it is used to implement a decision", and its exclusion for "a fixed rule, formula, or algorithm where the model exercises no judgment" does not obviously describe this shape (my reading).[^29]
- A cloud routine runs with no permission prompts and with every included connector's tools available.[^115] On Managed Agents a connector's tools pause for approval unless set to run freely.[^116] Claude Code offers hooks, fixed code that runs before a tool call and can block it, which could serve as a hard gate.[^273]
- The margin rule applied depends on the broker (section B). Robinhood's agent account cannot borrow at all,[^77] which removes the margin question and also removes Michael's plan to borrow as the agent proves itself.
- Usage is one pool shared with all of Michael's other Claude use,[^125] and its size is not published.[^126]

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Unattended order path inside fixed limits | 2 | Order-capable connectors with no human step exist.[^34] But on the plan the terms list this use as prohibited,[^27] and on a key the limits are still held by a model following instructions, backed only by whatever the broker offers. Between the anchors for 1 and 3 |
| Meeting the 5 minute target across a wide universe | 3 | A 5 minute cadence is reachable,[^32][^33] with the anchor's caveats: a short watch list, or a machine that must stay awake |
| Flexibility | 2 | One driver model. Strong on demand, weaker on a timer |
| Operability for a non-coder | 4 | Almost nothing to build. Not 5, because an unattended 5 minute cadence needs a scheduler somewhere, and the usage pool is shared[^125] |
| Safety of an agent that acts alone | 2 | A model sends the orders. Fixed checks exist only at the broker, or in hooks if they are written[^273] |
| Platform cost | 3 | 100 a month at the lower Max tier,[^46] or an estimated 90 on Sonnet at 78 runs a day on a key[^129] |
| Reach to a lawful perpetual venue | 3 | Reachable only by Claude running code with the key in its hands, the anchor's "material weakness". No connector exists[^257] |
| Reversibility | 4 | Connectors swap without rewriting. The driver cannot change |
| **Weighted total** | **2.75** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 4 | Every minute on Managed Agents,[^32] or under any scheduler with `claude -p`.[^33] Hourly at best on a routine's own timer[^132] |
| Event, callback | 3 | A web request can start a routine, 30 an hour, experimental[^133][^134] |
| Event, price event | 3 | Notices at its next run. Five minutes, with the caveats above |
| On demand | 5 | Its natural mode |
| Memory kept across runs | 3 | Possible through committed files or a database, but each session starts empty[^155] |
| Each run independent | 5 | The default[^155] |

**Pros.**

- Almost nothing to build, host or repair.
- Fastest route to a working research assistant.
- Providers swap by changing a connector.
- Strong at reading unstructured material such as filings and news (my judgment).
- One broker has built an account type for exactly this, with no borrowing and a spending limit equal to what is deposited.[^124][^77]

**Cons.**

- A model, not fixed code, decides and sends each order.
- The terms questions sit on the whole option.[^27][^29]
- Cannot sensibly watch thousands of names (my inference from the size of a whole-market answer[^1]).
- Competes with Michael's own Claude use for one pool of unpublished size,[^125][^126] or costs an estimated 90 to 180 a month on a key at Sonnet or Opus rates.[^129]
- Three of the official broker connectors will not send an order by themselves.[^119][^226][^232]
- Reaching the lawful perpetual venue means handing a signing key to a model session (my inference).

**Failure mode.** The limits are softer than they look. It works well as a research assistant, and it can place small orders at a broker built for agents. Then one of three things happens, most likely in this order: the shared usage pool or the bill runs out part way through a session, with positions open; the terms question is answered the wrong way; or the model, on an odd day, reads its instructions differently, and the only fixed limit that holds is the one at the broker.

### Option B: scheduled web app

**The architecture in plain English.** A database, a timer, a few small programs and a screen, with nothing that stays running in between. This is the shape of Relii: Next.js deployed on Vercel, with Supabase for the database, sign-in and file storage.[^274] A timer inside the database fires every minute during market hours. It wakes a small program (a function) that asks a data provider for current prices, applies fixed rules, checks any order against fixed limits, sends it to the broker, and writes down what it did. The screen shows positions, the limits, the log and an off switch. Compared with run 1's version there is no settled cash ledger and no approve button, because the account may be a margin account and the agent may act alone.

**Driver models supported.** Software that runs on its own: yes. Claude Code itself doing the work: not as the driver, though Claude can read the same database through the Supabase connector for questions on demand.[^118]

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | None, or the Claude API called from a function | 0, or by run frequency |
| 2. Where it runs | Supabase's scheduled jobs and functions,[^2][^145] with Vercel for the screen. The free Vercel tier allows a timed job once a day, so the timer cannot live there,[^140] and it is limited to non-commercial use.[^141] Vercel Pro can also hold the timer[^140] | 1 to 2 |
| 3. Memory | Supabase Postgres | 1[^45][^144] |
| 4. Price data | Vendors that answer a request for many symbols at once: Alpaca at 99 for every exchange,[^157] Massive at 199,[^1] Tiingo at 30 for IEX only,[^163] or a broker's own data such as Tradier's[^164] | 0 to 3 |
| 5. News and filings | SEC EDGAR,[^199] vendor news feeds[^203] | 0 to 2 |
| 6. Alternative data and web reading | Quiver's API,[^205] Firecrawl's API[^208] | 0 to 2 |
| 7. Seeing and controlling | The screen on Vercel, plus the broker's own controls | Inside category 2 |
| 8. Brokerage and perpetual venues | See below | 0 to 1 |

Universe coverage is as in 4.0.2. This is the option where the wide universe depends on one unmeasured thing: whether a short-lived function can fetch and work through a whole-market answer inside its limits every minute. The vendor does not state how large that answer is,[^1] and a Supabase function has 2 seconds of processor time per request.[^145]

**Brokerage and order execution candidates.** The fit is brokers whose interface works by request, with a sign-in that lasts, on the new margin rule: Alpaca,[^212][^8] Public,[^62][^80] tastytrade,[^235][^83] TradeStation's ordinary API,[^230][^82] and Webull's direct API.[^225][^81] Tradier fits by interface, with its margin rule unconfirmed.[^10] Schwab fits only with a sign-in page that Michael visits weekly (my inference from its reported 7 day cycle[^219]). Interactive Brokers' web route needs a small program kept running, which this option has nowhere to run.[^239] Robinhood's agent account is reached through its connector, not by request from a program, on the evidence found.[^275]

Perpetual venue: a function can call Kalshi's trading API by request,[^20] once retail access is confirmed. It cannot hold that API's live connection.[^276]

**Account and regulatory rules that affect it.**

- The margin rule applied depends on the broker (section B). The function must read buying power and margin state from the broker before each order. Alpaca's, Webull's and tastytrade's interfaces report them.[^277][^229][^238]
- The borrowing cap can sit in two places: in the function's own check, and at the broker where one is offered.[^75]
- Vercel runs functions in Washington DC unless told otherwise.[^278] This repo's `CLAUDE.md` places a Supabase database in Oregon and records what leaving the two apart cost Relii, so the function region would need pinning.
- If no language model is called, none of Anthropic's terms bear on the running system. If a function calls Claude, the Commercial Terms and the Usage Policy apply,[^111][^29] and the shape is fixed code applying rules.
- Software reads the prices with no person watching, so the non-display question applies.[^104]

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Unattended order path inside fixed limits | 4 | Fixed code calls the broker directly, at a broker documented on the new rule with a customer-set borrowing cap.[^8][^75] Not 5, because broker terms on automation were not read, the key can change its own cap,[^75] and the data licensing question is open[^104] |
| Meeting the 5 minute target across a wide universe | 4 | A check every minute on real-time data, well inside the target.[^2][^157] Not 5: no live stream,[^276] and the whole-market sweep inside a function is unmeasured |
| Flexibility | 3 | One driver model. Held at 3, not 2, because Claude can read the same database beside it |
| Operability for a non-coder | 4 | Code exists, but on fully managed services with no always-on part. Each run starts fresh, so a failed minute is followed by a clean one (my judgment) |
| Safety of an agent that acts alone | 4 | Fixed checks in code and a cap at the broker, with no model in the order path.[^75] Not 5, for the reason given under criterion 1 |
| Platform cost | 3 | 20 for Vercel Pro plus 10 to 25 for Supabase.[^142][^45][^144] Nearer band 1 if the timer lives in Supabase and the screen is not needed |
| Reach to a lawful perpetual venue | 4 | Can call the venue's API by request.[^20] Not 5: it cannot hold the live connection[^276] |
| Reversibility | 3 | His own code and data, portable with rewriting |
| **Weighted total** | **3.70** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 4 | Every second inside Supabase,[^2] every minute on Vercel Pro,[^140] each run short[^145][^143] |
| Event, callback | 4 | A web request can wake a function at any time. A TradingView alert could be the caller, if the function answers within three seconds[^51] |
| Event, price event | 4 | Notices at the next check, about a minute |
| On demand | 5 | Open the screen |
| Memory kept across runs | 5 | The database |
| Each run independent | 5 | Each function run starts fresh |

**Pros.**

- No server to keep alive.
- Meets the 5 minute target on paper without a stream.
- Fixed code, not a language model, in the order path.
- Durable memory in a real database, and a natural place for limits and an off switch.
- Uses the stack this repo's owner already builds on (noted, not scored).
- Lowest cost of the options that can watch a wide universe, apart from the bare worker.

**Cons.**

- No live stream, so it reacts on the next check, not on the price change.[^276]
- The wide sweep inside a function's limits is an inference, not a measurement.[^145][^1]
- Only one driver model.
- Two platforms whose regions must be kept aligned.[^278]
- Learns that an order filled only by asking again.
- More code than option A.

**Failure mode.** It quietly narrows. The whole-market sweep proves too heavy or too slow for a short-lived function, so the watch list is cut to what fits, then cut again when a second data source is added, and "as many names as possible" erodes into a few hundred without anyone deciding that. The alternative ending is an always-on piece bolted on later, which is option C or D reached in the wrong order.

### Option C: always-on worker

**The architecture in plain English.** One program that stays running through market hours on a small rented computer. It opens a live connection to the price source and to the broker and keeps both open. It applies fixed rules to every price change, checks each order against fixed limits, sends it, and records it. Claude Code writes the program. Claude takes no part while it runs, unless the program is written to ask Claude through the API.

**Driver models supported.** Software that runs on its own: yes. Claude Code itself doing the work: no.

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | None, or the Claude API | 0, or by run frequency |
| 2. Where it runs | A small always-on rented server,[^149][^150][^153][^152][^151] or a Cloudflare Durable Object[^148] | 1 |
| 3. Memory | A file or small database on the same machine (my inference), or Supabase[^45] | 0 to 1 |
| 4. Price data | Vendors with a stream for every symbol: Alpaca at 99,[^159] Massive at 199 (or the same stream 15 minutes late at 29),[^279] Databento at 199,[^109] and broker streams | 0 to 3 |
| 5. News and filings | SEC EDGAR,[^199] vendor news streams[^201] | 0 to 2 |
| 6. Alternative data and web reading | Quiver's API,[^205] Firecrawl's API[^208] | 0 to 2 |
| 7. Seeing and controlling | Nothing built in. Alerts, a screen and an off switch have to be written. The broker's own controls still apply[^75] | 0 |
| 8. Brokerage and perpetual venues | See below | 0 to 1 |

Universe coverage is as in 4.0.2. This is the option where a stream of every symbol's minute bar is usable directly.[^159][^279]

**Brokerage and order execution candidates.** The widest fit of any option, because the program can hold whatever connection the broker requires: every broker listed for option B, plus Interactive Brokers, whose gateway program could run on the same server,[^239] and Schwab with a weekly human sign-in.[^219] E*TRADE's daily sign-in rules it out for unattended running.[^250]

Perpetual venue: the worker can use all of Kalshi's API, including its live connections,[^20] once retail access is confirmed.

**Account and regulatory rules that affect it.**

- The margin rule applied depends on the broker (section B).
- A stopped worker matters more with borrowed money. At Schwab, positions beyond the overnight limit must be closed by 8 p.m. Eastern or a margin call may follow,[^6] and brokers may sell without notice.[^67][^68]
- The non-display question applies most directly here, because a program consumes a live feed with no person watching.[^104][^106]
- If no language model runs, none of Anthropic's terms bear on the running system.

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Unattended order path inside fixed limits | 4 | As option B, with live order status as well.[^8][^75] Not 5 for the same three reasons |
| Meeting the 5 minute target across a wide universe | 5 | Holds a stream of every symbol and reacts in seconds.[^159] For a rented server, that it stays up all session is my inference. For a Durable Object it is documented[^148] |
| Flexibility | 3 | One driver model. On demand is weak without an interface |
| Operability for a non-coder | 2 | A program he is responsible for keeping alive, silent by default |
| Safety of an agent that acts alone | 3 | Fixed checks in code and at the broker. But a stopped or hung worker can leave a borrowed position open with nobody told, the anchor for 3 |
| Platform cost | 4 | 2.19 to 7 a month for the server[^149][^153] |
| Reach to a lawful perpetual venue | 5 | Can use the whole interface, live connections included[^20] |
| Reversibility | 3 | His own code, portable with rewriting |
| **Weighted total** | **3.65** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 5 | Any interval (my inference for a rented server; one minute documented for Cloudflare[^146]) |
| Event, callback | 4 | A running server can receive web requests (my inference) |
| Event, price event | 5 | Seconds. Its purpose |
| On demand | 3 | Nothing to ask unless an interface is built |
| Memory kept across runs | 5 | Local storage or a database |
| Each run independent | 4 | Possible by design, though a long-running program naturally carries state |

**Pros.**

- Reacts to price changes in seconds, faster than the target asks.
- Lowest platform cost.
- Fixed code only in the order path.
- Works with the widest set of brokers and with every part of the lawful perpetual venue's interface.
- Can run with no language model at all, which sets the Anthropic terms questions aside.

**Cons.**

- A server and a program are his to keep alive: restarts, reconnecting after a dropped stream, updates.
- Silent when it fails, unless alerting is built.
- No way to ask it a question without building an interface.
- Only one driver model.
- Its main strength, speed, exceeds what Michael has asked for.
- That a 2 to 7 dollar server holds a stream reliably all session is inferred, not measured.

**Failure mode.** It stops and nobody notices, and this time the position may be borrowed. The program hangs or the stream drops without an error in the middle of a session. A position opened on intraday buying power is still open at the close, and the first sign is a margin call or a forced sale. Michael cannot diagnose a stopped program himself.


### Option D: always-on worker plus Claude on top

**The architecture in plain English.** Run 1's pick, unchanged. Two layers that share one database.

- **The worker** is the program from option C. It stays running through market hours, listens to live prices, checks every order against fixed limits, and is the only part that talks to the broker.
- **Claude** is the research and explanation layer. On a schedule or when asked, Claude reads the database and the research connectors, then writes research notes, a watch list and settings back to the database. The worker acts only on what is in the database, and only inside its fixed limits.

In this design Claude never holds a broker connection (a design choice, my judgment), so no order travels through a Claude subscription.

**Driver models supported.** Both. Claude Code itself does the research runs. Software that runs on its own does the watching and the order handling. This is a fact about the option, not a choice of driver.

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | Claude Max subscription for the research layer, or the Claude API with a key. Max includes a monthly API credit of 100 or 200[^128] | 2 or 3 |
| 2. Where it runs | Worker: a small always-on server or a Cloudflare Durable Object.[^149][^148] Claude: routines, `claude -p` under a scheduler, Managed Agents, or on demand[^132][^33][^32] | 1, plus category 1 |
| 3. Memory | One shared Postgres database. Supabase is in Anthropic's connector directory, which is how Claude would reach it[^118][^45] | 1 |
| 4. Price data | A stream for the worker (as option C). An MCP server for Claude's research (as option A). Massive and Alpaca offer both[^279][^268][^159][^269] | 0 to 3 |
| 5. News and filings | As options A and C[^199][^204] | 0 to 2 |
| 6. Alternative data and web reading | Quiver,[^206] Firecrawl[^207] | 0 to 2 |
| 7. Seeing and controlling | The Claude apps, the broker's own controls,[^75] and optionally a screen | 0 to 1 |
| 8. Brokerage and perpetual venues | As option C | 0 to 1 |

Universe coverage is as in 4.0.2, and as in option C the worker is where a stream of every symbol is usable.

**Brokerage and order execution candidates.** The same as option C, because the worker is the same program, including the whole of Kalshi's interface once retail access is confirmed.[^20]

**Account and regulatory rules that affect it.**

- As option C for margin, margin calls and data licensing.
- The research layer involves Claude in research about securities. On a Max plan that is under the Consumer Terms passage quoted in section F.[^27] Run through an API key it is under the Commercial Terms, where no such passage was found.[^28] The Usage Policy applies either way.[^29]
- The shape is fixed code applying rules, with Claude researching and setting parameters. The Usage Policy's exclusions name both "research" that is "not the ultimate" recommendation[^113] and "applying a fixed rule".[^29] Whether a setting Claude writes each morning is "a fixed rule" or a recommendation is not answered by the text (my reading), and is an open question.
- A routine includes every connector with write access unless it is removed.[^115] In this design the research routine needs no broker connector at all, so there is nothing order-capable to remove (my judgment).

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Unattended order path inside fixed limits | 4 | Same as option C. The order path is fixed code and does not pass through a Claude subscription |
| Meeting the 5 minute target across a wide universe | 5 | Same as option C[^159][^148] |
| Flexibility | 5 | Both driver models, and every run mode at 4 or above |
| Operability for a non-coder | 2 | The most parts of any option. Claude can at least be asked what the worker is doing (my judgment), which softens option C's silence but does not remove the upkeep |
| Safety of an agent that acts alone | 3 | The same worker as option C, so the same anchor: a stopped worker can leave a borrowed position open. The Claude layer adds explanation, not a fixed check. Run 1 gave this option a 4, under a rubric that counted a person approving each order |
| Platform cost | 2 | The plan at 100 or 200,[^46] the database at 10 to 25,[^45][^144] the server at 2.19 to 7[^149][^153] |
| Reach to a lawful perpetual venue | 5 | Same as option C |
| Reversibility | 4 | Each half can be replaced without touching the other (my judgment) |
| **Weighted total** | **3.80** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 5 | The worker at any interval. Claude as in option A |
| Event, callback | 5 | The worker can receive a callback, and can itself start a Claude routine with a web request when something needs research[^133] |
| Event, price event | 5 | The worker, in seconds |
| On demand | 5 | Ask Claude, which reads the shared database |
| Memory kept across runs | 5 | The shared database |
| Each run independent | 4 | Claude's runs start empty by default.[^155] The worker naturally carries state |

**Pros.**

- Supports both driver models.
- Every run mode at 4 or above, and the fastest reaction of any option.
- No language model in the order path.
- Reaches every part of the lawful perpetual venue's interface.
- Gives a non-coder a way to ask a running system what it is doing.
- Either half can be replaced.

**Cons.**

- The most moving parts: a worker, a database, Claude, and connectors.
- The highest platform cost, band 3 when the plan is counted.
- Still carries option C's server upkeep, now with borrowed money at stake.
- Its speed exceeds the 5 minute target Michael set.
- Two layers can disagree, and someone has to decide which is right.
- The terms questions still apply to the research layer.[^27][^29]

**Failure mode.** The worker is built before anyone knows it is needed. The seams and the server upkeep are as run 1 described. The more likely disappointment now is different: months go into keeping an always-on program healthy, and a check every minute would have caught the same moves. With a 5 minute target, the worker is insurance bought before the risk has been measured.

### Option F: scheduled core plus Claude on top

**The architecture in plain English.** Option B with option D's second layer. Two layers that share one database, and nothing that stays running.

- **The scheduled core** is option B: a timer in the database, a few small programs that Claude Code writes, a data provider that answers for the whole watch list at once, fixed rules, fixed limits, and a direct line to the broker. It is the only part that talks to the broker.
- **Claude** is the research and explanation layer, exactly as in option D. It reads the database and the research connectors, and writes research notes, a watch list and settings back. It can also be asked, at any time, what the core did and why.

This combines the two directions named in this repo's `CLAUDE.md`: the Relii-style stack does the fast, exact work, and the Claude-native layer does the research. If measurement later shows that a check every minute is not fast enough, the core's timer is replaced by option C's worker and the result is option D. The database, the limit checks and the Claude layer stay as they are (my judgment).

**Driver models supported.** Both. Claude Code itself does the research runs. Software that runs on its own does the watching and the order handling. This is a fact about the option, not a choice of driver: the Claude layer can be made thicker or thinner later, down to option B at one end.

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | Claude Max subscription for the research layer, or the Claude API with a key[^46][^128] | 2 or 3 |
| 2. Where it runs | Core: Supabase's scheduled jobs and functions, with Vercel for the screen.[^2][^145][^140] Claude: routines, `claude -p` under a scheduler, Managed Agents, or on demand[^132][^33][^32] | 1 to 2, plus category 1 |
| 3. Memory | One shared Postgres database, reached by Claude through the Supabase connector[^118][^45] | 1 |
| 4. Price data | For the core, a vendor that answers for many symbols at once (as option B).[^157][^1][^163] For Claude's research, an MCP server (as option A). Alpaca and Massive offer both[^269][^268] | 0 to 3 |
| 5. News and filings | As options A and B[^199][^204] | 0 to 2 |
| 6. Alternative data and web reading | Quiver,[^206] Firecrawl[^207] | 0 to 2 |
| 7. Seeing and controlling | The Claude apps, a screen on Vercel, and the broker's own controls[^75] | Inside categories 1 and 2 |
| 8. Brokerage and perpetual venues | As option B | 0 to 1 |

Universe coverage is as in 4.0.2, with option B's caveat: the wide sweep inside a short-lived function is unmeasured.[^145][^1] The Claude layer offers one way round it that option B lacks: Claude can screen the wide universe once a day and hand the core a shorter live list (my judgment, and a design choice this run does not make).

**Brokerage and order execution candidates.** The same as option B: Alpaca, Public, tastytrade, TradeStation's ordinary API and Webull's direct API on the new margin rule,[^8][^80][^83][^82][^81] Tradier with its rule unconfirmed,[^10] and Schwab with a weekly sign-in.[^219] Kalshi's API by request, once retail access is confirmed.[^20]

**Account and regulatory rules that affect it.**

- As option B for margin, buying power checks, region pinning and data licensing.
- As option D for Anthropic's terms: Consumer Terms on the plan,[^27] Commercial Terms on a key,[^28] the Usage Policy either way,[^29] and the same open question about whether a setting Claude writes is a fixed rule or a recommendation.
- As in option D, the research layer needs no broker connector, so a routine has nothing order-capable in its hands (my judgment).[^115]

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Unattended order path inside fixed limits | 4 | Same as option B. The order path is fixed code and does not pass through a Claude subscription |
| Meeting the 5 minute target across a wide universe | 4 | Same as option B: a check every minute on real-time data, no stream, the sweep unmeasured[^2][^157][^276] |
| Flexibility | 5 | Both driver models, and every run mode at 4 or above |
| Operability for a non-coder | 3 | Everything is hosted by platforms that keep it running, which is the anchor for 3: more than two parts to keep in step (the core, the database, Claude, connectors), none of them always-on. One point below option B for the extra layer, one above option D for the absent server |
| Safety of an agent that acts alone | 4 | Same as option B: fixed checks in code and a cap at the broker, no model in the order path.[^75] The Claude layer does not add a fixed check and is not scored as one |
| Platform cost | 2 | The plan at 100 or 200,[^46] the database at 10 to 25,[^45][^144] Vercel Pro at 20 if used[^142] |
| Reach to a lawful perpetual venue | 4 | Same as option B[^20][^276] |
| Reversibility | 4 | Each half can be replaced without touching the other, and the core can be exchanged for a worker (my judgment) |
| **Weighted total** | **3.80** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 4 | The core every minute or faster, each run short.[^2][^145] Claude as in option A |
| Event, callback | 5 | A web request can wake a function, and a function can start a Claude routine with a web request when something needs research[^133] |
| Event, price event | 4 | The core notices at its next check, about a minute |
| On demand | 5 | Ask Claude, which reads the shared database, or open the screen |
| Memory kept across runs | 5 | The shared database |
| Each run independent | 5 | Each function run starts fresh, and Claude's runs start empty by default[^155] |

**Pros.**

- Supports both driver models, with nothing that has to stay running.
- Meets the 5 minute target on paper.
- No language model in the order path.
- Can be built in stages, and the first stage is option B, which is useful alone (my judgment).
- Becomes option D by adding one part, if measurement ever calls for it.
- Gives a non-coder a way to ask the system what it did and why.

**Cons.**

- Inherits option B's unmeasured point: the wide sweep inside a function's limits.[^145]
- No live stream, so it reacts on the next check.[^276]
- Band 3 platform cost when the plan is counted, the same as option D.
- Two layers can disagree, and someone has to decide which is right.
- The terms questions still apply to the research layer.[^27][^29]
- Needs discipline about which layer owns what.

**Failure mode.** The Claude layer quietly becomes the trader. The fixed rules start simple. Then, because Claude's morning research is good, more and more of each day's decisions arrive as "settings" Claude wrote: which names, which direction, what size. The core still checks limits, but it is now a relay for a model's choices, and the design has drifted into option A's shape without option A's questions ever being asked: whether the terms allow it, and whether a person reviewed it. Nothing breaks on the day this happens, which is why it is the most likely way this option disappoints. Scored as that shape (path 2, safety 2), F falls to 3.20.

## 5. Comparison across all options

| | A: Claude-native agent | B: scheduled web app | C: always-on worker | D: worker plus Claude | F: scheduled core plus Claude |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Driver: Claude Code itself | Yes | No (can read beside it) | No | Yes | Yes |
| Driver: software on its own | No | Yes | Yes | Yes | Yes |
| Unattended order path inside limits (20) | 2 | 4 | 4 | 4 | 4 |
| 5 minute target, wide universe (20) | 3 | 4 | 5 | 5 | 4 |
| Flexibility (15) | 2 | 3 | 3 | 5 | 5 |
| Operability for a non-coder (15) | 4 | 4 | 2 | 2 | 3 |
| Safety of an agent that acts alone (10) | 2 | 4 | 3 | 3 | 4 |
| Platform cost (10) | 3 | 3 | 4 | 2 | 2 |
| Reach to a lawful perpetual venue (5) | 3 | 4 | 5 | 5 | 4 |
| Reversibility (5) | 4 | 3 | 3 | 4 | 4 |
| **Weighted total out of 5** | **2.75** | **3.70** | **3.65** | **3.80** | **3.80** |
| Run mode: schedule | 4 | 4 | 5 | 5 | 4 |
| Run mode: event, callback | 3 | 4 | 4 | 5 | 5 |
| Run mode: event, price event | 3 | 4 | 5 | 5 | 4 |
| Run mode: on demand | 5 | 5 | 3 | 5 | 5 |
| Memory kept across runs | 3 | 5 | 5 | 5 | 5 |
| Each run independent | 5 | 5 | 4 | 4 | 5 |
| Platform cost band (model, hosting, storage) | 2 or 3 | 1 to 2 | 1 | 3 | 3 |
| Price data band, to meet 5 minutes | 0 to 3 | 0 to 3 | 0 to 3 | 0 to 3 | 0 to 3 |
| Brokerage band | 0 to 1 | 0 to 1 | 0 to 1 | 0 to 1 | 0 to 1 |
| Who picks each trade | A language model | Fixed code | Fixed code | Fixed code, on settings Claude may write | Fixed code, on settings Claude may write |
| Anthropic Consumer Terms passage applies to | The whole option, if run on the plan | Nothing, if no model or a key is used | Nothing, if no model or a key is used | The research layer, if run on the plan | The research layer, if run on the plan |
| Lawful perpetual venue reachable by | Claude running code with the key | A function, by request | The whole interface | The whole interface | A function, by request |
| Failure mode in one line | The limits are softer than they look | It quietly narrows | Stops unnoticed with borrowed money | A worker built before it is needed | The Claude layer quietly becomes the trader |

**How sensitive the ranking is to the weights.** Three checks, all arithmetic on the scores above, run by script.

- With all eight criteria weighted equally, the order is D and F at 3.75, B and C at 3.63, A at 2.88. The tie at the top holds.
- With operability raised to 30 and the 5 minute target cut to 10 (path 20, flexibility 10, safety 10, cost 10, perpetual reach 5, reversibility 5), the order is B 3.75, F 3.60, D 3.35, C 3.30, A 2.95. **B comes first.**
- With reach to a perpetual venue raised from 5 to 15 (taken from cost and reversibility), the order is D 4.00, F 3.90, B and C 3.80, A 2.70. **D comes first.**

No option leads under every weighting. F is first or second under all three, which is part of why it is the pick (my judgment).

## 6. Falsifiability: what would overturn the pick

Option F is the strongest pick only while the following hold. Each item names specific evidence and what the pick becomes if that evidence appears. For each item, every option the same evidence touches was re-scored and all five were ranked again by script.

1. **The driver question is still open, or the answer is "both".** If Michael decides the agent will be software only, the Claude layer has no job. F's flexibility falls from 5 to 3 and its total to 3.50. Option D loses the same layer and falls to 3.50 as well. **Option B at 3.70 becomes the pick**, ahead of C at 3.65. If he decides Claude Code alone will be the driver, option A is the only one that fits.
2. **A scheduled function can sweep the watch list every minute.** This is an inference, not a measurement. The test: a do-nothing scheduled job on the chosen platform that fetches the whole watch list every minute for two weeks of sessions and logs how late each run started, how long it took, and how many were missed. If more than one run in a hundred is missed, or a typical run takes longer than half a minute, the timing score for F and B falls to 3, F to 3.60 and B to 3.50. **Option D at 3.80 becomes the pick.** This trial is also what would turn the "about a minute" figure into a measurement.
3. **A minute is fast enough.** Evidence against: a month of practice signals, logged with the price at the moment of the signal and the price at the next whole minute, showing a material difference. Then the timing score for F and B falls to 3 (F 3.60, B 3.50), the stream earns its keep and **the pick becomes D** at 3.80. This is the same measurement run 1 named, pointed the other way.
4. **Single stock perpetuals stay pending, or stay secondary.** Kalshi's filing takes effect "November 2, 2026, or such later date".[^19] If single stock perpetuals go live on a U.S. exchange, and a retail customer can get a key for the trading API,[^20] and Michael makes them central, then reach to that venue deserves more than 5 of 100. At 15 the order is D 4.00, F 3.90. **The pick becomes D**, because a perpetual venue that trades through the night rewards a program that is always connected (my judgment). If the filing is not approved, or the API is not open to retail customers, nothing changes.
5. **Anthropic's terms allow the research layer.** If Anthropic states in writing that using Claude to research securities for one's own account is not permitted even on an API key, or that the reviewing "qualified person" cannot be the account owner, the Claude layer goes from F and from D alike. F reduces to option B (3.70) and D reduces to option C (3.65), so **the pick becomes B.** If it states that such use is not permitted on a Max plan but is on a key, F stands with the research layer moved to a key. If it states that a model choosing trades inside owner-set limits is permitted, option A's path score rises to 4 and its safety to 3, for a total of 3.25, still below B, C, D and F.
6. **At least one broker fits the order path.** The path score of 4 for B, C, D and F assumes a broker that applies the new margin rule, lets software place an order with no human step, and lets the customer cap borrowing. Today that is documented at one broker only, with two cautions on record: the agent's own key can change the cap, and that broker's terms on automated trading were not read.[^75][^8] If no broker confirms all three, the path score falls to 3 for all four options: F and D 3.60, B 3.50, C 3.45. The order does not change, but every total moves toward option A's.
7. **Market data for a program is affordable.** If the chosen data vendor or exchange confirms that a personal program reading prices is "non-display use" and prices it in band 4,[^105] every option in which software reads prices (B, C, D and F) is hit, and so is option A whenever it runs with no person watching (my reading). The scores do not pick a winner here, because the cost falls on all five. My judgment: **the architecture stands and the data category narrows** to data that comes with a brokerage account under that broker's own terms,[^26] or the agent falls back to runs whose output a person reads.
8. **The two layers stay in their lanes.** If, after a few months, most of what the core does each day is carry out choices Claude wrote that morning, option F has become option A's shape (section 4, F's failure mode) and should be re-scored as such: 3.20. Putting a worker under the same Claude layer would not cure it: option D re-scored the same way is 3.30. Then **the pick becomes B** at 3.70, with Claude kept strictly to research a person reads.
9. **A non-coder finds the two-layer design manageable.** If keeping two layers in step proves too much, F's operability is a 2, not a 3, and its total is 3.65. Option D has the same two layers and a server besides, so its operability falls to 1 and its total to 3.65 as well. **B at 3.70 becomes the pick.** In the other direction: if a trial worker under option C runs for two weeks with no unnoticed stop, the operability of 2 given to C and D was harsh. At 3, D's total is 3.95 and **the pick becomes D.**

What would not overturn it: a lower price from any single data vendor, a new connector appearing in Anthropic's directory, or Liquid adding features. Those change which candidates fit, not which architecture. Nor would the appearance of a data plan delayed by 5 minutes, since real-time data already costs as little as nothing.[^23]

## 7. Open questions the research could not settle

**For Michael to decide.**

1. **Did "perpetual contracts that track U.S. equities" include index contracts?** The only lawful live route is an index contract, on a look-alike of the 500 largest U.S. companies.[^17][^100] If single stocks were the point, the lawful route is pending, not live.[^19]
2. **Does "futures are out" include a futures contract with no end date?** That is what the U.S. exchanges' perpetuals legally are.[^19]
3. **Is holding the money at a futures broker acceptable, given that the wallet route is closed?** The lawful venue holds dollars in a segregated account at a registered futures broker.[^18]
4. **Who drives?** Still deliberately open, and it now decides between F and B (section 6, item 1).
5. **Is real-time data from one small exchange good enough, or does the agent need every exchange?** That is the difference between 0 to 30 dollars a month and 99.[^23][^24][^25] It matters most for small companies.[^101]
6. **Must the whole universe be watched every minute, or can a wide daily screen feed a short live list?** This decides whether the unmeasured sweep in section 6, item 2 matters at all.
7. **What is the borrowing limit on day one?** If the answer is none, a broker-side cap of 1 or an account type with no borrowing covers it,[^75][^77] and the margin interest rates in section 4.0.1 do not matter yet.
8. **Which account?** Michael's existing brokerage account is a cash account. The margin rules in this document apply only to a margin account, whether a new one or a converted one. This run does not choose.
9. **Which Max tier does he hold?** It sets the monthly API credit at 100 or 200,[^128] which bears on whether the research layer can run on a key at no added cost.

**For someone else to answer.**

10. **Anthropic, in writing.** May Claude be used to research securities, and to place orders, for the subscriber's own account, on a Max plan and on an API key?[^27][^28] Does the Usage Policy's "qualified person" include the account owner?[^29] Is a setting that Claude writes and fixed code carries out "a fixed rule", or a recommendation that needs review?[^29]
11. **Kalshi.** Can a retail customer of Kalshi Prime get a key for the perpetuals trading API, and can that key be limited to trading?[^20] What are the fee rates?[^256]
12. **The chosen broker.** Does it apply the new margin rule to a new account under 25,000 dollars? Interactive Brokers and Tradier have not said so plainly.[^85][^10] Do its terms permit an individual's own program to place orders? Can a key be issued that cannot change the borrowing cap?[^75]
13. **The chosen data vendor.** Is a personal program reading prices "display" or "non-display" use, and at what price?[^104][^106]
14. **Schwab.** How long does the sign-in for its personal trading interface last, and does that interface serve a margin account? Both still rest on community sources or on nothing.[^219]

**Not verified in this run, and worth a short follow-up before any choice of provider.**

- Whether Coinbase Derivatives' index contracts are open to retail customers.[^96]
- Whether a new Alpaca account under 25,000 dollars gets 4 times intraday buying power by default or 2.[^280]
- The symbols-per-request caps at Alpaca and Tradier, which decide whether Alpaca's free plan and a Tradier account can sweep the wide universe.[^157][^164]
- Whether Finazon's advertised real-time plan "from $4" exists as described.[^177]
- How long Robinhood's agent authorization lasts, and which trades "may still require your approval".[^247][^281]
- Whether Tradier's personal token ever expires.[^246]
- Margin rate and minimums at tastytrade, and nearly everything about moomoo and Lightspeed.[^252][^253]
- Whether the pending change to the official feeds' fee schedule was approved after April 2026.[^110]
- How large Max plan limits are in practice. Anthropic publishes no numbers.[^126]
- Whether Liquid blocks a U.S. visitor in practice. Not tested, because it would have required an account.[^41]

## 8. Sources

281 sources. 170 were opened in run 2 and carry the access date 2026-10-09. 111 are reused from run 1 and carry their original access date, 2026-10-08, and their original labels, as the brief allows. Strength labels and price labels are defined in section 3. The register ID at the end of each entry points to the fuller note, with a quote, in the named file.

[^1]: "Full Market Snapshot" (Massive REST docs). https://massive.com/docs/rest/stocks/snapshots/full-market-snapshot . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-43 in `runs/run-2-notes-data-cadence.md`.
[^2]: "Cron" (Supabase docs). https://supabase.com/docs/guides/cron.md . Accessed 2026-10-08. Strength A. Register ID RT-55 in `runs/run-1-notes-runtime-platform.md`.
[^3]: "Regulatory Notice 26-10, Attachment A" (FINRA, the deleted day trading text), and the SEC approval order (Federal Register, April 17, 2026). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-10 in `runs/run-2-notes-margin-brokers.md`.
[^4]: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-11 in `runs/run-2-notes-margin-brokers.md`.
[^5]: "Regulatory Notice 26-10: FINRA Adopts New Intraday Margin Standards to Replace the Day Trading Margin Requirements" (FINRA). https://www.finra.org/rules-guidance/notices/26-10 . Accessed 2026-10-08. Strength A. Register ID T22 in `runs/run-1-trajectory.md`.
[^6]: "Schwab Updates Day Trading and Margin Rules" (Charles Schwab, July 6, 2026). https://www.schwab.com/learn/story/schwab-changes-rules-around-day-trading . Accessed 2026-10-09. Strength A. Register ID S10 in `runs/run-2-trajectory.md`.
[^7]: "FINRA's pattern day trader rules are going away" (E*TRADE from Morgan Stanley, June 5, 2026). https://us.etrade.com/knowledge/library/margin/pattern-day-trading-rule-change . Accessed 2026-10-09. Strength A. Register ID S16 in `runs/run-2-trajectory.md`.
[^8]: "Intraday Margin Rule for Non-Leverage Margin Accounts" (Alpaca docs, updatedAt 2026-04-27) and "The Intraday Margin Rule" (Alpaca docs, updatedAt 2026-07-07). https://docs.alpaca.markets/us/docs/understanding-the-new-intraday-margin-rule . Accessed 2026-10-09. Strength A. Register ID MB-20 in `runs/run-2-notes-margin-brokers.md`.
[^9]: "Pattern Day Trader Reset" (Interactive Brokers, IBKR Guides). https://ibkrguides.com/brokerportal/messagecenter/supportpdtreset.htm . Accessed 2026-10-09. Strength A. Register ID S12 in `runs/run-2-trajectory.md`.
[^10]: "The Pattern Day Trader (PDT) Rule Is Gone: What Active Traders Need to Know" (Tradier blog, Tradier Inc., Jun 5, 2026); and "Funds Available to Trade With" (Tradier support knowledge base, no date shown). https://blog.tradier.com/blog/the-pattern-day-trader-pdt-rule-is-gone-what-active-traders-need-to-know . Accessed 2026-10-09. Strength A. Register ID MB-63 in `runs/run-2-notes-margin-brokers.md`.
[^11]: "Terms of Use" (Hyperliquid, last updated June 15, 2026), and the notice shown on arrival. https://app.hyperliquid.xyz/terms . Accessed 2026-10-09. Strength A. Register ID S26 in `runs/run-2-trajectory.md`.
[^12]: "Terms of Use" (Trade[XYZ], last updated September 6, 2026). https://trade.xyz/terms . Accessed 2026-10-09. Strength A. Register ID S21 in `runs/run-2-trajectory.md`.
[^13]: Lighter, "Terms of Service", "Last updated DECEMBER 29, 2025" (operator named as Elliot Technologies, Inc.). https://lighter.xyz/terms . Accessed 2026-10-09. Strength A. Register ID PV-52 in `runs/run-2-notes-perps-venues.md`.
[^14]: Ostium Docs, "Terms of Use" and FAQ "Who can use Ostium?". https://docs.ostium.com/legal/terms-of-use . Accessed 2026-10-09. Strength A. Register ID PV-57 in `runs/run-2-notes-perps-venues.md`.
[^15]: 15 U.S.C. 78f, Securities Exchange Act section 6, subsection (l) (U.S. Code, 2024 edition). https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap2B-sec78f.htm . Accessed 2026-10-09. Strength A. Register ID S25 in `runs/run-2-trajectory.md`.
[^16]: 7 U.S.C. 1a (Commodity Exchange Act section 1a), "Definitions", paragraph (18)(A)(xi), U.S. Code 2024 Edition. https://www.govinfo.gov/content/pkg/USCODE-2024-title7/html/USCODE-2024-title7-chap1-sec1a.htm . Accessed 2026-10-09. Strength A. Register ID PV-05 in `runs/run-2-notes-perps-venues.md`.
[^17]: Kalshi production perps API, market list (public, no sign-in). Request: curl https://external-api.kalshi.com/trade-api/v2/margin/markets at 2026-10-09 16:54 UTC. https://external-api.kalshi.com/trade-api/v2/margin/markets . Accessed 2026-10-09. Strength A. Register ID PV-24 in `runs/run-2-notes-perps-venues.md`.
[^18]: "Applying for Perpetuals Access" (Kalshi Help Center, August 17, 2026). https://help.kalshi.com/en/articles/15357656-applying-for-perpetuals-access . Accessed 2026-10-09. Strength A. Register ID S20 in `runs/run-2-trajectory.md`.
[^19]: "Self-Regulatory Organizations; KalshiEX LLC; Notice of Filing and Immediate Effectiveness of a Proposed Rule Change Relating to Listing Standards for Security Futures Products" (SEC, File No. SR-KALSHIEX-2026-02, Federal Register, September 23, 2026). https://www.federalregister.gov/documents/2026/09/23/2026-19409/self-regulatory-organizations-kalshiex-llc-notice-of-filing-and-immediate-effectiveness-of-a . Accessed 2026-10-09. Strength A. Register ID S23 in `runs/run-2-trajectory.md`.
[^20]: Kalshi API docs, "Perps API", and "API Keys". https://docs.kalshi.com/margin . Accessed 2026-10-09. Strength A. Register ID PV-28 in `runs/run-2-notes-perps-venues.md`.
[^21]: "Delayed Market Data (Network A and Network B) Policy" (CTA Plan, dated February 2016, 6 pages). https://www.ctaplan.com/publicdocs/ctaplan/Policy_Delayed_Market_Data.pdf . Accessed 2026-10-09. Strength A. Register ID DC-69 in `runs/run-2-notes-data-cadence.md`.
[^22]: "Data Policies" (UTP Plan, "Published September 2023", 32 pages), section "Delayed Data Policy". https://www.utpplan.com/DOC/Datapolicies.pdf . Accessed 2026-10-09. Strength A. Register ID DC-70 in `runs/run-2-notes-data-cadence.md`.
[^23]: "Snapshots" API reference https://docs.alpaca.markets/reference/stocksnapshots-1.md ; "About Market Data API" https://docs.alpaca.markets/docs/about-market-data-api.md. https://docs.alpaca.markets/reference/stocksnapshots-1.md . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-45 in `runs/run-2-notes-data-cadence.md`.
[^24]: "Pricing". https://www.tiingo.com/about/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-32 in `runs/run-1-notes-market-data.md`.
[^25]: "About Market Data API" (Alpaca docs). https://docs.alpaca.markets/docs/about-market-data-api . Accessed 2026-10-08. Strength A. Price label: published. Register ID T28 in `runs/run-1-trajectory.md`.
[^26]: "Market Data" (Tradier docs). https://docs.tradier.com/docs/market-data . Accessed 2026-10-09. Strength A. Register ID DC-49 in `runs/run-2-notes-data-cadence.md`.
[^27]: "Consumer Terms of Service" (Effective October 8, 2025). https://www.anthropic.com/legal/consumer-terms . Accessed 2026-10-09. Strength A. Register ID DC-14 in `runs/run-2-notes-data-cadence.md`.
[^28]: "Commercial Terms of Service" (Effective June 17, 2025). https://www.anthropic.com/legal/commercial-terms . Accessed 2026-10-09. Strength A. Register ID DC-16 in `runs/run-2-notes-data-cadence.md`.
[^29]: "Usage Policy" (Anthropic, version effective November 12, 2026). https://www.anthropic.com/legal/aup . Accessed 2026-10-09. Strength A. Register ID S24 in `runs/run-2-trajectory.md`.
[^30]: "Margin Rates on Public.com". https://public.com/margin . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-61 in `runs/run-2-notes-margin-brokers.md`.
[^31]: "Pricing and Rates" (E*TRADE). https://us.etrade.com/what-we-offer/pricing-and-rates . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-48 in `runs/run-2-notes-margin-brokers.md`.
[^32]: "Scheduled deployments" (Claude Platform docs, status beta). https://platform.claude.com/docs/en/managed-agents/scheduled-deployments.md . Accessed 2026-10-09. Strength A. Register ID DC-30 in `runs/run-2-notes-data-cadence.md`.
[^33]: "Use the Claude Agent SDK with your Claude plan" (Claude Help Center, "Updated yesterday"). https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan . Accessed 2026-10-09. Strength A. Register ID DC-28 in `runs/run-2-notes-data-cadence.md`.
[^34]: "Trading with your agent | Robinhood" (support article). https://www.robinhood.com/us/en/support/articles/trading-with-your-agent/ . Accessed 2026-10-08. Strength A. Register ID BR-67 in `runs/run-1-notes-brokers-regulation.md`.
[^35]: "AI Trading in ChatGPT, Claude, Grok, and Meta Muse, Liquid Co-Invest" (Liquid). https://www.liquid.trade/coinvest . Accessed 2026-10-08. Strength A. Price label: published. Register ID T5 in `runs/run-1-trajectory.md`.
[^36]: "Terms of Service" (Liquid, last updated September 17, 2026). https://www.liquid.trade/termsofservice . Accessed 2026-10-08. Strength A. Register ID T7 in `runs/run-1-trajectory.md`.
[^37]: "Liquid Launches Co-Invest" (Traders Magazine, republished vendor press release, May 26, 2026). https://www.tradersmagazine.com/news/liquid-launches-co-invest/ . Accessed 2026-10-08. Strength B. Register ID T6 in `runs/run-1-trajectory.md`.
[^38]: Liquid Docs, "Co-Invest in Claude" and "Security & Custody". https://docs.tryliquid.xyz/co-invest/claude . Accessed 2026-10-09. Strength A. Register ID PV-46 in `runs/run-2-notes-perps-venues.md`.
[^39]: Liquid Docs, "Co-Invest Computer". https://docs.tryliquid.xyz/co-invest/computer . Accessed 2026-10-09. Strength A. Price label: published. Register ID PV-47 in `runs/run-2-notes-perps-venues.md`.
[^40]: Liquid Docs, "Security & Custody" and "Deposits". https://docs.tryliquid.xyz/security . Accessed 2026-10-09. Strength A. Register ID PV-51 in `runs/run-2-notes-perps-venues.md`.
[^41]: Liquid, "Terms of Service", "Last updated: 09/17/2026". https://www.liquid.trade/termsofservice . Accessed 2026-10-09. Strength A. Register ID PV-44 in `runs/run-2-notes-perps-venues.md`.
[^42]: 15 U.S.C. 78c (Securities Exchange Act section 3), "Definitions and application", paragraph (a)(68), U.S. Code 2024 Edition. https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap2B-sec78c.htm . Accessed 2026-10-09. Strength A. Register ID PV-01 in `runs/run-2-notes-perps-venues.md`.
[^43]: CFTC and SEC, "Joint Request for Comment on Further Definition of "Swap" and "Security-Based Swap" and on Alternative Compliance", Release No. 33-11424; 34-105735, 91 FR 37873, published 2026-06-24. https://www.federalregister.gov/documents/2026/06/24/2026-12743/joint-request-for-comment-on-further-definition-of-swap-and-security-based-swap-and-on-alternative . Accessed 2026-10-09. Strength A. Register ID PV-19 in `runs/run-2-notes-perps-venues.md`.
[^44]: SEC notice of the KalshiEX filing, File No. SR-KALSHIEX-2026-02 (Federal Register, September 23, 2026), where Kalshi describes the lawsuit. https://www.federalregister.gov/documents/2026/09/23/2026-19409/self-regulatory-organizations-kalshiex-llc-notice-of-filing-and-immediate-effectiveness-of-a . Accessed 2026-10-09. Strength A. Register ID PV-15 in `runs/run-2-notes-perps-venues.md`.
[^45]: "Manage Compute usage" (Supabase docs). https://supabase.com/docs/guides/platform/manage-your-usage/compute.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-51 in `runs/run-1-notes-runtime-platform.md`.
[^46]: "What is the Max plan?" (Claude Help Center, "Updated yesterday"). https://support.claude.com/en/articles/11049741-what-is-the-max-plan . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-14 in `runs/run-1-notes-runtime-platform.md`.
[^47]: "Pricing" (Massive, formerly Polygon.io), rendered in a browser. https://massive.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T27 in `runs/run-1-trajectory.md`.
[^48]: "QuantConnect Pricing" (markdown version). https://www.quantconnect.com/pricing.md . Accessed 2026-10-08. Strength A. Price label: published for tier prices; the live trading node price is gated and unverified. Register ID RT-72 in `runs/run-1-notes-runtime-platform.md`.
[^49]: "Brokerages" (QuantConnect docs). https://www.quantconnect.com/docs/v2/cloud-platform/live-trading/brokerages . Accessed 2026-10-08. Strength A. Register ID RT-74 in `runs/run-1-notes-runtime-platform.md`.
[^50]: "Trading Period" (Composer Knowledge Center). https://help.composer.trade/article/63-trading-period . Accessed 2026-10-08. Strength A. Register ID RT-80 in `runs/run-1-notes-runtime-platform.md`.
[^51]: "How to configure webhook alerts" (TradingView support). https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/ . Accessed 2026-10-08. Strength A. Register ID RT-82 in `runs/run-1-notes-runtime-platform.md`.
[^52]: "Top Brokers" (TradingView). https://www.tradingview.com/brokers/ . Accessed 2026-10-08. Strength A. Register ID RT-84 in `runs/run-1-notes-runtime-platform.md`.
[^53]: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-01 in `runs/run-2-notes-margin-brokers.md`.
[^54]: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-04 in `runs/run-2-notes-margin-brokers.md`.
[^55]: "4210. Margin Requirements" (FINRA rulebook), paragraph (c)(1); and "Understanding the New Intraday Margin Requirements" (FINRA Investor Insights, April 20, 2026). https://www.finra.org/rules-guidance/rulebooks/finra-rules/4210 . Accessed 2026-10-09. Strength A. Register ID MB-12 in `runs/run-2-notes-margin-brokers.md`.
[^56]: "§ 220.12 Supplement: margin requirements." 12 CFR Part 220 (Regulation T), 2025 annual edition on govinfo.gov. https://www.govinfo.gov/content/pkg/CFR-2025-title12-vol3/xml/CFR-2025-title12-vol3-sec220-12.xml . Accessed 2026-10-09. Strength A. Register ID MB-13 in `runs/run-2-notes-margin-brokers.md`.
[^57]: Derivation in the helper notes: intraday and overnight multiples for a long-only margin account, built on findings MB-02, MB-12 and MB-13. no single address, see the finding . Accessed 2026-10-09. Strength A (arithmetic on strength A sources). Register ID MB-14 in `runs/run-2-notes-margin-brokers.md`.
[^58]: "Margin and Short Selling" (Alpaca docs, updated September 17, 2026). https://docs.alpaca.markets/us/docs/margin-and-short-selling . Accessed 2026-10-09. Strength A. Price label: published. Register ID S22 in `runs/run-2-trajectory.md`.
[^59]: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17). https://docs.alpaca.markets/us/docs/margin-and-short-selling . Accessed 2026-10-09. Strength A. Register ID MB-23 in `runs/run-2-notes-margin-brokers.md`.
[^60]: "§ 220.8 Cash account.". https://www.govinfo.gov/content/pkg/CFR-2025-title12-vol3/xml/CFR-2025-title12-vol3-sec220-8.xml . Accessed 2026-10-08. Strength A. Register ID BR-09 in `runs/run-1-notes-brokers-regulation.md`.
[^61]: "What are unsettled funds?" (Alpaca Learn; page shows Feb 2, 2022 but cites May 2024). https://alpaca.markets/learn/understanding-unsettled-funds . Accessed 2026-10-08. Strength A. Register ID BR-18 in `runs/run-1-notes-brokers-regulation.md`.
[^62]: "Public Trading API" and "Does Public offer margin?" (Public help center, dated January 21, 2025). https://public.com/api . Accessed 2026-10-09. Strength A. Register ID MB-62 in `runs/run-2-notes-margin-brokers.md`.
[^63]: "Frequent Intraday Trading: Understanding the Basics" (FINRA, page dated June 04, 2026). https://www.finra.org/investors/investing/investment-products/stocks/day-trading . Accessed 2026-10-09. Strength A. Register ID MB-15 in `runs/run-2-notes-margin-brokers.md`.
[^64]: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-05 in `runs/run-2-notes-margin-brokers.md`.
[^65]: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017). https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf . Accessed 2026-10-09. Strength A. Register ID MB-06 in `runs/run-2-notes-margin-brokers.md`.
[^66]: SEC approval order, Federal Register, 91 FR 20731 (April 17, 2026), plain-text copy. https://www.federalregister.gov/documents/2026/04/17/2026-07485/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-of . Accessed 2026-10-09. Strength A. Register ID MB-08 in `runs/run-2-notes-margin-brokers.md`.
[^67]: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17). https://docs.alpaca.markets/us/docs/margin-and-short-selling . Accessed 2026-10-09. Strength A. Register ID MB-27 in `runs/run-2-notes-margin-brokers.md`.
[^68]: "Margin Requirements & Interest Rates" (Charles Schwab). https://www.schwab.com/margin/margin-rates-and-requirements . Accessed 2026-10-09. Strength A. Price label: published. Register ID S15 in `runs/run-2-trajectory.md`.
[^69]: "Configuring Your Account" (Interactive Brokers), account type comparison table. https://www.interactivebrokers.com/en/accounts/configuring-your-account.php . Accessed 2026-10-09. Strength A. Register ID MB-39 in `runs/run-2-notes-margin-brokers.md`.
[^70]: "Margin Rates and Financing" (Interactive Brokers). https://www.interactivebrokers.com/en/trading/margin-rates.php . Accessed 2026-10-09. Strength A. Price label: published. Register ID S11 in `runs/run-2-trajectory.md`.
[^71]: "Margin" (Webull). https://www.webull.com/margin . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-70 in `runs/run-2-notes-margin-brokers.md`.
[^72]: "Pricing & Plans | Tradier", fee table. https://tradier.com/individuals/pricing . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-64 in `runs/run-2-notes-margin-brokers.md`.
[^73]: "Margin Rates" (TradeStation). https://www.tradestation.com/pricing/margin-rates/ . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-52 in `runs/run-2-notes-margin-brokers.md`.
[^74]: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17). https://docs.alpaca.markets/us/docs/margin-and-short-selling . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-24 in `runs/run-2-notes-margin-brokers.md`.
[^75]: "Account Configurations" API reference (Alpaca docs, updatedAt 2026-05-27). https://docs.alpaca.markets/us/reference/patchaccountconfig-1 . Accessed 2026-10-09. Strength A. Register ID MB-25 in `runs/run-2-notes-margin-brokers.md`.
[^76]: "Dan, where's the cash-only account option?" (Alpaca community forum; staff member Dan_Whitnable_Alpaca, posts dated January 26 and 30, 2026). https://forum.alpaca.markets/t/dan-wheres-the-cash-only-account-option/18353 . Accessed 2026-10-08. Strength D. Register ID BR-17 in `runs/run-1-notes-brokers-regulation.md`.
[^77]: "Setting up an agent" (Robinhood support). https://robinhood.com/us/en/support/articles/setting-up-an-agent/ . Accessed 2026-10-09. Strength A. Register ID MB-55 in `runs/run-2-notes-margin-brokers.md`.
[^78]: FINRA's original notice of the proposed rule change, Federal Register, 91 FR 1580 (January 14, 2026), plain-text copy; and FINRA Investor Insights (April 20, 2026). https://www.federalregister.gov/documents/2026/01/14/2026-00519/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-of-a . Accessed 2026-10-09. Strength A. Register ID MB-19 in `runs/run-2-notes-margin-brokers.md`.
[^79]: "Stock Margin Requirements", U.S. view (Interactive Brokers). https://ndcdyn.interactivebrokers.com/en/trading/margin-stocks.php?hm=us&ex=us&rgt=1&rsk=0&pm=1&rst=101004110808&relp=25371 . Accessed 2026-10-09. Strength A. Register ID S13 in `runs/run-2-trajectory.md`.
[^80]: "What changed with day trading rules?" (Public help center, dated June 4, 2026) and "Do I need a minimum balance to day trade?" (dated June 4, 2026). https://help.public.com/en/articles/15378349-what-changed-with-day-trading-rules . Accessed 2026-10-09. Strength A. Register ID MB-59 in `runs/run-2-notes-margin-brokers.md`.
[^81]: "Day Trade Without the $25K Minimum" (Webull). https://www.webull.com/pdt-info . Accessed 2026-10-09. Strength A. Register ID MB-69 in `runs/run-2-notes-margin-brokers.md`.
[^82]: TradeStation home page, "What's new at TradeStation"; and "Day Trading Requirements" (TradeStation Learn). https://www.tradestation.com/ . Accessed 2026-10-09. Strength A. Register ID MB-53 in `runs/run-2-notes-margin-brokers.md`.
[^83]: "Pattern Day Trading" (tastytrade Learn, Chris Grace, published Apr 17, 2026, updated Jun 11, 2026). https://tastytrade.com/learn/markets/industry/pattern-day-trading/ . Accessed 2026-10-09. Strength A. Register ID MB-66 in `runs/run-2-notes-margin-brokers.md`.
[^84]: "The $25,000 Pattern Day Trading Rule Is No More" (NerdWallet, Sam Taube, last updated Jun 4, 2026). https://www.nerdwallet.com/investing/news/pattern-day-trading-rule-change . Accessed 2026-10-09. Strength B. Register ID MB-40 in `runs/run-2-notes-margin-brokers.md`.
[^85]: "Frequently Asked Questions", section "FINRA Rule Change" (Interactive Brokers). https://www.interactivebrokers.com/lib/cstools/faq/#/articles/1460026643 . Accessed 2026-10-09. Strength A. Register ID S18 in `runs/run-2-trajectory.md`.
[^86]: "SEC Finalizes Rules to Reduce Risks in Clearance and Settlement" (SEC press release 2023-29). https://www.sec.gov/newsroom/press-releases/2023-29 . Accessed 2026-10-08. Strength A. Register ID BR-01 in `runs/run-1-notes-brokers-regulation.md`.
[^87]: "Trading in Cash Accounts: Avoid These Violations" (Charles Schwab, December 17, 2024). https://www.schwab.com/learn/story/avoid-these-violations-when-trading-cash . Accessed 2026-10-08. Strength A. Register ID T33 in `runs/run-1-trajectory.md`.
[^88]: 15 U.S.C. 78c, paragraph (a)(55)(B), U.S. Code 2024 Edition. https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap2B-sec78c.htm . Accessed 2026-10-09. Strength A. Register ID PV-02 in `runs/run-2-notes-perps-venues.md`.
[^89]: 15 U.S.C. 77e (Securities Act section 5), "Prohibitions relating to interstate commerce and the mails", subsection (e), U.S. Code 2024 Edition. https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap2A-subchapI-sec77e.htm . Accessed 2026-10-09. Strength A. Register ID PV-04 in `runs/run-2-notes-perps-venues.md`.
[^90]: SEC, "Statement on Tokenized Securities", Division of Corporation Finance, Division of Investment Management, Division of Trading and Markets, dated 2026-01-28. https://www.sec.gov/newsroom/speeches-statements/corp-fin-statement-tokenized-securities-012826-statement-tokenized-securities . Accessed 2026-10-09. Strength A. Register ID PV-21 in `runs/run-2-notes-perps-venues.md`.
[^91]: SEC, "Self-Regulatory Organizations; Coinbase Derivatives, LLC; Notice of Filing and Immediate Effectiveness of a Proposed Rule Change Relating to [...] Cash Settled Futures on Individual Equity Securities and Exchange-Traded Fund Shares, Including Perpetual Single-Stock Futures", 91 FR 60448, 2026-09-23. And "Notice of Filing of a Proposed Rule Change Relating to Customer Margin Requirements for Security Futures Products", 91 FR 60670, 2026-09-24. https://www.federalregister.gov/documents/2026/09/23/2026-19407/self-regulatory-organizations-coinbase-derivatives-llc-notice-of-filing-and-immediate-effectiveness . Accessed 2026-10-09. Strength A. Price label: published. Register ID PV-17 in `runs/run-2-notes-perps-venues.md`.
[^92]: Federal Register search results for SEC notices 2026-19407 (Coinbase Derivatives, 2026-09-23), 2026-19408 (Bitnomial, 2026-09-23), 2026-19512 (Coinbase Derivatives margin, 2026-09-24), 2026-20194 (North American Derivatives Exchange, 2026-10-02). Cointelegraph, "OG.com Joins US Push for Single-Stock Perpetual Futures", 2026-09-25. https://www.federalregister.gov/api/v1/documents.json?conditions[term . Accessed 2026-10-09. Strength A for the SEC notices existing, B for the press account. Register ID PV-16 in `runs/run-2-notes-perps-venues.md`.
[^93]: SEC, "Self-Regulatory Organizations; North American Derivatives Exchange, Inc.; Notice of Filing and Immediate Effectiveness of a Proposed Rule Change Relating to Rules Governing Contract Specifications for Perpetual Cash-Settled Single Stock Security Futures", 91 FR 62786, 2026-10-02. https://www.federalregister.gov/documents/2026/10/02/2026-20194/self-regulatory-organizations-north-american-derivatives-exchange-inc-notice-of-filing-and-immediate . Accessed 2026-10-09. Strength A. Register ID PV-18 in `runs/run-2-notes-perps-venues.md`.
[^94]: "Self-Certification of New Rules for the Listing and Trading of Perpetual Security Futures Products" (KalshiEX LLC letter to the CFTC, September 18, 2026). https://www.cftc.gov/filings/orgrules/rules09182627453.pdf . Accessed 2026-10-09. Strength A. Register ID S9 in `runs/run-2-trajectory.md`.
[^95]: CFTC Letter No. 26-29, No-Action, dated 2026-10-03. https://www.cftc.gov/csl/26-29/download . Accessed 2026-10-09. Strength A. Register ID PV-11 in `runs/run-2-notes-perps-venues.md`.
[^96]: Search tool summary of a Coinbase blog post and two press articles on Coinbase Derivatives' index contracts (the Coinbase pages themselves returned a bot check). https://www.coinbase.com/blog/coming-june-8-perpetual-style-equity-index-futures . Accessed 2026-10-09. Strength A for the existence of the contracts (a CFTC staff letter), B for the press account of what they are and who may trade them. Price label: gated and unverified. Register ID PV-30 in `runs/run-2-notes-perps-venues.md`.
[^97]: SEC, "Order Granting Temporary Conditional Exemptive Relief [...] for the Use of Certain Distributed Ledger Trading Venues for Tokenized NMS Stocks [...]", Release No. 34-106402, File No. 4-927, dated 2026-09-17, 91 FR 60168, published 2026-09-22. https://www.federalregister.gov/documents/2026/09/22/2026-19388/order-granting-temporary-conditional-exemptive-relief-pursuant-to-section-36a1-of-the-securities . Accessed 2026-10-09. Strength A. Register ID PV-20 in `runs/run-2-notes-perps-venues.md`.
[^98]: "Policy Statement Concerning the Listing of Perpetual Contracts" (CFTC, Federal Register, June 3, 2026, document 2026-11020). https://www.federalregister.gov/documents/2026/06/03/2026-11020/policy-statement-concerning-the-listing-of-perpetual-contracts . Accessed 2026-10-09. Strength A. Register ID S7 in `runs/run-2-trajectory.md`.
[^99]: Herbert Smith Freehills Kramer, "After the Clarity Act fails to advance, crypto securities law regulation is left to the SEC" (September 2026), as summarized by the search tool. Also bit.com, "CLARITY Act Fails: The 49-50 Senate Vote Explained". https://www.hsfkramer.com/insights/2026-09/after-the-clarity-act-fails-to-advance-crypto-securities-law-regulation-is-left-to-the-sec . Accessed 2026-10-09. Strength B. Register ID PV-08 in `runs/run-2-notes-perps-venues.md`.
[^100]: Finance Magnates, "Kalshi Takes Perpetual Futures into US Equities after CFTC Approval", 2026-10-06. https://www.financemagnates.com/fintech/kalshi-takes-perpetual-futures-into-us-equities-after-cftc-approval/ . Accessed 2026-10-09. Strength B. Register ID PV-25 in `runs/run-2-notes-perps-venues.md`.
[^101]: "Historical Stock Data" https://docs.alpaca.markets/docs/historical-stock-data-1.md ; "Market Data FAQ" https://docs.alpaca.markets/docs/market-data-faq.md. https://docs.alpaca.markets/docs/historical-stock-data-1.md . Accessed 2026-10-09. Strength A. Register ID DC-48 in `runs/run-2-notes-data-cadence.md`.
[^102]: "Market Data Pricing" (Interactive Brokers). https://www.interactivebrokers.com/en/pricing/market-data-pricing.php . Accessed 2026-10-09. Strength A. Register ID DC-52 in `runs/run-2-notes-data-cadence.md`.
[^103]: "US Equities" catalog (Databento). https://databento.com/catalog/us-equities . Accessed 2026-10-09. Strength A. Register ID DC-58 in `runs/run-2-notes-data-cadence.md`.
[^104]: "CTA Market Data Non-Display Use Policy" (CTA Plan, dated 1 Nov 2015, 2 pages). https://www.ctaplan.com/publicdocs/ctaplan/Policy_CTA_Non_Display_with_FAQ.pdf . Accessed 2026-10-09. Strength A. Register ID DC-71 in `runs/run-2-notes-data-cadence.md`.
[^105]: "Data Policies" (UTP Plan, Published September 2023), sections "Uncontrolled Product", "Usage Fees: Non-Display" and "Non-Display Policy". https://www.utpplan.com/DOC/Datapolicies.pdf . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-72 in `runs/run-2-notes-data-cadence.md`.
[^106]: "Market Data Terms of Service". https://massive.com/legal/market-data-terms-of-service . Accessed 2026-10-08. Strength A. Register ID MD-15 in `runs/run-1-notes-market-data.md`.
[^107]: "Market Data API Overview" (Webull OpenAPI docs). https://developer.webull.com/apis/docs/market-data-api/overview . Accessed 2026-10-09. Strength A. Price label: gated and unverified. Register ID DC-54 in `runs/run-2-notes-data-cadence.md`.
[^108]: "US equities market data" (Twelve Data help centre, August 18, 2026). https://support.twelvedata.com/en/articles/9935903-us-equities-market-data . Accessed 2026-10-09. Strength A. Register ID DC-61 in `runs/run-2-notes-data-cadence.md`.
[^109]: "Pricing" https://databento.com/pricing ; "US Equities" catalog https://databento.com/catalog/us-equities ; "Databento US Equities Mini now available" https://databento.com/blog/databento-us-equities-mini-now-available ; "Equities" https://databento.com/equities. https://databento.com/pricing . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-57 in `runs/run-2-notes-data-cadence.md`.
[^110]: "Joint Industry Plan; Notice of Filing of Amendment No. 1, and Order Instituting Proceedings ... to Adopt a Fee Schedule" (SEC Release No. 34-105125, File No. 4-757, Federal Register Vol. 91, No. 64, April 3, 2026, starting page 17026). https://www.govinfo.gov/content/pkg/FR-2026-04-03/pdf/2026-06463.pdf . Accessed 2026-10-09. Strength A. Register ID DC-75 in `runs/run-2-notes-data-cadence.md`.
[^111]: "Legal and compliance" (Claude Code docs). https://code.claude.com/docs/en/legal-and-compliance.md . Accessed 2026-10-08. Strength A. Register ID RT-01 in `runs/run-1-notes-runtime-platform.md`.
[^112]: "Usage Policy" (archived version). https://www.anthropic.com/legal/archive/22742366-2ef0-4c7a-a833-6523f10d3944 . Accessed 2026-10-09. Strength A. Register ID DC-04 in `runs/run-2-notes-data-cadence.md`.
[^113]: "Usage Policy", section "Exclusions". https://www.anthropic.com/legal/aup . Accessed 2026-10-09. Strength A. Register ID DC-10 in `runs/run-2-notes-data-cadence.md`.
[^114]: Word search in the helper notes over both versions of Anthropic's Usage Policy ( https://www.anthropic.com/legal/aup ). no single address, see the finding . Accessed 2026-10-09. Strength A (a record of what the text does not contain). Register ID DC-12 in `runs/run-2-notes-data-cadence.md`.
[^115]: "Automate work with routines". https://code.claude.com/docs/en/routines.md . Accessed 2026-10-09. Strength A. Register ID DC-24 in `runs/run-2-notes-data-cadence.md`.
[^116]: "MCP connector" https://platform.claude.com/docs/en/managed-agents/mcp-connector.md ; "Permission policies" https://platform.claude.com/docs/en/managed-agents/permission-policies.md ; "Managed Agents reference" https://platform.claude.com/docs/en/managed-agents/reference.md ; "Overview" https://platform.claude.com/docs/en/managed-agents/overview.md. https://platform.claude.com/docs/en/managed-agents/mcp-connector.md . Accessed 2026-10-09. Strength A. Register ID DC-31 in `runs/run-2-notes-data-cadence.md`.
[^117]: "Anthropic Software Directory Policy", section "4. Unsupported Use Cases" (Claude Help Center, dated April 15, 2026). https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy . Accessed 2026-10-09. Strength A. Register ID DC-17 in `runs/run-2-notes-data-cadence.md`.
[^118]: "Connectors and plugins", full list of 929 (Anthropic, Claude Marketplace). https://claude.com/marketplace/connectors-plugins . Accessed 2026-10-09. Strength A. Register ID S4 in `runs/run-2-trajectory.md`.
[^119]: "Interactive Brokers (IBKR) connector" (Claude Marketplace, Anthropic). https://claude.com/marketplace/connectors/interactive-brokers . Accessed 2026-10-08. Strength A. Register ID T18 in `runs/run-1-trajectory.md`.
[^120]: "Webull connector" (Claude Marketplace, Anthropic). https://claude.com/marketplace/connectors/webull . Accessed 2026-10-08. Strength A. Register ID T19 in `runs/run-1-trajectory.md`.
[^121]: "Remarks at the Special Competitive Studies Project AI+ Expo" (SEC Chairman Paul S. Atkins, May 8, 2026). https://www.sec.gov/newsroom/speeches-statements/atkins-remarks-scsp-ai-expo-050826 . Accessed 2026-10-09. Strength A. Register ID MB-74 in `runs/run-2-notes-margin-brokers.md`.
[^122]: "Emerging Trend in GenAI: Observations on AI Agents" (FINRA blog, Greg Ruppert, Executive Vice President and Chief Regulatory Operations Officer, January 27, 2026). https://www.finra.org/media-center/blog/observations-on-ai-agents . Accessed 2026-10-09. Strength A. Register ID MB-75 in `runs/run-2-notes-margin-brokers.md`.
[^123]: "Is agentic trading safe? What the SEC inquiry means for investors" (Matt Miczulski for Finder, syndicated on WFTV, July 27, 2026). https://www.wftv.com/news/is-agentic-trading/NV64RNJKZQ2MXN4LWQNOY6DS7I/ . Accessed 2026-10-09. Strength B. Register ID MB-76 in `runs/run-2-notes-margin-brokers.md`.
[^124]: "Onboarding an external agent | Robinhood" (support article). https://www.robinhood.com/us/en/support/articles/agentic-trading-overview/ . Accessed 2026-10-08. Strength A. Register ID BR-66 in `runs/run-1-notes-brokers-regulation.md`.
[^125]: "Use Claude Code with your Pro or Max plan". https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan . Accessed 2026-10-08. Strength A. Register ID RT-16 in `runs/run-1-notes-runtime-platform.md`.
[^126]: "What is the Max plan?" ("Updated yesterday") https://support.claude.com/en/articles/11049741-what-is-the-max-plan ; "Use Claude Code with your Pro or Max plan" ("Updated today") https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan ; "Pricing" https://claude.com/pricing. https://support.claude.com/en/articles/11049741-what-is-the-max-plan . Accessed 2026-10-09. Strength A. Register ID DC-33 in `runs/run-2-notes-data-cadence.md`.
[^127]: "Pricing" (Claude Platform docs). https://platform.claude.com/docs/en/about-claude/pricing.md . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-35 in `runs/run-2-notes-data-cadence.md`.
[^128]: "Monthly API credits for Max and Team plans" (Claude Help Center, "Updated yesterday"). https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-34 in `runs/run-2-notes-data-cadence.md`.
[^129]: Estimate in the helper notes: monthly model cost at a 5 minute cadence, built on the prices in finding DC-35 (Anthropic pricing page, https://platform.claude.com/docs/en/about-claude/pricing ). no single address, see the finding . Accessed 2026-10-09. Strength A (an estimate, not a price). Register ID DC-37 in `runs/run-2-notes-data-cadence.md`.
[^130]: "Pricing" (Claude Platform docs), section "Claude Managed Agents pricing". https://platform.claude.com/docs/en/about-claude/pricing.md . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-32 in `runs/run-2-notes-data-cadence.md`.
[^131]: Estimate in the helper notes: Managed Agents runtime charge, built on finding DC-32. no single address, see the finding . Accessed 2026-10-09. Strength A (an estimate, not a price). Register ID DC-38 in `runs/run-2-notes-data-cadence.md`.
[^132]: "Automate work with routines". https://code.claude.com/docs/en/routines.md . Accessed 2026-10-09. Strength A. Register ID DC-21 in `runs/run-2-notes-data-cadence.md`.
[^133]: "Automate work with routines", section "Usage and limits". https://code.claude.com/docs/en/routines.md . Accessed 2026-10-09. Strength A. Register ID DC-22 in `runs/run-2-notes-data-cadence.md`.
[^134]: "Automate work with routines", section "Add an API trigger". https://code.claude.com/docs/en/routines.md . Accessed 2026-10-09. Strength A. Register ID DC-23 in `runs/run-2-notes-data-cadence.md`.
[^135]: "Schedule recurring tasks in Claude Code Desktop". https://code.claude.com/docs/en/desktop-scheduled-tasks.md . Accessed 2026-10-09. Strength A. Register ID DC-25 in `runs/run-2-notes-data-cadence.md`.
[^136]: "Run Claude Code programmatically". https://code.claude.com/docs/en/headless.md . Accessed 2026-10-08. Strength A. Register ID RT-05 in `runs/run-1-notes-runtime-platform.md`.
[^137]: "Run Claude Code programmatically" https://code.claude.com/docs/en/headless.md ; "Authentication" https://code.claude.com/docs/en/authentication.md ; "Changelog" https://code.claude.com/docs/en/changelog.md. https://code.claude.com/docs/en/headless.md . Accessed 2026-10-09. Strength A. Register ID DC-29 in `runs/run-2-notes-data-cadence.md`.
[^138]: "Events that trigger workflows", section "schedule" (GitHub Docs). https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows . Accessed 2026-10-09. Strength A. Register ID DC-40 in `runs/run-2-notes-data-cadence.md`.
[^139]: "GitHub Actions billing" https://docs.github.com/en/billing/concepts/product-billing/github-actions ; "Actions runner pricing" https://docs.github.com/en/billing/reference/actions-runner-pricing. https://docs.github.com/en/billing/concepts/product-billing/github-actions . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-41 in `runs/run-2-notes-data-cadence.md`.
[^140]: "Usage & Pricing for Cron Jobs" (Vercel docs). https://vercel.com/docs/cron-jobs/usage-and-pricing.md . Accessed 2026-10-08. Strength A. Register ID RT-45 in `runs/run-1-notes-runtime-platform.md`.
[^141]: "Fair use Guidelines". https://vercel.com/docs/limits/fair-use-guidelines.md . Accessed 2026-10-08. Strength A. Register ID RT-47 in `runs/run-1-notes-runtime-platform.md`.
[^142]: "Vercel Hobby Plan". https://vercel.com/docs/plans/hobby.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-50 in `runs/run-1-notes-runtime-platform.md`.
[^143]: "Vercel Functions Limits" (Vercel docs). https://vercel.com/docs/functions/limitations.md . Accessed 2026-10-08. Strength A. Register ID RT-46 in `runs/run-1-notes-runtime-platform.md`.
[^144]: "Compute and Disk" (Supabase docs). https://supabase.com/docs/guides/platform/compute-and-disk.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-52 in `runs/run-1-notes-runtime-platform.md`.
[^145]: "Limits" (Supabase Edge Functions docs). https://supabase.com/docs/guides/functions/limits.md . Accessed 2026-10-08. Strength A. Register ID RT-53 in `runs/run-1-notes-runtime-platform.md`.
[^146]: "Limits". https://developers.cloudflare.com/workers/platform/limits/index.md . Accessed 2026-10-08. Strength A. Register ID RT-62 in `runs/run-1-notes-runtime-platform.md`.
[^147]: "Pricing" (Cloudflare Workers docs). https://developers.cloudflare.com/workers/platform/pricing/index.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-61 in `runs/run-1-notes-runtime-platform.md`.
[^148]: "Use WebSockets". https://developers.cloudflare.com/durable-objects/best-practices/websockets/index.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-63 in `runs/run-1-notes-runtime-platform.md`.
[^149]: "Fly.io Resource Pricing" (Fly.io docs). https://fly.io/docs/about/pricing/ . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-64 in `runs/run-1-notes-runtime-platform.md`.
[^150]: "Droplet Pricing" (DigitalOcean). https://www.digitalocean.com/pricing/droplets . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-65 in `runs/run-1-notes-runtime-platform.md`.
[^151]: "Amazon Lightsail pricing". https://aws.amazon.com/lightsail/pricing/ . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-68 in `runs/run-1-notes-runtime-platform.md`.
[^152]: "Pricing Plans" (Railway docs). https://docs.railway.com/reference/pricing/plans . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-67 in `runs/run-1-notes-runtime-platform.md`.
[^153]: "Deploy for Free". https://render.com/docs/free . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-66 in `runs/run-1-notes-runtime-platform.md`.
[^154]: "Scheduling Timed Jobs" (Apple Developer, documentation archive). https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html . Accessed 2026-10-08. Strength A. Register ID RT-70 in `runs/run-1-notes-runtime-platform.md`.
[^155]: "How Claude remembers your project". https://code.claude.com/docs/en/memory.md . Accessed 2026-10-08. Strength A. Register ID RT-31 in `runs/run-1-notes-runtime-platform.md`.
[^156]: "Memory stores" (Claude Platform docs, status beta). https://platform.claude.com/docs/en/managed-agents/memory.md . Accessed 2026-10-08. Strength A. Register ID RT-40 in `runs/run-1-notes-runtime-platform.md`.
[^157]: "Snapshots" API reference. https://docs.alpaca.markets/reference/stocksnapshots-1.md . Accessed 2026-10-09. Strength A. Register ID DC-46 in `runs/run-2-notes-data-cadence.md`.
[^158]: "Historical Stock Data" (vendor docs). https://docs.alpaca.markets/docs/historical-stock-data-1 . Accessed 2026-10-08. Strength A. Register ID MD-11 in `runs/run-1-notes-market-data.md`.
[^159]: "Streaming market data" (Alpaca docs). https://docs.alpaca.markets/docs/streaming-market-data.md . Accessed 2026-10-09. Strength A. Register ID DC-47 in `runs/run-2-notes-data-cadence.md`.
[^160]: "Stocks". https://massive.com/stocks . Accessed 2026-10-08. Strength A. Register ID MD-06 in `runs/run-1-notes-market-data.md`.
[^161]: "IEX". https://www.tiingo.com/documentation/iex . Accessed 2026-10-08. Strength A. Register ID MD-33 in `runs/run-1-notes-market-data.md`.
[^162]: "IEX". https://www.tiingo.com/documentation/iex . Accessed 2026-10-08. Strength A. Register ID MD-34 in `runs/run-1-notes-market-data.md`.
[^163]: "IEX" endpoint docs (Tiingo). https://www.tiingo.com/documentation/iex . Accessed 2026-10-09. Strength A. Register ID DC-64 in `runs/run-2-notes-data-cadence.md`.
[^164]: "Rate Limiting" https://docs.tradier.com/docs/rate-limiting ; "Get quotes for one or more symbols" https://docs.tradier.com/reference/brokerage-api-markets-get-quotes. https://docs.tradier.com/docs/rate-limiting . Accessed 2026-10-09. Strength A. Register ID DC-50 in `runs/run-2-notes-data-cadence.md`.
[^165]: "Market Data Pricing" (Interactive Brokers). https://www.interactivebrokers.com/en/pricing/market-data-pricing.php . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-51 in `runs/run-2-notes-data-cadence.md`.
[^166]: "Market Data Pricing" (Interactive Brokers). https://www.interactivebrokers.com/en/pricing/market-data-pricing.php . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-53 in `runs/run-2-notes-data-cadence.md`.
[^167]: "Stock Snapshot" reference https://developer.webull.com/apis/docs/reference/snapshot.md ; "Rate Limits" https://developer.webull.com/apis/docs/rate-limits. https://developer.webull.com/apis/docs/reference/snapshot.md . Accessed 2026-10-09. Strength A. Register ID DC-55 in `runs/run-2-notes-data-cadence.md`.
[^168]: "Databento US Equities Mini now available" (vendor blog, dated February 1, 2025). https://databento.com/blog/databento-us-equities-mini-now-available . Accessed 2026-10-08. Strength A. Register ID MD-20 in `runs/run-1-notes-market-data.md`.
[^169]: "Pricing". https://twelvedata.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-23 in `runs/run-1-notes-market-data.md`.
[^170]: "Batch API requests" https://support.twelvedata.com/en/articles/5203360-batch-api-requests ; "Credits" https://support.twelvedata.com/en/articles/5615854-credits. https://support.twelvedata.com/en/articles/5203360-batch-api-requests . Accessed 2026-10-09. Strength A. Register ID DC-62 in `runs/run-2-notes-data-cadence.md`.
[^171]: "Premium API Key". https://www.alphavantage.co/premium/ . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-28 in `runs/run-1-notes-market-data.md`.
[^172]: "API Documentation" https://www.alphavantage.co/documentation/ ; "Regulatory Policies on Realtime & 15-minute Delayed US Market Data" https://www.alphavantage.co/realtime_data_policy/. https://www.alphavantage.co/documentation/ . Accessed 2026-10-09. Strength A. Register ID DC-59 in `runs/run-2-notes-data-cadence.md`.
[^173]: "API Documentation", section "Realtime Bulk Quotes". https://www.alphavantage.co/documentation/ . Accessed 2026-10-09. Strength A. Register ID DC-60 in `runs/run-2-notes-data-cadence.md`.
[^174]: "Pricing". https://eodhd.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-43 in `runs/run-1-notes-market-data.md`.
[^175]: "Live (Delayed) OHLCV Stock Prices API" https://eodhd.com/financial-apis/live-realtime-stocks-api ; "Bulk for Live OHLCV Stock Prices API (US Exchanges Only)" https://eodhd.com/financial-apis/bulk-for-live-ohlcv-stock-prices-api-us-exchanges-only. https://eodhd.com/financial-apis/live-realtime-stocks-api . Accessed 2026-10-09. Strength A. Register ID DC-63 in `runs/run-2-notes-data-cadence.md`.
[^176]: "Real-Time Data API (WebSockets)". https://eodhd.com/financial-apis/new-real-time-data-api-websockets . Accessed 2026-10-08. Strength A. Register ID MD-44 in `runs/run-1-notes-market-data.md`.
[^177]: "US Stock Market Data API" https://finazon.io/featured-datasets/us-stocks-market-data ; redirect observed from https://finazon.io/dataset/sip_non_pro to https://finazon.io/dataset/us_stocks_essential. https://finazon.io/featured-datasets/us-stocks-market-data . Accessed 2026-10-09. Strength A. Price label: published. Register ID DC-66 in `runs/run-2-notes-data-cadence.md`.
[^178]: "Trader API - Individual" (Charles Schwab Developer Portal). https://developer.schwab.com/products/trader-api--individual . Accessed 2026-10-09. Strength A. Register ID DC-56 in `runs/run-2-notes-data-cadence.md`.
[^179]: Summary in the helper notes: vendor pages that could not be read in this session (Finnhub, Financial Modeling Prep, Schwab, TradeStation, tastytrade and others), with what was tried. no single address, see the finding . Accessed 2026-10-09. Strength A (a record of what was not verified). Register ID DC-68 in `runs/run-2-notes-data-cadence.md`.
[^180]: "Pricing" (Finnhub), rendered in a browser. https://finnhub.io/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T30 in `runs/run-1-trajectory.md`.
[^181]: "Pricing Plans" (Financial Modeling Prep), rendered in a browser. https://site.financialmodelingprep.com/developer/docs/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T29 in `runs/run-1-trajectory.md`.
[^182]: "Market Data FAQ" (vendor docs). https://docs.alpaca.markets/docs/market-data-faq . Accessed 2026-10-08. Strength A. Register ID MD-16 in `runs/run-1-notes-market-data.md`.
[^183]: "Equities". https://databento.com/equities . Accessed 2026-10-08. Strength A. Register ID MD-21 in `runs/run-1-notes-market-data.md`.
[^184]: Summary in the helper notes: coverage statements of seven data vendors, each with its own page and strength label. no single address, see the finding . Accessed 2026-10-09. Strength A (mixed, see the finding). Register ID DC-76 in `runs/run-2-notes-data-cadence.md`.
[^185]: "SPDR S&P 500 ETF Trust (SPY)". https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy . Accessed 2026-10-08. Strength A. Register ID MD-61 in `runs/run-1-notes-market-data.md`.
[^186]: "iShares Russell 2000 ETF". https://www.ishares.com/us/products/239710/ishares-russell-2000-etf . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-62 in `runs/run-1-notes-market-data.md`.
[^187]: "S&P and Dow Jones Indices Historical Constituents Data API" (EODHD) and four other vendor pages listed in the register. https://eodhd.com/financial-apis/sp-and-dow-jones-indices-historical-constituents-data-api . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-65 in `runs/run-1-notes-market-data.md`.
[^188]: "Nasdaq-100 Index". https://indexes.nasdaqomx.com/Index/Overview/NDX . Accessed 2026-10-08. Strength A. Price label: gated and unverified (Global Index Watch price not public). Register ID MD-57 in `runs/run-1-notes-market-data.md`.
[^189]: "Invesco QQQ". https://www.invesco.com/qqq-etf/en/about.html . Accessed 2026-10-08. Strength A. Register ID MD-63 in `runs/run-1-notes-market-data.md`.
[^190]: "Russell Reconstitution" (FTSE Russell, part of LSEG). https://www.lseg.com/en/ftse-russell/russell-reconstitution . Accessed 2026-10-08. Strength A. Register ID MD-60 in `runs/run-1-notes-market-data.md`.
[^191]: "Nasdaq Composite". https://indexes.nasdaqomx.com/docs/FS_COMP.pdf . Accessed 2026-10-08. Strength A. Register ID MD-56 in `runs/run-1-notes-market-data.md`.
[^192]: "Index Methodology, Nasdaq Composite Index" (copyright 2025). https://indexes.nasdaqomx.com/docs/methodology_COMP.pdf . Accessed 2026-10-08. Strength A. Register ID MD-55 in `runs/run-1-notes-market-data.md`.
[^193]: "Symbol Look-Up/Directory Data Fields & Definitions". https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-64 in `runs/run-1-notes-market-data.md`.
[^194]: "NYSE Composite". https://en.wikipedia.org/wiki/NYSE_Composite . Accessed 2026-10-08. Strength B. Register ID MD-59 in `runs/run-1-notes-market-data.md`.
[^195]: "ICE Data Indices Benchmark Statement, NYSE Composite Index Family" (v1.1, November 2023). https://www.ice.com/publicdocs/data/ICE_Data_Indices_Benchmark_Statement_NYSE_Composite_Index_Family.pdf . Accessed 2026-10-08. Strength A. Register ID MD-58 in `runs/run-1-notes-market-data.md`.
[^196]: Hyperliquid info endpoint, request {"type":"metaAndAssetCtxs","dex":"xyz"} at 2026-10-09 16:56 UTC. https://api.hyperliquid.xyz/info . Accessed 2026-10-09. Strength A. Register ID PV-35 in `runs/run-2-notes-perps-venues.md`.
[^197]: Hyperliquid info endpoint, requests {"type":"metaAndAssetCtxs","dex":"mkts"}, "para", "io" at 2026-10-09 16:56 UTC. https://api.hyperliquid.xyz/info . Accessed 2026-10-09. Strength A. Register ID PV-36 in `runs/run-2-notes-perps-venues.md`.
[^198]: Lighter Docs, "Market Specifications" (Real World Assets), and Lighter public API orderBookDetails. Request: curl https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails at 2026-10-09 17:00 UTC, no key. https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails . Accessed 2026-10-09. Strength A. Register ID PV-53 in `runs/run-2-notes-perps-venues.md`.
[^199]: "Accessing EDGAR Data". https://www.sec.gov/os/accessing-edgar-data . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-66 in `runs/run-1-notes-market-data.md`.
[^200]: "EDGAR Application Programming Interfaces (APIs)". https://www.sec.gov/search-filings/edgar-application-programming-interfaces . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-67 in `runs/run-1-notes-market-data.md`.
[^201]: "Historical News Data". https://docs.alpaca.markets/docs/historical-news-data . Accessed 2026-10-08. Strength A. Price label: gated and unverified. Register ID MD-69 in `runs/run-1-notes-market-data.md`.
[^202]: "Benzinga". https://massive.com/partners/benzinga . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-70 in `runs/run-1-notes-market-data.md`.
[^203]: "Financial News API". https://eodhd.com/financial-apis/stock-market-financial-news-api . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-71 in `runs/run-1-notes-market-data.md`.
[^204]: "Connectors and plugins", financial services filter (Anthropic, Claude Marketplace). https://claude.com/marketplace/connectors-plugins?categories=financial-services . Accessed 2026-10-09. Strength A. Register ID S3 in `runs/run-2-trajectory.md`.
[^205]: "Pricing" (Quiver Quantitative API). https://api.quiverquant.com/pricing/ . Accessed 2026-10-08. Strength A. Price label: published. Register ID T12 in `runs/run-1-trajectory.md`.
[^206]: "MCP Server" (Quiver Quantitative API). https://api.quiverquant.com/mcp-server/ . Accessed 2026-10-08. Strength A. Register ID T13 in `runs/run-1-trajectory.md`.
[^207]: "Firecrawl connector" (Claude Marketplace, Anthropic). https://claude.com/marketplace/connectors/firecrawl . Accessed 2026-10-08. Strength A. Register ID T20 in `runs/run-1-trajectory.md`.
[^208]: "Pricing" (Firecrawl). https://www.firecrawl.dev/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T15 in `runs/run-1-trajectory.md`.
[^209]: "Coinversa Pulse" connector page (Anthropic, Claude Marketplace). https://claude.com/marketplace/connectors/coinversa-pulse . Accessed 2026-10-09. Strength A. Price label: gated and unverified (the price of the paid plan is not on the listing and sits behind an account). Register ID S5 in `runs/run-2-trajectory.md`.
[^210]: "Is agentic trading safe? What the SEC inquiry means for investors" (Matt Miczulski for Finder, syndicated on WFTV, July 27, 2026). https://www.wftv.com/news/is-agentic-trading/NV64RNJKZQ2MXN4LWQNOY6DS7I/ . Accessed 2026-10-09. Strength B. Register ID MB-77 in `runs/run-2-notes-margin-brokers.md`.
[^211]: "Pricing & Plans | Tradier". https://tradier.com/individuals/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID BR-38 in `runs/run-1-notes-brokers-regulation.md`.
[^212]: "Authentication" (Alpaca docs). https://docs.alpaca.markets/us/docs/authentication . Accessed 2026-10-08. Strength A. Register ID BR-20 in `runs/run-1-notes-brokers-regulation.md`.
[^213]: "alpacahq/alpaca-mcp-server" (GitHub, under Alpaca's own organization). https://github.com/alpacahq/alpaca-mcp-server . Accessed 2026-10-08. Strength A. Register ID BR-25 in `runs/run-1-notes-brokers-regulation.md`.
[^214]: "Commission and Clearing Fees" (Alpaca support). https://alpaca.markets/support/commission-clearing-fees . Accessed 2026-10-08. Strength A. Price label: published. Register ID BR-23 in `runs/run-1-notes-brokers-regulation.md`.
[^215]: "Trading Account" (Alpaca docs). https://docs.alpaca.markets/us/docs/account-plans . Accessed 2026-10-08. Strength A. Register ID BR-21 in `runs/run-1-notes-brokers-regulation.md`.
[^216]: "Trading Account" (Alpaca docs). https://docs.alpaca.markets/us/docs/account-plans . Accessed 2026-10-08. Strength A. Register ID BR-16 in `runs/run-1-notes-brokers-regulation.md`.
[^217]: "Charles Schwab Developer Portal" home page. https://developer.schwab.com/home . Accessed 2026-10-08. Strength A. Register ID T31 in `runs/run-1-trajectory.md`.
[^218]: "Best Brokers for Agentic Trading: AI Trading Agents Tested" (StockBrokers.com, Jessica Inskip, October 07, 2026; connector table "Last verified: September 16, 2026"). https://www.stockbrokers.com/guides/ai-agent-brokers . Accessed 2026-10-09. Strength C. Register ID MB-83 in `runs/run-2-notes-margin-brokers.md`.
[^219]: "Authentication and Client Creation" (schwab-py documentation). https://schwab-py.readthedocs.io/en/latest/auth.html . Accessed 2026-10-08. Strength D. Register ID BR-12 in `runs/run-1-notes-brokers-regulation.md`.
[^220]: "Pricing" (Charles Schwab). https://www.schwab.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T34 in `runs/run-1-trajectory.md`.
[^221]: "Public brokerage API for Algorithmic Trading | Stocks, Options & Crypto" (API documentation landing page). https://public.com/api/docs . Accessed 2026-10-08. Strength A. Register ID BR-59 in `runs/run-1-notes-brokers-regulation.md`.
[^222]: "Best Brokers for Agentic Trading: AI Trading Agents Tested" (StockBrokers.com, Jessica Inskip, October 07, 2026; connector table "Last verified: September 16, 2026"). https://www.stockbrokers.com/guides/ai-agent-brokers . Accessed 2026-10-09. Strength C. Register ID MB-79 in `runs/run-2-notes-margin-brokers.md`.
[^223]: "Public Trading API - Automate Stocks & Options Orders". https://public.com/api . Accessed 2026-10-08. Strength A. Price label: published. Register ID BR-58 in `runs/run-1-notes-brokers-regulation.md`.
[^224]: "INDIVIDUAL TRADER API PROGRAM TERMS AND CONDITIONS, June 2026" (PDF; text extracted locally from the fetched file). https://public.com/documents/individual-api-program . Accessed 2026-10-08. Strength A. Register ID BR-60 in `runs/run-1-notes-brokers-regulation.md`.
[^225]: "Place Order" API reference and "FAQ" (Webull API docs, read as plain text). https://developer.webull.com/apis/docs/reference/common-order-place . Accessed 2026-10-09. Strength A. Register ID MB-72 in `runs/run-2-notes-margin-brokers.md`.
[^226]: "MCP" (Webull OpenAPI docs). https://developer.webull.com/apis/docs/AI-friendly-Resources/mcp/ . Accessed 2026-10-09. Strength A. Register ID S19 in `runs/run-2-trajectory.md`.
[^227]: "Token | Webull API". https://developer.webull.com/apis/docs/authentication/token . Accessed 2026-10-08. Strength A. Register ID BR-53 in `runs/run-1-notes-brokers-regulation.md`.
[^228]: "Pricing" (Webull). https://www.webull.com/pricing . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-71 in `runs/run-2-notes-margin-brokers.md`.
[^229]: "Account Balance" API reference (Webull API docs, read as plain text). https://developer.webull.com/apis/docs/reference/account-balance . Accessed 2026-10-09. Strength A. Register ID MB-73 in `runs/run-2-notes-margin-brokers.md`.
[^230]: "Refresh Tokens | TradeStation API". https://api.tradestation.com/docs/fundamentals/authentication/refresh-tokens/ . Accessed 2026-10-08. Strength A. Register ID BR-42 in `runs/run-1-notes-brokers-regulation.md`.
[^231]: "Brokerage Trading API | Tradestation Fintech Solutions". https://developer.tradestation.com/trading-api . Accessed 2026-10-08. Strength A. Register ID BR-45 in `runs/run-1-notes-brokers-regulation.md`.
[^232]: "TradeStation MCP: AI Tools for Your Account" (TradeStation). https://www.tradestation.com/platforms-and-tools/mcp/ . Accessed 2026-10-09. Strength A. Price label: published. Register ID S14 in `runs/run-2-trajectory.md`.
[^233]: "Pricing" (TradeStation). https://www.tradestation.com/pricing/ . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-51 in `runs/run-2-notes-margin-brokers.md`.
[^234]: TradeStation home page, "What's new at TradeStation". https://www.tradestation.com/ . Accessed 2026-10-09. Strength A. Register ID MB-54 in `runs/run-2-notes-margin-brokers.md`.
[^235]: "OAuth2 authentication - tastytrade Developer Docs". https://developer.tastytrade.com/docs/authentication/oauth2/ . Accessed 2026-10-08. Strength A. Register ID BR-61 in `runs/run-1-notes-brokers-regulation.md`.
[^236]: "MCP Server - tastytrade Developer Docs". https://developer.tastytrade.com/docs/sdks-and-tools/mcp-server/ . Accessed 2026-10-08. Strength A. Register ID BR-64 in `runs/run-1-notes-brokers-regulation.md`.
[^237]: "Pricing" (tastytrade). https://tastytrade.com/pricing/ . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-67 in `runs/run-2-notes-margin-brokers.md`.
[^238]: "Margin and risk" (tastytrade Developer Docs) and the trading status reference. https://developer.tastytrade.com/docs/concepts/margin-and-risk/ . Accessed 2026-10-09. Strength A. Register ID MB-68 in `runs/run-2-notes-margin-brokers.md`.
[^239]: "Trading Web API" (IBKR Campus). https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/ . Accessed 2026-10-09. Strength A. Register ID MB-41 in `runs/run-2-notes-margin-brokers.md`.
[^240]: "Trading Web API" (IBKR Campus), sections "Order Reply Messages" and "Order Reply Suppression". https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/ . Accessed 2026-10-09. Strength A. Register ID MB-42 in `runs/run-2-notes-margin-brokers.md`.
[^241]: "TWS API v9.72+: Initial Setup" (same page as BR-27). https://interactivebrokers.github.io/tws-api/initial_setup.html . Accessed 2026-10-08. Strength A. Register ID BR-28 in `runs/run-1-notes-brokers-regulation.md`.
[^242]: "Trading Web API" (IBKR Campus). https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/ . Accessed 2026-10-09. Strength A. Register ID MB-43 in `runs/run-2-notes-margin-brokers.md`.
[^243]: "Interactive Brokers Review 2026: Pros, Cons and How It Compares" (NerdWallet, last updated Jul 17, 2026). https://www.nerdwallet.com/reviews/investing/brokers/interactive-brokers . Accessed 2026-10-08. Strength B. Price label: corroborated (NerdWallet and curvedtrading.com; the vendor pricing page refused the fetch tool). Register ID BR-32 in `runs/run-1-notes-brokers-regulation.md`.
[^244]: "Tradier Brokerage API" (Tradier docs, getting started). https://docs.tradier.com/docs/getting-started . Accessed 2026-10-08. Strength A. Register ID BR-34 in `runs/run-1-notes-brokers-regulation.md`.
[^245]: "Tradier MCP" (Tradier docs). https://docs.tradier.com/docs/tradier-mcp . Accessed 2026-10-08. Strength A. Register ID BR-40 in `runs/run-1-notes-brokers-regulation.md`.
[^246]: "OAuth Authentication" (Tradier docs, read as plain text). https://docs.tradier.com/docs/authentication . Accessed 2026-10-09. Strength A. Register ID MB-65 in `runs/run-2-notes-margin-brokers.md`.
[^247]: "Onboarding an external agent" (Robinhood support). https://www.robinhood.com/us/en/support/articles/agentic-trading-overview/ . Accessed 2026-10-09. Strength A. Register ID MB-57 in `runs/run-2-notes-margin-brokers.md`.
[^248]: "E*TRADE API Document". https://apisb.etrade.com/docs/api/account/api-balance-v1.html . Accessed 2026-10-08. Strength A. Register ID BR-49 in `runs/run-1-notes-brokers-regulation.md`.
[^249]: "Best Brokers for Agentic Trading: AI Trading Agents Tested" (StockBrokers.com, Jessica Inskip, October 07, 2026; connector table "Last verified: September 16, 2026"). https://www.stockbrokers.com/guides/ai-agent-brokers . Accessed 2026-10-09. Strength C. Register ID MB-78 in `runs/run-2-notes-margin-brokers.md`.
[^250]: "Get Access Token" (E*TRADE API documentation). https://apisb.etrade.com/docs/api/authorization/get_access_token.html . Accessed 2026-10-08. Strength A. Register ID BR-48 in `runs/run-1-notes-brokers-regulation.md`.
[^251]: "Pricing and Rates" (E*TRADE). https://us.etrade.com/what-we-offer/pricing-and-rates . Accessed 2026-10-09. Strength A. Price label: published. Register ID MB-49 in `runs/run-2-notes-margin-brokers.md`.
[^252]: "MCP Overview" (moomoo OpenAPI developers site) and "Introduction" (moomoo API documentation). https://open.moomoo.com/mcp-docs/overview . Accessed 2026-10-09. Strength A. Register ID MB-80 in `runs/run-2-notes-margin-brokers.md`.
[^253]: "API Trading" (Lightspeed). https://lightspeed.com/trading/api-trading . Accessed 2026-10-09. Strength A. Register ID MB-81 in `runs/run-2-notes-margin-brokers.md`.
[^254]: "Does Fidelity Have an API? - Blog | TradersPost" (published September 3, 2025; last modified August 6, 2026). https://blog.traderspost.io/article/does-fidelity-have-an-api . Accessed 2026-10-08. Strength C. Register ID BR-68 in `runs/run-1-notes-brokers-regulation.md`.
[^255]: Kalshi demo perps API, market list (public, no sign-in). Request: curl https://external-api.demo.kalshi.co/trade-api/v2/margin/markets at 2026-10-09 16:54 UTC. https://external-api.demo.kalshi.co/trade-api/v2/margin/markets . Accessed 2026-10-09. Strength A. Register ID PV-26 in `runs/run-2-notes-perps-venues.md`.
[^256]: Kalshi Help Center, "Perps Fees Explained" and "What are Perpetual Futures?" (dated 2026-07-24). https://help.kalshi.com/en/articles/16071417-perps-fees-explained . Accessed 2026-10-09. Strength A. Price label: gated and unverified. Register ID PV-29 in `runs/run-2-notes-perps-venues.md`.
[^257]: Hyperliquid Docs, "How to start trading" and "Bridge2". Lighter API Docs index. Kalshi and Ostium doc indexes. https://hyperliquid.gitbook.io/hyperliquid-docs/llms-full.txt . Accessed 2026-10-09. Strength A. Register ID PV-68 in `runs/run-2-notes-perps-venues.md`.
[^258]: CoinMarketCap Academy, "Kraken's Parent Plans US Hyperliquid Perps: Will They Feel On-Chain?" (undated on the page, early October 2026 by its own data references). https://coinmarketcap.com/academy/en/article/kraken-payward-us-hyperliquid-perps-onchain . Accessed 2026-10-09. Strength C. Register ID PV-71 in `runs/run-2-notes-perps-venues.md`.
[^259]: Hyperliquid Docs, "Nonces and API wallets" and "Exchange endpoint" (Approve an API wallet). Hyperliquid official SDK example examples/basic_agent.py. https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets . Accessed 2026-10-09. Strength A. Register ID PV-41 in `runs/run-2-notes-perps-venues.md`.
[^260]: Hyperliquid Docs, "Rate limits and user limits", "API", "Robust price indices". https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits . Accessed 2026-10-09. Strength A. Register ID PV-42 in `runs/run-2-notes-perps-venues.md`.
[^261]: Lighter API Docs, "API keys" (updated 2026-09-29). https://apidocs.lighter.xyz/docs/api-keys . Accessed 2026-10-09. Strength A. Register ID PV-56 in `runs/run-2-notes-perps-venues.md`.
[^262]: Lighter Docs, "Trading Fees". https://docs.lighter.xyz/llms-full.txt . Accessed 2026-10-09. Strength A. Price label: published. Register ID PV-54 in `runs/run-2-notes-perps-venues.md`.
[^263]: Ostium Docs, "Stocks" (market list) and "Stocks: Day Trading". https://docs.ostium.com/llms-full.txt . Accessed 2026-10-09. Strength A. Price label: published. Register ID PV-58 in `runs/run-2-notes-perps-venues.md`.
[^264]: Ostium Docs, "Builder API overview", "Getting keys from the App", SDK modes. https://docs.ostium.com/llms-full.txt . Accessed 2026-10-09. Strength A. Register ID PV-59 in `runs/run-2-notes-perps-venues.md`.
[^265]: Decrypt, "Another DeFi Exploit: Perp DEX Ostium Loses $18 Million in Oracle Attack", 2026-07-15. The Defiant tag page headline "Ostium to Reopen Trading July 23 After $23.8M Vault Exploit" (search tool summary). https://decrypt.co/373566/defi-exploit-ostium-oracle-hack . Accessed 2026-10-09. Strength B. Register ID PV-61 in `runs/run-2-notes-perps-venues.md`.
[^266]: Liquid Docs, "Markets You Can Trade". https://docs.tryliquid.xyz/about-liquid/markets . Accessed 2026-10-09. Strength A. Register ID PV-49 in `runs/run-2-notes-perps-venues.md`.
[^267]: Liquid Docs, "Developers & Other MCP Clients". https://docs.tryliquid.xyz/co-invest/developers . Accessed 2026-10-09. Strength A. Register ID PV-48 in `runs/run-2-notes-perps-venues.md`.
[^268]: "massive-com/mcp_massive". https://github.com/massive-com/mcp_massive . Accessed 2026-10-08. Strength A. Register ID MD-09 in `runs/run-1-notes-market-data.md`.
[^269]: "alpacahq/alpaca-mcp-server". https://github.com/alpacahq/alpaca-mcp-server . Accessed 2026-10-08. Strength A. Register ID MD-14 in `runs/run-1-notes-market-data.md`.
[^270]: "twelvedata/mcp". https://github.com/twelvedata/mcp . Accessed 2026-10-08. Strength A. Register ID MD-27 in `runs/run-1-notes-market-data.md`.
[^271]: "alphavantage/alpha_vantage_mcp". https://github.com/alphavantage/alpha_vantage_mcp . Accessed 2026-10-08. Strength A. Register ID MD-31 in `runs/run-1-notes-market-data.md`.
[^272]: "MCP Server for Financial Data by EODHD". https://eodhd.com/financial-apis/mcp-server-for-financial-data-by-eodhd . Accessed 2026-10-08. Strength A. Register ID MD-46 in `runs/run-1-notes-market-data.md`.
[^273]: "Hooks reference". https://code.claude.com/docs/en/hooks.md . Accessed 2026-10-08. Strength A. Register ID RT-30 in `runs/run-1-notes-runtime-platform.md`.
[^274]: Relii project instructions (local file `~/Projects/relii/CLAUDE.md`, the owner's own document). local file, no web address . Accessed 2026-10-09. Strength A. Register ID S1 in `runs/run-2-trajectory.md`.
[^275]: "Robinhood is Now Open to Agents" (Robinhood newsroom, May 27, 2026). https://robinhood.com/newsroom/robinhood-is-now-open-to-agents/ . Accessed 2026-10-08. Strength A. Register ID BR-65 in `runs/run-1-notes-brokers-regulation.md`.
[^276]: "Handling WebSockets" (Supabase docs). https://supabase.com/docs/guides/functions/websockets.md . Accessed 2026-10-08. Strength A. Register ID RT-54 in `runs/run-1-notes-runtime-platform.md`.
[^277]: "Get Account" API reference (Alpaca docs, updatedAt 2026-05-27) and "Margin and Short Selling". https://docs.alpaca.markets/us/reference/getaccount-1 . Accessed 2026-10-09. Strength A. Register ID MB-26 in `runs/run-2-notes-margin-brokers.md`.
[^278]: "Configuring regions for Vercel Functions" (Vercel docs). https://vercel.com/docs/functions/configuring-functions/region.md . Accessed 2026-10-08. Strength A. Register ID RT-49 in `runs/run-1-notes-runtime-platform.md`.
[^279]: "Aggregates (Per Minute)" (Massive WebSocket docs, stocks). https://massive.com/docs/websocket/stocks/aggregates-per-minute.md . Accessed 2026-10-09. Strength A. Register ID DC-44 in `runs/run-2-notes-data-cadence.md`.
[^280]: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17) and "Trading Account" (Alpaca docs, updatedAt 2026-07-07). https://docs.alpaca.markets/us/docs/margin-and-short-selling . Accessed 2026-10-09. Strength A. Register ID MB-22 in `runs/run-2-notes-margin-brokers.md`.
[^281]: "Setting up an agent" and "Trading with your agent" (Robinhood support). https://robinhood.com/us/en/support/articles/setting-up-an-agent/ . Accessed 2026-10-09. Strength A. Register ID MB-56 in `runs/run-2-notes-margin-brokers.md`.
