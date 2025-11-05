import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { sendEmail } from '@/lib/services/gmail-direct';
import { 
  replaceBasicVariables, 
  hasPersonalizationVariable, 
  replacePersonalizationPlaceholder,
  generatePersonalization,
  VariableContext 
} from '@/lib/utils/email-variables';

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

    // Process email body placeholders if company_id is provided
    let processedBody = emailBody;
    let processedSubject = subject;

    if (company_id) {
      // Fetch company details
      const { data: company } = await supabase
        .from('companies')
        .select('name, description, website')
        .eq('id', company_id)
        .single();

      // Fetch contact information by email address
      // Use only first name for {name} placeholder
      let contactName: string | undefined;
      const { data: contact } = await supabase
        .from('contacts')
        .select('first_name, last_name')
        .eq('email', toEmail)
        .eq('company_id', company_id)
        .maybeSingle();

      if (contact?.first_name) {
        contactName = contact.first_name;
      }

      // Build variable context
      const variableContext: VariableContext = {
        contactName,
        companyName: company?.name,
        companyDescription: company?.description,
        companyWebsite: company?.website,
      };

      // Replace basic variables ({name}, {company}) in subject and body
      processedSubject = replaceBasicVariables(subject, variableContext);
      processedBody = replaceBasicVariables(emailBody, variableContext);

      // Handle {personalization} placeholder if present
      if (hasPersonalizationVariable(processedBody)) {
        const personalization = await generatePersonalization(
          processedBody,
          company?.name,
          company?.description,
          company?.website
        );
        processedBody = replacePersonalizationPlaceholder(processedBody, personalization);
      }
    }

    // Send email via Gmail API with processed body and subject
    const { messageId, threadId, gmailMessageId } = await sendEmail(senderUserId, {
      to: toEmail,
      subject: processedSubject,
      body: processedBody,
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
          subject: processedSubject,
          body: processedBody,
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

