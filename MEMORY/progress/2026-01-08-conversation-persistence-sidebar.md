# Conversation Persistence + Sidebar Implementation

Last Updated: 2026-01-08

## Summary
Implemented Phase 2 of conversation persistence: SQLite database storage with a collapsible sidebar for conversation history management.

## New Files Created

### Database Layer (`src/lib/db/`)
- `index.ts` - SQLite connection via @libsql/client, schema init, full CRUD for conversations/messages

### API Routes (`src/app/api/conversations/`)
- `route.ts` - GET (list all), POST (create new)
- `[id]/route.ts` - GET (with messages), PATCH (rename), DELETE
- `[id]/messages/route.ts` - POST (save message)

### UI Components
- `src/components/Sidebar.tsx` - Collapsible sidebar with grouped conversations
- `src/hooks/useConversations.ts` - React hook for conversation state management

## Key Implementation Details

### Race Condition Fixes
Used refs to avoid stale closure issues in memoized callbacks:
- `currentIdRef` - Tracks current conversation ID synchronously
- `isSwitchingRef` - Prevents URL sync loop during programmatic navigation

### Single "New conversation" Limit
- `handleNewChat` checks for existing "New conversation" before creating
- If exists and not current → switches to it
- If exists and is current → clears and focuses input
- Only creates new if none exists

### Smart Delete Behavior
- Delete "New conversation" with others existing → switch to another
- Delete "New conversation" with none existing → clear state, go to root URL
- Delete real conversation with others → switch to another
- Delete real conversation with none → create new "New conversation"

### KV Cache Preservation
DB stores `iterations` array (`[{ rawContent, toolOutput }, ...]`) which is the API-oriented format.
On conversation resume, `sendMessage` reconstructs exact API messages from iterations:
- Each `iter.rawContent` → assistant message
- Each `iter.toolOutput` → user message with `[Shell Output]\n` prefix

## Files Modified
- `ForgeDemo.tsx` - Integrated sidebar, persistence callbacks, conversation handlers
- `useForgeChat.ts` - Added `initialMessages` and `onMessageComplete` options
- `page.tsx` - Added Suspense wrapper for useSearchParams

## Bugs Fixed
1. Message persistence failing (currentId was null in callback)
2. Infinite loop on conversation switching (useEffect + URL sync)
3. Multiple "New conversation" entries being created
4. Delete not working for "New conversation" (immediate recreation)
5. Duplicate message constraint error - added `messageCountRef` index check to skip already-saved messages
6. KV cache preservation - removed legacy fallback that sent empty assistant messages
