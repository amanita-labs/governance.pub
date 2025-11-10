'use client';

import Link from 'next/link';
import { memo, useCallback, type KeyboardEvent, type ElementType } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  DollarSign,
  Copy,
  AlertTriangle,
  HelpCircle,
  Vote,
} from 'lucide-react';
import type { GovernanceAction, MetadataCheckResult } from '@/types/governance';
import { Markdown } from '../ui/Markdown';
import { useRouter } from 'next/navigation';
import { getActionDescription, getActionDisplayType, getActionTitle } from '@/lib/governance';

interface ActionCardProps {
  action: GovernanceAction;
  showProgress?: boolean;
}

function getStatusIcon(status: string | undefined) {
  switch (status) {
    case 'enacted':
      return <CheckCircle className="w-4 h-4" />;
    case 'rejected':
    case 'expired':
      return <XCircle className="w-4 h-4" />;
    case 'voting':
      return <Clock className="w-4 h-4" />;
    default:
      return <TrendingUp className="w-4 h-4" />;
  }
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

function formatActionType(type: string | undefined): string {
  if (!type || typeof type !== 'string') {
    return 'Unknown';
  }
  if (type === 'budget') {
    return 'Budget Action💰';
  }
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getPreviewMarkdown(content?: string | null): string | undefined {
  if (!content) {
    return undefined;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return undefined;
  }

  const paragraphChunks = trimmed.split(/\n\s*\n+/).slice(0, 1);
  const lineLimited = paragraphChunks
    .join('\n\n')
    .split('\n')
    .slice(0, 5)
    .join('\n');

  if (lineLimited.length <= 400) {
    return lineLimited;
  }

  return `${lineLimited.slice(0, 397).trimEnd()}…`;
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

type MetadataBadge = {
  label: string;
  variant: 'success' | 'error' | 'info' | 'outline';
  icon: ElementType;
  message?: string;
};

function summarizeMetadataStatus(checks?: MetadataCheckResult): MetadataBadge | null {
  if (!checks) {
    return null;
  }

  const hashStatus = checks.hash.status;
  const ipfsStatus = checks.ipfs.status;

  if (hashStatus === 'fail' || ipfsStatus === 'fail') {
    const failingOutcome = hashStatus === 'fail' ? checks.hash : checks.ipfs;
    return {
      label: 'Metadata issue',
      variant: 'error',
      icon: AlertTriangle,
      message: failingOutcome.message,
    };
  }

  if (hashStatus === 'pass' && ipfsStatus === 'pass') {
    return {
      label: 'Metadata Valid',
      variant: 'success',
      icon: CheckCircle,
      message: checks.hash.message,
    };
  }

  if (hashStatus === 'unknown' && ipfsStatus === 'unknown') {
    return {
      label: 'No metadata',
      variant: 'outline',
      icon: HelpCircle,
      message: checks.hash.message ?? checks.ipfs.message,
    };
  }

  return {
    label: 'Metadata pending',
    variant: 'info',
    icon: Clock,
    message: checks.hash.message ?? checks.ipfs.message ?? checks.author_witness.message,
  };
}

function ActionCard({ action }: ActionCardProps) {
  const status = action.status || 'submitted';
  const title = getActionTitle(action);
  const description = getActionDescription(action);
  const previewDescription = getPreviewMarkdown(description);
  const router = useRouter();
  const actionUrl = `/actions/${action.action_id}`;
  const displayActionId = action.action_id;
  const metadataBadge = summarizeMetadataStatus(action.metadata_checks);
  const hasMetadata = Boolean(action.meta_json || action.metadata);
  const displayType = getActionDisplayType(action);

  const handleNavigate = useCallback(() => {
    router.push(actionUrl);
  }, [router, actionUrl]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleNavigate();
      }
    },
    [handleNavigate]
  );
  
  // Note: Voting results are expensive to fetch, so we skip showing progress in cards
  // Progress will be shown in detail page instead where it's more appropriate

  return (
    <Card
      role="link"
      tabIndex={0}
      aria-label={`View details for ${title}`}
      onClick={(event) => {
        if (event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey) {
          window.open(actionUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        handleNavigate();
      }}
      onAuxClick={(event) => {
        if (event.button === 1) {
          window.open(actionUrl, '_blank', 'noopener,noreferrer');
        }
      }}
      onKeyDown={handleKeyDown}
      className="group h-full cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <Link
            href={actionUrl}
            onClick={(event) => event.stopPropagation()}
            className="text-lg font-semibold text-foreground line-clamp-2 hover:underline"
          >
            {title}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{formatActionType(displayType)}</Badge>
            <Badge variant={getStatusVariant(status)} className="flex items-center gap-1">
              {getStatusIcon(status)}
              <span>{status}</span>
            </Badge>
             {metadataBadge
               ? (() => {
                   const Icon = metadataBadge.icon;
                   return (
                     <Badge
                       variant={metadataBadge.variant}
                       className="flex items-center gap-1 text-xs"
                       title={metadataBadge.message}
                     >
                       <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                       <span>{metadataBadge.label}</span>
                     </Badge>
                   );
                 })()
               : hasMetadata && (
                   <Badge variant="outline" className="text-xs flex items-center gap-1">
                     <span aria-hidden="true">🐑</span>
                     <span>Has metadata</span>
                   </Badge>
                 )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {previewDescription && (
          <Markdown
            className="text-muted-foreground text-sm [&_*]:text-sm [&_p]:line-clamp-3 [&_ul]:line-clamp-3 [&_ol]:line-clamp-3 [&_blockquote]:line-clamp-3 overflow-hidden"
          >
            {previewDescription}
          </Markdown>
        )}

        {/* Treasury Withdrawal */}
        {action.withdrawal && action.withdrawal.amount && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
            <DollarSign className="w-4 h-4 text-field-green" />
            <div>
              <p className="text-xs text-muted-foreground">Treasury Withdrawal</p>
              <p className="text-sm font-semibold text-foreground">
                {formatTreasuryAmount(action.withdrawal.amount)}
              </p>
            </div>
          </div>
        )}

        {/* Epoch Information */}
        <div className="p-3 rounded-md bg-muted/50 flex items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted-foreground break-all">
            {displayActionId}
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              navigator.clipboard.writeText(action.action_id).catch((error) => {
                console.error('Failed to copy action ID:', error);
              });
            }}
            className="p-1 rounded-md text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Copy governance action ID"
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Expiry Countdown */}
        {action.expiration && action.status === 'voting' && (
          <div className="p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              Expires at Epoch {action.expiration}
            </p>
          </div>
        )}

        {/* Vote Now Button for voting proposals */}
        {(status === 'voting' || status === 'submitted') && (
          <Button
            onClick={(event) => {
              event.stopPropagation();
              router.push(`/vote-now?proposal=${action.action_id}`);
            }}
            className="w-full flex items-center justify-center gap-2"
            size="sm"
          >
            <Vote className="w-4 h-4" />
            Vote Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default memo(ActionCard);


