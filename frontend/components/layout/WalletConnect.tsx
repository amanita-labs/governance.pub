'use client';

import { useState } from 'react';
import { useWalletContext } from './WalletProvider';
import { Wallet, LogOut, Loader2 } from 'lucide-react';

export function WalletConnect() {
  const { connectedWallet, availableWallets, isConnecting, connect, disconnect } = useWalletContext();
  const [showMenu, setShowMenu] = useState(false);
  
  const toggleMenu = (next?: boolean) => {
    const newState = typeof next === 'boolean' ? next : !showMenu;
    console.log('[wallet-ui] toggle wallet menu ->', newState);
    setShowMenu(newState);
  };

  if (connectedWallet) {
    return (
      <div className="relative">
        <button
          onClick={() => toggleMenu()}
          className="flex items-center space-x-2 bg-sky-blue text-white px-4 py-2 rounded-md hover:bg-sky-dark transition-colors min-h-[44px]"
          aria-label="Open wallet menu"
          aria-expanded={showMenu}
          aria-haspopup="true"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowMenu(false);
            }
          }}
        >
          <Wallet className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">
            {connectedWallet.address.slice(0, 6)}...{connectedWallet.address.slice(-4)}
          </span>
        </button>
        
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => toggleMenu(false)}
              aria-hidden="true"
            />
            <div 
              className="absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-lg border z-50"
              role="menu"
              aria-label="Wallet menu"
            >
              <div className="p-4 border-b">
                <p className="text-sm font-medium text-card-foreground">Connected Wallet</p>
                <p className="text-xs text-muted-foreground mt-1 break-all" aria-label={`Wallet address: ${connectedWallet.address}`}>{connectedWallet.address}</p>
                {connectedWallet.stakeAddress && (
                  <p className="text-xs text-muted-foreground mt-1 break-all" aria-label={`Stake address: ${connectedWallet.stakeAddress}`}>
                    Stake: {connectedWallet.stakeAddress.slice(0, 10)}...
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  console.log('[wallet-ui] disconnect clicked');
                  disconnect();
                  toggleMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted flex items-center space-x-2 min-h-[44px]"
                role="menuitem"
                aria-label="Disconnect wallet"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowMenu(false);
                  }
                }}
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
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
  onClick={() => toggleMenu()}
        disabled={isConnecting}
        className="flex items-center space-x-2 bg-sky-blue text-white px-4 py-2 rounded-md hover:bg-sky-dark transition-colors disabled:opacity-50 min-h-[44px]"
        aria-label={isConnecting ? "Connecting wallet..." : "Open wallet connection menu"}
        aria-expanded={showMenu}
        aria-haspopup="true"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setShowMenu(false);
          }
        }}
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <Wallet className="w-4 h-4" aria-hidden="true" />
            <span>Connect Wallet</span>
          </>
        )}
      </button>

      {showMenu && !isConnecting && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => toggleMenu(false)}
            aria-hidden="true"
          />
          <div 
            className="absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-lg border z-50"
            role="menu"
            aria-label="Available wallets"
          >
            <div className="p-2">
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase" id="wallet-menu-label">Available Wallets</p>
              {availableWallets.map((walletName, index) => (
                <button
                  key={walletName}
                  onClick={() => {
                    console.log('[wallet-ui] connect clicked for', walletName);
                    connect(walletName);
                    toggleMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted rounded-md capitalize min-h-[44px] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  role="menuitem"
                  aria-label={`Connect ${walletName} wallet`}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowMenu(false);
                    } else if (e.key === 'ArrowDown' && index < availableWallets.length - 1) {
                      e.preventDefault();
                      const nextButton = e.currentTarget.parentElement?.children[index + 2] as HTMLElement;
                      nextButton?.focus();
                    } else if (e.key === 'ArrowUp' && index > 0) {
                      e.preventDefault();
                      const prevButton = e.currentTarget.parentElement?.children[index] as HTMLElement;
                      prevButton?.focus();
                    }
                  }}
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

