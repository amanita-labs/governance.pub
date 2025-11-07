'use client';

import { useState, useMemo } from 'react';
import DRepCard from './DRepCard';
import { DRepCardSkeleton } from '../ui/CardSkeleton';
import { Button } from '../ui/Button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DRep } from '@/types/governance';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'active' | 'inactive' | 'retired';
type QuickFilter = 'all' | 'has_profile' | 'recently_active' | 'popular';
type SortFilter = 'power' | 'name' | 'delegators' | 'votes' | 'recent';

const statusOptions: StatusFilter[] = ['all', 'active', 'inactive', 'retired'];
const quickFilterOptions: QuickFilter[] = ['all', 'has_profile', 'recently_active', 'popular'];
const sortOptions: SortFilter[] = ['power', 'name', 'delegators', 'votes', 'recent'];

const isStatusFilter = (value: string): value is StatusFilter => statusOptions.includes(value as StatusFilter);
const isQuickFilter = (value: string): value is QuickFilter => quickFilterOptions.includes(value as QuickFilter);
const isSortFilter = (value: string): value is SortFilter => sortOptions.includes(value as SortFilter);

interface DRepListProps {
  dreps: DRep[];
  currentPage?: number;
  hasMore?: boolean;
  onPageChange?: (page: number) => void;
  loading?: boolean;
}

export default function DRepList({ 
  dreps, 
  currentPage = 1, 
  hasMore = false, 
  onPageChange,
  loading = false 
}: DRepListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortBy, setSortBy] = useState<SortFilter>('power');

  const filteredAndSorted = useMemo(() => {
    let filtered = dreps.filter((drep) => {
      // Search in name (from metadata), title, view, description, and drep_id
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        (drep.metadata?.name || '').toLowerCase().includes(searchLower) ||
        (drep.metadata?.title || '').toLowerCase().includes(searchLower) ||
        (drep.metadata?.description || '').toLowerCase().includes(searchLower) ||
        (drep.view || '').toLowerCase().includes(searchLower) ||
        drep.drep_id.toLowerCase().includes(searchLower);
      
      // Match status using both status field and active/retired fields
      let matchesStatus = true;
      if (statusFilter !== 'all') {
        if (drep.status) {
          matchesStatus = drep.status === statusFilter;
        } else {
          // Determine status from active/retired fields
          if (statusFilter === 'active') {
            matchesStatus = drep.active === true && !drep.retired;
          } else if (statusFilter === 'inactive') {
            matchesStatus = drep.active === false && !drep.retired;
          } else if (statusFilter === 'retired') {
            matchesStatus = drep.retired === true;
          }
        }
      }
      
      // Quick filters
      let matchesQuickFilter = true;
      if (quickFilter === 'has_profile') {
        matchesQuickFilter = !!(drep.metadata?.name || drep.metadata?.description || drep.metadata?.website);
      } else if (quickFilter === 'recently_active') {
        // Recently active = has voted in last 10 epochs (or has last_vote_epoch)
        matchesQuickFilter = drep.last_vote_epoch !== undefined && drep.last_vote_epoch > 0;
      } else if (quickFilter === 'popular') {
        // Popular = has 100+ delegators or high vote count
        matchesQuickFilter = !!(drep.delegator_count && drep.delegator_count >= 100) || 
                             !!(drep.vote_count && drep.vote_count >= 5);
      }
      
      return matchesSearch && matchesStatus && matchesQuickFilter;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'power') {
        // Use amount field if available (from DRep endpoint), otherwise fallback
        const powerA = BigInt(a.amount || a.voting_power_active || a.voting_power || '0');
        const powerB = BigInt(b.amount || b.voting_power_active || b.voting_power || '0');
        return powerB > powerA ? 1 : powerB < powerA ? -1 : 0;
      } else if (sortBy === 'name') {
        // Use name from metadata (priority: metadata.name > metadata.title > view)
        const nameA = (a.metadata?.name || a.metadata?.title || a.view || '').toLowerCase();
        const nameB = (b.metadata?.name || b.metadata?.title || b.view || '').toLowerCase();
        return nameA.localeCompare(nameB);
      } else if (sortBy === 'delegators') {
        const delegatorsA = a.delegator_count || 0;
        const delegatorsB = b.delegator_count || 0;
        return delegatorsB - delegatorsA;
      } else if (sortBy === 'votes') {
        const votesA = a.vote_count || 0;
        const votesB = b.vote_count || 0;
        return votesB - votesA;
      } else if (sortBy === 'recent') {
        // Use last_active_epoch if available, otherwise last_vote_epoch
        const epochA = a.last_active_epoch || a.last_vote_epoch || 0;
        const epochB = b.last_active_epoch || b.last_vote_epoch || 0;
        return epochB - epochA;
      }
      return 0;
    });

    return filtered;
  }, [dreps, searchQuery, statusFilter, quickFilter, sortBy]);

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <input
            type="text"
            placeholder="Search DReps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-10 pr-4 py-2 border border-input rounded-md",
              "bg-background text-foreground",
              "focus:ring-2 focus:ring-ring focus:border-transparent",
              "placeholder:text-muted-foreground"
            )}
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (isStatusFilter(value)) {
                setStatusFilter(value);
              }
            }}
            className={cn(
              "px-3 py-2 border border-input rounded-md text-sm",
              "bg-background text-foreground",
              "focus:ring-2 focus:ring-ring focus:border-transparent"
            )}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="retired">Retired</option>
          </select>
          
          <select
            value={quickFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (isQuickFilter(value)) {
                setQuickFilter(value);
              }
            }}
            className={cn(
              "px-3 py-2 border border-input rounded-md text-sm",
              "bg-background text-foreground",
              "focus:ring-2 focus:ring-ring focus:border-transparent"
            )}
          >
            <option value="all">All DReps</option>
            <option value="has_profile">Has Profile</option>
            <option value="recently_active">Recently Active</option>
            <option value="popular">Popular</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(event) => {
              const value = event.target.value;
              if (isSortFilter(value)) {
                setSortBy(value);
              }
            }}
            className={cn(
              "px-3 py-2 border border-input rounded-md text-sm",
              "bg-background text-foreground",
              "focus:ring-2 focus:ring-ring focus:border-transparent"
            )}
          >
            <option value="power">Sort by Power</option>
            <option value="name">Sort by Name</option>
            <option value="delegators">Sort by Delegators</option>
            <option value="votes">Sort by Votes</option>
            <option value="recent">Sort by Recent</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          // Show skeletons while loading
          Array.from({ length: 6 }).map((_, i) => (
            <DRepCardSkeleton key={i} />
          ))
        ) : filteredAndSorted.length > 0 ? (
          filteredAndSorted.map((drep) => (
            <DRepCard key={drep.drep_id} drep={drep} />
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No DReps found matching your criteria
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {onPageChange && (
        <div className="mt-8 flex items-center justify-center space-x-4">
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
      )}

    </div>
  );
}

