# Strategy run 2: trading costs and a cost calculator

Run date: Friday 2026-11-20. Sources accessed: 2026-11-20 unless a source says otherwise.

**Research input for a human decision, never an instruction to act. Nothing here is financial or tax advice.** The figures are what the cited pages said on the access date; vendors and regulators can change them without notice.

The calculator that goes with this file is `strategy/runs/strategy-run-2-calculator.html`. It opens with a double click, sends nothing anywhere and stores nothing.

## 1. Summary

**What the fees are today, per Alpaca's own fee schedule revised 2026-11-17**[^1]

- **SEC fee** (the Securities and Exchange Commission's Section 31 fee): 0.0000206 times the dollar value of shares sold, sells only. That is 20.60 dollars per million dollars sold[^1][^2].
- **FINRA (Financial Industry Regulatory Authority) trading activity fee (TAF)**: 0 dollars per share for trades from 2026-10-01 to 2026-12-31, a three month pause[^1][^4]. It resumes on 2027-01-01 at 0.000195 dollars per share sold, at most 9.79 dollars per trade, and stays at that rate through 2028[^4][^5].
- **CAT fee** (Consolidated Audit Trail): 0.000003 dollars per share, charged on buys and sells[^1].
- **Commissions**: 0 for retail order flow[^1][^11]. Each fee type is totaled per account per day, then rounded up to the next cent[^1].

**Michael's paper fees match the published schedule to the cent**

- 2026-11-18: sells worth 202,780.64 dollars and 26,324 shares bought and sold give SEC 4.18 plus CAT 0.08 = **4.26 dollars**, the amount Michael reported[^43][^44].
- 2026-11-17: Alpaca posted SEC 3.80 plus CAT 0.08 = **3.88 dollars**, the amount Michael reported[^43][^44].
- So on these days paper charged the SEC and CAT fees exactly as the schedule lists them. TAF was 0 on both days, which is also the published rate during FINRA's pause, so these days cannot show whether paper would charge a non-zero TAF.
- From 2027-01-01 a live account pays TAF at 0.000195 dollars a share; what paper does then is not yet observed.

**What matters most at Michael's volume** (2026-11-18: 9,089 filled entries and 26,324 shares bought and sold, including 40 trial shares, so about 1.45 shares sold per filled entry[^43])

- Regulatory fees are small: a few dollars a day (worked example A, section 7).
- **The commission category is the big risk.** At example A's volume, Alpaca Elite's all-in rate of 0.0040 dollars per share on both legs would add 105.43 dollars a day (2 times 9,089 round trips times 1.45 shares times 0.0040), against about 4.27 dollars of regulatory fees.
- **Spread and slippage** (the gap between the price seen and the price filled) are not a published fee and are not sourced here; they are Michael's own input on the page. The paper record shows they can be far larger than the fees (section 6).
- **Fixed costs** are 14.41 to 227.82 dollars a month depending on the number of stacks, the data plan and Claude Max (section 4).

**Retail versus commercial, in one paragraph**

- Alpaca sorts accounts on three separate axes: order flow (retail or non-retail), account type (individual or business), and market data status (non-professional or professional)[^13][^14][^17].
- An account can be moved to "the non-retail line" after a review. Alpaca lists flags including a fill rate under 1 percent of orders, high frequency trading ("creating and canceling orders in a rapid fashion"), and "Trading Professional", meaning trading "as primary means of generating income"[^13]. **Alpaca publishes no commission rate for the non-retail line: not found.**
- A business account (a corporation, LLC (limited liability company) or partnership) is "considered professional data subscribers", per an Alpaca article dated December 2022[^14]. **Alpaca's price for professional market data: not found.**

**How the stack's recorded behavior sits beside Alpaca's flags** (a comparison, not a prediction of what Alpaca would do)

- Order size: about 1.45 shares per filled entry on 2026-11-18 (13,162 shares sold over 9,089 filled entries)[^43], far under the "10,000 shares or over 200,000 dollars" flag[^13].
- Fill rate: 90.1 percent of load entries filled on 2026-11-18 (7,825 of 8,680)[^43], far above the "less than 1%" example[^13].
- Cancels: unfilled load entries are cancelled after 5 seconds, and the load window reached 150 entries a minute[^43]. Alpaca names "creating and canceling orders in a rapid fashion" as a sign of high frequency trading[^13]. Whether this pattern would trigger a review is not stated anywhere: unsettled.

## 2. Every fee and rate

### 2.1 Regulatory fees on stock trades

| Fee | Charged on | How it is calculated | Rate today | From 2027-01-01 | Source |
| :-- | :-- | :-- | :-- | :-- | :-- |
| SEC Section 31 fee | Sells only | Rate times the dollar value sold | 0.0000206 (20.60 dollars per million), since 2026-04-04 | Same until changed (see note) | [^1][^2] |
| FINRA TAF | Sells only | Rate times shares sold, capped per trade | 0 dollars per share (pause, 2026-10-01 to 2026-12-31) | 0.000195 dollars per share, max 9.79 dollars per trade | [^1][^4][^5][^6] |
| CAT fee | Buys and sells | Rate times "executed equivalent shares" (1 share of a listed stock = 1) | 0.000003 dollars per share | Not announced | [^1][^9] |

- **Rounding.** "Each fee type is aggregated separately at the daily, per-account level. After aggregation, each fee total is rounded up to the nearest cent ($0.01)."[^1] The calculator does exactly this.
- **How CAT reaches the customer.** Alpaca: the CAT fee "will be charged per trade and passed on to users and clients", and "CAT fees are deducted from your buying power on purchases and sales proceeds on sales"[^10].
- **Conflict noted.** Alpaca's support article (dated February 2026) says TAF "is applied on a per-trade basis, rounded up to the nearest penny, and capped"[^10]. The fee schedule is newer and more specific, so it is used. The cap is applied per trade, before the daily total.
- **SEC fee timing.** The SEC's advisory says the 20.60 rate "will remain in effect until 60 calendar days after legislation is enacted that sets the amount of the Commission's fiscal year 2027 appropriation"[^2]. No newer Section 31 advisory was listed on 2026-11-20[^3].
- **TAF: why 0 and why 0.000195.** FINRA filed SR-FINRA-2026-021 for immediate effectiveness: the TAF rates "would temporarily be set at $0.00" for October to December 2026, "with TAF assessment resuming on January 1, 2027"[^4]. A companion filing, SR-FINRA-2026-020, "maintains TAF rates at their current levels through December 31, 2028", which is 0.000195 per share with a 9.79 dollar cap[^4][^5].
- **Two FINRA pages disagree with this and were not used for a rate.** The rule text page showed 0.000166 per share (max 8.30) under its "Oct 01, 2026 to Dec 31, 2026" version[^7]. FINRA's Fee Adjustment Schedule still shows 0.000232 (max 11.61) for 2027[^8], a step SR-FINRA-2026-020 moved to 2029[^5].
- **TAF minimum price rule.** "If the execution price for a covered security is less than the Trading Activity Fee rate ... then no fee will be assessed."[^7] Irrelevant for stocks priced above a fraction of a cent.

**Checks against Alpaca's own posted fees** (each from this repo's build log, which records Alpaca's posted amounts)

| Day | Sales value | Shares bought and sold | Formula | Posted by Alpaca |
| :-- | --: | --: | :-- | :-- |
| 2026-11-02 | 27,100.09 | n/a | SEC 27,100.09 x 0.0000206 = 0.558, up to 0.56 | REG (Alpaca's label for the SEC fee) 0.56[^41] |
| 2026-11-03 | about 145,600 | 4,164 | SEC 2.999 up to 3.00; CAT 0.012 up to 0.02 | REG 3.00, CAT 0.02[^45] |
| 2026-11-17 | not in the record read | n/a | n/a | SEC 3.80, CAT 0.08 = 3.88[^43] |
| 2026-11-18 | 202,780.64 | 26,324 | SEC 4.177 up to 4.18; CAT 0.079 up to 0.08 | 4.26, Michael's report[^43][^44] |

### 2.2 Other fees Alpaca passes through on stock trades

- **American Depositary Receipts (ADRs):** "Varies (typically $0.01 to $0.05 per share)"[^1]. Not modeled on the page; a strategy that trades ADRs would pay it.
- **Hard to borrow locate and borrow fees:** apply to short sales only[^1]. The stack is long only, so they do not apply.
- **Margin interest:** 6.50 percent default, 5.00 percent for Elite with 100,000 dollars, "charged on the daily balance"[^1][^16]. Whether a flat-at-the-close account with borrowing cap 1 ever pays it was not evaluated.
- **Exchange fees or rebates:** passed through only on Elite's Cost Plus plan[^1][^16]. Their size depends on where each order executes: not found as a fixed rate.
- Bank wires (15 dollars domestic outbound), ACH (Automated Clearing House) returns (25 dollars) and transfers are not trading costs[^1].

### 2.3 Alpaca's own commissions

| Category | Stock commission | Where it is stated |
| :-- | :-- | :-- |
| Retail order flow | 0 | Pricing page: "Commission-free trading is available to Alpaca's retail customers"[^47]; fee schedule: "Alpaca Securities does not charge commissions, except as described below"[^1]; support: "no commission charges for Alpaca self-directed individual cash brokerage accounts that trade U.S. listed securities through an API" (application programming interface)[^11][^12]; Elite page: "Commission-Free For Retail Investors, $0 Commissions on US listed stocks"[^16] |
| Elite Smart Router, All-in (Fixed) | 0.0040 dollars per share traded, regulatory fees extra | Fee schedule[^1]; Elite page[^16] |
| Elite Smart Router, Cost Plus (Tiered) | 0.0025 (up to 200,000 shares a month), 0.0020, 0.0015, 0.0010, 0.0005 (over 50 million), plus exchange fees or rebates and regulatory fees | Fee schedule[^1]; Elite page[^16] |
| Non-retail line (after review) | **Not found.** The schedule says only that "Commissions apply to ... order flow determined to be non-retail in nature" and that Alpaca "reserves the right to charge additional fees" | Fee schedule[^1]; Customer Agreement section 43 defers all charges to the fee schedule[^17] |

- Elite needs a 30,000 dollar deposit to switch to the Smart Router; Elite users "can stay commission-free as long as the order flows remain retail in nature"[^16].
- Whether Cost Plus tiers apply to each share marginally or to the whole month at one rate is not stated: unsettled. The page lets Michael enter the rate.
- The retail disclosure names "individual cash brokerage accounts"[^11]. Whether a margin account at borrowing cap 1 is treated the same is not stated: unsettled.
- Elite's commission is stated "per share traded"[^15] and applies to "US equity and ETF trades" (ETF: exchange-traded fund)[^1], and Alpaca's Cost Plus example charges it on a buy[^16]. The page therefore charges it on both legs; this is the run's reading of those texts.

## 3. Retail versus commercial, and professional versus non-professional

### 3.1 Axis one: order flow, retail or non-retail

Alpaca support, "What flags an account as non-retail", dated November 2022[^13]:

> "If an account has been flagged for potential non-retail trading, the client will be contacted, and the account will undergo a review process by Alpaca Trading Services. If the review finds that the account participates in non-retail trading activities, then the client will be informed that their account will be adjusted to the non-retail line."

The listed flags, quoted, "While this list is not exhaustive":

| Flag | Alpaca's words |
| :-- | :-- |
| Large ticket size | "If the average order size is greater than 10,000 shares or over $200,000 in notional value per trading day." |
| Low fill to cancellation ratio | "is the fill rate for an account less than 1% of all orders placed?" |
| Open or close auction | "Are you actively targeting the opening and closing auction as your primary method of trading?" |
| Breaking up orders | "purposefully splitting up larger orders into smaller orders even though the size is available to fill the whole order" |
| High frequency trading | "Does the account show signs of high-frequency trading? Ie. creating and canceling orders in a rapid fashion (pinging the market)?" |
| Trading professional | "You are either a registered individual or conduct trading as primary means of generating income (full time or part-time). This also includes hiring a professional to trade on your behalf." |

- **Cost:** commissions apply to non-retail order flow[^1], at a rate Alpaca does not publish: **not found**.
- The Elite Agreement adds only that Alpaca "may at any time and in its sole discretion, alter any fees or preferred rates"[^18].

### 3.2 Axis two: account type, individual or business

- Alpaca offers "commission-free* brokerage accounts for individuals (non-retirement) and entities" (support article dated December 2024)[^12].
- The business trading account, from an article dated December 2022, accepts "select entities that are mainly Corporations, LLCs, Partnerships in the U.S." and has "a $30,000 account minimum"[^14].
- The same article: "business accounts are considered professional data subscribers for which we currently are unable to provide Polygon's consolidated market data."[^14] It names a former data supplier, so it may be out of date; no newer statement was found.
- The current Business Account page advertises Elite Smart Router pricing "as low as" 0.0005 dollars per share and a 5.00 percent Elite margin rate[^15]. It does not state a separate commission schedule for business accounts.

### 3.3 Axis three: market data, non-professional or professional

- Alpaca's Customer Agreement (version V26.2026.07): "AlpacaDB, Inc. provides market data to non-professional Alpaca customers. The terms 'non-professional' and 'nonprofessional' are defined within both the NASDAQ OMX Global Subscriber Agreement as well as the NYSE Market Data Display Services Agreement, and are incorporated by reference."[^17] (NYSE is the New York Stock Exchange; Nasdaq OMX is the Nasdaq exchange group.)
- The NYSE agreement: a "Nonprofessional Subscriber" is "any natural person who receives market data solely for his/her personal, non-business use and who is not a 'Securities Professional'"[^19]. A securities professional is someone registered with the SEC, the CFTC (Commodity Futures Trading Commission), a state agency or an exchange; an investment adviser; or a bank employee doing work that would need registration[^19].
- The Nasdaq agreement: "All subscribers are deemed Professional or Business unless they are qualified as Non-Professional or Private Subscriber."[^20]
- **What triggers professional status**, from the NYSE agreement's questions (a "yes" to any points away from non-professional)[^19]:
  - receiving market data "for your business or any other entity";
  - using "the capital of any other individual or entity" in your trading;
  - trading "for the benefit of a corporation, partnership, or other entity";
  - any agreement "to share the profit of your trading activities or receive compensation for your trading activities";
  - office space or equipment "in exchange for your trading";
  - registration, investment advice, or asset management.
- The Customer Agreement requires the customer to "promptly notify" Alpaca on becoming registered with FINRA, the SEC, the CFTC or an exchange, or an investment adviser[^17].

**What each costs**

| Status | Alpaca data price | Source |
| :-- | :-- | :-- |
| Non-professional, Basic plan | 0 (real time from IEX, the Investors Exchange, only; 30 symbols on the stream) | [^23][^24] |
| Non-professional, Algo Trader Plus | 99 dollars a month (all U.S. exchanges, unlimited symbols), published | [^23][^24] |
| Non-professional, Elite with a 100,000 dollar deposit | Algo Trader Plus free, "only for personal use" | [^16] |
| Professional | **Not found** on any Alpaca page. Business accounts could not get consolidated data from Alpaca as of December 2022 | [^14] |

- **Context only, not Alpaca's price:** the UTP (Unlisted Trading Privileges) Plan, the data plan for Nasdaq-listed stocks, charges data vendors 24 dollars a month per professional subscriber and 1 dollar per non-professional, and says "Each Subscriber is considered a Professional unless qualified as a Nonprofessional"[^21]. The CTA (Consolidated Tape Association) Plan, for other listed stocks, posts only a schedule dated 2015-01-01, not used[^22].
- Whether Algo Trader Plus pricing changes for a professional: not stated by Alpaca: **not found**.

## 4. Fixed monthly costs

| Item | Per | Price a month | Label | Source |
| :-- | :-- | --: | :-- | :-- |
| Fly.io, shared-cpu-1x, 512 MB (megabytes) of memory, always on, San Jose (sjc) | stack | 4.41 | published | [^25] |
| Supabase, one more project at Micro compute in an existing Pro organization | stack | 10.00 | published | [^26][^27] |
| Alpaca Algo Trader Plus | account login (one plan covers all paper accounts under one login, per CLAUDE.md) | 99.00 | published | [^23][^24] |
| Claude Max, the 100 dollar tier | person | 100.00, tax not included | published | [^28] |

- **Fly.io:** the price page lists 3.69 dollars for the cheapest regions and 4.41 dollars with San Jose selected[^25].
  - Fly also says: "if your personal organization's monthly bill comes to less than $5, we waive it."[^25] Whether stack C's organization is a personal one was not checked, so the page uses the list price.
  - Outbound data is 0.02 dollars per GB (gigabyte) in North America, not included because usage is unknown[^25].
- **Supabase:** Micro is 0.01344 dollars an hour, "~$10" a month, and "Paid plans include $10/mo in compute credits, enough to cover one Micro instance."[^26][^27] The brief's case is an additional project inside an existing Pro organization, whose one included credit already covers another project, so the additional project costs the 10 dollars. The 25 dollar Pro plan fee is not counted, because the organization already exists.
- **Totals the page produces:** 1 stack with data and without Claude Max, 113.41; 2 stacks with data and Claude Max, 227.82. With no data plan and 1 stack, 14.41.
- Fixed cost per trading day on the page = monthly total times 12, divided by trading days a year.

**Trading days.** The NYSE holiday list has 10 weekday holidays in 2026 and 10 in 2027[^39]. Counting weekdays by script gives **251 trading days in each year**, so the page's default is 251 a year and 251 / 12 = 20.9167 a month. Early closes (the day after Thanksgiving, 2026-12-24) are counted as full days.

## 5. Federal tax

**The rules the page uses**

- **Short-term gains are ordinary income.** Topic 409: "If you hold it one year or less, your capital gain or loss is short-term" and "Net short-term capital gains are subject to taxation as ordinary income at graduated tax rates."[^34]
- **Per-trade costs reduce the taxable gain.** Basis "is generally the purchase price plus the costs of purchase, such as commissions and recording or transfer fees", and the amount realized is net of "expenses related to the sale (such as ... sales commissions)"[^36]. So fees, commissions and the spread (which is inside the fill prices) come off before tax.
- **Fixed monthly costs do not reduce taxable income for an investor.** Investment fees and expenses are miscellaneous itemized deductions subject to the 2 percent limit, which "can no longer" be claimed[^37]. Public Law 119-21, section 70110, struck "and before January 1, 2026" from that rule, making it permanent[^38]. This is the run's reading of those two texts, stated on the page; a tax professional should confirm it (section 8).
- **Standard deduction**, then the brackets, applied as if trading profit were Michael's only income, because no other income was given.
- **Net investment income tax (NIIT):** 3.8 percent "on the lesser of their net investment income, or the amount by which their modified adjusted gross income exceeds the statutory threshold"[^33]. With trading profit as the only income, both are the trading profit, so NIIT = 3.8 percent of the profit above the threshold (before the standard deduction).
- **A loss year** owes 0 federal tax on the page. Up to 3,000 dollars (1,500 married filing separately) of net capital loss can offset other income[^34]; with no other income given, that is a placeholder.
- Tax is computed once on the year's figure. The page shows the day as the year's tax divided by trading days a year, and the month as the year's tax divided by 12.

**Standard deduction**[^29][^30][^31][^32]

| Filing status | 2026 | 2027 |
| :-- | --: | --: |
| Single | 16,100 | 16,600 |
| Married filing jointly, and qualifying surviving spouse | 32,200 | 33,200 |
| Married filing separately | 16,100 | 16,600 |
| Head of household | 24,150 | 24,925 |

**Brackets, taxable income at the top of each band** (37 percent above the last)[^30][^32]

| Rate | Single 2026 | Single 2027 | Joint 2026 | Joint 2027 | Separate 2026 | Separate 2027 | Head of household 2026 | Head of household 2027 |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: |
| 10% | 12,400 | 12,800 | 24,800 | 25,600 | 12,400 | 12,800 | 17,700 | 18,250 |
| 12% | 50,400 | 52,025 | 100,800 | 104,050 | 50,400 | 52,025 | 67,450 | 69,650 |
| 22% | 105,700 | 109,125 | 211,400 | 218,250 | 105,700 | 109,125 | 105,700 | 109,100 |
| 24% | 201,775 | 208,325 | 403,550 | 416,650 | 201,775 | 208,325 | 201,750 | 208,300 |
| 32% | 256,225 | 264,550 | 512,450 | 529,100 | 256,225 | 264,550 | 256,200 | 264,550 |
| 35% | 640,600 | 661,375 | 768,700 | 793,650 | 384,350 | 396,825 | 640,600 | 661,350 |

"Joint" covers a qualifying surviving spouse too (Rev. Proc. Table 1)[^30][^32].

**NIIT thresholds**[^33]: married filing jointly 250,000; married filing separately 125,000; single or head of household 200,000; qualifying widow(er) with a child 250,000. These are statutory, not indexed.

**The page's "rules year" selector ties the tax year to the fee period**, so impossible mixes cannot happen:
- "Rates in force today (tax year 2026)": TAF 0, 2026 brackets.
- "Rates from 2027-01-01 (tax year 2027)": TAF 0.000195 (max 9.79), 2027 brackets.

**Placeholders, shown on the page as "not yet evaluated"**
- The wash sale rule.
- The mark to market election and trader tax status (Topic 429: a trader must "seek to profit from daily market movements", with activity that is "substantial" and carried on "with continuity and regularity"; traders report expenses on Schedule C)[^35].
- Other income, which would change the bracket and the NIIT base.
- State tax.

## 6. The 0.27 percent figure

**Where it came from.** `PROJECT_STATE.md`, Next Steps: "Tuesday's trading cost (spread, slippage, the stale free price) was about 0.27 percent of each round trip's value (about 397 dollars on 145,600 dollars of sales)."[^40] It comes from the build log's review of Tuesday 2026-11-03[^41].

**What it measured** (91 round trips of the busy placeholder, about 2,000 dollar positions, on the free IEX feed)[^41]

| Part | Dollars | In the 0.27 percent? |
| :-- | --: | :-- |
| Entry fills above the IEX price the signal saw (spread, a stale feed, 0.2 seconds of movement) | -274.11 | yes |
| Protective stops filled below their stop price | -186.50 | yes |
| Take-profits filled above their limit | +79.46 | yes |
| Exit sale after the loss stop decided | -15.44 | yes |
| Regulatory fees | 0 that day (about 3.02 posted that evening) | **no** |
| Price moves (the remainder) | -138.56 | **no** |

- 274.11 + 186.50 - 79.46 + 15.44 = 396.59 dollars, the "about 397". Divided by 145,600 dollars of sales, that is 0.272 percent.
- The log's "whole shares" table used a slightly different definition (per round trip, without the 15.44 exit): 0.21 percent for names under 75 dollars and 0.27 percent for 75 dollars and over[^42].
- **Fees alone that day** were about 3.02 dollars on 145,600 dollars of sales, or 0.0021 percent[^41][^45].

**Why it differs from fees alone.**

- The 0.27 percent was never a fee figure. It was the placeholder strategy's execution cost on one day: crossing the spread, prices from a feed that lags, and stops that slip.
- Michael is right that it is far too high as a fee rate. As an execution cost it was measured, but on different stocks, at different speeds and on the free feed, so it does not carry over.
- The next load day ran at 0.145 percent on cheap names with 1 cent spreads[^46].

## 7. Worked examples

All five were computed by a script written separately from the page (Python with exact decimals, listed in the trajectory), then matched line by line against the page in the browser test.

**Conventions used in every example**
- Each fee type's daily total is rounded up to the cent; the TAF cap is applied per trade first.
- Both legs use the one average share price. CAT and any Elite commission apply to both legs; the SEC fee and TAF to sells only.
- Month = day values times trading days a month (251 / 12), plus the monthly fixed costs. Year = day values times 251, plus 12 months of fixed costs. Day fixed cost = monthly fixed times 12 / 251.
- Tax is computed on the year; day = year / 251, month = year / 12. Each line is rounded to the cent on its own, so a total can differ from the sum of its rounded lines by 1 cent.
- Fixed costs: Fly 4.41 and Supabase 10.00 per stack; Algo Trader Plus 99.00 and Claude Max 100.00 when switched on.

### Example A: the paper day of 2026-11-18 at retail rates today

Inputs: 9,089 round trips a day (the day's filled entries, morning window 7,825 plus the rest 1,264)[^43]; gain per round trip 0.01 dollars (a stated input); shares per trade 1.45 and price 15.40 dollars (stated inputs, not measured averages; Michael sets them); spread and slippage 0; retail; 1 stack, Algo Trader Plus on, Claude Max off; rules: today (tax year 2026); single.

| Line | Day | Month | Year |
| :-- | --: | --: | --: |
| Gross gain | 90.89 | 1,901.12 | 22,813.39 |
| SEC fee | 4.19 | 87.64 | 1,051.69 |
| FINRA TAF | 0.00 | 0.00 | 0.00 |
| CAT fee | 0.08 | 1.67 | 20.08 |
| Commissions | 0.00 | 0.00 | 0.00 |
| Spread and slippage | 0.00 | 0.00 | 0.00 |
| Fixed costs | 5.42 | 113.41 | 1,360.92 |
| Net before tax | 81.20 | 1,698.39 | 20,380.70 |
| Federal tax | 2.25 | 47.01 | 564.16 |
| Net after tax | 78.95 | 1,651.38 | 19,816.54 |

- SEC: 9,089 x 1.45 x 15.40 = 202,957.37 dollars sold; times 0.0000206 = 4.181, up to 4.19.
- CAT: 2 x 9,089 x 1.45 = 26,358.1 shares; times 0.000003 = 0.079, up to 0.08.
- Tax: trading profit for tax 21,741.62 (fixed costs not deducted); taxable 5,641.62 after the 16,100 deduction; 10 percent = 564.16; NIIT 0.
- Break even gain per round trip: 0.0011 dollars.
- Against the real day: the actual totals (202,780.64 dollars sold, 26,324 shares) gave 4.18 plus 0.08 = 4.26[^43]. The example's stated shares and price give 4.27, because 1.45 and 15.40 are round numbers, not the day's exact averages.

### Example B: 2 stacks, 2027 rates, married filing jointly

Inputs: 500 round trips; gain 0.50 dollars; 10 shares at 20.00 dollars; spread and slippage 0.05 dollars per round trip; retail; 2 stacks, Algo Trader Plus on, Claude Max on; rules: 2027; married filing jointly.

| Line | Day | Month | Year |
| :-- | --: | --: | --: |
| Gross gain | 250.00 | 5,229.17 | 62,750.00 |
| SEC fee | 2.06 | 43.09 | 517.06 |
| FINRA TAF | 0.98 | 20.50 | 245.98 |
| CAT fee | 0.03 | 0.63 | 7.53 |
| Commissions | 0.00 | 0.00 | 0.00 |
| Spread and slippage | 25.00 | 522.92 | 6,275.00 |
| Fixed costs | 10.89 | 227.82 | 2,733.84 |
| Net before tax | 211.04 | 4,414.22 | 52,970.59 |
| Federal tax | 8.97 | 187.54 | 2,250.44 |
| Net after tax | 202.07 | 4,226.68 | 50,720.15 |

- TAF: 10 shares x 0.000195 = 0.00195 per trade (under the 9.79 cap); x 500 = 0.975, up to 0.98.
- Tax: trading profit for tax 55,704.43; taxable 22,504.43 after 33,200; 10 percent = 2,250.44; NIIT 0. Break even: 0.0779 dollars.

### Example C: Elite all-in commission, 2027, head of household

Inputs: 2,000 round trips; gain 1.00 dollar; 100 shares at 50.00 dollars; spread and slippage 0.10; Elite Smart Router, All-in; 1 stack, Algo Trader Plus on, Claude Max off; rules: 2027; head of household.

| Line | Day | Month | Year |
| :-- | --: | --: | --: |
| Gross gain | 2,000.00 | 41,833.33 | 502,000.00 |
| SEC fee | 206.00 | 4,308.83 | 51,706.00 |
| FINRA TAF | 39.00 | 815.75 | 9,789.00 |
| CAT fee | 1.20 | 25.10 | 301.20 |
| Commissions | 1,600.00 | 33,466.67 | 401,600.00 |
| Spread and slippage | 200.00 | 4,183.33 | 50,200.00 |
| Fixed costs | 5.42 | 113.41 | 1,360.92 |
| Net before tax | -51.62 | -1,079.76 | -12,957.12 |
| Federal tax | 0.00 | 0.00 | 0.00 |
| Net after tax | -51.62 | -1,079.76 | -12,957.12 |

- Commission: 2 legs x 2,000 x 100 shares x 0.0040 = 1,600.00 a day.
- Tax: trading profit for tax -11,596.20, a loss, so 0. Break even: 1.0258 dollars.

### Example D: no gain, fees and fixed costs only, 2027, single

Inputs: 1,000 round trips; gain 0; 5 shares at 10.00 dollars; spread 0; retail; 2 stacks, Algo Trader Plus on, Claude Max on; rules: 2027; single.

| Line | Day | Month | Year |
| :-- | --: | --: | --: |
| Gross gain | 0.00 | 0.00 | 0.00 |
| SEC fee | 1.03 | 21.54 | 258.53 |
| FINRA TAF | 0.98 | 20.50 | 245.98 |
| CAT fee | 0.03 | 0.63 | 7.53 |
| Commissions | 0.00 | 0.00 | 0.00 |
| Spread and slippage | 0.00 | 0.00 | 0.00 |
| Fixed costs | 10.89 | 227.82 | 2,733.84 |
| Net before tax | -12.93 | -270.49 | -3,245.88 |
| Federal tax | 0.00 | 0.00 | 0.00 |
| Net after tax | -12.93 | -270.49 | -3,245.88 |

- Break even: 0.0129 dollars per round trip.

### Example E: a high profit year, NIIT applies, 2027, single

Inputs: 1,000 round trips; gain 1.00 dollar; 10 shares at 20.00 dollars; spread and slippage 0.02; retail; 1 stack, Algo Trader Plus on, Claude Max on; rules: 2027; single.

| Line | Day | Month | Year |
| :-- | --: | --: | --: |
| Gross gain | 1,000.00 | 20,916.67 | 251,000.00 |
| SEC fee | 4.12 | 86.18 | 1,034.12 |
| FINRA TAF | 1.95 | 40.79 | 489.45 |
| CAT fee | 0.06 | 1.26 | 15.06 |
| Commissions | 0.00 | 0.00 | 0.00 |
| Spread and slippage | 20.00 | 418.33 | 5,020.00 |
| Fixed costs | 10.20 | 213.41 | 2,560.92 |
| Net before tax | 963.67 | 20,156.70 | 241,880.45 |
| Federal tax | 200.36 | 4,190.92 | 50,291.01 |
| Net after tax | 763.30 | 15,965.79 | 191,589.44 |

- Tax: trading profit for tax 244,441.37; taxable 227,841.37 after 16,600; income tax 48,602.24 (42,357.00 plus 32 percent of the excess over 208,325); NIIT 3.8 percent of (244,441.37 - 200,000) = 1,688.77. Total 50,291.01.
- Break even: 0.0363 dollars. The day's net after tax shows 763.30 while 963.67 - 200.36 = 763.31: each line is rounded on its own.

**Michael's wording.** He called the input "net gain per round trip". The page labels it "Gain per round trip, in dollars, before any costs", as the brief asked. **Michael should confirm that is what he meant**; if he meant after costs, the gross line and the break even read differently.

## 8. Not found, unsettled, and what would change the results

**Not found**
- Alpaca's commission for an account moved to the non-retail line. Searched: the fee schedule, the pricing page[^47], the Customer Agreement, the Elite Agreement, the support articles on commissions, account types, business accounts and non-retail flags, the Elite and Business Account pages[^1][^11][^12][^13][^14][^15][^16][^17][^18].
- Alpaca's price for professional market data, and whether Algo Trader Plus changes for a professional. Searched: the data page, the pricing page[^47], the market data docs, the market data support tag, the Customer Agreement, the business account article, the Elite page[^14][^16][^17][^23][^24].
- Exchange fees or rebates per share on Elite Cost Plus (they depend on the venue)[^1][^16].
- A CAT rate for 2027.
- An IRS (Internal Revenue Service) page that states the 2026 treatment of investment expenses in its own words (the statute and Pub 529 were used instead)[^37][^38].

**Unsettled**
- Whether Michael's pattern (rapid cancels, high entry counts) would lead Alpaca to review the account as non-retail[^13].
- The SEC rate for fiscal 2027: the 20.60 rate stays until 60 days after the 2027 appropriation is enacted[^2].
- How Elite Cost Plus tiers combine across a month[^1].
- Whether the retail disclosure's "individual cash brokerage accounts" wording leaves out margin accounts[^11].
- Whether paper charges TAF once it resumes on 2027-01-01 (not yet observable).
- Whether the Fly bill would be waived (personal organization and a bill under 5 dollars)[^25].
- The tax reading that fixed costs are not deductible for an investor: drawn from Pub 529 and the statute, not a ruling[^37][^38].

**What would change the results**
- Moving to the non-retail line or to Elite: commissions dominate at high share counts (example C).
- Spread and slippage: the page's input; on the 2026-11-03 record they were about 130 times the fees[^41].
- Trader tax status with the mark to market election: fixed costs could become deductible business expenses[^35]; not evaluated.
- Other income, state tax, the wash sale rule and the 3,000 dollar loss limit.
- A new SEC rate, a new CAT rate, or FINRA changing the TAF again.
- Professional data status: an Alpaca price that is not published.

## 9. Sources

Strength scale (same as `runs/run-3-deliverable.md` section 5): **A** primary and authoritative (a regulator, a statute, an exchange or plan, or the vendor's own page or terms, seen live); **B** reputable independent press; **C** review and comparison sites; **D** forums and personal posts. Prices: **published** (on the vendor's own public page) or **gated** (behind a form or signup). Every price in this run is published; none is gated. All accessed 2026-11-20.

[^1]: Alpaca Securities, "Alpaca Brokerage Fee Schedule", revised November 17, 2026. https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf (A; prices published)
[^2]: SEC, "Section 31 Transaction Fee Rate Advisory for Fiscal Year 2026", Feb. 27, 2026. https://www.sec.gov/rules-regulations/fee-rate-advisories/2026-2 (A)
[^3]: SEC, "Fee Rate Advisories" index. https://www.sec.gov/rules-regulations/fee-rate-advisories (A)
[^4]: Federal Register 91 FR 60435, 2026-09-23, FINRA notice of filing and immediate effectiveness, SR-FINRA-2026-021 (TAF pause). https://www.federalregister.gov/documents/2026/09/23/2026-19392/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-and ; FINRA filing page https://www.finra.org/rules-guidance/rule-filings/sr-finra-2026-021 (A)
[^5]: Federal Register 91 FR 60427, 2026-09-23, FINRA notice, SR-FINRA-2026-020 (implementation schedule; TAF 0.000195, max 9.79, for 2026 to 2028). https://www.federalregister.gov/documents/2026/09/23/2026-19393/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-and (A)
[^6]: FINRA, "Trading Activity Fee". https://www.finra.org/rules-guidance/guidance/trading-activity-fee (A)
[^7]: FINRA By-Laws, Schedule A, Section 1, "Member Regulatory Fees" (page text conflicts with [^4] and [^5]; not used for a rate). https://www.finra.org/rules-guidance/rulebooks/corporate-organization/section-1-member-regulatory-fees (A)
[^8]: FINRA, "Fee Adjustment Schedule" (2027 column superseded by [^5]). https://www.finra.org/rules-guidance/rule-filings/sr-finra-2024-019/fee-adjustment-schedule (A)
[^9]: Alpaca docs, "Regulatory Fees" (updated 2025-10-03). https://docs.alpaca.markets/docs/regulatory-fees (A)
[^10]: Alpaca support, "What are the regulatory fees?", February 2026. https://alpaca.markets/support/regulatory-fees (A)
[^11]: Alpaca support, "Will I incur commission or clearing fees with Alpaca?", August 2023. https://alpaca.markets/support/commission-clearing-fees (A)
[^12]: Alpaca support, "What types of accounts does Alpaca offer?", December 2024. https://alpaca.markets/support/types-accounts-alpaca-offers (A)
[^13]: Alpaca support, "What flags an account as 'non-retail', and what are the implications of being flagged?", November 2022. https://alpaca.markets/support/what-flags-an-account-as-non-retail-and-what-are-the-implications-of-being-flagged (A)
[^14]: Alpaca support, "Does Alpaca offer business accounts?", December 2022. https://alpaca.markets/support/alpaca-business-accounts (A; may be out of date)
[^15]: Alpaca, "Business Account" page. https://alpaca.markets/business-account (A; prices published)
[^16]: Alpaca, "Elite" page. https://alpaca.markets/elite (A; prices published)
[^17]: Alpaca, "Account Application and Customer Agreement", version V26.2026.07 (server date 2026-07-30), read in full by text search. https://files.alpaca.markets/disclosures/library/AcctAppMarginAndCustAgmt.pdf (A)
[^18]: Alpaca, "Alpaca Elite Agreement". https://files.alpaca.markets/disclosures/library/Alpaca+Elite+Agreement.pdf (A)
[^19]: NYSE, "Agreement for Market Data Display Services (Nonprofessional Subscriber Status)", last update March 4, 2013, Alpaca's library copy. https://files.alpaca.markets/disclosures/library/NYSE+Market+Data+Display+Services+Agreement.pdf (A)
[^20]: NASDAQ OMX Global Subscriber Agreement, version 2013.1, Alpaca's library copy. https://files.alpaca.markets/disclosures/library/NASDAQ+OMX+Global+Subscriber+Agreement.pdf (A)
[^21]: UTP Plan, "Data Policies", published October 2026 (server date 2026-11-09), page 6. https://utpplan.com/DOC/Datapolicies.pdf (A; plan fees to vendors, published)
[^22]: CTA Plan, "Pricing" (lists only a schedule dated 2015-01-01; not used). https://www.ctaplan.com/pricing (A)
[^23]: Alpaca, "Market Data" plans page. https://alpaca.markets/data (A; prices published)
[^24]: Alpaca docs, "About Market Data API" (updated 2026-10-06). https://docs.alpaca.markets/us/docs/about-market-data-api (A; prices published)
[^25]: Fly.io, "Resource Pricing", region selector set to San Jose (sjc). https://fly.io/docs/about/pricing/ (A; prices published)
[^26]: Supabase, "Pricing". https://supabase.com/pricing (A; prices published)
[^27]: Supabase docs, "Compute and Disk". https://supabase.com/docs/guides/platform/compute-and-disk (A; prices published)
[^28]: Anthropic, "Claude pricing". https://claude.com/pricing (A; prices published)
[^29]: IRS, "IRS releases tax inflation adjustments for tax year 2026, including amendments from the One, Big, Beautiful Bill". https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill (A)
[^30]: IRS, Revenue Procedure 2025-32 (tax year 2026 tables 1 to 4, standard deduction). https://www.irs.gov/pub/irs-drop/rp-25-32.pdf (A)
[^31]: IRS, "IRS releases tax inflation adjustments for tax year 2027" (IR-2026-133, 2026-11-05). https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2027-taxpayers-continue-to-benefit-from-the-working-families-tax-cuts (A)
[^32]: IRS, Revenue Procedure 2026-35 (tax year 2027 tables 1 to 4, standard deduction). https://www.irs.gov/pub/irs-drop/rp-26-35.pdf (A)
[^33]: IRS, "Net Investment Income Tax". https://www.irs.gov/individuals/net-investment-income-tax (A)
[^34]: IRS, "Topic no. 409, Capital gains and losses". https://www.irs.gov/taxtopics/tc409 (A)
[^35]: IRS, "Topic no. 429, Traders in securities". https://www.irs.gov/taxtopics/tc429 (A)
[^36]: IRS, "Publication 550 (2025), Investment Income and Expenses". https://www.irs.gov/publications/p550 (A)
[^37]: IRS, "Publication 529 (12/2020), Miscellaneous Deductions". https://www.irs.gov/publications/p529 (A)
[^38]: Public Law 119-21, section 70110, "Termination of miscellaneous itemized deductions other than educator expenses". https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm (A)
[^39]: NYSE, "Holidays and Trading Hours" (2026, 2027, 2028). https://www.nyse.com/markets/hours-calendars (A)
[^40]: This repo, `PROJECT_STATE.md`, Next Steps, the starting estimates for the load day ("about 0.27 percent of each round trip's value"). (A, own record)
[^41]: This repo, `builds/build-c2-log.md`, "Tuesday 2026-11-03 session review" (the cost breakdown, the fee estimate, and Monday's posted REG fee of 0.56 on 27,100.09). (A, own record)
[^42]: This repo, `builds/build-c2-log.md`, "Load day: whole shares" (cost by price, 0.21 and 0.27 percent). (A, own record)
[^43]: This repo, `builds/build-c2-log.md`, "Wednesday 2026-11-18 end-of-day session review" (entries and fills, "Fees, estimate 4.26", and Tuesday's posted fees of 3.88). (A, own record)
[^44]: Michael's report in the brief: 3.88 dollars on 16,204 filled trades (2026-11-17) and 4.26 dollars on 18,256 filled trades (2026-11-18). (A, owner's own account record)
[^45]: This repo, `builds/build-c2-log.md`, "Wednesday 2026-11-04 session review" ("Tuesday's posted fees were REG 3.00 and CAT 0.02, exactly the 3.02 estimated"). (A, own record)
[^46]: This repo, `builds/build-c2-log.md`, "Wednesday 2026-11-04 session review" ("The window ran 382 entries at 0.145 percent"). (A, own record)
[^47]: Alpaca, "Pricing" page, Commissions Disclosure. https://alpaca.markets/pricing (A)
