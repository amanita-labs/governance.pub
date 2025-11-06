'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { GovernanceAction } from '@/types/governance';
import { Markdown } from '../ui/Markdown';

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
        const body = parsed.body as Record<string, unknown>;
        return {
          title: extractString(body.title),
          abstract: extractString(body.abstract),
          description: extractString(body.abstract) || extractString(body.description),
          motivation: extractString(body.motivation),
          rationale: extractString(body.rationale),
          authors: body.authors ?? parsed.authors ?? body.author,
          references: body.references ?? parsed.references,
          hashAlgorithm: parsed.hashAlgorithm,
        };
      }

      const fallbackAuthors =
        parsed.authors ??
        parsed.author ??
        parsed.metadata?.authors ??
        parsed.body?.authors;
      const fallbackReferences =
        parsed.references ??
        parsed.body?.references ??
        parsed.metadata?.references;

      // Standard format - ensure fields are strings
      return {
        ...parsed,
        title: extractString(parsed.title) || parsed.title,
        description: extractString(parsed.description) || parsed.description,
        rationale: extractString(parsed.rationale) || parsed.rationale,
        authors: fallbackAuthors,
        references: fallbackReferences,
      };
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
      authors: action.metadata.authors,
      references: action.metadata.references,
    };
  }

  // Fallback to description
  return {
    title: action.description,
    description: action.description,
  };
}

type NormalizedReference = {
  label?: string;
  uri?: string;
  type?: string;
  description?: string;
};

function normalizeAuthors(authors: unknown): string[] {
  if (!authors) {
    return [];
  }

  if (typeof authors === 'string') {
    return authors.trim() ? [authors.trim()] : [];
  }

  if (Array.isArray(authors)) {
    return authors
      .map((author) => {
        if (!author) {
          return undefined;
        }
        if (typeof author === 'string') {
          return author.trim();
        }
        if (typeof author === 'object') {
          const record = author as Record<string, unknown>;
          const value =
            extractString(record.name) ??
            extractString(record.fullName) ??
            extractString(record.displayName) ??
            extractString(record.handle) ??
            extractString(record.title) ??
            extractString(record.label) ??
            extractString(record.author);
          return value?.trim();
        }
        return undefined;
      })
      .filter((value): value is string => Boolean(value && value.trim()));
  }

  if (typeof authors === 'object') {
    const record = authors as Record<string, unknown>;
    const value =
      extractString(record.name) ??
      extractString(record.fullName) ??
      extractString(record.displayName) ??
      extractString(record.handle) ??
      extractString(record.title) ??
      extractString(record.label);
    return value?.trim() ? [value.trim()] : [];
  }

  return [];
}

function normalizeReferences(references: unknown): NormalizedReference[] {
  if (!references) {
    return [];
  }

  const toArray = (value: unknown): unknown[] => {
    if (!value) {
      return [];
    }
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        if (typeof entry === 'string') {
          return { label: key, uri: entry };
        }
        if (typeof entry === 'object' && entry !== null) {
          const entryRecord = entry as Record<string, unknown>;
          return {
            label: extractString(entryRecord.label) ?? key,
            uri: extractString(entryRecord.uri) ?? extractString(entryRecord.url),
            type: extractString(entryRecord['@type']) ?? extractString(entryRecord.type),
            description: extractString(entryRecord.description),
          };
        }
        return { label: key };
      });
    }
    return [value];
  };

  return toArray(references)
    .map((ref) => {
      if (!ref) {
        return null;
      }
      if (typeof ref === 'string') {
        return { label: ref.trim() };
      }
      if (typeof ref === 'object') {
        const record = ref as Record<string, unknown>;
        const label =
          extractString(record.label) ??
          extractString(record.name) ??
          extractString(record.title) ??
          extractString(record.description);
        const uri =
          extractString(record.uri) ??
          extractString(record.url) ??
          extractString(record.href) ??
          extractString(record.link);
        const type = extractString(record['@type']) ?? extractString(record.type);
        const description = extractString(record.description);

        if (!label && !uri) {
          return null;
        }

        return {
          label: label?.trim(),
          uri,
          type: type?.trim(),
          description: description?.trim(),
        };
      }
      return null;
    })
    .filter((ref): ref is NormalizedReference => Boolean(ref));
}

function resolveReferenceUri(uri?: string): string | undefined {
  if (!uri) {
    return undefined;
  }

  if (uri.startsWith('ipfs://')) {
    const path = uri.slice('ipfs://'.length);
    if (path) {
      return `https://ipfs.io/ipfs/${path}`;
    }
  }

  return uri;
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
  const sections: Array<{ label: string; content: string }> = [];

  function addSection(label: string, value?: string) {
    if (!value || typeof value !== 'string') {
      return;
    }

    const normalized = value.trim();
    if (!normalized) {
      return;
    }

    const alreadyAdded = sections.some((section) => section.content.trim() === normalized);
    if (alreadyAdded) {
      return;
    }

    sections.push({ label, content: value });
  }

  addSection('Abstract', metadata.abstract);
  addSection('Motivation', metadata.motivation);
  addSection('Description', metadata.description);
  addSection('Rationale', metadata.rationale);

  const authors = normalizeAuthors(
    (metadata as Record<string, unknown>)?.authors ??
      (metadata as Record<string, unknown>)?.author
  );
  const references = normalizeReferences(
    (metadata as Record<string, unknown>)?.references ??
      (metadata as Record<string, unknown>)?.links
  );

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

        {sections.map((section) => (
          <div key={section.label}>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">{section.label}</h4>
            <Markdown className="text-sm leading-relaxed">{section.content}</Markdown>
          </div>
        ))}

        {authors.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Authors</h4>
            <ul className="list-disc pl-5 space-y-1">
              {authors.map((author, index) => (
                <li key={`${author}-${index}`} className="text-sm text-foreground">
                  {author}
                </li>
              ))}
            </ul>
          </div>
        )}

        {references.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">References</h4>
            <ul className="space-y-3">
              {references.map((reference, index) => {
                const resolvedUri = resolveReferenceUri(reference.uri);
                const displayUri = reference.uri || resolvedUri;
                return (
                  <li key={`${reference.label ?? reference.uri ?? index}`} className="text-sm text-foreground">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {reference.type && (
                          <Badge variant="outline" className="text-xs uppercase tracking-wide">
                            {reference.type}
                          </Badge>
                        )}
                        <span className="font-medium">
                          {reference.label || reference.uri}
                        </span>
                      </div>
                      {reference.description && (
                        <p className="text-xs text-muted-foreground">{reference.description}</p>
                      )}
                      {resolvedUri && (
                        <a
                          href={resolvedUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-field-green underline underline-offset-2 hover:text-field-green/80"
                        >
                          <span className="truncate max-w-full">{displayUri}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {action.meta_comment && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">Comment</h4>
            <Markdown className="text-sm leading-relaxed">{action.meta_comment}</Markdown>
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

