# SkillForge

## Product Vision

Agentic framework where AI agents learn from online resources (YouTube, docs) and codify learnings into reusable skills.

**Core Value:** Run 1 = Research + Skill Creation. Run 2 = Skill Lookup + Skip Research.

Skills encode two knowledge types:
- **Procedural**: Integration gotchas, validation rules, error patterns
- **Preferences**: User's taxonomies, classification rules, domain constraints

## Architecture

- **Agent**: Gemini with built-in grounding (`googleSearch`, `urlContext`) - no custom research tools
- **Shell**: Auto-execution via `<shell>` tags; allowlisted commands only (`curl`)
- **Skills CLI**: `skill list/search/get/set` commands handled server-side
- **Storage**: `.skills/[name]/SKILL.md` with YAML frontmatter

## Tech Stack

- Next.js + React frontend with SSE streaming
- Gemini API with KV caching for context persistence
- Parts-based message rendering (reasoning, tools, text, sources)

## Project Memory

`MEMORY/` holds plans, progress logs, and proposals. Check `MEMORY/changelog.md` for recent updates.
