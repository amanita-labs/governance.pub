# GovTwool Backend API Documentation

## Base URL

```
Production: https://<your-backend-host>
Local: http://localhost:8080
```

## Overview

The GovTwool Backend API provides a unified REST interface for accessing Cardano governance data directly from a Yaci Store PostgreSQL database. The backend queries the indexer database for all governance data, providing high performance and reliability without dependency on external APIs.

## Features

- **Self-Hosted Indexer**: Uses Yaci Store for blockchain indexing (no dependency on external APIs)
- **PostgreSQL Database**: Direct database queries for high performance
- **Caching**: High-performance in-memory caching with configurable TTLs
- **CORS Enabled**: All origins allowed by default
- **Type Safety**: Strong typing with Rust's type system
- **GovTools Enrichment**: Optional enrichment layer for richer DRep metadata
- **Metadata Validation**: Optional Cardano Verifier API integration

## Authentication

Currently, no authentication is required. The API is publicly accessible.

## Rate Limiting

No rate limiting is enforced by the backend. All data is served from the local PostgreSQL database populated by Yaci Store indexer.

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

Check the health status of the backend, database connection, and indexer sync status.

**Endpoint:** `GET /health`

**Response:** `200 OK`

```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "name": "yaci_store_8zdw",
    "size_bytes": 1234567890,
    "size_mb": 1177.37,
    "total_tables": 54,
    "connection_pool": {
      "size": 10,
      "active": 2,
      "idle": 8
    }
  },
  "indexer": {
    "connected": true,
    "synced": true,
    "status": "active",
    "latest_block": 12345678,
    "latest_block_slot": 987654321,
    "latest_block_time": 1704067200,
    "latest_epoch": 500,
    "total_blocks": 12345678,
    "sync_progress": "Block 12345678 synced",
    "is_syncing": false,
    "blocks_last_hour": 360,
    "blocks_last_day": 8640,
    "sync_rate_per_minute": "6.00",
    "last_sync_ago_seconds": 10
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
  "database": {
    "connected": true,
    "name": "yaci_store_8zdw",
    "size_bytes": 1234567890,
    "size_mb": 1177.37,
    "total_tables": 54,
    "connection_pool": {
      "size": 10,
      "active": 2,
      "idle": 8
    }
  },
  "indexer": {
    "connected": false,
    "synced": false,
    "status": "stopped",
    "latest_block": null,
    "latest_block_slot": null,
    "latest_block_time": null,
    "latest_epoch": null,
    "total_blocks": null,
    "sync_progress": "Database not connected",
    "is_syncing": false,
    "blocks_last_hour": null,
    "blocks_last_day": null,
    "sync_rate_per_minute": null,
    "last_sync_ago_seconds": null
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
  "active_dreps_count": 2831,
  "total_dreps_count": 861,
  "total_voting_power": "93486432615839",
  "top_drep": {
    "drep_id": "drep1qz8frp3eq58v3dcguhv0753yt9gf3g50plrxw8rxu2f2krf2p5d",
    "name": "Army of Spies",
    "voting_power": "93486432615839"
  }
}
```

**Response Fields:**

- `active_dreps_count`: Number of active DReps (may be `null` if unavailable)
- `total_dreps_count`: Total number of registered DReps (may be `null` if unavailable)
- `total_voting_power`: Sum of voting power across all DReps, in lovelace (may be `null`)
- `top_drep`: Object describing the DRep with the highest voting power (may be omitted if unavailable)
  - `drep_id`: Identifier for the leading DRep
  - `name`: Friendly name if available
  - `voting_power`: Voting power for the DRep, in lovelace

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
    "proposal_id": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0",
    "action_id": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0",
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
      "action_id": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0",
      "proposal_id": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0",
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
| `id` | string | Governance action ID in format `tx_hash#idx` or CIP-129 format |

**Example Request:**

```bash
# Using tx_hash#idx format (recommended)
GET /api/actions/bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0

# Or using CIP-129 format
GET /api/actions/gov_action1huh370jy9gu9z75wcvhetq6t8dcumhldjruwxc9a4rwz9jvz7lzsqswdgln
```

**Response:** `200 OK`

```json
{
  "tx_hash": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5",
  "action_id": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0",
  "proposal_id": "bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0",
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
| `id` | string | Governance action ID in format `tx_hash#idx` or CIP-129 format |

**Example Request:**

```bash
# Using tx_hash#idx format
GET /api/actions/bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0/votes

# Or using CIP-129 format
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

## Stake Endpoints

### Get Stake Delegation

Retrieve delegation and balance details for a stake address.

**Endpoint:** `GET /api/stake/:stake_address/delegation`

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `stake_address` | string | Stake address (e.g., `stake1...`) |

**Example Request:**

```bash
GET /api/stake/stake1uxz6ljatyc7w52z44hskd5pu5cvw7qemwz6re3ux4pmdqumcn2qyrx/delegation
```

**Response:** `200 OK`

```json
{
  "stake_address": "stake1uxz6ljatyc7w52z44hskd5pu5cvw7qemwz6re3ux4pmdqumcn2qyrx",
  "delegated_pool": "pool1xyz...",
  "delegated_drep": "drep1ygqq33rjavhwwynp2pzj478fea67dxeelq2ylfwum0txhhqy8p3fn",
  "total_balance": "1500000000",
  "utxo_balance": "1200000000",
  "rewards_available": "300000000"
}
```

**Response Fields:**

- `stake_address`: Stake credential requested
- `delegated_pool`: Pool ID if delegated to an SPO
- `delegated_drep`: DRep identifier if representative delegation is active
- `total_balance`: Total stake balance in lovelace
- `utxo_balance`: Spendable balance in lovelace
- `rewards_available`: Rewards awaiting withdrawal in lovelace

**Response:** `404 NOT FOUND` - Stake address not found

**Response:** `500 INTERNAL SERVER ERROR` - Database or server error

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
  given_name?: string;                // Profile name (GovTools enrichment)
  objectives?: string;                // Profile objectives (GovTools enrichment)
  motivations?: string;               // Profile motivations (GovTools enrichment)
  qualifications?: string;            // Profile qualifications (GovTools enrichment)
  votes_last_year?: number;           // Vote count over the last 12 months
  identity_references?: DRepExternalReference[]; // Identity links (X, website, etc.)
  link_references?: DRepExternalReference[];     // Additional resources/links
  image_url?: string;                 // Profile image URL
  image_hash?: string;                // Hash of the profile image
  latest_registration_date?: string;  // ISO registration timestamp (if available)
  latest_tx_hash?: string;            // Latest registration transaction hash
  deposit?: string;                   // Registration deposit in lovelace
  metadata_error?: string;            // Metadata validation errors (if any)
  payment_address?: string;           // Linked payment address (if available)
  is_script_based?: boolean;          // Indicates script-based DRep
}

interface DRepMetadata {
  // CIP-119 format metadata
  [key: string]: any;
}

interface DRepAnchor {
  url: string;                        // Anchor URL
  data_hash: string;                  // Anchor data hash
}

interface DRepExternalReference {
  reference_type?: string;            // 'Identity' | 'Link'
  label?: string;                     // Friendly label (if provided)
  uri?: string;                       // External URI
}
```

### DRepDelegator Model

```typescript
interface DRepDelegator {
  address: string;                    // Stake address
  amount: string;                     // Delegated amount in lovelace
}
```

### StakeDelegation Model

```typescript
interface StakeDelegation {
  stake_address: string;               // Stake credential
  delegated_pool?: string | null;      // Pool ID if delegated to an SPO
  delegated_drep?: string | null;      // DRep ID if delegated to a representative
  total_balance?: string | null;       // Total balance in lovelace
  utxo_balance?: string | null;        // Spendable balance in lovelace
  rewards_available?: string | null;   // Rewards available to withdraw in lovelace
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
- **Stake Delegation**: 60 seconds

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

Returned when there's a server error or database connection failure.

```json
{
  "error": "Failed to fetch DRep"
}
```

**503 SERVICE UNAVAILABLE**

Returned when the database is not connected or the indexer is not synced.

```json
{
  "status": "degraded",
  "database": {
    "connected": false
  },
  "indexer": {
    "connected": false,
    "synced": false
  }
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
# Using tx_hash#idx format (recommended)
curl "https://govtwool-backend.onrender.com/api/actions/bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0"

# Or using CIP-129 format (if supported)
# Using tx_hash#idx format (recommended)
curl "https://govtwool-backend.onrender.com/api/actions/bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0"

# Or using CIP-129 format
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

The backend automatically normalizes DRep IDs to CIP-129 format internally for database queries.

### Governance Action ID Format

The API accepts governance action IDs in multiple formats:

- **Blockfrost format**: `{tx_hash}#{idx}` (e.g., `bf2f1f3e442a38517a8ec32f95834b3b71cddfed90f8e360bda8dc22c982f7c5#0`)
  - `tx_hash`: 64-character hex string
  - `idx`: Integer index (typically 0)
- **CIP-129 format**: `gov_action1...` (bech32-encoded)
- **Simple tx_hash**: Just the 64-character transaction hash (assumes idx=0)

The backend parses these formats and queries the `gov_action_proposal` table using `tx_hash` and `idx` columns.

---

## Database Schema

The backend queries the Yaci Store PostgreSQL database using the `preview` schema (or network-specific schema). The following tables are used:

### Core Tables

- **`drep_registration`**: DRep registration and retirement records
  - Primary key: `(tx_hash, cert_index)`
  - Key columns: `drep_hash`, `drep_id`, `type`, `anchor_url`, `anchor_hash`, `epoch`, `tx_hash`, `block_time`
  - Status determined by `type` column: `'drep_registration'` (active), `'drep_retirement'` (retired)

- **`gov_action_proposal`**: Governance action proposals
  - Primary key: `(tx_hash, idx)` - note: uses `idx` not `cert_index`
  - Key columns: `tx_hash`, `idx`, `type`, `deposit`, `return_address`, `anchor_url`, `anchor_hash`, `details` (jsonb), `epoch`, `block_time`
  - Action ID format: `{tx_hash}#{idx}`

- **`voting_procedure`**: Votes cast on governance actions
  - Primary key: `(tx_hash, voter_hash, gov_action_tx_hash, gov_action_index)`
  - Key columns: `voter_type` (drep/spo/cc), `voter_hash`, `gov_action_tx_hash`, `gov_action_index`, `vote` (yes/no/abstain), `epoch`, `block_time`

- **`delegation_vote`**: DRep delegations (stake addresses delegating to DReps)
  - Primary key: `(tx_hash, cert_index)`
  - Key columns: `address`, `drep_id`, `drep_hash`, `epoch`, `block_time`

- **`delegation`**: Pool delegations
  - Primary key: `(tx_hash, cert_index)`
  - Key columns: `address`, `pool_id`, `credential`, `epoch`, `block_time`

- **`local_drep_dist`**: DRep voting power distribution per epoch
  - Primary key: `(drep_hash, epoch)`
  - Key columns: `drep_hash`, `amount`, `epoch`
  - Used to calculate current voting power for DReps

- **`local_gov_action_proposal_status`**: Governance action status tracking
  - Primary key: `(gov_action_tx_hash, gov_action_index, epoch)`
  - Key columns: `gov_action_tx_hash`, `gov_action_index`, `status`, `epoch`
  - Status changes over time - queries use latest status per action

- **`epoch`**: Epoch information
  - Primary key: `number` (bigint, not `no`)
  - Key columns: `number`, `start_time`, `end_time`, `block_count`

- **`stake_address_balance`**: Stake address balances over time
  - Primary key: `(address, slot)`
  - Key columns: `address`, `quantity`, `slot`, `epoch`, `block_time`
  - Latest balance per address used for delegation queries

- **`block`**: Block information
  - Used for sync status and health checks
  - Key columns: `block_no` (or `number`), `slot_no` (or `slot`), `time` (or `block_time`), `epoch`

### Schema Configuration

The backend automatically sets `search_path` to `preview, public` when connecting to the database, ensuring queries use the correct schema where data is stored. For Preview network, data is in the `preview` schema; for Mainnet, it would be in the `mainnet` schema (or `public` if not schema-separated).

## Notes

- All amounts are returned as strings in lovelace (1 ADA = 1,000,000 lovelace)
- Timestamps are Unix timestamps (milliseconds since epoch for `block_time`, seconds for epoch `start_time`)
- Optional fields may be omitted from responses if not available
- The backend queries Yaci Store database directly - no external API dependencies
- Caching is enabled by default but can be disabled via environment variables
- Action IDs can be in format `tx_hash#idx` (Blockfrost-style) or CIP-129 format (`gov_action1...`)
- DRep IDs are normalized to CIP-129 format internally but accept both CIP-105 and CIP-129 formats

---

## Support

For issues or questions about the API, please refer to the project repository or backend README.

