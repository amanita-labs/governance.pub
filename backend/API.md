# GovTwool Backend API Documentation

## Base URL

```
Production: https://govtwool-backend.onrender.com
Local: http://localhost:8080
```

## Overview

The GovTwool Backend API provides a unified interface for accessing Cardano governance data from multiple providers (Blockfrost and Koios). The backend handles provider selection, caching, and data normalization automatically.

## Features

- **Smart Routing**: Automatically selects the best data provider for each operation
- **Automatic Fallback**: Gracefully falls back to alternative providers on failure
- **Caching**: High-performance in-memory caching with configurable TTLs
- **CORS Enabled**: All origins allowed by default
- **Type Safety**: Strong typing with Rust's type system

## Authentication

Currently, no authentication is required. The API is publicly accessible.

## Rate Limiting

Rate limiting is handled by the underlying data providers (Blockfrost and Koios). The backend includes caching to reduce provider API calls.

## Response Format

All responses are JSON. Error responses follow this format:

```json
{
  "error": "Error message"
}
```

## Status Codes

- `200 OK` - Request successful
- `404 NOT FOUND` - Resource not found
- `500 INTERNAL SERVER ERROR` - Server error

---

## Endpoints

### Health Check

Check the health status of the backend and its data providers.

**Endpoint:** `GET /health`

**Response:** `200 OK`

```json
{
  "status": "healthy",
  "providers": {
    "blockfrost": "ok",
    "koios": "ok"
  },
  "cache": {
    "enabled": true,
    "entries": 42,
    "hits": 150,
    "misses": 50,
    "hit_rate": "75.00%"
  }
}
```

**Response (Degraded):** `200 OK`

```json
{
  "status": "degraded",
  "providers": {
    "blockfrost": "unknown",
    "koios": "unknown"
  },
  "cache": {
    "enabled": true,
    "entries": 42,
    "hits": 150,
    "misses": 50,
    "hit_rate": "75.00%"
  }
}
```

---

## DRep Endpoints

### List DReps

Get a paginated list of Delegated Representatives (DReps).

**Endpoint:** `GET /api/dreps`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `count` | integer | 20 | Number of items per page |
| `enrich` | boolean | false | Whether to enrich with additional data (optional) |

**Example Request:**

```bash
GET /api/dreps?page=1&count=20
```

**Response:** `200 OK`

```json
{
  "dreps": [
    {
      "drep_id": "drep1ygqq33rjavhwwynp2pzj478fea67dxeelq2ylfwum0txhhqy8p3fn",
      "hex": "0008c472eb2ee7126150452af8e9cf75e69b39f8144fa5dcdbd66bdc",
      "status": "active",
      "active": true,
      "voting_power_active": "1000000000",
      "amount": "1000000000",
      "has_script": false,
      "retired": false,
      "expired": false,
      "last_active_epoch": 1107
    }
  ],
  "has_more": true,
  "total": 2831
}
```

**Response Fields:**

- `dreps`: Array of DRep objects (see DRep Model below)
- `has_more`: Boolean indicating if more pages are available
- `total`: Total number of DReps (may be omitted if not available)

---

### Get DRep Stats

Get statistics about DReps.

**Endpoint:** `GET /api/dreps/stats`

**Response:** `200 OK`

```json
{
  "active_dreps_count": 2831
}
```

**Response Fields:**

- `active_dreps_count`: Number of active DReps (may be `null` if unavailable)

---

### Get Single DRep

Get detailed information about a specific DRep.

**Endpoint:** `GET /api/dreps/:id`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | DRep ID (CIP-105 or CIP-129 format) |

**Example Request:**

```bash
GET /api/dreps/drep1ygqq33rjavhwwynp2pzj478fea67dxeelq2ylfwum0txhhqy8p3fn
```

**Response:** `200 OK`

```json
{
  "drep_id": "drep1qqyvguht9mn3yc2sg54036w0whnfkw0cz386thxm6e4ackmgdxz",
  "hex": "0008c472eb2ee7126150452af8e9cf75e69b39f8144fa5dcdbd66bdc",
  "status": "retired",
  "active": false,
  "voting_power_active": "0",
  "amount": "0",
  "has_script": false,
  "retired": true,
  "expired": false,
  "last_active_epoch": 777
}
```

**Response:** `404 NOT FOUND` - DRep not found

**Response:** `500 INTERNAL SERVER ERROR` - Server error

---

### Get DRep Delegators

Get the list of delegators for a specific DRep.

**Endpoint:** `GET /api/dreps/:id/delegators`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | DRep ID (CIP-105 or CIP-129 format) |

**Example Request:**

```bash
GET /api/dreps/drep1ygqq33rjavhwwynp2pzj478fea67dxeelq2ylfwum0txhhqy8p3fn/delegators
```

**Response:** `200 OK`

```json
[
  {
    "address": "stake1uxz6ljatyc7w52z44hskd5pu5cvw7qemwz6re3ux4pmdqumcn2qyrx",
    "amount": "1000000000"
  },
  {
    "address": "stake1uqgykl0j0tdn689syxuasmg35hfjaqnd06t2fav38r7fyqcc0w7lk",
    "amount": "500000000"
  }
]
```

**Response Fields:**

- Array of delegator objects:
  - `address`: Stake address of the delegator
  - `amount`: Delegated amount in lovelace (as string)

**Response:** `500 INTERNAL SERVER ERROR` - Server error

---

### Get DRep Voting History

Get the voting history for a specific DRep.

**Endpoint:** `GET /api/dreps/:id/votes`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | DRep ID (CIP-105 or CIP-129 format) |

**Example Request:**

```bash
GET /api/dreps/drep1ygqq33rjavhwwynp2pzj478fea67dxeelq2ylfwum0txhhqy8p3fn/votes
```

**Response:** `200 OK`

```json
[
  {
    "tx_hash": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5",
    "cert_index": 0,
    "proposal_id": "gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln",
    "action_id": "gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln",
    "proposal_tx_hash": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5",
    "proposal_cert_index": 0,
    "vote": "yes",
    "voting_power": "1000000000",
    "epoch": 1107
  }
]
```

**Response Fields:**

- Array of vote objects:
  - `tx_hash`: Transaction hash of the vote
  - `cert_index`: Certificate index
  - `proposal_id`: Governance action/proposal ID
  - `action_id`: Alias for proposal_id
  - `proposal_tx_hash`: Transaction hash of the proposal
  - `proposal_cert_index`: Certificate index of the proposal
  - `vote`: Vote value (`"yes"`, `"no"`, or `"abstain"`)
  - `voting_power`: Voting power used in lovelace (as string)
  - `epoch`: Epoch when the vote was cast

**Response:** `500 INTERNAL SERVER ERROR` - Server error

---

### Get DRep Metadata

Get metadata for a specific DRep (CIP-119 format).

**Endpoint:** `GET /api/dreps/:id/metadata`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | DRep ID (CIP-105 or CIP-129 format) |

**Example Request:**

```bash
GET /api/dreps/drep1ygqq33rjavhwwynp2pzj478fea67dxeelq2ylfwum0txhhqy8p3fn/metadata
```

**Response:** `200 OK`

```json
{
  "json_metadata": {
    "body": {
      "givenName": "Example DRep",
      "objectives": "Promote Cardano governance",
      "motivations": "Community participation",
      "qualifications": "5 years blockchain experience",
      "image": {
        "contentUrl": "https://example.com/image.png",
        "sha256": "abc123..."
      }
    }
  },
  "url": "https://metadata.example.com/drep.json",
  "hash": "abc123..."
}
```

**Response:** `200 OK` with `null` - No metadata available

**Response:** `500 INTERNAL SERVER ERROR` - Server error

---

## Governance Action Endpoints

### List Governance Actions

Get a paginated list of governance actions (proposals).

**Endpoint:** `GET /api/actions`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `count` | integer | 20 | Number of items per page |
| `enrich` | boolean | false | Whether to enrich with additional data (optional) |

**Example Request:**

```bash
GET /api/actions?page=1&count=20
```

**Response:** `200 OK`

```json
{
  "actions": [
    {
      "tx_hash": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5",
      "action_id": "gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln",
      "proposal_id": "gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln",
      "proposal_tx_hash": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5",
      "proposal_index": 0,
      "cert_index": 0,
      "return_address": "stake_test1uz6ljatyc7w52z44hskd5pu5cvw7qemwz6re3ux4pmdqumcn2qyrx",
      "type": "info",
      "status": "voting",
      "proposed_epoch": 1107,
      "voting_epoch": 1107,
      "expiry_epoch": 1138,
      "expiration": 1138,
      "meta_url": "ipfs://bafkreif2mbndv6nqpect6hbpyunfbu6lnbo2nmqo6rla5kgowbxz45sh6y",
      "meta_hash": "3721b453df890ba0690c68efad99373aa80afb3e40c059fc6c859e41fb8867be",
      "block_time": 1762341506
    }
  ],
  "has_more": true,
  "total": 100
}
```

**Response Fields:**

- `actions`: Array of governance action objects (see GovernanceAction Model below)
- `has_more`: Boolean indicating if more pages are available
- `total`: Total number of actions (may be omitted if not available)

---

### Get Single Governance Action

Get detailed information about a specific governance action.

**Endpoint:** `GET /api/actions/:id`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Governance action ID (e.g., `gov_action1...`) |

**Example Request:**

```bash
GET /api/actions/gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln
```

**Response:** `200 OK`

```json
{
  "tx_hash": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5",
  "action_id": "gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln",
  "proposal_id": "gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln",
  "proposal_tx_hash": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5",
  "proposal_index": 0,
  "cert_index": 0,
  "return_address": "stake_test1uz6ljatyc7w52z44hskd5pu5cvw7qemwz6re3ux4pmdqumcn2qyrx",
  "type": "info",
  "status": "voting",
  "proposed_epoch": 1107,
  "voting_epoch": 1107,
  "expiry_epoch": 1138,
  "expiration": 1138,
  "meta_url": "ipfs://bafkreif2mbndv6nqpect6hbpyunfbu6lnbo2nmqo6rla5kgowbxz45sh6y",
  "meta_hash": "3721b453df890ba0690c68efad99373aa80afb3e40c059fc6c859e41fb8867be",
  "block_time": 1762341506
}
```

**Response:** `404 NOT FOUND` - Action not found

**Response:** `500 INTERNAL SERVER ERROR` - Server error

---

### Get Action Voting Results

Get voting breakdown for a specific governance action.

**Endpoint:** `GET /api/actions/:id/votes`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Governance action ID (e.g., `gov_action1...`) |

**Example Request:**

```bash
GET /api/actions/gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln/votes
```

**Response:** `200 OK`

```json
{
  "drep_votes": {
    "yes": "5000000000000",
    "no": "1000000000000",
    "abstain": "500000000000"
  },
  "spo_votes": {
    "yes": "2000000000000",
    "no": "500000000000",
    "abstain": "100000000000"
  },
  "cc_votes": {
    "yes": "1000000000000",
    "no": "200000000000",
    "abstain": "50000000000"
  },
  "total_voting_power": "10000000000000"
}
```

**Response Fields:**

- `drep_votes`: Vote counts from DReps (yes, no, abstain) in lovelace
- `spo_votes`: Vote counts from Stake Pool Operators (yes, no, abstain) in lovelace
- `cc_votes`: Vote counts from Constitutional Committee (yes, no, abstain) in lovelace
- `total_voting_power`: Total voting power in lovelace (as string)

**Response:** `500 INTERNAL SERVER ERROR` - Server error

---

## Data Models

### DRep Model

```typescript
interface DRep {
  drep_id: string;                    // DRep ID in CIP-105 or CIP-129 format
  drep_hash?: string;                 // DRep hash
  hex?: string;                       // Hex-encoded DRep ID
  view?: string;                      // View URL
  url?: string;                       // DRep URL
  metadata?: DRepMetadata;            // DRep metadata
  anchor?: DRepAnchor;                // DRep anchor
  voting_power?: string;              // Total voting power in lovelace
  voting_power_active?: string;       // Active voting power in lovelace
  amount?: string;                    // Amount in lovelace
  status?: string;                    // 'active' | 'inactive' | 'retired'
  active?: boolean;                   // Whether DRep is currently active
  active_epoch?: number;              // Epoch when DRep became active
  last_active_epoch?: number;         // Last epoch when DRep was active
  has_script?: boolean;               // Whether DRep has a script
  retired?: boolean;                  // Whether DRep is retired
  expired?: boolean;                  // Whether DRep has expired
  registration_tx_hash?: string;      // Transaction hash of registration
  registration_epoch?: number;        // Epoch when DRep was registered
  delegator_count?: number;           // Number of delegators
  vote_count?: number;                // Number of votes cast
  last_vote_epoch?: number;           // Last epoch when DRep voted
  has_profile?: boolean;             // Whether DRep has profile metadata
}

interface DRepMetadata {
  // CIP-119 format metadata
  [key: string]: any;
}

interface DRepAnchor {
  url: string;                        // Anchor URL
  data_hash: string;                  // Anchor data hash
}
```

### DRepDelegator Model

```typescript
interface DRepDelegator {
  address: string;                    // Stake address
  amount: string;                     // Delegated amount in lovelace
}
```

### DRepVotingHistory Model

```typescript
interface DRepVotingHistory {
  tx_hash?: string;                   // Transaction hash of the vote
  cert_index?: number;                 // Certificate index
  proposal_id?: string;                // Governance action/proposal ID
  action_id?: string;                  // Alias for proposal_id
  proposal_tx_hash?: string;          // Transaction hash of the proposal
  proposal_cert_index?: number;       // Certificate index of the proposal
  vote: string;                       // 'yes' | 'no' | 'abstain'
  voting_power?: string;              // Voting power used in lovelace
  epoch?: number;                     // Epoch when the vote was cast
}
```

### GovernanceAction Model

```typescript
interface GovernanceAction {
  tx_hash: string;                    // Transaction hash
  action_id: string;                  // Governance action ID
  proposal_id?: string;               // Proposal ID (alias for action_id)
  proposal_tx_hash?: string;          // Transaction hash of the proposal
  proposal_index?: number;            // Proposal index
  cert_index?: number;                // Certificate index
  deposit?: string;                   // Deposit amount in lovelace
  reward_account?: string;            // Reward account address
  return_address?: string;            // Return address for deposit
  type: string;                       // Action type: 'parameter_change' | 'hard_fork_initiation' | 'treasury_withdrawals' | 'no_confidence' | 'update_committee' | 'new_committee' | 'new_constitution' | 'info'
  description?: string;               // Action description
  status?: string;                    // 'submitted' | 'voting' | 'ratified' | 'enacted' | 'expired' | 'rejected' | 'dropped'
  proposed_epoch?: number;            // Epoch when action was proposed
  voting_epoch?: number;              // Epoch when voting started
  ratification_epoch?: number;        // Epoch when action was ratified
  ratified_epoch?: number;            // Epoch when action was ratified
  enactment_epoch?: number;           // Epoch when action was enacted
  expiry_epoch?: number;              // Epoch when action expires
  expiration?: number;                // Expiration epoch
  dropped_epoch?: number;             // Epoch when action was dropped
  meta_url?: string;                  // Metadata URL (IPFS, HTTP, etc.)
  meta_hash?: string;                 // Metadata hash
  meta_json?: any;                    // Parsed metadata JSON
  meta_language?: string;            // Metadata language
  meta_comment?: string;             // Metadata comment
  meta_is_valid?: boolean;           // Whether metadata is valid
  withdrawal?: Withdrawal;            // Withdrawal information (for treasury withdrawals)
  param_proposal?: any;               // Parameter proposal details
  block_time?: number;                // Block time (Unix timestamp)
  metadata?: any;                     // Additional metadata
}

interface Withdrawal {
  amount: string;                     // Withdrawal amount in lovelace
  address?: string;                   // Withdrawal address
}
```

### ActionVotingBreakdown Model

```typescript
interface ActionVotingBreakdown {
  drep_votes: VoteCounts;             // DRep vote counts
  spo_votes: VoteCounts;              // Stake Pool Operator vote counts
  cc_votes: VoteCounts;               // Constitutional Committee vote counts
  total_voting_power: string;         // Total voting power in lovelace
}

interface VoteCounts {
  yes: string;                        // Yes votes in lovelace
  no: string;                         // No votes in lovelace
  abstain: string;                    // Abstain votes in lovelace
}
```

---

## Caching

The backend includes an in-memory caching layer with configurable TTLs:

- **DRep List (Page 1)**: 30 seconds
- **DRep List (Other Pages)**: 60 seconds
- **Individual DRep**: 120 seconds
- **DRep Stats**: 60 seconds
- **DRep Delegators**: 180 seconds
- **DRep Voting History**: 300 seconds
- **DRep Metadata**: 600 seconds
- **Actions List (Page 1)**: 30 seconds
- **Actions List (Other Pages)**: 60 seconds
- **Individual Action**: 120 seconds
- **Action Votes**: 180 seconds

Cache statistics are included in the `/health` endpoint response.

---

## Error Handling

### Standard Error Responses

**404 NOT FOUND**

Returned when a requested resource (DRep or Action) is not found.

```json
{
  "error": "DRep not found"
}
```

**500 INTERNAL SERVER ERROR**

Returned when there's a server error or data provider failure.

```json
{
  "error": "Failed to fetch DRep"
}
```

---

## Examples

### cURL Examples

**Health Check:**
```bash
curl https://govtwool-backend.onrender.com/health
```

**Get DReps:**
```bash
curl "https://govtwool-backend.onrender.com/api/dreps?page=1&count=10"
```

**Get Single DRep:**
```bash
curl "https://govtwool-backend.onrender.com/api/dreps/drep1ygqq33rjavhwwynp2pzj478fea67dxeelq2ylfwum0txhhqy8p3fn"
```

**Get DRep Delegators:**
```bash
curl "https://govtwool-backend.onrender.com/api/dreps/drep1ygqq33rjavhwwynp2pzj478fea67dxeelq2ylfwum0txhhqy8p3fn/delegators"
```

**Get Actions:**
```bash
curl "https://govtwool-backend.onrender.com/api/actions?page=1&count=10"
```

**Get Single Action:**
```bash
curl "https://govtwool-backend.onrender.com/api/actions/gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln"
```

### JavaScript/TypeScript Examples

**Fetch DReps:**
```javascript
const response = await fetch('https://govtwool-backend.onrender.com/api/dreps?page=1&count=20');
const data = await response.json();
console.log(data.dreps);
```

**Fetch Single DRep:**
```javascript
const drepId = 'drep1ygqq33rjavhwwynp2pzj478fea67dxeelq2ylfwum0txhhqy8p3fn';
const response = await fetch(`https://govtwool-backend.onrender.com/api/dreps/${drepId}`);
const drep = await response.json();
console.log(drep);
```

---

## DRep ID Format

The API accepts DRep IDs in both CIP-105 (legacy) and CIP-129 (new) formats:

- **CIP-105**: `drep1...` (56 hex characters) or `drep_script1...` (56 hex characters)
- **CIP-129**: `drep1...` (58 hex characters, includes 2-byte header)

The backend automatically handles conversion between formats as needed by the underlying data providers.

---

## Notes

- All amounts are returned as strings in lovelace (1 ADA = 1,000,000 lovelace)
- Timestamps are Unix timestamps (seconds since epoch)
- Optional fields may be omitted from responses if not available
- The backend uses smart routing to select the best data provider for each operation
- Caching is enabled by default but can be disabled via environment variables

---

## Support

For issues or questions about the API, please refer to the project repository or backend README.

