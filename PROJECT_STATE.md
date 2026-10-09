# Project State

This file is the running status of sib-tech. Read it at the start of every session.

**HOW TO READ THIS FILE.** It accretes. An entry is true as of its own date and may be superseded further down without either entry saying so. Use it for history and reasoning. **Measure the present value rather than quoting a number from here.** Cite it by its text and heading, never by line number.

## Current Stage

**STACK RESEARCHED, NOT DECIDED.** As of October 8, 2026. Run 1 produced a recommendation with trade-offs. The decision is the owner's and has not been made. No code, no database, no deployment. `CLAUDE.md`'s Tech stack section still reads NOT DECIDED, and nothing is installed or scaffolded until the owner decides and that section is written.

Earlier entry, superseded by the paragraph above: **NOT STARTED.** Created October 7, 2026. The first piece of work is scoping the stack, between a Relii-style web application and a Claude-native agent on connectors.

## Completed

- **2026-10-08. Run 1, scope the stack.** Research and recommendation only. Read `runs/run-1-deliverable.md` (the source of record), `runs/run-1-deliverable.html` (an interactive view of the same content) and `runs/run-1-trajectory.md` (how it was reached, with a self-assessment). Five architectures were compared against seven weighted criteria, from 204 live sources accessed that day. The run's strongest pick is option D, a hybrid: a small always-on program for live prices, the settled cash ledger and orders, with Claude on top as the research layer. The lead is thin and conditional, and the deliverable's section 6 says what would overturn it. This is research input for a human decision, never an instruction to act.
- **2026-10-08. Git wired.** Local folder tracks `origin/main` on the private GitHub repo. `.gitignore` holds `.DS_Store`.

## Open Issues

Raised by run 1 on 2026-10-08. Each is quoted and sourced in the run 1 deliverable. None is resolved.

- **Anthropic's terms and a securities agent.** The Consumer Terms that govern a Max plan list relying on the service "to buy or sell securities" or to "receive advice about securities" among prohibited uses. Whether a personal research or trading agent is permitted on a Max plan, and whether the answer differs on the pay-as-you-go API, needs an answer from Anthropic in writing. See the deliverable, section 4.0.1 and section 7.
- **Market data licensing for a program.** Whether a personal program reading prices counts as "non-display use", and what that costs, is unsettled. See section 4.0.1.
- **Schwab's interface.** How long its sign-in lasts and whether it reports settled cash rest on community sources only. See section 4.0.2, category 8.
- **Two items left out of the run 1 commit on purpose.** `.claude/settings.local.json` (a per-machine settings file) and `.playwright-mcp/` (scratch snapshots written by the browser tool). The owner may want both added to `.gitignore`. See the trajectory, decisions D1 and D6.
- **The HTML was filled in partly by script.** Footnote numbers and source records were inserted mechanically. See the trajectory, decision D21, for the owner to rule on.

## Decisions


| Date       | Decision                                      | Why                                                            |
| ---------- | --------------------------------------------- | -------------------------------------------------------------- |
| 2026-10-07 | The agent is for the owner's own trading only | Owner's statement at project setup                             |
| 2026-10-07 | Stack deliberately left unscoped              | Connector-native and web-app approaches have not been compared |
| 2026-10-08 | Work proceeds as research runs, each with an auditable trajectory | The owner's iteration method: review the output and the trail, change one lever, compare the next run to the last |
| 2026-10-08 | Run 1 is stack scoping only, public-market research, no strategy | Keeps the first run falsifiable and the stack decision clean |
| 2026-10-08 | Private GitHub repo `mtbanta/sib-tech` created, wired during run 1 | Offsite trail and run-to-run diffs |
| 2026-10-08 | Cost is banded by research, not capped in advance | A ceiling given up front silently deletes options before they are researched |




## Runs

Research runs, oldest first. **Lever** is the one thing changed from the previous run: context, workspace, or instructions. Run 1 has no lever because there is no previous run.

| Run | Date | Lever changed | Outcome |
| :---- | :---- | :---- | :---- |
| 1 | 2026-10-08 | n/a, first run | Deliverable, trajectory and index written. Stack scoped, not decided. Five architectures compared from 204 dated sources. Strongest by the run's weights: option D, hybrid of an always-on worker plus Claude as the research layer, 3.85 of 5, a thin and conditional lead. Standard self-assessed as met with stated weaknesses (see the trajectory, section 6). |

The full record of each run lives in `runs/`. This table is the index you read first.

## Next Steps

As of 2026-10-08, after run 1:

1. The owner reads the run 1 deliverable and trajectory and either decides the stack or scopes run 2 by changing one lever.
2. The owner answers, or gets answered, the open questions in the deliverable's section 7. The first three (how fast it must react, how wide the live watch list is, and Anthropic's terms) decide the most.
3. When the stack is decided, record it here under Decisions and in `CLAUDE.md`'s Tech stack section. Until then the no-scaffolding rule stands.

Earlier entry, now done as far as research goes: scope the stack and the connector strategy, and record the decision here and in CLAUDE.md.

