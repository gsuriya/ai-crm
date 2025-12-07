/**
 * Apollo.io API Service
 * Enriches LinkedIn profiles with email addresses and company data
 */

const APOLLO_API_BASE = 'https://api.apollo.io/v1';

// Helper function to get API key (reads dynamically instead of at module load time)
function getApolloApiKey(): string | undefined {
  return process.env.APOLLO_API_KEY;
}

export interface ApolloPersonEnrichment {
  person: {
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    linkedin_url: string;
    title: string;
    email: string | null;
    email_status: string | null;
    photo_url: string | null;
    twitter_url: string | null;
    github_url: string | null;
    facebook_url: string | null;
    organization: {
      id: string;
      name: string;
      website_url: string;
      blog_url: string | null;
      angellist_url: string | null;
      linkedin_url: string | null;
      twitter_url: string | null;
      facebook_url: string | null;
      primary_phone: {
        number: string;
        source: string;
      } | null;
      languages: string[];
      alexa_ranking: number | null;
      phone: string | null;
      linkedin_uid: string | null;
      founded_year: number | null;
      publicly_traded_symbol: string | null;
      publicly_traded_exchange: string | null;
      logo_url: string | null;
      crunchbase_url: string | null;
      primary_domain: string;
    } | null;
  };
}

export interface ApolloSearchResult {
  people: Array<{
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    linkedin_url: string;
    title: string;
    email: string | null;
    email_status: string | null;
    organization_name: string | null;
  }>;
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

/**
 * Enrich a person's data using their LinkedIn URL and additional profile data
 * Passing more information improves match accuracy
 */
export async function enrichPersonByLinkedIn(
  linkedinUrl: string,
  additionalData?: {
    firstName?: string;
    lastName?: string;
    name?: string;
    organizationName?: string;
    title?: string;
    email?: string;
  }
): Promise<ApolloPersonEnrichment | null> {
  try {
    const APOLLO_API_KEY = getApolloApiKey();
    
    if (!APOLLO_API_KEY) {
      throw new Error('Apollo API key not configured');
    }

    // Build request body with all available data for better matching
    const requestBody: any = {
      linkedin_url: linkedinUrl,
      reveal_personal_emails: true,
      reveal_phone_number: true, // Also get phone numbers
    };

    // Add additional data if provided to improve matching
    if (additionalData) {
      if (additionalData.firstName) {
        requestBody.first_name = additionalData.firstName;
      }
      if (additionalData.lastName) {
        requestBody.last_name = additionalData.lastName;
      }
      if (additionalData.name) {
        requestBody.name = additionalData.name;
      }
      if (additionalData.organizationName) {
        requestBody.organization_name = additionalData.organizationName;
      }
      if (additionalData.title) {
        requestBody.title = additionalData.title;
      }
      if (additionalData.email) {
        requestBody.email = additionalData.email;
      }
    }

    console.log('[Apollo] Enriching person with data:', {
      linkedin_url: linkedinUrl,
      first_name: requestBody.first_name,
      last_name: requestBody.last_name,
      organization_name: requestBody.organization_name,
      title: requestBody.title,
    });

    const response = await fetch(`${APOLLO_API_BASE}/people/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY, // API key goes in header, not body
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Apollo] API error:', error);
      throw new Error(`Apollo API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('[Apollo] Enrichment successful:', {
      name: data.person?.name,
      email: data.person?.email,
      organization: data.person?.organization?.name,
    });
    
    return data;
  } catch (error) {
    console.error('[Apollo] Error enriching person:', error);
    return null;
  }
}

/**
 * Search for people by name and company
 */
export async function searchPeople(params: {
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  title?: string;
  page?: number;
  perPage?: number;
}): Promise<ApolloSearchResult | null> {
  try {
    const APOLLO_API_KEY = getApolloApiKey();
    
    if (!APOLLO_API_KEY) {
      throw new Error('Apollo API key not configured');
    }

    const searchParams: any = {
      page: params.page || 1,
      per_page: params.perPage || 10,
    };

    // Build person_titles filter
    const personTitles: string[] = [];
    if (params.title) {
      personTitles.push(params.title);
    }

    // Build q_keywords (name search)
    const keywords: string[] = [];
    if (params.firstName) keywords.push(params.firstName);
    if (params.lastName) keywords.push(params.lastName);

    if (keywords.length > 0) {
      searchParams.q_keywords = keywords.join(' ');
    }

    if (params.organizationName) {
      searchParams.q_organization_name = params.organizationName;
    }

    if (personTitles.length > 0) {
      searchParams.person_titles = personTitles;
    }

    const response = await fetch(`${APOLLO_API_BASE}/mixed_people/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Apollo API error:', error);
      throw new Error(`Apollo API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching people with Apollo:', error);
    return null;
  }
}

/**
 * Enrich a person by name and company domain
 */
export async function enrichPersonByNameAndCompany(params: {
  firstName: string;
  lastName: string;
  organizationName?: string;
  domain?: string;
}): Promise<ApolloPersonEnrichment | null> {
  try {
    const APOLLO_API_KEY = getApolloApiKey();
    
    if (!APOLLO_API_KEY) {
      throw new Error('Apollo API key not configured');
    }

    const response = await fetch(`${APOLLO_API_BASE}/people/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify({
        first_name: params.firstName,
        last_name: params.lastName,
        organization_name: params.organizationName,
        domain: params.domain,
        reveal_personal_emails: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Apollo API error:', error);
      throw new Error(`Apollo API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error enriching person with Apollo:', error);
    return null;
  }
}
