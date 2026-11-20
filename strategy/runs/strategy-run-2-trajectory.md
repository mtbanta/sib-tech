# Strategy run 2 trajectory

## 1. The brief as given

Verbatim, as saved to `strategy/runs/strategy-run-2-brief.md`.

> # Strategy run 2 brief: trading costs and a cost calculator
>
> ## Run settings
>
> A record for the audit trail, not instructions. Michael set these up before pasting this brief:
>
> - Launched from `~/Projects/sib-tech` in a fresh session, with no other Claude Code session working in this repo.
> - Model: Opus 5.5, medium effort. Advisor: on, Opus 5.5. Auto-mode: on.
> - Playwright MCP confirmed connected with `/mcp` before pasting.
> - Copied from the raw file in TextEdit.
>
> ## What changed from the previous run
>
> - Strategy run 1 described past bull market winners from daily bars (`strategy/runs/strategy-run-1-deliverable.md`). Its section 7, point 3 quoted trading costs of "about 0.27 percent of each round trip's value", taken from `PROJECT_STATE.md`. Michael says that figure is far too high.
> - Michael's paper account fees, as he reports them: 3.88 dollars on 16,204 filled trades (2026-11-17) and 4.26 dollars on 18,256 filled trades (2026-11-18). A Claude Code session told him paper may not charge everything a live account would, and that a live account would likely also pay FINRA's trading activity fee on shares sold.
> - Lever: instructions (a new question: costs). Strategy run 1's data changes come later, in strategy run 3. This run does not touch run 1's files.
> - Nothing in this run is financial or tax advice. Say so in the deliverable and on the page.
>
> ## Step zero: save this brief
>
> 1. Check the date with `date`.
> 2. Write this entire brief, verbatim and unedited, to `strategy/runs/strategy-run-2-brief.md`.
> 3. Create `strategy/runs/strategy-run-2-trajectory.md` and paste this brief into its first section.
>
> ## The goal
>
> When this run is done, Michael can open one page, type in how he expects to trade, and see every cost of trading at that volume, each with its source, and what is left after costs and federal tax. He also understands what would put his Alpaca account in a commercial or professional category instead of retail, and what that costs.
>
> The rule for every figure: it comes from a live source with a URL and access date. No inferences, assumptions or guesses. If a figure cannot be found, the page says "not found" and the deliverable says what was searched. Do not estimate it.
>
> ## What to research
>
> 1. Per trade regulatory fees on sales, with current rates and how each is calculated:
>    - SEC Section 31 fee (on the dollar value of shares sold).
>    - FINRA trading activity fee (per share sold, with any per trade cap).
>    - Consolidated Audit Trail (CAT) fees: whether and how they reach a retail Alpaca customer.
>    - Any other fee Alpaca passes through on stock trades.
> 2. Alpaca's own charges: commissions for a retail account, and for any other account category. Say which pages state them.
> 3. Retail versus commercial at Alpaca: what Alpaca's own documents say makes an account commercial (or business, entity, institutional) rather than retail, and what each costs (commissions, fees, data). Quote the defining text.
> 4. Professional versus non professional status for market data: how the exchanges and Alpaca define a professional subscriber, what triggers it, and what it costs, including whether Algo Trader Plus pricing changes.
> 5. Fixed monthly costs, from each vendor's own pricing page:
>    - Alpaca Algo Trader Plus (99 dollars a month published, to be reconfirmed).
>    - Fly.io: one shared CPU machine with 512 MB of memory, always on, in San Jose (sjc), per stack.
>    - Supabase: an additional project at Micro compute inside an existing Pro organization, per stack.
>    - Claude Max, the 100 dollar a month tier.
> 6. Federal income tax on short term trading gains for the current tax year (and next year if already published): how short term gains are taxed, the brackets and standard deduction for each filing status, and the net investment income tax with its thresholds. Sources: IRS pages or official publications.
> 7. Where the 0.27 percent figure came from: read `PROJECT_STATE.md` and, read only, the build logs in `builds/`, and state what that figure measured (for example whether it included spread, slippage or price moves, not only fees). Do not open anything under `stacks/`.
>
> ## The calculator page: `strategy/runs/strategy-run-2-calculator.html`
>
> Inputs Michael sets, each labeled clearly:
> - Round trips per day (a round trip is one buy and the sell that closes it).
> - Gain per round trip, in dollars, before any costs. Label it exactly that way, and note in the deliverable that Michael called it "net gain per round trip" and should confirm the meaning.
> - Average shares per trade and average share price (the regulatory fees depend on them).
> - Trading days per month and per year, with sourced defaults (for example the exchange holiday calendar).
> - Spread and slippage per round trip: a field Michael sets, labeled "your input, not sourced". Default 0.
> - Account category (retail, and any other category found), which switches the commission and data costs where a source supports it.
> - Number of stacks (1 or 2), for the fixed costs. A switch to include or exclude Claude Max (Michael uses it for other work too).
> - Filing status selector for federal tax. No other tax inputs.
> - Every sourced rate shown in an editable field prefilled with the sourced value, so Michael can adjust it, with a reset to the sourced value.
>
> Outputs, per day, per month and per year:
> - Gross gain; each regulatory fee; commissions; spread and slippage; fixed costs; net before tax; federal tax; net after tax.
> - The break even gain per round trip (the gain at which net before tax is zero).
> - A chart of net after tax against gain per round trip, at the current inputs.
> - How the tax is computed, stated on the page: brackets and standard deduction for the chosen status, applied as if trading profit were the only income, because Michael gave no other income. Say so plainly.
>
> Placeholders, visible on the page as "not yet evaluated": the wash sale rule, the mark to market election (trader tax status), other income, and state tax.
>
> Also on the page, as a reference panel: Michael's two reported paper days (fills and fees), with the note that paper may not charge everything a live account would.
>
> Every sourced number on the page links to its source (URL and access date). The page opens with a double click on Michael's Mac, with no server, sends nothing anywhere and stores nothing. A charting library may load from a public CDN.
>
> ## The output
>
> Build in this order: the markdown first, then the trajectory's self assessment, then the page.
>
> ### `strategy/runs/strategy-run-2-deliverable.md`, the source of record
>
> 1. Summary in bullets: the cost items that matter most at Michael's volume, and the retail versus commercial answer.
> 2. Every fee and rate: what it is, how it is calculated, the current value, the source.
> 3. Retail versus commercial, and professional versus non professional: definitions quoted, triggers, costs.
> 4. Fixed monthly costs, itemized.
> 5. Federal tax: the rules used, and the placeholders not yet evaluated.
> 6. The 0.27 percent figure: what it measured, and why it differs from fees alone.
> 7. Worked examples: at least three sets of inputs, computed by hand in the deliverable and matched exactly by the page (state the inputs and every line of the result). One example uses Michael's paper day of 2026-11-18 (18,256 fills) with the shares and price left as stated inputs.
> 8. What is not found or unsettled, and what would change the results.
> 9. Sources: numbered footnotes on every claim, linking to a sources list with URL, access date and a strength label (the same scale as `runs/run-3-deliverable.md` section 5). Every price labeled "published" (on the vendor's page) or "gated" (behind a form or signup).
>
> Formatting: bullets and tables, no paragraph longer than three sentences, plain English, acronyms defined the first time, no em or en dashes. Michael is a non-coder.
>
> ### Testing the page
>
> - Check every worked example on the page against the deliverable, exactly.
> - Test with Playwright, served locally: every input, the reset buttons, the filing status selector, the chart, at desktop and phone width.
>
> ## The standard
>
> Michael accepts the work when all of these hold:
>
> 1. Every figure traced to a live source with a URL and an access date.
> 2. No inference, assumption or guess anywhere. Anything not found is marked "not found", never estimated.
> 3. The page's math matches the hand worked examples exactly.
> 4. You state what remains unknown and what would change the results.
>
> ## Documenting your work: `strategy/runs/strategy-run-2-trajectory.md`
>
> Append as you work, not at the end. Six parts: the brief as given, the sequence of what you did, sources with URL and access date, decision points with reasons, dead ends, and a self assessment against the standard. Do not record time spent or token cost.
>
> ## Run conventions
>
> - Files: `strategy/runs/strategy-run-2-brief.md`, `-deliverable.md`, `-calculator.html`, `-trajectory.md`.
> - Add one line to `strategy/runs/README.md`: "2", the date, "instructions: new question, trading costs", outcome.
> - Add one dated line to `PROJECT_STATE.md` under Completed, pointing to the deliverable. Change nothing else in that file.
> - No market data is needed in this run. Do not use `strategy/.env.local`.
> - Committed files stay under 50 MB.
> - Before the commit, run `node scripts/secret-scan.mjs --tree`.
> - Done means all files written, the page browser tested, the index and the `PROJECT_STATE.md` line written, and one commit and one push at the end of the run. Auto-mode's research run carve-out covers that commit and push.
> - Then end the session. Do not start strategy run 3.
>
> ## Prohibitions
>
> - No live trading.
> - No orders of any kind, paper or live, from strategy work. Never call a trading host.
> - Nothing touching the stacks' resources: their folders, accounts, keys, databases, deployments, Discord servers or heartbeat checks.
> - No credentials in files or commits.
> - No account creation, signups, trials, purchases, contact forms or emails to any vendor.
> - No reading `~/Projects/relii`.
> - Never send Michael's personal information to any site or service, including in request headers, and do not disguise automated requests as a regular browser. If a page refuses plain requests, read it with Playwright or skip it and record it.
> - Give these prohibitions, word for word, to any helper you start.

## 2. Sequence of what was done

1. Checked the date: Fri Nov 20 07:15 CST 2026.
2. Read `PROJECT_STATE.md` (start-of-session rule): Current Stage, Completed, Next Steps. Found the 0.27 percent figure in Next Steps (the Tuesday 2026-11-03 cost estimate).
3. Saved the brief verbatim to `strategy/runs/strategy-run-2-brief.md` and created this file.
4. Read only: `builds/build-c2-log.md`, "Tuesday 2026-11-03 session review" (the cost breakdown table and fee estimate) and "Load day: whole shares" (0.21 and 0.27 percent by price). Nothing under `stacks/` opened.
5. Read `runs/run-3-deliverable.md` section 5 for the source strength scale (A to D) and price labels.

6. Set up a plain fetch helper (curl with its own default identity, no browser disguise, no personal details). SEC.gov answered 403 to plain requests (it asks automated clients for a contact email, which this run will not send); recorded, to be read with Playwright.
7. Fetched FINRA's TAF page, Schedule A Section 1 and the FINRA Fee Adjustment Schedule. Section 1's page text showed $0.000166 per share (max $8.30) under the selected version "Oct 01, 2026 - Dec 31, 2026"; the Fee Adjustment Schedule showed 2026 $0.000195 (max $9.79) and 2027 $0.000232 (max $11.61). These disagree, so searched further.
8. Web search found SR-FINRA-2026-021 (a TAF pause) and SR-FINRA-2026-020 (a changed schedule). Read both Federal Register notices as plain text through the Federal Register API (91 FR 60435 and 91 FR 60427, published 2026-09-23).
9. Alpaca's support article bodies load by script, so curl returned only menus; Alpaca's docs page "Regulatory Fees" (markdown version) lists TAF on sells and CAT on buys and sells for equities and points to the brokerage fee schedule.
10. Read Alpaca's Brokerage Fee Schedule PDF (revised November 17, 2026; server last-modified 2026-11-17): SEC fee $0.0000206 times trade value on sells, TAF $0 per share on sells, CAT $0.000003 per executed equivalent share on buys and sells; each fee type totaled per account per day and rounded up to the cent; no commissions except index options, the Elite Smart Router, and "order flow determined to be non-retail in nature".

11. Read FINRA's notice text for SR-FINRA-2026-021 (pause of TAF for October to December 2026, immediately effective, resuming 2027-01-01) and SR-FINRA-2026-020 (2027 and 2028 kept at the 2026 rate, $0.000195 per share, max $9.79).
12. Read with Playwright (Alpaca support articles render by script): "What flags an account as non-retail", "Will I incur commission or clearing fees", "What are the regulatory fees?", "What types of accounts does Alpaca offer?", "Does Alpaca offer business accounts?". Also the Business Account page, the Elite page and the Disclosures library.
13. Read Alpaca's "About Market Data API" docs page (Algo Trader Plus $99 a month) and the alpaca.markets/data plan table.
14. Read the NYSE "Agreement for Market Data Display Services" from Alpaca's disclosure library (nonprofessional definition and the 11 questions).
15. Read the UTP Plan Data Policies (published October 2026; server date 2026-11-09) with a small PDF text extractor written for this run: professional $24 a month per subscriber, nonprofessional $1. The CTA plan's only posted schedule is dated 2015-01-01; not used.
16. Read the SEC Fee Rate Advisories index and the FY2026 Section 31 advisory with Playwright: $20.60 per million from 2026-04-04, until 60 days after the FY2027 appropriation is enacted. No newer Section 31 advisory listed.
17. Fixed costs: Fly.io resource pricing with the region selector set to San Jose (sjc) in Playwright: shared-cpu-1x 512MB $4.41 a month; personal organizations' bills under $5 waived. Supabase pricing and compute pages: Micro $0.01344 an hour, about $10 a month, the Pro plan's $10 credit covers one Micro instance. claude.com/pricing: Max $100 a month, tax not included.
18. Tax: IRS news releases for tax years 2026 and 2027, Rev. Proc. 2025-32 and 2026-35 (all four rate tables and standard deductions, extracted from the PDFs), the NIIT page, Topic 409 (short-term gains taxed as ordinary income; $3,000 loss limit), Topic 429 (traders and the mark-to-market election), Pub 550 (2025) on basis and amount realized, Pub 529 (12/2020) on investment fees, and Public Law 119-21 section 70110 (the suspension of miscellaneous itemized deductions made permanent).
19. NYSE holidays page: 10 weekday holidays in each of 2026 and 2027; weekdays counted by script: 251 trading days in each year.

20. Called the advisor before writing. Its points taken: read the three unread Alpaca PDFs before writing "not found"; cite only opened pages; fix rounding, legs, periods and tax conventions before the examples; tie the tax year to the fee period; only Fly and Supabase are per stack; compute examples with an independent script; fills are not round trips; check the 397 dollar sum.
21. Read the Alpaca Customer Agreement (56 pages, version V26.2026.07) and the Nasdaq agreement with pdf.js in Playwright, served by a local server that stops itself after 25 minutes (macOS has no `timeout`). Read the one-page Elite Agreement directly. None names a non-retail commission rate; the Customer Agreement incorporates the NYSE and Nasdaq non-professional definitions.
22. Read only: the build log's "Wednesday 2026-11-18 end-of-day session review": sells 202,780.64 dollars and 26,324 shares give SEC 4.18 plus CAT 0.08 = 4.26 (Michael's figure); Tuesday's posted fees 3.88 = SEC 3.80 plus CAT 0.08. Also the log's earlier checks of posted fees against the formula (2026-11-03, 2026-11-04 reviews).
23. Wrote the independent example script (appendix below) and ran five examples.
24. Wrote the deliverable. Fixed one hand-typed total in the summary (fixed costs 14.41 to 227.82, first typed wrongly) and added two citations.

25. Wrote the calculator page after the deliverable and the self assessment (the brief's build order). Loaded the dataviz guidance first: one series, one hue, no legend, hover tooltip, a zero line, and a table view of the chart.
26. Served `strategy/runs/` on a local server that stops itself after 40 minutes. Clicked each example button and compared every line (10 lines x 3 periods, plus break even and fixed cost) with the independent script's output: 160 values checked, 0 mismatches.
27. Tested every control with real Playwright input: each trading input changes its line; trading days per month follows trading days per year until edited, and its Reset restores that; Reset on every sourced field (SEC, TAF rate and cap, CAT, Fly, Supabase, Algo Trader Plus, Claude Max, standard deduction, NIIT rate and threshold, Elite all-in and Cost Plus rates); the rules year switches the TAF and the tax tables; all five filing statuses set the right standard deduction and NIIT threshold; bracket edits change the tax and Reset restores them; each commission category shows its own fields; professional data hides Algo Trader Plus and takes its own input; stacks and Claude Max change the fixed costs (113.41, 127.82, 227.82); the chart has 41 points and follows the gain input; the table view exists. A test of mine expected the yearly fixed cost to change with trading days; it should not (12 months), and the per-day figure does change (10.89 at 251, 13.67 at 200).
28. Storage check: one local storage key (`r3tab`) was present; it belongs to `runs/run-3-deliverable.html`, served on the same local address in an earlier session. After clearing storage and using the page: 0 items stored. Requests: only the page itself and Chart.js 4.4.1 from cdnjs.
29. Phone width: at 390 pixels the page scrolled sideways by 82 pixels because source links were set not to wrap. Fixed; then a word-break rule split words in the table, fixed; then tightened cell spacing so the result table fits at 390 pixels. Re-checked every category, data status and rules year at 360, 390 and 1280 pixels: no sideways page scroll.
30. Re-ran the 160-value match after the style fixes, over the local server and opened from disk (`file://`, as a double click would): 0 mismatches both ways, chart drawn. Dark mode checked by emulation.

31. Called the advisor again before the commit. Fixed what it found: a summary sentence that inferred why paper charged TAF 0 (reworded: the days fall inside the pause, so they cannot show it); an untraced "1 to 15 shares" (replaced by 13,162 shares sold over 9,089 filled entries, about 1.45); "assumed" in the Supabase help text; the unread Alpaca pricing page (read; its Commissions Disclosure added as footnote 47 and to the "searched" lists); passages over three sentences (the five example input lines, section 6, the Fly bullet); acronyms not expanded (FINRA, LLC, ACH, API, ETF, NYSE, IEX, UTP, CTA, MB, GB, IRS, REG); "any account" removed from the retail row; a quoted line on how CAT reaches the customer; the page's filing status no longer resets an edited TAF.
32. Bracket reconciliation: for all eight tables (2026 and 2027; single, joint, separate, head of household), the cumulative tax at each threshold computed from the typed thresholds equals the "plus" amount printed in the Revenue Procedure (for example 2027 single: 1,280.00, 5,987.00, 18,549.00, 42,357.00, 60,349.00, 199,237.75). All eight OK. This guards against a typing slip that the script and the page would share.
33. Parsed the deliverable's section 7 tables and compared them with the script's output: 155 values (10 lines x 3 periods x 5 examples, plus 5 break evens), 0 mismatches. With step 30, the page therefore matches the deliverable.
34. Re-ran the page tests after the edits: 160 of 160 values match over the local server and from disk; filing status keeps an edited TAF while the rules year resets it; no sideways scroll at 390 pixels; no page errors.

## 3. Sources

| # | Source | URL | Accessed | Strength |
| :-- | :-- | :-- | :-- | :-- |
| 1 | SEC Fee Rate Advisories index | https://www.sec.gov/rules-regulations/fee-rate-advisories | 2026-11-20 | A |
| 2 | SEC Section 31 Fee Rate Advisory for FY2026 (Feb. 27, 2026) | https://www.sec.gov/rules-regulations/fee-rate-advisories/2026-2 | 2026-11-20 | A |
| 3 | FINRA Trading Activity Fee page | https://www.finra.org/rules-guidance/guidance/trading-activity-fee | 2026-11-20 | A |
| 4 | FINRA By-Laws Schedule A Section 1 | https://www.finra.org/rules-guidance/rulebooks/corporate-organization/section-1-member-regulatory-fees | 2026-11-20 | A (conflicting text, not used for a rate) |
| 5 | FINRA Fee Adjustment Schedule | https://www.finra.org/rules-guidance/rule-filings/sr-finra-2024-019/fee-adjustment-schedule | 2026-11-20 | A (superseded for 2027) |
| 6 | FINRA SR-FINRA-2026-021 filing page | https://www.finra.org/rules-guidance/rule-filings/sr-finra-2026-021 | 2026-11-20 | A |
| 7 | Federal Register 91 FR 60435, SR-FINRA-2026-021 notice (text) | https://www.federalregister.gov/documents/2026/09/23/2026-19392/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-and | 2026-11-20 | A |
| 8 | Federal Register 91 FR 60427, SR-FINRA-2026-020 notice (text) | https://www.federalregister.gov/documents/2026/09/23/2026-19393/self-regulatory-organizations-financial-industry-regulatory-authority-inc-notice-of-filing-and | 2026-11-20 | A |
| 9 | Alpaca Brokerage Fee Schedule (revised Nov. 17, 2026) | https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf | 2026-11-20 | A |
| 10 | Alpaca docs, Regulatory Fees | https://docs.alpaca.markets/docs/regulatory-fees | 2026-11-20 | A |
| 11 | Alpaca support, What are the regulatory fees? (Feb. 2026) | https://alpaca.markets/support/regulatory-fees | 2026-11-20 | A |
| 12 | Alpaca support, Will I incur commission or clearing fees? (Aug. 2023) | https://alpaca.markets/support/commission-clearing-fees | 2026-11-20 | A |
| 13 | Alpaca support, What flags an account as non-retail (Nov. 2022) | https://alpaca.markets/support/what-flags-an-account-as-non-retail-and-what-are-the-implications-of-being-flagged | 2026-11-20 | A |
| 14 | Alpaca support, What types of accounts does Alpaca offer? (Dec. 2024) | https://alpaca.markets/support/types-accounts-alpaca-offers | 2026-11-20 | A |
| 15 | Alpaca support, Does Alpaca offer business accounts? (Dec. 2022) | https://alpaca.markets/support/alpaca-business-accounts | 2026-11-20 | A |
| 16 | Alpaca Business Account page | https://alpaca.markets/business-account | 2026-11-20 | A |
| 17 | Alpaca Elite page | https://alpaca.markets/elite | 2026-11-20 | A |
| 18 | Alpaca Disclosures library | https://alpaca.markets/disclosures | 2026-11-20 | A |
| 19 | Alpaca market data plans page | https://alpaca.markets/data | 2026-11-20 | A |
| 20 | Alpaca docs, About Market Data API (updated 2026-10-06) | https://docs.alpaca.markets/us/docs/about-market-data-api | 2026-11-20 | A |
| 21 | NYSE Agreement for Market Data Display Services (Alpaca library copy) | https://files.alpaca.markets/disclosures/library/NYSE+Market+Data+Display+Services+Agreement.pdf | 2026-11-20 | A |
| 22 | UTP Plan Data Policies (published October 2026) | https://utpplan.com/DOC/Datapolicies.pdf | 2026-11-20 | A |
| 23 | CTA Plan pricing page (schedule dated 2015-01-01) | https://www.ctaplan.com/pricing | 2026-11-20 | A (dated, not used) |
| 24 | Fly.io resource pricing (sjc selected) | https://fly.io/docs/about/pricing/ | 2026-11-20 | A |
| 25 | Supabase pricing | https://supabase.com/pricing | 2026-11-20 | A |
| 26 | Supabase compute and disk docs | https://supabase.com/docs/guides/platform/compute-and-disk | 2026-11-20 | A |
| 27 | Claude pricing | https://claude.com/pricing | 2026-11-20 | A |
| 28 | IRS tax year 2026 inflation adjustments release | https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill | 2026-11-20 | A |
| 29 | IRS tax year 2027 inflation adjustments release (IR-2026-133) | https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2027-taxpayers-continue-to-benefit-from-the-working-families-tax-cuts | 2026-11-20 | A |
| 30 | IRS Rev. Proc. 2025-32 | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf | 2026-11-20 | A |
| 31 | IRS Rev. Proc. 2026-35 | https://www.irs.gov/pub/irs-drop/rp-26-35.pdf | 2026-11-20 | A |
| 32 | IRS Net Investment Income Tax | https://www.irs.gov/individuals/net-investment-income-tax | 2026-11-20 | A |
| 33 | IRS Topic 409, Capital gains and losses | https://www.irs.gov/taxtopics/tc409 | 2026-11-20 | A |
| 34 | IRS Topic 429, Traders in securities | https://www.irs.gov/taxtopics/tc429 | 2026-11-20 | A |
| 35 | IRS Publication 550 (2025) | https://www.irs.gov/publications/p550 | 2026-11-20 | A |
| 36 | IRS Publication 529 (12/2020) | https://www.irs.gov/publications/p529 | 2026-11-20 | A |
| 37 | Public Law 119-21, section 70110 (govinfo) | https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | 2026-11-20 | A |
| 38 | NYSE Holidays and Trading Hours | https://www.nyse.com/markets/hours-calendars | 2026-11-20 | A |
| 39 | This repo: PROJECT_STATE.md, Next Steps (0.27 percent) | PROJECT_STATE.md | 2026-11-20 | A (own record) |
| 40 | This repo: builds/build-c2-log.md, Tuesday 2026-11-03 session review; Load day: whole shares | builds/build-c2-log.md | 2026-11-20 | A (own record) |
| 41 | Alpaca Account Application and Customer Agreement, V26.2026.07 (read in full with pdf.js) | https://files.alpaca.markets/disclosures/library/AcctAppMarginAndCustAgmt.pdf | 2026-11-20 | A |
| 42 | Alpaca Elite Agreement | https://files.alpaca.markets/disclosures/library/Alpaca+Elite+Agreement.pdf | 2026-11-20 | A |
| 43 | NASDAQ OMX Global Subscriber Agreement, version 2013.1 (Alpaca copy, read with pdf.js) | https://files.alpaca.markets/disclosures/library/NASDAQ+OMX+Global+Subscriber+Agreement.pdf | 2026-11-20 | A |
| 44 | Alpaca Pricing page, Commissions Disclosure | https://alpaca.markets/pricing | 2026-11-20 | A |
| 45 | This repo: builds/build-c2-log.md, Wednesday 2026-11-18 end-of-day session review | builds/build-c2-log.md | 2026-11-20 | A (own record) |
| 46 | This repo: builds/build-c2-log.md, Wednesday 2026-11-04 session review | builds/build-c2-log.md | 2026-11-20 | A (own record) |

## 4. Decision points

- **TAF rate.** Chosen: $0 per share for trades from 2026-10-01 to 2026-12-31, then $0.000195 per share, max $9.79 per trade, from 2027-01-01 through 2028-12-31. Why: the Federal Register notices of SR-FINRA-2026-021 (pause, immediately effective) and SR-FINRA-2026-020 (2027 and 2028 kept at 2026 rates) are later and more specific than FINRA's Fee Adjustment Schedule page, and Alpaca's fee schedule of 2026-11-17 independently shows $0. The Section 1 page's $0.000166 is recorded as a conflict (section 5).
- **Fee period on the page.** Because the TAF changes on 2027-01-01, the calculator offers a fee period selector (now, or from 2027-01-01), each with its sourced TAF, rather than one blended number.

- **Fees in the tax base.** Per-trade fees and commissions reduce the taxable gain (Pub 550: basis includes commissions and transfer fees; amount realized is net of sale expenses). Fixed monthly costs do not, for an investor: Pub 529 lists investment fees and expenses as miscellaneous itemized deductions that "can no longer" be claimed, and P.L. 119-21 section 70110 struck the 2026 end date from section 67(g). The trader route (Topic 429) is a placeholder, "not yet evaluated".
- **Fee rounding.** Alpaca's fee schedule (2026-11-17) says each fee type is totaled per account per day, then rounded up to the cent. Its support article (2026-02) says TAF is applied per trade. The newer, more specific schedule is used; the page rounds each fee's daily total up to the cent.
- **Non-retail commission.** Alpaca names no rate for an account moved to the "non-retail line"; marked "not found" with an input field, not estimated. Elite Smart Router rates are published and selectable.
- **Professional data price at Alpaca.** Not found on any Alpaca page; the UTP plan's per-subscriber fees are shown as context for what the plan charges vendors, not as Alpaca's price.

- **Example A inputs.** Round trips 9,089 are the day's filled entries from the log; shares 1.45 and price 15.40 are stated round inputs, not derived from the 18,256 fills (fills are not round trips; paper fills arrive in pieces). The exact day's fees are shown beside it from the log's actual totals.
- **Per stack.** Only Fly and Supabase are multiplied by the number of stacks; Algo Trader Plus (one plan per login, CLAUDE.md) and Claude Max are counted once, each with its own switch.
- **Professional data.** A separate selector from the commission category, since the sources treat order flow, account type and data status as different axes.

## 5. Dead ends

- **FINRA Section 1 page text.** Its selected version "Oct 01, 2026 - Dec 31, 2026" displayed $0.000166 per share (max $8.30), the 2024 and 2025 rate, with an amendment history ending at 2024. It contradicts both FINRA notices of 2026-09-23 and Alpaca's schedule, so it was not used for a rate.
- **FINRA Fee Adjustment Schedule page.** Shows 2027 at $0.000232 (max $11.61); superseded by SR-FINRA-2026-020, which moved that step to 2029. Not used for a rate.
- **FINRA filing PDFs.** Too large to read without a PDF renderer (none installed); read the same notices as Federal Register plain text instead.
- **SEC.gov by curl.** 403; read with Playwright instead.

- **Alpaca support pages by curl.** Bodies load by script; read with Playwright.
- **First guessed Alpaca support URL** (`what-types-of-accounts-does-alpaca-offer`) returned 404; the real slug was taken from the page's own menu.
- **CTA plan fee schedule.** The only posted schedule is dated 2015-01-01, so it was not used.
- **An IRS page stating the 2026 investment-expense rule.** None found by search; used Pub 529 plus the statute instead.

- **Fetched but not used:** FINRA Information Notice of 2026-03-17 (the SEC rate change, already covered by the SEC advisory); Alpaca blog "reg-taf-fees" (its curl text was only menus); Cboe "SIP fees" page (curl text was only menus; not needed once the UTP policy was read).
- **Search summaries not used as sources:** a CAT plan rate of 0.000001 and a forum claim about the share of non-retail accounts, because their pages were not opened.

## 6. Self assessment against the standard

1. **Every figure traced to a live source with a URL and an access date.** Met for every fee, price, bracket, deduction and threshold: each is cited to a page opened on 2026-11-20 (section 3 of this file; section 9 of the deliverable). Two search-summary figures (a CAT plan rate of 0.000001 and a forum claim about the share of non-retail accounts) were dropped because their pages were not opened. The 251 trading days are a count from the NYSE holiday list, and the fixed cost per day is arithmetic, both stated.
2. **No inference, assumption or guess.** Met for figures. Three readings of texts are stated as readings, not facts: fixed costs are not deductible for an investor (Pub 529 plus P.L. 119-21 section 70110); Elite commission applies to both legs; and the newer fee schedule's daily round-up wins over an older article's per-trade wording. Where a number does not exist on any page read (non-retail commission, Alpaca's professional data price, exchange fees on Cost Plus), the page says "not found" and gives an input labeled "your input, not sourced", default 0.
3. **The page's math matches the hand worked examples exactly.** Met: 160 of 160 values match the independent script, both served locally and opened from disk (sequence steps 26 and 30). The page uses no storage and loads only Chart.js from a public CDN.
4. **What remains unknown and what would change the results.** Met: deliverable section 8.

**Where the run fell short**
- Alpaca's professional data price and non-retail commission could not be found without contacting Alpaca, which the brief forbids.
- The business account article is from December 2022 and names a former data supplier; no newer statement was found.
- The CTA plan's fee schedule was not read (only a 2015 schedule is posted).
- The SEC rate for fiscal 2027 is not yet set; the page uses the rate in force.
- Fly's under-5-dollar waiver could not be applied without checking stack C's Fly organization, which is off limits for this run.

## Appendix: the independent example script

Run with `python3 -I examples.py`. It shares no code with the page.

```python
"""Independent hand-check of the strategy run 2 worked examples (Decimal arithmetic).
Not shared with the page's JavaScript, so a match is not circular."""
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_CEILING
import json, sys

def cents_up(x):            # each fee type's daily total rounded UP to the cent (Alpaca fee schedule)
    return x.quantize(D('0.01'), rounding=ROUND_CEILING)
def c(x):                   # display rounding
    return x.quantize(D('0.01'), rounding=ROUND_HALF_UP)

SEC = D('0.0000206'); CAT = D('0.000003')
TAF = {'2026': (D('0'), D('0')), '2027': (D('0.000195'), D('9.79'))}
STD = {'2026': {'single': 16100, 'mfj': 32200, 'mfs': 16100, 'hoh': 24150, 'qss': 32200},
       '2027': {'single': 16600, 'mfj': 33200, 'mfs': 16600, 'hoh': 24925, 'qss': 33200}}
BR = {  # upper bounds of 10,12,22,24,32,35 percent bands; 37 above
 '2026': {'single': [12400, 50400, 105700, 201775, 256225, 640600],
          'mfj':    [24800, 100800, 211400, 403550, 512450, 768700],
          'mfs':    [12400, 50400, 105700, 201775, 256225, 384350],
          'hoh':    [17700, 67450, 105700, 201750, 256200, 640600]},
 '2027': {'single': [12800, 52025, 109125, 208325, 264550, 661375],
          'mfj':    [25600, 104050, 218250, 416650, 529100, 793650],
          'mfs':    [12800, 52025, 109125, 208325, 264550, 396825],
          'hoh':    [18250, 69650, 109100, 208300, 264550, 661350]}}
RATES = [D('0.10'), D('0.12'), D('0.22'), D('0.24'), D('0.32'), D('0.35'), D('0.37')]
NIIT_T = {'single': 200000, 'mfj': 250000, 'mfs': 125000, 'hoh': 200000, 'qss': 250000}

def income_tax(ti, year, status):
    b = BR[year]['mfj' if status == 'qss' else status]
    tax = D(0); lo = D(0)
    for i, r in enumerate(RATES):
        hi = D(b[i]) if i < 6 else None
        if hi is None or ti <= hi:
            tax += (ti - lo) * r; return tax
        tax += (hi - lo) * r; lo = hi
    return tax

def run(e):
    R, G, S, P = D(e['R']), D(e['G']), D(e['S']), D(e['P'])
    Dy = D(e['Dy']); Dm = Dy / 12 if e.get('Dm') is None else D(e['Dm'])
    SS = D(e['SS']); y = e['year']; st = e['status']
    taf_rate, taf_cap = TAF[y]
    gross = R * G
    sec = cents_up(R * S * P * SEC)
    taf_trade = min(S * taf_rate, taf_cap) if P >= taf_rate else D(0)
    taf = cents_up(R * taf_trade)
    cat = cents_up(2 * R * S * CAT)
    comm_rate = {'retail': D(0), 'elite_allin': D('0.0040'), 'elite_costplus': D(e.get('cp', '0.0025')),
                 'nonretail': D(e.get('nr', '0'))}[e['acct']]
    comm = 2 * R * S * comm_rate
    spread = R * SS
    fixed_m = D('4.41') * e['stacks'] + D('10') * e['stacks'] + (D('99') if e['atp'] else 0) + (D('100') if e['max'] else 0)
    fixed_d = fixed_m * 12 / Dy
    var_d = sec + taf + cat + comm + spread
    nbt_d = gross - var_d - fixed_d
    T = Dy * (gross - var_d)                      # trading profit for tax; fixed costs not deductible
    if T <= 0:
        itax = D(0); niit = D(0); ti = D(0)
    else:
        ti = max(D(0), T - STD[y][st]); itax = income_tax(ti, y, st)
        niit = D('0.038') * max(D(0), T - NIIT_T[st])
    tax_y = itax + niit
    rows = {}
    for name, per_day, monthly_fixed in [
        ('gross', gross, 0), ('sec', sec, 0), ('taf', taf, 0), ('cat', cat, 0), ('commission', comm, 0),
        ('spread', spread, 0)]:
        rows[name] = (per_day, per_day * Dm, per_day * Dy)
    rows['fixed'] = (fixed_d, fixed_m, fixed_m * 12)
    nbt = (rows['gross'][0] - var_d - fixed_d, rows['gross'][1] - var_d * Dm - fixed_m, rows['gross'][2] - var_d * Dy - fixed_m * 12)
    rows['net_before_tax'] = nbt
    rows['federal_tax'] = (tax_y / Dy, tax_y / 12, tax_y)
    rows['net_after_tax'] = tuple(nbt[i] - rows['federal_tax'][i] for i in range(3))
    be = (Dy * var_d + 12 * fixed_m) / (Dy * R)
    out = {k: [str(c(v)) for v in vals] for k, vals in rows.items()}
    out['tax_detail'] = {'trading_profit_for_tax': str(c(T)), 'taxable_income': str(c(ti)),
                         'income_tax': str(c(itax)), 'niit': str(c(niit))}
    out['break_even_gain_per_round_trip'] = str(be.quantize(D('0.0001'), rounding=ROUND_HALF_UP))
    out['fixed_monthly'] = str(c(fixed_m))
    return out

EX = {
 'A': dict(R=9089, G='0.01', S='1.45', P='15.40', Dy=251, SS='0', acct='retail', stacks=1, atp=True, max=False, year='2026', status='single'),
 'B': dict(R=500, G='0.50', S=10, P=20, Dy=251, SS='0.05', acct='retail', stacks=2, atp=True, max=True, year='2027', status='mfj'),
 'C': dict(R=2000, G='1.00', S=100, P=50, Dy=251, SS='0.10', acct='elite_allin', stacks=1, atp=True, max=False, year='2027', status='hoh'),
 'D': dict(R=1000, G='0', S=5, P=10, Dy=251, SS='0', acct='retail', stacks=2, atp=True, max=True, year='2027', status='single'),
 'E': dict(R=1000, G='1.00', S=10, P=20, Dy=251, SS='0.02', acct='retail', stacks=1, atp=True, max=True, year='2027', status='single'),
}
if __name__ == '__main__':
    print(json.dumps({k: {'inputs': v, 'result': run(v)} for k, v in EX.items()}, indent=1, default=str))
```
