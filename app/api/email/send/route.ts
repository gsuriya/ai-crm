import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/services/gmail-direct';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, to_email, subject, body: emailBody, thread_id, message_id, company_id, cadence_id, user_id } = body;

    // Support both 'to' and 'to_email' for simplicity
    const toEmail = to || to_email;

    // Validate required fields
    if (!toEmail || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'to (or to_email), subject, and body are required' },
        { status: 400 }
      );
    }

    // Create Supabase client with server-side auth
    const supabase = await createServerSupabaseClient();

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

    // Send email via Gmail API
    const { messageId, threadId, gmailMessageId } = await sendEmail(senderUserId, {
      to: toEmail,
      subject,
      body: emailBody,
      threadId: thread_id,
      messageId: message_id,
    }, supabase);

    // Log email to email_logs table (optional - only if company_id provided)
    if (company_id) {
      const { error: logError } = await supabase
        .from('email_logs')
        .insert({
          company_id,
          cadence_id: cadence_id || null,
          direction: 'sent',
          subject,
          body: emailBody,
          thread_id: threadId,
          message_id: messageId,
          from_email: user.email || '',
          to_email: toEmail,
          sent_at: new Date().toISOString(),
          metadata: {
            gmail_message_id: messageId,
            gmail_thread_id: threadId,
          },
        });

      if (logError) {
        console.error('Error logging email:', logError);
        // Still return success since email was sent
      }
    }

    return NextResponse.json({
      success: true,
      messageId,
      threadId,
      gmailMessageId,
    });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}

