<!-- HackForge template, copied to .hackforge/ship/FACTS.md by the ship-kit workflow (FACTS extraction step).
THE single source of truth for README, DEVPOST, PITCH and VIDEO_SCRIPT. Rule: anything not in this file must not appear in any copy.
Verified facts only. Each row has evidence (URL, repo path, command + output, screenshot path) and is dated. Unverifiable: leave it out.
External numbers need ≥2 independent sources. Never invent URLs, metrics, users or teammates. Scraped user quotes: paraphrase + link, no usernames.
Writers cite fact IDs in an HTML comment next to each claim (e.g. F-11). The fact-checker in ship/REVIEW.md rejects claims without one.
A fact that copy needs but nobody can verify becomes a visible TODO-marker in the copy (see SUBMISSION_CHECKLIST), never a guess. -->

# Facts: {{Name}}

Last verified: {{YYYY-MM-DD HH:MM tz}} · Golden-path run: {{build/feedback/NNN-slice.md or build/JUDGE_REPORT.md}}

## Product
| ID | Fact | Evidence |
|---|---|---|
| F-01 | Name: {{…}} | `ideas/IDEA.md` |
| F-02 | One-liner: {{…}} | `ideas/IDEA.md` |
| F-03 | Tagline: {{…}} | {{…}} |

## User and pain (numbers with sources)
| ID | Fact | Source 1 | Source 2 | Retrieved |
|---|---|---|---|---|
| F-10 | Named user: {{…}} | {{URL / research/pain.md}} | — | {{date}} |
| F-11 | Pain: {{number + unit}} | {{URL}} | {{URL}} | {{date}} |
| F-12 | Today's workaround: {{…}} | {{URL}} | {{URL}} | {{date}} |

## What works (verified by a golden-path run against prod)
| ID | Capability (demo beat) | Verified by | Result |
|---|---|---|---|
| F-20 | {{…}} | `npx playwright test {{tests/golden-path.spec.ts}}` vs {{prodUrl}} | {{pass, date}} |
| F-21 | {{…}} | {{command / screenshot path}} | {{…}} |

## Metrics and evals
| ID | Metric | Value | Dataset / n | How measured | Evidence |
|---|---|---|---|---|---|
| F-30 | {{e.g. match rate vs expert labels}} | {{…}} | {{…}} | {{…}} | `{{path to eval output}}` |

## Sponsor integrations
| ID | Sponsor / tech | What it does in the product | Code location | On screen (video time) | Prize |
|---|---|---|---|---|---|
| F-40 | {{…}} | {{…}} | `{{path:line}}` | {{0:45}} | {{…}} |

## AI usage (disclosure)
| ID | Fact | Evidence |
|---|---|---|
| F-50 | Agents/models used to build: {{e.g. Claude Code + HackForge}} | {{…}} |
| F-51 | AI generated: {{which parts}} | {{git log / build/SPRINT-n.md}} |
| F-52 | Humans owned: {{problem framing, domain data, architecture, eval design, core logic files}} | {{…}} |
| F-53 | Specs and plans committed: `.hackforge/ideas/IDEA.md`, `.hackforge/spec/` | {{repo URL}} |
| F-54 | Model in the product and why it beat the obvious alternative: {{…}} | {{…}} |
| F-55 | Session IDs or logs, only if the rules require them: {{…}} | {{…}} |

## What's mocked (from spec/FAKE_VS_REAL.md)
| ID | Component | Status | Approved wording |
|---|---|---|---|
| F-60 | {{…}} | {{cached / seeded / mocked}} | "{{…}}" |

## Team (from state.json `team`, as the humans gave it)
| ID | Name | Role | Public link (only if provided) |
|---|---|---|---|
| F-70 | {{…}} | {{…}} | {{…}} |

## Links (each opened logged-out)
| ID | Link | URL | Tested (incognito / phone) |
|---|---|---|---|
| F-80 | Live demo (prod alias) | {{…}} | {{date}} |
| F-81 | Repo | {{…}} | {{date}} |
| F-82 | Video (public) | {{…}} | {{date}} |
| F-83 | Submission page | {{…}} | {{date}} |
