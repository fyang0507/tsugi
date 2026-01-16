# Unified Sandbox Interface Plan

## Objective

Create a unified `SandboxExecutor` abstraction (like `SkillStorage`) that works:
- **Locally**: Uses Node.js `child_process` + filesystem
- **Vercel**: Uses `@vercel/sandbox` SDK for isolated microVM execution

## Current State

- Local sandbox implemented in [skill-commands.ts](src/lib/tools/skill-commands.ts)
- Uses `child_process.exec()` with allowlisted commands
- `.sandbox/` directory for file operations
- No abstraction layer exists yet

## Architecture

### Interface Definition

```typescript
// src/lib/sandbox/executor.ts
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SandboxExecutor {
  // Execute a command in the sandbox
  execute(command: string, args?: string[], options?: ExecuteOptions): Promise<CommandResult>;

  // File operations
  writeFile(path: string, content: string | Buffer): Promise<void>;
  readFile(path: string): Promise<string | null>;
  listFiles(path?: string): Promise<string[]>;

  // Lifecycle
  cleanup(): Promise<void>;
}

export interface ExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  sudo?: boolean;
}
```

### Implementation Classes

| Class | Environment | Backing |
|-------|-------------|---------|
| `LocalSandboxExecutor` | Development | `child_process.exec()` + `fs` |
| `VercelSandboxExecutor` | Production | `@vercel/sandbox` SDK |

### Environment Selection

```typescript
// src/lib/sandbox/executor.ts
export function getSandboxExecutor(): SandboxExecutor {
  if (process.env.VERCEL === '1') {
    return new VercelSandboxExecutor();
  }
  return new LocalSandboxExecutor();
}
```

## Files to Create/Modify

### New Files

1. **`src/lib/sandbox/executor.ts`** - Interface + factory function
2. **`src/lib/sandbox/local-executor.ts`** - Local implementation (extract from skill-commands.ts)
3. **`src/lib/sandbox/vercel-executor.ts`** - Vercel Sandbox SDK implementation
4. **`src/lib/sandbox/__tests__/local-executor.test.ts`** - Local executor tests
5. **`src/lib/sandbox/__tests__/vercel-executor.test.ts`** - Vercel executor tests (skip if no credentials)

### Modify

6. **`src/lib/tools/skill-commands.ts`** - Replace direct `execAsync`/`fs` calls with `getSandboxExecutor()`
7. **`package.json`** - Add `@vercel/sandbox` dependency

## Implementation Details

### LocalSandboxExecutor

Extract existing logic from `skill-commands.ts`:
- **Allowlisted commands check** (security for local dev environment)
- Timeout handling (10s default)
- Output truncation
- `.sandbox/` directory management

```typescript
// src/lib/sandbox/local-executor.ts
export class LocalSandboxExecutor implements SandboxExecutor {
  private sandboxDir = '.sandbox';

  async execute(command: string, args: string[] = []): Promise<CommandResult> {
    // Extract from runShellCommand()
    const fullCommand = [command, ...args].join(' ');
    const { stdout, stderr } = await execAsync(fullCommand, { timeout: 10000 });
    return { stdout, stderr, exitCode: 0 };
  }

  async writeFile(path: string, content: string | Buffer): Promise<void> {
    await fs.writeFile(`${this.sandboxDir}/${path}`, content);
  }

  async readFile(path: string): Promise<string | null> {
    try {
      return await fs.readFile(`${this.sandboxDir}/${path}`, 'utf-8');
    } catch { return null; }
  }

  async listFiles(path?: string): Promise<string[]> {
    const dir = path ? `${this.sandboxDir}/${path}` : this.sandboxDir;
    return await fs.readdir(dir);
  }

  async cleanup(): Promise<void> {
    await fs.rm(this.sandboxDir, { recursive: true, force: true });
    await fs.mkdir(this.sandboxDir, { recursive: true });
  }
}
```

### VercelSandboxExecutor

New implementation using `@vercel/sandbox`:

**Key decisions:**
- **Default runtime**: `python3.13` (matches task-agent examples)
- **No command allowlist**: Vercel Sandbox is already isolated in a microVM

```typescript
// src/lib/sandbox/vercel-executor.ts
import { Sandbox } from '@vercel/sandbox';

export class VercelSandboxExecutor implements SandboxExecutor {
  private sandbox: Sandbox | null = null;
  private workDir = '/vercel/sandbox';

  private async ensureSandbox(): Promise<Sandbox> {
    if (!this.sandbox) {
      this.sandbox = await Sandbox.create({
        runtime: 'python3.13',
        timeout: 300000  // 5 min default
      });
    }
    return this.sandbox;
  }

  async execute(command: string, args: string[] = [], options?: ExecuteOptions): Promise<CommandResult> {
    const sandbox = await this.ensureSandbox();
    const result = await sandbox.runCommand({
      cmd: command,
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
  }

  async writeFile(path: string, content: string | Buffer): Promise<void> {
    const sandbox = await this.ensureSandbox();
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    await sandbox.writeFiles([{ path: `${this.workDir}/${path}`, content: buffer }]);
  }

  async readFile(path: string): Promise<string | null> {
    const sandbox = await this.ensureSandbox();
    const stream = await sandbox.readFile({ path: `${this.workDir}/${path}` });
    if (!stream) return null;
    // Convert ReadableStream to string
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  async listFiles(path?: string): Promise<string[]> {
    const sandbox = await this.ensureSandbox();
    const dir = path ? `${this.workDir}/${path}` : this.workDir;
    const result = await sandbox.runCommand('ls', ['-1', dir]);
    const stdout = await result.stdout();
    return stdout.trim().split('\n').filter(Boolean);
  }

  async cleanup(): Promise<void> {
    if (this.sandbox) {
      await this.sandbox.stop();
      this.sandbox = null;
    }
  }
}
```

## Sandbox Lifecycle Considerations

### Local
- Stateless - each command is independent
- `.sandbox/` persists between commands within a conversation

### Vercel
- Sandbox instance should be reused within a conversation/session
- Need to call `cleanup()` when conversation ends
- Consider timeout extension for long conversations

### Session Management

For Vercel, the sandbox should persist for the duration of a task conversation. Options:

1. **Per-request creation** (simple, expensive): Create/destroy sandbox for each command
2. **Session-scoped** (recommended): Keep sandbox alive during conversation, stop on completion

The task-agent conversation handler should:
```typescript
const executor = getSandboxExecutor();
try {
  // ... run agent conversation ...
} finally {
  await executor.cleanup();
}
```

## Migration Path

1. Create interface and factory (`executor.ts`)
2. Implement `LocalSandboxExecutor` by extracting from `skill-commands.ts`
3. Add tests for local executor
4. Update `skill-commands.ts` to use `getSandboxExecutor()`
5. Implement `VercelSandboxExecutor`
6. Add tests for Vercel executor (skip if no credentials)
7. Add `@vercel/sandbox` to dependencies
8. Test on Vercel deployment

## Tests

### LocalSandboxExecutor Tests (`src/lib/sandbox/__tests__/local-executor.test.ts`)

```typescript
describe('LocalSandboxExecutor', () => {
  describe('execute', () => {
    it('should execute allowed commands');
    it('should reject disallowed commands');
    it('should handle command timeout');
    it('should return stdout, stderr, exitCode');
  });

  describe('writeFile', () => {
    it('should write file to sandbox directory');
    it('should create parent directories');
  });

  describe('readFile', () => {
    it('should read file from sandbox');
    it('should return null for non-existent file');
  });

  describe('listFiles', () => {
    it('should list files in sandbox');
    it('should return empty array when sandbox is empty');
  });

  describe('cleanup', () => {
    it('should remove all files from sandbox');
    it('should recreate empty sandbox directory');
  });
});
```

### VercelSandboxExecutor Tests (`src/lib/sandbox/__tests__/vercel-executor.test.ts`)

```typescript
// Skip tests if VERCEL_OIDC_TOKEN not available
const SKIP_VERCEL_TESTS = !process.env.VERCEL_OIDC_TOKEN;

describe.skipIf(SKIP_VERCEL_TESTS)('VercelSandboxExecutor', () => {
  describe('execute', () => {
    it('should execute Python code');
    it('should return command output');
  });

  describe('writeFile / readFile', () => {
    it('should write and read files in sandbox');
  });

  describe('cleanup', () => {
    it('should stop the sandbox');
  });
});
```

## Environment Variables

For Vercel Sandbox SDK authentication:
- **On Vercel**: Uses OIDC tokens automatically (no setup needed)
- **Local dev**: Run `vercel env pull` to get development tokens (expires every 12h)

## Verification

1. **Local executor**: Run existing tests - all sandbox commands should work unchanged
2. **Interface switch**: Add `VERCEL=1` locally, verify factory returns `VercelSandboxExecutor`
3. **Vercel executor**: Deploy to Vercel, run a task that executes Python code
4. **End-to-end**: Complete a task with code execution, codify skill, retrieve and run skill code

## Sources

- [Vercel Sandbox Docs](https://vercel.com/docs/vercel-sandbox)
- [Vercel Sandbox SDK Reference](https://vercel.com/docs/vercel-sandbox/sdk-reference)
- [@vercel/sandbox npm package](https://www.npmjs.com/package/@vercel/sandbox)
