import { google } from 'googleapis';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get authenticated Google Calendar client using OAuth tokens from user_sessions table
 * Uses the EXACT same approach as sourcing/backend/server.js - NO token refresh, just set credentials
 */
export async function getCalendarClient(userId: string, supabaseClient?: SupabaseClient): Promise<typeof google.calendar> {
  const db = supabaseClient || await createServerSupabaseClient();
  
  // Get user session with OAuth tokens
  const { data: session, error } = await db
    .from('user_sessions')
    .select('access_token, refresh_token, token_expires_at, scope')
    .eq('user_id', userId)
    .single();

  if (error || !session) {
    throw new Error(`Failed to get user session: ${error?.message || 'Session not found'}`);
  }

  if (!session.access_token) {
    throw new Error('No access token found. Please authenticate with Google.');
  }

  // Create OAuth2 client - exactly like sourcing directory
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/google-callback`
  );

  // Set credentials directly - NO refresh call (like sourcing directory)
  oauth2Client.setCredentials({
    access_token: session.access_token,
    refresh_token: session.refresh_token || undefined,
  });

  // Google OAuth2 client will automatically refresh if token expires
  // Don't manually refresh - let Google handle it
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Find next available time slot within business hours
 */
export async function findAvailableSlot(
  userId: string,
  durationMinutes: number,
  startDate?: Date,
  timeConstraint?: 'none' | 'business_hours',
  supabaseClient?: SupabaseClient
): Promise<Date> {
  const calendar = await getCalendarClient(userId, supabaseClient);
  
  // Default start date: now or provided date
  const searchStart = startDate || new Date();
  const searchEnd = new Date(searchStart);
  searchEnd.setDate(searchEnd.getDate() + 14); // Search next 14 days

  // Get busy times
  const freeBusyResponse = await calendar.freebusy.query({
    requestBody: {
      timeMin: searchStart.toISOString(),
      timeMax: searchEnd.toISOString(),
      items: [{ id: 'primary' }],
    },
  });

  const busyTimes = freeBusyResponse.data.calendars?.primary?.busy || [];
  
  // Convert busy times to ranges
  const busyRanges = busyTimes.map((busy: any) => ({
    start: new Date(busy.start),
    end: new Date(busy.end),
  }));

  // Generate candidate slots
  const current = new Date(searchStart);
  const slots: Date[] = [];
  
  // Ensure we start at least 1 hour from now
  if (current.getTime() < Date.now() + 60 * 60 * 1000) {
    current.setTime(Date.now() + 60 * 60 * 1000);
  }

  while (current < searchEnd && slots.length === 0) {
    // Skip weekends if business hours
    if (timeConstraint === 'business_hours') {
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
        continue;
      }
    }

    // Check business hours constraint
    if (timeConstraint === 'business_hours') {
      const hour = current.getHours();
      if (hour < 9) {
        current.setHours(9, 0, 0, 0);
        continue;
      }
      if (hour >= 17) {
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
        continue;
      }
      // Ensure end time is within business hours
      const endTime = new Date(current.getTime() + durationMinutes * 60 * 1000);
      if (endTime.getHours() > 17 || (endTime.getHours() === 17 && endTime.getMinutes() > 0)) {
        current.setDate(current.getDate() + 1);
        current.setHours(9, 0, 0, 0);
        continue;
      }
    }

    // Check if slot conflicts with busy times
    const slotEnd = new Date(current.getTime() + durationMinutes * 60 * 1000);
    const hasConflict = busyRanges.some(
      (busy) => (current < busy.end && slotEnd > busy.start)
    );

    if (!hasConflict) {
      slots.push(new Date(current));
    } else {
      // Move to next 30-minute slot
      current.setMinutes(current.getMinutes() + 30);
      if (current.getMinutes() === 0) {
        current.setHours(current.getHours() + 1);
      }
    }
  }

  // Return first available slot, or default to 1 hour from now
  return slots[0] || new Date(Date.now() + 60 * 60 * 1000);
}

/**
 * Create calendar event and send invite
 */
export interface CreateCalendarEventParams {
  toEmail: string;
  title: string;
  description: string;
  durationMinutes: number;
  startTime?: Date; // Optional, defaults to 1 hour from now or next available slot
  timeConstraint?: 'none' | 'business_hours'; // Time constraints
  checkAvailability?: boolean; // Whether to check availability
}

export async function createCalendarEvent(
  userId: string,
  params: CreateCalendarEventParams,
  supabaseClient?: SupabaseClient
): Promise<{ eventId: string }> {
  // Get calendar client - exactly like sourcing directory
  const calendar = await getCalendarClient(userId, supabaseClient);

  // Determine start time
  let startTime: Date;
  
  if (params.startTime) {
    // Use provided start time
    startTime = params.startTime;
    
    // Apply business hours constraint if needed
    if (params.timeConstraint === 'business_hours') {
      const hour = startTime.getHours();
      const dayOfWeek = startTime.getDay();
      
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Move to next Monday at 9am
        const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
        startTime.setDate(startTime.getDate() + daysUntilMonday);
        startTime.setHours(9, 0, 0, 0);
      }
      
      // Ensure within 9am-5pm
      if (hour < 9) {
        startTime.setHours(9, 0, 0, 0);
      } else if (hour >= 17) {
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(9, 0, 0, 0);
      }
      
      // Ensure end time is within business hours
      const endTime = new Date(startTime.getTime() + params.durationMinutes * 60 * 1000);
      if (endTime.getHours() > 17 || (endTime.getHours() === 17 && endTime.getMinutes() > 0)) {
        // Move to next day at 9am
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(9, 0, 0, 0);
      }
    }
  } else if (params.checkAvailability && params.timeConstraint) {
    // Find next available slot
    startTime = await findAvailableSlot(userId, params.durationMinutes, undefined, params.timeConstraint, supabaseClient);
  } else {
    // Default: schedule immediately (delay block already handled the delay)
    startTime = new Date();
    
    // Apply business hours if needed
    if (params.timeConstraint === 'business_hours') {
      const hour = startTime.getHours();
      const dayOfWeek = startTime.getDay();
      
      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
        startTime.setDate(startTime.getDate() + daysUntilMonday);
        startTime.setHours(9, 0, 0, 0);
      } else if (hour < 9) {
        startTime.setHours(9, 0, 0, 0);
      } else if (hour >= 17) {
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(9, 0, 0, 0);
      }
      
      // Ensure end time is within business hours
      const endTime = new Date(startTime.getTime() + params.durationMinutes * 60 * 1000);
      if (endTime.getHours() > 17 || (endTime.getHours() === 17 && endTime.getMinutes() > 0)) {
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(9, 0, 0, 0);
      }
    }
  }
  
  const endTime = new Date(startTime.getTime() + params.durationMinutes * 60 * 1000);

  // Create event - exactly like sourcing directory
  const event = {
    summary: params.title,
    description: params.description,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'America/New_York',
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'America/New_York',
    },
    attendees: [
      { email: params.toEmail },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 15 }, // 15 minutes before
      ],
    },
  };

  // Insert event - exactly like sourcing directory (use resource, not requestBody)
  // Sourcing directory does NOT have try/catch - just direct call
  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    sendUpdates: 'all', // Send invites to all attendees
  });

  return {
    eventId: response.data.id || '',
  };
}

