# Proposal: a cheaper stuck retry (about 10 requests down to 3)

Michael's item (a) of 2026-11-17, 8:25 AM: "Cut a stuck retry from about 10 requests to about 3, using live updates instead of re-reads." This is a proposal with simulator measurements. No money-path code has been written on any branch that can deploy; the prototype lives only in a simulator copy (scratchpad tree `cheap3`). It touches the sell path, so it needs Michael's approval before it is built for real, then group 1 and group 2.

Paper trading only. Research input for a human decision, never an instruction to act.

## What one stuck retry sends today (measured, simulator, current code)

An ordinary stuck retry is the second and later try to sell a position whose exits Alpaca cancelled (the "missing-exit sale"). Counted call by call in the simulator on today's code (v26 plus entries-give-way), one retry with Alpaca refusing the sale:

| # | Request | Why it is sent |
| --- | --- | --- |
| 1 | look up the entry order by its id | to see whether its exits came back |
| 2 | read positions | the sale's start: is the symbol still held? |
| 3 | read open orders | anything of the entry's to cancel? |
| 4 | read open orders again | the wait for cancels to land (there are none) |
| 5 | read positions | same wait |
| 6 | read positions | re-read before selling |
| 7 | read open orders | the sell gate's own check (open orders first) |
| 8 | read positions | the sell gate's own check |
| 9 | the sell | |
| 10 | read positions | after the sale, to report what is left |

10 requests, which is why each retry reserves 10 (`STUCK_TRY_REQUESTS`). Before the retry, the order sync's own look also reads the order list and positions (2 routine requests, not part of the 10). With the stuck retries' ceiling of 45 a minute, that allows about 4 retries a minute for every stuck position together.

## The proposed cheap retry (3 requests)

While Alpaca's live order updates are connected, an ordinary stuck retry whose entry shows no exit still open in the sync's own list does this instead:

1. read open orders, then positions, once, through the sell gate (2 requests);
2. decide from that one read: how many of the entry's shares are still held and not already covered by an open sell;
3. sell that many through the sell gate, which reuses the same read because it is under a second old (1 request).

Nothing else: no entry lookup, no separate reads for the cancel step or the wait (there is nothing to cancel), no re-read before selling, no read afterwards. The sale's outcome comes from Alpaca's answer to the sell, then from the live fill update, then from the next look.

Reservation: 4 in version A (the 3, plus 1 in case the gate has to read again because more than a second passed; that would be logged as an overdraft). Version C keeps today's 10 for the room check and gives the unused 7 back when the try ends (measured better, below).

Measured in the simulator, call by call: 3 requests per retry (open orders, positions, sell) against 10 today, both when Alpaca refuses the sale and when it accepts it.

## Why it stays as safe as today (the sell gate)

- The sell gate's check does not change. It still reads Alpaca's open orders first and then positions, never more than a second old, subtracts every sell it sent since that read, and keeps each sell within the shares Alpaca reports as free. A sell larger than the position can never be sent.
- The cheap path never trusts the live updates or any cached positions for that check. The live updates only decide which path to take; the numbers the sale acts on come from the same fresh Alpaca read the gate checks.
- If the entry's exits are open again (Alpaca kept them after all), they appear in that open-orders read as open sells holding the shares, so the gate allows nothing and no sale is sent. Today the entry lookup would notice this first and close the stuck record; on the cheap path it is noticed by the next full look instead, at the cost of one 3-request try.
- One thing to judge (builder's reading, for group 1): without the lookup, the count of the entry's own shares comes from the sync's list, which can be a few seconds old. If an exit partly filled in those seconds, the count is too high. The sale is still capped by the fresh positions less open sells, so it can only sell shares that nothing protects; it cannot oversell, and it cannot sell shares held by another entry's open exits.

## When the cheap path is not taken (today's full path, 10 requests)

- the live updates are down or reconnecting;
- the first try of a position (it keeps its 3 rounds, never refused);
- a timed-out stop's try, a remainder being given a fresh stop, the 15 second limit's sale, the fast sale, any close-out, flatten or loss-stop sale;
- the sync's list shows something of the entry's still open to cancel.

## Measured against the bar (simulator)

Same harness and method as this morning (probe G, the protect-first scenarios 1 and 2 with 16 seeds, the close-out grid), each prototype as v26 plus entries-give-way plus the cheap retry, compared with v26 plus entries-give-way alone (tree `gw2`, which equals v26 in every run), with v26 and with v24. Per Michael's item (c), the cases where Alpaca refuses every sale for 30 s (every probe G case, scenario rows marked "refused", close-out grid rows marked "refused") are reported apart from the cases where sales are accepted.

Three versions were tried:

- **A (reserve 4, send 3):** the plain proposal.
- **B:** A, but taking the full path while a sale of the whole account (close-out, flatten) runs. Every result was identical to A, so the harm below is not from retries during the flatten.
- **C (reserve 10, send 3):** each retry is admitted on exactly today's room check (it still asks for 10), sends 3, and gives the unused 7 back at once.

| Version | Sales accepted (17 cases, against v26) | Alpaca refuses for 30 s (37 cases, against v26) | Against v24 (60 cases) |
| --- | --- | --- | --- |
| A | 17 pass, 0 worse | 20 pass, 17 worse | 41 pass, 19 worse |
| B | identical to A | identical to A | identical to A |
| C | 17 pass, 0 worse | 24 pass, 13 worse | 45 pass, 15 worse |
| v26 itself, for scale | | | 53 pass, 7 worse (the accepted 7) |

**What gets better (scenario 1, 10 lost exits with sales refused for 30 s, 16 seeds):**

| | Positions never sold by the run's end (all seeds) | Slowest sale after the losses (median of the 16 seeds) | Rate-limit answers (median) |
| --- | --- | --- | --- |
| today (v26 plus give-way) | 16 | 110 s | 57 |
| A | 0 | 67 s | 51 |
| C | 0 | 74 s | 51 |

**What gets worse (all in the "Alpaca refuses for 30 s" group; nothing worse where sales are accepted):**

- probe G with 5 bracketed positions and 25 lost exits and a flatten 20 to 40 s after the losses. In A the rate-limit answers on sale steps rose from a median of 3 to 5 to a median of 8 to 14, and the bracketed positions' sale slowed by up to about 3 s (median 11.1 to 14.3 s with 11 s cancels, flatten at 30 s). The cause, measured in one case: a cheap retry needs less room to start (20 floor plus 4 plus 2 reads, against plus 10), so more of them get in while Alpaca's requests are low, and the flatten starts with less room (69 left against 85). C, admitted as today, removes most of this: only the flatten-at-40-s cases stay worse on answers (median 3 to 5) and three cases on bracketed sale median by 0.4 to 0.8 s.
- scenario 2 with sales refused (lost exits, then a close-out or flatten 10 to 30 s later): the same 6 rows worse in A, B and C, by 1 to 3 rate-limit answers on the median, up to 16 on the worst run (130 to 146 at 30 s, 11 s cancels), and the time to flat up to 3.7 s worse on the worst run. Not explained yet (a guess: the cheap path sends its sell sooner after the look because it skips the reads and the wait, so refused sells come closer together).
- the close-out grid, sales refused, 60 positions with 15 s lead: 1 to 3 more answers on the median and under 1 s on the medians.

**Reading:** the cheap retry clears the stuck positions much sooner when Alpaca refuses sales for a while (every position sold, the slowest about 36 to 43 s sooner), and changes nothing where sales are accepted. It does not pass Michael's bar against v26 in the "refused for 30 s" group (13 cases in version C), so it is not ready as is. Version C is the better base; the scenario 2 rows need to be understood before it could pass.

## What it would take to go lower (not built, a guess)

About 1 request per retry is possible only if the order sync's own look (which runs anyway, 2 routine requests) read Alpaca's full open-order list and positions in the gate's order and handed that read to the gate. Today the look reads a recent window of the day's orders, not every open order, so the gate cannot trust it. That is a bigger change to the order sync and the gate.

## Recommendation (builder's)

1. Do not build it for release yet: in the simulator it fails the bar against v26 in 13 of the 37 "Alpaca refuses for 30 s" cases (version C), while clearing stuck positions far sooner.
2. If Michael wants it pursued: take version C (admitted as today, sends 3), find the cause of the scenario 2 rows, then re-measure. If his reading of the bar treats the "refused for 30 s" group apart (item (c)), say how he wants it weighed: version C is 17 of 17 where sales are accepted.
3. Any build needs his approval first (it changes the sell path), then group 1 and group 2.

## Files (scratchpad, simulator only)

- prototypes: `speed/3c-harness/trees/cheap3` (A), `cheap3b` (B), `cheap3c` (C); the change is in `src/risk.ts` (`CHEAP`, `CHEAP_TRY_REQUESTS`, the `cheap` flag in `cleanupSale`) and `src/sells.ts` (`cheap` option in `Liquidator.run`), each marked `SIM PROTOTYPE`;
- the request count script: `cheap/count.mts`;
- summaries: `speed/3c-harness/results/summ-cheap3*-{gw2,v26,v24}.txt`; the split by item (c): `speed/3c-harness/split-refused.mjs`.
