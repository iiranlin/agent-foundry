import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AgentWorkspace } from '@/components/agents/AgentWorkspace';
import { getAgentOwnerId } from '@/features/agents/AgentAuth';
import { loadAgentRecords } from '@/features/agents/AgentRecords';

type IndexPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: IndexPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'Index',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function IndexPage(props: IndexPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const ownerId = await getAgentOwnerId();
  const agents = ownerId ? await loadAgentRecords(ownerId) : [];

  return <AgentWorkspace initialAgents={agents} />;
}
