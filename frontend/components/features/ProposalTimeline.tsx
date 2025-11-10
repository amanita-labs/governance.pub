'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Clock, CheckCircle, XCircle, Calendar, PlayCircle } from 'lucide-react';
import type { GovernanceAction } from '@/types/governance';
import { cn } from '@/lib/utils';
import { formatEpochStartTime, getLocalTimezoneLabel } from '@/lib/utils/format';
import type { ReactNode } from 'react';

interface ProposalTimelineProps {
  action: GovernanceAction;
}

interface TimelineEvent {
  key: StageKey;
  label: string;
  epoch?: number;
  timestamp?: number;
  formattedTime?: string;
  status: 'completed' | 'pending' | 'current' | 'failed';
  icon: ReactNode;
  helper?: string;
}

type StageKey = 'proposed' | 'voting' | 'ratified' | 'enacted' | 'expires' | 'expired' | 'dropped';

const stageRank: Record<StageKey, number> = {
  proposed: 0,
  voting: 1,
  ratified: 2,
  enacted: 3,
  expires: 2,
  expired: 3,
  dropped: 3,
};

const helperByStatus: Record<TimelineEvent['status'], string | undefined> = {
  completed: undefined,
  current: 'In progress',
  pending: 'Upcoming',
  failed: 'Closed',
};

export function ProposalTimeline({ action }: ProposalTimelineProps) {
  const status = action.status ?? 'submitted';
  const timezoneLabel = getLocalTimezoneLabel();
  const currentStageRank = (() => {
    switch (status) {
      case 'submitted':
        return stageRank.proposed;
      case 'voting':
        return stageRank.voting;
      case 'ratified':
        return stageRank.ratified;
      case 'enacted':
        return stageRank.enacted;
      case 'expired':
      case 'dropped':
      case 'rejected':
        return stageRank.expired;
      default:
        return stageRank.proposed;
    }
  })();
  const isFailure = status === 'expired' || status === 'dropped' || status === 'rejected';
  const isRatified = status === 'ratified' || !!action.ratified_epoch || !!action.ratification_epoch;
  const isEnacted = status === 'enacted' || !!action.enactment_epoch;

  const resolveStageStatus = (stage: StageKey): TimelineEvent['status'] => {
    if (stage === 'expired' || stage === 'dropped') {
      if (isFailure) {
        return 'failed';
      }
      if (currentStageRank > stageRank[stage]) {
        return 'completed';
      }
      return 'pending';
    }

    if (currentStageRank > stageRank[stage]) {
      return 'completed';
    }

    if (currentStageRank === stageRank[stage]) {
      return isFailure ? 'failed' : 'current';
    }

    return 'pending';
  };

  const events: TimelineEvent[] = [];

  const addEvent = (stage: StageKey, event: Omit<TimelineEvent, 'key' | 'status' | 'formattedTime' | 'helper'>) => {
    const statusForStage = resolveStageStatus(stage);
    events.push({
      key: stage,
      status: statusForStage,
      helper: helperByStatus[statusForStage],
      formattedTime: event.timestamp ? formatEpochStartTime(event.timestamp) : undefined,
      ...event,
    });
  };

  const proposedEpoch = action.proposed_epoch ?? action.voting_epoch;
  const proposedTimestamp = action.proposed_epoch_start_time ?? action.voting_epoch_start_time;

  if (proposedEpoch || proposedTimestamp) {
    addEvent('proposed', {
      label: 'Proposed',
      epoch: proposedEpoch,
      timestamp: proposedTimestamp,
      icon: <Calendar className="w-5 h-5" />,
    });
  }

  const votingEpoch = action.voting_epoch ?? action.proposed_epoch;
  const votingTimestamp = action.voting_epoch_start_time ?? action.proposed_epoch_start_time;

  if (votingEpoch || votingTimestamp || status !== 'submitted') {
    addEvent('voting', {
      label: 'Voting Open',
      epoch: votingEpoch,
      timestamp: votingTimestamp,
      icon: <PlayCircle className="w-5 h-5" />,
    });
  }

  const ratifiedEpoch = action.ratified_epoch ?? action.ratification_epoch;
  if (isRatified || ratifiedEpoch) {
    addEvent('ratified', {
      label: 'Ratified',
      epoch: ratifiedEpoch,
      timestamp: action.ratification_epoch_start_time,
      icon: <CheckCircle className="w-5 h-5" />,
    });
  }

  if (isEnacted || action.enactment_epoch) {
    addEvent('enacted', {
      label: 'Enacted',
      epoch: action.enactment_epoch,
      timestamp: action.enactment_epoch_start_time,
      icon: <CheckCircle className="w-5 h-5" />,
    });
  }

  const expirationEpoch = action.expiration ?? action.expiry_epoch;
  const expirationTimestamp = action.expiration_epoch_start_time ?? action.expiry_epoch_start_time;

  if (!isFailure && !isRatified && !isEnacted && (expirationEpoch || expirationTimestamp)) {
    addEvent('expires', {
      label: 'Expires',
      epoch: expirationEpoch,
      timestamp: expirationTimestamp,
      icon: <Clock className="w-5 h-5" />,
    });
  }

  const failureEpoch = action.dropped_epoch ?? action.expiry_epoch;
  const failureTimestamp = action.dropped_epoch_start_time ?? action.expiry_epoch_start_time;

  if (isFailure) {
    addEvent(status === 'dropped' ? 'dropped' : 'expired', {
      label: status === 'dropped' ? 'Dropped' : 'Expired',
      epoch: failureEpoch,
      timestamp: failureTimestamp,
      icon: <XCircle className="w-5 h-5" />,
    });
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposal Timeline</CardTitle>
        <p className="text-xs text-muted-foreground">All times shown in your local timezone ({timezoneLabel}).</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-stretch gap-8 px-2 py-4">
            {events.map((event, index) => (
              <div key={event.key} className="flex min-w-[180px] flex-col items-center gap-3 text-center">
                <div className="flex w-full items-center gap-2">
                  {index !== 0 && <div className="flex-1 h-0.5 rounded-full bg-muted" />}
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                      event.status === 'completed' && 'bg-emerald-500 border-emerald-500 text-white',
                      event.status === 'current' && 'bg-sky-500 border-sky-500 text-white',
                      event.status === 'pending' && 'bg-amber-500/20 border-amber-500 text-amber-500',
                      event.status === 'failed' && 'bg-rose-500 border-rose-500 text-white'
                    )}
                  >
                    {event.icon}
                  </div>
                  {index !== events.length - 1 && <div className="flex-1 h-0.5 rounded-full bg-muted" />}
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{event.label}</div>
                  {event.epoch && (
                    <div className="text-sm text-muted-foreground">Epoch {event.epoch}</div>
                  )}
                  {event.formattedTime ? (
                    <div className="text-xs text-muted-foreground">{event.formattedTime}</div>
                  ) : event.epoch || event.status !== 'pending' ? (
                    <div className="text-xs text-muted-foreground">Awaiting chain data</div>
                  ) : null}
                  {event.helper && (
                    <div
                      className={cn(
                        'text-xs font-semibold',
                        event.status === 'current' && 'text-sky-500',
                        event.status === 'pending' && 'text-amber-500',
                        event.status === 'failed' && 'text-rose-500'
                      )}
                    >
                      {event.helper}
                    </div>
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

