// Load environment variables FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Complete LinkedIn → Email Test
 * 1. Scrape LinkedIn profile with Puppeteer
 * 2. Extract name, company, title
 * 3. Convert company to domain
 * 4. Call Hunter.io to find email
 */

import puppeteer from 'puppeteer';
import { findEmail } from '../lib/services/hunter';

// Company name to domain mapping (common companies)
const COMPANY_DOMAIN_MAP: Record<string, string> = {
  'google': 'google.com',
  'meta': 'meta.com',
  'facebook': 'meta.com',
  'apple': 'apple.com',
  'microsoft': 'microsoft.com',
  'amazon': 'amazon.com',
  'netflix': 'netflix.com',
  'tesla': 'tesla.com',
  'spacex': 'spacex.com',
  'stripe': 'stripe.com',
  'airbnb': 'airbnb.com',
  'uber': 'uber.com',
  'lyft': 'lyft.com',
  'twitter': 'twitter.com',
  'x': 'x.com',
  'linkedin': 'linkedin.com',
  'salesforce': 'salesforce.com',
  'oracle': 'oracle.com',
  'ibm': 'ibm.com',
  'intel': 'intel.com',
  'nvidia': 'nvidia.com',
  'amd': 'amd.com',
  'cisco': 'cisco.com',
  'adobe': 'adobe.com',
  'shopify': 'shopify.com',
  'square': 'squareup.com',
  'paypal': 'paypal.com',
  'venmo': 'venmo.com',
  'coinbase': 'coinbase.com',
  'robinhood': 'robinhood.com',
  'uc berkeley': 'berkeley.edu',
  'stanford': 'stanford.edu',
  'mit': 'mit.edu',
  'harvard': 'harvard.edu',
  'yale': 'yale.edu',
  'princeton': 'princeton.edu',
};

/**
 * Convert company name to domain
 */
function companyToDomain(companyName: string): string {
  const cleaned = companyName.toLowerCase().trim();
  
  // Check if it's in our mapping
  for (const [key, domain] of Object.entries(COMPANY_DOMAIN_MAP)) {
    if (cleaned.includes(key)) {
      return domain;
    }
  }
  
  // Fallback: clean company name and add .com
  const domainName = cleaned
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, '') // Remove spaces
    .replace(/inc|llc|ltd|corp|corporation|company|co/g, ''); // Remove common suffixes
  
  return `${domainName}.com`;
}

/**
 * Scrape LinkedIn profile
 */
async function scrapeLinkedInProfile(linkedinUrl: string) {
  console.log('🌐 Launching browser...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show browser so you can see what's happening
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📄 Navigating to LinkedIn profile...');
    await page.goto(linkedinUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract profile data
    console.log('🔍 Extracting profile data...');
    
    const profileData = await page.evaluate(() => {
      // Extract name
      const nameElement = document.querySelector('h1.text-heading-xlarge');
      const name = nameElement?.textContent?.trim() || '';
      
      // Split name
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Extract headline/title
      const headlineElement = document.querySelector('.text-body-medium.break-words');
      const headline = headlineElement?.textContent?.trim() || '';
      
      // Extract current company from experience section
      let currentCompany = '';
      let currentPosition = '';
      
      const experienceSection = document.querySelector('#experience');
      if (experienceSection) {
        const firstJob = experienceSection.parentElement?.querySelector('ul.pvs-list li.pvs-list__paged-list-item');
        if (firstJob) {
          // Company name
          const companyElement = firstJob.querySelector('.t-14.t-normal span[aria-hidden="true"]');
          currentCompany = companyElement?.textContent?.trim() || '';
          
          // Position title
          const positionElement = firstJob.querySelector('.t-bold span[aria-hidden="true"]');
          currentPosition = positionElement?.textContent?.trim() || '';
        }
      }
      
      // Fallback: try to get company from headline
      if (!currentCompany && headline) {
        const atMatch = headline.match(/at\s+(.+?)(?:\s*\||$)/i);
        if (atMatch) {
          currentCompany = atMatch[1].trim();
        }
      }
      
      // Extract location
      const locationElement = document.querySelector('.text-body-small.inline.t-black--light.break-words');
      const location = locationElement?.textContent?.trim() || '';
      
      return {
        name,
        firstName,
        lastName,
        title: currentPosition || headline,
        company: currentCompany,
        location,
        linkedinUrl: window.location.href,
      };
    });
    
    await browser.close();
    return profileData;
    
  } catch (error) {
    await browser.close();
    throw error;
  }
}

/**
 * Main test function
 */
async function testLinkedInToEmail() {
  console.log('🚀 LinkedIn → Email Test\n');
  console.log('=' .repeat(60));
  
  const linkedinUrl = 'https://www.linkedin.com/in/abhi-v-patel/';
  
  console.log('\n📋 Target Profile:');
  console.log('   LinkedIn URL:', linkedinUrl);
  console.log('\n' + '=' .repeat(60));
  
  try {
    // Step 1: Scrape LinkedIn profile
    console.log('\n📊 STEP 1: Scraping LinkedIn Profile\n');
    const profileData = await scrapeLinkedInProfile(linkedinUrl);
    
    console.log('✅ Profile data extracted!\n');
    console.log('👤 Name:', profileData.name);
    console.log('   First Name:', profileData.firstName);
    console.log('   Last Name:', profileData.lastName);
    console.log('💼 Title:', profileData.title || 'N/A');
    console.log('🏢 Company:', profileData.company || 'N/A');
    console.log('📍 Location:', profileData.location || 'N/A');
    
    if (!profileData.firstName || !profileData.lastName) {
      throw new Error('Could not extract name from LinkedIn profile');
    }
    
    if (!profileData.company) {
      throw new Error('Could not extract company from LinkedIn profile');
    }
    
    console.log('\n' + '=' .repeat(60));
    
    // Step 2: Convert company to domain
    console.log('\n🔄 STEP 2: Converting Company to Domain\n');
    const domain = companyToDomain(profileData.company);
    console.log('   Company:', profileData.company);
    console.log('   Domain:', domain);
    
    console.log('\n' + '=' .repeat(60));
    
    // Step 3: Call Hunter.io
    console.log('\n📧 STEP 3: Finding Email with Hunter.io\n');
    console.log('   Searching for:');
    console.log('   - First Name:', profileData.firstName);
    console.log('   - Last Name:', profileData.lastName);
    console.log('   - Domain:', domain);
    console.log('   - Company:', profileData.company);
    console.log('\n⏳ Calling Hunter.io API...\n');
    
    const result = await findEmail({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      domain: domain,
      company: profileData.company,
    });
    
    console.log('=' .repeat(60));
    
    if (!result || !result.data || !result.data.email) {
      console.log('\n❌ NO EMAIL FOUND\n');
      console.log('Possible reasons:');
      console.log('  - Person not in Hunter.io database');
      console.log('  - Wrong company domain');
      console.log('  - Email not publicly available');
      console.log('\nTried domain:', domain);
      console.log('Suggestion: Try manually entering the correct domain\n');
      return;
    }
    
    // Success!
    const email = result.data.email;
    const score = result.data.score;
    
    console.log('\n✅ EMAIL FOUND!\n');
    console.log('=' .repeat(60));
    console.log('\n📧 RESULT:\n');
    console.log('   Email:', email);
    console.log('   Confidence Score:', score, '/ 100');
    console.log('   Status:', score >= 90 ? '🟢 High confidence' : score >= 70 ? '🟡 Medium confidence' : '🔴 Low confidence');
    
    if (result.data.position) {
      console.log('   Position:', result.data.position);
    }
    
    if (result.data.sources && result.data.sources.length > 0) {
      console.log('\n   Sources:', result.data.sources.length, 'found');
      result.data.sources.slice(0, 3).forEach((source, i) => {
        console.log(`     ${i + 1}. ${source.domain}`);
      });
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n💾 COMPLETE PROFILE DATA:\n');
    console.log(JSON.stringify({
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: email,
      emailScore: score,
      title: profileData.title,
      company: profileData.company,
      domain: domain,
      location: profileData.location,
      linkedinUrl: profileData.linkedinUrl,
    }, null, 2));
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n✅ TEST PASSED! Found email for', profileData.name);
    console.log('\n📧 Email:', email);
    console.log('🎯 Confidence:', score + '%');
    console.log('\n' + '=' .repeat(60));
    
  } catch (error: any) {
    console.log('\n❌ ERROR:', error.message);
    console.log('\nFull error:', error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('  1. Make sure you\'re logged into LinkedIn in your browser');
    console.log('  2. LinkedIn may require login to view profiles');
    console.log('  3. Try opening the LinkedIn URL manually first');
    console.log('  4. Check if Hunter.io API key is valid');
  }
}

// Run the test
console.log('\n🎯 Starting Complete LinkedIn → Email Test...\n');
testLinkedInToEmail()
  .then(() => {
    console.log('\n✅ Test completed!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });


