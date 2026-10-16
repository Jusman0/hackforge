// CLI flag vocabulary, shared by the CLI and the git-guard hook (so the hook parses `hackforge …`
// invocations exactly like the CLI does — flags may appear anywhere).
export const VALUE_FLAGS = ['note', 'cmd', 'url', 'name', 'theme', 'intent', 'dev-command']
export const BOOLEANS = ['lock', 'unlock', 'done', 'undo', 'brief', 'json', 'force', 'async', 'fresh', 'print', 'free', 'staged', 'tracked', 'history', 'probe', 'write', 'all', 'consented', 'direct', 'include-content', 'snippet', 'help']
