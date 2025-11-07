import { BrowserWallet } from '@meshsdk/core';

export type WalletName = 'nami' | 'eternl' | 'flint' | 'gero' | 'lace' | 'typhon' | 'nufi' | 'begin' | 'vespr' | 'yoroi';

export interface ConnectedWallet {
  name: WalletName;
  wallet: BrowserWallet;
  address: string;
  stakeAddress?: string;
}

type CardanoProviderMap = Partial<Record<WalletName, unknown>> & Record<string, unknown>;

type CardanoWindow = Window & {
  cardano?: CardanoProviderMap;
};

type DisconnectableWallet = BrowserWallet | {
  disconnect?: () => Promise<unknown>;
} | null | undefined;

/**
 * Get available wallets
 */
export function getAvailableWallets(): WalletName[] {
  if (typeof window === 'undefined') return [];

  const available: WalletName[] = [];
  const cardanoWindow = window as unknown as CardanoWindow;

  try {
    const providerMap = cardanoWindow.cardano;
    const hasCardano = typeof providerMap === 'object' && providerMap !== null;
    console.log('[wallet] cardano provider present:', hasCardano);
    if (hasCardano) {
      console.log('[wallet] discovered providers:', Object.keys(providerMap));
    }
  } catch (error) {
    console.log('[wallet] error inspecting window.cardano', error);
  }

  const providerMap = cardanoWindow.cardano;
  if (providerMap) {
    if (providerMap.nami) available.push('nami');
    if (providerMap.eternl) available.push('eternl');
    if (providerMap.flint) available.push('flint');
    if (providerMap.gero) available.push('gero');
    if (providerMap.lace) available.push('lace');
    if (providerMap.typhon) available.push('typhon');
    if (providerMap.nufi) available.push('nufi');
    if (providerMap.begin) available.push('begin');
    if (providerMap.vespr) available.push('vespr');
    if (providerMap.yoroi) available.push('yoroi');
  }

  console.log('[wallet] available wallets:', available);

  return available;
}

/**
 * Connect to a wallet
 */
export async function connectWallet(walletName: WalletName): Promise<ConnectedWallet | null> {
  try {
    console.log('[wallet] connectWallet start:', walletName);
    if (typeof window === 'undefined') {
      throw new Error('Cardano wallet not found');
    }

    const cardanoWindow = window as unknown as CardanoWindow;
    const providerMap = cardanoWindow.cardano;
    if (!providerMap) {
      throw new Error('Cardano wallet not found');
    }

    if (!providerMap[walletName]) {
      throw new Error(`Wallet ${walletName} not found`);
    }

    const wallet = await BrowserWallet.enable(walletName, [{ cip: 95 }]);
    console.log('[wallet] enabled provider:', walletName);

    const usedAddresses = await wallet.getUsedAddresses();
    console.log('[wallet] used addresses length:', usedAddresses.length);

    let address = usedAddresses[0];
    if (!address) {
      const unusedAddresses = await wallet.getUnusedAddresses();
      address = unusedAddresses[0];
    }

    if (!address) {
      throw new Error('Wallet did not provide any address');
    }

    let stakeAddress: string | undefined;
    try {
      const rewardAddresses = await wallet.getRewardAddresses();
      stakeAddress = rewardAddresses[0];
      console.log('[wallet] reward addresses length:', rewardAddresses.length);
    } catch (error) {
      console.warn('[wallet] getRewardAddresses failed (non-fatal):', error);
    }

    console.log('[wallet] connectWallet success:', {
      walletName,
      hasAddress: Boolean(address),
      hasStake: Boolean(stakeAddress),
    });

    return {
      name: walletName,
      wallet,
      address,
      stakeAddress,
    };
  } catch (error) {
    console.error('[wallet] Error connecting wallet:', error);
    return null;
  }
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(wallet: DisconnectableWallet): Promise<void> {
  try {
    console.log('[wallet] disconnectWallet start');
    if (wallet) {
      const disconnectMethod = (wallet as { disconnect?: () => Promise<unknown> }).disconnect;
      if (typeof disconnectMethod === 'function') {
        await disconnectMethod.call(wallet);
      }
    }
    console.log('[wallet] disconnectWallet complete');
  } catch (error) {
    console.error('[wallet] Error disconnecting wallet:', error);
  }
}

