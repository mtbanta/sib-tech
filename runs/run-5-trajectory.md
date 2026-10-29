# Run 5 trajectory: choose the messaging app, every source read first hand

Research input for a human decision, never an instruction to act.

## 1. The brief as given

Verbatim copy of `runs/run-5-brief.md`:

> # Run 5 brief: choose the messaging app, with every source read first hand
>
> ## Run settings
>
> A record for the audit trail, not instructions. Michael set these up before pasting this brief:
>
> - Launched from `~/Projects/sib-tech` in a fresh session.
> - Model: latest Opus, high effort. Advisor: on, latest Opus. Auto-mode: on.
> - Playwright MCP confirmed connected with `/mcp` before pasting.
> - Copied from the raw file in TextEdit.
>
> ## What changed from the previous run
>
> Levers changed: context and instructions, stated openly.
>
> Why: run 4 picked Discord (4.53) over Telegram (4.28), but the pick rests on two things Discord's own pages were not shown to confirm (no cap on free history, and bots can read channel messages). Signal was excluded on a reading, not a source (run 4 trajectory, decision D1). Four sources were cited from search summaries without being opened, including both sources for the desktop holdback caveat.
>
> Context changes:
> - Signal is a candidate.
> - Michael notes that Telegram offers "Secret Chats" with end-to-end encryption, while standard cloud chats are not end-to-end encrypted by default. Verify this, and verify whether a bot can take part in a Secret Chat.
> - Encryption is a preference when it is available on a free plan, not a requirement. Score it as a criterion. Unencrypted messages are acceptable.
>
> Instructions changes:
> - Open and read every source first hand. Cite nothing from a search result summary. If a page cannot be opened with plain requests or Playwright, record it as a dead end and do not cite it.
> - Settle from Discord's own documentation (developer docs, help center, terms) whether free server history is capped, and whether a bot can read the messages Michael sends in a private server, including anything Discord requires before a bot may read message content.
> - Settle Signal's bot or automation options from Signal's own pages and the projects' own documentation.
>
> Not researched, and why: the reported Discord desktop holdback (phone silent while the computer app is open) can only be settled with an account, and this run creates none. Write it as a five-minute test in the setup steps for whichever app wins.
>
> Housekeeping, not a lever: fix the Sources tab in `runs/run-3-deliverable.html` so it does not scroll sideways at phone width (run 4 recorded it as an open issue). Michael approved this. Change nothing else about the page's look.
>
> Run 4 stays as it is, for the record.
>
> ## Step zero: save this brief
>
> Before anything else, write this entire brief, verbatim and unedited, to `runs/run-5-brief.md`. Then create `runs/run-5-trajectory.md` and paste this brief into its first section.
>
> ## The goal
>
> When this run is done, Michael can pick one free mobile app that does all three jobs for every stack he builds:
>
> 1. Heartbeat alerts: the heartbeat service reaches his phone when a run is missed or a worker stops pinging.
> 2. Regular messages from the stack: the live list, orders and fills, refusals, errors, the daily summary.
> 3. Commands to the stack: at least stop and status, sent from his phone.
>
> He sees your strongest pick and why, and every claim traces to a dated live source.
>
> ### Candidates
>
> - Telegram, Discord, Slack and Signal, on their free plans.
> - Matrix on the Element app, carried from run 4.
> - You may add one more if the evidence points to it. Say why.
>
> ### What you need to know
>
> - Michael is a non-coder. He reads these messages on his phone.
> - Context carried forward, unchanged: `runs/run-3-brief.md`, `runs/run-3-correction-brief.md` and `runs/run-4-brief.md`. The corrected stack pick is option C, the always-on worker.
> - He may build two stacks and compare them, each with its own trading strategy. The app must keep each stack's messages and commands separate (for example one bot, server, channel or workspace per stack), so that a command meant for one stack can never reach another.
> - Michael plans for each stack to run on accounts tied to a sib-tech email domain he will create in Google Workspace, not his personal email.
> - Commands can stop an agent that trades with real and borrowed money. Who is allowed to send a command matters.
> - The stop command must work even when Claude is down, because Claude is not in the control path in run 3's designs.
> - Heartbeat service in run 3's setups: Healthchecks.io. You may compare others only if an app has no Healthchecks.io integration.
>
> ### Questions every candidate must answer
>
> - Push alerts: do they reliably reach the phone, including when the app is in the background? Any documented delays or limits on bot messages?
> - Two-way commands: can a bot receive a command from Michael's phone and pass it to the stack? How?
> - Free tier limits: message history, number of bots or integrations, rate limits, anything that would push him to a paid plan. Weight this criterion more heavily than the others: Michael values a free app that keeps full history over one that charges for it.
> - Heartbeat integration: does Healthchecks.io (or the chosen heartbeat service) send alerts to it natively?
> - Command security: how can only Michael's account send commands? Two-factor sign-in, bot allowlists, private channels.
> - Separation: how each app keeps two or more stacks apart.
> - Account identity: how each app handles an account created with a custom domain email (for example a sib-tech Google Workspace address) instead of a personal one. Does it require a phone number? Can one person hold separate accounts or workspaces per stack?
> - Encryption and privacy: is it end-to-end encrypted on the free plan, and does that still hold for messages a bot sends or receives? Does the vendor read or train on message content?
>
> You choose the criteria and weights from these, and show them. Free tier limits must carry more weight than any other single criterion. Encryption is a preference, weighted as such.
>
> ## The sources
>
> Use:
> - Live web research, and Playwright for pages that need JavaScript.
> - `runs/run-4-deliverable.md` and `runs/run-4-trajectory.md`. Reuse run 4's findings only after reopening each page and reading it yourself.
> - `runs/run-3-deliverable.md` and `runs/run-3-correction-trajectory.md` for the stack designs the app must serve. Read the corrected deliverable's "How Michael uses it" sections before researching.
>
> Ignore:
> - Anything in `~/Projects/relii`.
> - Your own recalled knowledge as evidence. Every capability and limit needs a live source.
>
> Source strength and gated pricing: the same scale and labels as runs 1 to 3.
>
> ## The output
>
> Build in this order: markdown and trajectory first, then the HTML.
>
> ### `runs/run-5-deliverable.md`, the source of record
>
> 1. Summary: your strongest pick and why, in bullets.
> 2. Criteria and weights, with a reason for each.
> 3. A comparison table: every candidate against every question above.
> 4. One section per candidate: how it would carry the three jobs, how two stacks stay separate, how commands are secured, free tier limits, account identity, pros, cons, and its failure mode (the most likely way it breaks or disappoints).
> 5. What Michael does to set it up, as bullets, including the five-minute desktop holdback test, and what CC would build.
> 6. Falsifiability: what evidence would overturn the pick.
> 7. Open questions.
> 8. Sources, numbered footnotes, same format as run 3. Every source opened and read.
>
> Formatting: bullets and tables, no paragraph longer than three sentences, plain English, acronyms defined, no em or en dashes. State that this is research input for a human decision.
>
> ### Changes to run 3's files
>
> - Rebuild the "Messaging" tab in `runs/run-3-deliverable.html` from `runs/run-5-deliverable.md`. Keep run 3's look and feel exactly. Footnotes in the tab link to run 5's sources.
> - If your pick is not Discord (run 4's pick, already written into run 3), update `runs/run-3-deliverable.md` in place, and rebuild its HTML:
>   - every example setup's tool table and totals
>   - every "How Michael uses it" section
>   - every other mention of Discord as the alert or command channel
>   - add a dated "Update, run 5" block under the title listing each change
> - If your pick is Discord, change nothing in run 3's markdown beyond a one-line note in its update block pointing to run 5.
> - Test the page in a browser with Playwright (serve it locally): every tab, at desktop and phone width.
>
> ## The standard
>
> Michael accepts the work when all of these hold:
>
> 1. Every connector claim traced to a live source with an access date.
> 2. Pricing verified rather than recalled.
> 3. Each option's failure mode named.
> 4. The recommendation falsifiable, stating what evidence would overturn it.
>
> Before writing any conclusion, score and rank every candidate by script, and re-rank all of them for every falsifiability item.
>
> ## Documenting your work: `runs/run-5-trajectory.md`
>
> Append as you work, not at the end. Six parts: the brief as given, the sequence of what you did, sources with URL and access date, decision points, dead ends, and a self-assessment against the standard. Do not record time spent or token cost.
>
> ## Run conventions
>
> - Files: `runs/run-5-brief.md`, `runs/run-5-deliverable.md`, `runs/run-5-trajectory.md`, the updated `runs/run-3-deliverable.html`, and the updated `runs/run-3-deliverable.md` if your pick is not Discord.
> - Add one line to `runs/README.md`: "5", the date, "context and instructions: Signal added, encryption preferred, every source read first hand", outcome.
> - Update `PROJECT_STATE.md`: the Runs table (lever "context and instructions"), Current Stage and Next Steps.
> - Check the date with `date` before writing any date.
> - Done means all files written, the page browser-tested, the index and PROJECT_STATE.md updated, and one commit and one push. Auto-mode's carve-out covers that commit and push.
> - Then end the session.
>
> ## Prohibitions
>
> - No account creation and no signups, anywhere. Do not create a bot, server, workspace or channel.
> - No scaffolding, no package managers, nothing installed, no database.
> - No connector or MCP server configured for the future agent itself.
> - No credentials, API keys or account numbers in any file or commit message.
> - No reading anything in `~/Projects/relii`.
> - Never send Michael's name, email address or any other personal information to any website or service, including in request headers. Do not disguise automated requests as a regular web browser. If a page refuses plain requests, read it with Playwright or skip it and record it. Give this rule, word for word, to any helper you start.

## 2. Sequence of what was done

1. Read `PROJECT_STATE.md` (start-of-session rule). Checked the date with `date`: Wed Oct 28 2026, America/Chicago. Saved the brief verbatim to `runs/run-5-brief.md` and created this file.
2. Read `runs/run-4-deliverable.md` in full, `runs/run-4-trajectory.md` sections 3 and 4 (register and decision D1), and run 3's update block plus all four "How Michael uses it" sections (options B, C, D, F). Found that run 4's Markdown to HTML renderer lived in that session's scratch folder and is gone, so a new one is needed. Noted that Healthchecks.io's home page (run 4, HC-02) lists Signal and Google Chat among its integrations.
3. Called the advisor before research. Advice taken: settle the deciding facts first (Discord history wording, the Message Content threshold and its exemptions, bot applications per account, Signal's terms on automation, signal-cli's phone number and expiry rules, Healthchecks.io's Signal code, Signal history and backups, Telegram Secret Chats and bots); reopen only run 4 pages that will be cited; never turn an absence into a finding; keep Playwright in the main session; give each helper the prohibition word for word; consider Google Chat as a sixth candidate but score its free tier on the fact that a Workspace seat is paid; prove a new renderer reproduces the current Messaging tab before rebuilding it; find the overflowing element on the Sources tab before fixing it.
4. Started four research helpers in parallel (Signal; Telegram and Slack; Matrix and Healthchecks.io; Google Chat as a possible sixth candidate). Each was given the brief's Prohibitions section word for word, told not to set a custom browser identification string, not to fill any form, and not to use the browser (the main session keeps Playwright to itself). Each returns URL, how the page was opened, verbatim quotes and a strength label.
5. Discord, main session. Plain `curl` (default identification string) opened the developer docs Gateway page, the Message resource page, the Privacy Policy and the Terms. The developer help center and the support help center returned 403 (a Cloudflare challenge) to plain requests, so those were read with Playwright.
   - Gateway page, "Privileged Intent Access Review": "Apps with fewer than 10,000 users can access privileged intents by enabling them in the Developer Portal." The threshold counts users ("10,000 unique users who can see your app across all the servers it's in"), not servers. Run 4's wording was right.
   - Gateway page, "Message Content Intent": apps without the intent get empty content "with a few exceptions: Content in messages that an app sends, Content in DMs with the app, Content in which the app is mentioned". So even with the toggle off, a direct message to the bot or a message that mentions it is readable: a fallback command route.
   - Message resource, "Get Channel Messages": needs VIEW_CHANNEL and READ_MESSAGE_HISTORY; "Max number of messages to return (1-100)", default 50; "after" parameter for messages after a given ID.
   - Privacy Policy, "Data retention": "We retain personal information until we determine it is no longer needed ... You can learn more about data retention periods in our data retention policy" (links to support article 5431812448791).
   - "How long Discord keeps your information" (support article, Playwright): "In general, this means that we retain your personal information for as long as you have an active Discord account." "You can edit or delete any message you have sent." "if your account is inactive for two years, we may delete it for you." "If you delete your account, we continue to retain and display the content you shared with other users". No time cap on messages is stated. This is the closest any Discord page comes to settling free history: retention is tied to the account's life, not to a plan or an age limit.
6. Discord, continued. All accessed 2026-10-28. Register IDs given here are reused in section 3 and the deliverable.
   - DC-01 "What are Privileged Intents?" (developer help center, Playwright; plain curl got 403): "If your app has fewer than 10,000 users, you may access Privileged Intents by enabling them in the Developer Portal." "We count the number of unique users who have access to your app across all the servers it's installed in." Strength A.
   - DC-02 Gateway (docs.discord.com, curl): the threshold and the Message Content exceptions quoted in step 5. Strength A.
   - DC-03 Message resource (curl): Get Channel Messages, limit 1 to 100, needs READ_MESSAGE_HISTORY. Strength A.
   - DC-04 "How long Discord keeps your information" (support, Playwright): quoted in step 5. Strength A.
   - DC-05 Privacy Policy (curl): retention sentence (step 5); "All information sent within our services is encrypted both in transit and at rest"; "Voice and video communications on Discord are designed to be end-to-end encrypted"; "proactively scanning attachments and other content for illegal or harmful activity"; uses content reported or violating, and public content, "to create systems and models" to detect prohibited content. No statement on training generative AI on private messages found. Strength A.
   - DC-06 Terms of Service, effective September 29, 2025 (curl): "We won't charge you a fee to use the basic functionality of our services, but you may be able to pay for additional features and products." Strength A. Price label: published (free).
   - DC-07 Getting Started (support, Playwright): "You can download Discord for free"; "please use an email address you can access and maintain access to"; phone verification is an optional addition in settings. Strength A.
   - DC-08 How do I set up a private server (Playwright): "restrict access to your server and channels to only the members you specify". Strength A.
   - DC-09 Setting up Multi-Factor Authentication (Playwright): "Discord supports three types of MFA: Security Keys (Passkeys), Authenticator App, and SMS"; "The Discord Support team is not able to remove MFA from an account." Strength A.
   - DC-10 [Mobile] Notifications Settings 101 (Playwright): "Regardless of the settings below, you won't receive notifications while the Discord app is open and in focus on your device." (This is about the phone app being open on the phone, not the desktop holdback.) Strength A.
   - DC-11 Notifications Settings 101 (Playwright): per-server notification levels; "mobile push notifications will also be disabled when the server is muted". Strength A.
   - DC-12 How to Verify Your Discord Account (Playwright): verification may be required if you "sent messages or posted content to communities faster than a human can manage"; "The phone number you use cannot be associated with an existing Discord account"; "VOIP, Burner, or Landline numbers cannot be used." Strength A.
   - DC-13 Account Switcher FAQ (Playwright): "You can log into five accounts using the Account Switcher." Strength A.
   - DC-14 Webhook resource (curl): "They do not require a bot user or authentication to use." Strength A.
   - DC-15 Rate limits (curl): "All bots can make up to 50 requests per second to our API." Strength A.
   - DC-16 Application commands (curl): "Guild commands are specific to the guild you specify when making them. Guild commands are not available in DMs."; command permissions can "enable or disable commands for up to 100 users, roles, and channels within a guild", permission type USER. Strength A.
   - DC-17 Opcodes and status codes (curl): "Maximum number of guilds reached (100)", "Maximum number of webhooks reached (15)" (per channel), "Maximum number of webhooks per guild reached (1000)". Strength A.
   - DC-18 Receiving and responding to interactions (curl): "you must send an initial response within 3 seconds of receiving the event". Strength A.
   - DC-19 Nitro page (curl): Nitro Basic "$2.99 / MONTH", Nitro "$9.99 / MONTH", perks are uploads, emoji, profiles, games. Strength A. Price label: published.
   - DC-20 Discord blog, May 18, 2026, voice and video end-to-end encryption (curl): "We have no current plans to extend E2EE to text messages." Strength A.
   - DC-21 Discord status history feed (curl, RSS): 2026 incidents include "Issues sending messages for bots and users" (August 7), "Messaging failures" (August 4), "session starts, DM message delivery down" (July 27), "API errors affecting message sends, session starts, and billing operations" (May 21), "Elevated API error rate" (October 1). Strength A.
   - DC-22 Community Guidelines (curl): "Do not use self-bots or user-bots. Each account must be associated with a human, not a bot." Strength A.
   - Dead end: Discord Developer Policy at docs.discord.com/developers/policies-and-agreements/developer-policy returned 403 to curl; not needed for any claim, not cited.
   - Dead end: how many bot applications one account may own. Searched the developer help center ("how many applications", 32 results, none on a per-account app limit), and the "Overview of apps" page (no limit stated). Not found; recorded as open.
   - Dead end: the run 4 "Inactive Account Deletion" address (article 360060145013) now opens "Why isn't my DM going through?". The two-year inactivity rule is cited from DC-04 instead.
7. Wrote a new Markdown to HTML renderer in the session scratch folder (not in the repo). Proven before use: from the unchanged `runs/run-4-deliverable.md` it reproduces the current Messaging tab body of `runs/run-3-deliverable.html` byte for byte (the only difference is a trailing newline at the end of the file it wrote), and it reproduces the page's run 4 source data (77 entries) exactly, after one fix so a strength label with a note ("A (page marked older)") is kept whole.
8. Signal helper returned. Every page opened with plain `curl` and its default identification string. support.signal.org refuses plain requests to its rendered pages (403, Cloudflare), so the helper read Signal's own article text through the same domain's public help center interface (`/api/v2/help_center/en-us/articles.json`). The main session then opened three decisive pages with Playwright and confirmed the quotes on the rendered page: Secure Backups, "Open Signal on your phone to keep your account active", and the Terms. All accessed 2026-10-28.
   - SG-01 Signal Terms and Privacy Policy, https://signal.org/legal/ (curl and Playwright). "You will not use (or assist others in using) our Services in ways that: ... (b) involve sending illegal or impermissible communications such as bulk messaging, auto-messaging, and auto-dialing." "you must not ... create accounts for our Services through unauthorized or automated means". "To create an account you must register for our Services using your phone number." Privacy: "Signal cannot decrypt or otherwise access the content of your messages or calls"; "Your message history is stored on your own devices." "Signal does not sell, rent or monetize your personal data or content in any way". No statement on AI. Strength A.
   - SG-02 Phone Numberless Registration for Android beta, support article 11197884108826 (help center interface). Beta only: "create and use a Signal account without a phone number. Instead, you make a small one-time purchase"; "pay the $2.99 fee"; "There is no phone number fallback." Strength A. Price label: published.
   - SG-03 Phone Number Privacy and Usernames, article 6712070553754. "A username is simply a way to initiate contact on Signal without sharing your phone number." "why do I still need to provide a phone number?" Strength A.
   - SG-04 Signal PIN, article 360007059792. "A PIN can also serve as a registration lock." Strength A.
   - SG-05 Register a phone number, article 360007318691. "The number must be able to receive an insecure SMS or phone call." Strength A.
   - SG-06 Can I use Signal for work?, article 360007319731. "Each phone must register with a separate number." Strength A.
   - SG-07 Signal Secure Backups, article 9708267671322 (interface and Playwright). "your Secure Backup Archive includes all of your text messages and the last 45 days of media"; "What is the cost? $1.99 per month" (for up to 100 GB of media); optional. Strength A. Price label: published.
   - SG-08 Backups and Device Transfers, article 10074659364122. A lost phone is recoverable only with Secure Backups. Strength A.
   - SG-09 Linked Devices, article 360007320551. "There is a limit of 5 linked devices per account." "your phone has to come online at least once every 30 days." Strength A.
   - SG-10 Open Signal on your phone to keep your account active, article 9021007554074 (interface and Playwright). "Signal accounts are deleted after 120 days of inactivity." "Signal releases expire after 90 days". Strength A.
   - SG-11 Troubleshooting Notifications, article 360007318711. "Check that Signal is excluded from battery optimization."; "Check if your linked Signal Desktop has already viewed the message." Strength A.
   - SG-12 Is it private? Can I trust it?, article 360007320391. "Signal conversations are always end-to-end encrypted". Strength A.
   - SG-13 Signal Official Chat and anti-scam pages, article 10933746286746. "Security bots or customer service bots do not exist." Strength A.
   - SG-14 Signal documentation, https://signal.org/docs/ . Lists cryptography specifications and the Signal Protocol library only; no bot or automation interface. Strength A. Combined with SG-13 and a full-text search of all 162 English help articles ("API" 0, "automation" 0): no official bot interface found on these pages.
   - SC-01 signal-cli README, https://raw.githubusercontent.com/AsamK/signal-cli/master/README.md . "For registering you need a phone number where you can receive SMS or incoming calls." "primarily intended to be used on servers to notify admins of important events"; "daemon mode with JSON-RPC interface"; "The official Signal clients expire after three months ... signal-cli releases older than three months may not work correctly." "you can link signal-cli to it with: signal-cli link". "The Signal protocol expects that incoming messages are regularly received". Strength A for the project's own behaviour, D as evidence of Signal's policy.
   - SC-02 signal-cli man page (man/signal-cli.1.adoc). "When running into rate limits, sometimes the limit can be lifted, by solving a CAPTCHA." Same labels.
   - SC-03 signal-cli wiki, Registration-with-captcha. "The Signal server requires a captcha token for registering a new account." "Trying to register too often, leads to a rate limit (429)". Same labels.
   - SC-04 signal-cli wiki, Linking other devices. "A "linked" program can be Signal-Desktop, or an instance of signal-cli." Same labels.
   - SC-05 signal-cli-rest-api README, https://raw.githubusercontent.com/bbernhard/signal-cli-rest-api/master/README.md . Runs as a Docker image; receive modes; "messages arriving while no subscriber is attached ... are silently dropped" in the default json-rpc mode. Same labels.
   - HC-S1 Healthchecks.io Signal code, hc/integrations/signal/transport.py, forms.py and hc/api/models.py on GitHub. Sends through a signal-cli socket to a phone number or username; "# 6 messages for a single recipient per minute"; no group support found in the form (my reading of the code). Strength A for Healthchecks.io's behaviour.
   - HC-S2 Healthchecks.io self-hosted configuration docs, https://healthchecks.io/docs/self_hosted_configuration/ . "Healthchecks uses signal-cli to send Signal notifications." Strength A.
   - Dead ends: rendered support.signal.org pages refuse plain requests (worked around as above); https://healthchecks.io/integrations/signal/ , /integrations/ and /docs/signal/ return 404.
9. Fixed the criteria and weights before computing any total (decision D2). Nine criteria, sum 100: free tier limits 28; two-way commands by a route the vendor supports 15; command security 14; push alerts 12; Healthchecks.io integration 9; separation of stacks 7; account identity 6; encryption 5; vendor privacy 4. Free tier limits are almost double the next criterion, and the script must assert they outweigh every other single criterion in every weighting it runs.
10. Google Chat helper returned. Every page opened with plain `curl`, default identification string, 2026-10-28. Strength A unless noted.
   - GC-01 Google Workspace pricing, https://workspace.google.com/pricing . "Starter ... $7 ** / user per month"; "Annual ( Save 16% with 1 year commitment)" with the annual switch on by default, so 7 dollars is the one-year commitment price. Chat and "Turn history on or off by default" are on every plan; "Vault to retain, archive, and search data" is not in Starter. Price label: published (annual). The no-commitment price sits behind a JavaScript switch (checked with Playwright in step 12).
   - GC-02 Build a Google Chat app as a webhook, https://developers.google.com/workspace/chat/quickstart/webhooks . Prerequisite "A Business or Enterprise Google Workspace account with access to Google Chat." "Webhooks aren't conversational. They can't respond to or receive messages from users". "Each webhook only works in the Chat space in which it's registered." "1 request per second, shared among all webhooks in the space."
   - GC-03 Receive and respond to user interactions, https://developers.google.com/workspace/chat/receive-respond-interactions . Needs a Google Cloud project, a consent screen and the Chat API.
   - GC-04 Configure the Google Chat API, https://developers.google.com/workspace/chat/configure-chat-api . Endpoint choices: HTTP address, Apps Script, Pub/Sub topic, Dialogflow. Visibility: "You can specify up to five individuals, or one or more Google Groups".
   - GC-05 Build a Google Chat app with Pub/Sub, https://developers.google.com/workspace/chat/quickstart/pub-sub . Useful "if your organization has a firewall"; the server "subscribes to the Pub/Sub topic in order to receive the message through the firewall." Prerequisite "A Google Cloud project with billing enabled."
   - GC-06 spaces.messages.list, https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages/list . App authentication needs "administrator approval" with chat.app.messages.readonly and "only returns public messages in a space."
   - GC-07 Pub/Sub pricing, https://cloud.google.com/pubsub/pricing . "the first 10 GiB of throughput ... is free"; "A minimum of 1 KB is assessed for each request". Price label: published.
   - GC-08 Turn chat history on or off for an organization, https://support.google.com/a/answer/7664184 . "If you turn history On , you can use Vault to control how long messages are retained ... If you turn history Off , messages are deleted after 24 hours."
   - GC-09 Turn history on or off in Google Chat, https://support.google.com/chat/answer/7664687 . "History is on by default in spaces with in-line threading."
   - GC-10 Turn Google Chat notifications on or off, https://support.google.com/chat/answer/7655718 . "Notifications appear on the devices you used most recently. If you're not active in Chat, notifications appear on all devices". Spaces can be set to notify on "All" messages.
   - GC-11 Healthchecks.io Google Chat integration, https://healthchecks.io/integrations/googlechat/ and the googlechat code on GitHub. Posts to a space webhook: "Click + Add webhooks ... paste it in the form."
   - GC-12 About client-side encryption, https://support.google.com/a/answer/10741897 . "Supported editions for this feature: Frontline Plus; Enterprise Plus; Education Standard and Education Plus." So no end-to-end encryption on Starter.
   - GC-13 Generative AI in Google Workspace Privacy Hub, https://support.google.com/a/answer/15706919 . "Your content is not human reviewed or otherwise used for Generative AI model training outside your domain without permission."
   - GC-14 Usage limits, https://developers.google.com/workspace/chat/limits . Per space: 1 write a second; per project 3000 reads a minute.
   - GC-15 Deploy 2-Step Verification, https://support.google.com/a/answer/9176657 . An admin can enforce it.
   - Dead ends: six Workspace admin help addresses (answers 9295096, 7671455, 9400486, 7651190 and two /admin/chat/ paths) returned a generic page to curl; https://support.google.com/chat/answer/9634080 "page can't be found"; no Google page says outright whether a personal Gmail account can use webhooks or Chat apps.
11. Sources tab, phone width. Served the page with Python's built-in server (installs nothing) and measured at 375 pixels: every tab has page width 375 except Sources, at 758. The overflowing elements are the value cells of each source record (`.srcitem .kv`), whose grid columns are "1fr auto", so the auto column stretches to the full width of a long web address.
12. Google Workspace pricing with Playwright (main session): with the annual switch on, Starter "$7 / user per month"; after clicking the switch to monthly, "$8.40 / user per month". A launch offer shows half price for three months. Price label for both: published. (GC-01 updated.)
13. Telegram and Slack helper returned. Every page opened with plain `curl`, default identification string, 2026-10-28, strength A. No page needed Playwright.
   - TG-01 Telegram FAQ, https://telegram.org/faq . "Server-client encryption is used in Cloud Chats (private and group chats), Secret Chats use an additional layer of client-client encryption." "All secret chats in Telegram are device-specific and are not part of the Telegram cloud." "If you log out, you will lose all your secret chats." "Telegram accounts can only be connected to a mobile number." Two-step verification: "you will need both an SMS code and a password"; passkeys "can be used instead of SMS". Several accounts in one app, each on its own number. "private messaging on Telegram is free and will stay free". AI features "run on Cocoon and never send any data to third parties".
   - TG-02 End-to-End Encryption, Secret Chats, https://core.telegram.org/api/end-to-end . "Secret Chats are one-on-one chats"; "Secret chats are associated with specific devices (or rather with authorization keys ), not users." Described only through the full client interface (messages.sendEncrypted), not the Bot API.
   - TG-03 Bots FAQ, https://core.telegram.org/bots/faq . "In a single chat, avoid sending more than one message per second." "In a group, bots are not be able to send more than 20 messages per minute." About 30 a second for broadcasts.
   - TG-04 Bot Features, https://core.telegram.org/bots/features . "Each bot has a link that opens a conversation with it in Telegram"; "Your backend should always verify that received commands are valid and that the user was authorized to use them". No bots-per-account limit in the BotFather section.
   - TG-05 Bots introduction, https://core.telegram.org/bots . "free for both users and developers"; "Telegram's intermediary server handles all encryption and communication with the Telegram API."
   - TG-06 Bot API (Bot API 10.3, August 24, 2026), https://core.telegram.org/bots/api . "Incoming updates are stored on the server until the bot receives them either way, but they will not be kept longer than 24 hours." Chat type "can be either “private”, “group”, “supergroup” or “channel”" (no secret chat type). The only secret chat mention: an inline query may arrive "from a secret chat". Message.from, User.id. A BotAccessSettings field "is_access_restricted" exists, tied to managed bots only.
   - TG-07 Premium FAQ, https://telegram.org/faq_premium . "All features that existed before Telegram Premium was introduced remain free to use – including unlimited cloud storage". No price shown. Price label: gated and unverified (the page says price depends on the phone number's country and the store).
   - TG-08 Privacy Policy (changelog to August 21, 2026), https://telegram.org/privacy . 3.3.1: "We store messages ... from your cloud chats on our servers". 3.3.2: "We do not store your secret chats on our servers." 5.3: "We may also use automated algorithms to analyze messages in cloud chats to stop spam and phishing." 5.6: no private chat content mined for ads. 6.3: "Bots will obviously get your messages when you send them something." 8.4: translation "may rely on Google LLC or Microsoft Corporation" (conflicts with TG-01's Cocoon statement). 10.4: inactive accounts deleted after 18 months by default. No statement on AI training.
   - HC-T1 Healthchecks.io Telegram integration, https://healthchecks.io/integrations/telegram/ . Posts to "an appropriate Telegram user, group or channel" through HealthchecksBot.
   - SL-01 Usage limits for free workspaces, https://slack.com/help/articles/115002422943 . 90 days visible; "Messages and files more than one year old will be permanently deleted"; "You can add up to 10 third-party or custom apps"; an unnumbered high-volume message limit.
   - SL-02 Feature limitations on the free version, https://slack.com/help/articles/27204752526611 . Same history and app limits; Google sign-in (OAuth) is lost on downgrade.
   - SL-03 Slack pricing, https://slack.com/pricing . Free "$0 USD free forever ... 90 days of message history ... Up to 10 apps". Pro "$8.75 ... per user / month, when paying monthly $7.25 ... when paying annually". Price label: published.
   - SL-04 Healthchecks.io Slack integration, https://healthchecks.io/integrations/add_slack/ . "Add to Slack", then pick a channel. (My inference: it uses one of the 10 app slots.)
   - SL-05 Configure your Slack notifications, https://slack.com/help/articles/201355156 . "By default, you'll receive mobile notifications one minute after locking your desktop screen or 10 minutes after Slack stops detecting cursor activity."
   - SL-06 Slack security, https://slack.com/trust/security , and EKM page. "customer data is encrypted at rest and in transit by default"; no end-to-end claim; EKM is an Enterprise Grid add-on.
   - SL-07 Privacy principles, https://slack.com/trust/data-management/privacy-principles . "We do not develop generative AI models using Customer Data." Global (non-generative) models analyse messages unless the owner opts out by email.
   - SL-08 Slash commands (3000 milliseconds), Socket Mode ("without exposing a public HTTP Request URL"), conversations.history (Tier 3, "50+ per minute"), and the 2025 rate limit changelog ("Internal customer-built applications are not impacted"). docs.slack.dev.
   - SL-09 Create a Slack workspace and Set up two-factor authentication. Company domain email suggested, no phone step; two-factor by text or authenticator app, optional on free.
   - Dead ends: https://healthchecks.io/integrations/slack/ (404); https://slack.com/pricing/pro (no prices in its text); the Telegram page "Why Telegram isn't End-to-End Encrypted by Default" was not opened, so not cited.
14. Sources tab fix found and tested live before editing (decision D3). The main overflow is the plain list under "14. Sources" (`#v-sources p.small`): long web addresses do not wrap. The record list below it (`.srcitem .kv`, grid "1fr auto") also overflows. Injected into the served page at 375 pixels: page width 758 before, 375 after. At 1280 pixels: 1280 before and after, so the desktop look is unchanged. The rule: `#v-sources p.small{overflow-wrap:anywhere}` plus, inside the existing phone-width media query only, `#v-sources .srcitem .kv{grid-template-columns:auto minmax(0,1fr)}` and `overflow-wrap:anywhere` on its cells.
15. Matrix and Healthchecks.io helper returned. Every page opened with plain `curl`, default identification string, 2026-10-28, all HTTP 200, strength A. Healthchecks.io code read at commit f6c46b59 (the hosted service may run a different commit).
   - MX-01 matrix.org homeserver pricing, https://matrix.org/homeserver/pricing/ . Free plan "10MB maximum per attachment", "100MB per 24 hours, up to 500MB per 28 days"; message text does not count; "Details of pricing have not yet been finalised"; users not on a plan "may be changed to a free plan in the future, and will be notified in advance". Price label: Premium has no price to label; free published.
   - MX-02 matrix.org Terms (effective August 14, 2025), https://matrix.org/legal/terms-and-conditions/ . "have a valid, verified email address linked to your account"; no clause allows or forbids user-run bots; bars "unsolicited or bulk communications"; "We do not offer contracted SLA"; "We do not reset passwords or reactivate accounts."
   - MX-03 matrix.org Privacy Notice (effective August 25, 2025), https://matrix.org/legal/privacy-notice/ . Phone "if you choose to provide it"; "We do not profile users or their data on the Service."; no AI statement; "Storing and sharing this content is the reason the Service exists." No history time limit found.
   - MX-04 "Matrix.org is now running MAS!", April 8, 2025. Future: "Support for 2FA, MFA, Passkeys etc". The helper searched the blog archive, the homeserver category, blog index pages 1 to 3 and four 2025 to 2026 posts: no post says two-factor sign-in is live. Recorded as not found.
   - MX-05 Element Classic to Pro FAQ. "The Element Classic app will be sunset on 31.12.2026"; "Verification of the device (session) is mandatory when you sign in."
   - MX-06 Older Matrix FAQ (staleness banner). "New rooms have encryption enabled by default".
   - MX-07 Client-Server API v1.19, https://spec.matrix.org/latest/client-server-api/ . next_batch and since; a "limited" response "forms a gap" that /messages fills; sender is "the fully-qualified ID of the user who sent this event"; M_LIMIT_EXCEEDED; join rule "invite".
   - MX-08 Post-mortem, https://matrix.org/blog/2025/10/post-mortem/ . "unavailable from 2025-09-02 17:45 UTC and full service resumed at 2025-09-03 18:00 UTC."
   - MX-09 Element push gateway page. Stock apps use an Element push gateway through Apple or Google; "A notification will not contain sensitive content."
   - MX-10 "Exclude insecure devices", https://matrix.org/blog/2025/11/exclude-insecure-devices/ . Element planned to stop sending encryption keys to unverified devices "in April 2026". Not confirmed shipped. A bot reading an encrypted room would need a verified (cross-signed) device (my inference).
   - HC-01 Healthchecks.io pricing, https://healthchecks.io/pricing/ . Hobbyist "$0 / month", "Monitor 20 jobs"; Supporter 5 dollars; Business 20 dollars. No restriction by integration type. Price label: published.
   - HC-02 Healthchecks.io home page. Integrations include Discord, Google Chat, Matrix, Signal, Slack, Telegram and Zulip.
   - HC-03 Configuring Notifications. Only SMS, WhatsApp and phone calls are quota-limited; "Set up notifications using two different notification channels (for example, email and Slack)."
   - HC-04 Discord integration code. "Connect Discord"; scope "webhook.incoming"; posts to the stored webhook address.
   - HC-05 Matrix integration code. Plain "m.room.message", no encryption; "Do not invite to rooms with sensitive content."
   - HC-06 Telegram integration code. "6 messages for a single chat per minute".
   - HC-07 Default email route (accounts/views.py) and Management API docs, https://healthchecks.io/docs/api/ . A new account gets an email integration; checks created through the API get "no integrations" unless channels is "*".
16. Scored and ranked all six candidates by script (scratch folder, not the repo) before writing any conclusion. Score bases are in decision D4. First output: Discord 4.50, Telegram 4.18, Matrix 3.51, Google Chat 3.38, Signal 2.97, Slack 2.88. Discord is first or tied first in all 9 weightings. In the "encryption and privacy 15 each" weighting Telegram is numerically ahead (3.86 against 3.83), and Discord counts as tied first only under the 0.10 rule. Across the 17 falsifiability items: Discord first outright in 9 (items 6, 8, 10 to 15, 17), tied in 5 (1, 4, 7, 9, 16), Telegram first in 3 (2, 3, 5). (Corrected after the advisor's second call; the first version of this line miscounted.)
17. Called the advisor after scoring, before writing. Advice taken: fix step 16's count (done in place, marked); check the one score this run raised for Discord (commands 4 to 5): with it left at 4, Discord is 4.35 against Telegram 4.18, still first; open every cited Signal article on its rendered page; add two Discord setup steps (the bot's role needs View Channel and Read Message History on the command channel, because the private server recipe clears @everyone's permissions and the Message resource says without READ_MESSAGE_HISTORY "no messages will be returned"; and Healthchecks.io checks created through its API need channels "*" or the email backup never fires); wording care on history ("tied to the account's life", not "forever"), the desktop holdback (cite nothing), Telegram ("anyone can message the bot" is an inference), Matrix commands (inference from a planned change), Signal (auto-messaging clause unsettled); HTML checks (other tabs' links, the click handler, the header note, a before and after screenshot of the Sources tab).
18. Opened the ten remaining cited Signal support articles with Playwright on their rendered pages and checked each quoted string: all ten loaded (HTTP 200), nine quotes found as written. On "Signal Official Chat" the "one-way only" quote is there, but "Security bots or customer service bots do not exist" is not (the helper took it from a different anti-phishing article). That quote is dropped and not cited.
19. Encryption score bases (decision D4): Telegram 2 against Discord 1 is kept, for a stated reason: Michael can use an end-to-end encrypted Secret Chat for his own human conversations on Telegram, while Discord has no encrypted text at all. Neither encrypts bot traffic. Setting Telegram to 1 moves it to 4.13 and changes nothing.
20. Wrote `runs/run-5-deliverable.md` from a draft with register IDs as footnotes, numbered by script in order of first use (83 sources at first, 89 after step 23; none unused). The sensitivity and falsifiability tables are generated from the scoring script's saved output, so they cannot drift from it. Checked by script: no em or en dashes; no paragraph or bullet over three sentences outside tables (four were split, and the acronym list was made a sub-list); every acronym defined in "How to read it".

21. Rebuilt `runs/run-3-deliverable.html` by script from a saved copy of the old page (decision D5). The Messaging tab is re-rendered from `runs/run-5-deliverable.md` by the renderer proven in step 7, with footnotes as "r5src-" anchors and a separate run 5 source list (83 entries at first, 89 after step 23); the old run 4 source data was replaced by it, and the click handler now opens a run 5 source for a footnote carrying the run 5 marker. A check before editing found no link from any other tab into the Messaging tab's anchors. The header note names run 5 as the tab's source and gained one sentence. The Sources tab CSS rule from step 14 was added. In `runs/run-3-deliverable.md`, one bullet was added at the end of the "Update, run 4" block pointing to run 5; the same item was inserted by hand into the rendered block in the Full document tab (the renderer is proven only on the Messaging tab format). Nothing else in run 3's markdown changed. Checked: no em or en dashes in the new tab.
22. Browser test with Playwright, page served by Python's built-in server, old and new page side by side. Every one of the nine tabs at 1280 and 375 pixels: page width equals window width on all 18 views of the new page (the old page's Sources tab was 758 wide at 375). The Sources tab's desktop height is unchanged (27,605 pixels) and its desktop screenshot matches the old one except for the header note's extra line. Footnote clicks: first, middle and last footnotes in the Messaging tab open "Run 5 source" panels with the right entries; all 252 Messaging footnote links resolve; a run 3 footnote in the Full document tab still opens its own source; the run 5 note shows in the Full document tab. Console: no errors on the new page; the only error seen at all was a missing favicon on the old page's first load, which predates this run.
23. Called the advisor before committing. Fixes taken: footnotes that pointed at GitHub folder pages now point at the raw files actually read (Discord and Matrix add page templates, Signal transport.py), and the Signal "6 messages a minute" limit got its own entry for hc/api/models.py (HC-S3); the bundled Slack entries were split into one per page (SL-08 Socket Mode, SL-10 slash commands, SL-11 conversations.history, SL-12 the 2025 rate limit changelog, SL-09 create a workspace, SL-13 two-factor); Healthchecks.io pricing (HC-01) is now cited for the free Hobbyist plan; "stops working" became "may stop working" for signal-cli (its README says "may not work correctly"); Google Chat's cell now says the seat is planned, not "already paid"; Slack's "one workspace per stack" is marked my judgment (its run 4 source was not reopened). The renderer now marks every paragraph after the Sources heading as small text; re-checked that it still reproduces the run 4 tab byte for byte. Rebuilt the deliverable (89 sources) and the page (261 footnote links), regenerated section 3 in place, and re-ran the browser check (step 24).
24. Re-ran the browser test on the rebuilt page: all nine tabs at 1280 and 375 pixels have page width equal to window width; all 261 Messaging footnote links resolve and the last one opens its run 5 source; the three Sources paragraphs in the tab render as small text; no console errors.

## 3. Sources

Every source cited in the deliverable, in footnote order, all accessed 2026-10-28. The quotes and fuller notes for each register ID are in section 2 (steps 5 to 15 and 18). "How opened" is the tool that read the page.

- [1] DC-04. How long Discord keeps your information (Discord support). https://support.discord.com/hc/en-us/articles/5431812448791-How-long-Discord-keeps-your-information . Accessed 2026-10-28. Opened with Playwright. Strength A.
- [2] DC-01. What are Privileged Intents? (Discord developer help center). https://support-dev.discord.com/hc/en-us/articles/6207308062871-What-are-Privileged-Intents . Accessed 2026-10-28. Opened with Playwright. Strength A.
- [3] DC-02. Gateway, sections Privileged Intents and Message Content Intent (Discord developer docs). https://docs.discord.com/developers/events/gateway . Accessed 2026-10-28. Opened with curl. Strength A.
- [4] HC-04. Healthchecks.io Discord integration, add page template (transport.py and views.py in the same folder also read). https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/discord/templates/add_discord.html . Accessed 2026-10-28. Opened with curl, GitHub API and raw files. Strength A.
- [5] DC-14. Webhook resource (Discord developer docs). https://docs.discord.com/developers/resources/webhook . Accessed 2026-10-28. Opened with curl. Strength A.
- [6] DC-03. Message resource, Get Channel Messages (Discord developer docs). https://docs.discord.com/developers/resources/message . Accessed 2026-10-28. Opened with curl. Strength A.
- [7] DC-06. Discord Terms of Service (effective September 29, 2025). https://discord.com/terms . Accessed 2026-10-28. Opened with curl. Strength A. Price label: published (free).
- [8] TG-07. Telegram Premium FAQ. https://telegram.org/faq_premium . Accessed 2026-10-28. Opened with curl. Strength A. Price label: gated and unverified (no price on the page; set by country and app store).
- [9] TG-06. Telegram Bot API (Bot API 10.3). https://core.telegram.org/bots/api . Accessed 2026-10-28. Opened with curl. Strength A.
- [10] TG-01. Telegram FAQ. https://telegram.org/faq . Accessed 2026-10-28. Opened with curl. Strength A.
- [11] DC-07. Getting Started (Discord support). https://support.discord.com/hc/en-us/articles/360033931551-Getting-Started . Accessed 2026-10-28. Opened with Playwright. Strength A.
- [12] DC-20. Every Voice and Video Call on Discord Is Now End-to-End Encrypted, Discord blog, May 18, 2026. https://discord.com/blog/every-voice-and-video-call-on-discord-is-now-end-to-end-encrypted . Accessed 2026-10-28. Opened with curl. Strength A.
- [13] DC-05. Discord Privacy Policy. https://discord.com/privacy . Accessed 2026-10-28. Opened with curl. Strength A.
- [14] DC-21. Discord status history feed. https://discordstatus.com/history.rss . Accessed 2026-10-28. Opened with curl. Strength A.
- [15] HC-03. Configuring Notifications (Healthchecks.io docs). https://healthchecks.io/docs/configuring_notifications/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [16] TG-02. End-to-End Encryption, Secret Chats (Telegram API docs). https://core.telegram.org/api/end-to-end . Accessed 2026-10-28. Opened with curl. Strength A.
- [17] SG-12. Is it private? Can I trust it? (Signal support). https://support.signal.org/hc/en-us/articles/360007320391-Is-it-private-Can-I-trust-it . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A.
- [18] SG-01. Signal Terms of Service and Privacy Policy. https://signal.org/legal/ . Accessed 2026-10-28. Opened with curl and Playwright. Strength A.
- [19] SC-01. signal-cli README (community project). https://raw.githubusercontent.com/AsamK/signal-cli/master/README.md . Accessed 2026-10-28. Opened with curl. Strength A for the project's own behaviour, D as evidence of Signal's policy.
- [20] MX-04. Matrix.org is now running MAS!, matrix.org blog, April 8, 2025, plus a search of later posts. https://www.matrix.org/blog/2025/04/morg-now-running-mas/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [21] GC-01. Google Workspace pricing. https://workspace.google.com/pricing . Accessed 2026-10-28. Opened with curl and Playwright. Strength A. Price label: published (7 dollars annual seen with curl; 8.40 monthly seen with Playwright).
- [22] GC-05. Build a Google Chat app with Pub/Sub (Google developers). https://developers.google.com/workspace/chat/quickstart/pub-sub . Accessed 2026-10-28. Opened with curl. Strength A.
- [23] SL-01. Usage limits for free workspaces (Slack help). https://slack.com/help/articles/115002422943-Usage-limits-for-free-workspaces . Accessed 2026-10-28. Opened with curl. Strength A.
- [24] DC-11. Notifications Settings 101 (Discord support). https://support.discord.com/hc/en-us/articles/215253258-Notifications-Settings-101 . Accessed 2026-10-28. Opened with Playwright. Strength A.
- [25] DC-10. [Mobile] Notifications Settings 101 (Discord support). https://support.discord.com/hc/en-us/articles/218892547--Mobile-Notifications-Settings-101 . Accessed 2026-10-28. Opened with Playwright. Strength A.
- [26] MX-09. Notifications, MDM and Push Gateway (Element docs). https://ems-docs.element.io/books/element-on-premise-documentation/page/notifications-mdm-push-gateway . Accessed 2026-10-28. Opened with curl. Strength A.
- [27] GC-10. Turn Google Chat notifications on or off (Google Chat Help). https://support.google.com/chat/answer/7655718?hl=en . Accessed 2026-10-28. Opened with curl. Strength A.
- [28] SG-11. Troubleshooting Notifications (Signal support). https://support.signal.org/hc/en-us/articles/360007318711-Troubleshooting-Notifications . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A.
- [29] SL-05. Configure your Slack notifications. https://slack.com/help/articles/201355156-Configure-your-Slack-notifications . Accessed 2026-10-28. Opened with curl. Strength A.
- [30] DC-15. Rate limits (Discord developer docs). https://docs.discord.com/developers/topics/rate-limits . Accessed 2026-10-28. Opened with curl. Strength A.
- [31] TG-03. Bots FAQ (Telegram). https://core.telegram.org/bots/faq . Accessed 2026-10-28. Opened with curl. Strength A.
- [32] MX-07. Client-Server API, version v1.19 (Matrix specification). https://spec.matrix.org/latest/client-server-api/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [33] GC-14. Usage limits (Google Chat API). https://developers.google.com/workspace/chat/limits . Accessed 2026-10-28. Opened with curl. Strength A.
- [34] SC-02. signal-cli manual page (community project). https://raw.githubusercontent.com/AsamK/signal-cli/master/man/signal-cli.1.adoc . Accessed 2026-10-28. Opened with curl. Strength A for the project's own behaviour, D as evidence of Signal's policy.
- [35] MX-10. Exclude insecure devices, matrix.org blog, November 19, 2025. https://matrix.org/blog/2025/11/exclude-insecure-devices/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [36] GC-06. Method: spaces.messages.list (Google Chat API reference). https://developers.google.com/workspace/chat/api/reference/rest/v1/spaces.messages/list . Accessed 2026-10-28. Opened with curl. Strength A.
- [37] SG-14. Signal documentation page. https://signal.org/docs/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [38] SL-08. Using Socket Mode (Slack developer docs). https://docs.slack.dev/apis/events-api/using-socket-mode . Accessed 2026-10-28. Opened with curl. Strength A.
- [39] SL-10. Implementing slash commands (Slack developer docs). https://docs.slack.dev/interactivity/implementing-slash-commands . Accessed 2026-10-28. Opened with curl. Strength A.
- [40] SL-11. conversations.history reference (Slack developer docs). https://docs.slack.dev/reference/methods/conversations.history . Accessed 2026-10-28. Opened with curl. Strength A.
- [41] SL-12. Rate limit changes for non-Marketplace apps, 2025-05-29 (Slack changelog). https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps . Accessed 2026-10-28. Opened with curl. Strength A.
- [42] TG-08. Telegram Privacy Policy. https://telegram.org/privacy . Accessed 2026-10-28. Opened with curl. Strength A.
- [43] MX-01. matrix.org homeserver pricing. https://matrix.org/homeserver/pricing/ . Accessed 2026-10-28. Opened with curl. Strength A. Price label: published (free plan); Premium has no price to label.
- [44] MX-03. matrix.org Privacy Notice (effective August 25, 2025). https://matrix.org/legal/privacy-notice/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [45] GC-08. Turn chat history on or off for an organization (Google Workspace Admin Help). https://support.google.com/a/answer/7664184?hl=en . Accessed 2026-10-28. Opened with curl. Strength A.
- [46] SG-07. Signal Secure Backups (Signal support). https://support.signal.org/hc/en-us/articles/9708267671322-Signal-Secure-Backups . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A. Price label: published.
- [47] DC-17. Opcodes and status codes (Discord developer docs). https://docs.discord.com/developers/topics/opcodes-and-status-codes . Accessed 2026-10-28. Opened with curl. Strength A.
- [48] TG-04. Telegram Bot Features. https://core.telegram.org/bots/features . Accessed 2026-10-28. Opened with curl. Strength A.
- [49] GC-04. Configure the Google Chat API (Google developers). https://developers.google.com/workspace/chat/configure-chat-api . Accessed 2026-10-28. Opened with curl. Strength A.
- [50] SG-09. Linked Devices (Signal support). https://support.signal.org/hc/en-us/articles/360007320551-Linked-Devices . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A.
- [51] DC-19. Nitro (Discord). https://discord.com/nitro . Accessed 2026-10-28. Opened with curl. Strength A. Price label: published.
- [52] SL-03. Slack pricing. https://slack.com/pricing . Accessed 2026-10-28. Opened with curl. Strength A. Price label: published.
- [53] HC-01. Plans and Pricing, Healthchecks.io. https://healthchecks.io/pricing/ . Accessed 2026-10-28. Opened with curl. Strength A. Price label: published.
- [54] HC-T1. Telegram Integration for Healthchecks.io. https://healthchecks.io/integrations/telegram/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [55] HC-05. Healthchecks.io Matrix integration, add page template (transport.py in the same folder also read). https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/matrix/templates/add_matrix.html . Accessed 2026-10-28. Opened with curl, GitHub API and raw files. Strength A.
- [56] GC-11. Google Chat integration for Healthchecks.io. https://healthchecks.io/integrations/googlechat/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [57] HC-S1. Healthchecks.io Signal integration, transport.py (forms.py in the same folder also read). https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/integrations/signal/transport.py . Accessed 2026-10-28. Opened with curl, GitHub API and raw files. Strength A.
- [58] HC-S3. Healthchecks.io models.py, Signal rate limit ("6 messages for a single recipient per minute"). https://raw.githubusercontent.com/healthchecks/healthchecks/master/hc/api/models.py . Accessed 2026-10-28. Opened with curl. Strength A.
- [59] SL-04. Healthchecks.io integration for Slack. https://healthchecks.io/integrations/add_slack/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [60] DC-08. How do I set up a private server? (Discord support). https://support.discord.com/hc/en-us/articles/206143407-How-do-I-set-up-a-private-server . Accessed 2026-10-28. Opened with Playwright. Strength A.
- [61] DC-09. Setting up Multi-Factor Authentication (Discord support). https://support.discord.com/hc/en-us/articles/219576828-Setting-up-Multi-Factor-Authentication . Accessed 2026-10-28. Opened with Playwright. Strength A.
- [62] DC-16. Application commands, including command permissions (Discord developer docs). https://docs.discord.com/developers/interactions/application-commands . Accessed 2026-10-28. Opened with curl. Strength A.
- [63] GC-15. Deploy 2-Step Verification (Google Workspace Admin Help). https://support.google.com/a/answer/9176657?hl=en . Accessed 2026-10-28. Opened with curl. Strength A.
- [64] SG-04. Signal PIN (Signal support). https://support.signal.org/hc/en-us/articles/360007059792-Signal-PIN . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A.
- [65] SL-13. Set up two-factor authentication (Slack help). https://slack.com/help/articles/204509068-Set-up-two-factor-authentication . Accessed 2026-10-28. Opened with curl. Strength A.
- [66] GC-02. Build a Google Chat app as a webhook (Google developers). https://developers.google.com/workspace/chat/quickstart/webhooks . Accessed 2026-10-28. Opened with curl. Strength A.
- [67] SG-06. Can I use Signal for work? (Signal support). https://support.signal.org/hc/en-us/articles/360007319731-Can-I-use-Signal-for-work . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A.
- [68] MX-02. matrix.org Terms and Conditions (effective August 14, 2025). https://matrix.org/legal/terms-and-conditions/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [69] SG-02. Phone Numberless Registration for Android beta (Signal support). https://support.signal.org/hc/en-us/articles/11197884108826-Phone-Numberless-Registration-for-Android-beta . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A. Price label: published.
- [70] SL-09. Create a Slack workspace (Slack help). https://slack.com/help/articles/206845317-Create-a-Slack-workspace . Accessed 2026-10-28. Opened with curl. Strength A.
- [71] DC-12. How to Verify Your Discord Account (Discord support). https://support.discord.com/hc/en-us/articles/6181726888215-How-to-Verify-Your-Discord-Account . Accessed 2026-10-28. Opened with Playwright. Strength A.
- [72] SG-05. Register a phone number (Signal support). https://support.signal.org/hc/en-us/articles/360007318691-Register-a-phone-number . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A.
- [73] DC-13. Discord Account Switcher FAQ (Discord support). https://support.discord.com/hc/en-us/articles/4412732047127-Discord-Account-Switcher-FAQ . Accessed 2026-10-28. Opened with Playwright. Strength A.
- [74] MX-06. Older Matrix FAQ (page marked as not updated in a while). https://matrix.org/docs/older/faq/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [75] GC-12. About client-side encryption (Google Workspace Admin Help). https://support.google.com/a/answer/10741897?hl=en . Accessed 2026-10-28. Opened with curl. Strength A.
- [76] SL-06. Slack security. https://slack.com/trust/security . Accessed 2026-10-28. Opened with curl. Strength A.
- [77] GC-13. Generative AI in Google Workspace Privacy Hub. https://support.google.com/a/answer/15706919?hl=en . Accessed 2026-10-28. Opened with curl. Strength A.
- [78] SL-07. Privacy principles: search, learning and artificial intelligence (Slack). https://slack.com/trust/data-management/privacy-principles . Accessed 2026-10-28. Opened with curl. Strength A.
- [79] DC-22. Discord Community Guidelines. https://discord.com/guidelines . Accessed 2026-10-28. Opened with curl. Strength A.
- [80] TG-05. Bots: An introduction for developers (Telegram). https://core.telegram.org/bots . Accessed 2026-10-28. Opened with curl. Strength A. Price label: published (free).
- [81] MX-05. Element Classic to Pro mobile apps FAQ (Element docs). https://docs.element.io/latest/element-server-suite-pro/migration/classic-to-pro-mobile-apps-faq/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [82] MX-08. Post-mortem of the September 2 outage, matrix.org blog, October 2025. https://matrix.org/blog/2025/10/post-mortem/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [83] HC-02. Healthchecks.io home page, Integrations list. https://healthchecks.io/ . Accessed 2026-10-28. Opened with curl. Strength A.
- [84] GC-07. Pub/Sub pricing (Google Cloud). https://cloud.google.com/pubsub/pricing . Accessed 2026-10-28. Opened with curl. Strength A. Price label: published.
- [85] SC-04. signal-cli wiki, Linking other devices (community project). https://raw.githubusercontent.com/wiki/AsamK/signal-cli/Linking-other-devices-(Provisioning).md . Accessed 2026-10-28. Opened with curl. Strength A for the project's own behaviour, D as evidence of Signal's policy.
- [86] SG-10. Open Signal on your phone to keep your account active (Signal support). https://support.signal.org/hc/en-us/articles/9021007554074-Open-Signal-on-your-phone-to-keep-your-account-active . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A.
- [87] SG-03. Phone Number Privacy and Usernames (Signal support). https://support.signal.org/hc/en-us/articles/6712070553754-Phone-Number-Privacy-and-Usernames . Accessed 2026-10-28. Opened with help center interface and Playwright. Strength A.
- [88] SL-02. Feature limitations on the free version of Slack. https://slack.com/help/articles/27204752526611-Feature-limitations-on-the-free-version-of-Slack . Accessed 2026-10-28. Opened with curl. Strength A.
- [89] HC-07. Healthchecks.io Management API docs, and the default email integration in its account code. https://healthchecks.io/docs/api/ . Accessed 2026-10-28. Opened with curl. Strength A.

Read but not cited (kept for the record): DC-18 (interactions, 3 second reply rule), SG-08 (backups and device transfers), SG-13 (Signal Official Chat), SC-03 and SC-05 (signal-cli captcha wiki, signal-cli-rest-api), HC-S2 (Healthchecks.io self-hosted docs), HC-06 (Healthchecks.io Telegram code), GC-03 and GC-09 (Google Chat interactions, history in spaces). All accessed 2026-10-28.

## 4. Decision points

- **D1. A sixth candidate: Google Chat inside Google Workspace.** Added because the brief's own context points to it: Michael plans a sib-tech Workspace, and Healthchecks.io lists Google Chat (HC-02). It is not a free app, so its free tier score (2) reflects a paid seat (GC-01) and a Google Cloud project with billing for the command route (GC-05). Considered and not added: Zulip (on Healthchecks.io's list, but nothing in the brief points to it; not researched), push-only apps such as Pushover and ntfy (cannot take commands, job 3 fails).
- **D2. Criteria and weights**, fixed before any total (step 9). Encryption and vendor privacy were split into two small criteria, so neither hides the other. "Two-way commands" now asks for a route the vendor supports, because Signal's only route is a community tool its terms may forbid.
- **D3. Sources tab fix** (step 14). Wrap rule for the plain source list on every width; the grid change for the record list only inside the phone-width media query, so the desktop look is unchanged.
- **D4. Score bases that are judgments.**
  - Discord commands 5 (run 4: 4). Message Content is now settled from DC-01 and DC-02, with a direct message and mention fallback. At 4, Discord is 4.35, still first.
  - Discord free tier 5. DC-04 ties retention to the account's life and names no limit on messages; the two-year inactivity deletion is a con, not a cap.
  - Telegram encryption 2, Discord 1 (step 19).
  - Signal commands 1: no official interface (SG-14), terms bar "auto-messaging" (SG-01), and the community tool expires after three months (SC-01). Signal free tier 4, not 5: history lives on the device (SG-01), safe only with Secure Backups turned on (SG-07).
  - Signal separation 2 and Healthchecks.io 3: one number per stack bot (SG-06); Healthchecks.io sends only to a number or username, no groups found (HC-S1).
  - Matrix commands 3 (run 4: 4): a planned change to exclude unverified devices (MX-10, not confirmed shipped) adds build risk in encrypted rooms. Inference, labelled.
  - Push: Signal, Slack and Google Chat 3, because each has a documented case where the phone stays quiet while another device is active (SG-11, SL-05, GC-10). Discord 4, because its desktop holdback is unconfirmed and no source was read for it.
  - Google Chat free tier 2: paid seat, billing account required. Item 14 tests counting the seat as already paid.
- **D5. Run 3's files.** The pick is Discord, as run 4 already wrote into run 3. Per the brief, run 3's markdown gets only a one-line note in its update block pointing to run 5, and the page's Messaging tab is rebuilt from this run's deliverable.

## 5. Dead ends

- Discord Developer Policy (docs.discord.com/developers/policies-and-agreements/developer-policy): 403 to curl. Not needed; not cited.
- Bot applications per Discord account: not found (developer help center search, apps overview). Recorded as open.
- Run 4's "Inactive Account Deletion" address now opens a different article. The inactivity rule is cited from DC-04.
- Run 4's four search-summary sources (community posts on the desktop holdback, a Telegram bots-per-account secondary site, a GrapheneOS thread): not reopened and not cited. The holdback is written as an untested report with a test.
- Rendered support.signal.org pages refuse plain requests (Cloudflare). Read through Signal's own help center interface and then confirmed with Playwright.
- "Security bots or customer service bots do not exist": not on the cited Signal page; dropped (step 18).
- Healthchecks.io /integrations/signal/, /integrations/slack/, /integrations/ and /docs/signal/: 404.
- Six Google Workspace admin help pages: generic page to curl; not cited. Whether a personal Gmail account can use Chat webhooks: no page says outright.
- Telegram's "Why Telegram isn't End-to-End Encrypted by Default" page: not opened, not cited.
- Matrix "This Week in Matrix" posts and the July 2025 database corruption post: not read.

## 6. Self-assessment against the standard

**1. Every connector claim traced to a live source with an access date. Met.** 89 sources, all opened and read on 2026-10-28, with plain requests or Playwright. None comes from a search result summary, which was run 4's main weakness. Signal's support articles were first read through Signal's own help center interface, then each cited one was confirmed on its rendered page with Playwright (one quote that was not on its page was dropped).

**2. Pricing verified rather than recalled. Met.** Discord Nitro, Slack Pro, Google Workspace Starter (annual with curl, monthly with Playwright), Pub/Sub, Signal backups and the Signal numberless beta are labelled published. Telegram Premium is gated and unverified (no price on its page). Matrix Premium has no price to label.

**3. Each option's failure mode named. Met.** Section 4 names one for all six.

**4. The recommendation falsifiable. Met.** Section 6 lists 17 items, each re-ranked by script for all six candidates. Two facts alone make Telegram the pick (items 2 and 3), one pair does (item 5), five make a tie.

**Scored and ranked by script before any conclusion. Met.** Criteria and weights were written down before the first total (step 9). The script asserts free tier limits outweigh every other criterion in every weighting.

**The brief's specific instructions.**
- Discord history: settled as far as Discord's pages go. Retention is tied to the account's life, with no limit on messages named. No page promises messages are kept forever, and the deliverable does not claim it.
- Discord bots reading messages: settled. Under 10,000 users the Message Content toggle needs no review, and direct messages and mentions are readable without it.
- Signal's bot options: settled from Signal's pages and the projects' own documentation. No official interface; the terms clause on "auto-messaging" leaves a personal bot unsettled.
- Telegram Secret Chats: Michael's note confirmed. Whether a bot can join one: no page says either way.

**Where the run fell short.**
- The Discord desktop holdback is untested by design. It stays the cheapest open test.
- The number of bot applications one Discord account may own was not found.
- Several scores are judgments (decision D4), chiefly the raise of Discord's commands score. The pick survives that score at its run 4 value (4.35 against 4.18).
- Google Chat's free tier score of 2 is a judgment about a paid product in a free-app comparison; item 14 shows the pick holds even if the seat counts as already paid.
- Step 16's first count was wrong and was corrected in place after the advisor's check.
- Healthchecks.io code was read at one commit; the hosted service may differ.
