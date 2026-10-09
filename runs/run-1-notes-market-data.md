# Run 1 notes: market data and research data providers

Status line: COMPLETE as far as this session could take it. 72 findings (MD-01 to MD-72). Parts 1, 2 and 3, the three summary tables, and the Not verified, Needs browser and Contradictions lists are all written. The weakest areas are Finnhub, Financial Modeling Prep and Nasdaq Data Link (their sites could not be read), and the index owners' licensing statements.

A note on PDFs. Four findings (MD-53, MD-55, MD-56, MD-58) rest on PDF documents that the fetch tool downloaded but could not summarise. Their text was read directly with the Mac's built-in PDF reader, with nothing installed. Those quotes are therefore exact, not passed through the summarising model.

Access date for every finding below is 2026-10-08 (America/Chicago) unless a finding says otherwise. Confirmed with `date` at the start of the session.

How to read this file:

- Every finding rests on a page fetched live in this session. Nothing here is from memory.
- The pages were read through a fetch tool that converts a page to text and passes it through a small summarising model. Quotes were requested verbatim, but a quote could still be slightly off. Treat any quote that a decision hangs on as "confirm in a browser before relying on it".
- Strength labels: A = regulator, exchange, index owner, or the vendor's own documentation, pricing page or terms, seen live. B = reputable independent press or established reference publisher. C = review sites, comparison sites, affiliate blogs. D = forums, social posts, personal blogs, community code repositories.
- Price labels: "published" (on the vendor's own public page, seen live), "corroborated" (not on a vendor page but two or more independent sources agree, named), "gated and unverified".
- Glossary. SIP = Securities Information Processor, the consolidated national feed that merges quotes and trades from all U.S. exchanges. IEX = Investors Exchange, one exchange with a small share of total volume. WebSocket = a connection that stays open and pushes prices as they change. MCP = Model Context Protocol, the standard that lets Claude call outside tools. OTC = over-the-counter, stocks not listed on an exchange. ETF = exchange traded fund. API = application programming interface, the way one program asks another for data. REST = request-only access, where the program asks and gets one answer back.
- Nothing in this file is a recommendation to trade. It is research input for a human decision.

## 1. Findings register

### Part 1: price and quote data providers

#### Massive (formerly Polygon.io)

**MD-01.** Polygon.io has been renamed Massive (massive.com). The old pricing address now forwards permanently to the new one, and the vendor's own announcement dates the rename to October 30, 2025.
- Source: "Polygon.io is Now Massive" (vendor blog), https://massive.com/blog/polygon-is-now-massive . Also observed directly: fetching https://polygon.io/pricing returned "301 Moved Permanently" to https://massive.com/pricing .
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "We have just renamed Polygon.io to Massive.com, effective today (October 30, 2025) at 4 PM ET."

**MD-02.** Existing Polygon API keys still work and the old address api.polygon.io keeps working "for an extended period", with the new api.massive.com running alongside. The vendor says the old address is expected to be phased out later with notice (the phase-out wording is the fetch tool's paraphrase, not a quote).
- Source: same page as MD-01.
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "API endpoints at api.polygon.io continue to work for an extended period."

**MD-03.** Massive sells four individual stock plans: Stocks Basic at $0, Stocks Starter at $29 a month, Stocks Developer at $79 a month, Stocks Advanced at $199 a month (monthly billing prices). All four are labelled for individual use.
- Source: "Pricing" page, https://massive.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: the fetch tool returned the plan table rather than sentences. Cells as returned: "Stocks Basic $0", "Stocks Starter $29", "Stocks Developer $79", "Stocks Advanced $199", each marked "Individual use".

**MD-04.** Only the $199 Advanced plan is real time. Starter and Developer are 15 minutes delayed, and the free Basic plan is end-of-day only.
- Source: "Stocks" product page FAQ, https://massive.com/stocks (agrees with the table on https://massive.com/pricing ).
- Accessed: 2026-10-08. Strength: A. Price label: published (it is part of the plan definition).
- Quote: "Starter and Developer get 15-minute delayed data, which is enough for many research and dashboard use cases."

**MD-05.** Rate limits and history by plan: Basic is 5 API calls a minute with 2 years of history; Starter is unlimited calls with 5 years; Developer is unlimited calls with 10 years; Advanced is unlimited calls with 20 plus years. The smallest bars are one second on the paid plans (minute bars only on Basic). Individual trades start at Developer. Individual quotes (bid and ask) are only on Advanced.
- Source: "Pricing" page, https://massive.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: table cells as returned: Basic "5 API Calls / Minute", "2 Years Historical Data", "End of Day Data"; Advanced "20+ Years Historical Data".

**MD-06.** Massive says its stock data covers every U.S. exchange plus off-exchange trading, and that it is sourced from direct exchange feeds plus the SIPs (the consolidated feeds). Coverage is stated as more than 32,000 tickers including ETFs, OTC tickers and delisted names.
- Source: "Stocks" product page, https://massive.com/stocks
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Direct from each exchange's feed plus the SIPs (CTA/UTP)."

**MD-07.** WebSocket streaming is included on the paid Massive stock plans and not on the free Basic plan. On Starter and Developer the stream is 15 minutes delayed, because those plans are delayed (MD-04). The page summary was garbled on whether Developer includes WebSockets, so the pricing table (which lists it as included on Starter, Developer and Advanced) is what this finding rests on.
- Source: "Pricing" page, https://massive.com/pricing ; "Stocks" page, https://massive.com/stocks
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Every trade, quote, and aggregate pushed the moment it prints."

**MD-08.** Massive's individual plans are licensed for personal, non-professional, non-business use only. Redistribution or display to anyone else is prohibited without a Business plan.
- Source: "Market Data Terms of Service" (last updated August 28, 2025, per the page), https://massive.com/legal/market-data-terms-of-service ; and https://massive.com/stocks
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Individual plans (Basic → Advanced) are licensed for personal and non-professional use."

**MD-09.** Massive publishes an official MCP server in its own GitHub organisation, and also hosts it remotely at mcp.massive.com so that nothing has to be installed locally. It is a data server (search endpoints, call the API, query the results). It does not place orders.
- Source: GitHub repository "massive-com/mcp_massive", https://github.com/massive-com/mcp_massive
- Accessed: 2026-10-08. Strength: A (repository sits in the vendor's own organisation). Price label: not a price.
- Quote: "An MCP server for Massive.com Financial Market Data"

#### Alpaca Market Data

**MD-10.** Alpaca has two market data plans for individuals using its Trading API: Basic (free) and Algo Trader Plus at $99 a month.
- Source: "About Market Data API" (vendor docs), https://docs.alpaca.markets/docs/about-market-data-api ; and "Market Data" page, https://alpaca.markets/data
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: table cells as returned: "Free" (Basic) and "$99 / month" (Algo Trader Plus).

**MD-11.** On the free Basic plan the real-time stock feed is IEX only, one exchange that Alpaca itself says carries about 2.5 percent of market volume. The paid plan gets the SIP, which Alpaca describes as all U.S. exchanges and 100 percent of volume.
- Source: "Historical Stock Data" (vendor docs), https://docs.alpaca.markets/docs/historical-stock-data-1 ; plan table at https://docs.alpaca.markets/docs/about-market-data-api
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "This is the only feed that can be used without a subscription." (said of the iex feed)

**MD-12.** Alpaca limits by plan. Basic: WebSocket streaming for up to 30 symbols, 200 historical API calls a minute, and historical SIP data cannot include the latest 15 minutes. Algo Trader Plus: unlimited WebSocket symbols, 10,000 calls a minute, no 15 minute restriction. History goes back to 2016 on both.
- Source: "About Market Data API", https://docs.alpaca.markets/docs/about-market-data-api
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: table cells as returned: "30 symbols" vs "Unlimited"; "latest 15 minutes" vs "no restriction"; "200 / min" vs "10,000 / min"; "Since 2016".

**MD-13.** Alpaca's streaming addresses include a real-time SIP feed, a real-time IEX feed, and a 15 minute delayed SIP feed. A feed not covered by the subscription is refused at login.
- Source: "Real-time Stock Data" (vendor docs), https://docs.alpaca.markets/docs/real-time-stock-pricing-data
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "`v2/delayed_sip` is a 15-minute delayed SIP feed"

**MD-14.** Alpaca publishes an official MCP server in its own GitHub organisation. Unlike the data-only servers, this one covers market data AND order placement (stocks, ETFs, crypto, options). It runs locally with the user's own keys. The README describes no hosted version.
- Source: GitHub repository "alpacahq/alpaca-mcp-server", https://github.com/alpacahq/alpaca-mcp-server
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Alpaca's official MCP Server lets you trade stocks, ETFs, crypto, and options"

**MD-15.** Massive's terms for individual plans say the market data is "strictly for display use only" (Section 2), and prohibit "non-display use" and creating an "investment strategy" based on the data "unless you are licensed to do so" (Section 5(d)). The terms do not define non-display use and do not mention automated or algorithmic trading by name (checked twice, including the NYSE schedule). Whether these clauses bar a personal trading agent that reads the data by program is NOT settled by the page. This is a question to put to the vendor in writing before relying on an individual plan for an automated agent.
- Background, not sourced in this run: in market data licensing generally, "non-display use" is commonly understood to mean a program consuming data without a person viewing it. That reading comes from memory, not from a page fetched here, so it is a reason to ask the question, not evidence of the answer.
- Source: "Market Data Terms of Service", Sections 2 and 5(d), https://massive.com/legal/market-data-terms-of-service
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "(d) Use Market Data for non-display use or to create derivative works (including, without limitation, any index, [...] settlement value or investment strategy) based on the Market Data unless you are licensed to do so;" (middle of the list shortened with [...] to stay within the quote limit). Second quote, Section 2: "any and all Market Data is strictly for display use only."

**MD-16.** Alpaca does not offer OTC (over-the-counter) market data to individual subscribers. It says OTC data needs a special subscription available only to broker partners.
- Source: "Market Data FAQ" (vendor docs), https://docs.alpaca.markets/docs/market-data-faq
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Market data for OTC symbols can only be queried with a special subscription currently available only for broker partners."

**MD-17.** Alpaca illustrates how thin IEX-only data is with its own example for Apple on one trading day (2023-09-29 per the page): 12,630 eligible trades on IEX against more than 535,136 across all exchanges, which is roughly 2 percent of the trades.
- Source: "Market Data FAQ", https://docs.alpaca.markets/docs/market-data-faq
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "there were 12 630 eligible trades on the IEX exchange that day and more than 535 136 trades in total across all exchanges" (the page writes the numbers with spaces)

#### Databento

**MD-18.** Databento's U.S. equities plans: Usage-based (no monthly fee, historical data only), Standard at $199 a month (adds live data, no exchange license fees), Plus at $1,500 a month in license fees (annual contract), Unlimited at $4,000 a month in license fees (annual contract). Standard is described as for individuals and small teams.
- Source: "US Equities" catalog page, https://databento.com/catalog/us-equities
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Ideal for individuals and small teams." (said of Standard, $199 per month)

**MD-19.** Databento does not sell live U.S. equities data on a pay-as-you-go basis. Live data needs the $199 Standard plan or higher. New accounts get $125 of free credit toward historical data, expiring six months after signup.
- Source: "Pricing" page, https://databento.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Usage-based live data is not available for Databento US Equities."

**MD-20.** Databento's equities data is NOT the SIP. It licenses each exchange's own direct feed. Its entry-level live product, Databento US Equities Mini (dataset code EQUS.MINI), is a top-of-book feed blended from several exchanges and alternative trading systems, which the vendor calls a synthetic "mini" national best bid and offer. It is therefore an approximation of the consolidated quote, not the official one.
- Source: "Databento US Equities Mini now available" (vendor blog, dated February 1, 2025), https://databento.com/blog/databento-us-equities-mini-now-available ; and "Equities" page, https://databento.com/equities
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "a proprietary blend of direct feeds sourced from several NMS exchanges and ATSs."

**MD-21.** Databento coverage and granularity: all exchange-listed U.S. stocks and ETFs (20,000 plus symbols), individual trades and quotes with nanosecond timestamps, bars by second, minute, hour or day. The Databento US Equities dataset starts in 2018; EQUS.MINI history starts March 28, 2023. On Standard, history included is 8 plus years of the lightest level (bars and trades, "L0"), 1 year of top-of-book ("L1"), 1 month of full depth. Non-listed OTC securities are not addressed on the page.
- Source: "Equities" page, https://databento.com/equities ; "US Equities" catalog page, https://databento.com/catalog/us-equities
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Databento's equities data is sourced directly from each exchange."

**MD-22.** No official Databento MCP server was found. Databento's GitHub organisation showed seven public repositories and none is an MCP server. Search results listed community-built Databento MCP servers, but the one repository address tried returned "404 Not Found", so no community server is cited here as evidence.
- Source: GitHub organisation page, https://github.com/databento
- Accessed: 2026-10-08. Strength: A for the absence in the vendor organisation as listed on that page. Price label: not a price.
- Quote: repositories listed as returned: "dbn", "databento-rs", "databento-cpp", "databento-python", "epoch", ".github", "secdef-parser".

#### Twelve Data

**MD-23.** Twelve Data individual plans: Basic (free), Grow at $79 a month, Pro at $229 a month, Ultra at $999 a month (list prices with monthly billing; annual billing is lower at $66, $191 and $832 a month equivalent). The page also shows "From $29", "From $99" and "From $329" figures in a comparison table that do not match the plan cards. See the Contradictions section.
- Source: "Pricing" page, https://twelvedata.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published, with an on-page inconsistency.
- Quote: plan taglines as returned: Grow "for hobby projects", Pro "for advanced integrations", Ultra "for high-volume personal use".

**MD-24.** Twelve Data's default real-time U.S. stock prices come only from venues that need no exchange licence, which Twelve Data says amount to about 5 percent of U.S. trading volume. It is not the SIP. Consolidated data is by arrangement with their sales team (price gated).
- Source: "US Equities Market Data" (vendor help centre), https://support.twelvedata.com/en/articles/9935903-us-equities-market-data
- Accessed: 2026-10-08. Strength: A. Price label: the consolidated feed price is gated and unverified.
- Quote: "These venues collectively represent approximately 5% of total US trading volume."

**MD-25.** Twelve Data rate limits and streaming: Basic is 8 API credits a minute and 800 a day; Grow 55 plus a minute; Pro 610 plus; Ultra 2,584 plus. Full WebSocket access starts at the Pro plan ($229). Basic and Grow can only trial it. The WebSocket pushes price updates only, not bid and ask.
- Source: "Pricing" page, https://twelvedata.com/pricing ; "WebSocket FAQ" (vendor help centre), https://support.twelvedata.com/en/articles/5194610-websocket-faq
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Full access to the WebSocket server is available only with the Pro plan."

**MD-26.** Twelve Data bars go down to one minute. Extended-hours (before and after the regular session) U.S. data needs Pro or above. Individual plans are for personal, internal, non-commercial purposes. History depth for one minute bars was not stated on the pages read.
- Source: API docs, https://twelvedata.com/docs ; "Pricing" page, https://twelvedata.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Only for the `Pro` plan (individual) and `Venture` plan (business) and above."

**MD-27.** Twelve Data publishes an official MCP server in its own GitHub organisation and hosts it remotely (login with a Twelve Data account).
- Source: GitHub repository "twelvedata/mcp", https://github.com/twelvedata/mcp ; also linked from https://twelvedata.com/docs
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Twelve Data MCP (Model Context Protocol) Server provides seamless, real-time access to financial market data via WebSocket"

#### Alpha Vantage

**MD-28.** Alpha Vantage's free key allows 25 requests a day. Premium plans listed: 75 requests a minute at $49.99 a month, 150 at $99.99, 300 at $149.99, 600 at $199.99, 1,200 at $249.99. The page also listed a second set ($499 to $2,499) that the fetch tool could not label; these are probably the annual prices but that is a guess, to be confirmed in a browser.
- Source: "Premium API Key" page, https://www.alphavantage.co/premium/
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "standard API usage limit" (25 requests per day); premium keys have "No daily limits."

**MD-29.** Alpha Vantage real-time and 15 minute delayed U.S. data for personal use are not simply switched on by a plan. The user has to go through a "data entitlement process" in a separate Alpha Vantage product (Alpha X Terminal). The public page does not say which exchange or feed the real-time data comes from, so SIP versus single exchange is not verified.
- Source: "Premium API Key" page, https://www.alphavantage.co/premium/
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "realtime US market data, 15-minute delayed US market data, realtime US options data, or historical index data for personal use"

**MD-30.** Alpha Vantage intraday bars: 1, 5, 15, 30 and 60 minute, with 25 plus years of history. The intraday endpoint is premium only. Without an entitlement setting it returns historical data, not live. No WebSocket was seen in the documentation read (request-only), but only the first part of a very long page was read.
- Source: "API Documentation", https://www.alphavantage.co/documentation/
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "This API returns current and 25+ years of historical intraday OHLCV time series."

**MD-31.** Alpha Vantage publishes an official MCP server in its own GitHub organisation, with a hosted remote address and setup notes for Claude and Claude Code.
- Source: GitHub repository "alphavantage/alpha_vantage_mcp", https://github.com/alphavantage/alpha_vantage_mcp
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "The official Alpha Vantage API MCP server enables LLMs and agentic workflows to seamlessly interact"

#### Tiingo

**MD-32.** Tiingo individual plans: Starter at $0 and Power at $30 a month. Starter: 50 requests an hour, 1,000 a day, 500 unique symbols a month. Power: 10,000 an hour, 100,000 a day, all symbols. There are no per-minute or per-second limits. Internal commercial use is a separate $50 a month plan.
- Source: "Pricing" page, https://www.tiingo.com/about/pricing ; docs overview, https://www.tiingo.com/documentation/general/overview
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "We do not rate limit to minute or second, so you are free to make your requests as you desire."

**MD-33.** Tiingo's real-time and intraday U.S. stock data is IEX only (one exchange), available by request and by WebSocket. Intraday volume is IEX volume only.
- Source: "IEX" endpoint docs, https://www.tiingo.com/documentation/iex
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "We receive IEX TOPS (top of book), which means we get the last sale data AND top bid and ask quotes."

**MD-34.** Since February 1, 2025, getting Tiingo's full IEX feed requires the user to have a signed market data agreement with IEX Exchange itself. Without it, Tiingo serves a "derived reference price", which Tiingo says is not a substitute for the real feed. This is an extra paperwork step for an individual.
- Source: "IEX" endpoint docs, https://www.tiingo.com/documentation/iex
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "As of February 1st, 2025 IEX Exchange has changed their market data policies."

**MD-35.** Tiingo's individual plans are for personal and internal use only, with no display or sharing of the data.
- Source: docs overview, https://www.tiingo.com/documentation/general/overview
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "For Basic and Power accounts, data is for internal and personal use only."

#### Finnhub

**MD-36.** Finnhub's pricing and documentation pages would not render through the fetch tool (they came back as a title only), so plan prices are NOT verified from the vendor. Third-party pages say the free tier allows 60 API calls a minute with a WebSocket limited to 50 symbols and real-time U.S. quotes. Two independent sites agree on 60 calls a minute; only one states the 50 symbol limit.
- Source: "Finnhub API" directory entry (last verified 2026-02-20 per the page), https://dataglobehub.com/api-finder/finnhub-api/ ; "I Tested 4 Free Stock Market APIs" (published May 20, 2026, updated Sep 2, 2026), https://orthogonal.info/i-tested-4-free-stock-market-apis-heres-which-one-actually-works-for-side-projects/
- Accessed: 2026-10-08. Strength: C (first), D (second, personal blog). Price label: corroborated for "free, 60 calls a minute" (dataglobehub and orthogonal.info). Paid prices: gated and unverified (dataglobehub says "$11.99-$99.99/month" for a "Premium tier"; no second source found).
- Quote: "Finnhub gives you 60 calls/min on the free tier."

**MD-37.** Finnhub's terms say every plan on its website is for personal use only, a business may not use a personal plan even internally without written approval, and data or derived results may not be redistributed or shared. The terms page read does not mention automated trading.
- Source: "Terms of Service", https://finnhub.io/terms-of-service
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "All plan listed on Finnhub website is strictly for personal use unless explicitly stated otherwise."

**MD-38.** No official Finnhub MCP server was found. Finnhub's GitHub organisation showed seven public repositories (client libraries for Python, Ruby, PHP, Go, JavaScript, Kotlin, and a Chainlink adapter) and none is an MCP server. Community ones exist: one fetched example is owned by an individual GitHub user, not by Finnhub.
- Source: GitHub organisation page, https://github.com/Finnhub-Stock-API ; community repository "catherinedparnell/mcp-finnhub", https://github.com/catherinedparnell/mcp-finnhub
- Accessed: 2026-10-08. Strength: A for the absence on the vendor's page; D for the community repository. Price label: not a price.
- Quote: repositories as returned: "finnhub-python", "finnhub-ruby", "finnhub-php", "finnhub-go", "finnhub-js", "finnhub-kotlin", "finnhub-chainlink". Community repository's own description: "An MCP server to interface with Finnhub API."

**MD-39.** Finnhub's official Python library includes an index constituents call ("Indices Constituents" appears among its examples). Which plan it needs, and which indexes it covers, could not be read from the vendor's site.
- Source: GitHub repository "Finnhub-Stock-API/finnhub-python", https://github.com/Finnhub-Stock-API/finnhub-python
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "# Indices Constituents"

#### Financial Modeling Prep (FMP)

**MD-40.** FMP's own pricing pages returned "403 Forbidden" to the fetch tool on every address tried, so prices are not vendor-verified. Third-party pages give: Basic free (250 calls a day, end-of-day data); Starter, Premium and Ultimate at about $22, $59 and $149 a month on ANNUAL billing. A second site lists month-to-month prices of $29, $69 and $139, and its annual figures for Starter and Premium ($21.89, $59.33) round to the first site's. Its Ultimate figures look internally inconsistent (annual shown higher than monthly).
- Source: "Compare FMP API pricing and alternatives" (last verified August 20, 2026 per the page), https://multiples.vc/compare/fmp-api-alternatives ; "Financial Modeling Prep - Pricing Plans", https://apis.io/plans/financialmodelingprep/financialmodelingprep-plans-pricing/
- Accessed: 2026-10-08. Strength: C (both). Price label: corroborated for the annual-billing prices of Starter and Premium (multiples.vc and apis.io). Month-to-month prices and Ultimate: gated and unverified (single source, with an inconsistency).
- Quote: "Paid individual plans, billed annually: Starter at $22 a month, Premium at $59 a month, and Ultimate at $149 a month."

**MD-41.** Per the third-party listing, FMP rate limits are 300 calls a minute on Starter, 750 on Premium and 3,000 on Ultimate, with real-time data from Starter upward and end-of-day only on the free plan. Which feed "real-time" means (SIP or one exchange) is not stated in anything read. Single C source.
- Source: https://apis.io/plans/financialmodelingprep/financialmodelingprep-plans-pricing/
- Accessed: 2026-10-08. Strength: C. Price label: gated and unverified.
- Quote: "$29/mo (about $21.89/mo billed annually), 300 API calls/min, real-time data, 5 years of historical range."

**MD-42.** No official FMP MCP server was confirmed. A community MCP server for the FMP API exists as a published code package: its README does not claim to be official or affiliated with FMP and names no maintainer (the only identifier is the handle "imbenrabi" in registry links). FMP's own site could not be read to rule an official server in or out, so "official: none" is not proven.
- Source: README of the package "financial-modeling-prep-mcp-server" version 2.6.12, https://cdn.jsdelivr.net/npm/financial-modeling-prep-mcp-server@2.6.12/README.md
- Accessed: 2026-10-08. Strength: D. Price label: not a price.
- Quote: "A Model Context Protocol (MCP) server for the Financial Modeling Prep API, exposing 250+ financial data tools"

#### EODHD (EOD Historical Data)

**MD-43.** EODHD personal plans: Free ($0, 20 API calls a day); EOD Historical Data All World at $19.99 a month; EOD plus Intraday All World Extended at $29.99; Fundamentals Data Feed at $59.99; All-In-One at $99.99. Paid plans allow 100,000 calls a day and 1,000 requests a minute. Annual billing is cheaper. Commercial plans are a separate tab.
- Source: "Pricing" page, https://eodhd.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: plan names as returned: "EOD + Intraday All-World Extended" at "$29.99/mo", "ALL-IN-ONE Package" at "$99.99/mo".

**MD-44.** EODHD's real-time U.S. WebSocket is one exchange only (Cboe EDGX). The vendor says plainly it is not the consolidated tape and its quotes are not the national best bid and offer. Limit is 50 symbols by default, extended hours 4 am to 8 pm Eastern are covered, and it is on paid plans only.
- Source: "Real-Time Data API (WebSockets)" docs, https://eodhd.com/financial-apis/new-real-time-data-api-websockets
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Trades are executions that occurred on EDGX - this is not a consolidated (SIP) tape"

**MD-45.** EODHD intraday history: 1 minute, 5 minute and 1 hour bars. One minute bars for U.S. stocks go back to 2004 including pre-market and after-hours. But the intraday history is finalised only 2 to 3 hours after the close, so it is a research and backtest source, not a same-day intraday source. Covers NYSE and NASDAQ; OTC is not mentioned. Each request costs 5 calls.
- Source: "Intraday Historical Data API" docs, https://eodhd.com/financial-apis/intraday-historical-data-api
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Intraday data is delayed and finalized about 2-3 hours after the market close."

**MD-46.** EODHD publishes an official MCP server, hosted remotely and open source in its own GitHub organisation, with 72 read-only tools. Free and paid plans can use it, the free plan with limited data.
- Source: "MCP Server for Financial Data by EODHD", https://eodhd.com/financial-apis/mcp-server-for-financial-data-by-eodhd (links to https://github.com/EodHistoricalData/EODHD-MCP-Server )
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "The official MCP server for EODHD makes it easy for AI agents and large language models (LLMs) to connect"

#### Intrinio

**MD-47.** Intrinio's public pricing: Individual at $150 a month (self-serve, includes a bundle it calls EquitiesEdge); Startup from $333 a month rising to $999; Enterprise "Custom", $1,250 a month and up, through sales. Real-time products (IEX real-time prices, Nasdaq Basic, 15 minute delayed SIP) are shown as Enterprise tier with no price, reached by a consultation request.
- Source: "Pricing" page, https://intrinio.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published for Individual and Startup; gated and unverified for the real-time feeds.
- Quote: "6 mo at $333, 6 mo at $666, $999 thereafter."

**MD-48.** Intrinio publishes an official MCP server (hosted, login by OAuth, read-only). It needs an active Individual, Startup or Enterprise subscription or a trial.
- Source: "Intrinio MCP Server", https://intrinio.com/mcp ; "Connecting to the MCP Server" (help centre), https://help.intrinio.com/connecting-to-the-mcp-server
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "The MCP server cannot place trades, modify your account, or write anything back."

#### Nasdaq Data Link

**MD-49.** Nasdaq Data Link still exists under that name (the site title read "Financial, Economic and Alternative Data | Nasdaq Data Link"), and its old documentation address now forwards permanently to data.nasdaq.com. Beyond that, the site would not render through the fetch tool: no product list, no prices, no terms could be read. Whether an individual can buy intraday or real-time U.S. stock data there is NOT verified.
- Source: https://data.nasdaq.com/ (title only); redirect observed from https://docs.data.nasdaq.com/docs/getting-started to https://data.nasdaq.com/accesstools (which then returned 404).
- Accessed: 2026-10-08. Strength: A (for the name and redirect only). Price label: gated and unverified.
- Quote: "Financial, Economic and Alternative Data | Nasdaq Data Link"

#### IEX Cloud

**MD-50.** IEX Cloud no longer operates. IEX Group shut it on August 31, 2024. Its assets were bought by two former executives, with a relaunch described at the time under the working name Blue Sky Data. Fetching iexcloud.io in this session failed with "connection refused". The IEX stock exchange itself is a separate business and still supplies the IEX feed that Alpaca and Tiingo relay (MD-11, MD-33).
- Source: "IEX Cloud Shuttered Though Former Execs Acquire Assets" (dated September 16, 2024), https://www.integrity-research.com/iex-cloud-shuttered-though-former-execs-acquire-assets/ ; direct fetch of https://iexcloud.io/ returned ECONNREFUSED.
- Accessed: 2026-10-08. Strength: B. Price label: not a price.
- Quote: "IEX Group recently shuttered its IEX Cloud business on August 31st."

#### Yahoo Finance through unofficial libraries

**MD-51.** Yahoo's Terms of Service prohibit collecting data from its services by any automated means without prior permission, prohibit building a database or data feed from it, and prohibit access for any commercial purpose. An unofficial library that pulls Yahoo Finance data is automated collection under that wording.
- Source: "Yahoo Terms of Service", https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html (first 100,000 characters read)
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "access or collect data, or attempt to access or collect data, from our Services using any automated means, including but not limited to robots, spiders, scrapers, data mining tools, or data gathering or extraction tools"

**MD-52.** yfinance, the best known unofficial Yahoo library, is a personal open-source project, not a Yahoo product. Its own README says it is for research and education, and points the user to Yahoo's terms. There is no service level, no support and no contract behind it.
- Source: GitHub repository "ranaroussi/yfinance", https://github.com/ranaroussi/yfinance
- Accessed: 2026-10-08. Strength: D (community repository). Price label: free, not a vendor price.
- Quote: "yfinance is not affiliated, endorsed, or vetted by Yahoo, Inc."

#### Late additions to Part 1

**MD-53.** Alpha Vantage's terms license the service for personal, non-commercial use. They define commercial use to exclude "investment analysis, research, testing, monitoring" and other activities "private and individual in nature", which describes a personal agent. The terms also treat anyone employed by or affiliated with a broker-dealer, investment adviser or similar as commercial. Nothing in the part read bars automated or trading use. (Read directly from the PDF text, not through the summarising model.)
- Source: "Terms of Service" (PDF), https://www.alphavantage.co/terms_of_service/
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "for personal, non-commercial use, unless you and Alpha Vantage have agreed otherwise in writing"

**MD-54.** Surfaced during the search, a broker example: Tradier gives real-time U.S. stock and options data, from a consolidated feed of all exchanges, to holders of a Tradier Brokerage account, and offers no real-time data to anyone else. Its test environment is 15 minutes delayed. This shows a third route to consolidated data (through a brokerage account rather than a data subscription). Interactive Brokers and Schwab were tried and could not be read (see Not verified).
- Source: "Market Data" (vendor docs), https://docs.tradier.com/docs/market-data
- Accessed: 2026-10-08. Strength: A. Price label: not a price (account pricing not researched here).
- Quote: "Real-time data is pulled from a consolidated feed from all exchanges."

### Part 2: index membership

**MD-55.** The Nasdaq Composite is, by its owner's own methodology, every eligible security listed exclusively on Nasdaq, added and removed daily, with no size or liquidity test. "Eligible" means common stocks, ordinary shares, ADRs (American Depositary Receipts, foreign shares traded in the U.S.), limited partnership interests and shares or units of beneficial interest. It EXCLUDES ETFs, closed-end funds, preferred stocks, rights, warrants, units and convertible debentures. So it is not "everything listed on Nasdaq". It is "everything listed on Nasdaq minus funds, preferreds and derivative-type securities". (Read directly from the PDF text.)
- Source: "Index Methodology, Nasdaq Composite Index" (copyright 2025), https://indexes.nasdaqomx.com/docs/methodology_COMP.pdf
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "All securities that meet the applicable Security Eligibility Criteria are included in the Index."

**MD-56.** Size of the Nasdaq Composite: 3,396 securities as of September 30, 2026, per Nasdaq's fact sheet. Nasdaq's index web page showed 3,391 components on the day of access (it changes daily, see MD-55). (Fact sheet read directly from the PDF text.)
- Source: "Nasdaq Composite" fact sheet, https://indexes.nasdaqomx.com/docs/FS_COMP.pdf ; index overview, https://indexes.nasdaqomx.com/Index/Overview/COMP
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Securities: 3396" and "All Information as of 09/30/2026."

**MD-57.** The Nasdaq-100 is 100 of the largest non-financial companies listed on Nasdaq. It currently has 101 components (more securities than companies, because a company can have more than one share class in the index). Nasdaq distributes official components and weights through its Global Index Watch service, which shows a data entitlement and a "Subscribe" link. No free official download was seen on the page.
- Source: "Nasdaq-100 Index" overview, https://indexes.nasdaqomx.com/Index/Overview/NDX
- Accessed: 2026-10-08. Strength: A. Price label: gated and unverified (no price shown for the entitlement).
- Quote: "Global Index Watch (GIW) is the direct web interface for index weights, components and more."

**MD-58.** The NYSE Composite is administered by ICE Data Indices (a subsidiary of Intercontinental Exchange, which owns the NYSE). The only eligibility text that could be read is an OLD NYSE methodology guide (dated January 2003 and January 2004), which says only common stocks, ADRs, REITs (real estate investment trusts) and tracking stocks listed on the NYSE are eligible, and that preferred stocks, closed-end funds, ETFs, trust units, limited partnerships, warrants and rights are not. The current ICE methodology was not found, so treat the rule as "probably still so, not confirmed". (Both PDFs read directly.)
- Source: "ICE Data Indices Benchmark Statement, NYSE Composite Index Family" (v1.1, November 2023), https://www.ice.com/publicdocs/data/ICE_Data_Indices_Benchmark_Statement_NYSE_Composite_Index_Family.pdf ; "NYSE Sector Indexes Methodology Guide" (January 2004), https://www.nyse.com/publicdocs/nyse/indices/nyse_sector_index_methodology.pdf
- Accessed: 2026-10-08. Strength: A (but the eligibility document is more than twenty years old). Price label: not a price.
- Quote: "Only common stocks, ADRs, REITs and tracking stocks listed on the NYSE are eligible for inclusion; multiple classes of shares can also be included in the Composite."

**MD-59.** Size of the NYSE Composite: not found on any ICE or NYSE page. Wikipedia (an established reference, not the owner) says over 2,000 stocks, of which over 1,600 are U.S. companies and over 360 are foreign listings. No second fetched source confirms the number, so treat it as soft.
- Source: "NYSE Composite", https://en.wikipedia.org/wiki/NYSE_Composite
- Accessed: 2026-10-08. Strength: B. Price label: not a price.
- Quote: "Over 2,000 stocks are covered in the index, of which over 1,600 are from United States corporations"

**MD-60.** Russell 2000: 1,996 securities as of April 30, 2026, per the index owner's reconstitution page. From 2026 the Russell indexes are rebuilt twice a year, in June and December (it was once a year). FTSE Russell publicly posts the additions and deletions lists as PDFs for the Russell 3000 and Russell Microcap (latest dated June 26, 2026). No standalone, free Russell 2000 membership file was found on the page.
- Source: "Russell Reconstitution" (FTSE Russell, part of LSEG), https://www.lseg.com/en/ftse-russell/russell-reconstitution
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "Beginning in 2026, the Russell Indexes are reconstituted semi-annually, in June and December."

**MD-61.** S&P 500 and Dow sizes, from the fund issuer because S&P's own pages refused the fetch tool (HTTP 403): State Street's SPY page lists the S&P 500 index at 503 constituents (the fund itself holds 504 lines, which includes a cash-type line; that explanation is a guess). State Street's DIA page lists 30 holdings for the Dow Jones Industrial Average.
- Source: "SPDR S&P 500 ETF Trust (SPY)", https://www.ssga.com/us/en/intermediary/etfs/spdr-sp-500-etf-trust-spy ; "SPDR Dow Jones Industrial Average ETF Trust (DIA)", https://www.ssga.com/us/en/intermediary/etfs/spdr-dow-jones-industrial-average-etf-trust-dia
- Accessed: 2026-10-08. Strength: A for the fund facts (issuer's own page); it is not the index owner's statement. Price label: not a price.
- Quote: "Fund Top Holdings as of Oct 07 2026" (DIA page; "Number of Holdings" shown as 30).

**MD-62.** Free daily holdings files exist for four of the six universe items. State Street offers "Download All Holdings: Daily" (an Excel file) for SPY (S&P 500) and DIA (Dow). iShares offers "Download latest fund holdings CSV data" for IVV (S&P 500, 504 holdings) and IWM (Russell 2000, 1,985 holdings), both dated the previous trading day (October 7, 2026). A fund's holdings are a close proxy for index membership, not the official list: IWM held 1,985 names against 1,996 in the index (MD-60).
- Source: SSGA pages as in MD-61; "iShares Russell 2000 ETF", https://www.ishares.com/us/products/239710/ishares-russell-2000-etf ; "iShares Core S&P 500 ETF", https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf
- Accessed: 2026-10-08. Strength: A. Price label: free (published, no price).
- Quote: "Download latest fund holdings CSV data" (iShares) and "Download All Holdings: Daily" (State Street).

**MD-63.** Nasdaq 100 proxy: Invesco QQQ tracks the Nasdaq-100 and Invesco says ETFs disclose holdings daily, but the holdings table and any download link did not render through the fetch tool. Whether a downloadable daily file exists is not verified (needs a browser).
- Source: "Invesco QQQ", https://www.invesco.com/qqq-etf/en/about.html
- Accessed: 2026-10-08. Strength: A. Price label: not a price.
- Quote: "ETFs disclose their holdings daily."

**MD-64.** Exchange symbol directories: Nasdaq Trader publishes free symbol files, updated through each day, on a public FTP directory. One file covers Nasdaq-listed securities and another ("Other Exchanges") covers securities listed elsewhere, with a code for the listing exchange (N = NYSE, A = NYSE MKT, P = NYSE Arca, Z = BATS, V = IEX; background not sourced in this run: "NYSE MKT" is the exchange the brief calls NYSE American). Both carry an ETF flag and a test-issue flag, so funds and test symbols can be filtered out. These files list everything listed, which is wider than the two Composite indexes (MD-55, MD-58): they also include preferreds, warrants, units and closed-end funds, which have to be removed by other means.
- Source: "Symbol Look-Up/Directory Data Fields & Definitions", https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs ; "Symbol Directory", https://www.nasdaqtrader.com/Trader.aspx?id=SymbolLookup
- Accessed: 2026-10-08. Strength: A. Price label: free (published, no price).
- Quote: "The symbol directory files are updated periodically through-out each day."

**MD-65.** Index constituent endpoints among the providers in Part 1, as far as live pages showed:
(a) EODHD sells an "S&P and Dow Jones Indices Historical Constituents" product through its marketplace, supplied by a third party (Unicorn Data Services), at $29.99 a month, covering S&P 500, 600, 400, 100 and others with up to 12 years of history. Nasdaq 100 and Russell 2000 are not mentioned.
(b) Intrinio has a "US Index Constituents" feed, current members only, Enterprise plan only, price through sales.
(c) Massive's stock endpoint list shows no index constituent endpoint and no ETF holdings endpoint.
(d) Finnhub's library has an index constituents call (MD-39), plan unknown.
(e) Alpha Vantage lists an "ETF Profile & Holdings" endpoint, and Twelve Data lists an ETF "Composition" endpoint: these give fund holdings (the proxy route), not official index membership.
(f) Alpaca, Tiingo and Databento: no constituent endpoint was seen on the pages read (absence on the pages read, not a confirmed "no").
(g) FMP: not verified (site unreadable).
- Source: https://eodhd.com/financial-apis/sp-and-dow-jones-indices-historical-constituents-data-api ; https://intrinio.com/products/index-constituents ; https://massive.com/docs/rest/stocks/overview ; https://www.alphavantage.co/documentation/ ; https://twelvedata.com/docs
- Accessed: 2026-10-08. Strength: A. Price label: published for EODHD ($29.99 a month, with an unexplained on-page note "$50 for the first 3 months"); gated and unverified for Intrinio.
- Quote: "This data feed is available exclusively with our Enterprise plan. Talk to our sales team to get started." (Intrinio)

### Part 3: non-price research data

**MD-66.** Company filings, free and official: the SEC allows automated access to EDGAR at up to 10 requests a second, asks every program to declare who it is in a "User-Agent" header (a label the program sends with each request), and reserves the right to slow anyone who exceeds the limit.
- Source: "Accessing EDGAR Data", https://www.sec.gov/os/accessing-edgar-data
- Accessed: 2026-10-08. Strength: A. Price label: free (published).
- Quote: "Current max request rate: 10 requests/second."

**MD-67.** The SEC's data.sec.gov interfaces need no key and no login. They give each company's filing history and its reported financial figures in a machine-readable form, updated through the day as filings arrive (filing history typically within a second, financial data typically within a minute). Full bulk files are rebuilt nightly at about 3 am Eastern. This doubles as a free fundamentals source.
- Source: "EDGAR Application Programming Interfaces (APIs)", https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- Accessed: 2026-10-08. Strength: A. Price label: free (published).
- Quote: "These APIs do not require any authentication or API keys to access."

**MD-68.** Economic data: the St. Louis Fed's FRED service needs a registered API key, publishes no numeric rate limit (it reserves the right to set one), requires a notice that the product is not endorsed by the bank, and warns that some series belong to third parties whose permission is needed beyond personal use. The pages read did not state a price; no fee was mentioned anywhere.
- Source: "FRED API Terms of Use", https://fred.stlouisfed.org/docs/api/terms_of_use.html ; "FRED API", https://fred.stlouisfed.org/docs/api/fred/
- Accessed: 2026-10-08. Strength: A. Price label: not verified as free from the pages read.
- Quote: "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis."

**MD-69.** Near real-time news, candidate 1: Alpaca's news API is supplied by Benzinga, has history back to 2015, and offers real-time news over a WebSocket. The docs do not say whether it is included in the free plan.
- Source: "Historical News Data", https://docs.alpaca.markets/docs/historical-news-data ; "Real-time News", https://docs.alpaca.markets/docs/streaming-real-time-news
- Accessed: 2026-10-08. Strength: A. Price label: not verified (plan inclusion not stated).
- Quote: "All news data is currently provided directly by Benzinga."

**MD-70.** Near real-time news, candidate 2: Massive sells Benzinga datasets as add-ons at $99 a month EACH for individuals (News, Earnings, Analyst Ratings, Analyst Insights, Corporate Guidance, Bulls Bears Say). Separately, Massive's base stock plans list a "News" endpoint and filings endpoints (8-K text, 10-K sections, Forms 3 and 4, 13-F), plus fundamentals (balance sheets, income statements, cash flow, ratios; "Financials & Ratios" is $29 a month on its own or included in Advanced per MD-03's page).
- Source: "Benzinga" partner page, https://massive.com/partners/benzinga ; "Stocks REST overview", https://massive.com/docs/rest/stocks/overview ; https://massive.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "News articles are updated in real-time with history going back to 2009."

**MD-71.** News and calendars, candidate 3: EODHD's news feed is described as updated in real time and is included in every plan including the free one. Its calendar (earnings dates, analyst estimate trends, IPOs, splits, dividends) is in the Fundamentals ($59.99) and All-In-One ($99.99) plans. Fundamentals are in the same two plans.
- Source: "Financial News API", https://eodhd.com/financial-apis/stock-market-financial-news-api ; "Calendar API", https://eodhd.com/financial-apis/calendar-upcoming-earnings-ipos-and-splits ; prices from https://eodhd.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "earnings reports, analyst estimate revisions, IPOs, stock splits and dividend dates."

**MD-72.** News, calendars, fundamentals and economic data, other candidates seen in vendor documentation without a plan or price attached: Alpha Vantage lists News and Sentiments, Earnings Call Transcript, Earnings Calendar, IPO Calendar, and economic indicators (GDP, Treasury yield, federal funds rate, CPI, unemployment, nonfarm payroll and others). Twelve Data lists Earnings calendar, IPO calendar, Press releases, EDGAR filings and financial statements (fundamentals start at the Grow plan per MD-23's page). Tiingo has a news feed adding 8,000 to 12,000 articles a day, with fundamentals as a paid add-on.
- Source: https://www.alphavantage.co/documentation/ ; https://twelvedata.com/docs ; https://www.tiingo.com/documentation/news ; https://www.tiingo.com/about/pricing
- Accessed: 2026-10-08. Strength: A. Price label: not verified per endpoint.
- Quote: "On a typical day, Tiingo adds over 8,000-12,000 articles a day."

<!-- FINDINGS-END -->

## 2. Per-provider summary table

Built only from the findings above. Every cell cites its finding IDs. "NV" means not verified in this run (see section 3). Prices are per month for an individual, monthly billing, unless stated.

### Table A: provider facts

| Provider | Plans and prices | Real time or delayed | Which feed real time is | Streaming (WebSocket) | Intraday history | Rate limits | Listed and OTC coverage (vendor's words) | Terms for a personal automated user | Official MCP server |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Massive (was Polygon.io, MD-01, MD-02) | $0, $29, $79, $199 (MD-03) | $0 is end-of-day; $29 and $79 are 15 minutes delayed; $199 is real time (MD-04) | Direct exchange feeds plus the SIPs, all U.S. exchanges and off-exchange (MD-06) | Paid plans yes, free no; delayed on $29 and $79 (MD-07) | Second and minute bars; trades from $79; quotes at $199; 2, 5, 10, 20 plus years by plan (MD-05) | 5 calls a minute free; unlimited on paid (MD-05) | Every U.S. exchange; 32,000 plus tickers including ETFs and OTC (MD-06) | Personal, non-professional, no redistribution (MD-08). "Display use only" and "non-display use" clauses are unresolved for an automated agent (MD-15) | Yes, data only, hosted option (MD-09) |
| Alpaca Market Data | Free; $99 (MD-10) | Free: real-time IEX, and SIP only after 15 minutes; $99: real-time SIP (MD-11, MD-12, MD-13) | Free is IEX only, about 2.5 percent of volume; $99 is SIP, 100 percent (MD-11, MD-17) | Both plans; 30 symbols free, unlimited on $99 (MD-12) | Minute bars; since 2016 (MD-12). Trades and quotes history NV | 200 calls a minute free; 10,000 on $99 (MD-12) | All U.S. exchanges on SIP (MD-11). OTC not available to individuals (MD-16) | NV (terms not read) | Yes, covers data AND order placement, runs locally (MD-14) |
| Databento | Usage-based (historical only, $125 free credit); $199; $1,500 and $4,000 on annual contract (MD-18, MD-19) | Live only from $199 (MD-19) | Not the SIP. Direct exchange feeds; the entry live product is a blended "mini" best bid and offer (MD-20) | Live data from $199 (MD-19). Transport details NV | Trades and quotes to the nanosecond; second and minute bars; since 2018, or March 2023 for the mini feed (MD-21) | NV | All exchange-listed U.S. stocks and ETFs, 20,000 plus symbols; OTC not addressed (MD-21) | $199 plan "for individuals and small teams", no license fees (MD-18). Licence table NV | None found in vendor's GitHub (MD-22) |
| Twelve Data | Free; $79; $229; $999 (MD-23) | Real time on all plans (MD-24) | Not the SIP. Venues amounting to about 5 percent of volume (MD-24) | Full access from $229 only; price only, no bid and ask (MD-25) | 1 minute bars (MD-26). Depth NV | 8 credits a minute and 800 a day free; 55 plus, 610 plus, 2,584 plus on paid (MD-25) | NV in a fetched quote | Personal, internal, non-commercial (MD-26). Automated-trading clause NV | Yes, hosted option (MD-27) |
| Alpha Vantage | Free; $49.99 to $249.99 by speed (MD-28) | Needs a separate "entitlement" step for real time or 15 minute delayed (MD-29) | NV (MD-29) | None seen (MD-30) | 1 to 60 minute bars, 25 plus years, premium only (MD-30) | 25 requests a day free; 75 to 1,200 a minute on paid (MD-28) | NV | Personal, non-commercial; private investment analysis is within personal use (MD-53) | Yes, hosted option (MD-31) |
| Tiingo | $0; $30; $50 for internal commercial use (MD-32) | Real time, IEX only (MD-33) | IEX only; full feed needs the user's own agreement with IEX since February 2025 (MD-33, MD-34) | Yes (MD-33). Plan NV | Bar sizes and depth NV | 50 an hour and 1,000 a day free; 10,000 an hour and 100,000 a day on $30; no per-minute cap (MD-32) | NV | Internal and personal use only (MD-35) | None found (search only, see section 3) |
| Finnhub | Free tier exists; paid prices NV (MD-36) | Third parties say real-time U.S. on free (MD-36) | NV | Third parties say 50 symbols on free (MD-36) | NV | Third parties say 60 calls a minute on free (MD-36) | NV | Personal use only; no redistribution (MD-37) | None in vendor's GitHub; community only (MD-38) |
| Financial Modeling Prep | Third parties: free; about $22, $59, $149 on annual billing (MD-40) | Third party: end-of-day on free, real time on paid (MD-41) | NV (MD-41) | NV | NV | Third party: 300, 750, 3,000 calls a minute (MD-41) | NV | NV | Not confirmed; community only seen (MD-42) |
| EODHD | $0; $19.99; $29.99; $59.99; $99.99 (MD-43) | Real-time WebSocket on $29.99 and $99.99; otherwise 15 minutes delayed (MD-43, MD-44) | One exchange only (Cboe EDGX), not the SIP (MD-44) | Yes, 50 symbols, paid only (MD-44) | 1 minute bars since 2004, but finalised 2 to 3 hours after the close (MD-45) | 20 calls a day free; 100,000 a day and 1,000 a minute on paid (MD-43) | NYSE and NASDAQ for intraday; OTC not mentioned (MD-45) | Personal plans tab (MD-43). Terms NV | Yes, hosted option, 72 read-only tools (MD-46) |
| Intrinio | $150 individual; from $333 startup; $1,250 plus enterprise (MD-47) | Real-time products are Enterprise tier, price through sales (MD-47) | IEX, Nasdaq Basic or delayed SIP offered at Enterprise tier (MD-47) | NV | NV | NV | NV | NV | Yes, hosted, read-only, needs a subscription (MD-48) |
| Nasdaq Data Link | NV (MD-49) | NV (MD-49) | NV (MD-49) | NV (MD-49) | NV (MD-49) | NV (MD-49) | NV (MD-49) | NV (MD-49) | NV (MD-49) |
| IEX Cloud | Closed August 31, 2024 (MD-50) | Not applicable (MD-50) | Not applicable (MD-50) | Not applicable (MD-50) | Not applicable (MD-50) | Not applicable (MD-50) | Not applicable (MD-50) | Not applicable (MD-50) | Not applicable (MD-50) |
| Yahoo Finance through yfinance | Free, no contract (MD-52) | NV | NV | NV | NV | NV | NV | Yahoo's terms prohibit automated collection without permission (MD-51); the library is unofficial (MD-52) | No vendor product at all (MD-52) |
| Tradier (broker, surfaced by the search) | Account pricing not researched (MD-54) | Real time for account holders; 15 minutes delayed in the test environment (MD-54) | Consolidated feed from all exchanges (MD-54) | NV | NV | NV | NV | NV | NV |

### Table B: the six universe items

Legend. Each cell answers two separate questions. **P** = do the provider's PRICES cover the stocks in this universe. **C** = does the provider offer a CONSTITUENT LIST (the list of members) for this index. "P: yes" rests on the vendor's statement that it covers all U.S. exchange-listed stocks, combined with the fact that every member of these six universes is exchange-listed (MD-55, MD-57, MD-58 for the three where the owner's page says so; for the S&P 500, Dow and Russell 2000 that step is an inference, not a quoted fact).

| Provider | Dow 30 | Nasdaq 100 | NASDAQ Composite | NYSE Composite | S&P 500 | Russell 2000 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Massive | P: yes (MD-06). C: no (MD-65) | P: yes (MD-06). C: no (MD-65) | P: yes (MD-06). C: no (MD-65) | P: yes (MD-06). C: no (MD-65) | P: yes (MD-06). C: no (MD-65) | P: yes (MD-06). C: no (MD-65) |
| Alpaca | P: yes on SIP (MD-11). C: none seen (MD-65) | P: yes on SIP (MD-11). C: none seen (MD-65) | P: yes on SIP (MD-11). C: none seen (MD-65) | P: yes on SIP (MD-11). C: none seen (MD-65) | P: yes on SIP (MD-11). C: none seen (MD-65) | P: yes on SIP (MD-11). C: none seen (MD-65) |
| Databento | P: yes (MD-21). C: none seen (MD-65) | P: yes (MD-21). C: none seen (MD-65) | P: yes (MD-21). C: none seen (MD-65) | P: yes (MD-21). C: none seen (MD-65) | P: yes (MD-21). C: none seen (MD-65) | P: yes (MD-21). C: none seen (MD-65) |
| Twelve Data | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) |
| Alpha Vantage | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) | P: NV. C: fund holdings only (MD-65) |
| Tiingo | P: NV. C: none seen (MD-65) | P: NV. C: none seen (MD-65) | P: NV. C: none seen (MD-65) | P: NV. C: none seen (MD-65) | P: NV. C: none seen (MD-65) | P: NV. C: none seen (MD-65) |
| Finnhub | P: NV. C: a call exists, indexes and plan NV (MD-39) | P: NV. C: NV (MD-39) | P: NV. C: NV (MD-39) | P: NV. C: NV (MD-39) | P: NV. C: NV (MD-39) | P: NV. C: NV (MD-39) |
| FMP | P: NV. C: NV (MD-65) | P: NV. C: NV (MD-65) | P: NV. C: NV (MD-65) | P: NV. C: NV (MD-65) | P: NV. C: NV (MD-65) | P: NV. C: NV (MD-65) |
| EODHD | P: NYSE and NASDAQ intraday (MD-45). C: paid add-on covers "S&P and Dow Jones indices", the Dow 30 itself not named (MD-65) | P: yes (MD-45). C: not mentioned (MD-65) | P: yes (MD-45). C: not mentioned (MD-65) | P: yes (MD-45). C: not mentioned (MD-65) | P: yes (MD-45). C: yes, $29.99 add-on, with history (MD-65) | P: yes (MD-45). C: not mentioned (MD-65) |
| Intrinio | P: NV. C: Enterprise only, "major US indices", this one not named (MD-65) | P: NV. C: Enterprise only, not named (MD-65) | P: NV. C: Enterprise only, not named (MD-65) | P: NV. C: Enterprise only, not named (MD-65) | P: NV. C: Enterprise only, not named (MD-65) | P: NV. C: Enterprise only, not named (MD-65) |

### Table C: where the member list for each universe item can come from

| Universe item | Size, and whose number it is | What the owner's page says about who is in it | Free proxy found | Official list |
| :-- | :-- | :-- | :-- | :-- |
| Dow Jones Industrial Average | 30, from the fund issuer, not the owner (MD-61) | Owner's page unreadable (section 3) | DIA daily holdings file, State Street (MD-62) | Licensing NV (section 3) |
| Nasdaq 100 | 101 components, 100 companies, from the owner (MD-57) | 100 largest non-financial companies on Nasdaq (MD-57) | QQQ, download link NV (MD-63) | Global Index Watch, entitlement and subscribe link, price not shown (MD-57) |
| NASDAQ Composite | 3,396 on September 30, 2026, from the owner (MD-56) | All eligible types listed exclusively on Nasdaq, minus ETFs, closed-end funds, preferreds, rights, warrants, units (MD-55) | Nasdaq Trader's Nasdaq-listed file, filtered (MD-64). A tracking fund's file is NV (section 3) | Global Index Watch (MD-56) |
| NYSE Composite | Over 2,000, from Wikipedia, not the owner (MD-59) | Common stocks, ADRs, REITs and tracking stocks listed on NYSE, per a 2004 document (MD-58) | Nasdaq Trader's "Other Exchanges" file filtered to exchange code N (MD-64). No tracking fund found (section 3) | ICE Data Indices, access terms NV (MD-58) |
| S&P 500 | 503, from the fund issuer, not the owner (MD-61) | Owner's page unreadable (section 3) | SPY daily file, State Street; IVV file, iShares (MD-62) | Licensing NV (section 3). EODHD resells a list for $29.99 (MD-65) |
| Russell 2000 | 1,996 on April 30, 2026, from the owner (MD-60) | Rebuilt each June and December from 2026 (MD-60) | IWM holdings file, iShares, 1,985 names (MD-62) | Owner posts Russell 3000 additions and deletions, not a Russell 2000 list (MD-60) |

## 3. Not verified

Each item is a question the run could not answer from a live page, with what was tried.

1. **Finnhub plan prices, WebSocket limits, which feed its real-time U.S. data is, which endpoints are paid.** Tried: fetch of finnhub.io/pricing, finnhub.io/pricing-stock-api-market-data, finnhub.io/docs/api/rate-limit, finnhub.io/docs/api/introduction (all returned a title only); search "Finnhub pricing plans personal free 60 API calls/minute websocket 50 symbols US market real-time"; third-party pages dataglobehub.com, orthogonal.info, qveris.ai, nexusfi.com (403).
2. **Everything about FMP from FMP itself** (prices, limits, feed, WebSocket, index constituent endpoints, terms, official MCP). Tried: site.financialmodelingprep.com/developer/docs/pricing, /pricing-plans, /de/developer/docs/pricing, /insights/platform/how-to-choose-the-right-financial-modeling-prep-plan-for-your-workflow (all 403); financialmodelingprep.com/developer/docs/pricing (redirects to the 403 address); searches "Financial Modeling Prep pricing 2026 Starter Premium Ultimate monthly price calls per minute real-time" and "Financial Modeling Prep official MCP server github FinancialModelingPrep".
3. **Which exchange or feed Alpha Vantage's real-time data comes from, and what the entitlement costs.** Tried: alphavantage.co/premium/ and the first 100,000 characters of alphavantage.co/documentation/. Neither says. Also the second price set on the premium page ($499 to $2,499) is unlabelled.
4. **Whether Databento's $199 plan is licensed for personal use with no exchange fees for all its equities feeds, and its rate limits.** Tried: databento.com/pricing, databento.com/catalog/us-equities, databento.com/docs/portal/live-data (truncated), databento.com/docs/faqs/usage-based-pricing-and-credits (truncated). A search snippet said the licensing table lists the Mini feed as "Personal and commercial" with "No license fees", but that page could not be read, so it is not evidence.
5. **Twelve Data: price of consolidated (full market) data, depth of one minute history, its statement of U.S. symbol coverage, its terms on automated trading.** Tried: twelvedata.com/pricing, twelvedata.com/docs (first 100,000 characters), two help-centre articles. A search snippet said the default data "covers the entire universe of listed US equities", not captured in a fetched quote.
6. **Tiingo: intraday bar sizes, intraday history depth, symbol coverage of U.S. exchanges, which plan includes news, official MCP.** Tried: tiingo.com/about/pricing, /documentation/iex, /documentation/general/overview, /documentation/news; search "Tiingo official MCP server tiingo model context protocol" (no relevant result).
7. **Intrinio: what the $150 Individual plan contains (real time, delayed or end-of-day), rate limits, WebSocket, terms.** Tried: intrinio.com/pricing; intrinio.com/individual, intrinio.com/equity-market-data/equitiesedge, intrinio.com/financial-market-data/real-time-stock-prices (all 404).
8. **Nasdaq Data Link: products, prices, terms, whether an individual can buy intraday U.S. stock data, MCP.** Tried: data.nasdaq.com (title only), docs.data.nasdaq.com/docs/getting-started (redirect, then 404), nasdaq.com/nasdaq-data-link (timeout), search "Nasdaq Data Link 2026 individual subscription Sharadar equity prices price per month still available Quandl".
9. **Whether the business that bought IEX Cloud's assets (reported working name Blue Sky Data) operates today and sells to individuals.** Tried: integrity-research.com article (2024). Not followed further.
10. **Whether any vendor's terms bar automated trading use.** Read: Massive (ambiguous, MD-15), Finnhub (silent, MD-37), Alpha Vantage (silent in the part read, MD-53), Tiingo overview (MD-35), Yahoo (MD-51). NOT read: Alpaca's market data terms, Twelve Data's terms, EODHD's terms, Databento's licence terms, Intrinio's terms. No vendor page read contains an explicit ban on automated trading. That is absence in what was read, not a clean bill.
11. **Whether Massive still accepts the old api.polygon.io address as of October 2026.** The announcement (MD-02) said the old address would be phased out later with notice. Not checked further.
12. **What S&P Dow Jones Indices says about licensing constituent lists, and its own member counts.** Tried: spglobal.com/spdji/en/indices/equity/sp-500/ and /dow-jones-industrial-average/ (both 403); search "S&P Dow Jones Indices constituent data license subscription required constituents full list not free redistribute terms of use" (returned third-party contract excerpts only, not fetched).
13. **What FTSE Russell and ICE say about licensing constituent lists, and the price of Nasdaq's Global Index Watch entitlement.** Tried: lseg.com/en/ftse-russell/indices/russell-us, lseg.com/en/ftse-russell/russell-reconstitution, lseg.com/en/ftse-russell/index-resources/russell-reconstitution-membership-lists (404), ice.com/market-data/indices/equity-indices/products (lists paid NYSE index data packages but does not name the Composite), nyse.com/quote/index/NYA (navigation only), nasdaq.com/solutions/global-indexes/nasdaq-100 (timeout).
14. **The current NYSE Composite methodology and member count from ICE.** Tried: the pages in item 13; search "NYSE Composite Index methodology ICE Data Indices eligible securities..." and "NYSE Composite Index NYA number of constituents 2026 ICE factsheet". Only a 2004 NYSE document and a 2023 ICE benchmark statement were readable (MD-58).
15. **Whether any fund tracks the NYSE Composite.** None found. Tried: search "ETF that tracks the NYSE Composite Index NYA fund" and "iShares NYSE Composite ETF NYC liquidated closed date BlackRock". Search snippets say the iShares NYSE Composite ETF (ticker NYC) was closed in October 2014, but the two articles (etftrends.com, etf.com) returned 403, so the closure is not sourced from a fetched page. Working position: no fund found, not proven that none exists.
16. **Whether the fund tracking the NASDAQ Composite (Fidelity ONEQ) publishes a downloadable daily holdings file, and whether it holds every member or a sample.** Tried: fidelity.com/etfs/oneq (HTTP 400), institutional.fidelity.com fund page (404), search "Fidelity Nasdaq Composite Index ETF ONEQ holdings daily representative sampling number of holdings". Snippets said it samples (about 1,000 holdings against roughly 3,400 in the index), with one site saying full replication. If it samples, its holdings file is NOT a usable membership proxy and the Nasdaq Trader file (MD-64) is the better route.
17. **Whether Invesco offers a downloadable daily QQQ holdings file.** Tried: invesco.com/qqq-etf/en/about.html and invesco.com/us/financial-products/etfs/holdings?audienceType=Investor&ticker=QQQ (data did not load).
18. **Market data through brokers other than Tradier.** Tried: interactivebrokers.com/en/pricing/market-data-pricing.php (403), developer.schwab.com/products/trader-api--individual (403).
19. **Alpaca: whether news is included on the free plan, whether a data plan needs an open brokerage account, how it defines non-professional, history of individual trades and quotes.** Tried: the five Alpaca docs pages cited in MD-10 to MD-17 and MD-69, and alpaca.markets/support/what-are-the-market-data-subscription-options-for-trading-api-users (404).
20. **A source for scheduled economic releases (an economic calendar with release times), and whether FRED is free of charge and what its numeric rate limit is.** FRED's terms and API pages read (MD-68) state neither. No economic calendar provider was sourced. Massive's Benzinga page lists no economic calendar (MD-70).
21. **Whether WebSocket is included on Massive's $79 Developer plan.** The pricing table lists it as included; the product page summary came back garbled (MD-07). Low doubt, but confirm in a browser.

<!-- NOTVERIFIED-END -->

## 4. Needs browser

- https://finnhub.io/pricing (returned a title only; the page is built by JavaScript). Needed for: plan names, prices, WebSocket limits, which feed real-time U.S. data comes from.
- https://finnhub.io/docs/api (and sub-pages such as /docs/api/rate-limit and /docs/api/introduction; title only). Needed for: rate limits, which endpoints are premium (stock candles, index constituents), WebSocket.
- https://site.financialmodelingprep.com/developer/docs/pricing and https://site.financialmodelingprep.com/pricing-plans (HTTP 403 to the fetch tool). Needed for: every FMP price and limit, WebSocket, index constituent endpoints and their plan.
- https://data.nasdaq.com/ (title only). Needed for: what an individual can buy, prices, terms.
- https://www.nasdaq.com/nasdaq-data-link (timed out).
- https://www.alphavantage.co/terms_of_service/ (served as a PDF the fetch tool could not read). Needed for: personal use, redistribution, trading clauses.
- https://mcp.alphavantage.co/ (logo and heading only). The GitHub repository was readable instead (MD-31).
- https://databento.com/docs/portal/live-data (truncated to a title). Needed for: the licensing table that says which datasets are licensed for personal use without fees.
- https://www.spglobal.com/spdji/en/indices/equity/sp-500/ and https://www.spglobal.com/spdji/en/indices/equity/dow-jones-industrial-average/ (HTTP 403 to the fetch tool). Needed for: index owner's own description and member counts.
- https://www.invesco.com/us/financial-products/etfs/holdings?audienceType=Investor&ticker=QQQ and https://www.invesco.com/qqq-etf/en/about.html (holdings data did not load). Needed for: whether a daily QQQ holdings download exists.
- https://www.fidelity.com/etfs/oneq (HTTP 400). Needed for: ONEQ holdings file, and whether the fund samples the index.
- https://www.nyse.com/quote/index/NYA (navigation only) and https://www.ice.com/market-data/indices/equity-indices/products . Needed for: NYSE Composite member count, current methodology, access terms.
- https://www.nasdaq.com/solutions/global-indexes/nasdaq-100 (timed out).
- https://www.interactivebrokers.com/en/pricing/market-data-pricing.php and https://developer.schwab.com/products/trader-api--individual (HTTP 403). Needed for: broker-supplied market data terms and prices.
- https://www.etftrends.com/2014/08/ishares-will-close-18-etfs/ and https://www.etf.com/sections/daily-etf-watch/ishares-closes-7-etfs (HTTP 403). Needed for: the closure of the only NYSE Composite fund the search surfaced.
- https://twelvedata.com/docs and https://www.alphavantage.co/documentation/ (readable, but far longer than the 100,000 characters read). Needed for: per-endpoint plan requirements, history depth.
<!-- NEEDSBROWSER-END -->

## 5. Contradictions between sources

1. **Twelve Data prices on its own pricing page.** Plan cards show $79, $229 and $999 a month. A comparison table on the same page shows "From $29", "From $99" and "From $329". Not reconciled. (MD-23)
2. **Databento top-tier fees.** The general pricing page showed Plus at $1,750 and Unlimited at $4,500 a month (the default view lists futures exchanges). The U.S. equities catalog page showed $1,500 and $4,000. Probably a per-dataset difference; that is a guess. Standard is $199 on both. (MD-18, MD-19)
3. **Alpaca paid-plan rate limit.** The marketing page says "Unlimited API calls" for Algo Trader Plus while its header says "up to 10,000 API calls/min". The docs say "10,000 / min". The docs figure is used. (MD-12)
4. **FMP prices between third-party sites.** One gives $22, $59, $149 a month on annual billing. Another gives $29, $69, $139 month to month, and shows Ultimate's annual figure ($149.45) higher than its monthly figure, which cannot be right. (MD-40)
5. **Finnhub paid tier.** The one fetched directory page gives a "Premium tier" at "$11.99-$99.99/month" with 300 requests a minute, a range too wide to be one plan, and no second fetched source confirms it. Recorded here as an unresolved inconsistency inside a single weak source, not a contradiction between two. (MD-36)
6. **NASDAQ Composite size.** Fact sheet: 3,396 securities on September 30, 2026. Index web page on October 8, 2026: 3,391 components. The same web page's description text says "over 2,500 companies". The first two differ by date (membership changes daily); the third looks like stale text. (MD-56)
7. **NASDAQ Composite eligible types.** The 2025 methodology omits tracking stocks from the eligible list and says a security "must be listed exclusively" on Nasdaq. The September 2026 fact sheet still lists tracking stocks as eligible and keeps an exception for securities dually listed before January 1, 2004. (MD-55, MD-56)
8. **Nasdaq-100 size.** "100 of the largest" companies, but "# of Components" is 101. Explained by multiple share classes, which is the usual reason but is not stated on the page read. (MD-57)
9. **NYSE Composite scope.** Wikipedia describes the index as "covering all common stock listed on the New York Stock Exchange" with over 2,000 stocks. The 2004 NYSE methodology guide limits it to common stocks, ADRs, REITs and tracking stocks and names exclusions. Not a flat contradiction, but "all common stock" is looser than the methodology. No owner figure for the size was found. (MD-58, MD-59)
10. **S&P 500 fund holdings against index size.** SPY and IVV each show 504 holdings; State Street's page gives the index as 503. (MD-61, MD-62)
11. **EODHD small print.** The marketplace constituents product shows "$29.99 /mo" beside "$50 for the first 3 months". The news API page states a per-request cost formula that its own worked example does not match. (MD-65, MD-71)
12. **Databento "ideal for" wording.** A search summary attributed "Ideal for investment firms" to the $199 tier. The fetched page attaches that phrase to the $1,500 Plus tier and says Standard is "Ideal for individuals and small teams". The fetched page is used. (MD-18)

<!-- CONTRADICTIONS-END -->

## End of file marker
