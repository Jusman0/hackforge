# HackForge packaging reference: Claude Code formats (CLI v2.1.x, docs as of 2026-10-15)

Sources are the code.claude.com docs pages listed in the `sources` field, fetched with WebFetch. Quotes are close to the fetched text, but check exact strings against the live pages before shipping. Several pages were long and only partly read; gaps are listed in section 11. "UNDOCUMENTED" means the pages I read did not say.

## 0. Target layout

Plugin (install from a marketplace, or load with --plugin-dir):

```text
hackforge/
├── .claude-plugin/
│   ├── plugin.json            manifest; only "name" is required
├── skills/<name>/SKILL.md     primary unit, plus supporting files
├── agents/<name>.md           subagents
├── commands/<name>.md         legacy single-file commands (still supported; prefer skills/)
├── hooks/hooks.json           same shape as settings.json "hooks"
├── workflows/<name>.js        dynamic workflow scripts
├── .mcp.json                  plugin MCP servers
├── settings.json              only the "agent" and "subagentStatusLine" keys take effect
└── bin/                       optional executables added to the Bash PATH while enabled
```

Marketplace repo (lists one or more plugins):

```text
hackforge-marketplace/
├── .claude-plugin/marketplace.json
└── plugins/hackforge/...      plugin entry source: "./plugins/hackforge"
```

A CLAUDE.md at the plugin root is NOT loaded (claude plugin validate warns). Put instructions in a skill.

## 1. Plugin manifest: .claude-plugin/plugin.json

The manifest is optional. Without it, the standard layout is discovered and the name comes from the marketplace entry or the directory name. Write one for metadata, userConfig, or custom paths.

Fields (only `name` is required):

- name: kebab-case, no spaces, @, :, or path separators. Components are namespaced under it, so skill review in plugin hackforge is /hackforge:review. Names starting claude-, anthropic-, anthropics-, or cc-plugin- fail validation; so do the exact names claude, anthropic, claude-code, claude-mods. hackforge is fine.
- version: free string, not semver-checked. Setting it pins users to that version until it changes.
- description, author {name (required), email, url}, homepage (must parse as a URL), repository, license (SPDX), keywords, displayName, defaultEnabled (default true), dependencies, metadata (free-form, v2.1.222+).
- skills: path or array. ADDS to the default skills/ scan. Each entry is a dir of <name>/SKILL.md folders or a folder holding SKILL.md. "." means the plugin root.
- commands: path, array, or object map {name: {source | content, description, argumentHint, model, allowedTools}}. REPLACES the default commands/ scan.
- agents: path or array of .md files (not directories). REPLACES the default agents/ scan.
- hooks: path to a .json file (which must wrap events in a top-level "hooks" key), an inline object, or an array. MERGES with hooks/hooks.json.
- mcpServers: path to .json, a .mcpb/.dxt bundle, an inline map keyed by server name, or an array. MERGES with .mcp.json; a later name replaces an earlier one.
- workflows: path or array of .js files or dirs. REPLACES the default workflows/ scan.
- outputStyles: REPLACES output-styles/.
- lspServers, settings (only agent and subagentStatusLine apply), userConfig, channels, experimental.evals (default evals/), experimental.monitors.

Path rules: every component path starts with ./ (skills also accepts "." or "./"). The path must exist and resolve inside the plugin root. Unknown top-level keys are stripped with a warning. Unknown keys inside a userConfig option are an error.

Example manifest:

```json
{
  "name": "hackforge",
  "version": "0.1.0",
  "description": "HackForge: skills, subagents, hooks, MCP and workflows",
  "author": { "name": "Your Name" },
  "license": "MIT",
  "userConfig": {
    "api_token": {
      "type": "string",
      "title": "API token",
      "description": "Token for the upstream API",
      "sensitive": true
    }
  }
}
```

### 1a. userConfig

- Types: string, number, boolean, directory, file. Each option needs type, title and description. Optional: required, default, options (string picker, v2.1.271+), multiple, sensitive, min and max.
- Non-sensitive values are stored under pluginConfigs in user settings.json. sensitive values go to the OS secure store.
- References: ${user_config.KEY} works in MCP config, LSP config, exec-form hook args, and skill or agent body (in body only non-sensitive values are substituted; sensitive ones become placeholders). Hook processes also get CLAUDE_PLUGIN_OPTION_<KEY> (key uppercased).
- NOT allowed in shell-form hook commands, monitor commands, or MCP headersHelper. Use exec-form args or the env var there.

### 1b. Path variables

- ${CLAUDE_PLUGIN_ROOT}: installed plugin directory. It changes on update, so do not write state there.
- ${CLAUDE_PLUGIN_DATA}: ~/.claude/plugins/data/<id>/. Survives updates. Deleted on uninstall from the last scope unless --keep-data.
- ${CLAUDE_PROJECT_DIR}: project root.
- Shell-form hook commands: wrap the variable in double quotes. Exec form (args present) avoids quoting.

## 2. CLI: local install, dev loop, validation

```bash
# Session-only dev loop (directory or .zip; repeatable). Inside the session, run /reload-plugins after edits.
claude --plugin-dir ./hackforge

# Scaffold. Writes to ~/.claude/skills/hackforge and loads as hackforge@skills-dir (no marketplace).
claude plugin init hackforge --with skills hooks mcp

# Validate (exit 0 pass, 1 fail or warning under --strict, 2 unexpected error).
claude plugin validate ./hackforge --strict
claude plugin validate ./hackforge-marketplace

# Distribute from a local marketplace directory (default scope user; also project or local).
claude plugin marketplace add ./hackforge-marketplace --scope project
claude plugin install hackforge@hackforge-marketplace --scope project

claude plugin list
claude plugin details hackforge            # component inventory and token cost
claude plugin update hackforge@hackforge-marketplace
claude plugin disable hackforge
claude plugin enable hackforge
claude plugin uninstall hackforge@hackforge-marketplace --scope project
claude plugin marketplace update hackforge-marketplace
claude plugin tag ./hackforge --dry-run    # tag <name>--v<version>; manifest and marketplace versions must agree
```

In session: /plugin opens the panel (tabs Discover, Installed, Marketplaces, Stats). /plugin install hackforge@hackforge-marketplace opens its details. /reload-plugins applies pending changes. Plugin arguments take name or name@marketplace.

Marketplace file, at <marketplace root>/.claude-plugin/marketplace.json:

```json
{
  "name": "hackforge-marketplace",
  "description": "HackForge plugins",
  "owner": { "name": "Your Name" },
  "plugins": [
    {
      "name": "hackforge",
      "source": "./plugins/hackforge",
      "description": "Skills, agents, hooks and MCP for HackForge",
      "strict": true
    }
  ]
}
```

- Required: name, owner.name, plugins[] (each entry needs name and source).
- Entry source: a relative string (must start with ./), or an object {source: github, repo, ref, sha} | {source: url, url} | {source: git-subdir, url, path} | {source: npm, package, version, registry} | {source: archive, url, sha256} | {source: command, command, mode}.
- strict (default true): when plugin.json exists, entry component fields (commands, agents, skills, hooks, outputStyles, themes) are appended to it. With strict false, declaring them is a conflict and the plugin fails to load.
- Entry fields also accepted: description, version, category, tags, dependencies, defaultEnabled, displayName, metadata, and the plugin.json fields.
- Reserved marketplace names include claude-plugins-official, claude-code-marketplace, anthropic-marketplace, and the bare names npm, pip, uv, cargo, github, gh. Pick a name like hackforge-marketplace.

## 3. Skills

Layout:

```text
hackforge-review/
├── SKILL.md            required; frontmatter + instructions (keep under 500 lines)
├── reference.md        loaded on demand
├── examples.md
└── scripts/helper.py   executed, not loaded
```

Locations and precedence:

| Scope | Path | Notes |
| :- | :- | :- |
| Enterprise (managed) | managed settings dir, .claude/skills/<n>/SKILL.md | wins over personal and project |
| Personal | ~/.claude/skills/<n>/SKILL.md | all projects |
| Project | .claude/skills/<n>/SKILL.md | this repo |
| Nested | <subdir>/.claude/skills/<n>/SKILL.md | sessions in or below subdir; /apps/web:deploy form |
| --add-dir | .claude/skills/ inside the added dir | that session |
| Plugin | <plugin>/skills/<n>/SKILL.md | invoked /<plugin>:<n>; namespaced, cannot collide |
| claude.ai sync | ~/.claude/skills/synced/ | Cowork and cloud |

Collisions: enterprise > personal > project. A user skill replaces a bundled skill or command with the same name, but not its aliases. A skill beats a .claude/commands file of the same name. Root and nested skills with the same name both load.

Frontmatter (field names are exact; unknown fields are ignored; booleans accept true/false, yes/no, on/off, 1/0; the --- block must start on line 1):

| Field | Meaning |
| :- | :- |
| name | Command name. Defaults to the directory name. Becomes /name. |
| description | What it does and when to use it. Put the key use case first. |
| when_to_use | Extra trigger text, appended to description. Combined text is truncated at 1,536 chars in the listing. |
| argument-hint | Autocomplete hint, such as [issue-number]. |
| arguments | Names for $name placeholders (space-separated string or YAML list). |
| disable-model-invocation | true means only the user can invoke it (Claude never auto-loads it). Default false. |
| user-invocable | false hides it from the / menu so only Claude invokes it. Default true. |
| allowed-tools | Tools pre-approved during the invoking turn, such as Bash(gh *). Cleared on the next user message. |
| disallowed-tools | Tools removed from the pool while the skill is active. |
| model | Model for the turn. Accepts inherit. |
| effort | low, medium, high, xhigh, or max. |
| context | fork runs the skill in a subagent. |
| agent | Subagent type for context: fork: Explore, Plan, general-purpose (default), or a custom agent name. |
| background | With context: fork. Default true. false waits for the result. |
| hooks | Hooks registered while the skill is invoked. Field once: true is honored only here. |
| paths | Glob patterns that limit automatic activation. |
| shell | bash (default) or powershell for !`cmd` blocks. |
| metadata, license, compatibility | Accepted and ignored by Claude Code. Outside Claude Code (claude.ai uploads, Skills API) only name, description, license, compatibility, metadata and allowed-tools are allowed. Other fields are a hard error there. |

Substitutions and dynamic injection:

- $ARGUMENTS: all arguments as typed. $ARGUMENTS[N] or $N: 0-based. $name: maps to the arguments list by position.
- ${CLAUDE_SKILL_DIR}, ${CLAUDE_SESSION_ID}, ${CLAUDE_EFFORT}, ${CLAUDE_PROJECT_DIR}; ${CLAUDE_PLUGIN_ROOT} and ${CLAUDE_PLUGIN_DATA} in plugin skills.
- Quote multi-word args. If no placeholder receives the arguments, Claude Code appends ARGUMENTS: <value>. Escape a literal dollar with a backslash.
- !`cmd` runs before Claude sees the skill and its output replaces the placeholder. Use a fenced ```! block for multi-line commands. A failing command aborts the invocation. The disableSkillShellExecution setting turns this off.
- Invoke with /name. Stack skills: /write-tests /fix-issue 123.
- Permission rules: Skill(name) or Skill(name *) allow or deny Claude's access to a skill.

Example:

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---
PR diff: !`gh pr diff`
Summarize this pull request...
```

Size: the combined description is truncated at 1,536 chars in the listing and is paid every turn. Keep the body short; it stays in context. After auto-compaction each invoked skill keeps its first 5,000 tokens, and re-attached skills share a 25,000-token budget.

Legacy commands: .claude/commands/deploy.md and .claude/skills/deploy/SKILL.md both create /deploy, and existing command files keep working. Command files support the same frontmatter except name and paths. Subdirectories become colon names (commands/frontend/component.md becomes /frontend:component). Skills are the recommended form.

## 4. Subagents

Locations and priority (highest first): managed settings (1), --agents CLI JSON for the session (2), .claude/agents/ (3), ~/.claude/agents/ (4), plugin agents/ (5). Project and user dirs are scanned recursively, and identity comes only from the name field. Plugin subfolders become part of the id: agents/review/security.md in plugin my-plugin is my-plugin:review:security. Edits take effect within seconds, but a restart is needed when the first agent file is created in a new agents dir.

Frontmatter (name and description required; field names are case-sensitive camelCase; unknown fields are ignored):

| Field | Type / values | Meaning |
| :- | :- | :- |
| name | string, max 256, no colon, not starting with - | Unique id. Hooks receive it as agent_type. |
| description | string | When to delegate. Phrases like "use proactively" encourage auto-delegation. |
| tools | comma string or YAML list | Allowlist. Omitted = inherit all subagent-available tools. |
| disallowedTools | same format | Denylist, applied first. |
| model | sonnet, opus, haiku, fable, full model ID, or inherit | Model. |
| permissionMode | default, acceptEdits, auto, dontAsk, bypassPermissions, plan | Ignored for plugin subagents. Overridden when the parent is in bypass, acceptEdits or auto. |
| maxTurns | integer | Turn cap. Output is marked partial if reached. |
| autoCompactWindow | 100000 to 1000000 (v2.1.296+) | Auto-compact window. |
| skills | list of skill names (up to 32) | Preloads full skill content. Skills with disable-model-invocation can't be preloaded. |
| mcpServers | names or inline defs | Ignored for plugin subagents. |
| hooks | hook config | Scoped to this subagent. Ignored for plugin subagents. Stop becomes SubagentStop. |
| memory | user, project, or local | Persistent MEMORY.md (first 200 lines or 25KB load). Enables Read, Write, Edit. |
| background | bool | Keep in background. |
| omitClaudeMd | bool (v2.1.271+) | Skip CLAUDE.md files. |
| effort | low..max | Overridden by CLAUDE_CODE_EFFORT_LEVEL. |
| isolation | worktree | Run in a temporary git worktree. |
| color | red, blue, green, yellow, purple, orange, pink, cyan | Display color. |
| initialPrompt | string | Auto-submitted first turn when run as the main agent. Ignored for plugin subagents. |
| experimental | {cacheTtl: 5m or 1h} (v2.1.248+) | Must be nested under experimental. |

Memory dirs: user is ~/.claude/agent-memory/<agent>/, project is .claude/agent-memory/<agent>/, local is .claude/agent-memory-local/<agent>/.

Tool restrictions:

- Always removed from subagents, even if listed: Agent (at the depth limit), AskUserQuestion, EndConversation, EnterPlanMode, ExitPlanMode (unless plan), ScheduleWakeup, WaitForMcpServers, Workflow.
- Background subagents keep all MCP tools but only a fixed built-in set: Read, Grep, Glob, LSP, Bash, PowerShell, Edit, Write, NotebookEdit, WebFetch, WebSearch, TodoWrite, Skill, ToolSearch, EnterWorktree, ExitWorktree, Monitor, TaskStop, SendMessage, Artifact.
- disallowedTools accepts mcp__<server> and mcp__<server>__*. A Bash(...) entry there removes the whole Bash tool; use permissions.deny for command-level blocks.
- Spawn allowlist for a main-thread agent run with claude --agent: tools: Agent(worker, researcher), Read, Bash. Inside a subagent definition, the parenthesized list is ignored.

Built-in subagents: Explore (read-only, quick/medium/very thorough), Plan (read-only, plan mode), general-purpose (default for skill fork), statusline-setup, claude-code-guide. Disable with permissions.deny ["Agent(Explore)"] or CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1. A user or project agent named Explore overrides the built-in.

Invocation: automatic by description; natural language ("Use the code-reviewer subagent to ..."); @-mention (@"code-reviewer (agent)" or @agent-<name>; plugin agents @agent-hackforge:<name>); whole session via claude --agent <name> or settings {"agent": "<name>"}; /agents.

Constraints: subagents do not see your conversation history. Default concurrency is 20 (CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS). Nesting is up to 3 layers by default (CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH; 1 disables nesting). Subagents cannot approve permissions. Plugin subagents ignore hooks, mcpServers and permissionMode.

Example:

```markdown
---
name: code-reviewer
description: Reviews code for quality, security and best practices. Use proactively after code changes.
tools: Read, Grep, Glob, Bash
model: sonnet
maxTurns: 20
---
You are a code reviewer. For each issue, explain the problem, show the code, and propose a fix.
```

## 5. Hooks

Where hooks are defined:

- settings.json: ~/.claude/settings.json, .claude/settings.json, .claude/settings.local.json (stored at the git root), managed settings. Project settings load from the cwd's .claude/ with no parent-directory fallback.
- Plugin hooks/hooks.json (or manifest hooks key).
- Skill frontmatter hooks (run while invoked). Subagent frontmatter hooks (run while active; not for plugin subagents).

Schema: event -> array of matcher groups -> hooks array.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Handler types:

- command: command, args (exec form when present; shell form otherwise), async, asyncRewake, shell (bash or powershell), onFailure (continue default, or block, v2.1.295+).
- http: url, headers, allowedEnvVars, onFailure. POSTs the event JSON.
- mcp_tool: server, tool, input (supports ${path} substitution such as ${tool_input.file_path}).
- prompt: prompt (use $ARGUMENTS for the input JSON), model. Single-turn evaluation.
- agent: prompt, model. Spawns a subagent that can use Read, Grep and Glob to verify. Experimental.

Common fields: if (permission-rule syntax such as Bash(git *); tool events only), timeout (defaults: 600 for command, http and mcp_tool; 30 for prompt; 60 for agent), statusMessage, once (skill frontmatter only), async (timeout not enforced).

Events (from the docs table): SessionStart (matchers startup, resume, clear, compact, fork), Setup (init, maintenance), UserPromptSubmit, UserPromptExpansion, PreToolUse, PermissionRequest, PermissionDenied, PostToolUse, PostToolUseFailure, PostToolBatch, Notification (permission_prompt, idle_prompt, auth_success, elicitation_dialog), MessageDisplay, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Stop, StopFailure (rate_limit, overloaded, billing_error), TeammateIdle, InstructionsLoaded, ConfigChange, CwdChanged, DirectoryAdded, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact (manual, auto), PostCompact, PreModelSwitch, PostModelSwitch, Elicitation, ElicitationResult, SessionEnd (clear, resume, logout, prompt_input_exit, other).

Matchers: "*", "", or omitted = all. Letters, digits, _, -, spaces and a pipe- or comma-separated list = exact match list (for example Edit then Write). Any other character = unanchored JavaScript regex. MCP tools are named mcp__<server>__<tool>; the matcher mcp__memory matches nothing, so use mcp__memory__.*. Matchers are ignored for UserPromptSubmit, PostToolBatch, Stop, TeammateIdle, TaskCreated, TaskCompleted, WorktreeCreate, WorktreeRemove, MessageDisplay and CwdChanged.

stdin JSON common fields: session_id, prompt_id, transcript_path, cwd, scratchpad_dir, permission_mode (default, plan, acceptEdits, auto, dontAsk, bypassPermissions), hook_event_name, effort {level}. Subagents add agent_id and agent_type. PreToolUse adds tool_name, tool_input, tool_use_id.

Exit codes:

- 0: success. Stdout is parsed as JSON if it is one object; otherwise plain text. For UserPromptSubmit, UserPromptExpansion, SessionStart and PostModelSwitch, plain stdout becomes context for Claude.
- 2: blocking error. Blocks on events that can block; stderr is the reason. Ignored on PermissionRequest.
- Any other non-zero: non-blocking error shown in the transcript. Exit 1 does not block. Set onFailure to block to change this.

JSON output:

- Universal: continue (false stops Claude), stopReason, suppressOutput, systemMessage, terminalSequence.
- Top-level decision: "block" with reason is used by UserPromptSubmit, PostToolUse, Stop, SubagentStop, ConfigChange, PreCompact and others.
- hookSpecificOutput requires hookEventName. PreToolUse fields: permissionDecision (allow, deny, ask, defer), permissionDecisionReason, updatedInput, additionalContext. PermissionRequest: decision {behavior: allow or deny, updatedInput}. PostToolUse: updatedToolOutput, additionalContext. PermissionDenied: retry. SessionStart: additionalContext, initialUserMessage, sessionTitle, watchPaths, reloadSkills.
- additionalContext, systemMessage and initialUserMessage are capped at 10,000 chars.

Example deny:

```json
{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Database writes are not allowed"}}
```

Hooks and permission rules: a deny or ask rule still applies even if a PreToolUse hook returns allow. A hook that exits 2 stops the call before permission rules run.

Environment variables for hooks: CLAUDE_PROJECT_DIR (fixed when worktrees are entered), CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, CLAUDE_PLUGIN_OPTION_<KEY>, CLAUDE_EFFORT, CLAUDE_CODE_REMOTE, CLAUDE_CODE_BRIDGE_SESSION_ID. CLAUDE_ENV_FILE is a SessionStart file path for persisting env vars (details truncated in my read). There is no CLAUDE_MODEL; use the model field on SessionStart.

Plugin hooks/hooks.json:

```json
{
  "description": "HackForge guardrails",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/format.js", "--fix"],
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Shell-form plugin hooks cannot reference ${user_config.*}. Use exec form or CLAUDE_PLUGIN_OPTION_<KEY>.

## 6. MCP

Scopes:

| Scope | Loads in | Shared | Stored in |
| :- | :- | :- | :- |
| local (default) | current project only | no | ~/.claude.json under the project path |
| project | current project | yes, via VCS | .mcp.json at the project root |
| user | all projects | no | ~/.claude.json |

Precedence for duplicates: local > project > user > plugin-provided > claude.ai connectors. A managedMcpServers setting (v2.1.259+) ranks above all of these. Entries are used whole. Project .mcp.json servers need interactive approval (claude mcp reset-project-choices resets it). claude -p and SDK sessions load them without a prompt.

claude mcp add:

```bash
claude mcp add [options] <name> -- <command> [args...]        # stdio
claude mcp add --transport http <name> <url> [options]        # http
claude mcp add --transport sse <name> <url>                   # sse (deprecated)
```

Options: --transport or -t (stdio, http, sse; ws is only via add-json); --scope or -s (local default, project, user); --env or -e KEY=value (repeatable); --header or -H "Name: value"; --callback-port; --client-id; --client-secret (masked prompt, or MCP_CLIENT_SECRET for CI).

```bash
claude mcp add --transport http notion https://mcp.notion.com/mcp
claude mcp add --transport http secure-api https://api.example.com/mcp --header "Authorization: Bearer your-token"
claude mcp add --env HACKFORGE_KEY=xyz --transport stdio hackforge-tools --scope user -- npx -y some-mcp-server
claude mcp add --transport http shared-server --scope project https://example.com/mcp
claude mcp add-json weather-api '{"type":"http","url":"https://api.weather.com/mcp"}' --scope user
```

Caveats: without -- the server's own flags are parsed as Claude's flags. With --env followed directly by the name, the name is read as another KEY=value pair, so put another option between them.

Other subcommands: claude mcp list, get <name>, remove <name>, add-json, login <name>, logout <name>, reset-project-choices, serve, add-from-claude-desktop. In session: /mcp.

.mcp.json format:

```json
{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": { "Authorization": "Bearer ${API_KEY}" },
      "alwaysLoad": false
    }
  }
}
```

- type: stdio, http, sse, or ws (streamable-http is an alias for http). An entry with url and no type is skipped as a config error. "type": "sdk" is skipped in files.
- Other keys: command, args, env, url, headers, headersHelper, timeout (per-call ms), alwaysLoad, oauth {clientId, callbackPort, authServerMetadataUrl, scopes}.
- Expansion: ${VAR} and ${VAR:-default}, in command, args, env, url and headers. An unset variable with no default loads with a warning and the literal text is kept. In a remote server's url and headers, ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, AWS_BEARER_TOKEN_BEDROCK, HTTPS_PROXY and NPM_TOKEN expand to empty. CLAUDE_PROJECT_DIR is set for stdio servers; in project or user files use ${CLAUDE_PROJECT_DIR:-.}.

Plugin MCP servers: declare them in the plugin's .mcp.json at the plugin root, or inline in plugin.json mcpServers.

```json
{
  "mcpServers": {
    "hackforge-api": {
      "command": "${CLAUDE_PLUGIN_ROOT}/bin/hackforge-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": { "API_TOKEN": "${user_config.api_token}", "DATA_DIR": "${CLAUDE_PLUGIN_DATA}" }
    }
  }
}
```

- Servers are registered as plugin:<plugin>:<server> and start when the plugin is enabled. Substitution applies to command, args and env for stdio, and to url, headers and headersHelper for remote servers.
- Tool names: mcp__plugin_<plugin>_<server>__<tool>. Characters outside A-Z a-z 0-9 _ - become _. Example: mcp__plugin_hackforge_hackforge-api__search.

Context control and output budgets:

- Tool search is on by default. MCP tool definitions are deferred and only names load at session start. ENABLE_TOOL_SEARCH takes unset (defer all; falls back to upfront on older models and on non-first-party ANTHROPIC_BASE_URL), true, auto (load upfront while definitions total under 10 percent of the context window), auto:N (N percent), or false (load everything upfront). Set it in settings.json env or the shell.
- Disable only the ToolSearch tool with permissions.deny ["ToolSearch"].
- alwaysLoad: true in a server entry (or "anthropic/alwaysLoad": true in a tool's _meta) loads tools upfront. Startup waits up to the 5-second connect timeout for them. alwaysLoad: false defers a server's tools even when the author marked them upfront (v2.1.287+).
- MAX_MCP_OUTPUT_TOKENS: default 25,000 tokens; a warning appears above 10,000. Results over the limit are saved to a file and the path is given to the model. Text results over 50,000 characters are saved regardless, unless the tool declares _meta["anthropic/maxResultSizeChars"] (ceiling 500,000).
- MCP_TIMEOUT (startup, ms). MCP_TOOL_TIMEOUT (per call; values under 1000 are ignored; default about 28 hours per the docs text). CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT (default 5 min remote, 30 min stdio; 0 disables).
- Descriptions: server instructions and eagerly loaded tool descriptions are cut at 4,096 chars; deferred tool descriptions at 16,384 chars (v2.1.296+). CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH overrides both.

Permission rules for MCP tools (no parentheses; an mcp__ rule with parentheses is skipped with a warning):

- mcp__<server> matches every tool from that server.
- mcp__<server>__* uses wildcard syntax and matches all of that server's tools.
- mcp__<server>__<tool> matches one tool.
- Plugin server tools use mcp__plugin_<plugin>_<server>__<tool>.

Illustrative settings fragment (names are placeholders):

```json
{
  "permissions": {
    "allow": ["mcp__plugin_hackforge_hackforge-api__*"],
    "deny": ["mcp__plugin_hackforge_hackforge-api__drop_table"]
  }
}
```

Managed-only controls: allowedMcpServers and deniedMcpServers (see managed-mcp.md; not fully read). A tool annotated _meta["anthropic/requiresUserInteraction"]: true prompts on every call, even in auto or bypass modes.

## 7. Workflows (the docs call them "dynamic workflows")

Doc: https://code.claude.com/docs/en/workflows.md. A workflow is a JavaScript script that Claude writes (or that you save). The runtime executes it in the background. Each agent() spawns a subagent. Intermediate results stay in script variables, and only the final result returns to the conversation.

Availability: paid plans, Anthropic API, Bedrock, Vertex (Google Cloud's Agent Platform) and Foundry. On Pro, turn it on in /config (Dynamic workflows row). Off switches: /config toggle; "disableWorkflows": true in settings.json; CLAUDE_CODE_DISABLE_WORKFLOWS=1; managed settings. Disabling also removes /workflows, the /workflow-authoring skill and the ultracode toggle.

Saved locations:

- Project: .claude/workflows/<name>.js. Walk-up rule: the closest existing .claude/workflows/ between the cwd and the repo root is used. The closest one wins when names clash.
- Personal: ~/.claude/workflows/ (or $CLAUDE_CONFIG_DIR/workflows/). Available in every project.
- Plugin: <plugin>/workflows/*.js, or the manifest workflows key. Runs as /<plugin>:<meta.name>.
- Project beats personal when names clash.
- Saving: in /workflows, select a run, press s, and use Tab to choose project or personal.
- Each run's script is written under ~/.claude/projects/<session>/. Claude receives that path.
- Filename: the docs show .js. The command name comes from meta.name, not the filename. A .workflow.js suffix is UNDOCUMENTED.

Script shape (from the docs' example):

```javascript
export const meta = {
  name: 'audit-routes',
  description: 'Audit every route handler for missing auth checks',
}

const found = await agent('List every .ts file under src/routes/.', {
  schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', items: { type: 'string' } } } },
})

const audits = await pipeline(found.files, file =>
  agent(`Audit ${file} for missing authentication checks.`, { label: file }),
)

return audits.filter(Boolean)
```

Rules:

- meta must be the first statement and a plain literal, with name and description. Anything else (a variable, call or spread) drops /<name> from autocomplete. Optional phases array: each entry must match a phase() title exactly.
- The body is top-level-await JavaScript with no import(). The script has no direct filesystem or shell access; agents do that work.
- Helpers: agent(prompt, opts) spawns one subagent. parallel() runs a set concurrently and waits for all (signature UNDOCUMENTED in pages read). pipeline(items, fn) moves each item through its stages independently. phase(title) groups the following agents in the progress view. log(msg) prints above the phases. args is the global input from the invocation (undefined if omitted).
- agent() options seen in docs: schema (JSON Schema; output is validated, retried up to 5 attempts, overridable with MAX_STRUCTURED_OUTPUT_RETRIES), label (display name), stallMs (ms before a silent agent is restarted; a stalled agent restarts up to 5 times and shows (retry N)). The key for choosing a model is UNDOCUMENTED.
- agent() resolves to null if it is stopped or hits an unrecoverable API error. pipeline() keeps the nulls, so filter them.
- Determinism: Date.now(), Math.random() and a no-argument new Date() throw. Pass timestamps through args. A resumed run replays cached results for agent calls whose prompts are unchanged.
- Limits: 16 concurrent agents by default (CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS, 1 to 256, v2.1.269+). 1,000 agents total per run. 4,096 items per single parallel() or pipeline() call. A large-run warning appears above 25 agents or 1.5M projected tokens (advisory only).
- Only a permission prompt or a usage-limit wait pauses a run. There is no mid-run user input. Subagents cannot launch workflows (Workflow is removed from subagents).

Invocation paths:

- Slash command: /<meta.name>, or /<plugin>:<meta.name> for plugin workflows. /workflows lists runs; /reload-skills re-reads workflow directories after edits.
- Prompt keyword: "ultracode" or a request for a workflow, typed at the interactive prompt. Not triggered by -p prompts, scheduled prompts, or relayed webhook text.
- Session mode: /effort ultracode; setting "ultracode"; claude --effort ultracode.
- The Workflow tool (Agent SDK v0.3.149+; tool name Workflow). Input:

```ts
type WorkflowInput = {
  script?: string;          // inline; must start with export const meta = { name, description }
  name?: string;            // built-in, or saved in .claude/workflows/
  scriptPath?: string;      // file path; wins over script and name; needs the Read tool
  args?: unknown;           // exposed as the global args (pass real arrays and objects)
  resumeFromRunId?: string; // a prior run in the same session
  title?: string;           // ignored; meta sets it
  description?: string;     // ignored; meta sets it
};
```

At least one of script, name or scriptPath is required. The output shape is UNDOCUMENTED beyond "one consolidated result".

Permission to launch:

- Interactive CLI: auto mode prompts once on first launch. Manual mode prompts every run unless you pick "Yes, and don't ask again". Bypass mode never prompts.
- claude -p and the Agent SDK never show a prompt. Allow the launch with a rule: Workflow (all workflows) or Workflow(<name>) (one saved workflow). Other options are auto mode, bypassPermissions, a PreToolUse hook returning allow (not in plan mode), or a canUseTool callback.
- Subagents in a run use the normal permission rules. Add their tools to the allow rules to avoid prompts.

Run management: /workflows keys are ↑/↓ (select), Enter or → (drill in), Esc or ← (back), j/k (scroll), f (filter by status), p (pause or resume), x (stop agent, or whole run), r (restart agent), s (save script). Resume happens in the same session. Completed agents return saved results until the first changed prompt. Failed agents and everything after them run again.

Settings: workflowSizeGuideline (unrestricted, small, medium, large; default medium, or small on Pro with v2.1.271+). subagentPromptCacheTtl (default 5m; set 1h for longer). autoContinueAtUsageLimit (controls waiting at a usage limit). ultracode (start sessions with it on).

Bundled: /deep-research <question> (needs the WebSearch tool). Note: this environment also has a user-level skill named deep-research. Precedence between a saved workflow and the bundled workflow is UNDOCUMENTED.

## 8. Permission rule syntax (settings.json permissions)

- Format: Tool or Tool(specifier). Evaluation order is deny, then ask, then allow. The first match wins, and specificity does not change the order. A deny in any scope beats an allow in another.
- Mode: permissions.defaultMode (default, acceptEdits, auto, dontAsk, bypassPermissions, plan).
- Bash: Bash(npm run build) exact; Bash(npm run *) wildcard; Bash(git push *) denies a family.
- Files: Read(./.env), Edit(src/**) (allow matches only cwd-relative; deny or ask matches at any depth), Edit(**/src/**) (any depth).
- WebFetch(domain:example.com). Agent(Explore) or Agent(my-agent). Workflow or Workflow(<name>). Skill(name) or Skill(name *). The permissions page also documents a deny form Skill(skill:<name>) that matches any alias.
- MCP: see section 6.
- Files: ~/.claude/settings.json (user), .claude/settings.json (project, shared), .claude/settings.local.json (personal, stored at the repo root). Project allow rules are applied only after the workspace trust dialog.

Illustrative fragment (names are placeholders):

```json
{
  "permissions": {
    "allow": ["Workflow(audit-routes)", "mcp__plugin_hackforge_hackforge-api__*"],
    "deny": ["Agent(Explore)"]
  }
}
```

## 9. Where things live (cheat sheet)

| What | Project | User (~/) | Plugin |
| :- | :- | :- | :- |
| Skills | .claude/skills/<n>/SKILL.md | ~/.claude/skills/<n>/SKILL.md | skills/<n>/SKILL.md |
| Legacy commands | .claude/commands/*.md | ~/.claude/commands/*.md | commands/*.md |
| Subagents | .claude/agents/*.md | ~/.claude/agents/*.md | agents/*.md |
| Hooks | .claude/settings.json "hooks" (and settings.local.json) | ~/.claude/settings.json "hooks" | hooks/hooks.json |
| Workflows | .claude/workflows/*.js | ~/.claude/workflows/*.js | workflows/*.js |
| MCP servers | .mcp.json (project root) | ~/.claude.json (user scope) | .mcp.json at plugin root, or inline |
| Settings and permissions | .claude/settings.json; .claude/settings.local.json | ~/.claude/settings.json | settings.json (agent key only) |
| Subagent memory | .claude/agent-memory/<agent>/ | ~/.claude/agent-memory/<agent>/ | n/a |
| Plugin data | n/a | ~/.claude/plugins/data/<id>/ (CLAUDE_PLUGIN_DATA) | same |

## 10. Plugin vs manual copy into ~/.claude

Plugin install:

- Gets namespacing (/hackforge:<name>), userConfig prompts and secure storage, plugin-level hooks and MCP servers, a version pin, and updates through the marketplace. The CLI validates it.
- Limits: plugin subagents ignore hooks, mcpServers and permissionMode. A plugin-root CLAUDE.md is not loaded. Declaring commands replaces the default commands/ scan.

Manual copy:

- Skills, agents and workflows copy directly into ~/.claude/{skills,agents,workflows}/. There is no namespacing, so name clashes with the user's own items follow the collision rules above.
- Hooks must be merged by hand into ~/.claude/settings.json under "hooks".
- MCP servers added with claude mcp add --scope user are stored in ~/.claude.json, not in ~/.claude/settings.json.
- There is no userConfig; secrets must come from environment variables.

## 11. Gaps and verification notes

- hooks.md: only the first part was read. The per-event detail after SessionStart, the prompt and agent hook output schemas, and CLAUDE_ENV_FILE detail were not read.
- sub-agents.md: the final ~11k chars were not read. skills.md: the final ~9k chars were not read.
- plugins/components.md returned a tutorial ("Add components to a plugin"), not the runtime component reference. The manifest reference covered the standard layout.
- Workflow tool output shape, parallel() signature, agent() model key, and the saved-filename rule are UNDOCUMENTED in the pages read.
- plugin-evals.md and hooks-guide.md are in the docs map but were not fetched.
- The workflows page calls the feature "dynamic workflows" and the saved scripts "workflow scripts"; the computed task's term "native Workflow-tool scripts" maps to the Workflow tool in the Agent SDK reference.

reference_markdown_end