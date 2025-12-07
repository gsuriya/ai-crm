# LinkedIn Chrome Extension - Complete Setup Guide

## 🎯 What This Does

The LinkedIn Chrome Extension allows you to add any LinkedIn profile to your CRM cadences with **one click**:

1. **Extract Profile Data** - Scrapes name, title, company, location from LinkedIn
2. **Find Email** - Uses Apollo.io API to find their work email
3. **Add to CRM** - Creates contact in your database
4. **Start Cadence** - Automatically begins outreach sequence
5. **Track in Outreach** - Shows in "Ongoing Outreach" with status

## 🚀 Quick Start

### 1. Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right corner)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder from your project
5. Extension is now installed! ✅

### 2. Verify API Key

Your Apollo.io API key is already configured in `.env.local`:

```bash
APOLLO_API_KEY=MDcvdnCs6ui6-rasutJJyw
```

### 3. Make Sure CRM is Running

```bash
npm run dev
```

Your CRM should be running at `http://localhost:3000`

## 📖 How to Use

### Step 1: Go to LinkedIn Profile
Navigate to any LinkedIn profile, for example:
- https://www.linkedin.com/in/neelshar/
- https://www.linkedin.com/in/anyone/

### Step 2: Wait for Button to Appear
After 2 seconds, a floating **"Add to Cadence"** button will appear in the bottom right corner.

**Button Style:**
- 🎨 Indigo/purple theme color (`#6366f1`)
- 📍 Fixed position: bottom-right
- ✨ Smooth hover animations
- 🔔 Clear visual feedback

### Step 3: Click the Button
1. Click **"Add to Cadence"**
2. A modal will appear showing all your active cadences
3. Select the cadence you want to add them to
4. Click to confirm

### Step 4: Automatic Processing
The extension will:
1. ✅ Extract profile data from LinkedIn DOM
2. ✅ Send to Apollo.io with all profile details for better matching
3. ✅ Get email address (and phone number if available)
4. ✅ Create/update contact in your CRM database
5. ✅ Add contact to selected cadence
6. ✅ **Automatically start the cadence** - sends first email immediately!

### Step 5: Success!
You'll see:
- ✅ Success message with person's name and email
- ✅ Button turns green with checkmark
- ✅ Contact appears in your CRM under "People"
- ✅ Cadence execution starts (first email sent)
- ✅ Shows in "Ongoing Outreach" section

## 🔧 Technical Details

### What Data Gets Extracted from LinkedIn

```javascript
{
  firstName: "Neel",
  lastName: "Sharma",
  name: "Neel Sharma",
  title: "CS + DS @ UC Berkeley | 7x Hackathon Winner",
  company: "UC Berkeley",
  location: "Berkeley, California, United States",
  profileUrl: "https://www.linkedin.com/in/neelshar",
  photoUrl: "https://media.licdn.com/dms/image/...",
}
```

### Apollo.io Enrichment

The extension sends **all extracted data** to Apollo.io for better matching:

```javascript
{
  api_key: "YOUR_KEY",
  linkedin_url: "https://www.linkedin.com/in/neelshar",
  first_name: "Neel",
  last_name: "Sharma",
  name: "Neel Sharma",
  organization_name: "UC Berkeley",
  title: "CS + DS @ UC Berkeley",
  reveal_personal_emails: true,
  reveal_phone_number: true
}
```

**Why pass all this data?**
> Apollo relies on the information you pass to identify the correct person. More information = better matching accuracy!

### What Apollo Returns

```javascript
{
  person: {
    first_name: "Neel",
    last_name: "Sharma",
    email: "neel@example.com",  // ← The magic! 🎯
    email_status: "verified",
    title: "CS + DS @ UC Berkeley",
    organization: {
      name: "UC Berkeley",
      website_url: "https://berkeley.edu",
      primary_domain: "berkeley.edu",
      logo_url: "...",
      phone: "+1-510-642-6000"
    }
  }
}
```

## 🎨 UI/UX Features

### Floating Button States

1. **Default State**
   - Indigo background (`#6366f1`)
   - "Add to Cadence" text with user-plus icon
   - Smooth shadow and hover effects

2. **Loading State**
   - Spinning circle icon
   - "Loading..." or "Adding..." text
   - Button disabled

3. **Success State**
   - Green background (`#10b981`)
   - Checkmark icon
   - "Added! ✓" text
   - Auto-resets after 3 seconds

4. **Error State**
   - Red background (`#ef4444`)
   - X icon
   - "Error" text
   - Shows alert with error details
   - Auto-resets after 3 seconds

### Cadence Selection Modal

- Clean white modal with backdrop blur
- Lists all active cadences
- Shows cadence name and description
- Hover effects on options
- Cancel button
- Click outside to close

## 🔌 API Endpoints

### 1. `GET /api/cadences/list`
Returns all active cadences for selection modal.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Cold Outreach Sequence",
    "description": "3-email sequence for cold leads",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

### 2. `POST /api/linkedin/enrich`
Enriches a LinkedIn profile with Apollo.io.

**Request:**
```json
{
  "linkedinUrl": "https://www.linkedin.com/in/someone",
  "profileData": {
    "firstName": "John",
    "lastName": "Doe",
    "company": "Acme Corp",
    "title": "CEO"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@acme.com",
    "emailStatus": "verified",
    "company": {
      "name": "Acme Corp",
      "domain": "acme.com",
      "website": "https://acme.com"
    }
  }
}
```

### 3. `POST /api/linkedin/add-to-cadence`
Complete workflow: enrich → create contact → add to cadence → start execution.

**Request:**
```json
{
  "linkedinUrl": "https://www.linkedin.com/in/someone",
  "cadenceId": "uuid",
  "profileData": {
    "firstName": "John",
    "lastName": "Doe",
    "company": "Acme Corp",
    "title": "CEO",
    "photoUrl": "https://..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "contact": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@acme.com",
    "company": "Acme Corp"
  },
  "companyCadenceId": "uuid",
  "message": "Contact added to cadence and execution started!"
}
```

## 🐛 Troubleshooting

### Button Not Showing Up

**Problem:** Floating button doesn't appear on LinkedIn profile

**Solutions:**
1. ✅ Make sure you're on a profile page (`/in/` URL)
2. ✅ Wait 2-3 seconds for page to fully load
3. ✅ Check browser console (F12) for errors
4. ✅ Reload the extension: `chrome://extensions/` → click refresh
5. ✅ Reload the LinkedIn page

### "No Email Found" Error

**Problem:** Apollo can't find email for person

**Reasons:**
- Person not in Apollo's database
- Privacy settings prevent email discovery
- Incorrect profile data extracted

**Solutions:**
1. ✅ Try adding more profile information manually
2. ✅ Check if the person's company domain is correct
3. ✅ Verify the LinkedIn URL is correct
4. ✅ Some people simply aren't in Apollo's database

### API Connection Errors

**Problem:** Extension can't connect to CRM

**Solutions:**
1. ✅ Make sure CRM is running: `npm run dev`
2. ✅ Verify CRM is at `http://localhost:3000`
3. ✅ Check `.env.local` has Apollo API key
4. ✅ Check browser console and server logs
5. ✅ Try restarting the dev server

### CORS Errors

**Problem:** Browser blocks API requests

**Solutions:**
1. ✅ Make sure extension has proper permissions in `manifest.json`
2. ✅ Verify `host_permissions` includes your CRM URL
3. ✅ Check that API routes don't have CORS restrictions

## 🔐 Security & Privacy

### What Data is Collected?
- ✅ Only LinkedIn profile data (public information)
- ✅ Email addresses from Apollo.io
- ✅ No passwords or private messages
- ✅ No browsing history

### Where is Data Sent?
- ✅ Your local CRM server (`localhost:3000`)
- ✅ Apollo.io API (for email enrichment only)
- ✅ No third-party tracking or analytics

### API Key Security
- ✅ Apollo API key stored in `.env.local` (server-side)
- ✅ Never exposed to browser or extension
- ✅ All API calls go through your CRM backend

## 📊 Credits & Usage

### Apollo.io Credits
- Each enrichment uses **1 credit** from your Apollo plan
- Check your usage at: https://app.apollo.io/settings/credits
- See pricing: https://www.apollo.io/pricing

### Best Practices
- ✅ Only enrich profiles you actually need
- ✅ Don't spam the button (wait for completion)
- ✅ Monitor your credit usage regularly

## 🎯 Next Steps

### After Installing Extension

1. **Create Cadences** - Make sure you have active cadences in your CRM
2. **Test on Your Profile** - Try it on your own LinkedIn profile first
3. **Add Real Prospects** - Start adding people to your outreach
4. **Monitor Results** - Check "Ongoing Outreach" to see status
5. **Track Responses** - Watch for email replies in your CRM

### Customization Options

**Change Button Position:**
Edit `content.js`:
```javascript
Object.assign(button.style, {
  bottom: '30px',  // Change this
  right: '30px',   // Change this
});
```

**Change Theme Colors:**
Edit `content.js`:
```javascript
const THEME_COLOR = '#6366f1';        // Your brand color
const THEME_COLOR_HOVER = '#4f46e5';  // Hover state
```

**Change CRM URL:**
Edit `content.js`:
```javascript
const CRM_API_URL = 'https://your-crm.com/api';
```

## 🎉 Success!

You now have a fully functional LinkedIn → CRM integration!

**What happens when you click "Add to Cadence":**
1. 🔍 Scrapes LinkedIn profile
2. 📧 Finds email with Apollo.io
3. 💾 Saves to CRM database
4. 🚀 Starts cadence execution
5. 📬 Sends first email immediately
6. 📊 Tracks in "Ongoing Outreach"

**All with one click!** 🎯
