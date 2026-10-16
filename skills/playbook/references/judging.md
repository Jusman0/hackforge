# Judging: formats, rubrics, hidden factors, judge personas

Load this when you build or edit `.hackforge/rubric.json`, run a `judge-persona` agent (in `idea-tournament`, `judge-panel` or `/hackforge:judge`), or write submission text. Sources: research 06 §2 (primary), 02 §6.1, 05 §H, 08. Tags: **[secondhand]** = rules copied by a third party, not the official page; **[unverified]** = reprint or blog claim; **[inference]** = our reasoning; **[older]** = pre-2025.

## 1. Formats and the time you actually get

| Format | Time | Who sees what | Optimize for |
|---|---|---|---|
| **Expo / science fair** (MLH default) | About 4 min per judge visit: 2 min demo, 1 min Q&A and scoring, 1 min travel. Each project is seen by ≥3 judges. Each judge reports a top 3, stack-ranked 3/2/1 | Rotating judges at your table | Aha in the first 30 s. A 2-min table script. A demo that resets in seconds |
| **Finalist main stage** | MLH about 7 min (3–5 presenting plus setup). ETHGlobal 4 min demo + 3 min Q&A | Full panel | Q&A drill: Q&A can run as long as the demo |
| **Async video** (virtual Devpost, Cerebral Valley) | MLH digital ≤2:00. OpenAI and Anthropic <3:00 (OpenAI: judges need not watch past 3:00). ETHGlobal 2:00–4:00, rejected outside that range. Older Devpost sponsor events <5:00 [older] | Judges may **never run the app**. OpenAI and Docusign rules allow scoring on text, images and video only | Video and text that stand alone |
| **Two-stage** (30+ teams) | Async Stage 1 scoring, then top N present. Anthropic: top 6 showed pre-recorded 3-min demos, then deliberation [secondhand] | Panel | Pass Stage 1 on the text and video alone, then present |

Sources: [MLH Judging Plan](https://guide.mlh.com/general-information/judging-and-submissions/judging-plan), [ETHGlobal details](https://ethglobal.com/events/scaling/info/details), [OpenAI rules](https://openai.devpost.com/rules), BuilderBase Ch.15.
**Rule:** treat three artifacts as first-class: a 2-min live table demo, a video within `rubric.json` `video.maxSeconds`, and a written submission that stands alone.

## 2. Published rubrics (real weights)

| Event / template | Criteria · weights | Caveats |
|---|---|---|
| **MLH Standard Rules** ([rules](https://github.com/MLH/mlh-policies/blob/master/standard-hackathon-rules.md)) | Technology 25 · Design 25 · Completion 25 · Learning 25 | Explicitly **not** judged: code quality, pitch quality, idea originality, real-world usefulness. Digital events: ≤2-min video that names the hackathon at the start. AI use must be disclosed |
| **Devpost sponsor template** (Docusign 2024–25 [older]; same 4 headings on GitLab, Slack, DigitalOcean, Google Cloud 2025–26 pages) | Technological Implementation 25 · Design 25 · Potential Impact 25 · Quality of the Idea 25 | Tech includes thoroughly leveraging the required tool. Design means a balanced front end and back end. Docusign allowed multiple prizes per entrant |
| **OpenAI Build Week** (Jul 2026) | **Stage 1 pass/fail:** theme fit + required APIs. **Stage 2, equal weights:** Tech Implementation (skilful Codex use; non-trivial and working) · Design (a complete, coherent product, not a proof of concept) · Potential Impact (a specific real problem, *as demonstrated*) · Quality of the Idea (novel) | Ties go to the **first listed criterion**. May use automated AI-driven analysis. README must explain the Codex collaboration and include a session ID. **One prize per project** |
| **Anthropic Built with Opus 4.6** (Feb 2026) [secondhand] | Demo 30 · Impact 25 · Opus 4.6 use 25 (creative, beyond basic integration) · Depth & execution 20 (iterated past the first idea) | Fully open source, start from scratch, teams ≤2, 3-min video, 100–200-word summary, judged by six Claude Code team members. Side prizes: Most Creative Exploration, Keep Thinking. Later Anthropic recaps (4.7, 4.8) published no weights |
| **ETHGlobal finalists** (2026) | Technicality · Originality · Practicality · Usability (UI/UX/DX) · WOW factor (no weights) | Video 2–4 min, ≥720p. Bans TTS/AI voiceover, sped-up footage, phone recordings, and music-plus-captions-only videos. Slides ≤4 bullets |
| **PayPal AI Hackathon 2026** (Devpost rules page, probed by 08) | 5 equal: Tech Implementation · Design · Potential Impact · Innovation/Idea · Presentation | Tie-break on the first criterion |
| **Gemini 3 Hackathon** (2026) [unverified reprint] | Technical Execution 40 (incl. Gemini use) · Innovation/Wow 30 · Potential Impact 20 · Presentation 10 | 3-min video, about 200-word description |
| **BuilderBase example** (Apr 2026) | Innovation 25 · Technical 25 · Impact 20 · Presentation 15 · Design/UX 15 | Judge what was built, not what was planned. Teams reach about ¼ of their ambitions |
| Masai "unnamed Devpost AI rubric" [unverified] | Innovation ~20 · Technical ~25 · Impact ~25 · Presentation ~20–30 | Sanity check only |

Every rubric rewards a working demo, explicitly (Anthropic Demo 30, MLH Completion 25) or implicitly (OpenAI "as demonstrated", BuilderBase "what was built").

## 3. HackForge Default Judge Rubric (`templates/rubric.default.json`)

Use this when the event publishes no criteria. The ids, weights and anchors below are the template's own; keep them in sync.

| id | Criterion | Weight | 1 (weak) | 3 (meets) | 5 (exceptional) |
|---|---|---|---|---|---|
| D | Working demo & completeness | **25** | Slides or a mock; crashes | Golden path works with some rough edges | Works live first try with real input, survives a judge's own input, and is deployed |
| T | Technical depth & execution | **20** | API call plus UI | One non-trivial component | A clearly narrated hard part (orchestration, eval loop, real-time engine, vision pipeline) and iteration past v1 |
| I | Impact (specific user, credible) | **20** | "Everyone" | Named user segment | Named user, quantified pain (time/$), today's workaround, before/after shown in the demo |
| O | Originality / quality of idea | **15** | Fatigue category | Fresh angle on a known problem | Non-obvious capability ("didn't know models could do that") |
| S | Required-tech / sponsor use | **10** | Logo-stuffing | Integrated | Load-bearing and creative; the demo collapses without it |
| U | Design/UX & clarity | **10** | Confusing | Clean | A judge outside the domain can restate what it does after 1 minute |

- Defaults: `stage1Gates` = theme/track fit + required sponsor API visibly used on the golden path; `tieBreak` = `["D"]`.
- Score each criterion as an integer 1–5. A 2 or 4 sits between anchors. Cite evidence for every score (URL, screenshot, file, timestamp). Judges never fix.
- **Rubric total** = Σ(score/5 × weight), 20–100. Target ≥75 at FEATURE_FREEZE (06 §14.3). A failed Stage-1 gate means no score at all.

## 4. Re-weighting when the event publishes criteria

`/hackforge:kickoff` writes the event's criteria into `.hackforge/rubric.json` (`source`: `paste` or `url:<url>`). Weights must sum to 100.
- Keep the event's criterion **names verbatim**. Reuse a default id where the meaning matches, so its anchors carry over. Write new 1/3/5 anchors for criteria with no match (Learning, Presentation, WOW).
- Criteria listed without weights: split equally and label the weights "inferred" in `HACKATHON.md` (CrafterWIKI: "explicit or inferred and labelled").
- Pass/fail items go to `stage1Gates`. The published tie-break order goes to `tieBreak` (OpenAI and PayPal: the first criterion).
- An unjudged dimension gets weight 0. Do not delete it, so the judges still see it.

| Event style | `criteria` weights | `tieBreak` / gates | Note |
|---|---|---|---|
| Anthropic 4.6 [secondhand] | D 30 · I 25 · S 25 (Opus use) · T 20 (Depth) · O 0 · U 0 | — | Rewrite S anchors as "creative use beyond basic integration" |
| MLH | T 25 · U 25 (Design) · D 25 (Completion) · new id "Learning" 25 | — | Cut pitch effort to the minimum; state what you learned in the README and pitch |
| OpenAI / Devpost 4×25 | T 25 · U 25 (Design) · I 25 · O 25; S folds into T ("thoroughly leveraging the required tool") | `["T"]` (OpenAI); gates: theme + required APIs | Design anchor 5 should demand a complete product, not a proof of concept |
| Gemini 3 [unverified] | T 40 · O 30 · I 20 · new "Presentation" 10 | — | Gemini use is scored inside T |

## 5. Hidden factors that decide outcomes

- **Stage-1 gates are pass/fail.** If the required sponsor API isn't visibly used, the project is never scored (OpenAI). Mirror this in idea gate G1 and `stage1Gates`.
- **Tie-breaks follow criterion order.** Over-index on the first listed criterion (OpenAI, PayPal 2026).
- **Judges may never open the app** (OpenAI, Docusign). The text, images and video must carry the case alone. Simulate this: give one judge only the submission text and video script.
- **LLM pre-screening.** OpenAI rules permit "automated AI-driven analysis"; whether events use it is unknown. Cheap insurance: one Devpost heading and one README "Judging Highlights" line **per criterion, named exactly as in `rubric.json`**, each with evidence.
- **AI-first-pass judging is a trend.** The carmatthews enterprise brief says "Claude will judge" and "commit history is evidence". BuildersClaw mixes 40% peer-agent judging, 30% repo/code judging and 30% deployed-URL runtime judging [secondhand: SERP snippet]. ORCHESTRA puts a bias auditor before a chief judge. The repo, commit history and live URL are all read as evidence.
- **Commit history.** ETHGlobal may disqualify a project whose history is one big commit. OpenAI wants dated commits or session logs for pre-existing work. Commit per slice. Commit `.hackforge/` except `web/`, `dev.*` and `nudge.json` (ETHGlobal wants spec and plan files in the repo).
- **Volume and fatigue.** Judges reportedly see 30–100 demos a day [unverified; Masai], and MLH allows about 2 minutes per team. The first 30 s and one memorable moment matter most (AngelHack tip 7). Show the aha by 1:00.
- **Know the judges.** They may be non-technical (Reddit "won 6 hackathons"). The Opus 4.6 judges were the Claude Code team, who notice shallow model use.
- **Sponsor reps judge their own prizes.** At ETHGlobal the prize write-up is the *only* way a partner assesses you. MLH category awards often go to 1–2 subject-matter experts.
- **Access failures.** Rules require free test access, with credentials if the site is private (OpenAI, Docusign). Vercel deployment-hash URLs can be login-walled, so give judges the production alias and test it in incognito (08 C21).
- **Works as depicted.** The project must function as shown in the video (OpenAI/Docusign). Say what is mocked.
- **The AI line.** ETHGlobal: projects relying entirely on AI without meaningful team contribution may lose partner-prize and finalist eligibility. Document the human decisions in the README.

## 6. Judge personas (for `judge-persona` agent simulation)

Run one persona per judge agent, all on the same `rubric.json`, scoring with 1/3/5 anchors and evidence. Anti-anchoring (ECC council, 02 §6.1): each judge gets a fresh context with only the rubric, the artifact and the event context. The orchestrator writes its own pick first. For idea panels, reply as Position / Reasoning / Risk / Surprise in ≤300 words. Panel width by `args.scale`: `idea-tournament` small 1 (one combined 3-persona agent), medium 3, large 5; `judge-panel` small 2, medium 4, large 6 (as set in `workflows/*.js`).

**Technical judge**: weighs T, D, S
- Looks for: a hard part narrated in 20 s; a model named with the reason it beat the obvious alternative; an eval method and number; an architecture diagram; robustness to new input.
- Red flags: thin API wrapper, frontend-only chat, hardcoded outputs, a team that can't explain the AI-written core.
- Killer questions: "What was the hardest part, and how did you solve it?" · "Why this model over the obvious alternative?" · "How did you measure output quality?" · "What did the AI write and what did you write?" · "Can I try my own input?"

**Product / impact judge**: weighs I, U, O
- Looks for: a named user, quantified pain with a source, today's workaround, before/after in the demo, ≤3 features shown.
- Red flags: "for everyone", unsourced statistics, a feature tour with no story.
- Killer questions: "Who exactly is the user?" · "What do they do today, and what does it cost?" · "How do you know they want this?" · "What's next?"

**Sponsor rep**: weighs S plus their own prize
- Looks for: their tech on the golden path, on screen in the video, in a "How we used X" README section and named in the pitch; creative use beyond the basics.
- Red flags: logo-stuffing, sponsor API in a side feature, a missing prize write-up.
- Killer questions: "Which of our tools did you use, where in the code, and why?" · "What breaks if you remove our tech?" · "Which challenges did you solve with it?" (ETHGlobal Q&A)

**Skeptical VC**: weighs I, O
- Looks for: who pays, why now, edge (domain data, reachable users), honest limits. Impact on a specific user beats market-size slides (02).
- Red flags: "the TAM is huge", a feature an incumbent ships next quarter, mocked parts presented as live.
- Killer questions: "Who pays?" · "Why now?" · "What's real and what's mocked?" · "Why does this need AI at all?"

**Non-technical judge**: weighs U, I, D
- Looks for: passing the one-sentence test after 1 minute; a visible non-chat artifact; one memorable moment; no jargon.
- Red flags: chat bubbles as the only output, dead air while agents run, setup or login screens, acronyms.
- Killer questions: "In one sentence, what does it do?" · "Who would use this tomorrow?" · "What am I looking at right now?"

**LLM pre-screener**: all criteria, text only, never runs the app
- Reads: Devpost story, README, video script or transcript, repo tree and commit history.
- Looks for: one heading per `rubric.json` criterion with evidence under each; the required tech named with its location in the code; consistent claims across artifacts; a live demo URL and a public video link.
- Red flags: missing criterion headings, metrics with no method, leftover TODOs, broken links, over-limit word counts, one giant commit.
- Implicit questions: "Where is the evidence for criterion X?" · "Is the required API on the golden path?" · "Do the text, video and repo agree?"
