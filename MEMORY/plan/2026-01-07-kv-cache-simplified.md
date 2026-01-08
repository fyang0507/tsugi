# Phase 1: KV Cache Fix (Simplified Approach)

## Goal
Fix message reconstruction so Gemini's implicit KV cache works correctly.

## Problem
Client reconstructs assistant messages differently than model output:
- Model outputs: `"Let me check...<shell>skill list</shell>"`
- Client reconstructs: `"Let me check...[Shell Output]\n$ skill list\n...output..."`

This breaks KV cache prefix matching between requests.

## Solution
Add `rawContent` field to Message type. Use it for API calls instead of reconstructing from parts.

## Changes

### 1. `src/hooks/useForgeChat.ts`

**Update Message interface (line 32):**
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  rawContent: string;          // ADD: Exact content for API
  timestamp: Date;
  stats?: MessageStats;
}
```

**Update SSEEvent interface (line 42):**
```typescript
interface SSEEvent {
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-result' |
        'agent-tool-call' | 'agent-tool-result' | 'source' |
        'iteration-end' | 'done' | 'error' | 'usage' |
        'raw-content' | 'tool-output';  // ADD these two
  // ... existing fields
  rawContent?: string;         // ADD: Full assistant output
  toolOutput?: string;         // ADD: Formatted tool results
}
```

**Update apiMessages construction (lines 105-108):**
```typescript
// Before:
const apiMessages = [...messages, userMessage].map((m) => ({
  role: m.role,
  content: m.parts.map((p) => ...).join(''),  // BAD: reconstructs
}));

// After:
const apiMessages = [...messages, userMessage].map((m) => ({
  role: m.role,
  content: m.rawContent,  // GOOD: exact content
}));
```

**Update user message creation (lines 97-102):**
```typescript
const userMessage: Message = {
  id: generateId(),
  role: 'user',
  parts: [{ type: 'text', content }],
  rawContent: content,  // ADD: user content is already raw
  timestamp: new Date(),
};
```

**Add rawContent ref and handle new events:**
```typescript
// Add ref to track raw content
const rawContentRef = useRef<string>('');

// In SSE event handler, add cases:
case 'raw-content':
  rawContentRef.current = event.rawContent || '';
  break;

case 'tool-output':
  // Tool results become synthetic user messages for the trace
  // We need to add these to messages array for next API call
  // Store for later processing
  break;
```

**On 'done' event, include rawContent:**
```typescript
case 'done': {
  // ... existing finalization code ...

  setMessages((prev) =>
    prev.map((m) =>
      m.id === assistantId
        ? { ...m, parts: finalParts, stats: finalStats, rawContent: rawContentRef.current }
        : m
    )
  );

  // Reset for next message
  rawContentRef.current = '';
  break;
}
```

**Handle tool outputs - Expand when building API messages:**

Tool outputs are displayed as collapsible parts within the assistant message (current UI). But for the API, they need to be separate user-role messages to match the server's `toModelMessages()` format.

Store tool outputs on the assistant message and expand when building apiMessages:

```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  rawContent: string;
  timestamp: Date;
  stats?: MessageStats;
  toolOutputs?: string[];  // ADD: Tool outputs that follow this message (for API expansion)
}
```

When building apiMessages, expand assistant messages:
```typescript
const apiMessages: Array<{role: string, content: string}> = [];
for (const m of [...messages, userMessage]) {
  apiMessages.push({ role: m.role, content: m.rawContent });
  // Expand tool outputs as user messages (matches server's toModelMessages)
  if (m.toolOutputs) {
    for (const output of m.toolOutputs) {
      apiMessages.push({ role: 'user', content: `[Shell Output]\n${output}` });
    }
  }
}
```

### 2. `src/app/api/agent/route.ts`

**Update SSEEvent interface (line 13):**
```typescript
interface SSEEvent {
  type: 'text' | 'reasoning' | 'tool-call' | 'tool-result' |
        'agent-tool-call' | 'agent-tool-result' | 'source' |
        'iteration-end' | 'done' | 'error' | 'usage' |
        'raw-content' | 'tool-output';  // ADD
  // ... existing fields
  rawContent?: string;
  toolOutput?: string;
}
```

**Send raw-content after streaming completes (after line 152):**
```typescript
// After the fullStream loop, send the complete raw output
send({ type: 'raw-content', rawContent: fullOutput });
```

**Send tool-output after executing commands (after line 206):**
```typescript
// After creating toolMessage, send it to client
send({ type: 'tool-output', toolOutput: toolMessage.content });
```

### 3. `src/hooks/useForgeChat.ts` - Event Handling

**Track tool outputs during streaming:**
```typescript
// Add ref to collect tool outputs for current assistant message
const toolOutputsRef = useRef<string[]>([]);

// Handle tool-output event:
case 'tool-output':
  toolOutputsRef.current.push(event.toolOutput || '');
  break;

// On 'done', include toolOutputs in the message:
case 'done': {
  // ... existing finalization ...

  setMessages((prev) =>
    prev.map((m) =>
      m.id === assistantId
        ? {
            ...m,
            parts: finalParts,
            stats: finalStats,
            rawContent: rawContentRef.current,
            toolOutputs: toolOutputsRef.current.length > 0 ? [...toolOutputsRef.current] : undefined,
          }
        : m
    )
  );

  // Reset refs for next message
  rawContentRef.current = '';
  toolOutputsRef.current = [];
  break;
}
```

### 3. `src/components/ForgeDemo.tsx`

No changes needed - tool outputs continue to render as collapsible parts within the assistant message.

## Implementation Order

1. Update SSEEvent types in both files (add `raw-content`, `tool-output`)
2. Add `rawContent` and `toolOutputs` to Message interface
3. Send `raw-content` event from server after streaming
4. Send `tool-output` event from server after command execution
5. Handle new events in client (store in refs)
6. On 'done', save rawContent and toolOutputs to message
7. Update apiMessages builder to expand toolOutputs as user messages
8. Test KV cache with console logs

## Testing

1. Start conversation with shell command trigger (e.g., "list my skills")
2. Check server logs for `[Cache Debug]` - verify `cacheReadTokens` > 0 on iteration 2+
3. Send follow-up message - verify cache utilization increases
4. Verify UI still renders correctly (tool outputs as collapsible parts)

## Success Criteria

- [] `cacheReadTokens` shows non-zero on subsequent iterations
- [ ] Multi-turn conversations show cache hits (needs testing after iteration fix)
- [x] UI renders correctly (no visual regression)
- [x] Shell commands still execute properly
- [x] Tool outputs display as collapsible components

## Update 2026-01-07: Iteration Fix

Original implementation had a bug: `rawContentRef` was overwritten on each `raw-content` event, losing earlier iterations. Fixed by changing to `iterations` array that properly tracks each agentic loop cycle. See `../2026-01-07-kv-cache-iteration-fix.md` for details.

## Compatibility Notes

**Grounding (google_search):** Compatible - sources are metadata, not message content. They flow through `source` events and display in UI parts. `rawContent` contains only text.

**URL Context:** Compatible - URLs are plain text in user messages. Gemini processes them transparently. No special handling needed.
