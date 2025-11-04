'use client';

import { useState, useEffect } from 'react';
import DRepList from '@/components/DRepList';
import { VotingPowerFlow } from '@/components/VotingPowerFlow';
import { DRepsSummaryStats } from '@/components/DRepsSummaryStats';
import { Card, CardContent } from '@/components/ui/Card';
import type { DRep } from '@/types/governance';

export default function DRepsPage() {
  const [dreps, setDReps] = useState<DRep[]>([]);
  const [allDReps, setAllDReps] = useState<DRep[]>([]);
  const [loading, setLoading] = useState(true);
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
            // Try to load all DReps for stats (but limit to avoid performance issues)
            try {
              const allResponse = await fetch(`/api/dreps?page=1&count=100`);
              if (allResponse.ok) {
                const allData = await allResponse.json();
                setAllDReps(allData.dreps);
              } else {
                setAllDReps(data.dreps);
              }
            } catch {
              setAllDReps(data.dreps);
            }
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
      <DRepsSummaryStats dreps={allDReps.length > 0 ? allDReps : dreps} />

      {/* Voting Power Chart */}
      {(allDReps.length > 0 || dreps.length > 0) && (
        <Card className="mb-8">
          <CardContent className="p-6">
            <VotingPowerFlow dreps={allDReps.length > 0 ? allDReps : dreps} />
          </CardContent>
        </Card>
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

