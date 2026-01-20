# Plan: Wrap Google Native Tools as Custom Tools

**Status:** Implemented
**Date:** 2026-01-19

## Problem

Gemini API limitation: native grounding tools (`googleSearch`, `urlContext`) and custom tools (`shell`) cannot coexist. When both are configured, custom tools fail silently.

## Solution

Wrap native tools as custom tools where each wrapper makes a nested `generateText` call with only that native tool enabled. This allows all three tools to work together.

## Implementation Summary

### 1. Created `src/lib/agent/tools/grounding-tools.ts`

New file with two wrapped tools:

- **`searchTool`** - Wraps `google.tools.googleSearch({})`
  - Input: `{ query: string }`
  - Makes nested generateText call with native googleSearch tool
  - Returns summarized search results as text

- **`analyzeUrlTool`** - Wraps `google.tools.urlContext({})`
  - Input: `{ url: string }`
  - Makes nested generateText call with native urlContext tool
  - Returns URL content summary as text

### 2. Updated `src/lib/agent/task-agent.ts`

- Removed direct `google` import (kept `GoogleGenerativeAIProviderOptions`)
- Added import for wrapped tools
- Updated `taskAgentTools` object:
  ```typescript
  const taskAgentTools = {
    search: searchTool,
    analyze_url: analyzeUrlTool,
    shell: executeShellTool,
  };
  ```
- Updated system prompt to document all three custom tools

### 3. Updated `src/hooks/useForgeChat.ts`

Removed native tool handling that's no longer needed:
- Removed `collectedSources` array
- Removed `extractUrls` helper function
- Removed synthetic URL context tool creation on URL detection
- Removed `source` event handling (lines 382-405)
- Removed done event's source collection handling

### 4. Updated `src/components/ChatMessage.tsx`

Simplified `AgentToolPart` component:
- Changed tool name checks from `google:google_search` → `search`
- Changed `google:url_context` → `analyze_url`
- Updated display names: "Search", "Analyze URL"
- Removed special sources list rendering
- Now renders search/analyze_url results as markdown

## Files Modified

| File | Action |
|------|--------|
| `src/lib/agent/tools/grounding-tools.ts` | Created |
| `src/lib/agent/task-agent.ts` | Modified |
| `src/hooks/useForgeChat.ts` | Modified |
| `src/components/ChatMessage.tsx` | Modified |

## Verification

1. Run tests: `pnpm test`
2. Manual test: Run a task that uses both search and shell
   - Example: "Search for Stripe API docs and create a test script"
3. Verify:
   - `shell` tool executes successfully
   - `search` shows as collapsible tool with markdown results
   - `analyze_url` works for webpages/videos
   - All three tools can be used in the same conversation
