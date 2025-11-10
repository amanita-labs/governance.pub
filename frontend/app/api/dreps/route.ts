import { NextRequest, NextResponse } from 'next/server';

// Mark this route as dynamic since it uses request parameters
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryParams = new URLSearchParams(searchParams);

    if (!queryParams.has('page')) {
      queryParams.set('page', '1');
    }

    if (!queryParams.has('count') && !queryParams.has('pageSize')) {
      queryParams.set('count', '20');
    }

    // Don't pass status filters from the client unless explicitly chosen; backend now defaults to active+inactive
    const response = await fetch(`${BACKEND_URL}/api/dreps?${queryParams.toString()}`, {
      next: { revalidate: 60 },
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching DReps:', error);
    return NextResponse.json({ error: 'Failed to fetch DReps' }, { status: 500 });
  }
}
