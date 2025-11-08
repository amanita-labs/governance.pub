'use client';

import DRepCard from './DRepCard';
import { DRepCardSkeleton } from '../ui/CardSkeleton';
import { Button } from '../ui/Button';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import type { DRep } from '@/types/governance';
import { cn } from '@/lib/utils';

type StatusFilter = 'All' | 'Active' | 'Inactive' | 'Retired' | 'Script';
type SortFilter = 'Activity' | 'VotingPower' | 'Name' | 'Registration';
type SortDirection = 'Descending' | 'Ascending';

const statusOptions: StatusFilter[] = ['All', 'Active', 'Inactive', 'Retired', 'Script'];
const sortOptions: SortFilter[] = ['VotingPower', 'Activity', 'Registration', 'Name'];
const directionOptions: SortDirection[] = ['Descending', 'Ascending'];

const isStatusFilter = (value: string): value is StatusFilter =>
  statusOptions.includes(value as StatusFilter);
const isSortFilter = (value: string): value is SortFilter => sortOptions.includes(value as SortFilter);
const isDirection = (value: string): value is SortDirection =>
  directionOptions.includes(value as SortDirection);

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
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <input
            type="text"
            placeholder="Search DReps..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className={cn(
              'w-full pl-10 pr-4 py-2 border border-input rounded-md',
              'bg-background text-foreground',
              'focus:ring-2 focus:ring-ring focus:border-transparent',
              'placeholder:text-muted-foreground'
            )}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (isStatusFilter(value)) {
                onStatusChange(value);
              }
            }}
            className={cn(
              'px-3 py-2 border border-input rounded-md text-sm',
              'bg-background text-foreground',
              'focus:ring-2 focus:ring-ring focus:border-transparent'
            )}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === 'All' ? 'All Status' : status === 'Script' ? 'Script-based' : status}
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
              'px-3 py-2 border border-input rounded-md text-sm',
              'bg-background text-foreground',
              'focus:ring-2 focus:ring-ring focus:border-transparent'
            )}
          >
            <option value="VotingPower">Sort by Voting Power</option>
            <option value="Activity">Sort by Activity</option>
            <option value="Registration">Sort by Registration</option>
            <option value="Name">Sort by Name</option>
          </select>

          <select
            value={sortDirection}
            onChange={(event) => {
              const value = event.target.value;
              if (isDirection(value)) {
                onSortDirectionChange(value);
              }
            }}
            className={cn(
              'px-3 py-2 border border-input rounded-md text-sm',
              'bg-background text-foreground',
              'focus:ring-2 focus:ring-ring focus:border-transparent'
            )}
          >
            {directionOptions.map((direction) => (
              <option key={direction} value={direction}>
                {direction}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => <DRepCardSkeleton key={index} />)
        ) : dreps.length > 0 ? (
          dreps.map((drep) => <DRepCard key={drep.drep_id} drep={drep} />)
        ) : (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No DReps found matching your criteria
          </div>
        )}
      </div>

      {onPageChange && (
        <div className="mt-8 flex flex-col items-center gap-4">
          {totalPages && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
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
              <ChevronLeft className="w-4 h-4" />
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
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

