import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createCalendarEvent } from '@/lib/services/calendar';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to_email, title, description, duration, company_id, cadence_id, user_id, start_time } = body;

    // Validate required fields
    if (!to_email || !title || !description || !company_id || !user_id) {
      return NextResponse.json(
        { error: 'to_email, title, description, company_id, and user_id are required' },
        { status: 400 }
      );
    }

    // Get user session to verify authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use user_id from request or authenticated user
    const senderUserId = user_id || user.id;

    // Default duration is 30 minutes if not provided
    const durationMinutes = duration || 30;

    // Create calendar event
    const { eventId } = await createCalendarEvent(senderUserId, {
      toEmail: to_email,
      title,
      description,
      durationMinutes,
      startTime: start_time ? new Date(start_time) : undefined,
    });

    // Log calendar invite to company_content table
    const { data: contentLog, error: logError } = await supabase
      .from('company_content')
      .insert({
        company_id,
        content_type: 'outreach_log',
        content: `Calendar invite sent: ${title}`,
        source: 'CRM Cadence',
        metadata: {
          cadence_id: cadence_id || null,
          calendar_event_id: eventId,
          event_title: title,
          event_description: description,
          duration_minutes: durationMinutes,
          attendee_email: to_email,
        },
      })
      .select()
      .single();

    if (logError) {
      console.error('Error logging calendar invite:', logError);
      // Still return success since invite was sent
    }

    return NextResponse.json({
      success: true,
      eventId,
      contentLog,
    });
  } catch (error: any) {
    console.error('Error sending calendar invite:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send calendar invite' },
      { status: 500 }
    );
  }
}

