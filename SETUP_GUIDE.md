# Complete Setup Guide for Cadence Blocks

## Step 1: Google Cloud Console Setup

### 1.1 Enable APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing one
3. Enable these APIs:
   - **Gmail API** (for email sending)
   - **Google Calendar API** (for calendar invites)
   - **Google+ API** (for OAuth)

### 1.2 Create OAuth 2.0 Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Configure consent screen if needed:
   - User type: External
   - App name: AI CRM
   - User support email: your email
   - Scopes: Add these manually:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Test users: Add your email
4. Create OAuth client:
   - Application type: **Web application**
   - Name: AI CRM
   - Authorized redirect URIs:
     - `http://localhost:3000/auth/callback` (dev)
     - `https://your-domain.com/auth/callback` (prod)
   - Click **Create**
5. Copy **Client ID** and **Client Secret**

### 1.3 Configure Supabase OAuth
1. Go to your Supabase Dashboard
2. **Authentication** → **Providers** → **Google**
3. Enable Google provider
4. Add:
   - **Client ID**: (from step 1.2)
   - **Client Secret**: (from step 1.2)
5. Save

## Step 2: VAPI Setup (for Voicemail)

1. Go to [VAPI.ai](https://vapi.ai)
2. Sign up/login
3. Get your API key from dashboard
4. Add to environment variables (see Step 3)

## Step 3: Environment Variables

Create/update `.env.local`:

```bash
# Supabase (you probably already have these)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google OAuth (for Gmail & Calendar APIs)
GOOGLE_CLIENT_ID=your_client_id_from_step_1.2
GOOGLE_CLIENT_SECRET=your_client_secret_from_step_1.2
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_from_step_1.2

# Optional: Site URL for production
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# VAPI (for voicemail)
VAPI_API_KEY=your_vapi_api_key
VAPI_API_URL=https://api.vapi.ai/api/v1
```

## Step 4: Update OAuth Flow to Store Tokens

The OAuth callback needs to be updated to store tokens in `user_sessions` table. This will be done next.

## Step 5: Test It

1. Sign in with Google (grant Gmail/Calendar permissions)
2. Create a cadence with email blocks
3. Add a company with email address
4. Click "Start Workflow"
5. Check your Gmail - emails should be sent!

