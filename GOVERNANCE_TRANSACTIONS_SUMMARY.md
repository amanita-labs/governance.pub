# Governance Transactions Research Summary

## Overview

This document summarizes the research findings for implementing Cardano governance transactions in the govtwool app using Mesh SDK.

## Research Status: ✅ COMPLETE

All necessary information has been researched and documented. The app is ready for implementation.

## Key Findings

### 1. Mesh SDK Integration ✅

**MeshTxBuilder:**
- Available from `@meshsdk/core` (may be re-exported from `@meshsdk/transaction`)
- If re-export fails, import directly from `@meshsdk/transaction`
- Already installed in project: `@meshsdk/core@1.9.0-beta.86`

**hashDrepAnchor:**
- ✅ Available from `@meshsdk/common` package
- Can be imported directly: `import { hashDrepAnchor } from '@meshsdk/common';`

**BlockfrostProvider:**
- ✅ Already configured in `lib/blockfrost.ts`
- Ready to use with MeshTxBuilder

### 2. Governance Transaction Types

All four main governance transaction types are supported by Mesh SDK:

1. **Vote Delegation** ✅
   - Method: `voteDelegationCertificate()`
   - Requirements: DRep ID, reward address, UTXOs (10 ADA threshold)

2. **DRep Registration** ✅
   - Method: `drepRegistrationCertificate()`
   - Requirements: DRep ID (from wallet), anchor (optional), deposit (500 ADA)

3. **DRep Retirement** ✅
   - Method: `drepDeregistrationCertificate()`
   - Requirements: DRep ID (from wallet), UTXOs (2 ADA threshold)
   - Deposit automatically refunded

4. **Voting on Actions** ✅
   - Method: `vote()`
   - Requirements: Voter type (DRep/SPO/CC), action ID, vote kind (Yes/No/Abstain)
   - Supports optional anchor

### 3. Current State

**✅ Already Implemented:**
- Wallet connection infrastructure
- Transaction state management (`useTransaction` hook)
- Transaction modal component
- UI components for delegation and DRep registration
- Data fetching from Blockfrost API
- Type definitions for governance types

**❌ Needs Implementation:**
- Actual transaction building using `MeshTxBuilder`
- Vote delegation transaction
- DRep registration transaction
- DRep retirement transaction
- Voting on governance actions
- Proper UTXO selection
- Balance validation
- Anchor hash computation

### 4. Implementation Requirements

**Dependencies:**
- ✅ `@meshsdk/core@1.9.0-beta.86` - Already installed
- ✅ `@meshsdk/common` - Available (via core dependency)
- ✅ `BlockfrostProvider` - Already configured

**Environment Variables:**
- ✅ `BLOCKFROST_API_KEY` - Required
- ✅ `BLOCKFROST_NETWORK` - Required (mainnet/preview)

**Wallet Methods Required:**
- ✅ `wallet.getUtxos()` - Available
- ✅ `wallet.getRewardAddresses()` - Available
- ✅ `wallet.getChangeAddress()` - Available
- ⚠️ `wallet.getDRep()` - Need to verify availability (may not be in all wallets)
- ✅ `wallet.signTx()` - Available
- ✅ `wallet.submitTx()` - Available

## Implementation Plan

### Phase 1: Foundation (Est. 2-3 hours)
1. Create `lib/transactions/mesh-tx-builder.ts` utility
2. Create `lib/transactions/errors.ts` for error handling
3. Implement helper functions:
   - `createTxBuilder()`
   - `getDRepIdFromWallet()`
   - `computeAnchorHash()`
   - `validateWalletBalance()`
   - `selectUtxosWithThreshold()`

### Phase 2: Vote Delegation (Est. 2-3 hours)
1. Update `lib/transactions/delegate.ts` with MeshTxBuilder
2. Test vote delegation transaction
3. Update `components/DelegateForm.tsx` with balance checking
4. Test on testnet

### Phase 3: DRep Registration (Est. 3-4 hours)
1. Update `lib/transactions/registerDRep.ts` with MeshTxBuilder
2. Implement anchor hash computation
3. Test DRep registration transaction
4. Update `components/RegisterDRepForm.tsx` with deposit display
5. Test on testnet

### Phase 4: Voting (Est. 3-4 hours)
1. Create `lib/transactions/vote.ts`
2. Create `components/VoteForm.tsx`
3. Update `components/ActionDetail.tsx` with voting UI
4. Test voting transaction
5. Test on testnet

### Phase 5: DRep Retirement (Est. 2-3 hours)
1. Create `lib/transactions/retireDRep.ts`
2. Update `components/DRepDetail.tsx` with retirement option
3. Test retirement transaction
4. Test on testnet

### Phase 6: Testing & Polish (Est. 4-6 hours)
1. Comprehensive error handling
2. Transaction monitoring
3. UI/UX improvements
4. E2E testing
5. Documentation

**Total Estimated Time: 16-23 hours**

## Documentation

Comprehensive documentation has been created:

1. **GOVERNANCE_TRANSACTIONS_RESEARCH.md**
   - Complete research findings
   - API documentation
   - Implementation details
   - Open questions and answers

2. **GOVERNANCE_TRANSACTIONS_IMPLEMENTATION_PLAN.md**
   - Step-by-step implementation plan
   - Code examples for each phase
   - Testing strategy
   - Risk mitigation

3. **GOVERNANCE_TRANSACTIONS_SUMMARY.md** (this document)
   - Quick reference summary
   - Key findings
   - Implementation timeline

## Next Steps

1. **Review the documentation** - Read both research and implementation plan documents
2. **Start Phase 1** - Create foundation infrastructure
3. **Test incrementally** - Test each phase on testnet before moving to next
4. **Iterate based on feedback** - Refine implementation based on testing results

## Key Resources

- [Mesh.js Governance Transactions Docs](https://meshjs.dev/apis/txbuilder/governance)
- [CIP-1694 Specification](https://github.com/cardano-foundation/CIPs/blob/master/CIP-1694/README.md)
- [Blockfrost Governance API](https://docs.blockfrost.io/#tag/Cardano--Governance)
- [govtool Reference Implementation](https://github.com/IntersectMBO/govtool)

## Questions Resolved

✅ **Q: Does Mesh SDK provide MeshTxBuilder?**
A: Yes, available from `@meshsdk/core` or `@meshsdk/transaction`

✅ **Q: Does Mesh SDK provide hashDrepAnchor?**
A: Yes, available from `@meshsdk/common` package

✅ **Q: What wallet methods are needed?**
A: All required methods are standard CIP-1694 wallet methods (getUtxos, getRewardAddresses, etc.)

✅ **Q: How to handle DRep ID retrieval?**
A: Use `wallet.getDRep()` → `dRep.dRepIDCip105` (may not be available in all wallets)

✅ **Q: What are the transaction requirements?**
A: Documented in research document with specific thresholds and deposit amounts

## Risk Assessment

**Low Risk:**
- ✅ Mesh SDK is well-documented
- ✅ Blockfrost provider is already configured
- ✅ Wallet infrastructure is in place

**Medium Risk:**
- ⚠️ `wallet.getDRep()` may not be available in all wallets - Need fallback
- ⚠️ Transaction building errors - Need comprehensive error handling

**Mitigation:**
- Implement graceful fallbacks for missing wallet methods
- Comprehensive error handling and user-friendly messages
- Test on multiple wallets
- Test on testnet before mainnet

---

**Research Completed:** 2024-12-19  
**Status:** Ready for Implementation  
**Next Action:** Review documentation and begin Phase 1

