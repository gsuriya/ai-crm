import { NextRequest, NextResponse } from 'next/server';
import { hybridSearch, semanticSearch, SearchOptions } from '@/lib/semantic-search';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, filters, limit, threshold } = body as SearchOptions;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log('Hybrid search API called with:', { query, threshold: threshold || 0.3 });
    
    // Use hybrid search which combines semantic and text search
    const results = await hybridSearch({
      query,
      filters: filters || {},
      limit: limit || 50,
      threshold: threshold || 0.25, // Lower threshold for better results
    });

    console.log('Hybrid search returned', results.length, 'results');
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    );
  }

  try {
    const results = await hybridSearch({
      query,
      limit: 50,
      threshold: 0.3,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

