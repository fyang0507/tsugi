# KV Cache Iteration Fix

Last Updated: 2026-01-07

## Problem

Multi-turn conversations with tool execution were corrupted on the second turn. The server sends `raw-content` for EACH iteration, but the client was overwriting the value each time, keeping only the last iteration's content.

Example failure (observed in Langfuse traces):
```
Turn 1: User asks to learn from video
  - Iteration 1: Video summary + skill set command
  - Iteration 2: "I have successfully learned..."

Turn 2: User says "too long"
  - API receives: Assistant="I have successfully learned..." (missing summary!)
  - Tool output appears AFTER final text (wrong order)
```

## Root Cause

The `rawContentRef` was overwritten on each `raw-content` event. Only iteration 2's content was saved, losing iteration 1's video summary entirely.

## Solution

Changed from flat `rawContent`/`toolOutputs` to an `iterations` array that properly tracks each agentic loop cycle.

### Data Model Change

```typescript
export interface AgentIteration {
  rawContent: string;       // Model output for this iteration
  toolOutput?: string;      // Tool output that follows (if any)
}

export interface Message {
  // ...
  iterations?: AgentIteration[];  // For assistant messages
}
```

### Event Handling Change

- `raw-content`: Creates NEW iteration (push to array)
- `tool-output`: Attaches to LAST iteration

### API Message Builder Change

Expands iterations to match server's conversation structure:
```typescript
for (const iter of m.iterations) {
  apiMessages.push({ role: 'assistant', content: iter.rawContent });
  if (iter.toolOutput) {
    apiMessages.push({ role: 'user', content: `[Shell Output]\n${iter.toolOutput}` });
  }
}
```

## Files Changed

- `src/hooks/useForgeChat.ts`: Added AgentIteration interface, iterations tracking, fixed apiMessages builder
- `src/app/api/agent/route.ts`: Already sending raw-content/tool-output events (from phase1 implementation)

## Testing

Verify with multi-iteration conversation:
1. Ask agent to learn from a video (triggers skill set)
2. Send follow-up "too long, shorten it"
3. Check Langfuse trace shows correct message order with full content preserved
