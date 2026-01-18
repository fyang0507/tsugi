import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeShellCommand } from '../shell-executor';

const mockExecute = vi.fn();

vi.mock('../../sandbox/executor', () => ({
  getSandboxExecutor: vi.fn(() => Promise.resolve({ execute: mockExecute })),
}));

describe('executeShellCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful execution', () => {
    it('returns stdout on success', async () => {
      mockExecute.mockResolvedValue({ exitCode: 0, stdout: 'hello world', stderr: '' });

      const result = await executeShellCommand('echo hello');

      expect(result).toBe('hello world');
    });

    it('combines stdout and stderr when both present', async () => {
      mockExecute.mockResolvedValue({ exitCode: 0, stdout: 'output', stderr: 'warning' });

      const result = await executeShellCommand('some-cmd');

      expect(result).toBe('output\nwarning');
    });

    it('returns "(no output)" when stdout and stderr are empty', async () => {
      mockExecute.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      const result = await executeShellCommand('touch file');

      expect(result).toBe('(no output)');
    });

    it('trims whitespace from output', async () => {
      mockExecute.mockResolvedValue({ exitCode: 0, stdout: '  trimmed  \n', stderr: '' });

      const result = await executeShellCommand('cmd');

      expect(result).toBe('trimmed');
    });
  });

  describe('error handling', () => {
    it('returns stderr as error on non-zero exit', async () => {
      mockExecute.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'file not found' });

      const result = await executeShellCommand('cat missing');

      expect(result).toBe('Error: file not found');
    });

    it('returns generic error when stderr is empty', async () => {
      mockExecute.mockResolvedValue({ exitCode: 127, stdout: '', stderr: '' });

      const result = await executeShellCommand('nonexistent');

      expect(result).toBe('Command failed with exit code 127');
    });
  });

  describe('truncation', () => {
    it('truncates output exceeding 5000 characters', async () => {
      const longOutput = 'a'.repeat(6000);
      mockExecute.mockResolvedValue({ exitCode: 0, stdout: longOutput, stderr: '' });

      const result = await executeShellCommand('cat large-file');

      expect(result.length).toBeLessThan(longOutput.length);
      expect(result).toContain('... (truncated)');
      expect(result.startsWith('a'.repeat(5000))).toBe(true);
    });

    it('does not truncate output at exactly 5000 characters', async () => {
      const exactOutput = 'a'.repeat(5000);
      mockExecute.mockResolvedValue({ exitCode: 0, stdout: exactOutput, stderr: '' });

      const result = await executeShellCommand('cmd');

      expect(result).toBe(exactOutput);
    });
  });

  describe('options', () => {
    it('passes env options to executor', async () => {
      mockExecute.mockResolvedValue({ exitCode: 0, stdout: 'bar', stderr: '' });

      await executeShellCommand('echo $FOO', { env: { FOO: 'bar' } });

      expect(mockExecute).toHaveBeenCalledWith('echo $FOO', { env: { FOO: 'bar' } });
    });

    it('works without options', async () => {
      mockExecute.mockResolvedValue({ exitCode: 0, stdout: 'ok', stderr: '' });

      await executeShellCommand('ls');

      expect(mockExecute).toHaveBeenCalledWith('ls', { env: undefined });
    });
  });
});
