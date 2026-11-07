# Monday 2026-11-09 session review brief

Written by the builder on Friday 2026-11-06, evening, at Michael's request ("write builds/monday-review-brief.md (same shape as Friday's, with this pass rule)"). The pass rule below is Michael's, word for word.

---

Monday 2026-11-09 session review (release v11, or v12 if the early wake-up fix was deployed before the open; the C2 log says which). Read only on Fly, Alpaca, Supabase and Discord. Change no code, deploy nothing, place no orders. Never print any token or key.

**Pass rule for a load day (Michael, 2026-11-06), word for word:** "report the highest accepted orders a minute; it holds if there are no rate-limit errors, remaining requests never drop below the reserve in force, no safety sale is delayed, and the close-out is flat."

How to read it from the stack's records:
- Accepted orders a minute: the stored entries per calendar minute and in the busiest 60 seconds, minus those Alpaca refused.
- Rate-limit errors: `rateLimitAnswers` in the per-minute statistics (`governor_stats`), and any 429 in the run log.
- Remaining requests against the reserve in force: `lowestAboveReserve` in the per-minute statistics (the day's lowest of Alpaca's remaining minus the reserve in force at that moment), and per minute `reserveThisMinute` (the reserve's range, and that minute's `lowestRemaining` and `lowestAboveReserve`), with `lowestBudget` and `reserveNow`. Report the lowest value, when it happened, and what was spending then. **Michael's ruling of 2026-11-06 on how a dip counts:** it holds if new entries never spend below the reserve; a dip caused only by cancels, syncs, loss-stop reads or sales is reported with its size but does not fail the day, as long as there are no rate-limit errors and no safety sale is delayed. (The governor refuses an entry whenever its estimate of Alpaca's remaining is at or below the reserve, so check the "holding back for safety" refusals and that no entry was sent in a moment when remaining was below the reserve.) The Friday rehearsal in the simulator showed such dips of 1 to 7 at sustained load.
- A safety sale delayed: any sell, cancel, close-out or loss-stop request that waited on a rate limit or the governor.
- The close-out flat: the run log's `closeout_result` and Alpaca's positions after it.

1. Load window, 8:45 to 9:00 (if Michael made Monday a load day; if not, say so and give the same measures for the busiest 15 minutes of the normal day): the highest accepted orders a minute and the per-minute table, filled entries a minute (separate note), requests a minute, the reserve in force and remaining against it, how often the governor held entries back, rate-limit errors, refusals by reason, unfilled entries cancelled, decision-to-acceptance time, cost. Verdict: holds, does not hold, or inconclusive.
2. Release 11 in action: lost exits (how many; from Alpaca's cancel of the exits to the sale sent and filled, against the 1 to 2 second target); the summary against the account (to the cent; the lookups and the fills check); the 3 second stop-gap sales and the stack's own measurement (how many measured, and a spot check against the free feed's prints); the scaled reserve (its range through the day).
3. The shadow loss-stop book against the 5 second account check: the largest gap and its time, the time since the last fill and since the book was set at that moment, the book's checks against later reads (`maxCheckCashGap`), times it had no estimate; whether Alpaca's position list lagged fills. Say whether it is ready to become the main loss stop.
4. The rest of the day, the close-out, the summary matching the account, and Discord volume against Friday's (message count by channel).
5. Anything that did not behave as designed.
Write it to builds/build-c2-log.md and report in plain English, ending with recommended next steps.
