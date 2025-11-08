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

async function createBucketIfNotExists(bucketName: string): Promise<boolean> {
  try {
    // Try to list buckets to check if it exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const bucketExists = buckets?.some(b => b.id === bucketName);
    
    if (!bucketExists) {
      console.log(`📦 Creating bucket '${bucketName}'...`);
      
      // Create bucket using Management API
      const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey,
        },
        body: JSON.stringify({
          id: bucketName,
          name: bucketName,
          public: true,
          file_size_limit: 5242880, // 5MB
          allowed_mime_types: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ❌ Failed to create bucket: ${errorText}`);
        return false;
      }

      console.log(`   ✅ Bucket created successfully!`);
    } else {
      console.log(`   ✅ Bucket '${bucketName}' already exists`);
    }
    
    return true;
  } catch (error: any) {
    console.error(`Error checking/creating bucket:`, error.message);
    return false;
  }
}

async function uploadLogoToStorage(filePath: string, fileName: string, bucket: string = 'company-logos'): Promise<string | null> {
  try {
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    const fileExt = path.extname(filePath);
    
    // Upload to Supabase Storage (no prefix needed, bucket name is already company-logos)
    const storageFileName = `${fileName}${fileExt}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storageFileName, fileBuffer, {
        contentType: fileExt === '.png' ? 'image/png' : fileExt === '.jpeg' || fileExt === '.jpg' ? 'image/jpeg' : 'image/png',
        upsert: true, // Overwrite if exists
      });

    if (error) {
      // Try creating the bucket if it doesn't exist
      if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
        console.log(`⚠️  Bucket '${bucket}' not found.`);
        console.log(`   Please create it in Supabase Dashboard:`);
        console.log(`   1. Go to Storage > Buckets`);
        console.log(`   2. Click "New bucket"`);
        console.log(`   3. Name: company-logos`);
        console.log(`   4. Make it public`);
        console.log(`   5. Run this script again`);
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

  // Check/create bucket
  await createBucketIfNotExists('company-logos');

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

