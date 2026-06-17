import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { AgentRecord } from '@/features/agents/AgentTypes';
import messages from '@/locales/en.json';
import { AgentWorkspace } from './AgentWorkspace';

vi.mock(import('@/libs/I18nNavigation'), async (importOriginal) => {
  const original = await importOriginal();

  return {
    ...original,
    useRouter: () => ({
      back: vi.fn<ReturnType<typeof original.useRouter>['back']>(),
      forward: vi.fn<ReturnType<typeof original.useRouter>['forward']>(),
      prefetch: vi.fn<ReturnType<typeof original.useRouter>['prefetch']>(),
      push: vi.fn<ReturnType<typeof original.useRouter>['push']>(),
      refresh: vi.fn<() => void>(),
      replace: vi.fn<ReturnType<typeof original.useRouter>['replace']>(),
    }),
  };
});

const repeatedText = Array.from(
  { length: 48 },
  (_, index) => `Long content segment ${index + 1}`,
).join(' ');

const agentFixture: AgentRecord = {
  id: 1,
  ownerId: 'owner_1',
  name: 'Taric',
  description: 'Dense training workspace agent',
  status: 'ready',
  codexApiEndpoint: '',
  onlineSkillUrl: '',
  mcpConnectorUrl: '',
  trainedAt: '2026-06-17T01:28:55.455Z',
  createdAt: '2026-06-17T01:28:55.455Z',
  updatedAt: '2026-06-17T01:28:55.455Z',
  sources: [
    {
      id: 1,
      agentId: 1,
      type: 'markdown',
      label: 'github-recovery-codes.txt',
      url: 'https://irlin.cn',
      content: repeatedText,
      createdAt: '2026-06-17T01:28:55.455Z',
      updatedAt: '2026-06-17T01:28:55.455Z',
    },
  ],
  skills: [
    {
      id: 1,
      agentId: 1,
      title: 'github-recovery-codes.txt',
      summary: repeatedText,
      content: `# github-recovery-codes.txt\n\n${repeatedText}`,
      createdAt: '2026-06-17T01:28:55.455Z',
      updatedAt: '2026-06-17T01:28:55.455Z',
    },
  ],
  messages: [
    {
      id: 1,
      agentId: 1,
      ownerId: 'owner_1',
      role: 'user',
      content: 'How large is your memory?',
      createdAt: '2026-06-17T01:28:55.455Z',
    },
    {
      id: 2,
      agentId: 1,
      ownerId: 'owner_1',
      role: 'assistant',
      content: `The current training data does not include enough detail to answer directly.\n\n${repeatedText}`,
      createdAt: '2026-06-17T01:28:55.455Z',
    },
  ],
};

describe('Agent workspace', () => {
  describe('Layout', () => {
    it('contains dense content within scrollable regions', async () => {
      await render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <AgentWorkspace initialAgents={[agentFixture]} />
        </NextIntlClientProvider>,
      );

      const workspaceShell = page.getByTestId('agent-workspace-shell');
      const chatLog = page.getByTestId('agent-chat-log');
      const skillContent = page.getByTestId('agent-skill-content');
      const assistantMessage = page.getByTestId('agent-message-2');

      await expect.element(workspaceShell).toBeVisible();
      await expect.element(chatLog).toBeVisible();

      expect(workspaceShell.element().getAttribute('class') ?? '').toContain(
        'xl:h-[calc(100vh-220px)]',
      );
      expect(chatLog.element().getAttribute('class') ?? '').toContain('overflow-y-auto');
      expect(skillContent.element().getAttribute('class') ?? '').toContain('max-h-64');
      expect(assistantMessage.element().getAttribute('class') ?? '').toContain('break-words');
    });
  });
});
