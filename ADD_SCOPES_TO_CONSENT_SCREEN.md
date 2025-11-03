# Step-by-Step: Add Scopes to OAuth Consent Screen

## The Difference

**Enabling APIs** ✅ - You've done this (Gmail API, Calendar API are enabled)
**Adding Scopes to Consent Screen** ❌ - This is what you still need to do

## Step-by-Step Instructions

1. **Go to OAuth Consent Screen:**
   - Open [Google Cloud Console](https://console.cloud.google.com/)
   - Select your project
   - Go to **APIs & Services** → **OAuth consent screen**

2. **Edit Your App:**
   - Click **EDIT APP** (or configure if it's your first time)

3. **Add Scopes:**
   - Scroll down to the **"Scopes"** section
   - Click **"ADD OR REMOVE SCOPES"**
   - You'll see a list of scopes
   - **Search for and ADD these:**
     - `https://www.googleapis.com/auth/gmail.send` (search for "gmail.send")
     - `https://www.googleapis.com/auth/calendar.events` (search for "calendar.events")
   - Click **UPDATE**
   - Click **SAVE AND CONTINUE**

4. **If Your App is in Testing Mode:**
   - Go to **Test users** tab
   - Add your email: `sg.suriya.c@gmail.com`
   - Save

5. **Publish (if needed):**
   - If your app is in "Testing" mode, you can only test with yourself
   - For production, you'll need to submit for verification

## Visual Guide

The OAuth consent screen scopes section looks like this:
```
Scopes
[ADD OR REMOVE SCOPES button]

Currently selected scopes:
✓ .../auth/userinfo.email
✓ .../auth/userinfo.profile
✓ .../auth/openid

[You need to add:]
✓ .../auth/gmail.send        ← ADD THIS
✓ .../auth/calendar.events   ← ADD THIS
```

## After Adding Scopes

1. Sign out from your app
2. Clear cookies
3. Sign back in with Google
4. **Check the consent screen** - it should now show:
   - "Send email on your behalf"
   - "View your calendars"
5. Grant all permissions
6. Try clicking "Restart" on the cadence

The key is: **Enabling APIs ≠ Adding Scopes**. You need BOTH!





