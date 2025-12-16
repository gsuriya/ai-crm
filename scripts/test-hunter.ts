// Load environment variables FIRST before any imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Test Hunter.io API Integration
 * This script tests if the Hunter API key works and can find emails
 */

import { findEmail, domainSearch, extractDomain } from '../lib/services/hunter';

async function testHunterAPI() {
  console.log('🧪 Testing Hunter.io API Integration\n');
  console.log('=' .repeat(60));
  
  // Debug: Check if API key is loaded
  console.log('\n🔑 API Key Status:');
  console.log('   HUNTER_API_KEY exists:', !!process.env.HUNTER_API_KEY);
  console.log('   Key length:', process.env.HUNTER_API_KEY?.length || 0);
  console.log('   Key preview:', process.env.HUNTER_API_KEY ? `${process.env.HUNTER_API_KEY.substring(0, 10)}...` : 'NOT SET');
  console.log('=' .repeat(60));
  
  // Test profile - Abhi V Patel from LinkedIn
  const linkedinUrl = 'https://www.linkedin.com/in/abhi-v-patel/';
  
  // We need to figure out the company domain
  // For testing, let's try a few common approaches
  console.log('\n📋 Test Profile:');
  console.log('LinkedIn URL:', linkedinUrl);
  console.log('Name: Abhi Patel');
  console.log('\n⚠️  Note: Hunter.io needs a company domain to find emails.');
  console.log('We need to either:');
  console.log('  1. Extract company from LinkedIn profile');
  console.log('  2. User provides company domain');
  console.log('  3. Try common domains\n');
  console.log('=' .repeat(60));
  
  // Let's try a few test scenarios
  const testScenarios = [
    {
      name: 'Test 1: Generic search (if we knew the domain)',
      firstName: 'Abhi',
      lastName: 'Patel',
      domain: 'example.com', // Would need real domain
      company: 'Example Company',
    },
  ];
  
  console.log('\n🔍 Testing Hunter.io Email Finder API...\n');
  
  try {
    const startTime = Date.now();
    
    // Test with a known working example first
    console.log('📧 Test Case: Finding email for a test person');
    console.log('   First Name: Abhi');
    console.log('   Last Name: Patel');
    console.log('   Domain: We need to know their company domain');
    console.log('\n⚠️  IMPORTANT: Hunter.io requires a company domain to work!');
    console.log('   Example: If Abhi works at Google, we need "google.com"');
    console.log('   Example: If Abhi works at Stripe, we need "stripe.com"\n');
    
    // Let's test with a known company to verify API works
    console.log('🧪 Testing API with a known example (Stripe)...\n');
    
    const testResult = await findEmail({
      firstName: 'Patrick',
      lastName: 'Collison',
      domain: 'stripe.com',
      company: 'Stripe',
    });
    
    const duration = Date.now() - startTime;
    
    if (!testResult || !testResult.data) {
      console.log('❌ FAILED: No data returned from Hunter.io\n');
      console.log('Possible reasons:');
      console.log('  - API key invalid or expired');
      console.log('  - Rate limit exceeded');
      console.log('  - Network error');
      console.log('  - Person not in Hunter database\n');
      return;
    }
    
    console.log('✅ SUCCESS! Hunter.io API is working!\n');
    console.log('=' .repeat(60));
    console.log('\n📧 TEST RESULT (Patrick Collison @ Stripe):\n');
    
    const data = testResult.data;
    
    console.log('👤 Personal Information:');
    console.log('   Name:', data.first_name, data.last_name);
    console.log('   Email:', data.email || '❌ Not found');
    console.log('   Confidence Score:', data.score || 'N/A', '/ 100');
    console.log('   Position:', data.position || 'N/A');
    console.log('   Company:', data.company || 'N/A');
    
    if (data.linkedin_url) {
      console.log('   LinkedIn:', data.linkedin_url);
    }
    
    if (data.twitter) {
      console.log('   Twitter:', data.twitter);
    }
    
    if (data.phone_number) {
      console.log('   Phone:', data.phone_number);
    }
    
    if (data.sources && data.sources.length > 0) {
      console.log('\n📍 Sources (' + data.sources.length + ' found):');
      data.sources.slice(0, 3).forEach((source, i) => {
        console.log(`   ${i + 1}. ${source.domain} - Last seen: ${source.last_seen_on}`);
      });
      if (data.sources.length > 3) {
        console.log(`   ... and ${data.sources.length - 3} more sources`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log(`\n⏱️  Request completed in ${duration}ms`);
    
    // Now explain what we need for Abhi
    console.log('\n' + '=' .repeat(60));
    console.log('\n💡 TO FIND ABHI PATEL\'S EMAIL:\n');
    console.log('We need to know which company he works for. Options:');
    console.log('\n1️⃣  Extract from LinkedIn profile:');
    console.log('   - Scrape his current company from LinkedIn');
    console.log('   - Look up company domain (e.g., "Acme Corp" → "acme.com")');
    console.log('\n2️⃣  Ask user to provide company:');
    console.log('   - Show modal: "What company does Abhi work for?"');
    console.log('   - User types: "Google" or "google.com"');
    console.log('\n3️⃣  Use LinkedIn company page:');
    console.log('   - If LinkedIn shows company, extract domain from company page');
    
    console.log('\n📊 SUMMARY:\n');
    console.log('✅ Hunter.io API is working correctly!');
    console.log('✅ API key is valid');
    console.log('✅ Can find emails when we have:');
    console.log('   - First name');
    console.log('   - Last name');
    console.log('   - Company domain');
    console.log('\n⚠️  Next step: Extract company domain from LinkedIn profile');
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ TEST PASSED! Hunter.io integration is working!\n');
    
  } catch (error: any) {
    console.log('\n❌ ERROR: Test failed!\n');
    console.log('Error message:', error.message);
    console.log('\nFull error:', error);
    
    console.log('\n🔧 Troubleshooting:\n');
    console.log('1. Check your Hunter.io API key in .env.local');
    console.log('   Current key:', process.env.HUNTER_API_KEY ? 'Set ✓' : 'NOT SET ✗');
    console.log('\n2. Verify the API key is valid at:');
    console.log('   https://hunter.io/api_keys\n');
    console.log('3. Check your Hunter.io credit balance:');
    console.log('   https://hunter.io/users/billing\n');
    console.log('4. Make sure you have internet connection\n');
  }
}

// Run the test
console.log('\n🚀 Starting Hunter.io API Test...\n');
testHunterAPI()
  .then(() => {
    console.log('\n✅ Test completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });


