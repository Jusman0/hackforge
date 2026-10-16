# 02 — ECC's Research, Product, Demo and MCP Surfaces: what HackForge should steal, adapt, skip, or build new

*Researcher brief: deep-dive ECC's research / product / demo skills + MCP strategy, judged for a hackathon flow (theme → research → scored idea → MVP → deploy → demo + pitch → submit).*
*Date: 2026-10-15. ECC snapshot: plugin `ecc` v2.2.3 (`.claude-plugin/plugin.json`), 311 skills, 71 agents, 97 commands, 1 workflow (`workflows/orch-review.workflow.js`). Paths below are relative to the ECC repo root unless absolute.*

---

## 0. TL;DR

1. **ECC has no hackathon layer.** Grepping all 311 skills: `hackathon` = 0 hits, `ideation` = 0, `user research`/`user interview` = 0, `devpost` = 0. "brainstorm" appears once (in `quality-nonconformance`, a manufacturing skill). There is nothing for idea generation, idea scoring against judging criteria, sponsor-prize mapping, demo scripts, pitch timing, submission checklists, or deadline-based time-boxing. HackForge has to build those itself, and they are where most of its value will come from.
2. **Four ECC pieces are good enough to steal almost as-is:**
   - `skills/ui-demo` (a Playwright demo-video recorder with Discover → Rehearse → Record phases),
   - `skills/frontend-slides` (zero-dependency HTML decks with a hard viewport-fit gate and a Playwright PDF export script),
   - `skills/search-first` (adopt / extend / compose / build matrix and a tool-availability preflight),
   - `skills/council` (a 4-voice, anti-anchoring decision panel; it adapts well into a simulated judge panel).
3. **Good ideas inside generic or over-heavy skills (adapt):**
   - `deep-research`: sub-question plan, source budget, citations, untrusted-source rules.
   - `research-ops`: evidence labels (fact / user-supplied / inference / recommendation).
   - `product-lens`: the 7-question YC-style diagnostic and ICE scoring.
   - `commands/plan-prd.md`: lean PRD with an anti-fluff `TBD — needs validation` rule.
   - `orch-build-mvp`: thin vertical slices.
   - `gan-style-harness`: a separate strict evaluator, but ECC's version costs $125–200 and 4–6 h.
   - `investor-materials`: "all materials agree", meaning one source of truth.
   - `marketing-campaign`: the copy hard-bans and the 5-second test.
   - `browser-qa` / `canary-watch`: smoke checks.
   - `rules/web/design-quality.md`: anti-template UI policy.
4. **Skip for hackathons:**
   - `deployment-patterns`: blue-green, canary, k8s, multi-stage Docker.
   - `product-capability`: SRS-style capability contracts.
   - `github-ops`: maintainer triage and stale policies.
   - `data-scraper-agent`: a scheduled-scraper product template that uses stale Gemini 2.0 model names.
   - `exa-search`: a thin wrapper around a paid MCP.
   - `contexts/*.md`: 20-line mode prompts, loaded with a flag that wipes Claude Code's system prompt (see §4.4).
   - `rules/common/*`: mandatory TDD, 80% coverage, and a reviewer agent after every change. These are the opposite of demo-first.
5. **How ECC handles MCPs.** It ships **zero** MCPs in the Claude plugin (`"mcpServers": {}` in `.claude-plugin/plugin.json`). It keeps **one** default connector in the root `.mcp.json` (`chrome-devtools-mcp@1.10.1`, pinned) for Codex/manual installs. Everything else is an opt-in entry in a **34-entry catalog** (`mcp-configs/mcp-servers.json`). A June 2026 audit (`docs/MCP-CONNECTOR-POLICY.md`) demoted github, context7, exa, memory, playwright and sequential-thinking in favour of "CLI or REST wrapped in a skill". The policy's two-prong rule (universal + genuinely needs MCP statefulness) is the best idea in this area. HackForge should adopt it outright.
6. **ECC's context-cost guidance is half stale.** "Keep under 10 MCPs / under 80 tools; 200k can shrink to 70k" (README, shortform guide) predates Claude Code's **tool search being on by default**. In current Claude Code, only tool names and server instructions load at session start; full schemas are deferred ([code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp)). The costs that remain:
   - per-call output size (Playwright snapshots run about 10–30k tokens),
   - `alwaysLoad` servers,
   - connect and auth latency,
   - supply-chain drift.

   ECC's own longform guide concedes this: "With lazy loading, the context window issue is mostly solved" (`the-longform-guide.md:32`).
7. **ECC drifts from itself in several places. Do not copy them blindly:**
   - `deep-research` requires Firecrawl or Exa MCP, but neither is enabled by default any more.
   - `documentation-lookup` still says "via Context7 MCP", while the policy says it targets the Context7 REST API.
   - `agents/gan-evaluator.md` lists `mcp__playwright__*` tools, but Playwright MCP was dropped from the defaults.
   - `docs/token-optimization.md` says "The `memory` MCP server is configured by default", but it was dropped.
   - The catalog fails ECC's own `mcp-dependency-review`: **17 of its 18 npx/uvx entries are mutable** (3 `@latest`, 14 bare names). Only `mcp-atlassian==0.21.0` is pinned.

---

## 1. Scope and method

**Read in full:**

| Area | Files |
|---|---|
| Research | `skills/deep-research`, `search-first`, `research-ops`, `market-research`, `exa-search` |
| Product | `skills/product-lens`, `product-capability` |
| Demo, pitch, marketing | `skills/ui-demo`, `frontend-slides`, `investor-materials`, `marketing-campaign`, `council` |
| Build and ship | `skills/gan-style-harness`, `orch-build-mvp`, `browser-qa`, `github-ops`, `mcp-server-patterns`, `mcp-dependency-review`, `benchmark-optimization-loop` |
| MCP config and policy | `mcp-configs/mcp-servers.json`, `.mcp.json`, `.claude-plugin/plugin.json`, `docs/MCP-CONNECTOR-POLICY.md`, `docs/capability-surface-selection.md` |
| Context and guides | `contexts/*.md`, `the-shortform-guide.md` |

**Read in part:**
- `skills/data-scraper-agent` (outline plus core sections), `deployment-patterns` (outline plus checklists).
- `skills/video-editing`, `manim-video`, `canary-watch`, `frontend-design-direction`, `competitive-platform-analysis`, `documentation-lookup`.
- `commands/prp-prd.md`, `commands/plan-prd.md`, `agents/gan-evaluator.md`.
- `docs/token-optimization.md`, `docs/TROUBLESHOOTING.md`, `README.md` (MCP sections), `.claude-plugin/PLUGIN_SCHEMA_NOTES.md`.
- `the-longform-guide.md` (most of it), `the-security-guide.md` (skimmed), `rules/` (skimmed `common/*`, `web/design-quality.md`).

**Keyword grep over `skills/`** for ideation, brainstorm, pitch, demo, PRD, landing page, video, slide, judge, sponsor, submission, time-box, MVP, storyboard and rubric. Results are in §5.

**External checks:**
- Claude Code docs: MCP tool search ([mcp](https://code.claude.com/docs/en/mcp)) and system-prompt flags ([cli-reference](https://code.claude.com/docs/en/cli-reference)).
- Anthropic's harness-design article ([anthropic.com/engineering/harness-design-long-running-apps](https://www.anthropic.com/engineering/harness-design-long-running-apps)).
- Hackathon judging rubrics ([reskilll 2026 breakdown](https://blogs.reskilll.com/what-hackathon-judges-look-for-complete-judging-criteria-breakdown-2026/), [Okta devforum](https://devforum.okta.com/t/what-are-the-judging-criteria-for-the-hackathon/15842)).
- Playwright CLI vs MCP ([Checkly](https://www.checklyhq.com/blog/mcp-vs-cli-token-efficiency/), [morphllm](https://morphllm.com/playwright-mcp), [betterstack](https://betterstack.com/community/guides/ai/playwright-cli-vs-mcp-browser/)).

No ECC scripts or installers were executed.

---

## 2. Skill-by-skill verdicts

Grades:
- **Quality** is how well-made the skill is in general (A strong → D weak).
- **Fit** is how useful it is for a 12–48 h hackathon (High / Med / Low).

### 2.1 Research lane

| Skill | Quality | Fit | Verdict | Why |
|---|---|---|---|---|
| `skills/deep-research/SKILL.md` (170 lines) | B | High | **ADAPT** | Solid generic skeleton: clarify goal (1–2 Qs, skip if "just research it") → 3–5 sub-questions → 2–3 query variants each → **15–30 sources** → deep-read **3–5** in full → cited report with confidence level → optional 3 parallel subagents. Good "Untrusted Sources" block (never follow page instructions, never let a source redirect scope, flag manipulation under its citation). **Weaknesses:** hard-wired to `firecrawl_*` / `*_exa` MCP tool names that ECC no longer enables by default; no time or cost budget; no recency floor beyond "last 12 months"; report template is an essay, not a decision. |
| `skills/research-ops/SKILL.md` (113) | B | High | **STEAL the labels, skip the rest** | Best idea: every claim tagged **sourced fact / user-provided context / inference / recommendation**, with **concrete dates** on freshness-sensitive claims. Also good: "take the lightest useful evidence path first" and "start from what the user already gave you; don't restart from zero". Skip the `lead-intelligence`, `knowledge-ops` and "should this become a monitor" lanes. |
| `skills/search-first/SKILL.md` (183) | A- | High (build phase) | **STEAL** | **Tool Availability Preflight** table (check `rg`, the package manager, `gh auth status`, MCP list, skills dir, and *report skipped channels honestly*). **Decision matrix:** Adopt / Extend / Compose / Build. Anti-patterns include "Silent skipping: reporting 'nothing found' when a search channel was unavailable". Hackathon twist to add: **sponsor SDKs and starter templates first** (prize eligibility + speed). |
| `skills/market-research/SKILL.md` (87) | C+ | Med | **ADAPT a slice** | Keep the standards: "decisions, not research theater", "include contrarian evidence and downside cases", "product reality, not marketing copy". TAM/SAM/SOM and investor-diligence modes are mostly irrelevant; judges score *impact on a specific user*, not market size. |
| `skills/exa-search/SKILL.md` (117) | C | Low | **SKIP** (fold into a provider adapter) | Thin parameter docs for `web_search_exa` / `get_code_context_exa`, marked "Drift-prone". Needs `EXA_API_KEY`. HackForge should have **one search-provider adapter** (built-in WebSearch/WebFetch → `bdata` → optional Exa/Firecrawl/Parallel) rather than one skill per vendor. |
| `skills/data-scraper-agent/SKILL.md` (776, `origin: community`) | B- | Low | **SKIP core; optional template** | This is a *product template* (COLLECT → ENRICH → STORE on GitHub Actions cron + Gemini Flash + Notion/Sheets/Supabase), not a research workflow. Two reusable bits: "Batch LLM calls (33 items → 7 calls)" and the "Untrusted Scraped Data" rules. **Stale:** model chain `gemini-2.0-flash-lite → gemini-2.0-flash → gemini-2.5-flash`. |
| `skills/scientific-thinking-literature-review` (193) | B (by description) | Low | SKIP | Academic screening workflow; too slow for a hackathon. |

### 2.2 Product lane

| Skill | Quality | Fit | Verdict | Why |
|---|---|---|---|---|
| `skills/product-lens/SKILL.md` (93) | B | High | **ADAPT Modes 1 and 4** | **Mode 1, Product Diagnostic** (7 Qs: who specifically, quantified pain, why now, 10-star version, MVP, anti-goal, success metric) → `PRODUCT-BRIEF.md` with go/no-go. It is a good idea-filter checklist. **Mode 4, ICE** (impact × confidence ÷ effort, each 1–5) is the closest thing ECC has to idea scoring, but it is not tied to judging criteria, time budget, sponsor prizes or demo-ability. **Mode 2**, Founder Review (scores PMF from usage growth, retention, Stripe code): skip. **Mode 3**, User Journey Audit: becomes "time-to-wow" in the demo. |
| `skills/product-capability/SKILL.md` (142) | B | Low | **SKIP** | PRD → SRS "capability contract" (invariants, trust boundaries, lifecycle transitions, rollout/migration). Right for multi-service enterprise work, wrong for a 24 h MVP. Borrow only the OPEN QUESTIONS and NON-GOALS sections. |
| `commands/plan-prd.md` (162) | B+ | High | **ADAPT** | 4 phases (FRAME → GROUND → DECIDE → write `.claude/prds/{name}.prd.md`). **Anti-fluff rule:** "When information is missing, write `TBD — needs validation via {method}`. Never invent plausible-sounding requirements." Hypothesis template: *"We believe {capability} will {solve problem} for {users}. We'll know we're right when {measurable outcome}."* |
| `commands/prp-prd.md` (447) | B | Low | SKIP (too long) | 8 phases with 5 user gates plus market and codebase grounding. Its PRD template is good (Problem / Evidence / Hypothesis / NOT building / Metrics / MoSCoW / phases table with "Parallel" and "Depends" columns), but the ceremony takes hours. |
| `skills/council/SKILL.md` (204) | A- | High | **ADAPT into a judge panel** | Architect (in-context) writes its position *first*. Skeptic, Pragmatist and Critic run as **fresh subagents that get only the question plus compact context** (the anti-anchoring rule), each replying in ≤300 words: Position / Reasoning / Risk / Surprise. For HackForge: re-cast the voices as the **event's actual judge personas** (technical judge, product/impact judge, sponsor judge, skeptic). Use it twice: to pick the idea, and to rehearse pitch Q&A. |
| `skills/intent-driven-development` (360, by description) | B | Med | ADAPT lightly | Acceptance criteria before code. Use it to write **demo acceptance criteria** ("judge can do X in under 30 s on a phone"). |
| `skills/competitive-platform-analysis`, `competitive-report-structure` | B | Low | SKIP | Agency-style 3-skill competitive pipeline (positioning brief → tiering → scored cards). Hackathon prior-art needs a 10-minute version: Devpost galleries of past events, the same sponsor's past winners, and 3 commercial products. |

### 2.3 Demo, pitch and marketing lane

| Skill | Quality | Fit | Verdict | Why |
|---|---|---|---|---|
| `skills/ui-demo/SKILL.md` (466) | **A** | **High** | **STEAL** | The best demo asset in ECC. See §3.1. |
| `skills/frontend-slides/` (SKILL 185 + `STYLE_PRESETS.md`, `html-template.md`, `animation-patterns.md`, `viewport-base.css`, `scripts/export-pdf.sh`, `scripts/extract-pptx.py`) | **A-** | **High** | **STEAL + add a hackathon deck flow** | See §3.2. |
| `skills/investor-materials/SKILL.md` (97) | B | Med | **ADAPT the "Golden Rule"** | "All investor materials must agree with each other. Create or confirm a single source of truth before writing." For HackForge this becomes one `FACTS.md` / `HACKATHON.md` that the Devpost text, deck, video narration and README all draw from. The 12-slide investor flow (raise, use of funds) is wrong for judges; replace it (§6.6). |
| `skills/marketing-campaign/SKILL.md` (114) | B | Low–Med | **STEAL two bits** | (1) **Positioning formula** for the tagline: "[Product] helps [audience] [achieve outcome] by [mechanism]". (2) **Hard bans** ("game-changing", "revolutionary", "In today's competitive landscape", "learn more" CTAs, "copy that could be dropped into a competitor's campaign unchanged") plus the **5-second test** for the Devpost hero line. Skip email sequences, ad variants and content calendars. |
| `skills/video-editing/SKILL.md` (337) | B- | Med | **ADAPT the FFmpeg recipes** | Layered pipeline (capture → organize → FFmpeg → Remotion → ElevenLabs/fal → Descript/CapCut). The FFmpeg snippets are the useful part: cut by timestamp, concat, normalize audio, silence detection for auto-cut, 16:9→9:16 reframe. The other layers are optional polish. |
| `skills/manim-video` (90), `remotion-video-creation` (43 + 29 rules), `fal-ai-media` (294), `tasteforge-video`, `videodb` | C | Low | SKIP (optional extras) | Explainer animation, generative media, and a hyperpop-music-video aesthetic (`taste`). Too slow, and off-target for a 2–3 min product demo. fal.ai is at most a "generate logo/thumbnail" helper (needs `FAL_KEY`). |
| `skills/frontend-design-direction` (172) + `rules/web/design-quality.md` + `skills/make-interfaces-feel-better` | B | Med–High | **ADAPT into a demo polish pass** | Anti-template policy: banned "stock hero with centered headline + gradient blob", "dashboard-by-numbers"; "pick a specific style direction". The **content-states table** (Loading / Empty / Error / Partial / Success / Permission) matters most, because empty and error states kill live demos. |
| `skills/content-engine`, `crosspost`, `social-publisher`, `x-api`, `seo`, `brand-voice`, `brand-discovery` | — | Low | SKIP | Launch and distribution tooling. At most an optional "post your project on X" step after submission. |

### 2.4 Build, ship and verify lane (only what touches the demo path)

| Skill | Quality | Fit | Verdict | Why |
|---|---|---|---|---|
| `skills/orch-build-mvp/SKILL.md` (49) + `orch-pipeline` (121) | B | Med | **ADAPT the slicing idea only** | Key line: order features into **thin vertical slices**, "one end-to-end path first, not all-models-then-all-views". The pipeline (Research → Plan → TDD → Review → Commit, two human gates, `feat:` commit per slice, `/gan-build --max-iterations 15 --pass-threshold 7.0`) is too heavy. |
| `skills/gan-style-harness/SKILL.md` (279) + `agents/gan-{planner,generator,evaluator}.md` + `commands/gan-build.md` | B+ (concept) / D (hackathon cost) | Med | **ADAPT, time-boxed** | Core insight, confirmed by Anthropic's 2026-03-24 article: agents over-rate their own work, so use a **separate skeptical evaluator** that drives the live app. Anthropic's numbers: solo 20 min / $9 with broken core features, versus the full harness 6 h / $200; the simplified Opus-4.6 harness took about 3 h 50 min / $124.70. Default rubric: Design 0.3 / Originality 0.2 / Craft 0.3 / Functionality 0.2, pass at 7.0. **For HackForge:** (a) swap in the *event's* judging rubric; (b) cap at **2–3 evaluator passes by wall clock**; (c) drive the browser via Playwright CLI or chrome-devtools, because `gan-evaluator.md`'s `mcp__playwright__*` tools are not enabled by ECC by default; (d) keep "evaluator never fixes". |
| `skills/browser-qa/SKILL.md` (105) | B | Med | **ADAPT Phase 1 only** | Smoke test: console errors (filter analytics noise), no 4xx/5xx, desktop + **mobile** screenshots, CWV (LCP < 2.5 s, CLS < 0.1, INP < 200 ms). Verdicts SHIP / SHIP WITH FIXES / DO NOT SHIP / INCONCLUSIVE. Safety-first: read-only by default, test credentials only. Skip visual regression baselines and the full axe pass. |
| `skills/canary-watch/SKILL.md` (108) | B- | Med | **ADAPT quick-check** | One pass over the deployed URL: HTTP 200, console, network, key elements (h1/nav/CTA), static assets, SSE. Run it before the live demo and before submitting. |
| `skills/deployment-patterns/SKILL.md` (428) | B (prod) / D (hackathon) | Low | **SKIP** (keep 3 snippets) | Rolling, blue-green, canary, k8s probes, multi-stage Dockerfiles, a 25-item production checklist. Keep only: (1) `vercel rollback` / `railway up --commit <sha>` instant rollback; (2) a Zod-validated env schema that fails fast at startup; (3) a `/health` endpoint. |
| `skills/github-ops/SKILL.md` (162) | B | Low | **SKIP** | Issue triage, stale policy (14/7/30 days), Dependabot, release management. A hackathon needs `gh repo create --public`, a good README, and maybe a `v1.0-submission` tag. The "Untrusted Repository Content" block is worth keeping in the safety rule. |
| `skills/benchmark-optimization-loop/SKILL.md` (71) | B | Low–Med | **NICE: adapt for demo latency** | Baseline first, one-hypothesis variants, correctness gate, variant table, promotion gate. Useful for "the LLM step must answer in under 3 s on stage" (cache, stream, smaller model). |
| `skills/mcp-server-patterns/SKILL.md` (70) | C | Situational | **Optional reference** | Generic, and defers to docs or Context7 for SDK signatures (`registerTool` vs `tool`). Relevant only when the hackathon theme is "build an MCP server or agent tool", which is common in 2025–26 AI hackathons. Point to official docs instead of copying. |
| `skills/mcp-dependency-review/SKILL.md` (177) | B+ | Med | **ADAPT into `/hf-doctor`** | Rigorous *static* classification. SAFE means an exact pin. HIGH covers bare names, `@latest`, dist-tags and Docker tags without a digest. MEDIUM covers ranges. REVIEW covers local paths and VCS refs. It never executes servers and never invents pins. |

### 2.5 Guides, contexts and rules

| File | Verdict | Notes |
|---|---|---|
| `the-shortform-guide.md` (431) | **ADAPT a few heuristics; flag stale ones** | Written by a hackathon winner (Anthropic x Forum Ventures, zenith.chat). It is mostly a setup tour (plugins, hooks, Zed, tmux, mgrep). **Stale:** "200k context … might only be 70k with too many tools enabled"; "20–30 MCPs in config, <10 enabled / <80 tools active"; statusline showing "Opus 4.5". |
| `the-longform-guide.md` (354) | **STEAL 4 patterns** | (1) **Two-instance kickoff:** Instance 1 = scaffolding agent (repo, configs), Instance 2 = deep-research agent (PRD, mermaid architecture, doc clips), run in parallel at T+0. (2) **Sequential-phase orchestrator:** "Each agent gets ONE clear input and produces ONE clear output; outputs become inputs; store intermediate outputs in files". (3) **Iterative retrieval:** orchestrator questions subagent returns, max 3 cycles; "pass objective context, not just the query". (4) **Replace MCPs with CLI + skill/command**, e.g. `/gh-pr` wrapping `gh pr create`. Also the `llms.txt` tip for docs. |
| `the-security-guide.md` (463) | **ADAPT a 10-line hackathon safety rule** | Minimum-bar checklist; repo-controlled `.mcp.json`/hooks as attack surface; OWASP MCP Top 10. For HackForge: never commit `.env`; scoped short-lived tokens; never run scripts from cloned starter repos unreviewed; review `.mcp.json` before approving. |
| `contexts/{dev,research,review}.md` (20–26 lines each) | **SKIP** | Generic mode prompts ("Write code first, explain after"). The longform guide loads them with `claude --system-prompt "$(cat ~/.claude/contexts/dev.md)"`. Per the [CLI reference](https://code.claude.com/docs/en/cli-reference), `--system-prompt` **"Replaces the entire default prompt"**, which drops Claude Code's tool guidance and safety instructions. If HackForge wants per-phase modes, use `--append-system-prompt-file`, output styles, or (best) phase skills. |
| `rules/common/{development-workflow,testing,performance,agents}.md` | **SKIP / explicitly override** | Mandates "Research & Reuse → Plan (PRD, architecture, system_design, tech_doc, task_list) → TDD (write tests first, 80%+ coverage) → code-reviewer immediately → conventional commits". In a hackathon that is a time sink. HackForge needs a `hackathon-mode` rule (§6.9). One part is worth keeping: the **research order** from `development-workflow.md`: GitHub code search → library docs (Context7/vendor) → Exa/web only if needed → package registries. |
| `rules/web/design-quality.md` | **ADAPT** | Path-scoped (`**/*.tsx` etc.) anti-template policy and "≥4 of 10 required qualities". A good always-on rule for demo UIs. |
| `docs/MCP-CONNECTOR-POLICY.md`, `docs/capability-surface-selection.md` | **STEAL as design principles** | See §4. |

---

## 3. The two skills worth taking whole

### 3.1 `skills/ui-demo` (demo video)

**What is strong:**
- **Discover → Rehearse → Record, and never skip straight to recording.**
  - Discover dumps every visible `input/select/textarea/button/[contenteditable]` per page into a field map.
  - Rehearse runs `ensureVisible(page, selector, label)` for every step and exits non-zero with a visible-element dump on failure ("REHEARSAL FAILED - fix selectors before recording").
- **Production helpers:**
  - `injectCursor` (SVG arrow overlay; re-inject after every navigation),
  - `moveAndClick` (eased move in 10 steps, then click, with labels),
  - `typeSlowly` (`pressSequentially`, 25–40 ms/char),
  - smooth scroll, `panElements` for dashboards,
  - `injectSubtitleBar` / `showSubtitle` (≤60 chars, "Step N - Action").
- **Concrete pacing:** 4 s after login, 3 s after navigation, 2 s after a click, 1.5–2 s between steps, 3 s at the end.
- **Recording setup:** 1280×720 `recordVideo`, headless, copy the output to a stable filename, 12 listed pitfalls, and a pre-record checklist.

**What HackForge must add:**
1. **A script before the scenes.** Generate a timed narrative: a 15–20 s hook, then problem → "golden path" demo → how it works → sponsor tech → impact → close. Total within the event's limit (often ~2–3 min; verify per event). Each scene maps to subtitles and voiceover lines.
2. **Deterministic demo state.** A `seed-demo` script with realistic seed data (judges penalize hardcoded or placeholder data) and a `reset-demo` script so rehearsal and recording start from identical state.
3. **Audio and format.** Optional TTS or recorded voiceover; `ffmpeg` mux, WebM→MP4 (H.264/AAC), loudness normalize, title and end cards (reuse `video-editing` snippets).
4. **A live-demo fallback.** The recorded golden-path video is the backup if wifi or the API fails on stage. Pre-load it.
5. **Playwright CLI/library rather than an MCP** for recording (keeps tokens out of context; the script is a file).
6. **Upload checklist.** Public or unlisted visibility, length limit, captions; test the link while logged out.

### 3.2 `skills/frontend-slides` (pitch deck)

**What is strong:**
- One self-contained HTML file.
- **Viewport fit is a hard gate:** `height:100vh; height:100dvh; overflow:hidden` and `clamp()` everywhere; split slides rather than shrink text.
- **Density limits:** title = 1 heading + 1 subtitle; content = 1 heading + 4–6 bullets; feature grid ≤ 6 cards; code ≤ 8–10 lines.
- 12 named presets in `STYLE_PRESETS.md` (Bold Signal, Swiss Modern, Terminal Green…), plus "3 single-slide previews, let the user pick".
- Keyboard, touch and wheel navigation, reduced-motion support.
- Validation at 1920×1080, 1280×720, 768×1024, 375×667 and 667×375.
- `scripts/export-pdf.sh` serves the deck locally, screenshots each slide with Playwright, and builds a PDF (`--compact` for 1280×720). Devpost and judges often want a PDF.

**What HackForge must add:**
- A **hackathon slide flow** (§6.6) instead of the investor flow.
- **Speaker notes** with per-slide second budgets (~150 words/min).
- An embedded demo GIF or MP4 fallback slide.
- A "sponsor tech used" slide.
- An optional `pptx` export, or reuse of Anthropic's `pptx` skill when Google Slides is mandated.

---

## 4. How ECC recommends and manages MCPs

### 4.1 What is on by default vs opt-in

| Layer | What ships | Evidence |
|---|---|---|
| Claude Code plugin install (`/plugin install ecc`) | **No MCPs.** `"mcpServers": {}` is a deliberate opt-out of Claude Code's auto-discovery of the plugin-root `.mcp.json`, partly because long plugin tool names (e.g. `mcp__plugin_everything-claude-code_github__create_pull_request_review`) exceed 64 chars on strict OpenAI-compatible gateways. | `.claude-plugin/plugin.json`; `.claude-plugin/PLUGIN_SCHEMA_NOTES.md:150-181` |
| Root `.mcp.json` (Codex plugin / manual) | **One:** `chrome-devtools` → `npx -y chrome-devtools-mcp@1.10.1`, pinned and keyless. It passes the rule because "the value is the held-open session" (live CDP debugging, traces, console/network). | `.mcp.json`; `docs/MCP-CONNECTOR-POLICY.md` |
| Catalog (copy-paste, opt-in) | **34 entries** in `mcp-configs/mcp-servers.json`. Notable for HackForge: `vercel` (HTTP, `https://mcp.vercel.com`), `railway`, `supabase`, `cloudflare-*` (4 HTTP), `context7`, `exa-web-search`, `parallel-search` (HTTP, described as "works key-free for anonymous use"; verify), `firecrawl`, `playwright`, `browserbase`, `browser-use`, `fal-ai`, `magic` (Magic UI), `github`. `_comments.context_warning`: "Keep under 10 MCPs enabled to preserve context window." | `mcp-configs/mcp-servers.json` |
| Install-time filter | `ECC_DISABLED_MCPS="chrome-devtools,…"` filters ECC-generated MCP configs during `install.sh` / Codex sync. It is "**not a live Claude Code toggle**"; use `/mcp` for runtime disables, which persist in `~/.claude.json`. | `README.md:614-617`, `docs/token-optimization.md:123-131` |

### 4.2 The selection rule (best idea here: steal it)

From `docs/MCP-CONNECTOR-POLICY.md`, a default connector must be:
1. **Universal**: applies to essentially every user on every harness.
2. **Something where MCP beats a CLI/API wrapped in a skill**: the job needs interactive session state, streaming, an auth handshake, or structured browsing. "Stateless request/response work is a skill, not a server. Tool schemas load into every session; each default connector taxes every user's context window."

"The 2026 field default across serious harnesses is zero to two connectors plus native built-ins."

The **June 2026 audit** demoted six former defaults:

| Former default | Replaced by |
|---|---|
| `github` | `gh` CLI via `github-ops` ("~30 tool schemas taxed every session") |
| `context7` | `documentation-lookup` over the Context7 REST `/api/v2/...` |
| `exa` | Harness-native WebSearch (key requirement fails the universality test) |
| `memory` | Native memory |
| `playwright` | `@playwright/cli`, since "the vendor itself moved agent workflows off MCP because returning full accessibility trees per step burns context" |
| `sequential-thinking` | Native extended thinking ("a prompting pattern dressed as a connector") |

`docs/capability-surface-selection.md` adds the routing order:
1. **rule**: deterministic, path or event triggered;
2. **skill**: on-demand playbook;
3. **MCP**: structured, repeated, cross-client, long-lived;
4. **local CLI or script**;
5. **direct API call inside a skill**.

When both are viable, prefer the smaller runtime surface, lower token overhead and fewer moving parts.

### 4.3 How ECC says to manage context cost

- README "Context window management": "Each MCP tool description consumes tokens from your 200k window, potentially reducing it to ~70k." Keep <10 MCPs enabled per project and <80 tools active; `/mcp` to disable; `/context-budget` to audit.
- Shortform guide: "I have 14 MCPs configured but only ~5-6 enabled per project."
- Longform guide: replace MCPs with CLIs wrapped in commands and skills (`/gh-pr`, Supabase CLI skill). "With lazy loading, the context window issue is mostly solved. But token usage and cost is not."
- `docs/TROUBLESHOOTING.md:64`: "Reduce tool-definition pressure with `ENABLE_TOOL_SEARCH=auto:5`"; route subagents to a cheaper model (`CLAUDE_CODE_SUBAGENT_MODEL=haiku`); compact at natural breakpoints.
- `skills/context-budget`: audits eager metadata (agent and skill descriptions, always-loaded instructions, MCP tool schemas) without launching servers.

### 4.4 Reality check against current Claude Code (Oct 2026)

From [code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp):

- **Tool search is on by default.** "Only tool names and server instructions load at session start, so adding more MCP servers has minimal impact on your context window." `ENABLE_TOOL_SEARCH` values:

  | Value | Behaviour |
  |---|---|
  | unset | Deferred (falls back to upfront loading on old models or a non-first-party `ANTHROPIC_BASE_URL`) |
  | `true` | Deferred, even through proxies |
  | `auto` | Load upfront while definitions are under 10% of context |
  | `auto:N` | Same, with a custom percentage |
  | `false` | Everything upfront |

  ECC's "under 10 MCPs / 80 tools / 200k→70k" heuristic is therefore **stale for context size**. It still applies when tool search is off, for example behind a proxy `ANTHROPIC_BASE_URL`, which some hackathon credit programs use.
- **What still costs:**
  - **Output size.** Warning at 10k tokens; default cap `MAX_MCP_OUTPUT_TOKENS=25000`; results over 50,000 chars are saved to a file. Playwright MCP snapshots are typically 10–30k tokens each; the CLI returns a file path ([morphllm](https://morphllm.com/playwright-mcp), [betterstack](https://betterstack.com/community/guides/ai/playwright-cli-vs-mcp-browser/)). [Checkly](https://www.checklyhq.com/blog/mcp-vs-cli-token-efficiency/) argues the gap has narrowed now that tool search exists.
  - **`alwaysLoad: true` servers**, which load upfront and make startup wait up to 5 s.
  - **Auth friction.** OAuth flows mid-hackathon; `claude mcp login <name>`.
  - **Supply chain.** Unpinned `npx -y pkg`.
- **Trust.** Project `.mcp.json` servers need interactive approval, **but `claude -p` / Agent SDK / cloud sessions load them without asking.** Use `disabledMcpjsonServers` or `--strict-mcp-config --mcp-config …` for headless HackForge workflows.
- **`--system-prompt` replaces the whole default prompt.** ECC's `contexts/` aliases use it. Use `--append-system-prompt-file` instead ([cli-reference](https://code.claude.com/docs/en/cli-reference)).

### 4.5 ECC MCP inconsistencies (don't inherit them)

| Where | Problem |
|---|---|
| `skills/deep-research` | Requires firecrawl or exa MCP; neither is a default after the June 2026 audit. Out of the box the skill has no tool unless the user adds keys. |
| `skills/documentation-lookup` | Still instructs `resolve-library-id` / `query-docs` **MCP** tools; the policy says it was converted to the Context7 REST API. |
| `agents/gan-evaluator.md` | `tools:` lists `mcp__playwright__browser_*`; Playwright MCP is no longer a default, so `/gan-build` evaluation silently lacks tools. |
| `docs/token-optimization.md:131` | "The `memory` MCP server is configured by default"; contradicted by the policy. |
| `mcp-configs/mcp-servers.json` | Only `mcp-atlassian==0.21.0` is exactly pinned among 18 npx/uvx entries. `@latest`: `@supabase/mcp-server-supabase@latest`, `@upstash/context7-mcp@latest`, `@magicuidesign/mcp@latest`. 14 bare names (e.g. `firecrawl-mcp`, `exa-mcp-server`, `@playwright/mcp`). By its own `mcp-dependency-review` rules these are **HIGH**. `evalview` uses a range (`>=0.5,<1`, MEDIUM). |

---

## 5. What ECC does NOT have that a hackathon harness needs

Grep evidence over `skills/`:

| Keyword | Hits |
|---|---|
| `hackathon` | 0 |
| `ideation` | 0 |
| `devpost` | 0 |
| `user research` / `user interview` | 0 |
| `brainstorm` | 1 (manufacturing QA) |
| `sponsor` | 2 (email-ops, a LICENSE file) |
| `time-box` | 2 (autonomous-loops, operator-approval-loop; iteration caps, not deadlines) |
| `pitch deck` | 3 (frontend-slides, its presets, investor-materials) |
| `rubric` | 12 (evals, GAN, santa-method; none about judging criteria) |

| # | Missing capability | Why it matters for winning | Closest ECC piece to build from |
|---|---|---|---|
| M1 | **Hackathon brief intake → single source of truth** (`HACKATHON.md`): theme, eligibility, deadline + timezone, judging criteria **with weights**, required tech, sponsor prizes (requirements + $), submission fields, video length limit, team skills/roles | Every later decision is scored against it; prevents "built a great thing that's ineligible" | `investor-materials` Golden Rule; `research-ops` "start from what the user gave you" |
| M2 | **Divergent ideation** (10–20 ideas from theme × sponsor APIs × pain evidence × team strengths) | ECC only *evaluates* ideas (product-lens) and never generates them | none |
| M3 | **Idea scoring rubric aligned to the event's judging criteria**, plus feasibility-in-time, demo-ability ("wow in 30 s"), prize stacking, novelty | Judges score innovation / technical / impact / presentation / completeness; typical weights are 20–25 / 20–25 / 20–25 / 15–20 / 10–15 ([reskilll](https://blogs.reskilll.com/what-hackathon-judges-look-for-complete-judging-criteria-breakdown-2026/)). Okta-style events weight creativity, implementation and impact equally, with a pass/fail "used the required APIs" gate ([Okta](https://devforum.okta.com/t/what-are-the-judging-criteria-for-the-hackathon/15842)) | `product-lens` Mode 4 ICE; `council` |
| M4 | **Sponsor-prize mapping**: per sponsor, what API/SDK, what "meaningful use" means, eligibility, whether prizes stack, and which idea features hit which prizes | Prize stacking is often the highest-EV move; Okta scored "how many features beyond login" | none |
| M5 | **Prior-art / novelty check** against Devpost galleries of this and past events, the sponsor's past winners, and commercial products | "Another todo app or chatbot" and "thin API wrappers" get penalized | `market-research` "product reality, not marketing copy" (heavier `competitive-*` skills are overkill) |
| M6 | **Deadline-driven time-boxing**: phase budgets, feature freeze, deploy freeze, T-minus checkpoints, a statusline countdown | Hackathons are lost to scope creep and last-hour deploy breakage | `benchmark-optimization-loop` "search budget"; GAN `max-iterations` (iteration caps, not clocks) |
| M7 | **Demo-first PRD**: the demo script *is* the spec; Must = appears on screen; a **fake-vs-real ledger** (what is mocked, what is live) | Judges penalize mockups and hardcoded data; honesty at Q&A | `plan-prd` + `intent-driven-development` |
| M8 | **Demo script + golden path + seed/reset data + live-demo fallback** | "Live demo doesn't crash" is a top reward; crashes are a top penalty | `ui-demo` (records only; no narrative, no state reset, no fallback plan) |
| M9 | **Hackathon pitch**: 2–3 min flow, per-slide timing, speaker notes, who presents what, **judge Q&A rehearsal** | Demo/presentation is 15–20% of the score, and it frames every other criterion | `frontend-slides` + `council` |
| M10 | **Submission checklist + Devpost copy generator**: Devpost's default story sections (Inspiration / What it does / How we built it / Challenges we ran into / Accomplishments that we're proud of / What we learned / What's next; from prior knowledge, verify per event), "Built with" tags, try-it links, video URL, gallery screenshots, repo public + license, team members added, prize opt-ins, everything tested logged-out | Incomplete submissions are disqualified or never reach judges | none (`marketing-campaign` hard-bans for copy quality) |
| M11 | **Judge-facing README**: one-paragraph pitch, live URL, 60-second local setup, architecture diagram, sponsor tech used, real-vs-mocked | Technical judges open the repo | `orch-build-mvp`'s doc-driven approach; `update-docs` command |
| M12 | **Simulated judging**: an LLM judge panel scores deck + video transcript + live app against the *event's* rubric before submission | Catches weak criteria while there's still time | `gan-evaluator` (design rubric) + `council` (personas) + `santa-method` (two independent reviewers) |
| M13 | **Hackathon-mode rules** overriding TDD/80% coverage: smoke-test the demo path, never break main after feature freeze, commit every slice, secrets in `.env` | ECC's always-on rules will actively slow a team down | `rules/common/*` (override) |
| M14 | **Human team orchestration**: roles (builder, frontend/demo, research/pitch), handoff files, who owns which artifact | Most teams are 2–4 people + agents | `team-builder` / `team-agent-orchestration` (agent teams, not humans) |

---

## 6. Recommended HackForge design (built from the steals above)

Artifacts flow through files (longform guide: "each agent ONE input → ONE output").

**Proposed phase skills and artifacts:**

| Phase | Skill / command | Inputs → Output | Built from (ECC) | Default time box (24 h event) |
|---|---|---|---|---|
| 0 Kickoff | `/hf-kickoff` | rules URL/paste → `HACKATHON.md` (criteria + weights, prizes, deadline, submission fields, team) | investor-materials Golden Rule | 20 min |
| 1 Research | `hf-research` | `HACKATHON.md` → `RESEARCH.md` (pain evidence, sponsor API capabilities, datasets/APIs, prior art; each claim labelled fact / user / inference + date) | deep-research + research-ops + search-first preflight | 60–90 min, ≤25 searches, 3 parallel subagents |
| 2 Ideate + score | `hf-ideate` | `RESEARCH.md` → `IDEAS.md` (15 ideas → top 3 scored → 1 pick + why) | product-lens Mode 1/4 + council (as judge panel) | 45 min |
| 3 Spec | `hf-spec` | pick → `SPEC.md` (demo-first PRD: hypothesis, golden-path script, Must/Won't, fake-vs-real ledger, slices) | plan-prd + orch-build-mvp slicing + intent-driven-development | 30 min |
| 4 Build | `hf-build` (plus Workflow script) | `SPEC.md` → app; slice 1 end-to-end first; adopt/extend/build per dependency | search-first + orch-build-mvp + GAN evaluator (2–3 passes, event rubric) | ~55% of event |
| 5 Ship | `hf-ship` | app → deployed URL + `/health` + env validation; quick canary + browser-qa Phase-1 smoke (desktop + mobile) | deployment-patterns snippets + canary-watch + browser-qa | deploy by T-6 h; **deploy freeze T-2 h** |
| 6 Demo | `hf-demo` | `SPEC.md` golden path → `demo/script.md` → Playwright rehearse → record → ffmpeg MP4 with captions | **ui-demo** + video-editing ffmpeg | 60–90 min |
| 7 Pitch | `hf-pitch` | `HACKATHON.md` + `SPEC.md` + demo → `pitch.html` + PDF + speaker notes + Q&A prep | **frontend-slides** + investor-materials + council | 60 min |
| 8 Judge sim | `hf-judge` | deck + video transcript + live URL → scores per criterion + top 3 fixes | gan-evaluator + council + santa-method | 20 min, at T-4 h |
| 9 Submit | `/hf-submit` | everything → Devpost copy + checklist pass/fail | marketing-campaign hard-bans | 30 min buffer, **submit by T-30 min** |

### 6.1 Idea scoring rubric (the missing M3; weights come from `HACKATHON.md`)

Score each idea 1–5 per row; multiply by weight; sum.

| Dimension | Default weight | 1 = | 5 = | Source of weight |
|---|---|---|---|---|
| Judging criteria fit (one row per official criterion) | event's own weights, e.g. Innovation 25 / Technical 25 / Impact 25 / Presentation 15 / Completeness 10 | weak on the criterion | exemplary | `HACKATHON.md` |
| Feasibility in remaining hours (team skills × APIs × data access) | gate: < 3 → reject | needs unknown infra | slice 1 doable in < 25% of build time | team |
| Demo-ability ("wow in 30 s", visual, live) | ×1.5 multiplier | invisible backend | judges *see* the payoff live | HackForge default |
| Sponsor-prize EV (Σ prize $ × P(eligible and competitive)) | tiebreak | none | stacks 2+ prizes with meaningful use | prize map |
| Novelty vs prior art | gate: "exact clone of a past winner" → reject | duplicate | new angle / new combination | prior-art check |
| Evidence of real pain | modifies Impact | assumption only | quotes, data, or a team member's lived problem | `RESEARCH.md` |

Then run **council-as-judges**. Use fresh subagents with only the rubric, the idea one-pager and the event context, each in the persona of the event's judges (technical, product/impact, sponsor rep, skeptic). Format: Position / Reasoning / Risk / Surprise, ≤300 words. The in-context orchestrator writes its pick first (ECC anti-anchoring rule).

### 6.2 Research skill shape (adapting deep-research and research-ops)

- **Inputs:** `HACKATHON.md`. **Output:** `RESEARCH.md` with these sections:
  - Pain evidence
  - Users / JTBD
  - Sponsor tech capabilities and limits (rate limits, free tiers, auth)
  - Datasets and APIs available now
  - Prior art (past winners, products)
  - Open questions
- **Provider ladder** (search-first preflight; report skipped channels):
  1. Built-in `WebSearch` / `WebFetch` (free).
  2. `bdata search|discover|scrape -o file` (paid; already installed here; bypasses bot walls).
  3. Optional `parallel-search` HTTP MCP (keyless per ECC; verify), Exa or Firecrawl if the team has keys.
  4. `llms.txt` and Context7 for docs.
- **Budgets:** ≤25 searches, ≤6 full reads, 3 parallel subagents (one per sub-question cluster). Each subagent returns ≤400 words to a file. The orchestrator does ≤2 follow-up cycles (longform "iterative retrieval", capped lower than ECC's 3).
- **Rules:** keep deep-research's untrusted-source block verbatim; research-ops evidence labels plus dates; "insufficient data found" beats hallucination; flag anything older than 12 months.

### 6.3 Demo-first spec (adapting plan-prd)

- Restate the hypothesis with plan-prd's template.
- **Golden path = 5–8 user steps**; each step names the screen, the data shown, and the "wow".
- **MoSCoW, where Must = on screen in the demo.** Won't-build list (product-lens "anti-goal").
- **Fake-vs-real ledger table:** component | live / mocked / seeded | judge-safe wording.
- **Slices:** slice 1 = thinnest end-to-end golden path (orch-build-mvp). Each later slice adds one demo beat.
- **Anti-fluff:** `TBD — needs validation via {method}` (plan-prd).

### 6.4 Build-loop evaluator (adapting the GAN harness, time-boxed)

- Generator builds slice N.
- **Evaluator subagent (never the author)** drives the live app with Playwright CLI or chrome-devtools. It scores against **the event rubric + Functionality-on-golden-path + Design (anti-template)** and writes `feedback/NNN.md`.
- Stop at pass ≥ 7.0, **or after 2–3 passes, or when the phase clock expires**, whichever comes first. Keep GAN anti-patterns #1–5 (too lenient, ignored feedback, infinite loops, superficial testing, evaluator praising its own fixes).

### 6.5 Demo recording (stealing ui-demo)

1. `demo/script.md` gives scene, seconds, narration line, on-screen action and subtitle (≤60 chars).
2. `npm run demo:seed && npm run demo:reset`.
3. `node demo/record.cjs --rehearse`, which must print "REHEARSAL PASSED".
4. `node demo/record.cjs`, giving a WebM at 1280×720.
5. Convert and caption:
   `ffmpeg -i demo.webm -c:v libx264 -pix_fmt yuv420p -c:a aac -af loudnorm demo.mp4`
   Then add captions / title / end card. Optional voiceover mux.
6. Keep the MP4 locally as the **live-demo fallback**; upload as public or unlisted; verify logged-out.

### 6.6 Hackathon deck flow (replacing investor-materials' 12-slide investor flow)

1. **Hook**: one line plus a striking number or story (product-lens "who + pain").
2. **Problem**: a specific user, quantified pain, why now.
3. **Solution**: the tagline using marketing-campaign's positioning formula.
4. **Live demo** (or embedded fallback video), 60–90 s.
5. **How it works**: architecture diagram, what's real.
6. **Sponsor tech**: exactly which APIs and why they mattered (prize eligibility).
7. **Impact / validation**: evidence, users, metric.
8. **What's next + team**: one slide.

Optional appendix: challenges, roadmap.

Timing: 3 min ≈ 450 spoken words. Speaker notes per slide with a seconds budget. frontend-slides density limits and viewport gate stay mandatory. Export with `scripts/export-pdf.sh` (adapted copy).

### 6.7 Submission checklist (new)

- [ ] Title, tagline (passes the 5-second test; no hard-banned words).
- [ ] Devpost story sections filled from `FACTS.md`.
- [ ] Built-with tags.
- [ ] Video URL public or unlisted, within the length limit, captions on.
- [ ] Live URL works logged-out and on mobile (browser-qa Phase 1 + canary quick check).
- [ ] Repo public with a license.
- [ ] README (judge-facing; 60-second setup; real-vs-mocked).
- [ ] Screenshots or GIF in the gallery.
- [ ] All team members added.
- [ ] Each sponsor prize explicitly opted into, with its requirement satisfied.
- [ ] No secrets in the repo (`git log -p | rg -i 'api[_-]?key|secret'`; `.env` in `.gitignore`).
- [ ] Submitted before T-30 min; confirmation screenshot saved.

### 6.8 MCP and CLI posture for HackForge (adopting ECC's policy, updated for tool search)

- **Default: zero bundled MCPs.** Do what ECC does: `"mcpServers": {}` in the plugin manifest. Ship CLI-wrapping skills instead:

  | Job | CLI |
  |---|---|
  | GitHub | `gh` |
  | Deploy | `vercel` or `railway` CLIs |
  | Backend | `supabase` CLI |
  | Paid web data | `bdata` (already present) |
  | Browser automation and recording | `npx playwright` (library/CLI) |
  | Video | `ffmpeg` |

- **Optional, per-phase MCP profile** (`.mcp.json` templates, all **exact-pinned**, checked by an adapted `mcp-dependency-review` in `/hf-doctor`):
  - `chrome-devtools-mcp@<reviewed version>` for live debugging (ECC pins 1.10.1).
  - `vercel` HTTP MCP, only if the team prefers it over the CLI.
  - Context7 (or `llms.txt` fetches) for docs.
  - `parallel-search`, Exa or Firecrawl for research, if keys are available.
  - Sponsor-provided MCPs (common in 2026 AI hackathons; many sponsors ship one). Evaluate them with the two-prong rule.
- **Context controls:**
  - Rely on default tool search; never set `alwaysLoad: true` except for a sponsor tool used every turn.
  - Set `MAX_MCP_OUTPUT_TOKENS` sensibly.
  - For headless Workflow runs, pass `--strict-mcp-config --mcp-config hackforge.mcp.json`, since project `.mcp.json` auto-loads without approval in `-p` / SDK mode.
  - If the team is behind a proxy `ANTHROPIC_BASE_URL` (tool search disabled), fall back to ECC's "≤10 servers / ≤80 tools" heuristic and `ENABLE_TOOL_SEARCH=auto:5`.

### 6.9 `hackathon-mode` rule (replacing `rules/common/testing.md` and `development-workflow.md`)

- **Testing:** smoke-test the golden path (one Playwright script, the same one the demo rehearsal uses). No coverage targets. Unit tests only for tricky pure logic.
- **Git:** commit after every working slice. After **feature freeze (T-4 h)** only fixes and polish. After **deploy freeze (T-2 h)** only content and video work.
- **Dependencies:** search-first; prefer sponsor SDKs and starters; no new dependencies after freeze.
- **Data:** realistic seed data and no lorem ipsum (judges penalize placeholder or hardcoded data). Keep the fake-vs-real ledger current.
- **Secrets:** `.env` gitignored from minute 0; scoped keys.
- **UI:** `design-quality` anti-template rule plus the empty/error/loading states on every golden-path screen.

---

## 7. Steal / Adapt / Skip / Missing table

Verdict meanings:
- **STEAL**: copy the structure nearly verbatim, renaming for HackForge.
- **ADAPT**: take the idea, rewrite it for hackathon constraints.
- **SKIP**: don't port.
- **MISSING**: build new.

| # | Verdict | ECC path | What to take (or why not) | HackForge target |
|---|---|---|---|---|
| 1 | **STEAL** | `skills/ui-demo/SKILL.md` | Discover→Rehearse→Record; `ensureVisible`, `injectCursor`, `moveAndClick`, `typeSlowly`, `showSubtitle`, `panElements`; pacing numbers; 1280×720; checklist and 12 pitfalls | `skills/hf-demo/` + `templates/demo/record.cjs` |
| 2 | **STEAL** | `skills/frontend-slides/` (incl. `STYLE_PRESETS.md`, `viewport-base.css`, `html-template.md`, `scripts/export-pdf.sh`) | Single-file deck, viewport-fit gate, density limits, presets, preview-3-styles, PDF export | `skills/hf-pitch/` (+ hackathon flow §6.6) |
| 3 | **STEAL** | `skills/search-first/SKILL.md` | Tool-availability preflight; Adopt/Extend/Compose/Build matrix; "silent skipping" anti-pattern | `skills/hf-build/` dependency step; `hf-research` preflight |
| 4 | **STEAL** | `docs/MCP-CONNECTOR-POLICY.md`, `docs/capability-surface-selection.md` | Two-prong default-connector rule; rule→skill→MCP→CLI→API routing; "0–2 default connectors" | `docs/DESIGN-PRINCIPLES.md` |
| 5 | **STEAL** | `.claude-plugin/plugin.json` (`"mcpServers": {}`) + `PLUGIN_SCHEMA_NOTES.md:150-181` | Ship zero auto-loaded MCPs; avoids >64-char tool names on strict gateways | HackForge `plugin.json` |
| 6 | **ADAPT** | `skills/council/SKILL.md` | 4 voices, fresh-subagent anti-anchoring, Position/Reasoning/Risk/Surprise ≤300 words → **judge-persona panel** | `hf-ideate` selection + `hf-pitch` Q&A rehearsal |
| 7 | **ADAPT** | `skills/deep-research/SKILL.md` | Sub-questions, 2–3 query variants, 15–30 sources → cut to ≤25 searches / ≤6 deep reads, untrusted-sources block, citations + confidence, parallel subagents; **remove the firecrawl/exa hard dependency** | `skills/hf-research/` |
| 8 | **ADAPT** | `skills/research-ops/SKILL.md` | Evidence labels (fact / user / inference / recommendation) + dates; "lightest evidence path first" | `hf-research` output contract |
| 9 | **ADAPT** | `skills/product-lens/SKILL.md` | Mode 1 7-question diagnostic; Mode 4 ICE → judging-weighted rubric (§6.1); Mode 3 → "time-to-wow" | `hf-ideate` |
| 10 | **ADAPT** | `commands/plan-prd.md` | 4-phase lean PRD, hypothesis template, `TBD — needs validation via {method}` | `hf-spec` (demo-first PRD) |
| 11 | **ADAPT** | `skills/orch-build-mvp/SKILL.md` | "thin vertical slices — one end-to-end path first" | `hf-spec` slices + `hf-build` order |
| 12 | **ADAPT** | `skills/gan-style-harness/SKILL.md`, `agents/gan-evaluator.md`, `commands/gan-build.md` | Separate strict evaluator on the live app; feedback files; anti-patterns → event rubric, 2–3 passes, wall-clock cap, Playwright CLI not MCP | `hf-build` evaluator agent + `hf-judge` |
| 13 | **ADAPT** | `skills/investor-materials/SKILL.md` | "All materials agree / single source of truth"; red flags (unverifiable claims) | `HACKATHON.md` + `FACTS.md` used by deck, Devpost copy, README, narration |
| 14 | **ADAPT** | `skills/marketing-campaign/SKILL.md` | Positioning formula; Hard Bans list; 5-second test; claim audit | `hf-pitch` tagline + `/hf-submit` copy lint |
| 15 | **ADAPT** | `skills/browser-qa/SKILL.md` | Phase 1 smoke (console, 4xx/5xx, mobile screenshot, CWV) + verdict vocabulary; read-only/test-creds safety | `hf-ship` + `/hf-submit` |
| 16 | **ADAPT** | `skills/canary-watch/SKILL.md` | Quick-check one pass over the deployed URL | pre-demo / pre-submit check |
| 17 | **ADAPT** | `skills/mcp-dependency-review/SKILL.md` | Static SAFE/HIGH/MEDIUM/REVIEW classification; never execute; never invent pins | `/hf-doctor` |
| 18 | **ADAPT** | `skills/video-editing/SKILL.md` (FFmpeg layer) | cut / concat / loudnorm / silence-detect / reframe snippets | `hf-demo` post-processing |
| 19 | **ADAPT** | `rules/web/design-quality.md`, `skills/frontend-design-direction`, `skills/make-interfaces-feel-better` | Anti-template policy; content-states table (loading/empty/error) | `rules/hackathon-ui.md` + polish pass |
| 20 | **ADAPT** | `the-longform-guide.md` (GROUNDWORK, sub-agent sections) | Two-instance kickoff (scaffold ‖ research); one-input/one-output phase files; iterative retrieval; CLI+skill over MCP; `llms.txt` | Workflow script for kickoff; orchestration conventions |
| 21 | **ADAPT** | `the-security-guide.md` (Minimum Bar Checklist) | A 10-line hackathon safety rule (secrets, untrusted starters, `.mcp.json` trust) | `rules/hackathon-safety.md` |
| 22 | **ADAPT** (nice) | `skills/benchmark-optimization-loop/SKILL.md` | Baseline → one-hypothesis variants → correctness gate → promote; for on-stage latency | optional `hf-speedup` |
| 23 | **ADAPT** (light) | `skills/market-research/SKILL.md` | "Decisions not research theater", contrarian evidence, product-reality checks | `hf-research` prior-art section |
| 24 | **ADAPT** (light) | `skills/deployment-patterns/SKILL.md` (rollback + env validation + health check only) | `vercel rollback`, `railway up --commit <sha>`, Zod env schema, `/health` | `hf-ship` |
| 25 | **SKIP** | `skills/product-capability/SKILL.md` | SRS capability contracts; too heavy | — |
| 26 | **SKIP** | `commands/prp-prd.md`, `skills/orch-pipeline/SKILL.md` | 8-phase / TDD-gated pipelines; too slow | — |
| 27 | **SKIP** | `skills/exa-search/SKILL.md` | Vendor wrapper; fold into a provider ladder | — |
| 28 | **SKIP** | `skills/data-scraper-agent/SKILL.md` | Product template (cron + Gemini + Notion); stale Gemini 2.0 names | maybe a starter template later |
| 29 | **SKIP** | `skills/github-ops/SKILL.md` | Maintainer ops; hackathon needs only `gh repo create` / README / tag | — |
| 30 | **SKIP** | `skills/deployment-patterns/SKILL.md` (rest) | Blue-green, canary, k8s, multi-stage Docker | — |
| 31 | **SKIP** | `contexts/*.md` + the `--system-prompt` alias pattern | Generic; the flag replaces Claude Code's default prompt | use phase skills / `--append-system-prompt-file` |
| 32 | **SKIP / OVERRIDE** | `rules/common/testing.md`, `development-workflow.md`, `agents.md` | TDD mandatory, 80% coverage, reviewer after every change | `rules/hackathon-mode.md` |
| 33 | **SKIP** | `skills/manim-video`, `remotion-video-creation`, `fal-ai-media`, `taste*`, `videodb`, `content-engine`, `crosspost`, `social-publisher`, `seo`, `brand-*`, `competitive-*`, `lead-intelligence`, `investor-outreach` | Off-target or too slow; optional extras at most | — |
| 34 | **SKIP** (copy-as-is) | `mcp-configs/mcp-servers.json` | Useful as a *catalog to read*, but 17/18 npx/uvx entries are mutable; re-pin before offering any entry | `mcp/optional/*.json` (pinned) |
| 35 | **MISSING** | — | M1 Hackathon brief intake → `HACKATHON.md` | `/hf-kickoff` |
| 36 | **MISSING** | — | M2 Divergent ideation (theme × sponsor APIs × pain × team) | `hf-ideate` (generate step) |
| 37 | **MISSING** | — | M3 Judging-criteria-weighted idea scoring + demo-ability + feasibility gate | `hf-ideate` rubric (§6.1) |
| 38 | **MISSING** | — | M4 Sponsor-prize map + prize-stacking EV | `hf-ideate` / `HACKATHON.md` prizes table |
| 39 | **MISSING** | — | M5 Prior-art check vs Devpost galleries and past winners | `hf-research` |
| 40 | **MISSING** | — | M6 Deadline clock: phase budgets, feature freeze T-4 h, deploy freeze T-2 h, submit T-30 min; statusline countdown hook | `hf-clock` hook + statusline |
| 41 | **MISSING** | — | M7 Demo-first PRD + fake-vs-real ledger | `hf-spec` |
| 42 | **MISSING** | — | M8 Demo script + seed/reset + live-demo fallback | `hf-demo` |
| 43 | **MISSING** | — | M9 Hackathon pitch flow, timing, speaker notes, Q&A prep | `hf-pitch` |
| 44 | **MISSING** | — | M10 Submission checklist + Devpost copy generator | `/hf-submit` |
| 45 | **MISSING** | — | M11 Judge-facing README generator | `hf-ship` / `/hf-submit` |
| 46 | **MISSING** | — | M12 Simulated judging against the event rubric | `hf-judge` |
| 47 | **MISSING** | — | M13 Hackathon-mode rules | `rules/hackathon-mode.md` |
| 48 | **MISSING** | — | M14 Human team roles + artifact ownership | `/hf-kickoff` team section |

---

## 8. Stale and drift flags (verify before relying on them)

| Item | Status |
|---|---|
| "Keep <10 MCPs / <80 tools; 200k can become 70k" (README, shortform guide, `mcp-servers.json` `_comments`) | **Stale for context size** under default tool search; still relevant behind proxies or with tool search off. |
| `ENABLE_TOOL_SEARCH=auto:5` advice (`docs/TROUBLESHOOTING.md:64`) | Valid values today: unset / `true` / `auto` / `auto:N` / `false`. `auto:5` now means *load upfront* until 5% and then defer, which is less aggressive than the default (always defer). |
| `--system-prompt "$(cat contexts/*.md)"` aliases (`the-longform-guide.md`) | **Harmful.** Replaces Claude Code's entire default system prompt; use `--append-system-prompt-file`. |
| `rules/common/performance.md` model table (Haiku / Sonnet / Opus) | Generic; pick HackForge model routing separately (other researcher). |
| `data-scraper-agent` Gemini model chain (2.0-flash-lite, 2.0-flash, 2.5-flash) | Likely stale by 2026-10. |
| `gan-style-harness` cost numbers | Match Anthropic's 2026-03-24 article (solo $9 / 20 min; harness $200 / 6 h; simplified about $124.70 / 3 h 50 min); model-generation specific. |
| Playwright MCP vs CLI token gap ("~114k vs ~27k tokens per task") | Widely cited but primary source unconfirmed; Checkly argues the gap narrowed with tool search. Use the CLI for recording anyway (scripts are files, reproducible). |
| `parallel-search` "works key-free for anonymous use" | ECC's claim; not verified here. |
| Devpost section names, video length | From general knowledge plus third-party guides; **each event sets its own rules**; `/hf-kickoff` must capture them from the actual rules page. |

---

## 9. Sources

**ECC (local clone, read-only).** Paths are relative to `…/scratchpad/ecc-src/ecc`.

- Research and product skills:
  - `skills/deep-research/SKILL.md`, `skills/search-first/SKILL.md`, `skills/research-ops/SKILL.md`, `skills/market-research/SKILL.md`
  - `skills/product-lens/SKILL.md`, `skills/product-capability/SKILL.md`, `skills/exa-search/SKILL.md`, `skills/data-scraper-agent/SKILL.md`
- Demo, pitch and marketing skills:
  - `skills/ui-demo/SKILL.md`, `skills/marketing-campaign/SKILL.md`, `skills/frontend-slides/{SKILL.md,STYLE_PRESETS.md,scripts/export-pdf.sh}`
  - `skills/investor-materials/SKILL.md`, `skills/council/SKILL.md`
  - `skills/video-editing/SKILL.md`, `skills/manim-video/SKILL.md`, `skills/frontend-design-direction/SKILL.md`
- Build, ship and MCP skills:
  - `skills/github-ops/SKILL.md`, `skills/deployment-patterns/SKILL.md`, `skills/mcp-server-patterns/SKILL.md`, `skills/mcp-dependency-review/SKILL.md`, `skills/benchmark-optimization-loop/SKILL.md`
  - `skills/gan-style-harness/SKILL.md`, `skills/orch-build-mvp/SKILL.md`, `skills/browser-qa/SKILL.md`, `skills/canary-watch/SKILL.md`
  - `skills/competitive-platform-analysis/SKILL.md`, `skills/documentation-lookup/SKILL.md`, `skills/context-budget/SKILL.md`
- Agents and commands: `agents/gan-evaluator.md`, `commands/plan-prd.md`, `commands/prp-prd.md`
- MCP configuration and policy:
  - `mcp-configs/mcp-servers.json`, `.mcp.json`, `.claude-plugin/plugin.json`, `.claude-plugin/PLUGIN_SCHEMA_NOTES.md`
  - `docs/MCP-CONNECTOR-POLICY.md`, `docs/capability-surface-selection.md`, `docs/token-optimization.md`, `docs/TROUBLESHOOTING.md`
- Guides and rules:
  - `README.md` (MCP / context sections), `the-shortform-guide.md`, `the-longform-guide.md`, `the-security-guide.md`
  - `contexts/{dev,research,review}.md`, `rules/README.md`, `rules/common/{development-workflow,testing,performance,agents}.md`, `rules/web/design-quality.md`

**External**

- Claude Code MCP docs (tool search, `ENABLE_TOOL_SEARCH`, `alwaysLoad`, output limits, scopes, `.mcp.json` approval): https://code.claude.com/docs/en/mcp
- Claude Code CLI reference (system prompt flags): https://code.claude.com/docs/en/cli-reference
- Anthropic, "Harness design for long-running application development" (2026-03-24, Prithvi Rajasekaran): https://www.anthropic.com/engineering/harness-design-long-running-apps
- Hackathon judging criteria (2026 breakdown): https://blogs.reskilll.com/what-hackathon-judges-look-for-complete-judging-criteria-breakdown-2026/
- Okta hackathon judging criteria thread: https://devforum.okta.com/t/what-are-the-judging-criteria-for-the-hackathon/15842
- Playwright CLI vs MCP:
  - https://www.checklyhq.com/blog/mcp-vs-cli-token-efficiency/
  - https://morphllm.com/playwright-mcp
  - https://betterstack.com/community/guides/ai/playwright-cli-vs-mcp-browser/
