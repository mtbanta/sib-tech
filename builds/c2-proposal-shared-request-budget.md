# Proposal for next week: one shared request budget (stack C, paper only)

Asked for by Michael on 2026-11-13: "For next week, proposal only: one shared request budget that every retry and recheck draws from, replacing per-feature allowances." Nothing here is built. This is research input for a human decision.

## What there is today

Alpaca allows 200 requests a minute per account (one bucket for account, order and position calls, measured on paper). The worker shares that bucket out in several separate ways:

| Limit | Where | What it covers |
| --- | --- | --- |
| The governor's reserve, 80 | `src/governor.ts` (`SAFETY_RESERVE`) | New entries are refused while fewer than 80 requests are left in Alpaca's bucket, so exits and sales keep room |
| Orders a minute, 1 to 100 (150 in a load window) | `src/limits.ts` | Entries |
| Stuck-retry allowance, 40 a minute and 15 in 5 s | `src/risk.ts` (`STUCK_RETRY_PER_MINUTE`, `STUCK_RETRY_PER_5S`) | Retries of stuck sales (charged 10 each), tries for timed-out fresh stops (each request), and since 2026-11-13 the remainder rechecks |
| Loss stop retries, 60 a minute | `src/risk.ts` (`LOSS_STOP_REQUESTS_PER_MINUTE`) | The daily loss stop's re-sells |
| Mid-day and afternoon close-out retries, 60 a minute | `src/midday.ts` (`MIDDAY_RETRY_REQUESTS_PER_MINUTE`) | Re-tries after the first close-out try |
| Summary, at least 100 left | `src/worker.ts` (`SUMMARY_MIN_BUDGET`) | The daily summary's reads, after the close |

A position's first sale is not limited, with one exception: an entry whose fresh stop timed out (ruling B) has even its first try charged per request, and that try starts only with room for a whole try (`requestBudget` in `cleanupSale`, `TIMED_OUT_TRY_REQUESTS` 13). A sync's routine work (the order list, positions, the periodic lookups) is not limited.

## Why change it

- **Each allowance counts only itself.** Several can be busy at once, and together they can take more than any one shows. In group 1's rate probe this weekend (simulator; 480 runs with 0, 10 or 30 percent random faults on every call), the code the log calls "Friday" (`3681f9c`, the ruling B branch) reached 258 requests in a minute, and the code after the weekend build's round 1 fixes and steps 3 to 5 reached 67 (build log, "Measured, group 1's rate probe", under "Weekend build: round 1 reviews, fixes, and steps 3 to 5 (items 2 point 2, 3 and 4)"). Those fixes were per feature; the next feature has to repeat them.
- **Each new feature brings its own counting.** This weekend, rounds 6 to 8 were spent on whether the remainder rechecks were counted exactly once. In the builder's reading, the faults came from charging a request at a different moment from when it ran: rounds 6 and 7 found charges for rechecks that never ran or were given back wrongly, and round 8 found a sync that ran with no charge at all.
- **Priorities are implicit.** Which of two retries goes first depends on which allowance it belongs to, not on which matters more. Michael's question about stuck sales against rechecks came from this.

## The proposal

1. **One budget object** for every request that is not a new entry or a first try: retries, rechecks, re-sells, and lookups caused by a retry. Its size is set below Alpaca's 200 so that entries and first tries keep their room. A starting point to discuss is 120 a minute, with a cap on any 5 seconds. This is a guess, not a measurement; the per-minute statistics (`governor_stats`) and Monday's logs would size it.
2. **Charged when the request is made, not before.** This would have to be built. Today nothing tags an Alpaca request with who made it. `src/request-scope.ts` (built this weekend) only carries the stuck-retry allowance, through Node's AsyncLocalStorage, inside a timed-out stop's try, so the Alpaca client can ask before its own retries (`retryAllowedInScope` in `src/alpaca-trading.ts`). The same mechanism could be widened to carry a "who is asking" tag on every retry path, and the budget would count those tags as requests are made. No estimate, no refund, no "charged but never ran".
3. **Priority classes, with a reserve for the classes above.** For example:
   - (1) shares without a stop: the loss stop's re-sells, a stuck sale, a timed-out fresh stop's try;
   - (2) close-out retries;
   - (3) remainder rechecks and the lookups they cause;
   - (4) statistics and the summary.
   A lower class may draw only while it leaves a set amount for the classes above it. A recheck would then never take the room a stuck sale needs, which answers Michael's stuck-sale question by design.
4. **Before a try starts, it asks for the room it needs** (as the timed-out tries do today, `TIMED_OUT_TRY_REQUESTS`). If the room is not there, it waits for room, with a backoff, under the standing rule that every retry loop has a limit and a backoff.
5. **What stays as it is:** the governor's reserve for entries, the orders-a-minute limit and its ceilings (raising them is a hard stop), first sales unlimited, and routine sync work outside the budget.

## What it would replace

The stuck-retry allowance, the loss stop's and the close-out's separate per-minute counters, the remainder recheck charge and its give-back (`lagCharge`, `refundCharge`), and the leftover mark (`leftoverTimerAt`, `keepLagCharge`). Fix (a) (the pass cancelling a recheck's own timer) stays: it removes a duplicate sync whatever the counting.

## Risks

- It touches every retry path at once, so it is a large money-touching change: group 1 review on every path, and tests that each path still sells when it should.
- Picking the size and the class reserves wrongly could slow sales that today are fast. The first release could run the shared budget in shadow (counting only, the old allowances still in force) for a day or two, and compare.
- Charging at the moment of the request means a try that has started cannot be stopped halfway for lack of room. That is why point 4 asks for the room first.

## Questions for Michael

1. The budget's size, and its 5 second cap (suggested 120 a minute; a shadow run first to measure).
2. The priority order above, or another.
3. Whether the loss stop's re-sells join the shared budget or keep their own 60 a minute.
4. A shadow release first (counting only), then the switch, each with its own review rounds?
