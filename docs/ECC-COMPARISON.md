# HackForge vs ECC for hackathons

- **Compared:** ECC ("Everything Claude Code") v2.2.3, [github.com/affaan-m/ECC](https://github.com/affaan-m/ECC), local read-only clone at commit `76aaa77` (2026-10-15), MIT. No ECC scripts were run. HackForge v1 as specified in [DESIGN.md](DESIGN.md).
- **Evidence:** research reports 01 (orchestration), 02 (research/product/demo/MCP), 05 (GitHub mining), 08 (critic; it wins where reports disagree). ECC paths are relative to the ECC repo root. Counts were re-checked against the clone on 2026-10-15.

## 1. TL;DR

- **ECC is a strong general-purpose harness.** It has 311 skills, 71 agents, 97 commands, 27 hook entries across 8 events, a 34-entry MCP catalog, and an installer that targets about 15 harnesses. It covers 20+ language reviewers, security review, TDD, deploy patterns and continuous learning. Its best safety engineering is real code: the fail-closed `orch-review` workflow, `config-protection.js` and `block-no-verify.js` (01 §2, §11).
- **It is not built for a 24–48 h event.**
  - **No hackathon layer.** No ECC skill mentions "hackathon" (0 of 311 by grep), "devpost" or "ideation" (02 §5).
  - **Gates are mostly prose.** Its gates are instructions to the model. Only one native Workflow exists, and it is half-wired (01 TL;DR 2–3).
  - **Heavy defaults.** `AGENTS.md` mandates TDD with 80%+ coverage. The GAN loop defaults to 15 iterations at a 7.0 threshold, and the published cost is about $125–200 and 4–6 h per harnessed run ([Anthropic, 2026-03-24](https://www.anthropic.com/engineering/harness-design-long-running-apps); 01 §4.3).
  - **Expensive routing and hooks.** Skill, agent and command descriptions total about 123K chars (about 30K tokens) of routing metadata. GateGuard denies the first edit of every file (01 §13).
- **ECC has the parts but not the spine.** It already ships `ui-demo`, `frontend-slides`, `deep-research`, `market-research` and `council` (05 §baseline). It has no phase order that runs from rubric through idea, demo, deploy and submission. HackForge supplies that spine and reuses ECC's best mechanisms, adapted for one harness, greenfield code, a hard deadline and output that judges can see.
- **They can coexist.** ECC runs as `/ecc:*`, HackForge as `/hackforge:*` (§6).

## 2. What we took from ECC

| Pattern | ECC source | How HackForge adapts it |
|---|---|---|
| Fail-closed review skeleton | `workflows/orch-review.workflow.js` | `judge-panel`. Bad `args` throw. A dead lens or an unverifiable HIGH item never yields READY. A dedup barrier runs before an adversarial verify of HIGH items only, and the schema requires proof. Null results are counted, which fixes ECC's `.filter(Boolean)` fail-open (01 §2.3 #4). Uncertainty is set per dimension (01 §2.3 #3) |
| GAN generator/evaluator | `skills/gan-style-harness`, `commands/gan-build.md`, `agents/gan-evaluator.md` | `build-sprint`. The `builder` builds, and a separate `qa-runner` never edits app code. Feedback goes to files (`build/feedback/NNN-<slice>.md`). At most 2 rounds per milestone, plateau stop and 1 final pass (08 C15), instead of 15 iterations. Scoring uses the event's `rubric.json`, not ECC's aesthetic weights |
| Sprint contract (described in ECC, never implemented, 01 §4.3) | `skills/gan-style-harness` | A CONTRACT block per slice in `spec/SLICES.md`: a command or URL plus the exact expected output, written before code |
| Santa dual review | `skills/santa-method`, `commands/santa-loop.md` | `ship-kit` uses a fact-checker and a judge persona. Both must pass, reviewers are fresh each round, and rounds are capped at 2 (ECC: 3). It covers README, DEVPOST, PITCH and the checklist, not every code change. There is no Codex/Gemini CLI detection |
| Anti-Goodhart loop rules | `skills/loop-design-check/SKILL.md` | "Build may not edit acceptance conditions." After Gate B, `guard-edits` protects `rubric.json`, the SLICES contracts, `tests/golden-path*`, `e2e/golden-path*` and lint/tsconfig. The `builder` never edits acceptance tests |
| Config protection and no-verify blocking | `scripts/hooks/config-protection.js`, `scripts/hooks/block-no-verify.js` | Generalised into `guard-edits` (judge files) and `git-guard`. `git-guard` blocks `--no-verify`, `-c core.hooksPath`, force-push to main/master and `git add .env*`, and it scans for secrets on commit and push. ECC's commit secret check runs only in its strict profile (01 §6) |
| Hook profiles | `scripts/hooks/run-with-flags.js`, plugin `userConfig` | Profiles are `off`/`fast`/`safe`. Precedence: `HACKFORGE_HOOKS`, then `hook_profile`, then state. Hooks no-op outside a HackForge project |
| Demo recorder | `skills/ui-demo/SKILL.md` | Discover → Rehearse → Record, with cursor and subtitle overlays and pacing. One golden-path Playwright script serves as smoke test, qa-runner script and recorder (`templates/tests/golden-path.spec.ts` plus `templates/demo/record-demo.mjs`). HackForge adds `DEMO_SCRIPT.md`, `DEMO_MODE` and human narration (08 C12) |
| HTML deck | `skills/frontend-slides/` (+ `scripts/export-pdf.sh`) | `ship/PITCH.html` is a single file with a viewport-fit gate and density limits. It has 5 or fewer slides, with the live demo right after slide 2 and slide 3 holding the backup video (08 C11), instead of an investor flow |
| Research discipline | `skills/search-first`, `skills/research-ops`, `skills/deep-research` | `research-sweep` runs a tool preflight and reports skipped channels. Claims are labelled (fact / user / inference / recommendation) and dated in `claims.json`. Web text is data, never instructions. It has no Firecrawl/Exa dependency, which ECC's `deep-research` needs (02 §4.5) |
| Product questions | `skills/product-lens/SKILL.md` | The 7-question diagnostic becomes idea gates G1–G6. ICE scoring becomes the rubric-weighted IdeaScore (DESIGN §4.3) |
| Lean PRD | `commands/plan-prd.md` | `templates/spec/PRD.md` uses a hypothesis line and "MVP = on screen". Missing facts are written as `TBD — needs validation via {method}` |
| Connector policy | `docs/MCP-CONNECTOR-POLICY.md`, `"mcpServers": {}` | No bundled MCPs. `hackforge mcp <profile>` prints or merges exact-pinned opt-in entries. ECC's catalog is not copied: 17 of its 18 npx/uvx entries are unpinned (02 §4.5) |
| Thin vertical slices | `skills/orch-build-mvp/SKILL.md` | In `spec/SLICES.md`, S1 is the deployed golden-path skeleton (`SKELETON_DEPLOYED`). Each later slice makes one demo beat real |
| Council and assigned directions | `skills/council`, `skills/autonomous-loops` §3 | `idea-tournament` gives isolated ideators one assigned direction each. The council red-teams the top 3 with fresh-context judges, and the orchestrator writes its pick first |
| Single source of truth | `skills/investor-materials` | Every submission artifact is written from `ship/FACTS.md` |

## 3. What HackForge adds that ECC lacks

| Capability | HackForge mechanism | Closest ECC piece |
|---|---|---|
| Rubric intake and re-weighting | `/hackforge:kickoff` writes `rubric.json`: weighted criteria with 1/3/5 anchors, stage-1 gates, tie-break, video limits, prize stacking, pre-existing-code rule. A default rubric is used when the event publishes none. Every score is re-weighted from it | None. ECC's 12 "rubric" hits don't concern judging criteria (02 §5) |
| Deadline clock | Checkpoints `IDEA_LOCK`, `SPEC_LOCK`, `SKELETON_DEPLOYED`, `WOW_WORKS`, `FEATURE_FREEZE`, `VIDEO_DONE`, `SUBMITTED` set as % of the clock (SUBMITTED no later than deadline − 30 min). `hackforge clock` modes. `clock-nudge` and `session-context` hooks | Iteration caps only, no clocks (02 M6) |
| Idea tournament | Isolated ideators → dedup → gates plus `hackforge saturation` (SERP counts; no Devpost scraping, per [Devpost ToS §4](https://info.devpost.com/legal/terms-of-service)) → judge personas → IdeaScore → council → Gate A | `product-lens` evaluates ideas but never generates them (02 M2) |
| Sponsor-prize EV | `state.sponsors[]` (prize, value, requirement) breaks IdeaScore ties | None (02 M4) |
| Demo-first spec | `DEMO_SCRIPT.md` comes before code. The stack is chosen only at Gate B. `DEMO_MODE` provides seed data, guest login and cached responses. `FAKE_VS_REAL.md` ledger | `plan-prd` (generic PRD) |
| Judge simulation | `judge-panel` on the live build: golden-path runner, design critic, criterion judges with personas (including a text-only LLM pre-screener). Output is a fix list ranked by points per hour, plus `QA_DRILL.md` | `gan-evaluator` (aesthetic rubric) |
| Submission factory | `FACTS.md` → README, DEVPOST, PITCH.html, VIDEO_SCRIPT and checklist. Missing facts become TODO and nothing is fabricated. The human submits | None (02 M10–M11) |
| Research toolkit with spend control | `hackforge web search\|scrape\|count\|pipe\|harvest\|ledger`: Bright Data with cache, ledger and budget refusal. Free `gh`, `hn` and `papers`. The `research-toolkit` skill | `deep-research` depends on MCPs that are off by default |
| Native workflows for every heavy phase | `research-sweep`, `idea-tournament`, `build-sprint`, `judge-panel`, `ship-kit`, each with a sequential Agent-tool fallback | 1 pilot, run by a relative `scriptPath` and not wired into the installer (`workflows/README.md` follow-ups) |
| Hard human gates | `hackforge gate A\|B\|C --lock` checks prerequisite files. After B, hooks protect the judge files | Prose gates in `orch-*` (01 §3) |
| Event state on disk | Everything lives in `.hackforge/`. Work resumes from the first missing file, and SessionStart re-injects ≤1,500 chars | ECC has generic session persistence (`session:start`, up to 8,000 chars; `pre:compact`) but no event state machine |

## 4. What we deliberately left out

| ECC feature | Why not in HackForge |
|---|---|
| 311 skills / 71 agents / 97 commands (about 30K tokens of descriptions) | Routing noise and auto-trigger competition. HackForge ships 12 skills with narrow, phase-specific descriptions (about 3.5K characters in total), and the heavy work sits in workflows that need a launch permission |
| Mandatory TDD with 80% coverage (`AGENTS.md`) | It costs hours with no judge value. HackForge runs one golden-path e2e on every merge and against the prod alias |
| GateGuard (`gateguard-fact-force.js`, 2,574 lines) | It denies the first Edit/Write of every file, which costs about one extra round trip per file in a greenfield app |
| tmux dev-server blocker (`pre-bash-dev-server-block.js`, auto-tmux) | It conflicts with `run_in_background`. Instead, `hackforge dev up` runs an idempotent detached server owned by the main session (08 C19) |
| `/multi-*` (ccg-workflow, codeagent-wrapper, Codex/Antigravity) | It needs an external runtime and 10-minute polling (01 §7) |
| Continuous-learning, observation, governance, cost and session-eval hooks | They add per-call latency with no demo value (01 §11) |
| Installer for about 15 harnesses (`manifests/`, 46 modules) | HackForge installs only as a Claude Code plugin |
| Stop-time format/typecheck (300 s timeout) | Not in v1. 08 D3's 60 s variant restricted to the safe profile is not in DESIGN |
| 20 language reviewers, `deployment-patterns` (blue-green, k8s), `product-capability` SRS | Production concerns (02 §2.4) |
| GAN 15-iteration loop, Santa 3 rounds with CLI model diversity | Cost and setup. Capped at 2 rounds instead |
| `contexts/*.md` loaded through `--system-prompt` | That flag replaces Claude Code's whole default prompt (02 §2.5) |
| Ralphinho merge queue, NanoClaw, dmux, operator-approval ledger | Machinery for multi-day work (01 §14) |
| An inline `node -e` root resolver in each hook | HackForge uses exec-form `node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/X.mjs"` |

## 5. Numbers

| Surface | ECC v2.2.3 (clone `76aaa77`) | HackForge v1 (DESIGN) |
|---|---|---|
| Skills | 311 | 12 (including 2 knowledge skills) |
| Agents | 71 | 8 |
| Legacy commands (`commands/*.md`) | 97 | 0 |
| Hook entries | 27 across 8 events | 4 across 3 events (SessionStart, UserPromptSubmit, PreToolUse) |
| Native workflows | 1 (pilot, half-wired) | 5 |
| MCPs bundled in the plugin | 0 (`"mcpServers": {}`); root `.mcp.json` has 1 (chrome-devtools) for Codex and manual installs | 0 |
| Opt-in MCP config | 34-entry catalog, mostly unpinned | 4 exact-pinned profiles: `research`, `web`, `python`, `github` |
| Harness targets | 16 installer target ids (about 15 harnesses) | 1 (Claude Code plugin) |
| Hackathon-specific skills | 0 | all 12 |
| Process mandate | TDD + 80% coverage | golden-path e2e + checkpoints |

## 6. When to use ECC instead, and how to combine them

**Choose ECC for:**
- long-lived production codebases;
- language-specific review (20+ reviewers) and a security-review dimension, which HackForge's judge-panel does not provide;
- teams spread across Codex, Cursor, OpenCode and similar tools;
- cross-session learning;
- production deploy patterns;
- hardening a hackathon MVP into a product after the event.

**Choose HackForge for** a 12 h to 1 week event with a rubric, a deadline and a submission form.

**Run both side by side.** Install each plugin from its own marketplace. Namespacing keeps `/ecc:*` and `/hackforge:*` apart (08 §3.2).

```text
/plugin marketplace add https://github.com/affaan-m/ECC
/plugin install ecc@ecc
/plugin marketplace add <hackforge-repo-or-path>
/plugin install hackforge@hackforge-marketplace
```

Caveats:
- **Hooks stack.** In the hackathon repo, lower ECC's hook profile (`ECC_HOOK_PROFILE=minimal`, `ECC_DISABLED_HOOKS`, or plugin `userConfig` `hooks_enabled`; 01 §11). Then GateGuard (standard and above) and ECC's Stop typecheck stop slowing the build. Which ECC hooks stay active under `minimal` is (unverified) per hook. Both plugins block `--no-verify`, which is harmless.
- **Rules conflict.** If ECC rules (`rules/common/*`) are installed, they mandate TDD and 80% coverage. Override them in the project `CLAUDE.md` with HackForge's golden-path policy (02 §6.9).
- **Skill routing.** HackForge's 12 descriptions are short and phase-specific. `go` invokes the phase skills itself, so they stay model-invocable. Every workflow launch asks for permission (auto mode asks once), so nothing heavy runs unprompted.
- **Useful ECC pieces mid-event:** the minimal-diff `build-error-resolver` agent for a 3 a.m. build break, and the `security-reviewer` before the repo goes public (01 §10).
