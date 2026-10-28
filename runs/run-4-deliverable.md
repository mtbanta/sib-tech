# Run 4 deliverable: the messaging app

Written 2026-10-28 (America/Chicago). Every source is dated that day: 73 were opened, and 4 were seen only as search result summaries (marked in section 8).

**What this document is.**

- Research input for a human decision about which phone app carries a future stack's alerts, messages and commands. It is never an instruction to act, to open an account or to build anything.
- It recommends an app, and Michael decides.
- It builds on the corrected run 3 deliverable, whose pick is option C, the always-on worker. The app must also serve options B, D and F, because the stack is not decided.

**How to read it.**

- Every factual claim carries a numbered footnote. Section 8 lists each with its title, address, access date, strength label and, for prices, a price label. The labels mean the same as in runs 1 to 3 (run 3 deliverable, section 5).
- Sentences marked "my judgment", "my inference" or "my reading" are reasoning from cited facts, not sourced facts.
- Quotes were read through tools that can paraphrase lightly. Reopen the address before a decision hangs on exact wording.

## 1. Summary

**Key point: the strongest pick is Discord, on its free plan. It scores 4.53 of 5 against Telegram's 4.28, and is first under all 8 weightings tried.**

- **What Discord does for each job.**
  - Heartbeat alerts: Healthchecks.io posts to a Discord channel natively, and no plan restriction was found for it.[^1][^2][^3]
  - Regular messages: the stack posts orders, fills, refusals, errors and the daily summary to a channel. A webhook needs no bot user to post.[^4]
  - Commands: Michael types "stop" or "status" in a private command channel. The stack reads the channel's messages each time it runs, which works for a scheduled run and for an always-on worker.[^5][^6]
- **Why Discord over Telegram.**
  - Both are free with no history limit found on any vendor page.[^7][^8] Free tier limits carry the most weight, and here they tie.
  - Telegram drops a bot's unread messages after 24 hours.[^9] A stop sent while a stack is not checking (a weekend, a pause, outside market hours) can vanish. A Discord message stays in the channel until the stack reads it (my reading: no expiry was found).
  - Telegram accounts "can only be connected to a mobile number".[^10] Michael's plan is accounts tied to a sib-tech email, which Discord allows at signup.[^11]
  - Discord's command channel can sit in a private server with Michael as the only member,[^12] and his sign-in can use a passkey or an authenticator app.[^13] Anyone can find and message a Telegram bot, so the program has to ignore strangers itself.[^14]
- **What Discord costs Michael in comfort.**
  - Messages are not end-to-end encrypted, and Discord scans content for harmful activity.[^15][^16] Telegram's bot chats are no better (my inference from TG-14).
  - Discord's own status feed lists several 2026 incidents with message sending.[^17] Healthchecks.io's email alert is the backup (section 5).
  - Community posts say Discord holds phone alerts while the desktop app is open.[^18] No Discord page confirms it. Michael can test it in five minutes, and a confirmed holdback would make Telegram and Discord a tie (section 6, item 1).
- **Slack is out on its free plan.** It shows only 90 days of history and deletes messages older than a year.[^19] It also allows only 10 apps, and Michael's own bot counts toward them.[^19]
- **Matrix (the fourth candidate, on the Element app) is third.** It is free, end-to-end encrypted by default and needs no phone number.[^20][^21][^22] But matrix.org has no live two-factor sign-in,[^23] and its classic mobile app retires on December 31, 2026.[^24]
- **What would change the pick.** Discord capping free history or blocking bots from reading messages makes Telegram the pick (section 6, item 5). So does a confirmed desktop holdback combined with either Telegram never dropping a stop or Discord polling proving unworkable (items 14 and 15).
- **The backstop is unchanged from run 3.** The broker's own app can cancel orders and close positions, and at Alpaca the "suspend_trade" switch blocks new orders. Neither depends on any messaging app or on Claude.

## 2. Criteria and weights

**Key point: eight criteria, weights fixed before any total was computed. Free tier limits carry 30 of 100, double any other.**

| Criterion | Weight | Why this weight |
| :-- | :-- | :-- |
| Free tier limits (history, bots, rate limits) | 30 | The brief: more than any other single criterion. Michael values a free app that keeps full history |
| Two-way commands for every stack shape | 15 | Job 3. The stop must work for a scheduled stack (options B and F) and an always-on worker (options C and D) |
| Command security | 15 | A command can stop an agent that trades real and borrowed money. Who can send one matters |
| Push alerts reach the phone | 12 | Jobs 1 and 2 are worthless if the phone stays silent |
| Healthchecks.io integration | 10 | Job 1. All four candidates have a native one, so it separates little |
| Separation of stacks | 8 | Two stacks must never share a command path. All four can do it |
| Account identity (custom domain email, phone) | 5 | Michael's plan is accounts tied to a sib-tech email. A planned convenience, not a safety issue (my judgment) |
| Privacy | 5 | Messages carry orders and fills, never account numbers or keys (a design rule in section 5). None of the four encrypts bot messages end to end on its default path |

**Scores.** Each is 1 (poor) to 5 (strong). The basis for each is in section 4, and the contested ones are trajectory decisions D4 to D7.

| Criterion (weight) | Telegram | Discord | Slack | Matrix |
| :-- | :-- | :-- | :-- | :-- |
| Free tier limits (30) | 5 | 5 | 1 | 4 |
| Two-way commands (15) | 4 | 4 | 3 | 4 |
| Command security (15) | 4 | 5 | 4 | 2 |
| Push alerts (12) | 4 | 4 | 3 | 3 |
| Healthchecks.io (10) | 5 | 5 | 5 | 4 |
| Separation (8) | 5 | 5 | 5 | 4 |
| Account identity (5) | 2 | 4 | 5 | 5 |
| Privacy (5) | 2 | 2 | 2 | 4 |
| **Weighted total** | **4.28** | **4.53** | **2.96** | **3.63** |

**Method.** Each score times its weight, summed, divided by 100, rounded to two places, by script. The script refuses any weighting where free tier limits do not outweigh every other criterion. Tie rule, as in run 3: first, or within 0.10 of first.

**Sensitivity to the weights.** Discord is first in all 8.

| Weighting | Discord | Telegram | Matrix | Slack | First |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Base weights | 4.53 | 4.28 | 3.63 | 2.96 | Discord |
| Near equal (free 20, the other seven share 80) | 4.31 | 3.97 | 3.77 | 3.29 | Discord |
| Free tier heavier (40) | 4.60 | 4.38 | 3.68 | 2.68 | Discord |
| Security heavier (25) | 4.62 | 4.28 | 3.44 | 2.99 | Discord |
| Push heavier (22) | 4.49 | 4.28 | 3.57 | 2.86 | Discord |
| Identity heavier (20) | 4.48 | 3.96 | 3.88 | 3.15 | Discord |
| Privacy heavier (20) | 4.15 | 3.96 | 3.72 | 2.67 | Discord |
| Commands heavier (25) | 4.49 | 4.28 | 3.70 | 2.86 | Discord |

In each heavier weighting, the free tier stays at 30 (40 in its own row), and the other criteria are scaled down in proportion to make room.

## 3. Comparison table

**Key point: every candidate against every question in the brief. "Not found" means no live page said either way.**

| Question | Telegram | Discord | Slack (free) | Matrix (Element app) |
| :-- | :-- | :-- | :-- | :-- |
| Push alerts reach the phone in the background? | Yes, no documented delay found. Routine messages can be sent silent, alerts loud[^25] | Yes, for anything that would notify on desktop; server set to "All Messages"[^26][^27]. Desktop holdback reported by users only[^18] | Yes, but by default the phone waits 1 minute after the desktop locks or 10 minutes idle, unless set to "Immediately"[^28] | Yes, through Element's push gateway and Apple or Google[^29]. Some reports of trouble on unusual Android builds[^30] |
| Limits on bot messages | 1 a second per chat, 20 a minute per group[^31] | 50 requests a second per bot[^32] | About 1 a second per channel[^33] | Rate limiting exists; no number published[^34] |
| Two-way commands: how? | Bot fetches messages (getUpdates) or gets them pushed to a web address[^35][^36]. Unread messages kept 24 hours at most[^9] | Bot reads channel messages, up to 100 a call[^5], or slash commands over a live connection or a web address that must answer in 3 seconds[^37][^38] | Socket Mode needs a connected program[^39]; slash commands need a web address that answers in 3 seconds[^40]; or read channel history[^41] | Bot account syncs from a saved position token, which suits a program that runs and exits[^34] |
| Works for a once-a-minute scheduled stack? | Yes, by fetching, if it checks at least once a day[^9] | Yes, by reading the channel[^5] | Yes, by reading history, within the rate limits[^41][^42] | Yes, by syncing[^34] |
| Free tier: message history | No limit found; cloud history kept on Telegram's servers[^8] | No limit found on any vendor page | 90 days visible; older than one year deleted[^19][^43] | No limit found; media limits only (10 MB a file)[^20] |
| Free tier: bots or integrations | No official limit found; 20 per account on secondary sites only[^44] | No cap on bot applications found; 100 servers per account, 1,000 webhooks per server[^45] | 10 apps, custom bots included[^19] | Not found |
| What would push him to paid | Nothing needed; Premium adds extras, free stays the same[^46] | Nothing needed; Nitro is 2.99 or 9.99 dollars a month, for extras[^47] | Full history: Pro 8.75 dollars per user a month, or 7.25 a month billed annually[^48] | Nothing needed; Premium has no published price yet[^20] |
| Healthchecks.io sends to it natively? | Yes: private chat, group or channel[^49] | Yes: a channel, through "Connect Discord"[^2] | Yes: "Add to Slack", pick a channel[^50] | Yes: invite its bot into a room. Posts are not end-to-end encrypted[^51][^52] |
| Command security | Program checks the sender's numeric ID[^53]. Anyone can message the bot[^14]. Two-step sign-in: text code plus password[^10] | Private server, Michael the only member[^12]. Passkey or authenticator sign-in[^13]. Program checks the user ID[^38]. Slash commands can be limited to named users[^54] | Program checks user_id[^40]; requests signed[^55]; two-factor per workspace[^56]. No built-in limit to named users found | Program checks the sender's full ID[^34]; invite-only rooms[^34]. Two-factor sign-in on matrix.org is planned, not live[^23] |
| Separation of two stacks | One bot per stack, each with its own token[^14] | One private server and one bot per stack; commands stay in their server[^54] | One workspace per stack; the phone app switches between them[^57] | One room and one bot account per stack (my inference from MX-06) |
| Custom domain email at signup? | No: phone number only[^10] | Yes, any email he keeps[^11]; phone can be demanded later[^58] | Yes, a company domain email is suggested[^59] | Yes, a verified email is required[^60] |
| Phone number required? | Yes[^10] | Not at signup; may be required later, one number per account, no internet phone numbers[^58] | Not mentioned[^59] | No, optional[^22] |
| Separate accounts per stack? | Several accounts in one app, each needs its own number[^10] | Five accounts in the account switcher[^61]; not needed, servers separate stacks | Yes, one workspace each[^57] | Experimental in Element X[^62][^63] |
| End-to-end encrypted? | Not bot chats (cloud chats)[^64] | Not text; voice and video only[^15] | No; Slack holds the keys[^65] | Yes by default in new rooms[^21]; not the Healthchecks.io posts[^52] |
| Vendor reads or trains on content? | Automated spam scanning of cloud chats; no AI training statement[^66] | Proactive scanning and machine learning models for harmful content; no statement on generative AI[^16] | No generative AI training without opt-in; other models use data unless the owner opts out by email[^67] | Cannot read encrypted content; no profiling; no AI statement[^22][^68] |

## 4. The four candidates

### 4.1 Discord (the pick)

- **How it carries the three jobs.**
  - Heartbeat: Healthchecks.io's "Connect Discord" posts "when a check goes up or down" to a chosen channel.[^2]
  - Messages: the stack posts to a channel through a webhook, which needs "no bot user or authentication", only its secret address.[^4]
  - Commands: Michael types in a command channel. The stack reads new messages each run with its bot (100 at a time) and acts only on Michael's.[^5] A bot with fewer than 10,000 users can read message text by switching a setting on.[^6]
- **Push.** The phone gets "push notifications for anything you'd normally be notified about on desktop".[^27] Setting each stack's server to "All Messages" makes every post notify, no mention needed.[^26][^69]
- **How two stacks stay separate.** One private server per stack, each with its own bot application, its own channels and its own Healthchecks.io link. A command registered in one server stays there: "Guild commands are limited to the guild where they were created".[^54] Each stack's program reads only its own server's command channel (design rule).
- **How commands are secured.**
  - The server is private, with Michael its only human member.[^12]
  - His sign-in uses a passkey or an authenticator app. Support "is not able to remove MFA", so he keeps the backup codes.[^13]
  - The program acts only on messages whose author ID is Michael's numeric ID, in that stack's command channel.[^38][^5]
  - On the always-on route, slash commands can also be limited to named users.[^54]
- **Free tier limits.** Discord downloads "for free";[^7] Nitro (2.99 or 9.99 dollars a month) adds extras this use does not need.[^47] No history cap was found on any vendor page. Limits that matter: 50 requests a second per bot, 100 servers per account.[^32][^45]
- **Account identity.** Signup takes any email Michael "can access and maintain access to", so a sib-tech address works (no domain restriction found).[^11] A phone check can be demanded later, for example if an account posts "faster than a human can manage"; the number must be a real mobile number not used by another account.[^58] The stack posts as a bot application, not as a user account, as the rules require.[^70]
- **Privacy.** Text is not end-to-end encrypted, and Discord has "no current plans" to change that.[^15] It scans content "for illegal or harmful activity" and uses machine learning.[^16]
- **Pros.**
  - Free with no history limit found, and the only free candidate where a late reader still sees a stop (my reading of DC-07 against TG-05).
  - Email signup fits the sib-tech plan.
  - Strongest command security of the four.
- **Cons.**
  - Not encrypted end to end; order details sit readable on Discord's servers.
  - Several 2026 incidents affected message sending.[^17]
  - Slash commands need an always-on connection or a web address; the scheduled route reads plain messages instead.
  - Automatic age estimation since 2026 may ask Michael to confirm his age group. Core messaging is unaffected.[^71]
- **Failure mode: a silent phone while the desktop app is open.** Users report Discord holds phone alerts while the computer app looks active.[^18] If true, a missed heartbeat could sit unseen on a desk. The fix is to test it before relying on it, keep Healthchecks.io's email as a second route, and close Discord on the computer during market hours.

### 4.2 Telegram (run 3's choice, second)

- **How it carries the three jobs.** Healthchecks.io posts to a private chat, group or channel.[^49] The stack posts with its bot, routine messages silent and alerts loud.[^25] Commands start with "/" (for example /stop).[^14]
- **How commands arrive.** The bot fetches new messages (getUpdates), which needs no always-on program, or receives them at a public web address.[^35][^36] Unread messages "will not be kept longer than 24 hours".[^9]
- **How two stacks stay separate.** One bot per stack; each bot's token controls only that bot.[^14]
- **How commands are secured.** The program checks the sender's numeric ID.[^53] Anyone can find the bot by its name,[^14] so ignoring strangers is the program's job. Two-step sign-in adds a password to the text code.[^10]
- **Free tier limits.** Free "for both users and developers", messaging free "forever".[^8] Limits: 1 message a second per chat, 20 a minute in a group.[^31] No history limit and no official bot limit found.[^44]
- **Account identity.** "Telegram accounts can only be connected to a mobile number."[^10] The sib-tech email plan cannot be met. An account idle for 18 months is deleted by default.[^66]
- **Privacy.** Bot chats are cloud chats, not end-to-end encrypted.[^64] Telegram may scan cloud chats for spam and may give a phone number and IP address to authorities on a court order.[^66]
- **Pros.** Free, no history limit found, the simplest command route, already written into run 3's designs.
- **Cons.**
  - Phone number only, so the sib-tech email plan cannot be met.
  - A stop can expire after 24 hours, and anyone can message the bot.
  - No official status page found.
- **Failure mode: a stop that never arrives.** Michael sends /stop on a Friday night to a stack that checks only during market hours. Telegram discards it after 24 hours, and the stack trades on Monday.[^9] The fix is to check for commands every few minutes, every day, and to reply "stopped" so Michael sees it landed.

### 4.3 Matrix on the Element app (the fourth candidate, third)

- **Why it was chosen as the fourth.** It is on Healthchecks.io's integration list,[^1] it is free, and a bot can read and send messages through an open interface.[^34] Push-only apps (Pushover, ntfy) cannot take commands. Signal has no official bot interface (my reading, trajectory D1).
- **How it carries the three jobs.** Healthchecks.io's bot joins a room and posts.[^51] A second Matrix account, run by the stack, posts messages and reads commands by syncing from its saved position.[^34]
- **How two stacks stay separate.** One invite-only room and one bot account per stack.[^34]
- **How commands are secured.** The program checks the sender's full ID.[^34] But matrix.org lists two-factor sign-in as future work, so a password alone guards Michael's account.[^23]
- **Free tier limits.** A free plan with media limits (10 MB a file, 100 MB a day).[^20] Premium's price is "not yet been finalised", and users not on a plan may be moved to the free plan with notice.[^20]
- **Account identity.** A verified email is required, a phone is optional.[^60][^22]
- **Privacy.** New rooms are encrypted by default.[^21] Healthchecks.io's posts are plain, not encrypted,[^52] and it warns "Do not invite to rooms with sensitive content".[^51]
- **Pros.** The best privacy, no phone, no tracking or profiling.[^22]
- **Cons.**
  - No two-factor sign-in.
  - The classic Element app is "sunset on 31.12.2026"; Element X replaces it.[^24] Multiple accounts are experimental.[^72]
  - The bot must handle encryption, which adds build work (my judgment).
- **Failure mode: one server, one outage.** Every free account sits on matrix.org. It was down for about 24 hours on September 2 and 3, 2025.[^73] Alerts and commands both stop with it.

### 4.4 Slack, free plan (fourth)

- **How it carries the three jobs.** Healthchecks.io posts to a channel.[^50] The stack posts through an incoming webhook tied to one channel.[^74] Commands arrive over Socket Mode (needs a connected program), a slash command web address, or by reading channel history.[^39][^40][^41]
- **How two stacks stay separate.** One workspace per stack; the phone app switches between them.[^57]
- **How commands are secured.** The program checks user_id; requests are signed; two-factor is set per workspace.[^40][^55][^56]
- **Free tier limits.** 90 days of visible history, deletion after one year, 10 apps including Michael's own bot.[^19][^43] Full history costs Pro, 8.75 dollars per user a month.[^48]
- **Account identity.** The best fit: a company domain email is suggested at signup, Google sign-in is offered, no phone mentioned.[^59]
- **Privacy.** Encrypted in transit and at rest, but Slack holds the keys.[^65] No generative AI training without opt-in; other models use data unless the owner opts out by email.[^67]
- **Pros.** Polished, email identity, workspaces keep stacks apart cleanly.
- **Cons.** History is lost on the free plan, which the brief weights most. Phone alerts wait while the desktop app is active, unless changed.[^28]
- **Failure mode: the record disappears.** A dispute over a fill four months later finds the message hidden, and after a year deleted.[^19] The stack's own log would have to be the record.

## 5. Setting it up

**Key point: Michael creates accounts and servers himself, later, when a stack is built. Nothing was created in this run.**

**What Michael does, per stack, when the time comes.**

- Create the sib-tech email address for the stack in Google Workspace (his existing plan).
- Create one Discord account with a sib-tech email, or reuse one across stacks. Servers keep stacks apart, so one human account is enough (my judgment).
- Turn on sign-in protection with an authenticator app or a passkey. Store the backup codes offline.[^13]
- Create one private server per stack, for example "sib-tech stack A". Add three channels: alerts, trading and commands. Set the server's notifications to "All Messages".[^26][^12]
- In Discord's developer site, create one bot application per stack and switch on "Message Content". Hand the bot's key to the stack's secret store, never to a file in the repo.[^6]
- In Healthchecks.io, use one project per stack and add "Connect Discord", pointing at that stack's alerts channel.[^2] Keep email on as a second route.[^1]
- Run the five-minute test: with Discord open on the computer, post in the alerts channel and see whether the phone buzzes. If it does not, close the desktop app during market hours (section 6, item 1).

**What CC (Claude Code) would build.**

- A small "messages" part in each stack that posts to the trading channel: live list, orders, fills, refusals, errors, daily summary. It never posts account numbers or keys.
- A command reader. Each run (or every few seconds in an always-on worker) it reads new messages in that stack's command channel since the last one it handled, saved in the database.[^5]
- It acts only if the author ID is Michael's and the channel ID is this stack's. Anything else is ignored and logged.
- Commands: "stop" sets the flag every run checks before any order; "status" replies with positions, today's profit or loss and the last heartbeat. Every command gets a reply, so Michael sees it landed.
- A command arriving while the stack sleeps is still in the channel when it wakes, so a scheduled stack reads it at its next run.
- Changes to run 3's designs: every "Telegram" becomes "Discord" (section 9 of the run 3 deliverable, updated in place), at the same cost of 0 dollars.

## 6. Falsifiability: what would overturn the pick

**Key point: one fact alone makes Telegram the pick (item 5). Four make a tie (items 1, 2, 7, 11). Two pairs make Telegram the pick (items 14, 15). Every item was re-ranked by script.**

| Item | Evidence that would show it | Score change | Discord | Telegram | Matrix | Slack | Outcome |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 1. Discord holds phone alerts while desktop is open | The five-minute test, or a Discord page | Discord push 4 to 2 | 4.29 | 4.28 | 3.63 | 2.96 | Tie, Discord and Telegram |
| 2. Telegram never drops a stop | 24 hour limit lifted, or Michael accepts 24/7 checking as built and tested | Telegram commands 4 to 5 | 4.53 | 4.43 | 3.63 | 2.96 | Tie, Discord and Telegram |
| 3. Telegram alerts arrive late | A two-week test | Telegram push 4 to 2 | 4.53 | 4.04 | 3.63 | 2.96 | Discord |
| 4. Telegram adds a history cap or bot fee | A Telegram page | Telegram free 5 to 2 | 4.53 | 3.38 | 3.63 | 2.96 | Discord |
| 5. Discord caps free history or blocks bots from reading messages | A Discord page | Discord free 5 to 2 | 3.63 | 4.28 | 3.63 | 2.96 | **Telegram** |
| 6. Healthchecks.io drops Telegram | Its integration list | Telegram heartbeat 5 to 2 | 4.53 | 3.98 | 3.63 | 2.96 | Discord |
| 7. Healthchecks.io drops Discord | Its integration list | Discord heartbeat 5 to 2 | 4.23 | 4.28 | 3.63 | 2.96 | Tie, Telegram and Discord |
| 8. Michael accepts a phone-number account | His decision | Telegram identity 2 to 4 | 4.53 | 4.38 | 3.63 | 2.96 | Discord |
| 9. Vendor-readable orders become unacceptable | His decision | Privacy weight 5 to 20 | 4.20 | 3.98 | 3.68 | 2.83 | Discord |
| 10. Discord demands a phone check | It happens at signup | Discord identity 4 to 2 | 4.43 | 4.28 | 3.63 | 2.96 | Discord |
| 11. Reading Discord messages proves unworkable for a scheduled stack | A test in practice mode | Discord commands 4 to 2 | 4.23 | 4.28 | 3.63 | 2.96 | Tie, Telegram and Discord |
| 12. matrix.org turns on two-factor sign-in | A matrix.org page | Matrix security 2 to 4 | 4.53 | 4.28 | 3.93 | 2.96 | Discord |
| 13. Slack free keeps full history again | Slack's pricing page | Slack free 1 to 4 | 4.53 | 4.28 | 3.63 | 3.86 | Discord |
| 14. Items 1 and 2 together | Both of the above | Both changes | 4.29 | 4.43 | 3.63 | 2.96 | **Telegram** |
| 15. Items 1 and 11 together | Both of the above | Both changes | 3.99 | 4.28 | 3.63 | 2.96 | **Telegram** |

- **Read item 13 with care.** Slack rises to 3.86, still behind Discord and Telegram. Matrix stays at 3.63.
- **The cheapest test is item 1.** It costs five minutes once a Discord account exists, and it is the one fact that moves Discord closest to Telegram.

## 7. Open questions

1. **Does Discord hold phone alerts while the desktop app is open?** Only community posts say so.[^18][^75] Michael's five-minute test settles it.
2. **Does Discord keep free server history forever?** No vendor page limits it, and none promises it. Absence of a limit is not proof.
3. **How many bot applications may one Discord account own?** Not found. Two stacks need two.
4. **Does Healthchecks.io's free plan include every chat integration?** Its pricing page names no integration limit and its list has no paid marker.[^3][^1] Only text, WhatsApp and phone call sends are plan-limited.[^76]
5. **Will Discord ask Michael's account for a phone number?** It can, for accounts that look automated.[^58] The stack posts as a bot, so his human account should not trip it (my inference).
6. **Is Telegram's 20 bots per account limit real?** Only secondary sites say so.[^44] It no longer affects the pick.
7. **Does Telegram's reported deal with xAI (Grok) touch message content?** A 2025 report; whether it was finalized was not found.[^77]

## 8. Sources

77 sources, all dated 2026-10-28: 73 opened by this run (by the main session or a research helper), and 4 seen only as search result summaries (marked). Strength labels and price labels are defined in the run 3 deliverable, section 5, and mean the same here. The register ID at the end of each entry points to the fuller note, with a quote, in `runs/run-4-trajectory.md`, section 3.

[^1]: Healthchecks.io home page, Integrations list. https://healthchecks.io/ . Accessed 2026-10-28. Strength A. Register ID HC-02 in `runs/run-4-trajectory.md`.
[^2]: Discord setup template and sender code. https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/discord/templates/add_discord.html . Accessed 2026-10-28. Strength A. Register ID HC-09 in `runs/run-4-trajectory.md`.
[^3]: Plans and Pricing, Healthchecks.io. https://healthchecks.io/pricing/ . Accessed 2026-10-28. Strength A. Price label: published. Register ID HC-01 in `runs/run-4-trajectory.md`.
[^4]: Webhook resource. https://docs.discord.com/developers/resources/webhook . Accessed 2026-10-28. Strength A. Register ID DC-11 in `runs/run-4-trajectory.md`.
[^5]: Message resource. https://docs.discord.com/developers/resources/message . Accessed 2026-10-28. Strength A. Register ID DC-07 in `runs/run-4-trajectory.md`.
[^6]: What are Privileged Intents. https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents . Accessed 2026-10-28. Strength A. Register ID DC-08 in `runs/run-4-trajectory.md`.
[^7]: Getting Started (Discord support), read with Playwright for the price claim. https://support.discord.com/hc/en-us/articles/360033931551-Getting-Started . Accessed 2026-10-28. Strength A. Price label: published (free). Register ID DC-26 in `runs/run-4-trajectory.md`.
[^8]: Bots intro and Telegram FAQ. https://core.telegram.org/bots . Accessed 2026-10-28. Strength A. Price label: published (free). Register ID TG-08 in `runs/run-4-trajectory.md`.
[^9]: Bot API, getUpdates. https://core.telegram.org/bots/api . Accessed 2026-10-28. Strength A. Register ID TG-05 in `runs/run-4-trajectory.md`.
[^10]: Telegram FAQ, identity and security. https://telegram.org/faq . Accessed 2026-10-28. Strength A. Register ID TG-12 in `runs/run-4-trajectory.md`.
[^11]: Getting Started. https://support.discord.com/hc/en-us/articles/360033931551-Getting-Started . Accessed 2026-10-28. Strength A. Register ID DC-17 in `runs/run-4-trajectory.md`.
[^12]: How do I set up a private server. https://support.discord.com/hc/en-us/articles/206143407-How-do-I-set-up-a-private-server . Accessed 2026-10-28. Strength A. Register ID DC-16 in `runs/run-4-trajectory.md`.
[^13]: Setting up Multi-Factor Authentication. https://support.discord.com/hc/en-us/articles/219576828-Setting-up-Multi-Factor-Authentication . Accessed 2026-10-28. Strength A. Register ID DC-15 in `runs/run-4-trajectory.md`.
[^14]: Bot features. https://core.telegram.org/bots/features . Accessed 2026-10-28. Strength A. Register ID TG-07 in `runs/run-4-trajectory.md`.
[^15]: Discord blog, May 18, 2026. https://discord.com/blog/every-voice-and-video-call-on-discord-is-now-end-to-end-encrypted . Accessed 2026-10-28. Strength A. Register ID DC-22 in `runs/run-4-trajectory.md`.
[^16]: Privacy Policy (effective September 29, 2025). https://discord.com/privacy . Accessed 2026-10-28. Strength A. Register ID DC-23 in `runs/run-4-trajectory.md`.
[^17]: Discord status history feed. https://discordstatus.com/history.rss . Accessed 2026-10-28. Strength A. Register ID DC-24 in `runs/run-4-trajectory.md`.
[^18]: Push held back while desktop is active, community threads. https://support.discord.com/hc/en-us/community/posts/360051256154 . Accessed 2026-10-28. Strength D. Search result summary only; the page was not opened. Register ID DC-04 in `runs/run-4-trajectory.md`.
[^19]: Usage limits for free workspaces. https://slack.com/help/articles/115002422943-Usage-limits-for-free-workspaces . Accessed 2026-10-28. Strength A. Register ID SL-01 in `runs/run-4-trajectory.md`.
[^20]: matrix.org homeserver pricing. https://matrix.org/homeserver/pricing/ . Accessed 2026-10-28. Strength A. Price label: published (free plan); Premium has no price to label. Register ID MX-02 in `runs/run-4-trajectory.md`.
[^21]: Older Matrix FAQ. https://matrix.org/docs/older/faq/ . Accessed 2026-10-28. Strength A (page marked older). Register ID MX-19 in `runs/run-4-trajectory.md`.
[^22]: matrix.org Privacy Notice. https://matrix.org/legal/privacy-notice/ . Accessed 2026-10-28. Strength A. Register ID MX-07 in `runs/run-4-trajectory.md`.
[^23]: matrix.org now running MAS, April 2025. https://www.matrix.org/blog/2025/04/morg-now-running-mas/ . Accessed 2026-10-28. Strength A. Register ID MX-09 in `runs/run-4-trajectory.md`.
[^24]: Element classic to X FAQ. https://docs.element.io/latest/element-server-suite-pro/migration/classic-to-pro-mobile-apps-faq/ . Accessed 2026-10-28. Strength A. Register ID MX-18 in `runs/run-4-trajectory.md`.
[^25]: Bot API, sendMessage. https://core.telegram.org/bots/api . Accessed 2026-10-28. Strength A. Register ID TG-03 in `runs/run-4-trajectory.md`.
[^26]: Mobile Notifications Settings 101. https://support.discord.com/hc/en-us/articles/218892547--Mobile-Notifications-Settings-101 . Accessed 2026-10-28. Strength A. Register ID DC-01 in `runs/run-4-trajectory.md`.
[^27]: Notifications Settings 101. https://support.discord.com/hc/en-us/articles/215253258-Notifications-Settings-101 . Accessed 2026-10-28. Strength A. Register ID DC-02 in `runs/run-4-trajectory.md`.
[^28]: Configure your Slack notifications. https://slack.com/help/articles/201355156-Configure-your-Slack-notifications . Accessed 2026-10-28. Strength A. Register ID SL-08 in `runs/run-4-trajectory.md`.
[^29]: Element push gateway (Element docs). https://ems-docs.element.io/books/element-on-premise-documentation/page/notifications-mdm-push-gateway . Accessed 2026-10-28. Strength A. Register ID MX-13 in `runs/run-4-trajectory.md`.
[^30]: Community notification reports (GrapheneOS, /e/OS). https://discuss.grapheneos.org/d/20519-notifications-not-working-in-background . Accessed 2026-10-28. Strength D. Search result summary only; the page was not opened. Register ID MX-17 in `runs/run-4-trajectory.md`.
[^31]: Bots FAQ. https://core.telegram.org/bots/faq . Accessed 2026-10-28. Strength A. Register ID TG-01 in `runs/run-4-trajectory.md`.
[^32]: Rate limits. https://docs.discord.com/developers/topics/rate-limits . Accessed 2026-10-28. Strength A. Register ID DC-09 in `runs/run-4-trajectory.md`.
[^33]: Rate limits. https://docs.slack.dev/apis/web-api/rate-limits . Accessed 2026-10-28. Strength A. Register ID SL-04 in `runs/run-4-trajectory.md`.
[^34]: Client-server API spec. https://spec.matrix.org/latest/client-server-api/ . Accessed 2026-10-28. Strength A. Register ID MX-06 in `runs/run-4-trajectory.md`.
[^35]: Bots FAQ, getting updates. https://core.telegram.org/bots/faq . Accessed 2026-10-28. Strength A. Register ID TG-04 in `runs/run-4-trajectory.md`.
[^36]: Bot API, setWebhook. https://core.telegram.org/bots/api . Accessed 2026-10-28. Strength A. Register ID TG-06 in `runs/run-4-trajectory.md`.
[^37]: Gateway. https://docs.discord.com/developers/events/gateway . Accessed 2026-10-28. Strength A. Register ID DC-05 in `runs/run-4-trajectory.md`.
[^38]: Receiving and responding to interactions. https://docs.discord.com/developers/interactions/receiving-and-responding . Accessed 2026-10-28. Strength A. Register ID DC-06 in `runs/run-4-trajectory.md`.
[^39]: Using Socket Mode. https://docs.slack.dev/apis/events-api/using-socket-mode . Accessed 2026-10-28. Strength A. Register ID SL-09 in `runs/run-4-trajectory.md`.
[^40]: Slash commands. https://docs.slack.dev/interactivity/implementing-slash-commands . Accessed 2026-10-28. Strength A. Register ID SL-11 in `runs/run-4-trajectory.md`.
[^41]: conversations.history reference. https://docs.slack.dev/reference/methods/conversations.history . Accessed 2026-10-28. Strength A. Register ID SL-07 in `runs/run-4-trajectory.md`.
[^42]: Rate limit changes for non-Marketplace apps, 2025-05-29. https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps . Accessed 2026-10-28. Strength A. Register ID SL-05 in `runs/run-4-trajectory.md`.
[^43]: Feature limitations on the free version of Slack. https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack . Accessed 2026-10-28. Strength A. Register ID SL-02 in `runs/run-4-trajectory.md`.
[^44]: Bots per account, secondary sites. https://helpdesk.bitrix24.com/open/17622486/ . Accessed 2026-10-28. Strength C/D. Search result summary only; the page was not opened. Register ID TG-10 in `runs/run-4-trajectory.md`.
[^45]: Opcodes and status codes. https://docs.discord.com/developers/topics/opcodes-and-status-codes . Accessed 2026-10-28. Strength A. Register ID DC-10 in `runs/run-4-trajectory.md`.
[^46]: Premium FAQ. https://telegram.org/faq_premium . Accessed 2026-10-28. Strength A. Price label: gated and unverified (not on the page). Register ID TG-09 in `runs/run-4-trajectory.md`.
[^47]: Nitro. https://discord.com/nitro . Accessed 2026-10-28. Strength A. Price label: published. Register ID DC-12 in `runs/run-4-trajectory.md`.
[^48]: Slack pricing. https://slack.com/pricing . Accessed 2026-10-28. Strength A. Price label: published. Register ID SL-03 in `runs/run-4-trajectory.md`.
[^49]: Telegram Integration for Healthchecks.io. https://healthchecks.io/integrations/telegram/ . Accessed 2026-10-28. Strength A. Register ID HC-03 in `runs/run-4-trajectory.md`.
[^50]: Slack integration page. https://healthchecks.io/integrations/add_slack/ . Accessed 2026-10-28. Strength A. Register ID HC-05 in `runs/run-4-trajectory.md`.
[^51]: Matrix setup template. https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/matrix/templates/add_matrix.html . Accessed 2026-10-28. Strength A. Register ID HC-07 in `runs/run-4-trajectory.md`.
[^52]: Matrix sender code. https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/matrix/transport.py . Accessed 2026-10-28. Strength A. Register ID HC-08 in `runs/run-4-trajectory.md`.
[^53]: Bot API, Message object. https://core.telegram.org/bots/api . Accessed 2026-10-28. Strength A. Register ID TG-13 in `runs/run-4-trajectory.md`.
[^54]: Application commands. https://docs.discord.com/developers/interactions/application-commands . Accessed 2026-10-28. Strength A. Register ID DC-13 in `runs/run-4-trajectory.md`.
[^55]: Verifying requests from Slack. https://docs.slack.dev/authentication/verifying-requests-from-slack . Accessed 2026-10-28. Strength A. Register ID SL-12 in `runs/run-4-trajectory.md`.
[^56]: Set up two-factor authentication. https://slack.com/help/articles/204509068-Set-up-two-factor-authentication . Accessed 2026-10-28. Strength A. Register ID SL-13 in `runs/run-4-trajectory.md`.
[^57]: Switch between workspaces. https://slack.com/help/articles/1500002200741-Switch-between-workspaces . Accessed 2026-10-28. Strength A. Register ID SL-15 in `runs/run-4-trajectory.md`.
[^58]: How to Verify Your Discord Account. https://support.discord.com/hc/en-us/articles/6181726888215-How-to-Verify-Your-Discord-Account . Accessed 2026-10-28. Strength A. Register ID DC-18 in `runs/run-4-trajectory.md`.
[^59]: Create a Slack workspace. https://slack.com/help/articles/206845317-Create-a-Slack-workspace . Accessed 2026-10-28. Strength A. Register ID SL-16 in `runs/run-4-trajectory.md`.
[^60]: matrix.org Terms and Conditions. https://matrix.org/legal/terms-and-conditions/ . Accessed 2026-10-28. Strength A. Register ID MX-01 in `runs/run-4-trajectory.md`.
[^61]: Account Switcher FAQ. https://support.discord.com/hc/en-us/articles/4412732047127-Discord-Account-Switcher-FAQ . Accessed 2026-10-28. Strength A. Register ID DC-19 in `runs/run-4-trajectory.md`.
[^62]: Element X Android releases. https://github.com/element-hq/element-x-android/releases . Accessed 2026-10-28. Strength A. Register ID MX-10 in `runs/run-4-trajectory.md`.
[^63]: Element X iOS releases. https://github.com/element-hq/element-x-ios/releases . Accessed 2026-10-28. Strength A. Register ID MX-11 in `runs/run-4-trajectory.md`.
[^64]: End-to-end encryption. https://core.telegram.org/api/end-to-end . Accessed 2026-10-28. Strength A. Register ID TG-14 in `runs/run-4-trajectory.md`.
[^65]: Enterprise Key Management. https://slack.com/resources/why-use-slack/slack-enterprise-key-management . Accessed 2026-10-28. Strength A. Register ID SL-17 in `runs/run-4-trajectory.md`.
[^66]: Privacy Policy. https://telegram.org/privacy . Accessed 2026-10-28. Strength A. Register ID TG-11 in `runs/run-4-trajectory.md`.
[^67]: Privacy principles. https://slack.com/trust/data-management/privacy-principles . Accessed 2026-10-28. Strength A. Register ID SL-18 in `runs/run-4-trajectory.md`.
[^68]: Element privacy. https://element.io/privacy . Accessed 2026-10-28. Strength A. Register ID MX-15 in `runs/run-4-trajectory.md`.
[^69]: Guild resource. https://docs.discord.com/developers/resources/guild . Accessed 2026-10-28. Strength A. Register ID DC-03 in `runs/run-4-trajectory.md`.
[^70]: Community Guidelines (effective September 29, 2025). https://discord.com/guidelines . Accessed 2026-10-28. Strength A. Register ID DC-20 in `runs/run-4-trajectory.md`.
[^71]: How to Confirm Your Age Group. https://support.discord.com/hc/en-us/articles/30326565624343-How-to-Confirm-Your-Age-Group-on-Discord . Accessed 2026-10-28. Strength A. Register ID DC-25 in `runs/run-4-trajectory.md`.
[^72]: Community discussion. https://github.com/element-hq/element-meta/discussions/1832 . Accessed 2026-10-28. Strength D. Register ID MX-12 in `runs/run-4-trajectory.md`.
[^73]: Outage post-mortem, matrix.org blog, October 2025. https://matrix.org/blog/2025/10/post-mortem/ . Accessed 2026-10-28. Strength A. Register ID MX-21 in `runs/run-4-trajectory.md`.
[^74]: Incoming webhooks. https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks . Accessed 2026-10-28. Strength A. Register ID SL-14 in `runs/run-4-trajectory.md`.
[^75]: Search for an official Discord article on push while the desktop app is active (community threads only). https://support.discord.com/hc/en-us/community/posts/360042550012-Notifications-On-Mobile-When-Desktop-is-open . Accessed 2026-10-28. Strength D. Search result summary only; the page was not opened. Register ID DS-01 in `runs/run-4-trajectory.md`.
[^76]: Configuring Notifications (Healthchecks.io docs). https://healthchecks.io/docs/configuring_notifications/ . Accessed 2026-10-28. Strength A. Register ID HC-04 in `runs/run-4-trajectory.md`.
[^77]: xAI and Grok deal, TechCrunch, 2025-05-28. https://techcrunch.com/2025/05/28/xai-to-invest-300m-in-telegram-integrate-grok-into-app . Accessed 2026-10-28. Strength B. Register ID TG-17 in `runs/run-4-trajectory.md`.
