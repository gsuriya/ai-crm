# Semantic Search Setup

## Prerequisites

1. **OpenAI API Key**: You need an OpenAI API key for generating embeddings
   - Get one from https://platform.openai.com/api-keys
   - Add to `.env.local`: `OPENAI_API_KEY=your_api_key_here`

## Database Setup

The semantic search tables and functions have been created via migrations:
- `company_content` - Unified table for all unstructured data (meeting logs, emails, documents, etc.)
- `company_metadata` - Key-value store for structured attributes
- `documents` - References to external documents (Google Docs, PDFs, etc.)
- `search_companies_semantic` - Database function for vector similarity search

## Seeding Sample Data

To add sample content with embeddings for testing:

```bash
npm run seed:semantic
```

This will:
- Add meeting logs for the first 5 companies
- Add ARR metadata with embeddings
- Update company ARR fields

## Testing Semantic Search

1. Make sure you have seeded semantic data: `npm run seed:semantic`
2. Start the dev server: `npm run dev`
3. Go to `/companies` page
4. Try semantic queries like:
   - "companies with ARR above 3M"
   - "companies discussing funding round"
   - "companies with Series A"
   - "companies meeting about Q4 strategy"

## How It Works

1. **Content Ingestion**: When content is added via `/api/content`, embeddings are automatically generated
2. **Search**: When you type a natural language query, it:
   - Generates an embedding for your query
   - Searches across all `company_content` and `company_metadata` tables
   - Returns matches with relevance scores and source information
3. **UI Display**: Match indicators show where matches were found (meeting log, metadata, etc.)

## Adding New Content Types

The system is extensible - you can add new content types without schema changes:

```typescript
// Add content via API
await fetch('/api/content', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company_id: 'company-uuid',
    content_type: 'meeting_log', // or 'email', 'google_doc', etc.
    content: 'Meeting notes text...',
    source: 'Internal CRM',
    metadata: { title: 'Meeting Title', date: '2024-01-01' }
  })
});
```

The embedding will be automatically generated and stored.

## Future Enhancements

- Google Docs integration
- Email thread parsing
- PDF document extraction
- Batch embedding generation
- More sophisticated filtering options

