# Message Type Consolidation Plan

**Created:** 2026-01-26
**Status:** Completed

## Problem

Three nearly-identical message types with duplicated definitions across files:

| File | Types Defined |
|------|---------------|
| `transform.ts` | `UIMessage`, `DBMessage`, `MessagePart`, `AgentIteration` |
| `useForgeChat.ts` | `Message`, `MessagePart`, `AgentIteration` (duplicates!) |
| `db/index.ts` | `DbMessage` (DB row, different purpose) |

**Issues:**
1. `UIMessage` and `DBMessage` differ only by optional `id` field
2. `useForgeChat.ts` re-defines the same types locally
3. `db/index.ts` imports `Message` from `useForgeChat.ts` (should import from transform.ts)
4. Inconsistencies: `UIMessage.parts?` (optional) vs `Message.parts` (required)

## Solution

Single canonical `Message` type in `transform.ts` with optional fields. Delete all duplicates.

## Unified Type Design

```typescript
// transform.ts - Single source of truth

export interface Message {
  id?: string;                    // Required in frontend, absent in wire format
  role: 'user' | 'assistant';
  rawContent: string;
  parts?: MessagePart[];
  iterations?: AgentIteration[];
  // Runtime fields (populated in frontend, not in wire format)
  timestamp?: Date;
  stats?: MessageStats;
  agent?: 'task' | 'skill';
  rawPayload?: unknown[];
}

// MessageStats moved from useForgeChat.ts
export interface MessageStats {
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  executionTimeMs?: number;
  tokensUnavailable?: boolean;
}

// MessagePart - keep discriminated union, add toolStatus for streaming
export type MessagePart =
  | { type: 'text'; content: string; toolStatus?: ToolStatus }
  | { type: 'reasoning'; content: string }
  | {
      type: 'tool';
      command: string;
      commandId: string;
      content: string;
      toolStatus?: ToolStatus;
    }
  | {
      type: 'agent-tool';
      toolName: string;
      toolArgs: Record<string, unknown>;
      toolCallId: string;
      content: string;
      toolStatus?: ToolStatus;
    }
  | {
      type: 'sources';
      sources: Array<{ id: string; url: string; title: string }>;
    };

export type ToolStatus = 'queued' | 'running' | 'completed';

// AgentIteration - unchanged
export interface AgentIteration {
  rawContent: string;
  toolOutput?: string;
}
```

## Implementation Steps

### 1. Update transform.ts

- Add `MessageStats` interface (move from useForgeChat.ts)
- Add `ToolStatus` type
- Add `toolStatus` to relevant MessagePart variants
- Rename/merge types:
  - Delete `UIMessage`
  - Delete `DBMessage`
  - Create unified `Message` (combining all fields from both + useForgeChat's extras)
- Update `toModelMessages()`: change parameter from `Array<DBMessage | UIMessage>` to `Message[]`
- Update `toTranscriptString()`: change parameter from `DBMessage[]` to `Message[]`

### 2. Update useForgeChat.ts

Delete local type definitions and import from transform.ts:

```typescript
// Before
export interface MessagePart { ... }
export interface MessageStats { ... }
export interface AgentIteration { ... }
export interface Message { ... }

// After
import {
  type Message,
  type MessagePart,
  type MessageStats,
  type AgentIteration,
  partsToIteration,
} from '@/lib/messages/transform';

// Re-export for consumers that import from useForgeChat
export type { Message, MessagePart, MessageStats, AgentIteration };
```

Also export `CumulativeStats` (stays local, it's UI-specific aggregation).

### 3. Update db/index.ts

Change import source:

```typescript
// Before
import type { Message } from '@/hooks/useForgeChat';

// After
import type { Message } from '@/lib/messages/transform';
```

Update `saveMessage` signature for type safety:

```typescript
// Require id and timestamp for saving (frontend always provides these)
export async function saveMessage(
  conversationId: string,
  message: Message & { id: string; timestamp: Date },
  sequenceOrder: number
): Promise<void>
```

### 4. Update process-transcript.ts

```typescript
// Before
import { toTranscriptString, type DBMessage } from '@/lib/messages/transform';
const rawTranscript = toTranscriptString(result.messages as DBMessage[]);

// After
import { toTranscriptString, type Message } from '@/lib/messages/transform';
const rawTranscript = toTranscriptString(result.messages as Message[]);
```

### 5. Update test-transcript-transform.ts

```typescript
// Before
import { toTranscriptString, type DBMessage } from '@/lib/messages/transform';

// After
import { toTranscriptString, type Message } from '@/lib/messages/transform';
```

### 6. Update route.ts

```typescript
// Before
import { toModelMessages, type DBMessage, type UIMessage } from '@/lib/messages/transform';
messages: Array<DBMessage | UIMessage>;

// After
import { toModelMessages, type Message } from '@/lib/messages/transform';
messages: Message[];
```

### 7. Update ChatMessage.tsx (if needed)

Check if it imports types from useForgeChat - may need to update import path or use re-exports.

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/messages/transform.ts` | Consolidate types, add MessageStats, ToolStatus |
| `src/hooks/useForgeChat.ts` | Delete local types, import from transform.ts, re-export |
| `src/lib/db/index.ts` | Change import source |
| `src/app/api/agent/route.ts` | Simplify type annotations |
| `src/lib/agent/tools/process-transcript.ts` | Update type import |
| `scripts/test-transcript-transform.ts` | Update type import |

## Type Safety Considerations

1. **Optional `parts` field**: Frontend always provides parts, but wire format may omit. Functions that require parts should accept `Message & { parts: MessagePart[] }`.

2. **Optional `id` field**: Frontend always has id, wire format may not. `saveMessage` requires `Message & { id: string; timestamp: Date }`.

3. **Re-exports from useForgeChat**: Components importing from useForgeChat continue to work via re-exports.

## Verification

1. `pnpm tsc --noEmit` - Type check passes
2. `pnpm test` - All tests pass
3. `pnpm dev` - App loads and works correctly
4. Test conversation save/load cycle
5. Test message transformation for model calls
