import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      cadenceName, 
      emailNumber, 
      totalEmails,
      subject,
      previousEmails,
      userPrompt, // The user's description of what the email should be about
    } = body;

    if (!userPrompt) {
      return NextResponse.json(
        { error: 'Please provide a description of what the email should be about' },
        { status: 400 }
      );
    }

    // Determine the email type based on position
    let emailType = 'initial outreach';
    let emailGuidance = 'This is the first email - make a strong first impression with a personalized hook.';
    
    if (emailNumber === 2) {
      emailType = 'follow-up';
      emailGuidance = 'This is a follow-up - briefly reference the previous email and add new value.';
    }
    if (emailNumber >= 3) {
      emailType = 'final follow-up';
      emailGuidance = 'This is likely the last email - be gracious and offer an easy way out while leaving the door open.';
    }

    const prompt = `Generate a ${emailType} cold email based on this request:

"${userPrompt}"

Context:
- Sequence name: "${cadenceName || 'Outreach'}"
- This is email #${emailNumber} of ${totalEmails}
${subject ? `- Subject line: "${subject}"` : ''}
- ${emailGuidance}

${previousEmails?.length > 0 ? `\nPrevious emails in this sequence for context:\n${previousEmails.map((e: any, i: number) => `Email ${i + 1}: ${e.body?.substring(0, 300)}...`).join('\n\n')}` : ''}

Requirements:
1. Keep it SHORT - 4-6 sentences max
2. Be genuine and conversational, NOT salesy or corporate
3. Use these variables naturally where appropriate:
   - {{first_name}} - their first name
   - {{company}} - their company
   - {{position}} - their job title
4. End with a clear but soft call-to-action (a question works best)
5. NO clichés like "hope this finds you well" or "just checking in" or "circle back"
6. NO signature block - just end naturally

Generate ONLY the email body text.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at writing cold emails that actually get responses. You write like a real human - concise, genuine, and focused on providing value. You avoid corporate speak and clichés.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 400,
    });

    const generatedBody = completion.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ 
      success: true, 
      body: generatedBody 
    });

  } catch (error: any) {
    console.error('Error generating email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate email' },
      { status: 500 }
    );
  }
}

