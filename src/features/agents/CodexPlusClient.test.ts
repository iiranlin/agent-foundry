import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  requestCodexPlusAnswer,
  resolveCodexPlusChatEndpoint,
  streamCodexPlusAnswer,
} from './CodexPlusClient';

describe('CodexPlusClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Endpoint resolution', () => {
    it('appends chat completions path to base URL', () => {
      expect(resolveCodexPlusChatEndpoint('https://bmapi.020212.xyz')).toBe(
        'https://bmapi.020212.xyz/v1/chat/completions',
      );
    });

    it('keeps existing chat completions endpoint', () => {
      expect(resolveCodexPlusChatEndpoint('https://bmapi.020212.xyz/v1/chat/completions')).toBe(
        'https://bmapi.020212.xyz/v1/chat/completions',
      );
    });
  });

  describe('Chat completion request', () => {
    it('returns assistant content from codex plus response', async () => {
      const fetchMock = vi.fn<typeof fetch>(
        async () =>
          await Promise.resolve(
            Response.json(
              {
                choices: [{ message: { content: '可以回答发票流程。' } }],
              },
              { status: 200 },
            ),
          ),
      );

      vi.stubGlobal('fetch', fetchMock);

      const answer = await requestCodexPlusAnswer({
        agentName: 'Billing Agent',
        endpointOverride: 'https://bmapi.020212.xyz',
        mcpConnectorConfig: JSON.stringify({
          mcpServers: {
            docs: {
              transport: 'http',
              url: 'https://mcp.example.com/sse',
            },
          },
        }),
        question: '发票流程是什么？',
        skillContent: '发票流程会先创建草稿发票。',
        skillSummary: '发票流程说明。',
      });
      const requestBody = fetchMock.mock.calls[0]?.[1]?.body;

      expect(answer).toBe('可以回答发票流程。');

      if (typeof requestBody !== 'string') {
        throw new TypeError('Expected JSON request body.');
      }

      expect(JSON.parse(requestBody).messages[0].content).toContain(
        '- docs: http transport at https://mcp.example.com/sse',
      );
      expect(fetchMock).toHaveBeenCalledWith(
        'https://bmapi.020212.xyz/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('returns null when codex plus response fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async () => await Promise.resolve(Response.json({}, { status: 500 }))),
      );

      const answer = await requestCodexPlusAnswer({
        agentName: 'Billing Agent',
        endpointOverride: 'https://bmapi.020212.xyz',
        question: '发票流程是什么？',
        skillContent: '发票流程会先创建草稿发票。',
        skillSummary: '发票流程说明。',
      });

      expect(answer).toBeNull();
    });

    it('streams assistant deltas from codex plus response', async () => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"发票"}}]}\n\n'),
          );
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"流程"}}]}\n\n'),
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      const fetchMock = vi.fn<typeof fetch>(
        async () => await Promise.resolve(new Response(body, { status: 200 })),
      );
      const chunks: string[] = [];

      vi.stubGlobal('fetch', fetchMock);

      for await (const chunk of streamCodexPlusAnswer({
        agentName: 'Billing Agent',
        endpointOverride: 'https://bmapi.020212.xyz',
        question: '发票流程是什么？',
        skillContent: '发票流程会先创建草稿发票。',
        skillSummary: '发票流程说明。',
      })) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toBe('发票流程');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://bmapi.020212.xyz/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });
});
