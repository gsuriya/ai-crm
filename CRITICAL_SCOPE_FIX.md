# CRITICAL: Supabase Google OAuth Scope Configuration

## The Problem
Supabase is NOT forwarding scopes from code to Google. Even though we request `gmail.send` in code, Google never receives it.

## The Solution

### Step 1: Configure Scopes in Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Providers** → **Google**
4. **LOOK FOR A "SCOPES" FIELD** - it might be:
   - Under "Additional OAuth Scopes"
   - In "Advanced Settings"
   - In "Provider Configuration"
   - Or might not exist at all (in which case Supabase doesn't support custom scopes)

5. If the field exists, add:
   ```
   openid profile email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.events
   ```

6. Save changes

### Step 2: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** → **OAuth consent screen**
4. Click **EDIT APP**
5. Scroll to **Scopes** → Click **ADD OR REMOVE SCOPES**
6. Add these scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
7. Click **UPDATE** then **SAVE AND CONTINUE**

### Step 3: If App is in Testing Mode

1. Go to **OAuth consent screen** → **Test users**
2. Add your email: `sg.suriya.c@gmail.com`
3. Save

### Step 4: Re-authenticate

1. Sign out completely from your app
2. Clear ALL cookies for `localhost:3000`
3. Sign back in with Google
4. **CAREFULLY CHECK** the Google consent screen - it MUST show:
   - "Send email on your behalf"
   - "View your calendars"
5. **GRANT ALL PERMISSIONS**
6. Try clicking "Restart" again

## If Supabase Dashboard Doesn't Have Scopes Field

If Supabase doesn't have a scopes field, Supabase's Google OAuth provider may not support custom scopes. In that case, we'll need to:

1. Use direct Google OAuth (bypassing Supabase)
2. OR contact Supabase support
3. OR use Supabase's `signInWithIdToken` with a custom Google OAuth flow

Let me know if you can't find the scopes field in Supabase dashboard!





