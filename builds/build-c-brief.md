# Build C brief: build stack C (cyrus) for paper trading

## Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:

- Launched from `~/Projects/sib-tech` in a fresh session.
- Model: Sonnet 5.5, high effort. Advisor: on, Opus 5.5. Auto-mode: on.
- Playwright MCP confirmed connected with `/mcp`.
- Copied from the raw file in TextEdit.

## What this is

The research phase is over. Michael has decided to build two stacks and compare them in paper trading, stack C first, then stack D. This brief covers stack C only. It is goal-level: you plan the build pieces, build them in sequence, and report after each one.

The decision and its reasoning live in this repo. Read these before planning, in full:
- `PROJECT_STATE.md` and `CLAUDE.md`
- `runs/run-3-deliverable.md`, especially section 7 (rules and brokers), section 8 (borrowing), and section 9.2 (option C)
- `runs/run-5-deliverable.md` (Discord as the messaging app)

## Step zero: save this brief

Before anything else, create `builds/` and write this entire brief, verbatim and unedited, to `builds/build-c-brief.md`. Then create `builds/build-c-log.md`. Append to the log as you work: each piece's plan, what you built, decisions and why, test results, review results, and anything left open. Do not record time spent or token cost.

## Michael's rulings for this build

Stack and accounts:
- Stack C is option C from run 3: one always-on worker on Fly.io, a Supabase project for memory and the run log, Alpaca as the broker, Discord for alerts, messages and commands, Healthchecks.io for the heartbeat, code in this repo.
- Stack C's identity is cyrus@sib-tech.co. Stack D (dexter@sib-tech.co) is built later and is off limits in this build.
- Michael creates every account himself. You do everything after: keys, configuration, build, tests.
- Credentials live in Michael's Apple Passwords. You get only the API keys the stack needs, stored as secrets on the hosting platform and in a git-ignored local file, never in the repo, a commit message, a log or Discord.
- Sign-in codes go to Michael's own phone.

Separation:
- Everything stack C uses is its own: its Alpaca paper account, its Supabase project, its Fly.io app, its Discord server, its keys. Code lives in this repo under `stacks/cyrus/`. Shared code, if any, is copied, not imported across stack folders.
- Michael accepts sharing one Alpaca login or one Discord account across both stacks only if piece 0 shows it avoids a second paid data plan or is the only way to run the bots, and only with a separate paper account and a separate Discord server per stack.

Trading, paper only:
- Paper trading only. 20,000 dollars of paper money for stack C.
- Strategy: a deliberately simple placeholder that you propose and document, long only, no shorting, flat at the close. Its job is to exercise the plumbing, not to make money. Michael is researching the real strategy separately.
- Driver: software. Fixed rules in code choose every trade. No language model in the decision or order path.
- Data: real time and consolidated across every U.S. exchange.
- A daily screen before the open builds the day's live list from the six indexes in run 3, section 7.3.
- Limits (largest position, daily loss stop, trades a day, Alpaca borrowing cap of 1, 2 or 4): each morning before the open, the stack posts its suggested limits to Discord. Michael approves or overrules each one there. If he has not answered before the open, the stack does not trade that day.
- Every order passes fixed limit checks in code first, carries a protective order held at Alpaca, and checks the stop flag first.
- Commands from Michael's phone through Discord: at least stop and status.
- A heartbeat through Healthchecks.io alerts Michael on Discord if the worker stops pinging.
- A daily summary after the close: trades, profit or loss, borrowing used, refused orders.

## How you work

Autonomy, while trading is paper only:
- Without asking, you may plan pieces, write code, add dependencies, install tools the build needs (for example Fly.io's command line tool), create database tables, deploy, test, debug, commit and push. This replaces this repo's earlier prohibition on scaffolding and installs.
- Hard stops. Always stop and ask Michael first before:
  - anything that could move any stack toward real money, including live keys or a live endpoint
  - raising a borrowing cap or a trading limit beyond what Michael approved
  - starting any new paid plan
  - deleting data or an account
  - touching stack D's resources, or anything outside stack C's

Sessions:
- Chain pieces in this one session.
- End every piece at a clean boundary before starting the next: built, tested, committed, pushed, `PROJECT_STATE.md` updated, log appended.
- After any automatic context compaction, re-read this brief, `PROJECT_STATE.md` and `builds/build-c-log.md` before continuing.
- If you sense you are running short of room, finish the current piece and stop rather than starting a new one.
- After each piece, give Michael a short summary in the terminal: what was built, test results, review result, what is next.

Checks and review:
- Every piece: an automated secret scan before every commit, which refuses the commit if it finds a key, and the full test suite passing.
- Pieces that touch money (broker connection, limit checks, order sending, end-of-day close-out, the morning limits flow, the stop command), and the end of every phase: run the `build-reviewer` agent. Give it the stack, the piece's goal, the commit range and the round.
- Fix blocking findings and re-run the reviewer. At most two rounds. If round 2 still has a blocking finding, or the reviewer returns STOP AND FLAG MICHAEL, stop and flag Michael.

## Piece 0: check, list, and stop

Research only. No accounts, no code beyond what this piece needs to record its findings. Read every source first hand; cite nothing from a search summary. Never send Michael's personal information anywhere, and do not disguise automated requests as a regular browser.

Answer, with dated sources in `builds/build-c-log.md`:
1. Alpaca: can one login hold two paper accounts? Can they share one real-time consolidated data plan? May one account's data keys feed both stacks under Alpaca's terms? Does a paper account need the 99 dollar plan for real-time consolidated data at all? Can one person hold two separate Alpaca accounts?
2. Discord: can one account own two bots, or can one bot serve two servers while keeping each server's commands separate? What must be enabled for a bot to read the messages Michael sends in a private server?
3. Fly.io, Supabase and Healthchecks.io: what stack C needs from each, and the price, confirmed on the vendor's own page.
4. Then the recommendation: how many Alpaca and Discord accounts, under which email, and why.

Then write, as a checklist for Michael, in plain English:
- every account he must create, on which site, with which email, and which plan
- every key or secret to save in Apple Passwords
- exactly how to hand you the keys the build needs (a git-ignored local file at a path you name), without pasting them into chat
- the two build-time tests: the Discord desktop holdback test (does his phone stay silent while the Discord computer app is open?) and the bots-per-account question, if piece 0 did not settle it

Commit and push piece 0, give Michael the checklist in the terminal, and stop. Wait for Michael to say the accounts are ready.

## The first piece after Michael says go

- Add a sib-tech override to `CLAUDE.md` recording the autonomy rules and hard stops above, replacing the ask-gate for commits and pushes while trading is paper only. Do not edit the root `CLAUDE.md` outside this repo.
- Update `CLAUDE.md`'s Tech stack section: decided, two stacks (C and D) under paper evaluation, with stack C's tools.
- Un-ignore `.claude/agents/` in `.gitignore`, keeping the rest of `.claude/` ignored.
- Create `.claude/agents/build-reviewer.md` with exactly the text between the two lines of five equals signs below.

=====
---
name: build-reviewer
description: Independent reviewer for sib-tech build pieces. Use after any build piece that touches money (broker connection, limit checks, order sending, end-of-day close-out, the morning limits flow, the stop command) and at the end of every build phase. Reviews with fresh context and does not edit code.
tools: Read, Grep, Glob, Bash
model: opus
---

# sib-tech build reviewer

You review one finished build piece for the sib-tech trading stack. You did not write it, and you judge it with fresh eyes. You never edit, commit, push, deploy or delete anything. You may run read-only commands and the test suite.

## What you are given

The builder tells you:
- which stack (cyrus is stack C, dexter is stack D)
- the piece's goal, in one or two sentences
- the commit range for the piece
- the review round (1 or 2)

Read the build brief in `builds/`, `PROJECT_STATE.md`, `CLAUDE.md`, and the piece's changes (`git --no-optional-locks diff` across the commit range). Never run a plain `git status`.

## What you check

1. **Does it do what the piece said it would?** Compare the code and tests to the piece's goal.
2. **Paper only.** Every broker call goes to Alpaca's paper environment. There must be no path, flag or setting by which this code reaches a live trading endpoint or uses live keys. Treat any such path as a blocking finding.
3. **Limits are enforced in fixed code, before every order.** Largest position, daily loss stop, trades a day and the borrowing cap are checked before an order is sent, and an order that fails a check is refused and logged.
4. **The stop command and the morning gate win.** The stop flag is checked before every order. With no approved limits for the day, the stack does not trade.
5. **Orders are safe to retry.** A retry or a restart cannot send the same order twice. Errors from the broker, the data feed and the database are handled, logged and alerted.
6. **Protection sits at the broker.** Every entry carries a protective order held at Alpaca. The end-of-day close-out leaves the account flat.
7. **No secrets.** No API keys, passwords, tokens or account numbers in code, tests, logs, commit messages or Discord messages.
8. **Separation.** The piece touches only its own stack's folder, accounts, database, Discord server and keys.
9. **Tests are real.** They exercise the behaviour above, including failure cases, and they pass when you run them.
10. **Hard stops respected.** Nothing moved toward real money, raised a limit or cap, started a paid plan, deleted data or an account, or touched the other stack.

## What you return

Plain English, bullets, no em or en dashes. Cite code by file and function name, not line number.

- **Verdict:** one of PASS, CHANGES REQUIRED, or STOP AND FLAG MICHAEL.
- **Round:** 1 or 2.
- **Blocking findings:** each with what is wrong, why it matters, and what would fix it.
- **Non-blocking notes:** short.
- **What you ran:** the commands and their results.

Use STOP AND FLAG MICHAEL for anything under checks 2, 7 or 10, or when round 2 still has a blocking finding.
=====

## Definition of done for stack C

- Every requirement under "Michael's rulings for this build" works, deployed on Fly.io against Alpaca paper.
- A full rehearsal on a recorded trading day passes: morning limits request, screen, live list, entries with protective orders, limit refusals, a stop command, the close-out, the daily summary, and a heartbeat alert when the worker is stopped on purpose.
- The `build-reviewer` agent has passed every money-touching piece and the final phase.
- `builds/build-c-log.md`, `PROJECT_STATE.md` and `CLAUDE.md` are current, and everything is committed and pushed.
- A short "first paper session" checklist for Michael is in the log: what he will see in Discord and when, what to approve, and how to stop the stack.

Then end the session. Do not start stack D.

## Prohibitions

- No live trading, no live keys, no live endpoints, anywhere.
- Nothing that touches stack D's resources.
- No credentials, API keys or account numbers in any committed file, commit message, log or Discord message.
- No reading anything in `~/Projects/relii`.
- Never send Michael's name, email address or any other personal information to any website or service, including in request headers. Do not disguise automated requests as a regular web browser. Give this rule, word for word, to any helper you start.
