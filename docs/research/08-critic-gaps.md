# 08: Completeness critic (contradictions, gaps, and the 10 decisions that matter)

- **Date:** 2026-10-15
- **Inputs:** the seven research reports on disk (`01-ecc-orchestration.md` … `07-bright-data-cookbook.md`) and the packaging summary that came with this brief.
- **Missing input:** the packaging report has no file in `docs/research/`, so only its summary exists. Its content needs writing to disk (for example `09-packaging.md`) before anyone builds from it.
- **Method.** I read all seven reports in full and checked each disputed claim against a primary source wherever a cheap check existed:
  - Claude Code docs, fetched as markdown from `code.claude.com/docs/en/*.md` on 2026-10-15: `mcp`, `workflows`, `plugins-reference`, `plugins/components`, `statusline`, `skills`, `sub-agents`, `tools-reference`, `costs`.
  - Devpost endpoints and Terms of Service (about 10 plain HTTP requests).
  - Bright Data: 3 `bdata` calls (1 SERP OK, 1 SERP failed, 1 discover 404).
  - 2 WebSearch and 1 WebFetch calls, on Claude plan limits and Vercel deployment protection.
- **Local environment:** Claude Code **2.1.285**.
- Raw artifacts are in `scratchpad/critic/`.

---

## TL;DR

1. **The biggest unflagged problem: Devpost's Terms of Service forbid automated access.** Reports 05, 06 and 07 build key features on scraping Devpost: the `/hf:rules` parser, the hackathon-radar saturation counts, gallery scans and prior-art reads. Devpost ToS §4 ("Last Updated: December 5, 2025") says users agree NOT to use "manual or automated software, devices, scripts robots, or other means or processes to access, 'scrape,' 'crawl' or 'spider' the Site". Devpost's robots.txt allows everything, and its search endpoints return free JSON. The JSON endpoints are open, but the ToS prohibits using them by script. HackForge should:
   - get saturation counts from search-engine SERP counts;
   - read only the one rules page the user names, and only with the user's consent;
   - never crawl galleries.

   The same ToS also prohibits a submission that "substantially duplicates" a prior one. That makes the prior-art check a compliance step as well as a strategy step (§3.1).
2. **06's checkpoint design does not fit the platform.** Report 06 proposes one `hackforge.workflow.js` that enforces checkpoints across the event clock. The Workflow runtime rules this out:
   - no mid-run input;
   - `Date.now()` throws;
   - the script has no filesystem or shell access;
   - runs are bounded fan-outs.

   Report 01 is right: use a **chain of short workflows with human gates between them**. Clock enforcement belongs in on-disk state, hooks, a plugin **monitor**, and an optional project `statusLine` with `refreshInterval` (§3.2).
3. **Two platform facts nobody flagged.**
   - On Pro, dynamic workflows must be **switched on in `/config`**, and the default size guideline there is `small` (fewer than 5 agents).
   - **A plugin cannot set the main status line.** Plugin `settings` honours only `agent` and `subagentStatusLine`. The "statusline countdown" in report 02 therefore needs a project settings write or a monitor.
4. **The other contradictions are mostly settled by sources that already exist:**
   - CLI-first wins over "must install Playwright MCP / Context7 MCP" (05).
   - Exact pins win over `@latest` (04, 05).
   - Human narration wins over TTS (02, 04 vs 06).
   - Five slides win over eight (02 vs 06).
   - Report 06's percentage clock wins over report 02's T-minus clock.
   - Report 07's tested facts win over report 03's assumptions: `bdata budget` returns 403, and Discover returns 404. I re-confirmed the 404 today, a third time.
   - Use the slug **`hackforge`, not `hf`**. `hf` is Hugging Face's CLI name, and reports 01 and 04 both put an `hf` executable on PATH.
5. **Usage limits are the real "budget".** A 24 h event spans about 5 five-hour windows. The rolling weekly cap is shared by Claude.ai, Claude Code and Desktop, and Anthropic publishes no numbers. Workflow runs pause at the limit only on v2.1.271 or later, and only in interactive claude.ai-subscription sessions. HackForge has to size its fan-outs by plan and route cheap stages to smaller models (§3.3).

---

## 1. Contradictions between reports, with verdicts

Verdict key: **✔ settled** (checked against a primary source today or a live test in a report), **≈ judgement** (sources lean one way), **? open**.

| # | Topic | Report A says | Report B says | Verdict and why |
|---|---|---|---|---|
| C1 | **MCPs bundled with the harness** | 01, 02: plugin ships `mcpServers: {}` / zero MCPs | 03: ship 6 Tier-A research MCPs in a project `.mcp.json`. 04: commit 4 build MCPs (supabase, vercel, shadcn, chrome-devtools) as "always on". 05: "must" install Playwright MCP + Context7 MCP | **≈ Zero in the plugin. Opt-in, per-phase and per-stack project `.mcp.json` written at kickoff.** Tool search defers schemas (docs `mcp.md`), so the cost lies in result volume, tool confusion and OAuth friction, not schema size. A project `.mcp.json` needs per-user approval interactively but **loads without approval in `-p` / SDK** (02). So never commit one silently. Generate it from templates after the stack is chosen. |
| C2 | **Playwright MCP vs CLI** | 05: "must: Playwright MCP (or DevTools MCP)", installs `npx @playwright/mcp@latest` | 02, 03, 04: Playwright CLI/library + skills; Microsoft's README tells coding agents to prefer the CLI | **✔ CLI/library for scripted golden-path runs and recording.** The script is a file that serves as smoke test, evaluator runner and video recorder. Chrome DevTools MCP is optional for debugging. Desktop users get the built-in Browser pane. Background subagents (the default for workflow agents) **keep every MCP tool** (docs `sub-agents.md` §tools), so both work inside workflows. The CLI keeps snapshots on disk and out of context. |
| C3 | **Context7** | 05: "must: Context7 MCP" | 03, 04: `npx ctx7 setup --claude` CLI+skill mode (Node ≥ 22.13); ECC moved to REST | **≈ CLI+skill first, keyless MCP as fallback** when Node < 22.13. Vendor MCP docs tools also cover vendor docs. |
| C4 | **Version pinning** | 02: exact pins only (adapted `mcp-dependency-review`; ECC pins `chrome-devtools-mcp@1.10.1`) | 04: template uses `chrome-devtools-mcp@latest`, `shadcn@latest`. 05: `@playwright/mcp@latest` | **≈ Pin exact versions in every shipped template.** Re-pin at build time. 1.10.1 is ECC's pin and may be stale, so do not copy it blindly. `/hackforge:doctor` flags `@latest` and bare names as HIGH. |
| C5 | **Bright Data MCP auth** | 07: `url: …/mcp?token=${BRIGHTDATA_API_TOKEN}&tools=…` | 03: never put keys in URL query strings; use `Authorization: Bearer` (inferred from OAuth metadata, untested) | **≈ CLI first (no MCP). If the MCP is wanted, use the vendor-documented `?token=${VAR}` form.** I confirmed `${VAR}` expansion works for a custom name like `BRIGHTDATA_API_TOKEN`: the "reads as empty" list is a fixed set (Claude Code's own and cloud credentials, `HTTPS_PROXY`, `NPM_TOKEN`), and "a name outside this set … expands as written" (docs `mcp.md` §Credential variables). Claude Code never prints the expanded URL in `/mcp` or `claude mcp list`. The token still reaches server logs, so test the Bearer header once, and switch if it works. **? Bearer is still untested.** |
| C6 | **Credential env names in remote headers** | 04: "credential-looking variables expand to empty … use your own names" | (implicit elsewhere) | **✔ 04 is right, with one nuance.** The empty-read list is a fixed set, not a pattern. Separately, `headersHelper` scripts supplied by a repo or plugin get **every** variable whose name contains TOKEN, SECRET, PASSWORD, KEY or AUTH stripped (docs `mcp.md` L1043). Do not use a `headersHelper` that reads secrets from env. |
| C7 | **Bright Data Discover** | 02, 03, the brief: `bdata discover` is a research rung | 07: HTTP 404 on two attempts | **✔ Unavailable on this account.** My minimal call today also returned `Error: Not found / Status: 404`. Treat Discover as optional and auto-detect it in `/hackforge:doctor`. |
| C8 | **Bright Data budget visibility** | 03: "show `bdata budget` in /hf-doctor" | 07: `budget balance` returns 403 for this scoped key | **✔ 07 is right. Keep a local ledger** (`.hackforge/web/ledger.tsv`, `HF_WEB_BUDGET`). |
| C9 | **Can a 24 h checkpoint clock live in a Workflow?** | 06: `hackforge.workflow.js` enforces IDEA LOCK … SUBMITTED at 8/30/55/75/85/92 % | 01: chain of short workflows with gates between them, because workflows take no mid-run input | **✔ 01 is right.** Docs `workflows.md` §Behavior and limits list: "No mid-run user input … For sign-off between stages, run each stage as its own workflow". The workflow itself has no filesystem or shell access, and `Date.now()` / `Math.random()` / no-arg `new Date()` throw. Pass `args.now` and `args.deadline` in, and enforce checkpoints with state, hooks and a monitor (§3.2). |
| C10 | **Event clock** | 02: deploy by T-6 h, **feature freeze T-4 h**, deploy freeze T-2 h, submit T-30 min | 06: IDEA LOCK 8 %, SKELETON 30 %, WOW 55 %, **FREEZE 75 % (T-6 h on 24 h)**, VIDEO 85 %, **SUBMITTED 92 % (T-2 h)** | **≈ Use 06's percentages.** Devpost and MLH both advise leaving 2–3 h for video and submission (06 §6). Keep 02's T-30 min as an absolute floor. Separately, a **hello-world prod deploy in hour 1** (04's "deployed by T+15 min") does not conflict with 06's skeleton at 30 %: one proves the pipeline, the other proves the golden path. |
| C11 | **Pitch deck length** | 02: 8-slide hackathon flow (hook, problem, solution, demo, how, sponsor, impact, next+team) | 06: ≤ 5 slides, ≤ 4 bullets (ETHGlobal cap; AngelHack "1 opening slide is enough") | **≈ 06 for the live pitch: 5 slides with the live demo between slides 2 and 3.** 02's extra beats go to an appendix and the Devpost gallery. |
| C12 | **Voiceover** | 02: optional TTS. 04: ElevenLabs voiceover in the video pipeline | 06: **ETHGlobal bans TTS/AI voiceover**; Devpost warns AI-written scripts read as generic | **≈ Human narration by default.** Allow TTS only when `rubric.json` explicitly permits it and the team opts in. Captions are always on. |
| C13 | **Idea-scoring math** | 02: weighted sum over the event's criteria, feasibility gate (< 3 = reject), **×1.5 demo-ability multiplier**, sponsor EV tiebreak, novelty gate | 06: `IdeaScore = 20·F·(0.20P+0.20W+0.15A+0.15T+0.10S+0.10N+0.10E)`, feasibility multiplier F 0.2–1.0, gates G1–G6, fatigue −10 | **≈ Use 06's formula as the single scorer** (it already contains demo-ability W and feasibility F), re-weighted from `rubric.json`. Fold in 02's sponsor-EV tiebreak and novelty gate. Do **not** stack 02's ×1.5 on W, which double-counts demo. N (novelty) gets a SERP saturation count (§3.1). |
| C14 | **Number of ideas / angles** | 02: 15 ideas → top 3 | 06: 15–30 candidates → gates → top 3 | **≈ Compatible pipeline:** 15–30 candidates from ideators with assigned directions → gate → ≥ 3 structurally different angles (05 CrafterWIKI) → judge gate → council on top 3. Report 05 cites CrafterWIKI's own warning that copying winners did not validate on holdout, so treat its 23 "mechanisms" as vocabulary, not as a predictor. |
| C15 | **Evaluator / review rounds** | ECC: GAN 15 iterations, Santa 3 rounds | 01: ≤ 3 eval rounds per milestone + 1 final; Santa ≤ 2. 02: 2–3 passes or phase clock | **≈ Cap at 2 rounds per milestone, plateau stop after 1 flat round, 1 final pass before Gate C.** Anthropic's 2026-03-24 post moved to a single end-of-build evaluator pass for frontier models (01, 02). |
| C16 | **Plugin slug** | 01: `hf` (install `hf@hackforge`, short tool names) | Packaging summary: `hackforge` (`hackforge@<marketplace>`). 05: pick an immutable slug on day 1 | **≈ Use `hackforge`.** (a) With zero bundled MCPs, the 64-char MCP tool-name issue that drove ECC to a short slug does not apply. (b) `hf` is the Hugging Face CLI command (huggingface_hub ≥ 0.34, from prior knowledge, so verify), and 04 recommends Hugging Face tooling. 01 also proposes an `hf dev up` script from plugin `bin/`, which goes on PATH and would shadow it. (c) Slugs are immutable in `claude-plugins-official` (05). Keep skill names short (`/hackforge:ideate`), and name any `bin/` executable `hackforge`. |
| C17 | **Workflow tool availability** | 05: `ray-amjad` says "unreleased" (May 2026) | 01 and the packaging summary: documented; plugins ship `workflows/*.js` | **✔ Released and plugin-shippable.** Docs `workflows.md` §Distribute a workflow in a plugin: "A plugin called `acme-tools` containing a script whose `meta.name` is `release-audit` runs as `/acme-tools:release-audit`". The May 2026 claim is stale. **New caveat:** "On Pro, turn them on from the Dynamic workflows row in `/config`." |
| C18 | **Concurrency numbers** | 01: 16 concurrent workflow agents | Packaging summary: subagent concurrency 20 | **✔ Both are right; they are different knobs.** Workflow agents: 16 by default (fewer on low-CPU machines), raise with `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` (1–256, v2.1.269+). Subagents: `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`. |
| C19 | **Dev-server ownership** | 01 open question: does a server started by one workflow agent survive? | 04: Desktop `launch.json` + `preview_start` | **✔ Mostly answered by docs** (`tools-reference.md` §When a background command stops). A command started by a **foreground** subagent stops when that subagent ends. One started by the main conversation **or a background subagent** keeps running after the final response. In `-p`, SDK or cloud runs it gets a 30 min default and a 2 h maximum (v2.1.285+). **Decision:** the main session owns the dev server (`run_in_background`, or Desktop `preview_start`). Evaluators only health-check it. |
| C20 | **Devpost via Bright Data** | 05: `bdata scrape "https://devpost.com/software/search?query=<kw>"` per keyword. 07: `site:devpost.com/software "<phrase>"` SERP + scrape project pages | (none) | **✔ Change both** (§3.1). Devpost search already returns JSON, but the ToS forbids scripted access. Use SERP counts instead. My `site:devpost.com/software "meal planning"` query failed with `Error: redirect location was rejected`; plain `site:devpost.com meal planning app` worked, with `general.results_cnt` = 2,800. |
| C21 | **Vercel preview URLs** | 04: preview deployments may sit behind Vercel login (unverified) | (none) | **✔ Mostly true, with a nuance 04 missed.** Deployment Protection (Vercel Authentication) has been on by default for new projects since Nov 2023. Standard Protection covers preview URLs **and deployment-specific production URLs**; only the up-to-date production domain or alias is public ([Vercel docs](https://vercel.com/docs/deployment-protection), [changelog](https://vercel.com/changelog/deployment-protection-is-now-enabled-by-default-for-new-projects)). The unique `app-<hash>.vercel.app` URL that `vercel --prod` prints can therefore be login-walled. Give judges the alias or custom domain, and check it in incognito. |
| C22 | **What lives in git** | 07: gitignore `.hackforge/web/` (raw scraped data). 01: `.hackforge/` state dir | 06: ETHGlobal requires spec, plan and prompt files in the repo; AI-use disclosure | **≈ Commit** `.hackforge/{HACKATHON.md, rubric.json, IDEA.md, SPEC.md, DEMO_SCRIPT.md, slices/*/contract.md, checkpoints.md}`. **Gitignore** `.hackforge/web/`, ledgers and run caches. Write the policy into kickoff. |
| C23 | **"No pre-existing code"** | 04: pre-warm caches; one throwaway prod deploy before the event | 06: MLH, ETHGlobal and Anthropic forbid project code before the start; only public boilerplate and starters, disclosed | **≈ Compatible if HackForge's templates are public (MIT), generic, and disclosed** in the README's AI/tooling section. The throwaway deploy must be a separate repo. Kickoff should read the event's pre-existing-code rule into `rubric.json` and switch to "rule-limited mode" (05 CrafterWIKI) when needed. |

ECC-internal contradictions (02 §4.5) are well documented already and don't need re-litigating. In short: deep-research needs Firecrawl or Exa, which are not defaults; gan-evaluator lists `mcp__playwright__*`; the docs claim memory MCP is on by default; the catalog has 17 of 18 entries unpinned. The lesson is to inherit none of ECC's tool names verbatim.

---

## 2. Gap inventory

| # | Gap | Who touched it | Severity | Status |
|---|---|---|---|---|
| G1 | **Devpost data access: legality, endpoints, and a ToS-safe saturation method.** Underpins `/rules`, saturation, prior art | 05 (open question), 07 (untested) | **High**: core features would be built on a ToS violation | **Filled (§3.1)** |
| G2 | **Platform constraints that gate the design:** Pro workflow toggle, script sandbox, clock inside workflows, status line from a plugin, monitors, MCP tools in workflow agents, background-command lifetime, version floors | 01, packaging (partial) | **High**: decides the orchestration architecture | **Filled (§3.2)** |
| G3 | **Usage-limit and cost envelope** for running HackForge across a 24–48 h event on Pro/Max/Team | 02 (proxy-gateway case only) | **High**: a team that hits the weekly cap at hour 14 loses | **Filled, partially (§3.3)**. Anthropic publishes no numbers |
| G4 | Packaging report missing on disk | — | Medium | Flagged; write `09-packaging.md` from its summary |
| G5 | **Agent teams** (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, about 7× tokens in plan mode per docs `costs.md`) vs worktrees + sessions for 06's "2–4 parallel domain builders" | none | Medium | **Open.** Default to worktrees + `isolation: 'worktree'` agents; evaluate agent teams later |
| G6 | **Multi-human protocol:** 2–4 people each running Claude, sharing `.hackforge/` through git, file ownership, one integrator, merge-only-on-green | 01 (board.md), 02 (M14), 06 §12.2 | Medium | Open. Needs a short design doc |
| G7 | **Non-web tracks:** web3 (ETHGlobal is a major venue: Foundry/Hardhat, Scaffold-ETH 2, testnets, wallet UX), hardware/IoT, data-science notebooks | 04 covers web, Python ML and mobile only | Medium | Open. Ship a "stack card" interface so tracks can be added |
| G8 | **HackForge self-evaluation:** no benchmark plan. Proposal: replay 3 past Devpost events whose rules and winners are public; measure time-to-skeleton, rubric-coverage of artifacts, and whether judge-sim ranking correlates with actual winners | 01, 05 mention plugin evals only | Medium | Open (proposed in §4, D10) |
| G9 | **Model routing for HackForge's own agents** (which stages run on Haiku, Sonnet or Opus) | 05 (open_deep_research roles), costs doc | Medium | Partially addressed in §3.3 |
| G10 | **Prompt-injection blast radius:** research agents read hostile web text, so they should not hold Write, Edit or deploy tools | 03 (papers), 01 (fencing) | Medium | Folded into D5 |
| G11 | Same-name collision between a plugin **workflow** and a plugin **skill** (for example `/hackforge:ideate`) | 01 (open question) | Low–Med | **Open.** Undocumented. The skills docs cover skill vs command vs bundled, not plugin workflow vs plugin skill. Use distinct names (`ideate` skill wrapping an `ideate-run` workflow) until tested with `--plugin-dir` |
| G12 | Claude Code **version floor** | scattered | Medium | Filled in §3.2 (pick ≥ 2.1.285 now; some docs features need 2.1.288 and 2.1.295) |
| G13 | Scraped-content licensing in the pitch (quoting Reddit or YouTube users verbatim) | none | Low | Open: paraphrase and link; no usernames |

---

## 3. Gap fills

### 3.1 G1: Devpost data access (endpoints, ToS, and the safe method)

**What exists (probed 2026-10-15 with plain HTTP; a handful of requests, then I stopped):**

| Endpoint | Result | Use |
|---|---|---|
| `https://devpost.com/robots.txt` | `User-agent: *` / `Disallow:` (empty, allows everything); only BLEXBot, Omgili, ImagesiftBot and Bytespider are banned | Robots permits crawling, but the ToS overrides it (below) |
| `https://devpost.com/api/hackathons?search=<q>&status[]=open` | 200, JSON `{hackathons[], meta{total_count, per_page}}`. Fields: `title, url, submission_period_dates, prize_amount, registrations_count, themes[], organization_name, open_state, prizes_counts, submission_gallery_url, invite_only, winners_announced` | Event discovery (e.g. PayPal AI Hackathon: Oct 01–Nov 12 2026, $67,500, 15,183 registrations) |
| `https://devpost.com/software/search?query=<kw>` | 200, **JSON** `{software[], total_count}`. Fields: `name, tagline, slug, url, members, tags, like_count, comment_count, has_video, winner` | This *is* hackathon-radar's saturation count. Today: "agent" **47,620** (hackathon-radar quoted 35,559, so the corpus has grown), "chatbot" 25,779, "meal planning" 2,046, "permit" 1,357, "dysarthria" 39 |
| `https://<slug>.devpost.com/rules` | 200, server-rendered HTML (176 KB) whose criteria text is extractable with a regex strip | The `/rules` parser source. PayPal 2026 rules: 5 equally weighted criteria (Technological Implementation, Design, Potential Impact, Innovation/Idea, **Presentation**); tie-break on the first criterion. This matches 06's OpenAI template plus a Presentation criterion |
| `https://<slug>.devpost.com/project-gallery` | 200 HTML, but project links are not in the static HTML (0 `devpost.com/software/` hrefs) | A gallery scan would need JS, so a scraper or browser. Another reason not to automate it |

**The blocker.** Devpost Terms of Service (`info.devpost.com/legal/terms-of-service`, "Last Updated: December 5, 2025") §4 *Code of Conduct and Responsibility for User Content*, under "All Users agree NOT to … use the Site in a manner that:", lists:

> uses manual or automated software … to access, "scrape," "crawl" or "spider" the Site

The same list also prohibits content that **"Substantially duplicates Software or a Submission … previously entered on the Site or in the same Hackathon"**.

**Implications for HackForge:**
1. **No bulk Devpost automation in the shipped harness.** This rules out hackathon-radar-style Playwright scanners, gallery crawls, a winners-corpus builder, `bdata scrape` loops over `devpost.com/software/search` (05), and polling `/api/hackathons`.
2. **Rules intake is user-initiated and single-page.** `/hackforge:kickoff` asks the user to paste the rules text, or names the one rules URL and asks consent to fetch it once (curl and an HTML strip are enough, with WebFetch as fallback). It then caches the result in `.hackforge/rules.md`. Write it so the user's own action drives it, and say in the skill that Devpost's ToS restricts automated access.
3. **Saturation counts come from a search engine, not Devpost.** `bdata search "site:devpost.com <kw phrase>" --country us --language en --json` gives `general.results_cnt` (live test: "meal planning app" → **2,800**, vs Devpost's own 2,046), plus the top 10 nearest projects with URLs. WebSearch can run the same `site:` query free, but returns no count. Then deep-read the **3 nearest** projects (hackathon-radar's method) as a handful of user-visible page reads, not a crawl.
4. **The `bdata` wrapper needs a new failure mode.** `site:devpost.com/software "<quoted phrase>"` failed with `Error: redirect location was rejected` (exit 1). `site:devpost.com <unquoted words>` succeeded. `hf-web` should retry once without the path segment or the quotes.
5. **The prior-art check doubles as compliance.** Because the ToS bans substantially duplicating prior submissions, the idea gate should block an idea whose nearest Devpost neighbour has the same pitch (06 G6 "rules-clean" plus 07 §5.4's pivot rule).
6. **Do not ship a "winners corpus" in v1.** CrafterWIKI's own holdout didn't validate copying winners, and building a corpus would mean crawling. Ship the taxonomy only (05).
7. ETHGlobal, MLH and Cerebral Valley rules pages are **unchecked**. Apply the same rule: user-named single fetch, cached, with the ToS noted in the skill.

### 3.2 G2: Claude Code platform constraints that decide the architecture (docs fetched 2026-10-15)

| Fact (source) | Consequence for HackForge |
|---|---|
| Dynamic workflows run on all paid plans and the API; **"On Pro, turn them on from the Dynamic workflows row in `/config`."** (`workflows.md` L10) | `/hackforge:doctor` must check this and print the fix. Every workflow-backed skill needs a **degraded path** that runs the same steps with the Agent tool sequentially (01 already suggests this). |
| Size guideline defaults to `medium` (< 10 agents), or **`small` (< 5) on Pro** from v2.1.271; it is advice, not a cap (`workflows.md` §Set a size guideline) | Write HackForge's fan-outs to read `args.size` (`small` → 3 ideators, 2 judges; `medium` → 6 ideators, 4 judges). Don't rely on the guideline. |
| The workflow script has **no filesystem or shell access**, **no `import()`**, and **`Date.now()` / `Math.random()` / `new Date()` throw** (`workflows.md` §Behavior and limits, §Timestamps) | Skills must read `.hackforge/rubric.json` and `STATE.md` and pass them as `args`, together with `args.now` and `args.deadline`. Agents do all file I/O. A workflow can never "watch the clock", which kills 06's design (C9). |
| **No mid-run user input**; runs are background; `/workflows` shows progress; relaunch replays completed agents from cache (`workflows.md` §Resume) | Gates A/B/C sit between workflows (01). Keep agent start order stable so relaunching after an edit reuses cached results. |
| `agent()` resolves to `null` on stop or unrecoverable error, and `pipeline()` keeps nulls (`workflows.md` L315) | Port 01's fail-closed null counting. **Never** use `.filter(Boolean)` on verdicts without counting what was dropped. |
| Schema validation retries 5 times (`MAX_STRUCTURED_OUTPUT_RETRIES`), and a self-contradictory schema fails before the agent starts (`workflows.md` L319–321) | Use 01's `if/then` "proof required for HIGH" schemas freely. They are checked up front. |
| Workflow agents share prompt cache when model, effort, agent type, tools, schema and cwd match (`workflows.md` L350) | Judges and ideators should be **one agent type with the lens in the prompt**. That answers 01's open question in favour of cache sharing. |
| A run that hits the claude.ai usage limit **pauses and resumes after reset**, but only on **v2.1.271+**, in an **interactive** subscription session; not in `-p`, the SDK, background sessions or teammate sessions (`workflows.md` §usage limit) | Run HackForge workflows interactively. Don't drive them through `claude -p` scripts (ECC's `gan-harness.sh` pattern), where a limit fails the agents. |
| Background subagents **keep every MCP tool** plus Bash, WebFetch, WebSearch, Monitor and Skill (`sub-agents.md` L444) | Workflow agents can use chrome-devtools MCP, the Desktop `mcp__Claude_Browser__*` tools or Playwright MCP. OAuth-only servers still need a prior interactive login (03). |
| Background commands from the main session or a background subagent **survive the agent's final response**; ones from a foreground subagent don't. `-p`, SDK and cloud runs cap them at 30 min (max 2 h), v2.1.285+ (`tools-reference.md` §Background commands) | The main session owns `dev up` (C19). Evaluators curl `/health` first and record `achievedMode` (01). |
| Plugin `settings` honours **only `agent` and `subagentStatusLine`**; other keys are dropped (`plugins-reference.md` L144, L214) | A plugin **cannot** install the deadline status line. Options: (a) kickoff offers to write `statusLine` into the **project** `.claude/settings.json` with `refreshInterval: 30` (`statusline.md` §refreshInterval; project settings are allowed), which is a persistent config change, so ask first; or (b) use a monitor (next row). |
| Plugin **monitors** (`experimental.monitors` or `monitors/monitors.json`): a shell command run as a **persistent background process**; "what it prints reaches Claude as notifications"; `when: "on-skill-invoke:<skill>"`; **interactive sessions only**; no `${user_config.*}` (`plugins-reference.md` §monitors, `components.md` §Monitors) | **This is the missing deadline clock.** A tiny `deadline-monitor.sh` reads `.hackforge/state.json` and prints at checkpoint boundaries ("IDEA LOCK due in 15 min", "FEATURE FREEZE now: only golden-path fixes"). Start it `on-skill-invoke:kickoff`. The schema is experimental and may change, so keep the SessionStart/UserPromptSubmit countdown injection (01's `hf:state`) as the fallback. |
| Plugin skills are namespaced `/plugin:skill`; skill > command file; personal > project for un-namespaced skills; the `anthropic-skills` namespace is reserved (`skills.md` §Resolve skills that share a name) | Namespacing makes `hackforge:` safe from the user's own `deep-research` skill. **Plugin workflow vs plugin skill with the same name is undocumented (G11)**, so use distinct names. |
| `userConfig.options` makes the plugin **unloadable before v2.1.271**; `claude plugin validate` MCP checks need v2.1.281; MCP `requestTimeout` needs v2.1.288; a forked skill invoked from a workflow agent returns its result to that agent only from **v2.1.295** (`plugins-reference.md`, `skills.md` L804) | **Set the minimum to Claude Code ≥ 2.1.285** (the local install). Avoid features that need 2.1.288 and 2.1.295 until they are common, in particular **don't invoke `context: fork` skills from inside workflow agents**. `/hackforge:doctor` prints `claude --version` against the floor. |
| Agent teams are experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) and use about **7× tokens** in plan mode (`costs.md` §Manage agent team costs) | Don't make agent teams the default for parallel domain builders (G5). Use worktrees (`isolation: 'worktree'`) or one session per human. |

### 3.3 G3: The usage-limit and cost envelope

**Facts:**
- Pro and Max have a **5-hour session limit and a weekly limit**. Max also has a separate weekly limit for Fable models. **Claude Code, the apps and IDE share one pool.** Hitting the limit mid-response gives a small "wrapping up" allowance: once per weekly period on Pro, at each 5-hour limit on Max. Past the limit: upgrade, enable usage credits, switch to API credits, or wait. (Anthropic Help Center, "Using Claude Code with your Pro or Max plan", fetched today; it gives no numbers.)
- Third-party estimates (**secondary, unverified**): Pro about 40–80 h per week of Sonnet in Claude Code; Max 5× about 140–280 h; Max 20× about 240–480 h. One single-source report says 5-hour limits were doubled in May 2026, and peak-hour adjustments are reported ([zenken](https://ai.zenken.co.jp/en/post/claude-usage/), [chudi.dev](https://chudi.dev/blog/claude-usage-limits), [ccclub](https://ccclub.dev/claude-code-limits)). The weekly window is **rolling 7 days from first use**, not a Monday reset.
- Team and Enterprise seats use the same 5-hour plus weekly windows, sized by seat tier (`costs.md` §Teams).
- Every workflow agent's requests count on top of the main conversation's. The "Large workflow" warning fires above 25 agents or 1.5M projected tokens (`workflows.md` §Cost). Ultracode multiplies spend (`workflows.md` L156).
- Reference costs from the reports: ECC/Anthropic GAN harness about $125–200 and 4–6 h per run (01, 02); a full Bright Data idea-validation pass about 100–200 credits, roughly $0.15–0.30 (07). **Claude tokens, not web data, are the binding cost.**

**Design consequences:**
1. **A plan-aware budget table in `rubric.json`.** Kickoff records each member's plan (Pro, Max 5×, Max 20×, Team, API) and the event length, then derives `args.size` and round caps. Starting defaults, to be tuned in a dry run:

   | Plan | ideators × judges | research subagents | demo-eval rounds per milestone | Santa rounds |
   |---|---|---|---|---|
   | Pro | 3 × 2 | 2 | 1 + final | 1 |
   | Max 5× / Team Standard | 6 × 4 | 3 | 2 + final | 2 |
   | Max 20× / API | 8 × 5 | 4 | 2 + final | 2 |

2. **Route stages to smaller models.** Use Haiku or Sonnet for SERP/scrape distillation, dedup, formatting, the de-sloppify pass and the README draft. Keep the session model (Opus) for ideation judges, the chief judge, the demo-eval judge persona and the build. Docs: workflow agents take a per-stage model (`workflows.md` §Model).
3. **Spread the windows across the team.** Each human has their own allowance. Give the research and ideation workflow to one member in hours 0–2 and the build to another, so one person's 5-hour window doesn't stall the team. Recommend that one Max member holds the build.
4. **Run `/usage` at every checkpoint** (cheap). If the weekly cap is above 70 %, shrink fan-outs and skip optional evaluators. Never enable ultracode during an event.
5. **API-key fallback.** If a team switches to API credits mid-event, workflows stop auto-pausing at limits (that is subscription-only) and costs become real dollars. `/hackforge:doctor` should show which auth mode is active (`/status`).

---

## 4. The 10 highest-leverage design decisions

Each decision cites the report or check it rests on.

**D1. The rubric is the root object, and intake is user-driven.**
- `/hackforge:kickoff` produces `.hackforge/HACKATHON.md` (the human single source of truth) and `.hackforge/rubric.json`. `rubric.json` holds criteria and weights, Stage-1 pass/fail gates, tie-break order, video limits and bans (TTS, length, ≥ 720p), prize-stacking rule, team size, licence, the pre-existing-code rule, AI-disclosure requirements, and the deadline in local time.
- Sources: 02 M1, 05 #2, 06 §2 and §13.
- Input: pasted text, or a single consented fetch of the named rules page. No crawling (§3.1).
- When an event publishes no weights, fall back to 06 §2.3's default rubric (D 25 / T 20 / I 20 / O 15 / S 10 / U 10).
- Every later artifact closes the loop against `rubric.json`: idea scores, demo script, README "Judging Highlights", deck order, Devpost headings.

**D2. A demo-first phase spine of short workflows with 3 human gates, and all state on disk.**
- Order: Kickoff → Research → Ideate → **Gate A (idea lock)** → Demo script + one-pager → **Gate B (scope lock; stack chosen only now)** → Build slices → Demo-eval → Ready → **Gate C (ship/submit)** → Pitch/Submit.
- Sources: CrafterWIKI ADR-004 (05), 01 §15, 06 §6.
- Each workflow is a bounded fan-out (C9). State lives in `.hackforge/` numbered phase files with frontmatter status, and work **resumes from the first missing file** (05: CrafterWIKI, StartupKit, planning-with-files).
- `STATE.md` (≤ 1,500 chars) is re-injected at SessionStart and PreCompact (01).
- Every workflow-backed skill has a degraded path that runs sequentially with the Agent tool, for Pro users without the `/config` toggle and for disabled workflows (§3.2).

**D3. Time and guardrails are enforced by state + hooks + monitor, not by prose.**
- **Clock:** 06's percentages: idea lock 8 %, skeleton deployed 30 %, wow 55 %, freeze 75 %, video 85 %, submitted 92 %. T-30 min is a hard floor (C10). The clock reaches Claude through a plugin **monitor** (§3.2), with an optional project status line written only with consent.
- **Five hooks** (01 §11), each with an `off`/`fast`/`safe` profile and `HACKFORGE_DISABLED_HOOKS`:
  1. `protect-judge`: blocks edits to an existing `rubric.json`, slice contracts, `tests/smoke/**` or lint configs outside the scoping phase (generalised from ECC's `config-protection.js`).
  2. `git-guard`: blocks `--no-verify`, force-push to main and `git add .env*`; runs gitleaks or a regex scan before push or deploy; blocks client-exposed keys such as `NEXT_PUBLIC_*KEY` (06).
  3. `phase-guard`: scope lock before Gate B and freeze after 75 %, applied only outside the golden-path fix list (01 + 06).
  4. Stop-time batched typecheck with a 60 s budget.
  5. State injection.
- Also a commit-cadence nudge, because ETHGlobal can disqualify a single giant commit (06).
- **Defaults** (`fast`, the profile 01 makes default): `protect-judge`, `git-guard` and state injection are on; `phase-guard` and the Stop-time typecheck run only in the `safe` profile.
- Exit 2 blocks; truncated stdin fails closed (01).

**D4. Ideation is one deterministic, fail-closed workflow, scored with a single formula.**
- Pipeline:
  1. Isolated ideators, each **assigned** a direction (sponsor-API-first, pain-first, wow-demo-first, data-first, domain-expert-first), from 01 and rajih-engine (05).
  2. A feasibility and evidence scout per candidate (03 §7: Grep MCP, DeepWiki, Context7, HF Hub).
  3. A **SERP saturation count** (§3.1).
  4. Gates G1–G6 (06 §4.1).
  5. Lens judges as one agent type with schema output and proof required (01 + §3.2 cache sharing).
  6. A bias audit and chief judge (ORCHESTRA, 05).
  7. A council on the top 3, with the orchestrator writing its pick first (ECC council, 01 and 02).
  8. Go / needs-clarification / kill, plus a `concept-anchor.json` of invariants to stop drift (spec-kit, haytham, 05).
- Scoring is 06's IdeaScore re-weighted from `rubric.json`, with 02's sponsor-EV tiebreak and **no extra demo multiplier** (C13).
- Count nulls; a lost judge means no verdict (01).

**D5. Research is time-boxed and two-provider, runs through one wrapper, and stays sandboxed.**
- Light tier by default, about 30–40 min (hyperresearch, 05). A decision spec first: "which idea do we build, and what will judges doubt?" (deepdive, 05).
- **Two complementary providers per sub-question:** Parallel keyless MCP plus `bdata search` (03, arXiv 2607.10198: union 44/100 vs best single 26/100).
- **Free first:** HN Algolia, GitHub REST, OpenAlex, HF trending (03, 07).
- All paid web access goes through one `hf-web` wrapper. It forces `--country us --language en`, caches under `.hackforge/web/`, logs to a ledger with `HF_WEB_BUDGET=150`, runs verification gates (block-page grep, per-record `.error`), and retries the `site:path "quote"` redirect failure (07 + §3.1). Discover is auto-detected; this account returns 404 (C7). Reddit goes SERP → `collect_by_url`, never keyword-Top (07).
- **Sandboxing:**
  - Research agents get a tool allowlist with no Edit, Write-outside-`.hackforge/research/`, or deploy tools. That is the prompt-injection blast radius (G10; 03 papers 2606.16821 and 2609.06027).
  - Agents return claims with evidence labels and dates, never raw payloads (02 research-ops, 07 §8.3).
  - Pitch claims need ≥ 2 independent sources (03, hyperresearch independence audit).
- Don't name anything `deep-research`; the bundled workflow exists (01, packaging).

**D6. Zero bundled MCPs, CLI-first, and opt-in pinned templates per stack.**
- Adopt ECC's two-prong connector rule (02, 03, 04): a default must be universal **and** need MCP statefulness.
- The plugin ships no `mcpServers` (C1). Kickoff writes a project `.mcp.json` only for the chosen stack, from exact-pinned templates with `${CUSTOM_VAR}` references (C4–C6).
  - Default web stack: supabase (OAuth, `project_ref`, `read_only` where possible) and vercel (OAuth).
  - Optional: chrome-devtools (isolated, telemetry off).
- Prefer official `claude-plugins-official` vendor plugins over hand-written config (04).
- Run all OAuth logins in the **minute-zero readiness gate** (`/hackforge:doctor`, 04 §13). It checks:
  - CLI logins;
  - `/mcp` OAuth;
  - the workflows `/config` toggle on Pro;
  - Claude Code ≥ 2.1.285;
  - `bdata` auth and Discover availability;
  - spend caps;
  - `.env` in `.gitignore`.
- Rely on default tool search. No `alwaysLoad`.

**D7. One golden-path script does triple duty, deployed early, with a DEMO_MODE.**
- Write `DEMO_SCRIPT.md` and the Devpost "What it does" draft **before code** (06 §7).
- Turn the script into **one Playwright file** that serves three roles (02 §3.1, 04 §9, 06 §7):
  - (a) the smoke test on every merge and against the production alias URL;
  - (b) the evaluator's runner;
  - (c) the demo-video recorder: a port of ECC `ui-demo` (Discover → Rehearse → Record, cursor and subtitle overlays, pacing).
- Deploy:
  - a **hello-world to prod in hour 1**, to prove the pipeline (04);
  - the **skeleton golden path by 30 %** (06);
  - judges always get the **production alias or custom domain**, never the deployment-hash URL (C21).
- `DEMO_MODE=1` provides seed data, guest login, and cached responses for flaky or slow calls (04, 06).
- A fake-vs-real ledger is kept current (02 M7).

**D8. Evaluation is separate, rubric-aligned, capped, and fails closed.**
- Port ECC's `orch-review` skeleton (01 §2) into `review` and `demo-eval` workflows:
  - bad args throw;
  - any dead lens forces FAIL;
  - dedup barrier;
  - verify only HIGH/CRITICAL findings;
  - proof required in the schema.
- Uncertainty policy is per dimension: security stays blocking, quality/style goes advisory (01 table, item 3).
- Three parallel lenses: golden-path runner, anti-slop design critic, skeptical judge persona scoring against `rubric.json`.
- **The evaluator never fixes**; the generator fixes in the main loop. A slice contract is written before code and protected by `protect-judge` (01 §4.4, loop-design-check).
- Caps: **2 rounds per milestone, plateau stop after 1 flat round, 1 final pass** (C15).
- The main session owns the dev server (C19).
- Run a de-sloppify pass once before Gate C (01).

**D9. A truth-grounded submission factory with dual review.**
- One `FACTS.md` / `HACKATHON.md` source feeds every artifact (02, investor-materials Golden Rule):
  - a README with a ≤ 60 s judge quickstart, **Judging Highlights** mapped to the rubric, evaluation numbers, one section per sponsor, an AI-agent disclosure (tools, what AI wrote vs humans, spec files committed; 06 §10, 12), real-vs-mocked, and TODO placeholders instead of invented facts (dontreadme, 05);
  - Devpost copy with criterion-mapped headings (06; an AI pre-screen is possible);
  - a **≤ 5-slide** HTML deck with the demo between slides and an animated fallback slide (C11; frontend-slides and beautiful-hackathon-slides);
  - a **human-narrated** video within the limit with captions (C12).
- **Santa dual review** (fact-checker plus judge persona, both must pass, ≤ 2 rounds, fresh reviewers each round) gates the deck, README, Devpost text and final checklist (01 §5).
- The final checklist covers: links tested in incognito and on mobile; video public; licence; no secrets in history; incremental commits; word limits; sponsor opt-ins within the stacking rule; Devpost duplicate check (§3.1). **Never fabricate URLs, metrics or teammates.**

**D10. Package small, name it `hackforge`, and prove it with replays.**
- One plugin, slug **`hackforge`** (C16), validated with `claude plugin validate --strict` in CI and developed with `--plugin-dir` plus `/reload-plugins` (packaging summary).
- Layout:
  - ≤ 12 skills (no `commands/`);
  - ≤ 8 agents, listed as `.md` files if declared;
  - `workflows/*.js` (auto-discovered as `/hackforge:<meta.name>`, with names distinct from skills, G11);
  - `hooks/hooks.json` in exec form with `${CLAUDE_PLUGIN_ROOT}`;
  - `monitors/monitors.json` (deadline);
  - `userConfig` (hook profile, plan tier), **without `options`** unless v2.1.271+ can be assumed.
- Minimum Claude Code version **2.1.285** (§3.2). Agent-Skills-compatible skills give a second channel (`npx skills add`, 05).
- **Self-eval before v1 (G8):** replay 3 past events whose rules and winners are public. Measure:
  - time to skeleton deploy;
  - rubric coverage of the generated README, Devpost text and deck;
  - judge-sim rank vs actual winners (Spearman);
  - token spend per plan tier against the §3.3 envelope.

---

## 5. Verify before building (short list)

1. Plugin workflow vs plugin skill with the same name: test `/hackforge:ideate` with `--plugin-dir` (G11).
2. Bright Data hosted MCP with `Authorization: Bearer ${BRIGHTDATA_API_TOKEN}` instead of `?token=` (C5).
3. Whether workflow `agent()` subagents count as **background** subagents for tool filtering and command lifetime. The docs imply yes (workflows run in the background), but don't state it (C19).
4. `experimental.monitors`: confirm a monitor's stdout really arrives as a Claude notification in CLI and Desktop on 2.1.285, and how often (§3.2).
5. Hugging Face CLI name (`hf`), to confirm C16's collision rationale.
6. Parallel keyless MCP burst limits (03), which set ideator and research concurrency.
7. ETHGlobal, MLH and Cerebral Valley rules-page ToS, under the same single-fetch policy as Devpost (§3.1).
8. Write the packaging report to disk (G4) and re-read `plugins-reference.md` at build time, since several fields are version-gated.

---

## Sources

**Claude Code docs** (fetched as markdown on 2026-10-15; copies in `scratchpad/critic/`):
- https://code.claude.com/docs/en/mcp: env expansion, credential variables that read as empty (L677–691), headersHelper env stripping (L1043).
- https://code.claude.com/docs/en/workflows: plans and Pro toggle (L10), plugin distribution (L222–226), limits (L355–367), usage-limit pause (L405–411), cost (L440–446), size guideline (L462–477).
- https://code.claude.com/docs/en/plugins-reference: `settings` keys (L144, L214), monitors (L359–389), `options` version gate (L436, L483).
- https://code.claude.com/docs/en/plugins/components: monitors behaviour (L983–1007).
- https://code.claude.com/docs/en/statusline (`refreshInterval`, project settings).
- https://code.claude.com/docs/en/skills (name resolution L200–215; forked skill in workflow, v2.1.295, L804).
- https://code.claude.com/docs/en/sub-agents (background subagents keep MCP tools, L433–444).
- https://code.claude.com/docs/en/tools-reference (background command lifetime, L180–203).
- https://code.claude.com/docs/en/costs (team windows L154; agent teams about 7×, L339).

**Devpost** (probed 2026-10-15, about 10 requests):
- https://devpost.com/robots.txt
- https://devpost.com/api/hackathons
- https://devpost.com/software/search?query=agent
- https://paypalaihackathon.devpost.com/rules
- Terms of Service §4: https://info.devpost.com/legal/terms-of-service ("Last Updated: December 5, 2025").

**Bright Data** (3 calls):
- `bdata search 'site:devpost.com meal planning app'` → `results_cnt` 2,800.
- `bdata search 'site:devpost.com/software "meal planning"'` → `redirect location was rejected`.
- `bdata discover …` → 404.

**Usage limits:**
- Anthropic Help Center, "Using Claude Code with your Pro or Max plan": https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan
- Secondary estimates: https://ai.zenken.co.jp/en/post/claude-usage/ , https://chudi.dev/blog/claude-usage-limits , https://ccclub.dev/claude-code-limits , https://leanware.co/insights/claude-max-plan

**Vercel:**
- https://vercel.com/docs/deployment-protection
- https://vercel.com/changelog/deployment-protection-is-now-enabled-by-default-for-new-projects

**Research reports cross-referenced:** `01-ecc-orchestration.md` … `07-bright-data-cookbook.md` in this directory, and the packaging summary in the brief (no file on disk).
