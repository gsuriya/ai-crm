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
    const { message, blocks, name, description } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Convert blocks to a readable format for the LLM
    const blocksDescription = blocks?.map((block: any) => {
      const typeLabelMap: Record<string, string> = {
        trigger: 'Start',
        email: 'Send Email',
        voicemail: 'Leave Voicemail',
        calendar: 'Send Calendar Invite',
        conditional: 'If / Else',
        delay: 'Wait',
        end: 'End',
      };
      const typeLabel = typeLabelMap[block.type] || block.type;

      let desc = `- ${typeLabel}: "${block.title}"`;
      
      if (block.connections && block.connections.length > 0) {
        const connectedTitles = blocks
          .filter((b: any) => block.connections.includes(b.id))
          .map((b: any) => b.title);
        desc += ` → connects to: ${connectedTitles.join(', ')}`;
      }
      
      if (block.truePath) {
        const trueBlock = blocks.find((b: any) => b.id === block.truePath);
        desc += ` → TRUE path: "${trueBlock?.title || 'unknown'}"`;
      }
      
      if (block.falsePath) {
        const falseBlock = blocks.find((b: any) => b.id === block.falsePath);
        desc += ` → FALSE path: "${falseBlock?.title || 'unknown'}"`;
      }

      if (block.config) {
        if (block.type === 'email' && block.config.subject) {
          desc += ` (Subject: "${block.config.subject}")`;
        }
        if (block.type === 'delay') {
          desc += ` (${block.config.delayDays || 0} days, ${block.config.delayHours || 0} hours)`;
        }
      }

      return desc;
    }).join('\n') || 'No blocks yet';

    const systemPrompt = `You are a helpful assistant for building cadence workflows. The user is working on a cadence workflow builder.

Current cadence: "${name || 'Unnamed'}"
${description ? `Description: ${description}` : ''}

Current workflow blocks:
${blocksDescription}

Your role:
- Answer questions about the current workflow clearly and concisely
- Suggest improvements or explain what blocks do
- Keep responses VERY brief (1-2 sentences max)
- Be conversational and helpful
- Never write long explanations unless specifically asked

The user can eventually ask you to create workflows, but for now just answer questions about the current workflow.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 120,
    });

    const reply = response.choices[0]?.message?.content?.trim() || 'Sorry, I could not generate a response.';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Error in cadence chat API:', error);
    return NextResponse.json(
      { error: 'Failed to get response from AI' },
      { status: 500 }
    );
  }
}

