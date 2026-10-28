# Run 3 correction brief: fix option C's scoring and rebuild the deliverable

## Run settings

A record for the audit trail, not instructions. Michael set these up before pasting this brief:

- Launched from `~/Projects/sib-tech` in a fresh session.
- Model: latest Opus, high effort. Advisor: on, latest Opus. Auto-mode: on.
- Playwright MCP confirmed connected with `/mcp` before pasting.
- Copied from the raw file in TextEdit.

## What this is

This is a correction to run 3, not a new research run. No lever changes. The goal, sources, standard and prohibitions of run 3 still apply, except where this brief says otherwise.

Why: Michael and the planning chat found a scoring inconsistency in `runs/run-3-deliverable.md`, and Michael needs every option, value and recommendation accurate before he decides what to build.

## Step zero: save this brief

Before anything else, write this entire brief, verbatim and unedited, to `runs/run-3-correction-brief.md`. Then create `runs/run-3-correction-trajectory.md`, paste this brief into its first section, and append to it as you work.

## The inconsistency

- Option B scores "On demand" 5 because Claude can answer questions by reading the Supabase database.
- Option C uses the same Supabase database (its Memory row in section 9.2), so Claude can read it the same way. Yet C scores "On demand" 3 ("nothing to ask unless an interface is built"), which pulls C's flexibility to 3.
- Applied consistently, C's "On demand" is 5 and its flexibility is 5. Run 3's own section 12, item 5, computed this case: C becomes 4.25 under the software driver.

## The task

1. Correct option C's "On demand" and flexibility scores, under both drivers, and every sentence that depends on them (C's pros, cons, "How Michael uses it", the driver comparison, and anywhere else C is described as hard to ask).
2. Audit every other score in sections 9 and 10, for all four options and both drivers, against the anchors in section 4 and against each other. Apply the same test: does the same fact get the same score in every option? Correct any other inconsistency you find, and list each one.
3. Re-rank all four options under both drivers by script, before writing any conclusion. Recompute every figure that depends on the scores:
   - weighted totals and averages
   - the sensitivity table and the robustness count in section 10
   - every falsifiability item and the full re-ranking table in section 12 (rewrite item 5, since its premise is now met)
   - the summary, section 2's change table, and the comparison table
4. Re-decide the strongest pick on the corrected numbers, with the same 0.10 tie rule. If the pick changes, say so plainly and say why. If it stays, say why.
5. Do not re-research. Change a fact only if you find it is wrong in run 3's own sources. If you must recheck a page, Playwright is available.

## The output

- Edit `runs/run-3-deliverable.md` in place, so Michael keeps one document. Git history keeps the original.
  - Add a "Correction, 2026-10-28" block directly under the title: what was wrong, every value that changed (old and new), and whether the pick changed.
  - Keep run 3's structure and formatting rules: bullets and tables, no paragraph longer than three sentences, plain English, no em or en dashes.
- Rebuild `runs/run-3-deliverable.html` from the corrected markdown, in place.
  - Keep run 3's look and feel exactly: same layout, views, styles and themes. Michael likes it.
  - Every view, preset, weight explorer value, chart and falsifiability card must match the corrected markdown.
  - Show the correction block on the overview.
  - Test it in a browser with Playwright (serve it locally, as runs 1 and 2 did), click through every view, and confirm the presets reproduce the markdown's figures.
- Record the correction in `runs/run-3-correction-trajectory.md`: what you checked, every score you changed and why, the re-rankings, and a self-assessment against run 3's standard.

## Housekeeping

- `CLAUDE.md`, "How I work": the Supabase line says sib-tech uses Relii's "nano" compute. Change it to say Micro compute in `us-west-2` (Oregon), because Supabase bills Nano at the Micro price on paid plans (run 3 deliverable, section 13, item 6). Change nothing else in `CLAUDE.md`.

## Run conventions

- Add one line to `runs/README.md`: "3 correction", the date, "correction: option C on-demand and flexibility scoring, plus a full score audit", outcome.
- Update `PROJECT_STATE.md`: the Runs table, Current Stage and Next Steps.
- Check the date with `date` before writing any date.
- Done means: deliverable and HTML corrected and browser-tested, trajectory written, index and PROJECT_STATE.md updated, and one commit and one push. Auto-mode's carve-out covers that commit and push.
- Then end the session.

## Prohibitions

- No scaffolding, no package managers, nothing installed, no database, no accounts or signups.
- No connector or MCP server configured for the future agent itself.
- No credentials, API keys or account numbers in any file or commit message.
- No reading anything in `~/Projects/relii`.
- Never send Michael's name, email address or any other personal information to any website or service, including in request headers. Do not disguise automated requests as a regular web browser. If a page refuses plain requests, read it with Playwright or skip it and record it. Give this rule, word for word, to any helper you start.
