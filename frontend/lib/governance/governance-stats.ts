import type { DRep, GovernanceAction } from '@/types/governance';

export interface GovernanceStats {
  totalDReps: number;
  activeDReps: number;
  totalVotingPower: string; // in lovelace
  totalActions: number;
  activeActions: number;
  enactedActions: number;
  rejectedActions: number;
  votingActions: number;
}

export function calculateStats(dreps: DRep[], actions: GovernanceAction[]): GovernanceStats {
  const totalDReps = dreps.length;
  const activeDReps = dreps.filter(d => d.status === 'active').length;
  
  // Calculate total voting power
  let totalVotingPower = BigInt(0);
  dreps.forEach(drep => {
    const power = BigInt(drep.voting_power_active || drep.voting_power || '0');
    totalVotingPower += power;
  });
  
  const totalActions = actions.length;
  const activeActions = actions.filter(a => a.status === 'voting' || a.status === 'submitted').length;
  const enactedActions = actions.filter(a => a.status === 'enacted' || a.status === 'ratified').length;
  const rejectedActions = actions.filter(a => a.status === 'rejected' || a.status === 'expired').length;
  const votingActions = actions.filter(a => a.status === 'voting').length;
  
  return {
    totalDReps,
    activeDReps,
    totalVotingPower: totalVotingPower.toString(),
    totalActions,
    activeActions,
    enactedActions,
    rejectedActions,
    votingActions,
  };
}

export function formatADA(lovelace: string | BigInt): string {
  const lovelaceNum = typeof lovelace === 'string' ? BigInt(lovelace) : lovelace;
  const ada = Number(lovelaceNum) / 1_000_000;
  
  if (ada >= 1_000_000_000) {
    return `${(ada / 1_000_000_000).toFixed(2)}B ADA`;
  }
  if (ada >= 1_000_000) {
    return `${(ada / 1_000_000).toFixed(2)}M ADA`;
  }
  if (ada >= 1_000) {
    return `${(ada / 1_000).toFixed(2)}K ADA`;
  }
  return `${ada.toFixed(2)} ADA`;
}

