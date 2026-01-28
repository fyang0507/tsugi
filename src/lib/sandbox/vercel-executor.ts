import type { Sandbox } from '@vercel/sandbox';
import type { SandboxExecutor, CommandResult, ExecuteOptions } from './executor';
import { SandboxTimeoutError } from './executor';

const IDLE_TIMEOUT_MS = 600000; // 10 minutes idle timeout (user requirement)
const WORK_DIR = '/vercel/sandbox';

export class VercelSandboxExecutor implements SandboxExecutor {
  private sandbox: Sandbox | null = null;
  private workDir: string;
  private isDead: boolean = false;
  private lastActivityTime: number = Date.now();
  private existingSandboxId: string | null = null;

  constructor(workDir: string = WORK_DIR, existingSandboxId?: string) {
    this.workDir = workDir;
    this.existingSandboxId = existingSandboxId || null;
  }

  /**
   * Check if an error indicates the sandbox has timed out or stopped.
   */
  private isSandboxDeadError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      // Common patterns for sandbox timeout/death
      if (
        msg.includes('sandbox') &&
        (msg.includes('stopped') || msg.includes('not found') || msg.includes('timeout'))
      ) {
        return true;
      }
      // StreamError thrown when sandbox stops during streaming
      if (error.name === 'StreamError') {
        return true;
      }
    }
    return false;
  }

  private async ensureSandbox(): Promise<Sandbox> {
    if (this.isDead) {
      throw new SandboxTimeoutError();
    }
    if (!this.sandbox) {
      // Dynamic import to avoid loading @vercel/sandbox in local environment
      const { Sandbox } = await import('@vercel/sandbox');

      if (this.existingSandboxId) {
        // Reconnect to existing sandbox (cross-request sharing)
        try {
          this.sandbox = await Sandbox.get({ sandboxId: this.existingSandboxId });

          // Health check: verify sandbox is actually alive
          const healthCheck = await this.sandbox.runCommand({
            cmd: 'echo',
            args: ['ok'],
          });
          if (healthCheck.exitCode !== 0) {
            throw new Error('Health check failed');
          }
        } catch (error) {
          // Sandbox is dead, create a new one instead
          console.log('[Sandbox] Reconnect failed, creating new sandbox:', error);
          this.existingSandboxId = null;
          this.sandbox = await Sandbox.create({
            runtime: 'python3.13',
            timeout: IDLE_TIMEOUT_MS,
          });
        }
      } else {
        // Create new sandbox
        this.sandbox = await Sandbox.create({
          runtime: 'python3.13',
          timeout: IDLE_TIMEOUT_MS,
        });
      }
      this.lastActivityTime = Date.now();
    }
    return this.sandbox;
  }

  getSandboxId(): string | null {
    return this.sandbox?.sandboxId ?? null;
  }

  /**
   * Eagerly initialize the sandbox and return its ID.
   * This allows getting the sandboxId before any command is executed.
   */
  async initialize(): Promise<string> {
    const sandbox = await this.ensureSandbox();
    return sandbox.sandboxId;
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
    // Check idle timeout before executing
    if (!this.isAlive()) {
      throw new SandboxTimeoutError();
    }
    this.lastActivityTime = Date.now();

    try {
      const sandbox = await this.ensureSandbox();

      // Parse command string - use sh -c for shell operators, otherwise split
      const hasShellOperators = /[|><&;`$]|\|\||&&/.test(command);
      let cmd: string;
      let args: string[];

      if (hasShellOperators) {
        cmd = 'sh';
        args = ['-c', command];
      } else {
        const parts = command.trim().split(/\s+/);
        [cmd, ...args] = parts;
      }

      const result = await sandbox.runCommand({
        cmd,
        args,
        cwd: options?.cwd ?? this.workDir,
        env: options?.env,
        sudo: options?.sudo,
      });

      return {
        stdout: await result.stdout(),
        stderr: await result.stderr(),
        exitCode: result.exitCode,
      };
    } catch (error) {
      if (this.isSandboxDeadError(error)) {
        this.isDead = true;
        throw new SandboxTimeoutError();
      }
      throw error;
    }
  }

  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    const sandbox = await this.ensureSandbox();
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    const fullPath = `${this.workDir}/${filePath}`;

    await sandbox.writeFiles([{ path: fullPath, content: buffer }]);
  }

  async readFile(filePath: string): Promise<string | null> {
    const sandbox = await this.ensureSandbox();
    const fullPath = `${this.workDir}/${filePath}`;

    try {
      const stream = await sandbox.readFile({ path: fullPath });
      if (!stream) return null;

      // Convert ReadableStream to string
      const reader = (stream as unknown as ReadableStream<Uint8Array>).getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }

      return Buffer.concat(chunks).toString('utf-8');
    } catch {
      return null;
    }
  }

  async listFiles(subPath?: string): Promise<string[]> {
    const sandbox = await this.ensureSandbox();
    const dir = subPath ? `${this.workDir}/${subPath}` : this.workDir;

    try {
      const result = await sandbox.runCommand({
        cmd: 'ls',
        args: ['-1', dir],
      });

      const stdout = await result.stdout();
      return stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
  }

  async cleanup(): Promise<void> {
    if (this.sandbox) {
      await this.sandbox.stop();
      this.sandbox = null;
    }
    this.isDead = true;
  }
}
