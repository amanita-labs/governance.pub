'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { VotingPowerChart } from '../charts/VotingPowerChart';
import { ExternalLink, TrendingUp, Calendar, Hash, User, Mail, Globe, FileText, Users, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import type { DRep, DRepVotingHistory, DRepDelegator } from '@/types/governance';

interface DRepDetailProps {
  drep: DRep;
  votingHistory: DRepVotingHistory[];
  delegators?: DRepDelegator[];
}

function formatVotingPower(power: string | undefined): string {
  if (!power) return '0 ₳';
  const powerNum = BigInt(power);
  const ada = Number(powerNum) / 1_000_000;
  if (ada >= 1_000_000) {
    return `${(ada / 1_000_000).toFixed(2)}M ₳`;
  }
  if (ada >= 1_000) {
    return `${(ada / 1_000).toFixed(2)}K ₳`;
  }
  return `${ada.toFixed(2)} ₳`;
}

function formatAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}...${address.slice(-10)}`;
}

function formatVoteCount(vote: 'yes' | 'no' | 'abstain'): string {
  if (!vote) return 'Unknown';
  return vote.charAt(0).toUpperCase() + vote.slice(1);
}

export default function DRepDetail({ drep, votingHistory, delegators = [] }: DRepDetailProps) {
  const [copiedId, setCopiedId] = useState(false);
  
  // Use name from metadata endpoint (rich metadata), fallback to view, then drep_id
  // Priority: metadata.name > metadata.title > view > drep_id
  const drepName = drep.metadata?.name || 
                   drep.metadata?.title || 
                   drep.view || 
                   drep.drep_id.slice(0, 8);
  const status = drep.status || 'active';
  const hasLogo = !!(drep.metadata?.logo || drep.metadata?.image || drep.metadata?.picture);
  const logoUrl = drep.metadata?.logo || drep.metadata?.image || drep.metadata?.picture;

  const handleCopyDRepId = async () => {
    try {
      await navigator.clipboard.writeText(drep.drep_id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (error) {
      console.error('Failed to copy DRep ID:', error);
    }
  };

  const voteStats = useMemo(() => {
    const stats = { yes: 0, no: 0, abstain: 0 };
    votingHistory.forEach((vote) => {
      if (vote.vote) {
        stats[vote.vote]++;
      }
    });
    return stats;
  }, [votingHistory]);

  const participationRate = votingHistory.length > 0 
    ? ((votingHistory.length / (votingHistory.length + 10)) * 100).toFixed(1) 
    : '0';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/dreps" className="text-field-green hover:underline mb-4 inline-block">
          ← Back to DReps
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-6 mb-6">
                {/* Profile Picture Placeholder */}
                <div className="shrink-0">
                  {hasLogo && logoUrl ? (
                    <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-field-green/20 bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoUrl}
                        alt={`${drepName} profile picture`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          const container = e.currentTarget.parentElement;
                          if (container) {
                            container.innerHTML = `
                              <div class="w-full h-full bg-gradient-to-br from-field-green/20 to-sky-blue/20 flex items-center justify-center">
                                <svg class="w-12 h-12 text-field-green/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                            `;
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-field-green/20 to-sky-blue/20 border-2 border-field-green/30 flex items-center justify-center">
                      <User className="w-12 h-12 text-field-green/50" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl font-display font-bold text-foreground mb-2 break-words">
                    {drepName}
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={status === 'active' ? 'success' : status === 'retired' ? 'error' : 'default'}>
                      {status}
                    </Badge>
                    {drep.metadata?.name && (
                      <Badge variant="info" className="text-xs">
                        Verified Profile
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>

              {/* Show detailed CIP-119 fields if available */}
              {(drep.metadata?.objectives || drep.metadata?.motivations || drep.metadata?.qualifications) && (
                <div className="mb-6 space-y-4">
                  {drep.metadata.objectives && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Objectives</h2>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{drep.metadata.objectives}</p>
                    </div>
                  )}
                  {drep.metadata.motivations && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Motivations</h2>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{drep.metadata.motivations}</p>
                    </div>
                  )}
                  {drep.metadata.qualifications && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Qualifications</h2>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{drep.metadata.qualifications}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback to general description if CIP-119 fields not available */}
              {drep.metadata?.description && !drep.metadata?.objectives && !drep.metadata?.motivations && !drep.metadata?.qualifications && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-2">Description</h2>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{drep.metadata.description}</p>
                </div>
              )}

              {/* Contact Information */}
              {(drep.metadata?.email || drep.metadata?.website || drep.metadata?.twitter || drep.metadata?.github) && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-3">Contact Information</h2>
                  <div className="space-y-2">
                    {drep.metadata?.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <a href={`mailto:${drep.metadata.email}`} className="text-primary hover:underline">
                          {drep.metadata.email}
                        </a>
                      </div>
                    )}
                    {drep.metadata?.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={drep.metadata.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <span className="truncate">{drep.metadata.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                    {drep.metadata?.twitter && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">🐦</span>
                        <a
                          href={drep.metadata.twitter.startsWith('http') ? drep.metadata.twitter : `https://twitter.com/${drep.metadata.twitter.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {drep.metadata.twitter}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                    {drep.metadata?.github && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">💻</span>
                        <a
                          href={drep.metadata.github.startsWith('http') ? drep.metadata.github : `https://github.com/${drep.metadata.github.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {drep.metadata.github}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50 border border-border">
                  <TrendingUp className="w-5 h-5 text-field-green shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Voting Power</p>
                    <p className="text-lg font-semibold">{formatVotingPower(drep.voting_power_active || drep.voting_power)}</p>
                  </div>
                </div>
                
                {drep.registration_epoch && (
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-muted/50 border border-border">
                    <Calendar className="w-5 h-5 text-sky-blue shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Registered Epoch</p>
                      <p className="text-lg font-semibold">{drep.registration_epoch}</p>
                    </div>
                  </div>
                )}
              </div>

              {drep.anchor && (
                <div className="mb-4 p-3 rounded-md bg-muted/30 border border-border">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Anchor</p>
                  <a
                    href={drep.anchor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-2 break-all"
                  >
                    <span className="truncate">{drep.anchor.url}</span>
                    <ExternalLink className="w-4 h-4 shrink-0" />
                  </a>
                  {drep.anchor.data_hash && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                      Hash: {drep.anchor.data_hash.slice(0, 16)}...
                    </p>
                  )}
                </div>
              )}

              {drep.registration_tx_hash && (
                <div className="mt-4 p-3 rounded-md bg-muted/30 border border-border">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Registration Transaction</p>
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                    <code className="flex-1 text-sm bg-muted px-2 py-1 rounded text-foreground font-mono break-all">
                      {drep.registration_tx_hash}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(drep.registration_tx_hash || '');
                        } catch (error) {
                          console.error('Failed to copy transaction hash:', error);
                        }
                      }}
                      className="shrink-0"
                      aria-label="Copy transaction hash"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <Tabs defaultValue="votes">
                <TabsList>
                  <TabsTrigger value="votes">
                    <FileText className="w-4 h-4 mr-2" />
                    Voting History ({votingHistory.length})
                  </TabsTrigger>
                  <TabsTrigger value="delegators">
                    <Users className="w-4 h-4 mr-2" />
                    Delegators ({delegators.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="votes">
                  {votingHistory.length > 0 ? (
                    <div className="space-y-3">
                      {votingHistory.slice(0, 20).map((vote, index) => {
                        const proposalId = vote.proposal_id || vote.action_id;
                        const proposalIdShort = proposalId ? `${proposalId.slice(0, 16)}...` : 'N/A';
                        
                        return (
                          <div 
                            key={vote.tx_hash || index} 
                            className="flex items-center justify-between p-3 bg-muted/50 rounded border border-border hover:bg-muted transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Link 
                                  href={proposalId ? `/actions/${proposalId}` : '#'}
                                  className="font-medium text-sm text-foreground hover:text-primary truncate"
                                >
                                  {proposalId ? `Action ${proposalIdShort}` : 'Action N/A'}
                                </Link>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                {vote.tx_hash && (
                                  <span className="font-mono">
                                    Vote: {vote.tx_hash.slice(0, 8)}...
                                  </span>
                                )}
                                {vote.proposal_tx_hash && (
                                  <span className="font-mono">
                                    Proposal: {vote.proposal_tx_hash.slice(0, 8)}...
                                  </span>
                                )}
                                {vote.epoch && (
                                  <span>Epoch {vote.epoch}</span>
                                )}
                              </div>
                            </div>
                            <Badge 
                              variant={vote.vote === 'yes' ? 'success' : vote.vote === 'no' ? 'error' : 'warning'}
                              className="shrink-0 ml-3"
                            >
                              {vote.vote ? formatVoteCount(vote.vote) : 'Unknown'}
                            </Badge>
                          </div>
                        );
                      })}
                      {votingHistory.length > 20 && (
                        <p className="text-sm text-muted-foreground text-center pt-2">
                          Showing 20 of {votingHistory.length} votes
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No voting history available</p>
                  )}
                </TabsContent>

                <TabsContent value="delegators">
                  {delegators.length > 0 ? (
                    <div>
                      <div className="mb-4 p-3 bg-muted/30 rounded-md border border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Total Delegators</span>
                          <span className="text-lg font-bold text-foreground">{delegators.length.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-medium text-muted-foreground">Total Delegated</span>
                          <span className="text-lg font-bold text-foreground">
                            {formatVotingPower(
                              delegators.reduce((sum, d) => {
                                return (BigInt(sum) + BigInt(d.amount)).toString();
                              }, '0')
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {delegators.map((delegator, index) => (
                          <div
                            key={delegator.address || index}
                            className="flex items-center justify-between p-3 bg-muted/50 rounded border border-border hover:bg-muted transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                                <code className="text-sm font-mono text-foreground break-all">
                                  {delegator.address}
                                </code>
                              </div>
                            </div>
                            <div className="ml-4 shrink-0">
                              <span className="text-sm font-semibold text-foreground">
                                {formatVotingPower(delegator.amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No delegators found</p>
                  )}
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">DRep Information</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* DRep ID with Copy Button */}
                <div className="pb-4 border-b border-border">
                  <p className="text-sm font-medium text-muted-foreground mb-2">DRep ID</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-muted px-3 py-2 rounded text-foreground font-mono break-all">
                      {drep.drep_id}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyDRepId}
                      className="shrink-0"
                      aria-label="Copy DRep ID"
                    >
                      {copiedId ? (
                        <Check className="w-4 h-4 text-field-green" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {copiedId && (
                    <p className="text-xs text-field-green mt-1">Copied to clipboard!</p>
                  )}
                </div>
                {/* Voting Statistics */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Voting Statistics</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Votes</span>
                      <span className="font-semibold text-foreground">{votingHistory.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Participation Rate</span>
                      <span className="font-semibold text-foreground">{participationRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Vote Distribution */}
                <div className="pt-2 border-t border-border">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Vote Distribution</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Yes</span>
                      <span className="font-semibold text-green-600">{voteStats.yes}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">No</span>
                      <span className="font-semibold text-red-600">{voteStats.no}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Abstain</span>
                      <span className="font-semibold text-yellow-600">{voteStats.abstain}</span>
                    </div>
                  </div>
                </div>

                {/* DRep Status Information */}
                {(drep.active_epoch !== undefined || drep.last_active_epoch !== undefined || drep.has_script !== undefined) && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-2">DRep Status</p>
                    <div className="space-y-2">
                      {drep.active !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Active</span>
                          <Badge variant={drep.active ? 'success' : 'error'}>
                            {drep.active ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      )}
                      {drep.active_epoch !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Active Since Epoch</span>
                          <span className="font-semibold text-foreground">{drep.active_epoch}</span>
                        </div>
                      )}
                      {drep.last_active_epoch !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Last Active Epoch</span>
                          <span className="font-semibold text-foreground">{drep.last_active_epoch}</span>
                        </div>
                      )}
                      {drep.has_script !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Has Script</span>
                          <Badge variant={drep.has_script ? 'info' : 'default'}>
                            {drep.has_script ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      )}
                      {drep.retired !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Retired</span>
                          <Badge variant={drep.retired ? 'error' : 'success'}>
                            {drep.retired ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      )}
                      {drep.expired !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Expired</span>
                          <Badge variant={drep.expired ? 'error' : 'success'}>
                            {drep.expired ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Delegator Statistics */}
                {delegators && delegators.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Delegation</p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Delegators</span>
                        <span className="font-semibold text-foreground">{delegators.length.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total Delegated</span>
                        <span className="font-semibold text-foreground">
                          {formatVotingPower(
                            delegators.reduce((sum, d) => {
                              return (BigInt(sum) + BigInt(d.amount)).toString();
                            }, '0')
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Link href={`/delegate?drep=${drep.drep_id}`}>
            <Button className="w-full mt-6" size="lg">
              Delegate to this DRep
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

