## OAuth Setup Instructions

### 1. Configure Google OAuth in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Google** provider
4. Add your Google OAuth credentials:
   - **Client ID** (from Google Cloud Console)
   - **Client Secret** (from Google Cloud Console)
5. Add redirect URL: `https://your-domain.com/auth/callback`

### 2. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google+ API**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure consent screen if needed
6. Create OAuth client:
   - **Application type**: Web application
   - **Authorized redirect URIs**: 
     - `http://localhost:3000/auth/callback` (for dev)
     - `https://your-domain.com/auth/callback` (for prod)
7. Copy **Client ID** and **Client Secret**

### 3. Set Environment Variables

Add to your `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Integration with Framer Site

**Option A: Subdomain (Recommended)**
- Framer site: `yourcompany.com`
- CRM app: `app.yourcompany.com` or `crm.yourcompany.com`
- Add button in Framer: Link to `https://app.yourcompany.com`

**Option B: Path-based**
- Framer site: `yourcompany.com`
- CRM app: `yourcompany.com/app`
- Add button in Framer: Link to `https://yourcompany.com/app`

### 5. Flow

1. User clicks "Open CRM" on Framer site
2. Redirects to `/auth/signin`
3. User clicks "Continue with Google"
4. Google OAuth flow
5. Redirects to `/auth/callback` → then to `/companies`
6. User is now authenticated and can use the CRM

### Files Created:
- `lib/auth.ts` - Auth utility functions
- `app/auth/signin/page.tsx` - Sign-in page
- `app/auth/callback/route.ts` - OAuth callback handler
- `components/auth-guard.tsx` - Route protection
- `components/sidebar.tsx` - Added sign-out button

