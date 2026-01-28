import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { SandboxExecutor, CommandResult, ExecuteOptions } from './executor';
import { SandboxTimeoutError } from './executor';

const execAsync = promisify(exec);

const MAX_BUFFER = 1024 * 1024; // 1MB

export class LocalSandboxExecutor implements SandboxExecutor {
  private sandboxDir: string;
  private sandboxId: string;
  private isDead: boolean = false;

  constructor(sandboxId: string = 'default', sandboxRoot: string = '.sandbox') {
    this.sandboxId = sandboxId;
    this.sandboxDir = path.join(sandboxRoot, sandboxId);
  }

  getSandboxId(): string | null {
    return this.sandboxId;
  }

  /**
   * Eagerly initialize the sandbox directory and return its ID.
   * For local executor, this just ensures the directory exists.
   */
  async initialize(): Promise<string> {
    await fs.mkdir(this.sandboxDir, { recursive: true });
    return this.sandboxId;
  }

  isAlive(): boolean {
    return !this.isDead;
  }

  async resetTimeout(): Promise<boolean> {
    return this.isAlive();
  }

  async execute(command: string, options?: ExecuteOptions): Promise<CommandResult> {
    // Check if sandbox is still alive
    if (!this.isAlive()) {
      throw new SandboxTimeoutError();
    }

    // Ensure sandbox directory exists
    await fs.mkdir(this.sandboxDir, { recursive: true });

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: options?.timeout,
        maxBuffer: MAX_BUFFER,
        cwd: options?.cwd ?? this.sandboxDir,
        env: options?.env ? { ...process.env, ...options.env } : undefined,
      });

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (error) {
      if (error instanceof Error) {
        // Handle explicit timeout (when options.timeout is provided)
        if ('killed' in error && error.killed && options?.timeout) {
          return {
            stdout: '',
            stderr: `Command timed out (${options.timeout / 1000}s)`,
            exitCode: 124, // Standard timeout exit code
          };
        }

        // Handle exec errors with exit codes
        const execError = error as Error & { code?: number; stdout?: string; stderr?: string };
        return {
          stdout: execError.stdout?.trim() ?? '',
          stderr: execError.stderr?.trim() ?? error.message,
          exitCode: execError.code ?? 1,
        };
      }

      return {
        stdout: '',
        stderr: 'Unknown error',
        exitCode: 1,
      };
    }
  }

  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    const fullPath = path.join(this.sandboxDir, filePath);
    const dir = path.dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  async readFile(filePath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.sandboxDir, filePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async listFiles(subPath?: string): Promise<string[]> {
    try {
      const dir = subPath ? path.join(this.sandboxDir, subPath) : this.sandboxDir;
      return await fs.readdir(dir);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    await fs.rm(this.sandboxDir, { recursive: true, force: true });
    await fs.mkdir(this.sandboxDir, { recursive: true });
    this.isDead = true;
  }
}
