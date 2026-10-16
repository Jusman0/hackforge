# 04: Build and ship toolchain for HackForge (MCPs, CLIs, templates, services)

**Research date:** 2026-10-15. **Scope:** the best MCP servers, CLIs, plugins, templates and services for taking a hackathon idea to a deployed, demo-ready MVP with Claude Code within hours.

**Confidence legend:**
- **[V]** verified against the vendor's own docs or README fetched today.
- **[S]** secondary source (blog or mirror). Treat it as likely but unconfirmed.
- **[I]** inferred by me from the generic Claude Code syntax. Test before relying on it.
- **[STALE?]** may have changed recently.

---

## 0. TL;DR for HackForge

1. **Install plugins, not raw MCP configs, wherever a plugin exists.** In 2026 the official Anthropic marketplace `claude-plugins-official` (315 entries today) ships first-party plugins for **vercel, supabase, stripe, figma, playwright, context7, chrome-devtools-mcp, cloudflare, convex, neon, firebase, expo, railway, render, netlify-skills, resend, sentry, posthog, huggingface-skills, frontend-design, playground** and more. Each one bundles the vendor MCP server, vendor skills and slash commands, and updates through the marketplace. Install them with `claude plugin install <name>@claude-plugins-official`, or with `/plugin install ...` inside a session. [V] Source: https://raw.githubusercontent.com/anthropics/claude-plugins-official/HEAD/.claude-plugin/marketplace.json
2. **The default MVP stack is Next.js (App Router, TS, Tailwind) + shadcn/ui + Supabase + Vercel + the Anthropic SDK.** Use Playwright CLI and Chrome DevTools MCP for QA and Context7 for live docs. This path has the fewest accounts (GitHub, Vercel, Supabase, Anthropic). Every piece has an official OAuth MCP and a Claude Code plugin, and the first production deploy takes under 15 minutes.
3. **Prefer a CLI plus a skill for stateless work, and an MCP for OAuth-gated account operations and stateful browsers.** This matches ECC's own 2026 policy (one default MCP) and Microsoft's guidance for coding agents (Playwright CLI over Playwright MCP). Claude Code's tool search now defers MCP tool schemas by default, so the context cost of *configured* servers is small. The cost of *verbose tool results* (DOM trees, screenshots, logs) is still large.
4. **ECC's `mcp-configs/mcp-servers.json` is partly stale.** Do not copy it verbatim. Railway's npm server is deprecated. "Magic MCP" was renamed to 21st MCP and old keys were reset. Cloudflare now recommends its single API MCP. fal, ElevenLabs and Supabase have official hosted OAuth servers that replace the community or local ones (see §9).
5. **Do the minute-zero setup before the clock starts** (§8): accounts, CLI logins, MCP OAuth, a spend cap on every paid API, and a `hf-doctor` readiness check. Most lost hackathon hours go to auth, keys and deploy configuration, not code.

---

## 1. How Claude Code consumes these tools (late-2026 mechanics HackForge must design around)

**Adding servers** [V] (https://code.claude.com/docs/en/mcp)

```bash
claude mcp add --transport http <name> <url> [--header "Authorization: Bearer ..."]
claude mcp add [--env K=V] <name> -- <command> [args...]      # stdio
claude mcp add-json <name> '{"type":"http","url":"..."}'
claude mcp list ; claude mcp get <name> ; /mcp   # /mcp also runs OAuth
claude mcp login <name> [--no-browser]
```

**Scopes:** `local` (default, private, stored in `~/.claude.json`), `project` (`.mcp.json` at the repo root, shared through git, needs approval on first use) and `user` (all projects). Precedence: local > project > user > plugin > claude.ai connectors. Connectors a user added in claude.ai therefore also show up in Claude Code. [V]

**Env expansion in `.mcp.json`:** `${VAR}` and `${VAR:-default}` work in `command`, `args`, `env`, `url` and `headers`. Credential-looking variables such as `ANTHROPIC_API_KEY` and `NPM_TOKEN` expand to *empty* inside remote `url`/`headers` as a protection, so use your own variable names (`FAL_KEY`, `CONTEXT7_API_KEY`). [V]

  → **HackForge rule:** never write secrets into `.mcp.json` or pass them literally to `claude mcp add --header`. A literal header gets stored in plaintext in `~/.claude.json`. Commit `.mcp.json` with `${VAR}` references and keep the values in `.env.local` or the shell.

**Tool search is on by default.** Tool definitions are deferred and only names plus server instructions load at startup. `ENABLE_TOOL_SEARCH=auto:N` gives threshold mode and `=false` loads everything upfront. `alwaysLoad: true` on a server pins it. [V] The old "keep under 10 MCPs" rule (ECC `mcp-servers.json` `_comments.context_warning`) is now mostly about tool-*result* volume and startup latency, not schema tokens.

**Output limits:** `MAX_MCP_OUTPUT_TOKENS` defaults to 25,000. Text results over 50,000 chars are saved to a file in `tool-results/`. Image results stay inline and are subject to the token limit. [V]

**Plugins** bundle MCP servers, skills, slash commands, agents and hooks. Tool names become `mcp__plugin_<plugin>_<server>__<tool>`, so HackForge permission rules and hooks must use that full form. [V]

**Reserved server names** you cannot use: `workspace`, `claude-in-chrome`, `computer-use`, `Claude Preview`, `Claude Browser`. [V]

**Neutral installers** used by several vendor docs: `npx add-mcp <url> [-a claude-code] [-g] [-y]`, used by Vercel and Neon [V], and the skills CLI `npx skills add <owner/repo> [--skill name]` from skills.sh [S].

---

## 2. Scaffolding and UI

| Tool | What it enables in a hackathon | Exact install / usage | Auth / cost | Gotchas |
|---|---|---|---|---|
| **create-next-app** | Full-stack TS app with route handlers for LLM calls, streaming UI, Vercel-native | `npx create-next-app@latest my-app --yes` takes the recommended defaults: TypeScript, ESLint, Tailwind, App Router, **AGENTS.md + CLAUDE.md** (`--agents-md` is on by default) [V/S] (https://nextjs.org/docs/app/api-reference/cli/create-next-app) | Free | Node ≥ 20.9. Turbopack is the default dev bundler. In Next 16+ `middleware.ts` became `proxy.ts` (ECC `skills/nextjs-turbopack`). The exact latest version is unverified [STALE?]; run `npx create-next-app@latest --help` |
| **Vite** | SPA / static front end for a Python or other backend, Cloudflare Pages, etc. | `npm create vite@latest my-app -- --template react-ts` | Free | No server runtime, so you need a separate API (FastAPI, Workers, Supabase Edge Functions) |
| **shadcn/ui CLI v4** | Owned-source components, presets, registry installs (Magic UI, Aceternity, private) | `npx shadcn@latest init` (or the `create` flow with presets; `--base radix` or `--base aria`; **Base UI has been the default since July 2026**). `npx shadcn@latest add button card dialog`. Inspect first with `--dry-run`, `--diff`, `--view` [S] | Free | `apply <preset>` overwrites CSS variables and config. Agents trained on older Radix-based snippets may generate Radix APIs, so pin a base in CLAUDE.md |
| **shadcn MCP** | Claude browses, searches and installs from any shadcn-compatible registry (`@acme/...` namespaces) | `npx shadcn@latest mcp init --client claude` (docs show `pnpm dlx`), or `.mcp.json`: `{"shadcn":{"command":"npx","args":["shadcn@latest","mcp"]}}` [V] (https://ui.shadcn.com/docs/mcp) | Free. Private registries via `headers` + `${REGISTRY_TOKEN}` in `components.json` | Name the registry in the prompt to avoid ambiguity. Keyless and safe enough to include in the default `.mcp.json` |
| **21st MCP** (formerly "Magic MCP") | `/ui`-style generation of polished React/Tailwind components, plus "inspiration" search | `npx @21st-dev/cli@latest init --client claude`, or HTTP `https://21st.dev/api/mcp` with header `x-api-key: ${TWENTY_FIRST_API_KEY}`. Plugin: `claude plugin marketplace add 21st-dev/magic-mcp` then `/plugin install 21st` [V] (https://github.com/21st-dev/magic-mcp) | Credit-based free tier, paid plans. Pricing pages conflict [STALE?] | **Old Magic API keys were reset.** `@21st-dev/magic` is now only a compatibility proxy. Generated components can be heavy, so keep a design system |
| **Magic UI MCP** | Animated marketing components (marquee, globe, shimmer), handy for landing and pitch pages | `npx @magicuidesign/cli@latest install claude` [S]. ECC lists `npx -y @magicuidesign/mcp@latest` under the name `magic`, which collides with 21st's old name | Free | Also installable as a shadcn registry (`@magicui`), so the shadcn MCP alone may be enough |
| **v0 (Vercel)** | Prompt-to-UI and prompt-to-app with preview and deploy to Vercel. Good for one-shot landing pages | MCP: `https://v0.app/api/mcp` via `npx mcp-remote https://v0.app/api/mcp` (OAuth; docs say **do not** put a v0 API key in config) [V] (https://v0.app/docs/api/v1/adapters/mcp-server). Claude Code form: `claude mcp add --transport http v0 https://v0.app/api/mcp` [I] | v0 credits | It is a second code generator competing with Claude. Use it for isolated screens only, then pull code in (shadcn `add <url>` pattern) [S] |
| **frontend-design plugin** (Anthropic) | Skill that pushes Claude away from generic "AI slop" UIs | `claude plugin install frontend-design@claude-plugins-official` [V] | Free | No MCP. Pairs well with shadcn |
| **vercel-labs/agent-skills** | `react-best-practices` (perf rules) and `web-design-guidelines` (100+ a11y/UX rules) audits | `npx skills add vercel-labs/agent-skills [--skill web-design-guidelines]` [S] | Free | Run it as a pre-demo polish pass, not during build |
| **superdesign, canva, miro plugins** | Canvas-based UI and marketing-graphics design | In the official marketplace [V] | Vendor accounts | Optional |

**HackForge pick:** create-next-app + shadcn (Base UI) + shadcn MCP + the frontend-design plugin. Make 21st or Magic UI optional "polish" add-ons for the landing page. v0 only when a teammate already uses it.

---

## 3. Backend, database and auth

| Tool | Hackathon value | Install / usage | Auth / free tier | Gotchas |
|---|---|---|---|---|
| **Supabase** (DEFAULT) | Postgres + Auth + Storage + Realtime + pgvector + Edge Functions in one vendor. Claude can run SQL, apply migrations, generate TS types, read logs and advisors, deploy edge functions | Plugin: `claude plugin install supabase@claude-plugins-official`. MCP: `claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=<ref>&features=database,docs,development,debugging"` then `/mcp` → Authenticate (OAuth via dynamic client registration, no PAT needed). Local stack: `http://localhost:54321/mcp` with the Supabase CLI. CLI: `npx supabase login`, `npx supabase gen types typescript --project-id <ref>` [V] (https://supabase.com/docs/guides/getting-started/mcp) | Free plan: **2 active projects**, 500 MB DB, 1 GB storage, 5 GB egress, 50k MAU. **Free projects pause after 7 days of inactivity** [V/S] (https://supabase.com/pricing) | Always pass `project_ref`, which hides account tools and blocks cross-project accidents. Use `read_only=true` for anything prod-like. Tool groups: database, debugging, development, functions, account, docs, branching (paid), storage (off by default). Prompt injection through table data is a documented risk. **Don't pre-create the project more than a week ahead**, or unpause it on the morning of. The built-in email SMTP is heavily rate-limited [S]: for demos, disable "Confirm email", use OAuth (GitHub) or anonymous sign-ins, or add custom SMTP (Resend plugin). Use `getUser()`, not `getSession()`, on the server |
| **Neon** | Serverless Postgres with instant branching (a branch per experiment). Best with Drizzle/Prisma and your own auth | `npx neon@latest init` (README) or `npx neonctl@latest init` (docs) [V, CLI name differs between pages]. MCP: `npx add-mcp https://mcp.neon.tech/mcp -a claude-code`, or `claude mcp add --transport http neon https://mcp.neon.tech/mcp`. Plugin: `neon@claude-plugins-official` [V] (https://github.com/neondatabase/mcp-server-neon) | Free: up to 100 projects, 0.5 GB and 100 CU-hours per project per month, scale-to-zero after 5 min, 10 branches [S] | Neon says its MCP is for dev/IDE use only. Untick "Allow writes" on the OAuth consent screen for read-only. OAuth covers the personal account (orgs need an API key). Auth is not included, so pair with Clerk or Better Auth |
| **Convex** | Reactive TS backend (queries, mutations, actions, scheduling, file storage, vector search). Ideal for real-time and multiplayer demos. End-to-end TypeScript is very agent-friendly | `npm create convex@latest` or `npx convex dev`. MCP: `claude mcp add-json convex '{"type":"stdio","command":"npx","args":["-y","convex@latest","mcp","start"]}'` (add `--project-dir` to pin one project). Plugin: `convex@claude-plugins-official` (skills + `convex-expert` subagent) [V] (https://docs.convex.dev/ai/convex-mcp-server) | Free plan: about 1M function calls/month, 0.5 GB DB, 1 GB files, no pausing [S] | Not SQL, so the team must accept Convex's data model. Auth via Convex Auth or Clerk |
| **Firebase** | Firestore, Auth (Google sign-in), Hosting, Functions. Strong for mobile and Google-ecosystem hackathons | `claude plugin install firebase@claude-plugins-official` (or `claude plugin marketplace add firebase/firebase-tools` + `firebase@firebase`). Manual: `claude mcp add firebase npx -- -y firebase-tools@latest mcp` [V] (https://firebase.google.com/docs/cli/mcp-server) | Spark free plan | A PR review flags that the `--` may pass `-y` to firebase-tools instead of npx. Verify with `claude mcp list` |
| **Clerk** | Drop-in auth UI (`<SignIn/>`), orgs. Fastest auth with Neon or Convex | Docs/snippets MCP (beta, not an admin API): `claude mcp add clerk --transport http https://mcp.clerk.com/mcp` [V] (https://clerk.com/docs/guides/ai/mcp/clerk-mcp-server) | Free Hobby: **50k monthly retained users** (since Feb 2026) [S] | Many blogs still say 10k. The MCP only returns patterns and docs, so configure keys yourself |
| **Better Auth** | Self-hosted TS auth library in your DB, no per-user billing. It absorbed Auth.js in Sept 2025 [S] | `npm i better-auth` | Free (OSS) | More setup than Clerk or Supabase Auth |
| **Prisma, PlanetScale, MongoDB, Turso, Appwrite** | Alternatives | Official plugins exist for prisma, planetscale, mongodb and appwrite [V] | Varies | Off the default path |

**HackForge pick:** Supabase for the default stack (one vendor covers DB, auth, storage, realtime and vectors). Convex for the mobile and real-time alternate. Neon only when the team insists on raw Postgres plus its own auth.

---

## 4. Deploy and hosting

| Tool | Hackathon value | Install / usage | Auth / free tier | Gotchas |
|---|---|---|---|---|
| **Vercel** (DEFAULT) | Git-push deploys, preview URLs, logs, analytics, AI Gateway. **The Vercel MCP can now deploy code** | Plugin (MCP + about 26 to 47 skills + `/vercel:deploy`, `/vercel:env`, `/vercel:status`, `/vercel:bootstrap`): `claude plugin install vercel@claude-plugins-official` or `npx plugins add vercel/vercel-plugin` (needs Bun). MCP only: `claude mcp add --transport http vercel https://mcp.vercel.com` (or a project path `https://mcp.vercel.com/<team>/<project>` [S]) then `/mcp`. CLI: `npm i -g vercel` → `vercel login`, `vercel link`, `vercel env add`, `vercel env pull .env.local`, `vercel --prod` [V] (https://vercel.com/docs/agent-resources/vercel-mcp) | Hobby: free, **personal/non-commercial**, about 100 GB bandwidth. Function limits conflict across sources [S/STALE?] | Production URL vs preview: preview deployments sit behind Deployment Protection (Vercel login) by default on new projects [S]. **Give judges the production domain**, or turn protection off. Missing prod env vars are the #1 broken-demo cause, so run `vercel env ls` before demo time. Set `export const maxDuration = 60` (or more) on LLM routes and stream responses. The MCP can buy domains (needs quote + approval), so keep human confirmation on. A no-login "claimable deploy" skill exists (`npx skills add https://github.com/vercel-labs/vercel-skills --skill vercel-deploy`), but skills.sh flags it high-risk [S]. Use it only as a fallback |
| **Cloudflare** | Workers/Pages/D1/R2/KV/Durable Objects/Workers AI/Agents SDK. Generous free edge compute | Plugin: `claude plugin install cloudflare@claude-plugins-official` (or `/plugin marketplace add cloudflare/skills` + `/plugin install cloudflare@cloudflare`). **API MCP (recommended, "Code Mode": `search` + `execute`, about 2,500 endpoints in about 1k tokens):** `claude mcp add --transport http cloudflare https://mcp.cloudflare.com/mcp`. Docs MCP: `https://docs.mcp.cloudflare.com/mcp`. CLI: `npm create cloudflare@latest`, `npx wrangler login`, `npx wrangler deploy`, `npx wrangler tail` [V] (https://github.com/cloudflare/mcp-server-cloudflare, https://developers.cloudflare.com/agent-setup/claude-code/) | Workers free: **100k requests/day**, 10 ms CPU/request [V] | Next.js on Workers needs the OpenNext adapter, which adds friction versus Vercel. The per-product servers ECC lists (builds, bindings, observability) are being superseded, and Cloudflare asks users to migrate to the API MCP. The observability server can blow up context |
| **Railway** | One-click Postgres/Redis plus long-running Python/Node/websocket services (good for FastAPI backends or bots) | **`@railway/mcp-server` is deprecated.** The MCP now ships in the CLI: `bash <(curl -fsSL https://railway.com/install.sh)` → `railway login` → `railway mcp install` (or `--remote` for hosted `https://mcp.railway.com`). Plugin: `railway@claude-plugins-official`. Deploy: `railway up` [V] (https://github.com/railwayapp/railway-mcp-server) | One-time trial credit (reports say about $5), then Hobby at $5/month [S/STALE?] | ECC config still uses the deprecated npm package |
| **Netlify** | Static/Jamstack plus functions. Simple drag-drop fallback | `claude mcp add-json netlify '{"command":"npx","args":["-y","@netlify/mcp"]}'` (Node ≥ 22, uses the `netlify` CLI login). Plugin: `netlify-skills@claude-plugins-official`. Deploy: `npx netlify deploy --prod` [V] (https://docs.netlify.com/welcome/build-with-ai/netlify-mcp-server) | Free starter | Don't commit a PAT into the env block |
| **Fly.io** | Docker anywhere, regions, volumes | `fly mcp server --claude` (experimental, no deploy tool; use `fly launch` / `fly deploy`) [V] (https://fly.io/docs/flyctl/mcp-server/) | Needs a card | Off the default path |
| **Render** | Simple web services plus Postgres. Has a plugin | `render@claude-plugins-official` [V] | Free web services spin down when idle [S] | A cold start right before a live demo is fatal, so keep it warm or use a paid tier |
| **Hugging Face Spaces / Modal / Streamlit Cloud / FastAPI Cloud** | Python and ML demos | See §11 Alternate A | | |
| **EAS (Expo)** | Mobile builds/updates | See §11 Alternate B | | |

**HackForge pick:** Vercel (plugin + CLI) for the default stack. Railway for Python and long-running services. HF Spaces or Modal for ML demos. Cloudflare only when the idea is edge-native or needs Workers AI.

---

## 5. Testing and QA (browser in the loop)

| Tool | Best for | Install / usage | Cost / auth | Gotchas |
|---|---|---|---|---|
| **Playwright CLI + skills** (DEFAULT for agents) | Token-efficient scripted checks: open, click, type, screenshot, all through shell commands. Snapshots go to disk, not context | `npm install -g @playwright/cli@latest` → `playwright-cli install --skills` → prompt "use playwright-cli". Headless by default (`--headed` to watch). Use sessions (`-s=name`) and `--persistent` for logins [V] (https://github.com/microsoft/playwright-cli) | Free | Needs shell and filesystem access, which Claude Code has. Microsoft's own README tells coding-agent users to prefer it over MCP |
| **Playwright MCP** | Long exploratory or self-healing loops with a held-open session | `claude mcp add playwright npx @playwright/mcp@latest`, or the plugin `playwright@claude-plugins-official`. Flags: `--headless`, `--isolated`, `--caps vision,pdf,devtools,network,storage,testing`, `--mobile` [V] (https://github.com/microsoft/playwright-mcp) | Free | Historically about 4x the tokens of the CLI (114k vs 27k per task). A July 2026 re-test on v0.0.78 found near parity now that snapshots go to disk [S]. A persistent profile conflicts across parallel agents, so use `--isolated` per subagent |
| **Chrome DevTools MCP** (Google) | Real debugging: console with source-mapped stacks, network, **performance traces / Core Web Vitals**, screenshots. ECC's only default MCP | `claude mcp add chrome-devtools --scope user npx chrome-devtools-mcp@latest`, or plugin `chrome-devtools-mcp@claude-plugins-official`. Light mode: `--slim --headless`. Privacy: `--no-usage-statistics`, `--no-performance-crux`, `--isolated` [V] (https://github.com/ChromeDevTools/chrome-devtools-mcp) | Free, keyless | Usage statistics are **on by default** and perf tools may send URLs to the CrUX API. Turn both off for private apps. Chrome or Chrome for Testing only |
| **Claude in Chrome** (`claude --chrome`) | Final visual QA in the user's *real* browser with their logins. **Records GIFs** (demo snippets), uploads files, reads console | Install the extension (≥ 1.0.36), then `claude --chrome` or `/chrome` → "Enabled by default" [V] (https://code.claude.com/docs/en/chrome) | Requires a direct Anthropic plan (Pro/Max/Team/Enterprise) and `/login`. **Does not work with API-key auth** or Bedrock/Vertex | A visible window only, no headless. Pauses on login and CAPTCHA. "Enabled by default" keeps tools loaded and raises context. A project's settings **cannot** turn it on (security). GIFs capture whatever is on screen, including account details |
| **Claude Code Desktop built-in Browser pane** | Zero-install preview of the local dev server inside the app (navigate, read page, screenshot, console, network, viewport/mobile emulation) | Configure `.claude/launch.json` (`{"configurations":[{"name":"web","runtimeExecutable":"npm","runtimeArgs":["run","dev"],"port":3000}]}`) and let Claude start it with `preview_start` (observed in this environment's tool surface) | Included in Claude Desktop | Desktop app only. CLI users fall back to Playwright CLI or `--chrome` |
| **`@playwright/test`** | A 3 to 5 test smoke suite for the golden path, run after every deploy | `npm init playwright@latest`, `npx playwright test` | Free | Keep it tiny: the goal is "demo path never breaks" |

**HackForge pick:** Playwright CLI + skills for agent-driven checks, Chrome DevTools MCP for debugging and perf, Claude in Chrome (or the Desktop Browser pane) for final human-visible QA and GIFs. Adapt ECC's `skills/browser-qa` (blast-radius rules: read-only by default, never mutate prod, use test creds) and `skills/ui-demo` (Playwright video with cursor overlay).

---

## 6. Live documentation (anti-hallucination)

| Tool | Install | Notes |
|---|---|---|
| **Context7** | **Recommended:** `npx ctx7 setup --claude` (OAuth, generates an API key, lets you choose **CLI + Skills mode (no MCP)** or MCP mode; needs Node ≥ 22.13). Manual: `claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp --header "Authorization: Bearer ${CONTEXT7_API_KEY}"` (an alternative header name `CONTEXT7_API_KEY:` also appears in the docs). Plugin: `context7@claude-plugins-official`. CLI: `ctx7 library <name> <q>`, `ctx7 docs /vercel/next.js "<q>"` [V] (https://github.com/upstash/context7) | Works without a key at lower rate limits, and a free key raises them. ECC replaced the MCP with a REST skill (`skills/documentation-lookup`). HackForge should do the same (CLI + skill) |
| **Vendor docs tools inside their MCPs** | Supabase `search_docs`, Vercel docs search, Stripe `search_stripe_documentation`, Cloudflare docs MCP, fal docs MCP (`https://docs.fal.ai/mcp`), Clerk MCP, Expo MCP | Free with the vendor MCP. Often more current than Context7 for that vendor |
| **llms.txt / .md docs** | e.g. `https://code.claude.com/docs/llms.txt`. Vercel docs serve `.md`. The Stripe CLI has `stripe docs` | Use WebFetch. No install |
| **Next.js AGENTS.md** | Generated by create-next-app | Keep it. It is the framework's own agent guidance |

---

## 7. AI building blocks (what the MVP itself calls)

### 7.1 Anthropic API (primary LLM) [V: bundled `claude-api` skill, model table cached 2026-10-06]

| Model | ID | Context | $/1M in | $/1M out | Use in a hackathon |
|---|---|---|---|---|---|
| Claude Opus 5.5 | `claude-opus-5-5` | 1M | 4.00 | 20.00 | **Default** per Anthropic guidance: agents, reasoning, code-gen features |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 1M | 2.00 | 10.00 | Only if the team explicitly picks it for speed/cost |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 1M | 0.10 (≤100K prompt) | 0.50 | Only if explicitly picked for high-volume classification or extraction |
| Claude Fable 5.1 | `claude-fable-5-1` | 1M | 10.00 | 50.00 | Only when someone explicitly asks for the most capable model. Long turns |

**Install:** `npm i @anthropic-ai/sdk` / `pip install anthropic`. Auth: `ANTHROPIC_API_KEY`, or `ant auth login` (the SDKs read the profile automatically, so no env var is needed). Check with `ant auth status`.

**Breaking-change gotchas that bite code copied from 2024-25 tutorials:**
- On Opus 5.5, `thinking: {type:"disabled"}` and `budget_tokens` return **400**. Lower `output_config.effort` (default `medium`) instead.
- Forced `tool_choice` `any`/`tool` returns 400. Use `auto` + `strict: true`, or structured outputs `output_config.format`.
- **Assistant prefill returns 400.**
- Thinking display defaults to `"omitted"`. Set `display:"summarized"` if you stream reasoning to the UI, otherwise it looks frozen.
- Add the server-side `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) to handle `stop_reason: "refusal"`.
- Use streaming for long outputs.

**Bigger building blocks:** Claude Agent SDK (`@anthropic-ai/claude-agent-sdk` = Claude Code as a library) and Managed Agents (Anthropic hosts the loop and sandbox) suit "agentic product" hackathons.

**HackForge rule:** generated MVP code must load the `claude-api` skill before writing any Claude call. Training priors are stale.

### 7.2 Other model and media services

| Service | What it adds | Install (Claude Code) | Auth / free | Gotchas |
|---|---|---|---|---|
| **Vercel AI SDK + AI Gateway** | `useChat`/`streamText` UI primitives. One gateway key for many providers | `npm i ai @ai-sdk/anthropic` (or the gateway provider) | **$5 of free AI Gateway credit every 30 days** per team; buying credits ends the free tier [S] (https://vercel.com/docs/ai-gateway/pricing) | Skip the gateway when using the Anthropic SDK directly. Don't mix SDK styles in one app |
| **OpenRouter** | One key and an OpenAI-compatible API to hundreds of models, plus fallbacks via a `models` array | REST/SDK (no official MCP needed) | `:free` models: 20 req/min. **50 req/day under $10 lifetime purchase, 1,000/day after** [S] | Free models get pulled or throttled without notice, so never demo on one |
| **fal.ai** | 1,000+ image/video/audio/3D models (Flux, Veo, Kling, Seedance...) with queueing | **Official hosted MCP:** `.mcp.json` `{"fal-ai":{"type":"http","url":"https://mcp.fal.ai/mcp","headers":{"Authorization":"Bearer ${FAL_KEY}"}}}` (blog CLI form: `claude mcp add --transport http fal-ai https://mcp.fal.ai/mcp --header "Authorization: Bearer $FAL_KEY"`). 9 tools including `get_pricing`, `submit_job`. App code: `npm i @fal-ai/client` [V] (https://blog.fal.ai/connect-your-ai-to-1-000-models-with-the-fal-mcp-server) | MCP free, pay per run | ECC lists the community `fal-ai-mcp-server` package, so switch to the hosted one. Video jobs take minutes, so use `submit_job`/`check_job` and pre-generate demo assets |
| **Replicate** | Open-model hosting and fine-tunes | `claude mcp add replicate https://mcp.replicate.com/sse --transport sse --scope user` → `/mcp` [V] (https://mcp.replicate.com/) | Pay per second | SSE is deprecated in Claude Code, but `--transport http` auto-falls back since v2.1.265 |
| **ElevenLabs** | TTS voiceover, Scribe v2 STT (word timestamps for captions), voice agents | **Hosted MCP (OAuth):** `https://api.elevenlabs.io/v1/mcp`, so `claude mcp add --transport http elevenlabs https://api.elevenlabs.io/v1/mcp` [I]. **The local `uvx elevenlabs-mcp` is deprecated** [V] (https://github.com/elevenlabs/elevenlabs-mcp) | Free tier about 10k credits/month [V README] | The hosted MCP is focused on the Agents platform plus TTS. For STT and captions call the API directly |
| **Hugging Face MCP** | Search models, datasets, Spaces, papers. Call Gradio Spaces as tools | `claude mcp add hf-mcp-server -t http "https://huggingface.co/mcp?login"`. Plugin: `huggingface-skills@claude-plugins-official` [V] (https://github.com/huggingface/hf-mcp-server) | Free (HF login) | Configure the Spaces you expose at huggingface.co/settings/mcp |
| **Together, Runway, Synthflow, Twilio, Resend** | Inference, video gen, voice agents, SMS, email | Official plugins exist [V] | Vendor | Optional |

---

## 8. Payments, design, diagrams and slides

### 8.1 Stripe (optional "we can charge" moment)

- **Fastest:** `npm install -g @stripe/cli@latest && stripe agent setup`. It detects agents and installs the plugin + MCP + skills. Or `claude plugin install stripe@claude-plugins-official`. Or `claude mcp add --transport http stripe https://mcp.stripe.com/` → `/mcp` (OAuth; you choose sandbox vs live per environment). [V] (https://docs.stripe.com/mcp)
- **Tools:** `stripe_api_search`, `stripe_api_details`, `stripe_api_read`, `stripe_api_write` (generic over about 150 API methods), `stripe_implementation_planner`, `search_stripe_documentation`. Ask it to "create a product, a price and a Payment Link in my sandbox" for a 2-minute monetization demo. Test card `4242 4242 4242 4242`. Webhooks locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
- **Gotchas:**
  - **From December 2026, Stripe MCP stops accepting full-access secret keys and non-"Agent" restricted keys.** Use OAuth or new *agent API keys* (deadline Nov 30, 2026). Header form: `Authorization: Bearer ${AGENT_API_KEY}` in `.mcp.json`.
  - Refunds and outbound payments require human confirmation through a URL.
  - **Only ever connect a sandbox during a hackathon.**

### 8.2 Figma

- Plugin: `claude plugin install figma@claude-plugins-official`. Remote: `claude mcp add --transport http figma https://mcp.figma.com/mcp`. Desktop: `http://127.0.0.1:3845/mcp`, enabled in Dev Mode. [V] (https://github.com/figma/mcp-server-guide)
- **Hard limit:** Starter plan, View and Collab seats get **6 tool calls per month**. Real use needs a Dev or Full seat on Professional or higher (200/day). Write tools are exempt.
- **HackForge verdict:** use it only when a team member already has a paid Dev or Full seat. Otherwise skip it and design in code (shadcn presets + frontend-design).

### 8.3 Diagrams (architecture slide, README)

- **Mermaid** is the default. It renders natively on GitHub and in most decks. CLI: `npx -p @mermaid-js/mermaid-cli mmdc -i arch.mmd -o arch.svg`. No MCP is needed because Claude writes Mermaid fluently.
- **Excalidraw** (hand-drawn look):
  - Official remote MCP App: `https://mcp.excalidraw.com`. It is an *MCP App* that renders an interactive canvas in Claude Desktop or claude.ai. In the terminal CLI the UI may not render [I]. Source: https://github.com/excalidraw/excalidraw-mcp
  - For Claude Code with a live canvas: `yctimlin/mcp_excalidraw` (community) [S].
- **Miro plugin** (`miro@claude-plugins-official`) for team boards [V].

### 8.4 Slides / pitch deck

- **Single-file HTML deck** generated by a skill is the fastest and fully controllable option. Copy and adapt ECC `skills/frontend-slides` (zero-dependency, viewport-fit, style previews). Export a PDF backup through Chrome print or Playwright.
- **Slidev** (`npm init slidev@latest`, `slidev export` to PDF/PNG; it ships official AI-agent skills per its docs [S]) suits code-heavy talks. **Marp** (`npx @marp-team/marp-cli slides.md --pdf --pptx`) is the simplest Markdown-to-PDF route. Both export PPTX only as images. Both are MIT.
- Anthropic `pptx` skill / Canva plugin when the organizers require an editable PPTX or Canva.

---

## 9. Demo video tooling

| Need | Tool | Usage | Cost |
|---|---|---|---|
| Raw screen capture | macOS `Cmd+Shift+5` / QuickTime; **Cap** (OSS Loom alternative, Mac/Win/Linux, https://cap.so); **Screen Studio** (Mac, auto-zoom on clicks, paid); OBS | Record the golden path 3 times and keep the best | Free to paid |
| Scripted, reproducible capture | **Playwright video** (`recordVideo` context option) + ECC `skills/ui-demo` (Discover → Rehearse → Record, injected cursor, natural pacing, WebM out). **Claude in Chrome GIF recorder** for short loops | Claude writes and re-runs the script after every UI change, so the video is always current | Free |
| Title cards, animated stats, captions, outro | **Remotion**: `npx create-video@latest` (docs also show `bun create video`) + `npx skills add remotion-dev/skills` (or `npx remotion skills add`), then `npx remotion studio` / `npx remotion render`. ECC has `skills/remotion-video-creation` (29 rule files) | Free for individuals and companies with ≤3 employees; larger for-profits need a company license [V] (https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) |
| HTML-to-video (agent-native alternative) | **HyperFrames** by HeyGen (Apache-2.0, Node ≥ 22): `claude plugin marketplace add heygen-com/hyperframes && claude plugin install hyperframes@hyperframes` (also listed in the official marketplace) [V] (https://github.com/heygen-com/hyperframes) | Free (OSS) |
| Voiceover | ElevenLabs TTS (API or hosted MCP) | Write a 60-120 s script first, then generate | Free tier credits |
| Auto-captions | ElevenLabs **Scribe v2** (batch, word timestamps) or local Whisper (whisper.cpp). Burn in with `ffmpeg -i demo.mp4 -vf "subtitles=demo.srt" demo_captioned.mp4`, or render with Remotion captions (export `.srt` too) [S] | Pay per minute, or free locally |
| Generated B-roll / hero imagery | fal.ai (Veo/Kling/Seedance/Flux) via ECC `skills/fal-ai-media` | Pre-generate. Never generate live during judging | Pay per run |
| Editing | ffmpeg (Claude-scriptable), CapCut / Descript (manual polish). ECC `skills/video-editing` covers the pipeline | Free to paid |

**Hackathon reality:** many hackathons (e.g. Devpost) require a short video, often ≤3 min, uploaded to YouTube or Vimeo. Check the rules on hour 0 and budget 60-90 minutes for video. Build the scripted Playwright recording as soon as the golden path works. It doubles as the regression test and the backup demo if live Wi-Fi fails.

---

## 10. What to copy, adapt or avoid from ECC (with corrections)

**Copy or adapt:**
- **ECC `docs/MCP-CONNECTOR-POLICY.md`.** A connector earns default status only if it is universal and MCP beats a CLI + skill. ECC ships just `chrome-devtools` (`.mcp.json` pins `chrome-devtools-mcp@1.10.1`) and turned Context7, GitHub and Playwright into skills. HackForge should adopt the same principle with a hackathon-specific default set (§12).
- ECC skills worth porting or trimming:
  - `browser-qa`, for its blast-radius rules.
  - `ui-demo`
  - `remotion-video-creation`
  - `frontend-slides`
  - `documentation-lookup`, converted to the `ctx7` CLI.
  - `fal-ai-media`
  - `video-editing`
  - `nextjs-turbopack`, for the Next 16 gotchas.
  - `deployment-patterns`, reduced to a checklist.
  - `orch-build-mvp`, for its thin-vertical-slice idea, not its GAN loop or gates.

**Avoid or fix in ECC's `mcp-configs/mcp-servers.json`:**

| ECC entry | Problem (2026-10) | HackForge replacement |
|---|---|---|
| `railway`: `npx -y @railway/mcp-server` | Deprecated shim | `railway mcp install` (or `--remote`), or `railway@claude-plugins-official` |
| `magic`: `npx -y @magicuidesign/mcp@latest` | Name collides with 21st's old "Magic MCP". Official install is via `@magicuidesign/cli` | `npx @magicuidesign/cli@latest install claude`, or just the shadcn registry `@magicui` |
| (missing) 21st Magic | Renamed to 21st MCP, old keys reset | `npx @21st-dev/cli@latest init --client claude` |
| `cloudflare-workers-builds` / `-bindings` / `-observability` | Cloudflare recommends migrating to the single API MCP (Code Mode) | `https://mcp.cloudflare.com/mcp` + `cloudflare@claude-plugins-official` |
| `fal-ai`: `npx -y fal-ai-mcp-server` (community) | An official hosted server exists | `https://mcp.fal.ai/mcp` with a Bearer `${FAL_KEY}` header |
| `supabase`: local stdio + `--project-ref` + PAT | The remote OAuth server is now the documented path | `https://mcp.supabase.com/mcp?project_ref=...` (+ `read_only`, `features`) |
| `github`: `@modelcontextprotocol/server-github` + PAT | Old reference server [STALE?]. ECC itself moved to the `gh` CLI | `gh` CLI (+ `github@claude-plugins-official` if an MCP is wanted) |
| `playwright` (MCP) | Microsoft recommends the CLI for coding agents | `@playwright/cli` + skills |
| Missing: Stripe, Vercel plugin, Expo, Neon, Convex, Clerk, HF, ElevenLabs hosted | n/a | See tables above |
| `_comments.context_warning: "Keep under 10 MCPs"` | Tool search defers schemas now | Keep it lean for result volume, latency and security (prompt injection surface), not schema tokens |

---

## 11. The recommended stacks

### 11.1 DEFAULT: Next.js + shadcn + Supabase + Vercel + Claude ("web app with AI inside")

**Why:** it is the most heavily represented stack in model training data. One deploy target, one backend vendor, and every piece has an official plugin and OAuth MCP. Preview URLs are free, it streams AI natively, and auth, DB, storage and vectors (pgvector for RAG) come without extra vendors.

**Minute-by-minute bootstrap (target: deployed hello-world by T+15 min):**

```bash
# T+0  scaffold
npx create-next-app@latest app --yes && cd app
npx shadcn@latest init            # pick preset; Base UI default
npx shadcn@latest add button card input dialog sonner
npm i @anthropic-ai/sdk @supabase/supabase-js @supabase/ssr
# T+5  link infra (accounts pre-authed in minute-zero)
vercel link && vercel env pull .env.local
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
# T+8  first prod deploy (git push also works once the GitHub repo is linked)
vercel --prod
# T+10 smoke test the PROD url
playwright-cli open "$PROD_URL" && playwright-cli screenshot
```

**Project `.mcp.json` HackForge should template** (commit it, no secrets):

```json
{
  "mcpServers": {
    "supabase": { "type": "http", "url": "https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}&features=database,docs,development,debugging" },
    "vercel":   { "type": "http", "url": "https://mcp.vercel.com" },
    "shadcn":   { "command": "npx", "args": ["shadcn@latest", "mcp"] },
    "chrome-devtools": { "command": "npx", "args": ["-y", "chrome-devtools-mcp@latest", "--isolated", "--no-usage-statistics"] }
  }
}
```

Plus plugins: `vercel`, `supabase`, `frontend-design`, `context7` (or the `ctx7` CLI skill), optional `stripe`. Plus CLIs: `vercel`, `supabase`, `gh`, `playwright-cli`.

**On-demand add-ons:** `stripe` (payments), `fal-ai` (media), `21st` / `magicui` (landing polish), `figma` (only with a paid seat), `hf-mcp-server` (open models).

**Default-stack gotchas checklist:**
- Prod env vars are set (`vercel env ls`).
- The Supabase redirect URLs include the Vercel prod domain (Auth → URL config).
- Email confirmation is off, or OAuth is used.
- RLS policies exist. Use the publishable/anon key client-side and keep the service key server-only.
- LLM routes stream and set `maxDuration`.
- Judges get the production URL, not a protected preview.
- Seed data is in place and a `DEMO_MODE` fallback serves cached LLM outputs if the API flakes.

### 11.2 ALTERNATE A: Python ML demo (FastAPI + Gradio/Streamlit, HF Spaces / Modal)

**Use it when** the idea centers on a model: fine-tune, CV, audio, RAG over a dataset, or an agent built on Python libraries.

- **UI:**
  - **Gradio** (fastest, ML-native widgets): `pip install gradio`, `demo.launch(mcp_server=True)`. That one flag makes every function an MCP tool, so the app is "agent-ready", a nice judging angle. Deploy with `gradio deploy` (creates an HF Space, prompts for hardware) [S] (https://www.gradio.app/guides/building-mcp-server-with-gradio).
  - **Streamlit** (dashboards): free Streamlit Community Cloud deploys from a GitHub repo.
- **API:** FastAPI (`pip install "fastapi[standard]"`, `fastapi dev main.py`). Deploy on **FastAPI Cloud** (`fastapi deploy`, beta, free hobby tier reported at 3 apps [S]), **Railway** (`railway up`), or **Modal**.
- **GPU:** **Modal**. `pip install modal && modal setup`, `@app.function(gpu="A10G")`, `modal serve app.py` (hot reload) and `modal deploy app.py` (permanent URL, ASGI/FastAPI supported). **$30/month free credits on Starter** [S]. The alternative is HF **ZeroGPU** Spaces (quota rules [STALE?]).
- **Tooling:**
  - `uv` (`uv init`, `uv add`) for fast environments.
  - HF MCP + `huggingface-skills` plugin for model, dataset and Space discovery.
  - fal / Replicate for hosted generative models instead of self-hosting.
  - `logfire` plugin (Pydantic) for FastAPI tracing [V].
- **Hybrid option:** keep the §11.1 Next.js front end on Vercel and call a FastAPI/Modal backend. That gives you better UX than Gradio, at roughly +30 minutes of integration.
- **Gotchas:**
  - Space cold builds take minutes, so push early.
  - Pin `requirements.txt` for Spaces.
  - Private or ZeroGPU Spaces called as MCP need an HF token header.
  - Don't download multi-GB weights on demo day. Cache them in a Modal Volume or a Space persistent disk.

### 11.3 ALTERNATE B: Mobile (Expo + Convex/Supabase + Clerk)

**Use it when** the idea is inherently mobile: camera, location, push, on-the-go use.

- **Scaffold:** `npx create-expo-app@latest app --template default@sdk-56` (the docs reference SDK 56; check the live page [STALE?]). Use Expo Router.
- **Agent tooling:**
  - `claude plugin install expo@claude-plugins-official` (official Expo skills: UI, deploy, upgrade, debug; free) [V] (https://github.com/expo/skills).
  - **Expo MCP** (simulator interaction, React Native DevTools, EAS builds/workflows): `claude mcp add --transport http expo https://mcp.expo.dev/mcp` → `/mcp` OAuth. **It requires a paid EAS plan** [V/S] (https://docs.expo.dev/eas/ai/mcp).
  - On a Mac with Claude Code Desktop, the built-in iOS Simulator control (observed in this environment) can screenshot, tap and type in the simulator without Expo MCP.
- **Backend:** **Convex** (realtime sync, typed, React Native client), or **Supabase** (`@supabase/supabase-js` works in RN), or **Firebase** (Google sign-in). Auth: **Clerk** Expo SDK (50k MRU free) or Supabase Auth.
- **Demo distribution:**
  - **Expo Go** QR (`npx expo start --tunnel` on venue Wi-Fi). It is fastest, but SDK and native-module limits apply.
  - **EAS Update** (`npm i -g eas-cli`, `eas login`, `eas update`) for an over-the-air demo build.
  - **Web export** (`npx expo export --platform web` → `vercel --prod` or EAS Hosting) so judges can click a link without installing anything.
- **Gotchas:**
  - iOS device builds need an Apple Developer account ($99/yr) and time, so avoid native builds during the event. Stay in Expo Go or a dev build prepared beforehand.
  - Android APK through `eas build -p android --profile preview` is the realistic native option.
  - Test on a real phone early.

*(Optional ALTERNATE C: Cloudflare-native agents.* Workers + D1 + R2 + Workers AI + the Agents SDK, deployed with `npx wrangler deploy` and driven by the Cloudflare plugin and API MCP. Pick it only for edge or agent-centric themes or Cloudflare-sponsored tracks.)

---

## 12. Proposed HackForge default connector set and decision table

**Always on (per project):** shadcn MCP (keyless), Supabase MCP (OAuth, project-scoped), Vercel MCP (OAuth), Chrome DevTools MCP (keyless, isolated, telemetry off).

**Always installed as plugins or skills:** vercel, supabase, frontend-design, context7 (CLI + skill mode), Playwright CLI skills, plus HackForge's own ship/demo/pitch skills.

**On demand:** stripe, fal-ai, 21st, magicui, figma, neon, convex, firebase, clerk, cloudflare, railway, expo, hf-mcp-server, elevenlabs, replicate, excalidraw.

| Job | Use MCP when... | Use CLI + skill when... |
|---|---|---|
| DB schema/migrations/SQL (Supabase) | The OAuth MCP gives typed tools, advisors and logs, and auth needs no PAT | `supabase` CLI for `gen types`, local stack, `db push` in CI |
| Deploy (Vercel) | Inspecting failed builds and logs, project/env queries | `vercel --prod`, `vercel env`. Deterministic and cheap |
| Browser | Long stateful debugging and perf traces (DevTools MCP) | Scripted checks, screenshots, videos (Playwright CLI) |
| Docs | Vendor MCP has a docs tool | `ctx7` CLI skill for everything else |
| Payments | Creating sandbox products and links interactively (Stripe MCP) | `stripe listen` / `stripe trigger` for webhooks |
| Media gen | Exploring and choosing models (`get_pricing`, `search_models`) | App code calls the `@fal-ai/client` SDK |

---

## 13. Minute-zero setup checklist (do this before the hackathon starts)

**A. Accounts** (personal, with GitHub SSO where possible):
- Claude Pro/Max (needed for Claude Code + Claude in Chrome; API-key auth disables Chrome).
- Anthropic Console with prepaid credits **and a spend limit**.
- GitHub.
- Vercel (connect GitHub).
- Supabase (an org exists; create the project the day of, or wake it).
- Stretch accounts, created only if the idea needs them:
  - Stripe, kept in **sandbox**.
  - fal.ai with prepaid credit.
  - ElevenLabs.
  - OpenRouter, only if multi-model.
  - Hugging Face with a write token.
  - Modal (`modal setup`).
  - Expo (+ Expo Go on phones).
  - Clerk.
  - Context7 free key.
  - 21st key.
  - Figma (check seat type).

**B. Local toolchain:**
- Node 22 LTS (Context7 CLI needs ≥ 22.13, Netlify MCP needs ≥ 22) + pnpm or Bun (the Vercel plugin needs Bun).
- Python 3.12+ and `uv`.
- Google Chrome.
- `ffmpeg`.
- `gh`.
- Global CLIs: `npm i -g vercel @playwright/cli@latest @stripe/cli`, then `playwright-cli install --skills` and `npx playwright install chromium`.
- Optional: `eas-cli`, Railway CLI, wrangler (via npx).

**C. Logins:**
- `claude /login`
- `gh auth login`
- `vercel login`
- `npx supabase login`
- `stripe login`
- `ant auth login` (optional)
- `modal setup` / `huggingface-cli login` / `eas login` (as relevant)

**D. Claude Code wiring:**
- Install the plugins: `claude plugin install vercel@claude-plugins-official`, `supabase@...`, `frontend-design@...`, `context7@...`. Run `npx ctx7 setup --claude`.
- Copy HackForge's `.mcp.json` template.
- `claude mcp list`, then `/mcp` → authenticate Supabase, Vercel and Stripe **now**. OAuth browser hops eat time later.
- Decide `--chrome` vs the Desktop Browser pane.

**E. Secrets hygiene:**
- `.env.local` and `.env*` are in `.gitignore`.
- `.env.example` is committed with names only.
- `.mcp.json` uses `${VAR}` references.
- Every paid API has a spend cap.
- Stripe is sandbox-only.
- MCPs are project-scoped (`project_ref`) and read-only where possible.

**F. Pre-warm caches:**
- Run `npx create-next-app@latest warmup --yes` and `npx shadcn@latest --help` once, so `npx` and npm caches are hot on venue Wi-Fi.
- Do one throwaway `vercel --prod` to confirm the pipeline end to end.

**G. Readiness gate.** HackForge should ship an `hf-doctor` script that checks:
- CLI versions: `node -v`, `vercel whoami`, `gh auth status`, `npx supabase projects list`, `stripe config --list`.
- `claude mcp list` shows the expected servers connected.
- Required env names are present.
- It prints a red/green table.

**H. Rules check:**
- Video length and host (YouTube/Vimeo).
- Whether pre-existing code or templates are allowed.
- Required tracks/sponsor tech (sponsor credits often replace free tiers).
- Submission deadline in your timezone.

---

## 14. Open risks and things to re-verify close to the event

- Exact current versions of Next.js (16.x vs 17), Vite, Expo SDK, shadcn presets. Run `--help` on the day.
- Free-tier numbers (Vercel function limits, Railway trial, Neon CU-hours, Modal credits, HF ZeroGPU, 21st credits) conflict across third-party sources.
- Claude Code forms I inferred rather than read in vendor docs: `claude mcp add` for v0, ElevenLabs hosted and Excalidraw.
- Whether the Excalidraw MCP App renders in the CLI.
- Neon CLI name (`neon` vs `neonctl`).
- Supabase built-in SMTP rate limits.
- Vercel preview Deployment Protection defaults.

---

## Sources

- Claude Code MCP docs: https://code.claude.com/docs/en/mcp
- Claude Code + Chrome: https://code.claude.com/docs/en/chrome
- Official plugin marketplace JSON: https://raw.githubusercontent.com/anthropics/claude-plugins-official/HEAD/.claude-plugin/marketplace.json
- Anthropic model table and API drift: bundled `claude-api` skill (cached 2026-10-06)
- Supabase MCP: https://supabase.com/docs/guides/getting-started/mcp ; https://github.com/supabase-community/supabase-mcp ; pricing https://supabase.com/pricing ; pausing https://supabase.com/docs/guides/platform/free-project-pausing
- Vercel MCP: https://vercel.com/docs/agent-resources/vercel-mcp ; plugin https://github.com/vercel/vercel-plugin , https://vercel.com/docs/agent-resources/vercel-plugin ; AI Gateway pricing https://vercel.com/docs/ai-gateway/pricing
- Stripe MCP: https://docs.stripe.com/mcp
- shadcn MCP: https://ui.shadcn.com/docs/mcp ; shadcn 2026 changes (secondary): https://medium.com/@nakranirakesh/shadcn-ui-march-2026-update-cli-v4-ai-agent-skills-and-design-system-presets-d30cf200b0e9 , https://releasebot.io/updates/shadcn
- create-next-app: https://nextjs.org/docs/app/api-reference/cli/create-next-app
- 21st MCP: https://github.com/21st-dev/magic-mcp ; Magic UI MCP: https://github.com/magicuidesign/mcp
- v0 MCP: https://v0.app/docs/api/v1/adapters/mcp-server
- Neon MCP: https://github.com/neondatabase/mcp-server-neon ; https://neon.com/docs/ai/connect-mcp-clients-to-neon
- Convex MCP: https://docs.convex.dev/ai/convex-mcp-server
- Firebase MCP: https://firebase.google.com/docs/cli/mcp-server
- Clerk MCP: https://clerk.com/docs/guides/ai/mcp/clerk-mcp-server ; pricing https://clerk.com/articles/clerk-pricing-explained
- Cloudflare MCP servers: https://github.com/cloudflare/mcp-server-cloudflare ; https://developers.cloudflare.com/agent-setup/claude-code/ ; Workers pricing https://developers.cloudflare.com/workers/platform/pricing/
- Railway MCP: https://github.com/railwayapp/railway-mcp-server ; https://docs.railway.com/reference/mcp-server
- Netlify MCP: https://docs.netlify.com/welcome/build-with-ai/netlify-mcp-server
- Fly MCP: https://fly.io/docs/flyctl/mcp-server/
- Playwright MCP: https://github.com/microsoft/playwright-mcp ; Playwright CLI: https://github.com/microsoft/playwright-cli ; token comparison (secondary): https://dev.to/aswani25/playwright-cli-vs-playwright-mcp-which-should-you-use-with-claude-code-1olh
- Chrome DevTools MCP: https://github.com/ChromeDevTools/chrome-devtools-mcp
- Context7: https://github.com/upstash/context7
- Figma MCP: https://github.com/figma/mcp-server-guide ; https://developers.figma.com/docs/figma-mcp-server/plans-access-and-permissions/
- fal MCP: https://blog.fal.ai/connect-your-ai-to-1-000-models-with-the-fal-mcp-server
- Replicate MCP: https://mcp.replicate.com/
- ElevenLabs MCP: https://github.com/elevenlabs/elevenlabs-mcp ; https://elevenlabs.io/docs/agents-platform/operate/hosted-mcp
- Hugging Face MCP: https://github.com/huggingface/hf-mcp-server ; Gradio MCP: https://www.gradio.app/guides/building-mcp-server-with-gradio
- Expo MCP: https://docs.expo.dev/eas/ai/mcp ; Expo skills: https://github.com/expo/skills
- OpenRouter limits (secondary): https://openrouter.ai/blog/tutorials/free-llm-apis-compared/
- Modal free tier (secondary): https://costbench.com/software/cloud-infrastructure/modal-labs/free-plan/
- FastAPI Cloud: https://fastapi.tiangolo.com/deployment/fastapicloud/
- Remotion skills: https://www.remotion.dev/docs/ai/skills ; license https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
- HyperFrames: https://github.com/heygen-com/hyperframes
- Excalidraw MCP: https://github.com/excalidraw/excalidraw-mcp ; community https://github.com/yctimlin/mcp_excalidraw
- Cap: https://cap.so/ ; Screen Studio: https://screen.studio/
- Slidev/Marp comparison (secondary): https://www.pkgpulse.com/guides/slidev-vs-marp-vs-revealjs-code-first-presentations-2026
- vercel-labs agent skills (secondary): https://www.stably.ai/blog/install-kung-fu-for-your-ai-agent
- ECC (local clone, read-only): `mcp-configs/mcp-servers.json`, `.mcp.json`, `docs/MCP-CONNECTOR-POLICY.md`, `skills/{ui-demo,browser-qa,remotion-video-creation,frontend-slides,documentation-lookup,fal-ai-media,video-editing,nextjs-turbopack,orch-build-mvp}/SKILL.md`
