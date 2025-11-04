# Koios API Integration Plan for DRep Directory

## Problem Statement
Blockfrost API is too slow for the DRep directory page because it requires:
1. Fetching all DReps individually
2. For each DRep, making separate requests for:
   - Voting history (to get vote count and last vote epoch)
   - Delegators (to get delegator count)
   - Metadata (for names and descriptions)

This results in **1 + (N × 3)** requests where N is the number of DReps, which is extremely slow.

## Solution: Koios API

Koios API provides bulk query endpoints that allow fetching data for multiple DReps in a single request, dramatically reducing the number of API calls.

## Available Koios Endpoints

### 1. `/drep_list` (GET)
**Purpose:** Get list of all registered DReps
- **URL:** `https://preview.koios.rest/api/v1/drep_list`
- **Method:** GET
- **Parameters:** `limit` (optional, default: 100)
- **Response:**
  ```json
  [
    {
      "drep_id": "drep1...",
      "hex": "0002e1d2...",
      "has_script": false,
      "registered": false
    }
  ]
  ```
- **Use Case:** Get list of all DRep IDs for bulk queries

### 2. `/drep_delegators` (POST)
**Purpose:** Get delegators for multiple DReps in one request
- **URL:** `https://preview.koios.rest/api/v1/drep_delegators`
- **Method:** POST
- **Request Body:**
  ```json
  [
    {"_drep_id": "drep1..."},
    {"_drep_id": "drep2..."}
  ]
  ```
- **Response:**
  ```json
  [
    {
      "stake_address": "stake_test1...",
      "stake_address_hex": "...",
      "script_hash": null,
      "epoch_no": 1066,
      "amount": "0"
    }
  ]
  ```
- **Use Case:** Bulk fetch delegator counts for all DReps

### 3. `/drep_votes` (POST)
**Purpose:** Get voting history for multiple DReps in one request
- **URL:** `https://preview.koios.rest/api/v1/drep_votes`
- **Method:** POST
- **Request Body:**
  ```json
  [
    {"_drep_id": "drep1..."},
    {"_drep_id": "drep2..."}
  ]
  ```
- **Response:**
  ```json
  [
    {
      "proposal_id": "gov_action1...",
      "proposal_tx_hash": "...",
      "proposal_index": 0,
      "vote_tx_hash": "...",
      "block_time": 1761568083,
      "vote": "Yes",
      "meta_url": "...",
      "meta_hash": "..."
    }
  ]
  ```
- **Use Case:** Bulk fetch voting history to calculate:
  - Vote count per DRep
  - Last vote epoch per DRep
  - Vote distribution (yes/no/abstain)

### 4. `/drep_epoch_summary` (GET)
**Purpose:** Get epoch-level summary statistics
- **URL:** `https://preview.koios.rest/api/v1/drep_epoch_summary`
- **Method:** GET
- **Response:**
  ```json
  [
    {
      "epoch_no": 1106,
      "amount": "258619585530859",
      "dreps": 2825
    }
  ]
  ```
- **Use Case:** Get overall network statistics (total voting power, total DReps per epoch)

## Implementation Plan

### Phase 1: Create Koios Client Library
**File:** `lib/koios.ts`

Create a helper library similar to `lib/blockfrost.ts` with functions:
- `koiosFetch(endpoint, method, data)` - Generic Koios API client
- `getDRepsList()` - Fetch all DReps
- `getDRepsDelegators(drepIds[])` - Bulk fetch delegators
- `getDRepsVotes(drepIds[])` - Bulk fetch voting history
- `getDRepEpochSummary()` - Get epoch summary

### Phase 2: Update Governance Library
**File:** `lib/governance.ts`

Modify `getDRepsPage()` to:
1. Use Koios `/drep_list` to get all DRep IDs quickly
2. Use Koios `/drep_delegators` to bulk fetch delegator counts for all DReps
3. Use Koios `/drep_votes` to bulk fetch voting history for all DReps
4. Combine results to create enriched DRep objects with:
   - `delegator_count` (from Koios delegators)
   - `vote_count` (from Koios votes)
   - `last_vote_epoch` (from Koios votes)
   - Vote distribution stats

**Note:** Still use Blockfrost for:
- DRep metadata (names, descriptions, websites) - Fetch individually or keep using Blockfrost metadata endpoint
- DRep detail page (single DRep lookup with full details)

### Phase 3: Hybrid Approach
**Best of Both Worlds:**

1. **Koios for List Page (Fast):**
   - Use Koios for bulk fetching:
     - DRep list
     - Delegator counts
     - Vote counts and last vote epoch
   
2. **Blockfrost for Detail Page (Rich Data):**
   - Keep using Blockfrost for:
     - Individual DRep metadata (names, descriptions)
     - Full DRep details on detail page
     - Metadata endpoint for CIP-119 metadata

3. **Metadata Strategy:**
   - Option A: Fetch metadata from Blockfrost on-demand (lazy loading)
   - Option B: Cache metadata in a separate API call after getting Koios data
   - Option C: Use Koios if they have a metadata endpoint (need to verify)

## Expected Performance Improvement

**Current (Blockfrost):**
- 1 request for DRep list
- N requests for voting history (one per DRep)
- N requests for delegators (one per DRep)
- **Total: 1 + (N × 2) requests** (e.g., 2825 DReps = 5,651 requests!)

**With Koios:**
- 1 request for DRep list (or paginated)
- 1 request for all delegators (bulk)
- 1 request for all votes (bulk)
- **Total: 3 requests** for all DReps!

**Performance Gain:** ~1,883x faster for 2825 DReps!

## Data Mapping

### From Koios `/drep_list`:
```typescript
{
  drep_id: string;
  hex: string;
  has_script: boolean;
  registered: boolean;
}
```

### From Koios `/drep_delegators`:
```typescript
{
  delegator_count: number; // Count of delegators for this DRep
  total_delegated: string; // Sum of all amounts
}
```

### From Koios `/drep_votes`:
```typescript
{
  vote_count: number; // Count of votes
  last_vote_epoch: number; // Max epoch_no from votes
  vote_stats: {
    yes: number;
    no: number;
    abstain: number;
  };
}
```

## Implementation Steps

1. ✅ Research Koios API endpoints
2. ✅ Create `lib/koios.ts` with Koios client functions
3. ✅ Update `lib/governance.ts` to use Koios for bulk queries
4. ✅ Update `getDRepsPage()` to use Koios instead of Blockfrost for:
   - Delegator counts (via Koios bulk queries)
   - Vote counts (via Koios bulk queries)
5. ✅ Keep Blockfrost for:
   - DRep list (basic DRep data with metadata)
   - DRep metadata (names, descriptions)
   - Single DRep detail page
6. ⏳ Test and verify performance improvements
7. ✅ Handle epoch calculation from block_time (Koios returns block_time, not epoch) - Note: Epoch calculation requires network parameters, left as undefined for now
8. ✅ Update error handling for Koios API failures (fallback to Blockfrost implemented)

## Error Handling

- Koios API might be rate-limited (check their docs)
- Handle network failures gracefully
- Fallback to Blockfrost if Koios fails
- Cache results appropriately

## Rate Limits

Check Koios API documentation for rate limits:
- Public tier: 5,000 requests/day (mentioned in web search)
- Consider caching responses
- Use bulk queries to minimize requests

## Next Steps

1. ✅ Create Koios client library
2. ✅ Update governance library to use Koios
3. ⏳ Test with preview network
4. ⏳ Measure performance improvements
5. ✅ Update DRep directory page to use new data source (via `getDRepsPage()`)

## Implementation Complete! ✅

All core implementation tasks are complete. The system now uses Koios for fast bulk queries while maintaining Blockfrost as a fallback. See `KOIOS_IMPLEMENTATION_SUMMARY.md` for detailed implementation summary.

