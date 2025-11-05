import { getDRep, getDRepVotingHistory, getDRepMetadata, getDRepDelegators } from '@/lib/governance';
import DRepDetail from '@/components/features/DRepDetail';
import { notFound } from 'next/navigation';

export const revalidate = 60;

interface PageProps {
  params: Promise<{ drepId: string }>;
}

export default async function DRepDetailPage({ params }: PageProps) {
  const { drepId } = await params;
  const [drep, votingHistory, metadata, delegators] = await Promise.all([
    getDRep(drepId),
    getDRepVotingHistory(drepId),
    getDRepMetadata(drepId), // Fetch metadata from the metadata endpoint
    getDRepDelegators(drepId), // Fetch delegators
  ]);

  if (!drep) {
    notFound();
  }

  // Merge metadata from the metadata endpoint into the DRep object
  const enrichedDRep = {
    ...drep,
    metadata: {
      ...drep.metadata,
      ...metadata, // Merge metadata from the metadata endpoint
    },
  };

  return <DRepDetail drep={enrichedDRep} votingHistory={votingHistory} delegators={delegators} />;
}

