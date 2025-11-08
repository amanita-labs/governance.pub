'use client';

import { useEffect, useState } from 'react';
import DRepList from '@/components/features/DRepList';
import { DRepsSummaryStats } from '@/components/features/DRepsSummaryStats';
import type { DRep } from '@/types/governance';

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
          setDReps(pageDReps);
          setHasMore(pageHasMore);
          setTotalCount(total);

          if (currentPage === 1) {
            setAllDReps(pageDReps);
            setLoadingAllDReps(true);

            const statsQuery: QueryState = {
              ...queryState,
              page: 1,
              pageSize: 100,
            };

            Promise.all([fetchDRepsPage(statsQuery), fetchActiveDRepsCount()])
              .then(([sample, activeCount]) => {
                if (!isCancelled) {
                  setAllDReps(sample.dreps);
                  setActiveDRepsCount(activeCount);
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

