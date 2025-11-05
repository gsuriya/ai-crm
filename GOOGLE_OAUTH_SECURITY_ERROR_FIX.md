# Fix: "This browser or app may not be secure" Error

## Why This Error Happens

Google shows this error when:
1. **OAuth Consent Screen is in "Testing" mode** and your email is not in the test users list
2. **The app is not verified** for production use (required for sensitive scopes like Gmail/Calendar)
3. **The redirect URI is not properly configured** in Google Cloud Console

## Solution: Configure OAuth Consent Screen

### Step 1: Go to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **OAuth consent screen**

### Step 2: Configure User Type

**Option A: Testing Mode (Quick Fix for Development)**

1. Set **User Type** to **"Testing"**
2. Fill in required fields:
   - **App name**: AI CRM (or your app name)
   - **User support email**: Your email
   - **Developer contact information**: Your email
3. Click **Save and Continue**

4. **Add Test Users** (CRITICAL):
   - On the "Test users" page, click **"ADD USERS"**
   - Add your Google account email address
   - Add any other emails that need to test the app
   - Click **Save**

5. **Add Scopes**:
   - Click **"ADD OR REMOVE SCOPES"**
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/calendar`
   - Click **Update** → **Save and Continue**

6. Click **"Back to Dashboard"**

**Important**: In Testing mode, **only** the test users you added can sign in. Make sure your email is in the list!

### Option B: Publish App (For Production)

1. Complete all the steps above
2. Go to **OAuth consent screen** → **PUBLISH APP**
3. Note: For sensitive scopes (Gmail, Calendar), Google requires app verification which can take several days/weeks

### Step 3: Verify Redirect URI

1. Go to **APIs & Services** → **Credentials**
2. Click on your **OAuth 2.0 Client ID**
3. Under **Authorized redirect URIs**, make sure you have:
   ```
   http://localhost:3000/auth/google-callback
   ```
4. Click **Save**

### Step 4: Check Environment Variables

Make sure your `.env.local` file has:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### Step 5: Restart Your App

After making changes:
1. Kill your dev server
2. Restart it: `npm run dev`
3. Try signing in again

## Common Issues

### Issue: "Error 403: access_denied"
- **Cause**: Your email is not in the test users list
- **Fix**: Add your email to test users in OAuth consent screen

### Issue: "redirect_uri_mismatch"
- **Cause**: The redirect URI in your code doesn't match Google Cloud Console
- **Fix**: Make sure `http://localhost:3000/auth/google-callback` is in Authorized redirect URIs

### Issue: Still seeing the error after adding test users
- **Cause**: You might be using a different Google account
- **Fix**: Make sure you're signing in with the same email you added as a test user

## Quick Checklist

- [ ] OAuth consent screen is configured (App name, support email)
- [ ] Your email is added to "Test users" list
- [ ] Required scopes are added (gmail.send, calendar, etc.)
- [ ] Redirect URI `http://localhost:3000/auth/google-callback` is in Authorized redirect URIs
- [ ] Environment variables are set correctly
- [ ] App is restarted after changes

## Testing

After configuration:
1. Go to `http://localhost:3000/auth/signin`
2. Click "Continue with Google"
3. You should see the consent screen (not the security error)
4. Grant permissions
5. You should be redirected back to the app

If you still see the error, double-check that:
- You're using the same Google account email that's in the test users list
- The OAuth consent screen is saved (not just in draft)
- The redirect URI matches exactly

