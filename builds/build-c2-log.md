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
