# Strategy run 2 brief: trading costs and a cost calculator

## Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:

- Launched from `~/Projects/sib-tech` in a fresh session, with no other Claude Code session working in this repo.
- Model: Opus 5.5, medium effort. Advisor: on, Opus 5.5. Auto-mode: on.
- Playwright MCP confirmed connected with `/mcp` before pasting.
- Copied from the raw file in TextEdit.

## What changed from the previous run

- Strategy run 1 described past bull market winners from daily bars (`strategy/runs/strategy-run-1-deliverable.md`). Its section 7, point 3 quoted trading costs of "about 0.27 percent of each round trip's value", taken from `PROJECT_STATE.md`. Michael says that figure is far too high.
- Michael's paper account fees, as he reports them: 3.88 dollars on 16,204 filled trades (2026-11-17) and 4.26 dollars on 18,256 filled trades (2026-11-18). A Claude Code session told him paper may not charge everything a live account would, and that a live account would likely also pay FINRA's trading activity fee on shares sold.
- Lever: instructions (a new question: costs). Strategy run 1's data changes come later, in strategy run 3. This run does not touch run 1's files.
- Nothing in this run is financial or tax advice. Say so in the deliverable and on the page.

## Step zero: save this brief

1. Check the date with `date`.
2. Write this entire brief, verbatim and unedited, to `strategy/runs/strategy-run-2-brief.md`.
3. Create `strategy/runs/strategy-run-2-trajectory.md` and paste this brief into its first section.

## The goal

When this run is done, Michael can open one page, type in how he expects to trade, and see every cost of trading at that volume, each with its source, and what is left after costs and federal tax. He also understands what would put his Alpaca account in a commercial or professional category instead of retail, and what that costs.

The rule for every figure: it comes from a live source with a URL and access date. No inferences, assumptions or guesses. If a figure cannot be found, the page says "not found" and the deliverable says what was searched. Do not estimate it.

## What to research

1. Per trade regulatory fees on sales, with current rates and how each is calculated:
   - SEC Section 31 fee (on the dollar value of shares sold).
   - FINRA trading activity fee (per share sold, with any per trade cap).
   - Consolidated Audit Trail (CAT) fees: whether and how they reach a retail Alpaca customer.
   - Any other fee Alpaca passes through on stock trades.
2. Alpaca's own charges: commissions for a retail account, and for any other account category. Say which pages state them.
3. Retail versus commercial at Alpaca: what Alpaca's own documents say makes an account commercial (or business, entity, institutional) rather than retail, and what each costs (commissions, fees, data). Quote the defining text.
4. Professional versus non professional status for market data: how the exchanges and Alpaca define a professional subscriber, what triggers it, and what it costs, including whether Algo Trader Plus pricing changes.
5. Fixed monthly costs, from each vendor's own pricing page:
   - Alpaca Algo Trader Plus (99 dollars a month published, to be reconfirmed).
   - Fly.io: one shared CPU machine with 512 MB of memory, always on, in San Jose (sjc), per stack.
   - Supabase: an additional project at Micro compute inside an existing Pro organization, per stack.
   - Claude Max, the 100 dollar a month tier.
6. Federal income tax on short term trading gains for the current tax year (and next year if already published): how short term gains are taxed, the brackets and standard deduction for each filing status, and the net investment income tax with its thresholds. Sources: IRS pages or official publications.
7. Where the 0.27 percent figure came from: read `PROJECT_STATE.md` and, read only, the build logs in `builds/`, and state what that figure measured (for example whether it included spread, slippage or price moves, not only fees). Do not open anything under `stacks/`.

## The calculator page: `strategy/runs/strategy-run-2-calculator.html`

Inputs Michael sets, each labeled clearly:
- Round trips per day (a round trip is one buy and the sell that closes it).
- Gain per round trip, in dollars, before any costs. Label it exactly that way, and note in the deliverable that Michael called it "net gain per round trip" and should confirm the meaning.
- Average shares per trade and average share price (the regulatory fees depend on them).
- Trading days per month and per year, with sourced defaults (for example the exchange holiday calendar).
- Spread and slippage per round trip: a field Michael sets, labeled "your input, not sourced". Default 0.
- Account category (retail, and any other category found), which switches the commission and data costs where a source supports it.
- Number of stacks (1 or 2), for the fixed costs. A switch to include or exclude Claude Max (Michael uses it for other work too).
- Filing status selector for federal tax. No other tax inputs.
- Every sourced rate shown in an editable field prefilled with the sourced value, so Michael can adjust it, with a reset to the sourced value.

Outputs, per day, per month and per year:
- Gross gain; each regulatory fee; commissions; spread and slippage; fixed costs; net before tax; federal tax; net after tax.
- The break even gain per round trip (the gain at which net before tax is zero).
- A chart of net after tax against gain per round trip, at the current inputs.
- How the tax is computed, stated on the page: brackets and standard deduction for the chosen status, applied as if trading profit were the only income, because Michael gave no other income. Say so plainly.

Placeholders, visible on the page as "not yet evaluated": the wash sale rule, the mark to market election (trader tax status), other income, and state tax.

Also on the page, as a reference panel: Michael's two reported paper days (fills and fees), with the note that paper may not charge everything a live account would.

Every sourced number on the page links to its source (URL and access date). The page opens with a double click on Michael's Mac, with no server, sends nothing anywhere and stores nothing. A charting library may load from a public CDN.

## The output

Build in this order: the markdown first, then the trajectory's self assessment, then the page.

### `strategy/runs/strategy-run-2-deliverable.md`, the source of record

1. Summary in bullets: the cost items that matter most at Michael's volume, and the retail versus commercial answer.
2. Every fee and rate: what it is, how it is calculated, the current value, the source.
3. Retail versus commercial, and professional versus non professional: definitions quoted, triggers, costs.
4. Fixed monthly costs, itemized.
5. Federal tax: the rules used, and the placeholders not yet evaluated.
6. The 0.27 percent figure: what it measured, and why it differs from fees alone.
7. Worked examples: at least three sets of inputs, computed by hand in the deliverable and matched exactly by the page (state the inputs and every line of the result). One example uses Michael's paper day of 2026-11-18 (18,256 fills) with the shares and price left as stated inputs.
8. What is not found or unsettled, and what would change the results.
9. Sources: numbered footnotes on every claim, linking to a sources list with URL, access date and a strength label (the same scale as `runs/run-3-deliverable.md` section 5). Every price labeled "published" (on the vendor's page) or "gated" (behind a form or signup).

Formatting: bullets and tables, no paragraph longer than three sentences, plain English, acronyms defined the first time, no em or en dashes. Michael is a non-coder.

### Testing the page

- Check every worked example on the page against the deliverable, exactly.
- Test with Playwright, served locally: every input, the reset buttons, the filing status selector, the chart, at desktop and phone width.

## The standard

Michael accepts the work when all of these hold:

1. Every figure traced to a live source with a URL and an access date.
2. No inference, assumption or guess anywhere. Anything not found is marked "not found", never estimated.
3. The page's math matches the hand worked examples exactly.
4. You state what remains unknown and what would change the results.

## Documenting your work: `strategy/runs/strategy-run-2-trajectory.md`

Append as you work, not at the end. Six parts: the brief as given, the sequence of what you did, sources with URL and access date, decision points with reasons, dead ends, and a self assessment against the standard. Do not record time spent or token cost.

## Run conventions

- Files: `strategy/runs/strategy-run-2-brief.md`, `-deliverable.md`, `-calculator.html`, `-trajectory.md`.
- Add one line to `strategy/runs/README.md`: "2", the date, "instructions: new question, trading costs", outcome.
- Add one dated line to `PROJECT_STATE.md` under Completed, pointing to the deliverable. Change nothing else in that file.
- No market data is needed in this run. Do not use `strategy/.env.local`.
- Committed files stay under 50 MB.
- Before the commit, run `node scripts/secret-scan.mjs --tree`.
- Done means all files written, the page browser tested, the index and the `PROJECT_STATE.md` line written, and one commit and one push at the end of the run. Auto-mode's research run carve-out covers that commit and push.
- Then end the session. Do not start strategy run 3.

## Prohibitions

- No live trading.
- No orders of any kind, paper or live, from strategy work. Never call a trading host.
- Nothing touching the stacks' resources: their folders, accounts, keys, databases, deployments, Discord servers or heartbeat checks.
- No credentials in files or commits.
- No account creation, signups, trials, purchases, contact forms or emails to any vendor.
- No reading `~/Projects/relii`.
- Never send Michael's personal information to any site or service, including in request headers, and do not disguise automated requests as a regular browser. If a page refuses plain requests, read it with Playwright or skip it and record it.
- Give these prohibitions, word for word, to any helper you start.
