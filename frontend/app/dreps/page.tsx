'use client';

import { useEffect, useRef, useState } from 'react';
import DRepList from '@/components/features/DRepList';
import { DRepsSummaryStats } from '@/components/features/DRepsSummaryStats';
import type { DRep, DRepMetadata, JsonValue } from '@/types/governance';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getRecordProperty = (
  value: Record<string, unknown> | undefined,
  key: string
): Record<string, unknown> | undefined => {
  if (!value) {
    return undefined;
  }
  const nested = value[key];
  return isRecord(nested) ? nested : undefined;
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
    const allEntriesValid = value.every((entry) => getJsonValue(entry) !== undefined);
    return allEntriesValid ? (value as JsonValue) : undefined;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).map(([entryKey, entryValue]) => [entryKey, getJsonValue(entryValue)]);
    if (entries.every(([, entryValue]) => entryValue !== undefined)) {
      return Object.fromEntries(entries) as JsonValue;
    }
  }
  return undefined;
};

// Helper function to fetch a sample of DReps for summary statistics
// Only fetch first 100 DReps for stats - much faster than fetching all
async function fetchDRepsForStats(): Promise<DRep[]> {
  try {
    // Only fetch first 100 DReps for stats calculation
    // This is much faster than fetching all pages and provides good enough stats
    const response = await fetch(`/api/dreps?page=1&count=100`);
    if (!response.ok) return [];

    const payload: unknown = await response.json();
    if (isRecord(payload) && Array.isArray(payload.dreps)) {
      return payload.dreps as DRep[];
    }
    return [];
  } catch (error) {
    console.error('Error fetching DReps for stats:', error);
    return [];
  }
}

async function fetchActiveDRepsCount(): Promise<number | null> {
  try {
    const response = await fetch('/api/dreps/stats');
    if (!response.ok) {
      return null;
    }
    const payload: unknown = await response.json();
    if (isRecord(payload) && typeof payload.active_dreps_count === 'number') {
      return payload.active_dreps_count;
    }
    return null;
  } catch (error) {
    console.error('Error fetching active DRep count:', error);
    return null;
  }
}

export default function DRepsPage() {
  const metadataCache = useRef<Map<string, DRepMetadata | null>>(new Map());
  const [dreps, setDReps] = useState<DRep[]>([]);
  const [allDReps, setAllDReps] = useState<DRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAllDReps, setLoadingAllDReps] = useState(false);
  const [activeDRepsCount, setActiveDRepsCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const itemsPerPage = 20;

  const formatImage = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value;
    if (isRecord(value)) {
      return (
        getJsonValue(value.contentUrl) as string | undefined ??
        getJsonValue(value.url) as string | undefined ??
        getJsonValue(value.href) as string | undefined ??
        getJsonValue(value.image) as string | undefined
      );
    }
    return undefined;
  };

  const decodeMetadataBytes = (bytes: string | undefined) => {
    if (!bytes) return null;

    let hex = bytes;
    if (hex.startsWith('\\x')) {
      hex = hex.slice(2);
    }

    // Handle repeated \x from certain encodings
    hex = hex.replace(/\\x/g, '');

    if (hex.length % 2 !== 0) {
      return null;
    }

    try {
      const byteArray = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        byteArray[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      }
      const decoded = new TextDecoder().decode(byteArray);
      if (!decoded) return null;
      return JSON.parse(decoded) as unknown;
    } catch (error) {
      console.warn('Failed to decode metadata bytes', error);
      return null;
    }
  };

  const extractProfileFields = (metadata: unknown): DRepMetadata | null => {
    if (!isRecord(metadata)) {
      return null;
    }

    const collected: DRepMetadata = {};
    const mergeFields = (source: unknown) => {
      if (!isRecord(source)) return;

      const name = getJsonValue(source.name);
      if (typeof name === 'string') collected.name = name;
      const title = getJsonValue(source.title);
      if (typeof title === 'string') collected.title = title;
      const givenName = getJsonValue(source.givenName);
      if (typeof givenName === 'string') {
        collected.name = collected.name || givenName;
        collected.title = collected.title || givenName;
      }
      const description = getJsonValue(source.description);
      if (typeof description === 'string') collected.description = description;
      const abstractValue = getJsonValue(source.abstract);
      if (typeof abstractValue === 'string') {
        collected.description = collected.description || abstractValue;
      }
      const website = getJsonValue(source.website);
      if (typeof website === 'string') collected.website = website;
      const url = getJsonValue(source.url);
      if (typeof url === 'string') {
        collected.website = collected.website || url;
      }
      const email = getJsonValue(source.email);
      if (typeof email === 'string') collected.email = email;
      const image =
        formatImage(source.image) ??
        formatImage(source.logo) ??
        formatImage(source.picture);
      if (image) {
        collected.logo = image;
        collected.image = image;
      }
      const twitter = getJsonValue(source.twitter);
      if (typeof twitter === 'string') collected.twitter = twitter;
      const github = getJsonValue(source.github);
      if (typeof github === 'string') collected.github = github;
      const paymentAddress = getJsonValue(source.paymentAddress);
      if (typeof paymentAddress === 'string') collected.paymentAddress = paymentAddress;
      const doNotList = getJsonValue(source.doNotList);
      if (typeof doNotList === 'boolean') collected.doNotList = doNotList;
      if (source.objectives !== undefined) {
        const objectives = getJsonValue(source.objectives);
        if (objectives !== undefined) {
          collected.objectives = objectives;
        }
      }
      if (source.motivations !== undefined) {
        const motivations = getJsonValue(source.motivations);
        if (motivations !== undefined) {
          collected.motivations = motivations;
        }
      }
      if (source.qualifications !== undefined) {
        const qualifications = getJsonValue(source.qualifications);
        if (qualifications !== undefined) {
          collected.qualifications = qualifications;
        }
      }
    };

    const metadataRecord = metadata;
    const jsonMetadataRecord = getRecordProperty(metadataRecord, 'json_metadata');
    const extraRecord = getRecordProperty(metadataRecord, 'extra');
    const extraJsonMetadataRecord = getRecordProperty(extraRecord, 'json_metadata');

    const bodyCandidates = [
      getRecordProperty(metadataRecord, 'body'),
      jsonMetadataRecord ? getRecordProperty(jsonMetadataRecord, 'body') : undefined,
      extraRecord ? getRecordProperty(extraRecord, 'body') : undefined,
      extraJsonMetadataRecord ? getRecordProperty(extraJsonMetadataRecord, 'body') : undefined,
    ];

    bodyCandidates.forEach((candidate) => mergeFields(candidate));
    mergeFields(metadataRecord);
    mergeFields(extraRecord);
    mergeFields(jsonMetadataRecord);

    const bytesValue = getJsonValue(metadataRecord.bytes);
    if ((!collected.name && !collected.title) && typeof bytesValue === 'string') {
      const decoded = decodeMetadataBytes(bytesValue);
      if (decoded) {
        const decodedResult = extractProfileFields(decoded);
        if (decodedResult) {
          Object.assign(collected, decodedResult);
        }
      }
    }

    return Object.keys(collected).length > 0 ? collected : null;
  };

  const hasProfileMetadata = (metadata?: DRepMetadata) => {
    if (!metadata) return false;
    const relevantFields: Array<keyof DRepMetadata> = ['name', 'title', 'description', 'website'];
    return relevantFields.some((field) => {
      const value = metadata[field];
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return Boolean(value);
    });
  };

  const rememberMetadataFrom = (items: DRep[]) => {
    items.forEach((drep) => {
      if (metadataCache.current.has(drep.drep_id)) {
        return;
      }
      const normalized = extractProfileFields(drep.metadata);
      if (normalized && hasProfileMetadata(normalized)) {
        metadataCache.current.set(drep.drep_id, normalized);
      }
    });
  };

  const applyMetadataFromCache = (items: DRep[]) =>
    items.map((drep) => {
      const cached = metadataCache.current.get(drep.drep_id);
      if (cached === undefined) {
        const derived = extractProfileFields(drep.metadata);
        const metadataToUse = derived ?? drep.metadata ?? undefined;
        return {
          ...drep,
          metadata: metadataToUse,
          has_profile: hasProfileMetadata(metadataToUse),
        };
      }

      if (cached === null) {
        return {
          ...drep,
          metadata: undefined,
          has_profile: false,
        };
      }

      const mergedMetadata = {
        ...(extractProfileFields(drep.metadata) ?? {}),
        ...cached,
      } as DRepMetadata;

      return {
        ...drep,
        metadata: mergedMetadata,
        has_profile: hasProfileMetadata(mergedMetadata),
      };
    });

  const fetchMissingMetadata = async (items: DRep[]) => {
    const results = await Promise.all(
      items.map(async (drep) => {
        try {
          const response = await fetch(`/api/dreps/${encodeURIComponent(drep.drep_id)}/metadata`);
          if (!response.ok) {
            console.warn(`Failed to fetch metadata for ${drep.drep_id}: ${response.status}`);
            return [drep.drep_id, null] as const;
          }
          const metadataPayload: unknown = await response.json();
          const extracted = extractProfileFields(metadataPayload);
          if (extracted && hasProfileMetadata(extracted)) {
            console.debug(
              'Enriched metadata for DRep',
              drep.drep_id,
              extracted?.name || extracted?.title || extracted?.description
            );
            return [drep.drep_id, extracted] as const;
          }
          console.debug('No usable metadata for DRep', drep.drep_id);
          return [drep.drep_id, null] as const;
        } catch (error) {
          console.error(`Error fetching metadata for ${drep.drep_id}:`, error);
          return [drep.drep_id, null] as const;
        }
      })
    );

    results.forEach(([id, metadata]) => {
      metadataCache.current.set(id, metadata);
    });
  };

  useEffect(() => {
    let isCancelled = false;

    async function loadDReps() {
      setLoading(true);
      try {
        // Enable enrichment for first page to get vote counts and other stats
        const enrichParam = currentPage === 1 ? '&enrich=true' : '';
        const response = await fetch(`/api/dreps?page=${currentPage}&count=${itemsPerPage}${enrichParam}`);
        if (response.ok) {
          const payload: unknown = await response.json();
          if (!isRecord(payload) || !Array.isArray(payload.dreps)) {
            console.error('Unexpected DReps payload format');
            if (!isCancelled) {
              setDReps([]);
              setHasMore(false);
            }
            return;
          }

          const drepsData = payload.dreps as DRep[];
          rememberMetadataFrom(drepsData);
          const drepsWithCachedMetadata = applyMetadataFromCache(drepsData);
          const hasMoreRaw = typeof payload.hasMore === 'boolean' ? payload.hasMore : undefined;
          const hasMoreAlt = typeof (payload as Record<string, unknown>).has_more === 'boolean'
            ? ((payload as Record<string, unknown>).has_more as boolean)
            : undefined;
          const normalizedHasMore = hasMoreRaw ?? hasMoreAlt ?? false;
          if (!isCancelled) {
            setDReps(drepsWithCachedMetadata);
            setHasMore(normalizedHasMore);
          }

          const drepsNeedingMetadata = drepsData.filter((drep) => {
            if (metadataCache.current.has(drep.drep_id)) {
              return false;
            }
            return !hasProfileMetadata(drep.metadata) || !(drep.metadata?.name || drep.metadata?.title);
          });

          if (drepsNeedingMetadata.length > 0) {
            fetchMissingMetadata(drepsNeedingMetadata)
              .then(() => {
                if (!isCancelled) {
                  setDReps((prev) => applyMetadataFromCache(prev));
                  setAllDReps((prev) => (prev.length > 0 ? applyMetadataFromCache(prev) : prev));
                }
              })
              .catch((error) => {
                console.error('Error enriching DRep metadata:', error);
              });
          }
          
          // For the voting power chart and stats, load a sample of DReps on first page
          if (currentPage === 1) {
            // Fetch first 100 DReps for summary statistics (much faster than fetching all)
            // This is done in the background so it doesn't block the initial render
            setLoadingAllDReps(true);
            Promise.all([
              fetchDRepsForStats(), // Only fetch first 100 DReps
              fetchActiveDRepsCount(), // Fetch active DReps count from backend via API route
            ])
              .then(([drepSample, activeCount]) => {
                console.log(`Loaded ${drepSample.length} DReps for stats`);
                rememberMetadataFrom(drepSample);
                const sampleWithMetadata = applyMetadataFromCache(drepSample);
                if (!isCancelled) {
                  setAllDReps(sampleWithMetadata);
                  setActiveDRepsCount(activeCount);
                  setLoadingAllDReps(false);
                }
                const sampleNeedingMetadata = drepSample.filter((drep) => {
                  if (metadataCache.current.has(drep.drep_id)) {
                    return false;
                  }
                  const normalized = extractProfileFields(drep.metadata);
                  const metadataToAssess = normalized ?? drep.metadata;
                  return (
                    !hasProfileMetadata(metadataToAssess) ||
                    !(
                      metadataToAssess?.name ||
                      metadataToAssess?.title
                    )
                  );
                });
                if (sampleNeedingMetadata.length > 0) {
                  fetchMissingMetadata(sampleNeedingMetadata)
                    .then(() => {
                      if (!isCancelled) {
                        setAllDReps((prev) => (prev.length > 0 ? applyMetadataFromCache(prev) : prev));
                      }
                    })
                    .catch((error) => {
                      console.error('Error enriching summary DRep metadata:', error);
                    });
                }
              })
              .catch((error) => {
                console.error('Error fetching DReps for stats:', error);
                // If fetching fails, use the paginated data as fallback
                if (!isCancelled) {
                  setAllDReps(applyMetadataFromCache(drepsData));
                  setLoadingAllDReps(false);
                }
              });
          }
        } else {
          console.error('Failed to fetch DReps');
        }
      } catch (error) {
        console.error('Error loading DReps:', error);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }
    loadDReps();
    return () => {
      isCancelled = true;
    };
  }, [currentPage]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-foreground mb-2">DReps Directory</h1>
        <p className="text-muted-foreground">
          Explore and connect with Delegated Representatives (DReps) in the Cardano ecosystem
        </p>
      </div>

      {/* Summary Stats */}
      {loadingAllDReps && allDReps.length === 0 ? (
        <div className="mb-8 text-center text-muted-foreground">
          Loading statistics...
        </div>
      ) : (
        <DRepsSummaryStats 
          dreps={allDReps.length > 0 ? allDReps : dreps} 
          activeDRepsCount={activeDRepsCount}
        />
      )}

      {/* DRep List */}
      <DRepList 
        dreps={dreps} 
        currentPage={currentPage}
        hasMore={hasMore}
        onPageChange={setCurrentPage}
        loading={loading && currentPage === 1}
      />
    </div>
  );
}

