import { describe, it, expect } from 'vitest';
import { extractCommands, formatToolResults, truncateOutput } from '../command-parser';

describe('extractCommands', () => {
  it('extracts a single command', () => {
    const text = 'Here is my response <shell>ls -la</shell>';
    expect(extractCommands(text)).toEqual(['ls -la']);
  });

  it('extracts multiple different commands', () => {
    const text = '<shell>ls</shell> <shell>cat file1.py</shell> <shell>cat file2.py</shell>';
    expect(extractCommands(text)).toEqual(['ls', 'cat file1.py', 'cat file2.py']);
  });

  it('extracts duplicate commands', () => {
    const text = '<shell>ls</shell> <shell>ls</shell>';
    expect(extractCommands(text)).toEqual(['ls', 'ls']);
  });

  it('handles multiline commands', () => {
    const text = `<shell>python3 -c "
print('hello')
print('world')
"</shell>`;
    expect(extractCommands(text)).toEqual([`python3 -c "
print('hello')
print('world')
"`]);
  });

  it('trims whitespace from commands', () => {
    const text = '<shell>  ls -la  </shell>';
    expect(extractCommands(text)).toEqual(['ls -la']);
  });

  it('returns empty array when no commands', () => {
    const text = 'Just some text without commands';
    expect(extractCommands(text)).toEqual([]);
  });

  it('handles commands with special characters', () => {
    const text = '<shell>grep -r "pattern.*test" .</shell>';
    expect(extractCommands(text)).toEqual(['grep -r "pattern.*test" .']);
  });

  it('handles commands interspersed with text', () => {
    const text = `Let me check the files.
<shell>ls</shell>
Now let me read the first one.
<shell>cat file1.py</shell>
And the second one.
<shell>cat file2.py</shell>`;
    expect(extractCommands(text)).toEqual(['ls', 'cat file1.py', 'cat file2.py']);
  });

  it('resets regex state between calls', () => {
    // First call
    extractCommands('<shell>first</shell>');
    // Second call should work independently
    expect(extractCommands('<shell>second</shell>')).toEqual(['second']);
  });
});

describe('formatToolResults', () => {
  it('formats single execution result', () => {
    const executions = [{ command: 'ls', result: 'file1.txt\nfile2.txt' }];
    const formatted = formatToolResults(executions);
    expect(formatted).toBe('```terminal\nfile1.txt\nfile2.txt\n```');
  });

  it('formats multiple execution results', () => {
    const executions = [
      { command: 'ls', result: 'file1.txt' },
      { command: 'cat file1.txt', result: 'content' },
    ];
    const formatted = formatToolResults(executions);
    expect(formatted).toBe('```terminal\nfile1.txt\n```\n\n```terminal\ncontent\n```');
  });

  it('handles empty results', () => {
    const executions = [{ command: 'touch newfile', result: '' }];
    const formatted = formatToolResults(executions);
    expect(formatted).toBe('```terminal\n\n```');
  });
});

describe('truncateOutput', () => {
  it('returns output unchanged when under limit', () => {
    const output = 'short output';
    expect(truncateOutput(output)).toBe(output);
  });

  it('truncates output when over limit', () => {
    const output = 'a'.repeat(3000);
    const truncated = truncateOutput(output);
    expect(truncated.length).toBeLessThan(output.length);
    expect(truncated).toContain('... (truncated)');
  });

  it('respects custom max length', () => {
    const output = 'a'.repeat(100);
    const truncated = truncateOutput(output, 50);
    expect(truncated).toBe('a'.repeat(50) + '\n... (truncated)');
  });

  it('handles exact limit length', () => {
    const output = 'a'.repeat(2000);
    expect(truncateOutput(output)).toBe(output);
  });
});
