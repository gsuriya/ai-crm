import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Convert string to title case
 */
function toTitleCase(str: string): string {
  // Handle special cases first
  const specialCases: Record<string, string> = {
    'assemblyai': 'AssemblyAI',
    'crewai': 'CrewAI',
    'e2b': 'E2B',
    'openrouter': 'OpenRouter',
    'checkout.com': 'Checkout.com',
    'weights & biases': 'Weights & Biases',
  };

  const lowerStr = str.toLowerCase();
  if (specialCases[lowerStr]) {
    return specialCases[lowerStr];
  }

  return str
    .split(' ')
    .map(word => {
      // Handle acronyms (all caps)
      if (word.match(/^[A-Z]{2,}$/)) return word;
      
      // Handle special words
      if (word.toLowerCase() === 'ai' || word.toLowerCase() === 'api') {
        return word.toUpperCase();
      }
      if (word === '&' || word.toLowerCase() === 'and') {
        return word.toLowerCase();
      }
      if (word.includes('.')) {
        // Keep URLs like checkout.com but capitalize first letter
        const parts = word.split('.');
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() + '.' + parts.slice(1).join('.');
      }
      
      // Capitalize first letter, lowercase rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

async function main() {
  console.log('🧹 Cleaning up junk entries and fixing company names...\n');

  // List of junk entries to delete
  const junkEntries = [
    'Visit our Privacy Policy for More Info',
    'CCPA Notice',
    'Regulatory Notices',
    'Statement Disclaimer',
    'Legal Disclaimer',
    'Privacy Policy',
    'Terms of Use',
    'Responsibility',
    'For Enterprise',
    'LP Portal',
    'Newsroom',
    'Join Insight',
    'Contact US',
    'Go Login',
    'Sectors',
    'Events',
    'Ideas',
    'Visit our Privacy Policy for more info',
    'No contact listed',
    'Team',
    'Portfolio',
    'Why Insight?',
    'Why Insight',
  ];

  // Get all companies
  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name')
    .order('name');

  if (fetchError) {
    console.error('❌ Error fetching companies:', fetchError);
    process.exit(1);
  }

  if (!companies) {
    console.log('No companies found');
    return;
  }

  console.log(`Found ${companies.length} companies in database\n`);

  // Delete junk entries
  console.log('🗑️  Deleting junk entries...');
  let deletedCount = 0;
  
  for (const company of companies) {
    const name = company.name.trim();
    
    // Check if it's a junk entry (case-insensitive)
    const isJunk = junkEntries.some(junk => 
      name.toLowerCase() === junk.toLowerCase() ||
      name.toLowerCase().includes('privacy policy') ||
      name.toLowerCase().includes('disclaimer') ||
      name.toLowerCase().includes('terms of use') ||
      name.toLowerCase().includes('regulatory notice') ||
      name.toLowerCase().includes('ccpa notice') ||
      name.toLowerCase() === 'sectors' ||
      name.toLowerCase() === 'events' ||
      name.toLowerCase() === 'ideas' ||
      name.toLowerCase() === 'newsroom' ||
      name.toLowerCase() === 'contact us' ||
      name.toLowerCase() === 'go login' ||
      name.toLowerCase() === 'lp portal' ||
      name.toLowerCase() === 'for enterprise' ||
      name.toLowerCase() === 'join insight' ||
      name.toLowerCase() === 'no contact listed' ||
      name.toLowerCase() === 'team' ||
      name.toLowerCase() === 'portfolio' ||
      name.toLowerCase().includes('why insight')
    );

    if (isJunk) {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);
      
      if (error) {
        console.log(`  ⚠️  Failed to delete "${name}": ${error.message}`);
      } else {
        console.log(`  ✅ Deleted: "${name}"`);
        deletedCount++;
      }
    }
  }

  console.log(`\n✅ Deleted ${deletedCount} junk entries\n`);

  // Fix capitalization for real companies
  console.log('📝 Fixing company name capitalization...');
  let updatedCount = 0;

  // Re-fetch companies after deletion
  const { data: remainingCompanies, error: refetchError } = await supabase
    .from('companies')
    .select('id, name')
    .order('name');

  if (refetchError) {
    console.error('❌ Error re-fetching companies:', refetchError);
    return;
  }

  for (const company of remainingCompanies || []) {
    const currentName = company.name.trim();
    const titleCaseName = toTitleCase(currentName);

    // Only update if the name changed
    if (currentName !== titleCaseName) {
      const { error } = await supabase
        .from('companies')
        .update({ name: titleCaseName })
        .eq('id', company.id);

      if (error) {
        console.log(`  ⚠️  Failed to update "${currentName}": ${error.message}`);
      } else {
        console.log(`  ✅ "${currentName}" → "${titleCaseName}"`);
        updatedCount++;
      }
    }
  }

  console.log(`\n✅ Updated ${updatedCount} company names\n`);
  console.log('✨ Cleanup complete!');
}

main().catch(console.error);

