import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { monitorCompany, checkApifyWebsite, checkBrightDataLinkedIn, checkDiffbotKnowledgeGraph } from '../lib/services/company-monitoring';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testMonitoring() {
  console.log('🔍 Testing Company Monitoring Service\n');
  console.log('=' .repeat(60));

  // Step 1: Find OpenRouter company
  console.log('\n1️⃣ Finding OpenRouter company...');
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, website, linkedin_url')
    .ilike('name', 'OpenRouter')
    .limit(1)
    .maybeSingle();

  if (companyError || !company) {
    console.error('❌ OpenRouter company not found!');
    console.error('Error:', companyError?.message);
    console.log('\n💡 Please ensure:');
    console.log('   - OpenRouter company exists in database');
    console.log('   - Company has website and linkedin_url fields populated');
    return;
  }

  console.log('✅ Found company:', {
    id: company.id,
    name: company.name,
    website: company.website || '❌ Missing',
    linkedin_url: company.linkedin_url || '❌ Missing',
  });

  const companyData = {
    id: company.id,
    name: company.name,
    website: company.website || undefined,
    linkedin_url: company.linkedin_url || undefined,
  };

  // Step 2: Test each API individually
  console.log('\n2️⃣ Testing individual APIs...\n');

  // Test Apify
  console.log('📊 Testing Apify API (Website monitoring)...');
  const apifyKey = process.env.APIFY_API_KEY;
  if (apifyKey) {
    try {
      const apifyEvents = await checkApifyWebsite(companyData, apifyKey);
      console.log(`   ✅ Apify: Found ${apifyEvents.length} events`);
      if (apifyEvents.length > 0) {
        apifyEvents.slice(0, 2).forEach((e, i) => {
          console.log(`      ${i + 1}. ${e.title}`);
        });
      } else {
        console.log('      ℹ️  No new content detected (this is normal for first run)');
      }
    } catch (error: any) {
      console.log(`   ❌ Apify Error: ${error.message}`);
    }
  } else {
    console.log('   ⚠️  APIFY_API_KEY not set');
  }

  // Test Bright Data LinkedIn
  console.log('\n📊 Testing Bright Data API (LinkedIn monitoring)...');
  const brightDataKey = process.env.BRIGHTDATA_API_KEY;
  if (brightDataKey) {
    try {
      const brightDataEvents = await checkBrightDataLinkedIn(companyData, brightDataKey);
      console.log(`   ✅ Bright Data LinkedIn: Found ${brightDataEvents.length} events`);
      if (brightDataEvents.length > 0) {
        brightDataEvents.slice(0, 2).forEach((e, i) => {
          console.log(`      ${i + 1}. ${e.title}`);
        });
      } else {
        console.log('      ℹ️  No LinkedIn changes detected (may need Customer ID/Zone config)');
      }
    } catch (error: any) {
      console.log(`   ❌ Bright Data Error: ${error.message}`);
      console.log('      💡 Note: May need BRIGHTDATA_CUSTOMER_ID and BRIGHTDATA_ZONE_NAME');
    }
  } else {
    console.log('   ⚠️  BRIGHTDATA_API_KEY not set');
  }

  // Test Diffbot
  console.log('\n📊 Testing Diffbot API (News monitoring)...');
  const diffbotKey = process.env.DIFFBOT_API_KEY;
  if (diffbotKey) {
    try {
      const diffbotEvents = await checkDiffbotKnowledgeGraph(companyData, diffbotKey);
      console.log(`   ✅ Diffbot: Found ${diffbotEvents.length} events`);
      if (diffbotEvents.length > 0) {
        diffbotEvents.slice(0, 3).forEach((e, i) => {
          console.log(`      ${i + 1}. ${e.title}`);
          if (e.description) {
            console.log(`         ${e.description.substring(0, 100)}...`);
          }
        });
      } else {
        console.log('      ℹ️  No recent news articles found');
      }
    } catch (error: any) {
      console.log(`   ❌ Diffbot Error: ${error.message}`);
    }
  } else {
    console.log('   ⚠️  DIFFBOT_API_KEY not set');
  }

  // Step 3: Run full monitoring check
  console.log('\n3️⃣ Running full monitoring check...\n');
  const apiKeys = {
    apify: process.env.APIFY_API_KEY,
    brightdata: process.env.BRIGHTDATA_API_KEY,
    diffbot: process.env.DIFFBOT_API_KEY,
  };

  try {
    const result = await monitorCompany(supabase, companyData, apiKeys);
    console.log('✅ Monitoring complete!');
    console.log(`   Events found: ${result.eventsFound}`);
    console.log(`   Events saved: ${result.eventsSaved}`);
  } catch (error: any) {
    console.log(`❌ Monitoring Error: ${error.message}`);
  }

  // Step 4: Check saved events
  console.log('\n4️⃣ Checking saved events...\n');
  const { data: events, error: eventsError } = await supabase
    .from('company_events')
    .select('*')
    .eq('company_id', company.id)
    .order('detected_at', { ascending: false })
    .limit(10);

  if (eventsError) {
    console.log('❌ Error fetching events:', eventsError.message);
  } else {
    console.log(`✅ Found ${events.length} total events in database`);
    if (events.length > 0) {
      console.log('\n📋 Recent events:');
      events.slice(0, 5).forEach((e, i) => {
        console.log(`\n   ${i + 1}. [${e.event_type}] ${e.title}`);
        console.log(`      Category: ${e.event_category}`);
        console.log(`      Date: ${new Date(e.detected_at).toLocaleString()}`);
        if (e.source_url) {
          console.log(`      Source: ${e.source_url}`);
        }
        if (e.is_new) {
          console.log(`      🆕 NEW`);
        }
      });
    }
  }

  // Step 5: Evaluate VC usefulness
  console.log('\n5️⃣ Evaluating VC Usefulness...\n');
  if (events && events.length > 0) {
    const usefulCategories = ['funding', 'employee_change', 'job_posting', 'news_article'];
    const usefulEvents = events.filter(e => usefulCategories.includes(e.event_category));
    
    console.log(`📈 Found ${usefulEvents.length} potentially useful events for VC:`);
    usefulEvents.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.title} (${e.event_category})`);
    });

    if (usefulEvents.length === 0) {
      console.log('   ⚠️  No high-signal events detected');
      console.log('   💡 Consider:');
      console.log('      - Adjusting detection thresholds');
      console.log('      - Adding more specific event categories');
      console.log('      - Improving parsing logic for each API');
    }
  } else {
    console.log('   ⚠️  No events detected yet');
    console.log('   💡 This is normal for first run - events will accumulate over time');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Testing complete!\n');
}

testMonitoring().catch(console.error);

