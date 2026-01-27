# Backend File Refactoring Plan

**Goal:** Reduce backend files to <300 lines for maintainability.
**Scope:** `db/index.ts` (406), `useForgeChat.ts` (577), `route.ts` (316)

---

## Phase 1: Database Layer Split (`db/index.ts` → 4 files)

**Current:** 406 lines, 14 functions (13 exported + 1 private), 3 interfaces
**Target:** Each file <150 lines

### New Structure:
```
src/lib/db/
├── index.ts           # Barrel re-exports (~40 lines)
├── client.ts          # getDb(), initDb(), generateId() (~120 lines)
├── conversations.ts   # Conversation + Message CRUD (~180 lines)
└── comparisons.ts     # Pinned comparisons CRUD (~100 lines)
```

### File Contents:

**`client.ts`** (~120 lines)
```typescript
import { createClient, type Client } from '@libsql/client';

let db: Client | null = null;

export function getDb(): Client { ... }
export async function initDb(): Promise<void> { ... }  // Creates all 5 tables
export function generateId(): string { ... }  // NOTE: Promoting from private to exported
```

**`conversations.ts`** (~180 lines)
```typescript
import { getDb } from './client';
import type { Message } from '@/lib/messages/transform';  // CRITICAL: Required type import

export interface DbMessage { ... }
export interface Conversation { ... }

export async function createConversation(title: string, mode?: string): Promise<Conversation>
export async function getConversations(): Promise<Conversation[]>
export async function getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] } | null>
export async function updateConversation(id: string, data: Partial<...>): Promise<Conversation | null>
export async function deleteConversation(id: string): Promise<boolean>
export async function saveMessage(conversationId: string, message: Message & { id: string; timestamp: Date }, sequenceOrder: number): Promise<void>
export function hydrateMessage(row: DbMessage): Message  // CRITICAL: Must be exported
```

**`comparisons.ts`** (~100 lines)
```typescript
import { getDb, generateId } from './client';

export interface DbPinnedComparison { ... }

export async function getPinnedComparisons(): Promise<DbPinnedComparison[]>
export async function getPinnedComparison(id: string): Promise<DbPinnedComparison | null>
export async function createPinnedComparison(data: ...): Promise<DbPinnedComparison>
export async function updatePinnedComparison(id: string, name: string): Promise<DbPinnedComparison | null>
export async function deletePinnedComparison(id: string): Promise<boolean>
```

**`index.ts`** (Barrel - explicit exports for backward compatibility)
```typescript
// Client utilities
export { getDb, initDb, generateId } from './client';

// Conversation types and functions
export type { DbMessage, Conversation } from './conversations';
export {
  createConversation,
  getConversations,
  getConversation,
  updateConversation,
  deleteConversation,
  saveMessage,
  hydrateMessage,
} from './conversations';

// Comparison types and functions
export type { DbPinnedComparison } from './comparisons';
export {
  getPinnedComparisons,
  getPinnedComparison,
  createPinnedComparison,
  updatePinnedComparison,
  deletePinnedComparison,
} from './comparisons';
```

### Import Sites (no changes needed - barrel maintains compatibility):
- `src/app/api/conversations/route.ts` → uses `initDb, getConversations, createConversation`
- `src/app/api/conversations/[id]/route.ts` → uses `initDb, getConversation, updateConversation, deleteConversation`
- `src/app/api/conversations/[id]/messages/route.ts` → uses `initDb, saveMessage, getConversation`
- `src/app/api/comparisons/route.ts` → uses `initDb, getPinnedComparisons, createPinnedComparison`
- `src/app/api/comparisons/[id]/route.ts` → uses `initDb, getPinnedComparison, updatePinnedComparison, deletePinnedComparison`
- `src/app/api/skills/route.ts` → uses `initDb`
- `src/app/api/skills/[name]/route.ts` → uses `initDb`
- `src/lib/agent/tools/process-transcript.ts` → uses `getConversation`

---

## Phase 2: SSE Utilities Extraction (`route.ts` + `useForgeChat.ts` → shared)

**Current:** Duplicated SSE logic in both files
**Target:** Reusable SSE utilities

### New Structure:
```
src/lib/sse/
├── index.ts           # Barrel exports (~15 lines)
├── create-stream.ts   # Server-side SSE stream factory (~50 lines)
├── parse-stream.ts    # Client-side SSE parser (~90 lines)
└── constants.ts       # SSE headers (~10 lines)

src/lib/types/sse.ts   # Already exists - keep as-is
```

### File Contents:

**`create-stream.ts`** (~50 lines)
```typescript
import type { SSEEvent } from '@/lib/types/sse';

export interface SSEStreamController {
  stream: ReadableStream<Uint8Array>;
  send: (event: SSEEvent) => void;
  close: () => void;
}

export function createSSEStream(): SSEStreamController {
  // Extracted from route.ts:13-47
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  // ... rest of implementation
}
```

**`parse-stream.ts`** (~90 lines)
```typescript
import type { SSEEvent } from '@/lib/types/sse';

/**
 * Parses an SSE stream from a fetch Response.
 * Handles buffering, line splitting, and JSON parsing.
 *
 * Extracted from useForgeChat.ts:247-254 (stream reading loop)
 * Note: Event handling (lines 255-519) stays in the hook as it mutates React state
 */
export async function parseSSEStream(
  response: Response,
  onEvent: (event: SSEEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event: SSEEvent = JSON.parse(line.slice(6));
          onEvent(event);
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

**`constants.ts`** (~10 lines)
```typescript
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
} as const;

export type SSEHeaders = typeof SSE_HEADERS;
```

**`index.ts`** (Barrel)
```typescript
export { createSSEStream, type SSEStreamController } from './create-stream';
export { parseSSEStream } from './parse-stream';
export { SSE_HEADERS, type SSEHeaders } from './constants';
```

### New Tests:
```
src/lib/sse/__tests__/
├── create-stream.test.ts   # Test stream creation, send, close
└── parse-stream.test.ts    # Test buffering, chunked data, malformed JSON
```

---

## Phase 3: useForgeChat Hook Refactor

**Current:** 577 lines
**Target:** ~280 lines in main hook

**Important:** Frontend `MessagePart` interface is intentionally a flat interface (not discriminated union) for easier UI consumption. This is NOT the same as `@/lib/messages/transform`'s `MessagePart`.

### New Structure:
```
src/hooks/useForgeChat/
├── index.ts             # Re-exports from main hook
├── types.ts             # Frontend-specific types (~50 lines)
├── message-builders.ts  # Message creation utilities (~60 lines)
└── stats-utils.ts       # Stats calculation (~50 lines)

src/hooks/useForgeChat.ts  # Main hook (~280 lines) - imports from above
```

### File Contents:

**`types.ts`** (~50 lines)
```typescript
// Import canonical types from transform layer
import type { MessageStats, AgentIteration, ToolStatus } from '@/lib/messages/transform';

// Re-export for hook consumers
export type { MessageStats, AgentIteration, ToolStatus };

// Frontend-specific types (intentionally different from transform.ts)
export interface MessagePart {
  type: 'text' | 'reasoning' | 'tool' | 'agent-tool' | 'sources';
  content: string;
  command?: string;
  commandId?: string;
  toolStatus?: ToolStatus;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
  sources?: Array<{ id: string; url: string; title: string }>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  timestamp: Date;
  stats?: MessageStats;
  iterations?: AgentIteration[];
  agent?: 'task' | 'skill';
  rawPayload?: unknown[];
}

export interface CumulativeStats {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCachedTokens: number;
  totalReasoningTokens: number;
  totalExecutionTimeMs: number;
  messageCount: number;
  tokensUnavailableCount: number;  // Track when Braintrust stats unavailable
}

export type ChatStatus = 'ready' | 'streaming' | 'error';
export type SandboxStatus = 'disconnected' | 'connected';

export interface UseForgeChatOptions {
  onMessageComplete?: (userMessage: Message, assistantMessage: Message) => void;
  initialMessages?: Message[];
  targetAgent?: 'task' | 'skill';
}
```

**`message-builders.ts`** (~60 lines)
```typescript
import type { Message, MessagePart } from './types';

export function generateMessageId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function createUserMessage(content: string, id?: string): Message {
  return {
    id: id || generateMessageId(),
    role: 'user',
    parts: [{ type: 'text', content }],
    timestamp: new Date(),
  };
}

export function createInitialAssistantMessage(id: string, agent: 'task' | 'skill'): Message {
  return {
    id,
    role: 'assistant',
    parts: [],
    timestamp: new Date(),
    agent,
  };
}

export function finalizeAssistantMessage(
  base: Message,
  parts: MessagePart[],
  stats: MessageStats | undefined,
  iterations: AgentIteration[] | undefined,
  rawPayload: unknown[] | undefined
): Message {
  return { ...base, parts, stats, iterations, rawPayload };
}

export function stripShellTags(text: string): string {
  return text.replace(/<\/?shell>/g, '').replace(/\s+/g, ' ').trim();
}
```

**`stats-utils.ts`** (~50 lines)
```typescript
import type { CumulativeStats, Message } from './types';

export function createEmptyStats(): CumulativeStats {
  return {
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCachedTokens: 0,
    totalReasoningTokens: 0,
    totalExecutionTimeMs: 0,
    messageCount: 0,
    tokensUnavailableCount: 0,
  };
}

export function calculateCumulativeStats(messages: Message[]): CumulativeStats {
  return messages.reduce((acc, msg) => {
    if (msg.stats) {
      return {
        totalPromptTokens: acc.totalPromptTokens + (msg.stats.promptTokens || 0),
        totalCompletionTokens: acc.totalCompletionTokens + (msg.stats.completionTokens || 0),
        totalCachedTokens: acc.totalCachedTokens + (msg.stats.cachedContentTokenCount || 0),
        totalReasoningTokens: acc.totalReasoningTokens + (msg.stats.reasoningTokens || 0),
        totalExecutionTimeMs: acc.totalExecutionTimeMs + (msg.stats.executionTimeMs || 0),
        messageCount: acc.messageCount + 1,
        tokensUnavailableCount: acc.tokensUnavailableCount + (msg.stats.tokensUnavailable ? 1 : 0),
      };
    }
    return acc;
  }, createEmptyStats());
}

export function updateStatsFromUsage(
  current: CumulativeStats,
  usage: { promptTokens?: number; completionTokens?: number; cachedContentTokenCount?: number; reasoningTokens?: number } | null,
  executionTimeMs?: number
): CumulativeStats {
  const tokensUnavailable = usage === null;
  return {
    ...current,
    totalPromptTokens: current.totalPromptTokens + (usage?.promptTokens || 0),
    totalCompletionTokens: current.totalCompletionTokens + (usage?.completionTokens || 0),
    totalCachedTokens: current.totalCachedTokens + (usage?.cachedContentTokenCount || 0),
    totalReasoningTokens: current.totalReasoningTokens + (usage?.reasoningTokens || 0),
    totalExecutionTimeMs: current.totalExecutionTimeMs + (executionTimeMs || 0),
    messageCount: current.messageCount + 1,
    tokensUnavailableCount: current.tokensUnavailableCount + (tokensUnavailable ? 1 : 0),
  };
}
```

**Main hook changes (`useForgeChat.ts`):**
- Import `parseSSEStream` from `@/lib/sse`
- Import builders from `./useForgeChat/message-builders`
- Import stats utils from `./useForgeChat/stats-utils`
- Import types from `./useForgeChat/types`
- `sendMessage()` reduced from ~400 to ~180 lines (event handling stays inline)

---

## Phase 4: API Route Cleanup

**Current:** 316 lines
**Target:** ~250 lines

### Changes:
1. Import `createSSEStream` from `@/lib/sse/create-stream`
2. Import `SSE_HEADERS` from `@/lib/sse/constants`
3. Remove inline `createSSEStream()` function (lines 13-47)

**Result:** -35 lines from extraction, route focuses on agent orchestration.

---

## Implementation Order (with dependencies)

| Step | Task | Depends On | Files Created | Files Modified |
|------|------|------------|---------------|----------------|
| 1 | Create SSE utilities | - | 4 new | 0 |
| 2 | Update route.ts to use SSE utils | Step 1 | 0 | 1 |
| 3 | Create useForgeChat sub-modules | - | 4 new | 0 |
| 4 | Update useForgeChat to use SSE parser + sub-modules | Steps 1, 3 | 0 | 1 |
| 5 | Split db/index.ts | - | 3 new | 1 |
| 6 | Add SSE utility tests | Step 1 | 2 new | 0 |

**Total new files:** 13
**Total modified files:** 3

**Note:** Steps 1, 3, 5 are independent and can be parallelized. Steps 2, 4 depend on their respective extractions.

---

## Verification Plan

### After Each Step:
```bash
pnpm tsc --noEmit  # Type checking
pnpm test          # Existing tests pass
```

### After All Steps - Manual E2E:
1. `pnpm dev` - Start dev server
2. Use Chrome DevTools MCP to verify:
   - Send a chat message → SSE streaming works
   - Execute shell command → Sandbox connects
   - Refresh page → Messages persist (DB works)
   - Check network tab → SSE events flow correctly

### Line Count Targets:
| File | Before | After |
|------|--------|-------|
| db/index.ts | 406 | ~40 (barrel) |
| db/client.ts | - | ~120 |
| db/conversations.ts | - | ~180 |
| db/comparisons.ts | - | ~100 |
| useForgeChat.ts | 577 | ~280 |
| useForgeChat/types.ts | - | ~50 |
| useForgeChat/message-builders.ts | - | ~60 |
| useForgeChat/stats-utils.ts | - | ~50 |
| route.ts | 316 | ~250 |
| sse/create-stream.ts | - | ~50 |
| sse/parse-stream.ts | - | ~90 |
| sse/constants.ts | - | ~10 |

---

## Rollback Strategy

Each step creates new files before modifying existing ones:
1. New files can be deleted
2. Modified files can be reverted via git
3. Barrel exports ensure no breaking changes to import sites

---

## Design Decisions (Resolved)

| Question | Decision | Rationale |
|----------|----------|-----------|
| `hydrateMessage` location | Stay in `conversations.ts` | Depends on `DbMessage` type, DB-layer concern |
| SSE utility tests | Yes, add them | Critical streaming functionality |
| `useForgeChat/types.ts` approach | Import + re-export canonical, define frontend-specific | Maintains type safety while allowing UI-friendly interfaces |
| `generateId` export | Promote to exported | Needed by both `conversations.ts` and `comparisons.ts` |
| Frontend `MessagePart` | Keep separate from `transform.ts` | Intentionally flat for UI ergonomics |
