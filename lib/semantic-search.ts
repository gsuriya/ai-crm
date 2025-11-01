import { supabase } from '@/lib/supabase';
import { generateEmbedding } from './embeddings';
import { extractSearchTerms } from './query-extraction';

export interface SearchMatch {
  company_id: string;
  company_name: string;
  content_id?: string;
  content_type: string;
  content_snippet: string;
  source?: string;
  metadata?: Record<string, any>;
  match_score: number;
  content_date: string;
  metadata_key?: string;
}

export interface SearchFilters {
  arr_min?: number;
  arr_max?: number;
  funding_min?: number;
  funding_max?: number;
  industry?: string;
  content_types?: string[];
  date_from?: string;
  date_to?: string;
}

export interface SearchOptions {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  threshold?: number; // Similarity threshold (0-1)
}

/**
 * Perform hybrid search combining semantic and text search
 * This ensures partial matches (like "fun" matching "funding") work correctly
 */
export async function hybridSearch(options: SearchOptions): Promise<SearchMatch[]> {
  const { query, filters = {}, limit = 50, threshold = 0.7 } = options;
  
  // Use GPT to extract key search terms from natural language queries
  const extractedQuery = await extractSearchTerms(query);
  
  // Determine if we should use semantic search
  // Use semantic search for multi-word queries or queries that seem like natural language
  const shouldUseSemantic = extractedQuery.split(' ').length > 1 || extractedQuery.length >= 3;
  
  // Always perform text search for partial matching (using original query for text matching)
  const [semanticResults, textResults] = await Promise.all([
    shouldUseSemantic ? semanticSearch({ ...options, query: extractedQuery, threshold: 0.3 }) : Promise.resolve([]), // Slightly higher threshold to reduce noise
    import('./text-search').then(m => m.textSearch(query, limit)), // Use original query for text search
  ]);

  // Filter semantic results to only include relevant matches
  // Check if company name or content actually contains extracted keywords
  const extractedWords = extractedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const filteredSemanticResults = semanticResults.filter(match => {
    // If it's a company name match, check if name contains extracted keywords
    if (match.content_type === 'company_name') {
      const nameLower = match.company_name.toLowerCase();
      return extractedWords.some(word => nameLower.includes(word.toLowerCase()));
    }
    // For content/metadata matches, check if snippet contains keywords
    const snippetLower = match.content_snippet.toLowerCase();
    return extractedWords.some(word => snippetLower.includes(word.toLowerCase()));
  });

  // Combine and deduplicate results
  const resultsMap = new Map<string, SearchMatch>();
  
  // Add filtered semantic results first (they have higher priority)
  filteredSemanticResults.forEach(match => {
    resultsMap.set(match.company_id, match);
  });
  
  // Add text results that aren't already in semantic results
  // Also boost scores for exact name matches
  textResults.forEach(match => {
    const existing = resultsMap.get(match.company_id);
    if (!existing) {
      // Boost score if it's a direct company name match
      const queryLower = query.toLowerCase();
      const nameLower = match.company_name.toLowerCase();
      
      // Check if query words are actually in the company name
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      const hasRelevantMatch = queryWords.some(word => nameLower.includes(word.toLowerCase()));
      
      if (match.content_type === 'company' && hasRelevantMatch) {
        match.match_score = 0.9; // Higher score for exact name matches
        resultsMap.set(match.company_id, match);
      } else if (match.content_type !== 'company') {
        // Include content/metadata matches
        resultsMap.set(match.company_id, match);
      }
      // Otherwise skip irrelevant company name matches
    } else {
      // If we have both semantic and text matches, boost if it's a name match
      const queryLower = query.toLowerCase();
      const nameLower = match.company_name.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      const hasRelevantMatch = queryWords.some(word => nameLower.includes(word.toLowerCase()));
      
      if (match.content_type === 'company' && hasRelevantMatch) {
        existing.match_score = Math.max(existing.match_score, 0.9);
      }
    }
  });

  // Final filter: remove results where company name doesn't contain any query keywords
  const finalResults = Array.from(resultsMap.values()).filter(match => {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const nameLower = match.company_name.toLowerCase();
    const snippetLower = match.content_snippet.toLowerCase();
    
    // Keep if company name or snippet contains query keywords
    return queryWords.some(word => 
      nameLower.includes(word.toLowerCase()) || 
      snippetLower.includes(word.toLowerCase())
    );
  });

  // Sort by match score (highest first) and return
  return finalResults
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, limit);
}

/**
 * Perform semantic search across all company content
 * Uses database function for efficient vector search
 */
export async function semanticSearch(options: SearchOptions): Promise<SearchMatch[]> {
  const { query, filters = {}, limit = 50, threshold = 0.7 } = options;

  // Generate embedding for the search query
  const { embedding: queryEmbedding } = await generateEmbedding(query);

  // Build base query for companies with filters
  // If no filters are specified, get all companies for semantic search
  let companiesQuery = supabase.from('companies').select('id, name');
  
  // Only apply filters if they're actually specified
  const hasFilters = filters.arr_min || filters.arr_max || filters.funding_min || filters.funding_max || filters.industry;
  
  if (hasFilters) {
    if (filters.arr_min) {
      companiesQuery = companiesQuery.gte('arr', filters.arr_min);
    }
    if (filters.arr_max) {
      companiesQuery = companiesQuery.lte('arr', filters.arr_max);
    }
    if (filters.funding_min) {
      companiesQuery = companiesQuery.gte('funding_amount', filters.funding_min);
    }
    if (filters.funding_max) {
      companiesQuery = companiesQuery.lte('funding_amount', filters.funding_max);
    }
    if (filters.industry) {
      companiesQuery = companiesQuery.eq('industry', filters.industry);
    }
  }

  const { data: companies } = await companiesQuery;

  if (!companies || companies.length === 0) {
    return [];
  }

  const companyIds = companies.map(c => c.id);

  console.log('Semantic search starting:', { 
    query, 
    companyCount: companies.length, 
    threshold,
    companyIds: companyIds.slice(0, 3) // Log first 3 IDs
  });
  
  // Use database function for vector search
  // Supabase PostgREST has issues with vector types in RPC calls
  // Use a wrapper function that accepts text and casts to vector
  const embeddingArrayString = `[${queryEmbedding.join(',')}]`;
  
  console.log('Calling RPC with embedding string length:', embeddingArrayString.length);
  
  try {
    const { data: matches, error } = await supabase.rpc('search_companies_semantic_text', {
      query_embedding_text: embeddingArrayString, // Pass as string
      company_ids: companyIds,
      similarity_threshold: threshold,
      match_limit: limit,
      content_types: filters.content_types || null,
    });

    console.log('RPC call result:', { 
      matchesCount: matches?.length || 0, 
      error: error ? JSON.stringify(error) : null 
    });

    if (error) {
      console.error('Error performing semantic search:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      // Fallback: return all companies that match filters (without semantic search)
      return companies.map(c => ({
        company_id: c.id,
        company_name: c.name,
        content_type: 'company',
        content_snippet: '',
        match_score: 0.5,
        content_date: new Date().toISOString(),
      }));
    }

    return (matches || []).map((match: any) => ({
      company_id: match.company_id,
      company_name: match.company_name,
      content_id: match.content_id,
      content_type: match.content_type,
      content_snippet: match.content_snippet || '',
      source: match.source,
      metadata: match.metadata || {},
      match_score: match.match_score || 0,
      content_date: match.content_date,
      metadata_key: match.metadata_key,
    }));
  } catch (error) {
    console.error('Exception in semantic search:', error);
    // Fallback: return companies that match filters
    return companies.map(c => ({
      company_id: c.id,
      company_name: c.name,
      content_type: 'company',
      content_snippet: '',
      match_score: 0.5,
      content_date: new Date().toISOString(),
    }));
  }
}

/**
 * SQL function to create for vector similarity search
 * This should be run as a migration
 */
export const createVectorSearchFunction = `
CREATE OR REPLACE FUNCTION search_companies_semantic(
  query_embedding vector(1536),
  company_ids uuid[],
  similarity_threshold float DEFAULT 0.7,
  match_limit int DEFAULT 50,
  content_types text[] DEFAULT NULL
)
RETURNS TABLE (
  company_id uuid,
  company_name text,
  content_id uuid,
  content_type text,
  content_snippet text,
  source text,
  metadata jsonb,
  match_score float,
  content_date timestamp with time zone,
  metadata_key text
) AS $$
BEGIN
  RETURN QUERY
  WITH content_matches AS (
    SELECT 
      c.id as company_id,
      c.name as company_name,
      cc.id as content_id,
      cc.content_type,
      LEFT(cc.content, 200) as content_snippet,
      cc.source,
      cc.metadata,
      (1 - (cc.embedding <=> query_embedding))::float as match_score,
      cc.created_at as content_date,
      NULL::text as metadata_key
    FROM companies c
    JOIN company_content cc ON c.id = cc.company_id
    WHERE c.id = ANY(company_ids)
      AND cc.embedding IS NOT NULL
      AND (1 - (cc.embedding <=> query_embedding)) > similarity_threshold
      AND (content_types IS NULL OR cc.content_type = ANY(content_types))
  ),
  metadata_matches AS (
    SELECT 
      c.id as company_id,
      c.name as company_name,
      NULL::uuid as content_id,
      'metadata'::text as content_type,
      LEFT(cm.value, 200) as content_snippet,
      NULL::text as source,
      jsonb_build_object('key', cm.key) as metadata,
      (1 - (cm.embedding <=> query_embedding))::float as match_score,
      cm.created_at as content_date,
      cm.key as metadata_key
    FROM companies c
    JOIN company_metadata cm ON c.id = cm.company_id
    WHERE c.id = ANY(company_ids)
      AND cm.embedding IS NOT NULL
      AND (1 - (cm.embedding <=> query_embedding)) > similarity_threshold
  ),
  all_matches AS (
    SELECT * FROM content_matches
    UNION ALL
    SELECT * FROM metadata_matches
  )
  SELECT * FROM all_matches
  ORDER BY match_score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;
`;
