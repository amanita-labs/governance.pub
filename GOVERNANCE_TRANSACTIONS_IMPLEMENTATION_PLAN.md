# Governance Transactions Implementation Plan

## Overview

This document provides a detailed, step-by-step implementation plan for building Cardano governance transactions in the govtwool app using Mesh SDK's `MeshTxBuilder`.

## Implementation Phases

### Phase 1: Foundation & Infrastructure Setup

#### 1.1 Create MeshTxBuilder Utility Module

**File:** `lib/transactions/mesh-tx-builder.ts`

**Purpose:** Centralize MeshTxBuilder initialization and provide helper functions

**Implementation:**
```typescript
import { MeshTxBuilder } from '@meshsdk/core'; // May need to use @meshsdk/transaction if re-export fails
import { hashDrepAnchor } from '@meshsdk/common'; // For anchor hash computation
import { blockfrostProvider } from '@/lib/blockfrost';

// Initialize MeshTxBuilder with Blockfrost provider
export function createTxBuilder(): MeshTxBuilder {
  return new MeshTxBuilder({
    fetcher: blockfrostProvider,
    verbose: true,
  });
}

// Helper to get DRep ID from wallet
export async function getDRepIdFromWallet(wallet: any): Promise<string | null> {
  try {
    const dRep = await wallet.getDRep();
    return dRep?.dRepIDCip105 || null;
  } catch (error) {
    console.error('Error getting DRep ID:', error);
    return null;
  }
}

// Helper to compute anchor hash
export async function computeAnchorHash(anchorUrl: string): Promise<string | null> {
  try {
    const response = await fetch(anchorUrl);
    const data = await response.json();
    // Mesh SDK provides hashDrepAnchor from @meshsdk/common
    return hashDrepAnchor(data);
  } catch (error) {
    console.error('Error computing anchor hash:', error);
    return null;
  }
}

// Helper to validate wallet balance
export async function validateWalletBalance(
  wallet: any,
  requiredAmount: string // in lovelace
): Promise<{ valid: boolean; balance: string; error?: string }> {
  try {
    const utxos = await wallet.getUtxos();
    let totalBalance = BigInt(0);
    
    utxos.forEach((utxo: any) => {
      const lovelace = utxo.output?.amount?.find(
        (a: any) => a.unit === 'lovelace'
      );
      if (lovelace) {
        totalBalance += BigInt(lovelace.quantity);
      }
    });
    
    const required = BigInt(requiredAmount);
    return {
      valid: totalBalance >= required,
      balance: totalBalance.toString(),
      error: totalBalance < required
        ? `Insufficient balance. Required: ${requiredAmount}, Available: ${totalBalance.toString()}`
        : undefined,
    };
  } catch (error: any) {
    return {
      valid: false,
      balance: '0',
      error: error.message || 'Failed to validate balance',
    };
  }
}

// Helper to select UTXOs with threshold
export function selectUtxosWithThreshold(
  utxos: any[],
  threshold: string // in lovelace
): any[] {
  const thresholdBigInt = BigInt(threshold);
  let selectedUtxos: any[] = [];
  let totalSelected = BigInt(0);
  
  for (const utxo of utxos) {
    const lovelace = utxo.output?.amount?.find(
      (a: any) => a.unit === 'lovelace'
    );
    if (lovelace) {
      selectedUtxos.push(utxo);
      totalSelected += BigInt(lovelace.quantity);
      if (totalSelected >= thresholdBigInt) {
        break;
      }
    }
  }
  
  return selectedUtxos;
}
```

#### 1.2 Update Transaction Error Handling

**File:** `lib/transactions/errors.ts` (new)

**Purpose:** Standardize error handling for transactions

**Implementation:**
```typescript
export class TransactionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

export const TransactionErrorCodes = {
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INVALID_DREP_ID: 'INVALID_DREP_ID',
  INVALID_ANCHOR: 'INVALID_ANCHOR',
  BUILD_FAILED: 'BUILD_FAILED',
  SIGN_FAILED: 'SIGN_FAILED',
  SUBMIT_FAILED: 'SUBMIT_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;
```

### Phase 2: Vote Delegation Implementation

#### 2.1 Update Delegate Transaction Builder

**File:** `lib/transactions/delegate.ts`

**Implementation:**
```typescript
import { createTxBuilder, validateWalletBalance, selectUtxosWithThreshold } from './mesh-tx-builder';
import { TransactionError, TransactionErrorCodes } from './errors';
import type { ConnectedWallet } from '@/lib/mesh';

const DELEGATION_THRESHOLD = '10000000'; // 10 ADA in lovelace (buffer for fees)

export async function buildDelegationTransaction(
  wallet: ConnectedWallet,
  drepId: string
): Promise<string> {
  try {
    // Validate inputs
    if (!drepId || !drepId.startsWith('drep')) {
      throw new TransactionError(
        'Invalid DRep ID',
        TransactionErrorCodes.INVALID_DREP_ID
      );
    }

    // Get wallet data
    const utxos = await wallet.wallet.getUtxos();
    const rewardAddresses = await wallet.wallet.getRewardAddresses();
    const rewardAddress = rewardAddresses[0];
    const changeAddress = await wallet.wallet.getChangeAddress();

    if (!rewardAddress) {
      throw new TransactionError(
        'Reward address not found',
        TransactionErrorCodes.WALLET_NOT_CONNECTED
      );
    }

    // Validate balance
    const balanceCheck = await validateWalletBalance(
      wallet.wallet,
      DELEGATION_THRESHOLD
    );
    if (!balanceCheck.valid) {
      throw new TransactionError(
        balanceCheck.error || 'Insufficient balance',
        TransactionErrorCodes.INSUFFICIENT_BALANCE,
        balanceCheck
      );
    }

    // Select UTXOs
    const selectedUtxos = selectUtxosWithThreshold(utxos, DELEGATION_THRESHOLD);

    // Build transaction
    const txBuilder = createTxBuilder();
    txBuilder
      .voteDelegationCertificate(
        {
          dRepId: drepId,
        },
        rewardAddress
      )
      .changeAddress(changeAddress)
      .selectUtxosFrom(selectedUtxos);

    const unsignedTx = await txBuilder.complete();
    return unsignedTx;
  } catch (error: any) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      error.message || 'Failed to build delegation transaction',
      TransactionErrorCodes.BUILD_FAILED,
      error
    );
  }
}

export async function submitDelegationTransaction(
  wallet: ConnectedWallet,
  drepId: string
): Promise<string> {
  try {
    // Build transaction
    const unsignedTx = await buildDelegationTransaction(wallet, drepId);

    // Sign transaction
    const signedTx = await wallet.wallet.signTx(unsignedTx);

    // Submit transaction
    const txHash = await wallet.wallet.submitTx(signedTx);

    return txHash;
  } catch (error: any) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      error.message || 'Failed to submit delegation transaction',
      TransactionErrorCodes.SUBMIT_FAILED,
      error
    );
  }
}
```

#### 2.2 Enhance DelegateForm Component

**File:** `components/DelegateForm.tsx`

**Updates:**
- Add balance checking before delegation
- Show estimated fees
- Improve error messages
- Add loading states

**Key Changes:**
```typescript
// Add balance check before delegation
const checkBalance = async () => {
  // Check if wallet has sufficient balance
  // Show warning if balance is low
};

// Show estimated fees
const estimatedFees = '~1 ADA';
```

### Phase 3: DRep Registration Implementation

#### 3.1 Update DRep Registration Transaction Builder

**File:** `lib/transactions/registerDRep.ts`

**Implementation:**
```typescript
import { createTxBuilder, getDRepIdFromWallet, computeAnchorHash, validateWalletBalance, selectUtxosWithThreshold } from './mesh-tx-builder';
import { TransactionError, TransactionErrorCodes } from './errors';
import type { ConnectedWallet } from '@/lib/mesh';

const DREP_REGISTRATION_DEPOSIT = '500000000'; // 500 ADA in lovelace
const DREP_REGISTRATION_THRESHOLD = '505000000'; // 505 ADA (deposit + fees buffer)

export interface DRepRegistrationData {
  anchorUrl?: string;
  anchorHash?: string;
}

export async function buildDRepRegistrationTransaction(
  wallet: ConnectedWallet,
  registrationData: DRepRegistrationData
): Promise<string> {
  try {
    // Get DRep ID from wallet
    const dRepId = await getDRepIdFromWallet(wallet.wallet);
    if (!dRepId) {
      throw new TransactionError(
        'DRep ID not found. Please ensure your wallet supports DRep registration.',
        TransactionErrorCodes.INVALID_DREP_ID
      );
    }

    // Validate balance
    const balanceCheck = await validateWalletBalance(
      wallet.wallet,
      DREP_REGISTRATION_THRESHOLD
    );
    if (!balanceCheck.valid) {
      throw new TransactionError(
        balanceCheck.error || 'Insufficient balance for DRep registration',
        TransactionErrorCodes.INSUFFICIENT_BALANCE,
        balanceCheck
      );
    }

    // Compute anchor hash if anchor URL provided
    let anchorDataHash: string | undefined;
    if (registrationData.anchorUrl) {
      if (registrationData.anchorHash) {
        anchorDataHash = registrationData.anchorHash;
      } else {
        const computedHash = await computeAnchorHash(registrationData.anchorUrl);
        if (!computedHash) {
          throw new TransactionError(
            'Failed to compute anchor hash',
            TransactionErrorCodes.INVALID_ANCHOR
          );
        }
        anchorDataHash = computedHash;
      }
    }

    // Get wallet data
    const utxos = await wallet.wallet.getUtxos();
    const changeAddress = await wallet.wallet.getChangeAddress();

    // Select UTXOs
    const selectedUtxos = selectUtxosWithThreshold(
      utxos,
      DREP_REGISTRATION_THRESHOLD
    );

    // Build transaction
    const txBuilder = createTxBuilder();
    
    const anchor = (registrationData.anchorUrl && anchorDataHash) ? {
      anchorUrl: registrationData.anchorUrl,
      anchorDataHash: anchorDataHash,
    } : undefined;

    if (anchor) {
      txBuilder.drepRegistrationCertificate(dRepId, anchor);
    } else {
      txBuilder.drepRegistrationCertificate(dRepId);
    }

    txBuilder
      .changeAddress(changeAddress)
      .selectUtxosFrom(selectedUtxos);

    const unsignedTx = await txBuilder.complete();
    return unsignedTx;
  } catch (error: any) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      error.message || 'Failed to build DRep registration transaction',
      TransactionErrorCodes.BUILD_FAILED,
      error
    );
  }
}

export async function submitDRepRegistrationTransaction(
  wallet: ConnectedWallet,
  registrationData: DRepRegistrationData
): Promise<string> {
  try {
    // Build transaction
    const unsignedTx = await buildDRepRegistrationTransaction(
      wallet,
      registrationData
    );

    // Sign transaction
    const signedTx = await wallet.wallet.signTx(unsignedTx);

    // Submit transaction
    const txHash = await wallet.wallet.submitTx(signedTx);

    return txHash;
  } catch (error: any) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      error.message || 'Failed to submit DRep registration transaction',
      TransactionErrorCodes.SUBMIT_FAILED,
      error
    );
  }
}
```

#### 3.2 Enhance RegisterDRepForm Component

**File:** `components/RegisterDRepForm.tsx`

**Updates:**
- Add deposit display (500 ADA)
- Add balance checking
- Add anchor URL validation
- Improve error messages
- Add anchor hash auto-computation

**Key Changes:**
```typescript
// Show deposit amount
const depositAmount = '500 ADA';

// Check balance before registration
const checkBalance = async () => {
  // Validate balance
};

// Validate anchor URL
const validateAnchorUrl = async (url: string) => {
  // Check if URL is accessible
  // Compute hash if needed
};
```

### Phase 4: Voting Implementation

#### 4.1 Create Vote Transaction Builder

**File:** `lib/transactions/vote.ts` (new)

**Implementation:**
```typescript
import { createTxBuilder, getDRepIdFromWallet, computeAnchorHash, validateWalletBalance, selectUtxosWithThreshold } from './mesh-tx-builder';
import { TransactionError, TransactionErrorCodes } from './errors';
import type { ConnectedWallet } from '@/lib/mesh';

const VOTING_THRESHOLD = '2000000'; // 2 ADA in lovelace (buffer for fees)

export type VoteKind = 'Yes' | 'No' | 'Abstain';
export type VoterType = 'DRep' | 'SPO' | 'CC';

export interface VoteTransactionData {
  actionId: {
    txHash: string;
    txIndex: number;
  };
  voteKind: VoteKind;
  voterType: VoterType;
  drepId?: string; // Required if voterType is 'DRep'
  anchorUrl?: string;
  anchorHash?: string;
}

export async function buildVoteTransaction(
  wallet: ConnectedWallet,
  voteData: VoteTransactionData
): Promise<string> {
  try {
    // Validate inputs
    if (!voteData.actionId || !voteData.actionId.txHash) {
      throw new TransactionError(
        'Invalid governance action ID',
        TransactionErrorCodes.INVALID_DREP_ID
      );
    }

    // Get DRep ID if voting as DRep
    let drepId = voteData.drepId;
    if (voteData.voterType === 'DRep' && !drepId) {
      drepId = await getDRepIdFromWallet(wallet.wallet);
      if (!drepId) {
        throw new TransactionError(
          'DRep ID not found. Please ensure you are registered as a DRep.',
          TransactionErrorCodes.INVALID_DREP_ID
        );
      }
    }

    // Validate balance
    const balanceCheck = await validateWalletBalance(
      wallet.wallet,
      VOTING_THRESHOLD
    );
    if (!balanceCheck.valid) {
      throw new TransactionError(
        balanceCheck.error || 'Insufficient balance for voting',
        TransactionErrorCodes.INSUFFICIENT_BALANCE,
        balanceCheck
      );
    }

    // Compute anchor hash if anchor URL provided
    let anchorDataHash: string | undefined;
    if (voteData.anchorUrl) {
      if (voteData.anchorHash) {
        anchorDataHash = voteData.anchorHash;
      } else {
        const computedHash = await computeAnchorHash(voteData.anchorUrl);
        if (!computedHash) {
          throw new TransactionError(
            'Failed to compute anchor hash',
            TransactionErrorCodes.INVALID_ANCHOR
          );
        }
        anchorDataHash = computedHash;
      }
    }

    // Get wallet data
    const utxos = await wallet.wallet.getUtxos();
    const changeAddress = await wallet.wallet.getChangeAddress();

    // Select UTXOs
    const selectedUtxos = selectUtxosWithThreshold(utxos, VOTING_THRESHOLD);

    // Build voter object
    let voter: any;
    switch (voteData.voterType) {
      case 'DRep':
        voter = {
          type: 'DRep',
          drepId: drepId,
        };
        break;
      case 'SPO':
        // TODO: Implement SPO credential retrieval
        throw new TransactionError(
          'SPO voting not yet implemented',
          TransactionErrorCodes.BUILD_FAILED
        );
      case 'CC':
        // TODO: Implement CC credential retrieval
        throw new TransactionError(
          'CC voting not yet implemented',
          TransactionErrorCodes.BUILD_FAILED
        );
      default:
        throw new TransactionError(
          'Invalid voter type',
          TransactionErrorCodes.BUILD_FAILED
        );
    }

    // Build voting procedure
    const votingProcedure: any = {
      voteKind: voteData.voteKind,
    };

    if (voteData.anchorUrl && anchorDataHash) {
      votingProcedure.anchor = {
        anchorUrl: voteData.anchorUrl,
        anchorDataHash: anchorDataHash,
      };
    }

    // Build transaction
    const txBuilder = createTxBuilder();
    txBuilder
      .vote(
        voter,
        voteData.actionId,
        votingProcedure
      )
      .changeAddress(changeAddress)
      .selectUtxosFrom(selectedUtxos);

    const unsignedTx = await txBuilder.complete();
    return unsignedTx;
  } catch (error: any) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      error.message || 'Failed to build vote transaction',
      TransactionErrorCodes.BUILD_FAILED,
      error
    );
  }
}

export async function submitVoteTransaction(
  wallet: ConnectedWallet,
  voteData: VoteTransactionData
): Promise<string> {
  try {
    // Build transaction
    const unsignedTx = await buildVoteTransaction(wallet, voteData);

    // Sign transaction
    const signedTx = await wallet.wallet.signTx(unsignedTx);

    // Submit transaction
    const txHash = await wallet.wallet.submitTx(signedTx);

    return txHash;
  } catch (error: any) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      error.message || 'Failed to submit vote transaction',
      TransactionErrorCodes.SUBMIT_FAILED,
      error
    );
  }
}
```

#### 4.2 Create VoteForm Component

**File:** `components/VoteForm.tsx` (new)

**Purpose:** UI component for voting on governance actions

**Implementation:**
- Vote selection (Yes/No/Abstain)
- Optional anchor input
- Balance checking
- Transaction modal integration
- Error handling

#### 4.3 Update ActionDetail Component

**File:** `components/ActionDetail.tsx`

**Updates:**
- Add "Vote" button (if user is eligible)
- Check if user can vote (DRep, SPO, or CC)
- Integrate VoteForm component
- Show voting eligibility status

### Phase 5: DRep Retirement Implementation

#### 5.1 Create DRep Retirement Transaction Builder

**File:** `lib/transactions/retireDRep.ts` (new)

**Implementation:**
```typescript
import { createTxBuilder, getDRepIdFromWallet, validateWalletBalance, selectUtxosWithThreshold } from './mesh-tx-builder';
import { TransactionError, TransactionErrorCodes } from './errors';
import type { ConnectedWallet } from '@/lib/mesh';

const RETIREMENT_THRESHOLD = '2000000'; // 2 ADA in lovelace (buffer for fees)

export async function buildDRepRetirementTransaction(
  wallet: ConnectedWallet
): Promise<string> {
  try {
    // Get DRep ID from wallet
    const dRepId = await getDRepIdFromWallet(wallet.wallet);
    if (!dRepId) {
      throw new TransactionError(
        'DRep ID not found. Please ensure you are registered as a DRep.',
        TransactionErrorCodes.INVALID_DREP_ID
      );
    }

    // Validate balance
    const balanceCheck = await validateWalletBalance(
      wallet.wallet,
      RETIREMENT_THRESHOLD
    );
    if (!balanceCheck.valid) {
      throw new TransactionError(
        balanceCheck.error || 'Insufficient balance for retirement',
        TransactionErrorCodes.INSUFFICIENT_BALANCE,
        balanceCheck
      );
    }

    // Get wallet data
    const utxos = await wallet.wallet.getUtxos();
    const changeAddress = await wallet.wallet.getChangeAddress();

    // Select UTXOs
    const selectedUtxos = selectUtxosWithThreshold(utxos, RETIREMENT_THRESHOLD);

    // Build transaction
    const txBuilder = createTxBuilder();
    txBuilder
      .drepDeregistrationCertificate(dRepId)
      .changeAddress(changeAddress)
      .selectUtxosFrom(selectedUtxos);

    const unsignedTx = await txBuilder.complete();
    return unsignedTx;
  } catch (error: any) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      error.message || 'Failed to build DRep retirement transaction',
      TransactionErrorCodes.BUILD_FAILED,
      error
    );
  }
}

export async function submitDRepRetirementTransaction(
  wallet: ConnectedWallet
): Promise<string> {
  try {
    // Build transaction
    const unsignedTx = await buildDRepRetirementTransaction(wallet);

    // Sign transaction
    const signedTx = await wallet.wallet.signTx(unsignedTx);

    // Submit transaction
    const txHash = await wallet.wallet.submitTx(signedTx);

    return txHash;
  } catch (error: any) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      error.message || 'Failed to submit DRep retirement transaction',
      TransactionErrorCodes.SUBMIT_FAILED,
      error
    );
  }
}
```

#### 5.2 Update DRepDetail Component

**File:** `components/DRepDetail.tsx`

**Updates:**
- Add "Retire DRep" button (if user owns the DRep)
- Add confirmation dialog
- Show deposit refund information
- Integrate retirement transaction

### Phase 6: Testing & Polish

#### 6.1 Error Handling Improvements

- Comprehensive error messages
- Network error recovery
- Retry mechanisms
- User-friendly error display

#### 6.2 Transaction Monitoring

- Transaction status checking
- Confirmation count display
- Transaction history
- Success/failure notifications

#### 6.3 UI/UX Improvements

- Loading states
- Progress indicators
- Success animations
- Transaction receipts
- Balance display
- Fee estimation

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `lib/transactions/mesh-tx-builder.ts`
- [ ] Create `lib/transactions/errors.ts`
- [ ] Test MeshTxBuilder initialization
- [ ] Test helper functions

### Phase 2: Vote Delegation
- [ ] Update `lib/transactions/delegate.ts`
- [ ] Test vote delegation transaction
- [ ] Update `components/DelegateForm.tsx`
- [ ] Test on testnet

### Phase 3: DRep Registration
- [ ] Update `lib/transactions/registerDRep.ts`
- [ ] Implement anchor hash computation
- [ ] Test DRep registration transaction
- [ ] Update `components/RegisterDRepForm.tsx`
- [ ] Test on testnet

### Phase 4: Voting
- [ ] Create `lib/transactions/vote.ts`
- [ ] Create `components/VoteForm.tsx`
- [ ] Update `components/ActionDetail.tsx`
- [ ] Test voting transaction
- [ ] Test on testnet

### Phase 5: DRep Retirement
- [ ] Create `lib/transactions/retireDRep.ts`
- [ ] Update `components/DRepDetail.tsx`
- [ ] Test retirement transaction
- [ ] Test on testnet

### Phase 6: Testing & Polish
- [ ] Comprehensive error handling
- [ ] Transaction monitoring
- [ ] UI/UX improvements
- [ ] E2E testing
- [ ] Documentation

## Testing Strategy

### Unit Tests
- Transaction builder functions
- Helper functions
- Error handling

### Integration Tests
- Wallet connection
- Transaction building
- Transaction submission

### E2E Tests
- Complete user flows
- Error scenarios
- Network failures

### Testnet Testing
- All transaction types
- Error scenarios
- Performance testing

## Risk Mitigation

### Wallet Compatibility
- Test with multiple wallets
- Handle missing methods gracefully
- Provide clear error messages

### Network Issues
- Implement retry logic
- Handle timeouts
- Show network status

### Transaction Failures
- Comprehensive error handling
- User-friendly error messages
- Transaction status tracking

## Success Criteria

1. ✅ All governance transactions can be built and submitted
2. ✅ Error handling is comprehensive and user-friendly
3. ✅ UI/UX is polished and intuitive
4. ✅ All tests pass on testnet
5. ✅ Documentation is complete

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-19  
**Status:** Ready for Implementation

