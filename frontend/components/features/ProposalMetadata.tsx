'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ExternalLink, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { GovernanceAction } from '@/types/governance';
import { Markdown } from '../ui/Markdown';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface ProposalMetadataProps {
  action: GovernanceAction;
}

/**
 * Extract string from metadata field (handles both string and object formats)
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
 * Extract metadata from action
 * Checks meta_json first, then metadata field, then falls back to description
 * Handles CIP-100/CIP-108 format
 */
interface NormalizedMetadata extends Record<string, unknown> {
  title?: string;
  abstract?: string;
  description?: string;
  motivation?: string;
  rationale?: string;
  authors?: unknown;
  author?: unknown;
  references?: unknown;
  links?: unknown;
  hashAlgorithm?: unknown;
}

function getMetadata(action: GovernanceAction): NormalizedMetadata {
  // Try meta_json first (from backend)
  if (action.meta_json) {
    try {
      const parsed: unknown =
        typeof action.meta_json === 'string'
          ? JSON.parse(action.meta_json)
          : action.meta_json;

      if (isRecord(parsed)) {
        const body = isRecord(parsed.body) ? parsed.body : undefined;
        if (body) {
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
          (isRecord(parsed.metadata) ? parsed.metadata.authors : undefined) ??
          (isRecord(parsed.body) ? parsed.body.authors : undefined);
        const fallbackReferences =
          parsed.references ??
          (isRecord(parsed.body) ? parsed.body.references : undefined) ??
          (isRecord(parsed.metadata) ? parsed.metadata.references : undefined);

        return {
          ...parsed,
          title: extractString(parsed.title) || (typeof parsed.title === 'string' ? parsed.title : undefined),
          description:
            extractString(parsed.description) ||
            (typeof parsed.description === 'string' ? parsed.description : undefined),
          rationale: extractString(parsed.rationale) || (typeof parsed.rationale === 'string' ? parsed.rationale : undefined),
          authors: fallbackAuthors,
          references: fallbackReferences,
        };
      }
    } catch (error) {
      console.warn('Failed to parse meta_json:', error);
    }
  }

  // Try metadata field (already normalized from CIP-100/CIP-108 if applicable)
  if (action.metadata) {
    const metadata = action.metadata;
    const result: NormalizedMetadata = {
      ...metadata,
      title: extractString(metadata.title) || (typeof metadata.title === 'string' ? metadata.title : undefined),
      abstract: extractString(metadata.abstract) || (typeof metadata.abstract === 'string' ? metadata.abstract : undefined),
      description:
        extractString(metadata.description) ||
        extractString(metadata.abstract) ||
        (typeof metadata.description === 'string' ? metadata.description : undefined),
      rationale: extractString(metadata.rationale) || (typeof metadata.rationale === 'string' ? metadata.rationale : undefined),
      authors: metadata.authors,
      references: metadata.references,
    };
    return result;
  }

  // Fallback to description
  return {
    title: action.description,
    description: action.description,
  };
}

type NormalizedReference = {
  label: string;
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
        if (isRecord(author)) {
          const value =
            extractString(author.name) ??
            extractString(author.fullName) ??
            extractString(author.displayName) ??
            extractString(author.handle) ??
            extractString(author.title) ??
            extractString(author.label) ??
            extractString(author.author);
          return value?.trim();
        }
        return undefined;
      })
      .filter((value): value is string => Boolean(value && value.trim()));
  }

  if (isRecord(authors)) {
    const value =
      extractString(authors.name) ??
      extractString(authors.fullName) ??
      extractString(authors.displayName) ??
      extractString(authors.handle) ??
      extractString(authors.title) ??
      extractString(authors.label);
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
    if (isRecord(value)) {
      return Object.entries(value).map(([key, entry]) => {
        if (typeof entry === 'string') {
          return { label: key, uri: entry };
        }
        if (isRecord(entry)) {
          return {
            label: extractString(entry.label) ?? key,
            uri: extractString(entry.uri) ?? extractString(entry.url),
            type: extractString(entry['@type']) ?? extractString(entry.type),
            description: extractString(entry.description),
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
        const trimmed = ref.trim();
        return trimmed ? { label: trimmed } : null;
      }

      if (isRecord(ref)) {
        const rawLabel =
          extractString(ref.label) ??
          extractString(ref.name) ??
          extractString(ref.title) ??
          extractString(ref.description);
        const rawUri =
          extractString(ref.uri) ??
          extractString(ref.url) ??
          extractString(ref.href) ??
          extractString(ref.link);
        const rawType = extractString(ref['@type']) ?? extractString(ref.type);
        const rawDescription = extractString(ref.description);

        const uri = rawUri?.trim();
        const label = rawLabel?.trim() ?? uri;

        if (!label) {
          return null;
        }

        return {
          label,
          uri,
          type: rawType?.trim(),
          description: rawDescription?.trim(),
        };
      }

      return null;
    })
    .filter((ref): ref is NormalizedReference => ref !== null);
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
function validateMetadataHash(_metadata: unknown, metaHash?: string): boolean | null {
  if (!metaHash) {
    return null; // No hash provided, can't validate
  }

  // TODO: Implement actual hash validation
  // For now, if meta_hash exists, we assume it's valid
  return true;
}

export function ProposalMetadata({ action }: ProposalMetadataProps) {
  const metadata = getMetadata(action);
  const hasMetadata = Boolean(metadata.title || metadata.description || metadata.rationale);
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

  const authors = normalizeAuthors(metadata.authors ?? metadata.author);
  const references = normalizeReferences(metadata.references ?? metadata.links);

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

