# Company Data Scraping Guide

## Overview

This system automatically scrapes and enriches company data from multiple sources:
- **Crunchbase**: Funding rounds, founders, financials, company profile
- **LinkedIn**: Employees, founders, company info, contact emails
- **Company Websites**: About pages, team pages, contact info, descriptions

## Quick Start

### 1. Run the Scraping Script

```bash
# Scrape all companies
npm run scrape:companies

# Scrape first 10 companies (for testing)
npm run scrape:companies -- --limit 10

# Scrape specific companies by ID
npm run scrape:companies -- --company-ids "id1,id2,id3"
```

### 2. What Gets Scraped

**Overview Data:**
- Website URL
- Company description
- Industry
- Employee count
- Headquarters location
- Founding date
- LinkedIn URL
- Twitter handle

**People/Contacts:**
- Founders and C-level executives
- Names, titles, emails (when available)
- Prioritizes founders (CEO, Co-founder, Founder titles)

**Financials:**
- Total funding amount
- Funding rounds (type, amount, date, investors)
- Estimated ARR/revenue (if mentioned in public sources)
- Stored in `company_financials` table

## How It Works

1. **Multi-Source Scraping**: Scrapes from Crunchbase, LinkedIn, and company websites in parallel
2. **Intelligent Merging**: Combines data from all sources, preferring more detailed sources
3. **Database Updates**: Automatically updates:
   - `companies` table with overview data
   - `contacts` table with people/founders
   - `company_financials` table with financial data
   - `company_metadata` table with funding rounds and scraping metadata

## Data Sources Priority

- **Crunchbase**: Best for funding rounds, financials, founders
- **LinkedIn**: Best for employees, contacts, company info
- **Company Website**: Best for descriptions, team pages, contact info

## Error Handling

- Automatic retry logic (2 retries per source)
- Graceful error handling (continues processing other companies if one fails)
- Progress tracking with ETA
- Detailed error logging

## Performance

- Minimal delays between requests (200ms between companies)
- Parallel scraping from multiple sources
- Fast headless browser mode
- Progress tracking shows real-time stats

## Notes

- **Email Extraction**: Emails are extracted using pattern matching. Some emails may need manual verification.
- **LinkedIn Login**: If LinkedIn requires login, set `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` environment variables (optional).
- **Rate Limiting**: The script prioritizes speed. If you encounter rate limits, you may need to add delays.
- **Data Quality**: Scraped data quality depends on what's publicly available. Some fields may be incomplete.

## Troubleshooting

**No data found:**
- Company may not be on Crunchbase/LinkedIn
- Website may be down or require authentication
- Company name may not match exactly

**LinkedIn login required:**
- Set `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` in `.env.local`
- Or skip LinkedIn scraping for that company

**Rate limiting:**
- Add delays between requests if needed
- Process companies in smaller batches

## Example Output

```
[1/50] Processing: Stripe
  ID: abc123
  Website: https://stripe.com
  LinkedIn: https://linkedin.com/company/stripe
  🔍 Scraping from multiple sources...
  ✅ Scraped data from: crunchbase, linkedin, website
  💾 Updating database...
    ✓ Company data updated
    ✓ Added/updated 5 contacts
    📌 Founders: Patrick Collison (patrick@stripe.com), John Collison (john@stripe.com)
    ✓ Financial data updated
    💰 Total funding: $245.00M
    📊 Funding rounds: 8
    ✓ Metadata updated
```

## Files

- `lib/services/company-scraper.ts` - Core scraping service
- `scripts/scrape-all-companies.ts` - Batch scraping script

