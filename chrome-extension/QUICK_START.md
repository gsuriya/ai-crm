# LinkedIn CRM Extension - Quick Start 🚀

## For New Users - Setup Instructions

### Step 1: Get the Extension Files
1. Download or copy the `chrome-extension` folder to your computer

### Step 2: Configure the Extension

**Open `background.js` and update these values:**

```javascript
// Line ~10 - Add your Hunter.io API key (get one at https://hunter.io/api - free tier available)
const HUNTER_API_KEY = 'your_hunter_api_key_here';

// Line ~14 - Update to your CRM URL (ask your admin for this)
const CRM_API_URL = 'https://your-crm-app.vercel.app/api';
```

### Step 3: Load the Extension in Chrome
1. Open Chrome → go to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder
5. Done! ✅

### Step 4: Log Into Your CRM
**IMPORTANT:** You must be logged into the CRM website first!
1. Go to your CRM URL (e.g., `https://your-crm-app.vercel.app`)
2. Sign in with Google
3. Keep this tab open or make sure you're logged in

---

## Usage

### On Any LinkedIn Profile:
1. Visit a LinkedIn profile (e.g., `https://www.linkedin.com/in/someone/`)
2. Click the extension icon in your Chrome toolbar
3. Click **"Find Email"** to find their email via Hunter.io
4. Click **"Add to CRM"** to save them to your CRM
5. Click **"Send Email"** to send them an email directly

### What the Extension Does:
- 📧 Finds professional emails using Hunter.io
- 👤 Extracts profile info from LinkedIn (name, company, title, etc.)
- 💾 Saves contacts directly to your CRM
- ✉️ Sends emails through your connected Gmail

---

## Troubleshooting

### "Hunter.io API key not configured"
→ You need to add your Hunter.io API key to `background.js`

### "Failed to add to CRM" or "Unauthorized"
→ Make sure you're logged into the CRM website first

### Extension icon not showing?
→ Click the puzzle piece icon in Chrome toolbar and pin the extension

### Button not working on LinkedIn?
→ Refresh the LinkedIn page and try again

---

## Hunter.io API Key

1. Go to https://hunter.io
2. Sign up for free (25 searches/month free)
3. Go to API section: https://hunter.io/api
4. Copy your API key
5. Paste it in `background.js`

---

## Need Help?

- Check browser console: F12 → Console tab
- Make sure CRM is running and you're logged in
- Verify your Hunter.io has remaining credits
