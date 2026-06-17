import { setRequestLocale } from 'next-intl/server';
import { AgentWorkspace } from '@/components/agents/AgentWorkspace';
import { getAgentOwnerId } from '@/features/agents/AgentAuth';
import { loadAgentRecords } from '@/features/agents/AgentRecords';

export default async function DashboardPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const ownerId = await getAgentOwnerId();
  const agents = ownerId ? await loadAgentRecords(ownerId) : [];

  return <AgentWorkspace initialAgents={agents} />;
}
