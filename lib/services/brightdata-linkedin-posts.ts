/**
 * Bright Data LinkedIn Posts Scraper Helper
 * Uses Bright Data Dataset API to scrape LinkedIn post content
 */

export interface LinkedInPost {
  url: string;
  title?: string;
  text?: string;
  content?: string;
  created_at?: string;
  date?: string;
  author?: string;
  [key: string]: any;
}

/**
 * Submit LinkedIn post URLs for scraping
 * Returns snapshot_id for polling
 */
export async function submitLinkedInPostsScrape(
  postUrls: string[],
  datasetId: string,
  apiKey: string
): Promise<{ snapshot_id: string } | null> {
  try {
    const scrapeUrl = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}&notify=false&include_errors=true`;
    
    const response = await fetch(scrapeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: postUrls.map(url => ({ url })),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return { snapshot_id: data.snapshot_id };
    } else {
      const error = await response.json();
      console.error('[Bright Data] Scrape submission error:', error);
      return null;
    }
  } catch (error: any) {
    console.error('[Bright Data] Error submitting scrape:', error.message);
    return null;
  }
}

/**
 * Poll snapshot status until ready
 * Returns status: 'running' | 'ready' | 'failed'
 */
export async function pollSnapshotStatus(
  snapshotId: string,
  apiKey: string,
  maxAttempts: number = 20,
  pollIntervalMs: number = 5000
): Promise<{ status: string; message?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ready' || data.status === 'failed') {
          return data;
        }
        // Still running, wait and retry
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }
      }
    } catch (error: any) {
      console.error('[Bright Data] Error polling snapshot:', error.message);
      return { status: 'failed', message: error.message };
    }
  }
  
  return { status: 'running', message: 'Timeout waiting for snapshot' };
}

/**
 * Download snapshot results
 * Returns array of scraped post data
 */
export async function downloadSnapshotResults(
  snapshotId: string,
  apiKey: string
): Promise<LinkedInPost[]> {
  try {
    // Try different download endpoint formats
    const downloadUrls = [
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}/download`,
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}/download/json`,
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
    ];

    for (const downloadUrl of downloadUrls) {
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          // Handle different response formats
          if (Array.isArray(data)) {
            return data;
          } else if (data.data && Array.isArray(data.data)) {
            return data.data;
          } else if (data.results && Array.isArray(data.results)) {
            return data.results;
          }
        } else {
          // Might be CSV or other format
          const text = await response.text();
          console.log('[Bright Data] Non-JSON response format:', contentType);
          // TODO: Parse CSV if needed
        }
      }
    }
    
    console.error('[Bright Data] Could not download snapshot results');
    return [];
  } catch (error: any) {
    console.error('[Bright Data] Error downloading snapshot:', error.message);
    return [];
  }
}

/**
 * Complete workflow: Submit scrape, poll, and download results
 */
export async function scrapeLinkedInPosts(
  postUrls: string[],
  datasetId: string,
  apiKey: string
): Promise<LinkedInPost[]> {
  // Step 1: Submit scrape
  const snapshot = await submitLinkedInPostsScrape(postUrls, datasetId, apiKey);
  if (!snapshot) {
    return [];
  }

  // Step 2: Poll for completion
  const status = await pollSnapshotStatus(snapshot.snapshot_id, apiKey);
  if (status.status !== 'ready') {
    console.log(`[Bright Data] Snapshot ${snapshot.snapshot_id} status: ${status.status}`);
    return [];
  }

  // Step 3: Download results
  const results = await downloadSnapshotResults(snapshot.snapshot_id, apiKey);
  return results;
}

