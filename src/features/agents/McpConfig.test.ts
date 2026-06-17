import { describe, expect, it } from 'vitest';
import { formatMcpConfigForPrompt, normalizeMcpConnectorConfig } from './McpConfig';

describe('McpConfig', () => {
  describe('Normalization', () => {
    it('normalizes codex style mcp servers', () => {
      const config = normalizeMcpConnectorConfig(
        JSON.stringify({
          mcpServers: {
            filesystem: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/project'],
              env: {
                DEBUG: '1',
              },
            },
            docs: {
              url: 'https://mcp.example.com/sse',
              headers: {
                Authorization: 'Bearer token',
              },
            },
          },
        }),
      );

      expect(config).toStrictEqual({
        ok: true,
        value: JSON.stringify({
          mcpServers: {
            filesystem: {
              transport: 'stdio',
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/project'],
              env: {
                DEBUG: '1',
              },
            },
            docs: {
              transport: 'http',
              url: 'https://mcp.example.com/sse',
              headers: {
                Authorization: 'Bearer token',
              },
            },
          },
        }),
      });
    });

    it('normalizes url shorthand', () => {
      const config = normalizeMcpConnectorConfig('https://mcp.example.com/sse');

      expect(config).toStrictEqual({
        ok: true,
        value: JSON.stringify({
          mcpServers: {
            default: {
              transport: 'http',
              url: 'https://mcp.example.com/sse',
            },
          },
        }),
      });
    });

    it('rejects invalid server config', () => {
      const config = normalizeMcpConnectorConfig(
        JSON.stringify({
          mcpServers: {
            broken: {
              args: ['missing-command-or-url'],
            },
          },
        }),
      );

      expect(config.ok).toBeFalsy();
    });
  });

  describe('Prompt formatting', () => {
    it('formats server inventory for model context', () => {
      const normalized = normalizeMcpConnectorConfig(
        JSON.stringify({
          mcpServers: {
            docs: {
              url: 'https://mcp.example.com/sse',
            },
          },
        }),
      );

      expect(normalized.ok).toBeTruthy();

      if (!normalized.ok) {
        return;
      }

      expect(formatMcpConfigForPrompt(normalized.value)).toContain(
        '- docs: http transport at https://mcp.example.com/sse',
      );
    });
  });
});
