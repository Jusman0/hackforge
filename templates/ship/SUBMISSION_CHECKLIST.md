<!-- HackForge template, copied to .hackforge/ship/SUBMISSION_CHECKLIST.md by the ship-kit workflow (checklist validator). Its existence is the prerequisite for `hackforge gate C --lock`.
Tick a box only after running its check, and write the evidence after the arrow. Items that do not apply: tick and write "n/a: reason".
HackForge never submits. A human fills the form, uploads the video and clicks submit. Do not automate devpost.com (ToS §4). -->

# Submission checklist: {{Name}}

Deadline: {{YYYY-MM-DD HH:MM tz}} · SUBMITTED due: {{from `hackforge clock` / `hackforge checkpoint list`}} · Done: {{n}}/{{total}}

## Links
- [ ] Prod URL (alias or custom domain, not the deployment-hash URL) returns 200: `curl -s -o /dev/null -w "%{http_code}" {{prodUrl}}` →
- [ ] Opens in a fresh incognito window AND on a phone, with no auth wall (or test creds in the form) →
- [ ] Golden path passes against prod: {{golden-path command with base URL = prodUrl}} exits 0 →
- [ ] Stays up through judging: no free-tier pause or sleep (e.g. Supabase free projects pause after 7 idle days) →
- [ ] Repo URL and video URL open logged-out →

## Video
- [ ] Every box in the ship/VIDEO_SCRIPT.md constraint checklist is ticked →
- [ ] VIDEO_DONE shows done in `hackforge checkpoint list` →

## Repo
- [ ] Public, or shared as the rules require (open the repo URL logged-out) →
- [ ] Licence present if `openSourceRequired`: `test -f LICENSE && echo ok` →
- [ ] No secrets in tracked files: `hackforge secrets --tracked` exits 0 →
- [ ] No secrets in history: `hackforge secrets --history` exits 0 (every commit on every ref, including the root; `--tracked` above covers the current tree) →
- [ ] `.env*` ignored: `git check-ignore -v .env .env.local` lists both; `.env.example` holds names only →
- [ ] Incremental history inside the event window: `git rev-list --count HEAD` and `git log --reverse --format='%ci %s' | head -3` →
- [ ] `.hackforge/` committed except `web/`, `dev.*` and `nudge.json`: `git status --short --ignored .hackforge` →

## README
- [ ] Repo-root README.md is the approved judge README; its quickstart works exactly as written in incognito →
- [ ] "Judging highlights" has one row per rubric.json criterion →
- [ ] "How we used AI coding agents" and "What's real vs mocked" sections present →
- [ ] No blanks or TODO-markers left in the deliverables (HTML comments stripped; this checklist and FACTS.md, whose "## TODO" section is legitimate, are not scanned): `for f in README.md .hackforge/ship/README.md .hackforge/ship/DEVPOST.md .hackforge/ship/VIDEO_SCRIPT.md .hackforge/ship/PITCH.html; do [ -f "$f" ] && perl -0pe 's/<!--.*?-->//gs' "$f" | grep -nE '\{\{|TODO[:(]' | sed "s|^|$f:|"; done` prints nothing →

## Submission fields (rubric.json `submissionFields`)
- [ ] title, tagline, story, built_with, video, repo, demo_url pasted from ship/DEVPOST.md →
- [ ] Summary within the word limit: {{n}} words (`wc -w`) →
- [ ] Track or category selected; every teammate added; team size ≤ `teamMax` →
- [ ] Thumbnail (JPG/PNG/GIF, ≤5 MB, 3:2), 3–6 screenshots and an aha GIF uploaded →
- [ ] Draft saved well before the deadline →

## Sponsors
- [ ] Prizes selected stay within `prizeStacking` →
- [ ] Each claimed sponsor tech is on the golden path, on screen in the video, has its own README section and its own write-up →

## Compliance
- [ ] Every `stage1Gates` item met, with evidence →
- [ ] `preExistingCode` rule respected; starters and HackForge templates disclosed →
- [ ] AI-use disclosure present (`aiDisclosure`) →
- [ ] Not a substantial duplicate of a prior submission (ideas/IDEA.md saturation evidence) →
- [ ] Every claim in the copy traces to ship/FACTS.md; ship/REVIEW.md verdict is PASS from both reviewers →

## Rehearsal
- [ ] build/JUDGE_REPORT.md fixes triaged; build/QA_DRILL.md answered aloud by the presenter →
- [ ] Pitch rehearsed 3 times, timed, once to an outsider →
- [ ] Backup video on local disk; DEMO_MODE fixtures load with Wi-Fi off; hotspot ready →

## Final sequence (after 100% above, in this order)
1. Gate C, the go decision: `hackforge gate C --lock --note "<who approved>"`
2. A human submits at least 30 min before the deadline and saves the confirmation screenshot to `<path>`. HackForge never submits.
3. `hackforge checkpoint SUBMITTED --done --url "<submission URL>"`. The devpost.com submission URL is recorded, not fetched: HackForge never fetches devpost.com.
