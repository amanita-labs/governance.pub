import { KoiosProvider, MeshTxBuilder } from '@meshsdk/core';
import type { ConnectedWallet } from '@/lib/api/mesh';
import type { GovernanceAction } from '@/types/governance';
import type { VoteChoice } from '@/types/vote';
import { extractTxHashAndIndex } from '@/lib/governance/proposal-id';

export type VoteStage = 'initializing' | 'building' | 'signing' | 'submitting';
export type VoteStageCallback = (stage: VoteStage) => void;

interface SubmitVoteParams {
  wallet: ConnectedWallet;
  action: GovernanceAction;
  drepId?: string; // allow override (otherwise fetch from wallet)
  vote: VoteChoice; // 'yes' | 'no' | 'abstain'
  anchorUrl?: string; // optional rationale URL
  anchorHash?: string; // optional rationale hash (blake2b-256)
  onStageChange?: VoteStageCallback;
}

interface GovernanceActionId {
  txHash: string;
  txIndex: number; // certificate index
}

function resolveKoiosNetwork(networkId: number): 'api' | 'preview' | 'preprod' | 'guild' {
  switch (networkId) {
    case 0:
      return 'preview';
    case 1:
    default:
      return 'api';
  }
}

function mapVoteKind(vote: VoteChoice): 'Yes' | 'No' | 'Abstain' {
  switch (vote) {
    case 'yes':
      return 'Yes';
    case 'no':
      return 'No';
    case 'abstain':
    default:
      return 'Abstain';
  }
}

function extractGovernanceActionId(action: GovernanceAction): GovernanceActionId {
  // Preferred: use proposal_tx_hash + (proposal_index|cert_index)
  if (action.proposal_tx_hash) {
    const index = action.proposal_index ?? action.cert_index ?? 0;
    return { txHash: action.proposal_tx_hash, txIndex: index };
  }
  // Fallback: parse action_id if it's a tx hash (with optional index)
  if (action.action_id) {
    const parsed = extractTxHashAndIndex(action.action_id);
    if (parsed) {
      return { txHash: parsed.tx_hash, txIndex: parsed.cert_index };
    }
  }
  // Last resort: use tx_hash + cert_index
  if (action.tx_hash) {
    const index = action.cert_index ?? 0;
    return { txHash: action.tx_hash, txIndex: index };
  }
  throw new Error('Unable to resolve governance action transaction hash/index for voting');
}

export async function submitVoteTransaction(params: SubmitVoteParams): Promise<string> {
  const { wallet, action, vote, drepId: providedDRepId, anchorUrl, anchorHash, onStageChange } = params;
  onStageChange?.('initializing');

  // Resolve governance action ID
  const govActionId = extractGovernanceActionId(action);

  // Determine DRep ID (wallet override if not provided)
  let drepId = providedDRepId;
  if (!drepId) {
    const dRep = await wallet.wallet.getDRep();
    drepId = dRep?.dRepIDCip105;
  }
  if (!drepId) {
    throw new Error('DRep ID not available from wallet. Ensure your wallet is registered as a DRep.');
  }

  // Prepare network & provider
  const networkId = await wallet.wallet.getNetworkId();
  const koiosNetwork = resolveKoiosNetwork(networkId);
  const koiosApiKey = process.env.NEXT_PUBLIC_KOIOS_API_KEY;
  if (!koiosApiKey) {
    throw new Error('Koios API key missing (NEXT_PUBLIC_KOIOS_API_KEY). Voting requires a Koios provider.');
  }

  const provider = new KoiosProvider(koiosNetwork, koiosApiKey);
  const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

  // Gather wallet context
  const utxos = await wallet.wallet.getUtxos();
  const changeAddress = await wallet.wallet.getChangeAddress();

  // Build vote kind object with optional anchor
  const voteKind = mapVoteKind(vote);
  const votingProcedure: { voteKind: 'Yes' | 'No' | 'Abstain'; anchor?: { anchorUrl: string; anchorDataHash: string } } = {
    voteKind,
    ...(anchorUrl && anchorHash ? { anchor: { anchorUrl, anchorDataHash: anchorHash } } : {}),
  };

  // Add vote to transaction
  txBuilder
    .vote(
      { type: 'DRep', drepId },
      { txHash: govActionId.txHash, txIndex: govActionId.txIndex },
      votingProcedure
    )
    .selectUtxosFrom(utxos)
    .changeAddress(changeAddress);

  onStageChange?.('building');
  const unsignedTx = await txBuilder.complete();

  onStageChange?.('signing');
  const signedTx = await wallet.wallet.signTx(unsignedTx);

  onStageChange?.('submitting');
  const txHash = await wallet.wallet.submitTx(signedTx);
  return txHash;
}
