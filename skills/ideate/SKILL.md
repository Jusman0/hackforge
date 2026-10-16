---
name: ideate
description: HackForge idea tournament + Gate A — isolated ideators from different directions, G1-G6 gates and saturation checks, judge-persona scoring with a rubric-weighted IdeaScore, council red-team of the top 3, then the human locks one idea. Use after research, or when the user wants hackathon ideas scored.
argument-hint: "[small|medium|large] [directions or constraints]"
---

# Idea tournament → Gate A (idea lock)

Goal: `.hackforge/ideas/LEADERBOARD.md` and top-3 one-pagers, then **one locked idea** in `.hackforge/ideas/IDEA.md` plus `concept-anchor.json`, all by IDEA_LOCK (about 8% of the clock).

## Run
1. `hackforge status --brief` shows the clock and team. If `.hackforge/research/OPPORTUNITIES.md` is missing, offer `/hackforge:research` (recommended). If the user is short on time, ideate from the theme and HACKATHON.md alone.
2. Read `.hackforge/rubric.json` and pass `ideaWeights` and `criteria` from it.
3. Launch. Scales:
   - **medium:** 4 ideators × 4 ideas, 1 gate agent, 3 judges, 1 council (about 9 agents, roughly 35–40 minutes measured live);
   - **small:** about 5 agents, roughly half the time;
   - **large:** 8 ideators and 5 judges.

   If research plus ideation won't fit before IDEA_LOCK, use small.
```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/idea-tournament.js",
  args: {
    projectDir: "<absolute project root>",
    pluginRoot: "${CLAUDE_PLUGIN_ROOT}",
    now: "<date -u +%Y-%m-%dT%H:%M:%SZ>",
    scale: "<hackforge state get scale — default medium>",
    ideaWeights: <rubric.ideaWeights>,
    criteria: <rubric.criteria>
  }
})
```
   Optional: `directions: ["pain-first","sponsor-first","wow-demo-first","eval-first","domain-workflow","multimodal","agentic-verifier","contrarian"]` (a subset), to steer ideators toward the team's strengths.
4. Present the **top 3** compactly: title, one-liner, score (with F and saturation), the council verdict, the single strongest risk, and "make it a 5". Then call **AskUserQuestion**: "Which idea do we lock?" Offer the 3 ideas plus "Combine/tweak" and "Re-run with different directions". The human decides; you recommend.

## Gate A: lock
1. Write `.hackforge/ideas/IDEA.md` from the chosen `ideas/top/<slug>.md`, merging any tweaks the user asked for. It needs a one-liner, named user, quantified pain, the aha within 60 seconds, a 5-step golden path, load-bearing sponsor tech, the hard part, the eval number, and kill criteria.
2. Write `.hackforge/ideas/concept-anchor.json`: `{ "user": …, "pain": …, "aha": …, "mustShow": [...], "neverBecomes": [...] }`. These are the invariants that stop idea drift. After Gate A, scope may only be **cut**.
3. Run `hackforge gate A --lock --note "<slug>"`. This also marks IDEA_LOCK done.
4. Next step: `/hackforge:spec`.

## Fallback (Workflow tool unavailable)
Spawn 2–3 `hackforge:ideator` agents with different directions, then one `hackforge:prior-art-hunter` over all ideas, then one `hackforge:judge-persona` agent acting as a panel. Compute IdeaScore yourself with the formula in `${CLAUDE_PLUGIN_ROOT}/skills/playbook/references/ideas.md` and write LEADERBOARD.md.

## Notes
- IdeaScore = 20 × F × Σ wₖ·factorₖ − 10 if the idea is on the fatigue list without a rescue angle. The script computes it deterministically, so do not re-score by hand.
- High judge disagreement (≥1.5) means the idea is divisive. Mention it; that can be fine for the originality criterion.
- If the clock says IDEA_LOCK is overdue, skip the re-run options. Lock the best idea now.

Input: $ARGUMENTS
