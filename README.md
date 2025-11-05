# AI CRM

AI-powered CRM for private markets investors with email automation, VAPI call processing, and financial tracking.

## Features

- 📧 **Email Workflows** - Build multi-step email cadences with delays and threading
- 🤖 **AI Personalization** - Automatic email personalization using GPT
- 📞 **VAPI Integration** - AI-powered voice calls and voicemail automation
- 💰 **Financial Tracking** - Auto-extract and track ARR, retention, and metrics from calls
- 📊 **Timeline View** - See all emails and calls in one place with summaries
- 🏢 **Company Management** - Track companies, contacts, deals, and activities

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works)
- OpenAI API key (for personalization and call processing)
- Google OAuth credentials (for Gmail/Calendar integration)
- VAPI account (optional, for voice calls)

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/gsuriya/ai-crm.git
cd ai-crm
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env.local
```

4. **Configure `.env.local`** with your credentials (see [Environment Variables](#environment-variables) below)

5. **Set up Supabase database:**
   - Create a new project at https://supabase.com
   - Go to SQL Editor and run migrations in order:
     - `lib/db/migrations/add_financials_and_docs.sql`
     - `lib/db/migrations/add_month_to_financials.sql`
   - Or run the migration script: `npx tsx scripts/run-financials-migration.ts`

6. **Run the development server:**
```bash
npm run dev
```

7. **Open your browser:**
   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Sign in with Google to get started

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

### Required:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `OPENAI_API_KEY` - OpenAI API key for personalization and call processing
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - Same as GOOGLE_CLIENT_ID

### Optional (for voice calls):
- `VAPI_PRIVATE_KEY` - VAPI API key
- `VAPI_PHONE_NUMBER_ID` - VAPI phone number ID
- `VAPI_ASSISTANT_ID` - VAPI assistant ID

### For migrations:
- `SUPABASE_DB_PASSWORD` - Supabase database password

## Key Features Documentation

### Email Placeholders
Use dynamic placeholders in email templates:
- `{name}` - Contact's first name
- `{company}` - Company name
- `{personalization}` - AI-generated personalization sentence

See `VAPI_CALL_PROCESSING_SETUP.md` for VAPI webhook configuration.

## Database Migrations

Run migrations in this order:
1. `lib/db/migrations/add_financials_and_docs.sql` - Creates financials and call_logs tables
2. `lib/db/migrations/add_month_to_financials.sql` - Adds month field for monthly tracking

Or use the automated script:
```bash
npx tsx scripts/run-financials-migration.ts
```

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Animations:** Framer Motion
- **Database:** Supabase (Postgres + pgvector)
- **AI:** OpenAI GPT-4o-mini
- **Voice:** VAPI SDK
- **Email:** Gmail API
- **Calendar:** Google Calendar API

## Project Structure

```
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   │   ├── email/         # Email sending & personalization
│   │   ├── vapi/          # VAPI webhook handler
│   │   └── migrations/    # Database migration endpoints
│   └── companies/         # Company detail pages
├── components/            # React components
│   ├── company/          # Company-specific components
│   └── ui/               # Reusable UI components
├── lib/
│   ├── services/         # Business logic services
│   │   ├── vapi.ts       # VAPI integration
│   │   ├── call-processing.ts  # Call summaries & financial extraction
│   │   └── cadence-execution.ts # Workflow execution
│   ├── utils/            # Utility functions
│   │   └── email-variables.ts  # Email placeholder replacement
│   └── db/               # Database migrations
└── scripts/              # Utility scripts
```

## Support

For issues or questions, check the documentation files:
- `VAPI_CALL_PROCESSING_SETUP.md` - VAPI configuration guide
- `API_CONFIGURATION_STATUS.md` - API setup status

## License

Private - All rights reserved

