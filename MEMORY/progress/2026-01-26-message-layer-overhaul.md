# Message Layer Overhaul Plan

**Created:** 2026-01-26
**Status:** Implemented

## Problem

Tool calls/results are not properly preserved in conversation history:
1. `MessagePart` in `transform.ts:33-36` lacks `toolCallId` field (but hook has it at line 14)
2. `expandIterations()` flattens tool results into `user` role messages with `[Shell Output]\n` prefix
3. On follow-up messages, the model receives no structured tool information → destroys KV cache
4. Unnecessary `APIMessage` intermediate format adds complexity

## Solution

Eliminate the UI/API message distinction and convert directly to AI SDK's `ModelMessage` format.

**Before:** `UIMessage → APIMessage (flattened text) → ModelMessage`
**After:** `UIMessage (with parts) → ModelMessage (AI SDK native)`

## Implementation

### 1. Add imports in transform.ts

```typescript
import type {
  ModelMessage,
  TextPart,
  ToolCallPart,
  ToolResultPart
} from 'ai';  // Re-exported from @ai-sdk/provider-utils
```

### 2. Update `MessagePart` type (line 33-36)

Add `toolCallId` and handle all part types including sources:

```typescript
export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'reasoning'; content: string }
  | {
      type: 'tool';  // Legacy shell tool (deprecated)
      command: string;
      commandId: string;
      content: string;  // Result
    }
  | {
      type: 'agent-tool';  // AI SDK tools (search, url_context, shell)
      toolName: string;
      toolArgs: Record<string, unknown>;
      toolCallId: string;
      content: string;  // Result
    }
  | {
      type: 'sources';  // Grounding citations from Gemini
      sources: Array<{ id: string; url: string; title: string }>;
    };
```

### 3. Remove `APIMessage` interface (line 38-42)

Delete entirely - no longer needed.

### 4. Create new `toModelMessages()` function

**CRITICAL**: Use correct AI SDK field names (`input` not `args`, `output` not `result`):

```typescript
export function toModelMessages(messages: Array<DBMessage | UIMessage>): ModelMessage[] {
  const result: ModelMessage[] = [];

  for (const message of messages) {
    if (message.role === 'user') {
      result.push({ role: 'user', content: message.rawContent });
      continue;
    }

    // Handle legacy messages with iterations but no parts
    if (!message.parts?.length) {
      if (message.iterations?.length) {
        // Fallback: convert iterations to simple text messages
        for (const iter of message.iterations) {
          result.push({ role: 'assistant', content: iter.rawContent });
          if (iter.toolOutput) {
            // Can't reconstruct proper tool format, use user role
            result.push({ role: 'user', content: `[Tool Output]\n${iter.toolOutput}` });
          }
        }
      }
      continue;
    }

    // Build assistant message content array
    const assistantContent: Array<TextPart | ToolCallPart> = [];
    const toolResults: ToolResultPart[] = [];

    for (const part of message.parts) {
      if (part.type === 'text') {
        assistantContent.push({ type: 'text', text: part.content });
      } else if (part.type === 'agent-tool' && part.toolCallId) {
        // Tool call goes in assistant message
        assistantContent.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.toolArgs,  // AI SDK uses 'input' not 'args'
        });
        // Tool result goes in separate tool message
        if (part.content) {
          toolResults.push({
            type: 'tool-result',
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            output: { type: 'text', value: part.content },  // AI SDK ToolResultOutput format
          });
        }
      }
      // Skip 'reasoning' and legacy 'tool' parts - not needed for model context
    }

    if (assistantContent.length > 0) {
      result.push({ role: 'assistant', content: assistantContent });
    }
    if (toolResults.length > 0) {
      result.push({ role: 'tool', content: toolResults });
    }
  }

  return result;
}
```

### 5. Update `uiToApiMessages()` → `toModelMessages()` (line 153-155)

Replace the function that currently flattens messages:
```typescript
// DELETE this:
export function uiToApiMessages(messages: UIMessage[]): Array<{ role: string; content: string }> {
  return expandAllIterations(messages, 'user', '[Shell Output]\n');
}

// The new toModelMessages() serves this purpose
```

### 6. Update frontend to send parts-based format

In `useForgeChat.ts` line 197, change what the frontend sends:
```typescript
// Before: sends flattened APIMessage[]
const apiMessages = uiToApiMessages(filteredMessages as UIMessage[]);

// After: send UI messages with parts intact, let backend convert
// The backend will call toModelMessages() on these
body: JSON.stringify({
  messages: filteredMessages.map(m => ({
    role: m.role,
    rawContent: m.rawContent,
    parts: m.parts,
    iterations: m.iterations,
  })),
  mode, conversationId, env, sandboxId
})
```

### 7. Update API route (route.ts)

Change the expected message type and conversion:
```typescript
// Line 82-83: Change type annotation
const { messages, ... } = await req.json() as {
  messages: Array<DBMessage | UIMessage>;  // Was APIMessage[]
  // ...
};

// Line 127-136: Update skill mode fallback message format
if (mode === 'codify-skill') {
  // ...
  messages = initialMessages.length > 0
    ? [...initialMessages]
    : [{ role: 'user', rawContent: 'Start' }];  // Was { role: 'user', content: 'Start' }
}

// Line 141: Use new function
const modelMessages = toModelMessages(messages);
```

### 8. Keep `partsToIteration()` (line 61-79)

Still needed by hook for building `iterations` field during message completion. Don't delete.

### 9. Delete legacy functions

- `expandIterations()` - no longer used
- `expandAllIterations()` - no longer used

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/messages/transform.ts` | Add imports, update `MessagePart`, remove `APIMessage`, rewrite `toModelMessages()`, delete flattening functions |
| `src/hooks/useForgeChat.ts` | Send full message format with parts (not flattened), remove `uiToApiMessages` import |
| `src/app/api/agent/route.ts` | Update message type annotation, remove intermediate conversion |

## Migration Notes

- Existing DB messages with `iterations` but no `parts` will use the fallback path (flattened text)
- Existing DB messages with `parts` but no `toolCallId` will skip tool call reconstruction (text parts still included)
- New messages will have proper `toolCallId` from SSE events

## Known Issue (Out of Scope)

The `source` SSE events from the API route are not being handled in `useForgeChat.ts` - there's no `case 'source':` handler. This is an existing bug. Grounding citations are sent but silently dropped. Consider adding:

```typescript
case 'source': {
  const sourcesPart = parts.find(p => p.type === 'sources');
  if (sourcesPart && sourcesPart.sources) {
    sourcesPart.sources.push({
      id: event.sourceId || '',
      url: event.sourceUrl || '',
      title: event.sourceTitle || '',
    });
  } else {
    parts.push({
      type: 'sources',
      content: '',
      sources: [{
        id: event.sourceId || '',
        url: event.sourceUrl || '',
        title: event.sourceTitle || '',
      }],
    });
  }
  updateAssistantMessage();
  break;
}
```

## Verification

1. Start dev server: `pnpm dev`
2. Test new conversation with tool calls:
   - Shell commands via `execute_shell` tool
   - Search via `search` tool
   - URL analysis via `analyze_url` tool
3. Send follow-up message and verify:
   - Check `raw_payload` in debug mode shows proper tool-call/tool-result structure
   - Check Braintrust logs for improved cached token counts
4. Load existing conversation and verify backward compatibility
5. Run `pnpm test` to ensure no regressions
