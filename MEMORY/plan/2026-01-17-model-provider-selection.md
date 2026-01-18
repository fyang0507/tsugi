# Plan: Model Provider Selection by Environment Variable

## Summary

Add environment-based configuration for:
1. **AI Provider Selection**: `GOOGLE_GENERATIVE_AI_API_KEY` → Direct Google AI, else `AI_GATEWAY_API_KEY` → Vercel Gateway, else error
2. **Braintrust Observability**: If `BRAINTRUST_API_KEY` or `PROJECT_NAME` missing → warn and skip wrapper

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/agent/model-provider.ts` | **NEW** - Provider selection logic |
| `src/lib/agent/braintrust-wrapper.ts` | **NEW** - Conditional Braintrust wrapper |
| `src/lib/agent/task-agent.ts` | Use new modules |
| `src/lib/agent/skill-agent.ts` | Use new modules |
| `src/lib/agent/tools/process-transcript.ts` | Use new modules |
| `.env.example` | Document env var options |

## Implementation

### 1. Create `src/lib/agent/model-provider.ts`

```typescript
import { google as defaultGoogle, createGoogleGenerativeAI } from '@ai-sdk/google';
import type { GoogleGenerativeAIProvider } from '@ai-sdk/google';

const MODEL_NAMES = {
  direct: { pro: 'gemini-3-pro-preview', flash: 'gemini-3-flash' },
  gateway: { pro: 'google/gemini-3-pro-preview', flash: 'google/gemini-3-flash' },
} as const;

type ProviderMode = 'direct' | 'gateway';

interface ModelConfig {
  provider: GoogleGenerativeAIProvider;
  mode: ProviderMode;
  models: { pro: string; flash: string };
}

let cachedConfig: ModelConfig | null = null;

function getModelConfig(): ModelConfig {
  if (cachedConfig) return cachedConfig;

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    cachedConfig = {
      provider: createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY }),
      mode: 'direct',
      models: MODEL_NAMES.direct,
    };
    return cachedConfig;
  }

  if (process.env.AI_GATEWAY_API_KEY) {
    cachedConfig = {
      provider: defaultGoogle,
      mode: 'gateway',
      models: MODEL_NAMES.gateway,
    };
    return cachedConfig;
  }

  throw new Error(
    'No AI provider configured. Set GOOGLE_GENERATIVE_AI_API_KEY or AI_GATEWAY_API_KEY.'
  );
}

export function getGoogleProvider(): GoogleGenerativeAIProvider {
  return getModelConfig().provider;
}

export function getProModel(): string {
  return getModelConfig().models.pro;
}

export function getFlashModel(): string {
  return getModelConfig().models.flash;
}
```

### 2. Create `src/lib/agent/braintrust-wrapper.ts`

```typescript
import * as ai from "ai";
import { initLogger, wrapAISDK } from "braintrust";

let initialized = false;
let wrappedAI: typeof ai | null = null;

function initBraintrust(): typeof ai {
  if (wrappedAI) return wrappedAI;

  const apiKey = process.env.BRAINTRUST_API_KEY;
  const projectName = process.env.PROJECT_NAME;

  if (!apiKey || !projectName) {
    const missing = [
      !apiKey && 'BRAINTRUST_API_KEY',
      !projectName && 'PROJECT_NAME',
    ].filter(Boolean).join(', ');

    console.warn(
      `[braintrust] Missing env vars: ${missing}. Observability tracing disabled.`
    );
    wrappedAI = ai; // Return unwrapped AI SDK
    return wrappedAI;
  }

  if (!initialized) {
    initLogger({ projectName, apiKey });
    initialized = true;
  }

  wrappedAI = wrapAISDK(ai) as typeof ai;
  return wrappedAI;
}

export function getWrappedAI() {
  return initBraintrust();
}

export function getAgent() {
  const sdk = initBraintrust();
  return (sdk as any).Experimental_Agent;
}

export function getGenerateText() {
  const sdk = initBraintrust();
  return sdk.generateText;
}
```

### 3. Update `task-agent.ts`

```diff
- import * as ai from "ai";
- import { google, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
- import { initLogger, wrapAISDK } from "braintrust";
+ import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
+ import { getGoogleProvider, getProModel } from './model-provider';
+ import { getAgent } from './braintrust-wrapper';

- initLogger({
-   projectName: "skill-forge-agent",
-   apiKey: process.env.BRAINTRUST_API_KEY,
- });

- const { Experimental_Agent: Agent } = wrapAISDK(ai);

function createTaskAgent() {
+  const Agent = getAgent();
+  const google = getGoogleProvider();
   return new Agent({
-    model: 'google/gemini-3-pro-preview',
+    model: getProModel(),
     // ... rest unchanged
   });
}
```

### 4. Update `skill-agent.ts`

```diff
- import * as ai from "ai";
- import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
- import { initLogger, wrapAISDK } from "braintrust";
+ import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
+ import { getProModel } from './model-provider';
+ import { getAgent } from './braintrust-wrapper';

- initLogger({
-   projectName: "skill-forge-agent",
-   apiKey: process.env.BRAINTRUST_API_KEY,
- });

- const { Experimental_Agent: Agent } = wrapAISDK(ai);

function createSkillAgent() {
+  const Agent = getAgent();
   return new Agent({
-    model: 'google/gemini-3-pro-preview',
+    model: getProModel(),
     // ... rest unchanged
   });
}
```

### 5. Update `tools/process-transcript.ts`

```diff
- import * as ai from "ai";
- import { initLogger, wrapAISDK } from "braintrust";
+ import { getFlashModel } from '../model-provider';
+ import { getGenerateText } from '../braintrust-wrapper';

- initLogger({
-   projectName: "skill-forge-agent",
-   apiKey: process.env.BRAINTRUST_API_KEY,
- });

- const { generateText } = wrapAISDK(ai);

export async function processTranscript(...) {
+  const generateText = getGenerateText();
   const generated = await generateText({
-    model: 'google/gemini-3-flash',
+    model: getFlashModel(),
     prompt,
   });
   // ...
}
```

### 6. Update `.env.example`

```bash
# AI Provider (set ONE of these)
# Option 1: Direct Google Generative AI
GOOGLE_GENERATIVE_AI_API_KEY=

# Option 2: Vercel AI Gateway
AI_GATEWAY_API_KEY=

# Braintrust Observability (optional - both required for tracing)
BRAINTRUST_API_KEY=
PROJECT_NAME=skill-forge-agent
```

## Verification

1. **AI Provider - Direct**: Set only `GOOGLE_GENERATIVE_AI_API_KEY`, verify agent works
2. **AI Provider - Gateway**: Set only `AI_GATEWAY_API_KEY`, verify agent works
3. **AI Provider - None**: Remove both, verify error thrown
4. **Braintrust - Enabled**: Set both `BRAINTRUST_API_KEY` and `PROJECT_NAME`, verify no warning
5. **Braintrust - Disabled**: Remove one var, verify warning logged and app still works
6. **Run `pnpm test`**: Ensure existing tests pass
