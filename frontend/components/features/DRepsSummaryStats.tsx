'use client';

import { Card, CardContent } from '../ui/Card';
import { Users, TrendingUp, Vote, Activity } from 'lucide-react';
import type { DRep } from '@/types/governance';

interface DRepsSummaryStatsProps {
  dreps: DRep[];
  activeDRepsCount?: number | null; // Total active DReps from backend
}

export function DRepsSummaryStats({ dreps, activeDRepsCount }: DRepsSummaryStatsProps) {
  // Calculate stats from the provided DReps array
  // Note: If dreps.length is small (e.g., 100), it means we're still loading all DReps
  // The stats will update once all DReps are loaded
  const stats = {
    total: dreps.length,
    // Use backend stats for active DReps count if available, otherwise fallback to local count
    active: activeDRepsCount !== null && activeDRepsCount !== undefined 
      ? activeDRepsCount 
      : dreps.filter(d => {
          if (d.active !== undefined) {
            return d.active && !d.retired;
          }
          return d.status === 'active';
        }).length,
    // Total voting power - using placeholder as it's hard to calculate accurately from APIs
    totalVotingPower: 'N/A' as const,
    topVotingPower: dreps.reduce((max, d) => {
      // Use amount field if available (from DRep endpoint), otherwise fallback
      const power = BigInt(d.amount || d.voting_power_active || d.voting_power || '0');
      return power > max ? power : max;
    }, BigInt(0)),
  };

  const formatADA = (lovelace: bigint): string => {
    const ada = Number(lovelace) / 1_000_000;
    if (ada >= 1_000_000) {
      return `${(ada / 1_000_000).toFixed(2)}M ₳`;
    }
    if (ada >= 1_000) {
      return `${(ada / 1_000).toFixed(2)}K ₳`;
    }
    return `${ada.toFixed(2)} ₳`;
  };

  const statCards = [
    {
      label: 'Total DReps',
      value: stats.total.toLocaleString(),
      icon: <Users className="w-5 h-5" />,
      color: 'text-field-green',
    },
    {
      label: 'Active DReps',
      value: stats.active.toLocaleString(),
      icon: <Activity className="w-5 h-5" />,
      color: 'text-sky-blue',
    },
    {
      label: 'Total Voting Power',
      value: stats.totalVotingPower === 'N/A' ? 'N/A' : formatADA(stats.totalVotingPower),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-field-dark',
    },
    {
      label: 'Top Voting Power',
      value: formatADA(stats.topVotingPower),
      icon: <Vote className="w-5 h-5" />,
      color: 'text-field-green',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {statCards.map((stat, index) => (
        <Card key={index} className="hover:shadow-card-hover transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg bg-muted/50 ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

