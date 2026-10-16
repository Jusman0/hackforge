# Timeline: prep, checkpoints, demo-first rules, team and agent protocol

Load this when you plan the event clock, set up before the start, assign roles, or decide what to cut. Checkpoint IDs, percentages and exit criteria come from DESIGN §4.1. The CLI computes due times (`hackforge checkpoint list`, `hackforge clock`). Sources: research 06 §6–7, §11–12 (primary), 04 §13, 08 §3.2–3.3. Tags: **[inference]** = our reasoning; **[unverified]** = single or secondary source.

## 1. Pre-event prep (T−7d … T−0): the minute-zero checklist

**No project code before the start** (MLH, ETHGlobal and Anthropic rules). Accounts, logins, tooling, public boilerplate and HackForge itself are fine, as long as you disclose them in the README's AI/tooling section (08 C23). A human creates every account and runs every login. HackForge never signs in for you (DESIGN §7).

| Area | Do before the clock starts | Check |
|---|---|---|
| Accounts | Claude Pro/Max/Team (Claude in Chrome needs a direct plan, not API-key auth). Anthropic Console with prepaid credits. GitHub. Vercel linked to GitHub. A Supabase org. Create stretch accounts (Stripe sandbox, fal, ElevenLabs, HF, Modal, Expo, Clerk) only if the idea needs them | Each login works |
| Spend caps | A cap or budget alert on **every** paid API. Stripe in sandbox only | Cap visible in each console |
| Toolchain | Node 22 LTS (HackForge needs ≥ 18; the `ctx7` CLI needs ≥ 22.13), Python 3.12+ and `uv`, Chrome, `ffmpeg`, `gh`, `npm i -g vercel @playwright/cli`, `npx playwright install chromium` | `hackforge doctor --probe` |
| CLI logins | `gh auth login`, `vercel login`, `npx supabase login`, plus `stripe login`, `ant auth login` or `modal setup` as relevant. `/login` inside Claude Code | `gh auth status`, `vercel whoami` |
| Claude Code | `claude --version` ≥ 2.1.285. **On Pro, turn on Dynamic workflows in `/config`.** Without it, skills fall back to the sequential Agent-tool path, and Pro's size guideline is `small`. Run `/mcp` OAuth now for every MCP you plan to use (`hackforge mcp web` prints the add commands). Don't leave OAuth hops for mid-event | `hackforge doctor` |
| Throwaway deploy | A hello-world in a **separate repo**: `npx create-next-app@latest warmup --yes && cd warmup && vercel --prod`. This proves the pipeline and warms the npm/npx cache for venue Wi-Fi | Production alias loads in incognito |
| Supabase | Free projects **pause after 7 days of inactivity** ([docs](https://supabase.com/docs/guides/platform/free-project-pausing)). Create the project on the day, or unpause it that morning. Plan to turn off "Confirm email", or use OAuth or anonymous sign-in, because the built-in SMTP is rate-limited [unverified] | Project shows as active |
| Secrets | Add `.env*` to `.gitignore` **before the first commit**. Commit `.env.example` with names only. `.mcp.json` uses `${VAR}`. No client-exposed keys (`NEXT_PUBLIC_*KEY`) | `hackforge secrets --tracked` exits 0 |
| Rules | Paste the rules, or name the one rules URL and consent to a single fetch (Devpost ToS §4 forbids scraping). Capture: video limit and host, pre-existing-code rule, required sponsor tech, prize stacking, team max, deadline in local TZ | `rubric.json` and `HACKATHON.md` at kickoff |
| Recording | OBS, QuickTime or Cap installed. Test the team's best microphone | A 10 s test clip plays back |

### Claude usage windows (the budget that binds; 08 §3.3)
- Pro and Max have a **5-hour window and a weekly cap**. Claude Code, the apps and Desktop share one pool, and Anthropic publishes no numbers ([help](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)). A 24 h event spans about 5 windows. Web credits cost far less than Claude tokens.
- **Send distillation to cheaper models.** Use Haiku or Sonnet for SERP and scrape distillation, dedup, formatting and README drafts. Keep the session model for judges, the build and the demo-eval persona.
- **Spread usage across teammates.** Each human has their own allowance. One member runs research and ideation in hours 0–2. Another runs Track B (§4) and then holds the build (a Max seat if you have one).
- Size fan-outs by plan: Pro → `scale: "small"`, Max or Team → `"medium"` [inference from 08's plan table]. Check `/usage` at every checkpoint. Above about 70 % of the weekly cap, shrink fan-outs and skip optional evaluators.
- **Never turn on ultracode during the event.** It multiplies spend. Run workflows interactively: pause-and-resume at the usage limit works only in interactive subscription sessions on v2.1.271+, not in `claude -p` or the SDK.
- If you switch to API credits mid-event, spend is real dollars and workflows no longer auto-pause at limits.

## 2. Checkpoint clock (DESIGN §4.1)

Mark each checkpoint done with evidence: `hackforge checkpoint <ID> --done --url "<url>" --note "<proof>"`. `custom` events use the 24h percentages. SUBMITTED is due at min(pct, deadline − 30 min). The hour-1 hello-world deploy proves the pipeline. SKELETON_DEPLOYED proves the golden path. Both are required (08 C10).

### 24h
| ID | % | ≈T+ | Work in the window before it | Exit criteria |
|---|---|---|---|---|
| (kickoff) | 0–3 | 0:00–0:45 | `/hackforge:kickoff` → rules, rubric, doctor. Hello-world prod deploy. Name the presenter | `state.json`, `rubric.json`, `HACKATHON.md` |
| IDEA_LOCK | 8 | 1:55 | `/hackforge:research` (light tier, about 30–40 min), then `/hackforge:ideate` (8 / 12 / 24 candidates at small / medium / large → gates → top 3) | Gate A locked, `ideas/IDEA.md` |
| SPEC_LOCK | 12 | 2:53 | `/hackforge:spec`: 90 s demo script, Devpost "What it does" draft, slices, stack, fake-vs-real | Gate B locked, DEMO_SCRIPT + SLICES |
| SKELETON_DEPLOYED | 30 | 7:12 | Golden path stubbed end to end, deployed, smoke test written | Public prod URL returns 200, no auth wall, golden-path smoke green |
| WOW_WORKS | 55 | 13:12 | The aha and the hard part with real input. Fixtures. Record a backup run. `/hackforge:judge`. Decide the cut list | Aha works with real input, fallbacks in place, judge-panel run |
| FEATURE_FREEZE | 75 | 18:00 | Depth: eval number on screen, sponsor tech visible, polish on the demo path only | Only golden-path fixes after this |
| VIDEO_DONE | 85 | 20:24 | Record the golden path, human narration, captions, upload, test logged out | Public video URL within the limit |
| SUBMITTED | 92 | 22:05 | `/hackforge:ship`: README, Devpost, screenshots, AI disclosure, sponsor sections. A human submits | Checklist 100 %, Gate C locked |
| (after) | 92–100 | → 24:00 | Rehearse ×3 (once to an outsider), Q&A drill, backup video on local disk, fixtures ready for a Wi-Fi failure | — |

### 48h (exit criteria as in the 24h table)
| ID | % | ≈T+ | Notes |
|---|---|---|---|
| IDEA_LOCK | 8 | 3:50 | Research goes deeper: talk to sponsor reps, gather domain documents and datasets, collect real user quotes |
| SPEC_LOCK | 12 | 5:46 | A spec per domain (Wrench Board pattern). A ticket list (Tekton used about 50) |
| SKELETON_DEPLOYED | 25 | 12:00 | Then sleep block 1 (≥ 4 h). Agents can run long, safe tasks on branches overnight. **Never merge to main unattended** |
| WOW_WORKS | 50 | 24:00 | Judge panel and cut list |
| FEATURE_FREEZE | 75 | 36:00 | Depth, eval and sponsor work in 24–36 h, including sleep block 2 |
| VIDEO_DONE | 85 | 40:48 | — |
| SUBMITTED | 92 | 44:10 | Then rehearse, keep a backup, drill Q&A |

### Week (5–8 days; times shown for a 7-day / 168 h clock)
| ID | % | ≈T+ | Notes |
|---|---|---|---|
| IDEA_LOCK | 8 | 13 h (day 1) | — |
| SPEC_LOCK | 20 | 34 h (day 2) | Days 1–2 are spec and plan. Maieutic spent 2 days on specs. ARIA spent a planning day with a GitHub board |
| SKELETON_DEPLOYED | 35 | 59 h (day 3) | — |
| WOW_WORKS | 55 | 92 h (day 4) | Days 2–4: parallel domain sessions (Medkit ran 4; Wrench Board ran 5–6 agents) |
| FEATURE_FREEZE | 78 | 131 h (day 6) | Days 4–5: audit and eval before any new feature (ARIA) |
| VIDEO_DONE | 88 | 148 h (day 7) | Keep the final day for the video only. Anthropic winners say it takes longer than you expect |
| SUBMITTED | 93 | 156 h (day 7) | About 12 h before the deadline |

`hackforge clock` modes: **crunch** (behind schedule: SKELETON_DEPLOYED or WOW_WORKS is overdue before FEATURE_FREEZE): cut to the golden path and deploy now; no new slices. **frozen** (after FEATURE_FREEZE): `guard-edits` reminds you (fast profile) or asks (safe profile) before non-golden-path edits. **final** (after VIDEO_DONE): submission work only.

## 3. Demo-first rules (06 §7, 08 D7)

1. **The demo script is the spec.** Write `spec/DEMO_SCRIPT.md` and the Devpost "What it does" draft before any code. Anything off the golden path is out of scope until WOW_WORKS.
2. **One golden path.** One scripted journey, ≤ 3 features, real-looking seed data. Copy demo inputs to the clipboard in advance, and never create an account on stage.
3. **`DEMO_MODE=1`** loads seed data, logs in a guest user (no auth wall), and serves cached responses for slow or flaky calls (no dead air).
4. **Deploy early.** Hello-world in hour 1, skeleton by its checkpoint. OpenAI and Docusign rules require working test access.
5. **Main stays demo-safe.** Risky work happens on branches or worktrees. Merge only when the golden-path e2e is green.
6. **The golden-path e2e** (`e2e/golden-path*` or `tests/golden-path*`, protected by `guard-edits` after Gate B) runs on every merge **and against the production alias**. The same script drives the video recording.
   ```bash
   BASE_URL="$PROD_URL" npx playwright test tests/golden-path.spec.ts   # templates/tests/playwright.config.ts reads BASE_URL; use e2e/ if your testDir is there
   ```
7. **Recorded backup.** Record a clean run when WOW_WORKS passes and again at FEATURE_FREEZE. Keep it on local disk for the live pitch.
8. **Don't show what doesn't work.** The rules require the project to work as shown in the video (OpenAI and Docusign "Functionality"). Mock only non-core dependencies, and keep `spec/FAKE_VS_REAL.md` current.

**Vercel: give judges the production alias, never the hash URL.** Deployment Protection has been on by default for new projects since Nov 2023. Standard Protection covers preview URLs **and deployment-specific production URLs**. Only the current production domain or alias is public ([docs](https://vercel.com/docs/deployment-protection), [changelog](https://vercel.com/changelog/deployment-protection-is-now-enabled-by-default-for-new-projects)). The `app-<hash>.vercel.app` URL that `vercel --prod` prints can be login-walled. Put the alias or a custom domain everywhere (`hackforge state set stack.prodUrl "<alias>"`, README, Devpost), and open it in incognito. Missing prod env vars are the most common broken-demo cause, so run `vercel env ls` before demo time [unverified, 04].

## 4. Multi-human team protocol (2–4 people, each running Claude)

| Role | Owns | Team of 2 / 3 / 4 |
|---|---|---|
| **Driver** | The core engine and the hard-part slices, in its own domain files | 2: driver + integrator · 3: own person · 4: own person (or 2 drivers on separate domains) |
| **Integrator** | `main`, deploys, the production alias, shared files (package manifest, lockfile, schema), all `hackforge gate` / `checkpoint --done` / `state set` writes | 2: with driver · 3: with researcher · 4: own person |
| **Demo-owner** (presenter) | `spec/DEMO_SCRIPT.md`, the golden-path e2e, the video, the pitch, rehearsal. Named at kickoff, chosen for clarity, not seniority | 2: with researcher · 3–4: own person |
| **Researcher** | Research, `ship/FACTS.md`, sponsor write-ups, README and Devpost text, the Q&A drill | 2: with demo-owner · 3: with integrator · 4: own person |

- **Track B, hours 0–3 (teammate 2, usually the integrator), while teammate 1 runs research and ideation:** create the public event repo and hello-world deploy it to its production alias, then `hackforge state set stack.prodUrl "<alias>"`. Install Playwright (`npm i -D @playwright/test && npx playwright install chromium`). Smoke-test every sponsor and model API key with one call each (keys in `.env`, never printed or committed). Solo? Do Track B while the research workflow runs.
- **File ownership.** Each domain owns a disjoint set of paths, listed per slice in `spec/SLICES.md` and recorded in `state.json` `team.domains`. To change someone else's file, ask its owner. Overlapping writes are the classic failure (01 §9).
- **Share `.hackforge/` through git.** Commit it, except `web/`, `dev.*` and `nudge.json`. Pull before you run any phase skill. Only the integrator writes `state.json`, which avoids merge conflicts [inference]. Everyone else writes their own feedback and draft files.
- **Merge only on a green golden path.** Nobody pushes straight to `main` after SKELETON_DEPLOYED.
- **One Claude session per domain, each in its own worktree** (Medkit ran 4 sessions to keep contexts clean): `git worktree add "../app-ui" -b ui`. Agent teams are experimental and use about 7× the tokens, so don't make them the default (08 G5).
- **Sync at every checkpoint:** a 5-minute stand-up around `hackforge status`. Agree the cut list, check `/usage`, and reassign usage windows.
- **Commit small and often.** ETHGlobal may disqualify a history that is one giant commit.

## 5. AI-agent operating model (06 §12, 01 §4)

1. **Spec, then plan, then code.** `/hackforge:spec` runs before `/hackforge:build`. Choose the stack only after the demo script is approved (Wrench Board, Maieutic, CrafterWIKI ADR-004). Push back on the model during brainstorming.
2. **Parallel domain sessions.** Run 2–4 builders, each with its own slice contract. `build-sprint` with `mode: "parallel"` uses worktrees plus an integrator merge gated on the golden path.
3. **Eval first.** Write the golden-path e2e and the quality metric before features (MaestrIA, Medkit's agentic grader). Put the number on screen.
4. **Audit before the next feature.** After each slice, have an agent audit what exists against `DEMO_SCRIPT.md` before you start the next one (ARIA).
5. **A separate verifier.** The builder never grades its own work. `qa-runner` and `judge` run in isolated contexts (Tekton). The cap is 2 rounds per milestone, with a plateau stop after 1 flat round and 1 final pass before Gate C. The builder never edits acceptance tests.
6. **Own the core 20 %.** Humans read and can whiteboard the differentiating logic. Keep a human-owned file list of it for Q&A (Masai). Humans also own the idea, domain truth, narration and the final submit click.
7. **The main session owns the dev server** (`hackforge dev up`). Evaluators only health-check it (08 C19).

## 6. Failure modes → mitigations

| Failure | Evidence | Mitigation |
|---|---|---|
| Scope creep | Teams reach about ¼ of their ambitions (BuilderBase) | After Gate A, scope can only shrink. Cut list at WOW_WORKS. FEATURE_FREEZE + `guard-edits` |
| Broken live demo | Untested demos crash on stage. Live API with no fallback | Golden-path e2e on every merge and against prod. `DEMO_MODE` fixtures. Local backup video |
| Localhost only | Judges may use only the link and the video (OpenAI) | Hello-world in hour 1. SKELETON_DEPLOYED checkpoint |
| Auth wall / login-walled URL | Rules require free test access (OpenAI). Vercel protects hash URLs | Guest mode by default. Test credentials in the submission form, not the README. Production alias, checked in incognito |
| Exposed keys | 23.8M secrets leaked on public GitHub in 2024 ([GitGuardian](https://blog.gitguardian.com/the-state-of-secrets-sprawl-2025/)) | `.env*` gitignored from minute 0. `git-guard` scans commits and pushes. Model calls go through a server-side proxy. Spend caps. **Rotate every key after the event** |
| Credits or usage cap hit mid-event | Live LLM calls; shared 5-hour and weekly pools [inference] | Cached demo responses. A provider fallback. Cheaper models for distillation. Spread windows across teammates. No ultracode |
| Venue Wi-Fi fails | AngelHack tip 10 | Local fixtures, phone hotspot, offline backup video |
| Can't explain AI-written code | Judges probe the differentiator (Masai) | A human-owned core 20 %. Rehearse `build/QA_DRILL.md` |
| Dead air from slow agents | AngelHack | Pre-computed or streamed results. Progress UI |
| Video late, private or over the limit | No extensions at some events. Judges stop at 3:00 (OpenAI) | VIDEO_DONE at 85 %. Length check. Logged-out link test |
| Rules violation (pre-existing code, one giant commit, no licence, required API missing) | MLH, ETHGlobal, Anthropic, OpenAI rules | `rubric.json` gates. Small, frequent commits. Ship checklist before Gate C |
| Generic pitch, no named user | Masai; DEV | Gate G5 and factor P in IdeaScore. Named user in the first 10 s |
| Too many features in the demo | Devpost | ≤ 3 features on the golden path. Everything else goes to "What's next" |
| No dedicated presenter | Masai; AngelHack | Name the demo-owner at kickoff |
