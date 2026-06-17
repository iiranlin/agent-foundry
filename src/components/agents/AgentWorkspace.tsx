'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AgentRecord } from '@/features/agents/AgentTypes';
import { useRouter } from '@/libs/I18nNavigation';
import { MarkdownMessage } from './MarkdownMessage';

type DraftSource = {
  type: 'text' | 'markdown' | 'file' | 'github' | 'url' | 'online-skill';
  label: string;
  url: string;
  content: string;
};

type FormSubmitEvent = {
  preventDefault: () => void;
};

type WorkspaceMessage = AgentRecord['messages'][number];

const emptySource: DraftSource = {
  type: 'markdown',
  label: '',
  url: '',
  content: '',
};

const draftSourceTypes: DraftSource['type'][] = [
  'text',
  'markdown',
  'file',
  'github',
  'url',
  'online-skill',
];

const isDraftSourceType = (value: string): value is DraftSource['type'] =>
  draftSourceTypes.some((sourceType) => sourceType === value);

const isAgentRecord = (value: unknown): value is AgentRecord => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return 'id' in value && typeof value.id === 'number';
};

const isAgentListPayload = (value: unknown): value is { agents: AgentRecord[] } => {
  if (!value || typeof value !== 'object' || !('agents' in value)) {
    return false;
  }

  return Array.isArray(value.agents) && value.agents.every(isAgentRecord);
};

const isAgentCreatePayload = (value: unknown): value is { agent: AgentRecord } => {
  if (!value || typeof value !== 'object' || !('agent' in value)) {
    return false;
  }

  return isAgentRecord(value.agent);
};

const statusClassName = (status: string) => {
  if (status === 'ready') {
    return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300';
  }

  if (status === 'training') {
    return 'border-amber-400/40 bg-amber-400/10 text-amber-300';
  }

  return 'border-slate-600 bg-slate-800 text-slate-300';
};

const appendMessagesToAgent = (options: {
  agents: AgentRecord[];
  agentId: number;
  messages: WorkspaceMessage[];
}) =>
  options.agents.map((agent) => {
    if (agent.id !== options.agentId) {
      return agent;
    }

    return {
      ...agent,
      messages: [...agent.messages, ...options.messages],
    };
  });

const updateAgentMessage = (options: {
  agents: AgentRecord[];
  agentId: number;
  messageId: number;
  content: string;
}) =>
  options.agents.map((agent) => {
    if (agent.id !== options.agentId) {
      return agent;
    }

    return {
      ...agent,
      messages: agent.messages.map((message) => {
        if (message.id !== options.messageId) {
          return message;
        }

        return {
          ...message,
          content: options.content,
        };
      }),
    };
  });

// eslint-disable-next-line complexity
export const AgentWorkspace = (props: { initialAgents: AgentRecord[] }) => {
  const t = useTranslations('AgentWorkspace');
  const router = useRouter();
  const [agents, setAgents] = useState(props.initialAgents);
  const [selectedAgentId, setSelectedAgentId] = useState(props.initialAgents[0]?.id ?? 0);
  const [draftSource, setDraftSource] = useState(emptySource);
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [codexApiEndpoint, setCodexApiEndpoint] = useState('');
  const [onlineSkillUrl, setOnlineSkillUrl] = useState('');
  const [mcpConnectorUrl, setMcpConnectorUrl] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState(0);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  const isStreaming = streamingMessageId !== 0;
  const isBusy = isSubmitting || isStreaming;
  const canCreateAgent =
    agentName.trim().length > 0 &&
    draftSource.label.trim().length > 0 &&
    (draftSource.content.trim().length > 0 || draftSource.url.trim().length > 0);
  const latestSkill = selectedAgent?.skills[0];

  const refreshAgents = async () => {
    const response = await fetch('/api/agents');
    const payload: unknown = await response.json();

    if (!isAgentListPayload(payload)) {
      return;
    }

    setAgents(payload.agents);

    if (payload.agents.length > 0 && selectedAgentId === 0) {
      setSelectedAgentId(payload.agents[0]?.id ?? 0);
    }
  };

  const handleCreateAgent = async (event: FormSubmitEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: agentName,
        description: agentDescription,
        codexApiEndpoint,
        onlineSkillUrl,
        mcpConnectorUrl,
        sources: [draftSource],
      }),
    });
    const payload: unknown = await response.json();

    if (isAgentCreatePayload(payload)) {
      setSelectedAgentId(payload.agent.id);
    }

    setAgentName('');
    setAgentDescription('');
    setCodexApiEndpoint('');
    setOnlineSkillUrl('');
    setMcpConnectorUrl('');
    setDraftSource(emptySource);
    await refreshAgents();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleTrainAgent = async (agentId: number) => {
    setIsSubmitting(true);
    await fetch(`/api/agents/${agentId}/train`, {
      method: 'POST',
    });
    await refreshAgents();
    router.refresh();
    setIsSubmitting(false);
  };

  const handleSendMessage = async (event: FormSubmitEvent) => {
    event.preventDefault();

    if (!selectedAgent || selectedAgent.status !== 'ready' || isBusy) {
      return;
    }

    const question = chatInput.trim();

    if (!question) {
      return;
    }

    const createdAt = new Date().toISOString();
    const userMessageId = -Date.now();
    const assistantMessageId = userMessageId - 1;
    const userMessage: WorkspaceMessage = {
      id: userMessageId,
      agentId: selectedAgent.id,
      ownerId: selectedAgent.ownerId,
      role: 'user',
      content: question,
      createdAt,
    };
    const assistantMessage: WorkspaceMessage = {
      id: assistantMessageId,
      agentId: selectedAgent.id,
      ownerId: selectedAgent.ownerId,
      role: 'assistant',
      content: '',
      createdAt,
    };

    setChatInput('');
    setStreamingMessageId(assistantMessageId);
    setAgents((currentAgents) =>
      appendMessagesToAgent({
        agents: currentAgents,
        agentId: selectedAgent.id,
        messages: [userMessage, assistantMessage],
      }),
    );

    const response = await fetch(`/api/agents/${selectedAgent.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: question,
      }),
    });

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        streamedContent += decoder.decode(value, { stream: true });
        const nextContent = streamedContent;
        setAgents((currentAgents) =>
          updateAgentMessage({
            agents: currentAgents,
            agentId: selectedAgent.id,
            messageId: assistantMessageId,
            content: nextContent,
          }),
        );
      }
    }

    await refreshAgents();
    router.refresh();
    setStreamingMessageId(0);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    const content = await file.text();
    setDraftSource({
      type: 'file',
      label: file.name,
      url: '',
      content,
    });
  };

  return (
    <div className="py-4 text-slate-950">
      <div className="mb-4 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-normal text-slate-950">{t('title')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
          </div>
          <div className="flex gap-2 text-xs text-slate-600">
            <span className="rounded-sm border border-slate-200 bg-slate-50 px-2.5 py-1">
              {agents.length} {t('agents_metric')}
            </span>
            <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
              {selectedAgent?.status === 'ready' ? t('status_ready') : t('status_draft')}
            </span>
          </div>
        </div>
      </div>

      <div
        className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:h-[calc(100vh-220px)] xl:min-h-[640px] xl:grid-cols-[240px_minmax(320px,420px)_minmax(0,1fr)]"
        data-testid="agent-workspace-shell"
      >
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-slate-800 bg-slate-950 text-white shadow-sm xl:h-full">
          <div className="shrink-0 border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-100">{t('agents_panel_title')}</h2>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {agents.map((agent) => {
              let statusText = t('status_draft');

              if (agent.status === 'ready') {
                statusText = t('status_ready');
              }

              if (agent.status === 'training') {
                statusText = t('status_training');
              }

              return (
                <button
                  className={`w-full cursor-pointer rounded-md border p-3 text-left transition ${
                    selectedAgent?.id === agent.id
                      ? 'border-blue-400 bg-slate-900 shadow-sm'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-600'
                  }`}
                  key={agent.id}
                  type="button"
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-slate-100">
                      {agent.name}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusClassName(agent.status)}`}
                    >
                      {statusText}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
                    {agent.description || t('agent_description_placeholder')}
                  </p>
                  <div className="mt-3 flex gap-2 text-[11px] text-slate-500">
                    <span>{t('sources_count', { count: agent.sources.length })}</span>
                    <span>{t('skills_count', { count: agent.skills.length })}</span>
                  </div>
                </button>
              );
            })}

            {agents.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-100">{t('empty_state_title')}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{t('empty_state_subtitle')}</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid min-h-0 min-w-0 gap-4 xl:h-full xl:grid-rows-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-950">{t('source_panel_title')}</h2>
            </div>
            <form
              className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
              onSubmit={handleCreateAgent}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <label className="text-xs font-medium text-slate-600" htmlFor="agent-name">
                    {t('agent_name_label')}
                  </label>
                  <input
                    id="agent-name"
                    type="text"
                    aria-label={t('agent_name_label')}
                    className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden"
                    value={agentName}
                    onChange={(event) => {
                      setAgentName(event.currentTarget.value);
                    }}
                    placeholder={t('agent_name_placeholder')}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600" htmlFor="source-type">
                    {t('source_type_label')}
                  </label>
                  <select
                    id="source-type"
                    aria-label={t('source_type_label')}
                    className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden"
                    value={draftSource.type}
                    onChange={(event) => {
                      if (!isDraftSourceType(event.currentTarget.value)) {
                        return;
                      }

                      setDraftSource({
                        ...draftSource,
                        type: event.currentTarget.value,
                      });
                    }}
                  >
                    <option value="markdown">{t('source_type_markdown')}</option>
                    <option value="text">{t('source_type_text')}</option>
                    <option value="file">{t('source_type_file')}</option>
                    <option value="github">{t('source_type_github')}</option>
                    <option value="url">{t('source_type_url')}</option>
                    <option value="online-skill">{t('source_type_online_skill')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600" htmlFor="agent-description">
                  {t('agent_description_label')}
                </label>
                <textarea
                  id="agent-description"
                  aria-label={t('agent_description_label')}
                  className="mt-1 min-h-12 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden"
                  value={agentDescription}
                  onChange={(event) => {
                    setAgentDescription(event.currentTarget.value);
                  }}
                  placeholder={t('agent_description_placeholder')}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <label className="text-xs font-medium text-slate-600" htmlFor="source-label">
                    {t('source_label_label')}
                  </label>
                  <input
                    id="source-label"
                    type="text"
                    aria-label={t('source_label_label')}
                    className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden"
                    value={draftSource.label}
                    onChange={(event) => {
                      setDraftSource({
                        ...draftSource,
                        label: event.currentTarget.value,
                      });
                    }}
                    placeholder={t('source_label_placeholder')}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600" htmlFor="source-url">
                    {t('source_url_label')}
                  </label>
                  <input
                    id="source-url"
                    type="url"
                    aria-label={t('source_url_label')}
                    className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden"
                    value={draftSource.url}
                    onChange={(event) => {
                      setDraftSource({
                        ...draftSource,
                        url: event.currentTarget.value,
                      });
                    }}
                    placeholder={t('source_url_placeholder')}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600" htmlFor="source-file">
                  {t('source_file_label')}
                </label>
                <input
                  id="source-file"
                  aria-label={t('source_file_label')}
                  className="mt-1 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-slate-700"
                  type="file"
                  accept=".txt,.md,.markdown"
                  onChange={handleFileChange}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600" htmlFor="source-content">
                  {t('source_content_label')}
                </label>
                <textarea
                  id="source-content"
                  aria-label={t('source_content_label')}
                  className="mt-1 min-h-24 w-full rounded-sm border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-5 focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden"
                  value={draftSource.content}
                  onChange={(event) => {
                    setDraftSource({
                      ...draftSource,
                      content: event.currentTarget.value,
                    });
                  }}
                  placeholder={t('source_content_placeholder')}
                />
              </div>

              <div className="grid gap-2 border-t border-slate-100 pt-4">
                <input
                  id="codex-api-endpoint"
                  type="url"
                  aria-label={t('codex_api_placeholder')}
                  className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden"
                  value={codexApiEndpoint}
                  onChange={(event) => {
                    setCodexApiEndpoint(event.currentTarget.value);
                  }}
                  placeholder={t('codex_api_placeholder')}
                />
                <input
                  id="online-skill-url"
                  type="url"
                  aria-label={t('online_skill_placeholder')}
                  className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden"
                  value={onlineSkillUrl}
                  onChange={(event) => {
                    setOnlineSkillUrl(event.currentTarget.value);
                  }}
                  placeholder={t('online_skill_placeholder')}
                />
                <input
                  id="mcp-connector-url"
                  type="url"
                  aria-label={t('mcp_connector_placeholder')}
                  className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden"
                  value={mcpConnectorUrl}
                  onChange={(event) => {
                    setMcpConnectorUrl(event.currentTarget.value);
                  }}
                  placeholder={t('mcp_connector_placeholder')}
                />
              </div>

              <button
                className="w-full cursor-pointer rounded-sm bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:ring-3 focus:ring-blue-200/70 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                type="submit"
                disabled={!canCreateAgent || isBusy}
              >
                {t('create_agent_button')}
              </button>
            </form>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-950">{t('skill_panel_title')}</h2>
            </div>
            {latestSkill ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-hidden p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{latestSkill.title}</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">
                    {latestSkill.summary}
                  </p>
                </div>
                <pre
                  className="max-h-64 min-h-0 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-xs leading-5 [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-slate-100"
                  data-testid="agent-skill-content"
                >
                  {latestSkill.content}
                </pre>
              </div>
            ) : (
              <p className="p-4 text-sm leading-6 text-slate-500">{t('empty_skill')}</p>
            )}
          </div>
        </section>

        <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-sm xl:h-full xl:min-h-0">
          {selectedAgent ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-slate-800 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">{selectedAgent.name}</h2>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${statusClassName(selectedAgent.status)}`}
                      >
                        {selectedAgent.status === 'ready' ? t('status_ready') : t('status_draft')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{selectedAgent.description}</p>
                  </div>
                  <button
                    className="cursor-pointer rounded-sm border border-slate-700 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-900 focus:ring-3 focus:ring-blue-500/30 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                    type="button"
                    disabled={isBusy}
                    onClick={async () => {
                      await handleTrainAgent(selectedAgent.id);
                    }}
                  >
                    {selectedAgent.status === 'ready'
                      ? t('retrain_agent_button')
                      : t('train_agent_button')}
                  </button>
                </div>
                <div className="mt-4 grid gap-2 text-xs text-slate-400 md:grid-cols-3">
                  <div className="rounded-sm border border-slate-800 bg-slate-900 px-3 py-2">
                    <span className="font-medium text-slate-200">{t('sources_metric')}</span>
                    <div>{selectedAgent.sources.length}</div>
                  </div>
                  <div className="rounded-sm border border-slate-800 bg-slate-900 px-3 py-2">
                    <span className="font-medium text-slate-200">{t('trained_metric')}</span>
                    <div className="truncate">{selectedAgent.trainedAt ?? t('not_trained')}</div>
                  </div>
                  <div className="rounded-sm border border-slate-800 bg-slate-900 px-3 py-2">
                    <span className="font-medium text-slate-200">{t('mcp_metric')}</span>
                    <div className="truncate">
                      {selectedAgent.mcpConnectorUrl || t('not_connected')}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="min-h-0 flex-1 overflow-y-auto bg-slate-950 p-4 md:p-5"
                data-testid="agent-chat-log"
              >
                {selectedAgent.messages.length === 0 ? (
                  <p className="text-sm text-slate-400">{t('empty_chat')}</p>
                ) : (
                  <div className="space-y-4">
                    {selectedAgent.messages.map((message) => (
                      <div
                        className={`grid gap-2 ${
                          message.role === 'user' ? 'justify-items-end' : 'justify-items-start'
                        }`}
                        key={message.id}
                      >
                        <div
                          className={`max-w-[min(92%,760px)] rounded-md border px-4 py-3 [overflow-wrap:anywhere] break-words ${
                            message.role === 'user'
                              ? 'border-blue-500 bg-blue-500 text-sm leading-6 text-white'
                              : 'border-slate-200 bg-white shadow-sm'
                          }`}
                          data-testid={`agent-message-${message.id}`}
                        >
                          {message.role === 'assistant' ? (
                            <MarkdownMessage
                              content={
                                message.content ||
                                (message.id === streamingMessageId ? t('streaming_label') : '')
                              }
                            />
                          ) : (
                            <div className="[overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                              {message.content}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                className="shrink-0 border-t border-slate-800 bg-slate-900 p-4"
                onSubmit={handleSendMessage}
              >
                <label className="sr-only" htmlFor="chat-input">
                  {t('chat_input_label')}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="chat-input"
                    type="text"
                    aria-label={t('chat_input_label')}
                    className="min-w-0 flex-1 rounded-sm border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:ring-3 focus:ring-blue-500/30 focus:outline-hidden disabled:bg-slate-900"
                    value={chatInput}
                    onChange={(event) => {
                      setChatInput(event.currentTarget.value);
                    }}
                    placeholder={
                      selectedAgent.status === 'ready'
                        ? t('chat_input_placeholder')
                        : t('chat_disabled_placeholder')
                    }
                    disabled={selectedAgent.status !== 'ready' || isStreaming}
                  />
                  <button
                    className="cursor-pointer rounded-sm bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 focus:ring-3 focus:ring-emerald-500/30 focus:outline-hidden disabled:pointer-events-none disabled:opacity-50"
                    type="submit"
                    disabled={
                      selectedAgent.status !== 'ready' || chatInput.trim().length === 0 || isBusy
                    }
                  >
                    {isStreaming ? t('streaming_button') : t('send_message_button')}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex min-h-[560px] flex-1 items-center justify-center p-8 text-center xl:min-h-0">
              <div>
                <h2 className="text-xl font-semibold text-white">{t('empty_state_title')}</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                  {t('empty_state_subtitle')}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
