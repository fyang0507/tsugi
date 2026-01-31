# Tsugi (次)

## Product Vision

Agentic framework where AI agents learn from trial-and-error execution and codify learnings into reusable skills. **"Explore once. Exploit next."**

Run 1 = Research + Skill Creation. Run 2 = Skill Lookup + Skip Research.
Skills encode two knowledge types:
- **Procedural**: Integration gotchas, validation rules, error patterns
- **Preferences**: User's taxonomies, classification rules, domain constraints

## Architecture

**Dual-Agent System:**
- **Task Agent** (`task-agent.ts`): Executes tasks in sandbox, read-only skill access, suggests codification
- **Skill Agent** (`skill-agent.ts`): Analyzes transcripts, codifies skills

**Command Execution:**
```
executeCommand() [command-executor.ts]
├─ "skill *" → executeSkillCommand() [skill-commands.ts]
└─ else      → executeShellCommand() [shell-executor.ts]
```

**Storage:** `LocalStorage` (dev) / `CloudStorage` (Vercel Blob + Turso prod)
**Sandbox:** `LocalSandboxExecutor` (dev) / `VercelSandboxExecutor` (prod)

## Codebase Structure

```
src/
├── app/                    # Next.js App Router (api/, page.tsx)
├── components/             # chat/, landing/
├── hooks/                  # useTsugiChat/, useConversations.ts, useSkills.ts
└── lib/
    ├── agent/              # task-agent.ts, skill-agent.ts, tools/
    ├── db/                 # client.ts, conversations.ts, comparisons.ts
    ├── messages/           # transform.ts (canonical Message types)
    ├── sandbox/            # executor.ts, local-executor.ts, vercel-executor.ts
    ├── skills/             # storage.ts, local-storage.ts, cloud-storage.ts
    └── tools/              # command-executor.ts, shell-executor.ts, skill-commands.ts
data/                       # Local data storage
playground/                 # Demo tasks (discord, stripe, finance, youtube-notion)
MEMORY/                     # Plans, changelogs, progress tracking
```

## Testing

**Runner:** Vitest (`pnpm test`)
**Coverage:** Unit tests for storage, sandbox executors, and command execution.
**UI Verification:** Use Chrome DevTools MCP to verify non-trivial frontend changes.

## Playground Tasks

Demo tasks for testing/development in `playground/`.

## Tech Stack

- **Package Manager**: `pnpm` (not npm)
- Next.js + Vercel AI SDK, Gemini API with grounding, SQLite (Turso)
- Testing: `pnpm test` (Vitest), Chrome DevTools MCP for UI verification

## Project Memory

`MEMORY/` directory holds `plan/`, `progress/` for planned and completed issues, check `changelog.md` for recent updates.