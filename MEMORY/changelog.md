# Changelog

Last Updated: 2026-01-19

## 2026-01-19: Demo Comparison Mode + Token Fix

- **Comparison mode UI**: 3-pane layout (left/right conversation panes + middle skills showcase) with Normal↔Comparison toggle, drag-and-drop from sidebar, click-to-select with "Add to Left/Right" buttons, and MetricsBar showing time/token savings
- **Multi-step token counting fix**: Agent route now accumulates usage from `step-finish` events for accurate totals across multi-turn tool-calling flows (was only capturing final step before)
- **CSS overflow fixes**: ChatMessage tool/shell parts now use `min-w-0 flex-1 truncate` for proper flexbox containment; user messages use `word-break: break-word` + `overflow-wrap: anywhere`

## 2026-01-19: Agent stopWhen Termination Fix

- **Built-in multi-step**: Replaced manual while-loop in `route.ts` with agent's native `stopWhen` condition - agents now handle multi-step execution internally
- **COMPLETE signal detection**: Both `task-agent.ts` and `skill-agent.ts` use `hasCompleteSignal` stop condition that checks if output ends with "COMPLETE"
- **Dual stop conditions**: Agents configured with `stopWhen: [stepCountIs(10), hasCompleteSignal]` - stops on either 10 steps or COMPLETE signal
- **Root cause**: Previous manual loop only checked `hasToolCalls`, ignoring the "COMPLETE" text signal which caused extra iterations after completion

## 2026-01-19: Transcript Fidelity Improvements

- **Full execution history**: `toTranscriptString()` now processes `parts` array (reasoning, agent-tool, text) instead of lossy `iterations`, giving skill agent complete visibility into tool calls and reasoning
- **Actual vs invented**: Updated process-transcript prompt to extract "shortest path using ONLY tools/methods actually used" - prevents suggesting alternative implementations
- **Skill agent guidance**: Added principle that value is in capturing the ACTUAL working procedure, not inventing a "better" approach

## 2026-01-19: Skill Agent Shell Tool Migration

- **Skill agent migrated**: Converted from `<shell>` literal text pattern to proper `execute_shell` tool, matching task-agent architecture
- **Shared tool module**: Extracted `executeShellTool` into `src/lib/agent/tools/execute-shell.ts` - both agents now import from single source
- **ThinkingConfig added**: Task agent now includes `thinkingLevel: 'low'` in providerOptions (skill agent already had it)
- **Updated instructions**: Skill agent docs now reference tool calls instead of literal text syntax

## 2026-01-18: Shell Execution Migration to AI SDK Tool

- **execute_shell tool**: Converted shell execution from `<shell>` literal text pattern to proper AI SDK tool with zod schema validation
- **Simplified agent loop**: Removed manual shell tag parsing and command execution - AI SDK now handles tool execution automatically
- **RequestContext extension**: Added `env` field to pass environment variables to tool's execute function
- **In-progress fixes**: Addressing AI SDK property naming (`input` vs `args`)

## 2026-01-17: Environment-Based Model Provider Selection

- **Centralized provider config**: New `model-provider.ts` handles Google AI vs Vercel Gateway selection based on env vars
- **Graceful Braintrust fallback**: New `braintrust-wrapper.ts` warns and continues without tracing if `BRAINTRUST_API_KEY` or `PROJECT_NAME` missing
- **Mode-aware model returns**: Gateway uses string IDs (`'google/gemini-3-pro-preview'`), direct uses instantiated models (`provider(...)`)

## 2026-01-17: Command ID Tracking for Shell Commands

- **Fixed duplicate command bug**: Multiple/identical shell commands now properly track through queued→running→completed states via unique `commandId` (format: `cmd-{iteration}-{index}`)
- **Backend changes**: `route.ts` detects commands during streaming and assigns IDs; execution loop includes IDs in all SSE events
- **Frontend changes**: `useForgeChat.ts` matches tool-start/tool-result events by commandId instead of command string
- **Test coverage**: Added `command-parser.test.ts` (16 tests) and `command-id-tracking.test.ts` (11 tests) in `src/lib/tools/__tests__/`

## 2026-01-17: Skill Suggest Unification + Test Fixes

- **Unified `skill suggest` syntax**: Changed from `--update="name"` to `--name="name" [--force]` with backend fuzzy search detection
- **Two-phase flow**: Backend returns `status: 'success'` (no similar skills) or `status: 'guidance'` (similar found, agent reviews then uses `--force`)
- **Search scoring**: Added `SkillSearchResult` interface with similarity score (0-1), storage search now returns scores
- **Test isolation fixes**: Fixed sandbox path issues (`LocalSandboxExecutor` uses `.sandbox/{sandboxId}`), added `clearSandboxExecutor()` calls between tests

## 2026-01-16: Sandbox Sharing Between TaskAgent and SkillAgent

- **Cross-request sandbox reuse**: Added `sandboxId` support - frontend tracks sandbox ID and passes it in subsequent requests
- **SSE event**: New `sandbox_created` event emits sandbox ID after first shell command execution
- **Vercel SDK reconnect**: `VercelSandboxExecutor` uses `Sandbox.get({ sandboxId })` to reconnect to existing sandbox
- **Local sandbox**: `LocalSandboxExecutor` uses sandboxId as directory name (`.sandbox/{id}`) for file persistence

## 2026-01-16: UI-Based Environment Variable Injection

- **API Keys panel**: Collapsible UI above input with key/value form, validation (uppercase, alphanumeric+underscore), masked values, delete buttons
- **Environment merge chain**: UI vars → `.env.playground` (local) or Vercel env (prod) → process.env
- **Sandbox directory fix**: `LocalSandboxExecutor.execute()` now auto-creates `.sandbox` directory before command execution (fixes ENOENT error)
- **New files**: `playground-env.ts` (env loader), updated `command-executor.ts`, `shell-executor.ts`, `route.ts`, `useForgeChat.ts`, `ForgeDemo.tsx`

## 2026-01-15: Agent Prompt Improvements - Skills vs Sandbox Clarity

- **Fixed skill agent shell syntax**: Added explicit "Shell Commands (Literal Text)" section - agent was calling `execute_shell_command` as a function instead of outputting `<shell>` literal text
- **Added Skills vs Sandbox documentation**: Both agents now explain the separation (skills = persistent library, sandbox = ephemeral execution workspace) and that skill files must be copied to sandbox before execution
- **Code generalization guidance**: Skill agent now instructed to parameterize hardcoded values (URLs, IDs, tokens → env vars) before saving, not just copy verbatim

## 2026-01-15: Sandbox Idle Timeout + Frontend Notification

- **Idle timeout**: Sandbox auto-terminates after 5 minutes of inactivity (tracked via `lastActivityTime`)
- **New SSE event**: `sandbox_timeout` sent when timeout occurs, frontend shows dismissible amber banner
- **SandboxTimeoutError**: New error class thrown by executors when sandbox is dead
- **Interface extension**: Added `resetTimeout()` and `isAlive()` to `SandboxExecutor` interface

## 2026-01-15: Transparent Sandbox + Shell Redirection Fix

- **New architecture**: Split command execution into `command-executor.ts` (router) + `shell-executor.ts` (shell) + `skill-commands.ts` (skills-only)
- **Removed** explicit `sandbox *` commands - agent now uses native shell (`ls`, `cat`, etc.) transparently
- **Renamed** `sandbox add-to-skill` → `skill add-file` for consistency
- **Simplified** `SandboxExecutor.execute()` to `(command, options?)` - validates first word, passes full string
- **Updated agent instructions**: task-agent gets execution workspace docs, skill-agent gets code extraction workflow
- Shell operators (`|`, `&&`, `>`, `>>`) now work correctly on both local and Vercel environments

## 2026-01-15: Unified Sandbox Executor Interface

- Created `SandboxExecutor` abstraction layer with `LocalSandboxExecutor` (child_process + fs) and `VercelSandboxExecutor` (@vercel/sandbox SDK)
- Refactored `skill-commands.ts` to use the new interface, enabling environment-agnostic sandbox operations
- Added `@vercel/sandbox@^1.2.0` dependency for isolated microVM execution in production

## 2026-01-14: Skill Agent Transcript Tool

- Added `get-processed-transcript` tool that fetches task conversation from DB and summarizes with Gemini Flash
- Skill agent now starts with blank context—calls tool first to get compressed transcript instead of receiving full message history
- Updated UI to show "Task Summary" tool call with purple indicator and markdown-rendered output

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
