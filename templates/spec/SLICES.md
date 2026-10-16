<!-- HackForge template, copied to .hackforge/spec/SLICES.md by /hackforge:spec (architect agent). Gate B needs this file and spec/DEMO_SCRIPT.md.
Thin vertical slices: each one goes end to end (UI → logic → data → deployed). One end-to-end path first, never "all models, then all views".
S1 is the golden-path skeleton (every beat stubbed end to end); deploying it closes SKELETON_DEPLOYED. Each later slice makes one demo beat real.
CONTRACT = machine-checkable acceptance: a command or URL plus the exact expected output. The builder implements to it and never edits it or the golden-path tests. The qa-runner checks it against the live app and writes .hackforge/build/feedback/NNN-<slice>.md.
After Gate B the CONTRACT blocks are protected by the guard-edits hook (ask/deny), as are rubric.json and tests/golden-path*, e2e/golden-path*.
To change a contract, a human runs: hackforge gate B --unlock --note "why", edits it, then re-locks with hackforge gate B --lock.
Board owner and status may change at any time. Keep to about 6 slices for 24 h. -->

# Slices: {{Name}}

## Board
| ID | Goal (demo beat) | Owner | Status | Last feedback |
|---|---|---|---|---|
| S1 | Golden-path skeleton, deployed | {{name}} | todo | — |
| S2 | {{Aha with real input}} | {{name}} | todo | — |
| S3 | {{Fallbacks + DEMO_MODE}} | {{name}} | todo | — |
<!-- Status: todo / building / qa / pass / fail / cut. "Last feedback" = build/feedback/NNN-<slice>.md. -->

---
## S1: Golden-path skeleton
- Goal: every DEMO_SCRIPT beat reachable end to end with stub data. The app implements every test id from DEMO_SCRIPT's "Test id / selector" column, so the full golden path passes locally
- Files / areas: {{e.g. app/page.tsx, app/api/run/route.ts}} (never tests/golden-path.spec.ts: builders don't edit it)
- Out of scope: real model calls, styling, auth
- Depends on: —

<!-- CONTRACT S1 BEGIN -->
| # | Check | Command / URL | Expected |
|---|---|---|---|
| 1 | Dev server up | `hackforge dev up`, then `curl -s -o /dev/null -w "%{http_code}" {{devUrl}}` | `200` |
| 2 | Full golden path green locally, stub data | `npx playwright test {{tests/golden-path.spec.ts}}` | exit 0, {{n}} passed |
| 3 | No secrets staged | `hackforge secrets --staged` | exit 0 |
<!-- CONTRACT S1 END -->

Deploy criteria are verified by the SKELETON_DEPLOYED checkpoint, not by the sprint (no prod URL exists while S1 is built): deploy, `hackforge probe <prod alias>`, `GOLDEN_SMOKE=1 BASE_URL=<prod alias> npx playwright test tests/golden-path.spec.ts`, then `hackforge checkpoint SKELETON_DEPLOYED --done --url <alias>`.

---
## S2: {{aha beat name}}
- Goal: {{the aha works with real input}}
- Files / areas: {{…}}
- Out of scope: {{…}}
- Depends on: S1

<!-- CONTRACT S2 BEGIN -->
| # | Check | Command / URL | Expected |
|---|---|---|---|
| 1 | Aha with real input | {{command or URL + input}} | {{exact text / element / number}} |
| 2 | Fast enough on stage | {{timed command}} | {{≤ n s}} |
| 3 | Golden path still green | `npx playwright test {{tests/golden-path.spec.ts}}` | exit 0 |
<!-- CONTRACT S2 END -->

---
## S3: {{Fallbacks + DEMO_MODE}}
- Goal: {{every flaky call has a cached fallback; demo runs with Wi-Fi off}}
- Files / areas: {{…}}
- Out of scope: {{…}}
- Depends on: S2

<!-- CONTRACT S3 BEGIN -->
| # | Check | Command / URL | Expected |
|---|---|---|---|
| 1 | Demo mode serves cached output | {{e.g. DEMO_MODE=1 + golden-path command}} | exit 0, no outbound call to {{API}} |
| 2 | Reset restores seed state | {{reset command}}, then {{verify command}} | {{output}} |
<!-- CONTRACT S3 END -->

---
<!-- New slice: copy the S2 block, renumber it, insert it above this comment, and add a Board row.
Keep the CONTRACT Sn BEGIN / END marker comments so guard-edits and the qa-runner can find each contract. -->
