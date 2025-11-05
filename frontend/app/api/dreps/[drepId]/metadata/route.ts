import { NextResponse } from 'next/server';

export const revalidate = 60;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ drepId: string }> }
) {
  try {
    const { drepId } = await params;
    
    const response = await fetch(`${BACKEND_URL}/api/dreps/${encodeURIComponent(drepId)}/metadata`, {
      next: { revalidate: 60 },
    });
    
    if (response.status === 404) {
      return NextResponse.json(null, { status: 200 });
    }
    
    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching DRep metadata:', error);
    return NextResponse.json(null, { status: 200 }); // Return null if metadata not available
  }
}

