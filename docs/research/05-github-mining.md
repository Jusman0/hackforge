# 05 — GitHub Mining: repos HackForge should learn from or integrate

**Researcher:** GitHub-mining agent · **Date:** 2026-10-15 (data pulled 2026-10-15/16) · **Scope:** Claude Code harnesses and agent kits, MCP lists and aggregators, hackathon-specific tooling, pitch and demo tooling, deep-research agents, idea validation, AI judging.

## Method and caveats

- **Discovery:** about 45 GitHub Search API calls (`/search/repositories`, sorted by stars, plus batched `repo:a/b+repo:c/d` lookups to get metadata without spending the shared core quota), 1 core call, about 8 Bright Data SERP calls (`bdata search "site:github.com ..."`), 1 WebSearch, and about 90 README or skill files fetched from `raw.githubusercontent.com`. I read the files; I did not execute anything.
- **Star counts and last-push dates** are the values the GitHub API returned on 2026-10-15/16. Stars are a weak quality signal. Several 2026 repos have six-figure counts in a few months, and some are probably inflated. "Last push" is `pushed_at`.
- **Everything below is data from READMEs, which are marketing.** Benchmark claims (for example "#1 on DRACO") are the authors' claims and I have not verified them. The same applies to "plugins support workflows". I flag the claims that matter.
- **Ecosystem scale (for context):** `punkpeye/awesome-mcp-servers` has about **4,259** list entries (I counted the `- [` lines). `tolkonepiu/best-of-mcp-servers` ranks 400 servers in 34 categories. A third-party roundup citing `quemsah/awesome-claude-plugins` says about **24,400 repos** contained Claude Code skill or plugin definitions by June 2026, up from about 2,000 six months earlier ([fast.io roundup](https://fast.io/resources/awesome-claude-skills-directory-2026/)). Conclusion: **curation beats collection**. HackForge should not try to out-count ECC.
- **ECC baseline:** the local clone has **71 agents, 97 commands, 311 skills** (`ecc-src/ecc/agents|commands|skills`). ECC already ships `deep-research`, `market-research`, `frontend-slides`, `ui-demo`, `remotion-video-creation` and `manim-video` skills (`ecc-src/ecc/skills/`). Its README says parts of it were "Built at the Claude Code Hackathon (Cerebral Valley x Anthropic, Feb 2026)" (`ecc-src/ecc/README.md:2039`). ECC has these parts, but it **has no phase-ordered hackathon spine**: nothing does rubric intake, saturation analysis, a judge panel, or demo-first gating. That gap is HackForge's opening.

---

## TL;DR

1. **The highest-signal repos for HackForge are tiny, obscure ones:** `RikepilB/crafterwiki` (4 stars), `painbaba/hackathon-radar` (0 stars), `Jazztinn/dontreadme` (11), `Esther2524/beautiful-hackathon-slides` (36) and `SultanAlfaifi/rajih-engine` (2). Each encodes one hackathon-winning practice that no big harness has: demo-first phase order, saturation analysis, rubric-mapped README, a deck with a demo slot, and isolated ideators with a jury. Borrow their patterns. Their corpora are small, so do not depend on them.
2. **Big harnesses to borrow from (not install):** `obra/superpowers` (300k stars), `garrytan/gstack` (137k; its `/office-hours` already has a hackathon "Builder Mode"), `github/spec-kit` (141k; its `assess` extension is a go / needs-clarification / kill gate), `open-gsd/gsd-core`, `snarktank/ralph` and `OthmanAdi/planning-with-files`.
3. **Install as-is (small, well maintained, demo-critical):** Playwright MCP or Chrome DevTools MCP (demo QA and screenshots), Context7 (current docs while building fast), `mvanhorn/last30days-skill` (what's hot right now on Reddit, HN, X and Polymarket), `zarazhangrui/frontend-slides` or HyperFrames/Remotion skills (deck and video), deploy MCPs as opt-in per stack (Vercel, Netlify, Render, Railway, Cloudflare, Supabase, Neon), and Bright Data (already installed) for Devpost and SERP research.
4. **Avoid:** mega-frameworks (`ruvnet/ruflo`, SuperClaude, oh-my-claudecode, BMAD, `wshobson/agents` with its 202 agents). They add ceremony and context bloat and they conflict with each other's auto-triggering skills. Avoid running MCP gateways or aggregators for a 24–48h event.

---

## A. Claude Code harnesses and agent kits (ECC alternatives)

| Repo | Stars | Last push | What it is | Single best idea to borrow | Verdict |
|---|---:|---|---|---|---|
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | 280,484 | 2026-10-15 | The baseline: 71 agents, 97 commands, 311 skills, hooks, multi-harness | Selective install manifests (`docs/SELECTIVE-INSTALL-ARCHITECTURE.md`). Even ECC knows the full install is too much | **Borrow** (baseline to beat) |
| [obra/superpowers](https://github.com/obra/superpowers) | 299,984 | 2026-10-10 | Auto-triggering methodology: brainstorming → worktrees → writing-plans (2–5 min tasks) → subagent-driven-development with 2-stage review → TDD → finish branch | **Subagent-driven development with a two-stage review** (spec compliance, then code quality), plus `verification-before-completion` | **Borrow**. Do not co-install: its skills auto-trigger and would fight HackForge's |
| [garrytan/gstack](https://github.com/garrytan/gstack) | 136,577 | 2026-10-16 | 23+ role skills (CEO, eng manager, designer, QA, release, CSO): `/office-hours`, `/autoplan`, `/qa`, `/ship`, `/land-and-deploy`, `/canary` | `/office-hours` **six forcing questions** (demand reality, status quo, desperate specificity, narrowest wedge, observation, future-fit), plus an explicit **Builder Mode "for ... a hackathon"** (`office-hours/SKILL.md`, `sections/phase-2a-startup-diagnostic.md`) | **Borrow**. Setup needs Bun, writes to `~/.claude/skills`, has telemetry and is heavy |
| [github/spec-kit](https://github.com/github/spec-kit) | 141,455 | 2026-10-15 | SDD toolkit: constitution → specify → plan → tasks → implement → converge; extensions `bug` and `assess` | **Idea assessment extension:** `intake → research → define → shape → decide` → **go / needs-clarification / kill**, artifacts in `.specify/assessments/<slug>/` | **Borrow** the assess gate. Optional install: `uv tool install specify-cli` |
| [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) | 72,059 | 2026-10-15 | Lightweight spec-driven development (SHALL requirements and deltas) | Spec format that downstream agents consume (haytham emits OpenSpec) | **Ignore** for a 48h event (too much spec). **Borrow** the SHALL plus Gherkin acceptance-criteria format only |
| [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) (successor of [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done), 64,286, archived) | 10,566 | 2026-10-16 | Discuss → Plan → Execute → Verify → Ship loop; executors run in **parallel waves, each with a fresh 200k context** | **Fresh-context executors per plan** to fight context rot; a plan must "fit a fresh context window" | **Borrow** |
| [ruvnet/ruflo](https://github.com/ruvnet/ruflo) (formerly claude-flow) | 75,181 | 2026-10-15 | Swarm or "hive-mind" orchestration platform | Nothing hackathon-specific | **Avoid** (complexity, opaque) |
| [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) | 54,197 | 2026-10-16 | Agile AI-driven development with role agents; v7 alpha (ETA 2026-10-16) | **"Right-sized process":** choose a planning depth per change (`docs.bmad-method.org/plan/choose-a-planning-path`) | **Borrow** the sizing idea. **Avoid** install (ceremony; v7 in flux) |
| [wshobson/agents](https://github.com/wshobson/agents) | 40,871 | 2026-10-15 | 94 plugins, 202 agents, 185 skills, 105 commands across 7 harnesses | **One Markdown source → generated adapters per harness**, plus `make validate STRICT=1` and the `plugin-eval` static checks | **Borrow** the build and validate pipeline. Ignore the content |
| [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) | 39,943 | 2026-10-16 | Multi-agent "autopilot" for Claude Code | **Named stage profiles** (`[ralplan, execution, ralph, qa]`) configured in `.claude/omc.jsonc` | **Borrow** the stage-profile idea. **Avoid** install (heavy; profiles need Linux `flock`) |
| [SuperClaude-Org/SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) | 23,909 | 2026-09-27 | 30 `/sc:*` commands, 20 agents, 7 modes, 8 MCPs | `/sc:research` bundled with Tavily and Context7 MCPs as **"optional performance MCPs"** | **Avoid** (behavioral injection overlaps everything) |
| [automazeio/ccpm](https://github.com/automazeio/ccpm) | 8,412 | 2026-03-18 | PRD → epic → GitHub Issues → parallel agents in worktrees | **GitHub Issues as the shared team ledger** for parallel agents and humans | **Borrow** (optional for teams of 3 or more) |
| [snarktank/ralph](https://github.com/snarktank/ralph) | 21,976 | 2026-02-02 | Loop: fresh agent per iteration until every `prd.json` story has `passes: true`; learnings go to `progress.txt` | **Machine-checkable story list as the loop's stop condition** | **Borrow** |
| [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code) | 9,699 | 2026-10-10 | Ralph for Claude Code with exit detection | **Dual-condition exit gate** (completion indicators AND an explicit `EXIT_SIGNAL`) plus a **circuit breaker** and a 100 calls/hour rate cap | **Borrow** |
| [OthmanAdi/planning-with-files](https://github.com/OthmanAdi/planning-with-files) | 27,470 | 2026-10-14 | Manus-style `task_plan.md` / `findings.md` / `progress.md`, re-injected every turn by a hook | **Plan on disk survives `/clear`.** The repo's own measurement: re-orientation drops from 13.3 to 5.0 turns | **Borrow** (core of HackForge state) |
| [coleam00/context-engineering-intro](https://github.com/coleam00/context-engineering-intro) | 13,883 | 2026-03-16 | `INITIAL.md` → `/generate-prp` → `/execute-prp` (Product Requirements Prompt with validation gates) | **The PRP: a spec that bundles docs, examples and validation commands** | **Borrow** |
| [23jmo/jmo-skills](https://github.com/23jmo/jmo-skills) | 69 | 2026-10-10 | "The skills from my hackathon workflow": `/interview` → spec in `.plans/`, UI polish, animate, Codex handoff | **Per-service opt-in MCP plugins** (`jmo-supabase`, `jmo-neon`, `jmo-stripe`) with "use dev projects and Stripe sandboxes for hackathon work" | **Borrow**. Its bundled `agentation` is PolyForm Shield licensed, so do not vendor it |
| [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) | 32,672 | 2026-10-16 | `npx claude-code-templates` catalog (aitmpl.com), analytics and chat monitor | **One-line component installs** (`--agent ... --mcp ... --yes`) | **Ignore** (reference catalog) |
| [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | 101,077 | 2026-10-16 | Persistent cross-session memory | Session capture → compressed context | **Ignore** (a 48h event doesn't need long-term memory; file-based state is enough) |
| [eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master) | 28,230 | 2026-04-28 | PRD → task graph with dependencies | Dependency-aware task graph | **Ignore** (overlaps ralph and ccpm; needs API keys) |
| [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) | 67,615 | 2026-10-15 | Best-practice reference | Reference for hooks, skills and subagent conventions | **Ignore** (read once) |
| [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | 107,079 | 2026-10-13 | Production engineering skills | Well-scoped, single-purpose skill design | **Ignore** (production, not hackathon) |
| [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) | 160,379 | 2026-10-15 | Large persona-agent "agency" | Nothing | **Ignore** |
| [smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad) | 8,609 | 2026-08-20 | tmux manager for parallel terminal agents | Parallel human+agent lanes in worktrees | **Nice** (AGPL tool; use, don't vendor) |
| [humanlayer/humanlayer](https://github.com/humanlayer/humanlayer) | 11,699 | 2026-10-15 | Now deprecated ("the code here is pretty much all deprecated") | — | **Ignore** (stale) |
| [hesreallyhim/ultracode-workflows](https://github.com/hesreallyhim/ultracode-workflows) | 8 | 2026-09-15 | Plugin marketplace of **native Workflow-tool scripts** (`agent`, `pipeline`, `parallel`, `phase`, `budget`, `workflow()`) | Claims "Claude Code plugins now support workflows as first-class components" (a `plugins/<name>/workflows/` directory). **Verify before relying on it** | **Borrow** (packaging and patterns) |
| [ray-amjad/claude-code-workflow-creator](https://github.com/ray-amjad/claude-code-workflow-creator) | 93 | 2026-05-29 | Skill for authoring Workflow scripts. Templates: fan-out, pipeline, loop-until-budget, judge panel | **`references/patterns.md` judge-panel and loop-until-budget templates** (as of May 2026 it said the tool was "unreleased") | **Borrow** |
| [carmatthews/claude-code-hackathon](https://github.com/carmatthews/claude-code-hackathon) | 7 | 2026-04-23 | Enterprise Claude Code hackathon brief | **"Claude will judge"**, "Commit history is evidence", plus the mandatory "Use Claude Code to generate an HTML presentation" rule | **Borrow** (optimize for LLM judges too) |
| [ithiria894/awesome-claude-code-workflows](https://github.com/ithiria894/awesome-claude-code-workflows) | 129 | 2026-03-28 | Recipes combining hooks, MCP, skills and CLAUDE.md | Recipe format | **Ignore** |

## B. Skill and plugin distribution, specs and lists

| Repo | Stars | Last push | What | Best idea | Verdict |
|---|---:|---|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) | 181,419 | 2026-10-09 | Official example skills (`document-skills`, `example-skills`) and the spec template | `skill-creator` (skill authoring with evals) and `webapp-testing` | **Integrate** (selectively): `/plugin marketplace add anthropics/skills` |
| [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | 39,208 | 2026-10-16 | Official plugin directory; `strict:false` skill-bundle entries; immutable plugin slugs plus a `renames` map | **Distribution target.** Pick an immutable slug (`hackforge`) on day 1 | **Integrate** (as a publishing target) |
| [agentskills/agentskills](https://github.com/agentskills/agentskills) | 26,187 | 2026-08-09 | Open Agent Skills spec (progressive disclosure: discovery → activation → execution) | Keep the `SKILL.md` description tight, because it is all that loads at startup | **Borrow** (comply) |
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | 35,128 | 2026-10-09 | `npx skills add owner/repo` for 75+ agents; `npx skills use ... \| claude` | **Zero-install trial:** `npx skills use <repo>@<skill> \| claude` | **Integrate** (second distribution channel) |
| [quemsah/awesome-claude-plugins](https://github.com/quemsah/awesome-claude-plugins) | 1,439 | 2026-10-16 | Automated crawler index of plugins with adoption metrics | Use the adoption data to choose dependencies | **Borrow** (as a data source) |
| [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 55,779 | 2026-10-16 | Main curated list; sections include "Ralph Wiggum", "Dynamic Workflows", "SDLC" | Reference | **Ignore** (reference) |
| [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) | 77,199 | 2026-09-18 | Skills list | Reference | **Ignore** |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 35,795 | 2026-10-15 | 1000+ skills list | Reference | **Ignore** |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 25,749 | 2026-10-11 | 100+ subagents | Reference for agent frontmatter conventions | **Ignore** |
| [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) | 9,528 | 2026-10-15 | Claude in GitHub Actions | PR review in CI | **Ignore** for the event (nice afterwards) |
| [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks) | 53,477 | 2026-10-15 | API recipes | Agent SDK patterns (some hackathons require the Agent SDK) | **Ignore** (reference) |

## C. MCP lists, aggregators and the MCP servers a hackathon actually needs

| Repo | Stars | Last push | What | Best idea | Verdict |
|---|---:|---|---|---|---|
| [punkpeye/awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) | 96,414 | 2026-10-15 | About 4,259 entries in about 60 categories, including "Aggregators" | Category map, useful for the sponsor-tech lookup during recon | **Borrow** (lookup source) |
| [modelcontextprotocol/registry](https://github.com/modelcontextprotocol/registry) | 7,366 | 2026-10-14 | Official MCP registry service | **Query the registry programmatically** to find a sponsor's official MCP | **Borrow** |
| [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | 91,295 | 2026-10-13 | Reference servers | Reference implementations (fetch, filesystem, memory) | **Ignore** |
| [tolkonepiu/best-of-mcp-servers](https://github.com/tolkonepiu/best-of-mcp-servers) | 155 | 2026-10-15 | 400 servers **ranked by a project-quality score**, updated weekly | Quality ranking, which beats raw star counts | **Borrow** (selection data; CC-BY-SA) |
| [punkpeye/awesome-remote-mcp-servers](https://github.com/punkpeye/awesome-remote-mcp-servers) | 1,300 | 2026-10-15 | Remote (HTTP) MCPs only | Remote MCPs need **zero local install**, which suits fresh hackathon laptops | **Borrow** |
| [e2b-dev/awesome-mcp-gateways](https://github.com/e2b-dev/awesome-mcp-gateways) | 187 | 2026-10-13 | List of gateways | — | **Ignore** |
| [metatool-ai/metamcp](https://github.com/metatool-ai/metamcp) | 2,707 | 2026-06-22 | Aggregator and gateway in one Docker container | — | **Avoid** (ops overhead for a 48h event) |
| [docker/mcp-gateway](https://github.com/docker/mcp-gateway) | 1,601 | 2026-09-23 | `docker mcp` CLI plugin and gateway | Containerized MCPs | **Avoid** (unless the team is Docker-native) |
| [lastmile-ai/mcp-agent](https://github.com/lastmile-ai/mcp-agent) | 8,572 | 2026-01-25 | Framework for agents built on MCP | — | **Ignore** |
| [upstash/context7](https://github.com/upstash/context7) | 63,110 | 2026-10-15 | Current library docs for agents | Fewer hallucinated APIs when using new SDKs at speed | **Integrate (must)** |
| [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | 38,211 | 2026-10-08 | Browser automation MCP | Demo-path smoke tests and screenshots for the deck and README | **Integrate (must; pick this or the next)** |
| [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | 53,615 | 2026-10-15 | DevTools for agents (console, network, performance) | Debug the live demo URL | **Integrate (should)** |
| [github/github-mcp-server](https://github.com/github/github-mcp-server) | 33,651 | 2026-10-15 | Official GitHub MCP | Repo creation, issues, releases for submission | **Should** (or the `gh` CLI) |
| [cloudflare/mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare) · [netlify/netlify-mcp](https://github.com/netlify/netlify-mcp) · [render-oss/render-mcp-server](https://github.com/render-oss/render-mcp-server) · [railwayapp/railway-mcp-server](https://github.com/railwayapp/railway-mcp-server) · [neondatabase/mcp-server-neon](https://github.com/neondatabase/mcp-server-neon) | 4,385 · 69 · 180 · 190 · 652 | Oct 2026 (Railway May 2026) | Official deploy and database MCPs | **One "deploy target" chosen at intake**, enabling only that provider's MCP (the jmo-skills opt-in pattern) | **Integrate (should, opt-in per stack)** |
| [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) · [exa-labs/exa-mcp-server](https://github.com/exa-labs/exa-mcp-server) · [tavily-ai/tavily-mcp](https://github.com/tavily-ai/tavily-mcp) | 191,941 · 5,135 · 2,434 | Oct 2026 | Search and crawl APIs used by most deep-research repos | Interchangeable "search provider" slot | **Ignore** (Bright Data is already installed; Firecrawl is AGPL if self-hosted) |

## D. Hackathon-specific tooling (the most important section)

| Repo | Stars | Last push | What | Single best idea | Verdict |
|---|---:|---|---|---|---|
| [RikepilB/crafterwiki](https://github.com/RikepilB/crafterwiki) | 4 | 2026-10-14 | Provenance-first wiki of hackathon winners **and rosters** (14 events, 36 analyzed projects, 88 roster entries), with a CLI, a zero-dependency stdio MCP server, a static API and a Claude Code plugin `/hack-plan` (4 skills, 4 agents) | **Demo-first phase order as an ADR** (`commands/hack-plan.md`, ADR-004): Intake → Recon → Patterns → Angles → **Gate 1 judge panel** → Demo script and pitch → **Gate 2 user approval** → *then* architecture → hourly build plan with code freeze and 2 rehearsals. "Do not choose a tech stack or architecture before Gate 2." Also a **controlled taxonomy**: 23 "mechanisms" (`demo-first-wow`, `live-real-world-proof`, `one-sentence-clarity`, `tight-scope-finished`, `sponsor-platform-mastery`, `cost-collapse`, `takes-action`...) and 15 "judging lenses" (`schema/taxonomy.json`) | **Borrow (must)**. Optionally integrate its MCP as a seed corpus (MIT). Note its own holdout test "did not support the recommended idea shape" (`docs/builder-harness.md`), so winner patterns are hypotheses, not predictors |
| [painbaba/hackathon-radar](https://github.com/painbaba/hackathon-radar) | 0 | 2026-08-29 | Playwright Devpost scanners (`scan_devpost.py`, `deep_probe.py`, `verify_gap.py`) plus winner-pattern playbooks | **Saturation analysis from Devpost search counts** (`playbooks/angle-differentiation.md`): e.g. "agent" 35,559 projects, "education" 26,603, "GST" 226, "kirana" 60. Then deep-read the 3 nearest competitors to confirm the gap. Thesis: "Most hackathon losses aren't build-quality losses. They're selection losses." `angle-demo.md` has a shot-by-shot 4-minute video beat sheet (hook, problem, architecture card ≤15s, live run, "escalation moment", proof of deployment, closing line; captions on because "judges watch muted") | **Borrow (must)** |
| [Jazztinn/dontreadme](https://github.com/Jazztinn/dontreadme) | 11 | 2026-06-28 | Skill: judge-ready README, grounded in the repo and mapped to the event rubric | **Rubric first** (Step 1 collects the criteria checklist). Every command and path comes from real manifests. A **"Judging Highlights"** section maps each criterion. **"Never fabricate a demo URL, a metric, or a teammate"**: unknowns become `<!-- TODO -->`. Ships `evals/evals.json` with 3 eval prompts and fixture repos | **Borrow (must)**. API reports no license; README says MIT, so confirm before vendoring |
| [Esther2524/beautiful-hackathon-slides](https://github.com/Esther2524/beautiful-hackathon-slides) | 36 | 2026-05-15 | Skill: 9-phase deck workflow (Discover → Clarify → Preview → Build → Document → Iterate → Narrate → Integrate video → Submit) | **Show-don't-tell style previews** (5 of 13 presets). An **explicit demo-video slot**. **6 animated demo-slide archetypes** (Split Narrative, Pipeline Walk, Before/After Morph, Dashboard Fill-In, Network Graph, Map Heatbloom) for when the backend could crash on stage. **Narration script timed to the video limit**. A `PLAN.md` for context | **Borrow (should)** (MIT) |
| [SultanAlfaifi/rajih-engine](https://github.com/SultanAlfaifi/rajih-engine) | 2 | 2026-09-14 | "Evidence-grounded multi-agent ideation for hackathon teams": Scout, Independent Ideators (Grounded, Transformational, Demo-first), Critic, Refiner, Product Jury | **First-round ideators isolated from each other**, the orchestrator is the only writer of shared state, **candidate-specific verification before jury scoring**, and idea lineage via `parent_id`. State files: `state.json`, `brief.md`, `ideas.md`, `decisions.md`, `progress.md` | **Borrow (must)**. It maps directly onto Workflow `parallel()` + `agent({schema})` |
| [get-convex/convex-hackathon-skill](https://github.com/get-convex/convex-hackathon-skill) | n/a (not in search index) | — | Keeps a public `hackathon.md` build log from repo evidence and backfills git history | **Auto-maintained build log** as a submission artifact. It "does not commit, deploy, submit, score" | **Borrow (should)** |
| [solanabr/solana-ai-kit](https://github.com/solanabr/solana-ai-kit) (`.claude/skills/hackathon/SKILL.md`) | n/a | — | Sponsor-ecosystem hackathon skill (seen in a SERP snippet) | "Pick the least-crowded track; scannable description; demo script (<3 minutes); submission checklist" | **Borrow** (confirms the pattern) |
| [analisto/devpost_com](https://github.com/analisto/devpost_com) | 0 | 2025-12-17 | Analysis of **12,155 Devpost hackathons** via Devpost's public API | Base rates: median prize **$4,300**, 72.6% have prizes, 38.4% online, 64% under 250 participants, top themes Beginner Friendly / Social Good / ML-AI | **Borrow** (data plus the API endpoint approach; stale-ish, Dec 2025) |
| [ViRb3/devpost-api](https://github.com/ViRb3/devpost-api) · [thegu5/devpost-api](https://github.com/thegu5/devpost-api) · [jayrav13/devpost-scraper](https://github.com/jayrav13/devpost-scraper) | 9 · 5 · 13 | 2023 · 2026-01 · 2017 | Unofficial Devpost APIs and scrapers | Shows which Devpost pages are scrapeable (gallery, project pages) | **Ignore** (stale). Use `bdata scrape` on gallery and search pages instead |
| [samber/dev-event-organizer-skills](https://github.com/samber/dev-event-organizer-skills) | 4 | 2026-10-14 | Organizer-side skills: `hackathon-judging` (judge allocation, weighted criteria, score combination, recusal, tie-breaks), `hackathon-brief-design` | **Model the organizer.** Simulated judges should score the way real rubrics combine scores | **Borrow** |
| [Olanetsoft/awesome-hackathon-projects](https://github.com/Olanetsoft/awesome-hackathon-projects) | 1,879 | 2025-05-20 | Curated hackathon projects | Seed list for a winners corpus | **Borrow** (as data; stale) |
| [dribdat/awesome-hackathon](https://github.com/dribdat/awesome-hackathon) | 311 | 2026-10-08 | Organizer platforms, tools, guides | Context on judging and organizer tools | **Ignore** (reference) |
| [Hackalist/Hackalist.github.io](https://github.com/Hackalist/Hackalist.github.io) · [MLH/mlh-hackathon-organizer-guide](https://github.com/MLH/mlh-hackathon-organizer-guide) | 491 · 352 | 2026-04 · 2026-09 | Upcoming hackathons list; MLH organizer guide (judging section) | MLH judging norms (most student events) | **Ignore** (reference) |
| [freddy-schuetz/hackathon-n8n-starter](https://github.com/freddy-schuetz/hackathon-n8n-starter) | 14 | 2026-08-07 | Claude Code + n8n hackathon starter | **"One-sentence setup":** the README contains an **agent runbook** ("set up this repo for me") so Claude clones and configures it and asks only for keys. `.mcp.json.example` is gitignored. "Help me clarify my idea" prompt | **Borrow** |
| [Elnora-AI/elnora-ai-agent-hackathon-starter-kit](https://github.com/Elnora-AI/elnora-ai-agent-hackathon-starter-kit) | 22 | 2026-10-14 | One command from a fresh laptop to Claude Code or Codex plus tools | Laptop-zero bootstrap | **Ignore** (HackForge assumes Claude Code exists) |
| [google-gemini/nano-banana-hackathon-kit](https://github.com/google-gemini/nano-banana-hackathon-kit) · [ScrapeAlchemist/brightdata-hack-pack](https://github.com/ScrapeAlchemist/brightdata-hack-pack) | 1,031 · 15 | 2025-09 · 2026-02 | Official sponsor starter kits | **Sponsor kits are a recon input:** find and ingest the sponsor's own kit during recon, because sponsor prizes reward "platform mastery" | **Borrow** (as a recon step) |
| [sahat/hackathon-starter](https://github.com/sahat/hackathon-starter) · [t3-oss/create-t3-app](https://github.com/t3-oss/create-t3-app) · [wasp-lang/open-saas](https://github.com/wasp-lang/open-saas) · [Code42Cate/hackathon-starter](https://github.com/Code42Cate/hackathon-starter) | 35,250 · 29,158 · 16,106 · 93 | 2026-10 · 2025-12 · 2026-10 · 2024-12 | Boilerplates | A **small menu of 2–3 vetted scaffolds** beats free-form stack choice | **Nice** (offer T3 or open-saas as optional scaffolds; ignore the rest) |
| [udaysharmadev/Hackathon-Starter-Pack-Complete-Guide-Roadmap](https://github.com/udaysharmadev/Hackathon-Starter-Pack-Complete-Guide-Roadmap) · [asadullah48/hackathon-skills-marketplace](https://github.com/asadullah48/hackathon-skills-marketplace) | 105 · 3 | 2026-09 · 2026-01 | Beginner guide; generic skills bundle | — | **Ignore** |
| [jeffrey-zang/hackathon-idea-generator](https://github.com/jeffrey-zang/hackathon-idea-generator) and about 25 other "hackathon idea generator" repos | ≤11 | mostly stale | Prompt-an-LLM idea generators | None. These are exactly the generic-idea trap | **Avoid** |

## E. Pitch, demo and video tooling

| Repo | Stars | Last push | What | Best idea | Verdict |
|---|---:|---|---|---|---|
| [zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides) | 30,729 | 2026-06-23 | Claude Code plugin: single-file HTML decks, visual style discovery, anti-AI-slop presets, PPT conversion | Zero-dependency 16:9 HTML deck that opens anywhere | **Integrate (should)**: `/plugin marketplace add https://github.com/zarazhangrui/frontend-slides` then `/plugin install frontend-slides@frontend-slides` |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | 64,642 | 2026-10-16 | "Write HTML. Render video. Built for agents." Deterministic MP4 from HTML/CSS | **Same HTML stack as the deck → a demo video** with no editor skills | **Integrate (should)**: `claude plugin marketplace add heygen-com/hyperframes` then `claude plugin install hyperframes@hyperframes` |
| [remotion-dev/skills](https://github.com/remotion-dev/skills) · [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | 5,209 · 64,416 | 2026-10 | Official Remotion agent skills (`/remotion-create`, `/remotion-render`, `/remotion-captions`) | React-based programmatic video with captions | **Nice** (alternative to HyperFrames; Remotion license needs care for companies) |
| [slidevjs/slidev](https://github.com/slidevjs/slidev) · [marp-team/marp](https://github.com/marp-team/marp) | 49,074 · 12,643 | 2026-10 · 2026-07 | Markdown slide engines | Markdown → deck, diffable | **Ignore** (frontend-slides HTML is more designable) |
| [presenton/presenton](https://github.com/presenton/presenton) | 11,136 | 2026-10-13 | Open-source Gamma alternative with an API | — | **Ignore** (a heavy service) |
| [charmbracelet/vhs](https://github.com/charmbracelet/vhs) | 21,126 | 2026-10-01 | Scripted terminal recordings (`.tape` → GIF/MP4) | **Reproducible CLI demo GIFs** for the README | **Nice** (`brew install vhs`) |
| [automazeio/proof](https://github.com/automazeio/proof) | 62 | 2026-08-03 | Captures terminal, browser (Playwright video) and simulator runs as HTML replays plus `proof.json` | **"A 10-second recording of your tests passing is worth more than a 200-line diff"**: evidence artifacts for judges | **Nice** (npm global install; prefer `npx`) |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 97,412 | 2026-10-14 | Art direction, real images and a **browser self-check** instead of generic AI pages | Design QA loop with screenshots | **Should** (UI polish is a judging lens): `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` |
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 136,275 | 2026-10-15 | Design-intelligence skill | — | **Ignore** (pick one design skill: taste-skill) |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 32,496 | 2026-10-14 | Vercel's official skills (e.g. `web-design-guidelines`) | Vercel deploy and design guidelines | **Nice** (if the deploy target is Vercel) |

## F. Deep-research agents (patterns for the research phase)

| Repo | Stars | Last push | What | Best idea | Verdict |
|---|---:|---|---|---|---|
| [jordan-gibbs/hyperresearch](https://github.com/jordan-gibbs/hyperresearch) | 3,865 | 2026-10-10 | Claude Code / Codex deep-research harness; 16-step pipeline; claims #1 on DRACO (unverified) | **Tiered routing**: `light` = steps 1→2→10→15→16 in about 30–40 min vs `full` at 1.5–2.5 h. **Cite-check gate** ("hallucinated quotes ... are hard blocks"). An **independence audit** so "five reprints of one press release argue with the weight of one source". Tool-locked patcher. Run manifest so runs can **resume** | **Borrow (must)**. Optional install for long pre-event research: `pip install hyperresearch && hyperresearch install` |
| [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill) | 64,441 | 2026-10-16 | Researches the last 30 days on Reddit, X, YouTube, HN, Polymarket, GitHub and the web; ranks by engagement | **Engagement-scored social signal** ("Reddit upvotes ... Polymarket odds") and a **discovery mode** ("what's exploding in X?"). Zero config for Reddit, HN, Polymarket and GitHub | **Integrate (should)**: `/plugin marketplace add mvanhorn/last30days-skill` then `/plugin install last30days` |
| [dzhng/deep-research](https://github.com/dzhng/deep-research) | 19,791 | 2026-04-11 | Under 500 LoC recursive researcher | **`breadth` and `depth` parameters**; each level returns `learnings` plus `directions` that seed the next level | **Borrow** (the simplest control surface) |
| [stanford-oval/storm](https://github.com/stanford-oval/storm) | 31,644 | 2025-09-30 | Wikipedia-style articles with citations; Co-STORM | **Perspective-guided question asking** plus **simulated writer↔expert conversation**. Co-STORM's moderator raises questions from retrieved-but-unused info | **Borrow** (the ideation "perspectives" step; stale since Sep 2025) |
| [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) | 12,680 | 2026-08-10 | LangGraph supervisor plus researchers; #6 on Deep Research Bench (0.4344, Aug 2025) | **Separate models per role** (summarize, research, compress, final report) and an explicit **compression step** before writing | **Borrow** (map roles to haiku/sonnet/opus subagents) |
| [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher) | 30,120 | 2026-10-10 | Planner → executors → publisher; installable as a Claude skill (`npx skills add assafelovic/gpt-researcher`) | **Planner generates questions that "collectively form an objective opinion"** | **Borrow** (needs OpenAI and Tavily keys to install) |
| [jina-ai/node-DeepResearch](https://github.com/jina-ai/node-DeepResearch) | 5,238 | 2026-05-01 | Search → read → reason loop "until ... the token budget is exceeded"; optimizes for answers, not long reports | **Loop-until-budget** maps onto the Workflow `budget.remaining()` | **Borrow** |
| [bytedance/deer-flow](https://github.com/bytedance/deer-flow) | 83,924 | 2026-10-16 | DeerFlow 2.0 "super agent harness" (sub-agents, memory, sandboxes, skills); #1 GitHub Trending 2026-02-28 | Research → code → create in one harness | **Ignore** (a whole platform) |
| [Alibaba-NLP/DeepResearch](https://github.com/Alibaba-NLP/DeepResearch) · [MiroMindAI/MiroThinker](https://github.com/MiroMindAI/MiroThinker) | 20,052 · 8,420 | 2026-02 · 2026-07 | Model-centric open deep-research agents | — | **Ignore** (model training, not harness) |
| [LearningCircuit/local-deep-research](https://github.com/LearningCircuit/local-deep-research) · [langchain-ai/local-deep-researcher](https://github.com/langchain-ai/local-deep-researcher) · [zilliztech/deep-searcher](https://github.com/zilliztech/deep-searcher) · [u14app/deep-research](https://github.com/u14app/deep-research) | 9,217 · 9,373 · 8,330 · 4,696 | 2026 | Local or private-data deep research | — | **Ignore** |
| [Weizhena/Deep-Research-skills](https://github.com/Weizhena/Deep-Research-skills) | 2,364 | 2026-08-23 | Claude Code skill: **outline phase → deep investigation**, human in the loop (inspired by RhinoInsight, arXiv 2511.18743) | **The user approves the research outline before the expensive fan-out** | **Borrow** |
| [Socialpranker/deepdive](https://github.com/Socialpranker/deepdive) | 373 | 2026-10-11 | 13-phase research skill: reframes the question into hypotheses, writes a **decision spec** ("what you'll do with the answer"), parallel sub-agents, claims ledger, adversarial pass | **Decision spec first**: research is scoped by the decision it feeds (here, "which idea to build") | **Borrow** |
| [199-biotechnologies/claude-deep-research-skill](https://github.com/199-biotechnologies/claude-deep-research-skill) | 1,186 | 2026-04-11 | 8-phase pipeline with source credibility scoring | Credibility score per source | **Borrow** (minor) |
| [Ayanami0730/deep_research_bench](https://github.com/Ayanami0730/deep_research_bench) · [DavidZWZ/Awesome-Deep-Research](https://github.com/DavidZWZ/Awesome-Deep-Research) | 841 · 871 | 2026-09 · 2026-07 | Benchmark and reading list | Use to eval HackForge's research phase if time allows | **Nice** |
| [huggingface/smolagents](https://github.com/huggingface/smolagents) · [camel-ai/owl](https://github.com/camel-ai/owl) | 29,865 · 20,152 | 2026-10 | Agent frameworks | — | **Ignore** |

## G. Idea validation and startup kits

| Repo | Stars | Last push | What | Best idea | Verdict |
|---|---:|---|---|---|---|
| [arslan70/haytham](https://github.com/arslan70/haytham) | 13 | 2026-07-27 | Claude Code plugin: idea → GO/NO-GO/PIVOT → MVP scope → build-vs-buy → OpenSpec in about 20 min, with approval at each phase gate. Now a "personal tool" | **`concept-anchor.json`: invariants that "prevent idea drift"** across phases. **"If it says NO-GO, it tells you why. That's the point."** Neutral `research-brief.md` (no scores) is kept separate from `validation-report.md` (verdict) | **Borrow (must)** |
| [mohamedameen-io/StartupKit](https://github.com/mohamedameen-io/StartupKit) | 163 | 2026-04-22 | 11-phase ideation pipeline (diverge → niche → competitors → positioning → offer → ... → pitch) with 7 "Domain Expert Boards" | **Mode contracts (`quick`/`standard`/`deep`) per phase**, plus **YAML frontmatter session state** (`00-session.md`) that drives the dashboard and next step. Deterministic installer with a SHA-256 manifest | **Borrow** |
| [MaxKmet/idea-validation-agents](https://github.com/MaxKmet/idea-validation-agents) | 480 | 2026-06-16 | Clone-and-talk validator activated by `CLAUDE.md` | **No-setup activation via `CLAUDE.md`** | **Ignore** (borrow the zero-setup UX) |
| [dlkakbs/hermes-startup-architect](https://github.com/dlkakbs/hermes-startup-architect) | 42 | 2026-05-19 | Hermes skill emitting `market_analysis.md`, `competitor_map.md`, `product_spec.md`, `pitch_deck.md`, `landing_page.html` | **Fixed output bundle**, so every run produces the same named artifacts | **Borrow** |
| [fayerman-source/startup-ideas](https://github.com/fayerman-source/startup-ideas) | 31 | 2026-10-03 | Monthly list of ideas "surfaced from public pain signals" | Pain-signal seed source | **Nice** (as data) |

## H. AI judging and adversarial review

| Repo | Stars | Last push | What | Best idea | Verdict |
|---|---:|---|---|---|---|
| [qinnovates/quorum](https://github.com/qinnovates/quorum) | 10 | 2026-04-01 | Expert swarm with a "Hackathon Mode": decomposition agent → PRD → **Architect, Breaker, TDD Enforcer, Pragmatist, Judge** attack it until it survives | **Adversarial PRD stress test** with an **evidence scorecard** (STRONG/MODERATE/UNSOURCED claims), an independence score and bias flags | **Borrow** |
| [ParthGupta1304/ORCHESTRA](https://github.com/ParthGupta1304/ORCHESTRA) | 1 | 2026-08-30 | AI hackathon judging: 5 dimension judges in parallel → **bias auditor** → **chief judge with a confidence tier** | **The bias auditor sits between the judges and the final score** | **Borrow** (judge-panel shape) |
| [buildersclaw/buildersclaw](https://github.com/buildersclaw/buildersclaw) | 1 | 2026-06-13 | "Hackathons for AI agents" | Score mix seen in a SERP snippet: **40% peer agent judging, 30% repo/code judging, 30% deployed-URL runtime judging** | **Borrow** (evidence that judges increasingly test the live URL) |
| [Dev-Am12/Rubric](https://github.com/Dev-Am12/Rubric) | 5 | 2026-09-30 | Self-hosted judging platform with empirical-Bayes shrinkage across judges | Normalizing simulated judges | **Nice** |

**Total assessed: 100+ repos** (about 85 in tables, plus the idea-generator long tail).

---

## Deep dives: the patterns that matter most

### 1. CrafterWIKI `/hack-plan`: demo-first is a phase order, not a slogan
`commands/hack-plan.md` writes one numbered file per phase into `hack-plan/<event-slug>/` (`01-recon.md` ... `06-build-plan.md`) and **"if the folder exists, read it and resume from the first missing file."**

- **Phase 0 Intake** asks only what can't be inferred: team skills, hardware, hours, required sponsor tech, pitch language. It includes a **rules check**: if pre-event work is forbidden, it runs in "rule-limited mode".
- **Phase 1 Recon** produces the rubric and lens weights ("explicit or inferred and labelled"), the judge profile, stackable sponsor lanes, saturation, and data availability.
- **Phase 3** produces at least 6 problems and 3 **structurally different** angles. Each angle carries a live demo moment, human stakes, mechanism ids, its nearest neighbours, "the one thing that must work" and a cut list.
- **Gate 1** is a judge-panel agent that keeps, merges or kills angles, with **at most one** loop back.
- **Phase 4** is a demo script stating what is real and what is mocked, a fallback plan, and a one-sentence repeatability test.
- **Gate 2** is explicit user approval. Architecture comes only after it.
- **Phase 6** is an hourly timeline with code freeze, two full rehearsals, submission packaging and sleep.

HackForge should copy this spine nearly verbatim. It is the clearest articulation of a hackathon workflow found anywhere on GitHub.

### 2. hackathon-radar: selection is the main lever
The `angle-differentiation.md` method:
1. Count Devpost search hits per keyword to map the "flood".
2. Find the near-white keywords.
3. Deep-read the 3 nearest existing projects to verify the gap.
4. Name the trap. Their example: "education" looks saturated at 26.6k, but the saturation is in *content* (tutors); the *operations* slice is nearly empty.

HackForge implementation: `bdata scrape "https://devpost.com/software/search?query=<kw>"` per candidate keyword. This is cheap, and Bright Data is already installed. Then scrape the target event's gallery for current submissions.

### 3. dontreadme plus beautiful-hackathon-slides plus convex-hackathon-skill: the submission package
Rubric-anchored README with "Judging Highlights". An HTML deck with an explicit demo slot and animated demo-slide fallbacks. A narration script timed to the video limit. A `hackathon.md` build log generated from git evidence. **One shared rule across all of them: never invent links, metrics or teammates.**

### 4. gstack `/office-hours`: interrogate the idea, then narrow the wedge
Builder Mode applies "at a hackathon". Startup Mode's six forcing questions are demand reality, status quo, desperate specificity, narrowest wedge, observation and future-fit. The skill includes anti-sycophancy rules and pushback patterns (`sections/phase-2a-startup-diagnostic.md`). HackForge's idea gate should ask a compressed 3–4 question version and default to "ship the narrowest wedge".

### 5. hyperresearch plus dzhng plus STORM: research that is fast, cited and adversarial
For a hackathon:
- Use a **light tier** with a hard time box (about 20–40 min).
- Use **breadth×depth** knobs (dzhng) and **perspective-guided questions** (STORM: each perspective is a judge lens or a user persona).
- Run an **independence audit** and a **cite-check** before any claim reaches the pitch, because a judge who catches one fake stat discounts the rest.
- Persist sources to a vault so the pitch and README can cite them.

### 6. rajih-engine plus Quorum plus ORCHESTRA: ideation and judging as a deterministic Workflow
```
parallel([ideator(grounded), ideator(transformational), ideator(demo-first)])   // isolated contexts
 → scout.verify(each candidate)                                                  // candidate-specific evidence
 → parallel([judge(lens) for lens in rubric.lenses])                             // schema-validated scores
 → biasAuditor(all scores) → chiefJudge(final + confidence)                      // keep / merge / kill
 → breaker/pragmatist attack on the winner's PRD (max 1 loop)
```
This maps onto Workflow primitives: `parallel`, `pipeline`, `agent({schema})` and `budget`, as listed in the ultracode-workflows README.

---

## Top 10 ideas that would make HackForge better than ECC for hackathons

1. **A demo-first phase spine with hard gates** (CrafterWIKI ADR-004). The order is Intake → Recon → Patterns → Angles → Judge Gate → Demo Script → User Gate → Architecture → Build → Package. HackForge refuses to choose a stack before the demo script is approved. ECC has 97 commands and no spine.
2. **Rubric as the root object.** Ingest the event's criteria and weights at intake, inferring and labelling them when unpublished. Every downstream artifact (idea scores, demo script, README "Judging Highlights", deck order) must close the loop against it. Sources: dontreadme, crafterwiki, ORCHESTRA.
3. **Saturation and white-space analysis before ideation** (hackathon-radar). Use Devpost search counts plus a gallery scrape plus a deep-read of the 3 nearest projects, via `bdata`. "Selection losses, not build losses."
4. **Winner-mechanism taxonomy, labelled as hypotheses.** Adopt crafterwiki's 23 mechanisms and 15 lenses as the vocabulary for scoring angles. Ship a tiny seed corpus, but follow crafterwiki's own warning that its holdout did not validate winner imitation. Use base rates only from full rosters.
5. **Isolated ideators → evidence scout → lens judges → bias auditor → chief judge**, written as one native Workflow script with schema-validated outputs and a single bounded refine loop (rajih-engine, Quorum, ORCHESTRA). Deterministic and resumable, unlike ECC's prose agents.
6. **A kill-switch idea gate.** Use go / needs-clarification / kill (spec-kit assess) or GO/NO-GO/PIVOT (haytham), driven by 3–4 compressed office-hours forcing questions (gstack). Add a `concept-anchor` file of invariants that stops idea drift during the build.
7. **Time-boxed, cited research.** A light tier by default with breadth and depth knobs, a social-signal pass (last30days), cite-check plus independence audit, and an outline-approval checkpoint (Weizhena). Research is scoped by a decision spec (deepdive): "which idea do we build, and what will judges doubt?"
8. **All state on disk, resume from the first missing file.** Use a `.hackforge/` directory of numbered phase files with YAML frontmatter status (StartupKit), the 3-file plan, findings and progress pattern (planning-with-files), and run manifests (hyperresearch). This survives `/clear`, compaction, crashes and teammate handoffs.
9. **A build loop scoped to the demo path with real exit conditions.** Use a `prd.json`-style story list (ralph) limited to "the one thing that must work" plus the cut list, with fresh-context executors in parallel waves (GSD) and a dual-condition exit plus circuit breaker (frankbria). Add a two-stage review (superpowers), an **hourly timeline with code freeze and two rehearsals** (crafterwiki), and a live-URL health check, since judges increasingly test the deployed URL (BuildersClaw).
10. **A truth-grounded submission factory.** Produce the judge-ready README (dontreadme), an HTML deck with a demo slot and an animated-demo fallback (beautiful-hackathon-slides, frontend-slides), a demo video from the same HTML (HyperFrames), a narration script timed to the limit, a `hackathon.md` build log (convex skill), evidence captures (proof, vhs), plus a final "LLM-judge pass" that reviews the submission the way an AI first-pass judge would (carmatthews: "Claude will judge"). Hard rule: never fabricate URLs, metrics or teammates.

**Packaging principle (cross-cutting):** ship as **one Claude Code plugin** (immutable slug, `claude-plugins-official`-compatible) with about 10–12 skills, about 6 agents and 2–3 Workflow scripts. Make it Agent-Skills-compatible for `npx skills add`. Deploy and database MCPs are **opt-in per chosen target** (the jmo-skills pattern). Validate with `claude plugin validate --strict` and ship `evals/` per skill, as dontreadme does.

---

## Recommended install set (keep it tiny)

```text
# Inside Claude Code (each line as its own message)
/plugin marketplace add mvanhorn/last30days-skill
/plugin install last30days
/plugin marketplace add https://github.com/zarazhangrui/frontend-slides
/plugin install frontend-slides@frontend-slides
/plugin marketplace add heygen-com/hyperframes
/plugin install hyperframes@hyperframes
```
```bash
# MCPs (project scope, not global)
claude mcp add playwright -- npx @playwright/mcp@latest
claude mcp add --transport http context7 https://mcp.context7.com/mcp
# opt-in, only the chosen deploy target: Vercel / Netlify / Render / Railway / Cloudflare / Supabase / Neon official MCPs
# optional design QA
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```
The commands are copied from each repo's README. Check them against the current READMEs before scripting them into an installer. Do not run third-party `setup` scripts without review (gstack's `./setup` modifies `~/.claude/skills`; jmo-skills' agentation installs packages).

## Avoid list (and why)
- **ruflo / claude-flow, SuperClaude, oh-my-claudecode, BMAD, wshobson/agents, agency-agents:** breadth and ceremony, conflicting auto-trigger skills, context bloat. They are the "ECC problem" again.
- **MCP gateways and aggregators (metamcp, docker/mcp-gateway, IBM context-forge):** ops overhead with no demo value.
- **Generic "hackathon idea generator" repos:** they produce exactly the crowded ideas saturation analysis warns about.
- **Licenses:** agentation (PolyForm Shield) in jmo-skills; Firecrawl and claude-squad are AGPL; `Pimzino/spec-workflow-mcp` is GPL-3.0; best-of-mcp-servers is CC-BY-SA. Use these as tools; do not vendor them.
- **Supply chain:** treat every third-party skill as untrusted code. Scanners exist (e.g. `NVIDIA/SkillSpector`, 20,312 stars; `affaan-m/agentshield`, 1,285 stars). Pin versions (`UPSTREAM.json` in jmo-skills is a good pinning pattern).

## Open questions
- **Native Workflow tool status:** `ray-amjad/claude-code-workflow-creator` (May 2026) calls it unreleased; `hesreallyhim/ultracode-workflows` (Sep 2026) says plugins ship workflows as first-class components. Confirm against the current Claude Code version before making Workflow scripts load-bearing.
- **Devpost scraping:** check the ToS and rate limits for gallery and search scraping via Bright Data. Decide whether HackForge caches a corpus or always scrapes live.
- **Corpus size:** crafterwiki's corpus is small (36 analyzed projects). Should HackForge build and maintain its own winners corpus, or only do live per-event recon?
- **LLM judging:** more events use AI first-pass judging (carmatthews, BuildersClaw, ORCHESTRA). Should HackForge emit a machine-readable submission summary (e.g. `JUDGING.md` or JSON) alongside the human README?
- **Vendoring:** borrow small MIT skills (dontreadme, beautiful-hackathon-slides) with attribution, or depend on them at install time? dontreadme's license needs confirming (the API shows none; the README says MIT).

## Sources
GitHub repos as linked in the tables (metadata from `api.github.com/search/repositories`, 2026-10-15/16). Key files read:
- `RikepilB/crafterwiki`: `commands/hack-plan.md`, `schema/taxonomy.json`, `docs/builder-harness.md`
- `painbaba/hackathon-radar`: `playbooks/angle-winners.md`, `angle-demo.md`, `angle-differentiation.md`
- `Jazztinn/dontreadme`: `hackathon-readme/SKILL.md`
- `Esther2524/beautiful-hackathon-slides`: `references/workflow-phases.md`
- `garrytan/gstack`: `office-hours/SKILL.md`, `office-hours/sections/phase-2a-startup-diagnostic.md`
- READMEs of every other repo cited
- ECC local clone: `README.md:2039`, `agents/`, `commands/`, `skills/`
- Web: [fast.io skills directory 2026](https://fast.io/resources/awesome-claude-skills-directory-2026/), [dupple best Claude Code skills 2026](https://dupple.com/learn/best-claude-code-skills-2026)
- Bright Data SERP results for `site:github.com` hackathon queries (surfaced convex-hackathon-skill, solana-ai-kit, carmatthews, Quorum, ORCHESTRA, BuildersClaw)
