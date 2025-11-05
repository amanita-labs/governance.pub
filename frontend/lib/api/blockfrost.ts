import { BlockfrostProvider } from '@meshsdk/core';

// Use server-side only environment variables (no NEXT_PUBLIC_ prefix for security)
const API_KEY = process.env.BLOCKFROST_API_KEY || '';
const NETWORK = process.env.BLOCKFROST_NETWORK || 'mainnet';

// Initialize Mesh Blockfrost Provider
// Mesh Provider automatically handles the base URL and authentication based on the API key format
// Reference: https://meshjs.dev/providers/blockfrost
export const blockfrostProvider = new BlockfrostProvider(API_KEY);

// Helper to get the base URL for governance endpoints
// Governance endpoints may need to be called directly with fetch
export function getBlockfrostBaseUrl(): string {
  return NETWORK === 'mainnet' 
    ? 'https://cardano-mainnet.blockfrost.io/api/v0'
    : 'https://cardano-preview.blockfrost.io/api/v0';
}

// Helper to make authenticated fetch requests to Blockfrost API
export async function blockfrostFetch(path: string): Promise<any> {
  const baseUrl = getBlockfrostBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'project_id': API_KEY,
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    
    // Handle 400 errors with more detail
    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || response.statusText;
      
      // If it's an "Invalid path" error, it might mean governance endpoints aren't available
      if (errorMessage.includes('Invalid path') || errorMessage.includes('not found')) {
        console.warn(`Blockfrost endpoint not available: ${path}`);
        return null; // Return null instead of throwing for missing endpoints
      }
      
      throw new Error(`Blockfrost API error: ${response.status} ${errorMessage}`);
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Blockfrost API error: ${response.status} ${errorData.message || errorData.error || response.statusText}`);
  }

  return response.json();
}

// Re-export for convenience
export { blockfrostProvider as default };

