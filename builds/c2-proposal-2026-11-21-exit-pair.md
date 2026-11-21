# Proposal: an exit pair for leftover shares (2026-11-21)

Michael's request of 2026-11-21, item 3: "The replacement exit pair (OCO) for leftover shares after a partial take-profit, so they can use the moved take-profit. Write the proposal today and send it to me for approval."

Research input for Michael's decision, never an instruction to act. Paper trading only. Nothing here is built.

## 1. What it is, in plain English

When a position's take-profit sells only part of the shares, Alpaca cancels the whole stop. Since 2026-11-12 (A4), the stack then cancels the rest of the take-profit at once and places a **fresh stop**: a plain stop order on the shares left (client id `cyrus-p-`), at the bracket's own stop price. There is no new take-profit (your option a of 2026-11-12).

A fresh stop cannot be "moved" at a close-out the way a bracket's take-profit can. So at a close-out, every leftover position is still sold the old way: cancel the stop, wait for Alpaca to confirm, then a market sale. That's the step with Alpaca's hold and the seconds without a stop.

The proposal is to place an **exit pair** instead of the fresh stop. Alpaca calls it OCO ("one cancels other"). It is one order made of two sells on the same shares:
- a limit sell (the take-profit)
- a stop sell (the protection)

When one fills, Alpaca cancels the other. At a close-out, the stack moves the pair's limit to the bid less 1 cent, exactly as it moves a bracket's take-profit today. The shares keep their stop until they sell.

**Why now:**
- **Friday 2:45:** 5 of 5 positions were leftover shares under fresh stops, so none could move. Alpaca held their market sales 6.2 s, and they were without a stop for 8.9 to 16.1 s.
- **Thursday 10:30:** 6 of 16 positions were leftovers.

## 2. What Alpaca says (docs read 2026-11-21, https://docs.alpaca.markets/docs/orders-at-alpaca, "OCO Orders")

- "specify “oco” for the order_class parameter." "The type parameter must always be “limit”" (the take-profit). The stop leg "is a stop order if only `stop_price` is specified".
- "currently only exit order is supported ... this is the second part of the bracket orders where the entry order is already filled". That is our case: shares already held.
- "The stop price input has to be at least $0.01 below ... the “base price”", which "is the limit price of the take-profit, for OCO orders."
- "when you retrieve the list of orders with the `nested` parameter true, the take-profit order shows up as the parent order", and the stop "appears as a child order."
- "Like bracket orders, order replacement is supported to update limit_price and stop_price." So the move should work. This is not yet measured on paper.
- The legs "work exactly the same way as the two legs of the bracket orders"; "Once one of the exit orders is filled, the other is canceled."
- **Caution:** on a bracket, the docs say a partly filled take-profit "adjusted" the stop to the remaining shares. On paper, Alpaca cancelled the whole stop instead (436 of 436 cases in one week; the 3-share trial of 2026-11-18). The pair will most likely behave the same way. That is the main risk, covered in section 4.

## 3. How it would work (with the switch on)

1. **Placing the pair.** Where today's code places a fresh stop for leftover shares, it places one exit pair instead:
   - Same shares, same stop price, same client id prefix `cyrus-p-` (on the pair's parent, so the code that already tracks fresh stops keeps recognizing it).
   - It costs one request, the same as today, and goes through the same sell gate. The gate already counts a linked pair as one sale of the shares, not two.
2. **At a close-out, the moved take-profit.** It treats a pair like a bracket:
   - The position qualifies when the pair covers the whole holding, nothing in it has filled, and the bid less 1 cent is at least 2 cents above the pair's stop. Those are today's rules.
   - The stop price is read from the pair itself in the open-order list, so no lookup is needed.
   - A refusal, or no fill within 2 s, falls back to today's cancel-and-sell path, as for brackets now.
3. **No new retry loops.** At most one pair try, then one plain fresh stop if the pair is refused (decision 2). Everything else uses today's bounded paths and the shared request budget.

**The code it touches** (all money-touching, so group 1 and group 2):
- The fresh-stop step in `risk.ts`.
- The start-up check of stored fresh stops. It reads the stop price from the order itself, but a pair's parent is a limit, so it must read the child leg.
- The missing-exit check, which must not count a pair whose stop leg is gone as protection (decision 3).
- The "held by a fresh stop" checks in `sells.ts`.
- `structuralCandidates` in `moved-take-profit.ts`. Today it skips a pair as "more than one sell open".
- How a moved pair (new order id, client id `cyrus-m-`) is matched back to its leftover position, so nothing treats the pair as ended during the 2 s move.
- The live-update handler, which hears a stop-leg fill under the leg's own id, not `cyrus-p-`.
- The trade digest and the review brief's counts. A pair's limit filling is a take-profit; its stop filling is a stop.

## 4. Decisions for you

**Decision 1: the pair's take-profit price.**
- **(a) The bracket's original take-profit price. Recommended.** The leftover shares can sell at the take-profit during the day, as the bracket intended. Before A4, about three quarters of these leftovers (827 of 1,100 on 2026-11-05) finished at the take-profit on their own within 3 s.
  - This **reverses your option a of 2026-11-12** ("no new take-profit"). It changes trading results: more take-profit fills, fewer leftovers reaching a close-out.
  - Because the price has just touched that level, another partial fill is likely, which leads to decision 3.
- **(b) A far-away price (for example 10 percent above the stop) that only the close-out moves.** Intraday behaviour stays exactly as today; the pair exists only so the close-out can move it. There are fewer partial fills, but the limit is a placeholder that is never meant to fill.

**Decision 2: if Alpaca refuses the pair.**
- **Recommended:** place today's plain fresh stop at once (one more request). If that is also refused, use today's path (the market sale).
- An unclear answer (no reply in time) is handled like today's unclear fresh stop: looked up by its client id under ruling B's 15 s limit.

**Decision 3: a partial fill of the pair's own take-profit.** If Alpaca cancels the pair's stop as it does a bracket's, the rest has a working limit and no stop. The missing-exit check would currently count that limit as protection, so this must be handled.
- **Recommended:** treat it like a bracket's leftover once its fresh stop is gone, as today. Cancel the limit's rest and sell the shares at market. No second pair, so nothing can repeat in a chain.
- **Alternative:** a plain fresh stop for the second leftover.

**Decision 4: the switch.** A Discord command in `commands`:
- `pair on` and `pair off`, stored in that day's record. It is off at the start of every day and survives a restart the same day.
- Accepted at any time. It affects only leftovers protected after it is turned on.
- Pairs already resting when you send `pair off` stay as they are: still protected, and still moved at a close-out.
- A command, not a code constant or a Fly setting, so switching it on Monday needs no deploy during market hours.

**Decision 5: one 3-share trial.** One-share trials cannot show a partial fill, which is the main risk. Do you want one 3-share trial added?
- It would place a pair whose limit is near the bid and watch up to 60 s for a partial fill, and what Alpaca does to the stop.
- A partial fill may not happen; then it shows nothing.

**Decision 6: Monday's 2:30 test.** With pairs on at 2:30, leftover positions would move instead of being market-sold. So fewer market sales would remain to measure Alpaca's hold, which is what the 2:30 test is for (Friday: 5 of 5 at 2:45 were leftovers). The choices:
- **Keep pairs off until after 2:30 on Monday.** The hold test stays clean; the pairs' first live close-out is Tuesday's.
- **Turn them on for the afternoon and 2:30, as you wrote.** The 2:30 test would measure only the positions that did not move.

## 5. Monday's one-share trials (after the 10:30 close-out is flat and your stop is on)

**The runner.** A script in the repo (`stacks/cyrus/tools/pair-trials.mjs`), committed and reviewed. It has the guards of the 2026-11-18 trials:
- today's date
- the 10:30 close-out flat, and your own stop on
- flat at Alpaca before and after each trial
- symbols the stack traded that morning
- 1 share each
- finished before 11:15 AM CT

It buys with a market order under its own client id, so the worker's stop sweep, which cancelled an unfilled trial buy on 2026-11-18, has nothing to cancel. It reads results with order lookups only; it does not open a second live-update connection, which could disturb the worker's. Requests stay far under Alpaca's 200 a minute.

**The trials, 3 stocks each:**
- **T1, accepted:** buy 1 share, then place a pair (limit 10 cents above the fill, stop 10 cents below). Record:
  - Alpaca's answer and how fast it came
  - how the open list shows the pair (parent and child)
  - whether the client id is kept
  - what the worker's own sync did with it
- **T2, take-profit movable:** replace the pair's limit with the bid less 1 cent, with client id `cyrus-m-`. Record:
  - accepted or not, and the fill time
  - whether Alpaca cancelled the stop itself, and how soon
- **T3, stop on a fill:** a pair whose stop is 1 cent under the bid and whose limit is well above, waiting up to 60 s for the stop to trigger. Record:
  - whether the stop sells and Alpaca cancels the limit
  - if the price never reaches the stop, whether Alpaca accepts moving the stop to the bid. Its rule is only "1 cent below the limit", so it may accept a stop at or above the market, which would trigger at once.
- **T4 (only with your yes to decision 5):** the 3-share partial fill.

Each trial cleans up after itself (cancel, sell, check flat). The runner stops at the first surprise. I then report the results and, if they hold up, the exact command: `pair on`.

## 6. Plan and timing

1. **Today:** item 1 (the read times) and item 2 (the deploy checker in the repo) are built separately and do not wait for this.
2. **After your approval and answers:** build with tests, then group 1 and group 2, up to 8 rounds each. It ships with the switch off. It deploys before 7:30 AM Monday only if both pass, through the repo's off-hours deploy checker.
3. **If it misses 7:30 AM Monday:** nothing of it deploys. The trials can still run on Monday, because the runner does not need the worker build; they would then inform the build instead.

**Honest risk:** this touches the fresh-stop step, the missing-exit check, the moved take-profit and the live updates in one weekend. Passing both groups in time is likely but not certain.

Research input for a human decision, never an instruction to act. Paper only.
