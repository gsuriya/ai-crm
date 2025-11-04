#!/usr/bin/env tsx
/**
 * VAPI Configuration Test Script
 * Tests if VAPI credentials are properly configured
 */

import dotenv from 'dotenv';
import path from 'path';
import { VapiClient } from '@vapi-ai/server-sdk';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testVAPIConfiguration() {
  console.log('\n📞 Testing VAPI Configuration...');
  console.log('=' .repeat(60));
  
  // Step 1: Check environment variables
  console.log('\n1️⃣ Checking Environment Variables...');
  const privateKey = process.env.VAPI_PRIVATE_KEY || process.env.VAPI_API_KEY;
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
  const assistantId = process.env.VAPI_ASSISTANT_ID;
  
  const checks = {
    privateKey: !!privateKey,
    phoneNumberId: !!phoneNumberId,
    assistantId: !!assistantId,
  };
  
  console.log(`   ✅ VAPI_PRIVATE_KEY or VAPI_API_KEY: ${checks.privateKey ? '✓ Set' : '❌ Missing'}`);
  if (privateKey) {
    console.log(`      Key: ${privateKey.substring(0, 8)}...${privateKey.substring(privateKey.length - 4)}`);
  }
  
  console.log(`   ${checks.phoneNumberId ? '✅' : '❌'} VAPI_PHONE_NUMBER_ID: ${checks.phoneNumberId ? '✓ Set' : '❌ Missing'}`);
  if (phoneNumberId) {
    console.log(`      ID: ${phoneNumberId}`);
  }
  
  console.log(`   ${checks.assistantId ? '✅' : '⚠️ '} VAPI_ASSISTANT_ID: ${checks.assistantId ? '✓ Set' : '⚠️  Using default'}`);
  if (assistantId) {
    console.log(`      ID: ${assistantId}`);
  }
  
  if (!checks.privateKey) {
    console.log('\n❌ VAPI_PRIVATE_KEY or VAPI_API_KEY is required but not set!');
    return false;
  }
  
  if (!checks.phoneNumberId) {
    console.log('\n❌ VAPI_PHONE_NUMBER_ID is required but not set!');
    return false;
  }
  
  console.log('\n✅ All required environment variables are set!');
  
  // Step 2: Test VAPI client initialization
  console.log('\n2️⃣ Testing VAPI Client Initialization...');
  try {
    const vapi = new VapiClient({
      token: privateKey!,
    });
    console.log('✅ VAPI client initialized successfully');
  } catch (error: any) {
    console.error('❌ Failed to initialize VAPI client:', error.message);
    return false;
  }
  
  // Step 3: Test API connection by fetching assistant
  console.log('\n3️⃣ Testing VAPI API Connection...');
  try {
    const vapi = new VapiClient({
      token: privateKey!,
    });
    
    if (assistantId) {
      console.log(`   Fetching assistant: ${assistantId}...`);
      const assistant = await vapi.assistants.get(assistantId);
      console.log('✅ Successfully connected to VAPI API!');
      console.log(`   📝 Assistant Name: ${assistant.name || 'N/A'}`);
      console.log(`   📝 Assistant Model: ${assistant.model?.provider || 'N/A'}`);
      console.log(`   📝 Assistant Status: ${assistant.status || 'N/A'}`);
    } else {
      // Just test connection by fetching phone number
      console.log(`   Fetching phone number: ${phoneNumberId}...`);
      const phoneNumber = await vapi.phoneNumbers.get(phoneNumberId!);
      console.log('✅ Successfully connected to VAPI API!');
      console.log(`   📞 Phone Number: ${phoneNumber.number || 'N/A'}`);
      console.log(`   📞 Provider: ${phoneNumber.provider || 'N/A'}`);
    }
  } catch (error: any) {
    if (error.statusCode === 401) {
      console.error('❌ Authentication failed - Invalid VAPI_PRIVATE_KEY');
      console.error('   Please check your private key in .env.local');
      return false;
    } else if (error.statusCode === 404) {
      console.error('⚠️  API connection works, but assistant/phone number not found');
      console.error('   Please verify your VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID');
      return false;
    } else {
      console.error('❌ API connection test failed:', error.message);
      return false;
    }
  }
  
  // Step 4: Test phone number fetch
  console.log('\n4️⃣ Testing Phone Number Configuration...');
  try {
    const vapi = new VapiClient({
      token: privateKey!,
    });
    
    const phoneNumber = await vapi.phoneNumbers.get(phoneNumberId!);
    console.log('✅ Phone number configuration valid!');
    console.log(`   📞 Number: ${phoneNumber.number || 'N/A'}`);
    console.log(`   📞 Provider: ${phoneNumber.provider || 'N/A'}`);
    console.log(`   📞 Status: ${phoneNumber.status || 'N/A'}`);
  } catch (error: any) {
    if (error.statusCode === 404) {
      console.error('❌ Phone number not found - Invalid VAPI_PHONE_NUMBER_ID');
      console.error('   Please check your phone number ID in .env.local');
      return false;
    } else {
      console.error('❌ Failed to fetch phone number:', error.message);
      return false;
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ VAPI Configuration Test: PASSED');
  console.log('=' .repeat(60));
  console.log('\n🎉 Your VAPI setup is ready!');
  console.log('\n📋 Summary:');
  console.log(`   ✅ Private Key: Configured`);
  console.log(`   ✅ Phone Number ID: ${phoneNumberId}`);
  console.log(`   ${assistantId ? '✅' : '⚠️ '} Assistant ID: ${assistantId || 'Using default'}`);
  
  return true;
}

async function main() {
  try {
    const success = await testVAPIConfiguration();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

main();


