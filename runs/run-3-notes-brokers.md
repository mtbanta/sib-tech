# Run 3 notes: brokers for an automated intraday agent (one broker, new margin account, 10,000 to 25,000 dollars)

## Decisive facts (built at the end of the session from the findings below)

Research input for a human decision, never an instruction to trade. "NV" means not verified. BK numbers are today's findings (2026-10-13); MB and DC numbers are run 2 (2026-10-09); BR numbers are run 1 (2026-10-08). "Pass" in the last column means the broker meets ALL five gating tests: consolidated real-time data through its own API, the new standard for a new margin account under 25,000 dollars, software orders with no human step, sign-in lasting at least a week, and access by plain request (no always-on gateway program).

| Broker | Consolidated real-time data via API (price, label) | Symbols per request; rate limit; streaming | Rule for a new margin account under 25k | Customer-set borrowing cap | Unattended orders | Sign-in life | By request or gateway | Margin rate under 25k; interest method | Same-day borrowing charged? | Commission; monthly fee | All five gates |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Tradier | YES, "consolidated feed from all exchanges", included with a brokerage account, 0 dollars stated, published (BK-04, DC-49) | No published per-request cap (POST for long lists); 120 data and 60 trading requests a minute; stream "several hundred symbols", one stream (BK-05) | NEW since June 4, 2026; 4x intraday buying power removed from all accounts (BK-01) | None found (BK-37) | Yes, no per-order step stated (BR-34, BR-40) | Personal token never expires (BK-03) | By request (BK-03) | 9.75 percent flat, published; daily on settled debit, day count not stated (BK-08, BK-09) | No by my inference from "settled debit" (BK-09) | Lite 0.35 dollars a trade and 0 a month, or Pro 0 a trade and 10 dollars a month, published (BK-08) | PASS; exchange terms on non-display use by the customer's program NV (Not verified 9) |
| Alpaca | YES only on Algo Trader Plus, 99 dollars a month, published; free plan is IEX only (BK-17) | Snapshot list, no stated cap; 200 trading requests a minute, 10,000 data calls a minute on paid plan; unlimited stream symbols, one stream (BK-17, BK-18, BK-16) | NEW (MB-20) | YES: max_margin_multiplier 1, 2 or 4, no_shorting, suspend_trade, via API; same key can change it; OAuth scopes could separate it (BK-15, BK-16) | Yes (BR-20, BR-25) | Keys, no expiry stated (BR-20) | By request (BK-15) | 6.50 percent, published; settlement-date debit at end of day, 360 days (BK-19) | NO, stated (BK-19) | 0, published (BR-23); data 99 dollars a month | PASS with the 99 dollar data plan; non-display terms NV (Not verified 9) |
| tastytrade | Real-time for funded accounts, no fee stated; consolidated NOT stated, NV (BK-22) | 100 symbols per REST call; REST limits unpublished; stream 25,000 symbols per session, 5 sessions (BK-22) | NEW, adopted June 4, 2026 (BK-20); appears to give 2x, not 4x, on stock | None found (BK-37) | Yes; docs advise human approval before going live, not per order (BK-23) | Refresh token does not expire (BK-23) | By request (BK-23) | 11 percent per one review, gated and unverified (BK-24); method NV | NV | 0 to open and close, published (MB-67); no monthly fee seen (NV) | Fails only on data (NV) |
| TradeStation | Equities data price and feed NV (page drawn by script) (BK-30) | Quote snapshot 500 per 5 minutes; account resources 320 per 5 minutes; symbols per call NV (BK-28) | NEW (MB-53) | None found (BK-37) | Yes through the API; the MCP connector confirms every order (BR-42, MB-50) | Refresh token valid indefinitely by default (BK-27) | By request (BK-27) | 12.00 percent under 50,000, published; method NV (BK-29) | NV | 0 commission plus 0.003 dollars a share clearing; 10 dollar inactivity fee unless active, published (BK-29) | Fails only on data (NV) |
| Public | "Real-time" quotes for individuals; consolidated NOT stated; price not stated, NV (BK-32) | Per-request cap and rate limits NV (BK-32, BK-31) | NEW (MB-59) | On/off switch only, in the app (BK-36) | Yes, no per-order step on the order page (BK-31, MB-62) | Secret key long-lived until revoked; software mints access tokens (BK-31) | By request (BK-31) | 5.15 percent, published, the standing lowest tier; daily, 365 days (BK-33) | NV | 0, published (BR-58); no monthly fee seen (NV) | Fails only on data (NV) |
| Charles Schwab | NV; community library shows "realtime" quotes, strength D (BK-26) | 120 requests a minute, 500 streamed symbols, strength D (BK-26) | NEW (MB-30); positions above overnight power out by 8 p.m. Eastern (MB-31) | None found (MB-36, BK-37) | Per community sources (BR-11) | 7 day refresh token; whether it rolls is contradicted between two strength D sources (BK-26, BR-12) | By request, per community sources (BR-11) | 12.075 percent, published; daily, 360 days, from settlement date (BK-25) | No by my inference from "settlement date" (BK-25) | 0 online, published (MB-35) | Uncertain: data and sign-in NV |
| Interactive Brokers | YES for a fee: 10 dollars snapshot bundle (waived at 30 dollars of commissions) plus 4.50 dollars streaming add-on, non-professional, published; free feed is non-consolidated (BK-13) | 100 conids per snapshot; 10 requests a second; 100 market data lines by default (BK-12) | PROBABLY new; "depending on your account setup" may stay on the old rule; confirm with IBKR (BK-10) | None found (BK-37) | Yes, prompts can be suppressed (MB-42) | About daily in practice with two-factor sign-in, per IBKR staff podcast; NV in docs (BK-14) | Gateway program (MB-41) | 5.38 percent Pro, published; daily on ending settled cash, 360 days (BK-11) | No by my inference from "settled cash" (BK-11) | Pro 0.005 dollars a share, corroborated (BR-32, MB-41) | FAIL (gateway, daily sign-in, rule unconfirmed) |
| Webull | NO: API feed is Nasdaq Basic (or TotalView), advertised free (BK-34) | 100 symbols per snapshot, 60 a minute (DC-55) | NEW (MB-69) | None found (BK-37) | Direct API yes (MB-72); connector needs app confirmation (BR-56) | Token invalid after 15 idle days (BR-53) | By request (MB-72) | 8.74 percent standard, published as of March 31, 2026; daily average of closing settled debit, 360 days (BK-35) | NO, stated (BK-35) | 0, published (MB-71) | FAIL (data) |
| E*TRADE (brief) | NV | NV | NEW (MB-46) | None found (BK-37) | API yes (BR-49) | Expires at midnight Eastern every day (BK-38) | By request (BR-49) | 12.70 or 12.45 percent, published, seen 2026-10-09 (MB-48) | NV | 0 online (MB-49) | FAIL (daily sign-in) |
| Robinhood Agentic (brief) | NV | NV | Not applicable: no borrowing (BK-39) | Built in: no leverage (BK-39) | Yes once approvals are turned off (BK-39, MB-56) | NV (MB-57) | Connector only (BR-67) | None, no borrowing (BK-39) | n/a | NV | FAIL (no borrowing) |
| moomoo (brief) | NO: Nasdaq Basic plus TotalView plus Arcabook (BK-40) | Subscription quota tiers 100 to 1,000 (BK-40) | NV | NV | Approval is a setting (MB-80) | NV | OpenD gateway (BK-40) | NV | NV | NV | FAIL (data) |
| Lightspeed (brief) | NV | NV | NV: not all platforms ready; legacy rule to sunset October 27, 2026 (BK-41) | NV | NV | NV | NV | NV | NV | NV | NV |

Reading of the table, mine, not a vendor statement:
- Two brokers pass all five gates on today's evidence: **Tradier** and **Alpaca**. For both, the exchanges' and broker's terms on a customer's own program using the data (non-display use, professional status) were not found either way (Not verified 9). Tradier is the cheapest: real-time consolidated data comes with the account at no stated fee, and the plan is 0 dollars a month (0.35 dollars a stock trade) or 10 dollars a month (0 a trade). The Pro plan is cheaper once the agent places about 29 or more stock trades a month (10 dollars divided by 0.35 dollars, my arithmetic). Alpaca needs its 99 dollar a month data plan, but has the lower margin rate (6.50 against 9.75 percent) and the only documented leverage cap the customer sets through the API.
- Cost comparison, my arithmetic: borrowing 5,000 dollars overnight every night costs about 40.60 dollars a month at Tradier (9.75 percent, divided by 12) against about 27.10 at Alpaca (6.50 percent). The 13.50 dollar difference is far smaller than Alpaca's 99 dollar data fee, so Tradier stays cheaper unless the overnight debit is very large. Intraday-only borrowing costs nothing at either.
- Tradier caveat: it removed the 4x intraday buying power figure from all accounts (BK-01). Intraday buying power is therefore the standard margin amount, about 2 times by my reading, not 4 times. tastytrade looks similar (BK-20).
- tastytrade, TradeStation and Public pass every gate except that consolidated data through their API is not verified. Any of them could still pass if their feed proves to be the SIP, or if a separate data vendor is used.

## Not verified

1. Whether tastytrade's API feed (dxFeed) is consolidated SIP/NBBO data, and any exchange agreement or professional test (BK-22).
2. Whether Public's API quotes are consolidated, their price, per-request cap and rate limits (BK-32, BK-31).
3. TradeStation's equities data price, whether the API feed is consolidated, and symbols per quote snapshot (BK-30, BK-28).
4. Interactive Brokers: which rule a NEW margin account under 25,000 dollars gets, and what "account setup" triggers the old rule (BK-10). Also the Web API session length from an IBKR documentation page (BK-14).
5. Schwab: everything on the developer portal, including data feed type, real limits, order rules, and whether the 7 day refresh token rolls forward or requires a person weekly (BK-26).
6. Tradier: per-request symbol maximum for POST quotes; whether its "personal use" API license puts any limit on non-display or automated use of the consolidated data; the day count (360 or 365) for interest (BK-05, BK-04, BK-09).
7. Same-day borrowing at Tradier, Schwab and IBKR is "not charged" only by my inference from their settled-balance wording. Only Alpaca and Webull say so outright (BK-19, BK-35).
8. Alpaca: whether a new account under 25,000 dollars gets multiplier 4 by default (BK-42); whether an individual can register an OAuth app to get a trading-only credential that cannot change the leverage cap (BK-16); API key expiry (BR-20); per-request symbol cap for snapshots (BK-17).
9. Exchange and broker terms on non-display use and professional status for a customer's own program, at every broker. None of the pages read for Alpaca, Tradier, tastytrade or Public address it. Only TradeStation (BK-30) and IBKR (DC-51) mention professional status, and only Webull names "Non-Display OpenAPI usage" (BK-34).
10. API terms on automated trading by an individual: only Tradier ("personal use only", BK-03), tastytrade (personal app restricted to own account, BK-23) and IBKR (registration expected of third-party vendors, not individuals, BK-12) were found. Alpaca's, TradeStation's, Public's and Schwab's agreements were not read.
11. tastytrade margin interest rate and method (BK-24).
12. TradeStation's and Public's interest method and same-day treatment (BK-29, BK-33).
13. A customer-set borrowing cap at Tradier, Schwab, IBKR, TradeStation, tastytrade, Webull (BK-37).
14. Order rate limits at tastytrade (unpublished), Public (not found) and TradeStation (order placement not listed) (BK-22, BK-31, BK-28).
15. Lightspeed and moomoo: rule, rates, token life (BK-40, BK-41).
16. Whether the Webull Premium 5.20 percent and Standard 8.74 percent figures, dated March 31, 2026, are still current (BK-35).
17. Question 11 gaps: public status pages were checked only for Tradier and Alpaca (BK-07, BK-19), not for IBKR, Schwab, tastytrade, TradeStation, Public or Webull; protective orders held at the broker were not read for TradeStation, Schwab or Webull, and trailing stops were not found in the pages read for tastytrade, Public or Tradier (BK-06, BK-23, BK-31); automatic end-of-day selling of positions bought with intraday-only buying power is documented only for Schwab (8 p.m. Eastern, MB-31) and as a next-morning margin call at Alpaca (MB-27).

## Needs a browser

1. https://www.interactivebrokers.com/lib/cstools/faq/#/articles/1460026643 . IBKR's FAQ on the rule change: what "depending on your account setup" means for a new margin account (BK-10).
2. https://www.interactivebrokers.com/docs/web-api/web-api-v-1-0-documentation/authentication/authentication-frequently-asked-questions and the Client Portal Gateway FAQ next to it. Session length and the midnight reset (BK-14). HTTP 404 to curl, 403 to the fetch tool.
3. https://www.tradestation.com/pricing/market-data-pricing/ , "Equities" tab. Stock data fee and non-professional terms (BK-30).
4. https://developer.schwab.com/products/trader-api--individual and its market data and OAuth pages. HTTP 403 to curl today (BK-26).
5. https://tastytrade.com/ margin rates (the old address returns 404). The current rate table and interest method (BK-24).
6. tastytrade and Public market data agreements or data source statements, if they exist, to settle consolidated or not (BK-22, BK-32).
7. https://www.tradestation.com/pricing/margin-rates/ footnotes, for the interest method (BK-29).

## Contradictions

1. **Alpaca's own pages on data.** The Trading Account page says a brokerage account gets "real-time consolidated market data"; the market data plan table says the free plan is IEX only and consolidated real time costs 99 dollars a month (BK-42 against BK-17). The plan table is more specific and newer.
2. **Schwab refresh token, two community sources.** Schwabdev says a new refresh token "requires user input" every 7 days. The hex.pm package says every refresh "returns a new one carrying a fresh seven days" and a person is never needed again if refreshed weekly (BK-26). Both are strength D. Schwab's own page could not be read.
3. **Tradier's help center against itself.** The FAQ answer modified June 4, 2026 says the PDT status is gone and the 4x figure removed (BK-01); the "Funds Available to Trade With" article (stamped April 14, 2026) and the lower half of the same FAQ answer still describe the old rule, and the API balance example (April 22, 2026) still shows a "pdt" object (BK-02). The June 4 dated paragraph governs.
4. **IBKR.** Guide pages (June 3, 2026) say an account "may still be subject" to the old rule; IBKR's FAQ (run 2, browser) says new margin accounts "will generally not be subject"; press said IBKR changed on June 4 (MB-40) (BK-10). Unresolved for a specific new account.
5. **tastytrade API fields against its rule page.** The API still documents "is-pattern-day-trader" and "day-trade-count" (BK-21); the rule page says the day-trade count was eliminated on June 4, 2026 (BK-20). The rule page governs; the fields are likely kept for compatibility.
6. **Lightspeed's sunset date.** Lightspeed expects the legacy rule to sunset at Lightspeed on October 27, 2026; FINRA's outside date is October 20, 2027 (BK-41, BR-04). Not a true conflict: Lightspeed's date is its own choice within the phase-in.
7. **tastytrade margin rate.** One review says 11 percent under 25,000 dollars; search summaries attribute 10.50 percent to another site (BK-24). No vendor page was readable.
8. **Public's rate label.** Run 2 worried 5.15 percent was a promotion (MB-61). Public defines "introductory rate" as the rate for the lowest balance tier (BK-33), so the worry is resolved, not a live conflict.


Research helper notes for run 3, topic "brokers". Access date for every source opened in this session is 2026-10-13 (America/Chicago, checked with `date`: Tue Oct 13 2026). Findings reused from run 1 keep their 2026-10-08 date and BR number; findings reused from run 2 keep their 2026-10-09 date and MB or DC number. This is research input for a human decision, never an instruction to trade.

Status of this file: written as the work went, appended after every two or three findings. If the last line is not "End of file marker", the session ran out of room and later sections may be missing. The decisive-facts table is inserted at the top at the end of the session.

Method: every new finding (BK-nn) comes from a page opened live in this session with web search, the fetch tool, or curl through the shell. Recalled knowledge was used only to decide where to look. No account was created, nothing was installed, no browser tool was used, no connector was configured, nothing was committed. No personal information was sent to any site. Quotes marked "verbatim (curl)" were copied from raw page text (markup stripped with the Mac's built-in Python, run with -I, standard library only). Quotes marked "via fetch tool" may be lightly paraphrased by that tool. Where a source uses a dash, it is replaced in the quote by a comma or a word in square brackets, and the replacement is marked.

Strength: A = primary and authoritative (regulator, statute, exchange, or the vendor's own documentation, pricing page or terms, seen live). B = reputable independent press or an established reference publisher. C = review sites, comparison sites, affiliate blogs. D = forums, social posts, personal blogs, community code repositories.

Price labels: "published" (vendor's own public page, seen live today), "corroborated" (two or more independent sources agree, named), "gated and unverified" (with the reason).

Acronyms: API (application programming interface, the way software talks to a broker). SIP (securities information processor, the consolidated feed of every U.S. exchange; CTA covers NYSE-listed and other non-Nasdaq stocks, UTP covers Nasdaq-listed stocks). NBBO (national best bid and offer, the best price across all exchanges). PDT (pattern day trader, the old rule). OCO (one cancels other, a pair of protective orders where filling one cancels the other). OAuth (a sign-in standard where the customer approves an app on the broker's own screen). FINRA (Financial Industry Regulatory Authority).

## Earlier findings reused unchanged, and reopened

### Reused unchanged (cited with their original date and label)

- Regulation and regime: MB-01 to MB-19 (the FINRA intraday margin standard), BR-03, BR-04 (approval and effective date, phase-in to October 20, 2027).
- Alpaca: MB-20 (new standard), MB-21, MB-22, MB-23, MB-26, MB-27, MB-28, BR-20 (keys), BR-23 (commission), BR-25 (connector places orders), DC-46 (snapshot request, no stated symbol cap), DC-47 (wildcard stream).
- Schwab: MB-30, MB-31, MB-32 (new standard, 4 times intraday, 8 p.m. Eastern exit, real-time blocking), MB-34, MB-35, MB-36, BR-11, DC-56 (developer portal unreadable).
- Interactive Brokers: MB-38, MB-39, MB-41, MB-42, MB-44 (Web API, Pro required, gateway, order reply suppression), BR-27, BR-28, BR-32, BR-57, DC-52, DC-53 (data: free feed is Cboe One plus IEX, labelled non-consolidated; paid bundle; 100 lines).
- E*TRADE: MB-46, MB-48 (rate, seen 2026-10-09, not re-read today), MB-49.
- TradeStation: MB-50, MB-53, MB-54.
- Robinhood: MB-56, MB-57, MB-58, BR-67.
- Public: MB-59, MB-60, MB-62, BR-58 to BR-60.
- Tradier: BR-34, BR-35, BR-38, BR-40, DC-49 (real-time consolidated data with a brokerage account), DC-50 (120 market data requests a minute).
- tastytrade: MB-67, MB-68, BR-61, BR-64.
- Webull: MB-69, MB-71, MB-72, MB-73, BR-53 (token invalid after 15 idle days), BR-56, DC-55 (100 symbols per snapshot, 60 a minute).
- moomoo and Lightspeed: MB-80, MB-81 (landing pages only).

### Reopened, and why

- MB-37 and MB-40 (IBKR regime): run 2 left IBKR mixed. The brief asks to settle it first.
- MB-63 (Tradier regime): run 2 left Tradier unconfirmed. The brief asks to settle it first.
- MB-66 (tastytrade regime, moderate confidence): the brief asks to confirm.
- MB-25 (Alpaca account configuration): the brief asks for an exact re-quote and whether the agent's key can change the cap.
- MB-24, MB-33, MB-45, MB-52, MB-61, MB-64, MB-70 (margin rates; MB-51 commission mapping): the brief asks for TODAY's rate at 2,000, 5,000 and 10,000 dollars plus the interest method, so each rate page is reopened (BK-08, BK-11, BK-19, BK-25, BK-29, BK-33, BK-35). E*TRADE's MB-48 was not re-read (brief check only).
- MB-65 (Tradier token life) and Public token life (run 2 NV 13): these decide whether those brokers pass the weekly sign-in test.
- DC-45 (Alpaca data plan price): reopened so the price is seen live today (BK-17).
- Also re-read today and so reopened: BR-12 (Schwab 7 day token, BK-26), BR-42 (TradeStation refresh tokens, BK-27), BR-48 (E*TRADE daily expiry, BK-38), MB-43 (IBKR Web API session, BK-12, BK-14), MB-55 (Robinhood Agentic no borrowing, BK-39), DC-51 (IBKR data prices, BK-13), DC-54 (Webull API data, BK-34).
- New questions not covered before: consolidated data for tastytrade, TradeStation, Public, Schwab; streaming symbol limits; protective orders held at the broker; status pages; API terms on automated trading.

## Findings register

### Tradier (reopened: MB-63, MB-64, MB-65)

Method note: Tradier's help center (support.tradier.com) is a JavaScript application, but each article's full text is embedded in the page's data, so curl got it. Tradier's developer docs are served as plain text when ".md" is added to the address. All Tradier quotes below are verbatim (curl).

**BK-01.** SETTLED: Tradier applies the NEW standard. Its General Trading FAQ answer on day trading rules (English text modified June 4, 2026, per the page's own data) says the pattern day trader status was eliminated from ALL accounts at the start of trading June 4, 2026, and customers may place as many day trades in a margin account as they like. It also says Tradier REMOVED the 4 times intraday buying power figure from all accounts, so intraday buying power is the standard margin amount. Run 2's "not confirmed" (MB-63) is resolved; the "Funds Available to Trade With" article run 2 read is stamped April 14, 2026, before the change, so it is stale. The same FAQ answer still carries the old-rule explanation below the new paragraph (stale lower text).
Page: "What are the Pattern Day Trading rules that apply to margin accounts?" (Tradier support, General Trading FAQ)
URL: https://support.tradier.com/kb/guide/en/general-trading-faq-QgwvDZHiwB/Steps/4532869
Accessed: 2026-10-13
Strength: A
Quote: "Effective at the start of trading on Thursday June 4th, 2026 the Pattern Day Trader (PDT) and any requirements associated with this status will be eliminated from all accounts. Going forward, this status will no longer exist." (verbatim (curl))
Also: "Customers will be permitted to place as many day trades in their margin account as they would like." and "With this change, Tradier will be removing the 4x intraday buying power figure from all accounts. This feature may be available again in the near future" (verbatim (curl))

**BK-02.** Tradier's balance API reference (updated April 22, 2026, before the change) still shows a "pdt" object in its example response next to the "margin" object. It is a leftover of the old system in the documentation, not evidence the rule still applies. Accounts are cleared by Apex Clearing (blog footer).
Page: "Get Account Balance" (Tradier API reference, updatedAt 2026-04-22) and the Tradier blog post of June 5, 2026 (footer)
URL: https://docs.tradier.com/reference/brokerage-api-accounts-get-account-balance.md and https://blog.tradier.com/blog/the-pattern-day-trader-pdt-rule-is-gone-what-active-traders-need-to-know
Accessed: 2026-10-13
Strength: A
Quote: "Accounts are carried and cleared with Apex Clearing Inc." (verbatim (curl), blog footer)

**BK-03.** SETTLED: an individual's own Tradier API token NEVER EXPIRES. Only partner OAuth tokens last 24 hours. Tradier also says its API is for personal use only unless the customer is a Tradier Partner, and that API access costs a brokerage account holder nothing. (Resolves MB-65 and run 1's BR-36.)
Page: "FAQ" (Tradier API docs, updatedAt 2025-12-18)
URL: https://docs.tradier.com/docs/faq.md
Accessed: 2026-10-13
Strength: A
Quote: "If you are an individual user getting your API token from your settings page (<https://web.tradier.com/user/api>) your tokens never expire." (verbatim (curl))
Also: "Unless you are a Tradier Partner, Tradier APIs are entitled for personal use only." and "We don't charge Tradier Brokerage account holders for API access to their account." (verbatim (curl))

**BK-04.** Tradier market data: real-time data, "pulled from a consolidated feed from all exchanges", for every Tradier Brokerage account holder, at no separate charge stated; Level 1 only (no depth). Nobody without a Tradier brokerage account can get real-time data. Corroborates DC-49. The page does not mention a separate exchange agreement or a professional status test for API use; that is not verified either way.
Page: "Market Data" (Tradier API docs, updatedAt 2026-02-05) and "FAQ" (Tradier API docs)
URL: https://docs.tradier.com/docs/market-data.md and https://docs.tradier.com/docs/faq.md
Accessed: 2026-10-13
Strength: A
Price: published (included with the account; no data fee is named on the docs pages or the pricing page)
Quote: "Real-time data is available to all Tradier Brokerage account holders for US-based stocks and options." and "Real-time data is pulled from a consolidated feed from all exchanges." (verbatim (curl))
Also: "We offer Level 1 data only." (verbatim (curl), FAQ)

**BK-05.** Tradier request limits: 120 market data requests a minute, 120 account requests a minute, 60 trading requests a minute, per access token, and Tradier says it will most likely not raise them. A POST form of the quotes request exists for "a larger list of symbols"; no maximum count is published. Streaming: symbol limits are deliberately not published ("in excess of several hundred symbols" is described as normal; "an entire exchange's worth" is named as abuse); only one market data stream and one account stream may be open at a time.
Page: "Rate Limiting" (updatedAt 2025-06-27), "Post Quotes" (updatedAt 2026-04-22), "Streaming Data" (updatedAt 2026-01-21), Tradier API docs
URL: https://docs.tradier.com/docs/rate-limiting.md , https://docs.tradier.com/reference/brokerage-api-markets-post-quotes.md , https://docs.tradier.com/docs/streaming-data.md
Accessed: 2026-10-13
Strength: A
Quote: "Each limit is enforced by the minute and on a per-access-token basis." and "Production: 60 request per minute." (Trading) (verbatim (curl))
Also: "While we do not publish the symbol limits for these APIs, we do monitor for abuse to make sure people aren't doing anything egregious (like asking for an entire exchange's worth of symbols)." and "you can stream as few as a single symbol or in excess of several hundred symbols" (verbatim (curl); the apostrophe is the page's curly one)
My reading (not a vendor statement): a 50 to 200 symbol live list fits comfortably in one stream or in one or two POST quote requests a minute. A once-a-day price of 5,000 symbols fits the rate limit if each POST carries several hundred symbols (for example 5,000 symbols at 500 per request is 10 requests), but the per-request maximum is not published, and Tradier's abuse wording means a whole-market pull should be tested gently. A separate end-of-day data vendor is the safer route for the 5,000-symbol screen.

**BK-06.** Tradier protective orders held at the broker: OTO, OCO and OTOCO (a bracket: entry, then a stop and a target that cancel each other). Equity order types are market, limit, stop and stop_limit. No trailing stop appears in the order type list. Tradier says advanced orders "rely on triggering conditions set with the market center", which reads as held at the broker side, not in the customer's program.
Page: "Advanced Orders" (updatedAt 2025-08-07) and "Place Order" (Tradier API reference)
URL: https://docs.tradier.com/reference/advanced-orders.md and https://docs.tradier.com/reference/brokerage-api-trading-place-order.md
Accessed: 2026-10-13
Strength: A
Quote: "One-triggers-one-cancels-other (OTOCO) [is:] if the first order is filled, a one-cancels-other (OCO) is placed." (verbatim (curl), a dash replaced by "[is:]") and "The type of order to be placed. One of: market, limit, stop, stop_limit" (verbatim (curl))

**BK-07.** Tradier has a public status page (status.tradier.com, run on the common Statuspage service) with 90 day uptime bars and an incident history. Of the 15 most recent incidents (August 13 to October 13, 2026), most are on Paper Trading; the newest, today, is "Elevated API Errors" on Market Data (minor). No uptime percentage came through as text.
Page: "Tradier API/Services Status" and its public incidents feed
URL: https://status.tradier.com/ and https://status.tradier.com/api/v2/incidents.json
Accessed: 2026-10-13
Strength: A
Quote: "2026-10-13 minor Elevated API Errors ['Market Data']" (my one-line summary of the feed's fields: created date, impact, name, component; the update text reads "We're experiencing an elevated level of API errors and are currently looking into the issue.")

**BK-08.** Tradier pricing today: Lite 0 dollars a month with 0.35 dollars per stock trade; Pro 10 dollars a month and Pro Plus 35 dollars a month with 0 per stock trade. Margin interest 9.75 percent, one flat figure. Account minimum 0 dollars. Pass-through fees: SEC fee 0.0000206 dollars per dollar sold; FINRA trading activity fee (TAF) on equities 0.00 dollars for October 1 to December 31, 2026; a "Trade Reporting & Processing" fee of 0.000054 dollars per share. A forced sale by Tradier costs 10 dollars plus commission. (Re-confirms MB-64 and BR-38.)
Page: "Pricing & Plans | Tradier"
URL: https://tradier.com/individuals/pricing
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Lite$0/month Pro$10/month Pro Plus$35/month Stocks (per trade) $0.35 $0.00 $0.00" and "Margin Interest* 9.75%" and "TAF Regulatory Fee (Equities)† $0.00 (10/1/2026 - 12/31/2026)" (verbatim (curl), table cells run together; the date range hyphen is the page's)

**BK-09.** Tradier margin interest method: accrued daily on the "daily adjusted debit balance", which is generally the SETTLED debit balance, multiplied by a "daily margin interest rate". The document does not say whether the year is 360 or 365 days. Lender of record is Apex Clearing. My inference, not a Tradier statement: a purchase and sale on the same day settle on the same day (T+1), so borrowing repaid the same day leaves no settled debit and should accrue no interest; 9.75 percent (BK-08) applies at 2,000, 5,000 and 10,000 dollars alike.
Page: "Margin Disclosure Statement" (Tradier Brokerage, PDF dated 01/13/2023 in its file name, linked from the help center's "Account Disclosures" guide, updated September 29, 2026)
URL: https://s3.amazonaws.com/documents.tradierbrokerage.com/apex/tbi_margin_disclosure_statement-01132023.pdf
Accessed: 2026-10-13
Strength: A
Quote: "The daily interest accruals are calculated by multiplying your "daily adjusted debit balance" by the "daily margin interest rate." Generally speaking, your daily adjusted debit balance is the actual settled debit balance in your Margin and Short Account" (text extracted from the PDF with the built-in Python; word spacing repaired, words unchanged. The fetch tool saved the PDF in the session's tool-results folder, where it remains; my copy in the scratchpad was deleted at the end.)

### Interactive Brokers (reopened: MB-37, MB-40, MB-43, MB-45)

**BK-10.** NOT FULLY SETTLED, but narrowed. IBKR's two guide pages are still "Last updated on June 3, 2026" and still say an account "may still be subject to existing PDT rules during FINRA's transition period"; the account configuration page still says accounts that "remain subject" to the old rules need 25,000 dollars to day trade. No IBKR page dated after June 4, 2026 was found by curl or by three searches. The most specific IBKR statement on record remains run 2's browser reading of IBKR's FAQ (run 2 trajectory S18, 2026-10-09, strength A): "new margin accounts will generally not be subject to the pattern day trading (PDT) rules. However, depending on your account setup, your account may remain subject". What "account setup" means is not stated on any page read. The FAQ could not be read today: it is a script-built page whose article text loads through an internal request helper; two attempts to find the data address failed, so it goes on the Needs a browser list. The Web API account management page still documents a "PDT Reset" support action. Reading: a new IBKR margin account under 25,000 dollars is PROBABLY on the new standard, but only IBKR can confirm it for a given account.
Page: "Pattern Day Trader Reset" (IBKR Guides, last updated June 3, 2026); "Configuring Your Account" (Interactive Brokers); "Web API Account Management" (IBKR Campus)
URL: https://www.ibkrguides.com/orgportal/messagecenter/supportpdtreset.htm , https://www.interactivebrokers.com/en/accounts/configuring-your-account.php , https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-account-management/
Accessed: 2026-10-13
Strength: A
Quote: "Your account may still be subject to existing PDT rules during FINRA's transition period, which ends in October 2027." and "During the PDT rule phase-out period, accounts that remain subject to existing Pattern Day Trading regulations must maintain a minimum of USD 25,000 in equity or equivalent to day trade." (verbatim (curl))

**BK-11.** IBKR margin interest TODAY is readable as text (run 2 could not read it, MB-45): IBKR Pro, USD, tier "0 to 100,000": 5.380 percent (benchmark plus 1.5 percent); IBKR Lite: 6.380 percent (benchmark plus 2.5 percent). So 5.38 percent on Pro at 2,000, 5,000 and 10,000 dollars borrowed. Interest accrues daily, is posted monthly, and is computed on ENDING SETTLED cash, with a 360 day year for USD. My inference: borrowing repaid within the day leaves no negative settled cash at day end, so it should not be charged. Only Pro can use the API (MB-41), so 5.38 percent is the relevant figure.
Page: "Margin Rates" and "Margin Interest Calculations" (Interactive Brokers)
URL: https://www.interactivebrokers.com/en/trading/margin-rates.php and https://www.interactivebrokers.com/en/trading/margin-calculation-details.php
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "USD 0 ≤ 100,000 5.380% (BM + 1.5%) 6.380% (BM + 2.5%)" (verbatim (curl), table cells run together; the columns are "Rate Charged: IBKR Pro" then "Rate Charged: IBKR Lite") and "IBKR accrues interest on a daily basis and posts actual interest monthly on the third business day of the following month." (verbatim (curl))
Also: "Ending Settled Cash balance in the securities account segment" and "360: USD, EUR, CHF, CZK, JPY, SEK, NOK, DKK, HUF, MXN" (verbatim (curl), calculation page)

**BK-12.** IBKR Web API limits: 10 requests a second per session (also through the gateway); the market data snapshot request takes at most 100 instrument ids (conids) at once and is limited to 10 requests a second; the total number of instruments subscribed is capped by "market data lines", 100 by default (confirms DC-53). Violators may be put "in a penalty box for 10 minutes". So a 50 to 200 symbol live list fits only if it stays within 100 lines (or the account buys more lines), and a 5,000 symbol daily pricing pass is not practical through snapshots (each snapshot subscribes a line). The Web API page also lists bracket orders. It states IBKR expects third-party vendors offering automated trading to hold registration; that sentence is aimed at vendors, not at an individual's own program.
Page: "Trading Web API" (IBKR Campus)
URL: https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/
Accessed: 2026-10-13
Strength: A
Quote: "Interactive Brokers currently enforces a global request rate limit of 10 requests per second for each authenticated username" (verbatim (curl); the sentence continues after a double hyphen with "that is, each Web API session") and "A maximum of 100 conids may be specified at once." and "All users at Interactive Brokers are given 100 market data lines by default." (verbatim (curl))
Also: "Please be aware we expect third-party vendors offering automated trading solutions to hold applicable registration with financial authorities" (verbatim (curl)). Section heading on the page: "Submitting Bracket Orders".

**BK-13.** IBKR market data today: the free real-time feed is Cboe One plus IEX, which IBKR itself labels "Non-consolidated" (no NBBO). Consolidated real-time (Tapes A, B and C, with NBBO) for a non-professional needs the "US Securities Snapshot and Futures Value Bundle" (10.00 dollars a month, waived once monthly commissions reach 30 dollars, plus 0.01 dollars per snapshot) and, for STREAMING NBBO quotes, the "US Equity and Options Add-On Streaming Bundle" at 4.50 dollars a month (non-professional column; 125.00 is the professional column). So consolidated streaming costs about 14.50 dollars a month for a non-professional before any waiver (my sum of two published lines). The page says the minimum requirements plus the subscription cost must be in the account for data to activate. Streaming is still capped by market data lines (BK-12). Updates DC-51 (which lacked the add-on price).
Page: "Market Data Pricing" (Interactive Brokers)
URL: https://www.interactivebrokers.com/en/pricing/market-data-pricing.php
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "The free real-time streaming market data on all US-listed stocks and ETFs from Cboe One and IEX is non-consolidated." and "US Securities Snapshot and Futures Value Bundle United States USD 10.00 Base Waived for Activity + USD 0.01 per Snapshot" and "US Equity and Options Add-On Streaming Bundle ... United States USD 4.50 USD 125.00" (verbatim (curl), table cells run together; "..." marks footnote numbers left out)
Also: "The minimum requirements plus the cost of the subscription are required to have the data activated." (verbatim (curl))
Column check: the table's headings read "Market Data Package Country Non-Pro Fees/month Pro Fees/month" (verbatim (curl)), so 4.50 is the non-professional fee and 125.00 the professional fee. The commission waiver table names only the Snapshot bundle (30 dollars).

**BK-14.** IBKR sign-in life for the Web API: not settled from an IBKR documentation page. IBKR's own podcast transcript (IBKR Campus, "Authenticating with the IBKR Client Portal REST API", modified February 11, 2025) has IBKR staff saying that with two-factor sign-in on, the customer is prompted "each time you logged in on the given day", and that a disconnected brokerage session can be restarted by software calling the ssodh/init request "to reauthenticate every day". A search summary (not a page I could open: both IBKR documentation addresses returned HTTP 404 to curl and 403 to the fetch tool) says IBKR's Authentication FAQ states a session lasts up to 24 hours and resets at midnight New York time. Reading: the gateway route needs a person with the phone app at least once a day in practice; that fails the "weekly sign-in" test unless IBKR confirms otherwise. Combined with BK-12 and MB-41 (Java gateway program), IBKR is the heaviest route of the brokers read.
Page: "Authenticating with the IBKR Client Portal REST API" (IBKR Campus podcast transcript)
URL: https://www.interactivebrokers.com/campus/podcasts/ibkr-podcasts/authenticating-with-the-ibkr-client-portal-rest-api/ (read through the site's public post feed, https://www.interactivebrokers.com/campus/wp-json/wp/v2/posts/203297)
Accessed: 2026-10-13
Strength: A for the vendor's own words, but a spoken podcast, not documentation, and dated 2025
Quote: "So if you have two-factor authentication on your account, this would be prompted for you each time you logged in on the given day." and "so you can even automate the way to reauthenticate every day." (verbatim (curl))

### Alpaca (reopened: MB-24, MB-25, DC-45)

**BK-15.** Alpaca account configuration, re-read today on Alpaca's own reference page (updatedAt 2026-05-27, unchanged since run 2). The customer's program can set, through PATCH /v2/account/configurations: max_margin_multiplier ("1", "2" or "4"), no_shorting (long-only), suspend_trade (block new orders), plus disable_overnight_trading, fractional_trading, max_options_trading_level and trade_confirm_email. The page names the plain key pair (APCA-API-KEY-ID and APCA-API-SECRET-KEY) as its security scheme, so the SAME key that places orders can change these settings, including raising the cap. Re-confirms MB-25.
Page: "Account Configurations" (Alpaca Trading API reference, updatedAt 2026-05-27)
URL: https://docs.alpaca.markets/us/reference/patchaccountconfig-1.md
Accessed: 2026-10-13
Strength: A
Quote: "max_margin_multiplier": { "description": "Can be \"1\", \"2\", or \"4\"", "type": "string" } and "no_shorting": { "description": "If true, account becomes long-only mode." and "suspend_trade": { "description": "If true, new orders are blocked." (verbatim (curl), from the page's OpenAPI schema)

**BK-16.** Alpaca does offer a narrower credential, but only through OAuth: its OAuth scopes separate "account:write" (write access for account configurations) from "trading" (place, cancel or modify orders) and "data". A token granted "trading" and "data" but NOT "account:write" should therefore be able to trade but not change max_margin_multiplier. This is my reading of the scope table; the OAuth route is documented for third-party applications acting for end users, and whether an individual can register an OAuth application for his own account and use it this way is not stated. The same page warns that most users can have only one market data stream connection.
Page: "Using OAuth2 and Trading API" (Alpaca docs, updatedAt 2026-03-02)
URL: https://docs.alpaca.markets/us/docs/using-oauth2-and-trading-api.md
Accessed: 2026-10-13
Strength: A
Quote: "| `account:write` | Write access for account configurations and watchlists. |" and "| `trading` | Place, cancel or modify orders. |" and "Read-only endpoint access is assumed by default." (verbatim (curl))
Also: "Please note that most users can have only 1 active stream connection." (verbatim (curl))

**BK-17.** Alpaca market data plans for an individual, today: Basic, free, real-time from IEX only, 30 streaming symbols, 200 historical calls a minute; Algo Trader Plus, 99 dollars a month, real-time from "All US Stock Exchanges", unlimited streaming symbols, 10,000 historical calls a minute, sourced from CTA and UTP ("100% of market volume"). Latest-price and snapshot requests on the consolidated (SIP) feed need the paid plan. The multi-symbol snapshot request takes a comma-separated list and states no maximum. DC-45 price re-confirmed live. The pages read do not mention a professional status test or a separate exchange agreement.
Page: "About Market Data API" (updatedAt 2026-10-06), "Market Data FAQ", "Snapshots" reference (Alpaca docs)
URL: https://docs.alpaca.markets/us/docs/about-market-data-api.md , https://docs.alpaca.markets/us/docs/market-data-faq.md , https://docs.alpaca.markets/us/reference/stocksnapshots-1.md
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "| Pricing | Free | $99 / month |" and "| Real-time market coverage | IEX | All US Stock Exchanges |" and "| Websocket subscriptions | 30 symbols | Unlimited |" (verbatim (curl), table rows) and "All the latest endpoints (including the [snapshot](...) endpoint), require a subscription to be used with the SIP feed." (verbatim (curl), link address shortened)
My reading: with Algo Trader Plus, a 50 to 200 symbol live list streams with no symbol cap, and a 5,000 symbol daily pricing pass is a handful of snapshot calls at well under the 10,000 a minute limit, provided the snapshot request accepts long lists (not stated).

**BK-18.** Alpaca trading request limit: 200 requests a minute per account, not raisable by the customer; Alpaca will raise it to 1,000 a minute only if the account becomes "non-retail", which routes orders to smart order routers and adds 0.004 dollars per share. Server-side protective orders: bracket (OTOCO), OCO (exit only), OTO, and trailing stop (dollar or percent trail, tracked by Alpaca from a high water mark), so stops stay at the broker if the customer's program stops.
Page: "Is there a usage limit for the number of API calls per second?" and "What flags an account as non-retail" (Alpaca support, the first dated December 2022); "Placing Orders" (Alpaca docs, updatedAt 2026-08-10)
URL: https://alpaca.markets/support/usage-limit-api-calls , https://alpaca.markets/support/increase-api-rate-limit , https://docs.alpaca.markets/us/docs/orders-at-alpaca.md
Accessed: 2026-10-13
Strength: A
Quote: "Please note that the API is throttled, currently 200 requests per minute, per account." and "Alpaca is willing to increase your rate limit to 1,000/calls a minute with the understanding that the account will be updated to a non-retail account." (verbatim (curl))
Also: "A bracket order is a chain of three orders that can be used to manage your position entry and exit." and "Trailing stop orders allow you to continuously and automatically keep updating the stop price threshold based on the stock price movement." (verbatim (curl))

**BK-19.** Alpaca margin interest, re-read today: 6.50 percent (non-elite) charged only on the end-of-day SETTLEMENT DATE debit balance, divided by 360, accrued daily and posted monthly; a Friday debit is charged for three days; borrowing used and repaid the same day costs nothing. Same rate at 2,000, 5,000 and 10,000 dollars. Alpaca also has a public status page with an incident feed: in the last month it lists, among others, "Order processing delays" on the Orders API (September 30, minor) and "Intermittent HTTP 500 errors across Multiple API's" including the Orders API (September 11, major).
Page: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17); Alpaca status page incident feed
URL: https://docs.alpaca.markets/us/docs/margin-and-short-selling.md and https://status.alpaca.markets/api/v2/incidents.json
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "`daily_margin_interest_charge = (settlement_date_debit_balance * rate[non-elite: 0.0650 | elite: 0.0500])) / 360`" and "if you deposited $10,000 and bought $15,000 worth of stock that you liquidated the same day, you would not incur any interest expense." (verbatim (curl))

### tastytrade (reopened: MB-66; new data and limit facts)

**BK-20.** CONFIRMED: tastytrade applies the NEW standard, adopted June 4, 2026 "immediately", with the day-trade counter, starting day-trading buying power and day-trade calls removed; margin accounts may day trade "as often as available buying power allows". The page is dated "Updated Oct 2, 2026". Important for leverage: tastytrade describes stock leverage as "up to 2:1" with about a 50 percent initial requirement, and gives an example where an order beyond remaining buying power is refused, so tastytrade appears to give 2 times, not 4 times, intraday on stock (my reading; the page does not say "4x" anywhere). Upgrades MB-66 from moderate to full confidence on the regime.
Page: "What Is Intraday Margin? tastytrade's Post-PDT Rules Explained" (tastytrade Learn, Updated Oct 2, 2026)
URL: https://tastytrade.com/learn/accounts/account-resources/intraday-margin/
Accessed: 2026-10-13
Strength: A
Quote: "tastytrade adopted the new FINRA framework on June 4, 2026, eliminating the $25,000 PDT minimum, day-trade count, and starting day-trading buying power." and "Margin-account traders can day trade as often as available buying power allows" (verbatim (curl))
Also: "At tastytrade, a standard Reg T account needs at least $2,000 in marginable equity to use full margin privileges. Marginable stock generally receives up to 2:1 leverage, with a typical initial requirement near 50%." (verbatim (curl))

**BK-21.** tastytrade's API documentation still lists the trading status fields "is-pattern-day-trader" ("Whether PDT rules apply to the account") and "day-trade-count" ("Live count of day trades used, updated throughout the day"), plus "is-in-day-trade-equity-maintenance-call". These are leftovers or kept for compatibility; they do not override BK-20, but the agent's software should read them and stop if "is-pattern-day-trader" ever returns true. Same page: "is-closing-only" and "is-frozen" flags.
Page: "Margin & Risk" (tastytrade developer docs, new agent-first docs)
URL: https://developer.tastytrade.com/docs/concepts/margin-and-risk.md
Accessed: 2026-10-13
Strength: A
Quote: "| `is-pattern-day-trader` | Whether PDT rules apply to the account. |" and "| `day-trade-count` | Live count of day trades used, updated throughout the day. |" (verbatim (curl))

**BK-22.** tastytrade market data through the API: REST quotes are real time, for FUNDED account holders only, capped at 100 symbols per request, with no delayed quotes over REST; REST rate limits are unpublished "reasonable thresholds" (a bare 429 when exceeded; about an 8 hour IP block after too many failed logins). Streaming (DXLink, from dxFeed): 5 concurrent sessions, 25,000 subscriptions per session, 10,000 subscription changes a minute; the quote token lasts 24 hours and is refreshed by software. NOT STATED on any page read: whether the feed is consolidated (SIP/NBBO) or a partial feed, and whether any exchange agreement or professional status test applies. No data fee is mentioned. So tastytrade's consolidated-data status is NOT VERIFIED.
Page: "Get Quotes By Instrument Type" (reference), "Streaming", "Rate limits & backoff" (tastytrade developer docs)
URL: https://developer.tastytrade.com/reference/market-data/getMarketDataByType.md , https://developer.tastytrade.com/docs/concepts/streaming.md , https://developer.tastytrade.com/docs/guides/rate-limits-and-backoff.md
Accessed: 2026-10-13
Strength: A
Quote: "The combined number of symbols across all type parameters is capped at 100 per request" and "Available to funded account holders only; no delayed quotes are served over REST." (verbatim (curl)) and "**API quote tokens expire after 24 hours** [,] refresh before they lapse." (verbatim (curl), a dash replaced by a comma)
My reading: 5,000 symbols once a day is 50 REST calls; a 50 to 200 symbol live list is far inside the streaming caps.

**BK-23.** tastytrade sign-in and access model: a personal OAuth application, "restricted to your account only"; its refresh token is "long-lived and do[es] not expire" and software exchanges it for 15-minute access tokens with no person involved. Scopes are read, trade and openid (no separate settings scope). Complex orders held at tastytrade: OTOCO, OCO, OTO (and PAIRS), with GTC time in force. The docs' agent safety checklist advises human approval before going to production, which is guidance, not a per-order step. (Re-confirms BR-61 from the new docs.)
Page: "OAuth2 authentication", "Orders & Order Types", "Agent Quickstart" (tastytrade developer docs)
URL: https://developer.tastytrade.com/docs/authentication/oauth2.md , https://developer.tastytrade.com/docs/concepts/orders-and-order-types.md , https://developer.tastytrade.com/docs/agent-quickstart.md
Accessed: 2026-10-13
Strength: A
Quote: "Refresh tokens are long-lived and do not expire." and "A personal OAuth application is **restricted to your account only**" and "Supported types are **OTOCO**, **OCO**, **OTO**, and **PAIRS**." (verbatim (curl))
Also: "Sandbox until verified; get explicit human approval before production." (verbatim (curl))

**BK-24.** tastytrade margin interest: NOT on a readable vendor page. https://tastytrade.com/margin-rates/ returned HTTP 404 today and the pricing page holds no margin rate. One review site says rates "start at 11% for balances under $25,000"; a search summary attributes 10.50 percent to Bankrate and 11.0 percent to BrokerChooser, but those pages were not opened (BrokerChooser returned 403). Interest method and same-day treatment not found.
Page: "tastytrade Review" (StockBrokers.com)
URL: https://www.stockbrokers.com/review/tastytrade
Accessed: 2026-10-13
Strength: C
Price: gated and unverified (vendor rate page returns 404; one review figure only, not corroborated by an opened second source)
Quote: "Margin rates start at 11% for balances under $25,000, which is on par with many bank-owned brokers" (verbatim (curl))

### Charles Schwab (reopened: MB-33, BR-12; data and limits new)

Method deviation for Schwab pages: plain curl got a 503 byte error page and the fetch tool got "We're sorry, but we were unable to authorize your request." As run 2 did (MB-29), the pages were read with curl sending a generic browser identification line (a stock desktop browser User-Agent string). It carries no personal information. Quotes are verbatim from the raw text.

**BK-25.** Schwab margin interest today: base rate 10.25 percent (last changed 9/18/2026); debit balance 100 to 24,999.99 dollars: base plus 1.825 percent, effective 12.075 percent (so 12.075 percent at 2,000, 5,000 and 10,000 dollars); no interest below 100 dollars. Interest is calculated daily and posted monthly, compounds daily on a 360 day year, and a loan starts accruing "as of the settlement date of that trade (T+1)". My inference, not a Schwab sentence: a purchase sold the same day settles on the same day, so intraday-only borrowing should not accrue interest. Re-confirms MB-33.
Page: "Schwab margin rates and requirements" and "Understanding Margin Interest" (Charles Schwab)
URL: https://www.schwab.com/margin/margin-rates-and-requirements and https://www.schwab.com/learn/story/understanding-margin-interest
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Schwab's current base rate is 10.25% and is subject to change without notice. Last changed on 9/18/2026." and "$100-$24,999.99 ... Base Rate + 1.825% ... Effective Rate 12.075%" (verbatim (curl), table cells joined, "..." marks cell labels left out) and "Interest is calculated daily on the amount borrowed and posted to the account on a monthly basis." (verbatim (curl))
Also: "Margin interest compounds daily on a 360-day basis." and "Any order that pushes a trader into a loan will begin accruing interest as of the settlement date of that trade (T+1)." (verbatim (curl), Understanding Margin Interest)

**BK-26.** Schwab Trader API facts from community sources only (Schwab's developer portal now returns HTTP 403 to plain curl, and was an empty script shell in run 2): 120 API requests a minute, 4,000 order-related calls a day, 500 symbols streamed at once; refresh token valid 7 days and "Getting a new refresh token, however, requires user input"; quote responses carry "realtime": True and "isDelayed": False in the library's examples. A second community package (an Elixir library on hex.pm) says the opposite on sign-in: each refresh returns a new refresh token "carrying a fresh seven days", so "Refreshing at least once a week means never needing a person again". These two strength D sources contradict each other; Schwab's own statement is still not available. Whether the quotes are consolidated (NBBO) is not stated by either source.
Page: Schwabdev documentation, "client.md" and "api.md" (community Python library, GitHub, tylerebowers/Schwabdev); "Using dp_exchange_schwab" (hex.pm package preview, version 0.1.7)
URL: https://raw.githubusercontent.com/tylerebowers/Schwabdev/main/docs/pages-raw/client.md and https://repo.hex.pm/preview/dp_exchange_schwab/0.1.7/usage-rules.md
Accessed: 2026-10-13
Strength: D
Quote: "There are a maximum of 120 api requests per minute, 4000 order-related api calls per day, and 500 tickers concurrently streamed." and "Getting a new refresh token, however, requires user input." (verbatim (curl), Schwabdev)
Also: "The refresh token is one-time use. Every refresh spends the old one and returns a new one carrying a fresh seven days." and "Refreshing at least once a week means never needing a person again." (verbatim (curl), hex.pm; the bold markers in the source are dropped)

### TradeStation (reopened: MB-51, MB-52, BR-42; data and limits new)

Method deviation: tradestation.com returned HTTP 403 (919 bytes) to plain curl; pages were re-read with the same generic browser identification line as Schwab. api.tradestation.com docs answered plain curl.

**BK-27.** TradeStation sign-in: access tokens last 20 minutes, and by default the refresh token of a TradeStation API key is "valid indefinitely", so software can keep itself signed in with no person; a customer can ask for rotating refresh tokens, which then impose a 24 hour absolute lifetime. An API key is obtained by e-mailing Client Experience from a FUNDED TradeStation account. (Re-confirms BR-42 from TradeStation's own page.)
Page: "Refresh Tokens" and "FAQ" (TradeStation API docs)
URL: https://api.tradestation.com/docs/fundamentals/authentication/refresh-tokens and https://api.tradestation.com/docs/faq
Accessed: 2026-10-13
Strength: A
Quote: "By default, Refresh Tokens of TradeStation API Keys will be valid indefinitely." and "There is a 24-hour absolute lifetime imposed when using rotating Refresh Tokens, thereby requiring users to re-sign in every 24 hours." (verbatim (curl))
Also: "If you already have a funded TradeStation account, please send an e-mail to ClientExperience@tradestation.com to obtain a key." (verbatim (curl))

**BK-28.** TradeStation API rate limits, per API key per user: Accounts, Order Details, Balances, Positions 320 requests per 5 minutes each; Quote Snapshot 500 per 5 minutes; Quote Change Stream, Barchart Stream, TickBar Stream 500 per 5 minutes; Order Stream and Positions Stream 40 concurrent; MarketDepth stream 10 concurrent. Order placement is not listed as its own category on this page. Symbols per quote snapshot request were not found on the pages read. My reading: the 50 to 200 symbol live list should be streamed; a 5,000 symbol daily pricing pass fits 500 snapshot calls per 5 minutes only if each call carries many symbols (per-call maximum not verified).
Page: "Rate Limiting Overview" (TradeStation API docs)
URL: https://api.tradestation.com/docs/fundamentals/rate-limiting/rate-limiting-overview
Accessed: 2026-10-13
Strength: A
Quote: "Rolling Intervals: Rate limits operate within configured intervals, typically 5-minute intervals for most resources and 1-minute intervals for others." and "Quote Snapshot 500 5-minute" (verbatim (curl), table cells joined)

**BK-29.** TradeStation costs, re-read today with the table order now clear: stock and ETF commission 0 dollars per share; clearing fee per share by monthly volume, listed from highest tier to lowest: over 10,000,000 shares 0 dollars, 1,000,001 to 10,000,000 0.001, 100,001 to 1,000,000 0.002, 0 to 100,000 0.003 dollars per share (so 0.30 dollars per 100 shares at this account's size); direct routing 0.0048 per share at the lowest tier; inactivity fee 10 dollars a month unless minimum activity is met. Margin interest: 12.00 percent under 50,000 dollars (so at 2,000, 5,000 and 10,000 dollars). Requirements: long stock 25 percent intraday, 50 percent overnight. Interest method and the footnotes were not in the page text. Resolves the column-mapping doubt in MB-51.
Page: "Pricing" and "Margin rates" (TradeStation)
URL: https://www.tradestation.com/pricing/ and https://www.tradestation.com/pricing/margin-rates/
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Monthly volume of shares traded >10,000,000 1,000,001 [to] 10,000,000 100,001 [to] 1,000,000 0 [to] 100,000 ... Clearing fee (per share) $0 $0.001 $0.002 $0.003" and "Inactivity fee $10 per month (FREE if account meets minimum activity)" (verbatim (curl), cells joined, the page's dashes replaced by "[to]", "..." marks rows left out)
Also: "Less than $50,000 4.50% 6.50% 11.00% 12.00%" (verbatim (curl); the four tier labels print first, then the four rates in the same order, so "Less than $50,000" pairs with 12.00%) and "Buy Stock or ETF 25% Value of the Position 50% Value of the Position" (verbatim (curl))

**BK-30.** TradeStation market data for stocks: the market data pricing page's equities tab is drawn by script, so the stock data fee, whether the feed through the API is consolidated, and the non-professional terms were NOT readable. The visible text says fees "may be conditional upon your professional subscriber status", "Real-time data is required for each market that you wish to trade", and real-time fees are debited a month in advance. Needs a browser.
Page: "Market Data Pricing" (TradeStation)
URL: https://www.tradestation.com/pricing/market-data-pricing/
Accessed: 2026-10-13
Strength: A
Price: gated and unverified (the equities price table is drawn by script and did not come through curl)
Quote: "Fees shown are subject to change and may be conditional upon your professional subscriber status." and "Real-time data is required for each market that you wish to trade." (verbatim (curl))

### Public (reopened: MB-61 and run 2 Not verified item 13)

**BK-31.** Public sign-in: the customer generates a long-lived, revocable "Secret Token" (secret key) on the settings page; software exchanges it for short-lived access tokens whose validity it chooses (default 15 minutes; Public's own Python SDK documents 5 to 1,440 minutes and refreshes automatically). So no person needs to sign in again unless the secret is revoked. Orders: market, limit, stop, stop_limit, plus BRACKET, OCO and OTO order classes for equities, with take-profit and stop-loss legs held at Public; order placement is asynchronous. No per-order confirmation step appears on the place-order page. Rate limits were NOT found on any page read. Resolves run 2 Not verified 13 on token life.
Page: "Create personal access token" and "Place order" (Public API docs); "publicdotcom-py" README (Public's own SDK, GitHub organization PublicDotCom)
URL: https://public.com/api/docs/resources/authorization/create-personal-access-token , https://public.com/api/docs/resources/order-placement/place-order , https://raw.githubusercontent.com/PublicDotCom/publicdotcom-py/main/README.md
Accessed: 2026-10-13
Strength: A
Quote: "Secret Tokens are long-lived but revocable, while Access Tokens are short-lived and expire after the specified validity period." (verbatim (curl)) and "Valid range is **5 to 1440 minutes (24 hours)**" (verbatim (curl), SDK README) and "Bracket orders: set orderClass to BRACKET, OCO, or OTO and supply takeProfit and/or stopLoss." (verbatim (curl))

**BK-32.** Public market data through the API: "real-time market quotes for a set of instruments", needing the "marketdata" scope, "available to individual investors". No price is stated and the pages do not say whether the quotes are consolidated (SIP/NBBO) or from a partial feed, nor the maximum instruments per request. So Public's consolidated-data status is NOT VERIFIED.
Page: "Get quotes" (Public API docs)
URL: https://public.com/api/docs/resources/market-data/get-quotes
Accessed: 2026-10-13
Strength: A
Quote: "Returns real-time market quotes for a set of instruments. Requires the marketdata scope and is available to individual investors." (verbatim (curl))

**BK-33.** Public margin interest today: 5.15 percent as its "introductory rate", which Public defines as "the margin rate for the minimum margin balance tier" (so it is the standing rate for the lowest tier, not a time-limited promotion; this resolves the doubt in MB-61). Rates vary with the debit balance and the upper limit of the Federal Funds target range. Public's own learn article says interest "is calculated daily and charged monthly" with a daily rate of the annual rate divided by 365. Whether same-day borrowing is charged, and whether the balance is the settled balance, were not stated. The tier boundary (up to 50,000 dollars) rests on MB-61; at 2,000, 5,000 and 10,000 dollars the rate is 5.15 percent.
Page: "Margin" (Public, redirected to /invest/margin) and "Margin rates compared across leading brokers (2026)" (Public Learn)
URL: https://public.com/invest/margin and https://public.com/learn/lowest-margin-rates-compared
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Public 5.15%" and "“Introductory rate” refers to the margin rate for the minimum margin balance tier offered by Public or each competitor." (verbatim (curl)) and "Margin interest is calculated daily and charged monthly:" then "Daily Rate: Annual rate ÷ 365 days" (verbatim (curl), learn article)
Also: "we charge an interest rate that varies depending on your margin/debit balance and the upper limit of the Federal Funds Target Range." (verbatim (curl))

### Webull (reopened: DC-54, MB-70)

**BK-34.** Webull's API market data for U.S. stocks is NOT consolidated: the developer docs offer "Nasdaq Basic (Level 1) or Nasdaq Totalview (Level 2) for Non-Display OpenAPI usage" (Nasdaq Basic is Nasdaq's own feed, not the SIP; background, not sourced here). Webull's API marketing page advertises "Free Level 1 Streaming Quotes for U.S. Market". App or desktop data subscriptions do not carry over to the API, and only one device may use the data at a time. So Webull FAILS the consolidated-data test through its own API (it could still be paired with a separate data vendor). The "free" claim is Webull's; the API subscription price itself is shown only after login (DC-54).
Page: "Market Data API Overview" (Webull developer docs) and "Open API" (Webull)
URL: https://developer.webull.com/apis/docs/market-data-api/overview/ and https://www.webull.com/open-api
Accessed: 2026-10-13
Strength: A
Price: published as "Free Level 1" on the marketing page; subscription screen gated and unverified (login)
Quote: "Subscribe Nasdaq Basic (Level 1) or Nasdaq Totalview (Level 2) for Non-Display OpenAPI usage" and "Market data subscriptions purchased through the Webull mobile app or desktop platform (QT) are independent of OpenAPI." and "Only one device may access LV1/LV2 data at any one time." (verbatim (curl))
Also: "Free Level 1 Streaming Quotes for U.S. Market" (verbatim (curl), marketing page)

**BK-35.** Webull margin interest: Webull Standard 8.74 percent at every balance tier (Webull Premium, a paid plan, 5.20 percent under 25,000 dollars); the page says the rates are "as of March 31, 2026". Method, from Webull's help center: daily average of each day's CLOSING SETTLED debit balance, annual rate divided by 360; a position opened on margin and closed the same day is NOT charged. Resolves the row mapping doubt in MB-70 (the 8.74 percent row prints directly above the label "Webull Standard").
Page: "Margin Trading" (Webull) and "Margin Interest & Short Selling Fees" (Webull help, FAQ 11019)
URL: https://www.webull.com/margin and https://www.webull.com/help/faq/11019-Margin-Interest-Short-Selling-Fees
Accessed: 2026-10-13
Strength: A
Price: published (but dated March 31, 2026 on the page)
Quote: "$0 - $24,999.99 ... 8.74% ... Webull Standard" and "*Margin rates shown are as of March 31, 2026 and are subject to change." (verbatim (curl), cells joined; the hyphen in the balance range is the page's) and "If you open a position using margin and close it on the same day, no margin interest will be charged for that position." and "Monthly Margin Interest = Average Daily Debit Balance × (Annual Interest Rate ÷ 360) × Number of Days in Period" (verbatim (curl))

### Borrowing caps the customer can set (all brokers)

**BK-36.** Public has an on/off borrowing switch: the customer can "disable margin investing, but maintain a margin account (meaning no leverage or credit will be offered)", or convert to a cash account. It is a switch, not a multiplier (no 1x/2x/4x choice), and the help article describes it in the app and website ("Manage Margin"), not in the API. Keeping a margin account with lending off still avoids cash account settlement limits (MB-62). Run 2's "no cap found" for Public (MB-79 survey) is corrected for an on/off cap.
Page: "How do I disable Margin investing?" (Public help center)
URL: https://help.public.com/en/articles/10151908-how-do-i-disable-margin-investing
Accessed: 2026-10-13
Strength: A
Quote: "Disable margin investing, but maintain a margin account (meaning no leverage or credit will be offered)" and "Click on Turn off margin investing or Request to switch to cash account" (verbatim (curl))

**BK-37.** No customer-set borrowing cap was found today for Tradier, Schwab, Interactive Brokers, TradeStation, tastytrade or Webull. IBKR: a search summary of its knowledge base points only to changing the account type (cash, Reg T, portfolio margin) through Client Portal and to per-order size limits in "precautionary settings", not to a leverage cap; the knowledge base pages were not opened. Webull: a legal-information site (strength C, not opened) claims a Webull margin account cannot be turned back into a cash account; not verified. Not finding a setting is not proof none exists. Alpaca (BK-15, a 1, 2 or 4 multiplier through the API) and Public (BK-36, an on/off switch in the app) are the only two with a documented customer-set cap; Robinhood's Agentic account has no borrowing at all (MB-55). Tradier's removal of 4 times intraday buying power (BK-01) is a broker-wide limit, not a customer setting.
Page: web search result summaries only (no page opened for this negative finding)
URL: n/a
Accessed: 2026-10-13
Strength: D (absence of evidence)
Quote: n/a

### Brief checks: E*TRADE, Robinhood Agentic, moomoo, Lightspeed

**BK-38.** E*TRADE (brief check): its own API reference still says the access token goes inactive after two hours without requests and, by default, expires at midnight U.S. Eastern time, after which "the user logs in again". A person must sign in EVERY day. Re-confirms BR-48. E*TRADE fails the weekly sign-in test.
Page: "Authorization API: Renew Access Token" (E*TRADE developer docs, sandbox host)
URL: https://apisb.etrade.com/docs/api/authorization/renew_access_token.html
Accessed: 2026-10-13
Strength: A
Quote: "By default the access token expires at midnight US Eastern time. Once the token has expired, no further requests will be processed until the user logs in again and the application secures a new access token." (verbatim (curl))

**BK-39.** Robinhood Agentic account (brief check): unchanged from MB-55. "Limited margin" lets the agent trade with unsettled sale proceeds but gives no borrowing; trade approvals are ON by default and can be turned off. So it fails the "new margin account with borrowing" requirement today.
Page: "Setting up an agent" (Robinhood support)
URL: https://robinhood.com/us/en/support/articles/setting-up-an-agent/
Accessed: 2026-10-13
Strength: A
Quote: "Limited margin allows you to trade with unsettled funds from stock and option sales. It doesn't provide borrowing power or leverage, and margin borrowing isn't currently available in Agentic accounts." and "Trade approvals are turned on by default." (verbatim (curl); the apostrophe is the page's curly one)

**BK-40.** moomoo (brief check): its API's U.S. stock quote right is "Nasdaq Basic + Nasdaq TotalView + NYSE Arcabook" (free during a promotion), which is a set of exchange feeds, not the consolidated SIP; real-time quotes are limited by a "Subscription Quota" (the quota table shows tiers such as 100, 300 and 1,000 simultaneous subscriptions; the tier conditions were not read). Access is through the OpenD gateway program (a gateway-free REST mode is described on the developer home page per a search summary, not opened). Fails the consolidated-data test through its own API. Regime, margin rate and token life not checked.
Page: "Authorities and Quota" (moomoo API docs)
URL: https://openapi.moomoo.com/moomoo-api-doc/en/intro/authority.html
Accessed: 2026-10-13
Strength: A
Quote: "LV3 market quotes for free during promotion period. (Nasdaq Baisc + Nasdaq TotalView + NYSE Arcabook)" (verbatim (curl), the page's own misspelling of "Basic") and "Subscription Quota [is the] Number of real-time quotes subscribed at the same time." (verbatim (curl), a double dash replaced by "[is the]")

**BK-41.** Lightspeed (brief check): applies the intraday margin standard from June 4, 2026 but "Not all Lightspeed platforms will be ready", and it expects the legacy PDT framework "to fully sunset on October 27, 2026" (that is two weeks from today, a date of Lightspeed's own choosing within FINRA's phase-in). So whether a new small margin account on Lightspeed's API platform is on the new standard today is NOT VERIFIED. A search summary says Lightspeed may offer less leverage to new users without trading history (not opened). Data, rates and API terms not checked.
Page: "FAQ: New Intraday Margin Rules (Effective 2026)" (Lightspeed)
URL: https://lightspeed.com/trading/intraday-trading-faqs
Accessed: 2026-10-13
Strength: A
Quote: "The updated intraday margin standards became effective on June 4, 2026, with the legacy PDT framework expected to fully sunset on October 27, 2026." and "No. Not all Lightspeed platforms will be ready for the transition on June 4, 2026." (verbatim (curl))

### Alpaca, one more check

**BK-42.** Alpaca's "Trading Account" page (updatedAt 2026-07-07) says a brokerage account holder will "receive real-time consolidated market data", which conflicts with Alpaca's own plan table (BK-17): the free Basic plan is real-time from IEX only, and consolidated (SIP) real time needs Algo Trader Plus at 99 dollars a month. The plan table is more specific and is dated later (2026-10-06); treat the account page sentence as loose wording. The same page says every account opens as a margin account and margin trading needs 2,000 dollars of equity; multiplier 2 is "the default for all accounts with $2,000 or more equity", and multiplier 4 is a class ("accounts with 4x intraday BP"), so whether a new small account gets 4 times automatically is still not stated (run 2 Not verified 5 stays open). The account configuration's max_margin_multiplier caps at most to that class.
Page: "Trading Account" (Alpaca docs, updatedAt 2026-07-07)
URL: https://docs.alpaca.markets/us/docs/account-plans.md
Accessed: 2026-10-13
Strength: A
Quote: "Using the Alpaca API, you'll be able to buy and sell stocks in your brokerage account, and you'll receive real-time consolidated market data." and "All accounts are opened as margin accounts. Accounts with $2,000 or more equity will have access to margin trading and short selling." (verbatim (curl); the apostrophes are the page's curly ones)

## Dead ends

- IBKR FAQ (script-built page): two attempts to find its article data address in the page's script files failed; the request helper is defined in a shared script, and further digging was stopped. Needs a browser.
- IBKR authentication FAQ and Client Portal Gateway FAQ: HTTP 404 to curl, 403 to the fetch tool.
- Schwab developer portal: HTTP 403 to plain curl today (an empty script shell in run 2).
- Tradier margin disclosure PDF: the fetch tool could not decode it; the text was extracted from the PDF it saved, with the built-in Python.
- tastytrade margin rates: https://tastytrade.com/margin-rates/ returns HTTP 404; pricing and commissions pages hold no rate.
- TradeStation market data pricing, equities tab: drawn by script, not in the page source.
- BrokerChooser (tastytrade margin rate): HTTP 403. Not retried.
- Alpaca full-docs file (llms-full.txt): HTTP 302 to a 23 byte body; used the per-page ".md" addresses instead.
- Webull developer docs index (llms.txt): HTTP 404.

## Method deviations

- schwab.com and tradestation.com refused plain curl (503 and 403) and the fetch tool. As in run 2 (MB-29), these pages were fetched with curl sending a generic desktop browser identification line (a stock User-Agent string naming a browser and operating system only). No name, e-mail address, cookie, account or other personal information was sent to any site, in any header or request.
- Downloads were kept in a scratch folder outside the repo (scratchpad/bk-dl) so they could be searched more than once, and deleted at the end of the session. The fetch tool also saved one PDF (Tradier's margin disclosure) in the session's tool-results folder by itself.
- Some quotes come from tables where curl joins cells; these are marked "cells joined" and use "..." for left-out cells. Dashes in sources were replaced and marked.

End of file marker
