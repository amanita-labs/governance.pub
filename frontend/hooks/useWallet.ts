'use client';

import { useState, useEffect, useCallback } from 'react';
import { connectWallet, disconnectWallet, getAvailableWallets, type ConnectedWallet, type WalletName } from '@/lib/api/mesh';

export function useWallet() {
  const [connectedWallet, setConnectedWallet] = useState<ConnectedWallet | null>(null);
  const [availableWallets, setAvailableWallets] = useState<WalletName[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for available wallets on mount
    if (typeof window !== 'undefined') {
      const wallets = getAvailableWallets();
      setAvailableWallets(wallets);
      
      // Check for persisted wallet connection
      const savedWallet = localStorage.getItem('connectedWallet');
      if (savedWallet) {
        try {
          const walletData = JSON.parse(savedWallet);
          // Note: Wallet connection needs to be re-established on page load
        } catch (e) {
          localStorage.removeItem('connectedWallet');
        }
      }
    }
  }, []);

  const connect = useCallback(async (walletName: WalletName) => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const wallet = await connectWallet(walletName);
      if (wallet) {
        setConnectedWallet(wallet);
        localStorage.setItem('connectedWallet', JSON.stringify({ name: walletName }));
      } else {
        setError('Failed to connect wallet');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (connectedWallet) {
      await disconnectWallet(connectedWallet.wallet);
      setConnectedWallet(null);
      localStorage.removeItem('connectedWallet');
    }
  }, [connectedWallet]);

  return {
    connectedWallet,
    availableWallets,
    isConnecting,
    error,
    connect,
    disconnect,
  };
}

