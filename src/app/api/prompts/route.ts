import { NextResponse } from 'next/server';
import { TASK_AGENT_INSTRUCTIONS } from '@/lib/agent/task-agent';
import { SKILL_AGENT_INSTRUCTIONS } from '@/lib/agent/skill-agent';

export async function GET() {
  return NextResponse.json({
    taskAgent: TASK_AGENT_INSTRUCTIONS,
    skillAgent: SKILL_AGENT_INSTRUCTIONS,
  });
}
