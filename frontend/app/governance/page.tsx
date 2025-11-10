'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import DelegateForm from '@/components/features/DelegateForm';
import DRepMetadataForm from '@/components/features/DRepMetadataForm';
import WalletDRepStatus from '@/components/features/WalletDRepStatus';
import { TransactionModal } from '@/components/features/TransactionModal';
import { useWalletContext } from '@/components/layout/WalletProvider';
import { useTransaction } from '@/hooks/useTransaction';
import {
  submitDRepRegistrationTransaction,
  submitDRepUpdateTransaction,
  submitDRepRetirementTransaction,
} from '@/lib/governance/transactions/registerDRep';
import type { DRep, DRepMetadata } from '@/types/governance';
import { sanitizeMetadataValue, getMetadataName } from '@/lib/governance/drepMetadata';

export default function GovernancePage() {
  const { connectedWallet } = useWalletContext();
  const { state, reset, setBuilding, setTxHash, setError } = useTransaction();
  
  const [showModal, setShowModal] = useState(false);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [currentAction, setCurrentAction] = useState<'register' | 'update' | 'deregister' | null>(null);
  
  const [metadataUrl, setMetadataUrl] = useState<string | undefined>();
  const [metadataHash, setMetadataHash] = useState<string | undefined>();
  
  const [dreps, setDReps] = useState<DRep[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Use a smaller page size when searching for snappier responses
  const basePageSize = 50;
  const searchPageSize = 20;
  const itemsPerPage = searchQuery.trim() ? searchPageSize : basePageSize;

  // Memory cache for DRep pages keyed by query+page+pageSize
  const pageCache = useRef<Map<string, { dreps: DRep[]; hasMore: boolean }>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const metadataCache = useRef<Map<string, DRepMetadata | null>>(new Map());

  useEffect(() => {
    const key = `${searchQuery.trim()}::${currentPage}::${itemsPerPage}`;
    // If cached, use immediately.
    if (pageCache.current.has(key)) {
      const cached = pageCache.current.get(key)!;
      // If first page, replace; else append (to avoid duplication if we navigated back)
      if (currentPage === 1) {
        setDReps(cached.dreps);
      } else {
        // ensure we don't duplicate entries
        setDReps(prev => {
          const existingIds = new Set(prev.map(d => d.drep_id));
          const merged = [...prev];
          cached.dreps.forEach(d => { if (!existingIds.has(d.drep_id)) merged.push(d); });
          return merged;
        });
      }
      setHasMore(cached.hasMore);
      setLoading(false);
      return; // skip fetch
    }

    // Abort previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    async function loadDReps() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          count: itemsPerPage.toString(),
        });
        if (searchQuery.trim()) {
          params.append('search', searchQuery.trim());
        }
        const response = await fetch(`/api/dreps?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch DReps: ${response.status}`);
        }
        const data = await response.json();
        const pagePayload: { dreps: DRep[]; hasMore: boolean } = {
          dreps: Array.isArray(data.dreps) ? data.dreps : [],
          hasMore: Boolean(data.hasMore),
        };
        pageCache.current.set(key, pagePayload);
        // Apply any cached metadata we already fetched
        const withCachedMeta = pagePayload.dreps.map((d: DRep) => {
          const cached = metadataCache.current.get(d.drep_id);
          if (cached) return { ...d, metadata: d.metadata ?? cached };
          return d;
        });
        if (currentPage === 1) {
          setDReps(withCachedMeta);
        } else {
          setDReps(prev => [...prev, ...withCachedMeta]);
        }
        setHasMore(pagePayload.hasMore);

        // Lazy-enrich names via metadata for those missing a name
        const missingIds = withCachedMeta
          .filter(d => {
            const name = getMetadataName(d.metadata);
            return !(name && name.trim().length > 0) && !(d.given_name && d.given_name.trim().length > 0);
          })
          .map(d => d.drep_id)
          .filter(id => !metadataCache.current.has(id));

        if (missingIds.length > 0) {
          Promise.all(
            missingIds.map(async (id) => {
              try {
                const res = await fetch(`/api/dreps/${encodeURIComponent(id)}/metadata`);
                if (!res.ok) {
                  metadataCache.current.set(id, null);
                  return;
                }
                const raw = await res.json();
                const sanitized = sanitizeMetadataValue(raw);
                if (sanitized) {
                  metadataCache.current.set(id, sanitized);
                } else {
                  metadataCache.current.set(id, null);
                }
              } catch {
                metadataCache.current.set(id, null);
              }
            })
          ).then(() => {
            // Apply any newly fetched metadata to current list
            setDReps(prev => prev.map(d => {
              const cached = metadataCache.current.get(d.drep_id);
              if (cached && !d.metadata) {
                return { ...d, metadata: cached };
              }
              return d;
            }));
          });
        }
      } catch (error) {
        if ((error as any)?.name !== 'AbortError') {
          console.error('Error loading DReps:', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    loadDReps();

    return () => {
      controller.abort();
    };
  }, [currentPage, searchQuery, itemsPerPage]);

  const handleSearch = (query: string) => {
    // Only trigger if actually changed (avoid resetting pagination for same value)
    setCurrentPage(1);
    setSearchQuery(query);
  };

  const loadMoreDReps = () => {
    if (hasMore && !loading) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleMetadataCreated = (url?: string, hash?: string) => {
    setMetadataUrl(url);
    setMetadataHash(hash);
    setShowMetadataForm(false);
    setShowModal(true);
  };

  const handleTransaction = async () => {
    if (!connectedWallet || !currentAction) return;

    reset();
    setBuilding(true);

    try {
      let txHash: string;
      
      if (currentAction === 'register') {
        txHash = await submitDRepRegistrationTransaction(connectedWallet, {
          anchorUrl: metadataUrl,
          anchorHash: metadataHash,
        });
      } else if (currentAction === 'update') {
        txHash = await submitDRepUpdateTransaction(connectedWallet, {
          anchorUrl: metadataUrl,
          anchorHash: metadataHash,
        });
      } else {
        txHash = await submitDRepRetirementTransaction(connectedWallet);
      }
      
      setTxHash(txHash);
    } catch (error: any) {
      setError(error.message || `Failed to ${currentAction} DRep`);
    } finally {
      setBuilding(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    if (state.txHash || state.error) {
      reset();
      setMetadataUrl(undefined);
      setMetadataHash(undefined);
      setCurrentAction(null);
    }
  };

  if (!connectedWallet) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-display font-bold mb-8">Governance</h1>
        <Card>
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-4">
              Please connect your wallet to access governance features
            </p>
            <p className="text-sm text-muted-foreground">
              Use the wallet connection button in the navigation bar
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold mb-2">Governance</h1>
        <p className="text-muted-foreground">
          Delegate your voting power, register as a DRep, or manage your DRep status
        </p>
      </div>

      {/* Wallet DRep Status Section */}
      {connectedWallet.stakeAddress && (
        <WalletDRepStatus 
          stakeAddress={connectedWallet.stakeAddress} 
          connectedWallet={connectedWallet}
        />
      )}

      <Tabs defaultValue="delegate">
        <TabsList>
          <TabsTrigger value="delegate">🗳️ Delegate</TabsTrigger>
          <TabsTrigger value="register">➕ Register as DRep</TabsTrigger>
          <TabsTrigger value="update">✏️ Update DRep</TabsTrigger>
          <TabsTrigger value="deregister">❌ Deregister DRep</TabsTrigger>
        </TabsList>

        <TabsContent value="delegate">
          {loading && dreps.length === 0 ? (
            <div className="text-center py-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-48 bg-muted rounded-lg"></div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-muted-foreground">Loading DReps...</p>
            </div>
          ) : (
            <DelegateForm
              dreps={dreps}
              hasMore={hasMore}
              onLoadMore={hasMore ? loadMoreDReps : undefined}
              loading={loading}
              onSearch={handleSearch}
            />
          )}
        </TabsContent>

        <TabsContent value="register">
          {showMetadataForm ? (
            <DRepMetadataForm
              onMetadataCreated={handleMetadataCreated}
              onCancel={() => {
                setShowMetadataForm(false);
                setCurrentAction(null);
              }}
            />
          ) : (
            <Card>
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">Register as a DRep</h2>
                  <p className="text-sm text-muted-foreground">
                    Become a Delegated Representative and participate in Cardano governance
                  </p>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">What is a DRep?</h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>DReps vote on governance actions on behalf of delegators</li>
                    <li>You can provide metadata to help delegators find and trust you</li>
                    <li>Registration requires a deposit (refundable when you deregister)</li>
                    <li>You will be able to vote on proposals once registered</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Connected wallet</p>
                  <p className="text-sm font-mono break-all bg-muted px-3 py-2 rounded">
                    {connectedWallet.address}
                  </p>
                </div>

                <Button onClick={() => { setCurrentAction('register'); setShowMetadataForm(true); }} size="lg" className="w-full">
                  Create Metadata & Register
                </Button>

                <div className="text-center">
                  <button
                    onClick={() => {
                      setCurrentAction('register');
                      setMetadataUrl(undefined);
                      setMetadataHash(undefined);
                      setShowModal(true);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                  >
                    Skip metadata and register without profile
                  </button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="update">
          {showMetadataForm ? (
            <DRepMetadataForm
              onMetadataCreated={handleMetadataCreated}
              onCancel={() => {
                setShowMetadataForm(false);
                setCurrentAction(null);
              }}
            />
          ) : (
            <Card>
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">Update DRep Metadata</h2>
                  <p className="text-sm text-muted-foreground">
                    Update your DRep profile information and anchor data
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Important Notes</h3>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
                    <li>Updating only changes your metadata, not your DRep ID</li>
                    <li>Your deposit remains untouched</li>
                    <li>Only transaction fees are required</li>
                    <li>Make sure you are already registered as a DRep</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Connected wallet</p>
                  <p className="text-sm font-mono break-all bg-muted px-3 py-2 rounded">
                    {connectedWallet.address}
                  </p>
                </div>

                <Button onClick={() => { setCurrentAction('update'); setShowMetadataForm(true); }} size="lg" className="w-full">
                  Create New Metadata & Update
                </Button>

                <div className="text-center">
                  <button
                    onClick={() => {
                      setCurrentAction('update');
                      setMetadataUrl(undefined);
                      setMetadataHash(undefined);
                      setShowModal(true);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground underline"
                  >
                    Update without changing metadata
                  </button>
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="deregister">
          <Card>
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold mb-2">Deregister as DRep</h2>
                <p className="text-sm text-muted-foreground">
                  Remove your DRep registration and reclaim your deposit
                </p>
              </div>

              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">⚠️ Warning</h3>
                <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 list-disc list-inside">
                  <li>This will permanently remove your DRep registration</li>
                  <li>Your deposit will be refunded after confirmation</li>
                  <li>Delegators will no longer be able to delegate to you</li>
                  <li>You will need to register again to resume DRep activities</li>
                  <li>Consider communicating this to your delegators first</li>
                </ul>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Connected wallet</p>
                <p className="text-sm font-mono break-all bg-muted px-3 py-2 rounded">
                  {connectedWallet.address}
                </p>
              </div>

              <Button
                onClick={() => { setCurrentAction('deregister'); setShowModal(true); }}
                size="lg"
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Deregister DRep
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <TransactionModal
        isOpen={showModal}
        onClose={handleModalClose}
        isBuilding={state.isBuilding}
        isSigning={state.isSigning}
        isSubmitting={state.isSubmitting}
        txHash={state.txHash}
        error={state.error}
        onConfirm={handleTransaction}
      />
    </div>
  );
}
