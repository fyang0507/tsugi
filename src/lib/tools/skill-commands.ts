import { exec } from 'child_process';
import { promisify } from 'util';
import { getStorage } from '../skills/storage';

const execAsync = promisify(exec);

const SHELL_TIMEOUT_MS = 10000;
const ALLOWED_SHELL_COMMANDS = ['curl', 'cat', 'ls', 'head', 'tail', 'find', 'tree', 'jq', 'grep', 'export', 'source', 'python', 'python3', 'pip', 'pip3'];
const MAX_OUTPUT_LENGTH = 5000;

export type CommandHandler = (args: string) => string | Promise<string>;

async function runShellCommand(command: string): Promise<string> {
  const [cmd] = command.trim().split(/\s+/);

  if (!ALLOWED_SHELL_COMMANDS.includes(cmd)) {
    return `Command "${cmd}" not allowed. Allowed: ${ALLOWED_SHELL_COMMANDS.join(', ')}`;
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: SHELL_TIMEOUT_MS,
      maxBuffer: 1024 * 1024, // 1MB
    });
    return [stdout, stderr].filter(Boolean).join('\n').trim() || '(no output)';
  } catch (error) {
    if (error instanceof Error) {
      if ('killed' in error && error.killed) {
        return `Error: Command timed out (${SHELL_TIMEOUT_MS / 1000}s)`;
      }
      return `Error: ${error.message}`;
    }
    return 'Error: Unknown error';
  }
}

function truncate(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  return output.slice(0, MAX_OUTPUT_LENGTH) + '\n... (truncated)';
}

/**
 * Execute a command - tries skill commands first, then shell commands
 */
export async function executeCommand(command: string): Promise<string> {
  const skillCommands = createSkillCommands();
  const sortedCommands = Object.keys(skillCommands).sort((a, b) => b.length - a.length);

  // Try skill commands first
  for (const cmd of sortedCommands) {
    if (command === cmd || command.startsWith(cmd + ' ')) {
      const args = command.slice(cmd.length).trim();
      const result = await skillCommands[cmd](args);
      return truncate(result);
    }
  }

  // Fall back to shell execution
  const result = await runShellCommand(command);
  return truncate(result);
}

export function createSkillCommands(): Record<string, CommandHandler> {
  const storage = getStorage();

  return {
    'skill help': () => `Available commands:
  skill list                              - List all skills
  skill search <keyword>                  - Search skills by keyword
  skill get <name>                        - Read a skill (includes file list)
  skill set <name> "..."                  - Write a skill
  skill add-file <name> <filename> "..."  - Add a file to a skill directory
  skill suggest "..." [--update="name"]   - Suggest codifying a learned procedure`,

    'skill list': async () => {
      const skills = await storage.list();
      if (skills.length === 0) return '(no skills found)';
      return skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
    },

    'skill search': async (keyword) => {
      if (!keyword.trim()) return 'Usage: skill search <keyword>';
      const results = await storage.search(keyword);
      if (results.length === 0) return `No skills matching "${keyword}"`;
      return results.map(s => `- ${s.name}: ${s.description}`).join('\n');
    },

    'skill get': async (name) => {
      if (!name.trim()) return 'Usage: skill get <name>';
      const skill = await storage.get(name.trim());
      if (!skill) return `Skill "${name}" not found`;

      let output = skill.content;
      if (skill.files.length > 0) {
        output += '\n\n---\n## Skill Files\n';
        output += skill.files.map(f => `- ${name}/${f}`).join('\n');
      }
      return output;
    },

    'skill set': async (args) => {
      // Parse: skill set <name> "<content>"
      const match = args.match(/^(\S+)\s+"([\s\S]+)"$/);
      if (!match) return 'Usage: skill set <name> "<content>"';

      const [, name, content] = match;
      await storage.set(name, content);
      return `Skill "${name}" saved`;
    },

    'skill add-file': async (args) => {
      // Parse: skill add-file <skill-name> <filename> "<content>"
      const match = args.match(/^(\S+)\s+(\S+)\s+"([\s\S]+)"$/);
      if (!match) return 'Usage: skill add-file <skill-name> <filename> "<content>"';

      const [, skillName, filename, content] = match;

      try {
        await storage.addFile(skillName, filename, content);
        return `File "${filename}" added to skill "${skillName}"`;
      } catch (error) {
        if (error instanceof Error) {
          return `Error: ${error.message}`;
        }
        return 'Error: Failed to add file';
      }
    },

    'skill suggest': (args) => {
      // Parse: skill suggest "description" [--update="skill-name"]
      const match = args.match(/^"([^"]+)"(?:\s+--update="([^"]+)")?$/);
      if (!match) {
        return JSON.stringify({
          type: 'skill-suggestion-error',
          error: 'Usage: skill suggest "description" [--update="skill-name"]',
        });
      }

      const [, learned, skillToUpdate] = match;
      return JSON.stringify({
        type: 'skill-suggestion',
        learned,
        skillToUpdate: skillToUpdate || null,
      });
    },
  };
}
