# SkillForge

## Product Vision

Agentic framework where AI agents learn from online resources (YouTube, docs) and codify learnings into reusable skills.

**Core Value:** Run 1 = Research + Skill Creation. Run 2 = Skill Lookup + Skip Research.

Skills encode two knowledge types:
- **Procedural**: Integration gotchas, validation rules, error patterns
- **Preferences**: User's taxonomies, classification rules, domain constraints

## Architecture

**Dual-Agent System:**
- **Task Agent** (`task-agent.ts`): Executes tasks, read-only skill access, suggests codification
- **Skill Agent** (`skill-agent.ts`): Dedicated to analyzing transcripts and codifying/updating skills

**Other Components:**
- **Shell**: Auto-execution via `<shell>` tags; allowlisted commands only (`curl`)
- **Skills CLI**: `skill list/search/get/set` commands handled server-side
- **Storage**: Abstraction layer - LocalStorage (filesystem) for dev, CloudStorage (Vercel Blob + Turso) for prod

## Tech Stack

- **Package Manager**: `pnpm` (not npm)
- Next.js + React frontend with SSE streaming
- Gemini API with KV caching and built-in grounding (`googleSearch`, `urlContext`)
- Parts-based message rendering (reasoning, tools, text, sources)
- SQLite (Turso) for conversations + skills metadata

## Project Memory

`MEMORY/` holds plans, progress logs, and proposals. Check `MEMORY/changelog.md` for recent updates.
