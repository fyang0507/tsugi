# Model Provider Selection

Last Updated: 2026-01-17

## Overview

Implemented environment-based AI provider selection to support both direct Google Generative AI access and Vercel AI Gateway routing. Also added graceful degradation for Braintrust observability.

## Architecture

**Provider Selection Logic** (`model-provider.ts`):
```
GOOGLE_GENERATIVE_AI_API_KEY set → Direct mode (instantiated models)
AI_GATEWAY_API_KEY set          → Gateway mode (string IDs)
Neither set                     → Throw error
```

**Key Insight**: Gateway and direct modes require different model formats:
- Gateway: `Agent({model: 'google/gemini-3-pro-preview'})` - string
- Direct: `Agent({model: google('gemini-3-pro-preview')})` - instantiated

**Braintrust Wrapper** (`braintrust-wrapper.ts`):
- If `BRAINTRUST_API_KEY` + `PROJECT_NAME` present → wrap AI SDK with tracing
- If missing → warn to console, return unwrapped SDK (app continues working)

## Files Changed

**New Files**:
- `src/lib/agent/model-provider.ts` - Cached provider config with `getGoogleProvider()`, `getProModel()`, `getFlashModel()`
- `src/lib/agent/braintrust-wrapper.ts` - `getWrappedAI()`, `getAgent()`, `getGenerateText()`

**Updated Files**:
- `task-agent.ts` - Removed direct ai/braintrust imports, uses new modules
- `skill-agent.ts` - Same refactor
- `process-transcript.ts` - Uses `getFlashModel()` and `getGenerateText()`

## API

```typescript
// model-provider.ts exports
getGoogleProvider(): GoogleGenerativeAIProvider  // For tools like googleSearch
getProModel(): string | LanguageModel            // Returns appropriate type for mode
getFlashModel(): string | LanguageModel          // Same pattern

// braintrust-wrapper.ts exports
getWrappedAI(): typeof ai                        // Full AI SDK (wrapped or not)
getAgent(): typeof Experimental_Agent            // Agent class
getGenerateText(): typeof generateText           // For non-agent generation
```

## Testing

All 81 tests pass. TypeScript check passes with no errors.
