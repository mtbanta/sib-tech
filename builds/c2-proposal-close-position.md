# Proposal: would Alpaca's close-position call shorten the 2:55 gap?

**Status: research only. No code until Michael approves.** No order, cancel or close-position call was made, not even on paper. Sections 1 to 8 were written from documents and records only; section 9 adds read-only GET reads of Alpaca's paper order history (the key read only inside a script, never printed).

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

## 9. Measured: Alpaca's hold of the stack's sales, by time of day (read only, 2026-11-16 evening)

**What was done.** Unlike the sections above, this section did read Alpaca: GET requests only, to the paper API, after the close on Monday 2026-11-16 (179 reads, paced under 90 a minute; no order, cancel or close call). The keys were read inside a script and never printed. Source: Alpaca's order history (`/v2/orders`, all statuses, sells only, 7:00 AM to 4:30 PM Central each day), every trading day from Monday 2026-11-02 to Monday 2026-11-16, counted by distinct order id. From it: every order whose client id starts `cyrus-x-` (the stack's sales, 620) or `cyrus-p-` (fresh stops, 108). Bracket exit legs and entries are left out. For each order: the hold (`submitted_at` minus `created_at`) and the fill time (`filled_at` minus `submitted_at`). Times are Central. "Measured" below means read from those timestamps; "inferred" means my reading of them.

**Short answer (measured).** The hold is tied to the clock, not to the number of sales. Every sale created in the 2:55 close-out, on every day that had one (8 days, 38 sales), was held 11.5 to 16.3 seconds, including days with a single sale. No sale at any other time of day was held more than 6.2 seconds, and the mid-day close-out's bursts of 14 to 20 sales were held at most 0.7 seconds. All 728 orders are `filled` or `canceled` now; the status each showed during the hold is not in the record.

### 9.1 By time of day (the stack's sales, all days together)

| Time of day | Sales | Median hold | Highest hold | Median fill after submit |
| :-- | --: | --: | --: | --: |
| Before 9:30 AM | 160 | 0.01 s | 6.17 s | 1.46 s |
| 9:30 AM to 2:00 PM (mid-day close-out excluded) | 333 | 0.01 s | 1.54 s | 1.28 s |
| Mid-day close-out, 10:30 to 10:35 | 86 | 0.07 s | 0.70 s | 1.80 s |
| 2:00 to 2:55 PM | 3 | 0.01 s | 0.02 s | 2.00 s |
| **2:55 close-out** | **38** | **13.74 s** | **16.27 s** | **4.36 s** |

Fresh stops (108, resting stop orders, a different order type) were never held long: highest 1.41 s, and those placed latest in the day (2:44, 2:50 and 2:52 PM) were held 0.003 to 0.51 s. None was placed at 2:55.

### 9.2 The 2:55 close-out, per day (measured)

| Day | Sales at 2:55 | Created | Submitted by Alpaca | Hold, median (highest) |
| :-- | --: | :-- | :-- | :-- |
| Wed 11-04 | 2 | 2:55:17.5 | 2:55:33.8 | 16.27 s (16.27) |
| Thu 11-05 | 1 | 2:55:13.9 | 2:55:26.5 | 12.60 s |
| Fri 11-06 | 2 | 2:55:09.6 | 2:55:25.5 to 25.6 | 15.94 s (15.95) |
| Mon 11-09 | 1 | 2:55:13.2 | 2:55:27.5 | 14.28 s |
| Wed 11-11 | 1 | 2:55:14.8 | 2:55:29.4 | 14.60 s |
| Thu 11-12 | 5 | 2:55:16.2 to 16.5 | 2:55:29.4 to 29.7 | 13.17 s (13.19) |
| Fri 11-13 | 13 | 2:55:08.2 to 09.2 | 2:55:22.6 to 24.5 | 14.87 s (15.28) |
| Mon 11-16 | 13 | 2:55:08.2 to 09.3 | 2:55:19.8 to 21.2 | 11.76 s (11.89) |

- **Days without a 2:55 sale:** Tue 11-03 (the day's last sale was at 8:53 AM; the build log records the daily loss stop that day) and Tue 11-10 (the daily loss stop sold everything at 1:57 PM, so the account was flat by 2:55; build C2 log, "Requests" and "How fast it sold everything" for that day).
- **Mon 11-02** had no `cyrus-x-` sales (that day used Alpaca's bulk close, section 2). Its 5 plain market sales at 2:55:20 to 2:55:22, not counted above because they carry Alpaca's own ids, were held the same way: 11.6 to 12.3 s.
- **Not a fixed clock time for the release (measured).** Sales created at 2:55:08 were submitted at 2:55:20 to 2:55:24; sales created at 2:55:17 were submitted at 2:55:34. The hold runs about 12 to 16 s from each sale's creation, whenever in the minute it was created.
- **Slower fills too (measured):** at 2:55, fills took a median 4.4 s after submit (up to 14.0 s), against 1.3 to 1.8 s at other times.

### 9.3 By how many sales were sent together (measured)

Burst size here is the number of the stack's sales created within 5 seconds either side of each sale.

| Burst size | Not at 2:55: sales, median hold, highest | At 2:55: sales, median hold, highest |
| :-- | :-- | :-- |
| 1 | 395, 0.01 s, 6.17 s | 3, 14.28 s, 14.60 s |
| 2 to 3 | 35, 0.01 s, 0.11 s | 4, 16.11 s, 16.27 s |
| 4 to 9 | 5, 0.01 s, 0.02 s | 5, 13.17 s, 13.19 s |
| 10 or more | 147, 0.02 s, 0.70 s | 26, 13.18 s, 15.28 s (two days: about 14.9 and 11.8) |

The largest bursts away from 2:55, each the same whole-account close-out code as at 2:55 (inferred from the code: the mid-day close-out and the loss stop call the same close-out and its "cancel everything", `src/sells.ts`):

| Burst | Sales | Hold, median (highest) | Exit cancels landed |
| :-- | --: | :-- | :-- |
| Mid-day close-out, 11-10 | 18 | 0.04 s (0.16) | before the first sale |
| Mid-day close-out, 11-11 | 20 | 0.39 s (0.54) | before the first sale |
| Mid-day close-out, 11-12 | 14 | 0.02 s (0.13) | before the first sale |
| Mid-day close-out, 11-13 | 18 | 0.54 s (0.70) | before the first sale |
| Mid-day close-out, 11-16 | 14 | 0.04 s (0.17) | before the first sale |
| 11-13, 11:54 AM | 19 | 0.01 s (0.03) | before the first sale |
| Loss stop, 11-10, 1:57 PM | 17 | 0.01 s (0.13) | 1:56:59.3 to 59.4, about 1 s before the first sale |
| Afternoon close-out, 11-16, 1:20 PM | 17 | 0.005 s (0.02) | before the first sale |

So a burst of 17 to 20 sales is not held at 10:30, 11:54, 1:20 or 1:57, while a single sale is held 12.6 to 14.6 s at 2:55. Within a burst, the last sale's hold is a little longer than the first's (about 0.3 to 0.8 s at mid-day, 0.3 to 0.8 s at 2:55), consistent with sales passing through one at a time; that is minor next to the 2:55 hold.

### 9.4 Were the exits' cancels still pending during the hold? (measured from the exit orders' own records)

No. On every 2:55 day, every exit order cancelled between 2:54 and 2:58 (bracket legs and fresh stops, read from their `canceled_at`) shows its cancel before the first sale was created: for example 11-16, cancels 2:55:01.64 to 06.73, first sale 2:55:08.21; 11-12, cancels 2:55:05.5 to 15.4, first sale 2:55:16.2. The same holds at the mid-day close-outs and at the other bursts above. So the hold is not Alpaca waiting for those cancels to finish. (A record keeps only the final cancel time, not a history of statuses, so this rests on `canceled_at`.)

### 9.5 Smaller finding: some morning sales held 1.3 to 6.2 s (measured)

Ten single sales were held 1.3 to 6.2 s, nine between 8:45 and 9:15 AM and one at 10:00 AM (highest 6.17 s, APLD at 9:00 AM on 11-11; 4.15 s, DBX at 8:45 AM on 11-10), all alone, not in bursts. Not part of the 2:55 question; noted so it is not mistaken for the same effect.

### 9.6 What this does and does not settle

- **Measured:** the 11.5 to 16.3 s hold happened at every 2:55 close-out on record (8 of 8 days, plus 11-02's bulk sales), for 1 to 13 sales alike; the same close-out code at 10:30, and bursts of up to 20 sales at other times, were not held; the exits' cancels had finished before each held sale was created.
- **Not measured: when the held period begins.** The latest market sale before 2:55 on any day was at 2:10 PM (held 0.02 s); between then and 2:55 there are only fresh stops (a different order type, not held as late as 2:52:17). So this neither supports nor rules out fix A of the Monday review (starting the close-out a few minutes earlier): a 2:50 sale might be held the same way. What would measure it: the time of the earliest held sale, which only a sale sent between about 2:30 and 2:55 can show. The daily reviews could watch for any sale the stack happens to send in that span (no code change), or a close-out moved earlier for one paper day would show it directly (a money-touching change for Michael to rule on).
- **Not measured: why Alpaca holds these sales.** One guess, not checked: 2:55 PM Central is 3:55 PM Eastern, inside the last minutes before the market's closing auctions, and Alpaca's paper system may queue market orders in that span. Alpaca's documentation was not checked for this here. An answer from Alpaca support, or the documentation, would turn the guess into a fact.
- **Not measured: the status during the hold.** Every one of these orders now shows `filled` or `canceled`; whether it showed `accepted`, `held` or something else during the hold is not in the order history. Recording Alpaca's live order updates during a 2:55 close-out might show it, if Alpaca sends one during the wait (not known).

Paper trading only; research input for a human decision, never an instruction to act.
