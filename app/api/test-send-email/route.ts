import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/services/gmail';

/**
 * Simple test endpoint that tries to send an email and returns detailed debug info
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const debugInfo: any = {
      userId: user.id,
      userEmail: user.email,
      step: 'starting',
    };

    try {
      debugInfo.step = 'calling sendEmail';
      const result = await sendEmail(user.id, {
        to: 'sg.suriya.v@gmail.com',
        subject: 'yo',
        body: 'Test email',
      }, supabase);
      
      debugInfo.step = 'success';
      debugInfo.result = result;
      
      return NextResponse.json({
        success: true,
        debugInfo,
        message: 'Email sent successfully!',
      });
    } catch (error: any) {
      debugInfo.step = 'error';
      debugInfo.error = {
        message: error.message,
        code: error.code,
        stack: error.stack,
      };
      
      return NextResponse.json({
        success: false,
        debugInfo,
        error: error.message,
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

