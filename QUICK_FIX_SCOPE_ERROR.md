# Quick Fix: Google OAuth Scope Error

## You're seeing this error because:
Your Google OAuth token doesn't have the `gmail.send` scope needed to send emails.

## Quick Fix Steps:

### Step 1: Sign Out Completely
1. Click "Sign Out" in the sidebar (or use the error modal's OK button)
2. This will sign you out and redirect to the sign-in page

### Step 2: Revoke Old App Permissions (Important!)
1. Go to: https://myaccount.google.com/permissions
2. Find your app (might be listed as your Google Cloud project name)
3. Click "Remove" or "Revoke access"
4. This ensures you'll get fresh permissions on next sign-in

### Step 3: Verify Google Cloud Console Configuration
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Select your project
3. Click **EDIT APP**
4. Scroll to **Scopes** section
5. Click **ADD OR REMOVE SCOPES**
6. Make sure these scopes are added:
   - ✅ `https://www.googleapis.com/auth/gmail.send`
   - ✅ `https://www.googleapis.com/auth/calendar.events`
   - ✅ `https://www.googleapis.com/auth/userinfo.email`
   - ✅ `https://www.googleapis.com/auth/userinfo.profile`
7. Click **UPDATE** then **SAVE AND CONTINUE**

### Step 4: Check Test Users (if app is in Testing mode)
1. In OAuth consent screen, go to **Test users** tab
2. Make sure your email is listed as a test user
3. Add it if it's missing

### Step 5: Sign Back In
1. Go back to your app at `localhost:3000`
2. Click "Continue with Google"
3. **CRITICALLY IMPORTANT**: On the Google consent screen, carefully check:
   - ✅ You should see "Send email on your behalf" permission
   - ✅ You should see "View your calendars" permission
   - ✅ Make sure you click "Allow" for ALL permissions
4. Complete the sign-in

### Step 6: Verify Scopes Were Granted
1. After signing in, go to: `http://localhost:3000/api/auth/check-scopes`
2. You should see:
   ```json
   {
     "hasGmailSend": true,
     "actualScopesFromGoogle": [
       "https://www.googleapis.com/auth/gmail.send",
       "https://www.googleapis.com/auth/calendar.events",
       ...
     ]
   }
   ```

### Step 7: Try Restarting Your Cadence Again
1. Go back to your company page
2. Click "Restart" on your cadence
3. It should work now! ✅

## If It Still Doesn't Work:

1. **Check the consent screen carefully** - Sometimes Google groups permissions and you need to expand them
2. **Clear all browser cookies** for localhost:3000
3. **Try incognito mode** to ensure no cached tokens
4. **Check browser console** for any additional error messages

## Common Issues:

- **"I don't see the permissions on consent screen"** → Scopes aren't added to OAuth consent screen in Google Cloud Console
- **"Permission shows but workflow still fails"** → Token might be cached, try clearing cookies
- **"App needs verification"** → Keep app in Testing mode and add yourself as test user

