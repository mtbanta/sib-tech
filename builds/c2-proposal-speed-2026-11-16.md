# Proposal: the speed release (afternoon of 2026-11-16)

Asked by Michael on 2026-11-16 (saved verbatim in `builds/build-c2-log.md`, "Michael's ruling on item 2 and the afternoon plan", with his update to item 1). **No code until he approves.** After approval: build and review on its own branch this afternoon (up to 8 rounds a group); deploy before 7:30 AM Tuesday only if both groups pass; nothing deploys in market hours without his written yes.

**Status: estimates from this morning's measurements.** "Measured" means read from this morning's records (v23, load day, 8:45 to 10:30); "estimate" means a calculation; "simulated" means the test simulator. This is research input for a human decision, never an instruction to act. Paper trading only.

## The numbers everything below uses (measured this morning)

- **Requests by source, 8:45 to 10:30:** entries and their 5 second cancels 12,925 (75 percent); routine reads 3,815 (22 percent; 30 to 55 a minute, median 37); first tries of safety work 987 (5.7 percent); budgeted retries (P1, P2) 0. Alpaca's clock 527 (a separate bucket).
- **Requests per entry:** 12,925 / 8,207 = **1.58** (each entry, plus a cancel for the 58 percent that did not fill in 5 seconds). So at the peak, when the governor holds entries back to keep the reserve, **every request a minute taken from entries costs about 0.63 accepted entries a minute** (1 / 1.58), and every request a minute given back gains about 0.63.
- **Peak:** 116 accepted entries in the busiest calendar minute (8:49), 121 in the busiest 60 seconds; the governor held entries back 448 times (it, not the 150 ceiling, set the pace in the first 20 minutes).
- **Routine reads, from the code:** the loss stop's account read every 5 s (12 a minute); the account and positions view every 10 s, checked on the 5 second pass, so every 10 to 15 s (about 10 a minute); settings every 30 s (2 a minute); the order sync every 10 s, also started only by the 5 second pass, so 10 to 15 s apart (about 5 a minute, 2 to 5 requests each: the order list's pages, positions, older lookups).
- **Lost exits noticed late:** 9 `late_notice` cases, found by the order sync 6.4 to 14.1 s after Alpaca's cancel with no live report of it (6 with the stream live, 3 at the 9:54 reconnect, which v24 now covers with a sync at once).

## 1. A 1-second worker pass, and how often the order check runs

**Today:** the worker's pass runs every 5 s and starts the 10 second order check only on a pass, so checks run 10 to 15 s apart (14.3 s before the 9:55 case). A 1-second pass makes every timed step start within 1 s of its time. The pass itself makes no request; its CPU is the question (the worker used at most 3.5 percent of a CPU this morning, measured; a pass every second instead of every 5 is an estimate of well under 1 percent more, to be measured).

**The order check (a sync: about 3 requests when busy, up to 5; measured from the routine counts):**

| Check every | Checks a minute | Requests a minute | Change from today | Accepted entries a minute at peak | Worst time to notice a lost exit the live updates did not report |
| --- | --- | --- | --- | --- | --- |
| Today (10 s on a 5 s pass) | 4 to 6 | 14 to 24 | 0 | 0 | about 15 s plus the check's own time (0.5 s, up to 5 s when busy): 15 to 20 s (14.1 s measured) |
| 6 s | 10 | 30 to 50 | +16 to +26 | **-10 to -17** | 6 s plus the check: about 7 to 11 s |
| 4 s | 15 | 45 to 75 | +31 to +51 | -20 to -32 | about 5 to 9 s |
| 2 s | up to 30 (a busy check takes 2 to 5 s, so in practice back to back) | 60 to 150 | +46 to +126 | -29 to -80 | about 3 to 7 s |
| Adaptive: 6 s, and 2 s while the live updates are down or for 30 s after any protection event | 10, and up to 30 in fast mode | 30 to 50, and 60 to 150 in fast mode | +16 to +26, and +46 to +126 in fast mode | -10 to -17, and -29 to -80 in fast mode | 3 to 7 s in fast mode, 7 to 11 s otherwise |

All rows are estimates from the measured cost per check; the worst-case notice is the check interval plus the check's own time (measured 0.5 s typical, 2.2 to 5.2 s in the 7 slow checks this morning).

**How often the adaptive version would have been fast this morning (measured from the events):** 182 protection events; 30 s after each covers 1,169 s of the 6,300 s window (18.6 percent). They cluster in the busiest minutes (8:45 to 8:46, 9:00 to 9:01, 9:05 to 9:07), exactly when the governor was already holding entries back. So in those minutes the fast mode would take 29 to 80 accepted entries a minute, when the stack can least spare them.

**What each risks:** more checks spend requests entries would use (above); a check never sells by itself, the protection loop does, so more checks do not add sales. The 2 s and adaptive versions also add load on the database writes the check makes (not measured; the check's own time is 0.5 to 5 s, so 2 s checks would overlap and queue).

**Recommendation: the 1-second pass, the order check every 6 s, and 2 s only while the live updates are down** (not for 30 s after every protection event). Why: the live updates report almost every lost exit within milliseconds, v24 already syncs at once after a reconnect, and the protection loop already looks at an affected entry by itself after a protection event; the case left is an update Alpaca never sent while connected (6 this morning), where 6 s halves the worst notice (15 to 20 s down to 7 to 11 s) for about 10 to 17 accepted entries a minute at the peak. The adaptive version's extra cost lands in the busiest minutes for a gain only on those 6 cases.

## 2. The reserve

*(Simulated results to follow: a full flatten of 30 positions with slow cancels at reserves of 40, 50 and 60, against today's 80; the lowest that never got a rate-limit answer.)*

## 3. Cheaper entries, fewer routine reads, and the stuck-retry items

### 3a. Cheaper entries (fewer expiry cancels)

**Today (measured):** 42 percent of entries filled within 5 s; the other 58 percent each needed a cancel, so an entry costs 1.58 requests. The cancels also cause lost exits: an entry that fills just as its cancel lands loses both exits (25 this morning, all sold; 3 sat 16 to 22 s).

**Option A (recommended to try on one load day): price entries to fill.** The load window's limit buy at or below the last price seen becomes a limit at the price seen plus 1 cent (still a limit order with its bracket at Alpaca). If the fill rate rises from 42 to about 85 percent (an estimate; to measure), cancels fall from 0.58 to about 0.15 an entry and an entry costs about 1.15 requests.
- **Gain (estimate):** at this morning's entry request rate in the peak minutes (about 165 to 180 a minute), accepted entries rise from about 110 to the 150 ceiling (about +35 to +40 a minute), or the same entries for about 27 percent fewer requests. Lost exits from late cancels fall roughly with the cancels (about 25 to about 7 a load morning, an estimate), which also cuts protection time.
- **Risk:** each fill pays about 1 cent more per share (an estimate of about 35 to 70 dollars more cost on a load morning at this morning's volume, 1-share entries); more fills mean more open positions and more exits to watch (more protection work, though each one is the normal kind). It changes entry pricing, which touches money (group 1).
- **Not available (to confirm in Alpaca's documentation before building):** an entry that cancels itself at Alpaca (time in force "immediate or cancel") is, as far as the builder knows, not allowed on a bracket order, so the cancel cannot simply be handed to Alpaca.

**Option B: a longer wait than 5 s before the cancel.** Fewer unfilled entries need a cancel only if more fill in the extra time (this morning's fill times would show how many fill between 5 and 10 s; not yet measured). It also keeps each symbol busy longer (one working entry per symbol). Smaller gain; not recommended before measuring.

### 3b. Fewer routine reads

| Change | Requests a minute saved (estimate) | Accepted entries a minute at peak | Risk |
| --- | --- | --- | --- |
| Account and positions view every 20 s instead of 10 while the live updates are connected (they keep the positions current in between) | about 5 | +3 | the gate's cash and buying-power figures up to 20 s old (positions stay live); at 1-share load entries, small |
| The loss stop's account read every 10 s instead of 5 | 6 | +4 | the loss stop fires up to 5 s later; on 2026-11-10 it fired 1.81 dollars past the limit with the 5 s read, so somewhat more overshoot (an estimate of a few dollars); a change to a safety check, for Michael |
| Both | about 11 | about +7 | as above |

Not recommended: making the loss stop rely on the shadow book (its largest gap this morning was 0.15 dollars, measured, but it was ruled shadow only and the gain is the same 6 requests a minute).

### 3c. The stuck-retry items already drafted

From `builds/c2-proposal-stuck-retry-cost.md` (items 1 to 4). This morning had no stuck retries at all (P1 and P2 0), so none of them would have changed today's numbers; they matter on days when positions get stuck (2026-11-09: four positions for 16 to 28 minutes).
- **Item 1, a retry costing about 3 requests instead of 10:** average wait between one position's tries with 5 stuck, about 75 s to about 20 s (estimate); touches the sell path; needs the gate tested against late and lost live updates.
- **Item 2, a retry budget that grows with spare room (60 at least):** when quiet, about 75 s to about 23 s with 5 stuck (estimate); no help in busy minutes; touches only the request budget.
- **Item 3, fair turns among stuck positions:** the longest single wait close to the average (5 stuck: up to 257 s in one sweep, about 75 s average); order only.
- **Item 4, ending the low-priority hold when the waiting retry gets in:** gives low-priority work its room back sooner; the hold counter (v23) measures its time in force (0 this morning).
- Entries are not affected by any of them at the peak (retries use the safety budget, not the entries' share).

### 3d. Item 2 of the mid-day build (side-by-side missing-exit sales)

Not in this list, but pending Michael's ruling: running side-by-side sales giving way at their next step once a close-out, `flatten` or the loss stop is asked (group 1's finding, `builds/build-c2-log.md`, "Item 2 (ruling), group 1 round 1"). It would join this release if he rules.

## 4. Messaging: the bot acknowledges a deploy approval line (approved by Michael, 2026-11-16, about 12:55 PM)

Michael's words: "Messaging fix for tonight's release: the bot should recognize a deploy approval line in commands ("Yes, deploy <commit> now.") and reply "Deploy approval for <commit> noted; the builder will deploy it if every check passes." instead of "I did not understand". The bot must not act on it itself; it only acknowledges. Group 2 review."
- Today at 12:45 his yes drew "I did not understand the line ...". The fix recognises only that line in `commands` from him, replies with the acknowledgement, stores nothing that any step reads, and does nothing else (no deploy, no state change). The builder still checks every deploy condition and passes his yes to `tools/midday-deploy.mjs` itself.
- No requests, no effect on entries or protection. Group 2 review (Michael's choice).

## Summary of expected gains (estimates)

| Item | Accepted entries a minute at peak | Protection time |
| --- | --- | --- |
| 1, 1 s pass with checks every 6 s (2 s while the updates are down) | -10 to -17 | worst notice of an unreported lost exit 15 to 20 s down to 7 to 11 s |
| 2, the reserve | (from the simulation) | (from the simulation: time to flat in a full flatten) |
| 3a, entries priced to fill | +35 to +40 (to the 150 ceiling) | about 70 percent fewer lost exits from late cancels |
| 3b, fewer routine reads | about +7 | the loss stop up to 5 s later (if that part is taken) |
| 3c, stuck retries | 0 | 5 stuck: average wait about 75 s down to about 20 s |

Paper trading only. Research input for a human decision, never an instruction to act.
