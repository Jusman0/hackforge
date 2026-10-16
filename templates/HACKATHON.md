<!-- HackForge template, copied to .hackforge/HACKATHON.md by /hackforge:kickoff.
Human-readable event facts. Keep it in sync with .hackforge/rubric.json and .hackforge/state.json: the CLI, hooks and judges read the JSON.
Fill every double-brace blank. Unknown: write "unknown (ask organizers)". Never guess, and label anything inferred.
Rules intake: a paste, or ONE fetch of the rules page the user names, with consent. Devpost ToS §4 forbids scripted access to devpost.com. -->

# {{Event name}}

| Field | Value |
|---|---|
| URL | {{event URL}} |
| Theme / tracks | {{theme, paraphrased}} · tracks: {{track 1}}, {{track 2}} |
| Format | {{24h / 48h / week / custom}}, {{in person / virtual}} |
| Start → deadline | {{YYYY-MM-DD HH:MM}} → {{YYYY-MM-DD HH:MM}} {{IANA timezone, e.g. America/New_York}} (our local: {{…}}) |
| Judging | {{expo / finalist stage / async video only}}, {{n}} min demo + {{n}} min Q&A, {{date}}. Judges run the app: {{yes / maybe / no}} |
| Rules source | {{paste / url:rules URL, fetched YYYY-MM-DD}} |

<!-- Due times: copy from `hackforge checkpoint list`. SUBMITTED is due at min(pct, deadline − 30 min). -->
| IDEA_LOCK | SPEC_LOCK | SKELETON_DEPLOYED | WOW_WORKS | FEATURE_FREEZE | VIDEO_DONE | SUBMITTED |
|---|---|---|---|---|---|---|
| {{time}} | {{time}} | {{time}} | {{time}} | {{time}} | {{time}} | {{time}} |

## Rules summary
<!-- 5–10 bullets: eligibility, what must be built during the event, required tech, access judges need, disqualifiers. -->
- {{rule}}

## Judging criteria (mirror of rubric.json `criteria`)
<!-- Weights sum to 100. Source column: "explicit" (quoted from the rules) or "inferred" (say from what). If the event publishes none, keep the HackForge default below. -->
| ID | Criterion | Weight | What a 5 looks like (per the rules) | Source |
|---|---|---|---|---|
| D | Working demo & completeness | 25 | {{…}} | default |
| T | Technical depth & execution | 20 | {{…}} | default |
| I | Impact (specific user, credible) | 20 | {{…}} | default |
| O | Originality / quality of idea | 15 | {{…}} | default |
| S | Required-tech / sponsor use | 10 | {{…}} | default |
| U | Design/UX & clarity | 10 | {{…}} | default |

Tie-break order (`tieBreak`): {{e.g. first listed criterion}} · AI pre-screening of submissions allowed: {{yes / no / unknown}}

## Stage-1 gates (pass/fail before any scoring; `stage1Gates`)
- [ ] {{Fits the theme or a published track}}
- [ ] {{Required sponsor API visibly used on the golden path}}

## Prizes
<!-- EV ≈ value × P(win | integrated). At most 3 extra sponsor integrations, each ≤15% of build time and load-bearing. Mirror into state.json `sponsors[]`. -->
Stacking rule (`prizeStacking`: one / multiple / max3 / unknown): {{value}}, per {{rules section}}

| Prize / sponsor | Value | Requirement ("meaningful use") | Judged by | Targeted? | EV note |
|---|---|---|---|---|---|
| {{Grand prize}} | {{$}} | {{…}} | {{panel}} | {{yes/no}} | {{…}} |
| {{Sponsor: Best use of X}} | {{$}} | {{…}} | {{sponsor rep}} | {{yes/no}} | {{…}} |

## Submission requirements (`submissionFields`)
| Field | Requirement and limit |
|---|---|
| title / tagline | {{…}}, {{char limit}} |
| story / summary | {{…}}, {{word limit}} |
| repo | {{public? licence? spec files?}} |
| demo_url | {{free access through judging; test creds go in the form, not the README}} |
| built_with / other | {{tags, thumbnail, gallery, slides, session IDs}} |

## Video rules (`video`)
- Length: max {{180}} s (`maxSeconds`), min {{0}} s (`minSeconds`) · Host: {{public YouTube}} · Resolution: {{≥720p?}}
- Bans (`bans`): {{e.g. TTS/AI voiceover, sped-up footage, phone recording, music + captions only}}
- Must include (`mustInclude`): {{e.g. event name at the start, required tool shown in use}}

## Team (state.json `team`, max {{teamMax}})
<!-- Never invent teammates. Plan tiers size workflow fan-out (critic 08 §3.3). -->
| Name | Skills | Role | Claude plan (Pro / Max 5× / Max 20× / Team / API) |
|---|---|---|---|
| {{name}} | {{…}} | {{builder / demo / pitch}} | {{plan}} |

Presenter: {{name}} (pick by IDEA_LOCK) · Integrator (only person who merges to main): {{name}}

## Constraints
| Rule | Value | What we do |
|---|---|---|
| Pre-existing code (`preExistingCode`) | {{forbidden / disclosed / allowed / unknown}} | HackForge templates are public MIT boilerplate: disclose them in the README |
| Open source (`openSourceRequired`) | {{true / false}} | Licence: {{…}} |
| AI disclosure (`aiDisclosure`) | {{true / false}} | README "How we used AI coding agents" |
| Specs in repo, commit history | {{required? incremental?}} | `.hackforge/` committed except `web/`, `dev.*` and `nudge.json`; commit after every slice |
| Other | {{…}} | {{…}} |

## Links
Rules: {{URL}} · Submission page: {{URL}} · Chat: {{URL}} · Sponsor docs and starter kits: {{URLs}} · Schedule: {{URL}}
