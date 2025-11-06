/**
 * Company Monitoring Service
 * Monitors companies for new events using Apify, Bright Data (LinkedIn), and Diffbot APIs
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface CompanyEvent {
  company_id: string;
  event_type: 'apify_website' | 'brightdata_linkedin' | 'brightdata_social' | 'diffbot_news';
  event_category: 'new_content' | 'employee_change' | 'job_posting' | 'social_post' | 'news_article' | 'funding' | 'other';
  title: string;
  description?: string;
  source_url?: string;
  metadata?: Record<string, any>;
  detected_at: string;
}

export interface Company {
  id: string;
  name: string;
  website?: string;
  linkedin_url?: string;
}

/**
 * Check Apify API for new website content
 */
export async function checkApifyWebsite(
  company: Company,
  apifyApiKey: string
): Promise<CompanyEvent[]> {
  if (!company.website) {
    console.log(`[Apify] No website URL for ${company.name}`);
    return [];
  }

  const events: CompanyEvent[] = [];

  try {
    // Apify Actor API - Web Scraper
    // Check blog, news, case-studies pages for new content
    const urlsToCheck = [
      `${company.website}/blog`,
      `${company.website}/news`,
      `${company.website}/case-studies`,
      `${company.website}/press`,
    ].filter(url => url.startsWith('http'));

    for (const url of urlsToCheck) {
      try {
        // Use Apify Web Scraper Actor to scrape the page
        // First, run the actor
        const runResponse = await fetch('https://api.apify.com/v2/acts/apify~web-scraper/runs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apifyApiKey}`,
          },
          body: JSON.stringify({
            startUrls: [{ url }],
            maxCrawlDepth: 1,
            maxCrawlPages: 10,
          }),
        });

        if (runResponse.ok) {
          const runData = await runResponse.json();
          const runId = runData.data.id;
          
          // Wait a bit for the run to complete (simplified - in production use polling)
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Get dataset items
          const datasetResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
            headers: {
              'Authorization': `Bearer ${apifyApiKey}`,
            },
          });

          if (datasetResponse.ok) {
            const pages = await datasetResponse.json();
            if (pages && Array.isArray(pages) && pages.length > 0) {
              // Create events for each page found
              pages.forEach((page: any) => {
                const pageTitle = page.title || page.url?.split('/').pop() || 'New page';
                const pageUrl = page.url || url;
                
              events.push({
                company_id: company.id,
                event_type: 'apify_website',
                event_category: 'new_content',
                  title: `New content: ${pageTitle}`,
                  description: page.text?.substring(0, 200) || page.description || `New page found on ${new URL(url).pathname}`,
                  source_url: pageUrl,
                metadata: { apify_data: page, checked_url: url },
                detected_at: new Date().toISOString(),
              });
            });
            }
          }
        }
      } catch (error: any) {
        console.error(`[Apify] Error checking ${url}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error('[Apify] Error:', error.message);
  }

  return events;
}

/**
 * Check Bright Data LinkedIn Posts Dataset API for company posts
 * Uses collect by URL API (discover_by=url) to scrape posts from LinkedIn feed URL
 */
export async function checkBrightDataLinkedIn(
  company: Company,
  brightDataApiKey: string
): Promise<CompanyEvent[]> {
  if (!company.linkedin_url) {
    console.log(`[Bright Data LinkedIn] No LinkedIn URL for ${company.name}`);
    return [];
  }

  const events: CompanyEvent[] = [];

  try {
    const datasetId = process.env.BRIGHTDATA_LINKEDIN_POSTS_DATASET_ID || 'gd_lyy3tktm25m4avu764';
    
    // Convert company URL to posts feed URL if needed
    let postsUrl = company.linkedin_url;
    if (!postsUrl.includes('/posts/')) {
      // Convert company profile URL to posts feed URL
      postsUrl = postsUrl.replace(/\/$/, '') + '/posts/?feedView=all';
    }
    
    console.log(`[Bright Data LinkedIn] Collecting posts for ${company.name}...`);
    console.log(`[Bright Data LinkedIn] Using feed URL: ${postsUrl}`);
    
    // Use collect by URL API (discover_by=url) - faster than company_url mode
    const scrapeUrl = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}&notify=false&include_errors=true&type=discover_new&discover_by=url`;
    
    const scrapeResponse = await fetch(scrapeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${brightDataApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: [{
          url: postsUrl,
          limit: 50
        }],
      }),
    });

    if (!scrapeResponse.ok) {
      const error = await scrapeResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error(`[Bright Data LinkedIn] Scrape submission error:`, error);
      return [];
    }

    const scrapeData = await scrapeResponse.json();
    const snapshotId = scrapeData.snapshot_id;
    
    if (!snapshotId) {
      console.error(`[Bright Data LinkedIn] No snapshot_id in response:`, scrapeData);
      return [];
    }

    console.log(`[Bright Data LinkedIn] Scrape submitted, snapshot_id: ${snapshotId}`);
    
    // Poll for completion (max 20 minutes wait)
    let status = 'running';
    let attempts = 0;
    const maxAttempts = 40; // 40 attempts * 30 seconds = 20 minutes max
    
    while (status === 'running' && attempts < maxAttempts) {
      // Wait 30 seconds between checks (as API suggests)
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      try {
        const statusResponse = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`, {
          headers: {
            'Authorization': `Bearer ${brightDataApiKey}`,
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          // Log response structure for debugging (first attempt only)
          if (attempts === 0) {
            console.log(`[Bright Data LinkedIn] First status check response:`, JSON.stringify(statusData, null, 2).substring(0, 500));
          }
          
          status = statusData.status || statusData.state || 'unknown';
          
          // Log status on each attempt
          console.log(`[Bright Data LinkedIn] Status check ${attempts + 1}/${maxAttempts}: status="${status}" (waiting up to 20 minutes total)`);
          
          // Check if snapshot endpoint returned data directly (some APIs do this)
          if (statusData.data && Array.isArray(statusData.data)) {
            // Data is already in the response!
            console.log(`[Bright Data LinkedIn] Snapshot ready, data received directly`);
            const postsData = statusData.data;
            
            // Process posts immediately
            postsData.forEach((post: any) => {
              const postUrl = post.url || post.post_url || post.article_url || post.link;
              const postTitle = post.title || post.headline || post.text?.substring(0, 100) || 'LinkedIn Post';
              const postText = post.text || post.content || post.description || '';
              const postDate = post.created_at || post.date || post.published_at || new Date().toISOString();
              const isArticle = postUrl?.includes('/pulse/') || postUrl?.includes('/today/author/');
              
            events.push({
              company_id: company.id,
                event_type: 'brightdata_linkedin',
                event_category: isArticle ? 'new_content' : 'social_post',
                title: isArticle ? `New LinkedIn article: ${postTitle}` : `New LinkedIn post: ${postTitle}`,
                description: postText.substring(0, 300),
                source_url: postUrl,
                metadata: { brightdata_data: post, post_type: isArticle ? 'article' : 'post' },
                detected_at: postDate,
              });
            });
            
            console.log(`[Bright Data LinkedIn] Created ${events.length} events from direct response`);
            return events;
          }
          
          if (status === 'ready') {
            console.log(`[Bright Data LinkedIn] Snapshot ready, downloading results...`);
            break;
          } else if (status === 'failed') {
            console.error(`[Bright Data LinkedIn] Snapshot failed:`, statusData.message);
            return [];
          }
        } else {
          const errorText = await statusResponse.text().catch(() => 'Unknown error');
          console.log(`[Bright Data LinkedIn] Status check failed (attempt ${attempts + 1}): ${statusResponse.status} - ${errorText}`);
        }
      } catch (error: any) {
        console.error(`[Bright Data LinkedIn] Error polling snapshot (attempt ${attempts + 1}):`, error.message);
        // Continue polling on network errors
      }
      attempts++;
    }

    if (status !== 'ready') {
      console.log(`[Bright Data LinkedIn] Snapshot still processing after ${attempts} attempts`);
      return [];
    }

    // Download snapshot results
    // When status is 'ready', the snapshot endpoint should return the data
    // Try the snapshot endpoint first (it may return data directly when ready)
    const snapshotResponse = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`, {
      headers: {
        'Authorization': `Bearer ${brightDataApiKey}`,
      },
    });

    let postsData: any[] = [];
    
    if (snapshotResponse.ok) {
      const snapshotData = await snapshotResponse.json();
      
      // Check if data is in the snapshot response
      if (snapshotData.status === 'ready') {
        // Try to extract data from various possible locations
        if (Array.isArray(snapshotData)) {
          postsData = snapshotData;
        } else if (snapshotData.data && Array.isArray(snapshotData.data)) {
          postsData = snapshotData.data;
        } else if (snapshotData.results && Array.isArray(snapshotData.results)) {
          postsData = snapshotData.results;
        } else if (snapshotData.posts && Array.isArray(snapshotData.posts)) {
          postsData = snapshotData.posts;
        } else if (snapshotData.items && Array.isArray(snapshotData.items)) {
          postsData = snapshotData.items;
        } else if (snapshotData.snapshot && snapshotData.snapshot.data && Array.isArray(snapshotData.snapshot.data)) {
          postsData = snapshotData.snapshot.data;
        }
        
        // If still no data, log the structure to debug
        if (postsData.length === 0) {
          console.log(`[Bright Data LinkedIn] Snapshot ready but data structure unclear:`, Object.keys(snapshotData));
          console.log(`[Bright Data LinkedIn] Full response sample:`, JSON.stringify(snapshotData).substring(0, 500));
        }
      }
    }

    if (postsData.length === 0) {
      console.log(`[Bright Data LinkedIn] No posts found or couldn't parse response`);
      return [];
    }

    console.log(`[Bright Data LinkedIn] Found ${postsData.length} posts/articles`);

    // Process posts and create events
    postsData.forEach((post: any) => {
      const postUrl = post.url || post.post_url || post.article_url || post.link;
      const postTitle = post.title || post.headline || post.text?.substring(0, 100) || 'LinkedIn Post';
      const postText = post.text || post.content || post.description || '';
      const postDate = post.created_at || post.date || post.published_at || new Date().toISOString();
      
      // Determine if it's an article or regular post
      const isArticle = postUrl?.includes('/pulse/') || postUrl?.includes('/today/author/');
      
      events.push({
        company_id: company.id,
        event_type: 'brightdata_linkedin',
        event_category: isArticle ? 'new_content' : 'social_post',
        title: isArticle ? `New LinkedIn article: ${postTitle}` : `New LinkedIn post: ${postTitle}`,
        description: postText.substring(0, 300),
        source_url: postUrl,
        metadata: { 
          brightdata_data: post,
          post_type: isArticle ? 'article' : 'post',
        },
        detected_at: postDate,
      });
    });

    console.log(`[Bright Data LinkedIn] Created ${events.length} events`);
    
  } catch (error: any) {
    console.error('[Bright Data LinkedIn] Error:', error.message);
  }

  return events;
}

/**
 * Check Bright Data Social Media API
 */
export async function checkBrightDataSocial(
  company: Company,
  brightDataApiKey: string
): Promise<CompanyEvent[]> {
  const events: CompanyEvent[] = [];

  try {
    // Extract social handles from company metadata or website
    // For now, we'll need to get handles from company data or infer from website
    
    // Bright Data Social Media API endpoints
    // This is a placeholder - actual implementation depends on Bright Data API structure
    const platforms = ['twitter', 'instagram', 'tiktok'];
    
    for (const platform of platforms) {
      try {
        // Fetch recent posts from company handle
        // Note: Actual API structure may vary - adjust based on Bright Data documentation
        const response = await fetch(`https://api.brightdata.com/social/${platform}/posts`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${brightDataApiKey}`,
          },
          // Add company handle parameter
        });

        if (response.ok) {
          const data = await response.json();
          if (data.posts && Array.isArray(data.posts)) {
            data.posts.forEach((post: any) => {
              events.push({
                company_id: company.id,
                event_type: 'brightdata_social',
                event_category: 'social_post',
                title: `New ${platform} post`,
                description: post.text || post.caption || '',
                source_url: post.url,
                metadata: { brightdata_data: post, platform },
                detected_at: post.created_at || new Date().toISOString(),
              });
            });
          }
        }
      } catch (error: any) {
        console.error(`[Bright Data] Error checking ${platform}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error('[Bright Data] Error:', error.message);
  }

  return events;
}

/**
 * Check Diffbot Knowledge Graph API for news/articles
 */
export async function checkDiffbotKnowledgeGraph(
  company: Company,
  diffbotApiKey: string
): Promise<CompanyEvent[]> {
  const events: CompanyEvent[] = [];

  try {
    // Search for recent articles mentioning the company using Diffbot Knowledge Graph
    // Try using the search endpoint instead of DQL
    const url = new URL('https://kg.diffbot.com/kg/v3/search');
    url.searchParams.set('token', diffbotApiKey);
    url.searchParams.set('query', company.name);
    url.searchParams.set('type', 'Article');
    url.searchParams.set('size', '20');
    
    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach((article: any) => {
          // Check if article is recent (within last 30 days for better coverage)
          const articleDate = article.date ? new Date(article.date) : (article.created ? new Date(article.created) : null);
          
          if (articleDate) {
            const daysAgo = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
            
            // Accept articles from last 30 days
            if (daysAgo <= 30) {
              // Determine category based on content
              const articleText = (article.text || article.summary || '').toLowerCase();
              const articleTitle = (article.title || '').toLowerCase();
              const isFunding = article.tags?.includes('funding') || 
                               articleText.includes('funding') || 
                               articleText.includes('raised') ||
                               articleText.includes('series') ||
                               articleTitle.includes('funding') ||
                               articleTitle.includes('raised');
              
            events.push({
              company_id: company.id,
              event_type: 'diffbot_news',
                event_category: isFunding ? 'funding' : 'news_article',
              title: article.title || 'News article',
                description: article.text?.substring(0, 300) || article.summary || 'No description available',
              source_url: article.pageUrl || article.url,
                metadata: { 
                  diffbot_data: article,
                  date: article.date || article.created,
                  tags: article.tags || [],
                },
              detected_at: article.date || article.created || new Date().toISOString(),
            });
            }
          }
        });
      }
    } else {
      const errorText = await response.text();
      console.error(`[Diffbot] API error: ${response.status} - ${errorText}`);
    }
  } catch (error: any) {
    console.error('[Diffbot] Error:', error.message);
  }

  return events;
}

/**
 * Save event to database (with deduplication)
 */
export async function saveEvent(
  supabase: SupabaseClient,
  event: CompanyEvent
): Promise<boolean> {
  try {
    // Check if event already exists (deduplication by source_url or title+detected_at)
    const { data: existing } = await supabase
      .from('company_events')
      .select('id')
      .eq('company_id', event.company_id)
      .eq('event_type', event.event_type)
      .eq('title', event.title)
      .gte('detected_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within last 24 hours
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`[Monitoring] Event already exists: ${event.title}`);
      return false;
    }

    const { error } = await supabase
      .from('company_events')
      .insert({
        company_id: event.company_id,
        event_type: event.event_type,
        event_category: event.event_category,
        title: event.title,
        description: event.description,
        source_url: event.source_url,
        metadata: event.metadata || {},
        detected_at: event.detected_at,
        is_new: true,
      });

    if (error) {
      console.error('[Monitoring] Error saving event:', error);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('[Monitoring] Error saving event:', error.message);
    return false;
  }
}

/**
 * Mark all events as read for a company
 */
export async function markEventsAsRead(
  supabase: SupabaseClient,
  companyId: string
): Promise<void> {
  try {
    await supabase
      .from('company_events')
      .update({ is_new: false })
      .eq('company_id', companyId)
      .eq('is_new', true);
  } catch (error: any) {
    console.error('[Monitoring] Error marking events as read:', error.message);
  }
}

/**
 * Get unread event count for a company
 */
export async function getUnreadEventCount(
  supabase: SupabaseClient,
  companyId: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('company_events')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_new', true);

    if (error) {
      console.error('[Monitoring] Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error: any) {
    console.error('[Monitoring] Error getting unread count:', error.message);
    return 0;
  }
}

/**
 * Main monitoring function - checks all APIs for a company
 */
export async function monitorCompany(
  supabase: SupabaseClient,
  company: Company,
  apiKeys: {
    apify?: string;
    brightdata?: string;
    diffbot?: string;
  }
): Promise<{ eventsFound: number; eventsSaved: number }> {
  console.log(`[Monitoring] Starting monitoring for ${company.name}`);

  // Get or create monitoring config
  const { data: config } = await supabase
    .from('company_monitoring_config')
    .select('*')
    .eq('company_id', company.id)
    .maybeSingle();

  if (!config) {
    // Create default config
    await supabase
      .from('company_monitoring_config')
      .insert({
        company_id: company.id,
        last_checked_at: null,
        apify_enabled: true,
        proxycurl_enabled: false, // Disabled - using Bright Data instead
        brightdata_enabled: true,
        diffbot_enabled: true,
        check_frequency_hours: 24,
      });
  }

  const allEvents: CompanyEvent[] = [];

  // Check Apify if enabled and API key provided
  if (config?.apify_enabled !== false && apiKeys.apify) {
    console.log(`[Monitoring] Checking Apify for ${company.name}...`);
    const apifyEvents = await checkApifyWebsite(company, apiKeys.apify);
    allEvents.push(...apifyEvents);
  }

  // Check Bright Data LinkedIn if enabled and API key provided
  if (config?.brightdata_enabled !== false && apiKeys.brightdata) {
    console.log(`[Monitoring] Checking Bright Data LinkedIn for ${company.name}...`);
    const brightDataLinkedInEvents = await checkBrightDataLinkedIn(company, apiKeys.brightdata);
    allEvents.push(...brightDataLinkedInEvents);
    
    // Note: Bright Data Social Media (Twitter/Instagram/TikTok) is skipped for now
    // Uncomment below if you want to enable social media monitoring:
    // const brightDataSocialEvents = await checkBrightDataSocial(company, apiKeys.brightdata);
    // allEvents.push(...brightDataSocialEvents);
  }

  // Check Diffbot if enabled and API key provided
  if (config?.diffbot_enabled !== false && apiKeys.diffbot) {
    console.log(`[Monitoring] Checking Diffbot for ${company.name}...`);
    const diffbotEvents = await checkDiffbotKnowledgeGraph(company, apiKeys.diffbot);
    allEvents.push(...diffbotEvents);
  }

  // Save all events
  let eventsSaved = 0;
  for (const event of allEvents) {
    const saved = await saveEvent(supabase, event);
    if (saved) eventsSaved++;
  }

  // Update last checked timestamp
  await supabase
    .from('company_monitoring_config')
    .update({ last_checked_at: new Date().toISOString() })
    .eq('company_id', company.id);

  console.log(`[Monitoring] Completed for ${company.name}: ${allEvents.length} events found, ${eventsSaved} saved`);

  return {
    eventsFound: allEvents.length,
    eventsSaved,
  };
}

