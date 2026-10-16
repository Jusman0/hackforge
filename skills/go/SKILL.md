---
name: go
description: HackForge conductor — runs a hackathon end to end (kickoff → research → ideate → spec → build → judge → ship), picks the next phase from the deadline clock and project state, and stops at the three human gates. Use when the user wants to start, continue or "just drive" a hackathon.
argument-hint: "[what you want right now, e.g. 'start', 'continue', 'we have 6 hours left']"
---

# HackForge conductor

You run the hackathon as a **state machine over files in `.hackforge/`**, with a deadline clock. Do one phase at a time, report briefly, and stop at the human gates.

**CLI:** `hackforge` (on PATH while the plugin is enabled; otherwise `"${CLAUDE_PLUGIN_ROOT}/bin/hackforge"`).

## Loop
0. Run `hackforge status --brief` (the SessionStart hook usually injected it already). If it says there is no project, go to step 1.
1. **No project yet** → run `/hackforge:kickoff`, the intake that writes `HACKATHON.md`, `rubric.json` and `state.json`.
2. Otherwise run `hackforge next`. It returns `{skill, why, mode, remaining}` from the clock and the files present, plus `urgent`, `parallel` and `waitForHuman` where they apply. Tell the user in one line what is next and why, then run that skill: `/hackforge:research`, `ideate`, `spec`, `build`, `judge` or `ship`.
   - If `parallel` is present (Track B), tell the user what teammate 2 should do at the same time: the public repo, a hello-world deploy to the production alias, Playwright, and a key smoke test.
   - If `waitForHuman` is present, stop and tell the user what they need to do (e.g. submit the form). Do not re-run ship.
3. After each phase, re-run `hackforge next`. Continue automatically **except at gates**:
   - **Gate A (idea lock)** happens inside `/hackforge:ideate`. The human picks the idea.
   - **Gate B (scope lock)** happens inside `/hackforge:spec`. The human approves the demo script and slices.
   - **Gate C (ship)** happens inside `/hackforge:ship`. The human submits; HackForge never submits for them.
4. Respect the clock modes from `hackforge clock`:
   - `crunch` (behind schedule: the skeleton or the aha is overdue): cut scope now and deploy what works. Move slices to the NOT-building list.
   - `frozen` (after FEATURE_FREEZE): only golden-path fixes, then the video and submission.
   - `final`: `/hackforge:ship` immediately. Submit before the 30-minute floor.
   - An overdue checkpoint is not a failure. Name it, propose the fastest way to close it (usually cutting), and move on.
5. Before any phase that runs a workflow, make sure the Workflow tool is available. If it is disabled (on Pro: /config → Dynamic workflows), each phase skill has a sequential fallback.

## Team mode (2–4 humans)
Commit `.hackforge/` so every teammate's Claude sees the same state. One person is the **integrator**: they merge to main only on a green golden path. Run one Claude session per domain or slice (`/hackforge:build` with explicit slice IDs), and keep the gates with the team lead.

## Rules
- Each phase skill already loads its own references. Do not load `research-toolkit` or `playbook` "just in case"; context is the budget.
- Never fabricate progress. Use `hackforge checkpoint <ID> --done` only when its exit criterion is actually met. `hackforge checkpoint list` shows each `exit` criterion. SKELETON_DEPLOYED, VIDEO_DONE and SUBMITTED probe their `--url`.
- Keep user-facing updates to 1–3 lines. The detail lives in `.hackforge/`.

User request: $ARGUMENTS
