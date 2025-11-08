# Company Data Enrichment Guide

## Overview

This guide explains how to automatically fill in company data (financials, firmographics, etc.) using various data provider APIs.

## The Reality of Company Data APIs

### What's Available vs. What's Not

**✅ Generally Available:**
- Basic firmographics (name, website, description, industry)
- Employee count (approximate ranges)
- Location/headquarters
- Founding date
- Funding rounds (public rounds)
- Total funding raised
- LinkedIn/Twitter profiles

**❌ Often NOT Available (especially for private companies):**
- **ARR (Annual Recurring Revenue)** - Proprietary metric, rarely disclosed
- **MRR (Monthly Recurring Revenue)** - Proprietary metric, rarely disclosed
- **Gross/Net Retention** - Internal metrics, not public
- **Burn rate** - Internal metric
- **Runway** - Calculated metric, not public
- **Detailed financials** - Private companies don't disclose

**⚠️ Sometimes Available:**
- Revenue (estimated ranges, not exact)
- Valuation (if company disclosed funding)
- Funding round details (if public)

## API Options Ranked by Accessibility

### 1. Clearbit Enrichment API ⭐ (Recommended to Start)

**Best For:** Basic firmographics, quick setup

**Pricing:**
- Free tier: 50 requests/month
- Starter: $99/month (1,000 requests)
- Professional: $299/month (10,000 requests)

**What You Get:**
- Company name, website, description
- Industry categorization
- Employee count (ranges)
- Location/headquarters
- Founding date
- LinkedIn/Twitter profiles
- Estimated revenue (ranges, not exact)
- Total funding raised

**What You DON'T Get:**
- ARR/MRR
- Detailed financials
- Funding round details

**Setup:**
1. Sign up at https://clearbit.com
2. Get API key from dashboard
3. Add to `.env.local`: `CLEARBIT_API_KEY=your_key`

**Example:**
```bash
curl https://company.clearbit.com/v2/companies/find?domain=stripe.com \
  -u YOUR_API_KEY:
```

---

### 2. Crunchbase API ⭐⭐ (Best for Funding Data)

**Best For:** Funding rounds, investor data, financials (if available)

**Pricing:**
- Enterprise only (contact sales)
- Typically $10,000+/year
- Various API packages available

**What You Get:**
- Comprehensive funding round data
- Investor information
- Financial metrics (if company shared)
- Company relationships
- News and events

**What You DON'T Get:**
- ARR/MRR (rarely available)
- Real-time financials

**Setup:**
1. Contact Crunchbase sales team
2. Request API access
3. Choose API package (Fundamentals, Financials, etc.)
4. Add to `.env.local`: `CRUNCHBASE_API_KEY=your_key`

**API Packages:**
- **Fundamentals:** Basic company data
- **Core Financials:** Financial metrics (if available)
- **Advanced Financials:** Detailed financial analysis
- **Predictions:** Growth predictions

---

### 3. PitchBook API ⭐⭐⭐ (Best for Financials)

**Best For:** Financial metrics, ARR/MRR (if disclosed), detailed analysis

**Pricing:**
- Enterprise only (contact sales)
- Typically $15,000+/year
- Requires contract agreement

**What You Get:**
- Most comprehensive financial data
- ARR/MRR (if company disclosed to PitchBook)
- EBITDA, margins, retention (if available)
- Detailed funding rounds
- Valuation data
- Growth metrics

**What You DON'T Get:**
- Still limited by what companies disclose
- Not all companies share ARR/MRR even with PitchBook

**Setup:**
1. Contact PitchBook Direct Data team
2. Request API access
3. Sign contract agreement
4. Add to `.env.local`: `PITCHBOOK_API_KEY=your_key`

---

## Implementation

### Using the Enrichment Service

The enrichment service supports all three providers and will try them in order if no preference is specified.

#### Via API Endpoint

```bash
# Enrich a company (tries all available providers)
POST /api/companies/{companyId}/enrich

# Specify provider
POST /api/companies/{companyId}/enrich
{
  "provider": "clearbit"  // or "crunchbase" or "pitchbook"
}
```

#### Programmatically

```typescript
import { enrichCompany, saveEnrichedData } from "@/lib/services/company-enrichment";

// Enrich with preferred provider
const data = await enrichCompany("Stripe", "stripe.com", "clearbit");

// Save to database
await saveEnrichedData(supabase, companyId, data);
```

### Auto-Enrichment on Company Creation

You can automatically enrich companies when they're created:

```typescript
// After creating a company
const { data: company } = await supabase
  .from("companies")
  .insert({ name: "Stripe" })
  .select()
  .single();

// Auto-enrich
const enriched = await enrichCompany(company.name);
if (enriched) {
  await saveEnrichedData(supabase, company.id, enriched);
}
```

---

## Data Quality & Limitations

### Why ARR/MRR Are Hard to Get

1. **Proprietary Metrics:** Companies don't publicly disclose these
2. **Competitive Advantage:** Revenue metrics are sensitive
3. **No Standard Disclosure:** Even public companies don't always report ARR
4. **Data Providers:** Even PitchBook/Crunchbase only have it if:
   - Company directly shared it
   - It was disclosed in a funding round
   - It's estimated from other data (less reliable)

### What You CAN Do

1. **Use Estimated Revenue:** Clearbit provides revenue ranges
2. **Calculate from Funding:** Estimate based on funding rounds
3. **Manual Entry:** Best source is direct from company
4. **Extract from Calls:** Use AI to extract from call transcripts (you already do this!)
5. **Web Scraping:** Some companies disclose on their websites

---

## Recommended Strategy

### Phase 1: Start with Clearbit (Now)
- ✅ Quick setup
- ✅ Affordable ($99/month)
- ✅ Good for basic firmographics
- ✅ Fills in 80% of company data fields

### Phase 2: Add Crunchbase (If Budget Allows)
- ✅ Best for funding rounds
- ✅ Better financial estimates
- ⚠️ Expensive ($10k+/year)

### Phase 3: Add PitchBook (If You Need Financials)
- ✅ Best chance at ARR/MRR
- ✅ Most comprehensive
- ⚠️ Very expensive ($15k+/year)

### Phase 4: Hybrid Approach (Recommended)
- Use Clearbit for all companies (basic data)
- Use Crunchbase/PitchBook for high-value prospects
- Extract financials from calls/meetings (you already do this!)
- Manual entry for critical metrics

---

## Cost Comparison

| Provider | Setup Cost | Monthly Cost | Best For |
|----------|------------|---------------|-----------|
| Clearbit | Free | $99-299 | Basic firmographics |
| Crunchbase | Contact Sales | $10k+/year | Funding rounds |
| PitchBook | Contact Sales | $15k+/year | Financials |

---

## Alternative: Extract from Your Own Data

You're already extracting financials from call transcripts! This is actually the **most reliable** source for ARR/MRR because:

1. ✅ Direct from the company
2. ✅ Real-time data
3. ✅ Most accurate
4. ✅ Free!

Consider enhancing your call processing to:
- Extract ARR/MRR mentions
- Extract funding round details
- Extract employee count
- Extract other metrics

---

## Next Steps

1. **Set up Clearbit** (5 minutes)
   - Sign up, get API key
   - Add to `.env.local`
   - Test enrichment endpoint

2. **Test Enrichment**
   ```bash
   curl -X POST http://localhost:3000/api/companies/{id}/enrich \
     -H "Content-Type: application/json" \
     -d '{"provider": "clearbit"}'
   ```

3. **Add Auto-Enrichment** (optional)
   - Enrich on company creation
   - Batch enrich existing companies
   - Schedule periodic re-enrichment

4. **Consider Upgrading** (if budget allows)
   - Evaluate Crunchbase for funding data
   - Evaluate PitchBook for financials
   - Compare ROI vs. manual entry

---

## FAQ

**Q: Can I get ARR/MRR for all companies?**
A: No. These metrics are rarely publicly available. Even with PitchBook, you'll only get it for companies that disclosed it.

**Q: Which API should I use?**
A: Start with Clearbit. It's affordable and covers most needs. Upgrade to Crunchbase/PitchBook only if you need funding/financial data and have budget.

**Q: How accurate is the data?**
A: Basic firmographics (name, website, employees) are usually accurate. Financials are estimates/ranges. ARR/MRR are rarely available.

**Q: Can I combine multiple sources?**
A: Yes! The enrichment service merges data from multiple providers, preferring more detailed sources.

**Q: Should I rely on APIs or manual entry?**
A: Use APIs for bulk enrichment and basic data. Use manual entry (or extraction from calls) for critical metrics like ARR/MRR.

