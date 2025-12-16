// Load environment variables FIRST before any imports
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Test Apollo.io API Integration
 * This script tests if the Apollo API key works and can find emails from LinkedIn URLs
 */

import { enrichPersonByLinkedIn } from '../lib/services/apollo';

async function testApolloAPI() {
  console.log('🧪 Testing Apollo.io API Integration\n');
  console.log('=' .repeat(60));
  
  // Debug: Check if API key is loaded
  console.log('\n🔑 API Key Status:');
  console.log('   APOLLO_API_KEY exists:', !!process.env.APOLLO_API_KEY);
  console.log('   Key length:', process.env.APOLLO_API_KEY?.length || 0);
  console.log('   Key preview:', process.env.APOLLO_API_KEY ? `${process.env.APOLLO_API_KEY.substring(0, 10)}...` : 'NOT SET');
  console.log('=' .repeat(60));
  
  // Test profile
  const linkedinUrl = 'https://www.linkedin.com/in/abhi-v-patel/';
  const profileData = {
    firstName: 'Abhi',
    lastName: 'Patel',
    name: 'Abhi V Patel',
    organizationName: '', // Will be extracted from LinkedIn or Apollo
    title: '', // Will be extracted from LinkedIn or Apollo
  };
  
  console.log('\n📋 Test Profile:');
  console.log('LinkedIn URL:', linkedinUrl);
  console.log('Name:', profileData.name);
  console.log('Company:', profileData.organizationName);
  console.log('Title:', profileData.title);
  console.log('\n' + '=' .repeat(60));
  
  try {
    console.log('\n🔍 Calling Apollo.io API...');
    console.log('⏳ Please wait...\n');
    
    const startTime = Date.now();
    
    // Call Apollo API
    const result = await enrichPersonByLinkedIn(linkedinUrl, profileData);
    
    const duration = Date.now() - startTime;
    
    if (!result || !result.person) {
      console.log('❌ FAILED: No data returned from Apollo.io\n');
      console.log('Possible reasons:');
      console.log('  - Person not in Apollo database');
      console.log('  - API key invalid or expired');
      console.log('  - Rate limit exceeded');
      console.log('  - Network error\n');
      return;
    }
    
    const person = result.person;
    
    console.log('✅ SUCCESS! Apollo.io API is working!\n');
    console.log('=' .repeat(60));
    console.log('\n📧 ENRICHED DATA:\n');
    
    // Personal Info
    console.log('👤 Personal Information:');
    console.log('   Name:', person.name || 'N/A');
    console.log('   First Name:', person.first_name || 'N/A');
    console.log('   Last Name:', person.last_name || 'N/A');
    console.log('   Title:', person.title || 'N/A');
    
    // Contact Info
    console.log('\n📬 Contact Information:');
    console.log('   Email:', person.email || '❌ Not found');
    console.log('   Email Status:', person.email_status || 'N/A');
    console.log('   LinkedIn:', person.linkedin_url || 'N/A');
    
    // Company Info
    if (person.organization) {
      console.log('\n🏢 Company Information:');
      console.log('   Company Name:', person.organization.name || 'N/A');
      console.log('   Website:', person.organization.website_url || 'N/A');
      console.log('   Domain:', person.organization.primary_domain || 'N/A');
      console.log('   LinkedIn:', person.organization.linkedin_url || 'N/A');
      console.log('   Phone:', person.organization.phone || person.organization.primary_phone?.number || 'N/A');
      
      if (person.organization.logo_url) {
        console.log('   Logo:', person.organization.logo_url);
      }
    }
    
    // Social Links
    const socialLinks = [];
    if (person.twitter_url) socialLinks.push(`Twitter: ${person.twitter_url}`);
    if (person.github_url) socialLinks.push(`GitHub: ${person.github_url}`);
    if (person.facebook_url) socialLinks.push(`Facebook: ${person.facebook_url}`);
    
    if (socialLinks.length > 0) {
      console.log('\n🔗 Social Links:');
      socialLinks.forEach(link => console.log('  ', link));
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log(`\n⏱️  Request completed in ${duration}ms`);
    
    // Summary
    console.log('\n📊 SUMMARY:\n');
    if (person.email) {
      console.log('✅ Email found:', person.email);
      console.log('✅ Status:', person.email_status || 'unknown');
      console.log('✅ Apollo.io API is working correctly!');
    } else {
      console.log('⚠️  No email found for this person');
      console.log('   This person may not be in Apollo\'s database');
    }
    
    console.log('\n' + '=' .repeat(60));
    
    // Show what would be saved to CRM
    console.log('\n💾 DATA THAT WOULD BE SAVED TO CRM:\n');
    console.log(JSON.stringify({
      firstName: person.first_name,
      lastName: person.last_name,
      email: person.email,
      linkedinUrl: person.linkedin_url,
      jobTitle: person.title,
      currentCompany: person.organization?.name,
      photoUrl: person.photo_url,
      companyWebsite: person.organization?.website_url,
      companyDomain: person.organization?.primary_domain,
    }, null, 2));
    
    console.log('\n✅ TEST PASSED! Apollo.io integration is working!\n');
    
  } catch (error: any) {
    console.log('\n❌ ERROR: Test failed!\n');
    console.log('Error message:', error.message);
    console.log('\nFull error:', error);
    
    console.log('\n🔧 Troubleshooting:\n');
    console.log('1. Check your Apollo API key in .env.local');
    console.log('   Current key:', process.env.APOLLO_API_KEY ? 'Set ✓' : 'NOT SET ✗');
    console.log('\n2. Verify the API key is valid at:');
    console.log('   https://app.apollo.io/settings/integrations/api\n');
    console.log('3. Check your Apollo.io credit balance\n');
    console.log('4. Make sure you have internet connection\n');
  }
}

// Run the test
console.log('\n🚀 Starting Apollo.io API Test...\n');
testApolloAPI()
  .then(() => {
    console.log('\n✅ Test completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });


