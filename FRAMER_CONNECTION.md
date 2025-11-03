# Connect Framer Button to Your CRM

## Step 1: Deploy Your App (if not already deployed)

**Option A: Deploy via Vercel Dashboard (Easiest)**
1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "Add New Project"
4. Import: `gsuriya/ai-crm`
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vcecetcumnreuzojtqin.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (get from Supabase Dashboard)
6. Click "Deploy"
7. Copy your URL: `https://your-app-name.vercel.app`

**Option B: Deploy via CLI (Faster)**
```bash
# Login to Vercel
vercel login

# Deploy (will prompt for env vars)
vercel

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Step 2: Update OAuth Redirect URIs

Once you have your Vercel URL:

1. **Google Cloud Console**:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click your OAuth Client ID
   - Add to **Authorized redirect URIs**: `https://YOUR_VERCEL_URL/auth/callback`
   - Add to **Authorized JavaScript origins**: `https://YOUR_VERCEL_URL`
   - Save

2. **Supabase**:
   - Dashboard → Authentication → URL Configuration
   - Add **Site URL**: `https://YOUR_VERCEL_URL`
   - Add **Redirect URLs**: `https://YOUR_VERCEL_URL/auth/callback`
   - Save

---

## Step 3: Link Button in Framer

**In your Framer project:**

1. **Select the "Download for Mac" button** (or whichever button you want)

2. **Open the Properties Panel** (right sidebar)

3. **Find the "Link" section**:
   - Look for "Link To" field
   - Or find "Link" in the properties panel

4. **Enter your CRM URL**:
   - For sign-in page: `https://YOUR_VERCEL_URL/auth/signin`
   - Or main page: `https://YOUR_VERCEL_URL` (will auto-redirect if not signed in)

5. **Test it**:
   - Click "Preview" in Framer
   - Click your button
   - Should redirect to your CRM sign-in page

---

## What Happens Next?

When users click the button:
1. → Redirects to your CRM sign-in page
2. → User clicks "Continue with Google"
3. → Google OAuth flow
4. → Redirects back to CRM dashboard (`/companies`)

---

## Pro Tip: Change Button Text

You might want to change the button text to something like:
- "Open CRM"
- "Sign In"
- "Get Started"
- "Launch App"

Just double-click the button text in Framer to edit it!







