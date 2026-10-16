<!-- HackForge template, copied to .hackforge/ship/VIDEO_SCRIPT.md by the ship-kit workflow. Built from spec/DEMO_SCRIPT.md + ship/FACTS.md.
Narration is read by a human in their own voice. Some events ban TTS/AI voiceover, and AI-written scripts read as generic: rewrite lines in your own words.
Budget about 2.3 spoken words per second (3:00 ≈ 410 words, 2:00 ≈ 275). Read it aloud and time it; cut words, never speed up audio or footage.
Capture: the golden-path Playwright script (scripted, reproducible) or OBS / QuickTime at 1080p. Captions always on: judges may watch muted.
Every number spoken must exist in ship/FACTS.md; depict only what works (spec/FAKE_VS_REAL.md). Pick the table that fits rubric.json `video.maxSeconds`. -->

# Video script: {{Name}}

Limit: {{video.maxSeconds}} s (min {{video.minSeconds}} s) · Target: {{m:ss}} · Narrator: {{name}} · Host: {{public YouTube}}

## 3:00 version
| Time | Segment | On-screen | Narration (human) | Caption (≤60 chars) |
|---|---|---|---|---|
| 0:00–0:10 | Hook | Title card, product | "{{event name}}: {{Name}} helps {{user}} {{task}} in {{time}} instead of {{time}}." | {{…}} |
| 0:10–0:30 | Problem | Today's workaround, 1 shot | {{real person + real number, F-11}} | {{…}} |
| 0:30–1:00 | Demo: to the aha | Golden-path beats 1–2, aha by 1:00 | {{the hidden work, not the clicks}} | {{…}} |
| 1:00–2:00 | Demo: depth | Judge-style input, before/after, the memorable moment | {{…}} | {{…}} |
| 2:00–2:30 | How it works / hard part | Architecture diagram; sponsor tech on screen | {{model named, why it beat the obvious alternative, how quality was measured (F-30)}} | {{…}} |
| 2:30–2:50 | Impact and next | {{…}} | {{who adopts it; honest limits}} | {{…}} |
| 2:50–3:00 | Close | URL, team names | {{name, URL, thanks}} | {{URL}} |

## 2:00 version
| Time | Segment | On-screen | Narration (human) | Caption (≤60 chars) |
|---|---|---|---|---|
| 0:00–0:20 | Hook + problem | Title card, then the workaround shot | "{{event name}}: {{one-line value}}" + {{the number}} | {{…}} |
| 0:20–1:40 | Demo, tech narrated over it | Golden path, aha by 1:00, sponsor tech visible | {{hidden work; model and why; eval number}} | {{…}} |
| 1:40–2:00 | Impact + close | URL, team names | {{who adopts it; name, URL}} | {{URL}} |

## Constraint checklist (rubric.json `video`)
- [ ] Length within limits: `ffprobe -v error -show_entries format=duration -of csv=p=0 "{{video file}}"` prints ≤ `video.maxSeconds` and ≥ `video.minSeconds`
- [ ] Every `video.mustInclude` item is present: {{item → timestamp}}
- [ ] No `video.bans` item is used: {{e.g. TTS/AI voiceover, sped-up footage, phone recording, music + captions only}}
- [ ] Human narration (TTS only if the rules explicitly allow it AND the team opted in)
- [ ] Resolution meets the rules: {{≥720p}}; recorded at 1080p
- [ ] Captions burned in or uploaded
- [ ] Each claimed sponsor tech is visible on screen: {{sponsor → timestamp}}
- [ ] Aha lands by 1:00
- [ ] Uploaded with public visibility; link opened in a logged-out window
- [ ] Local copy saved at `{{path}}` as the live-demo backup
- [ ] Recorded: `hackforge checkpoint VIDEO_DONE --done --url "{{public video URL}}"`
