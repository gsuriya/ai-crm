import { NextRequest, NextResponse } from 'next/server';
import { sendLinkedInMessage } from '@/lib/services/phantombuster';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { linkedinProfileUrl, message } = body;

    if (!linkedinProfileUrl) {
      return NextResponse.json(
        { error: 'LinkedIn profile URL is required' },
        { status: 400 }
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Validate LinkedIn URL format
    if (!linkedinProfileUrl.includes('linkedin.com')) {
      return NextResponse.json(
        { error: 'Invalid LinkedIn profile URL' },
        { status: 400 }
      );
    }

    const result = await sendLinkedInMessage({
      linkedinProfileUrl,
      message,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send LinkedIn message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      containerId: result.containerId,
      output: result.output,
    });
  } catch (error: any) {
    console.error('Error sending LinkedIn message:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

