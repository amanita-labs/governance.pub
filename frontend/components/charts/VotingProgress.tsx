'use client';

import type { ActionVotingBreakdown } from '@/types/governance';

interface VotingProgressProps {
  votingResults: ActionVotingBreakdown;
  showLabels?: boolean;
  compact?: boolean;
}

/**
 * Format voting power as ADA
 */
function formatVotingPower(power: string): string {
  const powerNum = BigInt(power);
  const ada = Number(powerNum) / 1_000_000;
  
  if (ada >= 1_000_000) {
    return `${(ada / 1_000_000).toFixed(2)}M`;
  }
  if (ada >= 1_000) {
    return `${(ada / 1_000).toFixed(2)}K`;
  }
  return ada.toFixed(2);
}

export function VotingProgress({ votingResults, showLabels = true, compact = false }: VotingProgressProps) {
  // Calculate participation percentages
  const drepTotal = BigInt(votingResults.drep_votes.yes) + 
    BigInt(votingResults.drep_votes.no) + 
    BigInt(votingResults.drep_votes.abstain);
  const spoTotal = BigInt(votingResults.spo_votes.yes) + 
    BigInt(votingResults.spo_votes.no) + 
    BigInt(votingResults.spo_votes.abstain);
  const ccTotal = BigInt(votingResults.cc_votes.yes) + 
    BigInt(votingResults.cc_votes.no) + 
    BigInt(votingResults.cc_votes.abstain);

  // Calculate percentages relative to total voting power
  const drepPct = votingResults.total_voting_power !== '0'
    ? Number((drepTotal * BigInt(100)) / BigInt(votingResults.total_voting_power))
    : 0;
  const spoPct = votingResults.total_voting_power !== '0'
    ? Number((spoTotal * BigInt(100)) / BigInt(votingResults.total_voting_power))
    : 0;
  const ccPct = votingResults.total_voting_power !== '0'
    ? Number((ccTotal * BigInt(100)) / BigInt(votingResults.total_voting_power))
    : 0;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-3 text-sm">
        {ccPct > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">CC</span>
            <span className="font-semibold">{ccPct.toFixed(1)}%</span>
          </div>
        )}
        {drepPct > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">DRep</span>
            <span className="font-semibold">{drepPct.toFixed(1)}%</span>
          </div>
        )}
        {spoPct > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">SPO</span>
            <span className="font-semibold">{spoPct.toFixed(1)}%</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showLabels && (
        <div className="text-sm text-muted-foreground mb-2">
          Voting Participation by Voter Type
        </div>
      )}
      
      {/* CC Participation */}
      {ccPct > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Constitutional Committee</span>
            <span className="text-sm font-semibold">{ccPct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-sky-blue h-2 rounded-full transition-all"
              style={{ width: `${Math.min(ccPct, 100)}%` } as React.CSSProperties}
              aria-label={`Constitutional Committee participation: ${ccPct.toFixed(1)}%`}
              role="progressbar"
              aria-valuenow={ccPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* DRep Participation */}
      {drepPct > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">DReps</span>
            <span className="text-sm font-semibold">{drepPct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-field-green h-2 rounded-full transition-all"
              style={{ width: `${Math.min(drepPct, 100)}%` } as React.CSSProperties}
              aria-label={`DRep participation: ${drepPct.toFixed(1)}%`}
              role="progressbar"
              aria-valuenow={drepPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* SPO Participation */}
      {spoPct > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">SPOs</span>
            <span className="text-sm font-semibold">{spoPct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-field-dark h-2 rounded-full transition-all"
              style={{ width: `${Math.min(spoPct, 100)}%` } as React.CSSProperties}
              aria-label={`SPO participation: ${spoPct.toFixed(1)}%`}
              role="progressbar"
              aria-valuenow={spoPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Total Voting Power */}
      {showLabels && votingResults.total_voting_power !== '0' && (
        <div className="pt-2 border-t border-border">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Voting Power</span>
            <span className="text-sm font-semibold">
              {formatVotingPower(votingResults.total_voting_power)} ₳
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

