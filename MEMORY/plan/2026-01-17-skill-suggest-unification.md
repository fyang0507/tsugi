# Skill Suggest/Update Unification

## Problem

TaskAgent uses `skill suggest "desc" --update="skill-name"` without verifying if the skill exists. This creates confusion:
- Agent suggests updating a non-existent skill
- No clear distinction between create vs update actions
- No decision point for agent when similar skill found

## Solution: Unified Command + Two-Phase Flow

Single command syntax with backend detection. Agent gets explicit decision point on conflicts.

### Command Syntax (Unified)

```
skill suggest "what was learned" --name="skill-name"
skill suggest "what was learned" --name="skill-name" --force   # skip guidance check
```

- `--name` is **required**
- `--force` skips fuzzy search (used after agent reviews guidance)

### Backend Logic

```
1. If --force flag present → Return success (skip fuzzy search)
2. Fuzzy search using --name value
   ├─ Match found (score >= threshold) → Return guidance
   └─ No match → Return success
```

### Response Types

```typescript
// Success - no similar skills (or --force used)
{ status: 'success', name: 'skill-name', learned: '...' }

// Guidance - similar skill(s) found
{
  status: 'guidance',
  suggestedName: 'skill-name',
  similarSkills: ['skill-1', 'skill-2'],
  learned: '...',
  message: 'Similar skill(s) found: "skill-1", "skill-2". Use `skill get <name>` to review. To proceed anyway, re-run with --force flag.'
}
```

### Agent Flow

**Scenario A: No similar skills**
```
Agent: skill suggest "learned youtube API" --name="youtube-fetcher"
Backend: { status: 'success', action: 'create', name: 'youtube-fetcher' }
→ UI shows skill suggestion card, user can approve/edit
```

**Scenario B: Similar skill found (guidance)**
```
Agent: skill suggest "learned youtube API" --name="youtube-fetcher"
Backend: { status: 'guidance', similarSkills: ['youtube-to-notion'], message: '...' }

Agent sees the guidance and may:
  1. skill get youtube-to-notion                              # review existing skill
  2. skill suggest "..." --name="youtube-to-notion" --force   # overwrite existing
  OR
  2. skill suggest "..." --name="video-transcriber" --force   # create new with different name
```

## Changes

### 1. `src/lib/tools/skill-commands.ts`

```typescript
const SIMILARITY_THRESHOLD = 0.5;

'suggest': async (args) => {
  // Parse: skill suggest "description" --name="skill-name" [--force]
  const match = args.match(/^"([^"]+)"\s+--name="([^"]+)"(\s+--force)?$/);
  if (!match) {
    return JSON.stringify({
      type: 'skill-suggestion-error',
      error: 'Usage: skill suggest "description" --name="skill-name" [--force]',
    });
  }

  const [, learned, skillName, forceFlag] = match;
  const storage = getStorage();

  // If --force, skip fuzzy search
  if (forceFlag) {
    return JSON.stringify({
      type: 'skill-suggestion',
      status: 'success',
      name: skillName,
      learned,
    });
  }

  // Fuzzy search using requested name
  const results = await storage.search(skillName);
  const similarSkills = results
    .filter(r => r.score >= SIMILARITY_THRESHOLD)
    .map(r => r.name);

  if (similarSkills.length > 0) {
    const skillList = similarSkills.slice(0, 3).map(s => `"${s}"`).join(', ');
    return JSON.stringify({
      type: 'skill-suggestion',
      status: 'guidance',
      suggestedName: skillName,
      similarSkills,
      learned,
      message: `Similar skill(s) found: ${skillList}. Use \`skill get <name>\` to review. To proceed anyway, re-run with the same parameters and add --force flag.`,
    });
  }

  // No match - success
  return JSON.stringify({
    type: 'skill-suggestion',
    status: 'success',
    name: skillName,
    learned,
  });
}
```

### 2. `src/components/ChatMessage.tsx`

Update `SkillSuggestion` interface:

```typescript
interface SkillSuggestion {
  type: 'skill-suggestion';
  status: 'success' | 'guidance';
  learned: string;
  name?: string;           // For status: 'success'
  suggestedName?: string;  // For status: 'guidance'
  similarSkills?: string[];
  message?: string;
}
```

Update UI rendering:
- `status === 'success'`: Show skill card with approve button
- `status === 'guidance'`: Show guidance message (agent will re-run with --force)

### 3. `src/lib/agent/task-agent.ts`

Update instructions:

```markdown
## Ending a Task
When the task is complete:
1. Summarize what was accomplished
2. If a reusable procedure was learned, suggest codifying it:
   <shell>skill suggest "what was learned" --name="suggested-skill-name"</shell>

   The backend will respond with one of:
   - `status: 'success'` - No similar skills, proceed
   - `status: 'guidance'` - Similar skill(s) found:
     - Use `skill get <name>` to review existing skill(s)
     - Re-run with --force to proceed anyway
```

### 4. `src/hooks/useForgeChat.ts` (if needed)

May need to handle `skill-suggestion` with `status: 'guidance'` differently than `status: 'success'`:
- `status: 'success'` → Show skill card UI
- `status: 'guidance'` → Show as informational text (agent will respond with new command)

## Testing

1. **No similar skills**:
   - `skill suggest "learned X" --name="new-skill"` → `status: 'success'`

2. **Similar skill found**:
   - Create skill "youtube-to-notion"
   - `skill suggest "learned X" --name="youtube-fetcher"` → `status: 'guidance'`

3. **Force after guidance**:
   - `skill suggest "learned X" --name="youtube-fetcher" --force` → `status: 'success'`

4. **Exact name also triggers guidance**:
   - `skill suggest "learned X" --name="youtube-to-notion"` → `status: 'guidance'`
   - `skill suggest "learned X" --name="youtube-to-notion" --force` → `status: 'success'`

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/tools/skill-commands.ts` | Make `suggest` async, add fuzzy search logic |
| `src/components/chat/ChatMessage.tsx` | Update SkillSuggestion interface, handle guidance status |
| `src/lib/agent/task-agent.ts` | Update instructions with unified `--name` syntax |
| `src/hooks/useForgeChat.ts` | Handle guidance vs success status display (if needed) |
