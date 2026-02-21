import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

// CORS headers for Chrome extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/extract-linkedin-profile
 * Uses GPT to extract profile data from LinkedIn page text
 * Much more reliable than CSS selectors
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageText, profileUrl } = body;

    if (!pageText) {
      return NextResponse.json(
        { error: 'pageText is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('[Extract Profile] Processing profile from:', profileUrl);
    console.log('[Extract Profile] Page text length:', pageText.length);

    // Truncate page text to avoid token limits (keep first 4000 chars which should have all profile info)
    const truncatedText = pageText.substring(0, 4000);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a LinkedIn profile data extractor. Extract the following information from the LinkedIn profile text provided. Return ONLY valid JSON, no markdown or explanation.

The JSON should have these fields:
- firstName: string (the person's first name)
- lastName: string (the person's last name - if they have a middle name or nickname in parentheses, ignore it)
- company: string (their CURRENT company name - this is usually shown prominently, NOT the duration like "7 yrs 4 mos")
- title: string (their current job title/position)
- location: string (their location if visible)

IMPORTANT:
- The company should be the actual company NAME like "Google", "Meta", "Goldman Sachs", etc.
- Do NOT include duration/tenure like "7 yrs 4 mos" as the company
- Do NOT include employment type like "Full-time" as part of the company name
- If you see something like "Product Manager at Google", the company is "Google"
- Look for company names near logos or in the header section of the profile`
        },
        {
          role: 'user',
          content: `Extract the profile data from this LinkedIn page text:\n\n${truncatedText}`
        }
      ],
      temperature: 0,
      max_tokens: 200,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    console.log('[Extract Profile] GPT response:', responseText);

    // Parse the JSON response
    let profileData;
    try {
      // Remove any markdown code blocks if present
      const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      profileData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[Extract Profile] Failed to parse GPT response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse profile data from GPT response' },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('[Extract Profile] Extracted data:', profileData);

    return NextResponse.json({
      success: true,
      profile: {
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        company: profileData.company || '',
        title: profileData.title || '',
        location: profileData.location || '',
        profileUrl: profileUrl || '',
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Extract Profile] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract profile' },
      { status: 500, headers: corsHeaders }
    );
  }
}







