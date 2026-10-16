---
name: doctor
description: HackForge minute-zero readiness check — verifies Node, git hygiene (.env ignored), Bright Data CLI auth, GitHub token, deploy/DB CLIs, Playwright, ffmpeg, workflow availability and MCP pins, and lists the fixes; optionally sets up a pinned MCP profile. Use before a hackathon starts or when a tool fails.
argument-hint: "[--probe] [mcp research|web|python|github]"
---

# Doctor: be ready before the clock starts

Run:
```bash
hackforge doctor
```
(Use `"${CLAUDE_PLUGIN_ROOT}/bin/hackforge" doctor` if `hackforge` is not on PATH.) Add `--probe` to also test whether Bright Data Discover is enabled for the key. When Discover is unavailable the call fails fast and costs nothing. When it works, it is about one paid call, logged in the web ledger.

Show the user only the **failures and the warnings relevant to their stack**, each with its fix. Do not run the fixes for them unless they say yes. Never log in, create accounts or type keys yourself: the user runs `bdata login`, `vercel login`, `gh auth login`, `/mcp` OAuth and so on.

## Minute-zero checklist (pre-event, ideally the day before)
- [ ] Claude Code ≥ 2.1.285. On Pro, turn on dynamic workflows in /config, or HackForge falls back to sequential agents.
- [ ] `git init`, with `.env*` gitignored **before the first commit** (`hackforge init` does this).
- [ ] Bright Data CLI is authenticated (`bdata login`). The free tier is 5,000 credits a month. HackForge's default budget is 300 per project (`hackforge web ledger`).
- [ ] `GITHUB_TOKEN` (a fine-grained, read-only PAT) or `gh auth login`. This raises search from 10 to 30 requests per minute and enables code search.
- [ ] Deploy CLI logged in (`vercel login`, or the Railway/Cloudflare/HF CLI). Do one throwaway hello-world deploy **in a separate repo**, because rules forbid pre-existing project code.
- [ ] DB: create the Supabase project on the day, since free projects pause after 7 days idle. Note `SUPABASE_PROJECT_REF`.
- [ ] Playwright + Chromium in the project (`npm i -D @playwright/test playwright && npx playwright install chromium`), and ffmpeg for video.
- [ ] Model/API keys in `.env.local` (names in `.env.example`), with provider spend caps set.
- [ ] Usage plan: route cheap work to smaller models, spread usage across teammates, check `/usage` at checkpoints. Never use ultracode during the event.

## MCP profiles (opt-in, exact-pinned; HackForge bundles none)
```bash
hackforge mcp                 # list profiles
hackforge mcp research        # print `claude mcp add` commands: parallel-search, deepwiki, grep, context7, huggingface (all keyless)
hackforge mcp web --write     # merge supabase, vercel, shadcn@4.21.5, chrome-devtools-mcp@1.11.0 (isolated, telemetry + CrUX off) into ./.mcp.json
hackforge mcp research --all  # also include extras: Bright Data MCP (token), Context7 with key, alphaXiv (OAuth)
```
Prefer the official vendor plugins when you want skills plus MCP together (`claude plugin install vercel@claude-plugins-official`, `supabase@…`, `context7@…`). After writing `.mcp.json`, the user must restart or run `/mcp` and approve the project servers. OAuth servers (Vercel, Supabase, HF) need one interactive `/mcp` login. Use `${VAR}` references only; never paste literal keys into `--header`, because they are stored in plaintext.

Optional deadline countdown in the Claude Code status bar: `hackforge statusline --snippet` prints the `statusLine` entry for `~/.claude/settings.json`. Plugins cannot set the status line themselves, so ask before editing settings.

Details for each tool: the `research-toolkit` skill (`references/mcp-catalog.md`).

Input: $ARGUMENTS
