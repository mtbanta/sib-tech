# Run 1 deliverable: scoping the stack for sib-tech

Written 2026-10-08 (America/Chicago). All sources were opened live on that date.

**What this document is.** It is research input for a human decision. It is not an instruction to trade, to open an account, to buy a subscription or to build anything. It recommends an architecture and Michael decides. It does not choose a provider, a broker, a run frequency, a driver, a research method or a ticker.

**How to read the footnotes.** Every factual claim carries a numbered footnote marker. The Sources section at the end lists each number with its title, address, access date, a strength label and, for prices, a price label. Each entry also carries a register ID (for example BR-35) that points to the fuller note, with a quote, in the `runs/run-1-notes-*.md` files or in `runs/run-1-trajectory.md`. Sentences marked "my judgment" or "my inference" are reasoning from the cited facts and are not themselves sourced.

**A caution about quotes.** Most pages were read through a tool that converts a page to text and can paraphrase lightly. Quotes read in a browser by the main session (the Anthropic terms, Schwab, Interactive Brokers, the connector directory and the spot-checked price pages) are exact. Before a decision hangs on the exact wording of any other quote, reopen the address.

## 1. Summary

**Strongest option: D, the hybrid.** A small program that stays running during market hours handles the parts that must be fast and exact: listening to live prices, keeping a ledger of settled cash, checking every order against fixed limits, and talking to the broker. Claude sits on top as the research and explanation layer, reading and writing the same database. It scores 3.85 out of 5 against the weighted criteria in section 2, ahead of the always-on worker alone (3.60), the Relii-style web app (3.25), the hosted algorithm platform (3.15) and Claude in the chair (2.50).

Why it comes out first, in four sentences. It is the only option that supports both driver models the brief leaves open, and the only one that scores at least 4 on all three run modes. Holding a live price stream needs something that stays running, and the evidence shows that neither Claude Code's schedulers nor Vercel nor Supabase functions can do that.[^1][^2][^3] It keeps the order path out of a Claude subscription, which matters because Anthropic's Consumer Terms, the terms that govern a Max plan, list relying on the service "to buy or sell securities" among prohibited uses.[^4] And it can be built in stages, research layer first, without that first stage being thrown away later (my judgment).

**The margin is thin and the pick is conditional.** D beats C by a quarter of a point, and D is the hardest option for a non-coder to keep running. If operability is weighted above intraday fitness, B (the Relii-style web app) comes out first instead. Section 6 states exactly what evidence would overturn the pick.

**Three findings that shape everything, whichever option is chosen.**

1. **Anthropic's terms bear on the driver question.** The Consumer Terms that govern a Max plan prohibit relying on the service "to buy or sell securities" or to "receive advice about securities".[^4] The Commercial Terms that govern pay-as-you-go use contain no equivalent passage that this run could find.[^5] The Usage Policy, which applies to both, treats a personalized recommendation to buy, sell or hold as high-risk and requires review by a qualified person.[^6] This is quoted, not interpreted. It is the first open question in section 7.
2. **A cash account is limited by settled cash, not by a count of trades.** Stock and ETF (exchange traded fund) trades settle one business day after the trade.[^7][^8] Buying with unsettled sale proceeds and then selling again before they settle is a good faith violation, and three in 12 months can restrict the account to settled cash for 90 days.[^8] The pattern day trader rule and its 25,000 dollar minimum were replaced effective June 4, 2026, and never applied to cash accounts.[^9][^10] So the stack must know settled cash at every moment (my inference from the rules).
3. **"Real time" price data is often one small exchange, not the whole market.** Several vendors' real-time feeds carry roughly 2.5 to 5 percent of trading volume.[^11][^12] The lowest published price found for consolidated real-time data from a data vendor is 99 dollars a month.[^13] One broker includes consolidated real-time data with its account.[^14]

## 2. Criteria and weights

Seven criteria, weights summing to 100. Scores run from 1 (worst) to 5 (best). The scores are my judgment applied to cited facts. They are not measurements, and what would turn each into a measurement is named in section 6.

| # | Criterion | Weight | Why this weight | A score of 1 means | A score of 3 means | A score of 5 means |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | Path to placing trades in a cash account | 25 | The brief says the stack must be judged on whether it can get to placing trades, and the cash account is the tightest constraint found | Cannot place orders, or only by a route the provider's terms appear to prohibit | Can place orders, but one requirement (settled cash known, long-lived sign-in, terms that allow it) needs a human each time or rests on unverified evidence | Orders go from decision to broker unattended, in a cash account, with settled cash read from the broker, on a sign-in that lasts, under terms that clearly allow it |
| 2 | Fitness for intraday timing | 20 | The trading style is fixed as intraday | Cannot run more often than hourly or daily without a person present | Can check prices every minute by asking repeatedly, but cannot hold a live stream | Holds a live price stream all session and reacts in seconds |
| 3 | Flexibility across run modes and driver models | 15 | The brief leaves both deliberately undecided, so an option that closes either door costs something | One driver model and one strong run mode | One driver model, or one weak run mode | Both driver models, and at least 4 on all three run modes |
| 4 | Operability for a non-coder | 15 | Michael writes no code and must still notice when it breaks | Several parts he is responsible for keeping alive, failing silently by default | Code hosted by a platform that keeps it running, or one managed always-on part | No code to maintain and nothing to keep running |
| 5 | Safety and control | 10 | An agent that can spend money needs gates, but every option can be made safer by design, so this separates options less than the others | A language model can send orders with no fixed check and no prompt | Fixed checks or human approval, not both by default; credentials shared with one outside party | Every order passes a fixed check and an approval gate; credentials in one place he controls; full record |
| 6 | Monthly cost of the platform itself | 10 | Kept low because the owner chose to band cost, not cap it. Covers the model, hosting and storage. Market data and brokerage are left out because every option needs them | Band 4 | Band 2 | Band 0 |
| 7 | Reversibility | 5 | Low because nothing here is permanent, but lock-in is still a cost | Logic lives in a vendor's own format | Swapping needs rewriting, but the data and logic are his and portable | Swapping a provider or the driver is a settings change |

Scores of 2 and 4 fall between the descriptions.

## 3. Source strength scale and cost bands

**Source strength.** Four levels, fixed before the first search.

| Label | Meaning |
| :-- | :-- |
| A | Primary and authoritative: a regulator, an exchange, an index owner, or the vendor's own documentation, pricing page or terms, seen live |
| B | Reputable independent press or an established reference publisher |
| C | Review sites, comparison sites and affiliate blogs, which have a commercial incentive |
| D | Forums, social posts, personal blogs and community code repositories |

**Price labels.** Every price carries one of three.

| Label | Meaning |
| :-- | :-- |
| Published | On the vendor's own public page, seen live on the access date |
| Corroborated | Not seen on a vendor page, but at least two independent sources agree, and they are named |
| Gated and unverified | Behind a sign-in, a signup or a sales call, or on a page that would not load, and not corroborated. The reason is stated |

**Cost bands.** Per month, per category, in U.S. dollars.

| Band | Range | Why this edge |
| :-- | :-- | :-- |
| 0 | Free | |
| 1 | 1 to 25 | About one small subscription. Supabase Pro is 25.[^15] |
| 2 | 26 to 100 | The lowest published consolidated real-time data plan found is 99,[^13] and Claude Max 5x is 100.[^16] |
| 3 | 101 to 300 | Separates hobby-scale from professional-scale data. Massive's real-time plan is 199.[^17] |
| 4 | Over 300 | |

A band is a range, not a quote. Where an option's total depends on how often it runs, that is said, because the run frequency is not decided.


## 4. The options

Five architectures. Before them comes a shared reference, because all five draw on the same rules and the same pool of candidate providers. Each option then says which categories it needs, which candidates fit it, and what band each falls in.

Fewer than five would have left out a distinct answer to the two questions the evidence made decisive: what stays running during market hours, and whether a language model sits in the order path. More than five was not warranted. Three things were looked at and set aside as architectures:

- **Liquid and its Co-Invest connector** (the "LiquidTrade" and "Co-Invest" named in this repo's `CLAUDE.md`). They are one vendor.[^18] Its terms say "We do not operate any exchange, designated contract market, swap execution facility, broker-dealer,".[^19] Its docs describe its stock markets as perpetual markets, which are contracts that track a price and are not shares.[^20] Trades route to venues named Hyperliquid, Lighter and Ostium.[^21] It cannot trade real shares in a brokerage cash account, so it does not meet the brief. Its terms do not state whether U.S. residents may use it.[^19]
- **Composer.** Its automated trades happen once a day, between 3:45 PM and 4:00 PM Eastern, so it is not an intraday platform.[^22]
- **TradingView alerts.** An alert can send a web callback to another system, which must answer within three seconds.[^23] No page was found saying an alert can place an order at a broker by itself.[^24] It is a possible trigger for options B to D, not an architecture.

### 4.0 Shared reference

#### 4.0.1 Rules that affect every option

**Settlement and the cash account.**

- U.S. stock and ETF trades settle one business day after the trade date. This is written T+1.[^7][^8]
- In a cash account a purchase must be paid for in full before the security is sold.[^25] The federal rule is section 220.8 of Regulation T.[^26]
- Schwab describes three violations.[^8] A good faith violation is buying with unsettled funds and selling before those funds settle. Three in 12 months can restrict the account to settled cash for 90 days. Freeriding is buying and selling without ever paying. One instance in 12 months can bring the same 90 day restriction. A cash liquidation violation is selling something else, after the fact, to cover a purchase. Fidelity describes the same three types and the same 90 day restriction after three good faith violations.[^27]
- What this means for trading the same dollars twice in a day: a dollar of settled cash can fund a buy and a same-day sell. The sale proceeds are unsettled until the next business day. A second same-day round trip funded by those proceeds becomes a good faith violation when the second position is sold. No source gives a number of trades per day. The limit is the settled cash at the start of the day.[^28]
- **What this means for the stack (my inference):** the agent must know settled cash, separately from total cash, before every order. That needs either a broker whose interface reports it, or a ledger the agent keeps itself, and ideally both.

**The pattern day trader rule.**

- The Securities and Exchange Commission (SEC) approved a replacement on April 14, 2026. It took effect June 4, 2026. It removes the pattern day trader label and the 25,000 dollar minimum.[^9][^29] FINRA is the Financial Industry Regulatory Authority, the brokerage industry's regulator.
- Brokers that need more time may keep applying the old rule until October 20, 2027.[^30]
- The old rule was written for margin accounts and never applied to cash accounts.[^10] FINRA says frequent trading in a cash account is governed by the settlement and payment rules above.[^31]
- **For the stack:** this rule does not constrain a cash account. It would matter only at a broker that offers no cash account.

**Market data licensing for a program instead of a person.**

- Exchanges price data in classes. A "non-professional subscriber" is a person using data only for personal, non-business purposes, and pays the lower rate.[^32]
- "Non-display use" is a separate class for data consumed by a machine. The New York Stock Exchange (NYSE) lists "Automated order or quote generation" as an example. The policy is written around organizations, and whether an individual feeding quotes into a personal program is charged this way is not settled by the document.[^33]
- One vendor's individual terms say its data is "strictly for display use only" and bar non-display use unless licensed, without defining the term.[^34]
- **For the stack:** this bears on any option where software reads prices with no person watching (B, C, D and E). It is unresolved and is an open question in section 7.

**Anthropic's terms, wherever Claude is in the loop.**

- Claude Code used on a Max plan falls under the Consumer Terms. Use through an API key falls under the Commercial Terms.[^35] An API (application programming interface) is the way one program talks to another, and an API key is the password a program uses, billed by usage.
- Consumer Terms, section 3, under "You may not access or use, or help another person to access or use, our Services in the following ways": "To rely upon the Services, the Materials, or the Actions to buy or sell securities" "or to provide or receive advice about securities, commodities, derivatives, or other financial products or services," "as Anthropic is not a broker-dealer or a registered investment adviser".[^4]
- The same list prohibits automated access "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it".[^4] Anthropic's documentation does explicitly describe unattended runs, routines and scheduled tasks on a subscription.[^36]
- Commercial Terms: no passage about securities, broker-dealers, investment advice or trading was found. This was a tool-assisted read of a long document, not a lawyer's read.[^5]
- Usage Policy, which applies under both sets of terms. The version in force on the access date lists "investment advice" among high-risk finance uses and requires that "a qualified professional in that field must review the content or decision prior to dissemination or finalization" when it directly affects individuals or consumers.[^37] A new version takes effect November 12, 2026. It names "a personalized recommendation to buy, sell, hold, or allocate among specific investment products", requires that "A qualified person must meaningfully review a High-risk AI Recommendation", and defines a qualified person as "someone with the training or experience to evaluate the output in that field". It states "Agentic use cases must comply with the Usage Policy." No exclusion for personal use was found on the page.[^6]
- Related signals from Anthropic. Cloud routines run with no permission prompts, and every connected connector is included by default with write access.[^38] Anthropic advises against scheduling Cowork tasks that make purchases or take actions that are hard to undo.[^39] Its browser agent is prohibited from executing trades.[^40]
- **For the stack:** this run does not interpret these terms. It scores against the November 2026 Usage Policy text because the stack will outlive that date. Whether a personal research or trading agent is permitted on a Max plan, and whether Michael counts as a "qualified person" for his own account, are open questions that only Anthropic can settle in writing.

#### 4.0.2 Categories, candidates and cost bands

Eight categories. A candidate appearing here is a candidate, not a choice.

**Category 1: the reasoning model.**

| Candidate | What it is | Price | Band |
| :-- | :-- | :-- | :-- |
| Claude Max subscription | One pool of usage shared by the Claude apps and Claude Code.[^41] Limits reset every five hours and weekly, with no published numbers.[^42] | 100 or 200 a month, published[^16] | 2 or 3 |
| Claude API, pay per use | Billed per million tokens (a token is roughly three quarters of a word). Opus 5.5 is 4 in and 20 out, Sonnet 5.5 is 2 and 10, Haiku 5.5 is 0.10 and 0.50, published.[^43] Batch processing is half price.[^44] Max plans now include a monthly API credit of 100 or 200.[^45] | Depends on run frequency. Not measured | Unknown until a week of real runs is read off the usage page |
| Claude Managed Agents | Anthropic hosts the agent. Token rates plus 0.08 per session-hour, published.[^46] Schedules down to one minute. Beta.[^47] | Depends on run frequency | Unknown |
| No language model | Fixed rules only. Possible in options C and E | 0 | 0 |

**Category 2: where it runs.**

| Candidate | Smallest schedule | Can it hold a live stream? | Longest run | Price and band |
| :-- | :-- | :-- | :-- | :-- |
| Claude Code cloud routines | 1 hour[^1] | No. An outside system can start one with a web request, up to 30 an hour per routine[^48] | Not stated[^49] | Inside the Max plan |
| Claude Code desktop scheduled tasks | 1 minute, but only while the Mac is awake with the lid open[^50][^51] | No | Not verified | Inside the Max plan |
| Cowork scheduled tasks | Hourly[^52] | No | Not verified | Inside the Max plan |
| Claude Code run without a person, started by an outside scheduler | Whatever the scheduler allows.[^53] The docs warn that a mode needing an API key will become the default for this[^54] | No | No maximum documented[^55] | Max limits today[^56] |
| GitHub Actions | 5 minutes, and runs can be delayed or dropped at busy times[^57] | Not as a server. A job is capped at 6 hours[^58] | 6 hours | 2,000 free minutes a month on private repos, then 0.006 a minute, published.[^59] Band 0 to 1 |
| Vercel Hobby | Once a day[^60] | No. Runs end at 300 seconds[^61] | 300 seconds | 0, published.[^62] Non-commercial use only, and whether trading one's own account counts is not answered[^63] |
| Vercel Pro | 1 minute[^60] | No. Connections are cut at the run limit[^2] | 800 seconds[^61] | 20, published.[^62] Band 1 |
| Supabase (Pro) | 1 second, through scheduled jobs inside the database[^64] | No. A function lives at most 400 seconds[^65][^3] | 400 seconds | 25 with one project covered, about 10 for each further project, published.[^15][^66] Band 1 |
| Cloudflare Workers with Durable Objects | 1 minute[^67] | Yes. A Durable Object can hold an outgoing stream, billed while connected. How long it stays up is not verified[^68] | Limited by processor time, not waiting time[^67] | From 5, published.[^69] Band 1 |
| A small always-on rented server | Its own scheduler (my inference, not quoted from a vendor page) | Yes (my inference: these are machines billed for running all month) | No limit seen | Fly.io 2.19,[^70] DigitalOcean 4,[^71] AWS Lightsail 3.50 to 5,[^72] Railway 5,[^73] Render 7,[^74] all published. Hetzner gated and unverified, because prices did not render.[^75] Band 1 |
| Michael's Mac | Jobs run late or are skipped while it sleeps[^76] | Only while awake with the lid open[^51] | Not verified | 0 |
| QuantConnect | The strategy stays deployed on its servers[^77] | Yes. Its servers receive real-time data for the strategy[^77] | Not verified | Researcher tier 84, published. Live trading node price gated and unverified[^78][^79] |

**Category 3: memory.** Where the agent keeps what it learned between runs.

| Candidate | How it works | Band |
| :-- | :-- | :-- |
| Files in the repository, and Claude Code's own notes | Each Claude session starts empty. Instructions files and local notes carry memory. Local notes live on the Mac, so a cloud run sees only what is committed to the repository or held elsewhere[^80] | 0 |
| A Postgres database (Supabase) | A database the software and Claude can both read. Supabase is in Anthropic's connector directory[^81] | 1[^15] |
| The API memory tool | Claude asks for file operations and the owner's own software carries them out, so memory lives wherever that software puts it[^82] | 0 beyond storage |
| Managed Agents memory stores | Document collections that survive across sessions. Beta[^83] | Not priced separately on the pages read |

**Category 4: price data.** "SIP" is the Securities Information Processor, the official feed that merges every U.S. exchange. "IEX" is one exchange. A WebSocket is a connection that stays open so prices are pushed as they change. "MCP" is the Model Context Protocol, the standard that lets Claude call an outside tool, and a "connector" is a tool offered that way.

| Candidate | Plans and published price | Real time, and from where | Stream | Official MCP server | Notes |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Massive (Polygon.io, renamed October 30, 2025[^84]) | 0, 29, 79, 199[^17] | Only the 199 plan is real time. The 29 and 79 plans are 15 minutes delayed and the free plan is end of day[^17][^85] | Paid plans[^86] | Yes, hosted, data only[^87] | Individual, non-professional use.[^88] "Display use only" clause[^34] |
| Alpaca Market Data | Free, or 99[^13] | Free is IEX only, about 2.5 percent of volume. 99 is all U.S. exchanges[^13][^11] | Free: 30 symbols. Paid: unlimited[^13] | Yes, runs locally, and also places orders[^89] | Whether a data plan needs an Alpaca brokerage account was not verified |
| Databento | 199 for live data[^90] | Not the SIP. A blend built from several venues[^91] | Yes | None found[^92] | |
| Twelve Data | Free, 79, 229, 999, with a second conflicting price set on the same page[^93] | About 5 percent of U.S. volume by default. Consolidated data is priced through sales, gated and unverified[^12] | From the 229 plan[^94] | Yes, hosted[^95] | Listed in Anthropic's directory[^81] |
| Alpha Vantage | Free (25 requests a day), then 49.99 to 249.99[^96] | Real time needs a separate entitlement step. The feed source is not stated[^97] | None seen[^98] | Yes, hosted[^99] | Listed in Anthropic's directory[^81] |
| Tiingo | 0 or 30[^100] | IEX only,[^101] and the full feed needs a signed agreement with IEX[^102] | Yes[^101] | Not checked | |
| Finnhub | Free tier: 60 calls a minute, stream of 50 symbols. The only paid plan shown is 3,500[^103] | Not stated on the page read | Yes[^103] | None found[^104] | Personal use only[^105] |
| Financial Modeling Prep (FMP) | 0, 29, 69, 139 billed monthly[^106] | Intraday charts start at the 69 plan and one minute charts at 139. The feed source is not stated[^106] | Not stated | Not confirmed on a vendor page.[^107] A connector named FMP is listed in Anthropic's directory[^81] | |
| EODHD | 19.99 to 99.99[^108] | One exchange, not the consolidated feed[^109] | 50 symbols[^109] | Yes, hosted, read only[^110] | Intraday history is finalized 2 to 3 hours after the close[^111] |
| Intrinio | 150 for an individual[^112] | Real-time products are separate[^112] | Not checked | Yes, hosted, read only[^113] | |
| Data that comes with a brokerage account | See category 8 | Tradier: consolidated real time for account holders.[^14] Interactive Brokers: free streaming that is not consolidated,[^114] with paid subscriptions for data through its API.[^115] Webull: bought separately, price not shown[^116] | | | |

Set aside: IEX Cloud closed on August 31, 2024.[^117] Yahoo Finance through unofficial libraries conflicts with Yahoo's terms, which prohibit automated collection.[^118][^119]

**Coverage of the universe preference.** This is two separate questions.

*Question 1, can the feed price the stocks?* A feed covering every U.S. exchange-listed stock and ETF can price every member of all six indexes. Massive states coverage of every U.S. exchange plus over-the-counter trading.[^120] Alpaca's paid plan covers all U.S. exchanges but not over-the-counter stocks.[^11][^121] Databento covers all exchange-listed stocks and ETFs.[^122] Tradier's feed is consolidated from all exchanges.[^14] The single-exchange feeds (Alpaca free, Tiingo, Twelve Data's default, EODHD) do carry the symbols, but only the small share of trades that happen on that one venue, which matters most for the thinly traded Russell 2000 names (the last clause is my inference). Coverage statements for the other vendors were not captured.

*Question 2, where does the list of members come from?* That is separate, and often licensed.

| Index | Size | A free route to the member list | Gaps |
| :-- | :-- | :-- | :-- |
| Dow Jones Industrial Average | 30[^123] | State Street's daily holdings file for its Dow fund[^124] | A fund's holdings are a close stand-in, not the official list |
| S&P 500 | 503[^123] | Daily holdings files from State Street and iShares funds[^124] | Same. A paid constituents product exists at 29.99 a month[^125] |
| Nasdaq 100 | 101[^126] | The Invesco fund tracks it, but a downloadable file was not confirmed[^127] | The official list is sold through a Nasdaq service whose price is gated and unverified[^126] |
| Russell 2000 | 1,996[^128] | iShares' daily holdings file, which held 1,985 names[^124] | Rebuilt twice a year from 2026[^128] |
| NASDAQ Composite | 3,396[^129] | Nasdaq Trader's free symbol files, filtered. The index is every eligible security listed only on Nasdaq[^130][^131] | The files also list preferred shares, warrants and funds, which must be filtered out[^131] |
| NYSE Composite | Over 2,000, from a reference site only[^132] | The same symbol files, filtered by listing exchange[^131] | No tracking fund was found. The only eligibility text read dates from 2004[^133] |

No candidate is ruled out on coverage. The practical point is that the two Composites and the Russell 2000 push the watch list into the thousands, which the free streaming tiers (30 or 50 symbols) cannot carry.[^13][^103]

**Category 5: news, filings and calendars.**

| Candidate | What it gives | Price and band |
| :-- | :-- | :-- |
| SEC EDGAR, the regulator's filing system | Company filings and reported figures, updated within about a second of filing, no key needed, up to 10 requests a second[^134][^135] | 0 |
| Alpaca news | Supplied by Benzinga, real time over a stream. Whether the free plan includes it is not stated[^136] | Not verified |
| Massive add-ons | Benzinga news, earnings and ratings at 99 each[^137] | 2 each |
| EODHD | News in every plan. Earnings calendar in the 59.99 and 99.99 plans[^138] | 0 to 2 |
| Finnhub free tier | Company news and a one month earnings calendar[^103] | 0 |
| Alpha Vantage | News, earnings calendar and economic indicators, plan not verified per item[^139] | Not verified |
| FRED, the St. Louis Federal Reserve's data service | Economic data. Needs a registered key[^140] | Not verified as free from the pages read |
| Connectors listed in Anthropic's directory | MT Newswires, Aiera, Quartr, Zacks Data, Morningstar and others. Prices not researched[^81] | Not researched |

**Category 6: alternative data and web reading.**

| Candidate | What it gives | Price and band |
| :-- | :-- | :-- |
| Quiver Quantitative | Trades by members of Congress, government contracts, lobbying, off-exchange trading, and on the higher plan insider trades and hedge fund holdings. Its own hosted MCP server is included and works with Claude Code.[^141][^142] Not in Anthropic's directory on the access date[^81] | 30 or 75 a month, published.[^141] Band 2. The website subscription is separate at 25 and includes no API key[^143] |
| Firecrawl | Reads and searches web pages for an agent. Listed in Anthropic's directory with its own connector[^144] | Free 1,000 credits a month, then 19 a month for 5,000, published.[^145] Band 0 to 1 |

**Category 7: seeing and approving.** How Michael watches the agent and says yes or no. Candidates are the Claude apps themselves (option A and D), a web dashboard on Vercel (options B and D),[^62] and the broker's own app where the broker requires confirmation there.[^146][^147] No separate price beyond categories 1 and 2.

**Category 8: brokerage and order execution.** "Unattended sign-in" means how long software can keep working before a person must sign in again. "Paper trading" is practice with pretend money.

| Broker | API for a person's own account | Cash account and settled cash through the API | Unattended sign-in | Commission on U.S. stocks and ETFs | Official MCP server, and can it send an order? |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Charles Schwab | Yes[^148] | Fields for unsettled cash appear only in a community library, strength D.[^149] Not confirmed on a Schwab page | A person signs in again every 7 days, per two community sources, strength D.[^150] Schwab's public guides do not state the period[^151] | 0 online, published[^152] | None found. Community servers exist.[^153] Not in Anthropic's directory[^81] |
| Tradier | Yes, with a practice environment[^154] | Yes. Reports account type "cash" and an unsettled funds figure[^155] | A personal token. Whether it expires is not stated[^156] | 0.35 a trade on the free plan, or 0 a trade on the 10 a month plan, published[^157] | Yes, hosted, can place orders, described as still being built[^158] |
| E*TRADE | Yes[^159] | Yes. Reports settled and unsettled cash separately[^160] | A person signs in every day. The token ends at midnight Eastern[^161] | Not verified | None found[^162] |
| Interactive Brokers | Yes, on the Pro plan only[^114] | Not verified | Needs a desktop program kept signed in, with a fresh sign-in about weekly[^163][^164] | Lite is commission-free but has no API.[^114] Pro is 0.005 a share fixed, corroborated by NerdWallet and curvedtrading.com[^165] | Yes. Drafts orders for approval in the account. "Claude never submits orders directly to the market."[^147] |
| Alpaca | Yes, with paper trading[^166] | **No cash account.** Every account is a margin account.[^167][^168] No settled cash field[^169] | Key and secret. No expiry stated[^170] | 0, published[^171] | Yes, runs locally, can place orders, starts in paper mode[^172] |
| TradeStation | Yes, with a simulator[^173] | Not verified | Sign-in does not expire by default[^174] | 0 per one review site. Gated and unverified, because the vendor page refused the fetch tool[^175] | Yes, per trade press, January 2026[^176] |
| tastytrade | Yes, with a practice environment[^177] | Not verified | Sign-in does not expire[^178] | Not verified | Yes, self-hosted. Orders need a one-time confirmation code valid 60 seconds[^179] |
| Webull | Yes, no charge for access, published[^180] | Not verified | Lapses after 15 days without use[^181] | Not verified | Yes, hosted. Its docs say an order must be confirmed in the Webull app.[^146] The listing in Anthropic's directory shows no tool that places an order[^182] |
| Public | Yes, commission-free, personal use, published[^183] | Not verified | Not verified | 0, published[^183] | Yes, hosted.[^184] Public may end API access at any time without notice[^185] |
| Robinhood | Only through its Agentic Trading product, launched May 27, 2026[^186] | The agent trades in a separate account. Whether that account is cash or margin is not verified[^187] | Not verified | Not verified | Yes. Per-trade approval is off by default for outside agents[^188] |
| Fidelity | No retail API, per one review source, strength C[^189] | | | | None found |

Band for brokerage: 0 to 1 for every broker with a verified price. Three cautions. Alpaca fails the brief's cash account requirement as things stand. "None found" for an official MCP server rests on one or two searches each and has already been wrong once in this run.[^190] And commission is not the whole cost of trading: a small regulatory fee applies to sales.[^157]


In the score tables below, run modes and memory modes use the same 1 to 5 scale. Event-triggered mode is scored in two parts, because the evidence showed platforms differ exactly here. "Callback" means something else wakes the agent with a web request. "Stream" means the agent itself holds an open connection and hears each price change.

### Option A: Claude in the chair

**The architecture in plain English.** No program is written. Claude is the agent. Michael opens Claude Code, the desktop app or Cowork and asks, or a scheduled Claude run starts by itself. Claude reads its instructions file, calls connectors to fetch prices, news and filings, reasons about them, and writes its recommendation to a file. Later, a broker connector drafts or places the order. Claude Code reaches outside tools through MCP servers, and connectors added in the Claude apps appear in Claude Code automatically.[^191]

**Driver models supported.** Claude Code itself doing the work: yes. Software that runs on its own: no.

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | Claude Max subscription | 2 or 3[^16] |
| 2. Where it runs | Cloud routines (hourly at best),[^1] desktop scheduled tasks (every minute, Mac awake),[^51] Cowork tasks (hourly),[^52] or a session Michael opens | Inside the plan |
| 3. Memory | Files in the repository, or a database reached through a connector[^80][^81] | 0 to 1 |
| 4. Price data | Vendors with their own MCP server: Massive,[^87] Twelve Data,[^95] Alpha Vantage,[^99] EODHD,[^110] Intrinio,[^113] Alpaca.[^89] A connector answers when Claude asks. It does not push prices to Claude (my inference from how routines and sessions start[^48][^192]) | 0 to 3, by plan |
| 5. News and filings | Directory connectors such as MT Newswires, Aiera and Zacks Data,[^81] and SEC EDGAR read over the web[^135] | 0 upward, not researched |
| 6. Alternative data and web reading | Quiver's MCP server,[^142] Firecrawl's connector[^144] | 0 to 2 |
| 7. Seeing and approving | The Claude apps themselves | 0 |
| 8. Brokerage | See below | 0 to 1 |

Coverage of the universe preference depends on the price data candidate, as set out in 4.0.2. Nothing about option A narrows it, except that asking for thousands of symbols one request at a time through a connector is slow and uses plan limits (my inference).

**Brokerage and order execution candidates.** The fit here is brokers with an official MCP server.

- Can send an order through the connector: Tradier,[^158] tastytrade (with a one-time confirmation code),[^179] Public,[^184] Robinhood (approval off by default for outside agents),[^188] Alpaca (no cash account),[^172][^167] and TradeStation per trade press.[^176]
- Draft or confirm only: Interactive Brokers, where "Claude never submits orders directly to the market",[^147] and Webull, where an order must be confirmed in its app.[^146]
- No official server found: Schwab, E*TRADE, Fidelity.[^153][^162][^189] A community-built server would hold the sign-in to a real brokerage account, which is a risk in itself (my judgment). Anthropic's own directory warns: "Only use connectors from developers you trust."[^81]

**Account and regulatory rules that affect it.**

- The Consumer Terms passage on securities applies to this option in full, because every step runs on the subscription.[^35][^4]
- A cloud routine runs with no permission prompts and with every connector's write tools available by default.[^38] An order-capable broker connector inside a routine could place an order without asking.
- Settled cash is known only if Claude reads it from the broker each time and obeys it. Claude Code does offer hooks, fixed code that runs before a tool call and can block it, which could serve as a hard gate.[^193]
- Usage limits are one pool shared with all of Michael's other Claude use,[^41] and Anthropic says the limits assume "ordinary, individual usage".[^194]

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Path to placing trades in a cash account | 1 | Order-capable connectors exist, but the whole path runs on a subscription whose terms list relying on it to buy or sell securities as prohibited,[^4] which is this rubric's description of a 1. Settled cash also depends on a model following instructions. A written permission from Anthropic would raise this score to 3 |
| Fitness for intraday timing | 2 | Hourly without a person, or every minute only while the Mac is awake[^1][^51] |
| Flexibility | 2 | One driver model. No stream |
| Operability for a non-coder | 5 | Nothing to build or keep running |
| Safety and control | 3 | Interactive use has prompts and can have hooks.[^193] Routines have neither by default[^38] |
| Platform cost | 3 | 100 a month at the lower Max tier[^16] |
| Reversibility | 4 | Connectors swap without rewriting. The driver cannot change |
| **Weighted total** | **2.50** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 3 | Hourly in the cloud,[^1] every minute only on an awake Mac[^51] |
| Event, callback | 3 | A web request can start a routine, 30 an hour, each one a new session[^48] |
| Event, stream | 1 | Nothing in this option stays connected to a price feed |
| On demand | 5 | Its natural mode |
| Memory kept across runs | 3 | Possible through committed files or a database, but each session starts empty and local notes do not reach cloud runs[^80] |
| Each run independent | 5 | The default[^80] |

**Pros.**

- Nothing to build, host or repair.
- Fastest route to a working research assistant.
- Providers swap by changing a connector.
- A person is naturally in the loop when used on demand.
- Strong at reading unstructured material such as filings and news (my judgment).

**Cons.**

- Cannot run unattended more often than hourly.[^1]
- Cannot listen to live prices.
- Competes with Michael's own Claude use for one pool of limits whose size is not published.[^42][^41]
- The terms question sits on the whole option.[^4]
- Two of the official broker connectors will not send an order.[^147][^146]
- Handling of settled cash is only as reliable as the model's adherence to instructions.

**Failure mode.** It works well as a research assistant and stalls at the step from recommending to trading. The hourly floor is too slow for intraday decisions, the terms question stays unanswered, and the first time settled cash is misjudged in a live account the result is a good faith violation on a real brokerage record.

### Option B: Relii-style web app

**The architecture in plain English.** A website, a database and a set of timed jobs, with nothing that stays running in between. This is the shape of Relii: Next.js deployed on Vercel, with Supabase for the database, sign-in and file storage.[^195] Vercel hosts the pages Michael looks at and the small programs (functions) behind them. Supabase holds the data: prices fetched, signals, the settled cash ledger, a log of every decision. A timed job wakes a function every minute or so. The function asks a data provider for current prices, applies rules or asks Claude through the API, and saves the result. The dashboard shows recommendations with an approve button. Later the same function sends the approved order to the broker.

**Driver models supported.** Software that runs on its own: yes. Claude Code itself doing the work: not as the driver, though Claude can read the same database through the Supabase connector for questions on demand.[^81]

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | Claude API, or none | Depends on run frequency |
| 2. Where it runs | Vercel Pro (the free Hobby tier allows a timed job once a day, which rules it out for intraday),[^60] or Supabase's own scheduled jobs and functions[^64][^65] | 1 |
| 3. Memory | Supabase Postgres | 1[^15][^66] |
| 4. Price data | Any vendor that answers requests: Massive,[^17] Alpaca,[^13] Financial Modeling Prep,[^106] Twelve Data,[^93] or the broker's own data.[^14] Request limits matter when asking about many symbols every minute: for example 120 requests a minute at Tradier[^196] and 10,000 a minute on Alpaca's paid plan[^13] | 0 to 3 |
| 5. News and filings | SEC EDGAR,[^134] vendor news feeds[^138] | 0 to 2 |
| 6. Alternative data and web reading | Quiver's API,[^141] Firecrawl's API[^145] | 0 to 2 |
| 7. Seeing and approving | The dashboard on Vercel | Inside category 2 |
| 8. Brokerage | See below | 0 to 1 |

Universe coverage is as in 4.0.2. Asking for prices one request at a time puts the two Composites and the Russell 2000, thousands of symbols, up against the request limits above (my inference).

**Brokerage and order execution candidates.** The fit is brokers whose interface works by request and whose sign-in lasts: Tradier,[^154][^156] TradeStation,[^174] tastytrade,[^178] Public,[^183] Webull,[^181] and Alpaca (no cash account).[^167] Schwab and E*TRADE can fit only with a sign-in page that Michael visits weekly or daily (my inference from their sign-in cycles[^150][^161]). Interactive Brokers' main trading interface needs a desktop program kept signed in, which this option has nowhere to run.[^163]

**Account and regulatory rules that affect it.**

- Settled cash: kept as a ledger in the database and checked against the broker's own figure where the broker reports one.[^155][^160]
- Vercel's free tier is limited to non-commercial use, and whether trading one's own account counts is not answered on Vercel's page.[^63]
- Vercel runs functions in Washington DC unless told otherwise.[^197] This repo's `CLAUDE.md` places a Supabase database in Oregon and records what leaving the two apart cost Relii, so the function region would need pinning.
- If the function asks Claude for a recommendation, the Usage Policy's review requirement applies.[^6] The Commercial Terms govern API use.[^35]
- Software reads the prices with no person watching, so the non-display question applies.[^33]

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Path to placing trades in a cash account | 3 | Software can call a broker directly and keep a ledger, but with no connection held open it learns of fills only by asking again, and several brokers need a person to sign in on a cycle[^150][^161] |
| Fitness for intraday timing | 3 | A check every minute, no stream[^60][^2][^3] |
| Flexibility | 3 | One driver model, and stream mode is absent. Held at 3, not 2, because Claude can read the same database beside it |
| Operability for a non-coder | 4 | Code exists, but on fully managed services with no always-on part |
| Safety and control | 4 | Fixed code in the order path and a natural place for an approve button (my judgment) |
| Platform cost | 3 | 20 for Vercel Pro plus 10 to 25 for Supabase[^62][^15][^66] |
| Reversibility | 3 | His own code and data, portable with rewriting |
| **Weighted total** | **3.25** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 4 | Every minute on Vercel Pro,[^60] every second inside Supabase,[^64] each run short |
| Event, callback | 4 | A web request can wake a function at any time. A TradingView alert could be the caller, if the function answers within three seconds[^23] |
| Event, stream | 1 | Connections are cut at 300 to 800 seconds on Vercel[^61][^2] and 400 seconds on Supabase[^65] |
| On demand | 5 | Open the dashboard |
| Memory kept across runs | 5 | The database |
| Each run independent | 5 | Each function run starts fresh |

**Pros.**

- No server to keep alive.
- A dashboard and an approval step come naturally.
- Durable memory in a real database.
- Fixed code, not a language model, in the order path.
- Predictable platform cost.

**Cons.**

- Cannot hold a live stream, so it reacts on the next check, not on the price change.[^2][^3]
- Checking many symbols every minute runs into provider request limits.[^196]
- The free Vercel tier cannot do an intraday schedule.[^60]
- More code than option A.
- Two platforms whose regions must be kept aligned.[^197]

**Failure mode.** It turns out to need a stream after all. Intraday signals arrive between checks. To shrink the gap the checks get more frequent, then hit request limits and run-time limits, and an always-on piece gets bolted on. That is option D, reached in the wrong order and with a design not made for it.

### Option C: always-on worker

**The architecture in plain English.** One program that stays running through market hours on a small rented computer. It opens a stream to the price source and to the broker and keeps both open. It keeps the settled cash ledger. It applies fixed rules to every price change, sends Michael an alert, and later sends orders. Claude Code writes the program. Claude takes no part while it runs, unless the program is written to ask Claude through the API.

**Driver models supported.** Software that runs on its own: yes. Claude Code itself doing the work: no.

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | None, or Claude API | 0, or by run frequency |
| 2. Where it runs | A small always-on rented server,[^70][^71][^74][^73][^72] or a Cloudflare Durable Object[^68] | 1 |
| 3. Memory | A file or small database on the same machine (my inference), or Supabase[^15] | 0 to 1 |
| 4. Price data | Vendors with a stream: Massive (real time at 199),[^17][^86] Alpaca (all exchanges at 99, or 30 symbols from one exchange free),[^13] Databento at 199,[^90] Twelve Data from 229,[^94] Finnhub's free stream of 50 symbols,[^103] and broker streams such as TradeStation's[^198] | 0 to 3 |
| 5. News and filings | SEC EDGAR,[^134] vendor news streams[^136] | 0 to 2 |
| 6. Alternative data and web reading | Quiver's API,[^141] Firecrawl's API[^145] | 0 to 2 |
| 7. Seeing and approving | Nothing built in. Alerts and any approval step have to be written | 0 |
| 8. Brokerage | See below | 0 to 1 |

Universe coverage is as in 4.0.2. This is the option where a consolidated stream covering thousands of symbols is technically usable, at band 2 or 3 for the data.[^13][^17]

**Brokerage and order execution candidates.** The fit is the widest of any option, because the program can hold whatever connection the broker requires. Sign-in that does not expire: TradeStation,[^174] tastytrade.[^178] Personal token with no stated expiry: Tradier.[^156] Lapses after 15 idle days: Webull.[^181] Weekly human sign-in: Schwab (strength D)[^150] and Interactive Brokers, whose desktop gateway program could run on the same server.[^163][^164] Daily human sign-in: E*TRADE.[^161] No cash account: Alpaca.[^167]

**Account and regulatory rules that affect it.**

- Settled cash: ledger in the program, checked against the broker's figure where one is reported.[^155][^160]
- The non-display question applies most directly here, because a program consumes a live feed with no person watching.[^33][^34]
- If no language model runs, none of Anthropic's terms bear on the running system. If the program calls Claude, the Commercial Terms and the Usage Policy apply.[^35][^6]

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Path to placing trades in a cash account | 4 | Direct broker interface, live order status and its own ledger. Not 5 because a cash account, a settled cash figure and a lasting sign-in are confirmed together at only one broker, and that broker's token life is not stated[^155][^156] |
| Fitness for intraday timing | 5 | Holds a stream and reacts on each change. For a rented server this is my inference. For a Durable Object it is documented[^68] |
| Flexibility | 3 | One driver model. On demand is weak without an interface |
| Operability for a non-coder | 2 | A program he is responsible for keeping alive, silent by default |
| Safety and control | 3 | Fixed checks, but no approval surface unless one is built |
| Platform cost | 4 | 2.19 to 7 a month for the server[^70][^74] |
| Reversibility | 3 | His own code, portable with rewriting |
| **Weighted total** | **3.60** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 5 | Any interval (my inference for a rented server; one minute documented for Cloudflare[^67]) |
| Event, callback | 4 | A running server can receive web requests (my inference) |
| Event, stream | 5 | Its purpose |
| On demand | 3 | Nothing to ask unless an interface is built |
| Memory kept across runs | 5 | Local storage or a database |
| Each run independent | 4 | Possible by design, though a long-running program naturally carries state |

**Pros.**

- Reacts to price changes in seconds.
- Lowest platform cost.
- Fixed code only in the order path.
- Works with the widest set of brokers.
- Can run with no language model at all, which sets the Anthropic terms question aside for execution.

**Cons.**

- A server and a program are his to keep alive: restarts, reconnecting after a dropped stream, updates.
- Silent when it fails, unless alerting is built.
- No way to ask it a question without building an interface.
- Only one driver model.
- That a 2 to 7 dollar server holds a stream reliably all session is inferred, not measured.

**Failure mode.** It stops and nobody notices. The program crashes or the stream drops without an error in the middle of a session, possibly with a position open. Michael cannot diagnose a stopped program himself, and the first sign is a missed alert or an unexpected position at the close.


### Option D: hybrid (always-on worker plus Claude on top)

**The architecture in plain English.** Two layers that share one database.

- **The worker** is the program from option C. It stays running through market hours, listens to live prices, keeps the settled cash ledger, checks every order against fixed limits, and is the only part that talks to the broker.
- **Claude** is the research and explanation layer. On a schedule or when asked, Claude reads the database and the research connectors, then writes research notes, a watch list and settings back to the database. The worker acts only on what is in the database, and only inside its fixed limits.

An optional dashboard can sit on the same database. In this design Claude never holds a broker connection (a design choice, my judgment), so no order travels through a Claude subscription.

**Driver models supported.** Both. Claude Code itself does the research runs. Software that runs on its own does the watching and the order handling. This is a fact about the option, not a choice of driver: either layer can be made thicker or thinner later, down to option C at one end or close to option A at the other.

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | Claude Max subscription for the research layer, or the Claude API with a key. Max now includes a monthly API credit of 100 or 200 that covers API use[^45][^199] | 2 or 3 |
| 2. Where it runs | Worker: a small always-on server or a Cloudflare Durable Object.[^70][^68] Claude: routines, desktop tasks or on demand[^1][^51] | 1, plus the plan |
| 3. Memory | One shared Postgres database. Supabase is listed in Anthropic's connector directory, which is how Claude would reach it[^81][^15] | 1 |
| 4. Price data | A stream for the worker (as option C). An MCP server for Claude's research (as option A). Massive, Alpaca and Twelve Data offer both[^86][^87][^13][^89][^94][^95] | 0 to 3 |
| 5. News and filings | As options A and C[^134][^81] | 0 to 2 |
| 6. Alternative data and web reading | Quiver,[^142] Firecrawl[^144] | 0 to 2 |
| 7. Seeing and approving | The Claude apps, and optionally a dashboard | 0 to 1 |
| 8. Brokerage | As option C | 0 to 1 |

Universe coverage is as in 4.0.2, and as in option C the worker is where a wide consolidated stream becomes usable.

**Brokerage and order execution candidates.** The same as option C, because the worker is the same program: TradeStation,[^174] tastytrade,[^178] Tradier,[^156] Webull,[^181] Schwab with a weekly sign-in (strength D),[^150] Interactive Brokers with its gateway program,[^163] E*TRADE with a daily sign-in,[^161] and Alpaca, which has no cash account.[^167]

**Account and regulatory rules that affect it.**

- Settled cash is owned by the worker's ledger and checked against the broker's figure where one is reported.[^155][^160]
- The research layer still involves Claude in advice about securities. On a Max plan that is under the Consumer Terms passage quoted in 4.0.1.[^4] Run through an API key it is under the Commercial Terms, where no such passage was found.[^35][^5] The Usage Policy applies either way.[^6]
- A routine includes every connector with write access unless it is removed.[^38] In this design the research routine needs no broker connector at all, so there is nothing order-capable to remove (my judgment).
- The worker reads a live feed with no person watching, so the non-display question applies.[^33]

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Path to placing trades in a cash account | 4 | Same as option C. The order path is fixed code and does not pass through a Claude subscription |
| Fitness for intraday timing | 5 | Same as option C[^68] |
| Flexibility | 5 | Both driver models, and every run mode at 4 or above |
| Operability for a non-coder | 2 | The most parts of any option. Claude can at least be asked what the worker is doing (my judgment), which softens option C's silence but does not remove the upkeep |
| Safety and control | 4 | Fixed checks in the worker, a person and a model reviewing above it, and no order-capable connector in Claude's hands |
| Platform cost | 2 | The plan at 100 or 200,[^16] the database at 10 to 25,[^15][^66] the server at 2.19 to 7[^70][^74] |
| Reversibility | 4 | Each half can be replaced without touching the other (my judgment) |
| **Weighted total** | **3.85** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 5 | The worker at any interval. Claude hourly in the cloud[^1] |
| Event, callback | 5 | The worker can receive a callback, and can itself start a Claude routine with a web request when something needs research[^48] |
| Event, stream | 5 | The worker[^68] |
| On demand | 5 | Ask Claude, which reads the shared database |
| Memory kept across runs | 5 | The shared database |
| Each run independent | 4 | Claude's runs start empty by default.[^80] The worker naturally carries state |

**Pros.**

- The only option that supports both driver models.
- The only option at 4 or above on every run mode.
- No language model in the order path.
- Can be built in stages. The research layer is useful before the worker exists (my judgment).
- Gives a non-coder a way to ask a running system what it is doing.
- Either half can be replaced.

**Cons.**

- The most moving parts: a worker, a database, Claude, and connectors.
- The highest platform cost, band 3 when the plan is counted.
- Still carries option C's server upkeep.
- Two layers can disagree, and someone has to decide which is right.
- The terms question still applies to the research layer.[^4]
- Needs discipline about which layer owns what.

**Failure mode.** The seams. The worker can fail exactly as in option C. On top of that the two layers drift: Claude writes a setting the worker reads differently, or the worker's ledger and Claude's summary disagree, and Michael cannot tell which is right. The most likely disappointment is quieter. The research layer gets built, proves useful, the worker looks like too much to own, and option D settles into option A without anyone deciding that.

### Option E: hosted algorithm platform

**The architecture in plain English.** Rent the whole machine room. QuantConnect runs strategy code on its own servers, feeds it real-time market data there, and connects it to a broker.[^200][^77] Claude Code writes the strategy and operates the platform through QuantConnect's official MCP server, which can create projects, run backtests and deploy live strategies.[^201] A backtest runs a strategy against past data to see what it would have done.

**Driver models supported.** Software that runs on its own: yes, hosted by the platform. Claude Code itself doing the work: not at run time. Claude Code is the author and operator.[^201]

**Categories it needs.**

| Category | Candidates that fit this option | Band |
| :-- | :-- | :-- |
| 1. Reasoning model | None at run time. Claude for writing the strategy | 0 at run time |
| 2. Where it runs | QuantConnect. Researcher tier 84 a month, published. One live trading node per live strategy, price gated and unverified. The free tier has no live trading[^78][^200][^79] | 2 at least |
| 3. Memory | Not verified | Not verified |
| 4. Price data | Included with the platform. Minute data on the free tier, second and tick data on the Researcher tier.[^202] Whether it is consolidated was not verified | Inside category 2 |
| 5 and 6. News, filings, alternative data | Offered as paid add-ons[^79] | Not priced on the public page |
| 7. Seeing and approving | QuantConnect's own website and alerts[^79] | Inside category 2 |
| 8. Brokerage | See below | 0 to 1 |

Universe coverage was not verified for this option. QuantConnect's data coverage statements were not captured.

**Brokerage and order execution candidates.** QuantConnect's documentation lists these for live trading in U.S. stocks: Interactive Brokers, TradeStation, tastytrade, Public, Alpaca, Charles Schwab and Tradier.[^203] How the platform handles a broker that wants a person to sign in every week was not verified.

**Account and regulatory rules that affect it.**

- QuantConnect models cash accounts separately from margin accounts and has settlement models. The exact delay it applies to U.S. stocks in a cash account was not stated on the pages read.[^204]
- Broker sign-in goes through a third party's servers (my inference from the hosted design[^77]).
- Anthropic's terms bear only on the writing of the strategy, not on its running, since no language model runs it.

**Scores against the criteria.**

| Criterion | Score | Basis |
| :-- | :-- | :-- |
| Path to placing trades in a cash account | 4 | Purpose-built broker links and a cash account model.[^203][^204] Not 5 because the settlement delay and the sign-in handling are unverified |
| Fitness for intraday timing | 4 | Real-time data arrives on its servers.[^77] Not 5 because uptime and reaction time were not verified |
| Flexibility | 2 | One driver model, and both on demand and callback are weak |
| Operability for a non-coder | 3 | Code hosted by a platform that keeps it running[^77] |
| Safety and control | 3 | Backtesting before live use is a real safeguard.[^201] Broker access is shared with one outside party |
| Platform cost | 2 | 84 plus a node of unknown price[^78] |
| Reversibility | 2 | The strategy is written for one vendor's system (my judgment) |
| **Weighted total** | **3.15** | |

**Run modes and memory modes.**

| Mode | Score | Basis |
| :-- | :-- | :-- |
| On a schedule | 4 | The strategy stays deployed.[^77] The schedule detail inside a strategy was not verified |
| Event, callback | 2 | Not verified |
| Event, stream | 4 | Real-time data on its servers[^77] |
| On demand | 2 | It runs a coded strategy. It is not something to put a question to |
| Memory kept across runs | 2 | Not verified |
| Each run independent | 3 | Not verified |

**Pros.**

- No server of his own.
- Data, scheduling and broker links in one product.
- Backtesting before any money is at risk.
- Supports the widest named list of brokers, including Schwab and Tradier.[^203]
- Models a cash account.[^204]
- An official MCP server for Claude Code.[^201]

**Cons.**

- At least 84 a month, with the live node price unknown until signup.[^78][^79]
- Logic written for one vendor's system.
- Built to run coded strategies, not to research and recommend.
- The hosted version of its MCP server needs a paid agent node.[^201]
- Several details unverified: settlement delay, memory, data consolidation.
- Broker access shared with a third party.

**Failure mode.** The wrong shape for today's job. The agent is meant, today, to research and recommend. This platform's central strength is running a coded rule automatically. Michael pays band 2 or 3 for that strength before he needs it, while the actual research still happens in Claude, outside the platform.

## 5. Comparison across all options

| | A: Claude in the chair | B: Relii-style web app | C: always-on worker | D: hybrid | E: hosted platform |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Driver: Claude Code itself | Yes | No (can read beside it) | No | Yes | No (author and operator) |
| Driver: software on its own | No | Yes | Yes | Yes | Yes |
| Path to trades in a cash account (25) | 1 | 3 | 4 | 4 | 4 |
| Intraday fitness (20) | 2 | 3 | 5 | 5 | 4 |
| Flexibility (15) | 2 | 3 | 3 | 5 | 2 |
| Operability for a non-coder (15) | 5 | 4 | 2 | 2 | 3 |
| Safety and control (10) | 3 | 4 | 3 | 4 | 3 |
| Platform cost (10) | 3 | 3 | 4 | 2 | 2 |
| Reversibility (5) | 4 | 3 | 3 | 4 | 2 |
| **Weighted total out of 5** | **2.50** | **3.25** | **3.60** | **3.85** | **3.15** |
| Run mode: schedule | 3 | 4 | 5 | 5 | 4 |
| Run mode: event, callback | 3 | 4 | 4 | 5 | 2 |
| Run mode: event, stream | 1 | 1 | 5 | 5 | 4 |
| Run mode: on demand | 5 | 5 | 3 | 5 | 2 |
| Memory kept across runs | 3 | 5 | 5 | 5 | 2 |
| Each run independent | 5 | 5 | 4 | 4 | 3 |
| Platform cost band (model, hosting, storage) | 2 or 3 | 2 | 1 | 3 | 2 at least |
| Price data band | 0 to 3 | 0 to 3 | 0 to 3 | 0 to 3 | Included |
| Brokerage band | 0 to 1 | 0 to 1 | 0 to 1 | 0 to 1 | 0 to 1 |
| Language model in the order path | Yes | Optional | Optional | No | No |
| Anthropic Consumer Terms passage applies to | The whole option | Nothing, if the API is used | Nothing, if the API or no model is used | The research layer, if run on the plan | Writing the strategy only |
| Failure mode in one line | Stalls between recommending and trading | Turns out to need a stream | Stops and nobody notices | The seams between two layers | Wrong shape for today's job |

**How sensitive the ranking is to the weights.** Two checks, both arithmetic on the scores above.

- With all seven criteria weighted equally, the order is D 3.71, C 3.43, B 3.29, then A and E at 2.86. D stays first.
- With operability raised to 35 and intraday fitness cut to 10 (path 20, flexibility 10, safety 10, cost 10, reversibility 5), the order is B 3.45, D 3.30, A and C at 3.15, then E at 3.05. **B comes first.** The pick depends on intraday fitness mattering more than ease of upkeep.

## 6. Falsifiability: what would overturn the pick

Option D is the strongest pick only while the following hold. Each item names specific evidence and what the pick becomes if that evidence appears.

1. **The driver question is still open, or the answer is "both".** If Michael decides the agent will be software only, the flexibility score no longer favors D (it drops from 5 to 3, and D's total to 3.55), and **option C at 3.60 becomes the pick.** If he decides Claude Code alone will be the driver, option A is the only one that fits.
2. **A live stream is actually needed.** Evidence that would say otherwise: a month of practice signals, logged with the price at the moment of the signal and the price at the next whole minute, showing no material difference. Then the always-on worker has no job, and **option B becomes the pick**, with Claude reading its database.
3. **A non-coder can keep a worker alive.** Evidence against: a two week trial of a do-nothing worker on a small server that holds a price stream through every session, counting stops and dropped connections. More than one unnoticed stop a week, or any repair Michael could not carry out with Claude Code's help in an evening, means the operability score of 2 was generous. **The pick becomes B, or E if item 6 also holds.** This trial is also what would turn the "holds a stream all session" inference into a measurement.
4. **Anthropic's terms allow the research layer.** If Anthropic states in writing that using Claude to research securities for one's own account is not permitted even on the API, or that the reviewing "qualified person" cannot be the account owner, the Claude layer goes and **the pick becomes C.** If it states that such use is not permitted on a Max plan but is on the API, D stands with the research layer moved to an API key.
5. **Market data for a program is affordable.** If the chosen data vendor or exchange confirms that a personal program reading prices is "non-display use" and prices it in band 4, every option in which software reads prices (B, C, D and E) is hit, and **the pick becomes A**, where a person reads the output.
6. **The hosted platform stays dearer or less certain.** If QuantConnect's live trading node proves to be band 1, its cash account model is confirmed to apply the one business day settlement delay, and it keeps a broker sign-in alive without a person, option E's path score rises to 5 and its cost score to 3, for a total of 3.50. That alone does not pass D. Combined with a failed trial under item 3, **the pick becomes E.**
7. **At least one broker meets all three order-path needs.** The scores for C and D assume a broker offering a cash account through its interface, a settled cash figure, and a sign-in that lasts at least a week. Today that is confirmed on vendor pages for one broker only, with its token life unstated.[^155][^156] If no broker confirms all three, the path score for C and D falls to 3 and D's total to 3.60. D would still lead, but by less.

What would not overturn it: a lower price from any single data vendor, or a new connector appearing in Anthropic's directory. Those change which candidates fit, not which architecture. Nor would a written permission from Anthropic for option A by itself: that would raise option A's path score from 1 to 3 and its total from 2.50 to 3.00, still below options B, C and D.

## 7. Open questions the research could not settle

**For Michael to decide.**

1. **How fast must it react?** Seconds, a minute, or an hour. This one answer decides whether a stream is needed, and so decides between B and C or D.
2. **How wide is the live watch list?** Thousands of symbols (the two Composites and the Russell 2000) or a short list. This decides the price data band, since free streams carry 30 to 50 symbols.[^13][^103]
3. **Is the cash account requirement firm?** One otherwise well-fitting broker candidate has no cash account.[^167]
4. **Will every order need his approval, or may the agent act alone inside fixed limits?** This decides how much of category 7 has to be built.
5. **Is a person signing in weekly acceptable?** That is the reported cycle at Schwab.[^150]
6. **Is band 2 or band 3 acceptable for price data?** That is where consolidated real-time data from a data vendor sits.[^13][^17]
7. **Were "LiquidTrade" and "Co-Invest" named as examples of connector-style tools?** They trade contracts that track stock prices, not shares.[^20] If real shares in a brokerage account are the requirement, they are out of scope.

**For someone else to answer.**

8. **Anthropic, in writing:** may a Max plan be used to research securities and to place orders for the subscriber's own account, given the Consumer Terms passage?[^4] Does the Usage Policy's "qualified person" include the account owner?[^6] Does the answer differ on the API?[^5]
9. **The chosen data vendor:** is a personal program reading prices "display" or "non-display" use, and at what price?[^33][^34]
10. **Schwab:** how long does the sign-in for its personal trading interface last, and does that interface report settled and unsettled cash?[^151][^149] Both rest on community sources today.

**Not verified in this run, and worth a short follow-up before any choice of provider.**

- Whether a cash account is supported through the interface at TradeStation, tastytrade, Webull, Public and Interactive Brokers, and whether Robinhood's separate agent account is cash or margin.[^187]
- Whether Tradier's personal token ever expires.[^156]
- QuantConnect's live trading node price and the settlement delay in its cash account model.[^79][^204]
- Whether a downloadable daily holdings file exists for the Nasdaq 100 fund,[^127] and the current rules for the NYSE Composite.[^133]
- Which brokers still apply the old pattern day trader rule during the phase-in.[^30] This matters only if a margin account is ever used.
- How large Max plan limits are in practice. Anthropic publishes no numbers.[^42]

## 8. Sources

Every source below was accessed on 2026-10-08. Strength labels and price labels are defined in section 3. The register ID at the end of each entry points to the fuller note, with a quote, in the named file.

[^1]: "Automate work with routines". https://code.claude.com/docs/en/routines . Accessed 2026-10-08. Strength A. Register ID RT-19 in `runs/run-1-notes-runtime-platform.md`.
[^2]: "Do Vercel Functions support WebSocket connections?" (Vercel knowledge base). https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections . Accessed 2026-10-08. Strength A. Register ID RT-48 in `runs/run-1-notes-runtime-platform.md`.
[^3]: "Handling WebSockets" (Supabase docs). https://supabase.com/docs/guides/functions/websockets.md . Accessed 2026-10-08. Strength A. Register ID RT-54 in `runs/run-1-notes-runtime-platform.md`.
[^4]: "Consumer Terms of Service" (Anthropic, effective October 8, 2025). https://www.anthropic.com/legal/consumer-terms . Accessed 2026-10-08. Strength A. Register ID T23 in `runs/run-1-trajectory.md`.
[^5]: "Commercial Terms of Service" (Anthropic, effective June 17, 2025). https://www.anthropic.com/legal/commercial-terms . Accessed 2026-10-08. Strength A. Register ID T24 in `runs/run-1-trajectory.md`.
[^6]: "Usage Policy" (Anthropic, version effective November 12, 2026). https://www.anthropic.com/legal/aup . Accessed 2026-10-08. Strength A. Register ID T25 in `runs/run-1-trajectory.md`.
[^7]: "SEC Finalizes Rules to Reduce Risks in Clearance and Settlement" (SEC press release 2023-29). https://www.sec.gov/newsroom/press-releases/2023-29 . Accessed 2026-10-08. Strength A. Register ID BR-01 in `runs/run-1-notes-brokers-regulation.md`.
[^8]: "Trading in Cash Accounts: Avoid These Violations" (Charles Schwab, December 17, 2024). https://www.schwab.com/learn/story/avoid-these-violations-when-trading-cash . Accessed 2026-10-08. Strength A. Register ID T33 in `runs/run-1-trajectory.md`.
[^9]: "Regulatory Notice 26-10: FINRA Adopts New Intraday Margin Standards to Replace the Day Trading Margin Requirements" (FINRA). https://www.finra.org/rules-guidance/notices/26-10 . Accessed 2026-10-08. Strength A. Register ID T22 in `runs/run-1-trajectory.md`.
[^10]: "Current Day Trading Margin Requirements of Rule 4210". https://www.sec.gov/files/rules/sro/finra/2026/34-105226.pdf . Accessed 2026-10-08. Strength A. Register ID BR-07 in `runs/run-1-notes-brokers-regulation.md`.
[^11]: "Historical Stock Data" (vendor docs). https://docs.alpaca.markets/docs/historical-stock-data-1 . Accessed 2026-10-08. Strength A. Register ID MD-11 in `runs/run-1-notes-market-data.md`.
[^12]: "US Equities Market Data" (vendor help centre). https://support.twelvedata.com/en/articles/9935903-us-equities-market-data . Accessed 2026-10-08. Strength A. Price label: gated and unverified (consolidated feed is priced through sales). Register ID MD-24 in `runs/run-1-notes-market-data.md`.
[^13]: "About Market Data API" (Alpaca docs). https://docs.alpaca.markets/docs/about-market-data-api . Accessed 2026-10-08. Strength A. Price label: published. Register ID T28 in `runs/run-1-trajectory.md`.
[^14]: "Market Data" (Tradier docs). https://docs.tradier.com/docs/market-data . Accessed 2026-10-08. Strength A. Register ID BR-39 in `runs/run-1-notes-brokers-regulation.md`.
[^15]: "Manage Compute usage" (Supabase docs). https://supabase.com/docs/guides/platform/manage-your-usage/compute.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-51 in `runs/run-1-notes-runtime-platform.md`.
[^16]: "What is the Max plan?" (Claude Help Center, "Updated yesterday"). https://support.claude.com/en/articles/11049741-what-is-the-max-plan . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-14 in `runs/run-1-notes-runtime-platform.md`.
[^17]: "Pricing" (Massive, formerly Polygon.io), rendered in a browser. https://massive.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T27 in `runs/run-1-trajectory.md`.
[^18]: "AI Trading in ChatGPT, Claude, Grok, and Meta Muse, Liquid Co-Invest" (Liquid). https://www.liquid.trade/coinvest . Accessed 2026-10-08. Strength A. Price label: published. Register ID T5 in `runs/run-1-trajectory.md`.
[^19]: "Terms of Service" (Liquid, last updated September 17, 2026). https://www.liquid.trade/termsofservice . Accessed 2026-10-08. Strength A. Register ID T7 in `runs/run-1-trajectory.md`.
[^20]: "Co-Invest docs" (Liquid). https://www.liquid.trade/coinvest-docs . Accessed 2026-10-08. Strength A. Register ID T9 in `runs/run-1-trajectory.md`.
[^21]: "Liquid Launches Co-Invest" (Traders Magazine, republished vendor press release, May 26, 2026). https://www.tradersmagazine.com/news/liquid-launches-co-invest/ . Accessed 2026-10-08. Strength B. Register ID T6 in `runs/run-1-trajectory.md`.
[^22]: "Trading Period" (Composer Knowledge Center). https://help.composer.trade/article/63-trading-period . Accessed 2026-10-08. Strength A. Register ID RT-80 in `runs/run-1-notes-runtime-platform.md`.
[^23]: "How to configure webhook alerts" (TradingView support). https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/ . Accessed 2026-10-08. Strength A. Register ID RT-82 in `runs/run-1-notes-runtime-platform.md`.
[^24]: "Top Brokers" (TradingView). https://www.tradingview.com/brokers/ . Accessed 2026-10-08. Strength A. Register ID RT-84 in `runs/run-1-notes-runtime-platform.md`.
[^25]: "Frequent Intraday Trading: Understanding the Basics" (FINRA, page dated June 04, 2026). https://www.finra.org/investors/investing/investment-products/stocks/day-trading . Accessed 2026-10-08. Strength A. Register ID BR-02 in `runs/run-1-notes-brokers-regulation.md`.
[^26]: "§ 220.8 Cash account.". https://www.govinfo.gov/content/pkg/CFR-2025-title12-vol3/xml/CFR-2025-title12-vol3-sec220-8.xml . Accessed 2026-10-08. Strength A. Register ID BR-09 in `runs/run-1-notes-brokers-regulation.md`.
[^27]: "Avoiding Cash Account Trading Violations - Fidelity". https://www.fidelity.com/learning-center/trading-investing/trading/avoiding-cash-trading-violations . Accessed 2026-10-08. Strength A. Register ID BR-10 in `runs/run-1-notes-brokers-regulation.md`.
[^28]: "Avoiding Cash Account Trading Violations - Fidelity". https://www.fidelity.com/learning-center/trading-investing/trading/avoiding-cash-trading-violations . Accessed 2026-10-08. Strength A. Register ID BR-69 in `runs/run-1-notes-brokers-regulation.md`.
[^29]: "Notice of Filing of a Proposed Rule Change, as Modified by Amendment No. 1, to Amend FINRA Rule 4210 (Margin Requirements) to Replace the Day Trading Margin Provisions with Intraday Margin Standards". https://www.sec.gov/files/rules/sro/finra/2026/34-105226.pdf . Accessed 2026-10-08. Strength A. Register ID BR-03 in `runs/run-1-notes-brokers-regulation.md`.
[^30]: "Regulatory Notice 26-10" (FINRA). https://www.finra.org/rules-guidance/notices/26-10 . Accessed 2026-10-08. Strength A. Register ID BR-04 in `runs/run-1-notes-brokers-regulation.md`.
[^31]: "Frequent Intraday Trading: Understanding the Basics" (FINRA). https://www.finra.org/investors/investing/investment-products/stocks/day-trading . Accessed 2026-10-08. Strength A. Register ID BR-08 in `runs/run-1-notes-brokers-regulation.md`.
[^32]: "Nonprofessional Subscriber Policy" (PDF, file dated April 6, 2017; text extracted locally from the fetched file). https://www.nyse.com/publicdocs/nyse/data/Policy-Non-ProfessionalSubscribers_PDP.pdf . Accessed 2026-10-08. Strength A. Register ID BR-70 in `runs/run-1-notes-brokers-regulation.md`.
[^33]: "NYSE Market Data Policy Package". https://nyse.com/publicdocs/nyse/data/NYSE_Market_Data_Complete_Policy_Package.pdf . Accessed 2026-10-08. Strength A. Register ID BR-71 in `runs/run-1-notes-brokers-regulation.md`.
[^34]: "Market Data Terms of Service". https://massive.com/legal/market-data-terms-of-service . Accessed 2026-10-08. Strength A. Register ID MD-15 in `runs/run-1-notes-market-data.md`.
[^35]: "Legal and compliance" (Claude Code docs). https://code.claude.com/docs/en/legal-and-compliance.md . Accessed 2026-10-08. Strength A. Register ID RT-01 in `runs/run-1-notes-runtime-platform.md`.
[^36]: "Consumer Terms of Service" (Effective October 8, 2025). https://www.anthropic.com/legal/consumer-terms . Accessed 2026-10-08. Strength A. Register ID RT-33 in `runs/run-1-notes-runtime-platform.md`.
[^37]: "Usage Policy" (Anthropic), version in force and version effective November 12, 2026. https://www.anthropic.com/legal/aup . Accessed 2026-10-08. Strength A. Register ID RT-35 in `runs/run-1-notes-runtime-platform.md`.
[^38]: "Automate work with routines". https://code.claude.com/docs/en/routines . Accessed 2026-10-08. Strength A. Register ID RT-21 in `runs/run-1-notes-runtime-platform.md`.
[^39]: "Use Claude Cowork safely" ("Updated this week"). https://support.claude.com/en/articles/13364135-use-claude-cowork-safely . Accessed 2026-10-08. Strength A. Register ID RT-44 in `runs/run-1-notes-runtime-platform.md`.
[^40]: "Claude in Chrome permissions guide". https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide . Accessed 2026-10-08. Strength A. Register ID RT-43 in `runs/run-1-notes-runtime-platform.md`.
[^41]: "Use Claude Code with your Pro or Max plan". https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan . Accessed 2026-10-08. Strength A. Register ID RT-16 in `runs/run-1-notes-runtime-platform.md`.
[^42]: "What is the Max plan?". https://support.claude.com/en/articles/11049741-what-is-the-max-plan . Accessed 2026-10-08. Strength A. Register ID RT-15 in `runs/run-1-notes-runtime-platform.md`.
[^43]: "Pricing" (Claude). https://claude.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-36 in `runs/run-1-notes-runtime-platform.md`.
[^44]: "Pricing" (Claude Platform docs). https://platform.claude.com/docs/en/about-claude/pricing.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-38 in `runs/run-1-notes-runtime-platform.md`.
[^45]: "Monthly API credits for Max and Team plans" (Claude Help Center). https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-12 in `runs/run-1-notes-runtime-platform.md`.
[^46]: "Pricing" (Claude). https://claude.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-37 in `runs/run-1-notes-runtime-platform.md`.
[^47]: "Scheduled deployments" (Claude Platform docs, status beta). https://platform.claude.com/docs/en/managed-agents/scheduled-deployments.md . Accessed 2026-10-08. Strength A. Register ID RT-39 in `runs/run-1-notes-runtime-platform.md`.
[^48]: "Automate work with routines". https://code.claude.com/docs/en/routines . Accessed 2026-10-08. Strength A. Register ID RT-20 in `runs/run-1-notes-runtime-platform.md`.
[^49]: "Use Claude Code in the cloud". https://code.claude.com/docs/en/claude-code-on-the-web.md . Accessed 2026-10-08. Strength A. Register ID RT-23 in `runs/run-1-notes-runtime-platform.md`.
[^50]: "Schedule recurring tasks in Claude Code Desktop". https://code.claude.com/docs/en/desktop-scheduled-tasks.md . Accessed 2026-10-08. Strength A. Register ID RT-24 in `runs/run-1-notes-runtime-platform.md`.
[^51]: "Schedule recurring tasks in Claude Code Desktop". https://code.claude.com/docs/en/desktop-scheduled-tasks.md . Accessed 2026-10-08. Strength A. Register ID RT-25 in `runs/run-1-notes-runtime-platform.md`.
[^52]: "Schedule recurring tasks in Claude Cowork" (Claude Help Center, "Updated this week"). https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork . Accessed 2026-10-08. Strength A. Register ID RT-27 in `runs/run-1-notes-runtime-platform.md`.
[^53]: "Run Claude Code programmatically". https://code.claude.com/docs/en/headless.md . Accessed 2026-10-08. Strength A. Register ID RT-05 in `runs/run-1-notes-runtime-platform.md`.
[^54]: "Run Claude Code programmatically". https://code.claude.com/docs/en/headless.md . Accessed 2026-10-08. Strength A. Register ID RT-07 in `runs/run-1-notes-runtime-platform.md`.
[^55]: "Run Claude Code programmatically". https://code.claude.com/docs/en/headless.md . Accessed 2026-10-08. Strength A. Register ID RT-09 in `runs/run-1-notes-runtime-platform.md`.
[^56]: "Use the Claude Agent SDK with your Claude plan" (Claude Help Center, "Updated yesterday"). https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan . Accessed 2026-10-08. Strength A. Register ID RT-11 in `runs/run-1-notes-runtime-platform.md`.
[^57]: "Events that trigger workflows". https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows . Accessed 2026-10-08. Strength A. Register ID RT-57 in `runs/run-1-notes-runtime-platform.md`.
[^58]: "Actions limits" (GitHub Docs). https://docs.github.com/en/actions/reference/limits . Accessed 2026-10-08. Strength A. Register ID RT-60 in `runs/run-1-notes-runtime-platform.md`.
[^59]: "GitHub Actions billing" (GitHub Docs). https://docs.github.com/en/billing/concepts/product-billing/github-actions . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-59 in `runs/run-1-notes-runtime-platform.md`.
[^60]: "Usage & Pricing for Cron Jobs" (Vercel docs). https://vercel.com/docs/cron-jobs/usage-and-pricing.md . Accessed 2026-10-08. Strength A. Register ID RT-45 in `runs/run-1-notes-runtime-platform.md`.
[^61]: "Vercel Functions Limits" (Vercel docs). https://vercel.com/docs/functions/limitations.md . Accessed 2026-10-08. Strength A. Register ID RT-46 in `runs/run-1-notes-runtime-platform.md`.
[^62]: "Vercel Hobby Plan". https://vercel.com/docs/plans/hobby.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-50 in `runs/run-1-notes-runtime-platform.md`.
[^63]: "Fair use Guidelines". https://vercel.com/docs/limits/fair-use-guidelines.md . Accessed 2026-10-08. Strength A. Register ID RT-47 in `runs/run-1-notes-runtime-platform.md`.
[^64]: "Cron" (Supabase docs). https://supabase.com/docs/guides/cron.md . Accessed 2026-10-08. Strength A. Register ID RT-55 in `runs/run-1-notes-runtime-platform.md`.
[^65]: "Limits" (Supabase Edge Functions docs). https://supabase.com/docs/guides/functions/limits.md . Accessed 2026-10-08. Strength A. Register ID RT-53 in `runs/run-1-notes-runtime-platform.md`.
[^66]: "Compute and Disk" (Supabase docs). https://supabase.com/docs/guides/platform/compute-and-disk.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-52 in `runs/run-1-notes-runtime-platform.md`.
[^67]: "Limits". https://developers.cloudflare.com/workers/platform/limits/index.md . Accessed 2026-10-08. Strength A. Register ID RT-62 in `runs/run-1-notes-runtime-platform.md`.
[^68]: "Use WebSockets". https://developers.cloudflare.com/durable-objects/best-practices/websockets/index.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-63 in `runs/run-1-notes-runtime-platform.md`.
[^69]: "Pricing" (Cloudflare Workers docs). https://developers.cloudflare.com/workers/platform/pricing/index.md . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-61 in `runs/run-1-notes-runtime-platform.md`.
[^70]: "Fly.io Resource Pricing" (Fly.io docs). https://fly.io/docs/about/pricing/ . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-64 in `runs/run-1-notes-runtime-platform.md`.
[^71]: "Droplet Pricing" (DigitalOcean). https://www.digitalocean.com/pricing/droplets . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-65 in `runs/run-1-notes-runtime-platform.md`.
[^72]: "Amazon Lightsail pricing". https://aws.amazon.com/lightsail/pricing/ . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-68 in `runs/run-1-notes-runtime-platform.md`.
[^73]: "Pricing Plans" (Railway docs). https://docs.railway.com/reference/pricing/plans . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-67 in `runs/run-1-notes-runtime-platform.md`.
[^74]: "Deploy for Free". https://render.com/docs/free . Accessed 2026-10-08. Strength A. Price label: published. Register ID RT-66 in `runs/run-1-notes-runtime-platform.md`.
[^75]: "Cloud" (Hetzner). https://www.hetzner.com/cloud . Accessed 2026-10-08. Strength A. Price label: gated and unverified (prices did not render). Register ID RT-69 in `runs/run-1-notes-runtime-platform.md`.
[^76]: "Scheduling Timed Jobs" (Apple Developer, documentation archive). https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html . Accessed 2026-10-08. Strength A. Register ID RT-70 in `runs/run-1-notes-runtime-platform.md`.
[^77]: "Deployment" (QuantConnect docs, live trading). https://www.quantconnect.com/docs/v2/cloud-platform/live-trading/deployment . Accessed 2026-10-08. Strength A. Register ID RT-88 in `runs/run-1-notes-runtime-platform.md`.
[^78]: "QuantConnect Pricing" (markdown version). https://www.quantconnect.com/pricing.md . Accessed 2026-10-08. Strength A. Price label: published for tier prices; the live trading node price is gated and unverified. Register ID RT-72 in `runs/run-1-notes-runtime-platform.md`.
[^79]: "Pricing" (QuantConnect), rendered in a browser. https://www.quantconnect.com/pricing . Accessed 2026-10-08. Strength A. Price label: gated and unverified (the live trading node price is not on the public page). Register ID T26 in `runs/run-1-trajectory.md`.
[^80]: "How Claude remembers your project". https://code.claude.com/docs/en/memory.md . Accessed 2026-10-08. Strength A. Register ID RT-31 in `runs/run-1-notes-runtime-platform.md`.
[^81]: "Connectors and plugins" (Claude Marketplace, Anthropic), full list of 927 read. https://claude.com/marketplace/connectors-plugins . Accessed 2026-10-08. Strength A. Register ID T17 in `runs/run-1-trajectory.md`.
[^82]: "Memory tool" (Claude Platform docs). https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool.md . Accessed 2026-10-08. Strength A. Register ID RT-41 in `runs/run-1-notes-runtime-platform.md`.
[^83]: "Memory stores" (Claude Platform docs, status beta). https://platform.claude.com/docs/en/managed-agents/memory.md . Accessed 2026-10-08. Strength A. Register ID RT-40 in `runs/run-1-notes-runtime-platform.md`.
[^84]: "Polygon.io is Now Massive" (vendor blog). https://massive.com/blog/polygon-is-now-massive . Accessed 2026-10-08. Strength A. Register ID MD-01 in `runs/run-1-notes-market-data.md`.
[^85]: "Stocks". https://massive.com/stocks . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-04 in `runs/run-1-notes-market-data.md`.
[^86]: "Pricing". https://massive.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-07 in `runs/run-1-notes-market-data.md`.
[^87]: "massive-com/mcp_massive". https://github.com/massive-com/mcp_massive . Accessed 2026-10-08. Strength A. Register ID MD-09 in `runs/run-1-notes-market-data.md`.
[^88]: "Market Data Terms of Service" (last updated August 28, 2025, per the page). https://massive.com/legal/market-data-terms-of-service . Accessed 2026-10-08. Strength A. Register ID MD-08 in `runs/run-1-notes-market-data.md`.
[^89]: "alpacahq/alpaca-mcp-server". https://github.com/alpacahq/alpaca-mcp-server . Accessed 2026-10-08. Strength A. Register ID MD-14 in `runs/run-1-notes-market-data.md`.
[^90]: "US Equities". https://databento.com/catalog/us-equities . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-18 in `runs/run-1-notes-market-data.md`.
[^91]: "Databento US Equities Mini now available" (vendor blog, dated February 1, 2025). https://databento.com/blog/databento-us-equities-mini-now-available . Accessed 2026-10-08. Strength A. Register ID MD-20 in `runs/run-1-notes-market-data.md`.
[^92]: Databento GitHub organisation page (list of public repositories). https://github.com/databento . Accessed 2026-10-08. Strength A. Register ID MD-22 in `runs/run-1-notes-market-data.md`.
[^93]: "Pricing". https://twelvedata.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-23 in `runs/run-1-notes-market-data.md`.
[^94]: "Pricing". https://twelvedata.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-25 in `runs/run-1-notes-market-data.md`.
[^95]: "twelvedata/mcp". https://github.com/twelvedata/mcp . Accessed 2026-10-08. Strength A. Register ID MD-27 in `runs/run-1-notes-market-data.md`.
[^96]: "Premium API Key". https://www.alphavantage.co/premium/ . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-28 in `runs/run-1-notes-market-data.md`.
[^97]: "Premium API Key". https://www.alphavantage.co/premium/ . Accessed 2026-10-08. Strength A. Register ID MD-29 in `runs/run-1-notes-market-data.md`.
[^98]: "API Documentation". https://www.alphavantage.co/documentation/ . Accessed 2026-10-08. Strength A. Register ID MD-30 in `runs/run-1-notes-market-data.md`.
[^99]: "alphavantage/alpha_vantage_mcp". https://github.com/alphavantage/alpha_vantage_mcp . Accessed 2026-10-08. Strength A. Register ID MD-31 in `runs/run-1-notes-market-data.md`.
[^100]: "Pricing". https://www.tiingo.com/about/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-32 in `runs/run-1-notes-market-data.md`.
[^101]: "IEX". https://www.tiingo.com/documentation/iex . Accessed 2026-10-08. Strength A. Register ID MD-33 in `runs/run-1-notes-market-data.md`.
[^102]: "IEX". https://www.tiingo.com/documentation/iex . Accessed 2026-10-08. Strength A. Register ID MD-34 in `runs/run-1-notes-market-data.md`.
[^103]: "Pricing" (Finnhub), rendered in a browser. https://finnhub.io/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T30 in `runs/run-1-trajectory.md`.
[^104]: "catherinedparnell/mcp-finnhub". https://github.com/Finnhub-Stock-API . Accessed 2026-10-08. Strength A. Register ID MD-38 in `runs/run-1-notes-market-data.md`.
[^105]: "Terms of Service". https://finnhub.io/terms-of-service . Accessed 2026-10-08. Strength A. Register ID MD-37 in `runs/run-1-notes-market-data.md`.
[^106]: "Pricing Plans" (Financial Modeling Prep), rendered in a browser. https://site.financialmodelingprep.com/developer/docs/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T29 in `runs/run-1-trajectory.md`.
[^107]: "financial-modeling-prep-mcp-server". https://cdn.jsdelivr.net/npm/financial-modeling-prep-mcp-server@2.6.12/README.md . Accessed 2026-10-08. Strength D. Register ID MD-42 in `runs/run-1-notes-market-data.md`.
[^108]: "Pricing". https://eodhd.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-43 in `runs/run-1-notes-market-data.md`.
[^109]: "Real-Time Data API (WebSockets)". https://eodhd.com/financial-apis/new-real-time-data-api-websockets . Accessed 2026-10-08. Strength A. Register ID MD-44 in `runs/run-1-notes-market-data.md`.
[^110]: "MCP Server for Financial Data by EODHD". https://eodhd.com/financial-apis/mcp-server-for-financial-data-by-eodhd . Accessed 2026-10-08. Strength A. Register ID MD-46 in `runs/run-1-notes-market-data.md`.
[^111]: "Intraday Historical Data API". https://eodhd.com/financial-apis/intraday-historical-data-api . Accessed 2026-10-08. Strength A. Register ID MD-45 in `runs/run-1-notes-market-data.md`.
[^112]: "Pricing". https://intrinio.com/pricing . Accessed 2026-10-08. Strength A. Price label: published for the Individual plan; Enterprise is gated and unverified. Register ID MD-47 in `runs/run-1-notes-market-data.md`.
[^113]: "Intrinio MCP Server". https://intrinio.com/mcp . Accessed 2026-10-08. Strength A. Register ID MD-48 in `runs/run-1-notes-market-data.md`.
[^114]: "Compare IBKR Lite and IBKR Pro" (Interactive Brokers). https://www.interactivebrokers.com/en/general/compare-lite-pro.php . Accessed 2026-10-08. Strength A. Price label: published. Register ID T35 in `runs/run-1-trajectory.md`.
[^115]: "TWS API v9.72+: Streaming Market Data" (IBKR GitHub Pages documentation, deprecated). https://interactivebrokers.github.io/tws-api/market_data.html . Accessed 2026-10-08. Strength A. Register ID BR-30 in `runs/run-1-notes-brokers-regulation.md`.
[^116]: "FAQ | Webull API". https://developer.webull.com/apis/docs/faq . Accessed 2026-10-08. Strength A. Price label: gated and unverified (no price shown on the page). Register ID BR-55 in `runs/run-1-notes-brokers-regulation.md`.
[^117]: "IEX Cloud Shuttered Though Former Execs Acquire Assets" (dated September 16, 2024). https://www.integrity-research.com/iex-cloud-shuttered-though-former-execs-acquire-assets/ . Accessed 2026-10-08. Strength B. Register ID MD-50 in `runs/run-1-notes-market-data.md`.
[^118]: "Yahoo Terms of Service". https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html . Accessed 2026-10-08. Strength A. Register ID MD-51 in `runs/run-1-notes-market-data.md`.
[^119]: "ranaroussi/yfinance". https://github.com/ranaroussi/yfinance . Accessed 2026-10-08. Strength D. Price label: published. Register ID MD-52 in `runs/run-1-notes-market-data.md`.
[^120]: "Stocks". https://massive.com/stocks . Accessed 2026-10-08. Strength A. Register ID MD-06 in `runs/run-1-notes-market-data.md`.
[^121]: "Market Data FAQ" (vendor docs). https://docs.alpaca.markets/docs/market-data-faq . Accessed 2026-10-08. Strength A. Register ID MD-16 in `runs/run-1-notes-market-data.md`.
[^122]: "Equities". https://databento.com/equities . Accessed 2026-10-08. Strength A. Register ID MD-21 in `runs/run-1-notes-market-data.md`.
[^123]: "SPDR S&P 500 ETF Trust (SPY)". https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy . Accessed 2026-10-08. Strength A. Register ID MD-61 in `runs/run-1-notes-market-data.md`.
[^124]: "iShares Russell 2000 ETF". https://www.ishares.com/us/products/239710/ishares-russell-2000-etf . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-62 in `runs/run-1-notes-market-data.md`.
[^125]: "S&P and Dow Jones Indices Historical Constituents Data API" (EODHD) and four other vendor pages listed in the register. https://eodhd.com/financial-apis/sp-and-dow-jones-indices-historical-constituents-data-api . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-65 in `runs/run-1-notes-market-data.md`.
[^126]: "Nasdaq-100 Index". https://indexes.nasdaqomx.com/Index/Overview/NDX . Accessed 2026-10-08. Strength A. Price label: gated and unverified (Global Index Watch price not public). Register ID MD-57 in `runs/run-1-notes-market-data.md`.
[^127]: "Invesco QQQ". https://www.invesco.com/qqq-etf/en/about.html . Accessed 2026-10-08. Strength A. Register ID MD-63 in `runs/run-1-notes-market-data.md`.
[^128]: "Russell Reconstitution" (FTSE Russell, part of LSEG). https://www.lseg.com/en/ftse-russell/russell-reconstitution . Accessed 2026-10-08. Strength A. Register ID MD-60 in `runs/run-1-notes-market-data.md`.
[^129]: "Nasdaq Composite". https://indexes.nasdaqomx.com/docs/FS_COMP.pdf . Accessed 2026-10-08. Strength A. Register ID MD-56 in `runs/run-1-notes-market-data.md`.
[^130]: "Index Methodology, Nasdaq Composite Index" (copyright 2025). https://indexes.nasdaqomx.com/docs/methodology_COMP.pdf . Accessed 2026-10-08. Strength A. Register ID MD-55 in `runs/run-1-notes-market-data.md`.
[^131]: "Symbol Look-Up/Directory Data Fields & Definitions". https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-64 in `runs/run-1-notes-market-data.md`.
[^132]: "NYSE Composite". https://en.wikipedia.org/wiki/NYSE_Composite . Accessed 2026-10-08. Strength B. Register ID MD-59 in `runs/run-1-notes-market-data.md`.
[^133]: "ICE Data Indices Benchmark Statement, NYSE Composite Index Family" (v1.1, November 2023). https://www.ice.com/publicdocs/data/ICE_Data_Indices_Benchmark_Statement_NYSE_Composite_Index_Family.pdf . Accessed 2026-10-08. Strength A. Register ID MD-58 in `runs/run-1-notes-market-data.md`.
[^134]: "Accessing EDGAR Data". https://www.sec.gov/os/accessing-edgar-data . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-66 in `runs/run-1-notes-market-data.md`.
[^135]: "EDGAR Application Programming Interfaces (APIs)". https://www.sec.gov/search-filings/edgar-application-programming-interfaces . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-67 in `runs/run-1-notes-market-data.md`.
[^136]: "Historical News Data". https://docs.alpaca.markets/docs/historical-news-data . Accessed 2026-10-08. Strength A. Price label: gated and unverified. Register ID MD-69 in `runs/run-1-notes-market-data.md`.
[^137]: "Benzinga". https://massive.com/partners/benzinga . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-70 in `runs/run-1-notes-market-data.md`.
[^138]: "Financial News API". https://eodhd.com/financial-apis/stock-market-financial-news-api . Accessed 2026-10-08. Strength A. Price label: published. Register ID MD-71 in `runs/run-1-notes-market-data.md`.
[^139]: "API Documentation" (Alpha Vantage). https://www.alphavantage.co/documentation/ . Accessed 2026-10-08. Strength A. Price label: gated and unverified. Register ID MD-72 in `runs/run-1-notes-market-data.md`.
[^140]: "FRED API Terms of Use". https://fred.stlouisfed.org/docs/api/terms_of_use.html . Accessed 2026-10-08. Strength A. Price label: gated and unverified. Register ID MD-68 in `runs/run-1-notes-market-data.md`.
[^141]: "Pricing" (Quiver Quantitative API). https://api.quiverquant.com/pricing/ . Accessed 2026-10-08. Strength A. Price label: published. Register ID T12 in `runs/run-1-trajectory.md`.
[^142]: "MCP Server" (Quiver Quantitative API). https://api.quiverquant.com/mcp-server/ . Accessed 2026-10-08. Strength A. Register ID T13 in `runs/run-1-trajectory.md`.
[^143]: "Premium vs API" (Quiver Quantitative). https://www.quiverquant.com/premium-vs-api/ . Accessed 2026-10-08. Strength A. Price label: published. Register ID T11 in `runs/run-1-trajectory.md`.
[^144]: "Firecrawl connector" (Claude Marketplace, Anthropic). https://claude.com/marketplace/connectors/firecrawl . Accessed 2026-10-08. Strength A. Register ID T20 in `runs/run-1-trajectory.md`.
[^145]: "Pricing" (Firecrawl). https://www.firecrawl.dev/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T15 in `runs/run-1-trajectory.md`.
[^146]: "Webull Cloud MCP Server | Webull API". https://developer.webull.com/apis/docs/AI-friendly-Resources/mcp/ . Accessed 2026-10-08. Strength A. Register ID BR-56 in `runs/run-1-notes-brokers-regulation.md`.
[^147]: "Interactive Brokers (IBKR) connector" (Claude Marketplace, Anthropic). https://claude.com/marketplace/connectors/interactive-brokers . Accessed 2026-10-08. Strength A. Register ID T18 in `runs/run-1-trajectory.md`.
[^148]: "Charles Schwab Developer Portal" home page. https://developer.schwab.com/home . Accessed 2026-10-08. Strength A. Register ID T31 in `runs/run-1-trajectory.md`.
[^149]: "go-schwab-trader". https://pkg.go.dev/github.com/nrm21/go-schwab-trader . Accessed 2026-10-08. Strength D. Register ID BR-14 in `runs/run-1-notes-brokers-regulation.md`.
[^150]: "Authentication and Client Creation" (schwab-py documentation). https://schwab-py.readthedocs.io/en/latest/auth.html . Accessed 2026-10-08. Strength D. Register ID BR-12 in `runs/run-1-notes-brokers-regulation.md`.
[^151]: "Authenticate with OAuth" and "OAuth Restart vs. Refresh Token" (Charles Schwab Developer Portal user guides). https://developer.schwab.com/user-guides/apis-and-apps/oauth-restart-vs-refresh-token . Accessed 2026-10-08. Strength A. Register ID T32 in `runs/run-1-trajectory.md`.
[^152]: "Pricing" (Charles Schwab). https://www.schwab.com/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID T34 in `runs/run-1-trajectory.md`.
[^153]: "sudowealth/schwab-mcp" (GitHub). https://github.com/sudowealth/schwab-mcp . Accessed 2026-10-08. Strength D. Register ID BR-15 in `runs/run-1-notes-brokers-regulation.md`.
[^154]: "Tradier Brokerage API" (Tradier docs, getting started). https://docs.tradier.com/docs/getting-started . Accessed 2026-10-08. Strength A. Register ID BR-34 in `runs/run-1-notes-brokers-regulation.md`.
[^155]: "Get Account Balance" (Tradier API reference). https://docs.tradier.com/reference/brokerage-api-accounts-get-account-balance . Accessed 2026-10-08. Strength A. Register ID BR-35 in `runs/run-1-notes-brokers-regulation.md`.
[^156]: "OAuth Authentication" (Tradier docs). https://docs.tradier.com/docs/authentication . Accessed 2026-10-08. Strength A. Register ID BR-36 in `runs/run-1-notes-brokers-regulation.md`.
[^157]: "Pricing & Plans | Tradier". https://tradier.com/individuals/pricing . Accessed 2026-10-08. Strength A. Price label: published. Register ID BR-38 in `runs/run-1-notes-brokers-regulation.md`.
[^158]: "Tradier MCP" (Tradier docs). https://docs.tradier.com/docs/tradier-mcp . Accessed 2026-10-08. Strength A. Register ID BR-40 in `runs/run-1-notes-brokers-regulation.md`.
[^159]: "E*TRADE API Document". https://apisb.etrade.com/docs/api/order/api-order-v1.html . Accessed 2026-10-08. Strength A. Register ID BR-50 in `runs/run-1-notes-brokers-regulation.md`.
[^160]: "E*TRADE API Document". https://apisb.etrade.com/docs/api/account/api-balance-v1.html . Accessed 2026-10-08. Strength A. Register ID BR-49 in `runs/run-1-notes-brokers-regulation.md`.
[^161]: "Get Access Token" (E*TRADE API documentation). https://apisb.etrade.com/docs/api/authorization/get_access_token.html . Accessed 2026-10-08. Strength A. Register ID BR-48 in `runs/run-1-notes-brokers-regulation.md`.
[^162]: "davdunc/mcp_etrade" (GitHub). https://github.com/davdunc/mcp_etrade . Accessed 2026-10-08. Strength D. Register ID BR-51 in `runs/run-1-notes-brokers-regulation.md`.
[^163]: "TWS API v9.72+: Initial Setup" (IBKR's own GitHub Pages documentation, marked deprecated in favor of IBKR Campus). https://interactivebrokers.github.io/tws-api/initial_setup.html . Accessed 2026-10-08. Strength A. Register ID BR-27 in `runs/run-1-notes-brokers-regulation.md`.
[^164]: "TWS API v9.72+: Initial Setup" (same page as BR-27). https://interactivebrokers.github.io/tws-api/initial_setup.html . Accessed 2026-10-08. Strength A. Register ID BR-28 in `runs/run-1-notes-brokers-regulation.md`.
[^165]: "Interactive Brokers Review 2026: Pros, Cons and How It Compares" (NerdWallet, last updated Jul 17, 2026). https://www.nerdwallet.com/reviews/investing/brokers/interactive-brokers . Accessed 2026-10-08. Strength B. Price label: corroborated (NerdWallet and curvedtrading.com; the vendor pricing page refused the fetch tool). Register ID BR-32 in `runs/run-1-notes-brokers-regulation.md`.
[^166]: "Trading Account" (Alpaca docs). https://docs.alpaca.markets/us/docs/account-plans . Accessed 2026-10-08. Strength A. Register ID BR-21 in `runs/run-1-notes-brokers-regulation.md`.
[^167]: "Trading Account" (Alpaca docs). https://docs.alpaca.markets/us/docs/account-plans . Accessed 2026-10-08. Strength A. Register ID BR-16 in `runs/run-1-notes-brokers-regulation.md`.
[^168]: "Dan, where's the cash-only account option?" (Alpaca community forum; staff member Dan_Whitnable_Alpaca, posts dated January 26 and 30, 2026). https://forum.alpaca.markets/t/dan-wheres-the-cash-only-account-option/18353 . Accessed 2026-10-08. Strength D. Register ID BR-17 in `runs/run-1-notes-brokers-regulation.md`.
[^169]: "Get Account". https://docs.alpaca.markets/us/reference/getaccount-1 . Accessed 2026-10-08. Strength A. Register ID BR-19 in `runs/run-1-notes-brokers-regulation.md`.
[^170]: "Authentication" (Alpaca docs). https://docs.alpaca.markets/us/docs/authentication . Accessed 2026-10-08. Strength A. Register ID BR-20 in `runs/run-1-notes-brokers-regulation.md`.
[^171]: "Commission and Clearing Fees" (Alpaca support). https://alpaca.markets/support/commission-clearing-fees . Accessed 2026-10-08. Strength A. Price label: published. Register ID BR-23 in `runs/run-1-notes-brokers-regulation.md`.
[^172]: "alpacahq/alpaca-mcp-server" (GitHub, under Alpaca's own organization). https://github.com/alpacahq/alpaca-mcp-server . Accessed 2026-10-08. Strength A. Register ID BR-25 in `runs/run-1-notes-brokers-regulation.md`.
[^173]: "SIM vs. LIVE | TradeStation API". https://api.tradestation.com/docs/fundamentals/sim-vs-live/ . Accessed 2026-10-08. Strength A. Register ID BR-43 in `runs/run-1-notes-brokers-regulation.md`.
[^174]: "Refresh Tokens | TradeStation API". https://api.tradestation.com/docs/fundamentals/authentication/refresh-tokens/ . Accessed 2026-10-08. Strength A. Register ID BR-42 in `runs/run-1-notes-brokers-regulation.md`.
[^175]: "TradeStation Review 2026: Best Broker for Automated Traders?" (PickMyTrade blog, August 7, 2026). https://blog.pickmytrade.io/tradestation-review-2026-best-broker-for-automated-traders/ . Accessed 2026-10-08. Strength C. Price label: gated and unverified (one review site only; the vendor pricing page refused the fetch tool). Register ID BR-47 in `runs/run-1-notes-brokers-regulation.md`.
[^176]: "TradeStation Securities rolls out MCP Connection" (FX News Group, January 13, 2026). https://fxnewsgroup.com/forex-news/retail-forex/tradestation-securities-rolls-out-mcp-connection/ . Accessed 2026-10-08. Strength B. Register ID BR-46 in `runs/run-1-notes-brokers-regulation.md`.
[^177]: "FAQ - tastytrade Developer Docs". https://developer.tastytrade.com/docs/faq/ . Accessed 2026-10-08. Strength A. Register ID BR-62 in `runs/run-1-notes-brokers-regulation.md`.
[^178]: "OAuth2 authentication - tastytrade Developer Docs". https://developer.tastytrade.com/docs/authentication/oauth2/ . Accessed 2026-10-08. Strength A. Register ID BR-61 in `runs/run-1-notes-brokers-regulation.md`.
[^179]: "MCP Server - tastytrade Developer Docs". https://developer.tastytrade.com/docs/sdks-and-tools/mcp-server/ . Accessed 2026-10-08. Strength A. Register ID BR-64 in `runs/run-1-notes-brokers-regulation.md`.
[^180]: "Trading API Application | Webull API". https://developer.webull.com/apis/docs/authentication/IndividualApplicationAPI . Accessed 2026-10-08. Strength A. Price label: published. Register ID BR-52 in `runs/run-1-notes-brokers-regulation.md`.
[^181]: "Token | Webull API". https://developer.webull.com/apis/docs/authentication/token . Accessed 2026-10-08. Strength A. Register ID BR-53 in `runs/run-1-notes-brokers-regulation.md`.
[^182]: "Webull connector" (Claude Marketplace, Anthropic). https://claude.com/marketplace/connectors/webull . Accessed 2026-10-08. Strength A. Register ID T19 in `runs/run-1-trajectory.md`.
[^183]: "Public Trading API - Automate Stocks & Options Orders". https://public.com/api . Accessed 2026-10-08. Strength A. Price label: published. Register ID BR-58 in `runs/run-1-notes-brokers-regulation.md`.
[^184]: "Public brokerage API for Algorithmic Trading | Stocks, Options & Crypto" (API documentation landing page). https://public.com/api/docs . Accessed 2026-10-08. Strength A. Register ID BR-59 in `runs/run-1-notes-brokers-regulation.md`.
[^185]: "INDIVIDUAL TRADER API PROGRAM TERMS AND CONDITIONS, June 2026" (PDF; text extracted locally from the fetched file). https://public.com/documents/individual-api-program . Accessed 2026-10-08. Strength A. Register ID BR-60 in `runs/run-1-notes-brokers-regulation.md`.
[^186]: "Robinhood is Now Open to Agents" (Robinhood newsroom, May 27, 2026). https://robinhood.com/newsroom/robinhood-is-now-open-to-agents/ . Accessed 2026-10-08. Strength A. Register ID BR-65 in `runs/run-1-notes-brokers-regulation.md`.
[^187]: "Onboarding an external agent | Robinhood" (support article). https://www.robinhood.com/us/en/support/articles/agentic-trading-overview/ . Accessed 2026-10-08. Strength A. Register ID BR-66 in `runs/run-1-notes-brokers-regulation.md`.
[^188]: "Trading with your agent | Robinhood" (support article). https://www.robinhood.com/us/en/support/articles/trading-with-your-agent/ . Accessed 2026-10-08. Strength A. Register ID BR-67 in `runs/run-1-notes-brokers-regulation.md`.
[^189]: "Does Fidelity Have an API? - Blog | TradersPost" (published September 3, 2025; last modified August 6, 2026). https://blog.traderspost.io/article/does-fidelity-have-an-api . Accessed 2026-10-08. Strength C. Register ID BR-68 in `runs/run-1-notes-brokers-regulation.md`.
[^190]: "code-rabi/interactive-brokers-mcp" (GitHub). https://github.com/code-rabi/interactive-brokers-mcp . Accessed 2026-10-08. Strength D. Register ID BR-33 in `runs/run-1-notes-brokers-regulation.md`.
[^191]: "Connect Claude Code to tools via MCP". https://code.claude.com/docs/en/mcp.md . Accessed 2026-10-08. Strength A. Register ID RT-32 in `runs/run-1-notes-runtime-platform.md`.
[^192]: "Push events into a running session with channels". https://code.claude.com/docs/en/channels.md . Accessed 2026-10-08. Strength A. Register ID RT-28 in `runs/run-1-notes-runtime-platform.md`.
[^193]: "Hooks reference". https://code.claude.com/docs/en/hooks.md . Accessed 2026-10-08. Strength A. Register ID RT-30 in `runs/run-1-notes-runtime-platform.md`.
[^194]: "Legal and compliance". https://code.claude.com/docs/en/legal-and-compliance.md . Accessed 2026-10-08. Strength A. Register ID RT-02 in `runs/run-1-notes-runtime-platform.md`.
[^195]: Relii project instructions, local file ~/Projects/relii/CLAUDE.md. local file, no URL . Accessed 2026-10-08. Strength A. Register ID T1 in `runs/run-1-trajectory.md`.
[^196]: "Rate Limiting" (Tradier docs). https://docs.tradier.com/docs/rate-limiting . Accessed 2026-10-08. Strength A. Register ID BR-37 in `runs/run-1-notes-brokers-regulation.md`.
[^197]: "Configuring regions for Vercel Functions" (Vercel docs). https://vercel.com/docs/functions/configuring-functions/region.md . Accessed 2026-10-08. Strength A. Register ID RT-49 in `runs/run-1-notes-runtime-platform.md`.
[^198]: "Brokerage Trading API | Tradestation Fintech Solutions". https://developer.tradestation.com/trading-api . Accessed 2026-10-08. Strength A. Register ID BR-45 in `runs/run-1-notes-brokers-regulation.md`.
[^199]: "Monthly API credits for Max and Team plans". https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans . Accessed 2026-10-08. Strength A. Register ID RT-13 in `runs/run-1-notes-runtime-platform.md`.
[^200]: "Resources" (QuantConnect docs). https://www.quantconnect.com/docs/v2/cloud-platform/organizations/resources . Accessed 2026-10-08. Strength A. Register ID RT-73 in `runs/run-1-notes-runtime-platform.md`.
[^201]: "MCP Server, Key Concepts" (QuantConnect docs). https://www.quantconnect.com/docs/v2/ai-assistance/mcp-server/key-concepts . Accessed 2026-10-08. Strength A. Register ID RT-77 in `runs/run-1-notes-runtime-platform.md`.
[^202]: "Tier Features" (QuantConnect docs). https://www.quantconnect.com/docs/v2/cloud-platform/organizations/tier-features . Accessed 2026-10-08. Strength A. Register ID RT-76 in `runs/run-1-notes-runtime-platform.md`.
[^203]: "Brokerages" (QuantConnect docs). https://www.quantconnect.com/docs/v2/cloud-platform/live-trading/brokerages . Accessed 2026-10-08. Strength A. Register ID RT-74 in `runs/run-1-notes-runtime-platform.md`.
[^204]: "Alpaca". https://www.quantconnect.com/docs/v2/writing-algorithms/reality-modeling/brokerages/supported-models/alpaca . Accessed 2026-10-08. Strength A. Register ID RT-75 in `runs/run-1-notes-runtime-platform.md`.
