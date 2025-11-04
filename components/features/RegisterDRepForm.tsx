'use client';

import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TransactionModal } from './TransactionModal';
import { useWalletContext } from '../layout/WalletProvider';
import { useTransaction } from '@/hooks/useTransaction';
import { submitDRepRegistrationTransaction } from '@/lib/governance/transactions/registerDRep';

export default function RegisterDRepForm() {
  const { connectedWallet } = useWalletContext();
  const { state, reset, setBuilding, setSigning, setSubmitting, setTxHash, setError } = useTransaction();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    metadataUrl: '',
    anchorUrl: '',
    anchorHash: '',
  });

  const handleSubmit = async () => {
    if (!connectedWallet) return;

    reset();
    setShowModal(true);
    setBuilding(true);

    try {
      const txHash = await submitDRepRegistrationTransaction(connectedWallet, {
        metadataUrl: formData.metadataUrl || undefined,
        anchorUrl: formData.anchorUrl || undefined,
        anchorHash: formData.anchorHash || undefined,
      });
      setBuilding(false);
      setTxHash(txHash);
    } catch (error: any) {
      setBuilding(false);
      setError(error.message || 'Failed to submit transaction');
    }
  };

  if (!connectedWallet) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Please connect your wallet to register as a DRep</p>
          <p className="text-sm text-muted-foreground">Use the wallet connection button in the navigation bar</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-display font-bold mb-6">DRep Registration Information</h2>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="metadata-url" className="block text-sm font-medium text-foreground mb-2">
              Metadata URL (Optional)
            </label>
            <input
              id="metadata-url"
              type="url"
              value={formData.metadataUrl}
              onChange={(e) => setFormData({ ...formData, metadataUrl: e.target.value })}
              placeholder="https://example.com/metadata.json"
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground min-h-[44px]"
              aria-label="Metadata URL for DRep registration (optional)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL to JSON metadata containing DRep information (name, description, etc.)
            </p>
          </div>

          <div>
            <label htmlFor="anchor-url" className="block text-sm font-medium text-foreground mb-2">
              Anchor URL (Optional)
            </label>
            <input
              id="anchor-url"
              type="url"
              value={formData.anchorUrl}
              onChange={(e) => setFormData({ ...formData, anchorUrl: e.target.value })}
              placeholder="https://example.com/anchor"
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground min-h-[44px]"
              aria-label="Anchor URL for DRep registration (optional)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL to the anchor for your DRep registration
            </p>
          </div>

          <div>
            <label htmlFor="anchor-hash" className="block text-sm font-medium text-foreground mb-2">
              Anchor Hash (Optional)
            </label>
            <input
              id="anchor-hash"
              type="text"
              value={formData.anchorHash}
              onChange={(e) => setFormData({ ...formData, anchorHash: e.target.value })}
              placeholder="Hash of the anchor data"
              className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent font-mono placeholder:text-muted-foreground min-h-[44px]"
              aria-label="Anchor hash for DRep registration (optional)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Hash of the anchor data (if provided, must match the anchor URL)
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Important Notes:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>All fields are optional, but providing metadata improves transparency</li>
              <li>You will need to pay a deposit to register as a DRep</li>
              <li>Make sure your wallet has sufficient ADA for the registration deposit</li>
              <li>This action cannot be undone, so please verify all information</li>
            </ul>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Your Wallet:</p>
            <p className="text-sm font-mono break-all bg-muted px-3 py-2 rounded text-foreground">
              {connectedWallet.address}
            </p>
          </div>

          <Button
            onClick={() => setShowModal(true)}
            size="lg"
            className="w-full"
          >
            Register as DRep
          </Button>
        </div>
      </Card>

      <TransactionModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          if (state.txHash || state.error) {
            reset();
            if (state.txHash) {
              setFormData({ metadataUrl: '', anchorUrl: '', anchorHash: '' });
            }
          }
        }}
        isBuilding={state.isBuilding}
        isSigning={state.isSigning}
        isSubmitting={state.isSubmitting}
        txHash={state.txHash}
        error={state.error}
        onConfirm={handleSubmit}
      />
    </>
  );
}

