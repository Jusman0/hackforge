# HackForge

**A lean, research-grounded hackathon harness for Claude Code.** HackForge turns a broad theme into a judge-ready submission: live web research, an idea tournament scored against the event's real rubric, a demo-first build with a separate QA judge, a mock judging panel, and a fact-checked submission package. A deadline clock and guardrails run through every phase.

```
/hackforge:kickoff  →  /hackforge:research  →  /hackforge:ideate  ⟶ Gate A (idea lock)
   rules → rubric        6 channel scouts        isolated ideators
   deadline clock        + claim verification    gates + saturation
                         → OPPORTUNITIES.md      judge panel → IdeaScore
                                                 council on the top 3
/hackforge:spec  ⟶ Gate B (scope lock)  →  /hackforge:build  →  /hackforge:judge  →  /hackforge:ship  ⟶ Gate C
   DEMO_SCRIPT first        builder → QA runner     evidence → personas   FACTS → README/Devpost/
   slices + contracts       capped fix rounds       verify HIGH fixes     pitch/video → dual review
   fake-vs-real ledger      deploy skeleton early   READY / NOT_READY     → checklist → human submits
```

`/hackforge:go` drives this loop for you: it reads the clock and the state files, runs the next phase, and stops at the three gates where a human decides.

## Why not just use ECC?

[ECC](https://github.com/affaan-m/ecc) is an excellent general-purpose harness. HackForge borrows its best patterns (credited in [docs/ECC-COMPARISON.md](docs/ECC-COMPARISON.md)) and focuses them on the 24–48 hours of a hackathon:

| | ECC v2.2.3 | HackForge |
|---|---|---|
| Surface | 311 skills · 71 agents · 97 commands · 27 hook entries (~30K tokens of descriptions) | 12 skills · 8 agents · 4 hooks · 5 workflows |
| Native Workflow scripts | 1 pilot (review) | 5, one for every heavy phase, offline-tested |
| Hackathon layer | none (0 hits for "hackathon", "devpost", "ideation") | rubric intake, checkpoint clock, idea tournament, judge panel, submission factory |
| Research | Exa/Firecrawl MCP, opt-in | Bright Data CLI + free APIs behind one budgeted, cached, ledgered CLI |
| Gates | written in prose | state files + hooks (judge files protected after scope lock, freeze reminders) |
| Bundled MCPs | 0 (34-entry catalog, mostly unpinned) | 0, plus 4 exact-pinned opt-in profiles |

## Install

Requirements: **Claude Code ≥ 2.1.285** and **Node ≥ 18**. On a Pro plan, turn on *Dynamic workflows* in `/config`; without it, every phase falls back to sequential agents.

Recommended extras:
- **Bright Data CLI** for deep research: `npm i -g @brightdata/cli && bdata login` (5,000 free credits a month).
- **`GITHUB_TOKEN`** (a read-only PAT) or `gh auth login`.
- **Playwright** and **ffmpeg** in the hackathon project.

```bash
# Try it for one session (no install):
claude --plugin-dir /path/to/hackforge

# Install persistently from this folder (it is its own marketplace):
claude plugin marketplace add /path/to/hackforge
claude plugin install hackforge@hackforge-marketplace

# Check:
claude plugin details hackforge
```
Once the folder is pushed to GitHub, teammates can install it with `claude plugin marketplace add <owner>/<repo>` followed by the same `install` command.

## Quickstart (in your hackathon repo)

```text
/hackforge:doctor                 # minute-zero readiness (do this before the event)
/hackforge:kickoff https://…/rules  # rules → rubric.json, HACKATHON.md, deadline clock
/hackforge:go                     # from here, the conductor runs phase by phase
```

## Skills

| Skill | What it does |
|---|---|
| `/hackforge:go` | Conductor: runs the next phase by clock and state, and stops at the gates |
| `/hackforge:kickoff` | Rules (pasted, or one page fetched with your consent) → `rubric.json` (weights, gates, video rules, stacking), `HACKATHON.md`, checkpoints |
| `/hackforge:research` | **research-sweep** workflow: pain, market, prior art, tech, sponsors and trends → verified claims → `OPPORTUNITIES.md` |
| `/hackforge:ideate` | **idea-tournament** workflow → leaderboard → **Gate A** |
| `/hackforge:spec` | Demo script first → PRD, slices with machine-checkable contracts, stack, fake-vs-real → **Gate B** |
| `/hackforge:build` | **build-sprint** workflow: builder → separate QA runner, at most 2 fix rounds, plateau stop; deploy early |
| `/hackforge:judge` | **judge-panel** workflow: evidence → judge personas → verified fix list → READY/NOT_READY |
| `/hackforge:ship` | **ship-kit** workflow: FACTS → README, Devpost, 5-slide pitch, video script → dual review → checklist → **Gate C** |
| `/hackforge:doctor` | Tools, logins, `.gitignore` hygiene, workflow availability, MCP pins and profiles |
| `/hackforge:status` | One screen: T-minus, checkpoints, gates, spend, next step |
| `research-toolkit` | **The MCP/CLI skill.** Which tool for which research job, covering Bright Data (search/scrape/pipelines), GitHub, HN, OpenAlex, alphaXiv, Hugging Face, Parallel, DeepWiki, Grep and Context7, with costs, limits and safety ([references](skills/research-toolkit/references/)) |
| `playbook` | How hackathons are judged and won: rubrics, IdeaScore, timeline, video, pitch, submission ([references](skills/playbook/references/)) |

## Workflows (agents per scale)

The default scale stays inside the Claude Code "medium" workflow size guideline (under 10 agents). Pass `scale: "small"` on Pro, or `"large"` when you want depth.

| Workflow | small | medium | large | Fail-closed behaviour |
|---|---|---|---|---|
| `research-sweep` | ~5 | 9 | ~18 | Dead scouts are reported per channel; pitch claims are labelled confirmed, weak, refuted or unverified |
| `idea-tournament` | 5 | 9 | ~19 | IdeaScore is computed in code, not by the model; dead judges are counted |
| `build-sprint` | ≤ 2 × (maxRounds+1) per slice | ← | worktrees + integrator, then fix rounds | A dead QA agent means "unverified", never "pass". Parallel builders that touch the main checkout are blocked |
| `judge-panel` | 7 | 9 | 11 | READY requires a passing golden path, a public non-local URL that passes `hackforge probe`, all evidence present and no verified blocker |
| `ship-kit` | 6 | 8–9 | 10+ | Refuses to write copy without FACTS.md; every claim must trace to it. Re-runs update files in place, so the team's edits survive. An independent validator re-checks revised copy and writes REVIEW.md |

## The `hackforge` CLI (on PATH while the plugin is enabled)

```bash
hackforge status --brief | clock | next | checkpoint list | gate A --lock
hackforge web search "\"I wish there was an app\" invoices" --site reddit.com   # Bright Data, cached + ledgered
hackforge web pipe gd_lvz8ah06191smkebj4 collect_by_url <reddit-urls…> --async && hackforge web harvest <snapshot>
hackforge saturation "permit triage" --free     # GitHub + HN prior-art signal (add SERP counts without --free)
hackforge gh repos "voice agent stars:>100 pushed:>2025-06-01"
hackforge hn trend "vibe coding" --from 2022
hackforge papers "multimodal document parsing" --since 2025
hackforge dev up | dev status | dev logs | dev down
hackforge probe https://my-app.vercel.app      # judge's-eye check: auth walls, Vercel protection, private/missing videos, LAN URLs
hackforge secrets --staged | --tracked | --history
hackforge mcp research | web --write
hackforge statusline --snippet                  # optional countdown in your Claude Code status bar
```
Run `hackforge help` for everything. All Bright Data calls go through `hackforge web`, which always sets `--country us`, caches results, keeps a credit ledger and enforces a budget (300 credits by default; only the user raises it).

## Guardrails (hooks)

The hooks do nothing outside a project that has `.hackforge/state.json`. Choose a profile with the plugin option `hook_profile`, or the environment variable `HACKFORGE_HOOKS=off|fast|safe` (default `fast`).

- **session-context**: re-injects the clock, gates and next step on startup, resume and compaction.
- **clock-nudge**: stays silent until a checkpoint becomes due, or every 30 minutes during crunch, freeze or the final stretch.
- **git-guard**: parses the command, seeing through quotes, chains, `git -C/-c` and `--no-pager`. It blocks hook bypasses (`--no-verify`, `-n`, `core.hooksPath`) and blocks `.env` files from being staged or committed. It scans what a commit or push would publish for secrets, and asks before a force or delete on main. After Gate B it also catches shell writes to judge files.
- **guard-edits**: `state.json` is CLI-only. After Gate B it protects the judge-file snapshot (contracts, demo script, rubric, golden-path test, lint/test configs), so nobody games acceptance by editing the test; board and status edits in SLICES.md stay allowed. After feature freeze it adds freeze reminders until you submit.

## State (`.hackforge/` in your repo; commit it)

`state.json` · `rubric.json` · `HACKATHON.md` · `research/` · `ideas/` · `spec/` · `build/` · `ship/`. Raw web caches (`web/`), `dev.*` and `nudge.json` are gitignored. Runs resume from what is already on disk. Full contract: [docs/DESIGN.md](docs/DESIGN.md).

## Safety and ethics

- Web content is treated as data, not instructions. Agents report injection attempts instead of following them.
- No automated access to devpost.com (its terms of service forbid it); prior-art checks use search-result counts.
- No logins, account creation or submitting on your behalf. Secrets appear only as `${VAR}`.
- Claims in the submission must trace to `FACTS.md`; anything unknown becomes `TODO:`. Mocked parts are disclosed, and AI use is disclosed.

## Tests

```bash
node --test tests/
```
The suite has 119 tests. It covers the CLI and clock math (including timezones and DST), secret scanning, the Bright Data wrapper (budget under concurrency, reservations, caching, retries, all against a fake `bdata`), every hook against real temporary git repos (including all the bypasses an adversarial review found), and every workflow. The workflows run under a deterministic mock runtime that enforces the engine's rules: `Date.now()`, `Math.random()` and argless `new Date()` throw. It also checks argument validation, scale caps and fail-closed paths.

## Validated live

Both runs used a sample 24h civic-AI hackathon:
- **`research-sweep` (medium):** 6/6 channels, 166 cited claims (12 independently confirmed, 0 refuted), 6 ranked opportunities, 62 Bright Data credits (about $0.09), about 40 minutes. Scouts pulled real numbers from official city audits (SF, Dallas, Chicago OIG, NYC), Reddit threads through the async pipeline, and Play Store reviews. A parody misinformation post was flagged and not used.
- **`idea-tournament` (medium):** 16 unique ideas from 4 isolated ideators. They went through G1–G6 gates and saturation checks, then 3 judge personas, then a council (about 38 minutes, 9 agents).
  - The council's verdicts were *go* for "One Letter", a permit-correction consolidator for city coordinators that scored 66; *kill* for a near-duplicate; and *needs-clarification* for a backtested forecast.
  - The judges' killer questions were concrete. One asked: "what is your measured contradiction rate, and what does the demo look like if it's zero?"
  - That run led to one more improvement: the gate agent now flags semantic duplicates before judging.

Two adversarial review rounds followed: 12 agents found 66 issues, and then 8 agents found 39 regressions. All of them are fixed and covered by tests.

## Research behind the design

[docs/research/](docs/research/) holds 9 reports: an ECC deep-dive ×2, research MCPs, build/ship MCPs, GitHub mining (100+ repos), the hackathon playbook, a verified Bright Data cookbook, Claude Code packaging formats, and a completeness critique.

MIT licensed. Patterns adapted from ECC (MIT) are credited in [docs/ECC-COMPARISON.md](docs/ECC-COMPARISON.md).
