'use client';

import { useState } from 'react';
export interface TransactionState {
  isBuilding: boolean;
  isSigning: boolean;
  isSubmitting: boolean;
  txHash: string | null;
  error: string | null;
}

export function useTransaction() {
  const [state, setState] = useState<TransactionState>({
    isBuilding: false,
    isSigning: false,
    isSubmitting: false,
    txHash: null,
    error: null,
  });

  const reset = () => {
    setState({
      isBuilding: false,
      isSigning: false,
      isSubmitting: false,
      txHash: null,
      error: null,
    });
  };

  const setBuilding = (building: boolean) => {
    setState(prev => ({ ...prev, isBuilding: building }));
  };

  const setSigning = (signing: boolean) => {
    setState(prev => ({ ...prev, isSigning: signing }));
  };

  const setSubmitting = (submitting: boolean) => {
    setState(prev => ({ ...prev, isSubmitting: submitting }));
  };

  const setTxHash = (hash: string | null) => {
    setState(prev => ({ ...prev, txHash: hash }));
  };

  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error }));
  };

  return {
    state,
    reset,
    setBuilding,
    setSigning,
    setSubmitting,
    setTxHash,
    setError,
  };
}

