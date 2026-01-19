# Fix: Skill Agent Not Terminating on "COMPLETE" Signal

## Problem
The skill-agent continues executing after outputting "COMPLETE" because:
1. `route.ts` has a manual while-loop that calls `agent.stream()` repeatedly
2. This bypasses the agent's built-in `stopWhen` mechanism
3. The loop only checks `hasToolCalls`, not the "COMPLETE" text signal

**Evidence:** Braintrust trace shows iteration 2 receives "COMPLETE" as input, proving the external loop continued past the first "COMPLETE" output.

---

## Solution: Use Agent's Built-in Loop with `stopWhen`

Remove the manual loop in route.ts and configure `stopWhen` on the agents.

### 1. File: `src/lib/agent/skill-agent.ts`

**Add import:**
```typescript
import { StopCondition, stepCountIs } from 'ai';
```

**Add tools object for type inference:**
```typescript
const skillAgentTools = {
  'get-processed-transcript': processedTranscriptTool,
  execute_shell: executeShellTool,
};
```

**Add custom stop condition:**
```typescript
// Stop when agent outputs "COMPLETE" signal
const hasCompleteSignal: StopCondition<typeof skillAgentTools> = ({ steps }) => {
  return steps.some(step => step.text?.trim().endsWith('COMPLETE')) ?? false;
};
```

**Update agent configuration:**
```typescript
function createSkillAgent() {
  const Agent = getAgent();
  return new Agent({
    model: getFlashModel(),
    instructions: SKILL_AGENT_INSTRUCTIONS,
    tools: skillAgentTools,
    stopWhen: [stepCountIs(10), hasCompleteSignal],
    providerOptions: { ... },
  });
}
```

### 2. File: `src/lib/agent/task-agent.ts`

Same pattern - add `stopWhen` with `hasCompleteSignal` condition (with `stepCountIs(10)` or appropriate limit).

### 3. File: `src/app/api/agent/route.ts`

**Remove the external while-loop.** Call `agent.stream()` once and let the agent handle multi-step internally:

```typescript
// Before: manual loop calling stream() repeatedly
while (iteration < MAX_ITERATIONS) {
  const result = await agent.stream({ messages });
  // ...process fullStream...
  if (!hasToolCalls) break;
}

// After: single stream() call, agent handles multi-step via stopWhen
const result = await agent.stream({ messages: modelMessages });
for await (const part of result.fullStream) {
  // ...process events (same switch/case logic)...
}
```

Key changes:
- Remove the `while (iteration < MAX_ITERATIONS)` loop
- Remove `messages.push()` accumulation (agent handles this internally)
- Keep the `for await` loop that processes stream events
- The `stopWhen` condition on the agent controls termination

---

## Verification
1. Run the skill-agent via the UI with a task that generates a skill
2. Verify in Braintrust that only one trace appears after the "COMPLETE" output
3. Verify multi-step tool calling still works (agent makes multiple tool calls before completing)
4. Test task-agent to ensure it also terminates correctly
