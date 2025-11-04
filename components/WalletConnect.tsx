'use client';

import { useState } from 'react';
import { useWalletContext } from './WalletProvider';
import { Wallet, LogOut, Loader2 } from 'lucide-react';

export function WalletConnect() {
  const { connectedWallet, availableWallets, isConnecting, connect, disconnect } = useWalletContext();
  const [showMenu, setShowMenu] = useState(false);

  if (connectedWallet) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center space-x-2 bg-sky-blue text-white px-4 py-2 rounded-md hover:bg-sky-dark transition-colors"
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">
            {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
          </span>
        </button>
        
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-lg border z-50">
              <div className="p-4 border-b">
                <p className="text-sm font-medium text-card-foreground">Connected Wallet</p>
                <p className="text-xs text-muted-foreground mt-1 break-all">{connectedWallet.address}</p>
                {connectedWallet.stakeAddress && (
                  <p className="text-xs text-muted-foreground mt-1 break-all">
                    Stake: {connectedWallet.stakeAddress.slice(0, 10)}...
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  disconnect();
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted flex items-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Disconnect</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (availableWallets.length === 0) {
    return (
      <div className="text-white text-sm">
        No wallet found
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isConnecting}
        className="flex items-center space-x-2 bg-sky-blue text-white px-4 py-2 rounded-md hover:bg-sky-dark transition-colors disabled:opacity-50"
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" />
            <span>Connect Wallet</span>
          </>
        )}
      </button>

      {showMenu && !isConnecting && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-lg border z-50">
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Available Wallets</p>
              {availableWallets.map((walletName) => (
                <button
                  key={walletName}
                  onClick={() => {
                    connect(walletName);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted rounded-md capitalize"
                >
                  {walletName}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

