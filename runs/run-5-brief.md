# Run 5 brief: choose the messaging app, with every source read first hand

## Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:

- Launched from `~/Projects/sib-tech` in a fresh session.
- Model: latest Opus, high effort. Advisor: on, latest Opus. Auto-mode: on.
- Playwright MCP confirmed connected with `/mcp` before pasting.
- Copied from the raw file in TextEdit.

## What changed from the previous run

Levers changed: context and instructions, stated openly.

Why: run 4 picked Discord (4.53) over Telegram (4.28), but the pick rests on two things Discord's own pages were not shown to confirm (no cap on free history, and bots can read channel messages). Signal was excluded on a reading, not a source (run 4 trajectory, decision D1). Four sources were cited from search summaries without being opened, including both sources for the desktop holdback caveat.

Context changes:
- Signal is a candidate.
- Michael notes that Telegram offers "Secret Chats" with end-to-end encryption, while standard cloud chats are not end-to-end encrypted by default. Verify this, and verify whether a bot can take part in a Secret Chat.
- Encryption is a preference when it is available on a free plan, not a requirement. Score it as a criterion. Unencrypted messages are acceptable.

Instructions changes:
- Open and read every source first hand. Cite nothing from a search result summary. If a page cannot be opened with plain requests or Playwright, record it as a dead end and do not cite it.
- Settle from Discord's own documentation (developer docs, help center, terms) whether free server history is capped, and whether a bot can read the messages Michael sends in a private server, including anything Discord requires before a bot may read message content.
- Settle Signal's bot or automation options from Signal's own pages and the projects' own documentation.

Not researched, and why: the reported Discord desktop holdback (phone silent while the computer app is open) can only be settled with an account, and this run creates none. Write it as a five-minute test in the setup steps for whichever app wins.

Housekeeping, not a lever: fix the Sources tab in `runs/run-3-deliverable.html` so it does not scroll sideways at phone width (run 4 recorded it as an open issue). Michael approved this. Change nothing else about the page's look.

Run 4 stays as it is, for the record.

## Step zero: save this brief

Before anything else, write this entire brief, verbatim and unedited, to `runs/run-5-brief.md`. Then create `runs/run-5-trajectory.md` and paste this brief into its first section.

## The goal

When this run is done, Michael can pick one free mobile app that does all three jobs for every stack he builds:

1. Heartbeat alerts: the heartbeat service reaches his phone when a run is missed or a worker stops pinging.
2. Regular messages from the stack: the live list, orders and fills, refusals, errors, the daily summary.
3. Commands to the stack: at least stop and status, sent from his phone.

He sees your strongest pick and why, and every claim traces to a dated live source.

### Candidates

- Telegram, Discord, Slack and Signal, on their free plans.
- Matrix on the Element app, carried from run 4.
- You may add one more if the evidence points to it. Say why.

### What you need to know

- Michael is a non-coder. He reads these messages on his phone.
- Context carried forward, unchanged: `runs/run-3-brief.md`, `runs/run-3-correction-brief.md` and `runs/run-4-brief.md`. The corrected stack pick is option C, the always-on worker.
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
- Encryption and privacy: is it end-to-end encrypted on the free plan, and does that still hold for messages a bot sends or receives? Does the vendor read or train on message content?

You choose the criteria and weights from these, and show them. Free tier limits must carry more weight than any other single criterion. Encryption is a preference, weighted as such.

## The sources

Use:
- Live web research, and Playwright for pages that need JavaScript.
- `runs/run-4-deliverable.md` and `runs/run-4-trajectory.md`. Reuse run 4's findings only after reopening each page and reading it yourself.
- `runs/run-3-deliverable.md` and `runs/run-3-correction-trajectory.md` for the stack designs the app must serve. Read the corrected deliverable's "How Michael uses it" sections before researching.

Ignore:
- Anything in `~/Projects/relii`.
- Your own recalled knowledge as evidence. Every capability and limit needs a live source.

Source strength and gated pricing: the same scale and labels as runs 1 to 3.

## The output

Build in this order: markdown and trajectory first, then the HTML.

### `runs/run-5-deliverable.md`, the source of record

1. Summary: your strongest pick and why, in bullets.
2. Criteria and weights, with a reason for each.
3. A comparison table: every candidate against every question above.
4. One section per candidate: how it would carry the three jobs, how two stacks stay separate, how commands are secured, free tier limits, account identity, pros, cons, and its failure mode (the most likely way it breaks or disappoints).
5. What Michael does to set it up, as bullets, including the five-minute desktop holdback test, and what CC would build.
6. Falsifiability: what evidence would overturn the pick.
7. Open questions.
8. Sources, numbered footnotes, same format as run 3. Every source opened and read.

Formatting: bullets and tables, no paragraph longer than three sentences, plain English, acronyms defined, no em or en dashes. State that this is research input for a human decision.

### Changes to run 3's files

- Rebuild the "Messaging" tab in `runs/run-3-deliverable.html` from `runs/run-5-deliverable.md`. Keep run 3's look and feel exactly. Footnotes in the tab link to run 5's sources.
- If your pick is not Discord (run 4's pick, already written into run 3), update `runs/run-3-deliverable.md` in place, and rebuild its HTML:
  - every example setup's tool table and totals
  - every "How Michael uses it" section
  - every other mention of Discord as the alert or command channel
  - add a dated "Update, run 5" block under the title listing each change
- If your pick is Discord, change nothing in run 3's markdown beyond a one-line note in its update block pointing to run 5.
- Test the page in a browser with Playwright (serve it locally): every tab, at desktop and phone width.

## The standard

Michael accepts the work when all of these hold:

1. Every connector claim traced to a live source with an access date.
2. Pricing verified rather than recalled.
3. Each option's failure mode named.
4. The recommendation falsifiable, stating what evidence would overturn it.

Before writing any conclusion, score and rank every candidate by script, and re-rank all of them for every falsifiability item.

## Documenting your work: `runs/run-5-trajectory.md`

Append as you work, not at the end. Six parts: the brief as given, the sequence of what you did, sources with URL and access date, decision points, dead ends, and a self-assessment against the standard. Do not record time spent or token cost.

## Run conventions

- Files: `runs/run-5-brief.md`, `runs/run-5-deliverable.md`, `runs/run-5-trajectory.md`, the updated `runs/run-3-deliverable.html`, and the updated `runs/run-3-deliverable.md` if your pick is not Discord.
- Add one line to `runs/README.md`: "5", the date, "context and instructions: Signal added, encryption preferred, every source read first hand", outcome.
- Update `PROJECT_STATE.md`: the Runs table (lever "context and instructions"), Current Stage and Next Steps.
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
