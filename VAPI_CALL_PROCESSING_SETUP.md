# VAPI Call Processing & Financials Auto-Update Setup

## Overview

This implementation adds comprehensive call processing functionality that:
1. Receives VAPI call transcriptions via webhook
2. Generates call summaries automatically
3. Extracts financial metrics (ARR, retention, margins) from call transcripts
4. Auto-updates the financials section
5. Displays emails and calls in Timeline Snapshot
6. Shows ARR/retention by month/year with live indicators

## Features Implemented

### 1. VAPI Webhook Handler (`/api/vapi/webhook`)
- Receives call completion events from VAPI
- Processes transcriptions and summaries
- Extracts financial data using GPT
- Updates call logs with summaries
- Auto-updates company financials

### 2. Call Processing Service (`lib/services/call-processing.ts`)
- `generateCallSummary()` - Creates concise call summaries
- `extractFinancialsFromTranscript()` - Extracts ARR, retention, margins from transcripts

### 3. Updated VAPI Agent Instructions
- Asks for financial/non-financial context before calls
- Handles questions gracefully
- Records all information shared
- Updated system prompt in `lib/services/vapi.ts`

### 4. Enhanced Timeline Snapshot
- Shows sent/received emails clearly
- Displays call logs with summaries
- Shows call duration and summary availability
- Condensed, readable format

### 5. Enhanced Financials Section
- Shows ARR and retention by month/year
- "Live" indicator for current month/year data
- Auto-updates when financials extracted from calls
- Supports both monthly and yearly tracking

## Database Migration

Run the migration to add month field to financials:
```sql
-- File: lib/db/migrations/add_month_to_financials.sql
```

This adds:
- `month` column to `company_financials` table
- Updated unique constraint to include month
- Index for faster month-based queries

## VAPI Webhook Configuration

### Step 1: Get Your Webhook URL
Your webhook URL will be:
```
https://your-domain.com/api/vapi/webhook
```

For local development with ngrok:
```
https://your-ngrok-url.ngrok.io/api/vapi/webhook
```

### Step 2: Configure in VAPI Dashboard
1. Go to VAPI Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/vapi/webhook`
3. Select events to receive:
   - `call-status-update` (or `status-update`)
   - `call-ended`
   - `transcription-complete`

### Step 3: Update VAPI Assistant System Prompt
Copy the updated system prompt from `lib/services/vapi.ts` (lines 105-126) and paste it into your VAPI assistant configuration in the dashboard.

The key additions:
- Asks for financial context before calls
- Handles questions gracefully
- Records information systematically

## How It Works

### Call Flow:
1. **Call Initiated** → Call log created in `call_logs` table with `vapi_call_id`
2. **Call Ends** → VAPI sends webhook to `/api/vapi/webhook`
3. **Webhook Processes**:
   - Finds call log by `vapi_call_id`
   - Generates summary from transcription (if not provided)
   - Extracts financial metrics using GPT
   - Updates call log with summary
   - Auto-updates `company_financials` if metrics found
4. **UI Updates** → Timeline Snapshot and Financials section reflect new data

### Financial Extraction:
The system extracts:
- ARR (Annual Recurring Revenue)
- Gross Retention Rate (%)
- Net Retention Rate (%)
- Gross Margin (%)
- EBITDA
- Month and Year (if mentioned, defaults to current)

### Email Display:
- Shows "Sent: [subject]" or "Received: [subject]"
- Displays email addresses
- Shows condensed body preview

### Call Display:
- Shows call type (Voice Call/Voicemail)
- Displays duration
- Shows summary if available
- Indicates if transcription exists

## Testing

### Test Webhook Locally:
1. Start your dev server: `npm run dev`
2. Use ngrok: `ngrok http 3000`
3. Configure VAPI webhook with ngrok URL
4. Make a test call
5. Check logs for webhook events

### Test Financial Extraction:
1. Make a call mentioning financials: "Our ARR is $5M and gross retention is 95%"
2. Check webhook logs
3. Verify financials updated in database
4. Check UI shows new financials with "Live" badge

## Environment Variables

Ensure these are set:
```bash
OPENAI_API_KEY=your_key_here  # Required for summaries and financial extraction
VAPI_PRIVATE_KEY=your_key     # Required for VAPI calls
VAPI_PHONE_NUMBER_ID=your_id  # Required for VAPI calls
VAPI_ASSISTANT_ID=your_id     # Required for VAPI calls
```

## Troubleshooting

### Webhook Not Receiving Events:
- Check VAPI dashboard webhook configuration
- Verify webhook URL is accessible
- Check server logs for incoming requests
- Ensure webhook is enabled in VAPI dashboard

### Financials Not Extracting:
- Check OpenAI API key is set
- Verify transcription is being received
- Check webhook logs for extraction errors
- Ensure financial metrics are mentioned clearly in call

### Summaries Not Generating:
- Check OpenAI API key
- Verify transcription exists
- Check call-processing service logs
- Ensure transcription is long enough

## Next Steps

1. **Run Database Migration**: Execute `add_month_to_financials.sql`
2. **Configure VAPI Webhook**: Add webhook URL in VAPI dashboard
3. **Update Assistant Prompt**: Copy new prompt to VAPI assistant
4. **Test**: Make a test call and verify webhook processing
5. **Monitor**: Check logs and verify financials auto-update

