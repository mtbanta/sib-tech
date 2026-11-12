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

**Credentials.** The owner creates every account. The builder gets only the API keys a stack needs, kept in a git-ignored file (`stacks/cyrus/.env.local`) and as secrets on the hosting platform. Never in the repo, a commit message, a log, a chat message or Discord. The owner keeps passwords in Google Password Manager. A secret scan runs before every commit and refuses the commit if it finds a key. **Never skip, bypass or disable the secret scan for any commit, for any reason** (no `--no-verify`, no changed hooks path, no other workaround; Michael, 2026-11-09). If it blocks a commit, stop and tell Michael.

**Review.** Pieces that touch money, and the end of every phase, are reviewed by the `build-reviewer` agent (`.claude/agents/build-reviewer.md`), at most three rounds under the standing rule below. If round 3 still has a blocking finding, or the reviewer returns STOP AND FLAG MICHAEL, stop and flag the owner.

**Standing rule change (owner, 2026-10-30, night):** money-touching pieces and phase-end reviews may run up to **three** `build-reviewer` rounds without asking the owner. Stop and flag the owner if round three fails (any blocking finding), or on any `STOP AND FLAG MICHAEL` verdict for paper-only, secrets or hard-stop reasons (checks 2, 7 or 10). The reviewer agent file is a byte-exact copy of the brief and still says round 2 with a blocking finding means STOP AND FLAG MICHAEL; under this rule the builder tells the reviewer in its prompt which round is the last allowed, and a round 1 or 2 blocking finding is CHANGES REQUIRED. Future build briefs carry this rule.

**Standing rule (Michael, 2026-11-11, night): never fewer than three review rounds, and use the time until 7:30 AM.** Michael's words: "every group gets up to 3 review rounds, not 2. ... Standing rule from now on: never fewer than 3 review rounds, and use all available time before 7:30 AM when 3 or more hours remain." So every `build-reviewer` group (group 1, money-touching; group 2, messaging and other non-money code) may run up to three rounds, whatever a request or brief names as fewer; stop and flag Michael only as the rule above says (round three fails, or a `STOP AND FLAG MICHAEL` verdict on checks 2, 7 or 10). A deploy time Michael gives as a goal is not a stop: if a release misses it, keep going and deploy before 7:30 AM Central if it passes. When 3 or more hours remain before 7:30 AM, use all of that time (more rounds, more tests, measurements) rather than stopping early. The market-hours rule is unchanged.

**Standing rule (owner, 2026-11-03): no change to money-touching code beyond what the owner asked, unless the builder asks first.** Money-touching code is anything that can send, cancel, size, block or protect an order, or decide a limit (the order gate, the sell path, the loss stop, the close-out, the missing-exit check, the governor, limits, arming). If a fix seems to need a change outside the owner's request, stop and ask; do not build it and let review catch it. (Reason: round 8 failed review on a change of this kind that the owner had not asked for.) Future build briefs carry this rule.

**Stack separation.** Stack C is cyrus (cyrus@sib-tech.co), code under `stacks/cyrus/`. Stack D is dexter (dexter@sib-tech.co), built later, under `stacks/dexter/`, and is off limits until the owner says otherwise. Each stack has its own Alpaca paper account, Supabase project, Fly.io app, Discord server and bot, and keys. Shared code is copied, never imported across stack folders.

**Rulings after piece 0 (owner, 2026-10-30).**

- Market data: Alpaca confirmed that a paper-only login gets IEX data only, even with Algo Trader Plus, and that full SIP needs a live account. The owner will not buy the plan or open a live account. So the paper test runs on the free IEX feed, whose job is to prove the plumbing. This relaxes the brief's "real time and consolidated" data requirement, by the owner's ruling. The feed is a configuration value (`ALPACA_DATA_FEED`, default `iex`), so moving to `sip` later is a configuration change. The free IEX stream is capped at 30 symbols, which shapes the live list.
- Alpaca: one plan covers every paper account under one login. Stack D will later use its own 20,000 dollar paper account under the same login. Nothing for D now.
- Supabase: stack C's project is created with the Supabase command line tool in the owner's existing organization, region West US (Oregon).
- Discord: one Discord account for both stacks, on cyrus@sib-tech.co, with a separate private server and a separate bot application per stack. This reverses piece 0's recommendation of one account per stack. Stack C's server has channels `alerts`, `trading` and `commands`. Stack C's code accepts commands only from its own server, its own command channel and the owner's user id.

**Ruling after the first deploy (owner, 2026-10-30, night).** The limits flow moves from the morning to the evening before. After each close the stack posts the next trading day's suggested limits and a checklist to Discord; the owner approves or overrules that evening and can change them again until the open; if any limit is undecided at the open, there is no trading that day. This supersedes the brief's "each morning before the open" for the timing only. The borrowing cap is set at Alpaca at 5 minutes before the open (arming), not at approval. (The one-time extra review round approved earlier that night for the order-recording fix is superseded by the standing review rule below.)

**Build C2 (owner, 2026-11-02): close build C, then upgrade stack C for fast trading.** The brief is `builds/build-c2-brief.md` (saved verbatim, do not edit it) and the running record is `builds/build-c2-log.md`. Everything in this override still applies, with these additions for as long as trading is paper only:

- **Hard stop added:** raising the fixed ceiling of **100 orders a minute** (`MAX_TRADES_PER_MINUTE` in `stacks/cyrus/src/limits.ts`). Michael approves a trades-a-minute limit each evening between 1 and that ceiling; the code never goes above it. There is no daily trade total. **Michael's ruling of 2026-11-06:** on a load day, while its window is switched on (`load on`), the ceiling is **150** (`MAX_TRADES_PER_MINUTE_LOAD_DAY`); normal days, and a load day after `load off`, stay at 100. **Michael's decisions of 2026-11-10:** the load window runs from 8:45 AM to the 10:30 mid-day pause (not 9:00), and the 150 ceiling and the 75 dollar cap last only until the pause; after it a load day is a normal day (the approved largest position, at most 100 a minute). Raising either ceiling further is a hard stop.
- **Never deploy, restart or stop the worker during market hours** (8:30 AM to 3:00 PM Central on trading days). Deploys happen after the close (or before 7:30 AM Central if a release has passed review in time).
- **Exception (Michael's ruling, 2026-11-09): a deploy while flat and paused at mid-day.** A deploy (a worker restart) during market hours is allowed only when all of these are true, checked by `stacks/cyrus/tools/midday-deploy.mjs` right before the deploy (it refuses otherwise): today's mid-day close-out has finished flat (day phase `midday` with `middayFlat: yes`); Alpaca shows no positions and no open orders; the mid-day pause is on; the time is after the mid-day close-out and before 1:30 PM Central (after 1:30 only if Michael asks); the release has passed its group 1 review. The script pauses the Healthchecks check first. After a deploy the worker resumes trading on its own under the same day's limits unless Michael sent `hold`; a plain restart stays paused. **Fallback (Michael, 2026-11-09), only if the mid-day release is not deployed:** the cycle by hand: `stop`, `flatten`, a deploy only while Alpaca shows no positions and no open orders and the release has passed group 1, then `resume`.
- **Standing requirement (Michael, 2026-11-11): an afternoon load window on any day. Built in the release of 2026-11-11 but switched off there (option B); fixed and switched ON in the release of 2026-11-12 (Fly release v19).** While the account is flat and the mid-day pause is on, the command `load afternoon` makes the afternoon a load window with load-day limits (the 75 dollar cap, the load ceiling of 150, load-day entries and exits), whether or not the morning was a load day. If the morning was not a load day, the cheap-symbol screen (the load day's list) runs at the pause and the price feed switches to those 30 names while flat. The window ends at the 2:00 PM last entry; the 2:55 close-out runs as normal. It touches money (the gate, limits, load mode), so it needs a group 1 review before it is deployed. **Michael's answers (2026-11-11):** during the afternoon load window orders a minute may go up to 150, above the day's approved limit (his ruling, only for that window; raising it further is still a hard stop); the command resumes trading itself; it is accepted until 1:30 PM Central, not after.
- **Fly metrics token (Michael, 2026-11-11):** `FLY_METRICS_TOKEN` is a read-only Fly org token in `stacks/cyrus/.env.local` on Michael's Mac, used by the daily and mid-day reviews to read the CPU burst balance and throttling. It stays on the Mac only and is never put on Fly. The worker's own self-monitoring measures from inside the machine. Read the key file only through a Node parser; never source it in the shell (that printed a token on 2026-11-11).
- **When limits can change:** from the evening post until the "Armed" message 5 minutes before the open, any limit either way; after "Armed", only tightening (lower) until the next evening post.
- **Sells.** Alpaca's bulk "close all positions" call is not used (it cancelled the stops and then failed on 2026-11-02). Every sell goes through one checked path (`stacks/cyrus/src/sells.ts`): no sell may exceed the shares held counting sells already open. A structure test enforces this.
- Stack D, built later, gets the same capability, copied, not imported.
- **State on 2026-11-05 (evening):** Fly runs release v10, the speed release (`be62516`; group 1 PASS in round 3, approved by Michael; group 2 PASS). Every day: live order updates from Armed to the close (closes in memory first), the order sync every 10 seconds, shares left without a stop sold 3 seconds after Alpaca's cancel (measured daily against waiting 5 seconds), the loss stop's sale ahead of remainder sales, the gate's account view every 10 seconds, per-minute statistics; the 60 second time limit is removed; the loss-stop estimate is shadow only (5 second account read kept). Load days: window entries are 1-share limit buys at or below the price seen, take-profit 1 cent, stop 2 cents, cancelled after 5 seconds; a refused symbol waits 3 seconds doubling to 30 (normal days keep the minute). See `builds/build-c2-log.md`, "Speed release".
- **State on 2026-11-06 (night):** Fly runs release v11 (`0cb54ef`): lost exits sold at once by an immediate sync; the summary looks up every missing order (and missing sells from Alpaca's fills), paced; the stop-gap measurement starts at the sale; the shadow estimate keeps its own book (shadow only); 150 orders a minute while a load day's window is on. The request reserve scaled by open symbols (`reserveFor`, item 7) is built but switched off (`RESERVE_SCALING = false`, the reserve stays 80) until the early wake-up fix passes a third group 1 review (Michael's decision). See `builds/build-c2-log.md`, "Release 11".
- **State on 2026-11-06 (late night):** Fly runs release v12 (`4c19f34`) = v11 plus the early wake-up fix (`src/early-wake.ts`: a live update ends a sale's or the close-out's wait early only while Alpaca's budget is at least 20 above the reserve, at most 5 per wait). The reserve stays 80 (`RESERVE_SCALING = false`); Michael dropped the scaled reserve (item 7) on 2026-11-07, so it stays fixed at 80 for good.
- **State on 2026-11-09 (evening):** Fly runs release v13 (`c2a8216`) = v12 plus the sale logging (why a sale is blocked; logging only). The proposal `builds/c2-proposal-2026-11-09.md` (stuck sale, cleanup sale, one alert per stuck position, mid-day cycle) awaits Michael; the no-deploy-during-market-hours rule is unchanged until the mid-day cycle is approved and built.
- **State on 2026-11-09 (night):** Fly runs release v14 (`4b580d0`) = v13 plus release 1 of 2026-11-09 (cleanup sales act only on their own position; stuck positions retried on a short list, 40 requests a minute and 15 in 5 seconds, taking turns; one alert per stuck position, one at 5 minutes, one resolution line). Release 2 (the mid-day cycle) is in review.
- **State on 2026-11-09 (late night):** Fly runs release v15 (`a0ce1d7`) = v14 plus release 2, the mid-day cycle (10:30 pause and mid-day close-out; retries within 60 requests a minute and above the reserve; resume after a deploy while flat before 1:30 PM unless `hold`; `go` otherwise; half days too). The deploy-rule exception above is now in force.
- **State on 2026-11-10 (night):** Fly runs release v16 (`2b0bb6e`) = v15 plus the release of 2026-11-10 (group 1 PASS and group 2 PASS, each in round 2 of 2): fix A (a cleanup sale recounts its shares when the take-profit fills more while its cancel lands, only when the entry holds the whole symbol, and "every share gone" is sold, not stuck), fix B (the close-out's wait for its own sales reads open orders on timed looks only and re-reads positions before ending), fix C (a closing line for "not filled yet" sales; `late_notice` logging), and the load window to the mid-day pause with normal limits after it. See `builds/build-c2-log.md`, "Release of 2026-11-10".
- **State on 2026-11-11 (afternoon):** Fly runs release v17 (`f705ff9`, code of `e982b2e`) = v16 plus option B of the release of 2026-11-11 (group 1 PASS): the order gate no longer copies the day's stored orders on each decision, per-minute `self_monitor` rows during the session, wording fixes; `load afternoon` is built but switched off. Open: the daily summary fails on a day of about 8,000 entries (Alpaca's open-ended order listing takes about 28 s against the worker's 10 s limit); fix proposed in `builds/build-c2-log.md`, "Wednesday 2026-11-11 end-of-day review", section 12 A.
- **State on 2026-11-11 (night):** Fly runs release v18 (`60fb068`, merged as `e8b6904`) = v17 plus the daily summary fix (the day's orders read in bounded 5 minute windows with a 1 minute re-read; group 2 PASS in round 2): the 2026-11-11 summary posted at 10:16 PM and matched the account to the cent. The release of 2026-11-12 (Michael's answers in `builds/c2-proposal-2026-11-12.md`: the fresh stop for remainders, the fast sale for lost exits, the afternoon load window fixed and switched on) is in build and review.
- **State on 2026-11-12 (12:15 AM):** Fly runs release v19 (`7c7b109`, merged as `92fbaf6`) = v18 plus the release of 2026-11-12 (group 1 PASS in round 3 on the merged release; group 2 PASS in round 3 on each part): A4, a remainder after a partial take-profit gets a fresh stop at once (client id prefix `cyrus-p-`, counted as protection only when it covers the symbol's whole holding; a definite refusal sells at market; `BARE_GRACE_MS` 0); A5, a load entry filled after its 5 second cancel is sold at once; `load afternoon` is ON (the round 3 fixes; the one-line switch is `loadAfternoon` in `main.ts`). See `builds/build-c2-log.md`, "Release of 2026-11-12".
- **Discord footer (Michael's decision 6, 2026-11-05):** "the footer only where it applies" supersedes the C2 brief's item 16 and "say so in anything it writes" for Discord posts: the research-input line on the evening limits post and the daily summary; "Paper trading only." on alerts, the live list and the full morning review or reminder; nothing on one-line confirmations, command replies and the trade line.

## Tech stack

**DECIDED for the paper evaluation, 2026-10-29.** Two stacks are compared in paper trading, stack C first.

**Stack C (cyrus), option C from run 3:** one always-on worker.

- Worker: TypeScript on Node 24, run directly by Node's built-in TypeScript support, no build step. Hosted on Fly.io (one small always-on machine). Chosen because Node 24 is current and the system Python (3.9) is past end of life.
- Memory and run log: a Supabase project (Postgres), Micro compute, `us-west-2` (Oregon).
- Broker: Alpaca, paper environment only (`https://paper-api.alpaca.markets`), 20,000 dollar paper account, long only, flat at the close.
- Messages, alerts and commands: Discord (free plan), one private server for this stack.
- Heartbeat: Healthchecks.io (free plan), alerting to Discord.
- Driver: software. Fixed rules in code choose every trade. No language model in the decision or order path. The strategy is a deliberately meaningless **busy placeholder** (many long-only entries, each a bracket order whose take-profit and protective stop rest at Alpaca, flat at the close); its job is to prove the stack holds up at speed.
- Speed and volume (build C2): an order-rate governor in fixed code keeps headroom under Alpaca's 200 requests a minute (measured on paper, one bucket for account, order and position calls); the gate reads a cached view of the broker, not four requests per entry; Discord is never waited on in the order path (trade news goes out in batches). The worker runs in San Jose near the Oregon database; Ashburn is about 63 ms faster to Alpaca but only helps once the database write leaves the critical path (see the C2 log).
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
