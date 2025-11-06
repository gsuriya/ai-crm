import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testConnectivity() {
  console.log('🔌 Testing Bright Data API Connectivity\n');
  console.log('='.repeat(60));

  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const datasetId = process.env.BRIGHTDATA_LINKEDIN_POSTS_DATASET_ID || 'gd_lyy3tktm25m4avu764';

  if (!apiKey) {
    console.error('❌ BRIGHTDATA_API_KEY not found in .env.local');
    return;
  }

  console.log(`\n📋 Configuration:`);
  console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`   Dataset ID: ${datasetId}\n`);

  // Test 1: Simple scrape submission (just to verify auth works)
  console.log('1️⃣ Testing API authentication with scrape submission...\n');
  
  try {
    const response = await fetch(
      `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}&notify=false&include_errors=true&type=discover_new&discover_by=company_url`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [{
            url: 'https://www.linkedin.com/company/openrouter/',
          }],
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Connection Successful!');
      console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
      
      if (data.snapshot_id) {
        console.log(`   ✅ Snapshot ID received: ${data.snapshot_id}`);
        console.log(`   ✅ API is working correctly\n`);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ API Connection Failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${errorText}\n`);
    }
  } catch (error: any) {
    console.error('❌ Connection Error:', error.message);
  }

  console.log('='.repeat(60));
}

testConnectivity();

