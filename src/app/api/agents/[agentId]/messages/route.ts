import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import * as z from 'zod';
import { getAgentOwnerId } from '@/features/agents/AgentAuth';
import { streamCodexPlusAnswer } from '@/features/agents/CodexPlusClient';
import { answerFromSkill } from '@/features/agents/SkillTrainer';
import { db } from '@/libs/DB';
import { agentMessageSchema, agentSchema, agentSkillSchema } from '@/models/Schema';

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

const MessageValidation = z.object({
  content: z.string().trim().min(1).max(4000),
});

const createFallbackChunks = (answer: string) => {
  const chunks = answer.match(/[\s\S]{1,48}(?:\s|$)/gu);
  return chunks ?? [answer];
};

export const POST = async (request: Request, context: RouteContext) => {
  const ownerId = await getAgentOwnerId();

  if (!ownerId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { agentId: rawAgentId } = await context.params;
  const agentId = Number(rawAgentId);

  if (!Number.isInteger(agentId)) {
    return NextResponse.json({ message: 'Invalid agent id' }, { status: 400 });
  }

  const json = await request.json();
  const parse = MessageValidation.safeParse(json);

  if (!parse.success) {
    return NextResponse.json(z.treeifyError(parse.error), { status: 422 });
  }

  const [agent] = await db
    .select()
    .from(agentSchema)
    .where(and(eq(agentSchema.id, agentId), eq(agentSchema.ownerId, ownerId)));

  if (!agent) {
    return NextResponse.json({ message: 'Agent not found' }, { status: 404 });
  }

  if (agent.status !== 'ready') {
    return NextResponse.json({ message: 'Agent must be trained before chat' }, { status: 409 });
  }

  const [skill] = await db
    .select()
    .from(agentSkillSchema)
    .where(eq(agentSkillSchema.agentId, agentId))
    .orderBy(desc(agentSkillSchema.createdAt));

  if (!skill) {
    return NextResponse.json({ message: 'Agent has no trained skill' }, { status: 409 });
  }

  await db
    .insert(agentMessageSchema)
    .values({
      agentId,
      ownerId,
      role: 'user',
      content: parse.data.content,
    })
    .returning();

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    async start(controller) {
      let answer = '';

      for await (const chunk of streamCodexPlusAnswer({
        agentName: agent.name,
        endpointOverride: agent.codexApiEndpoint,
        question: parse.data.content,
        skillContent: skill.content,
        skillSummary: skill.summary,
      })) {
        answer += chunk;
        controller.enqueue(encoder.encode(chunk));
      }

      if (!answer.trim()) {
        const fallbackAnswer = answerFromSkill({
          question: parse.data.content,
          skillContent: skill.content,
          skillSummary: skill.summary,
        });

        for (const chunk of createFallbackChunks(fallbackAnswer)) {
          answer += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      }

      await db.insert(agentMessageSchema).values({
        agentId,
        ownerId,
        role: 'assistant',
        content: answer,
      });

      controller.close();
    },
  });

  return new Response(responseStream, {
    headers: {
      'Cache-Control': 'no-cache, no-transform',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Accel-Buffering': 'no',
    },
  });
};
