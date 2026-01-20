# Braintrust-Based Token Stats

**Issue**: #17 - Cumulative Stats: Should factor in Tool LLM usage as well

## Problem

Current token stats tracking accumulates from `step-finish` events in [route.ts](../../src/app/api/agent/route.ts), but this misses nested LLM calls from tools:
- `searchTool` → makes `generateText()` call with Gemini Flash
- `analyzeUrlTool` → makes `generateText()` call with Gemini Flash
- `processTranscript` → makes `generateText()` call for summarization

## Solution

Replace step-finish accumulation with Braintrust API lookup. The `wrapAISDK()` wrapper already traces ALL `generateText()` calls → query Braintrust for complete stats at end of each turn.

**Data available**:
- `prompt_tokens`, `completion_tokens`, `tokens`
- `prompt_cached_tokens` (cache reads)
- Estimated LLM cost (auto-calculated)

---

## Implementation

### Step 1: Create BTQL Client

**New file**: `src/lib/braintrust-api.ts`

```typescript
interface TraceStats {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
}

export async function fetchTraceStats(rootSpanId: string): Promise<TraceStats | null> {
  const apiKey = process.env.BRAINTRUST_API_KEY;
  const projectName = process.env.PROJECT_NAME;

  if (!apiKey || !projectName) return null;

  try {
    const query = `
      SELECT
        COALESCE(SUM(metrics.prompt_tokens), 0) as prompt_tokens,
        COALESCE(SUM(metrics.completion_tokens), 0) as completion_tokens,
        COALESCE(SUM(metrics.prompt_cached_tokens), 0) as cached_tokens
      FROM project_logs('${projectName}', shape => 'spans')
      WHERE root_span_id = '${rootSpanId}'
    `;

    const response = await fetch('https://api.braintrust.dev/btql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, fmt: 'json' }),
    });

    if (!response.ok) {
      console.error('[Braintrust] BTQL query failed:', response.status);
      return null;
    }

    const data = await response.json();
    return parseStats(data);
  } catch (error) {
    console.error('[Braintrust] Failed to fetch stats:', error);
    return null;
  }
}
```

### Step 2: Modify Agent Route

**File**: `src/app/api/agent/route.ts`

1. Import `traced`, `flush` from braintrust SDK
2. Wrap agent execution to capture `rootSpanId`
3. After streaming, flush and fetch stats
4. Remove step-finish accumulation logic

```typescript
import { traced, flush } from 'braintrust';
import { fetchTraceStats } from '@/lib/braintrust-api';

// Wrap agent execution
const rootSpanId = await traced(
  { name: `agent-turn-${conversationId}` },
  async (span) => {
    // ... existing streaming code ...
    return span.rootSpanId;
  }
);

// After streaming completes
await flush();
const stats = await fetchTraceStats(rootSpanId);

// Send stats (may be null if Braintrust unavailable)
send({
  type: 'usage',
  usage: stats ? {
    promptTokens: stats.promptTokens,
    completionTokens: stats.completionTokens,
    cachedContentTokenCount: stats.cachedTokens,
  } : null,  // null signals "unavailable" to frontend
  executionTimeMs,
  agent: mode === 'codify-skill' ? 'skill' : 'task',
});
```

### Step 3: Frontend Graceful Degradation

**File**: `src/hooks/useForgeChat.ts` and stats display components

When `usage` is `null`:
- Still display latency (measured at backend)
- Show hint: "Token stats unavailable (observability service unreachable)"
- Don't accumulate zeros into cumulative stats

```typescript
case 'usage': {
  if (event.usage) {
    // Normal case: accumulate stats
    messageStats = {
      promptTokens: (messageStats.promptTokens || 0) + (event.usage.promptTokens || 0),
      // ...
    };
  } else {
    // Braintrust unavailable: mark as unavailable
    messageStats = {
      ...messageStats,
      tokensUnavailable: true,
    };
  }
  // Always track execution time
  messageStats.executionTimeMs = (messageStats.executionTimeMs || 0) + (event.executionTimeMs || 0);
  break;
}
```

**UI Display**:
- If `tokensUnavailable`: show "— tokens" or tooltip explaining why
- Always show latency since that's backend-measured

---

## Files to Modify

| File | Action |
|------|--------|
| `src/lib/braintrust-api.ts` | **Create** - BTQL client |
| `src/app/api/agent/route.ts` | **Modify** - Replace step-finish with Braintrust lookup |
| `src/hooks/useForgeChat.ts` | **Modify** - Handle null usage gracefully |
| `src/components/MessageStats.tsx` | **Modify** - Show "unavailable" hint when tokens missing |

---

## Verification

1. **Happy path**: Run conversation with tools, verify complete token count
2. **Fallback path**: Disable `BRAINTRUST_API_KEY`, verify latency still shows with "unavailable" hint
3. **Compare**: Check Braintrust UI trace matches returned stats

---

## Why Braintrust Works

- `wrapAISDK()` already traces all `generateText()` calls including nested tool usage
- Brainstore provides immediate consistency after flush (no warehouse delay)
- BTQL allows SQL aggregation across all spans in a trace by `root_span_id`
