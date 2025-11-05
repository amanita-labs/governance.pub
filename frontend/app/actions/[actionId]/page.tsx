import { getGovernanceAction, getActionVotingResults } from '@/lib/governance';
import ActionDetail from '@/components/features/ActionDetail';
import { notFound } from 'next/navigation';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ actionId: string }>;
}

export default async function ActionDetailPage({ params }: PageProps) {
  const { actionId } = await params;
  const action = await getGovernanceAction(actionId);
  const votingResults = await getActionVotingResults(actionId);

  if (!action) {
    notFound();
  }

  return <ActionDetail action={action} votingResults={votingResults} />;
}

