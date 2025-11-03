# Connecting Your CRM to Framer Website

## Overview

You have two main options for connecting your Framer site to your CRM:

### Option 1: Subdomain (Recommended) ⭐
- **Framer site**: `yourcompany.com` (main marketing site)
- **CRM app**: `app.yourcompany.com` or `crm.yourcompany.com`
- **Best for**: Clean separation, professional look

### Option 2: Path-based
- **Framer site**: `yourcompany.com`
- **CRM app**: `yourcompany.com/app` or `yourcompany.com/crm`
- **Best for**: Single domain, simpler setup

---

## Step-by-Step Guide

### 1. Deploy Your Next.js App

**Option A: Vercel (Easiest - Recommended)**

1. **Push your code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - Deploy!

3. **Get your Vercel URL**
   - After deployment, you'll get: `https://your-app-name.vercel.app`
   - Or add a custom domain: `app.yourcompany.com`

**Option B: Other Hosting**
- Netlify, Railway, Render, etc. all work similarly
- Just add the environment variables and deploy

---

### 2. Update Google Cloud Console Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, add:
   - `https://YOUR_DEPLOYED_DOMAIN/auth/callback`
   - Example: `https://app.yourcompany.com/auth/callback`
   - Or: `https://your-app-name.vercel.app/auth/callback`
5. Under **Authorized JavaScript origins**, add:
   - `https://YOUR_DEPLOYED_DOMAIN`
   - Example: `https://app.yourcompany.com`
6. Click **Save**

---

### 3. Update Supabase URL Configuration

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Add your production URLs:
   - **Site URL**: `https://YOUR_DEPLOYED_DOMAIN`
   - **Redirect URLs**: 
     - `https://YOUR_DEPLOYED_DOMAIN/auth/callback`
     - `http://localhost:3000/auth/callback` (keep for dev)

---

### 4. Add Button in Framer

**In your Framer site:**

1. Add a button or link element
2. Set the text: "Open CRM" or "Sign In"
3. Link to: `https://YOUR_DEPLOYED_DOMAIN` or `https://YOUR_DEPLOYED_DOMAIN/auth/signin`
4. Style it however you want!

**Example button code in Framer:**
- Button text: "Open CRM"
- Link: `https://app.yourcompany.com`
- Or: `https://your-app-name.vercel.app`

---

### 5. Custom Domain Setup (Optional but Recommended)

**If using Vercel:**

1. In Vercel dashboard, go to your project → **Settings** → **Domains**
2. Add your custom domain: `app.yourcompany.com`
3. Add DNS records:
   - Type: `CNAME`
   - Name: `app` (or `crm`)
   - Value: `cname.vercel-dns.com`
4. Wait for DNS propagation (5-60 minutes)

**Then update:**
- Google Cloud Console redirect URIs
- Supabase URL configuration
- Framer button link

---

## Quick Checklist

- [ ] Deploy Next.js app to Vercel/hosting
- [ ] Add environment variables (Supabase URL & key)
- [ ] Update Google Cloud Console redirect URIs
- [ ] Update Supabase URL configuration
- [ ] Add "Open CRM" button in Framer
- [ ] Test the full flow: Framer → Sign In → CRM

---

## User Flow

1. User visits `yourcompany.com` (Framer site)
2. User clicks "Open CRM" button
3. Redirects to `app.yourcompany.com/auth/signin`
4. User signs in with Google
5. Redirects to `app.yourcompany.com/companies`
6. User can now use the CRM!

---

## Environment Variables Needed

Make sure these are set in your hosting platform:

```
NEXT_PUBLIC_SUPABASE_URL=https://vcecetcumnreuzojtqin.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Need Help?

If you run into issues:
- Check browser console for errors
- Verify environment variables are set
- Make sure redirect URIs match exactly
- Check Supabase logs for auth errors







