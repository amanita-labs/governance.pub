'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { VotingChart } from '../charts/VotingChart';
import { VotingTimelineChart } from '../charts/VotingTimelineChart';
import { VotingProgress } from '../charts/VotingProgress';
import { ProposalMetadata } from './ProposalMetadata';
import { MetadataValidationSummary } from './MetadataValidationSummary';
import { ProposalTimeline } from './ProposalTimeline';
import { Clock, Calendar, Hash, ExternalLink, DollarSign, Settings, Vote } from 'lucide-react';
import type {
  GovernanceAction,
  ActionVotingBreakdown,
  ActionVoterParticipation,
} from '@/types/governance';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { getActionDisplayType, getActionTitle } from '@/lib/governance';
import { VoterParticipationView } from './VoterParticipation';

interface ActionDetailProps {
  action: GovernanceAction;
  votingResults: ActionVotingBreakdown;
  participation: ActionVoterParticipation | null;
}

function formatActionType(type: string): string {
  if (type === 'budget') {
    return 'Budget Action💰';
  }
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatVotingPower(power: string): string {
  const powerNum = BigInt(power);
  const ada = Number(powerNum) / 1_000_000;
  if (ada >= 1_000_000) {
    return `${(ada / 1_000_000).toFixed(2)}M ADA`;
  }
  if (ada >= 1_000) {
    return `${(ada / 1_000).toFixed(2)}K ADA`;
  }
  return `${ada.toFixed(2)} ADA`;
}

function formatAdaValue(value?: string): string {
  if (!value) {
    return '—';
  }
  try {
    return formatVotingPower(value);
  } catch {
    return '—';
  }
}

function formatVoteCount(count?: number): string {
  if (typeof count !== 'number') {
    return '—';
  }
  return count.toLocaleString();
}

function formatVoteLabel(count?: number): string {
  if (typeof count !== 'number') {
    return '—';
  }
  const formatted = count.toLocaleString();
  return `${formatted} ${count === 1 ? 'vote' : 'votes'}`;
}

function formatPercent(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }
  return `${value.toFixed(1)}%`;
}

const sumCounts = (...values: Array<number | undefined>): number => {
  let total = 0;
  for (const value of values) {
    total += value ?? 0;
  }
  return total;
};

type DetailEntry = {
  label: string;
  count: number;
  power?: string;
  percent?: number;
};

type DetailSection = {
  key: string;
  title: string;
  votesCast: number;
  entries: DetailEntry[];
  extras: Array<{ label: string; value: string }>;
};

function getStatusVariant(status: string | undefined): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (status) {
    case 'enacted':
    case 'ratified':
      return 'success';
    case 'voting':
      return 'info';
    case 'rejected':
    case 'expired':
      return 'error';
    default:
      return 'default';
  }
}

/**
 * Format treasury withdrawal amount
 */
function formatTreasuryAmount(amount: string): string {
  const ada = Number(BigInt(amount)) / 1_000_000;
  if (ada >= 1_000_000) {
    return `${(ada / 1_000_000).toFixed(2)}M ₳`;
  }
  if (ada >= 1_000) {
    return `${(ada / 1_000).toFixed(2)}K ₳`;
  }
  return `${ada.toFixed(2)} ₳`;
}

/**
 * Get explorer URL for transaction
 */
function getExplorerUrl(txHash: string): string {
  // Use CardanoScan explorer
  // Default to mainnet, but can be configured via environment variable
  const network = process.env.NEXT_PUBLIC_NETWORK || 'mainnet';
  if (network === 'mainnet') {
    return `https://cardanoscan.io/transaction/${txHash}`;
  }
  return `https://preview.cardanoscan.io/transaction/${txHash}`;
}

export default function ActionDetail({
  action,
  votingResults,
  participation,
}: ActionDetailProps) {
  const router = useRouter();
  const status = action.status || 'submitted';
  const title = getActionTitle(action);
  const displayType = getActionDisplayType(action);
  const summary = votingResults.summary;

  const chartData = [
    {
      name: 'DReps',
      yes: Number(votingResults.drep_votes.yes) / 1_000_000,
      no: Number(votingResults.drep_votes.no) / 1_000_000,
      abstain: Number(votingResults.drep_votes.abstain) / 1_000_000,
    },
    {
      name: 'SPOs',
      yes: Number(votingResults.spo_votes.yes) / 1_000_000,
      no: Number(votingResults.spo_votes.no) / 1_000_000,
      abstain: Number(votingResults.spo_votes.abstain) / 1_000_000,
    },
    {
      name: 'CC Members',
      yes: Number(votingResults.cc_votes.yes) / 1_000_000,
      no: Number(votingResults.cc_votes.no) / 1_000_000,
      abstain: Number(votingResults.cc_votes.abstain) / 1_000_000,
    },
  ];

  const totalYes = 
    BigInt(votingResults.drep_votes.yes) + 
    BigInt(votingResults.spo_votes.yes) + 
    BigInt(votingResults.cc_votes.yes);
  
  const totalNo = 
    BigInt(votingResults.drep_votes.no) + 
    BigInt(votingResults.spo_votes.no) + 
    BigInt(votingResults.cc_votes.no);

  const totalAbstain = 
    BigInt(votingResults.drep_votes.abstain) + 
    BigInt(votingResults.spo_votes.abstain) + 
    BigInt(votingResults.cc_votes.abstain);

  const drepYesCount = votingResults.drep_votes.yes_votes_cast ?? summary?.drep_yes_votes_cast ?? 0;
  const drepNoCount = votingResults.drep_votes.no_votes_cast ?? summary?.drep_no_votes_cast ?? 0;
  const drepAbstainCount = votingResults.drep_votes.abstain_votes_cast ?? summary?.drep_abstain_votes_cast ?? 0;
  const spoYesCount = votingResults.spo_votes.yes_votes_cast ?? summary?.pool_yes_votes_cast ?? 0;
  const spoNoCount = votingResults.spo_votes.no_votes_cast ?? summary?.pool_no_votes_cast ?? 0;
  const spoAbstainCount = votingResults.spo_votes.abstain_votes_cast ?? summary?.pool_abstain_votes_cast ?? 0;
  const ccYesCount = votingResults.cc_votes.yes_votes_cast ?? summary?.committee_yes_votes_cast ?? 0;
  const ccNoCount = votingResults.cc_votes.no_votes_cast ?? summary?.committee_no_votes_cast ?? 0;
  const ccAbstainCount = votingResults.cc_votes.abstain_votes_cast ?? summary?.committee_abstain_votes_cast ?? 0;

  const drepVotesCast = sumCounts(drepYesCount, drepNoCount, drepAbstainCount);
  const spoVotesCast = sumCounts(spoYesCount, spoNoCount, spoAbstainCount);
  const ccVotesCast = sumCounts(ccYesCount, ccNoCount, ccAbstainCount);
  const totalVotesCast = sumCounts(drepVotesCast, spoVotesCast, ccVotesCast);

  const yesVotesCountTotal = sumCounts(drepYesCount, spoYesCount, ccYesCount);
  const noVotesCountTotal = sumCounts(drepNoCount, spoNoCount, ccNoCount);
  const abstainVotesCountTotal = sumCounts(drepAbstainCount, spoAbstainCount, ccAbstainCount);

  const drepYesPower = summary?.drep_yes_vote_power ?? votingResults.drep_votes.yes;
  const drepNoPower = summary?.drep_no_vote_power ?? votingResults.drep_votes.no;
  const drepAbstainPower = summary
    ? (
        BigInt(summary.drep_active_abstain_vote_power ?? '0') +
        BigInt(summary.drep_always_abstain_vote_power ?? '0')
      ).toString()
    : votingResults.drep_votes.abstain;

  const spoYesPower = summary?.pool_yes_vote_power ?? votingResults.spo_votes.yes;
  const spoNoPower = summary?.pool_no_vote_power ?? votingResults.spo_votes.no;
  const spoAbstainPower = summary
    ? (
        BigInt(summary.pool_active_abstain_vote_power ?? '0') +
        BigInt(summary.pool_passive_always_abstain_vote_power ?? '0')
      ).toString()
    : votingResults.spo_votes.abstain;

  const detailSections: DetailSection[] = [
    {
      key: 'dreps',
      title: 'DReps',
      votesCast: drepVotesCast,
      entries: [
        {
          label: 'Yes',
          count: drepYesCount,
          power: drepYesPower,
          percent: summary?.drep_yes_pct,
        },
        {
          label: 'No',
          count: drepNoCount,
          power: drepNoPower,
          percent: summary?.drep_no_pct,
        },
        {
          label: 'Abstain',
          count: drepAbstainCount,
          power: drepAbstainPower,
        },
      ],
      extras: summary
        ? [
            {
              label: 'Always Abstain Power',
              value: formatAdaValue(summary.drep_always_abstain_vote_power ?? undefined),
            },
            {
              label: 'Always No-Confidence Power',
              value: formatAdaValue(summary.drep_always_no_confidence_vote_power ?? undefined),
            },
          ]
        : [],
    },
    {
      key: 'spos',
      title: 'Stake Pools',
      votesCast: spoVotesCast,
      entries: [
        {
          label: 'Yes',
          count: spoYesCount,
          power: spoYesPower,
          percent: summary?.pool_yes_pct,
        },
        {
          label: 'No',
          count: spoNoCount,
          power: spoNoPower,
          percent: summary?.pool_no_pct,
        },
        {
          label: 'Abstain',
          count: spoAbstainCount,
          power: spoAbstainPower,
        },
      ],
      extras: summary
        ? [
            {
              label: 'Passive Always-Abstain Votes',
              value: formatVoteCount(summary.pool_passive_always_abstain_votes_assigned ?? undefined),
            },
            {
              label: 'Passive Always-Abstain Power',
              value: formatAdaValue(summary.pool_passive_always_abstain_vote_power ?? undefined),
            },
            {
              label: 'Passive Always No-Confidence Votes',
              value: formatVoteCount(summary.pool_passive_always_no_confidence_votes_assigned ?? undefined),
            },
            {
              label: 'Passive Always No-Confidence Power',
              value: formatAdaValue(summary.pool_passive_always_no_confidence_vote_power ?? undefined),
            },
          ]
        : [],
    },
    {
      key: 'cc',
      title: 'Constitutional Committee',
      votesCast: ccVotesCast,
      entries: [
        {
          label: 'Yes',
          count: ccYesCount,
          percent: summary?.committee_yes_pct,
        },
        {
          label: 'No',
          count: ccNoCount,
          percent: summary?.committee_no_pct,
        },
        {
          label: 'Abstain',
          count: ccAbstainCount,
        },
      ],
      extras: [] as Array<{ label: string; value: string }>,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/actions" className="text-field-green hover:underline mb-4 inline-block">
          ← Back to Actions
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Action Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-display font-bold text-foreground mb-4">{title}</h1>
                  <div className="flex items-center space-x-2 mb-4 flex-wrap gap-2">
                    <Badge variant="default">{formatActionType(displayType)}</Badge>
                    <Badge variant={getStatusVariant(status)}>{status}</Badge>
                    {(action.meta_json || action.metadata) && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <span aria-hidden="true">🐑</span>
                        <span>Has metadata</span>
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span aria-hidden="true">🌿</span>
                    <span>This proposal is happily grazing under flock supervision.</span>
                  </div>
                </div>
                {(status === 'voting' || status === 'submitted') && (
                  <Button
                    onClick={() => router.push(`/vote-now?proposal=${action.action_id}`)}
                    className="shrink-0"
                  >
                    <Vote className="w-4 h-4 mr-2" />
                    Vote Now
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Proposal Timeline */}
              {(action.proposed_epoch || action.ratified_epoch || action.enactment_epoch) && (
                <div className="mb-6">
                  <ProposalTimeline action={action} />
                </div>
              )}

              {/* Proposal Metadata */}
              {(action.meta_json || action.metadata) && (
                <div className="mb-6">
                  <ProposalMetadata action={action} />
                </div>
              )}

              {action.metadata_checks && (
                <div className="mb-6">
                  <MetadataValidationSummary
                    checks={action.metadata_checks}
                    metaUrl={action.meta_url}
                  />
                </div>
              )}

              {/* Treasury Withdrawal */}
              {action.withdrawal && action.withdrawal.amount && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-field-green" />
                      Treasury Withdrawal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Amount</p>
                        <p className="text-2xl font-bold text-foreground">
                          {formatTreasuryAmount(action.withdrawal.amount)}
                        </p>
                      </div>
                      {action.withdrawal.address && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Recipient Address</p>
                          <code className="text-sm bg-muted px-2 py-1 rounded break-all text-foreground font-mono">
                            {action.withdrawal.address}
                          </code>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Parameter Changes */}
              {action.param_proposal && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-sky-blue" />
                      Parameter Changes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm bg-muted p-4 rounded overflow-auto font-mono">
                      {JSON.stringify(action.param_proposal, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Epoch Information */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {action.proposed_epoch && (
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50">
                    <Clock className="w-5 h-5 text-field-green" />
                    <div>
                      <p className="text-xs text-muted-foreground">Proposed Epoch</p>
                      <p className="text-lg font-semibold">{action.proposed_epoch}</p>
                    </div>
                  </div>
                )}
                
                {action.voting_epoch && !action.proposed_epoch && (
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50">
                    <Clock className="w-5 h-5 text-field-green" />
                    <div>
                      <p className="text-xs text-muted-foreground">Voting Epoch</p>
                      <p className="text-lg font-semibold">{action.voting_epoch}</p>
                    </div>
                  </div>
                )}

                {action.ratified_epoch && (
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50">
                    <Calendar className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Ratified Epoch</p>
                      <p className="text-lg font-semibold">{action.ratified_epoch}</p>
                    </div>
                  </div>
                )}
              
                {action.enactment_epoch && (
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50">
                    <Calendar className="w-5 h-5 text-sky-blue" />
                    <div>
                      <p className="text-xs text-muted-foreground">Enactment Epoch</p>
                      <p className="text-lg font-semibold">{action.enactment_epoch}</p>
                    </div>
                  </div>
                )}

                {action.expiry_epoch && (
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50">
                    <Calendar className="w-5 h-5 text-red-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Expiry Epoch</p>
                      <p className="text-lg font-semibold">{action.expiry_epoch}</p>
                    </div>
                  </div>
                )}

                {action.expiration && action.status !== 'expired' && action.status !== 'dropped' && (
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                    <Clock className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400">Expires at Epoch</p>
                      <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">{action.expiration}</p>
                    </div>
                  </div>
                )}

                {action.deposit && (
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50">
                    <Hash className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Deposit</p>
                      <p className="text-lg font-semibold">{formatVotingPower(action.deposit)}</p>
                    </div>
                  </div>
                )}

                {action.return_address && (
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50">
                    <Hash className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Return Address</p>
                      <code className="text-xs bg-muted px-2 py-1 rounded break-all text-foreground font-mono">
                        {action.return_address.slice(0, 20)}...
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Transaction Links */}
              {action.tx_hash && (
                <div className="mt-4 p-4 rounded-md bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-2">Transaction Hash</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-sm bg-muted px-2 py-1 rounded break-all text-foreground font-mono">
                      {action.tx_hash}
                    </code>
                    <a
                      href={getExplorerUrl(action.tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-field-green hover:underline flex items-center gap-1"
                    >
                      View on Explorer
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Proposal ID */}
              {action.proposal_id && (
                <div className="mt-4 p-4 rounded-md bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-2">Proposal ID (CIP-129)</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded break-all text-foreground font-mono">
                    {action.proposal_id}
                  </code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Voting Insights */}
          <Card>
            <CardHeader className="pb-0">
              <CardTitle>Voting Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="breakdown">
                <TabsList className="mt-4">
                  <TabsTrigger value="breakdown">By Voter Type</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="participation" disabled={!participation}>
                    Voter Participation
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="breakdown" className="mt-6">
                  <VotingChart data={chartData} />
                </TabsContent>
                <TabsContent value="timeline" className="mt-6">
                  <VotingTimelineChart timeline={votingResults.vote_timeline} />
                </TabsContent>
                <TabsContent value="participation" className="mt-6">
                  {participation ? (
                    <VoterParticipationView participation={participation} />
                  ) : (
                    <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
                      Detailed participation data is currently unavailable for this action. Try
                      again later once network providers publish full voter information.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Voting Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Voting Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Voting Power</p>
                  <p className="text-2xl font-bold">{formatVotingPower(votingResults.total_voting_power)}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Yes</span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">{formatVotingPower(totalYes.toString())}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-green-500 dark:bg-green-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${votingResults.total_voting_power !== '0' ? (Number(totalYes) / Number(votingResults.total_voting_power)) * 100 : 0}%`,
                        }}
                        aria-label={`Yes votes: ${formatVotingPower(totalYes.toString())}`}
                        role="progressbar"
                        aria-valuenow={votingResults.total_voting_power !== '0' ? (Number(totalYes) / Number(votingResults.total_voting_power)) * 100 : 0}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">No</span>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">{formatVotingPower(totalNo.toString())}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-red-500 dark:bg-red-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${votingResults.total_voting_power !== '0' ? (Number(totalNo) / Number(votingResults.total_voting_power)) * 100 : 0}%`,
                        }}
                        aria-label={`No votes: ${formatVotingPower(totalNo.toString())}`}
                        role="progressbar"
                        aria-valuenow={votingResults.total_voting_power !== '0' ? (Number(totalNo) / Number(votingResults.total_voting_power)) * 100 : 0}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Abstain</span>
                      <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">{formatVotingPower(totalAbstain.toString())}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-yellow-500 dark:bg-yellow-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${votingResults.total_voting_power !== '0' ? (Number(totalAbstain) / Number(votingResults.total_voting_power)) * 100 : 0}%`,
                        }}
                        aria-label={`Abstain votes: ${formatVotingPower(totalAbstain.toString())}`}
                        role="progressbar"
                        aria-valuenow={votingResults.total_voting_power !== '0' ? (Number(totalAbstain) / Number(votingResults.total_voting_power)) * 100 : 0}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                </div>

                {(totalVotesCast > 0 || summary) && (
                  <div className="space-y-6 pt-4 border-t border-border">
                    {totalVotesCast > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Ballots Cast</span>
                          <span className="text-sm font-semibold">{formatVoteLabel(totalVotesCast)}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                          <div className="rounded-md bg-muted/40 p-3">
                            <p className="text-xs uppercase text-muted-foreground tracking-wide">Yes</p>
                            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                              {formatVoteCount(yesVotesCountTotal)}
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/40 p-3">
                            <p className="text-xs uppercase text-muted-foreground tracking-wide">No</p>
                            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                              {formatVoteCount(noVotesCountTotal)}
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/40 p-3">
                            <p className="text-xs uppercase text-muted-foreground tracking-wide">Abstain</p>
                            <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                              {formatVoteCount(abstainVotesCountTotal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {summary && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Detailed Breakdown by Voter Type
                        </h4>
                        <div className="space-y-4">
                          {detailSections.map((section) => (
                            <div
                              key={section.key}
                              className="space-y-4 rounded-lg border border-border/60 bg-muted/30 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-foreground">{section.title}</span>
                                {section.votesCast > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatVoteLabel(section.votesCast)}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                {section.entries.map((entry) => (
                                  <div key={entry.label} className="space-y-1">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                      {entry.label}
                                    </p>
                                    <p className="text-base font-semibold text-foreground">
                                      {formatVoteCount(entry.count)}
                                    </p>
                                    {entry.percent !== undefined && (
                                      <p className="text-xs text-muted-foreground">
                                        {formatPercent(entry.percent)}
                                      </p>
                                    )}
                                    {entry.power && (
                                      <p className="text-xs text-muted-foreground">
                                        {formatAdaValue(entry.power)}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {section.extras.length > 0 && (
                                <div className="grid gap-2 border-t border-border/60 pt-3 text-xs sm:text-sm">
                                  {section.extras.map((extra) => (
                                    <div key={extra.label} className="flex items-center justify-between gap-3">
                                      <span className="text-muted-foreground">{extra.label}</span>
                                      <span className="font-medium text-foreground">{extra.value}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Voting Progress by Voter Type */}
          <Card>
            <CardHeader>
              <CardTitle>Participation by Voter Type</CardTitle>
            </CardHeader>
            <CardContent>
              <VotingProgress votingResults={votingResults} showLabels />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

