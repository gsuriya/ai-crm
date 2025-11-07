/**
 * Comprehensive Company Monitoring Service using Puppeteer
 * Checks website, job postings, LinkedIn posts, Twitter, and news for relevant company updates
 * 
 * AUTHENTICATION (OPTIONAL):
 * - LinkedIn: Works without login for many public company pages. If login is required and credentials are provided, will auto-login.
 * - Twitter/X: May work without login for public profiles. If login is required and credentials are provided, will auto-login.
 * - Company websites: Usually public, no auth needed
 * - Google search: Public, no auth needed
 * 
 * Optional environment variables (only needed if sites require login):
 * LINKEDIN_EMAIL=your_email@example.com
 * LINKEDIN_PASSWORD=your_password
 * TWITTER_USERNAME=your_username_or_email
 * TWITTER_PASSWORD=your_password
 */

import puppeteer from 'puppeteer';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// Lazy initialization of OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for event filtering');
  }
  return new OpenAI({ apiKey });
}

// Directory to store browser sessions and cookies
const SESSIONS_DIR = path.join(process.cwd(), '.browser-sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Save cookies for a domain to a file
 */
async function saveCookies(page: puppeteer.Page, domain: string): Promise<void> {
  try {
    const cookies = await page.cookies();
    const cookieFile = path.join(SESSIONS_DIR, `${domain}-cookies.json`);
    fs.writeFileSync(cookieFile, JSON.stringify(cookies, null, 2));
    console.log(`[Monitoring] 💾 Saved cookies for ${domain}`);
  } catch (error: any) {
    console.error(`[Monitoring] Error saving cookies for ${domain}:`, error.message);
  }
}

/**
 * Load cookies for a domain from a file
 */
async function loadCookies(page: puppeteer.Page, domain: string): Promise<boolean> {
  try {
    const cookieFile = path.join(SESSIONS_DIR, `${domain}-cookies.json`);
    if (!fs.existsSync(cookieFile)) {
      return false;
    }

    const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
      console.log(`[Monitoring] ✅ Loaded saved cookies for ${domain}`);
      return true;
    }
    return false;
  } catch (error: any) {
    console.error(`[Monitoring] Error loading cookies for ${domain}:`, error.message);
    return false;
  }
}

/**
 * Check if user is already logged in to a domain
 */
async function isLoggedIn(page: puppeteer.Page, domain: string, checkUrl: string): Promise<boolean> {
  try {
    await page.goto(checkUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const isSignInPage = await page.evaluate(() => {
      return document.body.textContent?.includes('Sign in') || 
             document.body.textContent?.includes('Join now') ||
             document.body.textContent?.includes('Log in') ||
             window.location.href.includes('/login') ||
             window.location.href.includes('/checkpoint') ||
             window.location.href.includes('/i/flow/login');
    });

    return !isSignInPage;
  } catch (error: any) {
    return false;
  }
}

export interface CompanyMonitoringResult {
  websiteNews: any[];
  jobPostings: any[];
  linkedinPosts: any[];
  twitterPosts: any[];
  newsArticles: any[];
  filteredEvents: CompanyEvent[];
}

export interface CompanyEvent {
  title: string;
  description: string;
  category: 'product_release' | 'revenue_growth' | 'hiring' | 'funding' | 'customer_win' | 'positive_news' | 'other';
  source_url: string;
  source_type: 'website' | 'jobs' | 'linkedin' | 'twitter' | 'news';
  detected_at: string;
  metadata: any;
}

interface Company {
  id: string;
  name: string;
  website?: string;
  linkedin_url?: string;
  twitter_handle?: string;
}

/**
 * Monitor company for relevant updates using Puppeteer
 */
export async function monitorCompanyWithPuppeteer(
  company: Company
): Promise<CompanyMonitoringResult> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Use persistent browser profile to save login sessions
  const userDataDir = path.join(SESSIONS_DIR, 'browser-profile');
  
  // Launch browser with persistent profile - keeps you logged in
  const browser = await puppeteer.launch({
    headless: false, // Show browser so user can see what's happening
    defaultViewport: { width: 1280, height: 720 },
    args: [
      '--start-maximized', 
      '--disable-blink-features=AutomationControlled',
      '--window-position=0,0', // Position at top-left so it's visible
    ],
    slowMo: 150, // Slow down actions by 150ms so you can see what's happening
    userDataDir: userDataDir, // Persistent profile - saves login sessions
  });

  try {
    const results: CompanyMonitoringResult = {
      websiteNews: [],
      jobPostings: [],
      linkedinPosts: [],
      twitterPosts: [],
      newsArticles: [],
      filteredEvents: [],
    };

    // 1. Check company website for news/blog posts
    if (company.website) {
      console.log(`\n[Monitoring] 🌐 Step 1/5: Checking website: ${company.website}`);
      results.websiteNews = await scrapeWebsiteNews(browser, company.website, company.name);
      console.log(`[Monitoring] ✅ Found ${results.websiteNews.length} website news items`);
    }

    // 2. Check for job postings (LinkedIn Jobs + company careers page)
    if (company.website || company.linkedin_url) {
      console.log(`\n[Monitoring] 💼 Step 2/5: Checking job postings...`);
      results.jobPostings = await scrapeJobPostings(browser, company.website, company.linkedin_url, company.name);
      console.log(`[Monitoring] ✅ Found ${results.jobPostings.length} job postings`);
    }

    // 3. Check LinkedIn posts
    if (company.linkedin_url) {
      console.log(`\n[Monitoring] 💼 Step 3/5: Checking LinkedIn posts: ${company.linkedin_url}`);
      results.linkedinPosts = await scrapeLinkedInPosts(browser, company.linkedin_url, company.name);
      console.log(`[Monitoring] ✅ Found ${results.linkedinPosts.length} LinkedIn posts`);
    }

    // 4. Check Twitter/X account
    if (company.twitter_handle) {
      console.log(`\n[Monitoring] 🐦 Step 4/5: Checking Twitter: @${company.twitter_handle}`);
      results.twitterPosts = await scrapeTwitter(browser, company.twitter_handle, company.name);
      console.log(`[Monitoring] ✅ Found ${results.twitterPosts.length} Twitter posts`);
    }

    // 5. Check general news (Google search, then read article pages)
    console.log(`\n[Monitoring] 📰 Step 5/5: Checking news articles via Google search...`);
    results.newsArticles = await scrapeNews(browser, company.name);
    console.log(`[Monitoring] ✅ Found ${results.newsArticles.length} news articles`);

    // 6. Use GPT to filter and categorize events
    console.log(`[Monitoring] Analyzing and filtering events...`);
    const allContent = [
      ...results.websiteNews.map(item => ({ type: 'website', ...item })),
      ...results.jobPostings.map(item => ({ type: 'jobs', ...item })),
      ...results.linkedinPosts.map(item => ({ type: 'linkedin', ...item })),
      ...results.twitterPosts.map(item => ({ type: 'twitter', ...item })),
      ...results.newsArticles.map(item => ({ type: 'news', ...item })),
    ];

    if (allContent.length > 0) {
      results.filteredEvents = await filterAndCategorizeEvents(allContent, company.name);
    }

    // Keep browser open for a bit so user can see results (only in test mode)
    if (process.env.KEEP_BROWSER_OPEN === 'true') {
      console.log('\n[Monitoring] ⏸️  Browser will stay open for 60 seconds for inspection...');
      console.log('[Monitoring] 👀 Watch the browser window to see what happened!');
      await delay(60000);
    }

    await browser.close();
    return results;

  } catch (error: any) {
    await browser.close();
    console.error('[Monitoring] Error:', error.message);
    throw error;
  }
}

/**
 * Use LLM to analyze page and find navigation paths to news/blog content
 */
async function findNewsSectionWithLLM(
  page: puppeteer.Page,
  website: string,
  companyName: string
): Promise<string | null> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  try {
    // First, go to homepage
    await page.goto(website, { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(2000);

    // Extract page structure: links, navigation, headings
    const pageStructure = await page.evaluate(() => {
      const links: Array<{text: string, href: string, visible: boolean}> = [];
      const navLinks = Array.from(document.querySelectorAll('nav a, header a, [role="navigation"] a, .menu a, .navigation a'));
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      
      // Get navigation links first
      navLinks.forEach(link => {
        const text = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        const rect = link.getBoundingClientRect();
        if (text && href && rect.width > 0 && rect.height > 0) {
          links.push({ text, href, visible: true });
        }
      });

      // Get other prominent links
      allLinks.slice(0, 50).forEach(link => {
        const text = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        const rect = link.getBoundingClientRect();
        if (text && href && !links.find(l => l.href === href) && rect.width > 0 && rect.height > 0) {
          links.push({ text, href, visible: true });
        }
      });

      // Get page headings
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 20).map(h => h.textContent?.trim() || '').filter(Boolean);

      return {
        url: window.location.href,
        title: document.title,
        headings,
        links: links.slice(0, 30), // Limit to 30 most relevant links
        hasNav: !!document.querySelector('nav, [role="navigation"]'),
      };
    });

    // Use GPT to analyze and find the best path to news/blog content
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are analyzing a company website to find where they post news, blog posts, announcements, or updates.

GOAL: Find the URL path to their news/blog/announcements section.

Given the page structure (links, headings, navigation), identify:
1. Links that likely lead to news/blog/announcements (look for: "News", "Blog", "Press", "Updates", "Announcements", "Media", "Stories", "Insights")
2. The most likely URL path to find recent company updates

Return ONLY a JSON object with:
- "url": The full URL path to the news/blog section (or null if not found)
- "reasoning": Brief explanation of why this URL was chosen

If multiple options exist, choose the one most likely to contain recent company updates/news.`
        },
        {
          role: 'user',
          content: `Analyze this website structure for ${companyName}:

Current URL: ${pageStructure.url}
Page Title: ${pageStructure.title}
Headings: ${pageStructure.headings.join(', ')}
Navigation Links: ${JSON.stringify(pageStructure.links, null, 2)}

Find the best URL path to their news/blog/announcements section.`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0]?.message?.content || '{"url": null}');
    return analysis.url || null;

  } catch (error: any) {
    console.error(`[Monitoring] LLM navigation error:`, error.message);
    return null;
  }
}

/**
 * Scrape company website for news/blog posts using LLM-guided navigation
 */
async function scrapeWebsiteNews(
  browser: puppeteer.Browser,
  website: string,
  companyName: string
): Promise<any[]> {
  const page = await browser.newPage();
  const news: any[] = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    console.log(`[Monitoring] 🤖 Using LLM to find news/blog section on ${website}...`);
    
    // Use LLM to find the right URL
    const newsUrl = await findNewsSectionWithLLM(page, website, companyName);
    
    if (!newsUrl) {
      console.log(`[Monitoring] ⚠️  Could not find news/blog section. Trying homepage for any updates...`);
      // Fallback: try homepage for any recent content
      await page.goto(website, { waitUntil: 'networkidle2', timeout: 10000 });
      await delay(2000);
    } else {
      console.log(`[Monitoring] ✅ LLM found news section: ${newsUrl}`);
      await page.goto(newsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await delay(2000);
    }

    // Use LLM to identify and extract news/blog articles from the page
    console.log(`[Monitoring] 🤖 Using LLM to identify news articles on the page...`);
    const articles = await page.evaluate(() => {
      // Extract all potential article elements with their content
      const candidates: Array<{
        element: string;
        title: string;
        text: string;
        url: string;
        date: string;
        selector: string;
      }> = [];

      // Try various selectors
          const selectors = [
            'article',
        '[class*="post"]',
        '[class*="article"]',
            '[class*="news"]',
            '[class*="blog"]',
        '[class*="card"]',
        '[class*="item"]',
      ];

      selectors.forEach(selector => {
        const elements = Array.from(document.querySelectorAll(selector));
        elements.slice(0, 20).forEach((el, idx) => {
          try {
            const titleEl = el.querySelector('h1, h2, h3, h4, [class*="title"], [class*="heading"]');
            const linkEl = el.querySelector('a[href]') || el.closest('a[href]');
            const dateEl = el.querySelector('time, [class*="date"], [class*="time"]');
            const textEl = el.querySelector('p, [class*="excerpt"], [class*="summary"], [class*="description"]');

              const title = titleEl?.textContent?.trim() || '';
              const url = linkEl?.getAttribute('href') || '';
              const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
              const date = dateEl?.getAttribute('datetime') || dateEl?.textContent?.trim() || '';
            const text = (textEl?.textContent?.trim() || el.textContent?.trim() || '').substring(0, 500);

              if (title && title.length > 10) {
              candidates.push({
                element: el.outerHTML.substring(0, 200),
                  title,
                text,
                url: fullUrl || window.location.href,
                  date,
                selector,
                });
              }
            } catch (e) {
            // Skip
            }
        });
          });

      return candidates;
    });

    // Use GPT to filter and extract only actual news/blog articles
        if (articles.length > 0) {
      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are analyzing webpage content to identify actual news articles, blog posts, or company announcements.

GOAL: Filter out navigation elements, headers, footers, and other non-article content. Keep only actual news/blog posts.

Return a JSON object with an "articles" array containing only real articles with:
- title: Article title
- url: Article URL
- date: Publication date (if available)
- text: Article preview/excerpt

Ignore: navigation menus, headers, footers, sidebar content, ads, unrelated links.`
          },
          {
            role: 'user',
            content: `From this webpage, identify only actual news/blog articles for ${companyName}:

${JSON.stringify(articles.slice(0, 20), null, 2)}

Return JSON with "articles" array of only real articles.`
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0]?.message?.content || '{"articles": []}');
      const validArticles = analysis.articles || [];
      
      news.push(...validArticles.map((a: any) => ({
        title: a.title,
        url: a.url,
        date: a.date || '',
        text: a.text || '',
      })));
    }

    await page.close();
  } catch (error: any) {
    console.error(`[Monitoring] Error scraping website news:`, error.message);
    await page.close();
  }

  return news;
}

/**
 * Use LLM to find careers/jobs section on company website
 */
async function findJobsSectionWithLLM(
  page: puppeteer.Page,
  website: string,
  companyName: string
): Promise<string | null> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  try {
    await page.goto(website, { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(2000);

    const pageStructure = await page.evaluate(() => {
      const links: Array<{text: string, href: string}> = [];
      const navLinks = Array.from(document.querySelectorAll('nav a, header a, [role="navigation"] a'));
      
      navLinks.forEach(link => {
        const text = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';
        const rect = link.getBoundingClientRect();
        if (text && href && rect.width > 0 && rect.height > 0) {
          links.push({ text, href });
        }
      });

      return {
        url: window.location.href,
        links: links.slice(0, 30),
      };
    });

    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Find the URL path to the company's careers/jobs/hiring page. Look for links like "Careers", "Jobs", "Hiring", "Join Us", "Open Positions", "We're Hiring", etc.

Return JSON with "url" (full URL path) or null if not found.`
        },
        {
          role: 'user',
          content: `Find careers/jobs page for ${companyName}:

Links: ${JSON.stringify(pageStructure.links, null, 2)}`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0]?.message?.content || '{"url": null}');
    return analysis.url || null;
  } catch (error: any) {
    return null;
  }
}

/**
 * Scrape job postings using LLM-guided navigation
 * Focuses on engineering roles and detects hiring trend changes
 */
async function scrapeJobPostings(
  browser: puppeteer.Browser,
  website: string | undefined,
  linkedinUrl: string | undefined,
  companyName: string
): Promise<any[]> {
  const page = await browser.newPage();
  const jobs: any[] = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Try company careers page using LLM navigation
    if (website) {
      console.log(`[Monitoring] 🤖 Using LLM to find careers/jobs section...`);
      const jobsUrl = await findJobsSectionWithLLM(page, website, companyName);
      
      if (jobsUrl) {
        console.log(`[Monitoring] ✅ LLM found jobs section: ${jobsUrl}`);
        await page.goto(jobsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await delay(2000);

        const jobListings = await page.evaluate(() => {
          const items: any[] = [];
          
          const selectors = [
            '.job-listing',
            '.job-post',
            '[class*="job"]',
            '[class*="position"]',
              '[class*="role"]',
            'article',
              'li[class*="job"]',
          ];

          let elements: Element[] = [];
          for (const selector of selectors) {
            const found = Array.from(document.querySelectorAll(selector));
            if (found.length > 0) {
                elements = found.slice(0, 30); // Get more to detect trends
              break;
            }
          }

          elements.forEach((element) => {
            try {
                const titleEl = element.querySelector('h2, h3, h4, .title, [class*="title"], a[class*="title"]');
              const linkEl = element.querySelector('a[href]');
                const departmentEl = element.querySelector('.department, [class*="department"], .team, [class*="team"]');
              const locationEl = element.querySelector('.location, [class*="location"]');
                const textEl = element.querySelector('p, .description, [class*="description"]');

              const title = titleEl?.textContent?.trim() || '';
              const url = linkEl?.getAttribute('href') || '';
              const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
              const department = departmentEl?.textContent?.trim() || '';
              const location = locationEl?.textContent?.trim() || '';
                const description = textEl?.textContent?.trim() || '';

                // Check for engineering/technical roles - broader matching
                const titleLower = title.toLowerCase();
                const descLower = description.toLowerCase();
                const isEngineeringRole = 
                  titleLower.includes('engineer') || 
                  titleLower.includes('developer') || 
                  titleLower.includes('software') ||
                  titleLower.includes('programmer') ||
                  titleLower.includes('architect') ||
                  titleLower.includes('devops') ||
                  titleLower.includes('sre') ||
                  titleLower.includes('backend') ||
                  titleLower.includes('frontend') ||
                  titleLower.includes('full stack') ||
                  titleLower.includes('full-stack') ||
                  titleLower.includes('qa') ||
                  titleLower.includes('quality assurance') ||
                  titleLower.includes('test') ||
                  descLower.includes('engineering') ||
                  descLower.includes('software development');

                if (title && isEngineeringRole) {
                items.push({
                  title,
                  url: fullUrl,
                  department,
                  location,
                  text: `${title} - ${department} - ${location}`,
                    description: description.substring(0, 500),
                });
              }
            } catch (e) {
              // Skip
            }
          });

          return items;
        });

        if (jobListings.length > 0) {
          jobs.push(...jobListings);
          // Found jobs, we're done
        }
      }
    }

    // Try LinkedIn Jobs if LinkedIn URL available
    if (linkedinUrl) {
      try {
        const jobsUrl = linkedinUrl.replace(/\/$/, '') + '/jobs';
        await page.goto(jobsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await delay(3000);

        // Scroll to load more jobs
        for (let i = 0; i < 2; i++) {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          await delay(2000);
        }

        const linkedinJobs = await page.evaluate(() => {
          const items: any[] = [];
          const jobElements = Array.from(document.querySelectorAll('[data-urn*="job"], .job-card, [class*="job"], [class*="job-card"]'));
          
          jobElements.slice(0, 30).forEach((element) => {
            try {
              const titleEl = element.querySelector('h3, h4, .job-title, [class*="title"], a[class*="title"]');
              const linkEl = element.querySelector('a[href*="/jobs/"]');
              const locationEl = element.querySelector('.job-location, [class*="location"]');
              const textEl = element.querySelector('p, .description, [class*="description"]');

              const title = titleEl?.textContent?.trim() || '';
              const url = linkEl?.getAttribute('href') || '';
              const fullUrl = url.startsWith('http') ? url : `https://www.linkedin.com${url}`;
              const location = locationEl?.textContent?.trim() || '';
              const description = textEl?.textContent?.trim() || '';

              const titleLower = title.toLowerCase();
              const descLower = description.toLowerCase();
              const isEngineeringRole = 
                titleLower.includes('engineer') || 
                titleLower.includes('developer') || 
                titleLower.includes('software') ||
                titleLower.includes('programmer') ||
                titleLower.includes('architect') ||
                titleLower.includes('devops') ||
                titleLower.includes('sre') ||
                titleLower.includes('backend') ||
                titleLower.includes('frontend') ||
                titleLower.includes('full stack') ||
                titleLower.includes('full-stack') ||
                descLower.includes('engineering') ||
                descLower.includes('software development');

              if (title && isEngineeringRole) {
                items.push({
                  title,
                  url: fullUrl,
                  location,
                  text: `${title} - ${location}`,
                  description: description.substring(0, 500),
                });
              }
            } catch (e) {
              // Skip
            }
          });

          return items;
        });

        jobs.push(...linkedinJobs);
      } catch (e) {
        console.error(`[Monitoring] Error scraping LinkedIn jobs:`, e);
      }
    }

    await page.close();
  } catch (error: any) {
    console.error(`[Monitoring] Error scraping job postings:`, error.message);
    await page.close();
  }

  return jobs;
}

/**
 * Use LLM to navigate LinkedIn and find posts section
 */
async function navigateToLinkedInPostsWithLLM(
  page: puppeteer.Page,
  linkedinUrl: string,
  companyName: string
): Promise<boolean> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  try {
    // Analyze page structure to find Posts tab
    const pageInfo = await page.evaluate(() => {
      const navLinks: Array<{text: string, href: string, ariaLabel: string}> = [];
      const tabs = Array.from(document.querySelectorAll('a[href], button, [role="tab"]'));
      
      tabs.forEach((el) => {
        const text = el.textContent?.trim() || '';
        const href = el.getAttribute('href') || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const rect = el.getBoundingClientRect();
        
        if ((text || ariaLabel) && rect.width > 0 && rect.height > 0) {
          navLinks.push({ text, href, ariaLabel });
        }
      });

      return {
        url: window.location.href,
        navLinks: navLinks.slice(0, 20),
        hasPostsLink: !!document.querySelector('a[href*="/posts/"]'),
      };
    });

    // Use GPT to identify the Posts tab/link
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are navigating LinkedIn to find a company's posts section.

GOAL: Identify which navigation link/tab leads to the company's posts/updates feed.

Look for: "Posts", "Updates", "Activity", or links containing "/posts/" in the URL.

Return JSON with:
- "action": "navigate" (always navigate to /posts/ URL)
- "reasoning": Why this is the posts section`
        },
        {
          role: 'user',
          content: `Find the Posts section for ${companyName} on LinkedIn:

Current URL: ${pageInfo.url}
Navigation links: ${JSON.stringify(pageInfo.navLinks, null, 2)}
Has posts link: ${pageInfo.hasPostsLink}`
        }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0]?.message?.content || '{"action": "navigate"}');
    
    // Navigate directly to posts URL (most reliable)
    const postsUrl = linkedinUrl.replace(/\/$/, '') + '/posts/?feedView=all';
    await page.goto(postsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);
    return true;
  } catch (error: any) {
    console.error(`[Monitoring] LLM LinkedIn navigation error:`, error.message);
    return false;
  }
}

/**
 * Login to LinkedIn using credentials from environment variables
 * Saves cookies for persistent login
 */
async function loginToLinkedIn(page: puppeteer.Page): Promise<boolean> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;

  if (!email || !password) {
    console.log(`[Monitoring] LinkedIn credentials not found in environment variables (LINKEDIN_EMAIL, LINKEDIN_PASSWORD)`);
    return false;
  }

  try {
    // First check if already logged in using saved cookies
    console.log(`[Monitoring] 🔍 Checking if already logged in to LinkedIn...`);
    const cookiesLoaded = await loadCookies(page, 'linkedin');
    
    if (cookiesLoaded) {
      const alreadyLoggedIn = await isLoggedIn(page, 'linkedin', 'https://www.linkedin.com/feed');
      if (alreadyLoggedIn) {
        console.log(`[Monitoring] ✅ Already logged in to LinkedIn (using saved session)`);
        return true;
      }
      console.log(`[Monitoring] ⚠️  Saved cookies expired, logging in again...`);
    }

    console.log(`[Monitoring] 🔐 Logging in to LinkedIn...`);
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    // Fill in email
    const emailSelector = '#username';
    await page.waitForSelector(emailSelector, { timeout: 10000 });
    await page.type(emailSelector, email, { delay: 100 });

    // Fill in password
    const passwordSelector = '#password';
    await page.waitForSelector(passwordSelector, { timeout: 10000 });
    await page.type(passwordSelector, password, { delay: 100 });

    // Click sign in button
    const signInButton = 'button[type="submit"]';
    await page.click(signInButton);
    await delay(5000);

    // Check if login was successful (not on login page anymore)
    const currentUrl = page.url();
    if (!currentUrl.includes('/login') && !currentUrl.includes('/checkpoint')) {
      console.log(`[Monitoring] ✅ LinkedIn login successful`);
      // Save cookies for future use
      await saveCookies(page, 'linkedin');
      return true;
    }

    // Check for 2FA or verification challenge
    const needsVerification = await page.evaluate(() => {
      return document.body.textContent?.includes('Verify') ||
             document.body.textContent?.includes('verification') ||
             document.body.textContent?.includes('security challenge') ||
             window.location.href.includes('/checkpoint');
    });

    if (needsVerification) {
      console.log(`[Monitoring] LinkedIn requires additional verification. Please complete manually if running in non-headless mode.`);
      if (process.env.HEADLESS_BROWSER !== 'true') {
        console.log(`[Monitoring] Waiting 60 seconds for manual verification...`);
        await delay(60000);
        return !page.url().includes('/login');
      }
      return false;
    }

    return false;
  } catch (error: any) {
    console.error(`[Monitoring] LinkedIn login error:`, error.message);
    return false;
  }
}

/**
 * Scrape LinkedIn posts from company page
 * First tries without login (works for many public company pages)
 * Only logs in if credentials are provided and login is required
 */
async function scrapeLinkedInPosts(
  browser: puppeteer.Browser,
  linkedinUrl: string,
  companyName: string
): Promise<any[]> {
  const page = await browser.newPage();
  const posts: any[] = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Try to load saved cookies first (persistent login)
    await loadCookies(page, 'linkedin');
    
    // First, try to access without login (many company pages are public)
    await page.goto(linkedinUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    // Check if we're being asked to sign in
    const isSignInPage = await page.evaluate(() => {
      return document.body.textContent?.includes('Sign in') || 
             document.body.textContent?.includes('Join now') ||
             window.location.href.includes('/login') ||
             window.location.href.includes('/checkpoint');
    });

    // Only attempt login if we're blocked AND credentials are available
    if (isSignInPage) {
      const hasCredentials = process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD;
      if (hasCredentials) {
        console.log(`[Monitoring] LinkedIn requires authentication. Checking saved session...`);
        const loginSuccess = await loginToLinkedIn(page);
        if (!loginSuccess) {
          console.log(`[Monitoring] LinkedIn login failed. Skipping LinkedIn posts.`);
          await page.close();
          return [];
        }
        // Navigate back to company page after login
        await page.goto(linkedinUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(3000);
      } else {
        // No credentials provided, but try anyway - sometimes public pages work
        console.log(`[Monitoring] LinkedIn may require login, but no credentials provided. Attempting to scrape anyway...`);
        // Continue and try to scrape - some public company pages still work
      }
    }

    // Use LLM to navigate to posts section
    console.log(`[Monitoring] 🤖 Using LLM to find Posts section...`);
    const navigated = await navigateToLinkedInPostsWithLLM(page, linkedinUrl, companyName);
    if (!navigated) {
      // Fallback: try direct URL
      console.log(`[Monitoring] ⚠️  LLM navigation failed, trying direct URL...`);
      const postsUrl = linkedinUrl.replace(/\/$/, '') + '/posts/?feedView=all';
      await page.goto(postsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
    } else {
      console.log(`[Monitoring] ✅ Successfully navigated to Posts section`);
    }

    // Scroll down to load more posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await delay(2000);
    }

    await delay(3000);

    // Extract posts from the page
    const extractedPosts = await page.evaluate((companyLinkedInUrl) => {
      const postElements: any[] = [];
      
      // Try multiple selectors for LinkedIn post containers
      const selectors = [
        '[data-urn*="activity"]',
        '.feed-shared-update-v2',
        '[data-id*="urn:li:activity"]',
        '.occludable-update',
        'div[data-urn]',
        'article',
        '.update-components-actor',
        '[class*="feed-shared"]'
      ];
      
      let elements: Element[] = [];
      for (const selector of selectors) {
        const found = Array.from(document.querySelectorAll(selector));
        if (found.length > 0) {
          elements = found;
          break;
        }
      }
      
      // Limit to first 15 posts
      elements.slice(0, 15).forEach((element) => {
        try {
          // Try to find post text
          const textSelectors = [
            '.feed-shared-text',
            '.feed-shared-update-v2__description',
            '[data-test-id="main-feed-activity-card__commentary"]',
            '.update-components-text',
            '.feed-shared-text__text-view',
            'span[dir="ltr"]',
            '.feed-shared-text-view',
            'div[data-test-id="main-feed-activity-card__commentary"]'
          ];
          
          let text = '';
          for (const textSelector of textSelectors) {
            const textEl = element.querySelector(textSelector);
            if (textEl) {
              const textContent = textEl.textContent?.trim() || '';
              if (textContent.length > text.length) {
                text = textContent;
              }
            }
          }
          
          // If no text found, try getting all text from element
          if (!text || text.length < 20) {
            const allText = element.textContent?.trim() || '';
            if (allText.length > 50 && !allText.includes('Sign in') && !allText.includes('Join now')) {
              text = allText.substring(0, 500);
            }
          }
          
          // Try to find post URL
          let url = '';
          const linkSelectors = [
            'a[href*="/posts/"]',
            'a[href*="/activity-"]',
            'a[href*="urn:li:activity"]',
            'a[data-control-name*="feed"]'
          ];
          
          for (const linkSelector of linkSelectors) {
            const linkEl = element.querySelector(linkSelector);
            if (linkEl) {
              const href = linkEl.getAttribute('href');
              if (href) {
                url = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
                break;
              }
            }
          }
          
          // Try to find date
          let date = '';
          const dateSelectors = [
            'time[datetime]',
            'time',
            '[data-test-id="main-feed-activity-card__relative-time"]',
            '.feed-shared-actor__sub-description time',
            'span[aria-label*="ago"]',
            'span[aria-label*="day"]'
          ];
          for (const dateSelector of dateSelectors) {
            const dateEl = element.querySelector(dateSelector);
            if (dateEl) {
              date = dateEl.getAttribute('datetime') || dateEl.getAttribute('aria-label') || dateEl.textContent?.trim() || '';
              if (date) break;
            }
          }
          
          if (text && text.length > 20) {
            postElements.push({
              title: text.substring(0, 100),
              text: text.substring(0, 2000),
              url: url || companyLinkedInUrl,
              date: date || new Date().toISOString(),
            });
          }
        } catch (e) {
          // Skip this element
        }
      });
      
      return postElements;
    }, linkedinUrl);

    posts.push(...extractedPosts);
    await page.close();
  } catch (error: any) {
    console.error(`[Monitoring] Error scraping LinkedIn posts:`, error.message);
    await page.close();
  }

  return posts;
}

/**
 * Login to Twitter/X using credentials from environment variables
 * Saves cookies for persistent login
 */
async function loginToTwitter(page: puppeteer.Page): Promise<boolean> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const username = process.env.TWITTER_USERNAME || process.env.TWITTER_EMAIL;
  const password = process.env.TWITTER_PASSWORD;

  if (!username || !password) {
    console.log(`[Monitoring] Twitter credentials not found in environment variables (TWITTER_USERNAME/TWITTER_EMAIL, TWITTER_PASSWORD)`);
    return false;
  }

  try {
    // First check if already logged in using saved cookies
    console.log(`[Monitoring] 🔍 Checking if already logged in to Twitter/X...`);
    const cookiesLoaded = await loadCookies(page, 'twitter');
    
    if (cookiesLoaded) {
      const alreadyLoggedIn = await isLoggedIn(page, 'twitter', 'https://twitter.com/home');
      if (alreadyLoggedIn) {
        console.log(`[Monitoring] ✅ Already logged in to Twitter/X (using saved session)`);
        return true;
      }
      console.log(`[Monitoring] ⚠️  Saved cookies expired, logging in again...`);
    }

    console.log(`[Monitoring] 🔐 Logging in to Twitter/X...`);
    await page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(3000);

    // Twitter login flow can vary, try to find username/email input
    try {
      // Wait for username input (Twitter uses autocomplete="username")
      const usernameSelector = 'input[autocomplete="username"], input[name="text"], input[type="text"]';
      await page.waitForSelector(usernameSelector, { timeout: 10000 });
      await page.type(usernameSelector, username, { delay: 100 });
      
      // Click Next button
      const nextButton = 'span:has-text("Next"), button:has-text("Next")';
      await page.evaluate((selector) => {
        const buttons = Array.from(document.querySelectorAll('span, button'));
        const nextBtn = buttons.find(el => el.textContent?.includes('Next'));
        if (nextBtn) (nextBtn as HTMLElement).click();
      }, nextButton);
      await delay(3000);

      // Check if password field appears (might need to handle unusual activity check)
      const unusualActivity = await page.evaluate(() => {
        return document.body.textContent?.includes('unusual activity') ||
               document.body.textContent?.includes('verify') ||
               document.body.textContent?.includes('phone');
      });

      if (unusualActivity) {
        console.log(`[Monitoring] Twitter requires additional verification. Please complete manually if running in non-headless mode.`);
        if (process.env.HEADLESS_BROWSER !== 'true') {
          console.log(`[Monitoring] Waiting 60 seconds for manual verification...`);
          await delay(60000);
        } else {
          return false;
        }
      }

      // Fill in password
      const passwordSelector = 'input[name="password"], input[type="password"]';
      await page.waitForSelector(passwordSelector, { timeout: 10000 });
      await page.type(passwordSelector, password, { delay: 100 });

      // Click Log in button
      const loginButton = 'span:has-text("Log in"), button[data-testid="LoginForm_Login_Button"]';
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('span, button'));
        const loginBtn = buttons.find(el => 
          el.textContent?.includes('Log in') || 
          el.getAttribute('data-testid') === 'LoginForm_Login_Button'
        );
        if (loginBtn) (loginBtn as HTMLElement).click();
      });
      await delay(5000);

      // Check if login was successful
      const currentUrl = page.url();
      if (!currentUrl.includes('/i/flow/login') && !currentUrl.includes('/account/access')) {
        console.log(`[Monitoring] ✅ Twitter/X login successful`);
        // Save cookies for future use
        await saveCookies(page, 'twitter');
        return true;
      }

      return false;
    } catch (error: any) {
      console.error(`[Monitoring] Twitter login form error:`, error.message);
      return false;
    }
  } catch (error: any) {
    console.error(`[Monitoring] Twitter login error:`, error.message);
    return false;
  }
}

/**
 * Scrape Twitter/X account for recent posts
 * Automatically logs in using credentials from environment variables if needed
 */
async function scrapeTwitter(
  browser: puppeteer.Browser,
  twitterHandle: string,
  companyName: string
): Promise<any[]> {
  const page = await browser.newPage();
  const tweets: any[] = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Try to load saved cookies first (persistent login)
    await loadCookies(page, 'twitter');
    
    // Remove @ if present
    const handle = twitterHandle.replace('@', '');
    const twitterUrl = `https://twitter.com/${handle}`;

    await page.goto(twitterUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(3000);

    // Check if we're being asked to sign in
    const isSignInPage = await page.evaluate(() => {
      return document.body.textContent?.includes('Sign in') || 
             document.body.textContent?.includes('Create account') ||
             window.location.href.includes('/i/flow/login') ||
             document.querySelector('[data-testid="login"]');
    });

    if (isSignInPage) {
      const hasCredentials = process.env.TWITTER_USERNAME || process.env.TWITTER_EMAIL;
      if (hasCredentials) {
        console.log(`[Monitoring] Twitter/X requires authentication. Checking saved session...`);
        const loginSuccess = await loginToTwitter(page);
        if (!loginSuccess) {
          console.log(`[Monitoring] Twitter login failed. Trying to access public profile...`);
          // Try accessing the profile again - some profiles are public
          await page.goto(twitterUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          await delay(3000);
          const stillSignInPage = await page.evaluate(() => {
            return document.body.textContent?.includes('Sign in') ||
                   window.location.href.includes('/i/flow/login');
          });
          if (stillSignInPage) {
            console.log(`[Monitoring] Cannot access Twitter profile. Skipping Twitter posts.`);
            await page.close();
            return [];
          }
        } else {
          // Navigate back to profile after login
          await page.goto(twitterUrl, { waitUntil: 'networkidle2', timeout: 15000 });
          await delay(3000);
        }
      } else {
        console.log(`[Monitoring] Twitter may require login, but no credentials provided. Trying public access...`);
      }
    } else {
      console.log(`[Monitoring] ✅ Accessing Twitter without login required (or using saved session)`);
    }

    // Scroll to load more tweets
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await delay(2000);
    }

    const posts = await page.evaluate(() => {
      const items: any[] = [];
      
      // Twitter/X selectors
      const tweetSelectors = [
        '[data-testid="tweet"]',
        'article[data-testid="tweet"]',
        '.tweet',
      ];

      let elements: Element[] = [];
      for (const selector of tweetSelectors) {
        const found = Array.from(document.querySelectorAll(selector));
        if (found.length > 0) {
          elements = found.slice(0, 20);
          break;
        }
      }

      elements.forEach((element) => {
        try {
          const textEl = element.querySelector('[data-testid="tweetText"], .tweet-text');
          const timeEl = element.querySelector('time');
          const linkEl = element.querySelector('a[href*="/status/"]');

          const text = textEl?.textContent?.trim() || '';
          const date = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim() || '';
          const url = linkEl?.getAttribute('href') || '';
          const fullUrl = url.startsWith('http') ? url : `https://twitter.com${url}`;

          if (text && text.length > 20) {
            items.push({
              title: text.substring(0, 100),
              text,
              url: fullUrl,
              date,
            });
          }
        } catch (e) {
          // Skip
        }
      });

      return items;
    });

    tweets.push(...posts);
    await page.close();
  } catch (error: any) {
    console.error(`[Monitoring] Error scraping Twitter:`, error.message);
    await page.close();
  }

  return tweets;
}

/**
 * Scrape Google search results for company-related articles, then read the actual article pages
 * Uses regular Google search (not Google News) and visits each article URL to get full content
 */
async function scrapeNews(
  browser: puppeteer.Browser,
  companyName: string
): Promise<any[]> {
  const page = await browser.newPage();
  const articles: any[] = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Use regular Google search with recent date filter
    const searchQuery = encodeURIComponent(`${companyName} news`);
    const searchUrl = `https://www.google.com/search?q=${searchQuery}&tbs=qdr:m`; // qdr:m = past month

    console.log(`[Monitoring] 🔍 Searching Google: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await delay(3000); // Give more time for page to load

    console.log(`[Monitoring] 📄 Using LLM to analyze Google search results page...`);
    
    // Check if Google blocked us (CAPTCHA, etc.)
    const pageInfo = await page.evaluate(() => {
      const searchResults: Array<{
        title: string;
        snippet: string;
        url: string;
        linkSelector: string;
        index: number;
      }> = [];
      
      // Find all potential search result links
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      let resultIndex = 0;
      
      allLinks.forEach((link, idx) => {
        const href = link.getAttribute('href') || '';
        const titleEl = link.querySelector('h3, h2, h1') || 
                       link.closest('div, article')?.querySelector('h3, h2, h1');
        const snippetEl = link.closest('div, article')?.querySelector('.VwiC3b, .s, .IsZvec, span');
        
        // Skip Google internal links
        if (href.includes('google.com') || href.includes('webcache') || 
            href.includes('translate') || href.includes('/search') ||
            !href.startsWith('http') && !href.startsWith('/url')) {
          return;
        }
        
        const title = titleEl?.textContent?.trim() || link.textContent?.trim() || '';
          const snippet = snippetEl?.textContent?.trim() || '';
        
        // Clean up Google redirect URLs
        let cleanUrl = href;
        if (href.startsWith('/url?q=')) {
          const match = href.match(/\/url\?q=([^&]+)/);
          if (match) {
            cleanUrl = decodeURIComponent(match[1]);
          }
        }
        
        if (title && title.length > 10 && cleanUrl && cleanUrl.startsWith('http')) {
          searchResults.push({
              title,
            snippet: snippet.substring(0, 300),
            url: cleanUrl,
            linkSelector: `link_${idx}`,
            index: resultIndex++,
          });
        }
      });
      
      return {
        title: document.title,
        hasCaptcha: document.body.textContent?.includes('captcha') || 
                    document.body.textContent?.includes('unusual traffic'),
        searchResults: searchResults.slice(0, 15), // Limit to 15 results
        pageText: document.body.textContent?.substring(0, 1000),
      };
    });

    if (pageInfo.hasCaptcha) {
      console.log(`[Monitoring] ⚠️  Google is showing CAPTCHA. Waiting 15 seconds for you to solve it...`);
      await delay(15000);
      // Re-extract after CAPTCHA
      const updatedInfo = await page.evaluate(() => {
        // Re-extract results
        return { /* same extraction logic */ };
      });
    }

    console.log(`[Monitoring] ✅ Found ${pageInfo.searchResults.length} search results on page`);

    if (pageInfo.searchResults.length === 0) {
      console.log(`[Monitoring] ⚠️  No search results found on Google page`);
      await page.close();
      return [];
    }

    // Use LLM to analyze the search results and identify which ones to click
    console.log(`[Monitoring] 🤖 LLM analyzing search results to identify relevant articles...`);
    const openai = getOpenAIClient();
    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are analyzing Google search results about ${companyName} to decide which articles to read.

GOAL: Identify 3-5 articles that are MOST LIKELY to contain:
- New product releases or major features
- Company revenue growth or financial milestones  
- Funding events or investments
- Major customer wins or partnerships
- Hiring trends or significant growth
- Positive company news indicating they're worth reaching out to

Return JSON with:
- "articlesToRead": Array of objects with "index" (0-based), "title", "url", and "reasoning"
- Only include articles that seem highly relevant based on title and snippet

Be selective - only pick the most promising articles.`
        },
        {
          role: 'user',
          content: `Analyze these Google search results for ${companyName}:

${JSON.stringify(pageInfo.searchResults.map((r, i) => ({
  index: i,
  title: r.title,
  snippet: r.snippet,
  url: r.url
})), null, 2)}

Which articles should we click on and read? Return only the most relevant ones.`
        }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(analysisResponse.choices[0]?.message?.content || '{"articlesToRead": []}');
    const articlesToRead = analysis.articlesToRead || [];
    
    console.log(`[Monitoring] ✅ LLM selected ${articlesToRead.length} articles to read:`);
    articlesToRead.forEach((art: any, i: number) => {
      console.log(`   ${i + 1}. ${art.title}`);
      console.log(`      Reasoning: ${art.reasoning || 'Relevant business news'}`);
    });
    
    if (articlesToRead.length === 0) {
      console.log(`[Monitoring] ℹ️  LLM found no relevant articles`);
      await page.close();
      return [];
    }

    // Now click on and read each selected article
    console.log(`[Monitoring] 📖 Clicking on and reading ${articlesToRead.length} articles...`);
    for (let i = 0; i < articlesToRead.length; i++) {
      const articleInfo = articlesToRead[i];
      const originalResult = pageInfo.searchResults[articleInfo.index];
      
      if (!originalResult) {
        console.log(`[Monitoring] ⚠️  Article index ${articleInfo.index} not found, skipping`);
        continue;
      }
      
      console.log(`\n[Monitoring] 📰 Article ${i + 1}/${articlesToRead.length}: ${articleInfo.title}`);
      console.log(`[Monitoring]    Reasoning: ${articleInfo.reasoning || 'Relevant business news'}`);
      
      try {
        // Go back to Google results page if we're not on it
        const currentUrl = page.url();
        if (!currentUrl.includes('google.com/search')) {
          console.log(`[Monitoring]    🔙 Going back to Google results...`);
          await page.goBack();
          await delay(2000);
        }
        
        // Find and click the link on the Google results page
        console.log(`[Monitoring]    🖱️  Clicking on article link in Google results...`);
        const clicked = await page.evaluate((targetUrl) => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          for (const link of links) {
            const href = link.getAttribute('href') || '';
            let cleanHref = href;
            if (href.startsWith('/url?q=')) {
              const match = href.match(/\/url\?q=([^&]+)/);
              if (match) {
                cleanHref = decodeURIComponent(match[1]);
              }
            }
            // Match by domain or full URL
            const targetDomain = targetUrl.split('/')[2];
            if (cleanHref === targetUrl || cleanHref.includes(targetDomain)) {
              (link as HTMLElement).click();
              return true;
            }
          }
          return false;
        }, originalResult.url);
        
        if (!clicked) {
          // Fallback: navigate directly
          console.log(`[Monitoring]    🔗 Direct navigation (click failed): ${originalResult.url}`);
          await page.goto(originalResult.url, { waitUntil: 'networkidle2', timeout: 15000 });
        } else {
          // Wait for navigation after click
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        }
        
        await delay(4000); // Wait for page to load

        // Now read the article content from the current page
        console.log(`[Monitoring]    📖 Reading article content...`);
        const articleContent = await page.evaluate(() => {
          // Try to find main article content
          const contentSelectors = [
            'article',
            '[role="article"]',
            '.article-content',
            '.post-content',
            '.entry-content',
            'main article',
            '[class*="article"]',
            '[class*="content"]',
            '[class*="post"]',
          ];

          let content = '';
          let date = '';

          // Try to find article body
          for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              // Get text content, excluding scripts and styles
              const text = element.textContent?.trim() || '';
              if (text.length > 200) {
                content = text.substring(0, 2000); // Limit content length
                break;
              }
            }
          }

          // If no article element found, try to get main content
          if (!content) {
            const main = document.querySelector('main') || document.querySelector('[role="main"]');
            if (main) {
              content = main.textContent?.trim().substring(0, 2000) || '';
            }
          }

          // Try to find publication date
          const dateSelectors = [
            'time[datetime]',
            'time',
            '[class*="date"]',
            '[class*="published"]',
            '[class*="timestamp"]',
          ];

          for (const selector of dateSelectors) {
            const dateEl = document.querySelector(selector);
            if (dateEl) {
              date = dateEl.getAttribute('datetime') || dateEl.textContent?.trim() || '';
              if (date) break;
            }
          }

          return {
            content: content || document.body.textContent?.substring(0, 2000) || '',
            date,
          };
        });

        if (articleContent.content && articleContent.content.length > 100) {
          console.log(`[Monitoring] ✅ Extracted ${articleContent.content.length} chars from article`);
          articles.push({
            title: articleInfo.title,
            url: originalResult.url,
            text: articleContent.content,
            date: articleContent.date || '',
          });
        } else {
          console.log(`[Monitoring] ⚠️  Could not extract content from article (too short or blocked)`);
        }

        // Go back to Google results for next article
        console.log(`[Monitoring]    🔙 Returning to Google results...`);
        await page.goBack();
        await delay(3000); // Wait for Google page to reload
      } catch (e: any) {
        console.log(`[Monitoring] ⚠️  Error loading article: ${e.message}`);
        // Skip articles that fail to load
        continue;
      }
    }
    
    console.log(`[Monitoring] ✅ Successfully extracted ${articles.length} articles with content`);

    await page.close();
  } catch (error: any) {
    console.error(`[Monitoring] Error scraping news:`, error.message);
    await page.close();
  }

  return articles;
}

/**
 * Use GPT to filter and categorize events - only keep relevant ones
 * Only flags: product releases, revenue growth, hiring trend changes/engineering roles, funding, customer wins, positive sentiment
 */
async function filterAndCategorizeEvents(
  content: any[],
  companyName: string
): Promise<CompanyEvent[]> {
  if (content.length === 0) return [];

  const contentText = content.map((item, i) => 
    `${i + 1}. [${item.type}] ${item.title || item.text?.substring(0, 100)}\n   ${item.text || item.description || ''}\n   URL: ${item.url || 'N/A'}\n---`
  ).join('\n\n');

  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are analyzing content about ${companyName} to identify ONLY highly relevant business events that indicate the company is worth reaching out to.

STRICTLY ONLY flag events that indicate:
1. **New product releases** - New products, major features, or significant product updates/launches
2. **Company revenue growth** - Financial milestones, ARR growth, revenue announcements, profitability
3. **Hiring trend changes or engineering roles** - Significant increase in hiring, multiple new engineering roles posted, hiring sprees, or focus on technical/engineering hiring
4. **Funding events** - New funding rounds, investments, acquisitions, IPO announcements
5. **Customer wins/onboarding** - Major customer announcements, enterprise deals, significant partnerships, new customer wins
6. **General positive sentiment** - Strong indicators the company is growing/succeeding (e.g., expansion, awards, recognition, major milestones, positive momentum)

CRITICAL - IGNORE these completely:
- Generic social media posts without substance
- Routine single job postings (unless multiple engineering roles indicating hiring trend)
- Non-newsworthy updates or announcements
- Negative news or concerning developments
- Spam, promotional content, or irrelevant posts
- Standard company updates that don't indicate growth/success
- Regular blog posts that aren't about major releases or wins

For job postings specifically:
- Flag ONLY if there are multiple engineering roles (indicating hiring trend change) OR if it's part of a larger hiring announcement
- Ignore single routine job postings
- Look for patterns like "we're hiring", "join our team", "multiple positions", etc.

For each relevant event, return:
- title: Brief, descriptive title
- category: One of: product_release, revenue_growth, hiring, funding, customer_win, positive_news
- description: 2-3 sentence summary explaining why this is relevant and indicates the company is worth reaching out to
- source_url: The original URL
- source_type: website, jobs, linkedin, twitter, or news

Return ONLY a JSON object with an "events" array. Be very selective - only include events that truly indicate positive momentum or growth.`
        },
        {
          role: 'user',
          content: `Analyze this content about ${companyName} and identify ONLY highly relevant business events that indicate the company is worth reaching out to:\n\n${contentText}\n\nReturn a JSON object with an "events" array containing only the most relevant events. Be very selective - ignore routine updates and only flag significant positive developments.`
        }
      ],
      temperature: 0.2, // Lower temperature for more consistent filtering
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(response.choices[0]?.message?.content || '{"events": []}');
    const events = analysis.events || [];

    // Convert to CompanyEvent format
    return events.map((event: any) => ({
      title: event.title,
      description: event.description,
      category: event.category || 'other',
      source_url: event.source_url || '',
      source_type: event.source_type || 'website',
      detected_at: new Date().toISOString(),
      metadata: {
        original_content: content.find(c => c.url === event.source_url),
        gpt_analysis: event,
      },
    }));

  } catch (error: any) {
    console.error('[Monitoring] Error filtering events:', error.message);
    return [];
  }
}

