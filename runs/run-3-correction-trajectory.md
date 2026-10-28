# Run 3 correction: trajectory

Research input for a human decision, never an instruction to act.

## 1. The brief as given

Verbatim, also saved as `runs/run-3-correction-brief.md`.

> # Run 3 correction brief: fix option C's scoring and rebuild the deliverable
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
> ## What this is
>
> This is a correction to run 3, not a new research run. No lever changes. The goal, sources, standard and prohibitions of run 3 still apply, except where this brief says otherwise.
>
> Why: Michael and the planning chat found a scoring inconsistency in `runs/run-3-deliverable.md`, and Michael needs every option, value and recommendation accurate before he decides what to build.
>
> ## Step zero: save this brief
>
> Before anything else, write this entire brief, verbatim and unedited, to `runs/run-3-correction-brief.md`. Then create `runs/run-3-correction-trajectory.md`, paste this brief into its first section, and append to it as you work.
>
> ## The inconsistency
>
> - Option B scores "On demand" 5 because Claude can answer questions by reading the Supabase database.
> - Option C uses the same Supabase database (its Memory row in section 9.2), so Claude can read it the same way. Yet C scores "On demand" 3 ("nothing to ask unless an interface is built"), which pulls C's flexibility to 3.
> - Applied consistently, C's "On demand" is 5 and its flexibility is 5. Run 3's own section 12, item 5, computed this case: C becomes 4.25 under the software driver.
>
> ## The task
>
> 1. Correct option C's "On demand" and flexibility scores, under both drivers, and every sentence that depends on them (C's pros, cons, "How Michael uses it", the driver comparison, and anywhere else C is described as hard to ask).
> 2. Audit every other score in sections 9 and 10, for all four options and both drivers, against the anchors in section 4 and against each other. Apply the same test: does the same fact get the same score in every option? Correct any other inconsistency you find, and list each one.
> 3. Re-rank all four options under both drivers by script, before writing any conclusion. Recompute every figure that depends on the scores:
>    - weighted totals and averages
>    - the sensitivity table and the robustness count in section 10
>    - every falsifiability item and the full re-ranking table in section 12 (rewrite item 5, since its premise is now met)
>    - the summary, section 2's change table, and the comparison table
> 4. Re-decide the strongest pick on the corrected numbers, with the same 0.10 tie rule. If the pick changes, say so plainly and say why. If it stays, say why.
> 5. Do not re-research. Change a fact only if you find it is wrong in run 3's own sources. If you must recheck a page, Playwright is available.
>
> ## The output
>
> - Edit `runs/run-3-deliverable.md` in place, so Michael keeps one document. Git history keeps the original.
>   - Add a "Correction, 2026-10-28" block directly under the title: what was wrong, every value that changed (old and new), and whether the pick changed.
>   - Keep run 3's structure and formatting rules: bullets and tables, no paragraph longer than three sentences, plain English, no em or en dashes.
> - Rebuild `runs/run-3-deliverable.html` from the corrected markdown, in place.
>   - Keep run 3's look and feel exactly: same layout, views, styles and themes. Michael likes it.
>   - Every view, preset, weight explorer value, chart and falsifiability card must match the corrected markdown.
>   - Show the correction block on the overview.
>   - Test it in a browser with Playwright (serve it locally, as runs 1 and 2 did), click through every view, and confirm the presets reproduce the markdown's figures.
> - Record the correction in `runs/run-3-correction-trajectory.md`: what you checked, every score you changed and why, the re-rankings, and a self-assessment against run 3's standard.
>
> ## Housekeeping
>
> - `CLAUDE.md`, "How I work": the Supabase line says sib-tech uses Relii's "nano" compute. Change it to say Micro compute in `us-west-2` (Oregon), because Supabase bills Nano at the Micro price on paid plans (run 3 deliverable, section 13, item 6). Change nothing else in `CLAUDE.md`.
>
> ## Run conventions
>
> - Add one line to `runs/README.md`: "3 correction", the date, "correction: option C on-demand and flexibility scoring, plus a full score audit", outcome.
> - Update `PROJECT_STATE.md`: the Runs table, Current Stage and Next Steps.
> - Check the date with `date` before writing any date.
> - Done means: deliverable and HTML corrected and browser-tested, trajectory written, index and PROJECT_STATE.md updated, and one commit and one push. Auto-mode's carve-out covers that commit and push.
> - Then end the session.
>
> ## Prohibitions
>
> - No scaffolding, no package managers, nothing installed, no database, no accounts or signups.
> - No connector or MCP server configured for the future agent itself.
> - No credentials, API keys or account numbers in any file or commit message.
> - No reading anything in `~/Projects/relii`.
> - Never send Michael's name, email address or any other personal information to any website or service, including in request headers. Do not disguise automated requests as a regular web browser. If a page refuses plain requests, read it with Playwright or skip it and record it. Give this rule, word for word, to any helper you start.

## 2. Sequence of what was done

1. Ran `date`: Wed Oct 28 13:29 CDT 2026. Saved the brief verbatim to `runs/run-3-correction-brief.md`. Read `PROJECT_STATE.md` and `runs/README.md`.
2. Created this trajectory file with the brief as its first section.
3. Read `runs/run-3-deliverable.md` in full where scores live: the summary, section 2, section 4 (criteria and anchors), all of section 9 (options B, C, D, F), section 10, section 12 and section 13. Read run 3's trajectory decisions D9 (the scores and their bases), D13 (what the scoring script did) and D16 (the tie rule and the pick).
4. Read the structure of `runs/run-3-deliverable.html`: a hand-written template, a `DATA` object (scores, run modes, totals, presets, section 12 score changes) and a document body rendered from the markdown. The overview badges ("Strongest option, tied with D", "The equal alternative") are hard-coded in the page script.
5. Wrote a ranking script in the session scratch folder (not in the repo; it does not survive the session, so its method is recorded here). It holds the seven weights (25, 15, 15, 15, 10, 10, 10), the scores for each option under each driver, the eight weightings of section 10 and the score changes of each section 12 item. Totals are each score times its weight, summed, divided by the sum of the weights, rounded half up to two places. The research weighting scales the seven weights to 90 and adds a criterion at 10, scored 5 for D and F and 3 for B and C. The tie rule is "first, or within 0.10 of first".
6. Ran the script on run 3's original scores first. It reproduced every figure in run 3's sections 1, 2, 10 and 12 exactly, including the robustness count (B 10, D 10, C 2, F 1 of 16). This validates the script before any score is changed.
7. Ran it on the corrected scores (C's flexibility 3 to 5 under both drivers), and on two variants of a second inconsistency found in the audit (section 4, decision C2). Results are in section 4.
8. Consulted the advisor after orientation and before any edit. Advice taken: the pick changes to C, because run 3 used its judgment only to break a tie and C's lead is outside the tie rule; resolve the Claude-driver target inconsistency by restoring C's and D's target to 5 (decision C2); state in C's text that asking through Claude needs no extra build piece; rewrite section 12 beyond item 5 (items 1, 2, 4 and 6 no longer overturn, item 3 becomes a tie, item 7 becomes the item that makes B the pick); rewrite item 5 as its inverse and compute it by script; keep exactly ten items in the same order, because the page matches them by position; sweep the text for every stale phrase; and either prove a renderer reproduces the page body or mirror each edit by hand.
9. Read section 6 (driver models). Its 6.1 already says of the Claude driver's model call: "Inside a 5 minute target either way (my judgment)". This supports decision C2. Section 6 nowhere describes C as hard to ask, so it needs no change.
10. Swept the markdown by pattern for every score-dependent phrase (the old totals, "10 of 16", "tied with", "equal alternative", "runner-up", "highest", "hard to ask", "nothing to ask", "on demand is weak", "way to ask", "pick"). The places found are listed under decision C4.
11. Wrote a renderer in the scratch folder that turns the markdown (title through section 13) into the page's contents list and document body. Run on the original markdown from git (`HEAD:runs/run-3-deliverable.md`), its output is byte-identical to lines 155 to 842 of the current page, after one fix (bold text that contains a code span). This proves the page body can be regenerated from the corrected markdown without hand edits.
12. Edited `runs/run-3-deliverable.md` in place by a script of 38 exact replacements, each required to match the original text exactly once, then four more in section 12 (items 1, 2, 4 and 6 now say "The evidence" rather than "The evidence that overturns", because they no longer overturn). The correction block went directly under the title as an unnumbered heading, so the numbered section ids the page relies on did not shift.
13. Checked the edited markdown by script: every figure in section 10's sensitivity table and section 12's full re-ranking table matches the ranking script (8 and 10 rows, 0 mismatches); no em or en dashes; no paragraph or bullet over three sentences (bold lead-in labels not counted, as run 3 counted them).
14. Edited `CLAUDE.md`, "How I work", the Supabase line only: it now says Micro compute in `us-west-2` (Oregon), and why. Nothing else in `CLAUDE.md` changed.
15. Rebuilt `runs/run-3-deliverable.html` in place: the contents list and document body regenerated from the corrected markdown by the proven renderer; in the page data, C's flexibility 5 under both drivers, C's and D's Claude-driver target 5, C's on-demand mode 5, and section 12 item 5's label and score change (C's flexibility back to 3); the overview badges now read "Strongest option" on C and "Second under both drivers" on D; a correction panel added to the top of the overview, filled from the markdown's correction block; one sentence added to the header note. Layout, styles, themes and views are otherwise untouched. A diff of the page outside the document body showed only these changes.
16. Served `runs/` locally (Python's built-in web server on 127.0.0.1, nothing installed) and tested with Playwright. In the page itself, clicked all eight presets under both drivers and all ten section 12 items, and read the bars: all 16 preset rankings and all 20 item rankings equal the markdown's tables, and each item's card shows the matching list item. Also checked: the four overview cards (totals and badges), the correction panel (nine nodes, from its heading to "What else changed"), the contents list (correction first), head to head for C against D (every score row), costs for C, daily use for C (shows the new "asking Claude" line), the full document (every "On demand" score is 5), the sources view (130 records) and the source panel opening. The only console error was a missing favicon from the local server. Dark mode works, and at 390 pixels wide there is no sideways scroll. Then closed the browser and stopped the server.
17. Consulted the advisor a second time, with every file written. Advice taken: the page's head to head, costs and daily use views still opened on B, so they now open on C (head to head shows C against D, the runner-up); the correction block now also lists the worst-gap change and what each section 12 item does to the pick, and points to section 7 of this file for the full old and new figures; run 3's footnote check rerun; PROJECT_STATE's Playwright issue marked resolved and the Micro compute ruling added to its Decisions table; the commit stages files by name.
18. Re-rendered the page body from the corrected markdown, reran the footnote, dash and sentence checks, and re-tested the page in the browser (step 19).
19. Re-tested in the browser after the re-render: all 16 preset rankings and all 20 item rankings again equal the markdown; head to head opens on C against D, costs on C, daily use on C (with the new "asking Claude" line); the overview's correction panel shows both tables (11 nodes) and the overview summary opens with C. The only console error was the local server's missing favicon. Closed the browser and stopped the server.
20. Final act: one commit of the seven changed files, staged by name, and one push to `origin/main`. This file is part of that commit, so it cannot record the commit's own identifier. Pushed as the first correction commit.
21. Michael's ruling, given after that push, on the item 6 flag in decision C3: "apply it consistently. 'Hosted code proves hard to manage' lowers the ease-of-running score of every option that runs hosted code (B, C, D and F), not only B." He approved a second commit and push.
22. Re-ranked item 6 by script with every option's operability lowered by one, floored at 1: software C 4.10, D 3.95, B 3.85, F 3.70; Claude C 3.45, D 3.45, B 3.20, F 3.05. D's Claude-driver operability was already 1, so it could not fall, and that is what brings D level with C under the Claude driver.
23. Rewrote item 6 and its row in the full re-ranking table, added the ruling to the correction block ("What was wrong" and the item outcome table) and to the summary's list of what could change the pick, and noted items 5 and 6 as rewritten under "What else changed". The markdown check script, updated for the new item 6, again found 0 mismatches in sections 10 and 12; dash and sentence checks passed.
24. Re-rendered the page body from the markdown and changed item 6's score changes in the page data to all four options under both drivers. Re-tested in Playwright: item 6's card and bars show the new figures and text, the other nine items and all 16 presets are unchanged, and the overview shows the ruling and the new item 6 row.
25. Final act of this second piece: one commit and one push, approved by Michael.

## 3. Sources

No web source was opened. The brief ruled out re-research, and no fact in run 3's sources needed rechecking. Documents read, all in this repo, on 2026-10-28:

- `runs/run-3-deliverable.md` and `runs/run-3-deliverable.html` (the original, also from git as `HEAD:runs/run-3-deliverable.md`).
- `runs/run-3-trajectory.md`, decisions D9, D13, D15 and D16, and section 2 steps 19 to 28.
- `PROJECT_STATE.md`, `runs/README.md`, `CLAUDE.md`.

## 4. Decision points

- **C1. C's on-demand mode and flexibility: 3 to 5 under both drivers.** The test from the brief: B scores 5 because Michael can ask Claude, which reads the Supabase database; C keeps its memory in the same kind of Supabase database (run 3's section 9.2, Memory row), so the same fact gets the same score. With on demand at 5, every C run mode is 4 or 5 and it hosts both drivers, which is the anchor for flexibility 5. C's text now says the route is Michael's own Claude Code session and adds no build piece; D's and F's database-access build piece belongs to their research layer, which is part of the agent (advisor's point).
- **C2. C's and D's target score under the Claude driver: 4 to 5.** The audit's second same-fact inconsistency. Run 3 lowered C and D by one under the Claude driver because "the model call adds time", but left B and F level although they make the same call. Three resolutions were computed by script before choosing:
  - Leave it: C 3.45, B 3.35, D 3.30 under the Claude driver (C ties B at exactly 0.10). Robustness C 15 of 16.
  - Lower B and F to 3 (variant "fixa"): Claude C 3.45, D 3.30, B 3.20, F 3.05. Robustness C 16.
  - Raise C and D to 5 (variant "fixb", chosen): Claude C 3.60, D 3.45, B 3.35, F 3.20. Robustness C 16.
  - Why fixb: run 3's own section 6.1 says the call is "Inside a 5 minute target either way (my judgment)", and the call's reliability cost is already taken off execution for every option, a criterion section 4 defines narrowly so it does not double count criterion 3. Run 3's working line for a target score of 5 is a live stream reacting in seconds against B's one-minute check ("Not 5: no live stream"), and a call of seconds does not cross it. Lowering B and F would need the same reliability penalty again. The software driver is unchanged in all three, and the pick is C in all three.
- **C3. Audited and kept.** Every other score in sections 9 and 10 was compared across the four options and both drivers:
  - Execution (one lower under the Claude driver everywhere), path (4 and 3 everywhere), safety (4 and 3 everywhere), cost (3 everywhere, every cheapest total 145.00 to 151.69) and operability (B 4, C and F 3, D 2, one lower under the Claude driver) each give the same fact the same score.
  - Run modes: schedule and price event split timer from worker consistently (4 and 5); "each run independent" splits fresh runs from a carried state consistently; callback is 4 for B and C (a web request wakes the program) and 5 for D and F (it can also start a Claude routine, a fact only they have).
  - B's software target of 4 against anchor 5's literal "every minute or faster": kept. Run 3 read anchor 5 as seconds-level ("Not 5: no live stream"), and C2 relies on that same reading, so changing B here would apply two readings of one anchor.
  - Section 12 item 6 lowers only B's operability although C's worker is also hosted code. Kept, because the item's premise is B's functions and timer, and changing a falsifiability premise is beyond a score audit. Noted for the owner. Superseded by decision C8 on Michael's ruling.
- **C4. Sentences changed.** The summary (rewritten for C); section 2's C, D and pick rows and its key point; option B's tie pro; option C's key point, software-driver note, a new "Asking it something" line, target and flexibility rows, on-demand row, "What he checks", pros and cons (the "no easy way to ask" con replaced by its upkeep cost); option D's key point, target row, total, pros and one new con; section 10's key point, totals, averages, score rows, sensitivity table and robustness bullets; section 12's key point, every item's re-ranking and outcome, item 5 rewritten as its inverse ("C is easy to ask through Claude"), and the full table; section 13, items 1, 2 and 6. Section 6 needed no change.
- **C5. The pick: C.** Corrected base rankings: software C 4.25, D 4.10, B 4.00, F 3.85; Claude C 3.60, D 3.45, B 3.35, F 3.20. C leads by 0.15 under both drivers, outside the 0.10 tie rule. Run 3 used its "B is cheaper to be wrong about" judgment only to break a tie (D16), so it cannot override a clear lead. That argument stays in the summary, labelled as a tie-break that no longer decides.
- **C6. The re-rankings, all by script.** Robustness across 16 rankings: C first or within 0.10 in 16, D 6, B 4, F 0; exact firsts C 12, B 2, D 2. Section 12: items 1, 2, 4, 6, 8, 9 and 10 keep C; item 3 gives D tied with C; item 5 (inverse) gives a three-way tie of D, C and B; item 7 makes B the pick, clearly. Full tables are in the deliverable's sections 10 and 12.
- **C7. The page body was regenerated, not hand-edited**, because the renderer was first proven byte-identical on the original (step 11). Hand edits in the page were limited to its data object, two badges, the overview's correction panel and the header note.

- **C8. Item 6 applied to every option, on Michael's ruling.** Every option runs hosted code, so "hosted code proves hard to manage" now lowers the operability of B, C, D and F by one, floored at 1 (D under the Claude driver stays at 1). Old outcome (run 3): D, with C tied. After the first correction: C stays the pick. Now: C stays first under the software driver (4.10 against D's 3.95), and ties with D under the Claude driver (both 3.45). The floor is a property of the 1 to 5 scale, not a judgment made here.

## 5. Dead ends

- **Saving a screenshot to the session scratch folder.** The browser tool may write only inside the repo and its `.playwright-mcp/` folder, which `.gitignore` excludes. Screenshots went there and are not committed.

## 6. Self-assessment against run 3's standard

- **Met: every score that changed is listed, old and new, with its reason** (the deliverable's correction block and decisions C1 and C2).
- **Met: re-ranked by script before any conclusion was written.** The script first reproduced every original figure exactly, then produced the corrected ones, and the markdown's tables were checked against it with 0 mismatches. The page's own logic, clicked in a browser, gives the same figures.
- **Met: the pick was re-decided with the same 0.10 tie rule,** and the change is stated plainly in the correction block, the summary and section 2.
- **Met: format.** Bullets and tables, no paragraph or bullet over three sentences, no em or en dashes (checked by script). The page keeps run 3's layout, views, styles and themes.
- **Met: no re-research.** No web source was opened, and no fact, price, hour or source changed.
- **Judgment, not measurement:** C2 is a reading of an anchor. The alternatives are recorded with their totals, and none changes the pick.
- **Shortfall: the audit is one session's reading.** It applied the brief's test (same fact, same score) and found two cases. It did not re-derive any score from its sources, so a score that is wrong in the same way for every option would not show up.
- **Shortfall, carried from run 3:** C's lead rests on scores that are judgments. Section 12, item 7 (a two-week do-nothing worker trial) is the measurement that would most test it.

## 7. Full old and new figures

Every ranking below was computed by the scratch ranking script described in section 2, step 5. The old column reproduces run 3's published figures exactly.

**Sensitivity, section 10.** Old is run 3 as published on 2026-10-13; new is corrected.

| Weighting | Driver | Old, first to last | New, first to last |
| :-- | :-- | :-- | :-- |
| This run's weights | software | D 4.10, C 4.05, B 4.00, F 3.85 | C 4.25, D 4.10, B 4.00, F 3.85 |
| This run's weights | claude | B 3.35, D 3.30, C 3.25, F 3.20 | C 3.60, D 3.45, B 3.35, F 3.20 |
| All seven criteria equal | software | B 4.00, D 4.00, C 3.86, F 3.86 | C 4.14, B 4.00, D 4.00, F 3.86 |
| All seven criteria equal | claude | B 3.43, D 3.29, F 3.29, C 3.14 | C 3.57, B 3.43, D 3.43, F 3.29 |
| Operability first (30), execution 15, target 10 | software | B 4.00, C 3.75, F 3.70, D 3.65 | B 4.00, C 3.95, F 3.70, D 3.65 |
| Operability first (30), execution 15, target 10 | claude | B 3.30, F 3.00, C 2.95, D 2.85 | B 3.30, C 3.25, F 3.00, D 2.95 |
| Execution cut to 15, operability raised to 25 | software | B 4.00, C 3.85, D 3.80, F 3.75 | C 4.05, B 4.00, D 3.80, F 3.75 |
| Execution cut to 15, operability raised to 25 | claude | B 3.35, F 3.10, C 3.05, D 3.00 | C 3.40, B 3.35, D 3.15, F 3.10 |
| Close to run 2's weights | software | B 4.05, D 4.00, F 3.89, C 3.84 | C 4.16, B 4.05, D 4.00, F 3.89 |
| Close to run 2's weights | claude | B 3.47, F 3.32, D 3.26, C 3.11 | C 3.58, B 3.47, D 3.42, F 3.32 |
| A Claude research layer valued at 10 | software | D 4.19, F 3.97, C 3.95, B 3.90 | D 4.19, C 4.13, F 3.97, B 3.90 |
| A Claude research layer valued at 10 | claude | D 3.47, F 3.38, B 3.32, C 3.23 | D 3.61, C 3.54, F 3.38, B 3.32 |
| Execution raised to 35, operability cut to 5 | software | D 4.40, C 4.25, B 4.00, F 3.95 | C 4.45, D 4.40, B 4.00, F 3.95 |
| Execution raised to 35, operability cut to 5 | claude | D 3.60, C 3.45, B 3.35, F 3.30 | C 3.80, D 3.75, B 3.35, F 3.30 |
| Target raised to 25, operability cut to 5 | software | D 4.40, C 4.25, B 4.00, F 3.95 | C 4.45, D 4.40, B 4.00, F 3.95 |
| Target raised to 25, operability cut to 5 | claude | D 3.60, B 3.45, C 3.45, F 3.40 | C 3.90, D 3.85, B 3.45, F 3.40 |

**Section 12 items.** Item 5's old row is run 3's "C stays hard to ask" (C's flexibility raised to 5); its new row is the rewritten inverse (C's flexibility back to 3). Item 6's old row lowers only B's operability; its new row lowers every option's (decision C8).

| Item | Driver | Old, first to last | New, first to last |
| :-- | :-- | :-- | :-- |
| 1 | software | D 4.10, C 4.05, B 3.75, F 3.60 | C 4.25, D 4.10, B 3.75, F 3.60 |
| 1 | claude | D 3.30, C 3.25, B 3.10, F 2.95 | C 3.60, D 3.45, B 3.10, F 2.95 |
| 2 | software | D 4.10, C 4.05, B 3.85, F 3.70 | C 4.25, D 4.10, B 3.85, F 3.70 |
| 2 | claude | D 3.30, C 3.25, B 3.20, F 3.05 | C 3.60, D 3.45, B 3.20, F 3.05 |
| 3 | software | D 4.19, F 3.97, C 3.95, B 3.90 | D 4.19, C 4.13, F 3.97, B 3.90 |
| 3 | claude | D 3.47, F 3.38, B 3.32, C 3.23 | D 3.61, C 3.54, F 3.38, B 3.32 |
| 4 | software | C 4.17, D 4.00, B 3.89, F 3.72 | C 4.17, D 4.00, B 3.89, F 3.72 |
| 4 | claude | C 3.28, B 3.17, D 3.11, F 3.00 | C 3.44, D 3.28, B 3.17, F 3.00 |
| 5 | software | C 4.25, D 4.10, B 4.00, F 3.85 | D 4.10, C 4.05, B 4.00, F 3.85 |
| 5 | claude | C 3.45, B 3.35, D 3.30, F 3.20 | D 3.45, C 3.40, B 3.35, F 3.20 |
| 6 | software | D 4.10, C 4.05, B 3.85, F 3.85 | C 4.10, D 3.95, B 3.85, F 3.70 |
| 6 | claude | D 3.30, C 3.25, B 3.20, F 3.20 | C 3.45, D 3.45, B 3.20, F 3.05 |
| 7 | software | B 4.00, F 3.85, D 3.60, C 3.55 | B 4.00, F 3.85, C 3.75, D 3.60 |
| 7 | claude | B 3.35, F 3.20, D 2.95, C 2.75 | B 3.35, F 3.20, C 3.10, D 3.10 |
| 8 | software | D 4.10, C 4.05, B 4.00, F 3.85 | C 4.25, D 4.10, B 4.00, F 3.85 |
| 8 | claude | B 3.50, D 3.45, C 3.40, F 3.35 | C 3.75, D 3.60, B 3.50, F 3.35 |
| 9 | software | D 3.90, C 3.85, B 3.80, F 3.65 | C 4.05, D 3.90, B 3.80, F 3.65 |
| 9 | claude | B 3.15, D 3.10, C 3.05, F 3.00 | C 3.40, D 3.25, B 3.15, F 3.00 |
| 10 | software | D 3.95, C 3.90, B 3.85, F 3.70 | C 4.10, D 3.95, B 3.85, F 3.70 |
| 10 | claude | B 3.20, D 3.15, C 3.10, F 3.05 | C 3.45, D 3.30, B 3.20, F 3.05 |
