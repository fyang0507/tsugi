import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import Fuse from 'fuse.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SKILLS_DIR = '.skills';
const SHELL_TIMEOUT_MS = 10000;
const ALLOWED_SHELL_COMMANDS = ['curl', 'cat', 'ls', 'head', 'tail', 'find', 'tree', 'jq', 'grep', 'export'];
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
  return {
    'skill help': () => `Available commands:
  skill list              - List all skills
  skill search <keyword>  - Search skills by keyword
  skill get <name>        - Read a skill
  skill set <name> "..."  - Write a skill`,

    'skill list': async () => {
      const skills = await scanSkills();
      if (skills.length === 0) return '(no skills found)';
      return skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
    },

    'skill search': async (keyword) => {
      if (!keyword.trim()) return 'Usage: skill search <keyword>';
      const skills = await scanSkills();
      if (skills.length === 0) return `No skills matching "${keyword}"`;
      const fuse = new Fuse(skills, { keys: ['name', 'description'], threshold: 0.4 });
      const results = fuse.search(keyword);
      if (results.length === 0) return `No skills matching "${keyword}"`;
      return results.map(r => `- ${r.item.name}: ${r.item.description}`).join('\n');
    },

    'skill get': async (name) => {
      if (!name.trim()) return 'Usage: skill get <name>';
      const skillPath = path.join(SKILLS_DIR, name.trim(), 'SKILL.md');
      try {
        return await fs.readFile(skillPath, 'utf-8');
      } catch {
        return `Skill "${name}" not found`;
      }
    },

    'skill set': async (args) => {
      // Parse: skill set <name> "<content>"
      const match = args.match(/^(\S+)\s+"([\s\S]+)"$/);
      if (!match) return 'Usage: skill set <name> "<content>"';

      const [, name, content] = match;
      const skillDir = path.join(SKILLS_DIR, name);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), content);
      return `Skill "${name}" saved to ${skillDir}/SKILL.md`;
    },
  };
}

async function scanSkills(): Promise<Array<{ name: string; description: string }>> {
  try {
    const dirs = await fs.readdir(SKILLS_DIR);
    const skills = [];

    for (const dir of dirs) {
      try {
        const content = await fs.readFile(path.join(SKILLS_DIR, dir, 'SKILL.md'), 'utf-8');
        const { data } = matter(content);
        if (data.name && data.description) {
          skills.push({ name: data.name, description: data.description });
        }
      } catch { /* skip */ }
    }

    return skills;
  } catch {
    return [];
  }
}
