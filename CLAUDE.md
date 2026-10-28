# sib-tech

## Start-of-session rule

At the start of EVERY session, read PROJECT_STATE.md before doing anything else. It tracks the current stage, what is done, open issues, and next steps.

## Project context

sib-tech is a U.S. stock market equities research and trading agent.

- It is for the owner's own trading. It is not a product for other people, and nothing in it is published or sold.
- Because it is personal, there is no regulatory or client-disclosure surface. That does not make the output safe to trust blindly: anything the agent produces is research input for a human decision, never an instruction to act. Say so in anything it writes.
- There is no deadline. This is a long-term build.



## Tech stack

NOT DECIDED. Do not assume one.

Deciding it is the first piece of work. The two candidate directions:

1. A web application on the Relii stack: Next.js on Vercel, Supabase for database and auth.
2. A Claude-native agent built on connectors and MCP servers, with candidates including LiquidTrade, QuiverQuant, FireCrawl and Co-Invest.

Until that is settled and written into this section, do not install dependencies, create a database, or scaffold an application.

## Build order

1. Scope the stack and the connector strategy. Produce a recommendation with trade-offs.
2. Everything after this is written once step 1 is decided.



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
