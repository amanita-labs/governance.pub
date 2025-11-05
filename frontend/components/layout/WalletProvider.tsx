'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useWallet } from '@/hooks/useWallet';

interface WalletContextType {
  connectedWallet: ReturnType<typeof useWallet>['connectedWallet'];
  availableWallets: ReturnType<typeof useWallet>['availableWallets'];
  isConnecting: boolean;
  error: string | null;
  connect: (walletName: ReturnType<typeof useWallet>['availableWallets'][0]) => Promise<void>;
  disconnect: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();

  return (
    <WalletContext.Provider value={wallet}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
}

