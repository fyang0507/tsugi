# SkillForge

## Product Vision

Agentic framework where AI agents learn from trial-and-error execution and codify learnings into reusable skills.

**Core Value:** Run 1 = Research + Skill Creation. Run 2 = Skill Lookup + Skip Research.

Skills encode two knowledge types:
- **Procedural**: Integration gotchas, validation rules, error patterns
- **Preferences**: User's taxonomies, classification rules, domain constraints

## Architecture

**Dual-Agent System:**
- **Task Agent** (`task-agent.ts`): Executes tasks in sandbox, read-only skill access, suggests codification
- **Skill Agent** (`skill-agent.ts`): Analyzes transcripts via `get-processed-transcript` tool, codifies skills

**Command Execution:**
```
executeCommand() [command-executor.ts]
├─ "skill *" → executeSkillCommand() [skill-commands.ts]
└─ else      → executeShellCommand() [shell-executor.ts]
```

**Sandbox Abstraction:**
- `SandboxExecutor` interface with `LocalSandboxExecutor` (dev) and `VercelSandboxExecutor` (prod)
- Agents use native shell commands (`ls`, `cat`, `python3`) transparently

**Storage:**
- `LocalStorage` (filesystem) for dev, `CloudStorage` (Vercel Blob + Turso) for prod

## Codebase Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── agent/          # SSE streaming endpoint
│   │   ├── conversations/  # CRUD for chat history
│   │   └── skills/         # Skills API
│   ├── task/               # Task execution page
│   └── page.tsx            # Main chat UI
├── components/             # React components (ChatMessage, Sidebar, etc.)
├── hooks/                  # useForgeChat, useConversations, useSkills
└── lib/
    ├── agent/              # Core agent logic
    │   ├── task-agent.ts   # Task execution agent
    │   ├── skill-agent.ts  # Skill codification agent
    │   └── tools/          # execute-shell, grounding, process-transcript
    ├── db/                 # SQLite/Turso database layer
    ├── sandbox/            # Sandbox executors (local/Vercel)
    ├── skills/             # Skill storage (local/cloud)
    └── tools/              # Command execution layer
playground/                 # Demo tasks (discord, stripe, youtube-notion)
MEMORY/                     # Plans, changelogs, progress tracking
```

## Tech Stack

- **Package Manager**: `pnpm` (not npm)
- Next.js + React frontend with SSE streaming
- Gemini API with KV caching and built-in grounding (`googleSearch`, `urlContext`)
- SQLite (Turso) for conversations + skills metadata

## Testing

**Runner:** Vitest (`pnpm test`)
**Coverage:** Unit tests for storage, sandbox executors, and command execution.
**UI Verification:** Use Chrome DevTools MCP to verify non-trivial frontend changes.

## Playground Tasks

Attached 4 tasks for testing/demo purposes in `playground/`
- send discord message (using discord webhook api)
- create stripe transaction (using stripe API)
- generate video summary for watchlist

## Project Memory

`MEMORY/` directory holds plans, changelogs, and completed issues. Check `MEMORY/changelog.md` for recent updates.
