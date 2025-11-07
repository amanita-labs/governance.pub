'use client';

import { useState, useMemo } from 'react';
import ActionCard from './ActionCard';
import { ActionCardSkeleton } from '../ui/CardSkeleton';
import { Search } from 'lucide-react';
import type { GovernanceAction } from '@/types/governance';
import { cn } from '@/lib/utils';

interface ActionListProps {
  actions: GovernanceAction[];
  loading?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

type SortOption = 'newest' | 'oldest' | 'type' | 'status' | 'has_metadata';

/**
 * Extract string from value (handles both string and object formats)
 */
function extractString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (isRecord(value)) {
    const candidates: Array<unknown> = [value.content, value.text, value.value, value.description, value.label];
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        return candidate;
      }
    }
  }
  return '';
}

/**
 * Get metadata title/description from action for search
 */
function getMetadataText(action: GovernanceAction): string {
  let title = '';
  let description = '';
  
  // Try meta_json first
  if (action.meta_json) {
    try {
      const parsed: unknown =
        typeof action.meta_json === 'string'
          ? JSON.parse(action.meta_json)
          : action.meta_json;

      if (isRecord(parsed)) {
        title = extractString(parsed.title);
        description = extractString(parsed.description);
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  // Try metadata field if not found
  if (!title && !description && action.metadata) {
    title = extractString(action.metadata.title);
    description = extractString(action.metadata.description);
  }
  
  // Fallback to description
  if (!title && !description) {
    description = action.description || '';
  }
  
  return `${title} ${description}`.toLowerCase();
}

export default function ActionList({ actions, loading = false }: ActionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [hasMetadataFilter, setHasMetadataFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const filteredAndSorted = useMemo(() => {
    // Filter actions
    let filtered = actions.filter((action) => {
      // Search in metadata, description, and action_id
      const searchText = getMetadataText(action);
      const matchesSearch = 
        searchText.includes(searchQuery.toLowerCase()) ||
        action.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        action.action_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || action.status === statusFilter;
      const matchesType = typeFilter === 'all' || action.type === typeFilter;
      
      // Filter by metadata availability
      const hasMetadata = !!(action.meta_json || action.metadata);
      const matchesMetadata = 
        hasMetadataFilter === 'all' || 
        (hasMetadataFilter === 'yes' && hasMetadata) ||
        (hasMetadataFilter === 'no' && !hasMetadata);
      
      return matchesSearch && matchesStatus && matchesType && matchesMetadata;
    });

    // Sort actions
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest': {
          const aTime = a.block_time || (a.proposed_epoch || 0) * 1_000_000;
          const bTime = b.block_time || (b.proposed_epoch || 0) * 1_000_000;
          return bTime - aTime;
        }

        case 'oldest': {
          const aTimeOld = a.block_time || (a.proposed_epoch || 0) * 1_000_000;
          const bTimeOld = b.block_time || (b.proposed_epoch || 0) * 1_000_000;
          return aTimeOld - bTimeOld;
        }

        case 'type': {
          return a.type.localeCompare(b.type);
        }

        case 'status': {
          return (a.status || '').localeCompare(b.status || '');
        }

        case 'has_metadata': {
          const aHasMeta = !!(a.meta_json || a.metadata);
          const bHasMeta = !!(b.meta_json || b.metadata);
          if (aHasMeta === bHasMeta) {
            return 0;
          }
          return aHasMeta ? -1 : 1;
        }

        default: {
          return 0;
        }
      }
    });

    return filtered;
  }, [actions, searchQuery, statusFilter, typeFilter, hasMetadataFilter, sortBy]);

  const statuses = ['all', 'submitted', 'voting', 'ratified', 'enacted', 'expired', 'rejected', 'dropped'];
  const types = ['all', 'parameter_change', 'hard_fork_initiation', 'treasury_withdrawals', 'no_confidence', 'update_committee', 'new_committee', 'new_constitution', 'info'];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Search actions by title, description, or ID..."
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
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn(
                "px-4 py-2 border border-input rounded-md",
                "bg-background text-foreground",
                "focus:ring-2 focus:ring-ring focus:border-transparent"
              )}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={cn(
                "px-4 py-2 border border-input rounded-md",
                "bg-background text-foreground",
                "focus:ring-2 focus:ring-ring focus:border-transparent"
              )}
            >
              {types.map((type) => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>

            <select
              value={hasMetadataFilter}
              onChange={(e) => setHasMetadataFilter(e.target.value)}
              className={cn(
                "px-4 py-2 border border-input rounded-md",
                "bg-background text-foreground",
                "focus:ring-2 focus:ring-ring focus:border-transparent"
              )}
            >
              <option value="all">All Metadata</option>
              <option value="yes">Has Metadata</option>
              <option value="no">No Metadata</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className={cn(
                "px-4 py-2 border border-input rounded-md",
                "bg-background text-foreground",
                "focus:ring-2 focus:ring-ring focus:border-transparent",
                "flex items-center gap-2"
              )}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="type">Sort: By Type</option>
              <option value="status">Sort: By Status</option>
              <option value="has_metadata">Sort: Has Metadata</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        {!loading && (
          <div className="text-sm text-muted-foreground">
            Showing {filteredAndSorted.length} of {actions.length} actions
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          // Show skeletons while loading
          Array.from({ length: 6 }).map((_, i) => (
            <ActionCardSkeleton key={i} />
          ))
        ) : filteredAndSorted.length > 0 ? (
          filteredAndSorted.map((action) => (
            <ActionCard key={action.action_id} action={action} />
          ))
        ) : (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No actions found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
}

