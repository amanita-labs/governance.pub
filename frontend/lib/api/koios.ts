/**
 * Koios API Client
 * 
 * Provides functions to interact with the Koios API for Cardano governance data.
 * Koios uses CIP-129 DRep ID format, so we need to convert from/to CIP-105 when needed.
 * 
 * Base URL for Preview network: https://preview.koios.rest/api/v1
 */

import { convertToCIP129, normalizeToCIP129 } from '../governance/drep-id';

const KOIOS_BASE_URL = process.env.NEXT_PUBLIC_KOIOS_URL || 'https://preview.koios.rest/api/v1';

/**
 * Generic Koios API fetch helper
 */
async function koiosFetch<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  data?: any
): Promise<T | null> {
  try {
    const url = `${KOIOS_BASE_URL}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (method === 'POST' && data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      // Handle rate limiting (429) and not found (404) gracefully
      if (response.status === 429) {
        console.warn(`Koios API rate limited (429): ${endpoint}`);
        // Return null to allow retry or fallback
        return null;
      } else if (response.status === 404) {
        // 404 is expected for DReps that don't exist in Koios
        // Don't log as error, just return null
        return null;
      } else {
        console.error(`Koios API error: ${response.status} ${response.statusText} for ${endpoint}`);
        return null;
      }
    }

    const result = await response.json();
    return result as T;
  } catch (error) {
    console.error(`Error fetching from Koios API (${endpoint}):`, error);
    // Return null to indicate failure, allowing fallback to Blockfrost
    return null;
  }
}

/**
 * DRep list item from Koios
 */
export interface KoiosDRepListItem {
  drep_id: string; // CIP-129 format
  hex: string;
  has_script: boolean;
  registered: boolean;
}

/**
 * DRep delegator from Koios
 */
export interface KoiosDRepDelegator {
  stake_address: string;
  stake_address_hex: string;
  script_hash: string | null;
  epoch_no: number;
  amount: string; // In lovelace
}

/**
 * DRep vote from Koios
 */
export interface KoiosDRepVote {
  proposal_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote_tx_hash: string;
  block_time: number;
  vote: 'Yes' | 'No' | 'Abstain';
  meta_url: string | null;
  meta_hash: string | null;
}

/**
 * DRep epoch summary from Koios
 */
export interface KoiosDRepEpochSummary {
  epoch_no: number;
  amount: string; // Total voting power in lovelace
  dreps: number; // Number of DReps
}

/**
 * Fetch list of all registered DReps
 * Returns DReps in CIP-129 format
 */
export async function getDRepsList(limit?: number): Promise<KoiosDRepListItem[]> {
  const endpoint = limit ? `/drep_list?limit=${limit}` : '/drep_list';
  const result = await koiosFetch<KoiosDRepListItem[]>(endpoint);
  return result || [];
}

/**
 * Fetch delegators for multiple DReps in parallel batches with horizontal filtering
 * @param drepIds Array of DRep IDs (will be normalized to CIP-129)
 * @param limit Optional limit on number of delegators per DRep (horizontal filtering)
 * @returns Map of DRep ID to delegators array
 * 
 * Note: For directory page, we only need counts, so we can limit results significantly
 * to reduce payload size and improve performance.
 */
export async function getDRepsDelegators(
  drepIds: string[],
  limit?: number
): Promise<Map<string, KoiosDRepDelegator[]>> {
  if (drepIds.length === 0) {
    return new Map();
  }

  // Convert all DRep IDs to CIP-129 format for Koios
  const cip129Ids = drepIds.map(id => {
    try {
      return normalizeToCIP129(id);
    } catch {
      return id; // If conversion fails, use as-is
    }
  });

  const delegatorsMap = new Map<string, KoiosDRepDelegator[]>();
  
  // Batch requests in parallel chunks with rate limiting to avoid 429 errors
  // Koios API doesn't return DRep ID in response, so we fetch individually
  // but in parallel batches for speed
  const chunkSize = 10; // Reduced from 20 to avoid rate limiting (429 errors)
  for (let i = 0; i < cip129Ids.length; i += chunkSize) {
    const chunk = cip129Ids.slice(i, i + chunkSize);
    
    // Fetch delegators for all DReps in chunk in parallel with rate limiting
    // Use horizontal filtering: limit results to reduce payload
    // For directory page, we only need counts, so limit to reasonable number
    const chunkPromises = chunk.map(async (drepId, index) => {
      try {
        // Add small delay between requests to avoid rate limiting
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
        }
        
        // Build request with optional limit for horizontal filtering
        const requestBody: any[] = [{ _drep_id: drepId }];
        if (limit !== undefined) {
          requestBody[0].limit = limit;
        }
        
        const result = await koiosFetch<KoiosDRepDelegator[]>(
          '/drep_delegators',
          'POST',
          requestBody
        );
        return { drepId, delegators: result || [] };
      } catch (error) {
        // Silently handle 404 errors (DRep doesn't exist in Koios)
        // and 429 errors (rate limiting - will be handled by delay)
        return { drepId, delegators: [] };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    for (const { drepId, delegators } of chunkResults) {
      delegatorsMap.set(drepId, delegators);
    }
    
    // Add delay between chunks to avoid rate limiting
    if (i + chunkSize < cip129Ids.length) {
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay between chunks
    }
  }

  return delegatorsMap;
}

/**
 * Fetch voting history for multiple DReps in parallel batches with horizontal filtering
 * @param drepIds Array of DRep IDs (will be normalized to CIP-129)
 * @param limit Optional limit on number of votes per DRep (horizontal filtering)
 * @param orderBy Optional ordering (e.g., 'block_time.desc' for most recent first)
 * @returns Map of DRep ID to votes array
 * 
 * Note: For directory page, we only need vote counts and recent activity.
 * We can limit results to reduce payload size and improve performance.
 * Vertical filtering: We only process the fields we need (vote, block_time).
 */
export async function getDRepsVotes(
  drepIds: string[],
  limit?: number,
  orderBy?: string
): Promise<Map<string, KoiosDRepVote[]>> {
  if (drepIds.length === 0) {
    return new Map();
  }

  // Convert all DRep IDs to CIP-129 format for Koios
  const cip129Ids = drepIds.map(id => {
    try {
      return normalizeToCIP129(id);
    } catch {
      return id; // If conversion fails, use as-is
    }
  });

  const votesMap = new Map<string, KoiosDRepVote[]>();
  
  // Batch requests in parallel chunks with rate limiting to avoid 429 errors
  // Koios API doesn't return DRep ID in response, so we fetch individually
  // but in parallel batches for speed
  const chunkSize = 10; // Reduced from 20 to avoid rate limiting (429 errors)
  for (let i = 0; i < cip129Ids.length; i += chunkSize) {
    const chunk = cip129Ids.slice(i, i + chunkSize);
    
    // Fetch votes for all DReps in chunk in parallel with rate limiting
    // Use horizontal filtering: limit results and order by block_time desc for recent votes
    const chunkPromises = chunk.map(async (drepId, index) => {
      try {
        // Add small delay between requests to avoid rate limiting
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
        }
        
        // Build request with optional limit for horizontal filtering
        const requestBody: any[] = [{ _drep_id: drepId }];
        if (limit !== undefined) {
          requestBody[0].limit = limit;
        }
        // Note: Ordering might need to be done client-side if not supported by API
        // For now, we'll include it in case the API supports it
        if (orderBy) {
          requestBody[0].order = orderBy;
        }
        
        const votes = await koiosFetch<KoiosDRepVote[]>(
          '/drep_votes',
          'POST',
          requestBody
        );
        return { drepId, votes: votes || [] };
      } catch (error) {
        // Silently handle 404 errors (DRep doesn't exist in Koios)
        // and 429 errors (rate limiting - will be handled by delay)
        return { drepId, votes: [] };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    for (const { drepId, votes } of chunkResults) {
      votesMap.set(drepId, votes);
    }
    
    // Add delay between chunks to avoid rate limiting
    if (i + chunkSize < cip129Ids.length) {
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay between chunks
    }
  }

  return votesMap;
}

/**
 * Fetch DRep epoch summary statistics
 */
export async function getDRepEpochSummary(): Promise<KoiosDRepEpochSummary[]> {
  const result = await koiosFetch<KoiosDRepEpochSummary[]>('/drep_epoch_summary');
  return result || [];
}

/**
 * Get current epoch summary (most recent)
 */
export async function getCurrentDRepEpochSummary(): Promise<KoiosDRepEpochSummary | null> {
  const summaries = await getDRepEpochSummary();
  if (summaries.length === 0) {
    return null;
  }
  // Return the most recent epoch (first in the array)
  return summaries[0];
}

/**
 * Proposal list item from Koios
 */
export interface KoiosProposal {
  block_time: number;
  proposal_id: string; // CIP-129 format (e.g., gov_action1...)
  proposal_tx_hash: string;
  proposal_index: number;
  proposal_type: 'ParameterChange' | 'HardForkInitiation' | 'TreasuryWithdrawals' | 'NoConfidence' | 'NewCommittee' | 'NewConstitution' | 'InfoAction';
  proposal_description?: any;
  deposit?: number;
  return_address?: string;
  proposed_epoch?: number;
  ratified_epoch?: number | null;
  enacted_epoch?: number | null;
  dropped_epoch?: number | null;
  expired_epoch?: number | null;
  expiration?: number;
  meta_url?: string | null;
  meta_hash?: string | null;
  meta_json?: any | null;
  meta_comment?: string | null;
  meta_language?: string | null;
  meta_is_valid?: boolean | null;
  withdrawal?: {
    amount: string;
    address?: string;
  } | null;
  param_proposal?: any | null;
}

/**
 * Proposal voting summary from Koios
 */
export interface KoiosProposalVotingSummary {
  proposal_type: string;
  epoch_no: number;
  drep_yes_votes_cast: number;
  drep_active_yes_vote_power: string;
  drep_yes_vote_power: string;
  drep_yes_pct: number;
  drep_no_votes_cast: number;
  drep_active_no_vote_power: string;
  drep_no_vote_power: string;
  drep_no_pct: number;
  drep_abstain_votes_cast: number;
  drep_active_abstain_vote_power: string;
  drep_always_no_confidence_vote_power: string;
  drep_always_abstain_vote_power: string;
  pool_yes_votes_cast: number;
  pool_active_yes_vote_power: string;
  pool_yes_vote_power: string;
  pool_yes_pct: number;
  pool_no_votes_cast: number;
  pool_active_no_vote_power: string;
  pool_no_vote_power: string;
  pool_no_pct: number;
  pool_abstain_votes_cast: number;
  pool_active_abstain_vote_power: string;
  pool_passive_always_abstain_votes_assigned: number;
  pool_passive_always_abstain_vote_power: string;
  pool_passive_always_no_confidence_votes_assigned: number;
  pool_passive_always_no_confidence_vote_power: string;
  committee_yes_votes_cast: number;
  committee_yes_pct: number;
  committee_no_votes_cast: number;
  committee_no_pct: number;
  committee_abstain_votes_cast: number;
}

/**
 * Fetch list of all governance proposals from Koios
 * @param limit Optional limit on number of proposals (horizontal filtering)
 * @param orderBy Optional ordering (e.g., 'block_time.desc' for newest first)
 * @returns Array of proposals
 */
export async function getProposalsList(
  limit?: number,
  orderBy?: string
): Promise<KoiosProposal[]> {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }
    if (orderBy) {
      params.append('order', orderBy);
    }
    
    const endpoint = params.toString() 
      ? `/proposal_list?${params.toString()}` 
      : '/proposal_list';
    
    const result = await koiosFetch<KoiosProposal[]>(endpoint);
    return result || [];
  } catch (error) {
    console.error('Error fetching proposals list:', error);
    return [];
  }
}

/**
 * Fetch voting summary for multiple proposals in parallel batches
 * @param proposalIds Array of proposal IDs (CIP-129 format)
 * @returns Map of proposal ID to voting summary
 */
export async function getProposalVotingSummary(
  proposalIds: string[]
): Promise<Map<string, KoiosProposalVotingSummary>> {
  if (proposalIds.length === 0) {
    return new Map();
  }

  const summaryMap = new Map<string, KoiosProposalVotingSummary>();
  
  // Batch requests in parallel chunks with rate limiting
  const chunkSize = 10; // Similar to DRep delegators pattern
  for (let i = 0; i < proposalIds.length; i += chunkSize) {
    const chunk = proposalIds.slice(i, i + chunkSize);
    
    // Fetch voting summaries for all proposals in chunk in parallel
    const chunkPromises = chunk.map(async (proposalId, index) => {
      try {
        // Add small delay between requests to avoid rate limiting
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const result = await koiosFetch<KoiosProposalVotingSummary[]>(
          `/proposal_voting_summary?_proposal_id=${encodeURIComponent(proposalId)}`
        );
        
        // The API returns an array, get the first (and likely only) result
        const summary = result && result.length > 0 ? result[0] : null;
        return { proposalId, summary };
      } catch (error) {
        return { proposalId, summary: null };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    for (const { proposalId, summary } of chunkResults) {
      if (summary) {
        summaryMap.set(proposalId, summary);
      }
    }
    
    // Add delay between chunks to avoid rate limiting
    if (i + chunkSize < proposalIds.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return summaryMap;
}

