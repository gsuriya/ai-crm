# Fix "This browser or app may not be secure" - Step by Step

## 🔍 Step-by-Step Fix

### Step 1: Open Google Cloud Console
**Direct link**: https://console.cloud.google.com/apis/credentials/consent

**OR navigate manually:**
1. Go to https://console.cloud.google.com/
2. Select your project (the one with Client ID: `596257325103-thbptrfg24bnbe4k66p99o1jh1s0jl8l`)
3. Click **APIs & Services** in the left sidebar
4. Click **OAuth consent screen**

### Step 2: Check User Type
**Important**: Make sure it says **"Testing"** (not "Production")

If it says "Production":
- You need to publish the app (which requires verification)
- OR switch back to "Testing" mode

### Step 3: Add Test User (CRITICAL)
1. Click **"EDIT APP"** button (top right)
2. Scroll down to **"Test users"** section
3. Click **"+ ADD USERS"** button
4. In the popup, type: `ethanzzheng@gmail.com`
5. Click **"ADD"**
6. Click **"SAVE"** at the bottom of the page

**⚠️ IMPORTANT**: You MUST click "SAVE" at the bottom of the page! Just adding the email isn't enough.

### Step 4: Verify It's Saved
- Go back to the OAuth consent screen
- Scroll to "Test users" section
- You should see `ethanzzheng@gmail.com` listed
- If you don't see it, repeat Step 3 and make sure to click "SAVE"

### Step 5: Check Scopes
While you're editing:
1. Go to **"Scopes"** tab
2. Click **"ADD OR REMOVE SCOPES"**
3. Make sure these are added:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `openid`
4. Click **"UPDATE"** then **"SAVE"**

### Step 6: Verify Redirect URI
1. Go to **APIs & Services** → **Credentials**
2. Click on your **OAuth 2.0 Client ID** (the one starting with `596257325103-...`)
3. Under **"Authorized redirect URIs"**, make sure this is listed:
   ```
   http://localhost:3000/auth/google-callback
   ```
4. Click **"SAVE"** if you made changes

### Step 7: Clear Browser Cache
Sometimes Google caches the error. Try:
1. Open a **new incognito/private window**
2. Go to `http://localhost:3000/auth/signin`
3. Click "Continue with Google"

### Step 8: Verify You're Using the Right Email
**Make sure**: You're signing in with **exactly** `ethanzzheng@gmail.com` (the one you added as a test user)

If you have multiple Google accounts:
- Sign out of all Google accounts
- Go to `http://localhost:3000/auth/signin`
- Click "Continue with Google"
- **Choose** `ethanzzheng@gmail.com` when prompted

## 🐛 Common Mistakes

1. **Not clicking "SAVE"** - Just adding the email isn't enough, you must save
2. **Wrong email** - Make sure you're signing in with the exact email you added
3. **Wrong Google account** - Make sure you're selecting the right account when signing in
4. **App in Production mode** - Should be in "Testing" mode for development
5. **Browser cache** - Try incognito mode or clear cache

## ✅ Verify It's Fixed

After following all steps:
1. Go to `http://localhost:3000/auth/signin`
2. Click "Continue with Google"
3. You should see: **"Google wants to access your Google Account"** consent screen
4. NOT: "This browser or app may not be secure" error

## 🆘 Still Not Working?

If you've done all of the above and it still doesn't work:

1. **Take a screenshot** of:
   - The OAuth consent screen showing test users
   - The error message you're seeing

2. **Check**:
   - Are you in the correct Google Cloud project?
   - Is the Client ID matching? (should start with `596257325103-`)
   - Did you click "SAVE" after adding test users?

3. **Try**:
   - Sign out completely from Google
   - Clear browser cache
   - Try a different browser (Chrome, Firefox, Safari)
   - Try incognito/private mode

