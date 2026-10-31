# sib-tech

## Start-of-session rule

At the start of EVERY session, read PROJECT_STATE.md before doing anything else. It tracks the current stage, what is done, open issues, and next steps.

## Project context

sib-tech is a U.S. stock market equities research and trading agent.

- It is for the owner's own trading. It is not a product for other people, and nothing in it is published or sold.
- Because it is personal, there is no regulatory or client-disclosure surface. That does not make the output safe to trust blindly: anything the agent produces is research input for a human decision, never an instruction to act. Say so in anything it writes.
- There is no deadline. This is a long-term build.



## Build override: stack C and stack D, paper trading only (dated 2026-10-30)

On 2026-10-29 the owner decided to build two stacks and compare them in paper trading. The brief is `builds/build-c-brief.md` (saved verbatim, do not edit it) and the running record is `builds/build-c-log.md`. **This section supersedes every rule below that conflicts with it, for as long as trading is paper only.** It supersedes these rules by name:

- "Commits and pushes stay manual and ask-gated" (How I work).
- "One build piece equals one fresh session" (How I work). Build C chains pieces in one session, each ending at a clean boundary.
- "Schema changes are written as a file, read by the owner, then applied in one approved MCP call" (How I work). Schema changes are still written as a file in the repo first, then applied by the builder.
- "Ask before anything hard to reverse: a new dependency, a schema change, a deploy" (Conventions).
- "NO SCAFFOLDING UNTIL THE STACK IS DECIDED" (Conventions). The stack is decided.
- The research-run rules (one commit and one push per run, the research-run carve-out). Those apply to research runs only. Build pieces commit and push at the end of each piece.

**Autonomy while trading is paper only.** Without asking, the builder may plan pieces, write code, add dependencies, install tools the build needs (for example Fly.io's command line tool), create database tables, deploy, test, debug, commit and push.

**Hard stops. Always stop and ask the owner first before:**

- anything that could move any stack toward real money, including live keys or a live endpoint
- raising a borrowing cap or a trading limit beyond what the owner approved
- starting any new paid plan
- deleting data or an account
- touching stack D's resources, or anything outside stack C's

**Paper only, with no exceptions.** No live trading, no live keys, no live endpoints, anywhere. Anything the stack writes or posts is research input for a human decision, never an instruction to act.

**Credentials.** The owner creates every account. The builder gets only the API keys a stack needs, kept in a git-ignored file (`stacks/cyrus/.env.local`) and as secrets on the hosting platform. Never in the repo, a commit message, a log, a chat message or Discord. The owner keeps passwords in Google Password Manager. A secret scan runs before every commit and refuses the commit if it finds a key.

**Review.** Pieces that touch money, and the end of every phase, are reviewed by the `build-reviewer` agent (`.claude/agents/build-reviewer.md`), at most two rounds. If round 2 still has a blocking finding, or the reviewer returns STOP AND FLAG MICHAEL, stop and flag the owner.

**Standing rule change (owner, 2026-10-30, night):** money-touching pieces and phase-end reviews may run up to **three** `build-reviewer` rounds without asking the owner. Stop and flag the owner if round three fails (any blocking finding), or on any `STOP AND FLAG MICHAEL` verdict for paper-only, secrets or hard-stop reasons (checks 2, 7 or 10). The reviewer agent file is a byte-exact copy of the brief and still says round 2 with a blocking finding means STOP AND FLAG MICHAEL; under this rule the builder tells the reviewer in its prompt which round is the last allowed, and a round 1 or 2 blocking finding is CHANGES REQUIRED. Future build briefs carry this rule.

**Stack separation.** Stack C is cyrus (cyrus@sib-tech.co), code under `stacks/cyrus/`. Stack D is dexter (dexter@sib-tech.co), built later, under `stacks/dexter/`, and is off limits until the owner says otherwise. Each stack has its own Alpaca paper account, Supabase project, Fly.io app, Discord server and bot, and keys. Shared code is copied, never imported across stack folders.

**Rulings after piece 0 (owner, 2026-10-30).**

- Market data: Alpaca confirmed that a paper-only login gets IEX data only, even with Algo Trader Plus, and that full SIP needs a live account. The owner will not buy the plan or open a live account. So the paper test runs on the free IEX feed, whose job is to prove the plumbing. This relaxes the brief's "real time and consolidated" data requirement, by the owner's ruling. The feed is a configuration value (`ALPACA_DATA_FEED`, default `iex`), so moving to `sip` later is a configuration change. The free IEX stream is capped at 30 symbols, which shapes the live list.
- Alpaca: one plan covers every paper account under one login. Stack D will later use its own 20,000 dollar paper account under the same login. Nothing for D now.
- Supabase: stack C's project is created with the Supabase command line tool in the owner's existing organization, region West US (Oregon).
- Discord: one Discord account for both stacks, on cyrus@sib-tech.co, with a separate private server and a separate bot application per stack. This reverses piece 0's recommendation of one account per stack. Stack C's server has channels `alerts`, `trading` and `commands`. Stack C's code accepts commands only from its own server, its own command channel and the owner's user id.

**Ruling after the first deploy (owner, 2026-10-30, night).** The limits flow moves from the morning to the evening before. After each close the stack posts the next trading day's suggested limits and a checklist to Discord; the owner approves or overrules that evening and can change them again until the open; if any limit is undecided at the open, there is no trading that day. This supersedes the brief's "each morning before the open" for the timing only. The borrowing cap is set at Alpaca at 5 minutes before the open (arming), not at approval. One extra review round (round 3) was approved once for the order-recording fix and is not a precedent.

## Tech stack

**DECIDED for the paper evaluation, 2026-10-29.** Two stacks are compared in paper trading, stack C first.

**Stack C (cyrus), option C from run 3:** one always-on worker.

- Worker: TypeScript on Node 24, run directly by Node's built-in TypeScript support, no build step. Hosted on Fly.io (one small always-on machine). Chosen because Node 24 is current and the system Python (3.9) is past end of life.
- Memory and run log: a Supabase project (Postgres), Micro compute, `us-west-2` (Oregon).
- Broker: Alpaca, paper environment only (`https://paper-api.alpaca.markets`), 20,000 dollar paper account, long only, flat at the close.
- Messages, alerts and commands: Discord (free plan), one private server for this stack.
- Heartbeat: Healthchecks.io (free plan), alerting to Discord.
- Driver: software. Fixed rules in code choose every trade. No language model in the decision or order path.
- Code in this repo under `stacks/cyrus/`. Dependencies are kept to the few the build needs, and each is named in the build log.

**Stack D (dexter):** not decided in detail, built after stack C passes. Off limits now.

## Build order

1. Scope the stack and the connector strategy. Done (runs 1 to 5).
2. Build C, piece by piece, per `builds/build-c-brief.md`. Pieces and their status are in `builds/build-c-log.md`.
3. Stack D, only after stack C is done and the owner says go.



## How I work

The owner's root MEMORY.md lives outside this repo and you cannot read it. These are the facts from it that matter here.

- **The owner is a non-coder.** Write all code. Explain in plain English. Avoid unexplained jargon, and define any acronym the first time it appears.
- Timezone is America/Chicago. Check the date with `date` before any claim that depends on it.
- GitHub handle is `mtbanta`. Repos are private.
- If this project uses Supabase, it uses Micro compute in `us-west-2` (Oregon), Relii's region. Supabase bills Nano at the Micro price on paid plans, so Micro is the real tier.
- **If this project deploys to Vercel, pin the function region to match the database region.** Relii learned this the expensive way: unpinned functions ran in Washington DC while the database sat in Oregon, and roughly 95 percent of every round trip was the journey between them.
- One build piece equals one fresh session. Clear only at a clean boundary: built, tested, committed, pushed, PROJECT_STATE.md updated.
- **Commits and pushes stay manual and ask-gated.** They are the checkpoint that catches accidental secrets, and a push triggers the deploy.
- Test against the deployed URL, not localhost, if this project ends up with no separate development database.
- Schema changes are written as a file, read by the owner, then applied in one approved MCP call. Never applied straight from a prompt.
- Claude chat owns the roadmap, the estimates and the kickoff prompts. You execute. You carry no roadmap context.



## Conventions

- File names use kebab-case.
- No em dashes or en dashes anywhere in text this project produces. Use commas, parentheses or separate sentences.
- Ask before anything hard to reverse: a new dependency, a schema change, a deploy, or anything that departs from the agreed plan.
- Say plainly when something is a guess rather than a measurement, and name what would turn it into a measurement.
- Never put credentials, API keys or account numbers in a file in this repo, in a commit message, or in PROJECT_STATE.md.
- Cite this file, PROJECT_STATE.md and any other document by its text and heading, never by line number. Line numbers drift, and a citation that drifts is worse than no citation.
- **NO SCAFFOLDING UNTIL THE STACK IS DECIDED.** This is a prohibition, not a preference. Do not run npm, pip or any package manager. Do not create package.json, a lockfile, a virtual environment, or an application directory structure. Do not create a database. Do not configure a connector or an MCP server for the agent itself. Creating a folder to hold run artifacts is not scaffolding and is allowed.
## Research runs

Until the stack is decided, work on this project happens as **research runs** rather than build pieces. A research run is one Claude Code session that researches a question, produces a deliverable, and leaves an auditable record of how it got there. The record matters as much as the answer, because the next run is scoped by changing one thing about the last one.

### Where run files live

All run artifacts go in `runs/`, numbered by run:

| File | What it holds |
| :---- | :---- |
| `runs/run-<n>-brief.md` | The kickoff for that run, saved verbatim as the first act of the session |
| `runs/run-<n>-deliverable.md` | The answer the run was asked to produce |
| `runs/run-<n>-trajectory.md` | The record of how the answer was reached |
| `runs/README.md` | The index. One line per run: number, date, what changed from the previous run, outcome |

### The trajectory file

**Write it as you go, not at the end.** Append to it after each source and each decision. A run that exhausts its context before finishing must still leave a usable trail, and a trajectory composed at the end is lost entirely when that happens.

Required structure:

1. **The brief as given**, verbatim.
2. **The sequence of what was actually done**, in the order it happened.
3. **Sources**, every one, with URL and the date it was accessed.
4. **Decision points**, each with what was chosen and why.
5. **Dead ends**, each with what was abandoned and why.
6. **Self-assessment against the standard** the brief set, including where the run fell short.

Do not record time spent or token cost. The owner has ruled those out.

### What done means for a research run

The root rule's clean boundary (built, tested, committed, pushed, state updated) does not fit a run that builds nothing. A research run is done when all five of these are true:

1. The deliverable is written.
2. The trajectory is written.
3. `runs/README.md` carries the run's one-line entry.
4. `PROJECT_STATE.md` is updated, including the Runs table.
5. The run is committed and pushed.

Then the session ends. Do not start the next run in the same session.

### Auto-mode carve-out

During a research run, auto-mode is in effect and the ask-gate in Conventions does not apply, because nothing in scope is hard to reverse: the run reads the web and writes new files under `runs/`. **The carve-out covers the commit and the push that end the run.**

The ask-gate returns the moment this repo holds application code, a dependency, or anything that could carry a credential.

### Git

The remote is `https://github.com/mtbanta/sib-tech.git`. Private, owner `mtbanta`, default branch `main`. It was created with a README, so **the remote already has history that the local folder does not**. A plain `git init` plus `git push` will be rejected.

If `.git` does not exist in this folder, wire it before doing anything else in the session, and verify each step rather than assuming it worked:

```
cd ~/Projects/sib-tech
git init
git remote add origin https://github.com/mtbanta/sib-tech.git
git fetch origin
git checkout -b main --track origin/main
```

That brings `README.md` down and leaves `CLAUDE.md` and `PROJECT_STATE.md` in place as untracked files. Then write `.gitignore` containing `.DS_Store` before the first commit.

If `.git` already exists, skip all of it.

One commit and one push per run, at the end of the run, covering everything the run produced.
