/**
 * Test script to verify skill agent behavior
 *
 * Usage: npx tsx scripts/test-skill-agent.ts <conversationId>
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:./data/skillforge.db' });

async function main() {
  const conversationId = process.argv[2];

  if (!conversationId) {
    // List recent task conversations for selection
    const result = await db.execute(`
      SELECT id, title, datetime(updated_at/1000, 'unixepoch') as updated
      FROM conversations WHERE mode = 'task'
      ORDER BY updated_at DESC LIMIT 10
    `);
    console.log('Recent tasks:');
    result.rows.forEach(r => console.log(`  ${r.id}  ${r.title}  (${r.updated})`));
    console.log('\nUsage: npx tsx scripts/test-skill-agent.ts <conversation-id>');
    return;
  }

  // Defer import until we need the agent (avoids API key check on list)
  const { skillAgent } = await import('../src/lib/agent/skill-agent');
  const { runWithRequestContext } = await import('../src/lib/agent/request-context');

  console.log(`Testing skill agent with conversation: ${conversationId}\n`);

  // Run skill agent with request context (provides conversationId/sandboxId to tools)
  await runWithRequestContext(
    { conversationId, sandboxId: 'default' },
    async () => {
      const result = await skillAgent.stream({
        messages: [{ role: 'user', content: 'Start' }],
      });

      // Stream output to console
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            process.stdout.write(part.text);
            break;
          case 'tool-call':
            console.log(`\n[Tool: ${part.toolName}]`);
            if (part.args) {
              const argsStr = JSON.stringify(part.args, null, 2);
              console.log(`[Args: ${argsStr.slice(0, 300)}${argsStr.length > 300 ? '...' : ''}]`);
            }
            break;
          case 'tool-result': {
            const output = 'output' in part ? String(part.output) : '(no output)';
            console.log(`[Result: ${output.slice(0, 500)}${output.length > 500 ? '...' : ''}]\n`);
            break;
          }
        }
      }
      console.log('\n--- Done ---');
    }
  );
}

main().catch(console.error);
