# Shell Execution + Code Cleanup

Last Updated: 2026-01-05

## Summary

Extended shell command capabilities with real execution support, added cache telemetry, and cleaned up test artifacts.

## Changes

### Real Shell Execution (`skill-commands.ts`)
- Added `runShellCommand()` with `execAsync` for actual command execution
- Allowlisted commands: `curl` (whitelist prevents arbitrary execution)
- 10-second timeout protection with 1MB buffer limit
- Unified `executeCommand()` tries skill commands first, falls back to shell
- Output truncation at 5000 chars to avoid context bloat

### Cache Telemetry (`route.ts`)
- Added `usage` SSE event type with `inputTokens`, `outputTokens`, `cacheReadTokens`
- Console logging of cache stats per iteration for debugging
- Enables monitoring Gemini KV cache hit rates

### Skills Directory Migration
- Moved from `.forge/skills/` to `.skills/`
- Deleted test skills: `amazon-cognito-authentication`, `claude-code-skills`, `javascript-variable-scope`
- Cleaned up unused `src/lib/tools/shell.ts`

### UI Fixes (`ChatMessage.tsx`)
- Added `break-all` class to user messages, terminal output, and assistant messages
- Prevents long URLs and commands from breaking layout

## Architecture Notes

Shell command allowlist pattern:
```typescript
const ALLOWED_SHELL_COMMANDS = ['curl'];
const [cmd] = command.trim().split(/\s+/);
if (!ALLOWED_SHELL_COMMANDS.includes(cmd)) {
  return `Command "${cmd}" not allowed.`;
}
```

This provides minimal attack surface while enabling web research via curl.
