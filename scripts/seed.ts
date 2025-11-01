import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const mockCompanies = [
  'Starlight Solutions',
  'Vertex PayTech',
  'CloudVault Security',
  'DataFlow Analytics',
  'NextGen Healthcare',
  'SmartRoute Logistics',
  'GreenEnergy Systems',
  'FinTech Innovations',
  'EdTech Solutions',
  'RetailAI Platform',
  'BioTech Research',
  'AutoDrive Technologies',
  'RealEstate Pro',
  'FoodTech Hub',
  'MediaStream Inc',
  'Blockchain Ventures',
  'AI Research Labs',
  'Cybersecurity Pro',
  'Enterprise Software Co',
  'Mobile App Studios',
];

async function seedDatabase() {
  console.log('Starting database seed...');

  // Check if companies already exist
  const { count } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });

  if (count && count > 0) {
    console.log(`Database already has ${count} companies. Skipping seed.`);
    return;
  }

  // Insert mock companies
  const companiesToInsert = mockCompanies.map((name) => ({
    name,
  }));

  const { data, error } = await supabase
    .from('companies')
    .insert(companiesToInsert)
    .select();

  if (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }

  console.log(`Successfully seeded ${data?.length || 0} companies!`);
}

seedDatabase();

