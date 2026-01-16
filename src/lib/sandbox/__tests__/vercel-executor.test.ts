import { describe, it, expect, afterAll } from 'vitest';
import { VercelSandboxExecutor } from '../vercel-executor';

// Skip tests if running locally without Vercel credentials
const SKIP_VERCEL_TESTS = process.env.VERCEL !== '1';

describe.skipIf(SKIP_VERCEL_TESTS)('VercelSandboxExecutor', () => {
  let executor: VercelSandboxExecutor;

  // Reuse executor across tests to avoid creating multiple sandboxes
  const getExecutor = () => {
    if (!executor) {
      executor = new VercelSandboxExecutor();
    }
    return executor;
  };

  afterAll(async () => {
    if (executor) {
      await executor.cleanup();
    }
  });

  describe('execute', () => {
    it('should execute Python code', async () => {
      const exec = getExecutor();
      const result = await exec.execute('python3 -c "print(\'Hello from Vercel Sandbox\')"');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello from Vercel Sandbox');
    });

    it('should return command output with stderr', async () => {
      const exec = getExecutor();
      const result = await exec.execute('python3 -c "import sys; sys.stderr.write(\'error output\')"');

      expect(result.stderr).toContain('error output');
    });

    it('should handle command failures', async () => {
      const exec = getExecutor();
      const result = await exec.execute('python3 -c "raise Exception(\'test error\')"');

      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('writeFile / readFile', () => {
    it('should write and read files in sandbox', async () => {
      const exec = getExecutor();

      await exec.writeFile('test-file.txt', 'test content from Vercel');
      const content = await exec.readFile('test-file.txt');

      expect(content).toBe('test content from Vercel');
    });

    it('should return null for non-existent file', async () => {
      const exec = getExecutor();
      const content = await exec.readFile('nonexistent-file.txt');

      expect(content).toBeNull();
    });
  });

  describe('listFiles', () => {
    it('should list files in sandbox', async () => {
      const exec = getExecutor();

      await exec.writeFile('list-test-1.txt', 'content1');
      await exec.writeFile('list-test-2.txt', 'content2');

      const files = await exec.listFiles();

      expect(files).toContain('list-test-1.txt');
      expect(files).toContain('list-test-2.txt');
    });
  });

  describe('cleanup', () => {
    it('should stop the sandbox without errors', async () => {
      const exec = new VercelSandboxExecutor();
      // Initialize sandbox
      await exec.execute('echo init');
      // Cleanup should not throw
      await expect(exec.cleanup()).resolves.toBeUndefined();
    });
  });
});
