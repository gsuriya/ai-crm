import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Use GPT to extract key search terms from a natural language query
 * This helps with queries like "yo gimme some food shit" -> extracts "food"
 */
export async function extractSearchTerms(query: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set, using original query');
    return query;
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a search query extractor. Extract the key business/company search terms from the user\'s query. Return ONLY the essential keywords that would help find relevant companies. Remove filler words, slang, and casual language. Focus on: industry terms, company types, business keywords, technology terms, etc.\n\nIMPORTANT: Only extract terms that are directly relevant to company search. Do NOT include generic words.\n\nExamples:\n- "yo gimme some food shit" -> "food technology foodtech"\n- "find me biotech companies" -> "biotech biotechnology"\n- "companies with ARR above 3M" -> "ARR above 3M"\n- "funding round" -> "funding round"\n- "show me mobile apps" -> "mobile app"\n\nReturn only the keywords, no explanations. If no relevant business terms found, return the original query.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
      temperature: 0.3,
      max_tokens: 50,
    });

    const extracted = response.choices[0]?.message?.content?.trim() || query;
    console.log('Query extraction:', { original: query, extracted });
    return extracted;
  } catch (error) {
    console.error('Error extracting search terms:', error);
    return query; // Fallback to original query
  }
}

