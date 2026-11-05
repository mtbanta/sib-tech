# Thursday 2026-11-05 session review brief

Saved verbatim from Michael on Wednesday 2026-11-04, evening. Do not edit.

---

Brief: Thursday 2026-11-05 session review (release v9, load day). Read only on Fly, Alpaca, Supabase and Discord. Change no code, deploy nothing, place no orders. Never print any token or key.
1. Load window, 8:45 to 9:00, against the approved pass/fail rule: entries a minute, requests a minute and lowest remaining requests from the per-minute logs, rate-limit errors, refusals by reason, decision-to-acceptance time, fees, cost. Verdict: holds, does not hold, or inconclusive.
2. Speed detail, reported separately: symbols freed by live order updates versus the 10 second fallback; median and slowest time from exit fill to symbol freed; whether live updates carried the share count; positions that hit the 60 second time limit and whether Alpaca accepted the lowered price; hold-time distribution in the window; Fly CPU during the window.
3. Rest of the day with the $75 cap, release A's fixes in action (remainder sales and their gaps, the close-out, one "Close-out done"), and the daily summary matching the account.
4. Anything that did not behave as designed.
5. Then propose one speed release for all days, no code until I approve. Events first (live order updates and the price stream), timers only as backstops sized by the request budget, every interval set from today's measurements. Cover: freeing symbols, the load-day time limit, the normal-day order check, the stop gap after a partial take-profit, the loss stop estimated from live prices with the account read as backstop, the loss stop ahead of remainder sales, and anything else on a timer. For each: today's value, the proposed value, the data behind it, the request cost. Total request math at 100 entries a minute.
Write it to builds/build-c2-log.md and report in plain English.
