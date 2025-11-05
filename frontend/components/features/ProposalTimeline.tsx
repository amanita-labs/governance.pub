'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Clock, CheckCircle, XCircle, Calendar } from 'lucide-react';
import type { GovernanceAction } from '@/types/governance';
import { cn } from '@/lib/utils';

interface ProposalTimelineProps {
  action: GovernanceAction;
}

interface TimelineEvent {
  label: string;
  epoch: number | undefined;
  status: 'completed' | 'pending' | 'current' | 'failed';
  icon: React.ReactNode;
}

export function ProposalTimeline({ action }: ProposalTimelineProps) {
  const events: TimelineEvent[] = [];

  // Proposed
  if (action.proposed_epoch || action.voting_epoch) {
    const epoch = action.proposed_epoch || action.voting_epoch;
    events.push({
      label: 'Proposed',
      epoch,
      status: 'completed',
      icon: <Calendar className="w-4 h-4" />,
    });
  }

  // Ratified
  if (action.ratified_epoch) {
    events.push({
      label: 'Ratified',
      epoch: action.ratified_epoch,
      status: 'completed',
      icon: <CheckCircle className="w-4 h-4" />,
    });
  } else if (action.status === 'ratified') {
    // Status is ratified but no epoch yet
    events.push({
      label: 'Ratified',
      epoch: undefined,
      status: 'current',
      icon: <CheckCircle className="w-4 h-4" />,
    });
  }

  // Enacted
  if (action.enactment_epoch) {
    events.push({
      label: 'Enacted',
      epoch: action.enactment_epoch,
      status: 'completed',
      icon: <CheckCircle className="w-4 h-4" />,
    });
  } else if (action.status === 'enacted') {
    events.push({
      label: 'Enacted',
      epoch: undefined,
      status: 'completed',
      icon: <CheckCircle className="w-4 h-4" />,
    });
  }

  // Expired/Dropped
  if (action.dropped_epoch || action.expiry_epoch) {
    events.push({
      label: action.dropped_epoch ? 'Dropped' : 'Expired',
      epoch: action.dropped_epoch || action.expiry_epoch,
      status: 'failed',
      icon: <XCircle className="w-4 h-4" />,
    });
  } else if (action.status === 'expired' || action.status === 'dropped') {
    events.push({
      label: action.status === 'expired' ? 'Expired' : 'Dropped',
      epoch: undefined,
      status: 'failed',
      icon: <XCircle className="w-4 h-4" />,
    });
  }

  // Expiration (if not expired yet)
  if (action.expiration && action.status !== 'expired' && action.status !== 'dropped') {
    events.push({
      label: 'Expires',
      epoch: action.expiration,
      status: 'pending',
      icon: <Clock className="w-4 h-4" />,
    });
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposal Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />

          {/* Timeline events */}
          <div className="space-y-6">
            {events.map((event, index) => (
              <div key={index} className="relative flex items-start gap-4">
                {/* Icon */}
                <div
                  className={cn(
                    'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2',
                    {
                      'bg-green-500 border-green-500 text-white': event.status === 'completed',
                      'bg-blue-500 border-blue-500 text-white': event.status === 'current',
                      'bg-yellow-500 border-yellow-500 text-white': event.status === 'pending',
                      'bg-red-500 border-red-500 text-white': event.status === 'failed',
                      'bg-muted border-border text-muted-foreground': !event.status,
                    }
                  )}
                >
                  {event.icon}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground">{event.label}</span>
                    {event.epoch && (
                      <span className="text-sm text-muted-foreground">Epoch {event.epoch}</span>
                    )}
                  </div>
                  {event.status === 'current' && (
                    <span className="text-xs text-blue-500 font-medium">In Progress</span>
                  )}
                  {event.status === 'pending' && (
                    <span className="text-xs text-yellow-500 font-medium">Upcoming</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

