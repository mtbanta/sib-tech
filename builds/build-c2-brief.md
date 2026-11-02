# Build C2 brief: close build C, then upgrade stack C for fast trading

## Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:

- Launched from `~/Projects/sib-tech` in a fresh session, after Monday 2026-11-02's close and after Tuesday's limits request posted.
- Model: Sonnet 5.5, high effort. Advisor: on, Opus 5.5. Auto-mode: on.
- Playwright MCP confirmed connected with `/mcp`.
- Copied from the raw file in TextEdit.

## What this is

Two jobs, in order:
1. Close build C, per `builds/build-c-brief.md`.
2. Upgrade stack C so it can trade fast. Michael clarified after the first paper session that he wants this capability. Stack D, built later, gets the same capability.

All of `builds/build-c-brief.md` still applies (accounts, separation, autonomy, hard stops, sessions, checks and review) except where this brief changes it. Read it, `builds/build-c-log.md`, `PROJECT_STATE.md` and `CLAUDE.md` before starting.

## Step zero: save this brief

Write this entire brief, verbatim and unedited, to `builds/build-c2-brief.md`. Create `builds/build-c2-log.md` and append to it as you work, as in build C.

## Job 1: close build C

- Review today's first paper session from the database, the logs and the Discord messages: what was approved, the screen, the live list, entries, refusals, the close-out and the summary. Note anything that did not behave as designed.
- A read-only check already ran this evening. Its findings, to record in `builds/build-c-log.md` and fix in job 2:
  - At 2:55 PM the bot sold HRL, COO, AEM, FIS and RMD, each with the alert "had no live protective stop". The alerts were false. Each had a live OTO stop from its entry fill until the close-out.
  - Cause: `closeOut` calls `closeAllPositions`, which cancelled the stops. About 5 seconds later `syncOrders`, which runs every 30 seconds and does not know a close-out has started, saw held positions with cancelled stops and sold each one separately. Each symbol had exactly one sell; the account was flat at 2:55:42 PM.
  - Unconfirmed: whether `closeAllPositions` placed any sells itself, or failed after cancelling. The Fly logs settle it. Read them with the Fly access you already use for deploys, and record the answer.
  - The events table had no rows for Monday.
  - Tuesday's suggested limits (1000, 200, 10) came from the fixed `SUGGESTED_LIMITS` constant in `ensureDay`, not Monday's approved values (2000, 500, 100).
- Run the deliberate heartbeat stop and recovery test now, after Tuesday's limits request has posted, as agreed.
- Finish build C's definition of done, write a closing section in `builds/build-c-log.md`, update `PROJECT_STATE.md`, commit and push.
- Report in the terminal, then start job 2.

## Job 2: the upgrade

### What Michael wants

- The ability to trade fast. React within seconds; within one second if that adds no cost. Not every trade will be fast.
- Volume up to what Alpaca's trading interface allows. That could be thousands of trades on some days.
- This is a retail fast-trading capability, not professional co-located high-frequency trading.
- Free single-exchange (IEX) data stays for the paper test. Algo Trader Plus comes with real money.
- Paper fills are not realistic at speed (queue position, partial fills, slippage). Michael accepts that for this plumbing test.

### Piece 0: verify, report, then continue

Research only, every source read first hand, nothing cited from a search summary. Record each answer with dated sources in `builds/build-c2-log.md`.

1. Alpaca's trading interface rate limit: the number, whether it is per account, per key or per login, what counts against it (orders, cancels, replaces, status checks), and what happens when it is exceeded.
2. How Alpaca's paper environment fills orders, as far as Alpaca documents it.
3. Current regulatory fees on sales and how Alpaca passes them through: the SEC Section 31 fee rate, the FINRA Trading Activity Fee, and any Consolidated Audit Trail fee.
4. Speed: measure the round trip from the Fly.io worker to Alpaca's paper interface with read-only requests, now, outside market hours. Say whether another Fly.io region would be faster, and at what cost.

Report the findings in the terminal. Continue straight into the build unless a finding contradicts a ruling below or needs a decision from Michael. In that case, stop and ask.

### The changes

1. **Trades per minute replaces trades per day.** The daily "trades" limit becomes a maximum trades per minute. It is one of the limits Michael approves each evening. You suggest a value. The bot accepts at most 100. Raising that ceiling is a hard stop.
2. **No maximum trades per day.**
3. **The daily loss stop stays the main safety net,** approved each evening as now.
4. **When limits can change.** Michael can change any limit from the evening post until the "Armed" message 5 minutes before the open. After "Armed", tightening is allowed at any time (a lower trades-per-minute cap, a lower loss stop, a smaller position size). Loosening is locked until the next evening post.
5. **An order-rate governor in fixed code.** It enforces the per-minute cap and keeps headroom under Alpaca's limit, so the stop command, protective stops, cancels and the close-out are never blocked by trading volume. Safety requests go first.
6. **A busy placeholder strategy.** Replace the breakout placeholder with one built to exercise volume: it trades often, stays long only, ends flat at the close, and stays inside every limit. It is still a placeholder, meaningless as a strategy, and documented as such. Its job is to prove the stack holds up at speed.
7. **Speed measurement.** Log the time from each decision to the broker accepting the order. Report the typical time and the slowest in the daily summary.
8. **Fee tracking.** Estimate the regulatory fees on every sale from the rates piece 0 confirms. Show the day's fees, the trade count and a running total in the daily summary.
9. **Several commands in one message.** The bot accepts one command per line in a single message and replies to each line. An unknown line gets a clear reply naming that line.
10. **A readable live list.** Post the live list one per line, numbered, as company name and ticker, for example "3. Intel (INTC)". Take names from the free Nasdaq symbol files the screen already uses. A symbol with no name shows the ticker alone.

11. **Close-out guard.** While a close-out is running, and after the close-out time has passed, `syncOrders` skips its missing-stop check and places no sells. The close-out alone flattens the account.
12. **The close-out works on its own.** Confirm from the Fly logs whether `closeAllPositions` placed Monday's sells. If it did not, or if it can fail after cancelling stops, fix the close-out so it reliably sells every held position, retries, and alerts Michael by name if anything is still held at the close.
13. **No sell larger than the position.** A hard check in fixed code: no sell order, from any path, may exceed the shares held at that moment, counting sells already open. The stack stays long only at any borrowing cap. If a sell would exceed the position, refuse it and alert.
14. **Events table.** Find out why the events table had no rows for Monday. If it is meant to record the day's events, fix it so it does; if it is not, say so in the log.
15. **Suggest the last approved limits.** Each evening, `ensureDay` suggests the most recently approved value for each limit instead of the fixed constant. A limit with no approved value yet (trades per minute, the first time) uses the constant. Michael still approves every day; an undecided limit still means no trading. The evening post says which values were carried forward.
16. **Accurate wording on action reports.** Messages reporting something the bot already did (a sale, a close-out) drop the "Research input for a human decision, never an instruction to act" line, or use wording that fits. Keep "Paper trading only." on every message.

Out of scope, already logged for later: when a carried position is found, the stack sells everything. Do not change that in this build.

### Deploying

- Never deploy, restart or stop the worker during market hours (8:30 AM to 3:00 PM Central on trading days).
- If the upgrade passes review and is ready before 7:30 AM Central on Tuesday 2026-11-03, deploy it by then. The new release must repost Tuesday's limits in the new format, including trades per minute, for Michael to approve before "Armed". If it cannot make 7:30 AM, leave release v4 running for Tuesday and deploy after Tuesday's close.

### Checks and review

- Every piece: the secret scan and the full test suite.
- Money-touching pieces (the governor, the limits changes, the placeholder's order path, the close-out under load, the close-out guard, the no-oversell check) and the end of the phase: the `build-reviewer` agent, up to three rounds without asking. Stop and flag Michael if round three fails, or on any STOP AND FLAG MICHAEL verdict.

### Definition of done

- Every change above works, deployed on Fly.io against Alpaca paper, outside market hours.
- A high-volume rehearsal on a recorded trading day passes, with the broker simulated in code: the governor holds the cap; the stop command, protective stops and the close-out still get through at full volume; no false "no live protective stop" alerts at the close-out; no sell ever exceeds the position held; fees and speed appear in the summary; the account ends flat.
- A test where the close-out's bulk close fails after cancelling stops: the close-out still flattens the account and alerts Michael.
- The reviewer has passed every money-touching piece and the final phase.
- `builds/build-c2-log.md`, `PROJECT_STATE.md` and `CLAUDE.md` are current, everything is committed and pushed.
- A short checklist for Michael in the log: what the new evening post looks like, how trades per minute works, what he can change after "Armed", and what the summary now reports.

Then end the session. Do not start stack D.

## Prohibitions

- No live trading, no live keys, no live endpoints, anywhere.
- No deploying, restarting or stopping the worker during market hours.
- Nothing that touches stack D's resources.
- No credentials, API keys or account numbers in any committed file, commit message, log or Discord message.
- No reading anything in `~/Projects/relii`.
- Never send Michael's name, email address or any other personal information to any website or service, including in request headers. Do not disguise automated requests as a regular web browser. Give this rule, word for word, to any helper you start.
