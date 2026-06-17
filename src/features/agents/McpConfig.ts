type McpServerConfig = {
  args?: string[];
  command?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  transport: 'http' | 'stdio';
  url?: string;
};

type McpConnectorConfig = {
  mcpServers: Record<string, McpServerConfig>;
};

type NormalizeResult =
  | {
      ok: true;
      value: string;
    }
  | {
      error: string;
      ok: false;
    };

const MAX_MCP_CONFIG_CHARS = 12_000;
const serverNamePattern = /^[\w.-]{1,80}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === 'string');
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeServer = (value: unknown): McpServerConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  const command = typeof value.command === 'string' ? value.command.trim() : '';
  const rawUrl = typeof value.url === 'string' ? value.url.trim() : '';
  const args = value.args === undefined ? undefined : value.args;
  const env = value.env === undefined ? undefined : value.env;
  const headers = value.headers === undefined ? undefined : value.headers;

  if (args !== undefined && !isStringArray(args)) {
    return null;
  }

  if (env !== undefined && !isStringRecord(env)) {
    return null;
  }

  if (headers !== undefined && !isStringRecord(headers)) {
    return null;
  }

  if (rawUrl) {
    if (!isHttpUrl(rawUrl)) {
      return null;
    }

    return {
      transport: 'http',
      url: rawUrl,
      ...(headers ? { headers } : {}),
    };
  }

  if (!command) {
    return null;
  }

  return {
    transport: 'stdio',
    command,
    ...(args ? { args } : {}),
    ...(env ? { env } : {}),
  };
};

const normalizeMcpObject = (value: unknown): NormalizeResult => {
  if (!isRecord(value) || !isRecord(value.mcpServers)) {
    return {
      ok: false,
      error: 'MCP config must contain mcpServers.',
    };
  }

  const mcpServers: Record<string, McpServerConfig> = {};

  for (const [name, server] of Object.entries(value.mcpServers)) {
    if (!serverNamePattern.test(name)) {
      return {
        ok: false,
        error: `Invalid MCP server name: ${name}`,
      };
    }

    const normalizedServer = normalizeServer(server);

    if (!normalizedServer) {
      return {
        ok: false,
        error: `Invalid MCP server config: ${name}`,
      };
    }

    mcpServers[name] = normalizedServer;
  }

  if (Object.keys(mcpServers).length === 0) {
    return {
      ok: false,
      error: 'MCP config must contain at least one server.',
    };
  }

  return {
    ok: true,
    value: JSON.stringify({ mcpServers }),
  };
};

const isMcpConnectorConfig = (value: unknown): value is McpConnectorConfig => {
  if (!isRecord(value) || !isRecord(value.mcpServers)) {
    return false;
  }

  return Object.values(value.mcpServers).every((server) => {
    if (!isRecord(server)) {
      return false;
    }

    if (server.transport === 'http') {
      return typeof server.url === 'string';
    }

    return server.transport === 'stdio' && typeof server.command === 'string';
  });
};

export const normalizeMcpConnectorConfig = (rawConfig: string): NormalizeResult => {
  const trimmedConfig = rawConfig.trim();

  if (!trimmedConfig) {
    return {
      ok: true,
      value: '',
    };
  }

  if (trimmedConfig.length > MAX_MCP_CONFIG_CHARS) {
    return {
      ok: false,
      error: 'MCP config is too large.',
    };
  }

  if (isHttpUrl(trimmedConfig)) {
    return {
      ok: true,
      value: JSON.stringify({
        mcpServers: {
          default: {
            transport: 'http',
            url: trimmedConfig,
          },
        },
      }),
    };
  }

  try {
    return normalizeMcpObject(JSON.parse(trimmedConfig));
  } catch {
    return {
      ok: false,
      error: 'MCP config must be valid JSON or an HTTP URL.',
    };
  }
};

export const parseMcpConnectorConfig = (rawConfig: string): McpConnectorConfig | null => {
  const normalized = normalizeMcpConnectorConfig(rawConfig);

  if (!normalized.ok || !normalized.value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(normalized.value);

    if (!isMcpConnectorConfig(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const formatMcpConfigForPrompt = (rawConfig: string) => {
  const config = parseMcpConnectorConfig(rawConfig);

  if (!config) {
    return 'No MCP servers configured.';
  }

  return Object.entries(config.mcpServers)
    .map(([name, server]) => {
      if (server.transport === 'http' && server.url) {
        return `- ${name}: http transport at ${server.url}`;
      }

      const args = server.args?.length ? ` ${server.args.join(' ')}` : '';
      return `- ${name}: stdio transport via ${server.command}${args}`;
    })
    .join('\n');
};
