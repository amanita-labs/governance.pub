'use client';

import { useState, useEffect } from 'react';
import ActionList from '@/components/features/ActionList';
import { Badge } from '@/components/ui/Badge';
import { Loader2 } from 'lucide-react';
import type { GovernanceAction } from '@/types/governance';

export default function ActionsPage() {
  const [actions, setActions] = useState<GovernanceAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const itemsPerPage = 20;

  useEffect(() => {
    async function loadActions() {
      setLoading(true);
      const isFirstPage = currentPage === 1;
      const shouldEnrich = isFirstPage;
      
      if (shouldEnrich) {
        setLoadingMetadata(true);
      }
      
      try {
        // Enable enrichment for first page to get metadata
        const enrichParam = shouldEnrich ? '&enrich=true' : '';
        const response = await fetch(`/api/actions?page=${currentPage}&count=${itemsPerPage}${enrichParam}`);
        if (response.ok) {
          const data = await response.json();
          setActions(data.actions);
          setHasMore(data.hasMore);
          setLoadingMetadata(false);
        } else {
          console.error('Failed to fetch actions');
          setLoadingMetadata(false);
        }
      } catch (error) {
        console.error('Error loading actions:', error);
        setLoadingMetadata(false);
      } finally {
        setLoading(false);
      }
    }
    loadActions();
  }, [currentPage]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-display font-bold text-foreground">Governance Actions</h1>
          {loadingMetadata && (
            <Badge variant="info" className="flex items-center gap-2" aria-label="Loading metadata">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              <span>Loading metadata...</span>
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Explore and review governance proposals and actions in the Cardano ecosystem
        </p>
      </div>

      {/* Action List */}
      <ActionList 
        actions={actions} 
        loading={loading && currentPage === 1}
      />
      
      {/* Pagination */}
      {!loading && (hasMore || currentPage > 1) && (
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-input rounded-md bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Go to previous page"
            aria-disabled={currentPage === 1}
          >
            Previous
          </button>
          <span className="px-4 py-2 text-foreground" aria-label={`Current page: ${currentPage}`}>
            Page {currentPage}
          </span>
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={!hasMore}
            className="px-4 py-2 border border-input rounded-md bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Go to next page"
            aria-disabled={!hasMore}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

