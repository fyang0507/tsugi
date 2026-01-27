import { describe, it, expect } from 'vitest';

/**
 * These tests verify the command ID generation and matching logic
 * that was added to fix the issue where multiple shell commands
 * would show as "queued" but never transition to "running" or "completed".
 *
 * The core logic being tested:
 * 1. Command ID generation: `cmd-{iteration}-{index}`
 * 2. SSE event matching by commandId instead of command string
 */

// Simulates the command detection logic from route.ts
interface DetectedCommand {
  id: string;
  command: string;
}

function detectCommandsWithIds(
  text: string,
  iteration: number
): DetectedCommand[] {
  const shellRegex = /<shell>([\s\S]*?)<\/shell>/g;
  const detectedCommands: DetectedCommand[] = [];
  let commandIdCounter = 0;
  let match;

  while ((match = shellRegex.exec(text)) !== null) {
    const command = match[1].trim();
    if (command) {
      const commandId = `cmd-${iteration}-${commandIdCounter++}`;
      detectedCommands.push({ id: commandId, command });
    }
  }

  return detectedCommands;
}

// Simulates the MessagePart interface from useTsugiChat.ts
interface MessagePart {
  type: 'tool';
  command: string;
  commandId: string;
  content: string;
  toolStatus: 'queued' | 'running' | 'completed';
}

// Simulates the tool-call handler
function handleToolCall(
  parts: MessagePart[],
  event: { command: string; commandId: string }
): void {
  parts.push({
    type: 'tool',
    command: event.command,
    commandId: event.commandId,
    content: '',
    toolStatus: 'queued',
  });
}

// Simulates the tool-start handler
function handleToolStart(
  parts: MessagePart[],
  event: { commandId: string }
): void {
  const startingPart = parts.find(
    (p) => p.type === 'tool' && p.commandId === event.commandId
  );
  if (startingPart) {
    startingPart.toolStatus = 'running';
  }
}

// Simulates the tool-result handler
function handleToolResult(
  parts: MessagePart[],
  event: { commandId: string; result: string }
): void {
  const matchingPart = parts.find(
    (p) => p.type === 'tool' && p.commandId === event.commandId
  );
  if (matchingPart) {
    matchingPart.content = event.result;
    matchingPart.toolStatus = 'completed';
  }
}

describe('Command ID Generation', () => {
  it('generates unique IDs for different commands in same iteration', () => {
    const text = '<shell>ls</shell> <shell>cat file1.py</shell> <shell>cat file2.py</shell>';
    const commands = detectCommandsWithIds(text, 1);

    expect(commands).toHaveLength(3);
    expect(commands[0]).toEqual({ id: 'cmd-1-0', command: 'ls' });
    expect(commands[1]).toEqual({ id: 'cmd-1-1', command: 'cat file1.py' });
    expect(commands[2]).toEqual({ id: 'cmd-1-2', command: 'cat file2.py' });
  });

  it('generates unique IDs for duplicate commands', () => {
    const text = '<shell>ls</shell> <shell>ls</shell>';
    const commands = detectCommandsWithIds(text, 1);

    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual({ id: 'cmd-1-0', command: 'ls' });
    expect(commands[1]).toEqual({ id: 'cmd-1-1', command: 'ls' });

    // IDs are unique even though commands are the same
    expect(commands[0].id).not.toBe(commands[1].id);
    expect(commands[0].command).toBe(commands[1].command);
  });

  it('uses iteration number in IDs', () => {
    const text = '<shell>ls</shell>';

    const commands1 = detectCommandsWithIds(text, 1);
    const commands2 = detectCommandsWithIds(text, 2);

    expect(commands1[0].id).toBe('cmd-1-0');
    expect(commands2[0].id).toBe('cmd-2-0');
  });

  it('handles empty commands gracefully', () => {
    const text = '<shell></shell> <shell>ls</shell> <shell>  </shell>';
    const commands = detectCommandsWithIds(text, 1);

    // Empty and whitespace-only commands are skipped
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({ id: 'cmd-1-0', command: 'ls' });
  });
});

describe('SSE Event Matching by CommandId', () => {
  it('correctly transitions single command through states', () => {
    const parts: MessagePart[] = [];

    // Simulate tool-call event
    handleToolCall(parts, { command: 'ls', commandId: 'cmd-1-0' });
    expect(parts[0].toolStatus).toBe('queued');

    // Simulate tool-start event
    handleToolStart(parts, { commandId: 'cmd-1-0' });
    expect(parts[0].toolStatus).toBe('running');

    // Simulate tool-result event
    handleToolResult(parts, { commandId: 'cmd-1-0', result: 'file1.txt\nfile2.txt' });
    expect(parts[0].toolStatus).toBe('completed');
    expect(parts[0].content).toBe('file1.txt\nfile2.txt');
  });

  it('correctly tracks multiple different commands', () => {
    const parts: MessagePart[] = [];

    // Add all commands as queued
    handleToolCall(parts, { command: 'ls', commandId: 'cmd-1-0' });
    handleToolCall(parts, { command: 'cat file1.py', commandId: 'cmd-1-1' });
    handleToolCall(parts, { command: 'cat file2.py', commandId: 'cmd-1-2' });

    expect(parts.every((p) => p.toolStatus === 'queued')).toBe(true);

    // First command executes
    handleToolStart(parts, { commandId: 'cmd-1-0' });
    expect(parts[0].toolStatus).toBe('running');
    expect(parts[1].toolStatus).toBe('queued');
    expect(parts[2].toolStatus).toBe('queued');

    handleToolResult(parts, { commandId: 'cmd-1-0', result: 'file1.txt' });
    expect(parts[0].toolStatus).toBe('completed');

    // Second command executes
    handleToolStart(parts, { commandId: 'cmd-1-1' });
    expect(parts[1].toolStatus).toBe('running');

    handleToolResult(parts, { commandId: 'cmd-1-1', result: 'content1' });
    expect(parts[1].toolStatus).toBe('completed');

    // Third command executes
    handleToolStart(parts, { commandId: 'cmd-1-2' });
    expect(parts[2].toolStatus).toBe('running');

    handleToolResult(parts, { commandId: 'cmd-1-2', result: 'content2' });
    expect(parts[2].toolStatus).toBe('completed');

    // All completed with correct results
    expect(parts[0].content).toBe('file1.txt');
    expect(parts[1].content).toBe('content1');
    expect(parts[2].content).toBe('content2');
  });

  it('correctly tracks duplicate commands', () => {
    const parts: MessagePart[] = [];

    // Two identical "ls" commands with different IDs
    handleToolCall(parts, { command: 'ls', commandId: 'cmd-1-0' });
    handleToolCall(parts, { command: 'ls', commandId: 'cmd-1-1' });

    // Both are queued
    expect(parts[0].toolStatus).toBe('queued');
    expect(parts[1].toolStatus).toBe('queued');

    // First ls executes
    handleToolStart(parts, { commandId: 'cmd-1-0' });
    expect(parts[0].toolStatus).toBe('running');
    expect(parts[1].toolStatus).toBe('queued'); // Second ls still queued

    handleToolResult(parts, { commandId: 'cmd-1-0', result: 'result1' });
    expect(parts[0].toolStatus).toBe('completed');
    expect(parts[0].content).toBe('result1');
    expect(parts[1].toolStatus).toBe('queued'); // Second ls still queued

    // Second ls executes
    handleToolStart(parts, { commandId: 'cmd-1-1' });
    expect(parts[1].toolStatus).toBe('running');

    handleToolResult(parts, { commandId: 'cmd-1-1', result: 'result2' });
    expect(parts[1].toolStatus).toBe('completed');
    expect(parts[1].content).toBe('result2');

    // Both completed with their own results
    expect(parts[0].content).toBe('result1');
    expect(parts[1].content).toBe('result2');
  });

  it('handles out-of-order events gracefully', () => {
    const parts: MessagePart[] = [];

    // Commands added in order
    handleToolCall(parts, { command: 'cmd1', commandId: 'cmd-1-0' });
    handleToolCall(parts, { command: 'cmd2', commandId: 'cmd-1-1' });

    // Events arrive out of order (shouldn't happen but testing robustness)
    handleToolStart(parts, { commandId: 'cmd-1-1' }); // Second command starts first
    expect(parts[0].toolStatus).toBe('queued');
    expect(parts[1].toolStatus).toBe('running');

    handleToolStart(parts, { commandId: 'cmd-1-0' }); // First command starts
    expect(parts[0].toolStatus).toBe('running');

    handleToolResult(parts, { commandId: 'cmd-1-0', result: 'r1' });
    expect(parts[0].toolStatus).toBe('completed');
    expect(parts[1].toolStatus).toBe('running');

    handleToolResult(parts, { commandId: 'cmd-1-1', result: 'r2' });
    expect(parts[1].toolStatus).toBe('completed');
  });

  it('ignores events for unknown commandIds', () => {
    const parts: MessagePart[] = [];

    handleToolCall(parts, { command: 'ls', commandId: 'cmd-1-0' });

    // Event for unknown ID should be ignored
    handleToolStart(parts, { commandId: 'cmd-1-999' });
    expect(parts[0].toolStatus).toBe('queued'); // Unchanged

    handleToolResult(parts, { commandId: 'cmd-1-999', result: 'ignored' });
    expect(parts[0].toolStatus).toBe('queued'); // Still unchanged
    expect(parts[0].content).toBe(''); // No content added
  });
});

describe('End-to-end Command Flow', () => {
  it('simulates SkillAgent workflow with multiple commands', () => {
    // Simulate: Agent outputs multiple shell commands
    const agentOutput = '<shell>ls</shell> <shell>cat script.py</shell>';

    // 1. Backend detects commands and generates IDs
    const iteration = 1;
    const commands = detectCommandsWithIds(agentOutput, iteration);

    expect(commands).toEqual([
      { id: 'cmd-1-0', command: 'ls' },
      { id: 'cmd-1-1', command: 'cat script.py' },
    ]);

    // 2. Frontend receives tool-call events
    const parts: MessagePart[] = [];
    for (const cmd of commands) {
      handleToolCall(parts, { command: cmd.command, commandId: cmd.id });
    }

    expect(parts).toHaveLength(2);
    expect(parts.every((p) => p.toolStatus === 'queued')).toBe(true);

    // 3. Backend executes commands sequentially, frontend updates
    for (const cmd of commands) {
      handleToolStart(parts, { commandId: cmd.id });

      const matchingPart = parts.find((p) => p.commandId === cmd.id);
      expect(matchingPart?.toolStatus).toBe('running');

      // Simulate execution result
      handleToolResult(parts, {
        commandId: cmd.id,
        result: `output for ${cmd.command}`,
      });

      expect(matchingPart?.toolStatus).toBe('completed');
    }

    // 4. Verify final state
    expect(parts[0].toolStatus).toBe('completed');
    expect(parts[0].content).toBe('output for ls');
    expect(parts[1].toolStatus).toBe('completed');
    expect(parts[1].content).toBe('output for cat script.py');
  });

  it('handles multi-iteration agent loop', () => {
    const parts: MessagePart[] = [];

    // Iteration 1: Agent outputs two commands
    const output1 = '<shell>ls</shell> <shell>cat file.py</shell>';
    const commands1 = detectCommandsWithIds(output1, 1);

    for (const cmd of commands1) {
      handleToolCall(parts, { command: cmd.command, commandId: cmd.id });
      handleToolStart(parts, { commandId: cmd.id });
      handleToolResult(parts, { commandId: cmd.id, result: `iter1-${cmd.command}` });
    }

    // Iteration 2: Agent outputs one more command
    const output2 = '<shell>python3 file.py</shell>';
    const commands2 = detectCommandsWithIds(output2, 2);

    for (const cmd of commands2) {
      handleToolCall(parts, { command: cmd.command, commandId: cmd.id });
      handleToolStart(parts, { commandId: cmd.id });
      handleToolResult(parts, { commandId: cmd.id, result: `iter2-${cmd.command}` });
    }

    // Verify all commands tracked correctly
    expect(parts).toHaveLength(3);
    expect(parts[0].commandId).toBe('cmd-1-0');
    expect(parts[1].commandId).toBe('cmd-1-1');
    expect(parts[2].commandId).toBe('cmd-2-0');
    expect(parts.every((p) => p.toolStatus === 'completed')).toBe(true);
  });
});
