type AgentSourceRecord = {
  id: number;
  agentId: number;
  type: string;
  label: string;
  url: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type AgentSkillRecord = {
  id: number;
  agentId: number;
  title: string;
  summary: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type AgentMessageRecord = {
  id: number;
  agentId: number;
  ownerId: string;
  role: string;
  content: string;
  createdAt: string;
};

export type AgentRecord = {
  id: number;
  ownerId: string;
  name: string;
  description: string;
  status: string;
  codexApiEndpoint: string;
  onlineSkillUrl: string;
  mcpConnectorUrl: string;
  trainedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: AgentMessageRecord[];
  skills: AgentSkillRecord[];
  sources: AgentSourceRecord[];
};
