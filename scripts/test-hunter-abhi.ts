// Load environment variables FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Test Hunter.io with Abhi Patel from LinkedIn
 * Company: Moelis & Company
 */

import { findEmail } from '../lib/services/hunter';

async function testHunterForAbhi() {
  console.log('🎯 Testing Hunter.io for Abhi Patel\n');
  console.log('=' .repeat(60));
  
  // Data extracted from LinkedIn HTML
  const profileData = {
    firstName: 'Abhi',
    lastName: 'Patel',
    company: 'Moelis & Company',
    title: 'Investment Banking Analyst',
    linkedinUrl: 'https://www.linkedin.com/in/abhi-v-patel/',
  };
  
  console.log('\n📋 Profile Data (from LinkedIn HTML):');
  console.log('   Name:', profileData.firstName, profileData.lastName);
  console.log('   Company:', profileData.company);
  console.log('   Title:', profileData.title);
  console.log('   LinkedIn:', profileData.linkedinUrl);
  
  // Convert company name to domain
  // Moelis & Company → moelis.com
  const domain = 'moelis.com';
  
  console.log('\n🔄 Company Domain Conversion:');
  console.log('   Company Name:', profileData.company);
  console.log('   Domain:', domain);
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n📧 Calling Hunter.io API...\n');
  
  try {
    const result = await findEmail({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      domain: domain,
      company: profileData.company,
    });
    
    if (!result || !result.data) {
      console.log('❌ No data returned from Hunter.io\n');
      console.log('Possible reasons:');
      console.log('  - Abhi Patel not in Hunter.io database');
      console.log('  - Wrong company domain');
      console.log('  - Email not publicly available\n');
      return;
    }
    
    const data = result.data;
    
    if (!data.email) {
      console.log('❌ NO EMAIL FOUND\n');
      console.log('Hunter.io could not find an email for:');
      console.log('   Name: Abhi Patel');
      console.log('   Company: Moelis & Company');
      console.log('   Domain: moelis.com\n');
      console.log('This person may not be in Hunter.io\'s database.\n');
      return;
    }
    
    // SUCCESS!
    console.log('✅ EMAIL FOUND!\n');
    console.log('=' .repeat(60));
    console.log('\n📧 RESULT:\n');
    console.log('   Email:', data.email);
    console.log('   Confidence Score:', data.score, '/ 100');
    console.log('   Status:', data.score >= 90 ? '🟢 High confidence' : data.score >= 70 ? '🟡 Medium confidence' : '🔴 Low confidence');
    
    if (data.position) {
      console.log('   Position:', data.position);
    }
    
    if (data.sources && data.sources.length > 0) {
      console.log('\n📍 Sources (' + data.sources.length + ' found):');
      data.sources.slice(0, 5).forEach((source, i) => {
        console.log(`   ${i + 1}. ${source.domain} - Last seen: ${source.last_seen_on}`);
      });
      if (data.sources.length > 5) {
        console.log(`   ... and ${data.sources.length - 5} more sources`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n💾 COMPLETE PROFILE DATA:\n');
    console.log(JSON.stringify({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: data.email,
      emailScore: data.score,
      title: profileData.title,
      company: profileData.company,
      domain: domain,
      linkedinUrl: profileData.linkedinUrl,
    }, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ SUCCESS! Found email for Abhi Patel');
    console.log('\n📧 Email:', data.email);
    console.log('🎯 Confidence:', data.score + '%');
    console.log('\n' + '=' .repeat(60));
    
  } catch (error: any) {
    console.log('\n❌ ERROR:', error.message);
    console.log('\nFull error:', error);
  }
}

// Run the test
console.log('\n🚀 Starting Hunter.io Test for Abhi Patel...\n');
testHunterForAbhi()
  .then(() => {
    console.log('\n✅ Test completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
