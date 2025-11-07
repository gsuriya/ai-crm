import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { monitorCompanyWithPuppeteer } from '@/lib/services/company-monitoring-puppeteer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: 'companyId is required' },
        { status: 400 }
      );
    }

    // Get company data
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, website, linkedin_url, twitter_handle')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    console.log(`[Comprehensive Monitoring] Starting for ${company.name}`);

    // Run comprehensive monitoring
    const results = await monitorCompanyWithPuppeteer(company);

    // Save filtered events to database
    const savedEvents = [];
    for (const event of results.filteredEvents) {
      const { data, error } = await supabase
        .from('company_events')
        .insert({
          company_id: company.id,
          event_type: 'brightdata_linkedin', // Reusing type
          event_category: mapCategoryToEventCategory(event.category),
          title: event.title,
          description: event.description,
          source_url: event.source_url,
          metadata: {
            ...event.metadata,
            source_type: event.source_type,
            monitoring_method: 'puppeteer_comprehensive',
          },
          detected_at: event.detected_at,
        })
        .select()
        .single();

      if (!error && data) {
        savedEvents.push(data);
      }
    }

    return NextResponse.json({
      success: true,
      company: company.name,
      stats: {
        websiteNews: results.websiteNews.length,
        jobPostings: results.jobPostings.length,
        linkedinPosts: results.linkedinPosts.length,
        twitterPosts: results.twitterPosts.length,
        newsArticles: results.newsArticles.length,
        filteredEvents: results.filteredEvents.length,
        savedEvents: savedEvents.length,
      },
      events: savedEvents,
    });
  } catch (error: any) {
    console.error('[Comprehensive Monitoring] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

function mapCategoryToEventCategory(category: string): string {
  const mapping: Record<string, string> = {
    product_release: 'new_content',
    revenue_growth: 'funding',
    hiring: 'job_posting',
    funding: 'funding',
    customer_win: 'other',
    positive_news: 'news_article',
    other: 'other',
  };
  return mapping[category] || 'other';
}

