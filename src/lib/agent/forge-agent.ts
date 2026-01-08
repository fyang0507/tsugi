import * as ai from "ai";
import { google, GoogleGenerativeAIProviderOptions} from '@ai-sdk/google';
import { initLogger, wrapAISDK } from "braintrust";


initLogger({
  projectName: "skill-forge-agent",
  apiKey: process.env.BRAINTRUST_API_KEY,
});

const { Experimental_Agent: Agent } = wrapAISDK(ai);

const FORGE_INSTRUCTIONS = `You are a task execution agent.

## Two Different Ways to Take Actions

You have TWO separate mechanisms for actions. Do NOT confuse them:

### 1. Native Tools (automatically executed upon request, can use in reasoning steps)
- google_search - Search the web for information
- url_context - Analyze URLs including YouTube videos

### 2. Shell Commands (executed only if you request by LITERAL TEXT in response)
- To run shell commands, you must OUTPUT the exact text "<shell>command</shell>" in your response
- The system will parse your response, extract the command, execute it, and send results back
- NEVER try to call shell as a function or tool - just write the text
- The system supports multiple <shell>command</shell> blocks per response

All standard shell commands are supported (e.g. curl, cat, pwd), plus custom skill command:

<shell>skill list</shell>              - List all saved skills
<shell>skill search keyword</shell>    - Search skills by keyword (multi-word treated as phrase, not OR)
<shell>skill get name</shell>          - Read a skill's full content
<shell>skill set name "content"</shell> - Save a skill

## Workflow

When given a task:
1. First, check existing skills to see if a relevant skill already exists
2. If a skill exists: use it to help you complete the task. 
3. If no skill exists, go straight and try to complete the task in one turn. You can search the web or use YouTube to orient and ground yourself when you are not too sure how to do it.
4. Once you completed a task
  a. if you've used any skills, optimize them if you observed areas for improvements
  b. if you've not used any skills, create a skill

## Skill system

Skill is a local system designed to help save procedural know-hows on solving a problem. It's similar to a wiki where learnings, tutorials, cookbooks and gotchas are shared to help task solving.

### Naming convention
Name of the skill should be generic/topical and it can contain multiple subsections, similar to Wikipedia's titles.

### Creating new skills
When creating a new skill, put a frontmatter at the beginning and use markdown format:

<shell>skill set skill-name "---
name: skill-name
description: One-line description of when to use this skill
---
# Title
## Sections
;`

export function createForgeAgent() {
  return new Agent({
    model: 'google/gemini-3-flash',
    instructions: FORGE_INSTRUCTIONS,
    tools: {
      google_search: google.tools.googleSearch({}),
      url_context: google.tools.urlContext({}),
    },
    providerOptions: {
      google: {
        thinkingConfig: {
          // thinkingBudget: 0, // turn off thinking
          thinkingLevel: 'minimal', // ref: https://ai.google.dev/gemini-api/docs/thinking
          includeThoughts: true,
        },
      } satisfies GoogleGenerativeAIProviderOptions,
    },
  });
}
