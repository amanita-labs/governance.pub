/**
 * Proposal ID Utilities
 * 
 * Handles conversion between different proposal ID formats:
 * - Koios CIP-129 format: gov_action1... (Bech32 encoded)
 * - Blockfrost format: tx_hash#cert_index or action_id
 */

/**
 * Check if a proposal ID is in CIP-129 format (Koios format)
 * CIP-129 format starts with "gov_action1"
 */
export function isCIP129ProposalId(proposalId: string): boolean {
  return proposalId.startsWith('gov_action1');
}

/**
 * Parse a proposal ID to extract its format and components
 * @param proposalId The proposal ID to parse
 * @returns Object with format and components
 */
export function parseProposalId(proposalId: string): {
  format: 'cip129' | 'blockfrost' | 'unknown';
  tx_hash?: string;
  cert_index?: number;
  proposal_id?: string;
} {
  // Check if it's CIP-129 format
  if (isCIP129ProposalId(proposalId)) {
    return {
      format: 'cip129',
      proposal_id: proposalId,
    };
  }

  // Check if it's Blockfrost format (tx_hash#cert_index)
  const hashIndexMatch = proposalId.match(/^([a-fA-F0-9]{64})#(\d+)$/);
  if (hashIndexMatch) {
    return {
      format: 'blockfrost',
      tx_hash: hashIndexMatch[1],
      cert_index: parseInt(hashIndexMatch[2], 10),
    };
  }

  // Check if it's just a tx_hash (64 hex characters)
  if (/^[a-fA-F0-9]{64}$/.test(proposalId)) {
    return {
      format: 'blockfrost',
      tx_hash: proposalId,
      cert_index: 0, // Default to 0 if not specified
    };
  }

  // Unknown format
  return {
    format: 'unknown',
  };
}

/**
 * Extract tx_hash and cert_index from a proposal ID
 * @param proposalId The proposal ID
 * @returns Object with tx_hash and cert_index, or null if can't extract
 */
export function extractTxHashAndIndex(proposalId: string): {
  tx_hash: string;
  cert_index: number;
} | null {
  const parsed = parseProposalId(proposalId);
  
  if (parsed.format === 'blockfrost' && parsed.tx_hash) {
    return {
      tx_hash: parsed.tx_hash,
      cert_index: parsed.cert_index || 0,
    };
  }

  // For CIP-129 format, we can't extract tx_hash/cert_index without additional API calls
  // Return null to indicate we need to fetch from API
  return null;
}

/**
 * Format a proposal ID from tx_hash and cert_index
 * @param tx_hash Transaction hash
 * @param cert_index Certificate index (defaults to 0)
 * @returns Formatted proposal ID in Blockfrost format
 */
export function formatProposalId(tx_hash: string, cert_index: number = 0): string {
  return `${tx_hash}#${cert_index}`;
}

