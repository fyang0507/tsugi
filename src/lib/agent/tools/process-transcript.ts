import { getConversation } from '@/lib/db';
import { toTranscriptString, type DBMessage } from '@/lib/messages/transform';
import { getSandboxExecutor } from '@/lib/sandbox/executor';
import { getFlashModel } from '../model-provider';
import { getGenerateText } from '../braintrust-wrapper';

const TRANSCRIPT_PROCESSING_PROMPT = `You are a transcript processor. Analyze this task conversation and produce a structured summary optimized for skill codification.

## 1. Task
- What was the user trying to accomplish?
- What defined success for this task?
- Any constraints or preferences specified?

## 2. Steps Taken (Chronological)
Trace the actual execution path:
- Enumerate steps in order of execution
- Mark detours, failed attempts, and corrections with [DETOUR] or [ERROR]
- Note decision points and why certain paths were chosen
- Include shell commands executed (don't recite commands, describe their purposes)

## 3. Gotchas, Errors & Edge Cases
Document non-obvious issues:
- Errors encountered and their root causes
- API quirks, format issues, validation failures
- Environment-specific issues (paths, permissions, dependencies)
- Things that didn't work as expected

## 4. Files Generated
Sandbox artifacts created during this task:
{files-generated}

For each file above (if any), provide:
- Purpose and what it does
- Key content summary (main logic, config values)
- Dependencies on other files
- Whether reusable or task-specific

## 5. Reusable Patterns & Best Practices
Extract the "shortest path" for future similar tasks:
- What would the optimal approach be, knowing what we know now?
- Reusable code snippets or command patterns (reference files by name, don't inline code)
- Recommended tools/libraries for this task type
- What to avoid (anti-patterns discovered)

---
Transcript:
`;

/**
 * Fetch transcript from database by conversation ID and process it.
 * Returns a compressed summary for skill codification.
 *
 * @param conversationId - The conversation ID to fetch
 * @param sandboxId - Optional sandbox ID to fetch file listing from
 */
export async function processTranscript(
  conversationId: string,
  sandboxId?: string
): Promise<string> {
  // Fetch messages from database
  const result = await getConversation(conversationId);

  if (!result) {
    return 'Error: Conversation not found';
  }

  // Build transcript from messages using centralized transform utility
  const rawTranscript = toTranscriptString(result.messages as DBMessage[]);

  if (!rawTranscript.trim()) {
    return 'Error: No messages found in conversation';
  }

  // Fetch file listing from sandbox if sandboxId provided
  let filesGenerated = '(No sandbox files available)';
  if (sandboxId) {
    try {
      const executor = await getSandboxExecutor(sandboxId);
      const files = await executor.listFiles();
      filesGenerated = files.length > 0
        ? files.map(f => `- ${f}`).join('\n')
        : '(No files created)';
    } catch {
      filesGenerated = '(Could not retrieve sandbox files)';
    }
  }

  // Build final prompt with file listing injected
  const prompt = TRANSCRIPT_PROCESSING_PROMPT.replace('{files-generated}', filesGenerated) + rawTranscript;

  // Process with Gemini Flash
  const generateText = getGenerateText();
  const generated = await generateText({
    model: getFlashModel(),
    prompt,
  });

  return generated.text;
}
