---
name: ship
description: HackForge submission factory + Gate C — extracts verified FACTS.md, writes the judge-facing README, Devpost story, 5-slide pitch and timed video script, runs a two-reviewer fact/judge check, validates the submission checklist, and hands the human a final go/no-go. Use from FEATURE_FREEZE to SUBMITTED.
argument-hint: "[readme|devpost|pitch|video …] [small|medium|large]"
---

# Ship: facts → copy → review → checklist → Gate C

Start this no later than FEATURE_FREEZE (about 75% of the clock). Submit by SUBMITTED (about 92% of the clock, and never later than T-30m).

## Run
1. Gather links: `hackforge state get stack` (prodUrl, repoUrl) and the video URL if one exists. Read `video`, `criteria` and `openSourceRequired` from `.hackforge/rubric.json`.
2. Launch:
```
Workflow({
  scriptPath: "${CLAUDE_PLUGIN_ROOT}/workflows/ship-kit.js",
  args: {
    projectDir: "<absolute project root>",
    pluginRoot: "${CLAUDE_PLUGIN_ROOT}",
    now: "<date -u +%Y-%m-%dT%H:%M:%SZ>",
    criteria: <rubric.criteria>,
    video: <rubric.video>,
    openSourceRequired: <rubric.openSourceRequired>,
    links: { prodUrl: "…", repoUrl: "…", videoUrl: "…" },
    scale: "<hackforge state get scale — default medium>"
  }
})
```
   Optional:
   - `deliverables: ["readme","devpost","pitch","video"]` (a subset).
   - `fresh: true` rebuilds from the templates. By default, FACTS.md and existing deliverables are **updated in place**, so the team's edits and TODO answers survive.
   - `cheapModel: "sonnet"` runs the checklist validator on a cheaper model when nothing needs re-checking.
   - `mode: "checklist"` re-validates only the checklist: one agent, after the video is uploaded or links change. Pass the new `links`.
   - Pass `limits: <rubric.limits>` too (title, tagline and summary length).
3. Present: the review result per deliverable, the checklist (failed items and human-only items), and every remaining `TODO:`. The facts behind these TODOs belong to the team. Ask for them; do not fill them in.
4. **README:** the workflow drafts `.hackforge/ship/README.md`. Ask before replacing the repo's `README.md`, then copy it and commit.
5. **Video:** record the golden path. Copy `${CLAUDE_PLUGIN_ROOT}/templates/demo/record-demo.mjs` to `demo/`, fill STEPS from `VIDEO_SCRIPT.md`, run `node demo/record-demo.mjs --rehearse`, then run it without the flag. Convert with the ffmpeg line it prints. A human narrates (no TTS unless the rules allow it). The human uploads the video publicly or unlisted and tests it logged-out. Then run `hackforge checkpoint VIDEO_DONE --done --url <video url>`. It checks through oEmbed that the video is public or unlisted, not private or missing. After that, re-run the workflow with `mode: "checklist"` and the video link.
6. **Pitch:** open `.hackforge/ship/PITCH.html` in a browser and rehearse 3 times with a timer. Press `n` for speaker notes.

## Gate C: go / no-go
Show the checklist status, the review verdicts, the open TODOs and `hackforge clock`. Then call **AskUserQuestion**: "Ready to submit?" Offer Submit and "Fix first".
1. On "Submit", run `hackforge gate C --lock`. This records the go decision.
2. The **human** fills and submits the Devpost/organizer form at least 30 minutes before the deadline. HackForge never submits for them.
3. When they confirm, run `hackforge checkpoint SUBMITTED --done --url <submission url>`. A devpost.com URL is recorded but never fetched (ToS).

## Fallback (Workflow tool unavailable)
1. Have a `hackforge:storyteller` agent build FACTS.md.
2. Have it write each deliverable from the templates in `${CLAUDE_PLUGIN_ROOT}/templates/ship/`.
3. Have two separate agents review them: one fact-checks against FACTS.md, one reviews as a judge persona.
4. Fill the SUBMISSION_CHECKLIST.md template by running the checks yourself.

## Never
- Invent metrics, users, links, teammates or partnerships.
- Show mocked features as real.
- Leave a hash deployment URL behind login as the demo link.
- Commit `.env` or a real key. Run `hackforge secrets --tracked` before making the repo public.

Input: $ARGUMENTS
