# Quick Setup Guide for New Users

Follow these steps to get the AI CRM running on your machine.

## Step 1: Get the Latest Code

```bash
# If you already cloned the repo, pull latest changes
git pull origin fix-cadence-delay-execution

# Or if you need to check out the branch
git checkout fix-cadence-delay-execution
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Set Up Environment Variables

1. Copy the example file:
```bash
cp .env.example .env.local
```

2. Open `.env.local` and fill in your credentials:

### Required Credentials:

**Supabase (Database):**
- Go to https://supabase.com and create a free account
- Create a new project
- Go to Settings → API
- Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Go to Settings → Database → Connection string (URI format)
- Copy the password from the connection string → `SUPABASE_DB_PASSWORD`

**OpenAI (AI Features):**
- Go to https://platform.openai.com
- Create an API key
- Copy it → `OPENAI_API_KEY`

**Google OAuth (Gmail/Calendar):**
- Go to https://console.cloud.google.com
- Create a new project (or use existing)
- Enable Gmail API and Calendar API
- Go to Credentials → Create Credentials → OAuth 2.0 Client ID
- Set authorized redirect URI: `http://localhost:3000/auth/google-callback`
- Copy Client ID → `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- Copy Client Secret → `GOOGLE_CLIENT_SECRET`

**VAPI (Optional - for voice calls):**
- Go to https://vapi.ai
- Sign up and get your API keys
- Copy Private Key → `VAPI_PRIVATE_KEY`
- Get Phone Number ID → `VAPI_PHONE_NUMBER_ID`
- Get Assistant ID → `VAPI_ASSISTANT_ID`

## Step 4: Set Up Database

Run the database migration script:

```bash
npx tsx scripts/run-financials-migration.ts
```

This will:
- Create the `company_financials` table
- Create the `call_logs` table
- Create the `email_logs` table
- Add the `month` field for monthly tracking

**OR** manually run SQL migrations in Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Run `lib/db/migrations/add_financials_and_docs.sql`
3. Run `lib/db/migrations/add_month_to_financials.sql`

## Step 5: Start the Development Server

```bash
npm run dev
```

## Step 6: Sign In

1. Open http://localhost:3000
2. Click "Sign in with Google"
3. Authorize the app to access Gmail and Calendar
4. You're ready to use the CRM!

## Troubleshooting

### "Missing Supabase credentials" error
- Make sure `.env.local` exists and has all required variables
- Check that variable names match exactly (case-sensitive)

### "Table does not exist" error
- Run the migration script: `npx tsx scripts/run-financials-migration.ts`
- Or manually run SQL migrations in Supabase SQL Editor

### "OpenAI API key not configured"
- Make sure `OPENAI_API_KEY` is set in `.env.local`
- Restart the dev server after adding it

### Build errors
- Make sure all dependencies are installed: `npm install`
- Check Node.js version: `node --version` (should be 18+)

## What's Included

✅ Email workflows with placeholders (`{name}`, `{company}`, `{personalization}`)
✅ VAPI call processing and financial extraction
✅ Timeline snapshot with emails and calls
✅ Financials tracking with monthly/yearly data
✅ Company and contact management
✅ AI-powered personalization

## Next Steps

1. Add companies: Go to Companies page and add your first company
2. Create a cadence: Build email workflows in the Cadences page
3. Add contacts: Add contacts to companies
4. Send emails: Test email workflows
5. Configure VAPI: Set up webhook for call processing (optional)

## Need Help?

- Check `README.md` for detailed documentation
- See `VAPI_CALL_PROCESSING_SETUP.md` for VAPI configuration
- Review `API_CONFIGURATION_STATUS.md` for API status
