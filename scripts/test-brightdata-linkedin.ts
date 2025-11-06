import dotenv from 'dotenv';
import path from 'path';
import { checkBrightDataLinkedIn } from '../lib/services/company-monitoring';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testBrightDataLinkedIn() {
  console.log('🧪 Testing Bright Data LinkedIn Discover API\n');
  console.log('='.repeat(60));

  const company = {
    id: 'test-company-id',
    name: 'OpenRouter',
    linkedin_url: 'https://www.linkedin.com/company/openrouter/',
  };

  const apiKey = process.env.BRIGHTDATA_API_KEY;

  if (!apiKey) {
    console.error('❌ BRIGHTDATA_API_KEY not found in .env.local');
    return;
  }

  console.log(`\n📊 Testing with company: ${company.name}`);
  console.log(`   LinkedIn URL: ${company.linkedin_url}`);
  console.log(`   Dataset ID: ${process.env.BRIGHTDATA_LINKEDIN_POSTS_DATASET_ID || 'gd_lyy3tktm25m4avu764'}\n`);

  console.log('⏳ Submitting scrape request (this may take 1-2 minutes)...\n');

  try {
    const events = await checkBrightDataLinkedIn(company, apiKey);

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ Test completed!\n`);
    console.log(`📈 Results:`);
    console.log(`   Events found: ${events.length}`);

    if (events.length > 0) {
      console.log(`\n📋 Sample events:\n`);
      events.slice(0, 5).forEach((event, i) => {
        console.log(`   ${i + 1}. [${event.event_category}] ${event.title}`);
        console.log(`      URL: ${event.source_url}`);
        console.log(`      Date: ${new Date(event.detected_at).toLocaleString()}`);
        if (event.description) {
          console.log(`      Preview: ${event.description.substring(0, 100)}...`);
        }
        console.log('');
      });
    } else {
      console.log(`\n   ℹ️  No events detected (this could mean:`);
      console.log(`      - No new posts found`);
      console.log(`      - Snapshot still processing`);
      console.log(`      - Posts already exist in database (deduplication)`);
    }
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testBrightDataLinkedIn();

