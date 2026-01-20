# Shell Tool Migration - Task Summary

Last Updated: 2026-01-18

## Overview

Migrated shell command execution from the `<shell>` literal text pattern (where the agent outputs `<shell>ls</shell>` and the harness parses/executes it) to a proper `execute_shell` AI SDK tool that the model calls directly.

## Problem Statement

The `<shell>` tag approach had several drawbacks:
- Required custom regex parsing in the route handler
- Not aligned with how modern AI SDKs expect tool invocations
- Manual command execution loop was complex and error-prone
- Streaming tool events required tracking detected commands separately

## Implementation

### Files Modified

| File | Changes |
|------|---------|
| `src/lib/agent/request-context.ts` | Added `env` field to RequestContext interface |
| `src/lib/agent/task-agent.ts` | Added `execute_shell` tool, updated agent instructions |
| `src/app/api/agent/route.ts` | Simplified agent loop, removed shell parsing logic |
| `src/components/ChatMessage.tsx` | Enhanced shell command display with `$ command` format |

### Key Changes

**1. execute_shell Tool Definition** (`task-agent.ts`)
```typescript
const executeShellTool = {
  description: `Execute shell commands in the sandbox environment...`,
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
  }),
  execute: async ({ command }) => {
    const { env } = getRequestContext();
    return executeCommand(command, { env });
  },
};
```

**2. Agent Loop Simplification** (`route.ts`)
- Removed `extractCommands()` and manual shell tag regex parsing
- Removed `detectedCommands` array and `lastProcessedIndex` tracking
- AI SDK now handles tool execution automatically via `tool-call`/`tool-result` stream events
- Loop termination based on `hasToolCalls` flag instead of command count

**3. Agent Instructions Update** (`task-agent.ts`)
- Replaced "Shell Commands (Continuation Pattern)" section with "Tools (Auto-executed)"
- Removed all `<shell>` tag syntax and examples
- Added explicit guidance: "Do NOT output shell commands as text. Always use the execute_shell tool."

## Architecture Change

### Before (Manual Harness)
```
Agent outputs: "Let me check... <shell>ls</shell>"
   ↓
Harness parses <shell> tags
   ↓
Harness executes commands manually
   ↓
Harness injects results as tool message
```

### After (AI SDK Tool)
```
Agent calls execute_shell tool
   ↓
AI SDK emits tool-call event
   ↓
AI SDK invokes execute() function automatically
   ↓
AI SDK emits tool-result event
```

## Resolved Issues

1. **AI SDK property naming**: Discovered `part.input` vs `part.args` discrepancy - added type assertion to handle both
2. **Provider tool compatibility**: Native tools (`google_search`, `url_context`) CAN'T coexist with custom function tools (`execute_shell`). The earlier assumption that Gemini doesn't support this was incorrect - current implementation proves all three tools work together
3. **Debug logging**: Added stream event logging to diagnose tool execution flow

## Commits

- `8ee76f9` - refactor: migrate shell execution from <shell> tags to execute_shell tool
- `c0c376b` - Update discord playground task desc

## Next Steps

1. Test tool execution end-to-end with actual shell commands
2. Verify sandbox state persistence across tool calls
3. Consider alternative for google_search/url_context functionality
4. Remove debug logging once migration is verified stable
