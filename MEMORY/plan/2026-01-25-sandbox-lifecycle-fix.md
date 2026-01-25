# Sandbox Lifecycle Fix Plan

**Issue:** In deployment, when a conversation is aborted (sandbox terminated) but a subsequent new conversation starts, no new sandbox is initialized, causing commands to hang at "running..." indefinitely.

**Date:** 2026-01-25

---

## Problem Statement

Users see commands stuck at "running..." with no feedback when:
1. A previous conversation was aborted (Stop button clicked)
2. A new conversation is started or a new message is sent

The sandbox was terminated but the UI still holds a stale `sandboxId`, causing reconnection attempts to a dead sandbox.

---

## Root Cause Analysis

### Flow When Abort Occurs

1. User clicks **Stop** button → `abortControllerRef.current.abort()` in `useForgeChat.ts:542-547`
2. Server detects abort → `req.signal.addEventListener('abort')` in `route.ts:113-115`
3. Server cleans up sandbox → `clearSandboxExecutor()` in `route.ts:323-329`
4. Sandbox is stopped via `sandbox.stop()` in `vercel-executor.ts:183-189`
5. **BUG:** No SSE event is emitted to notify frontend
6. Frontend's `currentSandboxId` state **persists** with the dead sandbox ID

### Flow When New Message Sent

1. Frontend sends POST to `/api/agent` with `sandboxId: currentSandboxId` (stale)
2. `getSandboxExecutor(sandboxId)` creates new `VercelSandboxExecutor` with `existingSandboxId`
3. `ensureSandbox()` calls `Sandbox.get({ sandboxId })` - returns reference to dead sandbox
4. **BUG:** No validation that sandbox is actually alive
5. `sandbox.runCommand()` hangs or fails silently
6. Commands show "running..." forever

### Additional Issue: Conversation Switch

When switching conversations via `handleSelectConversation()` in `TsugiChat.tsx:360-375`:
- `currentSandboxId` is **not cleared**
- Different conversations should have isolated sandboxes
- Stale sandbox from previous conversation causes issues

---

## Affected Files

| File | Purpose |
|------|---------|
| `src/app/api/agent/route.ts` | SSE streaming endpoint, sandbox cleanup on abort |
| `src/lib/sandbox/vercel-executor.ts` | Vercel sandbox implementation |
| `src/lib/sandbox/executor.ts` | Sandbox interface and factory |
| `src/hooks/useForgeChat.ts` | Frontend chat state, sandbox ID tracking |
| `src/components/SandboxTimeoutBanner.tsx` | Existing timeout notification (can be extended) |

---

## Implementation Plan

### 1. Define Sandbox Status Event Model

Replace the existing `sandbox_created` event with a cleaner two-state model:

| Event | Meaning | Payload |
|-------|---------|---------|
| `sandbox_active` | Sandbox is ready and connected | `{ sandboxId: string }` |
| `sandbox_terminated` | Sandbox is no longer available | `{ reason?: string }` |

**File:** `src/app/api/agent/route.ts` - Update SSEEvent type (line 13):

Replace `'sandbox_created'` with `'sandbox_active' | 'sandbox_terminated'` in the type union.

**File:** `src/hooks/useForgeChat.ts` - Update SSEEvent interface (line 58):

Same change - replace `'sandbox_created'` with `'sandbox_active' | 'sandbox_terminated'`.

### 2. Emit `sandbox_active` When Sandbox is Ready

**File:** `src/app/api/agent/route.ts`

Change the existing `sandbox_created` emission (lines 194-200) to `sandbox_active`:

```typescript
// Emit sandbox_active on first shell use when no sandboxId was provided
if (!sandboxIdEmitted && !requestSandboxId && sandboxUsed) {
  const currentSandboxId = executor.getSandboxId();
  if (currentSandboxId) {
    send({ type: 'sandbox_active', sandboxId: currentSandboxId });
    sandboxIdEmitted = true;
  }
}
```

Also emit `sandbox_active` when successfully reconnecting to an existing sandbox (after health check passes - see step 4).

### 3. Emit `sandbox_terminated` on Cleanup

**File:** `src/app/api/agent/route.ts`

In the `finally` block (lines 320-331), after successfully cleaning up the sandbox:

```typescript
if (aborted && sandboxUsed && process.env.VERCEL === '1') {
  try {
    await clearSandboxExecutor();
    send({ type: 'sandbox_terminated', content: 'User aborted' });
    console.log('[Agent] Sandbox cleaned up after abort');
  } catch (cleanupError) {
    console.error('[Agent] Failed to cleanup sandbox:', cleanupError);
  }
}
```

### 4. Add Health Check on Sandbox Reconnect

**File:** `src/lib/sandbox/vercel-executor.ts`

Modify `ensureSandbox()` to validate the sandbox is alive after reconnecting:

```typescript
private async ensureSandbox(): Promise<Sandbox> {
  if (this.isDead) {
    throw new SandboxTimeoutError();
  }
  if (!this.sandbox) {
    const { Sandbox } = await import('@vercel/sandbox');

    if (this.existingSandboxId) {
      // Reconnect to existing sandbox
      try {
        this.sandbox = await Sandbox.get({ sandboxId: this.existingSandboxId });

        // Health check: verify sandbox is actually alive
        const healthCheck = await this.sandbox.runCommand({
          cmd: 'echo',
          args: ['ok'],
        });
        if (healthCheck.exitCode !== 0) {
          throw new Error('Health check failed');
        }
      } catch (error) {
        // Sandbox is dead, create a new one instead
        console.log('[Sandbox] Reconnect failed, creating new sandbox:', error);
        this.existingSandboxId = null;
        this.sandbox = await Sandbox.create({
          runtime: 'python3.13',
          timeout: IDLE_TIMEOUT_MS,
        });
      }
    } else {
      // Create new sandbox
      this.sandbox = await Sandbox.create({
        runtime: 'python3.13',
        timeout: IDLE_TIMEOUT_MS,
      });
    }
    this.lastActivityTime = Date.now();
  }
  return this.sandbox;
}
```

**Note:** When a new sandbox is created due to failed reconnect, the route.ts code will emit `sandbox_active` with the new sandbox ID (existing logic handles this).

### 5. Handle Status Events in Frontend

**File:** `src/hooks/useForgeChat.ts`

Replace the `sandbox_created` case (lines 492-496) with:

```typescript
case 'sandbox_active':
  if (event.sandboxId) {
    setCurrentSandboxId(event.sandboxId);
  }
  break;

case 'sandbox_terminated':
  setCurrentSandboxId(null);
  break;
```

### 6. Clear Sandbox ID on Conversation Switch

**File:** `src/hooks/useForgeChat.ts`

In the `useEffect` that handles `initialMessages` changes (lines 119-153), add sandbox ID clearing:

```typescript
useEffect(() => {
  if (options?.initialMessages) {
    setMessages(options.initialMessages);
    setCurrentSandboxId(null);  // ADD THIS LINE - clear sandbox on conversation switch
    // ... rest of existing stats recalculation code
  }
}, [options?.initialMessages]);
```

### 7. (Optional) Add Sandbox Status Indicator

**File:** `src/hooks/useForgeChat.ts`

Add a new state for sandbox status:

```typescript
const [sandboxStatus, setSandboxStatus] = useState<'disconnected' | 'connected'>('disconnected');
```

Update status based on events:
- `sandbox_active` → `'connected'`
- `sandbox_terminated` / `sandbox_timeout` → `'disconnected'`
- On conversation switch → `'disconnected'`

**File:** `src/components/TsugiChat.tsx` (or new component)

Display a subtle indicator showing sandbox connection state (e.g., small dot in header: green = connected, gray = disconnected).

---

## Testing Plan

### Manual Testing

1. **Abort and Resume Test:**
   - Start a task that uses shell commands (e.g., "list files in current directory")
   - Wait for commands to start running
   - Click Stop button
   - Send a new message (e.g., "run ls again")
   - **Expected:** New sandbox created, command executes successfully

2. **Conversation Switch Test:**
   - Start a task with shell commands in Conversation A
   - Let it complete
   - Create new conversation (Conversation B)
   - Run a shell command
   - **Expected:** New sandbox created for Conversation B

3. **Stale Sandbox Reconnect Test:**
   - Start a task, let sandbox timeout naturally (5 min)
   - Send new message
   - **Expected:** Health check fails, new sandbox created automatically

4. **Status Indicator Test (if implemented):**
   - Verify indicator shows "connected" when sandbox is active
   - Verify indicator shows "disconnected" after abort/timeout
   - Verify indicator resets on conversation switch

### Automated Testing (Optional)

Add unit tests to `src/lib/sandbox/vercel-executor.test.ts`:
- Test health check failure triggers new sandbox creation
- Test `isDead` flag prevents operations

---

## Rollback Plan

If issues occur:
1. Revert the health check in `vercel-executor.ts` (keep other changes)
2. The `sandbox_active`/`sandbox_terminated` events and frontend handling are low-risk

---

## Notes

- The `cachedExecutor` in `executor.ts` is module-scoped but in serverless (Vercel), each request can be a new instance, so caching doesn't persist across requests. The `sandboxId` passed from frontend is the primary reconnection mechanism.

- The Vercel Sandbox SDK's `Sandbox.get()` returns a reference object without validating the sandbox exists. Only actual operations (like `runCommand`) will fail on a dead sandbox.

- Local development (`LocalSandboxExecutor`) doesn't have this issue since it uses filesystem-based sandbox that persists.

- The event rename from `sandbox_created` → `sandbox_active` is a breaking change if any external code depends on it, but this is internal API only.
