# Command ID Tracking Implementation

Last Updated: 2026-01-17

## Problem

Multiple `<shell>` commands in a single agent response would display as "queued" but never transition to "running" or "completed". This occurred because the frontend matched commands by string equality, which fails when:
- Multiple different commands exist (wrong command gets updated)
- Duplicate commands exist (e.g., two `ls` calls only update one)

## Solution

Added unique `commandId` to each command for lifecycle tracking.

**ID Format**: `cmd-{iteration}-{index}` where:
- `iteration`: Current agentic loop iteration (0-based)
- `index`: Command index within that iteration (0-based)

## Key Changes

### Backend (`src/app/api/agent/route.ts`)
- Added `commandId` to SSEEvent interface
- Changed `detectedCommands` from `string[]` to `Array<{ id: string; command: string }>`
- Generate unique ID when detecting each command during streaming
- Include `commandId` in tool-call, tool-start, and tool-result events

### Frontend (`src/hooks/useForgeChat.ts`)
- Added `commandId` to MessagePart and SSEEvent interfaces
- Store `commandId` when creating tool parts
- Match by `commandId` instead of command string in tool-start/tool-result handlers

## Test Coverage

Created two test files in `src/lib/tools/__tests__/`:
- `command-parser.test.ts`: 16 tests for extractCommands, formatToolResults, truncateOutput
- `command-id-tracking.test.ts`: 11 tests for ID generation, SSE event matching, state transitions

## Event Flow

```
1. Agent streams: "<shell>ls</shell>"
2. Backend detects, sends: { type: 'tool-call', command: 'ls', commandId: 'cmd-0-0' }
3. Frontend creates part: { type: 'tool', command: 'ls', commandId: 'cmd-0-0', toolStatus: 'queued' }
4. Backend executes, sends: { type: 'tool-start', command: 'ls', commandId: 'cmd-0-0' }
5. Frontend updates part by commandId: toolStatus = 'running'
6. Backend completes, sends: { type: 'tool-result', command: 'ls', commandId: 'cmd-0-0', result: '...' }
7. Frontend updates part by commandId: toolStatus = 'completed', content = result
```
