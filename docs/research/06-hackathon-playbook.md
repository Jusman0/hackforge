# 06 — Hackathon Winning Playbook (AI/software hackathons, 2025–2026)

> Research brief for HackForge. Scope: 24–48h (plus week-long virtual) AI/software hackathons, teams of 1–4 using AI coding agents.
> Compiled 2026-10-15. Sources are cited inline. Items marked **[secondhand]**, **[unverified]** or **[inference]** should be treated with lower confidence. Anything older than 2025 is marked **[older]**.

---

## 0. TL;DR — the 12 rules HackForge should hard-code

1. **Parse the rubric before you pick the idea.** Published rubrics vary a lot. Anthropic weights the demo at 30%. Devpost sponsor events weight four criteria equally. MLH explicitly does *not* judge the pitch or the idea. One generic strategy loses points everywhere (§2).
2. **Pass the hidden gates first.** Many events have a pass/fail "Stage One" (theme fit plus *required sponsor API used*) before any scoring. Some judges never run your app and judge only the video and text (§2.4).
3. **Narrow user, real pain, quantified.** 2026 winners are domain experts solving a specific workflow, for example "California permit rejections cost about $30k and six months" (CrossBeam) or "weeks become 5 hours" (TARA). They are not general assistants (§3).
4. **Keep the core deterministic and put AI at the interpretation layer, with visible evidence.** Winners show pitch curves, 3D reconstructions, graphs and source-linked citations rather than chat bubbles. A human approves the consequential steps (§3.2).
5. **Generic "AI chatbot for X", chat-with-PDF, frontend-only wrappers, todo/notes apps and "dashboard that shows data" are fatigue categories.** Avoid them unless you have a sharp, narrow angle (§3.3).
6. **Write the demo script (and Devpost story) before writing code.** Build only the golden path the demo walks (§7).
7. **Deploy a walking skeleton by about 30% of the clock.** No deploy, auth walls and live-API-only paths are the top demo killers (§6, §11).
8. **Feature freeze at about 75% of the clock. Record the video by about 85%. Submit by about 92%.** Devpost and MLH both say to leave 2–3 hours for video and submission. Anthropic winners say the video takes longer than you expect (§6).
9. **The demo video is 2–3 minutes: hook, problem, demo (about half the runtime), hard part, impact.** Narrate in your own voice. ETHGlobal rejects AI voiceovers and sped-up footage (§8).
10. **Make sponsor tech load-bearing, not logo-stuffed.** Check the stacking rules. OpenAI Build Week allowed one prize per project, Docusign allowed several, and ETHGlobal allows up to 3 partner prizes, each with its own write-up (§5).
11. **Disclose AI use, show *how* you orchestrated it, and own the core 20% of logic you can explain under Q&A.** Sponsors now *score* agent use: Anthropic gives 25% to model use, and OpenAI's README must describe the Codex collaboration (§12).
12. **Protect secrets and commit history.** Use .env files, gitignore and a pre-commit secret scan. Commit often, because ETHGlobal may disqualify projects whose history is one big commit (§11).

---

## 1. Evidence base

| Source | Type | Date | Used for |
|---|---|---|---|
| MLH Standard Hackathon Rules — https://github.com/MLH/mlh-policies/blob/master/standard-hackathon-rules.md | Official rules | current | 4 equal criteria, what is NOT judged, AI disclosure, ≤2-min video |
| MLH Organizer Guide, Judging Plan — https://guide.mlh.com/general-information/judging-and-submissions/judging-plan | Official guide | 2026 season | 4 min/project, 3 judges/project, stack-ranking |
| Built with Opus 4.6 rules (copy in a winner's repo) — https://huggingface.co/datasets/introvoyz041/postvisit/blob/main/data/docs/hackathon-rules.md **[secondhand]** | Rules | Feb 2026 | Demo 30 / Impact 25 / Opus use 25 / Depth 20 |
| Anthropic, "Meet the winners… Opus 4.6" — https://claude.com/blog/meet-the-winners-of-our-built-with-opus-4-6-claude-code-hackathon | Official recap | Apr 20 2026 | Winners and how they built |
| Anthropic, "Meet the winners… Opus 4.7" — https://claude.com/resources/articles/meet-the-winners-of-built-with-opus-4-7-claude-code-hackathon | Official recap | Jun 15 2026 | Winners and agent workflows |
| Anthropic, "Opus 4.8 Build Day" winners — https://claude.com/resources/articles/meet-the-winners-of-our-claude-opus-4-8-build-day-hackathon | Official recap | Jun 17 2026 | 12-hour event winners |
| OpenAI Build Week Official Rules (Devpost) — https://openai.devpost.com/rules | Official rules | Jul 2026 | Stage-1 gate, 4 equal criteria, README/Codex requirements, 1 prize/project |
| Remio analysis of OpenAI Build Week winners — https://www.remio.ai/post/openai-build-week-winners-show-what-codex-can-build-beyond-demos | Analysis | Sep 2026 | 8 winners and their patterns |
| Docusign "Unlocked" rules (Devpost) — https://unlocked.devpost.com/rules **[older: Nov 2024–Jan 2025]** | Official rules | 2024–25 | Devpost 4×25% template, multi-prize allowed |
| ETHGlobal event details — https://ethglobal.com/events/scaling/info/details | Official rules | 2026 | 3 partner prizes, 7-min finalist format, video rules, AI-use rules, commit-history rule |
| Devpost blog: demo video tips — https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video | Platform guidance | current | Video timing and structure |
| Devpost blog: presenting a demo — https://info.devpost.com/blog/how-to-present-a-successful-hackathon-demo | Platform guidance | current | Verbal demo structure |
| AngelHack, "10 Hackathon Demo Tips" — https://angelhack.com/blog/10-tips-to-help-you-rock-your-next-hackathon-demo/ | Organizer guidance | updated Aug 25 2026 | 3-min timing split, AI-specific pitch tips, Q&A list |
| BuilderBase Hackathon Playbook Ch.15 (organizer) — https://intercom.help/builderbase/en/articles/14831464-hackathon-playbook-ch-15-judging-rubrics and Builder's Guide Ch.15 — https://intercom.help/builderbase/en/articles/14836129-builder-s-guide-ch-15-how-judging-works | Organizer guidance | Apr 2026 | Judging formats, sample weights, the "teams reach about ¼ of ambitions" heuristic |
| 36Kr on Affaan Mustafa (ECC author) win — https://eu.36kr.com/en/p/3823966768943239 ; ECC `the-shortform-guide.md` | Press / repo | 2025–26 | Prepared-harness advantage |
| Kotrotsos, "Anthropic Hackathon results" — https://kotrotsos.medium.com/anthropic-hackathon-results-b13f8466296e | Opinion | Mar 1 2026 | 13k applicants / 500 in; domain experts won |
| Masai School guide — https://www.masaischool.com/blog/how-to-win-an-ai-hackathon-in-2026-full-guide/ **[marketing; unsourced claims]** | Blog | Sep 2026 | Failure modes, "own the 20%" |
| Reskilll, "Ideas that won in 2026" — https://blogs.reskilll.com/hackathon-ideas-that-won-2026-judges-actually-pick-examples/ **[platform blog, India-centric]** | Blog | Aug 2026 | Fatigue list |
| DEV, "What AI hackathon winners have in common" — https://dev.to/jsb-securedme/what-ai-hackathon-winners-actually-have-in-common-1kla | Blog | Jul 2026 | Five pre-submit questions |
| Reddit r/hackathon "won 6 hackathons…" — https://www.reddit.com/r/hackathon/comments/1mq2mv5/ ; r/csMajors chat-wrapper rant — https://www.reddit.com/r/csMajors/comments/1fsxmdv/ **[older: 2024]** | Community | 2024–25 | Optimize for judges; wrapper fatigue |
| GitGuardian State of Secrets Sprawl 2025 — https://blog.gitguardian.com/the-state-of-secrets-sprawl-2025/ | Industry report | Mar 2025 | Secret-leak base rates |
| Gemini 3 Hackathon weights via reprint — https://frontlinesmedia.in/gemini-3-hackathon-2026-build-whats-next-with-google-deepmind/ **[unverified reprint]** | Reprint | 2026 | 40/30/20/10 weighting |
| ECC local clone: `skills/ui-demo`, `skills/product-lens`, `skills/frontend-slides`, `skills/orch-build-mvp`, `the-shortform-guide.md` | Harness | 2026 | What to adapt |

---

## 2. How judging actually works

### 2.1 Formats you will meet

| Format | Time you get | Who sees it | Source |
|---|---|---|---|
| **Science fair / expo** (MLH default) | About 4 min per judge visit: **2 min demo, 1 min Q&A and scoring, 1 min judge travel**. Each project is seen by **at least 3 judges**. | Rotating judges, each reporting a top-3 that is stack-ranked (3/2/1 points) | MLH Judging Plan |
| **Finalist stage on a main stage** | MLH: about 7 min (3–5 presenting plus setup). ETHGlobal: **4 min demo + 3 min Q&A** | Full panel | MLH; ETHGlobal |
| **Async video review** (virtual Devpost / Cerebral Valley) | Video **≤2 min (MLH digital), <3 min (OpenAI, Anthropic; OpenAI says judges need not watch past 3:00), 2–4 min (ETHGlobal), <5 min (older Devpost sponsor events)** | Judges may **never run your app**: OpenAI and Docusign rules say judges may score only on text, images and video | OpenAI rules; Docusign rules |
| **Two-stage** (30+ teams) | Stage 1 async scoring, then top-N present live (Anthropic: top 6 present pre-recorded 3-min demos, then deliberation) | Panel | BuilderBase; Opus 4.6 rules [secondhand] |

**Implication for HackForge:** the same project needs three artifacts tuned to these formats: a 2-minute live table demo, a 3-minute video, and a written submission that stands alone. Treat all three as first-class deliverables, not end-of-event chores.

### 2.2 Published rubrics (real weights)

| Event / template | Criteria and weights | Notes |
|---|---|---|
| **MLH Standard Rules** | Technology 25 · Design 25 · Completion 25 · Learning 25 (equal) | MLH explicitly does **not** judge code quality, **pitch quality**, idea originality or real-world usefulness. Digital events: ≤2-min video that states the hackathon name at the start. AI tools must be disclosed. |
| **Devpost sponsor template** (Docusign 2024–25 **[older]**; same 4 headings in GitLab, Slack, DigitalOcean and Google Cloud 2025–26 rules pages) | Technological Implementation 25 · Design 25 · Potential Impact 25 · Quality of the Idea 25 | "Tech" includes *thoroughly leveraging the required tool*. "Design" means a balanced blend of front end and back end. |
| **OpenAI Build Week (Jul 2026)** | **Stage 1 pass/fail**: theme fit and required APIs. **Stage 2**, equally weighted: Technological Implementation (how skillfully Codex was used; a non-trivial working implementation) · Design (a *complete, coherent product experience, not just a proof of concept*) · Potential Impact (a credible, specific real problem for a real audience, *as demonstrated*) · Quality of the Idea (novel, different from existing concepts) | Ties are broken by the **first criterion listed**. Judging may include **automated AI-driven analysis**. README must explain the Codex collaboration and include a Codex session ID. **Each project is eligible for one prize.** |
| **Anthropic "Built with Opus 4.6" (Feb 2026)** **[secondhand]** | **Demo 30** (works, holds up live, engaging) · **Impact 25** (real-world potential, fit to a problem statement) · **Opus 4.6 use 25** (creative use beyond basic integration) · **Depth & execution 20** (iterated past the first idea; sound engineering) | Everything shown must be open source. Start from scratch. Teams of up to 2. 3-min video. 100–200-word summary. Six Claude Code team judges. Side prizes: "Most Creative Exploration" and "Keep Thinking" (iterated well past the obvious idea). |
| **ETHGlobal finalists (2026)** | Technicality · Originality · Practicality · Usability (UI/UX/DX) · **WOW factor** | Video 2–4 min, ≥720p. **No TTS/AI voiceover, no sped-up footage, no phone recording, no music-plus-captions-only videos.** Slides ≤4 bullets each. |
| **Gemini 3 Hackathon (2026)** **[unverified reprint]** | Technical Execution 40 (incl. Gemini usage) · Innovation/Wow 30 · Potential Impact 20 · Presentation 10 | 3-min video. About 200-word description. |
| **BuilderBase example (Apr 2026)** | Innovation 25 · Technical 25 · Impact 20 · Presentation 15 · Design/UX 15 | Organizers are told to judge **what was built, not what was planned**. Teams typically reach about ¼ of their ambitions. |
| Masai blog, "unnamed Devpost AI rubric" **[unverified]** | Innovation ~20 · Technical ~25 · Impact ~25 · Presentation ~20–30 | Use only as a sanity check. |

### 2.3 HackForge Default Judge Rubric (use when the event publishes none)

Built by aligning the rubrics above. "Demo works" is the one thing every rubric rewards, explicitly (Anthropic Demo 30, MLH Completion 25) or implicitly (OpenAI "as demonstrated", BuilderBase "judge what was built").

| # | Criterion | Weight | 1 (weak) | 3 (meets) | 5 (exceptional) |
|---|---|---|---|---|---|
| D | **Working demo & completeness** | **25** | Slides or a mock; crashes | Golden path works with some rough edges | Works live on the first try with real input, holds up to a judge's own input, and is deployed |
| T | **Technical depth & execution** | **20** | API call plus UI | One non-trivial component | A hard part that is clearly narrated (multi-agent orchestration, eval loop, real-time engine, vision pipeline), and the team iterated past v1 |
| I | **Impact (specific user, credible)** | **20** | "Everyone" | Named user segment | Named user, quantified pain (time/$), today's workaround, and before/after shown in the demo |
| O | **Originality / quality of idea** | **15** | Fatigue category | Fresh angle on a known problem | Non-obvious capability ("didn't know models could do that") |
| S | **Required-tech / sponsor use** | **10** | Logo-stuffing | Integrated | Load-bearing and creative; the demo collapses without it |
| U | **Design/UX & clarity** | **10** | Confusing | Clean | A judge outside the domain can restate what it does after 1 minute |

**Re-weighting rule:** when an event publishes weights, `/hf:rules` overwrites this table. Examples: Anthropic-style → D 30, I 25, S 25, T 20, O 0, U 0. MLH → T 25, U 25, D 25, plus "Learning" 25 (mention what you learned in the README and pitch), with pitch effort cut to the minimum.

### 2.4 Hidden factors that decide outcomes

- **Stage-1 gates are pass/fail.** If the required sponsor API isn't visibly used, the project is never scored (OpenAI rules).
- **Tie-breaks follow the criterion order.** OpenAI breaks ties on the first listed criterion (Technological Implementation), so that one is worth over-indexing on.
- **Judges may never open your app.** Text, images and video must carry the case on their own (OpenAI and Docusign rules). An LLM may pre-screen submissions ("automated AI-driven analysis", OpenAI rules), so the submission text should **map explicitly to each criterion with matching headings**.
- **Volume and fatigue.** Judges reportedly see 30–100 demos a day **[unverified; Masai]**, and MLH judges get about 2 minutes per team. The first 30 seconds and one memorable moment matter disproportionately (AngelHack tip 7).
- **Know the judges.** Judges may be non-technical (Reddit "won 6 hackathons"). Anthropic's Opus 4.6 judges were the Claude Code team itself, who will notice shallow model use.
- **Sponsor reps judge their own prizes.** At ETHGlobal the prize write-up is the *only* way a partner assesses you. MLH category awards are often judged by 1–2 subject-matter experts (MLH Judging Plan).

---

## 3. What wins at AI hackathons now

### 3.1 2025–2026 winners (primary sources)

| Event | Winner | What it is | Why it worked (pattern tags) |
|---|---|---|---|
| Anthropic Built with Opus 4.6 (Feb 2026, 13k applicants → 500 builders, 1 week) | **CrossBeam** — Mike Brown, personal-injury lawyer | Fixes CA housing-permit submissions; municipalities batch-process and draft correction letters | Domain expert · quantified pain (90%+ first-pass rejection, about 6 months, about $30k) · parallel subagents plus spatial index · Claude wrote the tests |
| ″ | **Elisa** — Jon McBee (2nd) | Block-based visual IDE for kids; AI writes code, and a teaching engine explains it | Meta-planner → task graph → agents; 1,500+ tests in 30 h |
| ″ | **PostVisit.ai** — cardiologist (3rd) | Explains diagnoses and visit notes with evidence, under physician oversight | Domain expert · human-in-loop |
| ″ | **TARA** — Uganda road technician ("Keep Thinking") | Dashcam footage → full road-investment appraisal (NPV, sensitivity, PDF) | Vision · deterministic finance core · weeks → about 5 h |
| ″ | **Conductr** (Creative) | Real-time AI bandmate from MIDI chords | C→WASM engine at 15 ms ticks; a performance you can feel |
| Anthropic Built with Opus 4.7 (Apr 2026, 20k+ applicants, 5 days) | **Medkit** — physician-turned-engineer | Gamified clinic sim for residents; an **agentic grader scores against clinical guidelines** | 4 parallel Claude Code sessions, one per domain · eval built in · pilots lined up |
| ″ | **Wrench Board** — electronics repairer | Schematic plus boardview → diagnostic agent that iterates hypotheses | Spec plus plan per domain · **5–6 parallel agents** · brainstorm-then-plan skills (Superpowers) |
| ″ | **Maieutic** — CS lecturer | IDE that makes students write a spec first; "Intent-Diff Review" | 2 days of spec before code |
| ″ | **MaestrIA** — 20-year-old non-programmer ("Keep Thinking") | Photo/voice → home-repair diagnosis, budget, tradesperson, WhatsApp draft | Father's carpentry knowledge as JSON · **eval first, features after** |
| ″ | **ARIA** (Best Managed Agents) | Manufacturer PDF → 5 agents monitor signals and emit work orders | A planning day plus GitHub board · "audit before the next feature" |
| Anthropic Opus 4.8 Build Day (Jun 2026, 12 h, 310 builders) | **Tekton** | 3D reconstruction of historic buildings; every component cites its source | PRD plus ~50 tickets in parallel · **verifier subagents in isolated contexts** · self-correct until 20 tests pass |
| ″ | **Sim Francisco** | 10k synthetic SF residents from Census data; forecasts matched real votes within a few points | **Backtested numbers on screen** · clustering cut inference cost 10–100× |
| ″ | **Custom Universe** | Phone photo → editable photoreal 3D object | Claude researched which models to use and ran a remote H100 |
| OpenAI Build Week (Jul 2026, ~47k builders, 8k+ projects, 8 days) | Mechanica · Dấu · **veTriage** (veterinarian) · **Pulse** (cardiologist) · Second Voice · AirBridge · Echo Canvas · Sentinel | Museum of ancient machines; Vietnamese tone coach with pitch curves; vet phone triage; cardiac-arrest tracking from code-switched Arabic speech; dysarthria communication aid; MCP security scanner | Narrow user · deterministic core plus AI interpretation · human approval · visible evidence · explicit safety boundaries (Remio analysis) |
| GitLab AI Hackathon 2026 | LORE (Grand) · Gitdefender · GraphDev | Senior-engineer knowledge retention (8 agents plus dashboard); auto-fix security in code review; code-relationship graph over time | Real workflow agents with visual output |
| Anthropic × Forum Ventures (Sep 2025, 1 day) | **Zenith / PMF Probe** — Affaan Mustafa (ECC author) and David Rodriguez | Synthetic customer-discovery interviews → validation loop | **10 months of pre-built Claude Code harness**; almost no hand-written code (36Kr; ECC `the-shortform-guide.md`). Sources disagree on the venue (NYC vs Silicon Valley). |

### 3.2 Ten patterns HackForge's idea engine should reward

1. **Domain-expert pain.** Four of the five Opus 4.6 winners were not professional developers (Anthropic). Domain experts also won in Opus 4.7 and in OpenAI Build Week (veterinarian, cardiologist). For HackForge, the research phase should *manufacture* domain depth: real forms, regulations, datasets, workflows and numbers.
2. **A narrow user, task and environment.** This makes output quality judgeable (Remio).
3. **A deterministic core with AI at the interpretation layer.** Measurement, geometry, finance and policy live in code. The model translates, explains, plans or perceives (TARA, Dấu, veTriage).
4. **Visible evidence, not chat text.** Pitch curves, 3D, graphs, source-linked citations, generated PDFs. Demos that make an abstract model *feel physical* persuade (DEV article; Conductr, Tekton, Mechanica).
5. **Human approval at consequential moments** (Second Voice, PostVisit, veTriage).
6. **Multi-agent orchestration with verification.** Parallel domain agents (Wrench Board), parallel subagents per correction (CrossBeam), verifier subagents in isolated contexts (Tekton), agentic graders (Medkit). This matches Anthropic's "creative model use" and "depth" criteria.
7. **Eval-first, with numbers on screen.** Backtests (Sim Francisco), "all 20 tests pass" (Tekton), grading against guidelines (Medkit), "build the evaluation first" (MaestrIA). AngelHack also tells teams to say how they measured output quality.
8. **A quantified before/after:** weeks → 5 hours; 90% rejection; $30k.
9. **Iteration past the obvious first idea.** It is a named prize ("Keep Thinking") and part of Depth (20%) at Anthropic.
10. **Multimodal input:** vision (dashcam, photos, schematics), voice (Medkit was built mostly by voice; Pulse), real-time audio and MIDI.

### 3.3 Fatigue list (what judges are tired of)

Evidence-backed:
- **"AI chatbot for X"**, i.e. a generic chatbot (Reskilll fatigue list, 2026).
- **Frontend-only chat wrappers** with no backend, where the only dynamic content is the model response (r/csMajors **[older]**).
- **"Blockchain for Y"**, **another todo/note app**, and **a dashboard that just shows data** with nothing actionable (Reskilll).
- Repetitive ideas judges have seen many times get penalized. Check past winners of the same event series (judge write-up surfaced via search).

**[inference]** Likely saturated in 2025–26 based on the above plus common Devpost galleries. Treat these as yellow flags, not bans: chat-with-PDF/RAG over docs, AI travel planner, study buddy/flashcard generator, resume reviewer, generic mental-health companion, meeting summarizer, "agent that books things" without real integrations, and a generic "AI code reviewer".

**Rescue recipe for a fatigued category:** narrow user + proprietary or domain data + a visible non-chat artifact + an eval number + human approval. Example: not "chat with your lease" but "tenant-rights letter generator for one city's housing code, with clause citations and a 92% match on 50 real cases".

---

## 4. Picking the idea — HackForge Idea Score

### 4.1 Gates (fail any → drop)

| Gate | Test |
|---|---|
| G1 Theme and required tech | Fits a published track/problem statement, and the **required sponsor API is on the golden path** (OpenAI Stage 1) |
| G2 60-second aha | The core "aha" can be shown within the first minute of a demo; the full story fits in 3 minutes (Reskilll; Masai) |
| G3 No single point of failure | The golden path works with a cached/fixture fallback for any flaky third-party API (Masai; AngelHack tip 10) |
| G4 Thin slice fits | An end-to-end thin slice can be deployed by about 30% of the clock |
| G5 One-sentence test | A judge outside the domain can restate it after 1 minute (DEV; AngelHack) |
| G6 Rules-clean | No pre-existing project code (MLH, ETHGlobal, Anthropic); open-source licensing is possible if required (Anthropic) |

### 4.2 Score (each factor 1–5)

```
IdeaScore (0–100) = 20 × F × ( 0.20·P + 0.20·W + 0.15·A + 0.15·T + 0.10·S + 0.10·N + 0.10·E )

P  Pain specificity      named user, quantified pain, today's workaround
W  Wow / demoability     visible non-chat artifact, before/after, a memorable moment
A  AI essentiality       remove the model and the product breaks; showcases the required model
T  Narratable hard part  a technically non-trivial component you can explain in 20 s
S  Prize leverage        number of eligible prizes where the integration is load-bearing (rules permitting)
N  Novelty               inverse of the fatigue list and of past winners at this event
E  Edge                  team has domain expertise / unique data / a reachable real user to quote
F  Feasibility (multiplier, 0.2–1.0)
   1.0 every component known and the APIs already smoke-tested
   0.8 one unknown component, with a fallback
   0.6 one unknown component, no fallback
   0.4 several unknowns, or hardware, or model training
   0.2 needs data, approvals or access you don't have
Fatigue penalty: −10 if in the §3.3 list without a rescue angle.
```

**Event re-weighting:** map the event rubric onto the factors. Anthropic-style (Demo 30 / Model use 25) → raise W to 0.25 and A to 0.25, lower S/N. MLH → raise T and "Learning" (add L = "new tech we stretch into", 0.10), drop P weight to 0.10. Gemini-style (Tech 40) → T 0.30.

### 4.3 Process (fits in the first 8% of the clock)

1. **Generate** 15–30 candidates from research: domain pain sources, sponsor APIs, datasets, past-winner gap analysis.
2. **Gate** → usually 6–10 survive.
3. **Score** with the formula. Keep the top 3.
4. **Red-team the top 3** with a judge-simulator agent: "who is the user, who pays, what's real vs mocked, what's next, why this model, how did you measure quality" (AngelHack tip 9).
5. **Lock** by the idea-lock checkpoint. Write a one-sentence pitch, a named user and the aha moment. After the lock, scope changes may only *cut*.

ECC already has a YC-style diagnostic in `skills/product-lens/SKILL.md` (Mode 1: "Who is this for? What's the pain?"). Adapt its question bank into the gate and red-team step, but drop its long PRODUCT-BRIEF output. HackForge needs a 1-page `IDEA.md`.

---

## 5. Sponsor-prize strategy

**Step 1 — read the stacking rules (they differ):**
- OpenAI Build Week: **each project is eligible for one prize** (rules §prizes).
- Docusign / many Devpost sponsor events: the same entrant **may win more than one category prize** **[older]**.
- ETHGlobal: **select up to 3 partner prizes**. Multiple tracks from one partner count as one. Each needs an explanation of how you integrated the partner's tools. Pre-existing ("classic") projects can't win partner prizes.
- MLH: category prizes such as "Best use of X" are judged by 1–2 subject-matter experts.

**Step 2 — choose prizes by expected value [inference]:**
`EV(prize) ≈ value × P(win | integrated)`. P rises when (a) the integration is on the golden path, (b) fewer teams target it (niche sponsor tools are usually under-subscribed compared with the grand prize), and (c) you've talked to the sponsor rep, who often judges the prize.

**Step 3 — integrate only where load-bearing:**
- Cap extra sponsor integrations at **≤3** and **≤15% of build time each**.
- Every claimed sponsor tech must (1) appear on screen in the video, (2) have its own README section ("How we used X"), and (3) be named in the pitch. ETHGlobal says this write-up is the *only* way partners assess you.
- Avoid logo-stuffing. Rubrics reward "thoroughly leveraging the required tool" (Devpost) and "creative use beyond basic integration" (Anthropic), not presence.
- If the rules allow one prize per project (OpenAI), stop stacking and go deep on the track with the best fit.

**Step 4 — side prizes are real targets.** Anthropic's "Keep Thinking" and "Most Creative" prizes paid $5k each. A project that visibly iterates (v1 → v2 with eval deltas shown) or uses a surprising capability can win these even if it isn't top 3.

---

## 6. Time-boxing with hard checkpoints

Percentages scale to any clock. Checkpoint names (●) should be enforced by the HackForge Workflow script and hooks.

### 6.1 24-hour hackathon

| Clock | % | Phase / checkpoint | Exit criteria |
|---|---|---|---|
| T−7d … T−0 | — | **Pre-event prep** | Accounts and API keys obtained and smoke-tested; deploy pipeline proven on a hello-world; demo recording tooling installed; harness/skills ready. **No project code before the start** (MLH/ETHGlobal/Anthropic); only public boilerplate and starter kits, disclosed. |
| 0:00–0:45 | 3% | Rules and rubric parse | `rubric.json` (criteria, weights, gates, video limit, prize-stacking rule, deadline in local TZ) |
| 0:45–2:00 | 5% | Ideation, gates, scoring, red-team | Ranked top 3 with scores |
| **2:00** | 8% | ● **IDEA LOCK** | `IDEA.md`: one-liner, named user, quantified pain, aha moment, sponsor techs |
| 2:00–3:00 | 4% | **Demo script and story first** | 90-sec demo script, Devpost "What it does" draft, golden-path steps, fixture data list |
| 3:00–7:00 | 17% | Walking skeleton | Golden path stubbed end-to-end, **deployed to a public URL**, e2e smoke test green |
| **7:00** | 30% | ● **SKELETON DEPLOYED** | Public URL loads; no auth wall (guest/demo mode); secrets only in env |
| 7:00–13:00 | 25% | Core wow plus the hard part | The aha works with real input; fallback fixtures in place |
| **13:00** | 55% | ● **WOW WORKS** | Judge-simulator run; cut list decided |
| 13:00–18:00 | 20% | Depth, sponsor integrations, polish of the demo path only | Eval number on screen, sponsor techs visible |
| **18:00** | 75% | ● **FEATURE FREEZE** | Only bug fixes on the golden path from here; main is demo-safe |
| 18:00–20:30 | 10% | Video: record the golden path (scripted browser capture), human narration, edit | ≤ limit; uploaded **public** (YouTube); link tested logged-out |
| **20:30** | 85% | ● **VIDEO DONE** | — |
| 20:30–22:00 | 6% | README, Devpost, screenshots, AI disclosure, sponsor sections | Submission checklist 100% |
| **22:00** | 92% | ● **SUBMITTED** (Devpost/MLH say leave 2–3 h; Masai says ≥30 min early) | Confirmation received; draft saved earlier |
| 22:00–24:00 | 8% | Pitch rehearsal ×3 (timed, one to an outsider), Q&A prep, backup video on local disk, fixtures for wifi failure | — |

### 6.2 48-hour hackathon

| Checkpoint | Clock | Notes |
|---|---|---|
| Rules parse plus research sprint | 0–3 h | Deeper research: talk to sponsor reps, gather domain documents and datasets, pull real user quotes |
| ● IDEA LOCK | **4 h** | — |
| Demo script and spec | 4–6 h | Spec per domain (Wrench Board pattern); ticket board (Tekton: about 50 tickets) |
| ● SKELETON DEPLOYED | **12 h** | Then **sleep block 1** (≥4 h). Agents can run long, safe tasks (tests, refactors on branches) overnight, but never merge to main unattended. |
| ● WOW WORKS | **24 h** | — |
| Depth / eval / sponsor integrations | 24–36 h | **Sleep block 2** |
| ● FEATURE FREEZE | **36 h** | — |
| ● VIDEO DONE | **41 h** | — |
| ● SUBMITTED | **44 h** | — |
| Rehearse, backup, Q&A | 44–48 h | — |

### 6.3 Week-long virtual (Anthropic / OpenAI format, 5–8 days)

- **Days 1–2: spec and plan.** Maieutic spent 2 days on design and tech specs. ARIA spent day 2 in planning mode with a GitHub Project board.
- **Days 2–4: parallel domain sessions** (Medkit used 4 sessions; Wrench Board used 5–6 agents).
- **Day 4–5: audit and eval.** Ask the agent to audit what's built before the next feature (ARIA).
- **Final day: video only** (Virtual Puppet Theater's lesson). Submit about 12 h before the deadline.

---

## 7. Demo-first development

**Principle:** the demo script is the spec. Everything not on the golden path is out of scope until the WOW checkpoint.

1. **Write the demo script before code** (Masai; Devpost suggests drafting the elevator pitch and project story in the submission form before coding).
2. **Golden path.** A single scripted user journey with real-looking seed data. Copy inputs to the clipboard in advance and skip account creation in demos (Devpost).
3. **Demo mode.** `DEMO_MODE=1` loads seeded data, bypasses login with a guest user, and serves **cached responses for any slow or flaky call** (AngelHack: pre-load slow agent responses to avoid dead air; swap in local fixtures for network steps).
4. **Deploy early, deploy often.** A public URL by 30% of the clock. Judges and the rules expect a working link: OpenAI/Docusign require test access, and private sites must include login credentials.
5. **Main stays demo-safe.** Risky work goes on branches/worktrees (Masai). The e2e golden-path test must pass before any merge.
6. **Golden-path e2e test.** A Playwright script that walks the demo exactly. Run it on every merge and against the deployed URL. The same script later drives the video recording (§8).
7. **Recorded backup.** Record a clean run as soon as the WOW checkpoint passes, and again at freeze. Keep it on local disk for the live pitch (AngelHack tip 10).
8. **Don't depict what doesn't work.** Rules require the project to function as depicted in the video (OpenAI/Docusign "Functionality"). Mock only non-core dependencies, and say what's mocked if asked.

---

## 8. The 2–3 minute demo video

### 8.1 Hard constraints (check `rubric.json`)
- **Length:** MLH ≤2:00. Anthropic ≤3:00. OpenAI <3:00 (judges needn't watch past 3:00). ETHGlobal 2:00–4:00 (rejected outside that range). Older Devpost sponsor events <5:00.
- **Content rules:** MLH requires stating the hackathon name at the start. OpenAI requires showing how you used Codex/GPT-5.6. ETHGlobal bans **TTS/AI voiceover, sped-up footage, phone recordings and music-with-captions**, and requires ≥720p.
- **Hosting:** public YouTube (OpenAI requires it publicly visible; Devpost notes private videos can't be watched; mark "not made for kids").

### 8.2 3:00 template (the AngelHack split, adapted)

| Time | Segment | Content |
|---|---|---|
| 0:00–0:10 | **Hook** | Event name (MLH rule) + one line: "X helps [named user] do [task] in [time] instead of [time]." |
| 0:10–0:30 | **Problem** | A real person and a real number (e.g., "90% of permit submissions are rejected on first pass"). Show today's workaround in 1 shot. |
| 0:30–2:00 | **Demo (about 50%)** | Golden path with real input. **The aha by 1:00.** Narrate the *hidden* work (retrieval, agents, verification), not the clicks (AngelHack tip 6). Show before/after or side-by-side. One memorable moment (tip 7). |
| 2:00–2:30 | **How it works / hard part** | One architecture diagram. The hardest engineering decision. **Model named, why it beat the obvious alternative, how output quality was measured** (tip 4). Sponsor techs on screen. |
| 2:30–2:50 | **Impact and next** | Who adopts it, pilot interest if real, honest limits. |
| 2:50–3:00 | **Close** | Name, URL, team, thanks. |

**2:00 variant:** Hook+Problem 0:00–0:20 → Demo with the tech narrated over it 0:20–1:40 → Impact+Close 1:40–2:00.

### 8.3 Production checklist
- Script written (by hand; Devpost contributors warn that generic AI-written scripts show). Read it aloud and time it. Don't speed up audio to fit (Devpost).
- Screen capture at 1080p using OBS or QuickTime, or a **scripted Playwright recording** (ECC `skills/ui-demo/SKILL.md` records WebM with an injected cursor and natural pacing through a Discover → Rehearse → Record process). Then add **human narration**.
- Use the best microphone on the team (Devpost). Add captions. Zoom into key UI moments.
- Upload early. YouTube gives a link before the upload finishes (Devpost). Test the link logged out.

---

## 9. Live pitch: structure and slide count

- **Slides: 0–1 to open, and ≤5 total.** AngelHack says one opening slide is enough if you use slides at all. ETHGlobal caps slides at 4 bullets. MLH doesn't score the pitch. Spend the time on the demo.
- **Recommended 5-slide skeleton:** (1) Title + one-liner + named user → (2) Problem with a number → **[LIVE DEMO, not a slide]** → (3) How it works / the hard part (diagram) → (4) Evidence: eval numbers, before/after, user quote → (5) Impact + next + sponsor techs used.
- **Timing:** the 3-min split in §8.2. In a 5-min slot, extend the demo and next steps, not the intro (AngelHack).
- **Presenter:** name them in hour 1. Pick for clarity, not seniority. They keep a running "pitch notes" file all event (AngelHack tips 1–2; Masai).
- **Memorize transitions, not copy** (4–5 route-marker phrases; tip 5). Rehearse aloud ×3, once to an outsider (tip 8).
- **Q&A prep sheet** (Q&A can run as long as the demo, per tip 9): Who is the user? Who pays? What's real vs mocked? What's next? Why this model over the obvious alternative? How did you measure quality? What did the AI write vs you? What was the hardest bug? ETHGlobal adds: what inspired it, which tools and why, and which challenges you solved.
- **Live-demo insurance:** demo mode on, fixtures loaded, the backup video on local disk, a phone hotspot, the browser zoomed in, notifications off, tabs pre-opened.

---

## 10. README / Devpost submission checklist

### 10.1 Devpost project story (standard headings)
`Inspiration` · `What it does` · `How we built it` · `Challenges we ran into` · `Accomplishments that we're proud of` · `What we learned` · `What's next`. Add **one heading per judging criterion** so humans and any AI pre-screen can map evidence to the rubric. Thumbnail: JPG/PNG/GIF, ≤5 MB, 3:2 ratio. Include a gallery of 3–6 screenshots plus a GIF of the aha moment.

### 10.2 README template (repo root)
```
# <Name> — <one-line value prop for a named user>
[Live demo](URL) · [Video](YouTube) · [Devpost](URL)

## Judge quickstart (≤60 s)
1. Open <URL> (no login; or test creds: see below)
2. Click "<Load sample case>"  3. Press "<Run>" → watch <aha>
Test credentials (if any): demo@... / provided in submission form

## The problem (with a number)
## What it does (3 bullets + GIF)
## How it works (architecture diagram; the hard part)
## Evaluation (dataset, metric, result; how we measured quality)
## Built with <Sponsor A> / <Sponsor B> (one section each: what, where in code, why load-bearing)
## How we used AI coding agents (required by MLH/ETHGlobal disclosure; scored by OpenAI)
   - Tools/models, which parts AI generated vs we designed/wrote, key decisions we made,
     spec/plan files location (ETHGlobal requires spec files & prompts in repo), session IDs if required
## What's real vs mocked
## Limitations & next steps
## Run locally (env vars listed in .env.example — never real keys)
## License (OSI license if required — Anthropic required fully open source)
## Team
```

### 10.3 Submission checklist (the gate for the SUBMITTED checkpoint)
- [ ] Every required field complete. Track/category selected. Sponsor prizes selected (≤ the rule limit), each with a write-up.
- [ ] Video within the length limit, public, link tested logged out, hackathon named if MLH, required-tool usage shown (OpenAI), no AI voiceover (ETHGlobal).
- [ ] Repo public (or shared as the rules require), with licence, README judge quickstart, `.env.example`, **no secrets in history**.
- [ ] **Commit history shows incremental work**: many commits over the event, timestamps inside the window (ETHGlobal may DQ big single commits; OpenAI wants dated commits/session logs for pre-existing projects).
- [ ] Live URL works from a fresh incognito browser and a phone. No auth wall, or test creds provided. Stays up through the judging period (OpenAI/Docusign require free access until judging ends).
- [ ] AI-tool disclosure present (MLH, ETHGlobal). Spec, plan and prompt files committed (ETHGlobal).
- [ ] Written summary within the word limit (Anthropic 100–200 words; Gemini about 200).
- [ ] Pre-existing work clearly separated, if allowed at all.
- [ ] Submitted ≥30–120 min before the deadline. Confirmation screenshot saved.

---

## 11. Failure modes and mitigations

| Failure | Evidence | Mitigation (HackForge automation) |
|---|---|---|
| **Scope creep** | Teams reach about ¼ of their ambitions (BuilderBase). An ambitious full autonomous agent in a short sprint fails (Masai). | Idea-lock scope may only shrink; a cut list at the WOW checkpoint; a feature-freeze hook |
| **Broken live demo** | The worst demos crash on stage because nobody tested (Reskilll); live API with no fallback (Masai) | Golden-path e2e on every merge; DEMO_MODE fixtures; local backup video |
| **No deploy / localhost only** | Judges may only use the link and video (OpenAI); judges advise deploying to Vercel/Netlify | SKELETON DEPLOYED checkpoint at 30% |
| **Auth wall** | Rules require free, unrestricted test access, with credentials if private (OpenAI) | Guest/demo mode by default; creds in the submission form, not the README |
| **Exposed API keys** | 23.8M secrets leaked on public GitHub in 2024, +25% YoY; 70% of secrets leaked in 2022 were still active (GitGuardian 2025) | `.env` + `.gitignore` from minute 0; pre-commit `gitleaks`/`trufflehog`; block `NEXT_PUBLIC_*KEY`/client-side keys; server-side proxy for model calls; spend caps; **rotate all keys after the event** |
| **Credits / rate limits exhausted mid-demo** | Common with live LLM calls **[inference]** | Cached responses for the demo path; a provider fallback; budget alert |
| **Venue wifi fails** | AngelHack tip 10 | Local fixtures, hotspot, offline backup video |
| **Can't explain the AI-written code** | Judges probe the differentiator in Q&A (Masai) | Human-owned "core 20%" file list; the judge-simulator quizzes the team |
| **Dead air from slow agents** | AngelHack | Pre-computed or streamed results; progress UI |
| **Video late, private, or over the limit** | No extensions at some events (Devpost); judges stop at 3:00 (OpenAI); ETHGlobal rejects <2 or >4 min | VIDEO DONE checkpoint at 85%; automated length and visibility check |
| **Rules violation**: pre-existing code, single giant commit, missing open-source licence, missing required API | MLH, ETHGlobal, Anthropic, OpenAI rules | `rubric.json` gates checked by `/hf:submit` |
| **No named user / generic pitch** | Masai; DEV | Gate G5 plus Impact factor P in scoring |
| **Demoing too many features** | Devpost: pick the most important features | Demo script ≤3 features; everything else goes to "What's next" |
| **No dedicated presenter** | Masai; AngelHack | Presenter role assigned at IDEA LOCK |

---

## 12. Using AI agents in the hackathon, and how judges see it

### 12.1 What the 2025–26 winners actually did
- **Prepared harness beats live prompting.** Affaan Mustafa used about 10 months of refined agents, skills and hooks (36Kr; ECC). The lesson from that write-up is to load only the agents and skills relevant to the task, to avoid context bloat. This is a direct argument for HackForge being *smaller* than ECC.
- **Spec → plan → parallel domain agents.** Wrench Board wrote a spec and plan per domain, then ran 5–6 agents in parallel. Medkit used 4 separate Claude Code sessions per domain to keep contexts clean. Tekton wrote a PRD and about 50 tickets, then ran parallel workstreams.
- **Verification loops.** Tekton used verifier subagents in isolated contexts plus self-correction until tests passed. CrossBeam had Claude write the tests. Elisa had 1,500+ tests. ARIA asked Claude to audit before each new feature.
- **Eval first** (MaestrIA, Medkit grader). **Use the agent for tool and model selection research**, not just code (Custom Universe). **Push back on the model in the brainstorm** (Wrench Board).
- **Voice-driven building** (Medkit) and **non-coders shipping** (CrossBeam, MaestrIA). Agent fluency now matters more than typing speed.

### 12.2 HackForge agent operating model (recommended)
1. **Planner** (main session): `IDEA.md` → `DEMO_SCRIPT.md` → `SPEC.md` → tickets (≤30 for 24h).
2. **2–4 domain builders** in separate git worktrees/sessions (e.g., ingest, core engine, UI, integrations), each with its own spec slice.
3. **Integrator** merges to main only when the golden-path e2e passes.
4. **Verifier/QA agent** in an isolated context runs e2e against the deployed URL, compares against the demo script, and files regressions.
5. **Judge simulator** scores against `rubric.json` at each checkpoint and runs Q&A drills.
6. **Humans own** the idea, domain truth, the core-20% logic review, the narration, and the final submit click.

### 12.3 What judges and organizers think of AI-built projects (2026)
- **Expected, and sometimes scored.** Anthropic gives 25% to "Opus use" (creative, beyond basic integration). OpenAI's README must describe the Codex collaboration (where it accelerated work, which decisions were human), and this counts toward Technological Implementation and Quality of Idea. OpenAI's tech criterion is *how thoroughly and skillfully the project uses Codex*.
- **Disclosure is mandatory.** MLH requires it. ETHGlobal requires documenting which code, files and assets AI generated, and allows spec-driven workflows (OpenSpec, Kiro, spec-kit) only if the spec files are in the repo.
- **There is a line, though.** ETHGlobal says AI should *assist*, and projects relying entirely on AI without meaningful team contribution may be ineligible for partner prizes or finalist slots. The defense is a visible human contribution: problem framing, domain data, architecture decisions, eval design and review. Document these in the README.
- **Videos must be human.** ETHGlobal bans AI voiceovers and TTS. Devpost contributors warn that AI-written scripts read as generic.
- **Code quality matters less than working output.** MLH doesn't judge code quality. BuilderBase says judges don't prioritize perfect code or lines written. But judges *will* probe whether you understand the differentiating logic (Masai).
- **Name the model and the eval.** Nearly every submission uses AI now, so specifics differentiate (AngelHack tip 4).

---

## 13. What HackForge should build from this

| Component | Type | Behavior | Source of idea |
|---|---|---|---|
| `/hf:rules` | command + skill | Scrape the event page and rules (Devpost/ETHGlobal/MLH/Cerebral Valley) → `rubric.json`: criteria, weights, Stage-1 gates, video limits and bans, stacking rule, team size, licence, pre-existing-code rule, deadline in local TZ | §2 |
| `idea-scorer` | subagent | Applies the §4 gates and formula, re-weighted from `rubric.json`; fatigue-list penalty; outputs a ranked table plus `IDEA.md` | §3–4; adapt ECC `product-lens` question bank |
| `judge-sim` | subagent | Scores the current build and the video script against `rubric.json` with 1/3/5 anchors; runs AngelHack/ETHGlobal Q&A drills | §2.3, §9 |
| `hackforge.workflow.js` | Workflow script | Hard checkpoints (IDEA LOCK, SKELETON DEPLOYED, WOW, FREEZE, VIDEO, SUBMITTED) with exit-criteria checks and timestamps relative to the event clock | §6 |
| `freeze` hook | PreToolUse hook | After the FREEZE timestamp, warn or block edits outside the files on the golden-path fix list | §6, §11 |
| `secrets` hook | pre-commit + PreToolUse | gitleaks scan; block client-exposed keys; ensure `.env` is in `.gitignore` | §11 |
| `commit-cadence` hook | Stop/PostToolUse | Nudge or auto-commit small, descriptive commits (protects against the "single giant commit" DQ) | ETHGlobal |
| `demo-first` skill | skill | Writes `DEMO_SCRIPT.md` + Devpost draft before code; generates the golden-path Playwright e2e; `DEMO_MODE` fixtures | §7 |
| `demo-video` skill | skill | Adapts ECC `skills/ui-demo` (Playwright WebM, cursor overlay, Discover→Rehearse→Record) to the §8 timing template; produces a narration script for a **human** to read; length check | §8 |
| `pitch` skill | skill | Adapts ECC `skills/frontend-slides` (single-file HTML) with a **hard cap of 5 slides, ≤4 bullets each** | §9 |
| `/hf:submit` | command | Generates README + Devpost story (criterion-mapped headings), AI-disclosure section, per-sponsor sections; validates the §10.3 checklist (links live, video public and within the limit, licence, no secrets) | §10 |
| `prize-planner` | skill | Lists prizes, computes EV, enforces the stacking rule, checks each claimed sponsor tech is on the golden path and in the video | §5 |
| Parallel-domain pattern | docs + Workflow | Spec slices → worktrees → integrator + verifier (the Wrench Board / Medkit / Tekton patterns) | §12 |

**Avoid copying from ECC:** 311 skills and 71 agents loaded at once. The winner's own lesson is to load only what is relevant, so HackForge should ship about 10–15 focused skills. Also avoid any AI voiceover tooling for videos, and any "auto-generate the whole project" default without a recorded human-decision trail.

---

## 14. Templates

### 14.1 `IDEA.md`
```
One-liner: <Name> helps <named user> <do task> in <time/$> instead of <status quo>.
User & pain (with number + source):
Today's workaround:
Aha moment (≤60 s into demo):
Visible artifact (non-chat):
Hard part we'll narrate:
AI essentiality (what breaks without the model):
Eval: dataset / metric / target
Sponsor techs on golden path (≤3) + prizes targeted (rule-checked):
Fallbacks for flaky deps:
Out of scope (explicit):
Scores: P W A T S N E | F | IdeaScore
```

### 14.2 `DEMO_SCRIPT.md` (90-second core)
```
[0:00] Say: "<hook with number>"            Screen: landing with sample case preloaded
[0:15] Do: <step 1>  Say: <hidden work being done>
[0:35] Do: <step 2>  → AHA: <visible artifact>   Say: "<before/after>"
[1:05] Do: <judge-supplied input variant>     Say: "<robustness / eval number>"
[1:20] Say: "<impact + next>"
Fixtures: <files>   Fallback: <cached responses>   Reset: <command>
```

### 14.3 Self-score sheet (run at each checkpoint)
```
D Working demo   __/5 ×25   T Depth   __/5 ×20   I Impact   __/5 ×20
O Originality    __/5 ×15   S Sponsor __/5 ×10   U UX/clarity __/5 ×10
Total = Σ(score/5 × weight)  → target ≥ 75 at FREEZE
Gates: Stage-1 required API visible? [ ]  Video ≤ limit? [ ]  Public URL? [ ]
```

---

## 15. Open questions / staleness flags

- The Anthropic Opus 4.6 rubric (30/25/25/20) comes from a copy in a winner's repo, not the official page. It is probably accurate, but verify per event; later Anthropic events (4.7, 4.8 Build Day) did not publish weights in their recaps.
- The Gemini 3 (40/30/20/10) weights come from third-party reprints only.
- The Docusign rules page is from 2024–25. Current Devpost sponsor events still use the same four headings (OpenAI 2026 confirms), but weights and multi-prize rules vary per event.
- Accounts of the Affaan Mustafa / Forum Ventures win disagree on location (NYC per ECC, Silicon Valley per 36Kr).
- The fatigue list is thinly sourced (one 2026 platform blog plus a 2024 Reddit rant). The extended list in §3.3 is inference.
- "Judges see 30–100 demos a day" and "90% of projects use AI" are unsourced blog claims. They are directionally consistent with MLH's 4-min/3-judge plan.
- Whether AI-driven pre-screening of submissions is actually used (OpenAI rules permit it) is unknown. Writing criterion-mapped headings is cheap insurance either way.
