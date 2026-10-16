<!-- HackForge template, copied to .hackforge/spec/PRD.md by /hackforge:spec. One page.
Anti-fluff rule: when information is missing, write "TBD — needs validation via {method}" (e.g. "via 2 user quotes in research/pain.md", "via a smoke test of the sponsor API"). Never invent plausible-sounding requirements.
Facts link to .hackforge/research/ or ideas/IDEA.md. Scope may only shrink after Gate A. -->

# PRD: {{Name}}

## Problem
{{2–3 sentences with the number and its source}}

## User
{{named user}} · context: {{…}} · today's workaround: {{…}}

## Hypothesis
We believe **{{capability}}** will **{{solve problem}}** for **{{users}}**. We'll know we're right when **{{measurable outcome, shown in the demo}}**.

## MVP = what's on screen
<!-- Must-have means it appears in spec/DEMO_SCRIPT.md. Not on screen, not in the MVP. At most 3 features. -->
| # | On-screen feature | Demo beat (DEMO_SCRIPT time) | Slice |
|---|---|---|---|
| 1 | {{…}} | {{0:35 aha}} | {{S2}} |
| 2 | {{…}} | {{…}} | {{…}} |
| 3 | {{…}} | {{…}} | {{…}} |

## NOT building
- {{e.g. accounts and auth beyond the guest/demo user}}
- {{e.g. settings, admin, billing}}
- {{…}}
<!-- Every cut lands here or in "What's next". -->

## Judging-criteria map (rubric.json `criteria`)
| ID | Criterion | Weight | Where judges see it (beat / README section / metric) | Risk |
|---|---|---|---|---|
| {{D}} | {{Working demo & completeness}} | {{25}} | {{…}} | {{…}} |
| {{T}} | {{Technical depth & execution}} | {{20}} | {{…}} | {{…}} |
| {{I}} | {{Impact (specific user, credible)}} | {{20}} | {{…}} | {{…}} |
| {{O}} | {{Originality / quality of idea}} | {{15}} | {{…}} | {{…}} |
| {{S}} | {{Required-tech / sponsor use}} | {{10}} | {{…}} | {{…}} |
| {{U}} | {{Design/UX & clarity}} | {{10}} | {{…}} | {{…}} |

Stage-1 gates (`stage1Gates`) covered by: {{gate → evidence}}

## Success metrics
| Metric | Target | How measured | Shown where |
|---|---|---|---|
| {{…}} | {{…}} | {{…}} | {{beat / README Evaluation}} |

## Milestones
<!-- Checkpoint IDs and exit criteria per DESIGN §4.1. Due times from `hackforge checkpoint list`.
Mark one done with: hackforge checkpoint <ID> --done --url "<evidence>" --note "<note>" -->
| Checkpoint | Due (local) | Exit criteria | Owner | Evidence |
|---|---|---|---|---|
| IDEA_LOCK | {{time}} | Gate A locked, `ideas/IDEA.md` | {{…}} | {{…}} |
| SPEC_LOCK | {{time}} | Gate B locked, DEMO_SCRIPT + SLICES | {{…}} | {{…}} |
| SKELETON_DEPLOYED | {{time}} | Public prod URL returns 200, no auth wall, golden-path smoke green | {{…}} | {{prod URL}} |
| WOW_WORKS | {{time}} | Aha works with real input, fallbacks in place, judge-panel run | {{…}} | `build/JUDGE_REPORT.md` |
| FEATURE_FREEZE | {{time}} | Only golden-path fixes after this | {{…}} | {{commit}} |
| VIDEO_DONE | {{time}} | Public video URL within the limit | {{…}} | {{video URL}} |
| SUBMITTED | {{time}} | Checklist 100%, Gate C locked; due = min(pct, deadline − 30 min) | {{…}} | {{confirmation}} |

## Open questions
- TBD — needs validation via {{method}}: {{question}}
- TBD — needs validation via {{method}}: {{question}}
