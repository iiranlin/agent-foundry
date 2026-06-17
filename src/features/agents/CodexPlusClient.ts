import { Env } from '@/libs/Env';
import { formatMcpConfigForPrompt } from './McpConfig';

type ChatMessage = {
  content: string;
  role: 'system' | 'user';
};

type ChatCompletionChoice = {
  message?: {
    content?: unknown;
  };
};

type ChatCompletionPayload = {
  choices?: ChatCompletionChoice[];
};

type ChatCompletionStreamPayload = {
  choices?: {
    delta?: {
      content?: unknown;
    };
  }[];
};

const MAX_SKILL_CONTEXT_CHARS = 12_000;

const hasChatCompletionShape = (value: unknown): value is ChatCompletionPayload => {
  if (!value || typeof value !== 'object' || !('choices' in value)) {
    return false;
  }

  const { choices } = value;
  return Array.isArray(choices);
};

const hasChatCompletionStreamShape = (value: unknown): value is ChatCompletionStreamPayload => {
  if (!value || typeof value !== 'object' || !('choices' in value)) {
    return false;
  }

  const { choices } = value;
  return Array.isArray(choices);
};

export const resolveCodexPlusChatEndpoint = (baseUrl: string) => {
  const normalizedUrl = baseUrl.trim().replace(/\/+$/u, '');

  if (normalizedUrl.endsWith('/chat/completions')) {
    return normalizedUrl;
  }

  if (normalizedUrl.endsWith('/v1')) {
    return `${normalizedUrl}/chat/completions`;
  }

  return `${normalizedUrl}/v1/chat/completions`;
};

const getCodexPlusConfig = (endpointOverride: string) => {
  const baseUrl = endpointOverride.trim() || Env.CODEX_PLUS_API_BASE_URL;

  if (!baseUrl || !Env.CODEX_PLUS_API_KEY) {
    return null;
  }

  return {
    apiKey: Env.CODEX_PLUS_API_KEY,
    endpoint: resolveCodexPlusChatEndpoint(baseUrl),
    model: Env.CODEX_PLUS_MODEL,
  };
};

const buildMessages = (options: {
  agentName: string;
  mcpConnectorConfig: string;
  question: string;
  skillContent: string;
  skillSummary: string;
}): ChatMessage[] => [
  {
    role: 'system',
    content: [
      `你是 ${options.agentName} 的数据分析 Agent。`,
      '只能基于已训练 skill 和用户问题回答。',
      '如果训练内容不足，直接说明当前 Agent 没有足够训练数据。',
      '回答要简洁、准确，并优先使用中文。',
      '',
      `Skill summary:\n${options.skillSummary}`,
      '',
      `Configured MCP servers:\n${formatMcpConfigForPrompt(options.mcpConnectorConfig)}`,
      'Do not claim MCP tool execution unless a later tool invocation result is explicitly provided.',
      '',
      `Skill content:\n${options.skillContent.slice(0, MAX_SKILL_CONTEXT_CHARS)}`,
    ].join('\n'),
  },
  {
    role: 'user',
    content: options.question,
  },
];

export const requestCodexPlusAnswer = async (options: {
  agentName: string;
  endpointOverride: string;
  mcpConnectorConfig?: string;
  question: string;
  skillContent: string;
  skillSummary: string;
}) => {
  const config = getCodexPlusConfig(options.endpointOverride);

  if (!config) {
    return null;
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages({
          ...options,
          mcpConnectorConfig: options.mcpConnectorConfig ?? '',
        }),
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();

    if (!hasChatCompletionShape(payload)) {
      return null;
    }

    const content = payload.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || !content.trim()) {
      return null;
    }

    return content.trim();
  } catch {
    return null;
  }
};

export async function* streamCodexPlusAnswer(options: {
  agentName: string;
  endpointOverride: string;
  mcpConnectorConfig?: string;
  question: string;
  skillContent: string;
  skillSummary: string;
}) {
  const config = getCodexPlusConfig(options.endpointOverride);

  if (!config) {
    return;
  }

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages({
          ...options,
          mcpConnectorConfig: options.mcpConnectorConfig ?? '',
        }),
        stream: true,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok || !response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine.startsWith('data:')) {
          continue;
        }

        const data = trimmedLine.replace(/^data:\s*/u, '');

        if (data === '[DONE]') {
          return;
        }

        const payload: unknown = JSON.parse(data);

        if (!hasChatCompletionStreamShape(payload)) {
          continue;
        }

        const content = payload.choices?.[0]?.delta?.content;

        if (typeof content === 'string' && content.length > 0) {
          yield content;
        }
      }
    }
  } catch {
    // The caller falls back to local skill retrieval when streaming fails.
  }
}
