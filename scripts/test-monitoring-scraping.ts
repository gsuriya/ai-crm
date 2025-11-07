import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { monitorCompanyWithPuppeteer } from '../lib/services/company-monitoring-puppeteer';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function testMonitoring() {
  const companyName = process.argv[2] || 'OpenRouter';
  
  console.log(`\n🔍 Testing Comprehensive Company Monitoring`);
  console.log(`📊 Company: ${companyName}\n`);
  console.log('='.repeat(60));

  // Find company
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, website, linkedin_url')
    .ilike('name', `%${companyName}%`)
    .limit(1);

  if (error || !companies || companies.length === 0) {
    console.error('❌ Company not found');
    console.log('\n💡 Available companies in database:');
    const { data: allCompanies } = await supabase
      .from('companies')
      .select('name, website, linkedin_url, twitter_handle')
      .limit(10);
    
    if (allCompanies && allCompanies.length > 0) {
      allCompanies.forEach(c => {
        console.log(`   - ${c.name} (website: ${c.website || 'N/A'}, linkedin: ${c.linkedin_url || 'N/A'}, twitter: ${c.twitter_handle || 'N/A'})`);
      });
    }
    process.exit(1);
  }

  const company = companies[0];
  console.log(`\n✅ Found: ${company.name}`);
  console.log(`   Website: ${company.website || 'N/A'}`);
  console.log(`   LinkedIn: ${company.linkedin_url || 'N/A'}\n`);

  if (!company.website && !company.linkedin_url) {
    console.log('⚠️  Warning: Company has no website or LinkedIn URL. Limited data will be available.\n');
  }

  // Add twitter_handle if it doesn't exist (for compatibility)
  const companyWithTwitter = { ...company, twitter_handle: undefined };

  try {
    console.log('🚀 Starting monitoring...\n');
    const results = await monitorCompanyWithPuppeteer(companyWithTwitter);

    console.log('\n' + '='.repeat(60));
    console.log('📊 SCRAPING RESULTS:\n');
    console.log(`   ✅ Website News: ${results.websiteNews.length} items`);
    if (results.websiteNews.length > 0) {
      results.websiteNews.slice(0, 3).forEach((item, i) => {
        console.log(`      ${i + 1}. ${item.title || 'Untitled'}`);
        console.log(`         URL: ${item.url || 'N/A'}`);
        console.log(`         Preview: ${(item.text || '').substring(0, 100)}...`);
      });
    }

    console.log(`\n   ✅ Job Postings: ${results.jobPostings.length} items`);
    if (results.jobPostings.length > 0) {
      results.jobPostings.slice(0, 3).forEach((item, i) => {
        console.log(`      ${i + 1}. ${item.title || 'Untitled'}`);
        console.log(`         URL: ${item.url || 'N/A'}`);
        console.log(`         Location: ${item.location || 'N/A'}`);
      });
    }

    console.log(`\n   ✅ LinkedIn Posts: ${results.linkedinPosts.length} items`);
    if (results.linkedinPosts.length > 0) {
      results.linkedinPosts.slice(0, 3).forEach((item, i) => {
        console.log(`      ${i + 1}. ${(item.text || item.title || '').substring(0, 100)}...`);
        console.log(`         URL: ${item.url || 'N/A'}`);
        console.log(`         Date: ${item.date || 'N/A'}`);
      });
    }

    console.log(`\n   ✅ Twitter Posts: ${results.twitterPosts.length} items`);
    if (results.twitterPosts.length > 0) {
      results.twitterPosts.slice(0, 3).forEach((item, i) => {
        console.log(`      ${i + 1}. ${(item.text || item.title || '').substring(0, 100)}...`);
        console.log(`         URL: ${item.url || 'N/A'}`);
        console.log(`         Date: ${item.date || 'N/A'}`);
      });
    }

    console.log(`\n   ✅ News Articles: ${results.newsArticles.length} items`);
    if (results.newsArticles.length > 0) {
      results.newsArticles.slice(0, 3).forEach((item, i) => {
        console.log(`      ${i + 1}. ${item.title || 'Untitled'}`);
        console.log(`         URL: ${item.url || 'N/A'}`);
        console.log(`         Preview: ${(item.text || '').substring(0, 100)}...`);
      });
    }

    console.log(`\n   ✅ Filtered Events (GPT Analysis): ${results.filteredEvents.length} items`);
    if (results.filteredEvents.length > 0) {
      results.filteredEvents.forEach((event, i) => {
        console.log(`\n      ${i + 1}. [${event.category.toUpperCase()}] ${event.title}`);
        console.log(`         ${event.description}`);
        console.log(`         Source: ${event.source_type} - ${event.source_url}`);
      });
    } else {
      console.log(`      ℹ️  No highly relevant events found (this is normal - we only flag significant business events)`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Complete!\n');
    console.log(`📈 Summary:`);
    console.log(`   Total items scraped: ${results.websiteNews.length + results.jobPostings.length + results.linkedinPosts.length + results.twitterPosts.length + results.newsArticles.length}`);
    console.log(`   Relevant events flagged: ${results.filteredEvents.length}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testMonitoring().catch(console.error);

