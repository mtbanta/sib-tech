# Run 1 notes: brokers and regulation

Research helper notes for run 1. Access date for every source below is 2026-10-08 (America/Chicago) unless a finding says otherwise. This is research input for a human decision, never an instruction to trade.

Method: every finding comes from a page fetched live in this session with WebSearch or WebFetch. Recalled knowledge was used only to decide where to look. No accounts were created, nothing was installed, no browser tools were used.

Strength labels: A = regulator, or the vendor's own documentation, pricing page or terms, seen live. B = reputable independent press or established reference publisher. C = review sites, comparison sites, affiliate blogs. D = forums, social posts, personal blogs, community code repositories.

Price labels: "published" (on the vendor's own public page, seen live), "corroborated" (two or more independent sources agree, named), "gated and unverified".

Caveat on quotes: WebFetch passes each page through a small summarizing model. Quotes below are as returned by that tool. Where a quote could not be returned verbatim, the finding says "paraphrase by fetch tool". The brief capped supporting quotes at 40 words; where a finding carries extra fragments they are listed separately as "also on the page".

Method note for the trajectory: four documents were PDFs (SEC Release 34-105226, Public's API terms, and two NYSE market data policies). WebFetch saved each one by itself into the session's tool-results folder outside this repo. Their text was pulled out with the Python that ships with macOS (python3 -I, standard library only). Nothing was installed and no file other than this one was written by this helper.

## 1. Findings register

### Part 2 rules: settlement, cash account violations, pattern day trader

**BR-01.** U.S. stock and ETF trades settle one business day after the trade date ("T+1"). The SEC rule required compliance from May 28, 2024.
- Page: "SEC Finalizes Rules to Reduce Risks in Clearance and Settlement" (SEC press release 2023-29)
- URL: https://www.sec.gov/newsroom/press-releases/2023-29
- Accessed: 2026-10-08. Strength: A.
- Quote: "shorten the standard settlement cycle for most broker-dealer transactions in securities from two business days after the trade date (T+2) to one (T+1)." and "The compliance date for the final rules is May 28, 2024."

**BR-02.** FINRA's current investor page confirms T+1 for most equity trades and says that in a cash account you must pay in full before selling.
- Page: "Frequent Intraday Trading: Understanding the Basics" (FINRA, page dated June 04, 2026)
- URL: https://www.finra.org/investors/investing/investment-products/stocks/day-trading
- Accessed: 2026-10-08. Strength: A.
- Quote: "The current settlement time for most equity trades is T+1, or the next business day." and "When you buy securities in a cash account, you must pay for securities in full before selling them."

**BR-03.** The pattern day trader rule is gone. The SEC approved FINRA's rule change SR-FINRA-2025-017 on April 14, 2026 (Release No. 34-105226). It removes the "pattern day trader" label, "day-trading buying power" and the 25,000 dollar minimum, and puts intraday margin standards in their place.
- Page: SEC Release No. 34-105226, File No. SR-FINRA-2025-017, "Notice of Filing of a Proposed Rule Change, as Modified by Amendment No. 1, to Amend FINRA Rule 4210 (Margin Requirements) to Replace the Day Trading Margin Provisions with Intraday Margin Standards", April 14, 2026 (PDF; text extracted locally from the fetched file)
- URL: https://www.sec.gov/files/rules/sro/finra/2026/34-105226.pdf
- Accessed: 2026-10-08. Strength: A.
- Quote: "eliminate provisions relating to 'pattern day traders,' the computation and use of 'day-trading buying power,' and the minimum equity requirement of $25,000 for pattern day traders, and would implement instead new intraday margin standards."
- Also in the document (the ordering clause, not counted as the supporting quote): the rule change "be, and hereby is, approved on an accelerated basis."

**BR-04.** The change took effect June 4, 2026. Brokers that need more time may keep applying the old day trading rules during a phase-in that runs until October 20, 2027. So as of October 2026 a given broker may be on either the old or the new regime for margin accounts; this has to be checked broker by broker.
- Page: "Regulatory Notice 26-10" (FINRA)
- URL: https://www.finra.org/rules-guidance/notices/26-10
- Accessed: 2026-10-08. Strength: A.
- Quote: "The effective date of the amendments is June 4, 2026, 45 days from publication of this Notice." and "Members that need more time to implement the rule change will be permitted to phase in their implementation over a period of 18 months, until October 20, 2027."

**BR-05.** The live rulebook text of FINRA Rule 4210 no longer contains "pattern day trader", "day trading buying power" or "$25,000". Paragraph (f)(8)(B) is marked "Reserved". The amendment line reads "Amended by SR-FINRA-2025-017 eff. June 4, 2026." The new intraday margin test is in paragraph (d)(2) and applies to each "margin account" of a customer.
- Page: "4210. Margin Requirements" (FINRA rulebook)
- URL: https://www.finra.org/rules-guidance/rulebooks/finra-rules/4210
- Accessed: 2026-10-08. Strength: A.
- Quote: "Each member shall determine the intraday margin deficit, if any, for each margin account of a customer that it maintains" and "Amended by SR-FINRA-2025-017 eff. June 4, 2026."
- Note (paraphrase by fetch tool, not verbatim): under (d)(2)(D), a customer who makes a practice of not meeting intraday margin deficits and misses one for five business days is barred for 90 calendar days from creating or increasing a short position or debit balance. Deficits not exceeding "the lesser of 5% of the equity in the margin account or $1,000" do not count toward that practice.

**BR-06.** FINRA's plain-English investor article on the new rules: no 25,000 dollar minimum for day trading, firms may set stricter house rules, and firms may stay on the old rules during the transition.
- Page: "Understanding the New Intraday Margin Requirements" (FINRA Investor Insights, April 20, 2026)
- URL: https://www.finra.org/investors/insights/intraday-margin-requirements
- Accessed: 2026-10-08. Strength: A.
- Quote: "There's no $25,000 minimum equity requirement for day trading." and "Your firm has the authority to impose higher requirements if they choose." and firms "might continue operating under the old day trading margin requirements during the transition."

**BR-07.** The pattern day trader rule never applied to cash accounts. The old rule defined "day trading" as buying and selling the same security the same day "in a margin account". The replacement intraday margin rule is also written for margin accounts only (see BR-05).
- Page: SEC Release No. 34-105226 (same document as BR-03), section II.A "Current Day Trading Margin Requirements of Rule 4210"
- URL: https://www.sec.gov/files/rules/sro/finra/2026/34-105226.pdf
- Accessed: 2026-10-08. Strength: A.
- Quote: "The rule defines the term 'day trading,' subject to specified exceptions, as the purchasing and selling or the selling and purchasing of the same security on the same day in a margin account."
- Limit of this finding: neither Regulatory Notice 26-10 nor the FINRA investor article contains a sentence that says in so many words "this does not apply to cash accounts". The conclusion rests on the "in a margin account" definition and on (d)(2) being scoped to margin accounts.

**BR-08.** FINRA says frequent trading in a cash account is possible but is governed by settlement and payment rules, not by the day trading margin rules. It names freeriding and good faith violations as the risks.
- Page: "Frequent Intraday Trading: Understanding the Basics" (FINRA)
- URL: https://www.finra.org/investors/investing/investment-products/stocks/day-trading
- Accessed: 2026-10-08. Strength: A.
- Quote: "However, some active investors might choose to implement a frequent trading strategy in cash accounts as well." and "If you trade frequently in a cash account, be sure that you understand securities settlement cycles..."
- Paraphrase by fetch tool: the page says a good faith violation can occur when you buy with cash from an unsettled trade and "sell the security before the proceeds used to fund the purchase have settled."

**BR-09.** Regulation T, section 220.8 (the federal cash account rule): a broker may buy for a customer if there are sufficient funds in the account, or if it accepts in good faith the customer's agreement to pay promptly in full and not sell before paying. If a security is sold before it is paid for, the privilege of delaying payment is withdrawn for 90 calendar days. "Good faith violation" is broker vocabulary; the regulation itself only has the 90-day freeze.
- Page: "§ 220.8 Cash account." 12 CFR Part 220 (Regulation T), 2025 annual edition on govinfo.gov. (ecfr.gov itself redirected the fetch tool to an unblock page; see Needs browser.)
- URL: https://www.govinfo.gov/content/pkg/CFR-2025-title12-vol3/xml/CFR-2025-title12-vol3-sec220-8.xml
- Corroborating copy: "12 CFR § 220.8 - Cash account." https://www.law.cornell.edu/cfr/text/12/220.8 (strength B, reference publisher)
- Accessed: 2026-10-08. Strength: A (govinfo is the Government Publishing Office).
- Quote: "the privilege of delaying payment beyond the trade date shall be withdrawn for 90 calendar days" and "there are sufficient funds in the account"

**BR-10.** How a large broker enforces the cash account rules (Fidelity's own page). Three violation types. Good faith violation: buy a security and sell it before paying for the initial purchase in full with settled funds; three in 12 months means a 90 day restriction. Freeriding: paying for a purchase with the proceeds of selling that same security; one in 12 months means a restriction. Cash liquidation violation: covering a purchase by selling other securities after the purchase; three in 12 months means a restriction. Under restriction, purchases need settled cash in the account first.
- Page: "Avoiding Cash Account Trading Violations - Fidelity"
- URL: https://www.fidelity.com/learning-center/trading-investing/trading/avoiding-cash-trading-violations
- Accessed: 2026-10-08. Strength: A (vendor's own page).
- Quote: "A good faith violation occurs when you buy a security and sell it before paying for the initial purchase in full" and "This restriction will be effective for 90 calendar days."
- Other phrases seen on the page (fragments, as returned by the fetch tool): "If you incur three good faith violations in a 12-month period in a cash account"; "If you incur one freeriding violation in a 12-month period in a cash account, your brokerage firm will restrict your account."

NV: Schwab's own cash account violations page could not be fetched (HTTP 403 and an "unable to authorize" error page on schwab.com, workplace.schwab.com and international.schwab.com). See Not verified and Needs browser.

### Part 1 brokers: Charles Schwab

Access problem that shapes every Schwab finding: schwab.com, developer.schwab.com, workplace.schwab.com and international.schwab.com all refused the fetch tool (HTTP 403, or an error page saying the request "could not be authorized"). No Schwab-owned page was seen live in this session. Everything below about Schwab comes from community documentation (strength D) and is corroboration, not vendor evidence.

**BR-11.** Schwab has a "Trader API - Individual" on developer.schwab.com for a customer's own account. Access means registering a developer account, creating an app, and waiting for approval, which community docs say takes a few days. VENDOR PAGE NOT SEEN (403).
- Page: "Getting Started" (schwab-py documentation, a community Python library)
- URL: https://schwab-py.readthedocs.io/en/latest/getting-started.html
- Accessed: 2026-10-08. Strength: D (two independent community sources agree: schwab-py and the schwabr R package README at https://ftp.fau.de/cran/web/packages/schwabr/readme/README.html).
- Quote: "After your app is created, you will likely see it in an `Approved - Pending` state when you view it in your dashboard." and "This can take up to a few days." (schwab-py); "the Schwab Developer App takes a few days to be fully approved." (schwabr)

**BR-12.** Schwab login lifetime: the access token lasts about 30 minutes and renews automatically, but the refresh token lasts 7 days and cannot be extended. A human has to sign in through a browser again every week. Software cannot run unattended for more than 7 days.
- Page: "Authentication and Client Creation" (schwab-py documentation)
- URL: https://schwab-py.readthedocs.io/en/latest/auth.html
- Corroboration: schwabr README, https://ftp.fau.de/cran/web/packages/schwabr/readme/README.html
- Accessed: 2026-10-08. Strength: D (two independent community sources agree; vendor page blocked).
- Quote: "Tokens are only good for seven days." and "There is currently no way to make a refresh token last longer than seven days." (schwab-py); "After 7 days, you need to manually log in again." (schwabr)

**BR-13.** Schwab order rate: when registering the app the developer picks an order limit, described as order-related requests per minute; the community doc recommends 120.
- Page: "Getting Started" (schwab-py documentation)
- URL: https://schwab-py.readthedocs.io/en/latest/getting-started.html
- Accessed: 2026-10-08. Strength: D.
- Quote: "The order limit is the number of order-related requests your app will be permitted to place each minute." and "Most users have no reason to restrict this, so we recommend setting this to 120."

**BR-14.** Schwab balance fields: a community Go client that mirrors the API's account schema lists fields named CashAvailableForTrading, UnsettledCash, CashBalance, TotalCash, AvailableFundsNonMarginableTrade and BuyingPowerNonMarginableTrade. This suggests the API reports unsettled cash separately, but it is a guess until the vendor schema is seen: field names in a community library are not proof of what a cash account returns.
- Page: "go-schwab-trader" package documentation on pkg.go.dev
- URL: https://pkg.go.dev/github.com/nrm21/go-schwab-trader
- Accessed: 2026-10-08. Strength: D.
- Quote (field names as listed): "CashBalance, CashAvailableForTrading, CashReceipts, TotalCash, UnsettledCash, PendingDeposits, AvailableFundsNonMarginableTrade"

**BR-15.** Schwab MCP server: no official one was found. Community servers exist. Example: sudowealth/schwab-mcp on GitHub, self-described as unofficial, 81 stars, 159 commits, order placement marked experimental. Last commit date was not shown by the fetch.
- Page: "sudowealth/schwab-mcp" (GitHub)
- URL: https://github.com/sudowealth/schwab-mcp
- Accessed: 2026-10-08. Strength: D.
- Quote: "This is an unofficial, community-developed TypeScript MCP server for Charles Schwab." and "`placeOrder`: Place an order (Experimental)."
- Other community Schwab MCP servers surfaced by search but not fetched: vsoneji/schwab-mcp, k1xme/schwab-mcp, acidsolution/schwab-mcp-server, lonniev/schwab-mcp.

NV (Schwab): commissions and fees, paper or sandbox, market data terms, order types, terms on automated trading, whether the API works on a cash account, exact balance schema. All sit on pages that returned 403. See Not verified and Needs browser.

### Part 1 brokers: Alpaca

**BR-16.** Alpaca does not offer a cash account to individuals today. Its docs say every account opens as a margin account. Under 2,000 dollars of equity the account is "limited margin" with 1x buying power.
- Page: "Trading Account" (Alpaca docs)
- URL: https://docs.alpaca.markets/us/docs/account-plans
- Accessed: 2026-10-08. Strength: A.
- Quote: "All accounts are opened as margin accounts." and "Accounts with $2,000 or more equity will have access to margin trading and short selling."
- Second page: "Margin and Short Selling", https://docs.alpaca.markets/us/docs/margin-and-short-selling. Quote: "Accounts with less than $2,000 will not have access to these features and will be restricted to 1x buying power."

**BR-17.** Alpaca staff said in January 2026 that individual cash accounts are planned but have no timeline, and that a setting (max_margin_multiplier=1) makes the API reject orders above available cash while the account stays a margin account.
- Page: "Dan, where's the cash-only account option?" (Alpaca community forum; staff member Dan_Whitnable_Alpaca, posts dated January 26 and 30, 2026)
- URL: https://forum.alpaca.markets/t/dan-wheres-the-cash-only-account-option/18353
- Accessed: 2026-10-08. Strength: D (forum, though the speaker is vendor staff).
- Quote: "Currently all Alpaca accounts are margin accounts." and "Individual cash accounts will be rolled out after that but there is no definite timeline."

**BR-18.** Because Alpaca accounts are margin or limited-margin, sale proceeds can be reused without waiting for settlement. That removes the cash account settlement constraint but means the account sits under the margin rules (see BR-03 to BR-06), not the cash account rules.
- Page: "What are unsettled funds?" (Alpaca Learn; page shows Feb 2, 2022 but cites May 2024)
- URL: https://alpaca.markets/learn/understanding-unsettled-funds
- Accessed: 2026-10-08. Strength: A.
- Quote: "all of our user's accounts are set up as margin accounts or limited-margin accounts" and "you don't need to wait for trades to settle before using the proceeds to buy more equities."

**BR-19.** Alpaca's account endpoint reports cash, buying_power, non_marginable_buying_power and regt_buying_power. No field explicitly reports settled or unsettled cash.
- Page: "Get Account" API reference (Alpaca docs)
- URL: https://docs.alpaca.markets/us/reference/getaccount-1
- Accessed: 2026-10-08. Strength: A.
- Quote: "Current available non-margin dollar buying power" and "Buying power multiplier that represents account margin classification"

**BR-20.** Alpaca login: the Trading API uses a key ID and secret key sent as headers. No expiry is documented on the page (so "keys do not expire" is not verified, only "no expiry is stated"). Paper and live use separate keys and separate addresses.
- Page: "Authentication" (Alpaca docs)
- URL: https://docs.alpaca.markets/us/docs/authentication
- Accessed: 2026-10-08. Strength: A.
- Quote: "Use the `APCA-API-KEY-ID` and `APCA-API-SECRET-KEY` headers to send your key ID and secret key." and "you cannot use your live account's credentials with the paper API, or vice versa."

**BR-21.** Alpaca has a free paper trading environment (paper-api.alpaca.markets).
- Page: "Trading Account" (Alpaca docs), https://docs.alpaca.markets/us/docs/account-plans, and "Authentication", https://docs.alpaca.markets/us/docs/authentication
- Accessed: 2026-10-08. Strength: A.
- Quote: "you will continue to be able to test your strategies and simulate your trades in our paper trading environment." and "Trading API endpoints on `paper-api.alpaca.markets`"

**BR-22.** Alpaca rate limit: 200 API requests per minute per account.
- Page: Alpaca support article on API usage limits
- URL: https://alpaca.markets/support/usage-limit-api-calls
- Accessed: 2026-10-08. Strength: A.
- Quote: "Please note that the API is throttled, currently 200 requests per minute, per account."

**BR-23.** Alpaca commissions: no commission on U.S. listed securities for self-directed individual accounts trading through the API. SEC and FINRA fees may apply (rates not on the page). Price label: published.
- Page: Alpaca support article on commission and clearing fees
- URL: https://alpaca.markets/support/commission-clearing-fees
- Accessed: 2026-10-08. Strength: A. Price: published.
- Quote: "there are no commission charges for Alpaca self-directed individual cash brokerage accounts" and "Relevant SEC and FINRA fees may apply."

**BR-24.** Alpaca market data: the free "Basic" plan gives real-time stock data from one exchange only (IEX), or the consolidated feed ("SIP") delayed 15 minutes; streaming is capped at 30 symbols; 200 historical calls per minute. The consolidated real-time feed is the paid "Algo Trader Plus" plan at 99 dollars a month. Price label: published.
- Page: "About Market Data API" (Alpaca docs)
- URL: https://docs.alpaca.markets/us/docs/about-market-data-api
- Accessed: 2026-10-08. Strength: A. Price: published.
- Quote: "for equities only the IEX exchange, for options only the indicative feed." and "30 symbols" and "$99 / month"

**BR-25.** Alpaca publishes an OFFICIAL MCP server. It can place stock and ETF orders, defaults to paper trading, and documents setup for Claude Desktop and Claude Code. About 1,000 stars, 174 commits. Last commit date not shown by the fetch.
- Page: "alpacahq/alpaca-mcp-server" (GitHub, under Alpaca's own organization)
- URL: https://github.com/alpacahq/alpaca-mcp-server
- Accessed: 2026-10-08. Strength: A.
- Quote: "Alpaca's official MCP Server lets you trade stocks, ETFs, crypto, and options, run data analysis, and build strategies in plain English."

**BR-26.** Alpaca order types through the API: market, limit, stop, stop limit, trailing stop, bracket, OCO (one cancels other). Extended hours: pre-market 4:00am to 9:30am, after-hours 4:00pm to 8:00pm, overnight 8:00pm to 4:00am Eastern, limit orders only. Fractional and dollar-amount ("notional") orders are supported for day orders.
- Page: "Orders at Alpaca" (Alpaca docs)
- URL: https://docs.alpaca.markets/us/docs/orders-at-alpaca
- Accessed: 2026-10-08. Strength: A.
- Quote: "Only limit orders with time_in_force set to day or gtc orders are accepted as extended hours eligible." and "Overnight: 8:00pm - 4:00am ET, Sunday to Friday"

NV (Alpaca): whether Alpaca has moved from the old pattern day trader check to the new intraday margin standard; account minimum; regulatory fee rates; terms on automated trading (the product is API-first, but no terms clause was fetched).

### Part 1 brokers: Interactive Brokers (IBKR)

Access problem: www.interactivebrokers.com, www.ibkr.com, brokerage.ibkr.com, cdcdyn.interactivebrokers.com and interactivebrokers.com.sg all returned HTTP 403 to the fetch tool, and ibkrcampus.com redirects to the blocked host. The only IBKR-owned pages that loaded were the older documentation on interactivebrokers.github.io, which IBKR itself marks as deprecated. Treat IBKR findings as partly stale until the current "IBKR Campus" pages are read in a browser.

**BR-27.** IBKR's TWS API (Trader Workstation application programming interface) does not talk to IBKR directly. It talks to a desktop program (TWS or IB Gateway) that must be running and logged in by a human. IBKR says a headless (no screen) session is not supported.
- Page: "TWS API v9.72+: Initial Setup" (IBKR's own GitHub Pages documentation, marked deprecated in favor of IBKR Campus)
- URL: https://interactivebrokers.github.io/tws-api/initial_setup.html
- Accessed: 2026-10-08. Strength: A (vendor's own, but deprecated).
- Quote: "there must first be a running instance of TWS or IB Gateway." and "For security reasons, a headless session of TWS or IBGW without a GUI is not supported."

**BR-28.** IBKR login cycle for the TWS API: the program is built to restart daily. With auto-restart turned on it can run through the week, but a human must enter credentials again after the Saturday night server reset. So unattended running tops out at about one week.
- Page: "TWS API v9.72+: Initial Setup" (same page as BR-27)
- URL: https://interactivebrokers.github.io/tws-api/initial_setup.html
- Accessed: 2026-10-08. Strength: A (deprecated page).
- Quote: "Both TWS and IBGW were designed to be restarted daily." and "After the nightly server reset on Saturday night it will be necessary to again enter security credentials."

**BR-29.** IBKR TWS API rate limit: up to 50 messages per second from the client. A paper trading account is available once the regular account is approved and funded.
- Page: "TWS API v9.72+: Introduction" (IBKR GitHub Pages documentation, deprecated)
- URL: https://interactivebrokers.github.io/tws-api/introduction.html
- Accessed: 2026-10-08. Strength: A (deprecated page).
- Quote: "The TWS is designed to accept up to fifty messages per second coming from the client side." and "If your regular trading account has been approved and funded"

**BR-30.** IBKR market data through the API is not included. Real-time data needs paid live market data subscriptions; the default allowance is 100 simultaneous "market data lines"; subscriptions bill for the full month.
- Page: "TWS API v9.72+: Streaming Market Data" (IBKR GitHub Pages documentation, deprecated)
- URL: https://interactivebrokers.github.io/tws-api/market_data.html
- Accessed: 2026-10-08. Strength: A (deprecated page).
- Quote: "it is necessary have live market data subscriptions for the requested instruments in TWS." and "By default, every user has a maxTicker Limit of 100 market data lines"

**BR-31.** IBKR Lite (the zero-commission plan) cannot use the API. API use needs IBKR Pro. Two independent non-vendor sources say so; the vendor's own statement was found by search but its page returned 403, so it is not cited as seen.
- Source 1: "Troubleshooting Interactive Brokers Connection" (MotiveWave documentation, a trading platform vendor), https://docs.motivewave.com/knowledge-base/support/interactive-brokers-connection. Strength: C. Quote: "You can only connect with an IBKR Pro connect and not a Lite account as it does not support API connectivity."
- Source 2: "Interactive Brokers Review 2026: Cheapest Margin, 1 Catch" (curvedtrading.com, updated June 19, 2026), https://curvedtrading.com/articles/en/brokers/interactive-brokers/. Strength: C. Quote: "Limited access to some features (no IBKR API, fewer order types)"
- Accessed: 2026-10-08.

**BR-32.** IBKR commissions (vendor pricing page blocked, so corroborated only). IBKR Lite: zero commission on U.S. listed stocks and ETFs. IBKR Pro: fixed 0.005 dollars per share, or tiered 0.0005 to 0.0035 dollars per share. No account minimum. Because the API needs Pro (BR-31), API trading at IBKR is not commission-free. Price label: corroborated (NerdWallet and curvedtrading.com).
- Source 1: "Interactive Brokers Review 2026: Pros, Cons and How It Compares" (NerdWallet, last updated Jul 17, 2026), https://www.nerdwallet.com/reviews/investing/brokers/interactive-brokers. Strength: B. Quote: "IBKR Pro: choice of fixed commission of $0.005 per share, or variable commission of $0.0005 - $0.0035 per share." and "it has no account minimum and charges no annual fees, inactivity fees or transfer fees at all."
- Source 2: curvedtrading.com review (as BR-31). Strength: C. Quote: "Tiered commissions: ~$0.0035 per share, $0.35 minimum, $1 max per order on most US equities"
- Accessed: 2026-10-08. Price: corroborated.
- Unverified detail from a search summary only (page blocked): Pro fixed pricing has a 1.00 dollar minimum per order, and directed API orders may be charged a higher fixed rate. Not cited as a finding.

**BR-33.** IBKR community MCP servers (CORRECTED later in the run: IBKR does have an official MCP offering, see BR-57. An earlier search missed it.) Community example: code-rabi/interactive-brokers-mcp, self-described unofficial and alpha, 219 stars, 187 commits, can place market, limit or stop orders when read-only mode is off. Last commit date not shown by the fetch.
- Page: "code-rabi/interactive-brokers-mcp" (GitHub)
- URL: https://github.com/code-rabi/interactive-brokers-mcp
- Accessed: 2026-10-08. Strength: D.
- Quote: "This is an unofficial, community-developed MCP server and is NOT affiliated with or endorsed by Interactive Brokers."
- Others surfaced by search, not fetched: happy-shine/ibkr_mcp, jinyiabc/ibkr-mcp, kelvingao/ibkr-mcp.

NV (IBKR): everything about the newer Web API or Client Portal API (session length, rate limit, whether individuals get OAuth), cash account support through the API, settled cash field names, the vendor's own commission table, market data prices and the non-professional questionnaire, terms on automated trading. All on blocked hosts.

### Part 1 brokers: Tradier

**BR-34.** Tradier offers a brokerage API to its own account holders. Sign up for an account, then generate API tokens in the account's API settings. One sign-up gives both live trading and a paper trading sandbox. API access is listed as "Included" on every plan.
- Page: "Tradier Brokerage API" (Tradier docs, getting started)
- URL: https://docs.tradier.com/docs/getting-started
- Accessed: 2026-10-08. Strength: A.
- Quote: "visit https://web.tradier.com/user/api to generate your API tokens" and "You'll get access to both live trading and our paper trading sandbox environment"

**BR-35.** Tradier's API supports cash accounts and reports unsettled funds. The balance endpoint has an account_type of "margin" or "cash", and for a cash account returns a "cash" object with cash_available, sweep and unsettled_funds.
- Page: "Get Account Balance" (Tradier API reference)
- URL: https://docs.tradier.com/reference/brokerage-api-accounts-get-account-balance
- Accessed: 2026-10-08. Strength: A.
- Quote (field names from the example response and schema): "cash_available, sweep, unsettled_funds" and account_type enum "margin" and "cash"
- Limit: the page gives the field names but no written description of each.

**BR-36.** Tradier login: an individual uses a personal API token from the account's API settings for all calls. The 24 hour token life and refresh tokens described in the docs belong to the OAuth flow, and refresh tokens are for approved partners only. Whether the personal token ever expires is not stated on the page.
- Page: "OAuth Authentication" (Tradier docs)
- URL: https://docs.tradier.com/docs/authentication
- Accessed: 2026-10-08. Strength: A.
- Quote: "all API calls can be made with your API Token (or Sandbox Token) found in your API Settings." and "Only available to approved Tradier Partners"

**BR-37.** Tradier rate limits: 120 requests per minute for standard and market data calls in production, 60 per minute for trading (order) calls, 60 per minute for everything in the sandbox.
- Page: "Rate Limiting" (Tradier docs)
- URL: https://docs.tradier.com/docs/rate-limiting
- Accessed: 2026-10-08. Strength: A.
- Quote: "Production: 120 requests per minute." and (trading) "Production: 60 request per minute."

**BR-38.** Tradier pricing: Lite plan 0 dollars a month with 0.35 dollars per stock trade; Pro plan 10 dollars a month with 0 dollars per stock trade; Pro Plus 35 dollars a month. Account minimum 0 dollars. Inactivity fee 50 dollars a year if fewer than 2 trades a year. SEC fee 0.00002060 dollars per dollar sold. Price label: published.
- Page: "Pricing & Plans | Tradier"
- URL: https://tradier.com/individuals/pricing
- Accessed: 2026-10-08. Strength: A. Price: published.
- Quote (table cells as returned): "Stocks (per trade)": "$0.35" (Lite), "$0.00" (Pro); "Pro$10/month"; "API Access": "Included"; inactivity fee "$50/year"

**BR-39.** Tradier market data: real-time data from a consolidated feed of all exchanges is included for brokerage account holders. The sandbox gets the same feed delayed 15 minutes. No non-professional condition or extra cost is stated on the page.
- Page: "Market Data" (Tradier docs)
- URL: https://docs.tradier.com/docs/market-data
- Accessed: 2026-10-08. Strength: A.
- Quote: "Real-time data is available to all Tradier Brokerage account holders for US-based stocks and options." and "Real-time data is pulled from a consolidated feed from all exchanges."

**BR-40.** Tradier publishes an OFFICIAL, hosted MCP server at mcp.tradier.com. It can place stock orders, works with a paper trading token, and lists Claude Web, Claude Desktop and Claude Code as supported. The docs describe it as something Tradier "is building", which reads as early-stage.
- Page: "Tradier MCP" (Tradier docs)
- URL: https://docs.tradier.com/docs/tradier-mcp
- Accessed: 2026-10-08. Strength: A.
- Quote: "Tradier is building a custom MCP server to work with popular large language models and tools." and "Places an equity (stock) order including buy/sell, quantity, type, duration, price, and stop price."

**BR-41.** Tradier order types through the API: market, limit, stop, stop_limit, plus linked orders (OTO, OCO, OTOCO). Durations: day, gtc, pre, post. Extended hours: pre-market 7:00 to 9:24 AM and post-market 4:00 to 7:55 PM Eastern. Stock quantities are whole numbers, which suggests no fractional shares (inference from the parameter description, not an explicit statement).
- Page: "Getting Started with the Tradier Trading API" (Tradier docs)
- URL: https://docs.tradier.com/docs/trading
- Accessed: 2026-10-08. Strength: A.
- Quote: "Order type: `market`, `limit`, `stop`, `stop_limit`" and "Number of shares (whole numbers for equities) or contracts"

NV (Tradier): whether the personal API token expires; terms on automated trading; whether streaming is included at no cost.

### Part 1 brokers: TradeStation

Access problem: www.tradestation.com returned HTTP 403 (including its MCP page, its trading API page and its press release). api.tradestation.com documentation pages mostly loaded. businesswire.com also returned 403.

**BR-42.** TradeStation login: access tokens last 20 minutes, and refresh tokens by default never expire. Software can therefore run unattended with no fixed re-login cycle. An optional stricter setup (rotating refresh tokens, 24 hour absolute lifetime) exists only on request.
- Page: "Refresh Tokens | TradeStation API"
- URL: https://api.tradestation.com/docs/fundamentals/authentication/refresh-tokens/
- Accessed: 2026-10-08. Strength: A.
- Quote: "Access Tokens have a lifetime of 20 minutes." and "By default, Refresh Tokens of TradeStation API Keys will be valid indefinitely."

**BR-43.** TradeStation has a simulator environment for the API with its own address, using fake accounts and fake money.
- Page: "SIM vs. LIVE | TradeStation API"
- URL: https://api.tradestation.com/docs/fundamentals/sim-vs-live/
- Accessed: 2026-10-08. Strength: A.
- Quote: "fake trading accounts seeded with fake money." (SIM address given as https://sim-api.tradestation.com/v3)

**BR-44.** TradeStation rate limits are per API key and per category, counted over 5 minute windows: 320 requests per 5 minutes each for accounts, order details, balances and positions; 500 per 5 minutes for quote snapshots and quote streams; up to 40 concurrent order streams. Exceeding returns error 429.
- Page: "Overview | TradeStation API" (rate limiting overview)
- URL: https://api.tradestation.com/docs/fundamentals/rate-limiting/rate-limiting-overview
- Accessed: 2026-10-08. Strength: A.
- Quote: "If the quota is exceeded, an HTTP response of `429 Too Many Requests` will be returned." (table rows: "Balances | 320 | 5-minute", "Quote Snapshot | 500 | 5-minute")

**BR-45.** TradeStation's API offers real-time streaming of market data, quotes, orders and positions, a simulator, and bracket and OCO order types. API keys for personal use are requested through tradestation.com (page blocked); keys for firms need "internal review and onboarding".
- Page: "Brokerage Trading API | Tradestation Fintech Solutions"
- URL: https://developer.tradestation.com/trading-api
- Accessed: 2026-10-08. Strength: A.
- Quote: "HTTP streaming is available for real-time market data, quotes, orders, and positions." and "Issuing of an API key requires internal review and onboarding."

**BR-46.** TradeStation released an official MCP connection on January 13, 2026, built by its own affiliate, working first with Anthropic's Claude and requiring an active Claude Pro subscription, "subject to applicable account minimums and approvals". Vendor page not seen (403); this finding rests on one trade-press article that reproduces the release.
- Page: "TradeStation Securities rolls out MCP Connection" (FX News Group, January 13, 2026)
- URL: https://fxnewsgroup.com/forex-news/retail-forex/tradestation-securities-rolls-out-mcp-connection/
- Accessed: 2026-10-08. Strength: B (trade press).
- Quote: "enhancements coming soon to work with additional popular AI platforms." and "an active Claude Pro subscription."
- Unverified detail, from search summaries of blocked TradeStation pages only: a 10,000 dollar minimum balance for MCP, eligibility limited to accounts classed non-professional for market data, explicit confirmation required before each order, and possible pass-through market data costs for AI client users. These matter for the stack and are listed under Not verified.

**BR-47.** A funded account is needed before TradeStation issues an API key; stock commission is quoted as 0 dollars. Single review source, so the price is not corroborated. Price label: unverified. This is NOT login-gated: the vendor pricing page refused the fetch tool (403) and only one independent source was fetched, so it falls short of "corroborated". A browser read of the vendor page would settle it.
- Page: "TradeStation Review 2026: Best Broker for Automated Traders?" (PickMyTrade blog, August 7, 2026)
- URL: https://blog.pickmytrade.io/tradestation-review-2026-best-broker-for-automated-traders/
- Accessed: 2026-10-08. Strength: C.
- Quote: "But TradeStation won't issue that key until you have a funded account." and "$0 stocks."

NV (TradeStation): balance field names for settled and unsettled cash (the specification page rendered only navigation); cash account support through the API; the 10,000 dollar figure; commissions on the vendor page; market data terms; terms on automation.

### Part 1 brokers: E*TRADE from Morgan Stanley

Access problem: developer.etrade.com returned HTTP 403 and us.etrade.com timed out. The API reference hosted at apisb.etrade.com/docs loaded and is E*TRADE's own.

**BR-48.** E*TRADE login cycle: the production access token expires every day at midnight Eastern, and goes inactive after two hours without a request. After expiry the user must log in again and the app must get a new token. A human sign-in is needed every trading day, so software cannot run unattended across days.
- Page: "Get Access Token" (E*TRADE API documentation)
- URL: https://apisb.etrade.com/docs/api/authorization/get_access_token.html
- Accessed: 2026-10-08. Strength: A.
- Quote: "The production access token expires by default at midnight US Eastern time." and "the user must log in again and the application must secure a new access token."

**BR-49.** E*TRADE's API supports cash accounts and reports settled and unsettled cash as separate fields. Account types include CASH, MARGIN and PDT_ACCOUNT. Fields: cashAvailableForInvestment, settledCashForInvestment, unSettledCashForInvestment, fundsWithheldFromPurchasePower, cashBuyingPower.
- Page: "E*TRADE API Document", Accounts API, "Get Account Balances"
- URL: https://apisb.etrade.com/docs/api/account/api-balance-v1.html
- Accessed: 2026-10-08. Strength: A.
- Quote: "The settled cash for investments" and "The unsettled cash for investments" and "The cash account buying power"

**BR-50.** E*TRADE order types through the API include MARKET, LIMIT, STOP, STOP_LIMIT, several trailing stop variants, MARKET_ON_OPEN and MARKET_ON_CLOSE. Sessions: REGULAR, EXTENDED, EXTO. A DOLLAR quantity type exists, but the page does not say whether fractional shares are supported.
- Page: "E*TRADE API Document", "Order API"
- URL: https://apisb.etrade.com/docs/api/order/api-order-v1.html
- Accessed: 2026-10-08. Strength: A.
- Quote (allowable values as listed): "MARKET, LIMIT, STOP, STOP_LIMIT" and "REGULAR, EXTENDED, EXTO"

**BR-51.** E*TRADE MCP server: no official one found by search. Community example fetched: davdunc/mcp_etrade, 8 stars, 1 commit, personal account, no order-placement tool shown. Others surfaced by search and not fetched: jjmerri/etrade-mcp (market data only), ohenak/etrade-mcp.
- Page: "davdunc/mcp_etrade" (GitHub)
- URL: https://github.com/davdunc/mcp_etrade
- Accessed: 2026-10-08. Strength: D.
- Quote: "E*TRADE MCP Server with OAuth, account management, risk calculations, watch lists, and trading guardrails"

NV (E*TRADE): access process for an individual production key and the sandbox (developer.etrade.com blocked; a search summary says an "individual" key is tied to one user ID and separate sandbox and production keys exist, but the page was not seen), rate limits, commissions, market data terms, terms on automation.

### Part 1 brokers: Webull (OpenAPI)

**BR-52.** Webull has an official API for individuals trading their own accounts. Open a Webull account, apply under OpenAPI Management, and wait for review, estimated at 1 to 2 working days. A sandbox is approved automatically within minutes and is isolated from production. No extra charge for API access.
- Page: "Trading API Application | Webull API"
- URL: https://developer.webull.com/apis/docs/authentication/IndividualApplicationAPI
- Accessed: 2026-10-08. Strength: A.
- Quote: "the process will take `1 to 2` working days at the earliest." and "The Sandbox Trading API application is approved automatically and typically completes within a few minutes."
- Second page: "FAQ | Webull API", https://developer.webull.com/apis/docs/faq. Quote: "There are no extra charges for accessing the API. Trading fees are the same as those in the Webull App." Price: published (the API fee of zero; the underlying trading fees were not fetched).

**BR-53.** Webull login: the app uses a key and secret. If two-factor authentication is on, an extra token is needed, activated once by a human in the Webull phone app. The token becomes invalid after 15 consecutive days with no API calls. Read plainly, software that calls the API at least once every 15 days keeps running without a new human step, but the page does not state that outright.
- Page: "Token | Webull API"
- URL: https://developer.webull.com/apis/docs/authentication/token
- Accessed: 2026-10-08. Strength: A.
- Quote: "When 2FA is activated, an additional Token is required for API authentication." and (invalid when) "No API calls made for 15 consecutive days, or Token does not exist."

**BR-54.** Webull rate limits in production: order placement 600 per 60 seconds, order preview 150 per 10 seconds, account balance 2 per 2 seconds, stock snapshots and quotes 60 per 60 seconds. The rate table has separate rows for "display and non-display" market data, which means Webull distinguishes screen use from machine use of data.
- Page: "Rate Limits" (Webull API docs)
- URL: https://developer.webull.com/apis/docs/rate-limits.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Repeatedly exceeding rate limits may result in temporary IP-level blocking." (rows as returned: "Order placement: 600/60s", "Account balance: 2/2s")

**BR-55.** Webull market data through the API is NOT included with the brokerage account. Subscriptions for OpenAPI are bought separately. The cost was not on the page. Real-time and historical data and live streaming (over a protocol called MQTT) are offered.
- Page: "FAQ | Webull API", https://developer.webull.com/apis/docs/faq, and "Welcome | Webull API", https://developer.webull.com/apis/docs/
- Accessed: 2026-10-08. Strength: A. Price: unverified (the price is not stated on the fetched pages; not known to be login-gated).
- Quote: "Market data subscriptions for OpenAPI are purchased separately" and "Access real-time and historical data including tick, snapshot, quotes, and OHLCV bars for US stocks, futures, and crypto."

**BR-56.** Webull publishes an OFFICIAL MCP server, in a hosted "Cloud" form at api.webull.com/mcp using OAuth sign-in, usable from ChatGPT, Claude and Grok. A stock order created through it requires confirmation in the Webull app or desktop program, so it is not fully hands-off. Trade press (August 5, 2026) reports safeguards such as symbol restrictions and maximum order values.
- Page: "Webull Cloud MCP Server | Webull API"
- URL: https://developer.webull.com/apis/docs/AI-friendly-Resources/mcp/
- Accessed: 2026-10-08. Strength: A.
- Quote: "Webull Cloud MCP is a fully managed MCP service hosted by Webull." and "Create a stock order instruction (requires confirmation in Webull APP / Desktop)."
- Press: "Webull launches MCP server for trading through AI assistants" (TradeInformer, August 5, 2026), https://tradeinformer.com/broker-news/webull-launches-mcp-server-for-trading-through-ai-assistants. Strength: B. Quote: "Clients remain responsible for checking order details and accepting the risks of trades submitted through an AI assistant."
- Not fetched: a local (self-run) Webull MCP server also exists per search results; whether it also requires in-app confirmation is not verified.

NV (Webull): cash account support and settled or unsettled cash field names (the balance reference page showed no schema), commissions, market data subscription price, order types, fractional shares, extended hours.

### Correction: Interactive Brokers official MCP

**BR-57.** IBKR DOES have an official MCP offering, called "AI Integration". On July 28, 2026 it was widened from the ChatGPT, Claude and Grok marketplaces to nearly any MCP tool, including Claude Code. It can analyze the portfolio and draft trade instructions, but it does not place orders: the client must review each instruction and convert it into an order inside an IBKR platform. Sign-in is through an IBKR authorization screen for one account, with no password or API key shared.
- Page: "Interactive Brokers opens MCP access beyond certified AI marketplaces" (TradeInformer, July 29, 2026)
- URL: https://www.tradeinformer.com/broker-news/interactive-brokers-expands-mcp-ai-tool-integration
- Corroboration: "Interactive Brokers adds MCP-compatible AI tool integration for traders" (FOW, 29 July 2026), https://www.fow.com/insights/interactive-brokers-adds-mcp-compatible-ai-tool-integration-for-traders. Quote: "including Claude Code, Cursor, Perplexity and Windsurf." (article paywalled after the introduction)
- Accessed: 2026-10-08. Strength: B (two trade-press sources; IBKR's own press release "Interactive Brokers Opens AI Connectivity to Any Tool Built on the MCP Standard" at https://investors.interactivebrokers.com/en/general/about/mediaRelations/7-28-26.php returned 403).
- Quote: "AI-generated instructions do not become orders automatically." and "does not require clients to share passwords or API keys with the chosen tool."
- Not verified: whether IBKR Lite accounts are eligible for AI Integration.

### Part 1 brokers: Public.com

**BR-58.** Public has an official trading API for individual members, for personal non-commercial use, commission-free. The key is generated in the app under Account Settings, Security, API. It can read balances and buying power and place orders in stocks, ETFs, options, bonds and crypto.
- Page: "Public Trading API - Automate Stocks & Options Orders"
- URL: https://public.com/api
- Accessed: 2026-10-08. Strength: A. Price: published (commission-free claim).
- Quote: "The Public Individual API is for your own personal, non-commercial use." and "Place trades via our commission-free API with real-time execution." and "To generate your key and start building, go to Account Settings > Security > API."

**BR-59.** Public publishes an OFFICIAL, Public-hosted MCP server that connects the brokerage account to Claude, ChatGPT and Perplexity for trading in natural language.
- Page: "Public brokerage API for Algorithmic Trading | Stocks, Options & Crypto" (API documentation landing page)
- URL: https://public.com/api/docs
- Accessed: 2026-10-08. Strength: A.
- Quote: "Connect your Public brokerage to Claude, ChatGPT, and Perplexity through the Public-hosted MCP server"
- Also on https://public.com/api: "Use the Public MCP to connect AI agents to real trading infrastructure."

**BR-60.** Public's API terms (dated June 2026): the API is for building software "solely for their own personal use"; trades through the key are deemed made by the customer; Public may suspend or end API access at any time without cause or notice; market data may carry additional terms; copying other traders' orders across users is prohibited. The terms do not prohibit a customer's own automated application. They do forbid automated scripts that touch Public's platforms other than through the customer's own API application.
- Page: "INDIVIDUAL TRADER API PROGRAM TERMS AND CONDITIONS, June 2026" (PDF; text extracted locally from the fetched file)
- URL: https://public.com/documents/individual-api-program
- Accessed: 2026-10-08. Strength: A.
- Quote: "Public may suspend or terminate your participation in the Individual API Program, use of the API Products, or this Agreement at any time, without cause or prior notice."
- Also in the document (prohibited conduct list): "use automated scripts or processes to collect information from or otherwise interact with the Public Platforms other than your Applications"

NV (Public): token lifetime, rate limits, cash versus margin account support, settled cash fields, paper or sandbox environment, order types, fractional shares, extended hours, market data terms. The documentation landing page lists endpoints (personal access token, portfolio v2, quotes, order preflight and placement) but the fetch returned no detail for any of them.

### Part 1 brokers: tastytrade

**BR-61.** tastytrade has an official API. A customer registers a personal OAuth application on my.tastytrade.com; a personal application is restricted to the customer's own account. Access tokens last 15 minutes. Refresh tokens do not expire. Software can run unattended with no fixed re-login cycle.
- Page: "OAuth2 authentication - tastytrade Developer Docs"
- URL: https://developer.tastytrade.com/docs/authentication/oauth2/
- Accessed: 2026-10-08. Strength: A.
- Quote: "Access tokens are signed JWTs valid for 15 minutes." and "Refresh tokens are long-lived and do not expire." and "On my.tastytrade.com, go to Manage → My Profile → API → OAuth Applications and click + New OAuth client."

**BR-62.** tastytrade has a sandbox environment with separate credentials from production (sandbox address api.cert.tastyworks.com).
- Page: "FAQ - tastytrade Developer Docs", https://developer.tastytrade.com/docs/faq/, and "Quickstart", https://developer.tastytrade.com/docs/get-started/
- Accessed: 2026-10-08. Strength: A.
- Quote: "There is a sandbox environment and a production environment, and each requires a separate set of credentials."

**BR-63.** tastytrade publishes no numeric rate limit for its main API. It throttles at "reasonable thresholds" and returns error 429. Repeated failed logins block the IP address for about eight hours (paraphrase by fetch tool).
- Page: "Rate limits & backoff - tastytrade Developer Docs"
- URL: https://developer.tastytrade.com/docs/guides/rate-limits-and-backoff/
- Accessed: 2026-10-08. Strength: A.
- Quote: "throttles by reasonable thresholds rather than a published per-endpoint quota."

**BR-64.** tastytrade publishes an OFFICIAL MCP server, open source and self-hosted (the user runs it; tastytrade hosts nothing). It defaults to production, has a read-only switch, and order tools need a single-use confirmation token from a dry run, valid 60 seconds. Setup is documented for Claude Desktop and Claude Code. Per a search summary, it must be installed by cloning the repository and needs Node.js 22 or newer (not confirmed in the fetch).
- Page: "MCP Server - tastytrade Developer Docs"
- URL: https://developer.tastytrade.com/docs/sdks-and-tools/mcp-server/
- Accessed: 2026-10-08. Strength: A.
- Quote: "Self-hosted and open source. You run it yourself." and "The source is at github.com/tastytrade/tastytrade-mcp."

NV (tastytrade): cash account support and settled cash fields (the balances page URL tried returned 404), commissions, market data terms and cost, order types, fractional shares, extended hours, API terms of service text.

### Part 1 brokers: Robinhood

**BR-65.** Robinhood has NO general stock-trading API for retail customers in the evidence found, but since May 27, 2026 it has an official "Agentic Trading" product: Trading MCP servers that let a customer's own AI agent trade stocks. It launched in beta with equities only.
- Page: "Robinhood is Now Open to Agents" (Robinhood newsroom, May 27, 2026)
- URL: https://robinhood.com/newsroom/robinhood-is-now-open-to-agents/
- Accessed: 2026-10-08. Strength: A.
- Quote: "Agentic Trading is launching in beta with support for equities only out of the gate." and "your agent only has access to the funds you deposit into that account."
- Limit: no vendor page was found that states "there is no REST trading API for stocks". That part is an absence of evidence. A search summary describes an official Crypto Trading API only.

**BR-66.** Robinhood's agent can only trade in a separate "Robinhood Agentic" account, not the main account. The official MCP address is agent.robinhood.com/mcp/trading. Claude Code and Claude Desktop are listed as supported, among others. A primary individual account in good standing is required.
- Page: "Onboarding an external agent | Robinhood" (support article)
- URL: https://www.robinhood.com/us/en/support/articles/agentic-trading-overview/
- Accessed: 2026-10-08. Strength: A.
- Quote: "Your agent can only place trades in your Robinhood Agentic account." and "You are ultimately responsible for the trades your AI agent places in your account."

**BR-67.** Robinhood lets an external agent place orders WITHOUT per-trade human approval if the customer leaves trade approvals off, which is the default for external agents. Order types: market (shares or dollars), limit, stop limit, stop market. Long stock, options and crypto. Real-time quotes for up to 20 symbols per call.
- Page: "Trading with your agent | Robinhood" (support article)
- URL: https://www.robinhood.com/us/en/support/articles/trading-with-your-agent/
- Accessed: 2026-10-08. Strength: A.
- Quote: "With trade approvals off, your agent can place eligible trades for you without your manual confirmation of each order."
- Quote for the default (fetched a second time to get the exact words): "Trade approvals are turned on by default for Robinhood Agents (built-in agents)," "and are turned off by default for MCP accounts (external agents)."
- Also on the page: "Certain trades may still require your approval even when trade approvals are turned off." and "Get real-time equity quotes and prior close for up to 20 symbols."

NV (Robinhood): whether the Agentic account is a cash or margin account, how settlement and buying power work in it, how long an agent's authorization lasts before a human must reconnect, rate limits, fees, extended hours.

### Part 1 brokers: Fidelity

**BR-68.** Fidelity has no public trading API for retail customers, per one independent source. Its programmatic access (FIX connectivity, a messaging standard used by institutions) is for institutional clients. No Fidelity-owned page stating this was found, so this is weaker than it looks: one source, strength C.
- Page: "Does Fidelity Have an API? - Blog | TradersPost" (published September 3, 2025; last modified August 6, 2026)
- URL: https://blog.traderspost.io/article/does-fidelity-have-an-api
- Accessed: 2026-10-08. Strength: C.
- Quote: "Fidelity does not currently offer a public API for retail traders, focusing instead on institutional clients..."
- Search-only context, not fetched: a community MCP project on Glama drives Fidelity's website by browser automation and states Fidelity has no public API. No official Fidelity MCP server was surfaced.

### Part 2 rules, continued: reuse of the same dollars, market data classes, automation statements

**BR-69.** Reusing the same dollars in a cash account (what the sources say, and no more). Only cash, or sale proceeds of securities that were fully paid for, count as "settled funds". Fidelity's worked example: sell stock XYZ on Monday, buy stock ABC with those unsettled proceeds, then sell ABC before Tuesday (when the XYZ sale settles), and that is a good faith violation. A buyer who had sufficient settled funds for the purchase does not incur one. Combined with T+1 (BR-01, BR-02): a dollar of settled cash can fund a buy and a same-day sell without a violation, the proceeds of that sale are unsettled until the next business day, and a second same-day round trip funded by those unsettled proceeds is a good faith violation at the moment the second position is sold. No source fetched gives a numeric "trades per day" limit; the limit is the amount of settled cash at the start of the day.
- Page: "Avoiding Cash Account Trading Violations - Fidelity"
- URL: https://www.fidelity.com/learning-center/trading-investing/trading/avoiding-cash-trading-violations
- Accessed: 2026-10-08. Strength: A (vendor's own page; describes Fidelity's enforcement, and the regulatory basis is BR-09).
- Quote: "Only cash or the sales proceeds of fully paid for securities qualify as "settled funds."" and "If Marty sells ABC stock prior to Tuesday (the settlement date of the XYZ sale)"
- Also on the page (fragment): "Trudy has not incurred a good faith violation because she had sufficient settled funds"
- Guess, labelled as such: the sentence "one round trip per settled dollar per day" is my summary of these sources, not a quote. What would turn it into a measurement: the chosen broker's own cash account page, which for Schwab could not be fetched.

**BR-70.** "Non-professional subscriber" (the cheaper market data class), as NYSE defines it: a natural person receiving market data solely for personal, non-business use, who is not registered with a securities or commodities regulator or exchange and is not acting as an investment adviser. If the data is received through an account not registered to a natural person (for example a company account), the person is classed professional even if the use is personal. Stack consequence: the brokerage or data account should be in the owner's own name, not a company's.
- Page: NYSE "Nonprofessional Subscriber Policy" (PDF, file dated April 6, 2017; text extracted locally from the fetched file)
- URL: https://www.nyse.com/publicdocs/nyse/data/Policy-Non-ProfessionalSubscribers_PDP.pdf
- Accessed: 2026-10-08. Strength: A (exchange's own policy). Caveat: the file is old; a newer version may exist.
- Quote: "any natural person who receives market data solely for his/her personal, non-" (business use) and "This is because the account through which the market data is received is not registered to a natural person."

**BR-71.** "Non-display use" is a separate exchange fee category for data consumed by machines instead of read on a screen. NYSE's examples include "Automated order or quote generation" and "Price referencing for algorithmic trading". The NYSE policy is written around organizations and data-feed recipients. Whether a retail individual feeding broker-supplied quotes into a personal program is charged non-display fees is NOT settled by this document; brokers decide how to pass this on (Webull lists "display and non-display" data separately, BR-54).
- Page: "NYSE Market Data Policy Package", section "NYSE Non-Display Use Policy" (PDF, file dated February 6, 2019; text extracted locally)
- URL: https://nyse.com/publicdocs/nyse/data/NYSE_Market_Data_Complete_Policy_Package.pdf
- Accessed: 2026-10-08. Strength: A (exchange's own policy). Caveat: old file, and it covers NYSE proprietary products, not the consolidated tape plans.
- Quote: "Examples of Non-Display Use are, but are not limited to: Any trading in any asset class Automated order or quote generation and/or order pegging Price referencing for algorithmic trading"

**Part 2 item 6, statements about AI or automated order placement (pointer to findings already recorded).** Broker positions differ, and this bears directly on the driver model:
- Robinhood: external agents can place orders with no per-trade approval if approvals are left off; customer is responsible (BR-66, BR-67).
- Interactive Brokers AI Integration: AI drafts instructions only; a human must convert each into an order (BR-57).
- Webull Cloud MCP: stock order instructions need confirmation in the Webull app or desktop program (BR-56).
- tastytrade MCP: order tools need a single-use confirmation token from a dry run (BR-64). The page does not say a human must supply it.
- Alpaca MCP: places orders; paper trading by default (BR-25).
- Tradier MCP: places orders; paper token supported (BR-40).
- Public: API terms put all trades on the customer and allow suspension without notice (BR-60).
- TradeStation MCP: confirmation before orders, per a search summary only (BR-46, unverified detail).
- Regulator: no SEC or FINRA statement specific to a retail customer's own AI agent placing orders was fetched. A search surfaced a joint SEC and FINRA "Automated Investment Tools" investor alert and a joint AI fraud alert, both about third-party tools and fraud, not about self-run agents. Not cited as findings.

**BR-72.** Last-update dates of MCP server repositories, from each repository's commit list.
- Alpaca official, alpacahq/alpaca-mcp-server: most recent commit Sep 25, 2026 ("sync: September 2026 specs, add option stop orders (#126)"). URL: https://github.com/alpacahq/alpaca-mcp-server/commits/main. Strength: A.
- tastytrade official, tastytrade/tastytrade-mcp: most recent commit September 3, 2026. URL: https://github.com/tastytrade/tastytrade-mcp/commits/main. Strength: A.
- Schwab community, sudowealth/schwab-mcp: most recent commit June 2, 2025, so not updated for over a year. URL: https://github.com/sudowealth/schwab-mcp/commits/main. Strength: D.
- IBKR community, code-rabi/interactive-brokers-mcp: commit list did not render ("There isn't any commit history to show here."). Not verified.
- Accessed: 2026-10-08.

## 2. Per-broker summary table

Built only from the findings above. "NV" means not verified in this run. "Blocked" means the vendor's pages refused the fetch tool.

| Broker | Official retail API for own account, and access | Cash account through the API | Paper or sandbox | Settled versus unsettled cash reported | Login cycle (can it run unattended?) | Rate limits | Stock and ETF cost | Market data with the API | Official MCP server | Automation or AI terms | Order types, fractional, extended hours |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Charles Schwab | Yes per community docs; app approval takes a few days (BR-11). Vendor pages blocked | NV | NV | Community schema lists UnsettledCash and CashAvailableForTrading (BR-14, strength D) | Human sign-in every 7 days (BR-12, strength D, two sources) | Order limit chosen at registration, 120 per minute suggested (BR-13) | NV (blocked) | NV | None found; community only, sudowealth/schwab-mcp last commit June 2025 (BR-15, BR-72) | NV | NV |
| Alpaca | Yes, key and secret (BR-20) | NO. All accounts are margin; limited margin under 2,000 dollars (BR-16, BR-17, BR-18) | Yes, free (BR-21) | No explicit field; non_marginable_buying_power exists (BR-19) | Keys, no expiry stated (BR-20) | 200 requests per minute (BR-22) | 0 commission, published (BR-23) | Free: IEX only real time, 30 symbols; consolidated real time 99 dollars a month (BR-24) | YES, official, active Sep 2026 (BR-25, BR-72) | NV | Market, limit, stop, stop limit, trailing, bracket, OCO; fractional; pre, post and overnight (BR-26) |
| Interactive Brokers | Yes, but Pro plan only, not Lite (BR-31, strength C) | NV (blocked) | Yes after funding (BR-29) | NV | TWS API needs a logged-in desktop program; human login about weekly; no headless mode (BR-27, BR-28) | 50 messages per second (BR-29) | Pro: 0.005 dollars per share fixed, corroborated (BR-32) | Not included; paid subscriptions; 100 data lines (BR-30) | YES, "AI Integration", but drafts instructions only, no order placement (BR-57, strength B) | AI output must be converted to an order by the client (BR-57) | NV |
| Tradier | Yes, token from account settings (BR-34) | YES, account_type cash (BR-35) | Yes (BR-34) | YES: cash_available, unsettled_funds (BR-35) | Personal token; expiry not stated (BR-36) | 120 per minute data, 60 per minute orders (BR-37) | Lite 0.35 dollars per trade; Pro 10 dollars a month with 0 per trade; 50 dollar inactivity fee; published (BR-38) | Real time, consolidated, included for account holders (BR-39) | YES, official, hosted, places orders (BR-40) | NV | Market, limit, stop, stop limit, OTO, OCO, OTOCO; whole shares; pre and post (BR-41) |
| TradeStation | Yes, key on request with funded account (BR-45, BR-47). Vendor site blocked | NV | Yes, SIM (BR-43) | NV | Refresh tokens valid indefinitely by default (BR-42) | 320 per 5 minutes accounts and balances; 500 per 5 minutes quotes (BR-44) | "0 dollars stocks" one review, unverified (BR-47) | Real-time streaming offered (BR-45); terms NV | YES, for Claude, Claude Pro needed (BR-46, strength B); 10,000 dollar minimum unverified | Confirmation before orders, unverified (BR-46) | Bracket, OCO (BR-45); rest NV |
| E*TRADE | Yes (API docs live); key process NV (developer site blocked) | YES, CASH account type (BR-49) | NV (sandbox host exists; process blocked) | YES: settledCashForInvestment, unSettledCashForInvestment (BR-49) | Human sign-in EVERY DAY; token dies at midnight Eastern (BR-48) | NV | NV | NV | None found; community only (BR-51) | NV | Market, limit, stop, stop limit, trailing; extended sessions; fractional NV (BR-50) |
| Webull | Yes, apply, 1 to 2 working days (BR-52) | NV | Yes, automatic (BR-52) | NV | Token invalid after 15 days without calls; one-time app verification (BR-53) | Orders 600 per 60 seconds; balance 2 per 2 seconds; quotes 60 per 60 seconds (BR-54) | No API fee; trading fees same as app, not fetched (BR-52) | NOT included; separate OpenAPI subscription, price NV (BR-55) | YES, official hosted; orders need in-app confirmation (BR-56) | Client responsible for AI-submitted trades (BR-56) | NV |
| Public.com | Yes, key from account settings, personal use (BR-58) | NV | NV | NV | NV | NV | Commission-free, published (BR-58) | NV | YES, official hosted (BR-59) | Personal use only; suspension without notice (BR-60) | NV |
| tastytrade | Yes, personal OAuth app (BR-61) | NV | Yes (BR-62) | NV | Refresh tokens do not expire (BR-61) | No published number (BR-63) | NV | NV | YES, official, self-hosted, active Sep 2026 (BR-64, BR-72) | Order tools need a dry-run confirmation token (BR-64) | NV |
| Robinhood | No general stock API found; official Agentic Trading MCP instead (BR-65) | NV (separate Agentic account; type not stated) | NV | NV | NV | NV | NV | Real-time quotes, 20 symbols per call (BR-67) | YES, official; can place orders without per-trade approval (BR-66, BR-67) | Customer responsible for agent's trades (BR-66) | Market, limit, stop limit, stop market; dollar-based orders (BR-67) |
| Fidelity | NO retail API, one source, strength C (BR-68) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | None found (BR-68) | n/a | n/a |

## 3. Not verified

Each item lists what was tried.

1. **Schwab, everything from Schwab's own pages** (API eligibility for a cash account, sandbox, balance schema, commissions, market data terms, order types, automation terms, and Schwab's cash account violations page that the brief asked for by name). Tried: https://developer.schwab.com/products/trader-api--individual, https://developer.schwab.com/user-guides/get-started/authenticate-with-oauth, https://www.schwab.com/pricing, https://www.schwab.com/learn/story/avoid-these-violations-when-trading-cash, https://workplace.schwab.com/story/avoid-these-violations-when-trading-cash, https://international.schwab.com/story/understanding-stock-settlement-dates-violations, https://help.streetsmart.schwab.com/edge/1.0/Content/Unsettled%20Funds.htm. All returned 403, an authorization error page, or did not resolve. A search summary (not a fetched page) says Schwab warns twice then restricts for 90 days on the third good faith violation in 12 months, and restricts at once on a single freeride.
2. **IBKR Web API or Client Portal API** (session length, rate limit, whether individuals get OAuth), IBKR cash account support and settled cash field, vendor commission table, market data prices, non-professional questionnaire, Lite eligibility for AI Integration. Tried six IBKR hosts, all 403; interactivebrokers.github.io/cpwebapi returned a title only.
3. **Whether each broker has moved to the new intraday margin standard or is still applying the old pattern day trader rule during the phase-in to October 20, 2027** (BR-04). Not searched broker by broker. Matters only if a margin account is ever used (for example at Alpaca, where there is no cash account).
4. **Alpaca**: key expiry, account minimum, regulatory fee rates, automation terms.
5. **Tradier**: whether the personal API token expires; streaming cost; automation terms. Tried docs.tradier.com authentication and getting-started pages.
6. **TradeStation**: 10,000 dollar minimum for MCP, non-professional-only eligibility, confirmation before orders, pass-through data costs, balance fields, commissions. Tried https://tradestation.com/platforms-and-tools/mcp, https://www.tradestation.com/platforms-and-tools/trading-api/, the Business Wire release (all 403), and https://api.tradestation.com/docs/specification/ (navigation only).
7. **E*TRADE**: individual key process, sandbox process, rate limits, commissions. Tried https://developer.etrade.com/getting-started and /developer-guides (403), https://us.etrade.com/what-we-offer/pricing-and-rates and https://us.etrade.com/knowledge/library/stocks/understanding-cash-account-violations (timeouts).
8. **Webull**: cash account support, balance fields, market data subscription price, commissions, order types. Tried the balance reference page (no schema) and a guessed market data page (404).
9. **Public.com**: token lifetime, rate limits, account types, balance fields, sandbox, order types, market data. Tried https://public.com/api/docs (endpoint list only).
10. **tastytrade**: cash account support, balance fields, commissions, market data, order types, API terms text. Tried a guessed balances URL (404) and the FAQ and quickstart pages.
11. **Robinhood**: whether the Agentic account is cash or margin, settlement behavior, authorization lifetime, rate limits, fees. Tried the newsroom post and two support articles.
12. **Fidelity**: a Fidelity-owned statement that no retail API exists. Only one independent source fetched.
13. **eCFR text of 12 CFR 220.8**: ecfr.gov redirected to an unblock page. The govinfo.gov 2025 annual edition and Cornell's copy were used instead; amendments after the 2025 annual edition, if any, were not checked.
14. **Verbatim text of FINRA Rule 4210(d)(2)(D)**: the fetch tool paraphrased it.
15. **CTA and UTP consolidated tape plan definitions** of non-professional and non-display (ctaplan.com, utpplan.com), and Nasdaq's own policy. Only NYSE proprietary-product policies (2017 and 2019 files) were read.
16. **A regulator statement about a retail customer's own AI agent placing orders.** One search; only third-party-tool and fraud alerts surfaced.
17. **Other U.S. brokers with retail APIs.** None was surfaced by the evidence beyond the eleven named. No dedicated search was run for others, so this is not a claim that none exist. SnapTrade (an aggregator) appeared in search results as a way third-party apps reach Schwab, E*TRADE and Fidelity; not investigated.

## 4. Needs browser

Pages that refused the fetch tool or did not render. No browser tools were used in this session.

- https://developer.schwab.com/products/trader-api--individual (403)
- https://developer.schwab.com/user-guides/get-started/authenticate-with-oauth (403)
- https://www.schwab.com/pricing (authorization error page)
- https://www.schwab.com/learn/story/avoid-these-violations-when-trading-cash (authorization error page)
- https://workplace.schwab.com/story/avoid-these-violations-when-trading-cash (403)
- https://international.schwab.com/story/understanding-stock-settlement-dates-violations (403)
- https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/ (403)
- https://www.interactivebrokers.com/campus/ibkr-api-page/twsapi-doc/ (403)
- https://www.interactivebrokers.com/docs/web-api/web-api-v-1-0-documentation/ (403)
- https://www.interactivebrokers.com/en/trading/ib-api.php (403)
- https://www.interactivebrokers.com/en/general/compare-lite-pro.php (403 on mirror hosts)
- https://www.interactivebrokers.com/commissions (not fetched directly; sister hosts 403)
- https://investors.interactivebrokers.com/en/general/about/mediaRelations/7-28-26.php (403)
- https://www.interactivebrokers.com/docs/third-party-integrations/general-third-party-frequently-asked-questions (surfaced by search, host blocked)
- https://interactivebrokers.github.io/cpwebapi/ (title only, body needs JavaScript)
- https://tradestation.com/platforms-and-tools/mcp (403)
- https://www.tradestation.com/platforms-and-tools/trading-api/ (403)
- https://www.tradestation.com/press-and-news/tradestation-securities-releases-mcp-connection-allowing-users-to-connect-trading-accounts-with-third-party-ai-platforms/ (host blocked)
- https://api.tradestation.com/docs/specification/ (navigation only, body needs JavaScript)
- https://developer.etrade.com/getting-started (403)
- https://developer.etrade.com/getting-started/developer-guides (403)
- https://us.etrade.com/what-we-offer/pricing-and-rates (timeout)
- https://developer.webull.com/apis/docs/reference/account-balance (schema did not render)
- https://public.com/api/docs (endpoint detail did not render)
- https://robinhood.com/us/en/support/agentic-trading (index only)
- https://www.ecfr.gov/current/title-12/chapter-II/subchapter-A/part-220/section-220.8 (redirect to unblock page)
- https://www.businesswire.com/news/home/20260112743966/en/ (403)
- https://www.babypips.com/news/explainer-ai-trading-agent-costs-2026-09-24 (403)

## 5. Contradictions between sources

1. **Alpaca, cash account wording.** Alpaca's commission disclosure refers to "self-directed individual cash brokerage accounts" (BR-23), while its docs say "All accounts are opened as margin accounts." (BR-16) and staff said in January 2026 "Currently all Alpaca accounts are margin accounts." (BR-17). The docs and staff statement are more specific and more recent in substance; the disclosure wording looks like boilerplate. Treat Alpaca as having no cash account until Alpaca says otherwise.
2. **Robinhood launch scope.** Robinhood's newsroom post says the beta launched with "equities only" (BR-65). A search summary of third-party sites said equities and options at launch. The later support article lists equities, options and crypto (BR-67). Consistent if options and crypto were added after launch.
3. **Schwab token lifetime in a community MCP server.** schwab-py and schwabr both say the refresh token lasts 7 days (BR-12). The sudowealth/schwab-mcp page mentions "31-day token persistence with TTL". That phrase appears to describe how the server stores tokens, not Schwab's refresh token life. Unresolved without Schwab's own page.
4. **IBKR and MCP.** A first search found no official IBKR MCP server and I recorded that. A later search found IBKR's July 28, 2026 "AI Integration" expansion (BR-57). BR-33 was corrected. Lesson for the reader: "none found" entries for Schwab, E*TRADE and Fidelity rest on one or two searches each and could be overturned the same way.
5. **TradeStation 10,000 dollar minimum.** A search summary attributes a 10,000 dollar minimum to TradeStation's MCP page; the one press article fetched says only "subject to applicable account minimums and approvals" (BR-46); a review says only a "funded account" is needed for an API key (BR-47). Not resolved.
6. **FINRA investor page versus older descriptions.** Search summaries still described a FINRA day trading page with the four-trades-in-five-days and 25,000 dollar rule. The live page (dated June 04, 2026, now titled "Frequent Intraday Trading: Understanding the Basics") no longer mentions the pattern day trader rule (BR-02, BR-08). The live page governs.
7. **Regulation T freeze versus broker penalties.** Regulation T has one consequence, a 90 calendar day withdrawal of the privilege of delaying payment (BR-09). Brokers layer their own counts on top: Fidelity restricts after three good faith violations or three cash liquidation violations in 12 months, and after one freeriding violation (BR-10). These are house rules and may differ by broker.

## Late addendum (after the sections above were written)

**BR-73.** Weak sign that Alpaca has moved to the new intraday margin standard: its "User Protection" docs page lists an "Intraday Margin Rule" and no longer mentions pattern day traders. The page text fetched does not state the rule or a date, so this stays an indication, not a confirmation (see Not verified item 3).
- Page: "User Protection" (Alpaca docs)
- URL: https://docs.alpaca.markets/us/docs/user-protection
- Accessed: 2026-10-08. Strength: A (for what the page lists), weak for the inference.
- Quote: "We have enabled several types of protections to enhance your trading experience."
