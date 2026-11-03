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

**What happened, second by second** (Alpaca's minute equity history is the reference; a point stamped T is the equity at T, checked against the 8:35 point, which is still 0 although fills began at 8:35:00, and the 8:54 point, which equals the final flat value):

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
