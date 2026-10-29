# Run 5 deliverable: the messaging app, every source read first hand

Written 2026-10-28 (America/Chicago). Every source was opened and read that day, by the main session or a research helper. None is cited from a search result summary.

**What this document is.**

- Research input for a human decision about which phone app carries a future stack's alerts, messages and commands. It is never an instruction to act, to open an account or to build anything.
- It recommends an app, and Michael decides.
- It repeats run 4's question with Signal added, encryption scored as a preference, and every source reopened. Run 4 stays as it was, for the record.
- The stack it serves is the corrected run 3 pick, option C, the always-on worker. The app must also serve options B, D and F, because the stack is not decided.

**How to read it.**

- Every factual claim carries a numbered footnote. Section 8 lists each source with its title, address, access date, strength label and, for prices, a price label. The labels mean the same as in runs 1 to 3 (run 3 deliverable, section 5).
- Sentences marked "my judgment", "my inference" or "my reading" are reasoning from cited facts, not sourced facts.
- Quotes were read through tools that strip page formatting. Reopen the address before a decision hangs on exact wording.
- Acronyms used here:
  - AI: artificial intelligence. API (application programming interface): the way a program talks to a service.
  - DM: direct message. FAQ: a page of frequent questions. ID: identifier.
  - MB: megabytes. MFA: multi-factor sign-in, a second step after the password. PIN: personal number.
  - SMS: text message. CC: Claude Code. LLC: a company form.

## 1. Summary

**Key point: the strongest pick is still Discord, on its free plan. It scores 4.50 of 5 against Telegram's 4.18, and the two facts run 4 could not confirm are now settled from Discord's own pages.**

- **The two open facts, settled.**
  - History: Discord keeps your information "for as long as you have an active Discord account", and you can delete your own messages.[^1] No page names a time or plan limit on messages. The one limit is an account inactive for two years, which "we may delete".[^1]
  - Bots reading Michael's messages: a bot with "fewer than 10,000 users" switches on Message Content in the developer site, with no review.[^2][^3] Even without it, a bot still sees "DMs with the app" and messages in which it "is mentioned".[^3]
- **What Discord does for each job.**
  - Heartbeat: Healthchecks.io's "Connect Discord" posts to a channel through a webhook.[^4]
  - Messages: the stack posts through a webhook, which needs no "bot user or authentication".[^5]
  - Commands: Michael types "stop" or "status" in a private command channel. The stack reads new messages, up to 100 at a time, each time it runs.[^6]
- **Why Discord over Telegram (second, 4.18).**
  - Both are free, and neither names a history limit.[^7][^8]
  - Telegram keeps a bot's unread messages for 24 hours at most.[^9] A stop sent while a stack is not checking can vanish.
  - A Discord message stays in the channel until deleted (DC-04, my reading).
  - "Telegram accounts can only be connected to a mobile number".[^10] Discord signs up with any email Michael keeps access to, so a sib-tech address works.[^11]
- **What Discord costs Michael in comfort.**
  - Text is not end-to-end encrypted, with "no current plans" to change that.[^12] Discord scans content for harmful activity.[^13]
  - Its status feed lists 2026 incidents with message sending.[^14] Healthchecks.io's email alert is the second route.[^15]
  - Users have reported that Discord holds phone alerts while its desktop app is open. No source was read for this in run 5, so it is untested. A five-minute test settles it (section 5).
- **Telegram's Secret Chats, checked.** Michael's note is right: Secret Chats use "client-client encryption" and normal cloud chats do not.[^10] Secret Chats are one-to-one and tied to one device.[^16] No page says whether a bot can join one; the Bot API has no secret chat type or method (my reading).[^9]
- **Signal is fifth (2.97).** It is the most private: always end-to-end encrypted, and Signal "cannot decrypt" messages.[^17][^18] But it has no official bot interface, its terms bar "auto-messaging",[^18] each bot needs its own phone number,[^19] and the community bot tool may stop working if not updated within three months.[^19]
- **The others.** Matrix on Element 3.51 (encrypted, but no two-factor sign-in found on matrix.org).[^20] Google Chat 3.38 (added as a sixth candidate: strong security, but a paid Workspace seat and a Google Cloud project with billing).[^21][^22] Slack free 2.88 (90 days visible, deleted after a year).[^23]
- **What would change the pick.** Discord capping history, or gating message reading for small bots with no direct message exception, makes Telegram the pick (section 6, items 2 and 3). So does a confirmed desktop holdback together with Discord message reading proving unworkable (item 5).
- **The backstop is unchanged from run 3.** The broker's own app can cancel orders and close positions, and at Alpaca the "suspend_trade" switch blocks new orders. Neither depends on any messaging app or on Claude.

## 2. Criteria and weights

**Key point: nine criteria, fixed before any total was computed. Free tier limits carry 28 of 100, almost double any other. Encryption is a preference at 5.**

| Criterion | Weight | Why this weight |
| :-- | :-- | :-- |
| Free tier limits (history, bots, rate limits, paid plans) | 28 | The brief: more than any other single criterion. Michael values a free app that keeps full history |
| Two-way commands, by a route the vendor supports | 15 | Job 3. The stop must work for a scheduled stack (options B and F) and an always-on worker (options C and D), and must not depend on a tool the vendor forbids |
| Command security | 14 | A command can stop an agent that trades real and borrowed money. Who can send one matters |
| Push alerts reach the phone | 12 | Jobs 1 and 2 are worthless if the phone stays silent |
| Healthchecks.io integration | 9 | Job 1. Every candidate has one, so it separates little |
| Separation of stacks | 7 | Two stacks must never share a command path |
| Account identity (custom domain email, phone) | 6 | Michael plans accounts on a sib-tech email. A convenience, not a safety issue (my judgment) |
| Encryption (end to end, on the free plan, for bot traffic) | 5 | The brief: a preference, not a requirement. Messages carry orders and fills, never account numbers or keys (design rule, section 5) |
| Vendor privacy (reads, scans or trains on content) | 4 | Related to encryption, scored apart so neither hides the other |

- **One distinction applies to every app.** End-to-end encryption hides messages from the app's maker. It does not hide them from the services at either end: Healthchecks.io and the stack's own server see plain text on every app (my reading).

**Scores.** Each is 1 (poor) to 5 (strong). The basis for each is in section 4, and the contested ones are trajectory decision D4.

| Criterion (weight) | Discord | Telegram | Matrix | Google Chat | Signal | Slack |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Free tier limits (28) | 5 | 5 | 4 | 2 | 4 | 1 |
| Two-way commands (15) | 5 | 4 | 3 | 3 | 1 | 3 |
| Command security (14) | 5 | 4 | 2 | 5 | 3 | 4 |
| Push alerts (12) | 4 | 4 | 3 | 3 | 3 | 3 |
| Healthchecks.io (9) | 5 | 5 | 4 | 5 | 3 | 5 |
| Separation (7) | 5 | 5 | 4 | 5 | 2 | 5 |
| Account identity (6) | 4 | 2 | 5 | 5 | 1 | 5 |
| Encryption (5) | 1 | 2 | 4 | 1 | 5 | 1 |
| Vendor privacy (4) | 2 | 3 | 4 | 4 | 5 | 2 |
| **Weighted total** | **4.50** | **4.18** | **3.51** | **3.38** | **2.97** | **2.88** |

**Method.** Each score times its weight, summed, divided by 100, rounded half up to two places, by script. The script refuses any weighting where free tier limits do not outweigh every other criterion. Tie rule, as in runs 3 and 4: first, or within 0.10 of first.

- **The one score raised in Discord's favour.** Discord's commands rose from run 4's 4 to 5, because Message Content is now settled from Discord's own pages (DC-01, DC-02). Left at 4, Discord is 4.35, still first.
- **Telegram's encryption is 2, Discord's 1.** Neither encrypts bot traffic. Telegram scores one point more because Michael's own human chats can use Secret Chats. At 1, Telegram is 4.13, and nothing changes.

**Sensitivity to the weights.** Discord is first or within 0.10 of first in all 9.

| Weighting | Discord | Telegram | Matrix | Google Chat | Signal | Slack | First |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Base weights | 4.50 | 4.18 | 3.51 | 3.38 | 2.97 | 2.88 | Discord |
| Near equal (free 20, the other eight share 80) | 4.10 | 3.90 | 3.70 | 3.50 | 3.10 | 3.00 | Discord |
| Free tier heavier (40) | 4.58 | 4.32 | 3.59 | 3.15 | 3.14 | 2.57 | Discord |
| Security heavier (24) | 4.59 | 4.20 | 3.35 | 3.51 | 3.02 | 2.93 | Discord |
| Commands heavier (24) | 4.58 | 4.20 | 3.47 | 3.28 | 2.79 | 2.81 | Discord |
| Push heavier (22) | 4.46 | 4.20 | 3.47 | 3.27 | 3.02 | 2.81 | Discord |
| Identity heavier (20) | 4.45 | 3.90 | 3.77 | 3.55 | 2.73 | 3.09 | Discord |
| Encryption heavier (20) | 3.97 | 3.88 | 3.62 | 2.91 | 3.36 | 2.46 | Tie, Discord and Telegram |
| Encryption and privacy heavier (15 each) | 3.83 | 3.86 | 3.67 | 3.05 | 3.55 | 2.38 | Tie, Telegram and Discord |

- In each heavier weighting, free tier limits stay at 28 (40 in its own row), and the other criteria are scaled down in proportion.
- **Read the last row with care.** With encryption and privacy at 15 each, Telegram is numerically ahead (3.86 against 3.83). Discord counts as tied first only under the 0.10 rule.

## 3. Comparison table

**Key point: every candidate against every question in the brief. "Not found" means no page read said either way.**

| Question | Discord | Telegram | Matrix (Element app) | Google Chat (Workspace) | Signal | Slack (free) |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Push alerts reach the phone in the background? | Yes, per server notification level[^24]. None while the phone app is open in focus[^25]. Desktop holdback: untested | Yes; no documented delay found | Yes, through Element's push gateway and Apple or Google[^26] | Yes, but "on the devices you used most recently"[^27] | Yes; Signal advises excluding it from battery optimization, and a message already viewed on linked desktop may not notify[^28] | By default only 1 minute after the desktop locks or 10 minutes idle[^29] |
| Limits on bot messages | 50 requests a second per bot[^30] | 1 a second per chat, 20 a minute per group[^31] | Rate limiting exists; no number published[^32] | 1 write a second per space[^33] | Captcha or rate limit on heavy use[^34] | High-volume limit, no number[^23] |
| Two-way commands: how? | Bot reads the command channel, up to 100 messages a call[^6]; Message Content by a toggle under 10,000 users[^2]; direct messages and mentions exempt[^3] | Bot fetches updates or receives them at a web address; unread kept 24 hours at most[^9] | Bot account syncs from a saved position; gaps filled by a second call[^32]. Encrypted rooms need a verified bot device (planned change)[^35] | A Chat app over Pub/Sub, or admin-approved reading of a space[^22][^36]. Needs a Google Cloud project with billing[^22] | No official interface found[^37]. Community tool signal-cli receives as a daemon[^19]; terms bar "auto-messaging"[^18] | Socket Mode[^38], slash commands within 3 seconds[^39], or reading history[^40] |
| Works for a once-a-minute scheduled stack? | Yes, by reading the channel[^6] | Yes, if it checks within 24 hours[^9] | Yes, by syncing[^32] | Yes, by Pub/Sub pull or reading the space[^22][^36] | Poorly: signal-cli expects messages to be received regularly[^19] | Yes, 50 or more reads a minute for an internal app[^40][^41] |
| Free tier: message history | Kept for the life of the account; no age or plan limit named; account may be deleted after two years idle[^1] | Cloud chats stored on Telegram's servers[^42]; "unlimited cloud storage" stays free[^8]; account deleted after 18 months idle by default[^42] | No limit found; media limits only[^43][^44] | Not a free plan. With history on, kept unless Vault rules delete it; off, deleted after 24 hours[^45] | On the device only[^18]. Free Secure Backups keep "all of your text messages"[^46] | 90 days visible; over a year deleted[^23] |
| Free tier: bots or integrations | Bot applications per account: not found. 100 servers per account, 15 webhooks per channel[^47] | Bots per account: not found on any Telegram page[^48] | Not found | Up to five named users or groups per Chat app[^49] | Each bot needs its own number, or links into Michael's own account (one of 5 linked devices)[^19][^50] | 10 apps, custom bots included[^23] |
| What would push him to paid | Nothing; basic use is free[^7]. Nitro 2.99 or 9.99 dollars a month for extras[^51] | Nothing; Premium adds extras[^8] | Nothing yet; Premium price not set[^43] | A paid seat, which Michael plans for the sib-tech email anyway: Starter 7 dollars a user a month on a year's commitment, 8.40 monthly[^21] | Nothing for text. 1.99 dollars a month backs up media over 45 days[^46] | Full history: Pro 8.75 dollars a user a month, 7.25 annually[^52] |
| Healthchecks.io sends to it natively? (Hobbyist plan 0 dollars, no restriction by integration type; only text, WhatsApp and phone sends are quota-limited[^53][^15]) | Yes, a channel webhook[^4] | Yes: user, group or channel[^54] | Yes, plain unencrypted posts; "Do not invite to rooms with sensitive content"[^55] | Yes, a space webhook[^56] | Yes, to a phone number or username, 6 a minute, no groups found[^57][^58] | Yes, "Add to Slack"[^59] |
| Command security | Private server[^60]; passkey or authenticator sign-in[^61]; commands limited to named users[^62]; program checks the author ID | Program must check the sender[^48]; bots have a public link (anyone can find it, my inference); SMS code plus password, or passkey[^10] | Invite-only rooms[^32]; two-factor sign-in on matrix.org not found live[^20] | Admin-enforced 2-Step Verification[^63]; app visible to named users only[^49] | Registration lock PIN[^64]; program checks the sender | Program checks the user; two-factor by text or app[^65] |
| Separation of two stacks | One private server and one bot per stack; guild commands stay in their server[^62] | One bot per stack | One room and bot account per stack (my inference) | One space, webhook and Chat app per stack; a webhook "only works in the Chat space in which it's registered"[^66] | Separate number per stack bot[^67] | One workspace per stack (my judgment) |
| Custom domain email at signup? | Yes, any email he keeps access to[^11] | No, mobile number only[^10] | Yes, a verified email is required[^68] | Yes, it is the sib-tech Workspace account[^21] | No, phone number[^18] (Android beta: no number, 2.99 dollars once[^69]) | Yes, company domain email suggested[^70] |
| Phone number required? | Not at signup; can be demanded later; no internet phone numbers[^71] | Yes[^10] | No, optional[^44] | Not found | Yes, one able to receive SMS or a call[^72] | No phone step[^70] |
| Separate accounts per stack? | Five in the desktop switcher[^73]; not needed, servers separate stacks | Several in one app, each its own number[^10] | Not checked in run 5 | One Workspace, several spaces | Each needs its own number[^67] | One workspace each |
| End-to-end encrypted? | No; voice and video only[^12] | Secret Chats only, one device, one-to-one[^10][^16]; bot chats are cloud chats (my inference) | Yes by default in new rooms[^74]; Healthchecks.io posts are not[^55] | No; client-side encryption only on higher editions[^75] | Always[^17]; signal-cli uses the same protocol (my reading) | No; encrypted at rest and in transit[^76] |
| Vendor reads or trains on content? | Proactive scanning; models built from reported and public content[^13] | Automated spam scanning of cloud chats; no AI training statement[^42] | No profiling; no AI statement[^44] | No generative AI training outside your domain without permission[^77] | Cannot access content; no AI statement[^18] | No generative AI training; other models use messages unless opted out by email[^78] |

## 4. The six candidates

### 4.1 Discord (the pick)

- **How it carries the three jobs.**
  - Heartbeat: Healthchecks.io's "Connect Discord" posts to a channel through a webhook.[^4]
  - Messages: the stack posts through a webhook, "a low-effort way to post messages to channels".[^5]
  - Commands: the stack's bot reads new messages in the command channel since the last one handled, up to 100 a call.[^6] Message Content is a toggle for a bot with "fewer than 10,000 users".[^2] Direct messages to the bot and messages that mention it are readable even without it.[^3]
- **Push.** Each server can be set to notify on every message, and muting a server also silences its phone alerts.[^24] No alert shows while the phone app is open in focus.[^25]
- **How two stacks stay separate.** One private server per stack, each with its own bot, channels and Healthchecks.io link. "Guild commands are specific to the guild you specify".[^62]
- **How commands are secured.**
  - A private server limits access "to only the members you specify".[^60]
  - Sign-in by passkey, authenticator app or text. Support "is not able to remove MFA", so backup codes matter.[^61]
  - The program acts only on Michael's numeric author ID in that stack's command channel (design rule). Slash commands can also be limited to named users.[^62]
- **Free tier limits.**
  - "We won't charge you a fee to use the basic functionality".[^7] History lasts as long as the account.[^1]
  - Limits that matter: 50 requests a second per bot, 100 servers per account.[^30][^47] Nitro (2.99 or 9.99 dollars a month) adds uploads and profile extras.[^51]
- **Account identity.** Any email he can "maintain access to".[^11] A phone check can be demanded, for example after posting "faster than a human can manage"; the number cannot be an internet phone number or used by another account.[^71] The stack posts as a bot, as the rules require: "Do not use self-bots or user-bots."[^79]
- **Privacy.** Encrypted in transit and at rest, not end to end.[^13][^12]
- **Pros.**
  - Free, with history tied to the account's life.
  - A stop waits in the channel until the stack reads it.
  - Email signup fits the sib-tech plan, and security is the strongest of the free apps.
- **Cons.**
  - Not end-to-end encrypted; order details are readable on Discord's servers.
  - 2026 incidents affected message sending.[^14]
  - An account idle for two years may be deleted.[^1] Michael signs in now and then.
  - The number of bot applications one account may own is not published. Two stacks need two.
- **Failure mode: a silent phone on a desk.** Users have reported that Discord holds phone alerts while the computer app is open (untested here). A missed heartbeat could sit unseen. The guard: the five-minute test, Healthchecks.io's email as a second route, and closing Discord on the computer during market hours if the test fails.

### 4.2 Telegram (second)

- **How it carries the three jobs.** Healthchecks.io's bot posts to a user, group or channel.[^54] The stack posts with its own bot. Commands start with "/" and the backend must check "that the user was authorized".[^48]
- **How commands arrive.** Fetching or a web address; updates "will not be kept longer than 24 hours".[^9]
- **How two stacks stay separate.** One bot per stack, each with its own key.
- **How commands are secured.** The program checks Message.from.[^9] Every bot has a public link,[^48] so strangers can reach it and the program must ignore them (my inference). Sign-in is an SMS code plus password, or a passkey.[^10]
- **Free tier limits.** Bots are "free for both users and developers".[^80] "unlimited cloud storage" stays free.[^8] Limits: 1 message a second per chat.[^31]
- **Account identity.** Mobile number only.[^10] Some users may get login codes by email, but the account still needs a number.[^42]
- **Secret Chats.** End to end, one-to-one, one device, lost on logout.[^10][^16] No page says whether a bot can join; the Bot API's chat types are "private", "group", "supergroup" or "channel" (my reading: no secret chat).[^9]
- **Privacy.** Cloud chats are stored on Telegram's servers and scanned for spam.[^42] Its FAQ says AI features never send data to third parties,[^10] while its privacy policy says translation "may rely on Google LLC or Microsoft Corporation".[^42] The two pages disagree.
- **Pros.** Free, no history limit named, the simplest command route.
- **Cons.** Phone number only; a stop can expire after 24 hours; bot traffic not end-to-end encrypted.
- **Failure mode: a stop that never arrives.** Michael sends /stop on a Friday night to a stack that checks only in market hours. Telegram discards it after 24 hours, and the stack trades on Monday.[^9] The guard is checking every few minutes, every day, and replying "stopped".

### 4.3 Matrix on the Element app (third)

- **How it carries the three jobs.** Healthchecks.io's bot joins a room and posts in plain text.[^55] A second Matrix account, run by the stack, posts and syncs from its saved position.[^32]
- **How two stacks stay separate.** One invite-only room and one bot account per stack.[^32]
- **How commands are secured.** The program checks the sender's full ID.[^32] Two-factor sign-in on matrix.org was listed as future work in 2025, and no later post says it is live.[^20]
- **Free tier limits.** A free plan with media limits (10 MB a file); message text does not count.[^43] Premium has no price yet.[^43]
- **Account identity.** A verified email is required; a phone is optional.[^68][^44]
- **Privacy.** New rooms encrypted by default (an older page).[^74] No profiling.[^44]
- **The command score of 3 is an inference.** Element planned to stop sending keys to unverified devices in April 2026 (not confirmed shipped).[^35] A bot in an encrypted room would need a verified device. An unencrypted command room avoids that, but gives up the encryption Matrix scores for.
- **Pros.** Strong privacy, email identity, no phone.
- **Cons.** No two-factor sign-in found; the classic app ends on December 31, 2026;[^81] no service level promise.[^68]
- **Failure mode: one server, one outage.** matrix.org was down about 24 hours on September 2 and 3, 2025.[^82] Alerts and commands stop together.

### 4.4 Google Chat inside Google Workspace (fourth, the added candidate)

- **Why it was added.** Michael plans a sib-tech Google Workspace anyway, and Healthchecks.io lists Google Chat.[^83] It is not a free app, so it is scored on that.
- **How it carries the three jobs.** Healthchecks.io and the stack post through space webhooks.[^56][^66] Webhooks "can't respond to or receive messages",[^66] so commands need a Chat app: over Pub/Sub, which works through a firewall,[^22] or admin-approved reading of a space.[^36]
- **How two stacks stay separate.** One space, webhook and Chat app per stack.[^66]
- **How commands are secured.** An admin can enforce 2-Step Verification,[^63] and a Chat app can be visible to "up to five individuals".[^49]
- **Free tier limits.** Starter is 7 dollars a user a month on a year's commitment, or 8.40 monthly.[^21] Pub/Sub's first 10 GiB a month is free,[^84] but its quickstart requires "A Google Cloud project with billing enabled."[^22] History must stay on: "If you turn history Off, messages are deleted after 24 hours."[^45]
- **Push.** Alerts go to "the devices you used most recently".[^27]
- **Privacy.** No end-to-end encryption on Starter.[^75] No generative AI training outside the domain without permission.[^77]
- **Pros.** Strongest security and identity fit; history kept while history is on.
- **Cons.** Paid; the heaviest setup (a Cloud project, a billing account, a Chat app per stack).
- **Failure mode: a history setting flipped off.** One admin setting turns history off, and messages then vanish after 24 hours.[^45] The record of orders and fills goes with them.

### 4.5 Signal (fifth)

- **How it carries the three jobs.** Healthchecks.io sends to a phone number or username,[^57] 6 messages a minute.[^58] The stack would post and read through signal-cli, a community tool "primarily intended to be used on servers to notify admins".[^19]
- **No official bot interface.** Signal's documentation lists cryptography specifications and one library.[^37] Its terms bar "bulk messaging, auto-messaging, and auto-dialing".[^18] Whether a personal alert bot counts as auto-messaging is not settled by any page read.
- **How two stacks stay separate.** Each stack's bot needs its own number: "Each phone must register with a separate number."[^67] Linking signal-cli into Michael's own account instead puts every stack in one account, posting as Michael himself.[^85]
- **How commands are secured.** A registration lock PIN.[^64] The program checks the sender.
- **Free tier limits.**
  - Free. History is "stored on your own devices".[^18]
  - Free Secure Backups keep "all of your text messages and the last 45 days of media"; 1.99 dollars a month adds media storage.[^46] Accounts are deleted after 120 days without the phone app opening.[^86]
- **Account identity.** A phone number that can "receive an insecure SMS or phone call".[^72] Usernames hide the number, they do not replace it.[^87] A numberless Android beta costs 2.99 dollars once.[^69]
- **Privacy.** Always end-to-end encrypted;[^17] Signal "cannot decrypt or otherwise access the content".[^18]
- **Pros.** The best privacy of the six.
- **Cons.** Terms risk; a phone number per bot; heavier build (signal-cli needs Java 25).[^19]
- **Failure mode: the bot expires.** "signal-cli releases older than three months may not work correctly."[^19] Signal's own apps also expire after 90 days.[^86] A stack left alone for a season loses its command path.

### 4.6 Slack, free plan (sixth)

- **How it carries the three jobs.** Healthchecks.io posts to a channel.[^59] Commands through Socket Mode, which needs no public address,[^38] slash commands,[^39] or reading history.[^40]
- **How two stacks stay separate.** One workspace per stack (my judgment).
- **How commands are secured.** The program checks the user; two-factor by text or authenticator app.[^65]
- **Free tier limits.** 90 days visible, over a year deleted, 10 apps including Michael's own.[^23][^88] Pro is 8.75 dollars a user a month, or 7.25 annually.[^52]
- **Account identity.** Company domain email suggested, no phone step.[^70]
- **Privacy.** Encrypted at rest and in transit, not end to end.[^76] Messages train non-generative models unless the owner opts out by email.[^78]
- **Pros.** Polished; email identity; workspaces keep stacks apart.
- **Cons.** History is lost on the free plan, the criterion weighted most. Phone alerts wait while the desktop is active, by default.[^29]
- **Failure mode: the record disappears.** A question about a fill four months later finds the message hidden, and after a year deleted.[^23]

## 5. Setting it up

**Key point: Michael creates accounts himself, later, when a stack is built. Nothing was created in this run.**

**What Michael does, per stack, when the time comes.**

- Create the stack's sib-tech email in Google Workspace (his existing plan).
- Create one Discord account on a sib-tech email. Servers keep stacks apart, so one human account is enough (my judgment).
- Turn on a passkey or authenticator app, and store the backup codes offline.[^61]
- Create one private server per stack, with channels for alerts, trading and commands. Set the server to notify on all messages.[^60][^24]
- In the developer site, create one bot application per stack and switch on Message Content.[^2] Give the bot a role that can see the command channel and read its history; without that, "no messages will be returned".[^6] Hand the bot's key to the stack's secret store, never to a file in the repo.
- In Healthchecks.io, one project per stack, "Connect Discord" to its alerts channel.[^4] Keep email on as the second route.[^15]
- **The five-minute desktop holdback test.**
  - With Discord open and active on the computer, have the stack (or a webhook test) post in the alerts channel.
  - Watch the phone. If it buzzes within a minute, the holdback is not happening on this setup.
  - If it stays silent, close Discord on the computer during market hours, and record the result (section 6, item 1).
- Sign in to Discord now and then, because an account idle for two years may be deleted.[^1]

**What CC (Claude Code) would build.**

- A "messages" part that posts the live list, orders, fills, refusals, errors and the daily summary. It never posts account numbers or keys.
- A command reader. Each run, or every few seconds in an always-on worker, it reads messages after the last one handled, saved in the database.[^6]
- It acts only if the author is Michael's ID and the channel is this stack's. Anything else is ignored and logged.
- A fallback: if Message Content is ever switched off, the reader accepts commands that mention the bot or arrive as direct messages.[^3]
- "stop" sets the flag every run checks before any order. "status" replies with positions, the day's profit or loss and the last heartbeat. Every command gets a reply.
- When the stack creates Healthchecks.io checks through its interface, it passes channels "*", because otherwise a new check gets "no integrations" and the email backup never fires.[^89]
- No change to run 3's designs: they already name Discord (run 4), at a cost of 0 dollars.

## 6. Falsifiability: what would overturn the pick

**Key point: two facts alone make Telegram the pick (items 2 and 3), and so does one pair (item 5). Five items make a tie. Every item was re-ranked by script for all six candidates.**

| Item | Evidence that would show it | Score change | Discord | Telegram | Matrix | Google Chat | Signal | Slack | Outcome |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1. Discord holds phone alerts while its desktop app is open | The five-minute test | Discord push 4 to 2 | 4.26 | 4.18 | 3.51 | 3.38 | 2.97 | 2.88 | Tie, Discord and Telegram |
| 2. Discord caps free history or ends history at a plan limit | A Discord page | Discord free 5 to 2 | 3.66 | 4.18 | 3.51 | 3.38 | 2.97 | 2.88 | **Telegram** |
| 3. Discord gates Message Content for small bots, with no DM or mention exception | A Discord developer page | Discord commands 5 to 2 | 4.05 | 4.18 | 3.51 | 3.38 | 2.97 | 2.88 | **Telegram** |
| 4. Reading Discord messages proves unworkable for a scheduled stack | A test in practice mode | Discord commands 5 to 3 | 4.20 | 4.18 | 3.51 | 3.38 | 2.97 | 2.88 | Tie, Discord and Telegram |
| 5. Items 1 and 4 together | Both of the above | Both changes | 3.96 | 4.18 | 3.51 | 3.38 | 2.97 | 2.88 | **Telegram** |
| 6. Telegram never drops a stop | 24 hour limit lifted, or Michael accepts round-the-clock checking as built and tested | Telegram commands 4 to 5 | 4.50 | 4.33 | 3.51 | 3.38 | 2.97 | 2.88 | Discord |
| 7. Items 1 and 6 together | Both of the above | Both changes | 4.26 | 4.33 | 3.51 | 3.38 | 2.97 | 2.88 | Tie, Telegram and Discord |
| 8. Telegram lets bots join Secret Chats | A Telegram page | Telegram encryption 2 to 5 | 4.50 | 4.33 | 3.51 | 3.38 | 2.97 | 2.88 | Discord |
| 9. Healthchecks.io drops Discord | Its integration list | Discord heartbeat 5 to 2 | 4.23 | 4.18 | 3.51 | 3.38 | 2.97 | 2.88 | Tie, Discord and Telegram |
| 10. Signal publishes an official bot interface that allows automated alerts | A Signal page | Signal commands 1 to 4, separation 2 to 4 | 4.50 | 4.18 | 3.51 | 3.38 | 3.56 | 2.88 | Discord |
| 11. Item 10, and Signal accounts without a phone number become general | Signal pages | Item 10 plus Signal identity 1 to 4 | 4.50 | 4.18 | 3.51 | 3.38 | 3.74 | 2.88 | Discord |
| 12. matrix.org turns on two-factor sign-in | A matrix.org page | Matrix security 2 to 4 | 4.50 | 4.18 | 3.79 | 3.38 | 2.97 | 2.88 | Discord |
| 13. Slack free keeps full history again | Slack's pricing page | Slack free 1 to 4 | 4.50 | 4.18 | 3.51 | 3.38 | 2.97 | 3.72 | Discord |
| 14. Michael counts the Workspace seat as already paid | His decision | Google Chat free 2 to 4 | 4.50 | 4.18 | 3.51 | 3.94 | 2.97 | 2.88 | Discord |
| 15. Item 14, and Google Chat commands prove simple to build | Item 14 plus a working practice build | Google Chat free 2 to 4, commands 3 to 5 | 4.50 | 4.18 | 3.51 | 4.24 | 2.97 | 2.88 | Discord |
| 16. Vendor-readable orders become unacceptable | His decision | Encryption weight 5 to 20 | 3.97 | 3.88 | 3.62 | 2.91 | 3.36 | 2.46 | Tie, Discord and Telegram |
| 17. Discord demands a phone check at signup | It happens at signup | Discord identity 4 to 2 | 4.38 | 4.18 | 3.51 | 3.38 | 2.97 | 2.88 | Discord |

- **The cheapest test is item 1.** It costs five minutes once a Discord account exists.
- **Signal and Google Chat stay behind** even in their best cases (items 11 and 15).

## 7. Open questions

1. **Does Discord hold phone alerts while the desktop app is open?** No source was read for it in run 5. The five-minute test settles it.
2. **How many bot applications may one Discord account own?** Not found on the developer help center or the apps overview. Two stacks need two.
3. **Does Signal's "auto-messaging" clause cover a personal alert bot?** The terms do not say.[^18] Only Signal can answer.
4. **Can a Telegram bot join a Secret Chat?** No page says either way.
5. **Is two-factor sign-in live on matrix.org?** Not found.[^20]
6. **Did Element's change to exclude unverified devices ship in April 2026?** Planned, not confirmed.[^35]
7. **Which does Telegram use for translation, its own Cocoon or Google and Microsoft?** Its FAQ and privacy policy disagree.[^10][^42]
8. **Can a personal Gmail account use Google Chat webhooks?** Every quickstart lists a Workspace account as a prerequisite; no page says it outright.[^66]

## 8. Sources

89 sources, all opened and read on 2026-10-28 by this run (the main session or a research helper), with plain requests or Playwright. None is cited from a search result summary.

Strength labels and price labels are defined in the run 3 deliverable, section 5, and mean the same here.

The register ID at the end of each entry points to the fuller note, with quotes and how the page was opened, in `runs/run-5-trajectory.md`, section 3.

[^1]: How long Discord keeps your information (Discord support). https://support.discord.com/hc/en-us/articles/5431812448791-How-long-Discord-keeps-your-information . Accessed 2026-10-28. Strength A. Register ID DC-04 in `runs/run-5-trajectory.md`.
[^2]: What are Privileged Intents? (Discord developer help center). https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents . Accessed 2026-10-28. Strength A. Register ID DC-01 in `runs/run-5-trajectory.md`.
[^3]: Gateway, sections Privileged Intents and Message Content Intent (Discord developer docs). https://docs.discord.com/developers/events/gateway . Accessed 2026-10-28. Strength A. Register ID DC-02 in `runs/run-5-trajectory.md`.
[^4]: Healthchecks.io Discord integration, add page template (transport.py and views.py in the same folder also read). https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/discord/templates/add_discord.html . Accessed 2026-10-28. Strength A. Register ID HC-04 in `runs/run-5-trajectory.md`.
[^5]: Webhook resource (Discord developer docs). https://docs.discord.com/developers/resources/webhook . Accessed 2026-10-28. Strength A. Register ID DC-14 in `runs/run-5-trajectory.md`.
[^6]: Message resource, Get Channel Messages (Discord developer docs). https://docs.discord.com/developers/resources/message . Accessed 2026-10-28. Strength A. Register ID DC-03 in `runs/run-5-trajectory.md`.
[^7]: Discord Terms of Service (effective September 29, 2025). https://discord.com/terms . Accessed 2026-10-28. Strength A. Price label: published (free). Register ID DC-06 in `runs/run-5-trajectory.md`.
[^8]: Telegram Premium FAQ. https://telegram.org/faq_premium . Accessed 2026-10-28. Strength A. Price label: gated and unverified (no price on the page; set by country and app store). Register ID TG-07 in `runs/run-5-trajectory.md`.
[^9]: Telegram Bot API (Bot API 10.3). https://core.telegram.org/bots/api . Accessed 2026-10-28. Strength A. Register ID TG-06 in `runs/run-5-trajectory.md`.
[^10]: Telegram FAQ. https://telegram.org/faq . Accessed 2026-10-28. Strength A. Register ID TG-01 in `runs/run-5-trajectory.md`.
[^11]: Getting Started (Discord support). https://support.discord.com/hc/en-us/articles/360033931551-Getting-Started . Accessed 2026-10-28. Strength A. Register ID DC-07 in `runs/run-5-trajectory.md`.
[^12]: Every Voice and Video Call on Discord Is Now End-to-End Encrypted, Discord blog, May 18, 2026. https://discord.com/blog/every-voice-and-video-call-on-discord-is-now-end-to-end-encrypted . Accessed 2026-10-28. Strength A. Register ID DC-20 in `runs/run-5-trajectory.md`.
[^13]: Discord Privacy Policy. https://discord.com/privacy . Accessed 2026-10-28. Strength A. Register ID DC-05 in `runs/run-5-trajectory.md`.
[^14]: Discord status history feed. https://discordstatus.com/history.rss . Accessed 2026-10-28. Strength A. Register ID DC-21 in `runs/run-5-trajectory.md`.
[^15]: Configuring Notifications (Healthchecks.io docs). https://healthchecks.io/docs/configuring_notifications/ . Accessed 2026-10-28. Strength A. Register ID HC-03 in `runs/run-5-trajectory.md`.
[^16]: End-to-End Encryption, Secret Chats (Telegram API docs). https://core.telegram.org/api/end-to-end . Accessed 2026-10-28. Strength A. Register ID TG-02 in `runs/run-5-trajectory.md`.
[^17]: Is it private? Can I trust it? (Signal support). https://support.signal.org/hc/en-us/articles/360007320391-Is-it-private-Can-I-trust-it . Accessed 2026-10-28. Strength A. Register ID SG-12 in `runs/run-5-trajectory.md`.
[^18]: Signal Terms of Service and Privacy Policy. https://signal.org/legal/ . Accessed 2026-10-28. Strength A. Register ID SG-01 in `runs/run-5-trajectory.md`.
[^19]: signal-cli README (community project). https://raw.githubusercontent.com/AsamK/signal-cli/master/README.md . Accessed 2026-10-28. Strength A for the project's own behaviour, D as evidence of Signal's policy. Register ID SC-01 in `runs/run-5-trajectory.md`.
[^20]: Matrix.org is now running MAS!, matrix.org blog, April 8, 2025, plus a search of later posts. https://www.matrix.org/blog/2025/04/morg-now-running-mas/ . Accessed 2026-10-28. Strength A. Register ID MX-04 in `runs/run-5-trajectory.md`.
[^21]: Google Workspace pricing. https://workspace.google.com/pricing . Accessed 2026-10-28. Strength A. Price label: published (7 dollars annual seen with curl; 8.40 monthly seen with Playwright). Register ID GC-01 in `runs/run-5-trajectory.md`.
[^22]: Build a Google Chat app with Pub/Sub (Google developers). https://developers.google.com/workspace/chat/quickstart/pub-sub . Accessed 2026-10-28. Strength A. Register ID GC-05 in `runs/run-5-trajectory.md`.
[^23]: Usage limits for free workspaces (Slack help). https://slack.com/help/articles/115002422943-Usage-limits-for-free-workspaces . Accessed 2026-10-28. Strength A. Register ID SL-01 in `runs/run-5-trajectory.md`.
[^24]: Notifications Settings 101 (Discord support). https://support.discord.com/hc/en-us/articles/215253258-Notifications-Settings-101 . Accessed 2026-10-28. Strength A. Register ID DC-11 in `runs/run-5-trajectory.md`.
[^25]: [Mobile] Notifications Settings 101 (Discord support). https://support.discord.com/hc/en-us/articles/218892547--Mobile-Notifications-Settings-101 . Accessed 2026-10-28. Strength A. Register ID DC-10 in `runs/run-5-trajectory.md`.
[^26]: Notifications, MDM and Push Gateway (Element docs). https://ems-docs.element.io/books/element-on-premise-documentation/page/notifications-mdm-push-gateway . Accessed 2026-10-28. Strength A. Register ID MX-09 in `runs/run-5-trajectory.md`.
[^27]: Turn Google Chat notifications on or off (Google Chat Help). https://support.google.com/chat/answer/7655718?hl=en . Accessed 2026-10-28. Strength A. Register ID GC-10 in `runs/run-5-trajectory.md`.
[^28]: Troubleshooting Notifications (Signal support). https://support.signal.org/hc/en-us/articles/360007318711-Troubleshooting-Notifications . Accessed 2026-10-28. Strength A. Register ID SG-11 in `runs/run-5-trajectory.md`.
[^29]: Configure your Slack notifications. https://slack.com/help/articles/201355156-Configure-your-Slack-notifications . Accessed 2026-10-28. Strength A. Register ID SL-05 in `runs/run-5-trajectory.md`.
[^30]: Rate limits (Discord developer docs). https://docs.discord.com/developers/topics/rate-limits . Accessed 2026-10-28. Strength A. Register ID DC-15 in `runs/run-5-trajectory.md`.
[^31]: Bots FAQ (Telegram). https://core.telegram.org/bots/faq . Accessed 2026-10-28. Strength A. Register ID TG-03 in `runs/run-5-trajectory.md`.
[^32]: Client-Server API, version v1.19 (Matrix specification). https://spec.matrix.org/latest/client-server-api/ . Accessed 2026-10-28. Strength A. Register ID MX-07 in `runs/run-5-trajectory.md`.
[^33]: Usage limits (Google Chat API). https://developers.google.com/workspace/chat/limits . Accessed 2026-10-28. Strength A. Register ID GC-14 in `runs/run-5-trajectory.md`.
[^34]: signal-cli manual page (community project). https://raw.githubusercontent.com/AsamK/signal-cli/master/man/signal-cli.1.adoc . Accessed 2026-10-28. Strength A for the project's own behaviour, D as evidence of Signal's policy. Register ID SC-02 in `runs/run-5-trajectory.md`.
[^35]: Exclude insecure devices, matrix.org blog, November 19, 2025. https://matrix.org/blog/2025/11/exclude-insecure-devices/ . Accessed 2026-10-28. Strength A. Register ID MX-10 in `runs/run-5-trajectory.md`.
[^36]: Method: spaces.messages.list (Google Chat API reference). https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages/list . Accessed 2026-10-28. Strength A. Register ID GC-06 in `runs/run-5-trajectory.md`.
[^37]: Signal documentation page. https://signal.org/docs/ . Accessed 2026-10-28. Strength A. Register ID SG-14 in `runs/run-5-trajectory.md`.
[^38]: Using Socket Mode (Slack developer docs). https://docs.slack.dev/apis/events-api/using-socket-mode . Accessed 2026-10-28. Strength A. Register ID SL-08 in `runs/run-5-trajectory.md`.
[^39]: Implementing slash commands (Slack developer docs). https://docs.slack.dev/interactivity/implementing-slash-commands . Accessed 2026-10-28. Strength A. Register ID SL-10 in `runs/run-5-trajectory.md`.
[^40]: conversations.history reference (Slack developer docs). https://docs.slack.dev/reference/methods/conversations.history . Accessed 2026-10-28. Strength A. Register ID SL-11 in `runs/run-5-trajectory.md`.
[^41]: Rate limit changes for non-Marketplace apps, 2025-05-29 (Slack changelog). https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps . Accessed 2026-10-28. Strength A. Register ID SL-12 in `runs/run-5-trajectory.md`.
[^42]: Telegram Privacy Policy. https://telegram.org/privacy . Accessed 2026-10-28. Strength A. Register ID TG-08 in `runs/run-5-trajectory.md`.
[^43]: matrix.org homeserver pricing. https://matrix.org/homeserver/pricing/ . Accessed 2026-10-28. Strength A. Price label: published (free plan); Premium has no price to label. Register ID MX-01 in `runs/run-5-trajectory.md`.
[^44]: matrix.org Privacy Notice (effective August 25, 2025). https://matrix.org/legal/privacy-notice/ . Accessed 2026-10-28. Strength A. Register ID MX-03 in `runs/run-5-trajectory.md`.
[^45]: Turn chat history on or off for an organization (Google Workspace Admin Help). https://support.google.com/a/answer/7664184?hl=en . Accessed 2026-10-28. Strength A. Register ID GC-08 in `runs/run-5-trajectory.md`.
[^46]: Signal Secure Backups (Signal support). https://support.signal.org/hc/en-us/articles/9708267671322-Signal-Secure-Backups . Accessed 2026-10-28. Strength A. Price label: published. Register ID SG-07 in `runs/run-5-trajectory.md`.
[^47]: Opcodes and status codes (Discord developer docs). https://docs.discord.com/developers/topics/opcodes-and-status-codes . Accessed 2026-10-28. Strength A. Register ID DC-17 in `runs/run-5-trajectory.md`.
[^48]: Telegram Bot Features. https://core.telegram.org/bots/features . Accessed 2026-10-28. Strength A. Register ID TG-04 in `runs/run-5-trajectory.md`.
[^49]: Configure the Google Chat API (Google developers). https://developers.google.com/workspace/chat/configure-chat-api . Accessed 2026-10-28. Strength A. Register ID GC-04 in `runs/run-5-trajectory.md`.
[^50]: Linked Devices (Signal support). https://support.signal.org/hc/en-us/articles/360007320551-Linked-Devices . Accessed 2026-10-28. Strength A. Register ID SG-09 in `runs/run-5-trajectory.md`.
[^51]: Nitro (Discord). https://discord.com/nitro . Accessed 2026-10-28. Strength A. Price label: published. Register ID DC-19 in `runs/run-5-trajectory.md`.
[^52]: Slack pricing. https://slack.com/pricing . Accessed 2026-10-28. Strength A. Price label: published. Register ID SL-03 in `runs/run-5-trajectory.md`.
[^53]: Plans and Pricing, Healthchecks.io. https://healthchecks.io/pricing/ . Accessed 2026-10-28. Strength A. Price label: published. Register ID HC-01 in `runs/run-5-trajectory.md`.
[^54]: Telegram Integration for Healthchecks.io. https://healthchecks.io/integrations/telegram/ . Accessed 2026-10-28. Strength A. Register ID HC-T1 in `runs/run-5-trajectory.md`.
[^55]: Healthchecks.io Matrix integration, add page template (transport.py in the same folder also read). https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/matrix/templates/add_matrix.html . Accessed 2026-10-28. Strength A. Register ID HC-05 in `runs/run-5-trajectory.md`.
[^56]: Google Chat integration for Healthchecks.io. https://healthchecks.io/integrations/googlechat/ . Accessed 2026-10-28. Strength A. Register ID GC-11 in `runs/run-5-trajectory.md`.
[^57]: Healthchecks.io Signal integration, transport.py (forms.py in the same folder also read). https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/signal/transport.py . Accessed 2026-10-28. Strength A. Register ID HC-S1 in `runs/run-5-trajectory.md`.
[^58]: Healthchecks.io models.py, Signal rate limit ("6 messages for a single recipient per minute"). https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/api/models.py . Accessed 2026-10-28. Strength A. Register ID HC-S3 in `runs/run-5-trajectory.md`.
[^59]: Healthchecks.io integration for Slack. https://healthchecks.io/integrations/add_slack/ . Accessed 2026-10-28. Strength A. Register ID SL-04 in `runs/run-5-trajectory.md`.
[^60]: How do I set up a private server? (Discord support). https://support.discord.com/hc/en-us/articles/206143407-How-do-I-set-up-a-private-server . Accessed 2026-10-28. Strength A. Register ID DC-08 in `runs/run-5-trajectory.md`.
[^61]: Setting up Multi-Factor Authentication (Discord support). https://support.discord.com/hc/en-us/articles/219576828-Setting-up-Multi-Factor-Authentication . Accessed 2026-10-28. Strength A. Register ID DC-09 in `runs/run-5-trajectory.md`.
[^62]: Application commands, including command permissions (Discord developer docs). https://docs.discord.com/developers/interactions/application-commands . Accessed 2026-10-28. Strength A. Register ID DC-16 in `runs/run-5-trajectory.md`.
[^63]: Deploy 2-Step Verification (Google Workspace Admin Help). https://support.google.com/a/answer/9176657?hl=en . Accessed 2026-10-28. Strength A. Register ID GC-15 in `runs/run-5-trajectory.md`.
[^64]: Signal PIN (Signal support). https://support.signal.org/hc/en-us/articles/360007059792-Signal-PIN . Accessed 2026-10-28. Strength A. Register ID SG-04 in `runs/run-5-trajectory.md`.
[^65]: Set up two-factor authentication (Slack help). https://slack.com/help/articles/204509068-Set-up-two-factor-authentication . Accessed 2026-10-28. Strength A. Register ID SL-13 in `runs/run-5-trajectory.md`.
[^66]: Build a Google Chat app as a webhook (Google developers). https://developers.google.com/workspace/chat/quickstart/webhooks . Accessed 2026-10-28. Strength A. Register ID GC-02 in `runs/run-5-trajectory.md`.
[^67]: Can I use Signal for work? (Signal support). https://support.signal.org/hc/en-us/articles/360007319731-Can-I-use-Signal-for-work . Accessed 2026-10-28. Strength A. Register ID SG-06 in `runs/run-5-trajectory.md`.
[^68]: matrix.org Terms and Conditions (effective August 14, 2025). https://matrix.org/legal/terms-and-conditions/ . Accessed 2026-10-28. Strength A. Register ID MX-02 in `runs/run-5-trajectory.md`.
[^69]: Phone Numberless Registration for Android beta (Signal support). https://support.signal.org/hc/en-us/articles/11197884108826-Phone-Numberless-Registration-for-Android-beta . Accessed 2026-10-28. Strength A. Price label: published. Register ID SG-02 in `runs/run-5-trajectory.md`.
[^70]: Create a Slack workspace (Slack help). https://slack.com/help/articles/206845317-Create-a-Slack-workspace . Accessed 2026-10-28. Strength A. Register ID SL-09 in `runs/run-5-trajectory.md`.
[^71]: How to Verify Your Discord Account (Discord support). https://support.discord.com/hc/en-us/articles/6181726888215-How-to-Verify-Your-Discord-Account . Accessed 2026-10-28. Strength A. Register ID DC-12 in `runs/run-5-trajectory.md`.
[^72]: Register a phone number (Signal support). https://support.signal.org/hc/en-us/articles/360007318691-Register-a-phone-number . Accessed 2026-10-28. Strength A. Register ID SG-05 in `runs/run-5-trajectory.md`.
[^73]: Discord Account Switcher FAQ (Discord support). https://support.discord.com/hc/en-us/articles/4412732047127-Discord-Account-Switcher-FAQ . Accessed 2026-10-28. Strength A. Register ID DC-13 in `runs/run-5-trajectory.md`.
[^74]: Older Matrix FAQ (page marked as not updated in a while). https://matrix.org/docs/older/faq/ . Accessed 2026-10-28. Strength A. Register ID MX-06 in `runs/run-5-trajectory.md`.
[^75]: About client-side encryption (Google Workspace Admin Help). https://support.google.com/a/answer/10741897?hl=en . Accessed 2026-10-28. Strength A. Register ID GC-12 in `runs/run-5-trajectory.md`.
[^76]: Slack security. https://slack.com/trust/security . Accessed 2026-10-28. Strength A. Register ID SL-06 in `runs/run-5-trajectory.md`.
[^77]: Generative AI in Google Workspace Privacy Hub. https://support.google.com/a/answer/15706919?hl=en . Accessed 2026-10-28. Strength A. Register ID GC-13 in `runs/run-5-trajectory.md`.
[^78]: Privacy principles: search, learning and artificial intelligence (Slack). https://slack.com/trust/data-management/privacy-principles . Accessed 2026-10-28. Strength A. Register ID SL-07 in `runs/run-5-trajectory.md`.
[^79]: Discord Community Guidelines. https://discord.com/guidelines . Accessed 2026-10-28. Strength A. Register ID DC-22 in `runs/run-5-trajectory.md`.
[^80]: Bots: An introduction for developers (Telegram). https://core.telegram.org/bots . Accessed 2026-10-28. Strength A. Price label: published (free). Register ID TG-05 in `runs/run-5-trajectory.md`.
[^81]: Element Classic to Pro mobile apps FAQ (Element docs). https://docs.element.io/latest/element-server-suite-pro/migration/classic-to-pro-mobile-apps-faq/ . Accessed 2026-10-28. Strength A. Register ID MX-05 in `runs/run-5-trajectory.md`.
[^82]: Post-mortem of the September 2 outage, matrix.org blog, October 2025. https://matrix.org/blog/2025/10/post-mortem/ . Accessed 2026-10-28. Strength A. Register ID MX-08 in `runs/run-5-trajectory.md`.
[^83]: Healthchecks.io home page, Integrations list. https://healthchecks.io/ . Accessed 2026-10-28. Strength A. Register ID HC-02 in `runs/run-5-trajectory.md`.
[^84]: Pub/Sub pricing (Google Cloud). https://cloud.google.com/pubsub/pricing . Accessed 2026-10-28. Strength A. Price label: published. Register ID GC-07 in `runs/run-5-trajectory.md`.
[^85]: signal-cli wiki, Linking other devices (community project). https://raw.githubusercontent.com/wiki/AsamK/signal-cli/Linking-other-devices-(Provisioning).md . Accessed 2026-10-28. Strength A for the project's own behaviour, D as evidence of Signal's policy. Register ID SC-04 in `runs/run-5-trajectory.md`.
[^86]: Open Signal on your phone to keep your account active (Signal support). https://support.signal.org/hc/en-us/articles/9021007554074-Open-Signal-on-your-phone-to-keep-your-account-active . Accessed 2026-10-28. Strength A. Register ID SG-10 in `runs/run-5-trajectory.md`.
[^87]: Phone Number Privacy and Usernames (Signal support). https://support.signal.org/hc/en-us/articles/6712070553754-Phone-Number-Privacy-and-Usernames . Accessed 2026-10-28. Strength A. Register ID SG-03 in `runs/run-5-trajectory.md`.
[^88]: Feature limitations on the free version of Slack. https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack . Accessed 2026-10-28. Strength A. Register ID SL-02 in `runs/run-5-trajectory.md`.
[^89]: Healthchecks.io Management API docs, and the default email integration in its account code. https://healthchecks.io/docs/api/ . Accessed 2026-10-28. Strength A. Register ID HC-07 in `runs/run-5-trajectory.md`.
