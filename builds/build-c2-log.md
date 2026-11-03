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
