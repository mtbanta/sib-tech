# Proposal: would Alpaca's close-position call shorten the 2:55 gap?

**Status: research only. No code until Michael approves.** Nothing here was run against Alpaca. No order, cancel or close-position call was made, not even on paper. No key was read.

Stack C (cyrus), paper trading only. Written Monday 2026-11-16, evening (Central). Times are Central unless stated.

## The question

Michael's words (build C2 log, "Michael's answers on the end-of-day questions (2026-11-16, evening), saved verbatim"): research, read only, "whether Alpaca's close-position call (cancelling the exits and selling in one step on Alpaca's side) would shorten the 2:55 gap, as a proposal for later."

## Short answer

**No, not in any way worth the risk.** Alpaca's documentation says nothing about the single-position close cancelling the exits, and an Alpaca staff member says it is refused (Alpaca's refusal code 403) while a take-profit or stop still holds the shares. The bulk close-all call does cancel first, but as two steps, not one. On 2026-11-02 it cancelled the stops and then had every sale refused (the reason was not recorded; the likely one is that the cancels had not finished). Neither call touches the two long waits in Monday's gap: Alpaca's 5.0 second cancel and its 11.5 to 11.9 second hold before it submitted the sales. The most either call could save is the stack's own part, 1.5 to 2.5 seconds, and probably less, because the stack would still have to see the cancels finish before sending a single close. To get that, it would have to go around the sell gate and undo a rule written because of a real failure.

**Recommendation:** do not adopt either call. First measure the hold, read only, from order history Alpaca already has (section 7). If the hold turns out to be tied to the 2:55 moment, the cheaper lever is the timing change already proposed as fix A in the Monday review.

## 1. The 2:55 gap, as measured on Monday 2026-11-16

Source: build C2 log (the build's running record), "### Monday 2026-11-16 end-of-day session review", "#### 4. The 2:55 close-out".

| Part of the gap | Whose | How long |
| :-- | :-- | :-- |
| Cancel of the exits: one "cancel everything" sent 2:55:01.59; AGNC's take-profit and the 12 fresh stops ended only at 2:55:06.66 to 06.73 | Alpaca | 5.0 s |
| From the last cancel landing to the stack's sales being created (13 sales, about 80 ms apart) | the stack | 1.5 to 2.5 s |
| From each sale being created to Alpaca submitting it (`created_at` to `submitted_at`) | Alpaca | 11.5 to 11.9 s |
| From submit to fill | Alpaca (paper simulation) | 1.2 to 12.9 s |
| **Total time without a stop** | | **15.0 to 27.1 s** |

The same hold was seen at 2:55 on 2026-11-04 (two sales held 16 s) and 2026-11-11 (PCG's sale held 14.6 s). At 1:20 on Monday the same kind of sale was submitted within 22 ms.

**What "held" means here.** In the review it is the time between Alpaca's `created_at` and `submitted_at` on each sale. I did not find the status each sale showed during that time recorded in the log. `held` is a value in Alpaca's order status list (the `OrderStatus` list in Alpaca's API reference, F1's page; API means application programming interface, the set of web requests the worker uses to talk to Alpaca), but the documented status table that explains each status does not describe it (F6). The stack has seen `held` on bracket legs waiting for their entry to fill (build C2 log, "Review round 1 (2026-11-02, evening)", "One assumption checked on Alpaca paper"). Whether the 2:55 sales showed `held`, `accepted` or something else during the wait is not known; the order-history read in section 7 would not show it either (an order record carries timestamps, not a history of its statuses), but recording Alpaca's live order updates at 2:55 might, if Alpaca sends one during the wait (not known).

## 2. The 2026-11-02 incident: what failed

Sources: build C2 log, "### The close-out bug: what really happened (settled from the Fly logs)"; build C log, "Build C closing section (2026-11-02, evening)", "Faults found in the first paper session"; the old code in git (`stacks/cyrus/src/alpaca-trading.ts`): `closeAllPositions` in commit `2492a71`; `closePosition` added in `1d97da5` and still present at `44b1971`.

- The close-out then used the **bulk call**, `DELETE /v2/positions?cancel_orders=true` (the old `closeAllPositions`).
- At 2:55:05 PM, Alpaca answered 207 (one result per position) with an error for **all five** positions (AEM, COO, FIS, HRL, RMD). **It placed no sale, but it had already cancelled the protective stops.**
- The stack's order sync, running every 30 seconds, then found five held positions with no stop. It sold each one with the **single-position call**, `DELETE /v2/positions/{symbol}` with no parameters (the old `closePosition`). **Each of those sales succeeded.** It also raised five false "had no live protective stop" alerts.
- The second bulk attempt, at 2:55:36, failed again for AEM and COO. Their sync sales had been sent but had not filled yet.
- The account was flat at 2:55:42. The close-out reported success only because the order sync had done the selling.
- **Alpaca's per-item error text was not kept** (the wrapper saved only the symbols). The log's best explanation, marked as a guess: Alpaca cancels the stops without waiting. Until a cancel completes, the stop still holds the shares, so the full-size sale is refused with "insufficient qty available".

After this, the bulk call and the single-position call were both removed. Every sale now goes through `stacks/cyrus/src/sells.ts`. A structure test in `stacks/cyrus/test/gate.test.ts` fails if any file under `src` (tools included) calls `closeAllPositions` or `closePosition`, or contains `DELETE /v2/positions` in either form. A second test in `stacks/cyrus/test/alpaca-trading.test.ts` checks that the Alpaca client has neither method.

## 3. The two calls are different

| | Bulk: `DELETE /v2/positions` | Single: `DELETE /v2/positions/{symbol}` |
| :-- | :-- | :-- |
| What it closes | Every open position | One symbol |
| Parameters (documented) | `cancel_orders` (true or false) | `qty` or `percentage` (not both) |
| Cancels open orders? | Only with `cancel_orders=true`, "before liquidating" | Not documented; Alpaca staff say it fails with 403 while open sells hold the shares |
| Answer | 207, one result per position | 200 with the sale order it created |
| Used by the stack | Until 2026-11-02 (the close-out) | Until 2026-11-02 (the order sync) |

## 4. What Alpaca documents (facts, with quotes)

All pages read Monday 2026-11-16, about 3:30 PM Central.

**F1. Single-position close.** "Close a Position", https://docs.alpaca.markets/us/reference/deleteopenposition-1.md (page updated 2026-05-27):
- "Closes (liquidates) the account's open position for the given symbol. Works for both long and short positions."
- `qty`: "the number of shares to liquidate. Can accept up to 9 decimal points. Cannot work with percentage"
- `percentage`: "percentage of position to liquidate. Must be between 0 and 100. Would only sell fractional if position is originally fractional. Can accept up to 9 decimal points. Cannot work with qty"
- Response 200: "Returns the order created to close out this position"
- These are the only parameters. Nothing on the page mentions cancelling orders, and there is no client order id parameter.
- The page's `OrderStatus` list includes `held` among its values, with no description of it.

**F2. Bulk close.** "Close All Positions", https://docs.alpaca.markets/us/reference/deleteallopenpositions-1.md:
- "Closes (liquidates) all of the account's open long and short positions. The 207 response contains one result per position: `body` is the closing Order when `status` is 200, otherwise the error describing why that position was not closed."
- `cancel_orders`: "If true is specified, cancel all open orders before liquidating all positions."
- Response 500: "Request-level failure; no per-position results are returned."
- The page's own "Partially Closed" example shows a per-position refusal: status 403, "insufficient qty available for order (requested: 10, available: 2)", with `held_for_orders` "0". So this example is not the case of a stop holding the shares. It only shows the shape of the error.

**F3. Error fields (Broker API, a different product).** The changelog "Error details documented on the close all positions endpoint", https://docs.alpaca.markets/eu/changelog/2026-11-03-close-all-positions-b5d8ac8.md, dated 2026-11-03, covers the Broker API's `DELETE /v1/trading/accounts/{account_id}/positions` on the EU documentation. It says "The wire contract is unchanged" and lists the fields a rejected close can carry: "`symbol`, `existing_qty`, `held_for_orders`, and `available`." It points the same way but is not about the Trading API the stack uses.

**F4. Alpaca staff, on the single close and open orders.** Forum thread "Open Orders Failing to Close on Paper Account", https://forum.alpaca.markets/t/open-orders-failing-to-close-on-paper-account/18533. Reply by Dan_Whitnable_Alpaca (Alpaca staff), 2026-03-05, quoted from the raw post:
- "If there are existing open orders to sell that are part of the position you're trying to close, the request will fail with a 403 error."
- His example log shows `DELETE /papertrader/api/v2/positions/AIFF` refused with `"held_for_orders":"544"`, `"available":"0"`, "insufficient qty available for order (requested: 544, available: 0)".
- "First, cancel any open orders. Wait until the order's status is `canceled`. Then submit ..." (he goes on to a limit order, because his question was about after hours).
- "The only reason you would ever get a 403 error is if there are existing sell orders."
- "Errors are generally never 'retryable' ... The single exception to this is a 500 error ... if submitting an order, there is a chance that the initial request succeeded, and you will end up submitting a duplicate order. To avoid this, include a client order ID in the request."

**F5. Alpaca staff, on closing a bracket position.** Forum thread "Bracket Order - Closing Positions", https://forum.alpaca.markets/t/bracket-order-closing-positions/11938. Dan_Whitnable_Alpaca, 2023-03-01:
- "Canceling one leg of a bracket order will cancel the other leg too. It won't liquidate anything."
- "The best way to 'sell out' or close a position which has an outstanding bracket order is to replace the take profit limit price with a 'marketable' price. The take profit limit leg will then execute immediately and close the position. This is nice because it keeps all 3 orders intact."

**F6. Order statuses and bracket rules.** "Placing Orders", https://docs.alpaca.markets/us/docs/orders-at-alpaca.md:
- `pending_cancel`: "The order is waiting to be canceled."
- `accepted`: "The order has been received by Alpaca, but hasn't yet been routed to the execution venue. This could be seen often out side of trading session hours."
- Brackets: "If any one of the orders is canceled, any remaining open order in the group is canceled."
- The page has no rule that holds market orders near the close. The only closing-time cutoffs it lists are for "market on close" and "limit on close" orders ("CLS orders submitted after 3:50pm but before 7:00pm ET will be rejected"), which the stack does not use.

**F7. Paper simulation.** "Paper Trading", https://docs.alpaca.markets/us/docs/paper-trading.md: "paper trading is only a simulation"; "When orders are eligible to be filled, they will receive partial fills for a random size 10% of the time." Alpaca staff on the forum explain paper fill delays by these random partial fills ("Paper Trading market orders fill delay", https://forum.alpaca.markets/t/paper-trading-market-orders-fill-delay/18681, Dan_Whitnable_Alpaca, 2026-04-10, quoted from the raw post: "In paper trading, the simulator interjects random partial fills." and "These are the times when Alpaca first received the order and when it actually filled (the `created_at` and `filled_at` fields in the order record)."). That explains slow **fills**, not a wait before **submission**. In a paper order posted in 2023 that the same staff member discussed ("Paper trading order fulfillment delay", https://forum.alpaca.markets/t/paper-trading-order-fulfillment-delay/13324, raw post), `created_at` is 16:21:00.676787Z and `submitted_at` 16:21:00.684911Z, about 8 ms apart.

**F8. Not found.** No Alpaca page, forum post or status note I found describes a 10 to 16 second wait between `created_at` and `submitted_at` near the close. **The 2:55 hold is undocumented.**

**One unconfirmed user claim.** In the forum thread "403 - insufficient qty available for order (requested: 40, available: 0)", https://forum.alpaca.markets/t/403-insufficient-qty-available-for-order-requested-40-available-0/15147 (2024-10-10), a user (not staff) says the single close worked once he passed "cancel_orders": true. That parameter is not in the single call's documented definition (F1), and no staff member confirmed it. Treat it as unknown. Only a paper test would settle it.

## 5. Answers to the five questions

**Q1. What the single close does.** Documented (F1): it sells the position, or part of it (`qty` or `percentage`), and returns the order it created (Alpaca staff add that it creates a market order, F4). The documentation says nothing about cancelling the take-profit or stop first. Alpaca staff say it is refused with 403 while open sells hold the shares, and that one must cancel and wait for `canceled` first (F4). On 2026-11-02 the stack's own single closes succeeded, but only after the stops were already gone (section 2). So with the exits still resting, the single close would fail. After the exits are cancelled, it is just another way of sending the same market sale.

**Q2. What it returns, and whether it is one step.** Documented: the created sale order (single) or one result per position (bulk). The bulk call with `cancel_orders=true` cancels "before liquidating" (F2). That is two steps inside Alpaca. Measured on 2026-11-02: the first step (the cancels) happened and the second (the sales) was refused for every position, which left them with no stop and no sale. Why it was refused was not recorded; the likely reason (a guess) is that the cancels had not finished. **Inference:** Alpaca's cancels are not instant (Monday: 5.0 s; 2026-11-02 evening: about 0.22 s), so the bulk call cannot avoid the cancel wait. Either it waits (no gain), or it doesn't wait and is refused (the 2026-11-02 failure). Nothing documents how fast either call acts.

**Q3. The bulk call's `cancel_orders` and why it fails.** Documented: "cancel all open orders before liquidating all positions" (F2). A position that is not closed comes back in the 207 with an error, typically 403 "insufficient qty available", with `held_for_orders` showing shares tied up by open orders (F2, F3, F4). **Inference, not proven:** this is what happened on 2026-11-02. The cancels were still pending, so the stops still held the shares. The error text was not kept that day, so this is not a measurement. Also: the bulk call closes **every** position, so a close-out of one symbol is not possible with it.

**Q4. Is the hold documented?** No (F8). Two things are worth separating:
- **Not pending cancels.** By Monday's timestamps, every exit had ended before the stack created its first sale, and the sales were still held 11.5 s after that. So "sales held while bracket legs are pending cancel" does not explain Monday's hold. (On 2026-11-11, PCG's take-profit sat "pending cancel" for 8.7 s and its sale was then held 14.6 s; build C2 log, Wednesday 2026-11-11 end-of-day review. So the hold has come both with and without a pending cancel.)
- **Guesses, not measurements:** a queue or batch step in Alpaca's paper simulator around 3:55 PM Eastern (when many paper bots close out), or something tied to the clock near the close. Nothing measured shows which.

**What follows (inference):** a close-position sale would be created at the same moment, in the same system, as the stack's own sale. There is no reason to expect Alpaca to submit it sooner. So no call can be shown to shorten the hold. Only the timing of the close-out (fix A) might, and only if the hold is tied to the 2:55 moment.

**Q5. The sell gate.** See section 6.

## 6. What adopting it would mean for the sell gate (inference, from the code and rules)

The sell gate's rule (`stacks/cyrus/src/sells.ts`): no sale may be larger than the shares held minus the sells already open. That is what keeps the stack long only. A close-position call goes around it, because Alpaca chooses the quantity.

**What would have to change** (all money-touching under Michael's rule of 2026-11-03, so each change needs his ask first, then a group 1 review of up to three rounds):
- CLAUDE.md's rule "Alpaca's bulk 'close all positions' call is not used ... Every sell goes through one checked path".
- The two structure tests (section 2). Even a one-off measurement tool under `src/tools` would trip the test.
- The liquidator and the close-out in `sells.ts` and `closeout.ts`, and their waits.
- The code that recognises the stack's own orders by their `cyrus-` client id (for example `sells.ts`, `risk.ts`, `order-stream.ts`, `worker.ts`). A sale made by a close-position call would carry a client id chosen by Alpaca, since the call takes none (F1). How each of those files would treat such a sale was not checked here.

**Risks:**
- **Oversell or a short sale.** The single close sells the quantity Alpaca holds when it acts. If an entry filled between the stack's last look and the call, Alpaca would sell the bigger amount, which is still long only. **Inferred:** Alpaca refuses a sale when open sells already cover the shares (F4), which would usually stop a double sale. But this is Alpaca's check, not the stack's, and it would be tested only by Alpaca's behaviour, not by the stack's own tests.
- **A double sale with the stack's own sale.** If the stack's sale and a close-position sale were both in flight, the expected result (inferred from F4 and from the second bulk attempt on 2026-11-02) is a 403 refusal of whichever came second. The stack would then have to tell a refusal that is safe from a real failure, which is the false-alert trap of 2026-11-02.
- **No client order id.** The single close has no client order id parameter (F1). Alpaca's own advice for a 500 answer is to retry with a client order id so that a duplicate is refused (F4). Without one, a retry after a 500 could send a second sale. The stack's sales today always carry a `cyrus-` client id. Every retry loop also has to have a limit and a backoff (standing rule of 2026-11-13).
- **The long-only rule.** It would rest on Alpaca's quantity check, not on the stack's own gate. The structure test exists to make that impossible.
- **The bulk call specifically:** it cancels every open order and closes every position at once, with the 2026-11-02 failure mode (stops gone, no sale). It cannot be limited to one symbol.

**Possible gain:** at most the stack's own 1.5 to 2.5 s, and only for the single call used after the cancels. The single close cannot be sent before the cancels finish (F4).

## 7. Recommendation

1. **Do not adopt the bulk call or the single-position call.** Neither shortens the two long waits, which are both Alpaca's. Both go around the sell gate, and the bulk call has already failed this way once.
2. **First, measure the hold, read only.** Make a read of Alpaca's order history (`GET /v2/orders` for closed orders, as the daily summary already does) for past trading days, and list `created_at`, `submitted_at` and `filled_at` for every stack sale. Group them by time of day, for example 2:40 to 3:00 PM in one minute buckets, and compare with sales at the mid-day close-out and the 1:20 afternoon close-out. This answers whether the hold starts at a fixed clock time, whether it grows with the number of sales, and whether it happens every day. It needs no change to code or tests, and it costs only reads after the close. The daily reviews already measure the 2:55 waits (Michael's answer 1), so this extends them backwards over the days already traded.
3. **If the hold is tied to the clock,** fix A of the Monday review (start the close-out a few minutes earlier) is the lever to rule on. It keeps every sale inside the sell gate.
4. **An idea, not a request: Alpaca's own suggestion (F5).** For a position still on its bracket (Monday: AGNC only), replace the take-profit's limit price with a marketable one. The stop stays live until the take-profit fills, so there is no time without a stop at all. It does not cover the 12 remainders on plain "fresh stops", and changing a resting order's price is money-touching. If Michael wants it studied, it would be a separate proposal.

**If Michael still wants the close-position call tried on paper** (not recommended, and not done here), the test would need:
- his explicit approval;
- the structure test and the CLAUDE.md rule changed under a group 1 review;
- a run on a day the worker is not trading, or at a time it is flat, so it cannot race the close-out;
- one or two 1-share positions with resting exits;
- a record of the full answer (status, error body with `held_for_orders`) for each case: the single close with exits live, with exits pending cancel, and after the cancels finished; and the unconfirmed `cancel_orders=true` on the single call.

A script running beside the worker at 2:55 is not safe, because it would race the close-out's own sales.

## 8. Facts and guesses, at a glance

- **Documented:** the single close's parameters and answer (F1); the bulk call's `cancel_orders` and per-position errors (F2); staff: the single close fails with 403 while open sells hold the shares, cancel and wait for `canceled` first (F4); the bracket rules (F5, F6).
- **Measured by the stack:** Monday's gap (section 1); the 2026-11-02 bulk failure, and the single closes succeeding after the stops were gone (section 2).
- **Inferred:** the bulk call is cancel-then-sell, not one step; no call shortens Alpaca's hold; the most to gain is 1.5 to 2.5 s; Alpaca's quantity check would usually refuse a double sale.
- **Unknown, and what would turn it into a measurement:** the cause of the 2:55 hold (the order-history read in section 7, item 2); whether the single close accepts `cancel_orders` (a paper test, section 7); Alpaca's error text on 2026-11-02 (lost).

Paper trading only; research input for a human decision, never an instruction to act.
