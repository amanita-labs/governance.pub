import type { ConnectedWallet } from '@/lib/api/mesh';
import { KoiosProvider, MeshTxBuilder } from '@meshsdk/core';

export interface DRepRegistrationData {
  metadataUrl?: string;
  anchorUrl?: string;
  anchorHash?: string;
}

export interface DRepUpdateData {
  anchorUrl?: string;
  anchorHash?: string;
}

export type GovernanceTransactionStage = 'building' | 'signing' | 'submitting';
export type StageChangeCallback = (stage: GovernanceTransactionStage) => void;

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

function buildAnchor(anchorUrl?: string, anchorHash?: string) {
  if (anchorUrl && anchorHash) {
    return { anchorUrl, anchorDataHash: anchorHash } as const;
  }
  return undefined;
}

async function createTxContext(wallet: ConnectedWallet) {
  const networkId = await wallet.wallet.getNetworkId();
  const koiosNetwork = resolveKoiosNetwork(networkId);
  const koiosApiKey = process.env.NEXT_PUBLIC_KOIOS_API_KEY;
  if (!koiosApiKey) {
    throw new Error('Koios API key is not set. Please define NEXT_PUBLIC_KOIOS_API_KEY in your environment variables.');
  }

  const provider = new KoiosProvider(koiosNetwork, koiosApiKey);
  const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });
  const utxos = await wallet.wallet.getUtxos();
  const changeAddress = await wallet.wallet.getChangeAddress();
  const dRep = await wallet.wallet.getDRep();
  const dRepId = dRep?.dRepIDCip105;

  if (!dRepId) {
    throw new Error('Unable to retrieve DRep ID from connected wallet. Please ensure the wallet supports CIP-105 identifiers.');
  }

  return { txBuilder, utxos, changeAddress, dRepId };
}

async function finalizeAndSubmit(
  txBuilder: MeshTxBuilder,
  wallet: ConnectedWallet,
  onStageChange?: StageChangeCallback
): Promise<string> {
  console.log('[gov] stage: building');
  onStageChange?.('building');
  const unsignedTx = await txBuilder.complete();

  console.log('[gov] stage: signing');
  onStageChange?.('signing');
  const signedTx = await wallet.wallet.signTx(unsignedTx);

  console.log('[gov] stage: submitting');
  onStageChange?.('submitting');
  return wallet.wallet.submitTx(signedTx);
}

export async function submitDRepRegistrationTransaction(
  wallet: ConnectedWallet,
  registrationData: DRepRegistrationData,
  onStageChange?: StageChangeCallback
): Promise<string> {
  const { txBuilder, utxos, changeAddress, dRepId } = await createTxContext(wallet);

  const anchor = buildAnchor(registrationData.anchorUrl, registrationData.anchorHash);
  if (anchor) {
    txBuilder.drepRegistrationCertificate(dRepId, anchor);
  } else {
    txBuilder.drepRegistrationCertificate(dRepId);
  }

  txBuilder.changeAddress(changeAddress).selectUtxosFrom(utxos);
  return finalizeAndSubmit(txBuilder, wallet, onStageChange);
}

export async function submitDRepUpdateTransaction(
  wallet: ConnectedWallet,
  updateData: DRepUpdateData,
  onStageChange?: StageChangeCallback
): Promise<string> {
  const { txBuilder, utxos, changeAddress, dRepId } = await createTxContext(wallet);

  const anchor = buildAnchor(updateData.anchorUrl, updateData.anchorHash);
  if (anchor) {
    txBuilder.drepUpdateCertificate(dRepId, anchor);
  } else {
    txBuilder.drepUpdateCertificate(dRepId);
  }

  txBuilder.changeAddress(changeAddress).selectUtxosFrom(utxos);
  return finalizeAndSubmit(txBuilder, wallet, onStageChange);
}

export async function submitDRepRetirementTransaction(
  wallet: ConnectedWallet,
  onStageChange?: StageChangeCallback
): Promise<string> {
  const { txBuilder, utxos, changeAddress, dRepId } = await createTxContext(wallet);
  txBuilder.drepDeregistrationCertificate(dRepId);
  txBuilder.changeAddress(changeAddress).selectUtxosFrom(utxos);
  return finalizeAndSubmit(txBuilder, wallet, onStageChange);
}

