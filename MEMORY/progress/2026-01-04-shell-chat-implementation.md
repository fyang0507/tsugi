# Shell Commands + Chat Interface Implementation

Last Updated: 2025-01-04

## Summary

Implemented the plan from `SHELL_CHAT_PLAN.md`: shell command auto-execution with `<shell>` tags and a full chat interface with message history.

## Files Changed

### New Files
- `src/lib/tools/command-parser.ts` - Extracts `<shell>` tags without modifying content
- `src/hooks/useForgeChat.ts` - Custom chat hook with SSE parsing, abort handling
- `src/components/ChatMessage.tsx` - Renders user/assistant/tool messages

### Modified Files
- `src/lib/agent/forge-agent.ts` - Updated system prompt with shell command docs
- `src/app/api/agent/route.ts` - SSE streaming + agent loop (max 10 iterations)
- `src/components/ForgeDemo.tsx` - Full chat UI replacing URL-only input

## Architecture Decisions

### KV Cache Preservation
Original implementation concatenated messages into a single prompt string, defeating cache:
```typescript
// BAD - destroys message structure
const prompt = messages.map(m => `User: ${m.content}`).join('\n\n');
agent.stream({ prompt });
```

Fixed to use proper message arrays:
```typescript
// GOOD - preserves structure for KV cache
const modelMessages = toModelMessages(messages);
agent.stream({ messages: modelMessages });
```

### Tool Results as User Messages
Since we parse `<shell>` tags from text (not actual SDK tool calls), tool results use `role: 'user'` with `[Shell Output]` prefix. This maintains separate message entries for cache efficiency.

### SSE Event Flow
```
text → tool-call → tool-result → iteration-end → (repeat or done)
```

Frontend accumulates tool results during streaming and renders them on `iteration-end` to avoid race conditions with React state batching.

## Key Patterns

- Agent loop: max 10 iterations to prevent infinite loops
- Messages stored verbatim - never modify assistant output
- Tool results as separate messages appended to history
- Mutable tracking variables in async streaming (not React state)
