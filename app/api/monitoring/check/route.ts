import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { monitorCompany, Company } from '@/lib/services/company-monitoring';

/**
 * Daily monitoring check endpoint
 * Can be called by cron job or manually
 * Defaults to OpenRouter company if no companyId provided
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret token (for automated cron jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;

    // If not a cron request, require user authentication
    if (!isCronRequest) {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const supabase = await createServerSupabaseClient();

    // Get companyId from query params or default to OpenRouter
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    let company: Company | null = null;

    if (companyId) {
      // Fetch specific company
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, website, linkedin_url, twitter_handle')
        .eq('id', companyId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        );
      }

      company = {
        id: data.id,
        name: data.name,
        website: data.website || undefined,
        linkedin_url: data.linkedin_url || undefined,
      };
    } else {
      // Default to OpenRouter company (case-insensitive)
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, website, linkedin_url, twitter_handle')
        .ilike('name', 'OpenRouter')
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { error: 'OpenRouter company not found in database' },
          { status: 404 }
        );
      }

      company = {
        id: data.id,
        name: data.name,
        website: data.website || undefined,
        linkedin_url: data.linkedin_url || undefined,
      };
    }

    console.log(`[Monitoring] Checking company: ${company.name} (${company.id})`);

    // Get API keys from environment variables
    const apiKeys = {
      apify: process.env.APIFY_API_KEY,
      brightdata: process.env.BRIGHTDATA_API_KEY,
      diffbot: process.env.DIFFBOT_API_KEY,
    };

    // Check if at least one API key is provided
    if (!apiKeys.apify && !apiKeys.brightdata && !apiKeys.diffbot) {
      return NextResponse.json(
        { error: 'No API keys configured. Please set APIFY_API_KEY, BRIGHTDATA_API_KEY, or DIFFBOT_API_KEY in environment variables.' },
        { status: 400 }
      );
    }

    // Run monitoring
    const result = await monitorCompany(supabase, company, apiKeys);

    return NextResponse.json({
      success: true,
      company: {
        id: company.id,
        name: company.name,
      },
      eventsFound: result.eventsFound,
      eventsSaved: result.eventsSaved,
    });
  } catch (error: any) {
    console.error('[Monitoring] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run monitoring check' },
      { status: 500 }
    );
  }
}

