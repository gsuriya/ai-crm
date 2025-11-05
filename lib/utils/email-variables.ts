/**
 * Email variable replacement utilities
 * Handles {name}, {company}, and {personalization} variables in email templates
 */

export interface VariableContext {
  contactName?: string;
  companyName?: string;
  companyDescription?: string;
  companyWebsite?: string;
}

/**
 * Replace basic variables ({name}, {company}) in email text
 */
export function replaceBasicVariables(
  text: string,
  context: VariableContext
): string {
  let result = text;
  
  // Replace {name} with contact name or fallback
  if (context.contactName) {
    result = result.replace(/\{name\}/g, context.contactName);
  } else {
    result = result.replace(/\{name\}/g, 'there');
  }
  
  // Replace {company} with company name
  if (context.companyName) {
    result = result.replace(/\{company\}/g, context.companyName);
  } else {
    result = result.replace(/\{company\}/g, 'the company');
  }
  
  return result;
}

/**
 * Check if text contains {personalization} variable
 */
export function hasPersonalizationVariable(text: string): boolean {
  return /\{personalization\}/i.test(text);
}

/**
 * Replace {personalization} placeholder (will be replaced by API call)
 */
export function replacePersonalizationPlaceholder(
  text: string,
  personalization: string
): string {
  return text.replace(/\{personalization\}/gi, personalization);
}

/**
 * Generate personalization using OpenAI
 */
export async function generatePersonalization(
  emailBody: string,
  companyName?: string,
  companyDescription?: string,
  companyWebsite?: string
): Promise<string> {
  // Dynamic import to avoid bundling OpenAI in client-side code
  const { default: OpenAI } = await import('openai');
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set, using fallback personalization');
    if (companyName) {
      return `Really interesting what you're building at ${companyName}.`;
    }
    return `Really interesting what you're building.`;
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Build context for personalization
  const contextParts: string[] = [];
  if (companyName) contextParts.push(`Company: ${companyName}`);
  if (companyDescription) contextParts.push(`Description: ${companyDescription}`);
  if (companyWebsite) contextParts.push(`Website: ${companyWebsite}`);

  const context = contextParts.length > 0 
    ? contextParts.join('\n')
    : 'No company information available';

  // Create prompt for GPT to generate personalization (VC cold email style)
  const systemPrompt = `You're writing a one-sentence personalization blurb for a VC cold email.

Your personalization should:
- Sound natural, observational, and founder-focused — not robotic
- Avoid generic phrases like "congrats on funding" or "your company seems interesting"
- Mention something specific about what the company builds, their product focus, or differentiation
- Write like an investor who actually read about them
- Be concise and conversational
- Show genuine interest in their specific approach or innovation

Good examples:
• "I've been reading a ton about how you guys are doing [specific thing], I think [name vertical] is extremely interesting and would love to learn more"
• "Really interesting how you're using AI to automate field inspections — feels like a big category unlock."
• "Noticed your recent push into the healthcare vertical — great timing given payer system shifts."

Bad examples (avoid these):
• "Congrats on your Series B funding!"
• "Your company seems interesting and growing fast."
• Generic observations that could apply to any company`;

  const userPrompt = `Generate a one-sentence personalization for this VC cold email:

Email body:
${emailBody}

Company information:
${context}

Write a single sentence that can be inserted into the email where {personalization} appears. The sentence should:
- Be observational and specific about the company's product, approach, or differentiation
- Sound like you actually researched them
- Fit naturally into the email's flow and tone
- Be founder-focused and show genuine interest`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const generated = response.choices[0]?.message?.content?.trim();
    if (generated) {
      return generated;
    }
    if (companyName) {
      return `Really interesting what you're building at ${companyName}.`;
    }
    return `Really interesting what you're building.`;
  } catch (error) {
    console.error('Error generating personalization:', error);
    if (companyName) {
      return `Really interesting what you're building at ${companyName}.`;
    }
    return `Really interesting what you're building.`;
  }
}

