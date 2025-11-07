import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Users, TrendingUp, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatADA } from '@/lib/governance/governance-stats';
import type { GovernanceStats } from '@/lib/governance/governance-stats';
import { Skeleton } from '../ui/Skeleton';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: {
    value: number;
    label: string;
  };
}

function StatCard({ title, value, icon, description, trend }: StatCardProps) {
  return (
    <Card className="transition-all duration-200 hover:shadow-card-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            <TrendingUp className={`h-3 w-3 mr-1 ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-xs ${trend.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  );
}

interface DashboardStatsProps {
  stats: GovernanceStats | null;
  loading?: boolean;
}

export default function DashboardStats({ stats, loading }: DashboardStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(6)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const activePercentage = stats.totalDReps > 0 
    ? Math.round((stats.activeDReps / stats.totalDReps) * 100)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total DReps"
        value={stats.totalDReps}
        icon={<Users className="h-5 w-5" />}
        description={`${stats.activeDReps} active`}
      />
      <StatCard
        title="Total Voting Power"
        value={formatADA(stats.totalVotingPower)}
        icon={<TrendingUp className="h-5 w-5" />}
        description={`${activePercentage}% active DReps`}
      />
      <StatCard
        title="Total Actions"
        value={stats.totalActions}
        icon={<FileText className="h-5 w-5" />}
        description={`${stats.activeActions} active`}
      />
      <StatCard
        title="Voting Actions"
        value={stats.votingActions}
        icon={<Clock className="h-5 w-5" />}
        description="Currently open for voting"
      />
      <StatCard
        title="Enacted Actions"
        value={stats.enactedActions}
        icon={<CheckCircle className="h-5 w-5 text-green-500" />}
        description="Successfully passed"
      />
      <StatCard
        title="Rejected Actions"
        value={stats.rejectedActions}
        icon={<XCircle className="h-5 w-5 text-red-500" />}
        description="Failed or expired"
      />
    </div>
  );
}

