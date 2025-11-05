import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not set');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailBody, companyName, companyDescription, companyWebsite } = body;

    if (!emailBody) {
      return NextResponse.json(
        { error: 'Email body is required' },
        { status: 400 }
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Build context for personalization
    const contextParts: string[] = [];
    if (companyName) contextParts.push(`Company: ${companyName}`);
    if (companyDescription) contextParts.push(`Description: ${companyDescription}`);
    if (companyWebsite) contextParts.push(`Website: ${companyWebsite}`);

    const context = contextParts.length > 0 
      ? contextParts.join('\n')
      : 'No company information available';

    // Create prompt for GPT to generate personalization
    const systemPrompt = `You are an expert at writing personalized, natural-sounding one-sentence additions to business emails. Your job is to create a brief, relevant personalization that fits smoothly into the email's tone and style.

Guidelines:
- Write ONE sentence only (keep it concise)
- Make it natural and conversational
- Reference the company information provided if relevant
- Match the tone of the email (professional, casual, friendly, etc.)
- Don't be overly salesy or pushy
- Make it feel like a genuine, personal touch
- Don't include greeting or closing - just the personalization sentence itself`;

    const userPrompt = `Generate a one-sentence personalization for this email:

Email body:
${emailBody}

Company information:
${context}

Write a single sentence that can be inserted into the email where {personalization} appears. The sentence should fit naturally into the email's flow and tone.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const personalization = response.choices[0]?.message?.content?.trim() || 
      `I noticed ${companyName ? `your work at ${companyName}` : 'some interesting work'}.`;

    return NextResponse.json({ personalization });
  } catch (error: any) {
    console.error('Error generating personalization:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate personalization' },
      { status: 500 }
    );
  }
}

