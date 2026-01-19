import { z } from 'zod';
import { executeCommand } from '@/lib/tools/command-executor';
import { getRequestContext } from '../request-context';

/**
 * Shared tool for executing shell commands in the sandbox environment.
 * Used by both Task Agent and Skill Agent.
 */
export const executeShellTool = {
  description: `Execute shell commands in the sandbox environment. Results are returned as text.`,
  inputSchema: z.object({
    command: z.string().describe('The shell command to execute'),
  }),
  execute: async ({ command }: { command: string }) => {
    const { env } = getRequestContext();
    return executeCommand(command, { env });
  },
};
