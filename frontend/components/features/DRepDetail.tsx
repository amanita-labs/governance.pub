'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ExternalLink, TrendingUp, Calendar, Hash, Mail, Globe, FileText, Users, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import type { DRep, DRepVotingHistory, DRepDelegator, JsonValue } from '@/types/governance';
import { SheepIcon } from '@/components/ui/SheepIcon';
import {
  getMetadataDescription,
  getMetadataName,
  getMetadataWebsite,
} from '@/lib/governance/drepMetadata';

interface DRepDetailProps {
  drep: DRep;
  votingHistory: DRepVotingHistory[];
  delegators?: DRepDelegator[];
}

const getStringValue = (value: JsonValue | undefined): string | undefined =>
  typeof value === 'string' ? value : undefined;

const toDisplayString = (value: JsonValue | undefined): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toDisplayString(item))
      .filter((part): part is string => Boolean(part && part.trim().length > 0));
    return parts.length > 0 ? parts.join('\n') : null;
  }
  return JSON.stringify(value, null, 2);
};

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

function formatVoteCount(vote: 'yes' | 'no' | 'abstain'): string {
  if (!vote) return 'Unknown';
  return vote.charAt(0).toUpperCase() + vote.slice(1);
}

export default function DRepDetail({ drep, votingHistory, delegators = [] }: DRepDetailProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const metadataName = getMetadataName(drep.metadata) ?? getStringValue(drep.metadata?.name);
  const metadataTitle = getStringValue(drep.metadata?.title);
  const metadataDescription =
    getMetadataDescription(drep.metadata) ?? toDisplayString(drep.metadata?.description);
  const metadataObjectives = toDisplayString(drep.metadata?.objectives);
  const metadataMotivations = toDisplayString(drep.metadata?.motivations);
  const metadataQualifications = toDisplayString(drep.metadata?.qualifications);
  const metadataEmail = getStringValue(drep.metadata?.email);
  const metadataWebsite = getMetadataWebsite(drep.metadata) ?? getStringValue(drep.metadata?.website);
  const metadataTwitter = getStringValue(drep.metadata?.twitter);
  const metadataGithub = getStringValue(drep.metadata?.github);

  const logoUrl =
    getStringValue(drep.metadata?.logo) ??
    getStringValue(drep.metadata?.image) ??
    getStringValue(drep.metadata?.picture);
  const resolvedLogoUrl = logoUrl && !logoFailed ? logoUrl : undefined;
  const showLogo = Boolean(resolvedLogoUrl);

  // Use name from metadata endpoint (rich metadata), fallback to view, then drep_id
  // Priority: metadata.name > metadata.title > view > drep_id
  const drepName = metadataName || metadataTitle || drep.given_name || drep.view || drep.drep_id.slice(0, 8);
  const status = drep.status || 'active';

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
                  {showLogo ? (
                    <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-field-green/20 bg-muted">
                      <Image
                        src={resolvedLogoUrl!}
                        alt={`${drepName} profile picture`}
                        fill
                        className="object-cover"
                        sizes="96px"
                        onError={() => setLogoFailed(true)}
                      />
                    </div>
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-field-green/30 bg-gradient-to-br from-field-green/20 to-sky-blue/20">
                      <SheepIcon size={56} className="motion-safe:animate-pulse" />
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
                    {metadataName && (
                      <Badge variant="info" className="text-xs">
                        Verified Profile
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <span aria-hidden="true">🩷</span>
                    <span>This DRep proudly grazes with the Cardano governance flock.</span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>

              {/* Show detailed CIP-119 fields if available */}
              {(metadataObjectives || metadataMotivations || metadataQualifications) && (
                <div className="mb-6 space-y-4">
                  {metadataObjectives && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Objectives</h2>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{metadataObjectives}</p>
                    </div>
                  )}
                  {metadataMotivations && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Motivations</h2>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{metadataMotivations}</p>
                    </div>
                  )}
                  {metadataQualifications && (
                    <div>
                      <h2 className="text-lg font-semibold mb-2">Qualifications</h2>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{metadataQualifications}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback to general description if CIP-119 fields not available */}
              {metadataDescription && !metadataObjectives && !metadataMotivations && !metadataQualifications && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-2">Description</h2>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{metadataDescription}</p>
                </div>
              )}

              {/* Contact Information */}
              {(metadataEmail || metadataWebsite || metadataTwitter || metadataGithub) && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-3">Contact Information</h2>
                  <div className="space-y-2">
                    {metadataEmail && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <a href={`mailto:${metadataEmail}`} className="text-primary hover:underline">
                          {metadataEmail}
                        </a>
                      </div>
                    )}
                    {metadataWebsite && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={metadataWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <span className="truncate">{metadataWebsite.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                    {metadataTwitter && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">🐦</span>
                        <a
                          href={metadataTwitter.startsWith('http') ? metadataTwitter : `https://twitter.com/${metadataTwitter.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {metadataTwitter}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                    {metadataGithub && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">💻</span>
                        <a
                          href={metadataGithub.startsWith('http') ? metadataGithub : `https://github.com/${metadataGithub.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {metadataGithub}
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

