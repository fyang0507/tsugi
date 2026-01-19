# Transcript Fidelity Improvements

Last Updated: 2026-01-19

## Problem

The skill agent was receiving an incomplete view of task execution. The `toTranscriptString()` function processed the `iterations` array which only contained `rawContent` and `toolOutput` - losing valuable context like reasoning traces and structured tool call information.

## Solution

### 1. Enhanced Transcript Transformation

Updated `src/lib/messages/transform.ts`:

```typescript
// New MessagePart type definition
export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'reasoning'; content: string }
  | { type: 'agent-tool'; toolName: string; toolArgs: Record<string, unknown>; content: string };
```

The `toTranscriptString()` function now:
- Processes `parts` array first (full execution history)
- Falls back to `iterations` for legacy messages
- Outputs structured format: `[reasoning]`, `[tool-call]`, `[tool-output]`, `[assistant]`

### 2. Process-Transcript Tool Guidance

Updated `src/lib/agent/tools/process-transcript.ts` Section 5:

**Before:** "Reusable Patterns & Best Practices" - allowed suggesting alternative implementations
**After:** "Optimal Procedure (Based on Actual Execution)" - requires referencing only what was ACTUALLY used

Key addition:
> IMPORTANT: Only reference tools, commands, and code that were ACTUALLY USED in the transcript.
> Do NOT suggest alternative implementations, different languages, or tools that weren't used.

### 3. Skill Agent System Prompt

Added guiding principle to `src/lib/agent/skill-agent.ts`:
> **Key principle:** The value is in capturing the ACTUAL working procedure from the execution, not in inventing a "better" approach. Document what was done, optimized to the shortest successful path.

Also updated code generalization guidance to emphasize "preserving the same approach" and keeping the SAME language, tools, and methods.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/messages/transform.ts` | Added `MessagePart` type, rewrote `toTranscriptString()` to process parts array |
| `src/lib/agent/tools/process-transcript.ts` | Renamed Section 5, added constraints on actual execution only |
| `src/lib/agent/skill-agent.ts` | Added key principle, updated generalization guidance |
| `scripts/test-skill-agent.ts` | Added usage documentation comment |

## Why This Matters

Skills should encode the **actual working procedure** discovered through trial-and-error, not an idealized version. If a task was completed using curl, the skill should document curl - not suggest switching to Python requests. The value of codified skills is in preserving what actually worked.
