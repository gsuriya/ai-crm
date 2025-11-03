#!/usr/bin/env node
/**
 * Complete API Test Suite
 * Tests all APIs: Gmail, Calendar, VAPI
 */

import { sendEmail } from '../lib/services/gmail';
import { createCalendarEvent } from '../lib/services/calendar';
import { sendVoicemail } from '../lib/services/vapi';
import { supabase } from '../lib/supabase';

const TEST_EMAIL = 'sg.suriya.v@gmail.com';
const TEST_PHONE = '+19255772134';

async function testGmailAPI() {
  console.log('\n📧 Testing Gmail API...');
  console.log('=' .repeat(50));
  
  try {
    // Get a test user ID (you'll need to sign in first)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('❌ No authenticated user. Please sign in first.');
      return false;
    }
    
    console.log(`✅ User authenticated: ${user.email}`);
    
    const result = await sendEmail(user.id, {
      to: TEST_EMAIL,
      subject: 'API Test - Gmail',
      body: '<p>This is a test email from the CRM API test suite.</p><p>If you receive this, Gmail API is working!</p>',
    });
    
    console.log(`✅ Email sent successfully!`);
    console.log(`   Message ID: ${result.messageId}`);
    console.log(`   Thread ID: ${result.threadId}`);
    console.log(`   Gmail Message ID: ${result.gmailMessageId}`);
    
    return true;
  } catch (error: any) {
    console.error('❌ Gmail API test failed:', error.message);
    return false;
  }
}

async function testCalendarAPI() {
  console.log('\n📅 Testing Google Calendar API...');
  console.log('=' .repeat(50));
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('❌ No authenticated user. Please sign in first.');
      return false;
    }
    
    console.log(`✅ User authenticated: ${user.email}`);
    
    const result = await createCalendarEvent(user.id, {
      toEmail: TEST_EMAIL,
      title: 'API Test - Calendar Invite',
      description: 'This is a test calendar invite from the CRM API test suite.',
      durationMinutes: 30,
      startTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    });
    
    console.log(`✅ Calendar invite sent successfully!`);
    console.log(`   Event ID: ${result.eventId}`);
    
    return true;
  } catch (error: any) {
    console.error('❌ Calendar API test failed:', error.message);
    return false;
  }
}

async function testVAPI() {
  console.log('\n📞 Testing VAPI...');
  console.log('=' .repeat(50));
  
  try {
    const result = await sendVoicemail({
      phoneNumber: TEST_PHONE,
      script: 'Hello! This is a test voicemail from the CRM API test suite. If you receive this, VAPI is working correctly!',
      companyId: '00000000-0000-0000-0000-000000000000', // Dummy ID for test
    });
    
    console.log(`✅ Voicemail sent successfully!`);
    console.log(`   Call ID: ${result.callId}`);
    console.log(`   Status: ${result.status}`);
    
    return true;
  } catch (error: any) {
    console.error('❌ VAPI test failed:', error.message);
    if (error.message.includes('VAPI_PHONE_NUMBER_ID')) {
      console.error('   ⚠️  VAPI_PHONE_NUMBER_ID is not set in .env.local');
      console.error('   Please add a phone number ID from VAPI dashboard');
    }
    return false;
  }
}

async function testEnvironmentVariables() {
  console.log('\n🔑 Testing Environment Variables...');
  console.log('=' .repeat(50));
  
  const required = {
    'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
    'VAPI_PRIVATE_KEY': process.env.VAPI_PRIVATE_KEY,
    'VAPI_ASSISTANT_ID': process.env.VAPI_ASSISTANT_ID,
  };
  
  const optional = {
    'VAPI_PHONE_NUMBER_ID': process.env.VAPI_PHONE_NUMBER_ID,
  };
  
  let allPresent = true;
  
  console.log('\nRequired Variables:');
  for (const [key, value] of Object.entries(required)) {
    if (value) {
      console.log(`  ✅ ${key}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`  ❌ ${key}: MISSING`);
      allPresent = false;
    }
  }
  
  console.log('\nOptional Variables:');
  for (const [key, value] of Object.entries(optional)) {
    if (value) {
      console.log(`  ✅ ${key}: ${value}`);
    } else {
      console.log(`  ⚠️  ${key}: NOT SET (may be required for VAPI)`);
    }
  }
  
  return allPresent;
}

async function main() {
  console.log('🚀 Starting Complete API Test Suite');
  console.log('=' .repeat(50));
  
  const results = {
    env: await testEnvironmentVariables(),
    gmail: false,
    calendar: false,
    vapi: false,
  };
  
  if (!results.env) {
    console.log('\n❌ Environment variables check failed. Please fix before testing APIs.');
    return;
  }
  
  console.log('\n✅ All environment variables present. Proceeding with API tests...');
  
  results.gmail = await testGmailAPI();
  results.calendar = await testCalendarAPI();
  results.vapi = await testVAPI();
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(50));
  console.log(`Environment Variables: ${results.env ? '✅' : '❌'}`);
  console.log(`Gmail API: ${results.gmail ? '✅' : '❌'}`);
  console.log(`Calendar API: ${results.calendar ? '✅' : '❌'}`);
  console.log(`VAPI: ${results.vapi ? '✅' : '❌'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
}

main().catch(console.error);

