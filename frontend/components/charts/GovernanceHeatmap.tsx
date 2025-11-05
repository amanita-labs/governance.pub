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
      const epoch = action.voting_epoch || action.enactment_epoch || action.proposed_epoch || 0;
      if (epoch > 0) {
        byEpoch[epoch] = (byEpoch[epoch] || 0) + 1;
      }
    });

    // Get all epochs and sort
    const epochs = Object.keys(byEpoch).map(Number).sort((a, b) => a - b);
    if (epochs.length === 0) {
      return [];
    }

    // Get the last 30 epochs (or fewer if we don't have 30)
    const maxEpoch = Math.max(...epochs);
    const minEpoch = Math.max(maxEpoch - 29, Math.min(...epochs));
    const maxCount = Math.max(...Object.values(byEpoch), 1);

    // Create data for visualization (last 30 epochs)
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
      <h3 className="text-lg font-semibold mb-4">Governance Activity by Epoch (Last 30 Epochs)</h3>
      <div className="grid grid-cols-10 gap-1">
        {heatmapData.map((item, index) => (
          <div
            key={index}
            className="aspect-square rounded-sm flex items-center justify-center text-xs bg-field-green transition-opacity"
            style={{
              opacity: item.count > 0 ? Math.max(0.3, item.intensity) : 0.1,
            } as React.CSSProperties}
            title={`Epoch ${item.epoch}: ${item.count} action(s)`}
            aria-label={`Epoch ${item.epoch}: ${item.count} action(s)`}
            role="img"
          >
            {item.count > 0 && (
              <span className="text-white font-semibold dark:text-foreground">{item.count}</span>
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

