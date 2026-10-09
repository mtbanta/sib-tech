# Run 2 helper notes: perpetual contracts that track U.S. equities (law, venues, wallets, keys)

Topic: perpetual contracts ("perps", a derivative with no expiry date that tracks a price) on U.S. single stocks and U.S. equity indexes. The law for a U.S. resident individual, the venues, the wallets and the keys.

Date of all access: 2026-10-09 (checked with `date`, America/Chicago).

This file is research input for a human decision. It is never an instruction to trade, and it is not legal advice. Nothing in it was read by a lawyer.

Method:
- Evidence comes only from pages opened live in this session with web search, web fetch, and `curl` for raw page text. Recalled knowledge was used only to decide where to look.
- No browser was used. No account, trial, wallet connection or signup form. Nothing installed. No file other than this one was created.
- Where a venue offers a public, read-only data endpoint that needs no account (for example Hyperliquid's `info` endpoint), it was queried with `curl` and the exact request is recorded in the finding. That is a read of public market data, not a trade and not an account action.
- PDFs were read by piping them from `curl` straight into built-in Python (`python3 -I`) without saving them. One exception outside this session's control: the fetch tool saved its own copy of one CFTC PDF (Letter 26-19) in its tool-results folder under `~/.claude`, outside this repo.

Source strength labels:
- A = primary and authoritative (a regulator, a statute or official code site, an exchange, or the vendor's or protocol's own documentation, pricing page or terms, seen live). For a decentralized venue its own docs and interface terms count as A for what the venue says about itself and nothing more.
- B = reputable independent press or an established reference publisher (including major law firm client alerts).
- C = review sites, comparison sites, affiliate blogs.
- D = forums, social posts, personal blogs, community code repositories.

Price labels: "published" (on the vendor's own public page, seen live today), "corroborated" (two or more independent sources agree, named), "gated and unverified" (reason given).

Caveat on quotes: the fetch tool passes pages through a summarizing model and can paraphrase. A quote marked "verbatim (curl)" was read from the raw page text. A quote marked "paraphrase by fetch tool" could not be confirmed word for word. Where a source used a long dash, it was replaced with a comma and the quote is marked "dash replaced".

Acronyms used: SEC (Securities and Exchange Commission). CFTC (Commodity Futures Trading Commission). CEA (Commodity Exchange Act). ECP (eligible contract participant, a legal class of large or professional traders). DCM (designated contract market, a CFTC-regulated futures exchange). SEF (swap execution facility). FCM (futures commission merchant, a futures broker). HIP-3 (Hyperliquid Improvement Proposal 3, which lets outside "deployers" launch their own perp markets on Hyperliquid). ADL (auto-deleveraging, the forced closing of winning positions when losing ones cannot be covered). API (application programming interface, the way software talks to a service). MCP (Model Context Protocol, the way an AI assistant connects to an outside tool). USDC (a dollar-pegged crypto token).

## 1. Findings register

### Q1. The law (statute text first)

Note on the statute source: the House's own code site (uscode.house.gov) returned "Site is currently under maintenance" today, so statute text was read with curl from the Government Publishing Office site govinfo.gov, "United States Code, 2024 Edition". That edition does not include any law passed in 2025 or 2026. Later findings check for such changes.

**PV-01.** U.S. securities law defines a "security-based swap" as a swap based on a single security or on a narrow-based security index. A contract that tracks one stock's price falls inside those words if it is a swap.
Page: 15 U.S.C. 78c (Securities Exchange Act section 3), "Definitions and application", paragraph (a)(68), U.S. Code 2024 Edition.
URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap2B-sec78c.htm
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "the term "security-based swap" means any agreement, contract, or transaction that (i) is a swap [...] and (ii) is based on (I) an index that is a narrow-based security index [...] (II) a single security or loan"
Rest of the quoted passage: the swap in (i) is "as that term is defined under section 1a of the Commodity Exchange Act".
Also on the page: subparagraph (D) "Mixed swap" says the term includes a contract that is as described in (A) "and also is based on the value of 1 or more interest or other rates, currencies, commodities".

**PV-02.** The same section defines "narrow-based security index". The first test is nine or fewer component securities. An index is also narrow if one component is over 30 percent of the weight, or the top five are over 60 percent.
Page: 15 U.S.C. 78c, paragraph (a)(55)(B), U.S. Code 2024 Edition.
URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap2B-sec78c.htm
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "The term "narrow-based security index" means an index (i) that has 9 or fewer component securities; (ii) in which a component security comprises more than 30 percent of the index's weighting"
Rest of the quoted passage: "(iii) in which the five highest weighted component securities in the aggregate comprise more than 60 percent of the index's weighting".
Also on the page: (a)(55)(A): "The term "security future" means a contract of sale for future delivery of a single security or of a narrow-based security index".
Plain reading, not interpretation: the statute's own tests would treat the S&P 500 and the Nasdaq 100 as broad-based only if none of the tests in (B) is met on the day in question. This file did not test the Nasdaq 100's weights against the 60 percent test. That is a guess-free statement of what was not measured.

**PV-03.** It is unlawful to effect a security-based swap with or for a person who is not an eligible contract participant unless the trade is done on a registered national securities exchange.
Page: 15 U.S.C. 78f (Securities Exchange Act section 6), "National securities exchanges", subsection (l), U.S. Code 2024 Edition.
URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap2B-sec78f.htm
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "It shall be unlawful for any person to effect a transaction in a security-based swap with or for a person that is not an eligible contract participant, unless such transaction is effected on a national securities exchange [...]"
Rest of the quoted passage: "registered pursuant to subsection (b)."

**PV-04.** It is unlawful to offer or sell a security-based swap to a person who is not an eligible contract participant unless a registration statement is in effect for it.
Page: 15 U.S.C. 77e (Securities Act section 5), "Prohibitions relating to interstate commerce and the mails", subsection (e), U.S. Code 2024 Edition.
URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title15/html/USCODE-2024-title15-chap2A-subchapI-sec77e.htm
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "it shall be unlawful for any person [...] to offer to sell, offer to buy or purchase or sell a security-based swap to any person who is not an eligible contract participant"
Rest of the quoted passage: the condition that opens the sentence is "unless a registration statement [...] is in effect as to a security-based swap".

**PV-05.** An individual is an "eligible contract participant" only with more than 10 million dollars invested on a discretionary basis, or more than 5 million dollars if the contract is to manage a risk the individual already has. An individual with 10,000 to 25,000 dollars is far below both figures.
Page: 7 U.S.C. 1a (Commodity Exchange Act section 1a), "Definitions", paragraph (18)(A)(xi), U.S. Code 2024 Edition.
URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title7/html/USCODE-2024-title7-chap1-sec1a.htm
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "(xi) an individual who has amounts invested on a discretionary basis, the aggregate of which is in excess of (I) $10,000,000; or (II) $5,000,000 and who enters into the agreement, contract, or transaction in order to manage the risk"
Also on the page: 15 U.S.C. 78c(a)(65) says the securities law term "has the same meaning as in section 1a of the Commodity Exchange Act".

**PV-06.** For swaps under the CFTC (which is where a swap on a broad-based index sits if it is not a security-based swap), a person who is not an eligible contract participant may enter into a swap only on, or under the rules of, a designated contract market.
Page: 7 U.S.C. 2 (Commodity Exchange Act section 2), "Jurisdiction of Commission", subsection (e) "Limitation on participation", U.S. Code 2024 Edition.
URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title7/html/USCODE-2024-title7-chap1-sec2.htm
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "It shall be unlawful for any person, other than an eligible contract participant, to enter into a swap unless the swap is entered into on, or subject to the rules of, a board of trade designated as a contract market"
Rest of the quoted passage: "under section 7 of this title."

**PV-07.** The CEA's definition of "swap" names "an equity index swap" and "an equity swap" and "a total return swap" among its examples, and it excludes futures contracts ("any contract of sale of a commodity for future delivery") and "security futures product". So whether a given perp is a "swap" or a "future" changes which rule applies, and the statute text alone does not say which a perpetual contract is.
Page: 7 U.S.C. 1a, paragraph (47) "Swap", U.S. Code 2024 Edition.
URL: https://www.govinfo.gov/content/pkg/USCODE-2024-title7/html/USCODE-2024-title7-chap1-sec1a.htm
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "including any agreement, contract, or transaction commonly known as [...] (IX) a total return swap; (X) an equity index swap; (XI) an equity swap"
Also on the page: (47)(B)(i) "The term "swap" does not include (i) any contract of sale of a commodity for future delivery (or option on such a contract), leverage contract [...], security futures product".


### Q1 continued. What regulators and Congress did in 2025 and 2026

**PV-08.** Congress has not passed a market structure law. Press and a law firm note report that the CLARITY Act failed a Senate procedural vote on 2026-09-15 by 49 to 50 (60 were needed). So the statute text in PV-01 to PV-07 is not known to have been changed by Congress. Caution: this rests on a search result summary of the pages named below, and the law firm page itself refused a direct fetch (HTTP 403), so the wording is not verbatim.
Page: Herbert Smith Freehills Kramer, "After the Clarity Act fails to advance, crypto securities law regulation is left to the SEC" (September 2026), as summarized by the search tool. Also bit.com, "CLARITY Act Fails: The 49-50 Senate Vote Explained".
URL: https://www.hsfkramer.com/insights/2026-09/after-the-clarity-act-fails-to-advance-crypto-securities-law-regulation-is-left-to-the-sec
Accessed: 2026-10-09. Strength: B (law firm alert, read only through the search tool's summary), plus C.
Quote, paraphrase by search tool: "Cloture failed 49 to 50 on 15 September 2026, eleven short of the 60 needed to open debate."

**PV-09.** On 2026-05-29 the CFTC adopted a policy statement on perpetual contracts. It approved a bitcoin perpetual on a designated contract market as a futures contract, and said perpetuals on other asset classes, naming "equity securities" and "narrow-based security indexes", must go through case-by-case Commission review, and would benefit from review by both the CFTC and the SEC.
Page: CFTC, "Policy Statement Concerning the Listing of Perpetual Contracts", 91 FR 33160, published 2026-06-03.
URL: https://www.federalregister.gov/documents/2026/06/03/2026-11020/policy-statement-concerning-the-listing-of-perpetual-contracts
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl of the Federal Register raw text): "perpetual contracts that reference equity securities or narrow-based security indexes, among others, would benefit from review by the Commission and the U.S. Securities and Exchange Commission."
Also on the page: "These types of asset classes include, but are not limited to, agricultural products, precious metals, equity securities, and narrow-based security indexes." And: "DATES: The Commission's policy statement is adopted as of May 29, 2026."

**PV-10.** CFTC staff define a perpetual contract as a derivative with no fixed expiry that uses a periodic funding rate to stay near the spot price, and they say the market for these "largely developed outside of the United States" because of "regulatory uncertainty".
Page: CFTC Letter No. 26-19, No-Action, Division of Market Oversight, dated 2026-06-12.
URL: https://www.cftc.gov/csl/26-19/download
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (text extracted from the PDF with python3 -I; the tool saved the PDF outside this repo by itself): "perpetual contracts are derivative contracts that have no fixed expiration date, and which rely on a periodic funding rate mechanism, rather than a fixed expiration date, to maintain relative price parity with the underlying asset's spot price."
Also on the page: "the market for perpetual futures contracts largely developed outside of the United States, with the majority of trading occurring on offshore trading venues."

**PV-11.** BROAD INDEX PERPS, U.S.-REGULATED: CFTC staff Letter 26-29 (2026-10-03) concerns converting existing "perpetual-style" futures on broad-based security indexes into true perpetuals at designated contract markets. It was requested by Coinbase on 2026-10-01. It cites a KalshiEX submission for a "US500 Futures Contract" dated 2026-08-18. The relief does not cover anything that is not a broad-based security index, and it expires 2026-10-20.
Page: CFTC Letter No. 26-29, No-Action, dated 2026-10-03.
URL: https://www.cftc.gov/csl/26-29/download
Accessed: 2026-10-09. Strength: A. Text extracted from the PDF with built-in Python (footnotes first, then the body with a fuller decoder; spacing normalized).
Quote, verbatim (footnote 25, python3 -I extraction, spacing normalized): "For avoidance of doubt, the no-action positions in this letter are not applicable to any perpetual-style futures contracts that reference assets that are not Broad-Based Security Indices."
Also on the page: "The no-action positions in this letter expire on October 20, 2026." Footnote 3: "an index is a broad-based security index if it does not meet the definition of a narrow-based security index under Section 1a(35) of the Commodity Exchange Act". Footnote 13: "KalshiEX LLC Submission [...] Voluntary submission of new products for Commission review and approval regarding the Initial Listing of the US500 Futures Contract (Aug. 18, 2026)." Body of the letter, titled "No-Action Positions Regarding Removal of Expiration Dates from Existing Broad-Based Security Index Perpetual-Style Futures Contracts": the Kalshi contract "was deemed approved by the Commission on October 2, 2026." And: "several of these Existing Perpetual-Style Contracts currently have open interest." And: "This letter, and the positions taken herein, represent the views of the Division only".

**PV-12.** Press reports that the CFTC approved Kalshi's US500 perpetual future (deemed approved 2026-10-02) and that Kalshi opened it for trading. It is cash-settled and tracks the "MerQube US Large Cap Index" (the 500 largest U.S. companies), not the S&P 500 itself. Confirmed elsewhere in this file: the approval date by CFTC Letter 26-29 (PV-11) and the live listing by Kalshi's own market list (PV-24).
Page: Finance Magnates, "Kalshi Takes Perpetual Futures into US Equities after CFTC Approval", dated 2026-10-06, as summarized by the search tool. Also Finance Magnates, "CFTC Lets Coinbase Turn 25-Year Index Futures Into Contracts That Never Expire", dated 2026-10-06 (fetched).
URL: https://www.financemagnates.com/fintech/kalshi-takes-perpetual-futures-into-us-equities-after-cftc-approval/ and https://www.financemagnates.com/forex/regulation/cftc-lets-coinbase-turn-25-year-index-futures-into-contracts-that-never-expire/
Accessed: 2026-10-09. Strength: B.
Quote, paraphrase by fetch tool: the letter covers only broad-based index futures and "does not reach beyond broad-based indices."

**PV-13.** SINGLE STOCK PERPS, U.S.-REGULATED, PENDING: Kalshi filed with the SEC and the CFTC on 2026-09-18 to list perpetual contracts on single stocks as "security futures" ("Perpetual SFPs"). The SEC notice says the CFTC "has not yet approved" it, and that it becomes effective 2026-11-02 or later if CFTC approval takes longer. As of the notice it was not live.
Page: SEC, "Self-Regulatory Organizations; KalshiEX LLC; Notice of Filing and Immediate Effectiveness of a Proposed Rule Change Relating to Listing Standards for Security Futures Products", File No. SR-KALSHIEX-2026-02, 91 FR 60467, published 2026-09-23.
URL: https://www.federalregister.gov/documents/2026/09/23/2026-19409/self-regulatory-organizations-kalshiex-llc-notice-of-filing-and-immediate-effectiveness-of-a
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "The proposed rule change will become effective on November 2, 2026, or such later date as it may be approved pursuant to CFTC Regulations."
Also on the page: "to list contracts that convey exposure to the price of an underlying equity security, have no pre-specified expiration date and are designated as Perpetual SFPs [...] as security futures." And: "The CFTC has not yet approved the proposed rule change." And: within 60 days of effectiveness the SEC "may summarily abrogate the proposed rule change".

**PV-14.** Terms in the Kalshi single stock perpetual filing: customer margin of at least 15.50 percent of position value (about 6.45 times leverage at most), one contract equals 100 shares, the stock must have a market value of at least 100 billion dollars and average daily traded value of at least 450 million dollars, and trading runs Sunday 6:00 p.m. to Friday 5:00 p.m. Eastern with a one hour daily break. A 100 share contract on a 150 dollar stock is 15,000 dollars of exposure, which matters for a 10,000 to 25,000 dollar account (that sum is arithmetic by this file, not a quote).
Page: same SEC notice as PV-13.
URL: https://www.federalregister.gov/documents/2026/09/23/2026-19409/self-regulatory-organizations-kalshiex-llc-notice-of-filing-and-immediate-effectiveness-of-a
Accessed: 2026-10-09. Strength: A. Price: published (margin rate in a regulatory filing; trading fees not stated there).
Quote, verbatim (curl): "margin in an amount not less than 15.50% (such percentage, the "Perpetual SFP Margin Ratio") of the Current Market Value of the position"
Also on the page: "which shall be one hundred (100) shares of the Underlying Security". "(ii) the Underlying Security must have a minimum market capitalization of at least $100 billion". "Perpetual SFPs shall be available for trading from 6:00 p.m. ET on Sunday through 5:00 p.m. ET on Friday, with a daily maintenance window from 5:00 p.m. ET to 6:00 p.m. ET". They "will be available to the public (subject to eligibility requirements in Rule 14.37".

**PV-15.** The classification of perpetuals is being fought in court. The Kalshi notice says CME Group sued over the CFTC's bitcoin perpetual approval, arguing that perpetual contracts "are swaps under the CEA", and that no merits ruling has been delivered. So "perp equals future, not swap" is the CFTC's and the exchanges' position, not a court-tested one.
Page: same SEC notice as PV-13 (the text is Kalshi's own statement, published by the SEC).
URL: https://www.federalregister.gov/documents/2026/09/23/2026-19409/self-regulatory-organizations-kalshiex-llc-notice-of-filing-and-immediate-effectiveness-of-a
Accessed: 2026-10-09. Strength: A for the fact that the filing says this.
Quote, verbatim (curl): "CME argues that perpetual contracts such as the BTCPERPs are swaps under the CEA, but ignores the rest of the CEA's "swap" definition, which per se excludes futures from its scope"
Also on the page: "Not only have no merit rulings yet been delivered in connection with CME's lawsuit".

**PV-16.** Other U.S. exchanges filed for single stock perpetuals in the same weeks: Coinbase Derivatives, Bitnomial Exchange (press says owned by Payward, Kraken's parent), and North American Derivatives Exchange (Nadex). Press also reports OG.com Markets filed with the CFTC on 2026-09-24 for cash-settled single stock futures that "never expire" and trade 24 hours a day, five days a week. All were described as seeking approval.
Page: Federal Register search results for SEC notices 2026-19407 (Coinbase Derivatives, 2026-09-23), 2026-19408 (Bitnomial, 2026-09-23), 2026-19512 (Coinbase Derivatives margin, 2026-09-24), 2026-20194 (North American Derivatives Exchange, 2026-10-02). Cointelegraph, "OG.com Joins US Push for Single-Stock Perpetual Futures", 2026-09-25.
URL: https://www.federalregister.gov/api/v1/documents.json?conditions[term]=perpetual+security+futures and https://cointelegraph.com/news/og-com-seeks-cftc-approval-single-stock-perpetual-futures
Accessed: 2026-10-09. Strength: A for the notices existing, B for the press account.
Quote, paraphrase by fetch tool (Cointelegraph): "cash-settled single-stock futures that never expire and can trade 24 hours a day, five days a week."

**PV-17.** Coinbase Derivatives' single stock perpetual filing (also covers exchange-traded fund shares) was "not yet effective because the CFTC has not yet approved" it as of its SEC notice. It uses the same 100 billion dollar market value floor as Kalshi. A companion Coinbase filing proposes customer margin of not less than 15 percent of position value.
Page: SEC, "Self-Regulatory Organizations; Coinbase Derivatives, LLC; Notice of Filing and Immediate Effectiveness of a Proposed Rule Change Relating to [...] Cash Settled Futures on Individual Equity Securities and Exchange-Traded Fund Shares, Including Perpetual Single-Stock Futures", 91 FR 60448, 2026-09-23. And "Notice of Filing of a Proposed Rule Change Relating to Customer Margin Requirements for Security Futures Products", 91 FR 60670, 2026-09-24.
URL: https://www.federalregister.gov/documents/2026/09/23/2026-19407/self-regulatory-organizations-coinbase-derivatives-llc-notice-of-filing-and-immediate-effectiveness and https://www.federalregister.gov/documents/2026/09/24/2026-19512/self-regulatory-organizations-coinbase-derivatives-llc-notice-of-filing-of-a-proposed-rule-change
Accessed: 2026-10-09. Strength: A. Price: published (margin floor in a filing).
Quote, verbatim (curl): "The proposed rule change is not yet effective because the CFTC has not yet approved the proposed rule change."
Also on the pages: "the Underlying Security must have a minimum market capitalization of at least $100 billion". Margin notice: "shall not be less than 15% of the current market value of the relevant Contract".

**PV-18.** Nadex (North American Derivatives Exchange) filed on 2026-09-24 for "Perpetual Cash-Settled Single Stock Security Futures". Its SEC notice says the CFTC "has not yet approved" it and it "would become effective upon approval by the CFTC".
Page: SEC, "Self-Regulatory Organizations; North American Derivatives Exchange, Inc.; Notice of Filing and Immediate Effectiveness of a Proposed Rule Change Relating to Rules Governing Contract Specifications for Perpetual Cash-Settled Single Stock Security Futures", 91 FR 62786, 2026-10-02.
URL: https://www.federalregister.gov/documents/2026/10/02/2026-20194/self-regulatory-organizations-north-american-derivatives-exchange-inc-notice-of-filing-and-immediate
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "The proposed rule change would become effective upon approval by the CFTC pursuant to CFTC Regulations."

**PV-19.** The SEC and the CFTC themselves say the line is not yet clear. In a joint request for comment (comments closed 2026-08-24) they ask whether there is "a need for greater clarity regarding whether a cash-settled "perpetual" contract referencing an equity security could be treated as a security future". No final rule or joint interpretation answering it was found today.
Page: CFTC and SEC, "Joint Request for Comment on Further Definition of "Swap" and "Security-Based Swap" and on Alternative Compliance", Release No. 33-11424; 34-105735, 91 FR 37873, published 2026-06-24.
URL: https://www.federalregister.gov/documents/2026/06/24/2026-12743/joint-request-for-comment-on-further-definition-of-swap-and-security-based-swap-and-on-alternative
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "For example, is there a need for greater clarity regarding whether a cash-settled "perpetual" contract referencing an equity security could be treated as a security future?"
Also on the page: "Any contract of sale of a commodity for future delivery (or option on such a contract), as well as any security futures product, is excluded from the "swap" definition."

**PV-20.** The SEC's 2026-09-17 "innovation" order for onchain trading of tokenized stocks (temporary, conditional, five years) covers tokenized real shares on permissioned venues. It expressly leaves out tokens that give synthetic exposure, naming "a tokenized security-based swap". So this order does not open onchain equity perps to anyone.
Page: SEC, "Order Granting Temporary Conditional Exemptive Relief [...] for the Use of Certain Distributed Ledger Trading Venues for Tokenized NMS Stocks [...]", Release No. 34-106402, File No. 4-927, dated 2026-09-17, 91 FR 60168, published 2026-09-22.
URL: https://www.federalregister.gov/documents/2026/09/22/2026-19388/order-granting-temporary-conditional-exemptive-relief-pursuant-to-section-36a1-of-the-securities
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): ""Tokenized NMS Stock" does not include securities where a third party issues a crypto asset representing its own security that provides synthetic exposure to an underlying security, such as a tokenized linked security or a tokenized security-based swap."
Also on the page: "to facilitate the permissioned trading of tokenized NMS stock". "Set to expire five years after publication".

**PV-21.** SEC staff said on 2026-01-28 that a crypto asset that is a security-based swap may not be offered or sold to people who are not eligible contract participants unless it is registered and traded on a national securities exchange. This restates PV-03 and PV-04 for onchain products. A staff statement is not a rule.
Page: SEC, "Statement on Tokenized Securities", Division of Corporation Finance, Division of Investment Management, Division of Trading and Markets, dated 2026-01-28.
URL: https://www.sec.gov/newsroom/speeches-statements/corp-fin-statement-tokenized-securities-012826-statement-tokenized-securities
Accessed: 2026-10-09. Strength: A.
Quote, paraphrase by fetch tool (the tool returned it in pieces; joined here): "The third party may not offer or sell the crypto asset representing the security-based swap to persons who are not eligible contract participants unless a Securities Act registration statement is in effect as to the crypto asset [...]"
Rest of the quoted passage: "and the transactions in the crypto asset are effected on a national securities exchange."
Also (from PV-20's page): staff statements "have no legal force or effect: they do not alter or amend applicable law".

**PV-22.** The closest enforcement precedent found is from 2020, outside the 2024 to 2026 window: the SEC and CFTC charged Abra, an app that gave retail users synthetic exposure to U.S. stocks through blockchain contracts. The company was charged, not its users. No 2024, 2025 or 2026 enforcement action about equity perps offered to U.S. retail was found in two searches. Absence in two searches is not proof that none exists.
Page: SEC press release 2020-153, "SEC Charges App Developer for Unregistered Security-Based Swap Transactions", dated 2020-07-13.
URL: https://www.sec.gov/newsroom/press-releases/2020-153
Accessed: 2026-10-09. Strength: A.
Quote, paraphrase by fetch tool: businesses "may not evade the federal securities laws merely by transacting primarily with non-U.S. retail investors"
Also on the page: Abra and Plutus Technologies agreed to a cease-and-desist order and a combined penalty of 150,000 dollars.

**PV-23.** An advocacy group tied to Hyperliquid asked the SEC and CFTC on 2026-08-24 to let cash-settled equity perpetuals be classed as security futures. This shows the offshore venues themselves treat the U.S. position as unresolved. It is a request, not a regulator's answer.
Page: The Block, "Hyperliquid Policy Center urges SEC, CFTC to harmonize rules for perpetual contracts", 2026-08-24, as summarized by the search tool.
URL: https://www.theblock.co/news/regulation/2026-08-24-hyperliquid-policy-center-urges-sec-cftc-harmonize-rules-perpetual-contracts-412601
Accessed: 2026-10-09. Strength: B.
Quote, paraphrase by search tool: "cash-settled equity perpetuals carrying the established characteristics of futures contracts should be eligible for classification as security futures."


### Q2. U.S.-regulated venues

**PV-24.** KALSHI, LIVE: Kalshi's own public market list shows an active perpetual on a U.S. large company index, ticker KXUS500PERP ("US500"), asset class "Indices". At the time read it showed about 7.67 million dollars of 24 hour trading and about 1.37 million dollars of open interest, with an estimated maximum leverage of about 13.7 times. A second index perp, KXUSTECH100PERP ("US Tech 100"), is listed but "inactive". No single stock perp is in the production list (29 markets: 20 crypto, 6 metals, 2 indices, 1 energy).
Page: Kalshi production perps API, market list (public, no sign-in). Request: `curl https://external-api.kalshi.com/trade-api/v2/margin/markets` at 2026-10-09 16:54 UTC.
URL: https://external-api.kalshi.com/trade-api/v2/margin/markets
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl, JSON fields): "asset_class":"Indices" ... "ticker":"KXUS500PERP" ... "title":"US500" ... "status":"active" ... "contract_size":"0.001000" ... "leverage_estimate":13.7398 ... "volume_24h_notional_value_dollars":"7673982.196700" ... "open_interest_notional_value_dollars":"1372210.951800"
Also on the page: "ticker":"KXUSTECH100PERP","title":"US Tech 100" with "status":"inactive". The US500 market carries a "schedule" with a next close time, so it is not open around the clock.

**PV-25.** Press describes the Kalshi US500 perpetual: launched 2026-10-06, cash-settled, tracks the MerQube US Large Cap Index (500 largest U.S. companies, price return, no dividends), trades 6 p.m. Eastern Sunday to 5 p.m. Eastern Friday, funding set daily at 4 p.m., and outside regular stock hours it "trades against the last published index level". It is not the S&P 500 itself and not the Nasdaq 100.
Page: Finance Magnates, "Kalshi Takes Perpetual Futures into US Equities after CFTC Approval", 2026-10-06.
URL: https://www.financemagnates.com/fintech/kalshi-takes-perpetual-futures-into-us-equities-after-cftc-approval/
Accessed: 2026-10-09. Strength: B. Price: leverage "15.3x" at publication (press), against 13.7 on Kalshi's own list today (PV-24). Trading fee not stated.
Quote, paraphrase by fetch tool: "The index is calculated only during regular US equity hours, and outside those hours the contract trades against the last published index level."

**PV-26.** Kalshi's test ("demo") system lists 60 "Equities" perps, including AAPL, AMZN, GOOGL, META, MSFT, TSLA, AMD, JPM, LLY, COST, plus index perps US500, US2000 and USTECH100. That shows what Kalshi is building toward. It is a test system with test money, not a live offering, and several entries are labeled "Test Equity" or "Mock Stock".
Page: Kalshi demo perps API, market list (public, no sign-in). Request: `curl https://external-api.demo.kalshi.co/trade-api/v2/margin/markets` at 2026-10-09 16:54 UTC.
URL: https://external-api.demo.kalshi.co/trade-api/v2/margin/markets
Accessed: 2026-10-09. Strength: A (for what the demo lists).
Quote, verbatim (curl, JSON fields): "asset_class":"Equities" ... "ticker":"KXAAPLPERP1","title":"AAPLPERP" ... "status":"active"
Also on the page: 105 demo markets: 60 Equities, 23 Crypto, 6 Metals, 6 Energy, 5 FX, 4 Indices, 1 GPU. Estimated leverage on demo single stocks is about 3 to 5 times, under the 6.45 times implied by the 15.50 percent margin floor in PV-14.

**PV-27.** Who may trade Kalshi perps: U.S.-based users who pass identity checks and are approved for a margin account after a questionnaire. Most retail users trade through Kalshi Prime, a registered futures commission merchant that holds customer money in a segregated account. This is a custodial account in dollars, not a crypto wallet.
Page: Kalshi Help Center, "Applying for Perpetuals Access".
URL: https://help.kalshi.com/en/articles/15357656-applying-for-perpetuals-access
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl of the .md version): "US-based Kalshi users who have completed KYC verification are eligible to apply."
Also on the page: "Most retail users on Kalshi trade perpetuals currently through Kalshi Prime, a registered Futures Commission Merchant (FCM)." And it "holds your funds in a customer-segregated account on your behalf." Applications "may be declined based on your questionnaire responses, regulatory requirements, or other eligibility criteria."

**PV-28.** Kalshi has a perps trading API (REST, WebSocket and FIX) with a demo environment, but NO page read confirms that a retail customer of Kalshi Prime can get a perps API key. Kalshi's full API docs export never mentions "Kalshi Prime" or "retail" (text search), its endpoints speak of "Direct" members and of futures brokers with "subtraders", and PV-27 says most retail users trade through Kalshi Prime. Kalshi is the only U.S. route confirmed open to retail, so this is the most important open item for the stack. Production access was "rolling out member by member". Keys are public and private key pairs. No trade-only versus withdraw key scope was found for perps on the pages read (see "Not verified").
Page: Kalshi API docs, "Perps API", and "API Keys".
URL: https://docs.kalshi.com/margin and https://docs.kalshi.com/getting_started/api_keys
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl of the .md version): "The **Perps API** is how you trade Kalshi's perpetual futures."
Also on the page: Production base URL "https://external-api.kalshi.com/trade-api/v2/margin/ (rolling out member by member)". Demo base URL "https://external-api.demo.kalshi.co/trade-api/v2/margin/". WebSocket channels "orderbook_delta, ticker, trade, fill, user_orders". "The private key never leaves your system". Not available on perps: batch orders and historical data endpoints.

**PV-29.** Kalshi perps fees are a percentage of the full position size, charged on open and on close, with lower maker than taker rates, tiered by volume. The actual percentages are on a separate fee schedule page that was not read (see "Needs browser"). Bitcoin perps: up to 6 times leverage, funding every 8 hours, minimum position about 8 dollars.
Page: Kalshi Help Center, "Perps Fees Explained" and "What are Perpetual Futures?" (dated 2026-07-24).
URL: https://help.kalshi.com/en/articles/16071417-perps-fees-explained and https://help.kalshi.com/en/articles/14679970-what-are-perpetual-futures
Accessed: 2026-10-09. Strength: A. Price: gated and unverified (the rate table at https://kalshi.com/fee-schedule returned a "Vercel Security Checkpoint" browser check to curl).
Quote, verbatim (curl of the .md version): "Trading fees on perpetual futures are charged as a percentage of your position's **notional value**"
Also on the page (fetch tool paraphrase of the second page): Kalshi offers perps "legally and natively to US residents" with "no VPN, no workarounds".

**PV-30.** COINBASE DERIVATIVES (U.S.): confirmed by the CFTC, Coinbase Derivatives already lists "perpetual-style" futures on broad-based security indexes, several with open interest (PV-11). So Kalshi's US500 is not the only U.S.-listed product of this kind. NOT confirmed: who may trade them (retail or institutions only), their names, leverage, fees and hours. Press reports that Coinbase Derivatives, a CFTC designated contract market, listed "perpetual-style" equity index futures in June 2026 (four thematic indexes: AI, China, defense, top Nasdaq companies), long-dated contracts that expire in about five years, aimed first at institutions with retail access "on the roadmap". A "US500" contract with up to 20 times leverage was announced for 2026-08-17. Letter 26-29 (PV-11) is about converting such contracts into true perpetuals. Coinbase's own pages refused both the fetch tool and curl, so none of this is confirmed on a Coinbase page.
Page: search tool summary of Coinbase blog "Coming June 8: Perpetual-Style Equity Index Futures", Crypto Briefing and Cryptonomist ("US500 Perpetual Futures Launch with 20x Leverage on Coinbase", 2026-07-31).
URL: https://www.coinbase.com/blog/coming-june-8-perpetual-style-equity-index-futures (blocked, see "Needs browser") and https://en.cryptonomist.ch/2026/07/31/us500-perpetual-futures-coinbase/
Accessed: 2026-10-09. Strength: A for the existence of the contracts (CFTC Letter 26-29, and Coinbase's request letter of 2026-10-01 at https://www.cftc.gov/csl/26-29/request_letter/0/download, which says, spacing normalized, "CDE offers perpetual-style contracts, instead of true perpetual contracts."). C for the product details (search summaries of press; the vendor page was not readable). Price: gated and unverified.
Quote, paraphrase by search tool: "The initial launch targets institutional clients through a partnership-based approach. Retail access is on the roadmap, but it's not part of the day-one offering."

**PV-31.** COINBASE, NON-U.S.: Coinbase launched perpetual futures on U.S. single stocks (Apple, Microsoft, Alphabet, Amazon, NVIDIA, Meta, Tesla) and on SPY and QQQ in March 2026, but only for eligible non-U.S. customers. The report says they are not available to U.S. persons.
Page: Markets Media, "Coinbase Launches Stock Perpetual Futures", 2026-03-20.
URL: https://www.marketsmedia.com/coinbase-launches-stock-perpetual-futures/
Accessed: 2026-10-09. Strength: B. Price: leverage "up to 10x" on single stocks and "up to 20x" on the two fund perps, as reported. Fees not stated.
Quote, paraphrase by fetch tool: "US stock perpetual futures are now available" to eligible non-US retail traders and institutions. Not available to US persons.

**PV-32.** ROBINHOOD (U.S.): on 2026-09-29 Robinhood announced U.S. perpetual futures on eight crypto assets "in the coming months". No stock or index perp for U.S. users was in the announcement. One lower quality site claims stock perps launched, which conflicts with this and was not verified. Separately Robinhood said it plans 24/7 trading of select U.S. stocks and an in-app "Robinhood Agents" feature (outside this topic, noted for the main session).
Page: The Block, "Robinhood to launch perps, weekend stock trading for US users", 2026-09-29.
URL: https://www.theblock.co/news/business/2026-09-29-robinhood-perps-trading-417242
Accessed: 2026-10-09. Strength: B.
Quote, paraphrase by fetch tool: CEO Vlad Tenev: "Robinhood is bringing America its first true perps. No expiry, with P&L settled every 15 minutes."

**PV-33.** OTHER U.S. NAMES CHECKED: no live U.S.-regulated single stock or equity index perp for retail was found at Cboe, CME (press says CME launched 77 dated single stock futures in July 2026, which are dated futures and out of scope), Bitnomial (filed, PV-16), Nadex and OG.com or Crypto.com (filed, PV-16 and PV-18), Kraken's U.S. arm (crypto perps, and its parent's Bitnomial filing), Polymarket or QCEX, Gemini, Interactive Brokers ForecastEx, Webull, or tastytrade. This is a search-level negative from two extended searches, not a page-by-page check of each firm.
Page: web searches "October 2026 US regulated equity perpetual futures retail [...]" and "SEC CFTC perpetual contracts equity single stock perpetual futures U.S. retail 2026 [...]".
URL: (search results; individual pages cited in PV-12, PV-16, PV-30 to PV-32)
Accessed: 2026-10-09. Strength: C for the negative.
Quote, paraphrase by search tool: "CME Group took the dated route, launching 77 single-stock futures in July that require periodic rollovers."

### Q3. Offshore and decentralized venues

#### Hyperliquid and its builder-deployed (HIP-3) exchanges

**PV-34.** Hyperliquid's public data endpoint lists ten builder-deployed perp exchanges ("perp dexs") besides its main one: xyz (XYZ, the trade.xyz deployer), flx (Felix Exchange), vntl (Ventuals), hyna (HyENA), km and mkts (both "Markets by Kinetiq"), abcd (ABCDEx), cash (dreamcash), para (Paragon), io (EntropyIO). Today only four had active (not delisted) markets: xyz 114, para 30, io 9, mkts 5. The flx, vntl, hyna, km and cash lists returned every market flagged delisted.
Page: Hyperliquid info endpoint. Requests: `curl -X POST https://api.hyperliquid.xyz/info -d '{"type":"perpDexs"}'` and `'{"type":"metaAndAssetCtxs","dex":"<name>"}'` at 2026-10-09 16:56 UTC. No account or key needed.
URL: https://api.hyperliquid.xyz/info
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl, JSON fields): 'name': 'xyz', 'fullName': 'XYZ' ... 'name': 'flx', 'fullName': 'Felix Exchange' ... 'name': 'mkts', 'fullName': 'Markets By Kinetiq'
Caution: "delisted" here is the endpoint's own `isDelisted` flag read by this file's script. Whether those deployers moved their markets elsewhere was not checked. "Unit" was not found as a perp deployer in this list.

**PV-35.** XYZ (trade.xyz) on Hyperliquid, live counts: 114 active markets, about 2.62 billion dollars of 24 hour volume and about 3.60 billion dollars of open interest across all of them. The venue's own specification table describes 59 of them as common stock listed on a U.S. exchange, 10 more as depositary shares or foreign-registered shares of non-U.S. companies traded in the U.S. (TSM, BABA, ARM, ASML, NBIS, NOK, SKHY, IREN, SNXX, UMC, out of scope), and 17 as U.S.-listed funds or preferred shares (examples of the common stocks with 24 hour volume: SNDK 224 million, MU 134 million, NVDA 119 million, INTC 30 million, GOOGL 29 million, TSLA 29 million, AAPL 24 million, META 22 million, AMD 18 million, AMZN 15 million, MSFT 13 million). U.S. index perps: SP500 (172 million volume, 370 million open interest, up to 50 times) and XYZ100 (388 million volume, up to 30 times). The rest are U.S.-listed funds (for example SOXL, SMH, TLT, XLE, EWY), commodities, currencies, and non-U.S. or private company names.
Page: Hyperliquid info endpoint, request `{"type":"metaAndAssetCtxs","dex":"xyz"}` at 2026-10-09 16:56 UTC.
URL: https://api.hyperliquid.xyz/info
Accessed: 2026-10-09. Strength: A for the tickers and numbers (Hyperliquid endpoint) and A for the classification (trade[XYZ] Docs, "Specification Index", 113 rows, read from https://docs.trade.xyz/llms-full.txt and sorted by this file's script on the words "common stock", "ADS", "ETF" and similar in each row's description). A "common stock" row can still be a company based outside the U.S. (BB is one this file noticed), so 59 is an upper count of U.S. companies.
Quote, verbatim (script output from the JSON): "xyz | active 114 of 133 | 24hVol $2616.7M | OI $3596.5M" and "SP500(50x,v171.9M,oi369.8M)" and "NVDA(20x,v119.2M,oi116.8M)"
Also in the data: single stocks show maximum leverage of 10 or 20 times. Rows the venue describes as common stock on a U.S. exchange (59): TSLA, NVDA, GOOGL, INTC, MU, PLTR, ORCL, MSTR, MSFT, META, AMZN, AMD, AAPL, COIN, HOOD, NFLX, CRCL, SNDK, RIVN, USAR, CRWV, DKNG, HIMS, COST, LLY, BIRD, BX, LITE, GME, RKLB, MRVL, ZM, EBAY, CBRS, PURRDAT, BB, IBM, DELL, AVGO, QNT, NOW, WDC, SPCX, BE, QCOM, BOT, AMAT, SHAZ, GEV, AAOI, RDDT, NET, CRWD, MRNA, BMNR, CVX, LRCX, GLW, TWST. Example row, verbatim: "NVDA references 1 share of NVIDIA Corporation common stock (Nasdaq: NVDA), quoted in USD." The table also gives each U.S. stock market a funding rate multiplier of 0.5 and marks most single stocks "Normal Isolated" margin, the largest "Cross Margin".

**PV-36.** Other Hyperliquid deployers with U.S. equity markets today: "mkts" (Markets by Kinetiq) has index perps USTECH, US500 and SMALL2000 (a small company index, 0.4 million dollars volume) with about 5.7 million dollars total volume. "para" (Paragon) has about 20 U.S. stock tickers (for example VST, COHR, TTWO, CRDO, LRCX, SMCI, SOFI, MELI) with about 7.4 million dollars total volume. "io" (EntropyIO) has SNDK, NBIS, IONQ, GPRO and private company names, about 62 million dollars total. These are thin next to xyz.
Page: Hyperliquid info endpoint, requests `{"type":"metaAndAssetCtxs","dex":"mkts"}`, `"para"`, `"io"` at 2026-10-09 16:56 UTC.
URL: https://api.hyperliquid.xyz/info
Accessed: 2026-10-09. Strength: A for tickers and numbers, same ticker-reading caveat as PV-35.
Quote, verbatim (script output from the JSON): "mkts | active 5 of 24 | 24hVol $5.7M | OI $11.4M" and "SMALL2000(20x,v0.4M,oi0.8M)" and "para | active 30 of 38 | 24hVol $7.4M | OI $18.2M"

**PV-37.** trade.xyz's own terms bar U.S. residents and anyone located in the United States from its interface, and forbid using a VPN to get around the block.
Page: Trade[XYZ], "Terms of Use", "Last Updated: September 6, 2026", sections 2.2 and 2.3.
URL: https://trade.xyz/terms
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): ""Restricted Persons" include: (a) persons or entities who reside in, are located in, are incorporated in [...] or are otherwise subject to the laws of the United States of America, Canada, the United Kingdom"
Rest of the quoted passage: the omitted words are "have a registered office or principal place of business in,".
Also on the page: "2.3. No circumvention. You must not use a VPN, proxy, Tor, or similar to circumvent geo-blocks or our eligibility rules." And: "Restricted Persons are strictly prohibited from accessing or using the Interface." The terms govern "the website-hosted user interface currently available at app.trade.xyz". The trade.xyz docs add: "Access is prohibited where restricted by the Terms of Use, including to United States persons, in the United States, or in other restricted jurisdictions."

**PV-38.** How trade.xyz prices U.S. stock perps around the clock: when outside markets are open it uses outside prices (24 hours a day, five days a week for U.S. stocks, including an overnight session from Blue Ocean ATS). When they are closed (weekends, holidays) the oracle moves on the venue's own order book, and the mark price is capped within plus or minus one over the maximum leverage of a reference price (for a 10 times market, 10 percent).
Page: trade[XYZ] Docs, "Oracle Price", "Discovery Bounds", and "Stocks, US".
URL: https://docs.trade.xyz/llms-full.txt (the docs' own full text export; pages under https://docs.trade.xyz/perpetuals/)
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl, dashes replaced): "The Relayer derives external prices for stocks 24/5, from Sunday 8:05 PM ET to Friday 8:00 PM ET."
Also on the page: "The overnight trading session is provided by Blue Ocean ATS (BOATS)." "Discovery bounds restrict the mark price within ±(1/max leverage) of a reference price during both external and internal pricing sessions." "As a result, XYZ is the primary venue for price discovery over weekends, holidays, and other extended sessions." "If a trader's liquidation price lies outside the active price bounds, their position cannot be liquidated while those bounds are in effect." For U.S. index perps: "Traditional futures quotes from institutional liquidity providers are available 23/5".

**PV-39.** trade.xyz says its SP500 market is "the only officially licensed perpetual contract based on the S&P 500", and its XYZ100 tracks "100 large, non-financial companies listed on a U.S. exchange" (its own index, not the Nasdaq 100 by name). Its perps are margined and settled in USDC.
Page: trade[XYZ] Docs, "Indices, US" and "Perpetuals".
URL: https://docs.trade.xyz/llms-full.txt
Accessed: 2026-10-09. Strength: A (vendor claim).
Quote, verbatim (curl): "S&P Dow Jones Indices has exclusively licensed the S&P 500 Index to trade[XYZ] to launch the only officially licensed perpetual contract based on the S&P 500."
Also on the page: "They are linear contracts margined and settled in USDC."

**PV-40.** Fees on Hyperliquid builder-deployed markets: the base Hyperliquid perp rate at the lowest volume tier is 0.045 percent taker and 0.015 percent maker. trade.xyz says standard fees on HIP-3 markets are twice that (so 0.09 percent taker, 0.03 percent maker at the lowest tier, this file's arithmetic), unless "growth mode" is on for a market, which cuts all-in fees by at least 90 percent. Funding on Hyperliquid is paid every hour.
Page: Hyperliquid Docs, "Fees", and trade[XYZ] Docs, "Fees".
URL: https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees and https://docs.trade.xyz/llms-full.txt
Accessed: 2026-10-09. Strength: A. Price: published (both vendor pages, seen today). Which xyz markets have growth mode on today was not read.
Quote, verbatim (curl): "Standard fees for all HIP-3 assets are currently 2x the usual fees on validator-operated perp markets, with 50% of those fees going to Hyperliquid and 50% to trade[XYZ]."
Also on the pages: Hyperliquid tier 0 row: "| 0 | | 0.045% | 0.015% |". "With growth mode, all-in fees are reduced by ≥90% from the standard fee rate". "The funding rate on Hyperliquid is paid every hour." "HIP-3 deployers can configure an additional fee share between 0-300%". Builder (front end) fees are separate: "The user must approve a maximum builder fee for each builder, and can revoke permissions at any time."

**PV-41.** KEYS: Hyperliquid lets a main ("master") wallet approve a separate "API wallet" (also called "agent wallet") that signs trades for it. Hyperliquid's official Python software kit states the agent cannot move money out. An agent key can be given an expiry of at most 180 days. One account can have 1 unnamed and up to 3 named API wallets.
Page: Hyperliquid Docs, "Nonces and API wallets" and "Exchange endpoint" (Approve an API wallet). Hyperliquid official SDK example `examples/basic_agent.py`.
URL: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets and https://raw.githubusercontent.com/hyperliquid-dex/hyperliquid-python-sdk/master/examples/basic_agent.py
Accessed: 2026-10-09. Strength: A (protocol docs and the protocol's own code repository).
Quote, verbatim (curl, SDK file): "creating an agent that can place trades on behalf of the account. The agent does not have permission to transfer or withdraw funds."
Also on the pages (docs, verbatim): "A master account can approve API wallets to sign on behalf of the master account or any of the sub-accounts." "A custom expiration can be set by appending valid_until {timestamp} after the name. The expiration can be at most 180 days in the future". "An account can have 1 unnamed approved wallet and up to 3 named ones." Note: the "cannot withdraw" sentence is in the SDK example, not in the docs pages searched. The docs text search for it found nothing.

**PV-42.** Hyperliquid data and limits: prices and order books come free through a public REST "info" endpoint and a WebSocket, with no account (this session read them). Rate limit is a weight of 1,200 per minute per internet address for REST. There is a test network at api.hyperliquid-testnet.xyz. Oracle and mark prices update about every 3 seconds.
Page: Hyperliquid Docs, "Rate limits and user limits", "API", "Robust price indices".
URL: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "REST requests share an aggregated weight limit of 1200 per minute."
Also on the pages: "You can make the same requests against testnet using the corresponding url (https://api.hyperliquid-testnet.xyz)". "mark and oracle price are updated approximately once every 3 seconds."

**PV-43.** Hyperliquid's own interface terms could not be read (the terms page needs JavaScript). The only U.S. statement found in Hyperliquid's own docs is in a different context (a validator program) and lists "the U.S." as a restricted jurisdiction. A third-party guide says U.S. persons are "Restricted Persons" under the interface terms and that geofencing enforces it. So the Hyperliquid interface clause is not verified word for word (see "Needs browser").
Page: Hyperliquid Docs (Foundation delegation program eligibility), and Datawallet, "Is Hyperliquid Available in the US? (2026)" as summarized by the search tool.
URL: https://hyperliquid.gitbook.io/hyperliquid-docs/llms-full.txt and https://www.datawallet.com/crypto/is-hyperliquid-available-in-the-usa
Accessed: 2026-10-09. Strength: A for the docs sentence (which is about validators, not traders). C for the guide.
Quote, verbatim (curl, docs): "You must not be from a restricted jurisdiction, which includes, but is not limited to, Ontario, the U.S., Cuba, Iran, Myanmar, North Korea, Syria, and certain Russian-occupied regions of Ukraine."


#### Q4. Liquid (liquid.trade, LiquidX AI, Inc.) as a front end

**PV-44.** U.S. ELIGIBILITY, LIQUID: Liquid's Terms of Service still do not name the United States as a restricted place. The only residence clause lists sanctioned countries. But three other clauses matter: third-party venue rules govern eligibility, hiding location with a VPN is banned, and "evasion of eligibility restrictions" of any connected venue is banned. Since trade.xyz (PV-37), Ostium and Lighter (below) each restrict U.S. persons in their own terms, Liquid's silence is not a permission. Whether Liquid's app geo-blocks U.S. users in practice was not tested (no account was made).
Page: Liquid, "Terms of Service", "Last updated: 09/17/2026".
URL: https://www.liquid.trade/termsofservice
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl), the nearest clause: "You are not a resident, national, or agent of the Crimea region, Cuba, Iran, North Korea, Syria, or any other country to which the United States, the United Kingdom, or the European Union embargoes goods or imposes similar sanctions."
Also on the page: "any account, membership, eligibility determination, KYC review, order acceptance, trade execution, clearing, custody, settlement [...] is provided by that third party and governed by that third party's rules and agreements." And: "using technologies such as VPNs or other methods to conceal your location; misrepresenting your residency". And prohibited conduct includes "evasion of eligibility restrictions, or any activity that violates the rules of any third-party venue, designated contract market, exchange, protocol, or market to which the Services connect". The FAQ says: "Liquid is available globally with the exception of jurisdictions restricted under Liquid's Terms of Service."

**PV-45.** Liquid's terms describe the app as an interface to "the Hyperliquid protocol" and its docs say no identity check is needed to trade with crypto.
Page: Liquid, "Terms of Service" (section "The Services") and Liquid Docs, "Security & Custody".
URL: https://www.liquid.trade/termsofservice and https://docs.tryliquid.xyz/security
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "The App is a visual representation of the underlying smart contracts for the Hyperliquid protocol (the "Protocol") which comprises open-source software deployed in a permissionless manner by the operator or other parties."
Also on the page: "Liquid does not require identity verification to create an account or trade with crypto." "LiquidX AI, Inc. a Delaware C Corporation, operates the Services."

**PV-46.** CONFIRM TAP: in chat clients (Claude, ChatGPT, Grok, Meta Muse, iMessage) every Liquid order needs a manual confirmation. The connector's permission cannot withdraw or transfer money.
Page: Liquid Docs, "Co-Invest in Claude" and "Security & Custody".
URL: https://docs.tryliquid.xyz/co-invest/claude and https://docs.tryliquid.xyz/security
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl of the .md version): "Press **Confirm** or **Cancel**. That is the only way an order reaches the exchange."
Also on the page: "**Cannot:** withdraw or transfer funds out of your wallet, change your account settings, or send an order without your confirmation."

**PV-47.** CO-INVEST COMPUTER: this is Liquid's hands-off mode. It is the same hosted connector used from a coding agent (Claude Code, Codex, Cursor, or Hermes Agent), with three modes: simulation, staged orders (a person releases them), and live orders inside limits the user sets. It runs inside the user's own agent program, on whatever machine that runs on, using the user's own AI model subscription. Liquid charges nothing for it beyond trading fees.
Page: Liquid Docs, "Co-Invest Computer".
URL: https://docs.tryliquid.xyz/co-invest/computer
Accessed: 2026-10-09. Strength: A. Price: published ("Co-Invest Computer is free. Executed trades pay standard Liquid trading fees.").
Quote, verbatim (curl of the .md version): "it is designed for code-agent clients that run loops, schedules, and multi-step plans on your behalf, so the agent executes within the limits you configure instead of asking you before every order."
Also on the page, the limits: "Maximum notional per order and per day", "Maximum multiplier", "Stop-loss requirement on every position", "Optional symbol allowlist", "Daily order caps", "Expiry for goals and strategies". And: "Co-Invest Computer runs in the MCP client you choose, so model usage stays with that client or provider." And: "Pause automation from your MCP client or revoke access from your Liquid account at any time." Not stated on the page: where the limits are enforced (Liquid's server or the agent), and how long the sign-in lasts before a person must sign in again.

**PV-48.** LIQUID API AND CLIENTS: the connector is a hosted MCP server at https://coinvest.liquid.trade/mcp with browser sign-in (OAuth 2.1) and two scopes, "read" and "trade". Any MCP client can connect, including self-written TypeScript or Python agents. Liquid also says it has a "public REST API" with separate read and trade permissions, but access is by asking in Discord, so its terms, limits and docs are gated.
Page: Liquid Docs, "Developers & Other MCP Clients".
URL: https://docs.tryliquid.xyz/co-invest/developers
Accessed: 2026-10-09. Strength: A. Price: connector free (published). REST API: gated and unverified (access by request in Discord).
Quote, verbatim (curl of the .md version): "Liquid also offers a **public REST API** with API keys or OAuth and separate read and trade permissions for building bots and integrations. Ask in Discord for access."
Also on the page: "**Scopes:** `read` (market data, portfolio, account state) and `trade` (placing and managing orders behind confirmation)." "Sign-in happens in your browser on app.liquid.trade. No API keys to paste." Supported clients named in the docs index: Claude, ChatGPT, Grok, Meta Muse, iMessage, SMS, WhatsApp, Chrome, Cursor, Codex, Gemini CLI, Windsurf, Claude Code.

**PV-49.** LIQUID U.S. STOCK PERPS: the docs name eight examples (TSLA, AAPL, NVDA, GOOGL, MSFT, AMZN, META, PLTR) and say stock perps go up to 20 times, indexes ("such as the S&P 500 and Nasdaq 100") up to 50 times, all tradeable 24/7. No count of U.S. stock markets is published in the docs. Since Liquid routes to Hyperliquid, Lighter and Ostium, its list cannot be larger than theirs combined (inference, not a quote).
Page: Liquid Docs, "Markets You Can Trade".
URL: https://docs.tryliquid.xyz/about-liquid/markets
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl of the .md version): "Trade perpetuals on the largest US companies, including Tesla (TSLA), Apple (AAPL), Nvidia (NVDA), Google (GOOGL), Microsoft (MSFT), Amazon (AMZN), Meta (META), and Palantir (PLTR)."
Also on the page: "Multipliers on stock perps go up to 20x." "All perpetual markets trade 24/7/365".

**PV-50.** LIQUID FEES AND MINIMUMS: Liquid adds 0.05 percent per trade on perps on top of the venue fee. All-in at the lowest tier: 0.095 percent taker, 0.065 percent maker. On Ostium-routed stocks: 5 basis points (0.05 percent) Ostium entry fee plus Liquid's 5 basis points, charged on entry only. On Lighter-routed markets Liquid adds nothing. Withdrawal costs a flat 1 dollar. Minimum collateral: 10 dollars in the app, 15 dollars through Co-Invest. This matches run 1 (T8, T9).
Page: Liquid Docs, "Fees" and "FAQ".
URL: https://docs.tryliquid.xyz/trading/fees and https://docs.tryliquid.xyz/faq
Accessed: 2026-10-09. Strength: A. Price: published.
Quote, verbatim (curl of the .md version): "On **perpetual futures**, Liquid applies a uniform 0.05% fee on executed trades, on top of the venue's base fee."
Also on the page: "**Stocks:** All trades are taker, at 5 bps." "**On all Ostium-routed trades, Liquid adds 5 bps.**" "Liquid does not charge fees on top of Lighter". "Positions start at as little as $10 of collateral in the app and Chrome extension, and $15 through Co-Invest." Open point: the docs do not say whether the 0.095 percent table already includes the doubled HIP-3 rate in PV-40 for stock markets on Hyperliquid.

**PV-51.** LIQUID WALLET AND KEYS: Liquid says the account is a self-custodial wallet signed with passkeys (device biometrics), with sign-in by email, Google, Apple or an existing crypto wallet, and "no seed phrase" for embedded wallets. Money goes in as USDC (card, bank transfer, payment apps, or crypto from many chains) and out as USDC to the user's own address. The docs do not name the embedded wallet provider or say where key material is stored.
Page: Liquid Docs, "Security & Custody" and "Deposits".
URL: https://docs.tryliquid.xyz/security and https://docs.tryliquid.xyz/deposits
Accessed: 2026-10-09. Strength: A (vendor claim).
Quote, verbatim (curl of the .md version): "Your account is a **self-custodial wallet** that only you control. Every trade, transfer, deposit into Earn, and withdrawal is signed from that wallet."
Also on the page: "There is no seed phrase to lose for embedded wallets, and no password to phish." "All deposits land as **USDC**". Liquid also has "Paper Trading" with simulated funds and live prices (docs index).


#### Lighter

**PV-52.** Lighter's terms say its services, which the terms define to include the interface, the protocol and the API, are not available to people who reside in or are located in the United States.
Page: Lighter, "Terms of Service", "Last updated DECEMBER 29, 2025" (operator named as Elliot Technologies, Inc.).
URL: https://lighter.xyz/terms
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "OUR SERVICES WERE NOT DEVELOPED FOR, AND ARE NOT AVAILABLE TO PERSONS OR ENTITIES WHO RESIDE IN, ARE LOCATED IN, ARE INCORPORATED IN [...] THE UNITED STATES OF AMERICA, CANADA, THE UNITED KINGDOM"
Rest of the quoted passage: the omitted words are "OR HAVE A REGISTERED OFFICE OR PRINCIPAL PLACE OF BUSINESS IN".
Also on the page: "These Terms of Service cover our website, Interface, Protocol, API, the LIT Token". A "Prohibited Person" includes one "located in, a resident of, or organized in the United States". No VPN wording was found by text search on this page.

**PV-53.** Lighter lists about 24 single stock perps on U.S. companies (plus ASML and NBIS, U.S.-traded shares of non-U.S. companies, out of scope, and STRC, a preferred share; sorted by ticker against trade.xyz's descriptions in PV-35) and several U.S. index or fund perps (US500, US100, SPY, QQQ, IWM, SOXL; DIA and MAGS are listed but inactive). The docs' market table has 43 "equity" rows in total, but that includes Korean, Chinese and private company names. Live 24 hour volume per U.S. name today ranged from under 1,000 dollars (NOW, ASML) to about 13 million dollars (SNDK). US100 had about 16.5 million, SPY about 8.1 million, US500 about 5.5 million. IWM (a Russell 2000 fund) had about 31,000 dollars.
Page: Lighter Docs, "Market Specifications" (Real World Assets), and Lighter public API `orderBookDetails`. Request: `curl https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails` at 2026-10-09 17:00 UTC, no key.
URL: https://docs.lighter.xyz/llms-full.txt and https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (script output from the docs table): "equity 43 : SKHYNIXUSD SAMSUNGUSD HYUNDAIUSD NVDA TSLA CRCL GOOGL MSTR MSFT AMZN AAPL COIN META INTC HOOD ASML AMD SNDK MU ORCL MRVL CBRS BOT NBIS NOW RKLB DELL IBM"
Rest of the quoted passage: the same row continues "BOT SPCX STRC MINIMAX BYD TENCENT XIAOMI POPMART ZHIPU SMIC CXMT UNITREE SHEIN MRNA STABLECOINX".
Also in the data: index row "SPY QQQ DIA BOTZ MAGS IWM EWY DRAM SOXL US500 US100 H100". Live fields per market: "taker_fee 0.0000", "maker_fee 0.0000", "min_quote_amount 10.000000". Maximum leverage implied by the margin fields: 10 times on most single stocks, 20 times on the largest, up to 50 times on SPY and US500 (this file's arithmetic from `min_initial_margin_fraction`).

**PV-54.** Lighter fees: zero maker and zero taker for "Standard" accounts, which have a 300 millisecond delay on taker orders. Paid account types remove the delay and charge fees.
Page: Lighter Docs, "Trading Fees".
URL: https://docs.lighter.xyz/llms-full.txt
Accessed: 2026-10-09. Strength: A. Price: published.
Quote, verbatim (curl): "Lighter currently charges no maker or taker fees for Standard Accounts, allowing all participants to trade across all markets free of charge."
Also on the page: "Fees: 0 maker / 0 taker", "Taker latency: 300ms", "Sub-accounts: create up to 4".

**PV-55.** Lighter stock perps trade 24/7. Prices come from outside oracle feeds (Chainlink, Pyth, Stork and other exchanges) when available and from internal pricing when the feed is stale. On 2026-07-10 Lighter removed the price caps for its main U.S. stock and index markets, so weekend prices there are no longer bounded to the last outside price.
Page: Lighter Docs, "Real World Assets (RWAs)" and "RWA Pricing Mechanism".
URL: https://docs.lighter.xyz/llms-full.txt
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "RWAs are tradeable 24/7 and include commodities, equities, and fixed income markets."
Also on the page: "External oracle feeds are the primary price source. When oracle data becomes stale, the pricing mechanism shifts". "Price Cap Removal (2026-07-10) On the following markets there will be no price caps based on on the last oracle price: SPY, US500, QQQ, US100, XAU, XAG, NVDA, TSLA, AAPL, AMZN, MSFT, GOOGL, META". "Leverage does not change outside trading hours. [...] However, price volatility may increase at market open."

**PV-56.** KEYS, LIGHTER: Lighter API keys can trade, and can also withdraw, but a key-only ("secure") withdrawal can only go back to the wallet address that created the account. Sending money anywhere else needs the main wallet's signature. So a stolen API key cannot send funds to a stranger, by the docs' account. Auth tokens last at most 8 hours and are made from the key by software.
Page: Lighter API Docs, "API keys" (updated 2026-09-29).
URL: https://apidocs.lighter.xyz/docs/api-keys
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl of the .md version): "Secure withdrawals only need the API key because they can only go back to the L1 address that created the account. Fast withdrawals and transfers can go to other L1 addresses, so they also need a signature [...]"
Rest of the quoted passage: "from the wallet's private key."
Also on the page: "Can do: Trade, cancel, modify, leverage/margin, sub-accounts, secure withdrawals, same-owner transfers". "Cannot do alone: Transfers to another L1 owner, fast withdrawals, approving an integrator with fees". Lighter has public REST and WebSocket market data ("Markets, order books, trades, candles and prices over REST and WebSocket"), a testnet ("mainnet and testnet" in the environments page title), and Go and Python software kits. Lighter runs on "a Layer 2 Ethereum blockchain" (terms).

#### Ostium

**PV-57.** Ostium bars U.S. persons in both its FAQ and its Terms of Use, with "no exceptions", and bans VPN use to get around it. Its terms cover the app, the bot, the API and other tooling.
Page: Ostium Docs, "Terms of Use" and FAQ "Who can use Ostium?".
URL: https://docs.ostium.com/legal/terms-of-use and https://docs.ostium.com/llms-full.txt
Accessed: 2026-10-09. Strength: A. No "last updated" date was found in the text read.
Quote, verbatim (curl): "USE OF A VIRTUAL PRIVATE NETWORK ("VPN") OR ANY SIMILAR TOOL TO ATTEMPT TO OR TO CIRCUMVENT THE RESTRICTIONS SET FORTH HEREIN IS STRICTLY PROHIBITED."
Also on the page: "NOT PERMITTED BY PERSONS OR ENTITIES WHO RESIDE IN, ARE LOCATED IN, ARE INCORPORATED IN, HAVE A REGISTERED OFFICE IN, OR HAVE THEIR PRINCIPAL PLACE OF BUSINESS IN CERTAIN JURISDICTIONS, INCLUDING THE UNITED STATES OF AMERICA". "THERE ARE NO EXCEPTIONS". FAQ: "Anyone with a compatible wallet and USDC on Arbitrum can trade on Ostium, except in restricted jurisdictions: the United States, the United Kingdom, the European Union, the Philippines".

**PV-58.** Ostium lists 35 U.S.-listed stocks (another docs page says 33) and U.S. indexes US500, US100 and US30. Unlike Hyperliquid and Lighter, Ostium's stock markets are open only during regular U.S. market hours. Outside them, market orders are rejected. High leverage stock positions are force-closed at 3:45 p.m. Eastern each day.
Page: Ostium Docs, "Stocks" (market list) and "Stocks: Day Trading".
URL: https://docs.ostium.com/llms-full.txt (page source https://docs.ostium.com/traders/trading/stocks-day-trading)
Accessed: 2026-10-09. Strength: A. Price: published (6 basis points opening fee on stocks in Ostium's docs; Liquid's docs say 5, see "Contradictions").
Quote, verbatim (curl, dashes replaced): "35 US-listed equities with leverage up to 100x and 6 bps opening fees. All use Bid/Ask execution. Rollover fees apply (SOFR-based). Market hours: Monday to Friday, 9:30 AM to 4:00 PM ET."
Also on the page: "Outside hours, limit and stop orders queue; market orders are rejected." "At **3:45 PM ET** (15 minutes before market close), all positions with leverage above the overnight cap are automatically closed". "Overnight leverage: a lower cap per stock (typically 5x to 20x)" (dash replaced). Markets summary: "Stocks: AAPL, TSLA, NVDA, MSFT, and 29 more (33 total)". Indices: "US500/USD, US100/USD, US30/USD".

**PV-59.** Ostium custody and automation: trades settle in USDC on the Arbitrum blockchain from the user's own wallet. There is a public price API with no sign-in, a TypeScript software kit, a test network (Arbitrum Sepolia), and a "delegate" key that lets a program place trades while "users keep custody". The docs read did not state in one sentence that a delegate cannot withdraw (see "Not verified"). Each market has a minimum leverage set by its group (the example shows 1).
Page: Ostium Docs, "Builder API overview", "Getting keys from the App", SDK modes.
URL: https://docs.ostium.com/llms-full.txt
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "apps that want users to keep custody while your backend handles execution"
Also on the page: "**None required today.**" (authentication for the price API). "it generates a fresh delegate private key locally in the browser". "Rate limit: 100 requests per 10 seconds per IP." Error codes include "MARKET_CLOSED", "DAY_TRADING_CLOSED" and "LEVERAGE_BELOW_MIN".


#### Other offshore venues (search level only)

**PV-60.** Other venues named in the brief were not opened one by one. Search results say: Binance and Hyperliquid together held most "real-world-asset" perp volume in May 2026 (Binance 55.7 percent, Hyperliquid 28.9 percent, per Datawallet); Bitget ran a vendor study of 36 stock perp markets; Aster and edgeX each list "150+" markets in total (equity counts not given); Coinbase's stock perps are non-U.S. only (PV-31); and a Crypto.com research note says U.S. traders "are often geo-blocked from the most liquid stock perp platforms". No restriction clause was read for Aster, edgeX, dYdX, GMX, gTrade, Avantis, Drift, Jupiter, Vest, Bybit, Binance, Bitget, OKX, Kraken's non-U.S. products, Backpack or Paradex. See "Not verified".
Page: search tool summary of Datawallet, "Best Decentralized Perpetual Exchanges in 2026" and "Crypto Perpetual Futures Statistics & Trends in 2026"; Crypto.com Research, "Equity and Commodity Perpetuals" (January 2026); Crypto Daily, "5 Best Crypto Exchanges for Trading U.S. Stock Perpetual Futures in 2026".
URL: https://www.datawallet.com/crypto/crypto-perpetual-futures-statistics and https://crypto.com/us/research/equity-commodity-perps-jan-2026
Accessed: 2026-10-09. Strength: C (comparison sites, read through the search tool's summary).
Quote, paraphrase by search tool: "US-based traders are often geo-blocked from the most liquid stock perp platforms."

### Q5. Risks that bear on choosing a stack

**PV-61.** OSTIUM EXPLOIT AND HALT, July 2026: an attacker used a compromised oracle signer key to feed false prices into Ostium and drained about 18 million dollars (other estimates 22 to 24 million) from its liquidity vault. Ostium paused all trading. A headline says trading was to reopen on 2026-07-23 with positions marked to the live price. Liquid routes some stock orders to Ostium (PV-50), so this is a documented outage of one of its three venues.
Page: Decrypt, "Another DeFi Exploit: Perp DEX Ostium Loses $18 Million in Oracle Attack", 2026-07-15. The Defiant tag page headline "Ostium to Reopen Trading July 23 After $23.8M Vault Exploit" (search tool summary).
URL: https://decrypt.co/373566/defi-exploit-ostium-oracle-hack and https://thedefiant.io/tag/ostium
Accessed: 2026-10-09. Strength: B.
Quote, paraphrase by fetch tool: Ostium wrote: "We have paused all trading. The team is investigating."
Also on the page: "Attackers used a compromised oracle signer key to submit falsified future-dated price reports." Reimbursement and actual reopening were not confirmed (see "Not verified").

**PV-62.** TRADE.XYZ FLASH CRASH, July 2026: the SK Hynix perp (ticker SKHX, a Korean stock, out of scope but on the same deployer and price system as the U.S. stock perps) "briefly sank" and recovered "within roughly two minutes" during the Korean pre-market. The cause was not established at the time of the article and no compensation was reported. A HIP-3 mispricing sits with the deployer's price inputs, not the base chain.
Page: CryptoSlate, "Inside the brutal 2-minute flash crash sending a $400M South Korean market plunging on Hyperliquid", 2026-07-28.
URL: https://cryptoslate.com/inside-the-brutal-2-minute-flash-crash-sending-a-400m-south-korean-market-plunging-on-hyperliquid/
Accessed: 2026-10-09. Strength: B.
Quote, paraphrase by fetch tool: the price "briefly sank to $927 during South Korea's pre-market window" and recovered "within roughly two minutes."
Also: Galaxy put trade.xyz at about 98 percent of HIP-3 builder-market volume on 2026-07-31 (search tool summary of a commentary, strength D), which matches today's live split in PV-34 to PV-36.

**PV-63.** LIGHTER OUTAGE, October 2025: Lighter was down for about 4.5 hours during the 2025-10-10 market crash, users could not manage positions, and Lighter said it would repay over 2,000 affected users. This was on crypto perps, before most stock perps existed, but it is the same system.
Page: AMBCrypto, "Lighter DEX to repay users in stablecoins after major outage: Details", and The Defiant, "Lighter Distributes Points to Users Affected by Platform Outage" (search tool summary).
URL: https://ambcrypto.com/lighter-dex-to-repay-users-in-stablecoins-after-major-outage-details/
Accessed: 2026-10-09. Strength: B and C, read through the search tool's summary.
Quote, paraphrase by search tool: "repayment for over 2000 users who were impacted by the 4.5-hour downtime on the 10th of October."

**PV-64.** LIQUIDATION AT LOW LEVERAGE, HYPERLIQUID: maintenance margin is half the initial margin at a market's maximum leverage. For a stock perp with 10 times maximum, that is 5 percent. A long with no borrowing (1 times, collateral equal to position size) would therefore be liquidated only after a fall of roughly 95 percent or more (this file's arithmetic from the quoted rule, ignoring fees and funding; if the 5 percent is measured on the position's current value and not its entry value, the fall needed is larger still). Minimum order value is 10 dollars.
Page: Hyperliquid Docs, "Contract specifications" and "Exchange endpoint".
URL: https://hyperliquid.gitbook.io/hyperliquid-docs/llms-full.txt
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "Maintenance margin is half of the initial margin at max leverage. E.g., if max leverage is 20x, the maintenance margin is 2.5%."
Also on the page: "Order must have minimum value of $10."

**PV-65.** FUNDING ON LONGS: on Hyperliquid funding is paid hourly and has a fixed interest part that longs pay to shorts, stated for crypto perps as 0.01 percent per 8 hours, "11.6% APR paid to short", plus a premium part that can go either way. So holding a long has a carrying cost even at 1 times. The xyz deployer sets its own funding parameters per market (the live data shows custom funding multipliers on all 129 xyz assets and custom interest rates on 4), so the rate on a given stock perp must be read per market. On Kalshi's US500, funding is daily. On Ostium, stocks pay a "rollover" fee based on SOFR (a U.S. interest rate benchmark).
Page: Hyperliquid Docs, "Funding". Hyperliquid info endpoint `perpDexs` (PV-34). PV-25 and PV-58 for the other two.
URL: https://hyperliquid.gitbook.io/hyperliquid-docs/llms-full.txt
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "interest rate component is predetermined at 0.01% every 8 hours, which is 0.00125% every hour, or 11.6% APR paid to short."

**PV-66.** AUTO-DELEVERAGING AND DEPLOYER POWERS, HYPERLIQUID: if losing positions cannot be covered, winning positions on the other side are closed at the previous mark price, ranked by profit and leverage. Each builder-deployed exchange has its own backstop that "falls back to ADL". A deployer can also halt a market and settle all positions at the mark price.
Page: Hyperliquid Docs, "Auto-deleveraging" and "HIP-3: Builder-deployed perpetuals".
URL: https://hyperliquid.gitbook.io/hyperliquid-docs/llms-full.txt
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "The deployer may settle an asset using the `haltTrading` action. This cancels all orders and settles positions to the current mark price."
Also on the page: "the users on the opposite side of the position are ranked by unrealized pnl and leverage used." "Each DEX's onchain backstop liquidator is an independent user and falls back to ADL to mathematically guarantee solvency of the DEX."

**PV-67.** WEEKEND PRICE GAPS: on trade.xyz the weekend price is set by the venue's own order book inside a band (PV-38), and a position whose liquidation price lies outside the band "cannot be liquidated while those bounds are in effect". On Lighter the band was removed for the main U.S. names in July 2026 (PV-55). On Ostium stock markets are simply closed (PV-58). On Kalshi US500 the contract "trades against the last published index level" outside stock hours and is shut from Friday 5 p.m. to Sunday 6 p.m. Eastern (PV-25). The Monday reopening gap risk therefore differs by venue.
Page: see PV-25, PV-38, PV-55, PV-58.
URL: (as cited in those findings)
Accessed: 2026-10-09. Strength: A for PV-38, PV-55, PV-58. B for PV-25.
Quote: (see the quotes in those findings; this entry only puts them side by side).


**PV-68.** HYPERLIQUID CUSTODY AND CONNECTORS: money sits in the user's own wallet address on Hyperliquid's own chain, funded mainly by sending USDC from the Arbitrum blockchain through Hyperliquid's bridge (minimum 5 USDC, smaller amounts are "lost forever"). Withdrawal needs the main wallet's signature. No MCP server or AI connector from Hyperliquid itself appears in its docs (text search for "MCP" found nothing). Lighter's API docs offer AI-readable docs and a ready-made agent instruction file, which is documentation help, not a trading connector. Kalshi's and Ostium's doc indexes show no MCP server either. Among the venues read, only Liquid (a front end) ships its own MCP connector (PV-48).
Page: Hyperliquid Docs, "How to start trading" and "Bridge2". Lighter API Docs index. Kalshi and Ostium doc indexes.
URL: https://hyperliquid.gitbook.io/hyperliquid-docs/llms-full.txt, https://apidocs.lighter.xyz/llms.txt, https://docs.kalshi.com/llms.txt, https://docs.ostium.com/llms.txt
Accessed: 2026-10-09. Strength: A for what the docs say. The absence of an MCP server is a text-search negative on the docs only.
Quote, verbatim (curl): "The minimum deposit amount is 5 USDC. If you send an amount less than this, it will not be credited and be lost forever."
Also on the page: "The withdrawal flow requires a user wallet signature on Hyperliquid only, and no Arbitrum transaction." Lighter: "A ready-to-paste AGENTS.md / CLAUDE.md / Cursor rule that teaches coding agents how to integrate Lighter correctly."

**PV-69.** LIQUID PAGES REOPENED: the three liquid.trade Co-Invest pages were read again today. None mentions the United States or any eligibility rule. They confirm run 1 (T5, T9) and add three things: "Co-Invest Computer" has its own connector address, https://coinvest-computer.liquid.trade/mcp. The Grok client uses that hands-off mode by default. And money posted to a venue is subject to that venue's rules, not Liquid's.
Page: Liquid, "AI Trading in ChatGPT, Claude, Grok, and Meta Muse, Liquid Co-Invest" (dash replaced); "Co-Invest Docs, Setup, MCP Tools, and Trading" (dash replaced); "Liquid Co-Invest Computer, Automated Trading MCP" (dash replaced).
URL: https://www.liquid.trade/coinvest , https://www.liquid.trade/coinvest-docs , https://www.liquid.trade/coinvest-computer
Accessed: 2026-10-09. Strength: A.
Quote, verbatim (curl): "Co-Invest Computer can instead simulate, stage, or send live orders within configured limits."
Also on the pages: "collateral committed to an underlying venue remains subject to that venue's margin and withdrawal rules." "Neither connection can withdraw or transfer funds on its own." "Grok Bot uses Co-Invest Computer". "it can't transfer money out, change your account settings, or send a single order without you tapping Confirm." "You can pause the loop, let it expire, or take back manual control anytime." Still not stated on any of the three: where the limits are enforced, how long a sign-in lasts, or any U.S. position.

**PV-70.** OSTIUM LIQUIDITY: Ostium's public pairs data shows very little money in its U.S. equity markets today: about 0.97 million dollars of open interest on its S&P 500 market, about 0.46 million on NVDA, and under 0.1 million on each of GOOG, AMZN, MSTR, NDX, MSFT, COIN, AAPL, TSLA and META. Every equity pair read shows a minimum leverage of 1.
Page: Ostium Builder API, pairs list (public, no sign-in). Request: `curl https://builder.prod.bedrock.ostium.io/v1/pairs` at 2026-10-09 17:09 UTC.
URL: https://builder.prod.bedrock.ostium.io/v1/pairs
Accessed: 2026-10-09. Strength: A for the raw fields. The dollar figures are this file's arithmetic (long plus short units, times last trade price).
Quote, verbatim (script output from the JSON): "SPX OI$0.97M maxLev 100 minLev 1 open 106; [...] NVDA OI$0.46M maxLev 100 minLev 1 open 25"
Also in the data: 83 pairs in total. "open" is the count of open trades (106 on SPX, 25 on NVDA, 8 on AAPL).

**PV-71.** KRAKEN (PAYWARD), PLAN ONLY: Kraken's parent announced on 2026-09-16 a plan to offer Hyperliquid builder-deployed perps to U.S. clients through its CFTC-regulated exchange Bitnomial, with NinjaTrader Clearing (a registered futures broker) holding client accounts. It is pending regulatory approval with no launch date, equities are not part of that plan, and it would not open Hyperliquid's existing markets to U.S. clients. Access would be through a broker account, not a crypto wallet.
Page: CoinMarketCap Academy, "Kraken's Parent Plans US Hyperliquid Perps: Will They Feel On-Chain?" (undated on the page, early October 2026 by its own data references).
URL: https://coinmarketcap.com/academy/en/article/kraken-payward-us-hyperliquid-perps-onchain
Accessed: 2026-10-09. Strength: C.
Quote, paraphrase by fetch tool: "Only accounts onboarded by NinjaTrader and on both firms' allowlists could trade."

## 2. Summary tables

### (a) The legal position

| Question | What the sources say | Strongest source | Settled or not |
| :---- | :---- | :---- | :---- |
| What is a perp on one U.S. stock, in law? | Two candidate labels. If it is a "swap", it is a "security-based swap" (PV-01). If it is a "future", it is a "security future" (PV-02). The SEC and CFTC asked the public in June 2026 whether such a perp "could be treated as a security future" (PV-19). CME is suing over whether perps are swaps or futures, with no ruling yet (PV-15). | Statute (PV-01, PV-02), joint release (PV-19) | NOT settled which label applies |
| May a small individual trade a security-based swap? | Unlawful to effect one "with or for" a non-ECP except on a registered national securities exchange (PV-03), and unlawful to offer or sell one to a non-ECP without a registration statement (PV-04). SEC staff restated this for onchain tokens in January 2026 (PV-21). | Statute (PV-03, PV-04) | Settled text |
| Is a person with 10,000 to 25,000 dollars an ECP? | No. An individual needs more than 10 million dollars invested on a discretionary basis (5 million if hedging) (PV-05). | Statute (PV-05) | Settled text |
| Is a single stock perp available on a U.S. exchange today? | Not yet. Kalshi, Coinbase Derivatives, Bitnomial and Nadex filed in September 2026 to list them as "security futures". The SEC notices say the CFTC had not yet approved. Kalshi's states an effective date of 2026-11-02 "or such later date" (PV-13, PV-14, PV-16, PV-17, PV-18). | SEC notices in the Federal Register | Pending, not live |
| What about a perp on a broad U.S. index? | Treated by the CFTC as a futures contract on a designated contract market. Kalshi's US500 perp is live for approved U.S. users since 2026-10-06 (PV-11, PV-12, PV-24, PV-25, PV-27). Coinbase Derivatives also lists perpetual-style broad index futures with open interest, but who may trade them was not verified (PV-11, PV-30). If instead a broad index perp is a "swap", a non-ECP may enter it only on a designated contract market (PV-06). | CFTC Letter 26-29 (PV-11), Kalshi's own market list (PV-24) | Available on a U.S. exchange now. The swap versus future label is still in litigation (PV-15) |
| Does the answer differ for single stock versus broad index? | Yes. Single stocks and narrow indexes (nine or fewer names, or top-heavy) are under the SEC or both agencies (PV-01, PV-02, PV-09). Broad indexes are under the CFTC (PV-06, PV-11). The CFTC's own letter 26-29 covers broad indexes only (PV-11). | Statute, CFTC policy statement (PV-09) | Settled that they differ |
| Is there an exemption that opens offshore or onchain equity perps to U.S. retail? | None found. The SEC's September 2026 "innovation" order covers tokenized real shares on permissioned venues and expressly excludes "a tokenized security-based swap" (PV-20). The CFTC's May 2026 policy sends equity perps to case-by-case review (PV-09). | SEC order (PV-20) | No exemption found |
| Did Congress change this? | No law passed. The CLARITY Act failed a Senate procedural vote on 2026-09-15 by report (PV-08). | Law firm alert via search summary (PV-08) | No change, B strength only |
| Any 2024 to 2026 enforcement on equity perps for U.S. retail? | None found in two searches. The on-point precedent is Abra (2020), where the company was charged, not users (PV-22). | SEC press release (PV-22) | Absence not proven |
| What do the offshore venues themselves say? | trade.xyz, Lighter and Ostium each bar U.S. residents in their own terms, and trade.xyz and Ostium ban VPN workarounds (PV-37, PV-52, PV-57). Liquid's terms are silent on the U.S. but defer to venue rules and ban VPNs and "evasion of eligibility restrictions" (PV-44). | Venue terms | Settled as to the terms |

Plain statement of the evidence, without interpretation beyond the text: on the sources read today, the only place a U.S. resident with 10,000 to 25,000 dollars is shown as permitted to trade an equity-tracking perp is a CFTC designated contract market, and the products found live there are Kalshi's US500 index perp (retail access confirmed, PV-27) and Coinbase Derivatives' perpetual-style broad index futures (existence confirmed by the CFTC, retail access not verified, PV-30). Single stock perps on U.S. exchanges are filed and pending. Every offshore or onchain venue whose terms were read excludes U.S. residents, and the statute text in PV-03, PV-04 and PV-06 is written against trading such contracts with non-ECPs off a U.S. exchange. Whether an individual user (as opposed to a venue) faces liability is a legal question this file does not answer.

### (b) Venues

| Venue | Regulated in U.S.? | U.S. residents | U.S. equity perps today | Hours | Price source | Leverage, 1x possible? | Fees | Custody | Automation and keys | MCP | Liquidity |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Kalshi (KalshiEX, Kalshi Prime, Kalshi Klear) | Yes, CFTC designated contract market, futures broker and clearing house (PV-13, PV-27) | Allowed, after identity check and margin account approval (PV-27) | 1 live index perp: US500 (MerQube US Large Cap, not the S&P 500). US Tech 100 listed but inactive. 0 single stocks live; about 60 in the test system; filing pending (PV-13, PV-24, PV-26) | Sunday 6 p.m. to Friday 5 p.m. Eastern (PV-25). Not weekends | MerQube index, last level outside stock hours (PV-25) | About 13.7 times maximum on US500 (PV-24). Lower leverage is the user's choice of margin; a 1x setting was not confirmed | Percent of position size, maker and taker tiers. Rates gated and unverified (PV-29) | Dollars held by Kalshi Prime in a customer segregated account. No crypto wallet (PV-27) | Perps API exists (REST, WebSocket, FIX, demo system, key pairs). Retail access through Kalshi Prime NOT verified. Production rolling out member by member. Trade-only key scope not confirmed (PV-28) | None found (PV-68) | US500: about 7.7 million dollars a day, 1.4 million open interest (PV-24) |
| Coinbase Derivatives (U.S.) | Yes, CFTC designated contract market (PV-11, PV-17) | Index products reported as institutional first (PV-30). Single stock perps pending (PV-17) | Perpetual-style broad index futures exist with open interest, per the CFTC (PV-11). Names (thematic indexes, a US500) by press only (PV-30) | Not verified | Not verified | Up to 20 times on US500 by press (PV-30) | Gated and unverified | Not verified | Not verified | Not verified | Not verified |
| Hyperliquid, xyz deployer (trade.xyz) | No | Barred by trade.xyz terms, VPN ban (PV-37). Hyperliquid's own interface terms not read (PV-43) | 59 U.S.-listed common stocks by the venue's own descriptions, 10 U.S.-traded shares of non-U.S. companies (out of scope), SP500 and XYZ100 index perps, and 17 fund or preferred perps (PV-35) | 24/7 (PV-38) | Outside prices 24 hours, 5 days. Own order book inside a band on weekends (PV-38) | Stocks 10 or 20 times max, indexes 30 to 50. Liquidation math in PV-64 implies 1x is workable. Minimum order 10 dollars | 0.09 percent taker, 0.03 percent maker at lowest tier unless growth mode (PV-40). Hourly funding (PV-65) | Own wallet on Hyperliquid chain, USDC via Arbitrum bridge (PV-39, PV-68) | Free public REST and WebSocket, testnet, agent wallets that cannot withdraw, 180 day maximum expiry (PV-41, PV-42) | None from Hyperliquid (PV-68) | xyz total about 2.6 billion dollars a day, 3.6 billion open interest. NVDA about 119 million a day (PV-35) |
| Hyperliquid, other deployers (mkts, para, io) | No | Not read per deployer | mkts: US500, USTECH, SMALL2000. para: about 20 stock tickers. io: 4 stock tickers (PV-36) | Not read | Not read | 10 to 25 times max (PV-36) | Hyperliquid HIP-3 schedule (PV-40) | Same as above | Same as above | None | Thin: 6 to 62 million dollars a day per deployer (PV-36) |
| Lighter | No | Barred by terms, which cover the API and protocol (PV-52) | About 24 single stocks on U.S. companies. US500, US100, SPY, QQQ, IWM, SOXL (PV-53) | 24/7 (PV-55) | Chainlink, Pyth, Stork and others; internal pricing when stale; caps removed July 2026 (PV-55) | 10 to 20 times on stocks, up to 50 on SPY and US500 (PV-53). 1x not confirmed in docs read | Zero for Standard accounts, with a 300 millisecond taker delay (PV-54) | Own wallet on an Ethereum layer 2 (PV-52, PV-56) | REST, WebSocket, testnet, API keys that can trade and can withdraw only back to the creating wallet (PV-56) | None. AI-readable docs only (PV-68) | Per name about 1,000 dollars to 13 million dollars a day (PV-53) |
| Ostium | No | Barred, "no exceptions", VPN ban (PV-57) | 35 (or 33) stocks. US500, US100, US30 (PV-58) | Stocks only Monday to Friday 9:30 a.m. to 4:00 p.m. Eastern (PV-58) | Own price feed with signer keys (exploited July 2026, PV-61) | Up to 100 times intraday, overnight cap 5 to 20 times. Minimum leverage 1 on every equity pair read (PV-58, PV-70) | 6 basis points to open on stocks, plus rollover (PV-58) | Own wallet, USDC on Arbitrum (PV-57, PV-59) | Public price API, TypeScript kit, testnet, delegate key. Delegate withdrawal limits not confirmed (PV-59) | None found (PV-68) | Tiny: about 1 million dollars of open interest on its S&P 500 market, under 0.5 million on NVDA (PV-70) |
| Liquid (front end to the three above) | No. Says it is not an exchange or broker (run 1, T7) | Terms silent on the U.S., defer to venue rules, ban VPNs (PV-44) | Eight examples named, count not published (PV-49) | Says 24/7/365 (PV-49) | The routed venue's | Stocks up to 20 times (PV-49). Minimum 10 or 15 dollars collateral (PV-50) | 0.05 percent on top of venue. 0.095 taker, 0.065 maker all-in at lowest tier. Adds nothing on Lighter (PV-50) | Self-custodial wallet with passkeys, USDC (PV-51) | Hosted MCP with read and trade scopes. Confirm tap in chat. "Co-Invest Computer" trades inside set limits. REST API by request (PV-46, PV-47, PV-48) | Yes, its own (PV-48) | Not published |
| Coinbase International, Binance, Bybit, Bitget, OKX, Aster, edgeX and others | No | Coinbase's stock perps are non-U.S. only (PV-31). Others not read (PV-60) | Not counted | Not read | Not read | Not read | Not read | Not read | Not read | Not read | Binance reported as the largest by share (PV-60) |

### (c) Coverage of the six indexes

Index membership of individual tickers was NOT checked against index provider lists in this session. The table below is a reading of ticker symbols and venue descriptions. It is a guess where marked, and each venue's market list checked against an index constituent file would turn it into a measurement.

| Venue | Dow 30 | Nasdaq 100 | NASDAQ Composite | NYSE Composite | S&P 500 | Russell 2000 |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Kalshi (live) | No single names. No index perp | No single names. US Tech 100 perp listed, inactive (PV-24) | None | None | US500 perp on a look-alike index of the 500 largest U.S. companies (PV-25) | None live. US2000 exists only in the test system (PV-26) |
| Hyperliquid xyz | A handful of members by ticker (for example AAPL, MSFT, NVDA, AMZN, IBM, CVX), guess. No index perp | Most of the large members by ticker, guess. XYZ100 perp tracks "100 large, non-financial companies" (PV-39) | Partial, the Nasdaq-listed names among 59 | Partial, the NYSE-listed names among 59 | SP500 perp, described as officially licensed (PV-39). Many of the 59 single names are large S&P 500 members, guess | A few smaller names by ticker (for example AAOI, BIRD, TWST), membership not verified. No index perp on xyz |
| Hyperliquid mkts, para | None | USTECH perp (PV-36) | A few names | A few names | US500 perp (PV-36) | SMALL2000 perp, about 0.4 million dollars a day (PV-36) |
| Lighter | A handful by ticker. DIA fund perp listed but inactive (PV-53) | Large members by ticker. US100 and QQQ perps | Partial, about 24 names in total | Partial | US500 and SPY perps. Large members by ticker | IWM fund perp, about 31,000 dollars a day (PV-53). Single names: RKLB at most, membership not verified |
| Ostium | US30 perp. Some members among 35 stocks | US100 perp. Some members | Partial | Partial | US500 perp | None found |
| Liquid | Whatever the three venues above list (inference) | Same | Same | Same | Same | Same |

Summary in one line: across every venue read, single stock coverage is at most about 60 names, concentrated in very large technology and well-known companies. Nothing comes close to "as many names as possible" across the Nasdaq Composite, NYSE Composite or Russell 2000. Small company exposure exists only as thin index or fund perps (SMALL2000, IWM).

## 3. Not verified

1. Whether any U.S. exchange has actually launched a single stock perp since the SEC notices. Tried: Federal Register search, Kalshi's live market list (none in production), press searches. The filings were pending as of the notices dated 2026-09-23 to 2026-10-02.
2. Whether a retail customer of Kalshi Prime can get a perps API key and run software against a live account. Tried: Kalshi's full API docs export (no mention of "Kalshi Prime" or "retail"; endpoints speak of "Direct" members and futures-broker "subtraders") and three help articles. This is the top open item, because Kalshi is the only U.S. route confirmed open to retail (PV-28).
3. Hyperliquid's own interface Terms of Use (restricted persons, VPN, API). Tried: app.hyperliquid.xyz/terms (JavaScript shell), hyperliquid.xyz/terms (403), docs text search. Only a third-party guide and an unrelated docs clause were found (PV-43).
4. Whether any of Hyperliquid, Lighter or Ostium geo-block the website while leaving the API or chain open. No venue doc read says so in those words. Lighter's and Ostium's terms explicitly extend the U.S. bar to the API (PV-52, PV-57). trade.xyz's terms govern "the website-hosted user interface" (PV-37).
5. Whether Liquid blocks U.S. users at sign-up, on deposit, or not at all. Not tested, because no account or form was allowed.
6. Kalshi perps fee rates (the fee schedule page returned a browser check to curl), and whether a Kalshi API key can be limited to trading without transfers.
7. Coinbase Derivatives' U.S. equity index perpetual-style futures: names, retail access, leverage, fees, hours. Coinbase pages returned a bot check to both tools. The CFTC letter confirms the contracts exist (PV-30).
8. Whether Ostium delegate keys can withdraw, and whether Ostium trading fully resumed and users were made whole after the July 2026 exploit.
9. Where Liquid's "Co-Invest Computer" limits are enforced (server side or in the agent), how long its sign-in lasts, and the terms of Liquid's REST API (access is by request in Discord).
10. The count of U.S. stock perps on Liquid, and which venue each routes to.
11. Which xyz markets have "growth mode" fee cuts on today, and the funding rate actually paid by longs on each stock perp (the per-market funding fields were counted, not read).
12. Index membership of every listed ticker (table c is partly a guess), and what the newer tickers on xyz are (for example SPCX, CBRS, PURRDAT, QNT, SHAZ, BOT, which the venue describes as common stock and Liquid's docs partly describe as "pre-IPO").
13. Restriction clauses and equity perp lists for Aster, edgeX, dYdX, GMX, gTrade, Avantis, Drift, Jupiter, Vest, Bybit, Binance, Bitget, OKX, Kraken non-U.S., Backpack and Paradex. None were opened (PV-60).
14. The CLARITY Act vote from a primary source (congress.gov or senate.gov was not opened), and the cause and aftermath of the trade.xyz SK Hynix price drop.
15. Why the flx, vntl, hyna, km and cash deployers show every market as delisted (PV-34).
16. Whether a strictly 1x, no-borrowing long is selectable on Lighter and Kalshi. Hyperliquid's and Ostium's docs imply it (PV-64, PV-59) but no page states it as a supported "long only, no leverage" mode.

## 4. Needs browser

- https://app.hyperliquid.xyz/terms (JavaScript only). Needed for Hyperliquid's own restricted-person and VPN clause and its date.
- https://www.coinbase.com/blog/coming-june-8-perpetual-style-equity-index-futures and https://www.coinbase.com/derivatives (bot check, "Enable JavaScript and cookies"). Needed for Coinbase Derivatives' U.S. equity index perpetual-style futures: contracts, who may trade, leverage, fees.
- https://kalshi.com/fee-schedule (curl got a "Vercel Security Checkpoint" browser check) and https://kalshi.com/perpetuals/learn/crypto-perpetuals-legal-us (HTTP 429). Needed for Kalshi perps fee rates, the US500 contract page, and above all whether a Kalshi Prime retail account can create a perps API key.
- https://www.hsfkramer.com/insights/2026-09/after-the-clarity-act-fails-to-advance-crypto-securities-law-regulation-is-left-to-the-sec (HTTP 403). Needed to confirm the CLARITY Act vote wording.
- https://www.crowdfundinsider.com/2026/09/311525-kalshi-files-with-sec-and-cftc-to-list-us-single-stock-perpetual-futures/ (HTTP 403). Low priority, the SEC notice covers it.
- https://www.bitbase.com/news/hyperliquid-responds-to-trade-xyz-sk-hynix-pricing-error-what-hip-3-traders-should-learn (HTTP 403). Needed for the trade.xyz incident detail.
- https://app.liquid.trade (a sign-in app, not fetched). Needed to see the live market list, the U.S. stock count, and any geo-block notice shown to a U.S. visitor. The three liquid.trade Co-Invest pages were read with curl (PV-69).

## 5. Contradictions between sources

1. Liquid's terms do not restrict the United States (PV-44), while the three venues it routes to each do (PV-37, PV-52, PV-57). Liquid's terms also say venue rules govern eligibility.
2. Liquid's docs say all perpetual markets, including stocks, trade "24/7/365" (PV-49), while Ostium, one of its routes for stocks, opens stock markets only in regular U.S. hours (PV-58).
3. Ostium's stock opening fee: 6 basis points in Ostium's docs (PV-58), 5 basis points in Liquid's docs (PV-50).
4. Ostium's stock count: "35 US-listed equities" on one Ostium page and "33 total" on two others (PV-58).
5. Kalshi US500 maximum leverage: "15.3x" in press on 2026-10-06 (PV-25), 13.7 on Kalshi's own list today (PV-24). The figure floats.
6. Kalshi's US500 approval date: press says deemed approved 2026-10-02 in one summary and 2026-10-03 in another (PV-12 and search results). CFTC Letter 26-29 itself says 2026-10-02 (PV-11).
7. CFTC Letter 26-29: the letter is dated 2026-10-03, press says relief was granted "Monday" 2026-10-05 (PV-11, PV-12).
8. Coinbase Derivatives' equity index launch date: "June 8" in one Coinbase post title and "June 14" in another (PV-30).
9. Robinhood: one site says stock perps launched, The Block says the announced U.S. perps are crypto only and still to come (PV-32).
10. Ostium exploit size: 18 million (Blockaid), 22 million (CertiK), 23.8 to 24 million (later reports) (PV-61).
11. HIP-3 fees: trade.xyz says HIP-3 markets cost twice the base Hyperliquid rate (PV-40), while Liquid shows one all-in perps table that equals the base rate plus 0.05 percent (PV-50). Which applies to a stock perp bought through Liquid is not stated.
12. One search summary cited a "December 2026 SEC filing". Today is 2026-10-09, so that date is an error in the search tool's summary and was not used.

End of file marker
