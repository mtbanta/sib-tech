# Build C log (stack C, cyrus)

Append-only record of the build. Each piece: plan, what was built, decisions and why, test results, review results, anything left open. No time spent or token cost. The brief is in `builds/build-c-brief.md`.

This is paper trading only. Anything the stack produces is research input for a human decision, never an instruction to act.

## Piece 0: check, list, and stop

Started 2026-10-29. Research only.

### Session start

- Read `PROJECT_STATE.md` first, per `CLAUDE.md`'s start-of-session rule.
- Saved the brief verbatim to `builds/build-c-brief.md` (step zero) and created this log.

### Method for piece 0

- Every source opened first hand on 2026-10-29 with plain `curl` and its default identification, no custom headers, no personal information sent. HTML turned to text with a local script. Playwright only where a page needs JavaScript (noted per source).
- Run 5's Discord pages: the developer docs were reopened today. The Discord help-center pages (support.discord.com) returned 403 to curl and were NOT reopened; where this log relies on them (multi-factor backup codes, the phone-check rule, notification settings, the 100-server limit, the five-account switcher) it cites run 5's dated footnotes, which were read on 2026-10-28.
- Strength labels follow run 3, section 5 (read in full on 2026-10-29): A is the vendor's own documentation, pricing page or terms; B is reputable press; C is review and comparison sites; D is forums, social posts and personal blogs. Labels were corrected after a check: Alpaca's forum replies are D (a forum, even when the answering handle ends in "_Alpaca"), and Alpaca's Learn articles are A (the vendor's own site).

### Q1 Alpaca: sources and findings (in the order read)

**A1. Paper Trading (Alpaca docs).** https://docs.alpaca.markets/docs/paper-trading . Accessed 2026-10-29. Strength A. Opened with curl.
- "Anyone globally can create an Alpaca Paper Only Account! All you need to do is sign up with your email address."
- "As an Alpaca Paper Only Account holder, you are only entitled to receive and make use of IEX market data."
- "Your initial paper trading account is created with $100k balance as a default setting. You can reset the paper trading account at any time later with arbitrary amount as you configure."
- "We've updated the dashboard to allow you to create and delete paper accounts, rather than resetting them. To create a new paper account, click the paper account number in the upper left corner of the dashboard and select "Open New Paper Account.""
- "Don't forget to generate new API keys for any newly created account."
- "You cannot change the account balance after it is created, unless you reset it."
- "Your paper trading account will have a different API key from your live account." Paper base URL: `https://paper-api.alpaca.markets`.
- Paper vs Live table lists "Margin Trading" and "Short Selling" as available on paper; "Borrow Fees" not yet.
- Finding: one login holds more than one paper account ("Open New Paper Account"), each with its own keys. The starting balance is set when the account is created or reset.

**A2. About Market Data API (Alpaca docs).** https://docs.alpaca.markets/docs/about-market-data-api . Accessed 2026-10-29. Strength A. Price label: published. Opened with curl.
- "The Basic plan serves as the default option for both Paper and Live trading accounts ... this plan only includes limited real-time data: for equities only the IEX exchange".
- Table: Basic free, real-time coverage IEX, websocket 30 symbols. Algo Trader Plus $99 / month, "All US Stock Exchanges", websocket "Unlimited".
- "If you signed up for an Alpaca account to trade or build a personal trading app, you're using the Trading API."

**A3. Alpaca Market Data pricing page.** https://alpaca.markets/data . Accessed 2026-10-29. Strength A. Price label: published. Opened with curl.
- Free $0/mo: IEX, websockets "Limited to 30 symbols". Algo Trader Plus $99/mo: "All US Exchanges", "Unlimited symbols".

**A4. Market Data FAQ (Alpaca docs).** https://docs.alpaca.markets/us/docs/market-data-faq.md . Accessed 2026-10-29. Strength A. Opened with curl.
- "You can subscribe to AlgoTrader Plus on the Alpaca UI: on the left sidebar of the main page click on "Plans & Features" and on that page click on "Upgrade to AlgoTrader Plus" inside the Market Data box."
- "All the latest endpoints ... require a subscription to be used with the SIP feed." Without it, the default feed is IEX.

**A5. WebSocket Stream (Alpaca docs).** https://docs.alpaca.markets/us/docs/streaming-market-data.md . Accessed 2026-10-29. Strength A. Opened with curl.
- "The number of connections to a single endpoint from a user is limited based on the user's subscription, but in many subscriptions (or without one) this limit is 1. If you try to open a second connection, you'll get this error: [{"T":"error","code":406,"msg":"connection limit exceeded"}]"
- "most users can have only 1 active stream connection."
- Not yet settled: whether "a user" means the login or each account's keys, and what Algo Trader Plus allows. To be checked.

**A6. Trading Account (Alpaca docs).** https://docs.alpaca.markets/us/docs/account-plans.md . Accessed 2026-10-29. Strength A. Opened with curl.
- "After creating an Alpaca Paper Only Account, you can enable live trading by becoming an Alpaca Brokerage Account holder. This requires you to go through an account on-boarding process".
- "With a brokerage account, ... you'll receive real-time consolidated market data."
- Finding to carry forward: consolidated real-time data is tied to a funded brokerage (live) account. A paper-only account is "only entitled" to IEX. Whether a paper-only login can buy Algo Trader Plus at all is still to be checked.

**A7. Alpaca Terms and Conditions (PDF).** https://files.alpaca.markets/disclosures/library/TermsAndConditions.pdf . Accessed 2026-10-29. Strength A. Opened with curl, read in full.
- Data Plans: "When creating a user account with Alpaca/onboarding through Alpaca's Services you will have the option to subscribe to a market data plan. Alpaca offers a 'Basic' market data plan, which is made available at no cost, as well as a 'Pro' market data plan, that is made available on a paid subscription basis." Choosing Pro means agreeing to "the NASDAQ OMX Global Subscriber Agreement, or AGREEMENT FOR MARKET DATA DISPLAY SERVICES" and to automatic recurring charges, cancelled on the "Market data subscription" page, with no refund for unused time.
- Personal and Non-Commercial Usage: "you agree to use the Services and Content solely for your own personal and non-commercial purposes." Making the Content "available to others through your own application" needs 30 days written notice.
- Content: "No part of the Service or Content may be copied, reproduced, republished, uploaded, posted, publicly displayed, ... transmitted or distributed in any way (including "mirroring") to any other computer, server, web site or other medium for publication or distribution or for any commercial enterprise, without Alpaca's express prior written consent."
- Nothing in this document limits how many accounts a person may hold.

**A8. Alpaca Customer Agreement (PDF, version V26.2026.07).** https://files.alpaca.markets/disclosures/library/AcctAppMarginAndCustAgmt.pdf . Accessed 2026-10-29. Strength A. Opened with curl, text extracted with macOS PDFKit, searched for account-count and market-data clauses (not every page read in full).
- Section 30: "AlpacaDB, Inc. provides market data to non-professional Alpaca customers." "I agree not to reproduce, distribute, sell or commercially exploit the market data in any manner without written consent from Alpaca."
- Section 12(a), "Multiple Accounts": "This Agreement solely governs the relationship between Me and Alpaca as it relates to My Account with Alpaca Securities LLC." This is about the crypto entity, not a limit.
- No clause found limiting one person to one account. No clause found that addresses two programs of the same owner sharing one data subscription.

**A9. Forum thread, "Feature Request: More paper trading accounts" (Alpaca Community Forum).** https://forum.alpaca.markets/t/feature-request-more-paper-trading-accounts/18125 . Accessed 2026-10-29. Strength D (a community forum, but a reply from a user whose handle ends in "_Alpaca" and who is answering as Alpaca; this is not verified as staff).
- Reply dated November 7, 2025: "You can actually have as many paper accounts as you wish. You simply need to sign up and create an account under a different password. Each password creates a unique owner. Each owner is currently allowed 3 paper accounts and 1 live account. If you source market data from Alpaca, having multiple owners may also be beneficial. The rate limits for Alpaca data plans is enforced per owner and not per account."
- A different user replied: "Usually doing that is against the terms of service."
- Reply dated August 14, 2026, same handle: "Alpaca currently supports one live account per account type ... under a single login. There is active beta testing of "sub-accounts" ... We don't have a firm public launch date yet".
- A user in the same thread, who had paid for the 99 dollar plan, complained of being "limit[ed] ... to 3 paper accounts".

**A10. Forum thread, "Multiple paper accounts?" (Alpaca Community Forum).** https://forum.alpaca.markets/t/multiple-paper-accounts/2655 . Accessed 2026-10-29. Strength D. Older reply: "Sub-accounting is on the roadmap ... until then, you could create few Alpaca accounts with different emails."

**A11. "How to Start Paper Trading with Alpaca's Trading API" (Alpaca Learn).** https://alpaca.markets/learn/start-paper-trading . Accessed 2026-10-29. Strength A (the vendor's own Learn article, not the API docs). "Paper Trading allows up to 3 distinct simulated accounts with separate balances and positions, while live trading runs through a single approved brokerage account."

**A12. Account Configurations reference (Alpaca API docs).** https://docs.alpaca.markets/us/reference/patchaccountconfig-1.md . Accessed 2026-10-29. Strength A.
- `max_margin_multiplier`: "Can be "1", "2", or "4"". `no_shorting`: "If true, account becomes long-only mode." `suspend_trade`: "If true, new orders are blocked." The page lists the paper server (`https://paper-api.alpaca.markets`) among its servers. Whether paper honours each value is a build-time test.
- Account object: `multiplier` 1, 2 (default for non-PDT accounts with 2,000 dollars or more equity) or 4. A paper account's status can be `PAPER_ONLY`.

**A13. Websocket Streaming, trade updates (Alpaca docs).** https://docs.alpaca.markets/us/docs/websocket-streaming.md . Accessed 2026-10-29. Strength A. The order and fill stream for paper is `wss://paper-api.alpaca.markets/stream`, separate from the data stream.

**A14. Forum thread "Paper Trading Options Pricing" (Alpaca Community Forum), reply of 2025-09-12.** https://forum.alpaca.markets/t/17795.json (page: https://forum.alpaca.markets/t/paper-trading-options-pricing/17795). Accessed 2026-10-29. Strength D (forum; the replying handle ends in "_Alpaca", answering as Alpaca, not verified as staff). Opened with curl, the forum's public JSON.
- "Alpaca data doesn't depend upon the account (ie paper or live). What type of data one can access is soley dependant upon ones data subscription. By default everyone has access to the free Basic subscription. One can however sign up for the Algo Trader Plus subscription."
- "Since all accounts (paper and live) held by an owner have the same owner ID, any API keys can be used (paper or live) to access market data and it will be the same data. There isn't 'paper trading' data, but rather either the free basic or the Algo Trader Plus data."

**A15. Forum thread "Failed to Generate New API Key" (Alpaca Community Forum), reply of 2026-05-23.** https://forum.alpaca.markets/t/16859.json . Accessed 2026-10-29. Strength D, same caveat. A user wrote they had "purchased the Algo Trader Plus subscription (It worked under paper account but getting this error under live account)", with a live application still in review. Reply: "you do not need live account API keys to access market data. You can use your paper API keys. Any paper or live account API key can be used to access Algo Trader Plus market data. The market data subscription is tied to your owner ID, not to any specific account."
- Caution: that user had also applied for a live account, so this is not a clean case of a paper-only login buying the plan.

**A16. Forum thread "IEX or SIP with a free account" (Alpaca Community Forum), reply of 2025-08-14.** https://forum.alpaca.markets/t/iex-or-sip-with-a-free-account/17141 . Accessed 2026-10-29. Strength D, same caveat. "IEX data should generally not be used for live trading decisions (it's correct but incomplete)." "If however your algo requires real time quotes and/or trades or bars, you need to subscribe to an Algo Trader Plus data subscription. This can be done from the account dashboard under "Plans and Features"."

**A17. Forum search results for "connection limit exceeded" (Alpaca Community Forum).** https://forum.alpaca.markets/search.json?q=connection%20limit%20exceeded . Accessed 2026-10-29. Strength D (users' reports only). Several users on the SIP stream URL report the error when a second client connects: one writes "we can only 1 have streaming client at a time"; another says a script run in two terminals "will only properly work from the first window".

**A18. Alpaca Learn, "How to Open Live Alpaca Trading API Account as a US Resident".** https://alpaca.markets/learn/live-trading-account-us-resident . Accessed 2026-10-29. Strength A (the vendor's own Learn article). "By signing up and activating MFA, you have only created a paper account. To create a live account, please use the following steps." (so signup is email plus multi-factor sign-in, then a paper account exists). "you must maintain at least $2,000 in equity to use margin leverage."

### Q1 answers (Alpaca), as far as the sources go

1. **Can one login hold two paper accounts?** Yes. Alpaca's docs: dashboard, paper account number, "Open New Paper Account" (A1). Alpaca's learn article says up to 3 paper accounts (A11), and a forum reply says each owner is allowed 3 paper accounts and 1 live account (A9). Each paper account has its own keys (A1) and its own balance, set when the account is created or reset (A1).
2. **Can two paper accounts share one real-time consolidated data plan?** Yes on the evidence of Alpaca-answered forum replies: the plan hangs on the owner ID, so every key under one login returns the same data (A14, A15). The docs page says nothing contrary on this point.
3. **The catch for two stacks at once: the stream.** The docs say the stream allows a limited number of connections per user, "in many subscriptions (or without one) this limit is 1" (A5), and users report the error on the SIP stream (A17). Alpaca's docs do not state Algo Trader Plus's number. If it is 1, two stacks cannot both hold a live SIP stream on one login, one would get "connection limit exceeded". Not settled. A cheap build-time test settles it after the plan is bought: open two stream connections with two keys and see whether the second is refused.
4. **May one account's data keys feed both stacks under Alpaca's terms?** Not settled by any page. The terms bar using the data for anything other than "your own personal and non-commercial purposes" and bar redistribution "to any other computer, server" for publication or commercial use (A7), and the customer agreement bars reproducing or distributing the data "without written consent" (A8). Two programs of the same person is neither, on a plain reading (my reading, not legal advice), but no page says so. Only Alpaca can say. A short written question to support settles it.
5. **Does a paper account need the 99 dollar plan for real-time consolidated data at all?** Yes. The free plan's real-time data is IEX only, one exchange (A2, A3), and Alpaca's own staff-handle reply says IEX data "should generally not be used for live trading decisions" (A16). Run 3's requirement is consolidated real-time data, so stack C needs the plan.
6. **CONFLICT in Alpaca's own pages, for Michael.** The Paper Trading docs page says a Paper Only Account holder "is only entitled to receive and make use of IEX market data" (A1). Forum replies in the same company's voice say the plan is tied to the owner and works with paper keys (A14, A15). Neither page covers a login with only a paper account buying the plan. If a paper-only login cannot buy it, the only route is a funded live brokerage account (A6, A18), which is real money and a hard stop in the brief. The test is not whether the Upgrade button works, but whether a request for SIP data (`feed=sip`) succeeds with the paper keys after purchase, or Alpaca's written answer (checklist, sections A.3 and E). If it fails, stop and ask. I will not open or fund a live account.
7. **Can one person hold two separate Alpaca accounts (two logins)?** Not barred by any clause found (A7, A8). A forum reply in Alpaca's voice says "You can actually have as many paper accounts as you wish. You simply need to sign up and create an account under a different password. Each password creates a unique owner" (A9), while another user says doing so is "usually ... against the terms of service" (A9). Nothing in the customer agreement or terms read supports that. Alpaca's staff-handle reply also says a second owner gets its own data rate limits (A9), which is consistent with two logins needing two plans.
8. **Paper account size and the borrowing cap.** The balance is set when the account is created or reset (A1), so 20,000 dollars is set at creation or by resetting, no way found to change it otherwise. The `max_margin_multiplier` (1, 2 or 4), `no_shorting` and `suspend_trade` settings exist in the account configuration (A12). Whether the paper server honours the cap is a build-time test.

### Q2 Discord: sources and findings

Method note: Discord's help-center and developer-policy pages (support.discord.com, support-dev.discord.com, and the policies pages on docs.discord.com) answered plain `curl` with HTTP 403 (a bot-check page). I did not work around the block and did not present the request as a browser. So the findings below rest on Discord's developer documentation (docs.discord.com, which opened with curl) and its Terms of Service. Run 5 reached the support pages with a browser tool; those pages are cited here only through run 5, and flagged as such.

**D1. Gateway, "Privileged Intents" and "Message Content Intent" (Discord developer docs).** https://docs.discord.com/developers/events/gateway . Accessed 2026-10-29. Strength A. Opened with curl.
- "Apps with fewer than 10,000 users can access privileged intents by enabling them in the Developer Portal."
- "In the Developer Portal, you can navigate to your app's settings, then toggle the privileged intents on the Bot page under the "Privileged Gateway Intents" section."
- "Apps without the intent will receive empty values in fields that contain user-inputted content with a few exceptions: Content in messages that an app sends; Content in DMs with the app; Content in which the app is mentioned".
- "If you pass a privileged intent in the intents parameter without configuring it in your app's settings ... your Gateway connection will be closed with a (4014 close code)."

**D2. Message resource, "Get Channel Messages" (Discord developer docs).** https://docs.discord.com/developers/resources/message . Accessed 2026-10-29. Strength A. Opened with curl.
- "If operating on a guild channel, this endpoint requires the current user to have the VIEW_CHANNEL permission."
- "If the current user is missing the READ_MESSAGE_HISTORY permission in the channel, then no messages will be returned."
- "limit ... Max number of messages to return (1-100)", default 50. The `after` parameter fetches messages newer than a given message id.

**D3. Application Commands (Discord developer docs).** https://docs.discord.com/developers/interactions/application-commands . Accessed 2026-10-29. Strength A. "Guild commands are specific to the guild you specify when making them. Guild commands are not available in DMs. Command names are unique per application, per type, within each scope (global and guild)."

**D4. Teams (Discord developer docs).** https://docs.discord.com/developers/topics/teams . Accessed 2026-10-29. Strength A. "Teams can have a maximum of 75 apps." "To create or be a member on a team, you must enable 2FA for your Discord account." "If you want to keep the app under your own account's ownership, choose Personal." The page gives no limit for apps owned personally.

**D5. Webhook resource, Rate limits (Discord developer docs).** https://docs.discord.com/developers/resources/webhook and https://docs.discord.com/developers/topics/rate-limits . Accessed 2026-10-29. Strength A. "Webhooks are a low-effort way to post messages to channels in Discord. They do not require a bot user or authentication to use." "All bots can make up to 50 requests per second to our API."

**D6. Discord Terms of Service.** https://discord.com/terms . Accessed 2026-10-29. Strength A. Opened with curl. A search for "multiple accounts", "more than one account" and "one account" found no clause limiting accounts per person. It does bar "scraping our services ... by using any robot ... or automatic device", which is about scraping, not about bots built on the official developer interface (my reading).

**D7. Application resource (Discord developer docs).** https://docs.discord.com/developers/resources/application . Accessed 2026-10-29. Strength A. Searched for a cap on applications per account: none stated. Application flags exist for limited intents ("GATEWAY_MESSAGE_CONTENT_LIMITED ... Intent required for bots in under 100 servers to receive message content").

**From run 5, not reopened today (Discord support pages return 403 to curl):** "100 servers per account" (opcodes page), run 5 deliverable footnote 47; the account switcher holds five accounts, footnote 73. Not relied on here.

### Q2 answers (Discord)

1. **Can one account own two bots?** The docs show a cap of 75 apps for a team (D4) and name no cap for apps under a personal account (D4, D7). Run 5 also found none. Not settled by a vendor page, so the brief's build-time test applies: with Michael's one Discord account, create two applications in the Developer Portal. I expect it to allow this, since 75 is the stated figure for teams (my guess; the test is the measurement).
2. **Can one bot serve two servers, with each server's commands kept separate?** Yes technically: guild commands are specific to the guild they are made for (D3). But that means one bot token, one application, shared by both stacks. That breaks the ruling that everything stack C uses is its own, keys included, and either stack's key could read the other's server. So I recommend two bot applications (one per stack), however the per-account limit turns out, and one private server per stack. If the test shows a limit of one application per account, the fallback is a second Discord account for stack D, under dexter@ (a Michael decision, not made here).
3. **What must be enabled for a bot to read Michael's messages in a private server?** Three things.
   - The "Message Content" privileged intent switched on, on the bot's page in the Developer Portal (D1). No review for apps under 10,000 users (D1). Without it the bot gets empty message text, except for messages that mention the bot and direct messages to it (D1).
   - The bot's code must ask for that intent when it connects, or Discord closes the connection with code 4014 (D1).
   - The bot's role in the server must have View Channel and Read Message History on the command channel, or "no messages will be returned" (D2).
   The reading of the channel is a plain request for messages after the last one handled, up to 100 at a time (D2). Posting needs no bot at all, a webhook does it (D5).

### Q3 Fly.io, Supabase, Healthchecks.io: sources and findings

Note on search: I used a web search only to find addresses for Alpaca's forum and guides. No search summary is cited anywhere in this log. Every cited page was then opened with `curl`.

**F1. Fly.io Resource Pricing (docs).** https://fly.io/docs/about/pricing/ . Accessed 2026-10-29. Strength A. Price label: published. Opened with curl.
- "Fly.io bills for the resources you use, with no monthly platform fee. The smallest always-on app costs $2.19 per 30 days."
- "Machine prices in this table are for Ashburn, Virginia (iad) and Secaucus, NJ (ewr), our lowest-priced regions. Machine prices vary by region".
- Started Machine, shared-cpu-1x: 256MB $2.19/month, 512MB $3.69/month, 1GB $6.70/month. Volume $0.15/GB/month. Outbound data $0.02/GB in North America and Europe. Dedicated IPv4 $2/month, optional.
- "New organizations use Pay As You Go pricing."

**F2. Fly.io pricing page, region price selector.** https://fly.io/pricing/ . Accessed 2026-10-29. Strength A. Price label: published (multipliers read from the page's own region selector, so the dollar figures below for San Jose are my arithmetic on them). The selector lists price multipliers: Secaucus 1, Ashburn 1, Toronto 1.115, San Jose 1.192, Los Angeles 1.1995, Dallas 1.25, Chicago 1.25.
- My arithmetic, San Jose: 256MB 2.19 x 1.192 = about 2.62; 512MB 3.69 x 1.192 = about 4.40; 1GB 6.70 x 1.192 = about 7.99 dollars a month. This closes run 3's open gap (it had no West price).

**F3. Fly.io regions (docs).** https://fly.io/docs/reference/regions/ . Accessed 2026-10-29. Strength A. Lists US regions including San Jose (sjc), Los Angeles (lax), Dallas (dfw), Chicago (ord). No Oregon or Seattle region appears in the list I read, so the nearest to a `us-west-2` (Oregon) database is San Jose (my reading).

**F4. Fly.io billing docs.** https://fly.io/docs/about/billing/ . Accessed 2026-10-29. Strength A. "We require an active, valid credit card on file for most Fly.io accounts to do things like deploying multiple apps and deploying public images." A pre-authorization of "usually less than US $10" may appear for up to 10 business days. Payments go through Stripe.

**S1. Supabase pricing page.** https://supabase.com/pricing . Accessed 2026-10-29. Strength A. Price label: published. Opened with curl.
- Free: "Free projects are paused after 1 week of inactivity. Limit of 2 active projects."
- Pro: from $25 a month. "First project included. Additional projects from $10/mo." "Paid plans include $10/mo in compute credits, enough to cover one Micro instance." Micro: $10 a month, shared compute, 1 GB memory.

**S2. Supabase compute and disk (docs).** https://supabase.com/docs/guides/platform/compute-and-disk . Accessed 2026-10-29. Strength A. "In paid organizations, Nano Compute are billed at the same price as Micro Compute." Nano is the free plan's size (up to 0.5 GB); Micro about $10 a month (0.01344 an hour). Matches the project's existing Micro ruling.

**H1. Healthchecks.io pricing.** https://healthchecks.io/pricing/ . Accessed 2026-10-29. Strength A. Price label: published. Hobbyist $0 a month, 20 jobs, 100 log entries per job. "Please do not use multiple accounts to get around the limits of the Hobbyist plan. This will be considered abuse." (stack C needs one or two checks, far under 20, so two stacks stay within the limit).

**H2. Healthchecks.io Discord integration, page template.** https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/discord/templates/add_discord.html . Accessed 2026-10-29. Strength A. "With this integration, ... will send a notification to a Discord channel when a check goes up or down." The page has a "Connect Discord" button. (The `healthchecks.io/integrations/discord/` page itself returned 404 to curl today.)

### Q3 answers: what stack C needs from each, and the price

| Vendor | What stack C needs | Plan | Price a month | Source |
| :-- | :-- | :-- | :-- | :-- |
| Alpaca | A paper account (20,000 dollars), keys, consolidated real-time data | Basic (free) plus Algo Trader Plus | 0 plus 99 | A2, A3 |
| Fly.io | One always-on machine, one app for stack C | Pay as you go, shared-cpu-1x, 256MB to 1GB | 2.19 to 6.70 in Ashburn or Secaucus; about 2.62 to 7.99 in San Jose (my arithmetic) | F1, F2 |
| Supabase | One project in us-west-2 (Oregon), Micro compute | Pro organization | 10 for an additional project in a Pro organization he already pays for; or 25 for a new Pro organization whose first project is covered by the credit | S1, S2 |
| Healthchecks.io | One check that Discord is told about | Hobbyist | 0 | H1, H2 |
| Discord | A server, a bot application, a webhook | Free | 0 | Run 5 (D6 today for the terms) |
| GitHub | The repo | Free | 0 | Already in place |

- **New paid plans Michael starts himself (hard stop in the brief):** Alpaca Algo Trader Plus (99), Fly.io pay as you go (card on file), and Supabase (10 or 25). New spending for stack C is about 111.6 to 132.0 dollars a month, plus nothing for the Max plan already paid (my arithmetic: 99 + 2.62 to 7.99 + 10 or 25).
- **Region guess to measure later:** putting the worker in San Jose sits near the Oregon database, but may sit farther from Alpaca's servers. Alpaca's server location was not found in any page read. Fly's Ashburn is cheaper by about 0.43 dollars a month at 256MB. This is a guess, not a measurement. A latency test from both regions in piece 1 or 2 turns it into a measurement. I will not decide it now.

### Q4 Recommendation: how many Alpaca and Discord accounts, under which email, and why

**Alpaca: one login for stack C now, on cyrus@sib-tech.co. A second login for stack D later (dexter@sib-tech.co), unless two tests and a written answer say one login can serve both.**
- Each login holds its own paper account at 20,000 dollars with its own keys (A1, A9).
- The 99 dollar plan hangs on the login, not the account (A14, A15), and real-time consolidated data needs it (A2, A16). So stack C needs the plan on its own login. That is the only way for C to run, and it is the only plan C needs.
- Sharing one login between C and D would save 99 dollars a month. Michael accepted sharing only if it avoids a second paid plan. Three things stand between that saving and a yes, and none is settled:
  1. The stream. Users report one live consolidated stream per login (A5, A17). Two stacks streaming at once on one login may be refused.
  2. The terms. No page says whether two of Michael's own programs may share one data subscription (A7, A8). Only Alpaca can say.
  3. A paper-only login buying the plan at all (conflict between A1 and A14, A15).
- So: stack C gets its own login. When stack D is built, test whether one login allows two streams, and ask Alpaca in writing. If both are yes, stack D can share C's login with its own paper account (each stack its own paper account and keys, as ruled). If either is no, stack D gets its own login and its own plan, 198 dollars a month in total for both stacks.
- Whether a second login for one person is allowed is not barred by anything found (A7, A8). One forum reply in Alpaca's voice says it works (A9). It is not an official statement (my judgment: moderate risk, ask Alpaca in the same written question).
- No live account, no funding. If the plan cannot be bought without one, stop and tell me (hard stop).

**Discord: one Discord account per stack, one private server per stack, one bot application per stack. Stack C's Discord account is registered on cyrus@sib-tech.co.**
- Michael's ruling accepts sharing one Discord account only if that avoids a second paid plan or is the only way to run the bots. Discord is free, and nothing found says one account is required. So the ruling's default holds: separate accounts.
- Two bot applications are needed either way (one bot would mean one shared key, against the ruling that each stack has its own keys).
- Cost of this choice, said plainly: on his phone Michael signs in to two Discord accounts when stack D exists. Whether phone alerts arrive for both is untested (a stack D test). If that proves awkward, the fallback is one Discord account owning both servers and both bots, which needs the bots-per-account question answered by the test below.
- **A risk to this choice (run 5, footnote 71, not reopened today):** Discord can demand a phone check, for example after posting "faster than a human can manage", and the number "cannot be an internet phone number or used by another account". Michael has one phone. If both the cyrus and the dexter Discord accounts are asked to verify, only one number can pass, and the same goes if his number is already on a personal Discord account. That would be the "only way to run the bots" case in his ruling, and it would justify one shared Discord account (separate server and bot per stack). Nothing is asked for at signup in the pages read, so this stays a watch item. If Discord asks for a phone number at signup and the number is already on another account, STOP and tell me.
- The server is private, invite-only, with Michael as the only human member besides the account owner. The bot acts only on Michael's numeric Discord user id in the command channel.

**Other accounts, all on cyrus@sib-tech.co:** Fly.io (own organization and app), Healthchecks.io (own account, free), and Supabase, where Michael chooses (below). Using cyrus@ everywhere keeps stack C's accounts findable together and apart from stack D's.

**Supabase, Michael's choice (a question I cannot answer without reading things I may not read):**
- Option 1 (recommended on cost): a new project, named for stack C, inside the Supabase organization he already pays for. Adds 10 dollars a month. The login is his existing Supabase login, not cyrus@. His existing organization may also hold other projects; stack C touches only its own project.
- Option 2: a new Supabase organization on cyrus@, on the Pro plan, 25 dollars a month, with the first project's Micro compute covered by the plan's credit (S1). Stronger separation, 15 dollars a month more.
- Either way the project region is "West US (Oregon)", which is `us-west-2`, chosen when the project is created because it cannot be changed afterwards (to be confirmed on the creation screen).

## Michael's checklist for piece 0 (plain English)

Nothing below is done by me. Starting any paid plan is yours (a hard stop in the brief). Stop and tell me at any step that asks for something not listed here, above all anything about a live account, funding, or a bank.

### A. Accounts to create, all with cyrus@sib-tech.co

| # | Site | What to create | Plan | Price a month |
| :-- | :-- | :-- | :-- | :-- |
| 1 | alpaca.markets (Sign Up, Trading API) | A login, with multi-factor sign-in switched on. Signing up and switching on multi-factor sign-in makes a paper account only. | Basic (free), then Algo Trader Plus once step 3 below is settled | 0, then 99 |
| 2 | discord.com | A Discord account, a private server named for stack C, a bot application | Free | 0 |
| 3 | fly.io | An account, an organization, a card on file | Pay as you go | about 2.62 to 7.99 for one small always-on machine (set in piece 1) |
| 4 | supabase.com | A project (your choice of option 1 or 2 above) in West US (Oregon) | Pro (existing, or new) | 10 (option 1) or 25 (option 2) |
| 5 | healthchecks.io | An account and one check | Hobbyist | 0 |

Alpaca, in order:
1. Sign up, switch on multi-factor sign-in. Do NOT choose to open a live account. Do NOT add a bank or any money.
2. Make the 20,000 dollar paper account. Alpaca replaced the reset button: the dashboard now lets you "Open New Paper Account" and delete paper accounts (A1). A new paper account starts at 100,000 unless you set an amount. Click the paper account number at the top left, choose "Open New Paper Account", set the starting amount to 20,000, and check the dashboard shows 20,000. The default 100,000 account will still exist: leave it alone or delete it, your choice, but do not use its keys. Generate the API keys from the 20,000 account, and check the dashboard shows that account selected when you do (the secret is shown once).
3. THE DATA-PLAN QUESTION. Alpaca's pages disagree on whether a paper-only login gets the full real-time feed: the docs say a Paper Only Account holder "is only entitled to receive and make use of IEX market data" (A1), while forum replies in Alpaca's voice say the plan follows the login and works with paper keys (A14, A15). So "the Upgrade button works" is NOT the test, because the purchase could go through while the feed still refuses your keys. The plan is 99 dollars a month, renews on its own, and gives no refund for unused time (A7). You have two ways to be safe:
   - Free check first (optional, slower): send the questions in section E to Alpaca support and wait for the answer.
   - Or buy it, and let me test it: after the keys are in the file (section C), tell me. I make one request for the latest trade of a stock with the paper keys and `feed=sip`. If it returns data, the plan works for paper. If it is refused, you cancel the plan on the "Market data subscription" page right away (A7) and we stop: stack C then cannot meet "real time and consolidated" without a live account, which is a hard stop.
   - Where to buy: "Plans & Features" in the left sidebar, then "Upgrade to AlgoTrader Plus" in the Market Data box (A4). If Alpaca asks for a live account or funding first, STOP and tell me.
4. Paper keys: step 2 above. Never create live keys.

Discord, in order:
1. Create the account. If Discord asks for a phone number and that number is already on another Discord account, STOP and tell me. Switch on an authenticator app or passkey, and save the backup codes in Google Password Manager. Discord's support "is not able to remove MFA" (run 5, footnote 61).
2. Create a private server. Make three channels: `alerts`, `trading`, `commands`. Set the server to notify on all messages (run 5).
3. Developer Portal (discord.com/developers/applications): New Application, named for stack C. On the Bot page, switch on "Message Content Intent" (D1). Reset the token and copy it once.
4. Invite the bot to your server (OAuth2 page, scope `bot`). Give the bot's role View Channel, Read Message History and Send Messages on the three channels (D2).
5. In `alerts`, make a webhook (channel settings, Integrations).
6. Turn on Discord's developer mode (User Settings, Advanced) so you can copy ids: copy the server id, the `commands` channel id, and your own user id.

Fly.io: create the account and organization, add the card. Nothing else. I will install Fly's command line tool in piece 1 and you will run `! fly auth login` once there (the code goes to your phone).

Supabase: create the project. Choose a database password and save it in Google Password Manager right away. Copy the project URL, the service role key (Project Settings, API) and the connection string (Project Settings, Database).

Healthchecks.io: create the account and a check named for stack C, a period of 1 minute and a grace of 3 minutes (my suggestion, a guess to tune). Copy its ping URL. In its integrations, "Connect Discord" and pick the `alerts` channel, so a missed heartbeat reaches you on your phone. Leave email on as the second route.

### B. Save in Google Password Manager (never in the file, never in chat)

- Each account's password and its multi-factor backup codes (Alpaca, Discord, Fly.io, Supabase, Healthchecks.io).
- The Alpaca account number.
- The Supabase database password.
- Every key and token below, as a backup, in case you reset one.

### C. How to hand me the keys

- File: `/Users/mtbanta/Projects/sib-tech/stacks/cyrus/.env.local`. I created it with blank names. It is git-ignored: `git check-ignore -v` prints `.gitignore:5:.env.*` for it, so Git will refuse to track it.
- Open it with `! open -a TextEdit /Users/mtbanta/Projects/sib-tech/stacks/cyrus/.env.local`, paste each value after the equals sign, save, close.
- The names and where each comes from:
  - `ALPACA_PAPER_API_KEY_ID`, `ALPACA_PAPER_API_SECRET_KEY`: the paper keys from Alpaca step 4.
  - `DISCORD_BOT_TOKEN`: Discord step 3. `DISCORD_GUILD_ID`, `DISCORD_COMMAND_CHANNEL_ID`, `DISCORD_OWNER_USER_ID`: Discord step 6. `DISCORD_ALERTS_WEBHOOK_URL`: Discord step 5.
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`: the Supabase step.
  - `HEALTHCHECKS_PING_URL`: the Healthchecks.io step.
- Never put an Alpaca account number, a password or a sign-in code in the file.
- When it is saved, tell me "accounts ready" in chat. Do not paste any value. In piece 1 I will move the values to Fly's secret store and the file stays on your Mac.

### D. Two tests, once the accounts exist

1. **Discord desktop holdback test (5 minutes).** With the Discord computer app open and active on your Mac, I will post a test message to `alerts` through the webhook. Watch your phone for a minute. If the phone buzzes, there is no holdback. If it stays silent, Discord is holding phone alerts while the computer app is open: then you close Discord on the computer during market hours, and I record the result (run 5, section 6, item 1).
2. **Bots per Discord account.** Not needed under my recommendation (one account per stack, one bot each). Only if you prefer one Discord account for both stacks: in the Developer Portal make a second application, named `test`, and see whether Discord allows it, then delete it yourself.

Two further checks happen at build time and need nothing from you now: whether Alpaca's paper server honours the borrowing cap setting of 1, 2 or 4 (A12), and, when stack D is built, whether one Alpaca login allows two live streams (A5, A17).

### E. An optional written question to Alpaca (support@alpaca.markets)

If you want Alpaca's answer in writing before stack D, here is a draft with no personal details: "I use Algo Trader Plus market data for my own personal, non-commercial trading programs. May two programs I run for myself, each using a different paper trading account under the same login, use the same subscription's data? How many simultaneous stock data stream connections does Algo Trader Plus allow per login? May a person hold two separate logins, each with its own subscription? Can a login that has only a paper trading account (no live account) subscribe to Algo Trader Plus and receive the full consolidated real-time stock feed (feed=sip) with its paper keys?" Send it from whatever address you choose.

### F. What I need you to tell me

"Accounts ready", plus: which Supabase option you chose, and any step that asked for something this list did not mention. Then I begin piece 1 (the override in CLAUDE.md, the stack decision text, the reviewer agent file, the folder layout).

## Piece 0 open items

- Alpaca: a paper-only login buying Algo Trader Plus and then getting SIP data with paper keys is in conflict between Alpaca's docs (IEX only) and forum replies in Alpaca's voice. The test is one `feed=sip` request with the paper keys after purchase (checklist A, Alpaca step 3), or Alpaca's written answer. If it fails, stack C cannot meet "real time and consolidated" without a live account, a hard stop.
- Alpaca: stream connections for Algo Trader Plus, and whether two stacks may share one subscription's data under the terms, remain unsettled (A5, A7, A8, A17).
- Discord: bots per account is unpublished in the docs read (D4, D7). Support and policy pages returned 403 to curl and were not opened. The desktop holdback is untested.
- Fly.io: no region price for Oregon; San Jose is the nearest listed (F2, F3). Alpaca's server location is unknown; the region is a guess to measure.
- Supabase: which organization to use is Michael's call.

## Piece 0 checks before commit

- **Secret scan** over the staged changes (key-shaped patterns: Alpaca key prefixes, Discord token and webhook shapes, `sk-` keys, JWTs, database URLs with passwords, Healthchecks ping URLs, 40-character alphanumeric strings, private key headers). First run flagged only long web addresses in this log (false positives); the generic rule was narrowed and the scan re-run: clean. A self-test with four fake secrets showed it refuses each. The scan lives outside the repo for now; a repo pre-commit hook comes in piece 1.
- **Key file** `stacks/cyrus/.env.local` exists with blank names, and `git check-ignore -v` confirms `.gitignore` rule `.env.*` ignores it. It is not in the commit.
- **Dashes:** no em or en dashes in the files this piece wrote.
- **Tests:** none exist yet (no code written).
- **Reviewer agent:** not run; piece 0 touches no money and the agent file is created in piece 1.
- **Hard stops:** nothing created at any vendor, no key or personal detail sent anywhere, no helper agents used, nothing in `~/Projects/relii` read, nothing touching stack D.

---

# Resumed 2026-10-30 (after piece 0)

Re-read the brief, this log, `PROJECT_STATE.md` and `CLAUDE.md` first, as the brief requires.

## Note on the password manager edit (2026-10-30)

Michael's ruling: he uses Google Password Manager, not Apple Passwords. Every "Apple Passwords" in this log (three places in piece 0's checklist) and the comment line in `stacks/cyrus/.env.local` was changed to "Google Password Manager" in place, on his explicit order. The brief (`builds/build-c-brief.md`) is left as saved, so it still says Apple Passwords, because it is the verbatim record. `PROJECT_STATE.md` had no mention.

## Michael's rulings after piece 0 (2026-10-30), as given

1. **Data.** Alpaca support confirmed a paper-only login gets IEX data only, even with Algo Trader Plus, and full SIP needs a live account. Michael will not buy Algo Trader Plus and will not open a live account. The paper test runs on the free IEX feed; its goal is to prove the plumbing. Build so switching to `feed=sip` later is a configuration change. Full-feed verification is no longer required before the rehearsal. This relaxes the brief's "real time and consolidated" requirement, by Michael's ruling. This also settles piece 0's open conflict between A1 and A14/A15 in favour of the docs (A1): IEX only for a paper-only login.
   - Alpaca's reply: recorded here as Michael relayed it (his words: support "confirmed a paper-only login gets IEX data only, even with Algo Trader Plus, and full SIP needs a live account"). I have not seen the original message text. If Michael wants the verbatim reply on file, he can paste it into the next session and it will be appended here as a dated note. Strength: D until then (relayed, not read first hand by me).
2. **Alpaca plan.** One plan covers every paper account under one login. Stack D will later use its own 20,000 dollar paper account under this same login. Nothing for D now.
3. **Supabase.** Option 1: the Supabase command line tool, with a one-time browser login by Michael, creates stack C's project in his existing organization, region West US (Oregon). Michael stores the database password. I fill the three Supabase values in `.env.local`.
4. **Healthchecks.** API key is in `.env.local` as `HEALTHCHECKS_API_KEY`. I create stack C's check and fill `HEALTHCHECKS_PING_URL`. Michael clicks "Connect Discord".
5. **Discord.** One account for both stacks, on cyrus@sib-tech.co, with a separate private server and a separate bot application per stack. Stack C's server has channels `alerts`, `trading` and `commands`. Stack C's code must accept commands only from its own server and command channel. **This reverses piece 0's recommendation of one Discord account per stack** (Q4). It also makes piece 0's phone-number risk smaller (one account asks for at most one phone check) and makes the bots-per-account question matter: one account must own both bot applications (checked when stack D is built; stack C needs only one).
6. Alpaca and Discord values are in `.env.local`.
7. Google Password Manager, see the note above.
8. Start piece 1 and continue. Tell Michael whenever a login or a click is needed.

## Build plan (pieces)

Written 2026-10-30. A plan, not a promise: each piece is re-scoped at its start. Pieces marked (R) touch money and get the `build-reviewer` agent. The end of each phase also gets a review.

**Phase 1, foundations**
- Piece 1: repo rules, reviewer agent, folder layout, secret-scan hook, vendor accounts wired (Supabase project, Healthchecks check, Fly login), read-only smoke checks of Alpaca and Discord.
- Piece 2: worker skeleton in TypeScript on Node 24: settings loader, paper-only guard, logger that hides secrets, Discord poster, heartbeat pinger, test setup. Includes the Discord desktop holdback test (needs Michael).
- Piece 3: database tables (written as a file first, then applied), run log, small data layer.

**Phase 2, market and broker**
- Piece 4 (R): Alpaca connection, paper host only, account settings (borrowing cap, long only), orders client, trade updates stream.
- Piece 5: market data client with the feed as a setting, and the daily screen that builds the live list from the six indexes (run 3, section 7.3), sized to the free stream's 30 symbol cap.

**Phase 3, rules and trading**
- Piece 6 (R): Discord commands (stop, status), owner-only, own server and own command channel only, and the morning limits flow with the gate.
- Piece 7 (R): placeholder strategy, limit checks, orders with a protective order at Alpaca, safe retries, close-out at the end of the day.
- Piece 8: daily summary, heartbeat wiring, the scheduler that runs the day.

**Phase 4, deploy and prove**
- Piece 9: Fly.io deployment, secrets, region check.
- Piece 10 (R): rehearsal on a recorded trading day, heartbeat alert test, final review, "first paper session" checklist for Michael.

## Piece 1: foundations

### Plan
1. `CLAUDE.md` override and Tech stack text (first, so later steps are allowed by the repo's own rules).
2. `.gitignore`: ignore `.claude/*` but not `.claude/agents/` (git cannot re-include inside an ignored folder, so the rule is `.claude/*` then `!.claude/agents/`).
3. `build-reviewer` agent file, byte-exact from the brief.
4. Folder layout under `stacks/cyrus/`, a secret-scan commit hook in the repo.
5. Read-only smoke checks with the keys already in `.env.local`.
6. Healthchecks check via its API. Supabase project via its command line tool. Fly command line tool installed.
7. One batched ask to Michael for the logins and clicks.

### Decisions
- **Language: TypeScript on Node 24.** Node 24 runs TypeScript directly (no build step), has a built-in WebSocket client and a built-in test runner, so dependencies stay few. The system Python is 3.9, past end of life. Michael is a non-coder, so the choice is mine; the point is fewer moving parts.
- **Key file check before use.** `.env.local` is plain ASCII, no carriage returns, no quotes, no stray spaces, no trailing spaces; every value has a plausible length. No value was printed.
- **The free IEX stream is capped at 30 symbols (A2, A3).** The live list built by the daily screen must fit in 30 symbols, or the design must poll instead of stream. This shapes piece 5. Recorded now so it is not forgotten.
- **Feed is a setting:** `ALPACA_DATA_FEED`, default `iex`. Not in the key file because it is not a secret; it will live in the worker's plain settings.
- **Secret scan lives in the repo now:** `scripts/secret-scan.mjs`, run by `.githooks/pre-commit` (enabled with `git config core.hooksPath .githooks`). It loads every value from every `stacks/*/.env.local` and refuses the commit if any value appears in staged content, then applies key-shaped patterns. It never prints a match, only file, line and rule. Self-test: refused all six fake secrets and a real value taken from the key file; passed a clean file.
- **Fly command line tool:** installed with Fly's own install script to `~/.fly/bin`, with `--non-interactive` so the script does not edit shell startup files. Run as `~/.fly/bin/fly`. Supabase's tool runs through `npx supabase` (version 2.122.0).

### Smoke checks (read only, 2026-10-30, secrets not printed)
- **Alpaca, paper host only (`paper-api.alpaca.markets`):** account status ACTIVE, equity and cash 20000, so these are the new 20,000 dollar account's keys and not the 100,000 default's. Buying power 80000 and multiplier 4 (the default borrowing setting; stack C will set its cap in piece 4, subject to Michael's morning approval). Shorting is enabled on the account (`no_shorting` is false); stack C must set long only itself. Market clock works. One IEX latest trade (AAPL) returned data. The live host was not touched.
- **Discord:** the bot token authenticates (bot "Stack C bot"); the bot is in exactly one server, `DISCORD_GUILD_ID` ("Stack C"); the command channel is `commands` and belongs to that server; the server has `alerts`, `trading` and `commands`; Michael's user id is a human member and the server owner; the bot can read the command channel (0 messages yet). The alerts webhook belongs to the same server.
- **Healthchecks:** created `sib-tech stack C worker (cyrus)` through the v3 API with period 60 seconds and grace 180 seconds (the suggested values in the piece 0 checklist, a guess to tune), `unique` on the name so a retry cannot duplicate it. The ping URL was written into `.env.local`, not printed. An older check named "My First Check" already existed and was left alone.

## Piece 2: worker skeleton

### Plan
Settings loader with a paper-only guard, a logger and a redactor that hide secrets, a Discord webhook poster, a Healthchecks pinger, a test setup, and a tool that posts the holdback test message.

### Built (all under `stacks/cyrus/`)
- `src/config.ts`: reads settings from environment variables. **The trading host is a constant** (`paper-api.alpaca.markets`), not a setting, and `assertPaperHost` accepts only that exact host over https. A key id that does not start with `PK` (paper) is refused, so a live key (`AK`) cannot be loaded. `ALPACA_DATA_FEED` is `iex` or `sip`, default `iex`. Error messages name the setting, never the value.
- `src/redact.ts` and `src/log.ts`: every log line and every Discord message passes through a redactor that hides the exact secret values the process holds, then key-shaped patterns (webhook, ping address, bot token, database address, JWT, Alpaca key id, Supabase tokens). Logs are one JSON object per line.
- `src/discord.ts`: posts through the alerts webhook. Text is redacted and cut to Discord's 2000 characters, mentions are disabled (an alert cannot ping everyone), one retry after a rate limit, and a failed post returns a result instead of throwing. Holds the standing line "Paper trading only. Research input for a human decision, never an instruction to act."
- `src/heartbeat.ts`: Healthchecks pings (`ok`, `start`, `fail`), failure returns false.
- `src/local-env.ts`: reads `.env.local` on the Mac; on Fly the same names are secrets. Checked that Node's loader reads every value the same as a manual parse.
- `src/tools/post-test-alert.ts`: posts one test message to `alerts` for the holdback test.

### Decisions
- **Dependencies:** dev only, `typescript` and `@types/node` (type checking, nothing ships from them). No runtime dependency yet. The database library (`pg`) comes in piece 3.
- **Test runner:** Node's built-in (`node --test`). Test scripts: `npm test`, `npm run typecheck`. Node's runner needs a glob, not a folder name.
- A first redaction test failed: the database address pattern hid only the front of the address, leaving a tail. Fixed to hide the whole address. Kept the test.

### Tests
16 tests pass, type check clean. They cover: good settings, feed switch, live-shaped keys refused, no setting changes the trading host, eight bad trading addresses refused, missing and malformed settings, secret listing, redaction of values and key shapes, the logger, error descriptions, webhook post (redaction, length, no mentions, retry after rate limit, failure without throwing), and heartbeat urls.

### Left open
- **Discord desktop holdback test** needs Michael: desktop app open, then `node src/tools/post-test-alert.ts` from `stacks/cyrus/`, then whether the phone buzzed. Result to be appended here.

(Note, 2026-10-30: piece 2's first push was refused by GitHub's own push protection because a made-up Discord-token-shaped test string matched its scanner. Michael approved amending the one unpushed commit. The fixture is now built at run time. The secret scan also gained a per-line marker, `scan-allow-fake`, honoured only in `test/` files and only for the pattern rules, never for the check against the real values in `.env.local`. Piece 2 is commit `ed166de`.)

## Piece 4: Alpaca paper connection (touches money, reviewer required)

Piece order changed from the plan: pieces 3 (database) waits on Michael's Supabase login, so piece 4 was built first. It needs no login.

### Plan
A trading client that can only reach Alpaca's paper host; account switches (long only, borrowing cap); orders that are safe to retry and always carry a protective stop at the broker; a read-only data client with the feed as a setting; a paper check tool.

### Built (`stacks/cyrus/`)
- `src/alpaca-trading.ts`:
  - The address is a constant (`https://paper-api.alpaca.markets`), rebuilt and checked against the paper host before every call. A path that does not start with `/v2/` is refused.
  - Reads (account, clock, settings, positions, orders) retry up to 3 times on a network error, 429 or a 5xx. Writes never retry blindly.
  - `submitEntry` is the only way to open a position: a whole-share, long, market buy with a day time limit and a protective stop attached (Alpaca's "OTO" order, where the stop is created with the entry and held at Alpaca). Refused before sending: a quantity under 1 or not whole, a stop that is not below the reference price, a bad symbol, a bad order id. There is no sell entry and no short path.
  - Safe retry: every entry carries a `client_order_id`. After a timeout, a 429, a 5xx or a "duplicate id" answer, the client asks Alpaca whether that id exists and returns that order; only if it does not exist does it send once more with the same id (which cannot create a second order).
  - Bulk calls (cancel all orders, close all positions) come back as 207 with one result per item; a failed item is raised as an error instead of passing as success.
  - `setAccountConfig` accepts only a borrowing cap of 1, 2 or 4. It does not decide whether to raise a cap: that gate belongs to the morning limits flow (piece 6) and Michael's approval.
- `src/alpaca-data.ts`: latest trade, with the feed (`iex` or `sip`) taken from settings.
- `src/tools/paper-check.ts`: the plumbing check below.

### Tests
29 tests pass (13 new for the client): paper host only, keys in headers only, hostile paths, read retries, no retry on 401/404, entry shape (long, OTO, stop, day), nine bad entries refused with nothing sent, timeout then lookup finds the order (one POST only), timeout then not found (same id sent again), duplicate id, refused order not retried, cap values, 207 failures, no key in error text.

### Paper check against Alpaca's paper server (2026-10-30, 13:45 Central, market open)
- Account ACTIVE, equity 20000. Starting settings: borrowing cap 4, shorting allowed.
- **Set cap 1 and long only: both honoured and read back correct.** This answers piece 0's build-time question: Alpaca's paper server honours the borrowing cap setting (tested with 1, the safe value; 2 and 4 not tested because raising needs Michael's approval) and `no_shorting`. The account was left at cap 1 and long only. Raising to 2 or 4 happens only through the morning approval.
- One real paper round trip, disclosed: bought 1 share of SPY (IEX last 751.29) with a protective stop 5 percent below. The stop leg was created as `held`, then `new` after the fill, i.e. held at Alpaca. A second submit with the same id returned the same order (no second order). Close all left 0 positions and 0 open orders. This is a plumbing test by the builder, not the stack's trading; no limit approved by Michael applies to it, and its size (1 share, about 751 dollars of a 20,000 dollar paper account) is far below any limit I would suggest.
- Stream for fills: not built. Fills are read by polling orders (simple, and enough for plumbing). Revisit if polling proves too slow.

### Piece 4 review, round 1 (2026-10-30)

The named `build-reviewer` agent was not available in this session (agent files are read when a session starts, so it exists only after a restart). A general-purpose agent on Opus was told to follow `.claude/agents/build-reviewer.md` exactly. This is a stand-in, recorded here. Michael may restart the session before later reviews so the real agent is used.

- **Verdict: CHANGES REQUIRED.** Paper only, no secrets, separation and hard stops passed. Piece 2 was also checked: trading host is a constant, live-shaped keys refused, the `scan-allow-fake` marker is limited to test files and pattern rules.
- **Blocking finding:** `setAccountConfig` accepted `noShorting: false`, so later code could switch shorting back on, and a protective stop firing at the same moment as a close-out could leave the account short. **Fixed:** the method refuses `noShorting: false` outright (long only can be switched on, never off); tests added.
- **Non-blocking, done now:** requests refuse redirects (key headers never follow one); the paper check tool always closes positions in a `finally`; added tests for a failed lookup after a timeout, a duplicate answer on the second send, and the redirect setting.
- **Non-blocking, carried forward:** (a) pieces 6 and 7 route every order and every cap change through one gate that checks the stop flag, the limits and the morning approval, with a test that nothing else calls `submitEntry`; (b) the approved cap is passed in and any higher value refused; (c) the same decision must build the same order id after a restart (test in piece 7); (d) the protective stop is a day order, so a failed close-out leaves a position with no protection overnight: piece 7 alerts on that; (e) no retry or alerting in the data client yet (piece 8); (f) records: this section.

## Piece 5: market data and the daily screen

### Built (`stacks/cyrus/src/`)
- `universe.ts`: the day's starting universe from Nasdaq Trader's free symbol files (all Nasdaq-listed common stocks, plus NYSE-listed ones). Drops ETFs, test issues, warrants, units, preferreds, notes and tickers with symbols or digits. **Departure from the brief, stated plainly:** the brief says the screen builds from the six indexes of run 3 section 7.3. This universe (5,154 names on 2026-10-30) contains every member of all six (Dow, S&P 500, Nasdaq 100, Russell 2000, Nasdaq Composite, NYSE Composite) but does not label which index a name belongs to. Per-index labelling needs three more third-party files; it can be added later, and for a plumbing test it changes nothing. Michael can overrule.
- `screen.ts`: a deliberately simple placeholder rule, documented in the file: last close between 10 and 500 dollars; average daily dollar volume at least 100 million; rank by last session volume divided by the average of the earlier sessions; keep the top N. Same data always gives the same list. `liveListSize` cuts the list to 30 on the free feed.
- `stream.ts`: one connection to Alpaca's market data stream; the feed is a setting; refuses more than 30 symbols on `iex`; reconnects with a growing delay; a failed login is fatal (reconnecting cannot fix it).
- `alpaca-data.ts`: daily bars for many symbols, paged and chunked.

### Measured today
- **A paper-only login can read consolidated (`sip`) daily history**, because history older than 15 minutes is free on the Basic plan (AAPL, MSFT, SPY, 2026-10-23 to 2026-10-29: sip volume about 40 million for AAPL against about 1 million on iex). So the morning screen runs on consolidated prior-day data, as run 3 recommended, while live prices come from the free IEX stream. Real-time `sip` still needs a live account, so it stays a later configuration change.
- Live check at 13:50 Central: 5,154 names screened (5,149 returned bars; 195 seconds, so the screen should start well before the open), a 20 name live list, the stream connected, authenticated and went live, and received 197 trades from 16 of the 20 symbols in 25 seconds.
- The free IEX stream limit is 30 symbols; the live list defaults to 20.

### Tests
41 tests pass (12 new: universe filters, screen filters and ranking, list size, stream connect/auth/subscribe/trade delivery, feed as a setting, over-30 refused, reconnect and stop, fatal login failure, connection limit backoff).

### Piece 4 review, round 2 (2026-10-30)
**PASS** (same stand-in reviewer). The shorting blocker is fixed and tested; redirects refused; the paper check always closes. Piece 5 was checked for paper only, secrets, separation and gate bypass: nothing in it can place an order or change account settings. Reviewer's process note, accepted: the round 2 fixes and piece 5 shared one commit (`9f8436e`); later pieces will keep fixes in their own commit. Reviewer's note for Michael: piece 5's universe departs from the brief (see Piece 5).

## Piece 7 groundwork: limit checks (not yet complete, no reviewer yet)

`src/limits.ts` holds the pure check every entry must pass, with 16 tests: stop flag first, then "no limits approved today", market closed, first 5 minutes, last 60 minutes, stale price (older than 120 seconds), daily loss stop (at the limit refuses), trades a day, one entry per symbol per day, no doubling a held symbol, borrowing cap (cap 1 means exposure never above equity), position limit, whole shares only. Suggested limits (placeholders, small on purpose): largest position 1000 dollars, daily loss stop 200 dollars, 10 trades a day, borrowing cap 1. Owner overrides (`position`, `loss`, `trades`, `cap`) are checked against sanity bounds meant to catch typos.

## Where the build stands (2026-10-30)

- Done and pushed: pieces 1, 2, 4 (reviewed, PASS round 2), 5. Piece 7 groundwork (limits) in progress.
- **Blocked on Michael.** Nothing past this point can be built without them:
  1. `! cd /Users/mtbanta/Projects/sib-tech/stacks/cyrus && npx supabase login` (piece 3, the database that holds the stop flag, approvals and trade counts across restarts).
  2. `! ~/.fly/bin/fly auth login` (piece 9, deployment). Needs a Fly.io account with a card on file, under cyrus@sib-tech.co.
  3. Healthchecks: Integrations, "Connect Discord", Stack C server, `alerts` channel (the heartbeat alert route). Only the email route exists now.
  4. Discord holdback test: open the Discord desktop app, tell me, I post one message; then tell me whether the phone buzzed.
  5. Optional: restart Claude Code so the real `build-reviewer` agent loads, and paste Alpaca's written reply if you want it on file verbatim.
- Order of the remaining pieces: 3 database, 6 Discord commands and morning limits, 7 order gate and close-out (with the reviewer), 8 daily summary and scheduler, 9 Fly deployment, 10 rehearsal and the "first paper session" checklist.

---

# Resumed 2026-10-30, evening (second session)

Re-read the brief, this log, `PROJECT_STATE.md` and `CLAUDE.md` first, as the brief requires.

## Rulings and facts received at the start of this session

1. **Logins.** The `!` sign-ins failed, so Michael used other routes. Supabase: he created stack C's project himself (`sib-tech-stack-c`, West US Oregon, his existing organization), Data API on, automatic table exposure off, automatic RLS on. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` are in `.env.local`. `SUPABASE_ACCESS_TOKEN` stays blank and no account-wide token is to be requested. Fly.io: Michael says `FLY_API_TOKEN` is in `.env.local`; the card is on file and Fly.io is the approved host, so this is not a new paid plan. **Check made at the start of the session:** `.env.local` holds 13 names and none is a Fly name (see "Key file problems found" below).
2. **Healthchecks.io** is connected to Discord, Stack C server, `alerts` channel (Michael's statement, not yet tested by me).
3. **Screen universe approved:** all Nasdaq-listed and NYSE-listed common stocks, without index labels. This clears the piece 5 departure from the brief ("Piece 5", universe).
4. **Discord holdback test:** Michael will use the Discord website in Chrome (no Mac App Store app). I tell him when to open it and post the test message. Note for the result: a browser tab is not the computer app, so the result describes the website only.
5. **`build-reviewer` agent confirmed loaded** in this session (it is listed among the available agent types), so later reviews use the real agent, not the stand-in used for piece 4.
6. **Alpaca support's reply, verbatim, as Michael pasted it** (replaces the earlier relayed summary, which was strength D; this is the vendor's written answer, strength A for what it says, though I saw it second hand through Michael):

> Here is what we can share about Algo Trader Plus for personal, non-commercial Trading API use:
> One Algo Trader Plus market data subscription under a single Alpaca login generally covers all paper and live Trading API accounts tied to that login. Paper accounts use the same market data plan attached to your login as the live accounts, and you can have multiple paper accounts, each with its own API keys, and select the keys for the specific account you intend to trade.
> An Alpaca Paper Only Account receives IEX market data only, not the full SIP feed. The full SIP feed is part of Algo Trader Plus; real-time SIP requires an active Algo Trader Plus subscription. On the Basic plan, SIP is only available for historical data older than 15 minutes; recent or real-time SIP requires Algo Trader Plus on the login.
> We don't list a specific simultaneous stock data stream connection limit for personal Trading API logins. Instead, we specify websocket symbol limits: 30 symbols on Basic and unlimited on Algo Trader Plus. A numeric stream-connection limit per login is only shown for Broker API partner plans, not for personal Trading API subscriptions.
> Multiple subscribed logins are not described as a standard personal-use setup. Subscriptions are tied to a login and generally cover the paper and live accounts under that login. Separate accounts have separate credentials, and each account uses the plan attached to its own login.

   What it settles and what it leaves open, in plain terms:
   - It matches the earlier ruling: a paper-only login gets IEX only. It also matches the measurement in piece 5 (history older than 15 minutes on `sip` is readable on Basic).
   - **Open, matters only for stack D, no action now:** the reply names no per-login stream connection limit, while Alpaca's docs (A5) say that in many subscriptions the limit is 1 connection. The reply does not contradict A5, it just does not answer it. Whether stack C and stack D can stream at once on one login is therefore still unmeasured. Test when D is built.

## Follow-up on the piece 2 push refusal: the secret scan (separate commit)

**Root cause.** Piece 2's first push was refused by GitHub's push protection because a made-up Discord-token-shaped test string matched GitHub's scanner. My pre-commit scan should have caught it and did not, for two reasons I found by reading it:
1. The scan had a per-line exemption marker, `scan-allow-fake`, that skipped every pattern rule on a line in a test file. The offending line carried the marker. GitHub has no such marker, so the two scanners disagreed by design.
2. The Discord rule only matched tokens starting with M, N or O and a fixed part length, narrower than GitHub's.

**What changed.**
- The marker is **removed**, not tightened. No rule can be skipped for a line, a file or a folder. The check against the real values in each `.env.local` was never skippable and still is not.
- The rules moved to `scripts/secret-patterns.mjs`, each one deliberately broader than the vendor's real format. The Discord bot token rule now matches any three-part dot-separated base64 shape, whatever the first letter.
- **What I can and cannot say about "at least the same patterns as GitHub".** I read GitHub's supported patterns page on 2026-10-30 (`docs.github.com`, "Supported secret scanning patterns"; strength A). It names: Discord Bot Token (push protection on); Supabase Secret Key and Supabase Personal Access Token (push protection on); Supabase scoped personal access token and Supabase OAuth access token (alerts only). It names **nothing for Alpaca or for Healthchecks**, so those two rules in this repo already go beyond GitHub. GitHub **does not publish its regular expressions** and says it updates them and supports more than one token version, so copying its patterns exactly is not possible. The honest target is "broader than every known format", plus the real-values check. GitHub's push protection stays as a second line of defence.
- Rules now: Alpaca key ids (paper, live, broker) and Alpaca secret keys (next to the word alpaca), Discord webhook addresses, Discord bot tokens (any version) and Discord secrets next to the word discord, `sk-` keys, JWTs (this covers Supabase's service key), database addresses with a password, Healthchecks ping addresses (by check id or ping key) and API keys (as a header or next to the word healthchecks), Supabase `sb_secret_` keys and every `sbp_` access token (personal, scoped, OAuth), Fly.io `fo1_` and `FlyV1` tokens, private key headers. The Supabase, Fly and Healthchecks shapes are from the vendors' documented prefixes as I know them, written broad on purpose; they are not copied from GitHub.
- `--tree` option: `node scripts/secret-scan.mjs --tree` scans every tracked file. Ran it over the whole repo: clean after one false positive was fixed (the `sk-` rule matched the end of a web address slug in an old research note; the rule now requires `sk-` not to follow a letter, digit, underscore or hyphen).
- The pre-commit hook now finds the scan script next to itself, so it also works from a copy of the repo (the new test relies on this).

**Fixtures.** `stacks/cyrus/test/fakes.ts` holds every fake value. Rule: each is plainly fake and none has the shape of a real token. Tests that must prove a rule catches a realistic shape build that shape at run time from parts, so no source file holds a contiguous token. All `scan-allow-fake` markers were removed from the test files.

**Proof test.** `stacks/cyrus/test/secret-scan.test.ts` copies the real hook and scan into a throwaway git repository, with a dummy identity (`scan-test@example.invalid`, not Michael's), and for each of 15 realistic-looking tokens (Discord bot tokens including one starting with another letter, webhook, paper and live Alpaca key ids, Alpaca secret, Supabase secret key, personal and OAuth tokens, a service-key JWT, a database address with a password, Healthchecks ping and API key, Fly.io token, a private key header) checks that `git commit` exits non-zero, that HEAD does not move, that the rule is named, and that the scan never prints the token. Further cases: the old marker no longer lets a token through, in a test folder or elsewhere (the exact regression); a value copied from a local `.env.local` is refused even without a token shape; a clean file commits. 75 tests pass in total (57 before).

## Key file problems found at the start of this session (values never printed)

- `FLY_API_TOKEN` is not in `.env.local` (13 names, none Fly). Michael to re-save.
- `SUPABASE_URL` held `https://supabase.com`, the vendor's home page, not the project address. The full-tree secret scan flagged it, because it matched ten old research documents. I rewrote that one line to `https://<project reference>.supabase.co`, taking the reference from the service key's own claims (a service role key is a signed token whose readable part names the project; the reference is an address part, not a secret). Michael is told.
- `SUPABASE_DB_URL` is an `https://` web address, not a Postgres connection string (no `postgresql://`, no password). I cannot repair this one: the connection string contains the database password, which only Michael has. Michael to paste the Supabase "Connect" string (Session pooler, or Direct) with his password filled in. Piece 3 waits on that.

## Piece 3: database (code and schema done; not yet applied)

### Built (`stacks/cyrus/`)
- `db/001-initial.sql`: tables `control` (stop flag, Discord command cursor), `trading_days` (limits, approvals, live list, phase times), `orders` (every entry decided, keyed by the `client_order_id` sent to Alpaca), `refusals`, `events` (run log), `schema_migrations`. Row level security is on for all of them with no policy, and `anon` and `authenticated` get nothing, so the Data API cannot touch them. Nothing in the file deletes data. Written as a file first, as the override requires; Michael can read it before it is applied.
- `src/store.ts`: the `Store` interface and `MemoryStore` (tests only). `src/pg-store.ts`: `PgStore` over the `pg` library. The worker talks to Postgres directly with `SUPABASE_DB_URL`, not through the Data API (automatic table exposure is off).
- `src/store-contract.ts`: one behaviour check any store must pass (including "the same order id is refused, not overwritten"). `src/tools/apply-schema.ts` applies `db/*.sql` once each (recorded in `schema_migrations`) and then runs that check inside a transaction that is rolled back, so it leaves nothing behind.
- `config.ts` now refuses a `SUPABASE_DB_URL` that is not a Postgres connection address, with an error that names the setting.

### Decisions
- **New dependency: `pg` (version 8), with `@types/pg` for type checking.** The Postgres client for Node. It is the only runtime dependency so far. Added under the build override.
- **Direct Postgres, not the Data API,** because the schema must be applied with SQL anyway and the worker needs transactions. The Supabase access token (blank by Michael's ruling) is never needed.
- **TLS gap, said plainly:** the connection is encrypted but the server certificate is not pinned (`rejectUnauthorized: false`), because Supabase signs with its own authority that Node does not know. Fix later: pin Supabase's published certificate. A guess about severity: low for paper data, but it is a known gap.
- **Fail closed:** the worker never falls back to memory. If the store is down, it does not trade (built into the gate in piece 7).
- Postgres `date` values are read as plain text so the machine's time zone cannot shift a trading day.

### Tests
78 pass (3 new: memory store passes the behaviour check, can be made to fail, bad database address refused). 

### Not done, blocked on Michael
`SUPABASE_DB_URL` in `.env.local` is a web address (`https://...`), not a Postgres connection string, so the schema is not applied and the `PgStore` has not been run against the real database. Needed: the Supabase "Connect" string (Session pooler works over IPv4 and is the safe default for Fly) with the database password filled in. Then: `node src/tools/apply-schema.ts`.

## Piece 6: Discord commands and the morning limits flow (touches money, reviewer required)

### Built (`stacks/cyrus/src/`)
- `time.ts`: market date and market-time conversion using the platform's time zone data (checked across the daylight saving change on 2026-11-01), and Central time text for messages to Michael.
- `discord-bot.ts`: the bot over Discord's plain web interface (no live connection). It finds the server's channels by name, **checks the command channel belongs to the configured server**, posts redacted text with mentions off, and reads command messages newer than a cursor. `isOwnerCommand`: only the owner's id, only the command channel, never a bot's message.
- `morning.ts`: builds the day's record from Alpaca's calendar (holidays and half days come from there), with the **previous close equity as the day's starting point**; the request message; the command parser; `decideLimits` (pure): approve all, approve one, or overrule one (an overrule counts as the decision for that limit). **The day is approved only when all four limits are decided, and only before the open.** Steps: post the request once, one reminder 10 minutes before the open, and **lapse the day at the open if anything is undecided** (no trading that day, Michael told, a late approval is refused).
- `commands.ts`: `help`, `status`, `stop`, `resume`, `flatten`, `limits`, `approve [name]`, and the four overrules. `stop` sets the stop flag in the database and cancels only unfilled buy orders (never a protective stop); open positions keep their stops and are closed by the end-of-day close-out. `flatten` is my addition beyond the brief's "at least stop and status": it sets the flag and sells everything, because stop alone leaves positions open. A cap decision is **set at Alpaca first** (long only is set with it); if Alpaca refuses, nothing is approved.
- `broker.ts`: the slice of the Alpaca client the worker uses, so tests can supply a fake. New client calls: market calendar, cancel one order, close one position, and last-close equity on the account.

### Decisions
- **Polling, not a live connection.** The bot asks for new command messages every few seconds. Simpler and more reliable than keeping a socket alive; a command takes up to the polling interval (planned 5 seconds) to be seen. Needs the Message Content setting on the bot (Michael switched it on); **not yet verified**, because the command channel is empty. Once Michael types `help` in `commands`, `node src/tools/discord-check.ts` reports whether the text is visible.
- **First run never acts on history:** the cursor starts at the newest message. A replayed approval older than this morning's request is ignored (the request's time is stored).
- **A stop that cannot be saved says so loudly** and tells Michael to check Alpaca's dashboard. The gate (piece 7) also refuses every entry while the database is unreachable.
- **Posting channels:** requests, replies and alerts to Michael go to `commands`; trade messages to `trading`; `alerts` is used by Healthchecks (and the webhook for outages).

### Tests
104 pass (26 new): market times across daylight saving and half days, day creation and non-trading days, command parsing, owner-only handling (strangers, wrong channel, bots get no reply), first-run cursor, stop cancels only unfilled buys, flatten, partial and full approval, overrule bounds, cap set at Alpaca first and failure leaves nothing approved, late approval refused, lapsed day stays lapsed, old approval ignored, stop-failure message, bot channel checks, redaction and rate limit handling.

### Live check (2026-10-30)
`node src/tools/discord-check.ts`: channels found, command channel belongs to the configured server, one line posted to `trading`. Command channel empty, so message text visibility is untested.

### Piece 6 review, round 1 (2026-10-30), real `build-reviewer` agent
**PASS**, no blocking findings. Paper only, owner-only commands, stop flag and morning gate stored and read correctly, no new path to an entry, secret scan rework sound (marker removal proved by test). Non-blocking notes, and what was done (own commit, "piece 6 review fixes"):
- Stop error message could say the flag failed when cancelling failed; and a flag that could not be saved skipped the broker side. **Fixed:** the flag, the cancel and the sale are separate steps with separate honest messages; flatten still tries to sell if the flag cannot be saved.
- An approval could undo a lapse that happened while it was being saved. **Fixed:** the day is read again just before writing.
- A reminder was recorded as sent even if the post failed. **Fixed.** A failed lapse message is now recorded in the run log.
- `Broker` type included `submitEntry`. **Fixed:** only the gate holds the wider `GateBroker` type.
- Gate must pass limits only when the day is `approved` (done, tested with a pending and a lapsed day that both carry filled-in limits).
- Stop leaves partly filled entries alone (entries are market day orders, so the gap is short). **Left as is, recorded:** before changing it, test on paper what happens to the stop of a parent cancelled after a partial fill.
- `PgStore` untested against a real database; clock skew with Discord's timestamps refuses an approval (safe direction). Open.

## Piece 7: placeholder strategy, order gate, close-out (touches money, reviewer required)

### Built (`stacks/cyrus/src/`)
- `strategy.ts`: **placeholder opening range breakout.** For each name on the live list, the highest price in the first 5 minutes after the open is the range; the first trade above it afterwards is a buy signal, once per name per day; the protective stop is 1.5 percent below. Long only, deterministic. Its only job is to exercise the plumbing. Limitation, recorded: after a restart mid-session the range is not rebuilt, so that day gets no new signals (conservative).
- `gate.ts`: **the only code that sends an entry.** Order: stop flag read fresh from the database, morning approval (limits count only when the day is `approved`), the fixed checks in `limits.ts`, the broker's own switches (long only and cap no higher than approved are forced at Alpaca if they differ; an inactive or suspended account refuses), then the intent is written to the database with an id built from the date and symbol (`cyrus-YYYYMMDD-SYMBOL`) so a retry or restart cannot send it twice, the stop flag is read again, and only then is the order sent with its protective stop held at Alpaca. A database or broker outage refuses the entry (fail closed). Entries are handled one at a time. Refusals are written to the database with their reason. The peak exposure of the day is kept for the summary.
- `risk.ts`: brings stored entries up to date from Alpaca; **a filled entry whose protective stop is gone while the position is still held is sold at once and reported**; **daily loss stop**: when equity is down by the approved limit, sets the stop flag, sells everything, tells Michael (my addition: the brief only says "daily loss stop"; selling is the safer reading).
- `closeout.ts`: five minutes before the close, cancel open orders and sell every position (up to 3 tries, checking positions between), then put the borrowing cap back to 1. If the account is not flat it posts **NOT FLAT** loudly to `alerts` and `commands`.

### Tests
130 pass at this point. Gate: sent order shape (long, whole shares, stop, id), duplicate and restart never send twice, no approval means no entry (pending and lapsed), stop flag wins, a stop set between the checks and the send still stops it, database outage and broker outage refuse, each fixed limit refuses with its own reason, trades per day, borrowing cap 1, the cap lowered at Alpaca first (and no entry if that fails), broker error on send is recorded and not retried, simultaneous signals one at a time, **a structure test that fails if any file other than the gate and the manual paper-check tool calls `submitEntry`**, or if any other file changes the account or sells everything. Strategy, sync with an unprotected position, loss stop, close-out flat and not flat. A deliberate break of the stop check was caught by the full-day test, then restored.

## Piece 8: summary, scheduler, entry point

- `summary.ts`: the daily summary (entries with in and out prices, profit or loss from closed trades and from account equity, borrowing used as peak exposure over equity, refused entries by reason, stop flag, flat or not).
- `worker.ts`: one pass every 5 seconds: read commands (always first), build the day, morning request at open minus 60 minutes, reminder at minus 10, the screen in the background at minus 45, live prices from minus 5, lapse at the open, order sync and loss stop every 30 seconds during the session, close-out at close minus 5, summary at close plus 5. Every finished step is stored, so a restart repeats nothing. **The heartbeat is "ok" after a pass that worked and "fail" after one that did not** (database or broker unreachable), so Healthchecks hears about an unwell worker, not only a dead one.
- `main.ts`: wires the real pieces; refuses to start if the database does not answer; posts a start message; warnings and errors also go into the database run log (redacted).
- `test/day.test.ts`: the **rehearsal in code**: a whole simulated Monday through the real scheduler (request, approval with an overrule, screen, live list, a breakout entry with its stop, a stop command and the refusal after it, close-out, summary posted once, heartbeats), a day that lapses at the open and refuses a late approval, a restart that repeats nothing, a holiday, a database outage (heartbeat says fail), and a stopped worker that stops pinging. This is **not** the rehearsal the brief asks for (a recorded trading day on Alpaca's paper server with Michael answering); that needs a market day.

## Piece 9: deployment (prepared, not yet deployed)

- `Dockerfile`, `.dockerignore` (keys never enter the image), `fly.toml` (app `sib-tech-cyrus`, region San Jose, 512 MB shared CPU, restart always, no public service), `deploy/set-fly-secrets.mjs` (sends only what the worker needs through standard input, never on a command line; not the Fly token, not the Supabase service key, not the Healthchecks API key; refuses a non-paper key id or a non-Postgres database address).
- The Fly app `sib-tech-cyrus` was created in Michael's personal organization (empty, no machine, no cost yet). Fly token: it was pasted without the space after `FlyV1`; fixed in the file, then verified (one organization, no apps).
- **Not deployed**, because the worker refuses to start without a working database address and a crash loop would raise a false alarm on Michael's phone.
- Region note: San Jose chosen as the nearest to the Oregon database; Alpaca's server location is unknown. Measure later (a guess, not a measurement).

## Results received during piece 9 (2026-10-30, evening)

- **Discord holdback test (Michael's report):** with the Stack C server open in Chrome, a test message posted to `alerts` through the webhook at 16:19 Central, and Michael's phone received a push notification. **No holdback for the Discord website in Chrome.** Not tested: the Discord computer app (Michael has none); the brief's question was about the computer app, so that stays open if he installs one.
- **Database:** Michael replaced `SUPABASE_DB_URL` with the Session pooler string. `apply-schema` applied `001-initial.sql` to stack C's project; all six tables have row level security on; the store behaviour check passed against the real database inside a rolled-back transaction. (The first run of the check failed because Postgres `jsonb` reorders object keys and my comparison was order-sensitive: a flaw in the test, fixed.) Closes the "PgStore untested" item.
- **Deployment:** secrets sent with `deploy/set-fly-secrets.mjs` (nine names, through standard input), `fly deploy --ha=false`, one machine in San Jose (`sjc`). The worker started, posted its start message, and Healthchecks showed the check `up` with pings arriving every 5 seconds. Fly lists no Seattle region (list read 2026-10-30), so `sjc` stays the nearest to the Oregon database.
- **Heartbeat alert test (the brief's "worker stopped on purpose"):** machine stopped 16:34:46 Central; Healthchecks went `grace` then `down` at about 4 minutes; machine restarted 16:41:29 and the check returned to `up`. **Michael confirms he received both Discord messages (down and recovery).** Passed. Detection took about 4 minutes with the period 60 seconds and grace 180 seconds, as set.

## Pieces 7 and 8 review, round 1 (2026-10-30), real `build-reviewer` agent

**CHANGES REQUIRED.** Paper only, no secrets, separation, hard stops, and "only the gate sends an entry" all clean. Four blocking findings, all fixed in their own commit:
1. **An entry that reached Alpaca could be recorded as "failed"** (a database blip after the send, or an unclear timeout), which dropped it from the trades-a-day count and from the missing-stop check. **Fixed:** only a definite refusal from Alpaca (a local refusal or a 4xx other than 429) is "failed". An unclear outcome stays an "intent": it still counts as a trade, the order sync reconciles it by its id and moves it to "submitted", and a problem writing the record after a successful send is logged and never reported as a failure. Tests added for each.
2. **The order list had no date window,** so after about 500 orders the sync and the summary could stop seeing today's orders. **Fixed:** both ask for orders since the start of the New York day. Checked against the real paper server (window honoured). Alpaca's default window with no date is not documented in anything I read; the account has only 2 orders, so the 500 limit itself was not reproduced.
3. **Close-out could fail silently.** **Fixed:** it is recorded as done only when the account is flat; otherwise it retries every 5 minutes until 30 minutes past the close; the heartbeat says `fail` for as long as positions remain; and a fallback that needs no database reads the broker's own clock and sells everything near the close if the database is unreachable.
4. **Feed errors were only logged.** **Fixed:** `feed-alert.ts` posts a login failure to `alerts` at once and repeated reconnects after five in a row, at most once every 15 minutes.

Non-blocking notes, done: a tick no longer starts while the previous one runs; the "ok" heartbeat goes out about every 30 seconds and `fail` only after 3 bad passes in a row (or at once while not flat); no false "no protective stop" alarm while a sell is already working; `src/tools` is left out of the Docker image; after a restart past the open the strategy gives no signals for the day (a partial opening range cannot be trusted); an approval reply now warns if the stop flag is still on. Left as is: the daily loss stop does not retry its sale (the close-out is the backstop); the stop command can miss an entry that passed the gate's last check just before it; Fly region (see above).

## First paper session: checklist for Michael (plain English) (SUPERSEDED 2026-10-30 night: see the revised checklist at the end of this log)

The next trading day is **Monday 2026-11-02**. Times are Central. The worker is already running on Fly.io and needs nothing from you except the steps below. Everything is paper money (a 20,000 dollar practice account). Nothing the stack posts is advice or an instruction to act.

**Before Monday (once):** type `help` in the `commands` channel of the Stack C server. The bot should answer with the command list. If it does not answer, the bot cannot read your messages (the Message Content switch on the bot's page in the Discord Developer Portal), and I need to know.

**What you will see on Monday, and when**
- **7:30 AM**, in `commands`: "Good morning. Suggested limits for today". It lists four limits: largest position 1,000 dollars, daily loss stop 200 dollars, 10 entries a day, borrowing cap 1 (no borrowing). These are small on purpose.
- **Before 8:30 AM you must answer.** Reply `approve` to accept all four, or change any with `position 1500`, `loss 150`, `trades 5`, `cap 2` (changing one counts as your decision on it). `approve cap` accepts one. The stack says "All four limits decided" when it has them all. **If any limit is undecided at 8:30 AM, it will not trade that day** and says so. A reminder arrives at 8:20 AM.
- **7:45 AM onward**, in `trading`: today's live list (up to 20 names; the free price feed carries at most 30).
- **8:30 AM**: the market opens. The strategy watches each name's first 5 minutes, then buys the first name that breaks above its opening high (long only, whole shares, at most one entry per name, each with a stop order held at Alpaca 1.5 percent below). Expect few or no entries on some days. Each entry is announced in `trading`.
- **2:55 PM**: the close-out sells everything and checks the account is flat ("Close-out done: the account is flat"). If it is not, **NOT FLAT** goes to `alerts` and `commands` and the heartbeat alarm fires: open Alpaca and close by hand.
- **3:05 PM**: the daily summary in `trading`: entries, profit or loss, borrowing used, refused entries and why.

**Commands (only you, only in `commands`)**
- `status`: what it is doing right now.
- `stop`: no new entries; unfilled entries are cancelled; open positions keep their stops and are sold at the close-out.
- `flatten`: stop, then sell everything now.
- `resume`: clears a stop (also needed the day after a loss stop).
- `limits`, `help`.

**Things to test on Monday** (the rehearsal the brief asks for): answer the morning request; type `status`; type `stop` after an entry (or before the open, to see entries refused) and then `resume`; watch for the close-out and summary. Then on purpose, stop the worker once more (I do this; you will get the alert and the recovery message, as on Friday).

**How to stop the stack, from your phone:** type `stop` (or `flatten`) in `commands`. If Discord is down: open the Alpaca app or website, cancel open orders and close positions. Stronger still: in Fly.io, stop the machine (the heartbeat will then also alert you).

**What is NOT proven yet:** a trading day with real paper entries. Everything so far was tested by automated simulation and by live reads, one 1-share paper round trip (piece 4), the heartbeat alert, the database and the deployment. The free price feed is one exchange only, so prices and the opening range are rough; the placeholder strategy is not meant to make money.

## Pieces 7 and 8 review, round 2 (2026-10-30): STOP AND FLAG MICHAEL

The real `build-reviewer` agent confirmed findings 2, 3 and 4 fixed and tested, and finding 1 fixed except for **one leftover path**, which makes the round 2 verdict **STOP AND FLAG MICHAEL** (round 2 still has a blocking finding). Checks 2, 7 and 10 (paper only, secrets, hard stops) and separation are clean.

- **The leftover:** the first send times out but the order lands late; the lookup by id says "not found" because Alpaca has not caught up; the second send answers 422 "client_order_id must be unique". That means the order exists, but the gate classified every 4xx other than 429 as a definite refusal and recorded it "failed", so it would drop out of the trades-a-day count, the exposure count and the missing-stop watch for that entry. Rare (broker slowdowns), limited harm (the stop at Alpaca is still held, the close-out and loss stop work on the whole account, the symbol cannot be re-entered), but it is the round 1 defect.
- **Fix made after the round (small, tested, committed, NOT yet deployed, NOT yet re-reviewed):** the gate treats a duplicate-id 422 as unclear, so the row stays an intent and still counts. Also: the approval reply no longer says the command failed if only the stop-flag read afterwards fails. 143 tests pass.
- **Per the brief this is a stop point:** no third review round and no new piece without Michael. Michael decides: (a) accept the fix without another review and deploy it, or (b) have the reviewer look at it once more.
- **Reviewer's other non-blocking notes, not fixed, for Michael to rule on:** `notFlat` lives only in memory (a restart after a failed close-out forgets it, and on a weekend it is never re-checked); close-out retries after hours would queue market sells for the next open; the emergency and the regular close-out could overlap (harmless near the close); `failedTicks` resets after one good pass, so failures on alternate passes never raise `fail`; a stream started after the open gives no entries and nothing tells Michael why; a failed record update after a good send is only logged.

---

# Resumed 2026-10-30, night (third session)

Re-read `CLAUDE.md`, `PROJECT_STATE.md`, the brief and this log first. The `build-reviewer` agent is loaded (listed among the available agent types, and used below).

## Michael's decisions at the start of this session (as given)

1. Order-recording fix: run the reviewer once more (a one-time third round, approved), deploy if it passes.
2. Reviewer's smaller notes: fix every note that touches orders, limits, protective stops or the close-out, including the "not flat" state being forgotten after a restart. Log the rest.
3. Commands: the bot answered `I did not understand ""` to `help`. Message Content Intent was switched on in the Developer Portal. Make sure the worker reads message text.
4. Market hours: at 4:32 PM Central on Friday the bot said "The market is open". Fix and test after-hours, weekends, holidays.
5. Restarts: "worker started" three times between 4:32 and 4:41 PM Central. Find the cause.
6. Limits flow: after the close, post the next trading day's suggested limits and checklist. Michael approves that evening, can change them again before the open. Nothing approved before the open means no trading that day.
7. Final phase review before Monday's open.

## Decision 1: review round 3 (one-time, approved): PASS, deployed

The real `build-reviewer` agent, round 3, range `2c46451..6673e94`. **PASS, no blocking findings.** It walked every path where an order may exist at Alpaca (timeout then not found then duplicate 422; 5xx; failed lookup; database error after a good send; restart between intent and send) and found each recorded as an intent that still counts. 143 tests and the type check passed on its run. Standing checks 2, 7, 8, 10 clean.

Deployed as Fly release v3 (about 8:56 PM Central, market closed), `fly deploy --ha=false`. The worker started on the new image.

Its non-blocking notes: (a) after an unclear first send, a later 4xx other than 429 or the duplicate 422 (for example a 403 from a failed lookup or from the second send) was still treated as a definite refusal and recorded as failed. **Fixed in this session** (`submitEntry` now turns every later error after an unclear first send into an unclear one, status 502, which the gate keeps as an intent). (b) The duplicate check matches the text `client_order_id` in Alpaca's 422 message; not confirmed against a live answer. **Open, to log:** one paper test sending a duplicate id would confirm it (market hours needed). (c) No single test runs the whole chain: **done**, `alpaca-trading.test.ts` and the gate tests now cover the chain end to end.

## Decision 3: commands and message text

- **Cause and state:** with Message Content Intent off, Discord returns empty text to a bot in its web interface. The worker reads the command channel through that web interface (it polls, it never opens a live gateway connection), so **there is no intent for the worker to request in code**: the switch in the Developer Portal is the whole mechanism, and no restart is needed. **Measured at about 8:50 PM Central:** reading the channel now returns Michael's `Good`, `Help` and `help` with their text (length 4 each). The earlier empty replies were from before the switch took effect.
- **Code change:** an owner message whose text arrives empty now gets an honest reply naming the Message Content switch and where it is, instead of `I did not understand ""` (test added).
- Because of the three earlier empty messages the command cursor is past them, so Michael types `help` again.

## Decision 4: market hours bug

- **Cause (found, not guessed):** at 4:32 PM Central on Friday 2026-10-30 (21:32 UTC) the deploy started the worker, whose first pass created Friday's day record because none existed (the request is made in the morning and the worker had not run that morning). `lapseIfUndecided` only asked whether the clock was past the open, not whether the session was still on, so it lapsed the day and posted "The market is open and today's limits were not all decided" two seconds after the start (Discord history: 21:32:57 start, 21:32:59 that message). The time zone arithmetic itself was right: checked 4:32 PM CT = 5:32 PM ET, after the 4:00 PM close; the 2026-11-02 open converts to 8:30 AM CT; a half day closes at 18:00 UTC.
- **Fix:** one function, `sessionPhase(day, now)` in `time.ts`, answers `no_session`, `before_open`, `open` or `after_close` from the day's own calendar times. The lapse now uses it: during the session the message names the open time and the day; after the close, a day that never had a request is created already lapsed with its close-out and summary marked skipped, and says nothing. The "too late" wording no longer claims the market is open. `status` now prints the session phase from the calendar next to Alpaca's clock and flags a disagreement.
- **Tests added:** the exact bug (a deploy at 4:32 PM Central on a Friday posts nothing about the market, no lapse, no close-out or summary, one request for Monday), session phase at the open, the close, one second either side, Friday 4:32 PM Central, the daylight saving weekend, a half day, weekends and holidays, the next session across a weekend and across Thanksgiving, late-night Central time (the New York date is what counts), status after hours.

## Decision 5: the three "worker started" messages

**Not a crash loop.** Fly logs and release history (read 2026-10-30): 4:32 PM Central deploy (release v1); 4:34 to 4:41 PM Central the deliberate stop and start for the heartbeat alert test (SIGINT, "exited normally with code 0"); 4:44 PM Central the deploy of the round 1 review fixes (release v2). Each is an action the builder took. Nothing restarted by itself. Tonight's deploy (release v3) posted a fourth.

**Change so it cannot look like a crash again:** the start message now says why. Each start records the release and its time in the database; the message says "New release X (it was Y), so this is a deploy" or "Release X again: the same code started again", gives the start time in Central time and how many starts there were in the last hour, and three or more in an hour also posts an alert to `alerts` telling Michael to check the Fly logs. Tests added.

## Decision 6: the limits flow moved to the evening before

Michael's ruling supersedes the brief's "each morning before the open" for the timing. The brief's other rules stand (Michael approves or overrules each limit; undecided at the open means no trading that day).

**How it works now** (code: `morning.ts`, `worker.ts`, `commands.ts`; the file name `morning.ts` is kept):
- **Request.** After a session is over, the stack posts the NEXT trading day's suggested limits and a checklist to `commands`. The next session comes from Alpaca's calendar (`NextSessionFinder`, 14 days ahead, so weekends, holidays and half days are right), never "tomorrow". It is posted at any quiet hour if it has not been posted for that day: 10 minutes after the close (after the summary), or at once on a weekend or after a restart. Posted once, remembered in the database.
- **Checklist** (read live, each line says "could not be read" rather than disappearing): stop flag (warns if ON), whether the account is flat, the borrowing cap and long only at Alpaca right now, the price feed.
- **Answers.** `approve`, `approve cap`, `position 1500`, `loss 150`, `trades 5`, `cap 2` apply to the next trading day that has not opened, picked by comparing against open times (not the calendar date, so late evening is right). They work any time before that day's open, including again after the day is approved. The old "approval sets the cap at Alpaca first" is gone: approval only records.
- **Review.** At 60 minutes before the open a "Good morning" message shows the day's limits and checklist again (skipped if the request itself went out inside that hour); a reminder at 10 minutes if still undecided.
- **Open.** Undecided limits lapse the day: no trading, Michael told (only when the session is actually on).
- **Arming (new, 5 minutes before the open).** For an approved day: set long only and the approved borrowing cap at Alpaca, read both back (a cap Alpaca does not keep is a failure), read the day's starting equity from the previous close, record `armed`. **The gate refuses every entry on an unarmed day** (fail closed). A failure alerts `alerts` (at most every 5 minutes) and is retried every 10 seconds. Reason for arming at the open and not at approval: an evening approval of cap 2 would otherwise leave the account at cap 2 overnight and over the weekend with nothing watching, and the close-out deliberately returns it to 1 every night. (Correction after the final review: after a close-out that ends not flat, the armed cap does stay at Alpaca until the account is seen flat; entries are refused meanwhile, the gate lowers the cap before any entry, and the cap goes back to 1 as soon as the flag clears outside a session. See "Final phase review, round 1".) The starting equity is also read at arming, because Alpaca's "last equity" is not yet the right day's number the evening before.
- **Commands.** `limits` shows today's and the next day's limits; `status` shows the session phase and the next session.

**Tests added** (`test/limits-flow.test.ts`, `test/day.test.ts` rewritten for the evening flow): the request goes out once at Friday night, Saturday and Sunday starts across restarts; waits until 10 minutes after the close during a session; an after-close approval applies to Monday and not to Friday; a change after approval applies, and is refused at the open; nothing approved means no trading; arming sets the cap at open minus 5 and not before, reads the start equity, and fails closed when Alpaca errors or does not keep the cap (no entry, an alert, works once Alpaca does); the gate refuses unarmed and not-flat days and the stop flag stays the reason given; a late request is not followed by a duplicate review.

## Decision 2: the reviewer's non-blocking notes (pieces 6, 7 and 8, rounds 1 to 3)

Rule applied: fix every note that touches orders, limits, protective stops or the close-out; log the rest.

| Note | Decision | What was done |
| :-- | :-- | :-- |
| "Not flat" lived only in memory, so a restart forgot it, and on a weekend it was never re-checked | Fix | Saved in the database (`not_flat`). Loaded on start with an alert. Cleared only when the account is seen flat, on any day and hour. The heartbeat says fail while set. The gate refuses entries while set. Tested across a restart. |
| Close-out retries after hours would queue market sells for the next open (and cancel the stops first) | Fix | After the close, close-out sends nothing: it reports once and keeps the flag. At the next open any carried positions are sold (the market is open, so it sends). Tested. |
| Emergency and regular close-out could overlap | Fix | One lock for regular, carried and emergency close-outs. Tested (the test fails by timeout if the lock is removed). |
| Daily loss stop does not retry its sale | Fix | While the stop flag carries the loss-stop reason, each order sync retries the sale unless a sell is already working. An owner's plain `stop` is left alone. Tested. |
| The stop command can miss an entry that passed the gate's last look just before it | Fix | While the stop flag is on, every order sync cancels unfilled entries (protective stops and partly filled entries untouched). The gap is at most one sync interval (30 seconds). Tested. |
| A failed record update after a good send was only logged | Fix | Alert to `alerts`. The row stays an intent, which counts, and the sync reconciles it by its id. Tested. |
| After an unclear first send, a later 4xx (such as a 403 from the lookup or second send) was treated as a definite refusal | Fix | `submitEntry` turns every error after an unclear first send into status 502 (unclear). Tested with the exact chains. |
| The duplicate check depends on Alpaca's wording | **Measured** | Paper test 2026-10-30 night: a 1-share unfillable limit order sent twice with the same id answered `422 "client_order_id must be unique"`; cancelled; 0 open orders left. The match is right. |
| Stop leaves partly filled entries alone | Log | Entries are market day orders, so partial fills are rare. To settle: on paper during market hours, partly fill an entry, cancel the parent, and see whether the protective stop survives. |
| `failedTicks` resets after one good pass, so alternate failures never raise `fail` | Log | Health alerting only, touches no order. Better rule: fail on 3 failures in the last 10 passes. |
| A stream started after the open gives no entries and nothing tells Michael why | Log | Touches no limit or stop; the restart path is conservative (no entries). Better: one message "opening range missed, no entries today". |
| Clock skew between Discord timestamps and ours could refuse an approval | Log | Safe direction (refuses). |

## First paper session: checklist for Michael (plain English), revised 2026-10-30 night

This replaces the earlier checklist (limits flow moved from the morning to the evening before). The next trading day is **Monday 2026-11-02**. Times are Central. The worker is already running on Fly.io. Everything is paper money (a 20,000 dollar practice account). Nothing the stack posts is advice or an instruction to act.

**Once, before the weekend ends:** type `help` in the `commands` channel of the Stack C server. The bot should answer with the command list. (It can read your text now: the Message Content switch is on.) If you type `stop` to test it, type `resume` afterwards: the stop flag is saved in the database, survives restarts and deploys, and stops all entries until cleared.

**What you will see, and when**
- **Right after the worker is up outside a trading session** (tonight, then every evening about 10 minutes after the close, 3:10 PM): in `commands`, "Suggested limits for Monday 2026-11-02 (market opens at 8:30 AM CT)". Four limits (largest position 1,000 dollars, daily loss stop 200 dollars, 10 entries a day, borrowing cap 1, which means no borrowing) and a **checklist**: the stop flag, whether the account is flat, the borrowing cap at Alpaca right now, the price feed.
- **You answer that evening or any time before the open.** `approve` accepts all four. Change one with `position 1500`, `loss 150`, `trades 5`, `cap 2` (changing one counts as your decision on it). `approve cap` accepts one. The stack says "All four limits decided" when it has them all. **You can change any limit again until the open**, even after approving.
- **7:30 AM**, "Good morning. Limits for today ... all four are decided" or "NOT all decided yet", with the checklist again. A chance to review and change.
- **8:20 AM**, a reminder only if something is still undecided.
- **If any limit is undecided at 8:30 AM, it will not trade that day** and says so. A late approval is refused.
- **7:45 AM**, in `trading`: today's live list (up to 20 names; the free feed carries at most 30).
- **8:25 AM**, "Armed for Monday": the stack sets the approved borrowing cap and long only at Alpaca, and reads the day's starting equity. This is when the cap changes at Alpaca (the one exception: after a failed close-out it stays at the armed value until the account is flat, then goes back to 1). If it cannot, `alerts` says "Could not arm" and there are no entries until it can.
- **8:30 AM**: the market opens. After the first 5 minutes the strategy buys the first name that breaks above its opening high (long only, whole shares, one entry per name, each with a stop held at Alpaca 1.5 percent below). Expect few or no entries on some days.
- **2:55 PM**: the close-out sells everything and checks the account is flat. If it is not, **NOT FLAT** goes to `alerts` and `commands`, the heartbeat alarm fires, and the flag is remembered across restarts. After 3:00 PM it sends nothing (a market order after the close would queue overnight); it sells at the next open instead, and no entries happen until the account is flat. You can also close by hand in Alpaca.
- **3:05 PM**: the daily summary in `trading`. **3:10 PM**: the request for the next trading day.

**Commands (only you, only in `commands`)**
- `status`: what it is doing now, including the session phase from the calendar and the next session.
- `stop`: no new entries; unfilled entries are cancelled (and again every 30 seconds while stopped); open positions keep their stops and are sold at the close-out.
- `flatten`: stop, then sell everything now.
- `resume`: clears a stop (also needed the day after a loss stop).
- `limits`: today's and the next trading day's limits. `help`.

**Things to test on Monday** (the rehearsal): answer the evening request, change one limit after approving, watch the 7:30 review and the "Armed" message, type `status`; type `stop` after an entry (or before the open, to see entries refused) and then `resume`; watch the close-out, the summary and the evening request. Then, on purpose, stop the worker once more (I do this; you get the alert and the recovery message).

**How to stop the stack from your phone:** `stop` (or `flatten`) in `commands`. If Discord is down: Alpaca's app or website, cancel open orders and close positions. Stronger still: in Fly.io, stop the machine (the heartbeat also alerts).

**Restarts:** each start posts "worker started" and now says why (new release, or the same release again) and how many starts in the last hour. Three in an hour also posts to `alerts`.

**What is NOT proven yet:** a trading day with real paper entries. Everything so far was automated simulation, live reads, one 1-share paper round trip, the heartbeat alert, the database and the deployment. The free feed is one exchange only; the placeholder strategy is not meant to make money.

## Final phase review, round 1 (2026-10-30, night), real `build-reviewer` agent: CHANGES REQUIRED

Range `da59c9f..6676607`, a fresh review of the evening flow, arming, the gate, the close-out, plus a whole-worker look. Standing checks 2, 7, 8 and 10 clean (paper only, no secrets, separation, hard stops). The reviewer confirmed: an approval cannot reach the wrong day (the next session that has not opened, from the calendar; no request, skipped, lapsed or opened days are refused; replies older than the request are ignored; the race check repeats before writing); weekends, holidays, half days, the 2026-11-01 time change and the New York date after 11 PM Central are right; undecided and unarmed days cannot trade; "unclear stays unclear" is right; every caller of `setAccountConfig`, `closeAllPositions`, `closePosition`, `cancelOrder` and `submitEntry` is where expected, and nothing ever sets shorting on or a cap above an approved value. 25 of its own mutations were caught.

**One blocking finding, fixed:** positions carried into a new day were handled only if the not-flat flag existed. Two double failures left them held with no flag: the worker down across the close and back after midnight New York time (yesterday's close-out never runs), or an emergency close-out ending not flat while the database was down and the worker restarting before it came back. Then there was no sale at the open, the gate accepted entries, the order sync did not watch them, and the protective stops had probably expired (they are day orders; from Alpaca's documentation, not measured).
- **Fix:** outside the session (before the open, after the close, weekends) every pass treats any held position as not flat: it sets the flag, saves it, alerts ("Positions are held outside the session ... nothing had flagged it"), the gate refuses entries, and the sale happens at the open. A flag that could not be saved is saved again once the database is back. Tests: a brand new worker on Tuesday before the open with positions and no saved flag; a flag that could not be saved; both fail when the fix is removed.

**Non-blocking notes, all fixed except where stated:**
- **A cap change after arming** was recorded but never applied (a lowered cap stayed higher at Alpaca until the gate lowered it before the first entry). Now a changed cap undoes the arming and the scheduler arms again in the same pass, so Alpaca holds the new cap before any entry. Tested.
- **The armed cap stayed at Alpaca after a not-flat close-out** (and over a weekend) because the flat path never ran. Now, when the flag clears outside the session, the cap is put back to 1 (and Michael is told if that fails). While not flat, the cap cannot be lowered safely (an Alpaca change with leveraged positions open is untested), so entries are refused and the gate lowers the cap before any entry. Tested.
- **A failure in the limits flow** (the calendar read once after each open, a Discord failure) aborted the whole pass, skipping the order sync, the loss stop, the stop sweep and the carried sale. Now it is caught, logged and alerted (at most every 10 minutes), and the rest of the pass runs. Tested.
- **Close-out sold when the broker's clock could not be read**, up to 30 minutes after the close. Now an unreadable clock after the day's close counts as closed (nothing is sent); before the close it still sells. Tested.
- **The daily loss stop used the start equity read the evening before** until arming succeeded. Now it does nothing on a day that is not armed. Tested.
- **Test gaps** the reviewer found by mutation: the regular close-out ignoring the lock, the not-flat check ignoring a running close-out. Both now tested and caught. **One guard stays untested on purpose:** the carried close-out's own `closingOut` check. The carried sale needs the session open and the regular close-out retry only runs after the close, so they cannot be in flight together; it is defensive redundancy. The two arming-time guards (the scheduler's and `armDay`'s own) cover for each other; each alone is still untested, and removing both is caught.
- Tests after the fixes: 188 pass, type check clean. Eighteen deliberate breakages of the new behaviour were each caught by a failing test (the lock removal is caught as a test timeout).

## Final phase review, round 2 (2026-10-30, night): STOP AND FLAG MICHAEL

Range `6676607..f775572`, the real `build-reviewer` agent. Standing checks 2, 7, 8 and 10 clean across `da59c9f..f775572`. 188 tests and the type check passed on its run. It confirmed the round 1 fix holds outside the session (flagged, alerted, refused, sold at the open; a flag that could not be saved is re-saved; a legitimate position is never flagged in the session, including the 5 minutes before the close; nothing in the not-flat check sends a sell or an entry; no window found in which an entry goes out at the wrong cap or on an unarmed day).

**One blocking finding remains, so the brief requires a stop:** the round 1 fix covered only the outside-session path. If the worker's first pass after an outage lands INSIDE the session (down across yesterday's close and back after today's open, or the database down past the open after a failed emergency close-out), `notFlatCheck` returned before reading positions. The reviewer reproduced it: no flag, no alert, heartbeat ok, no sale at the open, and an entry for another symbol went out beside the carried position, whose protective stop had probably expired (day order; from Alpaca's documentation, not measured).

**Fix made after the round (committed, tested, NOT deployed, NOT re-reviewed; the brief allows no round 3):** during the session, every 30 seconds while nothing is flagged, any held symbol with no stored order from today is treated as carried: flagged, saved, alerted ("Positions are held that this worker did not enter today"), the gate refuses entries, and the carried sale runs at once. The gate writes every entry down before sending it, so a legitimate position always has a stored order (tested both ways). A position bought by hand in Alpaca during a session would be treated the same way and sold (the 2:55 PM close-out would sell it anyway).

**The reviewer's non-blocking notes, handled:**
- The carried close-out's own `closingOut` guard: the reviewer is right that my earlier reasoning was wrong (a regular close-out starting at 2:55 PM can still be running when the carried retry is due). **Now tested** (the earlier "defensive redundancy" remark above is withdrawn). Removing the guard fails a test.
- The re-arm now compares the old and new cap values, so an `approve` that changes the cap also re-arms. Tested.
- `notFlatCheck` is now inside a try/catch, so a broker failure outside the session no longer skips the limits flow, arming or the close-out.
- Left, logged: if the flag clears between open minus 5 and the open, the cap goes back to 1 while the day still shows armed at the approved cap (errs safe; the gate lowers but never raises, and the scheduler will not re-arm that day because the phase is recorded). To fix: clear `armed` when the cap is reset. Not done: Michael decides.
- Tests after these fixes: 192 pass, type check clean; each new behaviour fails a test when removed (the in-session scan, the carried lock, the re-arm compare, own entries not being treated as carried).

**State of the deployment, said plainly:** Fly runs release v3 (code at `da59c9f`: the morning limits flow, the earlier fixes, none of tonight's changes). Everything after that, the evening flow, arming, the session phase fix, the close-out hardening, the start reason and the in-session carried scan, is committed and pushed but **not deployed and not passed by the reviewer** (round 1 CHANGES REQUIRED, round 2 STOP AND FLAG MICHAEL, one blocking finding which is fixed but not re-reviewed).

## Michael's decisions after the round 2 stop (2026-10-30, night)

1. **One more review round on the final phase fixes, approved as a one-time extra round** (it becomes round 3 of the final phase review). If it passes, deploy. If it returns CHANGES REQUIRED or STOP AND FLAG MICHAEL, do not deploy, leave release v3 running and tell Michael.
2. After a successful deploy: post Monday's suggested limits and checklist to Discord at once (Michael approves over the weekend); tell Michael when to test `help`, `status`, `stop` and `resume` from his phone and confirm the stop flag is cleared afterwards; update this log and `PROJECT_STATE.md` with the review result and the release number.
3. **Standing rule change:** money-touching pieces and phase-end reviews may run up to **three** `build-reviewer` rounds without asking. Stop and flag Michael if round three fails, or on any STOP AND FLAG MICHAEL verdict (the reviewer uses that verdict for paper-only, secrets and hard-stop problems). Recorded in `CLAUDE.md`'s sib-tech override. Note for the reviewer prompts: the agent file is a byte-exact copy of the brief and says a blocking finding in round 2 means STOP AND FLAG MICHAEL; under this rule the builder tells the reviewer which round is the last allowed.

