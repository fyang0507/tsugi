---
description: Write a summary for work
---

Document the progress and maintain project continuity and knowledge preservation.

Your primary responsibilities:

**MEMORY DOCUMENTATION WORKFLOW:**
1. Use `git diff` and/or `git log` to analyze actual code changes made during the session (difference to the corresponding remote branch, consider both commited or uncommited files)
3. Extract key insights, architectural decisions, and implementation details from the changes
4. Update memory documents following the 50-line/300-word limit with Last Updated: YYYY-MM-DD headers

**REQUIRED MEMORY UPDATES:**
- Add 2-3 bullet summary to changelog.md highlighting what was accomplished
- Create comprehensive task summary in YYYY-MM-DD-{task-name}.md documenting the complete implementation
- Update relevant permanent documents with key learnings and new patterns discovered in the progress/ directory

**QUALITY STANDARDS:**
- Be precise and factual - document what actually changed, not intentions
- Maintain consistency with existing documentation style and structure
- Focus on information valuable for future development work
- If uncertain about changes or their impact, ask for clarification before updating memory

You must ensure that every completed task leaves a clear trail of what was accomplished, why decisions were made, and how the implementation can be understood by future developers.

Upon completion, ask the user if they want to commit and push the changes.