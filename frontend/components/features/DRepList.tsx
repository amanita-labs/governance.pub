'use client';

import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import DRepCard from './DRepCard';
import { DRepCardSkeleton } from '../ui/CardSkeleton';
import { Button } from '../ui/Button';
import type { DRep } from '@/types/governance';
import { cn } from '@/lib/utils';

type StatusFilter = 'All' | 'Active' | 'Inactive' | 'Retired' | 'Script';
type SortFilter = 'Activity' | 'VotingPower' | 'Name' | 'Registration';
type SortDirection = 'Descending' | 'Ascending';

type StatusOption = {
  value: StatusFilter;
  label: string;
};

type SortOption = {
  value: SortFilter;
  label: string;
};

type DirectionOption = {
  value: SortDirection;
  label: string;
};

const statusOptions: StatusOption[] = [
  { value: 'All', label: 'All Status' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'Retired', label: 'Retired' },
  { value: 'Script', label: 'Script-based' },
];

const sortOptions: SortOption[] = [
  { value: 'VotingPower', label: 'Sort by Voting Power' },
  { value: 'Activity', label: 'Sort by Recent Activity' },
  { value: 'Registration', label: 'Sort by Registration' },
  { value: 'Name', label: 'Sort by Name' },
];

const directionOptions: DirectionOption[] = [
  { value: 'Descending', label: 'Descending' },
  { value: 'Ascending', label: 'Ascending' },
];

const isStatusFilter = (value: string): value is StatusFilter =>
  statusOptions.some((option) => option.value === value);

const isSortFilter = (value: string): value is SortFilter =>
  sortOptions.some((option) => option.value === value);

const isSortDirection = (value: string): value is SortDirection =>
  directionOptions.some((option) => option.value === value);

interface DRepListProps {
  dreps: DRep[];
  currentPage?: number;
  hasMore?: boolean;
  onPageChange?: (page: number) => void;
  loading?: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  sortBy: SortFilter;
  onSortChange: (value: SortFilter) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (value: SortDirection) => void;
  totalCount?: number | null;
  itemsPerPage?: number;
}

export default function DRepList({
  dreps,
  currentPage = 1,
  hasMore = false,
  onPageChange,
  loading = false,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  sortDirection,
  onSortDirectionChange,
  totalCount,
  itemsPerPage = 20,
}: DRepListProps) {
  const totalPages =
    typeof totalCount === 'number' && itemsPerPage
      ? Math.max(1, Math.ceil(totalCount / itemsPerPage))
      : null;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search the flock for a DRep..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className={cn(
              'w-full rounded-md border border-input bg-background py-2 pl-10 pr-4',
              'text-foreground placeholder:text-muted-foreground',
              'focus:border-transparent focus:ring-2 focus:ring-ring'
            )}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <select
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (isStatusFilter(value)) {
                onStatusChange(value);
              }
            }}
            className={cn(
              'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
              'focus:border-transparent focus:ring-2 focus:ring-ring'
            )}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(event) => {
              const value = event.target.value;
              if (isSortFilter(value)) {
                onSortChange(value);
              }
            }}
            className={cn(
              'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
              'focus:border-transparent focus:ring-2 focus:ring-ring'
            )}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={sortDirection}
            onChange={(event) => {
              const value = event.target.value;
              if (isSortDirection(value)) {
                onSortDirectionChange(value);
              }
            }}
            className={cn(
              'rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground',
              'focus:border-transparent focus:ring-2 focus:ring-ring'
            )}
          >
            {directionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true">🧶</span>
        <span>Need a guide? These filters help herd similar DReps together.</span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => <DRepCardSkeleton key={index} />)
        ) : dreps.length > 0 ? (
          dreps.map((drep) => <DRepCard key={drep.drep_id} drep={drep} />)
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No DReps found in this part of the pasture — try another filter!
          </div>
        )}
      </div>

      {onPageChange && (
        <div className="mt-8 flex flex-col items-center gap-4">
          {totalPages && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpDown className="h-4 w-4" />
              <span>
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )}

          <div className="flex items-center justify-center space-x-4">
            <Button
              variant="outline"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || loading}
              className="flex items-center space-x-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>

            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">Page</span>
              <span className="font-semibold">{currentPage}</span>
            </div>

            <Button
              variant="outline"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!hasMore || loading}
              className="flex items-center space-x-2"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
