# Skill Codification Separation

Last Updated: 2026-01-09

## Summary
Separated skill codification from task execution to address two agent misbehaviors:
1. Agent running `skill set` before completing the task (premature codification)
2. Agent codifying trivially simple skills (e.g., "how to summarize a video")

Solution: Task agent focuses purely on execution (read-only skill access), then suggests codification. A separate skill agent handles the actual codification when user confirms.

## New Files Created

### Agent Definitions (`src/lib/agent/`)
- `task-agent.ts` - Renamed from `forge-agent.ts`, simplified prompt with task classification
- `skill-agent.ts` - Dedicated agent for analyzing transcripts and codifying skills

### Plan Documentation
- `MEMORY/plan/2026-01-09-skill-codification-separation.md` - Implementation plan

## Key Implementation Details

### Task Classification
Task agent now classifies tasks before starting:
- **Trivial**: One-step operations, math → Execute directly, skip skill lookup
- **Generic capability**: Summarization, translation → Execute directly, skip skill lookup
- **Procedural**: Multi-step, APIs → Check skills first

### Skill Suggestion Marker
Task agent ends messages with a structured marker when codification is appropriate:
```
<!-- SKILL_SUGGESTION: {"learned": "description", "skillToUpdate": "skill-name or null"} -->
```

### When to Suggest Codification
- New procedure learned (debugging, trial-and-error, API discovery)
- Used existing skill BUT had to deviate/fix errors (skill was outdated)

### When NOT to Suggest
- Trivial tasks, generic model capabilities, one-step operations
- Existing skill worked perfectly as documented

### Skill Agent Workflow
1. Check if updating existing skill (from `skillToUpdate` field)
2. If updating: Read existing skill first with `skill get`
3. Merge new learnings with existing content (preserve what works, fix what's wrong)
4. Create/overwrite skill with `skill set`

### UI Changes
- **Green "Codify as Skill" button** - For new skills
- **Amber "Update Skill" button** - For updating existing skills (with refresh icon)
- Shows what was learned and which skill is being updated
- Loading state while skill agent runs

### API Mode Switching
Route accepts `mode` parameter:
- `'task'` (default) - Uses task agent
- `'codify-skill'` - Uses skill agent

## Files Modified
- `src/app/api/agent/route.ts` - Added mode switching, import skill agent
- `src/components/ChatMessage.tsx` - Skill suggestion detection, button rendering
- `src/components/ForgeDemo.tsx` - Codify skill handler, state management
- `src/hooks/useForgeChat.ts` - Added mode parameter to sendMessage

## Files Deleted
- `src/lib/agent/forge-agent.ts` - Replaced by task-agent.ts
