import dotenv from 'dotenv';
import path from 'path';
import { monitorCompanyWithPuppeteer } from '../lib/services/company-monitoring-puppeteer';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testNewsScraping() {
  const companyName = process.argv[2] || 'OpenRouter';
  
  // Set environment variable to keep browser open
  process.env.KEEP_BROWSER_OPEN = 'true';
  
  console.log(`\n🔍 Testing News Scraping`);
  console.log(`📊 Company: ${companyName}\n`);
  console.log('='.repeat(60));

  // Create a mock company object for testing
  const testCompany = {
    id: 'test-id',
    name: companyName,
    website: undefined, // Skip website for this test
    linkedin_url: undefined, // Skip LinkedIn for this test
    twitter_handle: undefined, // Skip Twitter for this test
  };

  try {
    console.log('🚀 Starting news scraping test...\n');
    console.log('📰 This will:');
    console.log('   1. Search Google for recent news about the company');
    console.log('   2. Visit each article URL');
    console.log('   3. Extract full article content');
    console.log('   4. Show you what was found\n');
    
    // We'll call the monitoring function but only use the news part
    const results = await monitorCompanyWithPuppeteer(testCompany);

    console.log('\n' + '='.repeat(60));
    console.log('📊 NEWS SCRAPING RESULTS:\n');
    console.log(`   ✅ Found ${results.newsArticles.length} news articles\n`);

    if (results.newsArticles.length > 0) {
      console.log('📰 Articles Found:\n');
      results.newsArticles.forEach((article, i) => {
        console.log(`${i + 1}. ${article.title || 'Untitled'}`);
        console.log(`   URL: ${article.url || 'N/A'}`);
        console.log(`   Date: ${article.date || 'N/A'}`);
        console.log(`   Preview: ${(article.text || '').substring(0, 200)}...`);
        console.log('');
      });

      console.log('\n' + '='.repeat(60));
      console.log('✅ Filtered Events (GPT Analysis):\n');
      
      if (results.filteredEvents.length > 0) {
        results.filteredEvents.forEach((event, i) => {
          console.log(`${i + 1}. [${event.category.toUpperCase()}] ${event.title}`);
          console.log(`   ${event.description}`);
          console.log(`   Source: ${event.source_type} - ${event.source_url}`);
          console.log('');
        });
      } else {
        console.log('   ℹ️  No highly relevant events found');
        console.log('   (This is normal - we only flag significant business events)');
      }
    } else {
      console.log('   ⚠️  No news articles found');
      console.log('   This could mean:');
      console.log('   - No recent news about this company');
      console.log('   - Google search didn\'t return results');
      console.log('   - Articles couldn\'t be accessed');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Complete!\n');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testNewsScraping().catch(console.error);

