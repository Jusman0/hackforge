<!-- HackForge template, copied to .hackforge/spec/STACK.md by /hackforge:spec. The stack is chosen only now, after the demo script, and shown at Gate B.
Env vars: NAMES only. Values live in .env.local (gitignored) and the host's env settings; .env.example lists names. Never paste a key into this file.
Mirror the dev/deploy fields into state.json `stack` with: hackforge state set stack.<field> "<value>" -->

# Stack: {{Name}}

## Chosen stack (state.json `stack.profile`: {{web / python / mobile / custom}})
| Layer | Choice | Why (speed, sponsor, team skill) |
|---|---|---|
| Frontend | {{e.g. Next.js + shadcn/ui}} | {{…}} |
| Backend / DB / auth | {{e.g. Supabase, guest/demo user}} | {{…}} |
| AI in the product | {{model + SDK}} | {{why over the obvious alternative}} |
| Sponsor tech | {{…}} | Load-bearing on beat {{time}} |
| Deploy target | {{e.g. Vercel}} | {{…}} |
| Golden-path test + recorder | Playwright (`@playwright/test`, Playwright CLI) | One script: smoke test, qa-runner, video |
<!-- Defaults from research 04 §11: web = Next.js + shadcn + Supabase + Vercel + Anthropic SDK; python = FastAPI + Gradio/Streamlit on HF Spaces, Modal or Railway; mobile = Expo + Convex or Supabase + Clerk, with a web export so judges install nothing. Re-check versions with --help on the day. -->

## Dev and deploy (state.json `stack`)
| devCommand | devPort | devUrl | prodUrl | repoUrl |
|---|---|---|---|---|
| `{{npm run dev}}` | {{3000}} | {{http://localhost:3000}} | {{production alias or custom domain}} | {{…}} |

- Dev server: `hackforge dev up` (the main session owns it; evaluators only health-check it).
- Prove the pipeline with a hello-world prod deploy in hour 1; the skeleton is due at SKELETON_DEPLOYED.
- Judges get the production alias or custom domain, never the deployment-hash URL: Vercel Deployment Protection can put a login wall on it ([docs](https://vercel.com/docs/deployment-protection)). Check in incognito.

## Accounts and keys (names only)
| Env var | Service | Exposure | Set in | Spend cap? | Owner |
|---|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | {{Anthropic}} | server-only | `.env.local` + host env | [ ] | {{…}} |
| `DEMO_MODE` | app flag | server | host env | n/a | {{…}} |
| `{{SERVICE_VAR_NAME}}` | {{…}} | {{server-only / public by design}} | {{…}} | [ ] | {{…}} |
<!-- Never ship a secret to the client (e.g. no NEXT_PUBLIC_*KEY). Before the first commit: git check-ignore -v .env.local. On Vercel, check prod env names with: vercel env ls -->

## Logins (before minute zero; `hackforge doctor` checks readiness)
- [ ] `gh auth login`
- [ ] {{deploy CLI login, e.g. vercel login}}
- [ ] {{backend CLI login, e.g. npx supabase login}}
- [ ] `/mcp` OAuth done for every MCP in the profile below

## MCP profile
Profile: {{research / web / python / github / none}}. `hackforge mcp {{profile}}` prints the `claude mcp add …` commands; `--write` merges exact-pinned entries into `.mcp.json` and never overwrites an existing name.
Prefer a CLI plus a skill; prefer official `claude-plugins-official` vendor plugins when one exists.

## Starters and pre-existing code (rubric.json `preExistingCode`: {{value}})
| Starter / template | Public? | Licence | Disclosed in README? |
|---|---|---|---|
| HackForge templates | yes | MIT | [ ] |
| {{e.g. create-next-app}} | {{yes}} | {{…}} | [ ] |

## Fallbacks
| Dependency | Failure mode | Fallback | Switch time |
|---|---|---|---|
| {{LLM API}} | Rate limit, outage, slow | DEMO_MODE cached responses; {{alternate provider}} | {{min}} |
| {{Deploy target}} | Build fails, protected URL | {{previous good deploy, e.g. vercel rollback}}; {{alternate host}} | {{min}} |
| {{Sponsor API}} | Down or quota | Cached real responses (disclosed in FAKE_VS_REAL.md) | {{min}} |
| Venue Wi-Fi | Down | Phone hotspot + local backup video | {{min}} |
