# Ideas: what wins, how to generate, gate, score and kill

Load this for `/hackforge:ideate`, the `idea-tournament` workflow, the `ideator` / `prior-art-hunter` / idea-judge roles, and when writing `.hackforge/ideas/IDEA.md` + `concept-anchor.json`. Sources: research 06 §3–5 (primary), 01, 02 §6.1, 05 §D/G, 07 §5.4, 08 (which wins on conflicts). Tags: **[inference]**, **[unverified]**, **[older]** as in judging.md.

## 1. What wins now (2025–26 winners → pattern tags)

| Event | Winners (builder) | Pattern tags |
|---|---|---|
| Anthropic Opus 4.6 (Feb 2026; 13k applied → 500; 1 week) | CrossBeam (PI lawyer: CA permit corrections) · Elisa (kids' visual IDE) · PostVisit.ai (cardiologist) · TARA (road technician, Keep Thinking) · Conductr (Creative) | domain-expert · quantified pain (90%+ first-pass rejection, ~6 months, ~$30k) · parallel subagents · 1,500+ tests · human-in-loop · vision + deterministic finance core (weeks → ~5 h) · real-time engine you can feel |
| Anthropic Opus 4.7 (Apr 2026; 20k+; 5 days) | Medkit (physician-engineer) · Wrench Board (repairer) · Maieutic (lecturer) · MaestrIA (non-programmer, Keep Thinking) · ARIA (Managed Agents) | agentic grader vs guidelines · eval-first · multimodal (schematics, photo, voice) · 4–6 parallel domain agents · spec-first · PDF → monitoring agents → work orders |
| Anthropic Opus 4.8 Build Day (Jun 2026; 12 h) | Tekton · Sim Francisco · Custom Universe | source-cited 3D · verifier subagents until 20 tests pass · backtested numbers on screen · phone photo → 3D, with the agent researching model choice |
| OpenAI Build Week (Jul 2026; ~47k builders, 8k+ projects) | veTriage (vet) · Pulse (cardiologist) · Dấu · Second Voice · Mechanica · AirBridge · Echo Canvas · Sentinel | narrow user · deterministic core + AI interpretation · human approval · visible evidence (pitch curves) · explicit safety boundaries ([Remio](https://www.remio.ai/post/openai-build-week-winners-show-what-codex-can-build-beyond-demos)) |
| GitLab AI Hackathon 2026 | LORE · Gitdefender · GraphDev | real workflow agents · visual output |

Sources: [Opus 4.6 recap](https://claude.com/blog/meet-the-winners-of-our-built-with-opus-4-6-claude-code-hackathon), [4.7](https://claude.com/resources/articles/meet-the-winners-of-built-with-opus-4-7-claude-code-hackathon), [4.8 Build Day](https://claude.com/resources/articles/meet-the-winners-of-our-claude-opus-4-8-build-day-hackathon).

## 2. Ten patterns to reward (and the IdeaScore factor each feeds)

1. **Domain-expert pain** (E, P). 4 of 5 Opus 4.6 winners were not professional developers. Research must *manufacture* domain depth: real forms, regulations, datasets, workflows, numbers.
2. **Narrow user, task and environment** (P, U). This makes output quality judgeable.
3. **Deterministic core, AI at the interpretation layer** (T, A). Measurement, geometry, finance and policy live in code; the model translates, explains, plans or perceives.
4. **Visible evidence, not chat text** (W). Curves, 3D, graphs, source-linked citations, generated PDFs.
5. **Human approval at consequential moments** (I).
6. **Multi-agent orchestration with verification** (T, A). Parallel domain agents, verifiers in isolated contexts, agentic graders.
7. **Eval-first, with numbers on screen** (T, W). Backtests, "all 20 tests pass", grading against guidelines.
8. **Quantified before/after** (P, W). Weeks → 5 hours; 90% rejection; $30k.
9. **Iteration past the obvious first idea** (N, T). This is a named prize (Keep Thinking) and part of Depth 20% at Anthropic.
10. **Multimodal input** (W, N). Dashcam, photos, schematics, voice, real-time audio, MIDI.

## 3. Fatigue list and the rescue recipe

- **Evidence-backed:** generic "AI chatbot for X"; frontend-only chat wrappers with no backend [older]; "blockchain for Y"; another todo/note app; a dashboard that only shows data. Also any repeat of past winners in the same event series.
- **Yellow flags [inference]:** chat-with-PDF/RAG over docs, AI travel planner, study buddy/flashcards, resume reviewer, generic mental-health companion, meeting summarizer, a booking agent without real integrations, a generic AI code reviewer.
- The list is thinly sourced: one 2026 platform blog (Reskilll) plus a 2024 Reddit thread.
- **Rescue recipe:** narrow user + proprietary or domain data + a visible non-chat artifact + an eval number + human approval. Example: not "chat with your lease" but a tenant-rights letter generator for one city's housing code, with clause citations and a 92% match on 50 real cases.
- A rescue angle counts only when each recipe part is named concretely in the candidate. "But for X" alone gets the −10.

## 4. Gates G1–G6 (fail any → drop before scoring)

| Gate | Test |
|---|---|
| G1 Theme and required tech | Fits a published track or problem statement, **and** the required sponsor API is on the golden path (OpenAI Stage 1). Mirrors `rubric.json` `stage1Gates` |
| G2 60-second aha | The aha shows within the first minute of the demo; the full story fits in 3 minutes |
| G3 No single point of failure | The golden path works with a cached or fixture fallback for any flaky third-party API |
| G4 Thin slice fits | An end-to-end thin slice can be deployed by SKELETON_DEPLOYED (about 30% of the clock) |
| G5 One-sentence test | A judge outside the domain can restate it after 1 minute |
| G6 Rules-clean | No pre-existing project code (`rubric.json` `preExistingCode`); open-source licence possible if required. Not a substantial duplicate of a prior Devpost submission (Devpost ToS §4, 08 §3.1) |

## 5. IdeaScore (DESIGN §4.3)

```
IdeaScore = 20 × F × Σ(w_k × factor_k)      k ∈ {P, W, A, T, S, N, E}; each factor 1–5
w_k from rubric.json ideaWeights (sum 1.0). Default: P .20 · W .20 · A .15 · T .15 · S .10 · N .10 · E .10
Range 4–100. Fatigue-list idea without a rescue angle: −10.
No separate demo multiplier (W already covers demo; 08 C13). Ties → sponsor EV (§10).
```

Factor anchors below are derived from the 06 §4.2 definitions:

| k | Factor | 1 | 5 |
|---|---|---|---|
| P | Pain specificity | "everyone", no number | named user, quantified pain with a source, today's workaround |
| W | Wow / demoability | chat text or an invisible backend | visible non-chat artifact, before/after, a memorable moment in ≤60 s |
| A | AI essentiality | works fine without the model | remove the model and it breaks; showcases the required model |
| T | Narratable hard part | API call plus UI | non-trivial component you can explain in 20 s |
| S | Prize leverage | no eligible prize with a load-bearing integration | several eligible prizes (rules permitting), each load-bearing |
| N | Novelty | fatigue list, a past winner at this event, or `high` saturation | no close neighbour and a non-obvious capability |
| E | Edge | none | domain expertise, unique data, or a reachable real user to quote |

| F | Feasibility multiplier |
|---|---|
| 1.0 | every component known; APIs already smoke-tested |
| 0.8 | one unknown component, with a fallback |
| 0.6 | one unknown component, no fallback |
| 0.4 | several unknowns, or hardware, or model training |
| 0.2 | needs data, approvals or access you don't have |

Worked example: P4 W5 A4 T3 S2 N4 E2 → Σ = 3.65; F 0.8 → 20 × 0.8 × 3.65 = **58.4**.

## 6. Event re-weighting (`rubric.json` `ideaWeights`, must sum to 1.0)

| Event style | P | W | A | T | S | N | E | Basis |
|---|---|---|---|---|---|---|---|---|
| Default | .20 | .20 | .15 | .15 | .10 | .10 | .10 | 06 §4.2 |
| Anthropic (Demo 30 / model use 25) | .20 | .25 | .25 | .15 | .05 | .05 | .05 | 06 raises W and A to .25 and lowers S/N; E is cut to renormalise (example) |
| MLH (Tech/Design/Completion/Learning) | .10 | .20 | .15 | .25 | .10 | .10 | .10 | 06 drops P to .10 and adds a "Learning" factor L .10; DESIGN fixes 7 factors, so L folds into T |
| Gemini-style (Tech 40) [unverified rubric] | .15 | .20 | .15 | .30 | .05 | .10 | .05 | 06 sets T .30; the rest is an example |
| One prize per project (OpenAI) | .20 | .20 | .20 | .15 | .05 | .10 | .10 | [inference] stacking adds nothing; required-tool use is scored |

## 7. Ideation directions (one per isolated `ideator`)

The orchestrator **assigns** each direction; agents don't self-differentiate (01). Ideators read `HACKATHON.md`, `rubric.json`, `research/` (OPPORTUNITIES.md, channel files, claims.json) and their direction, never each other's output in `ideas/`. Each returns 3–4 candidates: 8 / 12 / 24 in total at `small` / `medium` / `large` (08 C14 aims for 15–30, so prefer `large` when the plan allows). Each candidate records its direction and, for refinements, its parent (lineage, as in rajih-engine).

| # | Direction | Prompt seed |
|---|---|---|
| 1 | Pain-first | "Take the sharpest quantified pain in the research; name the user, the number and today's workaround; build the smallest tool that moves that number." |
| 2 | Sponsor-tech-first | "Pick one required or sponsor API and find the use where the demo collapses without it, while meeting a prize requirement." |
| 3 | Wow-demo-first | "Start from a 10-second on-screen moment a judge will remember (3D, curve, map, PDF, not chat), then work back to a real user who needs it." |
| 4 | Eval/data-first | "Start from a dataset or ground truth you can score against (backtest, guidelines, past cases); the demo must show an accuracy number." |
| 5 | Domain-expert workflow | "Take one professional workflow with real forms, rules and steps; automate its slowest step and keep human approval at the consequential one." |
| 6 | Multimodal input | "The input must be a photo, video, voice, schematic or live stream, not typed text; output a structured, checkable artifact." |
| 7 | Agentic-with-verifier | "Design agents whose output an isolated verifier or grader checks against tests or sources, and show the verification live." |
| 8 | Contrarian / underserved user | "Pick a user the obvious ideas ignore (a low-saturation niche, non-English speakers, users with a disability, a trade); say why incumbents miss them." |
| 9 | Keep-thinking depth | "Take the most obvious idea for this theme, list why judges have seen it, and iterate 2–3 times past it; show the v1 → v3 lineage." |

Default assignment order (`workflows/idea-tournament.js`, overridable with `args.directions`): `small` → 1, 2 · `medium` → adds 3, 4 · `large` → adds 5, 6, 7, 8. Direction 9 is not in the workflow; run it by hand as a refine pass on the gate survivors.

## 8. Saturation method (`prior-art-hunter`; feeds N and G6)

1. **Keywords:** 2–3 phrasings per candidate, built from the user and the task rather than brand words.
2. **Counts:** `hackforge saturation "<keywords>"` → GitHub total + top 5, HN totals + trend, SERP counts for Devpost and Product Hunt → `level: low|medium|high`. `--free` skips the paid SERP counts. For a single count, use `hackforge web count "site:devpost.com <unquoted words>"`. Quoting a phrase together with a path (`site:devpost.com/software "…"`) failed with `redirect location was rejected`.
3. **Nearest-3 read:** take the 3 closest neighbours. Use `hackforge gh readme o/r` for repos and `hackforge hn item <id>` for HN. **Devpost pages: list the SERP links for the human to open.** Never fetch them by script.
4. **Name the trap:** is the crowd in *your* slice? hackathon-radar's example: "education" (26.6k projects) is crowded in content (tutors) but nearly empty in operations.
5. **Decide:** a Devpost project won a prize with the same pitch in the last 12 months → pivot the angle (07). Substantially duplicates a prior submission → fail G6. ≥3 live products and none rated ≥4.5★ with a cheap tier → "crowded but beatable"; lean on the gap (07).

- **Devpost ToS §4** ("Last Updated: December 5, 2025") forbids automated access ("scrape," "crawl," "spider"), even though robots.txt allows it. So: no gallery crawls, no polling `/software/search` or `/api/hackathons`, and no `bdata scrape` of devpost.com. The 05/07 examples that do this are superseded by 08.
- **Reference counts** for intuition only (08, 2026-10-15). Devpost's own: "agent" 47,620 · "chatbot" 25,779 · "meal planning" 2,046 · "permit" 1,357 · "dysarthria" 39. SERP `site:devpost.com meal planning app` → `results_cnt` 2,800.

## 9. Kill switch (gate survivors → top 3 → council red-team)

Forcing questions, compressed from gstack `/office-hours` (05). Default to the narrowest wedge.

| Question | Ask | Kill signal |
|---|---|---|
| Demand reality | What dated, cited evidence (quote, thread, number in `claims.json`) shows people want this now? | Only "would be cool"; no source |
| Status quo | What does the user do today, and what does it cost in time or money? | No workaround named, or the workaround is good enough |
| Desperate specificity | Which single role or person needs this most? | "Everyone", "developers", "students" |
| Narrowest wedge | What is the smallest version that shows the aha in ≤60 s? | Needs a platform or several unknowns before anything demos |

Then red-team the top 3 with judge personas (judging.md §6) on the AngelHack questions: who is the user, who pays, what's real vs mocked, what's next, why this model, how was quality measured.

**Outcomes** (spec-kit `assess`; haytham GO/NO-GO/PIVOT):
- **go** → eligible for the Gate A top 3.
- **needs-clarification** → **one** bounded loop: a targeted scout/prior-art check, or a question for the human at Gate A. Still unclear → kill.
- **kill** → drop it and write the reason in `ideas/LEADERBOARD.md`. A kill must always say why.

**`concept-anchor.json` invariants** are written at Gate A next to `ideas/IDEA.md`. They pin what may not drift during the build: the one-liner, named user, quantified pain + source, aha moment, visible artifact, sponsor techs on the golden path, targeted prizes, and the explicit out-of-scope list. After Gate A, scope may only *cut*. Changing an invariant means `hackforge gate A --unlock` and a human decision.

## 10. Sponsor-prize EV and stacking

1. **Read the stacking rule** into `rubric.json` `prizeStacking`:
   - `one`: OpenAI, one prize per project.
   - `multiple`: Docusign and many Devpost sponsor events [older].
   - `max3`: ETHGlobal, up to 3 partner prizes. Several tracks from one partner count as one. Each needs a write-up of the integration. Pre-existing projects can't win partner prizes.
   - `unknown`: treat as `one` until confirmed [inference].
   - MLH "Best use of X" prizes are judged by 1–2 subject-matter experts.
2. **EV(prize) ≈ value × P(win | integrated)** [inference]. Values come from `state.json` `sponsors[].value`. P rises when the integration is on the golden path, when fewer teams target the prize (niche sponsor tools are usually under-subscribed compared with the grand prize), and when you've talked to the sponsor rep, who often judges it. Base rate: median Devpost prize $4,300 (analisto/devpost_com, Dec 2025, stale-ish).
3. **Integrate only where load-bearing.** Allow ≤3 extra sponsor integrations at ≤15% of build time each. Every claimed tech must appear on screen in the video, get its own README section ("How we used X") and be named in the pitch. Logo-stuffing scores 1 on S.
4. **One-prize rule** → stop stacking and go deep on the best-fit track.
5. **Side prizes are real targets.** Anthropic's Keep Thinking and Most Creative paid $5k each. A visible v1 → v2 with eval deltas, or a surprising capability, can win them without a top-3 finish.
6. **Tie-break:** with equal IdeaScores, the higher Σ EV of targeted prizes wins. Set `sponsors[].targeted` at Gate A.
