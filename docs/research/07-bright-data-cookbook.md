# 07 — Bright Data cookbook for HackForge research (verified 2026-10-15)

**Scope.** This is a tested cookbook for the Bright Data CLI (`bdata` / `brightdata` **v0.4.0**, npm `@brightdata/cli`, released 2026-10-12) and the Bright Data MCP server (npm `@brightdata/mcp` **v3.1.0**, released 2026-10-15). It is organized by the research jobs HackForge runs in the theme → research → scored-idea phase. Each job lists exact commands, the jq to slim the output, the latency and cost I measured, and when to pick something else.

**How it was verified.** I ran `--help` on every command and subcommand. I read the CLI's installed source (read-only) at `/opt/homebrew/lib/node_modules/@brightdata/cli/dist/`, the 8 Bright Data plugin skills, the MCP README (`raw.githubusercontent.com/brightdata/brightdata-mcp/HEAD/README.md`) and docs.brightdata.com. I made **12 paid calls**: 2 SERP, 3 scrape (one blocked), 5 pipeline runs with 13 records in total, and 2 discover attempts that returned 404. Measured cost: the `cli_unlocker` zone went from $0.11 to $0.12, and the pipelines cost about 13 credits. Raw outputs are in `scratchpad/bd/` (`t_*.json`, `t_*.md`).

> **Staleness flags.** (1) The MCP "Rapid (free) vs Pro" mode is **legacy**. MCP v3.x turns on all 32 tools by default and uses `groups`/`tools` to limit them (see §9). (2) `bdata pipelines <type> <url>`, `bdata pipelines list` and the top-level `bdata status` were **removed in 0.4.0**. Older blog posts and skills still show them. (3) **Discover returned HTTP 404 on this account** (see §2.4). Treat it as optional.

---

## 0. TL;DR decision rule (put this in the HackForge research skill)

```
Need URLs / "what exists" for a phrase?           -> bdata search  (SERP, ~5 s, 1 credit, ALWAYS --country us)
Need the text of a known URL (blog, docs, HN,
  pricing page, Product Hunt, Devpost)?             -> bdata scrape -o file.md (~4.5 s, 1 credit)
Need structured records from a big platform
  (Reddit threads+comments, YouTube transcript+
  comments, app-store/G2/Trustpilot reviews,
  X/TikTok/LinkedIn posts, Crunchbase)?             -> bdata pipelines run (6 s – 7 min, 1 credit PER RECORD)
                                                       -> start --async, harvest later
Semantic "pages matching an intent" + content?    -> bdata discover (404 on this account -> fall back to search+scrape)
Free, faster, structured source exists?           -> use it FIRST: HN Algolia API, GitHub REST search, (Reddit via SERP)
Interactive pages (login walls, infinite scroll)? -> bdata browser … (billed per MB) – rarely worth it in a hackathon
Inside Claude without shell (or for subagents
  that should not shell out)?                       -> Bright Data MCP (same backend + same credit pool), limited to 5-9 tools
```

**Golden rules (verified):**
1. **Always pass `--country us` (and `--language en`) to `search`.** Without it my query was localized to **Mexico** (`general.gl:"MX"`, `language:"en-MX"`).
2. **Always write with `-o <file>`, then jq the file.** Stdout redirection does work (`> f.json`, progress goes to stderr). But raw SERP and YouTube JSON is 22–100 KB per call, full of base64 icons, and floods the agent's context. Slim it before Claude reads it.
3. **Never `bdata scrape` Reddit expecting comments.** `www.reddit.com` gives only the post body (2.6 KB, no comments). `old.reddit.com` is **blocked** without KYC. Use the Reddit pipeline instead.
4. **Pipelines are slow and billed per record.** Kick them off with `--async`, keep `--limit-per-input` / `num_of_*` small, and verify `.error` on each record. Partial failures still exit 0.
5. **`search`, `info` and `refresh` under `pipelines` are free.** They read a cached catalog of 1,278 scrapers in `~/Library/Application Support/brightdata-cli/scrapers.json`, which refreshes daily. Look scrapers up there and never guess a `dataset_id`.

---

## 1. Setup, auth and config (already done on this machine)

| Item | Verified value / command |
|---|---|
| Install | `curl -fsSL https://cli.brightdata.com/install.sh \| bash` or `npm i -g @brightdata/cli` (Node ≥ 20). Both `brightdata` and `bdata` work. |
| Auth check (free) | `bdata zones >/dev/null 2>&1 && echo ok` (this is what the official skills use as a "setup gate") |
| Login variants | `bdata login` (browser OAuth), `--device` (SSH/headless), `--api-key <k>`, `--github` (uses `gh auth token`), `-c <customer-id>` |
| Config files (macOS) | `~/Library/Application Support/brightdata-cli/{config.json,credentials.json,scrapers.json}` (Linux: `~/.config/brightdata-cli/`) |
| Current config | `{"default_format":"markdown","api_url":"https://api.brightdata.com","sanitize_csv":true,"default_zone_unlocker":"cli_unlocker"}` |
| Zones | `stock_data` (browser_api), `cli_unlocker` (unblocker), `cli_browser` (browser_api). **There is no SERP zone.** `search` falls back to `cli_unlocker`, which works (source: `dist/commands/search.js` L160). |
| Config keys | `default_zone_unlocker`, `default_zone_serp`, `default_format`, `api_url`, `sanitize_csv` (`bdata config get|set <key> [value]`) |
| Env overrides | `BRIGHTDATA_API_KEY`, `BRIGHTDATA_UNLOCKER_ZONE`, `BRIGHTDATA_SERP_ZONE`, `BRIGHTDATA_POLLING_TIMEOUT` |
| Precedence | CLI flags > env > config.json > defaults |
| Budget | `bdata budget zones` works (it prints a table and ignores `--json`). **`bdata budget` / `budget balance` return 403** because "API key lacks the required permissions". The key is scoped, so HackForge cannot read the remaining balance. Keep its own call ledger (§8). |
| Retries | The client auto-retries 429/500/502/503/504 up to 3 times with exponential backoff (cap 16 s) (`dist/utils/client.js`). The `(attempt 1)` lines on stderr come from this. |

**There is no default-country config key.** Pass `--country` on every `search` call (put it in the wrapper, §8).

---

## 2. Command reference (every flag, from `--help`)

Global: `-k/--api-key <key>`, `--timing`, `-v/--version`, `-h/--help`. Most data commands also accept `-o/--output <path>`, `--json`, `--pretty` and `--timing`.

### 2.1 `bdata search <query>` (SERP API via `/request`, Google gets `brd_json=1`)
| Flag | Notes |
|---|---|
| `--engine google\|bing\|yandex` | Default is google. Google returns parsed JSON; Bing and Yandex return markdown. |
| `--country <cc>` | Becomes `gl=` (Google) or `cc=` (Bing). **Always set it.** |
| `--language <code>` | Becomes `hl=` / `setLang=` |
| `--page <n>` | 0-indexed page; Google uses `start=n*10`. This is a page index, not a count (~10 results per page). |
| `--type web\|news\|images\|shopping` | Maps to `tbm=nws`, `tbm=isch`, `udm=28` |
| `--device desktop\|mobile` | Mobile adds `brd_mobile=1` |
| `--zone <name>` | SERP zone (default: serp, then unlocker) |

**Verified output (web):** top-level keys `general, input, navigation, organic, pagination, related`. `organic[]` = `{link, source, display_link, title, description, snippet_highlighted_words, icon(base64!), rank, global_rank}`. `display_link` for Reddit carries "200+ comments · 1 year ago", a free engagement and recency signal. `related[]` = `{text, link, rank}` (useful query expansions). `pagination` = `{current_page,next_page,next_page_link,next_page_start,pages}`. `general` = `{search_engine, query, results_cnt, gl, language, country, timestamp…}`.
**Verified output (news):** keys `general,input,navigation,news,pagination`. `news[]` = `{title, link, source, source_logo(b64), description, date ("7 hours ago" / "Apr 22, 2026"), image_base64, rank, global_rank}`. **The results are in `.news`, not `.organic`.**
**Latency/size:** web search took 4.5 s for 22 KB (10 results). News took 13 s wall for 87 KB, most of it base64 images.

### 2.2 `bdata scrape <url>` (Web Unlocker via `/request`)
| Flag | Notes |
|---|---|
| `-f markdown\|html\|screenshot\|json` | Default markdown. `screenshot` writes a PNG (default `screenshot.png`). |
| `--country <cc>`, `--mobile`, `--zone <name>` | Geo and user agent |
| `--async` | **Avoid.** It only prints a `response_id`, and 0.4.0 has **no command to fetch it** (the top-level `status` was removed). |
| `-o`, `--json`, `--pretty`, `--timing` | |

**Verified:** an HN thread came back as 13 KB of clean markdown with all comments in 4.4 s. A `www.reddit.com` thread came back as 2.6 KB, post body only, **no comments** (they lazy-load), in 4.5 s. **`old.reddit.com` failed** with `Residential Failed (bad_endpoint): Requested site is not available for immediate residential (no KYC) access mode in accordance with robots.txt` (exit 1, ~4 s).

### 2.3 `bdata pipelines …` (Web Scraper API; `/datasets/v3/trigger` + snapshot)
| Subcommand | Flags | Cost |
|---|---|---|
| `search <query...>` | `--limit 1-50` (default 10), `-o`, `--json`, `--pretty`, `--timing` | free (local cache, 0.35 s) |
| `info <dataset_id> [method]` | `-o`, `--json`, `--pretty`, `--timing` | free (~0.8 s) |
| `run <dataset_id> <method> [inputs...]` | `--<field> <value>` (exact field names from `info`, e.g. `--sort_by`, `--num_of_posts`), `--input '<json>'\|@file.json`, `--limit-per-input <n>` (discover_* only, 1–1000, default 10, **every record billed**), `--async`, `--format json\|csv\|ndjson\|jsonl`, `--timeout <s>` (default 600 or `BRIGHTDATA_POLLING_TIMEOUT`), `-o`, `--json`, `--pretty`, `--timing` | 1 credit per record |
| `status <snapshot_id>` | `--wait`, `--timeout <s>`, `-o`, `--json`, `--pretty`, `--timing` | free |
| `results <snapshot_id>` | `--format json\|csv\|ndjson\|jsonl`, `-o`, … | free (records already billed) |
| `refresh` | `-o`, `--json`, … | free |

Input rules (from `dist/utils/scraper_input.js`): values are typed by field type (number, `true`/`false`; a bare boolean flag means true; arrays are comma-separated). Positional URLs give one record each. Giving both positional URLs and `--url` is an error. **Unknown or missing required fields fail before triggering**, so a typo costs nothing. Use method names exactly as listed, including any misspellings.
`--async` output: `{"snapshot_id":"sd_…"}`. `status` output: `{"status":"running|ready|failed", "snapshot_id", "dataset_id", "running_time"}`, and when ready `{"records":1,"errors":0,"collection_duration":48434,"avg_duration_per_input":48434}`.

### 2.4 `bdata discover <query>` (Discover API, `POST /discover` → poll `task_id`)
Flags: `--intent <text>`, `--country <cc>` (default US), `--city <name>`, `--language <code>` (default en), `--num-results <n>` (max 20), `--filter-keywords <a,b>`, `--include-content`, `--no-remove-duplicates`, `--start-date/--end-date YYYY-MM-DD`, `--timeout <s>` (default 600), `-o`, `--json`, `--pretty`, `--timing`. `mode` (`standard|deep|fast|zeroRanking`) is **REST-only**. Documented result shape: `{status, duration_seconds, results:[{link,title,description,relevance_score,content?}]}`.
**Verified on this account: `Error: Not found / Status: 404`** came back in ~300 ms on both attempts: (a) full flags with `--intent`, `--num-results 5`, `--country US`; (b) minimal flags. The skill's error table maps 403 to "Discover not enabled". A 404 on the trigger itself means the endpoint is unavailable to this key or account; budget balance also returns 403 for this scoped key. **HackForge must treat discover as optional and fall back to `search` plus `scrape`.** Pricing for Discover is not published (I searched; not found).

### 2.5 `bdata scraper …` (Scraper Studio: AI-generated custom scrapers)
- `create <url> "<description ≤500 chars>"`: `--name`, `--deliver-webhook <url>` (default stub `https://example.com/webhook`), `--timeout` (600), `--max-retries <n>` (4, on the 429 AI-Flow concurrency cap), `--no-retry`, `--legacy-output`, `-o/--json/--pretty/--timing`. **Generation takes 5–10 min.** It always prints a `collector_id`, which stays recoverable even on failure.
- `run <collector_id> [url]`: `--urls "u1,u2"` or `--input-file <txt|json>` (one batch call to `/dca/trigger`), `--sync` (single URL, `/dca/crawl`, 25–50 s cap), `--sync-timeout 25-50`, `--timeout` (600; batch 3600), `--name`, `--version dev`, `-o file.csv` (format follows the extension). It silently falls back to batch past the realtime limit of 51 pages.
- `heal <collector_id> "<what's broken ≤1000 chars>"`: `--url`, `--auto-approve`, `--auto-save`, `--timeout`, `--max-retries`, `--no-retry`, `--legacy-output`. Usually stops at `status:"awaiting_approval"` with `preview_result` and `diff_summary`.
- `approve <collector_id>`: `--reject`, `--auto-save`, `--url`, `--timeout`, `--legacy-output`.
- Billing: 1 credit per page load. **HackForge verdict: avoid in the research phase** (5–10 min build, plus approval loops). Use it only when a product's core is "data from site X with no pre-built scraper", and even then consider it a post-hackathon thing.

### 2.6 `bdata browser …` (Browser API, remote Chrome over a daemon)
Shared flags: `--session <name>` (default "default"), `--country`, `--zone` (default `cli_browser`), `--compact`, `--interactive`, `--depth <n>`, `--selector <css>`, `--wrap` (AI-safe content boundaries), `--full-page`, `--base64`, `--timeout <ms>` (30000), `--headed`, `--idle-timeout <ms>` (600000), `-o/--json/--pretty`.
Subcommands: `open <url>`, `snapshot`, `screenshot [path]`, `back`, `forward`, `reload`, `fill <ref> <value>`, `get text [selector]`, `get html [selector]`, `click <ref>`, `type <ref> <text> [--append] [--submit]`, `select <ref> <label>`, `check <ref>`, `uncheck <ref>`, `hover <ref>`, `scroll [--direction up|down|left|right] [--distance px] [--ref ref]`, `status`, `network`, `cookies`, `close [--all]`, `sessions`.
Billing: **5 credits per MB on the free tier, $8/GB PAYG.** Not live-tested. For hackathons, use it only for a page that both `scrape` and pipelines fail on. Always `browser close --all` afterwards (the daemon idles for 10 min).

### 2.7 Other commands
- `bdata zones [info <name>]` (free), `bdata config [get|set]`, `bdata init [--skip-auth] [-k key]`, `bdata version [--json]`, `bdata logout`.
- `bdata skill list | add [name]`: installs Bright Data skills fetched from `raw.githubusercontent.com/brightdata/skills/main/...` (an **unpinned `main` branch**) into an agent skills dir (`.agents/skills`, or per-agent dirs). The skills available here are search, scrape, data-feeds, bright-data-mcp, bright-data-best-practices, brightdata-cli, design-mirror, python-sdk-best-practices and scraper-builder.
- `bdata add mcp [--agent claude-code,cursor,codex] [--global|--project]`: see §9.3. **Do not run it from HackForge** (it writes your API key in plaintext, and `--project` targets the wrong file for Claude Code).

---

## 3. Pipelines catalog: what exists for idea research (from the 1,278-entry cache, 2026-10-15)

Find scrapers with `bdata pipelines search "<site or type>" --json`, which is free and fuzzy (e.g. "product hunt" matched only "product" stores). Read inputs with `bdata pipelines info <id> <method> --json | jq '.input_fields'`. `*` marks a required field.

| Research use | Scraper (dataset_id) | Methods | Key inputs | Key outputs |
|---|---|---|---|---|
| **Reddit threads + top comments** | Reddit- Posts `gd_lvz8ah06191smkebj4` | collect_by_url, discover_by_keyword, discover_by_subreddit_url, discover_by_author_url | collect: `url*`. kw: `keyword*`, `date*` ("All time"/"Past year"/"Past month"), `num_of_posts`, `sort_by` ("Hot"/"Top"/"New"). subreddit: `url*`, `sort_by` (Hot/New/Rising), `sort_by_time`, `keyword`, `num_of_posts`, `start_date` | title, description, description_markdown, num_comments, num_upvotes, date_posted, community_name, community_members_num, **comments[]** {comment, user_commenting, num_upvotes, num_replies, date_of_comment, url, replies:null}, **related_posts[]** {title,url,num_comments} |
| Reddit full comment trees | Reddit - Comments `gd_lvzdpsdlw09j6t702` | collect_by_url | `url*`, `days_back`, `load_all_replies`, `comment_limit`, `sort_by` | comment, num_upvotes, num_replies, replies, parent_comment_id, root_comment_id … (not live-tested) |
| **YouTube transcript + top 20 comments** | Youtube - Videos posts `gd_lk56epmy2i5g7lzu0k` | collect_by_url, discover_by_keyword, discover_by_search_filters, discover_by_hashtag, discover_by_url, discover_by_explore, discover_by_podcast_url | collect: `url*`, `country`, `transcription_language`. kw: `keyword*`, `num_of_posts`, `start_date`/`end_date` (MM-DD-YYYY), `country`, `include_shorts` | title, youtuber, views, likes, num_comments, date_posted, video_length, **transcript** (string), **formatted_transcript[]** {start_time,end_time,text}, transcript_language[], chapters, **comments[]** (top 20: comment, likes, num_replies, user_handle, date), hashtags, tags |
| YouTube more comments | Youtube - Comments `gd_lk9q0ew71spt1mxywf` | collect_by_url | `url*`, `num_of_comments`, `load_replies`, `sort_by` | comment_text, likes, replies, username, date, video_id |
| YouTube channels | YouTube - Channels `gd_lk538t2k2p1k3oos71` | collect_by_url, discover_by_keyword | | |
| **Google Play reviews** | `gd_m6zagkt024uwvvwuyu` | collect_by_url | `url*`, `num_of_reviews`, `country`, `start_date`, `end_date`, `language` | review, review_rating, review_date, found_helpful, app_title, app_rating, app_downloads, app_number_of_reviews, app_what_new |
| **Apple App Store reviews** | `gd_m734msue16e0adkbit` | collect_by_url | `url*` (no count limit field, so this can return many records) | review_title, review, review_rating, review_date, developer_response, app_latest_version |
| App metadata | Apple App Store `gd_lsk9ki3u2iishmwrui`, Google Play Store `gd_lsk382l8xei8vzm4u` | collect_by_url | `url*` | rating, number_of_raters, price, IAP, category, you_might_also_like (competitor list!) |
| **G2 reviews** | `gd_l88xvdka1uao86xvlb` | collect_by_url | `url*` (…/products/<slug>/reviews), `pages`, `sort_filter` ("Most Recent"), `start_date` | stars, title, text, tags, company_size, position |
| **Trustpilot reviews** | `gd_lm5zmhwd2sni130p` | collect_by_url | `url*`, `num_of_reviews_limit`, `most_recent`, `date_posted` | review_content, review_rating, company_total_reviews, 1–5_star distribution |
| Glassdoor reviews | `gd_l7j1po0921hbu0ri1z` | collect_by_url | `url*` | |
| Amazon reviews | `gd_le8e811kzy4ggddlq` | collect_by_url | `url*` (/dp/ URL), `max_reviews`, `reviews_to_not_include`, `variation_specific` | rating, review_text, helpful_count, is_verified |
| Google Maps reviews | `gd_luzfs1dn2oa0teb81` | collect_by_url | `url*`, `days_limit`, `sort_by` | review, review_rating, response_of_owner |
| Yelp reviews | `gd_lgzhlu9323u3k24jkv` | collect_by_url, discover_by_search_filters | | |
| **Crunchbase company** | `gd_l1vijqt9jfj7olije` | collect_by_url, discover_by_keyword (`keyword*`) | `url*` | ~150 fields: funding_rounds_list, num_investors, similar_companies, monthly_visits, builtwith_tech, growth_score, heat_score |
| LinkedIn company / posts / jobs | `gd_l1vikfnt1wgvvqz95w` / `gd_lyy3tktm25m4avu764` / `gd_lpfll7v5hcqtkxl6l` | collect_by_url; posts also discover_by_company_url/profile_url; jobs discover_by_keyword (`location*`, `keyword`, `time_range`…) | | jobs = hiring signal for "is this market hot" |
| Other company DBs | PitchBook `gd_m4ijiqfp2n9oe3oluj`, Owler `gd_l1vilaxi10wutoage7`, ZoomInfo `gd_m0ci4a4ivx3j5l6nx` | collect_by_url | | |
| **X/Twitter posts** | `gd_lwxkxvnf1cynvib9co` | collect_by_url, discover_by_profile_url | collect: `url*`. profile: `url*`, `num_of_posts`, `start_date`, `end_date`, `include_reposts` | likes, reposts, replies, views, quotes, hashtags. **No keyword search method**: find tweet URLs via SERP `site:x.com` |
| X profiles | `gd_lwxmeb2u1cniijd7t4` | collect_by_url, discover_by_user_name | | |
| **TikTok posts** | `gd_lu702nij2f790tmv9h` | collect_by_url, discover_by_keyword (`search_keyword*`, `num_of_posts`, `country`), discover_by_profile_url, discover_by_url | | |
| TikTok comments / fast APIs | `gd_lkf2st302ap89utw5k`; `gd_m736hjp71lejc5dc0l` (by URL), `gd_m7n5ixlw1gc4no56kx` (by search URL), `gd_m7n5v2gq296pex2f5m` (by profile) | collect_by_url | | |
| Instagram posts / reels / comments / profiles | `gd_lk5ns7kz21pck8jpis` / `gd_lyclm20il4r5helnj` / `gd_ltppn085pokosxh13` / `gd_l1vikfch901nx3by4` | collect_by_url (+ discover_by_url / user_name) | | |
| Threads, Bluesky | Threads Posts `gd_md75myxy14rihbjksa`; Bluesky Posts `gd_m6hn4r5s27zfhc7w4` (+ discover_by_profile_url) | collect_by_url | | |
| Facebook groups / Meta Ad Library | Posts by group URL `gd_lz11l67o2cb3r0lkj3`; Ad Library `gd_mtveskb62h7q65ftgz` discover_by_keyword (`keyword*`, `country*`, `ad_type*`) | | | ads = proof that someone pays to acquire these users |
| Quora | `gd_lvz1rbj81afv3m6n5y` | collect_by_url, discover_by_search_url | | |
| GitHub | Github repository `gd_lyrexgxc24b3d4imjt` | collect_by_url, discover_by_search_url, discover_by_url | | **file-level records**, see §5.4 (AVOID) |
| npm / PyPI | `gd_mk57m0301khq4jmsul` (`package_name*`) / `gd_mk57kc3t1wwgmnepp9` | collect_by_url | | version, readme_content |
| **What AI assistants recommend** | ChatGPT Search `gd_m7aof0k82r803d5bjm`, Perplexity `gd_m7dhdot1vw9a7gc1n`, Google AI Mode `gd_mcswdt6z2elth3zqr2`, Gemini `gd_mbz66arm2mf9cu856y`, Bing Copilot `gd_m7di5jy6s9geokz8w` | collect_by_url | `url*` (e.g. `https://chatgpt.com/`), `prompt*`, `country`, `web_search` | answer_text_markdown, citations, links_attached |
| Google SERP 100 results | `gd_mfz5x93lmsjjjylob` | collect_by_url | `url*`=`https://www.google.com/`, `keyword`, `start_page`, `end_page`, `tbm` | organic, people_also_ask, **aio_text / aio_citations** (Google AI Overview) |
| Wikipedia | `gd_lr9978962kkjr3nx49` | collect_by_url, discover_by_keyword | | |

**Not in the catalog (checked by name and domain):** Product Hunt, Hacker News, Devpost, Google Trends, Capterra, Stack Overflow, Medium, Substack, Kickstarter/Indiegogo, Discord, YC company directory, Hugging Face, arXiv. Use SERP plus scrape, or a free API (§5).

---

## 4. Live-test log (latency, shape, failure modes)

| # | Command (abridged) | Result | Wall time | Size | Notes |
|---|---|---|---|---|---|
| 1 | `search 'site:reddit.com "I wish there was an app" study planner' --json -o` | OK, 10 organic | 5 s (4.5 s request) | 22 KB | **geo defaulted to MX**; use `--country us` |
| 2 | `discover … --intent … --num-results 5 --country US` | **404 Not found** | 0.35 s | – | exit 2 |
| 3 | `discover … --intent … --num-results 5` | **404 Not found** | 0.3 s | – | exit 1; account/key lacks Discover |
| 4 | `scrape https://news.ycombinator.com/item?id=46345827 -o` | OK, full thread | 5 s | 13 KB md | HN is ideal for scrape |
| 5 | `scrape https://www.reddit.com/r/answers/comments/1s7rpt7/… -o` | OK but **no comments** | 5 s | 2.6 KB | lazy-loaded comments |
| 6 | `pipelines run gd_lvz8ah06191smkebj4 collect_by_url <same thread>` | OK, 1 record, 17 of 34 comments (top-level only, `replies:null`), 26 related_posts | **163 s** | 20 KB | synchronous wait |
| 7 | `pipelines run gd_lk56epmy2i5g7lzu0k collect_by_url <yt> --async` → `status` → `results` | OK, 1 record | trigger 1.1 s, collect **48 s**, results 0.45 s | **100 KB** | transcript has zero-width chars (`​`) and duplicated lines |
| 8 | `search "AI hackathon winners 2026" --type news --country us --json > f` (stdout redirect) | OK, 10 news | 13 s | 87 KB | stdout redirect works; spinner goes to stderr |
| 9 | `pipelines run gd_lyrexgxc24b3d4imjt discover_by_search_url <github search> --limit-per-input 3` | 3 records = **2 files (.gitignore, LICENSE) + 1 error** ("Crawler error: waiting for selector … timeout 30000ms") | **~390 s** | 3 KB | exit 0 despite error → silent partial failure |
| 10 | `scrape https://old.reddit.com/…` | **FAIL**: "not available for immediate residential (no KYC) access mode in accordance with robots.txt" | 4 s | – | exit 1 |
| 11 | `pipelines run gd_lvz8ah06191smkebj4 discover_by_keyword --keyword "meal planning app frustrating" --date "Past year" --sort_by Top --num_of_posts 3 --limit-per-input 3` | 3 records, **all off-topic viral posts** (r/mildlyinfuriating 110k upvotes) | 99 s | – | Reddit keyword search is loose, and "Top" favors virality |
| 12 | `pipelines run gd_m6zagkt024uwvvwuyu collect_by_url "https://play.google.com/store/apps/details?id=com.mealime" --num_of_reviews 5 --country US` | 5 relevant reviews | **6 s** | small | Surfaced a real gap: reviewers report Mealime is shutting down (2026-09) |
| – | `budget balance` | 403 (key permission) | | | `budget zones` works |
| – | `pipelines search/info` | free | 0.35–0.8 s | | |

**Free baselines also tested:** HN Algolia (`hn.algolia.com/api/v1/search…`) returns JSON in under 1 s. GitHub REST `search/repositories` returned 44 hits in under 1 s, unauthenticated.

**Failure-mode summary**

| Symptom | Cause | Handling |
|---|---|---|
| Results localized to MX/other | no `--country` | always `--country us --language en` |
| Context flooded / slow reading | base64 `icon`, `image_base64`, `source_logo`; YouTube `related_videos`, `transcript` | jq-slim before reading (§7) |
| `discover` 404 / 403 | account or key lacks Discover | fall back to search → scrape |
| Reddit page without comments | lazy loading | Reddit Posts pipeline (or Comments pipeline) |
| `old.reddit.com` KYC error | robots.txt plus no-KYC residential policy | don't use; there's no workaround without KYC |
| Pipeline exit 0 but bad data | per-record `.error` | `jq '[.[]|select(.error)]|length'` must be 0 |
| Pipeline takes minutes | Web Scraper API queue / crawl | `--async`, then `status --wait` + `results`; raise `--timeout 1200` |
| `scrape --async` returns an id you can't fetch | no fetch command in 0.4.0 | don't use `--async` on scrape |
| `budget balance` 403 | scoped key | track calls locally |
| Off-topic discover_by_keyword | loose matching + Top sort | SERP-first (`site:reddit.com "<exact phrase>"`) → collect_by_url |
| Removed commands (`pipelines list`, `bdata status`, `pipelines amazon_product …`) | 0.4.0 breaking change | `pipelines search` + `info` + `run`; `pipelines status <sd_…>` |
| 429 | rate limit (unfunded accounts: 1,000 req/min across SERP/Unlocker) | client auto-retries 3 times; keep parallelism ≤ 4 for scrape and ≤ 2 for pipelines |

---

## 5. The cookbook, by research job

Conventions: `W=".hackforge/web"` (project-local cache, gitignored); `mkdir -p "$W"`. The cache key is a slug of the query or URL: **never pay twice for the same request in one hackathon.** The commands are copy-paste ready for zsh/bash.

### 5.1 Job: find pain points on Reddit
**Best path (verified pieces): SERP → choose threads → one async pipeline run for all of them → flatten comments.**
```bash
# 1) Find high-engagement complaint threads (1 credit/query, ~5 s). Run 3-5 phrasings.
for q in '"I wish there was an app" meal planning' '"meal planning" app "so frustrating"' '"alternative to mealime"'; do
  f="$W/serp_$(echo "$q" | tr -cs 'a-zA-Z0-9' '_' | cut -c1-60).json"
  [ -s "$f" ] || bdata search "site:reddit.com $q" --country us --language en --json -o "$f"
done
# 2) Collect unique thread URLs + engagement hint from display_link
jq -rs '[.[].organic[]? | select(.link|test("reddit\\.com/r/[^/]+/comments/")) | {link, title, d:.display_link}] | unique_by(.link) | .[] | [.d, .title, .link] | @tsv' "$W"/serp_*.json
# 3) Pick top 5-10 URLs (more comments + recent), ONE run, async (each URL = 1 record = 1 credit)
SNAP=$(bdata pipelines run gd_lvz8ah06191smkebj4 collect_by_url "$U1" "$U2" "$U3" --async --json | jq -r .snapshot_id)
#    ...do other research while it runs (~1-3 min per batch)...
bdata pipelines status "$SNAP" --wait --timeout 900 && bdata pipelines results "$SNAP" -o "$W/reddit_threads.json"
# 4) Verify + flatten comments into a pain-point table (upvotes, sub, text)
jq '[.[]|select(.error)]|length' "$W/reddit_threads.json"     # must be 0
jq -r '.[] as $p | $p.comments[]? | [.num_upvotes, $p.community_name, $p.num_comments, (.comment|gsub("\\s+";" ")|.[0:220]), .url] | @tsv' \
   "$W/reddit_threads.json" | sort -t$'\t' -k1,1nr | head -60 > "$W/reddit_pain.tsv"
# 5) Snowball: related_posts gives more threads on the same topic for free
jq -r '.[].related_posts[]? | [.num_comments, .title, .url] | @tsv' "$W/reddit_threads.json" | sort -nr | head -20
```
- **Cost:** 3–5 SERP + 5–10 records ≈ 15 credits ($0.02 PAYG). **Latency:** ~5 s per SERP, 1–3 min for the pipeline batch (one record took 163 s synchronously, so batch them and go async).
- **Limits:** you get top-level comments only (≈17–25 per post, `replies:null`). For a full tree on 1–2 key threads use `gd_lvzdpsdlw09j6t702 collect_by_url <url> --load_all_replies --comment_limit 100` (not live-tested; billed per comment record, so cap `comment_limit`).
- **Subreddit sweep** (when you know the community): `bdata pipelines run gd_lvz8ah06191smkebj4 discover_by_subreddit_url --url https://www.reddit.com/r/mealprep/ --keyword "app" --sort_by New --num_of_posts 10 --limit-per-input 10 --async`.
- **Avoid** `discover_by_keyword … --sort_by Top`. In my test it returned 3 viral off-topic posts for "meal planning app frustrating".
- **Do not** `bdata scrape` reddit (no comments) and do not use `old.reddit.com` (KYC block).

### 5.2 Job: pain points and "is anyone already doing this" on Hacker News (free first)
```bash
# Free, <1 s, no Bright Data: Ask HN / Show HN threads by phrase, with points+comments
curl -s "https://hn.algolia.com/api/v1/search?query=meal%20planning&tags=(ask_hn,show_hn)&hitsPerPage=20" -o "$W/hn.json"
jq -r '.hits[] | [.points, .num_comments, .created_at[0:10], .title, "https://news.ycombinator.com/item?id=\(.objectID)"] | @tsv' "$W/hn.json"
# Comments, free: full tree as JSON
curl -s "https://hn.algolia.com/api/v1/items/46345827" | jq -r '.. | objects | select(.type=="comment" and .text!=null) | .text' | sed 's/<[^>]*>//g' | head -50
# Paid fallback (verified 4.4 s, clean md with all comments): bdata scrape "https://news.ycombinator.com/item?id=46345827" -o "$W/hn_46345827.md"
```

### 5.3 Job: scan competitors (who exists, what they charge, what users hate)
```bash
# 1) Landscape via SERP (1 credit each). related[] gives free query expansions.
bdata search "best meal planning apps 2026" --country us --json -o "$W/serp_best.json"
bdata search "mealime alternatives" --country us --json -o "$W/serp_alt.json"
jq -r '.organic[] | [.rank, .title, .link] | @tsv' "$W/serp_best.json"; jq -r '.related[].text' "$W/serp_best.json"
# 2) Read listicles + pricing pages (1 credit each, ~4.5 s). Parallelism cap 4.
printf '%s\n' "https://competitor.com/pricing" "https://listicle.com/best-apps" > "$W/urls.txt"
xargs -P 4 -I{} sh -c 'f="$1/scrape_$(echo "$2"|tr -cs "a-zA-Z0-9" "_"|cut -c1-80).md"; [ -s "$f" ] || bdata scrape "$2" -o "$f"' _ "$W" {} < "$W/urls.txt"
grep -liE "access denied|just a moment|captcha|cf-browser-verification" "$W"/scrape_*.md   # block-page check
# 3) Review mining = the single best competitor signal (Play reviews verified: 6 s for 5 records)
bdata pipelines run gd_m6zagkt024uwvvwuyu collect_by_url "https://play.google.com/store/apps/details?id=com.mealime" \
   --num_of_reviews 40 --country US -o "$W/play_mealime.json"
jq -r 'map(select(.review_rating<=3)) | sort_by(-.found_helpful) | .[] | [.review_rating, .found_helpful, .review_date[0:10], (.review|gsub("\\s+";" ")|.[0:240])] | @tsv' "$W/play_mealime.json"
jq -r '.[0] | [.app_title, .app_rating, .app_downloads, .app_number_of_reviews] | @tsv' "$W/play_mealime.json"
# App Store (no count field; can return many records, so expect to pay for them)
bdata pipelines run gd_m734msue16e0adkbit collect_by_url "https://apps.apple.com/us/app/<slug>/id<NNN>" --async
# B2B SaaS competitors: G2 (pages caps volume) / Trustpilot (num_of_reviews_limit)
bdata pipelines run gd_l88xvdka1uao86xvlb collect_by_url "https://www.g2.com/products/<slug>/reviews" --pages 1 --sort_filter "Most Recent" --async
bdata pipelines run gd_lm5zmhwd2sni130p collect_by_url "https://www.trustpilot.com/review/<domain>" --num_of_reviews_limit 30 --most_recent --async
# 4) Funding/traction (optional): Crunchbase record has similar_companies, funding_rounds_list, monthly_visits
bdata pipelines run gd_l1vijqt9jfj7olije collect_by_url "https://www.crunchbase.com/organization/<slug>" -o "$W/cb.json"
jq '.[0] | {name, founded_date, num_employees, funds_total, monthly_visits, similar: [.similar_companies[]?.name]}' "$W/cb.json"
```
Competitor-gap heuristic for HackForge's idea scorer: among a competitor's 1–3★ reviews, count those with `found_helpful ≥ 3`, and look for "shutting down / discontinued / price increase" in recent reviews. A competitor exiting the market, as the 2026-09 Mealime reviews describe, is a strong "why now".

### 5.4 Job: check if the idea already exists (GitHub, Product Hunt, Devpost, app stores)
```bash
# GitHub: use the FREE REST API (verified <1 s; 10 search req/min unauthenticated, 30/min with a token)
curl -s "https://api.github.com/search/repositories?q=meal+planner+ai+in:name,description,readme&sort=stars&per_page=10" \
 | jq -r '.total_count, (.items[] | [.stargazers_count, .pushed_at[0:10], .full_name, .description, .html_url] | @tsv)'
#   AVOID Bright Data's GitHub scraper for this: discover_by_search_url returned FILE-level records
#   (.gitignore, LICENSE), 1 of 3 errored, and it took ~6.5 min.

# Product Hunt (no pipeline): SERP-first, then scrape the product pages
bdata search 'site:producthunt.com/products "meal planning" AI' --country us --json -o "$W/serp_ph.json"
jq -r '.organic[] | [.title, .link, .description] | @tsv' "$W/serp_ph.json"
bdata scrape "https://www.producthunt.com/products/<slug>" -o "$W/ph_<slug>.md"   # upvotes, tagline, launch date (not live-tested)

# Devpost (no pipeline): find prior hackathon projects with the same idea (judges notice repeats!)
bdata search 'site:devpost.com/software "meal planner"' --country us --json -o "$W/serp_devpost.json"
jq -r '.organic[] | [.title, .link] | @tsv' "$W/serp_devpost.json"
bdata scrape "https://devpost.com/software/<slug>" -o "$W/devpost_<slug>.md"   # "Built with", prizes won

# App stores: SERP site: query, then the metadata pipeline gives "you_might_also_like" = more competitors
bdata search 'site:apps.apple.com "meal planner"' --country us --json -o "$W/serp_ios.json"
bdata pipelines run gd_lsk9ki3u2iishmwrui collect_by_url "<apps.apple.com URL>" -o "$W/ios_app.json"

# Show HN (free): has someone launched this to developers?
curl -s "https://hn.algolia.com/api/v1/search?query=meal%20planner&tags=show_hn&hitsPerPage=10" | jq -r '.hits[]|[.points,.created_at[0:10],.title]|@tsv'
```
Decision rule: if there are ≥ 3 live products **and** none of them has a ≥ 4.5★ rating plus a cheap tier, the idea is "crowded but beatable", so lean on the gap from 5.3. If a Devpost project won a prize with the same pitch in the last 12 months, pivot the angle.

### 5.5 Job: pull YouTube comments and transcripts (demand + how people describe the problem)
```bash
# 1) Find videos: SERP (cheap, precise) or the discover_by_keyword pipeline (billed per video)
bdata search 'site:youtube.com "meal prep" app review 2026' --country us --json -o "$W/serp_yt.json"
# or: bdata pipelines run gd_lk56epmy2i5g7lzu0k discover_by_keyword --keyword "meal planning app review" --num_of_posts 5 --limit-per-input 5 --async
# 2) One record per video = transcript + top 20 comments + stats (verified: 48 s collect, 100 KB/record)
SNAP=$(bdata pipelines run gd_lk56epmy2i5g7lzu0k collect_by_url "$V1" "$V2" --async --json | jq -r .snapshot_id)
bdata pipelines status "$SNAP" --wait && bdata pipelines results "$SNAP" -o "$W/yt.json"
# 3) Slim (100 KB -> a few KB) before Claude reads it
jq '[.[] | {url, title, youtuber, views, likes, num_comments, date_posted, video_length,
     comments: [.comments[]? | {likes, num_replies, comment}],
     transcript: ((.formatted_transcript // []) | map(.text) | join(" ") | gsub("[​]";"") | gsub("\\s+";" ") | .[0:4000])}]' \
   "$W/yt.json" > "$W/yt_slim.json"
# 4) More comments on one key video (not live-tested): bdata pipelines run gd_lk9q0ew71spt1mxywf collect_by_url "$V1" --num_of_comments 100 --async
```
Note: the `transcript` string repeats each caption line twice and carries `​`. Prefer `formatted_transcript[].text`, which still needs the `​` strip.

### 5.6 Job: deep-read the top N pages for a topic (market facts, stats, docs)
```bash
# Path A (works on this account): search -> filter -> parallel scrape -> gate
bdata search "meal kit market size 2026 report" --country us --json -o "$W/serp_mkt.json"
jq -r '.organic[] | .link' "$W/serp_mkt.json" | grep -vE "youtube.com|reddit.com|facebook.com" | head -6 > "$W/urls_mkt.txt"
xargs -P 4 -I{} sh -c 'f="$1/scrape_$(echo "$2"|tr -cs "a-zA-Z0-9" "_"|cut -c1-80).md"; [ -s "$f" ] || bdata scrape "$2" -o "$f"' _ "$W" {} < "$W/urls_mkt.txt"
for f in "$W"/scrape_*.md; do s=$(wc -c <"$f"); grep -qiE "access denied|just a moment|captcha" "$f" && echo "BLOCKED $f" || [ "$s" -gt 1500 ] || echo "THIN $f"; done
# Path B (only if discover works on the account): one call returns ranked results + content
bdata discover "meal kit market size" --intent "recent market-size estimates with numbers and named sources" \
  --num-results 10 --include-content --start-date 2025-06-01 -o "$W/disc_mkt.json"
jq -r '.results[] | [.relevance_score, .title, .link, (.content|length)] | @tsv' "$W/disc_mkt.json"
```
Cost: 1 credit per SERP plus 1 per page (Path A, N=6 → 7 credits, about 10 s wall with `-P 4`). In a HackForge Workflow, run the scrapes inside a research **subagent** that returns only extracted claims and citations. Keep page bodies out of the orchestrator context.

### 5.7 Job: monitor a trend / "why now"
```bash
# News velocity (1 credit, ~13 s). Strip base64 before reading.
bdata search "AI meal planning" --type news --country us --language en --json -o "$W/news.json"
jq -r '.news[] | [.date, .source, .title, .link] | @tsv' "$W/news.json"
bdata search "AI meal planning" --type news --page 1 --country us --json -o "$W/news_p1.json"   # older items
# Free trend proxy: HN mentions per year (verified: "vibe coding" 0 in 2023-24 -> 812 in Jan-Sep 2025 -> 747 in Jan-Sep 2026)
for y in 2023 2024 2025 2026; do s=$(date -j -f %Y-%m-%d "$y-01-01" +%s); e=$(date -j -f %Y-%m-%d "$y-12-31" +%s)
  echo "$y $(curl -s "https://hn.algolia.com/api/v1/search?query=%22meal%20planning%22&tags=story&hitsPerPage=0&numericFilters=created_at_i%3E$s,created_at_i%3C$e" | jq .nbHits)"; done
# (GNU date on Linux: date -d "$y-01-01" +%s)
# Hiring signal (is money flowing in?): LinkedIn jobs discover_by_keyword (billed per job; keep it small)
bdata pipelines run gd_lpfll7v5hcqtkxl6l discover_by_keyword --location "United States" --keyword "AI nutrition" --time_range "Past month" --limit-per-input 10 --async
# Fresh community chatter: newest posts in a subreddit
bdata pipelines run gd_lvz8ah06191smkebj4 discover_by_subreddit_url --url https://www.reddit.com/r/MealPrepSunday/ --sort_by New --num_of_posts 10 --limit-per-input 10 --async
```
**Google Trends has no pipeline.** `trends.google.com` is JS-rendered, so `scrape` is unreliable and `browser` is per-MB. For a hackathon, use news velocity, the HN time series and Reddit "New" as the trend evidence, and say so in the pitch ("mentions up N× YoY on HN").

### 5.8 Job: social proof on X / TikTok / LinkedIn / Instagram
```bash
# X has no keyword method: find tweet URLs via SERP, then collect
bdata search 'site:x.com "meal planning" app "wish"' --country us --json -o "$W/serp_x.json"
bdata pipelines run gd_lwxkxvnf1cynvib9co collect_by_url $(jq -r '.organic[].link|select(test("/status/"))' "$W/serp_x.json" | head -5) --async
# A founder/competitor account's recent posts
bdata pipelines run gd_lwxkxvnf1cynvib9co discover_by_profile_url --url https://x.com/<handle> --num_of_posts 10 --limit-per-input 10 --async
# TikTok by keyword (billed per post)
bdata pipelines run gd_lu702nij2f790tmv9h discover_by_keyword --search_keyword "#mealprep app" --num_of_posts 5 --limit-per-input 5 --async
jq -r '.[] | [.url, .play_count?, .digg_count?, .description?] | @tsv' "$W/tiktok.json"   # check field names with: jq '.[0]|keys'
```
(These were not live-tested. Field names come from `pipelines info`, and you should always confirm with `jq '.[0]|keys'`.)

### 5.9 Job: ask the AI assistants what they recommend (what judges and users will see)
```bash
bdata pipelines run gd_m7dhdot1vw9a7gc1n collect_by_url --url "https://www.perplexity.ai" --prompt "best app to plan weekly meals on a budget" --async
bdata pipelines run gd_mcswdt6z2elth3zqr2 collect_by_url --url "https://google.com/aimode" --prompt "best app to plan weekly meals on a budget" --hl en --async
jq -r '.[0].answer_text_markdown' "$W/pplx.json"; jq -r '.[0].citations[]?.url? // empty' "$W/pplx.json"
```
Use this to find the incumbents an LLM names first. If the idea's niche gets no strong recommendation, that's a gap. (Not live-tested; each prompt is 1 record.)

---

## 6. Async and parallel pattern (fits a HackForge Workflow script)

Pipelines dominate wall time (6 s to 6.5 min), while SERP and scrape take about 5 s. So **fire every pipeline first with `--async`, do SERP and scrape work while they run, then harvest:**
```bash
: > "$W/snapshots.tsv"
# --async prints {"snapshot_id":"sd_…"} on STDOUT; the "Check: …" hint goes to stderr (dist/commands/dataset.js L156-158)
start() { id=$(bdata pipelines run "$@" --async --json 2>/dev/null | jq -r .snapshot_id); printf '%s\t%s\n' "$id" "$*" >> "$W/snapshots.tsv"; }
start gd_lvz8ah06191smkebj4 collect_by_url "$U1" "$U2" "$U3"
start gd_m6zagkt024uwvvwuyu collect_by_url "$PLAY_URL" --num_of_reviews 40 --country US
start gd_lk56epmy2i5g7lzu0k collect_by_url "$V1" "$V2"
# ... SERP + scrape work here ...
while IFS=$'\t' read -r id cmd; do
  bdata pipelines status "$id" --wait --timeout 900 >/dev/null && bdata pipelines results "$id" -o "$W/snap_$id.json"
  jq -e 'type=="array" and (map(select(.error))|length==0)' "$W/snap_$id.json" >/dev/null || echo "CHECK $id ($cmd)"
done < "$W/snapshots.tsv"
```
- Keep **≤ 2 concurrent pipeline triggers per dataset**, **≤ 4 concurrent scrapes** and **≤ 5 concurrent SERP calls**. The client retries 429s, but don't lean on that.
- Snapshot ids survive the session. If a Workflow step times out, `bdata pipelines results sd_…` still works later, at no extra cost because records are already billed. `results` on an unfinished snapshot throws "Snapshot … is not ready yet", so always run `status --wait` first.
- Set `BRIGHTDATA_POLLING_TIMEOUT=1200` for review and comment scrapers.

---

## 7. jq library (all verified against real outputs in `scratchpad/bd/`)

```bash
# SERP: slim + drop base64
jq '{q:.general.query, gl:.general.gl, results:[.organic[]|{rank,title,link,description,display_link}], related:[.related[]?.text]}' serp.json
# SERP: only reddit thread URLs
jq -r '.organic[].link | select(test("reddit\\.com/r/[^/]+/comments/"))' serp.json
# SERP: merge many files + dedup by link
jq -s '[.[].organic[]?] | unique_by(.link) | map({title,link,description})' serp_*.json
# News: (results live in .news)
jq -r '.news[] | [.date, .source, .title, .link] | @tsv' news.json
# Pipeline verification gate (run on EVERY result file)
jq -e 'type=="array" and length>0' out.json && jq '[.[]|select(.error)]|length' out.json   # want 0
jq '.[0]|keys' out.json   # confirm field names before writing extraction jq
# Reddit: comments ranked by upvotes
jq -r '.[] as $p | $p.comments[]? | [.num_upvotes, $p.community_name, (.comment|gsub("\\s+";" ")|.[0:200])] | @tsv' reddit.json | sort -t$'\t' -k1,1nr
# Reddit: post summary
jq -r '.[] | [.num_upvotes, .num_comments, .date_posted[0:10], .community_name, .title, .url] | @tsv' reddit.json
# YouTube: clean transcript text
jq -r '.[0].formatted_transcript | map(.text) | join(" ") | gsub("[​]";"") | gsub("\\s+";" ")' yt.json
# YouTube: top comments
jq -r '.[] | .comments[]? | [.likes, .num_replies, (.comment|.[0:200])] | @tsv' yt.json | sort -nr
# Play reviews: negative + helpful first
jq -r 'map(select(.review_rating<=3)) | sort_by(-.found_helpful) | .[] | [.review_rating, .found_helpful, .review_date[0:10], .review] | @tsv' play.json
# Discover (when available): rank + gate thin/blocked content
jq '[.results[] | select(.content!=null and (.content|length)>200 and ((.content|test("just a moment|captcha|access denied";"i"))|not))] | sort_by(-.relevance_score)' disc.json
```

---

## 8. What HackForge should ship (concrete)

1. **`scripts/hf-web` wrapper (bash, ~60 lines)**, the only way agents call Bright Data:
   - It forces `--country us --language en` on `search`, `-o` into `.hackforge/web/<kind>_<slug>.json|md`, and returns the cached file if one exists.
   - It appends every paid call to `.hackforge/web/ledger.tsv` (timestamp, kind, query/url, est. credits). It refuses once `HF_WEB_BUDGET` is reached (default 150 credits per hackathon, about $0.23 PAYG, well inside the 5,000/month free tier). This is needed because `budget balance` is 403 for scoped keys.
   - It runs the verification gate automatically: block-page grep for scrape; `.error` count and empty-array check for pipelines; non-empty `.organic`/`.news` for search.
   - It prints a **slim** JSON summary to stdout and keeps the raw file on disk.
2. **`skills/web-research/SKILL.md`**: the decision rule from §0, the job recipes from §5 (as short templates), and the dataset-id table from §3 (ids only for the ~12 scrapers HackForge uses). Instruct the agent to run `bdata pipelines info <id> <method>` once to confirm fields. Do **not** copy Bright Data's `bright-data-mcp` skill wording ("replaces WebFetch and WebSearch. No exceptions"). That burns credits on things free tools and APIs do fine.
3. **Research subagent pattern**: `researcher-pain` (Reddit + HN + reviews), `researcher-market` (SERP + scrape + Crunchbase), `researcher-exists` (GitHub API + PH/Devpost SERP). Each one writes `docs/research/<topic>.md` with citations and returns ≤ 15 bullets, so raw JSON never enters the orchestrator.
4. **Workflow script ordering**: (a) kick off all pipelines `--async`, (b) do SERP and scrape fan-out, (c) harvest snapshots, (d) synthesize and score. Expected wall time for the whole idea-validation pass is about 5–8 min, dominated by Reddit and YouTube pipelines.
5. **Free-first sources in the skill**: HN Algolia API, GitHub REST search, and `bdata pipelines search` (free) for discovery. Bright Data gets used where it is uniquely good: Google SERP with parsed JSON, unblocked page reads, and Reddit/YouTube/app-store/G2/Trustpilot structured records.
6. **Gitignore** `.hackforge/web/` (raw scraped data) and never commit the Bright Data key. The key lives in `~/Library/Application Support/brightdata-cli/credentials.json` (mode 600) or `BRIGHTDATA_API_KEY`.

**What to avoid:** Scraper Studio (`scraper create`, 5–10 min plus approval gates), `browser` (per-MB, slow), `scrape --async` (no fetch command), Bright Data's GitHub scraper, Reddit `discover_by_keyword` with Top sort, `old.reddit.com`, and `bdata add mcp --project` (wrong file for Claude Code, plaintext key).

---

## 9. Bright Data MCP

### 9.1 What it is (v3.1.0, 2026-10-15)
- **32 tools** in the hosted server (`https://mcp.brightdata.com/mcp?token=…`) or the local one (`npx @brightdata/mcp`, env `API_TOKEN`). Source: MCP README.
- It runs on the same account and **the same 5,000 free credits per month**, at $1.50 per 1K results for search, scrape and extract, and $8/GB for browser navigation (README "Pricing and Free Tier"). MCP calls default to zones `mcp_unlocker` and `mcp_browser` (env `WEB_UNLOCKER_ZONE`, `BROWSER_ZONE`).
- Tools:
  - **Search and scraping (default, in every group):** `search_engine` (Google → JSON; Bing/Yandex → markdown; `cursor` pagination), `scrape_as_markdown`, `discover`.
  - **`advanced_scraping` group:** `search_engine_batch` (≤ 10 queries), `scrape_batch` (≤ 10 URLs), `scrape_as_html`, `extract` (AI → JSON with an optional prompt), `session_stats`.
  - **`scrapers` group (6):** `search_scrapers`, `get_scraper_details`, `run_scraper` (waits ≤ 45 s, then returns `snapshot_id`), `get_scraper_progress`, `get_scraper_results`, `refresh_scrapers`.
  - **`browser` group (14):** `scraping_browser_navigate`, `_go_back`, `_go_forward`, `_snapshot`, `_click_ref`, `_type_ref`, `_fill_form`, `_screenshot`, `_get_text`, `_get_html`, `_scroll`, `_scroll_to_ref`, `_wait_for_ref`, `_network_requests`.
  - **`geo` group:** `chatgpt_ai_insights`, `perplexity_ai_insights`.
  - **Dataset search:** `list_dataset_fields`, `search_dataset` (stored LinkedIn datasets; legacy groups `social`/`business`).
- Env/URL knobs: `groups=` / `GROUPS`, `tools=` / `TOOLS`, `RATE_LIMIT` (e.g. `100/1h`), `POLLING_TIMEOUT` (discover, default 600), `BASE_TIMEOUT`, `BASE_MAX_RETRIES` (0–3), `CONTENT_GATE` (default `on`: it uses MCP elicitation to ask the user before returning page text that looks like instructions to change MCP config, a built-in prompt-injection guard), `CONTENT_GATE_TIMEOUT` (120 s).

### 9.2 Rapid vs Pro (stale)
Older docs and third-party guides (2025 to early 2026) describe **Rapid** as the free default (search_engine, scrape_as_markdown, discover and the batch variants) and **Pro** as `&pro=1` (hosted) or `PRO_MODE=true` (local), which unlocks 60+ tools. They also note that `groups`/`tools` override `pro=1` (docs.brightdata.com/ai/mcp-server/remote/advanced). **The v3.x README no longer mentions pro mode at all**: all 32 tools are enabled when neither `GROUPS` nor `TOOLS` is set. Old group ids (`ecommerce`, `social`, `business`, `research`, `app_stores`, `code`, …) still work and map to `scrapers`. Old `web_data_*` tool names map to the scraper tools.

### 9.3 Adding it to Claude Code (document only; nothing was run)
**Recommended for HackForge: hosted, project-scoped `.mcp.json` with env expansion, minimal tools.** This keeps the token out of the repo and keeps tool-schema context small:
```json
{
  "mcpServers": {
    "brightdata": {
      "type": "http",
      "url": "https://mcp.brightdata.com/mcp?token=${BRIGHTDATA_API_TOKEN}&tools=search_engine,search_engine_batch,scrape_as_markdown,scrape_batch,search_scrapers,get_scraper_details,run_scraper,get_scraper_progress,get_scraper_results"
    }
  }
}
```
(Claude Code expands `${VAR}` in `.mcp.json` `url`/`headers`/`env`. Users export `BRIGHTDATA_API_TOKEN` in their shell. Verify with `claude mcp list`.)

Other options:
- CLI one-liner (official README): `claude mcp add --transport http brightdata "https://mcp.brightdata.com/mcp?token=$BRIGHTDATA_API_TOKEN"`. Add `--scope project` to write `.mcp.json`, but that embeds the literal token. Prefer the env-expansion file above.
- Local stdio: `claude mcp add brightdata -e API_TOKEN="$BRIGHTDATA_API_TOKEN" -e GROUPS=scrapers -- npx -y @brightdata/mcp`.
- **`bdata add mcp`** (read from `dist/utils/mcp-config.js`): it writes a **local stdio** entry `"bright-data": {"command":"npx","args":["@brightdata/mcp"],"env":{"API_TOKEN":"<your key in plaintext>"}}`. With `--global` it goes to **`~/.claude.json`** (user scope, which Claude Code reads). With `--project` it goes to **`./.claude/settings.json`**, which is *not* where Claude Code reads project MCP servers (that is `.mcp.json`), so it probably won't load. Non-interactive use needs `--agent claude-code --global|--project`. Codex is global only (`$CODEX_HOME/mcp.json`). Cursor writes `.cursor/mcp.json`. Files are written with mode 0600. **HackForge should not call it.** Ship `.mcp.json` with `${BRIGHTDATA_API_TOKEN}` instead.
- The plugin's own `references/mcp-setup.md` says to put `mcpServers` in `~/.claude/settings.json`. That is also wrong for Claude Code (use `claude mcp add` or `.mcp.json`).

### 9.4 CLI vs MCP: when to use which in HackForge
| Use the **CLI (via `hf-web`)** when | Use the **MCP** when |
|---|---|
| A Workflow script or subagent with Bash runs fan-out work (parallel, async, cached, ledgered) | A no-shell context (claude.ai, Desktop) or the user wants it conversationally |
| Output is big (pipelines, YouTube): it stays on disk and only slim JSON reaches the model | One-off reads where `scrape_as_markdown` text is the deliverable |
| You need async snapshots that outlive the session | You want the built-in `CONTENT_GATE` prompt-injection guard on scraped text |
| You need exact `--country` control and per-call caching | `scrape_batch`/`search_engine_batch` (10 per call) is enough |

Both draw from the same credits. **Don't enable all 32 MCP tools.** The browser group alone adds 14 tool schemas to every turn's context. Use `&tools=` or `&groups=scrapers`.

---

## 10. Cost cheat-sheet

| Product | Unit | Free tier | PAYG | Typical HackForge idea-validation pass |
|---|---|---|---|---|
| SERP (`search`, MCP `search_engine`) | 1 credit / request | 5,000 credits/mo shared, reset on the 1st, no rollover, hard stop without funds | ~$1.50 / 1K | 15–25 calls |
| Web Unlocker (`scrape`, MCP `scrape_as_markdown`) | 1 credit / request | shared | ~$1.50 / 1K | 10–20 pages |
| Web Scraper API (`pipelines`, MCP `run_scraper`) | 1 credit / **record** | shared | ~$1.50 / 1K records (verify) | 50–150 records (reviews and comments are the bulk) |
| Scraper Studio | 1 credit / page load | shared | – | 0 (avoid) |
| Browser API | 5 credits / MB | shared | $8 / GB | 0 (avoid) |
| Discover | not published | ? | ? | 0 (404 here) |

The whole pass comes to roughly 100–200 credits, about $0.15–0.30 PAYG or about 3% of a month's free tier. Unfunded accounts are also limited to 1,000 requests per minute across SERP, Unlocker and proxy. Measured in this session: 5 Unlocker/SERP requests moved the zone cost by $0.01, plus 13 pipeline records.

---

## Sources
- CLI help output (`bdata <cmd> --help`, all commands and subcommands), CLI 0.4.0. Installed source read-only: `/opt/homebrew/lib/node_modules/@brightdata/cli/dist/commands/{search,scrape,discover,add-mcp}.js`, `dist/utils/{mcp-config,client,scraper_input}.js`.
- Scraper catalog cache: `~/Library/Application Support/brightdata-cli/scrapers.json` (1,278 scrapers, loaded 2026-10-15 20:00 PDT); `bdata pipelines info` JSON in `scratchpad/bd/info/`.
- Bright Data plugin skills (read via the Skill tool and files): brightdata-cli (+ `references/commands.md`, `references/pipelines.md`), data-feeds (+ `references/patterns.md`), search, discover-api (+ `references/api-reference.md`), scrape, live-research, bright-data-mcp (+ `references/mcp-setup.md`, `references/mcp-tools.md`), scraper-studio.
- MCP README: https://raw.githubusercontent.com/brightdata/brightdata-mcp/HEAD/README.md (v3.1.0; pricing, groups, env vars, content gate).
- Free tier: https://docs.brightdata.com/general/account/billing-and-pricing/free-tier
- MCP overview: https://docs.brightdata.com/products/mcp-server/overview.md; legacy Pro mode: https://docs.brightdata.com/ai/mcp-server/remote/advanced, https://www.bitdoze.com/brightdata-mcp-guide/
- npm: https://registry.npmjs.org/@brightdata/mcp (3.1.0, 2026-10-15), https://registry.npmjs.org/@brightdata/cli (0.4.0, 2026-10-12)
- Free APIs: https://hn.algolia.com/api (tested), https://docs.github.com/en/rest/search (tested)
- ECC comparison: ECC's `.agents/skills/deep-research/SKILL.md` and `exa-search/SKILL.md` use firecrawl and Exa MCPs. ECC has **no Bright Data integration**, so HackForge's Reddit, YouTube and app-store structured-data jobs are a differentiator.
