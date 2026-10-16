# Submission: demo video, live pitch, Devpost, README, checklist, Q&A

Load this when you write `.hackforge/ship/*` (VIDEO_SCRIPT.md, PITCH.html, DEVPOST.md, README.md, SUBMISSION_CHECKLIST.md) or rehearse. Every fact comes from `ship/FACTS.md`. A missing fact becomes a `TODO`, never an invention: no URLs, metrics, users or teammates. HackForge never submits. A human fills in the Devpost form and uploads the video (DESIGN §6). Sources: research 06 §8–10 (primary), 02 §6.5–6.7, 05 §D–E, 08 C11–C12, D9. Tags: **[secondhand]**, **[unverified]**, **[inference]**.

## 1. Demo video

### Hard constraints by event (copy the event's into `rubric.json` `video`)
| Event | Length | Rules |
|---|---|---|
| MLH digital | ≤ 2:00 | State the hackathon name at the start. Disclose AI tools ([rules](https://github.com/MLH/mlh-policies/blob/master/standard-hackathon-rules.md)) |
| Anthropic Built with Opus 4.6 (Feb 2026) [secondhand] | ≤ 3:00 | Everything shown must be open source. 100–200-word summary |
| OpenAI Build Week (Jul 2026) | < 3:00 (judges need not watch past 3:00) | Public YouTube. Show how you used Codex/GPT-5.6 ([rules](https://openai.devpost.com/rules)) |
| ETHGlobal (2026) | 2:00–4:00, rejected outside that range | ≥ 720p. **No TTS/AI voiceover, no sped-up footage, no phone recording, no music-plus-captions-only video** ([details](https://ethglobal.com/events/scaling/info/details)) |
| Gemini 3 (2026) [unverified reprint] | 3:00 | About 200-word description |
| Older Devpost sponsor events | < 5:00 | Judges may score on text, images and video alone |

Hosting: public YouTube by default. Private videos can't be watched. Mark the video "not made for kids". Use unlisted only when the rules allow it.

### 3:00 template (AngelHack split, adapted)
| Time | Segment | Content |
|---|---|---|
| 0:00–0:10 | Hook | Event name (an MLH rule) + "X helps [named user] do [task] in [time] instead of [time]" |
| 0:10–0:30 | Problem | A real person and a real number with its source. One shot of today's workaround |
| 0:30–2:00 | Demo (about 50 %) | The golden path with real input. **The aha by 1:00.** Narrate the hidden work (retrieval, agents, verification), not the clicks. Show before/after. Include one memorable moment |
| 2:00–2:30 | How it works / hard part | One architecture diagram. The hardest engineering decision. **Name the model, say why it beat the obvious alternative, and say how you measured output quality.** Sponsor tech on screen |
| 2:30–2:50 | Impact + next | Who adopts it, pilot interest only if real, honest limits |
| 2:50–3:00 | Close | Name, production URL, team, thanks |

**2:00 variant:** Hook + Problem 0:00–0:20 → Demo, with the tech narrated over it, 0:20–1:40 → Impact + Close 1:40–2:00.

### Production checklist
- [ ] **Human narration** is the default. Use TTS only if `rubric.json` permits it and the team opts in. Never use it at ETHGlobal (08 C12).
- [ ] A human writes the script (AI-written scripts read as generic), reads it aloud and times it. Budget about 2.3 spoken words per second: 3:00 ≈ 410 words, 2:00 ≈ 275. Never speed up the audio to fit.
- [ ] Capture at 1080p; **≥ 720p is the floor**. Zoom into key UI moments. **Captions always on**, because judges often watch muted (hackathon-radar).
- [ ] Take footage from the golden-path script (Playwright `recordVideo`, the ECC `ui-demo` pattern: Discover → Rehearse → Record), or from OBS, QuickTime or Cap. Record 3 takes and keep the best.
- [ ] MLH: hackathon name in the first seconds. OpenAI-style events: required-tool use visible. Every claimed sponsor tech on screen.
- [ ] Upload early. YouTube gives the link before processing ends. **Open the link logged out, in incognito.**
- [ ] Keep the final MP4 on local disk as the live-demo backup.

```bash
# Playwright video has NO audio track: normalize the human narration, not the screen capture.
ffmpeg -i demo.webm -c:v libx264 -pix_fmt yuv420p -an demo.mp4                       # WebM → silent MP4 (live-demo backup)
ffmpeg -i demo.mp4 -i narration.wav -vf "subtitles=demo.srt" -c:v libx264 -pix_fmt yuv420p \
  -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -shortest demo_final.mp4                # mux voice + burn captions
ffprobe -v error -show_entries format=duration -of csv=p=0 demo_captioned.mp4        # seconds ≤ video.maxSeconds
```

## 2. Live pitch (`ship/PITCH.html`)

**≤ 5 slides, ≤ 4 bullets each.** The live demo runs in the app tab right after slide 2; slide 3 only holds the backup video (06 §9, 08 C11). This matches `templates/ship/pitch.html`. Extra beats from the 8-slide flow in 02 (solution, team, roadmap) go to an appendix and the Devpost gallery.

| # | Slide | Content | 3-min slot |
|---|---|---|---|
| 1 | Title | Name, one-liner, the named user | 0:00–0:10 |
| 2 | Problem | One number with its source. Today's workaround | 0:10–0:30 |
| 3 | **Live demo** (backup slide) | Switch to the app: golden path, aha by 1:00. Backup video one keypress away (V) | 0:30–2:00 |
| 4 | How it works / hard part | One diagram. Model named, plus why. What is real | 2:00–2:30 |
| 5 | Evidence + impact + sponsors | Eval number, before/after, a user quote (paraphrased and linked, no usernames). Who adopts it, next step, sponsor tech actually used, team | 2:30–3:00 |

| Slot | Shape |
|---|---|
| MLH expo table (about 2 min demo + 1 min Q&A per judge) | 0–1 opening slide, then demo at once. MLH does not score the pitch |
| 3 min on stage | The table above |
| 5 min | Extend the demo and next steps, not the intro (AngelHack) |
| ETHGlobal finalist | 4 min demo + 3 min Q&A |
| Async judging | The video is the pitch |

- The demo-owner presents, keeps running pitch notes, and memorizes 4–5 transition phrases rather than the copy. Rehearse aloud ×3, once in front of an outsider.
- `PITCH.html` carries an **animated fallback demo slide** in case the backend dies on stage (beautiful-hackathon-slides).
- **Live-demo insurance:** `DEMO_MODE=1` on, fixtures loaded, backup video on local disk, phone hotspot, browser zoomed in, notifications off, tabs pre-opened.

## 3. Devpost story (`ship/DEVPOST.md`, pasted in by a human)

Standard headings, mapped to the default rubric (D demo, T depth, I impact, O originality, S sponsor, U UX):

| Heading | Feeds | Content (from FACTS.md) |
|---|---|---|
| Inspiration | I | Named user, the number, its source |
| What it does | D, U | 3 bullets + a GIF of the aha. First drafted at SPEC_LOCK |
| How we built it | T, S | Architecture, the hard part, each sponsor tech and where it sits, how AI agents were used |
| Challenges we ran into | T | Hardest bug, what we cut and why |
| Accomplishments that we're proud of | D, O | Eval number, what works live |
| What we learned | MLH "Learning" 25 | New tech we stretched into |
| What's next | I | Honest limits, a real next step |

- Also add **one heading per judging criterion, named exactly as in `rubric.json`**, so humans and any AI pre-screen can map evidence to scores (OpenAI's rules allow "automated AI-driven analysis"). Ties often go to the first listed criterion, so give that one extra weight.
- Media: thumbnail JPG/PNG/GIF, ≤ 5 MB, 3:2 ratio. Gallery of 3–6 screenshots plus a GIF of the aha.
- Respect word limits (Anthropic summary 100–200 words; Gemini about 200 [unverified]). Each claimed sponsor prize gets its own write-up. At ETHGlobal that write-up is the only way a partner assesses you.

## 4. Judge-facing README (repo root; draft in `ship/README.md`)

**Rule: TODO placeholders instead of invented facts.** Every command, path and URL must exist in the repo or in FACTS.md. Unknowns become a visible `TODO: …` line, never a hidden HTML comment (dontreadme: never fabricate a demo URL, a metric or a teammate). Gate C shows the TODOs that remain.

```markdown
# <Name>: <one-line value for a named user>
[Live demo](<production alias>) · [Video](<YouTube>) · [Devpost](<url>)
## Judge quickstart (≤ 60 s)
1. Open <production alias> (no login; any test credentials are in the submission form, never here)
2. Click "<Load sample case>"  3. Press "<Run>" → watch <aha>
## Judging highlights          one line per rubric criterion → where to see it
## The problem                 one number + source
## What it does                3 bullets + GIF
## How it works                diagram; the hard part
## Evaluation                  dataset, metric, result; how we measured quality
## Built with <Sponsor A>      one section per sponsor: what, where in code, why load-bearing
## How we used AI coding agents  tools/models; what AI generated vs what we designed/wrote;
                               key human decisions; spec/plan files (.hackforge/spec/); session IDs if required
## What's real vs mocked       from .hackforge/spec/FAKE_VS_REAL.md
## Limitations & next steps
## Run locally                 env var names in .env.example, never real keys
## License                     OSI licence if the rules require open source
## Team                        real members only, as in .hackforge/HACKATHON.md
```

## 5. Submission checklist (`ship/SUBMISSION_CHECKLIST.md`; `hackforge gate C --lock` requires it)

- [ ] Every field in `rubric.json` `submissionFields` is complete. Track or category selected.
- [ ] **Links** (production alias, video, repo) open from a fresh incognito window **and on a phone**. No auth wall, or test credentials in the form. The site stays up until judging ends.
- [ ] **Video** is public (or unlisted if allowed) and within `video.maxSeconds`, tested logged out. Hackathon named (MLH). Required-tool use shown. No AI voiceover (ETHGlobal).
- [ ] **Repo** is public (or shared as the rules require), with a licence file, a README judge quickstart and `.env.example`.
- [ ] **No secrets in history:** `hackforge secrets --history` (every commit on every ref, including the root) and `hackforge secrets --tracked` (the current tree) both exit 0. Rotate any key that ever reached a commit, and rotate all keys after the event.
- [ ] **Incremental commits** with timestamps inside the event window. ETHGlobal may disqualify one giant commit. Check with `git log --since="<start ISO>" --oneline | wc -l`.
- [ ] **Stacking rule:** prize opt-ins stay within `rubric.json` `prizeStacking` (OpenAI: one prize per project; ETHGlobal: up to 3 partner prizes). Each claimed sponsor appears in the video, in a README section and in the pitch.
- [ ] **Sponsor opt-ins** are ticked in the form, each with its write-up.
- [ ] **AI disclosure** section present (MLH, ETHGlobal). Spec, plan and prompt files committed (ETHGlobal).
- [ ] Pre-existing work and templates are separated and disclosed (`preExistingCode`).
- [ ] **Devpost duplicate check.** The ToS bans submissions that substantially duplicate a prior entry. Run `hackforge saturation "<keywords>"` or `hackforge web count "site:devpost.com <words>"`, then have a human open the 3 nearest projects. Never scrape Devpost.
- [ ] **Screenshots and gallery** uploaded, plus the thumbnail.
- [ ] **Team members** added on Devpost (real people only, ≤ `teamMax`).
- [ ] Word limits met.
- [ ] **Final sequence, in order:** lock Gate C (the go decision), then a human submits ≥ 30 min before the deadline (aim for 120) and saves the confirmation screenshot, then run `hackforge checkpoint SUBMITTED --done --url "<submission URL>"`. The devpost.com URL is recorded, not fetched: HackForge never fetches devpost.com.

## 6. Q&A drill (`build/QA_DRILL.md`, written by `judge-panel`)

Q&A can run as long as the demo (AngelHack tip 9). Keep each answer ≤ 20 s: one fact plus one pointer (a file, a number or a screen). Every teammate answers question 6 for their own domain.

| # | Question | A strong answer has |
|---|---|---|
| 1 | Who is the user? | A named role, the quantified pain, today's workaround |
| 2 | Who pays? | Buyer vs user. A pilot or price anchor only if it is real |
| 3 | What's real vs mocked? | Read from `FAKE_VS_REAL.md`, without hedging |
| 4 | Why this model, over the obvious alternative? | What you tried, what it beat, and how you measured that |
| 5 | How did you measure quality? | Dataset, metric, result. The number on screen |
| 6 | What did the AI write, and what did you? | Problem framing, domain data, architecture, eval design, and the core 20 % you can whiteboard |
| 7 | What was the hardest bug? | Symptom → cause → fix in 3 sentences |
| 8 | What's next? | One concrete step and who adopts it |

ETHGlobal adds: What inspired it? Which tools did you use, and why? Which challenges did you solve? Further drills [inference]: What breaks without the model? How does this differ from the nearest prior art? What happens if the API is down right now?
