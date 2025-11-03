# FIXING GOOGLE OAUTH SCOPES - CRITICAL STEPS

## The Problem
Supabase's Google OAuth provider may not be forwarding the scopes we request in code. 
Even though we're requesting `gmail.send` scope, Google isn't granting it.

## Solution: Configure Scopes in Google Cloud Console

**YOU MUST DO THIS IN GOOGLE CLOUD CONSOLE:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **OAuth consent screen**
4. Click **EDIT APP**
5. Scroll down to **Scopes**
6. Click **ADD OR REMOVE SCOPES**
7. Search for and ADD these scopes:
   - `https://www.googleapis.com/auth/gmail.send` ✅
   - `https://www.googleapis.com/auth/calendar.events` ✅
   - `https://www.googleapis.com/auth/userinfo.email` ✅
   - `https://www.googleapis.com/auth/userinfo.profile` ✅
8. Click **UPDATE** then **SAVE AND CONTINUE**

## Then Configure in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Google**
3. Make sure the provider is enabled
4. **IMPORTANT**: Check if there's a "Scopes" field - if there is, add all the scopes listed above
5. Save changes

## Test App Verification Status

If your app is in "Testing" mode:
- Go to **OAuth consent screen** → **Test users**
- Make sure your email (`sg.suriya.c@gmail.com`) is added as a test user

If your app needs verification:
- Google may require app verification for sensitive scopes like `gmail.send`
- You may need to submit your app for verification
- OR keep it in "Testing" mode and add test users

## After Configuration

1. **Sign out completely** from your app
2. **Clear browser cookies** for localhost:3000
3. Sign back in with Google
4. **CAREFULLY CHECK** the Google consent screen - it should show ALL permissions including "Send email on your behalf"
5. **GRANT ALL PERMISSIONS**
6. Try clicking "Restart" on the cadence again

## Debug Steps

If it still doesn't work after the above:

1. Go to `/auth-status` in your app
2. Check what scopes are actually stored
3. Go to `/test-scopes` to see what Google actually granted
4. Check the terminal logs when you click "Restart" - look for `[Gmail] 🔍 Token verification:` logs





