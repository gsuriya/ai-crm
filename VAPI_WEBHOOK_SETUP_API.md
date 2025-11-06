# VAPI Webhook Setup via API (Updated Instructions)

## ⚠️ Important: VAPI Removed Webhook UI

VAPI has removed the webhook configuration from their dashboard UI. You now need to set up webhooks via **API only**.

---

## 🚀 Quick Setup (Easiest Method)

### Step 1: Get Your Webhook URL

**If running locally:**
1. Install ngrok: `brew install ngrok`
2. Start ngrok: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Your webhook URL: `https://abc123.ngrok.io/api/vapi/webhook`

**If deployed:**
- Your webhook URL: `https://your-app.vercel.app/api/vapi/webhook`

### Step 2: Run the Setup Script

```bash
npx tsx scripts/setup-vapi-webhook.ts https://YOUR_WEBHOOK_URL
```

Example:
```bash
npx tsx scripts/setup-vapi-webhook.ts https://abc123.ngrok.io/api/vapi/webhook
```

That's it! The script will configure the webhook automatically.

---

## 🔧 Alternative Methods (If Script Doesn't Work)

### Method 1: VAPI CLI (Recommended)

1. **Install VAPI CLI:**
   ```bash
   curl -sSL https://vapi.ai/install.sh | bash
   ```

2. **Login:**
   ```bash
   vapi login
   ```
   (Opens browser for authentication)

3. **Set Webhook:**
   ```bash
   vapi assistant update --id YOUR_ASSISTANT_ID --server-url YOUR_WEBHOOK_URL
   ```
   
   Example:
   ```bash
   vapi assistant update --id 3573b8dd-f031-4338-8cef-f8cc548dc415 --server-url https://abc123.ngrok.io/api/vapi/webhook
   ```

4. **Verify:**
   ```bash
   vapi assistant get --id YOUR_ASSISTANT_ID
   ```
   Check the `serverUrl` field in the output.

---

### Method 2: Direct API Call (curl)

```bash
curl -X PATCH https://api.vapi.ai/assistant \
  -H "Authorization: Bearer YOUR_VAPI_PRIVATE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "YOUR_ASSISTANT_ID",
    "serverUrl": "YOUR_WEBHOOK_URL"
  }'
```

Replace:
- `YOUR_VAPI_PRIVATE_KEY` - From `.env.local` (VAPI_PRIVATE_KEY)
- `YOUR_ASSISTANT_ID` - From `.env.local` (VAPI_ASSISTANT_ID)
- `YOUR_WEBHOOK_URL` - Your webhook URL

Example:
```bash
curl -X PATCH https://api.vapi.ai/assistant \
  -H "Authorization: Bearer ef5d706e-c7a3-43b2-a535-4b6f1ee3ea50" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "3573b8dd-f031-4338-8cef-f8cc548dc415",
    "serverUrl": "https://abc123.ngrok.io/api/vapi/webhook"
  }'
```

---

### Method 3: Using Node.js Script

Create a file `setup-webhook.js`:

```javascript
const fetch = require('node-fetch');

const VAPI_PRIVATE_KEY = 'YOUR_VAPI_PRIVATE_KEY';
const ASSISTANT_ID = 'YOUR_ASSISTANT_ID';
const WEBHOOK_URL = 'YOUR_WEBHOOK_URL';

async function setupWebhook() {
  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: ASSISTANT_ID,
      serverUrl: WEBHOOK_URL,
    }),
  });

  const result = await response.json();
  console.log('Result:', result);
}

setupWebhook();
```

Run: `node setup-webhook.js`

---

## ✅ Verify Webhook is Working

1. **Make a test call** from your app
2. **Wait ~30 seconds** for call to complete
3. **Check if webhook received data:**
   ```bash
   npx tsx scripts/check-recent-calls.ts
   ```
4. **If transcription/notes appear automatically** = ✅ WORKING!

---

## 🐛 Troubleshooting

### Webhook Not Receiving Calls?

1. **Check webhook URL is accessible:**
   - Open in browser: `https://YOUR_URL/api/vapi/webhook`
   - Should see JSON response (even if error)

2. **Check server logs:**
   - When call completes, look for: `[VAPI Webhook] Received event: ...`
   - If no logs = webhook not configured correctly

3. **Verify assistant has serverUrl:**
   ```bash
   vapi assistant get --id YOUR_ASSISTANT_ID
   ```
   Check `serverUrl` field matches your webhook URL

4. **Test webhook manually:**
   ```bash
   curl -X POST https://YOUR_WEBHOOK_URL \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

### Still Not Working?

Use manual sync as backup:
```bash
npx tsx scripts/sync-call-data.ts
```

---

## 📋 Quick Checklist

- [ ] Got webhook URL (ngrok or deployed)
- [ ] Ran setup script OR used CLI/API
- [ ] Verified webhook URL is accessible
- [ ] Made test call
- [ ] Checked if transcription appeared automatically

---

## 💡 Notes

- **Keep ngrok running** if using localhost (don't close terminal)
- **Webhook URL must be HTTPS** (ngrok provides this)
- **Webhook endpoint** must be: `/api/vapi/webhook`
- **VAPI sends webhooks** when calls end or transcription completes

