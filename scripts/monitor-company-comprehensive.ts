import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { monitorCompanyWithPuppeteer } from '../lib/services/company-monitoring-puppeteer';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function monitorCompany() {
  const companyName = process.argv[2] || 'OpenRouter';
  
  console.log(`\n🔍 Comprehensive Company Monitoring`);
  console.log(`📊 Company: ${companyName}\n`);
  console.log('='.repeat(60));

  // Find company
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, website, linkedin_url, twitter_handle')
    .ilike('name', `%${companyName}%`)
    .limit(1);

  if (error || !companies || companies.length === 0) {
    console.error('❌ Company not found');
    process.exit(1);
  }

  const company = companies[0];
  console.log(`\n✅ Found: ${company.name}`);
  console.log(`   Website: ${company.website || 'N/A'}`);
  console.log(`   LinkedIn: ${company.linkedin_url || 'N/A'}`);
  console.log(`   Twitter: ${company.twitter_handle || 'N/A'}\n`);

  try {
    const results = await monitorCompanyWithPuppeteer(company);

    console.log('\n📊 Monitoring Results:');
    console.log(`   Website News: ${results.websiteNews.length} items`);
    console.log(`   Job Postings: ${results.jobPostings.length} items`);
    console.log(`   LinkedIn Posts: ${results.linkedinPosts.length} items`);
    console.log(`   Twitter Posts: ${results.twitterPosts.length} items`);
    console.log(`   News Articles: ${results.newsArticles.length} items`);
    console.log(`\n✅ Filtered Events: ${results.filteredEvents.length}`);

    if (results.filteredEvents.length > 0) {
      console.log('\n🎯 Relevant Events Found:\n');
      results.filteredEvents.forEach((event, i) => {
        console.log(`${i + 1}. [${event.category.toUpperCase()}] ${event.title}`);
        console.log(`   ${event.description}`);
        console.log(`   Source: ${event.source_type} - ${event.source_url}`);
        console.log('');
      });

      // Save events to database
      console.log('💾 Saving events to database...\n');
      for (const event of results.filteredEvents) {
        const { error: insertError } = await supabase
          .from('company_events')
          .insert({
            company_id: company.id,
            event_type: 'brightdata_linkedin', // Reusing this type for now
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
          });

        if (insertError) {
          console.error(`❌ Error saving event: ${insertError.message}`);
        } else {
          console.log(`✅ Saved: ${event.title}`);
        }
      }
    } else {
      console.log('\n   ℹ️  No highly relevant events found');
      console.log('   (This is normal - we only flag significant business events)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Monitoring complete!\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
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

monitorCompany().catch(console.error);

