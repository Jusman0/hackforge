# 03 — Research & Ideation MCPs and CLIs for HackForge (as of 2026-10-15)

**Scope:** The best MCP servers and CLIs for the research and ideation phases inside Claude Code: web search, deep scraping, community signal (Reddit, X, HN, Product Hunt, YouTube), academic papers, GitHub and code search, datasets and models, trends, and docs. Each entry covers what the tool uniquely does, the exact install command, auth and cost, reliability, and context footprint. It ends with a tiered stack and an overlap map.

**Method:** I read 30+ official READMEs at `raw.githubusercontent.com/<repo>/HEAD/README.md`, saved under `scratchpad/readmes/`. I also read the Claude Code MCP docs (https://code.claude.com/docs/en/mcp), searched the claude.ai MCP registry, and ran Bright Data SERP lookups (`bdata search`, `bdata pipelines search/info`, 13 calls). I read one 2026 benchmark paper through alphaXiv. **On 2026-10-15 I also probed every keyless remote server live.** Each probe ran JSON-RPC `initialize`, then `tools/list`, then one `tools/call`. From that I measured tool counts, definition sizes, latency and result sizes (scripts in `scratchpad/probe/`). I also read ECC's MCP policy and catalog, which is untrusted and read-only (`ecc/docs/MCP-CONNECTOR-POLICY.md`, `ecc/mcp-configs/mcp-servers.json`, `ecc/skills/{deep-research,exa-search,search-first}/SKILL.md`).

**Staleness flags:** Pricing and free tiers for search APIs changed several times in 2026, sometimes more than once a quarter. Each figure below carries its source and date, and anything I could not confirm with a primary source is marked *(secondary)*. Two products changed this week. Bright Data MCP v3.0.0 shipped on 2026-10-11 and v3.1.0 today (2026-10-15). DeepWiki's tool names also differ from its own docs.

---

## 0. TL;DR for HackForge

1. **Context cost now comes from overlap and payload size, not from tool schemas.** Claude Code defers MCP tool definitions by default (tool search). At session start it loads only tool names and server instructions, which are capped at 4,096 chars per server ([Claude Code docs, "Scale with MCP tool search"](https://code.claude.com/docs/en/mcp)). The real costs are:
   - **Tool-choice confusion.** Five servers that each expose `search` and `fetch` make the model pick at random.
   - **Result payloads.** I measured about 5k tokens per Parallel search, and the default cap is `MAX_MCP_OUTPUT_TOKENS` = 25,000 (a warning shows above 10,000).
   - **Definitions of tools that get discovered.** Measured sizes run from about 0.4k tokens (DeepWiki) to about 7.9k (a community HN server).
2. **Two diverse search providers beat five similar ones.** In a controlled 2026 study, Brave, Tavily and Firecrawl answered 25, 25 and 26 out of 100 hard questions under the same agent. The *union* of their correct answers was **44/100**, against 26/100 for the best single provider, which is 18 points of headroom from complementarity ([arXiv 2607.10198](https://www.alphaxiv.org/abs/2607.10198), tables 2, 4 and 13). HackForge should pair one semantic, LLM-optimized provider (Parallel, keyless) with one Google-SERP and unblocking provider (Bright Data CLI). It should not stack Exa, Tavily, Brave, Perplexity and Firecrawl together.
3. **Use CLIs and skills for stateless bulk research, and MCP only where it clearly helps.** ECC reached the same conclusion in its June 2026 audit. It ships *one* default MCP (chrome-devtools) and moved GitHub, Context7, Exa, memory, playwright and sequential-thinking into skills or dropped them (`ecc/docs/MCP-CONNECTOR-POLICY.md`). For HackForge, research subagents should call `bdata …` and `curl` and write results to files (`-o file.json` followed by `jq`), so raw payloads never reach the orchestrator's context.
4. **The zero-key core is strong in 2026.** It covers built-in WebSearch and WebFetch, **Parallel Search MCP** (keyless), **DeepWiki MCP** (keyless), **Grep by Vercel MCP** (keyless), **Context7** (keyless at low limits), **Hugging Face MCP** (anonymous, or OAuth), **alphaXiv** (free account via OAuth), plus `curl` skills for **HN Algolia** and **OpenAlex**. All of these worked in today's live probes.
5. **Social signal is the weak spot.** Reddit blocked logged-out JSON access and ended self-service API keys in November 2025, so keyless Reddit MCPs get only RSS data with null scores ([reddit-mcp-buddy README](https://github.com/karanb192/reddit-mcp-buddy)). X is pay-per-use (secondary: about $5 per 1,000 posts after 2026-09-21). Google Trends has no usable free API: the official API is a gated alpha and `pytrends` was archived in April 2025. **Bright Data's Reddit, YouTube and X scrapers, run through `bdata pipelines` on the 5,000-request monthly free tier, are the most practical route.** HN is effortless because the Algolia API is free with no key.

---

## 1. How Claude Code loads MCPs (facts that shape the stack)

Source: https://code.claude.com/docs/en/mcp (fetched 2026-10-15).

| Fact | Implication for HackForge |
|---|---|
| **Tool search is on by default.** All MCP tools are deferred and discovered on demand, and only tool names plus server instructions load at start. `ENABLE_TOOL_SEARCH` accepts unset, `true`, `auto`, `auto:N` and `false`. Tool search turns off automatically when `ANTHROPIC_BASE_URL` points to a non-first-party host. | Schema size matters much less than in 2025. Keep `alwaysLoad: true` for at most the one server used every turn, or none. |
| The server instructions field, and the description of any tool loaded upfront, are cut at **4,096 chars**. Descriptions of deferred tools are cut at 16,384. | When HackForge writes its own MCP servers, put the trigger words first. |
| `MAX_MCP_OUTPUT_TOKENS` defaults to **25,000**, and a warning appears above 10,000. Text results over 50,000 chars are saved to a file. | Results from Parallel or Bright Data can blow past budgets. Run research in subagents, or use CLIs that write files. |
| Scopes are `local` (default, `~/.claude.json`), `project` (`.mcp.json`, shared, needs approval) and `user`. Precedence runs local > project > user > plugin > **claude.ai connectors**. | Ship a project `.mcp.json` for the team. Teammates can also connect the directory connectors (HF, alphaXiv, Exa, Parallel, Tavily, Firecrawl, Context7) in claude.ai, and those then appear in Claude Code. |
| `.mcp.json` expands `${VAR}` and `${VAR:-default}` in `url`, `headers` and `env`. | Never hardcode keys. Use `"Authorization": "Bearer ${EXA_API_KEY}"`. |
| `claude mcp add --transport http <name> <url> --header "K: V"`. For stdio: `claude mcp add [opts] <name> -- <cmd> [args]`. Also `claude mcp add-json <name> '<json>'`, plus OAuth through `/mcp` or `claude mcp login <name>`. `claude -p` and the Agent SDK **cannot run OAuth flows**. | Workflow-tool scripts and headless runs need header or env auth, or a prior interactive login. Prefer keyless servers for headless research. |

---

## 2. Measured footprint and reliability of keyless remote servers (live probe, 2026-10-15)

I ran `initialize`, then `tools/list`, then one `tools/call` against each server from this machine, with no credentials. "Defs" is the JSON size of all tool definitions, which enters context only once the tools are discovered. Tokens are approximated as chars/4.

| Server (URL) | Version | Tools | Defs size | Instr. chars | Test call | Latency | Result size | Status |
|---|---|---|---|---|---|---|---|---|
| Parallel `https://search.parallel.ai/mcp` | 1.27.0 | 2 (`web_search`, `web_fetch`) | 14.2k chars (~3.6k tok) | 1,587 | `web_search` objective + 1 query | 1.29 s | 20.3k chars (**~5.1k tok**) | OK |
| Exa `https://mcp.exa.ai/mcp` | 3.5.0 | 2 (`web_search_exa`, `web_fetch_exa`) | 2.5k (~0.6k tok) | 0 | `web_search_exa` | 0.23 s | — | **Rate-limited on the first anonymous call** ("You've hit Exa's free MCP rate limit") |
| Firecrawl keyless `https://mcp.firecrawl.dev/v2/mcp` | 3.30.2 | 3 (`firecrawl_scrape`, `firecrawl_search`, `firecrawl_parse`) | 27.7k (**~6.9k tok**) | 1,408 | `firecrawl_search` limit 5 | 0.95 s | 3.9k (~1.0k tok) | OK |
| DeepWiki `https://mcp.deepwiki.com/mcp` | 2.14.3 | 3 (`ask_wiki_question`, `read_wiki_contents`, `read_wiki_structure`) | 1.6k (~0.4k tok) | 3,458 | `read_wiki_structure` | 0.19 s | 1.2k (~0.3k tok) | OK. Note that the docs say `ask_question` but the live name is `ask_wiki_question`. |
| Grep by Vercel `https://mcp.grep.app` | 0.1.0 | 1 (`searchGitHub`) | 3.1k (~0.8k tok) | 0 | regex/literal code search | 0.70 s | 9.2k (~2.3k tok) | OK |
| Context7 `https://mcp.context7.com/mcp` | 4.4.2 | 2 (`resolve-library-id`, `query-docs`) | 5.3k (~1.3k tok) | 632 | (list only) | — | — | OK keyless |
| Jina `https://mcp.jina.ai/v1` | 1.9.0 | 12 | 8.6k (~2.2k tok) | 1,113 | `read_url` | 1.69 s | 2.2k (~0.5k tok) | OK (`read_url` is keyless; the search tools need a key) |
| Hugging Face `https://huggingface.co/mcp` | 0.4.30 | 4 anonymous (`hf_whoami`, `hub_repo_search`, `hub_repo_details`, `hf_fs`) | 20.6k (~5.1k tok) | — | (list only) | — | — | OK anonymous, rate-limited (the connected instance in this session returned "rate-limiting" once) |
| HN (community, hosted) `https://hn.caseyjhand.com/mcp` | 0.5.21 | 4 | 31.7k (**~7.9k tok**) | 488 | `hn_search_content` | 0.77 s | 1.7k (~0.4k tok) | OK, but a third-party host |
| alphaXiv `https://api.alphaxiv.org/mcp/v1` | — | — | — | — | — | — | — | 401: OAuth required (free account; `resource_metadata` advertised) |
| Firecrawl `/v2/mcp-search` | — | 9 (per README) | — | — | — | — | — | 401: OAuth token required |
| Tavily `https://mcp.tavily.com/mcp` | — | 5 | — | — | — | — | — | 401: OAuth or key |
| Bright Data `https://mcp.brightdata.com/mcp` | — | 32 | — | — | — | — | — | 401. **Advertises OAuth with bearer-in-header** (`/.well-known/oauth-protected-resource/mcp` returns `bearer_methods_supported:["header"]`). That means a header works and the documented `?token=` URL param is unnecessary. |
| GitHub `https://api.githubcopilot.com/mcp/` | — | many | — | — | — | — | — | 401: PAT or OAuth |

Takeaways:
- **Firecrawl keyless and the community HN server have the heaviest definitions** (about 7–8k tokens once loaded) despite having only 3–4 tools, because their inputSchemas are very large. With tool search on, the cost only arrives when the tool is discovered, but it is still real.
- **Parallel returns the richest results** (about 5k tokens per search with long excerpts). That is great for answer quality but expensive in an orchestrator context, so call it from subagents.
- **Exa keyless is not reliable enough for a zero-key core.** It was rate-limited on the first call, possibly from a shared egress IP or a quota. *(Secondary: a 3 QPS / 150 per day anonymous tier is reported but unconfirmed.)*
- The raw arXiv API returned **HTTP 429 "Rate exceeded"** on the first `curl` from this machine. Do not make `export.arxiv.org` the primary paper source; prefer alphaXiv or HF Papers.

---

## 3. Per-tool evaluation

Format for each entry: **Unique value / Install (Claude Code) / Auth & cost / Reliability / Footprint / Verdict.** I took install commands from the official READMEs or docs. I marked a command *(derived)* where I built it from the documented URL and auth plus the standard `claude mcp add` syntax.

### 3.1 General web search and fetch

#### Built-in Claude Code `WebSearch` and `WebFetch`
- **Unique:** No setup, no keys, nothing to install. WebSearch is US-only. WebFetch converts a page to markdown and **answers a prompt about it with a small model, so you get a lossy summary rather than raw content.** It fails on authenticated pages and some bot walls.
- **Verdict: Tier A, always on.** Pair it with a raw reader (Parallel `web_fetch`, `bdata scrape`, or `curl https://r.jina.ai/<url>`) for when exact text or quotes matter.

#### Parallel Search MCP (official, keyless): https://github.com/parallel-web/search-mcp
- **Unique:** Two LLM-native tools. `web_search(objective, search_queries[])` returns citation-backed excerpts from several queries in one call, and `web_fetch(urls[], objective?)` returns page content. It is designed to replace several keyword searches with one objective-driven call. Hermes, OpenClaw, Codex and Gemini CLI ship it as their keyless default.
- **Install:**
  `claude mcp add --transport http --scope user parallel-search https://search.parallel.ai/mcp` *(derived from the README's server name, URL and transport. The README also offers the plugin route: `/plugin marketplace add parallel-web/parallel-agent-skills` then `/plugin install parallel`.)*
- **Auth & cost:** Anonymous with free-tier rate limits (no number published). Signing into an account through the Parallel Search connector raises the limits and unlocks mode, domain and result-count settings. The README says *not* to point the plugin at an authenticated endpoint with a key; `/mcp-oauth` is the authenticated URL. Paid API: Turbo/Fast about $1 and Basic/Advanced about $5 per 1,000 requests, $5 of free credits a month, 600 requests per minute *(secondary: parallel.ai articles, July–Sept 2026)*.
- **Reliability:** OK in the live probe (1.3 s). Hosted by the vendor. The repo is the official home.
- **Footprint:** 2 tools, about 3.6k tokens of definitions, about **5k tokens per search result**.
- **Verdict: Tier A, primary semantic search.** ECC already lists it as key-free (`mcp-configs/mcp-servers.json` → `parallel-search`).

#### Bright Data: CLI `bdata` (installed, v0.4.0) and MCP: https://github.com/brightdata/brightdata-mcp
- **Unique:**
  - Google, Bing and Yandex SERP as structured JSON (`search_engine`, plus batches of 10).
  - Unblocked scraping of any URL to markdown (CAPTCHA and bot walls handled).
  - `discover`: AI relevance-ranked search with intent, date filters, and optional page content.
  - **More than 1,200 pre-built structured scrapers** (`search_scrapers` → `get_scraper_details` → `run_scraper`). The catalog includes **Reddit Posts** (`gd_lvz8ah06191smkebj4`: `discover_by_keyword`, `discover_by_subreddit_url`, `collect_by_url`), **Reddit Comments** (`gd_lvzdpsdlw09j6t702`), **YouTube Videos** (`gd_lk56epmy2i5g7lzu0k`: `discover_by_keyword` with date range), YouTube Comments and Channels, **X Posts** (`gd_lwxkxvnf1cynvib9co`: by URL or profile only, *no keyword search*), and **GitHub repository** (`gd_lyrexgxc24b3d4imjt`: `discover_by_search_url`). I verified these with `bdata pipelines search/info` on 2026-10-15. **There is no Google Trends or Product Hunt scraper in the catalog.**
  - Other tools: a remote browser (14 tools) and `chatgpt_ai_insights` / `perplexity_ai_insights`, which ask ChatGPT and Perplexity a prompt and return their answers.
- **Install:**
  - CLI (preferred for HackForge subagents; already installed and authenticated here): `bdata search "<q>" --json -o out.json`, `bdata discover "<q>" --intent "<goal>" --num-results 10 --json -o out.json`, `bdata scrape <url> -o page.md`, `bdata pipelines run <dataset_id> <method> --keyword "<kw>" ...`.
  - Hosted MCP (README): `claude mcp add --transport http brightdata "https://mcp.brightdata.com/mcp?token=YOUR_API_TOKEN"`. **Better:** `claude mcp add --transport http brightdata "https://mcp.brightdata.com/mcp?tools=search_engine,scrape_as_markdown,discover,search_engine_batch,scrape_batch" --header "Authorization: Bearer ${BRIGHTDATA_API_TOKEN}"`. *(Derived: the live server advertises OAuth with `bearer_methods_supported:["header"]`. Plain `claude mcp add --transport http brightdata https://mcp.brightdata.com/mcp` followed by `/mcp` login should also work through OAuth. Neither form is in the README, so verify before relying on it.)*
  - Local MCP: `claude mcp add brightdata -e API_TOKEN=$BRIGHTDATA_API_TOKEN -e GROUPS=scrapers -- npx -y @brightdata/mcp`.
- **Auth & cost:** **5,000 free requests per month, no card required, renewing on the 1st, shared across a team account.** After that: $1.50 per 1,000 results for search, scrape and extract, and $8/GB for browser use. Requests stop when the free tier runs out unless funds are deposited, and a spend cap can be set (README "Pricing and Free Tier").
- **"Pro mode":** **Removed in v3.1.0 (2026-10-15)**. `PRO_MODE` is now ignored, **all 32 tools are on by default**, and `GROUPS` (`scrapers`, `browser`, `geo`, `advanced_scraping`) or `TOOLS` restrict them. v3.0.0 (2026-10-11) **removed 46 `web_data_*` tools** in favor of the generic scraper tools ([CHANGELOG](https://github.com/brightdata/brightdata-mcp/blob/main/CHANGELOG.md)). **Any 2025-era guide or skill that references `web_data_reddit_posts`, `&pro=1` or "rapid mode" is stale.** The changelog explicitly says to update the `bright-data-mcp`, `competitive-intel` and `price-comparison` skills.
- **Security:** v2.12.0 added a **content gate** (`CONTENT_GATE=on`). Scraped text that looks like instructions to change the MCP config is held behind a user elicitation. v3.1.0 marks every result as untrusted web content.
- **Footprint:** 32 tools by default, so always restrict with `tools=` or `GROUPS`. Scraper results "can be large", and the README itself recommends running bulk collection in a subagent.
- **Verdict: Tier B, the backbone for SERP, unblocking and social data.** Use it through the **CLI from subagents**. Load the MCP only with a 5-tool `tools=` filter, and only if the team wants it in-chat.

#### Exa: https://github.com/exa-labs/exa-mcp-server
- **Unique:** Neural and semantic web search with "find similar" style recall, which is strong for "companies or projects like X". The default tools are `web_search_exa` and `web_fetch_exa`. The optional tools, enabled through `?tools=`, are `web_search_advanced_exa` (domains, dates, highlights, subpages) and `agent_run` (Exa Agent for multi-step lists and enrichment).
- **Install:** `claude plugin install exa@claude-plugins-official` (README), or *(derived)* `claude mcp add --transport http exa https://mcp.exa.ai/mcp --header "x-api-key: ${EXA_API_KEY}"`. The README accepts a `?exaApiKey=` URL param, a `Authorization: Bearer` header, an `x-api-key` header, or OAuth (`https://mcp.exa.ai/mcp?login`). Use the header or OAuth rather than the URL param.
- **Auth & cost:** Anonymous access is rate-limited, and it **failed on the first call in my probe**. Paid: $7 per 1,000 search-with-contents (10 results), Deep $12, Deep Reasoning $15, contents $1 per 1,000 ([Exa changelog, 2026-03-03](https://exa.ai/docs/changelog/pricing-update)). The free allowance is reported as raised to 20,000 requests a month in July 2026, or as "$20 signup + $10/mo" *(secondary, conflicting)*.
- **Staleness:** ECC's `exa-search` skill still names `get_code_context_exa` and `crawling_exa`, which are no longer default tools.
- **Verdict: Tier B or C, optional.** Choose **Exa or Tavily, not both**. HackForge's subagent workflow already covers most of `agent_run`'s value.

#### Tavily: https://github.com/tavily-ai/tavily-mcp
- **Unique:** `tavily_search`, `tavily_extract`, `tavily_crawl`, `tavily_map` and `tavily_research` (registry listing). Supports a `DEFAULT_PARAMETERS` header (JSON defaults such as `search_depth` and `max_results`). In the arXiv study above, Tavily had the best rank-1 concentration of supporting evidence: 50% of supporting pre-fetch rows were at rank 1, against 13% for Brave and Firecrawl.
- **Install (README):** OAuth via `claude mcp add --transport http tavily https://mcp.tavily.com/mcp`, then `/mcp` to log in. With a key: `claude mcp add --transport http tavily https://mcp.tavily.com/mcp/?tavilyApiKey=<key>` (prefer the `Authorization: Bearer` header the README also supports). Add `--scope user` to make it global. Local: `npx -y tavily-mcp@latest` with `TAVILY_API_KEY`.
- **Auth & cost:** **1,000 free credits a month, no card**, resetting on the 1st. Paid plans: $30 for 4k credits, then PAYG at $0.008 per credit ([docs.tavily.com/documentation/api-credits](https://docs.tavily.com/documentation/api-credits.md)). **Nebius acquired Tavily** (announced 2026-02-10, up to $400M). The brand continues and no pricing changes have been announced *(secondary)*.
- **Verdict: Tier B alternative to Exa.** Not needed if Parallel and Bright Data are set up.

#### Firecrawl: https://github.com/firecrawl/firecrawl-mcp-server
- **Unique:**
  - **Keyless hosted endpoint** `https://mcp.firecrawl.dev/v2/mcp` exposes only `firecrawl_scrape`, `firecrawl_search` and `firecrawl_parse`, rate-limited. *(Secondary: 1,000 free credits a month with no account, per the [Firecrawl keyless launch](https://www.firecrawl.dev/blog/firecrawl-keyless-launch).)*
  - The **full endpoint** (27 tools, needs a key or OAuth) adds crawl, map, interact, monitor and agent tools.
  - A **search-only endpoint** `/v2/mcp-search` (9 tools, OAuth required) adds `firecrawl_developer_search` (an index of GitHub issues, PRs, READMEs and docs), `firecrawl_gov_search`, and **`firecrawl_research_*`** (paper search, inspect, citation graph and full-text read across arXiv and PubMed/bioRxiv/medRxiv). The research tools are the unique part for non-CS hackathon themes.
- **Install (README pattern):** keyless with `claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp`. With a key, use the same URL plus `--header "Authorization: Bearer ${FIRECRAWL_API_KEY}"`. The README says "**Never put an API key in the server URL**." Local: `claude mcp add firecrawl -e FIRECRAWL_API_KEY=$FIRECRAWL_API_KEY -- npx -y firecrawl-mcp`. CLI: `npx -y firecrawl-cli@latest init` (installs globally, so not for HackForge's default path).
- **Auth & cost:** Free plan of 1,000 credits a month, no card ([firecrawl.dev/pricing](https://www.firecrawl.dev/pricing)). A search costs 2 credits, and 1 is refunded via `firecrawl_search_feedback`.
- **Footprint:** The keyless 3 tools come to **about 6.9k tokens of definitions**, the heaviest per tool I measured. The full profile has 27 tools.
- **Verdict: Tier C.** It overlaps with Bright Data (scraping) and Parallel (search). Add it only if a team needs `crawl` or `map` of a docs site and has no Bright Data account. ECC's `deep-research` skill is built on Firecrawl and Exa, so HackForge's version should be built on Parallel and Bright Data instead.

#### Perplexity (official): https://github.com/perplexityai/modelcontextprotocol
- **Unique:** `perplexity_search` (Search API with recency and domain filters, plus `search_type:"fast"`), `perplexity_ask` (Agent API `fast` preset), `perplexity_reason` (`medium`), and `perplexity_research` (`high`, which runs for minutes). It returns synthesized, cited answers rather than raw results.
- **Install (README):** `claude mcp add --transport http perplexity https://api.perplexity.ai/mcp --header "Authorization: Bearer YOUR_API_KEY"`. Local: `claude mcp add perplexity --env PERPLEXITY_API_KEY="your_key_here" -- npx -y @perplexity-ai/mcp-server`.
- **Auth & cost:** **No free tier.** The Search API is $5 per 1,000 requests ($1 per 1,000 with Fast) ([docs.perplexity.ai pricing](https://docs.perplexity.ai/docs/getting-started/pricing)). Sonar adds token costs plus $5–14 per 1,000 requests.
- **Verdict: Tier C or avoid.** It pays a second LLM to do the synthesis Claude already does, and the answer comes back pre-digested. That undermines HackForge's goal of citing and scoring sources. Bright Data's `perplexity_ai_insights` covers the "what does Perplexity say" GEO check when needed.

#### Brave Search MCP (official): https://github.com/brave/brave-search-mcp-server
- **Unique:** Independent index. Tools: `brave_web_search`, `brave_news_search`, `brave_video_search`, `brave_image_search`, `brave_local_search`, `brave_place_search`, `brave_summarizer`, and **`brave_llm_context`** (pre-extracted, token-budgeted grounding context with Goggles re-ranking). In the arXiv study it exposed the most answer support in snippets before any fetch (30/100 queries, against 16 for Tavily and Firecrawl).
- **Install (derived from README stdio args):** `claude mcp add brave-search -e BRAVE_API_KEY=$BRAVE_API_KEY -- npx -y @brave/brave-search-mcp-server --transport stdio`. Use `BRAVE_MCP_ENABLED_TOOLS="brave_web_search brave_llm_context"` to keep it small. STDIO is now the default.
- **Auth & cost:** **The old free tier is gone.** It is now $5 per 1,000 requests, with **$5 of credit each month (about 1,000 queries), a card is required, and there is no default spend cap** *(secondary: implicator.ai and costbench, 2026)*.
- **Verdict: Avoid as a default** (card required, overlaps). Tier C only for teams that want an index independent of Google.

#### Jina AI remote MCP (official): https://github.com/jina-ai/MCP
- **Unique:** `read_url` (web page or PDF to markdown; pass `question` to get passages only), `extract_pdf` (figures, tables and equations from arXiv PDFs), `guess_datetime_url`, `sort_by_relevance` (reranker), `deduplicate_strings` (embedding-based diversity), and `search_arxiv` / `search_ssrn`. Server-side tool filtering is available through `?include_tools=` and `?exclude_tags=`, and `max_tokens=` caps `read_url` output.
- **Install (README):** `claude mcp add -s user --transport http jina https://mcp.jina.ai/v1 --header "Authorization: Bearer ${JINA_API_KEY}"`. The header is optional for `read_url`.
- **Auth & cost:** `read_url`, `capture_screenshot_url` and `primer` work without a key at rate limits. The search tools, reranker, deduper and `extract_pdf` need a key (free keys at jina.ai).
- **Verdict: No MCP for HackForge.** Use the zero-key Reader directly in skills: `curl -s "https://r.jina.ai/<url>"`. That gives raw markdown, which the arXiv study used as its shared fetch backend. The `deduplicate_strings` and `sort_by_relevance` tools are interesting for idea deduplication, but they are Tier C.

#### Other web options considered
- **Kagi** (`claude mcp add kagi https://mcp.kagi.com/mcp --transport http --header "Authorization: Bearer …" --scope user`): high-quality index, paid only. Tier C.
- **DuckDuckGo MCP** (`claude mcp add ddg-search uvx duckduckgo-mcp-server`): zero-key but scrape-based and fragile (default 30 searches per minute). It is a worse fallback than the built-in WebSearch, so avoid.
- **Apify MCP** (`https://mcp.apify.com`, OAuth or `APIFY_TOKEN`): more than 8,000 actors including Reddit, Google SERP and RAG Web Browser. Pay per run (one Reddit MCP actor costs $20 per 1,000 calls). It overlaps with Bright Data. Tier C fallback.
- **Nimble, SciSpace, Elicit** (in the claude.ai directory): niche. Elicit is useful for biomed or clinical themes (`search_papers`, `search_trials`). Tier C.

### 3.2 Code, repos and docs

#### Grep by Vercel MCP (keyless): `https://mcp.grep.app`
- **Unique:** Literal or regex code search across about 1M public GitHub repos, with one tool, `searchGitHub(query, useRegexp, language[], repo, path, matchCase, matchWholeWords)`. It shows how real projects use an API, which is ideal for quick feasibility checks such as "has anyone wired X to Y?".
- **Install:** `claude mcp add --transport http grep https://mcp.grep.app` ([Vercel blog, 2025-07-17](https://vercel.com/blog/grep-a-million-github-repositories-via-mcp)).
- **Probe:** OK at 0.70 s, about 2.3k tokens per result, 1 tool of about 0.8k tokens.
- **Verdict: Tier A.**

#### DeepWiki MCP (Cognition, keyless): `https://mcp.deepwiki.com/mcp`
- **Unique:** AI-generated wiki and Q&A over **any public GitHub repo**. The live tool names are `read_wiki_structure`, `read_wiki_contents` and `ask_wiki_question`; the docs still say `ask_question`. It is the fastest way to understand a candidate library or competitor repo without cloning it.
- **Install (official docs):** `claude mcp add -s user -t http deepwiki https://mcp.deepwiki.com/mcp`. The `/sse` endpoint is being deprecated.
- **Auth & cost:** Free, no auth, public repos only ([docs.devin.ai/work-with-devin/deepwiki-mcp](https://docs.devin.ai/work-with-devin/deepwiki-mcp)).
- **Probe:** OK at 0.19 s with tiny definitions (about 0.4k tokens).
- **Verdict: Tier A.**

#### Context7: https://github.com/upstash/context7
- **Unique:** Up-to-date, version-specific library docs and snippets through `resolve-library-id` and `query-docs(libraryId, query)`. It matters most in the **build** phase, but research uses it for feasibility checks (does the SDK support X?).
- **Install:**
  - **CLI plus skill mode with no MCP, the best fit for HackForge:** `npx ctx7 setup --claude` (OAuth, generates a key, installs a skill that calls `ctx7 library …` and `ctx7 docs …`). It needs Node 22.13 or newer.
  - Or MCP: `claude mcp add --transport http context7 https://mcp.context7.com/mcp --header "Authorization: Bearer ${CONTEXT7_API_KEY}"` *(derived: the README gives the URL and Bearer header)*.
- **Auth & cost:** Keyless works at low limits (confirmed by probe). A free key gives about **1,000 calls a month** *(secondary: free tier cut to 500 in January 2026, then raised to 1,000 on 2026-01-16)*. Each lookup is about 2 calls.
- **Verdict: Tier A (keyless) or Tier B (free key).** ECC also moved it to a skill using the REST API (`/api/v2/libs/search`, `/api/v2/context`).

#### GitHub official MCP server: https://github.com/github/github-mcp-server
- **Unique:** Full GitHub API as tools, covering repo, file and tree reads, `search_repositories`, `search_code`, issues, PRs, Actions, discussions, stargazers and more. The remote server is at `https://api.githubcopilot.com/mcp/`. The default toolsets are `context`, `repos`, `issues`, `pull_requests` and `users`. It can be restricted per URL (`/x/repos/readonly`) or with headers: **`X-MCP-Toolsets: repos`**, **`X-MCP-Readonly: true`**, `X-MCP-Tools: …`, and `X-MCP-Lockdown`, which hides public issue content from users without push access, a best-effort prompt-injection filter ([docs/remote-server.md](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md)). Insiders builds are at `/mcp/insiders`.
- **Install (official `docs/installation-guides/install-claude.md`, Claude Code 2.1.1+):**
  ```bash
  claude mcp add-json github '{"type":"http","url":"https://api.githubcopilot.com/mcp","headers":{"Authorization":"Bearer YOUR_GITHUB_PAT"}}'
  ```
  For research, HackForge should use a read-only and narrow variant:
  ```bash
  claude mcp add-json github '{"type":"http","url":"https://api.githubcopilot.com/mcp/x/repos/readonly","headers":{"Authorization":"Bearer ${GITHUB_PAT}"}}' --scope project
  ```
  The legacy form is `claude mcp add --transport http github https://api.githubcopilot.com/mcp -H "Authorization: Bearer $GITHUB_PAT"`. A local Docker option exists with OAuth: `claude mcp add github -e GITHUB_OAUTH_CALLBACK_PORT=8085 -- docker run -i --rm -p 127.0.0.1:8085:8085 -e GITHUB_OAUTH_CALLBACK_PORT ghcr.io/github/github-mcp-server`.
- **Auth & cost:** Free with a fine-grained PAT (read-only on public repos is enough for research).
- **Verdict: Tier B, and only if the team wants issue and PR operations in the build phase.** For research, **`gh` CLI or `curl api.github.com/search/repositories?q=…&sort=stars`** in a skill is cheaper and is what ECC switched to (`github-ops` skill). Note that unauthenticated REST search allows only 10 requests per minute. **Avoid** `@modelcontextprotocol/server-github`, which ECC's catalog still lists but which is deprecated in favor of the official server.

### 3.3 Papers, models and datasets

#### alphaXiv MCP (connected in this session): `https://api.alphaxiv.org/mcp/v1`
- **Unique:** Fast search and full-text access over about 2.5M arXiv papers. Tools include `discover_papers` (ranked, with recency/popular/historical priority), `answer_pdf_queries` (cited page-level passages from one paper; I used it in this research), `get_paper_content`, hot and for-you feeds, a researcher graph, and `read_files_from_github_repository`. It covers CS, math, physics, stats, EE and q-bio/q-fin, **but not biomedical or clinical work.**
- **Install:** claude.ai Settings → Connectors → alphaXiv (directory UUID `fa0fb2e1-…`), which shows up in Claude Code. Or *(derived)* `claude mcp add --transport http alphaxiv https://api.alphaxiv.org/mcp/v1`, then `/mcp` for OAuth. The live 401 advertises OAuth (`authorization_uri=https://api.alphaxiv.org/auth`).
- **Auth & cost:** Free account. Rate notes: "2 searches per message" on `discover_papers`.
- **Verdict: Tier A (free account).** It is the best way to ground an idea in recent papers ("what's new on X in the last 6 months?").

#### Hugging Face MCP (official, connected): `https://huggingface.co/mcp`
- **Unique:** Live Hub data. `hf_fs` handles `ls hf://models/trending`, `hf://datasets/trending`, `hf://spaces/trending`, `hf://papers/trending` and `hf://papers/daily/latest`, plus `search hf://models QUERY` and `cat` of READMEs and paper markdown. There are also `hub_repo_search`, `hub_repo_details`, and `dynamic_space` (running Gradio Spaces as tools). It is the best **"what AI capability is hot this week"** signal for ideation and the fastest way to find a ready model or Space to demo on.
- **Install (README):** `claude mcp add hf-mcp-server -t http https://huggingface.co/mcp?login` (OAuth), or `-H "Authorization: Bearer <HF_TOKEN>"`. Configure tools at https://huggingface.co/settings/mcp. Add `?no_image_content=true` to drop image blocks.
- **Auth & cost:** Free. It works anonymously with rate limits. The connected instance returned "rate-limiting" once today, so retry with backoff.
- **Footprint:** 4 anonymous tools, about 5.1k tokens of definitions.
- **Verdict: Tier A.**

#### arXiv MCP (community, popular): https://github.com/blazickjp/arxiv-mcp-server
- **Unique:** 19 tools, including local paper download to markdown, section-by-section LaTeX reading, BibTeX export, a citation graph via Semantic Scholar, and topic watches on disk.
- **Install (README):** `claude mcp add --transport stdio --scope user arxiv -- uvx arxiv-mcp-server`.
- **Verdict: Tier C.** alphaXiv and HF Papers cover discovery and reading, and the upstream arXiv API returned 429 in my test.

#### Semantic Scholar, OpenAlex and multi-source paper search
- **Semantic Scholar MCP** (community, `xiuyechen/semantic-scholar-mcp`): `claude mcp add semantic-scholar -e S2_API_KEY=… -- semantic-scholar-mcp` (pip install first). Without a key it hits frequent 429s at about 1 request per second, and keys take "a few days" to issue. **Not hackathon-friendly.**
- **OpenAlex REST** (zero-key, tested today and working): `curl "https://api.openalex.org/works?search=<q>&sort=publication_date:desc&per-page=10"`. It covers all disciplines, including the biomed areas alphaXiv lacks. **Use it in a skill (Tier A); it needs no MCP.**
- **paper-search-mcp** (`uvx paper-search-mcp`, 20+ sources): broad, but it includes an **optional Sci-Hub fallback**. Avoid it, or document that HackForge must never enable it.
- **Firecrawl research tools** (OAuth `/v2/mcp-search`) and **Elicit** (claude.ai directory) are the fallbacks for PubMed and bioRxiv in health-themed hackathons. Tier C.

### 3.4 Community and social signal

#### Hacker News
- **Best option: a skill with no MCP, calling the free Algolia API** (tested today):
  `curl -s "https://hn.algolia.com/api/v1/search?query=<q>&tags=story&numericFilters=points%3E100&hitsPerPage=20"`. Use `search_by_date` for recency, and `https://hacker-news.firebaseio.com/v0/topstories.json` and `/item/<id>.json` for front-page items and threads. No keys, generous limits.
- MCP alternatives: `karanb192/hn-mcp` (`claude mcp add hn -- npx -y hn-mcp`, zero-key, Firebase plus Algolia) and `cyanheads/hn-mcp-server` (`npx -y @cyanheads/hn-mcp-server`, or the hosted `https://hn.caseyjhand.com/mcp`, which is a third-party host with about 7.9k tokens of definitions). **Not needed.**

#### Reddit
- **The state of Reddit in 2026:** Reddit blocks the logged-out JSON API and **ended self-service API key creation in November 2025** (Responsible Builder Policy). The keyless `reddit-mcp-buddy` (`claude mcp add --transport stdio reddit-mcp-buddy -s user -- npx -y reddit-mcp-buddy`) can only `browse_subreddit` through RSS, with **score and comment counts as null**. Search, comments and user tools need OAuth credentials ([README](https://github.com/karanb192/reddit-mcp-buddy)).
- **Recommended:**
  - Tier A uses `site:reddit.com` queries through WebSearch or Parallel.
  - Tier B uses **Bright Data Reddit Posts**: `bdata pipelines run gd_lvz8ah06191smkebj4 discover_by_keyword --keyword "<kw>"`, plus comments by URL with `gd_lvzdpsdlw09j6t702`. That returns real upvote and comment counts, billed per record against the 5,000 free requests.
  - Tier C is `last30days` (below), which uses arctic-shift for keyless subreddit discovery with real scores.

#### X / Twitter
- **Official `xdevplatform/xmcp`** is a local FastMCP server over the X OpenAPI spec. It needs an X developer app plus `X_BEARER_TOKEN`, and `X_API_TOOL_ALLOWLIST=searchPostsRecent,…` to limit tools. X API is **pay-per-use** *(secondary: $5 per 1,000 posts and $10 per 1,000 profiles after 2026-09-21; about 2–3M post reads a month cap)*. **Too much setup and money for a hackathon, so avoid.**
- Bright Data X scrapers fetch posts by URL or profile only, with no keyword search. For "what is X saying about topic Y", use SERP results (`site:x.com <topic>`) or last30days with a user-supplied X backend.

#### Product Hunt
- There is **no official Product Hunt MCP.** Community `jaipandya/producthunt-mcp-server` (`pip install product-hunt-mcp`, then `claude mcp add product-hunt -e PRODUCT_HUNT_TOKEN=… -- product-hunt-mcp`) wraps the official GraphQL v2 API with a free Developer Token from https://www.producthunt.com/v2/oauth/applications.
- **Recommended:** Tier C. For competitor scans in ideation, a skill that runs `bdata scrape https://www.producthunt.com/search?q=<kw>` or a SERP query (`site:producthunt.com <kw>`) is enough. Bright Data has no PH scraper.

#### YouTube
- `jkawamoto/mcp-youtube-transcript`: `claude mcp add youtube-transcript -- uvx --from git+https://github.com/jkawamoto/mcp-youtube-transcript mcp-youtube-transcript`. Tools are `get_transcript` (paginated), `get_timed_transcript`, `get_available_languages` and `get_video_info`, with residential-proxy support for IP bans.
- `kimtaeyoon83/mcp-server-youtube-transcript`: `npx -y @kimtaeyoon83/mcp-server-youtube-transcript`, with an optional TwelveLabs `analyze_video`.
- **Reliability caveat:** YouTube's 2026 SABR blocking breaks yt-dlp-style fetches *(secondary)*. Transcript scrapers break periodically.
- For discovery, use Bright Data `gd_lk56epmy2i5g7lzu0k` `discover_by_keyword` (date-ranged video search).
- **Verdict: Tier C.** It is useful for mining competitor demo videos, not core to the flow.

#### Aggregators: `last30days` skill (mvanhorn/last30days-skill, v3.11.x, July 2026)
- **Unique:** One command sweeps Reddit, HN, Polymarket and GitHub with zero config. It unlocks X, YouTube, TikTok, arXiv, Techmeme and Digg through setup, scores results by real engagement, and synthesizes a cited brief. **Discovery mode** ("what's exploding in AI agents?") returns 5–10 velocity-ranked topics with a momentum label, which fits HackForge's "broad theme → hot sub-topics" step directly.
- **Install:** `/plugin marketplace add mvanhorn/last30days-skill` then `/plugin install last30days`.
- **Risks:** It can **extract browser cookies** (Chromium family, macOS Keychain) for X and other walled sources, and it installs helper CLIs on first run. HackForge must document running it in keyless mode only and **never enabling cookie extraction** without the team's informed consent.
- **Verdict: Tier C (opt-in).** Copy its ideas into HackForge's own `community-signal` skill: pre-resolving subreddits, handles and hashtags; engagement-weighted scoring; a velocity or momentum label; and a `doctor` health check.

### 3.5 Trends
- **Google Trends:** The official **Trends API is an application-gated alpha** (announced 2025-07-24, still gated in 2026). `pytrends` was **archived on 2025-04-17**, and its trending endpoints now return 404 *(secondary, Sept 2026 test)*. Community MCPs need paid backends such as HasData, SerpApi or trendsmcp.ai, which offers 100 free requests a month *(secondary)*. Bright Data's catalog has no Trends scraper.
- **Recommended trend proxies, all zero-key:**
  - HF trending models, datasets, Spaces and papers (`hf_fs ls hf://…/trending`)
  - HN Algolia points over time
  - GitHub trending, via `bdata scrape https://github.com/trending?since=weekly` or REST search `created:>YYYY-MM-DD sort:stars`
  - alphaXiv `get_hot_feed`
  - Reddit post velocity via Bright Data
- **Verdict:** Leave Google Trends out of Tier A and B. It is Tier C only if a team has a SerpApi or HasData key.

### 3.6 "Thinking" and memory servers
- **Sequential Thinking** (`npx -y @modelcontextprotocol/server-sequential-thinking`) is a prompting pattern dressed up as a tool. **Avoid it**, because native extended thinking covers it (ECC dropped it in its June 2026 audit).
- **Memory, knowledge-graph style** (`npx -y @modelcontextprotocol/server-memory`; 9 tools such as `create_entities` and `search_nodes`; stored in `MEMORY_FILE_PATH`) is also an **avoid**. Hosted alternatives in the registry (Mem0, Vertiso, memxus) add a prompt-injection-by-memory-poisoning surface. For HackForge, **research memory should be files**: `research/<topic>/sources.jsonl`, `findings.md` and `idea-scores.md`, plus Claude Code's native auto-memory and CLAUDE.md. Files are diffable, shareable, and survive the session.

---

## 4. Overlap map (what not to load together)

| Job | Candidates that do the same thing | HackForge pick | Drop |
|---|---|---|---|
| General web search | WebSearch, Parallel, Exa, Tavily, Brave, Perplexity search, Firecrawl search, Jina search, Bright Data `search_engine`/`discover`, Kagi, DDG | **WebSearch (built-in) + Parallel (keyless MCP) + `bdata search/discover` (CLI)** | Exa, Tavily, Brave, Kagi and DDG as defaults, keeping one of Exa or Tavily as optional |
| Read a URL | WebFetch (lossy), Parallel `web_fetch`, Exa `web_fetch_exa`, Firecrawl scrape, Jina `read_url`, Bright Data `scrape_as_markdown`, Tavily extract | **Parallel `web_fetch`, then `curl r.jina.ai` (raw), then `bdata scrape` (bot walls)** | Firecrawl and Jina MCPs |
| "Deep research" agents | Perplexity research, Tavily research, Exa `agent_run`, Parallel Task, Firecrawl agent | **HackForge's own Workflow fan-out of subagents** | All paid agent endpoints |
| Papers | alphaXiv, HF Papers, arXiv MCP, Firecrawl research, Jina `search_arxiv`, Semantic Scholar, paper-search, Elicit, OpenAlex | **alphaXiv + HF Papers + OpenAlex (curl)** | arXiv MCP, S2 MCP, paper-search (Sci-Hub) |
| Code and repos | GitHub MCP, `gh` CLI, Grep, DeepWiki, Firecrawl developer search, Exa code context | **`gh`/REST (skill) + Grep MCP + DeepWiki MCP** | GitHub MCP for research (keep it only for build-phase PR and issue work) |
| Library docs | Context7, Cloudflare docs MCP, vendor docs MCPs | **Context7 (CLI-skill mode or keyless MCP)** | — |
| Social | Reddit MCPs, xmcp, PH MCP, YouTube MCPs, Apify, Bright Data scrapers, last30days | **Bright Data `pipelines` (Reddit, YouTube) + HN Algolia skill + SERP `site:` queries** | xmcp, Reddit MCPs, Apify (overlap) |
| Trends | Google Trends MCPs, HF trending, HN, GitHub trending | **HF trending + HN + GitHub trending + alphaXiv hot** | Google Trends (no free API) |
| Reasoning and memory | sequential-thinking, memory, Mem0 | **Native thinking + files** | All of them |

---

## 5. The proposed tiered stack

### Tier A: zero-key or free-account core (installs in under 2 minutes, $0)

| # | Component | Type | Install |
|---|---|---|---|
| A1 | Built-in **WebSearch / WebFetch** | built-in | none |
| A2 | **Parallel Search** | remote MCP, keyless | `claude mcp add --transport http --scope project parallel-search https://search.parallel.ai/mcp` |
| A3 | **DeepWiki** | remote MCP, keyless | `claude mcp add --transport http --scope project deepwiki https://mcp.deepwiki.com/mcp` |
| A4 | **Grep by Vercel** | remote MCP, keyless | `claude mcp add --transport http --scope project grep https://mcp.grep.app` |
| A5 | **Context7** | CLI skill, or keyless MCP | `npx ctx7 setup --claude` **or** `claude mcp add --transport http --scope project context7 https://mcp.context7.com/mcp` |
| A6 | **Hugging Face** | remote MCP, anonymous or OAuth | `claude mcp add --transport http --scope project hf https://huggingface.co/mcp?login` (or the claude.ai connector) |
| A7 | **alphaXiv** | remote MCP, free OAuth | claude.ai Connectors → alphaXiv, **or** `claude mcp add --transport http --scope project alphaxiv https://api.alphaxiv.org/mcp/v1`, then `/mcp` |
| A8 | **HN Algolia, OpenAlex, GitHub REST/`gh`, Jina Reader** | HackForge skills using `curl`/`gh` | ship as `skills/research-community`, `skills/research-papers` and `skills/research-code` |

That is six MCP servers with about 13 tools total, all deferred by tool search. Their combined definition size, if every tool were discovered, is about 12k tokens (Parallel 3.6k, DeepWiki 0.4k, Grep 0.8k, Context7 1.3k, HF 5.1k, plus alphaXiv's). Only names and instructions (≤4,096 chars per server) load at session start.

Example project `.mcp.json` for Tier A:
```json
{
  "mcpServers": {
    "parallel-search": { "type": "http", "url": "https://search.parallel.ai/mcp" },
    "deepwiki":        { "type": "http", "url": "https://mcp.deepwiki.com/mcp" },
    "grep":            { "type": "http", "url": "https://mcp.grep.app" },
    "context7":        { "type": "http", "url": "https://mcp.context7.com/mcp",
                         "headers": { "Authorization": "Bearer ${CONTEXT7_API_KEY:-}" } },
    "hf":              { "type": "http", "url": "https://huggingface.co/mcp?login" },
    "alphaxiv":        { "type": "http", "url": "https://api.alphaxiv.org/mcp/v1" }
  }
}
```
Verify the empty-default header behavior for Context7. If it rejects a blank bearer token, omit `headers` in the keyless profile.

### Tier B: best with free keys (about 10 minutes of setup, still $0 at hackathon volume)

| # | Component | Why | Install / auth |
|---|---|---|---|
| B1 | **Bright Data CLI `bdata`** (+ the official `brightdata/skills`) | Google SERP, unblocked scrape, intent-ranked `discover`, and **Reddit and YouTube structured data**. 5,000 free requests a month. | `bdata login` (already done here). Skills: `bdata skill …`. Optional MCP: `claude mcp add --transport http brightdata "https://mcp.brightdata.com/mcp?tools=search_engine,scrape_as_markdown,discover,search_engine_batch,scrape_batch" --header "Authorization: Bearer ${BRIGHTDATA_API_TOKEN}"` *(header auth derived from live OAuth metadata, so verify it)* |
| B2 | **Context7 free key** | Raises the doc-lookup limits for the build phase | Set `CONTEXT7_API_KEY`; the A5 entry picks it up |
| B3 | **GitHub official MCP (read-only, `repos` toolset)** | Only if the team wants in-chat repo and issue ops; otherwise use `gh` | `claude mcp add-json github '{"type":"http","url":"https://api.githubcopilot.com/mcp/x/repos/readonly","headers":{"Authorization":"Bearer ${GITHUB_PAT}"}}' --scope project` |
| B4 | **Exa or Tavily (pick one)** | A second semantic provider for "similar companies/projects" recall. Exa is stronger at neural similarity; Tavily gives 1,000 free credits a month with no card. | Exa: `claude mcp add --transport http exa https://mcp.exa.ai/mcp --header "x-api-key: ${EXA_API_KEY}"`. Tavily: `claude mcp add --transport http tavily https://mcp.tavily.com/mcp`, then `/mcp` OAuth. |

### Tier C: optional or situational

| Component | When | Install |
|---|---|---|
| `last30days` plugin | Community-trend sweeps for a theme (keyless mode only, **no cookie extraction**) | `/plugin marketplace add mvanhorn/last30days-skill` → `/plugin install last30days` |
| YouTube transcripts | Mining competitor demo videos or talks | `claude mcp add youtube-transcript -- uvx --from git+https://github.com/jkawamoto/mcp-youtube-transcript mcp-youtube-transcript` |
| Product Hunt | Launch-competitor scans | `pip install product-hunt-mcp` → `claude mcp add product-hunt -e PRODUCT_HUNT_TOKEN=$PH_TOKEN -- product-hunt-mcp`, or `bdata scrape` |
| Firecrawl (key or OAuth) | Crawling or mapping a docs site; biomed papers via `/v2/mcp-search` research tools | `claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp --header "Authorization: Bearer ${FIRECRAWL_API_KEY}"` |
| Elicit or OpenAlex-heavy flow | Health or clinical themes (alphaXiv excludes biomed) | claude.ai connector (Elicit) / curl (OpenAlex) |
| Perplexity | A team already pays for credits and wants `perplexity_research` | `claude mcp add --transport http perplexity https://api.perplexity.ai/mcp --header "Authorization: Bearer ${PERPLEXITY_API_KEY}"` |
| Brave | An index independent of Google is wanted (card required) | `claude mcp add brave-search -e BRAVE_API_KEY=$BRAVE_API_KEY -e BRAVE_MCP_ENABLED_TOOLS="brave_web_search brave_llm_context" -- npx -y @brave/brave-search-mcp-server --transport stdio` |
| Google Trends (SerpApi/HasData) | A judge-facing "market interest" chart is needed and someone has a key | third-party MCPs (unverified quality) |
| Kagi | A team member has a Kagi API key | `claude mcp add kagi https://mcp.kagi.com/mcp --transport http --header "Authorization: Bearer ${KAGI_API_KEY}" --scope user` |

### Avoid
- **Sequential Thinking** and **Memory** MCPs: native features cover them, and ECC dropped both.
- **`@modelcontextprotocol/server-github`**: deprecated, and still present in ECC's catalog. Use `github/github-mcp-server` or `gh`.
- **More than two general web-search MCPs at once.** That causes tool confusion with no recall gain beyond what a second diverse provider gives.
- **API keys in URL query strings** (`?token=`, `?tavilyApiKey=`, `?exaApiKey=`): they leak through logs and screenshots. Use `--header` and `${VAR}` expansion, or OAuth.
- **paper-search-mcp with Sci-Hub enabled**, and **cookie-extracting scrapers** (last30days' X and other walled sources, Reddit write-capable MCPs).
- **Third-party hosted community endpoints** such as `hn.caseyjhand.com` for anything non-public. Exa **keyless** should also not be part of a "must work" path.
- **Smithery or `mcp-get` one-click installers.** They add an unreviewed supply-chain hop.

---

## 6. What HackForge should copy, adapt or avoid from ECC

| ECC artifact | Verdict | Why |
|---|---|---|
| `docs/MCP-CONNECTOR-POLICY.md` ("a default connector must be universal **and** beat a CLI wrapped in a skill") | **Copy the rule.** Ship the Tier A MCPs, which are keyless, universal and stateless-but-MCP-native, plus CLI skills for everything else. | It matches Claude Code's 2026 tool-search economics |
| `mcp-configs/mcp-servers.json` (about 35 opt-in servers, with "Keep under 10 MCPs enabled") | **Adapt.** HackForge ships 6 Tier A servers and documents Tier B and C as snippets. | ECC's catalog includes stale entries (deprecated GitHub server, `exa-mcp-server` npx with key) |
| `skills/deep-research/SKILL.md` (sub-questions → 15–30 sources → deep-read 3–5 → cited report; untrusted-source rules; parallel subagents) | **Copy the structure, swap the tools** (Parallel + `bdata` instead of Firecrawl + Exa). Keep its "Untrusted Sources" section verbatim in spirit. | The tool names in it are now stale (`crawling_exa`, `web_search_advanced_exa` defaults) |
| `skills/search-first/SKILL.md`, "Tool availability preflight" | **Copy.** Make it a `/hf-doctor` command that probes each channel (one cheap call each, as in this report's §2) and prints which research lanes are live, degraded or missing keys | last30days' `doctor` does the same and users love it |
| `skills/exa-search/SKILL.md` | **Avoid.** It is Exa-only, with stale tool names. | — |

---

## 7. Implementation notes for HackForge's research skills and workflows

1. **Use CLIs and files, not chat payloads.** Subagents run `bdata search "<q>" --json -o "$RUN/serp-<n>.json"` and then `jq '.organic[:8][] | {title, link, description}'`. They append normalized rows to `research/<topic>/sources.jsonl` with fields `{url, title, source_type, date, engagement, snippet, provider}`. The orchestrator reads only the distilled `findings.md`.
2. **Use two-provider recall by design.** For each sub-question, run one Parallel `web_search` (objective-phrased) and one `bdata search` (keyword, Google), then dedupe by normalized URL. This captures the complementarity measured in arXiv 2607.10198.
3. **Fetch in a fixed order:** snippets first. If they are insufficient, use Parallel `web_fetch`, then `curl -s https://r.jina.ai/<url>` (raw markdown, zero-key), then `bdata scrape <url>` (bot walls). Never use WebFetch for quotes, because it summarizes.
4. **Build a community-signal lane with engagement numbers.**
   - HN Algolia: `points`, `num_comments`, `created_at`.
   - Bright Data Reddit Posts `discover_by_keyword`: upvotes and comments.
   - GitHub REST search: stars and `pushed_at`.
   - HF trending: likes and downloads.
   - The `idea-scorer` should weight the "pain evidence" and "market pull" criteria by these numbers, as last30days does.
5. **Build an academic lane.** Run alphaXiv `discover_papers` with `prioritize:"recency"`, then `answer_pdf_queries` for the top 2–3. Use HF `ls hf://papers/trending` for momentum and OpenAlex `curl` for non-CS or biomed themes.
6. **Build a feasibility lane, which is HackForge's edge for demo-first ideas.** For each top idea:
   - Grep `searchGitHub` for the key API or integration pattern
   - DeepWiki `ask_wiki_question` on the most-starred matching repo
   - Context7 `query-docs` for the SDK
   - HF `hub_repo_search` for a ready model or Space to demo
   - Output: a "buildable in 24h?" verdict with links.
7. **Treat everything fetched as untrusted.** It is data, never instructions. Corroborate any claim used in the pitch with at least 2 independent sources. Two 2026 papers show search agents can be steered by planted web content: [2606.16821](https://www.alphaxiv.org/abs/2606.16821) on endorsement manipulation and [2609.06027](https://www.alphaxiv.org/abs/2609.06027) on hierarchical evidence poisoning. Keep Bright Data's `CONTENT_GATE=on`, and use GitHub MCP's `X-MCP-Lockdown: true` if it is enabled.
8. **Plan for headless and Workflow runs.** OAuth-only servers (alphaXiv, HF `?login`, Tavily OAuth) do not work under `claude -p` or the Agent SDK until someone signs in once interactively ([Claude Code docs](https://code.claude.com/docs/en/mcp)). HackForge's Workflow scripts should either run `/mcp` login during `/hf-setup` or fall back to the keyless lanes (Parallel, DeepWiki, Grep, curl skills, `bdata` with stored login).
9. **Budget guardrails.** Show `bdata budget` in `/hf-doctor`. The Bright Data free tier of 5,000 requests a month is shared by the team account. Cap `limit_per_input` (default 10) on `discover_by_*` scraper runs. Set `BASE_TIMEOUT` and `RATE_LIMIT` (for example `100/1h`) if the MCP is used.

---

## 8. Open questions and things to verify before shipping

- **Bright Data hosted MCP with `Authorization: Bearer` (no `?token=`) and with OAuth through `/mcp`.** The live server advertises both (`bearer_methods_supported:["header"]`, `authorization_servers:["https://brightdata.com"]`), but the README documents only `?token=`. Test it once.
- **Exa anonymous limits.** I was throttled on the first call. Is that per-IP, or did my shared egress cause it? Re-test from a normal network before deciding whether Exa can be "keyless optional".
- **Parallel anonymous rate limits** are not published. Run a burst test (e.g., 20 calls in 1 minute) to set HackForge's subagent concurrency.
- **Context7 header handling** when `CONTEXT7_API_KEY` is empty (`Bearer ` with an empty value). It may reject the request, in which case HackForge needs two profiles.
- **Firecrawl keyless credit accounting** (1,000 a month with no account) is reported by Firecrawl's blog. How it is enforced (IP or fingerprint) is unclear.
- **Reddit:** check whether any free OAuth path still works for new apps after November 2025. If not, Bright Data is the only reliable way to get Reddit scores.
- **Google Trends alpha API:** can a team get access within a hackathon timeline? Probably not.
- **ECC's `deep-research` and `market-research` skills** assume Firecrawl and Exa. Confirm that HackForge's rewrite (Parallel + `bdata`) keeps output quality on 3–5 test themes.

---

## Sources

**Official READMEs and docs (fetched 2026-10-15):**
- Claude Code MCP docs: https://code.claude.com/docs/en/mcp
- Bright Data MCP: https://github.com/brightdata/brightdata-mcp (README and CHANGELOG v3.0.0 / v3.1.0); https://docs.brightdata.com/ai/mcp-server/overview
- Parallel Search MCP: https://github.com/parallel-web/search-mcp ; https://github.com/parallel-web/parallel-agent-skills
- Exa MCP: https://github.com/exa-labs/exa-mcp-server ; pricing: https://exa.ai/docs/changelog/pricing-update
- Tavily MCP: https://github.com/tavily-ai/tavily-mcp ; credits: https://docs.tavily.com/documentation/api-credits.md
- Firecrawl MCP: https://github.com/firecrawl/firecrawl-mcp-server ; CLI: https://github.com/firecrawl/cli ; pricing: https://www.firecrawl.dev/pricing ; keyless: https://www.firecrawl.dev/blog/firecrawl-keyless-launch
- Perplexity MCP: https://github.com/perplexityai/modelcontextprotocol ; pricing: https://docs.perplexity.ai/docs/getting-started/pricing
- Brave Search MCP: https://github.com/brave/brave-search-mcp-server
- Jina MCP: https://github.com/jina-ai/MCP
- Context7: https://github.com/upstash/context7
- GitHub MCP: https://github.com/github/github-mcp-server ; docs/installation-guides/install-claude.md ; docs/remote-server.md
- Hugging Face MCP: https://github.com/huggingface/hf-mcp-server
- DeepWiki MCP: https://docs.devin.ai/work-with-devin/deepwiki-mcp
- Grep MCP: https://vercel.com/blog/grep-a-million-github-repositories-via-mcp
- arXiv MCP: https://github.com/blazickjp/arxiv-mcp-server ; paper-search-mcp: https://github.com/openags/paper-search-mcp ; Semantic Scholar MCP: https://github.com/xiuyechen/semantic-scholar-mcp
- Reddit MCP Buddy: https://github.com/karanb192/reddit-mcp-buddy ; HN MCPs: https://github.com/karanb192/hn-mcp , https://github.com/cyanheads/hn-mcp-server
- Product Hunt MCP: https://github.com/jaipandya/producthunt-mcp-server ; YouTube: https://github.com/jkawamoto/mcp-youtube-transcript , https://github.com/kimtaeyoon83/mcp-server-youtube-transcript ; X: https://github.com/xdevplatform/xmcp
- Apify MCP: https://github.com/apify/apify-mcp-server ; DuckDuckGo: https://github.com/nickclyde/duckduckgo-mcp-server ; Kagi: https://github.com/kagisearch/kagimcp
- last30days: https://github.com/mvanhorn/last30days-skill
- Reference servers: https://github.com/modelcontextprotocol/servers (src/sequentialthinking, src/memory, src/fetch)

**Papers:**
- Selvam & Ghosh, "Similar Accuracy, Unequal Evidence: Search APIs as Decision Surfaces for Tool-Using Agents," 2026: https://www.alphaxiv.org/abs/2607.10198
- Web-content manipulation of search agents: https://www.alphaxiv.org/abs/2606.16821 , https://www.alphaxiv.org/abs/2609.06027

**Secondary (pricing and market news, flagged where used):**
- Brave free tier removal: https://www.implicator.ai/brave-drops-free-search-api-tier-puts-all-developers-on-metered-billing.md , https://costbench.com/software/ai-search-apis/brave-search-api/
- Parallel pricing: https://parallel.ai/articles/claude-web-search-vs-parallel , https://parallel.ai/blog/free-web-search-mcp
- Tavily acquired by Nebius: https://www.morganlewis.com/news/2026/02/morgan-lewis-advises-nebius-on-acquisition-of-agentic-search-provider-tavily
- Context7 free tier change: https://blog.devgenius.io/context7-quietly-slashed-its-free-tier-by-92-16fa05ddce03
- Google Trends API alpha: https://ppc.land/google-opens-alpha-testing-for-new-trends-api-targeting-developers-and-journalists/ ; pytrends status: https://dev.to/esteban_ortega/pytrends-is-dead-heres-how-to-get-google-trends-data-in-2026-1a18
- X API pay-per-use: https://bundle.social/blog/x-api-pricing-2026-costs-limits , https://opentweet.io/x-api-pricing

**ECC (untrusted, read-only):** `ecc/docs/MCP-CONNECTOR-POLICY.md`, `ecc/mcp-configs/mcp-servers.json`, `ecc/.mcp.json`, `ecc/skills/deep-research/SKILL.md`, `ecc/skills/exa-search/SKILL.md`, `ecc/skills/search-first/SKILL.md`.

**Live probe artifacts:** `scratchpad/probe/{probe.sh,call.sh,parse.py,schemas.py}` and `scratchpad/probe/out/*` (tools/list and tools/call responses, 2026-10-15). Bright Data catalog lookups: `scratchpad/pl_*.txt`.
