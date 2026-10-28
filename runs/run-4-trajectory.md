# Run 4 trajectory: choose the messaging app

Research input for a human decision, never an instruction to act.

## 1. The brief as given

# Run 4 brief: choose the messaging app

## Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:

- Launched from `~/Projects/sib-tech` in a fresh session.
- Model: latest Opus, high effort. Advisor: on, latest Opus. Auto-mode: on.
- Playwright MCP confirmed connected with `/mcp` before pasting.
- Copied from the raw file in TextEdit.

## What changed from the previous run

Lever changed: instructions. Run 4 asks a new, narrow question that runs 1 to 3 did not: which one mobile app should carry the stack's alerts, regular messages and commands.

Why: run 3's example setups use Telegram, but the run chose it without comparing it to anything (Telegram was named for being free, two-way and supported by the heartbeat service). Michael wants a real comparison before anything is built.

Context carried forward, unchanged: everything in `runs/run-3-brief.md` and `runs/run-3-correction-brief.md`, and the corrected `runs/run-3-deliverable.md`. The corrected pick is option C, the always-on worker.

## Step zero: save this brief

Before anything else, write this entire brief, verbatim and unedited, to `runs/run-4-brief.md`. Then create `runs/run-4-trajectory.md` and paste this brief into its first section.

## The goal

When this run is done, Michael can pick one free mobile app that does all three jobs for every stack he builds:

1. Heartbeat alerts: the heartbeat service reaches his phone when a run is missed or a worker stops pinging.
2. Regular messages from the stack: the live list, orders and fills, refusals, errors, the daily summary.
3. Commands to the stack: at least stop and status, sent from his phone.

He sees your strongest pick and why, and every claim traces to a dated live source.

### Candidates

- Telegram, Discord and Slack, on their free plans.
- One more of your choosing. Say why you chose it.

### What you need to know

- Michael is a non-coder. He reads these messages on his phone.
- He may build two stacks and compare them, each with its own trading strategy. The app must keep each stack's messages and commands separate (for example one bot, server, channel or workspace per stack), so that a command meant for one stack can never reach another.
- Michael plans for each stack to run on accounts tied to a sib-tech email domain he will create in Google Workspace, not his personal email.
- Commands can stop an agent that trades with real and borrowed money. Who is allowed to send a command matters.
- The stop command must work even when Claude is down, because Claude is not in the control path in run 3's designs.
- Heartbeat service in run 3's setups: Healthchecks.io. You may compare others only if an app has no Healthchecks.io integration.

### Questions every candidate must answer

- Push alerts: do they reliably reach the phone, including when the app is in the background? Any documented delays or limits on bot messages?
- Two-way commands: can a bot receive a command from Michael's phone and pass it to the stack? How?
- Free tier limits: message history, number of bots or integrations, rate limits, anything that would push him to a paid plan. Weight this criterion more heavily than the others: Michael values a free app that keeps full history over one that charges for it.
- Heartbeat integration: does Healthchecks.io (or the chosen heartbeat service) send alerts to it natively?
- Command security: how can only Michael's account send commands? Two-factor sign-in, bot allowlists, private channels.
- Separation: how each app keeps two or more stacks apart.
- Account identity: how each app handles an account created with a custom domain email (for example a sib-tech Google Workspace address) instead of a personal one. Does it require a phone number? Can one person hold separate accounts or workspaces per stack?
- Privacy: does the vendor read or train on message content? Is it encrypted?

You choose the criteria and weights from these, and show them. Free tier limits must carry more weight than any other single criterion.

## The sources

Use:
- Live web research, and Playwright for pages that need JavaScript.
- `runs/run-3-deliverable.md` and `runs/run-3-correction-trajectory.md` for the stack designs the app must serve. Read the corrected deliverable's "How Michael uses it" sections before researching.

Ignore:
- Anything in `~/Projects/relii`.
- Your own recalled knowledge as evidence. Every capability and limit needs a live source.

Source strength and gated pricing: the same scale and labels as runs 1 to 3.

## The output

Build in this order: markdown and trajectory first, then the HTML.

### `runs/run-4-deliverable.md`, the source of record

1. Summary: your strongest pick and why, in bullets.
2. Criteria and weights, with a reason for each.
3. A comparison table: every candidate against every question above.
4. One section per candidate: how it would carry the three jobs, how two stacks stay separate, how commands are secured, free tier limits, account identity, pros, cons, and its failure mode (the most likely way it breaks or disappoints).
5. What Michael does to set it up, as bullets, and what CC would build.
6. Falsifiability: what evidence would overturn the pick.
7. Open questions.
8. Sources, numbered footnotes, same format as run 3.

Formatting: bullets and tables, no paragraph longer than three sentences, plain English, acronyms defined, no em or en dashes. State that this is research input for a human decision.

### Changes to run 3's files

- Add a "Messaging" tab to `runs/run-3-deliverable.html`, built from `runs/run-4-deliverable.md`. Keep run 3's look and feel exactly. Footnotes in the tab link to run 4's sources.
- If your pick is not Telegram, also update `runs/run-3-deliverable.md` in place, and rebuild its HTML:
  - every example setup's tool table and totals
  - every "How Michael uses it" section
  - every other mention of Telegram as the alert or command channel
  - add a dated "Update, run 4" block under the title listing each change
- If your pick is Telegram, change nothing in run 3's markdown beyond a one-line note under the title pointing to run 4.
- Test the page in a browser with Playwright (serve it locally): every tab, including the new one.

## The standard

Michael accepts the work when all of these hold:

1. Every connector claim traced to a live source with an access date.
2. Pricing verified rather than recalled.
3. Each option's failure mode named.
4. The recommendation falsifiable, stating what evidence would overturn it.

Before writing any conclusion, score and rank every candidate by script, and re-rank all of them for every falsifiability item.

## Documenting your work: `runs/run-4-trajectory.md`

Append as you work, not at the end. Six parts: the brief as given, the sequence of what you did, sources with URL and access date, decision points, dead ends, and a self-assessment against the standard. Do not record time spent or token cost.

## Run conventions

- Files: `runs/run-4-brief.md`, `runs/run-4-deliverable.md`, `runs/run-4-trajectory.md`, the updated `runs/run-3-deliverable.html`, and the updated `runs/run-3-deliverable.md` if your pick is not Telegram.
- Add one line to `runs/README.md`: "4", the date, "instructions: new question, the messaging app", outcome.
- Update `PROJECT_STATE.md`: the Runs table (lever "instructions"), Current Stage and Next Steps.
- Check the date with `date` before writing any date.
- Done means all files written, the page browser-tested, the index and PROJECT_STATE.md updated, and one commit and one push. Auto-mode's carve-out covers that commit and push.
- Then end the session.

## Prohibitions

- No account creation and no signups, anywhere. Do not create a bot, server, workspace or channel.
- No scaffolding, no package managers, nothing installed, no database.
- No connector or MCP server configured for the future agent itself.
- No credentials, API keys or account numbers in any file or commit message.
- No reading anything in `~/Projects/relii`.
- Never send Michael's name, email address or any other personal information to any website or service, including in request headers. Do not disguise automated requests as a regular web browser. If a page refuses plain requests, read it with Playwright or skip it and record it. Give this rule, word for word, to any helper you start.


## 2. Sequence of what was done

1. Read PROJECT_STATE.md and runs/README.md (start-of-session rule). Checked the date: Wed Oct 28 2026, America/Chicago.
2. Saved the brief verbatim to runs/run-4-brief.md and created this file with the brief in section 1.
3. Read the corrected run 3 deliverable: the correction block, section 5 (source strength and price labels), every "How Michael uses it" section (options B, C, D, F), every tool table row naming Telegram, Healthchecks.io or Pushover, and footnotes 10, 11 and 106.
4. Called the advisor before research. Its advice taken: verify Healthchecks.io live first; check how each app's bot receives commands under both a scheduled run (options B, F) and an always-on worker (options C, D); weight free tier limits highest and assert it in the script; check encryption for bot chats specifically; name each failure mode; give helpers the prohibition word for word plus a no spoofed browser rule; prefix the new tab's footnote anchors.
5. Healthchecks.io, live: pricing page (Hobbyist free, 20 checks, 100 log entries per job; Supporter 5 dollars; Business 20 dollars). The /integrations/ address returned 404. The notifications doc page names only Slack, WhatsApp and Pushover. The home page lists 27 integrations, including Telegram, Discord, Slack, Matrix, Mattermost, Zulip, Signal, Google Chat, Rocket.Chat, Microsoft Teams, ntfy and Pushover, with no paid-only marker. The Telegram integration page (/integrations/telegram/) loaded; the same pattern for discord, slack and matrix returned 404.
6. Chose the fourth candidate: Matrix, read on the Element app (decision D1). Started four research helpers in parallel, one per app, each given the prohibition word for word.
7. Built a Markdown to HTML renderer in the session scratch folder (not in the repo). Proven: on the current `runs/run-3-deliverable.md` (up to section 14) it reproduces the page's document body byte for byte. It turns `[^n]` into run 3's footnote links and takes another footnote format for the new tab.
8. Telegram and Slack helpers returned (TG-01 to TG-19, SL-01 to SL-19). Logged in section 3.
9. Matrix helper returned (MX-01 to MX-21). Logged in section 3.
10. Discord helper returned (DC-01 to DC-25). Logged in section 3. All four helpers done.
11. Wrote the scoring script in the session scratch folder (not in the repo, so its method is recorded here). Eight criteria with weights 30, 15, 15, 12, 10, 8, 5, 5 (sum 100). Total = each score times its weight, summed, divided by the sum of the weights, rounded half up to two places. The script asserts, for every weighting it runs, that free tier limits outweigh every other single criterion. Tie rule as run 3: "first, or within 0.10 of first". It runs 8 weightings and 15 falsifiability items.
12. First run: Telegram 4.43, Discord 4.41, Matrix 3.63, Slack 2.96, a tie. Called the advisor before any conclusion. It found three scores where the same kind of fact may have been scored two ways (push, security route, the Telegram 24 hour drop) and said to audit them, not break the tie by judgment yet. Also: the sib-tech email plan is a stated fact, not a hypothetical, so falsifiability item 8 was replaced by its inverse.
13. One targeted search for an official Discord page on phone alerts while the desktop app is open (support.discord.com and discord.com only). It found community threads only (strength D), no help article. Recorded in section 5.
14. Audit applied (decisions D4 to D6). Second run: Discord 4.53, Telegram 4.28, Matrix 3.63, Slack 2.96. Discord is first in 8 of 8 weightings. Items 5 (Discord history cap) and 14 and 15 (two items together) make Telegram the pick; items 1, 2, 7 and 11 make a tie. Full output is in section 7 of this file.
15. Verified that Discord itself is free on a live Discord page (DC-26). Then wrote the deliverable.
16. Wrote `runs/run-4-deliverable.md`. Footnotes were drafted as register IDs and numbered by script in order of first use (77 sources), each source line generated from this file's section 3. Fixed three register entries that lacked a web address or had the wrong strength picked up. Checked by script: no em or en dashes, no paragraph or bullet over three sentences (two Cons bullets split), and the sensitivity and falsifiability tables match the scoring script (8 and 15 rows, 0 mismatches).
17. Updated `runs/run-3-deliverable.md` in place (the pick is not Telegram): a script of 22 exact replacements, each required to match exactly once, plus the five identical tool table rows (options B and C, both setups; option D, setup 1). Added a dated "Update, run 4, 2026-10-28" block under the title listing each change, footnotes 131 to 133 (dated 2026-10-28, citing run 4 sources), a note on footnote 10 that it is no longer cited, and the new source count (133). Costs, totals, hours, scores and the pick are unchanged. Remaining "Telegram" mentions are only in the update block and the historical footnote 10. Changed lines checked by script: no dashes, none over three sentences (the source count paragraph was split to stay within it).
18. Rebuilt `runs/run-3-deliverable.html` by script from a saved copy of the old page. The script first checked that the renderer reproduces the old document body, contents list and Sources tab byte for byte from the old markdown, then re-rendered all three from the updated markdown; appended sources 131 to 133 to the page's source data and marked source 10; added a "Messaging" tab (button after "Daily use") built from `runs/run-4-deliverable.md`. The tab's heading ids carry an "m-" prefix and its footnotes link to its own source list ("r4src-" anchors, a separate run 4 source table) so they never collide with run 3's numbers. The click handler now opens a run 4 source when a footnote carries the run 4 marker. The header note gained two sentences. Styles, layout, themes and other views are untouched.
19. Browser test with Playwright against a local server (python3 -m http.server, 127.0.0.1 only, stopped afterwards). All 9 tabs switch and show content, exactly one view visible at a time. Daily use for B, C, D and F shows Discord and no Telegram. A run 4 footnote opens "Run 4 source 5" (Discord message resource); run 3 footnotes 22 and 131 open their sources; all 200 footnotes in the Messaging tab resolve to an anchor; source 133 is in the Sources tab. Console: one error only, the local server's missing favicon.ico (not part of the page). At phone width (390 pixels), the Messaging tab first overflowed (long web addresses in its source list); fixed by letting those lines wrap. Run 3's own Sources tab overflows sideways at phone width (758 pixels) and did so before this run; left unchanged to keep run 3's look and feel, recorded in section 5.
20. Called the advisor before committing. Three fixes taken: four sources (DC-04, DS-01, TG-10, MX-17) were seen only as search summaries but the source list said every source was opened, so each is now marked "Search result summary only; the page was not opened" and the counts read 73 opened, 4 summaries; "full history" for Discord and Telegram became "no history limit found" (no vendor page promises full history), in run 4 and in run 3's update block; "natively, on its free plan" for Healthchecks.io became "no plan restriction was found". Rebuilt the deliverable and the page, re-checked (no dashes, no long items, tables match the script) and re-tested in the browser.

## 3. Sources

(Appended as accessed. Full numbered list also in the deliverable, section 8.)
Healthchecks.io, opened by the main session. All accessed 2026-10-28.

- HC-01. Plans and Pricing, Healthchecks.io. https://healthchecks.io/pricing/ . Hobbyist "$0", "Monitor 20 jobs", "100 log entries per job"; Supporter 5 dollars a month with the same limits; Business 20 dollars. No per-integration plan restriction stated. Strength A. Price label: published.
- HC-02. Healthchecks.io home page, Integrations list. https://healthchecks.io/ . "Set up multiple ways to get notified:" then 27 names, including Slack, Discord, Matrix, Mattermost, Signal, Telegram, Zulip, Google Chat, Rocket.Chat, Microsoft Teams, ntfy, Pushover. No paid-only marker. Read with WebFetch and again with Playwright. Strength A.
- HC-03. Telegram Integration for Healthchecks.io. https://healthchecks.io/integrations/telegram/ . Works in a private chat ("start a conversation with HealthchecksBot"), a group ("added as a member with no access to group messages") or a channel (admin with "Post Messages" only). Setup: /start, confirmation link, choose project. Strength A.
- HC-04. Configuring Notifications (Healthchecks.io docs). https://healthchecks.io/docs/configuring_notifications/ . SMS, WhatsApp and phone call sends have a monthly limit: "The specific limit depends on the account's billing plan." Chat integrations are not quota-limited on this page. Strength A.
- HC-05. Slack integration page. https://healthchecks.io/integrations/add_slack/ . "Add to Slack" button, then "Select the channel you want to post Healthchecks.io notifications to." Strength A.
- HC-06. Healthchecks README (open source code of the same service). https://github.com/healthchecks/healthchecks/blob/master/README.md . Discord integration needs a Discord app "Client ID and Client Secret"; Matrix integration posts as "a bot user" on a homeserver; Slack has a "legacy flow" (incoming webhook) and an app flow ("OAuth2 behind the scenes"). Strength A (vendor's own code repository).
- HC-07. Matrix setup template. https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/matrix/templates/add_matrix.html . "Invite {{ matrix_user_id }} into your Matrix room."; "will be able to read its messages."; "Do not invite to rooms with sensitive content."; room entered by "Published Address or the Internal Room ID". Strength A.
- HC-08. Matrix sender code. https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/matrix/transport.py . Sends a plain "m.room.message" via "/_matrix/client/v3/rooms/{room_id}/send/"; no Olm, Megolm or "m.room.encrypted" code. So Healthchecks.io alerts in Matrix are not end-to-end encrypted (my reading of the code). Strength A.
- HC-09. Discord setup template and sender code. https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/discord/templates/add_discord.html and .../discord/transport.py . "will send a notification to a Discord channel when a check goes up or down"; "Connect Discord" button; posts to a stored "discord_webhook_url". Strength A.
- HC-10. Telegram sender code. https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/telegram/transport.py . Uses Telegram's "sendMessage"; a local rate limiter ("Rate limit exceeded"); treats "Forbidden: bot was blocked by the user" as permanent. Strength A.

Telegram, from the Telegram helper. All accessed 2026-10-28, read with WebFetch. Quotes are as the helper returned them; WebFetch can paraphrase lightly.

- TG-01. Bots FAQ. https://core.telegram.org/bots/faq . "In a single chat, avoid sending more than one message per second."; "In a group, bots are not be able to send more than 20 messages per minute."; about 30 messages per second across all chats, then "429 errors". Strength A.
- TG-02. Bots FAQ, paid broadcasts. https://core.telegram.org/bots/faq . Up to 1000 messages per second at "0.1 Stars per message", needs "at least 100,000 Stars on its balance and at least 100,000 monthly active users". Not relevant to one owner. Strength A. Price label: published (in Stars).
- TG-03. Bot API, sendMessage. https://core.telegram.org/bots/api . disable_notification: "Sends the message silently. Users will receive a notification with no sound." Strength A.
- TG-04. Bots FAQ, getting updates. https://core.telegram.org/bots/faq . "There are currently two ways of getting updates."; "it's not possible to get updates via long polling while an outgoing Webhook is set." Strength A.
- TG-05. Bot API, getUpdates. https://core.telegram.org/bots/api . "Incoming updates are stored on the server until the bot receives them either way, but they will not be kept longer than 24 hours."; timeout "Defaults to 0, i.e. usual short polling."; fetched updates "will be marked as confirmed on the server and will no longer be returned." Strength A. Inference (helper's and mine): a program that runs once a minute and exits can collect a stop command with no always-on process.
- TG-06. Bot API, setWebhook. https://core.telegram.org/bots/api . "HTTPS URL to send updates to."; "Ports currently supported for webhooks: 443, 80, 88, 8443." Strength A.
- TG-07. Bot features. https://core.telegram.org/bots/features . Commands "must always start with the / symbol and contain up to 32 characters"; "/setcommands"; "Privacy mode is enabled by default for all bots, except bots that were added to a group as admins."; usernames "used in search, mentions and t.me links"; token "is required to authorize the bot and send requests to the Bot API." Strength A.
- TG-08. Bots intro and Telegram FAQ. https://core.telegram.org/bots and https://telegram.org/faq . Bots "free for both users and developers"; "private messaging on Telegram is free and will stay free"; "Cloud chat data is stored in multiple data centers around the globe."; "Bots can't start conversations with users." No history retention limit found. Strength A. Price label: published (free).
- TG-09. Premium FAQ. https://telegram.org/faq_premium . "All free functionality will remain exactly as it was before subscribing." Premium price not shown (varies by country). Strength A. Price label: gated and unverified (not on the page).
- TG-10. Bots per account, secondary sites. https://helpdesk.bitrix24.com/open/17622486/ . Limit of 20 seen only in search summaries of secondary sites (Bitrix24 help center, vc.ru, Habr), pages not opened. Strength C/D. Not found on Telegram's own pages.
- TG-11. Privacy Policy. https://telegram.org/privacy . Accounts that "do not come online for at least 18 months" are deleted by default; "we may also use automated algorithms to analyze messages in cloud chats to stop spam and phishing."; "Bots will obviously get your messages"; may give "your IP address and phone number to the relevant authorities" on "a valid order from the relevant judicial authorities". No AI training statement. Strength A.
- TG-12. Telegram FAQ, identity and security. https://telegram.org/faq . "Telegram accounts can only be connected to a mobile number."; "Each phone number is a separate account"; "It is possible to log in to one Telegram app with several different accounts at once."; two-step verification: "you will need both an SMS code and a password to log in."; Telegram's own AI features "never send any data to third parties". Strength A.
- TG-13. Bot API, Message object. https://core.telegram.org/bots/api . from: "Sender of the message"; chat: "Unique identifier for this chat." The program checks the sender's numeric ID (standard practice, my inference). Strength A.
- TG-14. End-to-end encryption. https://core.telegram.org/api/end-to-end . "Secret Chats are one-on-one chats wherein messages are encrypted with a key held only by the chat's participants." Bot chats are cloud chats, not end-to-end encrypted (inference: no page says bots can use secret chats). Strength A.
- TG-15. Fragment anonymous numbers. https://telegram.org/blog/ultimate-privacy-topics-2-0 (dated December 6, 2022) and https://core.telegram.org/api/fragment . "You can have a Telegram account without a SIM card"; price not checked. Strength A. Price label: gated and unverified (fragment.com not opened).
- TG-16. Login email. https://translations.telegram.org/en/android/login/AddEmailSubtitle . Seen in search results only, page not opened. Strength A, indirect.
- TG-17. xAI and Grok deal, TechCrunch, 2025-05-28. https://techcrunch.com/2025/05/28/xai-to-invest-300m-in-telegram-integrate-grok-into-app . "xAI will pay $300 million in cash and equity to the chat app". Whether finalized: not found. Strength B.
- TG-18. Outage report, ETV Bharat, 2026-09-08. https://www.etvbharat.com/en/technology/telegram-down-users-across-india-us-singapore-report-disruptions-enn26090801251 . "280 users reported problems with Telegram, peaking at 8:05 AM." Strength B.
- TG-19. Terms of Service. https://telegram.org/tos . Breaking the terms "may result in a temporary or a permanent ban from Telegram." Strength A.
- Not found (Telegram): an official status page, documented push delays, an official bots-per-account limit, a Premium price on a vendor page.

Slack, from the Slack helper. All accessed 2026-10-28.

- SL-01. Usage limits for free workspaces. https://slack.com/help/articles/115002422943-Usage-limits-for-free-workspaces . "You can view and search messages and files from the last 90 days."; "Messages and files more than one year old will be permanently deleted."; "You can add up to 10 third-party or custom apps." Strength A.
- SL-02. Feature limitations on the free version of Slack. https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack . "we'll begin deleting messages and files more than one year old from free workspaces" (from August 26, 2024). Strength A.
- SL-03. Slack pricing. https://slack.com/pricing . Free: "Messages are saved and searchable for 90 days", "Up to 10 apps". Pro 8.75 dollars per user per month monthly, 7.25 annually; Business+ 18 or 15. Prices read from the plan table, no verbatim quote. Strength A. Price label: published.
- SL-04. Rate limits. https://docs.slack.dev/apis/web-api/rate-limits . "no more than one message per second per channel"; incoming webhooks "1 per second", "Short bursts >1 allowed". Strength A.
- SL-05. Rate limit changes for non-Marketplace apps, 2025-05-29. https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps . "Internal customer-built applications are not impacted by these changes." Strength A.
- SL-06. Rate limits clarity, 2025-06-03. https://docs.slack.dev/changelog/2025/06/03/rate-limits-clarity . "Any internal customer-built apps will maintain their existing rate limits". Strength A.
- SL-07. conversations.history reference. https://docs.slack.dev/reference/methods/conversations.history . "Tier 3: 50+ per minute". Strength A.
- SL-08. Configure your Slack notifications. https://slack.com/help/articles/201355156-Configure-your-Slack-notifications . Phone alerts while active on desktop come "one minute after locking your desktop screen or 10 minutes after Slack stops detecting cursor activity"; an "Immediately, even if I'm active" setting exists; "Outside of the schedule you set, your notifications will be paused." Strength A.
- SL-09. Using Socket Mode. https://docs.slack.dev/apis/events-api/using-socket-mode . "you'll need to handle connection refreshes once every few hours." Needs a connected process. Strength A.
- SL-10. Events API. https://docs.slack.dev/apis/events-api/ . "Your app should respond to the event request with an HTTP 2xx within three seconds." Strength A.
- SL-11. Slash commands. https://docs.slack.dev/interactivity/implementing-slash-commands . "This confirmation must be received by Slack within 3000 milliseconds."; user_id is "The ID of the user who triggered the command." Strength A.
- SL-12. Verifying requests from Slack. https://docs.slack.dev/authentication/verifying-requests-from-slack . "Slack signs its requests using a secret unique to your app." Strength A.
- SL-13. Set up two-factor authentication. https://slack.com/help/articles/204509068-Set-up-two-factor-authentication . "If you're a member of more than one Slack workspace, you'll need to set up 2FA for each account separately." Strength A.
- SL-14. Incoming webhooks. https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks . "Your webhook URL contains a secret."; "You cannot override the default channel". Strength A.
- SL-15. Switch between workspaces. https://slack.com/help/articles/1500002200741-Switch-between-workspaces . "If you're signed in to more than one Slack workspace, you can easily switch between them." Strength A.
- SL-16. Create a Slack workspace. https://slack.com/help/articles/206845317-Create-a-Slack-workspace . "make sure to use an email address from your company's domain to create your workspace."; "continue with Apple or Google". No phone number mentioned. Strength A.
- SL-17. Enterprise Key Management. https://slack.com/resources/why-use-slack/slack-enterprise-key-management . "By default, Slack encrypts data at rest and data in transit". Not end-to-end; customer keys are an Enterprise add-on. Strength A.
- SL-18. Privacy principles. https://slack.com/trust/data-management/privacy-principles . "Slack will not use Customer Data to train generative AI models unless Customer provides affirmative opt-in consent."; non-generative global models use customer data unless an owner opts out by email. Strength A.
- SL-19. Slack status. https://slack-status.com/ . "Slack is up and running". Strength A.
- Not found (Slack): a definition of "internal customer-built app"; a way to restrict a slash command to named users (the program checks user_id itself); whether a phone number is ever required.

Matrix and Element, from the Matrix helper. All accessed 2026-10-28.

- MX-01. matrix.org Terms and Conditions. https://matrix.org/legal/terms-and-conditions/ . "Access to paid Usage Plans and services is subject to the payment of fees" (6.1); "have a valid, verified email address linked to your account" and "you must be 18 years of age or older" (2.1); limits by "individual transfer size limits, and cumulative data usage" (7.2); bans "unsolicited or bulk communications" (7.1); "Scanning unencrypted media with Cloudflare's CSAM scanning tool" (3.2); no liability for failure "to store your materials on the matrix.org homeserver at any time" (4.1). Strength A.
- MX-02. matrix.org homeserver pricing. https://matrix.org/homeserver/pricing/ . Free plan: "10MB maximum per attachment", "100MB per 24 hours, up to 500MB per 28 days"; Premium: "Details of pricing have not yet been finalised"; users not on a plan "may be changed to a free plan in the future, and will be notified in advance." Strength A. Price label: published (free plan); Premium has no price to label.
- MX-03. Funding and Premium, matrix.org blog, June 2025. https://matrix.org/blog/2025/06/funding-homeserver-premium/ . Aim "for the most active users to support the cost of the service"; limits "mostly around media." Strength A.
- MX-04. Terms update, matrix.org blog, July 2025. https://matrix.org/blog/2025/07/terms-update/ . "the terms will be effective on the 14th of August for existing users". Strength A.
- MX-05. Element pricing. https://element.io/pricing . Community plan "Free of charge frontend and backend" for "Non-professional deployments and evaluations"; Enterprise "Priced per seat/month". No paid personal plan. Strength A. Price label: published.
- MX-06. Client-server API spec. https://spec.matrix.org/latest/client-server-api/ . "Homeservers SHOULD implement rate limiting"; /sync `since`: "the next_batch token returned by an earlier call"; `limited`: "True if the number of events returned was limited by the limit on the filter"; `sender`: "the fully-qualified ID of the user who sent this event"; join rule invite: "a user must first receive an invite". Strength A.
- MX-07. matrix.org Privacy Notice. https://matrix.org/legal/privacy-notice/ . "Your verified telephone number (if you choose to provide it)"; unencrypted data "is stored in the format it was received on our servers"; "Your IP address is logged"; logs kept "not longer than 180 days"; Element "unable to read your message content" when encrypted; "We do not profile users". No mention of AI training. Strength A.
- MX-08. Authentication changes, matrix.org blog, 2025-01-06. https://matrix.org/blog/2025/01/06/authentication-changes/ . Guest access turned off January 16, 2025; move to the Matrix Authentication Service. Strength A.
- MX-09. matrix.org now running MAS, April 2025. https://www.matrix.org/blog/2025/04/morg-now-running-mas/ . Future work: "Support for 2FA, MFA, Passkeys etc". Strength A. Element blog https://element.io/blog/mas-migration-unleashes-element-x-on-matrix-org : "paving the way for QR-code login, 2FA, MFA". Strength A. No page found saying two-factor sign-in is live in 2026.
- MX-10. Element X Android releases. https://github.com/element-hq/element-x-android/releases . v26.10.0: "Announce multi-account support". Strength A.
- MX-11. Element X iOS releases. https://github.com/element-hq/element-x-ios/releases . 26.10.3 and 26.10.4: "Multi account feature flag". Strength A.
- MX-12. Community discussion. https://github.com/element-hq/element-meta/discussions/1832 . "Element X now has experimental support for multiple accounts... only Element X for Android". Strength D.
- MX-13. Element push gateway (Element docs). https://ems-docs.element.io/books/element-on-premise-documentation/page/notifications-mdm-push-gateway . "an Element owned Push Gateway to send Notification via the Apple or Google Notifiction Services"; "A notification will not contain sensitive content." Strength A.
- MX-14. Push gateway spec. https://spec.matrix.org/latest/push-gateway-api/ . Gateway "submits a push notification to the push notification provider (e.g. APNS, GCM)". Strength A.
- MX-15. Element privacy. https://element.io/privacy . The phone provider sees "metadata such as a roomID or eventID, but all other processing is done locally on your device."; "Nobody at Element, or any of our processors, is able to access encrypted data." No AI training statement. Strength A.
- MX-16. Element Android UnifiedPush doc. https://github.com/element-hq/element-android/blob/develop/docs/unifiedpush.md . Classic app only; "FCM will be used by default". Strength A.
- MX-17. Community notification reports (GrapheneOS, /e/OS). https://discuss.grapheneos.org/d/20519-notifications-not-working-in-background and https://community.e.foundation/t/eos-unified-push-not-working-with-element-x/78429 . Search results only, not opened. Strength D.
- MX-18. Element classic to X FAQ. https://docs.element.io/latest/element-server-suite-pro/migration/classic-to-pro-mobile-apps-faq/ . "The Element Classic app will be sunset on 31.12.2026"; "Element X is the new app, free and fully open source to be used by consumers"; "Verification of the device (session) is mandatory when you sign in." Strength A.
- MX-19. Older Matrix FAQ. https://matrix.org/docs/older/faq/ . "New rooms have encryption enabled by default". Strength A (page marked older).
- MX-20. matrix.org status. https://status.matrix.org/ . "All Systems Operational", no incidents October 14 to 28, 2026. Strength A.
- MX-21. Outage post-mortem, matrix.org blog, October 2025. https://matrix.org/blog/2025/10/post-mortem/ . Down from 2025-09-02 17:45 UTC until "full service resumed at 2025-09-03 18:00 UTC"; "No data was lost". Strength A. Also a July 2025 database corruption post-mortem (search result only, not opened).
- Not found (Matrix): a numeric bot rate limit on matrix.org; a history retention limit for live accounts; whether a custom domain email is accepted (no restriction stated); whether two-factor sign-in is live; UnifiedPush in Element X.

Discord, from the Discord helper. All accessed 2026-10-28. Developer docs redirect from discord.com/developers/docs to docs.discord.com/developers; the docs.discord.com addresses were read. support.discord.com refused WebFetch (HTTP 403), so its articles were read with Playwright, with no custom browser identification set.

- DC-01. Mobile Notifications Settings 101. https://support.discord.com/hc/en-us/articles/218892547--Mobile-Notifications-Settings-101 . "All Messages: Any message posted in this server triggers a notification, based on your app notification settings." Strength A.
- DC-02. Notifications Settings 101. https://support.discord.com/hc/en-us/articles/215253258-Notifications-Settings-101 . "you'll get push notifications for anything you'd normally be notified about on desktop."; "mobile push notifications will also be disabled when the server is muted." Strength A.
- DC-03. Guild resource. https://docs.discord.com/developers/resources/guild . Default notification level ALL_MESSAGES or ONLY_MENTIONS; mfa_level ELEVATED: "guild has a 2FA requirement for moderation actions". Strength A.
- DC-04. Push held back while desktop is active, community threads. https://support.discord.com/hc/en-us/community/posts/360051256154 (and post 360052612473). Community threads only, seen as search snippets; the threads would not load. Strength D, unverified. No official article found.
- DC-05. Gateway. https://docs.discord.com/developers/events/gateway . "Gateway connections are persistent WebSockets." Message content exceptions: "Content in DMs with the app", content where the app is mentioned. Strength A.
- DC-06. Receiving and responding to interactions. https://docs.discord.com/developers/interactions/receiving-and-responding . "the webhook method detailed below does not require a connected client"; "These two methods are mutually exclusive"; "you must send an initial response within 3 seconds"; "Interaction tokens are valid for 15 minutes"; member is "Guild member data for the invoking user". Strength A.
- DC-07. Message resource. https://docs.discord.com/developers/resources/message . Get Channel Messages, limit "Max number of messages to return (1-100)"; needs READ_MESSAGE_HISTORY. Strength A.
- DC-08. What are Privileged Intents. https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents . Message Content "controls access to message content data across our APIs"; "If your app has fewer than 10,000 users, you may access Privileged Intents by enabling them in the Developer Portal." Strength A.
- DC-09. Rate limits. https://docs.discord.com/developers/topics/rate-limits . "All bots can make up to 50 requests per second to our API."; "Interaction endpoints are not bound to the bot's Global Rate Limit." Strength A.
- DC-10. Opcodes and status codes. https://docs.discord.com/developers/topics/opcodes-and-status-codes . "Maximum number of guilds reached (100)"; "Maximum number of webhooks reached (15)"; "Maximum number of webhooks per guild reached (1000)". Strength A.
- DC-11. Webhook resource. https://docs.discord.com/developers/resources/webhook . Webhooks "do not require a bot user or authentication to use." Strength A.
- DC-12. Nitro. https://discord.com/nitro . "$2.99/month" (Basic), "$9.99/month", "Join up to 200 servers". Not needed here. Strength A. Price label: published.
- DC-13. Application commands. https://docs.discord.com/developers/interactions/application-commands . default_member_permissions "0" makes a command admin-only; overrides "for up to 100 users, roles, and channels within a guild"; "Guild commands are limited to the guild where they were created". Strength A.
- DC-14. Interactions overview. https://docs.discord.com/developers/interactions/overview . "X-Signature-Ed25519 as a signature"; on failure "respond with a 401 error code." Strength A.
- DC-15. Setting up Multi-Factor Authentication. https://support.discord.com/hc/en-us/articles/219576828-Setting-up-Multi-Factor-Authentication . Passkeys or security keys, authenticator app, text message; "The Discord Support team is not able to remove MFA from an account." Strength A.
- DC-16. How do I set up a private server. https://support.discord.com/hc/en-us/articles/206143407-How-do-I-set-up-a-private-server . "restrict access to your server and channels to only the members you specify." Strength A.
- DC-17. Getting Started. https://support.discord.com/hc/en-us/articles/360033931551-Getting-Started . "use an email address you can access and maintain access to"; support cannot change it. Strength A.
- DC-18. How to Verify Your Discord Account. https://support.discord.com/hc/en-us/articles/6181726888215-How-to-Verify-Your-Discord-Account . Phone check can be triggered when an account "sent messages or posted content to communities faster than a human can manage"; "The phone number you use cannot be associated with an existing Discord account"; "VOIP, Burner, or Landline numbers cannot be used." Strength A.
- DC-19. Account Switcher FAQ. https://support.discord.com/hc/en-us/articles/4412732047127-Discord-Account-Switcher-FAQ . "You can log into five accounts using the Account Switcher."; "we may take action on any account that we can determine belongs to the user." Strength A.
- DC-20. Community Guidelines (effective September 29, 2025). https://discord.com/guidelines . "Do not use self-bots or user-bots."; "Each account must be associated with a human, not a bot." Strength A.
- DC-21. Inactive Account Deletion. https://support.discord.com/hc/en-us/articles/5106714856215-Inactive-Account-Deletion . "accounts that have not been used for 2 years or more may be scheduled to be deleted." Strength A.
- DC-22. Discord blog, May 18, 2026. https://discord.com/blog/every-voice-and-video-call-on-discord-is-now-end-to-end-encrypted . "We have no current plans to extend E2EE to text messages." Strength A.
- DC-23. Privacy Policy (effective September 29, 2025). https://discord.com/privacy . "proactively scanning attachments and other content for illegal or harmful activity"; "automated technologies such as machine learning systems"; content may be used "to create systems and models" to detect prohibited content. No statement on generative AI training with private messages. Strength A.
- DC-24. Discord status history feed. https://discordstatus.com/history.rss . 2026 incidents include "Elevated API error rate" (October 1), "Issues sending messages for bots and users" (August 7), "Messaging failures" (August 4), "DM message delivery down" (July 27), "API errors affecting message sends" (May 21). Strength A.
- DC-25. How to Confirm Your Age Group. https://support.discord.com/hc/en-us/articles/30326565624343-How-to-Confirm-Your-Age-Group-on-Discord . "our age estimation model determines your age group automatically"; core messaging "stay the same." Strength A. TechCrunch, 2026-02-09, https://techcrunch.com/2026/02/09/discord-to-roll-out-age-verification-next-month-for-full-access-to-its-platform/ (search result only). Strength B.
- Not found (Discord): an official article on push held back while desktop is active; a cap on bot applications per account; any free-plan cap on message history; an explicit statement on custom domain email.

Main session, after the scoring.

- DC-26. Getting Started (Discord support), read with Playwright for the price claim. https://support.discord.com/hc/en-us/articles/360033931551-Getting-Started . "You can download Discord for free on desktop here, or through the Google Play store or Apple App Store". Nitro (DC-12) is the paid add-on. discord.com/nitro and discord.com/company do not say "free" in so many words. Strength A. Price label: published (free).
- DS-01. Search for an official Discord article on push while the desktop app is active (community threads only). https://support.discord.com/hc/en-us/community/posts/360042550012-Notifications-On-Mobile-When-Desktop-is-open and https://support.discord.com/hc/en-us/community/posts/25117193018519-Due-to-this-server-s-size-you-won-t-get-mobile-push-notification-for-non-mention-messages . Search summaries only, not opened. Strength D.

## 4. Decision points
- **D1. Fourth candidate: Matrix, read on the Element app.** Chosen because it is on Healthchecks.io's integration list (HC-02), the brief's goal needs two-way commands, and Matrix has an open bot interface (to be verified by the helper). Considered and set aside, with reasons: Pushover, ntfy, Gotify and Pushbullet (push only, no way to send a command back, so job 3 fails); Signal (on the list, but Healthchecks.io's own code talks to it through signal-cli, HC-06, and Signal has no official bot interface, so a bot would need its own phone number; my reading, not researched further); WhatsApp (on the list but quota-limited by plan, HC-04); Google Chat and Microsoft Teams (tied to paid business suites; Google Workspace costs money and its Chat app setup is heavier, my judgment); Zulip, Mattermost and Rocket.Chat (Mattermost and Rocket.Chat are mostly self-hosted; Zulip Cloud is the closest rival to Matrix, and is noted as a dead end not researched, section 5).
- **D2. Healthchecks.io sources opened by the main session, not a helper.** The heartbeat link is common to all four candidates, so one reader keeps it consistent.
- **D3. Criteria and weights, fixed before the first total was computed.** Free tier limits 30 (the brief: more than any other single criterion, and Michael values full free history); two-way commands for every stack shape 15 (job 3, and the stop must work for scheduled options B and F and always-on options C and D); command security 15 (commands stop an agent trading real and borrowed money); push alerts 12 (job 1 and 2 depend on it); Healthchecks.io integration 10 (all four candidates have one, so it separates little); separation of stacks 8 (all four can do it); account identity 5; privacy 5 (the messages carry orders and fills, not account numbers or keys). Caveat: I had a rough sense of the totals while setting them; the weight sensitivity table (8 weightings) is the check on that.
- **D4. Push scored 4 for both Telegram and Discord (Discord was 3 in the first run).** The only evidence of Discord holding back phone alerts while the desktop app is open is community threads (DC-04, strength D). Discord's incident feed (DC-24) is a record Telegram does not publish (no official status page found), and Telegram had its own outage (TG-18). Absence of a record is not absence of incidents, so the two are scored level, and the holdback is falsifiability item 1 and an open question Michael can test in five minutes. Slack keeps 3 because its phone delay while active on desktop is documented by Slack itself (SL-08, strength A).
- **D5. Discord security kept at 5, scored on the same route as its commands score (polling channel messages).** Basis: a private server with Michael as the only member (DC-16), so no stranger can post in the command channel; sign-in protection with passkeys or an authenticator app, which support cannot remove (DC-15); and the program checks the numeric user ID on every message (DC-06, DC-07). The slash command permission overrides (DC-13) are an extra for the always-on route and are not counted. Telegram 4: the program checks the numeric ID (TG-13), but anyone can find and message the bot (TG-07), and two-step verification keeps a text-message code as one factor (TG-12).
- **D6. Telegram commands lowered from 5 to 4.** Telegram keeps a bot's unread messages for at most 24 hours (TG-05). A stop sent while a stack is not polling (option B outside market hours, a worker idle over a weekend, a paused stack) is silently dropped after a day. It can be designed around by polling every few minutes, seven days a week, but that is an obligation and a silent failure if missed. Discord channel messages stay in the channel (no expiry found), so a late reader still sees the stop. Discord 4: polling channel messages works for both stack shapes (DC-07, DC-08), but slash commands need an always-on connection or a web address (DC-05, DC-06).
- **D7. Telegram account identity 2.** A Telegram account "can only be connected to a mobile number" (TG-12), so the brief's plan of stack accounts tied to a sib-tech email cannot be met; separate accounts need separate numbers. Discord 4: signs up with an email (DC-17), but a phone check can be demanded later (DC-18). Slack 5 and Matrix 5: email sign-up, Slack explicitly suggests a company domain address (SL-16), matrix.org requires an email and makes a phone optional (MX-01, MX-07).
- **D8. The pick: Discord.** Clear lead of 0.25 over Telegram under the base weights, first in 8 of 8 weightings. No judgment is needed to break a tie. Because the pick is not Telegram, run 3's markdown is updated in place as the brief requires.

## 5. Dead ends
- Healthchecks.io's /integrations/ index and its /integrations/discord/, /slack/, /matrix/ pages return 404. Replaced by the home page list and the open source code on GitHub.
- GitHub's templates/integrations folder returned 404; the templates live under hc/integrations/<name>/templates/. Found by browsing the repository with Playwright (no sign-in).
- Zulip Cloud as a fifth candidate: not researched (the brief asks for one more, not two).
- Search for an official Discord article on push held back while the desktop app is active: none found. Only community threads, one citing a "Push notification timeout" setting (strength D). Kept as an open question.
- The first scoring run's tie (Telegram 4.43, Discord 4.41) was not used: three score bases were inconsistent (D4 to D6).
- Run 3's Sources tab scrolls sideways on a phone (long web addresses). Found while testing; it predates this run and was not changed, because the brief asks to keep run 3's look and feel exactly. A one-line style fix is available if the owner wants it.
- A screenshot to the session scratch folder was refused by the browser tool (outside its allowed folders); saved under `.playwright-mcp/`, which is git-ignored.

## 6. Self-assessment against the standard

**1. Every connector claim traced to a live source with an access date. Met, with stated weaknesses.**
- Every capability and limit in the deliverable carries a footnote to a source dated 2026-10-28 (77 sources). 73 were opened; 4 (DC-04, DS-01, TG-10, MX-17) were seen only as search result summaries, and the deliverable's source list marks them so. None rests on recalled knowledge.
- Weaknesses: helpers read most pages through a fetch tool that can paraphrase lightly, so quotes should be reopened before a decision hangs on exact wording. Five sources are strength D or C (DC-04, DS-01, MX-12, MX-17, TG-10), each labelled and used only for unconfirmed or secondary points. The Discord desktop holdback, the item that moves Discord closest to Telegram, rests on strength D only and is stated as unconfirmed.
- Several findings are negative ("not found"), for example no history cap on Discord or Telegram. Absence of a limit on a vendor page is not proof there is none, and the deliverable says so.

**2. Pricing verified rather than recalled. Met.**
- Every price was read on the vendor's page that day: Healthchecks.io (free Hobbyist, 5 and 20 dollar plans), Slack Pro (8.75 or 7.25), Discord Nitro (2.99 or 9.99) and Discord's free download, Telegram free and Premium (price not shown, labelled gated and unverified), matrix.org free plan (Premium has no published price), Element's free Community plan.
- The Slack prices were read from the plan table without a verbatim quote (the helper said so).

**3. Each option's failure mode named. Met.** Discord: a silent phone while the desktop app is open. Telegram: a stop that expires after 24 hours. Matrix: one homeserver outage takes alerts and commands down together (24 hours in September 2025). Slack: the record disappears after 90 days and a year.

**4. The recommendation falsifiable. Met.** Section 6 of the deliverable lists 15 items, each with the evidence that would show it and a score change, every one re-ranked by script for all four candidates. One item alone makes Telegram the pick (5), four make a tie (1, 2, 7, 11), and two pairs make Telegram the pick (14, 15).

**Scored and ranked by script before any conclusion. Met.** The first run gave a tie, and the advisor's audit found three bases scored inconsistently (D4 to D6). They were fixed before the conclusion was written. The audit moved the result from a tie to a clear Discord lead, so the pick rests on those three judgments, which are stated in full so the owner can overrule any of them.

**Where the run fell short.**
- Weights were set by me, and I had a rough sense of the totals while setting them (D3). The 8 weighting sensitivity table is the check: Discord is first in all 8.
- Only one fourth candidate was researched (Matrix). Zulip Cloud was not, although it is on Healthchecks.io's list.
- Healthchecks.io's Discord and Matrix integration behaviour was read from its open source code, not from a hosted page (the hosted pages for those two return 404). The hosted service is assumed to run the same code.
- No account was created, so nothing was tested hands-on: push behaviour, the desktop holdback and the Discord polling route are all unmeasured. Each would become a measurement with a free account and a few minutes.
- Run 3's Sources tab overflows on a phone, a defect from before this run that was found and left alone.

**Prohibitions.** No account, signup, bot, server, workspace or channel was created. Nothing was installed; the local test server was Python's built-in one. No connector or MCP server was configured. No credentials in any file. Nothing in `~/Projects/relii` was read. Every helper was given the personal information rule word for word, plus a rule against curl and against setting a browser identification string. support.discord.com refused plain fetches (HTTP 403), so those pages were read with Playwright with no custom browser identification, as the rule allows. No personal information was sent anywhere (my reading of the helpers' reports; no helper reported sending any).

## 7. Scoring script output (final run)

```
Weights: {'free': 30, 'cmd': 15, 'sec': 15, 'push': 12, 'hb': 10, 'sep': 8, 'id': 5, 'priv': 5} sum 100
Base weights                                               Discord 4.53, Telegram 4.28, Matrix 3.63, Slack 2.96   FIRST: Discord

Sensitivity to weights
Base weights                                               Discord 4.53, Telegram 4.28, Matrix 3.63, Slack 2.96   FIRST: Discord
Equal apart from free (free 20, others 80/7)               Discord 4.31, Telegram 3.97, Matrix 3.77, Slack 3.29   FIRST: Discord
Free tier heavier (free 40, others scaled to 60)           Discord 4.60, Telegram 4.38, Matrix 3.68, Slack 2.68   FIRST: Discord
Security heavier (sec 25, free 30, others scaled to 45)    Discord 4.62, Telegram 4.28, Matrix 3.44, Slack 2.99   FIRST: Discord
Push heavier (push 22, free 30, others scaled to 48)       Discord 4.49, Telegram 4.28, Matrix 3.57, Slack 2.86   FIRST: Discord
Identity heavier (id 20, free 30, others scaled to 50)     Discord 4.48, Telegram 3.96, Matrix 3.88, Slack 3.15   FIRST: Discord
Privacy heavier (priv 20, free 30, others scaled to 50)    Discord 4.15, Telegram 3.96, Matrix 3.72, Slack 2.67   FIRST: Discord
Commands heavier (cmd 25, free 30, others scaled to 45)    Discord 4.49, Telegram 4.28, Matrix 3.70, Slack 2.86   FIRST: Discord
Exact first / first-or-within-0.10, of 8 : {'Telegram': [0, 0], 'Discord': [8, 8], 'Slack': [0, 0], 'Matrix': [0, 0]}

Falsifiability items, each re-ranked
1. Discord push is held back while the desktop app is open Discord 4.29, Telegram 4.28, Matrix 3.63, Slack 2.96   TIE: Discord and Telegram
2. Telegram keeps a stop command until it is read (no 24 h Discord 4.53, Telegram 4.43, Matrix 3.63, Slack 2.96   TIE: Discord and Telegram
3. Telegram bot messages arrive late or silently in a two- Discord 4.53, Telegram 4.04, Matrix 3.63, Slack 2.96   FIRST: Discord
4. Telegram adds a history cap or a bot fee                Discord 4.53, Matrix 3.63, Telegram 3.38, Slack 2.96   FIRST: Discord
5. Discord caps free history or gates bot reading of messa Telegram 4.28, Discord 3.63, Matrix 3.63, Slack 2.96   FIRST: Telegram
6. Healthchecks.io drops its Telegram integration          Discord 4.53, Telegram 3.98, Matrix 3.63, Slack 2.96   FIRST: Discord
7. Healthchecks.io drops its Discord integration           Telegram 4.28, Discord 4.23, Matrix 3.63, Slack 2.96   TIE: Telegram and Discord
8. Michael accepts a phone-number account for messaging    Discord 4.53, Telegram 4.38, Matrix 3.63, Slack 2.96   FIRST: Discord
9. Vendor-readable order details become unacceptable (priv Discord 4.20, Telegram 3.98, Matrix 3.68, Slack 2.83   FIRST: Discord
10. Discord asks the owner account for phone verification  Discord 4.43, Telegram 4.28, Matrix 3.63, Slack 2.96   FIRST: Discord
11. Polling Discord channel messages proves unworkable for Telegram 4.28, Discord 4.23, Matrix 3.63, Slack 2.96   TIE: Telegram and Discord
12. matrix.org turns on two-factor sign-in                 Discord 4.53, Telegram 4.28, Matrix 3.93, Slack 2.96   FIRST: Discord
13. Slack free keeps full history again                    Discord 4.53, Telegram 4.28, Slack 3.86, Matrix 3.63   FIRST: Discord
14. Items 1 and 2 together: Discord push held back, and Te Telegram 4.43, Discord 4.29, Matrix 3.63, Slack 2.96   FIRST: Telegram
15. Items 1 and 11 together: Discord push held back, and p Telegram 4.28, Discord 3.99, Matrix 3.63, Slack 2.96   FIRST: Telegram
```
