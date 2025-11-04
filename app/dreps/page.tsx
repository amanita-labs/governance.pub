'use client';

import { useState, useEffect } from 'react';
import DRepList from '@/components/features/DRepList';
import { DRepsSummaryStats } from '@/components/features/DRepsSummaryStats';
import type { DRep } from '@/types/governance';

// Helper function to fetch all DReps for summary statistics
async function fetchAllDRepsForStats(): Promise<DRep[]> {
  try {
    let allDReps: DRep[] = [];
    let page = 1;
    let hasMore = true;
    
    // Fetch all pages of DReps
    while (hasMore) {
      const response = await fetch(`/api/dreps?page=${page}&count=100`);
      if (!response.ok) break;
      
      const data = await response.json();
      if (data.dreps && data.dreps.length > 0) {
        allDReps = [...allDReps, ...data.dreps];
        hasMore = data.hasMore && data.dreps.length === 100;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    return allDReps;
  } catch (error) {
    console.error('Error fetching all DReps for stats:', error);
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
          
          // For the voting power chart and stats, load all DReps on first page
          if (currentPage === 1) {
            // Fetch all DReps for accurate summary statistics
            // This is done in the background so it doesn't block the initial render
            setLoadingAllDReps(true);
            Promise.all([
              fetchAllDRepsForStats(),
              fetch('/api/dreps/stats').then(res => res.json()).then(data => data.activeDRepsCount).catch(() => null), // Fetch active DReps count from Koios via API route
            ])
              .then(([allDReps, activeCount]) => {
                console.log(`Loaded ${allDReps.length} total DReps for stats`);
                setAllDReps(allDReps);
                setActiveDRepsCount(activeCount);
                setLoadingAllDReps(false);
              })
              .catch((error) => {
                console.error('Error fetching all DReps:', error);
                // If fetching all DReps fails, use the paginated data as fallback
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

