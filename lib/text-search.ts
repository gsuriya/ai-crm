import { supabase } from '@/lib/supabase';
import type { SearchMatch } from './semantic-search';

/**
 * Perform text-based fuzzy search across company content and metadata
 * Uses PostgreSQL ILIKE for case-insensitive partial matching
 */
export async function textSearch(query: string, limit: number = 50): Promise<SearchMatch[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const searchPattern = `%${query}%`;

  try {
    // Search in company_content
    const { data: contentMatches, error: contentError } = await supabase
      .from('company_content')
      .select(`
        id,
        company_id,
        content_type,
        content,
        source,
        metadata,
        created_at,
        companies(id, name)
      `)
      .ilike('content', searchPattern)
      .limit(limit);

    if (contentError) {
      console.error('Error in content text search:', contentError);
    }

    // Search in company_metadata
    const { data: metadataMatches, error: metadataError } = await supabase
      .from('company_metadata')
      .select(`
        id,
        company_id,
        key,
        value,
        created_at,
        companies(id, name)
      `)
      .ilike('value', searchPattern)
      .limit(limit);

    if (metadataError) {
      console.error('Error in metadata text search:', metadataError);
    }

    // Search in company names
    const { data: companyMatches, error: companyError } = await supabase
      .from('companies')
      .select('id, name, created_at')
      .ilike('name', searchPattern)
      .limit(limit);

    if (companyError) {
      console.error('Error in company name search:', companyError);
    }

    const results: SearchMatch[] = [];

    // Convert content matches
    if (contentMatches) {
      contentMatches.forEach((match: any) => {
        const company = match.companies;
        if (!company) return;

        // Find the snippet containing the query
        const content = match.content || '';
        const queryLower = query.toLowerCase();
        const contentLower = content.toLowerCase();
        const index = contentLower.indexOf(queryLower);
        
        let snippet = content;
        if (index >= 0) {
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + query.length + 50);
          snippet = content.slice(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < content.length) snippet = snippet + '...';
        } else {
          snippet = content.slice(0, 120) + (content.length > 120 ? '...' : '');
        }

        results.push({
          company_id: match.company_id,
          company_name: company.name || '',
          content_id: match.id,
          content_type: match.content_type,
          content_snippet: snippet,
          source: match.source,
          metadata: match.metadata || {},
          match_score: 0.8, // High score for text matches
          content_date: match.created_at,
        });
      });
    }

    // Convert metadata matches
    if (metadataMatches) {
      metadataMatches.forEach((match: any) => {
        const company = match.companies;
        if (!company) return;

        results.push({
          company_id: match.company_id,
          company_name: company.name || '',
          content_type: 'metadata',
          content_snippet: match.value || '',
          source: undefined,
          metadata: { key: match.key },
          match_score: 0.75, // Slightly lower for metadata
          content_date: match.created_at,
          metadata_key: match.key,
        });
      });
    }

    // Convert company name matches
    if (companyMatches) {
      companyMatches.forEach((company: any) => {
        // Check if we already have this company from content/metadata matches
        const existing = results.find(r => r.company_id === company.id);
        if (!existing) {
          results.push({
            company_id: company.id,
            company_name: company.name,
            content_type: 'company',
            content_snippet: '',
            match_score: 0.7, // Lower score for name-only matches
            content_date: company.created_at,
          });
        }
      });
    }

    // Deduplicate by company_id, keeping highest score
    const deduplicated = new Map<string, SearchMatch>();
    results.forEach(match => {
      const existing = deduplicated.get(match.company_id);
      if (!existing || match.match_score > existing.match_score) {
        deduplicated.set(match.company_id, match);
      }
    });

    return Array.from(deduplicated.values()).slice(0, limit);
  } catch (error) {
    console.error('Error in text search:', error);
    return [];
  }
}

