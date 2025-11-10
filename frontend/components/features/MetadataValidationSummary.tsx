'use client';

import type { ElementType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { MetadataCheckResult, MetadataCheckOutcome } from '@/types/governance';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'outline';
type ValidationKey = 'hash' | 'ipfs' | 'author_witness' | 'on_chain';

const statusConfig: Record<
  MetadataCheckOutcome['status'],
  { label: string; icon: ElementType; variant: BadgeVariant }
> = {
  pass: { label: 'Pass', icon: CheckCircle, variant: 'success' },
  fail: { label: 'Fail', icon: XCircle, variant: 'error' },
  warning: { label: 'Warning', icon: AlertTriangle, variant: 'warning' },
  pending: { label: 'Pending', icon: Clock, variant: 'info' },
  unknown: { label: 'Unknown', icon: HelpCircle, variant: 'outline' },
};

const summaryOrder: Array<{
  key: ValidationKey;
  title: string;
  description: string;
}> = [
  {
    key: 'hash',
    title: 'Hash Check',
    description: 'Verifies metadata content matches on-chain anchor hash.',
  },
  {
    key: 'ipfs',
    title: 'Hosting Check',
    description: 'Confirms metadata anchor uses the ipfs:// scheme.',
  },
  {
    key: 'author_witness',
    title: 'Author Witness',
    description: 'Validates the correctness of author signatures.',
  },
  {
    key: 'on_chain',
    title: 'CIP-169 - On-chain Metadata',
    description: 'Checks for the governance metadata “onChain” extension.',
  },
];

interface MetadataValidationSummaryProps {
  checks?: MetadataCheckResult;
  metaUrl?: string | null;
}

export function MetadataValidationSummary({ checks, metaUrl }: MetadataValidationSummaryProps) {
  if (!checks) {
    return null;
  }

  const authorStatus = checks.author_witness?.status ?? 'unknown';
  const showVerifierFootnote = ['pass', 'fail', 'warning'].includes(authorStatus);

  return (
    <Card className="border-dashed border-field-green/40">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-lg">Metadata Validation</CardTitle>
          {checks.resolved_url && checks.resolved_url !== metaUrl ? (
            <Badge
              variant="info"
              className="flex items-center gap-1"
              title="Metadata fetched from IPFS gateway"
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Gateway Redirect
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {summaryOrder.map(({ key, title, description }) => {
            const outcome = checks[key] as MetadataCheckOutcome;
            const config = statusConfig[outcome.status];
            const Icon = config.icon;

            return (
              <div
                key={key}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  outcome.status === 'fail' && 'border-destructive/40 bg-destructive/5',
                  outcome.status === 'pass' && 'border-green-500/40 bg-green-500/5',
                  outcome.status === 'pending' && 'border-blue-500/30 bg-blue-500/5'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="font-medium text-sm">{title}</span>
                  </div>
                  <Badge variant={config.variant} className="min-w-[80px] justify-center">
                    {config.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
                {outcome.message && (
                  <p className="mt-2 text-xs text-foreground">{outcome.message}</p>
                )}
              </div>
            );
          })}
        </div>

        {checks.notes && checks.notes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
              {checks.notes.map((note, index) => (
                <li key={`${note}-${index}`}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

