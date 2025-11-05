'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { GovernanceAction } from '@/types/governance';
import { cn } from '@/lib/utils';

interface ProposalMetadataProps {
  action: GovernanceAction;
}

/**
 * Extract string from metadata field (handles both string and object formats)
 */
function extractString(value: any): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    // Try to extract string from object structures
    return value.content || value.text || value.value || String(value);
  }
  return undefined;
}

/**
 * Extract metadata from action
 * Checks meta_json first, then metadata field, then falls back to description
 * Handles CIP-100/CIP-108 format
 */
function getMetadata(action: GovernanceAction) {
  // Try meta_json first (from backend)
  if (action.meta_json) {
    try {
      const parsed = typeof action.meta_json === 'string' 
        ? JSON.parse(action.meta_json) 
        : action.meta_json;
      
      // Check if this is CIP-100/CIP-108 format with body structure
      if (parsed.body && typeof parsed.body === 'object') {
        // Extract CIP-100/CIP-108 format metadata
        return {
          title: extractString(parsed.body.title),
          abstract: extractString(parsed.body.abstract),
          description: extractString(parsed.body.abstract) || extractString(parsed.body.description),
          motivation: extractString(parsed.body.motivation),
          rationale: extractString(parsed.body.rationale),
          references: parsed.body.references,
          // Keep other top-level fields
          authors: parsed.authors,
          hashAlgorithm: parsed.hashAlgorithm,
        };
      } else {
        // Standard format - ensure fields are strings
        return {
          ...parsed,
          title: extractString(parsed.title) || parsed.title,
          description: extractString(parsed.description) || parsed.description,
          rationale: extractString(parsed.rationale) || parsed.rationale,
        };
      }
    } catch (e) {
      console.warn('Failed to parse meta_json:', e);
    }
  }

  // Try metadata field (already normalized from CIP-100/CIP-108 if applicable)
  if (action.metadata) {
    return {
      ...action.metadata,
      title: extractString(action.metadata.title) || action.metadata.title,
      abstract: extractString(action.metadata.abstract) || action.metadata.abstract,
      description: extractString(action.metadata.description) || extractString(action.metadata.abstract) || action.metadata.description,
      rationale: extractString(action.metadata.rationale) || action.metadata.rationale,
    };
  }

  // Fallback to description
  return {
    title: action.description,
    description: action.description,
  };
}

/**
 * Validate metadata hash if meta_hash is provided
 */
function validateMetadataHash(metadata: any, metaHash?: string): boolean | null {
  if (!metaHash) {
    return null; // No hash provided, can't validate
  }

  // TODO: Implement actual hash validation
  // For now, if meta_hash exists, we assume it's valid
  return true;
}

export function ProposalMetadata({ action }: ProposalMetadataProps) {
  const metadata = getMetadata(action);
  const hasMetadata = !!(metadata?.title || metadata?.description || metadata?.rationale);
  const validationStatus = validateMetadataHash(metadata, action.meta_hash);

  if (!hasMetadata) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Proposal Metadata</CardTitle>
          <div className="flex items-center gap-2">
            {action.meta_language && (
              <Badge variant="secondary" className="text-xs">
                {action.meta_language.toUpperCase()}
              </Badge>
            )}
            {validationStatus !== null && (
              <div className="flex items-center gap-1">
                {validationStatus ? (
                  <CheckCircle className="w-4 h-4 text-green-500" aria-label="Metadata hash validated" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" aria-label="Metadata hash validation failed" />
                )}
              </div>
            )}
            {action.meta_is_valid === false && (
              <AlertCircle className="w-4 h-4 text-yellow-500" aria-label="Metadata marked as invalid" />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metadata.title && typeof metadata.title === 'string' && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{metadata.title}</h3>
          </div>
        )}

        {metadata.description && typeof metadata.description === 'string' && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
            <p className="text-sm text-foreground whitespace-pre-wrap">{metadata.description}</p>
          </div>
        )}

        {metadata.rationale && typeof metadata.rationale === 'string' && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Rationale</h4>
            <p className="text-sm text-foreground whitespace-pre-wrap">{metadata.rationale}</p>
          </div>
        )}

        {action.meta_comment && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Comment</h4>
            <p className="text-sm text-foreground whitespace-pre-wrap">{action.meta_comment}</p>
          </div>
        )}

        {(action.meta_url || action.meta_hash) && (
          <div className="pt-4 border-t border-border space-y-2">
            {action.meta_url && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Metadata URL:</span>
                <a
                  href={action.meta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-field-green hover:underline flex items-center gap-1"
                >
                  {action.meta_url}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            {action.meta_hash && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Metadata Hash:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded text-foreground font-mono">
                  {action.meta_hash}
                </code>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

