'use client';

import Link from 'next/link';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { VotingChart } from './VotingChart';
import { Clock, Calendar, Hash, ExternalLink } from 'lucide-react';
import type { GovernanceAction, ActionVotingBreakdown } from '@/types/governance';

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

export default function ActionDetail({ action, votingResults }: ActionDetailProps) {
  const status = action.status || 'submitted';
  const title = action.metadata?.title || action.description || `Action ${action.action_id}`;

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
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground mb-4">{title}</h1>
                <div className="flex items-center space-x-2 mb-4">
                  <Badge variant="default">{formatActionType(action.type)}</Badge>
                  <Badge variant={getStatusVariant(status)}>{status}</Badge>
                </div>
              </div>
            </div>

            {action.metadata?.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-foreground whitespace-pre-wrap">{action.metadata.description}</p>
              </div>
            )}

            {action.metadata?.rationale && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Rationale</h2>
                <p className="text-foreground whitespace-pre-wrap">{action.metadata.rationale}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              {action.voting_epoch && (
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-field-green" />
                  <div>
                    <p className="text-xs text-muted-foreground">Voting Epoch</p>
                    <p className="text-lg font-semibold">{action.voting_epoch}</p>
                  </div>
                </div>
              )}
              
              {action.enactment_epoch && (
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-sky-blue" />
                  <div>
                    <p className="text-xs text-muted-foreground">Enactment Epoch</p>
                    <p className="text-lg font-semibold">{action.enactment_epoch}</p>
                  </div>
                </div>
              )}

              {action.expiry_epoch && (
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Expiry Epoch</p>
                    <p className="text-lg font-semibold">{action.expiry_epoch}</p>
                  </div>
                </div>
              )}

              {action.deposit && (
                <div className="flex items-center space-x-2">
                  <Hash className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Deposit</p>
                    <p className="text-lg font-semibold">{formatVotingPower(action.deposit)}</p>
                  </div>
                </div>
              )}
            </div>

            {action.tx_hash && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-1">Transaction Hash</p>
                <div className="flex items-center space-x-2">
                  <Hash className="w-4 h-4 text-muted-foreground" />
                  <code className="text-sm bg-muted px-2 py-1 rounded break-all text-foreground">{action.tx_hash}</code>
                </div>
              </div>
            )}
          </Card>

          <Card className="mt-6">
            <h2 className="text-xl font-bold mb-4">Voting Results</h2>
            <VotingChart data={chartData} />
          </Card>
        </div>

        <div>
          <Card>
            <h2 className="text-xl font-bold mb-4">Voting Summary</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Voting Power</p>
                <p className="text-2xl font-bold">{formatVotingPower(votingResults.total_voting_power)}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Yes</span>
                    <span className="text-sm font-semibold text-green-600">{formatVotingPower(totalYes.toString())}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(Number(totalYes) / Number(votingResults.total_voting_power)) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">No</span>
                    <span className="text-sm font-semibold text-red-600">{formatVotingPower(totalNo.toString())}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{
                        width: `${(Number(totalNo) / Number(votingResults.total_voting_power)) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Abstain</span>
                    <span className="text-sm font-semibold text-yellow-600">{formatVotingPower(totalAbstain.toString())}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{
                        width: `${(Number(totalAbstain) / Number(votingResults.total_voting_power)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

