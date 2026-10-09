# Run 2 notes: data delay, wide-universe cadence, Claude as the driver, and terms

Status line: COMPLETE as far as this session could take it. 76 findings (DC-01 to DC-76), three summary tables, and the Not verified, Needs browser and Contradictions lists are all written. The weakest areas are Schwab (portal unreadable), Finnhub and Financial Modeling Prep (sites unreadable again), Databento's documentation (quotes came through the summarizing fetch tool only), Finazon (a published price with a doubt attached), and the market data agreements of Alpaca, Tradier, Schwab and Interactive Brokers (not found or not readable).

Method deviations, stated plainly. (1) Six PDF documents (four CTA plan policies, the UTP data policies, one Federal Register notice) were saved to the session's temporary scratch folder outside the repository so their text could be read. (2) Their text was extracted with the Mac's built-in Swift and PDFKit, not with `python3 -I` as the brief named, because the built-in Python has no PDF reader. Nothing was installed. (3) One further PDF (an SEC comment letter) was saved automatically by the fetch tool into the Claude tool-results folder under the home directory, also outside the repository, and read the same way. No file other than this one was created in the repository.

Topic: how delayed each market data option is, whether about 5,000 to 6,000 U.S. symbols can be checked every 1 to 5 minutes, and whether Claude's own schedulers and Anthropic's terms can carry a 5 minute cadence and an agent that acts alone.

Date of research: 2026-10-09 (America/Chicago), confirmed with `date` at the start of the session (Fri Oct 9 11:46 CDT 2026). Every finding below was accessed 2026-10-09 unless it is a reused run 1 finding, which keeps its 2026-10-08 date.

This file is research input for a human decision. Nothing in it is a recommendation or an instruction to trade.

## Method

- Evidence comes only from pages opened live in this session, by web search, the fetch tool, or `curl` reading the raw page text. Recalled knowledge guided where to look and is never cited as evidence.
- No browser was used. No account was created, no trial started, no form filled. Nothing was installed. No file other than this one was created in the repository.
- Quotes caveat. The fetch tool passes a page through a small summarizing model and can paraphrase. Where a quote came through that tool and could not be confirmed as verbatim it is marked "paraphrase by fetch tool". Quotes taken with `curl` are the page's own text with tags stripped. Any em dash or en dash in a source quote has been replaced with a hyphen or a comma, because this project's convention bans those characters.
- Strength labels: A = primary and authoritative (a regulator, an exchange, an index owner, or the vendor's own documentation, pricing page or terms, seen live). B = reputable independent press or an established reference publisher. C = review sites, comparison sites, affiliate blogs. D = forums, social posts, personal blogs, community code repositories.
- Price labels: "published" (on the vendor's own public page, seen live today), "corroborated" (two or more independent sources agree, named), "gated and unverified" (with the reason).
- Estimates are labelled ESTIMATE, with assumptions, arithmetic, and what would turn them into a measurement.
- Glossary. SIP = Securities Information Processor, the consolidated national feed that merges quotes and trades from all U.S. exchanges. CTA = Consolidated Tape Association, which runs the SIP for NYSE-listed and other non-Nasdaq-listed stocks. UTP = Unlisted Trading Privileges plan, which runs the SIP for Nasdaq-listed stocks. IEX = Investors Exchange, one exchange with a small share of volume. NBBO = national best bid and offer. API = application programming interface, the way one program asks another for data. REST = request-and-answer access. WebSocket = a connection that stays open and pushes data. MCP = Model Context Protocol, the standard that lets Claude call outside tools. MTok = one million tokens. ETF = exchange traded fund. OTC = over the counter.

## Run 1 findings reused (kept at 2026-10-08, not reopened)

Each of these is cited in the tables or findings below without being reopened today.

- Massive: MD-03 (plan prices, also re-seen today on a docs page, DC-43), MD-04 (delay by plan), MD-05 (call limits and history), MD-06 (feed and coverage), MD-08 and MD-15 (individual licence terms, "display use only").
- Alpaca: MD-11 (IEX share and SIP description), MD-12 (30 symbol stream cap, call limits), MD-16 (no OTC), MD-17 (IEX thinness example).
- Databento: MD-18 (plan prices), MD-19 (no pay-as-you-go live equities), MD-20 (not the SIP), MD-21 (coverage).
- Twelve Data: MD-23 (prices), MD-25 (credits per minute by plan), MD-26.
- Alpha Vantage: MD-28 (premium prices and requests per minute).
- Tiingo: MD-32 (prices and limits), MD-33 (IEX only), MD-34 (IEX agreement).
- Finnhub and Financial Modeling Prep: MD-36, MD-40, MD-41 (third-party figures only, strength C and D).
- EODHD: MD-43 (prices, 100,000 calls a day), MD-44 (real time WebSocket is one exchange), MD-45.
- Intrinio: MD-47 (public prices).
- Anthropic and Claude Code: RT-01 (which terms govern which plan), RT-04 (Agent SDK under Commercial Terms), RT-05 (`claude -p`), RT-13 (what the API credit does not cover), RT-14 (Max prices), RT-29 (Claude Code in GitHub Actions), RT-40 (Managed Agents memory stores).
- Hosts: RT-45, RT-46, RT-50 (Vercel), RT-51, RT-52, RT-53, RT-55 (Supabase), RT-61, RT-62 (Cloudflare), RT-64 to RT-68 (small servers), RT-70, RT-71 (the Mac).

<!-- REUSED-END -->

## Run 1 findings reopened, and why

- RT-35 (Usage Policy, both versions): reopened because the agent may now act alone, so the exact wording on recommendations, review, exclusions and agents had to be quoted verbatim. Result: DC-01 to DC-12. Text unchanged since 2026-10-08.
- RT-33 and RT-34 (Consumer Terms): reopened to confirm the securities passage and the effective date. Result: DC-14, DC-15. Unchanged.
- RT-18 to RT-21 (cloud routines): reopened for the 5 minute cadence and for daily caps. Result: DC-21 to DC-24. Same numbers. New: no daily cap found, scheduled-run cap of 100 an hour.
- RT-24 to RT-26 (desktop tasks and `/loop`): reopened for interval, sleep and delay. Result: DC-25 to DC-27. New: skipped overlapping runs, `/loop` jitter of up to half the interval.
- RT-06, RT-07, RT-11 (`claude -p` on a subscription, bare mode): reopened because this area changed twice in 2026. Result: DC-28, DC-29. Unchanged.
- RT-12, RT-13 (monthly API credit): reopened to restate what it covers. Result: DC-34. Unchanged.
- RT-15, RT-16 (Max limits): reopened to look for any published number. Result: DC-33. Still none.
- RT-36, RT-38 (model prices): reopened so the cost estimate rests on today's price table. Result: DC-35. Same numbers.
- RT-37, RT-39 (Managed Agents): reopened for interval, price, triggers and MCP reach. Result: DC-30 to DC-32. New: jitter rule, MCP permission defaults.
- RT-57 to RT-59 (GitHub Actions): reopened for cadence and cost arithmetic. Result: DC-40, DC-41. New: per-job rounding up to a whole minute.
- MD-10 to MD-13 (Alpaca): reopened because delay is now a variable and for snapshot and wildcard limits. Result: DC-45 to DC-48.
- MD-07 (Massive WebSocket) and Massive's snapshot: reopened for the whole-market request. Result: DC-43, DC-44.
- MD-24 (Twelve Data feed) and MD-29, MD-30 (Alpha Vantage): reopened for the coverage statement, delay settings and bulk requests. Result: DC-59 to DC-62.
- MD-54 (Tradier): reopened for rate limits and batch size. Result: DC-49, DC-50.
- Run 1 "Not verified" item 18 (broker data, Interactive Brokers and Schwab): reopened because broker-supplied data is now a candidate. Result: DC-51 to DC-53 (Interactive Brokers read), DC-56 (Schwab still unreadable).
- Run 1 "Not verified" item 10 and MD-15 (non-display licensing): reopened at the source, the tape plans' own policies. Result: DC-69 to DC-75.

<!-- REOPENED-END -->

## 1. Findings register

### Part A: Anthropic's terms and an agent that acts alone (question 5)

Method for Part A: every page was read with `curl` and the HTML tags stripped, so the quotes are the page's own words (dashes replaced). Nothing here was paraphrased by the fetch tool. The findings quote and describe. They do not interpret.

**DC-01.** The Usage Policy page at Anthropic's main address shows the version "Effective November 12, 2026". That version is not yet in force on the access date. The page itself carries no sentence saying which version applies until then, only the effective date and a "Previous Version" link.
- Page: "Usage Policy" (Anthropic). URL: https://www.anthropic.com/legal/aup
- Accessed: 2026-10-09. Strength: A.
- Quote: "Usage Policy Effective November 12, 2026 Previous Version" (page header, three lines joined).
- Reopened from run 1 (RT-35). Unchanged since 2026-10-08.

**DC-02.** The version in force today is the one the "Previous Version" link leads to, marked "Effective September 15, 2025". Its banner says it has been replaced by a newer version, which is a description of the website, not of the effective date: the newer one starts November 12, 2026.
- Page: "Usage Policy" (archived version). URL: https://www.anthropic.com/legal/archive/22742366-2ef0-4c7a-a833-6523f10d3944
- Accessed: 2026-10-09. Strength: A.
- Quote: "This document has been replaced by a newer version, and is available for archival purposes Effective September 15, 2025"

**DC-03.** In-force version (September 15, 2025), finance as a high-risk use case: the list item is broad ("financial decisions, including investment advice") and the section opens by saying it applies to "specific consumer-facing use cases".
- Page and URL: as DC-02.
- Accessed: 2026-10-09. Strength: A.
- Quote: "Finance: Use cases related to financial decisions, including investment advice, loan approvals, and determining financial eligibility or creditworthiness"
- Also on the page: "Our High-Risk Use Case Requirements apply to specific consumer-facing use cases that pose an elevated risk of harm."

**DC-04.** In-force version, the human review rule: a qualified professional must review the content or decision before it is disseminated or finalized, when the product is used for advice, recommendations or subjective decision-making "directly affecting individuals or consumers". The in-force version does not define "qualified professional".
- Page and URL: as DC-02.
- Accessed: 2026-10-09. Strength: A.
- Quote: "When using our products or services to provide advice, recommendations, or in subjective decision-making directly affecting individuals or consumers, a qualified professional in that field must review the content or decision prior to dissemination or finalization."
- Also on the page: "You or your organization are responsible for the accuracy and appropriateness of that information."

**DC-05.** In-force version, agents: one sentence, pointing to a help article with examples (see DC-13).
- Page and URL: as DC-02.
- Accessed: 2026-10-09. Strength: A.
- Quote: "Agentic use cases must still comply with the Usage Policy. We provide examples of Usage Policy prohibitions in the context of agentic use in this Help Center article."

**DC-06.** November 12, 2026 version, the finance item: a high-risk recommendation in finance is a "personalized recommendation to buy, sell, hold, or allocate among specific investment products". The wording is about a recommendation. Digital assets are named.
- Page: "Usage Policy", section "High-risk AI Recommendations". URL: https://www.anthropic.com/legal/aup
- Accessed: 2026-10-09. Strength: A.
- Quote: "Finance - a personalized recommendation to buy, sell, hold, or allocate among specific investment products, such as securities, funds, digital assets, or annuities; advising an individual on their own taxes"
- Also on the page (the sentence that introduces the list): "The requirements apply when users use our products or services to provide a recommendation in any of the following, which are 'High-risk Areas'".

**DC-07.** November 12, 2026 version, the review rule: a qualified person must meaningfully review a high-risk recommendation, with authority to change it, before it is delivered as advice "or before it is used to implement a decision".
- Page: "Usage Policy", section "Requirements". URL: https://www.anthropic.com/legal/aup
- Accessed: 2026-10-09. Strength: A.
- Quote: "A qualified person must meaningfully review a High-risk AI Recommendation, with the authority to change or modify it, before it is delivered as advice to an individual who might rely on it or before it is used to implement a decision."

**DC-08.** November 12, 2026 version, the definition of a qualified person: training or experience to evaluate the output in the field, plus a license only where the law requires one for the underlying activity. The text does not say whether an individual deciding about their own money counts.
- Page and URL: as DC-07.
- Accessed: 2026-10-09. Strength: A.
- Quote: "A qualified person is someone with the training or experience to evaluate the output in that field, and who holds a license where applicable law requires one for the underlying activity."
- Also on the page: "The qualified person remains responsible for the accuracy and appropriateness of what is delivered or decided."

**DC-09.** November 12, 2026 version, who the section is aimed at: the section's opening says the requirements protect an "impacted individual" and apply to "anyone who uses our products to make a High-risk AI Recommendation".
- Page: "Usage Policy", section "High-risk Use Case Requirements". URL: https://www.anthropic.com/legal/aup
- Accessed: 2026-10-09. Strength: A.
- Quote: "we require that a qualified person remain accountable for what is delivered or decided, and that the impacted individual knows AI was involved in the advice or decision."
- Also on the page: "These requirements for high-risk use cases are meant to protect individuals. However, they do not replace local legal requirements and restrictions."

**DC-10.** November 12, 2026 version, the listed exclusions for recommendations. There are six. The two that bear on a trading agent are internal research or analysis that is "not the ultimate" recommendation, and carrying out a decision a person already made or applying a fixed rule "where the model exercises no judgment about the individual".
- Page: "Usage Policy", section "Exclusions". URL: https://www.anthropic.com/legal/aup
- Accessed: 2026-10-09. Strength: A.
- Quote: "Carrying out a decision a person has already made, or applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual."
- Also on the page, the other five in order: "General information or educational content, including explaining what a law says, how a condition or treatment works, or how investing works, without applying it to the individual's circumstances."; "Wellness content, such as education on sleep, stress, nutrition, or exercise."; "Explaining or helping an individual understand advice, a diagnosis, or a decision that a qualified person has already given them (as long as it is not an additional High-risk AI Recommendation)."; "Internal drafting, research, summarization, or analysis that is not the ultimate High-risk AI Recommendation delivered."; "Business operations that do not advise or decide about a specific individual."
- Also on the page (the heading sentence): "Using our products to assist in workflows that are related to, but do not actually provide, High-risk AI Recommendations. Some non-exhaustive examples are:"

**DC-11.** November 12, 2026 version, agents: users are responsible for what agents they build or deploy do through tools and connected systems.
- Page: "Usage Policy", section "Additional Use Case Guidelines". URL: https://www.anthropic.com/legal/aup
- Accessed: 2026-10-09. Strength: A.
- Quote: "Agentic use cases must comply with the Usage Policy. Users are responsible for ensuring that agents they build or deploy, including actions those agents take through tools, browsers, or connected systems, comply with this Usage Policy."

**DC-12.** What neither Usage Policy version contains (a word search of the full stripped page text, both versions). The November 12, 2026 version has zero occurrences of "transaction", "trading", "broker", "personal use", "own account" and "self-directed". Its only use of "execut" is about commands executed on physical equipment. So: there is no text about an agent that EXECUTES a securities transaction as distinct from recommending one, apart from the phrase "before it is used to implement a decision" in DC-07 and the "carrying out a decision a person has already made" exclusion in DC-10. There is no text about personal use or about a user who is both the operator and the only person affected. The in-force version likewise has no "transaction", "trading" or "personal use" text in its high-risk section. This is a statement of absence from the pages as read, not a ruling.
- Pages: both Usage Policy versions. URLs as DC-01 and DC-02.
- Accessed: 2026-10-09. Strength: A (for absence in the text read).
- Quote (the one "execut" hit in the new version): "Generating plans, code, toolpaths, waypoints, or commands that a qualified person reviews before they are executed on equipment."

**DC-13.** Anthropic's help article on agents and the Usage Policy lists, among things agents must not be used for, "unauthorized, illegal, or fraudulent financial transactions", with brokerage and investment advisory activities given as the example in brackets. The adjectives "unauthorized, illegal, or fraudulent" qualify the phrase. The article does not address an authorized, lawful transaction on the user's own account. Dated March 16, 2026 on the page.
- Page: "Using Agents According to Our Usage Policy" (Claude Help Center, dated March 16, 2026). URL: https://support.claude.com/en/articles/12005017-using-agents-according-to-our-usage-policy
- Accessed: 2026-10-09. Strength: A.
- Quote: "Engage in unauthorized, illegal, or fraudulent financial transactions (such as brokerage or investment advisory activities) or payment processing"
- Also on the page: "The following are intended to be non-exhaustive illustrations of how our Usage Policy applies to certain agentic uses." The item sits under the heading "Do Not Use Agents for Unauthorized System Access or Manipulation".

**DC-14.** The Consumer Terms (which govern a Max plan, RT-01) still carry the passage on relying on the service to buy or sell securities, word for word as run 1 recorded it, and the effective date is still October 8, 2025. It sits in the list of things the user may not do in Section 3 ("Use of our Services").
- Page: "Consumer Terms of Service" (Effective October 8, 2025). URL: https://www.anthropic.com/legal/consumer-terms
- Accessed: 2026-10-09. Strength: A.
- Quote: "To rely upon the Services, the Materials, or the Actions to buy or sell securities or to provide or receive advice about securities, commodities, derivatives, or other financial products or services, as Anthropic is not a broker-dealer or a registered investment adviser"
- Reopened from run 1 (RT-34). Unchanged.

**DC-15.** The Consumer Terms define "Actions" as things the service does on the user's behalf, and say the user should not rely on outputs or actions without confirming them independently.
- Page and URL: as DC-14, Section 4.
- Accessed: 2026-10-09. Strength: A.
- Quote: "Actions may not be error free or operate as you intended. You should not rely on any Outputs or Actions without independently confirming their accuracy."
- Also on the page: "enable the Services to take actions on your behalf, such as software manipulation, data processing, and system interactions (we call these \"Actions\")".

**DC-16.** The Commercial Terms (which govern API keys, Managed Agents and the Agent SDK, RT-01 and RT-04) contain NO passage on securities, trading, investment advice, brokers or financial products. A word search of the full stripped page found none of "securit" (other than data security), "trading", "invest", "broker" or "financial" in the terms text. The terms incorporate the Usage Policy by reference, so DC-01 to DC-12 apply to API use. Effective date shown: June 17, 2025.
- Page: "Commercial Terms of Service" (Effective June 17, 2025). URL: https://www.anthropic.com/legal/commercial-terms
- Accessed: 2026-10-09. Strength: A (for absence in the text read).
- Quote: "Customer must cooperate with reasonable requests for information from Anthropic to support compliance with its Usage Policy, including to verify Customer's identity and use of the Services."
- Check of the absence claim, run twice: in the terms body the counts were zero for "securit", "trading", "invest", "financial", "broker", "high-risk" and "professional advice". The only hits for the letters "trade" were "trademark", "in trade or commerce" and "TRADE USE" in the warranty and indemnity sections, none of which concerns trading securities.
- What this does and does not address: the difference between DC-14 and DC-16 is a difference in the two documents' text. Neither document says the difference is intentional.

**DC-17.** Anthropic's Software Directory Policy (the rules for connectors and other software listed in Anthropic's directories) says software that moves money or executes financial transactions for users is not allowed into the directories "unless otherwise expressly permitted by us in writing". It is a rule about what gets LISTED. It does not say what a user may do with a connector or MCP server that is not in the directory. Dated April 15, 2026 on the page. It replaced the older "MCP directory policy" that the in-force Usage Policy still links to.
- Page: "Anthropic Software Directory Policy", section "4. Unsupported Use Cases" (Claude Help Center, dated April 15, 2026). URL: https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy
- Accessed: 2026-10-09. Strength: A.
- Quote: "A. Software that transfers money, cryptocurrency, or other financial assets, or executes financial transactions on behalf of users."
- Also on the page: "Unless otherwise expressly permitted by us in writing, we do not allow Software with certain capabilities into our Directories. We may revisit these restrictions as our Directories and Anthropic Services evolve."

**DC-18.** The Interactive Brokers connector listed in Anthropic's own marketplace ("Anthropic verified", category Financial services, added May 2026) does not place orders. Its listing says Claude drafts trade instructions that go to the owner's Interactive Brokers account for review and approval, and that Claude never submits orders to the market. The listed tools are read tools plus `get_order_instructions`. This is consistent with the directory rule in DC-17. It also means this connector, as listed, cannot carry an agent that acts alone.
- Page: "Interactive Brokers (IBKR)" connector listing (Claude Marketplace). URL: https://claude.com/marketplace/connectors/interactive-brokers
- Accessed: 2026-10-09. Strength: A.
- Quote: "which are sent to your IBKR account for your review and approval. Claude never submits orders directly to the market."
- Also on the page: "Only use connectors from developers you trust. Anthropic does not control which tools developers make available and cannot verify that they will work as intended or that they won't change." Tools listed: get_account_balances, get_account_positions, get_account_summary, get_order_instructions, get_orders, get_portfolio_allocation, get_price_history, get_price_snapshot, get_trades, search_contracts.

**DC-19.** The Webull connector listed in Anthropic's marketplace ("Anthropic verified", added July 2026, 71 tools) is described as account data, quotes, bars, ratings and watchlists. The description read does not mention placing orders. Only the first 24 of 71 tool names were visible without a browser, and none of those is an order tool. Whether any of the other 47 places an order is not verified.
- Page: "Webull" connector listing (Claude Marketplace). URL: https://claude.com/marketplace/connectors/webull
- Accessed: 2026-10-09. Strength: A.
- Quote: "Ask about account balances, positions, real-time quotes, historical price bars, K-line charts, futures and options data, analyst ratings and price targets, or manage your watchlists"
- Also checked: marketplace addresses guessed for Robinhood, Public, TradeStation, Alpaca, Schwab, tastytrade and Massive returned "404 Not Found" (guessed addresses, so a 404 does not prove there is no listing). An "alpha-vantage" address returned 200.

**DC-20.** Anthropic's help article announcing Usage Policy updates is dated March 16, 2026 and, in the text read, contains no mention of November 2026. No Anthropic announcement explaining the November 12, 2026 version was found in this session (see Not verified).
- Page: "Updates to our Acceptable Use Policy (now 'Usage Policy'), Consumer Terms of Service, and Privacy Policy" (Claude Help Center). URL: https://support.claude.com/en/articles/9301722-updates-to-our-acceptable-use-policy-now-usage-policy-consumer-terms-of-service-and-privacy-policy
- Accessed: 2026-10-09. Strength: A (for absence in the text read).
- Quote: "We've broken out some specific 'high-risk use cases' that have additional requirements due to posing an elevated risk of harm."

### Part B: Claude as the driver at a 5 minute cadence (question 4)

Method for Part B: Anthropic's documentation pages were read with `curl` in their plain-text (`.md`) form, and help center and GitHub pages with `curl` and tags stripped. Quotes are the page's own words.

**DC-21.** Claude Code cloud routines, schedule floor: still one hour. A 5 minute SCHEDULE on a routine is rejected. Still labelled research preview.
- Page: "Automate work with routines". URL: https://code.claude.com/docs/en/routines.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "The minimum interval is one hour; expressions that run more frequently are rejected."
- Also on the page: "Routines are in research preview. Behavior, limits, and the API surface may change." and "If you schedule a run exactly on the hour, such as 9:00, it can start several minutes late."
- Reopened from run 1 (RT-18, RT-19). Unchanged.

**DC-22.** Routine API trigger caps, as the table reads today: 30 starts per hour per routine (shared between "Run now", API fires and re-running a one-off), and 100 API fires per hour per account. Scheduled runs are capped at 100 per hour per account. The page gives hourly caps only. A word search for "per day", "daily cap", "daily limit" and "runs a day" found no daily run cap on the page.
- Page: "Automate work with routines", section "Usage and limits". URL: https://code.claude.com/docs/en/routines.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "**Run now**, API fires, and setting a one-off routine to run again | 30 per hour | Each routine, one count shared by all three | The action fails until the limit resets"
- Also on the page: "API fires | 100 per hour | Your account, counted separately from **Run now**"; "Scheduled runs, including one-off runs | 100 per hour | Your account | The run waits until the limit resets"; "None of these hourly limits has overage."
- Arithmetic, not a quote: a 5 minute cadence is 12 starts an hour, under the 30 per routine cap. A 1 minute cadence is 60 an hour, over the 30 per routine cap and under the 100 per account cap, so it would need at least two routines taking turns. Both rely on something OUTSIDE Claude sending the start request every 5 minutes (the routine's own schedule cannot, DC-21). Whether the plan's usage allowance would last through 78 or 390 full cloud sessions a day is not published (DC-33).
- Reopened from run 1 (RT-20). Same numbers. New in this reading: the scheduled-run cap of 100 per hour and the absence of any daily cap.

**DC-23.** The routine API trigger is experimental and for claude.ai accounts only. It ships under a dated beta header, and Anthropic says shapes, rate limits and token rules may change.
- Page: "Automate work with routines", section "Add an API trigger". URL: https://code.claude.com/docs/en/routines.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "The `/fire` endpoint ships under the `experimental-cc-routine-2026-04-01` beta header. Request and response shapes, rate limits, and token semantics may change while the feature is in research preview."
- Also on the page: "The `/fire` endpoint is available to claude.ai users only and is not part of the Claude Platform API surface."

**DC-24.** Routines run with no permission prompts. Every included connector's tools, including ones that write, can be used without asking. Routines also draw down the subscription's usage like interactive sessions, and stop when the usage limit is hit unless paid overage ("usage credits") is turned on.
- Page: "Automate work with routines". URL: https://code.claude.com/docs/en/routines.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "Routines run autonomously as full Claude Code cloud sessions: there is no permission-mode picker, and the session runs shell commands, uses skills committed to the cloned repository, and calls any connectors you include, all without stopping for approval"
- Also on the page: "Claude can use every tool from an included connector, including writes, without asking for permission during a run."; "Routines draw down subscription usage the same way interactive sessions do."; "Without usage credits, additional runs are rejected until your usage window resets."
- Reopened from run 1 (RT-19, RT-21). Unchanged.

**DC-25.** Claude Code desktop scheduled tasks: minimum interval one minute, but each task is deliberately started "a few minutes" after its scheduled time, at a fixed offset. The Mac must be awake and the app running. A missed run is skipped. Closing the lid sleeps the Mac. On a 5 minute cadence a delay of a few minutes is a large share of the interval. The page gives no number for "a few minutes".
- Page: "Schedule recurring tasks in Claude Code Desktop". URL: https://code.claude.com/docs/en/desktop-scheduled-tasks.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "Each task gets a small delay of a few minutes after the scheduled time to stagger API traffic. The delay is deterministic: the same task always starts at the same offset."
- Also on the page: "Tasks only run while the desktop app is running and your computer is awake. If your computer sleeps through a scheduled time, the run is skipped."; "Closing the laptop lid still puts it to sleep."; table rows "Minimum interval | 1 hour | 1 minute | 1 minute" and "Permission prompts | No (runs autonomously) | Configurable per task | Inherits from session".
- Reopened from run 1 (RT-24, RT-25). Unchanged.

**DC-26.** Desktop scheduled tasks skip a run when the previous run is still going or other scheduled tasks are already running. So a run that takes longer than the interval causes the next one to be skipped, not queued.
- Page: "Schedule recurring tasks in Claude Code Desktop", section "Manage scheduled tasks". URL: https://code.claude.com/docs/en/desktop-scheduled-tasks.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "Hover a skipped entry to see why: your computer was asleep, the previous run was still in progress, or other scheduled tasks were already running."
- New in run 2.

**DC-27.** `/loop` inside a session: one minute granularity, but a recurring task that runs more often than hourly can fire late by up to half its interval (so up to 2.5 minutes late on a 5 minute loop). It fires only between turns while the session is idle, never catches up on missed fires, and expires after 7 days.
- Page: "Run prompts on a schedule", sections "Jitter", "Seven-day expiry" and "Limitations". URL: https://code.claude.com/docs/en/scheduled-tasks.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "Recurring tasks fire up to 30 minutes after the scheduled time (or up to half the interval, for tasks that run more often than hourly)."
- Also on the page: "Seconds are rounded up to the nearest minute since cron has one-minute granularity."; "No catch-up for missed fires."; "Tasks only fire while Claude Code is running and idle."; "Recurring tasks automatically expire 7 days after creation."
- Reopened from run 1 (RT-26). The jitter rule is new in run 2.

**DC-28.** `claude -p` (headless) under an outside scheduler: it still runs on a Max subscription today. Anthropic's help article, still showing its October 7, 2026 update, says the Agent SDK and `claude -p` can still be used with subscription limits.
- Page: "Use the Claude Agent SDK with your Claude plan" (Claude Help Center, "Updated yesterday"). URL: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- Accessed: 2026-10-09. Strength: A.
- Quote: "You can still use the Claude Agent SDK, claude -p, and third-party apps with your subscription limits."
- Also on the page: "Update June 15, 2026: We've paused the previously-announced changes to Claude Agent SDK usage. For now, nothing has changed"
- Reopened from run 1 (RT-11). Unchanged.

**DC-29.** Bare mode has NOT become the default for `claude -p`. The headless page still says it "will become the default for -p in a future release", with no date. Bare mode still ignores the subscription login and the long-lived subscription token, so on the day that default changes a subscription-driven script would need an explicit setting or an API key. Anthropic's Claude Code changelog was searched for "bare": it has entries changing what `--bare` does, and no entry making it the default and no date for doing so.
- Pages: "Run Claude Code programmatically" https://code.claude.com/docs/en/headless.md ; "Authentication" https://code.claude.com/docs/en/authentication.md ; "Changelog" https://code.claude.com/docs/en/changelog.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release."
- Also on the pages: "Bare mode does not read `CLAUDE_CODE_OAUTH_TOKEN`. If your script passes `--bare`, authenticate with `ANTHROPIC_API_KEY` or an `apiKeyHelper` instead."; "generate a one-year OAuth token with `claude setup-token`".
- Reopened from run 1 (RT-06, RT-07). Unchanged.

**DC-30.** Managed Agents (Anthropic-hosted agents on the API, billed to an API key, not the subscription): still beta. Schedules go down to one minute. NEW: actual start times are jittered by up to 15 percent of the interval, at least 5 seconds and at most 9 minutes. Arithmetic, not a quote: on a 5 minute schedule that is up to 45 seconds late, and on a 1 minute schedule up to 9 seconds.
- Page: "Scheduled deployments" (Claude Platform docs, status beta). URL: https://platform.claude.com/docs/en/managed-agents/scheduled-deployments.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "to distribute load, actual execution applies jitter of up to 15% of the interval between runs, with a minimum of 5 seconds and a maximum of 9 minutes."
- Also on the page: "Maximum granularity supported is at the minute level."; "A maximum of **1,000 scheduled deployments** is supported per organization."; "Deployments can fail to trigger for a variety of reasons: for example, if the `environment` resource has been archived, or if session creation is rate-limited."
- Reopened from run 1 (RT-39). The jitter rule and the failure note are new.

**DC-31.** Managed Agents can call MCP servers, but only remote ones given by web address, with credentials held in a "vault". By default every MCP tool call PAUSES for approval ("always_ask"). The policy can be set to "always_allow", in which case the tool runs with no confirmation. So acting alone is a configuration choice there, not the default. This page does not mention claude.ai connectors. Session creation is limited to 300 requests a minute per organization.
- Pages: "MCP connector" https://platform.claude.com/docs/en/managed-agents/mcp-connector.md ; "Permission policies" https://platform.claude.com/docs/en/managed-agents/permission-policies.md ; "Managed Agents reference" https://platform.claude.com/docs/en/managed-agents/reference.md ; "Overview" https://platform.claude.com/docs/en/managed-agents/overview.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "Each toolset kind has its own default: the agent toolset defaults to `always_allow`, and MCP toolsets default to `always_ask`."
- Also on the pages: "`always_allow` | The tool executes automatically with no confirmation."; "Each server needs a `type`, a unique `name`, and a `url`."; "Create endpoints (such as agents, sessions, and environments) | 300 requests per minute"; "Claude Managed Agents is in beta. All Managed Agents endpoints require the `managed-agents-2026-04-01` beta header."
- New in run 2 (run 1 left MCP reach and triggers not verified). Memory stores reused from RT-40.

**DC-32.** Managed Agents price: token rates plus 0.08 US dollars per session-hour, counted to the millisecond and only while the session is actually running. Idle waiting is not charged.
- Page: "Pricing" (Claude Platform docs), section "Claude Managed Agents pricing". URL: https://platform.claude.com/docs/en/about-claude/pricing.md
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "Runtime is measured to the millisecond and accrues only while the session's status is `running`."
- Also on the page: "Session runtime | $0.08 per session-hour | `running` status duration"; "Web search triggered inside a session incurs the standard $10 per 1,000 searches."
- Reopened from run 1 (RT-37). Same price.

**DC-33.** Max plan usage limits: still no published number of messages, tokens, hours or routine runs. What is published is the shape (a five hour session limit, a weekly limit, a separate weekly limit for the Fable model) and the multiples (5x or 20x the Pro plan's usage per five hour session). Anthropic also reserves the right to add other caps.
- Pages: "What is the Max plan?" ("Updated yesterday") https://support.claude.com/en/articles/11049741-what-is-the-max-plan ; "Use Claude Code with your Pro or Max plan" ("Updated today") https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan ; "Pricing" https://claude.com/pricing
- Accessed: 2026-10-09. Strength: A.
- Quote: "Both Pro and Max plans have a five-hour session limit and a weekly limit. Max plans also have a separate weekly limit for Fable. These limits are shared across Claude and Claude Code"
- Also on the pages: "choose from 5x or 20x the usage of Pro per 5-hour session" (pricing page FAQ); "we may limit your usage in other ways, such as weekly and monthly caps or model and feature usage, at our discretion."
- Reopened from run 1 (RT-15, RT-16). Unchanged. What would turn this into a measurement: run the intended job on the plan for a day and read the usage meter at claude.ai/settings/usage before and after.

**DC-34.** The monthly API credit on Max plans (100 US dollars on Max 5x, 200 on Max 20x), reopened: it covers the Claude API (including the batch API), the Console playground, Managed Agents and the Agent SDK, when used with an API key from the linked Console organization. It does not cover interactive Claude Code, extra usage, or Claude on other clouds. It refreshes each billing cycle. Claiming it means accepting "Supplemental Credit Terms", which were not read in this session.
- Page: "Monthly API credits for Max and Team plans" (Claude Help Center, "Updated yesterday"). URL: https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "The credits work with any available Claude model on the Claude Platform, including: The Claude API (Messages API and Message Batches API) The Playground in the Claude Console Claude Managed Agents The Claude Agent SDK"
- Also on the page: "The credits don't apply to: Interactive Claude Code in the terminal, IDE, desktop, or web; Extra usage in Claude, Claude Code, or Claude Cowork"; table "Max 5x $100", "Max 20x $200".
- Reopened from run 1 (RT-12, RT-13). Unchanged.

**DC-35.** Current model prices per million tokens (MTok), base input / output, from Anthropic's platform pricing page today: Fable 5.1 10 / 50, Opus 5.5 4 / 20, Sonnet 5.5 2 / 10, Haiku 5.5 0.10 / 0.50 (for prompts up to 100,000 tokens). Cache prices (5 minute write / 1 hour write / cache hit): Fable 5.1 12.50 / 20 / 0.25. Opus 5.5 5 / 8 / 0.20. Sonnet 5.5 2.50 / 4 / 0.10. Haiku 5.5 0.125 / 0.20 / 0.01. The batch API is half price but is not instant, so it does not suit a 5 minute reaction.
- Page: "Pricing" (Claude Platform docs). URL: https://platform.claude.com/docs/en/about-claude/pricing.md
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "| Claude Opus 5.5 | $4 / MTok | $5 / MTok | $8 / MTok | $0.20 / MTok | $20 / MTok |" (columns: base input, 5m cache writes, 1h cache writes, cache hits and refreshes, output; table spacing removed).
- Also on the page: "| Claude Fable 5.1 | $10 / MTok | $12.50 / MTok | $20 / MTok | $0.25 / MTok | $50 / MTok |"; "| Claude Sonnet 5.5 | $2 / MTok | $2.50 / MTok | $4 / MTok | $0.10 / MTok | $10 / MTok |"; "| Claude Haiku 5.5 (for prompts up to 100,000 tokens) | $0.10 / MTok | $0.125 / MTok | $0.20 / MTok | $0.01 / MTok | $0.50 / MTok |"; "For Claude 4.6 and later models, using `inference_geo: \"us\"` applies a 1.1x pricing multiplier." (only if US-only processing is requested; the default is standard pricing).
- Reopened from run 1 (RT-36, RT-38). Same numbers, now read from the plain-text table instead of stripped HTML.

**DC-36.** Prompt cache timing, which decides whether caching helps at a 5 minute cadence: the default cache lasts 5 minutes, measured from the START of the request, and is refreshed free each time it is used. A run arriving exactly 5 minutes after the previous one started is on the edge of expiry. A 1 hour cache costs twice the base input price to write.
- Page: "Prompt caching" (Claude Platform docs). URL: https://platform.claude.com/docs/en/build-with-claude/prompt-caching.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "By default, the cache has a 5-minute lifetime. The cache is refreshed for no additional cost each time the cached content is used."
- Also on the page: "The lifetime is measured from the start of the request that writes or reads the cache entry, not from the end of its response."; "1-hour cache write tokens are 2 times the base input tokens price".

**DC-37.** ESTIMATE, not a measurement: monthly API cost of the model calls alone at a 5 minute cadence.
- Assumptions (from the brief): 78 runs a day, 21 trading days, 20,000 input tokens and 1,500 output tokens per run. Prices from DC-35. Standard (not US-only, not batch, not fast mode) pricing.
- Volume: 78 x 21 = 1,638 runs a month. Input 1,638 x 20,000 = 32.76 MTok. Output 1,638 x 1,500 = 2.457 MTok.
- WITHOUT caching (input cost + output cost = total, US dollars a month):
  - Fable 5.1: 32.76 x 10 = 327.60, plus 2.457 x 50 = 122.85, total 450.45.
  - Opus 5.5: 32.76 x 4 = 131.04, plus 2.457 x 20 = 49.14, total 180.18.
  - Sonnet 5.5: 32.76 x 2 = 65.52, plus 2.457 x 10 = 24.57, total 90.09.
  - Haiku 5.5: 32.76 x 0.10 = 3.28, plus 2.457 x 0.50 = 1.23, total 4.50.
- WITH caching. Extra assumption (mine, not from any page): 18,000 of the 20,000 input tokens are an unchanging prefix (instructions, rules, tool definitions) and 2,000 are new each run. Fresh input is then 1,638 x 2,000 = 3.276 MTok. Three cases:
  - Case B, the main cached estimate: 1 hour cache, written once a day and kept alive by each run's hit (DC-36). Writes 21 x 18,000 = 0.378 MTok at the 1 hour write price. Hits 21 x 77 x 18,000 = 29.106 MTok at the hit price. Fable 5.1: 7.56 + 7.28 + 32.76 + 122.85 = 170.45. Opus 5.5: 3.02 + 5.82 + 13.10 + 49.14 = 71.09. Sonnet 5.5: 1.51 + 2.91 + 6.55 + 24.57 = 35.54. Haiku 5.5: 0.08 + 0.29 + 0.33 + 1.23 = 1.92. (Order of terms: cache writes, cache hits, fresh input, output.)
  - Case A, best case: 5 minute cache that never expires between runs. Same as case B but writes at the 5 minute price. Fable 5.1 167.61, Opus 5.5 69.96, Sonnet 5.5 34.98, Haiku 5.5 1.89. Fragile: at exactly a 5 minute cadence with any lateness the cache has expired (DC-36).
  - Case C, worst case: the 5 minute cache has always expired, so every run pays the write price on the prefix (1,638 x 18,000 = 29.484 MTok at the 5 minute write price) and never gets a hit. Fable 5.1 524.16, Opus 5.5 209.66, Sonnet 5.5 104.83, Haiku 5.5 5.24. This is MORE than not caching at all.
- At a 1 minute cadence (390 runs a day, 8,190 a month, 163.8 MTok in, 12.285 MTok out) the uncached totals are five times larger: Fable 5.1 2,252.25, Opus 5.5 900.90, Sonnet 5.5 450.45, Haiku 5.5 22.52.
- Against the Max plan's API credit (DC-34): on Max 5x the 100 dollar credit would cover Haiku and Sonnet in every 5 minute case except Sonnet's worst case C (104.83), and would cover Opus only in the cached cases A and B. On Max 20x the 200 dollar credit would cover Opus in every case except C (209.66). The credit applies only to runs made with an API key, not to runs on the subscription login (RT-13).
- What this estimate leaves out: an agent run is usually several model calls (one per tool use), each re-reading the context, so one "run" can cost several times a single 20,000 token call; web search at 10 dollars per 1,000 searches; Managed Agents runtime (DC-38). Claude Code itself loads a large system prompt and tool list on every run, which may alone exceed 20,000 tokens.
- What would turn it into a measurement: run the real job 20 times with an API key and read the token counts from the API's usage report, then multiply.

**DC-38.** ESTIMATE, not a measurement: Managed Agents runtime charge on top of DC-37. Assumption (mine): each run is in the "running" state for 1 minute. 1,638 runs x 1 minute = 27.3 session-hours x 0.08 = 2.18 US dollars a month. At 3 minutes a run it is 6.55. The runtime charge is small next to the token cost. What would turn it into a measurement: the session's reported runtime after a real run.

**DC-39.** The Agent SDK or plain API calls with an API key on the owner's own host: nothing found on Anthropic's pages limits cadence at these volumes. The API's lowest listed rate tier ("Start tier") allows 1,000 requests a minute for Opus 5.5, Sonnet 5.5 and Haiku 5.5. One run every minute is far inside that. The limits that would bind are money (the credit balance, DC-34) and the token-per-minute caps (2,000,000 input tokens a minute for Opus 5.5 at the Start tier).
- Page: "Rate limits" (Claude Platform docs). URL: https://platform.claude.com/docs/en/api/rate-limits.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "| Claude Opus 5.5 | 1,000 | 2,000,000 | 400,000 |" (Start tier row; columns: requests per minute, input tokens per minute, output tokens per minute; table spacing removed).
- Also: the Agent SDK overview still says SDK use is under the Commercial Terms and that builders should use API key authentication (RT-04, re-read today, unchanged).

**DC-40.** GitHub Actions scheduled workflows, reopened: the shortest interval is still once every 5 minutes, runs can be delayed at busy times and queued jobs "may be dropped", and schedules run only on the default branch. The 60 day auto-disable sentence still names public repositories only.
- Page: "Events that trigger workflows", section "schedule" (GitHub Docs). URL: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Accessed: 2026-10-09. Strength: A.
- Quote: "The shortest interval you can run scheduled workflows is once every 5 minutes."
- Also on the page: "event can be delayed during periods of high loads of GitHub Actions workflow runs. High load times include the start of every hour. If the load is sufficiently high enough, some queued jobs may be dropped."; "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days."
- Reopened from run 1 (RT-57, RT-58). Unchanged. GitHub publishes no number for how late or how often dropped.

**DC-41.** GitHub Actions cost, with the rounding rule run 1 did not have: GitHub Free includes 2,000 minutes a month for private repositories, each job is rounded UP to a whole minute, and a standard 2-core Linux runner costs 0.006 US dollars a minute beyond the allowance.
- Pages: "GitHub Actions billing" https://docs.github.com/en/billing/concepts/product-billing/github-actions ; "Actions runner pricing" https://docs.github.com/en/billing/reference/actions-runner-pricing
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "GitHub rounds the minutes and partial minutes each job uses up to the nearest whole minute."
- Also on the pages: table "GitHub Free | 500 MB | 2,000 | 10 GB" (artifact storage, minutes per month, cache storage); "Linux 2-core (x64) ... $0.006".
- Arithmetic, not a quote. 78 runs a day x 21 days = 1,638 jobs a month. If every job finishes inside 1 minute: 1,638 minutes, inside the 2,000 free minutes (82 percent of them). If every job takes between 1 and 2 minutes: 3,276 minutes, which is 1,276 over, costing 1,276 x 0.006 = 7.66 US dollars a month. A 1 minute cadence cannot be scheduled at all (5 minute floor, DC-40). One long job that loops for the whole 6.5 hour session would use 390 minutes a day, 8,190 a month, which is 6,190 over, costing 37.14 US dollars a month. Whether a job can finish inside 1 minute depends on start-up time (installing Claude Code or other tools on a fresh runner each time), which is not measured here.

**DC-42.** Vercel cron, Supabase Cron and Cloudflare cron were NOT reopened. One line each from run 1 (2026-10-08): Vercel Hobby cannot do either schedule (once a day at most), Vercel Pro can do both at 20 US dollars a month (RT-45, RT-50). Supabase Cron can do both (down to every second) inside the existing Pro plan, with each job under 10 minutes and Edge Functions capped at 400 seconds (RT-53, RT-55). Cloudflare Workers cron can do both, free plan with 10 milliseconds of processor time per run or 5 US dollars a month for 30 seconds of processor time per frequent run, network waiting not counted (RT-61, RT-62).

### Part C: delay, plan by plan (question 1) and wide-universe cadence (question 2)

Method for Part C: vendor documentation was read with `curl` where the vendor serves a plain-text version, so those quotes are verbatim. Where a finding says "via fetch tool", the quote came through the summarizing fetch tool and is marked.

#### Massive (formerly Polygon.io)

**DC-43.** Massive has a "Full Market Snapshot" request that returns every U.S. stock ticker in ONE answer (the vendor says over 10,000 actively traded tickers), including the most recent minute bar, the day bar, and the last trade and quote where the plan includes them. It is not on the free plan. It is 15 minutes delayed on Stocks Starter (29 US dollars a month) and Stocks Developer (79), and real time on Stocks Advanced (199). The same page confirms today's individual plan prices.
- Page: "Full Market Snapshot" (Massive REST docs). URL: https://massive.com/docs/rest/stocks/snapshots/full-market-snapshot (plain-text version at the same address with `.md`)
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "Retrieve a comprehensive snapshot of the entire U.S. stock market, covering over 10,000+ actively traded tickers in a single response."
- Also on the page: plan table "Stocks Basic | Free | Not included", "Stocks Starter | $29/mo | 15-minute delayed", "Stocks Developer | $79/mo | 15-minute delayed", "Stocks Advanced | $199/mo | Real-time"; parameter `tickers`: "Empty string defaults to querying all tickers."; "Snapshot data is cleared daily at 3:30 AM EST and begins to repopulate as exchanges report new data, which can start as early as 4:00 AM EST."
- Arithmetic, not a quote: one request covers the whole universe, and paid plans have unlimited calls (MD-05, 2026-10-08), so about 5,000 to 6,000 symbols every minute, or every 5 minutes, is one request each time. The delay is then the plan's delay: 15 minutes at 29 or 79 dollars, none at 199. How large the answer is (in megabytes) and how long it takes to arrive were not measured. What would turn it into a measurement: time one request on a paid plan.

**DC-44.** Massive's WebSocket has a per-minute bar stream with an "all tickers" subscription (`AM.*`). It comes from a delayed server on Starter and Developer and a real time server on Advanced. So a program can also have every stock's minute bar pushed to it instead of asking.
- Page: "Aggregates (Per Minute)" (Massive WebSocket docs, stocks). URL: https://massive.com/docs/websocket/stocks/aggregates-per-minute.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "The `AM.*` value subscribes to all tickers."
- Also on the page: "| Delayed | `wss://delayed.massive.com/stocks` |", "| Real-Time | `wss://socket.massive.com/stocks` |"; plan recency "Stocks Starter | 15-minute delayed", "Stocks Developer | 15-minute delayed", "Stocks Advanced | Real-time".
- Delay and feed for Massive are reused from run 1: MD-04 (plan delays), MD-06 (direct feeds plus the SIPs, all U.S. exchanges). No Massive plan with a delay shorter than 15 minutes but not real time was seen.

#### Alpaca Market Data

**DC-45.** Alpaca's free Basic plan gives two things for stocks: real time prices from IEX only, or consolidated (SIP) prices 15 minutes delayed. Its request API offers a feed choice named `delayed_sip`, "SIP with a 15 minute delay", on the latest-price and snapshot requests. The paid Algo Trader Plus plan (99 US dollars a month) gives the real time SIP. No delay between zero and 15 minutes is offered.
- Pages: "Snapshots" API reference https://docs.alpaca.markets/reference/stocksnapshots-1.md ; "About Market Data API" https://docs.alpaca.markets/docs/about-market-data-api.md
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "- `sip`: all US exchanges - `iex`: Investors EXchange - `delayed_sip`: SIP with a 15 minute delay" (three list lines joined)
- Also on the pages: "Default: `sip` if the user has the unlimited subscription, otherwise `iex`."; "similar to the free plan all the standard plans are real time IEX or 15 mins delayed SIP."; plan table "Pricing | Free | $99 / month", "Real-time market coverage | IEX | All US Stock Exchanges", "Historical data limitation* | latest 15 minutes | no restriction", "Historical API calls | 200 / min | 10,000 / min".
- Reopened from run 1 (MD-10 to MD-13) because delay is now a variable. Prices and limits unchanged.

**DC-46.** Alpaca has a multi-symbol snapshot request (latest trade, latest quote, latest minute bar, day bar, previous day bar for each symbol in a comma-separated list). There is no "all symbols" form of it: the symbols list is required. The reference states NO maximum number of symbols per request. So the per-request cap is not verified.
- Page: "Snapshots" API reference. URL: https://docs.alpaca.markets/reference/stocksnapshots-1.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "The snapshot endpoint for multiple tickers provides the latest trade, latest quote, minute bar, daily bar, and previous daily bar data for each given ticker symbol."
- Also on the page: parameter `symbols`: "A comma-separated list of stock symbols.", "required": true.
- Arithmetic, not a quote. Paid plan, 10,000 requests a minute: even at ONE symbol per request that is 10,000 symbols a minute, so 6,000 symbols every minute fits whatever the cap is. Free plan, 200 requests a minute: 6,000 symbols a minute needs at least 30 symbols per request (6,000 / 200), and 6,000 symbols every 5 minutes needs at least 6 per request (6,000 / (200 x 5)). Whether 30 per request is accepted is not stated, so the free plan case is "probably, not verified". What would turn it into a measurement: one test request with 100 symbols on a free key.

**DC-47.** Alpaca's WebSocket accepts a wildcard: a program can subscribe to minute bars for EVERY symbol with `"bars": ["*"]`. On the free plan the stream is capped at 30 symbols (MD-12), so the wildcard is only useful on the paid plan, or on a feed the plan allows. Most accounts get one stream connection.
- Page: "Streaming market data" (Alpaca docs). URL: https://docs.alpaca.markets/docs/streaming-market-data.md
- Accessed: 2026-10-09. Strength: A.
- Quote: "You can subscribe to a particular symbol or to every symbol using the `*` wildcard."
- Also on the page: "The number of connections to a single endpoint from a user is limited based on the user's subscription, but in many subscriptions (or without one) this limit is 1."; error "405 | symbol limit exceeded".
- Not verified: whether the free plan's 30 symbol cap applies to the `v2/delayed_sip` stream, and whether a wildcard is refused or truncated on the free plan.

**DC-48.** A caution on "real time" from IEX only (Alpaca free, Tiingo): Alpaca's own docs say IEX is about 2.5 percent of market volume, and that a minute bar is only produced when there was a qualifying trade in that minute. For a thinly traded small company, IEX may print no trade for many minutes, so the "real time" IEX price can be older than a 15 minute delayed consolidated price. This is an inference from the two quoted facts, not a vendor statement.
- Pages: "Historical Stock Data" https://docs.alpaca.markets/docs/historical-stock-data-1.md ; "Market Data FAQ" https://docs.alpaca.markets/docs/market-data-faq.md
- Accessed: 2026-10-09. Strength: A (for the two facts).
- Quote: "It's a single US exchange that accounts for approximately ~2.5% of the market volume."
- Also on the pages: "So if there are no trades in the bar's interval, or if there's only a single `I` trade (which only updates the volume, but none of the prices), then no bar is generated."
- What would turn it into a measurement: for 50 Russell 2000 names, compare the age of the last IEX trade with the age of the last consolidated trade at several times of day.

#### Tradier (broker-supplied data)

**DC-49.** Tradier, delay and feed: real time from a consolidated feed of all exchanges for holders of a Tradier Brokerage account, and nothing real time for anyone else. Its test ("sandbox") environment is the same feed delayed 15 minutes. No other delay is offered.
- Page: "Market Data" (Tradier docs). URL: https://docs.tradier.com/docs/market-data
- Accessed: 2026-10-09. Strength: A.
- Quote: "Real-time data is pulled from a consolidated feed from all exchanges. Delayed data is constructed from the same feed but is delayed industry-standard 15 minutes."
- Also on the page: "If you are not a Tradier Brokerage account holder, we are unable to provide you with any real-time data solution."
- Reopened from run 1 (MD-54). Unchanged. Account cost was left to the brokers helper. The Tradier pricing page read today mentions a 10 US dollars a month "Pro" subscription and a "Lite" account, but which of them includes API market data was not established here.

**DC-50.** Tradier's limit on market data requests is 120 a minute in production (60 in the sandbox), per access token. The quotes request takes a comma-separated list of symbols. The pages read state no maximum number of symbols per request. There is no "all symbols" request.
- Pages: "Rate Limiting" https://docs.tradier.com/docs/rate-limiting ; "Get quotes for one or more symbols" https://docs.tradier.com/reference/brokerage-api-markets-get-quotes
- Accessed: 2026-10-09. Strength: A.
- Quote: "Market Data This includes resources in /markets. Production: 120 requests per minute. Sandbox: 60 request per minute."
- Also on the pages: "A comma-separated list of symbols"; "instead of polling for quotes, leverage the streaming API".
- Arithmetic, not a quote. 6,000 symbols every minute at 120 requests a minute needs 50 symbols per request (6,000 / 120), using the whole allowance. 6,000 symbols every 5 minutes needs 10 per request (6,000 / (120 x 5)). Whether 50 per request is accepted is not stated, so the 1 minute case is "possible only if large batches are allowed, not verified", and the 5 minute case needs only small batches. What would turn it into a measurement: one request with 100 symbols on a real account, and reading the rate limit headers the page describes.

#### Interactive Brokers (broker-supplied data)

**DC-51.** Interactive Brokers, what is free: real time streaming prices on all U.S.-listed stocks and ETFs from Cboe One and IEX, which the broker itself labels non-consolidated (it does not show the national best bid and offer). Consolidated real time streaming needs a paid subscription: the "US Securities Snapshot and Futures Value Bundle" is listed at 10 US dollars a month, waived when monthly commissions reach 30 dollars, and the page pairs it with a "US Equity and Options Add-On Streaming Bundle" for streaming quotes (that add-on's price was not captured). The page describes the classification "non-professional" as any individual not registered and not acting as an adviser.
- Page: "Market Data Pricing" (Interactive Brokers). URL: https://www.interactivebrokers.com/en/pricing/market-data-pricing.php
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "IBKR clients receive free real-time streaming market data on all US-listed stocks and ETFs from Cboe One and IEX. (Non-consolidated)"
- Also on the page: "Non-consolidated real-time data only provides data from some exchanges and does not show the NBBO."; table "US Securities Snapshot and Futures Value Bundle USD 10.00 USD 30.00" (fee, commissions waiver).
- New in run 2 (run 1 could not read this page).

**DC-52.** Interactive Brokers offers NO delayed U.S. stock quotes to U.S. clients. So there is no 15 minute option and no shorter-delay option there: it is real time (free partial feed or paid consolidated) or nothing.
- Page and URL: as DC-51, section "Delayed Market Data".
- Accessed: 2026-10-09. Strength: A.
- Quote: "In accordance with regulatory requirements, IBKR no longer offers delayed quotation information on U.S. equities to Interactive Brokers LLC clients."
- Also on the page: "Delayed market data is on a time lag that is usually 10-20 minutes behind real-time quotes."

**DC-53.** Interactive Brokers limits how many symbols can stream at once ("market data lines"): 100 by default, rising only with commissions or account size, plus up to 10 paid "Quote Booster" packs of 100 lines at 30 US dollars a month each. One-off snapshot quotes cost 0.01 dollars per request for U.S. stocks.
- Page and URL: as DC-51.
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "All clients initially receive 100 concurrent lines of real-time market data (which can be displayed in TWS or via the API) and always have a minimum of 100 lines of data."
- Also on the page: "purchasing monthly Quote Booster packs at USD 30.00 per pack. Each booster pack provides 100 simultaneous Level I quotes"; "Limit of 10 Quote Booster packs per account."; "US-listed equities and ETFs are USD 0.01 per request"; "IBKR clients receive up to 100 free snapshot quotes per month."; lines formula: the greater of monthly commissions divided by 8, account equity times 100 divided by 1,000,000, and 100.
- Arithmetic, not a quote. Maximum purchasable lines for a small account: 100 + 10 x 100 = 1,100 lines for 300 dollars a month, still far short of 5,000 symbols at once. Rotating 100 lines through 6,000 symbols is 60 batches per sweep, and how fast lines can be swapped was not read. Snapshots: 6,000 symbols x 0.01 = 60 dollars per sweep, so 78 sweeps a day would be 4,680 dollars a day. The page says snapshot charges are capped by an automatic upgrade to the streaming service once they equal its price, but streaming is then limited by lines again. Conclusion from the arithmetic: Interactive Brokers data suits watching a short list, not sweeping the whole universe. (Its own market scanner tools were not researched.)

#### Webull (broker-supplied data)

**DC-54.** Webull's developer API ("OpenAPI") requires a separate market data subscription for U.S. stocks, and Webull itself names it by licence type: "Nasdaq Basic (Level 1) ... for Non-Display OpenAPI usage". Subscriptions bought in the Webull app do not carry over. Nasdaq Basic is Nasdaq's own real time feed, not the SIP (that description of Nasdaq Basic is background, not sourced in this run). Without the subscription, the sandbox gives 15 minute delayed data. The price is shown only after login: gated and unverified.
- Page: "Market Data API Overview" (Webull OpenAPI docs). URL: https://developer.webull.com/apis/docs/market-data-api/overview
- Accessed: 2026-10-09. Strength: A. Price: gated and unverified (shown in the logged-in "Advanced Quotes Center").
- Quote: "Subscribe Nasdaq Basic (Level 1) or Nasdaq Totalview (Level 2) for Non-Display OpenAPI usage"
- Also on the page: "Market data subscriptions purchased through the Webull mobile app or desktop platform (QT) are independent of OpenAPI. You need a separate subscription specifically enabled for OpenAPI usage. Only one device may access LV1/LV2 data at any one time."; "the sandbox environment provides 15-minute delayed data by default."
- This also bears on question 6: a retail broker here treats a program reading prices as non-display use and sells a separate entitlement for it.

**DC-55.** Webull's stock snapshot request takes at most 100 symbols and is limited to 60 requests per 60 seconds in production (30 in the sandbox).
- Pages: "Stock Snapshot" reference https://developer.webull.com/apis/docs/reference/snapshot.md ; "Rate Limits" https://developer.webull.com/apis/docs/rate-limits
- Accessed: 2026-10-09. Strength: A.
- Quote: "List of security symbols, supports JSON array format, multiple symbols separated by commas; maximum 100 symbols per query."
- Also on the pages: rate limit table, Non-Display Solution, "Snapshot | GET | /market-data/stocks/snapshots/list | 30/60s | 60/60s" (sandbox, production). The FAQ page gives a different overall figure: "The Data API (HTTP) has a rate limit of 300 requests per 60 seconds." (see Contradictions).
- Arithmetic, not a quote: 100 symbols x 60 requests a minute = 6,000 symbols a minute. That exactly meets 6,000 symbols every minute with no headroom, and is five times what a 5 minute cadence needs.

#### Schwab (broker-supplied data)

**DC-56.** Schwab's developer portal could not be read without a browser: the page returned only its title to `curl` (35 characters of text). Delay, feed, symbols per request and rate limits for Schwab's Trader API are NOT verified. Listed first under Needs browser.
- Page: "Trader API - Individual" (Charles Schwab Developer Portal). URL: https://developer.schwab.com/products/trader-api--individual
- Accessed: 2026-10-09. Strength: A (for the title only).
- Quote: "Charles Schwab | Developer Portal"

#### Databento

**DC-57.** Databento, delay and feed: live (real time) U.S. stock data starts at the 199 US dollars a month Standard plan, with no exchange licence fees. The entry feed, "Databento US Equities Mini", is real time but is a blend of several exchanges and trading systems, not the SIP (MD-20). The vendor does not state what share of volume it covers. Databento says the Mini feed carries no licensing restrictions on non-display trading. Quotes below came via the fetch tool.
- Pages: "Pricing" https://databento.com/pricing ; "US Equities" catalog https://databento.com/catalog/us-equities ; "Databento US Equities Mini now available" https://databento.com/blog/databento-us-equities-mini-now-available ; "Equities" https://databento.com/equities
- Accessed: 2026-10-09. Strength: A. Price: published. Quotes: paraphrase by fetch tool (the tool reported these as exact strings, not confirmed with `curl`, which Databento's site refused).
- Quote: "supports commercial applications-such as external redistribution and non-display trading" (blog); "all without exchange license fees" (blog and equities page).
- Also reported from the pages: Standard "$199" "per month"; "Usage-based live data is not available for Databento US Equities."; "Subscribe to every update of every symbol on the venue, in a single API call" (equities page); "Most of our individual users use Databento US Equities Mini due to its low cost."; "20,000+" symbols.
- Wide universe: the "every symbol in a single API call" sentence indicates a whole-market subscription exists. The exact mechanism and any limit were not read (the documentation pages came back as a title only). Not verified in detail.

**DC-58.** The ONLY delay shorter than 15 minutes seen anywhere in this session: Databento's catalog page shows, for the Nasdaq TotalView-ITCH dataset (one exchange's full order book, not the consolidated feed), a release time of "Delayed 10 minutes" for historical access. Real time access to that dataset is stated to need the Plus or Unlimited plans (1,500 or 4,000 US dollars a month in licence fees). Which plan the 10 minute delayed access needs was not shown. This is not a retail "5 minute delayed" plan. It is recorded so the answer "none found" is complete.
- Page: "US Equities" catalog (Databento). URL: https://databento.com/catalog/us-equities
- Accessed: 2026-10-09. Strength: A. Quotes: paraphrase by fetch tool.
- Quote: "Delayed 10 minutes" (release time table for Nasdaq TotalView-ITCH, row "Historical"); "Real-time Nasdaq TotalView-ITCH data is included with a Plus or Unlimited subscription."
- Also reported: "publishers charge us more for real-time data than data that is delayed or received after 24 hours." (pricing page FAQ).

#### Alpha Vantage

**DC-59.** Alpha Vantage, delay: its premium plans offer two settings for U.S. stocks, real time or 15 minutes delayed, chosen by a parameter, after an "entitlement" step. No other delay exists. Without that step, quotes update only at the end of each trading day. The company describes itself as a Nasdaq-licensed provider, but the pages read still do not say which feed the real time data is (the consolidated feed or a Nasdaq-only feed).
- Pages: "API Documentation" https://www.alphavantage.co/documentation/ ; "Regulatory Policies on Realtime & 15-minute Delayed US Market Data" https://www.alphavantage.co/realtime_data_policy/
- Accessed: 2026-10-09. Strength: A.
- Quote: "by default, the quote endpoint is updated at the end of each trading day for all users. If you would like to access realtime or 15-minute delayed stock quote data for the US market, please subscribe to a premium membership plan"
- Also on the pages: parameter values "entitlement=realtime" and "entitlement=delayed" ("15-minute delayed"); "Alpha Vantage is a Nasdaq-licensed provider of realtime and 15-minute delayed US market data."
- Reopened from run 1 (MD-29, MD-30), which had read only part of the documentation page.

**DC-60.** Alpha Vantage has a bulk quote request that takes up to 100 symbols at a time (premium only).
- Page: "API Documentation", section "Realtime Bulk Quotes". URL: https://www.alphavantage.co/documentation/
- Accessed: 2026-10-09. Strength: A.
- Quote: "This API returns realtime quotes for US-traded symbols in bulk, accepting up to 100 symbols per API request and covering both regular and extended (pre-market and post-market) trading hours."
- Arithmetic, not a quote, using run 1's plan limits (MD-28): 6,000 symbols is 60 requests. The 75 requests a minute plan (49.99 US dollars a month) gives 75 x 100 = 7,500 symbols a minute, enough for a sweep every minute. Whether the bulk request is available on every premium tier or only the higher ones was not confirmed on the page.

#### Twelve Data

**DC-61.** Twelve Data, delay, feed and coverage: real time on every plan, from venues that need no exchange licence and that amount to about 5 percent of U.S. trading volume (not the SIP). It says the data covers every listed U.S. stock. Consolidated data is through sales only. The article is dated August 18, 2026.
- Page: "US equities market data" (Twelve Data help centre, August 18, 2026). URL: https://support.twelvedata.com/en/articles/9935903-us-equities-market-data
- Accessed: 2026-10-09. Strength: A.
- Quote: "This data covers the entire universe of listed US equities, including all companies listed on the NYSE, Nasdaq, and every other US exchange."
- Also on the page: "These venues collectively represent approximately 5% of total US trading volume"; "Personal, commercial, display, non-display, use (e.g., dashboards, research, automation) is covered under standard plans." (this last sentence bears on question 6).
- Reopened from run 1 (MD-24), which had not captured the coverage sentence.

**DC-62.** Twelve Data charges one credit per symbol, per minute, even inside a batch request. So the plan's credits per minute are, in effect, its symbols per minute.
- Pages: "Batch API requests" https://support.twelvedata.com/en/articles/5203360-batch-api-requests ; "Credits" https://support.twelvedata.com/en/articles/5615854-credits
- Accessed: 2026-10-09. Strength: A.
- Quote: "Although only one request is made, each symbol consumes one API credit, so this call uses three credits."
- Also on the pages: "API credits reset every minute"; "Data Weight x Number of Symbols = Credits Used per Endpoint per Minute".
- Arithmetic, not a quote, using run 1's plan limits (MD-25, MD-23): 6,000 symbols every minute needs 6,000 credits a minute, more than the top individual plan (Ultra, 2,584 plus a minute, 999 US dollars a month). 6,000 symbols every 5 minutes needs 1,200 credits a minute, which only Ultra covers (Pro at 229 dollars has 610 plus a minute, about 3,050 symbols per 5 minutes). So Twelve Data is an expensive way to sweep the universe, and the prices it would sweep are a 5 percent slice of trading.

#### EODHD

**DC-63.** EODHD's request API for current prices is delayed 15 to 20 minutes for stocks (its real time product is a separate WebSocket, one exchange, 50 symbols, MD-44). It has a bulk form: ONE request returns the latest delayed price for every U.S. ticker, about 18,000 rows, at a cost of 100 API calls.
- Pages: "Live (Delayed) OHLCV Stock Prices API" https://eodhd.com/financial-apis/live-realtime-stocks-api ; "Bulk for Live OHLCV Stock Prices API (US Exchanges Only)" https://eodhd.com/financial-apis/bulk-for-live-ohlcv-stock-prices-api-us-exchanges-only
- Accessed: 2026-10-09. Strength: A.
- Quote: "One ex=US request returns all US-listed tickers in a single response, currently around 18,000 rows."
- Also on the pages: "Prices are delayed: 15-20 minutes for stocks and about 1 minute for forex."; "refreshed about once a minute"; "Each ex=US request consumes 100 API calls, compared with 1 call for a single-symbol quote."; "Coverage: US exchanges only (NYSE and NASDAQ)."
- Arithmetic, not a quote, using run 1's limit of 100,000 calls a day on paid plans (MD-43): 78 sweeps a day x 100 = 7,800 calls. 390 sweeps a day x 100 = 39,000 calls. Both fit. Which paid plan includes this request was not confirmed today (run 1 lists the plans, MD-43). So EODHD can sweep the whole U.S. market every minute cheaply, but always 15 to 20 minutes behind.

#### Tiingo, Intrinio and other vendors (shorter entries)

**DC-64.** Tiingo: its IEX request can return every ticker in one answer when no ticker is named, and the page cites 14,000 plus tickers. The data is real time but IEX only (MD-33), and the full IEX feed needs the user's own signed agreement with IEX, otherwise Tiingo serves a "derived reference price" (MD-34). Quotes via the fetch tool (Tiingo's page returned nothing to `curl`).
- Page: "IEX" endpoint docs (Tiingo). URL: https://www.tiingo.com/documentation/iex
- Accessed: 2026-10-09. Strength: A. Quotes: paraphrase by fetch tool.
- Quote: "To request top-of-book/last for all tickers, use the following REST endpoint" (followed on the page by https://api.tiingo.com/iex)
- Also reported: "14,000+ tickers IEX provides quotes and trade data on"; "To receive the FULL TOPS Feed, you must now have a market data agreement signed with the IEX Exchange."
- Arithmetic, not a quote, using run 1's limits (MD-32): the 30 US dollars a month Power plan allows 10,000 requests an hour. One all-ticker request every minute is 60 an hour. So a whole-universe sweep every minute fits, but of IEX-only prices (see the caution in DC-48).

**DC-65.** Intrinio: its 15 minute delayed SIP feed is an Enterprise-plan product through sales, with a stated 250 US dollars a year administration fee plus 250 dollars a month if the data is displayed. Its page also names a Cboe One feed described as delayed with a 15 minute lag. No shorter delay is offered. Quotes via the fetch tool.
- Page: "15 Minute Delayed SIP Data API" (Intrinio). URL: https://intrinio.com/financial-market-data/stock-prices-delayed-sip
- Accessed: 2026-10-09. Strength: A. Price: gated and unverified for the subscription itself ("Talk to our sales team"); the two fees are published. Quotes: paraphrase by fetch tool.
- Quote: "There is a $250/year admin fee plus an additional $250/mo fee if you need to display the data."
- Also reported: "The data updates continuously but with a 15-minute delay."; "This data feed is available exclusively with our Enterprise plan."; coverage "100% of US equity volume"; "Real-time SIP exchange fees typically range from $10,000-$20,000 per month." (the vendor's own figure for businesses, not a quote from an exchange).

**DC-66.** Finazon (a vendor not in run 1): its public page advertises real time SIP data (all 16 U.S. exchanges, 100 percent of volume) for non-professional individuals "from $4 monthly", and says a non-professional individual signs no agreement and needs no licence. CAUTION: the address for that dataset's own page (`/dataset/sip_non_pro`) redirected today to the page for a different product (US Equities Basic, a derived IEX feed with 3 to 5 percent of volume), which raises doubt about whether the SIP product is still sold. Plan tiers, request limits and whether a whole-market snapshot exists were not captured. Treat the 4 dollar figure as a published claim that needs a browser check before it is relied on.
- Pages: "US Stock Market Data API" https://finazon.io/featured-datasets/us-stocks-market-data ; redirect observed from https://finazon.io/dataset/sip_non_pro to https://finazon.io/dataset/us_stocks_essential
- Accessed: 2026-10-09. Strength: A. Price: published (as a "starts at" figure), with the doubt above.
- Quote: "Prices start at $4 monthly for Non-Professional, individual use. For Professional, commercial usage, prices begin at $2,000 a month plus exchange fees"
- Also on the pages: "If you're a Non-Professional individual, you don't have to sign any agreements or obtain a license."; "Real-time and historical prices, company info, news for Stocks and ETFs from all 16 US exchanges. 100% market volume."; on the Basic page: "US Equities Basic is based upon a derived IEX feed. The volume coverage is 3-5% of the total trading volume in North America".

**DC-67.** Other vendors checked briefly (all via the fetch tool, so quotes are "paraphrase by fetch tool"; none offers a delay shorter than 15 minutes that is not real time):
(a) marketdata.app: 15 minute delayed quotes for non-professional users who sign the UTP agreement, otherwise one day old; "Real-time quotes are not currently available." Multi-symbol quotes request, cap not stated, 1 credit per symbol. Prices not on the page read. URL: https://www.marketdata.app/docs/api/stocks/quotes/
(b) Marketstack: Free 0, Basic 9.99, Professional 49.99, Business 149.99 US dollars a month. U.S. intraday data is IEX, "licensed and sourced from Tiingo, Inc.", so it is the Tiingo IEX feed resold. URL: https://marketstack.com/product
(c) StockData.org: Free 0, Basic 29, Standard 49, Pro 99, Pro 50K 199 US dollars a month. 3 to 100 symbols per price request and 100 to 50,000 requests a DAY. The page does not say whether quotes are real time or delayed, or name a feed. Arithmetic: Pro at 100 symbols and 25,000 requests a day could sweep 6,000 symbols (60 requests) about 416 times a day. URL: https://www.stockdata.org/pricing
(d) Public (broker API): the quotes request "Returns real-time market quotes for a set of instruments." Feed, per-request cap, rate limit and cost not stated on the page. URL: https://public.com/api/docs/resources/market-data/get-quotes
(e) Unusual Whales: "All API plans include real-time data." No price and no feed stated on the page read. URL: https://unusualwhales.com/pricing
(f) ThetaData: the pricing page read lists options plans only (40, 80, 160 US dollars a month). Stock data terms were not on it. URL: https://www.thetadata.net/pricing
- Accessed: 2026-10-09. Strength: A (each is the vendor's own page). Prices: published where given.

**DC-68.** Not readable in this session, so delay and limits remain NOT verified: Finnhub (pricing page returned only a tagline, again), Financial Modeling Prep (HTTP 403, again), Schwab (DC-56), TradeStation (the page read was a general overview, the rate limit page was not opened), tastytrade (the address redirected and the new page was not opened), Insight Sentry (HTTP 404 on the guessed pricing address), and Robinhood, Benzinga, Xignite and QuoteMedia (not attempted, for lack of room). Run 1's third-party figures for Finnhub and FMP (MD-36, MD-40, MD-41) stand as the only information, at strength C and D.
- Pages tried: https://finnhub.io/pricing ; https://site.financialmodelingprep.com/developer/docs/pricing ; https://api.tradestation.com/docs/fundamentals/http-requests/ ; https://developer.tastytrade.com/streaming-market-data/ ; https://insightsentry.com/pricing
- Accessed: 2026-10-09. Strength: not applicable (no content read).
- Quote (Finnhub, the only text returned): "Real-time stock prices, Company fundamentals, Estimates, and Alternative data."

### Part D: where the 15 minute delay comes from, and licensing for a program (questions 1 and 6)

Method for Part D: the CTA and UTP documents are PDFs. Each was downloaded to the session's temporary scratch folder (outside the repository) and its text was read with the Mac's built-in PDF framework, with nothing installed. The quotes are therefore the documents' own words.

**DC-69.** The 15 minute delay is set by the consolidated tape plans themselves. For stocks listed on the NYSE and other non-Nasdaq exchanges (the CTA plan, "Network A" and "Network B"), the plan's policy says the delay period is 15 minutes after the markets first make the information available. Delayed data gets lighter contract terms and fewer fees: no per-device display fees apply to delayed services, for professionals or non-professionals. That is why vendors can sell or give away 15 minute delayed data cheaply.
- Page: "Delayed Market Data (Network A and Network B) Policy" (CTA Plan, dated February 2016, 6 pages). URL: https://www.ctaplan.com/publicdocs/ctaplan/Policy_Delayed_Market_Data.pdf (listed at https://www.ctaplan.com/policy with the date 23 Feb 2016)
- Accessed: 2026-10-09. Strength: A.
- Quote: "The delay period for converting last sale and quotation information into Delayed Last Sale Information and Delayed Quotation Information is 15 minutes after the markets first make the information available."
- Also in the document: "At present, display unit fees do not apply in respect of a Delayed Information interrogation or ticker display service, whether the Vendor provides that service to professional subscribers or nonprofessional subscribers."; the agreement defines delayed information as data "delayed for such period as NYSE ... specifies on 60 days' written notice", so the period is the plan's to set and nothing in the document provides for a shorter preferential delay.

**DC-70.** For Nasdaq-listed stocks (the UTP plan) the rule is the same: the "Delay Interval" is 15 minutes, anything sent before that is real time, and there is no charge for delayed data on products where the vendor controls display and access. Together with DC-69 this explains why no vendor was found selling a "5 minute delayed" plan: under both plans, data less than 15 minutes old is real time data and carries real time fees and paperwork.
- Page: "Data Policies" (UTP Plan, "Published September 2023", 32 pages), section "Delayed Data Policy". URL: https://www.utpplan.com/DOC/Datapolicies.pdf
- Accessed: 2026-10-09. Strength: A.
- Quote: "Delay Interval: A period of time after which Information becomes Delayed Information. For UTP Information, the Delay Interval is 15 minutes."
- Also in the document: "Real-Time Information Information disseminated prior to the 15-minute Delay Interval."; "Vendors are permitted to delay UTP Information and there is no charge for UTP Delayed Information distributed on Controlled Products, if delayed for the appropriate timeframe."
- Note: the last sentence of the claim ("this explains why") is my inference from the two documents, not a statement in either.

**DC-71.** The CTA plan's definition of non-display use, and its examples, plainly describe what a trading program does: any trading, automated order generation, price referencing for algorithmic trading, investment analysis. BUT the policy is written about REAL TIME data and about "data-feed" recipients. It does not apply to delayed data, and the declaration it requires is from anyone who "receives a real time CTA Market Data data-feed".
- Page: "CTA Market Data Non-Display Use Policy" (CTA Plan, dated 1 Nov 2015, 2 pages). URL: https://www.ctaplan.com/publicdocs/ctaplan/Policy_CTA_Non_Display_with_FAQ.pdf
- Accessed: 2026-10-09. Strength: A.
- Quote: "Non-Display Use of real-time CTA Market Data means accessing, processing or consuming CTA Market Data, whether delivered via direct and/or redistributor data feeds, for a purpose other than in support of data recipient's display or further internal or external redistribution."
- Also in the document: examples "Any trading in any asset class", "Automated order or quote generation and/or order pegging", "Price referencing for algorithmic trading", "Investment analysis"; "Category 1 applies when a data recipient's Non-Display Use of real time CTA Market Data is on its own behalf."; "Any data recipient that receives a real time CTA Market Data data-feed is required to complete and submit the Non-Display Use declaration."
- What it does not address: whether an individual non-professional who receives prices through a retail vendor's or broker's API is a "data-feed recipient" for this purpose. The two-page policy has no sentence on individuals.

**DC-72.** The UTP plan is more explicit on both sides. (1) Its non-display fees "apply only to Vendors that receive a Data Feed containing Real-Time UTP Information", at 3,500 US dollars a month per firm for use on its own behalf, with the same examples (automated order generation, algorithmic trading, investment analysis). (2) It classes an API as an "Uncontrolled Product", which normally needs prior written approval, but then makes a specific exception: a recipient of an uncontrolled product who qualifies as a non-professional may be reported and charged at the non-professional rate, limited to one subscriber and no redistribution.
- Page: "Data Policies" (UTP Plan, Published September 2023), sections "Uncontrolled Product", "Usage Fees: Non-Display" and "Non-Display Policy". URL: https://www.utpplan.com/DOC/Datapolicies.pdf
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "If an Uncontrolled Product Recipient qualifies as a Nonprofessional, the Subscriber may be reported as a Nonprofessional Subscriber, and may be charged the Nonprofessional rates."
- Also in the document: "Non-Display Use fees apply only to Vendors that receive a Data Feed containing Real-Time UTP Information."; uncontrolled product examples "Data Feed", "Retransmission Data Feed", "Application Program Interface ['API']"; "No redistribution is permitted by such Subscribers, and use is restricted to one Subscriber."; own-behalf non-display fee "$3,500/month per firm"; "Per the Subscriber Agreement, 'For Non-Professional Subscribers, the Information is licensed only for personal use.'"; "'Subscriber' is defined as a device or computer terminal or an automated service which is entitled to receive Information."
- What it does and does not address: for Nasdaq-listed stocks this is the closest thing found to an answer. It says a non-professional individual can receive an API product at non-professional rates. It does not say in one sentence that such an individual's own trading program is exempt from the non-display fee. The fee section is worded about "Vendors" and "firms". Reading the two together as "an individual's personal program is charged as a non-professional subscriber, not as a non-display firm" is my inference, and should be confirmed with the vendor chosen.

**DC-73.** Who counts as non-professional under the CTA plan: a natural person receiving data "solely for his/her personal, non-business use" who is not a securities professional (not registered with a regulator or exchange, not an investment adviser, not doing such work for an exempt organisation). An account in an organisation's name is professional even if the use is personal. The CTA fee schedule lists the non-professional subscriber charge at 1 US dollar a month per network (charged to the vendor).
- Pages: "Nonprofessional Subscriber Policy" (CTA Plan, listed with the date 28 Nov 2016) https://www.ctaplan.com/publicdocs/ctaplan/Policy_Non-Professional_Subscribers_CTA.pdf ; "Schedule of Market Data Charges" (CTA Plan, listed with the date 1 Jan 2015) https://www.ctaplan.com/publicdocs/ctaplan/Schedule_of_Market_Data_Charges.pdf
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote: "'Nonprofessional Subscriber' refers to any natural person who receives market data solely for his/her personal, non-business use and who is not a 'Securities Professional,'"
- Also in the documents: "if the market data is received through an organization's account, this individual is classified as a Professional Subscriber"; "B. Nonprofessional Subscriber Charges (per month per subscriber) Network A: $1.00 Network B: $1.00"; non-display footnote "It does not apply to the creation and use of derived data." The schedule's non-display fee amounts could not be read reliably from the extracted table (the columns came out jumbled), so no CTA non-display amount is recorded.
- Bearing on stack choice: if the owner ever trades through a company or trust account, the non-professional rates (and every retail data plan that depends on them) may stop applying. Whether trading for profit for one's own account is "personal, non-business use" is not addressed in the part of the policy read.

**DC-74.** How retail vendors and brokers actually treat a program reading prices, from pages read in this session (a summary of findings above plus run 1):
(a) Webull sells a separate subscription named for "Non-Display OpenAPI usage" (DC-54). Price gated.
(b) Twelve Data says "non-display" use, with "automation" as an example, is covered under standard plans, on its unlicensed 5 percent feed (DC-61).
(c) Databento says its Mini feed supports "non-display trading" with no exchange licence fees, on its blended feed (DC-57).
(d) Finazon says a non-professional individual needs no agreement or licence for its SIP product (DC-66, with the doubt recorded there).
(e) Massive's individual terms say data is "strictly for display use only" and bar "non-display use" unless licensed (MD-15, 2026-10-08). Not reopened. Still unresolved, and still a question to put to Massive in writing.
(f) Alpaca, Tradier, Schwab and Interactive Brokers: their market data agreements were NOT read in this session (see Not verified). Interactive Brokers' pricing page states the non-professional definition and says data lines "can be displayed in TWS or via the API" (DC-53), with no separate API fee mentioned on that page.
- Accessed: 2026-10-09 for (a) to (d) and (f). Strength: A.
- What this shows: the consolidated-feed vendors differ. Vendors on their own unlicensed feeds (b, c) state plainly that programs are allowed. For consolidated real time data the answer depends on each vendor's contract, and only Webull and Massive were seen addressing it in words.

**DC-75.** A PENDING rule change bears directly on question 6. The consolidated tape plans are being replaced by one plan (the "CT Plan"), and its proposed fee schedule, published by the SEC on April 3, 2026, would define professional and non-professional by USE rather than by the person's status. Professional use would be use by or for an entity, or use by an individual to provide a service to someone else for pay. Everything else would be non-professional. The notice says this is meant to end the question of whether "an individual trading for their own account" is a professional. The proposal keeps the 15 minute delay. It was not approved as of the notice: the SEC had opened proceedings to decide whether to approve or disapprove it. Whether it has been decided since April 2026 was not checked.
- Page: "Joint Industry Plan; Notice of Filing of Amendment No. 1, and Order Instituting Proceedings ... to Adopt a Fee Schedule" (SEC Release No. 34-105125, File No. 4-757, Federal Register Vol. 91, No. 64, April 3, 2026, starting page 17026). URL: https://www.govinfo.gov/content/pkg/FR-2026-04-03/pdf/2026-06463.pdf
- Accessed: 2026-10-09. Strength: A.
- Quote: "Professional use would be defined as: (i) any use of market data by or on behalf of any entity ... or (ii) use of market data by an individual to provide a service to a third party for compensation." (the bracketed list of entity types shortened with ...)
- Also in the document: "Usage will be considered Non-Professional if it does not fall within the above categories."; "The Operating Committee believes these proposed definitions eliminate the burden on data subscribers of determining whether an individual trading for their own account is a Professional due to regulatory registration."; "The delay period for converting real-time information into Delayed Data is 15 minutes after the information is first made available."; current non-professional charge "$1 on each of Tapes A, B, and C", proposed sliding scale from $1 down to $0.25 per individual; the proposal would also make "the creation of Derived Data" part of non-display use for firms.
- Also read: a comment letter from Fidelity dated April 24, 2026 on the same file, which describes the proposal as classifying subscribers "based on their use of SIP data, rather than their employment status". URL: https://www.sec.gov/comments/4-757/4757-760189-2337098.pdf (strength B as commentary on the proposal).
- What it does and does not address: it addresses who is professional. The passages read do not say in one sentence whether a non-professional individual's own program counts as fee-liable "non-display use". The non-display passages read speak of broker-dealers, vendors and firms.

#### Universe coverage statements (question 3), one line each

**DC-76.** Coverage of U.S. stocks by price data, for the seven vendors run 1 left not verified:
(a) Twelve Data: "the entire universe of listed US equities, including all companies listed on the NYSE, Nasdaq, and every other US exchange" (DC-61). Verified, strength A.
(b) Tiingo: "14,000+ tickers IEX provides quotes and trade data on" for its intraday IEX data (DC-64, via fetch tool). Verified for IEX intraday, strength A. No statement of which exchanges' listings that spans.
(c) EODHD: "Coverage: US exchanges only (NYSE and NASDAQ)" and "around 18,000 rows" for its all-U.S. delayed request (DC-63). Verified, strength A. (NYSE American and NYSE Arca listings are not named. Whether "NYSE" is used loosely to include them is not stated.)
(d) Intrinio: "100% of US equity volume" for its delayed SIP feed (DC-65, via fetch tool). Verified as a volume statement, strength A. No symbol count.
(e) Alpha Vantage: no coverage sentence found beyond "US-traded symbols" on the bulk quotes request (DC-60). Not verified.
(f) Finnhub: not verified (site unreadable, DC-68).
(g) Financial Modeling Prep: not verified (HTTP 403, DC-68).
- Accessed: 2026-10-09.

<!-- FINDINGS-END -->

## 2. Summary tables

Built only from the findings above and from reused run 1 findings. DC = found today (2026-10-09). MD and RT = run 1 (2026-10-08). "NV" = not verified. Prices are US dollars a month for an individual. "Sweep" means getting a current price or latest minute bar for about 5,000 to 6,000 symbols. The arithmetic behind each "yes" or "no" is in the cited finding.

### Table (a): delay, feed and wide-universe sweeps, one row per plan

Plain answer to the brief's question: NO plan was found whose delay is less than 15 minutes but not real time. The one sub-15-minute figure seen (10 minutes, Databento, a single exchange's order book feed on an institutional plan, DC-58) is not a retail option. The reason is structural: both consolidated tape plans define anything younger than 15 minutes as real time (DC-69, DC-70).

| Vendor and plan | Price | Delay | Feed | Sweep every 1 minute | Sweep every 5 minutes |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Massive Stocks Basic | 0, published (MD-03) | End of day (MD-04) | All U.S. exchanges (MD-06) | No: 5 calls a minute, no snapshot (MD-05, DC-43) | No (same) |
| Massive Stocks Starter | 29, published (DC-43) | 15 minutes (DC-43) | Direct feeds plus the SIPs (MD-06) | Yes: one whole-market request, or the all-ticker minute bar stream (DC-43, DC-44) | Yes |
| Massive Stocks Developer | 79, published (DC-43) | 15 minutes (DC-43) | Same (MD-06) | Yes (DC-43, DC-44) | Yes |
| Massive Stocks Advanced | 199, published (DC-43) | Real time (DC-43) | Same (MD-06) | Yes (DC-43, DC-44). Licence wording for a program unresolved (MD-15, DC-74) | Yes |
| Alpaca Basic | 0, published (DC-45) | Real time from IEX only, OR 15 minutes delayed SIP (DC-45) | IEX is about 2.5 percent of volume (DC-48). Delayed feed is the SIP | Probably: needs 30 or more symbols per request at 200 requests a minute, cap NV (DC-46). Stream capped at 30 symbols (MD-12) | Probably: needs 6 or more per request (DC-46) |
| Alpaca Algo Trader Plus | 99, published (DC-45) | Real time (DC-45) | SIP, all U.S. exchanges, 100 percent of volume (MD-11) | Yes: 10,000 requests a minute, or the all-symbol minute bar stream (DC-46, DC-47) | Yes |
| Tradier brokerage account | Account cost NV (DC-49) | Real time. Sandbox 15 minutes (DC-49) | Consolidated, all exchanges (DC-49) | Only if 50 symbols per request is accepted, cap NV (DC-50) | Yes if 10 per request is accepted (DC-50) |
| Interactive Brokers, free data | 0 with an account (DC-51) | Real time (DC-51). No delayed U.S. stock data at all (DC-52) | Cboe One and IEX, non-consolidated (DC-51) | No: 100 streaming lines by default (DC-53) | No (DC-53) |
| Interactive Brokers, paid bundle | 10, waived at 30 of commissions, plus a streaming add-on of unverified price (DC-51) | Real time (DC-51) | Consolidated (Networks A, B, C) (DC-51) | No: lines cap, at most 1,100 with 300 a month of boosters. Snapshots cost 0.01 each (DC-53) | No (DC-53) |
| Webull OpenAPI with Nasdaq Basic "non-display" subscription | Gated and unverified (DC-54) | Real time. Sandbox 15 minutes (DC-54) | Nasdaq Basic, not the SIP (DC-54) | Just: 100 symbols x 60 requests = 6,000 a minute, no headroom (DC-55) | Yes (DC-55) |
| Schwab Trader API | NV (DC-56) | NV | NV | NV | NV |
| Databento Standard | 199, published (DC-57, MD-18) | Real time (DC-57) | "US Equities Mini", a blend of several venues, not the SIP, share of volume not stated (DC-57, MD-20) | Probably yes: "every symbol ... in a single API call", mechanism NV (DC-57) | Probably yes (DC-57) |
| Databento Plus or Unlimited | 1,500 or 4,000 licence fees, annual contract (MD-18) | Real time. One dataset shows "Delayed 10 minutes" for historical access (DC-58) | Exchange direct feeds (MD-20) | NV | NV |
| Twelve Data Grow, Pro, Ultra | 79, 229, 999, published (MD-23) | Real time (DC-61) | Venues with about 5 percent of volume, not the SIP (DC-61) | No on any individual plan: needs 6,000 credits a minute (DC-62) | Only Ultra at 999 (DC-62) |
| Alpha Vantage premium | 49.99 to 249.99, published (MD-28) | Real time or 15 minutes, after an entitlement step. End of day without it (DC-59) | Not stated. "Nasdaq-licensed" (DC-59) | Yes on paper: 100 symbols per request x 75 requests a minute = 7,500 (DC-60) | Yes on paper (DC-60) |
| Tiingo Power | 30, published (MD-32) | Real time (MD-33) | IEX only, full feed needs the user's own IEX agreement (MD-33, MD-34) | Yes: one all-ticker request (DC-64). IEX-only caution (DC-48) | Yes |
| EODHD paid plans | 19.99 to 99.99, published (MD-43). Which plan includes the bulk request NV | 15 to 20 minutes on the request API (DC-63). Real time WebSocket is one exchange, 50 symbols (MD-44) | Request API feed not stated. WebSocket is Cboe EDGX (MD-44) | Yes, delayed: one request, about 18,000 rows, 100 calls (DC-63) | Yes, delayed (DC-63) |
| Intrinio delayed SIP | Gated and unverified, Enterprise plan through sales, plus 250 a year admin fee (DC-65) | 15 minutes (DC-65) | SIP (DC-65) | NV | NV |
| Finazon SIP non-professional | "from 4", published claim with doubt (DC-66) | Real time claimed (DC-66) | SIP claimed (DC-66) | NV | NV |
| marketdata.app | NV | 15 minutes with a signed UTP agreement, else one day. No real time (DC-67) | NV | NV | NV |
| Marketstack | 0, 9.99, 49.99, 149.99, published (DC-67) | NV in minutes | IEX via Tiingo (DC-67) | NV | NV |
| StockData.org Pro | 99, published (DC-67) | Not stated (DC-67) | Not stated (DC-67) | Narrowly, on paper: 390 sweeps x 60 requests = 23,400 of the 25,000 requests a day. Delay unknown, so of little use (DC-67) | Yes on paper, delay unknown (DC-67) |
| Finnhub | NV. Third parties: free tier, 60 calls a minute (MD-36) | NV | NV | NV | NV |
| Financial Modeling Prep | NV. Third parties: about 22 to 149 (MD-40) | NV | NV | NV. Third party: 300 to 3,000 calls a minute (MD-41) | NV |

Lowest published price found for REAL TIME data that can sweep about 5,000 symbols, by feed type:
- Full consolidated feed (SIP): Alpaca Algo Trader Plus at 99 (DC-45, DC-46, DC-47). Massive Advanced is 199 (DC-43). Tradier is consolidated real time with a brokerage account, cost and batch size not verified (DC-49, DC-50). Finazon advertises "from 4" but the product page redirected, so it is not counted until checked (DC-66).
- Partial feeds: Tiingo Power at 30 (IEX only, DC-64). Alpaca Basic at 0 (IEX only, batch size not verified, DC-46). Databento Standard at 199 (blended, DC-57).
- 15 minute delayed consolidated: Alpaca Basic at 0 (`delayed_sip`, batch size not verified, DC-45, DC-46). Massive Starter at 29 with a one-request whole-market snapshot (DC-43).

### Table (b): ways of running, at 78 runs a day (every 5 minutes) and 390 runs a day (every minute)

| Way of running | Smallest interval | 78 runs a day | 390 runs a day | Cost |
| :-- | :-- | :-- | :-- | :-- |
| Claude Code cloud routine, own schedule | 1 hour (DC-21) | No | No | Inside the Max plan (RT-14) |
| Claude Code cloud routine, started by an outside caller through its API trigger | No floor stated. Caps: 30 an hour per routine, 100 an hour per account, no daily cap found (DC-22) | Allowed by the caps (12 an hour). Needs something outside to send the call every 5 minutes. Experimental (DC-23). Plan usage NV (DC-33) | Only with two or more routines (60 an hour against 30 per routine) (DC-22). Plan usage NV | Inside the Max plan. Runs stop at the usage limit unless paid overage is on (DC-24). No permission prompts (DC-24) |
| Claude Code desktop scheduled task | 1 minute, started "a few minutes" late by design (DC-25) | Possible only with the Mac awake and lid open. Lateness is a large share of 5 minutes. Overlapping runs are skipped (DC-25, DC-26) | Not credible: the built-in delay exceeds the interval (DC-25) | Inside the Max plan |
| `/loop` in an open session | 1 minute, up to half the interval late (DC-27) | Possible while the session stays open and idle. Up to 2.5 minutes late. Expires after 7 days (DC-27) | Up to 30 seconds late. Same limits (DC-27) | Inside the Max plan |
| `claude -p` under cron, launchd or similar | Whatever the scheduler allows (RT-05) | Yes mechanically. Runs on the Max plan today (DC-28). Bare mode default is announced with no date (DC-29) | Yes mechanically. Plan usage NV (DC-33) | Max plan limits, or API rates with a key (DC-37). Host needed (see last rows) |
| Claude Managed Agents (beta) | 1 minute, jitter up to 15 percent of the interval (DC-30) | Yes. Up to 45 seconds late (DC-30) | Yes. Up to 9 seconds late (DC-30) | ESTIMATE: tokens per DC-37 (about 1.89 to 170.45 a month cached in cases A and B, 4.50 to 450.45 uncached, up to 524.16 in worst case C, by model) plus about 2 to 7 a month runtime (DC-38). API credit of 100 or 200 applies (DC-34) |
| Agent SDK or API with a key on own host | Whatever the host's scheduler allows. API limit 1,000 requests a minute (DC-39) | Yes | Yes | ESTIMATE: tokens per DC-37, five times more at 1 minute. Plus the host |
| GitHub Actions schedule (Free, private repository) | 5 minutes, can be late or dropped (DC-40) | Yes in principle, timing not guaranteed. 1,638 jobs a month: free if each is under 1 minute, about 7.66 if 1 to 2 minutes (DC-41) | No by schedule. One looping job per session: about 37.14 a month (DC-41) | 0 to about 8 at 5 minutes. Plus Claude cost if Claude runs inside it (RT-29) |
| Vercel cron, Hobby | Once a day (RT-45) | No | No | 0 |
| Vercel cron, Pro | 1 minute (RT-45) | Yes | Yes | 20 (RT-50). Each run capped at 800 seconds (RT-46) |
| Supabase Cron (existing Pro plan) | 1 second (RT-55) | Yes | Yes | Inside the existing plan, or about 10 for a second project (RT-51, RT-52). Functions capped at 400 seconds and 2 seconds of processor time (RT-53) |
| Cloudflare Workers cron | 1 minute (RT-62) | Yes | Yes | 0 with 10 milliseconds of processor time per run, or 5 with 30 seconds (RT-61, RT-62) |
| Small always-on server | Whatever is installed on it (NV from a quoted page, RT table) | Yes (inference, RT-64 to RT-68) | Yes (inference) | About 2.19 to 7 (RT-64 to RT-68) |
| The owner's Mac with launchd or cron | Any, while awake (RT-70) | Only while awake with the lid open (RT-70, RT-71) | Same | 0 |

Note on what the rows mean. The last five rows are only a clock: they can start software that the owner's own code runs with no model call at all, or start a Claude call. A design where ordinary code sweeps prices every minute and calls Claude only when something needs judgment would use far fewer than 78 model runs a day. That design choice is outside this file's scope and is noted only because the cost column depends on it.

### Table (c): Anthropic terms, exact quotes

| Document | Version | Exact quote | What it does and does not address |
| :-- | :-- | :-- | :-- |
| Usage Policy, in force today (DC-02, DC-03, DC-04) | Effective September 15, 2025 | "When using our products or services to provide advice, recommendations, or in subjective decision-making directly affecting individuals or consumers, a qualified professional in that field must review the content or decision prior to dissemination or finalization." | Addresses advice, recommendations and decisions in "Finance: Use cases related to financial decisions, including investment advice". The section says it applies to "specific consumer-facing use cases". Does not mention executing trades, personal use, or a user who is the only person affected. Does not define "qualified professional". |
| Usage Policy, in force today (DC-05) | Effective September 15, 2025 | "Agentic use cases must still comply with the Usage Policy." | Says agents are not exempt. Adds nothing specific to trading. |
| Usage Policy, next version (DC-06) | Effective November 12, 2026 | "Finance - a personalized recommendation to buy, sell, hold, or allocate among specific investment products, such as securities, funds, digital assets, or annuities" | Defines the finance high-risk item as a recommendation. Names digital assets. Does not use the words transaction, trade, order or execute. |
| Usage Policy, next version (DC-07) | Effective November 12, 2026 | "A qualified person must meaningfully review a High-risk AI Recommendation, with the authority to change or modify it, before it is delivered as advice to an individual who might rely on it or before it is used to implement a decision." | The phrase "before it is used to implement a decision" is the only text that reaches acting on a recommendation. Does not say whether the user reviewing their own agent's output satisfies it. |
| Usage Policy, next version (DC-08) | Effective November 12, 2026 | "A qualified person is someone with the training or experience to evaluate the output in that field, and who holds a license where applicable law requires one for the underlying activity." | Defines qualified person. Does not say whether an individual managing their own money has "the training or experience". |
| Usage Policy, next version (DC-10) | Effective November 12, 2026 | "Carrying out a decision a person has already made, or applying a fixed rule, formula, or algorithm where the model exercises no judgment about the individual." | A listed exclusion. Addresses rule-following and carrying out a person's prior decision. Does not say whether an agent choosing trades inside pre-set limits counts as "a decision a person has already made". |
| Usage Policy, next version (DC-10) | Effective November 12, 2026 | "Internal drafting, research, summarization, or analysis that is not the ultimate High-risk AI Recommendation delivered." | A listed exclusion. Addresses research that feeds a human decision. |
| Usage Policy, next version (DC-11) | Effective November 12, 2026 | "Users are responsible for ensuring that agents they build or deploy, including actions those agents take through tools, browsers, or connected systems, comply with this Usage Policy." | Puts responsibility for agent actions on the user. Does not prohibit any class of action by itself. |
| Help article on agents (DC-13) | Dated March 16, 2026 | "Engage in unauthorized, illegal, or fraudulent financial transactions (such as brokerage or investment advisory activities) or payment processing" | Addresses unauthorized, illegal or fraudulent transactions. Does not address an authorized transaction on the user's own account. |
| Consumer Terms (DC-14) | Effective October 8, 2025 (unchanged) | "To rely upon the Services, the Materials, or the Actions to buy or sell securities or to provide or receive advice about securities, commodities, derivatives, or other financial products or services, as Anthropic is not a broker-dealer or a registered investment adviser" | A listed prohibited use for Free, Pro and Max plans. Addresses relying on the service or its actions to buy or sell securities. No personal-use exception is written. Names securities, commodities and derivatives. |
| Commercial Terms (DC-16) | Effective June 17, 2025 | (no passage) | Contains no text on securities, trading, investment advice or brokers. Incorporates the Usage Policy. Governs API keys, the Agent SDK and Managed Agents (RT-01, RT-04). |
| Software Directory Policy (DC-17) | Dated April 15, 2026 | "Software that transfers money, cryptocurrency, or other financial assets, or executes financial transactions on behalf of users." | An "unsupported use case" for LISTING in Anthropic's directories, "unless otherwise expressly permitted by us in writing". Does not restrict what a user does with software outside the directory. |
| Interactive Brokers connector listing (DC-18) | Added May 2026 | "Claude never submits orders directly to the market." | Describes that one connector. Drafted instructions go to the owner for approval. |

<!-- TABLES-END -->

## 3. Not verified

Each item is a question this session could not answer from a live page, with what was tried. Ordered by how much the stack choice depends on it.

1. **Whether Anthropic's terms allow a personal agent that places securities orders without per-order approval.** The texts are quoted in Table (c). No Anthropic page read says "permitted" or "prohibited" for a user acting only for their own account. The Consumer Terms clause (DC-14) has no personal-use exception written into it. The Commercial Terms have no such clause (DC-16). The November 12, 2026 Usage Policy speaks of recommendations and of review "before it is used to implement a decision" (DC-07), with exclusions (DC-10). Tried: both Usage Policy versions, Consumer Terms, Commercial Terms, the agents help article, the Software Directory Policy, the policy-updates help article, a web search for an announcement of the November 12, 2026 version. What would settle it: a written answer from Anthropic.
2. **Whether Max plan usage would last through 78 (or 390) automated runs a day.** No number is published (DC-33). Tried: the Max plan article, the Claude Code plan article, claude.com/pricing, the routines page. What would settle it: a one-day trial reading the usage meter.
3. **Whether an individual's own trading program reading real time consolidated prices is fee-liable "non-display use", and what Alpaca, Tradier, Schwab and Interactive Brokers say in their own market data agreements.** The tape plans' policies are quoted (DC-71, DC-72, DC-73), a pending rule change is quoted (DC-75), and Webull, Twelve Data, Databento and Massive are quoted (DC-74). Alpaca's, Tradier's, Schwab's and Interactive Brokers' agreements were not found or not readable. Tried: alpaca.markets/data and /disclosures (no market data agreement text on them), a web search for Alpaca's non-professional agreement, two guessed Tradier terms addresses (404), Interactive Brokers' pricing page (classification definitions only), Schwab's portal (unreadable). Also not verified: whether the CT Plan fee proposal (DC-75) has been approved since April 2026.
4. **Symbols-per-request caps for Alpaca's and Tradier's quote requests.** Neither reference states one (DC-46, DC-50). This decides whether Alpaca's free plan and a Tradier account can sweep 6,000 symbols a minute. What would settle it: one test request each.
5. **Schwab Trader API: delay, feed, batch size, rate limits, cost.** The portal returned only a title (DC-56).
6. **Finazon's "from $4" real time SIP plan for non-professionals: whether it is still sold, its tiers, limits and whether a whole-market request exists.** The dataset's own address redirected to another product (DC-66).
7. **Which Tradier account or subscription includes API market data, and its cost.** The pricing page mentions a 10 dollar a month Pro subscription (DC-49). Left to the brokers helper.
8. **Finnhub and Financial Modeling Prep: delay, feed, limits, prices.** Unreadable again (DC-68).
9. **Databento: the exact way to subscribe to all symbols, any symbol limit, the share of volume its Mini feed covers, and which plan the "Delayed 10 minutes" access belongs to.** Documentation pages returned a title only, and the site refused `curl` (DC-57, DC-58).
10. **Webull: the price of the OpenAPI Nasdaq Basic non-display subscription, and whether any of its connector's 47 unseen tools places an order.** Price is behind login (DC-54). Tool list truncated (DC-19).
11. **Interactive Brokers: price of the "US Equity and Options Add-On Streaming Bundle", and how quickly market data lines can be rotated between symbols.** Not captured from the pricing page (DC-51, DC-53).
12. **Alpha Vantage: which feed its real time data is, whether the bulk quotes request is on every premium tier, and what the entitlement step costs or requires.** Tried: the full documentation page, the premium page, the data policy page (DC-59, DC-60).
13. **Which EODHD plan includes the all-U.S. bulk delayed request.** Not confirmed today (DC-63).
14. **How late or how often dropped GitHub Actions scheduled runs are, in numbers.** GitHub publishes none (DC-40).
15. **How long "a few minutes" is for desktop scheduled tasks.** No number on the page (DC-25).
16. **When bare mode becomes the default for `claude -p`.** Still no date (DC-29).
17. **Managed Agents: whether it can use claude.ai connectors (as opposed to MCP servers given by address), and its maximum session length.** The MCP page read names only servers by address (DC-31).
18. **The "Supplemental Credit Terms" that apply to the Max plan API credit.** Linked from the help article, not opened (DC-34).
19. **CTA non-display fee amounts.** The fee table's columns came out jumbled in text extraction (DC-73). The UTP amount (3,500 dollars a month per firm) was readable (DC-72).
20. **TradeStation, tastytrade, Robinhood, Public (feed and limits), Benzinga, Xignite, QuoteMedia, Insight Sentry, ThetaData stock plans.** Not read or only partly read (DC-67, DC-68).
21. **Whether Alpaca's free plan allows the `delayed_sip` WebSocket with a wildcard, or caps it at 30 symbols.** Not stated on the pages read (DC-47).
22. **Whether trading for profit for one's own account is "personal, non-business use" under the current CTA non-professional definition.** Not addressed in the part of the policy read (DC-73). The pending proposal would make the question moot (DC-75).
23. **Daily routine run caps on each plan.** The brief asked for them. The routines documentation page gives hourly caps only and no daily cap (DC-22), and claude.com/pricing shows no routine count. The help center was NOT searched for a per-plan daily routine cap, so "none found" covers those two pages only.
24. **Anthropic's public financial-services code repository.** A web search summary said its reference agents "do not make investment recommendations, execute transactions" and draft work for qualified-professional review. The repository was not opened, so this is not evidence and is not cited in any finding.
25. **The owner's Max tier (5x or 20x).** Not known to this session. The API credit comparison in DC-37 is therefore given for both 100 and 200 US dollars.

<!-- NV-END -->

## 4. Needs browser

In priority order.

1. https://developer.schwab.com/products/trader-api--individual (returned a title only). Needed for: Schwab's quote delay and feed, symbols per request, rate limits, market data terms for API use.
2. https://finazon.io/featured-datasets/us-stocks-market-data and https://finazon.io/pricing (plan tiers drawn by scripts, and the dataset page redirected). Needed for: whether the "from $4" non-professional real time SIP plan still exists, its request limits, and whether it has a whole-market snapshot. If real, it would be the cheapest consolidated real time source found.
3. https://databento.com/pricing , https://databento.com/catalog/us-equities and https://databento.com/docs/venues-and-datasets/equs-mini (site refused `curl`, docs returned a title only). Needed for: the licensing table rows ("Personal use", "Non-display use") by plan, the all-symbols subscription, the Mini feed's venues, and the "Delayed 10 minutes" table.
4. https://finnhub.io/pricing and https://finnhub.io/docs/api (built by scripts). Needed for: every Finnhub price, delay, feed and limit.
5. https://site.financialmodelingprep.com/developer/docs/pricing (HTTP 403). Needed for: every FMP price, delay, feed and limit.
6. https://claude.com/marketplace/connectors/webull (only 24 of 71 tool names visible). Needed for: whether the Webull connector has any order-placing tool, which would bear on DC-17.
7. The Webull "Advanced Quotes Center" after login (no public address). Needed for: the price of the OpenAPI Nasdaq Basic non-display subscription. This needs an account, so it may be a question for Webull support instead.
8. https://www.interactivebrokers.com/en/pricing/market-data-pricing.php (readable, but the subscription price tables are long). Needed for: the "US Equity and Options Add-On Streaming Bundle" price and the non-professional rows.
9. https://www.ctaplan.com/publicdocs/ctaplan/Schedule_of_Market_Data_Charges.pdf (a PDF, readable, but its fee table needs to be seen as laid out). Needed for: the CTA non-display fee amounts by network and category.
10. https://www.tiingo.com/documentation/iex and https://www.tiingo.com/documentation/websockets/iex (returned nothing to `curl`). Needed for: confirming the all-ticker request wording and the WebSocket's all-ticker option.
11. https://developer.tastytrade.com/docs/guides/stream-market-data and https://api.tradestation.com/docs/ (not opened). Needed for: delay, feed and symbol limits of those two brokers' data.
12. https://www.thetadata.net/stocks-data (not opened). Needed for: ThetaData's stock plans and delay.

<!-- NB-END -->

## 5. Contradictions between sources

1. **Consumer Terms against Commercial Terms on securities.** The Consumer Terms list relying on the service "to buy or sell securities" as a prohibited use (DC-14). The Commercial Terms have no such passage (DC-16). Both incorporate the same Usage Policy. Neither document explains the difference.
2. **Consumer Terms against Anthropic's own marketplace.** The Consumer Terms clause (DC-14) sits beside an "Anthropic verified" Interactive Brokers connector described as "Trade, invest, analyze, and manage global markets" (DC-18). The connector's listing resolves part of this itself: Claude only drafts instructions and "never submits orders directly to the market". No page read reconciles the two in words.
3. **Usage Policy, in force against next version.** The in-force text covers "financial decisions, including investment advice" broadly, requires a "qualified professional", and is framed as consumer-facing (DC-03, DC-04). The November 12, 2026 text narrows finance to "a personalized recommendation to buy, sell, hold, or allocate", requires a "qualified person" (defined), and adds explicit exclusions (DC-06 to DC-10). A design decided now will live mostly under the newer text.
4. **A search summary against the live page.** A web search summary said it could find no sign of a Usage Policy update dated November 12, 2026. The live page at anthropic.com/legal/aup shows "Effective November 12, 2026" (DC-01). The live page is used. No Anthropic announcement of the change was found (DC-20).
5. **Directory policy against press reports.** Anthropic's Software Directory Policy does not allow listed software that "executes financial transactions on behalf of users" without written permission (DC-17). A search summary reported press coverage saying TradeStation lets customers "place trades" through Claude, and a roundup saying a broker opened "agentic execution accounts". Those articles were not opened (strength B to D, unread), and guessed marketplace addresses for TradeStation and Robinhood returned 404 (DC-19). Unresolved. It is the brokers helper's area.
6. **Webull rate limits.** The per-endpoint table says the stock snapshot request allows 60 requests per 60 seconds in production. The market data FAQ says the Data API "has a rate limit of 300 requests per 60 seconds" (DC-55). The per-endpoint table is used, as the more specific and the more cautious.
7. **Cboe One, real time or delayed.** Interactive Brokers describes its free Cboe One and IEX data as "real-time streaming" (DC-51). Intrinio's page describes its Cboe One product as delayed "with 15-minute lag" (DC-65, via fetch tool). These may be two different products built on the same feed. Not reconciled.
8. **Intrinio's delayed SIP page against itself.** The page header calls the feed "real-time data" while the body says "15-minute delay" (DC-65, as reported by the fetch tool). The body is used.
9. **Finazon against itself.** The featured page sells a real time SIP dataset for non-professionals "from $4 monthly", while the dataset's own address redirects to a different, IEX-derived product (DC-66). Not reconciled.
10. **Delay length wording.** The tape plans say 15 minutes exactly (DC-69, DC-70). EODHD says "15-20 minutes" (DC-63). Interactive Brokers says delayed data is "usually 10-20 minutes behind" across exchanges generally (DC-52). The first is the rule for U.S. stocks. The others describe what a vendor actually delivers, or other markets.
11. **Delayed U.S. stock data, offered or not.** Interactive Brokers says that "in accordance with regulatory requirements" it no longer offers delayed U.S. equity quotes to its U.S. clients (DC-52). Alpaca, Tradier (sandbox), Massive and others do offer 15 minute delayed data (DC-45, DC-49, DC-43). Interactive Brokers does not name the requirement. Not reconciled. A broker and a data vendor may be under different rules.
12. **Databento prices and counts, repeated from run 1.** The general pricing page shows Plus at 1,750 and Unlimited at 4,500 a month. The U.S. equities catalog shows 1,500 and 4,000 (DC-57, MD-18). The same catalog page gives both "20,000+" and "24,000+" symbols. Standard is 199 on both.
13. **Twelve Data prices on its own page, repeated from run 1.** The page read today still shows "From $29", "From $99" and "From $329" in one place while the plan cards run 1 recorded were 79, 229 and 999 (MD-23). Not reconciled.
14. **Non-display, by whom it is defined.** The tape plans tie non-display fees to real time "data feed" recipients, worded about vendors and firms (DC-71, DC-72). Massive's individual terms forbid "non-display use" outright unless licensed (MD-15). Webull sells individuals a "Non-Display" API subscription (DC-54). Twelve Data and Databento say non-display use is simply included (DC-61, DC-57). The same word is being used by different parties with different consequences for an individual.
15. **`claude -p` on a subscription, present against announced future.** The help center says it still runs on the plan (DC-28). The docs say bare mode, which cannot use the plan login, "will become the default" (DC-29). Same tension as run 1, still undated.

<!-- CONTRA-END -->

End of file marker
