'use client';

import { useEffect, useRef, useState } from 'react';
import DRepList from '@/components/features/DRepList';
import { DRepsSummaryStats } from '@/components/features/DRepsSummaryStats';
import type { DRep } from '@/types/governance';

type MetadataLike = DRep['metadata'] & { body?: any; json_metadata?: any; extra?: any } | any;

// Helper function to fetch a sample of DReps for summary statistics
// Only fetch first 100 DReps for stats - much faster than fetching all
async function fetchDRepsForStats(): Promise<DRep[]> {
  try {
    // Only fetch first 100 DReps for stats calculation
    // This is much faster than fetching all pages and provides good enough stats
    const response = await fetch(`/api/dreps?page=1&count=100`);
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.dreps || [];
  } catch (error) {
    console.error('Error fetching DReps for stats:', error);
    return [];
  }
}

export default function DRepsPage() {
  const metadataCache = useRef<Map<string, DRep['metadata'] | null>>(new Map());
  const [dreps, setDReps] = useState<DRep[]>([]);
  const [allDReps, setAllDReps] = useState<DRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAllDReps, setLoadingAllDReps] = useState(false);
  const [activeDRepsCount, setActiveDRepsCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const itemsPerPage = 20;

  const formatImage = (value: any): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.contentUrl || value.url || value.href || value.image || undefined;
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
      return JSON.parse(decoded);
    } catch (error) {
      console.warn('Failed to decode metadata bytes', error);
      return null;
    }
  };

  const extractProfileFields = (metadata: MetadataLike): DRep['metadata'] | null => {
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    const collected: Record<string, any> = {};

    const mergeFields = (source: Record<string, any> | null | undefined) => {
      if (!source || typeof source !== 'object') return;

      if (typeof source.name === 'string') collected.name = source.name;
      if (typeof source.title === 'string') collected.title = source.title;
      if (typeof source.givenName === 'string') {
        collected.name = collected.name || source.givenName;
        collected.title = collected.title || source.givenName;
      }
      if (typeof source.description === 'string') collected.description = source.description;
      if (typeof source.abstract === 'string') {
        collected.description = collected.description || source.abstract;
      }
      if (typeof source.website === 'string') collected.website = source.website;
      if (typeof source.url === 'string') {
        collected.website = collected.website || source.url;
      }
      if (typeof source.email === 'string') collected.email = source.email;
      const image = formatImage(source.image || source.logo || source.picture);
      if (image) {
        collected.logo = image;
        collected.image = image;
      }
      if (typeof source.twitter === 'string') collected.twitter = source.twitter;
      if (typeof source.github === 'string') collected.github = source.github;
      if (typeof source.paymentAddress === 'string') collected.paymentAddress = source.paymentAddress;
      if (typeof source.doNotList === 'boolean') collected.doNotList = source.doNotList;
      if (source.objectives) collected.objectives = source.objectives;
      if (source.motivations) collected.motivations = source.motivations;
      if (source.qualifications) collected.qualifications = source.qualifications;
    };

    const bodyCandidates = [
      metadata.body,
      metadata.json_metadata?.body,
      metadata.extra?.body,
      metadata.extra?.json_metadata?.body,
    ];

    bodyCandidates.forEach((candidate) => mergeFields(candidate));
    mergeFields(metadata);
    mergeFields(metadata.extra);
    mergeFields(metadata.json_metadata);

    if ((!collected.name && !collected.title) && typeof metadata.bytes === 'string') {
      const decoded = decodeMetadataBytes(metadata.bytes);
      if (decoded) {
        const decodedResult = extractProfileFields(decoded);
        if (decodedResult) {
          Object.assign(collected, decodedResult);
        }
      }
    }

    return Object.keys(collected).length > 0 ? (collected as DRep['metadata']) : null;
  };

  const hasProfileMetadata = (metadata?: DRep['metadata']) => {
    if (!metadata) return false;
    return ['name', 'title', 'description', 'website'].some((key) => {
      const value = metadata[key];
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
        return {
          ...drep,
          metadata: extractProfileFields(drep.metadata) || drep.metadata,
          has_profile: hasProfileMetadata(drep.metadata),
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
        ...(extractProfileFields(drep.metadata) || {}),
        ...cached,
      };

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
          const metadata = await response.json();
          if (metadata && typeof metadata === 'object') {
            const extracted = extractProfileFields(metadata);
            if (extracted && hasProfileMetadata(extracted)) {
              console.debug('Enriched metadata for DRep', drep.drep_id, extracted?.name || extracted?.title || extracted?.description);
              return [drep.drep_id, extracted] as const;
            }
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
          const data = await response.json();
          rememberMetadataFrom(data.dreps);
          const drepsWithCachedMetadata = applyMetadataFromCache(data.dreps);
          if (!isCancelled) {
            setDReps(drepsWithCachedMetadata);
            setHasMore(data.hasMore);
          }

          const drepsNeedingMetadata = data.dreps.filter((drep: DRep) => {
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
              fetch('/api/dreps/stats').then(res => res.json()).then(data => data.active_dreps_count).catch(() => null), // Fetch active DReps count from backend via API route
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
                const sampleNeedingMetadata = drepSample.filter((drep: DRep) => {
                  if (metadataCache.current.has(drep.drep_id)) {
                    return false;
                  }
                  const normalized = extractProfileFields(drep.metadata);
                  return !hasProfileMetadata(normalized || drep.metadata) || !((normalized || drep.metadata)?.name || (normalized || drep.metadata)?.title);
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
                  setAllDReps(applyMetadataFromCache(data.dreps));
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

