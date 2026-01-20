# Progress: Wrap Native Tools as Custom Tools

Last Updated: 2026-01-19

## Problem Solved

Gemini API limitation: native grounding tools (`googleSearch`, `urlContext`) and custom tools (`shell`) cannot coexist. When both configured, custom tools fail silently.

## Implementation

Created wrapper pattern where each grounding tool makes a nested `generateText` call with only that native tool enabled:

```typescript
// grounding-tools.ts
export const searchTool = {
  execute: async ({ query }) => {
    const result = await generateText({
      model: getFlashModel(),
      tools: { googleSearch: google.tools.googleSearch({}) },
      prompt: `Search the web for: "${query}..."`,
    });
    return result.text || 'No results found.';
  },
};
```

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `src/lib/agent/tools/grounding-tools.ts` | +55 | New file with `searchTool` and `analyzeUrlTool` |
| `src/lib/agent/task-agent.ts` | -20 | Replaced native tools with wrapped versions |
| `src/hooks/useForgeChat.ts` | -70 | Removed native tool event handling |
| `src/components/ChatMessage.tsx` | -12 | Simplified tool name checks |
| `src/lib/agent/skill-agent.ts` | +1 | Step limit 10→100 |

## Key Decisions

1. **Nested API calls**: Each tool wrapper makes its own `generateText` call - adds latency but solves compatibility
2. **Removed source collection**: Native tools returned structured sources; wrappers return summarized text
3. **Step limit bump**: Increased from 10 to 100 to allow longer multi-step tasks

## Verification

- [ ] `pnpm test` passes
- [ ] Task using both `search` and `shell` works
- [ ] `analyze_url` processes URLs correctly
