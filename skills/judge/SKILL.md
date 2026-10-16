---
name: judge
description: HackForge mock judging panel — runs the golden path on the live app, critiques design, reads the submission like an LLM pre-screener, scores with judge personas against the event rubric, verifies HIGH findings adversarially, and returns a fail-closed READY/NOT_READY verdict with fixes ranked by points per hour. Use at WOW_WORKS and before freeze.
argument-hint: "[url] [small|medium|large]"
---

# Mock judging panel

Run this at **WOW_WORKS** and again shortly before **FEATURE_FREEZE**. It is cheap insurance against losing on things you can fix in an hour.

## Run
1. URL: use `$ARGUMENTS` if given, otherwise `hackforge state get stack.prodUrl`. Judge the **production URL** whenever one exists. A localhost run can never be READY, and the workflow says so.
2. Pass the criteria from `.hackforge/rubric.json`.
```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/judge-panel.js",
  args: {
    projectDir: "<absolute project root>",
    pluginRoot: "${CLAUDE_PLUGIN_ROOT}",
    now: "<date -u +%Y-%m-%dT%H:%M:%SZ>",
    url: "<prod url>",
    criteria: <rubric.criteria>,
    scale: "<hackforge state get scale — default medium>"
  }
})
```
   Medium: 3 evidence agents + 4 judges (technical, impact, sponsor, non-technical) + verifier + writer ≈ 9 agents. Small ≈ 7. Large adds the LLM pre-screener and skeptic-VC personas.
3. Report in at most 6 lines: the verdict and score/100, the weakest 2 criteria, and the **top 3 fixes by points per hour** (blocking ones first). Point to `.hackforge/build/JUDGE_REPORT.md` and `QA_DRILL.md`.
4. Offer to run the fixes as a `/hackforge:build` sprint. Before freeze, include high points-per-hour fixes. After freeze, include only blocking golden-path fixes.
   - First add each fix to `.hackforge/spec/SLICES.md` as a new slice (`S7`, `S8`, …) with its own `<!-- CONTRACT Sn BEGIN/END -->` block, a Board row, and the judge's evidence as the acceptance check. Adding new blocks is allowed after Gate B; changing existing ones is not.
   - Then run `/hackforge:build S7 S8`. Builders only implement slice contracts.
5. Ask the team to rehearse the Q&A drill aloud at least once.

## Reading the verdict
- **READY** requires all of: the golden path passes on a public URL, all evidence was gathered, and no blocking finding survives the skeptic.
- **NOT_READY** lists its reasons. It is a to-do list, not a judgment of the team.
- Criterion `spread ≥ 2` means the judges disagree. Usually the submission text is unclear about that criterion, so fix the copy, not the code.

## Fallback (Workflow tool unavailable)
Use one `hackforge:qa-runner` agent to gather evidence, then 2 `hackforge:judge-persona` agents with different personas. Aggregate the weighted score yourself and write JUDGE_REPORT.md.

Input: $ARGUMENTS
