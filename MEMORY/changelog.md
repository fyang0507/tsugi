# Changelog

Last Updated: 2026-01-13

## 2026-01-13: Sidebar Skills Pane (VSCode-style)

- Moved skills list from modal to sidebar with collapsible sections (Chat History grows down, Skills pinned at bottom)
- Created `useSkills` hook with 5s polling and optimistic delete
- Fixed menu positioning with `position: fixed` + `getBoundingClientRect()` to escape parent overflow clipping
- Deleted `SkillsPanel.tsx` modal; added `SkillDetailModal` for viewing skill content
- Works with both LocalStorage (filesystem) and CloudStorage (Vercel Blob + Turso)

## 2026-01-13: Persist Agent Mode Across Conversation

- Added `mode` column to conversations table with migration for existing DBs
- Mode persists when clicking "Codify Skill" and restores when switching conversations
- Follow-up messages now use persisted mode instead of defaulting to 'task'

## 2026-01-11: Cloud Skill Storage + Lint Fixes

- Implemented storage abstraction: LocalStorage (filesystem) for dev, CloudStorage (Vercel Blob + Turso) for production
- Added skills API endpoints (GET/POST/DELETE) and SkillsPanel UI with delete functionality
- Fixed all lint errors: removed unused imports, added venv to eslint ignores, fixed React hooks deps

## 2026-01-08: Fix Lossy Message Persistence

- Fixed data loss when switching conversations: now stores both `iterations` and `parts` in DB
- Deleted lossy `reconstructParts()` function that couldn't recreate agent tools, reasoning, or sources
- Breaking change: old conversation data no longer compatible (dev mode, no migration needed)

## 2026-01-08: Conversation Persistence + Sidebar

- Implemented SQLite persistence with conversations/messages tables and full CRUD API routes
- Added collapsible sidebar with conversation history grouped by date (Today/Yesterday/Last 7 days/etc)
- Fixed race conditions in message persistence using refs (`currentIdRef`, `isSwitchingRef`)
- Enforced single "New conversation" limit - clicking New Chat switches to existing empty conversation
- Smart delete behavior: deleting "New conversation" switches to another existing conversation
- Fixed duplicate message saving with `messageCountRef` index check; removed legacy fallback for KV cache

## 2026-01-07: KV Cache Conversation Fix

- Fixed multi-iteration conversation reconstruction breaking KV cache prefix matching
- Added `AgentIteration` interface to properly track each agentic loop iteration with its rawContent and toolOutput
- Changed apiMessages builder to expand iterations in correct order (assistant → tool output → assistant...)

## 2026-01-05: Token Usage Stats

- Added per-message and cumulative stats display: prompt/completion/cached/reasoning tokens + execution time
- Created `MessageStats` and `CumulativeStats` components with cache hit ratio calculation
- Extended SSE stream with `usage` events carrying reasoning tokens and server-measured execution time

## 2026-01-05: UI Improvements

- Rewrote ChatMessage with parts-based rendering: reasoning traces, tool calls, agent tools, text, and sources
- Added Google Search tool indicator for Gemini grounding (synthetic from `source` events at top of response)
- Added URL Context tool indicator (heuristic: detects URLs in user message, shows analyzing state)
- Implemented markdown rendering with `react-markdown` and `@tailwindcss/typography`
- Extended SSE stream to handle `reasoning-delta`, `tool-call`, `tool-result`, and `source` events

## 2026-01-05: Shell Execution + Code Cleanup

- Enabled real shell command execution via `curl` (allowlisted) with timeout protection
- Added cache usage telemetry to SSE stream for monitoring Gemini KV cache efficiency
- Removed test skills and unused `shell.ts` tool; relocated skills to `.skills/` directory
- Fixed CSS overflow issues in ChatMessage component with `break-all` for long strings

## 2025-01-04: Shell Commands + Chat Interface

- Implemented shell command auto-execution: agent outputs `<shell>` tags, system executes commands and feeds results back
- Built full chat UI with `useForgeChat` hook supporting SSE streaming, message history, and abort handling
- Fixed KV cache preservation by using proper `ModelMessage[]` arrays instead of concatenated prompt strings
- Added `ChatMessage` component with special rendering for shell commands and terminal output blocks


## 2026-01-03 - Initial MVP Implementation

- Built complete SkillForge MVP: YouTube URL → AI analysis → SKILL.md generation
- Implemented skill command system (list/search/get/set) with Fuse.js fuzzy search
- Created streaming API endpoint with automatic skill extraction and persistence
- Demo UI with terminal-style output for real-time agent feedback
