import { z } from 'zod';
import { GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { getProModel } from './model-provider';
import { getAgent } from './braintrust-wrapper';
import { processTranscript } from './tools/process-transcript';
import { getRequestContext } from './request-context';

const SKILL_AGENT_INSTRUCTIONS = `You are a Skill Codification Agent.

# First Step - REQUIRED
Call the get-processed-transcript tool to get the summary of the task conversation.
You have no context about the task until you call this tool.

# Shell Commands (Literal Text)
To run shell commands, output the exact text <shell>command</shell>.
The system parses this, runs it, and returns the result in the next turn.
NEVER call shell as a function - just output the literal text.

Available commands:
<shell>skill list</shell>              - List all saved skills
<shell>skill search keyword</shell>    - Search skills by keyword
<shell>skill get name</shell>          - Read a skill's full content
<shell>skill set name "content"</shell> - Create or update a skill
<shell>skill add-file file.py name</shell> - Add sandbox file to skill
<shell>skill copy-to-sandbox name file.py</shell> - Copy skill file to sandbox
<shell>ls</shell>                      - List sandbox files
<shell>cat filename</shell>            - Read sandbox file content

# Skills vs Sandbox

Two separate storage areas:
- **Skills** = persistent library (files stored here for future reuse, survives across sessions)
- **Sandbox** = execution workspace (where Task Agent ran code, ephemeral)

Flow:
- Task Agent creates code in sandbox → you save it to skill via \`skill add-file\`
- Later: Task Agent uses \`skill copy-to-sandbox\` → executes in sandbox

Skill files CANNOT be executed directly - they must be copied to sandbox first.

# After Getting Summary
Analyze the summary to determine if this is worth codifying as a skill.

## Check for Existing Skill
If the request mentions "skillToUpdate", first read the existing skill:
<shell>skill get skill-name</shell>

Then merge the new learnings with existing content. Preserve what still works, fix what was wrong, add what was missing.

## Worth Codifying
- Multi-step procedures with non-obvious ordering
- Integration gotchas (auth flows, API quirks, error handling)
- Debugging patterns that required trial-and-error
- User-specific preferences or constraints discovered
- Workarounds for common errors or edge cases

## Skip If
- Single-step operations
- Generic model capabilities (summarization, translation)
- Overly specific one-off tasks
- Nothing was actually "learned"

# Output Format

Use the skill set command (this creates or overwrites):
<shell>skill set skill-name "---
name: skill-name
description: One-line description
---
# Title

## Sections
...
"</shell>

If not worth saving, explain briefly why.

# Code Extraction & Generalization

When codifying a skill that involved code execution (scripts in sandbox):

1. List sandbox files: <shell>ls</shell>
2. Read the code: <shell>cat script.py</shell>
3. **Generalize the code** before saving:
   - Replace hardcoded values (URLs, IDs, tokens) with environment variables or parameters
   - Add a docstring explaining what the script does and required parameters
   - Remove task-specific data, keep the reusable procedure
4. Include the generalized code in your skill markdown using a code block
5. Document: required env vars, parameters, example usage

Example generalization:
- Original: \`webhook_url = "https://discord.com/api/webhooks/123/abc"\`
- Generalized: \`webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")\`

The goal is that future runs can adapt the code for different tasks, not replay the exact same operation.

# Completion
Shell output returns as a user message. After receiving it:
- **Done** (skill saved): respond only "COMPLETE"
- **More steps** (e.g., after reading skill): continue
- **Error**: fix and retry

# Guidelines
- Name skills generically (e.g., "notion-api-auth" not "fix-johns-notion-error")
- Focus on the procedure, not the specific data used
- Include error handling patterns discovered during the task
- When updating, clearly note what changed
- Be concise but complete`;

/**
 * Tool that fetches and processes the transcript from the database.
 * Reads conversationId and sandboxId from request context (set by route.ts).
 */
const processedTranscriptTool = {
  description: 'Get the processed transcript from the previous task conversation. Call this FIRST to get context for skill creation.',
  inputSchema: z.object({}),
  execute: async () => {
    const { conversationId, sandboxId } = getRequestContext();
    if (!conversationId) {
      return 'Error: No conversation ID in request context';
    }
    return processTranscript(conversationId, sandboxId);
  },
};

/**
 * Creates the Skill Agent singleton.
 * The agent uses a tool that fetches the transcript from DB by conversation ID.
 */
function createSkillAgent() {
  const Agent = getAgent();
  return new Agent({
    model: getProModel(),
    instructions: SKILL_AGENT_INSTRUCTIONS,
    tools: {
      'get-processed-transcript': processedTranscriptTool,
    },
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingLevel: 'low',
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
  });
}

// Module-level instantiation - created once when module loads
export const skillAgent = createSkillAgent();
