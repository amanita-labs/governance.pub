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
      console.log('[wallet] useWallet mount');
      const wallets = getAvailableWallets();
      console.log('[wallet] useWallet availableWallets:', wallets);
      setAvailableWallets(wallets);
      
      // Check for persisted wallet connection
      const savedWallet = localStorage.getItem('connectedWallet');
      if (savedWallet) {
        try {
          const walletData = JSON.parse(savedWallet);
          console.log('[wallet] found persisted wallet preference:', walletData);
          // Note: Wallet connection needs to be re-established on page load
        } catch (error) {
          console.warn('[wallet] failed to parse persisted wallet preference, clearing', error);
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
        console.log('[wallet] connect() success', { name: wallet.name, address: wallet.address });
      } else {
        setError('Failed to connect wallet');
      }
    } catch (error: unknown) {
      console.error('[wallet] connect() error:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
      console.log('[wallet] connect() finished');
    }
  }, []);

  const disconnect = useCallback(async () => {
    console.log('[wallet] disconnect() requested');
    if (connectedWallet) {
      await disconnectWallet(connectedWallet.wallet);
      setConnectedWallet(null);
      localStorage.removeItem('connectedWallet');
      console.log('[wallet] disconnect() complete');
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

