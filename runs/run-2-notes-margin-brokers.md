# Run 2 notes: margin accounts and brokers for an automated intraday agent with 10,000 to 25,000 dollars

Research helper notes for run 2. Access date for every source opened in this session is 2026-10-09 (America/Chicago, checked with `date`: Fri Oct 9 2026). Findings reused from run 1 keep their 2026-10-08 date and their BR number. This is research input for a human decision, never an instruction to trade.

Status of this file: written as the work went, appended after every few findings. If the last line is not "End of file marker", the session ran out of room and the sections after the findings register may be missing.

Method: every new finding comes from a page opened live in this session with web search, the fetch tool, or curl through the shell. Recalled knowledge was used only to decide where to look. No account was created, nothing was installed, no browser tool was used, no connector was configured, nothing was committed. Where a page was read with curl, the raw page was passed to the Mac's built-in Python (python3 -I, standard library only) to strip the markup, and the quote was copied from that text, so those quotes are verbatim. Most pages were piped straight through with nothing saved. Disclosure: thirteen raw downloads were saved for a short time in the session's temporary scratchpad folder outside this repo so they could be searched more than once, and were deleted before the session ended: the two Federal Register plain-text copies, the text extracted from FINRA's Attachment A, nine Alpaca documentation pages (including the docs index), and the PDF of the June 23, 2026 congressional letter. The fetch tool also saved the Attachment A PDF by itself in the session's tool-results folder. No file was created inside the repo other than this one. Findings say "verbatim (curl)" where that was done.

Strength labels: A = primary and authoritative (a regulator, or the vendor's own documentation, pricing page or terms, seen live). B = reputable independent press or an established reference publisher. C = review sites, comparison sites, affiliate blogs. D = forums, social posts, personal blogs, community code repositories.

Price labels: "published" (on the vendor's own public page, seen live today), "corroborated" (two or more independent sources agree, named), "gated and unverified" (with the reason).

Caveat on quotes: the fetch tool passes each page through a small summarizing model and can paraphrase. Quotes marked "verbatim (curl)" were copied from the raw page text. Quotes with no mark are as returned by the fetch tool and are probably, but not provably, verbatim. Anything the tool clearly reworded is marked "paraphrase by fetch tool". Supporting quotes are capped at 40 words; extra fragments are listed as "Also on the page".

Acronyms used: FINRA (Financial Industry Regulatory Authority, the brokers' self-regulator). SEC (Securities and Exchange Commission). API (application programming interface, the way software talks to a broker). MCP (Model Context Protocol, the standard that lets an AI assistant such as Claude use an outside service as a tool; an "MCP server" or "connector" is that tool). OAuth (a sign-in standard where the customer approves an app on the broker's own screen). PDT (pattern day trader, the old rule). ETF (exchange-traded fund).

### Run 1 findings reused (kept with their 2026-10-08 date, not reopened)

- Rules: BR-01 (T+1 settlement), BR-03 (SEC approval of April 14, 2026), BR-04 (effective June 4, 2026; phase-in to October 20, 2027), BR-07 (the old rule was written for margin accounts), BR-09 (Regulation T cash account section), BR-10 and BR-69 (how cash account violations work), BR-70 and BR-71 (market data classes).
- Schwab: BR-11, BR-13, BR-14, BR-15 (community-sourced API facts) and BR-12 (7 day refresh token, still strength D because Schwab's developer site could not be read).
- Alpaca: BR-17, BR-18, BR-20 to BR-26 (staff statement on the cash-only setting, unsettled funds, keys, paper trading, rate limit, commission, market data, official connector, order types).
- Interactive Brokers: BR-27 to BR-30 (desktop TWS API facts), BR-32 (commission), BR-33, BR-57 (official connector drafts orders only).
- Tradier: BR-34, BR-35, BR-37 to BR-41. TradeStation: BR-42 to BR-45. E*TRADE: BR-48 to BR-51. Webull: BR-53, BR-54, BR-55, BR-56. Public: BR-59, BR-60. tastytrade: BR-61 to BR-64. Robinhood: BR-66, BR-67. Fidelity: BR-68. Connector repository dates: BR-72.

### Run 1 findings reopened, and why

- BR-05 (Rule 4210 text): run 1 had a paraphrase of paragraph (d)(2). Now verbatim, MB-01 to MB-06.
- BR-02, BR-06, BR-08 (FINRA investor pages): re-read for the margin account questions (minimum equity, deficits, count limit). MB-10 to MB-12, MB-15, MB-19.
- BR-16, BR-19, BR-73 (Alpaca): the margin requirement makes Alpaca's regime, multiples, leverage cap and margin fields matter. MB-20 to MB-28.
- BR-11, BR-12 (Schwab): the brief asked for a Schwab-owned page on token life and margin support. Tried; the developer site is still unreadable without a browser. Schwab's public pages were readable today and gave regime, rates and commission. MB-30 to MB-36.
- BR-27, BR-28, BR-31 (Interactive Brokers): the brief asked about the ordinary Web API and whether IBKR Pro is required. MB-41 to MB-45. BR-31 is now confirmed from IBKR's own page.
- BR-36 (Tradier token expiry): still not stated. MB-65.
- BR-46, BR-47 (TradeStation connector minimum and commission): resolved from TradeStation's own pages. MB-50, MB-51, MB-54.
- BR-52, BR-56 (Webull): the brief asked whether the direct API needs in-app confirmation. MB-72, MB-73.
- BR-58 (Public API page): re-read for margin account support. MB-62.
- BR-65, BR-66, BR-67 (Robinhood): account type, settlement and authorization. MB-55 to MB-57.
- Run 1 Not verified item 3 (which regime each broker applies): now answered for nine of eleven brokers. Section 2, table (b).
- Run 1 "Needs browser" list: most of it turned out to be readable with curl. MB-29.

## 1. Findings register

### Q1. The new intraday margin standard

Method note for this block: finra.org refused curl (HTTP 403, a Cloudflare "Just a moment" challenge page) but answered the fetch tool. The fetch tool's summarizing model would not reproduce the rule text at length. The verbatim rule text below therefore comes from two documents that could be read as raw text: (1) FINRA's own "Attachment A" to Regulatory Notice 26-10, a PDF the fetch tool saved by itself into the session's tool-results folder outside this repo, with the text pulled out by python3 -I (standard library only); (2) the Federal Register plain-text copy of the SEC approval order, fetched with curl from federalregister.gov. Attachment A shows the amendments as adopted (new words underlined, deleted words in brackets), so it is the amended wording, and the live rulebook page (BR-05, reopened today through the fetch tool) agrees with it on every fragment checked.

**MB-01.** VERBATIM Rule 4210(d)(2)(A), the core duty. The broker must work out an "intraday margin deficit" for each ordinary margin account on any day the account has a transaction that reduces its intraday margin level. (This closes run 1's Not verified item 14.)
- Page: "Regulatory Notice 26-10, Attachment A" (FINRA; text of the amendments under SR-FINRA-2025-017)
- URL: https://www.finra.org/sites/default/files/2026-04/Regulatory-Notice-26-10-Attachment-A.pdf
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (PDF text extracted locally): "Each member shall determine the intraday margin deficit, if any, for each margin account of a customer that it maintains (other than a good faith account or portfolio margin account)"
- Also, verbatim, the rest of the same sentence: "and for each day in which there is any IML-reducing transaction in such account."

**MB-02.** VERBATIM definition of "intraday margin level" (IML), Rule 4210(a)(17). In plain English: the IML is the cash the customer could take out and still meet the ordinary maintenance margin requirement. If the number is negative, it is the cash the customer would have to put in.
- Page and URL: as MB-01 (Attachment A).
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim: "(A) the amount of cash that the customer could withdraw while still having the maintenance margin required by provisions of Rule 4210 other than Rule 4210(d)(2); or"
- Also in the document, verbatim: "(B) the amount of additional cash (expressed as a negative number) that the customer would need to deposit into such margin account for it to have the maintenance margin required by provisions of Rule 4210 other than Rule 4210(d)(2)," and "in each case determined as of such time or immediately after such IML-reducing transaction in accordance with Rule 4210(d)(2)(B)."

**MB-03.** VERBATIM definition of "IML-reducing transaction", Rule 4210(a)(18). A stock purchase is the plain example. A withdrawal of cash also counts.
- Page and URL: as MB-01 (Attachment A).
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim: "any purchase or sale effected in such account (including as the result of the exercise or assignment of an option) that has the effect of reducing the account's IML"
- Also in the document, verbatim: "the expiration of any option long in the account that has the effect of reducing the account's IML, and any withdrawal of cash or securities from such account."
- SEC's gloss in the approval order (Federal Register text, verbatim, curl): "any transaction that reduces the amount available to a customer to withdraw while still meeting the maintenance margin requirement (for example, the purchase of a stock other than to cover a short position". URL: https://www.federalregister.gov/documents/2026/04/17/2026-07485/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-of (91 FR 20731, April 17, 2026). Strength: A.

**MB-04.** VERBATIM definition of "intraday margin deficit", Rule 4210(a)(19). It is the worst (most negative) intraday margin level reached right after any IML-reducing transaction that day. One bad moment in the day sets the deficit, even if the account is fine by the close.
- Page and URL: as MB-01 (Attachment A).
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim: "an amount determined in accordance with Rule 4210(d)(2)(B) by the member maintaining such account that is not less than the absolute value of the largest negative IML (if any) with respect to any IML-reducing transaction"
- Also, verbatim: "in such margin account during such day."

**MB-05.** VERBATIM Rule 4210(d)(2)(C): a deficit must be met "as promptly as possible", it is met by net deposits or anything else that raises the IML (for example selling positions), and it stays on the books for up to 15 business days.
- Page and URL: as MB-01 (Attachment A).
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim: "then the member shall require such intraday margin deficit to be satisfied as promptly as possible."
- Also, verbatim: "An intraday margin deficit for a day is “satisfied” if, from the end of such day to the end of a subsequent day, the customer has made net deposits, or otherwise caused an increase in the account's IML, sufficient to equal such intraday margin deficit." and "An intraday margin deficit shall remain outstanding until satisfied or until immediately after the close of business on the fifteenth business day after the date of the intraday margin deficit."

**MB-06.** VERBATIM Rule 4210(d)(2)(D), the 90 day freeze. It bites only when BOTH things are true: the customer "makes a practice" of not meeting deficits promptly, AND a deficit is still unmet at the close of the fifth business day. The freeze stops new borrowing (creating or increasing a debit balance) and new shorts. It does not close the account. Small deficits are ignored for the "practice" test.
- Page and URL: as MB-01 (Attachment A).
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim: "the member shall enforce written policies and procedures reasonably designed to prevent the customer from creating or increasing a short position or debit balance (other than by closing a short position) for 90 calendar days after such fifth business day"
- Also, verbatim: "or until the intraday margin deficit has been satisfied (without regard to its expiration pursuant to Rule 4210(d)(2)(C)(iii))." and the two exclusions: "(i) do not exceed the lesser of 5% of the equity in the margin account or $1,000; or" and "(ii) are reasonably determined by the member to have occurred under extraordinary circumstances".
- Reading note (mine, not a quote): the freeze is on "creating or increasing a ... debit balance". A debit balance is money owed to the broker. Read literally, a frozen account could still buy with its own cash. No source opened today says that in so many words, so treat it as a reading, not a finding.

**MB-07.** FINRA's interpretation of "makes a practice": as a general matter, a customer who meets all but three deficits in a rolling 12 months, each within three business days, is not treated as making a practice of failing.
- Page: "Interpretations of Rule 4210 (valid from June 4, 2026)" (FINRA), interpretation 4210(d)(2)(D)/01
- URL: https://www.finra.org/rules-guidance/guidance/interps-4210-202606
- Accessed: 2026-10-09. Strength: A.
- Quote (fragments as returned by the fetch tool): "a customer who satisfies all but three intraday margin deficits occurring in a rolling 12-month period" and "within three business days after their occurrence"
- The surrounding sentence is a paraphrase by fetch tool. The exact wording needs a browser read.

**MB-08.** A broker may comply by blocking, in real time, any order that would push the intraday margin level below zero, in which case its customers never have a deficit at all. Or it may compute once at the end of the day and issue a call afterwards. Which method a broker uses decides what an agent experiences: a rejected order, or a margin call the next morning.
- Page: SEC approval order, Federal Register, 91 FR 20731 (April 17, 2026), plain-text copy
- URL: https://www.federalregister.gov/documents/2026/04/17/2026-07485/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-of
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "members could comply with the rule by implementing real-time monitoring of customer positions and blocking transactions that would otherwise create or increase intraday margin deficits. As a result, these members' customers should never incur intraday margin deficits."
- Also, verbatim: "real-time monitoring is not a requirement under the rule and that members would be permitted, alternatively, to continue to make a single margin calculation at the end of the day"
- FINRA interpretation 4210(d)(2)(A)/01 says the same (fragments as returned by the fetch tool): "could determine a margin account to have no IMD on any day" and "The member is responsible for ensuring that its controls are effective". URL: https://www.finra.org/rules-guidance/guidance/interps-4210-202606.

**MB-09.** If a deficit is not met within five business days the broker itself takes a capital charge, which is why brokers will chase deficits or simply block the orders. (This is the broker's cost, not a customer penalty.)
- Page and URL: as MB-08 (SEC approval order, Federal Register).
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "If an intraday margin deficit is not satisfied within five business days, the member would be required to deduct the deficit in its net capital computations (for up to ten business days)."

**MB-10.** No limit on the NUMBER of day trades survives in the rule. The four-trades-in-five-days definition is deleted text, and the SEC says the new rules no longer depend on counting trades. A broker can still impose its own count as a house rule (MB-13), and a broker still in the phase-in may still apply the old count (BR-04).
- Page: Attachment A (as MB-01) for the deletion; SEC approval order (as MB-08) for the statement.
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (SEC order, curl): "The new intraday margin rules should be easier for customers to understand, as they no longer depend on counting trades over several days to determine pattern day trader status or require customers to monitor their day-trading buying power."
- Deleted rule text, shown in brackets in Attachment A, verbatim: "[(ii) The term “pattern day trader” means any customer who executes four or more day trades within five business days.]"
- Corroboration: FINRA Investor Insights article of April 20, 2026 (BR-06, reopened today), fragment as returned by the fetch tool: "no 'pattern day trader' designation based on counting trades". Regulatory Notice 26-10 (reopened today): no count limit stated.

**MB-11.** The 2,000 dollar minimum equity for a margin account is unchanged. The 25,000 dollar sentence was struck from the same paragraph.
- Page and URL: as MB-01 (Attachment A), Rule 4210(b)(4).
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim: "(4) equity of at least $2,000 except that cash need not be deposited in excess of the cost of any security purchased"
- Deleted sentence, verbatim: "[The minimum equity requirement for a “pattern day trader” is $25,000 pursuant to paragraph (f)(8)(B)(iv)a. of this Rule.]"
- FINRA investor wording (page dated June 04, 2026, https://www.finra.org/investors/investing/investment-products/stocks/day-trading, reopened today): "To trade using margin (funds borrowed from your firm), you must maintain a minimum of $2,000 in equity in your margin account." FINRA Investor Insights (April 20, 2026): "$2,000 is the minimum equity required to engage in leveraged trading."

**MB-12.** The maintenance requirement for stock held long is 25 percent of current market value, and FINRA's investor article says it must be met throughout the trading day under the new standard, not only at the close.
- Page: "4210. Margin Requirements" (FINRA rulebook), paragraph (c)(1); and "Understanding the New Intraday Margin Requirements" (FINRA Investor Insights, April 20, 2026)
- URL: https://www.finra.org/rules-guidance/rulebooks/finra-rules/4210 and https://www.finra.org/investors/insights/intraday-margin-requirements
- Accessed: 2026-10-09. Strength: A.
- Quote (rulebook, as returned by the fetch tool): "25 percent of the current market value of all margin securities, as defined in Section 220.2 of Regulation T"
- Quote (investor article, as returned by the fetch tool): "a minimum equity level of 25 percent of the current market value" and "throughout the entire trading day."

**MB-13.** The Regulation T initial requirement is 50 percent of the value of a stock position (federal rule, Federal Reserve Board). The intraday rule did not change it or the 25 percent maintenance figure. Brokers may always ask for more ("house" requirements).
- Page: "§ 220.12 Supplement: margin requirements." 12 CFR Part 220 (Regulation T), 2025 annual edition on govinfo.gov
- URL: https://www.govinfo.gov/content/pkg/CFR-2025-title12-vol3/xml/CFR-2025-title12-vol3-sec220-12.xml
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "Margin equity security, except for an exempted security, money market mutual fund or exempted securities mutual fund, warrant on a securities index or foreign currency or a long position in an option: 50 percent of the current market value"
- SEC order (verbatim, curl, URL as MB-08): "customers of FINRA member broker-dealers remain subject to current initial and regular maintenance margin requirements under FINRA Rule 4210." and "broker-dealers may always collect additional margin from customers than required under Rule 4210 under their “house” margin requirements."

**MB-14.** WHAT THIS MEANS FOR HOW MUCH A 10,000 TO 25,000 DOLLAR LONG-ONLY ACCOUNT CAN HOLD. This finding is arithmetic of mine built on MB-02, MB-12 and MB-13. No FINRA or SEC page opened today states these multiples in so many words, so it is a derivation, not a quote. What would turn it into a measurement: the chosen broker's own stated buying power for the account.
- Intraday: the intraday margin level is equity minus the maintenance requirement on what is held. At 25 percent maintenance, each 1 dollar of stock bought uses 0.25 dollars of intraday margin level. An account with equity E and no positions therefore reaches a zero intraday margin level at 4 times E of stock (40,000 dollars on 10,000; 100,000 dollars on 25,000). That is the regulatory ceiling. A broker may set a lower one, and many stocks carry higher house maintenance percentages, which lowers it further.
- Overnight: a position still held at the end of the day must meet the Regulation T 50 percent initial requirement, which is 2 times E (20,000 dollars on 10,000; 50,000 dollars on 25,000), and then 25 percent maintenance from then on.
- The old rule gave the 4 times figure only to accounts with 25,000 dollars or more (deleted text in Attachment A, verbatim: "less any maintenance margin requirement as prescribed in paragraph (c) of this Rule, multiplied by four for equity securities"). Under the new rule the same ceiling follows from the maintenance requirement at any equity above 2,000 dollars.
- Losses during the day reduce equity and therefore reduce the intraday margin level in real time (MB-12, "throughout the entire trading day").

**MB-15.** REUSING SALE PROCEEDS THE SAME DAY IN A MARGIN ACCOUNT. No FINRA or SEC page opened today says in one sentence "margin account sale proceeds are available at once". What the primary texts do say: (a) the 90 day settlement freeze and the "good faith" problem live in the Regulation T CASH account section (BR-09, reused); (b) in a margin account the test is the intraday margin level "as of such time or immediately after such IML-reducing transaction" (MB-02), and a sale of a long position is not an IML-reducing transaction (MB-03), so after a sale the room it used is back for the next purchase; (c) FINRA's investor page puts freeriding only in its cash account section. Brokers say it outright: Alpaca, BR-18 (reused): "you don't need to wait for trades to settle before using the proceeds to buy more equities." So the cash account good faith violation problem does not arise in a margin account. Label: (a) and the broker quote are evidence; the step from (b) is my reading of the definitions.
- Page: "Frequent Intraday Trading: Understanding the Basics" (FINRA, page dated June 04, 2026)
- URL: https://www.finra.org/investors/investing/investment-products/stocks/day-trading
- Accessed: 2026-10-09 (reopened; first seen in run 1 as BR-02 and BR-08). Strength: A.
- Quote (as returned by the fetch tool): "Buying and selling the same security in a cash account before paying for it is known as 'free-riding.'" and "When trading on margin during the day, intraday margin requirements will apply."
- One wrinkle from the rule text (MB-01 document, (d)(2)(B)(vi), verbatim): if the broker "cannot demonstrate that one activity occurred before another activity, then the IML with respect to such activities shall be computed on the assumption that the activities occurred in an order that results in the highest intraday margin deficit for such day." A broker with poor time-stamping could in theory compute a deficit for rapid buy and sell sequences that never really existed. Not expected at an API broker, but it is in the rule.

**MB-16.** Closing a position that was already open at the start of the day may be treated by the broker as if it happened first thing, which frees its margin for the whole day. This is optional for the broker and applies only to positions carried in from a prior day.
- Page and URL: as MB-01 (Attachment A), Rule 4210(d)(2)(B)(iv).
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim: "the member may treat the following as occurring simultaneously and immediately after the beginning of the day, notwithstanding the actual time of their occurrence: a. all deposits and withdrawals of cash or securities"
- Also, verbatim: "b. any transaction that closes a position that was open at the beginning of such day"
- FINRA interpretation 4210(d)(2)(B)(iv)b./01 (fragments as returned by the fetch tool): "permits (but does not require) a member to treat maintenance margin released by closing a position" and "This is only available for positions open at the beginning of the day". URL: https://www.finra.org/rules-guidance/guidance/interps-4210-202606.

**MB-17.** FINRA's worked example of meeting a deficit by selling: selling 2,500 dollars of stock raised the intraday margin level by only 625 dollars (one quarter, the 25 percent maintenance released), so selling is a slow way to cure a deficit compared with depositing cash.
- Page: "Interpretations of Rule 4210 (valid from June 4, 2026)", interpretation 4210(d)(2)(C)(ii)/05 "Example: Liquidation"
- URL: https://www.finra.org/rules-guidance/guidance/interps-4210-202606
- Accessed: 2026-10-09. Strength: A.
- Quote (as returned by the fetch tool): "Although the customer sold $2,500 of ABC, the account's IML only increased by $625"

**MB-18.** FINRA published interpretations and investor education materials for the new standard on May 19, 2026 (Regulatory Notice 26-11), effective June 4, 2026. No stand-alone FINRA "FAQ" page on intraday margin was found; the interpretations page is the nearest thing.
- Page: "Regulatory Notice 26-11" (FINRA), "FINRA Announces Publication of Interpretations and Investor Education Materials Relating to New Intraday Margin Standards"
- URL: https://www.finra.org/rules-guidance/notices/26-11
- Accessed: 2026-10-09. Strength: A.
- Quote (as returned by the fetch tool): "replace the outdated day trading margin requirements in their entirety"

**MB-19.** During the phase-in a broker may keep applying the old day trading requirements "by account", and FINRA tells investors to ask their firm which rules apply. Neither notice requires the broker to publish which regime it is on. So the only way to know is each broker's own page or a direct question (see Q2).
- Page: FINRA's original notice of the proposed rule change, Federal Register, 91 FR 1580 (January 14, 2026), plain-text copy; and FINRA Investor Insights (April 20, 2026)
- URL: https://www.federalregister.gov/documents/2026/01/14/2026-00519/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-of-a and https://www.finra.org/investors/insights/intraday-margin-requirements
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (Federal Register, curl): "members should be permitted for an interim period to continue to apply the current day trading margin requirements where they deem appropriate--for example, by account--while they prepare to implement the new provisions." (The two hyphens are in the source text.)
- Quote (investor article, as returned by the fetch tool): "Contact your firm to be sure you understand how the changes might affect your account."
- The interim period was proposed as 12 months and lengthened to 18 months by Amendment No. 1 (BR-04 gives the final date, October 20, 2027).

### Q2 to Q4. Broker by broker

#### Alpaca (reopened: BR-16, BR-17, BR-18, BR-19, BR-73)

Method note: Alpaca's documentation pages are served as plain text when ".md" is added to the address, so they were read with curl and the quotes are verbatim. Each page carries an "updatedAt" stamp, given below as the page date.

**MB-20.** Alpaca applies the NEW intraday margin standard. Its docs say the pattern day trader designation is gone, the 25,000 dollar minimum is gone, day trades are unlimited, and customers will no longer get orders rejected by pattern day trader protection. (Resolves BR-73 and run 1's Not verified item 3 for Alpaca.) No page gives the exact date Alpaca switched; the pages are stamped April 27 and July 7, 2026.
- Page: "Intraday Margin Rule for Non-Leverage Margin Accounts" (Alpaca docs, updatedAt 2026-04-27) and "The Intraday Margin Rule" (Alpaca docs, updatedAt 2026-07-07)
- URL: https://docs.alpaca.markets/us/docs/understanding-the-new-intraday-margin-rule and https://docs.alpaca.markets/us/docs/the-intraday-margin-rule
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl), first page: "Consequently, PDT restrictions are no longer necessary, and clients will no longer encounter trade rejections stemming from PDT protection and restrictions."
- Also, verbatim, first page: "No. The previous "4-trade limit" has been eliminated. You may enter and exit positions as frequently as you choose, provided your account has sufficient equity to cover the intraday risk requirements set by your broker."
- Also, verbatim, second page (comparison table row): "Trade Limits | Max 3 day trades per 5 days (under $25k) | Unlimited day trades" and "The specific $25,000 equity minimum required to day trade has been removed."
- Limit: the wording is partly general ("Brokers are no longer required to..."). The sentence about clients no longer meeting rejections is the part that speaks for Alpaca's own system.

**MB-21.** Alpaca on a deficit: a margin call is issued, to be met within two business days (stricter than the rule's "as promptly as possible"); unmet by the close of the fifth business day means a 90 day freeze on new borrowing and shorts; deficits under the lesser of 1,000 dollars or 5 percent of equity generally trigger no call.
- Page: "The Intraday Margin Rule" (Alpaca docs, updatedAt 2026-07-07)
- URL: https://docs.alpaca.markets/us/docs/the-intraday-margin-rule
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "If an IMD occurs, a margin call will be issued. This call must be satisfied within **two business days**."
- Also, verbatim, the next sentence: "If an IMD remains unmet by the close of the fifth business day, the account will be subject to a **90-day freeze**"
- Also, verbatim: "restricting the account from increasing short positions or creating new debit balances." and "An intraday margin call is generally not triggered if the unmet deficit is less than **$1,000 or 5% of account equity** (whichever is lower)"
- Note: Alpaca's wording drops the rule's "makes a practice" condition (MB-06). Read as written, Alpaca freezes on any deficit unmet at day five.

**MB-22.** Alpaca buying power: 2 times equity overnight, and up to 4 times intraday for a margin account with 2,000 dollars or more. Under 2,000 dollars: 1 times, no margin. The account page says 2 is the default multiplier and 4 is a class of account, so whether a new 10,000 dollar account gets 4 times automatically is not stated.
- Page: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17) and "Trading Account" (Alpaca docs, updatedAt 2026-07-07)
- URL: https://docs.alpaca.markets/us/docs/margin-and-short-selling and https://docs.alpaca.markets/us/docs/account-plans
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "In addition to the 2x buying power afforded to margin accounts, a Reg T Margin Account with $2,000 or greater equity can further be allowed to use up to 4x intraday buying power."
- Also, verbatim (Trading Account page, multiplier field): "**2** (reg T margin account with 2x intraday and overnight BP; this is the default for all accounts with $2,000 or more equity)," and "**4** (accounts with 4x intraday BP and 2x reg T overnight BP)"
- Also, verbatim (margin page): "to avoid receiving a margin call the next morning, the securities held would need to be reduced to $100,000 or less depending on the maintenance margin requirement by the end of the day." (their example uses 50,000 dollars of cash)

**MB-23.** Alpaca house maintenance requirements for long positions are higher than FINRA's 25 percent: 30 percent for shares above 6 dollars, 50 percent between 2.50 and 6 dollars, 100 percent under 2.50 dollars, 50 percent for 2x leveraged ETFs and 75 percent for 3x leveraged ETFs.
- Page: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17)
- URL: https://docs.alpaca.markets/us/docs/margin-and-short-selling
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (table rows, curl): "LONG | share price > $6.00 | 30% of EOD market value" and "LONG | 3x Leveraged ETF | 75% of EOD market value"

**MB-24.** Alpaca margin interest: 6.50 percent a year for ordinary ("non-elite") users, 5.00 percent for "elite" users, charged only on the end-of-day (overnight) borrowed balance, divided by 360. Borrowing that is repaid the same day costs nothing. Price label: published (vendor docs page; the page itself points to the fee schedule for the latest rate, which was not opened).
- Page: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17)
- URL: https://docs.alpaca.markets/us/docs/margin-and-short-selling
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl): "a competitive and low annual margin interest rate of 5.00% for elite users and 6.50% for non-elite users"
- Also, verbatim: "The rate is charged only on your account's end of day (overnight) debit balance" and "if you deposited $10,000 and bought $15,000 worth of stock that you liquidated the same day, you would not incur any interest expense."

**MB-25.** Alpaca lets the customer cap leverage through the API. The account configuration setting max_margin_multiplier accepts 1, 2 or 4. Two more switches matter for an agent: no_shorting (long-only mode) and suspend_trade (blocks new orders, a kill switch). Run 1's staff statement (BR-17, reused) says a value of 1 makes the API reject orders above available cash.
- Page: "Account Configurations" API reference (Alpaca docs, updatedAt 2026-05-27)
- URL: https://docs.alpaca.markets/us/reference/patchaccountconfig-1
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl, schema descriptions): "max_margin_multiplier": "Can be \"1\", \"2\", or \"4\"" and "no_shorting": "If true, account becomes long-only mode." and "suspend_trade": "If true, new orders are blocked."
- Caution: the API key that the agent uses can also change this setting (it is an API call on the same key). The cap stops accidents. It does not stop software that deliberately changes the setting. Whether Alpaca offers a key with narrower rights was not checked.

**MB-26.** Alpaca's account endpoint reports the margin state an agent needs: buying_power, regt_buying_power, initial_margin and maintenance_margin (both "continuously updated"), last_maintenance_margin, multiplier, sma, and the flags trading_blocked and account_blocked. No field named "margin call" was seen. The docs say real-time estimated margin values are a future addition.
- Page: "Get Account" API reference (Alpaca docs, updatedAt 2026-05-27) and "Margin and Short Selling"
- URL: https://docs.alpaca.markets/us/reference/getaccount-1
- Accessed: 2026-10-09 (reopened BR-19). Strength: A.
- Quote, verbatim (curl): "Maintenance margin requirement (continuously updated value)" and "Reg T initial margin requirement (continuously updated value)"
- Also, verbatim (margin page): "In the future, we will provide real-time estimated initial and maintenance margin values as part of the Account API to help users better manage their risk."

**MB-27.** Alpaca margin calls and forced selling: a call arrives the morning after an end-of-day shortfall; Alpaca may ask for immediate liquidation during the day if equity is materially below maintenance; it reserves the right to sell holdings without reaching the customer; no extension of time is owed.
- Page: "Margin and Short Selling" (Alpaca docs, updatedAt 2026-09-17)
- URL: https://docs.alpaca.markets/us/docs/margin-and-short-selling
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "If your account does not satisfy its initial and maintenance margin requirements at the end of the day, you will receive a margin call the following morning."
- Also, verbatim: "we reserve the right to liquidate your holdings in the event we cannot get ahold of you and your account equity is in danger of turning negative." and (footer) "Alpaca may sell any securities in your account, without prior notice, to satisfy a margin call."

**MB-28.** Alpaca has a second guard independent of buying power: if a position is 600 percent larger than account equity, the account is restricted to closing trades until Alpaca staff review it. An agent must treat this as a possible lockout.
- Page: "User Protection" (Alpaca docs, updatedAt 2026-09-16)
- URL: https://docs.alpaca.markets/us/docs/user-protection
- Accessed: 2026-10-09 (reopened BR-73). Strength: A.
- Quote, verbatim (curl): "Alpaca will restrict the account to closing transactions when an account has a position that is 600% larger than the equity in the account."

NV (Alpaca, still open): the date Alpaca switched; whether a new account under 25,000 dollars gets multiplier 4 by default or must ask; minimum deposit to open (none stated on the pages read; 2,000 dollars of equity is the margin threshold, BR-16); key expiry (BR-20 stands).

#### Access discovery that changes run 1's "blocked hosts" picture

**MB-29.** Method finding, not a broker fact. Run 1 recorded schwab.com, interactivebrokers.com and tradestation.com as refusing the fetch tool (HTTP 403). Today the fetch tool still gets an error page from schwab.com, but plain curl sending an ordinary browser identification line (a "User-Agent" header) gets HTTP 200 and the full page from www.schwab.com, www.interactivebrokers.com, www.tradestation.com, us.etrade.com and www.fidelity.com. So most of run 1's "Needs browser" list can be read without a browser. Still not readable this way: finra.org by curl (Cloudflare challenge; the fetch tool works there), developer.etrade.com (403), and developer.schwab.com (HTTP 200 but an empty application shell of 35 characters of text, because the page is drawn by JavaScript). Quotes taken this way are verbatim from the raw page text.
- Tested: 2026-10-09, one request per address, no sign-in, no form.

#### Charles Schwab (reopened: BR-11, BR-12 and run 1 Not verified item 1)

**MB-30.** Schwab applies the NEW standard. It stopped counting day trades in margin accounts on June 8, 2026, removed the pattern day trader flag from accounts under 25,000 dollars, and introduced "Intraday Margin Buying Power" on July 13, 2026 for margin accounts with at least 2,000 dollars.
- Page: "Schwab Updates Day Trading and Margin Rules" (Charles Schwab, dated July 6, 2026)
- URL: https://www.schwab.com/learn/story/schwab-changes-rules-around-day-trading
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "As of June 8, Schwab no longer counts day trades in margin accounts."
- Also, verbatim: "client accounts formerly flagged as PDT with a balance below $25,000 have had their PDT status removed and can now day trade using their available buying power." and "On July 13, Schwab will introduce Intraday Margin Buying Power for all eligible margin accounts with at least $2,000 in cash or eligible securities."

**MB-31.** Schwab intraday buying power: up to four times, based on a default 25 percent requirement for most stocks, calculated in real time. Positions above overnight buying power must be closed by 8 p.m. Eastern or a margin call may follow. Overnight is the Regulation T 50 percent limit (2 times).
- Page and URL: as MB-30.
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "Intraday Margin Buying Power is based on a default 25% maintenance margin requirement for most stocks. This can provide up to four times the buying power intraday"
- Also, verbatim: "If a client uses Intraday Margin Buying Power to open positions that exceed their overnight buying power, they must exit them by the end of the trading day (8 p.m. ET). If the positions are not closed by then, a margin call may be issued."

**MB-32.** Schwab chose real-time monitoring, so an order that would create or increase an intraday margin deficit may simply be blocked. For an agent that means a rejected order, not a surprise call.
- Page and URL: as MB-30.
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "may block trades that would create or increase intraday margin deficits" (the sentence begins "Firms that opt for real-time monitoring", followed by the words "as Schwab has", set off by dashes in the original).

**MB-33.** Schwab margin interest under 25,000 dollars borrowed: 12.075 percent a year (base rate 10.25 percent plus 1.825 percent), base last changed 9/18/2026. No interest on balances under 100 dollars. Price label: published.
- Page: "Schwab margin rates and requirements" (Charles Schwab)
- URL: https://www.schwab.com/margin/margin-rates-and-requirements
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl): "Schwab's current base rate is 10.25% and is subject to change without notice. Last changed on 9/18/2026." and (table row) "Debit Balance $100-$24,999.99 1 Margin Rate Base Rate + 1.825% Effective Rate 12.075%"

**MB-34.** Schwab margin requirements: 2,000 dollars in cash or marginable securities to begin borrowing; initial 50 percent; maintenance 25 percent for shares at 3 dollars or more; 100 percent for shares under 3 dollars; 50 percent for 2x leveraged ETFs and 75 percent for 3x; "special" maintenance of 50 percent on some volatile stocks.
- Page and URL: as MB-33.
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "To begin margin borrowing against securities in a Schwab brokerage account, you need at least $2,000 in cash or marginable securities."
- Also, verbatim (table): "≥ $3.00 per share Lesser of $2,000 or 100% market value 50% of cost 25% of market value" and "3X Leveraged ETFs/ETNs Lesser of $2,000 or 100% market value 75% of cost 75% of market value"

**MB-35.** Schwab commission: 0 dollars for online listed stock and ETF trades, no account or trade minimums. Price label: published. (Closes run 1's Schwab commission gap. Whether an order sent through the Trader API counts as "online" is not stated on this page.)
- Page: "Pricing" (Charles Schwab)
- URL: https://www.schwab.com/pricing
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl): "$0 Listed Stocks and ETFs online commission" and "No account or trade minimums"

**MB-36.** Schwab margin calls: a call can be met by deposit or by selling; no extension of time is owed; if not met, Schwab may sell securities in the account. Notices go by phone, email, mail or the website message center. Nothing on the page says the Trader API reports a margin call.
- Page: "Schwab margin rates and requirements" (Charles Schwab), section "What is a margin call?"
- URL: https://www.schwab.com/margin/margin-rates-and-requirements
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "You are not entitled to an extension of time to meet a margin call." and "Otherwise, Schwab may have to sell securities in your account at the current market value."

NV (Schwab, still open): everything on developer.schwab.com (the page is drawn by JavaScript, so curl gets an empty shell): the Schwab-owned statement of the 7 day refresh token life (BR-12 stays at strength D), whether the Trader API serves margin accounts, the balance and margin fields it returns, whether API orders are commission-free, terms on automated trading, and whether there is any setting to cap or switch off leverage on a Schwab margin account. No Schwab page read today describes a customer-set leverage cap. For the search for an official Schwab AI connector see MB-83.

#### Interactive Brokers (reopened: BR-27, BR-28, BR-31, BR-57)

**MB-37.** Interactive Brokers: regime is MIXED and account by account. Its own guide pages, last updated June 3, 2026, describe the new standard and then warn that an account may still be under the old rules until October 2027. Its account configuration page says accounts still under the old rules need 25,000 dollars to day trade. So a new margin account under 25,000 dollars at IBKR cannot be assumed to trade intraday freely. It has to be confirmed with IBKR for the specific account.
- Page: "Pattern Day Trader Reset" (IBKR Guides, Org. Portal User Guide, "Last updated on June 3, 2026") and "Configuring Your Account" (Interactive Brokers)
- URL: https://www.ibkrguides.com/orgportal/messagecenter/supportpdtreset.htm and https://www.interactivebrokers.com/en/accounts/configuring-your-account.php
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl), guide: "Your account may still be subject to existing PDT rules during FINRA's transition period, which ends in October 2027."
- Quote, verbatim (curl), account page: "During the PDT rule phase-out period, accounts that remain subject to existing Pattern Day Trading regulations must maintain a minimum of USD 25,000 in equity or equivalent to day trade."
- Conflict: NerdWallet (last updated Jun 4, 2026) lists Interactive Brokers among brokers that "changed their rules on June 4" (see MB-40 and Contradictions).
- The same note appears on the Trader Workstation guide page "Available for Trading Values" (https://www.ibkrguides.com/traderworkstation/available-for-trading.htm, last updated June 3, 2026), which still lists a "Day Trades Left" field.

**MB-38.** IBKR's own house version of the deficit rule: meet a deficit ideally within 3 business days; failing on 4 or more occasions in 12 months may bring a 90 day restriction across all the customer's margin accounts. The 2,000 dollar minimum for margin still applies.
- Page: "Pattern Day Trader Reset" (IBKR Guides, last updated June 3, 2026)
- URL: https://www.ibkrguides.com/orgportal/messagecenter/supportpdtreset.htm
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "Failing to satisfy an IMD on 4 or more occasions within a 12-month period may result in a 90-day trading restriction across all your associated margin accounts."
- Also, verbatim, the sentence before it: "IMDs must be satisfied as promptly as possible and ideally within 3 business days."
- Also, verbatim: "Clients will still be subject to the standard Reg T $2,000 minimum for trades using margin or short sales."

**MB-39.** IBKR margin accounts have no margin call grace period: margin is computed in real time and positions are liquidated at once if maintenance is not met. Sale proceeds are available immediately. For an unattended agent this is the harshest margin call handling of any broker read today, and also the most predictable.
- Page: "Configuring Your Account" (Interactive Brokers), account type comparison table
- URL: https://www.interactivebrokers.com/en/accounts/configuring-your-account.php
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "Margin: Margin is calculated on a real-time basis. Immediate position liquidation if minimum maintenance margin requirement is not met. Purchase and sale proceeds available immediately."

**MB-40.** Press list of who switched when (independent source): Robinhood, Webull, Interactive Brokers and tastytrade changed on June 4, 2026; Schwab on June 8; E*TRADE on June 9.
- Page: "The $25,000 Pattern Day Trading Rule Is No More" (NerdWallet, Sam Taube, last updated Jun 4, 2026)
- URL: https://www.nerdwallet.com/investing/news/pattern-day-trading-rule-change
- Accessed: 2026-10-09. Strength: B.
- Quote, verbatim (curl): "Some brokers reviewed by NerdWallet, such as Robinhood , Webull , Interactive Brokers and TastyTrade , changed their rules on June 4. Charles Schwab will implement the rule changes on June 8, while E*TRADE will implement them on June 9."
- Limit: written on the effective date and not updated since, so it records announcements, not observed behavior.

**MB-41.** IBKR Web API for an individual (the ordinary API, not the AI connector): access needs the IBKR username and password, a fully open and funded live account, and the account must be IBKR Pro. For retail clients sign-in runs through the "Client Portal Gateway", a small Java program the customer runs. (Confirms BR-31 from IBKR's own page and answers "is Pro required": yes.)
- Page: "Trading Web API" (IBKR Campus)
- URL: https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "Whether accessing a live account or its associated simulated paper account, the live account must be fully open and funded. The live account must also be of the "IBKR Pro" type."
- Also, verbatim, the sentence before it: "Web API usage for individual clients involves an IBKR username and password."
- Also, verbatim: "For retail and individual clients, Authentication to our WebAPI is managed using the Client Portal Gateway, a small java program used to route local web requests with appropriate authentication."
- Also on the page: OAuth 2.0 is marked "(beta)" and described as supporting "first-party (accessing one's own accounts)" use, but the Getting Started section routes retail clients to the gateway and institutions to an API Solutions team. Whether an individual can actually obtain OAuth access without the gateway is not stated. Not verified.

**MB-42.** IBKR Web API orders can be placed by software with no human confirming each one. Some orders come back with an "order reply message" (a precaution prompt) that must be confirmed, but the confirmation is a second API request the software itself can send, and whole categories of prompt can be switched off for the session.
- Page: "Trading Web API" (IBKR Campus), sections "Order Reply Messages" and "Order Reply Suppression"
- URL: https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "it might contain an "order reply message" -- essentially a notice -- which must be confirmed via a second request before our order ticket can go to work."
- Also, verbatim: "When a category of order reply messages is suppressed, you will no longer be sent order reply message responses requiring confirmation. Instead, a valid order ticket will be accepted and acknowledged immediately."

**MB-43.** IBKR Web API availability: reachable 24 hours a day on weekdays, maintenance on Saturday evenings, and the trading part resets briefly every night at about 01:00 Eastern. One username can hold only one trading session at a time across all IBKR platforms, so the owner signing in to the IBKR app with the same username would compete with the agent's session.
- Page: "Trading Web API" (IBKR Campus)
- URL: https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "The Web API itself is accessible 24 hours a day during the week. It receives maintenance only on Saturday evenings. Brokerage functionality (provided by /iserver endpoints) is briefly unavailable each evening at approximately 0100 local time by region."
- Also, verbatim: "A single username can only have one brokerage session active at a time across all IB platforms."
- NOT FOUND on this page: how long a gateway session lasts before a human must sign in again, and whether the two-factor sign-in must be repeated daily. The page that should say (https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/) returned an empty body to curl. See Needs browser. BR-27 and BR-28 (the desktop TWS API facts) stand unchanged.

**MB-44.** IBKR's Web API reports equity and margin through a portfolio summary endpoint. The page shows the endpoint but not the field list.
- Page: "Trading Web API" (IBKR Campus), section "Querying Equity and Margin"
- URL: https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "The /portfolio/{accountId}/summary endpoint delivers a wide variety of values related to an account's equity, margin use, and accrued balances."

**MB-45.** IBKR margin interest: Pro "begins at Benchmark plus 1.5%"; Lite is "Benchmark plus 2.5%". Minimum balance 0 dollars on both plans. The actual percentage for a balance under 25,000 dollars is drawn by a calculator on the page and did not come through curl, so the number is not recorded. Price label: gated and unverified (not login-gated; the table is drawn by JavaScript and needs a browser). The page's banner says "Margin loans start at USD 4.38%", which is the lowest tier for very large balances, not the rate for this account size.
- Page: "Margin Rates" (Interactive Brokers), plan comparison table
- URL: https://www.interactivebrokers.com/en/trading/margin-rates.php
- Accessed: 2026-10-09. Strength: A. Price: gated and unverified (spread over benchmark published; benchmark value not seen).
- Quote, verbatim (curl): "Interest Charged for Margin Loan Benchmark plus 2.5% Begins at Benchmark plus 1.5%, with lower rates for higher loan values." (first value is the Lite column, second the Pro column) and "Minimum Balance USD 0 USD 0"

NV (IBKR, still open): which regime a NEW margin account under 25,000 dollars opened today is put on (the FAQ linked from the guide page, https://www.interactivebrokers.com/lib/cstools/faq/#/articles/1460026643, is a JavaScript page); session length for the Client Portal Gateway; the percentage margin rate; intraday leverage multiple stated by IBKR for stock (the stock margin page text did not contain it); any customer-set leverage cap; Lite eligibility for the AI connector (BR-57). IBKR Pro commission stays as BR-32 (corroborated, 0.005 dollars per share fixed).

#### E*TRADE from Morgan Stanley

**MB-46.** E*TRADE applies the NEW standard. It implemented the changes on June 9, 2026. Day trades are no longer counted; the minimum is 2,000 dollars like any margin account; accounts under 25,000 dollars that were restricted are released.
- Page: "Pattern day trading rule change" (E*TRADE knowledge library)
- URL: https://us.etrade.com/knowledge/library/margin/pattern-day-trading-rule-change
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "E*TRADE implemented these changes on June 9, 2026, shortly after the new rules took effect."
- Also, verbatim: "You can trade in and out of positions intraday without triggering the PDT designation or account restrictions based solely on trading frequency." and (summary table) "Minimum equity for PDT $25,000 $2,000; same as any margin account"

**MB-47.** E*TRADE on deficits: an intraday margin deficit can be met by deposit of funds or securities, market appreciation, or liquidation of overnight positions, and deposited funds must stay overnight.
- Page and URL: as MB-46.
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl, table cells run together): "Deposit of funds Deposit of securities Market appreciation Liquidation of overnight positions" and "Funds must be held in the account overnight"

**MB-48.** E*TRADE margin interest: 12.70 percent on a debit balance under 10,000 dollars and 12.45 percent from 10,000 to 24,999.99 dollars (base rate 10.20 percent effective 09/21/2026). Price label: published.
- Page: "Pricing and Rates" (E*TRADE)
- URL: https://us.etrade.com/what-we-offer/pricing-and-rates
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl; the dash after the date is in the source and is replaced here by the word "is"): "Margin rates Base rate effective as of 09/21/2026 [is] 10.20%" and "Less than $10,000 12.70% (2.50% above base rate) $10,000 to $24,999.99 12.45% (2.25% above base rate)"

**MB-49.** E*TRADE commission: 0 dollars for online U.S. listed stock and ETF trades. Price label: published. (Closes run 1's E*TRADE commission gap.) E*TRADE remains ruled out for unattended running by BR-48 (reused): the access token dies at midnight Eastern every day.
- Page and URL: as MB-48.
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl): "charges $0 commissions for online US-listed stock, ETF, mutual fund, and options trades. Exclusions may apply and E*TRADE reserves the right to charge variable commission rates."

NV (E*TRADE, still open): developer.etrade.com still returns 403 to curl and to the fetch tool, so the individual key process, rate limits and any terms on automation remain unread. Margin account support through the API rests on BR-49 (account types CASH, MARGIN, PDT_ACCOUNT in the balance schema).

#### TradeStation (reopened: BR-46, BR-47)

**MB-50.** TradeStation's official MCP page, read today, says the connector is available to TradeStation clients who use Claude or ChatGPT, that access is requested in the client "HUB", and that it REQUIRES EXPLICIT CONFIRMATION BEFORE ORDERS ARE PLACED. That last point is now vendor-confirmed (run 1 had it from a search summary only). It means the TradeStation MCP connector is not a hands-off route. The page text read today does NOT contain a 10,000 dollar figure.
- Page: "TradeStation MCP" (TradeStation)
- URL: https://www.tradestation.com/platforms-and-tools/mcp/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "TradeStation MCP requires explicit confirmations before orders are placed, and all actions remain subject to your existing trading permissions and risk controls, but you are ultimately responsible for all decisions and trades in your account."
- Also, verbatim: "Available today to TradeStation clients** who use Claude or ChatGPT, with support for additional AI platforms in development." and "You can request MCP access in HUB on the Platforms page." and "This is obtained directly from your AI provider (it is not billed by TradeStation)."
- On the 10,000 dollar minimum (BR-46 unverified detail): the two asterisks after "clients" point to a footnote. The text curl returned for the page has no footnote carrying a dollar amount and no occurrence of "10,000". Either the footnote is drawn by JavaScript or the figure lives elsewhere. Still not resolved; see Not verified.

**MB-51.** TradeStation commission for stocks and ETFs: 0 dollars per share commission, BUT a per-share clearing fee by monthly volume tier. Reading the columns in the order printed, the lowest tier (0 to 100,000 shares a month) pays 0.003 dollars per share clearing and 0.0048 dollars per share if the order is directed to a chosen venue. There is also a 10 dollar a month inactivity fee unless the account meets a minimum activity level. Price label: published. The column-to-tier mapping is my reading of a flattened table and should be checked in a browser.
- Page: "Pricing" (TradeStation)
- URL: https://www.tradestation.com/pricing/
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl, table flattened): "Stocks and ETFs Commissions (per share) $0 Other trading fees Monthly volume of shares traded >10,000,000 1,000,001 [to] 10,000,000 100,001 [to] 1,000,000 0 [to] 100,000" (each "[to]" stands for a short dash in the source, replaced because this project uses no dashes of that kind) "Clearing fee (per share) $0 $0.001 $0.002 $0.003"
- Also, verbatim: "Inactivity fee $10 per month (FREE if account meets minimum activity)"
- Supersedes BR-47 ("0 dollars stocks", one review, unverified). An agent trading 1,000 shares in and 1,000 out would pay about 6 dollars in clearing fees under this reading.

**MB-52.** TradeStation margin: 12.00 percent a year on balances under 50,000 dollars. Long stock or ETF requirement: 25 percent of position value intraday, 50 percent overnight (that is 4 times and 2 times). Price label: published. The table's footnotes (which may carry an equity condition for the intraday figure) did not come through curl.
- Page: "Margin Rates" (TradeStation)
- URL: https://www.tradestation.com/pricing/margin-rates/
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl, table flattened): "Margin Interest Rates 1 $2,000,000+ 2 $500,000+ 2 $50,000 [to] $499,999 Less than $50,000 4.50% 6.50% 11.00% 12.00%" ("[to]" stands for a short dash in the source) and "Long Stock Buy Stock or ETF 25% Value of the Position 50% Value of the Position 100% Cost of the Position"

**MB-53.** TradeStation applies the NEW standard. Its home page says the framework is live for its traders, and its day trading requirements page gives the multiples: up to 4 times margin excess intraday for accounts with 2,000 dollars or more of margin equity, 1 times below that. No date of switch is given on the pages read.
- Page: TradeStation home page, "What's new at TradeStation"; and "Day Trading Requirements" (TradeStation Learn)
- URL: https://www.tradestation.com/ and https://www.tradestation.com/learn/market-basics/stocks-etfs/day-trading-rules/day-trading-requirements/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl), home page: "Intraday margin framework live on TradeStation The old Pattern Day Trader rules are gone. The new intraday margin framework is now in place for our traders."
- Quote, verbatim (curl), requirements page: "Accounts with Margin Equity at or above $2,000 may access up to 4× their Margin Excess for intraday trading. If Margin Equity falls below $2,000, buying power is limited to 1× Margin Excess until equity is restored."
- Also, verbatim: "Intraday Margin Buying Power is intended for same-day use only. Positions held past market close are subject to a separate Overnight Buying Power calculation. Holding positions overnight using full intraday leverage may result in a margin call."

**MB-54.** TradeStation's MCP connector now has NO account minimum, per TradeStation's home page today. This resolves run 1's open question (BR-46, contradiction 5): the January 2026 press release said "subject to applicable account minimums and approvals", and a 10,000 dollar figure was reported then, but the current vendor statement is no minimum. The explicit confirmation before each order (MB-50) remains.
- Page: TradeStation home page, "What's new at TradeStation"
- URL: https://www.tradestation.com/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "MCP now available without account minimum Revolutionize your trading workflow with TradeStation MCP, now available for Claude and ChatGPT users. No account minimum required."
- The original press release, now readable by curl (https://www.tradestation.com/press-and-news/tradestation-securities-releases-mcp-connection-allowing-users-to-connect-trading-accounts-with-third-party-ai-platforms/), verbatim: "TradeStation's MCP connection is now available to customers, subject to applicable account minimums and approvals." It contains no dollar figure. A search summary today still attributes a 10,000 dollar minimum to an older copy of the MCP page; that page as served today does not show it.
- Scope: this is about the MCP connector. The ordinary TradeStation API (BR-42 to BR-45, reused) is a separate route with non-expiring refresh tokens and no per-order confirmation stated; whether an API key itself needs a minimum balance was not found today (BR-47 says "funded account", strength C).

NV (TradeStation, still open): footnotes to the margin table; whether an individual's API key has any balance minimum; whether the API reports margin call state (the specification page still needs JavaScript); any customer-set leverage cap (none seen); how margin calls and forced selling are handled (only "may result in a margin call" was found).

#### Robinhood, including the Agentic account (reopened: BR-65, BR-66, BR-67)

**MB-55.** The Robinhood Agentic account is either a "limited margin" account (the default at account opening) or a cash account. Limited margin lets the agent trade with unsettled sale proceeds. It gives NO borrowing and NO leverage: margin borrowing is not currently available in Agentic accounts. So at Robinhood the owner's "borrow a little, more later" plan cannot be carried out in the agent's account today, but the settlement problem of a cash account is solved without any borrowing risk. (Resolves run 1's Not verified item 11 on account type and settlement.)
- Page: "Setting up an agent" (Robinhood support)
- URL: https://robinhood.com/us/en/support/articles/setting-up-an-agent/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "Limited margin allows you to trade with unsettled funds from stock and option sales. It doesn't provide borrowing power or leverage, and margin borrowing isn't currently available in Agentic accounts."
- Also, verbatim: "The optional margin account agreement is selected by default during account opening. If you accept it, your Agentic account opens as a limited margin account . To open a cash account instead, deselect the optional margin agreement before completing account opening."
- Also, verbatim: "Keep in mind that the margin investing features described there aren't available in an Agentic limited margin account."
- Search summary only, not seen on a fetched page: that limited margin "does not create a margin loan, incur margin interest, or expose you to margin calls or forced liquidation at this time", and that an Agentic cash account must wait one business day for sale proceeds. Consistent with the quotes above but not cited as findings.
- Scope note: this article is about Robinhood's built-in agent. The external-agent (MCP) article says the agent trades in "your Robinhood Agentic account" (BR-66), and the external-agent tool list includes "get_limited_margin_upgrade_info", so the same account types appear to apply to an external agent such as Claude. That last step is an inference.

**MB-56.** Robinhood trade approvals, restated from the vendor page today: with approvals off the agent places eligible trades with no manual confirmation; "certain trades may still require approval, depending on the trade and the model you're using". The page does not list which trades. Unresolved: what the exception covers.
- Page: "Setting up an agent" and "Trading with your agent" (Robinhood support)
- URL: https://robinhood.com/us/en/support/articles/setting-up-an-agent/ and https://www.robinhood.com/us/en/support/articles/trading-with-your-agent/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "If you turn trade approvals off, your agent can place eligible trades without your manual confirmation of each order. Certain trades may still require approval, depending on the trade and the model you're using."
- Also, verbatim (footer disclosure): "You can pause your agent's automations or disconnect it at any time."

**MB-57.** Robinhood external agent connection: the MCP address is unchanged (agent.robinhood.com/mcp/trading); listed AI clients are Claude Code, Claude Desktop, ChatGPT and Codex (others may be listed further down the page); sign-in is an "authenticate" step in the AI client. The article does NOT say how long the authorization lasts before a human must reconnect, and gives no rate limit and no fee for the connection. A "Token usage billing" article exists in the same help section (it concerns the built-in agent's model costs, by its title; not opened).
- Page: "Onboarding an external agent" (Robinhood support)
- URL: https://www.robinhood.com/us/en/support/articles/agentic-trading-overview/
- Accessed: 2026-10-09 (reopened BR-66). Strength: A.
- Quote, verbatim (curl): "claude mcp add robinhood-trading --transport http https:// agent.robinhood.com/mcp/trading Enter /mcp in Claude Code Select robinhood-trading and authenticate"
- Also, verbatim: "If you are experiencing issues with your MCP connection, disconnect and reconnect the Robinhood Trading MCP on your AI platform."

**MB-58.** Robinhood's main (non-agent) margin accounts moved to the new standard on June 4, 2026 per press (MB-40, strength B). No Robinhood-owned page stating this was opened today. It matters little here because the agent cannot use the main account (BR-66) and the Agentic account has no borrowing (MB-55).

NV (Robinhood, still open): authorization lifetime for an external agent; which trades still need approval; commission and regulatory fees in the Agentic account (the page points to "the fee schedule", not opened); rate limits; whether an Agentic limited margin account has any day trade restriction of its own (none is described on the pages read, and without borrowing there is no intraday margin level to breach, but Robinhood does not say so).

#### Public.com

**MB-59.** Public applies the NEW standard to all its margin accounts as of June 4, 2026: no pattern day trader label, no 25,000 dollar minimum, no limit on the number of day trades. 2,000 dollars is needed to use margin buying power.
- Page: "What changed with day trading rules?" (Public help center, dated June 4, 2026) and "Do I need a minimum balance to day trade?" (dated June 4, 2026)
- URL: https://help.public.com/en/articles/15378349-what-changed-with-day-trading-rules and https://help.public.com/en/articles/15378384-do-i-need-a-minimum-balance-to-day-trade
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "There are no limits on how many day trades you can make in a given period. These changes apply to all margin accounts at Public. Cash accounts are not subject to margin rules."
- Also, verbatim: "You no longer need to maintain $25,000 to day trade. However, to use margin buying power on Public, you must maintain a minimum of $2,000 in your margin account."
- Stale pages on the same site still describe the old rule: "What's the minimum amount required for Margin Investing?" (dated November 18, 2024): "If you're flagged as a pattern day trader, you must maintain $25,000 in marginable assets", and "What are the types of Margin Calls?" (dated June 27, 2025) still describes day trade calls. The June 4, 2026 pages are later and govern. See Contradictions.

**MB-60.** Public on a deficit: resolve it "as promptly as possible" by depositing cash or marginable securities or closing positions; otherwise the account "may become subject to trading restrictions". No deadline in days, no buying power multiple and no forced-selling wording is given on the pages read.
- Page: "What happens if I have an intraday margin deficit?" (Public help center, dated June 4, 2026)
- URL: https://help.public.com/en/articles/15378458-what-happens-if-i-have-an-intraday-margin-deficit
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "you'll need to resolve it as promptly as possible by depositing cash, depositing marginable securities, or closing positions to bring your account back in line. If it isn't resolved in time, your account may become subject to trading restrictions."

**MB-61.** Public margin interest: 5.15 percent a year on a margin balance up to 50,000 dollars. The same page heads its comparison "introductory margin rates", so whether 5.15 percent is a standing or an introductory rate should be checked on the fee schedule. Price label: published.
- Page: "Margin Rates on Public.com"
- URL: https://public.com/margin
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl): "Base rate 5.15% Lowest rate 4.20%" and "Margin Balance Interest Rate Up to $50,000 5.15% $50,001 - $100,000 5.00%"

**MB-62.** Public's API works with margin accounts, reads balances and buying power, and Public says a margin account avoids cash account violations by letting the customer trade on unsettled funds. Public does not offer short selling. (Answers run 1's NV on account types for Public.)
- Page: "Public Trading API" and "Does Public offer margin?" (Public help center, dated January 21, 2025)
- URL: https://public.com/api and https://help.public.com/en/articles/5128731-does-public-offer-margin
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl), API page: "Trade through cash, margin, IRA, or business accounts." and "Access real-time account balances and buying power"
- Quote, verbatim (curl), help page: "Ability to trade using unsettled funds from trades and avoid 'Cash Account' violations like Good Faith Violations." and "Public Investing does not offer the ability to short securities at this time."
- Also on the API page, verbatim: "Use the Public MCP to connect AI agents to real trading infrastructure." No per-order human confirmation is mentioned on the API page. BR-58 to BR-60 (reused) cover the personal-use terms and the right to suspend without notice.

NV (Public, still open): intraday and overnight multiples; whether the customer can cap or switch off leverage (a customer could simply hold a cash account, or a margin account and never borrow, but no cap setting was found); whether the API exposes maintenance requirement or margin call state; token lifetime and rate limits (the documentation pages still do not render endpoint detail without JavaScript); whether the hosted MCP server needs a human confirmation per order.

#### Tradier (reopened: BR-36)

**MB-63.** Tradier: regime NOT CONFIRMED, and its help center still describes the OLD rule. Tradier's blog post of June 5, 2026 announces that the pattern day trader rule "has officially been replaced" but speaks about the industry ("The industry is moving toward a real-time intraday margin framework") and never says Tradier itself has switched or when. Tradier's support article on funds available to trade still defines pattern day trading accounts and the 25,000 dollar minimum in the present tense. Until Tradier says otherwise, a margin account under 25,000 dollars at Tradier should be assumed to be still under the old count.
- Page: "The Pattern Day Trader (PDT) Rule Is Gone: What Active Traders Need to Know" (Tradier blog, Tradier Inc., Jun 5, 2026); and "Funds Available to Trade With" (Tradier support knowledge base, no date shown)
- URL: https://blog.tradier.com/blog/the-pattern-day-trader-pdt-rule-is-gone-what-active-traders-need-to-know and https://support.tradier.com/kb/guide/en/funds-available-to-trade-with-YYcVFd8oSx/Steps/5170359
- Accessed: 2026-10-09. Strength: A (both are Tradier's own pages).
- Quote, verbatim (curl), blog: "The industry is moving toward a real-time intraday margin framework that focuses on actual risk exposure rather than simply counting trades."
- Quote, verbatim (curl), support article: "Once flagged as PDT, the account must maintain a minimum equity of $25,000." and "A Pattern Day Trading (PDT) account is any margin account in which 3 or more day trades are executed within a rolling 5-business-day period and those trades represent more than 6% of total trading activity for that period."
- Also in the support article, verbatim: "When your account value is above $25,000 and not in a margin call, your start-of-day DTBP will be 4x your option buying power." The general trading FAQ index still lists "What happens if I am flagged as a Pattern Day Trader?"
- Two readings are possible: Tradier has switched and not updated its help center, or Tradier is using the phase-in. Neither page settles it. A direct question to Tradier support would.

**MB-64.** Tradier margin interest: 9.75 percent a year, one flat figure on the pricing page (no tiers shown). A forced sale handled by a Tradier broker costs 10 dollars plus the regular commission. Price label: published.
- Page: "Pricing & Plans | Tradier", fee table
- URL: https://tradier.com/individuals/pricing
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl): "Margin Interest* 9.75%" and "Broker-assisted trades (includes margin/position sellouts and short forced buy-ins) $10 + Regular Commission"
- The asterisk's own footnote was not isolated in the text. Commissions and plan prices stay as BR-38 (reused).

**MB-65.** Tradier personal API token: the documentation still does not say whether it expires. It says an individual's own applications need no OAuth and use the API Token from API Settings. The only lifetimes on the page belong to OAuth (refresh tokens "Do not expire" but are for approved partners only). Run 1's open item stays open.
- Page: "OAuth Authentication" (Tradier docs, read as plain text)
- URL: https://docs.tradier.com/docs/authentication
- Accessed: 2026-10-09 (reopened BR-36). Strength: A.
- Quote, verbatim (curl): "OAuth is not necessary; all API calls can be made with your API Token (or Sandbox Token) found in your [API Settings](https://dash.tradier.com/settings/api)."
- What would settle it: the API Settings screen inside a Tradier account, or a question to Tradier support.

NV (Tradier, still open): regime (above); margin multiples under a new-standard regime; margin minimum beyond the regulatory 2,000 dollars; any leverage cap setting (none found); margin call handling text. The balance endpoint has a margin object (BR-35 notes account_type "margin"); its field list was not reopened.

#### tastytrade

**MB-66.** tastytrade says it was ready to apply the new standard on day one, June 4, 2026. Its page uses mixed tenses (it was first published before the effective date and updated June 11, 2026), and NerdWallet (MB-40) lists tastytrade among brokers that changed on June 4. Treated as NEW standard, with moderate rather than full confidence.
- Page: "Pattern Day Trading" (tastytrade Learn, Chris Grace, published Apr 17, 2026, updated Jun 11, 2026)
- URL: https://tastytrade.com/learn/markets/industry/pattern-day-trading/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "tastytrade was ready for day-1 implementation of the new rule on June 4th, 2026, giving traders & investors flexibility to trade how they want, when they want."
- Also, verbatim: "Cash accounts at tastytrade are not affected by this change. Cash accounts were never subject to pattern day trading rules and remain subject to T+1 settlement and good faith violation rules when trading with unsettled funds."

**MB-67.** tastytrade commission: 0 dollars to open and 0 dollars to close for stocks and ETFs. Price label: published. (Closes run 1's tastytrade commission gap.)
- Page: "Pricing" (tastytrade)
- URL: https://tastytrade.com/pricing/
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl, table flattened): "Product Opening Commission Closing Commission Stock & ETFs $0 $0 Fractional Shares $0 $0"

**MB-68.** tastytrade's API reports margin state in more detail than any other broker read today: a margin requirements endpoint (margin requirement, maintenance requirement, margin equity, maintenance excess, buying power, separate Regulation T values) and a trading status endpoint with flags for margin call, closing-only and frozen. The API still carries the fields "is-pattern-day-trader" and "day-trade-count", described as "Whether PDT rules apply to the account", which is a sign that the old machinery still exists in the system even if it is switched off.
- Page: "Margin and risk" (tastytrade Developer Docs) and the trading status reference
- URL: https://developer.tastytrade.com/docs/concepts/margin-and-risk/ and https://developer.tastytrade.com/reference/account-status/getAccountsAccountNumberTradingStatus/
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "margin-requirement , maintenance-requirement , margin-equity , maintenance-excess , and buying-power figures (including separate reg-t-* values)"
- Also, verbatim: "is-pattern-day-trader Whether PDT rules apply to the account. day-trade-count Live count of day trades used, updated throughout the day. is-in-margin-call / is-in-day-trade-equity-maintenance-call Outstanding margin or day-trade maintenance calls."
- Also, verbatim (reference page): "if `is-closing-only` (or `is-cryptocurrency-closing-only` / `is-futures-closing-only`) is true, only closing trades are allowed"
- This also shows the API serves margin accounts (the example account's "equities-margin-calculation-type" is "Reg T"). BR-61 to BR-64 (reused) cover sign-in (refresh tokens do not expire) and the self-hosted connector with its dry-run confirmation token.

NV (tastytrade, still open): margin interest rate (https://tastytrade.com/margin-rates/ returned almost no text to curl and a guessed address returned 404); intraday and overnight multiples stated by tastytrade; margin minimum beyond 2,000 dollars; a customer-set leverage cap (none found); the API terms text on automated trading.

#### Webull (reopened: BR-52 to BR-56)

**MB-69.** Webull describes the new standard as in force from June 4, 2026 on its own page ("Old PDT Rule (Ending June 3rd, 2026)" against "New intraday trading margin regulations (Effective June 4th, 2026)"), with accounts "not restricted by number of day trades" and a new call type, the Intraday Margin Deficit call. NerdWallet (MB-40) lists Webull among brokers that changed on June 4. Treated as NEW standard. A Webull help article is stale and still says Webull will announce when it implements.
- Page: "Day Trade Without the $25K Minimum" (Webull)
- URL: https://www.webull.com/pdt-info
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl, table flattened): "Day Trading Limits Accounts valued at less than $25,000 are limited to three day trades every five business days. Accounts are not restricted by number of day trades." (old column, then new column)
- Also, verbatim: "Intraday appreciation can be used and is immediately added to Intraday Buying Power." and "Intraday Margin Deficit (IMD) Calls."
- Stale page: "Day Trading Rules" (Webull help, https://www.webull.com/help/faq/10954-Day-Trading-Rules), verbatim: "We will share more information on when we will implement the new rules as the effective date approaches." See Contradictions.

**MB-70.** Webull margin: up to 4 times for day trade buying power and 2 times overnight, with at least 2,000 dollars of equity; keep 25 percent of account value as equity. Margin interest for a standard account reads as 8.74 percent at every balance tier, and 5.20 percent on balances under 25,000 dollars for "Webull Premium" (a paid subscription). The row-to-label mapping is my reading of a flattened comparison table and should be checked in a browser. Price label: published.
- Page: "Margin" (Webull)
- URL: https://www.webull.com/margin
- Accessed: 2026-10-09. Strength: A. Price: published (mapping to be confirmed).
- Quote, verbatim (curl): "Webull margin accounts provide up to 4x leverage for day-trade buying power and 2x leverage for overnight buying power. You must have at least $2,000 in equity to qualify."
- Also, verbatim (table flattened): "5.20% 5.00% 4.45% 4.40% 4.20% 4.15% 3.90% Webull Premium Margin Balance $0 - $24,999.99 $25,000 - $99,999.99" and "8.74% 8.74% 8.74% 8.74% 8.74% 8.74% 8.74% Webull Standard"

**MB-71.** Webull commission: 0 dollars on U.S. listed stocks and ETFs in individual cash or margin accounts, no deposit minimum. The disclosure names mobile, desktop and website products; the API FAQ (BR-52, reused) says API trading fees are the same as in the app. Price label: published. (Closes run 1's Webull commission gap.)
- Page: "Pricing" (Webull)
- URL: https://www.webull.com/pricing
- Accessed: 2026-10-09. Strength: A. Price: published.
- Quote, verbatim (curl): "Free trading of stocks, ETFs, and options refers to $0 commissions for Webull Financial LLC self-directed individual cash or margin brokerage accounts and IRAs that trade U.S. listed securities via mobile devices, desktop or website products."

**MB-72.** Webull OpenAPI, direct route (not the MCP connector): the "Place Order" endpoint "Places a new order for the given account", and Webull's own API FAQ names automated trading strategies as a use. Nothing on the order placement reference or the FAQ mentions an in-app confirmation for API orders. The in-app confirmation found in run 1 (BR-56) belongs to the Cloud MCP connector. So the direct API appears to be a hands-off route. "Appears" because the absence of a confirmation step is read from two pages, not stated in a sentence.
- Page: "Place Order" API reference and "FAQ" (Webull API docs, read as plain text)
- URL: https://developer.webull.com/apis/docs/reference/common-order-place and https://developer.webull.com/apis/docs/faq
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "Places a new order for the given account." and (FAQ, "What can I build with the Webull OpenAPI?") "Automated trading strategies (e.g., algorithmic or quantitative trading)"
- Also on the order page: linked order types OTO, OCO and OTOCO are "only supported for stock (EQUITY) orders".

**MB-73.** Webull's balance endpoint reports margin state, including open margin calls by type. Fields seen: maintenance_margin (labelled "Margin Account"), init_margin, intraday_margin, margin_excess, used_margin, margin_ratio, and open_margin_calls with the codes EM, RM, RT and DT. This also confirms the API serves margin accounts. (Closes run 1's "schema did not render" item for this page.)
- Page: "Account Balance" API reference (Webull API docs, read as plain text)
- URL: https://developer.webull.com/apis/docs/reference/account-balance
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): ""open_margin_calls": { "type": "string", "description": "Open Margin Calls", "example": "['EM']", "enum": [ "EM", "RM", "RT", "DT" ] }"
- Also, verbatim: ""intraday_margin": { "type": "string", "description": "Intraday margin requirement for current positions; typically lower than overnight initial margin""
- The codes are not expanded on the page. From Webull's own rule page (MB-69), EM is an equity maintenance call and DT a day trade call. No code for the new intraday margin deficit call appears in the list, which suggests the API reference predates June 2026.

NV (Webull, still open): market data subscription price for the API (BR-55 stands); a customer-set leverage cap (none found); margin call and forced-selling wording beyond "Potential margin calls or liquidation of securities"; cash account support through the API (the pricing disclosure and the balance field "Margin Account" label imply both types exist, but no sentence says the API serves cash accounts).

#### Fidelity (context only)

NV (Fidelity): the page https://www.fidelity.com/learning-center/trading-investing/trading/intraday-margin returned HTTP 200 to curl but its text held no statement of when Fidelity switched (no match for "no longer", "June", "$2,000" or a multiple; the body appears to be drawn by JavaScript). A search summary, not a fetched page, says a Fidelity article of June 5, 2026 states there is no 25,000 dollar minimum to trade intraday on margin. Not cited as a finding. Fidelity still has no retail trading API in the evidence (BR-68, reused), so its regime does not affect the stack choice.

### Q6. Regulators on retail AI agents

**MB-74.** The SEC has made no rule and issued no guidance specific to a retail customer's own AI agent placing orders. The nearest SEC statement is the Chairman's speech of May 8, 2026, which has a section headed "AI & Agentic Finance". Its message: existing principles apply, firms stay responsible for the tools they deploy, and the SEC will not dictate models. It speaks about firms' tools, not about a customer's self-run agent.
- Page: "Remarks at the Special Competitive Studies Project AI+ Expo" (SEC Chairman Paul S. Atkins, May 8, 2026)
- URL: https://www.sec.gov/newsroom/speeches-statements/atkins-remarks-scsp-ai-expo-050826
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "firms remain responsible for the outcomes of the tools that they deploy and for informing investors of how those tools are used."
- Also, verbatim: "we will not dictate which models firms must use, nor will we cement today's technology as the standard for tomorrow." and "If tools are widely adopted across the industry, errors could propagate at an alarming speed."

**MB-75.** FINRA's published position on AI agents (January 27, 2026) is addressed to member firms' own use of agents. It names the risks (autonomy without human approval, acting beyond intended scope and authority, poor auditability) and says existing rules continue to apply. It does not address a customer connecting an agent to a brokerage account, and states no broker obligation specific to that case. FINRA's 2026 Annual Regulatory Oversight Report (December 2025) carries the same list per search results; its PDF was not opened.
- Page: "Emerging Trend in GenAI: Observations on AI Agents" (FINRA blog, Greg Ruppert, Executive Vice President and Chief Regulatory Operations Officer, January 27, 2026)
- URL: https://www.finra.org/media-center/blog/observations-on-ai-agents
- Accessed: 2026-10-09. Strength: A.
- Quote (as returned by the fetch tool): "AI agents acting autonomously without human validation and approval." and "Agents may act beyond the user's actual or intended scope and authority."
- Also (as returned by the fetch tool): rules "continue to apply when member firms use Generative AI or similar technologies in the course of their businesses."

**MB-76.** Congress has asked the SEC the exact question. On June 23, 2026 seven House Democrats led by Representatives Bill Foster and Brad Sherman wrote to the SEC Chairman about agentic trading at retail brokers, with 13 questions and a July 31 reply date. This is a request for information, not a regulator statement. No public SEC reply was found today.
- Page: "Is agentic trading safe? What the SEC inquiry means for investors" (Matt Miczulski for Finder, syndicated on WFTV, July 27, 2026)
- URL: https://www.wftv.com/news/is-agentic-trading/NV64RNJKZQ2MXN4LWQNOY6DS7I/
- Accessed: 2026-10-09. Strength: B (syndicated press; the letter itself is a PDF on foster.house.gov whose text could not be extracted, see Not verified).
- Quote, verbatim (curl): "Illinois Rep. Bill Foster and California Rep. Brad Sherman led the letter, and Reps. Stephen Lynch, Jim Himes, Sean Casten, Rashida Tlaib, and Sylvia Garcia cosigned it. Atkins has until July 31 to respond."
- Also, verbatim: "It also points back to the SEC's 2023 proposal on conflicts of interest in predictive data analytics, urging the agency to revisit that framework."
- The letter's own address (fetched, HTTP 200, 430 KB PDF, text not extractable): https://foster.house.gov/sites/evo-subsites/foster-evo.house.gov/files/evo-media-document/foster_sherman-request-for-information-re-agentic-trading-6.23.2026.pdf
- On the absence of an SEC reply: a search summary of a personal blog dated August 13, 2026 (strength D, not fetched) says no public response had been issued. Today's own searches of sec.gov surfaced none. Absence of evidence, not proof of absence.

**MB-77.** Same article, market context useful for Q5 (press, not vendor pages): Public began rolling out its own "Agents" on March 31, 2026 and they "require customer approval before going live"; SoFi launched "Composer" in late June 2026 after acquiring Composer Securities; Robinhood sends a push notification for every agent trade.
- Page and URL: as MB-76.
- Accessed: 2026-10-09. Strength: B.
- Quote, verbatim (curl): "Public began rolling out its own version, called Agents, on March 31. SoFi launched Composer in late June, right after acquiring Composer Securities."
- Also, verbatim: "Public's Agents require customer approval before going live and keep everything inside one authenticated environment." and "The company uses dedicated accounts, sends push notifications for every trade, and lets users disconnect agents at any time." (the company is Robinhood)

### Q5. Other U.S. brokers with an official API or AI-agent connector, and what Schwab and Fidelity launched in 2026

**MB-78.** Independent survey, dated this week: of 14 brokers one reviewer tests, seven run a first-party (official) MCP server, all launched in 2026: Interactive Brokers, Webull, tastytrade, Moomoo, Robinhood, Public and TradeStation. Schwab and E*TRADE have only community-built servers. Ally Invest and Fidelity (among four named) have no public API at all. (Alpaca and Tradier are outside the reviewer's 14 and are covered by BR-25 and BR-40.) This answers "did Schwab or Fidelity launch anything official in 2026": no, per this source.
- Page: "Best Brokers for Agentic Trading: AI Trading Agents Tested" (StockBrokers.com, Jessica Inskip, October 07, 2026; connector table "Last verified: September 16, 2026")
- URL: https://www.stockbrokers.com/guides/ai-agent-brokers
- Accessed: 2026-10-09. Strength: C (comparison site, though a first-hand test with named author).
- Quote, verbatim (curl): "I required a first-party integration, which ruled out Charles Schwab and E*TRADE, where the only MCP servers are community-built projects running on the brokers' official APIs."
- Also, verbatim: "Seven of the 14 brokers I test now run a first-party MCP server" and "Four of the brokers I review, Ally Invest, Fidelity," (list continues) "have no public API for an AI tool to reach at all"

**MB-79.** The same survey on which official connectors let an agent place an order with no human step: Webull, tastytrade, Moomoo, Robinhood and Public let the agent place the order itself; Interactive Brokers never does (the customer submits each instruction); TradeStation enforces confirmation on every order; Moomoo's approval is a toggle; Public's agents "run unattended once approved, with no cap you can impose"; Webull offers order caps, a symbol whitelist and a read-only mode.
- Page and URL: as MB-78.
- Accessed: 2026-10-09. Strength: C.
- Quote, verbatim (curl): "Webull, tastytrade, Moomoo, Robinhood, and Public all let the agent place the order itself."
- Also, verbatim: "Webull lets you set order caps, a symbol whitelist and a read-only mode." and "Public's agents run unattended once approved, with no cap you can impose. TradeStation enforces confirmation on every order but works only with Claude and ChatGPT"
- Also, verbatim: "tastytrade runs the most thorough automated checks of anyone here, while saying plainly in its own documentation that its confirmation token proves an order was not altered rather than that a person approved it." (This settles the reading left open in BR-64: the tastytrade token is not a human approval.)
- Tension with run 1: BR-56 (Webull's own docs, strength A) says a stock order created through the Cloud MCP "requires confirmation in Webull APP / Desktop". This survey says Webull lets the agent place the order itself. See Contradictions. The vendor page was not reopened today.

**MB-80.** NEW BROKER: moomoo (Moomoo Financial Inc. in the U.S.; parent Futu). It has an official API ("OpenAPI") that works through a gateway program called OpenD which the customer runs on a local computer or cloud server, and since 2026 an official hosted MCP server at mcp.moomoo.com/mcp with OAuth sign-in that lists Claude Desktop and Claude Code as supported clients and can execute trades.
- Page: "MCP Overview" (moomoo OpenAPI developers site) and "Introduction" (moomoo API documentation)
- URL: https://open.moomoo.com/mcp-docs/overview and https://openapi.moomoo.com/moomoo-api-doc/en/intro/intro.html
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl), MCP page: "Query real-time quotes, manage portfolios, and execute trades via natural language. Endpoint" (then the address) "https://mcp.moomoo.com/mcp" and "Authorize via the OAuth flow when prompted"
- Quote, verbatim (curl), API page: "OpenD is the gateway program of Moomoo API , running on your local computer or cloud server. It is responsible for transferring the protocol requests to moomoo servers, and returning the processed data."
- From the survey (MB-78, strength C), verbatim: "Defaults to paper trading and requires a trading password to go live" and "Agents can place live trades unattended if you choose to toggle approval off". Minimum deposit 0 dollars and stock trades 0 dollars per the same survey (price label: one independent source, not corroborated, vendor pricing page did not yield the figures to curl).
- Not checked for moomoo: which intraday margin regime it applies, margin rate, margin minimum, leverage cap, margin fields in the API, how long the OAuth authorization lasts, whether OpenD needs a periodic human sign-in. All Not verified.

**MB-81.** NEW BROKER: Lightspeed. It has an official API, "Lightspeed Connect", a WebSocket (a persistent two-way connection) API for U.S. equities and options with a paper trading environment, aimed at automated strategies. No official MCP server was found. Account minimums and per-share commissions were not on the page read; Lightspeed is known as a per-share, active-trader broker, and its minimums may exceed this account size (a guess until its pricing page is read).
- Page: "API Trading" (Lightspeed)
- URL: https://lightspeed.com/trading/api-trading
- Accessed: 2026-10-09. Strength: A.
- Quote, verbatim (curl): "API access to U.S. equity and options trading through a streamlined, event-driven WebSocket API. Build, test, and deploy customized trading applications and automated strategies"
- Also, verbatim: "Build and validate API integrations and trading workflows in a simulated environment before transitioning to Production."

**MB-82.** Others checked by search only (no vendor page opened, so these are pointers, not findings): Firstrade has only unofficial, reverse-engineered libraries (a community repository states "this is not an official api"); SoFi launched "Composer" in late June 2026 after acquiring Composer Securities (MB-77, press), which is a rules-based automation product, and no SoFi API or MCP server for a customer's own software was surfaced; no official API or connector surfaced for Vanguard, Merrill, J.P. Morgan Self-Directed, Ally Invest or Cobra; StoneX was not searched separately. TradeZero and "Connect Trade" (an aggregator that claims live trading access for AI agents across 20+ brokers, per a PR Newswire release) appeared in results and were not investigated. One search round only, so "none found" here is weak.
- Source of the pointers: web search results on 2026-10-09 (titles and summaries only). Strength: not rated, not evidence.

**MB-83.** Schwab official AI connector: none found. Two independent sources agree that Schwab's only MCP servers are community-built on the official Trader API (MB-78, strength C; and run 1's BR-15). No Schwab-owned page announcing a connector surfaced in today's searches.
- Page and URL: as MB-78.
- Accessed: 2026-10-09. Strength: C.
- Quote: as MB-78 ("ruled out Charles Schwab and E*TRADE, where the only MCP servers are community-built projects").

## 2. Summary tables

Built only from the findings above. "NV" means not verified in this run. MB numbers are today's findings (2026-10-09). BR numbers are run 1 findings (2026-10-08).

### (a) The new intraday margin standard, for a 10,000 to 25,000 dollar margin account that only buys

| Question | Answer | Findings |
| :-- | :-- | :-- |
| What replaced the pattern day trader rule | An "intraday margin" test in FINRA Rule 4210(d)(2), effective June 4, 2026. The broker checks, after each purchase, whether the account still has the ordinary maintenance margin | MB-01, MB-02, MB-03, BR-03, BR-04 |
| What is an intraday margin deficit | The worst shortfall against maintenance margin reached right after any purchase (or withdrawal) during the day, even if the account is fine by the close | MB-04 |
| How intraday exposure is limited | By the 25 percent maintenance requirement, tested during the day. My arithmetic: about 4 times equity in stock intraday at most (40,000 dollars on 10,000; 100,000 on 25,000). Brokers may set less, and volatile or leveraged products carry higher percentages | MB-12, MB-14 (derivation), MB-23, MB-34 |
| Overnight limit | Regulation T initial requirement of 50 percent, so about 2 times equity, then 25 percent maintenance | MB-13, MB-14 |
| Minimum equity | 2,000 dollars to borrow at all. The 25,000 dollar minimum is deleted | MB-11, BR-06 |
| Limit on the number of round trips | None in the rule. A broker can still impose one by house rule, or still apply the old count during the phase-in | MB-10, MB-19, BR-04 |
| What happens when a deficit is not met | Must be met "as promptly as possible" by deposit or by selling. Stays outstanding up to 15 business days. If the customer makes a practice of not meeting deficits and one is unmet after 5 business days: 90 days with no new borrowing. Brokers add stricter house versions | MB-05, MB-06, MB-07, MB-21, MB-38 |
| Small deficits | Not counted toward "a practice" if under the lesser of 5 percent of equity or 1,000 dollars | MB-06 |
| Can a broker simply block the order instead | Yes. Real-time blocking is allowed and then no deficit ever arises. Schwab says it does this | MB-08, MB-32 |
| Does selling free the money for reuse the same day | Yes in a margin account: the settlement freeze belongs to cash accounts. Stated outright by brokers, and it follows from the rule's definitions, but no FINRA sentence says it in so many words | MB-15, BR-09, BR-18, MB-39, MB-62 |
| Selling as a cure for a deficit | Slow: selling 2,500 dollars of stock raised the margin level by 625 dollars in FINRA's example | MB-17 |
| Cost of intraday borrowing | Interest is charged on the end-of-day balance at the brokers that say so. Borrowing repaid before the close cost nothing at Alpaca | MB-24 |
| Which brokers are on the new standard | Varies. See table (b). The rule lets a broker stay on the old one until October 20, 2027, account by account | MB-19, BR-04 |

### (b) Broker by broker

| Broker | Regime applied today | Margin minimum | Margin rate under 25,000 dollars borrowed | Intraday and overnight multiples stated | Leverage cap the customer can set | Stock and ETF commission | API or connector, and can software place an order with no human step | Sign-in cycle | Margin state in the API, and margin calls |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Alpaca | NEW standard (MB-20). Switch date not stated | 2,000 dollars of equity for margin; 1 times below that (BR-16, MB-22) | 6.50 percent, overnight balances only, published (MB-24) | Up to 4 times intraday, 2 times overnight; 2 is the default multiplier (MB-22). House maintenance 30 percent and up (MB-23) | YES: max_margin_multiplier 1, 2 or 4, plus long-only and suspend switches (MB-25, BR-17) | 0, published (BR-23) | API with keys; official connector places orders. No human step (BR-20, BR-25) | Keys; no expiry stated (BR-20) | buying power, initial and maintenance margin, blocked flags; no margin call field (MB-26). Call next morning, 2 business days for a deficit, may sell without notice (MB-21, MB-27). 600 percent position lockout (MB-28) |
| Interactive Brokers | MIXED, account by account: guide pages dated June 3, 2026 say an account "may still be subject to existing PDT rules"; press says changed June 4 (MB-37, MB-40) | 0 to open; 2,000 dollars for margin (MB-38, MB-45) | Pro: benchmark plus 1.5 percent; the number was not readable. Gated and unverified (MB-45) | NV | None found | Pro only for API: 0.005 dollars per share, corroborated (BR-32, MB-41) | Web API through a gateway program the customer runs; order prompts can be confirmed or suppressed by software (MB-41, MB-42). Desktop TWS API (BR-27). Official AI connector only drafts orders (BR-57) | Desktop API: human sign-in about weekly (BR-28). Web API session length NV (MB-43) | Portfolio summary endpoint (MB-44). No margin call: positions liquidated at once (MB-39). House rule: 4 unmet deficits in 12 months may mean 90 days restricted (MB-38) |
| Charles Schwab | NEW standard: stopped counting June 8, 2026; intraday buying power from July 13, 2026 (MB-30) | 2,000 dollars (MB-34) | 12.075 percent, published (MB-33) | Up to 4 times intraday, 2 times overnight; positions above overnight power out by 8 p.m. Eastern (MB-31) | None found | 0 online, published (MB-35) | Trader API for individuals per community docs (BR-11, strength D). No official connector (MB-83). Developer site unreadable, so per-order rules NV | Human sign-in every 7 days (BR-12, strength D) | API fields NV. Real-time blocking of orders that would create a deficit (MB-32). No extension on calls; may sell (MB-36) |
| Tradier | NOT CONFIRMED. Blog says the rule is replaced; help center still describes the old rule (MB-63) | 0 to open (BR-38); margin minimum NV | 9.75 percent flat, published (MB-64) | Old-rule wording only: 4 times above 25,000 dollars (MB-63) | None found | Lite 0.35 dollars per trade, or Pro 10 dollars a month with 0 per trade (BR-38) | API token; official hosted connector places orders. No human step stated (BR-34, BR-40) | Personal token; expiry still not stated (MB-65) | Balance endpoint has margin and cash types (BR-35); margin fields not reopened. Forced sale by a broker costs 10 dollars plus commission (MB-64) |
| TradeStation | NEW standard, "live" (MB-53). Switch date not stated | 2,000 dollars of margin equity for intraday leverage (MB-53) | 12.00 percent under 50,000 dollars, published (MB-52) | Up to 4 times margin excess intraday; 50 percent overnight (MB-52, MB-53) | None found | 0 commission plus a clearing fee, 0.003 dollars per share at the lowest volume tier; 10 dollars a month inactivity fee unless active (MB-51) | Ordinary API: yes, no per-order step stated (BR-42, BR-45). Official connector: explicit confirmation before every order, no account minimum now (MB-50, MB-54) | Refresh tokens valid indefinitely (BR-42) | API margin fields NV. "May result in a margin call" if intraday leverage is held overnight (MB-53) |
| tastytrade | NEW standard, "ready for day-1" June 4, 2026 (MB-66, MB-40) | NV | NV | NV | None found | 0 to open and close, published (MB-67) | Personal OAuth app; official self-hosted connector. Its confirmation token is not a human approval (BR-61, BR-64, MB-79) | Refresh tokens do not expire (BR-61) | Best seen: margin requirements endpoint, margin call flag, closing-only and frozen flags (MB-68) |
| Webull | NEW standard from June 4, 2026 (MB-69, MB-40). One stale help page | 2,000 dollars (MB-70) | 8.74 percent standard; 5.20 percent with paid Premium (MB-70, mapping to confirm) | Up to 4 times intraday, 2 times overnight (MB-70) | Not for leverage. The connector has order caps and a symbol whitelist (MB-79) | 0, published (MB-71) | Direct API: places orders, no confirmation mentioned (MB-72). Cloud connector: vendor docs say in-app confirmation (BR-56); survey says the agent places the order itself (MB-79). Conflict | Token invalid after 15 idle days (BR-53) | maintenance_margin, intraday_margin, open_margin_calls by type (MB-73) |
| Public | NEW standard on all margin accounts from June 4, 2026 (MB-59) | 2,000 dollars (MB-59) | 5.15 percent up to 50,000 dollars, published; possibly introductory (MB-61) | NV | None found; survey says "no cap you can impose" on its agents (MB-79) | 0, published (BR-58) | API key; margin accounts supported; official hosted connector; agents run unattended once approved (MB-62, MB-79, BR-59) | NV | Balances and buying power (MB-62); margin fields NV. Deficit: resolve promptly or face restrictions (MB-60) |
| Robinhood (Agentic account) | Not applicable in practice: the Agentic account has NO borrowing. Main accounts changed June 4 per press (MB-55, MB-58) | NV | Not applicable, no borrowing (MB-55) | 1 times; unsettled sale proceeds usable with "limited margin" (MB-55) | Built in: no leverage exists (MB-55) | NV | Official connector; with approvals off the agent places eligible trades with no confirmation; "certain trades may still require approval" (BR-67, MB-56) | Authorization lifetime NV (MB-57) | Not applicable: per the account description there is no margin loan |
| E*TRADE | NEW standard since June 9, 2026 (MB-46) | 2,000 dollars (MB-46) | 12.70 percent under 10,000; 12.45 percent from 10,000 to 24,999.99, published (MB-48) | Real-time intraday margin excess; multiple not stated (MB-46) | None found | 0 online, published (MB-49) | API yes (BR-49); no official connector (MB-78). Unattended running ruled out by the sign-in cycle | Human sign-in EVERY DAY (BR-48) | Balance fields per BR-49. Deficit cures listed (MB-47) |
| Fidelity (context) | Not found on a Fidelity page | n/a | n/a | n/a | n/a | n/a | No retail API (BR-68, MB-78) | n/a | n/a |
| moomoo (new in run 2) | NV | NV; 0 minimum deposit per one survey (MB-80) | NV | NV | NV | 0 per one survey (MB-80) | Official API through a gateway program; official hosted connector that can trade; approval is a toggle; defaults to paper trading (MB-80, MB-79) | NV | NV |
| Lightspeed (new in run 2) | NV | NV | NV | NV | NV | NV | Official WebSocket API with paper trading; no connector found (MB-81) | NV | NV |

Reading of table (b), in one paragraph (mine, not a quote): Alpaca is the only broker where all three things are positively documented: the new standard is applied, software can place orders with no human step, and the customer can set a leverage cap. Four more are on the new standard and have an official route on which NO PER-ORDER HUMAN STEP IS STATED, which is weaker than a statement that none exists: TradeStation (through its ordinary API, not its connector, which confirms every order), tastytrade, Public, and Webull's direct API (MB-72 says "appears"). Schwab is on the new standard but still needs a weekly human sign-in (strength D) and has no official connector. Interactive Brokers and Tradier cannot be assumed to allow free intraday trading under 25,000 dollars until each confirms it for the account. Robinhood's agent account avoids the question by having no borrowing at all.

## 3. Not verified

Each item lists what was tried. In rough order of how much it matters to the stack decision.

1. **Interactive Brokers: which regime a new margin account under 25,000 dollars gets today.** Read two IBKR guide pages and the account configuration page with curl (MB-37). The FAQ they link to is a JavaScript page. Press says IBKR changed June 4 (MB-40). Unresolved conflict.
2. **Tradier: whether it has moved to the new standard.** Read its June 5, 2026 blog post and its support article (MB-63). The blog does not say Tradier switched; the support article still describes the old rule. A direct question to Tradier would settle it.
3. **Schwab developer portal facts**: Schwab-owned statement of refresh token life, whether the Trader API serves margin accounts, the margin fields it returns, API terms on automation. Tried https://developer.schwab.com/products/trader-api--individual, the OAuth user guide and the site root with the fetch tool and with curl. curl gets HTTP 200 but an empty JavaScript shell.
4. **Interactive Brokers Web API session length for an individual**, and whether an individual can get OAuth access without running the gateway. Read the Trading Web API page (MB-41 to MB-43). The Client Portal API page returned an empty body to curl and to the site's content feed.
5. **Alpaca: whether a new account under 25,000 dollars gets the 4 times intraday multiplier by default** (the docs say 2 is the default and 4 is a class), and the date Alpaca switched. Read five Alpaca docs pages with curl (MB-20, MB-22).
6. **Robinhood external agent: how long the authorization lasts, which trades still need approval, fees, rate limits.** Read three support articles with curl (MB-55 to MB-57). Not stated.
7. **Webull Cloud connector: does a stock order need in-app confirmation or not.** Vendor docs in run 1 say yes (BR-56); the October 7, 2026 survey says the agent places the order itself (MB-79). The vendor page was not reopened today.
8. **Interactive Brokers margin rate as a percentage** and its intraday leverage multiple for stock. The rate table is drawn by a calculator (MB-45). The stock margin page text held no multiple.
9. **tastytrade margin interest rate, multiples and margin minimum.** Tried https://tastytrade.com/margin-rates/ (almost no text) and https://tastytrade.com/pricing/margin-rates/ (404).
10. **A customer-set leverage cap at any broker other than Alpaca.** None was found on any page read for Schwab, IBKR, Tradier, TradeStation, tastytrade, Webull, Public or E*TRADE. Not finding one is not proof none exists; only Alpaca documents one.
11. **Whether Alpaca's API key can be limited so the agent cannot raise its own leverage cap** (MB-25 caution). Not searched.
12. **TradeStation**: the footnotes of its margin table; whether an individual's API key needs a minimum balance; margin fields in the API; the column mapping of the clearing fee table (MB-51).
13. **Public**: multiples, margin fields in the API, token lifetime, rate limits, whether 5.15 percent is introductory, whether the hosted connector needs per-order confirmation. Help center and API landing page read; API reference still not rendering.
14. **Webull**: market data subscription price for the API (BR-55); the mapping of rows in its margin rate table (MB-70); cash account support through the API.
15. **moomoo and Lightspeed**: regime, margin rate, minimums, fees from vendor pages, sign-in cycle (MB-80, MB-81). Only the connector and API landing pages were read.
16. **Fidelity's own statement of when it switched.** The page returned no usable text to curl.
17. **Robinhood's own statement that its main margin accounts moved on June 4.** Press only (MB-40).
18. **Regulator statements**: the text of the June 23, 2026 congressional letter (the PDF's text could not be extracted with the built-in Python; its fonts are encoded); any SEC reply to it (none found in two searches); FINRA's 2026 Annual Regulatory Oversight Report PDF (not opened; the January 27, 2026 FINRA blog was read instead, MB-75).
19. **FINRA interpretation wording**: the interpretations page was read through the fetch tool only, so MB-07, MB-08 (second quote), MB-16 (second quote) and MB-17 carry fragments, not confirmed verbatim sentences.
20. **Each broker's API terms on automated or AI-agent order placement.** Only Public's terms (BR-60, run 1) and the Webull FAQ line (MB-72) are on record. No terms page was found or read for Alpaca, Tradier, TradeStation, tastytrade, IBKR, Schwab or E*TRADE.
21. **E*TRADE developer site** (individual key process, rate limits): still HTTP 403.
22. **Other brokers** (Firstrade, SoFi, Vanguard, Merrill, J.P. Morgan, Ally, Cobra, StoneX): one search round, no vendor pages opened (MB-82).

## 4. Needs browser

In priority order. Each could not be read by the fetch tool or by curl today. (Most of run 1's list no longer needs a browser: see MB-29.)

1. https://www.interactivebrokers.com/lib/cstools/faq/#/articles/1460026643 . IBKR's FAQ on the pattern day trading changes. Needed to settle whether a new margin account under 25,000 dollars is on the new standard (Not verified 1).
2. https://developer.schwab.com/products/trader-api--individual and https://developer.schwab.com/user-guides/get-started/authenticate-with-oauth . Schwab's own statement of token life, margin account support, margin fields, order rules (Not verified 3).
3. https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/ . Client Portal Gateway session length and daily sign-in rules (Not verified 4).
4. https://www.interactivebrokers.com/en/trading/margin-rates.php . The rate table for a balance under 25,000 dollars (the page loads by curl but the numbers are drawn by a calculator).
5. https://developer.webull.com/apis/docs/AI-friendly-Resources/mcp/ . Re-read whether the Cloud connector still requires in-app confirmation (not attempted today; listed because of the conflict in Not verified 7. It may be readable by curl).
6. https://tastytrade.com/margin-rates/ . tastytrade's margin interest table.
7. https://www.tradestation.com/pricing/ and https://www.tradestation.com/pricing/margin-rates/ . To confirm the clearing fee column mapping and read the margin table footnotes (both load by curl, but tables flatten and footnotes are missing).
8. https://www.webull.com/margin . To confirm which rate row belongs to the standard account.
9. https://public.com/api/docs . Endpoint detail: margin fields, token lifetime, rate limits.
10. https://www.fidelity.com/learning-center/trading-investing/trading/intraday-margin . Fidelity's switch statement (context only).
11. https://developer.etrade.com/getting-started . Still HTTP 403 (low priority: E*TRADE is ruled out by its daily sign-in, BR-48).
12. https://foster.house.gov/sites/evo-subsites/foster-evo.house.gov/files/evo-media-document/foster_sherman-request-for-information-re-agentic-trading-6.23.2026.pdf . The congressional letter's 13 questions, to quote directly.
13. https://www.finra.org/rules-guidance/guidance/interps-4210-202606 . To copy the intraday margin interpretations word for word (the fetch tool returned fragments).
14. A signed-in screen, not a public page: the Tradier API Settings screen (does the token show an expiry) and the Robinhood agent settings screen (authorization lifetime). These need the owner's accounts and are noted only so they are not forgotten.

## 5. Contradictions between sources

1. **Interactive Brokers regime.** IBKR's own guide pages (last updated June 3, 2026) say "Your account may still be subject to existing PDT rules during FINRA's transition period", and its account page says accounts still under the old rules need 25,000 dollars to day trade (MB-37). NerdWallet (last updated June 4, 2026) says Interactive Brokers "changed their rules on June 4" (MB-40). Both can be true if IBKR moved most accounts and kept some on the old rule, which the FINRA phase-in allows "by account" (MB-19). Unresolved for a new small account.
2. **Tradier regime.** Tradier's blog (June 5, 2026) says the rule "has officially been replaced"; Tradier's support article still says "Once flagged as PDT, the account must maintain a minimum equity of $25,000" (MB-63). The support article carries no date. Unresolved.
3. **Alpaca's own pages disagree on the multiplier.** The margin page (updated September 17, 2026) says an account with 2,000 dollars or more "can further be allowed to use up to 4x intraday buying power" (MB-22). The Trading Account page (updated July 7, 2026) says 2 is "the default for all accounts with $2,000 or more equity". The older "Get Account" API reference (updated May 27, 2026) still describes multiplier 4 as a "PDT account with 4x intraday buying power" and 2 as the default for "non-PDT accounts", which is pre-change wording. The intraday margin rule pages govern on the regime (MB-20); the default multiplier for a new small account is open (Not verified 5).
4. **Alpaca's deficit wording against the FINRA rule.** The rule freezes an account only if the customer "makes a practice" of not meeting deficits AND one is unmet after five business days (MB-06). Alpaca's page says an unmet deficit at the close of the fifth business day means the 90 day freeze, with no "practice" condition, and sets a two business day deadline (MB-21). Brokers may be stricter than the rule; treat Alpaca's wording as the operative one at Alpaca.
5. **Webull: stale help page against its rule page.** The help article "Day Trading Rules" still says "We will share more information on when we will implement the new rules", while the "Day Trade Without the $25K Minimum" page presents the new rules as effective June 4, 2026 (MB-69). The rule page and NerdWallet agree; the help article looks unrevised.
6. **Webull connector confirmation.** Webull's docs as read in run 1: a stock order instruction through the Cloud connector "requires confirmation in Webull APP / Desktop" (BR-56). StockBrokers.com (October 7, 2026): "Webull, tastytrade, Moomoo, Robinhood, and Public all let the agent place the order itself" (MB-79). Either Webull changed the connector after run 1's page was written, or the survey counts an in-app tap as the agent placing the order. Unresolved. It does not affect Webull's direct API (MB-72).
7. **Public: stale help pages.** Articles dated November 18, 2024 and June 27, 2025 still describe pattern day trader flags, the 25,000 dollar minimum and day trade calls, while four articles dated June 4, 2026 say those are gone for all margin accounts (MB-59). The later pages govern.
8. **TradeStation connector minimum.** Run 1 carried an unverified 10,000 dollar minimum (BR-46). TradeStation's home page today: "No account minimum required" (MB-54). A search summary today still attributes 10,000 dollars to an older copy of the connector page. The live vendor statement governs.
9. **TradeStation commission.** Run 1's single review said "$0 stocks" (BR-47). TradeStation's pricing page says 0 commission but also lists a per-share clearing fee by volume tier (MB-51). The review was not wrong about commission and silent about the clearing fee.
10. **Robinhood: can the agent borrow.** Robinhood's general margin pages describe borrowing; the Agentic account page says "margin borrowing isn't currently available in Agentic accounts" (MB-55). The Agentic page is specific and governs for the agent's account. The word "currently" signals it may change.
11. **tastytrade confirmation token.** Run 1 noted the token and left open whether a human must supply it (BR-64). StockBrokers.com reports tastytrade's own documentation as saying the token proves an order was not altered, not that a person approved it (MB-79). The tastytrade page itself was not reopened today, so this rests on the survey's report.
12. **FINRA "day trading" interim period length.** FINRA's January 2026 filing proposed 12 months (MB-19); the approved version is 18 months, to October 20, 2027 (BR-04). Alpaca's explainer page (updated April 27, 2026) still says "a 12-month interim transition period". The FINRA notice governs.

End of file marker
