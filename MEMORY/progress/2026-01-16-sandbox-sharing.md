# Sandbox Sharing Between TaskAgent and SkillAgent

Last Updated: 2026-01-16

## Problem

TaskAgent and SkillAgent run in separate HTTP requests. In serverless (Vercel), each request = fresh memory = new sandbox. SkillAgent couldn't access files created by TaskAgent.

## Solution

Pass sandbox ID between requests using `@vercel/sandbox` SDK's `Sandbox.get({ sandboxId })` reconnection feature.

## Implementation

### Interface Changes (`executor.ts`)
- Added `getSandboxId(): string | null` to `SandboxExecutor` interface
- Updated `getSandboxExecutor(sandboxId?)` to accept optional ID for reconnection

### Vercel Executor (`vercel-executor.ts`)
- Constructor accepts `existingSandboxId` parameter
- `ensureSandbox()` uses `Sandbox.get()` when reconnecting, `Sandbox.create()` for new
- `getSandboxId()` returns `sandbox?.sandboxId`

### Local Executor (`local-executor.ts`)
- Sandbox ID determines directory: `.sandbox/{sandboxId}`
- Default ID: `'default'`

### API Route (`route.ts`)
- Accepts `sandboxId` in request body
- Emits `sandbox_created` SSE event with ID after first shell command
- Uses `sandboxIdEmitted` flag to prevent duplicates

### Frontend Hook (`useForgeChat.ts`)
- `currentSandboxId` state tracks active sandbox
- Handles `sandbox_created` event to capture ID
- Passes `sandboxId` in subsequent requests
- Clears on conversation clear or sandbox timeout

## Flow

```
Request 1: TaskAgent → creates sandbox → emits sandbox_created → frontend stores ID
Request 2: SkillAgent → sends sandboxId → Sandbox.get() reconnects → same files accessible
```

## Files Modified

- `src/lib/sandbox/executor.ts`
- `src/lib/sandbox/vercel-executor.ts`
- `src/lib/sandbox/local-executor.ts`
- `src/app/api/agent/route.ts`
- `src/hooks/useForgeChat.ts`
- `src/lib/sandbox/__tests__/vercel-executor.test.ts` (test signature fix)
