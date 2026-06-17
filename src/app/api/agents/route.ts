import { desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import * as z from 'zod';
import { getAgentOwnerId } from '@/features/agents/AgentAuth';
import { normalizeMcpConnectorConfig } from '@/features/agents/McpConfig';
import { db } from '@/libs/DB';
import {
  agentMessageSchema,
  agentSchema,
  agentSkillSchema,
  agentSourceSchema,
} from '@/models/Schema';

const AgentSourceValidation = z.object({
  type: z.enum(['text', 'markdown', 'file', 'github', 'url', 'online-skill']),
  label: z.string().trim().max(120).optional(),
  url: z.string().trim().max(2048).optional(),
  content: z.string().trim().max(60_000),
});

const AgentCreateValidation = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  codexApiEndpoint: z.string().trim().max(2048).optional(),
  onlineSkillUrl: z.string().trim().max(2048).optional(),
  mcpConnectorUrl: z.string().trim().max(12_000).optional(),
  sources: z.array(AgentSourceValidation).min(1).max(12),
});

const resolveSourceLabel = (source: z.infer<typeof AgentSourceValidation>) => {
  if (source.label?.trim()) {
    return source.label;
  }

  if (source.url?.trim()) {
    return source.url;
  }

  return 'Context';
};

const toAgentPayload = (options: {
  agents: (typeof agentSchema.$inferSelect)[];
  messages: (typeof agentMessageSchema.$inferSelect)[];
  skills: (typeof agentSkillSchema.$inferSelect)[];
  sources: (typeof agentSourceSchema.$inferSelect)[];
}) =>
  options.agents.map((agent) => ({
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    trainedAt: agent.trainedAt?.toISOString() ?? null,
    messages: options.messages
      .filter((message) => message.agentId === agent.id)
      .map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      })),
    skills: options.skills
      .filter((skill) => skill.agentId === agent.id)
      .map((skill) => ({
        ...skill,
        createdAt: skill.createdAt.toISOString(),
        updatedAt: skill.updatedAt.toISOString(),
      })),
    sources: options.sources
      .filter((source) => source.agentId === agent.id)
      .map((source) => ({
        ...source,
        createdAt: source.createdAt.toISOString(),
        updatedAt: source.updatedAt.toISOString(),
      })),
  }));

export const GET = async () => {
  const ownerId = await getAgentOwnerId();

  if (!ownerId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const agents = await db
    .select()
    .from(agentSchema)
    .where(eq(agentSchema.ownerId, ownerId))
    .orderBy(desc(agentSchema.updatedAt));
  const agentIds = agents.map((agent) => agent.id);

  if (agentIds.length === 0) {
    return NextResponse.json({ agents: [] });
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

  return NextResponse.json({
    agents: toAgentPayload({
      agents,
      messages,
      skills,
      sources,
    }),
  });
};

export const POST = async (request: Request) => {
  const ownerId = await getAgentOwnerId();

  if (!ownerId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const json = await request.json();
  const parse = AgentCreateValidation.safeParse(json);

  if (!parse.success) {
    return NextResponse.json(z.treeifyError(parse.error), { status: 422 });
  }

  const hasContextData = parse.data.sources.some(
    (source) => source.content.trim() || source.url?.trim(),
  );

  if (!hasContextData) {
    return NextResponse.json({ message: 'Context data is required' }, { status: 422 });
  }

  const mcpConfig = normalizeMcpConnectorConfig(parse.data.mcpConnectorUrl ?? '');

  if (!mcpConfig.ok) {
    return NextResponse.json({ message: mcpConfig.error }, { status: 422 });
  }

  const [agent] = await db
    .insert(agentSchema)
    .values({
      ownerId,
      name: parse.data.name,
      description: parse.data.description ?? '',
      codexApiEndpoint: parse.data.codexApiEndpoint ?? '',
      onlineSkillUrl: parse.data.onlineSkillUrl ?? '',
      mcpConnectorUrl: mcpConfig.value,
    })
    .returning();

  if (!agent) {
    return NextResponse.json({ message: 'Agent was not created' }, { status: 500 });
  }

  await db.insert(agentSourceSchema).values(
    parse.data.sources.map((source) => ({
      agentId: agent.id,
      type: source.type,
      label: resolveSourceLabel(source),
      url: source.url ?? '',
      content: source.content,
    })),
  );

  return NextResponse.json({ agent }, { status: 201 });
};
