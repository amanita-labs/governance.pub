'use client';

import type { CSSProperties } from 'react';
import type { ActionVotingBreakdown, VoteCounts } from '@/types/governance';

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

function getTotalVotes(votes: VoteCounts | undefined): number {
  if (!votes) return 0;
  return (
    (votes.yes_votes_cast ?? 0) +
    (votes.no_votes_cast ?? 0) +
    (votes.abstain_votes_cast ?? 0)
  );
}

function formatVoteLabel(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? 'vote' : 'votes'}`;
}

export function VotingProgress({ votingResults, showLabels = true, compact = false }: VotingProgressProps) {
  const drepVoteTotal = getTotalVotes(votingResults.drep_votes);
  const spoVoteTotal = getTotalVotes(votingResults.spo_votes);
  const ccVoteTotal = getTotalVotes(votingResults.cc_votes);
  const totalVotesCast = drepVoteTotal + spoVoteTotal + ccVoteTotal;

  const hasVoteCountData = totalVotesCast > 0;

  const drepPowerTotal =
    BigInt(votingResults.drep_votes.yes) +
    BigInt(votingResults.drep_votes.no) +
    BigInt(votingResults.drep_votes.abstain);
  const spoPowerTotal =
    BigInt(votingResults.spo_votes.yes) +
    BigInt(votingResults.spo_votes.no) +
    BigInt(votingResults.spo_votes.abstain);
  const ccPowerTotal =
    BigInt(votingResults.cc_votes.yes) +
    BigInt(votingResults.cc_votes.no) +
    BigInt(votingResults.cc_votes.abstain);

  const fallbackTotalPower =
    BigInt(votingResults.total_voting_power || '0') || drepPowerTotal + spoPowerTotal + ccPowerTotal;

  const drepPct = hasVoteCountData
    ? (drepVoteTotal / totalVotesCast) * 100
    : fallbackTotalPower !== BigInt(0)
      ? Number((drepPowerTotal * BigInt(100)) / fallbackTotalPower)
      : 0;
  const spoPct = hasVoteCountData
    ? (spoVoteTotal / totalVotesCast) * 100
    : fallbackTotalPower !== BigInt(0)
      ? Number((spoPowerTotal * BigInt(100)) / fallbackTotalPower)
      : 0;
  const ccPct = hasVoteCountData
    ? (ccVoteTotal / totalVotesCast) * 100
    : fallbackTotalPower !== BigInt(0)
      ? Number((ccPowerTotal * BigInt(100)) / fallbackTotalPower)
      : 0;

  if (compact) {
    return (
      <div className="flex flex-wrap gap-3 text-sm">
        {ccPct > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">CC</span>
            <span className="font-semibold">
              {ccPct.toFixed(1)}%
              {hasVoteCountData && ` · ${formatVoteLabel(ccVoteTotal)}`}
            </span>
          </div>
        )}
        {drepPct > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">DRep</span>
            <span className="font-semibold">
              {drepPct.toFixed(1)}%
              {hasVoteCountData && ` · ${formatVoteLabel(drepVoteTotal)}`}
            </span>
          </div>
        )}
        {spoPct > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">SPO</span>
            <span className="font-semibold">
              {spoPct.toFixed(1)}%
              {hasVoteCountData && ` · ${formatVoteLabel(spoVoteTotal)}`}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showLabels && (
        <div className="text-sm text-muted-foreground mb-2">
          Voting Participation by Voter Type{hasVoteCountData ? ' (by ballots cast)' : ' (by stake represented)'}
        </div>
      )}
      
      {/* CC Participation */}
      {ccPct > 0 && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Constitutional Committee</span>
            <span className="text-sm font-semibold">
              {ccPct.toFixed(1)}%
              {hasVoteCountData
                ? ` · ${formatVoteLabel(ccVoteTotal)}`
                : ` · ${formatVotingPower(ccPowerTotal.toString())} ₳`}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-sky-blue h-2 rounded-full transition-all"
              style={{ width: `${Math.min(ccPct, 100)}%` } as CSSProperties}
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
            <span className="text-sm font-semibold">
              {drepPct.toFixed(1)}%
              {hasVoteCountData
                ? ` · ${formatVoteLabel(drepVoteTotal)}`
                : ` · ${formatVotingPower(drepPowerTotal.toString())} ₳`}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-field-green h-2 rounded-full transition-all"
              style={{ width: `${Math.min(drepPct, 100)}%` } as CSSProperties}
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
            <span className="text-sm font-semibold">
              {spoPct.toFixed(1)}%
              {hasVoteCountData
                ? ` · ${formatVoteLabel(spoVoteTotal)}`
                : ` · ${formatVotingPower(spoPowerTotal.toString())} ₳`}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-field-dark h-2 rounded-full transition-all"
              style={{ width: `${Math.min(spoPct, 100)}%` } as CSSProperties}
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
            <span className="text-sm text-muted-foreground">
              {hasVoteCountData ? 'Total Votes Counted' : 'Total Voting Power'}
            </span>
            <span className="text-sm font-semibold">
              {hasVoteCountData
                ? formatVoteLabel(totalVotesCast)
                : `${formatVotingPower(votingResults.total_voting_power)} ₳`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

