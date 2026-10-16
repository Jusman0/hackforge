---
name: spec
description: HackForge demo-first spec + Gate B — writes the demo script first, then a one-page PRD, thin vertical slices with machine-checkable contracts, the stack and a fake-vs-real ledger, red-teamed for live-demo failure and scope, then the human locks scope. Use right after the idea is locked.
argument-hint: "[constraints, e.g. 'python only', 'no auth']"
---

# Demo-first spec → Gate B (scope lock)

**The demo script is the spec.** The deadline is SPEC_LOCK (about 12% of the clock).

## Run
1. Check that Gate A is locked: `hackforge gate A`. If it is not, go to `/hackforge:ideate`. Read `.hackforge/ideas/IDEA.md`, `concept-anchor.json`, `rubric.json` and `hackforge clock`.
2. Delegate the draft to the **`hackforge:architect`** agent (Agent tool) with the paths above and the templates in `${CLAUDE_PLUGIN_ROOT}/templates/spec/`. It writes, in order: `.hackforge/spec/DEMO_SCRIPT.md`, `PRD.md`, `SLICES.md`, `STACK.md`, `FAKE_VS_REAL.md`. Tell it the time left and the team's stack skills.
3. **Red-team in parallel.** Spawn two quick agents (Agent tool) that write nothing:
   - **Breaker**: "What fails live on stage?" Look for flaky APIs, auth walls, cold starts, rate limits, data access, a demo that needs wifi, missing fallbacks.
   - **Pragmatist**: "What do we cut to make S1 deployable by SKELETON_DEPLOYED and WOW by WOW_WORKS for this team?"
   Fold their must-fix points into the spec files yourself. Keep each point to one line.
4. **Golden-path test, runnable before the lock.** The architect names a stable test id (`data-testid` or role+name) for every beat in DEMO_SCRIPT's test-id column. Copy `${CLAUDE_PLUGIN_ROOT}/templates/tests/golden-path.spec.ts` to `tests/golden-path.spec.ts`; if the project has no Playwright config, also copy `playwright.config.ts`. Write every step against those planned ids, leaving **no TODO**: `hackforge gate B --lock` refuses while any remain. The test is protected after Gate B, and builders implement the ids in the app. S1 stubs every beat, so the full test can go green locally. It is the acceptance gate for every merge and later drives the video recording.
5. **Gate B.** Show the user: the 90-second demo beats, the slice list with one-line contracts (S1 = deployed skeleton), the NOT-building list, the stack, and the top 3 fake-vs-real items. Then call **AskUserQuestion**: "Lock this scope?" Offer Lock, "Cut more", and "Change X".
6. On lock, run `hackforge gate B --lock`. It refuses if the golden-path test still has TODO markers. Locking marks SPEC_LOCK and snapshots the judge files: contracts, demo script, rubric, golden-path test and any lint/test configs that already exist. From then on the hooks protect them from Write/Edit and from shell writes. Configs scaffolded during S1 join the snapshot at SKELETON_DEPLOYED. Commit: `git add -A && git commit -m "docs(spec): lock demo script and slices"`.
7. If the stack needs MCP servers, offer `hackforge mcp <web|python>` (print or `--write`) and the official plugins (`vercel@claude-plugins-official`, `supabase@claude-plugins-official`). Ask before writing config.
8. Next step: `/hackforge:build S1`.

## Quality bar for SLICES.md contracts
Every criterion must be checkable by someone who did not write the code. Write it as a command, URL or selector with an expected result. "The UI looks good" is not a criterion. "`GET /api/analyze?demo=1` returns 200 with `result.items.length >= 3` in under 3 s" is.

Input: $ARGUMENTS
