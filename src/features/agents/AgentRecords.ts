import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  agentMessageSchema,
  agentSchema,
  agentSkillSchema,
  agentSourceSchema,
} from '@/models/Schema';
import type { AgentRecord } from './AgentTypes';

export const loadAgentRecords = async (ownerId: string): Promise<AgentRecord[]> => {
  const agents = await db
    .select()
    .from(agentSchema)
    .where(eq(agentSchema.ownerId, ownerId))
    .orderBy(desc(agentSchema.updatedAt));
  const agentIds = agents.map((agent) => agent.id);

  if (agentIds.length === 0) {
    return [];
  }

  const [sources, skills, messages] = await Promise.all([
    db.select().from(agentSourceSchema).where(inArray(agentSourceSchema.agentId, agentIds)),
    db.select().from(agentSkillSchema).where(inArray(agentSkillSchema.agentId, agentIds)),
    db
      .select()
      .from(agentMessageSchema)
      .where(inArray(agentMessageSchema.agentId, agentIds))
      .orderBy(agentMessageSchema.createdAt),
  ]);

  return agents.map((agent) => ({
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    trainedAt: agent.trainedAt?.toISOString() ?? null,
    messages: messages
      .filter((message) => message.agentId === agent.id)
      .map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      })),
    skills: skills
      .filter((skill) => skill.agentId === agent.id)
      .map((skill) => ({
        ...skill,
        createdAt: skill.createdAt.toISOString(),
        updatedAt: skill.updatedAt.toISOString(),
      })),
    sources: sources
      .filter((source) => source.agentId === agent.id)
      .map((source) => ({
        ...source,
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
      })),
  }));
};
