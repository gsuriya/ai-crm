import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/services/gmail';
import { createCalendarEvent } from '@/lib/services/calendar';
import { sendVoicemail } from '@/lib/services/vapi';
import { createServerSupabaseClient } from '@/lib/supabase-server';

/**
 * Complete API Test Endpoint
 * Tests Gmail, Calendar, and VAPI APIs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { test_type } = body;

    // Create Supabase client with server-side auth
    const supabase = await createServerSupabaseClient();

    // Get user session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - please sign in first' }, { status: 401 });
    }

    const results: any = {};

    // Test Gmail API
    if (!test_type || test_type === 'gmail') {
      try {
        const emailResult = await sendEmail(user.id, {
          to: 'sg.suriya.v@gmail.com',
          subject: 'API Test - Gmail API Working!',
          body: `
            <h2>✅ Gmail API Test Successful!</h2>
            <p>This email was sent using the Gmail API to verify everything is working.</p>
            <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
            <p><strong>From:</strong> ${user.email}</p>
            <p><strong>Test Type:</strong> Direct API call (not workflow)</p>
            <hr>
            <p style="color: #666; font-size: 12px;">If you received this, the Gmail API integration is working correctly! 🎉</p>
          `,
        }, supabase);
        results.gmail = { success: true, ...emailResult };
      } catch (error: any) {
        results.gmail = { success: false, error: error.message };
      }
    }

    // Test Calendar API
    if (!test_type || test_type === 'calendar') {
      try {
        const startTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
        const calendarResult = await createCalendarEvent(user.id, {
          toEmail: 'sg.suriya.v@gmail.com',
          title: 'API Test - Calendar Invite',
          description: `This is a test calendar invite from the CRM API test suite.
          
If you received this, the Calendar API integration is working correctly! 🎉

Test Details:
- Sent at: ${new Date().toISOString()}
- Test Type: Direct API call (not workflow)
- Duration: 30 minutes
- Start Time: ${startTime.toLocaleString()}`,
          durationMinutes: 30,
          startTime: startTime,
        });
        results.calendar = { success: true, ...calendarResult };
      } catch (error: any) {
        results.calendar = { success: false, error: error.message };
      }
    }

    // Test VAPI
    if (!test_type || test_type === 'vapi') {
      try {
        const vapiResult = await sendVoicemail({
          phoneNumber: '+19255772134',
          script: 'Hello! This is a test voicemail from the CRM API test suite. If you receive this call, VAPI is working correctly! This is just a test to verify the phone number integration. Thank you!',
          companyId: '00000000-0000-0000-0000-000000000000', // Dummy ID for test
        });
        results.vapi = { success: true, ...vapiResult };
      } catch (error: any) {
        results.vapi = { success: false, error: error.message };
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Test failed' },
      { status: 500 }
    );
  }
}

