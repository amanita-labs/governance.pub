import { KoiosProvider, MeshTxBuilder } from '@meshsdk/core';
import type { ConnectedWallet } from '@/lib/api/mesh';

type KoiosNetwork = 'api' | 'preview' | 'preprod' | 'guild';

function resolveKoiosNetwork(networkId: number): KoiosNetwork {
  switch (networkId) {
    case 0:
      return 'preview'; // testnet (note: consider preprod detection if needed)
    case 1:
    default:
      return 'api'; // mainnet
  }
}

export type DelegationStageCallback = (stage: 'building' | 'signing' | 'submitting') => void;

/**
 * Submit a vote delegation transaction to delegate voting rights to a DRep
 * Based on MeshJS documentation: https://meshjs.dev/apis/txbuilder/governance#vote-delegation
 * 
 * @param wallet - Connected wallet instance
 * @param drepId - DRep ID to delegate to (in CIP-105 or CIP-129 format)
 * @param onStageChange - Optional callback to track transaction stages
 * @returns Transaction hash
 */
export async function submitDelegationTransaction(
  wallet: ConnectedWallet,
  drepId: string,
  onStageChange?: DelegationStageCallback
): Promise<string> {
  // Get wallet information
  const utxos = await wallet.wallet.getUtxos();
  const rewardAddresses = await wallet.wallet.getRewardAddresses();
  const rewardAddress = rewardAddresses[0];
  const changeAddress = await wallet.wallet.getChangeAddress();

  if (!rewardAddress) {
    throw new Error('No reward address found. Please ensure your wallet has a stake key registered.');
  }

  // Initialize transaction builder with provider
  const networkId = await wallet.wallet.getNetworkId();
  const koiosNetwork = resolveKoiosNetwork(networkId);
  const koiosApiKey = process.env.NEXT_PUBLIC_KOIOS_API_KEY;
  
  if (!koiosApiKey) {
    throw new Error('Koios API key is not set. Please define NEXT_PUBLIC_KOIOS_API_KEY in your environment variables.');
  }

  const provider = new KoiosProvider(koiosNetwork, koiosApiKey);
  const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

  // Build the vote delegation certificate transaction
  txBuilder
    .voteDelegationCertificate(
      {
        dRepId: drepId,
      },
      rewardAddress
    )
    .changeAddress(changeAddress)
    .selectUtxosFrom(utxos);

  // Complete, sign, and submit the transaction
  console.log('[delegation] Building transaction...');
  onStageChange?.('building');
  const unsignedTx = await txBuilder.complete();
  
  console.log('[delegation] Signing transaction...');
  onStageChange?.('signing');
  const signedTx = await wallet.wallet.signTx(unsignedTx);
  
  console.log('[delegation] Submitting transaction...');
  onStageChange?.('submitting');
  const txHash = await wallet.wallet.submitTx(signedTx);
  
  console.log('[delegation] Transaction submitted:', txHash);
  return txHash;
}

