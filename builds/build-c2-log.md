# Build C2 log

Brief: `builds/build-c2-brief.md` (saved verbatim). Stack C (cyrus) only. Paper only. Times are Central unless stated. Started Monday 2026-11-02, evening, after the close.

## Job 1: close build C

### What Monday's first paper session did (from the database, the Fly logs and Discord)

Sources: the stack's database (read-only queries), Fly logs (`fly logs`, retained buffer only, see below), and the three Discord channels read through the bot (read-only).

- **Evening request.** Posted Friday 10:16 PM after the v4 deploy. Michael did not answer over the weekend. At the 7:30 AM review it still said "NOT all decided". At 8:01 AM he sent four commands in ONE message (`Position 2000`, `Loss 500`, `Trades 200`, `Cap 1`); the bot answered `I did not understand` because it reads one command per message (this is change 9 in this build). He then sent them one at a time at 8:05 to 8:06. `trades 200` was refused (limit is 100). Final approved limits: position 2000, loss stop 500, trades a day 100, cap 1. All four decided at 8:06:09.
- **Screen and live list.** Built 7:45 AM, 20 names (AVPT GPN BFAM RDDT INTC CDNA APP RGEN CCJ COIN RBLX COO HRL ILMN AEM TWLO RMD SNOW MO FIS). The live list was posted as one long line of tickers (change 10).
- **Armed** at 8:25:04 (cap 1, long only, day start equity 20,000.06). Stream started 8:25.
- **Entries.** 14 entries, the first at 8:35:08 (COIN), the last at 12:35 (RMD). Every entry carried its protective stop at Alpaca (OTO). Time from decision to the "entry sent" log was about 0.5 s each (signal log to entry_sent log, from the Fly logs: for example COIN 14:35:07.950Z to 14:35:08.556Z). **Refusals: none.** The 100 a day cap never came close.
- **Exposure.** Peak exposure 19,625 dollars, 0.98 times equity (cap 1). So the "borrowing cap leaves no room" rule was close to biting; it never refused.
- **Stops.** Nine of the 14 positions were stopped out by their protective stops before the close-out; five (HRL, COO, AEM, FIS, RMD) were still held at 2:55 PM.
- **Close-out, 2:55 PM.** See the bug section below. Account flat at 2:55:42 PM, "Close-out done" posted. Summary at 3:05 PM: 14 entries, profit or loss -256.03 from closed trades, equity 20,000.06 to 19,744.03, 0 refused, flat. Request for Tuesday at 3:10 PM.
- **Heartbeat** stayed green all day (no fail pings).
- **Stop command and resume** were tested Friday (the stop flag was cleared by `resume` at 8:20 AM Saturday per the database). `status`, `help` and `stop` during the session were not exercised on Monday (the commands channel shows none).

### The close-out bug: what really happened (settled from the Fly logs)

Fly logs hold only a short buffer (Monday 9:01 AM to the present, 46 lines of the worker's own log; Discord has the rest). Timeline from the logs (UTC, subtract 6 hours for Central):

- 20:55:05.451Z `closeout_call_failed attempt 1: "Closing positions failed for: AEM, COO, FIS, HRL, RMD"`. **`closeAllPositions` placed no successful sell for any of the five.** Alpaca's bulk call answered 207 with a per-item error for every symbol, and our wrapper turned that into an error. The call had cancelled the open orders (the protective stops) first.
- 20:55:20 to :22 `unprotected_position` for HRL, COO, AEM, FIS, RMD from `syncOrders` (it ran, as it does every 30 seconds, saw held positions with cancelled stops and sold each with `closePosition`; each sale succeeded). Alerts "had no live protective stop" were false: the stops had been live all day and were cancelled by the close-out itself.
- 20:55:36.690Z `closeout_call_failed attempt 2: "Closing positions failed for: AEM, COO"` (attempt 2 ran because positions AEM and COO were still shown after the 30 seconds of looking; their sells from `syncOrders` had been sent but were not yet filled/visible in the position list; the bulk call failed for them again).
- Flat at 20:55:42Z. The close-out reported success only because `syncOrders` had done the selling.

**Answers to the brief's two open questions.** (1) `closeAllPositions` placed **none** of Monday's sells. (2) Yes, it **can fail after cancelling the stops**: it did, on both attempts. That is the failure the brief feared. Had `syncOrders` not run, the three retries would have been all the close-out had.

**Why each bulk item failed: not recorded.** `assertAllItemsOk` kept only the symbols, not Alpaca's per-item message, so the exact error text is lost. The most likely reason (a guess, not a measurement) is that the cancel of the stop leg is asynchronous: in my probe on 2026-11-02 evening a cancelled paper order took about 0.22 s to reach `canceled` (created 23:31:39.032Z, canceled 23:31:39.257Z), and until then the stop still holds the shares, so a sell for the full quantity has "insufficient qty available". What would turn it into a measurement: record the per-item message (done in this build) and see it on the next trading day.

### The events table had no rows for Monday: why

`events` is the stack's run log. `main.ts` writes to it only for `warn` and `error` level logs (`logAndStore`), and Monday logged only `info` events (the `closeout_call_failed` line is logged at info level by the worker's close-out wrapper). `closeout_not_flat` is written only when the account is NOT flat, and `day_lapsed` only on a lapse. The table's only two rows are from Friday (`day_lapsed`, 10/30) and Saturday (`not_flat_check_failed`, 10/31 4:01 PM, "The operation was aborted due to timeout", a 10 second Alpaca timeout). So it is working as coded, but not as the schema comment says ("commands, limit decisions, phases, errors"). **Fix (change 14):** the important info events (commands, limit decisions, arming, entries, exits, close-out calls and their failures, unprotected stops, the summary) are stored too; the high-volume ones (signals, per-trade lines) are not.

### Tuesday's suggested limits came from the constant

Confirmed: `ensureDay` builds every day from the fixed `SUGGESTED_LIMITS` constant (1000, 200, 10, 1), so Tuesday showed 1000/200/10/1 instead of Monday's approved 2000/500/100/1. Fix: change 15.

### Other things that did not behave as designed (additional to the brief's list)

1. The four-line command message was refused (change 9).
2. The 14 entries never hit a refusal, but the borrowing room was nearly used up (0.98 times equity with cap 1) from 9:14 AM; entries at 11:08 and 12:35 only happened because stops had freed room.
3. The live list is one long line (change 10).
4. The summary has no per-trade timing, no fees and no running total (changes 7, 8).
5. Messages that report an action already taken carry "Research input for a human decision, never an instruction to act." (change 16).
6. The gate makes four broker reads plus a database read before each entry (clock, account, positions, config). Fine at 14 entries a day, but at a few dozen entries a minute it would exhaust Alpaca's request budget (see piece 0, question 1). This is the main design pressure for change 5.
7. Entry fills were worse than the signal price on the free one-exchange feed (COIN signal 141.60, filled 142.66). Not a bug: the paper fill is against the best price at Alpaca, and the signal price is the last trade on one exchange.

### Heartbeat stop and recovery test (done 2026-11-02, after the close, after Tuesday's request posted)

- Worker machine stopped 5:27:55 PM. Healthchecks (period 60 s, grace 180 s) went `grace` at about 5:29 and `down` by 5:32:12 PM (about 4 minutes 15 seconds after the stop). Discord `alerts` shows the Healthchecks down message at 5:31:47 PM (the alert text is an embed).
- Machine started 5:33:14 PM; the worker posted "Stack C worker started ... Release MHEHVYZK again" at 5:33:19 PM; Healthchecks `up` at 5:33:36 PM; recovery message in `alerts` at 5:33:21 PM.
- The restart did not repost Tuesday's request (it was already recorded).
- **Michael's phone receipt of the two messages:** I can see both in the Discord channel; I cannot see his phone. Michael to confirm.
- Passed.

### A mistake of mine, said plainly

While loading `.env.local` into my shell with `source`, the shell treated the Fly token line as a command and printed part of its value into my terminal output (it is in this session's transcript and nowhere else: not in a file, a commit, this log or Discord). I then switched to reading single values by name with `grep`. **Michael may want to rotate the Fly token** (Fly dashboard, Tokens), then replace `FLY_API_TOKEN` in `stacks/cyrus/.env.local`. I do not know how widely that token is scoped. I will not rotate it for him: it is his account.

## Piece 0: verify and report

Research only. Every source below was fetched first hand with `curl` (honest identifying user agent `sib-tech-research/1.0 (personal research script)`, no personal information sent) or measured by me. Web search was used only to find addresses, and nothing is cited from a search summary. `sec.gov` answered 403 to my honest identifier (it wants a contact address in the user agent, which I will not send), so I did not read `sec.gov` pages; the SEC rate is taken from FINRA's own notice and Alpaca's fee schedule instead (below).

### 1. Alpaca's trading interface rate limit

- **The number.** Measured on the paper server 2026-11-02 evening with the stack's paper key, from the response headers `X-Ratelimit-Limit`, `X-Ratelimit-Remaining`, `X-Ratelimit-Reset`:
  - `/v2/account`, `/v2/orders`, `/v2/positions`, `/v2/account/configurations`: **limit 200**, one shared counter (remaining fell 199, 198, 197, 196, 195 across alternating calls to these endpoints).
  - `/v2/clock` and `/v2/calendar`: **limit 1000**, a **separate** counter that did not move the 200 counter.
- **How it refills (measured).** A burst of `GET /v2/account` as fast as possible: **242 requests succeeded in 13.8 seconds before the first 429.** That fits a bucket of 200 that refills at 200 a minute (3.3 a second): 200 + 13.8 s x 3.3 = about 246. The first request after the 429 succeeded 1.06 seconds later with remaining 4. So: you may burst up to 200, and sustain 200 a minute. (That is a model fitted to one burst, not a published design; a second burst would test it.)
- **What a refusal looks like (measured).** HTTP 429, body `{"code":42910000,"message":"rate limit exceeded"}`, `X-Ratelimit-Remaining: 0`, no `Retry-After` header.
- **Per account, key or login.** Alpaca's support page "Is there a usage limit for the number of API calls per second?" (https://alpaca.markets/support/usage-limit-api-calls, dated December 2022, read 2026-11-02) says: "currently 200 requests per minute, per account", users cannot raise it themselves, and a client over it gets 429. With one key I cannot tell per key from per account; I have one key. The page predates the 1000 clock limit I measured, so it is old. The documented Broker API limits (a different product) are per partner and unpublished (https://docs.alpaca.markets/us/docs/broker-api-rate-limits.md, read 2026-11-02): it is the only rate-limit page in the current docs index, and it does not cover the Trading API.
- **What counts (measured, partly).** Every call I made appeared to draw on the 200 counter, including reads, an order submit, a rejected order (422), a replace attempt (422), a cancel (204) and a cancel of an unknown id (404): the counter moved in step with calls to within the refill during the test. I could not separate the weight of each kind because of the 3.3 a second refill. Plan on **one request each**. A rejected request still counts.
- **What this means for the build.** An OTO entry (buy plus protective stop) is ONE request. An exit sell is one more. So 100 orders a minute is half of the budget; the other half is for the stop command, cancels, the close-out, status reads. The current gate uses four broker reads per entry (clock, account, positions, config), which is 5 requests per entry; at 20 entries a minute that alone is the whole budget. The reads must come from a cached view or from Alpaca's order-update stream, not per entry.

### 2. How Alpaca's paper environment fills orders

From https://docs.alpaca.markets/us/docs/paper-trading.md (page updated 2026-07-07, read 2026-11-02):
- It is "a real-time simulation environment"; "the system simulates the order filling based on the real-time quotes". "All orders submitted in paper trading will be matched against the best available current market price (NBBO)", whatever the account type.
- "Orders are filled only when they become marketable" (a non-marketable limit does not fill until its limit reaches the best ask for a buy or the best bid for a sell).
- "Your order quantity is not checked against the NBBO quantities... you can submit and receive a fill for an order that is much larger than the actual available liquidity." "When orders are eligible to be filled, they will receive partial fills for a random size 10% of the time", and the remainder is re-evaluated.
- Paper does **not** account for: market impact, information leakage, price slippage due to latency, order queue position, price improvement, **regulatory fees**, dividends. It does not simulate dividends and sends no fill emails. Borrow fees are not charged ("Coming Soon").
- My own observations: a paper market order after hours is accepted and held (a queued day order); a cancel completes asynchronously in about 0.2 seconds.
- Not documented, so unknown: how fast a fill is after acceptance, and the bulk-close behaviour described above.

### 3. Regulatory fees on sales and how Alpaca passes them through

Primary sources, read 2026-11-02:
- **Alpaca's Brokerage Fee Schedule** (https://files.alpaca.markets/disclosures/library/BrokFeeSched.pdf, linked from https://alpaca.markets/disclosures), "Equities": 
  - **SEC transaction fee (Section 31):** on sells only, **$0.0000206 x trade value** (that is $20.60 per million dollars).
  - **FINRA Trading Activity Fee (TAF):** on sells only, listed as **$0 per share** at present.
  - **FINRA CAT fee:** on **buys and sells**, **$0.000003 per executed equivalent share** (1 share of an NMS stock = 1).
  - How charged: "calculated on the exact executed quantity... Each fee type is aggregated separately at the daily, per-account level. After aggregation, each fee total is rounded up to the nearest cent... Accrued fees are reflected in account balances intraday and posted at end of day." Alpaca "passes through" these and "Fee rates and applicability are detailed below and are subject to change without notice". Alpaca's docs (https://docs.alpaca.markets/us/docs/regulatory-fees.md) say the same: fees accrue intraday, are charged at end of day, and totals round up to the cent (a 0.00083 fee becomes 0.01).
- **SEC Section 31 rate:** FINRA Information Notice 3/17/26 (https://www.finra.org/rules-guidance/notices/information-notice-20260317): effective April 4, 2026 the rate rose from $0.00 to **$20.60 per million dollars**, matching Alpaca's schedule.
- **FINRA TAF:** FINRA's rule filing SR-FINRA-2026-021 (https://www.finra.org/sites/default/files/2026-09/SR-FINRA-2026-021.pdf), filed for immediate effectiveness, **pauses the TAF (rates set to $0.00) for transactions from October 1, 2026 through December 31, 2026, resuming January 1, 2027.** The rate it restores is **$0.000195 per share for a sale of a covered equity security, with a maximum of $9.79 per trade** (quoted from the filing's rule text). FINRA's rulebook page (https://www.finra.org/rules-guidance/rulebooks/corporate-organization/section-1-member-regulatory-fees) still shows the older $0.000166 and $8.30 and so lags the filing. So **today the TAF is zero, and from 2027-01-01 it is $0.000195 a share capped at $9.79 a trade** (the filing text, not Alpaca's schedule, is the source for the restored rate).
- **CAT fee:** the CAT plan's own notice (https://catnmsplan.com/sites/default/files/2026-04/04.01.26-CAT-Fee-Alert-2026-1.pdf, CAT Fee Alert 2026-1, published 4/1/2026): CAT Fee 2026-1 is **$0.000001 per executed equivalent share**, on each buy and each sell, invoiced from June 2026 until a new fee takes effect, separate from any Historical CAT Assessment. **Alpaca's schedule charges $0.000003**, three times the plan's rate. The stack uses Alpaca's figure because that is what Alpaca withholds; it is a rate set by Alpaca's schedule, not by the plan, and I do not know why they differ (a guess: a different factor or a cushion; Alpaca would have to say).
- **Estimating a sale in this build:** SEC fee = 0.0000206 x sale value; TAF = the rate in force on that date (0 until 2026-12-31, then 0.000195 per share capped at 9.79); CAT = 0.000003 x shares on every buy and every sell. Day totals round up to the cent per fee type, as Alpaca does. These are estimates for the summary: the paper account charges none of them.

### 4. Speed: round trip from Fly.io to Alpaca paper (measured now, market closed)

Read-only requests (`GET /v2/clock`, `GET /v2/account`), 40 sequential requests each over one kept-alive connection, run on Fly machines of stack C's own app, 2026-11-02 about 5:34 PM Central. "Cold" is the first request on a new connection (DNS + TLS).

| Where the code runs | /v2/clock p50 | /v2/clock p95 | /v2/account p50 | /v2/account p95 | cold |
| :-- | :-- | :-- | :-- | :-- | :-- |
| San Jose (`sjc`, where the worker runs now) | 69 ms | 72 ms | 70 ms | 74 ms | 71 to 303 ms |
| Ashburn, Virginia (`iad`) | 6 ms | 12 ms | 7 ms | 9 ms | 8 to 718 ms |
| Newark (`ewr`) | 12 ms | 16 ms | 13 ms | 19 ms | 14 to 718 ms |

(From my Mac in Chicago the same calls took about 52 to 60 ms.) Alpaca's paper API is evidently in the US East; the worker in San Jose pays about 64 ms more per request than one in Ashburn. An order submit from the Mac took 61 ms for a valid order.

- **Would another region be faster? Yes: Ashburn by about 63 ms per request (70 to 7 ms), Newark by about 57 ms.** **Cost:** Fly's pricing page (https://fly.io/docs/about/pricing/, read 2026-11-02) says machine prices "vary by region" and lists Ashburn (`iad`) and Secaucus (`ewr`) as "our lowest-priced regions": a shared-cpu-1x 512 MB machine (the worker's size) is $3.69 a month there when running all the time. I did not find San Jose's price on that page (the per-region table is on a separate page I did not read), but since `iad` is named the lowest-priced region it cannot cost more than San Jose. So the move costs nothing extra and may save a little; no new plan is involved.
- **The catch.** The database is in Oregon (`us-west-2`). A worker in Ashburn would pay about the same 60 ms-plus on every database call that the worker in San Jose now pays on every Alpaca call. So it only helps if the hot path (deciding and sending an order) does not wait on the database. Today the gate waits on the database several times per entry (stop flag, day, orders, then a write of the intent, then the stop flag again), which would be slower from Ashburn, not faster.
- **Plan.** Make the hot path run from memory (cached account, positions, flags, counters) with the database written behind it, then move the worker to Ashburn after a trading day. The one-off probe machines were created with `--rm` and are gone (`fly machines list` shows only the worker). No ruling is contradicted: the database stays in Oregon as ruled.

### Piece 0 verdict

Nothing found contradicts a ruling or needs a decision from Michael. Two items to tell him, neither blocking: the TAF pause and its return on 2027-01-01, and the CAT fee difference between Alpaca's schedule and the plan's own notice. The build continues.

### Probe artifacts

Order probe: one 1-share SPY limit buy at 1.00 dollar, client order id prefix `c2probe-`, placed after hours, replace refused (422, "cannot replace order in accepted status"), then cancelled; final state `canceled`, no open orders left. No position was ever opened.

## Job 2: the upgrade (built 2026-11-02, evening and night)

Order of work followed the advisor's advice: first the fixes for Monday's real faults (close-out, guard, no-oversell, events), then limits and the governor, then the gate and the strategy, then the display items. Paper only throughout; nothing was deployed during this build step.

### Design decisions (and why)

1. **No bulk sale anywhere.** Alpaca's "close all positions" and "close one position" calls are gone from the client (a test fails if any code path calls them or the positions DELETE endpoint). `flatten`, the loss stop, the carried-position sale, the unprotected-position sale and the close-out all use one `Liquidator` (`src/sells.ts`): cancel the exits that hold the shares, wait (with gentle polling) until Alpaca shows no open order on those symbols, sell each symbol with an explicit quantity, look again, repeat up to 4 rounds. It never cancels a sell it sent itself in an earlier round. What is still held at the end is returned and reported to Michael by name, with an owner mention.
2. **No sell larger than the position, from any path (change 13).** `SellGate` is the only code that calls `submitSell`. Its hard check: sell quantity must be at most the shares held minus the sells already open (a bracket's two linked exits count once, a pending cancel counts as still open). A refused sell sends nothing and alerts Michael. A structure test fails if any other file calls `submitSell`.
3. **Close-out guard (change 11).** The order sync (`syncOrders`) takes `protect`; it is false while a close-out or carried sale runs and from close minus 5 minutes on (asked again just before each sale). With it off the sync still updates records but sells nothing. The sync now judges each entry by its OWN order and its OWN exit legs, never by symbol (a name can be entered again), and runs in the background so reading Michael's next command is never held up.
4. **Close-out works alone (change 12).** Retried every 20 seconds until flat (before the close), then every 5 minutes; if anything is still held: an alert to `alerts` and `commands` naming Michael with a Discord mention; if it was flat but had trouble on the way, Michael is told it recovered. Test: the bulk cancel fails after cancelling the stops, the close-out still flattens, and Michael is told.
5. **Events table (change 14).** Not a bug in the table: it is the run log and only warnings and errors were stored. `src/run-log.ts` now also stores the info events that tell a day's story (commands, limit decisions, unprotected positions, sale problems, start and stop, the close-out result), and the close-out result and governor statistics are written directly. Per-trade events are not stored (the orders table has every entry).
6. **Trades per minute (changes 1, 2, 3).** `maxTradesPerDay` is gone; `maxTradesPerMinute` replaces it, 1 to 100. **100 is a constant in `src/limits.ts` (`MAX_TRADES_PER_MINUTE`); raising it is a hard stop and needs Michael.** Old records are read safely (`normalizeLimits`, `normalizeDay`): an old daily count is not mistaken for a per-minute cap, and an old "approved" day without the new limit goes back to pending. Suggested value, first time: 20 a minute. There is no daily total anywhere.
7. **The governor (change 5), `src/governor.ts`.** A sliding 60-second window for orders that open positions, capped at the approved value and never above 100; and a mirror of Alpaca's request bucket fed by the `X-Ratelimit-Remaining` header of every answer. Strategy work (entries and the reads that serve them) may only use the bucket down to 80 (`SAFETY_RESERVE`); the stop command, cancels, protective actions and the close-out are never held back by it, and safety writes (sells, cancels) wait out a 429 and retry with the same client order id. "Trade" here means an order the stack sends to open a position (an entry). A bracket's exits rest at Alpaca and cost no request.
8. **Speed (changes 6, 7).** The busy placeholder uses bracket entries (a market buy with a take-profit and a protective stop resting at Alpaca), so the fast loop needs no strategy sells at all. The gate no longer makes 4 broker reads per entry: a cached `BrokerView` (account and positions refreshed every 5 seconds, settings and clock every 30) feeds it, and a `CachingStore` serves the stop flag, the not-flat flag, the day's record and the day's orders from memory for 1.5 to 2 seconds (every write goes through it, writes the database first, and only then updates memory). The record update after a send and the Discord news run in the background; **nothing in the gate waits on Discord** (trade news goes to a digest posted in batches). The gate times each order from the moment it starts deciding until Alpaca answers (`acceptMs`, stored in the orders table), and the summary shows typical, 95th percentile and slowest. **The worker stays in San Jose tonight**: piece 0 shows Ashburn is about 63 ms faster to Alpaca, but the database is in Oregon, and the gate still writes each entry's intent to the database before sending (safety), so a move needs the database write taken off the critical path first. Recorded as a later option.
9. **Re-entry.** A name can be entered again once its position has closed. Ids are `cyrus-DATE-SYMBOL-n`; a unique row per entry; an entry still working blocks the name; a definite refusal by Alpaca makes the name wait a minute.
10. **Limits timing (change 4).** Before the "Armed" message (5 minutes before the open) any limit can change either way. From Armed until the close, a limit can only be lowered; loosening is refused with "Locked" and the day stays as it was; a lowered cap re-arms. After the close, the evening post opens the next day for any change. The command's target day is chosen by `targetDay` in `commands.ts` (an armed or re-arming approved day, until its close, else the next session).
11. **Carry forward (change 15).** `suggestedFromHistory` takes, for each limit, the value from the most recent earlier day where Michael decided that limit; a limit never decided uses the built-in constant; every limit still starts undecided and an undecided limit at the open still means no trading. The evening post marks each line "suggested from your approval on DATE" or "new suggestion: no earlier approved value".
12. **Tuesday (old-shape day).** At the first pass after a start, any future session saved without the build C2 marker (`phases.c2`) is reset: suggestions carried forward, nothing decided, status pending, and its request, review and reminder forgotten, so the request is posted again in the new format and no reply sent before it can count (`decideLimits` already refuses replies older than the request). Database change: `db/002-c2.sql` (additive: `orders.accept_ms`, `orders.closed_at`, `orders.take_profit_price`, `trading_days.carried`), applied to stack C's database on 2026-11-02 evening (v4 keeps working: it never reads or writes them).
13. **Several commands in one message (change 9).** One command per line, replies to each line in one combined Discord message (`**the line**: reply`), an unknown line is named, at most 20 lines per message. A single line behaves as before.
14. **Live list (change 10).** Names come from the Nasdaq symbol files the screen already reads (cleaned: "Intel Corporation - Common Stock" becomes "Intel"); posted numbered, one per line, "3. Intel (INTC)"; a symbol with no name shows the ticker. Names are stored with the day.
15. **Wording (change 16).** One function (`finalizeMessage`) puts "Paper trading only." on every message and cuts long ones without losing it. "Research input for a human decision, never an instruction to act." stays only on the limits request/review and the live list; reports of what the bot did (sales, close-out, loss stop, flatten, status, summary) carry only "Paper trading only."
16. **Fees (change 8).** `src/fees.ts`, from the rates in piece 0: SEC 0.0000206 of sale value, TAF 0.000195 a share capped at 9.79 and paused to 0 for 2026-10-01 to 2026-12-31, CAT 0.000003 a share on every buy and sell (Alpaca's figure); each type rounded up to the cent per day. The summary shows the day's estimate and a running total (replace-by-date, safe to repeat). Estimates only: paper charges none.
17. **The summary** is aggregated (totals, wins and losses, the eight symbols with the biggest result, speed, fees, request use, refusals by reason), so a day of thousands of trades still fits one Discord message. Profit is matched by quantity first-in first-out per symbol over Alpaca's fills (a name entered twice is not counted twice); the order list is read in pages.
18. **Phase writes** are now queued per day: two steps finishing together (one runs in the background) could read the same phases and drop one entry. Found by a test, not in production.

### Tests

245 pass (193 before), type check clean. New: `sells.test.ts` (sell gate, liquidator, the Monday case with five positions, the bulk cancel failing after cancelling stops, refused sells, an empty request bucket, a single-symbol sale, closed market), `c2.test.ts` (governor, caching store, digest, fees, summary maths, footer, run log, names, several commands, tighten-only, evening unlock, carry forward, Tuesday's reset, stop flag at once), `volume.test.ts` (the rehearsal). Existing tests were updated to the new interfaces; none was deleted without a replacement for what it checked. `test/sim-broker.ts` reproduces what was measured: cancels that take about 200 ms and keep holding the shares, linked bracket exits, a 200-request bucket with 429, the 500-row order list, injected failures.

### The high-volume rehearsal (a recorded day, broker simulated in code)

Input: a fixed, evenly spaced sample of Monday's first hour of IEX trades for the 20 live-list names (`test/fixtures/iex-2026-11-02-sample.json`, 6,265 prints), replayed six times across the session at six times the speed, plus a busy synthetic market (300 made-up names, ten prints a second) for the ceiling. Result of the first full runs:
- Recorded input, cap 30 a minute: **1,106 entries** (past the 500-row page limit, so paging was exercised), busiest minute exactly 30, no rate-limit refusals, a `stop` sent in the middle (and `status`, in the same message) got through in the same pass and no entry was sent while it was on, 14 sells all at the close-out, **no false "no live protective stop" alert, no sell above any position, account flat, summary posted once and under 2,000 characters** with speed, fees, running total and request use.
- Synthetic market, cap 100 a minute: about 2,000 entries, busiest minute under 100, the request bucket never below its reserve (lowest about 118 of 200), flat at the end.
Not proven by this test: Alpaca's real behaviour (the simulator is built from measurements and documentation, not from Alpaca), the speed in a real session, and the per-item text Alpaca gives when a sell is refused (not captured on Monday; now recorded in the run log).

## Checklist for Michael (plain English): what is new

**The evening post.** After each close the bot posts the next trading day's suggested limits in `commands`, like this (a real example from the code):

```
Suggested limits for Tuesday 2026-11-03 (market opens at 8:30 AM CT). Nothing is approved until you reply.
1. position: largest single position 2000 dollars (waiting for you) [suggested from your approval on 2026-11-02]
2. loss: daily loss stop 500 dollars (waiting for you) [suggested from your approval on 2026-11-02]
3. trades: at most 20 orders a minute, no daily total; the ceiling is 100 (waiting for you) [new suggestion: no earlier approved value]
4. cap: borrowing cap 1, where 1 means no borrowing (waiting for you) [suggested from your approval on 2026-11-02]
```

then the checklist, then how to reply. The suggested values are the ones you last decided (position, loss and cap from Monday); trades a minute is new, so it starts at 20. **You still have to approve every day.** If any of the four is undecided at the open, the bot does not trade that day.

**How trades per minute works.** It is the most orders the bot will send in any 60 seconds to open a position (each one is a buy with its take-profit and protective stop resting at Alpaca). There is no daily total, so a busy day can have thousands. The bot accepts 1 to 100; **100 is fixed in the code and raising it needs you** (it is half of Alpaca's 200 requests a minute, so the stop command, cancels and the close-out always have room). If the bot reaches your number it simply waits; if Alpaca's request budget gets low it also holds back, to keep the last 80 for safety. The daily loss stop is still the main safety net.

**Several commands in one message.** One command per line, for example:
```
position 2000
loss 500
trades 20
cap 1
```
The bot answers every line in one reply, and names any line it did not understand.

**What you can change, and when.**
- From the evening post until the `Armed` message (5 minutes before the open): any limit, up or down.
- After `Armed`, all day: a limit can only be lowered (a lower trades-a-minute cap, a smaller position, a lower loss stop, a lower borrowing cap). Trying to raise one gets "Locked" and nothing changes. A lower cap makes the bot set it at Alpaca again within seconds.
- After the close: the evening post opens the next day for any change again.
- `stop` still works at any time and is read first; `resume` clears it. `flatten` stops and sells everything.

**The live list** now arrives numbered, one per line, "3. Intel (INTC)".

**The daily summary** (about 5 minutes after the close) now reports: the number of entry orders and sells, wins and losses, the symbols with the biggest results (not every trade), profit or loss and the equity change, **speed** (typical, 95th percentile and slowest time from the bot's decision until Alpaca accepted the order, and how many orders that covers), **estimated regulatory fees** for the day and a **running total** (a live account would pay them; the paper account pays none; the FINRA trading fee is paused by FINRA until 2027-01-01), Alpaca request use (how close it came to the 200 a minute, how often the bot held back), refusals grouped by reason, the stop flag and whether the account ended flat.

**Trade news** no longer arrives as one Discord message per trade. It arrives in batches in `trading` about every 20 seconds while there is something to say.

**Things to know.** Messages that report something the bot already did (a sale, the close-out) no longer carry "never an instruction to act"; every message still says "Paper trading only." If the close-out cannot get the account flat, `alerts` and `commands` start with "Michael:" and the alert mentions you so your phone buzzes. Tuesday's request is posted again by the new release, in this format (if the release is deployed in time); answers to the old post do not count.


## Review round 1 (2026-11-02, evening): CHANGES REQUIRED, both reviews; all fixed in the next commit

Two `build-reviewer` runs on `123d0fc..914e5ea`, A on the sell path, B on limits, governor and gate. Checks 2, 7, 8 and 10 were clean in both (paper only, no secrets, separation, the 100 ceiling untouched). Blocking findings and what was done:

**A (sell path)**
1. *The no-oversell check did not hold when two sales ran at once* (it checked against a snapshot the caller built, nothing was serialised, no record of sells already sent). **Fixed:** `SellGate` now runs one sell at a time for every path, reads the broker itself (positions, and the open orders paged), subtracts the sells it sent since that read, and also stays below Alpaca's own `qty_available` when reported. `Liquidator.flatten` is single-flight: a second request waits its turn and finds the account flat. Tests: two liquidations at once (0 oversell attempts), two sells for the same shares asked inside one second (one goes, one is refused by the gate before the broker sees it).
2. *A failed read in the middle of a sale sold against an empty list of open orders.* **Fixed:** if the open orders or positions cannot be read in a round, no sell is sent that round. Test included.
3. *The close-out guard had no test that fails when removed, and `flatten` could still produce Monday's false alarm.* **Fixed:** `Liquidator.isLiquidating()` is true from the moment any liquidation is asked for until it ends, and the worker's `protectNow` (a public method now) switches the sync's missing-exit check off for that whole time and from 5 minutes before the close; a unit test fails if either half is removed (checked by mutation). Also a sale for one symbol that was queued behind a whole-account sale finds nothing and no longer says "so I sold it". A worker-level test drops a sync tick inside the close-out's slow cancels.
Non-blocking notes taken up: open orders are read in pages; nothing is sent while the market is closed (any path); `flatten` with an empty account still cancels leftover open orders; the loss-stop retry nudge is limited to one every 5 minutes; the liquidator now writes a `liquidation_result` event (and it is stored) so cancel and read problems during any sale are in the run log.

**B (limits, governor, gate)**
1. *A stop command could be hidden by a database read already in flight.* **Fixed:** every key in the caching store has a write counter; a read fills the cache only if no write happened while it waited, and otherwise the written value wins. Tests for the stop flag and for a day's limits.
2. *Exposure under-counted entries marked filled but not yet in the up to 15 second old account view.* **Fixed:** the gate counts every active entry the view does not show (sent, filled-not-shown, and the unfilled remainder of a partly filled one). The consequence, said plainly: the borrowing cap is enforced more tightly, so at very high volume the cap on exposure (not the orders-a-minute cap) is what limits entries until the order sync marks closed positions closed (up to 30 seconds). In the busy synthetic market the busiest minute fell from 61 to 46 orders. Also: the sync no longer calls an entry closed on a position read taken at the same moment as its fill (it waits until the fill is more than 10 seconds old).
3. *The governor forgot the last minute's entries after a restart.* **Fixed:** the first time the gate runs after a start it tells the governor about the day's entries from the last 60 seconds. Test: cap 3, three sent, restart 10 seconds later, the fourth is refused; a minute later it goes.
4. *Strategy work could spend the last request headroom* (the gate refreshed its view before checking the budget). **Fixed:** if the view is stale and the budget is at the reserve, the gate refuses before any request; after a failed refresh it waits 3 seconds before asking again; the settings repair is also held back at the reserve. Test counts broker calls (zero).
Notes taken up: the reset of an old-shape day now happens before any command is read; a lowered limit for an approved day whose arming is failing inside its last five minutes is still a tighten (not sent to the next day); `acceptMs` now starts when the signal reaches the gate, queue wait included.
Not taken up (logged): stale "intent" rows that never resolve; the daily loss check on every account refresh (the gate already checks equity from the view, `enforceDailyLoss` every 30 seconds as in v4).

**One assumption checked on Alpaca paper** (2026-11-02 evening, after hours): `GET /v2/orders?status=open&nested=true` returns an open bracket parent with its two legs nested (`sell/limit/held` and `sell/stop/held`), and a plain open list without `nested` shows only the parent. A filled parent with live legs could not be checked after hours. The liquidator therefore also waits on the position's `qty_available` (if Alpaca reports it) and every sell is also kept below it. **To check on the first trading day of C2:** read `status=open&nested=true` once while a bracket position is held and record whether the filled parent and its live legs appear (the C2 log gets the answer). If they do not, the liquidator still works by repeating rounds, but the open-sell count would be understated.

## Review round 2 (2026-11-02, evening): CHANGES REQUIRED, both reviews; all fixed

Fresh reviewers on `123d0fc..4ed7fc7`; checks 2, 7, 8 and 10 clean again. Round 1's seven fixes all held. New blocking findings, and what was done:

**A (sell path)**
1. *Close-out, `flatten`, loss stop and carried sale depended on an Alpaca behaviour nobody had checked* (that the open-order list shows a FILLED entry with its live exits; I had only seen it for an unfilled one, and my own log claim that rounds would cover it was wrong). **Fixed:** a whole-account liquidation now asks Alpaca to cancel every order in round 1 whatever the list shows (never while one of its own sells is open), asks again in later rounds if shares are still reported as held by orders nothing visible explains, and gives cancels half a second once when nothing visible shows what they hold. The simulator has two new switches (open list hides filled entries; no `qty_available`) and the key cases run in every combination (close-out of five positions, bulk cancel failing after cancelling, two liquidations at once, a sale asked twice, a failed read).
2. *The no-oversell check was sound only because of `qty_available`, and no test covered it.* **Fixed:** the sell gate reads open orders first and positions second (a sell that fills between the reads is counted twice, so it errs toward refusing), and a test that fails if the order is swapped fills a sale between the two reads with `qty_available` absent. A test also fails if the liquidator stops making the gate look again after its cancels.
Notes taken up: `flatten` now runs in the background (the reply says "selling now" at once and "flat" when done), so no pass or heartbeat waits on it; the sell gate's refusal alert is no longer waited on inside its queue.

**B (limits, governor, gate)**
1. *Two first loads of a day's orders could replace each other and lose an entry from memory.* **Fixed:** callers share one load, an update waits for any load in flight, and old days are dropped from memory.
2. *A partly filled entry could be marked closed at once and then block its symbol, count as exposure and escape the missing-exit check all day.* **Fixed:** the sync records partial fills and cancel-after-partial-fill as the position they made; "position gone" closes an entry only when the Alpaca order is final and its fill is clearly old (an unknown fill time counts as recent unless the entry itself is over a minute old); a closed row is never counted as working whatever its status; the gate's late "submitted" write never moves a row backwards. The simulator makes no partial fills, so these are tested directly.
3. *The daily loss stop was off while a mid-session re-arm kept failing.* **Fixed:** a day that is re-arming counts as armed for the loss stop. Test at the loss-stop level.
Notes taken up: a stop that cannot be written to the database is still believed in memory (safe direction); any 429 on a non-clock call empties the governor's budget even without headers; priming clamps future timestamps; tests for the five-minute tighten clause and the settings-repair hold-back. Not taken up: stale "intent" rows and the refusals-at-volume write (logged for later); `targetDay` locks loosening from five minutes before the open even if the Armed message never went out (stricter than the brief's wording, on purpose).

## Review round 3 (2026-11-02, night): A PASS, B STOP AND FLAG MICHAEL. Nothing deployed.

Round 3 is the last round the standing rule allows. Range `123d0fc..9bf8db0`.

**A (sell path): PASS**, no blocking findings. All round 2 fixes confirmed (cancel-everything in round 1, read order in the sell gate, the background `flatten` with the stop flag set first, the refusal alert not waited on). Brief items 11, 12, 13, 14, 16 and checks 2, 7, 8, 10 confirmed. Non-blocking notes, logged and **not changed** (the code passed review): (1) a whole-account sale that starts while one of its own sells is still open, or whose round-1 cancel call throws, falls back to cancelling only visible orders; this needs Alpaca to both hide a filled entry's exits from the open list and omit `qty_available` (which Alpaca documents as part of a position), and the result is a not-flat alert, never a short; suggested fix: drop the "own sell open" guard and repeat the cancel-all after a failed one. (2) The background `flatten` completion reply can carry the wrong line label after a multi-line message; cosmetic; fix: capture the prefix before starting the task.

**B (limits, governor, gate): STOP AND FLAG MICHAEL, one blocking finding.** Checks 2, 7, 8 and 10 clean. Round 2's fixes all hold.
- *If the order sync fails, the daily loss stop is skipped.* In the background "risk" step the loss stop ran after `syncOrders` with nothing catching the sync's errors, so a failed sync read (now a paged read of up to 20 requests) skipped the loss stop for that cycle; and if the stop flag could not be saved, `enforceDailyLoss` threw before selling. The reviewer measured it: with only the sync's read failing and equity 500 down against a 200 loss stop, over five passes the stop flag stayed off, nothing was sold, and after equity recovered a new entry was "sent". **This is not new in C2: release v4 has the same order** (`syncOrders` then `enforceDailyLoss` in its tick), but C2 makes it likelier.
- **Fix prepared, committed, tested, NOT reviewed and NOT deployed** (per the standing rule, no round 4 without Michael): the loss stop now has its own background task every 30 seconds, independent of the sync, with its own error catch and a rate-limited alert to Michael; and `enforceDailyLoss` still sells when the stop flag cannot be saved (and says so). Two new tests; the first fails if the old order is put back (checked). 284 tests pass.
- Non-blocking notes (logged): a stop that cannot be saved is believed in memory for only about 1.5 seconds, not "still believed" (my round 2 wording was too strong); stale "intent" rows (an entry whose send never reached Alpaca) block their symbol and count as exposure all day and pin the start of the sync's paged read (unlikely at 20 a minute, reachable near 100; the direction is safe: no trading); several mutations of cosmetic code survive.

### What is deployed, and what Michael decides

Fly still runs release **v4** (code `123d0fc`). Schema `002` is applied (additive, v4 unaffected). Everything in this build is committed and pushed but not deployed.

Michael's options (the builder's recommendation first):
1. **One more review round on the loss-stop fix (a round 4, which the standing rule does not allow without Michael), then deploy C2 if it passes.** The fix is about 40 lines in `worker.ts` and `risk.ts` and has tests. If approved tonight and it passes, deploy after the close tonight or before 7:30 AM Central, and Tuesday's limits repost in the new format.
2. **Deploy the prepared fix without another review.** Quicker, but the one change since the last pass is unreviewed.
3. **Leave v4 running for Tuesday and decide after.** What Tuesday looks like under v4: Tuesday's limits request (already posted, old format with a daily trades count) stays valid; the strategy is the old breakout placeholder; the close-out will fail the way Monday's did (the bulk sale cancels the stops and fails; the order sync then sells each position and posts false "had no live protective stop" alerts; the account should still end flat); no multi-line commands, no trades per minute, no fees or speed in the summary.

## Michael's decision after the round 3 stop (2026-11-02, night)

Michael approved **one more review round (round 4), scoped to commit `652146c`, the loss stop fix**, to check: (1) the loss stop fires on its own schedule whether or not the order sync succeeds, including when every sync read fails; (2) it still sells if the stop flag cannot be saved, and no new entry can be sent after the stop fires even if equity recovers; (3) it does not conflict with the close-out guard, the no-oversell check or the governor's rule that safety requests go first; (4) the loss stop and the close-out cannot both sell the same position.
- If round 4 passes: deploy C2 now, outside market hours and no later than 7:30 AM Central Tuesday; confirm Tuesday's new-format limits repost appears in Discord with Michael's approved values carried forward; finish the log, `PROJECT_STATE.md` and `CLAUDE.md`; commit, push, end the session.
- If round 4 fails or returns STOP AND FLAG: do not deploy, leave v4 running, report.
- Never print any token or key, even partly; redact anything that would.
Michael also confirmed he received both heartbeat messages (down and recovery) from the 2026-11-02 test on time. That closes the open item in build C's closing section.

## Review round 4 (2026-11-02, night): CHANGES REQUIRED. Not deployed; release v4 stays.

The extra round Michael approved, scoped to the loss stop fix (`652146c`). Checks 2, 7, 8 and 10 clean. Confirmed: the loss stop runs on its own schedule even when every order-sync read fails (and when a sync read hangs, or `getAccount` fails: one alert every 5 minutes, then it fires on recovery); the loss stop, the close-out and the sync together sell each position exactly once with no oversell in all 16 combinations of simulator mode and start order; the governor never holds back the loss stop's reads or sells; the close-out guard covers a queued or running loss-stop sale.

**Two blocking findings** (under Michael's ruling: do not deploy, leave v4, report):
1. *An entry can be sent after the loss stop fires if the stop flag cannot be saved and the sale does not finish.* The caching store believed an unsaved stop for only 1.5 seconds; after that the database (back up, still saying "off") was read, equity had recovered because nothing was sold, the next loss check saw the flag off and equity above the limit, and the gate sent an entry. (If the sale finishes, the account is flat and this cannot happen.)
2. *A failed Discord read skips the loss stop on every pass* (`commands.poll()` ran first, uncaught, so the pass threw before the loss stop was scheduled). Already in v4; the reviewer blocked on it because it has the same shape as round 3's finding.
Facts for the decision: v4 has both defects, and is worse on the first (when the flag cannot be saved, v4 throws and sells nothing).

**Fixes prepared after the round (committed, 287 tests pass, NOT reviewed, NOT deployed):** an unsaved "on" stop is now believed with no expiry until a later write to the stop flag succeeds (Michael's `resume` is such a write); `commands.poll()` is wrapped so a failed Discord read is reported (once per 10 minutes) and the pass goes on. Three new tests, including the exact scenario (flag unsaved, sale failing, equity recovered, gate refuses) and the Discord outage.

State: C2 is built, reviewed in 4 rounds (sell path PASS in round 3; limits/gate/loss stop still open on the findings above), schema 002 applied, nothing deployed. The standing review rule allows no further round without Michael.

## Michael's decision after round 4 (2026-11-02, late night)

Michael approved **review round 5, the final round tonight, on commit `86e24c4`**, to check: (1) an unsaved stop stays in force until a later successful write, across restarts of the pass, and no entry can be sent while it is in force, whatever equity does; (2) a failed or hanging Discord read is reported at most once every 10 minutes and never stops the pass; (3) a full audit of the worker loop: every call (Alpaca, Supabase, Discord, the clock, anything else) whose failure or hang could stop the loss stop, the protective stops or the close-out from running, each shown not to by a test or by code reading cited in the review.
- If round 5 passes with no blocking finding: deploy C2 outside market hours and no later than 7:30 AM Central Tuesday; confirm in Discord that the new-format limits repost for Tuesday appears with Michael's approved values carried forward; finish the log, `PROJECT_STATE.md` and `CLAUDE.md`; commit, push, end the session.
- If round 5 blocks or returns STOP AND FLAG: do not deploy, prepare no more fixes tonight, leave v4 running, write the findings here, and report. The design is revisited after Tuesday's close.
- Never print any token or key, even partly.

## Review round 5 (2026-11-02, late night): CHANGES REQUIRED. Not deployed; release v4 stays; no more fixes tonight.

Final round tonight, on `86e24c4`. Checks 2, 7, 8 and 10 clean (paper only, no secret or token in code, tests, logs or messages, separation, the 100 ceiling unchanged); `sells.ts` unchanged since the round 3 PASS. Per Michael's ruling no further fixes were prepared and nothing was deployed. The design is revisited after Tuesday's close.

### Michael's three questions

1. **An unsaved stop stays in force until a later successful write: yes, across passes.** It is returned before any cache or database read, nothing expires it, a day change and a read racing a write cannot clear it, and both of the gate's stop checks read it, so no entry goes out while it is set, whatever equity does. A failed `resume` leaves it in force (reply "That command failed"; Michael must send it again); a successful `resume` clears it. **After a process restart nothing is remembered** (it lives only in memory and the write is never retried once the database is back); the loss stop fires again by itself only if equity is still at or past the limit. A reviewer scratch test showed: unsaved stop, failed sale, restart, equity back above the line: no stop, and the gate sent an entry. Rated non-blocking (needs four things at once; v4 is no better), but Michael should know. Cheap fix noted: retry the write on every loss-stop pass while an unsaved stop exists.
2. **A failed or hanging Discord read: caught, at most one alert per 10 minutes, never stops the pass.** One call has a 10 second limit per attempt and a 429 is retried after a sleep of up to 10 seconds, so one read can delay a pass by about 30 seconds (the `ticking` guard skips passes meanwhile: the loss stop is late, not skipped). Discord POSTS never throw, but a few are waited on near safety work: `enforceDailyLoss` waits on its "could not be saved" alert before selling (up to about 30 s); `emergencyCloseoutIfNeeded` posts before closing out (about 30 s); `flushDigest` waits on up to about 5 digest posts before the close-out is scheduled (about 150 s in a 429 storm); `syncOrders` waits on the "rejected" post. `closeOut` and the loss-stop retry post only after selling.
3. **The audit** (below) found three defects that can stop the loss stop, the protective-stop check or the close-out, all three present in v4 as well.

### Blocking findings (all three also exist in v4, unchanged)

1. **One hanging Postgres query freezes the whole worker loop** (`pg-store.ts` `makePool`; `Worker.pass`, `Worker.tick`). The pool has no client-side query time limit (`query_timeout` is off by default) and no TCP keep-alive; the 15 second `statement_timeout` is enforced by the server, so it does nothing if the network path or the pooler goes silent; the 10 second `connectionTimeoutMillis` covers only connecting. `Worker.pass` waits on `ensureDay` (a `getDay`) before anything safety-related is scheduled, and the `ticking` guard then skips every later pass; `emergencyCloseoutIfNeeded` runs only when a pass fails with an error, never when it hangs. Reproduced: a query still unanswered after 25 seconds with the exact pool settings; a `getDay` that hangs from 20:50 UTC left the position held, 0 sells and 0 heartbeat pings past the 21:00 close. Cost: for as long as the hang lasts nothing runs (no loss stop, no missing-exit check, no close-out, no emergency close-out): about 15 minutes if the kernel gives up retransmitting, unlimited if the far end acknowledged but never answers. Entries are day orders, so the protective exits expire at the close and a hang across the close leaves positions held overnight with no stop (after the hang `closeOut` only reports, the market being closed). The only mitigation: pings stop and Healthchecks alerts after its grace period. Suggested fix: `query_timeout` (about 20 s) and `keepAlive: true` in `makePool`, and a watchdog in `Worker.tick` (a pass over about 60 s pings fail and runs the broker-only emergency close-out near the close).
2. **A hanging stop-flag write holds back the loss stop sale** (`risk.ts` `enforceDailyLoss`): it waits on `setControl(CONTROL_STOP)`, then `addEvent`, then sells; round 4 covered a write that fails, not one that hangs; the hung task also stays marked running so it never restarts. Cost: the sale waits for up to about 15 + 15 + 30 seconds on a slow server and forever on a dead connection. Suggested fix: start the sale without waiting on the write (the caching store already believes the stop) and move `addEvent` after the sale, or put a short limit on both.
3. **A failed database read in the session switches off the loss stop for the whole outage** (`Worker.pass`, `ensureDay` unwrapped; day cache 2 seconds, passes every 5): every pass reads the database, and a failed read ends the pass before "lossstop" and "risk" are scheduled; `enforceDailyLoss` would also fail on its own stop-flag read. Reproduced: every store call failing in session, equity 500 down against a 200 stop, five minutes: 0 sells; the round 4 alert "Trading checks, including the daily loss stop, continue" is false here. Entries are still refused (the gate fails closed), each position keeps its Alpaca stop and the emergency close-out still covers the close, but the day's loss can pass the approved limit by up to what the open positions' stops allow. Suggested fix: wrap `ensureDay` and fall back to the last day record held in memory; in `enforceDailyLoss`, if the stop flag cannot be read, check equity anyway, in the direction of selling.

### Non-blocking notes

A `resume` write still in flight can clear a loss stop whose own write failed (it fires again in 30 seconds only if equity is still past the limit). The round 4 gate-level test still passes with the unsaved-stop read removed (it runs inside the 1.5 second cache life); the unit test does catch it (mutation checked). `Worker.background` alerts on every failure of "risk" with no rate limit. The round 4 poll alert's claim that the loss stop continues is untrue while the database is down.

### The worker loop audit (call: time limit; can a failure end the pass before safety work is scheduled; worst stall; evidence)

| Call | Time limit | Failure ends the pass before safety is scheduled? | Hang / worst stall | Evidence / verdict |
| :-- | :-- | :-- | :-- | :-- |
| Postgres, any query (`pg-store.ts` `makePool`) | 15 s on the server only; 10 s to connect or wait for a pool slot; none on the client | `resetOldShapeFutureDays` (once per start) and `ensureDay` (every pass): yes. Caught in `notFlatCheck`, `limitsFlow`, `poll` | No limit | **Not safe** (findings 1 and 3) |
| Alpaca reads (`alpaca-trading.ts` `read`, `once`) | 10 s per request, 3 attempts (0.5 s and 1 s pauses): about 31.5 s | Caught in `refreshView`, `scanForCarried`, `limitsFlow` | `refreshView` up to about 63 s; `scanForCarried` about 31.5 s; calendar (cached) about 31.5 s | Loss stop late, never skipped |
| Discord read | see question 2 | Caught | about 30 s per call | Safe (late) |
| Discord posts awaited in `Worker.pass` catch blocks | about 30 s each | Never throw | about 30 s each | Safe (late) |
| Loss stop: `getControl`, `getAccount` | about 31.5 s for the account; Postgres none | Failures caught, alert at most every 5 minutes | | Test "the daily loss stop runs even when the order sync keeps failing" |
| Loss stop: `setControl`, alert post, `addEvent` before selling | none on a hang | | up to about 15 + 15 + 30 s, or forever | **Not safe** (finding 2) |
| Loss stop sale (`Liquidator.flatten`) | Alpaca calls limited; waits bounded | | bounded | Safe |
| Protective stop placement at entry | part of one bracket order (`submitEntry`), no second call | n/a | n/a | Safe |
| Missing-exit check (`syncOrders` in "risk"): `listOrdersPaged` (up to 20 pages), `listPositions`, Postgres `updateOrder` | Alpaca bounded (about 10 minutes worst); Postgres none | Caught by `Worker.background` (alerts on every failure) | Alpaca bounded; Postgres unlimited | Alpaca part safe; Postgres hang not safe |
| Close-out (`closeoutPhase`): scheduled after `refreshView` and `flushDigest` | | If the pass ends with an error, `emergencyCloseoutIfNeeded` (broker clock only) covers the last 5 minutes | If the pass hangs, nothing covers it | **Not safe** (finding 1); `closeOut` sells first and posts after; `setPhase` errors after selling are retried every 20 s |
| Healthchecks ping (`heartbeat.ts`) | 10 s, caught, runs after `ticking` is cleared | cannot block | none | Safe; during a hang no pings go out, so Healthchecks alerting is the only warning |
| Price stream (`stream.ts`) | event driven, never inside the pass | | | Safe |
| Universe file (30 s) and daily bars (10 s) | background "screen" task only | | | Safe |
| System clock | no stall; the close-out also checks Alpaca's clock before selling | | | Safe |

### State and what Michael decides next

C2 remains built, committed, pushed and tested (287 tests) but **not deployed**; the prepared fixes for rounds 3 and 4 are in the code; the three round 5 findings are not fixed. Fly runs release **v4**, which has all of these weaknesses (the loss stop after the order sync, no unsaved-stop memory, no poll catch, no query time limit). Schema 002 is applied (additive). Michael will revisit the design after Tuesday's close; the three fixes above, and the retry-the-write note, are the starting list. Tuesday under v4: the old-format limits request already posted is valid; the old breakout placeholder trades; the close-out will fail as on Monday (bulk sale cancels the stops, fails; the order sync then sells each position with false "no live protective stop" alerts; the account should still end flat).

## Michael's decision after round 5 (2026-11-02, night)

Michael asked for the round 5 starting list to be built tonight: (1) a client-side database query time limit and keep-alive, plus a watchdog for a pass that runs too long; (2) the day read falls back to the last day record held in memory; (3) the loss stop checks equity even when the stop flag cannot be read; (4) the loss stop sells without waiting on the stop-flag write, the alert or the event; (5) an unsaved stop's write is retried on every loss-stop pass, and an unsaved stop survives a restart or is re-derived from equity at startup. Each with a test that fails without the fix, then one build-reviewer round (round 6) scoped to these fixes and checked against the round 5 audit table; a finding outside that scope is logged, not blocking, unless it can lose money today. Deploy outside market hours, no later than 7:30 AM Central Tuesday: this version if round 6 passes by then, otherwise the round 5 version (`ac4a576`); then confirm Tuesday's new-format limits repost in Discord with his approved values carried forward. Never print any token or key.

## Round 6 fixes (built 2026-11-02, night)

1. **Query time limit and keep-alive** (`pg-store.ts`, `poolConfig`): `query_timeout` 20 seconds on the client, TCP keep-alive on (first probe after 10 seconds). Checked in the library: `pg-pool` removes a client released with an error, so a timed-out connection is thrown away, not handed out again (the worker only uses `pool.query`, which releases with the error). **Watchdog** (`Worker.tick`, `watchdog`): a tick that finds the previous pass still running after 60 seconds pings "fail" at once (at most every 30 seconds), tells Michael once per stuck pass, runs the daily loss stop from the day record held in memory, and near the close runs the broker-only close-out. It does not start a second pass beside the stuck one and does not restart the worker.
2. **Day fallback** (`Worker.pass`): if today's record cannot be read, the pass carries on with the last copy of TODAY held in memory (kept after every read and after the limits flow, arming and the lapse step), so the loss stop, the missing-exit check and the close-out are still scheduled; a copy of another day is never used. Such a pass counts as failed for the heartbeat (fail after three) and the broker-only close-out stands by. Michael is told (at most every 10 minutes). The order gate does not use this copy: it still reads the database and refuses when it cannot. Also wrapped: the once-per-start reset of old-shape future days (a failure no longer ends the pass; commands and the limits flow wait for it, the safety work runs) and the lapse step. The loss stop is now scheduled on its own 30 second timer before the broker view refresh. The background step alert is limited to one per step every 5 minutes (round 5 note).
3. **Unreadable stop flag** (`risk.ts`, `enforceDailyLoss`): a failed read of the flag is logged and equity is checked anyway; the stop fires if the line is crossed. A process-local memory (`LossStopMemory`) records that the stop fired today, so while the flag stays unreadable later passes retry the sale instead of firing again (no repeated flattens or alerts).
4. **Sell first** (`enforceDailyLoss`): the stop-flag write, the run-log event and every Discord post are started and not waited on (each has its own error handling, and the "could not be saved" alert is limited to one per 5 minutes); the task waits only on the sale. The gate refuses entries from the moment the stop is decided because the caching store believes a stop synchronously, before its first wait, when `setControl` is called. A hung write can no longer leave the loss-stop task marked running.
5. **Unsaved stop** (`caching-store.ts`, `worker.ts`, `risk.ts`, `alpaca-trading.ts`): writes to the stop flag now reach the database one at a time in the order asked, and `retryUnsavedStop` re-saves an unsaved stop on every pass at any hour (the flag carries over to later days until `resume`); it never overwrites a later write (Michael's `resume`). **Restart:** the worker's first loss-stop check of the day also reads Alpaca's portfolio history (`/v2/account/portfolio/history`, one point a minute) and fires the stop if equity was at or past the loss line at any point after the open or after the last saved change to the stop flag, whichever is later (so a dip before Michael's own `resume` does not bring the stop back). After a start in the middle of the session the live price stream is held until that check has worked, so no entry can follow a forgotten stop. Probe on paper 2026-11-02 after the close: 391 points 9:30 to 16:00 New York, no empty values, the day's low present. **Not measured:** how soon a minute appears in that history during the session (a dip in the last minute or two before a restart might not show yet; the in-process check, every 30 seconds on current equity, is unchanged). A local file was not used: a Fly machine's root filesystem is reset on restart and a volume would be a new paid resource.

### Tests and the "fails without the fix" check

302 tests pass (287 before), type check clean, secret scan clean. New: `test/pg-timeout.test.ts` (the real `pg` library against a fake Postgres server on this machine that accepts a query and never answers: the query fails by itself after the limit, and the next query gets a fresh connection) and `test/round6.test.ts` (13 tests). Each fix was taken out and the tests run again:

| Fix taken out | Tests that fail |
| :-- | :-- |
| 1. `query_timeout` and keep-alive | both `pg-timeout` tests (the stuck query was "still waiting") |
| 1. watchdog | stuck pass near the close (no close-out); stuck pass in session (no loss stop) |
| 2. day fallback | failed day read in session (no loss stop); every database call failing (round 5 reproduction) |
| 3. equity check with an unreadable flag | every database call failing; unit test |
| 4. sale not waiting on the write | unit test (write, event and Discord hang; sale goes out, gate refuses mid-sale); worker test (hung write, loss-stop task runs again and retries the sale) |
| 5. retry on every pass | unsaved stop saved by a later pass |
| 5. ordered stop writes | retry never overwrites a later `resume` |
| 5. equity history at start | restart after an unsaved stop: no stop, an entry would follow; stream test |
| 5. stream held until the check works | stream test |

Two tests failed at first for test reasons, not code: a text filter matched two messages, and a unit test ran two sales inside one real millisecond so the sell gate (on real time) correctly refused the second; both tests were corrected (the second now gives the sell gate the test clock).

## Review round 6 (2026-11-02, night): CHANGES REQUIRED. Round 5 version deployed as release v5.

The last round Michael allowed, on `ac4a576..b764741`. Checks 2, 7, 8 and 10 clean (the new portfolio history call goes through the paper-only `read`; no secret in the diff or commit messages; only `stacks/cyrus` and this log changed; the 100 ceiling unchanged, nothing paid, nothing deleted). All five fixes confirmed working; the reviewer spot-checked 14 fix removals and every one made its tests fail. Full suite 302 pass, type check clean.

**Re-walked "Not safe" rows of the round 5 audit:** Postgres, any query: now safe (bounded at about 30 seconds: 10 to connect or wait for a pool slot, 20 for the query; keep-alive on; a failed day read uses the copy in memory; any pass over 60 seconds is covered by the watchdog). Loss stop write, alert and event before selling: now safe (before the sale it waits only on the flag read, which is bounded and checked around, and on the account read). Missing-exit check, Postgres hang: safe from a hang (each `updateOrder` fails within about 30 seconds and is caught); still from before, out of scope: a failed `updateOrder` ends that pass's `syncOrders` before its missing-exit sale. Close-out when the pass hangs: now safe (the watchdog runs the broker-only close-out after 60 seconds stuck).

**Blocking finding (new in round 6, compared with `ac4a576`):** a start-up migration that keeps failing lets the stack trade while Michael's `stop` goes unread (`Worker.pass`, the new try/catch around `resetOldShapeFutureDays`). When it throws, `migrated` stays false, which skips `commands.poll` and the limits flow, but arming, the price stream and the gate still run. The reviewer reproduced it in a scratch copy: an armed day, a restart with only `store.daysFrom` failing, Michael posts `stop`, then prices: at `b764741` the stream started and an entry was sent after the `stop`, with no reply; at `ac4a576`, 0 stream starts and 0 entries. Trigger for Tuesday: only if the migration's own queries keep failing while the rest of the database works (a guess; not measured). Suggested fix: arming and the stream also wait for `migrated`, or keep polling commands while the migration fails and ignore only old limit replies.

**Non-blocking notes (logged, not changed):** `retryUnsavedStop`'s first guard has no test (a `resume` queued but not yet written when the retry is called; without the guard the stop would be written over the resume, the safe direction). The round 5 race is narrower but still there: a successful `resume` write clears any unsaved stop, so a loss stop fired while that `resume` is being written has a gap until its own write lands, and is lost from memory if that write fails (fix: clear only the stop that write saved). While the database is down after the close-out time, `phases.closeout` cannot be saved, so the close-out repeats every 20 seconds (5 minutes after the close) with a "Close-out done" message and a `setAccountConfig` call each time (noise). The watchdog alert's "Entries are not being placed by it" is inaccurate (the price stream keeps feeding the gate, which still checks the stop). A slow but legitimate pass (a Discord 429 storm in `flushDigest`, about 150 seconds) can trip the 60 second watchdog falsely. The emergency close-out runs once a day, so if it ends not flat while the pass is still stuck nothing retries until the pass finishes. `lossRederivedDate` is set even when `enforceDailyLoss` returns early (day not armed or no start equity), skipping the history check then (narrow). An unsaved manual `stop` is retried every pass but not re-derived after a restart (only the loss stop is). While degraded or stuck, `getClock` is read every 5 seconds (about 12 of 200 requests a minute). `(err as Error).message` in catch handlers would throw on a non-Error rejection (theoretical).

### Deploy (Michael's rule: round 6 failed, so the round 5 version)

- 8:50 PM Central Monday, market closed: `fly deploy --ha=false` from a separate checkout of `ac4a576` (a git worktree in the session scratchpad, removed afterwards; no key file in it, keys reach the app only as Fly secrets). Fly **release v5**, one machine in San Jose, good state. Config and secret names unchanged since v4 (checked: C2 reads no new setting).
- The worker started ("New release 7JE19F6D (it was MHEHVYZK), so this is a deploy"), logged `future_days_reset` for 2026-11-03 and no pass errors, and at 8:51 PM Central posted in `commands` the new-format request for Tuesday: position 2000, loss stop 500, cap 1, each "[suggested from your approval on 2026-11-02]"; trades "at most 20 orders a minute, no daily total; the ceiling is 100 ... [new suggestion: no earlier approved value]" (Monday's value was a daily count of 100, which has no per-minute equivalent). Confirmed by reading the channel through Discord's API and by reading Tuesday's row (pending, nothing decided, `phases.c2` set, `carried` naming 2026-11-02 for position, loss and cap). Stop flag off.
- **Every limit starts undecided. Michael must approve again before the "Armed" message at 8:25 AM Central Tuesday, or there is no trading Tuesday.** Replies to v4's 4:10 PM request do not count.
- Side effect seen in the database: Monday's finished record changed from `approved` to `lapsed`. Its limits and decisions are kept (carry-forward read them correctly). Reason: an old-shape approved day without the per-minute limit is read back as pending (`normalizeDay`, design decision 6), and the lapse step marks a pending day after the close as lapsed. Its close-out and summary had already run, so nothing was repeated. Cosmetic for history; noted for the design revisit.

### What is left (the round 5 findings as they stand in the running v5)

Release v5 has the round 3 and round 4 fixes but none of the round 6 fixes, so all three round 5 blocking findings remain in production: no client-side query time limit or keep-alive and no watchdog (a hanging query freezes the loop; Healthchecks alerting after its grace period is the only warning); a hanging stop-flag write holds back the loss stop's sale; a failed day read in the session switches the loss stop off for the outage. Also not in v5: the unsaved-stop retry and the restart re-derivation from equity history. The round 6 code (`b764741`) is pushed, not deployed; before it can be, it needs the migration fix above and a review. Michael decides after Tuesday's close.

## Close-out (2026-11-02, about 10 PM Central)

- **Fly token rotated by Michael on 2026-11-02; the old token is revoked.** The new token in `stacks/cyrus/.env.local` works: a read-only `fly status` for `sib-tech-cyrus` shows release **v5**, one machine in San Jose, state started; Healthchecks reads `up` (last ping a few seconds old); the Fly logs since the deploy show one start and no pass errors. The token was not printed.
- **Tuesday 2026-11-03's limits are approved** (read from the database): status `approved`, position 2000 dollars, daily loss stop 500 dollars, trades 100 a minute (the ceiling), borrowing cap 1; all four decided; position, loss and cap carried from 2026-11-02; stop flag off; not-flat flag off. Arming sets the cap at Alpaca at 8:25 AM Central.
- **v5 runs Tuesday unchanged.** No code changed, nothing deployed or restarted in this close-out.
- **After Tuesday's close:** review Tuesday's session (database, Fly logs, Discord), then fix round 6's start-up finding in `b764741` (a failing start-up migration must not leave commands unread while arming and trading run) and run a fresh review round before any deploy.

## Tuesday 2026-11-03 session review (release v5, first C2 day; written during market hours, read only)

Sources, all read only: the stack's database (one read-only transaction), Alpaca paper (account, positions, open orders, every order of the day with its exit legs, account activities, the one-minute equity history; 10 requests spaced 1.5 seconds apart), Alpaca market data on the free IEX feed (trades and quotes for the held symbols, 8:52 to 8:53:45 AM Central), the three Discord channels read through the bot, and the Fly log buffer. **The Fly buffer holds only the last 100 lines** (about two minutes of a session), so nothing from 8:53 survives there; every timing below comes from the database and Alpaca's own timestamps. Times are Central.

**For Michael first: the stop flag is still ON and carries into Wednesday.** The daily loss stop sets the same stop flag as the `stop` command, and only `resume` clears it. Type `resume` in `commands` before the "Armed" message at 8:25 AM Wednesday, or Wednesday has no entries even with approved limits.

### 1. The loss stop at 8:53 and the 19.71 overshoot

**What happened, second by second** (Alpaca's minute equity history is the reference; a point stamped T is the equity at T, checked against the 8:35 point, which is still 0 although the first fill came at 8:35:09 (so a point is not the end of its minute), and the 8:54 point, which equals the final flat value):

| Time | Day loss | What |
| :-- | --: | :-- |
| 8:52:00 | 476.84 | Alpaca minute history |
| about 8:52:55 | under 500 | previous 30 second loss stop check. **Inferred**, not logged: the worker's passes run on a 5 second tick whose phase (about :04.5 and :09.5 past each 10 seconds) comes from the 5-minute stats events and the 8:53:25.159 decision; it did not fire, so Alpaca's loss was under 500 |
| 8:52:59 to 8:53:02 | | LSCC: 17 shares hit their protective stop (106.56) and filled at 106.14, 0.42 a share below the stop |
| 8:53:00 | 517.82 | Alpaca minute history: the line was crossed in a burst of about 5 seconds, about 18 dollars, mostly LSCC (stop slippage and the drop from about 106.9 to 106.14) plus small moves in the other holdings |
| 8:53:02.7 | | the last entry (FLUT, 8 shares) passed the gate on the cached view refreshed at about 8:52:59; it probably went out after Alpaca's equity had crossed the line |
| 8:53:07.0 to 8:53:24.4 | | the gate's own cached view (account read every 5 seconds) saw the loss past 500 and refused 7 entries with "daily loss stop reached". In v5 only the 30 second loss stop task sells, so nothing was sold yet |
| 8:53:25.159 | 519.71 | loss stop check: fired. Flag saved 8:53:25.169 |
| 8:53:25.46 to 25.53 | | the 20 resting exit legs of the 10 open brackets cancelled |
| 8:53:26.5 to 27.2 | | 10 market sells sent |
| 8:53:27.4 to 31.1 | | 23 fills; account flat |
| 8:53:34.4 | | `liquidation_result`: flat, sold 10, no errors; Discord message 8:53:34.5 |
| after | 535.15 | final day loss (equity 19,208.31 from 19,743.46) |

**The 19.71 overshoot at the trigger:** about 17.8 was already there at 8:53:00, arriving in a burst of about 5 seconds just after the previous check (the LSCC stop-out above). About 1.9 came from price moves in the 25 seconds the 30 second check took to come round. **Fees: none of it** (Alpaca posts the day's regulatory fees in the evening, see below). **Slippage on the exit sales is not in the 19.71**; it came after, see next.

**After the trigger: 15.44 more.** From the decision (equity 19,223.75) to flat (19,208.31) the 10 market sells (about 15,950 dollars) cost 15.44: crossing the spread on market sales plus about 6 seconds of movement; the largest pieces were KRYS, AME and HALO. **The day's realized loss is 535.15, 35.15 past the 500 limit**, plus about 3.02 of fees to post tonight.

**Confirmed:**
- **Everything sold.** 10 positions (ABNB 11, AME 7, CTRE 54, EXEL 26, FLUT 8, HALO 15, KRYS 6, MRVL 11, VG 12, XEL 25) sold 8:53:27 to 8:53:31.
- **Every protective stop cancelled or filled.** 91 stop legs: 44 filled, 47 cancelled; 91 take-profit legs: 37 filled, 54 cancelled; the open brackets' legs were cancelled before the first sale was sent; no leg filled after the stop; 0 open orders now.
- **No entry after the stop.** Last entry decided 8:53:02.7, sent to Alpaca 8:53:02.93, last buy fill 8:53:06.3; every signal from 8:53:25.17 on was refused "stop flag is set" (763 refusals to 9:23 AM, still counting).
- **The account is flat:** 0 positions, equity equals cash, 19,208.31. No symbol's position went below zero at any point in the day's fill sequence (no oversell).

### 2. Open to stop (8:30 to 8:53)

| Measure | Value |
| :-- | :-- |
| Entries sent to Alpaca | 99 (first 8:35:00, the first 5 minutes are closed by design): 91 accepted and filled, 7 refused by Alpaca (422, see item 3), 1 refused (403, insufficient buying power) |
| Other orders | each accepted entry carried 2 resting exits (182 legs); the loss stop sent 10 market sells and cancelled 20 legs. 451 fills (the paper engine fills in many small pieces) |
| Busiest minute | **12 entries** (8:35, also the most in any rolling 60 seconds) against the 100 a minute cap Michael approved |
| Why so few | capital, not speed: with borrowing cap 1 and 2,000 dollar positions about 10 positions fill the account; exposure reached 99.9 percent of equity at 8:37 and the gate refused 126 signals as "borrowing cap leaves no room". **The 100 a minute ceiling was not exercised today** |
| Governor | 0 refusals; lowest remaining Alpaca budget 194 of 200 before the stop, 177 during the sale; at most about 36 requests a minute in the 5-minute samples |
| Decision to acceptance (91 accepted) | typical (median) 170 ms, mean 181 ms, 90th percentile 299 ms, 95th 336 ms, slowest 431 ms, fastest 95 ms |
| Gate refusals (rows) | 110 first minutes, 126 cap room, 18 already holding, 13 entry still working, 6 waiting after an Alpaca refusal, 7 daily loss stop (gate view), 763 stop flag (after the stop), 2 market closed (before the open) |
| Win / loss | 91 round trips: **34 won (+112.08), 57 lost (-647.23)**. By exit: 37 take-profits +95.06, 44 protective stops -584.37, 10 sold by the loss stop -45.84. Sum -535.15, matching Alpaca's equity to the cent |
| Fees | none charged in today's equity yet. Estimate for tonight from the fee schedule: SEC fee 3.00 on 145,600 dollars of sales, CAT fee 0.02 on 4,164 shares, FINRA TAF 0 (paused to the end of 2026): **about 3.02** |

**Where the 535.15 went (an estimate; the free IEX feed has no consolidated quote, so spread and slippage cannot be separated cleanly):**

| Part | Dollars | How measured |
| :-- | --: | :-- |
| Entry fills above the price the signal saw | -274.11 | fill minus the IEX trade price the gate used, times shares (median 0.14 a share). Spread, the free feed lagging the real market, and movement in the 0.2 seconds to acceptance, together |
| Protective stops filled below their stop price | -186.50 | stop price minus fill, times shares |
| Take-profits filled above their limit | +79.46 | mostly entries that filled at or above their own take-profit, so the take-profit sold at once at the market |
| Exit sale after the loss stop decided | -15.44 | Alpaca equity at the decision minus the final flat equity |
| Fees | 0 today | about 3.02 posts tonight |
| Price moves (the remainder) | -138.56 | |

So about three quarters of the day's loss is trading cost (spread, slippage and a stale reference price), not the market moving against the positions. That is a property of the busy placeholder (tiny targets and stops set from the free IEX price), not of the plumbing it is there to test.

### 3. What did not behave as designed

1. **The loss stop sold 18 seconds after the stack knew.** The gate's 5 second view saw the line crossed at 8:53:07 and blocked entries, but only the 30 second task sells. Michael's 10 second ruling (item 5) narrows this; see the estimate there.
2. **Discord read failures since 9:45 PM Monday: one.** At 10:34:02 PM Discord answered 503 (its own server error) to the command read; the alert went out at once ("I could not read your commands ... I keep trying"), the next read worked, and nothing was missed (Michael's 9:50 and 9:51 PM messages were read before it; the command cursor advanced normally through the session). Every warning and error goes into the run log, and there are no others since the deploy: no pass errors, no loss stop check failures, no unprotected-position alarms (Monday had five false ones). Caveat: live price stream reconnect warnings go only to the Fly log, which no longer holds them.
3. **The paper account does charge regulatory fees.** Account activities show Monday's REG fee (0.56 on 27,100.09 of sales) and CAT fee (0.01), charged at about 7 PM Monday. `fees.ts` and the daily summary say paper charges none; that is wrong (it does not change any trading decision; the estimate becomes a forecast of a real charge). Today's, about 3.02, will post tonight, so Wednesday's start equity will include it.
4. **Bracket levels come from the IEX price, Alpaca checks them against its own price.** 7 entries were refused by Alpaca because the take-profit (5) or stop (2) was on the wrong side of Alpaca's current price, and 22 of 91 accepted entries filled at or above their own take-profit. Placeholder design, logged for the redesign; nothing unsafe (a refused entry is just not placed).
5. **One entry got past the gate's room check and was refused by Alpaca** for insufficient buying power (SHOP, 8:47:32): the gate's view is up to 5 seconds old. No harm (refused).
6. **After the stop, every signal writes a refusal row:** 763 in the first 30 minutes, on course for about 9,000 by the close. Noise and database load; harmless.
7. **The loss stop message went to `commands` only**, with no mention in `alerts`. By design, but worth Michael's view.
8. **The Fly log buffer keeps about 100 lines**, and the loss stop check does not record the equity it saw, so the exact time of each check can only be inferred. Logged as an observability gap.

None of these needed action during market hours: the account is flat, stopped and has no open orders.

## Round 7 changes (built 2026-11-03, during market hours; code only, nothing deployed)

Michael's asks for this session: (4) fix round 6's blocking start-up finding in `b764741`; (5) his ruling that the daily loss stop runs every 10 seconds instead of 30; (6) secret scan, full suite, then one build-reviewer round (round 7) scoped to `b764741`'s five fixes plus 4 and 5, against the round 5 audit table, a finding outside that scope logged rather than blocking unless it can lose money. Deploy only after 3:00 PM Central and only if round 7 passes.

### 4. A failing start-up check can no longer leave the stack trading with commands unread (`worker.ts`)

- **Live prices wait for the start-up check.** The stream (the only source of signals, so of entries) starts only once the once-per-start check of future days has worked (`this.migrated`). Until then commands are not read, so nothing trades. This covers the reviewer's case exactly: a restart in the middle of an already armed day, where arming is long done and only the stream was missing a condition.
- **Backstop in the trade handler:** a price that arrives while the check has not worked is ignored. (It cannot happen with the stream held, since the check never goes back to "not done"; it is there in case a later change starts the stream elsewhere.)
- **The alert now says so:** "Until it works I do not read commands, so I place no entries either; the daily loss stop and the close-out continue."
- Unchanged: the daily loss stop, the missing-exit check and the close-out keep running while the check fails. Arming is not held: it sets the cap at Alpaca but trades nothing.
- Once the check works, the same pass reads commands first, so a `stop` sent in the meantime is in force before the first price.

### 5. Daily loss stop every 10 seconds (`worker.ts`)

- `LOSS_STOP_EVERY_MS` is 10,000 (was 30,000). Passes run on a 5 second tick, so the check runs on every second tick; a 1 second allowance stops a tick that fires a few milliseconds early from stretching the gap to 15 seconds.
- **A slow pass no longer holds it back.** Before, the check was scheduled inside the pass, so a slow pass (for example a Discord rate limit storm in the digest, about 150 seconds at worst) delayed it until the 60 second watchdog. Now a tick that finds the previous pass still running starts the loss stop itself, from today's record held in memory, on the same 10 second schedule.
- **No pile-up.** One check at a time: while a check is still waiting on Alpaca, later slots are skipped, not queued, and the next check starts at the first tick after it ends. Each Alpaca request has its own time limit (10 seconds, 3 tries, about 31.5 seconds at worst), so a hung check ends by itself.
- **Not held back by the governor.** The loss stop's account read does not ask the governor (only entries and the view refresh do), so it runs even when the budget is inside the 80-request safety reserve.

**Requests (Alpaca's account, order and position calls share 200 a minute):** before the stop fires, each check is 1 account read: 6 a minute instead of 2, **+4 a minute**. After it fires, each check is the retry of the sale (positions and open orders, 2 reads, and nothing more when flat): 12 a minute instead of 4, at a time when no entries go out. Worst case in a session at the 100 a minute ceiling: 100 entries + 24 (account and positions every 5 seconds) + about 2 (settings) + at least 4 (order sync every 30 seconds) + 6 (loss stop) = **about 136 of 200**. Entries stop at 80 remaining (the reserve), and the loss stop is never held back by it. Measured in the simulated rehearsals: the 30-a-minute day made 4,249 requests with the 10 second check against 4,022 with 30 seconds (about 3 a minute more, as expected), no rate-limit refusals in either; the ceiling day's lowest remaining budget was 137 of 200 in both. Today's real session peaked at about 36 a minute in the 5-minute samples, so about 40 with the change.

**What 10 seconds would have done today (an estimate):** the line was crossed in a burst of about 5 seconds just after the 8:52:55 check (inferred), and Alpaca's own history shows a loss of 517.82 at 8:53:00. Whichever 10 second phase the worker ran on, a check would have fired at about 8:53:00 to 8:53:05 at a loss of about 518, against 519.71 at 8:53:25: **about 2 dollars of the 19.71 saved** (range about 1 to 3). With the 8:53:00 phase it would also have refused the FLUT entry at 8:53:02.7. The 15.44 of exit cost after the decision would not change. The overshoot today came from the speed of the drop (a protective stop filling 0.42 a share below its price), which no check interval prevents. Two things would: a trigger set a little below the limit, or smaller positions. Neither is built; they are for Michael's design revisit. Also for that revisit: the gate's view already reads the account every 5 seconds and saw the loss at 8:53:07, so the loss stop could be driven from it at no extra request cost. To turn this estimate into a measurement, log the equity each loss stop check saw. Not done: with the Fly buffer at 100 lines that needs the database, about 2,300 rows a day.

### Tests and the "fails without the fix" check

New file `test/round7.test.ts`, 6 tests. Full suite **308 pass** (302 before), type check clean.

| Change taken out | Tests that fail |
| :-- | :-- |
| 4. live prices wait for the start-up check (the round 6 behaviour) | the reviewer's reproduction: armed day, restart in the session, start-up query failing, `stop` posted, prices: stream started and an entry was sent |
| 4. stream condition and trade-handler backstop both | same test |
| 4. new alert wording | same test |
| 5. 10 seconds back to 30 | every 10 seconds; slow pass; governor reserve |
| 5. loss stop started from a busy tick | slow pass (fired only after the 60 second watchdog) |
| 5. loss stop gated on the governor (a deliberate wrong change) | governor reserve |
| 5. both one-at-a-time guards | hanging check (more than one account read piled up) |

A control test shows the same restart with a working start-up check starts prices and enters, so the main test does not pass for another reason. Two first-run failures were test mistakes, not code: a restarted worker was given a fresh fake Discord whose message numbers sat behind the saved cursor (in production it is the same channel), and a hung pass was awaited by the test itself.

## Review round 7 (2026-11-03, during market hours): CHANGES REQUIRED. Last round allowed, so nothing is deployed; release v5 stays.

Run on `ac4a576..15fc1bd`, from the repo and the local suite only (no calls to Fly, Alpaca, Supabase or Discord while the market was open). Checks 2, 7, 8 and 10 were clean: no new endpoint, no secret, only stack C's files, the 100 a minute ceiling unchanged, nothing paid or deleted. Full suite 308 pass, type check clean, and the log's numbers were reproduced (lowest budget 137, 4,249 requests). Under Michael's rule a blocking finding in the last round means **no deploy: v5 (`ac4a576`) keeps running**, still without the round 5 fixes.

**Confirmed working:** item 4 (the reviewer re-ran the round 6 reproduction; with the fix taken out its test fails). Item 5: the 10 second check, the busy-tick path, the one-at-a-time guard, and not being held back by the governor; a hang test saw 2 account reads in 95 seconds. Under timer jitter no gap was shorter than 9 seconds; with the 1 second allowance at 0 the gap slipped to 15 seconds. No double sale between the loss stop, the close-out and the missing-exit check (one liquidation queue, `SellGate` fresh reads, `sells.ts` unchanged). Every round 6 fix still fails its tests when taken out at `15fc1bd`. None of round 6's notes got worse; the false-watchdog note is partly better.

**Blocking finding: after the loss stop fires, if a sale keeps failing, the 10 second retry can exceed Alpaca's 200 requests a minute all afternoon** (`risk.ts` `retryLossStopSale`, driven every 10 seconds by `worker.ts` `scheduleLossStop`). My "2 reads, about 12 a minute after the stop" holds only when the account is flat or a market sell is already open. If a position is still held and its sell is refused quickly (a 403, say), nothing stays open, so every check runs a full `Liquidator.flatten` (4 rounds), and that path does not go through the governor. In the reviewer's scratch rig (a 403 on every sell, 60 seconds) that came to about 38 requests a check: **about 260 a minute at 10 seconds, against about 108 at 30**. Estimate, not measured: one check takes about 7 seconds of real time, so it still fits 6 times a minute (about 228 a minute from the retry alone). Cost: the retry starves its own sells, and the 2:55 close-out, Michael's `flatten` and the order sync, of requests (429 answers), every afternoon a sale keeps failing. The money at stake is modest (anything sellable has been sold), but item 5 asked for confirmation that the extra requests fit, and here they do not. **Fix suggested:** keep the 10 second equity check and the 2 cheap reads; after a retry flatten that ends not flat, wait at least 30 seconds before the next full flatten; correct the arithmetic in "Round 7 changes" above; add a test that counts requests a minute while a sale keeps failing.

**Correction to "Round 7 changes" above:** the "12 a minute after it fires" figure is true only while the account is flat or a market sell is already working. See the blocking finding.

**Non-blocking notes (logged, not changed):**
- **Also in production:** if the start-up check works but the command read fails (Discord down, or the cursor read failing), live prices start and trading continues with a `stop` unread. Reproduced at both `15fc1bd` and `ac4a576`. The line "the same pass reads commands first" above holds only if that read succeeds. Michael's principle ("never trade while it cannot read my commands"), read broadly, would cover this case too: a question for him.
- If Michael tightens the loss limit and the pass then stalls inside `commands.poll` before `ensureDay`, the busy-tick check uses the older, looser limit for as long as the stall lasts (at most about 30 seconds); the gate is unaffected.
- No test for the `onTrade` backstop alone, or for the new guard in `scheduleLossStop` alone (`background` already prevents a second run).
- The watchdog alert's "Entries are not being placed by it" is still untrue.
- The suite ticks on exact 5 second marks, so the 1 second allowance has no test.

## Michael's decisions after round 7 (2026-11-03, morning)

1. Approved: review round 8, scoped to the changes below plus round 7's finding.
2. The loss stop checks every 5 seconds, not 10.
3. After a failed sale, retry only the sales that failed, every 5 seconds. The loss stop and its retries share a request budget under Alpaca's limit, set and justified by the builder, leaving room for protective stops, cancels and the close-out. Back off only on a rate-limit error from Alpaca. Test with 40 open positions and repeated refusals: total requests stay under Alpaca's limit and the close-out still gets through.
4. Discord: if his commands cannot be read for 2 minutes, block new entries and alert once. Stops, the loss stop and the close-out continue. Entries resume when a read succeeds. Also in v5's gap the reviewer found.
5. Fix the code comment and daily summary wording that say the paper account charges no fees.

Each change gets a test that fails without it; secret scan, full suite, round 8; deploy only after 3:00 PM Central and only if round 8 passes.

## Michael's note at 10:31 AM (logged, not blocking round 8)

At 10:31:34 AM Michael typed `resume`. v5 cleared the flag, and its next 30 second check, at 10:31:50, found the day's loss still at 535.15 (the account flat since 8:53) and fired the loss stop again. The flag is on again: "daily loss stop reached (535.15 dollars)". Behaviour correct. Wording to fix later (not in round 8):
- a `resume` sent while the day's loss is over the limit should reply that the stop stays on until the next trading day, not "Stop cleared";
- when the account is already flat, the loss stop message should not say "sold everything".

**When the day rolls over for the loss stop** (read from the code, the same in v5 and in the round 8 code): the loss stop checks only during the session, from the open (8:30 AM Central) to the close (3:00 PM Central), on a day whose limits are approved. Outside those hours nothing checks or re-fires it. Wednesday's loss is measured from Wednesday's start equity, read at arming (8:25 AM Central). With the round 6 code, the first check after a restart also looks at Alpaca's equity history, but only from Wednesday's open, or from the last saved change to the stop flag if that is later. So **a `resume` sent any time after 3:00 PM Central today stays cleared.** To be safe from a check that started a second before the close, send it from 3:01 PM. It must arrive before Wednesday's "Armed" message at 8:25 AM, or Wednesday has no entries.

## Round 8 changes (built 2026-11-03, during market hours; code only, nothing deployed)

### 1. Loss stop every 5 seconds (`worker.ts`)
`LOSS_STOP_EVERY_MS` is 5,000, so the check runs on every 5 second tick, with the 1 second allowance (checks at least 4 seconds apart). The busy-tick path, the one-at-a-time guard and the governor exemption from round 7 are unchanged. Requests before the stop fires: 12 account reads a minute (2 in v5). Rehearsal at 30 orders a minute: 4,585 requests at 5 seconds, 4,249 at 10 and 4,022 at 30, with no rate-limit answers.

### 2. After a failed sale, retry only what failed, inside a budget (`risk.ts`, small additions in `sells.ts`)
- **The first sale is one round** of the liquidator: cancel the exits, wait for the cancels, sell each symbol. Before, it was four rounds. With every sell refused, rounds 2 to 4 sent all 40 refused sells again, each followed by a fresh 2-request read in the sell gate: about 500 requests in under a minute, measured in the simulator. The same was true of v5; it just never met a refusal.
- The first sale's message now separates **sells still filling** ("sent a sell for every position, I will say when the account is flat") from **symbols that could not be sold** (named, with an alert). A one-round sale often ends with sells accepted but not yet filled. When the account is flat, the retry posts "Daily loss stop: everything is sold, the account is flat."
- **The retry**, run by each 5 second loss stop check:
  - stands aside entirely while any liquidation runs (the close-out, `flatten`, a carried position, or the first sale);
  - goes quiet from 6 minutes before the close (the close-out at 5 minutes before sells everything);
  - reads positions (1 request) and stops there if flat;
  - otherwise reads through the sell gate (2 requests) and, for each symbol still held, sells the shares no working sell covers, through the one checked sell path, with a `cyrus-x-...-r` id.
  - Any open market sell (ours, or one placed by hand at Alpaca) counts as working: it is never cancelled. Shares held by a resting exit (an entry that filled late) have that exit cancelled first, and the sale follows on the next check.
  - Symbols take turns from where the last check stopped, so under a tight budget every symbol gets its turn.
- **Pauses only on a rate-limit answer:** 10 seconds after a 429, then 20, 40, at most 60. Any other refusal (a 403, say) is tried again on the next 5 second check.
- **The request budget (`LOSS_STOP_REQUESTS_PER_MINUTE` = 60, at most 15 per check):**
  - The loss stop's equity checks (counted, never held back), the retry's reads, sells and cancels, and the first sale's requests (charged afterwards from the governor's count of what Alpaca saw) all draw on it.
  - On top of that, the retry never spends below the governor's 80-request safety reserve, so whatever else has run, the last 80 requests stay free for protective stops, cancels, `stop`, `flatten` and the close-out.
  - Why 60: after the stop nothing enters, and the worker's other standing work is about 35 a minute (the account view every 5 seconds is 24, settings 2, the order sync and the sweep about 6 to 8). Of 200 that leaves about 105 for the close-out and safety actions, more than a 40-position close-out's first minute needs (measured here: 69 requests in its first 10 seconds).
- **The missing-exit check stands aside while the daily loss stop is in force** (`worker.ts`, `lossStopInForce`). Found while building the 40-position test, also true of v5: once the loss stop has cancelled the exits and a sale keeps failing, the order sync's missing-exit check started its own 3-round liquidation for every such position every 30 seconds, which alone swamps Alpaca's limit. The loss stop's retry is now the only re-sale. After a plain `stop` from Michael, positions keep their exits and the check stays on.

**Michael's test, simulated** (`round8.test.ts`, "40 positions and repeated refusals"): 40 positions held at Alpaca's simulated broker. The simulator enforces the measured 200-a-minute bucket and answers 429 above it, and the worker runs on its clock. Equity falls past the line at 20:40 UTC. Every sale is refused until the close-out (20:55), and every retry is refused all day. Result:
- busiest 60 seconds 172 requests (the minute of the first sale), retry minutes about 90 including the other work;
- lowest bucket 66 of 200, **0 rate-limit answers**;
- **the close-out sold everything: flat**, with no oversell.

Reverting any of these breaks that test: the round 7 retry (a whole liquidation each time), the first sale back at 4 rounds, the budget removed, the first sale not charged, or the missing-exit stand-aside removed.

### 3. Commands unreadable for 2 minutes: entries blocked (`worker.ts`, `gate.ts`)
- The worker records the time of the last read of commands that worked. The order gate asks before every entry, twice: at the start, and again just before sending, like the stop flag. If 2 minutes have passed without a read, it refuses with "my commands could not be read for 2 minutes, so no new entries" (counted per minute, not one row each).
- **One alert** when the 2 minutes pass, from every tick, including a tick that finds a pass stuck. A short note follows when a read works again, and entries resume.
- The old alert on every first failure, "I could not read your commands ... Trading checks continue", is gone; each failure is still logged and kept in the run log. So last night's single 503 would no longer post anything.
- **After a start, entries also wait for the first read that works** (the gap the round 7 reviewer found in v5). A `stop` sent while the worker was down may be waiting, and the worker cannot know for how long, so a restart counts as already past the 2 minutes for entries. The one alert still waits the 2 minutes.
- Stops at Alpaca, the daily loss stop, the missing-exit check and the close-out do not depend on reading commands.

### 4. Fee wording (`fees.ts`, `summary.ts`)
The comment now says the paper account is charged (Monday's REG 0.56 and CAT 0.01, posted that evening). The summary line reads "Estimated regulatory fees for the day (Alpaca charges them on this paper account too, posted that evening)".

### Tests and the "fails without the fix" check
New `test/round8.test.ts` (13 tests). Full suite **321 pass**, type check clean.

Existing tests changed on purpose (behaviour changed):
- the round 7 interval test is now 5 seconds;
- the Discord read failure test expects the one 2-minute alert;
- the loss stop retry test now gives the working market sell all 5 shares (a 1-share sell no longer stops the other 4 being sold) and checks the sell is not cancelled;
- the full-day test runs one pass before its prices, because it jumps 11 minutes without a pass and the gate rightly blocks after 2 minutes without a read.

Test helpers: the rig can run on the simulator's clock, and the simulator records request times and can refuse chosen sells.

| Change taken out | Tests that fail |
| :-- | :-- |
| 5 seconds back to 10 | 5 second interval |
| retry as in round 7 (a whole liquidation) | 40 positions; only failed sales; working market sell; budget; reserve; back-off; quiet before close; the retry until flat (limits-flow) |
| first sale back to 4 rounds | 40 positions |
| first sale not charged to the budget | 40 positions |
| no back-off after a 429 | back-off |
| no 60 a minute budget | budget; 40 positions |
| no 15-per-check cap | budget |
| no safety reserve check | reserve |
| gate re-reads not counted | budget |
| no turn-taking | budget (not every symbol tried) |
| no quiet period before the close | quiet before close |
| missing-exit check not standing aside | 40 positions |
| hand-placed market sells not counted as working | the retry until flat (limits-flow) |
| no flat confirmation; old "still held" message | one-round sale message |
| the gate given no command check | commands unreadable; restart with failing reads |
| no wait for the first read after a start | restart with failing reads |
| no 2-minute alert | commands unreadable; Discord read failure (c2) |
| no recovery after a read works | commands unreadable and three others |
| 2-minute check not run from a busy tick | stuck pass |
| fee summary or comment reverted | fee wording |

The gate's two command checks are duplicates by design (as with the stop flag), so removing only one changes nothing.

## Review round 8 (2026-11-03, during market hours): CHANGES REQUIRED. Last round allowed, so nothing is deployed; release v5 stays.

On `ac4a576..5d0fbb5`, from the repo and the local suite only (no vendor calls while the market was open). Checks 2, 7, 8 and 10 clean. Full suite 321 pass, type check clean.

**Confirmed working:**
- Round 7's blocking finding is fixed: the retry stays inside 60 a minute and the 80-request reserve, and Michael's 40-position test passes (0 rate-limit answers, flat close-out).
- The 5 second check.
- The 2-minute commands rule: it blocks only entries. The reviewer found no bypass: a restart, a failing cursor read, a failing start-up check and a stuck pass are all covered. The builder's extra rule (after a start, entries wait for the first read that works) matches Michael's intent and closes v5's gap.
- The fee wording.
- No path found where the retry, the close-out, `flatten` or the missing-exit check oversell. This rests on reading the code: every sell goes through the one `SellGate` queue, and the liquidator never cancels a `cyrus-x-` sell.
- The one-round first sale raises no false alarm in the normal case.
- The test helpers do not make a test pass by construction.
- 17 of the builder's 19 fix removals were spot-checked: each fails its test.

**Blocking finding (check 6, protection at the broker), in the stand-aside I added outside the literal scope:**
- **The fault:** after a loss stop and then a `resume`, the missing-exit check stays off for the rest of the day. `worker.ts` `lossStopInForce` returns true whenever this process's `lossMemory.firedDate` is today, and nothing clears it on `resume`. The retry does not cover the gap either, because it runs only while the stop flag is on.
- **Reproduced:** the loss stop fires; AAA's sale is refused and its exits are already cancelled; equity recovers; Michael sends `resume`. At `5d0fbb5` AAA sits with no protective order until the 2:55 close-out, with no alert. At `ac4a576` (v5) and `15fc1bd` the missing-exit check sells it within about a minute.
- **Money at risk:** stays inside the approved loss limit, because the loss stop still checks every 5 seconds. But a position without a stop for hours is a regression from production, outside what Michael approved.
- **Suggested fix:** use `firedDate` only when the stop flag cannot be read, otherwise require the flag on with a "daily loss stop" reason (or clear `firedDate` when a `resume` is saved). Evaluate it inside the `protect` closure before each sale, not once per sync. Add a test: loss stop, refused sale, recovery, `resume`, then the bare position is sold by the missing-exit check.

**Non-blocking notes (logged, not changed):**
- `lossStopped` is read once per sync, so a sync already running when the stop fires can still start one 3-round liquidation per position (bounded; the fix above covers it).
- **The documented 429 back-off never fires for sells in production.** The real client retries a sell's 429 internally (a probe: 9 POSTs and 3 GETs, then status 502), so the retry never sees `httpStatus` 429. One refused sell can cost up to about 13 requests against the 1 or 3 charged, and holds the shared sell queue for about 14 seconds. What really stops the retry is the governor: a 429 empties its budget, so the reserve check fails for about 25 seconds. The fake brokers throw a bare 429, so the back-off test covers a path production does not take.
- **Test gaps:**
  - Removing the `isLiquidating()` guard in `retryLossStopSale` fails no test.
  - The gate's second command check has no test of its own.
  - The budget and per-check tests compare against the imported constants.
- The first-sale charge can be under-counted when older requests leave the 60 second window during the sale. The reserve still governs.
- "Sent a sell for every position" can appear when only part of a symbol's shares were free.
- Round 6 and round 7 notes are otherwise unchanged. The watchdog wording is now true from 2 minutes after the last read.

**Re-walked audit table at `5d0fbb5`:**
- Safe: every row of the round 5 audit; the new retry (on requests); the new 2-minute rule; the first sale.
- **Not safe:** `lossStopInForce`, and the missing-exit check after a loss stop then `resume` (the blocking finding).

**State:** v5 (`ac4a576`) keeps running, still without the round 5, 6, 7 or 8 fixes. The round 8 code is pushed at `5d0fbb5`, not deployed. A round 9 would need Michael's approval: the fix above is small. Alternatively, drop the stand-aside, which would leave the 40-position test exposed to the missing-exit check's own load.

## Michael's decision after round 8 (2026-11-03, late morning)

Approved: review round 9, scoped only to round 8's blocking finding. Tie the pause on the unprotected-position check to the stop flag itself, so `resume` ends it. One test for exactly that sequence (loss stop fires, a sale fails, `resume`, the unprotected position is sold with an alert), failing without the fix. No other changes. **New standing rule, added to CLAUDE.md:** no change to money-touching code beyond what Michael asked unless the builder asks him first. Deploy only after 3:00 PM Central and only if round 9 passes; if it fails, deploy nothing, leave v5 running, log the findings and stop.

## Round 9 change (built 2026-11-03, during market hours; code only, nothing deployed)

- **The fix (`worker.ts`, `lossStopInForce`, the only code change):** the stop flag decides. The missing-exit check stands aside only while the flag is on with a "daily loss stop" reason, so a `resume` ends the pause. This process's memory that the loss stop fired today counts only when the flag cannot be read, as in `enforceDailyLoss`.
- **Not changed, on purpose (no other changes):** round 8's non-blocking note that the flag is read once per sync rather than before each sale. One sync already running when the loss stop fires can still start one liquidation per position, bounded to that sync. A change there would touch `syncOrders` (money-touching code) and needs Michael's approval first.
- **Test:** `test/round9.test.ts`, 1 test, the exact sequence:
  1. 20 AAA held with its stop at Alpaca.
  2. The loss stop fires; its sale cancels AAA's exits and Alpaca refuses the sell.
  3. Equity recovers and sells are accepted again.
  4. Michael sends `resume`.
  5. Within the next missing-exit check AAA is sold, with the alert "AAA had no live protective stop, so I sold it."
  - **With the fix taken out (the round 8 code), it fails:** AAA is still held.
- Full suite **322 pass**, type check clean. The 40-position rehearsal is unchanged: busiest minute 172, 0 rate-limit answers, flat.

## Review round 9 (2026-11-03, during market hours): PASS. Cleared to deploy after 3:00 PM Central.

On `a7a8639..5c31aa3`, from the repo and the local suite only. No blocking findings. Checks 2, 7 and 10 clean. Full suite 322 pass, type check clean. The diff is limited to what Michael asked (the only code change is `lossStopInForce`), so it respects the new standing rule.

**Round 8's finding is closed in every case the reviewer checked:**

| Case | Result | How checked |
| :-- | :-- | :-- |
| `resume` saved | The flag is off, so the missing-exit check sells the bare position with its alert | The round 9 test |
| Unsaved stop held only in the caching store | Counts as in force: in 90 seconds the missing-exit check made 0 sales while the retry kept going; after `resume`, AAA was sold with the alert | Scratch test |
| Flag unreadable | Falls back to the in-process memory, the same condition under which the retry sells, so there is no gap | Read, not run |
| Michael's plain `stop` | The missing-exit check stays on | Read |
| Restart after a loss stop | The saved flag decides, and the `rederive` path finds an unsaved stop again | Read |
| Re-fire after `resume` (as at 10:31 today) | The stand-aside comes back, the missing-exit check makes 0 sales, the budgeted retry continues | Scratch test |

- **Round 8's request-storm problem is not reopened:** the 40-position test still passes (busiest minute 172 requests, 0 rate-limit answers). With `lossStopInForce` forced to false it fails (398 requests a minute, 1,187 rate-limit answers), so the stand-aside is still needed and still guarded.
- **The round 9 test fails on the round 8 code** ("AAA, left without a protective stop, is sold": 1 !== 0).

**Non-blocking notes:**
- The flag is still read once per sync (unchanged from round 8). The reviewer agreed that leaving it alone was right under the new standing rule: a change would touch `syncOrders`.
- **For Michael:** a plain `stop` sent after a loss stop overwrites the loss stop's reason. From then on the retry stops and the missing-exit check takes over, with one liquidation per position. With many positions whose sells keep failing, that brings back roughly v5's request load. The same happens on a `resume` while sells are still refused, which is the behaviour Michael asked for. Not a regression: it is how v5 behaves today.
- The round 9 test raises equity above the line before `resume`; otherwise the stop fires again, as happened in production at 10:31.

## Next steps for after Wednesday 2026-11-04's session (Michael, 2026-11-03); no code changes for these today

1. **Faster order check.** Run the order sync (the missing-exit check and the record update) more often than every 30 seconds, fitted inside the request budget. Propose an interval with its request math before coding.
2. **The round 9 reviewer's note.** A plain `stop` after the loss stop, or `resume` while sales are refused, brings back v5's request load (the missing-exit check, one liquidation per position). Propose a fix.
3. **Wording from 10:31 AM.** A `resume` while over the loss limit should say the stop stays on until the next trading day. "Sold everything" should not appear when the account was already flat.

Under the standing rule, each is proposed to Michael before any money-touching code changes.
4. **A load day on Alpaca paper (a proposal for Michael first, no code until he approves).** Reach 100 entries a minute for about 15 minutes. The proposal must cover:
   - **Churn:** hold times, and which of the 30 live symbols.
   - **Position size:** small enough that spread and fees cannot trip the loss stop.
   - **Measurements:** requests a minute from the 5-minute `governor_stats` events, the lowest remaining stock, any rate-limit errors, decision-to-acceptance times, fees, and the close-out.
   - **Expected cost** in dollars.
   - **The result that would show the 200-a-minute budget does not hold.**

   Starting estimates (to be worked through in the proposal):
   - One position per symbol at a time means an average hold under about 18 seconds across 30 symbols.
   - Tuesday's trading cost was about 0.27 percent of round-trip value, so about 1,500 entries needs positions of about 75 dollars or less to keep it near 300 dollars.
   - SEC fee about 2.30 dollars.

### Load day: whole shares (added 2026-11-03, for the proposal; no code)

**Can our entry order use fractional shares?** Apparently not. Our entry is a bracket order: the entry with its stop and take-profit resting at Alpaca.
- Alpaca's fractional trading page: "Alpaca currently supports fractional trading for market, limit, stop & stop limit orders with a time in force=Day". It does not mention bracket, OCO (one cancels other) or OTO (one triggers other) orders.
- Alpaca's orders page lists fractional support only for those four simple order types, day orders only, and says nothing about bracket orders.
- Alpaca forum, "Bracket Order with Fractional Shares" (March 2023, again July 2024): "fractional shares are only executing through simple orders". No staff answer.
- Related threads: "When will bracket orders for fractional stocks be implemented?" (April 2021), and "Frustration with Fractional/Notional Order Limitations & OCO/Bracket Orders" (last activity August 2026), consistent with no support.
- **Not confirmed by a test order.** One fractional bracket order on paper would settle it, on a day Michael approves (no orders today).

Sources, read 2026-11-03:
- https://docs.alpaca.markets/docs/fractional-trading
- https://docs.alpaca.markets/docs/orders-at-alpaca
- https://forum.alpaca.markets/t/bracket-order-with-fractional-shares/12027
- https://forum.alpaca.markets/t/when-will-bracket-orders-for-fractional-stocks-be-implemented/5375

So with whole shares, a 75 dollar position limits the stack to symbols under 75 dollars, and buys 1 share of a 60 dollar stock.

**What Tuesday says about cost by price** (91 round trips; entry fill above the signal price, plus stop fills below the stop price, minus take-profits filled above their limit, as a share of the round trip's value):

| | Round trips | Cost |
| :-- | --: | --: |
| Symbols under 75 dollars (VG, UPST, CTRE, TAP, EXEL) | 18 | 0.21 percent |
| 75 dollars and over | 73 | 0.27 percent |

Individual symbols ranged from 0.04 percent (SHOP, MRVL) to 1.0 percent (AXSM). These are small samples, so treat them as a rough guide, not a rate.

**Option A, recommended: a live list of 30 symbols priced well under 75 dollars** (for example 5 to 35 dollars, highest volume, tightest spread, chosen by the morning screen). Positions at most 75 dollars, so 2 to 15 shares and about 60 dollars a position on average.
- Expected cost of about 1,500 entries: 1,500 × 60 × 0.20 to 0.40 percent = **about 180 to 360 dollars, central about 225**, plus about 2 dollars of fees (SEC fee on about 90,000 dollars of sales; FINRA TAF paused; CAT a few cents). That stays under the 500 dollar loss stop with today's limits unchanged.
- Risks:
  - A 1 cent price step is a larger share of a cheap price (0.1 percent each way on a 10 dollar stock).
  - The free IEX feed sees less of thinly traded names, so stale prices and Alpaca refusals of the bracket (as on Tuesday) could rise.
  - It needs a screen change (code, after approval).

**Option B: a larger position size, any symbol on the usual list.** For example, 300 dollars buys 1 share of anything up to 300 dollars, about 200 dollars a position on average.
- Expected cost of about 1,500 entries: 1,500 × 200 × 0.27 percent = **about 810 dollars**. That would trip the 500 dollar loss stop after about 9 minutes.
- To fit, either Michael approves a higher loss stop for that one day in the evening limits flow (for example 1,500 dollars; only he can set it), or the run is cut to about 600 entries (6 minutes at 100 a minute, about 325 dollars).
- Up to 30 positions of about 300 dollars is about 9,000 dollars of exposure, inside borrowing cap 1 on about 19,200 dollars of equity.

**Not proposed:** fractional entries with a separate stop placed after the fill. Each entry would be unprotected until its stop is placed, a change to how protection works (money-touching, and against "every entry carries a protective order at Alpaca").

All of these are paper dollars, and estimates from one day's 91 trips. The load day itself is the measurement.

**Michael's choice (2026-11-03): option A.** A live list of 30 symbols priced well under 75 dollars, positions at most 75 dollars, today's 500 dollar loss stop unchanged. Expected cost about 180 to 360 dollars, central about 225, plus about 2 dollars of fees (paper). The detailed proposal (how the placeholder churns and its hold times, the screen change that picks the cheap list, what is measured, and the result that would show the 200-a-minute budget does not hold) goes to Michael after Wednesday's session, before any code.

## Load mode proposal (2026-11-03, for Michael's approval; no code until he approves)

Michael's change of plan: Wednesday 2026-11-04 is the load day, built as a **load mode** that is off by default and switched on by a command he approves with the evening limits. Normal days stay unchanged. Option A: a cheap-symbol screen only in load mode, a small position size, the 500 dollar loss stop unchanged, every entry keeps its bracket stop. Round 9 deploys after 3:00 PM on its own. If load mode passes review, it deploys as a separate release no later than 7:30 AM Wednesday.

**What limits throughput today (read from the code):** the gate allows one position per symbol at a time. After a symbol's exit fills, its entry row stays "working" until the order sync marks it closed, and that sync runs every 30 seconds. With 30 symbols that caps entries at about 30 × 2 = 60 a minute at best, before hold times. Reaching 100 a minute needs each symbol to cycle (entry, exit, noticed) in about 18 seconds or less.

### 1. The switch
- **New command `load on` / `load off`**, for the next trading day's record. It is shown as a fifth line in the evening request and in the morning review: "mode: normal" or "mode: LOAD DAY (8:45 to 9:00 AM)".
- **Default normal every day; never carried forward.** It is decided with the other limits (`approve` covers it).
- **Up to "Armed" either way; after "Armed" only `load off`** (the tighter direction).
- The "Armed" message and `status` state the mode.
- **When the load release starts tonight**, Wednesday's request will already have been posted (at about 3:10 PM). The release posts a one-time note in `commands` showing Wednesday's mode as "normal (type `load on` to make it a load day)". That note is the "limits post shows the switch" confirmation.
- Stored in the day record's existing `limits` JSON (no schema change). Normal days read it as off.

### 2. The screen (load mode only)
Same universe (no ETFs, no test issues).
- Price from 5 to 35 dollars: well under 75, so at least 2 shares, and 1 cent stays at most 0.2 percent of the price.
- Average daily dollar volume of at least 25 million.
- **Ranked by average daily share volume** (most shares traded means the most prints on the free feed), instead of today's unusual-volume rank.
- **30 names**, the free feed's cap; normal days use 20.
- Runs at the usual morning screen time.

### 3. Churn and hold times (load mode only)
- **Entries only from 8:45 to 9:00 AM Central** (15 to 30 minutes after the open, after the opening rush). No new entries after 9:00. Positions left close through their own brackets, or at the 2:55 close-out.
- **Brackets: take-profit 3 cents above, stop 4 cents below the signal price.** Normal days use 0.25 and 0.4 percent. This is a short hold on purpose: on a 5 to 35 dollar stock 3 to 4 cents usually comes within seconds to a minute. Every entry still carries both exits at Alpaca in the same order.
- **Strategy cooldown 5 seconds per symbol** (15 on normal days). The signal rule is unchanged otherwise.
- **The order sync runs every 10 seconds in load mode** (30 on normal days), so a closed entry frees its symbol within about 10 seconds. This touches the missing-exit check's timing, which is why it is named here. It is the "faster order check" from Next Steps, limited to load mode.
- Expected per symbol: fill about 1 second, hold H, noticed within 5 to 10 seconds. 100 a minute needs H at most about 10 seconds on average across 30 names. **A guess:** it depends on how often the free feed prints these names and how fast they move 3 to 4 cents. If holds run longer, the day tops out below 100, and that is measured, not hidden.

### 4. Position size and why
- **At most 75 dollars an entry, enforced in code in load mode** (the lower of the approved position limit and 75), so a forgotten position limit cannot make a load day expensive.
- With whole shares from 5 to 35 dollars, the average position is about 64 dollars.
- Why 75: Tuesday's trading cost (spread, slippage and the stale free price) was 0.21 percent of round-trip value for names under 75 dollars, and 0.27 percent overall. At 0.2 to 0.4 percent, 1,500 entries of about 64 dollars (about 96,000 dollars bought) cost 190 to 385 dollars. That stays under the unchanged 500 dollar loss stop.
- 30 open positions of about 64 dollars is about 1,900 dollars of exposure, far inside borrowing cap 1.

### 5. Expected cost (paper dollars)
- Trading cost about 190 to 385 dollars (central about 240).
- Fees about 2 dollars: SEC fee on about 96,000 dollars of sales about 1.98, CAT a few cents, FINRA TAF paused.
- Price drift on about 1,900 dollars over 15 minutes: plus or minus tens of dollars.
- **Worst case is bounded by the 500 dollar loss stop**, plus an overshoot like Tuesday's (about 20 to 35 dollars).

### 6. Requests a minute at 100 entries (load mode)
- Entries: 100 (one request each, bracket included).
- Account and positions every 5 seconds: 24.
- Settings: 2.
- Order sync every 10 seconds: about 12 (2 a run; more if a page passes 500 orders).
- Loss stop checks: 12.
- **Total about 150 of 200.** The governor still holds entries at the 80-request reserve, and sells and cancels can still use the reserve.

### 7. What is measured (written to the log Wednesday after the close)
- **Entries a minute**, from the orders table, for each minute of the window.
- **Requests a minute and the lowest remaining stock**, from the governor's stats. Proposed: during the window these are written **every minute** instead of every 5 minutes (logging only), and the governor counts Alpaca rate-limit answers (logging only).
- Governor refusals ("holding back for safety"), and refusals by reason, to show what limited throughput: one per symbol, the governor, or an Alpaca refusal of the bracket.
- **Decision to acceptance:** typical, 95th percentile and slowest, against Tuesday's 170, 336 and 431 ms.
- **Fees:** the estimate, and Alpaca's posted REG and CAT activity that evening.
- **Hold times** (entry fill to exit fill) and win/loss split, with the same cost split as Tuesday.
- **The close-out:** flat at 2:55, no oversell, no false "no protective stop" alarms.

### 8. Pass, fail, inconclusive
**Amended by Michael on 2026-11-05 (evening):** "entries a minute" below means **accepted orders a minute**. See "Michael's ruling on the load-day pass rule" at the end of this log, which states the rule as it now stands.
- **The 200-a-minute budget does NOT hold if:** Alpaca answers "too many requests" (429) even once; or the remaining stock falls below 80 because of entries and routine work (the governor's reserve was breached, not just reached); or any sell, cancel or close-out request is delayed by a rate limit.
- **It holds if:** at least about 90 entries a minute for at least 10 of the 15 minutes, 0 rate-limit answers, lowest stock at or above 80, and a flat close-out.
- **Inconclusive if** entries never get near 90 a minute (limited by the symbols, the free feed or hold times). Then the log reports the highest rate reached and its request count, and says the 100 level was not tested.

### Code changes this needs (money-touching, all only in load mode; none on normal days)
1. The `load` command, the mode in the day record, and the request, morning, Armed, status and one-time note wording.
2. The load-mode screen.
3. The load-mode strategy constants (cooldown, 3 and 4 cent brackets).
4. The load-mode entry cap (75 dollars) and entry window (8:45 to 9:00) in the gate.
5. The load-mode sync interval (10 seconds).
6. Logging only: per-minute governor stats during the window and a 429 counter.

Each gets a test that fails without it, plus a test that a normal day is unchanged. Then the secret scan, the full suite and one build-reviewer round. Nothing else changes.

## Michael's approval of load mode (2026-11-03, afternoon)

Approved as proposed, with three decisions:
1. **10 second order check:** approved, load days only for now. Normal days stay at 30 seconds; the normal-day change stays in Next Steps.
2. **Statistics every minute during the window:** approved.
3. **After 9:00 AM on a load day:** the normal placeholder for the rest of the day, keeping the 75 dollar cap in code all day, so the 2:55 close-out runs with positions held. The summary reports the window (8:45 to 9:00) and the rest of the day separately.

Build with a test that fails without each change and a test that a normal day is unchanged; secret scan, full suite, one build-reviewer round. Round 9 deploys on its own after 3:00 PM. Load mode deploys as a separate release only if it passes, before 7:30 AM Wednesday.

## Load mode (built 2026-11-03, afternoon; code only, not deployed)

**New file `src/load-mode.ts`** holds every rule and number in one place.
- **The switch** is stored in the day record's phases (`load`: `on`, `ended` or absent). This is not a fifth limit, so the four limits' decisions, carry-forward and only-tighten-after-Armed rules are untouched. A normal day is a day without the marker.
- `isLoadDay`, `loadWindow` (15 to 30 minutes after the open), `inLoadWindow`, `beforeLoadWindow` and `loadLine` (line 5 of the limits text).
- The constants: 75 dollars, 5 second cooldown, exits 3 cents up and 4 cents down, sync 10 seconds, statistics 60 seconds.
- The load screen: 5 to 35 dollars, at least 25 million dollars a day, ranked by shares, 30 names.

**Changes, all only on a load day:**
1. **Switch** (`morning.ts` `parseCommand`, `decideLoad`; `commands.ts`):
   - `load on` / `load off`, for the next trading day before "Armed", or the running day after it.
   - Refused if older than the day's request. `load on` closes at the morning screen (45 minutes before the open), because the cheap list is built there.
   - After "Armed" only `load off`, which sets `ended`: the window stops, the 75 dollar cap and the 10 second sync stay (only the tighter direction is allowed after Armed).
   - Never carried forward: each day's record starts without it. `approve` still covers the four limits.
   - Line 5 appears in the evening request, the morning review, the reminder and every limits reply. The Armed message and `status` state the mode, and `help` lists the command.
   - `postLimitsRequest` marks the request as already showing the mode. The worker posts a **one-time note** for a day whose request was posted by an older release: Wednesday's, after tonight's deploy.
2. **Screen** (`screen.ts` `rankBy: "shares"`; `main.ts` `buildLiveList({ load })`; the worker passes `load` on a load day). A normal day's screen is unchanged (`rankBy` unset).
3. **Strategy** (`strategy.ts`): while the window is on, a 5 second cooldown and exits 3 cents up and 4 cents down. Outside it, and on normal days, unchanged. The worker reads the window from the latest copy of the day, so `load off` takes effect at once.
4. **Gate** (`gate.ts`):
   - Before the window on a day still switched on: refused "load day: entries start at 8:45:00 AM Central", counted per minute rather than one row each.
   - All load day (`on` or `ended`): the position limit used is the lower of the approved one and 75 dollars.
   - Every entry still goes out as a bracket with its take-profit and stop at Alpaca.
5. **Order sync** (`worker.ts`): every 10 seconds all load day (30 on normal days). I read "load days only" as the whole load day, so held positions keep the faster missing-exit check until the close.
6. **Logging only:** `governor_stats` written every minute from a minute before the window to a minute after (otherwise every 5 minutes). The governor counts Alpaca's rate-limit answers (`rateLimitAnswers`, the clock's own bucket excluded), shown in the summary.
7. **Summary** (`summary.ts` `partLines`): on a load day, a "Load day" part with the window and the rest of the day apart. Each shows entries sent, busiest minute, how entries closed (take-profit, stop, later), the profit on those closed by their own exits, and speed.

**Found while testing:** the mode line, repeated in each reply to a several-line message, pushed the combined reply past Discord's 2,000-character limit and split it in two. The lines were shortened ("5. mode: normal (`load on` makes it a load day)").

**Tests:** `test/load-mode.test.ts`, 12 tests, including "a normal day is unchanged" (an entry before 8:45, the approved size, the normal exits, the normal screen, sync every 30 seconds, statistics every 5 minutes). Full suite **334 pass**, type check clean; the round 8 and round 9 rehearsals are unchanged. Test helper: the rig records which screen the worker asked for.

| Change taken out | Tests that fail |
| :-- | :-- |
| `load` not understood | 6 tests (switch, screen, gate, sync, statistics, refusals) |
| `load on` accepted after the screen time | switch refusals |
| `load on` accepted after Armed | switch refusals |
| no line 5 | switch; evening request |
| Armed message silent | switch |
| no one-time note | one-time note |
| worker asks for the normal screen | screen |
| screen ranks by the old ratio | screen |
| no entry window | gate |
| no 75 dollar cap | gate |
| strategy not given the window | gate |
| strategy churn off | gate; strategy |
| sync every 30 seconds on a load day | sync |
| statistics every 5 minutes around the window | statistics |
| no rate-limit counter | counter |
| no summary split | summary |

## Load mode review (2026-11-03, afternoon): CHANGES REQUIRED. The only round allowed, so load mode is not deployed; Wednesday runs normally on round 9.

On `a6adf91..312d9dc`, repo and local suite only. Checks 2, 7 and 10 clean. 334 pass, type check clean. The reviewer spot-checked 17 one-line removals, and every row of the builder's table it checked fails as claimed.

**The trading code passed every money check:**
- A normal day's gate, strategy, screen, 30 second sync, 5 minute statistics and summary are unchanged.
- The 75 dollar cap only lowers `maxPositionUsd` inside `OrderGate.run`.
- Every entry is still a bracket.
- The 8:45 check sits after the stop flag, arming and the 2-minute commands rule.
- The loss stop, the governor reserve, `admitTrade` and the 100 ceiling are untouched.
- `load on` can never land after Armed or carry forward.
- The 10 second sync cannot overlap itself.
- All four of the builder's interpretations fit Michael's intent (with the caveats in notes 2 and 3 below).

**Blocking finding: on a normal day, the limits messages can now pass Discord's 2,000-character limit, and then "Paper trading only." and "If any limit is still undecided at the open, I will not trade that day." are cut off.**
- Line 5 plus the new `load on ...` instruction line add about 240 characters to the evening request, the morning review and the reminder, every day.
- Measured through `finalizeMessage`:
  - the base never passes 1,980 characters in the cases tried;
  - the new code on a normal day, with the stop flag on for the loss stop and 10 symbols held: 2,046 characters, both lines lost;
  - with the "found after a restart" reason and 3 symbols held: 2,055 characters, the paper-only line lost.
- `finalizeMessage` decides on the footer before cutting, so a message that already contains the footer loses it to the cut.
- CLAUDE.md requires the paper-only and research-input line on everything the stack writes, and Michael asked that normal days stay unchanged.
- **Suggested fix, one line, either:** drop the new `load on ...` instruction line from `formatLimitsRequest` (`help` and line 5 already cover it); or make `finalizeMessage` re-append the footer after cutting (`discord.ts`, not money-touching). Plus a test that a normal-day request with the stop flag on and about 10 symbols held still ends with both lines.

**Non-blocking notes (logged, not changed):**
1. A busy load day's summary is about 1,950 to 2,000 characters. With the loss stop fired it is cut, and the last line (stop flag, flat or NOT FLAT) is lost. Not-flat has its own alerts that mention Michael.
2. `load off` after the screen but before Armed gives a normal day with normal position sizes on the cheap 30-name list (allowed under "either way until Armed"). Option: treat it as `ended`, so the cap stays.
3. `load off` after Armed but before 8:45 lets entries start at 8:35, using the normal placeholder with the cap.
4. **Test gaps** (the code is correct):
   - removing the old-message refusal in `decideLoad` fails no test;
   - making `ended` drop the cap fails no test, because the switch test only checks the phase value.
5. If one entry stays open from early in the window, `syncOrders` reads 3 to 5 pages a run, so about 165 to 170 requests a minute in total. That is still under 200, and the reserve still protects selling.
6. Likely, not measured: Alpaca probably checks the bracket against its own current price, which can differ from a stale IEX print. If so, 3 cent take-profits may often be rejected, and each rejection starts the gate's 60 second wait on that symbol. That limits speed, not safety.
7. Shares are sized from the signal price and entries are market orders, so a fill can land a few cents a share above 75 dollars.
8. "`load on` makes it a load day" still shows in `status` and in the reminder after the screen time, when `load on` would be refused.

**State:** load mode is committed on `main` (`312d9dc`), **not deployed and not reviewed as passing**. Round 9 deploys tonight from `a6adf91`, whose code is identical to `5c31aa3`, so the load mode code is not shipped. Until Michael decides, any later deploy must be made from round 9's code, not from `main`. A fix and another review round need Michael's approval.

## Michael's decision after the load mode review (2026-11-03, afternoon)

Approved: one more review round, scoped to the message-length fix and a cap change, no other changes.
1. A post that would pass 2,000 characters is sent as consecutive messages instead of being trimmed, so nothing is lost; the last message ends with "Paper trading only." and any no-trade warning. Drop the redundant `load on` instruction line. Test: a long normal-day post (stop flag on, 10 positions held) arrives complete with both lines.
2. If load mode was on that morning, the 75 dollar cap stays enforced all day, even after `load off` at any time. Test it.

If the round passes, load mode deploys as a separate release after round 9, outside market hours, no later than 7:30 AM Wednesday, with the one-time note showing Wednesday's mode. If it fails, nothing more is deployed.

## Load mode fixes (built 2026-11-03, afternoon; code only, not deployed)

1. **Long posts** (`discord.ts` `splitMessage`, used by `DiscordBot.post` and `postWebhook`):
   - A text that fits is sent exactly as before.
   - A longer one is split at line breaks (a single over-long line inside the line) into consecutive messages, each at most 2,000 characters, sent in order.
   - Every part carries "Paper trading only."; the earlier parts end with "(continued in the next message)".
   - The last part keeps the text's own ending (the no-trade warning, then the paper-only and research-input line), and gets "Paper trading only." if its own part lacks it.
   - The owner is mentioned only in the first part.
   - A failed part stops the rest and reports failure, as a failed post did before.
   - `finalizeMessage` (cut to one message) is kept but no longer used by the bot or the webhook.
   - The test fake bot splits the same way.
   - The `load on ...` instruction line is removed from `formatLimitsRequest`; line 5 and `help` cover it.
2. **The cap stays** (`morning.ts` `decideLoad`):
   - Before "Armed", a `load off` on a load day from the morning screen on (45 minutes before the open, or once the screen has run) now gives `ended`, not `off`: the window ends, and the 75 dollar cap and the 10 second sync stay all day, on the day's cheap list.
   - After "Armed" it already gave `ended`.
   - Before the morning screen, `load off` still gives a normal day (the normal list is built).
   - I read "on that morning" as "the cheap list has been built for the day". Before that, nothing load-specific has happened yet.

**Tests:** `test/load-fix.test.ts`, 9 tests, including Michael's: a normal-day request with the stop flag on (the longest reason) and 10 positions held arrives complete, ending with the warning and the paper-only line. There is also a 40-position request split into consecutive messages with every symbol arriving, and the bot and the webhook sending every part. Changed on purpose: the existing webhook test now expects a 3,000-character text as 2 messages, each redacted, not one cut message. Full suite **343 pass**, type check clean.

| Change taken out | Tests that fail |
| :-- | :-- |
| splitting (cut as before) | splitMessage; 40-position request; bot; webhook |
| bot sends only the first part | bot |
| webhook sends one cut message | webhook |
| last part's footer judged on the whole text | footer near the start |
| instruction line back | 10-position request |
| `load off` after the screen gives a normal day | cap after the screen |
| `ended` drops the cap | cap after the screen; cap after Armed |

## Load mode fixes review (2026-11-03, afternoon): PASS. Load mode is cleared to deploy after round 9, before 7:30 AM Wednesday.

On `42cd64f` (on top of `312d9dc`), repo and local suite only. No blocking findings. Checks 2, 7 and 10 clean. 343 pass, type check clean. Every row of the builder's table the reviewer checked fails as claimed.

**Confirmed:**
- **Every Discord path now splits instead of cutting:** the bot's `post` (worker `say`, command replies, start-up messages, request, review, reminder, summary, owner mentions) and `postWebhook`.
- 20,000 random texts through `splitMessage`: no part over 2,000 characters, every part with "Paper trading only.", no visible text lost.
- Parts go out in order, the owner is mentioned only in the first, redaction runs before splitting, and a failed part stops the rest.
- **No rate-limit storm:** the digest and the NOT FLAT alert are already under 1,800 characters (one part each); the safety alerts are short. Only the limits texts, the `limits` and `status` replies and the summary can reach 2 or 3 parts, none in a safety path.
- **The previous blocking finding is closed:** Michael's 10-position request is now 1,902 characters in one message, ending with the warning and the paper-only line.
- **The previous note 1 is fixed:** the summary is no longer cut.
- **Item 2:**
  - `load off` before the screen: a normal day.
  - After the screen and before Armed: `ended` (new); the cap and the 10 second sync stay.
  - After Armed: `ended`.
  - Repeated: before Armed `ended` again; after Armed refused, and the cap stays.
  - `load on` on an `ended` day: refused.
  - A normal day is unaffected.
- **The builder's reading of "that morning" is defensible.** Michael should confirm one window: a `load off` on the trading-day morning **before the 7:45 AM screen** gives a normal day with normal sizes, not the cap.

**Non-blocking notes (logged, not changed):**
1. On an `ended` day the Armed message still says "churn in the load window (no entries before it)". There is no churn, and entries start at 8:35 (normal placeholder, capped). A second `load off` after Armed is answered "not running as a load day" although the cap still applies. Message text only.
2. If part 1 of a long request posts and part 2 fails, the whole request is posted again on the next pass, so Michael sees part 1 twice. For the evening request the request time moves later, so an approval sent in between is refused as older than the request (fails safe: no trading).
3. **Test gaps** (the code is correct):
   - removing `state !== "off"` from the new branch fails no test (it stops a stray `load off` after 7:45 on a normal day from setting `ended`);
   - each half of the "screen has run, or 45 minutes before the open" condition covers the other.
4. Michael's 10-position test fits in one message. Splitting is proven by the 40-position, bot and webhook tests.
5. Older cuts remain, unchanged and outside the two items: the NOT FLAT alert at 1,800, error details, the digest's 60-line cap, and the summary's "...and N more symbols". None removes the paper-only line or the no-trade warning.
6. Splitting can drop a blank line at a part's start, and can split an over-long single line inside an emoji.

## Deploys and close-out (2026-11-03, after the close)

**Before deploying (read only, 3:15 PM Central):**
- Today's close-out ran at 2:55 PM ("Close-out done: the account is flat"), with no positions, no open orders, and equity equal to cash at 19,208.31.
- The summary posted at 3:05 PM.
- Wednesday's request posted at 3:10 PM: pending, position 2000, loss 500, trades 100, cap 1, all carried from Tuesday and waiting for Michael.
- The stop flag is still on ("daily loss stop reached (535.15 dollars)", from the 10:31 AM re-fire).

**Round 9, Fly release v6** (3:16 PM Central, market closed):
- `fly deploy --ha=false` from a separate checkout of `a6adf91`, whose code is identical to `5c31aa3`, with no key file in the checkout.
- One machine in San Jose, good state. One `worker_started` and no warnings or errors.
- Discord: "New release 8Y9T0ZQH (it was 7JE19F6D), so this is a deploy". Healthchecks up.

**Load mode, Fly release v7** (3:18 PM Central), a separate release after round 9:
- From a separate checkout of `a1a9782`, whose code is identical to `42cd64f`.
- Good state. One `worker_started` and no warnings or errors (no warn or error events in the database since 3:15 PM).
- Discord: "New release 8M2HSEXX (it was 8Y9T0ZQH), so this is a deploy". Healthchecks up.
- **The one-time note posted at 3:18 PM:** "Mode for Wednesday 2026-11-04 (new: load mode, added after that day's request was posted): 5. mode: normal (`load on` makes it a load day)". Wednesday's record now carries `loadNote`.

Both deploys were made outside market hours. Paper only.

**For Michael before Wednesday's "Armed" message (8:25 AM Central):**
1. Type `resume`: the stop flag is on.
2. To make Wednesday the load day, type `load on` before the 7:45 AM screen.
3. Approve Wednesday's limits (for the load day at least `trades 100`; `loss 500` and `cap 1` stay; the position limit does not matter, since the code holds every entry to 75 dollars).

If nothing is approved by the open, there is no trading Wednesday.

## Michael's confirmations (2026-11-03, evening)

**"That morning" for the load-day cap, confirmed by Michael:** it means from the 7:45 AM Central morning screen.
- A `load off` before 7:45 AM makes the day fully normal: the normal list, normal position sizes, sync every 30 seconds.
- From 7:45 AM on, `load off` ends the load window but keeps the 75 dollar cap (and the 10 second sync) all day.

This is what the deployed code (release v7, `morning.ts` `decideLoad`) does.

**FINRA Trading Activity Fee (TAF) pause: first-hand source found; the fee estimate stays as it is (TAF counted as 0 for sales from 2026-10-01 to 2026-12-31).**
- **Source of record:** the SEC's notice in the Federal Register, official GPO copy. "Self-Regulatory Organizations; Financial Industry Regulatory Authority, Inc.; Notice of Filing and Immediate Effectiveness of a Proposed Rule Change to Temporarily Pause Assessment of the Trading Activity Fee", Release No. 34-106409, File No. SR-FINRA-2026-021, 91 FR 60435 to 60438 (Volume 91, Number 183), published Wednesday 2026-09-23. https://www.govinfo.gov/content/pkg/FR-2026-09-23/html/2026-19392.htm (read 2026-11-03).
- **What it says:**
  - FINRA filed the change on September 15, 2026, effective on filing under Section 19(b)(3)(A)(ii) and Rule 19b-4(f)(2) ("The effective date and the implementation date will be the date of filing").
  - It sets the TAF rates in Section 1 of Schedule A to the FINRA By-Laws to $0.00 for transactions "October 1, 2026 through December 31, 2026" (all TAF rates, not only the per-share equity rate).
  - Firms still report monthly volumes.
  - TAF resumes "on January 1, 2027", invoiced from February 2027 for January's transactions.
- **Also read the same day:** FINRA's rule filing page, https://www.finra.org/rules-guidance/rule-filings/sr-finra-2026-021 (title "Proposed Rule Change to Temporarily Pause Assessment of the Trading Activity Fee", linking the Federal Register notice), and the filing's text, https://www.finra.org/sites/default/files/2026-09/SR-FINRA-2026-021.pdf. The PDF was downloaded but not read: no PDF text tool on this machine. The notice above is the source of record.
- **Consistent with what Alpaca charged:** Monday 2026-11-02's posted fees were a REG fee (0.56) and a CAT fee (0.01) only, with no TAF line, although the day had sales.
- **Code:** `fees.ts` `tafActive` already treats sales from 2026-10-01 through 2026-12-31 as paused and charges TAF again from 2027-01-01. No change needed. The comment there cites the same filing number.

**Wording fix added to Next Steps (Michael, 2026-11-03 evening; no code today):** when one message holds several limit commands, the bot repeats the full five-line limits list after every line (seen in Michael's "trades 100 / approve" reply on Monday night, and in the several-commands test). Consolidate it: one short line per command (for example "position 500: noted"), then the full list once at the end, showing what is decided and what is still waiting. This also shortens long replies, which since today go out as consecutive messages rather than being cut.

## Wednesday 2026-11-04 session review (release v7, first load day; written after the close, read only)

Sources, all read only, all on 2026-11-04 after the close:
- **The stack's database**, in one read-only transaction: the day record, every stored entry, the refusals, the events and the control values.
- **Alpaca paper:**
  - every order of the day with its exit legs (2,068 listed, plus 2 fetched by client id, see item 4.2);
  - all 8,142 fills;
  - the account, positions and open orders;
  - the one-minute equity history;
  - posted fees;
  - IEX minute bars for ADT and CIFR.
- **Discord:** the three channels, read through the bot (663 messages).
- **Healthchecks:** its record of when the check went down and up. Its log of single pings keeps only the last 100, back to 4:01 PM, so the close-out's individual pings are gone.
- **Fly:** status, releases and the 100-line log buffer. The buffer happened to cover 2:54:24 to 2:55:36 PM, which pins the close-out's start.

Times are Central. "Measured" means read from a timestamp. "Inferred" means worked out from the code and the measured times.

**State:**
- Fly runs release v7 on one machine (San Jose), started 2026-11-03 3:18 PM. No restarts since.
- The account is flat: 0 positions, 0 open orders, equity 19,070.67.
- The stop flag is off. Michael's `resume` landed Tuesday at 3:38 PM.
- The not-flat flag is off, cleared at 2:55:51 PM.
- Thursday's limits request posted at 3:10 PM and waits for Michael. Thursday is a normal day unless he types `load on` before the 7:45 AM screen.

### 1. The load window, 8:45 to 9:00 AM: INCONCLUSIVE. Highest rate 44 entries in any 60 seconds; the 100 level was not tested.

Against the approved rule ("Load mode proposal", section 8):
- **"Does not hold" needs any one of these. None happened:**
  - Alpaca's rate-limit answer (429): **0** all day.
  - Remaining stock below 80: lowest **192** in the window, **171** all day (during the close-out).
  - A sell, cancel or close-out delayed by a rate limit: **none**. The governor held nothing back all day (0). The close-out's delays came from Alpaca paper, not a rate limit (see 3).
- **"Holds" needs about 90 entries a minute for 10 of the 15 minutes.** The busiest calendar minute had 43, and no minute reached 90.
- **So the result is inconclusive.** The window reached 44 entries in its busiest 60 seconds (8:45:50 to 8:46:50), with at most 88 requests a minute and the stock never below 192. The 200-a-minute budget was never pressed.

**Entries and requests, minute by minute.**
- Entries: decisions per calendar minute, from the stored entries. Each decision is one order to Alpaca, the bracket included.
- Requests: the governor's count for the 60 seconds before each per-minute statistics stamp. The stamps drift a few seconds past each minute.

| Minute | Entries | Governor stamp | Requests in the last minute | Lowest remaining (day so far) |
| :-- | --: | :-- | --: | --: |
| (before) | | 8:44:03 | 35 | 195 |
| 8:45 | 43 | 8:45:04 | 43 | 193 |
| 8:46 | 38 | 8:46:08 | 73 | 192 |
| 8:47 | 29 | 8:47:08 | **88** | 192 |
| 8:48 | 23 | 8:48:08 | 77 | 192 |
| 8:49 | 26 (1 refused by Alpaca) | 8:49:08 | 71 | 192 |
| 8:50 | 25 | 8:50:08 | 70 | 192 |
| 8:51 | 26 | 8:51:09 | 75 | 192 |
| 8:52 | 8 | 8:52:08 | 74 | 192 |
| 8:53 | 25 | 8:53:08 | 59 | 192 |
| 8:54 | 19 | 8:54:14 | 65 | 192 |
| 8:55 | 38 | 8:55:13 | 73 | 192 |
| 8:56 | 17 | 8:56:13 | 76 | 192 |
| 8:57 | 26 | 8:57:13 | 69 | 192 |
| 8:58 | 22 | 8:58:13 | 64 | 192 |
| 8:59 | 18 | 8:59:18 | 60 | 192 |
| | | 9:00:18 | 62 | 192 |

The window had 383 entry decisions: 382 accepted by Alpaca and 1 refused. All 382 filled. The window averaged 25.5 entries a minute.

**What limited the rate (measured): each symbol cycled too slowly, not the request budget.**
- The gate allows one position per symbol, and ADT and CIFR were held from 8:45 to the close, so 28 symbols cycled.
- Per symbol, from one entry to the next: median 37.4 seconds, mean 62.4.
- That breaks down as:
  - **Hold** (entry fill to exit fill): median 18.8 seconds, mean 48.0, 90th percentile 120. 139 of 380 closed within 10 seconds.
  - **Re-entry lag** (exit fill to the next entry on that symbol): median 14.5 seconds, 90th percentile 43. That is the 10 second order sync noticing the exit, the 5 second cooldown, and waiting for the next signal.
- 28 symbols over a 62 second mean cycle gives about 27 entries a minute, which matches the 25.5 average.
- The fast names carried the window: SMCI 44, RIOT 32, IREN 32, WULF 29, APLD 24. The slow ones barely cycled: SNAP 3, F 4, PCG 4, ADT 1, CIFR 1.
- 90 or more a minute would need a mean cycle under about 19 seconds. Today's re-entry lag alone was about 15.

**Refusals in the window, by reason** (the gate counts flow refusals and writes them as rows with a count):
- already holding this symbol: 883;
- an entry for this symbol is still working (the exit filled, the sync had not yet noticed): 129;
- load day, entries start at 8:45 (signals counted in the opening second): 22;
- Alpaca refused this symbol a moment ago, wait a minute: 6;
- held back by the governor: **0**.

**Brackets Alpaca refused:** 1 in the window (RIOT, 8:49:22, "stop_loss.stop_price must be <= base_price") and 3 later in the day, all take-profits ("take_profit.limit_price must be >= base_price": SMCI 9:03, PCG 9:14, APLD 10:16). Each is the IEX price disagreeing with Alpaca's own price, as on Tuesday. 18 window entries filled at or above their own take-profit.

**Decision to acceptance, 382 accepted:**
- Median 134 ms, mean 169, 95th percentile 325, slowest 1,185 ms, fastest 94.
- Tuesday: 170, 336 and 431 ms.
- The slow tail is the opening burst: 8 entries in the first 2 seconds of 8:45 took 263 to 1,185 ms.

**Hold times and win/loss:**
- 149 closed by take-profit, 231 by stop. 2 were not closed by their own exits: ADT and CIFR, both sold at the close-out.
- 141 won and 239 lost (a take-profit that filled below the entry price counts as a loss).

**Fees:**
- Estimate for the whole day: 2.91 dollars (SEC 2.84, CAT 0.07, FINRA TAF 0 while paused). Alpaca posts the day's fees in the evening, and at 5 PM Wednesday's had not posted.
- Tuesday's posted fees were REG 3.00 and CAT 0.02, exactly the 3.02 estimated. Wednesday's start equity (19,205.29) is Tuesday's flat equity less that 3.02.

**Where the window's cost went: -37.70 dollars on 25,935 dollars bought (0.145 percent).** Each part is measured against the price the signal saw:

| Part | Dollars |
| :-- | --: |
| Take-profits at their own limit (3 cents up) | +20.40 |
| Stops at their own stop price (4 cents down) | -38.68 |
| Entry fills above the signal price (median half a cent a share) | -6.34 |
| Stops filled below their stop price | -10.32 |
| Take-profits filled above their limit | +2.80 |
| ADT and CIFR sold at the close-out (almost all CIFR, see 4.1) | -5.56 |
| **Total** | **-37.70** |

The proposal expected 190 to 385 dollars for about 1,500 window entries. The window ran 382 entries at 0.145 percent, under half of Tuesday's 0.27 percent: cheap names, 1 cent spreads, a 75 dollar cap. The largest single loss part is the bracket shape itself (3 up and 4 down, with stops hit 231 times against 149 take-profits). That is the placeholder, not the plumbing.

**What the window shows about requests per entry (an estimate, not a measurement at 100):**
- Before the window, routine work used about 35 requests a minute.
- In the busiest stamped minute, 39 entries came with 88 requests: about 1.4 requests an entry above the routine.
- At 100 entries a minute that projects to roughly 170 to 175, before the sync's paging grows during the day (see 4.3).
- That is under 200, but with little margin. The window did not test it.

### 2. The rest of the day (9:00 AM to 2:00 PM): the normal placeholder with the 75 dollar cap

- **Entries:** 1,643 decisions, 1,640 accepted and filled, 3 refused by Alpaca (the take-profits above). Busiest minute 22.
- **No new entries after 2:00 PM**, by design: 60 minutes before the close.
- **Exits:** 885 take-profits, 755 stops; 882 won, 758 lost.
- **Holds:** median 97.6 seconds, 90th percentile 635. These are the normal 0.25 and 0.4 percent exits.
- **Speed:** median 153 ms, 95th percentile 314, slowest 605.
- **Position size:** average 68.20 dollars. Largest 75.05 dollars, 5 cents over the cap: shares are sized from the signal price, as the load mode review's note 7 said.
- **Exposure:** peak 2,298 dollars (0.12 times equity).
- **Result: -96.92 dollars on 111,801 dollars bought (0.087 percent):**
  - take-profits at their limit +160.46 and stops at their stop price -205.98;
  - entry fills above the signal price -46.93;
  - stops filled below their stop price -13.16;
  - take-profits filled above their limit +8.69.
- **The loss stop was never close.** The day's lowest equity was 19,069.45 at 2:14 PM, 135.84 below the start, against a 500 dollar limit.

**The day as a whole:**
- 2,022 entries, 2,022 filled; 11,150 shares sold.
- Equity 19,205.29 to 19,070.67, **-134.62**. That equals the sum of every fill to the cent and the two parts above (-37.70 and -96.92).
- Fees of about 2.91 still to post.
- Requests: about 55 to 78 a minute all day, lowest stock 192 until the close-out, 0 rate-limit answers, 0 held back by the governor.

### 3. The 2:55 PM close-out: a false NOT FLAT, then flat 10 seconds later, then two "Close-out done" messages

**Timeline, to the second** (M = measured, with its source; I = inferred):

| Time | What | |
| :-- | :-- | :-- |
| 8:45:07.8 | CIFR entry, 10 shares at 7.269 (take-profit 7.28, stop 7.21) | M, Alpaca |
| 8:45:19.685 | CIFR take-profit fills 1 share | M, fills |
| 8:45:19.687 | **Alpaca cancels CIFR's stop**, 2 ms after that partial fill | M, Alpaca leg |
| 8:45:20.969 | CIFR take-profit fills 2 more (3 of 10). The other 7 shares are left with only the 7.28 take-profit, all day (see 4.1) | M, fills |
| 8:45:32.3 | ADT entry, 7 shares at 9.90 (take-profit 9.92, stop 9.86). ADT then traded 9.875 to 9.915 on IEX all day, so neither exit was reached | M, Alpaca and IEX bars |
| 2:55:04.404 | last price signal logged; the close-out starts and ends the price stream | M, Fly log |
| 2:55:04.9 | round 1: "cancel every order" sent | I, from the next line |
| 2:55:04.907 | ADT's stop cancelled (done at once) | M, Alpaca leg |
| 2:55:05 to 2:55:13 | ADT's and CIFR's take-profits sit in "pending cancel". Round 1 waits its 6 seconds, finds the shares still held by them, sells nothing | I, code and next lines |
| about 2:55:14 | round 2: "cancel every order" again. Alpaca answers "order pending cancel" for both take-profits (bb8bcbc3 ADT, f2d67195 CIFR) | M, the round 2 error text |
| 2:55:15.921 | ADT's take-profit cancel completes | M, Alpaca leg |
| 2:55:15.929 | CIFR's take-profit cancel completes, about 11 seconds after it was asked for | M, Alpaca leg |
| 2:55:17.535 | round 2: market sell, 7 ADT, received by Alpaca | M, Alpaca created time |
| 2:55:17.603 | round 2: market sell, 7 CIFR, received by Alpaca | M, Alpaca created time |
| 2:55:18 to 2:55:35 | rounds 3 and 4: each sees the two sells still working, waits its 6 seconds on them, sends nothing | I, code and the next line |
| 2:55:33.807 and 33.878 | Alpaca paper marks the two sells "submitted", **16 seconds after receiving them** | M, Alpaca submitted time |
| 2:55:36.522 | liquidation ends after 4 rounds: not flat, ADT and CIFR held, 2 sold | M, Fly log; database 36.533 |
| 2:55:36.677 | close-out result written: error, not flat | M, database |
| 2:55:36.830 | `alerts`: "@Michael **NOT FLAT after the close-out: ADT, CIFR.** Please check Alpaca now and close by hand. Last problem: round 2: cancel answers: ... order pending cancel" | M, Discord |
| 2:55:37.408 | `commands`: "**Michael: NOT FLAT after the close-out: ADT, CIFR.**". Then the not-flat flag is set and saved | M, Discord; I, code |
| 2:55:37.583 | **CIFR sell fills**: 7 at 6.45 | M, fills |
| 2:55:38.959, 40.975, 46.012 | **ADT sell fills**: 5, 1 and 1 at 9.90 | M, fills |
| 2:55:44 | **Healthchecks receives a failure signal and marks the check down** (its record is to the whole second; the worker does not log each heartbeat) | M, Healthchecks |
| 2:55:45.904 | `alerts`, from Healthchecks: "is DOWN. Reason: received a failure signal." | M, Discord |
| **2:55:46.012** | **the account is flat** (ADT's last fill) | M, fills |
| 2:55:48.798 | carried-position path: close-out result "flat", nothing sold. Not-flat flag cleared | M, database; I, which path |
| 2:55:49.216 | `trading`: "Close-out done: the account is flat." (first) | M, Discord |
| 2:55:51.431 | close-out retry: result "flat", nothing sold | M, database |
| 2:55:51.629 | `trading`: "Close-out done: the account is flat." (second) | M, Discord |
| 2:55:51.777 and 51.801 | not-flat flag saved off; the day's close-out step recorded as done | M, database |
| 2:55:59 | Healthchecks receives the next good heartbeat and marks the check up (good heartbeats go at most every 30 seconds) | M, Healthchecks |
| 2:56:00.209 | `alerts`, from Healthchecks: "is UP. The downtime lasted 14 seconds." | M, Discord |

Nothing else was sent. The only sells the stack sent all day were these two close-out sells (`cyrus-x-...-2`). Michael closed nothing by hand. Every other sale was a bracket exit at Alpaca.

**Why it declared NOT FLAT while the market was still open:**
- The close-out's sale routine (`sells.ts` Liquidator) has a fixed budget: 4 rounds, each a cancel, a wait of up to 6 seconds, a sell and a 1 second pause. That is about 30 seconds, then it reports what is still held.
- Two delays inside Alpaca paper used up that budget:
  - the two take-profit cancels took about 11 seconds to complete, so round 1 could not sell and round 2 sold only at 2:55:17;
  - Alpaca paper then held the two market sells 16 seconds before submitting them (2:55:17.5 to 2:55:33.8).
- Rounds 3 and 4 did nothing useful. The wait step counts the routine's **own** working sells as "still holding the shares", so each round waited its full 6 seconds on them.
- At 2:55:36.5 the budget ran out with both sells working and the market open for another 4.5 minutes. The routine does not tell "held, but my own sell for every share is working" apart from "stuck", so it reported not flat.
- **The alert's stated reason was wrong.** "Last problem: ... order pending cancel" was Alpaca saying the cancel was already under way, a symptom from round 2, not why the account still held shares.
- **Not a rate limit:** 0 rate-limit answers, 0 governor holds, stock 175 at 2:55:24. The close-out did make 133 requests in the minute to 2:55:24, mostly its own polling, to sell two positions. That is inside the budget, but a lot.

**What flattened ADT and CIFR:** the close-out's own round 2 market sells, received at 2:55:17 and filled at 2:55:37.6 (CIFR) and 2:55:46.0 (ADT). Not the take-profits (both cancelled), not a later sale, not Michael.

**Why "Close-out done" posted twice (inferred from the code and the times above):**
- Once the failed close-out set the not-flat flag during market hours, two separate paths each set out to sell:
  - **The carried-position path** (`worker.ts`, "positions carried over from a close-out that did not get flat"). It is checked first in each pass and has no waiting time on its first try.
    - It started on the first pass after the flag was set and called the same close-out routine.
    - Round 1 found ADT still held, saw only its own sell working (so it cancelled nothing), and waited until ADT's last fill at 2:55:46.
    - Its next round found the account flat. The routine then posted "Close-out done" (2:55:49) and cleared the flag. This path never records the day's close-out step as done.
  - **The close-out retry** (every 20 seconds until the close-out step is recorded). Because the step was still not recorded, it ran on the next pass, found the account flat, and posted "Close-out done" again (2:55:51). It then recorded the step (2:55:51.8).
- The emergency close-out did not run: no database or stuck-loop events, and its "closing everything from the broker's clock alone" message never posted.
- The two runs could not sell the same shares: sales run one at a time, and the second found nothing held.

**Is the Healthchecks failure signal by design? Yes. Here a false NOT FLAT triggered it.**
- The heartbeat sends "fail" on every pass while the not-flat flag is on (`worker.ts` heartbeat: "fail ... at once while the account is still holding positions after the close-out time").
- That makes Healthchecks alert at once, a second, independent alarm for positions left after the close-out. It worked as built: down at 2:55:44, up at 2:55:59.

**The NOT FLAT alert told Michael to "close by hand" while the stack's own sells were working.** A hand sale in that window could only have met Alpaca's "no shares available", or, through Alpaca's "close position", replaced the stack's sale. Harmless here, but the instruction was wrong.

### 4. What else did not behave as designed

**4.1 Alpaca cancels the protective stop as soon as the take-profit starts to fill, so the rest of the position has no stop until the take-profit finishes. Measured on paper today; not checked against Alpaca's documentation or live trading.**
- This breaks "every entry carries a protective stop at Alpaca".
- Of 1,035 brackets whose take-profit filled at all, **655** had their stop cancelled at the first partial fill, before the take-profit had filled every share.
- How long the remaining shares had no stop:

| Time without a stop | Brackets | In the window |
| :-- | --: | --: |
| under 1 second | 132 | 21 |
| 1 to 10 seconds | 472 | 71 |
| 10 to 60 seconds | 32 | 3 |
| 1 to 10 minutes | 11 | 3 |
| over 10 minutes | 8 | 1 (CIFR) |

- The remaining shares were worth at most about 70 dollars each time (the load day cap).
- Every one except CIFR ended at its take-profit, so CIFR is the only one that cost money:
  - 7 shares sat from 8:45:20 to 2:55:15 (6 hours 10 minutes) with only a 7.28 take-profit above the market;
  - CIFR fell to 6.18 and was sold at 6.45, -5.73 dollars;
  - its 7.21 stop would have fired at 8:45 (IEX low 7.16 in that minute) for about -0.41 plus slippage.
- **Why nothing caught it:** the missing-exit check (`risk.ts` `syncOrders`, `hasLiveExit`) treats any open exit leg as protection, the take-profit included. It asks "is any sell leg open?", not "is the stop live?".
- On a normal day with 500 to 2,000 dollar positions, the same gap exposes far more. Tuesday's brackets have not yet been checked for it. That is one read-only query.

**4.2 Alpaca's order listing left out 2 of the day's 2,022 entries, and the daily summary undercounted because of it.**
- CMG-7 (8:50:34, closed by its stop, -0.08) and RIVN-7 (8:50:34, closed by its take-profit, +0.22) are missing from the "all orders" listing on every page, whether paged by submitted time or by created time. Fetched by client id, both are there and filled.
- The summary reads the same listing. So it said "2,022 sent (2,020 filled)" and "-134.76 from closed trades" against the account's -134.62. The 0.14 difference is exactly those two. Its load window line, "closed by take-profit 148, by stop 230", is short by the same two (149 and 231).
- The order sync also reads the listing, and skips any stored entry it cannot find in it (`if (!o) continue`). An entry missing from the listing therefore gets no missing-exit check on that pass.
- Today the sync did see both (the database closed them at 8:50:58 and 8:51:28), so the omission seems to depend on the query.
- **Cause unknown.** It is not a paging gap: the two are absent from a page that covers their time.

**4.3 With one entry open since 8:45, every order sync read the whole day's orders.**
- The sync reads every order since the oldest entry still open. ADT and CIFR stayed open from 8:45, so by the afternoon each 10 second sync read about 5 pages (2,000 orders).
- From 2:05 to 2:50 PM there were no entries at all, yet requests ran at 64 to 74 a minute.
- This is the load mode review's note 5, now measured. It is under the budget today, but it grows with the day's order count and would cut into the headroom on a busy load day.

**4.4 Smaller items:**
- Discord answered 503 once (2:50:34 PM) to a command read. The next read worked; by design no alert (alerts start after 2 minutes).
- After 2:00 PM, each "too close to the close for a new entry" refusal is written as its own row: 2,209 rows. Other flow refusals are counted into one row a minute.
- The summary's "Alpaca requests ... lowest budget seen 171" comes from the close-out minute, not from trading.

### Proposed fixes (under the standing rule: none built until Michael approves)

Ranked. Items 1 to 4 are money-touching (the missing-exit check, the sell path, the close-out); item 5 is logging and wording only.

1. **Remaining shares with no stop after a partial take-profit (4.1).** The missing-exit check would treat "the stop leg is no longer live and shares of this entry are still held" as unprotected, even while the take-profit is open. Two ways to act:
   - **a. Recommended: sell the remaining shares** through the existing missing-exit path. It cancels the take-profit and sells only that symbol, through the sell gate, and posts "had no live protective stop, so I sold it". To avoid selling shares the take-profit fills a second later (604 of 655 finished within 10 seconds), it acts only when the same entry is seen without a stop on two syncs in a row. On a load day that is 10 to 20 seconds; on a normal day 30 to 60. Today that would have sold CIFR's 7 shares at about 8:45:40, plus a few dozen remainders.
   - b. Place a new stop for the remaining shares. Alpaca holds those shares for the open take-profit, so this means cancelling it and sending a new pair of exits. That is more requests and new order shapes to test, and the new pair would behave the same way on its next partial fill.
   - Before building, one read-only check of Tuesday's brackets (full-size positions) measures how often this happens on a normal day.
2. **No NOT FLAT while the close-out's own sells are working and the market is open (3).**
   - While every share still held is covered by a sell the close-out sent, keep waiting quietly instead of ending the round budget, and stop waiting at a deadline (for example 2 minutes before the close, about 2:58 PM).
   - NOT FLAT, the mention and the Healthchecks failure signal would come only for shares with no sell working, or at that deadline.
   - Rounds that only wait on the stack's own sells would poll gently rather than every fraction of a second.
   - The alert would give the true reason (for example "2 sells sent at 2:55:17, Alpaca has not filled them yet"), not the last cancel answer.
3. **One close-out per day (3).**
   - The carried-position path is meant for shares carried over from an earlier day. It would not run on a day whose close-out has started; that day's close-out retry already handles the rest.
   - Result: one sale routine at a time and one "Close-out done" message, with the close-out step recorded as soon as the account is flat.
4. **Check the listing against the stored entries (4.2).**
   - In the order sync, any open stored entry missing from the listing is fetched by its client id (one request each, rare), so it still gets its missing-exit check.
   - The summary does the same for any stored entry missing, so its counts match the account.
   - For 4.3: an entry open for more than a few minutes would be read by its client id instead of setting how far back the listing reads. The paging then covers only recent orders, however long one position is held. This belongs with the "faster order check" item and its request math, and would be proposed with it.
5. **Logging and wording only:**
   - log the close-out's cancel and sell request times and which path ran it (close-out, retry, carried, emergency);
   - log each heartbeat failure signal;
   - count "too close to the close" refusals into one row a minute like the others;
   - the NOT FLAT alert says "check Alpaca" without "close by hand" while the stack's own sells are working.

**On the load test itself (for Michael, no code proposed):** the window showed that the 30-name free feed, one position per symbol and today's hold times cap the busy placeholder at about 45 entries a minute. Reaching 100 needs per-symbol cycles under about 19 seconds. Tighter exits or a faster sync narrow the gap; more than one position per symbol would close it but changes the gate. Each of these is a money-touching design choice for Michael. The budget question (do 200 requests a minute hold at 100 entries) is still open.

Paper only. Everything here is research input for a human decision, never an instruction to act.

## Michael's decisions after the Wednesday review (2026-11-04, evening)

- **A. Approved: fixes 1 to 5 as release A.** Before fix 1: check Alpaca's documentation first hand, run the read-only check of Tuesday's full-size trades, and make fix 1 work even while a partly filled take-profit still holds the remaining shares (cancel it first if needed), with the gap as short as possible. Each fix gets a test that fails without it; then the secret scan, the full suite and one build-reviewer round.
- **B. Thursday is a load day again, aiming for 100 entries a minute.** Release B is for load days only; normal days stay unchanged. It is proposed first, and built only after Michael approves.
- **Deploys:** outside market hours, no later than 7:30 AM Central Thursday. A and B are separate releases, each deployed only if its own review passes.

## Release A (built 2026-11-04, evening; code only, not deployed)

### Checks before fix 1

**Alpaca's documentation says the stop is resized, not cancelled. Paper did the opposite.**
- "Orders at Alpaca", section "Bracket Orders", https://docs.alpaca.markets/docs/orders-at-alpaca (read 2026-11-04):
  - "If the take-profit order is partially filled, the stop-loss order will be adjusted to the remaining quantity."
  - "Once one of the exit orders is filled, the other is canceled."
  - "Order replacement (`PATCH /v2/orders`) is supported to update `limit_price` and `stop_price`."
- "Paper Trading", https://docs.alpaca.markets/docs/paper-trading (read 2026-11-04): fills are simulated against the best current market price; "When orders are eligible to be filled, they will receive partial fills for a random size 10% of the time." Nothing on that page says brackets behave differently on paper.
- Forum, "Partial Bracket order fills", https://forum.alpaca.markets/t/partial-bracket-order-fills/12723 (one post, August 2023, no staff answer): about a partly filled entry, not this case.
- **So:** on 2026-11-04 Alpaca paper cancelled the stop 2 ms after the take-profit's first partial fill, 655 times, against its own documentation. What live trading does is unknown. Fix 1 protects in either case. If the stop is resized and stays live, as documented, fix 1 does nothing.

**Tuesday 2026-11-03, read only (full-size positions, about 2,000 dollars each).** 91 entries filled; 37 had any take-profit fill; 25 of those had the stop cancelled before the take-profit finished:
- under 1 second: 4;
- 1 to 10 seconds: 13;
- 10 to 60 seconds: 6 (the longest was LSCC, 56.6 seconds);
- over 60 seconds: 2 (SHOP 109.4 seconds, MRVL 62.6 seconds);
- over 10 minutes: 0.

All 25 ended at their take-profit. So the gap happens on normal days too, with positions about 30 times larger than Wednesday's.

**The wait before selling: 5 seconds from the stop's cancel.** On Wednesday, of the 655 gaps, 305 lasted over 2 seconds, 164 over 3, 90 over 5, 51 over 10 and 34 over 20. 5 seconds leaves alone the many take-profits that finish within a few seconds, and catches the rest quickly.

### What changed

**Fix 1: shares left without a stop after a partial take-profit** (`risk.ts`, `sells.ts`, `worker.ts`).
- **The rule:** the order sync treats an entry as "bare" when its stop is no longer live (cancelled or expired, and it did not fill), some of its shares are still unsold, and the symbol is still held. This holds even while the take-profit is open.
  - The old missing-exit rule (no open exit at all: sell at once) is unchanged.
- **The 5 second wait:** measured from Alpaca's cancel time on the stop leg (`canceledAt`, now read from Alpaca). If Alpaca gives no time, it is measured from when this worker first saw the entry bare, whichever is earlier.
- **The sale:** after 5 seconds the remaining shares are sold through the existing missing-exit sale, which now also takes the entry's open exit leg ids (`cancelIds`). It cancels them by id, so a take-profit that Alpaca's open list does not show is still cancelled first. Alpaca's "already filled or cancelled" answer counts as done. It then waits until the shares are free and sells through the sell gate, which is still the only sender.
- **Messages:** "**SYM: Alpaca cancelled its stop when the take-profit partly filled, so I sold the remaining N shares.**"
  - If the sell went out but Alpaca has not filled it yet, it says so without mentioning Michael (paper has held sells 16 seconds). A real failure keeps the "HAS NO PROTECTIVE STOP AND I COULD NOT SELL IT" alert with the mention.
- **Bringing the next sync forward:** when the sync finds a bare entry younger than 5 seconds, it returns the moment the wait ends (`recheckAt`). The worker runs the next sync on the first pass at or after that moment, instead of waiting the full 10 or 30 seconds.
  - Passes run every 5 seconds, so the sale starts 5 to 10 seconds after the stop's cancel, plus the cancel and sell themselves. On normal and load days alike.
- **Not changed:** the protect switch (off during any sale and from the close-out time), the latest-entry-per-symbol rule and the "a sell is already working" rule all apply as before.

**Fix 2: no NOT FLAT while the close-out's own sells are working** (`closeout.ts`, `sells.ts`).
- The sale routine has a new option, used only by the close-out: from round 2 on, if every share still held is covered by a sell the stack sent (client id `cyrus-x-`), it stops and returns those symbols as "working", instead of waiting out the remaining rounds.
  - The loss stop, the missing-exit check, the `flatten` command and the carried-position sale do not use the option and keep their old rounds.
- The close-out then waits gently, about 0.6 requests a second (positions every 2 seconds, open orders every 10), until the account is flat or until 2 minutes before the close (2:58 PM). Without a known close (the emergency path) it waits at most 60 seconds.
- **If flat:** "Close-out done", as usual. Alpaca's "order pending cancel" answers no longer count as trouble, so the "had trouble but recovered" note is not posted for them.
- **If not flat at the deadline with its own sells still working:** NOT FLAT names the true reason, for example "1 sell sent at 2:55 PM CT for ADT; Alpaca had not filled it by 2:58 PM CT. Please check Alpaca now." It does not say "close by hand".
- **If a sell of ours is gone and shares are still held:** NOT FLAT at once, as before.
- The not-flat flag and the Healthchecks failure signal therefore come only when NOT FLAT is posted.

**Fix 3: one close-out per day** (`worker.ts`).
- The carried-position sale runs only before the day's close-out time (2:55 PM), and never once that day's close-out has started (in memory, or the close-out step recorded in the day record).
- From 2:55 on, the close-out and its 20 second retry alone sell. In Wednesday's case that gives one "Close-out done", and the close-out step is recorded when the account is flat.

**Fix 4: Alpaca's listing checked against the stored entries** (`risk.ts`, `worker.ts`).
- **The order sync:** a stored entry missing from Alpaca's listing is fetched by its client id if it was sent (submitted or filled), or if it is still an intent after 10 seconds. At most 10 lookups a sync. An id Alpaca does not know is not asked again for 60 seconds. A fetched entry gets the same record update, missing-exit check and bare check as a listed one.
- **The daily summary:** stored entries missing from the listing are fetched (at most 50), so its counts and profit match the account.
- How far back the sync reads is unchanged; that waits for the faster-order-check proposal.

**Fix 5: logging and wording.**
- **The close-out's run-log event** (`closeout_result`) now records:
  - which path ran it ("close-out", "retry", "carried" or "emergency");
  - how long it waited for its own sells;
  - the times its cancels were sent and answered, and each sell sent (symbol, shares, time).
- **Heartbeat failure signals:** each one is logged, and the first of each episode is kept in the run log (`heartbeat_fail`). The next good heartbeat logs how many failure signals there were.
- **"Too close to the close for a new entry"** is now counted into one row a minute, like the other routine refusals (2,209 single rows on Wednesday).
- The NOT FLAT wording change is part of fix 2.

### Tests

New file `test/release-a.test.ts`, 17 tests. The simulated broker (`test/sim-broker.ts`) gained four things:
- the paper behaviour of a partial take-profit (the stop cancelled at the first partial fill);
- a cancel time that can be set (11 seconds, as measured on Wednesday);
- a listing that can leave chosen entries out;
- Alpaca's "order pending cancel" answer to a second cancel.

Wednesday is recreated twice:
- **The close-out:** cancels that take 11 seconds, and sells that fill 20 seconds after they are sent. Result: flat, no NOT FLAT, no failure signal, one "Close-out done", the step recorded. This runs both directly and through the whole worker.
- **CIFR:** a partial take-profit, the stop cancelled, the take-profit hidden from the open list. Result: the remaining 7 shares sold 5 to 7 seconds after the cancel, with no oversell. It also works with the 11 second cancel, and through the worker, where the 30 second sync is brought forward to sell by 15:00:40 instead of at 15:01:00.

Tests that normal behaviour is unchanged:
- an entry with no live exit is still sold at once, with the old message;
- the loss stop's sale does not stop early on its own working sells;
- the documented behaviour (stop resized and live) is left alone;
- nothing is sold while the protect switch is off;
- a take-profit that finishes inside the 5 seconds is left alone.

Full suite **360 pass** (343 before), type check clean.

| Change taken out | Tests that fail |
| :-- | :-- |
| bare rule off | CIFR case; slow cancel; worker-level re-check |
| 5 second wait ignored (sell at once) | CIFR case; finishes inside the wait; worker-level re-check |
| exit leg ids not cancelled | CIFR case; slow cancel; worker-level re-check |
| no early re-check sync | worker-level re-check |
| close-out does not ask for the early return | Wednesday close-out; true reason at the deadline; gentle polling; worker-level close-out |
| close-out does not wait for its own sells | Wednesday close-out; true reason at the deadline; gentle polling; worker-level close-out |
| early return for every caller | CIFR case; no-exit sale unchanged; loss stop sale unchanged |
| old NOT FLAT wording | true reason at the deadline |
| "pending cancel" counted as trouble | Wednesday close-out |
| carried sale allowed after the close-out | one close-out per day |
| no lookup of missing entries (sync) | missing entry recorded |
| no 60 second memory of unknown ids | missing entry recorded |
| no lookup of missing entries (summary) | summary counts |
| "too close" written row by row | one row a minute |
| heartbeat failure not logged | heartbeat logging |
| path not recorded | Wednesday close-out; one close-out per day |
| step times not recorded | Wednesday close-out |

**Interpretations (for the reviewer and Michael):**
1. **The gap:** the early re-check runs on the first 5 second pass after the wait ends, so the sale starts 5 to 10 seconds after the stop's cancel. On paper, cancelling the take-profit can then take about 11 seconds before the sell goes out.
2. **Where the gentle wait applies:** on for the close-out, its retry and the emergency close-out; off for the carried-position sale. Michael asked that the carried sale keep its old behaviour, and it now never runs after the close-out time anyway.
3. **Wording for a sell not yet filled:** for a bare remainder, "sell sent, not filled yet" is reported without mentioning Michael. The no-exit case keeps its old wording exactly.
4. **What is trouble:** only "order pending cancel" answers are treated as not-trouble. Any other cancel or sell problem still gets the "had trouble but recovered" note.

Secret scan clean. Not deployed and not reviewed. Paper only.

## Release B proposal: 100 entries a minute on Thursday's load day (2026-11-04, evening; for Michael's approval, no code until he approves)

Michael's ask: cut each symbol's cycle from about 34 seconds to under 17 in the load window, load days only, normal days unchanged, the 100 a minute ceiling kept. Release B is built on top of release A and deploys separately, only if its own review passes.

**How the options were judged (an estimate, not a measurement).**
- Wednesday's whole window loop was replayed per symbol on the free feed's actual trade prints, 8:45 to 9:00 AM. The replay includes:
  - the placeholder's signal rule, with the cooldown counted from the last signal (refused ones included);
  - one position per symbol;
  - the measured fill delay (median 2.3 seconds from decision to a full fill);
  - the measured entry slippage;
  - the exits;
  - when a closed position frees its symbol.
- **Calibration:** with Wednesday's settings the replay gives 418 entries against the 382 that happened (about 10 percent high), and a median hold of 18.6 seconds against the actual 18.5.
- Paper fills against the consolidated quote, not IEX prints, so treat every number below as a guide.

| Option (load window only) | Entries in 15 min | Minutes at 90 or more | Window result (dollars) |
| :-- | --: | --: | --: |
| Wednesday: +3/-4 cents, cooldown 5 s, freed by the 10 s order sync | 418 (actual 382) | 0 | -36 (actual -38) |
| Freed from Alpaca's live order updates, otherwise as Wednesday | 480 | 0 | -39 |
| Live updates, +1/-2 cents, cooldown 1 s | 962 | 0 | -41 |
| Live updates, +1/-2, cooldown 1 s, **enter on any new print** | 1,383 | 10 | -69 (-14 at 1 share) |
| the same, at **1 share**, plus a **60 second time limit** | 1,400 | **13** | **-14** |
| the same, at 1 share, plus a 30 second time limit | 1,448 | 14 | -14 (but about 15 extra requests a minute) |

What the table shows:
- The signal rule is the biggest limit. "An uptick at or above the average of the last 12 prints" waits for prints that may not come.
- Next come the exit width (holds) and the time until a closed symbol is noticed.
- No single change reaches 90 a minute. Four together do.

**Proposed, load window (8:45 to 9:00 AM) on a load day only:**
1. **Free a symbol the moment its exit fills, from Alpaca's live order updates.**
   - Alpaca's `trade_updates` stream (`wss://paper-api.alpaca.markets/stream`) sends a `fill` event for every order, the exit legs included. Each event carries `position_qty`, the position after the fill (Alpaca's "WebSocket Streaming" page, read 2026-11-04). The legs carry the entry's `group_id`.
   - A sell fill that leaves 0 shares frees that symbol in the gate (the cached positions and the stored entry) within about half a second, instead of waiting for the next 10 second sync.
   - It is a listener only: it never sends an order. It uses no REST requests (it does not count against the 200 a minute).
   - It runs from "Armed" to the close on load days only. If it drops, it reconnects, and the 10 second sync still frees symbols as today. The sync stays the record of truth and runs the missing-exit and stop checks.
   - Not yet seen on paper: whether paper's events carry `position_qty` for bracket legs. If not, the code adds up the exit fills against the entry's filled shares.
2. **Enter on any new print once the symbol is free**, at least 1 second after its last entry (instead of the uptick rule and the 5 second cooldown). The placeholder stays meaningless by design; this only makes it busier.
3. **Exits 1 cent above and 2 cents below the signal price** (instead of 3 and 4). Every entry still carries both exits at Alpaca in the same bracket.
4. **1 share per entry.**
   - A 1-share order cannot partly fill. So the window has no stranded remainders (the stop problem release A fixes), no partial fills to wait on, and no fix 1 sales eating requests.
   - The cost falls about five times: positions of 5 to 35 dollars instead of about 68.
   - Without this, tighter take-profits produce more partial fills. Fix 1 would then sell about 3 remainders a minute at 15 to 25 requests each, and push the window past 200 requests a minute.
5. **Recommended, a 60 second time limit.**
   - A position still open after 60 seconds has its take-profit's limit price lowered to a price that sells at once. Alpaca documents replacing a bracket leg's `limit_price` (`PATCH /v2/orders`, "Orders at Alpaca", Bracket Orders, read 2026-11-04).
   - That is 1 request each, about 5 a minute in the replay. It is not a cancel, which took about 11 seconds on paper at Wednesday's close-out.
   - The quantity does not change, so it cannot oversell. It goes through `sells.ts` like every sale, and the structure test covers it.
   - It frees slow symbols (ADT-like names) and lifts the replay from 10 to 13 minutes at 90 or more.
   - Not yet seen on paper: how long a leg replacement takes there. If it is slow, the limit still frees the symbol, just later.

After 9:00 AM the load day carries on as Wednesday did: the normal placeholder, the 75 dollar cap, the 10 second sync. Normal days are unchanged, and the stream is not connected on them. A test proves a normal day is unchanged.

**The cycle, item by item (replay, recommended set):**
- decision to fill about 2.3 seconds;
- hold: median about 1 second, mean about 9 with the 60 second limit;
- freed about 0.5 seconds after the exit fills;
- next entry on the next print at least 1 second later.
- That gives a mean cycle of about 13 to 15 seconds, under Michael's 17, on the active names. The slow names stay slower, and the time limit bounds them.

**Expected cost (paper dollars):**
- The load window: about **15 dollars** in the replay (1,400 entries of 1 share).
- The rest of the day, on Wednesday's settings: about 100 dollars, depending on the market.
- Fees about 3 to 4 dollars.
- The worst case is still bounded by the unchanged 500 dollar loss stop.

**Requests a minute at 100 entries (estimate):**

| Work | Requests |
| :-- | --: |
| Entries (bracket included) | 100 |
| Account and positions every 5 seconds | 24 |
| Loss stop checks | 12 |
| Settings | 2 |
| Order sync every 10 seconds (1 page: open entries are under a minute old) | 12 |
| 60 second time limit (replacements) | about 5 |
| Fix 1 sales (none at 1 share) | 0 |
| Live order updates (stream, not REST) | 0 |
| **Total** | **about 155** |

Cross-check from Wednesday's measurement (35 routine plus about 1.4 per entry): about 175. Either way it is under 200. That headroom is what Thursday tests. Wednesday's measurements suggest Alpaca's remaining count refills continuously (192 left in a minute with 88 requests), so the governor's 80 reserve should not bite at about 160. If it does, that is the "does not hold" result, measured.

**The 100 a minute ceiling: it does not block the test.**
- The replay wants more than 100 in the first 4 to 5 minutes (1,606 uncapped) and is clipped to 100. It still reaches 90 or more in 13 minutes.
- The pass needs about 90 for 10 of 15 minutes, so 100 is enough.
- What the ceiling does block is learning anything above 100. That is outside this test, and raising it is a hard stop for Michael.

**Honest odds.** The replay ran 10 percent optimistic on Wednesday. At 13 replay minutes at 90 or more, Thursday plausibly lands at 9 to 13. A pass is likely but not certain, and "inconclusive" again is possible.

**Code changes this needs (all money-touching, load window only):**
1. A new live order updates listener (`order-stream.ts`): it frees symbols in the gate's cached view and closes the stored entry, with logging (events received, symbols freed, time from exit fill to free, reconnects).
2. The strategy's load window rule: any new print, 1 second, +1/-2 cents.
3. The gate's load window size: 1 share.
4. (If approved) the 60 second time limit in `sells.ts`, through the sell gate, with the structure test extended.
5. The summary and Armed wording for the new window settings.

Each gets a test that fails without it, plus "a normal day is unchanged". Then the secret scan, the full suite, one build-reviewer round, and a deploy as its own release before 7:30 AM if the review passes.

**One build-order note.** B is built on top of A. If A fails its review and B passes, B would have to be rebuilt on the v7 code before it could deploy alone. I would tell Michael before doing that.

**For Michael to decide:** approve items 1 to 4; and item 5 (60 second time limit) yes or no. Also, Thursday is a load day only once he types `load on` before the 7:45 AM screen and approves Thursday's limits (at least `trades 100`).

Paper only. Research input for a human decision, never an instruction to act.

## Release A review (2026-11-04, evening): PASS. Deployed as Fly release v8.

Round 1, the only round Michael allowed, on `4e81d33..a99039d`. No blocking findings. Checks 2, 7 and 10 clean. 360 pass, type check clean. The reviewer took out 11 rows of the removal table in a scratch copy, and each failed exactly the tests named.

**Confirmed:**
- **No oversell on any new path.** The sell gate is still the only sender. Probes where the take-profit fills completely, or partly, while its cancel is in flight sold nothing, or only the shares left.
- **The bare rule stays out of the way:**
  - it is off during every liquidation and from the close-out time on;
  - it never fires on a stop that filled or is still live;
  - it cannot reach a later entry on the same symbol (the gate's "still working" rule).
- **Fix 2's wait** is bounded by the close minus 2 minutes and reads no clock. It breaks out and alerts if one of the close-out's own sells is cancelled or refused (probe: NOT FLAT with the mention about 6 seconds after Alpaca cancelled the sell). Every not-flat outcome still sets the flag and the failure signal. Only the close-out asks for the early return.
- **Fix 3** cannot block the next day's carried sale.
- **Fix 4** is bounded: 10 lookups a sync, a 60 second memory for unknown ids, 50 in the summary.
- Normal-day behaviour is otherwise unchanged. The builder's interpretations fit, with note 1 below.

**Measured in the simulator:**
- One bare-remainder sale costs 22 requests over 3 seconds (fast cancel) to 78 over 20 seconds (11 second cancel, sell held 16 seconds). For that time it holds the one-at-a-time sale queue, so a loss stop sale can wait up to about 20 seconds behind it.
- The close-out wait costs about 36 requests a minute.
- Only entries are held back by the governor, so these reads take room from entries, never from sells or cancels.

**Non-blocking notes (logged, not changed):**
1. The remainder sale starts 5 to 10 seconds after the stop's cancel (the next 5 second pass), plus the take-profit cancel time. This is "as short as possible" only loosely.
2. **For release B:** at 100 entries a minute with bracket sizes as Wednesday's, bare-remainder sales would add about 90 requests a minute and pass 200. B's 1-share entries in the load window avoid this, since a 1-share order cannot partly fill.
3. The emergency close-out calls the close-out without the close time, so its wait is capped at 60 seconds. If it fires in the last minute, NOT FLAT can come up to about 60 seconds after the close. Passing the broker's close time would fix that, but it is money-touching and needs Michael's approval.
4. When one of the close-out's own sells disappears during the wait, the NOT FLAT alert gives no reason. Wording only.
5. The bare rule looks at the first stop leg only. If live trading resizes the stop by replacing the leg, a protected remainder would be sold after 5 seconds. That errs toward selling, never toward overselling.
6. A Discord stall (up to about 30 seconds worst case) holds the risk task while a remainder-sale message posts, as the old missing-exit message did. Now more frequent.
7. A clock difference between Fly and Alpaca shifts the 5 second wait.

### Deploy (2026-11-04, 6:10 PM Central, market closed)
- `fly deploy --ha=false` from a separate checkout of `a99039d` (code identical to `main` at `852b2c0`), with no key file in the checkout.
- **Fly release v8:** one machine in San Jose, good state. One `worker_started` at 6:11:24 PM; no warnings or errors in the log or the run log.
- Discord, `commands`, 6:11:23 PM: "New release MPHW9C0F (it was 8M2HSEXX), so this is a deploy. Starts in the last hour: 1."
- Healthchecks up (last ping 6:12:00 PM).
- **Limits post:** Thursday 2026-11-05's request (posted 3:10 PM) stands unchanged, every limit waiting for Michael (position 500, loss 500, trades 100, cap 1). The deploy did not repost it.
- Stop flag off, not-flat flag off.

Paper only.

## Release B (built 2026-11-04, evening; code only, not deployed)

Michael's approval (2026-11-04, evening):
- items 1 to 4, load days only, normal days unchanged;
- item 5, the 60 second time limit, with a guard: a refused or stalled price change leaves the existing stop and take-profit, is logged and counted, and is never retried;
- a test that the change can never oversell or leave a position without a stop.

Built on top of release A (v8). Everything below applies only on a load day, and only in the window (8:45 to 9:00 AM Central), unless it says "load day".

**1. Live order updates (`src/order-stream.ts`, new).**
- **What it is:** a listener on Alpaca's paper `trade_updates` stream (`wss://paper-api.alpaca.markets/stream`).
  - The address is built from the fixed paper host and checked like the trading address (`assertPaperStream`).
  - It authenticates, listens, and reads the binary frames paper sends.
  - It never sends an order and never calls REST. A structure test checks that `order-stream.ts` cannot reach the broker.
- **When it runs:** on a load day from "Armed" to the close. Never on a normal day.
- **What it does on a sell fill:** when Alpaca says the position is now 0 shares (`position_qty`), the symbol is freed at once:
  - the gate's cached positions drop it (`BrokerView.dropPosition`);
  - the entry is recorded as closed, with its own fill written.
- **Safety rules:**
  - The entry is found by Alpaca's `group_id` (a bracket's entry and its legs share it), never by symbol. A late or repeated update about an older position cannot close a newer entry on the same symbol, which would otherwise let a second entry go out beside it and take it out of the missing-exit check.
  - An entry is closed only if its own fill is known, from the stream's buy fill or from the order sync's latest view. Otherwise only the cached position is dropped and the sync closes the record.
  - If `position_qty` is missing, the symbol is freed only when that group's exit fills add up to the entry's filled shares. If that cannot be decided, nothing happens and the sync takes over.
- **Resilience:** it reconnects with a growing wait (2, 4, 8 up to 30 seconds) and stops after "not authorized". While it is down, the 10 second sync frees symbols as before. The sync stays the record of truth and still runs the missing-exit and bare-remainder checks.
- **Logging:** connects and reconnects go to the run log (`order_stream`; reconnects as warnings). Each free is logged with the time from Alpaca's fill to the free. The per-minute statistics carry the counters: events, frees, records closed, reconnects, typical time.

**2. Strategy (`strategy.ts`, `load-mode.ts`).** In the window:
- any new print is a signal once 1 second has passed since that symbol's last signal (no uptick or 12-print average rule);
- exits sit 1 cent above and 2 cents below the signal price;
- the signal is marked as a window signal.

Outside the window the rule is unchanged, byte for byte.

**3. Gate.** A window signal on a load day is 1 share (never more than the checks allow). The 75 dollar cap stays all load day.

**4. Wording:**
- **Mode line:** "5. mode: **LOAD DAY** (cheap list, at most 75 dollars a position, 1 share churn 8:45 AM CT to 9:00 AM CT, then normal)".
- **Armed message:** "1 share a trade, any new print, exits 1 cent up and 2 down, symbols freed by Alpaca's live order updates, a 60 second time limit".
- **Summary:** a window line with the settings, the time limit's outcomes and the live updates' counters.
- The normal day's mode line and texts are unchanged.

**5. The 60 second time limit (`src/time-limit.ts`, new; `SellGate.lowerTakeProfit` in `sells.ts`; `replaceOrderLimit` in `alpaca-trading.ts`).**
- **What it does:** a window entry still open 60 seconds after its fill has its take-profit leg's limit price lowered, through `PATCH /v2/orders/{id}` with `limit_price` only. The new price is the lower of the last price minus 5 cents and 98 percent of it, rounded down to the cent, never above the take-profit's own price by the same rule.
- **Where its data comes from:** the take-profit leg comes from the order sync's latest view (`SyncMemory.lastSeen`, new), so there are no extra lookups.
- **Cost:** each attempt costs 2 requests, a position check and the change. The proposal counted 1.
- **When it holds back:** at Alpaca's safety reserve (the attempt is not used up), and while a close-out or any sale runs or from the close-out time on.
- **Michael's guard:**
  - **One attempt per entry**, remembered in memory and in the database (`time_limit:<date>`), so a restart does not try again.
  - **A refusal** (a 4xx, or the sell gate's own refusal) is counted as refused. Both exits stay as they were.
  - **A stall** is counted once: no answer within the client's 10 second request limit, a server error, a 429, or an accepted change that the next sync still shows unchanged and unfilled. Nothing more is done.
  - **It cannot oversell.** It sends no quantity (a structure test checks the call's body). The sell gate refuses unless the leg's unfilled shares are no more than the shares held, and refuses any price that is not lower.
  - **It cannot leave a position without a stop.** It never touches the stop, and does nothing to an entry whose stop is not live; that remainder is release A's bare rule's to sell. A test shows that if the stop goes after a change was accepted, the bare rule sells what is left.
- **Who may send it:** only `sells.ts` may call `replaceOrderLimit` (structure test).
- **Summary:** attempts, changed, how many then sold at the take-profit, refused, stalled.

**6. Logging.**
- Per-minute statistics in the window as before, now with the live updates' and the time limit's counters.
- New run-log events: `order_stream`, `order_stream_started`, `time_limit`, `time_limit_stalled`, `time_limit_refused`.

**Interpretations (for the reviewer and Michael):**
1. The live updates run from "Armed" to the close as specified, so after 9:00 they also free symbols for the normal placeholder (a little faster re-entry than today). Everything else after 9:00 is as Wednesday's. The time limit applies only to entries made in the window, which keep it after 9:00.
2. A stall includes a 429 and a server error (no clear answer, so the outcome is unknown and it is not tried again), as well as the time-out and the unchanged-at-next-sync case.
3. Not yet seen on paper:
   - whether `trade_updates` events carry `position_qty` and `group_id` for bracket legs (the code falls back to the sync if not);
   - how Alpaca lists a replaced take-profit under its entry. If the new leg is not listed there, the summary's "then sold at the take-profit" count reads low. The sync still closes the entry by its existing "position gone" rule.
4. **Request load:** the proposal's table gave about 155 requests a minute at 100 entries. The time limit's position check adds 1 request per attempt, about 5 a minute in the replay, so about 160. In the simulated window below, the most in any 60 seconds was 150.

**Tests:** `test/release-b.test.ts`, 17 tests :
- the listener's paper-only address, authentication, binary frames, and that it sends nothing else;
- reconnects;
- frees only on 0 shares;
- group matching (a late update never closes a newer entry);
- the `position_qty` fallback;
- structure;
- worker level: connects at Armed and stops at the close, an exit frees the symbol with no sync in between, the Armed wording and mode line, the counters in the statistics, and the time limit run by the worker's own passes;
- **a normal day unchanged:** no live updates, the uptick rule, 9 shares at 50.40, normal exits, no time limit;
- the time limit: once at 60 seconds and closing;
- the guard: refused and never retried (also after a restart), stalled for both a time-out and an accepted-but-unchanged change, never oversell, never without a stop, held back at the reserve and during a close-out, no time limit after the window;
- the summary;
- **the window at volume** on the simulated broker (30 names, a busy market with 1 cent steps every 100 ms): 1,500 entries, 100 in every minute of the window (the ceiling), every entry 1 share, at most 150 requests in any 60 seconds, lowest budget 171, no remainder sales, no rate-limit answers, no false alarm. This is the plumbing in a generous simulated market, not a forecast of Thursday.

Changed on purpose: the two load-mode tests that checked Wednesday's window rules (3 cents up, 4 down, a 5 second cooldown, the uptick rule) now check release B's.

Full suite **377 pass** (360 before), type check clean, secret scan clean, no dashes.

| Change taken out | Tests that fail |
| :-- | :-- |
| live updates never connected | worker frees at once; window at volume |
| live updates also on a normal day | normal day unchanged |
| live updates not stopped at the close | worker frees at once (stopped at the close) |
| `position_qty` ignored (any sell fill frees) | frees only on 0 shares |
| entries matched by symbol, not group | late update never closes a newer entry; worker frees at once |
| no fallback without `position_qty` | the `position_qty` fallback |
| record closed without its fill known | the `position_qty` fallback (fill unknown case) |
| cached position not dropped | worker frees at once |
| paper-only address check off | listener's paper-only address |
| uptick rule kept in the window | load-mode window test; strategy rules; worker frees at once; worker time limit |
| cooldown 5 seconds again | strategy rules; worker frees at once |
| take-profit 3 cents again | load-mode window test; strategy rules; window at volume |
| stop 4 cents again | load-mode window test; strategy rules |
| window signal not marked | strategy rules; window at volume |
| normal size in the window (no 1 share) | window at volume |
| old mode line | worker frees at once (wording) |
| old Armed wording | worker frees at once (wording) |
| no counters in the per-minute statistics | worker frees at once (statistics) |
| time limit not run by the worker | worker time limit |
| time limit at 0 seconds | worker time limit |
| time limit retried (no memory of attempts) | refused, never retried; stalled, never retried; worker time limit |
| attempts not saved in the database | refused, never retried (restart part) |
| stall at the next sync not counted | stalled (accepted but unchanged) |
| time limit acts without a live stop | never without a stop |
| time limit ignores the safety reserve | holds back at the reserve |
| time limit during a close-out or a sale | holds back during a close-out |
| time limit on entries outside the window | no time limit after the window |
| sell gate: no shares-held check | never oversell; never without a stop |
| sell gate: the price may go up | never oversell |
| sync does not keep its latest view | the 6 time limit tests |
| no summary lines | the summary |

Three rows failed no test on the first pass, and each test was strengthened until it did:
- **"time limit acts without a live stop"**: the sell gate's shares-held check had been stopping the change on a stale view. The test now syncs first, so the stop check alone has to hold.
- **"record closed without its fill known"**: a case was added where the entry was seen only as "new".
- **"cached position not dropped"**: the worker test now has the cached view show the position first.

Of the two layers that keep the time limit off normal days (the worker runs it only on a load day, and the time limit returns at once on a normal day), taking out one alone fails no test, because the other still holds.

## Release B review (2026-11-04, evening): PASS. Deployed as Fly release v9.

Round 1, the only round Michael allowed, on `1e2b26a..f66cc60`. No blocking findings. Checks 2, 7 and 10 clean. 377 pass, type check clean. The reviewer took out 9 safeguards one at a time in a scratch copy, and each failed exactly the test named.

**Confirmed:**
- **Paper only.** The stream address comes from the fixed paper host constant and is checked on every connect. The keys go only into the stream's auth message and are never logged.
- **The listener** frees a symbol only on a sell fill leaving 0 shares (or exit fills adding up to the entry's shares). It matches the entry by `group_id`, never by symbol. A replayed event is harmless. Only the gate's snapshot and the carried-position scan read the cached view; the close-out, NOT FLAT, the loss stop and the bare rule read Alpaca directly.
- **The time limit:**
  - it sends no quantity (a structure test checks the request body);
  - it refuses a take-profit holding more shares than are held, and any price that is not lower;
  - one attempt per entry, saved in the database;
  - it skips an entry without a live stop;
  - it holds back at the safety reserve, during a close-out or a sale, and from the close-out time on.
- **Request load:** the simulator peaked at 150 in any 60 seconds, lowest budget 171, no 429s. Sells and cancels are never held back. The 100 a minute ceiling is untouched.
- **Normal days are unchanged.** Line 5 gains only "1 share".

**Non-blocking notes** (each fix is money-touching and needs Michael's approval):
1. **The time limit keeps running under a plain `stop`.** It checks only the close-out and sale guard, not the stop flag. It only ever sells, earlier, and the stops stay.
2. **After `load off` mid-window,** the time limit still applies to entries made between 8:45 and 9:00. Those may then be normal size. It sends no quantity, and release A's bare rule covers any remainder. Found by reading the code; no test covers it.
3. **Untested on paper.** The new price sits below the sibling stop. If Alpaca refuses a take-profit priced below its stop, every attempt counts as refused and the time limit frees nothing. The guard makes that harmless, and Thursday's summary will show it.
4. **In a broker stall,** a sale queued behind a time-limit attempt could wait up to about 41 seconds (worked out from the client's time limits, not measured).
5. **Signal load.**
   - "Stop flag is set", "not armed" and "not flat" refusals are written row by row, not counted. If the stop flag were on during the window, that could mean about 30 rows a second.
   - **Correction by the builder:** the reviewer wrote that the stop flag is on now. It is not. It reads off (cleared by Michael's `resume` at 3:38 PM Tuesday), checked after the v9 deploy.
   - **CPU, a guess:** each gate pass copies and sorts the day's order list (2 to 5 ms on a Mac at 1,500 to 3,000 rows). Fly's CPU graph for the window and the summary's counts will measure it.
6. **Small gaps:**
   - a crash during an attempt could allow a second, lower price;
   - a failed save of attempts is silent;
   - the order stream is not restarted after a short worker hiccup that day (the 10 second sync takes over).

### Deploy (2026-11-04, 7:08 PM Central, market closed)
- `fly deploy --ha=false` from a separate checkout of `f66cc60`, with no key file in the checkout.
- **Fly release v9:** one machine, good state. One `worker_started` at 7:08:51 PM ("Starts in the last hour: 2" counts release A's start at 6:11 PM). No warnings or errors.
- Discord, `commands`, 7:08:50 PM: "New release RXJ6WWNR (it was MPHW9C0F), so this is a deploy."
- Healthchecks up (last ping 7:08:51 PM).
- **Thursday's limits post still shows the load switch.** The 3:10 PM request reads "5. mode: normal (`load on` makes it a load day)", every limit waiting for Michael. v9 shows the same line until `load on`, then "LOAD DAY (cheap list, at most 75 dollars a position, 1 share churn 8:45 AM CT to 9:00 AM CT, then normal)".
- Stop flag off, not-flat flag off.

**For Thursday to be the load day:** Michael approves the limits (at least `trades 100`) and types `load on` before the 7:45 AM screen. Without approval there is no trading Thursday.

Paper only.

## Thursday 2026-11-05 session review (release v9, second load day; written after the close, read only)

The brief is `builds/thursday-review-brief.md` (saved verbatim on Wednesday evening). It ran from a scheduled wait at 3:15 PM Central.

Sources, all read only, all on 2026-11-05 after the close:
- **The stack's database**, in one read-only transaction: the day records, every stored entry (4,221), the refusals, the run log (218 events) and the control values.
- **Alpaca paper:**
  - every order of the day with its exit legs (4,192 listed, plus 23 entries and 1 remainder sale fetched by id, see 4.5);
  - all 14,991 fills;
  - the account, positions, open orders and the one-minute equity history;
  - posted fees.
- **Discord:** the three channels through the bot (896 messages).
- **Healthchecks:** the check's flips and its last 100 pings (back to 2:21 PM, so the close-out's pings are there).
- **Fly:** releases and status, and the CPU, load and memory metrics from Fly's metrics service, for the window and the day.

Times are Central. "Measured" means read from a timestamp or a counter. "Inferred" means worked out from the code and the measured times. "Estimate" means a calculation that today did not test.

**State after the close:**
- Fly runs release v9 on one machine (San Jose, 1 shared CPU, 512 MB), started 2026-11-04 7:08 PM. No restarts.
- The account is flat: 0 positions, 0 open orders, equity 18,820.46, borrowing cap 1.
- The stop flag is off (Michael's `resume`, Tuesday 3:38 PM). The not-flat flag is off.
- Michael approved the limits (position 500, loss 500, trades 100, cap 1) and typed `load on`. The 7:30 AM post showed "**LOAD DAY**"; Armed at 8:25:03 AM with the window settings; the order stream went live at 8:25:04.
- Friday's limits request posted at 3:10 PM and waits for Michael. Friday is a normal day unless he types `load on` before 7:45 AM.

### 1. The load window, 8:45 to 9:00 AM: INCONCLUSIVE. Highest rate 86 accepted entries (93 orders sent) in any 60 seconds; no minute reached 90.

Against the approved rule ("Load mode proposal", section 8):
- **"Does not hold" needs any one of these. None happened:**
  - Alpaca's rate-limit answer (429): **0** all day.
  - Remaining stock below 80: lowest **185** in the window (from 8:46 on), **171** for the day (between 9:05 and 9:10, after the window, see 3).
  - A sell, cancel or close-out delayed by a rate limit: **none**. The governor held nothing back all day (0).
- **"Holds" needs about 90 entries a minute for 10 of the 15 minutes.** The busiest calendar minute had 73 accepted entries (81 orders sent). No 60 second stretch reached 90 accepted.
- **So the result is inconclusive.** The window ran at 59 accepted entries a minute on average, more than twice Wednesday's 25.5, and peaked at 86 accepted (93 sent) in the 60 seconds to 8:59:25. Requests reached 128 a minute and the remaining stock never fell below 185.

**Entries and requests, minute by minute.**
- Entries: decisions per calendar minute, from the stored entries. "Refused" means Alpaca answered 422 to the bracket.
- Requests: the governor's count for the 60 seconds before the stamp just after that minute. Its order count includes the refused orders. The stamps drift 1 to 16 seconds past the minute, so they do not line up exactly with the calendar minutes.

| Minute | Orders sent | Refused by Alpaca | Accepted | Governor stamp | Requests in the last minute | Orders in the last minute |
| :-- | --: | --: | --: | :-- | --: | --: |
| (before) | | | | 8:44:01 | 40 | 0 |
| 8:45 | 67 | 17 | 50 | 8:46:01 | 105 | 58 |
| 8:46 | 79 | 12 | 67 | 8:47:02 | 125 | 83 |
| 8:47 | 60 | 11 | 49 | 8:48:01 | 100 | 59 |
| 8:48 | 72 | 11 | 61 | 8:49:01 | 119 | 71 |
| 8:49 | 68 | 14 | 54 | 8:50:06 | 112 | 68 |
| 8:50 | 76 | 9 | 67 | 8:51:07 | **128** | 83 |
| 8:51 | 81 | 10 | 71 | 8:52:06 | 124 | 77 |
| 8:52 | 61 | 10 | 51 | 8:53:06 | 113 | 63 |
| 8:53 | 55 | 6 | 49 | 8:54:07 | 105 | 56 |
| 8:54 | 77 | 12 | 65 | 8:55:06 | 127 | 75 |
| 8:55 | 54 | 11 | 43 | 8:56:11 | 103 | 63 |
| 8:56 | 72 | 12 | 60 | 8:57:11 | 115 | 61 |
| 8:57 | 67 | 8 | 59 | 8:58:11 | **128** | 77 |
| 8:58 | 72 | 5 | 67 | 8:59:12 | 126 | 82 |
| 8:59 | 81 | 8 | 73 | 9:00:16 | 104 | 56 |
| **Window** | **1,042** | **156** | **886** | | | |

The lowest remaining stock was 191 at 8:45:02 and 185 from 8:46:01 to the end of the window. All 886 accepted entries filled, 1 share each.

**What limited the rate (measured unless marked).**
1. **Alpaca refused 15 percent of the window's orders, and each refusal shut that symbol for a minute.**
   - 140 refusals were the take-profit: "take_profit.limit_price must be >= base_price + 0.01". 16 were the stop: "stop_loss.stop_price must be <= base_price - 0.01".
   - The exits are set from the free feed's print (1 cent up, 2 down). Alpaca checks them against its own current price (`base_price`). Whenever Alpaca's price was above the print, a take-profit 1 cent above the print was too low. Wednesday's 3 cent take-profit was never refused in the window's 383 orders (its one refusal there was a stop); today's 1 cent was refused 140 times in 1,042.
   - After any refusal the gate waits 60 seconds before trying that symbol again ("Alpaca refused this symbol a moment ago"). That refused 2,440 signals in the window, and the waits covered **34 percent of the window's symbol time** (9,164 of 27,000 symbol-seconds).
   - The same cause shows in the fills: 325 accepted entries (37 percent) filled at or above their own take-profit.
2. **Decision to entry fill:** median 1.4 seconds, 90th percentile 2.3. Signals in that time are refused as "an entry for this symbol is still working" (854).
3. **Holds:** median 7.1 seconds (table in 2).
4. **Freeing:** about 50 ms after the exit fill (see 2). This is no longer a limit.
5. **The next entry** waits for the next print, at least 1 second later. From exit fill to the next entry on that symbol: median 2.6 seconds; 90th percentile 64, which is the minute waits.

- Per symbol, from one entry to the next: median 14.2 seconds, mean 28.2. Thirty symbols over a 28 second mean cycle gives about 64 a minute, close to the 59 measured.
- **Estimate:** had the minute waits not existed and that time cycled at the same rate, the window would have had roughly 886 / 0.66 = about 1,340 entries, about 89 a minute. This is not a measurement: what a shorter wait would do depends on how often Alpaca refuses again.
- **Against the replay:** it forecast about 1,400 entries, 13 minutes at 90 or more and about 15 dollars. It modelled neither Alpaca's refusals nor the minute's wait. Actual: 886 entries, no minute at 90, 11.14 dollars.

**Refusals in the window, by reason** (counted by the gate):
- Alpaca refused this symbol a moment ago, wait a minute: **2,440**;
- already holding this symbol: 1,856;
- an entry for this symbol is still working: 854;
- load day, entries start at 8:45 (the opening second): 33;
- held back by the governor: **0**.

**Brackets Alpaca refused:** 156 in the window (above), 10 in the rest of the day (9 take-profits, 1 stop). The most refused symbols in the window were SMCI 12, IREN 11, APLD 10 and RIOT 10.

**Decision to acceptance, 886 accepted:**
- Median 121 ms, mean 160, 95th percentile 296, slowest 1,967, fastest 93.
- Wednesday: 134, 169, 325 and 1,185 ms.

**Fees:**
- Wednesday's posted fees: REG 2.84 and CAT 0.07, exactly the 2.91 estimated.
- Thursday's estimate is 4.90 dollars (SEC 4.76, CAT 0.14, FINRA TAF 0 while paused). It posts this evening.

**Where the window's cost went: -11.14 dollars on 13,555 dollars bought (0.082 percent).**
- 886 positions of 1 share each, averaging 15.30 dollars, the largest 31.42.
- 378 closed by take-profit and 508 by stop. 221 made money and 665 lost or broke even.

| Part (each measured against the price the signal saw) | Dollars |
| :-- | --: |
| Take-profits at their own limit (1 cent up) | +4.45 |
| Stops at their own stop price (2 cents down) | -9.11 |
| Entry fills above the signal price | -4.40 |
| Stops filled below their stop price | -3.05 |
| Take-profits filled above their limit | +0.97 |
| **Total** | **-11.14** |

**Requests per entry (measured at 56 to 83 entries a minute, projected to 100):**
- Across the 15 stamps, requests a minute fit about **51 + 0.94 per entry**. Each entry costs its one order and nothing more. The 51 is the routine work: the account and positions every 5 seconds, the loss stop's account read every 5 seconds, settings, the 10 second order sync and the time limit.
- At 100 entries a minute that projects to **about 145**.
- Later in the day the routine work grew to about 70 a minute with no entries at all (see 3, the order sync's paging). On that base, 100 entries would need **about 165**.
- Both are under 200.
- Alpaca's remaining stock stayed at 185 or more at 128 requests a minute (Wednesday: 192 at 88). Its count seems to refill continuously rather than per calendar minute. That is inferred from two days; a minute at 150 or more would test it.

**The 100 orders a minute ceiling did not limit today: the governor refused 0 orders, and the most orders in any 60 seconds was 93.** One point for a day that reaches it: the governor takes an order's slot when the order is sent, so orders Alpaca refuses use up the ceiling too. At today's 15 percent refusal rate, 100 orders a minute would allow only about 85 accepted entries, under the pass rule's 90. Reaching the pass inside the ceiling needs refusals under about 10 percent. Raising the ceiling is a hard stop for Michael and is not proposed.

### 2. Speed detail

**Symbols freed by live order updates against the 10 second fallback:**
- The live updates closed **3,952** of the 4,055 entry records (the stream's own counter). That covers every one of the 886 window entries and every entry closed by its own take-profit or stop all day.
- The 10 second order sync closed **103**:
  - the 101 remainder sales (plain sells outside the bracket, see 3);
  - ADT's close-out sale;
  - one more, not identified.
- The stream freed **4,055** symbols. Besides the bracket exits, that includes the remainder sales and the close-out sale, which free the symbol at the update while the sync closes the record.
- The stream ran from 8:25:04 to the close with **0 reconnects** and received 47,704 updates.

**Time from exit fill to symbol freed:**
- **Typical: 47 ms**, the worker's own median measured from Alpaca's timestamp on the update. The slowest is not kept: the worker logs each free's time to Fly's log, whose buffer holds only the last 100 lines and had rolled over.
- **Upper bound, from the stored entry's close time minus the exit fill.** The gate treats a symbol as free only once both the cached position and the stored entry are closed. The cached position is dropped before the entry is written, so this time slightly overstates the free.
  - **In the window:** 885 of 886 closed within 2 seconds of the exit fill (median 49 ms, 95th percentile 67, 99th 184); the slowest took 2.05 seconds.
  - **Rest of the day:** median 48 ms, 95th percentile 1.04 seconds. About 115 entries the stream closed took **2 to 21 seconds**, in bursts: several symbols closed in the same instant (for example 8 at 9:15:11, the longest after an 8.1 second wait; 7 at 1:41:31; 5 at 1:00:13).
- **Cause of the bursts: not measured.** Before closing an entry the stream reads the stored entry from the database, and the gate waits for that close. Fly's CPU was low at those times (at most 9.6 percent of one CPU in any minute). So a pause in the database, or in Alpaca's delivery of updates, is likelier than the worker's processor. That is a guess. Logging each free's time in the run log would settle it.

**Did the live updates carry the share count (`position_qty`)? Inferred yes.**
- The stream freed symbols on the 101 remainder sales and on ADT's close-out sale.
- Those sells have no bracket group, so the code's fallback (adding up a group's exit fills) cannot free them. The only way the code frees them is a `position_qty` of 0.
- A logged raw update would turn this into a measurement.

**The 60 second time limit: 19 tried, 0 changed, 19 refused, 0 stalled.**
- Every refusal was Alpaca's "take_profit.limit_price must be > stop_loss.stop_price". Alpaca does not allow a bracket's take-profit at or below its own stop. The new price (5 cents below the last price) was always below the stop (2 cents below the signal).
- **Michael's guard worked as specified:** both exits stayed in place, each refusal was logged and counted, and none was retried. Nothing was oversold, and no position was left without a stop.
- Of the 19, 10 later sold at their original take-profit and 9 at their stop. The summary's "(10 then sold at the take-profit)" counts those, not sales the time limit caused.
- 22 window positions lived past 60 seconds; the time limit tried 19 of them. The run log does not say why the other 3 were not tried.
- The two review notes on the time limit (it keeps running under a plain `stop`; it applies after `load off` mid-window) did not come up: there was no `stop` and no `load off`.

**Hold times in the window** (entry fill to the last exit fill, 886 entries): median 7.1 seconds, mean 16.2, 90th percentile 32.7, longest 37 minutes (ADT's one window entry).

| Hold | Entries |
| :-- | --: |
| under 1 second | 35 |
| 1 to 5 seconds | 303 |
| 5 to 10 seconds | 210 |
| 10 to 30 seconds | 234 |
| 30 to 60 seconds | 82 |
| 1 to 2 minutes | 15 |
| 2 to 10 minutes | 6 |
| over 10 minutes | 1 |

Wednesday's window: median 18.8 seconds, mean 48.0.

**Fly CPU in the window** (one shared CPU; Fly's 30 second rate, percent of that CPU):

| Time | CPU busy |
| :-- | --: |
| 8:40 to 8:45 (before) | 1.2 to 2.1 percent |
| 8:45 to 8:50 | 2.9 to 4.4 percent |
| 8:50 to 8:55 | 3.7 to 6.1 percent |
| 8:55 to 9:00 | 5.1 to **9.7** percent (peak 8:59:45) |
| 9:01 to 9:05 (after) | 3.1 to 4.4 percent |

- Wednesday's window was 1.5 to 2.8 percent.
- Other measures:
  - Fly's CPU credit balance never fell below 49,297 of 50,000, so there was no throttling;
  - the load average peaked at 0.18;
  - free memory was at least 314 MB of 512.
- CPU climbs with the day's order count, not with the entry rate. It rose steadily through the window, and from 2:00 to 2:50 PM, with no entries at all, it ran at 6 to 7.6 percent. This matches release B review note 5: each gate check copies and sorts the day's whole order list. It was not a limit today, but it grows with every order.

### 3. The rest of the day (9:00 AM to 2:00 PM), release A's fixes, and the summary

**The normal placeholder with the 75 dollar cap:**
- **Entries:** 3,179 orders, 3,169 accepted and filled, 10 refused by Alpaca. The busiest minute had 43. No entries after 2:00 PM, by design.
- **Exits:**
  - 1,565 by take-profit;
  - 1,502 by stop;
  - 101 by release A's remainder sale;
  - 1 at the close-out (ADT).
- **Holds:** median 50 seconds, 90th percentile 296.
- **Speed:** median 166 ms, 95th percentile 340, slowest 1,313.
- **Position size:** average 68.59 dollars, the largest 75.30 (shares are sized from the signal price, as known).
- **Result: -236.16 dollars on 217,377 dollars bought (0.109 percent; Wednesday 0.087):**

| Part (against the signal's price) | Dollars |
| :-- | --: |
| Take-profits at their limit (0.25 percent up) | +306.82 |
| Stops at their stop price (0.4 percent down) | -412.31 |
| Entry fills above the signal price | -118.32 |
| Stops filled below their stop price | -38.07 |
| Take-profits filled above their limit | +23.16 |
| Remainder sales and the ADT close-out sale | +2.56 |
| **Total** | **-236.16** |

**The day as a whole:**
- 4,221 orders: 4,055 accepted and filled, 166 refused by Alpaca.
- Equity went from 19,067.76 to 18,820.46, **-247.30**. That equals the sum of every fill to the cent, and the two parts above (-11.14 and -236.16).
- About 4.90 dollars of fees still to post.
- **The loss stop was never close.** The lowest equity was 18,820.02 at 2:12 PM, 247.74 below the start, against a 500 dollar limit.
- **Requests:** 18 to 128 a minute through the session (56 or more from 8:46 on), 0 rate-limit answers, 0 held back by the governor.
  - The day's lowest remaining stock, 171, came between 9:05 and 9:10. That was likely three remainder sales within 30 seconds (9:06:20, 9:06:29, 9:06:49). Inferred: the governor logs only the running low.
- **The order sync's paging (Wednesday's 4.3, again).**
  - ADT's 7 shares were held from 9:33 AM to the close, so every 10 second sync read every order since 9:33: about 2,600 entries, 6 pages, by 2:00 PM.
  - From 2:05 to 2:50 PM, with no entries, requests ran at 65 to 78 a minute. Before the open they ran at 32 to 40.

**Release A in action:**
- **Fix 1, shares left without a stop after a partial take-profit.**
  - 1,100 brackets had their stop cancelled by Alpaca at a partial take-profit, none of them in the window (1 share cannot partly fill).
  - In 999 the take-profit finished on its own: 216 within 1 second, 963 within 5 seconds, the slowest after 14.6 seconds.
  - Release A sold the other **101**. Each posted "Alpaca cancelled its stop when the take-profit partly filled, so I sold the remaining N shares" in `alerts`.
  - From the stop's cancel to the sale being sent: median 10.1 seconds, 6.5 to 21.7. That is the 5 second grace, then the next 10 second sync, then the sale.
  - From the cancel to the sale's fill: median 12.1 seconds, slowest **24.8**.
  - 249 shares, worth about 2,867 dollars; the largest was 58.16.
  - The sales came out 13.97 dollars better than the stops those shares had lost, and 0.69 above their entry prices.
  - **The longest time any shares went without a stop all day was 24.8 seconds.** Wednesday's was 6 hours 10 minutes (CIFR).
- **Fixes 2 and 3, the close-out. Flat, no NOT FLAT, no Healthchecks failure, one "Close-out done".** Timeline (M measured, I inferred):

| Time | What | |
| :-- | :-- | :-- |
| 9:33:35.0 | ADT entry, 7 shares at 9.88 (take-profit 9.90, stop 9.84). Neither was reached all day; both stayed live | M, Alpaca |
| 2:55:03.650 | close-out starts: cancel requests sent | M, run log |
| 2:55:03.685 | ADT's stop cancelled | M, Alpaca leg |
| 2:55:03.723 | cancel answered | M, run log |
| 2:55:11.248 | ADT's take-profit cancel completes, 7.6 seconds after it was asked for | M, Alpaca leg |
| 2:55:13.906 | market sell, 7 ADT, received by Alpaca (the worker logged 13.944) | M, Alpaca and run log |
| 2:55:26.508 | Alpaca paper submits the sell, 12.6 seconds after receiving it | M, Alpaca |
| 2:55:31.016 and 34.055 | ADT fills 5 and 2 at 9.88. **The account is flat** | M, fills |
| 2:55:35.958 | close-out result: flat, path "close-out", waited 20.8 seconds on its own sell, no errors | M, run log |
| 2:55:36.163 | `trading`: "Close-out done: the account is flat." (the only one) | M, Discord |
| 2:55:36.3 | not-flat flag saved off; the close-out step recorded | M, database |
| 2:55:45.377 | ADT's entry record closed by the order sync | M, database |

  - Healthchecks: every ping succeeded (2:54:33, 2:55:08, 2:55:45, 2:56:18). The check never went down all day.
  - Without fix 2 this would have been Wednesday again (inferred). The old 4 round budget ends about 30 seconds in, around 2:55:34. That is just as the sell finished filling, after 12.6 seconds of Alpaca paper holding it.
- **Fix 4, lookups by id.** Alpaca's listing again left out orders: 23 entries and at least one remainder sale (see 4.5). The summary still counted all 4,055 entries, and its result matches the account.
- **Fix 5, logging.**
  - "Too close to the close" refusals are now counted into rows (2,458 in 53 rows; Wednesday 2,209 rows).
  - The close-out logged its path and its cancel and sell times (above).

**The daily summary against the account: it matches.**
- -247.30 from closed trades = equity -247.30.
- 4,055 entries sent and filled = Alpaca's 4,055.
- The window line (378 take-profits, 508 stops, -11.14) and the rest line (1,565, 1,502, 102 closed later, -245.41 on those) match my counts exactly.
- Flat, stop flag off.

Three wording notes, none affecting the numbers:
- "entry orders sent" leaves out the 166 orders Alpaca refused;
- "won" and "lost" leave out the 78 break-even trades (1,916 + 2,061 = 3,977);
- "0 changed (10 then sold at the take-profit)" reads as if the time limit caused those 10 sales.

### 4. What did not behave as designed

**4.1 The 1 cent take-profit is often refused, and each refusal costs the symbol a minute.** This is the main reason the window reached 59 a minute rather than about 90. The release B proposal and the replay did not foresee it. Every refusal was clean: logged, nothing sent twice, nothing left unprotected.

**4.2 The 60 second time limit cannot work as built.** Alpaca refuses a take-profit at or below the bracket's stop, and the new price always was. Review note 3 had flagged this as untested. Michael's guard made it harmless.

**4.3 About 115 stored entries closed 2 to 21 seconds after their exit fill, in bursts, outside the window.** The cause is not measured (see 2). On a busy normal day this would hold a symbol back by up to that long.

**4.4 One long-held position still makes every order sync read the day from its entry time** (ADT from 9:33, about 2,600 entries a sync by 2:00 PM). This is Wednesday's 4.3. About 30 extra requests a minute in the afternoon, and more CPU.

**4.5 Alpaca's order listing still leaves orders out.**
- 23 of the 4,055 entries were missing from the "all orders" listing. Release A's lookups found them, and the summary was right.
- The remainder sale that sold RIVN's last share at 10:11:56 is missing too. Fetched by its id, it is there and filled.
- The cause is still unknown. The stack's safety checks read positions, not the listing, so the missing sale did no harm.

**4.6 Smaller items:**
- The order stream's first status, "authenticating", is logged at warning level. It went live 128 ms later.
- CPU grows with the day's order count (see 2).
- The summary's three wording notes (see 3).

### 5. Proposed: one speed release for all days (under the standing rule: no code until Michael approves)

**The idea:** act on events: Alpaca's live order updates and the price stream. Timers stay only as backstops, each sized by the request budget. Every value below comes from today's measurements unless marked as an estimate. Everything here is money-touching except the logging.

| Item | Today | Proposed | Data behind it | Requests a minute |
| :-- | :-- | :-- | :-- | :-- |
| 1. Freeing a symbol | Live updates on load days only; normal days wait for the 30 second sync | Live updates every day, Armed to the close. The gate frees the symbol in memory at the update; the stored entry is written after, without the gate waiting on it. The sync stays the record of truth | 3,952 of 4,055 freed by updates, typical 47 ms; window always under 2.05 s; about 115 waited 2 to 21 s behind the database close; 0 reconnects all day | 0 (the stream is not a request) |
| 2. Load-day time limit | 60 s; lowers the take-profit 5 cents under the last price: 19 tried, 19 refused | **Recommended: remove it.** Alternative: keep 60 s, one try, Michael's guard unchanged, but lower the take-profit only to 1 cent above the stop | Alpaca: "take_profit.limit_price must be > stop_loss.stop_price". 22 of 886 window holds passed 60 s (2.5 percent), so the gain is small. The alternative is untested: at entry Alpaca also requires a take-profit at least 1 cent above its own current price (140 refusals today). If it applies that check to a change too, any price low enough to sell at once is refused, and the alternative frees nothing (harmless under the guard) | about 2 with the alternative (1 position check plus the change, about 1 a minute); 0 if removed |
| 3. Normal-day order check (the sync) | 30 s on normal days; 10 s on load days. Each sync reads every order since the oldest open entry (6 pages by 2:00 PM today) | **10 s on every day**, reading only the last 10 minutes of orders (1 page). Any open entry older than that is looked up by id (release A's lookup) | With events doing the fast work, the sync is the backstop for a dropped stream and the record of truth. Today it closed only 103 records. Afternoon routine requests 65 to 78 a minute with no entries, against 32 to 40 before the open. The 30 s value was not exercised today | 12 (1 page plus positions, 6 times a minute), against today's 12 plus up to 36 of paging |
| 4. The stop gap after a partial take-profit | Seen at the next sync (10 s load, 30 s normal), then a 5 s grace from Alpaca's cancel. Today: sale sent 6.5 to 21.7 s after the cancel, filled by 24.8 s | Triggered by the live update of the stop's cancel, then **5 s grace**. The sync stays the backstop | Of 1,100 stop cancels at a partial take-profit, the take-profit finished on its own within 1 s in 216, 3 s in 827, 5 s in 963, 10 s in 995, 15 s in 999. With 5 s from the event: about 137 sales a day instead of 101, and the longest gap about 7 s instead of 25 (estimate: 5 s plus a measured fill of about 2 s). With 3 s: about 273 sales, gap about 5 s | 0 to detect. Each sale costs about 15 to 25 (Wednesday's estimate, not measured today). At 100 entries a minute (the load window, 1 share) there are none; on a normal day about 1 sale every 3 minutes on average, at most 3 in a minute today |
| 5. Loss stop | Reads the account every 5 s (12 a minute), plus budgeted retries | Estimated equity on every price print: cash plus held shares (from the live updates' `position_qty`) times the last print. A cross of the limit triggers one account read at once, and the sale if the read confirms it. The **account read every 15 s** stays as the backstop and keeps the cash figure current. First a shadow day: log the estimate beside each account read, before the estimate may trigger anything | Today's lowest equity was 247.74 below the start (limit 500), so the loss stop did not run. Tuesday's overshoot came from 5 s between checks during a fast fall. How far the free feed's price is from Alpaca's own price is not measured; the shadow day measures it | 4 plus 1 per trigger, against 12 |
| 6. Loss stop ahead of remainder sales | One sale at a time; a loss stop waits behind a remainder sale (release A review: up to about 20 s) | The loss stop's sale goes first. A remainder sale under way is dropped at its next step; the loss stop sells those shares anyway | 101 remainder sales today, each holding the sale queue for about 2 to 15 s after it was sent | 0 |
| 7. The gate's wait after Alpaca refuses a symbol | 60 s | **10 s** on load days (normal days unchanged). A guess, not a measurement | Refusals depend on Alpaca's price at that moment. How fast that changes was not measured today; the next load day measures it as the share of tries after the wait that Alpaca refuses again. The 60 s wait covered 34 percent of window symbol time. Each refused order costs a request and a slot under the 100 ceiling, so a shorter wait lets more refused orders through | At today's 15 percent refusal rate, about 15 of every 100 orders would be refused, inside the 100 ceiling |
| 8. Account and positions read (the gate's cached view) | Every 5 s (about 24 a minute) | **Every 15 s.** Positions come from the live updates in between | The stream was live all day with 0 reconnects and 47,704 updates. The sync and the 15 s read correct any drift | 8, against 24 |
| 9. The sale routine's waits (close-out and remainder sales) | Polls every 6 s round, and every 2 s for the close-out's own sells | End the wait at the live update of the cancel or the fill; the polls stay as the backstop | Today's close-out sent its sell 2.7 s after ADT's take-profit cancel completed (11.248 to 13.906); an event would cut that to well under a second (estimate). The 7.6 s cancel and Alpaca paper holding the sell 12.6 s are Alpaca's and do not change | fewer polls: the close-out minute ran 110 against about 70 routine |
| 10. Logging only | Free times kept as a median; raw updates not logged | Log each free's time (slowest per minute in the statistics); one raw update per minute; per-minute statistics all session; the database close time of each free | Turns 2's guesses (the bursts, the share count) into measurements | 0 |

**Left as they are, with why:**
- The 5 second worker pass: entries already react to each print. The pass drives the backstops above.
- The normal day's 15 second cooldown and exits: these are the placeholder strategy's rules, not request costs.
- The 20 second close-out retry, which runs only after a failure.
- The stream's reconnect waits (2 to 30 seconds); there were no reconnects today.
- Discord command reads: they cost no Alpaca requests.

**One setting that is not a timer but decides whether item 7 works: the window's take-profit distance.**
- At 1 cent, Alpaca refused 13 percent of the window's take-profits; at 3 cents (Wednesday's window), none of 383 (and 3 of 1,643 later that day, 0.2 percent). 2 cents is untested, and should fall between.
- With refusals at 15 percent, the 100 orders a minute ceiling allows only about 85 accepted entries, under the pass rule's 90.
- So Michael chooses between:
  - **(a)** keep 1 cent, with item 7's 10 second wait (estimate: about 85 accepted a minute at most);
  - **(b)** 2 cents in the window (fewer refusals, slightly longer holds; untested).
- Changing the exit is a strategy change in the window that Michael approved, so it is his call. I have no recommendation without a measurement; Friday or the next load day would give one.

**Request math at 100 entries a minute (the load window, proposed against today's measurement):**

| Work | Today (the total is measured; the parts are the design figures that add up to it) | Proposed (estimate) |
| :-- | --: | --: |
| Entries (bracket included; refused orders inside the 100) | 100 | 100 |
| Account and positions (the gate's view) | 24 | 8 |
| Loss stop account reads | 12 | 4, plus 1 per trigger |
| Settings | 2 | 2 |
| Order sync | 12, plus up to 36 of paging later in the day | 12 |
| Time limit | about 2 | 0 if removed (about 2 with the alternative) |
| Remainder sales (none at 1 share) | 0 | 0 |
| Live order updates and the price stream | 0 | 0 |
| **Total** | **about 145 early, about 165 later in the day** | **about 126 to 128** |

- The proposal frees about 20 to 40 requests a minute of headroom under 200, and the governor's 80 reserve.
- On a normal day (at most 43 entries a minute today) the same settings use about 70.
- What it cannot change: Alpaca paper's own delays (cancels of 7 to 11 seconds, sells held 12 to 16 seconds at the close-out) and the 100 ceiling.

**What this release would change on a normal day:**
- symbols freed in about 50 ms instead of up to 30 seconds;
- a bare remainder sold about 5 seconds after its stop goes, instead of 5 to 35;
- the loss stop reacting to each print instead of every 5 seconds (after the shadow day);
- about half the routine requests.
- The placeholder's own rules (cooldown, exits, sizes) are unchanged.

**For Michael to decide:**
1. Items 1 to 10, or a subset. Each is money-touching except 10. Each gets a test that fails without it, a normal-day test, the secret scan, the full suite and one build-reviewer round. Deploys happen outside market hours.
2. Item 2: remove the time limit (recommended), or lower it to 1 cent above the stop (untested, may be refused the same way).
3. Item 4: a 5 second grace (recommended) or 3 seconds.
4. The window's take-profit: 1 cent or 2 cents.
5. Whether the next load day waits for this release.

Paper only. Everything here is research input for a human decision, never an instruction to act.

## Michael's decisions for the speed release (2026-11-05, evening)

Build now; no proposal step; choices reported here.
1. Scope: all 10 items of "Thursday 2026-11-05 session review", section 5, plus the Discord changes in point 6. Events first (live order updates, the price stream); timers only as backstops sized by the request budget; every interval set from Thursday's measurements.
2. Remove the load-day 60 second time limit.
3. Stop-gap wait: sell shares left without a stop 3 seconds after Alpaca cancels the stop. Measure and report daily how many of those sold shares would have filled at their take-profit within the next 5 seconds, and the dollars gained or lost versus waiting.
4. Load-day entries become limit orders at or below the price seen, with the take-profit set from that price. Replay Thursday's prints to choose the take-profit width (1 to 5 cents, at least 1, 2, 3 and 5 tested) and how long an unfilled entry waits before it is cancelled (1 to 5 seconds). Record the replay table. Both become load-day settings.
5. Cut the 60 second wait after a refused entry to a short backoff justified from the data (seconds, not a minute). The 100 a minute ceiling stays and still counts refused orders.
6. Discord, quieter: one limits post; one consolidated reply per message (one short line per command, then the full list once); routine confirmations on one line; alerts kept full and loud; the footer only where it applies. Fold in the wording backlog (resume while over the loss limit, no "sold everything" when already flat, Armed text after a load off, the duplicate part of split posts, fewer "Research input" lines). Before and after of the main messages in this log.

Review: two build-reviewer groups (1: all money-touching code; 2: messaging only), up to two rounds each, pre-approved. A messaging finding does not block the money changes. Deploy outside market hours, no later than 7:30 AM Central Friday, as one release, only if group 1 passes; if only group 2 fails, deploy without the messaging changes. Standing rule: no change to money-touching code beyond this list without asking.

## Speed release, money-touching part (built 2026-11-05, evening; commit `e558b82` on branch `speed-release`; group 1 review)

Everything here is paper only, and research input for a human decision, never an instruction to act.

### The replay that chose the load-day settings (decision 4) and the backoff (decision 5)

Read only, on Thursday's own data: the 886 accepted window entries, their fills, and the free feed's 30,892 prints for the 30 symbols from 8:44 to 9:06 AM (pulled from Alpaca's market data, 4 requests). Scripts and the full tables: the session's scratchpad, `replay/replay-report.md` (not in the repo). "Measured" is read from Thursday's data; "estimate" is a replay result; "guess" is an assumption nothing measured.

**Why limit entries remove Thursday's refusals (documentation, not yet measured on paper).** Alpaca's "Orders at Alpaca" page (docs.alpaca.markets/docs/orders-at-alpaca, read 2026-11-05): the base price the exits are checked against "is the limit price of the entry order, for bracket or OTO orders if the entry type is limit", and the current market price for a market entry. An Alpaca staff forum answer (2023-10-25) says the same for the take-profit rule. So a limit entry at L, take-profit L + 1 cent, stop L - 2 cents always passes both checks. Friday's first window orders measure it.

**Calibration (measured).** Paper took a median 1.41 seconds from decision to fill on Thursday (10th percentile 0.67, 90th 2.33). A limit at the print rounded down would have filled at the moment paper filled the market order in 334 of 886 cases (37.7 percent). Paper's prices sit within about a cent of the free feed's prints either way, so the replay runs three fill models (touch, middle, through) and uses the middle one as the central estimate. Run on Thursday's actual design, the replay gave 892 accepted against 886 measured, 59.5 a minute against 59, and -11.46 dollars against -11.14.

**The grid (estimate, middle model, trades limit 100, 0 refusals under limit entries):**

| Take-profit | Wait | Filled a minute | Cancels a minute | Requests a minute, average / busiest | Take-profits / stops | Hold median (s) | Dollars per filled entry |
| --: | --: | --: | --: | --: | --: | --: | --: |
| 1 c | 1 s | 11.2 | 88.8 | 234 / 239 | 89 / 78 | 5.6 | -0.0041 |
| 1 c | 2 s | 31.7 | 68.3 | 213 / 224 | 212 / 262 | 4.8 | -0.0072 |
| 1 c | 3 s | 39.7 | 60.3 | 205 / 222 | 273 / 321 | 4.6 | -0.0071 |
| 1 c | 5 s | **52.5** | **47.5** | **193 / 206** | 346 / 440 | 4.4 | -0.0082 |
| 2 c | 5 s | 53.8 | 45.5 | 189 / 204 | 255 / 551 | 6.1 | -0.0090 |
| 3 c | 5 s | 51.8 | 44.1 | 185 / 199 | 202 / 574 | 7.1 | -0.0087 |
| 5 c | 2 s | 33.2 | 64.9 | 208 / 215 | 81 / 416 | 9.9 | -0.0101 |
| 5 c | 5 s | 45.3 | 35.6 | 161 / 194 | 117 / 561 | 9.1 | -0.0099 |

(All 25 combinations, and the touch and through bands, are in the replay report.) Every combination reaches the 100 orders a minute ceiling in every minute: 30 symbols could each signal about once a second, so the ceiling binds, not refusals.

**Choices:**
- **Take-profit 1 cent.** At every wait it gives the most filled entries a minute, the shortest holds and the lowest cost per filled entry. Wider take-profits mostly end at the stop (at 5 seconds, take-profits to stops go from 346 / 440 at 1 cent to 117 / 561 at 5 cents).
- **Wait 5 seconds** before an unfilled entry is cancelled. Paper's own fill delay (median 1.4 seconds) means a 1 or 2 second wait cancels most orders before paper has looked at them. Longer waits buy more fills per order slot and fewer cancel requests.
- **Backoff after a refusal: 3 seconds, doubling for each further refusal of the same symbol within 60 seconds, capped at 30 seconds** (3, 6, 12, 24, 30). Measured: the free feed changed a symbol's price a median every 1.5 seconds; an order 2 to 5 seconds after a "price above the print" order was no likelier to meet it again (30 percent) than any other (45 percent base rate); the order after a refusal (about 62 seconds later on Thursday) was refused 16 percent of the time, the same as overall. Under 2 seconds is not measured. The cap is a judgement: a symbol that keeps being refused spends at most 5 orders in its first minute and about 2 a minute after. Applied on every day: Michael's decision 5 has no load-day qualifier (the proposal's item 7 had one); normal days had 10 refusals in 3,179 orders on Thursday, and the normal placeholder has its own 15 second cooldown.

**For Michael: requests at `trades 100` (estimate).** Each unfilled entry costs a cancel request (about 48 a minute at 1 cent and 5 seconds). The middle estimate is about 193 requests a minute on average (busiest minute 206); touch 172, through 209. At `trades 80`: 163 (busiest 176), about 42 filled entries a minute. The governor keeps the last 80 of Alpaca's 200 for safety work and holds entries back there, so the stack slows itself rather than hitting Alpaca's limit; that is the zone a load day is meant to probe. The trades limit is Michael's to approve each evening; nothing in code changes for it.

**For Michael: the pass rule.** Orders accepted now reach the 100 ceiling in every minute in the replay, but filled entries do not reach 90 in any minute (best middle estimate about 54 a minute, busiest minute 66). Whether "about 90 entries a minute" means accepted orders or filled entries decides whether a load day can pass.

### What changed, item by item

| Item | Change | Files |
| :-- | :-- | :-- |
| 1. Freeing a symbol | Live order updates every day, Armed to the close. A close is written to memory at once and to the database after (`updateOrderSoon`); a failed write is retried every pass. The handler also closes an entry of ours that never filled when Alpaca reports it cancelled or expired, sets the gate's positions from each fill's share count, and reports a stop cancelled at a partial take-profit. | `worker.ts`, `order-stream.ts`, `caching-store.ts`, `store.ts` |
| 2. Time limit | Removed: the module, the sell gate's price change, the broker call, the settings and the summary line. Nothing in the code can change an order's price now. | `time-limit.ts` (deleted), `sells.ts`, `alpaca-trading.ts`, `broker.ts`, `load-mode.ts`, `summary.ts` |
| 3. The order sync | Every 10 seconds on every day. With the live updates connected: orders of the last 10 minutes only (at most 3 pages); open entries older than that looked up by id, at most 4 a sync, each at most every 30 seconds (as often as the normal-day sync read it before). With them not connected: everything since the oldest open entry, as in v9. | `risk.ts`, `worker.ts` |
| 4. The stop gap (decision 3) | Grace 3 seconds from Alpaca's cancel. The live update of the stop's cancel (only when the take-profit has partly filled) starts a timer for cancel + 3 seconds + a quarter second; the sync runs then and sells the rest. The sync's own "come back at the grace time" uses the same timer (before, it waited for the next 5 second pass). The 10 second sync stays the backstop. | `risk.ts`, `order-stream.ts`, `worker.ts` |
| 4. Its daily measurement | For each such sale: did the take-profit price print within the next 5 seconds (the free feed), and dollars against waiting 5 seconds (take-profit price if it printed, else the last print at +5 seconds), from the sale's fill on the live updates. Saved per day; one line in the summary, labelled an estimate. Watches only. | `stop-gap.ts`, `summary.ts`, `worker.ts` |
| 5. Loss stop | **Shadow only this release**, as the proposal said ("first a shadow day"). The account is still read every 5 seconds: the proposal's 15 second backstop belongs with the trigger, and going to 15 seconds now would weaken the loss stop. The stack's own estimate (cash plus each position at the last print) is logged beside Alpaca's equity in the per-minute statistics. | `risk.ts`, `worker.ts` |
| 6. Loss stop first | The loss stop's sale is marked priority. A remainder sale (or a no-exit sale) that is running or waiting stops at its next step and steps aside; the loss stop's whole-account sale sells those shares too. No false "could not sell" alert for a sale that stepped aside. | `sells.ts`, `risk.ts` |
| 7. Refusal wait (decision 5) | 3 seconds, doubling to 30 (above), from the stored refusals. Refused orders still count against the 100 a minute ceiling. | `gate.ts` |
| 8. The gate's view | Account and positions every 10 seconds while the live updates are connected, every 5 seconds while not. 10, not the proposal's 15: the gate refreshes a view older than 15 seconds inside the order path, and passes run every 5 seconds, so 15 would cost latency and requests; the gate itself is untouched. A read that started before a live update cannot undo it. The refresh goes by the view's own age, so a read earlier in the pass is not repeated. | `worker.ts`, `broker-view.ts` |
| 9. Sale waits | The liquidator's wait for cancels and the close-out's wait for its own sells end at a live update for those symbols (at most 20 early wake-ups a wait); the timed looks stay as the backstop. | `sells.ts`, `closeout.ts`, `worker.ts` |
| 10. Logging | Per-minute statistics all session: requests, stream counters, frees this minute (count, median, slowest), database close times, entry-wait counts, the shadow loss-stop difference, one raw update a minute. | `worker.ts`, `order-stream.ts` |
| Decision 4 | Load window only: 1-share limit buy at the print rounded down to the cent, take-profit 1 cent above and stop 2 cents below that limit, cancelled 5 seconds after Alpaca accepted it unless its fill has arrived (`entry-expiry.ts`; a cancel that meets a fill is refused by Alpaca and the position keeps both exits). The normal placeholder (normal days, and a load day after 9:00) stays market orders: a multi-share limit entry could partly fill and be cancelled. Both settings are constants in `load-mode.ts` and appear in the Armed message and the summary. | `strategy.ts`, `load-mode.ts`, `gate.ts`, `alpaca-trading.ts`, `entry-expiry.ts` |

**Request math at 100 orders a minute in the window (estimate, updated for what was built):** entries 100; cancels of unfilled entries about 48 (replay); account and positions 12; the loss stop's account read 12 (unchanged, shadow day); settings and clock about 4; the sync about 6 to 18 (1 to 3 pages, plus positions); old-entry lookups about 0 in the window. About 180 to 195 a minute. On a normal day (at most 43 entries a minute on Thursday): about 90.

### Tests

390 pass (377 before; the 7 time-limit tests were removed, 20 added in `test/speed-release.test.ts`, others updated for the new behaviour). Type check clean. Each change was taken out on its own and a test failed every time (23 of 23 caught, after tightening three tests that first let a change through):

| Change taken out | Test that fails |
| :-- | :-- |
| live updates on a normal day | a normal day: the live order updates connect |
| close in memory first | item 1: the caching store |
| a cancelled unfilled entry frees its symbol | item 1: a cancelled unfilled entry |
| the 10 minute window | item 3 |
| 3 second grace; the cancel update's timer; the sync's own timer; only a partial take-profit | release A fix 1 worker level; decision 3 worker; decision 3 handler |
| the loss stop's sale first | item 6: a remainder sale |
| 3 second backoff; the 30 second cap | decision 5 (both) |
| the overlay; the 10 second view | item 8 (both) |
| waits end at the event | item 9 |
| limit entries (strategy, client body, gate) | decision 4 (three tests) |
| the wait skips filled entries; 1-share only | decision 4 worker; entry wait |
| statistics every minute | request statistics every minute |
| the shadow hand-off | item 5 |
| the stop-gap value; the summary line | decision 3 measurement |

**Untested on paper until the next session:** Alpaca accepting a limit bracket with a 1 cent take-profit (documentation says yes); paper's fill delay for limit orders (assumed equal to the market orders'); how long paper takes to cancel an unfilled entry (guess 0.3 seconds, barely matters); whether the cancel updates and the stop-cancel updates arrive in the order the handler expects (if not, the 10 second sync is the backstop); the database close times (now logged).

### Group 1 review, round 1 (2026-11-05, evening): CHANGES REQUIRED. Fixed in `f8b30a7`.

Nothing under paper only, secrets or hard stops. Three blocking findings, each fixed in the cautious direction, with a test from the reviewer's own probe:
1. **An entry older than the sync's 10 minute read was not looked up by the sync the stop-cancel timer ran**, so its remainder sold about 34.5 seconds after the cancel instead of 3. And with many older entries the 4-a-sync lookup budget could check one only every 50 to 80 seconds (v9: 30 on a normal day, 10 on a load day). **Fix:** an exit leg reported cancelled, expired or rejected on the live updates makes its entry a must-look on the next sync, outside the budget; the budget is now enough to look up every older entry at least every 30 seconds. With the live updates down the sync reads everything, as v9.
2. **The early wake-up had replaced the liquidator's half-second pause after its cancels** (added in an earlier review because Alpaca's open list may not show a filled entry's exits). In the reviewer's probe a three-position loss stop sale then sold nothing. After 20 early wake-ups the pauses also still counted as full. **Fix:** the half second is a plain pause again; after the cap, plain pauses. Early wake-ups only shorten the later polls.
3. **The 3 second backoff applied on normal days too**; the proposal's item 7 said normal days unchanged, and decision 5 named no days. **Fix:** load days only; a normal day keeps the minute. Michael can extend it to every day.

Notes taken up: the raw update sample keeps only chosen fields; retried database writes run one at a time. Notes for Michael (not changed): at `trades 100` the governor, not the 100 ceiling, will limit entries in the window (about 60 a minute, estimate), so the 90 a minute pass mark is probably out of reach; the entry wait assumes Alpaca refuses a cancel of a filled bracket entry and leaves its exits alone (untested on paper; the 10 second sync's missing-exit check is the backstop); a restart inside the 5 seconds loses that entry's timer (the limit stays working until it fills or the close-out). The reviewer confirmed the memory-first close is safe in one direction only (an unwritten close can only make the gate refuse).

394 tests pass; 28 of 28 changes caught when taken out.

### Group 1 review, round 2 (2026-11-05, evening, the last round allowed): STOP AND FLAG MICHAEL. Nothing deployed; Fly stays on v9.

Nothing under paper only, secrets or hard stops. Fixes 2 and 3 of round 1 confirmed. **One blocking finding left: round 1's finding 1 was only partly fixed.** When a regular 10 second sync lands inside the 3 second grace (about 1 in 3 such cancels, estimated from the timing), it looked up an entry older than the 10 minute read as a must-look, cleared that mark, and stamped its 30 second lookup time; the grace-time sync then could not see the entry, and the 7 shares sold 36.5 seconds after the cancel (reviewer's probe; control without the regular sync: 3.8 seconds). The reviewer's context for Michael: v9's normal day sells such shares 5 to 35 seconds after the cancel for every entry, so the release is no worse than v9 on this point; it misses decision 3 only for older entries in this timing.

Re-walk found nothing else: the gate (stop flag and commands block before the new checks, read again before sending), the entry wait, the sells (priority and step-aside, no sell beyond shares held), the loss stop (still every 5 seconds; only `priority: true` and the shadow hook), the close-out, the live updates and the cached view. Note: old-entry lookups are not held back by the governor; bounded by the live list (at most about 10 a sync, about 60 a minute, estimate).

**Under Michael's rule ("if group 1 fails after two rounds, deploy nothing; Friday runs normally on v9") nothing is deployed.** The one-line fix (`8ae476e`, risk.ts `syncOrders`: an older entry inside the grace is marked must-look again, so the grace-time sync looks it up) is built and tested (the reviewer's probe as a test, which fails without the line; 395 tests pass) but **not reviewed and not deployed**. It waits for Michael: another review round, or keep v9.

The messaging part (`c43a5e4`, built in a separate worktree) is merged onto the money branch as branch `speed-release-merged` (`be62516`, 407 tests pass) and is in its group 2 review.

### Michael's decision after round 2 (2026-11-05, evening)

Approved a third group 1 round on the one-line fix. If it passes, deploy before 7:30 AM with the messaging (if group 2 passed) and post the "live" line. If round 3 finds anything new and blocking, stop and do not deploy. If round 3's only finding is that the fix is not ready, deploy the release without the fix (that case is no worse than v9), log it, and post the "live" line.

## Speed release, messaging part (group 2; commit `c43a5e4`, merged onto the money branch as `speed-release-merged`, `be62516`)

Built in a separate worktree, so the money review could run at the same time. Messaging only: text, assembly, batching and posting. 407 tests pass on the merged branch (the 395 above plus 12 in `test/messaging.test.ts`, one per behaviour and backlog item).

**Michael's decision 6 supersedes the C2 brief's item 16 ("Keep 'Paper trading only.' on every message") and the project context's "say so in anything it writes" for Discord posts**, by the footer rule below.

### Group 2 review, round 1 (2026-11-05, evening): PASS

Messaging only, confirmed file by file: what stop, flatten, resume, approve, set and load do is unchanged; the gate, the sync's sales, the loss stop's decisions and arming are untouched; alerts that need attention (NOT FLAT, could not sell, loss stop failures, a remainder sale that failed or is not filled yet) still go out one at a time, with the mention where they had one; no em or en dashes. Non-blocking notes, logged for later: only the last part of a split alert carries "Paper trading only." (earlier parts say "continued"); the split-post resume works only for an identical retry; "Alpaca refused N more" also counts the stack's own local refusals; while the live updates are down the digest shows only "N entries sent"; `resume` can hold the command pass up to 3 seconds while it reads the account (bounded; the loss stop has its own timer); a failed post of the batched remainder alert drops that batch (as a failed single alert did before); "nothing was held" could be slightly wrong if the exits closed the positions during the sale.

#### The footer rule

- The evening limits post and the daily summary end with "Paper trading only. Research input for a human decision, never an instruction to act." They are the research input Michael decides on.
- Every message to `alerts`, the live list, and the full morning review or reminder (only posted when something is undecided) end with "Paper trading only." Added at posting for `alerts`, so no alert can miss it.
- One-line confirmations (Armed, Close-out done, worker started, stop, resume), the trade digest and command replies carry no footer.
- Why: before, every one of the 896 messages carried "Paper trading only.", and the research-input line also appeared on the live list, the morning review, the start message and the one-time load note. Every channel is in Michael's private paper-only server, and the footer now marks the messages where it means something.

#### The digest period: 5 minutes

At most 78 lines on a full 6.5 hour session, against 792 messages on Thursday. Three lines cover the 15 minute load window, short enough to watch it, long enough not to buzz the phone. An entry whose outcome at Alpaca is unclear still gets its own message in `commands`, at once.

#### Evening limits post

Before and after: unchanged (full, with the checklist and the research-input line). It is the decision post.

#### Morning review (60 minutes before the open), all four decided

Before (13 lines, repeating the whole evening post):
```
**Good morning. Limits for today, Thursday 2026-11-05 (market opens at 8:30 AM CT): all four are decided.**
1. position: largest single position 500 dollars (decided) [suggested from your approval on 2026-11-04]
2. loss: ...
3. trades: ...
4. cap: ...
5. mode: **LOAD DAY** (cheap list, at most 75 dollars a position, 1 share churn 8:45 AM CT to 9:00 AM CT, then normal)

**Checklist**
- Stop flag: off.
- Account: flat, no open positions.
- Borrowing cap at Alpaca right now: 1, long only. ...
- Price feed: iex ...

Reply here: `approve` accepts every limit ... (four lines of instructions)
Paper trading only. Research input for a human decision, never an instruction to act.
```
After (one line; any checklist line that needs attention, such as the stop flag on or positions held, follows it, one line each; with anything undecided the full post goes out as before, with "Paper trading only."):
```
**Good morning: Friday 2026-11-06**, all four limits decided (largest position 500 dollars, daily loss stop 500 dollars, at most 100 orders a minute (no daily total), borrowing cap 1); mode: **LOAD DAY** (cheap list, at most 75 dollars a position, 1 share churn 8:45 AM CT to 9:00 AM CT, then normal). Armed at 8:25 AM CT, market opens 8:30 AM CT. Change a limit before Armed, or type `limits` for the list.
```
The one-time "Mode for ..." note (for a request posted by a release older than load mode) is no longer posted: the mode is line 5 of every limits list.

#### A several-command reply (`trades 100` / `approve` / `load on`)

Before: each line got its own reply, and the limit and load replies each repeated the five-line list (three lists in one reply).
After:
```
**trades 100**: noted.
**approve**: all four limits accepted.
**load on**: Friday 2026-11-06 will be a **load day**.

**Friday 2026-11-06** (approved):
1. position: largest single position 500 dollars (decided) [suggested from your approval on 2026-11-05]
2. loss: daily loss stop 500 dollars (decided) [suggested from your approval on 2026-11-05]
3. trades: at most 100 orders a minute, no daily total; the ceiling is 100 (decided) [suggested from your approval on 2026-11-05]
4. cap: borrowing cap 1, where 1 means no borrowing (decided) [suggested from your approval on 2026-11-05]
5. mode: **LOAD DAY** (cheap list, at most 75 dollars a position, 1 share churn 8:45 AM CT to 9:00 AM CT, then normal)
All four decided: trading is allowed within these. You can change any of them until the Armed message, 5 minutes before the open.
```
A single command gets the same: `trades 50: noted.` then the list.

#### Armed

Before:
```
Armed for Thursday 2026-11-05: borrowing cap 1 and long only are set at Alpaca; the day starts at 19067.76 dollars of equity. **This is a load day:** at most 75 dollars a position all day; in the load window (no entries before it) 1 share a trade, any new print, exits 1 cent up and 2 down, symbols freed by Alpaca's live order updates, a 60 second time limit; then the normal placeholder.
Paper trading only.
```
After (load day):
```
Armed for Friday 2026-11-06: cap 1, long only, the day starts at 18820.46 dollars. **Load day:** at most 75 dollars a position all day; in the load window, 8:45 AM CT to 9:00 AM CT (no entries before it), 1 share a trade on any new print, a limit buy at or below the price seen, cancelled if not filled in 5 seconds, take-profit 1 cent up and stop 2 cents down from that price; then the normal placeholder.
```
After a `load off` (wording backlog: before, it still described the window as running):
```
Armed for Friday 2026-11-06: cap 1, long only, the day starts at 18820.46 dollars. Load window switched off: the normal placeholder all day, still at most 75 dollars a position.
```

#### A digest period

Before (one message every 20 seconds, up to 60 lines each, 792 messages on Thursday):
```
8:45:00 AM BUY 1 AAL at about 13.36, target 13.37, stop 13.34 (both held at Alpaca), accepted in 196 ms
8:45:00 AM BUY 1 SMCI at about 27.66, target 27.67, stop 27.64 (both held at Alpaca), accepted in 417 ms
8:45:00 AM F: Alpaca refused the entry and it was not retried: Alpaca POST /v2/orders answered 422: take_profit.limit_price must be >= base_price + 0.01
...
Paper trading only.
```
After (one line per 5 minutes; the fills, cancels and exits come from Alpaca's live order updates):
```
8:45 AM CT to 8:50 AM CT: 312 entries sent, 290 filled, 22 unfilled and cancelled, 140 take-profits, 147 stops.
```

#### Remainder sales (shares left without a stop after a partial take-profit)

Before (one alert each, 101 on Thursday):
```
**WULF: Alpaca cancelled its stop when the take-profit partly filled, so I sold the remaining 3 shares.**
Paper trading only.
```
After (still in `alerts`, full, with the footer, but at most one a minute; a sale that fails, or is sent but not filled yet, is still posted on its own at once, as before):
```
**Sold 3 remainders left without a stop** (Alpaca cancelled the stop when the take-profit partly filled): WULF 3, IREN 2, CIFR 7.
Paper trading only.
```

#### Daily loss stop when the account was already flat

Before: `**Daily loss stop reached** (down 535.15 of the 500 dollar limit). Stopped for the day and sold everything.`
After: `**Daily loss stop reached** (down 535.15 of the 500 dollar limit). Stopped for the day and nothing was held, so nothing needed selling.`

#### `resume` while today's loss is still past the limit

Before: `Stop cleared. New entries still need today's limits approved before the open.` (then the loss stop put the stop back 16 seconds later, on 2026-11-03)
After (what `resume` does is unchanged: it still clears the flag; a 3 second look at the account decides only the wording, and a failed look gives the plain reply):
```
Stop cleared, but today's loss (535.15 dollars) is still past the 500 dollar daily limit, so the daily loss stop will put the stop back on within about 5 seconds, and it stays on until the next trading day.
```
Otherwise: `Stop cleared. Entries still need the day's limits approved.`

#### Close-out done

Before: `Close-out done: the account is flat.` + `Paper trading only.`
After: `Close-out done: the account is flat.` (one line, no footer)

#### Worker started

Before:
```
Stack C worker started at 7:08 PM CT (paper trading only). New release 01KABCDE (it was 01KXYZ12), so this is a deploy. Starts in the last hour: 1. Type `help` for commands. Research input for a human decision, never an instruction to act.
Paper trading only.
```
After:
```
Worker started at 6:12 PM CT (paper): new release e5f6a7b8 (was a1b2c3d4): a deploy. Starts in the last hour: 1.
```

#### Daily summary, head

Before:
```
**Daily summary for 2026-11-05**
Limits: ...
Trades: 4055 entry orders sent (4055 filled), 4156 sells filled. Closed trades: 1916 won, 2061 lost.
...
Paper trading only.
```
After (the refused orders are named, break-even trades are counted, no time-limit line, and it ends with the research-input line):
```
**Daily summary for 2026-11-05**
Limits: ...
Trades: 4055 entry orders sent (4055 filled); Alpaca refused 166 more, 4156 sells filled. Closed trades: 1916 won, 2061 lost, 78 broke even.
...
Paper trading only. Research input for a human decision, never an instruction to act.
```

#### A long post that fails part way (wording backlog)

Before: a post split into several messages whose later part failed was retried whole, so its first parts appeared twice. After: the bot remembers how many parts went out (for 10 minutes) and the retry sends only the rest.

### Group 1 review, round 3 (2026-11-05, evening, approved by Michael): PASS

Round 2's finding is fixed: an older entry inside its 3 second grace is marked must-look again, so the grace-time sync looks it up. The reviewer deleted the line in a copy and the test failed; with it, the reviewer's probe sold the 7 shares 3.5 seconds after the cancel (round 2: 36.5). Nothing new and blocking in a re-walk of the whole range. Bounds checked by the reviewer with 170 second probes: no loop (the mark is set only during the 3 seconds), at most one extra lookup per older entry inside its grace, marks dropped once the entry closes, nothing added while a close-out or the loss stop runs. Non-blocking notes: marks of closed entries wait for the next sync with an active entry (harmless); if a must-look lookup itself fails, that entry waits about 30 seconds (no worse than v9); a sale that keeps failing alerts about every 30 seconds (as v9).

### Deploy (2026-11-05, 6:11 PM Central, market closed)

- **What shipped:** `be62516` (branch `speed-release-merged`, now `main`): the money part with all three rounds' fixes (`e558b82`, `f8b30a7`, `8ae476e`, group 1 PASS in round 3) plus the messaging part (`c43a5e4`, group 2 PASS in round 1, reviewed exactly as merged at `be62516`). 407 tests pass.
- `fly deploy --ha=false` from a separate checkout of `be62516` with no key file in it.
- **Fly release v10:** one machine (San Jose), good state. One `worker_started` at 6:11:34 PM ("Starts in the last hour: 1"), no warnings or errors after it.
- Discord, `commands`, 6:11:34 PM (the new one-line form): "Worker started at 6:11 PM CT (paper): new release 1W6WY1C8 (was RXJ6WWNR): a deploy. Starts in the last hour: 1."
- Healthchecks up (last ping 6:11:35 PM).
- **Friday's limits post shows the load switch:** the 3:10 PM request's line 5 reads "5. mode: normal (`load on` makes it a load day)". Friday's record: pending, nothing decided yet. Stop flag off, not-flat flag off.
- **The one Discord line, `commands`:** "Speed release is live (Fly release v10, paper only). Load days now: 1-share limit buys at or below the price seen, take-profit 1 cent up, stop 2 cents down, unfilled entries cancelled after 5 seconds. Approve Friday's limits and type `load on` before 7:45 AM if you want Friday as a load day."

**For Michael before 7:45 AM Friday:** approve the limits (without approval there is no trading Friday) and type `load on` if Friday should be the load day. Note the replay's request estimate before choosing `trades`: about 193 a minute at 100 (the governor will hold entries back near its reserve, about 60 filled entries a minute), about 163 at 80.

**What the next session measures:** whether Alpaca accepts the 1 cent limit brackets (no refusals expected), paper's fill and cancel times for limit entries, the entry wait's cancels, the 3 second remainder sales and their daily stop-gap line, the shadow loss-stop difference, the database close times and the slowest free per minute (all in the per-minute statistics), requests a minute in the window, and the new Discord volume.

Paper only. Everything here is research input for a human decision, never an instruction to act.

## Michael's ruling on the load-day pass rule (2026-11-05, evening; no code changes)

Asked after the speed release, because limit entries split "entries" into two numbers: orders Alpaca accepts, and entries that then fill (the replay: accepted orders reach the 100 ceiling every minute; filled entries about 54 a minute at best). Michael's answer: **a load day passes on accepted orders a minute, the stack's capacity against Alpaca's limit. Filled entries a minute are reported alongside, with a separate note, but they do not decide the verdict.**

**The rule as it now stands** (it replaces the wording of "Load mode proposal", section 8):
- **The 200-a-minute budget does NOT hold if:** Alpaca answers "too many requests" (429) even once; or the remaining stock falls below 80 because of entries and routine work (the governor's reserve was breached, not just reached); or any sell, cancel or close-out request is delayed by a rate limit.
- **It holds if:** at least about 90 **accepted orders** a minute (orders Alpaca accepted, whether or not they then filled) for at least 10 of the 15 minutes of the window, 0 rate-limit answers, lowest stock at or above 80, and a flat close-out.
- **Inconclusive if** accepted orders never get near 90 a minute. Then the review reports the highest rate reached and its request count, and says the 100 level was not tested.
- **Reported alongside, not part of the verdict:** filled entries a minute (per minute and the busiest 60 seconds), with a separate note on why they differ from accepted orders (unfilled limit entries cancelled after 5 seconds, paper's fill delay). Orders Alpaca refused do not count as accepted, but they still count against the 100 a minute ceiling.

Paper only. Research input for a human decision, never an instruction to act.

## Friday 2026-11-06 session review (release v10, third load day; written after the close, read only)

The brief is `builds/friday-review-brief.md` (saved verbatim on Thursday evening). It ran at 3:15 PM Central, after the close-out (2:55 PM), the daily summary (3:05 PM) and Monday's limits post (3:10 PM). Nothing was changed: no code, no deploy, no orders.

Sources, all read only, all on 2026-11-06 after the close:
- **The stack's database**, in one read-only transaction: the day records, every stored entry (3,431), the refusals, the run log (519 events, 388 of them per-minute statistics) and the control values.
- **Alpaca paper:**
  - every order of the day with its exit legs (3,531 listed, plus 71 entries and 4 sales fetched by id, see 5.5);
  - all 9,561 fills, the account, positions, open orders, the one-minute equity history and the posted fees;
  - the free feed's prints for the 7 seconds around each of the 111 sales the stack sent itself (for the stop-gap measurement, see 2).
- **Discord:** the three channels through the bot (172 messages).
- **Healthchecks:** the check's flips and its last 100 pings (back to 2:22 PM).
- **Fly:** releases and status, and the CPU, load and memory metrics.
- **The code** at `be62516`, read to explain three findings (marked "inferred").

Times are Central. "Measured" means read from a timestamp or a counter. "Inferred" means worked out from the code and the measured times. "Estimate" means a calculation that the day did not test.

**State after the close:**
- Fly runs release v10 on one machine (San Jose, 1 shared CPU, 512 MB), started 2026-11-05 6:11 PM. No restarts.
- The account is flat: 0 positions, 0 open orders, equity 18,712.15, borrowing cap 1.
- The stop flag is off. The not-flat flag is off (saved 2:55:29 PM).
- Michael approved the limits at 7:30 AM (position 500, loss 500, trades 100, cap 1) and typed `load on` in the same message. Armed at 8:25:05 AM with the window settings; the order stream went live at 8:25:09.
- Monday's limits request posted at 3:10 PM and waits for Michael. Monday is a normal day unless he types `load on` before 7:45 AM.

### 1. The load window, 8:45 to 9:00 AM: HOLDS. At least 90 accepted orders in 14 of the 15 minutes (100 in 9 of them), 0 rate-limit answers, lowest remaining stock 159, flat close-out.

Against the rule in "Michael's ruling on the load-day pass rule":
- **"Does not hold" needs any one of these. None happened:**
  - Alpaca's rate-limit answer (429): **0** all day.
  - Remaining stock below 80: lowest **159** (from 8:46 on, all day).
  - A sell, cancel or close-out delayed by a rate limit: **none**. There were no rate-limit answers, and the governor never holds back sells, cancels or the close-out. (Some cancels in the first half minute were slow, see "Cancels" below; that was not a rate limit.)
- **"Holds" needs at least about 90 accepted orders a minute for 10 of the 15 minutes, 0 rate-limit answers, lowest stock at or above 80, and a flat close-out.** Accepted orders were 100 in 9 calendar minutes and 94 to 99 in 5 more; only 8:58 fell short (75). The close-out was flat at 2:55:28 (see 4).
- **So the window holds**, at the 100 a minute ceiling. It ran at the ceiling, so it shows the stack carries 100 orders a minute inside Alpaca's limit; it does not show what lies above 100 (raising the ceiling is a hard stop for Michael and is not proposed).

**Orders and requests, minute by minute.**
- Orders: per calendar minute, from the stored entries. Alpaca refused **none** of the window's 1,454 orders, so every order sent was accepted.
- Filled: entries of that minute that then filled (reported alongside, not part of the verdict).
- Requests: the governor's own count for the 60 seconds before the stamp just after that minute (stamps drift 20 to 35 seconds past the minute).

| Minute | Orders sent = accepted | Filled | Cancelled unfilled after 5 s | Governor stamp | Requests in the last minute | Orders in the last minute |
| :-- | --: | --: | --: | :-- | --: | --: |
| (before) | | | | 8:44:20 | 29 | 0 |
| 8:45 | 100 | 34 | 66 | 8:45:20 | 95 | 41 |
| 8:46 | 100 | 51 | 49 | 8:46:20 | 195 | 99 |
| 8:47 | 100 | 47 | 53 | 8:47:25 | 199 | 100 |
| 8:48 | 100 | 58 | 42 | 8:48:30 | 214 | 98 |
| 8:49 | 100 | 52 | 48 | 8:49:30 | 185 | 100 |
| 8:50 | 100 | 45 | 55 | 8:50:30 | 173 | 100 |
| 8:51 | 100 | 63 | 37 | 8:51:30 | **217** | 100 |
| 8:52 | 94 | 56 | 38 | 8:52:30 | 189 | 97 |
| 8:53 | 100 | 48 | 52 | 8:53:35 | 191 | 100 |
| 8:54 | 99 | 67 | 32 | 8:54:35 | 197 | 100 |
| 8:55 | 100 | 50 | 50 | 8:55:35 | 180 | 98 |
| 8:56 | 95 | 41 | 54 | 8:56:35 | 188 | 96 |
| 8:57 | 97 | 43 | 54 | 8:57:35 | 186 | 95 |
| 8:58 | 75 | 44 | 31 | 8:58:35 | 175 | 87 |
| 8:59 | 94 | 50 | 44 | 8:59:35 | 184 | 88 |
| (after) | | | | 9:00:35 | 111 | 50 |
| **Window** | **1,454** | **749** | **705** | | | |

- **Busiest 60 seconds:** 101 orders by their stored times (8:45:00.86 to 8:46:00.78, 59.925 seconds). The governor's own peak is **100**. Inferred: the stored time is taken when the gate builds the record, a few tens of milliseconds away from the moment the governor grants the slot, so the 101 is timestamp offset, not a 101st order inside the governor's minute.
- **The ceiling bound in 12 of the 15 minutes** (8:46 to 8:57). The gate refused 1,145 signals as "trades-per-minute limit reached". The orders came in a burst early in each minute, then paused until the oldest slots aged out (from 8:46 to 8:52 every pause over 3 seconds ended at the turn of a minute).
- **8:58's 75:** no "trades-per-minute" refusals that minute and the most "already holding" refusals of the window (143). Fewer symbols were free (longer holds), so fewer prints became orders. Not the budget.
- **Requests:** 191 a minute on average over the 14 full stamps (173 to 217), against the replay's 193 average and 206 busiest. The governor counted **217 requests in 60 seconds with 0 rate-limit answers and the remaining stock never below 159.** Inferred from that (the counts are measured): Alpaca's 200 a minute refills continuously (a bucket that drains and refills), as Thursday's review also inferred, so more than 200 requests can go through in 60 seconds without a refusal.
- **How often the governor held entries back near the reserve: never (0).** It holds back only when its estimate of Alpaca's remaining stock (the last number Alpaca reported plus the refill since) is down to 80; that estimate never went below 159.

**Filled entries, the separate note (not part of the verdict).**
- 749 of the 1,454 accepted orders filled: **50 a minute on average, 34 to 67 a calendar minute, 74 in the busiest 60 seconds** (to 8:55:08).
- Why fewer than accepted: each entry is a limit buy at or below the price seen; paper filled it after a median 1.5 seconds (10th percentile 0.6, 90th 4.1); 705 had not filled 5 seconds after acceptance and were cancelled.

**Refusals by reason in the window** (counted by the gate):
- already holding this symbol: 1,290;
- trades-per-minute limit reached: **1,145**;
- an entry for this symbol is still working: 1,112;
- load day, entries start at 8:45 (the opening second): 53;
- **Alpaca refused this symbol a moment ago: 0. Brackets Alpaca refused: 0.** Thursday had 156 refusals in the window (140 of them the 1 cent take-profit). **Limit entries ended the 1 cent refusals**, as Alpaca's documentation said they would (the exits are checked against the limit price).
- Held back by the governor: 0.

**Unfilled entries cancelled (the 5 second entry wait):**
- 1,454 scheduled. 726 had filled before their 5 seconds were up and were not touched. 728 cancel requests were sent, 0 failed.
- Of those 728: **705** were cancelled unfilled; **23** filled anyway. In 17 the position kept both exits. In **6, Alpaca cancelled both exits of the just-filled entry**: see 5.1, the most important finding.
- (The entry wait counts Alpaca's "already filled" answer as a cancel, so its "cancelled 728" includes the 23.)
- **Cancels:** Alpaca finished the cancel a median 5.02 seconds after acceptance from 8:46 on (the 5 second wait plus about 20 ms). In the first minute it was slower: 49 of 66 took over 6 seconds, the slowest 11.7 seconds (8:45:11 to 8:45:22). The same 30 orders were slow to be accepted too (below). Not a rate limit (0 answers); the cause is not measured, and paper's handling of the opening burst is the likeliest guess.

**Decision to acceptance, 1,454 accepted:**
- Median 121 ms, mean 172, 95th percentile 298, slowest 3,029, fastest 94.
- Every acceptance over 1 second (21) was one of the first orders, 8:45:01 to 8:45:05, when about 30 symbols signalled at once.
- Thursday: 121, 160, 296 and 1,967 ms.

**Cost: -9.21 dollars on 12,687 dollars bought (0.073 percent; Thursday's window -11.14, 0.082 percent).**
- 749 positions of 1 share, averaging 16.94 dollars.
- 239 closed by take-profit (+3.34 against their entry fills), 503 by stop (-12.49), 7 by other sales (-0.06: the 6 of 5.1 and ADT's one window share, held to the close-out).
- Within that: entries filled below their limit +3.12; stops filled below their stop price -5.23; take-profits filled above their limit +0.71.
- Fees: Thursday's posted fees were REG 4.76 and CAT 0.14, exactly the 4.90 estimated. Friday's estimate is 3.03 dollars (SEC 2.95, CAT 0.08, FINRA TAF 0 while paused); it posts this evening.

**Against the replay that chose the settings** (Thursday's prints, middle model, 1 cent take-profit, 5 second wait):

| | Replay (estimate) | Friday (measured) |
| :-- | --: | --: |
| Accepted orders a minute | 100 (the ceiling) | 97 (100 in 9 minutes) |
| Filled entries a minute | 52.5 | 49.9 |
| Cancelled unfilled a minute | 47.5 | 47.0 |
| Requests a minute, average / busiest | 193 / 206 | 191 / 217 |
| Take-profits / stops | 346 / 440 | 239 / 503 |
| Hold median | 4.4 s | 6.3 s |
| Dollars per filled entry | -0.0082 | -0.0123 |

The replay got the capacity right. It was optimistic on how often the 1 cent take-profit is reached before the 2 cent stop.

**Holds in the window** (entry fill to exit fill, 749): median 6.3 seconds, mean 44.4, 90th percentile 34.2, longest 6 hours 10 minutes (ADT's one share, from 8:45 to the close-out; its take-profit at 9.89 and stop at 9.86 were never reached). Under 1 second 41; 1 to 5 seconds 282; 5 to 10: 155; 10 to 30: 183; 30 to 60: 57; 1 to 2 minutes 20; 2 to 10 minutes 10; over 10 minutes 1.

**Fly in the window** (one shared CPU): 0.9 to 1.6 percent busy before it, rising steadily to a peak of **8.7 percent** at 8:59 (Thursday 9.7), back to 2 to 3 percent by 9:02. CPU credit balance never below 49,590 of 50,000 (no throttling); load average at most 0.45; free memory at least 303 MB of 512.

### 2. The new settings in action

**The refusal backoff (3 seconds, doubling to 30, load days): not exercised.**
- In the window, Alpaca refused nothing, so the backoff never had cause to act.
- After 9:00 (the normal placeholder, market entries) Alpaca refused 13 brackets. Ten were "take_profit.limit_price must be >= base_price + 0.01" and three the matching stop rule, all on low-priced names, where the placeholder's 0.25 percent take-profit rounds to about a cent. On a load day the code gives these the short backoff all day (inferred from `gate.ts`), but the next order for each of those symbols came 15 to 151 seconds later anyway (the placeholder's own pace), and the gate never refused a signal as "refused a moment ago" all day.
- So the backoff has done no harm and no good yet. It needs a day with refusals to be measured.

**Symbols freed by live order updates:**
- 2,713 symbols freed by the stream, **typically 47 ms** after the exit fill (the worker's median from Alpaca's timestamp).
- **The slowest free in any minute all day: 148 ms** (window) and 138 ms (rest of the day). No minute had a free over 1 second. Thursday had about 115 entries closing 2 to 21 seconds late, in bursts.
- The stream closed 2,602 entry records and 705 cancelled unfilled entries. Closes go to memory first; the database write after took a median 25 ms, slowest 265 ms.
- 36,526 updates from 8:25 to the close, **0 reconnects**.
- The share count on the updates: measured this time (a raw update a minute is logged, for example a 1-share fill at 8:52:01 carrying `position_qty` 1).

**The 3 second stop-gap sales:**
- 762 brackets had their stop cancelled by Alpaca at a partial take-profit (counted from the fills: the take-profit had filled part of the position when the stop was cancelled; the order stream's own counter also says 762). All were after 9:00 (a 1-share window entry cannot partly fill). In 659 the take-profit finished on its own: 604 within 3 seconds of the cancel, 657 within 5.
- The stack sold the other **103 (199 shares, about 2,627 dollars; the largest 60.90)**.
- **From Alpaca's stop cancel to the sale being sent: median 5.2 seconds** (10th percentile 5.0, 90th 5.7, slowest 10.2), using the time Alpaca received the sale (its submit time is a median 10 ms later). Thursday: median 10.1.
  - It is the 3 second grace plus the sale's own steps: the sell path first cancels the take-profit still resting at Alpaca and waits for that cancel, then sells (inferred from the code; at the close-out today Alpaca took 6.4 seconds to cancel ADT's take-profit).
- **From the cancel to the sale's fill: median 6.5 seconds, slowest 12.5.** Thursday: median 12.1, slowest 24.8.
- The sales came out 15.49 dollars better than the stops those shares had lost, and 3.76 above their entry prices.
- **The day's longest time without a stop: 13.9 seconds**, one of the 6 window shares in 5.1 (XP), not a stop-gap sale. Thursday's was 24.8 seconds; Wednesday's 6 hours.

**Decision 3's measurement: would those shares have filled at their take-profit within the next 5 seconds?**
- **The stack's own line did not work this time:** "103 sales, 199 shares; 4 would have filled at their take-profit within the next 5 seconds; selling at once came out +0.34 dollars against waiting 5 seconds (99 not measured)". 99 of 103 not measured; the 4 that were may be matched to the wrong sale (see 5.3).
- **So the measurement was made here instead, by the meter's own definition**, from Alpaca's records and the free feed's prints (an estimate: one exchange's prints, and paper fills within about a cent of them):
  - for each sale, the prints of that symbol in the 5 seconds after Alpaca received the sale;
  - "would have filled" if a print reached the take-profit price;
  - waiting is valued at the take-profit price if it was reached, and otherwise at the last print at the end of the 5 seconds (or the sale's own price if there was no print);
  - dollars against waiting = (the sale's fill minus that value) times the shares; positive means selling at once did better.
- **Result: 41 of the 103 sales (73 of the 199 shares) would have filled at their take-profit within 5 seconds. Selling at once came out +0.11 dollars against waiting 5 seconds** (-0.01 on the 41, +0.12 on the other 62). In 31 sales the free feed printed nothing in those 5 seconds.
- **Reading:** for the shares, a 3 second grace sells about 4 in 10 that the take-profit would have filled soon after, but at about the same price, so the dollars are a wash (11 cents on 2,627 dollars). The grace's purpose, a short time without a stop, worked: 6.5 seconds typical, 12.5 at most.

### 3. The shadow loss-stop estimate against the 5 second account check: not ready to become the main loss stop

- **What is compared** (from the code): at each loss-stop account read (every 5 seconds), the stack's own estimate of equity (Alpaca's cash plus each held position at the free feed's last print) minus Alpaca's equity. Logged per minute as the count, the mean and the largest gap. It triggers nothing.
- **4,671 reads all session.** In 374 of 388 minutes the largest gap was under 1 dollar (in 319 minutes over 10 cents).
- **The largest gap: 63.91 dollars, in the minute to 9:29:10 AM** (mean -5.35 that minute). Next: 62.87 (9:37), 44.82 (11:04), 30.34 (9:03), 29.18 (12:49), 28.53 (10:01). Eleven minutes had a gap over 10 dollars, between 14.62 and 63.91, in both directions.
- **Why (inferred):** those gaps are the size of one normal-placeholder position (at most 75 dollars on a load day) and go both ways. The estimate adds Alpaca's cash, read now, to the positions from the gate's account view, which can be up to 10 seconds old. Just after a buy the cash has gone down but the view does not have the new position yet (the estimate reads low); just after a sale, the other way (it reads high).
- **Timing:** the per-minute record keeps only the count, mean and largest gap, so whether the estimate leads or lags Alpaca's equity cannot be measured from it. Logging each read's time, both values and the positions' age would measure it.
- **Not ready.** As the main trigger, a gap of up to 64 dollars against a 500 dollar limit could fire the stop about 13 percent early, or late by as much. It also was never tested near the trigger: the day's lowest equity was 18,705.71 at 1:39 PM, 109.85 below the start. Before it can lead, the estimate needs positions from the same moment as the cash (for example from the live fills' share counts), then another shadow day. The 5 second account read stays the loss stop.

### 4. The rest of the day, the close-out, the summary and Discord volume

**The normal placeholder after 9:00 (the 75 dollar load-day cap):**
- 1,977 orders: 1,964 accepted and filled, 13 refused by Alpaca (see 2). Last entry at 1:59 PM; none after 2:00, by design.
- Busiest minute 31 entries. Position size averaged 67.34 dollars.
- Speed: median 163 ms, 95th percentile 324, slowest 771.
- **Result: -94.20 dollars on 132,252 dollars bought (0.071 percent; Thursday 0.109).**
- Requests: 42 to 176 a minute from 9:01 to 2:00 PM; 35 to 71 from 2:00 to 2:55 with no entries (Thursday 65 to 78 in that stretch). **The order sync no longer rereads the day** (Thursday's 4.4): with the live updates connected it reads the last 10 minutes and looks up older entries by id. CPU from 11 AM to the close was 1.6 to 4.4 percent (Thursday 6 to 7.6 in the afternoon).

**The day as a whole:**
- 3,431 orders: 3,418 accepted, 2,713 filled (749 in the window, 1,964 after), 705 cancelled unfilled, 13 refused.
- **Equity went from 18,815.56 (Armed) to 18,712.15: -103.41.** That equals the sum of every fill to the cent, and first-in first-out matching over every order gives the same -103.41 (1,453 won, 1,328 lost, 35 even).
- **The loss stop was never close:** the lowest equity was 109.85 below the start, against 500.
- 0 rate-limit answers all day; the lowest remaining stock 159; the governor held nothing back.

**The close-out: flat, no NOT FLAT, no Healthchecks failure, one "Close-out done".** Timeline (all measured):

| Time | What |
| :-- | :-- |
| 2:55:01.704 | close-out starts: cancel requests sent for ADT (1 share, the 8:45 window entry) and PFE (2 shares, 12:48 PM) |
| 2:55:01.774 | both stops cancelled at Alpaca |
| 2:55:01.814 | cancel answered |
| 2:55:08.191 and .196 | the two take-profits' cancels complete, 6.4 seconds after the request |
| 2:55:09.587 and .674 | market sells received by Alpaca (1 ADT, 2 PFE) |
| 2:55:25.5 to 25.6 | Alpaca paper submits them, 16 seconds after receiving them (Thursday: 12.6) |
| 2:55:26.257 to 28.868 | fills. **The account is flat at 2:55:28.868** |
| 2:55:28 | close-out result: flat, path "close-out", waited 19.0 seconds on its own sells, no errors |
| 2:55:29 | `trading`: "Close-out done: the account is flat." (the only one); not-flat flag saved off |

Healthchecks: every ping succeeded (2:54:41, 2:55:11, 2:55:43, 2:56:16), and the check has not gone down since Wednesday.

**The daily summary against the account: it does NOT match this time.**
- Summary: "-106.35 from closed trades; account equity 18815.56 to 18712.15 (-103.41)". The account and every fill say -103.41.
- Other numbers off: "2687 filled" (2,713); "2786 sells filled" (2,816); won 1,423 (1,453); the rest of the day "1964 entries sent (1938 filled)" (1,964 filled); per-symbol lines such as "SNAP: bought 764, sold 758" on a flat account (764 and 764); and the note "3 shares were sold that were bought before today (a carried position)", which is false: the day started flat.
- The window line "Unfilled and cancelled: 728 of 1454 (726 filled before the cancel)" counts cancel requests; 705 were cancelled and 749 filled.
- Matching: "3418 entry orders sent" (3,418), "Alpaca refused 13 more" (13), the account's -103.41, flat, stop flag off.
- Cause, see 5.2. Nothing here changes what the stack did; the summary is a report.

**Discord volume (midnight to 3:15 PM, messages by channel):**

| Channel | Thursday (v9) | Friday (v10) |
| :-- | --: | --: |
| trading | 792 | **74** |
| alerts | 101 | **93** |
| commands | 3 | 5 (1 of them Michael's) |
| **Total** | **896** | **172** |

- `trading`: 70 five-minute trade lines replaced 768 per-entry lines; plus the live list, "Close-out done" and the summary (2 parts).
- `alerts`: 6 "no live protective stop, so I sold it" (5.1) and **87 alerts carrying the 103 remainder sales** (Thursday: 101 alerts for 101). The batching is one alert a minute, and most minutes had only one sale, so alerts barely fell.
- `commands`: the full 7:30 AM review (the limits were not yet decided at 7:30), Michael's 5 commands in one message and one consolidated reply, Armed, and Monday's limits post.

### 5. What did not behave as designed

**5.1 Six window entries lost both exits when the 5 second cancel met their fill.** (Money-touching. Most important.)
- What the build assumed (`entry-expiry.ts` and the speed release log): if Alpaca filled the entry first, it refuses the cancel and "the position keeps both of its exits".
- What paper did: in 6 cases the entry filled 4.85 to 5.02 seconds after acceptance, the cancel arrived at the 5 second mark, and Alpaca accepted it and **cancelled the take-profit and the stop** 7 to 107 ms after the fill, leaving 1 share with no exit at all. (In 17 other cases where the cancel met a fill, the exits stayed.)
- The missing-exit check caught every one and sold the share ("IREN had no live protective stop, so I sold it", 8:48 to 8:59 AM). Time from the stop's cancel to the sale's fill: IREN 7.6 s, RIOT 6.1 s, SNAP 12.2 s, IREN 4.6 s, XP **13.9 s**, CMCSA 9.4 s. Cost -0.05 dollars in all; each share was worth 5 to 25 dollars.
- So the safety net held, but the design's own safety claim is wrong on paper: any cancel at a fixed time will sometimes meet a fill in the same instant. Proposed fixes are in the next steps; none is built.

**5.2 The summary missed orders that Alpaca's listing left out.** (Reporting; not money-touching.)
- Alpaca's "all orders" listing left out 71 entries (59 of them filled) and 4 remainder sales. Thursday: 23 entries and 1 sale.
- The summary looks up missing entries by id, but at most 50 (`.slice(0, 50)` in the summary step), and the 50 include unfilled ones; it does not look up missing sells at all (they are not stored).
- Rerunning the summary's own matching on today's listing with the first 50 lookups reproduces its CIFR line (2,267 bought, -17.63), its SNAP line (764 and 758, -7.91) and the 3 "carried" shares exactly; the total comes to -105.22 against its -106.35 (the listing omits slightly different orders each time it is read). So the cause is inferred, with strong support. With every order included the matching gives -103.41 exactly.

**5.3 The stop-gap measurement watches each sale only after the sale has filled.** (The meter only watches; but it is called from the sell path in `risk.ts`, a money-touching file.)
- Inferred from the code: the sale is handed to the meter after the sell path returns, and the sell path returns only once the sale has filled. By then the fill's live update has already passed, so the meter never sees it and gives up after 60 seconds ("not measured"). Prints before the hand-off are missed too. The 4 it did measure were probably matched to a later sale of the same symbol.
- Measured: 99 of 103 not measured. Section 2 gives the measurement made here instead.

**5.4 The shadow estimate mixes fresh cash with a positions view up to 10 seconds old** (section 3). Gaps of up to 64 dollars, inferred to be timing, not prices.

**5.5 Smaller items:**
- The 30 orders of the opening second took up to 3 seconds to be accepted and up to 11.7 seconds to be cancelled (section 1). No harm; the cause is not measured.
- The summary's stop-gap line says "sold 3 seconds after Alpaca cancelled the stop"; the measured time to the sale is a median 5.2 seconds (section 2).
- Remainder alerts are batched by the minute but seldom share one (section 4).
- The order stream's first status, "authenticating", is still logged at warning level.

### Recommended next steps (under the standing rule: nothing below is built until Michael approves)

1. **Decide a fix for 5.1 before the next load day** (money-touching). Options:
   - (a) **Recommended:** when the live updates show a filled entry whose take-profit and stop are both cancelled while no close-out or sale of that symbol is running, sell the share at once through the checked sell path. The missing-exit check stays as the backstop. Paper filled the six sales 0.3 to 1.7 seconds after receiving them, so this would cut the 4.6 to 13.9 seconds to about 1 to 2 seconds (estimate).
   - (b) Run the next load day with market entries again (Thursday's design), accepting Thursday's refusals.
   - (c) Keep v10 as it is: the missing-exit check limits each case to about 15 seconds on 1 share.
2. **Fix the summary (5.2):** look up every entry missing from the listing (no 50 cap; 71 lookups fit easily after the close), and the missing sells too, or build the day's figures from Alpaca's fills, which matched the account to the cent today. Reporting only.
3. **Fix the stop-gap meter (5.3):** hand each sale to the meter when it is sent, not after it fills. The sale's send time and shares are known only once the sell path returns today, so the sell path would need to report the moment it sends: a small change inside `risk.ts` and `sells.ts`, so it needs Michael's go-ahead under the standing rule.
4. **Keep the 5 second account read as the loss stop.** Value the shadow estimate's positions from the same moment as the cash, and run another shadow day before considering a switch.
5. **The load test has passed at 100 orders a minute.** Testing above 100 would need a higher ceiling, which is a hard stop for Michael; it is not proposed. Normal days on v10 (with fix 1 if approved) would show the live updates and the stop gap under normal load.
6. **Monday's limits** were posted at 3:10 PM and wait for Michael. Without approval there is no trading Monday; Monday is a normal day unless he types `load on` before 7:45 AM.

Paper only. Everything here is research input for a human decision, never an instruction to act.

## Michael's decisions after the Friday review (2026-11-06, after the close)

Approved as one release, proposed briefly here and then built without waiting:
1. Lost exits: when the live updates show a filled buy with both exits cancelled, sell at once (target 1 to 2 seconds).
2. The summary looks up every missing order, buys and sells, with no cap, and drops the false "carried" note.
3. The 3 second sale measurement starts when the sale is sent.
4. Fix the loss-stop estimate's timing. It stays in shadow; the 5 second check stays the main loss stop.
5. Load days only: raise the orders-a-minute ceiling to 150 (Michael's ruling). Normal days stay at 100.
6. Check first hand whether Alpaca's paid plans, including Algo Trader Plus, raise the 200 requests a minute limit. Record the source and date.
7. The request reserve scales with open positions instead of a fixed 80: enough for a full emergency flatten of what is open (cancels plus sells), with a floor and a cap of 80. Set the formula from the simulated and real close-out data, show the math, and test that a full flatten at the maximum open positions never hits a rate limit.

**Load-day pass rule for this test:** report the highest accepted orders a minute; it holds if there are no rate-limit errors, remaining requests never drop below the reserve in force, no safety sale is delayed, and the close-out is flat.

Two review groups as before (money, messaging), up to two rounds each, pre-approved. Deploy outside market hours, before 7:30 AM Monday, only if group 1 passes. Post the "live" line with the exact load-day ceiling command. Then write `builds/monday-review-brief.md` and set a wait for 3:15 PM Monday.

## Release 11 proposal (2026-11-06, evening; built straight after, per Michael)

1. **Lost exits.** The live-update handler watches each bracket's two exits. When both have ended (cancelled, expired or rejected) with nothing filled, and the entry is filled, it asks the worker for an order sync at once instead of at the next 10 second sync. That sync is the one that already sells a held position with no live exit (the missing-exit check), with its existing guards: nothing while a close-out or any other sale runs, only the newest entry of the symbol, nothing if a sell is already working on it. Estimate: the sale is sent about 0.5 to 1.5 seconds after the cancel (one sync read, then the sale's own reads); paper filled Friday's six sales 0.3 to 1.7 seconds after receiving them.
2. **Summary.** Every stored entry missing from Alpaca's listing is looked up by its id (no cap). Then Alpaca's list of the day's fills is read, and any order a fill belongs to that is still not known is fetched by its id, so missing sells are found too. The "carried position" note appears only when the day really began with shares held; otherwise unmatched sold shares (if any are still left) are named as not matched. The window line counts entries from Alpaca's records (cancelled unfilled, filled) instead of the cancel requests.
3. **Stop-gap measurement.** The sell path reports each sale the moment Alpaca accepts it (its client id and time); the meter starts watching then, matches the fill by client id, and keeps fills that arrive first for a minute, so the order does not matter.
4. **Shadow estimate.** Its own record of cash and shares, moved by every fill on the live updates, and re-based on an account-and-positions read only when no fill arrived within a second of that read. Logged each minute with the time of the largest gap, the time since the last fill and since the re-base. Still shadow only.
5. **Ceiling 150 on load days.** `trades` accepts up to 150 while the next day is a load day (`load on` first; in one message `load on` is applied before `trades`), up to 100 otherwise. The gate and the governor cap at 150 only while the load window is switched on, 100 otherwise (including after `load off`, which also lowers an approved value above 100 to 100). The evening suggestion never carries more than 100 forward.
6. **Paid plans (checked first hand, 2026-11-06).** No paid plan raises the trading limit on paper. Algo Trader Plus raises market data calls only (200 to 10,000 a minute). Alpaca Elite Smart Router raises trading calls to 1,000 a minute, but needs a 30,000 dollar live deposit and per-share pricing: a live-money step, a hard stop, not proposed. Sources:
   - Alpaca forum, staff (Dan_Whitnable_Alpaca, 2024-05-02), https://forum.alpaca.markets/t/429-rate-limit-exceeded-when-creating-orders/14120 : "The Trading APIs (eg submit_order, get_account, etc) all have a rate limit of 200 calls/min." "A paid market data subscription does not increase the rate limit for the Trading APIs, only the market data calls." "About 150 orders can very realistically be placed every minute." Read 2026-11-06.
   - Alpaca Elite page, https://alpaca.markets/elite : API calls limit "200 calls / minute" and "1000 calls / minute" (Elite Smart Router); "Deposit $30,000 to unlock". Nothing about paper. Read 2026-11-06.
   - Also found by a research helper and not re-read by me: the forum thread https://forum.alpaca.markets/t/considering-alpaca-elite-have-questions/18680 (staff, 2026-04-10: 200 a minute, "applied per account"), and Alpaca's support page https://alpaca.markets/support/increase-api-rate-limit (December 2022: 1,000 a minute on request for a "non-retail" live account).
7. **The reserve.** reserve = min(80, max(30, ceil(1.25 x (24 + open symbols)))), where open symbols = symbols held plus symbols with a working entry. Math:
   - Simulated (the real sale code against the simulated broker with Alpaca's bucket of 200 refilling at 200 a minute; requests take no time, which overstates the drain; cancels of 0.2 and 7 seconds, sells held 16 seconds as paper did): the most any full flatten (close-out, loss stop, flatten command) drew the bucket below its refill was 11 + 1 per open position (12 at 1, 21 at 10, 41 at 30).
   - Real close-outs: Wednesday about 70 requests (2 positions, a second round), Thursday about 40 (1), Friday about 45 (2), over 20 to 30 seconds, while the bucket refills about 70 to 100 in that time.
   - Routine work running beside a flatten (loss stop read, view, sync): at most about 75 a minute measured, so about 13 in the 10 seconds a flatten's burst lasts.
   - 11 + 13 = 24, plus 1 per open symbol, times 1.25 for margin: 30 with nothing open (the floor), 68 at 30 open symbols (the most the 30-symbol live list allows), 80 (the cap) from 40.
   - The test: a full flatten of 30 positions starting at the reserve, with routine requests running beside it, in every path and both cancel speeds: no rate-limit answer.

Money-touching: 1, 3 (the call sits in the sell path), 5, 7. Messaging: 2 and the summary and help wording of 5. Shadow only: 4. Paper only.

## Release 11 (built 2026-11-06, evening; branch `release-11`; reviews below)

Everything here is paper only, and research input for a human decision, never an instruction to act.

### What changed, item by item

| Item | Change | Files |
| :-- | :-- | :-- |
| 1. Lost exits | The live-update handler records each bracket's exits as they end. When both have ended (cancelled, expired or rejected), neither filled anything, and the entry filled, it reports it once. The worker then runs the order sync at once (not at the next 10 second sync), unless a sale or the close-out is running (that sale cancelled them, and the check is off then). The sync's existing missing-exit check sells, with its guards. If the sync still sees live exits (Alpaca's order list behind the update), it tries again 0.5, 1 and 2 seconds later, then leaves it to the 10 second sync. | `order-stream.ts`, `worker.ts` |
| 2. Summary | Every stored entry missing from the listing is looked up by client id (no cap). Then Alpaca's list of the day's fills is read (100 a page) and any order a fill names that is still unknown is fetched by its id (new read-only calls `listFillsForDay`, `getOrderById`), so missing sells are found. If that check cannot run in full, the summary says so. The "carried position" note only when the day was marked carried (the carried-position sale sets the mark); otherwise unmatched shares are named as unmatched. The window line counts limit buys from Alpaca's records (filled, cancelled unfilled). The stop-gap line says "after a 3 second wait". | `worker.ts`, `summary.ts`, `alpaca-trading.ts`, `broker.ts` |
| 3. Stop-gap measurement | The sell path (`Liquidator.flatten`, new `onSellSent`) reports each sell the moment Alpaca accepts it, with its client id; the remainder sale hands it to the meter then. The meter matches the fill by client id and keeps a fill that arrives first for a minute. | `sells.ts`, `risk.ts`, `stop-gap.ts`, `worker.ts` |
| 4. Shadow estimate | A new book (`shadow-ledger.ts`): cash and shares moved by every fill on the live updates (each fill's own quantity is now parsed). It is set from a view refresh (account and positions asked together) only while unset, and only when no fill came within 3 seconds of that read; while set, reads only check it (largest cash gap counted). The live updates dropping or reconnecting drops it. The per-minute line gives the largest gap's time, both values, the time since the last fill and since the book was set. Shadow only: the loss stop still decides on Alpaca's equity every 5 seconds. | `shadow-ledger.ts`, `worker.ts`, `order-stream.ts`, `broker-view.ts` (a read-only getter) |
| 5. Ceiling 150 on load days | `MAX_TRADES_PER_MINUTE_LOAD_DAY = 150`; `tradesCeiling(windowOn)`. `trades` accepts up to 150 while the day is a load day, else 100 (the reply says how to get 150). In one message `load` lines are handled first, and the replies keep the written order. The gate passes the ceiling in force (150 only while `load on`, else 100) to the entry check and the governor, and the governor never goes above 150. `load off` lowers an approved value above 100 to 100. The evening suggestion never carries more than 100. The limits list shows "the ceiling is 100 (150 on a load day)" or "150 on this load day". | `limits.ts`, `gate.ts`, `governor.ts`, `commands.ts`, `morning.ts` |
| 6. Paid plans | Recorded in "Release 11 proposal", item 6. No code. | |
| 7. Reserve | `reserveFor(n) = min(80, 52 + n)` since the group 1 round 1 fix (first built as `min(80, max(30, ceil(1.25 x (24 + n))))`, which was too small; see below). The gate tells the governor the open symbols (held, working, plus the entry it is about to send) before each entry; the worker does at each view refresh. Unknown means 80. Entries, the view refresh and the loss stop's retry keep the reserve in force. The per-minute line gives the reserve's range and the day's lowest "remaining minus the reserve in force" (for Monday's pass rule). | `governor.ts`, `gate.ts`, `worker.ts`, `risk.ts` |

### Found while building

- **The lost-exit report fired twice** when Alpaca repeated a cancel update for the same exit. Now once per bracket (the handler test caught it).
- **A quiet read could overwrite a correct shadow book with a lagging position list.** The worker test, with Alpaca's position list lagging a fill by about 6 seconds, gave a 510 dollar gap. So reads now only check the book while it is set (see item 4). Whether Alpaca's position list lags, and by how long, is not measured; the book's checks (`maxCheckCashGap`) and the per-minute fields will show it.

### Tests

433 pass (407 before: 25 added in `test/release-11.test.ts` and 1 in `test/rehearsal-150.test.ts`; 4 existing tests changed because the rule they encoded changed: a stored trades value is clamped to 150 when read, the window line's wording, a test that used a budget of 5 as "inside the reserve" now uses 0, and the shadow-estimate statistics test now gives the book its quiet read). Type check clean. Each change was taken out on its own and a test failed every time: 48 of 48 caught (after tightening four tests that first let a change through, and removing one line that could never run).

| Change taken out | Test that fails |
| :-- | :-- |
| the handler's report; once per bracket; both exits; nothing filled | decision 1, handler |
| the worker's sync at once; no delay; skip while a sale runs; the follow-up syncs | decision 1, worker (three tests) |
| no lookup cap; the fills check; the carried mark; the carried note; the warning; the window counts | decision 2 (five tests) |
| the sell path's report; the remainder sale's hand-over; matching by client id; early fills kept; the worker passing the id | decision 3 (four tests) |
| the quiet skip; the quiet wait; fills move cash; check, never overwrite; the worker using the book; the worker feeding fills | decision 4 (two tests) |
| 150; the override by day; the governor's cap; the entry check's cap; the gate only while on; `trades` judged by the day; load lines first; reply order; `load off` lowers; the suggestion capped | decision 5 (three tests) |
| the formula; the floor; unknown means 80; `canSpend` uses the reserve; the gate's count and its +1; the worker's count of working entries; the retry | decision 7 (five tests) |

**The flatten test (decision 7):** 30 positions of 2 shares (the most open symbols the live list allows), the bucket starting at the reserve (68), the refill cut to 125 a minute for routine work beside it, cancels of 0.2 and 7 seconds, sells held 16 seconds: the close-out, the loss stop's sale and the flatten command each finished with no rate-limit answer, and flat where their rounds allow.

### Added before review (a second look at the build)

- **Lost exits, the entry's fill arriving last:** nothing guarantees the entry's fill update comes before its exits' cancels; the check now runs again when the fill arrives (test with the updates in reverse order).
- **Lost exits, looked up first:** an entry the live updates reported goes first in the sync's lookups of entries Alpaca's listing left out (10 a sync), so on a busy day it is never left behind older missing entries (test: 12 older missing entries).
- **The summary's reads are paced:** on a big day the fills' pages and the lookups are a few hundred reads after the close. Each waits while Alpaca's budget is under 100, so the summary cannot cause a rate-limit answer (test: 300 missing entries, none). The day's request figures in the summary are taken before those reads. A failed lookup is counted in the run log instead of being silently ignored.
- **The shadow book's fill quantities, measured:** on 2026-11-06 an update's `qty` and `price` were those of that fill alone (for example T: `qty` 1 while the order's filled total was 3, matching Alpaca's fill record 1 at 21.63, cumulative 3), so the book counts each fill once.

### Rehearsal at 150 orders a minute (simulated broker, `test/rehearsal-150.test.ts`)

A 15 minute load window with `load on` and `trades 150`: 30 names printing about twice a second each, limit entries filled when a later print reaches the limit (at least 0.3 seconds later), the rest cancelled by the 5 second entry wait, live order updates, Alpaca's bucket of 200 refilling at 200 a minute, the governor reading what is left. Requests take no time in the simulator (which overstates the drain). Results (estimate: a model, not paper):
- **Accepted orders a minute:** 150, 150, 150, 150, 147, then 121 to 132 for the last 10 minutes; 2,023 in all, busiest 60 seconds 150. From the fourth minute the governor held entries back at the reserve (3,348 times).
- **Rate-limit answers: 0.** Lowest remaining 39. Most requests in any 60 seconds 241 (the bucket refills continuously).
- **Remaining minus the reserve in force: -1 to -6 in every minute from the third on** (lowest -6). The governor stops only entries at the reserve; cancels of unfilled entries, the order sync and the loss stop's reads keep spending, which is what the reserve is for. Read literally, Monday's rule ("remaining requests never drop below the reserve in force") would then say "does not hold" by design, with no rate-limit risk. Making entries stop earlier would be a money-touching change outside Michael's list, so it was not made: **a question for Michael before Monday** (see the Monday brief).
- The sync's 10 minute read was never incomplete (at most about 1,300 orders in 10 minutes against its 1,500).
- Nothing oversold, no remainder sales (1 share cannot partly fill).

**Untested on paper until Monday:** the lost-exit sale's real timing (estimate: sent 0.5 to 1.5 seconds after the cancel, filled 0.3 to 1.7 seconds later); the fills listing's paging on a day of 10,000 fills or more (about 100 to 150 reads after the close); how the reserve behaves at 150 orders a minute on paper (the rehearsal above: 150 a minute for 4 minutes, then about 125); whether Alpaca's position list lags fills.

### Group 2 review, round 1 (2026-11-06, evening): PASS

No blocking finding. The reviewer checked the summary's lookups and fills check, the pacing, the request figures taken first, the carried note, the window counts, the stop-gap meter, the wording, the statistics fields and the log against the code and the test output (433 pass). Non-blocking notes, and what was done:
- Per-minute lows of Alpaca's remaining and of "remaining minus the reserve" are needed to judge Monday's rule minute by minute (the day's running low hides later minutes): **added** (`reserveThisMinute.lowestRemaining`, `.lowestAboveReserve`, reset each minute), in the fix below, reviewed in group 1 round 2.
- The `load off` reply's "trades lowered" started a sentence in lower case: **now "`trades` lowered"**.
- The summary's request figure said "at the close" but is read when the summary starts: **now "in the minute before this summary"**.
- The shadow book could outlive the day: **now dropped when each day's live updates start**.
- The stop-gap count now counts each sell sent (a remainder can take up to 3 rounds), so it is not strictly comparable with Friday's 103 sales: noted here.
- With `load` lines handled first, `approve` then `load on` gives the `load on` line "(once all four limits are decided)" although the same message decided them; the list at the end is right. Left as is (messaging only).
- The carried mark is set whenever the carried-position sale runs, even if it finds nothing; minor (the fills check should leave nothing unmatched). Left as is.
- The proposal said a read within "a second" of a fill is not used; the code uses 3 seconds (the build table says 3).

### Group 1 review, round 1 (2026-11-06, evening): CHANGES REQUIRED. Fixed.

**The finding (blocking, item 7): the reserve formula was too small.** The reviewer re-ran the build's flatten test at more sizes: starting at the reserve, the flatten command got rate-limit answers at 5 positions (2) and 12 (1) with 7 second cancels; starting 6 below the reserve (where the rehearsal says the bucket sits at sustained load) it got them at every size. The close-out and the loss stop's one round held. Cause: the formula priced routine work beside a flatten at 13 requests ("the 10 seconds a flatten's burst lasts"), but the flatten command's 4 rounds with 7 second cancels and 16 second held sells last about 23 seconds; and the earlier measurement ran with the full refill of 200 a minute instead of what routine work leaves.

**The fix: reserve = min(80, 52 + open symbols).** Re-measured in the simulator with the real sale code, routine work at 75 a minute for the flatten's whole length (the refill cut to 125), cancels of 0.2 and 7 seconds, sells held 16 seconds, the bucket's drop below where it started (requests take no time in the simulator, which overstates the drain):

| Open positions | Close-out (0.2 s / 7 s cancels) | Loss stop's sale | Flatten command | Worst |
| --: | :-- | :-- | :-- | --: |
| 0 | 3 / 3 | 2 / 2 | 2 / 2 | 3 |
| 1 | 10 / 19 | 10 / 13 | 33 / 35 | 35 |
| 5 | 14 / 23 | 14 / 13 | 37 / 39 | 39 |
| 12 | 21 / 30 | 21 / 13 | 44 / 46 | 46 |
| 20 | 29 / 38 | 29 / 13 | 52 / 54 | 54 |
| 30 | 39 / 48 | 39 / 13 | 62 / 64 | 64 |
| 40 | 49 / 58 | 49 / 13 | 72 / 74 | 74 |

- The worst is the flatten command with slow cancels: 34 + 1 per open symbol.
- Plus 8: at sustained load the bucket sits up to 6 or 7 below the reserve (the rehearsals: the governor's low -6, the simulator's sampled low -7).
- Plus 10 left at the bottom (5 percent of the bucket).
- 34 + 8 + 10 = 52, plus 1 per open symbol: 52 with nothing open, 80 (Michael's cap) from 28 open symbols. At 30 open symbols (the most the live list allows) the cap holds it at 80 instead of 82, so the worst case leaves 8 requests at the bottom instead of 10, with no rate-limit answer.
- So the scaling is modest: it frees 28 requests of headroom for entries when nothing is open, and it is v10's 80 whenever the live list is nearly full (as in a load window).

**The test now:** 1, 5, 12, 20 and 30 positions; the close-out, the loss stop's sale and the flatten command; cancels of 0.2 and 7 seconds; the bucket starting 8 below the reserve; routine work at 75 a minute beside it. Every case: no rate-limit answer, at least 10 requests left at the lowest (8 at 30 positions, where the cap binds), flat where the path's rounds allow, nothing oversold.

**The rehearsal at 150 a minute with the new reserve:** accepted 150, 150, 150, 150, 133, then 123 to 130 a minute (2,000 in the window); 0 rate-limit answers; lowest remaining 58; remaining minus the reserve -2 to -7 each minute from the third (governor's low -6). The question for Michael about Monday's rule stands.

Other round 1 notes (non-blocking): the three scope questions (the carried mark, `load` lines first, `load off` lowering trades) judged inside items 2 and 5; the shadow book cannot touch the loss stop, an order or the gate; the 150 ceiling is correct and applies all day while the load mode is on (not only 8:45 to 9:00), which Michael should know; each lost-exit event can cost up to 4 syncs; the sync's 10 minute read reaches its 1,500 order limit only at a sustained 150 a minute (the governor keeps it near 125); `endedLegs` and `lostReported` grow by about 700 entries a load day (the handler is rebuilt each day).

**Tests:** 433 pass; 50 of 50 changes caught when taken out (the reserve's formula, floor, minute lows and the book's daily fresh start added).

### Group 1 review, round 2 (2026-11-06, evening, the last round allowed): STOP AND FLAG MICHAEL. Nothing deployed; Fly stays on v10.

**Round 1's finding is fixed for the path the test runs** (the reviewer's own probe matched the table above: worst is the flatten command, 34 + 1 per open symbol, at least 10 left, 8 at 30 where the cap binds). **New blocking finding, item 7:** the reserve was derived, and the flatten test runs, with the liquidator and the close-out built without `waitEvent`; in production the worker passes it (the speed release's item 9: a sale's waits end early at a live update for its symbols, up to 20 early wake-ups a wait, each followed by a look of 2 requests; the close-out's own-sells wait the same).
- With early wake-ups on and the cancel completions and sell fills arriving all at once (as the simulator does), the draw matches the table: no rate-limit answers.
- With them spread at random over their delays (confirmed by the builder with the reviewer's probe, start 8 below the reserve, routine work at 75 a minute): the flatten command got rate-limit answers at 5 positions (5, with 7 second cancels), 12 (24), 20 (4 and 11) and 30 (6 and 20); the close-out at 12 (9), 20 (17) and 30 (6). From a full bucket the flatten command drew up to 100 at 30 positions (the formula assumes 64). With spread timing and early wake-ups off: no rate-limit answers at any size. So the early wake-ups are the cause.
- In every run the account still ended flat (the client retries a rate-limited cancel, sell or read after a pause): rate-limit answers and delayed sales during a flatten, not a failure to go flat.
- **v10 (running now) has part of this already:** starting at 72 (its fixed 80 less 8) it gives rate-limit answers at 12, 20 and 30 positions. Release 11's lower reserve adds it at small sizes (5 positions: clean from 72, rate-limited from 49).
- How spread out Alpaca's real updates are is not measured (a guess until a recorded update timeline shows it).

Fixing it needs either a reserve above Michael's cap of 80 or a change to the early wake-ups in the sell path and the close-out, both beyond Michael's list, so under the standing rule it goes to Michael. Non-blocking: a lost-exit or remainder sale already running when a flatten command arrives spends budget first; the "8 below the reserve" comes from a simulator with no request time.

Everything else in the release passed: group 2 in round 1; group 1's checks of items 1 to 5, the shadow book, the 150 ceiling and the fix commit's other changes. Paper only. Research input for a human decision, never an instruction to act.

## Michael's decisions after group 1 round 2 (2026-11-06, evening)

Asked with the round 2 finding and the rehearsal's reserve dip:
- **Release 11: "Both."** Deploy release 11 now with the reserve fixed at 80 as in v10 (item 7's scaling not shipped; items 1 to 5 go live; flatten exposure the same as v10's). Also build the wake-up fix (early wake-ups in the sell path and the close-out skip their extra look when Alpaca's budget is near the reserve, and fewer wakes per wait; a flatten test with spread-out update timing at 1 to 30 positions) with a third group 1 review, deployed before 7:30 AM Monday only if it passes.
- **Monday's pass rule, how a dip below the reserve counts: "Allow safety-work dips."** It holds if new entries never spend below the reserve. A dip caused only by cancels, syncs, loss-stop reads or sales is reported with its size but does not fail the day, as long as there are no rate-limit errors and no safety sale is delayed (and the close-out is flat).

### Deploy (2026-11-06, 11:41 PM Central, market closed): Fly release v11, the reserve held at 80

- **What shipped:** `0cb54ef` (now `main`): release 11's items 1 to 5 (lost exits sold at once, the summary's complete lookups and fills check, the stop-gap measurement at send, the shadow book, 150 orders a minute while a load day's window is on), group 2's notes, and item 7's open-symbol count and statistics with the scaled reserve switched off (`RESERVE_SCALING = false`: the reserve stays 80, as in v10), per Michael's decision. 433 tests pass. Reviews: group 2 PASS (round 1); group 1 round 1 CHANGES REQUIRED (fixed), round 2 STOP AND FLAG MICHAEL on item 7 only; Michael chose to deploy with the reserve at 80.
- `fly deploy --ha=false` from a separate checkout of `0cb54ef` with no key file in it.
- **Fly release v11:** one machine (San Jose), started 11:41:46 PM, good state. Discord `commands`, 11:41:49 PM: "Worker started at 11:41 PM CT (paper): new release P658BC7X (was 1W6WY1C8): a deploy. Starts in the last hour: 1." Healthchecks up (last ping 11:41:50 PM). Monday 2026-11-09's request pending (posted 3:10 PM Friday), stop flag off, not-flat flag off.
- **The live line, `commands`:** "Release 11 is live (Fly release v11, paper only): lost exits are sold at once, the summary checks every order against Alpaca's fills, the 3 second sale measurement starts at the sale, and the request reserve stays at 80 for now. For a load day at up to 150 orders a minute, send this as one message before 7:45 AM Monday, one command per line: `load on` / `trades 150` / `approve`. The 150 applies all day while `load on` is in force; normal days, and after `load off`, stay at 100."
- `builds/monday-review-brief.md` written (Michael's pass rule word for word, with his ruling on dips).

**Next (Michael's "Both"):** the early wake-up fix on a new branch, a third group 1 review, deployed before 7:30 AM Monday only if it passes.

## The early wake-up fix (built 2026-11-07, just after midnight; branch `wake-fix`; group 1 review, round 3, approved by Michael)

Michael's approval ("Both", 2026-11-06): early wake-ups in the sell path and the close-out skip their extra look when Alpaca's budget is near the reserve, fewer wakes per wait, and a flatten test with spread-out update timing at 1 to 30 positions; a third group 1 review; deploy before 7:30 AM Monday only if it passes. The reserve stays at 80 (the scaled reserve stays switched off).

**What changed** (`src/early-wake.ts`, `worker.ts` `waitEvent`, `sells.ts`, `closeout.ts`):
- A live update ends a wait early only while Alpaca's request budget (the governor's estimate) is at least `EARLY_LOOK_HEADROOM` = 20 above the reserve in force; otherwise it is ignored and the wait runs to its timed look. The check sits in the worker's `waitEvent`, used by both the sell path's waits and the close-out's wait for its own sells.
- At most `MAX_EARLY_WAKES` = 5 early wake-ups in one liquidation and in the close-out's wait (20 before).
- It only decides when the next look happens; nothing that sends, cancels or sizes an order changed.

**The flatten test with spread timing** (`test/wake-fix.test.ts`): the release 11 flatten (close-out, the loss stop's sale, the flatten command; cancels of 0.2 and 7 seconds; sells held 16 seconds; routine work at 75 a minute), now with the waits ended by live updates as in production, the cancel completions and sell fills spread at random over their delays (3 random draws each), a governor reading the bucket, and the bucket starting at 72 (the reserve of 80 less 8). Simulator, requests take no time (overstates the drain):
- **With the limits: no rate-limit answer in any of 90 cases.** At least 10 requests left up to 20 positions. At 30 positions the flatten command with slow cancels drew the whole bucket in one draw (0 to 4 left, no rate-limit answer): early looks are already blocked there, so this is the flatten command's own timed looks against the cap of 80 (and the same in v10 and v11). Adding margin there would need lighter polling in the flatten command or a reserve above 80, both outside the approval: for Michael.
- **Without the limits (v10 and v11 as deployed), the same spread case gets rate-limit answers** (the test checks this).
- **The scaled reserve (52 + open symbols) with the limits:** no rate-limit answer, but 6 of 40 cases came below 10 left (the flatten command with slow cancels at 5, 12 and 20 positions: 2 to 4). So it stays switched off.

**Tests:** 439 pass (6 added in `test/wake-fix.test.ts`; the speed release's item 9 test now expects 5 early wake-ups, not 20, per Michael's decision). Each change taken out on its own fails a test: 5 of 5 (the worker's budget check, the headroom, the helper, the sell path's cap, the close-out's cap).

### Group 1 review, round 3 (2026-11-07, early morning, approved by Michael): PASS

No blocking finding. Scope checked: only `early-wake.ts`, `worker.ts` `waitEvent`, the two caps, tests and this log; nothing that sends, cancels, sizes or protects an order changed; a wait never lasts longer than its timed look; no sale skipped or stalled (against deployed v11 in the simulator: fewer positions left after the loss stop's single round, close-out at most 30.6 seconds against v11's 40.1, no oversell). The reviewer re-ran the spread-timing test with 30 random draws: up to 20 positions never fewer than 10 left; 30 positions, flatten command, 7 second cancels: lowest 0 (median 1), no rate-limit answer, identical to a run with no early wakes at all, while **real v11 source gets rate-limit answers there in 10 of 10 runs** (and at 12 positions, at 20 in close-out and flatten, and in the loss stop at 30). Non-blocking notes: the 90-case test starts at 72, below the 100 where early wakes are allowed, so it tests timed looks only (the log's "waits ended by live updates as in production" claims more than the test covers; the reviewer's probe covered starts of 100 to 200: no rate-limit answer, within 5 early wakes a liquidation and 10 for the close-out); the test labelled "v10 and v11 as deployed" runs the cap of 5 without the budget check, not v11 itself (v11 is worse); the close-out's own wait can overlap one queued liquidation (each with its own cap and the same budget check). **For Michael, plainly:** at 30 open symbols a flatten command with slow cancels can bring Alpaca's remaining to about 0 in the simulator (no rate-limit answer); live, that would break his Monday rule (remaining below the reserve), and adding margin there needs lighter polling in the flatten command or a reserve above 80.

New work allowed by Michael's standing approval for this weekend (2026-11-07): the wake-up fix and the scaled reserve (item 7) and fixes for review findings about them, up to 8 rounds from round 3, stopping for him on scope, limits or caps, a repeating finding, 8 rounds or Sunday 6:00 PM. Round 3 is round 1 of those 8.

### Deploy (2026-11-06, 11:57 PM Central, market closed): Fly release v12, the early wake-up fix

- **What shipped:** `4c19f34` (`main`): v11 plus the early wake-up fix (round 3 PASS). The reserve stays 80. 439 tests pass. `fly deploy --ha=false` from a separate checkout with no key file in it.
- **Fly release v12:** one machine (San Jose), started 11:57:36 PM, good state; Discord `commands` 11:57:39 PM: "Worker started at 11:57 PM CT (paper): new release YJVHBNW0 (was P658BC7X): a deploy. Starts in the last hour: 2." (the second start is v11's, 16 minutes earlier). Healthchecks up (11:58:11 PM). Monday's request pending, stop flag and not-flat flag off.
- **Monday's limits list** (rendered read-only with the deployed code from Monday's record, as the 7:30 AM review and every limits reply show it): line 3 "at most 100 orders a minute, no daily total; the ceiling is 100 (150 on a load day)" (after `load on`: "the ceiling is 150 on this load day"), line 5 "mode: normal (`load on` makes it a load day)". The evening post itself (3:10 PM Friday) came from v10 and shows the old line 3; the live lines give the exact command.
- **Live line, `commands`:** "Fly release v12 is live (paper only): early wake-ups in sales and the close-out are now limited (no extra look when the request budget is near the reserve, at most 5 per wait), passed its review. Everything else as in v11; the reserve stays 80. Load day at up to 150 a minute: before 7:45 AM Monday send `load on` / `trades 150` / `approve`, one per line."
- The Monday brief needs no change for v12 (it measures the same things; it already names v11 or v12). The 3:15 PM Monday wait is kept.

**Next (Michael's standing approval):** the scaled reserve (item 7), re-derived under spread update timing with the early wake-up limits, with round 3's test notes, in further group 1 rounds; deployed only if a round passes.

## The scaled reserve, round 4 (2026-11-07, early morning): CHANGES REQUIRED. Stopped for Michael; nothing new deployed, v12 stays.

The change (branch `reserve-scale`, `c46e24c`, not merged): `reserveFor(n) = min(80, 59 + 2n)`, switched on, re-derived from the timed-look draw under spread update timing with the wake-up limits (cancels to 11 seconds, 8 random draws per case: worst 41 + 2n), plus 8 for the dip at sustained load, plus 10 left; tests at 0 to 10 open symbols (360 cases), round 3's test notes. Details are in that branch's log.

**Round 4's blocking finding: the derivation was under-sampled.** Over 60 random draws (the test's own helper, the flatten command with 11 second cancels, starting 8 below the reserve), the lowest left was 6 at 8 and 10 open symbols and 8 at 3 and 5 (about 10 percent of draws at 3 to 10 open symbols below 10 left), so the worst draw is about 45 + 2n, not 41 + 2n. No rate-limit answer in any run. With a floor of 58 the 360-case test fails, so its 5 seeds sat at the margin. The reviewer's fix: re-derive from 60 or more draws (a floor of about 63 with 2 per symbol, the cap of 80 from about 9 open symbols), more seeds in the test, correct the comment and log; and weigh whether the scaling (at most about 17 requests freed, below about 9 open symbols) is worth more rounds. Also noted: the branch's release 11 flatten test lost its margin bound at the sizes where the reserve is 80.

**Why stopped:** round 1's finding was "the reserve formula is too small"; it was fixed twice (52 + n, then 59 + 2n), and round 4's finding is the same kind again. Michael's weekend approval says to stop and ask "if the same finding comes back after two fixes", and then deploy nothing new. Rounds used under that approval: 2 of 8 (round 3 PASS, round 4 CHANGES REQUIRED).

**Agreed outside this scope (for Michael):** from about 16 open symbols with 11 second cancels and spread updates, the flatten command's timed looks can exceed what a reserve of 80 covers (deployed v12 too); Michael's item 7 test ("a full flatten at the maximum open positions never hits a rate limit") cannot be fully met at 30 open symbols with 11 second cancels under the cap of 80. Covering it needs lighter polling in the flatten command (other money-touching code) or a reserve above the cap.

Other notes: the reserve can be stale low by one symbol for up to about 10 seconds (the view refresh reading rows before the gate's insert), never for an entry (each entry recounts); with the scaling on, the view refresh, the loss stop's retry and the early wake-up threshold spend lower (probed: no rate-limit answer, lowest 34 or more). Paper only.

## Michael's decisions after the scaled reserve's round 4 (2026-11-07, early morning)

- **Item 7: "Drop the scaling."** The reserve stays fixed at 80 for good (v12 as deployed). The open-symbol count and the per-minute reserve statistics stay; the scaled formula stays switched off (`RESERVE_SCALING = false`). The branch `reserve-scale` is left unmerged, as the record. No more rounds this weekend.
- **The flatten command's slow-cancel corner: "Propose next week."** After Monday, a short proposal for lighter polling in the flatten command (fewer looks while cancels are pending, sized by the request budget), with the simulator numbers. No code until Michael approves.
- **Added to the same proposal (Michael, 2026-11-07): the loss stop's retry budget.** After the daily loss stop fires, entries are blocked, so propose raising the retry's request budget above 60 a minute (`LOSS_STOP_REQUESTS_PER_MINUTE` in `risk.ts`), sized to what routine work leaves after the stop, and never below the reserve of 80. The proposal must show, in the simulator, how much this shortens the time positions sit without exits (30 open symbols, slow cancels), and how much of that time is Alpaca's own cancel time, which the stack cannot shorten. Context: on 2026-11-07 the simulator showed the loss stop's first sale is one round (13 to 42 requests, lowest remaining 30 from a start 8 below the reserve, no rate-limit answer, so it does not share the flatten command's thin margin), but with 7 second cancels it left 7 to 30 of 30 positions unsold. Those go to the retry, which may wait for room because the first sale's requests count against the 60. The retry also has a per-check cap of 15 requests every 5 seconds (`LOSS_STOP_RETRY_PER_CHECK`), which would bind if only the 60 were raised, so the proposal covers both caps. No code until Michael approves.

**Where this leaves Monday:** Fly release v12 (release 11 with the reserve at 80, plus the early wake-up fix). `builds/monday-review-brief.md` needs no change (it measures the reserve in force, now always 80). The 3:15 PM Monday wait is set (only while this Claude session stays open). Paper only.

## Monday 2026-11-09 session review (release v12, fourth load day at up to 150 orders a minute; written after the close, read only)

Run from `builds/monday-review-brief.md`. Read only on Fly, Alpaca, Supabase, Discord and Healthchecks: no code changed, nothing deployed, no orders placed. **The 3:15 PM scheduled run did not happen:** the Claude session that held the wait had an expired login and stopped within a second ("Login reached its time limit"). Michael logged in again and this review ran from a new session at about 4:10 PM. Paper only. Research input for a human decision, never an instruction to act.

**Monday's setup:** Fly release v12 (one machine, San Jose, running since 2026-11-06 11:57 PM, no restart Monday). At 7:43 AM Michael sent `load on` / `position 500` / `loss 500` / `trades 150` / `cap 1`, so Monday was a load day with 150 orders a minute in force all day. The reserve was 80 in every minute (scaling off). Armed 8:25 AM, day start 18,709.08 dollars.

### Headline

- **The load window held on speed and rate limits:** 1,536 limit entries in 15 minutes, Alpaca refused none, 0 rate-limit answers all day.
- **The day as a whole does not hold under Michael's rule, because safety sales were delayed:** from 9:10 to 9:42 AM, four positions (IONQ, CMCSA, APLD, NCLH) sat at Alpaca with no exit for 16 to 28 minutes. The stack saw each one and tried to sell it every 30 seconds or so, but each attempt sent no sell, and it posted 64 "has no protective stop and I could not sell it" alerts, each mentioning Michael. Then, between 9:37 and 9:42, all four sold without any visible change at Alpaca. The money was small (the six late sales together came out +1.08 dollars), but this is money-touching behaviour and v12 still has it.

### 1. The load window, 8:45 to 9:00 AM

Michael's rule (2026-11-06): "report the highest accepted orders a minute; it holds if there are no rate-limit errors, remaining requests never drop below the reserve in force, no safety sale is delayed, and the close-out is flat."

**Highest accepted orders a minute: 119 in a calendar minute (8:50), 138 in the busiest 60 seconds (ending 8:51:21).** Never 150. Before the governor held anything back (8:45 to 8:50) the limit was the live list itself: 30 symbols, each blocked while its entry works (up to 5 seconds) or its position is open. In the window, 1,706 entries were refused for "already holding this symbol" and 984 for "an entry for this symbol is still working". From 8:51 the reserve held entries back.

| Minute | Entries sent (all accepted) | Filled | Requests in the 60 s before the stats line | Lowest remaining | Remaining minus the reserve (80) | Governor holds |
| :-- | --: | --: | --: | --: | --: | --: |
| 8:45 | 105 | 51 | 80 (to 8:45:14) | 183 | 103 | 0 |
| 8:46 | 107 | 53 | 246 | 140 | 60 | 0 |
| 8:47 | 113 | 48 | 219 | 124 | 44 | 0 |
| 8:48 | 115 | 54 | 220 | 108 | 28 | 0 |
| 8:49 | 97 | 48 | 191 | 100 | 20 | 0 |
| 8:50 | 119 | 58 | 177 | 114 | 34 | 0 |
| 8:51 | 112 | 52 | 255 | 76 | -4 | 25 |
| 8:52 | 101 | 51 | 199 | 74 | -6 | 65 |
| 8:53 | 112 | 55 | 198 | 75 | -5 | 4 |
| 8:54 | 101 | 63 | 188 | 80 | 0 | 4 |
| 8:55 | 100 | 45 | 183 | 94 | 14 | 0 |
| 8:56 | 101 | 48 | 215 | 93 | 13 | 0 |
| 8:57 | 71 | 34 | 164 | 91 | 11 | 0 |
| 8:58 | 88 | 49 | 172 | 134 | 54 | 0 |
| 8:59 | 94 | 53 | 195 | 165 | 85 | 0 |

The per-minute statistics lines are written about 30 seconds after each calendar minute, so the request, remaining and holds columns cover the 60 seconds before that line, not exactly the calendar minute.

- **Rate-limit errors:** 0 (`rateLimitAnswers` 0 in every line all day; no 429 in the run log).
- **Remaining against the reserve:** lowest 74, so 6 below the reserve of 80, at 8:52. Also -4 at 8:51 and -5 at 8:53. Spending then: about 100 to 126 entries a minute, about 60 cancels a minute of unfilled entries (each 5 seconds after acceptance), the 10 second order sync, the view refresh and the loss stop's reads. Up to 255 requests in 60 seconds were accepted without a refusal (Alpaca's allowance refills continuously, as Friday).
- **Governor holds:** 98 in all, all between 8:51 and 8:54 (102 refusals name the request budget; 4 of them also say the account view was too old). Every hold reads "down to 74" to "down to 80".
- **Did any entry spend below the reserve? Inconclusive.** The gate sends entries one at a time and the governor lets an entry through only when its estimate (Alpaca's last remaining plus refill since) is at least 81. But cancels and syncs run beside the gate, and nothing records which request each low reading came from, so the records cannot show that no entry landed while Alpaca's true count was under 80. Michael's ruling counts dips from safety work as reported, not failed; the dips here (up to 6) are the size the Friday rehearsal predicted (1 to 7). What would turn this into a measurement: log, for each Alpaca answer under the reserve, the request's kind (entry, cancel, sync, view, sale) and the remaining it reported.
- **Filled entries (separate note):** 762 of 1,536 filled (34 to 63 a minute; busiest 60 seconds 69). Alpaca's day listing left out 21 window entries; they were fetched one by one by client id, so the table and these counts include them. 774 cancelled unfilled; the cancel landed a median 5.0 seconds after acceptance (4.5 to 13.0).
- **Refusals by reason in the window:** already holding 1,706; still working 984; before 8:45:00 55; request budget 102. Alpaca refused 0.
- **Decision to acceptance:** typical 132 ms, 95th percentile 360 ms, slowest 2,631 ms.
- **Cost:** the window's entries, their exits and the three lost-exit sales, from Alpaca's order records: -9.74 dollars.
- **Safety sales in the window:** none waited on a rate limit or the governor. The three lost-exit sales were slower than the target (see 2).

**Verdict:**
- **The load window on its own:** holds on rate limits, Alpaca refusals and safety sales. The reserve criterion is inconclusive (dips of up to 6, consistent with Michael's allowed safety-work dips, not provable from the records).
- **The day under Michael's words** ("no safety sale is delayed", "the close-out is flat", which reach past 9:00): **does not hold**, because safety sales were delayed for 16 to 28 minutes from 9:10 (section 5). The brief's own reading ("a sell ... that waited on a rate limit or the governor") would miss this; it is scored here on Michael's words.

### 2. Release 11 in action

**Lost exits (item 1).** Three window entries filled at the moment the 5 second cancel reached Alpaca, and Alpaca cancelled both exits, the same case as Friday's six (the stack's own summary agrees: "closed later or still open 3"):

| Entry | Entry filled | Second exit cancelled | Sale sent | Sale filled | Cancel to sale sent | Cancel to sale filled |
| :-- | :-- | :-- | :-- | :-- | --: | --: |
| HL-3 | 8:45:39.930 | 8:45:42.286 | 8:45:47.357 | 8:45:48.717 | 5.1 s | 6.4 s |
| IONQ-7 | 8:46:11.638 | 8:46:12.273 | 8:46:15.671 | 8:46:17.866 | 3.4 s | 5.6 s |
| IONQ-110 | 8:59:23.310 | 8:59:23.366 | 8:59:26.225 | 8:59:26.935 | 2.9 s | 3.6 s |

- Target was 1 to 2 seconds to the sale: **missed** (2.9 to 5.1 s), though better than Friday (4.6 to 13.9 s). The missing-exit check logged each 1.3 to 2.0 seconds after the cancel; the sell path then took 3.8 s (HL) and about 1.5 s (both IONQ) before sending. HL's extra time inside the sell path may be the same "Alpaca still shows the shares held" lag as section 5 on a short scale: a possible link, not shown.
- Two more entries lost both exits later (APLD-108 at 9:16:16, NCLH-42 at 9:26:55), apparently cancelled by the stack itself (section 5). The immediate sync could not run for them (a sync was already running), and they sat 22 and 16 minutes.

**The summary against the account (item 2): matches to the cent.** Summary: 18,709.08 to 18,640.93 (-68.15), closed trades -68.15. Alpaca: equity 18,640.93, previous close 18,709.08, cash 18,640.93; from the day's 7,135 fills, 9,079 shares bought and 9,079 sold, realised -68.15. The summary looked up the 79 orders missing from Alpaca's listing, with 0 failed lookups (Fly log line at 4:05 PM). Counts agree with Alpaca: 2,896 entries, 2,122 filled, 774 cancelled unfilled, 1 refused. But the summary says nothing about the four positions left without exits or the 64 could-not-sell alerts.

**Stop-gap sales and their measurement (item 3).**
- 52 sales, 108 shares. (The stack's live-update counter `stopGaps` reads 512 for the day: stop cancels it saw after a partial take-profit, not de-duplicated, and Friday found Alpaca repeating cancel updates. That most of the others finished at the take-profit within the 3 second wait is a likely explanation, not measured.)
- From Alpaca's cancel of the stop to the sale sent: median 5.5 seconds (the 3 second wait plus up to one sync), sale sent to fill median 1.1 seconds (at most 3.5). The 5 sales between 9:10 and 9:43 waited 35 to 124 seconds (median 72) because the sync was busy with the stuck positions; one APLD sale at 9:58 waited about 125 seconds.
- The stack measured all 52 this time (Friday: 4 of 103): "15 would have filled at their take-profit within the next 5 seconds; selling at once came out +0.20 dollars against waiting 5 seconds".
- **Spot check against the free feed's prints:** in the 5 seconds after each sale was sent, a print at or above that bracket's take-profit appeared for 15 of the 52, matching the stack's 15.

**The scaled reserve:** switched off (Michael dropped it on 2026-11-07). The reserve was 80 in every minute (`reserveThisMinute` min and max 80 all day).

### 3. The shadow loss-stop book against the 5 second account check

- The book was set once (8:25 AM) and never reset: 7,135 fills applied (every fill of the day), 2,272 checks against later account reads with a cash gap of 0 every time (`maxCheckCashGap` 0), never dropped.
- Largest gap against Alpaca's equity: **1.28 dollars**, at 1:40:41 PM (Alpaca 18,646.00, book 18,644.72); at most 6.9 seconds since the last fill at that point. Per-minute largest gap: median 0.32 dollars, 90th percentile 0.63.
- No estimate at most 3 times in any minute.
- Alpaca's position list lagging fills: no sign (no cash gap in any check, no base skipped).
- **Ready to become the main loss stop?** The data supports writing a proposal: one full day, a 1.28 dollar worst gap against a 500 dollar loss stop. Making it the main loss stop is money-touching, so it is Michael's decision.

### 4. The rest of the day, the close-out, the summary and Discord

- **Rest of the day:** 1,360 market entries, all filled (busiest minute 31). Closed by take-profit 735, by stop 566. One entry refused by Alpaca: ONDS at 11:48 AM, "take_profit.limit_price must be >= base_price + 0.01" (a take-profit rounded onto the base price).
- **Close-out, 2:55 PM: flat.** One position (ADT, 7 shares): cancels sent and answered in 87 ms, sale at 2:55:13, done at 2:55:32 (18.4 seconds of waiting). Alpaca after it: no positions, no open orders.
- **Summary:** matches the account (section 2). Its refusal line is cut off mid-word ("the la: 52") and names only one of the request-budget refusal groups (52 of 102). Estimated fees 2.26 dollars (running total 16.12). Alpaca's fee activity read answered 422 in this review, so the fees were not checked against Alpaca.
- **Discord:** 201 messages Monday against 172 Friday: `alerts` 122 (Friday 93), `trading` 74 (74), `commands` 5 (5). 64 of Monday's alerts are the repeated could-not-sell alerts, each mentioning Michael (about one every 30 seconds from 9:10 to 9:42).
- **Health:** Healthchecks shows no outage since 2026-11-04. The live order updates stayed connected all day (0 reconnects; symbols freed typically 46 ms after the exit filled).

### 5. What did not behave as designed

**5.1 (money-touching): positions without exits that the stack could not sell, 9:10 to 9:52 AM.**

| Entry | Exits gone | How | Sold | Without exits |
| :-- | :-- | :-- | :-- | --: |
| IONQ-125 (1 share left) | 9:10:24 | Alpaca cancelled the stop at a partial take-profit; the stack cancelled the take-profit's rest at 9:10:28 | 9:38:48 | 28 min |
| CMCSA-51 (2 left) | 9:17:37 | the same; take-profit's rest cancelled 9:18:21 (44 s, the sync was busy) | 9:37:54 | 20 min |
| APLD-108 (4) | 9:16:16 | both exits cancelled 10 s after the entry filled, nothing filled | 9:38:06 and 9:38:09 | 22 min |
| NCLH-42 (4) | 9:26:55 | both exits cancelled 31 s after the entry filled, nothing filled | 9:42:41 | 16 min |
| APLD-114 (2) | 9:50:28 | partial take-profit | 9:51:14 | 46 s |
| IONQ-130 (1) | 9:51:21 | partial take-profit | 9:52:07 | 45 s |

What the records show:
- **First seen Monday, on v12.** Thursday 2026-11-05 (v9) and Friday 2026-11-06 (v10) had no could-not-sell alert (their Discord records searched). So it may be linked to what changed since (v11 and v12, the 150 ceiling) or to Alpaca on the day; not known which.
- Each attempt ran the sell path (3 rounds, about 30 seconds) and ended with no error and "still held". So no sell was sent: in every round the sell path found no shares free to sell. It reads Alpaca fresh each round, so Alpaca itself was reporting the shares as held, either by an open order or by fewer shares free to sell (`qty_available`) than held.
- Alpaca's order history shows no open order on IONQ between 9:10:28 and the sale at 9:38:46, so the likelier of the two is `qty_available` staying below the position after the exits were cancelled. **This is a guess, not a measurement.**
- The four were released between 9:37:53 and 9:42:37 with no order change at Alpaca on those symbols. The APLD sale went out as 3 shares, then 1 share 2.5 seconds later, as if the free count came back in steps.
- Nothing recorded the free count: a failed attempt writes no `liquidation_result` to the run log, and Fly keeps only the last 100 log lines. What would measure it next time: log, for each symbol a sale skips, the position's `qty`, `qty_available`, the open sell quantity the stack counted, and the ids of the orders it counted.

**The stack cancelled two fresh brackets' exits (inferred, strong evidence).** APLD-108's exits were cancelled 0.5 seconds after an attempt on IONQ ended (9:16:16.3). The next alert, at 9:16:45, was for APLD and gave the reason of a remainder sale ("Alpaca cancelled the stop when the take-profit partly filled"). APLD-108 never had a partial take-profit; the previous APLD bracket (APLD-107) had, but it had finished at its take-profit at 9:15:56, before APLD-108 was bought. NCLH is the same: NCLH-41's stop was cancelled at a partial take-profit at 9:25:40 and it finished at 9:26:02, NCLH-42 was bought at 9:26:24, and its exits were cancelled 0.7 seconds after the APLD attempt ended (9:26:54.7), followed by an NCLH alert with the remainder reason. The mechanism this points to:
- The order sync runs one at a time and works from the order list it read at its start.
- With stuck positions, each attempt held the sync for about 30 seconds, so later symbols in the same sync were handled with a list 30 to 60 seconds old.
- On that old list the previous bracket still looked like a remainder. The remainder sale cancels every open order of the symbol, which reached the new bracket's exits, and the new shares then got stuck too.

**Knock-on effects:** remainder sales on other symbols waited 35 to 124 seconds instead of about 5; the lost-exit immediate sync could not run while a sync was in progress.

**The cost:** the six late sales came out +1.08 dollars against their entries (by chance; at most 4 positions and about 222 dollars were exposed at once, 9:27 to 9:37). The loss stop never came close.

**5.2 Lost-exit sale time** missed its 1 to 2 second target (2.9 to 5.1 s; section 2).

**5.3 The summary** does not report positions left without exits or failed sales, and its refusal line is truncated (section 4).

**5.4** The 3:15 PM review did not run (expired login on the session holding the wait).

### Recommended next steps (under the standing rule: nothing below is built until Michael approves)

1. **Tuesday 2026-11-10, Michael's decision tonight. Recommended: approve the logging-only change in step 2 tonight and trade a normal day (not a load day) on it.** v12 still has 5.1 and nothing can be deployed during market hours, so a normal Tuesday carries the same exposure; with the logging it at least produces the measurement this review could not make, and without it a normal Tuesday repeats the exposure and teaches nothing new. If the logging is not approved, the alternatives are: a normal day on v12 as is, watching `alerts`; or a rollback to v10 before 7:30 AM (v10 showed no stuck sales on Friday, but it loses release 11 and it is not known that it avoids 5.1). Doing nothing means no trading Tuesday: any limit undecided at the open stops the day.
2. **A logging-only change, deployable before 7:30 AM if approved and reviewed:** for every symbol a sale skips, log `qty`, `qty_available` and the open sell orders counted. Store failed liquidation attempts in the run log. Log each Alpaca answer under the reserve with its request kind. This changes no decision, but it touches the sell path's file, so it goes through group 1.
3. **A proposal, no code (money-touching):** (a) a sale must not hold the order sync for 30 seconds per stuck symbol; (b) a remainder sale re-reads that bracket before cancelling anything, and cancels only that bracket's own exits, never a newer bracket's; (c) what to do when Alpaca keeps reporting shares as held, for example asking Alpaca's support about `qty_available` after an exit is cancelled on paper.
4. **Messaging (group 2):** one could-not-sell alert per position, then a reminder every few minutes rather than every 30 seconds; the daily summary lists positions that went without exits, for how long, and failed sales; fix the truncated refusal line.
5. **The shadow book:** a proposal to make it the main loss stop, with the 5 second account read kept as a check, if Michael wants it.
6. Still pending from 2026-11-07: the proposal on lighter polling in the flatten command and the larger loss-stop retry budget.
7. **For the next load day:** 150 a minute is not reachable with a 30-symbol list and these window settings (the list bound it at about 110 to 120, then the reserve). Raising it would need more symbols (the free data feed caps the live list at 30) or shorter holds.

## Michael's decisions after the Monday review (2026-11-09, evening)

1. **Approved: a logging-only change** recording why a sale is blocked (Alpaca's held and available quantities, the open orders counted, the order list's age). Review and deploy before 7:30 AM Tuesday.
2. **Write the proposal now** for the stuck sale fix, the cleanup sale never cancelling a newer position's exits, and one alert per stuck position. If Michael approves tonight: build, review and deploy before 7:30 AM if it passes.
3. **New, in the same document: a mid-day cycle** (trade from the open to 10:30 AM, a mid-day close-out with the 2:55 close-out code, deploys allowed only while flat and paused, resume under the same day's limits, a resume or keep-paused command, paused from 1:30 PM if nothing was deployed, a start-up with no positions not selling everything, a mid-day review brief).

Standing approval for tonight: up to two review rounds per group.

## The sale logging change (built 2026-11-09, evening; branch `sale-logging`)

Logging only: nothing that sends, cancels, sizes or blocks an order changed, and no request to Alpaca was added (the logs use the reads the sale already made).

| What | Where |
| :-- | :-- |
| `sale_blocked`: each time a sale skips a symbol because its shares are not free, the symbol, round, the sale's reason, Alpaca's `qty` and `qty_available`, the open sell quantity counted, the open sell orders counted (up to 5: id, the entry's client id, type, status, quantity, filled), how old the open order list was, how long the round waited | `sells.ts` (`Liquidator.run`, step 3; new `openSellOrdersFor`) |
| `liquidation_result` also for an attempt that sold nothing, met no error and left shares held (Monday's attempts left no trace), with the number of blocked skips | `sells.ts` (`done`) |
| The order sync's list age (`listAgeMs`) and the entry's client id on `unprotected_position` and `bare_remainder` | `risk.ts` (`syncOrders`) |
| `sale_blocked` and `bare_remainder` kept in the database run log | `run-log.ts` |

**Not included** (not in Michael's approval): logging each Alpaca answer under the reserve with its request kind (recommended in the Monday review).

**Tests:** 445 pass (6 added in `test/sale-logging.test.ts`; the simulated broker gained a fault, `staleHeld`, for shares Alpaca keeps reporting as not available). A test runs the same blocked and clean sales with and without the log and checks the requests, sells, outcome and simulated time are identical. Type check clean. Each piece taken out on its own fails a test: 10 of 10.

Volume (estimate, corrected after review): a stuck symbol adds about 8 to 11 rows a minute to the run log (3 skips and 1 result per attempt of about 30 seconds, plus `bare_remainder` at up to one per sync); Monday's four stuck positions would have made about 1,000 rows.

### Group 1 review, round 1 (2026-11-09, evening): PASS

No blocking finding. The reviewer confirmed: every logged value comes from reads the sale already made; `openReadAt` and `blocked` feed only logs; the widened `liquidation_result` condition changes only whether a line is logged; nothing in the code reads these events back (the summary and every count are unaffected); no secret can enter the new fields; 445 tests pass, type check clean; and its own added-request mutation was caught by the with-and-without-log test. Non-blocking notes: the volume figure above was low (corrected); the database pool has 3 connections, and a blocked whole-account sale could queue up to about 120 fire-and-forget inserts beside order recording (expected small); the with-and-without-log test covers the sell path, not the sync (the sync gained only clock reads); a log call that threw would reject the sale, but this callback cannot throw on these plain values, and a guard there would be a sell-path change needing Michael's say.

### Deploy (2026-11-09, 5:35 PM Central, market closed): Fly release v13, the sale logging

- **What shipped:** `c2a8216` (`main`): v12 plus the sale logging (group 1 round 1 PASS). 445 tests pass. `fly deploy --ha=false` from a separate checkout with no key file in it.
- **Fly release v13:** one machine (San Jose), started 5:35:05 PM, good state. Discord `commands`, 5:35:08 PM: "Worker started at 5:35 PM CT (paper): new release CASQMWKX (was YJVHBNW0): a deploy. Starts in the last hour: 1." Healthchecks up (5:35:09 PM). Stop flag off, not-flat flag off. Tuesday 2026-11-10's request pending (posted 3:10 PM).
- **Live line, `commands`:** "Fly release v13 is live (paper only): logging only, reviewed PASS. When a sale cannot go out, the run log now records why (Alpaca's held and free shares, the open orders counted, how old the order lists were). No trading behaviour changed. Tuesday's limits still need your decision before the open; with nothing decided there is no trading Tuesday."

**Next:** Michael's decision on `builds/c2-proposal-2026-11-09.md` (parts A to C for tonight, the mid-day cycle later).

## Michael's decisions on the proposal (2026-11-09, evening)

"Change of plan: build the mid-day cycle (Part D) tonight too, as written in builds/c2-proposal-2026-11-09.md."
1. **Release 1:** A steps 1, 2 and 4, B and C (A step 3 held until Tuesday's logs). Group 1 and group 2 reviews, up to two rounds each. Deploy as soon as group 1 passes.
2. **Release 2:** part D on top of release 1. Its own group 1 review, up to three rounds, plus group 2 for its messages. Deploy before 7:30 AM Tuesday only if group 1 passes. If it is not ready, deploy nothing more, and Tuesday's cycle runs by hand (stop, flatten, deploy while flat, resume), approved as a fallback.
3. **D's answers:** a plain restart during the pause stays paused; the commands are `go` and `hold`; automatic resume after a deploy unless `hold` is set; the pass rule is the daily rule with "the mid-day close-out is flat by about 10:35" in place of the close-out; the deploy script pauses the Healthchecks check during a mid-day deploy. The CLAUDE.md deploy-rule exception written as proposed (done); `builds/midday-review-brief.md` updated with the pass rule.
4. After each deploy: one clean start, Healthchecks up, stop and not-flat flags off, and the "live" line saying whether the mid-day cycle is automatic or manual for Tuesday.

## Release 1 of 2026-11-09: the stuck sale, the cleanup sale, one alert per stuck position (built 2026-11-09, evening; branch `release-r1`)

Michael's approval: parts A steps 1, 2 and 4, B and C of `builds/c2-proposal-2026-11-09.md` (A step 3, selling past Alpaca's free count, held until Tuesday's logs). Money-touching: A and B (group 1). Messaging: C (group 2). Paper only.

### What changed

| Part | Change | Files |
| :-- | :-- | :-- |
| B1, A2 | Before every missing-exit or remainder sale, the entry is fetched again by its client id (one request). If its exits have sold every share, or (missing exit) it has a live exit after all, or (remainder) its stop is live, nothing is cancelled or sold (`cleanup_skipped` logged). If the lookup fails, the sync's own copy is used, as before. | `risk.ts` (`cleanupSale`) |
| B2 | That sale cancels only that entry's own live exits, by id from the fresh copy (which also reaches exits Alpaca's open list does not show); in later rounds only those still shown open. Never another order of the symbol. | `sells.ts` (`ownEntryOnly`), `risk.ts` |
| B3 | At most that entry's own shares (filled quantity minus what its exits sold) are sold in the attempt. The wait after the cancels ends as soon as that many shares are free (a newer position's exits stay open on purpose); there is no wait in an attempt that cancelled nothing. Once those shares are sold and the holding has fallen by that much, the attempt stops looking. | `sells.ts` |
| B4 | Enforced through B1 to B3: an older entry acts only on its own shares and its own exits, so a newer entry on the same symbol keeps both. (No separate check of the stack's records: the fresh copy is the authority.) | |
| A1 | A round that sells nothing because every symbol still to sell is held with no open order visible, in an attempt that cancelled nothing, ends the attempt (`hiddenHold`). The entry is then retried after 5 seconds, then 10, 20 and at most every 30; a sync before it is due skips it and carries on with the others. A hold explained by visible orders (a cancel still landing) keeps the old waits and is retried at the next sync, as before. A cancel sent in the same attempt counts as an explanation even when the open list hides the order (found by the existing slow-cancel test). | `sells.ts` (`endWhenHiddenHold`), `risk.ts` (`SyncMemory.stuck`) |
| A4, C | One alert when an entry is first stuck (mentions Michael): "X has N shares with no protective stop, and I could not sell them yet (why). I keep trying and will post once it is sold." One after 5 minutes stuck (mentions Michael): "... still has no protective stop after 5 minutes, and I still cannot sell it (why). Please close it in Alpaca's dashboard. I keep trying." One line when it resolves, no mention: "X: sold after N minutes without a protective stop." (or "no longer held", "sold by its exits", "protected again"). Nothing in between. The unchanged messages for a sale that works at once ("had no live protective stop, so I sold it", the remainder batch, "sent a sell ... not filled yet") are kept; the last one now also covers a missing-exit sale whose sell has not filled. | `risk.ts` |

Not changed: the close-out, the flatten command, the loss stop, the carried-position sale, the sell gate's two checks (held minus open sells, and Alpaca's free count), the grace time, the governor.

### Requests

A Monday-style stuck symbol: one attempt of at most about 10 requests and under 2 seconds (was 3 rounds, about 30 seconds and about 60 requests), every 5 to 30 seconds. Each cleanup sale adds one lookup (52 remainder sales on Monday). A cleanup sale beside a newer position: 12 requests and 1 second in the simulator (22 and 3 without stopping once its own share has filled).

### Tests

454 pass (9 added in `test/release-r1.test.ts`: Monday's APLD sequence from a stale list; an older entry's 1 share beside a newer position in three visibility modes; a stale list wrongly showing exits gone; Monday's IONQ case through the 5, 10, 20, 30 retries, the 5 minute escalation and the resolution line, three posts in all; a stuck symbol not delaying another symbol's remainder sale; a visible hold; the stop once its own share filled). One existing structure test changed because the structure changed: it counted two cleanup sale calls with `yieldToPriority`; there is now one shared call, used by both paths (the test checks both). Type check clean. Each piece taken out on its own fails a test: 14 of 14 (after adding a no-free-count case for the cap and a request-count test for the stop once filled, which the first run let through).

### Release 1, group 1 review round 1 (2026-11-09, evening): CHANGES REQUIRED. Group 2 round 1: CHANGES REQUIRED. Fixed.

**Group 1, blocking:** with 8 or more symbols stuck at once, their short retries came due together with no limit on requests, and in the reviewer's simulator harness (80 ms a request, refill 125 a minute for routine work) they drained the reserve: at 10 stuck, 195 rate-limit answers (the old code stayed at 33 or above). Everything else confirmed: the close-out, flatten, loss stop and carried sale are untouched (none passes the new options; every new branch is inert without them), the sell gate is untouched, the APLD case is fixed (all 9 new tests fail on the old code), the hidden-hold rule cannot misread a live exit of the entry's own.

**Michael's choice (asked, 2026-11-09, evening): "Fixed allowance".** Short retries of stuck entries share at most 40 Alpaca requests a minute and 15 in any 5 seconds, like the loss stop's retry; each retry counted at 10 requests (at most 8 measured in the simulator); a retry that does not fit waits for room. A position's first sale is never limited, nor a retry held by visible orders (one full attempt per sync, as before). (`risk.ts`: `STUCK_RETRY_PER_MINUTE`, `STUCK_RETRY_PER_5S`, `STUCK_RETRY_COST`, `takeRetryRoom`, `retryDue`.)

**The reviewer's harness re-run on the fix** (simulator, 3 minutes, 80 ms a request):

| Stuck at once | Refill 200 a minute: lowest left, rate-limit answers | Refill 125 a minute: lowest left, rate-limit answers |
| --: | :-- | :-- |
| 4 | 175, 0 | 165, 0 |
| 8 | 139, 0 | 119, 0 |
| 10 | 118, 0 | 98, 0 |
| 12 | | 81, 0 |
| 15 | 81, 0 | 56, 0 |

The lowest point is set by the first sales, which all run at once (unlimited by Michael's choice): at 15 stuck with routine work modelled it dips 24 below the reserve, with no rate-limit answer (a dip from sales, reported under Michael's ruling of 2026-11-06). The retries themselves stay inside the allowance.

**Group 2, blocking, fixed:** (1) an entry reported stuck whose record was closed elsewhere (the live updates close a record when an exit fill leaves the symbol flat) got no resolution line: now the sync posts it when it prunes the entry, also on its early return with nothing open; (2) the first alert did not say since when: it now says "since 9:10 AM CT" (the latest cancel or expiry among the entry's own exits as Alpaca reports it, else the moment found). Also from both reviews: an entry reported stuck that stops being the newest on its symbol now gets a resolution line; singular and plural fixed ("1 share", "1 second"); the first alert ends "I keep trying and will post again when they are sold or gone"; resolution lines read "IONQ: sold (28 minutes after I reported it without a protective stop)." (or "no longer held", "its own exit orders sold the shares", "it has a live exit again", "a newer IONQ position took over, and I watch that one now"); a stale comment in `worker.ts` corrected.

Known and accepted (non-blocking): the stuck state lives in memory, so a restart starts it again (a still-stuck position gets a fresh first alert); the minutes in the resolution line count from the first report, not from when the protection was lost; a retry after a partial sale aims at the entry's full own count again (the gate's held-minus-open check and the newest-entry check still apply).

**Tests:** 460 pass (6 more in `test/release-r1.test.ts`: the allowance's arithmetic; ten stuck at once (all first sales at once, then at most 4 retries a minute and 1 in 5 seconds, the bucket at or above 80, no rate-limit answer, one alert each); a record closed elsewhere, with and without another position open; an entry no longer the newest; a stuck remainder on the short list on both paths; the part B and RIOT tests now also count every alert line). Type check clean. Each piece taken out on its own fails a test: 21 of 21.

### Release 1, round 2 (2026-11-09, evening): group 2 PASS; group 1 STOP AND FLAG MICHAEL. Release 1 is not deployed.

**Group 2, round 2: PASS.** Both round 1 findings fixed; every way a reported entry can end now posts one line; wording, plurals, footer and mentions checked. Non-blocking: the stuck state is in memory (a restart starts it again); the "since" time can show the stack's own take-profit cancel when a position is first reported on a later attempt (at most about a minute late); escalation can come later than 5 minutes when many are stuck (the text gives the real minutes).

**Group 1, round 2 (the last allowed): STOP AND FLAG MICHAEL.** The burst is fixed, first sales and visible-hold retries are never limited, and the counting is right. **Blocking: the allowance starves stuck positions beyond the first four.** It fits 4 retries a minute; when there is no room every due entry is moved to the same next-room moment, and the sync walks entries in the same stored order, so the same entries win every minute. Measured in the simulator (80 ms a request, 10 minutes): 5 stuck: the first 4 tried 10 to 12 times each, the 5th only its first sale and never again, and no 5 minute alert for it; 8 stuck with entries 5 to 8 freed by Alpaca at 60 seconds while 1 to 4 stay stuck: none of the 8 sold in 10 minutes; all 8 freed at 60 seconds: entries 5 to 8 sold only at 127 to 142 seconds. The round 1 code and the old code tried every stuck entry on every attempt. Non-blocking: "a newer position took over" clears the older entry's stuck state even if it still held shares (rare: the gate refuses an entry on a symbol already held); an entry pushed back keeps its short-retry state if its hold later becomes visible.

**The reviewer's fix options (all keep 40 a minute and 15 in 5 seconds):** give the room to the entry that has waited longest (or take turns); make the 5 minute alert depend on time, not on a retry; a test with 5 or more stuck where Alpaca frees one late in the order, sold within about a minute. Under the standing rule of 2026-11-03 these go to Michael before anything is built. Release 1 stays on branch `release-r1` (`28739a2`), not merged, not deployed. Fly stays on v13. Release 2 continues under its own reviews; Michael's contingency (2026-11-09): if release 1 fails, release 2 may deploy on top of v13 if its group 1 passes.

### Michael's decision after release 1's STOP AND FLAG (2026-11-09, evening), and the fix

Asked with the finding: **"Fix + one more round"**: give the allowance's room to the stuck position that has waited longest (taking turns, still 40 a minute and 15 in 5 seconds), send the 5 minute alert by the clock, a test where 5 to 8 are stuck and a late one is freed; one more group 1 round (round 3); deploy before 7:30 AM only if it passes.

**What changed** (`risk.ts`): each stuck entry remembers when it was last tried (`lastTriedAt`); the sync walks entries on the short retry list last, longest waiting first, so the first one due takes the room and the others take turns. The 5 minute alert moved to `escalateIfDue`, run for every stuck entry at the start of each sync (and after a retry), using the reason from its last attempt, so a waiting entry still gets it. Nothing else changed.

**Measured** (the reviewer's own harnesses, simulator, 80 ms a request, 10 minutes): 5 stuck: 9 tries each (before: 10 to 12 for four, 1 for the fifth), 5 alerts at 5 minutes (before: 4); 8 stuck: 6 tries each; 8 stuck with 5 to 8 freed at 60 seconds: those four sold at 67 to 82 seconds (before: never in 10 minutes). The burst runs are unchanged (no rate-limit answer; refill 125: 8 stuck lowest 119, 10 stuck 98, 15 stuck 56 from the first sales).

**Tests:** 463 pass (3 added: five stuck with the last in order freed, sold within 90 seconds; eight stuck with four freed, all sold within 150 seconds and every stuck one tried in turn; eight stuck, exactly one 5 minute alert each by the clock, 16 mentions in all). Type check clean. Take-outs: 23 of 23 caught (the turn order, the last-tried update and the clock-based alert added).

### Release 1, group 1 review round 3 (2026-11-09, evening, the final round, approved by Michael): PASS

No blocking finding. The reviewer confirmed: turns go to the longest waiting (an entry pushed back keeps its place in line); the allowance is unchanged (about 4 retries a minute in total); the 5 minute alert fires once by the clock for every stuck position, with no Alpaca request; first sales and visible-hold retries are still unlimited and now run before any short retry; every entry is still handled once per sync; the close-out, flatten, loss stop and carried paths are untouched. Its harnesses matched the builder's numbers. Non-blocking: the 5 minute alert can still fire while a close-out or the loss stop is selling (it says "I keep trying"); an entry no longer the newest can get its 5 minute alert and its resolution line in the same sync; with 8 stuck each is retried about every 2 minutes (the cost of the allowance).

**Release 1 reviews:** group 1 PASS in round 3 (round 1 CHANGES REQUIRED, round 2 STOP AND FLAG MICHAEL, Michael approved the fix and a third round); group 2 PASS in round 2 (on `28739a2`; round 3 changed no message text).

### Deploy (2026-11-09, 7:07 PM Central, market closed): Fly release v14, release 1

- **What shipped:** `4b580d0` (`main`): v13 plus release 1 (parts A steps 1, 2 and 4, B and C; group 1 PASS in round 3, group 2 PASS in round 2). 463 tests pass. `fly deploy --ha=false` from a separate checkout with no key file in it.
- **Fly release v14:** one machine (San Jose), started 7:07:29 PM, good state; Discord `commands` 7:07:32 PM: "Worker started at 7:07 PM CT (paper): new release HKKQ51FT (was CASQMWKX): a deploy. Starts in the last hour: 1." Healthchecks up (7:07:33 PM). Stop flag off, not-flat flag off. Tuesday 2026-11-10 approved by Michael (normal day: position 500, loss 500, trades 100, cap 1).
- **Live line, `commands`:** "Fly release v14 is live (paper only), reviewed PASS: a cleanup sale now acts only on its own position (it never cancels a newer position's exits or sells its shares); a position stuck without exits is retried on a short list (within 40 requests a minute, taking turns) instead of holding up everything else; one alert when it is stuck, one after 5 minutes, one line when it resolves. The mid-day cycle is manual for Tuesday for now (stop, flatten, deploy while flat, resume); if release 2 passes its review and is deployed before 7:30 AM it becomes automatic, and I will post again."

**Next:** release 2 (the mid-day cycle), review round 1 fixes in progress, then round 2 on top of release 1.
## Release 2: the mid-day cycle (built 2026-11-09, night; branch `midday-cycle`)

Built from `builds/c2-proposal-2026-11-09.md`, part D, with Michael's answers ("Michael's decisions on the proposal" above). Built in parallel with release 1 (the stuck sale, the cleanup sale, one alert per stuck position) and to be put on top of it before review. Nothing deployed. Paper only. Research input for a human decision, never an instruction to act.

### What changed, item by item

| Item | Change | Files |
| :-- | :-- | :-- |
| 1. Times | The pause at the open plus 120 minutes (10:30 AM Central), the automatic resume only before the open plus 300 minutes (1:30 PM Central). A day shorter than 6.5 hours has no cycle. | `midday.ts` (new) |
| 2. The pause | A day-scoped record `midday_pause:<date>` in `control` (`on`, `since`, `reason`, `hold`, `resumedAt`, `resumedBy`, `deployedAt`), not the stop flag. The caching store serves it like the stop flag (1.5 second cache, a write seen at once). The gate refuses every entry while it is on ("paused for the mid-day cycle"), before any request to Alpaca, and looks again just before sending (the entry is then recorded as cancelled, "mid-day pause set before sending"). | `midday.ts`, `caching-store.ts`, `gate.ts` |
| 3. The mid-day close-out | At 10:30 the worker writes the pause, then runs `closeOut()` with the new path `midday` (no close time, so its wait for its own sells is the 60 second default), every 20 seconds until flat, never from the regular close-out time on. Unlike the 2:55 wrapper it never writes the `closeout` phase or the close-out's attempt date, never stops the price stream, never sets the not-flat flag or silences the 2:55 alerts, and `closeOut()` skips the cap change and the "Close-out done" post for this path. The missing-exit check is off while it runs. When flat: day phase `midday` with `middayFlat: yes`; `trading`: "Mid-day close-out done: the account is flat. Paused for the mid-day cycle."; `commands`: the morning in one line (entries sent and filled, P and L against the day's start, rate-limit answers) and what happens next. Not flat: one alert mentioning Michael for the day, then it keeps trying with entries paused. | `worker.ts` (`middayPhase`, `middayMorningLine`, `protectNow`, the pass), `closeout.ts` |
| 4. `go` and `hold` | One word each (anything after the word makes the line not understood). `go` ends the pause only when the mid-day close-out is flat and no stop flag is on (the reply names the daily loss stop when it is that); otherwise "Not resumed: <why>". `hold` sets the day's hold (no automatic resume after a deploy); after a resume it changes nothing and points to `stop`. Owner and command channel only (existing checks); read at start-up if sent while the worker was down. `status` shows the pause, the hold or the resume. `resume` is unchanged. | `morning.ts` (`parseCommand`), `commands.ts` (`handleLine`, `HELP`, `middayStatus`) |
| 5. Start-up while flat and paused | The start note now says whether the release is new (`deploy`, false when its history could not be read) and main.ts hands that to the worker (`setStartInfo`). The start-up decision is made once per start, after this start's first read of commands and after the loss stop's first check since the start: a new release, flat, paused, no hold, no stop flag, before 1:30 PM: the pause ends and `commands` says "Resumed after release X (deployed while flat): same limits as this morning; the loss stop counts from the open."; a plain restart stays paused with an alert; a deploy with `hold`, after 1:30 PM, or with the stop flag on stays paused with a line saying why. No carried-position sale fires on such a start (no position, no not-flat flag); tested. | `start-note.ts`, `main.ts`, `worker.ts` (`middayFollowUps`), `midday.ts` (`startupAction`) |
| 6. 1:30 PM | Still paused, flat and nothing deployed: "1:30 PM: nothing was deployed, so I stay paused. Send `go` to trade until 2:00 PM (the last entry), or nothing." once (day phase `midday1330`). | `worker.ts` |
| 7. Evening summary | One line on the cycle ("Mid-day cycle: paused at ..., flat at ..., resumed at ... (after a deploy / by `go`)" or "stayed paused for the rest of the day"), and, when the worker started after the open, "Restarted at ...; request and live-update figures cover the afternoon only." Shown just before the stop flag line. | `summary.ts` (`middayLines`), `worker.ts` (`middaySummaryLines`) |
| 8. The deploy check | `stacks/cyrus/tools/midday-deploy.mjs --dir <clean checkout>/stacks/cyrus --reviewed <commit> [--after-130] [--check-only]`. Refuses a checkout that holds a key file. Reads only (the day record and the pause in a read-only transaction, Alpaca paper positions and open orders), then the pure `deployRefusals` (in `midday.ts`): today has a cycle; the mid-day close-out finished flat; after the pause time; before 1:30 PM unless `--after-130`; before the close; the pause is on; no position; no open order; `--reviewed` given, at least 7 characters, and equal to the checkout's commit. Only then: pauses the Healthchecks check, then `fly deploy --ha=false -a sib-tech-cyrus` from the clean checkout. Every key is scrubbed from what it prints. Not run against anything real. | `tools/midday-deploy.mjs` (new), `midday.ts` |

### Builder's choices (where the design was silent; the safer option)

1. **No mid-day cycle on an early-close day** (a session shorter than 6.5 hours): the day runs as before.
2. **A deploy does not end the pause while the stop flag is on** (Michael's `stop` or the daily loss stop), as `go` would refuse; it says so.
3. **The start-up decision waits for the loss stop's first check since the start**, so a resume can never come before a loss stop the restart has not seen yet (tested with a slow save of the stop flag).
4. **A start with unreadable start history never counts as a deploy** (stays paused).
5. **`hold` never re-pauses trading that has already resumed**; it points to `stop`.
6. **`go` and `hold` are one word only**, so a stray phrase ("go long") is not taken for a command.
7. **A restart during the mid-day close-out (not yet flat) makes no start-up decision**: once flat it stays paused until `go` (the deploy check refuses a deploy before flat anyway).
8. **A test-only switch**: `WorkerDeps.middayCycle` (on unless false; main.ts never sets it). Five earlier tests about other things whose simulated day crosses 10:30 CT turn it off by name, each with a comment pointing to `test/midday.test.ts`: `day.test.ts` (a full day), `round6.test.ts` (the watchdog near the close), `round8.test.ts` (40 positions), `sells.test.ts` (a sync inside the close-out), `volume.test.ts` (the high-volume rehearsal). Every other test runs with the cycle on.
9. The flatten inside the mid-day close-out logs its reason as "mid-day close-out" (logs only).

### Known, not changed

- An entry already past the gate's last look when the pause is written can still reach Alpaca just after; the close-out's next round (or the 20 second retry) sells it. The 2:55 close-out has the same window (but entries stop at 2:00 there).
- The request figures, live-update counters and entry-expiry counts still restart with the worker (the summary now says so).

### Tests

465 pass (445 before: 20 added in `test/midday.test.ts`; 5 earlier tests opted out of the cycle by name, see choice 8). Type check clean. The simulated day: a full day with slow cancels (pause, mid-day close-out to flat, cap left at 2, price stream left running, the 1:30 note once, the 2:55 close-out and the summary still run, "Close-out done" once); retries every 20 seconds with one alert and none from the regular close-out time on; no double sale when an order sync falls inside the mid-day close-out's wait; an early-close day; restarts (a deploy resumes before 1:30 with nothing sold and the summary's restart line; a plain restart, no start information, after 1:30, `hold` sent while down, the stop flag, all stay paused); the loss stop counting from the open across a restart (150 lost in the morning plus 60 in the afternoon crosses 200); a morning loss past the limit realised at mid-day stays paused after a deploy; the start-up decision waiting for commands; `go` and `hold` with every refusal; the gate's two looks; the caching store; the start note; `closeOut()` on its market-closed branch; the deploy check, each condition on its own.

Each new piece taken out on its own: **46 of 47 caught**. The one not caught: the missing-exit check's mid-day guard in `protectNow`. While the mid-day close-out runs, the sale's own guard (`isLiquidating`) and the order sync's "a sell already working explains a missing exit" check already hold the sync back; the test with a sync inside the close-out's wait passes either way. Kept as a backstop, as for the 2:55 close-out.

| Taken out | Test that fails |
| :-- | :-- |
| the gate's early refusal; its look before sending; the pause as a fast key | the gate (two tests), the caching store |
| the cap left alone (flat, and on the market-closed branch) | the full day; `closeOut()` market-closed |
| the pause time; once flat never again; never from the close-out time on; the 20 second spacing; the pause written first; the flat marker; no `endStream`; no `closeout` phase; one not-flat alert | the full day, the retries (several) |
| the start-up decision waiting for the loss stop's check and for commands; deploy versus plain restart; the start information used | the morning-loss deploy, the `hold` while Discord is down, the plain restart, the deploy |
| hold, stop, 1:30 and plain restart in the start-up rule; the 1:30 note only without a deploy and once | the restarts, the 1:30 note |
| the summary's cycle line and restart line | the full day, the deploy |
| `go`'s refusals (not paused, not flat, a stop); `hold` saved; `hold` after a resume; the status line; one word only | the commands (two tests) |
| the early-close rule; the start note's new-release rule; every deploy-check condition (10) | the early-close day, the start note, the deploy check |

### For review

- **Group 1 (money):** the gate's pause (both looks), the mid-day close-out wrapper and `closeOut()`'s `midday` path, `protectNow`, the start-up decision and automatic resume, `go` and `hold`, the 1:30 behaviour, the deploy check script, the test-only switch.
- **Group 2 (messaging):** the mid-day posts (trading, commands, the not-flat alert, the resume and stay-paused lines, the 1:30 note), the `go` and `hold` replies, `HELP`, the status line, the summary's two lines.

## Release 2, review round 1 fixes (2026-11-09, night; branch `midday-cycle`)

Group 1 round 1: CHANGES REQUIRED (3 blocking). Group 2 round 1: CHANGES REQUIRED (2 blocking). Michael's answers, asked tonight, word for word: (a) on retries when a try ends not flat: "Request budget: Keep trying every 20 seconds, but only within 60 Alpaca requests a minute (like the loss stop's retry), never below the reserve of 80", "plus one alert when a try ends not flat and the 5 minute alert if still not flat"; (b) early-close days: "Run it at 10:30" (no half-day skip). Nothing deployed. Paper only.

Commits on top of `f3761d3`: `aa859f7` (the listed fixes), `ed834de` (a retry sells at most 10 positions, needed to meet the 60 a minute), `38f5114` (**outside the listed fixes, droppable**: the missing-exit check stands aside until the mid-day close-out is flat, with the 40-position test), and this log.

### Group 1, blocking

1. **Retries within 60 requests a minute (Michael's (a)).** The first try at 10:30 is the full close-out, not held back (like the loss stop's first sale). Every try's cost (the governor's `requestsLastMinute` before and after) is charged afterwards to a 60-a-minute budget (`MiddayBudget`, a copy of risk.ts's `LossStopBudget`, in `midday.ts`). A retry, at most every 20 seconds, starts only when the budget has room for its estimate (the last try's charged cost, at most 60) and Alpaca's budget less that estimate stays at or above the reserve (80) (`retryAllowed`). **One-round retries are how the 60 a minute is met:** a retry is ONE round of the same `closeOut()` (new option `maxRounds`, used only here), without the wait for its own sells (the next retry looks again). **And a retry sells at most 10 positions, in turn** (builder's choice, `MIDDAY_RETRY_SYMBOLS`, like the loss stop's retry cap of 15 requests a check): measured in the simulator, one round over 40 positions whose sales are refused costs about 130 requests (each refused sale reads the account again), so one round of everything cannot fit 60; with 10 a retry costs about 37. A retry over some positions judges flat from the whole account (new `closeOut()` option `onlySymbols`, then one positions read). **Alerts:** one alert mentioning Michael when a try first ends not flat (as before), and one more, mentioning him, if still not flat 5 minutes later; nothing in between.
2. **The deploy check refuses a checkout that is not clean** (`git -C <dir> status --porcelain` must print nothing, or a failed `git status`; fly deploy ships the working files). In the pure `deployRefusals` (field `gitStatus`), tested.
3. **Half days run the cycle at 10:30 (Michael's (b)).** The skip is removed. `middayTimes` now gives the last entry (close minus 60, from limits.ts: 11:00 AM CT on a 12:00 PM close) and ends the automatic resume at the earlier of 1:30 PM and the last entry. Every text uses the real times (never a fixed "2:00 PM" or "1:30 PM"). The 1:30 note is posted only if there is still time to trade, else nothing. The mid-day close-out still never starts from close minus 5. A day so short that 10:30 is inside its last 5 minutes has no cycle.

### Group 1, non-blocking (done)

- **The log's claim about late entries was wrong; corrected here:** an entry that reaches Alpaca after the mid-day close-out has read an empty account (its single open-orders read) is NOT sold at mid-day. It keeps its bracket (stop and take-profit at Alpaca); the deploy check refuses while a position is held; the 2:55 close-out sells it (or its exits close it first).
- **`hold` has its own key** (`midday_hold:<date>`), so the pause's own writes (`middayPhase` writing `on: true`) can never overwrite it. Tested: `hold` before 10:30 survives the pause.
- **The start-up decision requires that this process started after the pause began** (`startedAfterPause`), so an earlier start (an evening deploy, or a start before 10:30 whose decision came late) never counts as a mid-day deploy. Tested.

### Group 2, blocking

1. **"CT CT"** in the morning line removed (`centralClock` already adds " CT"); the test checks the exact start "Morning (open to 10:30 AM CT): ".
2. **The texts read the stop flag** (`blockedNext` in `midday.ts`): the morning line, the 1:30 note, the plain-restart alert, the stay-hold, stay-stop and stay-late lines and the `hold` reply say what will really happen: the daily loss stop: "The daily loss stop is in force, so trading stays paused for the rest of the day unless you send `resume` and then `go`."; Michael's `stop`: "The stop flag is on: send `resume`, then `go`." Tested with the loss stop on for the morning line and the 1:30 note, and the owner stop for `hold`.

### Group 2, non-blocking (done)

- After the last entry: "No entries are left today (last entry 2:00 PM CT)." (the real time), and the plain-restart alert then does not mention Michael; `go` then answers "The mid-day pause is over, but no entries are left today (last entry ...)".
- The 1:30 note waits for this start's start-up decision (so it cannot contradict it). Tested with a slow first loss check.
- The morning line's entry count uses the summary's filter (`isSentEntry`, now exported from summary.ts and used by both).
- The summary's restart line: "Restarted at <time>; the request figures, the live-update figures and the entry-expiry counts cover only the time since <time>."
- `hold` before 10:30: "Hold: after today's mid-day deploy I will stay paused until you send `go`."
- The stay-stop line gives the next step.
- The not-flat alert with nothing listed says "the positions could not be listed".
- `HELP` says the pause starts at 10:30 AM CT and the automatic resume ends at 1:30 PM CT, or at the last entry if earlier.

### Outside the listed fixes (commit `38f5114`, droppable)

**The missing-exit check stands aside from 10:30 until the mid-day close-out is flat**, as it does from the 2:55 close-out on ("the close-out alone flattens the account"). Found while building fix 1: with 40 positions and refused sales, between the mid-day tries the order sync's missing-exit check started its own sale for every position whose exits the first try had cancelled: 80 such sales and 400 refused sells in 10 simulated minutes, spending Alpaca's requests outside the 60 a minute and keeping its budget near 0, so no retry could start. With it, the 40-position test meets the reviewer's bar. It is money-touching and was not in the list, so it is a separate commit; without it the 40-position test fails (and is part of that commit). This also means the proposal's line "the missing-exit check keeps running during the pause" now holds only from mid-day flat on (no position should exist then).

### Tests

473 pass (465 before round 1: 8 added, several changed for the new texts and times; the early-close test became two half-day tests). Type check clean. New: 40 positions with every sale refused (after the unlimited first try, mid-day requests in any 60 seconds 52 at most, measured conservatively with routine work beside them; no rate-limit answer after the first try's minute; one alert and one 5 minute alert; no missing-exit sale; flat once Alpaca accepts); the half day (cycle at 10:30, 11:00 AM CT texts, no 1:30 note, `go` after the last entry, a deploy after it); the loss stop's texts; `hold` in its own key and with the stop on; an earlier start not counted; a retry not waiting for its own sale; a subset retry judging the whole account; the deploy check's clean checkout.

Each new piece taken out on its own: **40 of 42 caught.** Not caught, and why:
- Retries not waiting for their own sells (`waitForOwnSells: false`): redundant with one round (the close-out's own-sells wait needs the liquidator's round 2 to find only its own sells, which a one-round retry never reaches). Kept as an explicit backstop.
- The not-flat alert's wording when nothing is listed: a fallback the simulator cannot reach (a not-flat result always lists something).

| Taken out | Test that fails |
| :-- | :-- |
| the budget check before a retry; its room and reserve conditions; charging each try; the estimate's cap at 60 | the 40 positions, the rule tests |
| one round per retry; `closeOut()` passing the rounds; at most 10 positions per retry, in turn; the subset passed and the whole-account read | the 40 positions, the subset test |
| the 5 minute alert; once; the not-flat time remembered | the 40 positions |
| the half day's resume window and the too-short-day rule | the half day (two tests), the rule tests |
| each `blockedNext` text; its use in the morning line, the 1:30 note and the stay-stop line; the plain-restart alert's mention; the stay-late times | the loss stop's texts, the half day, the loss-stop deploy, the rule tests |
| the 1:30 note waiting for the start-up decision; only with time left | the deploy after 1:30, the half day |
| a start after the pause only (rule and worker) | the earlier start, the rule tests |
| `hold` in its key (saved, read at start-up, in the morning line, in `status`); its replies before 10:30 and with a stop | the `hold` tests, the commands, the restarts |
| `go` after the last entry; the morning count like the summary's; the restart line; no "CT CT"; the clean-checkout check | the half day, the full day, the deploy, the deploy check |
| the missing-exit check standing aside (commit `38f5114`) | the 40 positions |

### For review (round 2)

- **Group 1:** the retry budget and its one-round, at-most-10-positions retries (`worker.ts` mid-day block and `middayPhase`, `closeout.ts` `maxRounds` and `onlySymbols`, `midday.ts` `MiddayBudget`, `retryAllowed`, `retrySymbols`); the half-day times; the hold key; `startedAfterPause`; the clean-checkout check; and, separately, commit `38f5114` (the missing-exit check standing aside), which needs Michael's say.
- **Group 2:** the stop-aware and real-time texts, the alerts, the replies, `HELP`, the summary line.

### Michael's decisions on the round 1 fixes (2026-11-09, night) and the rebase onto v14

- **The missing-exit check off from 10:30 until the mid-day close-out is flat (commit `38f5114`): "Keep it".** Asked because it was outside the listed fixes and money-touching.
- **At most 10 positions per mid-day retry, in turn (`MIDDAY_RETRY_SYMBOLS`): "Accept 10".** The first try at 10:30 is not capped.
- Release 2 is now rebased onto `main` at v14 (release 1 underneath; branch `r2-v14`). Only the log conflicted (both releases appended at its end). On the combined code: 491 tests pass (463 of release 1 plus release 2's 28), type check clean.
## Release 2, group 2 round 2 notes (wording)

Group 2 round 2: PASS. Its non-blocking wording notes, done as one commit (messaging only: no decision, order, limit or timing changed; the only new read is one account read for the wording after a daily loss stop, the same look the `resume` reply makes):
1. **After a daily loss stop**, the texts look at whether today's loss is still past the limit (`lossPast` in `midday.ts`, used in the morning line, the 1:30 note, the start-up lines and the `hold` reply). Still past: "No more trading today (the daily loss stop is in force)." (a `resume` would be stopped again within about 5 seconds). Not past: the resume-then-go line as before.
2. The stay-stop line no longer repeats itself: "Release X started while flat and paused, so I stay paused. <what happens next>".
3. On a half day (the automatic resume ends at the last entry) the morning line drops "from 11:00 AM CT I stay paused unless you send `go`": it ends "Without a deploy, send `go` to resume (last entry 11:00 AM CT)."
4. "1 entry sent", "2 entries sent".
5. `hold` before 10:30 with the stop flag on says what is true: "send `resume` to trade again before the 10:30 AM CT pause; after the mid-day close-out, `go` resumes trading" (and for the daily loss stop: "No more trading today" when the loss is still past).
6. The plain-restart alert does not mention Michael on a daily-loss-stop day.

Tests: 474 pass (1 added, 3 changed). Type check clean. Each of the six taken out on its own fails a test: 7 of 7 (two for item 1).

### Release 2, round 2: group 1 PASS (round 2 of 3), group 2 PASS (round 2 of 2)

**Group 1, round 2: PASS.** All round 1 findings closed, measured: 40 positions with every sale refused: retry requests at most 41 in any rolling 60 seconds, lowest bucket during a retry 125.7, no rate-limit answers in retries; round 8 with the cycle on: lowest bucket during retries 109; the deploy check refuses an unclean checkout; half days run at 10:30 with the real last entry; no interference with release 1 (the sync sends no sale while the mid-day close-out owns selling; the 2:55 close-out unchanged); production cannot reach the test-only switch. Non-blocking: **the first try at 10:30 is still uncapped** (it matches the approved 2:55 code and Michael's ruling covers retries; with 40 refused sales it still makes about 398 requests and about 200 rate-limit answers in its first minute; for Michael); a retry's cost is charged from a rolling window and can come out low (the reserve check held in every run); release 1's 5 minute alert could overlap the mid-day alerts (now decided, below); the real mid-day deploy checkout must be clean (a fresh `git clone` has no `node_modules`; check with `--check-only`); one retry test is narrow.

**Group 2, round 2 (the last): PASS.** Both round 1 findings fixed; all posts printed from the tests and checked. Non-blocking wording notes, all done since (commit "Release 2, group 2 round 2 notes (wording only)"): no more trading today after a loss stop still past the limit (its own equity read on such a day, for wording only), no repeated stay-stop line, the half-day morning line, "1 entry", `hold` before 10:30 with a stop, no mention on a loss-stop restart alert. It also found four alerts mentioning Michael within about 11 minutes for a position stuck from before 10:30 through the mid-day close-out.

### Michael's decision on the alerts at 10:30: "Mid-day owns it"

While the mid-day close-out is selling (10:30 until flat), release 1's stuck-entry 5 minute alert stands aside; the close-out's own two alerts cover those positions (3 alerts instead of 4). Messaging only: `SyncOptions.middayOwnsSelling` in `risk.ts` (it gates only `escalateIfDue`), passed by the worker from `middayOwnsSelling`. Tests: a unit test (no 5 minute alert while it owns selling, once afterwards) and a full-day test (stuck from 10:27, freed at 10:39: the stuck alert, the mid-day close-out's alert, no stuck-entry 5 minute alert, sold once freed). 494 tests pass, type check clean; both pieces caught when taken out.

### Release 2, group 1 review round 3 (the last of 3): PASS

No blocking finding. Neither post-round-2 commit changes anything that sends, cancels, sizes, blocks or protects an order, the timing of any sale or close-out, or a limit. `lossPast`'s extra read runs only on a daily-loss-stop day, a failed read only picks the gentler wording, and Alpaca reads time out after 10 seconds. The alert gating cannot skip a first alert or a resolution line; only the clock-based 5 minute escalation stands aside, and only while the mid-day close-out owns selling. Non-blocking, for Michael: the first try at 10:30 is not limited to 60 requests a minute (about 398 requests and about 200 rate-limit answers in its first minute with 40 refused sales, as the 2:55 close-out would); a retry's cost is charged from a rolling one-minute count and can come out low.

**Release 2 reviews:** group 1 PASS in round 3 (round 1 CHANGES REQUIRED, round 2 PASS, round 3 on the post-pass wording and Michael's alert decision); group 2 PASS in round 2. A fresh clone at `4d07ab4` passes the deploy script's clean-checkout check (`--check-only` tonight refused only for the expected reasons: no mid-day phase, after 1:30, market closed, pause off).
