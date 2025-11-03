# IMPORTANT: Direct Google OAuth Setup

## What Changed
Since Supabase doesn't have a scopes field in the dashboard, I've implemented **direct Google OAuth** that bypasses Supabase's OAuth handling. This ensures we get the exact scopes we need (`gmail.send`, `calendar.events`).

## Setup Steps

### 1. Add Redirect URI to Google Cloud Console

Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → Your OAuth 2.0 Client ID

Add this redirect URI:
```
http://localhost:3000/auth/google-callback
```

(For production, add your production URL too)

### 2. Make Sure NEXT_PUBLIC_GOOGLE_CLIENT_ID is Set

Check your `.env.local` file has:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=596257325103-thbptrfg24bnbe4k66p99o1jh1s0jl8l.apps.googleusercontent.com
```

### 3. Configure Scopes in Google Cloud Console

Go to **OAuth Consent Screen** → **Scopes** → **ADD OR REMOVE SCOPES** and add:
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/calendar.events`

### 4. Test It

1. Sign out completely
2. Go to `/auth/signin`
3. Click "Continue with Google"
4. You should see Google's consent screen with "Send email on your behalf"
5. Grant all permissions
6. Try clicking "Restart" on the cadence

## How It Works

1. **Sign-in button** calls `signInWithGoogleDirect()` which redirects directly to Google (bypassing Supabase)
2. **Google callback** (`/auth/google-callback`) receives tokens with correct scopes
3. **Callback handler** signs you into Supabase using `signInWithIdToken` for user management
4. **Tokens are stored** in `user_sessions` table with the correct scopes
5. **Gmail API** uses these tokens to send emails

This way, Supabase handles user management, but we get Google tokens directly with the scopes we need!





