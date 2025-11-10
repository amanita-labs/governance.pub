<!-- Governance metadata validation guidance extracted from CIP-100 & CIP-108 -->

# Governance Metadata Validation Notes

## Reference Standards

- **CIP-0100** – Governance metadata, anchor format, author witness expectations, hash requirements.
- **CIP-0108** – Metadata bundle guidance that expands on CIP-0100 for multi-language content and anchor best practices.

## Validation Dimensions

### 1. Anchor Integrity (Hash Check)

- Governance actions must publish an anchor containing:
  - `meta_url` – URI where the metadata payload can be fetched.
  - `meta_hash` – Blake2b-256 digest of the raw bytes served by `meta_url`.
- What to validate:
  - Fetch metadata bytes from the anchor URL (respecting max size, timeouts).
  - Compute Blake2b-256 across the exact response body (no JSON normalization).
  - Compare byte-level digest with the on-chain `meta_hash`.
- Koios already exposes `meta_is_valid`; treat this as an advisory flag, but prefer recomputing locally.
- CIP-0108 allows alternative hash algorithms via the `hashAlgorithm` field in the JSON body, but anchors on-chain remain Blake2b-256; warn when algorithms diverge.

### 2. Location & Availability (IPFS Check)

- CIP-0108 encourages decentralised hosting for governance metadata.
- Validation policy:
  - Treat URIs that start with `ipfs://` as “pass”.
  - Flag any non-IPFS URI as “fail” (or “warn” if we allow HTTPS mirrors).
  - When resolving IPFS URIs, ensure gateway requests (e.g. `https://ipfs.io/ipfs/<CID>`) succeed or provide actionable error messaging.
- Record final access URL and latency to help debug slow or failing hosts.

### 3. Schema Conformance

- Required structure per CIP-0100:
  - Top-level object with `@context`, `type`, `hashAlgorithm`, `body`, and `authors`.
  - `body` contains proposal attributes (title, abstract, motivation, rationale, etc.).
  - `authors` is an array of author entries.
- CIP-0108 expands `body` with localisation, richer link objects, and additional metadata buckets (`resources`, `attachments`).
- Validation steps:
  - Confirm mandatory fields per CIP-0100.
  - Detect malformed localisation blocks (`body.localized`).
  - Normalise string-like fields for display.
- Identify optional governance metadata extension blocks (proposed CIP `onChain` payload).

### 4. Author Witness Verification

- Each author entry may include a `witness` object:
  - Contains verification method (`cip8`, `cip30`, etc.).
  - Provides signed payload binding author identity to proposal hash.
- Validation flow drawn from the Cardano Foundation reference implementation:
  1. Extract canonical payload expected by CIP-0100.
  2. Validate witness format (signature, key, address).
  3. Perform cryptographic verification using CIP-8 or CIP-30 depending on witness type.
  4. Report per-author pass/fail and aggregate status.
- Hosted verifier: the Cardano Foundation exposes `GET/POST /api/verify-cip100` for server-side verification of the entire metadata package, including witnesses ([API docs](https://verifycardanomessage.cardanofoundation.org/api-docs)). Use as an optional fallback when local cryptography is unavailable or as a secondary opinion. Record latency and response codes when calling the endpoint.
- Privacy consideration: only send publicly hosted metadata to the external service, and communicate to users when a remote verifier is consulted.

#### Author Witness Data Model (CIP-0100 Highlights)

- `authors[]` entries can embed the witness either directly or within a `proofs` array. Common fields:
  - `name` / `handle` – human-readable identifier.
  - `witness.type` – expected values include `cip8` (Ed25519 signature) and `cip30` (wallet bridge signature).
  - `witness.payload` – canonical JSON string the author signed (often includes the proposal hash, timestamp, role).
  - `witness.signature` – hex-encoded signature (64 bytes for Ed25519).
  - `witness.publicKey` or `stakeAddress` – verification key reference.
- For multi-signature authorship, CIP-0100 allows `witnesses` array per author; all entries must validate for the author to be considered verified.

#### Hosted Verification API Usage Plan

- **Endpoint**: `POST https://verifycardanomessage.cardanofoundation.org/api/verify-cip100`
  ```json
  {
    "metadata": { /* full CIP-100 JSON */ }
  }
  ```
- **Success Response** (abridged):
  ```json
  {
    "success": true,
    "hash": { "valid": true },
    "authors": [
      { "name": "Example Author", "valid": true, "witness": { "type": "cip8" } }
    ],
    "schema": { "valid": true }
  }
  ```
- **Failure Response** includes granular error codes (`hashMismatch`, `invalidSignature`, `schemaError`). Treat non-2xx responses or `success: false` as validation failures and log the payload for observability (excluding sensitive fields).
- **Integration Strategy**:
  1. Feature-flag outbound calls to avoid mandatory reliance.
  2. Deduplicate calls by caching on `(meta_hash, resolved_url)`.
  3. Surface remote verdict in backend `metadata_checks.author_witness` (pass/fail) and append a note stating “Verified via Cardano Foundation service”.
- **Implementation (current state)**:
  - Enable via `CARDANO_VERIFIER_ENABLED=true` (optional `CARDANO_VERIFIER_ENDPOINT` override).
  - Backend submits available metadata JSON and records pass/fail/warning outcomes while treating network or rate-limit errors as warnings.
  - Deployment env vars:
    - `CARDANO_VERIFIER_ENABLED=true`
    - `CARDANO_VERIFIER_ENDPOINT=https://verifycardanomessage.cardanofoundation.org/api/verify-cip100` (default; override for staging/mocks).

- Respect rate limiting (20 requests/minute/IP). Implement exponential backoff or circuit breaking to avoid cascading failures.

### 5. On-chain Metadata Extension (Draft CIP)

- Proposed extension: `onChain` block defined in [cip-governance-metadata-extension](https://github.com/Ryun1/CIPs/tree/cip-governance-metadata-extension/cip-governance-metadata-extension).
- Validation policy (phase 1):
  - **Pass** when `onChain` exists and is a non-null JSON object (schema lenient while CIP evolves).
  - **Warning** when metadata is present but `onChain` missing or present with incompatible type.
  - **Unknown** when metadata cannot be parsed (e.g., unreachable URL).
- Surface results alongside hash/IPFS/author checks so wallet operators can tell whether the on-chain section is present yet.

### 6. Operational Safeguards
### 6. Operational Safeguards

- Enforce maximum metadata size (CIP-0100 suggests 16 KB, external verifier caps at 5 MB).
- Apply HTTP timeouts (~10 s) and limit redirects to prevent SSRF.
- Cache validation outcomes keyed by `(action_id, meta_hash)` to avoid repeated downloads.
- Capture explicit failure reasons (hash mismatch, unreachable URI, malformed JSON, missing authors, witness verification failure).

## UI Messaging Guidelines

- Surface three discrete statuses:
  1. **Hash validation** – success/failure/unknown (e.g., metadata missing).
  2. **Hosting check** – IPFS vs non-IPFS.
  3. **Author witnesses** – verified/pending/failed (initially “pending” until implementation).
- Provide contextual tooltips explaining the standards and how users can remediate issues (e.g., re-upload metadata to IPFS, re-sign witnesses).

## Next Steps

- Implement backend validation helper that populates structured results for each dimension.
- Display validation summary and detailed breakdown in the governance action views.
- Plan feature flag or configuration for the optional Cardano Foundation verifier integration.


