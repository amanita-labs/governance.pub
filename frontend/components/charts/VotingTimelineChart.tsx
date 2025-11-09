'use client';

import { useMemo } from 'react';
import type { VoteTimelinePoint } from '@/types/governance';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  type TooltipProps,
} from 'recharts';

interface VotingTimelineChartProps {
  timeline?: VoteTimelinePoint[];
}

interface TimelineDatum {
  timestamp: number;
  formattedLabel: string;
  yes: number;
  no: number;
  abstain: number;
  total: number;
}

function formatTimestamp(timestamp: number): string {
  try {
    return new Date(timestamp * 1000).toLocaleString();
  } catch {
    return `${timestamp}`;
  }
}

function TimelineTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0]?.payload as TimelineDatum | undefined;
  if (!item) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-background/95 px-4 py-3 shadow-md backdrop-blur">
      <p className="text-sm font-semibold text-foreground">
        {formatTimestamp(label as number)}
      </p>
      <div className="mt-2 space-y-1 text-sm">
        <p className="text-emerald-500 font-medium">Yes: {item.yes.toLocaleString()}</p>
        <p className="text-rose-500 font-medium">No: {item.no.toLocaleString()}</p>
        <p className="text-amber-500 font-medium">
          Abstain: {item.abstain.toLocaleString()}
        </p>
        <p className="pt-1 text-muted-foreground">
          Total votes: {item.total.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function VotingTimelineChart({ timeline }: VotingTimelineChartProps) {
  const data = useMemo(() => {
    if (!timeline || timeline.length === 0) {
      return [];
    }

    return timeline
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map<TimelineDatum>((point) => {
        const yes = point.yes_votes ?? 0;
        const no = point.no_votes ?? 0;
        const abstain = point.abstain_votes ?? 0;

        return {
          timestamp: point.timestamp,
          formattedLabel: formatTimestamp(point.timestamp),
          yes,
          no,
          abstain,
          total: yes + no + abstain,
        };
      });
  }, [timeline]);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        No vote timeline available yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <AreaChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 16 }}>
        <defs>
          <linearGradient id="timelineYes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="timelineNo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="timelineAbstain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={(value) => {
            const date = new Date((value as number) * 1000);
            return date.toLocaleDateString();
          }}
          minTickGap={24}
        />
        <YAxis allowDecimals={false} />
        <Tooltip content={<TimelineTooltip />} />
        <Legend />
        <Area
          type="monotone"
          dataKey="yes"
          name="Yes"
          stroke="#047857"
          fill="url(#timelineYes)"
          strokeWidth={2}
          stackId="1"
        />
        <Area
          type="monotone"
          dataKey="no"
          name="No"
          stroke="#b91c1c"
          fill="url(#timelineNo)"
          strokeWidth={2}
          stackId="1"
        />
        <Area
          type="monotone"
          dataKey="abstain"
          name="Abstain"
          stroke="#b45309"
          fill="url(#timelineAbstain)"
          strokeWidth={2}
          stackId="1"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}


