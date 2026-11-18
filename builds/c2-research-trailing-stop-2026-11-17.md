# Research: trailing stops at Alpaca, and a cancel-then-trail design (2026-11-17, evening)

Michael's request, verbatim (item 2 of his addition for the 2026-11-18 trials): "Research only, no trial needed tomorrow: does Alpaca allow a trailing stop order (trail_price or trail_percent) as part of a bracket, or only on its own? If only on its own, would a design work that cancels the bracket and places a trailing stop once the price clears a set level? Include how a trailing stop fills when triggered."

Research only. No code, nothing sent to Alpaca. Paper trading only; research input for a human decision, never an instruction to act.

## What Alpaca's documentation says

Source: Alpaca, "Orders at Alpaca", https://docs.alpaca.markets/docs/orders-at-alpaca, read 2026-11-17. Quotes are verbatim.

1. **Only on its own, not in a bracket.** "Trailing stop orders are currently supported only with single orders." The page adds: "we plan to support trailing stop as the stop loss leg of bracket/OCO orders in the future." So a bracket's `stop_loss` cannot be a trailing stop today. The page does not mention a trailing stop in an OTO order either, so that is not documented. The paper tests can settle it if Michael wants.
2. **How it is set.**
   - `trail_price` is "a dollar value away from the highest water mark".
   - `trail_percent` is "a percent value away from the highest water mark".
   - `hwm`, the high water mark, "continuously changes as the market moves towards your favorable way". For a sell, that is the highest price since the order was placed.
3. **How it fills when triggered.** "The order turns into a market order, and it may fill above or below the stop trigger price." So it is a market sale, with no limit on the price once triggered. It also inherits the gap risk of a market order in a fast drop.
4. **When.** "Valid time-in-force values for trailing stop are 'day' and 'gtc'." "Trailing stop will not trigger outside of the regular market hours." (The stack is flat at the close, so this does not matter for it.)
5. **Changing it.** "While the order is pending stop price trigger, you can update the trail parameter by the PATCH method." Also, "you cannot change the price trailing to the percent trailing or vice versa."
6. **For comparison, what a bracket allows.** "Order replacement (`PATCH /v2/orders`) is supported to update `limit_price` and `stop_price`." For a sell stop loss, "The stop price input has to be at least $0.01 below" the base price. Raising a bracket's stop with a replace is supported on paper. Tomorrow's trial (raising the stop twice) measures it: accepted or not, the take-profit kept, a new id, and the requests.
7. **Ids on a replace** (not stated on that page). Today's test B showed the replace returning a new order whose `replaces` field names the old one, so each replace gives a new id.

## Would "cancel the bracket and place a trailing stop once the price clears a level" work?

**It can be built within Alpaca's rules, but it opens a gap with no stop, and the bracket's own stop can do most of the job without one.** Builder's reading, from the documentation above and today's paper tests:

1. **The steps.**
   - Once the price clears the set level, cancel the bracket's legs. Cancelling the take-profit also ends the stop, since they are one-cancels-other.
   - Wait for Alpaca's cancel (the live updates report it).
   - Then send a single trailing stop sell for the shares held.
   - The sell cannot go first. Today's test A showed that while the legs are open, Alpaca refuses a sell for the same shares (403, `held_for_orders`). The stack's sell gate refuses it too.
2. **Cost.** About 2 sent requests per position: one cancel and one order. The confirmations come from the live updates. That is the same as today's fresh stop after a partial take-profit (a cancel, then a stop).
3. **The gap.** Between Alpaca's cancel and its acceptance of the trailing stop, the position has no stop at all.
   - Today, the comparable step (Alpaca's stop cancel to the fresh stop sent, 40 cases) took 1.6 to 5.2 s, median 2.3 s, by the stack's existing remainder path.
   - A dedicated path that waited only for the live cancel update would likely be faster, but that is not measured. Today's market sell after the cancel step filled about 1.0 s after it was sent.
   - The gap matters most exactly when the price is moving.
4. **What it loses.**
   - The take-profit is gone, so the only exit is the retrace that triggers the trail.
   - The trigger becomes a market sale, which can fill below the trail in a fast drop.
5. **What else it has to handle.**
   - Every close-out, the loss stop and the carried-position sale must cancel the trailing stop before selling. They already cancel every open order of the stack's.
   - The missing-exit check must count a trailing stop as protection. Today it looks for the bracket's legs or a `cyrus-p-` fresh stop.
   - A position might be left with neither, if the trailing stop is refused (for example, a price the rules do not accept).
   - All of these are money-touching changes.
6. **The alternative that keeps the bracket.**
   - Raise the bracket's own stop with a replace as the price rises: a "stepped trail".
   - It costs 1 request per step and has no gap, since the stop is never removed.
   - It keeps the take-profit, and Alpaca's one-cancels-other link stays.
   - Its limits:
     - It moves only when the stack sends a step, not with every tick.
     - Each step is a request inside Alpaca's 200 a minute.
     - The stop is a stop order, so it fills at market when triggered, as the trailing stop does.
   - Tomorrow's raise-the-stop trial is the first evidence on whether the replace is accepted on a held stop leg and whether the take-profit stays in place.

**Recommendation (for Michael's decision, after tomorrow's trial):** if the raise-the-stop trial holds up, prefer the stepped trail on the bracket's stop over cancelling the bracket for a trailing stop. It keeps protection continuous and costs 1 request a step against 2 per switch. Either one is a strategy change (when to trail, by how much), which belongs to the next phase that Michael named, the trading strategy, and touches money: his approval and a group 1 review.
