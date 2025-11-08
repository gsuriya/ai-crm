# Company Enrichment - Quick Start Guide

## What I Built

I've created a comprehensive company data enrichment system that can automatically fill in company information using APIs like Clearbit, Crunchbase, and PitchBook.

## The Reality Check

**Good News:** You can automatically fill in:
- ✅ Basic firmographics (name, website, description, industry)
- ✅ Employee count (ranges)
- ✅ Location/headquarters
- ✅ Founding date
- ✅ Funding rounds (public ones)
- ✅ Total funding raised
- ✅ LinkedIn/Twitter profiles

**Bad News:** ARR/MRR are **rarely available** via APIs because:
- Private companies don't publicly disclose these metrics
- Even PitchBook/Crunchbase only have it if companies directly shared it
- These are proprietary competitive metrics

**Best Source for ARR/MRR:** Your call transcripts! You're already extracting financials from calls, which is actually the most reliable source.

## Quick Setup (5 minutes)

### 1. Get Clearbit API Key (Recommended to Start)

1. Sign up at https://clearbit.com (free tier: 50 requests/month)
2. Get your API key from the dashboard
3. Add to `.env.local`:
   ```bash
   CLEARBIT_API_KEY=your_api_key_here
   ```

### 2. Test It Out

**Option A: Via UI**
1. Go to any company page
2. Click the "✨ Enrich Data" button in the header
3. Watch it fill in company data automatically!

**Option B: Via API**
```bash
curl -X POST http://localhost:3000/api/companies/{companyId}/enrich \
  -H "Content-Type: application/json"
```

**Option C: Batch Enrichment**
```bash
# Enrich all companies
npm run enrich:companies

# Enrich first 10 companies
npm run enrich:companies -- --limit 10

# Use specific provider
npm run enrich:companies -- --provider clearbit
```

## What Gets Filled In

When you enrich a company, it automatically fills:

**Company Table:**
- Website
- Description
- Industry
- Employee count
- Headquarters
- Founding date
- LinkedIn URL
- Funding amount

**Financials Table:**
- ARR (if available from provider)
- Revenue (if available)

**Metadata:**
- Funding rounds (stored as JSON)
- Enrichment source and date

## Upgrading to Better APIs

### Crunchbase API (Best for Funding Data)
- **Cost:** ~$10,000+/year (enterprise)
- **Best For:** Funding rounds, investor data
- **Setup:** Contact Crunchbase sales team
- **Add to `.env.local`:** `CRUNCHBASE_API_KEY=your_key`

### PitchBook API (Best for Financials)
- **Cost:** ~$15,000+/year (enterprise)
- **Best For:** ARR/MRR (if disclosed), detailed financials
- **Setup:** Contact PitchBook Direct Data team
- **Add to `.env.local`:** `PITCHBOOK_API_KEY=your_key`

The system automatically tries all available providers and merges the best data!

## Files Created

1. **`lib/services/company-enrichment.ts`** - Core enrichment service
2. **`app/api/companies/[id]/enrich/route.ts`** - API endpoint
3. **`scripts/enrich-companies.ts`** - Batch enrichment script
4. **`docs/COMPANY_ENRICHMENT.md`** - Full documentation

## Recommended Strategy

1. **Start with Clearbit** ($99/month) - Fills 80% of basic data
2. **Extract from calls** - Your existing call processing is the best source for ARR/MRR
3. **Manual entry** - For critical metrics not available via APIs
4. **Upgrade later** - Add Crunchbase/PitchBook if budget allows and you need funding data

## Next Steps

1. ✅ Add Clearbit API key to `.env.local`
2. ✅ Test enrichment on a company
3. ✅ Consider batch enriching existing companies
4. ✅ Evaluate if you need Crunchbase/PitchBook based on your needs

## Questions?

Check out `docs/COMPANY_ENRICHMENT.md` for detailed documentation on:
- What data is available from each provider
- Cost comparisons
- API setup instructions
- Data quality expectations

