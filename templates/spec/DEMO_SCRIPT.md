<!-- HackForge template, copied to .hackforge/spec/DEMO_SCRIPT.md by /hackforge:spec (architect agent). Gate B needs this file and spec/SLICES.md.
The demo script IS the spec: code exists only to make these beats work. At most 3 features on screen; everything else goes to PRD "What's next".
The golden-path test (e2e/golden-path* or tests/golden-path*) walks these beats exactly. It is the smoke test, the qa-runner's script and the video recorder, and guard-edits protects it after Gate B.
The "Test id / selector" column names, for every beat, the stable data-testid (or accessible role + name) the test clicks and asserts on. The architect writes the test against these before Gate B locks; builders implement exactly these test ids in the app and never edit the test.
Narrate the hidden work (retrieval, agents, verification), not the clicks. Every live step needs a fallback. -->

# Demo script: {{Name}}

**Aha (by 1:00):** {{what appears on screen}} · **Before → after:** {{e.g. 3 weeks → 5 hours}}
**Demo URL:** {{production alias or custom domain, never the deployment-hash URL}} · **Presenter:** {{name}}

## 90-second core (table demo / finalist stage)
| Time | Screen | Do | Say (hidden work, not clicks) | Data on screen | Test id / selector (click → assert) | Fallback if it fails |
|---|---|---|---|---|---|---|
| 0:00 | Landing, sample case preloaded | — | "{{hook with a number}}" | {{seed case A}} | {{e.g. `hero-title` shows "…"}} | Screenshot slide |
| 0:15 | {{screen}} | {{step 1}} | {{what the system does behind it}} | {{…}} | {{e.g. `load-sample` → `input-preview` visible}} | DEMO_MODE cached response |
| 0:35 | {{screen}} | {{step 2}} → **AHA** | "{{before/after line}}" | {{artifact}} | {{e.g. `run` → `artifact` contains "…"}} | Pre-recorded clip of this beat |
| 1:05 | {{screen}} | Run a judge-style input variant | "{{robustness or eval number}}" | {{seed case B}} | {{e.g. textbox "…" filled, `run` → `artifact` contains "…"}} | Switch to seed case B |
| 1:20 | {{screen}} | — | "{{impact + what's next}}" | — | {{e.g. `eval-number` shows a number}} | — |

## 3-minute video version
<!-- ship/VIDEO_SCRIPT.md is generated from this table and adds full human narration and captions. -->
| Time | Segment | Screen | Do | Narration cue | Data |
|---|---|---|---|---|---|
| 0:00–0:10 | Hook | Title / product | — | Event name + one-line value | — |
| 0:10–0:30 | Problem | Today's workaround, 1 shot | — | Real person, real number | {{source}} |
| 0:30–1:00 | Demo: to the aha | Beats 0:15–0:35 above | {{steps 1–2}} | Hidden work | {{seed case A}} |
| 1:00–2:00 | Demo: depth | Variant input, before/after | {{step 3}} | Memorable moment | {{seed case B}} |
| 2:00–2:30 | Hard part | Architecture diagram, sponsor tech on screen | — | Model named, why, how quality was measured | {{eval number}} |
| 2:30–2:50 | Impact & next | {{…}} | — | Who adopts, honest limits | — |
| 2:50–3:00 | Close | URL + team | — | Name, URL, thanks | — |

## Seed data
| Item | File / table | Realistic, not lorem ipsum? | Source |
|---|---|---|---|
| {{seed case A}} | {{path}} | {{yes}} | {{public dataset / research/… / hand-made}} |
| {{seed case B}} | {{path}} | {{yes}} | {{…}} |

- Clipboard-ready inputs: {{…}}
- Judge's own input: {{what a judge might type}} → {{expected behaviour, or graceful message}}

## DEMO_MODE
`DEMO_MODE=1` gives seeded data, a guest user (no login wall) and cached responses for: {{slow or flaky calls}}.
Cache files: `{{path}}` · Recorded from real runs on {{date}} (disclose in spec/FAKE_VS_REAL.md)

## Reset procedure (before every rehearsal and recording)
```sh
{{reset command, e.g. npm run demo:reset}}    # restores seed state
{{verify command}}                            # expect: {{output}}
```

## Live-demo insurance
- [ ] Backup video on local disk: `{{path}}` (recorded at WOW_WORKS, re-recorded at FEATURE_FREEZE)
- [ ] Phone hotspot ready · browser zoomed in · notifications off · tabs pre-opened
- [ ] Fixtures load with Wi-Fi off
