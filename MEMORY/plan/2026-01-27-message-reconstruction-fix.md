# Fix Message Reconstruction Order Bug + Remove AgentIteration

## Summary

1. Fix message ordering bug in `toModelMessages()` - assistant text appears before tool calls instead of after
2. Remove redundant `AgentIteration` interface - `parts` is the single source of truth
3. Keep `raw_payload` for stream-level debugging

## Part 1: Fix Message Ordering

**Bug**: `toModelMessages()` collects all text and tool-calls into one assistant message, losing interleaved order.

**Current (wrong)**: `[text1, tool-call, text2]` →
```
assistant: [text1, text2, tool-call]  ← text2 wrongly placed
tool: [tool-result]
```

**Expected**:
```
assistant: [text1, tool-call]
tool: [tool-result]
assistant: [text2]  ← after tool execution
```

**Fix**: Track when tool-calls are pending; flush before adding new text.

```typescript
// In toModelMessages() loop:
if (part.type === 'text') {
  if (hasToolCallsInCurrent && pendingToolResults.length > 0) {
    // Flush: text after tool execution starts new assistant message
    result.push({ role: 'assistant', content: currentAssistantContent });
    result.push({ role: 'tool', content: pendingToolResults });
    currentAssistantContent = [];
    pendingToolResults = [];
    hasToolCallsInCurrent = false;
  }
  currentAssistantContent.push({ type: 'text', text: part.content });
}
```

## Part 2: Remove AgentIteration

`iterations` was for legacy format (`rawContent` + `toolOutput`). Now `parts` has all info.

### Changes by File

**`src/lib/messages/transform.ts`**
- Fix `toModelMessages()` ordering (Part 1)
- Delete `AgentIteration` interface
- Delete `partsToIteration()` function
- Remove `iterations` from `Message` interface
- Keep legacy fallback for old DB data without `parts`

**`src/lib/db/conversations.ts`**
- `saveMessage()`: Store only `{ parts }`, not `{ iterations, parts }`
- `hydrateMessage()`: Don't read/return `iterations`

**`src/hooks/useForgeChat.ts`**
- Remove `iterationsRef`
- Remove `raw-content` and `tool-output` event handlers (dead code)
- Remove `iterations` from final message construction
- Remove `partsToIteration()` import/usage

## Files to Modify

1. `src/lib/messages/transform.ts`
2. `src/lib/db/conversations.ts`
3. `src/hooks/useForgeChat.ts`

## Verification

1. `pnpm test` - Existing tests pass
2. `pnpm dev` - Run dev server
3. Execute multi-tool task (stripe subscription from playground)
4. Check observability trace: User → Assistant(tool-calls) → Tool(results) → Assistant(text)
5. Reload page - conversation loads from DB correctly
