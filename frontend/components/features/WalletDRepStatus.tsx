'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge, EmojiBadge } from '@/components/ui/Badge';
import { CheckCircle2, XCircle, ExternalLink, User, AlertCircle } from 'lucide-react';
import {
  getDRepIdFromWallet,
  checkDRepRegistration,
  getDRepMetadata,
  getWalletDelegation,
  type DRepMetadataResponse,
} from '@/lib/governance/wallet-drep';
import type { DRep } from '@/types/governance';
import type { ConnectedWallet } from '@/lib/api/mesh';
import Link from 'next/link';

interface WalletDRepStatusProps {
  stakeAddress: string;
  connectedWallet?: ConnectedWallet;
}

export default function WalletDRepStatus({ stakeAddress, connectedWallet }: WalletDRepStatusProps) {
  const [loading, setLoading] = useState(true);
  const [drepId, setDrepId] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [drepInfo, setDrepInfo] = useState<DRep | null>(null);
  const [metadata, setMetadata] = useState<DRepMetadataResponse['json_metadata'] | null>(null);
  const [delegatedTo, setDelegatedTo] = useState<string | null>(null);
  const [delegatedDRepInfo, setDelegatedDRepInfo] = useState<DRep | null>(null);
  const [delegatedDRepMetadata, setDelegatedDRepMetadata] = useState<DRepMetadataResponse['json_metadata'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delegationLoading, setDelegationLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      setLoading(true);
      setError(null);

      try {
        // Get DRep ID using Mesh SDK wallet.getDRep()
        let drepIdFromWallet: string | undefined = undefined;
        if (connectedWallet && connectedWallet.wallet) {
          drepIdFromWallet = await getDRepIdFromWallet(connectedWallet.wallet);
        }
        setDrepId(drepIdFromWallet || null);

        // Check if registered as DRep
        if (drepIdFromWallet) {
          const drepData = await checkDRepRegistration(drepIdFromWallet);
          if (drepData) {
            setIsRegistered(true);
            setDrepInfo(drepData);

            // Fetch metadata if available
            const metadataData = await getDRepMetadata(drepIdFromWallet);
            if (metadataData && metadataData.json_metadata) {
              setMetadata(metadataData.json_metadata);
            }
          } else {
            setIsRegistered(false);
          }
        } else {
          setIsRegistered(false);
        }

        // Get delegation target
        setDelegationLoading(true);
        const delegation = await getWalletDelegation(stakeAddress, connectedWallet);
        if (delegation) {
          setDelegatedTo(delegation);
          
          // Fetch delegated DRep info and metadata
          const delegatedDRepData = await checkDRepRegistration(delegation);
          if (delegatedDRepData) {
            setDelegatedDRepInfo(delegatedDRepData);
            
            const delegatedMetadata = await getDRepMetadata(delegation);
            if (delegatedMetadata && delegatedMetadata.json_metadata) {
              setDelegatedDRepMetadata(delegatedMetadata.json_metadata);
            }
          }
        }
        setDelegationLoading(false);

      } catch (err) {
        console.error('Error checking wallet DRep status:', err);
        setError(err instanceof Error ? err.message : 'Failed to check DRep status');
      } finally {
        setLoading(false);
      }
    }

    if (stakeAddress) {
      checkStatus();
    }
  }, [stakeAddress, connectedWallet]);

  if (loading) {
    return (
      <Card className="mb-6 rounded-3xl border border-border/70 bg-background/85 p-6 shadow-lg">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-6 rounded-3xl border border-red-200/70 bg-red-50/70 p-6 shadow-lg dark:border-red-800/70 dark:bg-red-900/20">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Error checking DRep status</span>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
      </Card>
    );
  }

  const formattedVotingPower =
    drepInfo?.voting_power_active || drepInfo?.voting_power
      ? `${(parseInt(drepInfo.voting_power_active ?? drepInfo.voting_power ?? '0') / 1_000_000).toFixed(0)} ₳`
      : '0 ₳';
  const delegatorCountLabel =
    typeof drepInfo?.delegator_count === 'number' ? `${drepInfo.delegator_count}` : '—';

  return (
    <Card className="mb-6 rounded-2xl border border-border/60 bg-background/85 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <EmojiBadge emoji="🐏" className="text-[11px] font-semibold">
            Wallet snapshot
          </EmojiBadge>
          <span className="text-xs text-muted-foreground">Governance readiness at a glance</span>
        </div>
        {drepId && isRegistered && (
          <Link
            href={`/dreps/${drepId}`}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-xs font-medium text-primary hover:border-primary/60"
          >
            View DRep profile
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/75 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            {isRegistered ? (
              <CheckCircle2 className="h-4 w-4 text-field-green" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Registration</span>
            <Badge variant={isRegistered ? 'success' : 'secondary'}>
              {isRegistered ? 'Registered' : 'Not registered'}
            </Badge>
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-right font-medium text-foreground capitalize">
              {drepInfo?.status || (isRegistered ? 'active' : 'n/a')}
            </dd>
            <dt className="text-muted-foreground">Voting power</dt>
            <dd className="text-right font-medium text-foreground">{formattedVotingPower}</dd>
            <dt className="text-muted-foreground">Delegators</dt>
            <dd className="text-right font-medium text-foreground">{delegatorCountLabel}</dd>
            {typeof drepInfo?.vote_count === 'number' && (
              <>
                <dt className="text-muted-foreground">Votes cast</dt>
                <dd className="text-right font-medium text-foreground">{drepInfo.vote_count}</dd>
              </>
            )}
          </dl>
          {metadata?.body?.givenName && (
            <p className="mt-2 truncate text-xs text-muted-foreground">
              <User className="mr-1 inline-block h-3 w-3 align-middle text-muted-foreground" />
              <span className="align-middle font-medium text-foreground">{metadata.body.givenName}</span>
            </p>
          )}
          {!isRegistered && (
            <p className="mt-2 text-xs text-muted-foreground">
              Register via the <span className="font-medium text-foreground">Register</span> tab below.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-background/75 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <User className="h-4 w-4 text-primary" />
            <span>Delegation</span>
            {delegationLoading ? (
              <Badge variant="secondary">Loading…</Badge>
            ) : delegatedTo ? (
              <Badge variant="info">Delegated</Badge>
            ) : (
              <Badge variant="secondary">Not delegated</Badge>
            )}
          </div>
          {delegationLoading ? (
            <div className="space-y-1">
              <div className="h-2 rounded bg-muted/60" />
              <div className="h-2 rounded bg-muted/60" />
            </div>
          ) : delegatedTo ? (
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span>Delegated to</span>
                <Link
                  href={`/dreps/${delegatedTo}`}
                  className="truncate font-mono text-foreground hover:text-primary"
                  title={delegatedTo}
                >
                  {delegatedTo.slice(0, 10)}…{delegatedTo.slice(-6)}
                </Link>
              </div>
              {delegatedDRepInfo ? (
                <div className="grid grid-cols-2 gap-y-1">
                  <span>Status</span>
                  <span className="text-right text-foreground capitalize">
                    {delegatedDRepInfo.status || 'active'}
                  </span>
                  <span>Voting power</span>
                  <span className="text-right text-foreground">
                    {delegatedDRepInfo.voting_power_active
                      ? `${(parseInt(delegatedDRepInfo.voting_power_active) / 1_000_000).toFixed(0)} ₳`
                      : '0 ₳'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>Delegated DRep details unavailable</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Use the <span className="font-medium text-foreground">Delegate</span> tab to choose a DRep.
            </p>
          )}
        </div>
      </div>

      {metadata?.body?.objectives && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground">View DRep objectives</summary>
          <p className="mt-2 rounded-lg bg-background/70 p-2 leading-relaxed text-foreground">
            {metadata.body.objectives}
          </p>
        </details>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono truncate" title={stakeAddress}>
          {stakeAddress.slice(0, 22)}…{stakeAddress.slice(-6)}
        </span>
        {drepId && (
          <span className="font-mono truncate text-muted-foreground/80" title={drepId}>
            DRep ID: {drepId.slice(0, 14)}…{drepId.slice(-6)}
          </span>
        )}
      </div>
    </Card>
  );
}
