# Plan: Make Shell a Proper Tool (GitHub Issue #13, Option A)

## Summary

Convert shell command execution from the `<shell>` literal text pattern to a proper `execute_shell` tool registered alongside `google_search` and `url_context`. This aligns with how reasoning models expect tool invocations to work.

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/agent/request-context.ts` | Add `env` field to RequestContext interface |
| `src/lib/agent/task-agent.ts` | Add `execute_shell` tool, update agent instructions |
| `src/app/api/agent/route.ts` | Pass env to context, remove shell parsing logic, simplify agent loop |
| `src/components/ChatMessage.tsx` | Add display name for `execute_shell` tool (optional) |

## Implementation Steps

### Step 1: Extend Request Context

**File:** `src/lib/agent/request-context.ts`

Add `env` field to allow the tool's execute function to access environment variables:

```typescript
interface RequestContext {
  conversationId?: string;
  sandboxId?: string;
  env?: Record<string, string>;  // NEW
}
```

### Step 2: Create execute_shell Tool

**File:** `src/lib/agent/task-agent.ts`

Add imports:
```typescript
import { z } from 'zod';
import { executeCommand } from '@/lib/tools/command-executor';
import { getRequestContext } from './request-context';
```

Define the tool before `createTaskAgent()`:
```typescript
const executeShellTool = {
  description: `Execute shell commands in the sandbox environment.

Use for:
- File operations (ls, cat, mkdir, etc.)
- API calls (curl with headers and data)
- Running scripts (python3 script.py)
- Skill system commands (skill list, skill get, skill search, etc.)

Skill commands (prefix with "skill "):
- skill list - List all saved skills
- skill search <keyword> - Search skills
- skill get <name> - Read skill content
- skill copy-to-sandbox <name> <file> - Copy skill file to sandbox
- skill suggest "desc" --name="name" - Suggest codifying a skill

Results are returned as text.`,
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
  }),
  execute: async ({ command }: { command: string }) => {
    const { env } = getRequestContext();
    return executeCommand(command, { env });
  },
};
```

Register in agent tools:
```typescript
tools: {
  google_search: google.tools.googleSearch({}),
  url_context: google.tools.urlContext({}),
  execute_shell: executeShellTool,
},
```

### Step 3: Update Agent Instructions

**File:** `src/lib/agent/task-agent.ts`

Replace the current "Action Mechanisms" section. Key changes:

**Remove:**
- "Shell Commands (Continuation Pattern)" section (lines 60-88)
- All `<shell>` tag syntax and examples
- "Shell Turn Protocol" section
- References to literal text pattern

**Update to:**
```markdown
# Action Mechanisms

## Tools (Auto-executed)
You have three tools:

1. **google_search** - Search the web for information
2. **url_context** - Analyze URLs including YouTube videos
3. **execute_shell** - Run shell commands in sandbox

### Shell Execution
Use execute_shell for file operations, API calls (curl), scripts (python3), and skill commands.

#### Skill System Commands
Pass these to execute_shell:
- skill list - List all saved skills
- skill search keyword - Search skills
- skill get name - Read skill content
- skill copy-to-sandbox name file - Copy skill file to sandbox
- skill suggest "desc" --name="name" - Suggest codification

### Execution Flow
When you call execute_shell, the system executes the command and returns results. This is a multi-turn loop - tool calls don't end the conversation.
```

Also update Phase 3 skill suggestion to use tool call syntax instead of `<shell>` tags.

### Step 4: Simplify Route Handler

**File:** `src/app/api/agent/route.ts`

1. **Pass env to request context** (line ~119):
```typescript
await runWithRequestContext({ conversationId, sandboxId: currentSandboxId, env: mergedEnv }, async () => {
```

2. **Remove shell tag parsing** (lines 168-184):
   - Delete `shellRegex` matching in text-delta case
   - Delete `detectedCommands` array tracking
   - Delete `lastProcessedIndex` and `commandIdCounter`

3. **Handle execute_shell tool events** - In the `tool-call` case, add sandbox tracking:
```typescript
case 'tool-call':
  // Track sandbox usage for execute_shell
  if (part.toolName === 'execute_shell') {
    const args = part.input as { command?: string };
    if (args.command && !args.command.startsWith('skill ')) {
      sandboxUsed = true;
    }
    // Emit sandbox_created on first shell use
    if (!sandboxIdEmitted && !requestSandboxId && sandboxUsed) {
      const currentSandboxId = executor.getSandboxId();
      if (currentSandboxId) {
        send({ type: 'sandbox_created', sandboxId: currentSandboxId });
        sandboxIdEmitted = true;
      }
    }
  }
  send({
    type: 'agent-tool-call',
    toolName: part.toolName,
    toolArgs: part.input,
    toolCallId: part.toolCallId,
  });
  break;
```

4. **Remove manual command execution loop** (lines 249-337):
   - The AI SDK now handles tool execution automatically
   - Tool results flow through `tool-result` stream events
   - No need for manual `extractCommands()` or `executeCommand()` calls

5. **Update loop termination**:
   - Instead of checking for empty commands, track if any tools were called this iteration
   - Loop ends when model produces text without tool calls

6. **Handle SandboxTimeoutError**:
   - The error may now bubble up from the AI SDK
   - Wrap agent.stream() in try/catch to handle sandbox timeout

### Step 5: Update Frontend (Optional Enhancement)

**File:** `src/components/ChatMessage.tsx`

Add display name for execute_shell in `AgentToolPart`:
```typescript
const isShellCommand = toolName === 'execute_shell';
const toolDisplayName = isGoogleSearch
  ? 'Google Search'
  : toolName.includes('url_context')
    ? 'URL Context'
    : isShellCommand
      ? 'Shell'
      : toolName;
```

## Architecture Changes

### Before (Manual Harness)
```
Agent outputs: "Let me check... <shell>ls</shell>"
   ↓
Harness parses <shell> tags
   ↓
Harness executes commands manually
   ↓
Harness injects results as tool message
   ↓
Next agent iteration
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
   ↓
AI SDK continues with results
```

## Verification

1. **Single command**: Test `execute_shell` with a simple `ls` command
2. **Multiple commands**: Test agent calling execute_shell multiple times in sequence
3. **Skill commands**: Test `skill list`, `skill get`, `skill search`
4. **Environment variables**: Test curl with API keys from env
5. **Sandbox persistence**: Verify files persist across tool calls in same session
6. **Error handling**: Test command failures and sandbox timeout
7. **UI rendering**: Verify tool calls display correctly in chat interface

## Notes

- The skill-agent.ts still uses `<shell>` pattern - can be migrated separately
- No breaking changes to stored conversations
- SSE events transition from `tool-call`/`tool-result` to `agent-tool-call`/`agent-tool-result`
