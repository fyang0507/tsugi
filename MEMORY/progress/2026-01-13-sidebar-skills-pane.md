# Sidebar Skills Pane - Implementation Summary

Last Updated: 2026-01-13 | Status: ✅ Complete

## Summary

Moved skills from a modal to a VSCode-style sidebar pane with collapsible sections.

## Changes Made

### New Files
- `src/hooks/useSkills.ts` - Skills data hook with 5s polling and optimistic delete

### Modified Files
- `src/components/Sidebar.tsx` - Added `CollapsibleSection`, `SkillItem` components
- `src/components/ForgeDemo.tsx` - Added `SkillDetailModal`, wired up `useSkills` hook

### Deleted Files
- `src/components/SkillsPanel.tsx` - Replaced by sidebar integration

## Key Implementation Details

### Sidebar Layout (Flexbox)
```
┌─────────────────────┐
│ New Chat Button     │  flex-shrink-0
├─────────────────────┤
│ ▼ Chat History      │  flex-1 overflow-y-auto (grows down)
│   • Conversations   │
├─────────────────────┤
│   <spacer>          │  flex-1 min-h-0
├─────────────────────┤
│ ▲ Skills            │  flex-shrink-0 max-h-[40vh] (pinned bottom)
│   • skill-name      │
└─────────────────────┘
```

### Menu Positioning Fix
The skill item dropdown menu was being clipped by parent `overflow-y-auto`. Fixed using:
- `position: fixed` with calculated pixel values from `getBoundingClientRect()`
- Calculates available space below; positions above if insufficient
- `z-index: 50` to escape stacking context

### Storage Compatibility
Verified both storage backends return identical `Skill` interface:
- `LocalStorage`: Reads from `.skills/{name}/SKILL.md` (filesystem)
- `CloudStorage`: Fetches from Vercel Blob, metadata from Turso DB
- Date objects serialize to ISO strings via `NextResponse.json()`

## Verification
- TypeScript check passes
- Menu renders correctly for bottom-positioned skill items
- Skills display in both local dev and cloud environments
