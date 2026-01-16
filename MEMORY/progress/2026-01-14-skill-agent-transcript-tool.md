# Skill Agent Transcript Tool

Last Updated: 2026-01-14

## Summary

Implemented tool-based transcript injection for the skill agent. Instead of receiving the entire conversation history (wasteful), the skill agent now starts with a blank context and calls `get-processed-transcript` as its first action. The tool fetches the conversation from the database and compresses it with Gemini Flash.

## Implementation Details

### New Tool: `process-transcript.ts`

Created `src/lib/agent/tools/process-transcript.ts`:
- Fetches conversation by ID from SQLite via `getConversation()`
- Builds transcript string from messages including iterations and tool outputs
- Calls Gemini Flash to summarize with structured prompt (Goal, Steps, Commands, Gotchas, Solutions, Patterns)

### Skill Agent Changes

Modified `src/lib/agent/skill-agent.ts`:
- Added `get-processed-transcript` tool with `conversationId` parameter
- Updated instructions to require calling tool first
- Simplified instructions since context comes from tool output

### API Route Changes

Modified `src/app/api/agent/route.ts`:
- Added `conversationId` to request body for codify-skill mode
- For codify-skill: sends only the codify prompt (not full history)
- Injects conversation ID into message content for tool to parse

### Frontend Changes

Modified `src/hooks/useForgeChat.ts`:
- Added `conversationId` parameter to `sendMessage()`
- Passes ID when mode is `codify-skill`

Modified `src/components/ForgeDemo.tsx`:
- Passes `currentId` to `sendMessage()` for codify requests

Modified `src/components/ChatMessage.tsx`:
- Added "Task Summary" display for `get-processed-transcript` tool
- Purple indicator (vs blue for search tools)
- Markdown rendering for summary content
- Taller max-height (400px vs 200px) for readability

## Architecture Decision

Chose DB-fetch approach over closure approach from original plan:
- **Original plan**: Create agent per-request with transcript in closure
- **Final implementation**: Single agent instance, tool fetches by conversation ID

Reason: Avoids per-request agent instantiation overhead. The conversation ID is passed through the message and the tool queries the database directly.

## Files Changed

| File | Type | Change |
|------|------|--------|
| `src/lib/agent/tools/process-transcript.ts` | New | Transcript fetch + Gemini Flash summarization |
| `src/lib/agent/skill-agent.ts` | Modified | Added tool, updated instructions |
| `src/app/api/agent/route.ts` | Modified | Handle conversationId for codify mode |
| `src/hooks/useForgeChat.ts` | Modified | Pass conversationId in requests |
| `src/components/ForgeDemo.tsx` | Modified | Supply conversationId on codify |
| `src/components/ChatMessage.tsx` | Modified | Render Task Summary tool |
| `CLAUDE.md` | Modified | Minor wording updates |
