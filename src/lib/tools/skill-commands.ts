import { getStorage } from '../skills/storage';

export type CommandHandler = (args: string) => string | Promise<string>;

const skillCommands: Record<string, CommandHandler> = {
  'help': () => `Skill commands:
  skill list                              - List all skills
  skill search <keyword>                  - Search skills by keyword
  skill get <name>                        - Read a skill (includes file list)
  skill set <name> "..."                  - Write/update a skill
  skill suggest "..." --name="name"       - Suggest codifying a learned procedure
  skill suggest "..." --name="name" --force - Skip similar skill check`,

  'list': async () => {
    const storage = getStorage();
    const skills = await storage.list();
    if (skills.length === 0) return '(no skills found)';
    return skills.map((s) => `- ${s.name}: ${s.description}`).join('\n');
  },

  'search': async (keyword) => {
    if (!keyword.trim()) return 'Usage: skill search <keyword>';
    const storage = getStorage();
    const results = await storage.search(keyword);
    if (results.length === 0) return `No skills matching "${keyword}"`;
    return results.map((s) => `- ${s.name}: ${s.description}`).join('\n');
  },

  'get': async (name) => {
    if (!name.trim()) return 'Usage: skill get <name>';
    const storage = getStorage();
    const skill = await storage.get(name.trim());
    if (!skill) return `Skill "${name}" not found`;

    let output = skill.content;
    if (skill.files.length > 0) {
      output += '\n\n---\n## Skill Files\n';
      output += skill.files.map((f) => `- ${name}/${f}`).join('\n');
    }
    output += '\n\n---\n**⚠️ EXECUTE THIS SKILL: Run the script/procedure above. Do not research alternatives.**';
    return output;
  },

  'set': async (args) => {
    // Parse: skill set <name> "<content>"
    const match = args.match(/^(\S+)\s+"([\s\S]+)"$/);
    if (!match) return 'Usage: skill set <name> "<content>"';

    const [, name, content] = match;
    const storage = getStorage();
    await storage.set(name, content);
    return `Skill "${name}" saved`;
  },

  'suggest': async (args) => {
    // Parse: skill suggest "description" --name="skill-name" [--force]
    const match = args.match(/^"([^"]+)"\s+--name="([^"]+)"(\s+--force)?$/);
    if (!match) {
      return JSON.stringify({
        type: 'skill-suggestion-error',
        error: 'Usage: skill suggest "description" --name="skill-name" [--force]',
      });
    }

    const [, learned, skillName, forceFlag] = match;
    const storage = getStorage();

    // If --force, skip fuzzy search
    if (forceFlag) {
      return JSON.stringify({
        type: 'skill-suggestion',
        status: 'success',
        name: skillName,
        learned,
        message: 'Suggestion recorded. User will see a "Codify as Skill" button. Do not run additional commands—just output COMPLETE.',
      });
    }

    // Fuzzy search using requested name
    const SIMILARITY_THRESHOLD = 0.5;
    const results = await storage.search(skillName);
    const similarSkills = results
      .filter((r) => r.score >= SIMILARITY_THRESHOLD)
      .map((r) => r.name);

    if (similarSkills.length > 0) {
      const skillList = similarSkills.slice(0, 3).map((s) => `"${s}"`).join(', ');
      return JSON.stringify({
        type: 'skill-suggestion',
        status: 'guidance',
        suggestedName: skillName,
        similarSkills,
        learned,
        message: `Similar skill(s) found: ${skillList}. Use \`skill get <name>\` to review. To proceed anyway, re-run with the same parameters and add --force flag.`,
      });
    }

    // No match - success
    return JSON.stringify({
      type: 'skill-suggestion',
      status: 'success',
      name: skillName,
      learned,
      message: 'Suggestion recorded. User will see a "Codify as Skill" button. Do not run additional commands—just output COMPLETE.',
    });
  },
};

/**
 * Execute a skill command (without the "skill " prefix)
 */
export async function executeSkillCommand(args: string): Promise<string> {
  const sortedCommands = Object.keys(skillCommands).sort((a, b) => b.length - a.length);

  for (const cmd of sortedCommands) {
    if (args === cmd || args.startsWith(cmd + ' ')) {
      const cmdArgs = args.slice(cmd.length).trim();
      return skillCommands[cmd](cmdArgs);
    }
  }

  return `Unknown skill command. Run "skill help" for available commands.`;
}
