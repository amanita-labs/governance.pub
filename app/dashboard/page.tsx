import { getDReps, getGovernanceActions } from '@/lib/governance';
import { calculateStats } from '@/lib/governance/governance-stats';
import DashboardStats from '@/components/features/DashboardStats';
import { VotingPowerFlow } from '@/components/charts/VotingPowerFlow';
import { GovernanceHeatmap } from '@/components/charts/GovernanceHeatmap';
import { ActionTimeline } from '@/components/features/ActionTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import ActionList from '@/components/features/ActionList';
import DRepList from '@/components/features/DRepList';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowRight, TrendingUp, Users, FileText, Vote } from 'lucide-react';

export const revalidate = 60; // Revalidate every 60 seconds

export default async function DashboardPage() {
  const [dreps, actions] = await Promise.all([
    getDReps(),
    getGovernanceActions(),
  ]);

  const stats = calculateStats(dreps, actions);
  
  // Get top 6 DReps by voting power
  const topDReps = [...dreps]
    .sort((a, b) => {
      const powerA = BigInt(a.voting_power_active || a.voting_power || '0');
      const powerB = BigInt(b.voting_power_active || b.voting_power || '0');
      return powerB > powerA ? 1 : powerB < powerA ? -1 : 0;
    })
    .slice(0, 6);

  // Get recent actions (last 6)
  const recentActions = [...actions]
    .sort((a, b) => {
      const epochA = a.voting_epoch || a.enactment_epoch || 0;
      const epochB = b.voting_epoch || b.enactment_epoch || 0;
      return epochB - epochA;
    })
    .slice(0, 6);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-foreground mb-2">
          Governance Dashboard
        </h1>
        <p className="text-muted-foreground">
          Overview of Cardano governance activity and key metrics
        </p>
      </div>

      {/* Stats Overview */}
      <div className="mb-8">
        <DashboardStats stats={stats} />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Link href="/dreps">
                <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                  <Users className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Browse DReps</div>
                    <div className="text-xs text-muted-foreground">Explore all DReps</div>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
              <Link href="/actions">
                <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                  <FileText className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">View Actions</div>
                    <div className="text-xs text-muted-foreground">All governance actions</div>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
              <Link href="/delegate">
                <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                  <Vote className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Delegate</div>
                    <div className="text-xs text-muted-foreground">Delegate voting power</div>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
              <Link href="/register-drep">
                <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                  <TrendingUp className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">Register DRep</div>
                    <div className="text-xs text-muted-foreground">Become a DRep</div>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {dreps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Voting Power Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <VotingPowerFlow dreps={dreps.slice(0, 20)} />
            </CardContent>
          </Card>
        )}
        {actions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Governance Activity Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <GovernanceHeatmap actions={actions} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Timeline */}
      {actions.length > 0 && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionTimeline actions={actions.slice(0, 10)} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top DReps */}
      {topDReps.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-display font-semibold text-foreground">
              Top DReps by Voting Power
            </h2>
            <Link href="/dreps">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
          <DRepList dreps={topDReps} />
        </div>
      )}

      {/* Recent Actions */}
      {recentActions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-display font-semibold text-foreground">
              Recent Governance Actions
            </h2>
            <Link href="/actions">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
          <ActionList actions={recentActions} />
        </div>
      )}
    </div>
  );
}

