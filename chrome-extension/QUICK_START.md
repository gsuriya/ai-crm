# LinkedIn Extension - Quick Start 🚀

## Installation (2 minutes)

### 1. Load Extension
```
1. Open Chrome → chrome://extensions/
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the chrome-extension folder
5. Done! ✅
```

### 2. Start Your CRM
```bash
npm run dev
```

## Usage (10 seconds per person)

### Step 1: Go to LinkedIn Profile
Visit any LinkedIn profile:
- https://www.linkedin.com/in/neelshar/
- https://www.linkedin.com/in/anyone/

### Step 2: Click the Button
Look for the **purple "Add to Cadence"** button in the bottom-right corner.

### Step 3: Select Cadence
Pick which cadence to add them to.

### Step 4: Done!
✅ Email found via Apollo.io
✅ Contact created in CRM
✅ Cadence started automatically
✅ First email sent!

## What You'll See

### On LinkedIn:
```
┌─────────────────────────────────────┐
│  LinkedIn Profile Page              │
│                                     │
│  [Profile Info]                     │
│  [Experience]                       │
│  [Education]                        │
│                                     │
│                    ┌──────────────┐ │
│                    │ 👤+ Add to   │ │  ← This button!
│                    │   Cadence    │ │
│                    └──────────────┘ │
└─────────────────────────────────────┘
```

### Modal Popup:
```
┌─────────────────────────────────────┐
│  Select Cadence                     │
│  Choose which cadence to add this   │
│  person to                          │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Cold Outreach Sequence        │ │ ← Click one
│  │ 3-email sequence for leads    │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Warm Introduction             │ │
│  │ Follow-up sequence            │ │
│  └───────────────────────────────┘ │
│                                     │
│  [Cancel]                           │
└─────────────────────────────────────┘
```

### Success Message:
```
✅ Success!

Neel Sharma has been added to the cadence 
and outreach has started!

Email: neel@berkeley.edu
```

## Button States

1. **Default** → Purple button with "Add to Cadence"
2. **Loading** → Spinning icon with "Loading..."
3. **Adding** → Spinning icon with "Adding..."
4. **Success** → Green button with "Added! ✓"
5. **Error** → Red button with "Error"

## Troubleshooting

### Button not showing?
- Wait 2-3 seconds after page loads
- Reload the page
- Check you're on a `/in/` profile URL

### "No email found"?
- Person not in Apollo's database
- Try a different profile
- Some people have private settings

### API errors?
- Make sure `npm run dev` is running
- Check console: F12 → Console tab
- Verify Apollo API key in `.env.local`

## What Happens Behind the Scenes

```
1. Extract LinkedIn Data
   ↓
2. Send to Apollo.io
   ↓
3. Get Email Address
   ↓
4. Create Contact in CRM
   ↓
5. Add to Cadence
   ↓
6. Start Execution
   ↓
7. Send First Email
   ↓
8. ✅ Done!
```

## Pro Tips

- ✅ Test on your own profile first
- ✅ Create cadences before adding people
- ✅ Monitor your Apollo.io credits
- ✅ Check "Ongoing Outreach" to see status
- ✅ Watch for email replies in your CRM

## Need Help?

Check the full guide: `LINKEDIN_EXTENSION_SETUP.md`

Or check:
- Browser console (F12)
- Server logs (terminal running `npm run dev`)
- Apollo.io dashboard for credit usage
