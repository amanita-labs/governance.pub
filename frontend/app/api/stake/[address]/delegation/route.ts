import { NextRequest, NextResponse } from 'next/server';

/**
 * Get the DRep delegation target for a stake address
 * 
 * This endpoint queries the blockchain to find which DRep (if any) 
 * a stake address has delegated their voting power to.
 * 
 * @route GET /api/stake/:address/delegation
 * @param address - Stake address (stake1...)
 * @returns DRep ID that the stake address is delegated to, or null
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  try {
    const { address: stakeAddress } = await context.params;

    // Validate stake address format
    if (!stakeAddress || !stakeAddress.startsWith('stake')) {
      return NextResponse.json(
        { error: 'Invalid stake address format' },
        { status: 400 }
      );
    }

    // Query backend API for delegation info
        // Align with other API routes: prefer NEXT_PUBLIC_BACKEND_URL, then BACKEND_URL, then localhost
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:8080';
    const response = await fetch(`${backendUrl}/api/stake/${stakeAddress}/delegation`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        stake_address: data.stake_address,
        drep_id: data.delegated_drep || null,
        delegated: !!data.delegated_drep,
        pool_id: data.delegated_pool || null,
        total_balance: data.total_balance || null,
        utxo_balance: data.utxo_balance || null,
        rewards_available: data.rewards_available || null,
      });
    } else if (response.status === 404) {
      // Stake address not found or has no delegation
      return NextResponse.json({
        stake_address: stakeAddress,
        drep_id: null,
        delegated: false,
        pool_id: null,
        total_balance: null,
        utxo_balance: null,
        rewards_available: null,
      });
    } else {
      const errorText = await response.text();
      return NextResponse.json(
        { 
          error: 'Failed to query delegation from backend',
          status: response.status,
        },
        { status: response.status }
      );
    }

  } catch (error) {
    console.error('Error querying stake address delegation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to query delegation status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
