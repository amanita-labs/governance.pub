'use client';

import { useState, useEffect } from 'react';
import DelegateForm from '@/components/features/DelegateForm';
import type { DRep } from '@/types/governance';

export default function DelegatePage() {
  const [dreps, setDReps] = useState<DRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const itemsPerPage = 50; // Load more for the selection dropdown

  useEffect(() => {
    async function loadDReps() {
      setLoading(true);
      try {
        const response = await fetch(`/api/dreps?page=${currentPage}&count=${itemsPerPage}`);
        if (response.ok) {
          const data = await response.json();
          if (currentPage === 1) {
            setDReps(data.dreps);
          } else {
            setDReps(prev => [...prev, ...data.dreps]);
          }
          setHasMore(data.hasMore);
        } else {
          console.error('Failed to fetch DReps');
        }
      } catch (error) {
        console.error('Error loading DReps:', error);
      } finally {
        setLoading(false);
      }
    }
    loadDReps();
  }, [currentPage]);

  const loadMore = () => {
    if (hasMore && !loading) {
      setCurrentPage(prev => prev + 1);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-display font-bold mb-8">Delegate Voting Rights</h1>
      {loading && dreps.length === 0 ? (
        <div className="text-center py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-muted-foreground">Loading DReps...</p>
        </div>
      ) : (
        <DelegateForm 
          dreps={dreps} 
          hasMore={hasMore}
          onLoadMore={hasMore ? loadMore : undefined}
          loading={loading}
        />
      )}
    </div>
  );
}

