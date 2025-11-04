'use client';

import { useMemo } from 'react';
import type { GovernanceAction } from '@/types/governance';

interface GovernanceHeatmapProps {
  actions: GovernanceAction[];
}

export function GovernanceHeatmap({ actions }: GovernanceHeatmapProps) {
  const heatmapData = useMemo(() => {
    // Group actions by epoch
    const byEpoch: Record<number, number> = {};
    
    actions.forEach((action) => {
      const epoch = action.voting_epoch || action.enactment_epoch || 0;
      byEpoch[epoch] = (byEpoch[epoch] || 0) + 1;
    });

    // Get min and max epochs
    const epochs = Object.keys(byEpoch).map(Number).sort((a, b) => a - b);
    const minEpoch = Math.min(...epochs, 0);
    const maxEpoch = Math.max(...epochs, 0);
    const maxCount = Math.max(...Object.values(byEpoch), 1);

    // Create data for visualization
    const data: { epoch: number; count: number; intensity: number }[] = [];
    for (let epoch = minEpoch; epoch <= maxEpoch; epoch++) {
      const count = byEpoch[epoch] || 0;
      data.push({
        epoch,
        count,
        intensity: count / maxCount,
      });
    }

    return data;
  }, [actions]);

  if (heatmapData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No data available for heatmap
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">Governance Activity by Epoch</h3>
      <div className="grid grid-cols-12 gap-1">
        {heatmapData.slice(-36).map((item, index) => (
          <div
            key={index}
            className="aspect-square rounded-sm flex items-center justify-center text-xs"
            style={{
              backgroundColor: `rgba(124, 179, 66, ${item.intensity})`,
              opacity: item.count > 0 ? 1 : 0.3,
            }}
            title={`Epoch ${item.epoch}: ${item.count} action(s)`}
          >
            {item.count > 0 && (
              <span className="text-white font-semibold">{item.count}</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>Less activity</span>
        <span>More activity</span>
      </div>
    </div>
  );
}

