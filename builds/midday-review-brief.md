# Mid-day session review brief (for the mid-day cycle, once built)

Written by the builder on 2026-11-09, evening, at Michael's request ("a mid-day review brief (same shape as the daily one, for 8:30 to 10:30)"), as part of `builds/c2-proposal-2026-11-09.md`, part D. **It applies from Tuesday 2026-11-10 (release 2 of 2026-11-09 deployed as Fly v15, 8:15 PM on 2026-11-09); on a day the cycle runs by hand (Michael's fallback), use the same sections with the manual steps.** The pass rule below is Michael's (2026-11-09, evening): the daily rule with "the mid-day close-out is flat by about 10:35" in place of the close-out.

---

Mid-day session review for <date> (the release running that morning; the C2 log says which). Run at about 10:45 AM Central, after the mid-day close-out has finished, from a fresh Claude session (not a wait held overnight). Read only on Fly, Alpaca, Supabase, Discord and Healthchecks. Change no code, deploy nothing, place no orders. Never print any token or key. Check `date` first; if the mid-day close-out has not finished flat, report that first and keep watching until it has.

**Pass rule (Michael, 2026-11-09):** "report the highest accepted orders a minute; it holds if there are no rate-limit errors, remaining requests never drop below the reserve in force, no safety sale is delayed, and the mid-day close-out is flat by about 10:35." **Michael's ruling of 2026-11-06 on dips applies:** a dip caused only by cancels, syncs, loss-stop reads or sales is reported with its size but does not fail the morning, as long as there are no rate-limit errors and no safety sale is delayed. "No safety sale is delayed" is read in Michael's words: any sell, cancel, close-out or loss-stop sale that waited, for any reason (a rate limit, the governor, a stuck sale, a busy order sync), not only a rate limit.

How to read it from the stack's records (8:30 to the mid-day close-out's end):
- Accepted orders a minute: the stored entries per calendar minute and in the busiest 60 seconds, minus those Alpaca refused (fetch entries missing from Alpaca's day listing by client id before counting).
- Rate-limit errors: `rateLimitAnswers` in the per-minute statistics (`governor_stats`), and any 429 in the run log.
- Remaining against the reserve: `reserveThisMinute` (`lowestRemaining`, `lowestAboveReserve`) per minute; the lowest value, when, and what was spending then; the governor's "holding back for safety" refusals.
- Safety sales: `sale_blocked`, `liquidation_result` (now logged for attempts that sold nothing), `unprotected_position` and `bare_remainder` with `listAgeMs`; from Alpaca's records, every position whose exits were gone, for how long, and when it was sold.
- The mid-day close-out: the run log's `closeout_result` with path `midday`, the day record's `midday` phase, Alpaca's positions and open orders after it, and the Discord posts.

**Expected by design in v15 (not faults; report them, do not fail the morning for them):**
- From 10:30 until the mid-day close-out is flat, the missing-exit check stands aside (Michael, "Keep it"): positions whose exits the close-out cancelled are sold by the close-out alone. A position without exits during that time is not a delayed safety sale unless the close-out itself stalls.
- The close-out's retries (after the first try) run every 20 seconds but only within 60 Alpaca requests a minute and never below the reserve of 80, at most 10 positions a retry, in turn (Michael's rulings). Retries 20 seconds apart or slower are expected.
- While the close-out is selling, the stuck-entry 5 minute alert stands aside ("Mid-day owns it"); the close-out's own alerts are "the mid-day close-out is NOT FLAT yet" (once) and "still NOT FLAT after 5 minutes" (once).
- The pause and hold live in the control keys `midday_pause:<date>` and `midday_hold:<date>`; the run log's `closeout_result` with `path: "midday"`; the day phase `midday` with `middayFlat: "yes"`.
- If no deploy is planned that day, section 4 expects "resumed by `go`, or not at all".

**Rate-limit answers from the first try at 10:30:** the first try is not limited to 60 a minute (an open question with Michael; it matches the 2:55 close-out). Score any rate-limit answer as Michael's rule reads ("no rate-limit errors": it does not hold) and name the cause (the first try, how many, when).

1. **The morning, 8:30 to 10:30** (the load window 8:45 to 9:00 on its own if it was a load day): the highest accepted orders a minute and the per-minute table, filled entries a minute (separate note), requests a minute, remaining against the reserve, governor holds, rate-limit errors, refusals by reason, unfilled entries cancelled, decision-to-acceptance time, cost. Verdict: holds, does not hold, or inconclusive (say which criterion and why).
2. **Safety work in the morning:** lost exits (from Alpaca's cancel of the exits to the sale sent and filled); remainder sales (from Alpaca's cancel of the stop to the sale sent, sale to fill); any blocked sale, with what the new logs say held the shares (Alpaca's `qty` and `qty_available`, the open orders counted); any position that went without exits for more than 10 seconds.
3. **The mid-day close-out (flat by about 10:35?):** when the pause started, when it was flat, whether any entry was accepted after it, the cancels (sent, answered), each sale, how long to flat, retries, the cap left unchanged, alerts.
4. **The pause and what followed:** whether a deploy happened, when, and whether every condition was met at that moment (flat, no open orders, paused, before 1:30 PM, reviewed release); the start note; whether anything was sold at start-up (it must not be); the resume (automatic after a deploy unless `hold` was set, by `go`, or not at all; a plain restart must stay paused); Healthchecks paused by the deploy script before the deploy and up again after the first ping.
5. **The loss stop and the shadow book over the morning:** the day's starting equity, the lowest equity, how close the loss stop came; the shadow book's largest gap.
6. **Discord volume** by channel for the morning.
7. **Anything that did not behave as designed.**

Write it to `builds/build-c2-log.md` and report in plain English, ending with recommended next steps. Paper only. Research input for a human decision, never an instruction to act.
