'use client';

import { useState } from 'react';
import { useWalletContext } from './WalletProvider';
import { Wallet, LogOut, Loader2, Sparkles } from 'lucide-react';
import { EmojiBadge } from '../ui/Badge';

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
          className="flex items-center gap-2 rounded-full border border-field-green/40 bg-field-green/20 px-4 py-2 text-sm font-semibold text-field-dark shadow-sm transition hover:border-field-green/60 hover:bg-field-green/30 dark:text-field-light"
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
            Woollet {connectedWallet.address.slice(0, 4)}…{connectedWallet.address.slice(-4)}
          </span>
          <span className="sr-only">Open connected wallet menu</span>
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
              <div className="space-y-3 border-b p-4">
                <EmojiBadge emoji="🧶" className="w-fit">
                  Fleece-secured connection
                </EmojiBadge>
                <div>
                  <p className="text-sm font-medium text-card-foreground">Connected Wallet</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground" aria-label={`Wallet address: ${connectedWallet.address}`}>
                    {connectedWallet.address}
                  </p>
                </div>
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
                className="flex min-h-[44px] w-full items-center gap-2 px-4 py-2 text-left text-sm text-destructive transition hover:bg-muted"
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
      <div className="rounded-full border border-border/60 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
        No wallet found
      </div>
    );
  }

  return (
    <div className="relative">
      <button
  onClick={() => toggleMenu()}
        disabled={isConnecting}
        className="flex min-h-[44px] items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/70 hover:bg-primary/15 disabled:opacity-50"
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
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
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
              <div className="flex items-center justify-between px-3 py-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground" id="wallet-menu-label">
                  Available Wallets
                </p>
                <EmojiBadge emoji="🌙" className="text-[10px] font-medium" variant="info">
                  Night-safe
                </EmojiBadge>
              </div>
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

