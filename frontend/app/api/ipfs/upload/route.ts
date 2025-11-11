import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import type { DRepMetadata } from '@/types/governance';

type IpfsProvider = 'pinata' | 'blockfrost';

interface UploadRequest {
  metadata: unknown;
  provider: IpfsProvider;
  apiKey: string;
}

function isDRepMetadata(value: unknown): value is DRepMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const metadata = value as Partial<DRepMetadata>;
  const body = metadata.body;

  if (!body || typeof body !== 'object') {
    return false;
  }

  return typeof (body as Record<string, unknown>).givenName === 'string';
}

/**
 * Upload metadata JSON to IPFS using Pinata or Blockfrost
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 [IPFS API] Received upload request');
    const payload = (await request.json()) as UploadRequest;
    const { metadata, provider, apiKey } = payload;

    console.log('📋 [IPFS API] Request details:', {
      provider,
      hasMetadata: !!metadata,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      metadataType: typeof metadata,
    });

    // Validate metadata has required fields
    if (!metadata || typeof metadata !== 'object') {
      console.error('❌ [IPFS API] Invalid metadata structure');
      return NextResponse.json(
        { error: 'Invalid metadata: must be a valid JSON object' },
        { status: 400 }
      );
    }

    const metadataObject = metadata as Record<string, unknown>;
    const metadataBody = metadataObject.body as Record<string, unknown> | undefined;

    // Support both DRep metadata (CIP-119) and Vote rationale (CIP-136)
    const isDRep = isDRepMetadata(metadata);
    const isVoteRationale =
      typeof metadataBody?.summary === 'string' && typeof metadataBody?.rationaleStatement === 'string';

    if (!isDRep && !isVoteRationale) {
      console.error('❌ [IPFS API] Invalid metadata structure');
      return NextResponse.json(
        { error: 'Invalid metadata: must be either DRep metadata (CIP-119) or Vote rationale (CIP-136)' },
        { status: 400 }
      );
    }

    // Validate provider and API key
    if (!provider || !apiKey) {
      console.error('❌ [IPFS API] Missing provider or API key');
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    // Calculate blake2b-256 hash of the metadata (minified for stable hashing)
    console.log('🔐 [IPFS API] Calculating blake2b-256 hash...');
    const metadataString = JSON.stringify(metadataObject);
    const hash = crypto
      .createHash('blake2b512')
      .update(metadataString)
      .digest('hex')
      .slice(0, 64); // blake2b-256 is 32 bytes = 64 hex characters
    console.log('✓ [IPFS API] Hash calculated:', hash.substring(0, 16) + '...');

    let ipfsHash: string;

    if (provider === 'pinata') {
      console.log('📤 [IPFS API] Using Pinata provider');
      ipfsHash = await uploadToPinata(metadata as DRepMetadata, apiKey);
    } else if (provider === 'blockfrost') {
      console.log('📤 [IPFS API] Using Blockfrost provider');
      ipfsHash = await uploadToBlockfrost(metadata as DRepMetadata, apiKey);
    } else {
      console.error('❌ [IPFS API] Invalid provider:', provider);
      return NextResponse.json(
        { error: 'Invalid provider. Choose pinata or blockfrost' },
        { status: 400 }
      );
    }

    console.log('✅ [IPFS API] Upload complete!');
    
    // Return IPFS URL with ipfs:// protocol
    const response = {
      url: `ipfs://${ipfsHash}`,
      hash: hash,
      cid: ipfsHash,
    };
    
    console.log('📦 [IPFS API] Response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('💥 [IPFS API] Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload to IPFS' },
      { status: 500 }
    );
  }
}

/**
 * Upload to Pinata using their API
 * Documentation: https://docs.pinata.cloud/frameworks/next-js
 */
async function uploadToPinata(metadata: DRepMetadata, jwt: string): Promise<string> {
  try {
    console.log('🔍 [Pinata] Starting upload process...');
    
    // Basic validation for JWT format to improve error feedback
    const isLikelyJwt = typeof jwt === 'string' && jwt.split('.').length === 3;
    if (!isLikelyJwt) {
      console.error('❌ [Pinata] Invalid JWT format. Expected 3 parts separated by dots.');
      throw new Error('Expected a Pinata JWT (Bearer token). Please provide a valid JWT from Pinata Developers > Keys.');
    }
    
    console.log('✓ [Pinata] JWT format validated');
    const metadataBody = metadata.body as Record<string, unknown> | undefined;
    const givenName =
      typeof metadataBody?.givenName === 'string' ? metadataBody.givenName : 'Unknown DRep';
    console.log('📝 [Pinata] Metadata preview:', {
      givenName,
      hasObjectives: Boolean(metadataBody?.objectives),
      hasMotivations: Boolean(metadataBody?.motivations),
      hasReferences: Array.isArray(metadataBody?.references) && metadataBody.references.length > 0,
    });

    // Use Pinata's JSON endpoint which works better with Node.js
    // Documentation: https://docs.pinata.cloud/api-reference/endpoint/pinJSONToIPFS
    const pinataContent = {
      pinataContent: metadata,
      pinataMetadata: {
        name: `DRep Metadata - ${givenName}`,
      },
    };
    
    const metadataJson = JSON.stringify(pinataContent);
    console.log(`📦 [Pinata] Prepared JSON payload: ${metadataJson.length} bytes`);
    console.log('📤 [Pinata] Sending request to Pinata API (pinJSONToIPFS)...');

    // Upload to Pinata using JSON endpoint
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: metadataJson,
    });

    console.log(`📥 [Pinata] Response status: ${response.status} ${response.statusText}`);
    console.log('📥 [Pinata] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      // Try to parse JSON; fallback to text
      let message = response.statusText;
      let errorDetails = null;
      
      try {
        const errorData = await response.json();
        console.error('❌ [Pinata] Full error response:', JSON.stringify(errorData, null, 2));
        errorDetails = errorData;
        message = errorData?.error?.message || errorData?.error?.details || errorData?.error || errorData?.message || message;
      } catch {
        try {
          const textError = await response.text();
          console.error('❌ [Pinata] Error text:', textError);
          message = textError || message;
        } catch {
          console.error('❌ [Pinata] Could not parse error response');
        }
      }
      
      // Provide specific guidance based on status code
      if (response.status === 401) {
        throw new Error(`Authentication failed: Invalid or expired Pinata JWT token. Please check your API key.`);
      } else if (response.status === 403) {
        // Check if it's a scope/permission issue
        if (errorDetails?.error?.reason === 'NO_SCOPES_FOUND' || message.includes('scopes') || message.includes('permission')) {
          throw new Error(`Permission denied: Your Pinata API key does not have the required permissions (scopes) to pin files. Please create a new API key with "pinFileToIPFS" and "pinJSONToIPFS" permissions enabled at https://app.pinata.cloud/developers/keys`);
        }
        throw new Error(`Access forbidden: Your Pinata API key may not have permission to pin files. Check key permissions in Pinata dashboard.`);
      } else if (response.status === 429) {
        throw new Error(`Rate limit exceeded: You've made too many requests. Please wait a moment and try again.`);
      } else if (response.status >= 500) {
        throw new Error(`Pinata server error (${response.status}): ${message}. Please try again in a moment.`);
      }
      
      throw new Error(`Pinata upload failed (${response.status}): ${message}`);
    }

    const data = await response.json();
    console.log('✅ [Pinata] Upload successful!');
    console.log('📍 [Pinata] IPFS Hash (CID):', data.IpfsHash);
    console.log('🔗 [Pinata] Gateway URL:', `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`);
    
    if (!data.IpfsHash) {
      console.error('❌ [Pinata] Response missing IpfsHash:', data);
      throw new Error('Pinata response missing IpfsHash field');
    }
    
    return data.IpfsHash; // CID

  } catch (error) {
    console.error('💥 [Pinata] Upload error:', error);
    throw new Error(`Pinata upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload to Blockfrost IPFS
 * Documentation: https://blockfrost.dev/start-building/ipfs/
 */
async function uploadToBlockfrost(metadata: DRepMetadata, projectId: string): Promise<string> {
  try {
    // Convert metadata to a Blob
    const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', blob, 'drep-metadata.json');

    // Upload to Blockfrost IPFS
    const response = await fetch('https://ipfs.blockfrost.io/api/v0/ipfs/add', {
      method: 'POST',
      headers: {
        'project_id': projectId,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Blockfrost upload failed: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    const ipfsHash = data.ipfs_hash; // CID

    // Pin the file immediately to prevent garbage collection
    const pinResponse = await fetch(`https://ipfs.blockfrost.io/api/v0/ipfs/pin/add/${ipfsHash}`, {
      method: 'POST',
      headers: {
        'project_id': projectId,
      },
    });

    if (!pinResponse.ok) {
      console.error('Warning: Failed to pin file on Blockfrost');
      // Continue anyway, file is uploaded
    }

    return ipfsHash; // CID

  } catch (error) {
    throw new Error(`Blockfrost upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
