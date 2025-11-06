import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

interface LinkedInPost {
  text: string;
  url: string;
  date?: string;
  likes?: number;
  comments?: number;
}

async function scrapeLinkedInPosts(companyLinkedInUrl: string, companyName: string, companyId: string) {
  console.log(`\n🚀 Starting LinkedIn scraping for ${companyName}`);
  console.log(`📍 URL: ${companyLinkedInUrl}\n`);

  // Launch browser with visible window
  const browser = await puppeteer.launch({
    headless: false, // Show browser window
    defaultViewport: { width: 1280, height: 720 },
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
  });

  try {
    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    
    // Close any other tabs that might have opened
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }
    
    // Helper function for delays
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Navigate to company LinkedIn page
    console.log('🌐 Navigating to LinkedIn...');
    console.log(`📍 Target URL: ${companyLinkedInUrl}`);
    
    try {
      await page.goto(companyLinkedInUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log(`✅ Current URL: ${page.url()}`);
    } catch (error: any) {
      console.error(`❌ Navigation error: ${error.message}`);
      console.log(`Current URL after error: ${page.url()}`);
      throw error;
    }
    
    // Wait a bit for page to load
    await delay(3000);
    
    // Try to find and click on "Posts" tab/link
    console.log('🔍 Looking for Posts section...');
    
    // LinkedIn has different layouts - try multiple selectors
    const postsSelectors = [
      'a[href*="/posts/"]',
      'button[aria-label*="Posts"]',
      'a:has-text("Posts")',
      '[data-control-name="page_member_main_nav_posts"]',
      'a[href*="posts"]'
    ];
    
    let postsClicked = false;
    for (const selector of postsSelectors) {
      try {
        const postsLink = await page.$(selector);
        if (postsLink) {
          console.log(`✅ Found Posts link with selector: ${selector}`);
          await postsLink.click();
          await delay(3000);
          postsClicked = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }
    
    // If direct click didn't work, try navigating to posts URL directly
    if (!postsClicked) {
      const postsUrl = companyLinkedInUrl.replace(/\/$/, '') + '/posts/?feedView=all';
      console.log(`📝 Navigating directly to posts URL: ${postsUrl}`);
      await page.goto(postsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(3000);
    }
    
    // Scroll down to load more posts
    console.log('📜 Scrolling to load posts...');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await delay(2000);
    }
    
    // Extract posts from the page
    console.log('📊 Extracting posts...');
    
    // Wait a bit more for posts to load
    await delay(5000);
    
    // Try to find all possible post containers
    const posts = await page.evaluate((companyLinkedInUrl) => {
      const postElements: LinkedInPost[] = [];
      
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
          console.log(`Found ${found.length} elements with selector: ${selector}`);
          elements = found;
          break;
        }
      }
      
      console.log(`Total elements found: ${elements.length}`);
      
      // Limit to first 15 posts
      elements.slice(0, 15).forEach((element, idx) => {
        try {
          // Try to find post text - more comprehensive selectors
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
            // Filter out navigation/UI text
            if (allText.length > 50 && !allText.includes('Sign in') && !allText.includes('Join now')) {
              text = allText.substring(0, 500); // Limit length
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
          
          // Try to find engagement metrics
          const likesEl = element.querySelector('[aria-label*="like"], [aria-label*="Like"], button[aria-label*="reaction"]');
          const commentsEl = element.querySelector('[aria-label*="comment"], [aria-label*="Comment"]');
          
          if (text && text.length > 20) {
            postElements.push({
              text: text.substring(0, 2000), // Limit text length
              url: url || companyLinkedInUrl,
              date: date || new Date().toISOString(),
              likes: likesEl ? parseInt(likesEl.textContent?.replace(/\D/g, '') || '0') || undefined : undefined,
              comments: commentsEl ? parseInt(commentsEl.textContent?.replace(/\D/g, '') || '0') || undefined : undefined
            });
          }
        } catch (e) {
          console.error(`Error extracting post ${idx}:`, e);
        }
      });
      
      return postElements;
    }, companyLinkedInUrl);
    
    console.log(`\n✅ Found ${posts.length} posts`);
    
    if (posts.length === 0) {
      console.log('⚠️  No posts found. The page structure might have changed or requires login.');
      console.log('💡 Tip: You may need to log in to LinkedIn first.');
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'linkedin-debug.png', fullPage: true });
      console.log('📸 Screenshot saved to linkedin-debug.png');
      
      await browser.close();
      return [];
    }
    
    // Display posts
    console.log('\n📋 Scraped Posts:');
    posts.forEach((post, i) => {
      console.log(`\n${i + 1}. ${post.text.substring(0, 100)}...`);
      console.log(`   URL: ${post.url}`);
      console.log(`   Date: ${post.date}`);
      if (post.likes) console.log(`   Likes: ${post.likes}`);
      if (post.comments) console.log(`   Comments: ${post.comments}`);
    });
    
    // Send to GPT for interpretation
    console.log('\n🤖 Sending to GPT for interpretation...');
    const postsText = posts.map((p, i) => 
      `Post ${i + 1}:\n${p.text}\nDate: ${p.date}\nURL: ${p.url}\n---`
    ).join('\n\n');
    
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are analyzing LinkedIn posts from ${companyName}. Extract key insights and create structured updates.

For each significant post, create an event with:
- title: Brief, descriptive title
- category: One of: funding, product_launch, partnership, hiring, news, social_post, other
- description: 2-3 sentence summary
- insights: What this means for the company
- url: The post URL if available
- date: The post date if available

Return ONLY a valid JSON object with an "events" array containing the events.`
        },
        {
          role: 'user',
          content: `Analyze these LinkedIn posts from ${companyName}:\n\n${postsText}\n\nReturn a JSON object with an "events" array.`
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });
    
    const analysis = JSON.parse(gptResponse.choices[0]?.message?.content || '{"events": []}');
    console.log('\n✅ GPT Analysis:', JSON.stringify(analysis, null, 2));
    
    // Save events to database
    console.log('\n💾 Saving events to database...');
    const events = analysis.events || [];
    
    // Helper function to parse relative dates like "20h", "1d", "2w" to ISO timestamp
    function parseRelativeDate(dateStr: string): string {
      if (!dateStr) return new Date().toISOString();
      
      // If it's already an ISO date, return it
      if (dateStr.includes('T') || dateStr.includes('-')) {
        return dateStr;
      }
      
      const now = new Date();
      const lowerDateStr = dateStr.toLowerCase().trim();
      
      // Parse relative dates
      if (lowerDateStr.includes('h')) {
        const hours = parseInt(lowerDateStr.replace(/\D/g, '')) || 0;
        now.setHours(now.getHours() - hours);
      } else if (lowerDateStr.includes('d')) {
        const days = parseInt(lowerDateStr.replace(/\D/g, '')) || 0;
        now.setDate(now.getDate() - days);
      } else if (lowerDateStr.includes('w')) {
        const weeks = parseInt(lowerDateStr.replace(/\D/g, '')) || 0;
        now.setDate(now.getDate() - (weeks * 7));
      } else if (lowerDateStr.includes('m')) {
        const months = parseInt(lowerDateStr.replace(/\D/g, '')) || 0;
        now.setMonth(now.getMonth() - months);
      } else if (lowerDateStr.includes('y')) {
        const years = parseInt(lowerDateStr.replace(/\D/g, '')) || 0;
        now.setFullYear(now.getFullYear() - years);
      }
      
      return now.toISOString();
    }
    
    for (const event of events) {
      // Map GPT categories to our event categories
      const categoryMap: Record<string, string> = {
        funding: 'funding',
        product_launch: 'new_content',
        partnership: 'other',
        hiring: 'job_posting',
        news: 'news_article',
        social_post: 'social_post',
        other: 'other'
      };
      
      const parsedDate = parseRelativeDate(event.date || '');
      
      const { error } = await supabase
        .from('company_events')
        .insert({
          company_id: companyId,
          event_type: 'brightdata_linkedin',
          event_category: categoryMap[event.category] || 'other',
          title: event.title,
          description: event.description || event.insights,
          source_url: event.url || posts[0]?.url,
          metadata: {
            gpt_analysis: event,
            original_posts: posts,
            scraped_at: new Date().toISOString()
          },
          detected_at: parsedDate
        });
      
      if (error) {
        console.error(`❌ Error saving event: ${error.message}`);
      } else {
        console.log(`✅ Saved: ${event.title}`);
      }
    }
    
    console.log(`\n🎉 Done! Saved ${events.length} events to database.`);
    console.log('\n⏸️  Browser will stay open for 30 seconds so you can review...');
    await delay(30000);
    
    await browser.close();
    return events;
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await browser.close();
    throw error;
  }
}

// Main execution
async function main() {
  const companyName = process.argv[2] || 'OpenRouter';
  
  console.log(`\n🔍 Looking for company: ${companyName}`);
  
  // Find company in database
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, linkedin_url')
    .ilike('name', `%${companyName}%`)
    .limit(1);
  
  if (error || !companies || companies.length === 0) {
    console.error('❌ Company not found in database');
    console.log('💡 Usage: npx tsx scripts/scrape-linkedin-posts.ts <company-name>');
    process.exit(1);
  }
  
  const company = companies[0];
  
  if (!company.linkedin_url) {
    console.error(`❌ No LinkedIn URL found for ${company.name}`);
    process.exit(1);
  }
  
  await scrapeLinkedInPosts(company.linkedin_url, company.name, company.id);
}

main().catch(console.error);

