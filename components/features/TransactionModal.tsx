'use client';

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBuilding: boolean;
  isSigning: boolean;
  isSubmitting: boolean;
  txHash: string | null;
  error: string | null;
  onConfirm?: () => void;
}

export function TransactionModal({
  isOpen,
  onClose,
  isBuilding,
  isSigning,
  isSubmitting,
  txHash,
  error,
  onConfirm,
}: TransactionModalProps) {
  const isLoading = isBuilding || isSigning || isSubmitting;
  const isComplete = txHash !== null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Transaction Status">
      <div className="space-y-4">
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-field-green" />
            <div className="text-center">
              {isBuilding && <p className="font-medium">Building transaction...</p>}
              {isSigning && <p className="font-medium">Please sign the transaction in your wallet...</p>}
              {isSubmitting && <p className="font-medium">Submitting transaction...</p>}
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <XCircle className="w-12 h-12 text-red-500" />
            <div className="text-center">
              <p className="font-medium text-red-600 mb-2">Transaction Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        )}

        {isComplete && !error && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <p className="font-medium text-green-600 mb-2">Transaction Successful!</p>
              <p className="text-sm text-muted-foreground mb-2">Transaction Hash:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded break-all text-foreground">{txHash}</code>
            </div>
            <div className="flex space-x-2">
              <Button onClick={onClose} variant="primary">
                Close
              </Button>
              {onConfirm && (
                <Button onClick={onConfirm} variant="secondary">
                  Continue
                </Button>
              )}
            </div>
          </div>
        )}

        {!isLoading && !isComplete && !error && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Ready to proceed with the transaction?</p>
            <div className="flex space-x-2 justify-center">
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button onClick={onConfirm} variant="primary">
                Confirm
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

