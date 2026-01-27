/**
 * Test script to verify toTranscriptString behavior.
 *
 * Usage: npx tsx scripts/test-transcript-transform.ts <conversationId>
 */
import { getConversation } from '@/lib/db';
import { toTranscriptString, type Message } from '@/lib/messages/transform';

async function main() {
  const conversationId = process.argv[2];

  if (!conversationId) {
    console.error('Usage: npx tsx scripts/test-transcript-transform.ts <conversationId>');
    process.exit(1);
  }

  console.log(`Testing transcript transform for conversation: ${conversationId}\n`);

  const result = await getConversation(conversationId);
  if (!result) {
    console.error('Conversation not found');
    process.exit(1);
  }

  console.log('=== RAW DB MESSAGES ===');
  for (const msg of result.messages) {
    console.log(`Role: ${msg.role}`);
    const dbMsg = msg as Message;
    console.log(`Has iterations: ${!!msg.iterations}, count: ${msg.iterations?.length ?? 0}`);
    console.log(`Has parts: ${!!dbMsg.parts}, count: ${dbMsg.parts?.length ?? 0}`);
    if (dbMsg.parts) {
      console.log('Part types:', dbMsg.parts.map((p) => p.type));
    }
    console.log('---');
  }

  console.log('\n=== TRANSCRIPT OUTPUT ===');
  const transcript = toTranscriptString(result.messages as Message[]);
  console.log(transcript);

  console.log('\n=== VERIFICATION ===');
  const hasToolOutput = transcript.includes('[tool]');
  const hasToolCall = transcript.includes('[tool-call]') || transcript.includes('shell');
  const hasReasoning = transcript.includes('[reasoning]') || transcript.includes('Formulating');
  console.log(`Contains [tool] output: ${hasToolOutput}`);
  console.log(`Contains tool calls: ${hasToolCall}`);
  console.log(`Contains reasoning: ${hasReasoning}`);

  // Fail if expected content is missing
  if (!hasToolOutput && !hasToolCall && !hasReasoning) {
    console.log('\n❌ FAIL: Transcript is missing tool calls, outputs, and reasoning');
    process.exit(1);
  } else {
    console.log('\n✓ PASS: Transcript contains expected content');
  }
}

main().catch(console.error);
