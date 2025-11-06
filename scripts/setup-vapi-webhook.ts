import { VapiClient } from '@vapi-ai/server-sdk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * Script to set up VAPI webhook via API
 * Since VAPI removed webhook UI from dashboard, we need to use API
 */
async function setupWebhook() {
  try {
    const privateKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;
    if (!privateKey) {
      console.error('❌ VAPI_PRIVATE_KEY or VAPI_API_KEY is not set');
      process.exit(1);
    }

    const assistantId = process.env.VAPI_ASSISTANT_ID || '3573b8dd-f031-4338-8cef-f8cc548dc415';
    
    // Get webhook URL from user or use ngrok
    const webhookUrl = process.argv[2];
    
    if (!webhookUrl) {
      console.log('\n📋 VAPI Webhook Setup via API\n');
      console.log('Since VAPI removed webhook UI, we need to set it up via API.\n');
      console.log('Usage:');
      console.log('  npx tsx scripts/setup-vapi-webhook.ts <WEBHOOK_URL>\n');
      console.log('Example:');
      console.log('  npx tsx scripts/setup-vapi-webhook.ts https://abc123.ngrok.io/api/vapi/webhook\n');
      console.log('Or if deployed:');
      console.log('  npx tsx scripts/setup-vapi-webhook.ts https://your-app.vercel.app/api/vapi/webhook\n');
      process.exit(1);
    }

    // Validate URL format
    if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
      console.error('❌ Webhook URL must start with http:// or https://');
      process.exit(1);
    }

    console.log('\n🔧 Setting up VAPI webhook...\n');
    console.log(`Assistant ID: ${assistantId}`);
    console.log(`Webhook URL: ${webhookUrl}\n`);

    const vapi = new VapiClient({
      token: privateKey,
    });

    // Method 1: Try updating assistant with serverUrl
    try {
      console.log('📝 Method 1: Updating assistant with serverUrl...');
      
      // First, get current assistant config
      const assistant = await vapi.assistants.get(assistantId);
      console.log('✅ Got assistant config');

      // Update assistant with serverUrl (webhook URL)
      const updatedAssistant = await vapi.assistants.update(assistantId, {
        serverUrl: webhookUrl,
      } as any);

      console.log('✅ Successfully updated assistant with webhook URL!');
      console.log(`   Server URL: ${updatedAssistant.serverUrl || webhookUrl}`);
      console.log('\n🎉 Webhook configured successfully!\n');
      console.log('Next steps:');
      console.log('1. Make a test call');
      console.log('2. Run: npx tsx scripts/check-recent-calls.ts');
      console.log('3. Verify transcription appears automatically\n');
      
      return;
    } catch (error: any) {
      console.log(`⚠️  Method 1 failed: ${error.message}`);
      console.log('Trying alternative method...\n');
    }

    // Method 2: Try using VAPI REST API directly
    try {
      console.log('📝 Method 2: Using VAPI REST API directly...');
      
      const response = await fetch('https://api.vapi.ai/assistant', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${privateKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: assistantId,
          serverUrl: webhookUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Successfully configured webhook via REST API!');
      console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
      console.log('\n🎉 Webhook configured successfully!\n');
      
      return;
    } catch (error: any) {
      console.log(`⚠️  Method 2 failed: ${error.message}`);
      console.log('\n❌ Both methods failed. Trying manual approach...\n');
    }

    // Method 3: Provide manual instructions
    console.log('📋 Manual Setup Instructions:\n');
    console.log('Since API methods didn\'t work, try these options:\n');
    console.log('Option A: Use VAPI CLI');
    console.log('  1. Install: curl -sSL https://vapi.ai/install.sh | bash');
    console.log('  2. Login: vapi login');
    console.log(`  3. Update: vapi assistant update --id ${assistantId} --server-url ${webhookUrl}\n`);
    
    console.log('Option B: Use curl command');
    console.log(`  curl -X PATCH https://api.vapi.ai/assistant \\`);
    console.log(`    -H "Authorization: Bearer ${privateKey.substring(0, 20)}..." \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -d '{"id": "${assistantId}", "serverUrl": "${webhookUrl}"}'\n`);

    console.log('Option C: Check VAPI Dashboard');
    console.log('  - Go to: https://dashboard.vapi.ai');
    console.log(`  - Navigate to Assistant: ${assistantId}`);
    console.log('  - Look for "Server URL" or "Webhook URL" field');
    console.log(`  - Set it to: ${webhookUrl}\n`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
setupWebhook().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

