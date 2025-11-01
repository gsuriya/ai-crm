# AI CRM

AI-powered CRM for private markets investors.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up Supabase:
   - Create a new project at https://supabase.com
   - Run the SQL schema from `lib/db/schema.sql` in the Supabase SQL editor
   - Copy your project URL and anon key

3. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

4. Add your Supabase credentials to `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Setup

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the contents of `lib/db/schema.sql` to create the companies table and enable pgvector extension

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Framer Motion
- Supabase (Postgres + pgvector)

