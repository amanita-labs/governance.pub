# Governance Transactions Research & Implementation Plan

## Executive Summary

This document outlines the research findings and implementation plan for building Cardano governance transactions in the govtwool app using Mesh SDK. The current implementation uses placeholder transaction builders that need to be replaced with proper Mesh SDK `MeshTxBuilder` implementations.

## 1. Current State Analysis

### 1.1 Existing Infrastructure

**Wallet Connection:**
- ✅ Wallet connection implemented using `BrowserWallet` from `@meshsdk/core`
- ✅ Supports multiple wallets: Nami, Eternl, Flint, Gero, Lace, Typhon, Nufi, Begin, Vespr, Yoroi
- ✅ Wallet context provider for React components
- ✅ Wallet state management with localStorage persistence

**Transaction Infrastructure:**
- ✅ `useTransaction` hook for transaction state management
- ✅ `TransactionModal` component for transaction progress
- ✅ Placeholder transaction builders in `lib/transactions/`:
  - `delegate.ts` - Vote delegation (placeholder)
  - `registerDRep.ts` - DRep registration (placeholder)

**UI Components:**
- ✅ `DelegateForm` - UI for delegating to DReps
- ✅ `RegisterDRepForm` - UI for registering as DRep
- ✅ `ActionDetail` - View governance actions (no voting UI yet)

**Data Fetching:**
- ✅ Blockfrost provider configured
- ✅ Governance data fetching implemented (DReps, Actions, Votes)
- ✅ Blockfrost API endpoints for governance data

### 1.2 Missing Functionality

**Transaction Building:**
- ❌ Actual transaction building using `MeshTxBuilder`
- ❌ Proper UTXO selection and fee handling
- ❌ DRep ID retrieval from wallet
- ❌ Anchor hash computation
- ❌ Vote transaction building

**Features:**
- ❌ Voting on governance actions
- ❌ DRep retirement/deregistration
- ❌ DRep update transactions
- ❌ Direct voting (non-delegated)

## 2. Mesh SDK Governance Transactions API

### 2.1 MeshTxBuilder Overview

According to [Mesh.js documentation](https://meshjs.dev/apis/txbuilder/governance), `MeshTxBuilder` is the low-level API for building governance transactions. It requires:

```typescript
// MeshTxBuilder is available from @meshsdk/core (re-exported from @meshsdk/transaction)
// Or directly from @meshsdk/transaction
import { MeshTxBuilder } from '@meshsdk/core';
// import { hashDrepAnchor } from '@meshsdk/common'; // For anchor hash computation

const txBuilder = new MeshTxBuilder({
  fetcher: provider, // BlockfrostProvider instance
  verbose: true,
});
```

**Note:** `MeshTxBuilder` is exported from `@meshsdk/transaction` but may be re-exported by `@meshsdk/core`. If imports fail, use `@meshsdk/transaction` directly.

### 2.2 Governance Transaction Types

#### 2.2.1 Vote Delegation

**Purpose:** Delegate voting power to a DRep

**API:**
```typescript
txBuilder
  .voteDelegationCertificate(
    {
      dRepId: 'drep1...',
    },
    rewardAddress
  )
  .changeAddress(changeAddress)
  .selectUtxosFrom(utxos);
```

**Requirements:**
- DRep ID (string)
- Reward address from wallet
- Change address from wallet
- UTXOs from wallet (at least 5 ADA recommended, 10 ADA threshold buffer)
- Transaction fee (~1 ADA)

**Steps:**
1. Get wallet UTXOs via `wallet.getUtxos()`
2. Get reward addresses via `wallet.getRewardAddresses()`
3. Get change address via `wallet.getChangeAddress()`
4. Build transaction with `voteDelegationCertificate()`
5. Complete, sign, and submit

#### 2.2.2 DRep Registration

**Purpose:** Register as a Decentralized Representative

**API:**
```typescript
txBuilder
  .drepRegistrationCertificate(dRepId, {
    anchorUrl: 'https://...',
    anchorDataHash: '0x...',
  })
  .changeAddress(changeAddress)
  .selectUtxosFrom(utxos);
```

**Requirements:**
- DRep ID from wallet (via `wallet.getDRep()`)
- Anchor URL (optional but recommended)
- Anchor data hash (computed from anchor URL)
- Deposit: 500 ADA (must have at least 505 ADA in UTXOs)
- Transaction fee (~1 ADA)

**Steps:**
1. Get DRep ID via `wallet.getDRep()` → `dRep.dRepIDCip105`
2. Compute anchor hash from anchor URL (if provided)
3. Get UTXOs and select those with at least 505 ADA
4. Build transaction with `drepRegistrationCertificate()`
5. Complete, sign, and submit

**Anchor Hash Computation:**
```typescript
async function getMeshJsonHash(url: string): Promise<string> {
  const response = await fetch(url);
  const anchorObj = await response.json();
  return hashDrepAnchor(anchorObj);
}
```

**Note:** Need to check if Mesh SDK provides `hashDrepAnchor` or if we need to implement it.

#### 2.2.3 DRep Retirement

**Purpose:** Retire a DRep and get deposit refund

**API:**
```typescript
txBuilder
  .drepDeregistrationCertificate(dRepId)
  .selectUtxosFrom(utxos)
  .changeAddress(changeAddress);
```

**Requirements:**
- DRep ID from wallet
- UTXOs for fees (~1 ADA)
- Change address
- Deposit refunded automatically

**Steps:**
1. Get DRep ID via `wallet.getDRep()`
2. Get UTXOs and change address
3. Build transaction with `drepDeregistrationCertificate()`
4. Complete, sign, and submit

#### 2.2.4 Voting on Governance Actions

**Purpose:** Vote on a governance action (as DRep, SPO, or CC member)

**API:**
```typescript
txBuilder
  .vote(
    {
      type: "DRep",
      drepId: dRepId,
    },
    {
      txHash: '0x...',
      txIndex: 0,
    },
    {
      voteKind: "Yes", // "Yes" | "No" | "Abstain"
      anchor: {
        anchorUrl: "https://...",
        anchorDataHash: "0x...",
      }, // optional
    }
  )
  .selectUtxosFrom(utxos)
  .changeAddress(changeAddress);
```

**Requirements:**
- Voter type: "DRep" | "SPO" | "CC" (Constitutional Committee)
- DRep ID (if type is "DRep")
- Governance action ID (txHash + txIndex)
- Vote kind: "Yes" | "No" | "Abstain"
- Optional anchor
- UTXOs for fees (~1 ADA)

**Steps:**
1. Determine voter type (check if wallet has DRep, SPO, or CC credentials)
2. Get governance action ID (from action detail page)
3. Build transaction with `vote()`
4. Complete, sign, and submit

**Voter Types:**
- **DRep:** Use `wallet.getDRep()` to get DRep ID
- **SPO:** Use stake pool credentials
- **CC:** Use constitutional committee credentials

### 2.3 Transaction Flow

All governance transactions follow this pattern:

```typescript
// 1. Get wallet data
const utxos = await wallet.getUtxos();
const changeAddress = await wallet.getChangeAddress();
const rewardAddresses = await wallet.getRewardAddresses();
const rewardAddress = rewardAddresses[0];

// 2. Initialize transaction builder
const txBuilder = new MeshTxBuilder({
  fetcher: blockfrostProvider,
  verbose: true,
});

// 3. Build transaction
txBuilder
  .<governanceMethod>(...)
  .changeAddress(changeAddress)
  .selectUtxosFrom(utxos);

// 4. Complete, sign, and submit
const unsignedTx = await txBuilder.complete();
const signedTx = await wallet.signTx(unsignedTx);
const txHash = await wallet.submitTx(signedTx);
```

### 2.4 UTXO Selection

**For Vote Delegation:**
- Need at least 5 ADA (use 10 ADA threshold buffer)
- Fee is less than 1 ADA

**For DRep Registration:**
- Need 500 ADA deposit + fees
- Use 505 ADA threshold buffer
- Use `selectUtxosFrom()` with threshold

**For Voting:**
- Need only fees (~1 ADA)
- Use standard UTXO selection

**For DRep Retirement:**
- Need only fees (~1 ADA)
- Deposit refunded automatically

## 3. Key Implementation Details

### 3.1 DRep ID Retrieval

```typescript
const dRep = await wallet.getDRep();
const dRepId = dRep.dRepIDCip105;
```

**Note:** This method may not be available in all wallets. Need to handle gracefully.

### 3.2 Anchor Hash Computation

From Mesh.js docs, anchor hash is computed from JSON-LD anchor data:

```typescript
async function getMeshJsonHash(url: string): Promise<string> {
  const response = await fetch(url);
  const data = await response.json();
  // Mesh SDK should provide hashDrepAnchor function
  return hashDrepAnchor(data);
}
```

**Verified:** `hashDrepAnchor` is exported from `@meshsdk/common` package. We can import it as:
```typescript
import { hashDrepAnchor } from '@meshsdk/common';
```

### 3.3 Governance Action ID Format

Governance action ID is a tuple:
```typescript
{
  txHash: string;  // Transaction hash where action was submitted
  txIndex: number; // Transaction index (usually 0)
}
```

This is available in `GovernanceAction` type as:
- `action.tx_hash` → `txHash`
- Extract `txIndex` from `action.action_id` or use 0 (need to verify)

### 3.4 Error Handling

**Common Errors:**
- Insufficient ADA for deposit/fees
- Wallet doesn't support governance methods
- Invalid DRep ID
- Network errors (Blockfrost API)
- Transaction building errors

**Error Handling Strategy:**
- Validate wallet balance before building transactions
- Check if wallet methods are available
- Provide clear error messages to users
- Handle network errors gracefully

### 3.5 Transaction State Management

Current `useTransaction` hook provides:
- `isBuilding` - Transaction is being built
- `isSigning` - Transaction is being signed
- `isSubmitting` - Transaction is being submitted
- `txHash` - Transaction hash on success
- `error` - Error message on failure

**Enhancement Needed:**
- Add step-by-step progress tracking
- Show estimated fees
- Show deposit amounts (for DRep registration)
- Allow cancellation during building

## 4. Implementation Plan

### Phase 1: Core Transaction Infrastructure

**1.1 Create MeshTxBuilder Utility**
- Create `lib/transactions/mesh-tx-builder.ts`
- Initialize `MeshTxBuilder` with Blockfrost provider
- Export helper functions for common operations

**1.2 Update Transaction Builders**
- Replace `Transaction` with `MeshTxBuilder` in:
  - `lib/transactions/delegate.ts`
  - `lib/transactions/registerDRep.ts`
- Implement proper UTXO selection
- Add error handling

**1.3 Create Helper Functions**
- `getDRepIdFromWallet()` - Get DRep ID from wallet
- `computeAnchorHash()` - Compute anchor hash from URL
- `selectUtxosForTransaction()` - Smart UTXO selection
- `validateWalletBalance()` - Check if wallet has enough ADA

### Phase 2: Vote Delegation Implementation

**2.1 Update `delegate.ts`**
- Implement `buildDelegationTransaction()` using `MeshTxBuilder`
- Add reward address retrieval
- Add proper UTXO selection (10 ADA threshold)
- Add validation

**2.2 Update `DelegateForm`**
- Add balance checking
- Show estimated fees
- Improve error messages

### Phase 3: DRep Registration Implementation

**3.1 Update `registerDRep.ts`**
- Implement `buildDRepRegistrationTransaction()` using `MeshTxBuilder`
- Add DRep ID retrieval from wallet
- Add anchor hash computation
- Add deposit validation (505 ADA threshold)
- Add anchor URL validation

**3.2 Create Anchor Helper**
- Create `lib/governance-anchor.ts`
- Implement anchor hash computation
- Add anchor validation

**3.3 Update `RegisterDRepForm`**
- Add deposit display
- Add balance checking
- Add anchor URL validation
- Improve error messages

### Phase 4: Voting Implementation

**4.1 Create Vote Transaction Builder**
- Create `lib/transactions/vote.ts`
- Implement `buildVoteTransaction()` using `MeshTxBuilder`
- Support DRep, SPO, and CC voting
- Add governance action ID parsing

**4.2 Create Vote UI Component**
- Create `components/VoteForm.tsx`
- Add vote selection (Yes/No/Abstain)
- Add optional anchor input
- Integrate with `ActionDetail` page

**4.3 Update `ActionDetail` Component**
- Add "Vote" button (if user is eligible)
- Check if user can vote (DRep, SPO, or CC)
- Show voting eligibility status

### Phase 5: DRep Retirement Implementation

**5.1 Create Retirement Transaction Builder**
- Create `lib/transactions/retireDRep.ts`
- Implement `buildDRepRetirementTransaction()` using `MeshTxBuilder`
- Add validation

**5.2 Create Retirement UI**
- Add retirement option to DRep detail page
- Add confirmation dialog
- Show deposit refund information

### Phase 6: Testing & Polish

**6.1 Error Handling**
- Comprehensive error handling
- User-friendly error messages
- Network error recovery

**6.2 Transaction Monitoring**
- Add transaction status checking
- Add confirmation count display
- Add transaction history

**6.3 UI/UX Improvements**
- Loading states
- Progress indicators
- Success animations
- Transaction receipts

## 5. Dependencies & Requirements

### 5.1 Mesh SDK Methods Required

**From Wallet:**
- `wallet.getUtxos()` ✅ Available
- `wallet.getRewardAddresses()` ✅ Available
- `wallet.getChangeAddress()` ✅ Available
- `wallet.getDRep()` ⚠️ Need to verify availability
- `wallet.signTx()` ✅ Available
- `wallet.submitTx()` ✅ Available

**From Mesh SDK:**
- `MeshTxBuilder` ✅ Available
- `BlockfrostProvider` ✅ Available
- `hashDrepAnchor()` ⚠️ Need to verify

### 5.2 Blockfrost API Requirements

- ✅ Blockfrost provider configured
- ✅ API key in environment variables
- ✅ Network selection (mainnet/testnet)

### 5.3 Environment Variables

```env
BLOCKFROST_API_KEY=your_api_key_here
BLOCKFROST_NETWORK=mainnet|preview
```

## 6. Research Questions & Open Issues

### 6.1 DRep ID Retrieval

**Question:** Does `wallet.getDRep()` work with all Cardano wallets?

**Research Needed:**
- Test with multiple wallets
- Check CIP-1694 wallet API specification
- Implement fallback if method not available

### 6.2 Anchor Hash Computation

**Question:** Does Mesh SDK provide `hashDrepAnchor()` function?

**Research Needed:**
- Check Mesh SDK exports
- Check CIP-1694 anchor specification
- Implement if not available

### 6.3 Governance Action ID Parsing

**Question:** How to extract `txIndex` from `action.action_id`?

**Research Needed:**
- Check Blockfrost API response format
- Check CIP-1694 action ID format
- Verify if `txIndex` is always 0 or needs parsing

### 6.4 UTXO Selection Strategy

**Question:** What's the optimal UTXO selection strategy?

**Research Needed:**
- Test different threshold values
- Optimize for minimal UTXOs
- Consider transaction size limits

### 6.5 Voting Eligibility Detection

**Question:** How to detect if user can vote (DRep, SPO, or CC)?

**Research Needed:**
- Check wallet methods for credentials
- Check CIP-1694 voting eligibility
- Implement credential checking

## 7. Reference Implementation (govtool)

From [govtool repository](https://github.com/IntersectMBO/govtool/tree/develop/govtool/frontend/src):

**Key Files to Review:**
- Transaction building logic
- Wallet integration
- Error handling patterns
- UI/UX patterns

**Note:** This is a reference only - our implementation should follow Mesh SDK patterns.

## 8. Testing Strategy

### 8.1 Unit Tests

- Transaction builder functions
- Helper functions (anchor hash, UTXO selection)
- Error handling

### 8.2 Integration Tests

- Wallet connection
- Transaction building
- Transaction submission
- Error scenarios

### 8.3 E2E Tests

- Complete user flows:
  - Delegate voting rights
  - Register as DRep
  - Vote on action
  - Retire DRep

### 8.4 Testnet Testing

- Test all transactions on preview/testnet
- Verify transaction correctness
- Test error scenarios
- Performance testing

## 9. Next Steps

1. **Verify Mesh SDK Methods**
   - Check if `wallet.getDRep()` is available
   - Check if `hashDrepAnchor()` is exported
   - Test with multiple wallets

2. **Create MeshTxBuilder Utility**
   - Set up transaction builder infrastructure
   - Create helper functions

3. **Implement Vote Delegation**
   - Start with simplest transaction
   - Test thoroughly
   - Iterate based on feedback

4. **Implement DRep Registration**
   - Add anchor hash computation
   - Test deposit handling

5. **Implement Voting**
   - Add voting UI
   - Test with different voter types

6. **Implement DRep Retirement**
   - Add retirement flow
   - Test deposit refund

7. **Polish & Test**
   - Error handling
   - UI/UX improvements
   - Comprehensive testing

## 10. Resources

- [Mesh.js Governance Transactions Docs](https://meshjs.dev/apis/txbuilder/governance)
- [CIP-1694 Specification](https://github.com/cardano-foundation/CIPs/blob/master/CIP-1694/README.md)
- [Blockfrost Governance API](https://docs.blockfrost.io/#tag/Cardano--Governance)
- [govtool Reference Implementation](https://github.com/IntersectMBO/govtool)

---

**Document Version:** 1.0  
**Last Updated:** 2024-12-19  
**Status:** Research Complete, Ready for Implementation

