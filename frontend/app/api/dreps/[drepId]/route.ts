import { NextResponse } from 'next/server';

export const revalidate = 60;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ drepId: string }> }
) {
  try {
    const { drepId } = await params;
    
    const response = await fetch(`${BACKEND_URL}/api/dreps/${encodeURIComponent(drepId)}`, {
      next: { revalidate: 60 },
    });
    
    if (response.status === 404) {
      return NextResponse.json(null, { status: 404 });
    }
    
    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }
    
    const data = await response.json();
    // Backend returns Option<DRep>, which could be null if not found
    if (!data || data === null) {
      return NextResponse.json(null, { status: 404 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching DRep:', error);
    return NextResponse.json({ error: 'Failed to fetch DRep' }, { status: 500 });
  }
}

