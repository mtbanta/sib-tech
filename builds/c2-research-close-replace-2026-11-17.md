# Research: close-position call and replacing a bracket's take-profit (2026-11-17)

Michael's request (2026-11-17, about 8:25 AM, item b, verbatim): "Research first hand, and test on the paper account with one position at a time if the docs are unclear: does the close-position call (DELETE /v2/positions/{symbol}) cancel that symbol's open exits and sell in one step? Can a bracket's take-profit be replaced to a marketable price above the stop, to sell without a cancel? Report request cost and time to fill."

Read only so far: nothing was sent to Alpaca. Sources accessed 2026-11-17. Research input for a human decision, never an instruction to act. Paper trading only.

## 1. DELETE /v2/positions/{symbol} (close one position)

- Alpaca's reference says only that it "Closes (liquidates) the account's open position for the given symbol" and "Returns the order created to close out this position"; `qty` and `percentage` are optional and exclusive. It has no `cancel_orders` setting and says nothing about cancelling open orders. https://docs.alpaca.markets/reference/deleteopenposition-1
- An Alpaca staff answer on the forum (2026-03-05, on paper): "If there are existing open orders to sell that are part of the position you're trying to close, the request will fail with a 403 error", with a log showing `held_for_orders` and "insufficient qty available for order"; advice: "First, cancel any open orders. Wait until the order's status is `canceled`." https://forum.alpaca.markets/t/open-orders-failing-to-close-on-paper-account/18533
- An older staff answer (2021): outstanding bracket legs count against the shares available and must be cancelled first; "This can take tens of seconds during live trading." https://forum.alpaca.markets/t/unable-to-close-positions/6024
- A direct question about bracket positions (2024) was never answered. https://forum.alpaca.markets/t/bracket-order-closing-positions/11938
- The close-all call, `DELETE /v2/positions?cancel_orders=true`: "If true is specified, cancel all open orders before liquidating all positions"; it answers 207 with one result per position. Users report it failing with `held_for_orders` while a cancelled stop is still `pending_cancel`; this matches our own failure of 2026-11-02 (build C2 log, "The close-out bug: what really happened").
- Request cost: one HTTP request per call (alpaca-py sends one DELETE). Whether a close-all counts as one request or one per position is not documented.
- **Reading:** the per-symbol close does not cancel the exits; with bracket legs open it is most likely refused (403, `held_for_orders`). This is a strong inference from the staff answer about open sell orders, not a documented test on a bracket. It agrees with `builds/c2-proposal-close-position.md` (2026-11-16), which recommended adopting neither call.

## 2. PATCH /v2/orders/{id} on the take-profit leg (replace to a marketable price)

- Bracket legs can be replaced: "Order replacement (`PATCH /v2/orders`) is supported to update `limit_price` and `stop_price`." https://docs.alpaca.markets/docs/orders-at-alpaca . Quantity cannot change ("qty cannot be changed for advanced orders", staff, 2025). https://forum.alpaca.markets/t/updating-profit-and-stoploss/11641
- Alpaca staff suggest exactly this route to sell: replace the take-profit with a "marketable" price; "The first leg (ie legs[0]) is always the take profit limit order." (thread 11938 above)
- A replace returns "The new Order object with the new order ID", but "A success return code from a replaced order does NOT guarantee the existing open order has been replaced"; if the old order fills first the replacement is rejected (reported on the live order updates). An order cannot be replaced while `accepted`, `pending_new`, `pending_cancel` or `pending_replace`, and in `pending_replace` it rejects a cancel. https://docs.alpaca.markets/reference/patchorderbyorderid-1
- Whether the stop is still cancelled when the replaced take-profit fills (the OCO link) is implied, not stated: `group_id` is shared by every order in a bracket "including its legs and any replacement orders" (same page).
- **The key gap:** at submission the take-profit must be above the stop, and staff say it is checked against a base price (the parent's fill price). Nothing says whether these rules apply to a replace. For a losing position (the bid below the entry fill, above the stop), a base-price rule would refuse a marketable replace exactly when it is needed. Staff also warn against prices far below the bid ("fat finger protection").
- Request cost: one PATCH, one request.

## 3. Time to fill on paper

Paper fills are simulated from real-time quotes ("Orders are filled only when they become marketable"; partial fills 10 percent of the time; no latency slippage). No processing times are documented for a close or a replace. Our only figures are our own (the 5.0 s cancel wait and the 11.5 to 11.9 s hold, 2026-11-16 proposal).

## Proposed paper tests (not run; each about 4 requests, 1 share of a cheap liquid name, regular hours)

- **Test A, close one bracket position:** a 1-share bracket entry; after the fill, one per-symbol DELETE. Observe 200 with an order or 403 `held_for_orders`, the legs' status after (one nested order read), time to fill from the live updates, Alpaca's rate-limit headers before and after.
- **Test B1, replace on a winning position:** after the fill, PATCH `legs[0]` to a limit at or a few cents below the bid, above the stop. Observe the new order id, `pending_replace` then `replaced`, the fill, whether the stop is cancelled, and the timings.
- **Test B2, replace on a losing position:** the same when the bid is below the entry fill and above the stop: accepted or refused, and the exact error text.

**When to run them (a question for Michael):** the stack trades the same paper account all session, so a test position would be seen by the worker (its order sync, the carried-position and missing-exit checks, the loss stop's equity and the close-outs) and could be sold by it or confuse its counts. Orders fill only in regular hours, so a test cannot run after the close. Checked in the code (`src/worker.ts`, the carried-position scan): during the session a held position the worker did not enter today is treated as a carried position (the not-flat flag, alerts, and the worker's own carried-position sale), so a test position would set off that path and might be sold by the worker mid-test. The builder's proposal: run them as a coordinated test with Michael's go-ahead for its time (for example after the regular close-out and before the close, or at the mid-day pause), expecting and logging the worker's carried-position reaction, one position at a time, sent from the builder's Mac with the paper key (never a live key). Or, better, a small change for later: let the worker ignore positions whose orders carry a test client id prefix (money-touching, needs Michael's approval and review).
