import Link from 'next/link';
import { memo, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Users, TrendingUp, ExternalLink, Vote, Shield } from 'lucide-react';
import type { DRep, DRepExternalReference, DRepMetadata } from '@/types/governance';
import { isSpecialSystemDRep } from '@/lib/governance/drep-id';
import { getSystemDRepInfo } from '@/lib/governance';
import { cn } from '@/lib/utils';
import {
  sanitizeMetadataValue,
  getMetadataName,
  getMetadataDescription,
  getMetadataWebsite,
} from '@/lib/governance/drepMetadata';

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

const selectWebsite = (metadataWebsite: string | undefined, links?: DRepExternalReference[]) => {
  if (metadataWebsite && metadataWebsite.trim().length > 0) {
    return metadataWebsite;
  }

  if (!links?.length) {
    return undefined;
  }

  const preferred = links.find((ref) => {
    const label = ref.label?.toLowerCase() ?? '';
    return label.includes('website') || label.includes('site');
  });

  const fallback = links.find((ref) => ref.uri && ref.uri.startsWith('http'));
  return preferred?.uri ?? fallback?.uri;
};

function DRepCard({ drep }: DRepCardProps) {
  const isSystemDRep = isSpecialSystemDRep(drep.drep_id);
  const systemDRepInfo = isSystemDRep ? getSystemDRepInfo(drep.drep_id) : null;

  const normalizedMetadata = useMemo(() => {
    if (!drep.metadata) {
      return null;
    }
    const sanitized = sanitizeMetadataValue(drep.metadata);
    return sanitized ?? (drep.metadata as DRepMetadata);
  }, [drep.metadata]);

  const website = useMemo(
    () => selectWebsite(getMetadataWebsite(normalizedMetadata), drep.link_references),
    [drep.link_references, normalizedMetadata]
  );

  const metadataDescription =
    getMetadataDescription(normalizedMetadata) || drep.objectives || drep.motivations || drep.qualifications;

  const metadataName =
    getMetadataName(normalizedMetadata) || drep.given_name || drep.view;

  const derivedDescription = systemDRepInfo?.description || metadataDescription;

  const drepName =
    systemDRepInfo?.name ||
    metadataName ||
    drep.given_name ||
    drep.drep_id.slice(0, 8);

  const showDrepId =
    !isSystemDRep &&
    Boolean(metadataName || drep.given_name || drep.view);

  const status = drep.status || (drep.active === false ? 'inactive' : drep.retired ? 'retired' : 'active');

  const hasProfile =
    drep.has_profile ??
    Boolean(
      metadataName ||
        metadataDescription ||
        getMetadataWebsite(normalizedMetadata) ||
        drep.given_name ||
        drep.objectives ||
        drep.motivations ||
        drep.qualifications ||
        website
    );

  const votingPower = formatVotingPower(drep.amount || drep.voting_power_active || drep.voting_power);
  const delegatorCount = drep.delegator_count;
  const voteCount = drep.vote_count;

  const handleWebsiteClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (website) {
        try {
          if (typeof window !== 'undefined') {
            window.open(website, '_blank', 'noopener,noreferrer');
          }
        } catch (error) {
          console.error('Failed to open DRep website', error);
        }
      }
    },
    [website]
  );

  return (
    <Link href={`/dreps/${drep.drep_id}`} className="block h-full">
      <Card
        className={cn(
          'h-full cursor-pointer border-2 transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover',
          isSystemDRep
            ? 'border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-purple-600/5 hover:border-purple-500/50'
            : 'hover:border-field-green/50'
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                {isSystemDRep && systemDRepInfo?.icon && (
                  <span className="shrink-0 text-xl" aria-hidden="true">
                    {systemDRepInfo.icon}
                  </span>
                )}
                <h3 className="truncate text-lg font-semibold text-foreground">{drepName}</h3>
                {isSystemDRep && (
                  <Badge
                    variant="info"
                    className="shrink-0 bg-purple-500/20 text-xs text-purple-300"
                  >
                    <Shield className="mr-1 h-3 w-3" />
                    System
                  </Badge>
                )}
                {hasProfile && !isSystemDRep && (
                  <Badge variant="info" className="shrink-0 text-xs">
                    Profile
                  </Badge>
                )}
              </div>
              {showDrepId && (
                <p className="mb-1 font-mono text-xs text-muted-foreground">{drep.drep_id.slice(0, 8)}...</p>
              )}
              {derivedDescription && (
                <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{derivedDescription}</p>
              )}
              <div className="flex items-center gap-2">
                <Badge
                  variant={status === 'active' ? 'success' : status === 'retired' ? 'error' : 'default'}
                  className="shrink-0 capitalize"
                >
                  {status}
                </Badge>
                {drep.last_vote_epoch && (
                  <span className="text-xs text-muted-foreground">Last vote: Epoch {drep.last_vote_epoch}</span>
                )}
                {drep.votes_last_year !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    Votes (12M): {drep.votes_last_year.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2.5">
              <div className="shrink-0 rounded-md bg-field-green/10 p-1.5">
                <TrendingUp className="h-4 w-4 text-field-green" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Power</p>
                <p className="truncate text-sm font-semibold text-foreground">{votingPower}</p>
              </div>
            </div>

            {delegatorCount !== undefined && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2.5">
                <div className="shrink-0 rounded-md bg-sky-blue/10 p-1.5">
                  <Users className="h-4 w-4 text-sky-blue" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Delegators</p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {formatNumber(delegatorCount)}
                  </p>
                </div>
              </div>
            )}

            {voteCount !== undefined && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2.5">
                <div className="shrink-0 rounded-md bg-field-dark/10 p-1.5">
                  <Vote className="h-4 w-4 text-field-dark" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Votes</p>
                  <p className="truncate text-sm font-semibold text-foreground">{formatNumber(voteCount)}</p>
                </div>
              </div>
            )}

            {website && (
              <div className="col-span-2 flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2.5 sm:col-span-3">
                <div className="shrink-0 rounded-md bg-primary/10 p-1.5">
                  <ExternalLink className="h-4 w-4 text-primary" />
                </div>
                <button
                  type="button"
                  onClick={handleWebsiteClick}
                  className="flex flex-1 items-center gap-1 truncate text-left text-sm font-medium text-primary hover:underline"
                >
                  <span className="truncate">{website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
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

