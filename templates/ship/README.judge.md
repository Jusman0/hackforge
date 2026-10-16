<!-- HackForge template, copied to .hackforge/ship/README.md (draft) by the ship-kit workflow (storyteller). Promote it to the repo-root README.md once ship/REVIEW.md passes.
Judge-facing: a technical judge should get value in 60 seconds. Source: ship/FACTS.md only (cite fact IDs in HTML comments).
Every command and path comes from the real repo (package.json scripts, actual files). Never fabricate a demo URL, a metric or a teammate.
A needed fact that is missing becomes a visible TODO-marker: the word TODO, a colon, then the missing item (the storyteller's format). -->

# {{Name}}: {{one-line value prop for a named user}}

[Live demo]({{prod alias URL}}) · [Video]({{public video URL}}) · [Submission]({{submission page URL}})

![{{aha moment, in words}}]({{docs/aha.gif}})

## Judge quickstart (≤60 s)
1. Open {{prod alias URL}}. No login needed. <!-- or: test credentials are in the submission form -->
2. Click "{{Load sample case}}".
3. Press "{{Run}}" and watch {{the aha}}.

## Judging highlights
<!-- One row per rubric.json criterion, in rubric order, using the rubric's names. -->
| Criterion | Where to look | Evidence |
|---|---|---|
| {{Working demo & completeness}} | Quickstart above | {{golden-path test passes against prod, date}} |
| {{Technical depth & execution}} | [How it works](#how-it-works) | {{the hard part}} |
| {{Impact (specific user, credible)}} | [The problem](#the-problem) | {{number + source}} |
| {{Originality / quality of idea}} | [What it does](#what-it-does) | {{the non-obvious capability}} |
| {{Required-tech / sponsor use}} | "Built with" sections below | {{what breaks without it}} |
| {{Design/UX & clarity}} | Quickstart above | {{an outsider restates it after 1 minute}} |

## The problem
{{named user}} loses {{number}} ({{source link}}). Today they {{workaround}}.

## What it does
- {{…}}
- {{…}}
- {{…}}

## How it works
{{architecture diagram image or mermaid block}}

The hard part: {{…}} · Model: {{model}}, chosen over {{alternative}} because {{…}}

## Evaluation
| Dataset | Metric | Result | How we measured |
|---|---|---|---|
| {{…}} | {{…}} | {{…}} | {{…}} |

## Built with {{Sponsor}}
<!-- One section per claimed sponsor tech: what, where in the code, why it is load-bearing. -->
What: {{…}} · Where: `{{path}}` · Why it matters: {{…}}

## How we used AI coding agents
- Tools and models: {{…}}
- AI generated: {{…}} · Humans designed or wrote: {{…}}
- Key decisions the team made: {{…}}
- Specs and plans are committed in `.hackforge/` (IDEA, DEMO_SCRIPT, PRD, SLICES). Session IDs: {{only if required}}
- Tooling disclosure: scaffolded with HackForge (public, MIT-licensed templates) and {{starters}}

## What's real vs mocked
| Component | Status | Note |
|---|---|---|
| {{…}} | {{real / cached / seeded / mocked}} | {{…}} |

## Limitations and next steps
- {{honest limit}}
- {{next step}}

## Run locally
```sh
git clone {{repo URL}} && cd {{repo dir}}
cp .env.example .env.local    # fill in your own values; .env.example holds names only
{{install command}} && {{dev command}}
```

## License
{{licence name}}. See `LICENSE`.

## Team
{{names and roles, exactly as the team provided them}}
