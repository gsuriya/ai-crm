import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Client } from 'pg';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!supabaseUrl || !dbPassword) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_DB_PASSWORD');
    process.exit(1);
  }

  // Extract project ref from URL
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    console.error('❌ Invalid Supabase URL format');
    process.exit(1);
  }

  const projectRef = urlMatch[1];
  const dbHost = `db.${projectRef}.supabase.co`;
  const dbPort = 5432;
  const dbUser = 'postgres';
  const dbName = 'postgres';

  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Check if table exists
    const tableCheck = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'company_events');"
    );

    if (!tableCheck.rows[0].exists) {
      console.log('📋 Creating company_events and company_monitoring_config tables...');
      const migrationPath = path.join(__dirname, '../lib/db/migrations/add_company_events.sql');
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      await client.query(sql);
      console.log('✅ Created tables successfully\n');
    } else {
      console.log('✅ company_events table already exists\n');
    }

    await client.end();
    console.log('✅ Migration complete!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();

