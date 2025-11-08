/**
 * AI-Powered Company Data Enrichment
 * 
 * Uses OpenAI to intelligently extract company information from web pages
 * instead of scraping HTML (which includes cookies, navigation, ads, etc.)
 */

import OpenAI from 'openai';

// Lazy initialization of OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return new OpenAI({ apiKey });
}

export interface EnrichedContact {
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  is_founder?: boolean;
}

export interface EnrichedFundingRound {
  round_type: string;
  amount: number;
  date: string;
  lead_investor?: string;
  participants?: string[];
}

export interface EnrichedCompanyData {
  // Overview
  website?: string;
  description?: string;
  industry?: string;
  employee_count?: number;
  headquarters?: string;
  founding_date?: string;
  linkedin_url?: string;
  twitter_handle?: string;
  logo_url?: string;
  
  // Financials
  funding_amount?: number;
  funding_round?: string;
  arr?: number;
  revenue?: number;
  funding_rounds?: EnrichedFundingRound[];
  
  // People
  contacts?: EnrichedContact[];
  
  // Metadata
  sources?: string[];
  scraped_at?: string;
}

/**
 * Fetch and clean text content from a URL using Puppeteer
 */
async function fetchPageContent(url: string): Promise<string> {
  const puppeteer = await import('puppeteer');
  
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Extract text content from the page
    const content = await page.evaluate(() => {
      // Remove script, style, nav, footer, cookie notices
      const elementsToRemove = document.querySelectorAll('script, style, nav, footer, [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"]');
      elementsToRemove.forEach(el => el.remove());
      
      // Get main content
      const main = document.querySelector('main') || 
                   document.querySelector('[role="main"]') ||
                   document.querySelector('article') ||
                   document.body;
      
      return main?.innerText || document.body.innerText || '';
    });
    
    return content;
  } catch (error: any) {
    console.error(`Error fetching ${url}:`, error.message);
    return '';
  } finally {
    await browser.close();
  }
}

/**
 * Use AI to extract company information from text content
 */
async function extractCompanyDataWithAI(
  companyName: string,
  content: string,
  source: string
): Promise<Partial<EnrichedCompanyData>> {
  const prompt = `You are a company data extraction expert. Extract structured information about "${companyName}" from the following content.

Source: ${source}
Content:
${content.substring(0, 15000)}

Extract the following information if available:
- description: A clear, professional description of what the company does (2-3 sentences). CRITICAL: Completely exclude any cookie notices, consent text, navigation menus, "Accept" buttons, privacy policy links, or any text that mentions "cookies", "consent", "IAB", "privacy", "terms", or similar legal/navigation elements. Only extract the actual company description.
- industry: Primary industry or sector
- employee_count: Number of employees (as integer)
- headquarters: City and state/country
- founding_date: Year founded (format: YYYY-MM-DD)
- website: Company website URL
- linkedin_url: LinkedIn company page URL
- twitter_handle: Twitter/X handle (without @)
- funding_amount: Total funding raised in USD (as number, e.g., 5000000 for $5M)
- funding_rounds: Array of funding rounds with round_type, amount, date, lead_investor
- contacts: Array of founders and key executives with first_name, last_name, title, email (if available), is_founder (boolean)
- arr: Annual Recurring Revenue if mentioned (as number)
- revenue: Revenue if mentioned (as number)

Return ONLY valid JSON in this format:
{
  "description": "Clean company description",
  "industry": "Industry name",
  "employee_count": 150,
  "headquarters": "City, State",
  "founding_date": "2010-01-01",
  "website": "https://example.com",
  "linkedin_url": "https://linkedin.com/company/example",
  "twitter_handle": "example",
  "funding_amount": 5000000,
  "funding_rounds": [
    {
      "round_type": "Series A",
      "amount": 10000000,
      "date": "2024-01-15",
      "lead_investor": "VC Firm",
      "participants": ["VC Firm", "Other"]
    }
  ],
  "contacts": [
    {
      "first_name": "John",
      "last_name": "Doe",
      "title": "CEO & Co-founder",
      "email": "john@example.com",
      "is_founder": true
    }
  ],
  "arr": 5000000,
  "revenue": 10000000
}

CRITICAL FILTERING RULES:
1. If description contains words like "cookie", "consent", "IAB", "privacy policy", "terms", "accept", "scroll", or similar legal/navigation text, DO NOT include it. Return null for description instead.
2. Only extract actual company business descriptions, not legal notices or navigation elements.
3. If you cannot find a clean company description, set description to null rather than including cookie/legal text.

Only include fields that are clearly present in the content. Exclude cookie notices, navigation text, and other non-content elements.`;

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction expert. Extract only accurate, structured data. Return valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return {};

    const data = JSON.parse(content);
    return data;
  } catch (error: any) {
    console.error(`Error extracting data with AI:`, error.message);
    return {};
  }
}

/**
 * Enrich company from Crunchbase using AI
 */
export async function enrichFromCrunchbase(
  companyName: string
): Promise<Partial<EnrichedCompanyData>> {
  try {
    // Search Crunchbase
    const searchUrl = `https://www.crunchbase.com/discover/organization.companies/${encodeURIComponent(companyName)}`;
    const content = await fetchPageContent(searchUrl);
    
    if (!content || content.length < 100) {
      return {};
    }

    // Extract company link from search results
    const linkMatch = content.match(/crunchbase\.com\/organization\/[^"'\s]+/);
    if (!linkMatch) {
      return {};
    }

    const companyUrl = `https://www.${linkMatch[0]}`;
    const companyContent = await fetchPageContent(companyUrl);
    
    if (!companyContent || companyContent.length < 100) {
      return {};
    }

    const data = await extractCompanyDataWithAI(companyName, companyContent, 'Crunchbase');
    return {
      ...data,
      sources: ['crunchbase'],
    };
  } catch (error: any) {
    console.error(`[Crunchbase] Error enriching ${companyName}:`, error.message);
    return {};
  }
}

/**
 * Enrich company from LinkedIn using AI
 */
export async function enrichFromLinkedIn(
  companyName: string,
  linkedinUrl?: string
): Promise<Partial<EnrichedCompanyData>> {
  try {
    let url = linkedinUrl;
    if (!url) {
      const slug = companyName.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      url = `https://www.linkedin.com/company/${slug}`;
    }

    const content = await fetchPageContent(url);
    
    if (!content || content.length < 100) {
      return {};
    }

    const data = await extractCompanyDataWithAI(companyName, content, 'LinkedIn');
    return {
      ...data,
      linkedin_url: url,
      sources: ['linkedin'],
    };
  } catch (error: any) {
    console.error(`[LinkedIn] Error enriching ${companyName}:`, error.message);
    return {};
  }
}

/**
 * Enrich company from their website using AI
 */
export async function enrichFromWebsite(
  companyName: string,
  website: string
): Promise<Partial<EnrichedCompanyData>> {
  if (!website || !website.startsWith('http')) {
    return {};
  }

  try {
    // Try multiple pages
    const pages = [
      website,
      `${website}/about`,
      `${website}/about-us`,
      `${website}/company`,
      `${website}/team`,
    ];

    let allContent = '';
    
    for (const page of pages) {
      try {
        const content = await fetchPageContent(page);
        if (content && content.length > 100) {
          allContent += `\n\n--- Content from ${page} ---\n\n${content}`;
          // Limit total content
          if (allContent.length > 20000) break;
        }
      } catch (error) {
        // Page doesn't exist, continue
        continue;
      }
    }

    if (!allContent || allContent.length < 100) {
      return {};
    }

    const data = await extractCompanyDataWithAI(companyName, allContent, 'Company Website');
    return {
      ...data,
      website,
      sources: ['website'],
    };
  } catch (error: any) {
    console.error(`[Website] Error enriching ${website}:`, error.message);
    return {};
  }
}

/**
 * Get company logo URL from domain using Clearbit's logo API
 */
function getLogoUrl(website?: string, domain?: string): string | undefined {
  let domainToUse: string | undefined;
  
  if (domain) {
    domainToUse = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  } else if (website) {
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`);
      domainToUse = url.hostname.replace('www.', '');
    } catch {
      return undefined;
    }
  }
  
  if (domainToUse) {
    return `https://logo.clearbit.com/${domainToUse}`;
  }
  
  return undefined;
}

/**
 * Merge data from multiple sources intelligently
 */
export function mergeEnrichedData(
  sources: Partial<EnrichedCompanyData>[]
): EnrichedCompanyData {
  const merged: EnrichedCompanyData = {
    sources: [],
    scraped_at: new Date().toISOString(),
  };

  const allSources: string[] = [];

  for (const source of sources) {
    if (source.website && !merged.website) merged.website = source.website;
    if (source.description && !merged.description) merged.description = source.description;
    if (source.industry && !merged.industry) merged.industry = source.industry;
    if (source.employee_count && !merged.employee_count) merged.employee_count = source.employee_count;
    if (source.headquarters && !merged.headquarters) merged.headquarters = source.headquarters;
    if (source.founding_date && !merged.founding_date) merged.founding_date = source.founding_date;
    if (source.linkedin_url && !merged.linkedin_url) merged.linkedin_url = source.linkedin_url;
    if (source.twitter_handle && !merged.twitter_handle) merged.twitter_handle = source.twitter_handle;
    if (source.logo_url && !merged.logo_url) merged.logo_url = source.logo_url;
    
    // Financials (prefer Crunchbase)
    if (source.funding_amount && !merged.funding_amount) merged.funding_amount = source.funding_amount;
    if (source.funding_round && !merged.funding_round) merged.funding_round = source.funding_round;
    if (source.arr && !merged.arr) merged.arr = source.arr;
    if (source.revenue && !merged.revenue) merged.revenue = source.revenue;
    if (source.funding_rounds && !merged.funding_rounds) merged.funding_rounds = source.funding_rounds;
    
    if (source.sources) {
      allSources.push(...source.sources);
    }
  }

  merged.sources = [...new Set(allSources)];

  // Merge contacts (deduplicate by name)
  const contactMap = new Map<string, EnrichedContact>();
  
  for (const source of sources) {
    if (source.contacts) {
      for (const contact of source.contacts) {
        const key = `${contact.first_name.toLowerCase()}_${contact.last_name.toLowerCase()}`;
        const existing = contactMap.get(key);
        
        if (!existing) {
          contactMap.set(key, { ...contact });
        } else {
          // Merge: prefer emails from any source
          contactMap.set(key, {
            ...existing,
            ...contact,
            email: existing.email || contact.email,
            phone: existing.phone || contact.phone,
            title: existing.title || contact.title,
            is_founder: existing.is_founder || contact.is_founder,
          });
        }
      }
    }
  }

  merged.contacts = Array.from(contactMap.values());

  return merged;
}

/**
 * Use GPT with web search to find accurate funding amount for a company
 * This uses web search to find current information, then GPT to extract the accurate amount
 */
export async function findFundingAmountWithGPT(
  companyName: string,
  website?: string
): Promise<number | null> {
  try {
    const openai = getOpenAIClient();
    
    // Use GPT-4o to find accurate funding information
    // GPT-4o has access to recent information and can reason about funding data
    // It uses its built-in knowledge and reasoning to find the most accurate amount
    
    const fundingPrompt = `Find the accurate total funding amount raised by "${companyName}"${website ? ` (website: ${website})` : ''}.

IMPORTANT REQUIREMENTS:
1. Find the MOST RECENT total funding amount, including ALL funding rounds up to the latest one
2. Sum all funding rounds: Seed, Series A, B, C, D, etc.
3. Use reliable sources like Crunchbase, TechCrunch, company press releases, and recent news
4. Make sure you're including the latest funding round - don't use outdated totals
5. For example, if a company raised $50M in Series A and $65M in Series B, the total is $115M

Return ONLY the total funding amount in USD as a number (e.g., 115000000 for $115M).
Do not include any text, explanation, or currency symbols - just the number.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at finding accurate company funding information. Use your knowledge of all funding rounds and recent announcements to calculate the most accurate total funding amount. Return only the number in USD, no text.',
        },
        {
          role: 'user',
          content: fundingPrompt,
        },
      ],
      temperature: 0,
      max_tokens: 50,
    });

    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) return null;

    // Extract number from response (handle formats like "$115M", "115M", "115000000", etc.)
    const numberMatch = response.match(/(\d+(?:\.\d+)?)/);
    if (!numberMatch) return null;

    let amount = parseFloat(numberMatch[1]);
    
    // Check if response contains "M" (million) or "B" (billion)
    const upperResponse = response.toUpperCase();
    if (upperResponse.includes('M') && amount < 1000) {
      amount = amount * 1000000; // Convert millions to actual number
    } else if (upperResponse.includes('B') && amount < 1000) {
      amount = amount * 1000000000; // Convert billions to actual number
    } else if (upperResponse.includes('K') && amount < 1000000) {
      amount = amount * 1000; // Convert thousands to actual number
    }

    return Math.round(amount);
  } catch (error: any) {
    console.error(`[GPT Funding Search] Error finding funding for ${companyName}:`, error.message);
    return null;
  }
}

/**
 * Enrich company from all available sources using AI
 */
export async function enrichCompanyWithAI(
  companyName: string,
  website?: string,
  linkedinUrl?: string
): Promise<EnrichedCompanyData> {
  // Fetch from all sources in parallel
  const [crunchbaseData, linkedinData, websiteData] = await Promise.all([
    enrichFromCrunchbase(companyName).catch(() => ({})),
    enrichFromLinkedIn(companyName, linkedinUrl).catch(() => ({})),
    website ? enrichFromWebsite(companyName, website).catch(() => ({})) : Promise.resolve({}),
  ]);

  // Use GPT to find accurate funding amount (prioritize this over scraped data)
  const gptFundingAmount = await findFundingAmountWithGPT(companyName, website || crunchbaseData.website || websiteData.website).catch(() => null);
  
  // Merge all data
  const merged = mergeEnrichedData([crunchbaseData, linkedinData, websiteData]);
  
  // Override funding amount with GPT-found amount if available
  if (gptFundingAmount) {
    merged.funding_amount = gptFundingAmount;
    merged.sources = [...(merged.sources || []), 'gpt-web-search'];
  }

  // Add logo URL if we have a website but no logo_url yet
  if (!merged.logo_url && merged.website) {
    merged.logo_url = getLogoUrl(merged.website);
  }

  return merged;
}

