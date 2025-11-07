'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { VotingChart } from '../charts/VotingChart';
import { VotingProgress } from '../charts/VotingProgress';
import { ProposalMetadata } from './ProposalMetadata';
import { ProposalTimeline } from './ProposalTimeline';
import { Clock, Calendar, Hash, ExternalLink, DollarSign, Settings } from 'lucide-react';
import type { GovernanceAction, ActionVotingBreakdown } from '@/types/governance';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface ActionDetailProps {
  action: GovernanceAction;
  votingResults: ActionVotingBreakdown;
}

function formatActionType(type: string): string {
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
 * Extract string from value (handles both string and object formats)
 */
function extractString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (isRecord(value)) {
    const candidates: Array<unknown> = [value.content, value.text, value.value, value.description, value.label];
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        return candidate;
      }
    }
  }
  return undefined;
}

/**
 * Get metadata title from action (ensures it's always a string)
 * Handles CIP-100/CIP-108 format
 */
function getMetadataTitle(action: GovernanceAction): string {
  // Try meta_json first (handle CIP-100/CIP-108 format)
  if (action.meta_json) {
    try {
      const parsed: unknown =
        typeof action.meta_json === 'string'
          ? JSON.parse(action.meta_json)
          : action.meta_json;

      if (isRecord(parsed)) {
        const body = isRecord(parsed.body) ? parsed.body : undefined;
        if (body) {
          const title = extractString(body.title);
          if (title) return title;
          const abstract = extractString(body.abstract);
          if (abstract) return abstract;
        }

        const title = extractString(parsed.title);
        if (title) return title;
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  // Try metadata field (already normalized from CIP-100/CIP-108 if applicable)
  if (action.metadata) {
    const title = extractString(action.metadata.title);
    if (title) return title;
    // Fallback to abstract if title not available
    const abstract = extractString(action.metadata.abstract);
    if (abstract) return abstract;
  }
  
  // Fallback to description (ensure it's a string)
  const description = extractString(action.description);
  if (description) return description;
  
  // Final fallback to action ID
  return `Action ${action.action_id}`;
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

export default function ActionDetail({ action, votingResults }: ActionDetailProps) {
  const status = action.status || 'submitted';
  const title = getMetadataTitle(action);

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
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-3xl font-display font-bold text-foreground mb-4">{title}</h1>
                  <div className="flex items-center space-x-2 mb-4 flex-wrap gap-2">
                    <Badge variant="default">{formatActionType(action.type)}</Badge>
                    <Badge variant={getStatusVariant(status)}>{status}</Badge>
                    {(action.meta_json || action.metadata) && (
                      <Badge variant="outline">Has Metadata</Badge>
                    )}
                  </div>
                </div>
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

          {/* Voting Results Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Voting Results</CardTitle>
            </CardHeader>
            <CardContent>
              <VotingChart data={chartData} />
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

