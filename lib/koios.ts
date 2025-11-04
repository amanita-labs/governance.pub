/**
 * Koios API Client
 * 
 * Provides functions to interact with the Koios API for Cardano governance data.
 * Koios uses CIP-129 DRep ID format, so we need to convert from/to CIP-105 when needed.
 * 
 * Base URL for Preview network: https://preview.koios.rest/api/v1
 */

import { convertToCIP129, normalizeToCIP129 } from './drep-id';

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
      console.error(`Koios API error: ${response.status} ${response.statusText}`);
      return null;
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
  
  // Batch requests in parallel chunks to maximize throughput
  // Koios API doesn't return DRep ID in response, so we fetch individually
  // but in parallel batches for speed
  const chunkSize = 20; // Process 20 DReps in parallel
  for (let i = 0; i < cip129Ids.length; i += chunkSize) {
    const chunk = cip129Ids.slice(i, i + chunkSize);
    
    // Fetch delegators for all DReps in chunk in parallel
    // Use horizontal filtering: limit results to reduce payload
    // For directory page, we only need counts, so limit to reasonable number
    const chunkPromises = chunk.map(async (drepId) => {
      try {
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
        console.warn(`Failed to fetch delegators for DRep ${drepId}:`, error);
        return { drepId, delegators: [] };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    for (const { drepId, delegators } of chunkResults) {
      delegatorsMap.set(drepId, delegators);
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
  
  // Batch requests in parallel chunks to maximize throughput
  // Koios API doesn't return DRep ID in response, so we fetch individually
  // but in parallel batches for speed
  const chunkSize = 20; // Process 20 DReps in parallel
  for (let i = 0; i < cip129Ids.length; i += chunkSize) {
    const chunk = cip129Ids.slice(i, i + chunkSize);
    
    // Fetch votes for all DReps in chunk in parallel
    // Use horizontal filtering: limit results and order by block_time desc for recent votes
    const chunkPromises = chunk.map(async (drepId) => {
      try {
        // Build request with optional limit and ordering for horizontal filtering
        const requestBody: any[] = [{ _drep_id: drepId }];
        if (limit !== undefined) {
          requestBody[0].limit = limit;
        }
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
        console.warn(`Failed to fetch votes for DRep ${drepId}:`, error);
        return { drepId, votes: [] };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    for (const { drepId, votes } of chunkResults) {
      votesMap.set(drepId, votes);
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

