/**
 * Check if Blockfrost governance endpoints are available
 * Governance endpoints may not be available on all networks or API tiers
 * Reference: https://docs.blockfrost.io/#tag/cardano--governance
 */

import { blockfrostFetch } from '../api/blockfrost';

let governanceAvailable: boolean | null = null;

/**
 * Check if governance endpoints are available
 * Caches the result to avoid repeated checks
 */
export async function checkGovernanceAvailability(): Promise<boolean> {
  if (governanceAvailable !== null) {
    return governanceAvailable;
  }

  try {
    // Try to fetch a single DRep to check if endpoints are available
    const testResponse = await blockfrostFetch('/governance/dreps?page=1&count=1');
    
    // If we get a response (even if empty array), endpoints are available
    governanceAvailable = Array.isArray(testResponse);
    
    if (!governanceAvailable) {
      console.warn('Blockfrost governance endpoints are not available. This might be because:');
      console.warn('1. Governance endpoints are not yet implemented');
      console.warn('2. Your API key does not have access to governance endpoints');
      console.warn('3. You are using a network (preview/testnet) where governance is not available');
      console.warn('4. Governance endpoints require a different API tier');
    }
    
    return governanceAvailable;
  } catch (error) {
    governanceAvailable = false;
    console.warn('Error checking governance availability:', error);
    return false;
  }
}

/**
 * Reset the availability check (useful for testing)
 */
export function resetGovernanceAvailabilityCheck() {
  governanceAvailable = null;
}

