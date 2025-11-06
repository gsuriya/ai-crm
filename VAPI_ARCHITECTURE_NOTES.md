# VAPI Architecture & Flow - Notes

## Overview
VAPI is an AI voice call service that makes outbound calls, has conversations, and sends call data back to your CRM via webhooks.

---

## Flow Architecture

### 1. CALL INITIATION
**Where:** Workflow execution or manual trigger

**Code Path:**
- `lib/services/cadence-execution.ts` (line 951) - "voicecall" block type
- OR `app/api/voice-call/send/route.ts` - Direct API endpoint

**What Happens:**
- Gets company phone number from `companies` table
- Calls `sendVoiceCall()` from `lib/services/vapi.ts`
- Uses VAPI SDK to create outbound call:
  - Phone: Company's phone number
  - Assistant: Uses VAPI_ASSISTANT_ID (configured in VAPI dashboard)
  - First Message: Personalized with company name

**VAPI Agent Instructions:**
- System prompt stored in `lib/services/vapi.ts` (lines 105-128)
- Key behaviors:
  - Asks for financial context BEFORE call starts
  - Handles rejection gracefully
  - Focuses on scheduling meeting
  - Records all information shared

**Initial Storage:**
- Creates record in `call_logs` table:
  - `company_id`, `cadence_id`, `vapi_call_id`, `status: 'initiated'`
  - Stores `vapi_call_id` for later webhook matching

---

### 2. VAPI PROCESSES CALL
**Where:** VAPI's servers (external)

**What Happens:**
- VAPI makes actual phone call
- AI assistant has conversation
- VAPI records:
  - Full transcription (everything said)
  - Call duration
  - Status updates (ringing → answered → ended)
  - Recording URL (if enabled)

**During Call:**
- Agent follows instructions from system prompt
- If financial info shared → mentions numbers clearly
- All conversation transcribed in real-time

---

### 3. WEBHOOK RECEIPT
**Where:** Your CRM webhook endpoint

**Endpoint:** `app/api/vapi/webhook/route.ts` → `/api/vapi/webhook`

**When Triggered:**
- Call ends (status: 'ended' or 'completed')
- OR when transcription becomes available
- VAPI sends HTTP POST to your webhook URL

**Webhook Payload Structure:**
```
{
  call: {
    id: "vapi_call_id_123",
    status: "ended",
    transcript: "Full conversation text...",
    summary: "Optional VAPI-generated summary",
    recordingUrl: "https://..."
  }
}
```

**Matching Call Log:**
- Webhook finds existing `call_logs` record by `vapi_call_id`
- Must match the call that was initiated earlier

---

### 4. DATA PROCESSING & STORAGE

**Step A: Store Transcription**
- Saves full transcript to `call_logs.transcription`

**Step B: Generate Summary**
- Calls `generateCallSummary()` from `lib/services/call-processing.ts`
- Uses GPT-4o-mini to create 3-5 sentence summary
- Saves to `call_logs.notes` field
- Falls back to first 500 chars if GPT fails

**Step C: Extract Financials**
- Calls `extractFinancialsFromTranscript()` from `lib/services/call-processing.ts`
- Uses GPT with JSON output mode
- Looks for:
  - ARR (numbers)
  - Gross Retention (%)
  - Net Retention (%)
  - Gross Margin (%)
  - EBITDA
  - Month/Year if mentioned

**Step D: Update Financials Table**
- If financials extracted → calls `updateCompanyFinancials()`
- Updates/creates record in `company_financials` table:
  - `company_id`, `year`, `month`
  - Only updates fields that were mentioned
  - Uses current month/year if not specified in transcript

**Step E: Update Call Log**
- Updates `call_logs` record with:
  - `transcription` (full text)
  - `notes` (summary)
  - `status` (ended/completed)
  - `metadata.extracted_financials` (what was found)
  - `metadata.recording_url` (if available)

---

### 5. UI DISPLAY

**Timeline Snapshot Component:**
- File: `components/company/timeline-snapshot.tsx`
- Data Source: `app/companies/[id]/overview/page.tsx`

**Data Fetching:**
- Queries `call_logs` table filtered by `company_id`
- Orders by `created_at` DESC
- Limits to 5 most recent

**Display Logic:**
- Shows call type badge (Voice Call / Voicemail)
- Shows duration if available
- Shows summary from `notes` field (not full transcript)
- Indicates if summary available
- Condensed format (first 200 chars)

**Financials Display:**
- File: `components/company/company-key-metrics.tsx`
- Queries `company_financials` table
- Shows most recent data (by year/month)
- Displays ARR, gross retention, net retention
- Shows "Live" badge if current month/year
- Shows month/year badge

---

## Data Flow Diagram

```
1. WORKFLOW TRIGGER
   ↓
2. sendVoiceCall() → VAPI SDK
   ↓
3. call_logs INSERT (vapi_call_id stored)
   ↓
4. VAPI makes call → transcribes → ends
   ↓
5. VAPI webhook POST → /api/vapi/webhook
   ↓
6. Find call_logs by vapi_call_id
   ↓
7. Process transcription:
   ├─→ Generate summary (GPT)
   ├─→ Extract financials (GPT)
   └─→ Update call_logs (transcription, notes)
   ↓
8. If financials found → Update company_financials
   ↓
9. UI fetches:
   ├─→ call_logs → Timeline Snapshot
   └─→ company_financials → Key Metrics
```

---

## Database Tables

### `call_logs`
**Columns:**
- `id` - UUID primary key
- `company_id` - Links to company
- `cadence_id` - Links to workflow (optional)
- `call_type` - 'voice_call' or 'voicemail'
- `direction` - 'outbound' or 'inbound'
- `phone_number` - Called number
- `vapi_call_id` - VAPI's call ID (used for webhook matching)
- `transcription` - Full call transcript (stored by webhook)
- `notes` - AI-generated summary (stored by webhook)
- `status` - 'initiated' → 'ended' (updated by webhook)
- `duration_seconds` - Call length
- `metadata` - JSONB with extra data (financials, recording URL, etc.)
- `created_at`, `updated_at` - Timestamps

**Key:** `vapi_call_id` is the link between initiation and webhook

---

### `company_financials`
**Columns:**
- `id` - UUID primary key
- `company_id` - Links to company
- `year` - Year of data (required)
- `month` - Month 1-12 (nullable, for yearly data)
- `arr` - Annual Recurring Revenue
- `gross_retention` - Percentage 0-100
- `net_retention` - Percentage 0-100
- `gross_margin` - Percentage 0-100
- `ebitda` - Number
- `created_at`, `updated_at` - Timestamps

**Unique Constraint:** `(company_id, year, month)` - one record per company/month/year

---

## Key Components

### VAPI Service (`lib/services/vapi.ts`)
- `sendVoiceCall()` - Initiates calls
- `sendVoicemail()` - Leaves voicemails only
- System prompt constants (for reference)
- Uses VAPI SDK (@vapi-ai/server-sdk)

### Call Processing (`lib/services/call-processing.ts`)
- `generateCallSummary()` - GPT summarization
- `extractFinancialsFromTranscript()` - GPT extraction
- Returns structured data or null

### Webhook Handler (`app/api/vapi/webhook/route.ts`)
- Receives POST from VAPI
- Matches call by `vapi_call_id`
- Processes transcription → summary → financials
- Updates both `call_logs` and `company_financials`

---

## Configuration Required

### VAPI Dashboard:
1. **Assistant Setup:**
   - Copy system prompt from `lib/services/vapi.ts` (lines 105-128)
   - Paste into Assistant configuration
   - Set to ask for financial context before call

2. **Webhook Setup:**
   - URL: `https://your-domain.com/api/vapi/webhook`
   - Events: `call-status-update` or `status-update`
   - For local dev: Use ngrok

### Environment Variables:
- `VAPI_PRIVATE_KEY` - Your VAPI API key
- `VAPI_PHONE_NUMBER_ID` - Phone number from VAPI
- `VAPI_ASSISTANT_ID` - Assistant ID from VAPI
- `OPENAI_API_KEY` - Required for summaries and financial extraction

---

## Error Handling

**If webhook fails:**
- Call log still exists with `vapi_call_id`
- Can manually fetch call status from VAPI API later
- Transcription might be missed if webhook never arrives

**If GPT fails:**
- Summary falls back to first 500 chars of transcript
- Financial extraction returns null (no updates)
- Call log still saves transcription

**If call log not found:**
- Webhook returns success but doesn't update anything
- Usually means call was initiated outside CRM
- Or `vapi_call_id` mismatch

---

## Notes Flow Summary

1. **Call starts** → `call_logs` record created with `vapi_call_id`
2. **VAPI processes** → Makes call, transcribes, ends
3. **Webhook fires** → POST to `/api/vapi/webhook` with transcript
4. **Webhook finds** → Matches `call_logs` by `vapi_call_id`
5. **Processing:**
   - Save transcript
   - Generate summary (GPT)
   - Extract financials (GPT)
   - Update `call_logs` with summary
   - Update `company_financials` if metrics found
6. **UI displays:**
   - Timeline shows call with summary
   - Financials section shows extracted metrics

---

## Financial Extraction Logic

**GPT Prompt:**
- Model: gpt-4o-mini
- Temperature: 0.1 (very precise)
- JSON output mode
- Extracts ONLY if explicitly mentioned

**Validation:**
- ARR: Must be number
- Percentages: Clamped to 0-100
- Month: Validated 1-12, defaults to current if missing
- Year: Defaults to current if missing

**Storage:**
- Creates/updates `company_financials` record
- Only includes fields that were mentioned
- Uses month/year from transcript or current date

---

## Summary

**Initiation:** CRM → VAPI SDK → Call created → `call_logs` INSERT

**Processing:** VAPI → Call → Transcription → Webhook → CRM

**Storage:** Webhook → Process → Update `call_logs` + `company_financials`

**Display:** UI queries both tables → Shows in Timeline + Financials sections

