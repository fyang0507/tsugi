const SHELL_PATTERN = /<shell>([\s\S]*?)<\/shell>/g;

/**
 * Extract commands from text WITHOUT modifying the source text.
 * This preserves the original output for KV cache efficiency.
 */
export function extractCommands(text: string): string[] {
  const commands: string[] = [];
  let match;
  // Reset regex state
  SHELL_PATTERN.lastIndex = 0;
  while ((match = SHELL_PATTERN.exec(text)) !== null) {
    commands.push(match[1].trim());
  }
  return commands;
}

/**
 * Format command execution results for display
 */
export function formatToolResults(
  executions: Array<{ command: string; result: string }>
): string {
  return executions
    .map(({ command, result }) => `$ ${command}\n${result}`)
    .join('\n\n');
}

/**
 * Truncate output to prevent excessively large tool results
 */
export function truncateOutput(output: string, maxLength = 2000): string {
  if (output.length <= maxLength) return output;
  return output.slice(0, maxLength) + '\n... (truncated)';
}
