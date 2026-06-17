import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getAgentOwnerId } from '@/features/agents/AgentAuth';
import { trainSkillFromSources } from '@/features/agents/SkillTrainer';
import { db } from '@/libs/DB';
import { agentSchema, agentSkillSchema, agentSourceSchema } from '@/models/Schema';

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

export const POST = async (_request: Request, context: RouteContext) => {
  const ownerId = await getAgentOwnerId();

  if (!ownerId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { agentId: rawAgentId } = await context.params;
  const agentId = Number(rawAgentId);

  if (!Number.isInteger(agentId)) {
    return NextResponse.json({ message: 'Invalid agent id' }, { status: 400 });
  }

  const [agent] = await db
    .select()
    .from(agentSchema)
    .where(and(eq(agentSchema.id, agentId), eq(agentSchema.ownerId, ownerId)));

  if (!agent) {
    return NextResponse.json({ message: 'Agent not found' }, { status: 404 });
  }

  await db
    .update(agentSchema)
    .set({
      status: 'training',
    })
    .where(eq(agentSchema.id, agentId));

  const sources = await db
    .select()
    .from(agentSourceSchema)
    .where(eq(agentSourceSchema.agentId, agentId));
  const skill = trainSkillFromSources(sources);

  await db.delete(agentSkillSchema).where(eq(agentSkillSchema.agentId, agentId));
  const [savedSkill] = await db
    .insert(agentSkillSchema)
    .values({
      agentId,
      title: skill.title,
      summary: skill.summary,
      content: skill.content,
    })
    .returning();
  const [updatedAgent] = await db
    .update(agentSchema)
    .set({
      status: 'ready',
      trainedAt: new Date(),
    })
    .where(eq(agentSchema.id, agentId))
    .returning();

  return NextResponse.json({
    agent: updatedAgent,
    skill: savedSkill,
  });
};
