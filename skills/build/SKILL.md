---
name: build
description: HackForge build phase — implements slices against their contracts with a builder agent and verifies each with a separate QA runner on the running app (capped fix rounds), deploys the skeleton early, and records checkpoints. Use to build hackathon slices after scope is locked.
argument-hint: "[slice ids, e.g. S1 or S2 S3] [parallel]"
---

# Build sprint

Ship the golden path first, keep main deployable, and let a separate judge verify.

## Before the sprint
1. Check that Gate B is locked: `hackforge gate B`. If it is not, go to `/hackforge:spec`. Check `hackforge clock`. In `frozen`/`final` mode, only golden-path fixes are allowed (see the end of this file).
2. Pick the slices: the ones in `$ARGUMENTS`, or else the next 1–3 unfinished slices from `.hackforge/spec/SLICES.md` (status lives in `.hackforge/build/`). S1 always goes first.
3. Start the dev server yourself, from the main session, so it outlives subagents: `hackforge dev up`. Fix `stack.devCommand` / `devPort` with `hackforge state set` if needed. Note the URL.
4. Choose the mode:
   - **sequential** (default, safest): one slice at a time in the main tree, at most 2 fix rounds each, stopping on a failure.
   - **parallel** (2–4 independent slices, git repo required): builders run in worktrees and an integrator merges a slice only if the golden-path smoke stays green. Use it when slices touch disjoint files.

## Run
```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/build-sprint.js",
  args: {
    projectDir: "<absolute project root>",
    pluginRoot: "${CLAUDE_PLUGIN_ROOT}",
    now: "<date -u +%Y-%m-%dT%H:%M:%SZ>",
    slices: ["S1"],
    mode: "sequential",
    label: "<sprint label, e.g. s1>",
    maxRounds: 2,
    devUrl: "<url from hackforge dev up>"
  }
})
```
Agents: up to 2 × (maxRounds + 1) per slice (builder + QA per round). At the default maxRounds 2 that is 6 per slice, so 12 for 2 slices. On small scale (Pro) use one slice per sprint, or `maxRounds: 1`. Optional `cheapModel: "sonnet"` is not used here; building needs the full model.

## After the sprint
1. Write `.hackforge/build/SPRINT-<label>.md`: slices, status, rounds, commits, open failures, contract problems. Update the Board rows in `SLICES.md` (status and last feedback file `build/feedback/<label>-<slice>-r<round>.md`); board edits are allowed after Gate B. If QA reported **contract problems**, show them to the user. Only the human may change a contract (the hook will ask).
2. **Deploy early.** S1's contract is local only (dev server, full golden path with stub data, no staged secrets). The SKELETON_DEPLOYED checkpoint checks the deploy itself. As soon as S1 passes, deploy it, e.g. `vercel --prod` (the user must be logged in; never log in for them). Give judges the **production alias**, not the hash URL.
   - Check it like a judge would: `hackforge probe <url>`. It follows redirects and fails on login and deployment-protection walls.
   - Run the golden-path smoke test against prod: `GOLDEN_SMOKE=1 BASE_URL=<url> npx playwright test tests/golden-path.spec.ts`.
   - Then run `hackforge checkpoint SKELETON_DEPLOYED --done --url <url>`. This re-probes the URL, refuses non-public URLs, and tags the commit `hf-cp/SKELETON_DEPLOYED`.
   - To roll the code back to that point without touching HackForge state: `git restore --source hf-cp/SKELETON_DEPLOYED --staged --worktree -- . ':(exclude).hackforge'`. A plain checkout would also revert the gates and checkpoints.
3. Mark WOW_WORKS (`hackforge checkpoint WOW_WORKS --done`) only when the aha works with real input and its fallbacks are in place. Then run `/hackforge:judge`.
4. Commit or confirm commits (`git log --oneline | head`). The git-guard hook scans commits and pushes for secrets.
5. Record a backup video of the golden path once WOW works, and again at freeze:
   1. Copy the recorder: `mkdir -p demo && cp "${CLAUDE_PLUGIN_ROOT}/templates/demo/record-demo.mjs" demo/`.
   2. Fill STEPS with the DEMO_SCRIPT test ids.
   3. Run `node demo/record-demo.mjs --rehearse`, then `node demo/record-demo.mjs`. It needs `playwright` in the project.

## Freeze discipline
After FEATURE_FREEZE, run sprints only with slices or fixes from the judge report's **blocking** list. Add no new dependencies and no new features. Run `hackforge checkpoint FEATURE_FREEZE --done` when the freeze is declared.

## Fallback (Workflow tool unavailable)
For each slice: Agent tool → `hackforge:builder` ("implement slice <id>"), then a separate `hackforge:qa-runner` ("verify slice <id>, write .hackforge/build/feedback/<label>-<id>-r0.md"). Run at most 2 fix rounds. Never let the builder grade its own work.

Input: $ARGUMENTS
