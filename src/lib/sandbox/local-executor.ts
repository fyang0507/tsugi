import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { SandboxExecutor, CommandResult, ExecuteOptions } from './executor';
import { SandboxTimeoutError } from './executor';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_BUFFER = 1024 * 1024; // 1MB
const IDLE_TIMEOUT_MS = 300000; // 5 minutes idle timeout (same as Vercel)

const ALLOWED_COMMANDS = [
  'sh',
  'curl',
  'cat',
  'ls',
  'head',
  'tail',
  'find',
  'tree',
  'jq',
  'grep',
  'export',
  'source',
  'python',
  'python3',
  'pip',
  'pip3',
  'cd',
  'rm',
  'mv',
  'cp',
  'echo',
  'touch',
  'mkdir',
  'rmdir',
  'pwd',
  'sleep',
];

export class LocalSandboxExecutor implements SandboxExecutor {
  private sandboxDir: string;
  private sandboxId: string;
  private lastActivityTime: number = Date.now();
  private isDead: boolean = false;

  constructor(sandboxId: string = 'default') {
    this.sandboxId = sandboxId;
    this.sandboxDir = path.join('.sandbox', sandboxId);
  }

  getSandboxId(): string | null {
    return this.sandboxId;
  }

  isAlive(): boolean {
    if (this.isDead) return false;
    const elapsed = Date.now() - this.lastActivityTime;
    if (elapsed > IDLE_TIMEOUT_MS) {
      this.isDead = true;
      return false;
    }
    return true;
  }

  async resetTimeout(): Promise<boolean> {
    if (!this.isAlive()) {
      return false;
    }
    this.lastActivityTime = Date.now();
    return true;
  }

  async execute(command: string, options?: ExecuteOptions): Promise<CommandResult> {
    // Check if sandbox is still alive and reset timeout
    if (!this.isAlive()) {
      throw new SandboxTimeoutError();
    }
    this.lastActivityTime = Date.now();

    // Ensure sandbox directory exists
    await fs.mkdir(this.sandboxDir, { recursive: true });

    const [cmd] = command.trim().split(/\s+/);

    if (!ALLOWED_COMMANDS.includes(cmd)) {
      return {
        stdout: '',
        stderr: `Command "${cmd}" not allowed. Allowed: ${ALLOWED_COMMANDS.join(', ')}`,
        exitCode: 1,
      };
    }

    const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
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
        if ('killed' in error && error.killed) {
          return {
            stdout: '',
            stderr: `Command timed out (${timeout / 1000}s)`,
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
