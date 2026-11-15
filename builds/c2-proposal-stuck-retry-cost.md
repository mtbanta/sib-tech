# Proposal draft: cheaper stuck retries, and a retry budget that grows with Alpaca's spare room

Asked by Michael on 2026-11-14 (night), after accepting the 45 cap for Monday: "For a proposal after Monday's live data, no code now: (1) cut a stuck retry's cost from about 10 requests to about 3 (cancel, sell, one check), using live updates instead of re-reads; (2) let the retry budget scale with Alpaca's spare requests above the reserve, with 60 as the minimum instead of the maximum. Show the expected wait between retries for 1, 5 and 10 stuck positions under each."

**Status: a draft with estimates.** No code is written. Every figure below is a model built from the simulator and last week's measurements. Monday's live data replaces them (see "What Monday must measure"). This is research input for a human decision, never an instruction to act. Paper trading only.

## How the wait between retries is set today

A stuck sale's retry may run once all of these allow it:

- **The gap:** at least 2 s after its last try (ruling 1).
- **The minute:** stuck retries may use 45 of the budget's 60 a minute. The other 15 stay for urgent work.
- **The 5 seconds:** at most 15 budgeted requests in any 5 seconds.
- **The sale queue:** one sale runs at a time.

Today each retry reserves 10 requests. So stuck retries get about 4 tries a minute in all, shared by every stuck position.

## The two options

1. **Cost about 3 a try.** The try would be a cancel (only if an exit still exists), the sell, and one check.
   - It would take the position, the open orders and whether the sale filled from the live order updates and the cached account view, instead of reading them again.
   - Effect: about 15 tries a minute fit in the 45, against 4 today.
2. **A budget that grows with spare room.** The budget becomes the larger of 60 and Alpaca's spare requests above the reserve.
   - Spare means Alpaca's 200 a minute less the routine reads (about 50 a minute measured) and the entries.
   - The 15 for urgent work and the 15-in-5-seconds rule scale with it: a quarter of the budget per 5 seconds, as today.
   - **When quiet** (no entries, for example after the last entry or in the mid-day pause), spare is about 150, so the budget could be about 150.
   - **When busy** (100 entries a minute on a normal day, 150 in a load window), spare is under 60, so the budget stays at 60, as today.

## Expected average wait between one position's retries

These are estimates. They assume each refused try takes about 1.5 s in the sale queue.

| Case | Tries a minute (all positions) | 1 stuck | 5 stuck | 10 stuck |
| --- | --- | --- | --- | --- |
| Today (10 a try, budget 60) | 4 | 15 s | 75 s | 150 s |
| Option 1 (3 a try, budget 60) | 15 | 4 s | 20 s | 40 s |
| Option 2, quiet (10 a try, budget about 150) | 13 | 5 s | 23 s | 46 s |
| Option 2, busy (budget stays 60) | 4 | 15 s | 75 s | 150 s |
| Both, quiet | 40 (the sale queue limits it) | 2 s | 8 s | 15 s |
| Both, busy | 15 | 4 s | 20 s | 40 s |

**How to read these:**

- **They are averages.** For one stuck position, tries come in bursts. Today the measured pattern is 5, 5, 5, then about 45 s: four tries, then a wait for the minute to free. Under option 1 it would be about 15 tries 2 s apart, then a wait of up to about 30 s.
- **The model matches today's tests.** It says 75 s for 5 stuck positions; the tests measured 65 to 105 s. v22 measured 125 to 171 s in the same test.
- **A sale Alpaca holds is slower.** On 2026-11-02 Alpaca held some sales up to 16 s. While Alpaca holds each sale, the one-at-a-time queue sets the wait instead: about N times the hold. With 8 s holds that is about 8, 40 and 80 s, under every option.

## What each risks

**Option 1** changes the sell path, the most sensitive code:

- **Stale view.** The sell gate's rule (never sell more than is held, counting open sells) would rest on the live updates and the cached view instead of a fresh read. If an update is late or lost, the view is stale. The rule would still need a fresh read whenever the live updates are down or behind, which is the cost of 10 again.
- **Worst case.** A late update means a try that sells nothing (the gate refuses) or a wasted try. It must never mean an oversell, and that would need tests of the gate against late and lost updates.
- **Biggest gain, also when busy.**

**Option 2** changes no sell code, only how much of Alpaca's room the retries may take:

- **Less headroom for entries.** When quiet the retries can use room that entries would otherwise have, so entries that start suddenly find less room at first. It corrects itself: as entries use Alpaca's room, the spare shrinks and the budget falls back to 60. The floor of 20 for urgent work and entries' reserve of 81 are unchanged.
- **Swings.** A budget that follows a moving number can swing. It would need smoothing, for example the spare averaged over the last minute.
- **No help when busy,** which is when stuck positions are most likely (load windows).

## Recommendation (to be confirmed by Monday's data)

1. **Option 2 first, as the smaller change.** It touches only the request budget, helps in the quiet periods, and is self-limiting.
2. **Option 1 only if Monday shows stuck retries are common in busy periods.** It needs the gate tested against late and lost live updates first.

Both together give the shortest waits, but each should be built and reviewed on its own.

## What Monday must measure

- **Requests per stuck retry, live.** The simulator says up to 10 for a refused sale and about 4 for a hidden hold. Source: `budget_overdraft` and `governor_stats.requestBudget`, per try.
- **Time per try in the sale queue, live.** Refused, held and filled. Source: `liquidation_result` timings.
- **Routine reads and entries per minute, by period.** Source: `governor_stats`. These give the spare for option 2: quiet periods, normal entries, the load window, the afternoon.
- **How often positions get stuck, how many at once, and for how long.** Source: the stuck alerts and resolution lines.
- **How reliable the live updates are.** Gaps and late events. Option 1 depends on them.
- **Fly CPU.** The `self_monitor` rows, to confirm the room checks stay as small as estimated.
