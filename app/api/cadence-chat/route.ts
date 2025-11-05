import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY not set');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface FlowSpec {
  blocks: Array<{
    type: 'email' | 'voicecall' | 'delay';
    order: number;
    spacing?: { days?: number; hours?: number; minutes?: number };
    message?: { subject?: string; body?: string };
    replyInThread?: boolean;
  }>;
  defaultReplyInThread: boolean;
  defaultMessagesBlank: boolean;
}

function parseFlowRequest(message: string): FlowSpec | null {
  const lowerMessage = message.toLowerCase().trim();
  
  // Handle confirmatory messages like "build it", "yes", "go ahead", etc.
  const confirmatoryMessages = /^(build\s+it|yes|yep|yup|go\s+ahead|do\s+it|create\s+it|make\s+it|sure|ok|okay|that\s+looks\s+good|sounds\s+good)$/i;
  if (confirmatoryMessages.test(lowerMessage)) {
    // This is a confirmation - treat as build request with defaults
    // The user likely described the workflow in a previous message
    // We'll use common defaults: 2 emails, 1 day spacing
    return {
      blocks: [
        { type: 'email', order: 1 },
        { type: 'email', order: 2, spacing: { days: 1 } },
      ],
      defaultReplyInThread: true,
      defaultMessagesBlank: true,
    };
  }
  
  // Normalize common typos
  let normalizedMessage = lowerMessage
    .replace(/emaiil/gi, 'email')
    .replace(/emial/gi, 'email')
    .replace(/emial/gi, 'email')
    .replace(/eamil/gi, 'email');
  
  // Convert number words to digits for easier parsing
  const numberWords: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };
  
  // Replace number words with digits
  for (const [word, num] of Object.entries(numberWords)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    normalizedMessage = normalizedMessage.replace(regex, num.toString());
  }

  // Check if this looks like a workflow building request
  // It should mention emails/emails AND (spacing/time OR be explicitly a build request)
  const hasEmailMention = /\d+\s*email/i.test(normalizedMessage) || /email/i.test(normalizedMessage);
  const hasSpacingMention = /(?:spac|between|apart|day|hour|minute|wait|delay)/i.test(normalizedMessage);
  const hasBuildKeyword = /(?:build|create|make|generate|construct|flow|sequence|cadence|workflow)/i.test(normalizedMessage);
  const hasConsecutive = /consecutive/i.test(normalizedMessage);
  
  // If they mention emails with spacing OR build keywords, treat as build request
  // Also handle simple cases like "2 emails" or "two emails"
  if (!hasEmailMention && !hasBuildKeyword) {
    return null;
  }

  const spec: FlowSpec = {
    blocks: [],
    defaultReplyInThread: true,
    defaultMessagesBlank: true,
  };

  // Extract number of emails - try multiple patterns
  let numEmails = 0;
  const emailPatterns = [
    /(\d+)\s*email/i,
    /email.*?(\d+)/i,
    /(\d+).*?email/i,
  ];
  
  for (const pattern of emailPatterns) {
    const match = normalizedMessage.match(pattern);
    if (match) {
      numEmails = parseInt(match[1]);
      break;
    }
  }
  
  // If no number found but email is mentioned, default to 2 (common case)
  if (numEmails === 0 && hasEmailMention) {
    numEmails = 2; // Default to 2 emails if not specified
  }

  // Extract spacing for emails (days, hours, minutes) - be very flexible
  const emailSpacing: { days?: number; hours?: number; minutes?: number } = {};
  
  // First, try to find spacing specifically for emails (before call mention)
  const callMatch = normalizedMessage.match(/(?:call|phone|voice).*?(?:after|later|then)/i);
  const emailPart = callMatch ? normalizedMessage.substring(0, callMatch.index || normalizedMessage.length) : normalizedMessage;
  
  // Pattern 1: "1 day", "2 days", "1d", etc. in email context
  const dayPatterns = [
    /(\d+)\s*days?/i,
    /(\d+)\s*d\b/i,
    /day.*?(\d+)/i,
    /(\d+).*?day/i,
  ];
  
  for (const pattern of dayPatterns) {
    const match = emailPart.match(pattern);
    if (match) {
      emailSpacing.days = parseInt(match[1]);
      break;
    }
  }
  
  // Pattern 2: If they say "one day" or "day" without number, assume 1
  if (!emailSpacing.days && (emailPart.includes('one day') || 
      (emailPart.includes('day') && !emailPart.match(/\d+/)))) {
    emailSpacing.days = 1;
  }
  
  // Pattern 3: Handle "consecutive" or "spaced" as 1 day default
  if (!emailSpacing.days && (hasConsecutive || emailPart.includes('spaced'))) {
    emailSpacing.days = 1;
  }
  
  // Extract hours for emails
  const hourPatterns = [
    /(\d+)\s*hours?/i,
    /(\d+)\s*h\b/i,
  ];
  for (const pattern of hourPatterns) {
    const match = emailPart.match(pattern);
    if (match) {
      emailSpacing.hours = parseInt(match[1]);
      break;
    }
  }
  
  // Extract minutes for emails
  const minutePatterns = [
    /(\d+)\s*minutes?/i,
    /(\d+)\s*min\b/i,
  ];
  for (const pattern of minutePatterns) {
    const match = emailPart.match(pattern);
    if (match) {
      emailSpacing.minutes = parseInt(match[1]);
      break;
    }
  }

  // Default spacing if emails mentioned but no spacing specified
  if (Object.keys(emailSpacing).length === 0 && numEmails > 1 && hasSpacingMention) {
    emailSpacing.days = 1; // Default to 1 day if spacing is mentioned but not specified
  }

  // Check for phone call and extract its spacing
  const hasPhoneCall = /phone|call|voice/i.test(normalizedMessage);
  let phoneCallPosition: 'after' | 'before' | null = null;
  let callSpacing: { days?: number; hours?: number; minutes?: number } = {};
  
  if (hasPhoneCall) {
    phoneCallPosition = normalizedMessage.match(/after.*(?:last|final|end).*(?:email|message)/i) ? 'after' : 
                       normalizedMessage.match(/(?:before|prior).*(?:email|message)/i) ? 'before' : 
                       'after';
    
    // Extract spacing for call - look in the part of message after call/end mention
    const callMentionMatch = normalizedMessage.match(/(?:call|phone|voice|at\s+the\s+end)/i);
    if (callMentionMatch) {
      const callPart = normalizedMessage.substring(callMentionMatch.index || 0);
      
      // Look for spacing patterns in the call part
      const callSpacingPatterns = [
        /(?:after|later|then).*?(\d+)\s*days?/i,
        /(\d+)\s*days?\s*(?:later|after)/i,
        /(\d+)\s*days?/i, // Fallback: any number of days
      ];
      
      for (const pattern of callSpacingPatterns) {
        const match = callPart.match(pattern);
        if (match) {
          callSpacing.days = parseInt(match[1]);
          break;
        }
      }
      
      // Also check for hours/minutes for call
      const callHourMatch = callPart.match(/(?:after|later|then).*?(\d+)\s*hours?/i);
      if (callHourMatch) {
        callSpacing.hours = parseInt(callHourMatch[1]);
      }
      
      const callMinuteMatch = callPart.match(/(?:after|later|then).*?(\d+)\s*minutes?/i);
      if (callMinuteMatch) {
        callSpacing.minutes = parseInt(callMinuteMatch[1]);
      }
    }
  }

  // Check for thread settings
  const replyInThread = !normalizedMessage.includes('new thread') && !normalizedMessage.includes('separate thread');
  spec.defaultReplyInThread = replyInThread;

  // Check for specific messages - look for blank/default explicitly
  const hasSpecificMessages = /(?:message|subject|body|content|text)/i.test(normalizedMessage) && 
                              !normalizedMessage.includes('blank') && 
                              !normalizedMessage.includes('default') &&
                              !normalizedMessage.includes('empty');
  spec.defaultMessagesBlank = !hasSpecificMessages || normalizedMessage.includes('blank');

  // Build blocks array
  let order = 1;

  // Add emails
  for (let i = 0; i < numEmails; i++) {
    spec.blocks.push({
      type: 'email',
      order: order++,
      spacing: i === 0 ? undefined : emailSpacing, // No spacing before first email
      replyInThread: replyInThread && i > 0, // First email is new thread, rest reply
    });
  }

  // Add phone call if specified
  if (phoneCallPosition === 'after' && numEmails > 0) {
    spec.blocks.push({
      type: 'voicecall',
      order: order++,
      spacing: Object.keys(callSpacing).length > 0 ? callSpacing : undefined, // Add spacing before call if specified
    });
  } else if (phoneCallPosition === 'before' && numEmails > 0) {
    spec.blocks.unshift({
      type: 'voicecall',
      order: 0,
    });
    // Reorder emails
    spec.blocks.forEach((block, idx) => {
      if (block.type === 'email') block.order = idx + 1;
    });
  }

  return spec.blocks.length > 0 ? spec : null;
}

function generateBlocksFromSpec(spec: FlowSpec, existingBlocks: any[]): any[] {
  const newBlocks: any[] = [];
  const triggerBlock = existingBlocks.find(b => b.type === 'trigger') || {
    id: '1',
    type: 'trigger',
    x: 400,
    y: 100,
    title: 'Cadence starts',
    connections: [],
  };

  newBlocks.push(triggerBlock);

  let currentY = 200;
  let lastBlockId = triggerBlock.id;
  let lastEmailBlockId: string | null = null;
  const existingBlockIds = existingBlocks.map((b: any) => parseInt(b.id) || 0).filter(id => !isNaN(id) && id > 0);
  let blockIdCounter = existingBlockIds.length > 0 ? Math.max(...existingBlockIds) + 1 : 2;
  let emailIndex = 0;

  // Sort blocks by order
  const sortedBlocks = [...spec.blocks].sort((a, b) => a.order - b.order);

  sortedBlocks.forEach((blockSpec, index) => {
    // Add delay before this block if spacing is specified (not before first block)
    if (blockSpec.spacing && Object.keys(blockSpec.spacing).length > 0 && index > 0) {
      const delayId = (blockIdCounter++).toString();
      const delayBlock = {
        id: delayId,
        type: 'delay' as const,
        x: 400,
        y: currentY,
        title: 'Wait',
        config: {
          delayDays: blockSpec.spacing.days || 0,
          delayHours: blockSpec.spacing.hours || 0,
          delayMinutes: blockSpec.spacing.minutes || 0,
          delaySeconds: 0,
        },
        connections: [],
      };
      newBlocks.push(delayBlock);
      lastBlockId = delayId;
      currentY += 150;
    }

    const blockId = (blockIdCounter++).toString();
    const x = 400;
    const y = currentY;

    if (blockSpec.type === 'email') {
      emailIndex++;
      const emailBlock = {
        id: blockId,
        type: 'email' as const,
        x,
        y,
        title: `Email ${emailIndex}`,
        config: {
          subject: blockSpec.message?.subject || '',
          body: blockSpec.message?.body || '',
          threadSelection: blockSpec.replyInThread && lastEmailBlockId ? lastEmailBlockId : 'new',
        },
        connections: [],
      };
      newBlocks.push(emailBlock);
      lastBlockId = blockId;
      lastEmailBlockId = blockId; // Track last email for thread replies
      currentY += 150;
    } else if (blockSpec.type === 'voicecall') {
      const callBlock = {
        id: blockId,
        type: 'voicecall' as const,
        x,
        y,
        title: 'Voice Call',
        config: {},
        connections: [],
      };
      newBlocks.push(callBlock);
      lastBlockId = blockId;
      currentY += 150;
    }
  });

  // Connect blocks in sequence
  for (let i = 0; i < newBlocks.length - 1; i++) {
    const currentBlock = newBlocks[i];
    const nextBlock = newBlocks[i + 1];
    
    if (currentBlock.type === 'trigger' || currentBlock.type === 'delay' || 
        currentBlock.type === 'email' || currentBlock.type === 'voicecall') {
      if (!currentBlock.connections) {
        currentBlock.connections = [];
      }
      currentBlock.connections.push(nextBlock.id);
    }
  }

  return newBlocks;
}

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

    // Try to parse flow building request
    const flowSpec = parseFlowRequest(message);
    
    if (flowSpec) {
      // Generate blocks from spec
      const generatedBlocks = generateBlocksFromSpec(flowSpec, blocks || []);
      
      return NextResponse.json({
        reply: `I've built your flow with ${flowSpec.blocks.length} blocks. ${flowSpec.defaultReplyInThread ? 'All emails will reply in the same thread.' : 'Each email will start a new thread.'} ${flowSpec.defaultMessagesBlank ? 'Email messages are blank - you can customize them later.' : ''}`,
        action: 'build',
        blocks: generatedBlocks,
      });
    }

    // Convert blocks to a readable format for the LLM
    const blocksDescription = blocks?.map((block: any) => {
      const typeLabelMap: Record<string, string> = {
        trigger: 'Start',
        email: 'Send Email',
        voicecall: 'Voice Call',
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

Available block types:
- Send Email: Send an email to the contact
- Voice Call: Make an AI voice call
- Wait: Add a delay between actions

Current cadence: "${name || 'Unnamed'}"
${description ? `Description: ${description}` : ''}

Current workflow blocks:
${blocksDescription}

IMPORTANT: Workflow building requests (like "2 emails spaced 1 day apart") are handled automatically. 
If a user message looks like a workflow building request but wasn't processed, just acknowledge it and suggest they try again with a clearer format.

Your role:
- Answer questions about the current workflow clearly and concisely
- Suggest improvements or explain what blocks do
- NEVER ask repetitive clarifying questions - if you need to clarify, ask ONCE and move on
- Keep responses brief (1-2 sentences max)
- Be direct and helpful - avoid asking the same question multiple times
- If a user seems frustrated or repeats themselves, they're likely trying to build a workflow - acknowledge this and be helpful`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 200,
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

