/**
 * Hunter.io API Service
 * Finds email addresses from names and company domains
 */

const HUNTER_API_BASE = 'https://api.hunter.io/v2';

// Helper function to get API key (reads dynamically)
function getHunterApiKey(): string | undefined {
  return process.env.HUNTER_API_KEY;
}

export interface HunterEmailFinderResult {
  data: {
    first_name: string;
    last_name: string;
    email: string | null;
    score: number; // Confidence score 0-100
    position: string | null;
    twitter: string | null;
    linkedin_url: string | null;
    phone_number: string | null;
    company: string | null;
    sources: Array<{
      domain: string;
      uri: string;
      extracted_on: string;
      last_seen_on: string;
      still_on_page: boolean;
    }>;
  };
  meta: {
    params: {
      first_name: string;
      last_name: string;
      full_name: string;
      domain: string;
      company: string;
    };
  };
}

export interface HunterDomainSearchResult {
  data: {
    domain: string;
    disposable: boolean;
    webmail: boolean;
    accept_all: boolean;
    pattern: string; // e.g., "{first}.{last}" or "{first}{last}"
    organization: string;
    emails: Array<{
      value: string;
      type: string;
      confidence: number;
      first_name: string;
      last_name: string;
      position: string;
      seniority: string;
      department: string;
      linkedin: string | null;
      twitter: string | null;
      phone_number: string | null;
    }>;
  };
}

export interface HunterEmailVerifierResult {
  data: {
    status: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown';
    result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
    score: number; // 0-100
    email: string;
    regexp: boolean;
    gibberish: boolean;
    disposable: boolean;
    webmail: boolean;
    mx_records: boolean;
    smtp_server: boolean;
    smtp_check: boolean;
    accept_all: boolean;
    block: boolean;
    sources: Array<{
      domain: string;
      uri: string;
      extracted_on: string;
      last_seen_on: string;
      still_on_page: boolean;
    }>;
  };
}

/**
 * Find email address using first name, last name, and company name
 * Hunter.io will automatically determine the correct domain from the company name
 * NO domain guessing - let Hunter.io handle everything
 */
export async function findEmail(params: {
  firstName: string;
  lastName: string;
  company: string;
}): Promise<HunterEmailFinderResult | null> {
  try {
    const HUNTER_API_KEY = getHunterApiKey();
    
    if (!HUNTER_API_KEY) {
      throw new Error('Hunter.io API key not configured');
    }

    const url = new URL(`${HUNTER_API_BASE}/email-finder`);
    url.searchParams.append('first_name', params.firstName);
    url.searchParams.append('last_name', params.lastName);
    url.searchParams.append('company', params.company);
    url.searchParams.append('api_key', HUNTER_API_KEY);

    console.log('[Hunter] Finding email for:', {
      firstName: params.firstName,
      lastName: params.lastName,
      company: params.company,
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Hunter] API error:', error);
      throw new Error(`Hunter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    console.log('[Hunter] Result:', {
      email: data.data?.email,
      score: data.data?.score,
      sources: data.data?.sources?.length || 0,
    });

    return data;
  } catch (error) {
    console.error('[Hunter] Error finding email:', error);
    return null;
  }
}

/**
 * Search for all emails at a company domain
 * Useful for finding multiple contacts at the same company
 */
export async function domainSearch(params: {
  domain: string;
  company?: string;
  limit?: number;
  offset?: number;
}): Promise<HunterDomainSearchResult | null> {
  try {
    const HUNTER_API_KEY = getHunterApiKey();
    
    if (!HUNTER_API_KEY) {
      throw new Error('Hunter.io API key not configured');
    }

    const url = new URL(`${HUNTER_API_BASE}/domain-search`);
    url.searchParams.append('domain', params.domain);
    if (params.company) {
      url.searchParams.append('company', params.company);
    }
    if (params.limit) {
      url.searchParams.append('limit', params.limit.toString());
    }
    if (params.offset) {
      url.searchParams.append('offset', params.offset.toString());
    }
    url.searchParams.append('api_key', HUNTER_API_KEY);

    console.log('[Hunter] Searching domain:', params.domain);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Hunter] API error:', error);
      throw new Error(`Hunter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    console.log('[Hunter] Found emails:', data.data?.emails?.length || 0);

    return data;
  } catch (error) {
    console.error('[Hunter] Error searching domain:', error);
    return null;
  }
}

/**
 * Verify if an email address is valid and deliverable
 */
export async function verifyEmail(email: string): Promise<HunterEmailVerifierResult | null> {
  try {
    const HUNTER_API_KEY = getHunterApiKey();
    
    if (!HUNTER_API_KEY) {
      throw new Error('Hunter.io API key not configured');
    }

    const url = new URL(`${HUNTER_API_BASE}/email-verifier`);
    url.searchParams.append('email', email);
    url.searchParams.append('api_key', HUNTER_API_KEY);

    console.log('[Hunter] Verifying email:', email);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Hunter] API error:', error);
      throw new Error(`Hunter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    console.log('[Hunter] Verification result:', {
      status: data.data?.status,
      result: data.data?.result,
      score: data.data?.score,
    });

    return data;
  } catch (error) {
    console.error('[Hunter] Error verifying email:', error);
    return null;
  }
}

