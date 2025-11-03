# Configure Google OAuth in Supabase

## Your Credentials:

**Client ID:**
```
YOUR_CLIENT_ID_HERE
```

**Client Secret:**
```
YOUR_CLIENT_SECRET_HERE
```

## Steps to Configure in Supabase:

1. **Go to your Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication → Providers**
   - Click "Authentication" in the left sidebar
   - Click "Providers" tab

3. **Enable Google Provider**
   - Find "Google" in the list of providers
   - Toggle it ON

4. **Add Your Credentials**
   - **Client ID (for Google OAuth):** Enter your Google OAuth Client ID
   - **Client Secret (for Google OAuth):** Enter your Google OAuth Client Secret

5. **Redirect URL** (already configured in Google Cloud)
   - Supabase will automatically use: `https://your-project-ref.supabase.co/auth/v1/callback`
   - Make sure this URL is added to your Google Cloud Console redirect URIs if needed
   - Actually, Supabase handles the redirect internally, so you might not need to add it

6. **Click "Save"**

## Test It:

1. Start your dev server: `npm run dev`
2. Go to `http://localhost:3000`
3. You should be redirected to `/auth/signin`
4. Click "Continue with Google"
5. Complete the Google sign-in flow
6. You should be redirected back to `/companies`

## Notes:

- The redirect URIs in Google Cloud Console are:
  - `http://localhost:3000/auth/callback` (dev)
  - `https://app.mycrm.com/auth/callback` (prod)
- Supabase will handle the OAuth flow and redirect to your app
- Make sure your Supabase project URL is set in `.env.local`

