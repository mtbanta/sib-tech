# Run 3 notes: prices for every tool that may appear in an itemized monthly cost table

Research input for a human decision, never an instruction to buy anything or to act. Prices are US dollars and can change at any time.

## Decisive facts table

US dollars a month unless marked. "RT and consolidated?" applies to market data rows only: RT = real time; consolidated = covers trades on every U.S. exchange (the CTA and UTP tapes, often called the SIP). Three tests separate the data rows and are stated in "key limits": (1) is "consolidated" confirmed or only claimed; (2) can it serve a 5,000 to 6,000 symbol screen or only a 50 to 200 symbol live list; (3) do the vendor's terms allow a program to use the data (non-display use).

| Tool | Plan | Monthly price | What it gives | RT and consolidated? | Key limits | Price label | PX |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Alpaca | Basic | 0 | Stock data with a brokerage account | RT from IEX only (one exchange, not consolidated); full SIP 15 minutes late | 30 streaming symbols; 200 calls a minute | published | PX-01, PX-03 |
| Alpaca | Algo Trader Plus | 99 | Real-time data from all U.S. exchanges | Yes and yes, confirmed (CTA and UTP, "100% of market volume") | Unlimited streaming symbols; 10,000 calls a minute (marketing page says "Unlimited"); `*` wildcard for bars; snapshot symbols-per-request cap NOT stated; Alpaca's own data agreement on program use not read | published | PX-01 to PX-04 |
| Massive (was Polygon.io) | Stocks Starter / Developer | 29 / 79 | Whole-market snapshots, streams, history | No: 15 minutes delayed | Misses a 5-minute reaction target | published | PX-05 |
| Massive | Stocks Advanced | 199 | Real-time whole-market data, quotes, financials | Yes and yes, per vendor ("100% Market Coverage"; run 1 MD-06: direct feeds plus the SIPs) | Market Data Terms: "strictly for display use only"; "non-display use" forbidden "unless you are licensed"; individuals, non-pros only | published | PX-05, PX-06 |
| Databento | Standard | 199 | Live U.S. equities "Mini" blend plus history | RT yes; consolidated NOT shown (a blend of direct feeds, no SIP dataset named) | Plus 1,500 or 1,750 and Unlimited 4,000 or 4,500, annual contracts (own pages disagree) | published (fetch tool; `curl` blocked) | PX-07, PX-08 |
| Finazon | SIP, non-professional | "from 4" | Advertised SIP feed for individuals | Claimed yes and yes; NOT confirmed purchasable (dataset page redirects to an IEX-derived product) | Unknown | gated and unverified | PX-09 |
| Twelve Data | Grow / Pro / Ultra | 29, 49 or 79 / from 99, 229 shown / from 329, 999 shown | Real-time U.S. stocks plus global data | RT yes; consolidated no (run 2 DC-61: venues with about 5 percent of volume) | Grow and Pro are display-only, "cannot be programmatically processed"; only Ultra (999) allows non-display use | published | PX-10 |
| Alpha Vantage | Premium (75 to 1,200 requests a minute) | 49.99 to 249.99 | Request-based quotes; bulk quotes 100 tickers a request | Claimed: "consolidated NBBO ... across exchanges, dark pools, and FINRA TRFs"; real time only after an "entitlement" step via a separate terminal sign-up | Entitlement cost and terms unread; feed source not named | published (price); entitlement gated and unverified | PX-11, PX-12 |
| EODHD | Free to All-In-One | 0, 19.99, 29.99, 59.99, 99.99 | Global history, 15-minute delayed live data | No: delayed; real-time stream 50 symbols, one exchange (run 1 MD-44) | 50 streaming symbols per token | published | PX-13 |
| Finnhub | Market data Basic / Standard / Professional | 49.99 (billed quarterly) / 129.99 (quarterly) / 199.99 (annually) | U.S. stock data, history, WebSocket | Not stated on the page | 150 / 300 / 900 calls a minute; WebSocket 250 / unlimited symbols; "Personal Use" | published (read from the page's own source data) | PX-14 |
| Financial Modeling Prep | Starter / Premium / Ultimate | 29 / 69 / 139 (19 / 49 / 99 billed annually) | Fundamentals, quotes, batch quotes | Not stated | 300 / 750 / 3,000 calls a minute | published | PX-15 |
| Interactive Brokers | Network A + B + C, non-pro, L1 | 4.50 (1.50 each) | Real-time consolidated U.S. quotes in its apps and API | Yes and yes, confirmed (CTA and UTP networks) | 100 streaming lines by default, so live list only, not a wide screen; 500 dollar minimum equity; alternative route: 10.00 snapshot bundle (waived at 30 commissions) plus 4.50 streaming add-on | published | PX-16 |
| Interactive Brokers | Quote Booster | 30 per pack | 100 more streaming lines | n/a | Needed to stream more than about 100 symbols | published | PX-16 |
| Supabase | Pro (organization) | 25 | Postgres database, auth, functions, cron; first project's Micro compute covered by a 10 credit | n/a | Edge Functions 2 million invocations, 400 s wall clock, 2 s CPU; Cron down to every second | published | PX-17, PX-19 |
| Supabase | Additional project in a Pro organization | about 10 (Micro) | A second database project | n/a | "You cannot launch Nano instances on paid plans"; Nano is billed at the Micro price in paid organizations; the 10 credit covers one project only | published | PX-17, PX-18 |
| Vercel | Hobby | 0 | Web hosting and functions | n/a | "non-commercial personal use only"; cron once a day (plus or minus 59 minutes); 300 s functions; single region | published | PX-20, PX-21 |
| Vercel | Pro | 20 for one person (1 deploying seat and 20 of usage credit included); 20 per extra seat | Web hosting, functions, cron | n/a | Cron once a minute; 800 s functions; default region Washington, D.C. (`iad1`), changeable; up to 5 regions | published | PX-20, PX-21 |
| Cloudflare | Workers Paid | 5 minimum | Scripts at the network edge, cron, KV, Durable Objects | n/a | 10 million requests and 30 million CPU ms included; 30 s CPU per cron run at a 1 or 5 minute interval (15 min only for hourly or slower crons); 250 cron triggers | published | PX-22 |
| Cloudflare | Durable Objects (inside Workers Paid) | 0 extra, ESTIMATE, for one stream-holding object during market hours | A long-lived instance that can hold a connection | n/a | 400,000 GB-s included; billed at 128 MB while active; outbound-stream behaviour not read | published (rates); ESTIMATE (usage) | PX-23 |
| Fly.io | `shared-cpu-1x` 256 MB, always on | 2.19 | Smallest always-on server | n/a | Price stated for Ashburn or Secaucus; plus 0.02 per GB out | published | PX-24 |
| DigitalOcean | Basic Droplet 512 MiB | 4.00 | Smallest always-on server | n/a | 1 vCPU, 10 GiB disk, 500 GiB transfer | published | PX-25 |
| AWS Lightsail | 0.5 GB with public IPv4 | 5 (3.50 IPv6-only) | Small always-on server | n/a | IPv6-only may not reach IPv4-only services (my inference) | published | PX-26 |
| Railway | Hobby | 5 minimum, includes 5 of usage | Usage-billed app hosting | n/a | Actual usage of an always-on worker not computed | published | PX-27 |
| Render | Smallest paid instance | 7 (workspace Hobby 0) | Always-on service or worker, 512 MB | n/a | Free compute covers web services, Key Value and Postgres, not listed for workers | published | PX-28 |
| Hetzner Cloud | CPX11 (smallest with U.S. locations) | unknown | Small server, Ashburn or Hillsboro | n/a | Prices drawn by scripts; plans shown "currently unavailable" | gated and unverified | PX-29 |
| GitHub Actions | Free, private repo | 0 to about 7.66, ESTIMATE | Scheduled jobs every 5 minutes at best | n/a | 2,000 minutes included; 0.006 a minute Linux; schedules can be late or dropped (run 2 DC-40) | published (rates); ESTIMATE (total) | PX-30 |
| Telegram | Bot API | 0 | Push messages to the owner's phone | n/a | About 1 message a second per chat | published | PX-31 |
| Pushover | Individual | 0 monthly; 4.99 ONE-TIME per platform | Push notifications | n/a | 10,000 messages a month | published | PX-32 |
| ntfy | ntfy.sh free / Supporter / Pro | 0 / 6 (5 annual) / 12 (10 annual) | Push notifications by plain web request | n/a | Free: 250 messages a day, topic name acts as the password | published | PX-33 |
| Resend | Free / Pro | 0 / 20 | Alert emails | n/a | Free: 3,000 a month, 100 a day | published | PX-34 |
| Twilio | U.S. SMS, long code, sole-proprietor registration | about 4.45 at 100 texts, ESTIMATE; plus 19 one-time | Text messages | n/a | 0.0083 a text plus 0.0035 to 0.005 carrier fee; number 1.15 a month; campaign 2 a month; brand 4 (or 4.50) and vetting 15 one-time | published (rates); ESTIMATE (total) | PX-35, PX-36 |
| Healthchecks.io | Hobbyist / Supporter / Business | 0 / 5 / 20 | Heartbeat ("dead man's switch") checks | n/a | Free: 20 checks; routes include Telegram, ntfy, Pushover; SMS needs Business credits | published | PX-37 |
| UptimeRobot | Free / Solo | 0 / 13 (12 annual) | Website and heartbeat monitors | n/a | Heartbeat appears NOT in Free (icon read from source); Free "Good for hobby and non-profit projects" | published | PX-38 |
| Better Stack | Free | 0 | 10 monitors and heartbeats | n/a | "Free for personal projects"; Slack and email alerts only | published | PX-39 |
| Quiver Quantitative | API | from 30 (higher tier unseen) | Congress trades, lobbying, insider and other alternative data | n/a | Pricing page behind a sign-up redirect | published (30); gated (higher tier) | PX-40 |
| Firecrawl | Free / Hobby | 0 / 16 billed yearly | Web page reading for agents | n/a | Free 1,000 credits a month; Hobby 5,000 | published (annual figures) | PX-41 |

### Plain-English reading of the data rows (my synthesis, research input only)

- **Alpaca Algo Trader Plus at 99 a month** passes tests 1 and 2 (confirmed consolidated; unlimited streaming symbols and a request rate high enough for a wide screen) and is the only plan seen that fails none of the three. Test 3 is open, not passed: Alpaca's own market data agreement on program use was not read in any run, and the snapshot symbols-per-request cap is still unstated.
- **Interactive Brokers at 4.50 (or up to 14.50) a month** is confirmed consolidated and real time, but its default of about 100 streaming lines fits only the 50 to 200 symbol live list (with 0 to 2 boosters at 30 each), not the 5,000-symbol screen.
- **Alpha Vantage at 49.99** claims consolidated data, but the real-time switch sits behind an entitlement step that could not be read. **Finazon at "from 4"** is a claim that could not be bought as far as could be seen. Neither should be the basis of a cost table until those are seen.
- **Massive Advanced at 199** is consolidated real time, but its terms say display use only and forbid non-display use unless licensed. **Twelve Data below 999** forbids programmatic processing outright.

Nothing here is an instruction to buy anything. Prices change; recheck on the vendor's page before paying.

## Method

- Today is 2026-10-13 (America/Chicago), confirmed with `date`.
- Evidence comes only from pages opened live in this session: `curl` with a generic browser User-Agent string (no name, email or other personal information in any header), tags stripped by a small local script; the WebFetch tool; and web search. Recalled knowledge was used only to decide where to look.
- No browser was used (the Playwright server was down and no other browser tool was permitted). No account was created, no trial started, no form filled, nothing installed.
- Quotes marked "verbatim (curl)" are the page's own text with tags stripped. Quotes marked "via fetch tool" passed through a summarizing model and may be lightly paraphrased. Any em dash or en dash in a source has been replaced with a comma or hyphen.
- Strength: A = primary and authoritative (regulator, exchange, or the vendor's own documentation, pricing page or terms, seen live). B = reputable independent press or established reference publisher. C = review, comparison or affiliate sites. D = forums, social posts, personal blogs, community code repositories.
- Price labels: "published" (vendor's own public page, seen live today), "corroborated" (two or more independent sources agree, named), "gated and unverified" (with the reason).

## Earlier findings reopened and reused

Reopened today (every price that may enter a cost table, because the owner's rule requires a price seen on the vendor's own page in run 2 or run 3, and many were last seen in run 1 on 2026-10-08):

- Alpaca Algo Trader Plus price and limits (run 2 DC-45 to DC-47, run 1 MD-11, MD-12): reopened to confirm price, feed, stream cap and request rate today, and to look again for a snapshot symbols-per-request cap (run 2 not-verified item 4).
- Massive Stocks plans (run 2 DC-43, run 1 MD-03 to MD-08, MD-15): reopened for prices and the "display use only" wording, because the run 1 quote's source page was not identified in run 2's tables.
- Databento (run 1 MD-18 to MD-20, run 2 DC-57, DC-58): reopened because run 2 recorded conflicting prices and could not read the docs.
- Finazon (run 2 DC-66): reopened because the "from $4" SIP plan was never confirmed.
- Twelve Data, Alpha Vantage, EODHD (run 1 MD-23, MD-28, MD-43; run 2 DC-59 to DC-63): reopened only for whether any individual plan is real time and consolidated, and its price.
- Finnhub and Financial Modeling Prep (run 1 MD-36, MD-40, third-party figures only): reopened because no vendor page was ever read.
- Interactive Brokers market data subscriptions (run 2 DC-51 to DC-53): reopened for the consolidated non-professional subscription prices.
- Hosting (run 1 RT-45, RT-46, RT-50 to RT-55, RT-61, RT-62, RT-64 to RT-68; run 2 DC-40, DC-41): all reopened, because every host price in run 2's Category 2 table was a run 1 price that run 2 reused without reopening.
- Quiver Quantitative and Firecrawl (run 1 prices reused in run 2 Category 6): reopened if quick.

New in run 3 (never researched before): alerts and monitoring (Telegram Bot API, Pushover, ntfy, Resend, Twilio SMS, Healthchecks.io, UptimeRobot, Better Stack), Hetzner Cloud.

Reused without reopening: nothing that carries a price. Non-price findings leaned on as background, at their original dates: run 1 MD-44 (EODHD's real-time WebSocket is one exchange, Cboe EDGX); run 2 DC-59 (Alpha Vantage described as "Nasdaq-licensed"), DC-61 (Twelve Data's U.S. real-time venues carry about 5 percent of volume), DC-41 (GitHub Actions rounding each job up to a whole minute), DC-53 (IBKR market data lines), and DC-69 to DC-75 (tape-plan licensing). Each is named where it is used.

## Findings register

### A. Market data

**PX-01.** Alpaca's Trading API market data has two plans for individuals: Basic, free, and Algo Trader Plus at 99 dollars a month. Algo Trader Plus gives real-time coverage of "All US Stock Exchanges", unlimited WebSocket (streaming) symbols and 10,000 historical API calls a minute; Basic is IEX only, 30 streaming symbols and 200 calls a minute.
Page: About Market Data API (Alpaca docs, `.md` version)
URL: https://docs.alpaca.markets/us/docs/about-market-data-api.md
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "| Pricing | Free | $99 / month | ... | Real-time market coverage | IEX | All US Stock Exchanges | | Websocket subscriptions | 30 symbols | Unlimited | ... | Historical API calls | 200 / min | 10,000 / min |" (verbatim (curl), table cells joined)

**PX-02.** Alpaca says the paid feed is the consolidated tape: sourced from CTA (administered by NYSE) and UTP (administered by Nasdaq), "100% of market volume". So Algo Trader Plus qualifies as real time AND consolidated.
Page: About Market Data API (Alpaca docs)
URL: https://docs.alpaca.markets/us/docs/about-market-data-api.md
Accessed: 2026-10-13
Strength: A
Price: published (same page as PX-01)
Quote: "Our data sources are directly fed by the CTA (Consolidated Tape Association) ... and the UTP (Unlisted Trading Privileges) stream ... The synergy of these two sources ensures comprehensive market coverage, encompassing 100% of market volume." (verbatim (curl), elided)

**PX-03.** Alpaca's marketing page shows the same 99 dollar price but describes the API calls differently: "Unlimited API calls" for Algo Trader Plus in the plan table, and "up to 10,000 API calls/min" in its header. Free plan: real time via WebSocket from IEX, "15 minute delay via API", WebSocket "Limited to 30 symbols"; Algo Trader Plus: "All US Exchanges", "Unlimited symbols".
Page: Alpaca - Unlimited Access, Real-time Market Data API
URL: https://alpaca.markets/data
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Algo Trader Plus For algo traders and quants $99/mo ... API Calls 200 API calls/min Unlimited API calls ... Exchanges IEX All US Exchanges ... Websockets Limited to 30 symbols Unlimited symbols" (verbatim (curl))

**PX-04.** Alpaca's multi-symbol stock snapshot request takes "A comma-separated list of stock symbols" with no maximum stated in the reference, and defaults to the `sip` feed for subscribers to the paid plan. The stock stream accepts a `"*"` wildcard for bars (example `"bars":["*"]`). The snapshot symbols-per-request cap therefore remains NOT stated (as in run 2).
Page: Snapshots (stock, multi-symbol) API reference, `.md`; Real-time Stock Data, `.md`
URL: https://docs.alpaca.markets/us/reference/stocksnapshots-1.md ; https://docs.alpaca.markets/us/docs/real-time-stock-pricing-data.md
Accessed: 2026-10-13
Strength: A
Price: not a price finding
Quote: "Default: `sip` if the user has the unlimited subscription, otherwise `iex`." and "{"action":"subscribe","trades":["AAPL"],"quotes":["AMD","CLDR"],"bars":["*"]}" (verbatim (curl))

**PX-05.** Massive (formerly Polygon.io) Stocks plans for individuals, billed monthly: Basic 0 (end of day, 5 API calls a minute), Starter 29 (15-minute delayed), Developer 79 (15-minute delayed, adds trades), Advanced 199 (real time, adds quotes and Financials and Ratios, "Non-pros only"). All paid plans list unlimited API calls, WebSockets and snapshots; all say "100% Market Coverage". Annual billing is advertised at 20 percent off. Partner add-ons (Benzinga, TMX, ETF Global) are 99 a month each.
Page: Pricing | Massive
URL: https://massive.com/pricing
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Stocks Starter Great for aggregates $29 /month Billed monthly ... 15-minute Delayed Data ... Stocks Developer ... $79 /month ... 15-minute Delayed Data ... Stocks Advanced Great for real-time data $199 /month ... Real-time Data ... Individual use Non-pros only" (verbatim (curl))

**PX-06.** Massive's Market Data Terms of Service (last updated August 28, 2025), which sit beside its Individuals Terms of Service, say market data is "strictly for display use only" unless another agreement says otherwise, and forbid "non-display use" and derived works including an "investment strategy" "unless you are licensed to do so". This is the source of run 1's MD-15 quote, now located: it is the Market Data Terms, not the Individuals Terms (the Individuals Terms, last updated July 18, 2025, contain no "display use" wording; they limit use to "personal, non-commercial, and non-business purposes"). Whether a personal trading program counts as non-display use is still not settled by the page.
Page: Market Data Terms of Service | Massive; Massive for Individuals Terms of Service
URL: https://massive.com/legal/market-data-terms-of-service ; https://massive.com/legal/individuals-terms-of-service
Accessed: 2026-10-13
Strength: A
Price: not a price finding
Quote: "Unless otherwise stated in a subsequent agreement with us or a Third Party Provider, any and all Market Data is strictly for display use only." and "(d) Use Market Data for non-display use or to create derivative works (including ... investment strategy) based on the Market Data unless you are licensed to do so" (verbatim (curl), middle elided)

**PX-07.** Databento's general pricing page shows Standard at 199 a month (monthly subscription, includes live data), Plus at 1,750 and Unlimited at 4,500 a month in licence fees (annual contract required), and says usage-based (pay as you go) live data is not available for its US Equities service. The page names no SIP or consolidated dataset. The site refused `curl` today (an empty challenge page), so this was read through the fetch tool only.
Page: Pricing | Databento
URL: https://databento.com/pricing
Accessed: 2026-10-13
Strength: A
Price: published (read via fetch tool; `curl` blocked)
Quote: "Usage-based live data is not available for Databento US Equities" and Standard "$199" "per month", "Monthly subscription"; Plus "$1,750" in "license fees", "Annual contract required" (via fetch tool)

**PX-08.** Databento's U.S. equities catalog page shows different licence fees for the same plans (Plus 1,500, Unlimited 4,000; Standard 199), so run 2's contradiction is still present today. The catalog lists exchange direct feeds plus Databento's own "US Equities Max, Mini, and Summary"; Mini is "Derived from our proprietary blend of top-of-book direct feeds" and no dataset is described as SIP, consolidated or covering all U.S. exchanges. A Databento blog post found by search says live Mini data is included with any Standard, Plus or Unlimited subscription. Conclusion for the table: Databento Standard is real time but NOT shown to be consolidated, so it does not meet the requirement on what could be read.
Page: us equities (Databento catalog); search result summary of "Databento US Equities Mini now available" (blog, not opened)
URL: https://databento.com/catalog/us-equities ; https://databento.com/blog/databento-us-equities-mini-now-available
Accessed: 2026-10-13
Strength: A (catalog); blog via search summary only
Price: published (via fetch tool), with the in-house contradiction noted
Quote: Plus "$1,500" in "license fees," "per month," with "Annual contract required." Mini: "Derived from our proprietary blend of top-of-book direct feeds" (via fetch tool)

**PX-09.** Finazon's featured U.S. stocks page still advertises a SIP dataset, "Every US exchange", "100% market volume", with "Prices start at $4 monthly for Non-Professional, individual use" and professional use from 2,000 a month plus exchange fees. But the dataset's own address (`/dataset/sip_non_pro`) answers with a permanent redirect (HTTP 301) to `us_stocks_essential`, which is "US Equities Basic", "based upon a derived IEX feed" with "3-5% of the total trading volume", from 19 a month. That page also tells non-professional individuals they "are better off with the US Equities Max dataset", which no readable page lists. The datasets catalogue is drawn by scripts and showed only a "SIP" publisher filter. So the 4 dollar SIP plan is a claim on the vendor's own page that cannot be confirmed as purchasable; unchanged from run 2.
Page: US Stocks Market Data (Finazon featured dataset); US Equities Basic (Finazon); Pricing (Finazon)
URL: https://finazon.io/featured-datasets/us-stocks-market-data ; https://finazon.io/dataset/sip_non_pro (301 to https://finazon.io/dataset/us_stocks_essential) ; https://finazon.io/pricing
Accessed: 2026-10-13
Strength: A
Price: claim published on the vendor's page, but NOT confirmed as a purchasable plan (dataset page redirects to a different, IEX-derived product). Treat as gated and unverified for a cost table.
Quote: "Prices start at $4 monthly for Non-Professional, individual use. For Professional, commercial usage, prices begin at $2,000 a month plus exchange fees" and "US Equities Basic is based upon a derived IEX feed. The volume coverage is 3-5% of the total trading volume" (verbatim (curl))

**PX-10.** Twelve Data's personal-use plans today: Grow 79, Pro 229, Ultra 999 a month billed monthly (about 17 percent off yearly), with 377, 1,597 and 10,946 API credits a minute. Grow lists "Real-time US stocks". New and decisive: Grow carries only "Internal display data access", which says the data "cannot be programmatically processed"; only Ultra (999) lists "Internal non-display data access" for "programmatic processing". The pricing page does not say whether the U.S. real-time feed is consolidated; run 2 (DC-61) found it covers venues with about 5 percent of volume, so no Twelve Data individual plan is shown to be real time AND consolidated. Run 2's contradiction ("From $29/$99/$329" against 79/229/999) is RESOLVED today: the page source shows each plan has a credit-tier selector, and Grow's tiers are 29 (55 credits a minute), 49 (144) and 79 (377, the default shown); "From" is the lowest tier.
Page: Twelve Data pricing (Personal use tab, rendered text and the page's own tier data)
URL: https://twelvedata.com/pricing
Accessed: 2026-10-13
Strength: A
Price: published
Quote: tier data "\"code\":\"monthly-55\",\"price\":\"$29\"" ... "\"code\":\"monthly-144\",\"price\":\"$49\"" ... "\"code\":\"monthly-377\",\"price\":\"$79\"" and "Grow For hobby projects $79 /month billed monthly ... Internal display data access View-only access for internal use within your applications and dashboards. The data may be displayed but cannot be programmatically processed, stored, transformed, or redistributed." Ultra: "$999 /month ... Internal non-display data access Use the data internally for programmatic processing" (verbatim (curl), elided)

**PX-11.** Alpha Vantage premium plans, monthly: 49.99 (75 requests a minute), 99.99 (150), 149.99 (300), 199.99 (600), 249.99 (1,200), all with no daily limit. Real-time and 15-minute delayed U.S. data are not switched on by paying alone: the page says that "for personal use" the subscriber must log into its "Alpha X Terminal" (a separate sign-up) and complete a "data entitlement process", and calls that terminal a "display portal". What that entitlement step costs or requires is not on the page.
Page: Premium API Key | Alpha Vantage
URL: https://www.alphavantage.co/premium/
Accessed: 2026-10-13
Strength: A
Price: published (plan price); entitlement step gated and unverified (behind a sign-up)
Quote: "75 requests/min + premium support: $49.99/month ... If you would like to access realtime US market data, 15-minute delayed US market data ... for personal use, please log into your Alpha X Terminal ... to start the data entitlement process" (verbatim (curl), elided)

**PX-12.** Alpha Vantage's documentation now describes its U.S. data as "consolidated NBBO quotes/trades/volumes ... across exchanges, dark pools, and FINRA TRFs" (NBBO = national best bid and offer, the best prices across all exchanges; TRF = trade reporting facility, where off-exchange trades are reported). Quote requests take an `entitlement=realtime` setting, and a "Realtime Bulk Quotes" request "accepts up to 100 tickers per API request". On the vendor's own words this is a consolidated real-time candidate at 49.99, but the feed source is not named (run 2 DC-59 recorded "Nasdaq-licensed"), and the entitlement step (PX-11) is unread. Treat as claimed, not confirmed.
Page: API Documentation | Alpha Vantage
URL: https://www.alphavantage.co/documentation/
Accessed: 2026-10-13
Strength: A
Price: not a price finding
Quote: "For US markets specifically, our data also includes deep, consolidated NBBO quotes/trades/volumes, minute-level aggregates, and snapshots across exchanges, dark pools, and FINRA TRFs." and "our Realtime Bulk Quotes API , which accepts up to 100 tickers per API request." (verbatim (curl))

**PX-13.** EODHD's individual plans: Free 0, EOD Historical 19.99, EOD + Intraday 29.99, Fundamentals 59.99, All-In-One 99.99 a month (annual billing about 17 percent less). Its "Live / delayed data" is "15-min"; its real-time WebSocket for U.S. stocks streams 50 symbols at a time per API token ("The 50 is a limit on tickers"). Neither page read today names the U.S. real-time feed (run 1 MD-44 found Cboe EDGX, one exchange), so EODHD is not shown to be real time AND consolidated.
Page: EODHD pricing; Real-Time Data API via WebSockets (EODHD docs)
URL: https://eodhd.com/pricing ; https://eodhd.com/financial-apis/new-real-time-data-api-websockets
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Historian EOD Historical All-World $ 19.99 /mo. ... Active trader EOD + Intraday ... $ 29.99 /mo. ... Equity analyst Fundamentals ... $ 59.99 /mo. ... Everything ALL-IN-ONE Package $ 99.99 /mo." and "Your subscription streams 50 symbols at a time" (verbatim (curl))

**PX-14.** Finnhub's pricing page is drawn by scripts, but its own page source carries the prices and the plan table. U.S. market data plans for "Personal Use": Basic 49.99 a month (billed quarterly, 150 API calls a minute, WebSocket 250 symbols), Standard 129.99 (quarterly, 300 calls a minute, unlimited WebSocket symbols), Professional 199.99 (billed annually, 900 calls a minute). The table does not say whether U.S. data is real time or consolidated. First time any Finnhub price has been read from Finnhub itself (runs 1 and 2 had only third-party figures).
Page: Finnhub pricing (page source: `window.serverData.price` and the page's script bundle)
URL: https://finnhub.io/pricing (script https://finnhub.io/static/js/webpack/dist/main.bundle.c4f221fd5fc41d2c966a.js)
Accessed: 2026-10-13
Strength: A
Price: published (read from the page's own embedded data with `curl`, not as rendered; a browser check of the rendered page would confirm)
Quote: "\"marketdata-basic\":49.99,\"marketdata-eod\":49.99,\"marketdata-professional\":199.99,\"marketdata-standard\":129.99" and "\"Limit\"),\"150 API calls/minute\"),\"300 API calls/minute\"),\"900 API calls/minute\")" ... "\"Websocket\"),\"250 symbols\"),\"Unlimited symbols\")" (verbatim (curl), page source)

**PX-15.** Financial Modeling Prep (FMP) personal plans: Basic 0 (250 calls a day, end of day), Starter 29 monthly or 19 a month billed annually (300 calls a minute), Premium 69 or 49 annually (750 a minute), Ultimate 139 or 99 annually (3,000 a minute, "Bulk and Batch Delivery"). The comparison table has a "Real-time Data" row whose values are icons, and the page says "Displaying or redistributing data sourced from FMP requires a specific Data Display and Licensing Agreement". No page read names FMP's U.S. feed or says it is consolidated.
Page: Pricing Plans - FMP API; FMP Real-Time Market Data APIs
URL: https://site.financialmodelingprep.com/pricing-plans ; https://site.financialmodelingprep.com/datasets/market-data-real-time
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Starter $29 $ 19 . 00 /month Save 34% billed annually ... 300 API Calls / Minute ... Premium $69 $ 49 . 00 /month ... 750 API Calls / Minute ... Ultimate $139 $ 99 . 00 /month ... 3,000 API Calls / Min" (verbatim (curl))

**PX-16.** Interactive Brokers (IBKR) consolidated U.S. stock data for a non-professional, two routes on its own page: (a) the three tape networks separately, "NYSE (Network A/CTA)(L1) - Billed by Broker" 1.50, "Network B" 1.50 and "NASDAQ (Network C/UTP)(L1)" 1.50 a month non-pro (4.50 together; pro 45, 25, 25); or (b) the "US Securities Snapshot and Futures Value Bundle" at 10.00 a month (waived if commissions reach 30) plus the "US Equity and Options Add-On Streaming Bundle" at 4.50 non-pro (125 pro), which "Includes NYSE (Network A/CTA) ... (Network B), NASDAQ(Network C/UTP), and OPRA". Snapshot quotes are 0.01 each for U.S. stocks. The binding limit for a wide screen is not price but lines: "All clients initially receive 100 concurrent lines of real-time market data (which can be displayed in TWS or via the API)", raised by commissions or equity, or by "Quote Booster packs at USD 30.00 per pack" of 100 lines each. IBKR also states a minimum equity balance of 500 dollars for an individual to have data activated. So IBKR is real time AND consolidated for about 4.50 to 14.50 a month, but streams only about 100 symbols by default, enough for a 50 to 200 symbol live list only with one to two boosters (30 to 60 a month), and not for a 5,000-symbol sweep.
Page: Market Data Pricing | Interactive Brokers
URL: https://www.interactivebrokers.com/en/pricing/market-data-pricing.php
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "NYSE (Network A/CTA)(L1) - Billed by Broker United States USD 1.50 USD 45.00 ... US Equity and Options Add-On Streaming Bundle ... United States USD 4.50 USD 125.00" and "US Securities Snapshot and Futures Value Bundle USD 10.00 USD 30.00" (verbatim (curl); column headers "Non-Pro Fees/month Pro Fees/month"; the 10.00 is from the page's waiver example table, "Fee" and "Commissions Waiver")

### B. Hosting

**PX-17.** Supabase Pro is "From $25 / month", "First project included. Additional projects from $10/mo." Paid plans "include $10/mo in compute credits, enough to cover one Micro instance". Compute sizes on the pricing page start at Micro 10 (shared, 1 GB), Small 15, Medium 60, Large 110, XL 210; "First instance is free on paid plans". Edge Function invocations: Free plan 500,000 a month; Pro 2 million a month included, then 2 dollars per million. Realtime messages: Free 2 million, Pro 5 million. Nano does not appear in the pricing page's compute table.
Page: Pricing & Fees | Supabase
URL: https://supabase.com/pricing
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Pro ... From $ 25 / month First project included. Additional projects from $10/mo." and "Paid plans include $10/mo in compute credits, enough to cover one Micro instance." and "Micro $10 Shared compute 1 GB 60 200 Small $15 Shared compute 2 GB" and "Invocations About Invocations 500,000 included 2 Million included then $2 per 1 Million" (verbatim (curl))

**PX-18.** Supabase's own compute documentation says Nano is the free-plan size and Micro the paid-plan base size; "You cannot launch Nano instances on paid plans", and "In paid organizations, Nano Compute are billed at the same price as Micro Compute." Micro is about 10 a month (0.01344 an hour). Larger sizes on the same page: 2XL about 410, 4XL 960, 8XL 1,870, 12XL 2,800, 16XL 3,730 a month. Compute credits of 10 "cover one project running on the Micro/Nano Compute size" and "reset monthly and do not accumulate". So for an ADDITIONAL project in an existing Pro organization (such as Relii's), the honest figure is about 10 a month whether it is called Nano or Micro, because the organization's single 10 credit is already used by its first project. My inference, not a vendor sentence: the CLAUDE.md wording "nano" cannot be matched on a paid plan; the nearest is Micro at about 10.
Page: Compute and Disk (Supabase docs, `.md`); Manage Compute usage (Supabase docs, `.md`)
URL: https://supabase.com/docs/guides/platform/compute-and-disk.md ; https://supabase.com/docs/guides/platform/manage-your-usage/compute.md
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Note: In paid organizations, Nano Compute are billed at the same price as Micro Compute. ... You cannot launch Nano instances on paid plans, only Micro and above" and "| Micro | $0.01344 | \~$10 | Shared | 1 GB | 10 GB |" and "Paid plans include $10 in Compute Credits, which cover one project running on the Micro/Nano Compute size" (verbatim (curl))

**PX-19.** Supabase Cron (built on the `pg_cron` Postgres extension) can run jobs "anywhere from every second to once a year"; the guide recommends no more than 8 jobs at once and no job longer than 10 minutes. Edge Functions: 256 MB memory, wall clock 150 seconds free and 400 seconds on paid plans, 2 seconds of CPU time per request. No plan restriction on Cron is stated on the page read.
Page: Cron (Supabase docs, `.md`); Limits (Edge Functions, Supabase docs, `.md`)
URL: https://supabase.com/docs/guides/cron.md ; https://supabase.com/docs/guides/functions/limits.md
Accessed: 2026-10-13
Strength: A
Price: not a price finding
Quote: "can run anywhere from every second to once a year" ... "no more than 8 Jobs run concurrently. Each Job should run no more than 10 minutes." and "Free plan: 150s - Paid plans: 400s - Maximum CPU Time: 2s" (verbatim (curl))

**PX-20.** Vercel: Hobby 0 a month, Pro 20 a month with "$20 of included usage credit"; Pro includes one deploying seat, further paid seats are 20 a month each, and viewer seats are free and unlimited (Pro plan docs: "your team starts with 1 included paid seat that can deploy projects"). So one person on Pro pays 20 a month plus any usage above the 20 credit. Hobby is "restricted to non-commercial personal use only", and "Commercial usage is defined as any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production of the project". Whether trading one's own account counts is not answered by the text (it lists payment, advertising and paid hosting as examples); my reading is that "financial gain" is wide enough that Pro is the safe assumption.
Page: Vercel Pricing: Hobby, Pro, and Enterprise plans; Fair use guidelines (Vercel docs, `.md`); Vercel Hobby Plan (`.md`); Vercel Pro Plan (`.md`)
URL: https://vercel.com/pricing ; https://vercel.com/docs/limits/fair-use-guidelines.md ; https://vercel.com/docs/plans/hobby.md ; https://vercel.com/docs/plans/pro-plan.md
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Pro Popular $20 /mo. ... $20 of included usage credit" and "On the Pro plan, your team starts with 1 included paid seat that can deploy projects" and "Additional paid seats ... for $20/month each" and "Hobby teams are restricted to non-commercial personal use only." (verbatim (curl), elided)

**PX-21.** Vercel cron: Hobby "Once per day" with per-hour precision (plus or minus 59 minutes); Pro "Once per minute", per-minute precision, 100 cron jobs per project on every plan. Function duration: Hobby 300 seconds maximum; Pro 300 seconds default, 800 seconds maximum, 1,800 seconds in beta. Regions: functions run in Washington, D.C. (`iad1`) by default "for all new projects"; the default can be changed in project settings or `vercel.json` `"regions"`; Hobby gets a single region, Pro up to 5. So pinning a function to Oregon (`pdx1`, appears on the page as a region code) to sit beside a Supabase `us-west-2` database is a project setting, not a price.
Page: Usage & Pricing for Cron Jobs; Vercel Functions Limitations; Configuring regions for Vercel Functions (Vercel docs, `.md`)
URL: https://vercel.com/docs/cron-jobs/usage-and-pricing.md ; https://vercel.com/docs/functions/limitations.md ; https://vercel.com/docs/functions/configuring-functions/region.md
Accessed: 2026-10-13
Strength: A
Price: not a price finding
Quote: "| **Hobby** | 100 cron jobs | Once per day | Per-hour (±59 min) | | **Pro** | 100 cron jobs | Once per minute | Per-minute |" and "| Pro | 300s (5 minutes) | 800s | 1800s (30 minutes) Beta |" and "By default, Vercel Functions execute in Washington, D.C., USA (`iad1`) for all new projects" (verbatim (curl); the plus-minus sign is the page's own)

**PX-22.** Cloudflare Workers Paid plan: "a minimum charge of $5 USD per month for an account", covering Workers, Pages Functions, Workers KV, Hyperdrive and Durable Objects. Standard usage: 10 million requests a month included then 0.30 a million; 30 million CPU milliseconds included then 0.02 a million; up to 5 minutes of CPU per request (default 30 seconds). The free plan gives 100,000 requests a day and 10 milliseconds of CPU per run. Limits page: 5 Cron Triggers per account on Free, 250 on Paid; CPU time per Cron Trigger is 10 ms on Free and 30 seconds on Paid, rising to 15 minutes only for crons that run hourly or less often (the pricing page's "Max of 15 minutes of CPU time per Cron Trigger" is that ceiling). So a cron every 1 or 5 minutes gets 30 seconds of CPU per run.
Page: Pricing (Cloudflare Workers docs, `.md`); Limits (Cloudflare Workers docs, `.md`)
URL: https://developers.cloudflare.com/workers/platform/pricing/index.md ; https://developers.cloudflare.com/workers/platform/limits/index.md
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "The Workers Paid plan includes Workers, Pages Functions, Workers KV, Hyperdrive, and Durable Objects usage for a minimum charge of $5 USD per month for an account." and "| **Standard** | 10 million included per month +$0.30 per additional million |" (verbatim (curl))

**PX-23.** Cloudflare Durable Objects (a small always-alive program instance that can hold a connection open) on the Paid plan: 1 million requests a month included then 0.15 a million; duration 400,000 GB-seconds a month included then 12.50 a million GB-seconds; billed at 128 MB of memory per object "regardless of actual usage"; duration is billed "in wall-clock time as long as the Object is active". SQLite storage: 5 GB-month included. ESTIMATE (my arithmetic, not a vendor figure): one object holding one outbound price stream for a 6.5 hour session on 21 trading days = 0.125 GB x 23,400 seconds x 21 = about 61,000 GB-seconds a month, inside the 400,000 included, so about 0 above the 5 dollar minimum. Assumptions: one object, 21 sessions, only market hours. A measurement would be the dashboard's duration counter after one week. Whether an OUTBOUND WebSocket (to a data vendor) keeps an object billable for the whole time, and whether Cloudflare allows it to be held for 6.5 hours without restarts, was not read today.
Page: Pricing (Cloudflare Durable Objects docs, `.md`)
URL: https://developers.cloudflare.com/durable-objects/platform/pricing/index.md
Accessed: 2026-10-13
Strength: A
Price: published (the 0 overage is an ESTIMATE)
Quote: "| Requests | 100,000 / day | 1 million / month, + $0.15/million" ... "| Duration 3 | 13,000 GB-s / day | 400,000 GB-s / month, + $12.50/million GB-s" and "Duration billing charges for the 128 MB of memory your Durable Object is allocated, regardless of actual usage." (verbatim (curl))

**PX-24.** Fly.io: the smallest always-on machine, `shared-cpu-1x` with 256 MB, is 2.19 a month running continuously ("billed by the second while running"); 512 MB is 3.69, 1 GB 6.70. Fly.io's own worked example of "A Discord bot or background worker running 24/7" totals 2.21 with 1 GB of outbound data. The 2.19 figure is stated for Ashburn (`iad`) or Secaucus (`ewr`); the page shows other regions cost more (1 GB is 6.70 in `iad`, 7.73 in Frankfurt). A U.S. West price was not shown.
Page: Fly.io Resource Pricing (docs, `.md`)
URL: https://fly.io/docs/about/pricing.md (served from docs.fly.io)
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "The cheapest always-on app is a `shared-cpu-1x` Machine with 256MB of RAM in Ashburn (`iad`) or Secaucus (`ewr`). It costs \$2.19 per 30 days of continuous runtime, plus any outbound data transfer (\$0.02/GB in North America and Europe)." (verbatim (curl))

**PX-25.** DigitalOcean's smallest Basic (shared CPU) Droplet is 4.00 a month (0.00595 an hour): 512 MiB memory, 1 vCPU, 500 GiB transfer, 10 GiB SSD. Next is 6.00 for 1 GiB.
Page: Droplet Pricing | DigitalOcean
URL: https://www.digitalocean.com/pricing/droplets
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Memory vCPU Transfer SSD $/hr $/mo 512 MiB 1 vCPU 500 GiB 10 GiB $0.00595 $ 4.00 1 GiB 1 vCPU 1,000 GiB 25 GiB $0.00893 $ 6.00" (verbatim (curl))

**PX-26.** AWS Lightsail's smallest Linux bundle WITH a public IPv4 address is 5 a month (0.5 GB memory, 2 vCPUs, 20 GB SSD, 1 TB transfer); the IPv6-only version of the same size is 3.50. Caution (my inference, not on the page): a server with only an IPv6 address may be unable to reach a data vendor or broker whose interface has only an IPv4 address, so 5 is the safer figure.
Page: Amazon Lightsail Pricing
URL: https://aws.amazon.com/lightsail/pricing/
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Bundles with public IPv4 address Linux/Unix ... General Purpose $5 USD/mo 0.5 GB Memory 2 vCPUs*** 20 GB SSD Disk 1 TB Transfer* ... Bundles with IPv6 address only ... $3.50 USD/mo 512 MB Memory 2 vCPUs 20 GB SSD Disk 1 TB Transfer*" (verbatim (curl))

**PX-27.** Railway: Hobby is a "$5 minimum usage" a month that "Includes $5 of monthly usage credits"; above that, usage is charged. Free is a 30-day trial with 5 dollars of credit, then 1 dollar a month, up to 0.5 GB RAM per service. What a small always-on worker actually uses within the 5 dollars was not computed (Railway bills by measured resource use).
Page: Railway pricing
URL: https://railway.com/pricing
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Hobby $ 5 minimum usage For hobbyist developers building side projects Includes $5 of monthly usage credits After credits are used, you'll only be charged for extra resource usage" (verbatim (curl))

**PX-28.** Render: workspace plans Hobby 0 a month "+ compute" and Pro 25 a month "+ compute". Compute for services and background workers: Free "(limitations apply)" 0 with 512 MB, then 7 a month for 512 MB, the smallest paid instance. The page says free compute covers "web services, Render Key Value instances, and Render Postgres databases", which does not list background workers, so the smallest always-on worker is 7 (my reading of that sentence).
Page: Pricing | Render
URL: https://render.com/pricing
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Hobby For individuals building personal projects and prototypes. $ 0 /mo + compute" and "Free ( limitations apply ) $0/month 512 MB RAM free Less than 1 CPU $7/month 512 MB RAM" and "you can spin up web services , Render Key Value instances , and Render Postgres databases at no charge" (verbatim (curl))

**PX-29.** Hetzner Cloud: the plan pages are readable but the prices are drawn by scripts and came out blank ("from /month"); every plan was marked "currently unavailable" at the time of reading. The smallest plan with U.S. locations (Hillsboro `HIL1`, Ashburn `ASH1`) appears to be CPX11 (2 vCPU, 2 GB, 40 GB). Search summaries report price rises on April 1 and June 15, 2026 and conflicting euro figures; no two independent sources agree on a current U.S. price. Gated and unverified.
Page: Hetzner Cloud Regular Performance; Cost-Optimized (via fetch tool); web search summaries (agentdeals.dev, capitalandcompute.net, pcr.cloud-mercato.com, not opened)
URL: https://www.hetzner.com/cloud/regular-performance ; https://www.hetzner.com/cloud/cost-optimized
Accessed: 2026-10-13
Strength: A for the page (no price on it); C or D for the search hits
Price: gated and unverified (price drawn by scripts; plans shown as unavailable; secondary sources disagree)
Quote: "CPX11 is the smallest plan with Hillsboro (HIL1) and Ashburn (ASH1)" and the page "marks every plan as 'currently unavailable.'" (via fetch tool, paraphrase)

**PX-30.** GitHub Actions: "free for self-hosted runners and for public repositories"; for private repositories GitHub Free includes 2,000 minutes a month, GitHub Pro 3,000. Over that, Linux 2-core is 0.006 a minute (Linux 1-core "slim" 0.002). ESTIMATE (same arithmetic as run 2 DC-41, rates re-seen today): a job every 5 minutes through a 6.5 hour session is 78 a day, 1,638 a month; at 1 billed minute each that is inside 2,000 minutes (0 dollars); at 2 minutes each, 3,276 minutes, 1,276 over x 0.006 = about 7.66 a month.
Page: GitHub Actions billing (GitHub Docs)
URL: https://docs.github.com/en/billing/concepts/product-billing/github-actions
Accessed: 2026-10-13
Strength: A
Price: published (the monthly figures are an ESTIMATE)
Quote: "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners." and "GitHub Free 500 MB 2,000 10 GB" and "Linux 2-core (x64) actions_linux $0.006" (verbatim (curl))

### C. Alerts and monitoring

**PX-31.** Telegram's own bot pages say the bot platform "is free for both users and developers" and that bots "are able to message their users at no cost", with limits: in a single chat, avoid more than one message a second; about 30 messages a second for bulk sends unless "paid broadcasts" are switched on (0.1 Telegram Stars per message above the free amount). For one owner receiving alerts, the free limits are far above need (my inference).
Page: Telegram Bot Platform; Bots FAQ
URL: https://core.telegram.org/bots ; https://core.telegram.org/bots/faq
Accessed: 2026-10-13
Strength: A
Price: published (free)
Quote: "The Telegram Bot Platform hosts more than 10 million bots and is free for both users and developers." and "By default, bots are able to message their users at no cost" ... "In a single chat, avoid sending more than one message per second." (verbatim (curl))

**PX-32.** Pushover for an individual is "a $4.99 USD one-time purchase on each platform" (iPhone/iPad, Android, Desktop), after a 30-day free trial; "There are no subscription fees for individuals". Each user can send up to 10,000 messages a month free. Teams plan is 5 per user per month. So in a monthly table Pushover is 0 a month after a one-time 4.99 (per platform used).
Page: Pushover: Pricing
URL: https://pushover.net/pricing
Accessed: 2026-10-13
Strength: A
Price: published (ONE-TIME, not monthly)
Quote: "it's just a $4.99 USD one-time purchase on each platform ... There are no subscription fees for individuals using Pushover." and "Each user can send up to 10,000 messages per month for free ." (verbatim (curl))

**PX-33.** ntfy (an open-source push notification service): usable free on ntfy.sh "without sign-up", where the docs say the daily message limit is 250 and email forwarding 5 a day; anyone who guesses the topic name can read it ("the topic is essentially a password"). Paid plans, monthly price with annual price in brackets: Supporter 6 (5) with 2,500 daily messages and 3 reserved topics; Pro 12 (10) with 20,000; Business 25 (20) with 50,000. It can also be self-hosted.
Page: ntfy home page (Pricing section); Publishing, Limitations (ntfy docs)
URL: https://ntfy.sh/ ; https://docs.ntfy.sh/publish/
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Supporter $6 $5 / month ... 2,500 daily messages 3 reserved topics ... Pro $12 $10 / month ... 20k daily messages" and "On ntfy.sh, the daily message limit is 250." (verbatim (curl))

**PX-34.** Resend (email sending service): Free 0 a month with 3,000 emails a month, 100 a day, 3 domains; Pro 20 a month with 50,000 emails, no daily limit, extra emails 0.90 per 1,000; Scale 90. "we only provide monthly plans".
Page: Pricing · Resend
URL: https://resend.com/pricing
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Free Recommended $0 / mo 3,000 emails / mo 100 emails a day 3 domains ... Pro Recommended $20 / mo 50,000 emails / mo Extra emails: $0.90 / 1,000" (verbatim (curl))

**PX-35.** Twilio U.S. SMS ("Pricing current as of October 2026"): 0.0083 per outbound SMS segment from a 10-digit long code or toll-free number, plus per-message carrier fees (long code outbound: AT&T 0.0035, T-Mobile 0.0045, Verizon 0.005), plus a failed-message fee of 0.001. A leased long-code number is 1.15 a month, toll-free 2.15 a month. The page says "US A2P 10DLC are subject to registration onboarding fees" (A2P 10DLC = the U.S. registration that carriers require before software sends texts from a 10-digit number).
Page: SMS Pricing in United States | Twilio
URL: https://www.twilio.com/en-us/sms/pricing/us
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Long codes A 10-digit number for SMS and voice calls with localized identity. $0.0083 $0.0083 $0.022 $0.0165" and "Long code Carrier SMS Outbound* ... AT&T $0.0035 ... T-Mobile $0.0045 ... Verizon $0.005" and "Long codes ... $1.15 $0.5" (Twilio leased, bring your own, cost per month) (verbatim (curl))

**PX-36.** Twilio's A2P 10DLC registration for a Sole Proprietor (an individual without a business tax ID): brand registration 4 one-time, campaign vetting 15 one-time, campaign fee 2 a month; limited to one campaign and one number. A web search summary said a newer Twilio help article gives 4.50 for the brand fee; that article (support.twilio.com) refused both `curl` and the fetch tool (HTTP 403). ESTIMATE of a minimal monthly SMS alert line: 1.15 number + 2 campaign + about 0.013 a text; at 100 texts a month about 4.45 a month, plus 19 to 19.50 one-time. Toll-free verification fees were not read.
Page: A2P 10DLC registration overview (Twilio, pages.twilio.com, via fetch tool)
URL: https://pages.twilio.com/10DLC-HelpArticles-WW (support article https://support.twilio.com/hc/en-us/articles/1260803965530 returned 403)
Accessed: 2026-10-13
Strength: A (Twilio's own page)
Price: published via fetch tool (4 dollar brand fee contradicted by a search summary of another Twilio page saying 4.50, not confirmed)
Quote: "Brand registration: $4 one-time ... Campaign vetting: $15 one-time per campaign ... Campaign fee: $2 per campaign per month" (via fetch tool)

**PX-37.** Healthchecks.io (a "dead man's switch" service: the job pings it on schedule and it alerts when a ping is late): Hobbyist 0 a month for 20 checks with 100 log entries each; Supporter 5 (same limits); Business 20 for 100 checks plus 50 SMS or WhatsApp credits and 20 phone-call credits; Business Plus 80. Annual billing saves 20 percent. Its home page lists notification routes including Telegram, ntfy, Pushover, Signal, SMS, WhatsApp and phone call. The pricing page does not tie Telegram, ntfy or Pushover to a paid plan (SMS, WhatsApp and phone calls use credits that come with Business plans).
Page: Plans and Pricing - Healthchecks.io; Healthchecks.io home page
URL: https://healthchecks.io/pricing/ ; https://healthchecks.io/
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Hobbyist $0 / month Monitor 20 jobs 100 log entries per job ... Supporter $5 / month ... Business $20 / month Monitor 100 jobs 1000 log entries per job 50 SMS & WhatsApp credits 20 phone call credits" (verbatim (curl))

**PX-38.** UptimeRobot: Free 0 a month, "Good for hobby and non-profit projects", 50 monitors at a 5-minute interval, "Only 5 integrations". Heartbeat monitoring ("You send requests to UptimeRobot and we check if they arrive on time") appears NOT to be in Free: in the page source, the Free column of the "Heartbeat monitoring" row carries the same cross-shaped icon used for other excluded features, and the paid columns carry a tick. Solo, the cheapest plan with it, is 13 a month billed monthly or 12 a month billed annually ("Starts at $144 /y") for 10 monitors, with 60-second intervals. The "hobby and non-profit" wording is a description, not a stated ban on other use; not resolved.
Page: Plans & Pricing | UptimeRobot
URL: https://uptimerobot.com/pricing/
Accessed: 2026-10-13
Strength: A
Price: published (Free-column heartbeat status read from icon shapes in the page source; a browser check would confirm)
Quote: "Solo Monitor tier 10 monitors 50 monitors $ 13 $ 12 /month Good for freelancers and small sites." and "Free $ 0 /month Good for hobby and non-profit projects. No credit card required! Register now 50 monitors 5 min. monitoring" (verbatim (curl))

**PX-39.** Better Stack: "Free for personal projects $0 per month" including "10 monitors & heartbeats, 1 status page Slack & e-mail alerts". Heartbeats (cron monitoring) are therefore in the free tier, but free alerts go by Slack and email only on this page; phone and SMS alerts come with the paid "Responder" seat ("Starts at just $29"). "Free for personal projects" may restrict other use; whether one's own trading is "personal" is not addressed.
Page: Pricing | Better Stack
URL: https://betterstack.com/pricing
Accessed: 2026-10-13
Strength: A
Price: published
Quote: "Free for personal projects $0 per month Start for free 10 monitors & heartbeats, 1 status page Slack & e-mail alerts" (verbatim (curl))

### D. Research extras

**PX-40.** Quiver Quantitative's API page says "starting from just $30/month". Its pricing page (`/pricing/`) redirected to a sign-up page (`/register/?next=pricing`), so the higher plan (75 a month in run 1) was not seen today.
Page: Quiver Quantitative API
URL: https://api.quiverquant.com/ (pricing https://www.quiverquant.com/pricing/ redirected to https://www.quiverquant.com/register/?next=pricing)
Accessed: 2026-10-13
Strength: A
Price: published for the 30 starting price; the higher tier is gated and unverified (pricing page sits behind a sign-up redirect)
Quote: "Tap into its power with the Quiver API, starting from just $30/month." (verbatim (curl))

**PX-41.** Firecrawl (web page reading for agents): Free 0 with 1,000 credits a month ("500 searches or 1,000 pages scraped", 2 concurrent requests); Hobby 16 a month billed yearly for 5,000 credits ("Save $38"); Standard 83 a month billed yearly for 100,000 credits; Growth 333. "Prices shown are per month, billed annually." The monthly-billed Hobby price is not in the page's static text; 19 is consistent with "Save $38" (19 x 12 = 228, against about 190 a year), but that is my arithmetic, not a quote.
Page: Pricing | Firecrawl
URL: https://www.firecrawl.dev/pricing
Accessed: 2026-10-13
Strength: A
Price: published (annual-billing figures); monthly-billing Hobby price inferred, not seen
Quote: "Prices shown are per month, billed annually." and "Hobby Great for side projects and small tools. Fast, simple, no overkill. 5,000 credits / month $ 16 /month Billed yearly Save $38" (verbatim (curl))

## Dead ends

1. Databento: `curl` of the pricing page, the catalog, `llms.txt` and `/docs/llms.txt` all returned an empty challenge page; the EQUS Mini docs page gave a title only through both `curl` (`.md`) and the fetch tool. Used the fetch tool on the pricing and catalog pages instead.
2. Finazon: `/dataset/sip_non_pro` answers with HTTP 301 to `us_stocks_essential`; `/dataset/sip_non_pro/config` is 404; `/llms.txt` is 404; the datasets catalogue is drawn by scripts. A web search found no third-party confirmation of the 4 dollar plan.
3. Finnhub: the rendered pricing page is script-only (fetch tool saw a headline only). Worked around by reading the page's own embedded price data and its script bundle with `curl`.
4. Hetzner Cloud: prices are drawn by scripts; the fetch tool saw "from /month" with no number; search hits disagree after 2026 price changes. No price recorded.
5. Twilio support article on 10DLC fees (support.twilio.com): HTTP 403 to both `curl` and the fetch tool. Used Twilio's pages.twilio.com overview instead.
6. Quiver Quantitative pricing page: redirected to a sign-up page. Not followed (no account creation).
7. Massive Individuals Terms of Service: contained no "display use" wording; the clause was found in the separate Market Data Terms.
8. Financial Modeling Prep: first guessed dataset address (`/datasets/real-time-market-data`) was 404; the right one (`/datasets/market-data-real-time`) names no feed.
9. Alpha Vantage: the entitlement process is behind a terminal sign-up; not attempted.

## Method deviations

- Finnhub's prices (PX-14) and UptimeRobot's Free-plan heartbeat status (PX-38) were read from the vendor page's own source code (embedded data and icon shapes), not from rendered text. Both are the vendor's own page, so they are labelled published, but a browser check is listed below.
- The fetch tool was used for Databento, Hetzner and Twilio's 10DLC overview; those quotes may be lightly paraphrased and are marked.
- Appending: the brief asked for an append after every two or three findings. Several appends added five to nine findings at once (PX-10 to PX-15, PX-17 to PX-21, PX-22 to PX-30, PX-31 to PX-39). Nothing was lost, but the trail was coarser than asked.
- Some `Quote:` lines hold several separate passages from the same page, each 40 words or fewer, joined with "and".
- Every request used a generic browser User-Agent string. No name, email address or other personal information was sent to any site.

## Not verified

1. Alpaca's market data agreement for individuals: whether a personal trading program counts as non-display use. Not attempted this run; run 2 not-verified item 3 still stands.
2. Alpaca's symbols-per-request cap on multi-symbol snapshots (PX-04). The reference states none. A single test request would settle it.
3. Alpha Vantage: what the real-time "entitlement" step costs or requires, and which feed it delivers (PX-11, PX-12).
4. Finazon: whether a non-professional SIP plan can actually be bought, and its limits (PX-09).
5. Databento: which venues and what share of volume the Mini dataset covers; whether any consolidated dataset exists for an individual (PX-07, PX-08).
6. Finnhub and Financial Modeling Prep: whether their U.S. data is real time and consolidated, and from which feed (PX-14, PX-15).
7. Massive: whether a personal program reading Advanced data is "non-display use" under its Market Data Terms (PX-06). A written answer from Massive would settle it.
8. Hetzner Cloud: any current U.S. price (PX-29).
9. Twilio: brand registration fee, 4 or 4.50; toll-free verification fees (PX-36).
10. UptimeRobot Free: heartbeat exclusion read from icons only (PX-38).
11. Firecrawl Hobby billed monthly; Quiver Quantitative's higher tier (PX-40, PX-41).
12. Cloudflare Durable Objects: whether an outbound stream keeps the object billable all session and whether a 6.5-hour connection is allowed without restarts (PX-23).
13. Vercel Hobby, Better Stack Free ("personal projects") and UptimeRobot Free ("hobby"): whether trading one's own account fits the stated use (PX-20, PX-38, PX-39).
14. Railway: what an always-on small worker actually uses within the 5 dollar minimum (PX-27).
15. Fly.io: price in a U.S. West region (PX-24 states Ashburn and Secaucus only).
16. Interactive Brokers: the 10.00 snapshot bundle price is from the page's waiver example table; the main subscription table row for it carried footnote numbers but no readable price in the extracted text (PX-16).

## Needs a browser

1. https://finnhub.io/pricing : confirm the rendered prices and whether U.S. data is real time and from which feed.
2. https://www.hetzner.com/cloud/regular-performance : CPX11 price in Ashburn or Hillsboro.
3. https://databento.com/docs/venues-and-datasets/equs-mini and https://databento.com/pricing : Mini venues, licensing rows by plan.
4. https://finazon.io/datasets (filtered to publisher "SIP") : whether a SIP non-professional dataset is listed and priced.
5. https://www.interactivebrokers.com/en/pricing/market-data-pricing.php : the main table row for the US Securities Snapshot and Futures Value Bundle.
6. https://uptimerobot.com/pricing/ : confirm the Free plan's heartbeat cell.
7. https://site.financialmodelingprep.com/pricing-plans : the "Real-time Data" row's icons per plan.
8. https://www.firecrawl.dev/pricing : the Monthly toggle for Hobby.
9. https://support.twilio.com/hc/en-us/articles/1260803965530 : current 10DLC fees (returned 403 to automated reading).

Items behind a sign-up (Alpha Vantage entitlement, Quiver pricing) are gated, not browser items: reading them would need an account, which this run may not create.

## Contradictions

1. Databento's general pricing page (Plus 1,750, Unlimited 4,500) against its U.S. equities catalog (1,500 and 4,000). Standard is 199 on both. Unchanged since run 2.
2. Alpaca's documentation (Algo Trader Plus 10,000 historical calls a minute) against its marketing page ("Unlimited API calls"; header "up to 10,000 API calls/min"). The documentation's number is the more specific and is used.
3. Finazon's featured page (SIP for individuals "from $4") against the dataset address redirecting to an IEX-derived product at 19. Unchanged since run 2.
4. Alpha Vantage: run 2 (DC-59) recorded its data as "Nasdaq-licensed"; today's documentation says "consolidated NBBO ... across exchanges, dark pools, and FINRA TRFs". Not necessarily contradictory (a licence holder and a feed are different things), but the feed source is still unnamed.
5. Massive's "display use only" clause: run 1 (MD-15) attributed it to the individual-plan terms, Section 2. Today it is in the separate Market Data Terms (last updated August 28, 2025), and the Individuals Terms contain no such wording.
6. Twilio's sole-proprietor brand fee: 4 on pages.twilio.com (via fetch tool) against 4.50 in a search summary of a support.twilio.com article that could not be opened.
7. Supabase and the project's own wording: CLAUDE.md speaks of a "nano" tier, but Supabase's docs say Nano cannot be launched on paid plans and is billed at the Micro price in paid organizations.
8. RESOLVED: Twelve Data's "From $29/$99/$329" against plan cards of 79/229/999 (run 2 contradiction 13). The page source shows credit tiers per plan; Grow runs 29, 49 and 79, and "From" is the lowest tier. Only Grow's tier list was read; Pro's "From $99" and Ultra's "From $329" are presumed to be their lowest tiers on the same pattern, not checked.

End of file marker
