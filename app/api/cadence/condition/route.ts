import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_id, condition_type, condition_value } = body;

    if (!company_id || !condition_type) {
      return NextResponse.json(
        { error: 'company_id and condition_type are required' },
        { status: 400 }
      );
    }

    // Get the most recent sent email for this company
    const { data: emails, error } = await supabase
      .from('email_logs')
      .select('*')
      .eq('company_id', company_id)
      .eq('direction', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to query email logs: ${error.message}`);
    }

    if (!emails || emails.length === 0) {
      // No emails sent yet, return false for all conditions
      return NextResponse.json({
        result: false,
        reason: 'No emails sent to this company',
      });
    }

    const latestEmail = emails[0];
    let result = false;
    let reason = '';

    switch (condition_type) {
      case 'email_opened':
        // Check if email was opened (has opened_at timestamp)
        result = !!latestEmail.opened_at;
        reason = result ? 'Email was opened' : 'Email was not opened';
        break;

      case 'email_not_opened':
        // Check if email was NOT opened
        result = !latestEmail.opened_at;
        reason = result ? 'Email was not opened' : 'Email was opened';
        break;

      case 'email_replied':
        // Check if email was replied to
        result = !!latestEmail.replied_at;
        reason = result ? 'Email was replied to' : 'Email was not replied to';
        break;

      case 'email_not_replied':
        // Check if email was NOT replied to
        result = !latestEmail.replied_at;
        reason = result ? 'Email was not replied to' : 'Email was replied to';
        break;

      case 'email_opened_within_days':
        // Check if email was opened within X days
        if (!condition_value) {
          return NextResponse.json(
            { error: 'condition_value (days) is required for email_opened_within_days' },
            { status: 400 }
          );
        }
        const days = parseInt(condition_value);
        if (latestEmail.opened_at) {
          const openedDate = new Date(latestEmail.opened_at);
          const now = new Date();
          const diffDays = (now.getTime() - openedDate.getTime()) / (1000 * 60 * 60 * 24);
          result = diffDays <= days;
          reason = result 
            ? `Email was opened within ${days} days` 
            : `Email was not opened within ${days} days`;
        } else {
          result = false;
          reason = 'Email was not opened';
        }
        break;

      case 'email_replied_within_days':
        // Check if email was replied to within X days
        if (!condition_value) {
          return NextResponse.json(
            { error: 'condition_value (days) is required for email_replied_within_days' },
            { status: 400 }
          );
        }
        const replyDays = parseInt(condition_value);
        if (latestEmail.replied_at) {
          const repliedDate = new Date(latestEmail.replied_at);
          const now = new Date();
          const diffDays = (now.getTime() - repliedDate.getTime()) / (1000 * 60 * 60 * 24);
          result = diffDays <= replyDays;
          reason = result 
            ? `Email was replied to within ${replyDays} days` 
            : `Email was not replied to within ${replyDays} days`;
        } else {
          result = false;
          reason = 'Email was not replied to';
        }
        break;

      default:
        return NextResponse.json(
          { error: `Unknown condition_type: ${condition_type}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      result,
      reason,
      email_id: latestEmail.id,
      email_sent_at: latestEmail.sent_at,
      email_opened_at: latestEmail.opened_at,
      email_replied_at: latestEmail.replied_at,
    });
  } catch (error: any) {
    console.error('Error evaluating condition:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to evaluate condition' },
      { status: 500 }
    );
  }
}

