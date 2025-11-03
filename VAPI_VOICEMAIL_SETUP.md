# VAPI Voicemail Block Setup Guide

## ✅ Status: Voicemail blocks are already implemented!

The voicemail block functionality is already integrated into your CRM. You just need to configure your VAPI credentials.

## 📋 Required Environment Variables

Add these to your `.env.local` file:

```bash
# VAPI Configuration (Required for voicemail blocks)
VAPI_PRIVATE_KEY=your_vapi_private_key_here
# OR use VAPI_API_KEY instead (both work)
VAPI_API_KEY=your_vapi_api_key_here

# VAPI Phone Number ID (Required)
VAPI_PHONE_NUMBER_ID=your_phone_number_id_here

# VAPI Assistant ID (Optional - has default)
VAPI_ASSISTANT_ID=your_assistant_id_here
```

## 🔑 How to Get Your VAPI Credentials

### Step 1: Sign Up for VAPI

1. Go to [https://vapi.ai](https://vapi.ai)
2. Sign up for an account
3. Complete the setup process

### Step 2: Get Your API Key

1. Log into the VAPI Dashboard
2. Go to **Settings** > **API Keys**
3. Copy your **Private Key** (or Public Key if using that)
4. Add it to `.env.local` as `VAPI_PRIVATE_KEY` or `VAPI_API_KEY`

### Step 3: Get Your Phone Number ID

1. In the VAPI Dashboard, go to **Phone Numbers**
2. Purchase or add a phone number
3. Click on the phone number to view details
4. Copy the **Phone Number ID** from the URL or details page
5. Add it to `.env.local` as `VAPI_PHONE_NUMBER_ID`

### Step 4: Get Your Assistant ID (Optional)

1. In the VAPI Dashboard, go to **Assistants**
2. Create a new assistant or use an existing one
3. Copy the **Assistant ID** from the URL or assistant details
4. Add it to `.env.local` as `VAPI_ASSISTANT_ID`

**Note:** If you don't set `VAPI_ASSISTANT_ID`, it will use a default assistant ID. It's recommended to create your own assistant.

## 🎯 How Voicemail Blocks Work

### In the Cadence Flow Builder:

1. **Add a Voicemail Block**: Click "Add Block" and select "Leave Voicemail"
2. **Configure the Block**: Click the settings icon (⚙️) on the voicemail block
3. **Enter Script**: Type what the AI voice should say when leaving the voicemail
   - Example: "Hi [Founder], this is Suriya calling about our recent conversation. Please call me back at your earliest convenience."
4. **Save**: Click Save to save the configuration

### When the Cadence Runs:

1. The voicemail block will execute when reached in the workflow
2. It will use the **company's phone number** from the company details page
3. VAPI will make an outbound call to that number
4. The AI voice will speak your script
5. The call is logged in the company's outreach log

### Phone Number Format:

- The system uses the phone number stored in the company's record
- Format: `+1234567890` (with country code)
- Make sure company phone numbers are in E.164 format

## 🛠️ Optional: VAPI CLI Setup (For Development)

The VAPI CLI is **optional** and mainly useful for:
- Testing voicemail calls locally
- Managing assistants and phone numbers from terminal
- Debugging webhook issues

### Install VAPI CLI:

```bash
# macOS/Linux
curl -sSL https://vapi.ai/install.sh | bash

# Windows
iex ((New-Object System.Net.WebClient).DownloadString('https://vapi.ai/install.ps1'))
```

### Authenticate:

```bash
vapi login
```

### Common Commands:

```bash
# List your assistants
vapi assistant list

# List your phone numbers
vapi phone list

# Make a test call
vapi call create

# View call logs
vapi call list
```

## 🔌 Optional: MCP Integration (Not Required for Voicemail)

MCP (Model Context Protocol) integration is **optional** and mainly useful for:
- Dynamic tool access during calls
- Integrating with Zapier, Make, Composio, etc.
- Advanced voice AI features

**Note:** Voicemail blocks work fine without MCP. MCP is only needed if you want to add dynamic tools to your voice assistant.

### If You Want MCP:

1. Set up an MCP server (e.g., from Zapier, Make, or Composio)
2. Get your MCP server URL
3. Configure it in the VAPI Dashboard under **Tools** > **MCP**

## ✅ Testing Your Setup

1. **Add Environment Variables**: Make sure all required env vars are in `.env.local`
2. **Restart Your Dev Server**: `npm run dev`
3. **Create a Test Cadence**:
   - Add a voicemail block
   - Configure it with a test script
   - Make sure the company has a phone number set
4. **Run the Cadence**: Click "Start Cadence" on a company
5. **Check Logs**: Look for VAPI call logs in the company's outreach log

## 🐛 Troubleshooting

### Error: "VAPI_PRIVATE_KEY or VAPI_API_KEY environment variable is not set"
- **Solution**: Add your VAPI API key to `.env.local` and restart the server

### Error: "VAPI_PHONE_NUMBER_ID environment variable is not set"
- **Solution**: Add your phone number ID to `.env.local` and restart the server

### Error: "Company phone number not found"
- **Solution**: Make sure the company has a phone number set in the company details page

### Error: "Unauthorized - check VAPI credentials"
- **Solution**: Verify your API key is correct and has the right permissions

### Error: "Bad request - check phone number format"
- **Solution**: Ensure the company phone number is in E.164 format: `+1234567890`

## 📚 Resources

- [VAPI Dashboard](https://dashboard.vapi.ai)
- [VAPI Documentation](https://docs.vapi.ai)
- [VAPI CLI Documentation](https://docs.vapi.ai/cli)
- [VAPI Discord](https://discord.gg/vapi)

## 🎉 Next Steps

Once you've added your VAPI credentials:

1. ✅ Restart your dev server
2. ✅ Test a voicemail block in a cadence
3. ✅ Verify the call is made and logged
4. ✅ Customize your assistant voice and settings in VAPI Dashboard

Voicemail blocks are ready to use! 🚀


