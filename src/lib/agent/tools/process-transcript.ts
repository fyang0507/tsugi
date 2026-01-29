import { getConversation } from '@/lib/db';
import { toTranscriptString } from '@/lib/messages/transform';
import { getSandboxExecutor } from '@/lib/sandbox/executor';
import { getFlashModel } from '../model-provider';
import { getStreamText } from '../braintrust-wrapper';
import { emitToolProgress } from '../request-context';

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
- Include shell commands executed (unless it's a generation command in which case the file can be cross referenced in Section 4)
- Note the specific tools/languages used (e.g., "used curl" vs "used Python requests")

## 3. Gotchas, Errors & Edge Cases
Document non-obvious issues encountered in the process, leave blank if none:
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

## 5. Optimal Procedure (Cookbook)
Provide the EXACT working procedure as a copy-pasteable cookbook. This is NOT guidance - it's the actual implementation.

Format as numbered steps with concrete code blocks:
1. [Brief description]
   \`\`\`bash
   exact command that was run
   \`\`\`
2. [Brief description]
   \`\`\`bash
   next exact command
   \`\`\`

Rules:
- Shell commands are EPHEMERAL - include them verbatim (they won't persist)
- Generated files are PERSISTED in sandbox - reference by name only (e.g., "Run create_sub.sh"), don't inline content
- Parameterize secrets/IDs (e.g., $STRIPE_SECRET_KEY) but keep everything else verbatim
- Skip failed attempts - only include the working path
- End with any critical "gotcha" that would cause failure if missed

---
Transcript:
`;

/**
 * Fetch transcript from database by conversation ID and process it.
 * Returns a compressed summary for skill codification.
 *
 * @param conversationId - The conversation ID to fetch
 * @param sandboxId - Optional sandbox ID to fetch file listing from
 * @param abortSignal - Optional abort signal for cancellation
 */
export async function processTranscript(
  conversationId: string,
  sandboxId?: string,
  abortSignal?: AbortSignal
): Promise<string> {
  // Fetch messages from database
  const conversation = await getConversation(conversationId);

  if (!conversation) {
    return 'Error: Conversation not found';
  }

  // Build transcript from messages using centralized transform utility
  const rawTranscript = toTranscriptString(conversation.messages);

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

  // Process with Gemini Flash - stream deltas to frontend for real-time updates
  const streamText = getStreamText();
  const streamResult = streamText({
    model: getFlashModel(),
    prompt,
    abortSignal,
    onAbort: () => {
      console.log('[ProcessTranscript] Aborted');
      emitToolProgress('get_processed_transcript', { status: 'complete', text: 'Transcript processing interrupted' });
    },
    onFinish: () => {
      console.log('[ProcessTranscript] Completed');
    },
  });

  let accumulated = '';
  for await (const chunk of streamResult.textStream) {
    accumulated += chunk;
    emitToolProgress('get_processed_transcript', { status: 'streaming', delta: chunk });
  }

  emitToolProgress('get_processed_transcript', { status: 'complete', text: accumulated });
  return accumulated;
}
