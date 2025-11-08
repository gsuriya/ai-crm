import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function uploadLogoToStorage(filePath: string, fileName: string, bucket: string = 'pitch-decks'): Promise<string | null> {
  try {
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    const fileExt = path.extname(filePath);
    
    // Upload to Supabase Storage
    const storageFileName = `company-logos/${fileName}${fileExt}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storageFileName, fileBuffer, {
        contentType: fileExt === '.png' ? 'image/png' : fileExt === '.jpeg' || fileExt === '.jpg' ? 'image/jpeg' : 'image/png',
        upsert: true, // Overwrite if exists
      });

    if (error) {
      // Try creating the bucket if it doesn't exist
      if (error.message.includes('Bucket not found')) {
        console.log(`⚠️  Bucket '${bucket}' not found. Please create it in Supabase Dashboard > Storage.`);
        console.log(`   Or we can try uploading to a different bucket...`);
        return null;
      }
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(storageFileName);

    return urlData.publicUrl;
  } catch (error: any) {
    console.error(`❌ Error uploading ${fileName}:`, error.message);
    return null;
  }
}

async function updateCompanyLogo(companyName: string, logoUrl: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('companies')
      .update({ logo_url: logoUrl })
      .ilike('name', companyName);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error(`❌ Error updating ${companyName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Uploading company logos to Supabase Storage...\n');

  const logos = [
    { filePath: './public/flank.jpeg', companyName: 'Flank', fileName: 'flank' },
    { filePath: './public/crew.png', companyName: 'CrewAI', fileName: 'crew' },
  ];

  for (const logo of logos) {
    const fullPath = path.resolve(process.cwd(), logo.filePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${logo.filePath}`);
      continue;
    }

    console.log(`📤 Uploading ${logo.companyName} logo...`);
    const publicUrl = await uploadLogoToStorage(fullPath, logo.fileName);

    if (publicUrl) {
      console.log(`   ✅ Uploaded: ${publicUrl}`);
      
      const updated = await updateCompanyLogo(logo.companyName, publicUrl);
      if (updated) {
        console.log(`   ✅ Updated database record\n`);
      } else {
        console.log(`   ❌ Failed to update database\n`);
      }
    } else {
      console.log(`   ❌ Failed to upload\n`);
    }
  }

  console.log('✨ Done!\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

