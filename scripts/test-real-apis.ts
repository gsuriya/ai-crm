#!/usr/bin/env tsx
/**
 * Real API Test Script
 * Actually sends email, makes call, and sends calendar invite
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const TEST_EMAIL = 'sg.suriya.v@gmail.com';
const TEST_PHONE = '+19255772134';

async function testGmailAPI() {
  console.log('\n📧 Testing Gmail API - Sending Real Email...');
  console.log('=' .repeat(60));
  
  try {
    const { sendEmail } = await import('../lib/services/gmail.js');
    const { supabase } = await import('../lib/supabase.js');
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('❌ No authenticated user. Please sign in with Google OAuth first.');
      console.log('   Go to: http://localhost:3000/auth/signin');
      return false;
    }
    
    console.log(`✅ User authenticated: ${user.email}`);
    
    const result = await sendEmail(user.id, {
      to: TEST_EMAIL,
      subject: 'API Test - Gmail API Working!',
      body: `
        <h2>✅ Gmail API Test Successful!</h2>
        <p>This email was sent using the Gmail API to verify everything is working.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>From:</strong> ${user.email}</p>
        <p><strong>Test Type:</strong> Direct API call (not workflow)</p>
        <hr>
        <p style="color: #666; font-size: 12px;">If you received this, the Gmail API integration is working correctly! 🎉</p>
      `,
    });
    
    console.log(`✅ Email sent successfully!`);
    console.log(`   📧 To: ${TEST_EMAIL}`);
    console.log(`   📨 Message ID: ${result.messageId}`);
    console.log(`   🧵 Thread ID: ${result.threadId}`);
    console.log(`   📱 Gmail Message ID: ${result.gmailMessageId}`);
    console.log(`\n💡 Check your inbox: ${TEST_EMAIL}`);
    
    return true;
  } catch (error: any) {
    console.error('❌ Gmail API test failed:', error.message);
    if (error.message.includes('Session not found')) {
      console.error('   ⚠️  User needs to sign in with Google OAuth');
      console.error('   Go to: http://localhost:3000/auth/signin');
    }
    return false;
  }
}

async function testCalendarAPI() {
  console.log('\n📅 Testing Google Calendar API - Sending Real Calendar Invite...');
  console.log('=' .repeat(60));
  
  try {
    const { createCalendarEvent } = await import('../lib/services/calendar.js');
    const { supabase } = await import('../lib/supabase.js');
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('❌ No authenticated user. Please sign in with Google OAuth first.');
      return false;
    }
    
    console.log(`✅ User authenticated: ${user.email}`);
    
    // Schedule for 1 hour from now
    const startTime = new Date(Date.now() + 60 * 60 * 1000);
    
    const result = await createCalendarEvent(user.id, {
      toEmail: TEST_EMAIL,
      title: 'API Test - Calendar Invite',
      description: `This is a test calendar invite from the CRM API test suite.
      
If you received this, the Calendar API integration is working correctly! 🎉

Test Details:
- Sent at: ${new Date().toISOString()}
- Test Type: Direct API call (not workflow)
- Duration: 30 minutes`,
      durationMinutes: 30,
      startTime: startTime,
    });
    
    console.log(`✅ Calendar invite sent successfully!`);
    console.log(`   📧 To: ${TEST_EMAIL}`);
    console.log(`   📅 Event ID: ${result.eventId}`);
    console.log(`   ⏰ Start Time: ${startTime.toLocaleString()}`);
    console.log(`\n💡 Check your calendar: ${TEST_EMAIL}`);
    
    return true;
  } catch (error: any) {
    console.error('❌ Calendar API test failed:', error.message);
    if (error.message.includes('Session not found')) {
      console.error('   ⚠️  User needs to sign in with Google OAuth');
      console.error('   Go to: http://localhost:3000/auth/signin');
    }
    return false;
  }
}

async function testVAPI() {
  console.log('\n📞 Testing VAPI - Making Real Phone Call...');
  console.log('=' .repeat(60));
  
  try {
    const { sendVoicemail } = await import('../lib/services/vapi.js');
    
    console.log(`📱 Phone: ${TEST_PHONE}`);
    console.log(`📝 Script: "This is a test call from the CRM API test suite..."`);
    
    const result = await sendVoicemail({
      phoneNumber: TEST_PHONE,
      script: 'Hello! This is a test voicemail from the CRM API test suite. If you receive this call, VAPI is working correctly! This is just a test to verify the phone number integration. Thank you!',
      companyId: '00000000-0000-0000-0000-000000000000', // Dummy ID for test
    });
    
    console.log(`✅ Voicemail call initiated successfully!`);
    console.log(`   📞 To: ${TEST_PHONE}`);
    console.log(`   📞 Call ID: ${result.callId}`);
    console.log(`   📊 Status: ${result.status}`);
    console.log(`\n💡 Answer your phone: ${TEST_PHONE}`);
    console.log(`   The call should come through in a few seconds!`);
    
    return true;
  } catch (error: any) {
    console.error('❌ VAPI test failed:', error.message);
    if (error.message.includes('VAPI_PHONE_NUMBER_ID')) {
      console.error('   ⚠️  VAPI_PHONE_NUMBER_ID is not set in .env.local');
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Real API Test Suite');
  console.log('=' .repeat(60));
  console.log('This will send REAL emails, make REAL calls, and send REAL calendar invites!');
  console.log('=' .repeat(60));
  
  const results = {
    gmail: false,
    calendar: false,
    vapi: false,
  };
  
  console.log('\n⏳ Running tests...\n');
  
  results.gmail = await testGmailAPI();
  results.calendar = await testCalendarAPI();
  results.vapi = await testVAPI();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  console.log(`📧 Gmail API: ${results.gmail ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`📅 Calendar API: ${results.calendar ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`📞 VAPI: ${results.vapi ? '✅ SUCCESS' : '❌ FAILED'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  
  if (allPassed) {
    console.log('\n🎉 All API tests passed!');
    console.log('\n📋 Check for:');
    console.log(`   📧 Email in: ${TEST_EMAIL}`);
    console.log(`   📅 Calendar invite in: ${TEST_EMAIL}`);
    console.log(`   📞 Phone call to: ${TEST_PHONE}`);
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
}

main().catch(console.error);

