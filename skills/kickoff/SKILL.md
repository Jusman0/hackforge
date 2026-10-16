---
name: kickoff
description: HackForge intake — turns the hackathon's rules/brief (pasted text or one consented page fetch) into .hackforge/HACKATHON.md, rubric.json (criteria + weights + gates + video rules) and state.json with a deadline clock; runs the readiness doctor. Use at the start of a hackathon or when the rules change.
argument-hint: "[rules URL or 'paste'] [deadline]"
---

# Kickoff: rules → rubric → clock

The rubric is the root object. Every later score and artifact is weighted by it.

**CLI:** `hackforge` (or `"${CLAUDE_PLUGIN_ROOT}/bin/hackforge"` if it is not on PATH).

## 1. Gather the facts (ask only for what is missing; one AskUserQuestion round at most)
- Event name, URL, theme or tracks, **start and deadline with timezone**, format (24h / 48h / week), team size, each member's role, skills, domain expertise and **Claude plan** (Pro / Max / Team / API), and preferred stack (`web` | `python` | `mobile` | `custom`).
- **Rules source.** Prefer text the user pastes. If they give a URL, fetch **only that page, once**, with WebFetch, or with `hackforge web scrape <url> --print` if WebFetch is blocked. For devpost.com URLs, add `--consented` and only use it because the user explicitly asked you to read that one page. Never crawl. Save the raw rules text verbatim to `.hackforge/RULES.md`, so later phases can re-check it.

## 2. Initialize
From the project root (the hackathon repo; run `git init` first if needed):
```bash
hackforge init --name "<event>" --theme "<theme>" --start <ISO> --deadline <ISO with offset> --tz <IANA> --format <24h|48h|week> --team-size <n> --stack <web|python|mobile|custom> --scale <small|medium|large>
```
`--scale` sets how wide the workflows fan out. Use **small** for Pro plans or a small workflow-size guideline, **medium** (about 9 agents per workflow) for Max/Team/API, and **large** only when asked.
This creates `.hackforge/`, computes the checkpoints, copies the default rubric, and gitignores `.env*` and the caches. Re-running it updates the timing without losing gates.

## 3. Write the rubric and event facts
- Fill `.hackforge/HACKATHON.md` from the template already copied there. Cover: rules summary, criteria and weights, Stage-1 pass/fail gates (theme fit, required sponsor API), tie-break order, prizes table with the **stacking rule**, submission fields, video limits and bans (e.g. "no TTS"), pre-existing code rule, open-source rule, AI-disclosure rule, team limits.
- Overwrite `.hackforge/rubric.json` with the event's real criteria (schema in `${CLAUDE_PLUGIN_ROOT}/docs/DESIGN.md` §4.2). Weights sum to 100. Give each criterion 1/3/5 anchors written in the event's own language. Set `source` to `"url:<url>"` or `"paste"`.
- **Re-map `ideaWeights`** (P W A T S N E, summing to 1.0) to the rubric. See `${CLAUDE_PLUGIN_ROOT}/skills/playbook/references/judging.md` and `ideas.md`. Examples: an Anthropic-style demo-heavy rubric raises W and A; MLH raises T and adds learning; a tech-heavy rubric raises T.
- If no rubric is published, keep the default (D25 T20 I20 O15 S10 U10) and say so.
- Record sponsors and prizes: `hackforge state set sponsors '<json array>'` (name, prize, value, requirement, targeted).
- Record team details: `hackforge state set team '<json>'` with `members: [{name, role, skills, plan}]`. Roles are driver, integrator, demo-owner and researcher; one integrator merges to main.

## 4. Readiness
Run `hackforge doctor` and show the user only the failures and warnings that matter for their stack. Offer, but do not run without a yes:
- the **research** MCP profile, which is keyless: `hackforge mcp research` prints the `claude mcp add` commands, and `--write` merges them into `.mcp.json`. The build profiles (`web` / `python`) come later, in `/hackforge:spec`, once the stack is chosen;
- the optional status-line countdown (`hackforge statusline --snippet`);
- an initial commit.
Never create accounts, never sign in for the user, and never put key values in files.

## 4b. Track B (team of 2+): start it now, in parallel with research
Teammate 2 (or a second Claude session) should:
- create the public repo and remote;
- deploy a hello-world of THIS repo to its production alias and run `hackforge state set stack.prodUrl <alias>`;
- install Playwright (`npm i -D @playwright/test playwright && npx playwright install chromium`);
- smoke-test every sponsor and model API key with one call each (keys in `.env.local` only).

`hackforge next` repeats this as its `parallel` hint until Gate B. A solo hacker does it while the research workflow runs in the background.

## 5. Report
Give the user a 4-line summary: deadline in their timezone, the checkpoint times (`hackforge checkpoint list`), rubric weights, and the next step (`/hackforge:research`, or `/hackforge:ideate` if they already have an idea).

Input: $ARGUMENTS
