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

  // Extract CIP-119 fields from json_metadata.body structure
  let extractedMetadata: any = {};
  if (metadata?.json_metadata?.body) {
    const body = metadata.json_metadata.body;
    extractedMetadata = {
      // Map CIP-119 fields to component expectations
      name: body.givenName || body.name,
      title: body.givenName || body.name,
      description: body.description || body.abstract,
      objectives: body.objectives,
      motivations: body.motivations,
      qualifications: body.qualifications,
      // Extract image URL
      image: body.image?.contentUrl || body.image,
      logo: body.image?.contentUrl || body.image,
      picture: body.image?.contentUrl || body.image,
      // Contact information (if available in references)
      email: body.email,
      website: body.website || body.url,
      twitter: body.twitter,
      github: body.github,
      // Payment address
      paymentAddress: body.paymentAddress,
      // Do not list flag
      doNotList: body.doNotList,
    };
  }

  // Merge metadata from the metadata endpoint into the DRep object
  const enrichedDRep = {
    ...drep,
    metadata: {
      ...drep.metadata,
      ...extractedMetadata, // Use extracted CIP-119 fields
      // Also include raw metadata for backwards compatibility
      ...(metadata && !metadata.json_metadata ? metadata : {}),
    },
  };

  return <DRepDetail drep={enrichedDRep} votingHistory={votingHistory} delegators={delegators} />;
}

