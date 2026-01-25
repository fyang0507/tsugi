# Sandbox Lifecycle Fix

Last Updated: 2026-01-25

## Summary

Fixed sandbox reconnection bug where commands would hang indefinitely after aborting a conversation. The root cause was that `Sandbox.get()` returns a reference object without validating the sandbox exists - actual operations on a dead sandbox fail silently.

## Changes

### Backend (route.ts)

- **Renamed SSE events**: `sandbox_created` → `sandbox_active` | `sandbox_terminated`
- **Improved emit logic**: Now detects when reconnect fails by comparing `currentSandboxId !== requestSandboxId`
- **Termination signal**: Emits `sandbox_terminated` when abort cleanup runs

### Vercel Executor (vercel-executor.ts)

- **Health check on reconnect**: After `Sandbox.get()`, runs `echo ok` to verify sandbox is alive
- **Graceful fallback**: If health check fails, creates new sandbox instead of failing silently

### Frontend (useForgeChat.ts)

- **New state**: Added `SandboxStatus` type (`'disconnected' | 'connected'`)
- **Event handlers**: Handle `sandbox_active` (set connected), `sandbox_terminated` (set disconnected)
- **Cleanup on switch**: Clears sandbox ID and status when switching conversations

### UI (SandboxStatusIndicator.tsx)

- **New component**: Shows colored dot (green=connected, gray=disconnected) with label
- **Integration**: Added to CumulativeStatsBar footer, visible even before any messages

## Key Insight

`Sandbox.get({ sandboxId })` from Vercel SDK doesn't validate the sandbox exists - it returns a reference object. Only subsequent operations (like `runCommand`) fail on dead sandboxes. The fix adds an explicit health check (`echo ok`) immediately after reconnect.
