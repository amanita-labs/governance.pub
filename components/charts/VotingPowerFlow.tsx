'use client';

import { memo, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { DRep } from '@/types/governance';

interface VotingPowerFlowProps {
  dreps: DRep[];
}

function VotingPowerFlow({ dreps }: VotingPowerFlowProps) {
  const chartData = useMemo(() => {
    if (!dreps || dreps.length === 0) {
      return [];
    }

    // Sort DReps by voting power and take top 10
    // Include DReps with 0 power too, but show them at the bottom
    const sorted = [...dreps]
      .sort((a, b) => {
        // Use amount field if available (from DRep endpoint), otherwise fallback
        const powerA = BigInt(a.amount || a.voting_power_active || a.voting_power || '0');
        const powerB = BigInt(b.amount || b.voting_power_active || b.voting_power || '0');
        return powerB > powerA ? 1 : powerB < powerA ? -1 : 0;
      })
      .slice(0, 10);

    return sorted.map((drep) => {
      // Use amount field if available (from DRep endpoint), otherwise fallback
      const power = BigInt(drep.amount || drep.voting_power_active || drep.voting_power || '0');
      const ada = Number(power) / 1_000_000;
      
      // Use name from metadata (priority: metadata.name > metadata.title > view > drep_id)
      const drepName = drep.metadata?.name || 
                       drep.metadata?.title || 
                       drep.view || 
                       drep.drep_id.slice(0, 8);
      
      return {
        name: drepName.substring(0, 20),
        power: Math.max(0, ada), // Ensure non-negative
        powerM: Math.max(0, ada / 1_000_000),
      };
    });
  }, [dreps]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground border border-dashed rounded-lg">
        <div className="text-center">
          <p className="text-sm">No DReps available to display</p>
          <p className="text-xs text-muted-foreground mt-1">Try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">Top DReps by Voting Power</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis />
          <Tooltip 
            formatter={(value: number) => {
              if (value >= 1_000_000) {
                return `${(value / 1_000_000).toFixed(2)}M ADA`;
              }
              if (value >= 1_000) {
                return `${(value / 1_000).toFixed(2)}K ADA`;
              }
              return `${value.toFixed(2)} ADA`;
            }}
          />
          <Legend />
          <Bar dataKey="power" fill="#7cb342" name="Voting Power (ADA)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const VotingPowerFlowMemo = memo(VotingPowerFlow);
export { VotingPowerFlowMemo as VotingPowerFlow };

