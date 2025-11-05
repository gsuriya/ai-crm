import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!supabaseUrl || !dbPassword) {
    console.error('❌ Missing credentials');
    console.log('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD');
    process.exit(1);
  }

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
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'company_financials');"
    );

    if (!tableCheck.rows[0].exists) {
      console.log('📋 Creating company_financials table...');
      // Read and run the initial migration
      const initialMigrationPath = path.join(__dirname, '../lib/db/migrations/add_financials_and_docs.sql');
      const initialSql = fs.readFileSync(initialMigrationPath, 'utf-8');
      await client.query(initialSql);
      console.log('✅ Created company_financials table\n');
    } else {
      console.log('✅ company_financials table already exists\n');
    }

    // Check if month column exists
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'company_financials' 
        AND column_name = 'month'
      );
    `);

    if (!columnCheck.rows[0].exists) {
      console.log('📋 Adding month column to company_financials...');
      const addMonthSql = `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'company_financials' 
            AND column_name = 'month'
          ) THEN
            ALTER TABLE company_financials ADD COLUMN month INTEGER CHECK (month >= 1 AND month <= 12);
            
            ALTER TABLE company_financials DROP CONSTRAINT IF EXISTS company_financials_company_id_year_key;
            ALTER TABLE company_financials ADD CONSTRAINT company_financials_company_id_year_month_key 
              UNIQUE(company_id, year, month);
          END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_company_financials_month ON company_financials(month);
      `;
      await client.query(addMonthSql);
      console.log('✅ Added month column and updated constraints\n');
    } else {
      console.log('✅ month column already exists\n');
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nPlease run the migrations manually in Supabase SQL Editor.');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

