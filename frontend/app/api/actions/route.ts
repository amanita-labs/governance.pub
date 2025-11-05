import { NextResponse } from 'next/server';

export const revalidate = 60;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const count = searchParams.get('count') || '20';
    const enrich = searchParams.get('enrich') || '';
    
    const queryParams = new URLSearchParams({
      page,
      count,
      ...(enrich && { enrich }),
    });
    
    const response = await fetch(`${BACKEND_URL}/api/actions?${queryParams}`, {
      next: { revalidate: 60 },
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching governance actions:', error);
    return NextResponse.json({ error: 'Failed to fetch governance actions' }, { status: 500 });
  }
}

