import { blockfrostFetch } from './blockfrost';
import { getDRepsDelegators, getDRepsVotes } from './koios';
import { normalizeToCIP129, convertToCIP105 } from './drep-id';
import type { DRep, GovernanceAction, VotingResult, DRepVotingHistory, ActionVotingBreakdown, DRepDelegator } from '@/types/governance';

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
        cip129Ids.push(cip129Id);
      } catch (error) {
        console.warn(`Failed to convert DRep ID ${drep.drep_id} to CIP-129:`, error);
        // Keep original ID if conversion fails
        drepIdMap.set(drep.drep_id, drep.drep_id);
        cip129Ids.push(drep.drep_id);
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
      //   Order by block_time desc to get most recent votes first
      [delegatorsMap, votesMap] = await Promise.all([
        getDRepsDelegators(cip129Ids, 1000), // Horizontal filtering: limit to 1000 delegators
        getDRepsVotes(cip129Ids, 1000, 'block_time.desc'), // Horizontal filtering: limit to 1000 most recent votes
      ]);
    } catch (error) {
      console.warn('Koios API failed, falling back to Blockfrost:', error);
      koiosFailed = true;
    }

    // Check if we got meaningful results from Koios
    // If Koios failed completely or returned no data, fall back to Blockfrost
    const hasKoiosData = delegatorsMap.size > 0 || votesMap.size > 0;
    
    if (koiosFailed || !hasKoiosData) {
      console.log('Koios API unavailable or returned no data, falling back to Blockfrost for DRep enrichment');
      return enrichDRepsWithBlockfrost(dreps);
    }

    // Enrich DReps with Koios data
    return dreps.map(drep => {
      try {
        const cip129Id = normalizeToCIP129(drep.drep_id);
        const delegators = delegatorsMap.get(cip129Id) || [];
        const votes = votesMap.get(cip129Id) || [];

        // Calculate vote statistics
        const voteStats = {
          yes: votes.filter(v => v.vote === 'Yes').length,
          no: votes.filter(v => v.vote === 'No').length,
          abstain: votes.filter(v => v.vote === 'Abstain').length,
        };

        // Get last vote block_time (most recent vote)
        // Note: Koios returns block_time, not epoch directly
        // We can use block_time for sorting, but epoch calculation requires network parameters
        // For now, we'll leave last_vote_epoch as undefined and use vote count for sorting
        const lastVoteBlockTime = votes.length > 0
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
 * Fallback: Enrich DReps using Blockfrost (slower but more reliable)
 */
async function enrichDRepsWithBlockfrost(dreps: DRep[]): Promise<DRep[]> {
  // Use the existing Blockfrost enrichment method
  // This is slower but provides epoch information
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
    // Use Koios for fast bulk queries when enriching
    let enrichedDReps: DRep[] = mappedDReps;
    if (enrich && mappedDReps.length > 0) {
      // Use Koios for bulk enrichment (much faster than individual Blockfrost requests)
      enrichedDReps = await enrichDRepsWithKoios(mappedDReps);
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
 * Fetch all governance actions
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/actions
 */
export async function getGovernanceActions(): Promise<GovernanceAction[]> {
  try {
    // Handle pagination
    let allActions: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const actions = await blockfrostFetch(`/governance/actions?page=${page}&count=100`);
      
      // If endpoint returns null (404 or invalid path), governance endpoints might not be available
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
      deposit: action.deposit,
      reward_account: action.reward_account,
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
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/actions/action_id
 */
export async function getGovernanceAction(actionId: string): Promise<GovernanceAction | null> {
  try {
    const action = await blockfrostFetch(`/governance/actions/${actionId}`);
    
    // If endpoint returns null (404 or invalid path), governance endpoints might not be available
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
      deposit: action.deposit,
      reward_account: action.reward_account,
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
 * Fetch voting results for a governance action
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance/get/governance/actions/action_id/votes
 */
export async function getActionVotingResults(actionId: string): Promise<ActionVotingBreakdown> {
  try {
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

