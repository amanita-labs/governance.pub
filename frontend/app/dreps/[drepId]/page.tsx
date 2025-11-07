import { getDRep, getDRepVotingHistory, getDRepMetadata, getDRepDelegators } from '@/lib/governance';
import DRepDetail from '@/components/features/DRepDetail';
import { notFound } from 'next/navigation';
import type { DRepMetadata, JsonValue } from '@/types/governance';

export const revalidate = 60;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const formatImage = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  if (isRecord(value)) {
    const candidates: Array<unknown> = [
      value.contentUrl,
      value.url,
      value.href,
      value.image,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        return candidate;
      }
    }
  }
  return undefined;
};

const getJsonValue = (value: unknown): JsonValue | undefined => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    const entries = value.map((entry) => getJsonValue(entry));
    return entries.every((entry) => entry !== undefined) ? (entries as JsonValue) : undefined;
  }
  if (isRecord(value)) {
    const normalizedEntries = Object.entries(value).map(([key, entry]) => [key, getJsonValue(entry)]);
    return normalizedEntries.every(([, entry]) => entry !== undefined)
      ? (Object.fromEntries(normalizedEntries) as JsonValue)
      : undefined;
  }
  return undefined;
};

const extractCip119Metadata = (metadata: unknown): Partial<DRepMetadata> | undefined => {
  if (!isRecord(metadata)) {
    return undefined;
  }

  const jsonMetadata = isRecord(metadata.json_metadata) ? metadata.json_metadata : undefined;
  const body = jsonMetadata && isRecord(jsonMetadata.body) ? jsonMetadata.body : undefined;
  if (!body) {
    return undefined;
  }

  const result: Partial<DRepMetadata> = {};
  const givenName = getJsonValue(body.givenName);
  const name = typeof givenName === 'string' ? givenName : getJsonValue(body.name);
  if (typeof name === 'string') {
    result.name = name;
    result.title = name;
  }
  const description = getJsonValue(body.description) ?? getJsonValue(body.abstract);
  if (typeof description === 'string') {
    result.description = description;
  }
  const objectives = getJsonValue(body.objectives);
  if (objectives !== undefined) {
    result.objectives = objectives;
  }
  const motivations = getJsonValue(body.motivations);
  if (motivations !== undefined) {
    result.motivations = motivations;
  }
  const qualifications = getJsonValue(body.qualifications);
  if (qualifications !== undefined) {
    result.qualifications = qualifications;
  }

  const image =
    formatImage(body.image) ??
    formatImage(body.logo) ??
    formatImage(body.picture);
  if (image) {
    result.image = image;
    result.logo = image;
    result.picture = image;
  }

  const email = getJsonValue(body.email);
  if (typeof email === 'string') {
    result.email = email;
  }
  const website = getJsonValue(body.website) ?? getJsonValue(body.url);
  if (typeof website === 'string') {
    result.website = website;
  }
  const twitter = getJsonValue(body.twitter);
  if (typeof twitter === 'string') {
    result.twitter = twitter;
  }
  const github = getJsonValue(body.github);
  if (typeof github === 'string') {
    result.github = github;
  }
  const paymentAddress = getJsonValue(body.paymentAddress);
  if (typeof paymentAddress === 'string') {
    result.paymentAddress = paymentAddress;
  }
  const doNotList = getJsonValue(body.doNotList);
  if (typeof doNotList === 'boolean') {
    result.doNotList = doNotList;
  }

  return result;
};

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

  const extractedMetadata = extractCip119Metadata(metadata);
  const combinedMetadata: DRepMetadata = {
    ...(drep.metadata ?? {}),
  };

  if (extractedMetadata) {
    Object.entries(extractedMetadata).forEach(([key, value]) => {
      if (value !== undefined) {
        combinedMetadata[key as keyof DRepMetadata] = value as DRepMetadata[keyof DRepMetadata];
      }
    });
  }

  if (isRecord(metadata) && !isRecord(metadata.json_metadata)) {
    Object.entries(metadata).forEach(([key, value]) => {
      const normalizedValue = getJsonValue(value);
      if (normalizedValue !== undefined) {
        combinedMetadata[key as keyof DRepMetadata] = normalizedValue as DRepMetadata[keyof DRepMetadata];
      }
    });
  }

  const metadataEntries = Object.keys(combinedMetadata);
  const metadataToUse: DRepMetadata | undefined =
    metadataEntries.length > 0 ? combinedMetadata : undefined;

  const enrichedDRep = {
    ...drep,
    metadata: metadataToUse,
  };

  return <DRepDetail drep={enrichedDRep} votingHistory={votingHistory} delegators={delegators} />;
}

