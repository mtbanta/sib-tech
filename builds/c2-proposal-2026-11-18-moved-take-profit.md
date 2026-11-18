# Proposal: the moved take-profit in the sell path (2026-11-18, about 11:00 AM CT)

Research input for Michael's decision, never an instruction to act. Paper trading only. Nothing here is built.

Michael's request, verbatim (decision 3 of 2026-11-17, evening): "If the trials hold up, propose using the moved take-profit in the sell path (positions that still have exits), with the request math, for building tomorrow afternoon and review tomorrow night."

His adjustment 3, verbatim: "If it is built later, log every moved take-profit in live trading (accepted, stop cancelled by Alpaca, time to fill), so live trading gives the larger sample."

The trial results are in `builds/build-c2-log.md`, "The take-profit and raise-the-stop paper trials (2026-11-18, 10:36 to 10:41 AM CT)".

## Summary

**Builder's recommendation: do not build it this afternoon.** Keep it, with the stepped trail, for the trading-strategy phase.

- **The mechanism works where the price is above the stop.** Alpaca accepts the move, sells within about a second, and cancels the stop itself.
- **But the positions sold in volume are load-day positions, whose stop sits 2 cents under the entry.** For those, Alpaca's rule that the take-profit stay above the stop leaves almost no room to move it to a selling price.
- **Where it does apply (normal days), it saves about 1 request per close-out, plus a few seconds without a stop.**
- **It needs a new broker call and several money-touching design answers** (below), under the freeze, for a close-out that is already flat in about 7.5 s with no rate-limit answers.

## 1. Did the trials hold up?

| Case | Result |
| :--- | :--- |
| A sale by moving the take-profit to a selling price, with the price above the stop | **Held up.** 11 of 11 sold: 6 win-tier endings, 3 losing, 1 trigger (forced), 1 partial. Filled 0.27 to 1.41 s after the move. Alpaca cancelled the stop itself about 2 ms after the fill every time. |
| The price at the stop | **Did not hold up.** 2 of 2 refused, 422 `take_profit.limit_price must be > stop_loss.stop_price`. A third refusal (the stop moved up to meet the price) gave the same answer. |
| A sale at the lowered winning price (A: entry plus 10 lowered to plus 5; B: plus 5 lowered to plus 2) | **Not tested.** Every lowering was accepted (6 of 6), but the price never came back up to it within 8 s (0 of 6 sold there). |
| Partly filled take-profit | **Held up once** (1 of 1). Alpaca had already cancelled the whole stop at the first partial fill, before any move. |
| Raising the stop | **Held up.** 6 of 6 accepted, each a new id, the take-profit untouched. The price rose in 1 of the 3 trials. |

Caveats: these are 1 to 3 share orders on three liquid stocks with 1 to 2 cent spreads, in Alpaca's simulated paper fills, over one 5-minute window.

## 2. Where it would apply

"Positions that still have exits" are the bracket positions that the whole-account sales sell:
- the 10:30 mid-day close-out, the 2:45 close-out and the end of the afternoon load window;
- `flatten`;
- the daily loss stop's sale;
- the carried-position sale;
- a close-out retry of named symbols.

The missing-exit sales (the fast sale, stuck retries, the cheap retry) are for positions whose exits are already gone, so the move does not apply to them.

## 3. The request math, from the code and today's close-out

**Today's whole-account sale** (`sells.ts`, the "cancel every order" branch):
- 1 request cancels everything (Alpaca's cancel-all), then 1 market sell per position, plus the sale's reads.
- **Today's 10:30 close-out:** the cancel-all was sent at 10:30:02.9 and answered at 03.1. The first of 19 sales went at 05.4 and the last at 08.9, and the account was flat at 10.4. That is **20 sends**, and each position was without a stop from about 03.1 until its sale filled (about 3 to 7 s).

**With the moved take-profit:** 1 replace per position, and the stop goes with the fill.
- If every position qualifies: **19 sends against 20**, no stretch without a stop, and the cancel-to-first-sale wait (2.3 s today) skipped.
- **Each position that does not qualify, or whose replace is refused or does not fill, costs more than today:** the wasted replace, then today's cancel and sale.

**Who qualifies.**
- **The rule:** the new limit must be above the stop. The smallest gap Alpaca accepted today was 3 cents (15.22 over 15.19); 1 or 2 cents is not tested. A safe rule is a limit at least 3 cents above the stop, until a smaller gap is measured.
- **Load-day positions** (stop 2 cents under the entry's limit price, take-profit 1 cent over): a selling limit of the bid minus 1 cent is at least 3 cents above the stop only when the bid is at least 2 cents above the entry. Such a position would normally have sold through its 1 cent take-profit already. **So on a load day almost no position qualifies, and the move mostly adds a wasted request.**
- **Normal-day positions** (stop 0.4 percent under, take-profit 0.25 percent over; about 8 cents on a 20 dollar stock): most qualify unless the price is within about 4 cents of the stop.

**A close-out retry of named symbols** (single cancels, up to 2 per position, then a sale) would drop to 1 replace per position. These retries are few; today's close-out needed none.

## 4. What would have to be designed and reviewed (each money-touching)

1. **A new broker call.**
   - There is no replace (PATCH of an order) in the broker client today.
   - It would need to go through the sell gate (which today guards `submitSell` only), the structure test, and the shared request budget.
   - It needs a retry limit and backoff, under the standing rule. Builder's suggestion: no retry; a refusal goes straight to today's path.
2. **Ownership.**
   - The replacement order carries Alpaca's own client id, not the stack's `cyrus-x-`, so the next sale round counts it as "others" and would cancel it, possibly mid-fill.
   - Whether a replace accepts the stack's own `client_order_id` on a bracket leg is not tested.
3. **The fallback after a refused or unfilled move.**
   - The leg now has a new id. Any cancel aimed at a stale copy of the old id is answered "already done" (422), so the sale is then refused 403 `held_for_orders`.
   - The one-entry sale reads the entry fresh, and Alpaca's nested listing shows the newest leg (checked today). The whole-account cancel-all covers every order. Every cached id would still have to be checked.
4. **Partial fills.**
   - Today the replacement reported 3 shares filled while the original reported 1, so the replacement's count includes the original's.
   - Anything that adds up exit fills per order (the live updates' exit tally, the daily summary) could double count.
   - Builder's suggestion: leave partly filled legs to today's path.
5. **The live updates.**
   - Today's trial orders were not the stack's (their entries carry a `ptest-` id), so the worker's quiet says nothing about how it treats a `replaced` event on its own bracket.
   - Checked: a replaced leg keeps the bracket's group id, which is what the live updates group exits by. The events Alpaca sends for a replace were not captured.
6. **The simulator** must model a replace (new id, same group, the take-profit-above-stop rule, the fill counts) before a group 1 review means anything.
7. **Michael's adjustment 3:** one stored row per move: accepted or refused with Alpaca's answer, whether Alpaca cancelled the stop itself, the time from the replace to the fill, and the fallback if one ran.

Each of these is a decision or a check; none is measured end to end.

## 5. If Michael wants it built anyway

**The narrow version:**
- **Scope:** normal-day positions only (not load windows), in the whole-account sales, for a position whose bracket shows both legs open and not partly filled, and whose selling limit (bid minus 1 cent) is at least 3 cents above its stop.
- **Fallback:** a refusal, or no fill within 2 s, falls back to today's cancel-and-sell for that symbol, within today's bounds.
- **Logging:** every move stored as in item 7.
- **The rest:** load-day positions and everything else keep today's path.

**The cost of the narrow version:**
- About 1 request saved per close-out on a normal day.
- About 2 to 4 s less without a stop per position, by builder's estimate from today's close-out. That is an estimate; the simulator would turn it into a measurement.
- Time to build it this afternoon, a group 1 review (up to 3 rounds), and a deploy after the close only.

**Builder's recommendation stands:** wait for the strategy phase. There, moving exits on purpose (the stepped trail, take-profit changes) is part of the design, the replace call gets built once with its review, and the close-out can adopt it afterwards if the measurements favour it.
