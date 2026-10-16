<!-- HackForge template, copied to .hackforge/ideas/IDEA.md by /hackforge:ideate at Gate A (from ideas/top/<slug>.md).
One page. Every number cites a source (URL or a .hackforge/research/claims.json entry). Pitch claims need ≥2 independent sources.
Unknown: write "TBD — needs validation via {method}". After `hackforge gate A --lock`, scope changes may only CUT.
The Invariants section is also written to ideas/concept-anchor.json. -->

# {{Name}} ({{slug}})

**One-liner:** {{Name}} helps {{named user}} {{do task}} in {{time or $}} instead of {{status quo}}.

## User & pain
- Named user: {{role + context, e.g. "permit expediter at a 5-person firm"}}
- Pain, quantified: {{number}}. Sources: {{URL 1}}, {{URL 2}}
- Today's workaround: {{what they do now and what it costs them}}
- Who adopts / pays: {{…}}

## Demo
- Aha moment (≤60 s into the demo): {{what the judge sees}}
- Visible artifact (not chat text): {{graph / PDF / 3D / annotated document / …}}
- Memorable moment: {{…}}
- Golden path in 5 steps:
  1. {{…}}
  2. {{…}}
  3. {{…}} → aha
  4. {{…}}
  5. {{…}}

## Why it scores
- Sponsor tech, load-bearing (≤3): {{sponsor → what breaks without it}}
- AI essentiality: {{what breaks if the model is removed}}
- Hard part we'll narrate (20 s): {{…}}
- Eval number we'll show: {{dataset}} / {{metric}} / target {{value}}
- Prizes targeted (stacking rule checked): {{…}}

## Fake vs real (first guess; becomes spec/FAKE_VS_REAL.md)
| Component | Real / cached / seeded / mocked | Fallback if flaky |
|---|---|---|
| {{…}} | {{…}} | {{…}} |

## Gates (all must pass before scoring)
- [ ] G1 Fits theme/track, and the required sponsor API is on the golden path
- [ ] G2 Aha shown within 60 s; the whole story fits in 3 min
- [ ] G3 No single point of failure: cached/fixture fallback for every flaky API
- [ ] G4 Thin end-to-end slice deployable by SKELETON_DEPLOYED
- [ ] G5 An outsider can restate it after 1 minute
- [ ] G6 Rules-clean: no pre-existing project code, licence possible, not a duplicate of a prior submission

## IdeaScore (DESIGN §4.3; weights from rubric.json `ideaWeights`)
| Factor | Weight | Score 1–5 | w × s | Evidence |
|---|---|---|---|---|
| P Pain specificity | {{0.20}} | {{…}} | {{…}} | {{…}} |
| W Wow / demoability | {{0.20}} | {{…}} | {{…}} | {{…}} |
| A AI essentiality | {{0.15}} | {{…}} | {{…}} | {{…}} |
| T Narratable hard part | {{0.15}} | {{…}} | {{…}} | {{…}} |
| S Prize leverage | {{0.10}} | {{…}} | {{…}} | {{…}} |
| N Novelty (saturation below) | {{0.10}} | {{…}} | {{…}} | {{…}} |
| E Edge (domain, data, real user) | {{0.10}} | {{…}} | {{…}} | {{…}} |
| **Σ** | 1.00 | | {{Σ}} | |

F (feasibility, one of 0.2 / 0.4 / 0.6 / 0.8 / 1.0): {{F}}, because {{…}} · Fatigue penalty (−10 if a fatigue-list idea with no rescue angle): {{0 / −10}}
**IdeaScore = 20 × F × Σ + penalty = {{score}}** · Sponsor-EV tie-break: {{…}}

## Saturation evidence
<!-- From `hackforge saturation "<keywords>"` (`--free` skips the paid SERP counts). HackForge never scrapes Devpost: a human opens the 3 nearest project pages. -->
- Level: {{low / medium / high}} · GitHub: {{n}} repos · HN: {{n}} stories, trend {{…}} · SERP counts (Devpost, Product Hunt): {{n}}, {{n}}
- Nearest 3: {{URL}} differs by {{…}}; {{URL}} differs by {{…}}; {{URL}} differs by {{…}}
- [ ] Nearest neighbour does not have the same pitch (Devpost ToS bars substantially duplicating prior submissions)

## Risks
| Risk | Likelihood | Mitigation or cut |
|---|---|---|
| {{…}} | {{low / med / high}} | {{…}} |

## Kill criteria (switch to runner-up {{slug}} if any is true)
- {{e.g. the sponsor API cannot return X by SPEC_LOCK}}
- {{e.g. the aha does not work with real input by WOW_WORKS: cut to the fallback scope}}

## Invariants (→ concept-anchor.json) and out of scope
- Must stay true: named user {{…}} · aha {{…}} · sponsor on golden path {{…}}
- Out of scope: {{…}}
- Presenter: {{name}}
