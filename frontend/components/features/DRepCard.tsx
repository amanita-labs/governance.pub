import Link from 'next/link';
import { memo, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Users, TrendingUp, ExternalLink, Vote, Shield } from 'lucide-react';
import type { DRep } from '@/types/governance';
import { isSpecialSystemDRep } from '@/lib/governance/drep-id';
import { getSystemDRepInfo } from '@/lib/governance';
import { cn } from '@/lib/utils';

interface DRepCardProps {
  drep: DRep;
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

function formatNumber(num: number | undefined): string {
  if (!num) return '0';
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function DRepCard({ drep }: DRepCardProps) {
  const isSystemDRep = isSpecialSystemDRep(drep.drep_id);
  const systemDRepInfo = isSystemDRep ? getSystemDRepInfo(drep.drep_id) : null;
  
  // Use name from metadata (priority: metadata.name > metadata.title > view > drep_id)
  // For system DReps, use their friendly name
  const drepName = systemDRepInfo?.name ||
                   drep.metadata?.name || 
                   drep.metadata?.title || 
                   drep.view || 
                   drep.drep_id.slice(0, 8);
  const showDrepId = !!(drep.metadata?.name || drep.metadata?.title || drep.view) && !isSystemDRep;
  const status = drep.status || (drep.active === false ? 'inactive' : drep.retired ? 'retired' : 'active');
  const hasProfile = !!(drep.metadata?.name || drep.metadata?.description || drep.metadata?.website);
  // Use amount field if available (from DRep endpoint), otherwise fallback to voting_power
  const votingPower = formatVotingPower(drep.amount || drep.voting_power_active || drep.voting_power);
  const delegatorCount = drep.delegator_count;
  const voteCount = drep.vote_count;

  const handleWebsiteClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (drep.metadata?.website) {
        try {
          if (typeof window !== 'undefined') {
            window.open(drep.metadata.website, '_blank', 'noopener,noreferrer');
          }
        } catch (error) {
          console.error('Failed to open DRep website', error);
        }
      }
    },
    [drep.metadata?.website]
  );

  return (
    <Link href={`/dreps/${drep.drep_id}`} className="block h-full">
      <Card className={cn(
        "h-full cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border-2",
        isSystemDRep 
          ? "border-purple-500/30 hover:border-purple-500/50 bg-gradient-to-br from-purple-500/5 to-purple-600/5" 
          : "hover:border-field-green/50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {isSystemDRep && systemDRepInfo?.icon && (
                  <span className="text-xl shrink-0">{systemDRepInfo.icon}</span>
                )}
                <h3 className="text-lg font-semibold text-foreground truncate">
                  {drepName}
                </h3>
                {isSystemDRep && (
                  <Badge variant="info" className="text-xs shrink-0 bg-purple-500/20 text-purple-300 border-purple-500/30">
                    <Shield className="w-3 h-3 mr-1" />
                    System
                  </Badge>
                )}
                {hasProfile && !isSystemDRep && (
                  <Badge variant="info" className="text-xs shrink-0">
                    Profile
                  </Badge>
                )}
              </div>
              {showDrepId && (
                <p className="text-xs text-muted-foreground mb-1 font-mono">
                  {drep.drep_id.slice(0, 8)}...
                </p>
              )}
              {(systemDRepInfo?.description || drep.metadata?.description) && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {systemDRepInfo?.description || drep.metadata?.description}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Badge 
                  variant={status === 'active' ? 'success' : status === 'retired' ? 'error' : 'default'}
                  className="shrink-0"
                >
                  {status}
                </Badge>
                {drep.last_vote_epoch && (
                  <span className="text-xs text-muted-foreground">
                    Last vote: Epoch {drep.last_vote_epoch}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border border-border">
              <div className="p-1.5 rounded-md bg-field-green/10 shrink-0">
                <TrendingUp className="w-4 h-4 text-field-green" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Power</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {votingPower}
                </p>
              </div>
            </div>
            
            {delegatorCount !== undefined && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border border-border">
                <div className="p-1.5 rounded-md bg-sky-blue/10 shrink-0">
                  <Users className="w-4 h-4 text-sky-blue" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Delegators</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {formatNumber(delegatorCount)}
                  </p>
                </div>
              </div>
            )}
            
            {voteCount !== undefined && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border border-border">
                <div className="p-1.5 rounded-md bg-field-dark/10 shrink-0">
                  <Vote className="w-4 h-4 text-field-dark" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Votes</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {formatNumber(voteCount)}
                  </p>
                </div>
              </div>
            )}
            
            {drep.metadata?.website && (
              <div className="col-span-2 sm:col-span-3 flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border border-border">
                <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                  <ExternalLink className="w-4 h-4 text-primary" />
                </div>
                <button
                  type="button"
                  onClick={handleWebsiteClick}
                  className="text-sm font-medium text-primary hover:underline flex items-center gap-1 truncate flex-1 text-left"
                >
                  <span className="truncate">{drep.metadata.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default memo(DRepCard);

