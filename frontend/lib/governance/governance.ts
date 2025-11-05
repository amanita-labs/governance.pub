import { blockfrostFetch } from '../api/blockfrost';
import { getDRepsDelegators, getDRepsVotes, getProposalsList, getProposalVotingSummary, getCurrentDRepEpochSummary, type KoiosProposal } from '../api/koios';
import { normalizeToCIP129, convertToCIP105, isSpecialSystemDRep, isValidDRepID } from './drep-id';
import { extractTxHashAndIndex, parseProposalId } from './proposal-id';
import type { DRep, GovernanceAction, VotingResult, DRepVotingHistory, ActionVotingBreakdown, DRepDelegator } from '@/types/governance';

/**
 * Get friendly name and description for special system DReps
 * Exported for use in UI components
 */
export function getSystemDRepInfo(drepId: string): { name: string; description: string; icon?: string } | null {
  const systemDReps: Record<string, { name: string; description: string; icon?: string }> = {
    'drep_always_abstain': {
      name: 'Always Abstain',
      description: 'A system DRep that always votes "Abstain" on all governance actions. This represents delegators who prefer to abstain from voting.',
      icon: '⏸️',
    },
    'drep_always_no_confidence': {
      name: 'Always No Confidence',
      description: 'A system DRep that always votes "No Confidence" on all governance actions. This represents delegators who want to express no confidence in proposals.',
      icon: '❌',
    },
    'drep_always_yes': {
      name: 'Always Yes',
      description: 'A system DRep that always votes "Yes" on all governance actions. This represents delegators who approve all proposals.',
      icon: '✅',
    },
    'drep_always_no': {
      name: 'Always No',
      description: 'A system DRep that always votes "No" on all governance actions. This represents delegators who reject all proposals.',
      icon: '🚫',
    },
  };
  
  return systemDReps[drepId] || null;
}

/**
 * Get total active DReps count from Koios epoch summary
 * Uses the most recent epoch summary from Koios API
 * Reference: https://preview.koios.rest/#get-/drep_epoch_summary
 */
export async function getTotalActiveDReps(): Promise<number | null> {
  try {
    const epochSummary = await getCurrentDRepEpochSummary();
    if (epochSummary) {
      // The dreps field in epoch summary represents active DReps
      return epochSummary.dreps;
    }
    return null;
  } catch (error) {
    console.error('Error fetching total active DReps from Koios:', error);
    return null;
  }
}

/**
 * Fetch all DReps (fetches all pages - use getDRepsPage for pagination)
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/dreps
 */
export async function getDReps(): Promise<DRep[]> {
  try {
    // Blockfrost API uses pagination, fetch all pages
    let allDReps: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      // Use blockfrostFetch helper for authenticated requests
      const dreps = await blockfrostFetch(`/governance/dreps?page=${page}&count=100`);
      
      // If endpoint returns null (404 or invalid path), governance endpoints might not be available
      if (dreps === null) {
        console.warn('DReps endpoint not available - returning empty array');
        return [];
      }
      
      if (!dreps || !Array.isArray(dreps)) {
        hasMore = false;
        break;
      }
      
      if (dreps.length > 0) {
        allDReps = [...allDReps, ...dreps];
        // Check if there are more pages (Blockfrost returns 100 items per page by default)
        hasMore = dreps.length === 100;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    return allDReps.map((drep: any) => ({
      drep_id: drep.drep_id,
      drep_hash: drep.drep_hash,
      view: drep.view,
      url: drep.url,
      metadata: drep.metadata,
      anchor: drep.anchor,
      voting_power: drep.voting_power,
      voting_power_active: drep.voting_power_active,
      status: drep.status,
      registration_tx_hash: drep.registration_tx_hash,
      registration_epoch: drep.registration_epoch,
    }));
  } catch (error) {
    console.error('Error fetching DReps:', error);
    return [];
  }
}

/**
 * Enrich a DRep with voting history statistics and delegator count (using Blockfrost)
 * This is the legacy method - kept for backward compatibility
 */
async function enrichDRepWithStats(drep: DRep): Promise<DRep> {
  try {
    // Fetch voting history and delegators in parallel
    const [votingHistory, delegators] = await Promise.all([
      getDRepVotingHistory(drep.drep_id),
      getDRepDelegators(drep.drep_id).catch(() => []), // Don't fail if delegators endpoint fails
    ]);
    
    const enriched = {
      ...drep,
      vote_count: votingHistory.length,
      last_vote_epoch: votingHistory.length > 0 
        ? Math.max(...votingHistory.map(v => v.epoch || 0))
        : undefined,
      delegator_count: delegators.length,
      has_profile: !!(drep.metadata?.name || drep.metadata?.description || drep.metadata?.website),
    };
    
    return enriched;
  } catch (error) {
    // If enrichment fails, return original DRep with at least has_profile
    return {
      ...drep,
      has_profile: !!(drep.metadata?.name || drep.metadata?.description || drep.metadata?.website),
    };
  }
}

/**
 * Enrich multiple DReps with voting history and delegator counts using Koios (fast bulk queries)
 * Falls back to Blockfrost if Koios fails
 */
async function enrichDRepsWithKoios(dreps: DRep[]): Promise<DRep[]> {
  if (dreps.length === 0) {
    return dreps;
  }

  try {
    // Convert all DRep IDs to CIP-129 for Koios queries
    const drepIdMap = new Map<string, string>(); // Map CIP-129 ID to original DRep
    const cip129Ids: string[] = [];

    for (const drep of dreps) {
      try {
        const cip129Id = normalizeToCIP129(drep.drep_id);
        drepIdMap.set(cip129Id, drep.drep_id);
        // Only add to Koios query list if it's a valid Bech32 DRep ID
        // Special system DReps (drep_always_abstain, etc.) can't be queried via Koios
        if (isValidDRepID(drep.drep_id) && !isSpecialSystemDRep(drep.drep_id)) {
          cip129Ids.push(cip129Id);
        }
      } catch (error) {
        console.warn(`Failed to convert DRep ID ${drep.drep_id} to CIP-129:`, error);
        // Skip invalid DRep IDs from Koios queries
      }
    }

    // Fetch delegators and votes in parallel using Koios
    // If Koios fails, we'll fall back to Blockfrost
    let delegatorsMap: Map<string, any[]> = new Map();
    let votesMap: Map<string, any[]> = new Map();
    let koiosFailed = false;

    try {
      // Use horizontal filtering to optimize queries:
      // - For delegators: Limit to 1000 (enough for count, reduces payload)
      // - For votes: Limit to 1000 (enough for count and recent activity check)
      //   Order by block_time desc to get most recent votes first (if API supports it)
      // Note: If Koios API doesn't support limit/order in request body, we'll process all results
      // but still benefit from vertical filtering (only processing needed fields)
      [delegatorsMap, votesMap] = await Promise.all([
        getDRepsDelegators(cip129Ids, 1000), // Horizontal filtering: limit to 1000 delegators
        getDRepsVotes(cip129Ids, 1000, 'block_time.desc'), // Horizontal filtering: limit to 1000 most recent votes
      ]);
    } catch (error) {
      console.warn('Koios API failed, falling back to Blockfrost:', error);
      koiosFailed = true;
    }

    // Check if we got meaningful results from Koios
    // Verify that we have actual data (not just empty maps)
    const hasDelegators = Array.from(delegatorsMap.values()).some(delegators => delegators.length > 0);
    const hasVotes = Array.from(votesMap.values()).some(votes => votes.length > 0);
    const hasKoiosData = hasDelegators || hasVotes;
    
    if (koiosFailed || !hasKoiosData) {
      console.log('Koios API unavailable or returned no data, falling back to Blockfrost for DRep enrichment');
      console.log(`Koios returned ${delegatorsMap.size} delegator maps (${hasDelegators ? 'with data' : 'empty'}) and ${votesMap.size} vote maps (${hasVotes ? 'with data' : 'empty'})`);
      return enrichDRepsWithBlockfrost(dreps);
    }
    
    console.log(`Koios enrichment successful: ${delegatorsMap.size} delegator maps, ${votesMap.size} vote maps`);

    // Enrich DReps with Koios data
    return dreps.map(drep => {
      try {
        // Skip special system DReps - they don't have delegators/votes in Koios
        if (isSpecialSystemDRep(drep.drep_id)) {
          return {
            ...drep,
            delegator_count: 0,
            vote_count: 0,
            has_profile: !!(drep.metadata?.name || drep.metadata?.description || drep.metadata?.website),
          };
        }
        
        const cip129Id = normalizeToCIP129(drep.drep_id);
        const delegators = delegatorsMap.get(cip129Id) || [];
        const votes = votesMap.get(cip129Id) || [];

        // Debug logging for enrichment
        if (delegators.length > 0 || votes.length > 0) {
          console.log(`Enriched DRep ${drep.drep_id}: ${delegators.length} delegators, ${votes.length} votes`);
        }

        // Calculate vote statistics
        const voteStats = {
          yes: votes.filter(v => v.vote === 'Yes').length,
          no: votes.filter(v => v.vote === 'No').length,
          abstain: votes.filter(v => v.vote === 'Abstain').length,
        };

        // Vertical filtering: Only process the fields we need (vote, block_time)
        // Get last vote block_time (most recent vote)
        // Since we ordered by block_time.desc, the first vote is the most recent
        // Note: Koios returns block_time, not epoch directly
        // We can use block_time for sorting, but epoch calculation requires network parameters
        // For now, we'll leave last_vote_epoch as undefined and use vote count for sorting
        const lastVoteBlockTime = votes.length > 0 && votes[0]?.block_time
          ? votes[0].block_time // First vote is most recent due to ordering
          : votes.length > 0
          ? Math.max(...votes.map(v => v.block_time || 0))
          : undefined;

        return {
          ...drep,
          delegator_count: delegators.length,
          vote_count: votes.length,
          // last_vote_epoch: undefined - Koios doesn't provide epoch, only block_time
          // We can calculate epoch from block_time if needed, but it requires network epoch parameters
          has_profile: !!(drep.metadata?.name || drep.metadata?.description || drep.metadata?.website),
        };
      } catch (error) {
        console.warn(`Failed to enrich DRep ${drep.drep_id}:`, error);
        // Return original DRep if enrichment fails
        return {
          ...drep,
          has_profile: !!(drep.metadata?.name || drep.metadata?.description || drep.metadata?.website),
        };
      }
    });
  } catch (error) {
    console.error('Error enriching DReps with Koios, falling back to Blockfrost:', error);
    // Fallback to Blockfrost
    return enrichDRepsWithBlockfrost(dreps);
  }
}

/**
 * Enrich DReps using Blockfrost (reliable and consistent)
 * Provides epoch information and voting history stats
 */
async function enrichDRepsWithBlockfrost(dreps: DRep[]): Promise<DRep[]> {
  // Use the existing Blockfrost enrichment method
  // Enriches all DReps in parallel for better performance
  return Promise.all(
    dreps.map(drep => enrichDRepWithStats(drep))
  );
}

/**
 * Fetch a single page of DReps with pagination
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/dreps
 */
export async function getDRepsPage(page: number = 1, count: number = 20, enrich: boolean = false): Promise<{ dreps: DRep[]; hasMore: boolean; total?: number }> {
  try {
    const dreps = await blockfrostFetch(`/governance/dreps?page=${page}&count=${count}`);
    
    // If endpoint returns null (404 or invalid path), governance endpoints might not be available
    if (dreps === null) {
      console.warn('DReps endpoint not available - returning empty array');
      return { dreps: [], hasMore: false };
    }
    
    if (!dreps || !Array.isArray(dreps)) {
      return { dreps: [], hasMore: false };
    }
    
    const mappedDReps = dreps.map((drep: any) => {
      // Determine status from the response (same logic as getDRep)
      let status: 'active' | 'inactive' | 'retired' = 'active';
      if (drep.retired !== undefined && drep.retired) {
        status = 'retired';
      } else if (drep.active !== undefined && !drep.active) {
        status = 'inactive';
      } else if (drep.status) {
        status = drep.status;
      }
      
      // Ensure all fields are present, even if undefined, so they serialize properly
      const mapped: DRep = {
        drep_id: drep.drep_id || '',
        drep_hash: drep.drep_hash || undefined,
        hex: drep.hex || undefined,
        view: drep.view || undefined,
        url: drep.url || undefined,
        metadata: drep.metadata || undefined,
        anchor: drep.anchor || undefined,
        voting_power: drep.voting_power || drep.amount || '0',
        voting_power_active: drep.voting_power_active || drep.amount || drep.voting_power || '0',
        amount: drep.amount || undefined,
        status: status,
        active: drep.active,
        active_epoch: drep.active_epoch,
        last_active_epoch: drep.last_active_epoch,
        has_script: drep.has_script,
        retired: drep.retired,
        expired: drep.expired,
        registration_tx_hash: drep.registration_tx_hash || undefined,
        registration_epoch: drep.registration_epoch || undefined,
      };
      
      return mapped;
    });
    
    // Enrich DReps with voting history stats if requested
    // Always use Blockfrost for enrichment (Koios endpoints are unreliable)
    let enrichedDReps: DRep[] = mappedDReps;
    if (enrich && mappedDReps.length > 0) {
      // Use Blockfrost for enrichment (reliable and consistent)
      enrichedDReps = await enrichDRepsWithBlockfrost(mappedDReps);
      
      // Also fetch metadata for each DRep to get names and descriptions
      // This is done in parallel batches for better performance
      enrichedDReps = await enrichDRepsWithMetadata(enrichedDReps);
    } else {
      // Still add has_profile flag
      enrichedDReps = mappedDReps.map(drep => ({
        ...drep,
        has_profile: !!(drep.metadata?.name || drep.metadata?.description || drep.metadata?.website),
      }));
    }
    
    // Check if there are more pages (if we got the full count, there might be more)
    const hasMore = dreps.length === count;
    
    return { dreps: enrichedDReps, hasMore };
  } catch (error) {
    console.error('Error fetching DReps page:', error);
    return { dreps: [], hasMore: false };
  }
}

/**
 * Fetch a single DRep by ID
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/dreps/drep_id
 * 
 * Returns detailed DRep information including:
 * - amount: Voting power amount
 * - active: Whether the DRep is currently active
 * - active_epoch: Epoch when DRep became active
 * - last_active_epoch: Last epoch when DRep was active
 * - has_script: Whether the DRep has a script
 * - retired: Whether the DRep is retired
 * - expired: Whether the DRep is expired
 */
export async function getDRep(drepId: string): Promise<DRep | null> {
  try {
    const drep = await blockfrostFetch(`/governance/dreps/${drepId}`);
    
    // If endpoint returns null (404 or invalid path), governance endpoints might not be available
    if (drep === null) {
      console.warn('DRep endpoint not available');
      return null;
    }
    
    if (!drep) {
      return null;
    }
    
    // Determine status from the response
    let status: 'active' | 'inactive' | 'retired' = 'active';
    if (drep.retired) {
      status = 'retired';
    } else if (!drep.active) {
      status = 'inactive';
    }
    
    return {
      drep_id: drep.drep_id,
      drep_hash: drep.drep_hash,
      hex: drep.hex,
      view: drep.view,
      url: drep.url,
      metadata: drep.metadata,
      anchor: drep.anchor,
      voting_power: drep.voting_power || drep.amount,
      voting_power_active: drep.voting_power_active || drep.amount,
      amount: drep.amount,
      status: drep.status || status,
      active: drep.active,
      active_epoch: drep.active_epoch,
      last_active_epoch: drep.last_active_epoch,
      has_script: drep.has_script,
      retired: drep.retired,
      expired: drep.expired,
      registration_tx_hash: drep.registration_tx_hash,
      registration_epoch: drep.registration_epoch,
    };
  } catch (error: any) {
    // Handle 404 errors gracefully
    if (error?.message?.includes('404') || error?.status === 404) {
      return null;
    }
    console.error('Error fetching DRep:', error);
    return null;
  }
}

/**
 * Enrich multiple DReps with metadata from the metadata endpoint
 * Fetches metadata in parallel batches for better performance
 */
async function enrichDRepsWithMetadata(dreps: DRep[]): Promise<DRep[]> {
  if (dreps.length === 0) {
    return dreps;
  }

  // Fetch metadata for all DReps in parallel batches
  const batchSize = 10; // Process 10 DReps in parallel to avoid rate limiting
  const enrichedDReps: DRep[] = [];
  
  for (let i = 0; i < dreps.length; i += batchSize) {
    const batch = dreps.slice(i, i + batchSize);
    
    // Fetch metadata for all DReps in batch in parallel
    const metadataPromises = batch.map(async (drep) => {
      try {
        // Skip special system DReps - they don't have metadata endpoints
        if (isSpecialSystemDRep(drep.drep_id)) {
          // Return system DRep as-is (they have special metadata)
          return drep;
        }
        
        // Convert DRep ID to CIP-105 for Blockfrost metadata endpoint
        const cip105Id = convertToCIP105(drep.drep_id);
        const metadata = await getDRepMetadata(cip105Id);
        
        // Merge metadata into DRep object
        return {
          ...drep,
          metadata: {
            ...drep.metadata,
            ...metadata, // Merge metadata from metadata endpoint
          },
        };
      } catch (error) {
        // If metadata fetch fails, return DRep as-is
        console.warn(`Failed to fetch metadata for DRep ${drep.drep_id}:`, error);
        return drep;
      }
    });
    
    const batchResults = await Promise.all(metadataPromises);
    enrichedDReps.push(...batchResults);
    
    // Add small delay between batches to avoid rate limiting
    if (i + batchSize < dreps.length) {
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay between batches
    }
  }
  
  return enrichedDReps;
}

/**
 * Fetch DRep metadata
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/dreps/{drep_id}/metadata
 * 
 * The metadata endpoint returns metadata in CIP-119 format.
 * The structure is: { json_metadata: { body: { givenName, objectives, motivations, qualifications, image: { contentUrl, sha256 } } } }
 */
export async function getDRepMetadata(drepId: string): Promise<any | null> {
  try {
    const metadataResponse = await blockfrostFetch(`/governance/dreps/${drepId}/metadata`);
    
    if (metadataResponse === null) {
      return null;
    }
    
    // The metadata follows CIP-119 structure with json_metadata.body
    if (typeof metadataResponse === 'object' && metadataResponse !== null) {
      const jsonMetadata = metadataResponse.json_metadata;
      
      if (jsonMetadata && typeof jsonMetadata === 'object' && jsonMetadata.body) {
        const body = jsonMetadata.body;
        
        // Map CIP-119 structure to our simpler metadata format
        const mappedMetadata: any = {};
        
        // Map givenName to name
        if (body.givenName) {
          mappedMetadata.name = body.givenName;
        }
        
        // Map objectives, motivations, qualifications to description
        // Combine them if multiple exist
        const descriptions = [];
        if (body.objectives) descriptions.push(`Objectives: ${body.objectives}`);
        if (body.motivations) descriptions.push(`Motivations: ${body.motivations}`);
        if (body.qualifications) descriptions.push(`Qualifications: ${body.qualifications}`);
        
        if (descriptions.length > 0) {
          mappedMetadata.description = descriptions.join('\n\n');
        }
        
        // Also keep individual fields for detailed display
        if (body.objectives) mappedMetadata.objectives = body.objectives;
        if (body.motivations) mappedMetadata.motivations = body.motivations;
        if (body.qualifications) mappedMetadata.qualifications = body.qualifications;
        
        // Map image
        if (body.image) {
          if (body.image.contentUrl) {
            mappedMetadata.image = body.image.contentUrl;
            mappedMetadata.logo = body.image.contentUrl;
          }
          if (body.image.sha256) {
            mappedMetadata.imageHash = body.image.sha256;
          }
        }
        
        // Preserve the URL to the metadata file
        if (metadataResponse.url) {
          mappedMetadata.metadataUrl = metadataResponse.url;
        }
        
        // Preserve hash for verification
        if (metadataResponse.hash) {
          mappedMetadata.metadataHash = metadataResponse.hash;
        }
        
        return mappedMetadata;
      }
      
      // If no json_metadata.body, try to return as-is (for backward compatibility)
      return metadataResponse;
    }
    
    return null;
  } catch (error: any) {
    if (error?.message?.includes('404') || error?.status === 404) {
      return null;
    }
    console.error('Error fetching DRep metadata:', error);
    return null;
  }
}

/**
 * Fetch DRep delegators
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/dreps/{drep_id}/delegators
 * 
 * Returns list of delegators with their addresses and delegated amounts
 */
export async function getDRepDelegators(drepId: string): Promise<DRepDelegator[]> {
  try {
    // Handle pagination for delegators
    let allDelegators: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const delegators = await blockfrostFetch(`/governance/dreps/${drepId}/delegators?page=${page}&count=100`);
      
      // If endpoint returns null (404 or invalid path), governance endpoints might not be available
      if (delegators === null) {
        console.warn('DRep delegators endpoint not available - returning empty array');
        return [];
      }
      
      if (!delegators || !Array.isArray(delegators)) {
        hasMore = false;
        break;
      }
      
      if (delegators.length > 0) {
        allDelegators = [...allDelegators, ...delegators];
        hasMore = delegators.length === 100;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    // Map the Blockfrost response to our DRepDelegator interface
    return allDelegators.map((item: any) => ({
      address: item.address,
      amount: item.amount || '0',
    }));
  } catch (error: any) {
    // Handle 404 errors gracefully
    if (error?.message?.includes('404') || error?.status === 404) {
      return [];
    }
    console.error('Error fetching DRep delegators:', error);
    return [];
  }
}

/**
 * Fetch DRep voting history and statistics
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/dreps/drep_id/votes
 * 
 * Returns detailed vote information including:
 * - tx_hash: Transaction hash of the vote
 * - proposal_id: Governance action ID (proposal_id)
 * - proposal_tx_hash: Transaction hash of the proposal
 * - vote: Vote value ("yes", "no", "abstain")
 */
export async function getDRepVotingHistory(drepId: string): Promise<DRepVotingHistory[]> {
  try {
    // Handle pagination for voting history
    let allVotes: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const votes = await blockfrostFetch(`/governance/dreps/${drepId}/votes?page=${page}&count=100`);
      
      // If endpoint returns null (404 or invalid path), governance endpoints might not be available
      if (votes === null) {
        console.warn('DRep voting history endpoint not available - returning empty array');
        return [];
      }
      
      if (!votes || !Array.isArray(votes)) {
        hasMore = false;
        break;
      }
      
      if (votes.length > 0) {
        allVotes = [...allVotes, ...votes];
        hasMore = votes.length === 100;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    // Map the Blockfrost response to our DRepVotingHistory interface
    return allVotes.map((item: any) => ({
      tx_hash: item.tx_hash,
      cert_index: item.cert_index,
      proposal_id: item.proposal_id, // This is the governance action ID
      action_id: item.proposal_id, // Alias for backward compatibility
      proposal_tx_hash: item.proposal_tx_hash,
      proposal_cert_index: item.proposal_cert_index,
      vote: item.vote as 'yes' | 'no' | 'abstain',
      voting_power: item.voting_power || '0',
      epoch: item.epoch,
    }));
  } catch (error: any) {
    // Handle 404 errors gracefully
    if (error?.message?.includes('404') || error?.status === 404) {
      return [];
    }
    console.error('Error fetching DRep voting history:', error);
    return [];
  }
}

/**
 * Map Koios proposal to GovernanceAction
 */
function mapKoiosProposalToAction(proposal: KoiosProposal): GovernanceAction {
  // Map proposal_type to our type format
  const typeMap: Record<string, GovernanceAction['type']> = {
    'ParameterChange': 'parameter_change',
    'HardForkInitiation': 'hard_fork_initiation',
    'TreasuryWithdrawals': 'treasury_withdrawals',
    'NoConfidence': 'no_confidence',
    'NewCommittee': 'new_committee',
    'UpdateCommittee': 'update_committee',
    'NewConstitution': 'new_constitution',
    'InfoAction': 'info',
  };

  // Determine status from epochs
  let status: GovernanceAction['status'] = 'submitted';
  if (proposal.enacted_epoch) {
    status = 'enacted';
  } else if (proposal.ratified_epoch) {
    status = 'ratified';
  } else if (proposal.dropped_epoch || proposal.expired_epoch) {
    status = 'expired';
  } else if (proposal.proposed_epoch) {
    status = 'voting';
  }

  // Parse metadata from meta_json if available
  // Handle CIP-100/CIP-108 format where metadata is nested in body
  let metadata: any = undefined;
  if (proposal.meta_json) {
    try {
      const parsed = typeof proposal.meta_json === 'string' 
        ? JSON.parse(proposal.meta_json) 
        : proposal.meta_json;
      
      // Check if this is CIP-100/CIP-108 format with body structure
      if (parsed.body && typeof parsed.body === 'object') {
        // Extract CIP-100/CIP-108 format metadata
        metadata = {
          title: parsed.body.title,
          abstract: parsed.body.abstract,
          description: parsed.body.abstract || parsed.body.description,
          motivation: parsed.body.motivation,
          rationale: parsed.body.rationale,
          references: parsed.body.references,
          // Keep the full body for reference
          _body: parsed.body,
          // Keep other top-level fields
          authors: parsed.authors,
          hashAlgorithm: parsed.hashAlgorithm,
        };
      } else {
        // Standard format - use as is
        metadata = parsed;
      }
    } catch (e) {
      console.warn('Failed to parse meta_json:', e);
    }
  }

  // Extract description as string (handle object structures)
  let description: string | undefined = undefined;
  if (proposal.proposal_description) {
    if (typeof proposal.proposal_description === 'string') {
      description = proposal.proposal_description;
    } else if (typeof proposal.proposal_description === 'object' && proposal.proposal_description !== null) {
      // Handle object structures like {tag: "...", description: "..."} or {content: "...", text: "..."}
      description = (proposal.proposal_description as any).description || 
                   (proposal.proposal_description as any).content || 
                   (proposal.proposal_description as any).text || 
                   (proposal.proposal_description as any).value ||
                   String(proposal.proposal_description);
    }
  }

  const action: GovernanceAction = {
    tx_hash: proposal.proposal_tx_hash,
    action_id: proposal.proposal_id, // Use proposal_id as action_id for Koios
    proposal_id: proposal.proposal_id,
    proposal_tx_hash: proposal.proposal_tx_hash,
    proposal_index: proposal.proposal_index,
    cert_index: proposal.proposal_index,
    deposit: proposal.deposit?.toString(),
    return_address: proposal.return_address,
    type: typeMap[proposal.proposal_type] || 'info',
    description,
    status,
    proposed_epoch: proposal.proposed_epoch,
    voting_epoch: proposal.proposed_epoch, // Use proposed_epoch as voting_epoch
    ratified_epoch: proposal.ratified_epoch || undefined,
    ratification_epoch: proposal.ratified_epoch || undefined,
    enactment_epoch: proposal.enacted_epoch || undefined,
    expiry_epoch: proposal.expired_epoch || proposal.expiration,
    expiration: proposal.expiration,
    dropped_epoch: proposal.dropped_epoch || undefined,
    meta_url: proposal.meta_url || undefined,
    meta_hash: proposal.meta_hash || undefined,
    meta_json: proposal.meta_json,
    meta_language: proposal.meta_language || undefined,
    meta_comment: proposal.meta_comment || undefined,
    meta_is_valid: proposal.meta_is_valid,
    withdrawal: proposal.withdrawal || undefined,
    param_proposal: proposal.param_proposal || undefined,
    block_time: proposal.block_time,
    metadata,
  };

  return action;
}

/**
 * Enrich actions with metadata from Blockfrost if not already present
 */
async function enrichActionsWithMetadata(actions: GovernanceAction[]): Promise<GovernanceAction[]> {
  // Filter actions that need metadata enrichment
  // Include actions that:
  // 1. Don't have metadata at all, OR
  // 2. Have meta_json but metadata parsing might have failed or needs enrichment from Blockfrost
  const actionsNeedingMetadata = actions.filter(action => {
    // If we have a properly parsed metadata object with title or description, we're good
    const hasValidMetadata = action.metadata && (
      action.metadata.title || 
      action.metadata.description || 
      action.metadata.abstract
    );
    
    // Need metadata if we don't have valid metadata AND we have a tx_hash to fetch it
    return !hasValidMetadata && action.proposal_tx_hash;
  });

  if (actionsNeedingMetadata.length === 0) {
    return actions;
  }

  // Batch fetch metadata from Blockfrost
  const metadataMap = await getProposalMetadataBatch(
    actionsNeedingMetadata.map(action => ({
      tx_hash: action.proposal_tx_hash!,
      cert_index: action.cert_index || action.proposal_index || 0,
      action_id: action.action_id,
    }))
  );

  // Merge metadata into actions
  return actions.map(action => {
    const enrichedMetadata = metadataMap.get(action.action_id);
    if (enrichedMetadata) {
      // Check if we already have metadata but the enriched one is better
      const hasValidMetadata = action.metadata && (
        action.metadata.title || 
        action.metadata.description || 
        action.metadata.abstract
      );
      
      // Use enriched metadata if we don't have valid metadata
      if (!hasValidMetadata) {
        return {
          ...action,
          metadata: enrichedMetadata,
        };
      }
    }
    return action;
  });
}

/**
 * Enrich actions with voting summaries from Koios
 */
async function enrichActionsWithVotingSummary(actions: GovernanceAction[]): Promise<GovernanceAction[]> {
  // Get proposal IDs that have CIP-129 format
  const proposalIds = actions
    .map(action => action.proposal_id)
    .filter((id): id is string => !!id && id.startsWith('gov_action1'));

  if (proposalIds.length === 0) {
    return actions;
  }

  // Fetch voting summaries in bulk
  const summaryMap = await getProposalVotingSummary(proposalIds);

  // Note: Voting summaries are stored separately and used in components
  // We don't merge them into the action object to keep it clean
  // Components can fetch voting summaries as needed

  return actions;
}

/**
 * Fetch all governance actions
 * Tries Koios first for bulk list (faster), falls back to Blockfrost
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/actions
 */
export async function getGovernanceActions(): Promise<GovernanceAction[]> {
  try {
    // Try Koios first for bulk list
    let koiosActions: GovernanceAction[] = [];
    try {
      const koiosProposals = await getProposalsList(undefined, 'block_time.desc');
      koiosActions = koiosProposals.map(mapKoiosProposalToAction);
      
      if (koiosActions.length > 0) {
        // Enrich with metadata if needed (some may not have meta_json)
        koiosActions = await enrichActionsWithMetadata(koiosActions);
        return koiosActions;
      }
    } catch (error) {
      console.warn('Koios API failed, falling back to Blockfrost:', error);
    }

    // Fallback to Blockfrost
    let allActions: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const actions = await blockfrostFetch(`/governance/actions?page=${page}&count=100`);
      
      if (actions === null) {
        console.warn('Governance actions endpoint not available - returning empty array');
        return [];
      }
      
      if (!actions || !Array.isArray(actions)) {
        hasMore = false;
        break;
      }
      
      if (actions.length > 0) {
        allActions = [...allActions, ...actions];
        hasMore = actions.length === 100;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    return allActions.map((action: any) => ({
      tx_hash: action.tx_hash,
      action_id: action.action_id,
      deposit: action.deposit || undefined,
      reward_account: action.reward_account || undefined,
      type: action.type,
      description: action.description,
      status: action.status,
      voting_epoch: action.voting_epoch,
      enactment_epoch: action.enactment_epoch,
      expiry_epoch: action.expiry_epoch,
      metadata: action.metadata,
    }));
  } catch (error) {
    console.error('Error fetching governance actions:', error);
    return [];
  }
}

/**
 * Fetch a single governance action by ID
 * Tries Koios first (if CIP-129 format), then Blockfrost
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/actions/action_id
 */
export async function getGovernanceAction(actionId: string): Promise<GovernanceAction | null> {
  try {
    // Check if it's a CIP-129 proposal ID (Koios format)
    const parsed = parseProposalId(actionId);
    
    if (parsed.format === 'cip129') {
      // Try to find in Koios proposals list
      try {
        const proposals = await getProposalsList();
        const proposal = proposals.find(p => p.proposal_id === actionId);
        if (proposal) {
          const action = mapKoiosProposalToAction(proposal);
          // Enrich with metadata if needed
          const enriched = await enrichActionsWithMetadata([action]);
          return enriched[0] || action;
        }
      } catch (error) {
        console.warn('Koios API failed for single action, falling back to Blockfrost:', error);
      }
    }

    // Fallback to Blockfrost
    const action = await blockfrostFetch(`/governance/actions/${actionId}`);
    
    if (action === null) {
      console.warn('Governance action endpoint not available');
      return null;
    }
    
    if (!action) {
      return null;
    }
    
    return {
      tx_hash: action.tx_hash,
      action_id: action.action_id,
      deposit: action.deposit || undefined,
      reward_account: action.reward_account || undefined,
      type: action.type,
      description: action.description,
      status: action.status,
      voting_epoch: action.voting_epoch,
      enactment_epoch: action.enactment_epoch,
      expiry_epoch: action.expiry_epoch,
      metadata: action.metadata,
    };
  } catch (error: any) {
    // Handle 404 errors gracefully
    if (error?.message?.includes('404') || error?.status === 404) {
      return null;
    }
    console.error('Error fetching governance action:', error);
    return null;
  }
}

/**
 * Fetch a single page of governance actions with pagination
 * Tries Koios first, falls back to Blockfrost
 * @param page Page number (1-indexed)
 * @param count Number of items per page
 * @param enrich Whether to enrich with metadata and voting summaries (expensive)
 */
export async function getGovernanceActionsPage(
  page: number = 1,
  count: number = 20,
  enrich: boolean = false
): Promise<{ actions: GovernanceAction[]; hasMore: boolean; total?: number }> {
  try {
    // Try Koios first for bulk list
    try {
      const koiosProposals = await getProposalsList(undefined, 'block_time.desc');
      const allActions = koiosProposals.map(mapKoiosProposalToAction);
      
      if (allActions.length > 0) {
        // Apply pagination
        const startIndex = (page - 1) * count;
        const endIndex = startIndex + count;
        const paginatedActions = allActions.slice(startIndex, endIndex);
        const hasMore = endIndex < allActions.length;

        // Enrich if requested
        let enrichedActions = paginatedActions;
        if (enrich) {
          enrichedActions = await enrichActionsWithMetadata(paginatedActions);
        }

        return {
          actions: enrichedActions,
          hasMore,
          total: allActions.length,
        };
      }
    } catch (error) {
      console.warn('Koios API failed, falling back to Blockfrost:', error);
    }

    // Fallback to Blockfrost
    const actions = await blockfrostFetch(`/governance/actions?page=${page}&count=${count}`);
    
    if (actions === null) {
      console.warn('Governance actions endpoint not available - returning empty array');
      return { actions: [], hasMore: false };
    }
    
    if (!actions || !Array.isArray(actions)) {
      return { actions: [], hasMore: false };
    }
    
    const mappedActions: GovernanceAction[] = actions.map((action: any) => ({
      tx_hash: action.tx_hash,
      action_id: action.action_id,
      deposit: action.deposit || undefined,
      reward_account: action.reward_account || undefined,
      type: action.type,
      description: action.description,
      status: action.status,
      voting_epoch: action.voting_epoch,
      enactment_epoch: action.enactment_epoch,
      expiry_epoch: action.expiry_epoch,
      metadata: action.metadata,
    }));

    // Check if there are more pages
    const hasMore = actions.length === count;
    
    // Enrich if requested
    let enrichedActions = mappedActions;
    if (enrich) {
      enrichedActions = await enrichActionsWithMetadata(mappedActions);
    }

    return {
      actions: enrichedActions,
      hasMore,
    };
  } catch (error) {
    console.error('Error fetching governance actions page:', error);
    return { actions: [], hasMore: false };
  }
}

/**
 * Convert Koios voting summary to ActionVotingBreakdown
 */
function convertKoiosSummaryToBreakdown(summary: any): ActionVotingBreakdown {
  // Calculate total voting power
  const totalPower = BigInt(summary.drep_yes_vote_power || '0') +
    BigInt(summary.drep_no_vote_power || '0') +
    BigInt(summary.drep_active_abstain_vote_power || '0') +
    BigInt(summary.drep_always_abstain_vote_power || '0') +
    BigInt(summary.drep_always_no_confidence_vote_power || '0') +
    BigInt(summary.pool_yes_vote_power || '0') +
    BigInt(summary.pool_no_vote_power || '0') +
    BigInt(summary.pool_active_abstain_vote_power || '0') +
    BigInt(summary.pool_passive_always_abstain_vote_power || '0') +
    BigInt(summary.pool_passive_always_no_confidence_vote_power || '0');

  return {
    drep_votes: {
      yes: summary.drep_yes_vote_power || '0',
      no: summary.drep_no_vote_power || '0',
      abstain: (
        BigInt(summary.drep_active_abstain_vote_power || '0') +
        BigInt(summary.drep_always_abstain_vote_power || '0')
      ).toString(),
    },
    spo_votes: {
      yes: summary.pool_yes_vote_power || '0',
      no: summary.pool_no_vote_power || '0',
      abstain: (
        BigInt(summary.pool_active_abstain_vote_power || '0') +
        BigInt(summary.pool_passive_always_abstain_vote_power || '0')
      ).toString(),
    },
    cc_votes: {
      yes: '0', // Koios doesn't provide CC voting power in same format
      no: '0',
      abstain: '0',
    },
    total_voting_power: totalPower.toString(),
  };
}

/**
 * Fetch voting results for a governance action
 * Tries Koios voting summary first (if CIP-129 format), falls back to Blockfrost
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/actions/action_id/votes
 */
export async function getActionVotingResults(actionId: string): Promise<ActionVotingBreakdown> {
  try {
    // Check if it's a CIP-129 proposal ID (Koios format)
    const parsed = parseProposalId(actionId);
    
    if (parsed.format === 'cip129') {
      // Try Koios voting summary
      try {
        const summaryMap = await getProposalVotingSummary([actionId]);
        const summary = summaryMap.get(actionId);
        if (summary) {
          return convertKoiosSummaryToBreakdown(summary);
        }
      } catch (error) {
        console.warn('Koios voting summary failed, falling back to Blockfrost:', error);
      }
    }

    // Fallback to Blockfrost
    // Handle pagination for votes
    let allVotes: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const votes = await blockfrostFetch(`/governance/actions/${actionId}/votes?page=${page}&count=100`);
      
      // If endpoint returns null (404 or invalid path), governance endpoints might not be available
      if (votes === null) {
        console.warn('Action voting results endpoint not available - returning empty breakdown');
        return {
          drep_votes: { yes: '0', no: '0', abstain: '0' },
          spo_votes: { yes: '0', no: '0', abstain: '0' },
          cc_votes: { yes: '0', no: '0', abstain: '0' },
          total_voting_power: '0',
        };
      }
      
      if (!votes || !Array.isArray(votes)) {
        hasMore = false;
        break;
      }
      
      if (votes.length > 0) {
        allVotes = [...allVotes, ...votes];
        hasMore = votes.length === 100;
        page++;
      } else {
        hasMore = false;
      }
    }

    const votes = allVotes;
    
    const breakdown: ActionVotingBreakdown = {
      drep_votes: { yes: '0', no: '0', abstain: '0' },
      spo_votes: { yes: '0', no: '0', abstain: '0' },
      cc_votes: { yes: '0', no: '0', abstain: '0' },
      total_voting_power: '0',
    };

    let totalPower = BigInt(0);

    votes.forEach((vote: any) => {
      const power = BigInt(vote.voting_power || '0');
      totalPower += power;

      const voteValue = vote.vote === 'yes' ? 'yes' : vote.vote === 'no' ? 'no' : 'abstain';
      
      if (vote.voter_type === 'drep') {
        breakdown.drep_votes[voteValue] = (
          BigInt(breakdown.drep_votes[voteValue] || '0') + power
        ).toString();
      } else if (vote.voter_type === 'spo') {
        breakdown.spo_votes[voteValue] = (
          BigInt(breakdown.spo_votes[voteValue] || '0') + power
        ).toString();
      } else if (vote.voter_type === 'cc') {
        breakdown.cc_votes[voteValue] = (
          BigInt(breakdown.cc_votes[voteValue] || '0') + power
        ).toString();
      }
    });

    breakdown.total_voting_power = totalPower.toString();

    return breakdown;
  } catch (error: any) {
    // Handle 404 errors gracefully
    if (error?.message?.includes('404') || error?.status === 404) {
      return {
        drep_votes: { yes: '0', no: '0', abstain: '0' },
        spo_votes: { yes: '0', no: '0', abstain: '0' },
        cc_votes: { yes: '0', no: '0', abstain: '0' },
        total_voting_power: '0',
      };
    }
    console.error('Error fetching voting results:', error);
    return {
      drep_votes: { yes: '0', no: '0', abstain: '0' },
      spo_votes: { yes: '0', no: '0', abstain: '0' },
      cc_votes: { yes: '0', no: '0', abstain: '0' },
      total_voting_power: '0',
    };
  }
}

/**
 * Fetch proposal metadata from Blockfrost
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/proposals/{tx_hash}/{cert_index}/metadata
 * 
 * @param tx_hash Transaction hash
 * @param cert_index Certificate index (defaults to 0)
 * @returns Metadata object or null if not found
 */
export async function getProposalMetadata(
  tx_hash: string,
  cert_index: number = 0
): Promise<any | null> {
  try {
    const metadata = await blockfrostFetch(
      `/governance/proposals/${tx_hash}/${cert_index}/metadata`
    );
    
    if (metadata === null) {
      return null;
    }
    
    // Parse and normalize metadata structure (CIP-100/CIP-108 format)
    // Handle both raw JSON and parsed structures
    let parsed: any;
    if (typeof metadata === 'string') {
      try {
        parsed = JSON.parse(metadata);
      } catch (e) {
        return metadata; // Return as-is if not JSON
      }
    } else {
      parsed = metadata;
    }
    
    // Check if this is CIP-100/CIP-108 format with body structure
    if (parsed.body && typeof parsed.body === 'object') {
      // Extract CIP-100/CIP-108 format metadata
      return {
        title: parsed.body.title,
        abstract: parsed.body.abstract,
        description: parsed.body.abstract || parsed.body.description,
        motivation: parsed.body.motivation,
        rationale: parsed.body.rationale,
        references: parsed.body.references,
        // Keep the full body for reference
        _body: parsed.body,
        // Keep other top-level fields
        authors: parsed.authors,
        hashAlgorithm: parsed.hashAlgorithm,
      };
    }
    
    // Standard format - return as is
    return parsed;
  } catch (error: any) {
    // Handle 404 errors gracefully (metadata may not exist)
    if (error?.message?.includes('404') || error?.status === 404) {
      return null;
    }
    console.error('Error fetching proposal metadata:', error);
    return null;
  }
}

/**
 * Batch fetch metadata for multiple proposals
 * Fetches in parallel batches to avoid rate limiting
 * 
 * @param actions Array of actions with tx_hash and cert_index
 * @returns Map of action_id to metadata
 */
export async function getProposalMetadataBatch(
  actions: Array<{ tx_hash: string; cert_index?: number; action_id: string }>
): Promise<Map<string, any>> {
  const metadataMap = new Map<string, any>();
  
  if (actions.length === 0) {
    return metadataMap;
  }

  // Batch requests in parallel chunks with rate limiting
  const chunkSize = 10; // Similar to Koios pattern
  for (let i = 0; i < actions.length; i += chunkSize) {
    const chunk = actions.slice(i, i + chunkSize);
    
    // Fetch metadata for all actions in chunk in parallel
    const chunkPromises = chunk.map(async (action, index) => {
      try {
        // Add small delay between requests to avoid rate limiting
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const metadata = await getProposalMetadata(
          action.tx_hash,
          action.cert_index || 0
        );
        return { action_id: action.action_id, metadata };
      } catch (error) {
        return { action_id: action.action_id, metadata: null };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    for (const { action_id, metadata } of chunkResults) {
      if (metadata) {
        metadataMap.set(action_id, metadata);
      }
    }
    
    // Add delay between chunks to avoid rate limiting
    if (i + chunkSize < actions.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return metadataMap;
}

