'use client';

import { useMemo } from 'react';
import type { GovernanceAction } from '@/types/governance';
import { getActionDisplayType, getActionTitle } from '@/lib/governance';

interface ActionTimelineProps {
  actions: GovernanceAction[];
}

const formatType = (type: string): string =>
  type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export function ActionTimeline({ actions }: ActionTimelineProps) {
  const sortedActions = useMemo(() => {
    return [...actions].sort((a, b) => {
      const epochA = a.voting_epoch || a.enactment_epoch || a.proposed_epoch || 0;
      const epochB = b.voting_epoch || b.enactment_epoch || b.proposed_epoch || 0;
      return epochB - epochA;
    }).slice(0, 20);
  }, [actions]);

  if (sortedActions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No actions available for timeline
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">Recent Governance Actions Timeline</h3>
      <div className="space-y-4">
        {sortedActions.map((action) => {
          const status = action.status || 'submitted';
          const title = getActionTitle(action);
          const displayType = getActionDisplayType(action);
          const epoch = action.voting_epoch || action.enactment_epoch || action.proposed_epoch || 'N/A';
          
          return (
            <div key={action.action_id} className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-4 h-4 rounded-full bg-field-green mt-2"></div>
              <div className="flex-1 bg-card rounded-lg shadow p-4 border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-foreground line-clamp-1">{title}</h4>
                  <span className="text-xs text-muted-foreground">
                    Epoch {epoch}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{formatType(String(displayType))}</p>
                <span className={`inline-block px-2 py-1 rounded text-xs ${
                  status === 'enacted' ? 'bg-green-500/10 text-green-700 dark:text-green-400' :
                  status === 'voting' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' :
                  status === 'rejected' ? 'bg-red-500/10 text-red-700 dark:text-red-400' :
                  'bg-muted text-foreground'
                }`}>
                  {status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

