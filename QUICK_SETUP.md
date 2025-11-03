# Quick Setup Checklist

## ✅ What You Need to Do:

### 1. Google Cloud Console (5 minutes)
- [ ] Go to https://console.cloud.google.com/
- [ ] Enable **Gmail API** and **Google Calendar API**
- [ ] Create OAuth 2.0 Client ID
- [ ] Add redirect URI: `http://localhost:3000/auth/callback`
- [ ] Copy Client ID and Client Secret

### 2. Supabase Dashboard (2 minutes)
- [ ] Go to your Supabase project
- [ ] Enable Google provider in Authentication → Providers
- [ ] Add Client ID and Client Secret from step 1

### 3. Environment Variables (1 minute)
- [ ] Add to `.env.local`:
  ```
  GOOGLE_CLIENT_ID=your_client_id
  GOOGLE_CLIENT_SECRET=your_client_secret
  NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
  VAPI_API_KEY=your_vapi_key (optional, for voicemail)
  ```

### 4. Test (2 minutes)
- [ ] Sign in with Google
- [ ] Grant Gmail/Calendar permissions
- [ ] Create a cadence with email block
- [ ] Add company with email address
- [ ] Click "Start Workflow"

## 🎯 That's It!

The code is already updated to:
- Request Gmail/Calendar scopes during sign-in
- Store OAuth tokens in `user_sessions` table
- Use those tokens to send emails and calendar invites

See `SETUP_GUIDE.md` for detailed instructions.

