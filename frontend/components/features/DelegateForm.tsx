'use client';

import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TransactionModal } from './TransactionModal';
import { useWalletContext } from '../layout/WalletProvider';
import { useTransaction } from '@/hooks/useTransaction';
import { submitDelegationTransaction } from '@/lib/governance/transactions/delegate';
import { Search } from 'lucide-react';
import type { DRep } from '@/types/governance';
import { getMetadataName, getMetadataDescription } from '@/lib/governance/drepMetadata';

interface DelegateFormProps {
  dreps: DRep[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  loading?: boolean;
  onSearch?: (query: string) => void;
}

export default function DelegateForm({ dreps, hasMore, onLoadMore, loading, onSearch }: DelegateFormProps) {
  const { connectedWallet } = useWalletContext();
  const { state, reset, setBuilding, setSigning, setSubmitting, setTxHash, setError } = useTransaction();
  const [selectedDRep, setSelectedDRep] = useState<DRep | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-2xl font-display font-bold mb-4">Select DRep</h2>
          
          <div className="mb-4 relative">
            <label htmlFor="drep-search" className="sr-only">Search DReps</label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" aria-hidden="true" />
            <input
              id="drep-search"
              type="text"
              placeholder="Search DReps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground min-h-[44px]"
              aria-label="Search DReps by name, description, or ID"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredDReps.length > 0 ? (
              <>
                {filteredDReps.map((drep) => {
                  const isSelected = selectedDRep?.drep_id === drep.drep_id;
                  const nameFromMetadata = getMetadataName(drep.metadata);
                  const displayName = nameFromMetadata || drep.given_name || drep.view || drep.drep_id.slice(0, 16);
                  const shortId = drep.drep_id; // full ID per requirement
                  const description = getMetadataDescription(drep.metadata) || (typeof drep.metadata?.description === 'string' ? drep.metadata.description : undefined);
                  const status = drep.status?.toLowerCase();
                  return (
                    <button
                      key={drep.drep_id}
                      onClick={() => setSelectedDRep(drep)}
                      className={`w-full text-left p-4 rounded-md border-2 transition-colors min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                        isSelected
                          ? 'border-field-green bg-field-green/10'
                          : 'border-input hover:border-field-green/50'
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
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate" title={displayName}>{displayName}</p>
                          <p className="text-xs font-mono text-muted-foreground break-all mt-1" title={shortId}>{shortId}</p>
                          {status && (
                            <p className={`text-[10px] uppercase tracking-wide font-semibold mt-1 ${status === 'active' ? 'text-green-600' : 'text-amber-600'}`}
                               aria-label={`Status: ${status}`}>
                              {status}
                            </p>
                          )}
                          {description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1" title={description}>
                              {description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <div className="w-4 h-4 mt-1 rounded-full bg-field-green flex-shrink-0" />
                        )}
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
                      className="w-full"
                      size="sm"
                    >
                      {loading ? 'Loading...' : 'Load More DReps'}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {loading ? 'Loading DReps...' : 'No DReps found'}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-display font-bold mb-4">Delegation Details</h2>
          
          {selectedDRep ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Selected DRep</p>
                <p className="font-semibold text-lg text-foreground">
                  {selectedDRep.metadata?.name || selectedDRep.view || selectedDRep.drep_id.slice(0, 8)}
                </p>
              </div>

              {selectedDRep.metadata?.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm text-foreground">{selectedDRep.metadata.description}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-1">Your Wallet</p>
                <p className="text-sm font-mono break-all text-foreground">
                  {connectedWallet.address.slice(0, 20)}...
                </p>
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
            <div className="text-center py-12 text-muted-foreground">
              <p>Select a DRep from the list to begin</p>
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

