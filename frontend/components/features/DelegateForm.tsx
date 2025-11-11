'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, EmojiBadge } from '../ui/Badge';
import { TransactionModal } from './TransactionModal';
import { useWalletContext } from '../layout/WalletProvider';
import { useTransaction } from '@/hooks/useTransaction';
import { submitDelegationTransaction } from '@/lib/governance/transactions/delegate';
import { Search } from 'lucide-react';
import type { DRep } from '@/types/governance';
import {
  getMetadataName,
  getMetadataDescription,
  getMetadataPaymentAddress,
} from '@/lib/governance/drepMetadata';

interface DelegateFormProps {
  dreps: DRep[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  onSearch?: (query: string) => void;
}

const DONATION_PRESET_PERCENTAGES = [1, 5, 10] as const;
const DEFAULT_DONATION_PERCENTAGE = 10;
const DONATION_SLIDER_MIN = 0;
const DONATION_SLIDER_MAX = 20;
const DONATION_SLIDER_STEP = 0.5;

const resolveDonationAddress = (drep: DRep | null | undefined): string | undefined => {
  if (!drep) return undefined;
  const metadataAddress = getMetadataPaymentAddress(drep.metadata);
  if (metadataAddress && metadataAddress.length > 0) {
    return metadataAddress;
  }
  const fallback =
    typeof drep.payment_address === 'string' ? drep.payment_address.trim() : undefined;
  return fallback && fallback.length > 0 ? fallback : undefined;
};

export default function DelegateForm({ dreps, hasMore, onLoadMore, loading, onSearch }: DelegateFormProps) {
  const { connectedWallet } = useWalletContext();
  const { state, reset, setBuilding, setSigning, setSubmitting, setTxHash, setError } = useTransaction();
  const [selectedDRep, setSelectedDRep] = useState<DRep | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [donationPercent, setDonationPercent] = useState<number>(DEFAULT_DONATION_PERCENTAGE);

  // Get DRep from URL params if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const drepId = urlParams.get('drep');
    if (drepId) {
      const drep = dreps.find((d) => d.drep_id === drepId);
      if (drep) {
        setSelectedDRep(drep);
      }
    }
  }, [dreps]);

  // Debounce search (tighter 300ms) + skip duplicate queries
  useEffect(() => {
    if (!onSearch) return;
    const trimmed = searchQuery.trim();
    const timer = setTimeout(() => {
      onSearch(trimmed);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearch]);

  useEffect(() => {
    if (!selectedDRep) {
      setDonationPercent(DEFAULT_DONATION_PERCENTAGE);
      return;
    }
    const eligible = Boolean(resolveDonationAddress(selectedDRep));
    setDonationPercent(eligible ? DEFAULT_DONATION_PERCENTAGE : 0);
  }, [selectedDRep]);

  // Exclude retired DReps but keep both active and inactive (inactive are still valid delegation targets)
  const filteredDReps = dreps.filter(d => {
    const status = d.status?.toLowerCase();
    const isRetired = d.retired === true || status === 'retired';
    return !isRetired;
  });

  const handleDelegate = async () => {
    if (!connectedWallet || !selectedDRep) return;

    reset();

    try {
      const txHash = await submitDelegationTransaction(
        connectedWallet,
        selectedDRep.drep_id,
        {
          donationPercentage: donationAvailable ? donationPercent : 0,
          donationAddress: donationAvailable ? selectedDonationAddress : undefined,
        },
        (stage) => {
          switch (stage) {
            case 'building':
              setBuilding(true);
              break;
            case 'signing':
              setBuilding(false);
              setSigning(true);
              break;
            case 'submitting':
              setSigning(false);
              setSubmitting(true);
              break;
          }
        }
      );
      setSubmitting(false);
      setTxHash(txHash);
    } catch (error: unknown) {
      setBuilding(false);
      setSigning(false);
      setSubmitting(false);
      setError(error instanceof Error ? error.message : 'Failed to submit delegation transaction');
    }
  };

  const selectedDonationAddress = resolveDonationAddress(selectedDRep);
  const donationAvailable = Boolean(selectedDonationAddress);

  if (!connectedWallet) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Please connect your wallet to delegate voting rights</p>
          <p className="text-sm text-muted-foreground">Use the wallet connection button in the navigation bar</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="wooly-border overflow-hidden rounded-3xl border border-border/70 bg-background/80 p-6 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <EmojiBadge emoji="🧑‍🌾" srLabel="Select your delegate">
                Choose a DRep partner
              </EmojiBadge>
              <h2 className="mt-3 text-2xl font-display font-bold text-foreground">Select DRep</h2>
            </div>
            {filteredDReps.length > 0 && (
              <Badge variant="info" className="rounded-full px-3 py-1 text-xs">
                {filteredDReps.length} listed
              </Badge>
            )}
          </div>

          <div className="relative mb-5 mt-6">
            <label htmlFor="drep-search" className="sr-only">
              Search DReps
            </label>
            <div className="absolute inset-y-0 left-4 flex items-center">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <input
              id="drep-search"
              type="text"
              placeholder="Search DReps by name, mission, or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-border/70 bg-background/90 py-3 pl-12 pr-5 text-sm text-foreground shadow-inner focus:border-field-green/70 focus:outline-none focus:ring-2 focus:ring-field-green/40 placeholder:text-muted-foreground"
              aria-label="Search DReps by name, description, or ID"
            />
          </div>

          <div className="space-y-3 overflow-y-auto rounded-2xl border border-dashed border-border/60 bg-background/70 p-3 max-h-[26rem]">
            {filteredDReps.length > 0 ? (
              <>
                {filteredDReps.map((drep) => {
                  const isSelected = selectedDRep?.drep_id === drep.drep_id;
                  const nameFromMetadata = getMetadataName(drep.metadata);
                  const displayName = nameFromMetadata || drep.given_name || drep.view || drep.drep_id.slice(0, 16);
                  const shortId = drep.drep_id; // full ID per requirement
                  const description = getMetadataDescription(drep.metadata) || (typeof drep.metadata?.description === 'string' ? drep.metadata.description : undefined);
                  const status = drep.status?.toLowerCase();
                  const donationAddress = resolveDonationAddress(drep);
                  const donationEligible = Boolean(donationAddress);
                  return (
                    <button
                      key={drep.drep_id}
                      onClick={() => setSelectedDRep(drep)}
                      className={`group w-full rounded-2xl border-2 px-4 py-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-field-green/50 focus-visible:ring-offset-2 ${
                        isSelected
                          ? 'border-field-green/80 bg-field-green/15 shadow-lg shadow-field-green/20'
                          : 'border-transparent bg-background/80 hover:border-field-green/40 hover:bg-field-green/10'
                      }`}
                      aria-label={`Select DRep ${displayName} (${shortId})`}
                      aria-pressed={isSelected}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedDRep(drep);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-base font-semibold text-foreground" title={displayName}>
                              {displayName}
                            </p>
                            {isSelected && (
                              <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-field-green" aria-hidden="true" />
                            )}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground" title={shortId}>
                            {shortId}
                          </p>
                          {status && (
                            <p
                              className={`text-[11px] uppercase tracking-widest ${status === 'active' ? 'text-field-green' : 'text-amber-500'}`}
                              aria-label={`Status: ${status}`}
                            >
                              {status}
                            </p>
                          )}
                          {description && (
                            <p className="line-clamp-2 text-xs text-muted-foreground/90" title={description}>
                              {description}
                            </p>
                          )}
                          {donationEligible && (
                            <EmojiBadge emoji="🪙" className="bg-field-green/15 text-xs" aria-label="Supports optional DRep compensation">
                              CIP-149 donations
                            </EmojiBadge>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {typeof drep.delegator_count === 'number' && (
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-widest">
                              {drep.delegator_count} delegators
                            </Badge>
                          )}
                          {typeof drep.voting_power_active === 'string' && !Number.isNaN(Number(drep.voting_power_active)) && (
                            <span className="text-xs font-medium text-field-green/90">
                              {(Number(drep.voting_power_active) / 1_000_000).toFixed(0)} ₳
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {hasMore && onLoadMore && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      onClick={onLoadMore}
                      disabled={loading}
                      className="w-full rounded-full border-field-green/40 text-sm font-semibold"
                      size="sm"
                    >
                      {loading ? 'Loading...' : 'Load More DReps'}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-muted/50 py-12 text-muted-foreground">
                <EmojiBadge emoji={loading ? '⏳' : '🫥'} className="bg-background/80">
                  {loading ? 'Fetching herd' : 'No matches yet'}
                </EmojiBadge>
                <p className="text-sm">
                  {loading ? 'Loading DReps...' : 'Try a different search or clear your filters.'}
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="wooly-border overflow-hidden rounded-3xl border border-border/70 bg-background/85 p-6 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <EmojiBadge emoji="🔐" srLabel="Delegation details">
                Confirm your delegation
              </EmojiBadge>
              <h2 className="mt-3 text-2xl font-display font-bold text-foreground">Delegation Details</h2>
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-widest">
              CIP-1694 ready
            </Badge>
          </div>

          {selectedDRep ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Selected DRep</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-lg text-foreground">
                    {selectedDRep.metadata?.name || selectedDRep.view || selectedDRep.drep_id.slice(0, 8)}
                  </p>
                  {donationAvailable && (
                    <EmojiBadge emoji="💚" className="bg-field-green/15">
                      CIP-149 enabled
                    </EmojiBadge>
                  )}
                </div>
              </div>

              {selectedDRep.metadata?.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="rounded-2xl border border-dashed border-border/60 bg-background/70 p-4 text-sm leading-relaxed text-foreground">
                    {selectedDRep.metadata.description}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-1">Your Wallet</p>
                <p className="rounded-2xl bg-muted/60 px-4 py-3 font-mono text-xs text-foreground">
                  {connectedWallet.address.slice(0, 20)}…{connectedWallet.address.slice(-8)}
                </p>
              </div>

              <div className="pt-2">
                {donationAvailable ? (
                  <div className="space-y-4 rounded-2xl border border-field-green/40 bg-field-green/10 p-5 shadow-inner">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">Optional donation to this DRep</span>
                      <span className="font-semibold text-field-green">{donationPercent.toFixed(1)}%</span>
                    </div>
                    <input
                      type="range"
                      min={DONATION_SLIDER_MIN}
                      max={DONATION_SLIDER_MAX}
                      step={DONATION_SLIDER_STEP}
                      value={donationPercent}
                      onChange={(event) => setDonationPercent(Number(event.target.value))}
                      className="w-full accent-field-green"
                      aria-label="Donation percentage slider"
                    />
                    <div className="flex flex-wrap gap-2">
                      {DONATION_PRESET_PERCENTAGES.map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          variant={donationPercent === preset ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setDonationPercent(preset)}
                          aria-pressed={donationPercent === preset}
                        >
                          {preset}%
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant={donationPercent === 0 ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setDonationPercent(0)}
                        aria-pressed={donationPercent === 0}
                      >
                        0%
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Donation is optional. Adjust this value anytime by submitting a new delegation.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/40 p-5 text-sm text-muted-foreground">
                    This DRep has not provided a payment address, so optional donations are unavailable.
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  By delegating, you will give this DRep the authority to vote on governance actions on your behalf.
                </p>
                <Button
                  onClick={() => setShowModal(true)}
                  size="lg"
                  className="w-full"
                  disabled={!selectedDRep}
                >
                  Delegate Voting Rights
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/40 py-12 text-muted-foreground">
              <EmojiBadge emoji="👋" className="bg-background/80">
                No DRep selected
              </EmojiBadge>
              <p className="max-w-sm text-sm">
                Browse the list on the left to preview DRep profiles, donation options, and governance activity.
              </p>
            </div>
          )}
        </Card>
      </div>

      <TransactionModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          if (state.txHash || state.error) {
            reset();
          }
        }}
        isBuilding={state.isBuilding}
        isSigning={state.isSigning}
        isSubmitting={state.isSubmitting}
        txHash={state.txHash}
        error={state.error}
        onConfirm={handleDelegate}
      />
    </>
  );
}

