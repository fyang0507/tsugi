import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCommand } from '../command-executor';

vi.mock('../skill-commands', () => ({
  executeSkillCommand: vi.fn(),
}));

vi.mock('../shell-executor', () => ({
  executeShellCommand: vi.fn(),
}));

import { executeSkillCommand } from '../skill-commands';
import { executeShellCommand } from '../shell-executor';

describe('executeCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('routing', () => {
    it('routes "skill " prefixed commands to executeSkillCommand', async () => {
      vi.mocked(executeSkillCommand).mockResolvedValue('skill result');

      const result = await executeCommand('skill list');

      expect(executeSkillCommand).toHaveBeenCalledWith('list');
      expect(executeShellCommand).not.toHaveBeenCalled();
      expect(result).toBe('skill result');
    });

    it('strips "skill " prefix and trims args', async () => {
      vi.mocked(executeSkillCommand).mockResolvedValue('ok');

      await executeCommand('skill   get myskill  ');

      expect(executeSkillCommand).toHaveBeenCalledWith('get myskill');
    });

    it('routes non-skill commands to executeShellCommand', async () => {
      vi.mocked(executeShellCommand).mockResolvedValue('shell result');

      const result = await executeCommand('ls -la');

      expect(executeShellCommand).toHaveBeenCalledWith('ls -la', undefined);
      expect(executeSkillCommand).not.toHaveBeenCalled();
      expect(result).toBe('shell result');
    });

    it('passes options to executeShellCommand', async () => {
      vi.mocked(executeShellCommand).mockResolvedValue('ok');
      const options = { env: { FOO: 'bar' } };

      await executeCommand('echo $FOO', options);

      expect(executeShellCommand).toHaveBeenCalledWith('echo $FOO', options);
    });

    it('does not pass options to executeSkillCommand', async () => {
      vi.mocked(executeSkillCommand).mockResolvedValue('ok');

      await executeCommand('skill list', { env: { FOO: 'bar' } });

      expect(executeSkillCommand).toHaveBeenCalledWith('list');
    });
  });

  describe('edge cases', () => {
    it('treats "skill" without space as shell command', async () => {
      vi.mocked(executeShellCommand).mockResolvedValue('ok');

      await executeCommand('skillful');

      expect(executeShellCommand).toHaveBeenCalledWith('skillful', undefined);
      expect(executeSkillCommand).not.toHaveBeenCalled();
    });

    it('handles "skill" with just space as skill command', async () => {
      vi.mocked(executeSkillCommand).mockResolvedValue('ok');

      await executeCommand('skill ');

      expect(executeSkillCommand).toHaveBeenCalledWith('');
    });
  });
});
