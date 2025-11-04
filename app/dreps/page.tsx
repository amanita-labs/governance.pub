'use client';

import { useState, useEffect } from 'react';
import DRepList from '@/components/features/DRepList';
import { DRepsSummaryStats } from '@/components/features/DRepsSummaryStats';
import type { DRep } from '@/types/governance';

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
  const [dreps, setDReps] = useState<DRep[]>([]);
  const [allDReps, setAllDReps] = useState<DRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAllDReps, setLoadingAllDReps] = useState(false);
  const [activeDRepsCount, setActiveDRepsCount] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const itemsPerPage = 20;

  useEffect(() => {
    async function loadDReps() {
      setLoading(true);
      try {
        // Enable enrichment for first page to get vote counts and other stats
        const enrichParam = currentPage === 1 ? '&enrich=true' : '';
        const response = await fetch(`/api/dreps?page=${currentPage}&count=${itemsPerPage}${enrichParam}`);
        if (response.ok) {
          const data = await response.json();
          setDReps(data.dreps);
          setHasMore(data.hasMore);
          
          // For the voting power chart and stats, load a sample of DReps on first page
          if (currentPage === 1) {
            // Fetch first 100 DReps for summary statistics (much faster than fetching all)
            // This is done in the background so it doesn't block the initial render
            setLoadingAllDReps(true);
            Promise.all([
              fetchDRepsForStats(), // Only fetch first 100 DReps
              fetch('/api/dreps/stats').then(res => res.json()).then(data => data.activeDRepsCount).catch(() => null), // Fetch active DReps count from Koios via API route
            ])
              .then(([drepSample, activeCount]) => {
                console.log(`Loaded ${drepSample.length} DReps for stats`);
                setAllDReps(drepSample);
                setActiveDRepsCount(activeCount);
                setLoadingAllDReps(false);
              })
              .catch((error) => {
                console.error('Error fetching DReps for stats:', error);
                // If fetching fails, use the paginated data as fallback
                setAllDReps(data.dreps);
                setLoadingAllDReps(false);
              });
          }
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

