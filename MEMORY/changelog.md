# Changelog

Last Updated: 2026-01-08

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
