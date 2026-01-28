/**
 * Unified Sandbox Executor Interface
 *
 * Provides a consistent abstraction for executing commands and file operations:
 * - LocalSandboxExecutor: Uses Node.js child_process + filesystem (development)
 * - VercelSandboxExecutor: Uses @vercel/sandbox SDK for isolated microVM (production)
 *
 * Sandbox Lifecycle:
 * - Each conversation gets its own sandbox (identified by sandboxId)
 * - Sandbox is created on first command execution or via initialize()
 * - Sandbox is terminated on: user abort, idle timeout (10min), or explicit cleanup
 * - Cross-request reconnection is supported via sandboxId
 */

export class SandboxTimeoutError extends Error {
  constructor(message = 'Sandbox timed out due to inactivity') {
    super(message);
    this.name = 'SandboxTimeoutError';
  }
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  sudo?: boolean;
}

export interface SandboxExecutor {
  /** Execute a command in the sandbox */
  execute(command: string, options?: ExecuteOptions): Promise<CommandResult>;

  /** Write a file to the sandbox */
  writeFile(path: string, content: string | Buffer): Promise<void>;

  /** Read a file from the sandbox, returns null if not found */
  readFile(path: string): Promise<string | null>;

  /** List files in the sandbox directory */
  listFiles(path?: string): Promise<string[]>;

  /** Clean up sandbox resources */
  cleanup(): Promise<void>;

  /** Reset the sandbox timeout to the default duration. Returns false if sandbox is dead. */
  resetTimeout(): Promise<boolean>;

  /** Check if sandbox is still alive */
  isAlive(): boolean;

  /** Get the current sandbox ID for reconnection across requests */
  getSandboxId(): string | null;

  /** Eagerly initialize the sandbox and return its ID. Used to get sandboxId before first command. */
  initialize(): Promise<string>;
}

// Per-request executor cache (used within a single API request for multiple tool calls)
// This is NOT used for cross-conversation caching - each new conversation creates a fresh executor
let requestExecutor: SandboxExecutor | null = null;
let sandboxRootDir: string = '.sandbox';

/**
 * Configure the sandbox root directory. Must be called before getSandboxExecutor().
 * Primarily used for testing to isolate sandbox from production data.
 */
export function configureSandbox(options: { sandboxRoot?: string }): void {
  if (options.sandboxRoot !== undefined) {
    sandboxRootDir = options.sandboxRoot;
  }
}

/**
 * Get the configured sandbox root directory.
 */
export function getSandboxRoot(): string {
  return sandboxRootDir;
}

/**
 * Get the appropriate sandbox executor for the current environment.
 *
 * Sandbox lifecycle rules:
 * - If sandboxId is provided: reconnect to existing sandbox (continuing a conversation)
 * - If no sandboxId: create a fresh sandbox for a new conversation
 * - Per-request caching ensures multiple tool calls in the same request share the executor
 *
 * @param sandboxId - Optional ID to reconnect to an existing sandbox
 * @param forceNew - If true, always create a new sandbox (ignores requestExecutor cache)
 */
export async function getSandboxExecutor(
  sandboxId?: string,
  forceNew: boolean = false
): Promise<SandboxExecutor> {
  // If reconnecting to a specific sandbox, create new executor with that ID
  if (sandboxId) {
    if (process.env.VERCEL === '1') {
      const { VercelSandboxExecutor } = await import('./vercel-executor');
      requestExecutor = new VercelSandboxExecutor(undefined, sandboxId);
    } else {
      const { LocalSandboxExecutor } = await import('./local-executor');
      requestExecutor = new LocalSandboxExecutor(sandboxId, sandboxRootDir);
    }
    return requestExecutor;
  }

  // For new conversations (no sandboxId), check if we should reuse the request-scoped executor
  // forceNew=true means we're starting a fresh conversation, so don't reuse
  if (!forceNew && requestExecutor && requestExecutor.isAlive()) {
    return requestExecutor;
  }

  // Create a fresh executor for this new conversation
  if (process.env.VERCEL === '1') {
    const { VercelSandboxExecutor } = await import('./vercel-executor');
    requestExecutor = new VercelSandboxExecutor();
  } else {
    const { LocalSandboxExecutor } = await import('./local-executor');
    // In local dev, use 'default' sandbox - isolation is less critical and tests expect this
    requestExecutor = new LocalSandboxExecutor('default', sandboxRootDir);
  }

  return requestExecutor;
}

/**
 * Clear the request-scoped executor. Call this when a conversation ends or user aborts.
 */
export async function clearSandboxExecutor(): Promise<void> {
  if (requestExecutor) {
    await requestExecutor.cleanup();
    requestExecutor = null;
  }
}

/**
 * Reset the request-scoped executor without cleanup (for between requests in same lambda).
 * The executor will be garbage collected; this just clears the reference.
 */
export function resetSandboxExecutorCache(): void {
  requestExecutor = null;
}
