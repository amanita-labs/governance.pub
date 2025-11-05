import Link from 'next/link';
import { memo } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Clock, TrendingUp, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import type { GovernanceAction } from '@/types/governance';

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
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Extract string from value (handles both string and object formats)
 */
function extractString(value: any): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    // Try to extract string from object structures
    return value.content || value.text || value.value || value.description || String(value);
  }
  return undefined;
}

/**
 * Get metadata title from action (ensures it's always a string)
 */
function getMetadataTitle(action: GovernanceAction): string {
  // Try meta_json first (handle CIP-100/CIP-108 format)
  if (action.meta_json) {
    try {
      const parsed = typeof action.meta_json === 'string' 
        ? JSON.parse(action.meta_json) 
        : action.meta_json;
      
      // Check for CIP-100/CIP-108 format with body structure
      if (parsed.body && typeof parsed.body === 'object') {
        const title = extractString(parsed.body.title);
        if (title) return title;
        // Fallback to abstract if title not available
        const abstract = extractString(parsed.body.abstract);
        if (abstract) return abstract;
      } else {
        // Standard format
        const title = extractString(parsed.title);
        if (title) return title;
      }
    } catch (e) {
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
  return `Action ${action.action_id.slice(0, 8)}`;
}

/**
 * Get metadata description from action (ensures it's always a string or undefined)
 */
function getMetadataDescription(action: GovernanceAction): string | undefined {
  // Try meta_json first (handle CIP-100/CIP-108 format)
  if (action.meta_json) {
    try {
      const parsed = typeof action.meta_json === 'string' 
        ? JSON.parse(action.meta_json) 
        : action.meta_json;
      
      // Check for CIP-100/CIP-108 format with body structure
      if (parsed.body && typeof parsed.body === 'object') {
        const abstract = extractString(parsed.body.abstract);
        if (abstract) return abstract;
        const description = extractString(parsed.body.description);
        if (description) return description;
        const rationale = extractString(parsed.body.rationale);
        if (rationale) return rationale;
      } else {
        // Standard format
        const description = extractString(parsed.description);
        if (description) return description;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  
  // Try metadata field (already normalized from CIP-100/CIP-108 if applicable)
  if (action.metadata) {
    const abstract = extractString(action.metadata.abstract);
    if (abstract) return abstract;
    const description = extractString(action.metadata.description);
    if (description) return description;
    const rationale = extractString(action.metadata.rationale);
    if (rationale) return rationale;
  }
  
  // Fallback to description (ensure it's a string)
  return extractString(action.description);
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
 * Format relative time from block_time
 */
function formatRelativeTime(blockTime?: number): string | null {
  if (!blockTime) return null;
  
  const now = Date.now() / 1000; // Current time in seconds
  const diff = now - blockTime; // Difference in seconds
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function ActionCard({ action, showProgress = false }: ActionCardProps) {
  const status = action.status || 'submitted';
  const title = getMetadataTitle(action);
  const description = getMetadataDescription(action);
  
  // Note: Voting results are expensive to fetch, so we skip showing progress in cards
  // Progress will be shown in detail page instead where it's more appropriate

  return (
    <Link href={`/actions/${action.action_id}`} className="block h-full">
      <Card className="h-full cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground line-clamp-2">
              {title}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{formatActionType(action.type)}</Badge>
              <Badge variant={getStatusVariant(status)} className="flex items-center gap-1">
                {getStatusIcon(status)}
                <span>{status}</span>
              </Badge>
              {action.meta_json || action.metadata ? (
                <Badge variant="outline" className="text-xs">Has Metadata</Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {description}
            </p>
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
          {(action.voting_epoch || action.enactment_epoch || action.proposed_epoch) && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {action.proposed_epoch && (
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Proposed</p>
                  <p className="font-semibold text-foreground">Epoch {action.proposed_epoch}</p>
                  {action.block_time && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(action.block_time)}
                    </p>
                  )}
                </div>
              )}
              {action.voting_epoch && !action.proposed_epoch && (
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Voting Epoch</p>
                  <p className="font-semibold text-foreground">{action.voting_epoch}</p>
                </div>
              )}
              {action.enactment_epoch && (
                <div className="p-2 rounded-md bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Enactment Epoch</p>
                  <p className="font-semibold text-foreground">{action.enactment_epoch}</p>
                </div>
              )}
            </div>
          )}

          {/* Expiry Countdown */}
          {action.expiration && action.status === 'voting' && (
            <div className="p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Expires at Epoch {action.expiration}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export default memo(ActionCard);


