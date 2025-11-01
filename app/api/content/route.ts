import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, content_type, content, source, metadata } = body;

    if (!company_id || !content_type || !content) {
      return NextResponse.json(
        { error: 'company_id, content_type, and content are required' },
        { status: 400 }
      );
    }

    // Generate embedding for the content
    const { embedding } = await generateEmbedding(content);

    // Insert into company_content
    const { data, error } = await supabase
      .from('company_content')
      .insert({
        company_id,
        content_type,
        content,
        source,
        metadata: metadata || {},
        embedding: `[${embedding.join(',')}]`,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting content:', error);
      return NextResponse.json(
        { error: 'Failed to insert content' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in content API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, content, metadata } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (content) {
      updateData.content = content;
      // Regenerate embedding if content changed
      const { embedding } = await generateEmbedding(content);
      updateData.embedding = `[${embedding.join(',')}]`;
    }
    if (metadata) {
      updateData.metadata = metadata;
    }

    const { data, error } = await supabase
      .from('company_content')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating content:', error);
      return NextResponse.json(
        { error: 'Failed to update content' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in content API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('company_content')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting content:', error);
      return NextResponse.json(
        { error: 'Failed to delete content' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in content API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

