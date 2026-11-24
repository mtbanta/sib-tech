# Proposal: the half-second pause in the fresh-stop step (2026-11-24)

Michael's request of 2026-11-24 (evening), item 2: "Proposal only: the fixed ~0.5 s pause in the fresh-stop step. Can it be removed or shortened safely?"

Research input for Michael's decision, never an instruction to act. Paper trading only. Nothing here is built.

## 1. What the pause is

It is in `stacks/cyrus/src/sells.ts`, in the sale's step 2 ("wait until Alpaca shows nothing holding those shares"). After the sale cancels orders (for a leftover position, the rest of its take-profit), it waits once for a plain half second, then looks again. The code's own reason: "a cancel takes about 0.2 s, and neither the open list nor qty_available is guaranteed to show the exits". On 2026-11-02 Alpaca's open list did not show a filled entry's exits, so the pause is what lets the cancel land before the first look. Group 1 ruled, in an earlier round, that nothing ends it early.

It is shared by every sale that cancels something:
- one position's own sale that cancels its exits: the leftover's fresh stop or exit pair, and the missing-exit sale (the fast sale cancels nothing, so it does not pause);
- every whole-account sale: the close-outs, `flatten`, the loss stop, the carried-position sale.

## 2. What it costs, measured on 2026-11-24 (33 fresh stops after 11:44 AM, v39's times)

The time from the take-profit cancel's answer to the moment the sale asked for the new stop was **841 / 861 / 1,808 ms** (lowest, median, highest). That is the largest single piece of the stack's own time; the whole was 1.5 to 3.8 s, median 1.9 s.

From the code (inferred, since a leftover's sale does not store its reads), the median 861 ms is roughly:
- **about 140 ms:** one read of open orders and positions, made and then thrown away;
- **500 ms:** the pause;
- **about 140 ms:** the same two reads again;
- **about 70 ms:** a fresh positions read before selling.

**Alpaca's side, measured:** the cancel was answered in 64 to 107 ms. Alpaca's own cancel time on the take-profit rest came *before* the stack got that answer in 32 of 33 cases. The exception was BBY-26, 174 ms after the answer. So in practice the shares were already free when the pause began.

## 3. Options

**A. Pause first, then read (drop the thrown-away reads).**
- **Saves:** about 140 ms and 2 requests per sale. Nothing else changes: the same half second, then the same reads.
- **Risk:** none found. The first reads are never used today.

**B. End the pause early when Alpaca's live update confirms every cancelled order cancelled.**
- **How:** only for the exact order ids this round cancelled, and only when the live updates are connected. Without them, the full half second as now.
- **Saves:** typically 300 to 430 ms; the cancel's live update arrives about 40 to 100 ms after Alpaca's cancel.
- **Risk:** low. This is not "any update for the symbol", which is what group 1 ruled out earlier. If the update arrives before Alpaca's positions show the shares free, the look after it sees them still held, and the existing poll waits 250 ms, then 400 ms, as today.

**C. Shorten the pause to a fixed 250 ms.**
- **Saves:** 250 ms on every sale.
- **Risk:** on a slow cancel the look sees the shares still held and polls again, as today. BBY-26's cancel landed 174 ms after its answer, still inside 250 ms. No case slower than that is measured for a leftover's take-profit.

**D. Remove the pause.**
- **Not recommended.** The risk is a wrong look: the open list or the free-share count showing the shares free before the cancel has landed.
  - For a leftover, the fresh stop or exit pair would then be sent on shares still held by the take-profit. Alpaca would refuse it with a definite 4xx answer, and today's rules then sell the leftover at market instead of protecting it. That is a change to trading results.
  - For a whole-account sale, the market sale would be refused and the next round would sell it, about a second or more later.

## 4. Recommendation

- **Build A and B together,** for one position's own sale only (the leftover's fresh stop or exit pair, and the missing-exit sale). Leave the whole-account sales unchanged, so the close-outs keep their measured behaviour.
- **Expected:** cancel answer to new stop about 300 to 350 ms instead of about 860, so a fresh stop's total median about 1.4 s instead of 1.9 s. This is an estimate from the measured pieces, not a measurement.
- **Measurement after it runs:** the fresh-stop `times` rows (v39 on) give the same spans, so the next day's review can compare directly.
- **What it touches:** the sell path, so it is money-touching: group 1 and group 2 review, deployed outside market hours, and only with Michael's go-ahead.

Research input for a human decision, never an instruction to act. Paper only.
