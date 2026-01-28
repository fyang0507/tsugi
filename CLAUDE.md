# Tsugi (次)

## Product Vision

Agentic framework where AI agents learn from trial-and-error execution and codify learnings into reusable skills. **"Explore once. Exploit next."**

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
│   │   ├── agent/          # Streaming endpoint (AI SDK UI)
│   │   ├── comparisons/    # A/B comparison API
│   │   ├── conversations/  # CRUD for chat history
│   │   ├── prompts/        # Prompts API
│   │   └── skills/         # Skills API
│   ├── task/               # Task execution page
│   └── page.tsx            # Main chat UI
├── components/
│   ├── chat/               # Chat UI (ChatLayout, SkillsPane, ComparisonPane, etc.)
│   └── landing/            # Landing page (Hero, HowItWorks, VisualizationDemo, etc.)
├── hooks/
│   ├── useTsugiChat/       # Chat hook wrapping AI SDK's useChat
│   ├── useConversations.ts # Conversation CRUD
│   └── useSkills.ts        # Skills management
└── lib/
    ├── agent/              # Core agent logic
    │   ├── task-agent.ts   # Task execution agent
    │   ├── skill-agent.ts  # Skill codification agent
    │   └── tools/          # execute-shell, grounding, process-transcript
    ├── db/                 # SQLite/Turso database layer
    ├── messages/           # Message transformation utilities
    ├── sandbox/            # Sandbox executors (local/Vercel)
    ├── skills/             # Skill storage (local/cloud)
    └── tools/              # Command execution layer
data/                       # Local data storage
playground/                 # Demo tasks (discord, stripe, finance, youtube-notion)
scripts/                    # Utility scripts
MEMORY/                     # Plans, changelogs, progress tracking
```

## Tech Stack

- **Package Manager**: `pnpm` (not npm)
- Next.js + React frontend with Vercel AI SDK UI (`@ai-sdk/react`)
- Gemini API with KV caching and built-in grounding (`googleSearch`, `urlContext`)
- SQLite (Turso) for conversations + skills metadata
- framer-motion for animations, lucide-react for icons

## Design System

Dark mode with aurora/gradient accents (cyan → purple → pink). Glass-morphism cards, framer-motion animations.

## Testing

**Runner:** Vitest (`pnpm test`)
**Coverage:** Unit tests for storage, sandbox executors, and command execution.
**UI Verification:** Use Chrome DevTools MCP to verify non-trivial frontend changes.

## Playground Tasks

Demo tasks for testing/development in `playground/`:
- `discord/` - Send Discord message (webhook API)
- `stripe/` - Create Stripe transaction (Stripe API)
- `finance/` - Morning brief generation
- `youtube-notion/` - Generate video summary for watchlist

## Project Memory

`MEMORY/` directory holds `plan/`, `progress/` for planned and completed issues, check `changelog.md` for recent updates.
