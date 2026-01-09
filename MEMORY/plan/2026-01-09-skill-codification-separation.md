# Plan: Separate Skill Codification from Task Execution

## Problem Summary
1. Agent does `skill set` before completing task (premature codification)
2. Agent codifies trivially simple skills that aren't worth saving

## Solution Overview
- **Task Agent**: Focus purely on execution, can only *read* skills, suggests codification at end
- **Skill Agent**: Separate prompt triggered by user confirmation, analyzes transcript & creates skill

---

## Implementation Steps

### Step 1: Rename & Modify Task Agent
**Rename:** `src/lib/agent/forge-agent.ts` → `src/lib/agent/task-agent.ts`

Changes to instructions:

1. **Remove Phase 3 & 4** entirely (Knowledge Consolidation + Final Report with skill)

2. **Add task classification** at the start:
   ```
   ## Task Classification
   Before starting, classify the task:
   - **Trivial**: One-step operations, math, simple lookups → Execute directly, no skill lookup
   - **Generic capability**: Summarization, translation, explanations → Execute directly, no skill lookup
   - **Procedural**: Multi-step, integrations, APIs, configurations → Check skills first
   ```

3. **Remove write commands** from available shell commands:
   - Keep: `skill list`, `skill search`, `skill get`
   - Remove: `skill set`, `skill add-file`

4. **Add completion guidance**:
   ```
   ## Task Completion
   When task is verified complete:
   1. Report success to user
   2. If the task involved non-trivial learning (debugging, trial-and-error, API discovery), suggest:
      "Would you like me to codify this procedure as a reusable skill?"
   3. Do NOT suggest codification for trivial tasks or generic model capabilities
   ```

### Step 2: Create Skill Agent
**New file:** `src/lib/agent/skill-agent.ts`

```typescript
const SKILL_AGENT_INSTRUCTIONS = `You are a Skill Codification Agent.

You have been given a conversation transcript where a task was successfully completed.
Your job is to extract and codify the procedural knowledge gained.

## Your Task
1. Analyze the transcript to identify what was learned
2. Determine if this is worth codifying (skip if trivial or one-step)
3. If worth saving, create a well-structured skill

## What Makes a Good Skill
- Multi-step procedures with non-obvious ordering
- Integration gotchas (auth flows, API quirks, error handling)
- Debugging patterns that required trial-and-error
- User-specific preferences or constraints discovered

## What to Skip
- One-step operations
- Generic model capabilities (summarization, translation)
- Overly specific one-off tasks
- Tasks where nothing was "learned"

## Output Format
If worth saving:
<shell>skill set skill-name "---
name: skill-name
description: One-line description
---
# Title
## Prerequisites
...
## Steps
1. ...
## Common Issues
..."</shell>

If not worth saving:
Explain briefly why (e.g., "This was a straightforward one-step task with no procedural knowledge to capture.")
`
```

### Step 3: Add Skill Agent Route
**File:** `src/app/api/agent/route.ts`

Add a check for skill codification trigger:
- When user message contains confirmation like "yes", "codify", "save skill" after agent suggested codification
- Switch to skill agent prompt for that request
- Or: Add a `mode` parameter to the API: `task` (default) vs `codify-skill`

Alternative: Create separate route `/api/skill-agent/route.ts` that accepts conversation history and returns skill creation.

### Step 4: UI - Codify Skill Button
**Files:** `src/components/ChatMessage.tsx`, `src/components/ForgeDemo.tsx`

1. **Define suggestion marker** - Agent ends message with structured marker:
   ```
   <!-- SKILL_SUGGESTION: {"learned": "Notion API auth flow", "confidence": "high"} -->
   ```

2. **Detect in ChatMessage.tsx** - Parse last text part for marker, render button:
   ```tsx
   {skillSuggestion && (
     <button onClick={() => onCodifySkill(skillSuggestion)}>
       Codify as Skill
     </button>
   )}
   ```

3. **Handle in ForgeDemo.tsx** - `onCodifySkill` callback:
   - Sends message with `mode: 'codify-skill'` to API
   - Message content: "Codify the procedure from this conversation"
   - Backend routes to skill agent

4. **Visual state** - Button shows loading while skill agent runs, then disappears once skill is saved

---

## Files to Modify
1. `src/lib/agent/forge-agent.ts` → **rename to** `src/lib/agent/task-agent.ts` - Simplify prompt, add suggestion marker
2. `src/lib/agent/skill-agent.ts` - **New file** for skill codification prompt
3. `src/app/api/agent/route.ts` - Update import, add mode switching for skill agent
4. `src/components/ChatMessage.tsx` - Detect marker, render button
5. `src/components/ForgeDemo.tsx` - Handle button click, trigger skill agent

## Verification
1. Test trivial task (e.g., "what's 1+1") - should NOT trigger skill lookup or suggest codification
2. Test generic task (e.g., "summarize this video") - should NOT suggest codification
3. Test procedural task (e.g., "set up Notion API integration") - should suggest codification at end
4. Confirm skill codification by saying "yes" - should create well-structured skill
5. Verify skill agent skips if it determines task wasn't skill-worthy
