# Issue 2: SkillAgent Command Parsing (Multiple Shell Commands)

## Problem

When SkillAgent outputs multiple `<shell>` commands in one response:
```
<shell>ls</shell> <shell>cat curate_single.py</shell> <shell>cat verify_notion.py</shell>
```

All commands show as "queued" in the UI but never transition to "running" or "completed".

## Root Cause

Frontend matches commands by string equality:

```typescript
// tool-start handler
const startingPart = parts.find(
  (p) => p.type === 'tool' && p.command === event.command && p.toolStatus === 'queued'
);

// tool-result handler
const matchingPart = parts.find(
  (p) => p.type === 'tool' && p.command === event.command && p.toolStatus !== 'completed'
);
```

This fails when:
1. Multiple commands exist (first match may not be correct)
2. Duplicate commands exist (e.g., two `ls` calls)

## Solution: Unique Command IDs

Add a unique `commandId` to each command for proper tracking.

## Changes

### 1. `src/app/api/agent/route.ts`

Update SSE event types:

```typescript
interface SSEEvent {
  // ... existing fields ...
  commandId?: string;  // NEW: unique identifier for command tracking
}
```

Update command detection and execution:

```typescript
// Change from string[] to array of objects with IDs
const detectedCommands: Array<{ id: string; command: string }> = [];
let commandIdCounter = 0;

// In streaming detection (inside text-delta case):
while ((match = shellRegex.exec(fullOutput)) !== null) {
  if (match.index >= lastProcessedIndex) {
    const command = match[1].trim();
    // Generate unique ID for each command (even duplicates)
    const commandId = `cmd-${iteration}-${commandIdCounter++}`;
    detectedCommands.push({ id: commandId, command });
    send({ type: 'tool-call', command, commandId });
    lastProcessedIndex = match.index + match[0].length;
  }
}

// Update fallback path to also use command objects
const commands = detectedCommands.length > 0
  ? detectedCommands
  : extractCommands(fullOutput).map((cmd, idx) => ({
      id: `cmd-${iteration}-${idx}`,
      command: cmd
    }));

// In execution loop:
for (const { id: commandId, command } of commands) {
  if (aborted) break;

  // Fallback path
  if (detectedCommands.length === 0) {
    send({ type: 'tool-call', command, commandId });
  }

  send({ type: 'tool-start', command, commandId });

  // ... sandbox tracking ...

  const result = await executeCommand(command, { env: mergedEnv });
  executions.push({ command, result });
  send({ type: 'tool-result', command, commandId, result });
}
```

### 2. `src/hooks/useForgeChat.ts`

Update `MessagePart` interface:

```typescript
interface MessagePart {
  type: 'text' | 'tool' | 'reasoning' | 'source';
  content: string;
  command?: string;
  commandId?: string;  // NEW
  toolStatus?: 'queued' | 'running' | 'completed';
  // ... other fields ...
}
```

Update event handlers to match by `commandId`:

```typescript
case 'tool-call': {
  parts.push({
    type: 'tool',
    command: event.command,
    commandId: event.commandId,  // NEW
    content: '',
    toolStatus: 'queued'
  });
  break;
}

case 'tool-start': {
  // Match by commandId instead of command string
  const startingPart = parts.find(
    (p) => p.type === 'tool' && p.commandId === event.commandId
  );
  if (startingPart) {
    startingPart.toolStatus = 'running';
  }
  break;
}

case 'tool-result': {
  // Match by commandId instead of command string
  const matchingPart = parts.find(
    (p) => p.type === 'tool' && p.commandId === event.commandId
  );
  if (matchingPart) {
    matchingPart.content = event.result || '';
    matchingPart.toolStatus = 'completed';
  }
  break;
}
```

## Execution Order

Commands execute **sequentially** (not in parallel). The existing `for...of` loop with `await` ensures this:

```typescript
for (const { id: commandId, command } of commands) {
  // Each command waits for the previous to complete
  const result = await executeCommand(command, { env: mergedEnv });
  // ...
}
```

The fix only addresses **UI tracking**, not execution order.

## Testing

### Test Case 1: Multiple Different Commands
Input: `<shell>ls</shell> <shell>cat file1.py</shell> <shell>cat file2.py</shell>`

Expected:
1. UI shows 3 commands all "queued" initially
2. First command transitions: queued → running → completed
3. Second command transitions: queued → running → completed
4. Third command transitions: queued → running → completed

### Test Case 2: Duplicate Commands
Input: `<shell>ls</shell> <shell>ls</shell>`

Expected:
1. UI shows 2 separate "ls" commands
2. First `ls` completes (ID: `cmd-1-0`)
3. Second `ls` completes (ID: `cmd-1-1`)
4. Both show as completed with their respective outputs

### Test Case 3: SkillAgent Workflow
1. Trigger SkillAgent on a conversation with sandbox files
2. Agent outputs: `<shell>ls</shell> <shell>cat script.py</shell>`
3. Verify both commands execute and UI updates correctly

## Command ID Format

`cmd-{iteration}-{index}`

- `iteration`: The agent loop iteration (1-based)
- `index`: Zero-based index within that iteration

Examples:
- First iteration, first command: `cmd-1-0`
- First iteration, second command: `cmd-1-1`
- Second iteration, first command: `cmd-2-0`
