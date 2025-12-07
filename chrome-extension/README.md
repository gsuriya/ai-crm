# LinkedIn CRM Chrome Extension

This Chrome extension allows you to add LinkedIn profiles directly to your CRM cadences with one click.

## Features

- 🎯 **One-Click Add to Cadence**: Floating button on LinkedIn profiles
- 📧 **Automatic Email Discovery**: Uses Apollo.io to find email addresses
- 🚀 **Instant Cadence Execution**: Automatically starts outreach when added
- 💼 **Profile Enrichment**: Extracts and saves LinkedIn profile data
- 🎨 **Beautiful UI**: Matches your CRM's theme colors

## Installation

### 1. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from this project
5. The extension should now appear in your extensions list

### 2. Configure Your CRM

Make sure your CRM is running at `http://localhost:3000` (or update the `CRM_API_URL` in `content.js`)

### 3. Add Apollo.io API Key

The Apollo.io API key is already configured in your `.env.local` file:
```
APOLLO_API_KEY=MDcvdnCs6ui6-rasutJJyw
```

## Usage

1. **Navigate to any LinkedIn profile** (e.g., https://www.linkedin.com/in/someone/)
2. **Wait 2 seconds** for the page to fully load
3. **Click the "Add to Cadence" button** in the bottom right corner
4. **Select a cadence** from the modal
5. **Done!** The person will be:
   - Enriched with their email from Apollo.io
   - Added to your CRM as a contact
   - Added to the selected cadence
   - Automatically sent the first email in the cadence

## How It Works

### 1. Profile Extraction
The extension extracts the following data from LinkedIn:
- First name & last name
- Job title
- Current company
- Location
- Profile URL
- Profile picture

### 2. Email Enrichment
Uses Apollo.io API to find the person's email address based on their LinkedIn profile.

### 3. Contact Creation
Creates or updates the contact in your CRM database with all the enriched data.

### 4. Cadence Execution
Automatically adds the contact to the selected cadence and starts execution:
- Sends first email immediately
- Schedules follow-ups based on cadence configuration
- Tracks all interactions in your CRM

## Troubleshooting

### Button Not Appearing
- Make sure you're on a LinkedIn profile page (`/in/` URL)
- Wait 2-3 seconds for the page to fully load
- Check the browser console for errors (F12 → Console tab)
- Reload the page

### "No email found" Error
- The person may not be in Apollo.io's database
- Try adding them manually in your CRM with their email
- Some profiles have privacy settings that prevent email discovery

### API Errors
- Make sure your CRM is running at `http://localhost:3000`
- Check that the Apollo.io API key is valid
- Check the browser console and CRM server logs for details

## Development

### File Structure
```
chrome-extension/
├── manifest.json       # Extension configuration
├── content.js          # Main script (runs on LinkedIn pages)
├── background.js       # Background service worker
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
└── README.md          # This file
```

### Updating the Extension
After making changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on your extension
3. Reload any LinkedIn pages

### Changing the CRM URL
Edit `content.js` and update:
```javascript
const CRM_API_URL = 'http://localhost:3000/api';
```

### Customizing Theme Colors
Edit `content.js` and update:
```javascript
const THEME_COLOR = '#6366f1';        // Main color
const THEME_COLOR_HOVER = '#4f46e5';  // Hover color
```

## API Endpoints Used

- `GET /api/cadences/list` - Fetch available cadences
- `POST /api/linkedin/add-to-cadence` - Add person to cadence
- `POST /api/cadence/start` - Start cadence execution

## Security Notes

- The extension only runs on LinkedIn profile pages
- All API calls go through your local CRM server
- Apollo.io API key is stored server-side, not in the extension
- No data is sent to third parties except Apollo.io for email enrichment

## Support

If you encounter issues:
1. Check the browser console (F12 → Console)
2. Check your CRM server logs
3. Verify your Apollo.io API key is valid
4. Make sure you have active cadences in your CRM
