# EXACT STEPS TO FIX WEBHOOK - DO THIS NOW

## Your Current Situation:
- ✅ Calls ARE being logged to database
- ✅ Calls ARE completing in VAPI
- ❌ Webhook is NOT configured, so transcriptions/notes aren't auto-updating

---

## OPTION 1: If Your App is Deployed (Vercel, etc.)

### Step 1: Find Your Deployed URL
- Go to your hosting (Vercel dashboard, etc.)
- Copy your app URL (should be something like `https://your-app-name.vercel.app`)
- **Write it down**: `https://_____________________________`

### Step 2: Configure Webhook in VAPI Dashboard
1. Go to: https://dashboard.vapi.ai
2. Sign in
3. Click **Settings** (or gear icon)
4. Click **Webhooks** (or "Webhooks" in sidebar)
5. Click **Add Webhook** or **Create Webhook**
6. Enter:
   - **Name**: "Call Webhook" (or anything you want)
   - **URL**: `https://YOUR_DEPLOYED_URL/api/vapi/webhook`
     - Example: `https://your-app-name.vercel.app/api/vapi/webhook`
   - **Events to receive** (check these boxes):
     - ✅ `call-status-update` (or `status-update`)
     - ✅ `call-ended` 
     - ✅ `transcription-complete` (or `call-transcription`)
7. Click **Save** or **Create**

### Step 3: Test It
1. Make a test call from your app
2. Wait for call to complete
3. Run this to check if it worked:
   ```bash
   npx tsx scripts/check-recent-calls.ts
   ```
4. If transcription/notes appear automatically = ✅ WORKING!

---

## OPTION 2: If Running Locally (Localhost Only)

### Step 1: Install & Setup ngrok (Creates Public URL for Localhost)

**Install ngrok:**
```bash
# On Mac:
brew install ngrok

# Or download from: https://ngrok.com/download
```

**Start ngrok:**
1. Open a NEW terminal window (keep your dev server running)
2. Run:
   ```bash
   ngrok http 3000
   ```
3. Copy the HTTPS URL it gives you (looks like `https://abc123.ngrok.io`)
4. **Write it down**: `https://_____________________________`

### Step 2: Keep ngrok Running
- **DON'T CLOSE the ngrok terminal window**
- Keep it running while you test

### Step 3: Configure Webhook in VAPI Dashboard
1. Go to: https://dashboard.vapi.ai
2. Sign in
3. Click **Settings** → **Webhooks**
4. Click **Add Webhook**
5. Enter:
   - **Name**: "Call Webhook"
   - **URL**: `https://YOUR_NGROK_URL/api/vapi/webhook`
     - Example: `https://abc123.ngrok.io/api/vapi/webhook`
   - **Events to receive**:
     - ✅ `call-status-update`
     - ✅ `call-ended`
     - ✅ `transcription-complete`
6. Click **Save**

### Step 4: Test It
1. Make a test call from your app
2. Wait for call to complete
3. Run:
   ```bash
   npx tsx scripts/check-recent-calls.ts
   ```
4. If transcription/notes appear automatically = ✅ WORKING!

---

## If Webhook Still Doesn't Work

### Manual Sync (Backup Solution)
You can always manually sync missing calls:
```bash
npx tsx scripts/sync-call-data.ts
```

This fetches data from VAPI and updates your database.

---

## Quick Checklist

- [ ] Got public URL (deployed OR ngrok)
- [ ] Went to VAPI Dashboard → Settings → Webhooks
- [ ] Added webhook URL: `https://YOUR_URL/api/vapi/webhook`
- [ ] Selected events: `call-status-update`, `call-ended`, `transcription-complete`
- [ ] Saved webhook
- [ ] Made test call
- [ ] Checked if transcription appeared automatically

---

## Need Help?

**Check if webhook is receiving calls:**
- Look at your server logs when a call completes
- Should see: `[VAPI Webhook] Received event: ...`

**Verify URL is correct:**
- Test the URL in browser: `https://YOUR_URL/api/vapi/webhook`
- Should see a JSON response (even if it says "No call ID")

**Common Issues:**
- ❌ Forgot to select events in VAPI → Select all 3 events
- ❌ Wrong URL → Check it ends with `/api/vapi/webhook`
- ❌ ngrok closed → Keep ngrok terminal window open
- ❌ Server not running → Run `npm run dev`

