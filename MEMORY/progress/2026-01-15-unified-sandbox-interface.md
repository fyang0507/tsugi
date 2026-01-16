# Unified Sandbox Interface Implementation

Last Updated: 2026-01-15

## Summary

Implemented a unified `SandboxExecutor` abstraction that provides consistent command execution and file operations across environments:
- **Local**: Uses `child_process.exec()` with allowlisted commands + filesystem
- **Vercel**: Uses `@vercel/sandbox` SDK for isolated microVM execution

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/sandbox/executor.ts` | Interface + factory (`getSandboxExecutor()`) |
| `src/lib/sandbox/local-executor.ts` | Local implementation with command allowlist |
| `src/lib/sandbox/vercel-executor.ts` | Vercel SDK implementation (no allowlist - microVM isolated) |
| `src/lib/sandbox/__tests__/local-executor.test.ts` | 16 unit tests |
| `src/lib/sandbox/__tests__/vercel-executor.test.ts` | 7 tests (skipped unless `VERCEL=1`) |

## Interface

```typescript
interface SandboxExecutor {
  execute(command: string, args?: string[], options?: ExecuteOptions): Promise<CommandResult>;
  writeFile(path: string, content: string | Buffer): Promise<void>;
  readFile(path: string): Promise<string | null>;
  listFiles(path?: string): Promise<string[]>;
  cleanup(): Promise<void>;
}
```

## Key Design Decisions

1. **Environment selection**: `process.env.VERCEL === '1'` determines which executor to use
2. **Caching**: Executor cached at module level for session-scoped sandbox reuse
3. **Local security**: 26 allowlisted commands (curl, python3, ls, etc.)
4. **Vercel isolation**: No allowlist needed - microVM provides isolation
5. **Dynamic imports**: Vercel SDK only loaded when `VERCEL=1` to avoid bundling issues

## Migration

`skill-commands.ts` refactored to use `getSandboxExecutor()` instead of direct `execAsync`/`fs` calls. All existing skill and sandbox commands work unchanged.
