import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testUrlDiscover() {
  console.log('🧪 Testing Bright Data LinkedIn URL Discover Mode\n');
  console.log('='.repeat(60));

  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const datasetId = process.env.BRIGHTDATA_LINKEDIN_POSTS_DATASET_ID || 'gd_lyy3tktm25m4avu764';
  const testUrl = 'https://www.linkedin.com/company/openrouter/posts/?feedView=all';

  if (!apiKey) {
    console.error('❌ BRIGHTDATA_API_KEY not found in .env.local');
    return;
  }

  console.log(`\n📋 Configuration:`);
  console.log(`   API Key: ${apiKey.substring(0, 20)}...`);
  console.log(`   Dataset ID: ${datasetId}`);
  console.log(`   Test URL: ${testUrl}`);
  console.log(`   Discover Mode: discover_by=url\n`);

  try {
    const scrapeUrl = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}&notify=false&include_errors=true&type=discover_new&discover_by=url`;
    
    console.log('⏳ Submitting scrape request...\n');
    
    const response = await fetch(scrapeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: [{
          url: testUrl,
          limit: 50
        }],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Scrape submitted successfully!');
      console.log(`   Response: ${JSON.stringify(data, null, 2)}\n`);
      
      if (data.snapshot_id) {
        const snapshotId = data.snapshot_id;
        console.log(`   📸 Snapshot ID: ${snapshotId}`);
        console.log(`\n⏳ Polling for results (checking every 30s, max 20 minutes)...\n`);
        
        // Poll for completion (20 minutes max)
        let attempts = 0;
        const maxAttempts = 40; // 40 attempts * 30 seconds = 20 minutes
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
          
          try {
            const statusResponse = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`, {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
            });

            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              const status = statusData.status || statusData.state || 'unknown';
              
              console.log(`   Status check ${attempts + 1}/${maxAttempts}: status="${status}"`);
              
              if (status === 'ready') {
                console.log(`\n✅ Snapshot ready!`);
                console.log(`\n📊 Response data:`);
                console.log(JSON.stringify(statusData, null, 2).substring(0, 2000));
                
                // Try to extract posts
                let postsData: any[] = [];
                if (Array.isArray(statusData)) {
                  postsData = statusData;
                } else if (statusData.data && Array.isArray(statusData.data)) {
                  postsData = statusData.data;
                } else if (statusData.results && Array.isArray(statusData.results)) {
                  postsData = statusData.results;
                }
                
                if (postsData.length > 0) {
                  console.log(`\n📈 Found ${postsData.length} posts/articles!`);
                  postsData.slice(0, 3).forEach((post, i) => {
                    console.log(`\n   ${i + 1}. ${post.title || post.headline || 'Untitled'}`);
                    console.log(`      URL: ${post.url || post.post_url || 'N/A'}`);
                  });
                } else {
                  console.log(`\n⚠️  Snapshot ready but no posts found in response`);
                  console.log(`   Response keys: ${Object.keys(statusData).join(', ')}`);
                }
                return;
              } else if (status === 'failed') {
                console.log(`\n❌ Snapshot failed:`, statusData.message);
                return;
              }
            } else {
              const errorText = await statusResponse.text();
              console.log(`   ⚠️  Status check failed: ${statusResponse.status} - ${errorText}`);
            }
          } catch (error: any) {
            console.error(`   ❌ Error checking status:`, error.message);
          }
          
          attempts++;
        }
        
        console.log(`\n⏳ Snapshot still processing after ${maxAttempts} attempts (20 minutes)`);
        console.log(`   You can check it later with: npx tsx scripts/check-snapshot.ts ${snapshotId}`);
      }
    } else {
      const errorText = await response.text();
      console.log('❌ Scrape submission failed');
      console.log(`   Status: ${response.status}`);
      console.log(`   Error: ${errorText}\n`);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
}

testUrlDiscover();

