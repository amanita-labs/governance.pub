import { getDRepsPage, getGovernanceActionsPage } from '@/lib/governance';
import { calculateStats } from '@/lib/governance/governance-stats';
import DashboardStats from '@/components/features/DashboardStats';
import { ActionTimeline } from '@/components/features/ActionTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import ActionList from '@/components/features/ActionList';
import DRepList from '@/components/features/DRepList';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowRight, TrendingUp, Users, FileText, Vote } from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy load heavy chart components (client components will hydrate on client)
const VotingPowerFlowLazy = dynamic(() => import('@/components/charts/VotingPowerFlow').then(mod => ({ default: mod.VotingPowerFlow })), {
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground">Loading chart...</div>,
});

const GovernanceHeatmapLazy = dynamic(() => import('@/components/charts/GovernanceHeatmap').then(mod => ({ default: mod.GovernanceHeatmap })), {
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground">Loading heatmap...</div>,
});

export const revalidate = 60; // Revalidate every 60 seconds

export default async function DashboardPage() {
  // Only fetch what we need: top 20 DReps for charts, top 6 for display, and recent 6 actions
  // This is much faster than fetching ALL DReps and ALL Actions
  const [drepsPage, actionsPage, allDRepsForStats, allActionsForStats] = await Promise.all([
    getDRepsPage(1, 20, false), // Get top 20 DReps for charts (no enrichment for speed)
    getGovernanceActionsPage(1, 6, false), // Get top 6 actions (no enrichment for speed)
    getDRepsPage(1, 100, false).then(page => page.dreps), // Get first 100 for stats (quick)
    getGovernanceActionsPage(1, 100, false).then(page => page.actions), // Get first 100 for stats (quick)
  ]);

  const stats = calculateStats(allDRepsForStats, allActionsForStats);
  
  // Get top 6 DReps by voting power from the first page
  const topDReps = [...drepsPage.dreps]
    .sort((a, b) => {
      const powerA = BigInt(a.voting_power_active || a.voting_power || '0');
      const powerB = BigInt(b.voting_power_active || b.voting_power || '0');
      return powerB > powerA ? 1 : powerB < powerA ? -1 : 0;
    })
    .slice(0, 6);

  // Get recent actions (already sorted by Koios/Blockfrost)
  const recentActions = actionsPage.actions.slice(0, 6);

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
        {drepsPage.dreps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Voting Power Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <VotingPowerFlowLazy dreps={drepsPage.dreps.slice(0, 20)} />
            </CardContent>
          </Card>
        )}
        {allActionsForStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Governance Activity Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <GovernanceHeatmapLazy actions={allActionsForStats} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Timeline */}
      {allActionsForStats.length > 0 && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionTimeline actions={allActionsForStats.slice(0, 10)} />
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

