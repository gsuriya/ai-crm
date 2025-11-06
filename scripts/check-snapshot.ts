import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function checkSnapshot() {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  const snapshotId = process.argv[2]; // Get snapshot ID from command line

  if (!apiKey) {
    console.error('❌ BRIGHTDATA_API_KEY not found');
    return;
  }

  if (!snapshotId) {
    console.error('❌ Please provide a snapshot ID: npx tsx scripts/check-snapshot.ts <snapshot_id>');
    return;
  }

  console.log(`🔍 Checking snapshot: ${snapshotId}\n`);

  try {
    const response = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('📊 Snapshot Status:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.status === 'ready') {
        console.log('\n✅ Snapshot is ready!');
        if (data.data && Array.isArray(data.data)) {
          console.log(`📈 Found ${data.data.length} items`);
        }
      } else if (data.status === 'failed') {
        console.log('\n❌ Snapshot failed');
      } else {
        console.log('\n⏳ Snapshot still processing...');
      }
    } else {
      const errorText = await response.text();
      console.error('❌ Error:', response.status, errorText);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkSnapshot();

