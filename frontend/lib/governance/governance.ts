import type { DRep, GovernanceAction, DRepVotingHistory, ActionVotingBreakdown, DRepDelegator } from '@/types/governance';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNotFoundError = (error: unknown): boolean => {
  if (error instanceof Error && error.message.includes('404')) {
    return true;
  }
  if (isRecord(error) && typeof error.status === 'number') {
    return error.status === 404;
  }
  return false;
};

/**
 * Get the base URL for API requests
 * In server components, we need an absolute URL
 */
function getBaseUrl(): string {
  // In server-side rendering, we need to construct the full URL
  if (typeof window === 'undefined') {
    // Check for explicitly set site URL first
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl) {
      return siteUrl;
    }
    
    // For Vercel, VERCEL_URL is provided (e.g., "govtwool.vercel.app")
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
      // Vercel provides the URL without protocol, add https
      return `https://${vercelUrl}`;
    }
    
    // Local development - default to localhost:3000
    return 'http://localhost:3000';
  }
  // Client-side: use relative URL
  return '';
}

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
 * Get total active DReps count from backend
 */
export async function getTotalActiveDReps(): Promise<number | null> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/dreps/stats`, {
      next: { revalidate: 60 },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.active_dreps_count || null;
  } catch (error) {
    console.error('Error fetching total active DReps:', error);
    return null;
  }
}

/**
 * Fetch all DReps (fetches all pages - use getDRepsPage for pagination)
 * Uses backend API which handles provider selection and caching
 */
export async function getDReps(): Promise<DRep[]> {
  try {
    let allDReps: DRep[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/dreps?page=${page}&count=100`, {
        next: { revalidate: 60 },
      });
      
      if (!response.ok) {
        console.warn('DReps endpoint not available');
        break;
      }
      
      const data: unknown = await response.json();
      
      if (!isRecord(data) || !Array.isArray(data.dreps)) {
        hasMore = false;
        break;
      }
      
      if (data.dreps.length > 0) {
        allDReps = [...allDReps, ...(data.dreps as DRep[])];
        const hasMoreValue =
          typeof data.has_more === 'boolean'
            ? data.has_more
            : Array.isArray(data.dreps) && data.dreps.length === 100;
        hasMore = hasMoreValue;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    return allDReps;
  } catch (error) {
    console.error('Error fetching DReps:', error);
    return [];
  }
}

/**
 * Fetch a single page of DReps with pagination
 * Uses backend API which handles provider selection and caching
 */
export async function getDRepsPage(page: number = 1, count: number = 20, enrich: boolean = false): Promise<{ dreps: DRep[]; hasMore: boolean; total?: number }> {
  try {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      count: count.toString(),
      ...(enrich && { enrich: 'true' }),
    });
    
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/dreps?${queryParams}`, {
      next: { revalidate: 60 },
    });
    
    if (!response.ok) {
      console.warn('DReps endpoint not available');
      return { dreps: [], hasMore: false };
    }
    
    const data: unknown = await response.json();
    
    if (!isRecord(data) || !Array.isArray(data.dreps)) {
      return { dreps: [], hasMore: false };
    }
    
    // Add has_profile flag based on metadata
    const enrichedDReps = (data.dreps as DRep[]).map((drep) => ({
      ...drep,
      has_profile: !!(drep.metadata?.name || drep.metadata?.description || drep.metadata?.website),
    }));
    
    return {
      dreps: enrichedDReps,
      hasMore: typeof data.has_more === 'boolean' ? data.has_more : false,
      total: typeof data.total === 'number' ? data.total : undefined,
    };
  } catch (error) {
    console.error('Error fetching DReps page:', error);
    return { dreps: [], hasMore: false };
  }
}

/**
 * Fetch a single DRep by ID
 * Uses backend API which handles provider selection and caching
 */
export async function getDRep(drepId: string): Promise<DRep | null> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/dreps/${encodeURIComponent(drepId)}`, {
      next: { revalidate: 60 },
    });
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const drep: unknown = await response.json();
    
    if (!drep) {
      return null;
    }
    
    return drep as DRep;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }
    console.error('Error fetching DRep:', error);
    return null;
  }
}

/**
 * Fetch DRep metadata
 * Uses backend API which handles provider selection and caching
 */
export async function getDRepMetadata(drepId: string): Promise<Record<string, unknown> | null> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/dreps/${encodeURIComponent(drepId)}/metadata`, {
      next: { revalidate: 60 },
    });
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      return null;
    }
    
    const metadata: unknown = await response.json();
    return isRecord(metadata) ? metadata : null;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }
    console.error('Error fetching DRep metadata:', error);
    return null;
  }
}

/**
 * Fetch DRep delegators
 * Uses backend API which handles provider selection and caching
 */
export async function getDRepDelegators(drepId: string): Promise<DRepDelegator[]> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/dreps/${encodeURIComponent(drepId)}/delegators`, {
      next: { revalidate: 60 },
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const delegators: unknown = await response.json();
    return Array.isArray(delegators) ? (delegators as DRepDelegator[]) : [];
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return [];
    }
    console.error('Error fetching DRep delegators:', error);
    return [];
  }
}

/**
 * Fetch DRep voting history and statistics
 * Uses backend API which handles provider selection and caching
 */
export async function getDRepVotingHistory(drepId: string): Promise<DRepVotingHistory[]> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/dreps/${encodeURIComponent(drepId)}/votes`, {
      next: { revalidate: 60 },
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const votes: unknown = await response.json();
    return Array.isArray(votes) ? (votes as DRepVotingHistory[]) : [];
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return [];
    }
    console.error('Error fetching DRep voting history:', error);
    return [];
  }
}

/**
 * Fetch all governance actions
 * Uses backend API which handles provider selection and caching
 */
export async function getGovernanceActions(): Promise<GovernanceAction[]> {
  try {
    let allActions: GovernanceAction[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/actions?page=${page}&count=100`, {
        next: { revalidate: 60 },
      });
      
      if (!response.ok) {
        console.warn('Governance actions endpoint not available');
        break;
      }
      
      const data: unknown = await response.json();
      
      if (!isRecord(data) || !Array.isArray(data.actions)) {
        hasMore = false;
        break;
      }
      
      if (data.actions.length > 0) {
        allActions = [...allActions, ...(data.actions as GovernanceAction[])];
        const hasMoreValue =
          typeof data.has_more === 'boolean'
            ? data.has_more
            : Array.isArray(data.actions) && data.actions.length === 100;
        hasMore = hasMoreValue;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    return allActions;
  } catch (error) {
    console.error('Error fetching governance actions:', error);
    return [];
  }
}

/**
 * Fetch a single governance action by ID
 * Uses backend API which handles provider selection and caching
 */
export async function getGovernanceAction(actionId: string): Promise<GovernanceAction | null> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/actions/${encodeURIComponent(actionId)}`, {
      next: { revalidate: 60 },
    });
    
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const action: unknown = await response.json();
    
    if (!action) {
      return null;
    }
    
    return action as GovernanceAction;
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null;
    }
    console.error('Error fetching governance action:', error);
    return null;
  }
}

/**
 * Fetch a single page of governance actions with pagination
 * Uses backend API which handles provider selection and caching
 */
export async function getGovernanceActionsPage(
  page: number = 1,
  count: number = 20,
  enrich: boolean = false
): Promise<{ actions: GovernanceAction[]; hasMore: boolean; total?: number }> {
  try {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      count: count.toString(),
      ...(enrich && { enrich: 'true' }),
    });
    
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/actions?${queryParams}`, {
      next: { revalidate: 60 },
    });
    
    if (!response.ok) {
      console.warn('Governance actions endpoint not available');
      return { actions: [], hasMore: false };
    }
    
    const data: unknown = await response.json();
    
    if (!isRecord(data) || !Array.isArray(data.actions)) {
      return { actions: [], hasMore: false };
    }
    
    return {
      actions: data.actions as GovernanceAction[],
      hasMore: typeof data.has_more === 'boolean' ? data.has_more : false,
      total: typeof data.total === 'number' ? data.total : undefined,
    };
  } catch (error) {
    console.error('Error fetching governance actions page:', error);
    return { actions: [], hasMore: false };
  }
}

/**
 * Fetch voting results for a governance action
 * Uses backend API which handles provider selection and caching
 */
export async function getActionVotingResults(actionId: string): Promise<ActionVotingBreakdown> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/actions/${encodeURIComponent(actionId)}/votes`, {
      next: { revalidate: 60 },
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const breakdown: unknown = await response.json();
    if (!isRecord(breakdown)) {
      return {
        drep_votes: { yes: '0', no: '0', abstain: '0' },
        spo_votes: { yes: '0', no: '0', abstain: '0' },
        cc_votes: { yes: '0', no: '0', abstain: '0' },
        total_voting_power: '0',
      };
    }

    return {
      drep_votes: isRecord(breakdown.drep_votes)
        ? {
            yes: String(breakdown.drep_votes.yes ?? '0'),
            no: String(breakdown.drep_votes.no ?? '0'),
            abstain: String(breakdown.drep_votes.abstain ?? '0'),
          }
        : { yes: '0', no: '0', abstain: '0' },
      spo_votes: isRecord(breakdown.spo_votes)
        ? {
            yes: String(breakdown.spo_votes.yes ?? '0'),
            no: String(breakdown.spo_votes.no ?? '0'),
            abstain: String(breakdown.spo_votes.abstain ?? '0'),
          }
        : { yes: '0', no: '0', abstain: '0' },
      cc_votes: isRecord(breakdown.cc_votes)
        ? {
            yes: String(breakdown.cc_votes.yes ?? '0'),
            no: String(breakdown.cc_votes.no ?? '0'),
            abstain: String(breakdown.cc_votes.abstain ?? '0'),
          }
        : { yes: '0', no: '0', abstain: '0' },
      total_voting_power: String(breakdown.total_voting_power ?? '0'),
    };
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
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
