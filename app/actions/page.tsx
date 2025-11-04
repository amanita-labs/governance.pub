import { getGovernanceActions } from '@/lib/governance';
import ActionList from '@/components/ActionList';
import { GovernanceHeatmap } from '@/components/GovernanceHeatmap';
import { ActionTimeline } from '@/components/ActionTimeline';
import { Card } from '@/components/ui/Card';

export const revalidate = 60;

export default async function ActionsPage() {
  const actions = await getGovernanceActions();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-display font-bold text-foreground mb-8">Governance Actions</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <GovernanceHeatmap actions={actions} />
        </Card>
        <Card>
          <ActionTimeline actions={actions} />
        </Card>
      </div>
      <ActionList actions={actions} />
    </div>
  );
}

