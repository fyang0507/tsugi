# Changelog

## 2025-01-04: Shell Commands + Chat Interface

- Implemented shell command auto-execution: agent outputs `<shell>` tags, system executes commands and feeds results back
- Built full chat UI with `useForgeChat` hook supporting SSE streaming, message history, and abort handling
- Fixed KV cache preservation by using proper `ModelMessage[]` arrays instead of concatenated prompt strings
- Added `ChatMessage` component with special rendering for shell commands and terminal output blocks
