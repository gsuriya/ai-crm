/**
 * Company Data Scraping Service
 * 
 * Scrapes company data from multiple sources:
 * - Crunchbase: Funding rounds, founders, financials
 * - LinkedIn: Employees, founders, company info, contact emails
 * - Company Websites: About pages, team pages, contact info
 * 
 * Uses Puppeteer for web scraping with minimal delays (prioritizing speed)
 */

import puppeteer from 'puppeteer';
import OpenAI from 'openai';

// Initialize OpenAI client for email extraction
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set - email extraction from text will be limited');
    return null;
  }
  return new OpenAI({ apiKey });
}

export interface ScrapedContact {
  first_name: string;
  last_name: string;
  title?: string;
  email?: string;
  phone?: string;
  is_founder?: boolean;
  source?: string;
}

export interface ScrapedFundingRound {
  round_type: string;
  amount: number;
  date: string;
  lead_investor?: string;
  participants?: string[];
  source?: string;
}

export interface ScrapedCompanyData {
  // Overview
  website?: string;
  description?: string;
  industry?: string;
  employee_count?: number;
  headquarters?: string;
  founding_date?: string;
  linkedin_url?: string;
  twitter_handle?: string;
  
  // Financials
  funding_amount?: number;
  funding_round?: string;
  arr?: number;
  revenue?: number;
  funding_rounds?: ScrapedFundingRound[];
  
  // People
  contacts?: ScrapedContact[];
  
  // Metadata
  sources?: string[];
  scraped_at?: string;
}

/**
 * Extract email addresses from text using pattern matching
 */
function extractEmails(text: string, domain?: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(emailRegex) || [];
  
  // Filter by domain if provided
  if (domain) {
    const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    return emails.filter(email => email.toLowerCase().endsWith(`@${normalizedDomain}`));
  }
  
  return emails;
}

/**
 * Generate email patterns for a person
 */
function generateEmailPatterns(firstName: string, lastName: string, domain: string): string[] {
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = lastName.toLowerCase().replace(/[^a-z]/g, '');
  const patterns = [
    `${f}.${l}@${domain}`,
    `${f}${l}@${domain}`,
    `${f}_${l}@${domain}`,
    `${f}-${l}@${domain}`,
    `${f}@${domain}`,
    `${l}@${domain}`,
    `${f[0]}${l}@${domain}`,
    `${f}${l[0]}@${domain}`,
  ];
  return patterns;
}

/**
 * Extract emails from unstructured text using AI
 */
async function extractEmailsWithAI(text: string, domain?: string): Promise<string[]> {
  const openai = getOpenAIClient();
  if (!openai) return [];

  try {
    const prompt = `Extract all email addresses from the following text. Return ONLY a JSON array of email addresses, nothing else.

Text:
${text.substring(0, 2000)}

${domain ? `Prefer emails from domain: ${domain}` : ''}

Return format: ["email1@example.com", "email2@example.com"]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) return [];

    // Try to parse JSON array
    try {
      const emails = JSON.parse(content);
      if (Array.isArray(emails)) {
        return emails.filter((e: any) => typeof e === 'string' && e.includes('@'));
      }
    } catch {
      // If not JSON, try to extract emails from text
      return extractEmails(content, domain);
    }
  } catch (error) {
    console.error('Error extracting emails with AI:', error);
  }

  return [];
}

/**
 * Retry wrapper for scraping functions
 */
async function retryScrape<T>(
  fn: () => Promise<T | null>,
  maxRetries: number = 2,
  delay: number = 1000
): Promise<T | null> {
  let lastError: any = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await fn();
      if (result !== null) return result;
      // If result is null, try again
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    } catch (error: any) {
      lastError = error;
      if (i === maxRetries - 1) {
        // On last retry, return null instead of throwing
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  return null;
}

/**
 * Scrape Crunchbase company page
 */
export async function scrapeCrunchbase(
  companyName: string,
  domain?: string
): Promise<ScrapedCompanyData | null> {
  return retryScrape(async () => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Search for company on Crunchbase
    const searchUrl = `https://www.crunchbase.com/discover/organization.companies/${encodeURIComponent(companyName)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Try to find company link in search results
    const companyLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/organization/"]'));
      if (links.length > 0) {
        return (links[0] as HTMLAnchorElement).href;
      }
      return null;
    });

    if (!companyLink) {
      console.log(`[Crunchbase] Company not found: ${companyName}`);
      return null;
    }

    // Navigate to company page
    await page.goto(companyLink, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Extract company data
    const data = await page.evaluate(() => {
      const result: any = {};

      // Description
      const descEl = document.querySelector('[data-test-id="description"]') || 
                     document.querySelector('.description') ||
                     document.querySelector('[class*="description"]');
      if (descEl) result.description = descEl.textContent?.trim();

      // Industry
      const industryEl = document.querySelector('[data-test-id="categories"]') ||
                         document.querySelector('[class*="category"]');
      if (industryEl) {
        const industries = Array.from(industryEl.querySelectorAll('a, span')).map(el => el.textContent?.trim()).filter(Boolean);
        result.industry = industries[0] || industries.join(', ');
      }

      // Employee count
      const employeeEl = document.querySelector('[data-test-id="employee-count"]') ||
                         document.querySelector('[class*="employee"]');
      if (employeeEl) {
        const text = employeeEl.textContent || '';
        const match = text.match(/(\d+[\d,]*)\s*(?:employees|people)/i);
        if (match) {
          result.employee_count = parseInt(match[1].replace(/,/g, ''), 10);
        }
      }

      // Headquarters
      const hqEl = document.querySelector('[data-test-id="headquarters"]') ||
                   document.querySelector('[class*="headquarters"]');
      if (hqEl) result.headquarters = hqEl.textContent?.trim();

      // Founding date
      const foundedEl = document.querySelector('[data-test-id="founded"]') ||
                        document.querySelector('[class*="founded"]');
      if (foundedEl) {
        const text = foundedEl.textContent || '';
        const yearMatch = text.match(/(\d{4})/);
        if (yearMatch) {
          result.founding_date = `${yearMatch[1]}-01-01`;
        }
      }

      // Website
      const websiteEl = document.querySelector('a[href^="http"]:not([href*="crunchbase"])');
      if (websiteEl) {
        const href = (websiteEl as HTMLAnchorElement).href;
        if (href && !href.includes('crunchbase.com')) {
          result.website = href;
        }
      }

      // LinkedIn
      const linkedinEl = document.querySelector('a[href*="linkedin.com"]');
      if (linkedinEl) {
        result.linkedin_url = (linkedinEl as HTMLAnchorElement).href;
      }

      // Funding rounds
      result.funding_rounds = [];
      const fundingSection = document.querySelector('[data-test-id="funding-rounds"]') ||
                            document.querySelector('[class*="funding"]');
      if (fundingSection) {
        const rounds = fundingSection.querySelectorAll('[class*="round"], [class*="funding"]');
        rounds.forEach((round: Element) => {
          const roundData: any = {};
          const text = round.textContent || '';
          
          // Round type
          const roundTypeMatch = text.match(/(seed|series\s+[a-z]|pre-seed|angel|venture|round)/i);
          if (roundTypeMatch) roundData.round_type = roundTypeMatch[0];

          // Amount
          const amountMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*(?:M|million|K|thousand|B|billion)/i);
          if (amountMatch) {
            const num = parseFloat(amountMatch[1]);
            const unit = text.toLowerCase().includes('million') || text.includes('M') ? 1000000 :
                        text.toLowerCase().includes('billion') || text.includes('B') ? 1000000000 :
                        text.toLowerCase().includes('thousand') || text.includes('K') ? 1000 : 1;
            roundData.amount = num * unit;
          }

          // Date
          const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})|(\w+\s+\d{4})/);
          if (dateMatch) roundData.date = dateMatch[0];

          if (roundData.round_type || roundData.amount) {
            result.funding_rounds.push(roundData);
          }
        });
      }

      // Total funding
      const totalFundingEl = document.querySelector('[data-test-id="total-funding"]') ||
                            document.querySelector('[class*="total-funding"]');
      if (totalFundingEl) {
        const text = totalFundingEl.textContent || '';
        const match = text.match(/\$?(\d+(?:\.\d+)?)\s*(?:M|million|K|thousand|B|billion)/i);
        if (match) {
          const num = parseFloat(match[1]);
          const unit = text.toLowerCase().includes('million') || text.includes('M') ? 1000000 :
                      text.toLowerCase().includes('billion') || text.includes('B') ? 1000000000 :
                      text.toLowerCase().includes('thousand') || text.includes('K') ? 1000 : 1;
          result.funding_amount = num * unit;
        }
      }

      // Founders/Team
      result.contacts = [];
      const teamSection = document.querySelector('[data-test-id="team"]') ||
                         document.querySelector('[class*="team"]') ||
                         document.querySelector('[class*="founder"]');
      if (teamSection) {
        const people = teamSection.querySelectorAll('[class*="person"], [class*="founder"], a[href*="/person/"]');
        people.forEach((person: Element) => {
          const nameText = person.textContent?.trim() || '';
          const nameParts = nameText.split(/\s+/);
          if (nameParts.length >= 2) {
            const contact: any = {
              first_name: nameParts[0],
              last_name: nameParts.slice(1).join(' '),
              source: 'crunchbase',
            };
            
            // Check if founder
            const titleText = person.textContent?.toLowerCase() || '';
            if (titleText.includes('founder') || titleText.includes('ceo') || titleText.includes('co-founder')) {
              contact.is_founder = true;
              contact.title = titleText.match(/(founder|ceo|co-founder)/i)?.[0] || 'Founder';
            }
            
            result.contacts.push(contact);
          }
        });
      }

      return result;
    });

    data.sources = ['crunchbase'];
    data.scraped_at = new Date().toISOString();

      return data as ScrapedCompanyData;
    } catch (error: any) {
      console.error(`[Crunchbase] Error scraping ${companyName}:`, error.message);
      throw error;
    } finally {
      await browser.close();
    }
  });
}

/**
 * Scrape LinkedIn company page
 */
export async function scrapeLinkedIn(
  companyName: string,
  linkedinUrl?: string
): Promise<ScrapedCompanyData | null> {
  return retryScrape(async () => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Build LinkedIn URL
    let url = linkedinUrl;
    if (!url) {
      // Try to construct URL from company name
      const slug = companyName.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      url = `https://www.linkedin.com/company/${slug}`;
    }

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if login required
    const needsLogin = await page.evaluate(() => {
      return document.body.textContent?.includes('Sign in') ||
             document.body.textContent?.includes('Join now') ||
             window.location.href.includes('/login');
    });

    if (needsLogin) {
      console.log(`[LinkedIn] Login required for ${companyName}`);
      // Try to login if credentials available
      const email = process.env.LINKEDIN_EMAIL;
      const password = process.env.LINKEDIN_PASSWORD;
      
      if (email && password) {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle0' });
        await page.waitForSelector('#username', { timeout: 10000 });
        await page.type('#username', email);
        await page.type('#password', password);
        await page.click('button[type="submit"]');
        await new Promise(resolve => setTimeout(resolve, 3000));
        await page.goto(url, { waitUntil: 'networkidle0' });
      } else {
        return null;
      }
    }

    // Extract company data
    const data = await page.evaluate(() => {
      const result: any = {};

      // Description
      const descEl = document.querySelector('[data-test-id="about-us-description"]') ||
                     document.querySelector('.org-top-card-summary-info-list__info-item') ||
                     document.querySelector('[class*="description"]');
      if (descEl) result.description = descEl.textContent?.trim();

      // Industry
      const industryEl = document.querySelector('[data-test-id="industry"]') ||
                         document.querySelector('[class*="industry"]');
      if (industryEl) result.industry = industryEl.textContent?.trim();

      // Employee count
      const employeeEl = document.querySelector('[data-test-id="company-size"]') ||
                         document.querySelector('[class*="employee"]');
      if (employeeEl) {
        const text = employeeEl.textContent || '';
        const match = text.match(/(\d+[\d,]*)\s*(?:employees|people)/i);
        if (match) {
          result.employee_count = parseInt(match[1].replace(/,/g, ''), 10);
        }
      }

      // Headquarters
      const hqEl = document.querySelector('[data-test-id="headquarters"]') ||
                   document.querySelector('[class*="headquarters"]');
      if (hqEl) result.headquarters = hqEl.textContent?.trim();

      // Website
      const websiteEl = document.querySelector('a[data-test-id="website"]') ||
                       document.querySelector('a[href^="http"]:not([href*="linkedin"])');
      if (websiteEl) {
        const href = (websiteEl as HTMLAnchorElement).href;
        if (href && !href.includes('linkedin.com')) {
          result.website = href;
        }
      }

      // Twitter
      const twitterEl = document.querySelector('a[href*="twitter.com"]') ||
                       document.querySelector('a[href*="x.com"]');
      if (twitterEl) {
        const href = (twitterEl as HTMLAnchorElement).href;
        const match = href.match(/(?:twitter\.com|x\.com)\/([^/]+)/);
        if (match) result.twitter_handle = match[1].replace('@', '');
      }

      // People/Employees
      result.contacts = [];
      
      // Try to navigate to people page
      const peopleLink = Array.from(document.querySelectorAll('a')).find(a => 
        a.textContent?.toLowerCase().includes('people') || 
        a.href?.includes('/people')
      );
      
      // Extract from current page if available
      const peopleSection = document.querySelector('[class*="people"]') ||
                           document.querySelector('[class*="employee"]');
      if (peopleSection) {
        const people = peopleSection.querySelectorAll('a[href*="/in/"], [class*="person"]');
        people.forEach((person: Element) => {
          const nameText = person.textContent?.trim() || '';
          const nameParts = nameText.split(/\s+/);
          if (nameParts.length >= 2) {
            const contact: any = {
              first_name: nameParts[0],
              last_name: nameParts.slice(1).join(' '),
              source: 'linkedin',
            };
            
            // Try to get title
            const titleEl = person.closest('[class*="card"]')?.querySelector('[class*="title"]');
            if (titleEl) {
              contact.title = titleEl.textContent?.trim();
              const titleLower = contact.title.toLowerCase();
              if (titleLower.includes('founder') || titleLower.includes('ceo') || titleLower.includes('co-founder')) {
                contact.is_founder = true;
              }
            }
            
            result.contacts.push(contact);
          }
        });
      }

      return result;
    });

    // Try to get more people from people page
    try {
      const peopleUrl = url.replace(/\/$/, '') + '/people';
      await page.goto(peopleUrl, { waitUntil: 'networkidle0', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const morePeople = await page.evaluate(() => {
        const contacts: any[] = [];
        const people = document.querySelectorAll('a[href*="/in/"]');
        
        people.forEach((person: Element) => {
          const nameText = person.textContent?.trim() || '';
          const nameParts = nameText.split(/\s+/);
          if (nameParts.length >= 2) {
            const contact: any = {
              first_name: nameParts[0],
              last_name: nameParts.slice(1).join(' '),
              source: 'linkedin',
            };
            
            // Get title from nearby element
            const card = person.closest('[class*="card"], [class*="profile"]');
            if (card) {
              const titleEl = card.querySelector('[class*="title"], [class*="headline"]');
              if (titleEl) {
                contact.title = titleEl.textContent?.trim();
                const titleLower = contact.title.toLowerCase();
                if (titleLower.includes('founder') || titleLower.includes('ceo') || titleLower.includes('co-founder')) {
                  contact.is_founder = true;
                }
              }
            }
            
            contacts.push(contact);
          }
        });
        
        return contacts;
      });

      if (morePeople && morePeople.length > 0) {
        data.contacts = [...(data.contacts || []), ...morePeople];
      }
    } catch (error) {
      // People page might not be accessible
    }

    data.sources = ['linkedin'];
    data.scraped_at = new Date().toISOString();
    data.linkedin_url = url;

      return data as ScrapedCompanyData;
    } catch (error: any) {
      console.error(`[LinkedIn] Error scraping ${companyName}:`, error.message);
      throw error;
    } finally {
      await browser.close();
    }
  });
}

/**
 * Scrape company website
 */
export async function scrapeCompanyWebsite(
  website: string
): Promise<ScrapedCompanyData | null> {
  if (!website || !website.startsWith('http')) {
    return null;
  }

  return retryScrape(async () => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const baseUrl = website.split('/').slice(0, 3).join('/');

    // Scrape main page
    await page.goto(website, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 500));

    const mainPageData = await page.evaluate(() => {
      const result: any = {};

      // Description (meta or first paragraph)
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        result.description = (metaDesc as HTMLMetaElement).content;
      } else {
        const descEl = document.querySelector('p, [class*="description"], [class*="about"]');
        if (descEl) result.description = descEl.textContent?.trim().substring(0, 500);
      }

      return result;
    });

    // Try to scrape about page
    let aboutData: any = {};
    const aboutUrls = [`${baseUrl}/about`, `${baseUrl}/about-us`, `${baseUrl}/company`, `${baseUrl}/team`];
    
    for (const aboutUrl of aboutUrls) {
      try {
        await page.goto(aboutUrl, { waitUntil: 'networkidle0', timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 500));

        aboutData = await page.evaluate(() => {
          const result: any = {};

          // Description
          const descEl = document.querySelector('[class*="about"], [class*="description"], main p, article p');
          if (descEl) {
            const text = descEl.textContent?.trim();
            if (text && text.length > 50) {
              result.description = text.substring(0, 1000);
            }
          }

          // Team members
          result.contacts = [];
          const teamSelectors = [
            '[class*="team"]',
            '[class*="founder"]',
            '[class*="leadership"]',
            '[class*="executive"]',
            '[id*="team"]',
          ];

          teamSelectors.forEach(selector => {
            const teamSection = document.querySelector(selector);
            if (teamSection) {
              const people = teamSection.querySelectorAll('h2, h3, h4, [class*="name"], [class*="person"]');
              people.forEach((person: Element) => {
                const nameText = person.textContent?.trim() || '';
                const nameParts = nameText.split(/\s+/).filter(p => p.length > 1);
                if (nameParts.length >= 2) {
                  const contact: any = {
                    first_name: nameParts[0],
                    last_name: nameParts.slice(1).join(' '),
                    source: 'website',
                  };

                  // Try to find title nearby
                  const parent = person.parentElement;
                  if (parent) {
                    const titleEl = parent.querySelector('[class*="title"], [class*="role"], p');
                    if (titleEl) {
                      contact.title = titleEl.textContent?.trim();
                      const titleLower = contact.title.toLowerCase();
                      if (titleLower.includes('founder') || titleLower.includes('ceo') || titleLower.includes('co-founder')) {
                        contact.is_founder = true;
                      }
                    }
                  }

                  result.contacts.push(contact);
                }
              });
            }
          });

          return result;
        });

        if (aboutData.description || (aboutData.contacts && aboutData.contacts.length > 0)) {
          break; // Found useful data
        }
      } catch (error) {
        // Page doesn't exist, try next
        continue;
      }
    }

    // Extract emails from all pages
    const allText = await page.evaluate(() => document.body.textContent || '');
    const emails = extractEmails(allText, domain);
    
    // Try to match emails to contacts
    if (aboutData.contacts && emails.length > 0) {
      aboutData.contacts.forEach((contact: any) => {
        if (!contact.email) {
          // Try to find matching email
          const patterns = generateEmailPatterns(contact.first_name, contact.last_name, domain);
          const matchingEmail = emails.find(email => 
            patterns.some(pattern => email.toLowerCase() === pattern.toLowerCase())
          );
          if (matchingEmail) {
            contact.email = matchingEmail;
          }
        }
      });
    }

    const result: ScrapedCompanyData = {
      website,
      description: aboutData.description || mainPageData.description,
      contacts: aboutData.contacts || [],
      sources: ['website'],
      scraped_at: new Date().toISOString(),
    };

      return result;
    } catch (error: any) {
      console.error(`[Website] Error scraping ${website}:`, error.message);
      throw error;
    } finally {
      await browser.close();
    }
  });
}

/**
 * Merge data from multiple sources intelligently
 */
export function mergeScrapedData(
  sources: (ScrapedCompanyData | null)[]
): ScrapedCompanyData {
  const validSources = sources.filter((s): s is ScrapedCompanyData => s !== null);
  
  if (validSources.length === 0) {
    return {};
  }

  const merged: ScrapedCompanyData = {
    sources: [],
    scraped_at: new Date().toISOString(),
  };

  // Merge overview data (prefer website for description, Crunchbase for financials)
  for (const source of validSources) {
    if (source.website && !merged.website) merged.website = source.website;
    if (source.description && !merged.description) merged.description = source.description;
    if (source.industry && !merged.industry) merged.industry = source.industry;
    if (source.employee_count && !merged.employee_count) merged.employee_count = source.employee_count;
    if (source.headquarters && !merged.headquarters) merged.headquarters = source.headquarters;
    if (source.founding_date && !merged.founding_date) merged.founding_date = source.founding_date;
    if (source.linkedin_url && !merged.linkedin_url) merged.linkedin_url = source.linkedin_url;
    if (source.twitter_handle && !merged.twitter_handle) merged.twitter_handle = source.twitter_handle;
    
    // Financials (prefer Crunchbase)
    if (source.funding_amount && !merged.funding_amount) merged.funding_amount = source.funding_amount;
    if (source.funding_round && !merged.funding_round) merged.funding_round = source.funding_round;
    if (source.arr && !merged.arr) merged.arr = source.arr;
    if (source.revenue && !merged.revenue) merged.revenue = source.revenue;
    if (source.funding_rounds && !merged.funding_rounds) merged.funding_rounds = source.funding_rounds;
    
    if (source.sources) {
      merged.sources = [...(merged.sources || []), ...source.sources];
    }
  }

  // Merge contacts (deduplicate by name, prefer LinkedIn)
  const contactMap = new Map<string, ScrapedContact>();
  
  for (const source of validSources) {
    if (source.contacts) {
      for (const contact of source.contacts) {
        const key = `${contact.first_name.toLowerCase()}_${contact.last_name.toLowerCase()}`;
        const existing = contactMap.get(key);
        
        if (!existing) {
          contactMap.set(key, { ...contact });
        } else {
          // Merge: prefer LinkedIn data, but keep emails from any source
          const mergedContact: ScrapedContact = {
            ...existing,
            ...contact,
            email: existing.email || contact.email,
            phone: existing.phone || contact.phone,
            title: existing.title || contact.title,
            is_founder: existing.is_founder || contact.is_founder,
          };
          contactMap.set(key, mergedContact);
        }
      }
    }
  }

  merged.contacts = Array.from(contactMap.values());

  return merged;
}

/**
 * Scrape company from all available sources
 */
export async function scrapeCompany(
  companyName: string,
  website?: string,
  linkedinUrl?: string
): Promise<ScrapedCompanyData> {
  const domain = website ? website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : undefined;

  // Scrape from all sources in parallel
  const [crunchbaseData, linkedinData, websiteData] = await Promise.all([
    scrapeCrunchbase(companyName, domain).catch(() => null),
    scrapeLinkedIn(companyName, linkedinUrl).catch(() => null),
    website ? scrapeCompanyWebsite(website).catch(() => null) : Promise.resolve(null),
  ]);

  // Merge all data
  const merged = mergeScrapedData([crunchbaseData, linkedinData, websiteData]);

  // Try to enrich emails for contacts
  if (merged.contacts && domain) {
    for (const contact of merged.contacts) {
      if (!contact.email) {
        // Try pattern matching
        const patterns = generateEmailPatterns(contact.first_name, contact.last_name, domain);
        // Note: We can't verify emails without sending, so we'll store patterns for manual verification
        // For now, we'll leave email extraction to the database update logic
      }
    }
  }

  return merged;
}

