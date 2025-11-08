'use client';

import { useEffect, useState, useRef } from 'react';
import DRepList from '@/components/features/DRepList';
import { DRepsSummaryStats } from '@/components/features/DRepsSummaryStats';
import type { DRep, DRepMetadata } from '@/types/governance';
import {
  sanitizeMetadataValue,
  getMetadataName,
  getMetadataDescription,
  getMetadataWebsite,
} from '@/lib/governance/drepMetadata';

const ITEMS_PER_PAGE = 20;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

type StatusFilter = 'All' | 'Active' | 'Inactive' | 'Retired' | 'Script';
type SortFilter = 'Activity' | 'VotingPower' | 'Name' | 'Registration';
type SortDirection = 'Descending' | 'Ascending';

interface QueryState {
  page: number;
  pageSize: number;
  searchQuery: string;
  statusFilter: StatusFilter;
  sortBy: SortFilter;
  sortDirection: SortDirection;
}

const buildQueryParams = ({
  page,
  pageSize,
  searchQuery,
  statusFilter,
  sortBy,
  sortDirection,
}: QueryState) => {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  const trimmedSearch = searchQuery.trim();
  if (trimmedSearch.length > 0) {
    params.set('search', trimmedSearch);
  }

  if (statusFilter !== 'All') {
    params.append('status[]', statusFilter);
  }

  params.set('sort', sortBy);
  params.set('direction', sortDirection);

  return params;
};

interface DRepPagePayload {
  dreps: DRep[];
  hasMore: boolean;
  total: number | null;
}

const extractHasMore = (
  payload: Record<string, unknown>,
  fallbackCount: number,
  expectedPageSize: number
): boolean => {
  if (typeof payload.has_more === 'boolean') {
    return payload.has_more;
  }
  if (typeof payload.hasMore === 'boolean') {
    return payload.hasMore as boolean;
  }
  return fallbackCount >= expectedPageSize;
};

const extractTotal = (payload: Record<string, unknown>): number | null => {
  const total = payload.total;
  if (typeof total === 'number') {
    return total;
  }
  if (typeof total === 'string') {
    const parsed = Number(total);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const fetchDRepsPage = async (
  query: QueryState,
  options?: RequestInit
): Promise<DRepPagePayload> => {
  const params = buildQueryParams(query);
  const response = await fetch(`/api/dreps?${params.toString()}`, options);

  if (!response.ok) {
    throw new Error(`Failed to load DReps: ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new Error('Unexpected DReps payload');
  }

  const dreps = Array.isArray(payload.dreps) ? (payload.dreps as DRep[]) : [];
  const hasMore = extractHasMore(payload, dreps.length, query.pageSize);
  const total = extractTotal(payload);

  return { dreps, hasMore, total };
};

const fetchActiveDRepsCount = async (): Promise<number | null> => {
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
};

export default function DRepsPage() {
  const metadataCache = useRef<Map<string, DRepMetadata | null>>(new Map());
  const [dreps, setDReps] = useState<DRep[]>([]);
  const [allDReps, setAllDReps] = useState<DRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAllDReps, setLoadingAllDReps] = useState(false);
  const [activeDRepsCount, setActiveDRepsCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortBy, setSortBy] = useState<SortFilter>('VotingPower');
  const [sortDirection, setSortDirection] = useState<SortDirection>('Descending');

  const rememberMetadataFrom = (items: DRep[]) => {
    items.forEach((drep) => {
      if (metadataCache.current.has(drep.drep_id)) {
        return;
      }
      if (!drep.metadata) {
        return;
      }
      const sanitized = sanitizeMetadataValue(drep.metadata);
      if (sanitized) {
        metadataCache.current.set(drep.drep_id, sanitized);
      }
    });
  };

  const applyMetadataFromCache = (items: DRep[]): DRep[] =>
    items.map((drep) => {
      let cached = metadataCache.current.get(drep.drep_id);
      if (cached === undefined && drep.metadata) {
        cached = sanitizeMetadataValue(drep.metadata);
        if (cached) {
          metadataCache.current.set(drep.drep_id, cached);
        }
      }

      const metadataToUse = (cached ?? drep.metadata) as DRepMetadata | undefined;
      const nameFromMetadata = getMetadataName(metadataToUse);
      const descriptionFromMetadata = getMetadataDescription(metadataToUse);
      const websiteFromMetadata = getMetadataWebsite(metadataToUse);
      const givenName = drep.given_name && drep.given_name.trim().length > 0 ? drep.given_name : nameFromMetadata;

      const hasProfile =
        drep.has_profile ||
        Boolean(
          (givenName && givenName.trim().length > 0) ||
            descriptionFromMetadata ||
            websiteFromMetadata ||
            drep.objectives ||
            drep.motivations ||
            drep.qualifications ||
            (drep.identity_references && drep.identity_references.length > 0) ||
            (drep.link_references && drep.link_references.length > 0)
        );

      return {
        ...drep,
        metadata: metadataToUse ?? drep.metadata,
        given_name: givenName ?? drep.given_name,
        has_profile: hasProfile,
      };
    });

  const identifyDRepsNeedingMetadata = (items: DRep[]) =>
    items
      .filter((drep) => {
        if (drep.given_name && drep.given_name.trim().length > 0) {
          return false;
        }
        const cached = metadataCache.current.get(drep.drep_id);
        if (cached === null) {
          return false;
        }
        if (cached) {
          return !getMetadataName(cached);
        }
        if (drep.metadata) {
          const sanitized = sanitizeMetadataValue(drep.metadata);
          if (sanitized) {
            metadataCache.current.set(drep.drep_id, sanitized);
            return !getMetadataName(sanitized);
          }
        }
        return true;
      })
      .map((drep) => drep.drep_id);

  const fetchMetadataForDReps = async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetch(`/api/dreps/${encodeURIComponent(id)}/metadata`);
          if (!response.ok) {
            metadataCache.current.set(id, null);
            return;
          }
          const payload: unknown = await response.json();
          const sanitized = sanitizeMetadataValue(payload);
          if (sanitized) {
            metadataCache.current.set(id, sanitized);
          } else {
            metadataCache.current.set(id, null);
          }
        } catch (error) {
          console.error('Failed to fetch DRep metadata', id, error);
          metadataCache.current.set(id, null);
        }
      })
    );
  };

  const queryState: QueryState = {
    page: currentPage,
    pageSize: ITEMS_PER_PAGE,
    searchQuery,
    statusFilter,
    sortBy,
    sortDirection,
  };

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    async function loadDReps() {
      setLoading(true);
      try {
        const { dreps: pageDReps, hasMore: pageHasMore, total } = await fetchDRepsPage(queryState, {
          signal: controller.signal,
        });

        if (!isCancelled) {
          rememberMetadataFrom(pageDReps);
          const appliedPageDReps = applyMetadataFromCache(pageDReps);
          setDReps(appliedPageDReps);
          setHasMore(pageHasMore);
          setTotalCount(total);

          const missingIds = identifyDRepsNeedingMetadata(appliedPageDReps);
          fetchMetadataForDReps(missingIds)
            .then(() => {
              if (!isCancelled) {
                setDReps((previous) => applyMetadataFromCache(previous));
              }
            })
            .catch((error) => {
              console.error('Failed to enrich DRep metadata', error);
            });

          if (currentPage === 1) {
            rememberMetadataFrom(pageDReps);
            const appliedAll = applyMetadataFromCache(pageDReps);
            setAllDReps(appliedAll);
            setLoadingAllDReps(true);

            const statsQuery: QueryState = {
              ...queryState,
              page: 1,
              pageSize: 100,
            };

            Promise.all([fetchDRepsPage(statsQuery), fetchActiveDRepsCount()])
              .then(([sample, activeCount]) => {
                if (!isCancelled) {
                  rememberMetadataFrom(sample.dreps);
                  const appliedSample = applyMetadataFromCache(sample.dreps);
                  setAllDReps(appliedSample);
                  setActiveDRepsCount(activeCount);

                  const sampleMissing = identifyDRepsNeedingMetadata(appliedSample);
                  fetchMetadataForDReps(sampleMissing)
                    .then(() => {
                      if (!isCancelled) {
                        setAllDReps((previous) => applyMetadataFromCache(previous));
                      }
                    })
                    .catch((error) => {
                      console.error('Failed to enrich summary DRep metadata', error);
                    });
                }
              })
              .catch((error) => {
                console.error('Error fetching DRep summary data:', error);
              })
              .finally(() => {
                if (!isCancelled) {
                  setLoadingAllDReps(false);
                }
              });
          }
        }
      } catch (error) {
        if (!isCancelled) {
          if ((error as Error).name !== 'AbortError') {
            console.error('Error loading DReps:', error);
          }
          setDReps([]);
          setHasMore(false);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadDReps();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [currentPage, searchQuery, statusFilter, sortBy, sortDirection]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSortChange = (value: SortFilter) => {
    setSortBy(value);
    setCurrentPage(1);
  };

  const handleDirectionChange = (value: SortDirection) => {
    setSortDirection(value);
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-foreground mb-2">DReps Directory</h1>
        <p className="text-muted-foreground">
          Explore and connect with Delegated Representatives (DReps) in the Cardano ecosystem
        </p>
      </div>

      {loadingAllDReps && allDReps.length === 0 ? (
        <div className="mb-8 text-center text-muted-foreground">Loading statistics...</div>
      ) : (
        <DRepsSummaryStats dreps={allDReps.length > 0 ? allDReps : dreps} activeDRepsCount={activeDRepsCount} />
      )}

      <DRepList
        dreps={dreps}
        currentPage={currentPage}
        hasMore={hasMore}
        onPageChange={setCurrentPage}
        loading={loading && dreps.length === 0}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusChange={handleStatusChange}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        sortDirection={sortDirection}
        onSortDirectionChange={handleDirectionChange}
        totalCount={totalCount}
        itemsPerPage={ITEMS_PER_PAGE}
      />
    </div>
  );
}

export const __drepMetadataUtils = {
  sanitizeMetadataValue,
  getMetadataName,
  getMetadataDescription,
  getMetadataWebsite,
};

