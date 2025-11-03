# Quick Deploy & Connect Guide

## Step 1: Deploy to Vercel (5 minutes)

1. **Go to Vercel**: https://vercel.com
2. **Sign in** with GitHub
3. **Click "Add New Project"**
4. **Import your repo**: `gsuriya/ai-crm`
5. **Add Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://vcecetcumnreuzojtqin.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your anon key from Supabase)
6. **Click "Deploy"**
7. **Wait 2-3 minutes** for deployment
8. **Copy your deployment URL**: `https://your-app-name.vercel.app`

---

## Step 2: Update OAuth Redirect URIs

### Google Cloud Console:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Add to **Authorized redirect URIs**:
   - `https://YOUR_VERCEL_URL/auth/callback`
   - Example: `https://ai-crm-123.vercel.app/auth/callback`
4. Add to **Authorized JavaScript origins**:
   - `https://YOUR_VERCEL_URL`
5. Click **Save**

### Supabase:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add **Site URL**: `https://YOUR_VERCEL_URL`
3. Add **Redirect URLs**: `https://YOUR_VERCEL_URL/auth/callback`
4. Save

---

## Step 3: Add Button in Framer

**In your Framer site:**

1. **Add a Button**:
   - Go to Elements → Forms → Button (or just add a text frame)
   - Style it however you want

2. **Add Link**:
   - Select the button/text
   - In the properties panel, find "Link" field
   - Enter: `https://YOUR_VERCEL_URL/auth/signin`
   - Or: `https://YOUR_VERCEL_URL` (will auto-redirect if not signed in)

3. **Test**:
   - Click the button in preview
   - Should redirect to your CRM sign-in page

---

## Done! 🎉

Your flow:
- Framer site → Button → CRM Sign-in → Google OAuth → CRM Dashboard

---

## Optional: Custom Domain

If you want `app.yourcompany.com`:

1. In Vercel: Settings → Domains → Add Domain
2. Add DNS record: `CNAME` → `app` → `cname.vercel-dns.com`
3. Update Google Cloud redirect URIs with new domain
4. Update Supabase URLs with new domain
5. Update Framer button link







